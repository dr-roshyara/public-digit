# 🚀 **WEBSOCKET/REAL-TIME UPDATES FOR PROVISIONING STATUS**

Let's implement a comprehensive WebSocket solution for real-time provisioning status updates using Laravel Reverb (Laravel's official WebSocket server) and Laravel Echo.

## **1. LARAVEL REVERB CONFIGURATION**

### **1.1 Install Required Packages**

```bash
composer require laravel/reverb
composer require pusher/pusher-php-server
npm install --save-dev laravel-echo pusher-js
```

### **1.2 Reverb Configuration**

**File: `config/reverb.php`**

```php
<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Reverb Servers
    |--------------------------------------------------------------------------
    |
    | This array contains the configuration for each Reverb server that
    | should be run. You can run multiple servers with different
    | configurations, such as for different applications or environments.
    |
    */

    'servers' => [
        [
            'id' => env('REVERB_SERVER_ID', 'provisioning-platform'),
            'host' => env('REVERB_HOST', '0.0.0.0'),
            'port' => env('REVERB_PORT', 8080),
            'hostname' => env('REVERB_HOSTNAME', 'localhost'),
            'options' => [
                'tls' => [],
            ],
            'max_request_size' => env('REVERB_MAX_REQUEST_SIZE', 10_000),
            'scaling' => [
                'enabled' => env('REVERB_SCALING_ENABLED', false),
                'channel' => env('REVERB_SCALING_CHANNEL', 'reverb'),
                'server' => [
                    'url' => env('REDIS_URL', 'redis://127.0.0.1:6379'),
                    'options' => [
                        'parameters' => [
                            'password' => env('REDIS_PASSWORD'),
                            'database' => env('REDIS_DB', '0'),
                        ],
                    ],
                ],
            ],
            'pulse_ingest_interval' => env('REVERB_PULSE_INGEST_INTERVAL', 15),
            'apps' => [
                [
                    'key' => env('REVERB_APP_KEY', 'provisioning-platform-key'),
                    'secret' => env('REVERB_APP_SECRET'),
                    'app_id' => env('REVERB_APP_ID', 'provisioning-platform'),
                    'allowed_origins' => ['*'],
                    'ping_interval' => env('REVERB_PING_INTERVAL', 60),
                    'max_message_size' => env('REVERB_MAX_MESSAGE_SIZE', 10_000),
                ],
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Reverb Applications
    |--------------------------------------------------------------------------
    |
    | Here you may specify how Reverb applications are managed. You can
    | choose to manage them dynamically or use a static configuration.
    |
    */

    'applications' => [
        'default' => 'static',
    ],

    /*
    |--------------------------------------------------------------------------
    | Monitoring
    |--------------------------------------------------------------------------
    |
    | Reverb integrates with Laravel Pulse to monitor your WebSocket server.
    | You can enable or disable this integration here.
    |
    */

    'monitoring' => [
        'enabled' => env('REVERB_MONITORING_ENABLED', true),
        'dashboard' => env('REVERB_DASHBOARD', true),
    ],
];
```

### **1.3 Broadcasting Configuration**

**File: `config/broadcasting.php`**

```php
<?php

return [
    'default' => env('BROADCAST_DRIVER', 'reverb'),

    'connections' => [
        'reverb' => [
            'driver' => 'reverb',
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'app_id' => env('REVERB_APP_ID'),
            'options' => [
                'host' => env('REVERB_HOST', '127.0.0.1'),
                'port' => env('REVERB_PORT', 8080),
                'scheme' => env('REVERB_SCHEME', 'http'),
                'useTLS' => env('REVERB_SCHEME') === 'https',
            ],
            'client_options' => [
                // Guzzle client options: https://docs.guzzlephp.org/en/stable/request-options.html
            ],
        ],

        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'host' => env('PUSHER_HOST') ?: 'api-'.env('PUSHER_APP_CLUSTER', 'mt1').'.pusher.com',
                'port' => env('PUSHER_PORT', 443),
                'scheme' => env('PUSHER_SCHEME', 'https'),
                'encrypted' => true,
                'useTLS' => env('PUSHER_SCHEME', 'https') === 'https',
            ],
            'client_options' => [
                // Guzzle client options: https://docs.guzzlephp.org/en/stable/request-options.html
            ],
        ],

        'log' => [
            'driver' => 'log',
        ],

        'null' => [
            'driver' => 'null',
        ],
    ],
];
```

