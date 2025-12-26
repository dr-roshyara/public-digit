# 🚀 **Event-Driven Sync Architecture Implementation Plan**

## 🏗️ **Architecture Overview: Event-Driven Sync**

```mermaid
flowchart TB
    %% Style Definitions
    classDef event fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef service fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef queue fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef storage fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    %% Core Components
    subgraph C1[Geography Context - Landlord]
        direction TB
        A1[GeoAdministrativeUnit Model]
        A2[Geography Events]
        A3[Event Dispatcher]
        
        A1 -->|triggers| A2
        A2 -->|publishes to| A3
    end

    subgraph C2[Message Broker Layer]
        direction LR
        B1[Redis Pub/Sub]
        B2[RabbitMQ/Kafka]
        
        A3 -->|events| B1
        A3 -->|events| B2
    end

    subgraph C3[Membership Context - Tenants]
        direction TB
        C1[Event Consumers]
        C2[Tenant Sync Service]
        C3[TenantGeoUnit Model]
        
        B1 -->|consumes| C1
        B2 -->|consumes| C1
        C1 -->|processes| C2
        C2 -->|updates| C3
    end

    subgraph C4[Monitoring & Recovery]
        D1[Sync Dashboard]
        D2[Dead Letter Queue]
        D3[Manual Retry Service]
        
        C2 -->|metrics| D1
        C1 -->|failed events| D2
        D3 -->|retries| D2
    end

    %% Data Flow
    Admin[Landlord Admin] -->|updates| A1
    C3 -->|query| TenantDB[Tenant Databases]
    
    %% Styling
    class A1,A2,A3 storage
    class B1,B2 queue
    class C1,C2,C3 service
    class D1,D2,D3 event
```

## 📋 **Implementation Plan: 4-Week Sprint**

### **Week 1: Foundation - Event System & Models**

#### **1.1 Event Definitions in Geography Context**
```php
// app/Contexts/Geography/Domain/Events/GeographyEvents.php
namespace App\Contexts\Geography\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GeographyUnitCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public int $unitId,
        public string $countryCode,
        public array $unitData,
        public \DateTimeInterface $timestamp
    ) {}
}

class GeographyUnitUpdated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public int $unitId,
        public string $countryCode,
        public array $changedFields,
        public array $oldValues,
        public array $newValues,
        public \DateTimeInterface $timestamp
    ) {}
}

class GeographyUnitDeleted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public int $unitId,
        public string $countryCode,
        public \DateTimeInterface $timestamp
    ) {}
}

class GeographyHierarchyChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public int $unitId,
        public string $countryCode,
        public ?int $oldParentId,
        public ?int $newParentId,
        public \DateTimeInterface $timestamp
    ) {}
}
```

