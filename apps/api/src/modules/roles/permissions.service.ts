import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });

    // Group by module
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.group]) {
        acc[perm.group] = [];
      }
      acc[perm.group].push(perm);
      return acc;
    }, {} as Record<string, typeof permissions>);

    return {
      permissions,
      grouped,
      groups: Object.keys(grouped),
    };
  }

  async findByGroup(group: string) {
    return this.prisma.permission.findMany({
      where: { group },
      orderBy: { name: 'asc' },
    });
  }
}
