import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateTenantDto {
  name: string;
  slug: string;
  plan?: string;
  settings?: Record<string, any>;
}

export interface UpdateTenantDto {
  name?: string;
  plan?: string;
  status?: string;
  settings?: Record<string, any>;
}

export interface TenantQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  plan?: string;
}

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: TenantQuery) {
    const { page = 1, limit = 20, search, status, plan } = query;

    const where: any = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
      ...(plan && { plan }),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          _count: {
            select: { users: true, branches: true, products: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            users: true,
            branches: true,
            products: true,
            customers: true,
            sales: true,
            repairs: true,
          },
        },
        modules: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Slug already in use');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        plan: (dto.plan as any) || 'FREE',
        settings: dto.settings || {},
      },
    });

    // Create default branch
    await this.prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Branch',
        code: 'MAIN',
        isWarehouse: true,
      },
    });

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.plan && { plan: dto.plan as any }),
        ...(dto.status && { status: dto.status as any }),
        ...(dto.settings && { settings: dto.settings }),
      },
    });
  }

  async remove(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Soft delete
    await this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });

    return { message: 'Tenant deleted successfully' };
  }

  async updateSettings(id: string, settings: Record<string, any>) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const currentSettings = (tenant.settings as Record<string, any>) || {};

    return this.prisma.tenant.update({
      where: { id },
      data: { settings: { ...currentSettings, ...settings } },
    });
  }

  async getModules(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenantModule.findMany({
      where: { tenantId: id },
    });
  }

  async updateModule(id: string, module: string, enabled: boolean, settings?: Record<string, any>) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenantModule.upsert({
      where: { tenantId_module: { tenantId: id, module } },
      update: { enabled, settings },
      create: { tenantId: id, module, enabled, settings },
    });
  }

  async suspend(id: string) {
    return this.update(id, { status: 'SUSPENDED' });
  }

  async reactivate(id: string) {
    return this.update(id, { status: 'ACTIVE' });
  }
}