#### **1.2 Event-Aware Geography Model**
```php
// app/Contexts/Geography/Domain/Models/GeoAdministrativeUnit.php (Additions)
namespace App\Contexts\Geography\Domain\Models;

use App\Contexts\Geography\Domain\Events\{
    GeographyUnitCreated,
    GeographyUnitUpdated,
    GeographyUnitDeleted,
    GeographyHierarchyChanged
};

class GeoAdministrativeUnit extends Model
{
    // ... existing code ...
    
    protected static function booted(): void
    {
        static::created(function (self $unit) {
            event(new GeographyUnitCreated(
                unitId: $unit->id,
                countryCode: $unit->country_code,
                unitData: $unit->toEventData(),
                timestamp: now()
            ));
        });

        static::updated(function (self $unit) {
            $changes = $unit->getDirty();
            
            // Special handling for parent_id changes (hierarchy updates)
            if (array_key_exists('parent_id', $changes)) {
                event(new GeographyHierarchyChanged(
                    unitId: $unit->id,
                    countryCode: $unit->country_code,
                    oldParentId: $unit->getOriginal('parent_id'),
                    newParentId: $unit->parent_id,
                    timestamp: now()
                ));
            }
            
            // General field updates
            if (count($changes) > 0) {
                event(new GeographyUnitUpdated(
                    unitId: $unit->id,
                    countryCode: $unit->country_code,
                    changedFields: array_keys($changes),
                    oldValues: array_intersect_key($unit->getOriginal(), $changes),
                    newValues: $changes,
                    timestamp: now()
                ));
            }
        });

        static::deleted(function (self $unit) {
            event(new GeographyUnitDeleted(
                unitId: $unit->id,
                countryCode: $unit->country_code,
                timestamp: now()
            ));
        });
    }
    
    public function toEventData(): array
    {
        return [
            'id' => $this->id,
            'country_code' => $this->country_code,
            'admin_level' => $this->admin_level,
            'admin_type' => $this->admin_type,
            'code' => $this->code,
            'name_local' => $this->name_local,
            'parent_id' => $this->parent_id,
            'is_active' => $this->is_active,
            'valid_from' => $this->valid_from?->toDateString(),
            'valid_to' => $this->valid_to?->toDateString(),
        ];
    }
    
    public function getSyncPayload(): array
    {
        return [
            'action' => 'sync',
            'unit_id' => $this->id,
            'country_code' => $this->country_code,
            'data' => $this->toEventData(),
            'checksum' => md5(json_encode($this->toEventData())),
            'timestamp' => now()->toISOString()
        ];
    }
}
```

#### **1.3 Event Logging Table**
```php
// database/migrations/landlord/2025_01_01_000004_create_geography_event_logs_table.php
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geography_event_logs', function (Blueprint $table) {
            $table->id();
            $table->string('event_type', 50); // created, updated, deleted, hierarchy_changed
            $table->unsignedBigInteger('unit_id');
            $table->char('country_code', 2);
            $table->json('payload')->nullable();
            $table->json('metadata')->nullable();
            $table->string('status', 20)->default('pending'); // pending, processing, completed, failed
            $table->integer('retry_count')->default(0);
            $table->timestamp('processed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
            
            $table->index(['event_type', 'status']);
            $table->index(['unit_id', 'country_code']);
            $table->index(['status', 'created_at']);
        });
    }
};
```

### **Week 2: Message Broker Integration**

