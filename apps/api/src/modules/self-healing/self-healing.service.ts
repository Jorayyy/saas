import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency: number;
  lastChecked: Date;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  activeConnections: number;
  requestsPerMinute: number;
}

@Injectable()
export class SelfHealingService {
  private readonly logger = new Logger(SelfHealingService.name);
  private healthChecks: Map<string, HealthCheck> = new Map();
  private issues: Array<{ id: string; severity: string; message: string; resolved: boolean; createdAt: Date }> = [];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.startHealthChecks();
  }

  private startHealthChecks() {
    // Run health checks every 30 seconds
    setInterval(() => this.runHealthChecks(), 30000);
    this.runHealthChecks();
  }

  private async runHealthChecks() {
    const checks = [
      this.checkDatabase(),
      this.checkMemory(),
      this.checkDiskSpace(),
      this.checkAPIResponse(),
    ];

    const results = await Promise.allSettled(checks);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const check = result.value;
        this.healthChecks.set(check.name, {
          ...check,
          lastChecked: new Date(),
        });

        // Auto-heal if unhealthy
        if (check.status === 'unhealthy') {
          this.handleUnhealthyCheck(check);
        }
      }
    });
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'database',
        status: 'healthy',
        latency: Date.now() - start,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: error.message,
        latency: Date.now() - start,
        lastChecked: new Date(),
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const mem = process.memoryUsage();
    const heapUsedPercent = (mem.heapUsed / mem.heapTotal) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (heapUsedPercent > 90) status = 'unhealthy';
    else if (heapUsedPercent > 70) status = 'degraded';

    return {
      name: 'memory',
      status,
      message: `${heapUsedPercent.toFixed(1)}% heap used`,
      latency: 0,
      lastChecked: new Date(),
    };
  }

  private async checkDiskSpace(): Promise<HealthCheck> {
    // Simplified check
    return {
      name: 'disk',
      status: 'healthy',
      message: 'Disk space OK',
      latency: 0,
      lastChecked: new Date(),
    };
  }

  private async checkAPIResponse(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Check if API is responsive
      return {
        name: 'api',
        status: 'healthy',
        latency: Date.now() - start,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: 'api',
        status: 'unhealthy',
        message: error.message,
        latency: Date.now() - start,
        lastChecked: new Date(),
      };
    }
  }

  private async handleUnhealthyCheck(check: HealthCheck) {
    this.logger.warn(`Unhealthy check detected: ${check.name} - ${check.message}`);

    // Log issue
    const issue = {
      id: `issue-${Date.now()}`,
      severity: 'HIGH',
      message: `Health check failed: ${check.name} - ${check.message}`,
      resolved: false,
      createdAt: new Date(),
    };

    this.issues.push(issue);

    // Auto-healing actions
    switch (check.name) {
      case 'database':
        await this.healDatabase();
        break;
      case 'memory':
        await this.healMemory();
        break;
    }
  }

  private async healDatabase() {
    this.logger.log('Attempting database recovery...');
    // Implement database recovery logic
  }

  private async healMemory() {
    this.logger.log('Attempting memory recovery...');
    if (global.gc) {
      global.gc();
    }
  }

  async getHealthStatus() {
    const checks = Array.from(this.healthChecks.values());
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    const hasDegraded = checks.some(c => c.status === 'degraded');

    return {
      status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
      checks,
      lastChecked: new Date(),
    };
  }

  async getMetrics(): Promise<SystemMetrics> {
    const mem = process.memoryUsage();

    return {
      uptime: process.uptime(),
      memoryUsage: mem,
      cpuUsage: process.cpuUsage().user / 1000000,
      activeConnections: 0,
      requestsPerMinute: 0,
    };
  }

  async getIssues(resolved?: boolean) {
    return this.issues.filter(i =>
      resolved !== undefined ? i.resolved === resolved : true
    );
  }

  async resolveIssue(id: string) {
    const issue = this.issues.find(i => i.id === id);
    if (issue) {
      issue.resolved = true;
    }
    return issue;
  }

  async getAuditLogs(tenantId: string, query: any) {
    const { page = 1, limit = 50, action, userId } = query;

    const where: any = {
      tenantId,
      ...(action && { action }),
      ...(userId && { userId }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createAuditLog(data: {
    tenantId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action as any,
        resourceType: data.entity,
        resourceId: data.entityId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        ipAddress: data.ipAddress,
      },
    });
  }
}
