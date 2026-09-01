import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateProductDto {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  purchaseCost: number;
  sellingPrice: number;
  wholesalePrice?: number;
  taxRate?: number;
  warrantyMonths?: number;
  minimumStock?: number;
  currentStock?: number;
  unit?: string;
  isSerialized?: boolean;
  weight?: number;
  notes?: string;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  lowStock?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface BulkImportItem {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  supplier?: string;
  purchaseCost: number;
  sellingPrice: number;
  wholesalePrice?: number;
  taxRate?: number;
  warrantyMonths?: number;
  minimumStock?: number;
  currentStock?: number;
  unit?: string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: ProductQuery) {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      brandId,
      supplierId,
      status,
      minPrice,
      maxPrice,
      inStock,
      lowStock,
      sort = 'createdAt',
      order = 'desc',
    } = query;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(supplierId && { supplierId }),
      ...(status && { status: status as any }),
      ...(minPrice !== undefined && { sellingPrice: { gte: minPrice } }),
      ...(maxPrice !== undefined && { sellingPrice: { lte: maxPrice } }),
      ...(inStock !== undefined && inStock && { currentStock: { gt: 0 } }),
      ...(lowStock !== undefined && lowStock && { currentStock: { lte: 10 } }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          supplier: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: true,
        brand: true,
        supplier: true,
        inventoryMovements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findByBarcode(tenantId: string, barcode: string) {
    const product = await this.prisma.product.findFirst({
      where: { tenantId, barcode, deletedAt: null, status: 'ACTIVE' },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found with this barcode');
    }

    return product;
  }

  async create(tenantId: string, dto: CreateProductDto) {
    // Check SKU uniqueness
    const existingSku = await this.prisma.product.findFirst({
      where: { tenantId, sku: dto.sku, deletedAt: null },
    });

    if (existingSku) {
      throw new BadRequestException('SKU already exists');
    }

    // Check barcode uniqueness if provided
    if (dto.barcode) {
      const existingBarcode = await this.prisma.product.findFirst({
        where: { tenantId, barcode: dto.barcode, deletedAt: null },
      });

      if (existingBarcode) {
        throw new BadRequestException('Barcode already exists');
      }
    }

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        sku: dto.sku,
        barcode: dto.barcode,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        supplierId: dto.supplierId,
        purchaseCost: dto.purchaseCost,
        sellingPrice: dto.sellingPrice,
        wholesalePrice: dto.wholesalePrice,
        taxRate: dto.taxRate || 0,
        warrantyMonths: dto.warrantyMonths || 0,
        minimumStock: dto.minimumStock || 0,
        currentStock: dto.currentStock || 0,
        unit: (dto.unit as any) || 'PIECE',
        isSerialized: dto.isSerialized || false,
        weight: dto.weight,
        notes: dto.notes,
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    // Create initial inventory movement if stock > 0
    if (product.currentStock > 0) {
      await this.prisma.inventoryMovement.create({
        data: {
          tenantId,
          productId: product.id,
          branchId: await this.getDefaultBranchId(tenantId),
          quantityBefore: 0,
          quantityChange: product.currentStock,
          quantityAfter: product.currentStock,
          transactionType: 'PURCHASE',
          notes: 'Initial stock',
        },
      });
    }

    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check SKU uniqueness if changed
    if (dto.sku && dto.sku !== product.sku) {
      const existingSku = await this.prisma.product.findFirst({
        where: { tenantId, sku: dto.sku, deletedAt: null, id: { not: id } },
      });

      if (existingSku) {
        throw new BadRequestException('SKU already exists');
      }
    }

    // Check barcode uniqueness if changed
    if (dto.barcode && dto.barcode !== product.barcode) {
      const existingBarcode = await this.prisma.product.findFirst({
        where: { tenantId, barcode: dto.barcode, deletedAt: null, id: { not: id } },
      });

      if (existingBarcode) {
        throw new BadRequestException('Barcode already exists');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.brandId !== undefined && { brandId: dto.brandId }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.purchaseCost !== undefined && { purchaseCost: dto.purchaseCost }),
        ...(dto.sellingPrice !== undefined && { sellingPrice: dto.sellingPrice }),
        ...(dto.wholesalePrice !== undefined && { wholesalePrice: dto.wholesalePrice }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.warrantyMonths !== undefined && { warrantyMonths: dto.warrantyMonths }),
        ...(dto.minimumStock !== undefined && { minimumStock: dto.minimumStock }),
        ...(dto.unit && { unit: dto.unit as any }),
        ...(dto.isSerialized !== undefined && { isSerialized: dto.isSerialized }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if product has sales
    const hasSales = await this.prisma.saleItem.findFirst({
      where: { productId: id },
    });

    if (hasSales) {
      throw new BadRequestException('Cannot delete product with existing sales. Mark as discontinued instead.');
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DISCONTINUED' },
    });

    return { message: 'Product deleted successfully' };
  }

  async adjustStock(
    tenantId: string,
    productId: string,
    adjustmentType: string,
    quantity: number,
    reason: string,
    userId: string,
    branchId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let newStock: number;
    const quantityBefore = product.currentStock;

    switch (adjustmentType) {
      case 'INCREASE':
        newStock = quantityBefore + quantity;
        break;
      case 'DECREASE':
        newStock = quantityBefore - quantity;
        if (newStock < 0) {
          throw new BadRequestException('Insufficient stock');
        }
        break;
      case 'SET':
        newStock = quantity;
        if (newStock < 0) {
          throw new BadRequestException('Stock cannot be negative');
        }
        break;
      default:
        throw new BadRequestException('Invalid adjustment type');
    }

    const quantityChange = newStock - quantityBefore;

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId,
          branchId,
          quantityBefore,
          quantityChange,
          quantityAfter: newStock,
          transactionType: 'ADJUSTMENT',
          userId,
          notes: reason,
        },
      });
    });

    return {
      message: 'Stock adjusted successfully',
      product: { id, name: product.name, sku: product.sku },
      adjustment: { type: adjustmentType, quantity, reason },
      stock: { before: quantityBefore, change: quantityChange, after: newStock },
    };
  }

  async getMovements(tenantId: string, productId: string, page = 1, limit = 20) {
    const where = { tenantId, productId };

    const [movements, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data: movements,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getLowStock(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        currentStock: { lte: 10 },
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { currentStock: 'asc' },
    });

    return {
      data: products,
      total: products.length,
    };
  }

  async getOutOfStock(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        currentStock: 0,
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    return {
      data: products,
      total: products.length,
    };
  }

  async bulkImport(tenantId: string, items: BulkImportItem[], userId: string) {
    const results = { created: 0, updated: 0, errors: [] as any[] };

    for (const item of items) {
      try {
        // Find or create category
        let categoryId: string | undefined;
        if (item.category) {
          const category = await this.prisma.category.findFirst({
            where: { tenantId, name: item.category },
          });
          if (category) {
            categoryId = category.id;
          }
        }

        // Find or create brand
        let brandId: string | undefined;
        if (item.brand) {
          const brand = await this.prisma.brand.findFirst({
            where: { tenantId, name: item.brand },
          });
          if (brand) {
            brandId = brand.id;
          }
        }

        // Find or create supplier
        let supplierId: string | undefined;
        if (item.supplier) {
          const supplier = await this.prisma.supplier.findFirst({
            where: { tenantId, name: item.supplier },
          });
          if (supplier) {
            supplierId = supplier.id;
          }
        }

        // Check if product exists
        const existing = await this.prisma.product.findFirst({
          where: { tenantId, sku: item.sku, deletedAt: null },
        });

        if (existing) {
          // Update existing
          await this.prisma.product.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              barcode: item.barcode,
              description: item.description,
              categoryId,
              brandId,
              supplierId,
              purchaseCost: item.purchaseCost,
              sellingPrice: item.sellingPrice,
              wholesalePrice: item.wholesalePrice,
              taxRate: item.taxRate || 0,
              warrantyMonths: item.warrantyMonths || 0,
              minimumStock: item.minimumStock || 0,
              unit: (item.unit as any) || 'PIECE',
            },
          });
          results.updated++;
        } else {
          // Create new
          await this.prisma.product.create({
            data: {
              tenantId,
              sku: item.sku,
              barcode: item.barcode,
              name: item.name,
              description: item.description,
              categoryId,
              brandId,
              supplierId,
              purchaseCost: item.purchaseCost,
              sellingPrice: item.sellingPrice,
              wholesalePrice: item.wholesalePrice,
              taxRate: item.taxRate || 0,
              warrantyMonths: item.warrantyMonths || 0,
              minimumStock: item.minimumStock || 0,
              currentStock: item.currentStock || 0,
              unit: (item.unit as any) || 'PIECE',
            },
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          sku: item.sku,
          error: error.message,
        });
      }
    }

    return results;
  }

  async exportCsv(tenantId: string, query: ProductQuery) {
    const products = await this.findAll(tenantId, { ...query, limit: 10000 });

    const csvHeader = 'SKU,Barcode,Name,Category,Brand,Purchase Cost,Selling Price,Tax Rate,Stock,Unit,Status\n';
    const csvRows = products.data.map(p =>
      `${p.sku},${p.barcode || ''},${p.name},${p.category?.name || ''},${p.brand?.name || ''},${p.purchaseCost},${p.sellingPrice},${p.taxRate},${p.currentStock},${p.unit},${p.status}`
    ).join('\n');

    return csvHeader + csvRows;
  }

  private async getDefaultBranchId(tenantId: string): Promise<string> {
    const branch = await this.prisma.branch.findFirst({
      where: { tenantId, isActive: true },
    });

    if (!branch) {
      throw new BadRequestException('No active branch found');
    }

    return branch.id;
  }
}