#### **2.1 Event Publisher Service**
```php
// app/Contexts/Geography/Application/Services/GeographyEventPublisher.php
namespace App\Contexts\Geography\Application\Services;

use App\Contexts\Geography\Domain\Events\{
    GeographyUnitCreated,
    GeographyUnitUpdated,
    GeographyUnitDeleted,
    GeographyHierarchyChanged
};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;

class GeographyEventPublisher
{
    private const REDIS_CHANNEL = 'geography:events';
    private const DEAD_LETTER_QUEUE = 'geography:events:dlq';
    
    public function publishCreated(GeographyUnitCreated $event): void
    {
        $this->publishEvent('created', $event);
    }
    
    public function publishUpdated(GeographyUnitUpdated $event): void
    {
        $this->publishEvent('updated', $event);
    }
    
    public function publishDeleted(GeographyUnitDeleted $event): void
    {
        $this->publishEvent('deleted', $event);
    }
    
    public function publishHierarchyChanged(GeographyHierarchyChanged $event): void
    {
        $this->publishEvent('hierarchy_changed', $event);
    }
    
    private function publishEvent(string $eventType, object $event): void
    {
        DB::beginTransaction();
        
        try {
            // 1. Log to database (for recovery)
            $logId = DB::table('geography_event_logs')->insertGetId([
                'event_type' => $eventType,
                'unit_id' => $event->unitId,
                'country_code' => $event->countryCode,
                'payload' => json_encode($event),
                'metadata' => json_encode([
                    'published_at' => now()->toISOString(),
                    'event_id' => Str::uuid()->toString(),
                    'source' => 'landlord'
                ]),
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now()
            ]);
            
            // 2. Publish to Redis (immediate delivery)
            $message = [
                'id' => $logId,
                'type' => $eventType,
                'data' => (array) $event,
                'timestamp' => now()->toISOString(),
                'checksum' => $this->generateChecksum($event)
            ];
            
            Redis::publish(self::REDIS_CHANNEL, json_encode($message));
            
            // 3. Update log status
            DB::table('geography_event_logs')
                ->where('id', $logId)
                ->update(['status' => 'published']);
            
            DB::commit();
            
            Log::info("Geography event published", [
                'event_type' => $eventType,
                'unit_id' => $event->unitId,
                'log_id' => $logId
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error("Failed to publish geography event", [
                'event_type' => $eventType,
                'unit_id' => $event->unitId,
                'error' => $e->getMessage()
            ]);
            
            // Send to dead letter queue for manual intervention
            Redis::rpush(self::DEAD_LETTER_QUEUE, json_encode([
                'event' => (array) $event,
                'error' => $e->getMessage(),
                'failed_at' => now()->toISOString()
            ]));
        }
    }
    
    private function generateChecksum(object $event): string
    {
        return md5(json_encode($event) . config('app.key'));
    }
    
    // Bulk publisher for initial sync or batch changes
    public function publishBulkEvents(array $unitIds, string $eventType): void
    {
        $units = GeoAdministrativeUnit::whereIn('id', $unitIds)->get();
        
        foreach ($units->chunk(100) as $chunk) {
            foreach ($chunk as $unit) {
                $event = match($eventType) {
                    'updated' => new GeographyUnitUpdated(
                        $unit->id,
                        $unit->country_code,
                        ['bulk_update'],
                        [],
                        $unit->toEventData(),
                        now()
                    ),
                    default => new GeographyUnitUpdated(
                        $unit->id,
                        $unit->country_code,
                        ['bulk_sync'],
                        [],
                        $unit->toEventData(),
                        now()
                    )
                };
                
                $this->publishUpdated($event);
            }
        }
    }
}
```

#### **2.2 Event Listener Registration**
```php
// app/Providers/GeographyEventServiceProvider.php
namespace App\Providers;

use App\Contexts\Geography\Application\Services\GeographyEventPublisher;
use App\Contexts\Geography\Domain\Events\{
    GeographyUnitCreated,
    GeographyUnitUpdated,
    GeographyUnitDeleted,
    GeographyHierarchyChanged
};
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class GeographyEventServiceProvider extends ServiceProvider
{
    protected $listen = [
        GeographyUnitCreated::class => [
            GeographyEventPublisher::class . '@publishCreated',
        ],
        GeographyUnitUpdated::class => [
            GeographyEventPublisher::class . '@publishUpdated',
        ],
        GeographyUnitDeleted::class => [
            GeographyEventPublisher::class . '@publishDeleted',
        ],
        GeographyHierarchyChanged::class => [
            GeographyEventPublisher::class . '@publishHierarchyChanged',
        ],
    ];
    
    public function boot(): void
    {
        parent::boot();
        
        // Register Redis subscription
        $this->app->booted(function () {
            if (config('geography.events.enabled')) {
                $this->startEventConsumers();
            }
        });
    }
    
    private function startEventConsumers(): void
    {
        // This would start background workers in production
        // For development, we'll use queue workers
        if ($this->app->runningInConsole()) {
            return;
        }
        
        // Start Redis subscription in background process
        // In production: Supervisor manages this
        // $this->app->make(GeographyEventConsumer::class)->start();
    }
}
```

### **Week 3: Tenant-Side Event Consumers**

