import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(tenantId: string, branchId?: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const saleWhere = {
      tenantId,
      status: 'COMPLETED' as const,
      ...(branchId && { branchId }),
    };

    // Today's sales
    const todaySales = await this.prisma.sale.aggregate({
      where: { ...saleWhere, createdAt: { gte: todayStart } },
      _count: true,
      _sum: { total: true, taxAmount: true },
    });

    // Weekly sales
    const weekSales = await this.prisma.sale.aggregate({
      where: { ...saleWhere, createdAt: { gte: weekStart } },
      _count: true,
      _sum: { total: true },
    });

    // Monthly sales
    const monthSales = await this.prisma.sale.aggregate({
      where: { ...saleWhere, createdAt: { gte: monthStart } },
      _count: true,
      _sum: { total: true },
    });

    // Monthly expenses
    const monthExpenses = await this.prisma.expense.aggregate({
      where: {
        tenantId,
        status: 'APPROVED',
        expenseDate: { gte: monthStart },
        ...(branchId && { branchId }),
      },
      _sum: { amount: true },
    });

    // Repairs stats
    const activeRepairs = await this.prisma.repairTicket.count({
      where: {
        tenantId,
        status: { in: ['RECEIVED', 'DIAGNOSING', 'WAITING_FOR_APPROVAL', 'WAITING_FOR_PARTS', 'IN_REPAIR'] },
        ...(branchId && { branchId }),
      },
    });

    const completedRepairs = await this.prisma.repairTicket.count({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: monthStart },
        ...(branchId && { branchId }),
      },
    });

    const overdueRepairs = await this.prisma.repairTicket.count({
      where: {
        tenantId,
        estimatedCompletion: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        ...(branchId && { branchId }),
      },
    });

    // Low stock products
    const lowStockProducts = await this.prisma.product.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        currentStock: { lte: 10 }, // Will use minimumStock in production
      },
    });

    // New customers this month
    const newCustomers = await this.prisma.customer.count({
      where: {
        tenantId,
        createdAt: { gte: monthStart },
      },
    });

    return {
      today: {
        sales: todaySales._count,
        revenue: Number(todaySales._sum.total || 0),
        tax: Number(todaySales._sum.taxAmount || 0),
      },
      week: {
        sales: weekSales._count,
        revenue: Number(weekSales._sum.total || 0),
      },
      month: {
        sales: monthSales._count,
        revenue: Number(monthSales._sum.total || 0),
        expenses: Number(monthExpenses._sum.amount || 0),
        netRevenue: Number(monthSales._sum.total || 0) - Number(monthExpenses._sum.amount || 0),
      },
      repairs: {
        active: activeRepairs,
        completed: completedRepairs,
        overdue: overdueRepairs,
      },
      lowStockProducts,
      newCustomers,
    };
  }

  async getSalesChart(tenantId: string, days = 7) {
    const labels = [];
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const sales = await this.prisma.sale.aggregate({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: { gte: date, lt: nextDate },
        },
        _sum: { total: true },
        _count: true,
      });

      labels.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
      data.push({
        date: date.toISOString().split('T')[0],
        revenue: Number(sales._sum.total || 0),
        count: sales._count,
      });
    }

    return { labels, data };
  }

  async getTopProducts(tenantId: string, limit = 5) {
    const topProducts = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        tenantId,
        sale: { status: 'COMPLETED' },
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
      _sum: { quantity: true, total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const productIds = topProducts.map(tp => tp.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });

    return topProducts.map(tp => {
      const product = products.find(p => p.id === tp.productId);
      return {
        product,
        totalRevenue: Number(tp._sum.total || 0),
        totalQuantity: tp._sum.quantity,
        salesCount: tp._count,
      };
    });
  }

  async getTopTechnicians(tenantId: string, limit = 5) {
    const topTechs = await this.prisma.repairTicket.groupBy({
      by: ['technicianId'],
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const techIds = topTechs.map(tt => tt.technicianId).filter(Boolean) as string[];
    const technicians = await this.prisma.user.findMany({
      where: { id: { in: techIds } },
      select: { id: true, name: true, email: true },
    });

    return topTechs.map(tt => ({
      technician: technicians.find(t => t.id === tt.technicianId),
      completedRepairs: tt._count,
    }));
  }

  async getRecentTransactions(tenantId: string, limit = 10) {
    const sales = await this.prisma.sale.findMany({
      where: { tenantId, status: 'COMPLETED' },
      include: {
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sales;
  }
}
