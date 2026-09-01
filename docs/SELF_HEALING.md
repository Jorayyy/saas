# TechShop SaaS Platform — Self-Healing Architecture

## Design Philosophy

Self-healing MUST be safe, controlled, and auditable. The system can only perform actions that are:

1. **Reversible** — can be undone without data loss
2. **Predictable** — outcome is known and tested
3. **Logged** — every action is recorded
4. **Verified** — success is confirmed after execution
5. **Scoped** — limited to infrastructure, never business data

## Self-Healing Pipeline

```
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DETECT  │ →  │ DIAGNOSE │ →  │   SELECT  │ →  │ EXECUTE  │ →  │ VERIFY   │ →  │  REPORT  │
└──────────┘    └──────────┘    └───────────┘    └──────────┘    └──────────┘    └──────────┘
     ↑                                                                           │
     └──────────────────── ROLLBACK (if verification fails) ─────────────────────┘
```

## Detection Sources

| Source | Detection Method | Response |
|--------|-----------------|----------|
| Health checks | Component status = down | Restart component |
| Error events | Severity = CRITICAL | Analyze + remediate |
| Queue monitor | Failed jobs > threshold | Retry/restart worker |
| Disk monitor | Free space < 10% | Clean temp files |
| Memory monitor | Usage > 90% | Restart service |
| Database monitor | Connection pool exhausted | Reconnect/pool resize |
| API monitor | Error rate > 20% | Circuit breaker |
| Scheduler monitor | Missed schedule | Restart scheduler |

## Action Registry

### SAFE Actions (Auto-execute)

```php
'clear_cache' => [
    'description' => 'Clear application cache',
    'risk_level' => 'SAFE',
    'timeout' => 30,
    'retry_limit' => 3,
    'rollback' => null, // cache rebuilds naturally
    'verify' => function () {
        return Cache::get('health_check') !== null;
    },
],

'retry_failed_job' => [
    'description' => 'Retry a failed queue job',
    'risk_level' => 'SAFE',
    'timeout' => 60,
    'retry_limit' => 1,
    'rollback' => null,
    'verify' => function ($job) {
        return $job->status === 'completed';
    },
],

'clear_temp_files' => [
    'description' => 'Remove files older than 7 days in temp directory',
    'risk_level' => 'SAFE',
    'timeout' => 60,
    'retry_limit' => 1,
    'rollback' => null,
    'verify' => function () {
        return Disk::used('temp') < Disk::total('temp') * 0.8;
    },
],

'release_stale_lock' => [
    'description' => 'Release locks held for more than 5 minutes',
    'risk_level' => 'SAFE',
    'timeout' => 10,
    'retry_limit' => 1,
    'rollback' => null,
    'verify' => function () {
        return Lock::staleCount() === 0;
    },
],

'restart_queue_worker' => [
    'description' => 'Restart a stuck queue worker',
    'risk_level' => 'CONTROLLED',
    'timeout' => 30,
    'retry_limit' => 2,
    'rollback' => null,
    'verify' => function () {
        return Queue::workerRunning();
    },
],
```

### CONTROLLED Actions (Auto-execute with notification)

```php
'restart_service' => [
    'description' => 'Restart a Docker service',
    'risk_level' => 'CONTROLLED',
    'timeout' => 120,
    'retry_limit' => 2,
    'rollback' => null,
    'verify' => function ($service) {
        return Docker::serviceHealth($service) === 'healthy';
    },
    'notify' => true,
],

'reconnect_database' => [
    'description' => 'Reconnect to database after connection failure',
    'risk_level' => 'CONTROLLED',
    'timeout' => 30,
    'retry_limit' => 3,
    'rollback' => null,
    'verify' => function () {
        return DB::ping();
    },
    'notify' => true,
],

'trigger_backup' => [
    'description' => 'Trigger emergency backup',
    'risk_level' => 'CONTROLLED',
    'timeout' => 600,
    'retry_limit' => 1,
    'rollback' => null,
    'verify' => function ($backup) {
        return $backup->status === 'completed';
    },
    'notify' => true,
],

'switch_ai_provider' => [
    'description' => 'Switch to fallback AI provider',
    'risk_level' => 'CONTROLLED',
    'timeout' => 10,
    'retry_limit' => 1,
    'rollback' => function () {
        Config::set('ai.provider', Config::get('ai.primary_provider'));
    },
    'verify' => function () {
        return app('ai')->isHealthy();
    },
    'notify' => true,
],

'disable_failing_integration' => [
    'description' => 'Disable a non-critical integration that is failing',
    'risk_level' => 'CONTROLLED',
    'timeout' => 10,
    'retry_limit' => 1,
    'rollback' => function ($integration) {
        Integration::enable($integration);
    },
    'verify' => function ($integration) {
        return Integration::status($integration) === 'disabled';
    },
    'notify' => true,
],
```

### DANGEROUS Actions (Require human approval)