#### **3.1 Tenant Event Consumer Service**
```php
// app/Contexts/Membership/Application/Services/TenantGeographyEventConsumer.php
namespace App\Contexts\Membership\Application\Services;

use App\Models\Tenant;
use App\Contexts\Membership\Domain\Models\TenantGeoUnit;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class TenantGeographyEventConsumer
{
    private const REDIS_CHANNEL = 'geography:events';
    private const BATCH_SIZE = 50;
    private const MAX_RETRIES = 3;
    
    private array $tenantCache = [];
    
    public function start(): void
    {
        Log::info('Starting geography event consumer');
        
        Redis::subscribe([self::REDIS_CHANNEL], function ($message) {
            $this->processMessage(json_decode($message, true));
        });
    }
    
    public function processBatch(array $messages): array
    {
        $results = [
            'processed' => 0,
            'succeeded' => 0,
            'failed' => 0,
            'skipped' => 0
        ];
        
        foreach ($messages as $message) {
            try {
                $result = $this->processMessage($message);
                
                if ($result === true) {
                    $results['succeeded']++;
                } elseif ($result === false) {
                    $results['failed']++;
                } else {
                    $results['skipped']++;
                }
                
                $results['processed']++;
                
            } catch (\Exception $e) {
                Log::error('Failed to process geography event', [
                    'message' => $message,
                    'error' => $e->getMessage()
                ]);
                $results['failed']++;
            }
        }
        
        return $results;
    }
    
    private function processMessage(array $message): bool
    {
        if (!$this->validateMessage($message)) {
            Log::warning('Invalid geography event message', ['message' => $message]);
            return false;
        }
        
        $eventType = $message['type'];
        $unitData = $message['data'];
        $unitId = $unitData['unitId'];
        $countryCode = $unitData['countryCode'];
        
        // Find all tenants using this country
        $tenants = $this->getTenantsByCountry($countryCode);
        
        if (empty($tenants)) {
            Log::debug('No tenants found for country', ['country' => $countryCode]);
            return true; // No action needed
        }
        
        $successCount = 0;
        
        foreach ($tenants as $tenant) {
            try {
                tenancy()->initialize($tenant);
                
                $success = match($eventType) {
                    'created' => $this->handleUnitCreated($tenant, $unitData),
                    'updated' => $this->handleUnitUpdated($tenant, $unitData),
                    'deleted' => $this->handleUnitDeleted($tenant, $unitData),
                    'hierarchy_changed' => $this->handleHierarchyChanged($tenant, $unitData),
                    default => false
                };
                
                if ($success) {
                    $successCount++;
                    
                    // Update event log
                    $this->updateEventLog($message['id'] ?? null, $tenant->id, 'completed');
                }
                
            } catch (\Exception $e) {
                Log::error('Failed to process event for tenant', [
                    'tenant_id' => $tenant->id,
                    'event_type' => $eventType,
                    'unit_id' => $unitId,
                    'error' => $e->getMessage()
                ]);
                
                $this->updateEventLog($message['id'] ?? null, $tenant->id, 'failed', $e->getMessage());
            }
        }
        
        return $successCount > 0;
    }
    
    private function handleUnitCreated(Tenant $tenant, array $unitData): bool
    {
        // Check if already exists
        $exists = TenantGeoUnit::where('tenant_id', $tenant->id)
            ->where('external_geo_id', $unitData['unitId'])
            ->exists();
        
        if ($exists) {
            return true; // Already mirrored
        }
        
        // Find parent in tenant DB
        $parentId = null;
        if (!empty($unitData['parentId'])) {
            $parent = TenantGeoUnit::where('tenant_id', $tenant->id)
                ->where('external_geo_id', $unitData['parentId'])
                ->first();
            $parentId = $parent->id ?? null;
        }
        
        // Create the unit
        TenantGeoUnit::create([
            'tenant_id' => $tenant->id,
            'external_geo_id' => $unitData['unitId'],
            'external_code' => $unitData['code'] ?? null,
            'unit_type' => 'official',
            'admin_level' => $unitData['adminLevel'] ?? 1,
            'admin_type' => $unitData['adminType'] ?? 'unit',
            'parent_id' => $parentId,
            'code' => "OFFICIAL-{$unitData['countryCode']}-{$unitData['code']}",
            'name_local' => $unitData['nameLocal'] ?? ['en' => 'New Unit'],
            'is_active' => $unitData['isActive'] ?? true,
            'geo_path' => $this->calculateGeoPath($parentId, $unitData['unitId'])
        ]);
        
        // Clear cache
        Cache::tags(["tenant_{$tenant->id}_geography"])->flush();
        
        return true;
    }
    
    private function handleUnitUpdated(Tenant $tenant, array $unitData): bool
    {
        $unit = TenantGeoUnit::where('tenant_id', $tenant->id)
            ->where('external_geo_id', $unitData['unitId'])
            ->first();
        
        if (!$unit) {
            Log::warning('Unit not found for update', [
                'tenant_id' => $tenant->id,
                'external_geo_id' => $unitData['unitId']
            ]);
            return false;
        }
        
        $updateData = [];
        
        // Map changed fields
        if (isset($unitData['nameLocal'])) {
            $updateData['name_local'] = $unitData['nameLocal'];
        }
        
        if (isset($unitData['isActive'])) {
            $updateData['is_active'] = $unitData['isActive'];
        }
        
        if (isset($unitData['code'])) {
            $updateData['external_code'] = $unitData['code'];
        }
        
        if (!empty($updateData)) {
            $unit->update($updateData);
            
            // Clear cache
            Cache::tags(["tenant_{$tenant->id}_geography"])->flush();
        }
        
        return true;
    }
    
    private function handleUnitDeleted(Tenant $tenant, array $unitData): bool
    {
        $unit = TenantGeoUnit::where('tenant_id', $tenant->id)
            ->where('external_geo_id', $unitData['unitId'])
            ->first();
        
        if (!$unit) {
            return true; // Already deleted
        }
        
        // Soft delete or deactivate
        if ($unit->members()->exists()) {
            // Has members, deactivate instead of delete
            $unit->update(['is_active' => false]);
        } else {
            // No members, safe to delete
            $unit->delete();
        }
        
        // Clear cache
        Cache::tags(["tenant_{$tenant->id}_geography"])->flush();
        
        return true;
    }
    
    private function handleHierarchyChanged(Tenant $tenant, array $unitData): bool
    {
        $unit = TenantGeoUnit::where('tenant_id', $tenant->id)
            ->where('external_geo_id', $unitData['unitId'])
            ->first();
        
        if (!$unit) {
            return false;
        }
        
        // Find new parent in tenant DB
        $newParentId = null;
        if (!empty($unitData['newParentId'])) {
            $newParent = TenantGeoUnit::where('tenant_id', $tenant->id)
                ->where('external_geo_id', $unitData['newParentId'])
                ->first();
            $newParentId = $newParent->id ?? null;
        }
        
        // Update parent and recalculate geo_path for all descendants
        DB::transaction(function () use ($unit, $newParentId) {
            $oldPath = $unit->geo_path;
            
            $unit->update([
                'parent_id' => $newParentId,
                'geo_path' => $this->calculateGeoPath($newParentId, $unit->external_geo_id)
            ]);
            
            // Update paths for all descendants
            if ($oldPath && $unit->children()->exists()) {
                $this->updateDescendantPaths($unit);
            }
        });
        
        // Clear cache
        Cache::tags(["tenant_{$tenant->id}_geography"])->flush();
        
        return true;
    }
    
    private function updateDescendantPaths(TenantGeoUnit $parent): void
    {
        $children = $parent->children()->with('children')->get();
        
        foreach ($children as $child) {
            $child->update([
                'geo_path' => $parent->geo_path . '.' . $child->external_geo_id
            ]);
            
            if ($child->children()->exists()) {
                $this->updateDescendantPaths($child);
            }
        }
    }
    
    private function calculateGeoPath(?int $parentId, int $unitId): string
    {
        if (!$parentId) {
            return (string) $unitId;
        }
        
        $parent = TenantGeoUnit::find($parentId);
        return $parent ? $parent->geo_path . '.' . $unitId : (string) $unitId;
    }
    
    private function getTenantsByCountry(string $countryCode): array
    {
        $cacheKey = "tenants:country:{$countryCode}";
        
        return Cache::remember($cacheKey, 300, function () use ($countryCode) {
            return Tenant::where('geography_country', $countryCode)
                ->orWhere('metadata->geography_countries', 'like', "%{$countryCode}%")
                ->get()
                ->all();
        });
    }
    
    private function validateMessage(array $message): bool
    {
        return isset(
            $message['type'],
            $message['data']['unitId'],
            $message['data']['countryCode']
        );
    }
    
    private function updateEventLog(
        ?int $logId, 
        int $tenantId, 
        string $status, 
        ?string $error = null
    ): void {
        if (!$logId) {
            return;
        }
        
        DB::table('geography_event_logs')
            ->where('id', $logId)
            ->update([
                'status' => $status,
                'processed_at' => $status === 'completed' ? now() : null,
                'error_message' => $error,
                'updated_at' => now()
            ]);
    }
}
```

