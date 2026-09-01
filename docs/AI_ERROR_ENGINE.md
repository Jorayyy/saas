# TechShop SaaS Platform — AI Error Intelligence Engine

## Overview

The AI Error Intelligence Engine automatically captures, analyzes, diagnoses, and suggests fixes for application errors. It uses a provider-agnostic AI abstraction layer that can work with MiMo, OpenAI-compatible providers, or local LLMs.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR INTELLIGENCE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│  │ CAPTURE  │ → │ FINGER-  │ → │ GROUP    │ → │ ANALYZE  ││
│  │          │   │ PRINT    │   │          │   │          ││
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘│
│       ↓              ↓              ↓              ↓       │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│  │ SEVERITY │   │ ROOT     │   │ SUGGEST  │   │ REPORT   ││
│  │ CLASSIFY │   │ CAUSE    │   │ FIX      │   │          ││
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘│
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    AI PROVIDER LAYER                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│  │   MiMo   │   │ OpenAI   │   │  Ollama  │   │ Fallback ││
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Error Capture

### When an error occurs:

1. **Exception Handler** catches the error
2. **Context is gathered**:
   - Stack trace
   - Request data (method, URL, headers, body)
   - User context (ID, role, tenant)
   - Server context (environment, version, git commit)
   - Recent logs (last 100 lines)
   - Database errors (if any)
   - Queue failures (if any)
   - External API calls (if any)
3. **Error is stored** in `error_events` table
4. **Fingerprint is generated** for grouping
5. **AI analysis is queued** (async)

### Context Collection

```php
class ErrorContextCollector
{
    public function collect(\Throwable $exception): ErrorContext
    {
        return new ErrorContext([
            'exception' => [
                'class' => get_class($exception),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'stack_trace' => $exception->getTraceAsString(),
            ],
            'request' => [
                'method' => request()->method(),
                'url' => request()->url(),
                'route' => request()->route()?->getName(),
                'controller' => request()->route()?->getActionName(),
                'headers' => request()->headers->all(),
                'body' => request()->except(['password', 'token', 'secret']),
                'query' => request()->query(),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ],
            'user' => [
                'id' => auth()->id(),
                'email' => auth()->user()?->email,
                'role' => auth()->user()?->primaryRole?->name,
                'tenant_id' => tenant('id'),
            ],
            'server' => [
                'environment' => app()->environment(),
                'php_version' => phpversion(),
                'laravel_version' => app()->version(),
                'app_version' => config('app.version'),
                'git_commit' => config('app.git_commit'),
                'server_name' => gethostname(),
                'os' => php_uname(),
            ],
            'recent_logs' => $this->getRecentLogs(100),
            'database_errors' => $this->getRecentDatabaseErrors(),
            'queue_failures' => $this->getRecentQueueFailures(),
            'memory_usage' => memory_get_usage(true),
            'peak_memory' => memory_get_peak_usage(true),
        ]);
    }
}
```

## Error Fingerprinting

### Algorithm

```php
class ErrorFingerprinter
{
    public function generate(ErrorContext $context): string
    {
        // Normalize the error for fingerprinting
        $normalized = [
            $context->exception['class'],
            $this->normalizeMessage($context->exception['message']),
            $this->normalizeFile($context->exception['file']),
            $context->exception['line'],
        ];
        
        $fingerprint = implode('|', $normalized);
        
        return hash('sha256', $fingerprint);
    }
    
    private function normalizeMessage(string $message): string
    {
        // Remove UUIDs, IDs, numbers that change
        $message = preg_replace('/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i', '{UUID}', $message);
        $message = preg_replace('/\d+/', '{N}', $message);
        $message = preg_replace('/\s+/', ' ', $message);
        
        return trim($message);
    }
    
    private function normalizeFile(string $file): string
    {
        // Remove base path, keep relative
        $basePath = base_path() . '/';
        return str_replace($basePath, '', $file);
    }
}
```

### Grouping

Multiple occurrences of the same error become ONE issue:

