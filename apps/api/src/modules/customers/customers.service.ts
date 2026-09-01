import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateCustomerDto {
  customerCode?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Record<string, any>;
  taxId?: string;
  notes?: string;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  status?: string;
}

export interface CreateDeviceDto {
  deviceType: string;
  brand: string;
  model: string;
  serialNumber?: string;
  imei?: string;
  color?: string;
  notes?: string;
}

export interface CustomerQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: CustomerQuery) {
    const { page = 1, limit = 20, search, status, sort = 'createdAt', order = 'desc' } = query;

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { customerCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
    };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          _count: { select: { sales: true, repairs: true, devices: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async search(tenantId: string, query: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { customerCode: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        customerCode: true,
        name: true,
        email: true,
        phone: true,
        creditBalance: true,
        totalPurchases: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return customers;
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        devices: { orderBy: { createdAt: 'desc' } },
        sales: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            saleNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
        repairs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            ticketNumber: true,
            deviceBrand: true,
            deviceModel: true,
            status: true,
            totalCost: true,
            createdAt: true,
          },
        },
        credits: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { sales: true, repairs: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate lifetime value
    const lifetimeValue = await this.calculateLifetimeValue(tenantId, id);

    return {
      ...customer,
      lifetimeValue,
    };
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    // Generate customer code if not provided
    const customerCode = dto.customerCode || await this.generateCustomerCode(tenantId);

    // Check code uniqueness
    const existing = await this.prisma.customer.findFirst({
      where: { tenantId, customerCode, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Customer code already exists');
    }

    // Check phone/email uniqueness
    if (dto.phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: { tenantId, phone: dto.phone, deletedAt: null },
      });

      if (existingPhone) {
        throw new BadRequestException('Phone number already registered');
      }
    }

    return this.prisma.customer.create({
      data: {
        tenantId,
        customerCode,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        taxId: dto.taxId,
        notes: dto.notes,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status && { status: dto.status as any }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { _count: { select: { sales: true, repairs: true } } },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer._count.sales > 0 || customer._count.repairs > 0) {
      // Soft delete
      await this.prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      });
      return { message: 'Customer deactivated' };
    }

    await this.prisma.customer.delete({ where: { id } });
    return { message: 'Customer deleted successfully' };
  }

  async getDevices(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customerDevice.findMany({
      where: { customerId, tenantId },
      include: {
        repairs: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: { id: true, ticketNumber: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addDevice(tenantId: string, customerId: string, dto: CreateDeviceDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customerDevice.create({
      data: {
        customerId,
        tenantId,
        deviceType: dto.deviceType as any,
        brand: dto.brand,
        model: dto.model,
        serialNumber: dto.serialNumber,
        imei: dto.imei,
        color: dto.color,
        notes: dto.notes,
      },
    });
  }

  async addCredit(tenantId: string, customerId: string, dto: {
    amount: number;
    type: string;
    notes?: string;
  }, userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const newBalance = dto.type === 'EARN'
      ? Number(customer.creditBalance) + dto.amount
      : Number(customer.creditBalance) - dto.amount;

    if (newBalance < 0) {
      throw new BadRequestException('Insufficient credit balance');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          tenantId,
          customerId,
          type: dto.type as any,
          amount: dto.amount,
          notes: dto.notes,
          userId,
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { creditBalance: newBalance },
      });
    });

    return { balance: newBalance };
  }

  async getCredits(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const transactions = await this.prisma.creditTransaction.findMany({
      where: { customerId, tenantId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      balance: customer.creditBalance,
      transactions,
    };
  }

  async getLifetimeValue(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.calculateLifetimeValue(tenantId, customerId);
  }

  private async calculateLifetimeValue(tenantId: string, customerId: string) {
    const [salesAgg, repairsAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { tenantId, customerId, status: 'COMPLETED' },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.repairTicket.aggregate({
        where: { tenantId, customerId, status: 'COMPLETED' },
        _sum: { totalCost: true },
        _count: true,
      }),
    ]);

    const totalSales = Number(salesAgg._sum.total || 0);
    const totalRepairs = Number(repairsAgg._sum.totalCost || 0);

    return {
      totalRevenue: totalSales + totalRepairs,
      salesRevenue: totalSales,
      repairsRevenue: totalRepairs,
      totalTransactions: salesAgg._count + repairsAgg._count,
    };
  }

  private async generateCustomerCode(tenantId: string): Promise<string> {
    const count = await this.prisma.customer.count({ where: { tenantId } });
    return `CUS-${String(count + 1).padStart(6, '0')}`;
  }
}