#### **3.2 Tenant Sync Queue Worker**
```php
// app/Console/Commands/ProcessGeographyEvents.php
namespace App\Console\Commands;

use App\Contexts\Membership\Application\Services\TenantGeographyEventConsumer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

class ProcessGeographyEvents extends Command
{
    protected $signature = 'geography:process-events 
                            {--batch=50 : Number of events to process}
                            {--timeout=60 : Timeout in seconds}
                            {--once : Process one batch and exit}';
    
    protected $description = 'Process geography events from Redis';
    
    public function handle(TenantGeographyEventConsumer $consumer): int
    {
        $this->info('Starting geography event processor...');
        
        $processed = 0;
        $startTime = time();
        
        while (true) {
            // Check timeout
            if ((time() - $startTime) > $this->option('timeout')) {
                $this->warn('Timeout reached');
                break;
            }
            
            // Get batch of messages
            $messages = [];
            for ($i = 0; $i < $this->option('batch'); $i++) {
                $message = Redis::lpop('geography:events:queue');
                if (!$message) {
                    break;
                }
                $messages[] = json_decode($message, true);
            }
            
            if (empty($messages)) {
                if ($this->option('once')) {
                    break;
                }
                sleep(1); // Wait for new messages
                continue;
            }
            
            // Process batch
            $results = $consumer->processBatch($messages);
            
            $processed += $results['processed'];
            
            $this->info(sprintf(
                'Processed batch: %d total, %d succeeded, %d failed, %d skipped',
                $results['processed'],
                $results['succeeded'],
                $results['failed'],
                $results['skipped']
            ));
            
            if ($this->option('once')) {
                break;
            }
        }
        
        $this->info("Total processed: {$processed} events");
        
        return Command::SUCCESS;
    }
}
```