## **2. DOMAIN EVENTS FOR PROVISIONING**

### **2.1 Provisioning Events**

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/Events/ProvisioningEvent.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\Events;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;
use App\Domain\Platform\Shared\Events\DomainEvent;

abstract class ProvisioningEvent extends DomainEvent
{
    protected TenantAggregate $tenant;
    protected string $eventType;
    protected array $metadata;
    
    public function __construct(
        TenantAggregate $tenant,
        string $eventType,
        array $metadata = []
    ) {
        parent::__construct();
        
        $this->tenant = $tenant;
        $this->eventType = $eventType;
        $this->metadata = $metadata;
    }
    
    public function getTenant(): TenantAggregate
    {
        return $this->tenant;
    }
    
    public function getEventType(): string
    {
        return $this->eventType;
    }
    
    public function getMetadata(): array
    {
        return $this->metadata;
    }
    
    public function toBroadcast(): array
    {
        return [
            'tenant_id' => $this->tenant->getId(),
            'tenant_slug' => $this->tenant->getSlug(),
            'tenant_name' => $this->tenant->getName(),
            'event_type' => $this->eventType,
            'metadata' => $this->metadata,
            'timestamp' => $this->occurredOn->format('c'),
            'event_id' => $this->eventId,
        ];
    }
}
```

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/Events/TenantProvisioningStarted.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\Events;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;

class TenantProvisioningStarted extends ProvisioningEvent implements ShouldBroadcast
{
    public function __construct(
        TenantAggregate $tenant,
        array $metadata = []
    ) {
        parent::__construct($tenant, 'provisioning_started', $metadata);
    }
    
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->tenant->getId()}.provisioning"),
            new Channel("admin.provisioning"),
            new Channel("user.{$this->getUserId()}.notifications"),
        ];
    }
    
    public function broadcastAs(): string
    {
        return 'provisioning.started';
    }
    
    public function broadcastWith(): array
    {
        return array_merge($this->toBroadcast(), [
            'message' => "Provisioning started for tenant {$this->tenant->getName()}",
            'severity' => 'info',
            'actions' => [
                'view_tenant' => route('admin.tenants.show', $this->tenant->getId()),
                'view_logs' => route('admin.tenants.provisioning-logs', $this->tenant->getId()),
            ],
        ]);
    }
    
    private function getUserId(): ?string
    {
        // Get the user who triggered the provisioning
        return $this->metadata['triggered_by'] ?? null;
    }
}
```

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/Events/TenantProvisioningProgress.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\Events;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;

