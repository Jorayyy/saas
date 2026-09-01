import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const AUDIT_ACTIONS = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
} as const;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, user, body, params, originalUrl } = request;

    // Only audit write operations
    if (!AUDIT_ACTIONS[method]) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const action = AUDIT_ACTIONS[method];
          const resourceType = this.extractResourceType(originalUrl);
          const resourceId = params?.id || response?.data?.id || null;

          await this.prisma.auditLog.create({
            data: {
              tenantId: user?.tenantId,
              userId: user?.id,
              action: action as any,
              resourceType,
              resourceId,
              oldValues: method === 'PUT' || method === 'DELETE' ? body : undefined,
              newValues: method === 'POST' || method === 'PUT' ? response?.data || body : undefined,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              requestId: request.id,
            },
          });
        } catch (error) {
          // Don't let audit logging break the request
          console.error('Audit logging failed:', error);
        }
      }),
    );
  }

  private extractResourceType(url: string): string {
    // Extract resource type from URL like /api/v1/products/123
    const parts = url.split('/').filter(Boolean);
    // Skip 'api', 'v1' prefix
    const resourceIndex = parts.findIndex(p => p !== 'api' && p !== 'v1');
    return parts[resourceIndex] || 'unknown';
  }
}
