# 🎯 **ARCHITECTURAL REVISION: DAILY SYNC WITH EVENT LISTENING**

## 🔄 **UPDATED REQUIREMENT: DAILY SYNC FOR MANY PARTIES**

You're right! With **many political parties in Nepal**, we need:
1. ✅ **Daily updates** to keep all parties in sync
2. ✅ **Event-driven approach** for reliable updates
3. ✅ **Scalable** for 100+ tenants
4. ✅ **Minimal performance impact**

---

## 🏗️ **REVISED ARCHITECTURE: EVENT-DRIVEN DAILY SYNC**

### **Updated Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│ LANDLORD DB (Source of Truth)                          │
│ • Canonical Geography (Official 1-4)                   │
│ • Event: GeographyUpdated (when changes occur)         │
│ • Change tracking table                                │
└──────────────┬──────────────────────────────────────────┘
               │ Publishes Daily Sync Event
               ▼
┌─────────────────────────────────────────────────────────┐
│ MESSAGE QUEUE (RabbitMQ/Redis)                         │
│ • Async job queue for scalability                      │
│ • Retry logic for failed syncs                         │
│ • Rate limiting for many tenants                       │
└──────────────┬──────────────────────────────────────────┘
               │ Consumes & distributes
               ▼
┌─────────────────────────────────────────────────────────┐
│ TENANT WORKERS (Many)                                  │
│ • Worker 1: Sync Tenant A                              │
│ • Worker 2: Sync Tenant B                              │
│ • Worker N: Sync Tenant N                              │
│ • Each tenant syncs independently                      │
└──────────────┬──────────────────────────────────────────┘
               │ Updates tenant DB
               ▼
┌─────────────────────────────────────────────────────────┐
│ TENANT DB (Self-Contained)                             │
│ • tenant_geo_units (Mirror + Custom)                   │
│ • Always up-to-date within 24 hours                    │
│ • Operates independently                               │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 **IMPLEMENTATION PLAN: DAILY EVENT-DRIVEN SYNC**

### **PHASE 1: LANDLORD CHANGE TRACKING (Day 1)**

#### **Step 1.1: Add Change Tracking to Landlord DB**
```sql
-- Landlord DB: Track geography changes
CREATE TABLE geography_changes (
    id BIGSERIAL PRIMARY KEY,
    geo_unit_id BIGINT NOT NULL REFERENCES geo_administrative_units(id),
    change_type VARCHAR(20) NOT NULL, -- CREATED, UPDATED, DELETED
    change_data JSONB NOT NULL, -- Before/after data
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    synced_to_tenants BOOLEAN DEFAULT FALSE,
    
    INDEX idx_geography_changes_synced (synced_to_tenants, changed_at)
);

-- Trigger to capture changes
CREATE OR REPLACE FUNCTION track_geography_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO geography_changes (geo_unit_id, change_type, change_data)
        VALUES (NEW.id, 'CREATED', jsonb_build_object('after', row_to_json(NEW)));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO geography_changes (geo_unit_id, change_type, change_data)
        VALUES (NEW.id, 'UPDATED', jsonb_build_object(
            'before', row_to_json(OLD),
            'after', row_to_json(NEW)
        ));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO geography_changes (geo_unit_id, change_type, change_data)
        VALUES (OLD.id, 'DELETED', jsonb_build_object('before', row_to_json(OLD)));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to geography table
CREATE TRIGGER geography_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON geo_administrative_units
FOR EACH ROW EXECUTE FUNCTION track_geography_changes();
```

