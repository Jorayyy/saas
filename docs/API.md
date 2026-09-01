# TechShop SaaS Platform — API Architecture

## Base URL

```
/api/v1
```

## Authentication

Bearer token (JWT) required for all endpoints except login/register.

```
Authorization: Bearer {accessToken}
```

Refresh tokens stored in HTTP-only cookies.

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The given data was invalid.",
    "details": [
      { "field": "email", "message": "Email already in use" }
    ]
  },
  "incident_id": "INC-2026-000421"
}
```

## Rate Limits

| Endpoint Group | Rate | Window |
|---------------|------|--------|
| Login | 5 | 1 minute |
| Password Reset | 3 | 1 minute |
| General API | 60 | 1 minute |
| POS Operations | 120 | 1 minute |
| Report Generation | 10 | 1 minute |

## API Endpoints

### Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /auth/register | Create tenant + admin | No |
| POST | /auth/login | Login | No |
| POST | /auth/refresh | Refresh token | No |
| POST | /auth/logout | Logout | Yes |
| GET | /auth/me | Get current user | Yes |
| PUT | /auth/profile | Update profile | Yes |
| PUT | /auth/password | Change password | Yes |
| POST | /auth/forgot-password | Request reset | No |
| POST | /auth/reset-password | Reset password | No |

### Users

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /users | List users | users.view |
| POST | /users | Create user | users.create |
| GET | /users/:id | Get user | users.view |
| PUT | /users/:id | Update user | users.update |
| DELETE | /users/:id | Delete user | users.delete |
| PUT | /users/:id/status | Change status | users.manage |

### Roles & Permissions

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /roles | List roles | roles.view |
| POST | /roles | Create role | roles.create |
| PUT | /roles/:id | Update role | roles.update |
| DELETE | /roles/:id | Delete role | roles.delete |
| GET | /roles/:id/permissions | Get role permissions | roles.view |
| PUT | /roles/:id/permissions | Sync permissions | roles.manage |
| GET | /permissions | List all permissions | roles.view |

### Products

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /products | List (paginated, filterable, searchable) | products.view |
| POST | /products | Create product | products.create |
| GET | /products/:id | Get product | products.view |
| PUT | /products/:id | Update product | products.update |
| DELETE | /products/:id | Delete product | products.delete |
| GET | /products/:id/movements | Inventory history | products.view |
| POST | /products/:id/adjust | Adjust stock | inventory.adjust |
| POST | /products/import | Bulk import CSV | products.create |
| GET | /products/export | Export CSV | products.view |
| GET | /products/barcode/:barcode | Lookup by barcode | products.view |
| GET | /products/low-stock | Low stock alerts | products.view |

### Categories

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /categories | List categories | products.view |
| POST | /categories | Create | products.create |
| PUT | /categories/:id | Update | products.update |
| DELETE | /categories/:id | Delete | products.delete |

### Brands

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /brands | List brands | products.view |
| POST | /brands | Create | products.create |
| PUT | /brands/:id | Update | products.update |
| DELETE | /brands/:id | Delete | products.delete |

### Inventory

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /inventory | Overview | inventory.view |
| GET | /inventory/movements | All movements | inventory.view |
| POST | /inventory/adjust | Manual adjustment | inventory.adjust |
| POST | /inventory/transfer | Create transfer | inventory.transfer |
| GET | /inventory/transfers | List transfers | inventory.view |
| GET | /inventory/transfers/:id | Get transfer | inventory.view |
| PUT | /inventory/transfers/:id/receive | Receive transfer | inventory.transfer |
| PUT | /inventory/transfers/:id/cancel | Cancel transfer | inventory.transfer |

### Customers

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /customers | List (paginated, searchable) | customers.view |
| POST | /customers | Create | customers.create |
| GET | /customers/:id | Get customer | customers.view |
| PUT | /customers/:id | Update | customers.update |
| DELETE | /customers/:id | Delete | customers.delete |
| GET | /customers/:id/purchases | Purchase history | customers.view |
| GET | /customers/:id/repairs | Repair history | customers.view |
| GET | /customers/:id/devices | Devices | customers.view |
| POST | /customers/:id/devices | Add device | customers.create |
| GET | /customers/search | Search | customers.view |

### Suppliers

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /suppliers | List | suppliers.view |
| POST | /suppliers | Create | suppliers.create |
| GET | /suppliers/:id | Get | suppliers.view |
| PUT | /suppliers/:id | Update | suppliers.update |
| DELETE | /suppliers/:id | Delete | suppliers.delete |
| GET | /suppliers/:id/orders | Purchase orders | suppliers.view |
| GET | /suppliers/:id/payments | Payment history | suppliers.view |

### Purchase Orders

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /purchase-orders | List | purchases.view |
| POST | /purchase-orders | Create | purchases.create |
| GET | /purchase-orders/:id | Get | purchases.view |
| PUT | /purchase-orders/:id | Update | purchases.update |
| PUT | /purchase-orders/:id/submit | Submit | purchases.update |
| PUT | /purchase-orders/:id/receive | Receive items | purchases.receive |
| PUT | /purchase-orders/:id/cancel | Cancel | purchases.update |

### Sales / POS

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /sales | List | sales.view |
| POST | /sales | Create sale | sales.create |
| GET | /sales/:id | Get sale | sales.view |
| GET | /sales/:id/receipt | Generate receipt | sales.view |
| POST | /sales/:id/void | Void sale | sales.void |
| POST | /sales/:id/refund | Process refund | sales.refund |
| GET | /sales/today | Today summary | sales.view |
| GET | /sales/stats | Sales statistics | sales.view |

### Repairs

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /repairs | List tickets | repairs.view |
| POST | /repairs | Create ticket | repairs.create |
| GET | /repairs/:id | Get ticket | repairs.view |
| PUT | /repairs/:id | Update repair | repairs.update |
| PUT | /repairs/:id/assign | Assign technician | repairs.assign |
| PUT | /repairs/:id/diagnose | Submit diagnosis | repairs.update |
| PUT | /repairs/:id/quote | Submit estimate | repairs.update |
| PUT | /repairs/:id/status | Update status | repairs.update |
| PUT | /repairs/:id/complete | Mark completed | repairs.update |
| PUT | /repairs/:id/pickup | Process pickup | repairs.update |
| GET | /repairs/:id/timeline | Get timeline | repairs.view |
| POST | /repairs/:id/notes | Add note | repairs.update |
| GET | /repairs/my-assigned | My assigned | repairs.view |
| GET | /repairs/overdue | Overdue list | repairs.view |
| GET | /repairs/stats | Statistics | repairs.view |

### Employees

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /employees | List | employees.view |
| POST | /employees | Create | employees.create |
| GET | /employees/:id | Get | employees.view |
| PUT | /employees/:id | Update | employees.update |
| DELETE | /employees/:id | Delete | employees.delete |
| GET | /employees/:id/schedule | Get schedule | employees.view |
| POST | /employees/:id/schedule | Create shift | employees.manage |
| PUT | /employees/:id/attendance | Clock in/out | employees.manage |
| GET | /employees/schedule/week | Weekly view | employees.view |

### Expenses

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /expenses | List | expenses.view |
| POST | /expenses | Create | expenses.create |
| GET | /expenses/:id | Get | expenses.view |
| PUT | /expenses/:id | Update | expenses.update |
| DELETE | /expenses/:id | Delete | expenses.delete |
| PUT | /expenses/:id/approve | Approve | expenses.approve |

### Reports

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /reports/sales | Sales report | reports.view |
| GET | /reports/profit | Profit report | reports.view |
| GET | /reports/inventory | Inventory report | reports.view |
| GET | /reports/repairs | Repair report | reports.view |
| GET | /reports/technicians | Technician performance | reports.view |
| GET | /reports/customers | Customer report | reports.view |
| GET | /reports/expenses | Expense report | reports.view |
| GET | /reports/tax | Tax report | reports.view |
| GET | /reports/export/:type | Export (pdf/csv/excel) | reports.export |

### Notifications

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /notifications | List | (own) |
| PUT | /notifications/:id/read | Mark read | (own) |
| PUT | /notifications/read-all | Mark all read | (own) |
| GET | /notifications/unread-count | Count | (own) |
| GET | /notifications/preferences | Get prefs | (own) |
| PUT | /notifications/preferences | Update prefs | (own) |

### Dashboard

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /dashboard/summary | Summary data | dashboard.view |
| GET | /dashboard/sales-chart | Sales chart | dashboard.view |
| GET | /dashboard/repairs-status | Repair breakdown | dashboard.view |
| GET | /dashboard/top-products | Top products | dashboard.view |
| GET | /dashboard/top-technicians | Top techs | dashboard.view |
| GET | /dashboard/recent | Recent transactions | dashboard.view |

### System (Admin)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /system/health | Health status | system.view |
| GET | /system/health/detailed | Component health | system.view |
| GET | /system/errors | Error list | system.view |
| GET | /system/errors/:id | Error detail | system.view |
| PUT | /system/errors/:id/status | Update status | system.manage |
| GET | /system/errors/stats | Error stats | system.view |
| GET | /system/audit-logs | Audit logs | audit.view |
| GET | /system/backups | Backup history | system.view |
| POST | /system/backups/create | Trigger backup | system.manage |
| GET | /system/self-healing/actions | Action log | system.view |
| GET | /system/ai/status | AI provider status | system.view |
| GET | /system/ai/analyze/:errorId | Request AI analysis | system.manage |

## Query Parameters

| Parameter | Example | Description |
|-----------|---------|-------------|
| page | ?page=2 | Page number |
| limit | ?limit=50 | Items per page |
| search | ?search=laptop | Full-text search |
| sort | ?sort=createdAt | Sort field |
| order | ?order=desc | Sort direction |
| status | ?status=active | Filter by status |
| from | ?from=2026-01-01 | Date range start |
| to | ?to=2026-01-31 | Date range end |
| categoryId | ?categoryId=xxx | Filter by category |
| branchId | ?branchId=xxx | Filter by branch |

## Webhooks

Configure webhooks for events:

```
POST {webhook_url}
Headers:
  X-Webhook-Event: sale.completed
  X-Webhook-Signature: sha256={hmac}
  X-Webhook-Timestamp: {unix}

Body:
{
  "event": "sale.completed",
  "tenantId": "...",
  "data": { ... },
  "timestamp": "2026-01-15T10:30:00Z"
}
```

Events: `sale.completed`, `sale.refunded`, `repair.completed`, `repair.overdue`, `low.stock.detected`, `backup.failed`
