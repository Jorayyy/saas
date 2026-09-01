import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateSupplierDto {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: Record<string, any>;
  taxId?: string;
  paymentTerms?: number;
  notes?: string;
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
  status?: string;
}

export interface SupplierQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: SupplierQuery) {
    const { page = 1, limit = 20, search, status } = query;

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
    };

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        include: {
          _count: { select: { products: true, purchaseOrders: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, sku: true, purchaseCost: true },
        },
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, poNumber: true, status: true, total: true, createdAt: true },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { products: true, purchaseOrders: true } },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    // Check for duplicate name
    const existing = await this.prisma.supplier.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Supplier name already exists');
    }

    return this.prisma.supplier.create({
      data: {
        tenantId,
        ...dto,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Check name uniqueness if changed
    if (dto.name && dto.name !== supplier.name) {
      const existing = await this.prisma.supplier.findFirst({
        where: { tenantId, name: dto.name, deletedAt: null, id: { not: id } },
      });

      if (existing) {
        throw new BadRequestException('Supplier name already exists');
      }
    }

    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.contactPerson && { contactPerson: dto.contactPerson }),
        ...(dto.email && { email: dto.email }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status && { status: dto.status as any }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { _count: { select: { purchaseOrders: true } } },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    if (supplier._count.purchaseOrders > 0) {
      // Soft delete
      await this.prisma.supplier.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      });
      return { message: 'Supplier deactivated' };
    }

    await this.prisma.supplier.delete({ where: { id } });
    return { message: 'Supplier deleted successfully' };
  }

  async getProducts(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return this.prisma.product.findMany({
      where: { supplierId: id, tenantId, deletedAt: null },
      select: {
        id: true,
        sku: true,
        name: true,
        purchaseCost: true,
        sellingPrice: true,
        currentStock: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getOrders(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return this.prisma.purchaseOrder.findMany({
      where: { supplierId: id, tenantId },
      include: {
        items: { select: { id: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayments(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return this.prisma.supplierPayment.findMany({
      where: { supplierId: id, tenantId },
      include: {
        purchaseOrder: { select: { id: true, poNumber: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addPayment(tenantId: string, supplierId: string, dto: {
    amount: number;
    paymentMethod: string;
    reference?: string;
    notes?: string;
    purchaseOrderId?: string;
  }, userId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      // Create payment
      const newPayment = await tx.supplierPayment.create({
        data: {
          tenantId,
          supplierId,
          purchaseOrderId: dto.purchaseOrderId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod as any,
          reference: dto.reference,
          notes: dto.notes,
          userId,
        },
      });

      // Update supplier balance
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          outstandingBalance: { decrement: dto.amount },
        },
      });

      return newPayment;
    });

    return payment;
  }
}
