import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon2 from 'argon2';

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
  roleIds?: string[];
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  roleIds?: string[];
}

export interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  roleId?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: UserQuery) {
    const { page = 1, limit = 20, search, status, roleId } = query;

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
      ...(roleId && {
        roles: { some: { roleId } },
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roles: {
            include: { role: { select: { id: true, name: true, displayName: true } } },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    // Check email uniqueness within tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId,
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          phone: dto.phone,
        },
      });

      // Assign roles
      if (dto.roleIds && dto.roleIds.length > 0) {
        for (const roleId of dto.roleIds) {
          const role = await tx.role.findFirst({
            where: { id: roleId, tenantId },
          });

          if (role) {
            await tx.userRole.create({
              data: { userId: newUser.id, roleId },
            });
          }
        }
      }

      return newUser;
    });

    return this.findOne(tenantId, user.id);
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changed
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email, deletedAt: null, id: { not: id } },
      });

      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Update user
      await tx.user.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.email && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.status && { status: dto.status as any }),
        },
      });

      // Update roles if provided
      if (dto.roleIds) {
        // Remove existing roles
        await tx.userRole.deleteMany({ where: { userId: id } });

        // Add new roles
        for (const roleId of dto.roleIds) {
          const role = await tx.role.findFirst({
            where: { id: roleId, tenantId },
          });

          if (role) {
            await tx.userRole.create({
              data: { userId: id, roleId },
            });
          }
        }
      }
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'UPDATE',
        resourceType: 'user',
        resourceId: id,
        oldValues: { name: user.name, email: user.email, status: user.status },
        newValues: dto as any,
      },
    });

    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'DELETE',
        resourceType: 'user',
        resourceId: id,
      },
    });

    return { message: 'User deleted successfully' };
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!['ACTIVE', 'INACTIVE', 'LOCKED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: status as any },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'UPDATE',
        resourceType: 'user',
        resourceId: id,
        oldValues: { status: user.status },
        newValues: { status },
      },
    });

    return this.findOne(tenantId, id);
  }

  async resetPassword(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const hashedPassword = await argon2.hash(tempPassword);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'PASSWORD_CHANGE',
        resourceType: 'user',
        resourceId: id,
        newValues: { action: 'admin_reset' },
      },
    });

    return { temporaryPassword: tempPassword };
  }
}
