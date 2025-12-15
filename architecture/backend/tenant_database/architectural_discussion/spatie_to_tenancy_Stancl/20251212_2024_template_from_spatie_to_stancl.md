I'll create a complete abstraction layer and migration system for you. Let's build this step by step.

## **📁 File Structure**
```
app/
├── Services/
│   └── Tenancy/
│       ├── TenancyManagerInterface.php
│       ├── SpatieTenancyManager.php
│       ├── StanclTenancyManager.php
│       ├── TenancyManager.php (factory)
│       └── TenantMigrator.php
├── Models/
│   ├── Tenant.php (Spatie)
│   ├── StanclTenant.php
│   └── TenantMigrationLog.php
├── Providers/
│   └── TenancyServiceProvider.php
└── Console/
    └── Commands/
        ├── MigrateToStanclCommand.php
        ├── TenantSyncCommand.php
        └── TenancyModeCommand.php
```

## **1. Interface & Base Classes**

### **`app/Services/Tenancy/TenancyManagerInterface.php`**
```php
<?php

namespace App\Services\Tenancy;

use Illuminate\Http\Request;

interface TenancyManagerInterface
{
    /**
     * Initialize tenancy for a specific tenant
     */
    public function initialize($tenant): void;

    /**
     * Get current tenant
     */
    public function current();

    /**
     * Check if tenancy is initialized
     */
    public function initialized(): bool;

    /**
     * Run code in tenant context
     */
    public function run($tenant, callable $callback);

    /**
     * End current tenancy
     */
    public function end(): void;

    /**
     * Find tenant for request
     */
    public function findForRequest(Request $request);

    /**
     * Create new tenant
     */
    public function create(array $data);

    /**
     * Get all tenants
     */
    public function all();

    /**
     * Get database connection name for tenant
     */
    public function getTenantConnectionName(): string;

    /**
     * Get database connection name for landlord/central
     */
    public function getCentralConnectionName(): string;

    /**
     * Get tenant model class
     */
    public function getTenantModelClass(): string;

    /**
     * Check if tenant database exists
     */
    public function tenantDatabaseExists($tenant): bool;

    /**
     * Create tenant database
     */
    public function createTenantDatabase($tenant): bool;

    /**
     * Run migrations for tenant
     */
    public function migrateTenant($tenant, array $options = []): void;

    /**
     * Run seeds for tenant
     */
    public function seedTenant($tenant, array $options = []): void;

    /**
     * Get package name
     */
    public function getPackageName(): string;
}
```

### **`app/Services/Tenancy/SpatieTenancyManager.php`**
```php
<?php

namespace App\Services\Tenancy;

use Illuminate\Http\Request;
use Spatie\Multitenancy\Models\Tenant as SpatieTenant;

class SpatieTenancyManager implements TenancyManagerInterface
{
    protected $tenantModel;
    protected $tenantConnection = 'tenant';
    protected $landlordConnection = 'landlord';

    public function __construct()
    {
        $this->tenantModel = config('multitenancy.tenant_model');
    }

    public function initialize($tenant): void
    {
        if (!$tenant) {
            SpatieTenant::forgetCurrent();
            return;
        }

        $tenant->makeCurrent();
    }

    public function current()
    {
        return SpatieTenant::current();
    }

    public function initialized(): bool
    {
        return !is_null($this->current());
    }

    public function run($tenant, callable $callback)
    {
        if (!$tenant) {
            throw new \Exception('Tenant is required');
        }

        return $tenant->execute($callback);
    }

    public function end(): void
    {
        SpatieTenant::forgetCurrent();
    }

    public function findForRequest(Request $request)
    {
        $finder = config('multitenancy.tenant_finder');
        return app($finder)->findForRequest($request);
    }

    public function create(array $data)
    {
        $tenant = $this->tenantModel::create([
            'name' => $data['name'],
            'domain' => $data['domain'] ?? null,
            'database' => $data['database'] ?? $this->generateDatabaseName($data['name']),
        ]);

        // Create database
        $this->createTenantDatabase($tenant);

        // Run migrations
        if ($data['migrate'] ?? true) {
            $this->migrateTenant($tenant);
        }

        // Run seeds
        if ($data['seed'] ?? false) {
            $this->seedTenant($tenant, ['class' => $data['seeder'] ?? null]);
        }

        return $tenant;
    }

    public function all()
    {
        return $this->tenantModel::all();
    }

    public function getTenantConnectionName(): string
    {
        return config('multitenancy.tenant_database_connection_name', 'tenant');
    }

    public function getCentralConnectionName(): string
    {
        return config('multitenancy.landlord_database_connection_name', 'landlord');
    }

    public function getTenantModelClass(): string
    {
        return $this->tenantModel;
    }

    public function tenantDatabaseExists($tenant): bool
    {
        $database = $tenant->database;
        
        try {
            \DB::connection($this->getCentralConnectionName())
                ->statement("USE `{$database}`");
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function createTenantDatabase($tenant): bool
    {
        $database = $tenant->database;
        
        try {
            \DB::connection($this->getCentralConnectionName())
                ->statement("CREATE DATABASE IF NOT EXISTS `{$database}`");
            
            return true;
        } catch (\Exception $e) {
            throw new \Exception("Failed to create database: " . $e->getMessage());
        }
    }

    public function migrateTenant($tenant, array $options = []): void
    {
        $this->run($tenant, function () use ($options) {
            $path = $options['path'] ?? 'database/migrations/tenant';
            $database = $options['database'] ?? $this->getTenantConnectionName();
            
            \Artisan::call('migrate', [
                '--path' => $path,
                '--database' => $database,
                '--force' => true,
            ]);
        });
    }

    public function seedTenant($tenant, array $options = []): void
    {
        $this->run($tenant, function () use ($options) {
            $class = $options['class'] ?? null;
            $database = $options['database'] ?? $this->getTenantConnectionName();
            
            $params = [
                '--database' => $database,
                '--force' => true,
            ];
            
            if ($class) {
                $params['--class'] = $class;
            }
            
            \Artisan::call('db:seed', $params);
        });
    }

    public function getPackageName(): string
    {
        return 'spatie';
    }

    protected function generateDatabaseName(string $name): string
    {
        return 'tenant_' . strtolower(preg_replace('/[^A-Za-z0-9_]/', '_', $name)) . '_' . time();
    }
}
```

