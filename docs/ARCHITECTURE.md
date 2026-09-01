# TechShop SaaS Platform — System Architecture

## Overview

Production-ready, multi-tenant SaaS platform for tech repair shops. Built with NestJS (backend) and Next.js (frontend), using PostgreSQL and Redis.

## Technology Stack

| Component | Technology | Version | License |
|-----------|-----------|---------|---------|
| Language | TypeScript | 5.x | Apache 2.0 |
| Backend | NestJS | 10.x | MIT |
| Frontend | Next.js | 14+ (App Router) | MIT |
| ORM | Prisma | 5.x | Apache 2.0 |
| Database | PostgreSQL | 15+ | PostgreSQL License |
| Cache/Queue | Redis + BullMQ | 7+ / 4.x | MIT |
| Auth | JWT (custom) | — | — |
| Styling | Tailwind CSS + shadcn/ui | 3.x / — | MIT |
| Charts | Recharts | 2.x | MIT |
| API Client | Axios + React Query | — | MIT |
| Validation | Zod | 3.x | MIT |
| PDF | Puppeteer / PDFKit | — | Apache 2.0 |
| Excel | ExcelJS | 4.x | MIT |
| Container | Docker | 24+ | Apache 2.0 |
| Reverse Proxy | Nginx | 1.25+ | BSD-2 |
| AI | MiMo API / Ollama / OpenAI-compat | — | — |

## Architecture Pattern

**Modular Monolith** with clean domain boundaries. Each business module (products, repairs, POS, etc.) is encapsulated in its own NestJS module with controllers, services, repositories, DTOs, and entities.

## Project Structure

```
techshop-saas/
├── apps/
│   ├── api/                          # NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/               # Shared utilities
│   │   │   │   ├── decorators/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   ├── filters/
│   │   │   │   ├── pipes/
│   │   │   │   ├── middleware/
│   │   │   │   └── dto/
│   │   │   ├── config/               # Configuration
│   │   │   ├── prisma/               # Prisma service
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── tenants/
│   │   │       ├── users/
│   │   │       ├── roles/
│   │   │       ├── products/
│   │   │       ├── categories/
│   │   │       ├── brands/
│   │   │       ├── inventory/
│   │   │       ├── customers/
│   │   │       ├── suppliers/
│   │   │       ├── purchases/
│   │   │       ├── sales/
│   │   │       ├── repairs/
│   │   │       ├── employees/
│   │   │       ├── schedules/
│   │   │       ├── expenses/
│   │   │       ├── reports/
│   │   │       ├── notifications/
│   │   │       ├── dashboard/
│   │   │       ├── ai/
│   │   │       ├── self-healing/
│   │   │       ├── health/
│   │   │       ├── backups/
│   │   │       └── audit/
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   │
│   └── web/                          # Next.js Frontend
│       ├── src/
│       │   ├── app/                  # App Router
│       │   │   ├── (auth)/
│       │   │   ├── (dashboard)/
│       │   │   ├── api/              # API routes (BFF)
│       │   │   └── layout.tsx
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui components
│       │   │   ├── layout/
│       │   │   ├── forms/
│       │   │   └── modules/          # Module-specific components
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── stores/
│       │   ├── types/
│       │   └── utils/
│       ├── public/
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/                         # Shared packages
│   ├── types/                        # Shared TypeScript types
│   ├── utils/                        # Shared utilities
│   └── validation/                   # Shared Zod schemas
│
├── docker/
│   ├── api/Dockerfile
│   ├── web/Dockerfile
│   └── nginx/
│       └── default.conf
├── docker-compose.yml
├── docker-compose.production.yml
├── .env.example
├── package.json                      # Monorepo root
├── turbo.json
└── README.md
```

## Layered Architecture (NestJS)

```
┌─────────────────────────────────────────────────┐
│               CONTROLLER LAYER                   │
│   Handles HTTP requests, validation, responses   │
│   @Controller, DTOs, Swagger decorators          │
├─────────────────────────────────────────────────┤
│                 GUARD LAYER                       │
│   Authentication, Authorization, Tenant           │
│   @UseGuards(AuthGuard, RolesGuard, TenantGuard) │
├─────────────────────────────────────────────────┤
│               INTERCEPTOR LAYER                   │
│   Logging, Audit, Transform, Cache               │
│   @UseInterceptors(AuditInterceptor, etc.)       │
├─────────────────────────────────────────────────┤
│                SERVICE LAYER                      │
│   Business logic, orchestration                   │
│   @Injectable, transaction management            │
├─────────────────────────────────────────────────┤
│               REPOSITORY LAYER                    │
│   Data access via Prisma                          │
│   @Injectable, query building                     │
├─────────────────────────────────────────────────┤
│              PRISMA / DATABASE                    │
│   PostgreSQL, migrations, seeders                 │
└─────────────────────────────────────────────────┘
```

