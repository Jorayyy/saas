import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  uptime: number;
  components: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs?: number;
  details?: Record<string, any>;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const components: Record<string, ComponentHealth> = {};

    // Check database
    components.database = await this.checkDatabase();

    // Check memory
    components.memory = this.checkMemory();

    // Check disk
    components.disk = this.checkDisk();

    // Determine overall status
    const statuses = Object.values(components).map(c => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

    if (statuses.includes('down')) {
      overallStatus = 'down';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      components,
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        responseTimeMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'down',
        responseTimeMs: Date.now() - start,
        details: { error: error.message },
      };
    }
  }

  private checkMemory(): ComponentHealth {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssUsedMB = Math.round(memUsage.rss / 1024 / 1024);

    const usagePercent = (heapUsedMB / heapTotalMB) * 100;
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';

    if (usagePercent > 90) {
      status = 'down';
    } else if (usagePercent > 75) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        heapUsedMB,
        heapTotalMB,
        rssUsedMB,
        usagePercent: Math.round(usagePercent),
      },
    };
  }

  private checkDisk(): ComponentHealth {
    // Basic disk check - in production, use a proper disk monitoring library
    return {
      status: 'healthy',
      details: {
        platform: process.platform,
        arch: process.arch,
      },
    };
  }

  async isReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  isLive(): boolean {
    return true;
  }
}