### **`app/Services/Tenancy/StanclTenancyManager.php`**
```php
<?php

namespace App\Services\Tenancy;

use Illuminate\Http\Request;
use Stancl\Tenancy\Facades\Tenancy;
use Stancl\Tenancy\Contracts\Tenant;
use Stancl\Tenancy\Exceptions\TenantCouldNotBeIdentifiedByPathException;

class StanclTenancyManager implements TenancyManagerInterface
{
    protected $tenantModel;
    protected $tenantConnection = 'stancl_tenant';
    protected $centralConnection = 'central';

    public function __construct()
    {
        $this->tenantModel = config('tenancy.tenant_model');
    }

    public function initialize($tenant): void
    {
        if (!$tenant) {
            Tenancy::end();
            return;
        }

        Tenancy::initialize($tenant);
    }

    public function current()
    {
        return Tenancy::current();
    }

    public function initialized(): bool
    {
        return !is_null($this->current());
    }

    public function run($tenant, callable $callback)
    {
        if (!$tenant) {
            throw new \Exception('Tenant is required');
        }

        return Tenancy::run($tenant, $callback);
    }

    public function end(): void
    {
        Tenancy::end();
    }

    public function findForRequest(Request $request)
    {
        try {
            // Try domain identification first
            $middleware = app(\Stancl\Tenancy\Middleware\InitializeTenancyByDomain::class);
            
            // Manually extract domain
            $host = $request->getHost();
            return $this->tenantModel::whereHas('domains', function ($query) use ($host) {
                $query->where('domain', $host);
            })->first();
        } catch (TenantCouldNotBeIdentifiedByPathException $e) {
            return null;
        }
    }

    public function create(array $data)
    {
        $tenantData = [
            'id' => $data['id'] ?? $this->generateTenantId($data['name']),
            'data' => [
                'name' => $data['name'],
                'database' => $data['database'] ?? $this->generateDatabaseName($data['name']),
                'template' => $data['template'] ?? null,
            ],
        ];

        $tenant = $this->tenantModel::create($tenantData);

        // Add domain if provided
        if (!empty($data['domain'])) {
            $tenant->domains()->create(['domain' => $data['domain']]);
        }

        // Create database
        if ($data['create_database'] ?? true) {
            $this->createTenantDatabase($tenant);
        }

        // Run migrations
        if ($data['migrate'] ?? true) {
            $this->migrateTenant($tenant);
        }

        // Run seeds
        if ($data['seed'] ?? false) {
            $this->seedTenant($tenant, ['class' => $data['seeder'] ?? null]);
        }

        return $tenant;
    }

    public function all()
    {
        return $this->tenantModel::all();
    }

    public function getTenantConnectionName(): string
    {
        $connection = config('tenancy.database.based_on', 'stancl_tenant');
        $prefix = config('tenancy.database.prefix', '');
        $suffix = config('tenancy.database.suffix', '');
        
        if ($prefix || $suffix) {
            return $connection . '_' . $prefix . $suffix;
        }
        
        return $connection;
    }

    public function getCentralConnectionName(): string
    {
        return 'central';
    }

    public function getTenantModelClass(): string
    {
        return $this->tenantModel;
    }

    public function tenantDatabaseExists($tenant): bool
    {
        $database = $tenant->database;
        
        try {
            \DB::connection($this->getCentralConnectionName())
                ->statement("USE `{$database}`");
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function createTenantDatabase($tenant): bool
    {
        $databaseManager = app(\Stancl\Tenancy\Database\DatabaseManager::class);
        
        try {
            $databaseManager->createDatabase($tenant);
            return true;
        } catch (\Exception $e) {
            throw new \Exception("Failed to create database: " . $e->getMessage());
        }
    }

    public function migrateTenant($tenant, array $options = []): void
    {
        $this->run($tenant, function () use ($options) {
            $path = $options['path'] ?? null;
            $database = $options['database'] ?? $this->getTenantConnectionName();
            
            $params = [
                '--database' => $database,
                '--force' => true,
            ];
            
            if ($path) {
                $params['--path'] = $path;
            }
            
            \Artisan::call('migrate', $params);
        });
    }

    public function seedTenant($tenant, array $options = []): void
    {
        $this->run($tenant, function () use ($options) {
            $class = $options['class'] ?? null;
            $database = $options['database'] ?? $this->getTenantConnectionName();
            
            $params = [
                '--database' => $database,
                '--force' => true,
            ];
            
            if ($class) {
                $params['--class'] = $class;
            }
            
            \Artisan::call('db:seed', $params);
        });
    }

    public function getPackageName(): string
    {
        return 'stancl';
    }

    protected function generateTenantId(string $name): string
    {
        return \Str::slug($name) . '_' . substr(md5($name . time()), 0, 8);
    }

    protected function generateDatabaseName(string $name): string
    {
        $prefix = config('tenancy.database.prefix', 'tenant_');
        $suffix = config('tenancy.database.suffix', '');
        
        return $prefix . \Str::snake($name) . $suffix;
    }
}
```

### **`app/Services/Tenancy/TenancyManager.php`** (Factory)
```php
<?php

namespace App\Services\Tenancy;

class TenancyManager
{
    protected $mode;
    protected $manager;

    public function __construct()
    {
        $this->mode = config('tenancy.mode', 'spatie');
        $this->manager = $this->createManager();
    }

    protected function createManager()
    {
        switch ($this->mode) {
            case 'stancl':
                return new StanclTenancyManager();
            case 'spatie':
            default:
                return new SpatieTenancyManager();
        }
    }

    public function getManager(): TenancyManagerInterface
    {
        return $this->manager;
    }

    public function getMode(): string
    {
        return $this->mode;
    }

    public function setMode(string $mode): void
    {
        if (!in_array($mode, ['spatie', 'stancl'])) {
            throw new \InvalidArgumentException("Mode must be 'spatie' or 'stancl'");
        }

        $this->mode = $mode;
        $this->manager = $this->createManager();
    }

    public function isSpatieMode(): bool
    {
        return $this->mode === 'spatie';
    }

    public function isStanclMode(): bool
    {
        return $this->mode === 'stancl';
    }

    // Proxy all method calls to the current manager
    public function __call($method, $parameters)
    {
        return $this->manager->$method(...$parameters);
    }
}
```