### **Week 4: Monitoring, Recovery & Testing**

#### **4.1 Sync Dashboard & Monitoring**
```php
// app/Http/Controllers/Admin/GeographySyncController.php
namespace App\Http\Controllers\Admin;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class GeographySyncController
{
    public function dashboard()
    {
        $stats = [
            'pending_events' => DB::table('geography_event_logs')
                ->where('status', 'pending')
                ->count(),
            'failed_events' => DB::table('geography_event_logs')
                ->where('status', 'failed')
                ->where('created_at', '>', now()->subDay())
                ->count(),
            'tenants_out_of_sync' => $this->getOutOfSyncTenants(),
            'queue_size' => Redis::llen('geography:events:queue'),
            'dlq_size' => Redis::llen('geography:events:dlq'),
        ];
        
        $recentEvents = DB::table('geography_event_logs')
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();
        
        return view('admin.geography-sync.dashboard', compact('stats', 'recentEvents'));
    }
    
    public function retryFailedEvents(Request $request)
    {
        $eventIds = $request->input('event_ids', []);
        
        $events = DB::table('geography_event_logs')
            ->whereIn('id', $eventIds)
            ->where('status', 'failed')
            ->get();
        
        foreach ($events as $event) {
            $this->retryEvent($event);
        }
        
        return redirect()->back()->with('success', 'Retry initiated');
    }
    
    public function forceResyncTenant(Tenant $tenant)
    {
        // Trigger full resync for tenant
        \App\Services\GeographyMirrorService::mirrorCountryToTenant(
            $tenant->geography_country,
            $tenant
        );
        
        return response()->json(['success' => true]);
    }
    
    private function getOutOfSyncTenants(): array
    {
        // Compare landlord version with tenant version
        $landlordVersion = DB::table('geography_versions')
            ->orderBy('created_at', 'desc')
            ->value('version_hash');
        
        return Tenant::where('geography_version', '!=', $landlordVersion)
            ->orWhereNull('geography_version')
            ->pluck('name', 'id')
            ->toArray();
    }
}
```