```php
'delete_old_data' => [
    'description' => 'Delete data older than retention period',
    'risk_level' => 'DANGEROUS',
    'auto_execute' => false,
    'requires_approval' => true,
    'approver_role' => 'ADMIN',
],

'modify_financial_records' => [
    'description' => 'Any modification to financial records',
    'risk_level' => 'MANUAL_ONLY',
    'auto_execute' => false,
    'requires_approval' => false,
],

'change_permissions' => [
    'description' => 'Modify user permissions or roles',
    'risk_level' => 'MANUAL_ONLY',
    'auto_execute' => false,
    'requires_approval' => false,
],

'change_firewall_rules' => [
    'description' => 'Modify firewall or network rules',
    'risk_level' => 'MANUAL_ONLY',
    'auto_execute' => false,
    'requires_approval' => false,
],

'disable_authentication' => [
    'description' => 'Disable or bypass authentication',
    'risk_level' => 'MANUAL_ONLY',
    'auto_execute' => false,
    'requires_approval' => false,
],

'delete_customer_data' => [
    'description' => 'Delete any customer data',
    'risk_level' => 'MANUAL_ONLY',
    'auto_execute' => false,
    'requires_approval' => false,
],

'modify_source_code' => [
    'description' => 'Modify application source code in production',
    'risk_level' => 'MANUAL_ONLY',
    'auto_execute' => false,
    'requires_approval' => false,
],
```

## SelfHealingService

```php
class SelfHealingService
{
    public function detect(): array
    {
        $issues = [];
        
        // Check health components
        $health = app(HealthCheckService::class)->check();
        foreach ($health->components as $component) {
            if ($component->status === 'down') {
                $issues[] = new DetectedIssue(
                    type: 'component_down',
                    component: $component->name,
                    severity: 'CRITICAL',
                    details: $component->details
                );
            }
        }
        
        // Check error events
        $recentErrors = ErrorEvent::where('status', 'NEW')
            ->where('severity', 'CRITICAL')
            ->where('created_at', '>', now()->subMinutes(5))
            ->get();
        
        foreach ($recentErrors as $error) {
            $issues[] = new DetectedIssue(
                type: 'critical_error',
                component: $error->affected_component,
                severity: 'CRITICAL',
                details: ['error_id' => $error->id]
            );
        }
        
        // Check queue
        $failedJobs = Queue::failed()->count();
        if ($failedJobs > 50) {
            $issues[] = new DetectedIssue(
                type: 'queue_backlog',
                component: 'queue',
                severity: 'HIGH',
                details: ['failed_count' => $failedJobs]
            );
        }
        
        // Check disk
        $diskFree = Disk::free('app');
        $diskTotal = Disk::total('app');
        if ($diskFree / $diskTotal < 0.1) {
            $issues[] = new DetectedIssue(
                type: 'disk_low',
                component: 'filesystem',
                severity: 'HIGH',
                details: ['free_gb' => $diskFree / 1024 / 1024 / 1024]
            );
        }
        
        return $issues;
    }
    
    public function diagnose(DetectedIssue $issue): Diagnosis
    {
        // Try AI analysis first
        if (app('ai')->isHealthy()) {
            $aiDiagnosis = app('ai')->analyze($issue);
            if ($aiDiagnosis->confidence > 0.7) {
                return $aiDiagnosis;
            }
        }
        
        // Fallback to rule-based diagnosis
        return $this->ruleBasedDiagnosis($issue);
    }
    
    public function selectRemediation(Diagnosis $diagnosis): ?RemediationAction
    {
        $action = $diagnosis->suggestedAction;
        
        if (!$action) {
            return null;
        }
        
        // Check risk level
        if ($action->risk_level === 'MANUAL_ONLY') {
            $this->notifyAdmin($action, 'Requires manual intervention');
            return null;
        }
        
        if ($action->risk_level === 'DANGEROUS' && !$this->hasApproval($action)) {
            $this->notifyAdmin($action, 'Requires approval');
            return null;
        }
        
        // Check rate limiting
        if ($this->tooManyRecentActions($action->type)) {
            Log::warning('Self-healing rate limited', ['action' => $action->type]);
            return null;
        }
        
        return $action;
    }
    
    public function execute(RemediationAction $action): ExecutionResult
    {
        $execution = SelfHealingAction::create([
            'action_type' => $action->type,
            'risk_level' => $action->risk_level,
            'trigger_reason' => $action->reason,
            'action_data' => $action->toArray(),
            'status' => 'EXECUTING',
            'executed_by' => 'AI',
        ]);
        
        try {
            // Execute with timeout
            $result = $this->withTimeout(
                $action->timeout,
                fn() => $action->execute()
            );
            
            $execution->update([
                'status' => 'COMPLETED',
                'result' => $result->toArray(),
                'executed_at' => now(),
            ]);
            
            return $result;
            
        } catch (\Exception $e) {
            $execution->update([
                'status' => 'FAILED',
                'result' => ['error' => $e->getMessage()],
                'executed_at' => now(),
            ]);
            
            // Attempt rollback if available
            if ($action->rollback) {
                $this->rollback($action, $e);
            }
            
            throw $e;
        }
    }
    
    public function verify(RemediationAction $action): bool
    {
        if (!$action->verify) {
            return true;
        }
        
        $maxRetries = 3;
        $retryDelay = 5;
        
        for ($i = 0; $i < $maxRetries; $i++) {
            try {
                if ($action->verify()) {
                    return true;
                }
            } catch (\Exception $e) {
                Log::warning('Verification failed', [
                    'action' => $action->type,
                    'attempt' => $i + 1,
                    'error' => $e->getMessage(),
                ]);
            }
            
            if ($i < $maxRetries - 1) {
                sleep($retryDelay);
            }
        }
        
        return false;
    }
    
    public function rollback(RemediationAction $action, \Exception $error): void
    {
        if (!$action->rollback) {
            return;
        }
        
        try {
            $action->rollback();
            
            Log::info('Self-healing rollback completed', [
                'action' => $action->type,
                'error' => $error->getMessage(),
            ]);
            
        } catch (\Exception $rollbackError) {
            Log::critical('Self-healing rollback failed', [
                'action' => $action->type,
                'original_error' => $error->getMessage(),
                'rollback_error' => $rollbackError->getMessage(),
            ]);
            
            $this->notifyAdmin($action, 'Rollback failed: ' . $rollbackError->getMessage());
        }
    }
    
    public function report(): SelfHealingReport
    {
        return new SelfHealingReport(
            total_actions: SelfHealingAction::count(),
            successful: SelfHealingAction::where('status', 'COMPLETED')->count(),
            failed: SelfHealingAction::where('status', 'FAILED')->count(),
            rolled_back: SelfHealingAction::where('status', 'ROLLED_BACK')->count(),
            recent_actions: SelfHealingAction::latest()->limit(10)->get(),
            actions_by_type: SelfHealingAction::select('action_type', DB::raw('count(*) as count'))
                ->groupBy('action_type')
                ->get(),
        );
    }
}
```