## **2. Tenant Models**

### **`app/Models/StanclTenant.php`**
```php
<?php

namespace App\Models;

use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Contracts\HasDatabase;

class StanclTenant extends BaseTenant implements TenantWithDatabase
{
    use HasDomains, HasDatabase;

    protected $table = 'stancl_tenants';

    protected $fillable = [
        'id',
        'data',
    ];

    protected $casts = [
        'data' => 'array',
    ];

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'data',
            'created_at',
            'updated_at',
        ];
    }

    // Accessors for data fields
    public function getNameAttribute()
    {
        return $this->data['name'] ?? null;
    }

    public function getDatabaseAttribute()
    {
        return $this->data['database'] ?? null;
    }

    public function getTemplateAttribute()
    {
        return $this->data['template'] ?? null;
    }

    public function getExtraDataAttribute()
    {
        return $this->data['extra'] ?? [];
    }

    // Mutators for data fields
    public function setNameAttribute($value)
    {
        $data = $this->data ?? [];
        $data['name'] = $value;
        $this->data = $data;
    }

    public function setDatabaseAttribute($value)
    {
        $data = $this->data ?? [];
        $data['database'] = $value;
        $this->data = $data;
    }

    public function setTemplateAttribute($value)
    {
        $data = $this->data ?? [];
        $data['template'] = $value;
        $this->data = $data;
    }

    public function setExtraDataAttribute($value)
    {
        $data = $this->data ?? [];
        $data['extra'] = $value;
        $this->data = $data;
    }

    // Relationship with migration logs
    public function migrationLogs()
    {
        return $this->hasMany(TenantMigrationLog::class, 'tenant_id', 'id')
            ->where('tenant_type', 'stancl');
    }

    // Check if migrated from Spatie
    public function getMigratedFromSpatieAttribute()
    {
        return $this->migrationLogs()
            ->where('migration_type', 'spatie_to_stancl')
            ->exists();
    }
}
```

### **`app/Models/TenantMigrationLog.php`**
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TenantMigrationLog extends Model
{
    protected $table = 'tenant_migration_logs';

    protected $fillable = [
        'tenant_id',
        'tenant_type',
        'migration_type',
        'source_data',
        'target_data',
        'status',
        'migrated_by',
        'notes',
    ];

    protected $casts = [
        'source_data' => 'array',
        'target_data' => 'array',
    ];

    const STATUS_PENDING = 'pending';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';
    const STATUS_ROLLED_BACK = 'rolled_back';

    const TYPE_SPATIE_TO_STANCL = 'spatie_to_stancl';
    const TYPE_STANCL_TO_SPATIE = 'stancl_to_spatie';

    public function tenant()
    {
        if ($this->tenant_type === 'spatie') {
            return $this->belongsTo(\App\Models\Tenant::class, 'tenant_id');
        } else {
            return $this->belongsTo(StanclTenant::class, 'tenant_id', 'id');
        }
    }
}
```

## **3. Migration Service**

### **`app/Services/Tenancy/TenantMigrator.php`**
```php
<?php

namespace App\Services\Tenancy;