#### **Step 1.2: Create Daily Sync Scheduler**
```php
// app/Console/Commands/ScheduleDailyGeographySync.php
class ScheduleDailyGeographySync extends Command
{
    protected $signature = 'geography:schedule-daily-sync';
    protected $description = 'Schedule daily geography sync for all tenants';
    
    public function handle()
    {
        $this->info('Starting daily geography sync...');
        
        // 1. Check for changes in landlord
        $hasChanges = $this->checkForLandlordChanges();
        
        if (!$hasChanges) {
            $this->info('No geography changes detected. Skipping sync.');
            return;
        }
        
        // 2. Get all active tenants
        $tenants = Tenant::where('is_active', true)->get();
        
        $this->info("Scheduling sync for {$tenants->count()} tenants...");
        
        // 3. Queue sync jobs for each tenant
        foreach ($tenants as $tenant) {
            SyncTenantGeography::dispatch($tenant)
                ->onQueue('geography-sync')
                ->delay(now()->addSeconds(rand(0, 300))); // Stagger to avoid thundering herd
        }
        
        // 4. Mark changes as synced
        $this->markChangesAsSynced();
        
        $this->info('Daily sync scheduled successfully.');
    }
    
    private function checkForLandlordChanges(): bool
    {
        return DB::connection('landlord')
            ->table('geography_changes')
            ->where('synced_to_tenants', false)
            ->where('changed_at', '>', now()->subDays(1))
            ->exists();
    }
}
```

### **PHASE 2: EVENT-DRIVEN SYNC JOBS (Day 2)**

#### **Step 2.1: Create Async Sync Job**
```php
// app/Jobs/SyncTenantGeography.php
class SyncTenantGeography implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public $tenant;
    public $timeout = 300; // 5 minutes
    public $tries = 3;
    public $backoff = [60, 300, 600]; // Retry after 1, 5, 10 minutes
    
    public function __construct(Tenant $tenant)
    {
        $this->tenant = $tenant;
    }
    
    public function handle()
    {
        Log::channel('geography-sync')->info('Starting geography sync', [
            'tenant_id' => $this->tenant->id,
            'job_id' => $this->job->getJobId(),
        ]);
        
        try {
            // 1. Get unsynced changes from landlord
            $changes = $this->getUnsyncedChanges();
            
            if ($changes->isEmpty()) {
                Log::channel('geography-sync')->info('No changes to sync', [
                    'tenant_id' => $this->tenant->id,
                ]);
                return;
            }
            
            // 2. Apply changes to tenant DB
            $results = $this->applyChangesToTenant($changes);
            
            // 3. Update sync status
            $this->updateSyncStatus($changes->pluck('id'));
            
            // 4. Log success
            Log::channel('geography-sync')->info('Geography sync completed', [
                'tenant_id' => $this->tenant->id,
                'changes_applied' => $results->getAppliedCount(),
                'changes_failed' => $results->getFailedCount(),
                'duration_seconds' => $this->getExecutionTime(),
            ]);
            
            // 5. Emit event for monitoring
            event(new TenantGeographySynced(
                tenantId: $this->tenant->id,
                changesApplied: $results->getAppliedCount(),
                syncDuration: $this->getExecutionTime(),
                success: true
            ));
            
        } catch (\Exception $e) {
            Log::channel('geography-sync')->error('Geography sync failed', [
                'tenant_id' => $this->tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            event(new TenantGeographySyncFailed(
                tenantId: $this->tenant->id,
                error: $e->getMessage(),
                attempts: $this->attempts()
            ));
            
            throw $e; // Trigger retry
        }
    }
    
    private function getUnsyncedChanges(): Collection
    {
        return DB::connection('landlord')
            ->table('geography_changes as gc')
            ->join('geo_administrative_units as gau', 'gc.geo_unit_id', '=', 'gau.id')
            ->select([
                'gc.id',
                'gc.geo_unit_id',
                'gc.change_type',
                'gc.change_data',
                'gau.country_code',
                'gau.admin_level',
                'gau.name_local',
                'gau.admin_type',
                'gau.parent_id',
                'gau.path',
                'gau.code'
            ])
            ->where('gc.synced_to_tenants', false)
            ->where('gau.country_code', 'NP') // Only Nepal for now
            ->where('gau.is_active', true)
            ->orderBy('gau.admin_level')
            ->orderBy('gau.parent_id')
            ->get();
    }
    
    private function applyChangesToTenant(Collection $changes): SyncResult
    {
        return DB::connection($this->tenant->connection)->transaction(function () use ($changes) {
            $results = new SyncResult();
            
            foreach ($changes as $change) {
                try {
                    switch ($change->change_type) {
                        case 'CREATED':
                            $this->handleCreation($change);
                            $results->incrementCreated();
                            break;
                            
                        case 'UPDATED':
                            $this->handleUpdate($change);
                            $results->incrementUpdated();
                            break;
                            
                        case 'DELETED':
                            $this->handleDeletion($change);
                            $results->incrementDeleted();
                            break;
                    }
                    
                } catch (\Exception $e) {
                    Log::channel('geography-sync')->warning('Failed to apply change', [
                        'tenant_id' => $this->tenant->id,
                        'change_id' => $change->id,
                        'change_type' => $change->change_type,
                        'error' => $e->getMessage(),
                    ]);
                    
                    $results->incrementFailed();
                }
            }
            
            return $results;
        });
    }
    
    private function handleCreation($change): void
    {
        // Find parent in tenant DB
        $parentId = $this->findParentInTenant($change->parent_id);
        
        TenantGeoUnit::on($this->tenant->connection)->create([
            'level' => $change->admin_level,
            'name' => $this->extractName($change->name_local),
            'type' => $change->admin_type,
            'parent_id' => $parentId,
            'geo_path' => $change->path,
            'external_geo_id' => $change->geo_unit_id,
            'is_official' => true,
            'is_custom' => false,
            'code' => $change->code,
        ]);
    }
    
    private function handleUpdate($change): void
    {
        $changeData = json_decode($change->change_data, true);
        $after = $changeData['after'];
        
        TenantGeoUnit::on($this->tenant->connection)
            ->where('external_geo_id', $change->geo_unit_id)
            ->where('is_official', true)
            ->update([
                'name' => $this->extractName($after['name_local']),
                'type' => $after['admin_type'],
                'geo_path' => $after['path'],
                'code' => $after['code'],
                'updated_at' => now(),
            ]);
    }
    
    private function handleDeletion($change): void
    {
        // Soft delete - mark as inactive but keep for historical records
        TenantGeoUnit::on($this->tenant->connection)
            ->where('external_geo_id', $change->geo_unit_id)
            ->where('is_official', true)
            ->update([
                'is_active' => false,
                'deleted_at' => now(),
            ]);
    }
    
    public function failed(\Throwable $exception)
    {
        // Send alert after final failure
        if ($this->attempts() >= $this->tries) {
            Notification::route('slack', config('logging.slack_webhook'))
                ->notify(new GeographySyncFailedNotification(
                    tenant: $this->tenant,
                    error: $exception->getMessage(),
                    attempts: $this->attempts()
                ));
        }
    }
}
```