## Safety Mechanisms

### Rate Limiting

```php
// Max 5 self-healing actions per hour per action type
// Max 20 total self-healing actions per hour
private function tooManyRecentActions(string $actionType): bool
{
    $hourlyPerType = SelfHealingAction::where('action_type', $actionType)
        ->where('created_at', '>', now()->subHour())
        ->count();
    
    if ($hourlyPerType >= 5) {
        return true;
    }
    
    $hourlyTotal = SelfHealingAction::where('created_at', '>', now()->subHour())
        ->count();
    
    return $hourlyTotal >= 20;
}
```

### Circuit Breaker

```php
// If self-healing fails 3 times in a row, stop trying
private function circuitOpen(): bool
{
    $recentFailures = SelfHealingAction::where('status', 'FAILED')
        ->where('created_at', '>', now()->subMinutes(30))
        ->count();
    
    return $recentFailures >= 3;
}
```

### Approval Workflow

```php
// For DANGEROUS actions
private function hasApproval(RemediationAction $action): bool
{
    return SelfHealingApproval::where('action_type', $action->type)
        ->where('status', 'APPROVED')
        ->where('expires_at', '>', now())
        ->exists();
}
```

### Notification

```php
// Always notify on CONTROLLED actions
// Always notify on failures
// Daily digest of all actions
private function notifyAdmin(RemediationAction $action, string $reason): void
{
    Notification::route('email', config('app.admin_email'))
        ->notify(new SelfHealingNotification($action, $reason));
    
    // In-app notification
    Notification::create([
        'tenant_id' => null, // system notification
        'type' => 'SYSTEM_ERROR',
        'title' => 'Self-Healing Action',
        'message' => "{$action->type}: {$reason}",
        'data' => $action->toArray(),
    ]);
}
```

## Incident Timeline

When multiple issues occur, self-healing creates an incident timeline:

```
10:42:11 — deployment started (v1.5.0)
10:42:35 — deployment completed
10:42:48 — database connection timeout detected
10:42:49 — 37 API failures recorded
10:42:50 — AI analyzes errors: probable regression in InventoryService
10:42:51 — Self-healing: attempt database reconnection
10:42:53 — Self-healing: database reconnection successful
10:42:54 — Self-healing: retry failed queue jobs (42 jobs)
10:43:05 — Self-healing: verification passed
10:43:06 — Alert sent to administrator
10:43:07 — Incident INC-2026-000421 created
10:45:00 — Error rate returns to normal
10:45:01 — Incident marked as resolved
```

## Dashboard

### /admin/system/self-healing

- **Active Issues**: currently detected problems
- **Recent Actions**: last 20 self-healing actions
- **Success Rate**: percentage of successful actions
- **Action History**: filterable by type, status, date
- **Configuration**: enable/disable, risk level limits
- **Manual Trigger**: admin can manually trigger actions
- **Audit Log**: complete history of all actions