use App\Models\Tenant;
use App\Models\StanclTenant;
use App\Models\TenantMigrationLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TenantMigrator
{
    protected $spatieManager;
    protected $stanclManager;

    public function __construct()
    {
        $this->spatieManager = new SpatieTenancyManager();
        $this->stanclManager = new StanclTenancyManager();
    }

    /**
     * Migrate tenant from Spatie to Stancl
     */
    public function migrateToStancl($tenantId, array $options = []): array
    {
        $log = TenantMigrationLog::create([
            'tenant_id' => $tenantId,
            'tenant_type' => 'spatie',
            'migration_type' => TenantMigrationLog::TYPE_SPATIE_TO_STANCL,
            'status' => TenantMigrationLog::STATUS_IN_PROGRESS,
            'migrated_by' => auth()->id() ?? null,
            'notes' => json_encode($options),
        ]);

        try {
            // 1. Get Spatie tenant
            $spatieTenant = Tenant::findOrFail($tenantId);
            
            // 2. Prepare data for Stancl tenant
            $stanclData = $this->prepareStanclData($spatieTenant, $options);
            
            // 3. Create Stancl tenant
            $this->stanclManager->setMode('stancl');
            $stanclTenant = $this->stanclManager->create($stanclData);
            
            // 4. Copy database contents if requested
            if ($options['copy_data'] ?? true) {
                $this->copyDatabaseData($spatieTenant, $stanclTenant);
            }
            
            // 5. Update Spatie tenant with migration info
            $spatieTenant->update([
                'migrated_to_stancl' => true,
                'stancl_tenant_id' => $stanclTenant->id,
            ]);
            
            // 6. Mark as completed
            $log->update([
                'status' => TenantMigrationLog::STATUS_COMPLETED,
                'target_data' => [
                    'stancl_tenant_id' => $stanclTenant->id,
                    'database' => $stanclTenant->database,
                ],
            ]);
            
            return [
                'success' => true,
                'spatie_tenant' => $spatieTenant,
                'stancl_tenant' => $stanclTenant,
                'log' => $log,
            ];
            
        } catch (\Exception $e) {
            $log->update([
                'status' => TenantMigrationLog::STATUS_FAILED,
                'notes' => $log->notes . "\nError: " . $e->getMessage(),
            ]);
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'log' => $log,
            ];
        }
    }

    /**
     * Rollback migration from Stancl to Spatie
     */
    public function rollbackToSpatie($stanclTenantId, array $options = []): array
    {
        $log = TenantMigrationLog::create([
            'tenant_id' => $stanclTenantId,
            'tenant_type' => 'stancl',
            'migration_type' => TenantMigrationLog::TYPE_STANCL_TO_SPATIE,
            'status' => TenantMigrationLog::STATUS_IN_PROGRESS,
            'migrated_by' => auth()->id() ?? null,
            'notes' => json_encode($options),
        ]);

        try {
            // 1. Get Stancl tenant
            $stanclTenant = StanclTenant::findOrFail($stanclTenantId);
            
            // 2. Find original Spatie tenant
            $spatieTenant = Tenant::where('stancl_tenant_id', $stanclTenantId)->first();
            
            if (!$spatieTenant) {
                throw new \Exception('Original Spatie tenant not found');
            }
            
            // 3. Copy data back if needed
            if ($options['restore_data'] ?? false) {
                $this->copyDatabaseData($stanclTenant, $spatieTenant, true);
            }
            
            // 4. Update Spatie tenant
            $spatieTenant->update([
                'migrated_to_stancl' => false,
                'stancl_tenant_id' => null,
            ]);
            
            // 5. Delete Stancl tenant if requested
            if ($options['delete_stancl'] ?? false) {
                $stanclTenant->delete();
            }
            
            // 6. Mark as rolled back
            $log->update([
                'status' => TenantMigrationLog::STATUS_ROLLED_BACK,
            ]);
            
            return [
                'success' => true,
                'spatie_tenant' => $spatieTenant,
                'stancl_tenant' => $options['delete_stancl'] ? null : $stanclTenant,
                'log' => $log,
            ];
            
        } catch (\Exception $e) {
            $log->update([
                'status' => TenantMigrationLog::STATUS_FAILED,
                'notes' => $log->notes . "\nError: " . $e->getMessage(),
            ]);
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'log' => $log,
            ];
        }
    }

    /**
     * Prepare data for Stancl tenant
     */
    protected function prepareStanclData(Tenant $spatieTenant, array $options): array
    {
        return [
            'id' => $options['custom_id'] ?? $this->generateStanclId($spatieTenant),
            'name' => $spatieTenant->name,
            'domain' => $spatieTenant->domain,
            'database' => $options['custom_database'] ?? $spatieTenant->database,
            'template' => $options['template'] ?? null,
            'create_database' => $options['create_database'] ?? false, // DB already exists
            'migrate' => $options['run_migrations'] ?? false,
            'seed' => $options['run_seeds'] ?? false,
            'seeder' => $options['seeder'] ?? null,
        ];
    }

    /**
     * Copy database data between tenants
     */
    protected function copyDatabaseData($sourceTenant, $targetTenant, $reverse = false): void
    {
        $sourceManager = $reverse ? $this->stanclManager : $this->spatieManager;
        $targetManager = $reverse ? $this->spatieManager : $this->stanclManager;
        
        // Get all tables from source tenant
        $sourceManager->run($sourceTenant, function () use ($targetManager, $targetTenant) {
            $tables = DB::select('SHOW TABLES');
            $tableNames = array_column($tables, 'Tables_in_' . DB::getDatabaseName());
            
            foreach ($tableNames as $table) {
                if ($this->shouldSkipTable($table)) {
                    continue;
                }
                
                $data = DB::table($table)->get()->toArray();
                
                // Insert into target tenant
                $targetManager->run($targetTenant, function () use ($table, $data) {
                    if (Schema::hasTable($table)) {
                        DB::table($table)->truncate();
                        foreach ($data as $row) {
                            DB::table($table)->insert((array) $row);
                        }
                    }
                });
            }
        });
    }

    /**
     * Tables to skip during migration
     */
    protected function shouldSkipTable(string $tableName): bool
    {
        $skipTables = [
            'migrations',
            'password_resets',
            'personal_access_tokens',
            'job_batches',
            'failed_jobs',
        ];
        
        return in_array($tableName, $skipTables);
    }

    /**
     * Generate Stancl tenant ID
     */
    protected function generateStanclId(Tenant $tenant): string
    {
        return 't_' . $tenant->id . '_' . substr(md5($tenant->name), 0, 6);
    }

    /**
     * Get migration status for a tenant
     */
    public function getMigrationStatus($tenantId, $type = 'spatie'): ?array
    {
        return TenantMigrationLog::where('tenant_id', $tenantId)
            ->where('tenant_type', $type)
            ->orderBy('created_at', 'desc')
            ->first()
            ?->toArray();
    }

    /**
     * Get all pending migrations
     */
    public function getPendingMigrations(): array
    {
        return TenantMigrationLog::where('status', TenantMigrationLog::STATUS_PENDING)
            ->get()
            ->toArray();
    }

    /**
     * Batch migrate multiple tenants
     */
    public function batchMigrate(array $tenantIds, array $options = []): array
    {
        $results = [];
        
        foreach ($tenantIds as $tenantId) {
            $results[$tenantId] = $this->migrateToStancl($tenantId, $options);
            
            // Add delay between migrations
            if ($options['delay'] ?? 0 > 0) {
                sleep($options['delay']);
            }
        }
        
        return $results;
    }
}
```

## **4. Artisan Commands**

### **`app/Console/Commands/MigrateToStanclCommand.php`**
```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Tenancy\TenantMigrator;
use App\Models\Tenant;

class MigrateToStanclCommand extends Command
{
    protected $signature = 'tenancy:migrate-to-stancl
                            {tenant? : Tenant ID or "all" for all tenants}
                            {--copy-data : Copy database data}
                            {--skip-data : Skip data copying}
                            {--run-migrations : Run migrations on new tenant}
                            {--run-seeds : Run seeds on new tenant}
                            {--template= : Template to use}
                            {--batch : Process in batch mode}
                            {--delay=0 : Delay between batch migrations}
                            {--force : Force migration without confirmation}';

    protected $description = 'Migrate tenants from Spatie to Stancl tenancy';

    protected $migrator;