class TenantProvisioningProgress extends ProvisioningEvent implements ShouldBroadcast
{
    public function __construct(
        TenantAggregate $tenant,
        string $stage,
        int $progress,
        string $message,
        array $metadata = []
    ) {
        $metadata = array_merge($metadata, [
            'stage' => $stage,
            'progress' => $progress,
            'message' => $message,
        ]);
        
        parent::__construct($tenant, 'provisioning_progress', $metadata);
    }
    
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->tenant->getId()}.provisioning"),
            new Channel("admin.provisioning.progress"),
            new PrivateChannel("user.{$this->getUserId()}.provisioning"),
        ];
    }
    
    public function broadcastAs(): string
    {
        return 'provisioning.progress';
    }
    
    public function broadcastWith(): array
    {
        return array_merge($this->toBroadcast(), [
            'stage' => $this->metadata['stage'],
            'progress' => $this->metadata['progress'],
            'message' => $this->metadata['message'],
            'timestamp' => now()->format('H:i:s'),
        ]);
    }
}
```

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/Events/TenantProvisioningCompleted.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\Events;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;

class TenantProvisioningCompleted extends ProvisioningEvent implements ShouldBroadcast
{
    public function __construct(
        TenantAggregate $tenant,
        array $result,
        array $metadata = []
    ) {
        $metadata = array_merge($metadata, [
            'result' => $result,
            'duration' => $result['duration'] ?? null,
            'schema_hash' => $result['schema_hash'] ?? null,
        ]);
        
        parent::__construct($tenant, 'provisioning_completed', $metadata);
    }
    
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->tenant->getId()}.provisioning"),
            new Channel("admin.provisioning"),
            new Channel("admin.notifications"),
            new PrivateChannel("user.{$this->getUserId()}.notifications"),
        ];
    }
    
    public function broadcastAs(): string
    {
        return 'provisioning.completed';
    }
    
    public function broadcastWith(): array
    {
        return array_merge($this->toBroadcast(), [
            'message' => "Provisioning completed for tenant {$this->tenant->getName()}",
            'severity' => 'success',
            'duration' => $this->metadata['duration'],
            'schema_hash' => $this->metadata['schema_hash'],
            'actions' => [
                'view_tenant' => route('admin.tenants.show', $this->tenant->getId()),
                'test_connection' => route('admin.tenants.test-connection', $this->tenant->getId()),
                'detect_drift' => route('admin.tenants.detect-drift', $this->tenant->getId()),
            ],
        ]);
    }
}
```

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/Events/TenantProvisioningFailed.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\Events;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;

class TenantProvisioningFailed extends ProvisioningEvent implements ShouldBroadcast
{
    public function __construct(
        TenantAggregate $tenant,
        string $error,
        array $logs = [],
        array $metadata = []
    ) {
        $metadata = array_merge($metadata, [
            'error' => $error,
            'logs' => $logs,
        ]);
        
        parent::__construct($tenant, 'provisioning_failed', $metadata);
    }
    
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->tenant->getId()}.provisioning"),
            new Channel("admin.provisioning.errors"),
            new Channel("admin.notifications"),
            new PrivateChannel("user.{$this->getUserId()}.notifications"),
        ];
    }
    
    public function broadcastAs(): string
    {
        return 'provisioning.failed';
    }
    
    public function broadcastWith(): array
    {
        return array_merge($this->toBroadcast(), [
            'message' => "Provisioning failed for tenant {$this->tenant->getName()}",
            'severity' => 'error',
            'error' => $this->metadata['error'],
            'logs' => array_slice($this->metadata['logs'], -10), // Last 10 log entries
            'actions' => [
                'view_tenant' => route('admin.tenants.show', $this->tenant->getId()),
                'view_logs' => route('admin.tenants.provisioning-logs', $this->tenant->getId()),
                'retry' => route('admin.tenants.retry-provisioning', $this->tenant->getId()),
            ],
        ]);
    }
}
```

### **2.2 Migration Layer Events**

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/Events/MigrationLayerApplied.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\Events;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;

class MigrationLayerApplied extends ProvisioningEvent implements ShouldBroadcast
{
    public function __construct(
        TenantAggregate $tenant,
        string $layer,
        array $migrations,
        string $schemaHash,
        array $metadata = []
    ) {
        $metadata = array_merge($metadata, [
            'layer' => $layer,
            'migrations' => $migrations,
            'schema_hash' => $schemaHash,
            'migration_count' => count($migrations),
        ]);
        
        parent::__construct($tenant, 'migration_layer_applied', $metadata);
    }
    
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->tenant->getId()}.provisioning"),
            new Channel("admin.migrations.{$this->metadata['layer']}"),
            new PrivateChannel("user.{$this->getUserId()}.provisioning"),
        ];
    }
    
    public function broadcastAs(): string
    {
        return 'migration.layer.applied';
    }
    
    public function broadcastWith(): array
    {
        return array_merge($this->toBroadcast(), [
            'layer' => $this->metadata['layer'],
            'migration_count' => $this->metadata['migration_count'],
            'schema_hash' => $this->metadata['schema_hash'],
            'message' => "Applied {$this->metadata['migration_count']} migrations for {$this->metadata['layer']} layer",
        ]);
    }
}
```

