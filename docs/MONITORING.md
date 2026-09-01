# TechShop SaaS Platform — Monitoring & Observability

## Observability Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Structured Logging | Laravel Log + Monolog | Application logs |
| Error Tracking | Custom + Sentry (self-hosted) | Error intelligence |
| Metrics | OpenTelemetry SDK | Performance metrics |
| Tracing | OpenTelemetry | Distributed tracing |
| Health Checks | Custom HealthCheckService | Service health |
| Audit Logging | Custom AuditService | Security audit |
| AI Analysis | AIProviderInterface | Automated diagnosis |

## Structured Logging

### Log Format

Every log entry is JSON:

```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "level": "error",
  "service": "techshop-saas",
  "environment": "production",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "request_id": "req_uuid",
  "correlation_id": "corr_uuid",
  "message": "Failed to process sale",
  "context": {
    "sale_id": "uuid",
    "amount": 1500.00,
    "error": "Insufficient stock"
  },
  "exception": {
    "class": "App\\Exceptions\\InsufficientStockException",
    "message": "Product SKU-001 has insufficient stock",
    "stack_trace": "...",
    "file": "app/Services/InventoryService.php",
    "line": 184
  }
}
```

### Log Channels

| Channel | Purpose | Retention |
|---------|---------|-----------|
| stack | All logs | 30 days |
| daily | Daily rotation | 90 days |
| error | Errors only | 180 days |
| audit | Audit events | 365 days |
| security | Security events | 365 days |
| performance | Slow queries/requests | 30 days |

### Correlation IDs

Every request gets a unique `request_id` that propagates through:

1. HTTP middleware → sets `X-Request-ID` header
2. Log context → included in every log
3. Database queries → logged with request_id
4. Queue jobs → inherit request_id from dispatch
5. Error events → linked to request_id
6. API responses → returned in `X-Request-ID` header

## Health Monitoring

### Health Endpoints

```
GET /health — Basic health (load balancer probe)
GET /ready — Readiness check (can accept traffic)
GET /live — Liveness check (process is alive)
GET /health/detailed — Full component status (admin only)
```

### Health Check Components

```php
class HealthCheckService
{
    public function check(): HealthReport
    {
        return new HealthReport([
            'database' => $this->checkDatabase(),
            'cache' => $this->checkCache(),
            'queue' => $this->checkQueue(),
            'filesystem' => $this->checkFilesystem(),
            'scheduler' => $this->checkScheduler(),
            'ai_provider' => $this->checkAIProvider(),
            'disk_space' => $this->checkDiskSpace(),
            'memory' => $this->checkMemory(),
        ]);
    }
}
```

### Health Status

```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:45Z",
  "version": "1.0.0",
  "uptime": 864000,
  "components": {
    "database": {
      "status": "healthy",
      "response_time_ms": 2,
      "details": {
        "connections": 15,
        "max_connections": 200,
        "replication_lag": null
      }
    },
    "cache": {
      "status": "healthy",
      "response_time_ms": 1,
      "details": {
        "hit_rate": 0.95,
        "memory_used_mb": 128,
        "memory_max_mb": 512
      }
    },
    "queue": {
      "status": "healthy",
      "details": {
        "pending_jobs": 5,
        "failed_jobs": 0,
        "workers": 4
      }
    },
    "filesystem": {
      "status": "healthy",
      "details": {
        "writable": true,
        "disk_free_gb": 45.2
      }
    },
    "ai_provider": {
      "status": "degraded",
      "details": {
        "provider": "mimo",
        "last_successful_call": "2026-01-15T10:25:00Z",
        "error_rate": 0.15
      }
    }
  }
}
```

### Health Check Frequency

| Check | Interval | Timeout |
|-------|----------|---------|
| Database | 10s | 5s |
| Cache | 10s | 3s |
| Queue | 30s | 5s |
| Filesystem | 60s | 5s |
| Scheduler | 60s | 10s |
| AI Provider | 120s | 15s |
| Disk Space | 300s | 5s |
| Memory | 30s | 5s |

## Metrics Collection

### Application Metrics

```php
// Counter: requests total
app('metrics')->counter('http_requests_total', [
    'method' => 'POST',
    'route' => '/api/v1/sales',
    'status' => 200,
]);

// Histogram: request duration
app('metrics')->histogram('http_request_duration_ms', $duration, [
    'method' => 'POST',
    'route' => '/api/v1/sales',
]);

// Gauge: queue depth
app('metrics')->gauge('queue_depth', $depth, [
    'queue' => 'default',
]);

// Counter: errors
app('metrics')->counter('errors_total', [
    'type' => 'exception',
    'severity' => 'HIGH',
]);
```

### Business Metrics

| Metric | Type | Labels |
|--------|------|--------|
| sales_total | counter | branch, payment_method |
| sales_amount | histogram | branch |
| repairs_created | counter | branch, device_type |
| repairs_completed | counter | branch, technician |
| inventory_stock_level | gauge | product, branch |
| customers_created | counter | branch |
| api_request_duration | histogram | method, endpoint |
| error_count | counter | severity, module |
| ai_analysis_count | counter | provider, status |
| self_healing_actions | counter | action_type, status |

## Alerting Rules

### Critical (Immediate)

| Alert | Condition | Action |
|-------|-----------|--------|
| Database Down | health.database = down | Page admin, auto-restart |
| Queue Backlog | queue_depth > 1000 for 5min | Alert admin, scale workers |
| Error Spike | errors_total > 50 in 5min | Alert admin, AI analysis |
| Disk Full | disk_free < 10% | Alert admin, cleanup |
| Memory Exhausted | memory_used > 90% | Alert admin, restart |
| Backup Failed | backup.status = failed | Alert admin |
| Security Breach | suspicious_activity detected | Page admin, lock accounts |