    public function __construct(TenantMigrator $migrator)
    {
        parent::__construct();
        $this->migrator = $migrator;
    }

    public function handle()
    {
        $tenantId = $this->argument('tenant');
        $options = $this->getOptions();

        if ($tenantId === 'all') {
            return $this->handleAllTenants($options);
        }

        if ($tenantId) {
            return $this->handleSingleTenant($tenantId, $options);
        }

        // Interactive mode
        return $this->handleInteractive($options);
    }

    protected function handleSingleTenant($tenantId, array $options): void
    {
        $tenant = Tenant::find($tenantId);
        
        if (!$tenant) {
            $this->error("Tenant with ID {$tenantId} not found.");
            return;
        }

        $this->info("Migrating tenant: {$tenant->name} (ID: {$tenant->id})");

        if ($tenant->migrated_to_stancl ?? false) {
            $this->warn("This tenant is already migrated to Stancl.");
            
            if (!$this->option('force') && !$this->confirm('Force re-migrate?')) {
                return;
            }
        }

        if (!$this->option('force')) {
            $this->table(
                ['Option', 'Value'],
                [
                    ['Copy Data', $options['copy_data'] ? 'Yes' : 'No'],
                    ['Run Migrations', $options['run_migrations'] ? 'Yes' : 'No'],
                    ['Run Seeds', $options['run_seeds'] ? 'Yes' : 'No'],
                    ['Template', $options['template'] ?? 'None'],
                ]
            );

            if (!$this->confirm('Proceed with migration?')) {
                return;
            }
        }

        $result = $this->migrator->migrateToStancl($tenantId, $options);

        if ($result['success']) {
            $this->info('✅ Migration completed successfully!');
            $this->table(
                ['Tenant Type', 'ID', 'Name', 'Database'],
                [
                    ['Spatie', $tenant->id, $tenant->name, $tenant->database],
                    ['Stancl', $result['stancl_tenant']->id, $result['stancl_tenant']->name, $result['stancl_tenant']->database],
                ]
            );
        } else {
            $this->error('❌ Migration failed: ' . $result['error']);
        }
    }

    protected function handleAllTenants(array $options): void
    {
        $tenants = Tenant::where('migrated_to_stancl', false)->get();
        
        if ($tenants->isEmpty()) {
            $this->info('No tenants to migrate.');
            return;
        }

        $this->info("Found {$tenants->count()} tenants to migrate.");

        $this->table(
            ['ID', 'Name', 'Domain', 'Database'],
            $tenants->map(function ($tenant) {
                return [$tenant->id, $tenant->name, $tenant->domain, $tenant->database];
            })->toArray()
        );

        if (!$this->option('force') && !$this->confirm('Migrate ALL tenants?')) {
            return;
        }

        $this->info('Starting batch migration...');
        
        $results = $this->migrator->batchMigrate(
            $tenants->pluck('id')->toArray(),
            $options
        );

        $successCount = collect($results)->filter(fn($r) => $r['success'])->count();
        $failedCount = collect($results)->filter(fn($r) => !$r['success'])->count();

        $this->info("Batch migration complete!");
        $this->info("✅ Successful: {$successCount}");
        
        if ($failedCount > 0) {
            $this->error("❌ Failed: {$failedCount}");
            
            foreach ($results as $tenantId => $result) {
                if (!$result['success']) {
                    $this->line("Tenant {$tenantId}: {$result['error']}");
                }
            }
        }
    }

    protected function handleInteractive(array $options): void
    {
        $tenants = Tenant::where('migrated_to_stancl', false)->get();
        
        if ($tenants->isEmpty()) {
            $this->info('No tenants to migrate.');
            return;
        }

        $choices = $tenants->mapWithKeys(function ($tenant) {
            return [$tenant->id => "{$tenant->name} (Domain: {$tenant->domain})"];
        })->toArray();

        $choices['all'] = 'Migrate ALL tenants';

        $selected = $this->choice(
            'Select tenant(s) to migrate:',
            $choices
        );

        if ($selected === 'all') {
            return $this->handleAllTenants($options);
        }

        return $this->handleSingleTenant($selected, $options);
    }

    protected function getOptions(): array
    {
        return [
            'copy_data' => $this->option('copy-data') && !$this->option('skip-data'),
            'run_migrations' => $this->option('run-migrations'),
            'run_seeds' => $this->option('run-seeds'),
            'template' => $this->option('template'),
            'delay' => (int) $this->option('delay'),
        ];
    }
}
```

### **`app/Console/Commands/TenantSyncCommand.php`**
```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use App\Models\StanclTenant;

class TenantSyncCommand extends Command
{
    protected $signature = 'tenancy:sync
                            {--compare : Compare tenants between systems}
                            {--fix-missing : Create missing tenants}
                            {--fix-domains : Sync domain mappings}
                            {--dry-run : Show what would be done without making changes}';

    protected $description = 'Sync tenants between Spatie and Stancl systems';

    public function handle()
    {
        if ($this->option('compare')) {
            return $this->compareTenants();
        }

        if ($this->option('fix-missing')) {
            return $this->fixMissingTenants();
        }

        if ($this->option('fix-domains')) {
            return $this->fixDomainMappings();
        }

        $this->info('Use --compare to compare tenants between systems');
        $this->info('Use --fix-missing to create missing tenants');
        $this->info('Use --fix-domains to sync domain mappings');
    }