### **2.3 Schema Management Events**

**File: `app/Domain/Platform/Admin/Contexts/SchemaManagement/Events/SchemaDriftDetected.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\SchemaManagement\Events;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;
use App\Domain\Platform\Shared\Events\DomainEvent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class SchemaDriftDetected extends DomainEvent implements ShouldBroadcast
{
    protected TenantAggregate $tenant;
    protected array $driftDetails;
    protected string $severity;
    
    public function __construct(
        TenantAggregate $tenant,
        array $driftDetails,
        string $severity = 'medium'
    ) {
        parent::__construct();
        
        $this->tenant = $tenant;
        $this->driftDetails = $driftDetails;
        $this->severity = $severity;
    }
    
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->tenant->getId()}.schema"),
            new Channel("admin.schema.drift"),
            new Channel("admin.notifications"),
        ];
    }
    
    public function broadcastAs(): string
    {
        return 'schema.drift.detected';
    }
    
    public function broadcastWith(): array
    {
        return [
            'tenant_id' => $this->tenant->getId(),
            'tenant_slug' => $this->tenant->getSlug(),
            'tenant_name' => $this->tenant->getName(),
            'drift_details' => $this->driftDetails,
            'severity' => $this->severity,
            'total_changes' => $this->countTotalChanges(),
            'message' => "Schema drift detected for tenant {$this->tenant->getName()}",
            'timestamp' => $this->occurredOn->format('c'),
            'actions' => [
                'view_drift' => route('admin.tenants.drift-details', $this->tenant->getId()),
                'repair_drift' => route('admin.tenants.repair-drift', $this->tenant->getId()),
            ],
        ];
    }
    
    private function countTotalChanges(): int
    {
        $count = 0;
        $details = $this->driftDetails;
        
        $count += count($details['tables']['added'] ?? []);
        $count += count($details['tables']['removed'] ?? []);
        $count += count($details['tables']['modified'] ?? []);
        $count += count($details['columns']['added'] ?? []);
        $count += count($details['columns']['removed'] ?? []);
        $count += count($details['columns']['modified'] ?? []);
        
        return $count;
    }
}
```

## **3. EVENT LISTENERS & BROADCASTING**

### **3.1 Event Service Provider**

**File: `app/Providers/EventServiceProvider.php`**

