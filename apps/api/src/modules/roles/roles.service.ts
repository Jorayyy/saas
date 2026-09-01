import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateRoleDto {
  name: string;
  displayName: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  displayName?: string;
  description?: string;
  permissionIds?: string[];
}

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return roles.map(role => ({
      ...role,
      permissions: role.permissions.map(rp => rp.permission),
      userCount: role._count.users,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        permissions: {
          include: { permission: true },
        },
        users: {
          select: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      ...role,
      permissions: role.permissions.map(rp => rp.permission),
      users: role.users.map(ur => ur.user),
    };
  }

  async create(tenantId: string, dto: CreateRoleDto) {
    // Check name uniqueness
    const existing = await this.prisma.role.findFirst({
      where: { tenantId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Role name already exists');
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          tenantId,
          name: dto.name,
          displayName: dto.displayName,
          description: dto.description,
        },
      });

      // Assign permissions
      if (dto.permissionIds && dto.permissionIds.length > 0) {
        for (const permissionId of dto.permissionIds) {
          const perm = await tx.permission.findUnique({ where: { id: permissionId } });
          if (perm) {
            await tx.rolePermission.create({
              data: { roleId: newRole.id, permissionId },
            });
          }
        }
      }

      return newRole;
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'CREATE',
        resourceType: 'role',
        resourceId: role.id,
        newValues: dto as any,
      },
    });

    return this.findOne(tenantId, role.id);
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new BadRequestException('Cannot rename system roles');
    }

    // Check name uniqueness if changed
    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findFirst({
        where: { tenantId, name: dto.name, id: { not: id } },
      });

      if (existing) {
        throw new ConflictException('Role name already exists');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Update role
      await tx.role.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.displayName && { displayName: dto.displayName }),
          ...(dto.description !== undefined && { description: dto.description }),
        },
      });

      // Update permissions if provided
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        for (const permissionId of dto.permissionIds) {
          const perm = await tx.permission.findUnique({ where: { id: permissionId } });
          if (perm) {
            await tx.rolePermission.create({
              data: { roleId: id, permissionId },
            });
          }
        }
      }
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'UPDATE',
        resourceType: 'role',
        resourceId: id,
        newValues: dto as any,
      },
    });

    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: { users: true },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }

    if (role.users.length > 0) {
      throw new BadRequestException('Cannot delete role with assigned users');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'DELETE',
        resourceType: 'role',
        resourceId: id,
      },
    });

    return { message: 'Role deleted successfully' };
  }

  async syncPermissions(tenantId: string, id: string, permissionIds: string[]) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });

      for (const permissionId of permissionIds) {
        const perm = await tx.permission.findUnique({ where: { id: permissionId } });
        if (perm) {
          await tx.rolePermission.create({
            data: { roleId: id, permissionId },
          });
        }
      }
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'PERMISSION_CHANGE',
        resourceType: 'role',
        resourceId: id,
        newValues: { permissionIds },
      },
    });

    return this.findOne(tenantId, id);
  }
}
