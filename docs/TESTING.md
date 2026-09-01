# TechShop SaaS Platform — Testing Strategy

## Stack

| Tool | Purpose |
|------|---------|
| Jest | Unit & integration tests (API) |
| Vitest | Unit tests (frontend) |
| Supertest | HTTP endpoint testing |
| Prisma testing utils | Database test helpers |
| Playwright | E2E tests |

## Testing Pyramid

```
         ┌─────────┐
         │   E2E   │  Few (critical flows)
        ─┴─────────┴─
       │ Integration │  Moderate (API, DB)
      ─┴─────────────┴─
     │    Unit Tests     │  Most (Services, Utils)
    ─┴───────────────────┴─
```

## Critical Test Scenarios

### 1. Tenant Isolation (MUST PASS)

```typescript
// test/architecture/tenant-isolation.spec.ts
describe('Tenant Isolation', () => {
  it('user cannot access other tenant data', async () => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    
    const userA = await createUser(tenantA.id);
    const productA = await createProduct(tenantA.id);
    const productB = await createProduct(tenantB.id);
    
    const token = await loginAs(userA);
    
    const response = await request(app.getHttpServer())
      .get(`/api/v1/products/${productB.id}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(404);
  });
  
  it('list queries only return own tenant data', async () => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    
    await createProduct(tenantA.id);
    await createProduct(tenantA.id);
    await createProduct(tenantB.id);
    
    const userA = await createUser(tenantA.id);
    const token = await loginAs(userA);
    
    const response = await request(app.getHttpServer())
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.body.data).toHaveLength(2);
  });
  
  it('create operations scope to current tenant', async () => {
    const tenantA = await createTenant();
    const userA = await createUser(tenantA.id);
    const token = await loginAs(userA);
    
    const response = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Product', sku: 'TEST-001', sellingPrice: 100 });
    
    expect(response.status).toBe(201);
    
    const product = await prisma.product.findUnique({ where: { id: response.body.data.id } });
    expect(product.tenantId).toBe(tenantA.id);
  });
});
```

### 2. Authorization (MUST PASS)

```typescript
// test/architecture/authorization.spec.ts
describe('Authorization', () => {
  it('unauthenticated user gets 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products');
    
    expect(response.status).toBe(401);
  });
  
  it('cashier cannot access admin endpoints', async () => {
    const user = await createUserWithRole('cashier');
    const token = await loginAs(user);
    
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
  });
  
  it('technician cannot access financial data', async () => {
    const user = await createUserWithRole('technician');
    const token = await loginAs(user);
    
    const response = await request(app.getHttpServer())
      .get('/api/v1/reports/sales')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
  });
});
```

### 3. Inventory Integrity (MUST PASS)

```typescript
// test/features/inventory/integrity.spec.ts
describe('Inventory Integrity', () => {
  it('stock never becomes negative', async () => {
    const product = await createProduct({ currentStock: 5 });
    
    const response = await request(app.getHttpServer())
      .post(`/api/v1/sales`)
      .send({
        items: [{ productId: product.id, quantity: 10 }],
        payments: [{ method: 'CASH', amount: 1000 }],
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
  });
  
  it('every stock change creates movement', async () => {
    const product = await createProduct({ currentStock: 100 });
    const user = await createUser();
    const token = await loginAs(user);
    
    await request(app.getHttpServer())
      .post('/api/v1/inventory/adjust')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        adjustmentType: 'DECREASE',
        quantity: 5,
        reason: 'Test adjustment',
      });
    
    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id },
      orderBy: { createdAt: 'desc' },
    });
    
    expect(movement).toBeDefined();
    expect(movement.quantityBefore).toBe(100);
    expect(movement.quantityChange).toBe(-5);
    expect(movement.quantityAfter).toBe(95);
    
    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProduct.currentStock).toBe(95);
  });
  
  it('concurrent stock deductions are safe', async () => {
    const product = await createProduct({ currentStock: 10 });
    
    // Simulate 10 concurrent deductions
    const promises = Array(10).fill(null).map(async () => {
      const sale = await createSale(product.id, 1);
      return sale;
    });
    
    await Promise.all(promises);
    
    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updated.currentStock).toBe(0);
    
    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: product.id },
    });
    expect(movements).toHaveLength(10);
  });
});
```

### 4. Financial Atomicity (MUST PASS)

```typescript
// test/features/sales/atomicity.spec.ts
describe('Sales Atomicity', () => {
  it('sale creates all records atomically', async () => {
    const product = await createProduct({ currentStock: 20, sellingPrice: 100 });
    const customer = await createCustomer();
    const user = await createUser();
    const token = await loginAs(user);
    
    const response = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        items: [{ productId: product.id, quantity: 2 }],
        payments: [{ method: 'CASH', amount: 224 }],
      });
    
    expect(response.status).toBe(201);
    
    const sale = response.body.data;
    expect(sale.items).toHaveLength(2);
    expect(sale.payments).toHaveLength(1);
    
    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProduct.currentStock).toBe(18);
    
    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id },
    });
    expect(movement).toBeDefined();
    expect(movement.quantityChange).toBe(-2);
    
    const auditLog = await prisma.auditLog.findFirst({
      where: { resourceType: 'sale', resourceId: sale.id },
    });
    expect(auditLog).toBeDefined();
  });
  
  it('failed sale rolls back everything', async () => {
    const product = await createProduct({ currentStock: 20 });
    const initialStock = product.currentStock;
    
    try {
      await salesService.createSale({
        items: [{ productId: product.id, quantity: 2 }],
        payments: [{ method: 'CASH', amount: 200 }],
        tenantId: product.tenantId,
        userId: 'test-user',
        failPayment: true, // Simulate failure
      });
    } catch (e) {
      // Expected
    }
    
    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updated.currentStock).toBe(initialStock);
    
    const sales = await prisma.sale.findMany({ where: { tenantId: product.tenantId } });
    expect(sales).toHaveLength(0);
  });
});
```

### 5. AI Failure Handling (MUST PASS)

```typescript
// test/architecture/ai-failure.spec.ts
describe('AI Failure Handling', () => {
  it('application works when AI is down', async () => {
    // Mock AI provider to fail
    jest.spyOn(aiService, 'isHealthy').mockReturnValue(false);
    jest.spyOn(aiService, 'analyze').mockRejectedValue(new Error('AI unavailable'));
    
    const user = await createUser();
    const token = await loginAs(user);
    
    const response = await request(app.getHttpServer())
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });
  
  it('error stored when AI analysis pending', async () => {
    jest.spyOn(aiService, 'isHealthy').mockReturnValue(false);
    
    try {
      throw new Error('Test error');
    } catch (e) {
      await errorIntelligence.capture(e);
    }
    
    const error = await prisma.errorEvent.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    
    expect(error).toBeDefined();
    expect(error.aiAnalysis).toBeNull();
    expect(error.aiStatus).toBe('AI_ANALYSIS_PENDING');
  });
});
```

### 6. Self-Healing Safety (MUST PASS)

```typescript
// test/architecture/self-healing-safety.spec.ts
describe('Self-Healing Safety', () => {
  it('dangerous actions never auto-execute', async () => {
    const dangerousActions = [
      'delete_production_data',
      'modify_financial_records',
      'change_permissions',
      'disable_authentication',
    ];
    
    for (const action of dangerousActions) {
      const result = await selfHealingService.executeAction(action);
      expect(result).toBeNull();
    }
  });
  
  it('all actions are logged', async () => {
    await selfHealingService.execute({
      type: 'clear_cache',
      riskLevel: 'SAFE',
      reason: 'Test',
    });
    
    const log = await prisma.selfHealingAction.findFirst({
      where: { actionType: 'clear_cache' },
    });
    
    expect(log).toBeDefined();
    expect(log.riskLevel).toBe('SAFE');
    expect(log.executedBy).toBe('AI');
  });
});
```

## Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific test type
npm run test:unit
npm run test:integration
npm run test:e2e

# Run specific file
npm test -- --testPathPattern=tenant-isolation

# Watch mode
npm run test:watch

# CI/CD
npm run test:cov -- --ci --forceExit --detectOpenHandles
```

## CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: techshop_test
          POSTGRES_USER: techshop
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        ports: ['6379:6379']
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - run: cp .env.testing .env
      
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://techshop:test@localhost:5432/techshop_test
      
      - run: npm run test:cov -- --ci --forceExit
        env:
          DATABASE_URL: postgresql://techshop:test@localhost:5432/techshop_test
          REDIS_URL: redis://localhost:6379
      
      - run: npm run lint
      - run: npx tsc --noEmit
```