```
Fingerprint: a1b2c3d4...
├── First seen: 2026-01-15 10:30:00
├── Last seen: 2026-01-15 14:25:00
├── Count: 500
├── Affected users: 47
├── Affected tenants: 12
├── Affected routes: /api/v1/sales, /api/v1/pos/checkout
├── Status: NEW
└── Events: [error_event_1, error_event_2, ...]
```

## Severity Classification

```php
class SeverityClassifier
{
    public function classify(ErrorContext $context, int $occurrenceCount): string
    {
        $score = 0;
        
        // Exception type scoring
        $criticalExceptions = [
            'DatabaseException',
            'ConnectionException',
            'AuthenticationException',
            'AuthorizationException',
        ];
        
        if (in_array($context->exception['class'], $criticalExceptions)) {
            $score += 40;
        }
        
        // HTTP status code scoring
        $statusCode = $context->request['status_code'] ?? 500;
        if ($statusCode >= 500) $score += 30;
        elseif ($statusCode >= 400) $score += 10;
        
        // Occurrence frequency scoring
        if ($occurrenceCount > 100) $score += 30;
        elseif ($occurrenceCount > 20) $score += 20;
        elseif ($occurrenceCount > 5) $score += 10;
        
        // Affected users scoring
        $affectedUsers = $this->countAffectedUsers($context);
        if ($affectedUsers > 50) $score += 20;
        elseif ($affectedUsers > 10) $score += 10;
        
        // Financial impact scoring
        if ($this->affectsFinancialOperation($context)) {
            $score += 25;
        }
        
        // Map score to severity
        if ($score >= 80) return 'CRITICAL';
        if ($score >= 50) return 'HIGH';
        if ($score >= 25) return 'MEDIUM';
        if ($score >= 10) return 'LOW';
        return 'INFO';
    }
}
```

## AI Analysis

### AIProviderInterface

```php
interface AIProviderInterface
{
    public function isHealthy(): bool;
    public function analyze(ErrorContext $context): AIAnalysis;
    public function suggestFix(AIAnalysis $analysis): FixSuggestion;
    public function identifyRegression(ErrorContext $context, Deployment $deployment): RegressionAnalysis;
    public function getProviderName(): string;
}
```

### MiMo Implementation

```php
class MiMoProvider implements AIProviderInterface
{
    public function analyze(ErrorContext $context): AIAnalysis
    {
        $prompt = $this->buildAnalysisPrompt($context);
        
        $response = $this->client->chat()->create([
            'model' => $this->model,
            'messages' => [
                ['role' => 'system', 'content' => $this->systemPrompt()],
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => 0.3,
            'max_tokens' => 1000,
            'response_format' => ['type' => 'json_object'],
        ]);
        
        $analysis = json_decode($response['choices'][0]['message']['content'], true);
        
        return new AIAnalysis(
            severity: $analysis['severity'],
            root_cause: $analysis['root_cause'],
            affected_component: $analysis['affected_component'],
            file: $analysis['file'],
            line: $analysis['line'],
            function: $analysis['function'],
            explanation: $analysis['explanation'],
            recommended_fix: $analysis['recommended_fix'],
            confidence: $analysis['confidence'],
            is_regression: $analysis['is_regression'],
        );
    }
    
    private function systemPrompt(): string
    {
        return <<<PROMPT
You are an expert PHP/Laravel error analyst. Analyze the following error and provide:
1. Severity (CRITICAL, HIGH, MEDIUM, LOW)
2. Root cause analysis
3. Affected component
4. Exact file and line number if determinable
5. Affected function/class
6. Plain language explanation
7. Recommended fix with code example
8. Confidence score (0-1)
9. Whether this is likely a regression

Respond in JSON format:
{
    "severity": "...",
    "root_cause": "...",
    "affected_component": "...",
    "file": "...",
    "line": 0,
    "function": "...",
    "explanation": "...",
    "recommended_fix": "...",
    "confidence": 0.0,
    "is_regression": false
}
PROMPT;
    }
}
```