```php
<?php

namespace App\Providers;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningStarted;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningProgress;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningCompleted;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningFailed;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\MigrationLayerApplied;
use App\Domain\Platform\Admin\Contexts\SchemaManagement\Events\SchemaDriftDetected;
use App\Domain\Platform\Shared\Events\DomainEventDispatcher;
use App\Infrastructure\Platform\Shared\Events\LaravelEventDispatcher;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        TenantProvisioningStarted::class => [
            \App\Listeners\Provisioning\LogProvisioningStart::class,
            \App\Listeners\Provisioning\SendProvisioningNotification::class,
            \App\Listeners\Provisioning\UpdateProvisioningStatus::class,
        ],
        
        TenantProvisioningProgress::class => [
            \App\Listeners\Provisioning\LogProvisioningProgress::class,
            \App\Listeners\Provisioning\UpdateProgressInCache::class,
        ],
        
        TenantProvisioningCompleted::class => [
            \App\Listeners\Provisioning\LogProvisioningCompletion::class,
            \App\Listeners\Provisioning\SendCompletionNotification::class,
            \App\Listeners\Provisioning\UpdateTenantStatus::class,
            \App\Listeners\Provisioning\CreateInitialSchemaSnapshot::class,
        ],
        
        TenantProvisioningFailed::class => [
            \App\Listeners\Provisioning\LogProvisioningFailure::class,
            \App\Listeners\Provisioning\SendFailureNotification::class,
            \App\Listeners\Provisioning\UpdateFailureStatus::class,
            \App\Listeners\Provisioning\CleanupFailedProvisioning::class,
        ],
        
        MigrationLayerApplied::class => [
            \App\Listeners\Provisioning\LogMigrationLayer::class,
            \App\Listeners\Provisioning\UpdateMigrationHistory::class,
        ],
        
        SchemaDriftDetected::class => [
            \App\Listeners\Schema\LogSchemaDrift::class,
            \App\Listeners\Schema\SendDriftNotification::class,
            \App\Listeners\Schema\UpdateDriftDetectionTimestamp::class,
        ],
    ];
    
    public function register(): void
    {
        parent::register();
        
        // Bind the domain event dispatcher
        $this->app->singleton(DomainEventDispatcher::class, LaravelEventDispatcher::class);
    }
    
    public function boot(): void
    {
        parent::boot();
        
        // Register channel authentication
        \Broadcast::channel('tenant.{tenantId}.provisioning', function ($user, $tenantId) {
            return $user->can('view_tenant', \App\Models\Tenant::find($tenantId));
        });
        
        \Broadcast::channel('tenant.{tenantId}.schema', function ($user, $tenantId) {
            return $user->can('manage_schema', \App\Models\Tenant::find($tenantId));
        });
        
        \Broadcast::channel('user.{userId}.notifications', function ($user, $userId) {
            return (string) $user->id === (string) $userId;
        });
        
        \Broadcast::channel('user.{userId}.provisioning', function ($user, $userId) {
            return (string) $user->id === (string) $userId;
        });
        
        \Broadcast::channel('admin.provisioning', function ($user) {
            return $user->can('manage_tenants');
        });
        
        \Broadcast::channel('admin.provisioning.progress', function ($user) {
            return $user->can('view_provisioning_progress');
        });
        
        \Broadcast::channel('admin.provisioning.errors', function ($user) {
            return $user->can('view_provisioning_errors');
        });
        
        \Broadcast::channel('admin.schema.drift', function ($user) {
            return $user->can('manage_schema');
        });
        
        \Broadcast::channel('admin.notifications', function ($user) {
            return $user->can('receive_admin_notifications');
        });
    }
}
```

### **3.2 Event Listeners**

**File: `app/Listeners/Provisioning/LogProvisioningStart.php`**

```php
<?php

namespace App\Listeners\Provisioning;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningStarted;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class LogProvisioningStart
{
    public function handle(TenantProvisioningStarted $event): void
    {
        $tenant = $event->getTenant();
        
        Log::info('Tenant provisioning started', [
            'tenant_id' => $tenant->getId(),
            'tenant_slug' => $tenant->getSlug(),
            'event_type' => $event->getEventType(),
            'metadata' => $event->getMetadata(),
        ]);
        
        // Store provisioning start in cache for real-time tracking
        Cache::put(
            "provisioning:{$tenant->getId()}:started_at",
            now()->timestamp,
            now()->addHours(24)
        );
        
        Cache::put(
            "provisioning:{$tenant->getId()}:status",
            [
                'status' => 'started',
                'stage' => 'initializing',
                'progress' => 0,
                'message' => 'Provisioning started',
                'last_updated' => now()->timestamp,
            ],
            now()->addHours(24)
        );
    }
}
```

**File: `app/Listeners/Provisioning/UpdateProgressInCache.php`**

```php
<?php

namespace App\Listeners\Provisioning;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningProgress;
use Illuminate\Support\Facades\Cache;

class UpdateProgressInCache
{
    public function handle(TenantProvisioningProgress $event): void
    {
        $tenant = $event->getTenant();
        $metadata = $event->getMetadata();
        
        Cache::put(
            "provisioning:{$tenant->getId()}:status",
            [
                'status' => 'in_progress',
                'stage' => $metadata['stage'],
                'progress' => $metadata['progress'],
                'message' => $metadata['message'],
                'last_updated' => now()->timestamp,
            ],
            now()->addHours(24)
        );
        
        // Store progress history (keep last 50 updates)
        $historyKey = "provisioning:{$tenant->getId()}:history";
        $history = Cache::get($historyKey, []);
        
        $history[] = [
            'timestamp' => now()->timestamp,
            'stage' => $metadata['stage'],
            'progress' => $metadata['progress'],
            'message' => $metadata['message'],
        ];
        
        // Keep only last 50 entries
        if (count($history) > 50) {
            $history = array_slice($history, -50);
        }
        
        Cache::put($historyKey, $history, now()->addHours(24));
    }
}
```