## Module Structure

Each NestJS module follows this pattern:

```typescript
// products/products.module.ts
@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    AuditModule,
    InventoryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService],
})
export class ProductsModule {}
```

```
products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
├── products.repository.ts
├── dto/
│   ├── create-product.dto.ts
│   ├── update-product.dto.ts
│   └── query-product.dto.ts
├── entities/
│   └── product.entity.ts
├── products.controller.spec.ts
├── products.service.spec.ts
└── products.repository.spec.ts
```

## Cross-Cutting Concerns

| Concern | Implementation |
|---------|---------------|
| Multi-tenancy | TenantGuard + Prisma middleware (automatic tenant scoping) |
| Authentication | JWT access tokens + refresh tokens |
| Authorization | RolesGuard + Permission decorators |
| Audit | AuditInterceptor logs all write operations |
| Error tracking | ExceptionFilter → ErrorIntelligenceService |
| AI diagnosis | AIProviderInterface → MiMo / OpenAI / Ollama |
| Self-healing | SelfHealingService with policy engine |
| Notifications | NotificationService with in-app/email/webhook |
| Backups | BackupService with verification + retention |
| Health checks | HealthService with component probes |
| Rate limiting | @nestjs/throttler |
| Validation | Zod schemas + ValidationPipe |
| Logging | Winston + structured JSON logs |

## Request Lifecycle

```
HTTP Request
  → Nginx (rate limit, SSL, static assets)
    → NestJS Global Pipes (validation)
      → TenantGuard (resolve tenant from JWT/header)
        → AuthGuard (verify JWT)
          → RolesGuard (check permissions)
            → Controller (handle request)
              → Service (business logic)
                → Repository (Prisma queries)
              ← Service response
            ← Controller response (intercepted by AuditInterceptor)
          ← Guard response
        ← TenantGuard response
      ← AuthGuard response
    ← Global Pipes response
  ← Nginx response
```

## Tenant Isolation

### Prisma Middleware Approach

```typescript
// prisma/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements PrismaMiddleware {
  constructor(private readonly tenantService: TenantsService) {}

  async handle(params: Prisma.MiddlewareParams, next: Next) {
    const tenantId = this.tenantService.getCurrentTenant();
    
    // Automatically add tenantId to all queries on tenant-owned models
    if (this.isTenantModel(params.model)) {
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.args.where = { ...params.args.where, tenantId };
      } else if (params.action === 'findMany') {
        params.args.where = { ...params.args.where, tenantId };
      } else if (params.action === 'create') {
        params.args.data = { ...params.args.data, tenantId };
      } else if (['update', 'delete'].includes(params.action)) {
        params.args.where = { ...params.args.where, tenantId };
      }
    }
    
    return next(params);
  }
}
```

### Isolation Guarantees

1. **Middleware** — every Prisma query is automatically scoped
2. **Guard** — TenantGuard validates tenant on every request
3. **JWT** — tenant_id embedded in token
4. **Tests** — automated cross-tenant access tests
5. **Code review** — mandatory check for raw queries

## Error Handling

```
Exception thrown
  → ExceptionFilter catches
    → ErrorIntelligenceService captures context
      → Fingerprint generated
        → Error stored in DB
          → AI analysis queued (async)
            → User-friendly error response returned
              → Incident ID included in response
```

User sees:
```
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Unable to process request. The system has recorded this incident.",
    "incident_id": "INC-2026-000421"
  }
}
```

## Monorepo Structure

Using **Turborepo** for monorepo management:

```json
// turbo.json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"] },
    "dev": { "cache": false },
    "lint": {},
    "test": {},
    "db:generate": {},
    "db:migrate": {},
    "db:seed": {}
  }
}
```

## Key Design Decisions

1. **NestJS over Express/Fastify** — built-in DI, decorators, guards, interceptors, modular architecture. Enterprise-grade patterns out of the box.

2. **Next.js App Router** — file-based routing, server components, API routes for BFF pattern, excellent DX.

3. **Prisma over TypeORM/Knex** — type-safe queries, auto-generated types, excellent migrations, good DX.

4. **BullMQ over raw Redis** — reliable job queues with retries, delays, rate limiting, priorities.

5. **Zod over class-validator** — runtime validation with TypeScript inference, shareable between frontend and backend.

6. **Turborepo monorepo** — shared types/utils between frontend and backend, single source of truth.

7. **JWT over sessions** — stateless auth, easy API authentication, works across domains.

8. **AI as enhancement** — core business never depends on AI. Failures are logged and retried.
