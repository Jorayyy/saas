# TechShop SaaS Platform — Security Architecture

## Security Principles

1. **Defense in depth** — multiple layers of protection
2. **Least privilege** — users get minimum necessary permissions
3. **Zero trust** — every request is authenticated and authorized
4. **Secure by default** — unsafe operations require explicit opt-in
5. **No secrets in code** — all credentials via environment variables
6. **Audit everything** — every sensitive action is logged
7. **Fail securely** — errors never expose internal state

## Authentication

### Password Storage

- **Algorithm**: Argon2id (via `Hash::make()`)
- **Config**: MEMORY_COST=65536, TIME_COST=4, THREADS=3
- **Never**: MD5, SHA1, SHA256 for passwords

### Session Management

- HTTP-only, Secure, SameSite=Lax cookies
- Session timeout: 24 hours (web), 60 days (remember me)
- Session fixation prevention via regeneration on login
- Session invalidation on password change
- Maximum concurrent sessions configurable per tenant

### Token Authentication (API)

- Laravel Sanctum personal access tokens
- Tokens scoped to specific abilities
- Token expiration configurable
- Token revocation on user deletion or role change

### Brute Force Protection

- Login: 5 attempts per minute per email
- Password reset: 3 requests per minute per email
- Account lockout: 5 failed attempts → 15 minute lock
- Progressive delays after repeated failures

### Two-Factor Authentication

- TOTP-based (Google Authenticator compatible)
- Recovery codes (10 single-use codes)
- 2FA enforced per-role (configurable)
- Backup verification before enabling

## Password Policy

| Rule | Value |
|------|-------|
| Minimum length | 8 characters |
| Require uppercase | Yes |
| Require lowercase | Yes |
| Require number | Yes |
| Require special character | Yes |
| Password history | Last 5 passwords cannot be reused |
| Maximum age | Configurable (default: 90 days) |

## Authorization (RBAC)

### Permission Model

```
Role → Permission mapping (many-to-many)
User → Role mapping (many-to-many)
User effective permissions = UNION of all role permissions
```

### Authorization Layers

1. **Route middleware** — `role:admin,manager` checks
2. **Controller policy** — `$this->authorize('update', $product)`
3. **Service layer** — explicit permission checks before operations
4. **Query scope** — automatic tenant scoping
5. **API middleware** — Sanctum ability checks

### Never Trust Client-Side

- Hidden buttons are NOT authorization
- Every API endpoint checks permissions server-side
- Financial operations require specific roles
- Destructive operations require elevated permissions

## CSRF Protection

- Laravel CSRF token on all web forms
- Sanctum SPA authentication for API calls from same domain
- CSRF token rotation on login
- SameSite cookie attribute

## XSS Protection

- `{{ }}` auto-escaping in Blade templates
- `@js()` directive for JavaScript data (JSON encoding)
- Content-Security-Policy headers
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Input sanitization on all user inputs
- Output encoding in API responses

## SQL Injection Prevention

- Eloquent ORM parameterized queries (automatic)
- Query builder parameterized queries (automatic)
- Raw queries MUST use parameter binding
- Never concatenate user input into SQL
- Database user has minimum required privileges

## Rate Limiting

```php
// routes/api.php
Route::middleware('throttle:60,1')->group(function () {
    Route::apiResource('products', ProductController::class);
});

Route::middleware('throttle:login')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);
});
```

| Endpoint | Limit |
|----------|-------|
| Login | 5/min |
| Password reset | 3/min |
| General API | 60/min |
| POS checkout | 30/min |
| File upload | 20/min |
| Report export | 10/min |
| AI analysis | 5/min |

## Secure Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## File Upload Security

1. **MIME validation** — check actual file content, not just extension
2. **Size limits** — configurable per tenant (default: 10MB)
3. **Allowed types** — whitelist: jpg, jpeg, png, gif, pdf, csv, xlsx
4. **Rename files** — random filenames, never use user-provided names
5. **Separate storage** — uploaded files outside web root
6. **Scan for malware** — configurable integration
7. **Virus scanning** — optional ClamAV integration
8. **Image processing** — strip EXIF data, resize if needed

## Secrets Management

### Environment Variables

All secrets stored in `.env` (never in code):

```
APP_KEY=base64:...
DB_PASSWORD=...
REDIS_PASSWORD=...
MAIL_PASSWORD=...
AI_API_KEY=...
ENCRYPTION_KEY=...
BACKUP_ENCRYPTION_KEY=...
```

### Encrypted Fields

Sensitive model fields encrypted at rest:

- `users.two_factor_secret`
- API keys in settings
- Webhook secrets

### Secrets Rotation

