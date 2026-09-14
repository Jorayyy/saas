import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: { [key: string]: any };

  beforeEach(async () => {
    prisma = {
      sale: {
        aggregate: jest.fn().mockResolvedValue({
          _count: 0,
          _sum: { total: 0, taxAmount: 0 },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      expense: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: 0 },
        }),
      },
      repairTicket: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      product: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      customer: {
        count: jest.fn().mockResolvedValue(0),
      },
      saleItem: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getSummary', () => {
    it('should return summary with correct structure', async () => {
      const result = await service.getSummary('tenant-1');

      expect(result).toHaveProperty('today');
      expect(result).toHaveProperty('week');
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('repairs');
      expect(result).toHaveProperty('lowStockProducts');
      expect(result).toHaveProperty('newCustomers');
    });

    it('should aggregate today sales correctly', async () => {
      prisma.sale.aggregate
        .mockResolvedValueOnce({
          _count: 5,
          _sum: { total: 1500, taxAmount: 180 },
        })
        .mockResolvedValue({
          _count: 0,
          _sum: { total: 0 },
        });

      const result = await service.getSummary('tenant-1');

      expect(result.today.sales).toBe(5);
      expect(result.today.revenue).toBe(1500);
      expect(result.today.tax).toBe(180);
    });

    it('should pass tenantId to all queries', async () => {
      await service.getSummary('tenant-123');

      // Verify tenantId is passed to sale aggregate
      const saleCalls = prisma.sale.aggregate.mock.calls;
      saleCalls.forEach((call: any[]) => {
        expect(call[0].where).toHaveProperty('tenantId', 'tenant-123');
      });
    });

    it('should filter by branchId when provided', async () => {
      await service.getSummary('tenant-1', 'branch-1');

      const saleCalls = prisma.sale.aggregate.mock.calls;
      saleCalls.forEach((call: any[]) => {
        expect(call[0].where).toHaveProperty('branchId', 'branch-1');
      });
    });
  });

  describe('getSalesChart', () => {
    it('should return labels and data arrays', async () => {
      const result = await service.getSalesChart('tenant-1', 7);

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('data');
      expect(result.labels).toHaveLength(7);
      expect(result.data).toHaveLength(7);
    });

    it('should return correct date format in data', async () => {
      const result = await service.getSalesChart('tenant-1', 3);

      result.data.forEach((item: any) => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('revenue');
        expect(item).toHaveProperty('count');
        expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  describe('getTopProducts', () => {
    it('should return empty array when no products sold', async () => {
      const result = await service.getTopProducts('tenant-1');

      expect(result).toEqual([]);
    });

    it('should limit results to specified limit', async () => {
      prisma.saleItem.groupBy.mockResolvedValue([
        { productId: 'p1', _sum: { quantity: 10, total: 500 }, _count: 5 },
        { productId: 'p2', _sum: { quantity: 8, total: 400 }, _count: 3 },
      ]);
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Product 1', sku: 'SKU1' },
        { id: 'p2', name: 'Product 2', sku: 'SKU2' },
      ]);

      const result = await service.getTopProducts('tenant-1', 2);

      expect(result).toHaveLength(2);
    });
  });

  describe('getRecentTransactions', () => {
    it('should return recent sales', async () => {
      prisma.sale.findMany.mockResolvedValue([
        { id: '1', saleNumber: 'SALE-001', total: 100, status: 'COMPLETED' },
      ]);

      const result = await service.getRecentTransactions('tenant-1');

      expect(result).toHaveLength(1);
      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
          take: 10,
        }),
      );
    });

    it('should respect limit parameter', async () => {
      await service.getRecentTransactions('tenant-1', 5);

      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