### Analysis Prompt Builder

```php
class AnalysisPromptBuilder
{
    public function build(ErrorContext $context): string
    {
        $prompt = "ERROR ANALYSIS REQUEST\n\n";
        
        // Exception
        $prompt .= "Exception: {$context->exception['class']}\n";
        $prompt .= "Message: {$context->exception['message']}\n";
        $prompt .= "File: {$context->exception['file']}\n";
        $prompt .= "Line: {$context->exception['line']}\n\n";
        
        // Stack trace
        $prompt .= "Stack Trace:\n{$context->exception['stack_trace']}\n\n";
        
        // Request context
        $prompt .= "Request: {$context->request['method']} {$context->request['url']}\n";
        $prompt .= "Route: {$context->request['route']}\n";
        $prompt .= "Controller: {$context->request['controller']}\n\n";
        
        // User context
        $prompt .= "User ID: {$context->user['id']}\n";
        $prompt .= "Role: {$context->user['role']}\n";
        $prompt .= "Tenant: {$context->user['tenant_id']}\n\n";
        
        // Recent logs
        if (!empty($context->recent_logs)) {
            $prompt .= "Recent Logs:\n";
            foreach (array_slice($context->recent_logs, -20) as $log) {
                $prompt .= "  [{$log['level']}] {$log['message']}\n";
            }
            $prompt .= "\n";
        }
        
        // Source code context
        $prompt .= "Source Code Context:\n";
        $prompt .= $this->getSourceContext($context->exception['file'], $context->exception['line']);
        
        return $prompt;
    }
    
    private function getSourceContext(string $file, int $line, int $context = 10): string
    {
        if (!file_exists($file)) {
            return "File not available\n";
        }
        
        $lines = file($file);
        $start = max(0, $line - $context);
        $end = min(count($lines), $line + $context);
        
        $code = '';
        for ($i = $start; $i < $end; $i++) {
            $marker = ($i + 1 === $line) ? '>>>' : '   ';
            $code .= "{$marker} " . ($i + 1) . ": " . $lines[$i];
        }
        
        return $code;
    }
}
```

## AI Failure Handling

```php
class ResilientAIAnalysis
{
    public function analyze(ErrorContext $context): AIAnalysis
    {
        // Try primary provider
        if ($this->primaryProvider->isHealthy()) {
            try {
                return $this->primaryProvider->analyze($context);
            } catch (\Exception $e) {
                Log::warning('AI primary provider failed', [
                    'provider' => $this->primaryProvider->getProviderName(),
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        // Try fallback provider
        if ($this->fallbackProvider->isHealthy()) {
            try {
                return $this->fallbackProvider->analyze($context);
            } catch (\Exception $e) {
                Log::warning('AI fallback provider failed', [
                    'provider' => $this->fallbackProvider->getProviderName(),
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        // AI unavailable - store for later analysis
        Log::error('AI analysis unavailable, storing for later');
        
        return new AIAnalysis(
            severity: 'UNKNOWN',
            root_cause: 'AI analysis unavailable',
            affected_component: 'unknown',
            explanation: 'AI service is currently unavailable. The error has been recorded and will be analyzed when the service is restored.',
            recommended_fix: 'Check AI provider status and restore service.',
            confidence: 0,
            is_regression: false,
            status: 'AI_ANALYSIS_PENDING',
        );
    }
}
```

## Regression Detection