- Database passwords: rotate quarterly
- API keys: rotate annually
- APP_KEY: never rotate unless compromised
- Backup encryption keys: rotate annually

## Tenant Data Isolation

### Enforcement Points

1. **Middleware** — TenantResolver sets current tenant
2. **Eloquent scopes** — Global scope on every tenant model
3. **Database constraints** — FK to tenant_id
4. **Query builder** — Explicit tenant scoping in raw queries
5. **Code review** — Mandatory review for new queries
6. **Tests** — Automated cross-tenant access tests

### Isolation Guarantees

- User A (tenant 1) can NEVER access User B (tenant 2) data
- API responses NEVER include data from other tenants
- Search NEVER returns results from other tenants
- Reports NEVER include other tenant data
- Error events NEVER leak tenant data to other tenants

## Input Validation

### Server-Side Validation

```php
// Form Request classes for every endpoint
class StoreProductRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'sku' => 'required|string|max:50|unique:products,sku,' . $this->tenant_id . ',tenant_id',
            'selling_price' => 'required|numeric|min:0',
            'purchase_cost' => 'required|numeric|min:0',
        ];
    }
}
```

### Sanitization

- Strip HTML tags from text inputs
- Trim whitespace
- Normalize Unicode
- Validate email format
- Validate phone format
- Validate numeric ranges

## API Security

### Authentication

- Bearer token required on all endpoints (except public)
- Token validated on every request
- Token revocation checked

### Authorization

- Permission checked on every endpoint
- Role-based access enforced
- Resource ownership verified

### Data Protection

- API responses filtered per user permissions
- Sensitive fields excluded from responses
- Passwords never returned in API responses
- API keys never logged

### Transport Security

- HTTPS required in production
- HSTS header enabled
- TLS 1.2+ only
- Strong cipher suites

## Audit Logging

### Logged Actions

| Action | Details |
|--------|---------|
| LOGIN | User, IP, user agent, success/failure |
| LOGOUT | User, session duration |
| CREATE | Resource type, data |
| UPDATE | Resource type, before/after values |
| DELETE | Resource type, data |
| REFUND | Sale ID, amount, reason |
| VOID | Sale ID, reason |
| PRICE_CHANGE | Product, old price, new price |
| STOCK_ADJUSTMENT | Product, quantity, reason |
| PERMISSION_CHANGE | User, old role, new role |
| PASSWORD_CHANGE | User, method (self/admin) |
| SETTINGS_CHANGE | Setting, old value, new value |
| DATA_EXPORT | User, type, record count |

### Tamper Resistance

- Audit logs stored in append-only table
- No UPDATE or DELETE permissions on audit_logs
- Checksums on log batches (optional)
- External log shipping recommended

## Vulnerability Management

### Dependency Scanning

- `composer audit` in CI/CD
- `npm audit` in CI/CD
- Automated alerts for known vulnerabilities
- Security update policy: critical within 24h, high within 72h

### Code Security

- Static analysis (PHPStan level 8)
- No `eval()`, `exec()`, `system()` with user input
- No `unserialize()` on untrusted data
- No `preg_replace` with `/e` modifier

## Incident Response

### Automated

1. Error detected → logged with context
2. AI analyzes severity and impact
3. Critical errors → immediate notification
4. Suspicious activity → flagged and logged
5. Repeated failures → incident created

### Manual

1. Security issue reported
2. Triage and classify
3. Contain (disable account, block IP, etc.)
4. Investigate (audit logs, error logs)
5. Remediate (fix vulnerability)
6. Report (if required by regulation)
7. Document (lessons learned)

## Compliance Considerations

- **Data encryption** at rest and in transit
- **Access controls** on all sensitive data
- **Audit logging** for all modifications
- **Data retention** policies configurable per tenant
- **Right to deletion** — soft delete with configurable retention
- **Data export** — customers can export their data
- **Breach notification** — notification system for security events

## Security Checklist

- [ ] Passwords hashed with Argon2id
- [ ] Session fixation prevented
- [ ] CSRF tokens on all forms
- [ ] XSS protection via output encoding
- [ ] SQL injection prevented via ORM
- [ ] Rate limiting on sensitive endpoints
- [ ] File upload validation
- [ ] Input validation on all endpoints
- [ ] Authorization checks on all endpoints
- [ ] Tenant isolation on all queries
- [ ] Audit logging on all sensitive actions
- [ ] Secure HTTP headers
- [ ] HTTPS enforcement
- [ ] Secrets not in source code
- [ ] Dependency vulnerability scanning
- [ ] Account lockout after failed attempts
- [ ] Password complexity enforcement
- [ ] Session timeout configured
- [ ] 2FA available
- [ ] Secure password reset flow
