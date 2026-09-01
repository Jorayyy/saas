import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private currentTenantId: string | null = null;
  private currentUserId: string | null = null;

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  setTenant(tenantId: string | null) {
    this.currentTenantId = tenantId;
  }

  getTenant(): string | null {
    return this.currentTenantId;
  }

  setUser(userId: string | null) {
    this.currentUserId = userId;
  }

  getUser(): string | null {
    return this.currentUserId;
  }

  /**
   * Execute a raw query with tenant scoping
   */
  async rawWithTenant<T>(query: string, ...values: any[]): Promise<T> {
    return this.$queryRawUnsafe(query, ...values);
  }

  /**
   * Run a callback within a database transaction
   */
  async transaction<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(callback);
  }
}