### Warning (15-minute delay)

| Alert | Condition | Action |
|-------|-----------|--------|
| Slow Queries | avg_query_time > 1000ms | Log warning, AI analysis |
| High Error Rate | error_rate > 5% for 10min | Alert admin |
| AI Degraded | ai.error_rate > 20% | Switch provider, alert |
| Stock Low | product.stock < minimum | Notify inventory manager |
| Repair Overdue | repair.age > estimated_completion | Notify manager |
| Memory High | memory_used > 80% | Log warning |

### Info (Daily digest)

| Alert | Condition | Action |
|-------|-----------|--------|
| Daily Summary | Daily 8am | Email admin |
| Weekly Report | Weekly Monday | Email admin |
| Monthly Backup | Monthly 1st | Verify all backups |

## Error Intelligence Dashboard

### /admin/system/errors

Displays:

- **Error Overview**: total errors, new today, resolved today, trend
- **Severity Distribution**: CRITICAL, HIGH, MEDIUM, LOW, INFO
- **Error Timeline**: chart of errors over time
- **Top Errors**: most frequent errors
- **Recent Errors**: latest error events
- **AI Insights**: AI-detected patterns
- **Regression Detection**: new errors after deployment

### Error Detail View

- Stack trace with syntax highlighting
- Request context (headers, body, params)
- User context (who was affected)
- Tenant context (which tenants affected)
- Timeline of occurrences
- AI analysis (root cause, suggested fix)
- Related errors (same fingerprint)
- Resolution history

## Audit Logging

### What Gets Logged

| Action | Details | Severity |
|--------|---------|----------|
| User login | IP, user agent, success | INFO |
| User logout | Session duration | INFO |
| Password change | Method (self/admin) | WARNING |
| Role changed | Old/new role | WARNING |
| Permission changed | Old/new permissions | WARNING |
| Sale created | Items, amount | INFO |
| Sale voided | Reason | WARNING |
| Refund processed | Amount, reason | WARNING |
| Stock adjusted | Product, quantity, reason | WARNING |
| Price changed | Product, old/new price | INFO |
| Repair status changed | Old/new status | INFO |
| Settings changed | Old/new values | WARNING |
| Data exported | Type, record count | WARNING |
| API key created | Key name | WARNING |

### Audit Log Query

```php
// Recent activity for a user
AuditLog::where('tenant_id', $tenantId)
    ->where('user_id', $userId)
    ->orderByDesc('created_at')
    ->limit(50)
    ->get();

// All price changes today
AuditLog::where('tenant_id', $tenantId)
    ->where('action', 'PRICE_CHANGE')
    ->whereDate('created_at', today())
    ->get();

// All stock adjustments
AuditLog::where('tenant_id', $tenantId)
    ->where('action', 'STOCK_ADJUSTMENT')
    ->whereBetween('created_at', [$start, $end])
    ->get();
```

## Performance Monitoring

### Slow Query Detection

```php
// Automatically log queries > 100ms
DB::listen(function ($query) {
    if ($query->time > 100) {
        Log::channel('performance')->warning('Slow query', [
            'sql' => $query->sql,
            'time_ms' => $query->time,
            'bindings' => $query->bindings,
        ]);
    }
});
```

### Slow Request Detection

```php
// Middleware logs requests > 2000ms
class PerformanceMiddleware
{
    public function handle($request, Closure $next)
    {
        $start = microtime(true);
        $response = $next($request);
        $duration = (microtime(true) - $start) * 1000;

        if ($duration > 2000) {
            Log::channel('performance')->warning('Slow request', [
                'method' => $request->method(),
                'url' => $request->url(),
                'duration_ms' => $duration,
                'user_id' => auth()->id(),
            ]);
        }

        return $response;
    }
}
```

## Dashboard Metrics

### /admin/system

Real-time dashboard showing:

- **System Health**: overall status + component status
- **Request Rate**: requests per minute
- **Error Rate**: errors per minute
- **Response Time**: p50, p95, p99 latencies
- **Active Users**: currently active sessions
- **Queue Depth**: pending/failed jobs
- **Database**: connections, query time, slow queries
- **Cache**: hit rate, memory usage
- **Disk**: usage, free space
- **AI Provider**: status, response time, error rate
- **Self-Healing**: actions taken, success rate
- **Recent Incidents**: unresolved errors
- **Deployment Status**: current version, last deployment

## Log Retention Policy

| Log Type | Retention | Action |
|----------|-----------|--------|
| Application logs | 30 days | Archive to cold storage |
| Error events | 180 days | Archive, then delete |
| Audit logs | 365 days | Archive (never delete financial) |
| Performance logs | 30 days | Delete |
| Security logs | 365 days | Archive |
| Backup logs | 90 days | Delete |

## OpenTelemetry Integration

### Tracing

```php
// Manual span creation
$span = app('tracer')->startSpan('process_sale');
try {
    // ... business logic
    $span->setStatus(SpanStatus::OK);
} catch (\Exception $e) {
    $span->setStatus(SpanStatus::ERROR, $e->getMessage());
    throw $e;
} finally {
    $span->end();
}
```

### Context Propagation

- HTTP headers: `traceparent`, `tracestate`
- Queue jobs: trace context passed via job payload
- Database queries: traced automatically via Laravel
- External HTTP calls: traced automatically
