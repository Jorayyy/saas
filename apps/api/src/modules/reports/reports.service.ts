import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSalesReport(tenantId: string, params: {
    from?: string;
    to?: string;
    branchId?: string;
    groupIdBy?: 'day' | 'week' | 'month';
  }) {
    const { from, to, branchId, groupIdBy = 'day' } = params;

    const dateFilter = from && to
      ? { createdAt: { gte: new Date(from), lte: new Date(to) } }
      : {};

    const where = {
      tenantId,
      status: 'COMPLETED',
      ...(branchId && { branchId }),
      ...dateFilter,
    };

    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        total: true,
        discount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by period
    const grouped: Record<string, { total: number; discount: number; count: number }> = {};

    sales.forEach(sale => {
      let key: string;
      const date = sale.createdAt;

      if (groupIdBy === 'week') {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = startOfWeek.toISOString().split('T')[0];
      } else if (groupIdBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) {
        grouped[key] = { total: 0, discount: 0, count: 0 };
      }

      grouped[key].total += Number(sale.total);
      grouped[key].discount += Number(sale.discount);
      grouped[key].count += 1;
    });

    return {
      totalRevenue: sales.reduce((sum, s) => sum + Number(s.total), 0),
      totalDiscounts: sales.reduce((sum, s) => sum + Number(s.discount), 0),
      transactionCount: sales.length,
      byPeriod: grouped,
    };
  }

  async getProductReport(tenantId: string, params: {
    from?: string;
    to?: string;
    branchId?: string;
  }) {
    const { from, to, branchId } = params;

    const dateFilter = from && to
      ? { createdAt: { gte: new Date(from), lte: new Date(to) } }
      : {};

    const where = {
      tenantId,
      sale: {
        status: 'COMPLETED',
        ...(branchId && { branchId }),
        ...dateFilter,
      },
    };

    const productSales = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where,
      _sum: { quantity: true, total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 20,
    });

    // Get product details
    const productIds = productSales.map(ps => ps.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });

    return productSales.map(ps => ({
      product: products.find(p => p.id === ps.productId),
      quantitySold: ps._sum.quantity,
      revenue: Number(ps._sum.total),
      transactionCount: ps._count,
    }));
  }

  async getProfitReport(tenantId: string, params: {
    from?: string;
    to?: string;
    branchId?: string;
  }) {
    const { from, to, branchId } = params;

    const dateFilter = from && to
      ? { createdAt: { gte: new Date(from), lte: new Date(to) } }
      : {};

    const salesWhere = {
      tenantId,
      status: 'COMPLETED',
      ...(branchId && { branchId }),
      ...dateFilter,
    };

    const [sales, saleItems] = await Promise.all([
      this.prisma.sale.aggregate({
        where: salesWhere,
        _sum: { total: true, discount: true },
      }),
      this.prisma.saleItem.findMany({
        where: {
          tenantId,
          sale: salesWhere,
        },
        include: {
          product: { select: { id: true, purchaseCost: true } },
        },
      }),
    ]);

    let totalRevenue = Number(sales._sum.total || 0);
    let totalCost = 0;

    saleItems.forEach(item => {
      if (item.product?.purchaseCost) {
        totalCost += item.quantity * Number(item.product.purchaseCost);
      }
    });

    const profit = totalRevenue - totalCost;

    return {
      totalRevenue,
      totalCost,
      profit,
      profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
    };
  }

  async getInventoryReport(tenantId: string, branchId?: string) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(branchId && { branchId }),
    };

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        purchaseCost: true,
        sellingPrice: true,
      },
    });

    const inventoryValue = products.reduce(
      (sum, p) => sum + p.currentStock * Number(p.purchaseCost),
      0
    );

    const retailValue = products.reduce(
      (sum, p) => sum + p.currentStock * Number(p.sellingPrice),
      0
    );

    const lowStock = products.filter(p => p.currentStock <= p.minimumStock);
    const outOfStock = products.filter(p => p.currentStock === 0);

    return {
      totalProducts: products.length,
      inventoryValue,
      retailValue,
      potentialProfit: retailValue - inventoryValue,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
    };
  }
}