**File: `app/Listeners/Provisioning/SendCompletionNotification.php`**

```php
<?php

namespace App\Listeners\Provisioning;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningCompleted;
use Illuminate\Support\Facades\Notification;
use App\Notifications\TenantProvisionedNotification;

class SendCompletionNotification
{
    public function handle(TenantProvisioningCompleted $event): void
    {
        $tenant = $event->getTenant();
        $metadata = $event->getMetadata();
        
        // Get the user who triggered the provisioning
        $userId = $metadata['triggered_by'] ?? null;
        
        if ($userId) {
            $user = \App\Models\User::find($userId);
            if ($user) {
                Notification::send($user, new TenantProvisionedNotification($tenant, $metadata));
            }
        }
        
        // Send to admin users who should receive notifications
        $adminUsers = \App\Models\User::whereHas('roles', function ($query) {
            $query->where('name', 'admin')
                  ->orWhere('name', 'super_admin');
        })->where('receive_provisioning_notifications', true)->get();
        
        Notification::send($adminUsers, new TenantProvisionedNotification($tenant, $metadata));
    }
}
```

## **4. REAL-TIME PROVISIONING STATUS SERVICE**

### **4.1 Provisioning Status Service**

**File: `app/Services/RealTime/ProvisioningStatusService.php`**

