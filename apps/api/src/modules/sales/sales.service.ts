import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateSaleDto {
  customerId?: string;
  branchId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
  payments: Array<{
    method: string;
    amount: number;
    reference?: string;
  }>;
  notes?: string;
}

export interface CreateRefundDto {
  items: Array<{
    saleItemId: string;
    quantity: number;
    reason: string;
  }>;
  reason: string;
  notes?: string;
}

export interface SaleQuery {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  paymentMethod?: string;
}

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: SaleQuery) {
    const { page = 1, limit = 20, status, customerId, from, to, paymentMethod } = query;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(from && to && { createdAt: { gte: new Date(from), lte: new Date(to) } }),
      ...(paymentMethod && { payments: { some: { method: paymentMethod } } }),
    };

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          items: { select: { id: true } },
          payments: { select: { id: true, method: true, amount: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data: sales,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: {
          include: { user: { select: { id: true, name: true } } },
        },
        refunds: {
          include: {
            items: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }

  async create(tenantId: string, dto: CreateSaleDto, userId: string) {
    // Validate stock availability
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

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;

    const items = dto.items.map(item => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = item.discount || 0;
      const itemTotal = itemSubtotal - itemDiscount;
      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: itemDiscount,
        total: itemTotal,
      };
    });

    const total = subtotal - totalDiscount;

    // Validate payments cover total
    const totalPaid = dto.payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid < total) {
      throw new BadRequestException('Insufficient payment amount');
    }

    // Generate sale number
    const saleCount = await this.prisma.sale.count({ where: { tenantId } });
    const saleNumber = `SALE-${String(saleCount + 1).padStart(8, '0')}`;

    const sale = await this.prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          userId,
          branchId: dto.branchId,
          saleNumber,
          status: 'COMPLETED',
          subtotal,
          discount: totalDiscount,
          total,
          paid: totalPaid,
          change: totalPaid - total,
          notes: dto.notes,
        },
      });

      // Create items and update stock
      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            tenantId,
            ...item,
          },
        });

        // Deduct stock
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });

        // Create inventory movement
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            branchId: dto.branchId,
            quantityBefore: 0,
            quantityChange: -item.quantity,
            quantityAfter: 0,
            transactionType: 'SALE',
            userId,
            referenceType: 'Sale',
            referenceId: newSale.id,
          },
        });
      }

      // Create payments
      for (const payment of dto.payments) {
        await tx.payment.create({
          data: {
            tenantId,
            saleId: newSale.id,
            method: payment.method as any,
            amount: payment.amount,
            reference: payment.reference,
            userId,
          },
        });
      }

      // Use credit if customer
      if (dto.customerId && totalPaid < total) {
        const creditUsed = total - totalPaid;
        const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });

        if (customer && Number(customer.creditBalance) >= creditUsed) {
          await tx.creditTransaction.create({
            data: {
              tenantId,
              customerId: dto.customerId,
              type: 'REDEEM',
              amount: creditUsed,
              notes: `Applied to ${saleNumber}`,
              userId,
            },
          });

          await tx.customer.update({
            where: { id: dto.customerId },
            data: { creditBalance: { decrement: creditUsed } },
          });
        }
      }

      // Update customer total purchases
      if (dto.customerId) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: { totalPurchases: { increment: total } },
        });
      }

      return newSale;
    });

    return this.findOne(tenantId, sale.id);
  }

  async refund(tenantId: string, saleId: string, dto: CreateRefundDto, userId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId, status: 'COMPLETED' },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found or cannot be refunded');
    }

    // Validate refund items
    for (const item of dto.items) {
      const saleItem = sale.items.find(i => i.id === item.saleItemId);
      if (!saleItem) {
        throw new NotFoundException(`Sale item ${item.saleItemId} not found`);
      }

      if (item.quantity > saleItem.quantity) {
        throw new BadRequestException('Refund quantity exceeds original quantity');
      }
    }

    let refundTotal = 0;

    const refund = await this.prisma.$transaction(async (tx) => {
      // Calculate refund total
      for (const item of dto.items) {
        const saleItem = sale.items.find(i => i.id === item.saleItemId);
        if (saleItem) {
          refundTotal += item.quantity * saleItem.unitPrice;
        }
      }

      // Create refund
      const newRefund = await tx.refund.create({
        data: {
          tenantId,
          saleId,
          userId,
          reason: dto.reason,
          notes: dto.notes,
          total: refundTotal,
          status: 'COMPLETED',
        },
      });

      // Create refund items and restore stock
      for (const item of dto.items) {
        const saleItem = sale.items.find(i => i.id === item.saleItemId);
        if (saleItem) {
          await tx.refundItem.create({
            data: {
              refundId: newRefund.id,
              tenantId,
              saleItemId: item.saleItemId,
              productId: saleItem.productId,
              quantity: item.quantity,
              unitPrice: saleItem.unitPrice,
              total: item.quantity * saleItem.unitPrice,
              reason: item.reason,
            },
          });

          // Restore stock
          await tx.product.update({
            where: { id: saleItem.productId },
            data: { currentStock: { increment: item.quantity } },
          });

          // Create inventory movement
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              productId: saleItem.productId,
              branchId: sale.branchId,
              quantityBefore: 0,
              quantityChange: item.quantity,
              quantityAfter: 0,
              transactionType: 'REFUND',
              userId,
              referenceType: 'Refund',
              referenceId: newRefund.id,
            },
          });
        }
      }

      // Update sale status
      if (refundTotal === Number(sale.total)) {
        await tx.sale.update({
          where: { id: saleId },
          data: { status: 'REFUNDED' },
        });
      } else {
        await tx.sale.update({
          where: { id: saleId },
          data: { status: 'PARTIALLY_REFUNDED' },
        });
      }

      // Update customer total purchases
      if (sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { totalPurchases: { decrement: refundTotal } },
        });
      }

      return newRefund;
    });

    return refund;
  }

  async getDailySummary(tenantId: string, branchId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const where = {
      tenantId,
      branchId,
      status: 'COMPLETED',
      createdAt: { gte: targetDate, lt: nextDate },
    };

    const [summary, payments, topProducts] = await Promise.all([
      this.prisma.sale.aggregate({
        where,
        _sum: { total: true, discount: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { tenantId, branchId, sale: where },
        _sum: { amount: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: { tenantId, branchId, sale: where },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      date: targetDate,
      totalSales: Number(summary._sum.total || 0),
      totalDiscounts: Number(summary._sum.discount || 0),
      transactionCount: summary._count,
      paymentsByMethod: payments.map(p => ({
        method: p.method,
        total: Number(p._sum.amount),
      })),
      topProducts,
    };
  }
}