### **PHASE 3: QUEUE WORKERS & SCALING (Day 3)**

#### **Step 3.1: Configure Queue Workers**
```bash
# Supervisor configuration for geography sync workers
# /etc/supervisor/conf.d/geography-sync.conf

[program:geography-sync-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/packages/laravel-backend/artisan queue:work redis --queue=geography-sync --timeout=300 --sleep=3 --tries=3
autostart=true
autorestart=true
user=www-data
numprocs=5  # 5 workers for parallel processing
redirect_stderr=true
stdout_logfile=/var/log/geography-sync.log
stopwaitsecs=3600
```

#### **Step 3.2: Create Monitoring Dashboard**
```php
// app/Http/Controllers/Admin/GeographySyncMonitorController.php
class GeographySyncMonitorController extends Controller
{
    public function dashboard()
    {
        $stats = [
            'tenants_total' => Tenant::count(),
            'tenants_active' => Tenant::where('is_active', true)->count(),
            'tenants_synced_today' => Tenant::whereDate('last_geography_sync', today())->count(),
            'pending_changes' => DB::connection('landlord')
                ->table('geography_changes')
                ->where('synced_to_tenants', false)
                ->count(),
            'queue_size' => Redis::llen('queues:geography-sync'),
            'failed_jobs' => DB::table('failed_jobs')
                ->where('queue', 'geography-sync')
                ->whereDate('failed_at', today())
                ->count(),
        ];
        
        $recentSyncs = Tenant::with('lastSync')
            ->where('is_active', true)
            ->orderBy('last_geography_sync', 'desc')
            ->limit(20)
            ->get();
        
        $failedSyncs = DB::table('failed_jobs')
            ->where('queue', 'geography-sync')
            ->whereDate('failed_at', '>=', now()->subDays(3))
            ->orderBy('failed_at', 'desc')
            ->get();
        
        return view('admin.geography-sync.dashboard', compact('stats', 'recentSyncs', 'failedSyncs'));
    }
    
    public function forceSync(Tenant $tenant)
    {
        SyncTenantGeography::dispatch($tenant)
            ->onQueue('geography-sync-high-priority');
        
        return redirect()->back()
            ->with('success', "Sync queued for tenant {$tenant->name}");
    }
    
    public function retryFailed()
    {
        $failedJobs = DB::table('failed_jobs')
            ->where('queue', 'geography-sync')
            ->get();
        
        foreach ($failedJobs as $job) {
            Artisan::call('queue:retry', ['id' => $job->id]);
        }
        
        return redirect()->back()
            ->with('success', "Retried {$failedJobs->count()} failed jobs");
    }
}
```