    protected function compareTenants(): void
    {
        $spatieTenants = Tenant::all();
        $stanclTenants = StanclTenant::all();

        $this->info('=== Spatie Tenants ===');
        $this->table(
            ['ID', 'Name', 'Domain', 'Database', 'Migrated'],
            $spatieTenants->map(function ($tenant) {
                return [
                    $tenant->id,
                    $tenant->name,
                    $tenant->domain,
                    $tenant->database,
                    $tenant->migrated_to_stancl ? 'Yes' : 'No',
                ];
            })
        );

        $this->info('=== Stancl Tenants ===');
        $this->table(
            ['ID', 'Name', 'Domains', 'Database', 'Migrated'],
            $stanclTenants->map(function ($tenant) {
                return [
                    $tenant->id,
                    $tenant->name,
                    $tenant->domains->pluck('domain')->join(', '),
                    $tenant->database,
                    $tenant->migrated_from_spatie ? 'Yes' : 'No',
                ];
            })
        );

        // Find mismatches
        $spatieIds = $spatieTenants->pluck('id')->toArray();
        $stanclIdsFromSpatie = $spatieTenants->pluck('stancl_tenant_id')->filter()->toArray();
        $stanclIds = $stanclTenants->pluck('id')->toArray();

        $missingInStancl = array_diff($spatieIds, $stanclIdsFromSpatie);
        $missingInSpatie = array_diff($stanclIds, $stanclIdsFromSpatie);
        $orphanedStancl = array_diff($stanclIds, $stanclIdsFromSpatie);

        if (!empty($missingInStancl)) {
            $this->warn('⚠️ Tenants missing in Stancl: ' . implode(', ', $missingInStancl));
        }

        if (!empty($orphanedStancl)) {
            $this->warn('⚠️ Orphaned Stancl tenants (no Spatie parent): ' . implode(', ', $orphanedStancl));
        }

        if (empty($missingInStancl) && empty($orphanedStancl)) {
            $this->info('✅ Tenants are synchronized!');
        }
    }

    protected function fixMissingTenants(): void
    {
        $dryRun = $this->option('dry-run');
        
        $spatieTenants = Tenant::where('migrated_to_stancl', false)->get();
        
        if ($spatieTenants->isEmpty()) {
            $this->info('No unmigrated Spatie tenants found.');
            return;
        }

        $this->info("Found {$spatieTenants->count()} unmigrated tenants.");

        foreach ($spatieTenants as $tenant) {
            $this->info("Processing: {$tenant->name} (ID: {$tenant->id})");
            
            if ($dryRun) {
                $this->line("[DRY RUN] Would create Stancl tenant for: {$tenant->name}");
                continue;
            }

            // Check if Stancl tenant already exists with same domain
            $existingStancl = StanclTenant::whereHas('domains', function ($query) use ($tenant) {
                $query->where('domain', $tenant->domain);
            })->first();

            if ($existingStancl) {
                $this->warn("Stancl tenant already exists with domain {$tenant->domain}");
                continue;
            }

            // Create Stancl tenant
            $stanclTenant = StanclTenant::create([
                'id' => 't_' . $tenant->id . '_' . substr(md5($tenant->name), 0, 6),
                'data' => [
                    'name' => $tenant->name,
                    'database' => $tenant->database,
                ],
            ]);

            if ($tenant->domain) {
                $stanclTenant->domains()->create(['domain' => $tenant->domain]);
            }

            $tenant->update([
                'migrated_to_stancl' => true,
                'stancl_tenant_id' => $stanclTenant->id,
            ]);

            $this->info("✅ Created Stancl tenant: {$stanclTenant->id}");
        }
    }

    protected function fixDomainMappings(): void
    {
        $dryRun = $this->option('dry-run');
        
        $spatieTenants = Tenant::whereNotNull('domain')->get();
        
        foreach ($spatieTenants as $spatieTenant) {
            if (!$spatieTenant->stancl_tenant_id) {
                continue;
            }

            $stanclTenant = StanclTenant::find($spatieTenant->stancl_tenant_id);
            
            if (!$stanclTenant) {
                $this->warn("Stancl tenant not found for: {$spatieTenant->name}");
                continue;
            }

            $hasDomain = $stanclTenant->domains()
                ->where('domain', $spatieTenant->domain)
                ->exists();

            if (!$hasDomain) {
                $this->info("Adding domain {$spatieTenant->domain} to {$stanclTenant->name}");
                
                if (!$dryRun) {
                    $stanclTenant->domains()->create(['domain' => $spatieTenant->domain]);
                }
            }
        }

        $this->info($dryRun ? '[DRY RUN] Domain sync complete' : '✅ Domain sync complete');
    }
}
```

### **`app/Console/Commands/TenancyModeCommand.php`**
```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Tenancy\TenancyManager;

class TenancyModeCommand extends Command
{
    protected $signature = 'tenancy:mode
                            {mode? : Set mode (spatie|stancl)}
                            {--show : Show current mode}
                            {--test : Test both modes}';

    protected $description = 'Manage tenancy mode (Spatie/Stancl)';

    protected $tenancyManager;

    public function __construct(TenancyManager $tenancyManager)
    {
        parent::__construct();
        $this->tenancyManager = $tenancyManager;
    }

    public function handle()
    {
        if ($this->option('show')) {
            return $this->showMode();
        }

        if ($this->option('test')) {
            return $this->testModes();
        }

        $mode = $this->argument('mode');

        if ($mode) {
            return $this->setMode($mode);
        }

        // Interactive mode
        $currentMode = $this->tenancyManager->getMode();
        $this->info("Current mode: {$currentMode}");
        
        $newMode = $this->choice(
            'Select mode:',
            ['spatie', 'stancl'],
            $currentMode
        );
        
        return $this->setMode($newMode);
    }

    protected function showMode(): void
    {
        $mode = $this->tenancyManager->getMode();
        $manager = $this->tenancyManager->getManager();
        
        $this->info("Current Tenancy Mode: " . strtoupper($mode));
        $this->info("Package: " . $manager->getPackageName());
        $this->info("Tenant Model: " . $manager->getTenantModelClass());
        $this->info("Tenant Connection: " . $manager->getTenantConnectionName());
        $this->info("Central Connection: " . $manager->getCentralConnectionName());
        
        // Show tenant counts
        if ($mode === 'spatie') {
            $count = \App\Models\Tenant::count();
            $this->info("Total Spatie Tenants: {$count}");
        } else {
            $count = \App\Models\StanclTenant::count();
            $this->info("Total Stancl Tenants: {$count}");
        }
    }

