import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PaymentQuery {
  page?: number;
  limit?: number;
  method?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: PaymentQuery) {
    const { page = 1, limit = 20, method, from, to } = query;

    const where: any = {
      tenantId,
      ...(method && { method }),
      ...(from && to && { createdAt: { gte: new Date(from), lte: new Date(to) } }),
    };

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          sale: { select: { id: true, saleNumber: true } },
          user: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSummary(tenantId: string, from?: string, to?: string) {
    const dateFilter = from && to
      ? { createdAt: { gte: new Date(from), lte: new Date(to) } }
      : {};

    const [summary, byMethod] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { tenantId, ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { tenantId, ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalAmount: Number(summary._sum.amount || 0),
      totalCount: summary._count,
      byMethod: byMethod.map(m => ({
        method: m.method,
        amount: Number(m._sum.amount),
        count: m._count,
      })),
    };
  }

  async getDailyPayments(tenantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      select: {
        method: true,
        amount: true,
        createdAt: true,
      },
    });

    // Group by date and method
    const grouped: Record<string, Record<string, number>> = {};

    payments.forEach(payment => {
      const date = payment.createdAt.toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = {};
      }
      grouped[date][payment.method] = (grouped[date][payment.method] || 0) + Number(payment.amount);
    });

    return grouped;
  }
}
