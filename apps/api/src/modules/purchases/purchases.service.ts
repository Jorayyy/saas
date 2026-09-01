import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreatePurchaseOrderDto {
  supplierId: string;
  branchId: string;
  expectedDate?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
  }>;
}

export interface UpdatePurchaseOrderDto {
  expectedDate?: string;
  notes?: string;
  items?: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
  }>;
}

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: any) {
    const { page = 1, limit = 20, status, supplierId } = query;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(supplierId && { supplierId }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          items: { select: { id: true, quantityOrdered: true, quantityReceived: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    return order;
  }

  async create(tenantId: string, dto: CreatePurchaseOrderDto, userId: string) {
    // Validate supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Validate products
    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, tenantId, deletedAt: null },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
    }

    // Generate PO number
    const poCount = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${String(poCount + 1).padStart(6, '0')}`;

    // Calculate totals
    let subtotal = 0;
    const items = dto.items.map(item => {
      const itemTotal = item.quantity * item.unitCost;
      subtotal += itemTotal;
      return {
        productId: item.productId,
        quantityOrdered: item.quantity,
        unitCost: item.unitCost,
        totalCost: itemTotal,
      };
    });

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.purchaseOrder.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          branchId: dto.branchId,
          poNumber,
          status: 'DRAFT',
          subtotal,
          total: subtotal,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          notes: dto.notes,
          userId,
        },
      });

      // Create items
      for (const item of items) {
        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: newOrder.id,
            tenantId,
            ...item,
          },
        });
      }

      return newOrder;
    });

    return this.findOne(tenantId, order.id);
  }

  async submit(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, status: 'DRAFT' },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found or not in DRAFT status');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'ORDERED' },
    });
  }

  async receive(tenantId: string, id: string, userId: string, items: Array<{
    itemId: string;
    quantityReceived: number;
  }>) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found or not in receivable status');
    }

    let allReceived = true;

    await this.prisma.$transaction(async (tx) => {
      for (const receivedItem of items) {
        const orderItem = order.items.find(i => i.id === receivedItem.itemId);
        if (!orderItem) continue;

        const newQuantityReceived = orderItem.quantityReceived + receivedItem.quantityReceived;

        // Update PO item
        await tx.purchaseOrderItem.update({
          where: { id: receivedItem.itemId },
          data: { quantityReceived: newQuantityReceived },
        });

        // Update product stock
        await tx.product.update({
          where: { id: orderItem.productId },
          data: { currentStock: { increment: receivedItem.quantityReceived } },
        });

        // Create inventory movement
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: orderItem.productId,
            branchId: order.branchId,
            quantityBefore: 0, // Will be updated properly
            quantityChange: receivedItem.quantityReceived,
            quantityAfter: 0, // Will be updated properly
            transactionType: 'PURCHASE',
            userId,
            referenceType: 'PurchaseOrder',
            referenceId: id,
          },
        });

        if (newQuantityReceived < orderItem.quantityOrdered) {
          allReceived = false;
        }
      }

      // Update PO status
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        },
      });

      // Update supplier balance
      await tx.supplier.update({
        where: { id: order.supplierId },
        data: {
          outstandingBalance: { increment: order.total },
        },
      });
    });

    return this.findOne(tenantId, id);
  }

  async cancel(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, status: { in: ['DRAFT', 'ORDERED'] } },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found or cannot be cancelled');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