```php
class RegressionDetector
{
    public function detect(ErrorEvent $error): ?RegressionAnalysis
    {
        // Check if there was a recent deployment
        $recentDeployment = Deployment::where('status', 'COMPLETED')
            ->where('created_at', '>', now()->subHours(24))
            ->latest()
            ->first();
        
        if (!$recentDeployment) {
            return null;
        }
        
        // Count errors before and after deployment
        $errorsBefore = ErrorEvent::where('fingerprint', $error->fingerprint)
            ->where('created_at', '<', $recentDeployment->created_at)
            ->where('created_at', '>', $recentDeployment->created_at->subHours(24))
            ->count();
        
        $errorsAfter = ErrorEvent::where('fingerprint', $error->fingerprint)
            ->where('created_at', '>', $recentDeployment->created_at)
            ->count();
        
        // Detect spike
        if ($errorsAfter > $errorsBefore * 3 && $errorsAfter >= 5) {
            // Get git changes
            $changes = $this->getGitChanges($recentDeployment->git_commit);
            
            // Get affected endpoints
            $affectedRoutes = ErrorEvent::where('fingerprint', $error->fingerprint)
                ->where('created_at', '>', $recentDeployment->created_at)
                ->pluck('route')
                ->unique()
                ->toArray();
            
            return new RegressionAnalysis(
                is_regression: true,
                deployment: $recentDeployment,
                errors_before: $errorsBefore,
                errors_after: $errorsAfter,
                affected_routes: $affectedRoutes,
                git_changes: $changes,
                confidence: min(0.95, ($errorsAfter / max($errorsBefore, 1)) * 0.3),
            );
        }
        
        return null;
    }
}
```

## AI Administrator Assistant

```php
class AIAdministratorAssistant
{
    public function answer(string $question): string
    {
        // Gather system telemetry
        $telemetry = $this->gatherTelemetry();
        
        $prompt = <<<PROMPT
You are an AI system administrator for a SaaS platform. Answer the following question using ONLY the provided telemetry data. If the data is insufficient, respond with "Insufficient evidence."

Question: {$question}

System Telemetry:
{$this->formatTelemetry($telemetry)}

Answer:
PROMPT;
        
        $response = app('ai')->chat($prompt);
        
        return $response;
    }
    
    private function gatherTelemetry(): array
    {
        return [
            'health' => app(HealthCheckService::class)->check(),
            'errors_today' => ErrorEvent::whereDate('created_at', today())->count(),
            'errors_by_severity' => ErrorEvent::whereDate('created_at', today())
                ->select('severity', DB::raw('count(*) as count'))
                ->groupBy('severity')
                ->pluck('count', 'severity'),
            'recent_errors' => ErrorEvent::latest()->limit(10)->toArray(),
            'deployments' => Deployment::latest()->limit(5)->toArray(),
            'queue_stats' => [
                'pending' => Queue::size(),
                'failed' => Queue::failed()->count(),
            ],
            'db_stats' => [
                'connections' => DB::select('SELECT count(*) as count FROM pg_stat_activity')[0]->count,
                'slow_queries' => DB::select('SELECT count(*) as count FROM pg_stat_activity WHERE state = \'active\' AND query_start < now() - interval \'5 seconds\'')[0]->count,
            ],
            'self_healing_actions' => SelfHealingAction::latest()->limit(10)->toArray(),
        ];
    }
}
```

## Error Intelligence Dashboard

### /admin/system/errors

**Overview Cards:**
- Total errors today
- New errors (unseen before)
- Critical errors
- Errors with AI analysis pending
- Regressions detected

**Charts:**
- Error trend (last 7 days)
- Severity distribution
- Affected modules
- Error frequency by hour

**Table:**
- Fingerprint
- Error class
- Message (truncated)
- Severity
- Status
- Count
- First seen
- Last seen
- Affected users
- AI confidence
- Actions (View, Resolve, Ignore)

**Filters:**
- Severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- Status (NEW, INVESTIGATING, KNOWN, FIXED, IGNORED, REGRESSION)
- Date range
- Module/component
- Affected tenant
- AI analyzed / pending

### Error Detail View

- **Header**: Error class, severity badge, status badge
- **AI Analysis**: root cause, explanation, suggested fix, confidence
- **Stack Trace**: syntax-highlighted, clickable file links
- **Request Context**: method, URL, headers, body
- **User Context**: affected users, tenants
- **Timeline**: occurrences over time
- **Related Errors**: same fingerprint
- **Regression Info**: deployment, before/after comparison
- **Actions**: Update status, Add note, Request AI re-analysis