    protected function setMode(string $mode): void
    {
        if (!in_array($mode, ['spatie', 'stancl'])) {
            $this->error("Invalid mode. Use 'spatie' or 'stancl'.");
            return;
        }

        try {
            $this->tenancyManager->setMode($mode);
            $this->info("✅ Tenancy mode set to: " . strtoupper($mode));
            
            // Clear cache
            \Artisan::call('config:clear');
            $this->info("Configuration cache cleared.");
            
        } catch (\Exception $e) {
            $this->error("Failed to set mode: " . $e->getMessage());
        }
    }

    protected function testModes(): void
    {
        $this->info('Testing Spatie mode...');
        $this->tenancyManager->setMode('spatie');
        $this->testCurrentMode();
        
        $this->info(PHP_EOL . 'Testing Stancl mode...');
        $this->tenancyManager->setMode('stancl');
        $this->testCurrentMode();
        
        // Restore original mode
        $original = config('tenancy.mode', 'spatie');
        $this->tenancyManager->setMode($original);
        $this->info(PHP_EOL . "Restored mode to: " . strtoupper($original));
    }

    protected function testCurrentMode(): void
    {
        $manager = $this->tenancyManager->getManager();
        
        try {
            $tenants = $manager->all();
            $this->info("✓ Found {$tenants->count()} tenants");
            
            if ($tenants->isNotEmpty()) {
                $firstTenant = $tenants->first();
                $this->info("✓ First tenant: {$firstTenant->name}");
                
                // Test initialization
                $manager->initialize($firstTenant);
                $this->info("✓ Tenant initialized");
                
                // Test current tenant
                $current = $manager->current();
                $this->info("✓ Current tenant: " . ($current ? $current->name : 'null'));
                
                // Test run
                $result = $manager->run($firstTenant, function () {
                    return \DB::getDatabaseName();
                });
                $this->info("✓ Database connection: {$result}");
                
                $manager->end();
                $this->info("✓ Tenancy ended");
            }
            
        } catch (\Exception $e) {
            $this->error("✗ Test failed: " . $e->getMessage());
        }
    }
}
```

## **5. Service Provider**

### **`app/Providers/TenancyServiceProvider.php`**
```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\Tenancy\TenancyManager;
use App\Services\Tenancy\TenantMigrator;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Route;

class TenancyServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->singleton(TenancyManager::class, function ($app) {
            return new TenancyManager();
        });

        $this->app->singleton('tenancy', function ($app) {
            return $app->make(TenancyManager::class);
        });

        $this->app->singleton(TenantMigrator::class, function ($app) {
            return new TenantMigrator();
        });

        // Register commands
        $this->commands([
            \App\Console\Commands\MigrateToStanclCommand::class,
            \App\Console\Commands\TenantSyncCommand::class,
            \App\Console\Commands\TenancyModeCommand::class,
        ]);
    }

    public function boot()
    {
        // Publish config if needed
        $this->publishes([
            __DIR__ . '/../../config/tenancy.php' => config_path('tenancy.php'),
        ], 'tenancy-config');

        // Register blade directives
        Blade::directive('tenant', function ($expression) {
            return "<?php if (app('tenancy')->initialized()): ?>";
        });

        Blade::directive('endtenant', function ($expression) {
            return "<?php endif; ?>";
        });

        Blade::directive('landlord', function ($expression) {
            return "<?php if (!app('tenancy')->initialized()): ?>";
        });

        Blade::directive('endlandlord', function ($expression) {
            return "<?php endif; ?>";
        });

        // Helper functions
        if (!function_exists('current_tenant')) {
            function current_tenant() {
                return app('tenancy')->current();
            }
        }

        if (!function_exists('tenancy')) {
            function tenancy() {
                return app('tenancy');
            }
        }

        if (!function_exists('is_tenant_context')) {
            function is_tenant_context() {
                return app('tenancy')->initialized();
            }
        }

        if (!function_exists('is_landlord_context')) {
            function is_landlord_context() {
                return !app('tenancy')->initialized();
            }
        }

        // Routes
        $this->registerRoutes();
    }

    protected function registerRoutes()
    {
        Route::group([
            'prefix' => 'admin/tenancy',
            'middleware' => ['web', 'auth'],
            'as' => 'tenancy.',
        ], function () {
            Route::get('/mode', function () {
                return [
                    'mode' => app('tenancy')->getMode(),
                    'current' => current_tenant(),
                ];
            })->name('mode');
            
            Route::post('/switch/{mode}', function ($mode) {
                if (!in_array($mode, ['spatie', 'stancl'])) {
                    abort(400, 'Invalid mode');
                }
                
                app('tenancy')->setMode($mode);
                return ['success' => true, 'mode' => $mode];
            })->name('switch');
            
            Route::get('/migrate/{tenant}', function ($tenantId) {
                $migrator = app(TenantMigrator::class);
                $result = $migrator->migrateToStancl($tenantId, [
                    'copy_data' => request('copy_data', true),
                ]);
                
                return $result;
            })->name('migrate');
        });
    }
}
```

## **6. Configuration File**

### **`config/tenancy.php`**
```php
<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Tenancy Mode
    |--------------------------------------------------------------------------
    |
    | This option controls which tenancy package is active.
    | Options: 'spatie', 'stancl'
    |
    */
    'mode' => env('TENANCY_MODE', 'spatie'),

    /*
    |--------------------------------------------------------------------------
    | Auto-switch Mode
    |--------------------------------------------------------------------------
    |
    | Automatically switch mode based on tenant.
    | If true, uses tenant's migrated_to_stancl flag.
    |
    */
    'auto_switch' => env('TENANCY_AUTO_SWITCH', true),

    /*
    |--------------------------------------------------------------------------
    | Default Template
    |--------------------------------------------------------------------------
    |
    | Default template to use when creating new tenants.
    |
    */
    'default_template' => env('TENANCY_DEFAULT_TEMPLATE', 'default'),

    /*
    |--------------------------------------------------------------------------
    | Migration Logging
    |--------------------------------------------------------------------------
    |
    | Log migration activities.
    |
    */
    'log_migrations' => env('TENANCY_LOG_MIGRATIONS', true),

    /*
    |--------------------------------------------------------------------------
    | Fallback Mode
    |--------------------------------------------------------------------------
    |
    | Fallback mode if auto-switch fails.
    |
    */
    'fallback_mode' => env('TENANCY_FALLBACK_MODE', 'spatie'),

    /*
    |--------------------------------------------------------------------------
    | Database Prefix/Suffix
    |--------------------------------------------------------------------------
    |
    | Database name prefix/suffix for Stancl tenants.
    |
    */
    'database' => [
        'prefix' => env('TENANCY_DB_PREFIX', 'tenant_'),
        'suffix' => env('TENANCY_DB_SUFFIX', ''),
    ],
];
```

## **7. Database Migrations**

### **Migration for Stancl Tenants Table**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateStanclTenantsTable extends Migration
{
    public function up()
    {
        Schema::create('stancl_tenants', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->json('data')->nullable();
            $table->timestamps();
        });

        Schema::create('stancl_domains', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->string('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('stancl_tenants')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('tenant_migration_logs', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id');
            $table->enum('tenant_type', ['spatie', 'stancl']);
            $table->enum('migration_type', ['spatie_to_stancl', 'stancl_to_spatie']);
            $table->json('source_data')->nullable();
            $table->json('target_data')->nullable();
            $table->enum('status', ['pending', 'in_progress', 'completed', 'failed', 'rolled_back']);
            $table->foreignId('migrated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->index(['tenant_id', 'tenant_type']);
            $table->index('status');
        });

        // Add migration columns to Spatie tenants table
        Schema::table('tenants', function (Blueprint $table) {
            $table->boolean('migrated_to_stancl')->default(false)->after('database');
            $table->string('stancl_tenant_id')->nullable()->after('migrated_to_stancl');
            $table->json('migration_data')->nullable()->after('stancl_tenant_id');
            
            $table->index('migrated_to_stancl');
            $table->index('stancl_tenant_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('tenant_migration_logs');
        Schema::dropIfExists('stancl_domains');
        Schema::dropIfExists('stancl_tenants');
        
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['migrated_to_stancl', 'stancl_tenant_id', 'migration_data']);
        });
    }
}
```

