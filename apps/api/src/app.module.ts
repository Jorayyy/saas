import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { SalesModule } from './modules/sales/sales.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RepairsModule } from './modules/repairs/repairs.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './modules/ai/ai.module';
import { SelfHealingModule } from './modules/self-healing/self-healing.module';
import { HealthModule } from './modules/health/health.module';
import { BackupsModule } from './modules/backups/backups.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),

    // Database
    PrismaModule,

    // Core modules
    AuthModule,
    TenantsModule,
    UsersModule,
    RolesModule,

    // Business modules
    ProductsModule,
    CategoriesModule,
    BrandsModule,
    InventoryModule,
    CustomersModule,
    SuppliersModule,
    PurchasesModule,
SalesModule,
PaymentsModule,
RepairsModule,
    EmployeesModule,
    ExpensesModule,
    ReportsModule,
    NotificationsModule,
    DashboardModule,

    // System modules
    AiModule,
    SelfHealingModule,
    HealthModule,
    BackupsModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
