import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateTransferDto {
  fromBranchId: string;
  toBranchId: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface StockAdjustmentDto {
  productId: string;
  branchId: string;
  adjustmentType: 'INCREASE' | 'DECREASE' | 'SET';
  quantity: number;
  reason: string;
}

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    const [totalProducts, totalStockValue, lowStockCount, outOfStockCount] = await Promise.all([
      this.prisma.product.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.product.aggregate({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        _sum: { currentStock: true },
        _avg: { sellingPrice: true },
      }),
      this.prisma.product.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          currentStock: { lte: 10, gt: 0 },
        },
      }),
      this.prisma.product.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          currentStock: 0,
        },
      }),
    ]);

    const stockByCategory = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      _sum: { currentStock: true, sellingPrice: true },
      _count: true,
    });

    const categories = await this.prisma.category.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
    });

    return {
      totalProducts,
      totalStock: totalStockValue._sum.currentStock || 0,
      totalStockValue: Number(totalStockValue._sum.sellingPrice || 0) * (totalStockValue._sum.currentStock || 0),
      averagePrice: Number(totalStockValue._avg.sellingPrice || 0),
      lowStockCount,
      outOfStockCount,
      stockByCategory: stockByCategory.map(s => ({
        category: categories.find(c => c.id === s.categoryId),
        stock: s._sum.currentStock,
        value: Number(s._sum.sellingPrice || 0) * (s._sum.currentStock || 0),
        count: s._count,
      })),
    };
  }

  async getMovements(tenantId: string, query: any) {
    const { page = 1, limit = 20, productId, branchId, transactionType, from, to } = query;

    const where: any = {
      tenantId,
      ...(productId && { productId }),
      ...(branchId && { branchId }),
      ...(transactionType && { transactionType }),
      ...(from && to && {
        createdAt: { gte: new Date(from), lte: new Date(to) },
      }),
    };

    const [movements, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
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

  async adjustStock(tenantId: string, dto: StockAdjustmentDto, userId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let newStock: number;
    const quantityBefore = product.currentStock;

    switch (dto.adjustmentType) {
      case 'INCREASE':
        newStock = quantityBefore + dto.quantity;
        break;
      case 'DECREASE':
        newStock = quantityBefore - dto.quantity;
        if (newStock < 0) {
          throw new BadRequestException('Insufficient stock');
        }
        break;
      case 'SET':
        newStock = dto.quantity;
        break;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: dto.productId },
        data: { currentStock: newStock },
      });

      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          branchId: dto.branchId,
          quantityBefore,
          quantityChange: newStock - quantityBefore,
          quantityAfter: newStock,
          transactionType: 'ADJUSTMENT',
          userId,
          notes: dto.reason,
        },
      });
    });

    return {
      message: 'Stock adjusted',
      product: { id: product.id, name: product.name, sku: product.sku },
      adjustment: { type: dto.adjustmentType, quantity: dto.quantity, reason: dto.reason },
      stock: { before: quantityBefore, change: newStock - quantityBefore, after: newStock },
    };
  }

  async createTransfer(tenantId: string, dto: CreateTransferDto, userId: string) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('Source and destination branches must be different');
    }

    // Validate products and stock
    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, tenantId, deletedAt: null },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.currentStock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }
    }

    // Generate reference number
    const transferCount = await this.prisma.stockTransfer.count({ where: { tenantId } });
    const referenceNumber = `TR-${String(transferCount + 1).padStart(6, '0')}`;

    const transfer = await this.prisma.$transaction(async (tx) => {
      const newTransfer = await tx.stockTransfer.create({
        data: {
          tenantId,
          fromBranchId: dto.fromBranchId,
          toBranchId: dto.toBranchId,
          referenceNumber,
          notes: dto.notes,
          userId,
        },
      });

      // Create transfer items
      for (const item of dto.items) {
        await tx.stockTransferItem.create({
          data: {
            transferId: newTransfer.id,
            tenantId,
            productId: item.productId,
            quantitySent: item.quantity,
          },
        });

        // Deduct from source branch (we'll use product-level stock for simplicity)
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } },
          });

          // Create movement
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              productId: item.productId,
              branchId: dto.fromBranchId,
              quantityBefore: product.currentStock,
              quantityChange: -item.quantity,
              quantityAfter: product.currentStock - item.quantity,
              transactionType: 'TRANSFER_OUT',
              userId,
              referenceType: 'StockTransfer',
              referenceId: newTransfer.id,
            },
          });
        }
      }

      return newTransfer;
    });

    return this.findOne(tenantId, transfer.id);
  }

  async findOne(tenantId: string, id: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, tenantId },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }

  async findAll(tenantId: string, query: any) {
    const { page = 1, limit = 20, status, fromBranchId, toBranchId } = query;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(fromBranchId && { fromBranchId }),
      ...(toBranchId && { toBranchId }),
    };

    const [transfers, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          items: { select: { id: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return {
      data: transfers.map(t => ({
        ...t,
        itemCount: t.items.length,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async receiveTransfer(tenantId: string, id: string, userId: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, tenantId, status: 'PENDING' },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found or already received');
    }

    await this.prisma.$transaction(async (tx) => {
      // Update transfer status
      await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedBy: userId,
          receivedAt: new Date(),
        },
      });

      // Add stock to destination branch
      for (const item of transfer.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: { increment: item.quantityReceived || item.quantitySent },
            },
          });

          await tx.inventoryMovement.create({
            data: {
              tenantId,
              productId: item.productId,
              branchId: transfer.toBranchId,
              quantityBefore: product.currentStock,
              quantityChange: item.quantityReceived || item.quantitySent,
              quantityAfter: product.currentStock + (item.quantityReceived || item.quantitySent),
              transactionType: 'TRANSFER_IN',
              userId,
              referenceType: 'StockTransfer',
              referenceId: id,
            },
          });
        }
      }
    });

    return this.findOne(tenantId, id);
  }

  async cancelTransfer(tenantId: string, id: string, userId: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, tenantId, status: 'PENDING' },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found or already processed');
    }

    await this.prisma.$transaction(async (tx) => {
      // Update status
      await tx.stockTransfer.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Restore stock to source branch
      for (const item of transfer.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantitySent } },
          });

          await tx.inventoryMovement.create({
            data: {
              tenantId,
              productId: item.productId,
              branchId: transfer.fromBranchId,
              quantityBefore: product.currentStock,
              quantityChange: item.quantitySent,
              quantityAfter: product.currentStock + item.quantitySent,
              transactionType: 'RETURN',
              userId,
              notes: 'Transfer cancelled',
              referenceType: 'StockTransfer',
              referenceId: id,
            },
          });
        }
      }
    });

    return this.findOne(tenantId, id);
  }
}
