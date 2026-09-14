import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Tenant scoping is handled by @CurrentUser('tenantId') decorator
    // which reads from req.user.tenantId (set by JwtStrategy).
    // Services receive tenantId as an explicit parameter.
    next();
  }
}
