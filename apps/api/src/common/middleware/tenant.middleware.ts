import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extract tenant from JWT token (set by AuthGuard)
    const tenantId = (req as any).tenantId || null;
    const userId = (req as any).userId || null;

    this.prisma.setTenant(tenantId);
    this.prisma.setUser(userId);

    next();
  }
}