#### **4.2 Comprehensive Test Suite**
```php
// tests/Feature/Geography/EventSyncTest.php
namespace Tests\Feature\Geography;

use App\Contexts\Geography\Domain\Events\GeographyUnitUpdated;
use App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit;
use App\Models\Tenant;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class EventSyncTest extends TestCase
{
    public function test_unit_update_triggers_event()
    {
        Event::fake();
        
        $unit = GeoAdministrativeUnit::first();
        $unit->update(['name_local' => ['en' => 'Updated Name']]);
        
        Event::assertDispatched(GeographyUnitUpdated::class, function ($event) use ($unit) {
            return $event->unitId === $unit->id;
        });
    }
    
    public function test_event_published_to_redis()
    {
        Redis::shouldReceive('publish')
            ->once()
            ->with('geography:events', \Mockery::type('string'));
        
        $unit = GeoAdministrativeUnit::first();
        $unit->update(['name_local' => ['en' => 'Test Update']]);
    }
    
    public function test_tenant_receives_and_processes_event()
    {
        // Setup
        $tenant = Tenant::factory()->create([
            'geography_country' => 'NP'
        ]);
        
        $landlordUnit = GeoAdministrativeUnit::factory()->create([
            'country_code' => 'NP'
        ]);
        
        // Mirror unit to tenant
        $mirrorService = app(\App\Services\GeographyMirrorService::class);
        $mirrorService->mirrorCountryToTenant('NP', $tenant);
        
        // Simulate event
        $eventData = [
            'type' => 'updated',
            'data' => [
                'unitId' => $landlordUnit->id,
                'countryCode' => 'NP',
                'nameLocal' => ['en' => 'Updated Name'],
                'isActive' => true
            ]
        ];
        
        // Process event
        $consumer = app(\App\Contexts\Membership\Application\Services\TenantGeographyEventConsumer::class);
        $result = $consumer->processMessage($eventData);
        
        $this->assertTrue($result);
        
        // Verify tenant unit was updated
        tenancy()->initialize($tenant);
        $tenantUnit = \App\Contexts\Membership\Domain\Models\TenantGeoUnit::first();
        $this->assertEquals('Updated Name', $tenantUnit->getName());
    }
    
    public function test_bulk_event_processing()
    {
        $messages = [];
        
        for ($i = 0; $i < 10; $i++) {
            $messages[] = [
                'type' => 'updated',
                'data' => [
                    'unitId' => $i + 1,
                    'countryCode' => 'NP',
                    'nameLocal' => ['en' => 'Bulk Update ' . $i]
                ]
            ];
        }
        
        $consumer = app(\App\Contexts\Membership\Application\Services\TenantGeographyEventConsumer::class);
        $results = $consumer->processBatch($messages);
        
        $this->assertEquals(10, $results['processed']);
    }
}
```