### **PHASE 4: DAILY SCHEDULING & ALERTS (Day 4)**

#### **Step 4.1: Configure Daily Schedule**
```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    // Daily geography sync at 2 AM (low traffic time)
    $schedule->command('geography:schedule-daily-sync')
        ->dailyAt('02:00')
        ->runInBackground()
        ->appendOutputTo(storage_path('logs/geography-sync-schedule.log'));
    
    // Check sync completion at 4 AM
    $schedule->command('geography:check-sync-completion')
        ->dailyAt('04:00')
        ->runInBackground();
    
    // Cleanup old sync logs weekly
    $schedule->command('geography:cleanup-old-logs')
        ->weeklyOn(0, '03:00') // Sunday at 3 AM
        ->runInBackground();
}
```

#### **Step 4.2: Create Sync Health Check Command**
```php
// app/Console/Commands/CheckGeographySyncCompletion.php
class CheckGeographySyncCompletion extends Command
{
    protected $signature = 'geography:check-sync-completion';
    
    public function handle()
    {
        $activeTenants = Tenant::where('is_active', true)->count();
        $syncedToday = Tenant::whereDate('last_geography_sync', today())->count();
        
        $syncRate = ($activeTenants > 0) ? ($syncedToday / $activeTenants) * 100 : 0;
        
        // Alert if sync rate is low
        if ($syncRate < 90) {
            $this->sendLowSyncRateAlert($syncRate, $syncedToday, $activeTenants);
        }
        
        // Alert if any tenant hasn't synced in 3 days
        $staleTenants = Tenant::where('is_active', true)
            ->whereDate('last_geography_sync', '<', now()->subDays(3))
            ->get();
        
        if ($staleTenants->isNotEmpty()) {
            $this->sendStaleSyncAlert($staleTenants);
        }
    }
    
    private function sendLowSyncRateAlert(float $rate, int $synced, int $total): void
    {
        Notification::route('slack', config('logging.slack_webhook'))
            ->notify(new LowSyncRateNotification(
                rate: $rate,
                synced: $synced,
                total: $total,
                date: today()->format('Y-m-d')
            ));
        
        // Also send to admin dashboard
        event(new SyncHealthCheckFailed(
            metric: 'sync_rate',
            value: $rate,
            threshold: 90,
            message: "Only {$rate}% of tenants synced today"
        ));
    }
}
```

---

## 🎯 **SCALING FOR MANY TENANTS**

### **Strategy 1: Queue Partitioning**
```php
// Distribute tenants across multiple queues
$queues = ['geography-sync-1', 'geography-sync-2', 'geography-sync-3'];

foreach ($tenants as $index => $tenant) {
    $queue = $queues[$index % count($queues)];
    
    SyncTenantGeography::dispatch($tenant)
        ->onQueue($queue)
        ->delay(now()->addSeconds($index * 10)); // Staggered start
}
```

### **Strategy 2: Batch Processing**
```php
// Process tenants in batches
$tenants->chunk(50)->each(function ($batch, $batchIndex) {
    $batch->each(function ($tenant, $tenantIndex) use ($batchIndex) {
        SyncTenantGeography::dispatch($tenant)
            ->onQueue("geography-sync-batch-{$batchIndex}")
            ->delay(now()->addSeconds($tenantIndex * 5));
    });
});
```