## **8. Middleware for Auto-switching**

### **`app/Http/Middleware/TenancyModeSelector.php`**
```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Services\Tenancy\TenancyManager;

class TenancyModeSelector
{
    protected $tenancyManager;

    public function __construct(TenancyManager $tenancyManager)
    {
        $this->tenancyManager = $tenancyManager;
    }

    public function handle(Request $request, Closure $next)
    {
        if (!config('tenancy.auto_switch', true)) {
            return $next($request);
        }

        // Find tenant for this request
        $tenant = null;
        
        // Try Spatie first
        $spatieFinder = config('multitenancy.tenant_finder');
        if ($spatieFinder) {
            $tenant = app($spatieFinder)->findForRequest($request);
        }
        
        // If tenant found and migrated, switch to Stancl
        if ($tenant && $tenant->migrated_to_stancl) {
            $this->tenancyManager->setMode('stancl');
        } else {
            $this->tenancyManager->setMode('spatie');
        }

        return $next($request);
    }
}
```

## **9. Usage Examples**

### **Using the Abstraction Layer**
```php
// Always use the abstraction layer
use App\Services\Tenancy\TenancyManager;

// Get current mode
$mode = app(TenancyManager::class)->getMode();

// Initialize tenancy (works with both packages)
$tenant = \App\Models\Tenant::find(1);
app('tenancy')->initialize($tenant);

// Run code in tenant context
app('tenancy')->run($tenant, function () {
    $users = \App\Models\User::count();
    echo "Users in tenant: {$users}";
});

// Get current tenant
$current = app('tenancy')->current();

// Check context
if (is_tenant_context()) {
    // In tenant context
    $tenant = current_tenant();
}

// Create new tenant (works with both)
$newTenant = app('tenancy')->create([
    'name' => 'New Nepali Political Party',
    'domain' => 'newparty.election-np.gov',
    'template' => 'political_party',
]);
```

### **Migrating Tenants**
```bash
# Show current mode
php artisan tenancy:mode --show

# Switch to Stancl mode
php artisan tenancy:mode stancl

# Compare tenants between systems
php artisan tenancy:sync --compare

# Migrate specific tenant
php artisan tenancy:migrate-to-stancl 1 --copy-data --run-migrations

# Migrate all tenants
php artisan tenancy:migrate-to-stancl all --copy-data

# Test both modes
php artisan tenancy:mode --test
```

## **10. Register in App**

### **`config/app.php`**
```php
'providers' => [
    // ... other providers
    App\Providers\TenancyServiceProvider::class,
    // Keep both Spatie and Stancl providers
    Spatie\Multitenancy\MultitenancyServiceProvider::class,
    Stancl\Tenancy\TenancyServiceProvider::class,
],

'aliases' => [
    // ... other aliases
    'Tenancy' => App\Services\Tenancy\Facades\TenancyFacade::class,
],
```

## **🚀 Installation Steps**

1. **Install Stancl alongside Spatie:**
```bash
composer require stancl/tenancy
```

2. **Run migrations:**
```bash
php artisan migrate --path=database/migrations/landlord
php artisan migrate
```

3. **Publish configurations:**
```bash
php artisan vendor:publish --provider="App\Providers\TenancyServiceProvider"
```

4. **Test the system:**
```bash
php artisan tenancy:mode --test
php artisan tenancy:sync --compare
```

5. **Start migrating:**
```bash
# Migrate one tenant first
php artisan tenancy:migrate-to-stancl 1 --copy-data

# Verify it works
php artisan tenancy:mode stancl
php artisan tenants:list
```

This complete system allows you to:
1. **Run both packages side-by-side**
2. **Migrate tenants gradually**
3. **Rollback if needed**
4. **Auto-switch based on tenant migration status**
5. **Keep your existing Spatie setup working**
6. **Test thoroughly before full migration**

The abstraction layer ensures your application code doesn't need to know which package is being used! 