#### **4.3 Configuration File**
```php
// config/geography.php
return [
    'events' => [
        'enabled' => env('GEOGRAPHY_EVENTS_ENABLED', true),
        
        'broker' => env('GEOGRAPHY_EVENTS_BROKER', 'redis'), // redis, rabbitmq, kafka
        
        'channels' => [
            'main' => 'geography:events',
            'dlq' => 'geography:events:dlq',
            'retry' => 'geography:events:retry',
        ],
        
        'processing' => [
            'batch_size' => 50,
            'max_retries' => 3,
            'retry_delay' => 60, // seconds
            'timeout' => 300, // seconds
        ],
        
        'tenants' => [
            'cache_ttl' => 300, // seconds
            'sync_timeout' => 30, // seconds per tenant
        ],
    ],
    
    'sync' => [
        'initial_batch_size' => 1000,
        'incremental_batch_size' => 100,
        'parallel_tenants' => 5,
    ],
    
    'monitoring' => [
        'dashboard_enabled' => true,
        'alert_thresholds' => [
            'pending_events' => 1000,
            'failed_events_per_hour' => 10,
            'sync_lag_minutes' => 5,
        ],
    ],
];
```

#### **4.4 Supervisor Configuration**
```ini
; /etc/supervisor/conf.d/geography-events.conf
[program:geography-events]
command=php /var/www/artisan geography:process-events --timeout=300
process_name=%(program_name)s_%(process_num)02d
numprocs=3
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/log/geography-events.log
stopwaitsecs=60
```

## 🚀 **Deployment Checklist**

### **Phase 1: Preparation (Day 1-2)**
- [ ] Install Redis/RabbitMQ
- [ ] Configure Supervisor for event workers
- [ ] Create monitoring dashboard
- [ ] Backup existing geography data

### **Phase 2: Dry Run (Day 3)**
- [ ] Enable events in staging only
- [ ] Test with 1-2 tenant databases
- [ ] Verify event delivery and processing
- [ ] Test failure scenarios and recovery

### **Phase 3: Gradual Rollout (Day 4-5)**
- [ ] Enable for new tenants only
- [ ] Monitor performance and errors
- [ ] Gradually enable for existing tenants
- [ ] Compare sync times with old method

### **Phase 4: Full Deployment (Day 6-7)**
- [ ] Enable for all tenants
- [ ] Set up alerts and monitoring
- [ ] Document procedures for manual intervention
- [ ] Create runbook for common issues

## 📊 **Performance Expectations**

| **Metric** | **Polling Sync** | **Event-Driven Sync** |
|------------|------------------|----------------------|
| **Latency** | 5-60 minutes | 1-10 seconds |
| **Database Load** | High (periodic scans) | Low (event-driven) |
| **Network Traffic** | High (full sync) | Low (delta only) |
| **Tenant Impact** | High during sync | Minimal, distributed |
| **Complexity** | Low | Medium-High |

## 🛡️ **Failure Scenarios & Recovery**

### **Scenario 1: Event Lost**
```bash
# Check Redis queue
redis-cli LLEN geography:events:queue

# Reprocess from event log
php artisan geography:reprocess-events --from-log --days=1
```

### **Scenario 2: Tenant Out of Sync**
```bash
# Force resync single tenant
php artisan geography:mirror tenant_uml --force

# Compare versions
php artisan geography:check-sync tenant_uml
```

### **Scenario 3: High Failure Rate**
```php
// Implement circuit breaker
if ($failureRate > 0.1) { // 10% failure rate
    $this->disableEventProcessing();
    $this->switchToPollingMode();
    $this->alertAdmin('High failure rate detected');
}
```

## 🎯 **Key Success Metrics**

1. **Event Delivery Rate**: >99.9%
2. **Sync Latency**: <30 seconds for 95% of events
3. **Failure Rate**: <1% of events
4. **Recovery Time**: <5 minutes for any issue
5. **Tenant Uptime**: 100% during sync operations

**This architecture gives you near real-time sync while maintaining tenant isolation and performance. The event-driven approach scales better than polling as you add more tenants and countries.**