```php
<?php

namespace App\Services\RealTime;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;

class ProvisioningStatusService
{
    private const STATUS_KEY_PREFIX = 'provisioning:status:';
    private const PROGRESS_KEY_PREFIX = 'provisioning:progress:';
    private const LOGS_KEY_PREFIX = 'provisioning:logs:';
    private const HISTORY_KEY_PREFIX = 'provisioning:history:';
    
    public function initializeProvisioning(TenantAggregate $tenant, string $initiatedBy): string
    {
        $provisioningId = Str::uuid()->toString();
        
        $initialStatus = [
            'provisioning_id' => $provisioningId,
            'tenant_id' => $tenant->getId(),
            'tenant_slug' => $tenant->getSlug(),
            'tenant_name' => $tenant->getName(),
            'status' => 'initializing',
            'stage' => 'pending',
            'progress' => 0,
            'message' => 'Initializing provisioning process',
            'initiated_by' => $initiatedBy,
            'started_at' => now()->timestamp,
            'last_updated' => now()->timestamp,
            'layers' => [
                'basic' => ['status' => 'pending', 'progress' => 0],
                'template' => ['status' => 'pending', 'progress' => 0],
                'module' => ['status' => 'pending', 'progress' => 0],
                'custom' => ['status' => 'pending', 'progress' => 0],
            ],
        ];
        
        // Store in Redis for real-time access
        Redis::setex(
            self::STATUS_KEY_PREFIX . $provisioningId,
            86400, // 24 hours
            json_encode($initialStatus)
        );
        
        // Also store tenant-provisioning mapping
        Redis::setex(
            "tenant:{$tenant->getId()}:active_provisioning",
            86400,
            $provisioningId
        );
        
        return $provisioningId;
    }
    
    public function updateStage(string $provisioningId, string $stage, string $message, int $progress = null): void
    {
        $status = $this->getStatus($provisioningId);
        
        if (!$status) {
            return;
        }
        
        $status['stage'] = $stage;
        $status['message'] = $message;
        
        if ($progress !== null) {
            $status['progress'] = $progress;
        }
        
        $status['last_updated'] = now()->timestamp;
        
        $this->setStatus($provisioningId, $status);
        $this->broadcastUpdate($provisioningId, $status);
    }
    
    public function updateLayerProgress(string $provisioningId, string $layer, string $status, int $progress): void
    {
        $provisioningStatus = $this->getStatus($provisioningId);
        
        if (!$provisioningStatus) {
            return;
        }
        
        $provisioningStatus['layers'][$layer] = [
            'status' => $status,
            'progress' => $progress,
            'updated_at' => now()->timestamp,
        ];
        
        // Calculate overall progress based on layer weights
        $overallProgress = $this->calculateOverallProgress($provisioningStatus['layers']);
        $provisioningStatus['progress'] = $overallProgress;
        
        $this->setStatus($provisioningId, $provisioningStatus);
        $this->broadcastUpdate($provisioningId, $provisioningStatus);
    }
    
    public function logMigration(string $provisioningId, string $migration, string $status, string $message = ''): void
    {
        $logEntry = [
            'timestamp' => now()->timestamp,
            'migration' => $migration,
            'status' => $status,
            'message' => $message,
        ];
        
        // Store in Redis list (keep last 1000 log entries)
        Redis::rpush(
            self::LOGS_KEY_PREFIX . $provisioningId,
            json_encode($logEntry)
        );
        
        // Trim list to keep only last 1000 entries
        Redis::ltrim(self::LOGS_KEY_PREFIX . $provisioningId, -1000, -1);
        
        // Also broadcast log entry
        $this->broadcastLogEntry($provisioningId, $logEntry);
    }
    
    public function completeProvisioning(string $provisioningId, array $result): void
    {
        $status = $this->getStatus($provisioningId);
        
        if (!$status) {
            return;
        }
        
        $status['status'] = 'completed';
        $status['progress'] = 100;
        $status['completed_at'] = now()->timestamp;
        $status['result'] = $result;
        $status['duration'] = $status['completed_at'] - $status['started_at'];
        $status['last_updated'] = now()->timestamp;
        
        $this->setStatus($provisioningId, $status);
        $this->broadcastCompletion($provisioningId, $status);
        
        // Move to completed storage (keep for 7 days)
        Redis::setex(
            "provisioning:completed:{$provisioningId}",
            604800, // 7 days
            json_encode($status)
        );
        
        // Clean up active provisioning
        Redis::del(self::STATUS_KEY_PREFIX . $provisioningId);
        
        $tenantId = $status['tenant_id'] ?? null;
        if ($tenantId) {
            Redis::del("tenant:{$tenantId}:active_provisioning");
        }
    }
    
    public function failProvisioning(string $provisioningId, string $error, array $logs = []): void
    {
        $status = $this->getStatus($provisioningId);
        
        if (!$status) {
            return;
        }
        
        $status['status'] = 'failed';
        $status['error'] = $error;
        $status['failed_at'] = now()->timestamp;
        $status['duration'] = $status['failed_at'] - $status['started_at'];
        $status['last_updated'] = now()->timestamp;
        
        if (!empty($logs)) {
            $status['failure_logs'] = array_slice($logs, -50); // Last 50 log entries
        }
        
        $this->setStatus($provisioningId, $status);
        $this->broadcastFailure($provisioningId, $status);
        
        // Move to failed storage (keep for 30 days for debugging)
        Redis::setex(
            "provisioning:failed:{$provisioningId}",
            2592000, // 30 days
            json_encode($status)
        );
        
        // Clean up active provisioning
        Redis::del(self::STATUS_KEY_PREFIX . $provisioningId);
        
        $tenantId = $status['tenant_id'] ?? null;
        if ($tenantId) {
            Redis::del("tenant:{$tenantId}:active_provisioning");
        }
    }
    
    public function getStatus(string $provisioningId): ?array
    {
        $data = Redis::get(self::STATUS_KEY_PREFIX . $provisioningId);
        
        if (!$data) {
            // Check if it's in completed or failed storage
            $data = Redis::get("provisioning:completed:{$provisioningId}")
                ?: Redis::get("provisioning:failed:{$provisioningId}");
        }
        
        return $data ? json_decode($data, true) : null;
    }
    
    public function getStatusByTenant(string $tenantId): ?array
    {
        $provisioningId = Redis::get("tenant:{$tenantId}:active_provisioning");
        
        if (!$provisioningId)