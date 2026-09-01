import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private prisma: PrismaService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let code = 'INTERNAL_ERROR';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object') {
        const responseObj = exResponse as any;
        message = responseObj.message || message;
        code = responseObj.error || code;
        details = responseObj.details || responseObj.message;
      }
    }

    // Generate incident ID
    const incidentId = `INC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Log error
    this.logger.error(`${request.method} ${request.url} ${status}`, exception instanceof Error ? exception.stack : '');

    // Store error event
    try {
      await this.prisma.errorEvent.create({
        data: {
          tenantId: (request as any).user?.tenantId,
          fingerprint: this.generateFingerprint(exception),
          severity: this.getSeverity(status),
          status: 'NEW',
          errorClass: exception instanceof Error ? exception.constructor.name : 'Unknown',
          message: exception instanceof Error ? exception.message : message,
          stackTrace: exception instanceof Error ? exception.stack : '',
          file: null,
          line: null,
          function: null,
          route: request.route?.path || request.url,
          httpMethod: request.method,
          statusCode: status,
          userId: (request as any).user?.id,
          requestData: {
            body: request.body,
            query: request.query,
            params: request.params,
          },
          serverData: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          },
          environment: process.env.NODE_ENV || 'development',
          applicationVersion: process.env.APP_VERSION || '1.0.0',
        },
      });
    } catch (error) {
      this.logger.error('Failed to store error event', error);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message: status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'An unexpected error occurred. Incident recorded.'
          : message,
        details: status !== HttpStatus.INTERNAL_SERVER_ERROR ? details : undefined,
        incident_id: status === HttpStatus.INTERNAL_SERVER_ERROR ? incidentId : undefined,
      },
    });
  }

  private generateFingerprint(exception: unknown): string {
    const parts = [
      exception instanceof Error ? exception.constructor.name : 'Unknown',
      exception instanceof Error ? exception.message : '',
      exception instanceof Error ? exception.stack?.split('\n')[1] || '' : '',
    ];
    return Buffer.from(parts.join('|')).toString('base64').slice(0, 64);
  }

  private getSeverity(status: number): string {
    if (status >= 500) return 'HIGH';
    if (status >= 400) return 'MEDIUM';
    return 'LOW';
  }
}