### **Strategy 3: Rate Limiting**
```php
// app/Providers/AppServiceProvider.php
protected function configureGeographySyncQueue()
{
    // Rate limit: 10 syncs per minute per tenant
    RateLimiter::for('geography-sync', function (SyncTenantGeography $job) {
        return Limit::perMinute(10)->by($job->tenant->id);
    });
}
```

---

## 📊 **MONITORING & OBSERVABILITY**

### **Metrics to Track:**
```php
// Push metrics to Prometheus/Grafana
class GeographySyncMetrics
{
    public function recordSyncDuration(float $seconds, string $tenantId): void
    {
        $this->metrics->histogram('geography_sync_duration_seconds', $seconds, [
            'tenant' => $tenantId,
        ]);
    }
    
    public function recordSyncResult(bool $success, string $tenantId): void
    {
        $this->metrics->counter('geography_sync_total', 1, [
            'tenant' => $tenantId,
            'result' => $success ? 'success' : 'failure',
        ]);
    }
    
    public function recordQueueLength(): void
    {
        $length = Redis::llen('queues:geography-sync');
        $this->metrics->gauge('geography_sync_queue_length', $length);
    }
}
```

### **Dashboard Panels:**
1. **Sync Success Rate** (last 7 days)
2. **Average Sync Duration** per tenant
3. **Queue Backlog** over time
4. **Tenants Without Recent Sync** (alerts)
5. **Geographic Change Frequency** (landlord)

---

## 🚀 **DEPLOYMENT PROGRESSION**

### **Phase 1: Pilot (Week 1)**
```bash
# Start with 5 pilot tenants
php artisan geography:setup --tenant=pilot-1
php artisan geography:setup --tenant=pilot-2
# ...

# Enable daily sync for pilot tenants only
php artisan config:set geography.daily_sync_enabled_for=pilot-1,pilot-2,pilot-3,pilot-4,pilot-5
```

### **Phase 2: Gradual Rollout (Week 2)**
```bash
# Add 20 more tenants
php artisan geography:batch-setup --count=20

# Monitor for 24 hours
php artisan geography:health-check --detailed
```

### **Phase 3: Full Rollout (Week 3)**
```bash
# Setup remaining tenants
php artisan geography:setup-all

# Enable daily sync for all
php artisan config:set geography.daily_sync_enabled=true
```

### **Phase 4: Optimization (Week 4)**
```bash
# Analyze performance
php artisan geography:performance-report

# Adjust queue workers based on load
# Scale up/down as needed
```

---

## ✅ **BENEFITS OF DAILY EVENT-DRIVEN SYNC**

### **For Many Tenants:**
1. **✅ Scalable**: Processes tenants in parallel
2. **✅ Reliable**: Retry logic with exponential backoff
3. **✅ Efficient**: Only syncs when changes occur
4. **✅ Monitored**: Full observability with alerts

### **For Data Consistency:**
1. **✅ 24-hour freshness**: All tenants updated daily
2. **✅ Change tracking**: Full audit trail of updates
3. **✅ Error recovery**: Failed syncs automatically retry
4. **✅ Manual override**: Force sync when needed

### **For Operations:**
1. **✅ Low maintenance**: Runs automatically
2. **✅ Easy monitoring**: Dashboard with health checks
3. **✅ Simple scaling**: Add queue workers as needed
4. **✅ Clear alerts**: Get notified of issues

---

## 🎯 **FINAL DECISION: IMPLEMENT DAILY EVENT-DRIVEN SYNC**

**Yes, implement the daily event-driven sync.** For many political parties in Nepal:

1. **Start with Change Tracking** in landlord DB (Day 1)
2. **Implement Async Sync Jobs** with retry logic (Day 2)
3. **Setup Queue Workers** for parallel processing (Day 3)
4. **Configure Daily Schedule** with monitoring (Day 4)
5. **Gradual Rollout** with pilot tenants (Week 1-2)

### **Immediate Action:**
```bash
# 1. Add change tracking table to landlord
php artisan make:migration create_geography_changes_table --database=landlord

# 2. Create the daily sync scheduler
php artisan make:command ScheduleDailyGeographySync

# 3. Create the async sync job
php artisan make:job SyncTenantGeography

# 4. Start with TDD - write failing tests first
```

**This gives you the daily updates needed for many parties while maintaining the architectural simplicity of the "Pragmatic Graft" approach.**