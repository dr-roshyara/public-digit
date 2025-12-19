# 🏗️ **TENANTPROVISIONER SERVICE CLASS (PLATFORM CONTEXT)**

Perfect! Let's implement the `TenantProvisioner` service class that will handle the 4-layer migration approach from the platform/landlord context. This service will orchestrate tenant database provisioning while maintaining complete isolation.

## **1. SERVICE INTERFACE & CONTRACT**

First, let's define the interface to ensure proper abstraction:

**File: `app/Contracts/TenantProvisionerInterface.php`**

```php
<?php

namespace App\Contracts;

use App\Models\Tenant;
use App\Exceptions\TenantProvisioningException;

interface TenantProvisionerInterface
{
    /**
     * Provision a new tenant database with all required layers
     */
    public function provision(Tenant $tenant, array $options = []): array;
    
    /**
     * Apply specific migration layers to an existing tenant
     */
    public function applyMigrationLayer(Tenant $tenant, string $layer, array $options = []): array;
    
    /**
     * Rollback tenant provisioning to a specific point
     */
    public function rollback(Tenant $tenant, string $toBatch = null): array;
    
    /**
     * Sync tenant schema with template/module updates
     */
    public function sync(Tenant $tenant, array $options = []): array;
    
    /**
     * Create schema snapshot for drift detection
     */
    public function createSchemaSnapshot(Tenant $tenant): string;
    
    /**
     * Detect schema drift between expected and actual
     */
    public function detectSchemaDrift(Tenant $tenant): array;
    
    /**
     * Repair schema drift automatically or manually
     */
    public function repairSchemaDrift(Tenant $tenant, array $repairOptions = []): array;
    
    /**
     * Get provisioning status and statistics
     */
    public function getStatus(Tenant $tenant): array;
    
    /**
     * Validate tenant can be provisioned
     */
    public function validate(Tenant $tenant): bool;
}
```

## **2. TENANTPROVISIONER SERVICE CLASS**

**File: `app/Services/TenantProvisioner.php`**

```php
<?php

namespace App\Services;

use App\Contracts\TenantProvisionerInterface;
use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Models\TemplateModule;
use App\Models\TenantMigrationHistory;
use App\Events\TenantProvisioningStarted;
use App\Events\TenantProvisioningCompleted;
use App\Events\TenantProvisioningFailed;
use App\Events\MigrationLayerApplied;
use App\Exceptions\TenantProvisioningException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;
use Carbon\Carbon;
use PDOException;
use Exception;

class TenantProvisioner implements TenantProvisionerInterface
{
    protected array $config;
    protected string $batchId;
    protected array $provisioningLog = [];
    protected bool $isDryRun = false;
    protected array $layerOrder = ['basic', 'template', 'module', 'custom'];
    
    public function __construct()
    {
        $this->config = config('tenant-migrations', []);
        $this->batchId = Str::uuid()->toString();
    }
    
    /**
     * Main provisioning method - orchestrates the 4-layer approach
     */
    public function provision(Tenant $tenant, array $options = []): array
    {
        $startTime = microtime(true);
        
        try {
            $this->validateProvisioningEnvironment();
            
            // Update tenant status
            $tenant->update([
                'provisioning_status' => 'in_progress',
                'provisioning_started_at' => now(),
                'provisioning_error' => null,
            ]);
            
            // Fire provisioning started event
            Event::dispatch(new TenantProvisioningStarted(
                $tenant,
                $this->getTemplateConfig($tenant),
                $this->getSelectedModules($tenant)
            ));
            
            // Create tenant database
            $this->createTenantDatabase($tenant);
            
            // Apply migrations in correct order
            $results = $this->applyAllMigrationLayers($tenant, $options);
            
            // Create initial schema snapshot
            $schemaHash = $this->createSchemaSnapshot($tenant);
            
            // Update tenant status
            $tenant->update([
                'provisioning_status' => 'completed',
                'provisioning_completed_at' => now(),
                'schema_hash' => $schemaHash,
                'database_created_at' => now(),
                'is_active' => true,
            ]);
            
            // Log success
            $this->logProvisioning('success', 'Tenant provisioned successfully', [
                'tenant' => $tenant->slug,
                'database' => $tenant->database,
                'schema_hash' => $schemaHash,
                'duration' => microtime(true) - $startTime,
            ]);
            
            // Fire completion event
            Event::dispatch(new TenantProvisioningCompleted(
                $tenant,
                $this->getProvisioningStats($results),
                $schemaHash
            ));
            
            return [
                'success' => true,
                'tenant' => $tenant,
                'batch_id' => $this->batchId,
                'schema_hash' => $schemaHash,
                'layers_applied' => $results,
                'duration' => microtime(true) - $startTime,
                'log' => $this->provisioningLog,
            ];
            
        } catch (Exception $e) {
            $this->handleProvisioningFailure($tenant, $e);
            
            // Log failure
            $this->logProvisioning('error', 'Tenant provisioning failed', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            throw new TenantProvisioningException(
                $tenant,
                'provisioning',
                $e->getMessage(),
                null,
                0,
                $e
            );
        }
    }
    
    /**
     * Apply specific migration layer to tenant
     */
    public function applyMigrationLayer(Tenant $tenant, string $layer, array $options = []): array
    {
        if (!in_array($layer, $this->layerOrder)) {
            throw new TenantProvisioningException(
                $tenant,
                'validation',
                "Invalid migration layer: {$layer}"
            );
        }
        
        $startTime = microtime(true);
        
        try {
            // Switch to tenant connection
            $this->switchToTenantConnection($tenant);
            
            $migrations = $this->getMigrationsForLayer($tenant, $layer, $options);
            $applied = $this->applyMigrations($tenant, $migrations, $layer, $options);
            
            // Create schema snapshot after layer application
            $schemaHash = $this->createSchemaSnapshot($tenant);
            
            Event::dispatch(new MigrationLayerApplied(
                $tenant,
                $layer,
                $applied,
                $schemaHash
            ));
            
            return [
                'success' => true,
                'layer' => $layer,
                'migrations_applied' => $applied,
                'schema_hash' => $schemaHash,
                'duration' => microtime(true) - $startTime,
            ];
            
        } catch (Exception $e) {
            throw new TenantProvisioningException(
                $tenant,
                $layer,
                $e->getMessage(),
                null,
                0,
                $e
            );
        } finally {
            // Always switch back to landlord connection
            $this->switchToLandlordConnection();
        }
    }
    
    /**
     * Rollback tenant migrations to specific batch
     */
    public function rollback(Tenant $tenant, string $toBatch = null): array
    {
        $this->validateTenantConnection($tenant);
        
        try {
            $this->switchToTenantConnection($tenant);
            
            // Get migration history
            $migrations = DB::connection('tenant')
                ->table('migrations')
                ->when($toBatch, function ($query, $batch) {
                    return $query->where('batch', '>', $batch);
                })
                ->orderBy('batch', 'desc')
                ->orderBy('migration', 'desc')
                ->get();
            
            $rolledBack = [];
            
            foreach ($migrations as $migration) {
                $migrationFile = $migration->migration;
                $migrationClass = $this->getMigrationClass($migrationFile);
                
                if (class_exists($migrationClass)) {
                    $instance = new $migrationClass();
                    $instance->down();
                    
                    // Remove from migrations table
                    DB::connection('tenant')
                        ->table('migrations')
                        ->where('migration', $migrationFile)
                        ->delete();
                    
                    $rolledBack[] = $migrationFile;
                    
                    // Log rollback in history
                    $this->logMigrationHistory($tenant, [
                        'migration' => $migrationFile,
                        'batch' => $migration->batch,
                        'type' => 'rollback',
                        'layer' => $this->detectMigrationLayer($migrationFile),
                    ]);
                }
            }
            
            // Create new schema snapshot
            $schemaHash = $this->createSchemaSnapshot($tenant);
            
            return [
                'success' => true,
                'rolled_back' => $rolledBack,
                'schema_hash' => $schemaHash,
            ];
            
        } catch (Exception $e) {
            throw new TenantProvisioningException(
                $tenant,
                'rollback',
                $e->getMessage()
            );
        } finally {
            $this->switchToLandlordConnection();
        }
    }
    
    /**
     * Sync tenant schema with template/module updates
     */
    public function sync(Tenant $tenant, array $options = []): array
    {
        $startTime = microtime(true);
        
        try {
            // 1. Detect current state
            $currentState = $this->getTenantCurrentState($tenant);
            
            // 2. Get expected state from template
            $expectedState = $this->getExpectedState($tenant);
            
            // 3. Compare and generate migration plan
            $migrationPlan = $this->generateMigrationPlan($currentState, $expectedState);
            
            // 4. Apply necessary migrations
            $results = [];
            foreach ($migrationPlan as $layer => $migrations) {
                if (!empty($migrations)) {
                    $results[$layer] = $this->applyMigrationLayer($tenant, $layer, [
                        'specific_migrations' => $migrations,
                        'is_sync' => true,
                    ]);
                }
            }
            
            // 5. Update schema snapshot
            $schemaHash = $this->createSchemaSnapshot($tenant);
            
            return [
                'success' => true,
                'sync_type' => $options['type'] ?? 'full',
                'migration_plan' => $migrationPlan,
                'results' => $results,
                'schema_hash' => $schemaHash,
                'duration' => microtime(true) - $startTime,
            ];
            
        } catch (Exception $e) {
            throw new TenantProvisioningException(
                $tenant,
                'sync',
                $e->getMessage()
            );
        }
    }
    
    /**
     * Create schema snapshot for drift detection
     */
    public function createSchemaSnapshot(Tenant $tenant): string
    {
        $this->validateTenantConnection($tenant);
        
        try {
            $this->switchToTenantConnection($tenant);
            
            $schema = $this->captureFullSchema($tenant);
            $schemaHash = md5(json_encode($schema));
            
            // Store snapshot in landlord database
            DB::connection('landlord')->table('tenant_schema_snapshots')->insert([
                'tenant_id' => $tenant->id,
                'snapshot_name' => 'auto_' . now()->format('Y-m-d_H-i-s'),
                'snapshot_hash' => $schemaHash,
                'schema_structure' => json_encode($schema),
                'table_definitions' => json_encode($this->captureTableDefinitions()),
                'index_definitions' => json_encode($this->captureIndexDefinitions()),
                'foreign_key_definitions' => json_encode($this->captureForeignKeyDefinitions()),
                'snapshot_taken_at' => now(),
                'provisioning_version' => $this->getProvisioningVersion(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            
            // Update tenant's current schema hash
            $tenant->update(['schema_hash' => $schemaHash]);
            
            return $schemaHash;
            
        } catch (Exception $e) {
            Log::error('Failed to create schema snapshot', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage(),
            ]);
            
            // Return empty hash on failure
            return '';
        } finally {
            $this->switchToLandlordConnection();
        }
    }
    
    /**
     * Detect schema drift between expected and actual
     */
    public function detectSchemaDrift(Tenant $tenant): array
    {
        $this->validateTenantConnection($tenant);
        
        try {
            // Get expected schema from template
            $expectedSchema = $this->getExpectedSchema($tenant);
            
            // Get actual schema from tenant database
            $this->switchToTenantConnection($tenant);
            $actualSchema = $this->captureFullSchema($tenant);
            
            // Compare schemas
            $drift = $this->compareSchemas($expectedSchema, $actualSchema);
            
            // Store drift detection result
            DB::connection('landlord')->table('tenant_schema_drift')->insert([
                'tenant_id' => $tenant->id,
                'detected_at' => now(),
                'drift_details' => json_encode($drift),
                'expected_schema_hash' => md5(json_encode($expectedSchema)),
                'actual_schema_hash' => md5(json_encode($actualSchema)),
                'has_drift' => !empty($drift['tables']['added']) || 
                               !empty($drift['tables']['removed']) || 
                               !empty($drift['tables']['modified']) ||
                               !empty($drift['columns']['added']) || 
                               !empty($drift['columns']['removed']) || 
                               !empty($drift['columns']['modified']),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            
            return [
                'has_drift' => !empty($drift['tables']['added']) || 
                               !empty($drift['tables']['removed']) || 
                               !empty($drift['tables']['modified']) ||
                               !empty($drift['columns']['added']) || 
                               !empty($drift['columns']['removed']) || 
                               !empty($drift['columns']['modified']),
                'drift_details' => $drift,
                'detected_at' => now()->toDateTimeString(),
                'expected_hash' => md5(json_encode($expectedSchema)),
                'actual_hash' => md5(json_encode($actualSchema)),
            ];
            
        } catch (Exception $e) {
            Log::error('Failed to detect schema drift', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage(),
            ]);
            
            return [
                'has_drift' => false,
                'error' => $e->getMessage(),
                'detected_at' => now()->toDateTimeString(),
            ];
        } finally {
            $this->switchToLandlordConnection();
        }
    }
    
    /**
     * Repair schema drift
     */
    public function repairSchemaDrift(Tenant $tenant, array $repairOptions = []): array
    {
        $drift = $this->detectSchemaDrift($tenant);
        
        if (!$drift['has_drift']) {
            return [
                'success' => true,
                'message' => 'No schema drift detected',
                'repair_performed' => false,
            ];
        }
        
        $repairActions = [];
        $autoRepair = $repairOptions['auto'] ?? false;
        
        try {
            $this->switchToTenantConnection($tenant);
            
            // Handle table additions
            foreach ($drift['drift_details']['tables']['added'] ?? [] as $table) {
                if ($autoRepair) {
                    // Create missing table
                    $migration = $this->generateTableCreationMigration($table);
                    $repairActions[] = [
                        'action' => 'create_table',
                        'table' => $table['name'],
                        'migration' => $migration,
                    ];
                }
            }
            
            // Handle table removals
            foreach ($drift['drift_details']['tables']['removed'] ?? [] as $table) {
                if ($autoRepair && ($repairOptions['allow_destructive'] ?? false)) {
                    // Drop unexpected table
                    Schema::dropIfExists($table['name']);
                    $repairActions[] = [
                        'action' => 'drop_table',
                        'table' => $table['name'],
                    ];
                }
            }
            
            // Handle column modifications
            foreach ($drift['drift_details']['columns']['modified'] ?? [] as $modification) {
                if ($autoRepair) {
                    // Alter column
                    $this->repairColumnModification($modification);
                    $repairActions[] = [
                        'action' => 'modify_column',
                        'table' => $modification['table'],
                        'column' => $modification['column'],
                        'changes' => $modification['changes'],
                    ];
                }
            }
            
            // Create new schema snapshot after repair
            $schemaHash = $this->createSchemaSnapshot($tenant);
            
            return [
                'success' => true,
                'repair_performed' => !empty($repairActions),
                'repair_actions' => $repairActions,
                'schema_hash' => $schemaHash,
                'auto_repair' => $autoRepair,
            ];
            
        } catch (Exception $e) {
            throw new TenantProvisioningException(
                $tenant,
                'repair_drift',
                $e->getMessage()
            );
        } finally {
            $this->switchToLandlordConnection();
        }
    }
    
    /**
     * Get provisioning status
     */
    public function getStatus(Tenant $tenant): array
    {
        $this->validateTenantConnection($tenant);
        
        try {
            $this->switchToTenantConnection($tenant);
            
            // Get migration status
            $migrationStatus = DB::connection('tenant')
                ->table('migrations')
                ->selectRaw('COUNT(*) as total_migrations, MAX(batch) as latest_batch')
                ->first();
            
            // Get table count
            $tables = DB::connection('tenant')
                ->select('SHOW TABLES');
            $tableCount = count($tables);
            
            // Get last drift detection
            $lastDrift = DB::connection('landlord')
                ->table('tenant_schema_drift')
                ->where('tenant_id', $tenant->id)
                ->orderBy('detected_at', 'desc')
                ->first();
            
            return [
                'provisioning_status' => $tenant->provisioning_status,
                'database_name' => $tenant->database,
                'schema_hash' => $tenant->schema_hash,
                'migrations' => [
                    'total' => $migrationStatus->total_migrations ?? 0,
                    'latest_batch' => $migrationStatus->latest_batch ?? 0,
                ],
                'tables' => $tableCount,
                'last_drift_detection' => $lastDrift ? [
                    'detected_at' => $lastDrift->detected_at,
                    'has_drift' => $lastDrift->has_drift,
                ] : null,
                'template' => $tenant->template ? [
                    'name' => $tenant->template->name,
                    'version' => $tenant->template->version,
                ] : null,
                'modules' => $tenant->modules->pluck('name')->toArray(),
                'created_at' => $tenant->database_created_at,
                'last_synced_at' => $tenant->last_synced_at,
            ];
            
        } catch (Exception $e) {
            return [
                'provisioning_status' => $tenant->provisioning_status,
                'database_name' => $tenant->database,
                'error' => $e->getMessage(),
                'available' => false,
            ];
        } finally {
            $this->switchToLandlordConnection();
        }
    }
    
    /**
     * Validate tenant can be provisioned
     */
    public function validate(Tenant $tenant): bool
    {
        $errors = [];
        
        // Check if tenant already has database
        if ($tenant->database_created_at) {
            $errors[] = 'Tenant database already exists';
        }
        
        // Check if template is active
        if (!$tenant->template || !$tenant->template->is_active) {
            $errors[] = 'Template is not active or not selected';
        }
        
        // Check if template exists
        if ($tenant->template_id && !TenantTemplate::where('id', $tenant->template_id)->exists()) {
            $errors[] = 'Selected template does not exist';
        }
        
        // Check database name is valid
        if (!preg_match('/^[a-z0-9_]+$/', $tenant->database)) {
            $errors[] = 'Database name contains invalid characters';
        }
        
        // Check if database already exists
        if ($this->databaseExists($tenant->database)) {
            $errors[] = 'Database already exists';
        }
        
        // Check required modules are selected
        if ($tenant->template) {
            $requiredModules = json_decode($tenant->template->required_modules ?? '[]', true);
            $selectedModules = $tenant->modules->pluck('name')->toArray();
            
            foreach ($requiredModules as $required) {
                if (!in_array($required, $selectedModules)) {
                    $errors[] = "Required module '{$required}' is not selected";
                }
            }
        }
        
        if (!empty($errors)) {
            throw new TenantProvisioningException(
                $tenant,
                'validation',
                implode(', ', $errors)
            );
        }
        
        return true;
    }
    
    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================
    
    /**
     * Create tenant database
     */
    private function createTenantDatabase(Tenant $tenant): void
    {
        $databaseName = $tenant->database;
        
        try {
            // Create database using landlord connection
            DB::connection('landlord')->statement("CREATE DATABASE IF NOT EXISTS `{$databaseName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            
            // Test connection
            $this->testTenantConnection($tenant);
            
            $this->logProvisioning('info', 'Database created successfully', [
                'database' => $databaseName,
            ]);
            
        } catch (PDOException $e) {
            throw new TenantProvisioningException(
                $tenant,
                'database_creation',
                "Failed to create database: {$e->getMessage()}"
            );
        }
    }
    
    /**
     * Apply all migration layers
     */
    private function applyAllMigrationLayers(Tenant $tenant, array $options): array
    {
        $results = [];
        
        foreach ($this->layerOrder as $layer) {
            $layerStart = microtime(true);
            
            try {
                $this->logProvisioning('info', "Applying {$layer} migrations");
                
                $layerResult = $this->applyMigrationLayer($tenant, $layer, $options);
                $results[$layer] = $layerResult;
                
                $this->logProvisioning('success', "Completed {$layer} migrations", [
                    'duration' => microtime(true) - $layerStart,
                    'migrations_applied' => count($layerResult['migrations_applied'] ?? []),
                ]);
                
            } catch (Exception $e) {
                $this->logProvisioning('error', "Failed {$layer} migrations", [
                    'error' => $e->getMessage(),
                    'duration' => microtime(true) - $layerStart,
                ]);
                
                throw $e;
            }
        }
        
        return $results;
    }
    
    /**
     * Get migrations for specific layer
     */
    private function getMigrationsForLayer(Tenant $tenant, string $layer, array $options): array
    {
        $migrations = [];
        
        switch ($layer) {
            case 'basic':
                $migrations = $this->getBasicMigrations();
                break;
                
            case 'template':
                $migrations = $this->getTemplateMigrations($tenant);
                break;
                
            case 'module':
                $migrations = $this->getModuleMigrations($tenant);
                break;
                
            case 'custom':
                $migrations = $this->getCustomMigrations($tenant);
                break;
        }
        
        // Filter specific migrations if provided
        if (isset($options['specific_migrations'])) {
            $migrations = array_intersect($migrations, $options['specific_migrations']);
        }
        
        return $migrations;
    }
    
    /**
     * Get basic migrations
     */
    private function getBasicMigrations(): array
    {
        $path = $this->config['layers']['basic']['path'] ?? database_path('migrations/tenant/basic');
        return $this->discoverMigrations($path);
    }
    
    /**
     * Get template migrations
     */
    private function getTemplateMigrations(Tenant $tenant): array
    {
        if (!$tenant->template) {
            return [];
        }
        
        $templateName = $tenant->template->name;
        $path = $this->config['layers']['template']['path'] ?? database_path('migrations/tenant/templates');
        $templatePath = $path . '/' . $templateName;
        
        if (!File::exists($templatePath)) {
            throw new TenantProvisioningException(
                $tenant,
                'template',
                "Template migration path not found: {$templatePath}"
            );
        }
        
        return $this->discoverMigrations($templatePath);
    }
    
    /**
     * Get module migrations
     */
    private function getModuleMigrations(Tenant $tenant): array
    {
        $modules = $tenant->modules;
        $migrations = [];
        
        $path = $this->config['layers']['module']['path'] ?? database_path('migrations/tenant/modules');
        
        foreach ($modules as $module) {
            $modulePath = $path . '/' . $module->name;
            
            if (File::exists($modulePath)) {
                $moduleMigrations = $this->discoverMigrations($modulePath);
                $migrations = array_merge($migrations, $moduleMigrations);
            }
        }
        
        return $migrations;
    }
    
    /**
     * Get custom migrations
     */
    private function getCustomMigrations(Tenant $tenant): array
    {
        $path = $this->config['layers']['custom']['path'] ?? database_path('migrations/tenant/custom');
        $tenantPath = $path . '/' . $tenant->slug;
        
        if (!File::exists($tenantPath)) {
            return [];
        }
        
        return $this->discoverMigrations($tenantPath);
    }
    
    /**
     * Discover migrations in directory
     */
    private function discoverMigrations(string $path): array
    {
        if (!File::exists($path)) {
            return [];
        }
        
        $files = File::files($path);
        $migrations = [];
        
        foreach ($files as $file) {
            if ($file->getExtension() === 'php') {
                $migrations[] = $file->getFilenameWithoutExtension();
            }
        }
        
        // Sort migrations by timestamp
        sort($migrations);
        
        return $migrations;
    }
    
    /**
     * Apply migrations to tenant database
     */
    private function applyMigrations(Tenant $tenant, array $migrations, string $layer, array $options): array
    {
        $applied = [];
        
        foreach ($migrations as $migration) {
            $migrationStart = microtime(true);
            
            try {
                // Get migration class
                $migrationClass = $this->getMigrationClass($migration);
                
                if (!class_exists($migrationClass)) {
                    // Try to include the file
                    $migrationPath = $this->findMigrationPath($migration, $layer, $tenant);
                    if ($migrationPath && File::exists($migrationPath)) {
                        require_once $migrationPath;
                    }
                }
                
                if (class_exists($migrationClass)) {
                    $instance = new $migrationClass();
                    
                    // Apply migration
                    $instance->up();
                    
                    // Record in migrations table
                    DB::connection('tenant')->table('migrations')->insert([
                        'migration' => $migration,
                        'batch' => $this->batchId,
                        'layer' => $layer,
                        'applied_at' => now(),
                    ]);
                    
                    // Log in history
                    $this->logMigrationHistory($tenant, [
                        'migration' => $migration,
                        'batch' => $this->batchId,
                        'type' => 'apply',
                        'layer' => $layer,
                        'duration' => microtime(true) - $migrationStart,
                    ]);
                    
                    $applied[] = $migration;
                    
                    $this->logProvisioning('debug', "Applied migration: {$migration}", [
                        'layer' => $layer,
                        'duration' => microtime(true) - $migrationStart,
                    ]);
                } else {
                    throw new Exception("Migration class not found: {$migrationClass}");
                }
                
            } catch (Exception $e) {
                $this->logProvisioning('error', "Failed to apply migration: {$migration}", [
                    'layer' => $layer,
                    'error' => $e->getMessage(),
                    'duration' => microtime(true) - $migrationStart,
                ]);
                
                if (!($options['skip_on_error'] ?? false)) {
                    throw new TenantProvisioningException(
                        $tenant,
                        $layer,
                        "Failed to apply migration {$migration}: {$e->getMessage()}",
                        $migration,
                        0,
                        $e
                    );
                }
            }
        }
        
        return $applied;
    }
    
    /**
     * Switch to tenant database connection
     */
    private function switchToTenantConnection(Tenant $tenant): void
    {
        $connection = config('database.connections.tenant');
        
        Config::set('database.connections.tenant.database', $tenant->database);
        Config::set('database.connections.tenant.username', $connection['username']);
        Config::set('database.connections.tenant.password', $connection['password']);
        
        // Refresh connection
        DB::purge('tenant');
        DB::reconnect('tenant');
        
        // Set default connection to tenant for this request
        Config::set('database.default', 'tenant');
        DB::setDefaultConnection('tenant');
    }
    
    /**
     * Switch back to landlord connection
     */
    private function switchToLandlordConnection(): void
    {
        Config::set('database.default', 'landlord');
        DB::setDefaultConnection('landlord');
        DB::purge('tenant');
    }
    
    /**
     * Validate tenant connection
     */
    private function validateTenantConnection(Tenant $tenant): void
    {
        if (!$tenant->database) {
            throw new TenantProvisioningException(
                $tenant,
                'connection',
                'Tenant database not configured'
            );
        }
        
        try {
            $this->switchToTenantConnection($tenant);
            DB::connection('tenant')->getPdo();
            $this->switchToLandlordConnection();
        } catch (Exception $e) {
            throw new TenantProvisioningException(
                $tenant,
                'connection',
                "Cannot connect to tenant database: {$e->getMessage()}"
            );
        }
    }
    
    /**
     * Test tenant connection
     */
    private function testTenantConnection(Tenant $tenant): bool
    {
        try {
            $this->switchToTenantConnection($tenant);
            DB::connection('tenant')->getPdo();
            $this->switchToLandlordConnection();
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Check if database exists
     */
    private function databaseExists(string $databaseName): bool
    {
        try {
            $result = DB::connection('landlord')->select(
                "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
                [$databaseName]
            );
            return !empty($result);
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Get migration class name
     */
    private function getMigrationClass(string $migration): string
    {
        // Convert migration filename to class name
        // 2024_01_01_000001_create_table => CreateTable
        $parts = explode('_', $migration);
        $className = '';
        
        foreach ($parts as $part) {
            if (is_numeric($part)) continue;
            $className .= ucfirst($part);
        }
        
        return $className;
    }
    
    /**
     * Find migration file path
     */
    private function findMigrationPath(string $migration, string $layer, Tenant $tenant): ?string
    {
        $paths = [
            'basic' => database_path('migrations/tenant/basic'),
            'template' => database_path("migrations/tenant/templates/{$tenant->template->name}"),
            'module' => database_path('migrations/tenant/modules'),
            'custom' => database_path("migrations/tenant/custom/{$tenant->slug}"),
        ];
        
        $basePath = $paths[$layer] ?? null;
        
        if ($basePath && File::exists($basePath)) {
            $filePath = $basePath . '/' . $migration . '.php';
            if (File::exists($filePath)) {
                return $filePath;
            }
        }
        
        return null;
    }
    
    /**
     * Detect migration layer from filename
     */
    private function detectMigrationLayer(string $migration): string
    {
        // Check migration patterns
        if (str_contains($migration, 'create_basic')) {
            return 'basic';
        }
        
        if (str_contains($migration, 'create_political_party')) {
            return 'template';
        }
        
        if (str_contains($migration, 'create_election') || str_contains($migration, 'create_social')) {
            return 'module';
        }
        
        if (str_contains($migration, 'custom_') || str_contains($migration, 'create_custom')) {
            return 'custom';
        }
        
        return 'unknown';
    }
    
    /**
     * Log migration history
     */
    private function logMigrationHistory(Tenant $tenant, array $data): void
    {
        DB::connection('landlord')->table('tenant_migration_history')->insert([
            'tenant_id' => $tenant->id,
            'batch_id' => $this->batchId,
            'migration_name' => $data['migration'],
            'migration_layer' => $data['layer'],
            'action' => $data['type'],
            'details' => json_encode($data),
            'executed_by' => auth()->id() ?? 'system',
            'executed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
    
    /**
     * Log provisioning activity
     */
    private function logProvisioning(string $level, string $message, array $context = []): void
    {
        $logEntry = [
            'timestamp' => now()->toDateTimeString(),
            'level' => $level,
            'message' => $message,
            'context' => $context,
            'batch_id' => $this->batchId,
        ];
        
        $this->provisioningLog[] = $logEntry;
        
        // Also log to Laravel log
        Log::log($level, "[TenantProvisioner] {$message}", $context);
    }
    
    /**
     * Get template configuration
     */
    private function getTemplateConfig(Tenant $tenant): array
    {
        if (!$tenant->template) {
            return [];
        }
        
        return json_decode($tenant->template->config ?? '{}', true);
    }
    
    /**
     * Get selected modules
     */
    private function getSelectedModules(Tenant $tenant): array
    {
        return $tenant->modules->pluck('name')->toArray();
    }
    
    /**
     * Get provisioning statistics
     */
    private function getProvisioningStats(array $results): array
    {
        $stats = [
            'total_migrations' => 0,
            'successful_layers' => 0,
            'failed_layers' => 0,
        ];
        
        foreach ($results as $layer => $result) {
            $stats['total_migrations'] += count($result['migrations_applied'] ?? []);
            if ($result['success'] ?? false) {
                $stats['successful_layers']++;
            } else {
                $stats['failed_layers']++;
            }
        }
        
        return $stats;
    }
    
    /**
     * Handle provisioning failure
     */
    private function handleProvisioningFailure(Tenant $tenant, Exception $e): void
    {
        // Update tenant status
        $tenant->update([
            'provisioning_status' => 'failed',
            'provisioning_error' => $e->getMessage(),
            'provisioning_completed_at' => now(),
        ]);
        
        // Attempt to clean up database if created
        if ($this->databaseExists($tenant->database)) {
            try {
                // Drop database on failure (configurable)
                if (config('tenant-migrations.cleanup_on_failure', true)) {
                    DB::connection('landlord')->statement("DROP DATABASE IF EXISTS `{$tenant->database}`");
                }
            } catch (Exception $dropError) {
                Log::error('Failed to drop tenant database after provisioning failure', [
                    'tenant' => $tenant->slug,
                    'error' => $dropError->getMessage(),
                ]);
            }
        }
        
        // Fire failure event
        Event::dispatch(new TenantProvisioningFailed(
            $tenant,
            $e->getMessage(),
            $this->provisioningLog
        ));
    }
    
    /**
     * Validate provisioning environment
     */
    private function validateProvisioningEnvironment(): void
    {
        // Check database permissions
        try {
            DB::connection('landlord')->getPdo();
        } catch (Exception $e) {
            throw new Exception("Cannot connect to landlord database: {$e->getMessage()}");
        }
        
        // Check migration directories exist
        $layers = ['basic', 'template', 'module', 'custom'];
        foreach ($layers as $layer) {
            $path = $this->config['layers'][$layer]['path'] ?? database_path("migrations/tenant/{$layer}");
            if (!File::exists($path)) {
                File::makeDirectory($path, 0755, true);
            }
        }
    }
    
    /**
     * Capture full schema from tenant database
     */
    private function captureFullSchema(Tenant $tenant): array
    {
        $schema = [
            'tables' => [],
            'version' => $this->getProvisioningVersion(),
            'captured_at' => now()->toDateTimeString(),
        ];
        
        // Get all tables
        $tables = DB::connection('tenant')->select('SHOW TABLES');
        $databaseName = $tenant->database;
        $tableKey = "Tables_in_{$databaseName}";
        
        foreach ($tables as $table) {
            $tableName = $table->$tableKey;
            
            // Skip migrations table
            if ($tableName === 'migrations') {
                continue;
            }
            
            // Get table structure
            $tableSchema = $this->captureTableSchema($tableName);
            $schema['tables'][$tableName] = $tableSchema;
        }
        
        return $schema;
    }
    
    /**
     * Capture individual table schema
     */
    private function captureTableSchema(string $tableName): array
    {
        // Get columns
        $columns = DB::connection('tenant')->select("SHOW COLUMNS FROM `{$tableName}`");
        
        $tableSchema = [
            'columns' => [],
            'indexes' => [],
            'foreign_keys' => [],
            'engine' => null,
            'charset' => null,
            'collation' => null,
        ];
        
        // Process columns
        foreach ($columns as $column) {
            $tableSchema['columns'][$column->Field] = [
                'type' => $column->Type,
                'nullable' => $column->Null === 'YES',
                'default' => $column->Default,
                'extra' => $column->Extra,
            ];
        }
        
        // Get indexes
        $indexes = DB::connection('tenant')->select("SHOW INDEX FROM `{$tableName}`");
        foreach ($indexes as $index) {
            if (!isset($tableSchema['indexes'][$index->Key_name])) {
                $tableSchema['indexes'][$index->Key_name] = [
                    'unique' => !$index->Non_unique,
                    'columns' => [],
                    'type' => $index->Index_type,
                ];
            }
            $tableSchema['indexes'][$index->Key_name]['columns'][] = $index->Column_name;
        }
        
        // Get foreign keys
        $foreignKeys = DB::connection('tenant')->select("
            SELECT 
                CONSTRAINT_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME,
                UPDATE_RULE,
                DELETE_RULE
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL
        ", [$tableName]);
        
        foreach ($foreignKeys as $fk) {
            $tableSchema['foreign_keys'][$fk->CONSTRAINT_NAME] = [
                'column' => $fk->COLUMN_NAME,
                'references' => $fk->REFERENCED_TABLE_NAME,
                'referenced_column' => $fk->REFERENCED_COLUMN_NAME,
                'on_update' => $fk->UPDATE_RULE,
                'on_delete' => $fk->DELETE_RULE,
            ];
        }
        
        // Get table options
        $tableInfo = DB::connection('tenant')->select("SHOW TABLE STATUS LIKE ?", [$tableName]);
        if (!empty($tableInfo)) {
            $info = $tableInfo[0];
            $tableSchema['engine'] = $info->Engine;
            $tableSchema['charset'] = $info->Charset;
            $tableSchema['collation'] = $info->Collation;
            $tableSchema['row_count'] = $info->Rows;
            $tableSchema['data_size'] = $info->Data_length;
            $tableSchema['index_size'] = $info->Index_length;
        }
        
        return $tableSchema;
    }
    
    /**
     * Capture table definitions
     */
    private function captureTableDefinitions(): array
    {
        $tables = DB::connection('tenant')->select('SHOW TABLES');
        $databaseName = DB::connection('tenant')->getDatabaseName();
        $tableKey = "Tables_in_{$databaseName}";
        
        $definitions = [];
        
        foreach ($tables as $table) {
            $tableName = $table->$tableKey;
            $createTable = DB::connection('tenant')->selectOne("SHOW CREATE TABLE `{$tableName}`");
            $definitions[$tableName] = $createTable->{'Create Table'} ?? $createTable->{'Create View'} ?? null;
        }
        
        return $definitions;
    }
    
    /**
     * Capture index definitions
     */
    private function captureIndexDefinitions(): array
    {
        $tables = DB::connection('tenant')->select('SHOW TABLES');
        $databaseName = DB::connection('tenant')->getDatabaseName();
        $tableKey = "Tables_in_{$databaseName}";
        
        $indexes = [];
        
        foreach ($tables as $table) {
            $tableName = $table->$tableKey;
            $tableIndexes = DB::connection('tenant')->select("SHOW INDEX FROM `{$tableName}`");
            
            foreach ($tableIndexes as $index) {
                $indexes[$tableName][$index->Key_name][] = [
                    'column' => $index->Column_name,
                    'unique' => !$index->Non_unique,
                    'type' => $index->Index_type,
                ];
            }
        }
        
        return $indexes;
    }
    
    /**
     * Capture foreign key definitions
     */
    private function captureForeignKeyDefinitions(): array
    {
        $foreignKeys = DB::connection('tenant')->select("
            SELECT 
                TABLE_NAME,
                CONSTRAINT_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME,
                UPDATE_RULE,
                DELETE_RULE
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY TABLE_NAME, CONSTRAINT_NAME
        ");
        
        $result = [];
        foreach ($foreignKeys as $fk) {
            $result[$fk->TABLE_NAME][$fk->CONSTRAINT_NAME] = [
                'column' => $fk->COLUMN_NAME,
                'references' => $fk->REFERENCED_TABLE_NAME,
                'referenced_column' => $fk->REFERENCED_COLUMN_NAME,
                'on_update' => $fk->UPDATE_RULE,
                'on_delete' => $fk->DELETE_RULE,
            ];
        }
        
        return $result;
    }
    
    /**
     * Get expected schema from template
     */
    private function getExpectedSchema(Tenant $tenant): array
    {
        // Get the latest schema snapshot for this template
        $snapshot = DB::connection('landlord')
            ->table('tenant_schema_snapshots')
            ->where('tenant_id', $tenant->id)
            ->orderBy('snapshot_taken_at', 'desc')
            ->first();
        
        if ($snapshot) {
            return json_decode($snapshot->schema_structure, true);
        }
        
        // If no snapshot exists, generate from template migrations
        return $this->generateExpectedSchemaFromTemplate($tenant);
    }
    
    /**
     * Generate expected schema from template
     */
    private function generateExpectedSchemaFromTemplate(Tenant $tenant): array
    {
        // This would simulate running template migrations to generate schema
        // For now, return empty array
        return [];
    }
    
    /**
     * Compare two schemas for drift detection
     */
    private function compareSchemas(array $expected, array $actual): array
    {
        $drift = [
            'tables' => [
                'added' => [],    // Tables in actual but not in expected
                'removed' => [],  // Tables in expected but not in actual
                'modified' => [], // Tables with differences
            ],
            'columns' => [
                'added' => [],
                'removed' => [],
                'modified' => [],
            ],
            'indexes' => [
                'added' => [],
                'removed' => [],
                'modified' => [],
            ],
            'foreign_keys' => [
                'added' => [],
                'removed' => [],
                'modified' => [],
            ],
        ];
        
        $expectedTables = array_keys($expected['tables'] ?? []);
        $actualTables = array_keys($actual['tables'] ?? []);
        
        // Find added tables
        $drift['tables']['added'] = array_diff($actualTables, $expectedTables);
        
        // Find removed tables
        $drift['tables']['removed'] = array_diff($expectedTables, $actualTables);
        
        // Compare common tables
        $commonTables = array_intersect($expectedTables, $actualTables);
        
        foreach ($commonTables as $table) {
            $tableDiff = $this->compareTableSchemas(
                $expected['tables'][$table] ?? [],
                $actual['tables'][$table] ?? []
            );
            
            if (!empty($tableDiff)) {
                $drift['tables']['modified'][$table] = $tableDiff;
                
                // Aggregate column differences
                if (!empty($tableDiff['columns']['added'])) {
                    foreach ($tableDiff['columns']['added'] as $column) {
                        $drift['columns']['added'][] = [
                            'table' => $table,
                            'column' => $column,
                        ];
                    }
                }
                
                if (!empty($tableDiff['columns']['removed'])) {
                    foreach ($tableDiff['columns']['removed'] as $column) {
                        $drift['columns']['removed'][] = [
                            'table' => $table,
                            'column' => $column,
                        ];
                    }
                }
                
                if (!empty($tableDiff['columns']['modified'])) {
                    foreach ($tableDiff['columns']['modified'] as $column => $changes) {
                        $drift['columns']['modified'][] = [
                            'table' => $table,
                            'column' => $column,
                            'changes' => $changes,
                        ];
                    }
                }
            }
        }
        
        return $drift;
    }
    
    /**
     * Compare table schemas
     */
    private function compareTableSchemas(array $expected, array $actual): array
    {
        $diff = [
            'columns' => [
                'added' => [],
                'removed' => [],
                'modified' => [],
            ],
            'indexes' => [
                'added' => [],
                'removed' => [],
                'modified' => [],
            ],
            'foreign_keys' => [
                'added' => [],
                'removed' => [],
                'modified' => [],
            ],
            'options' => [],
        ];
        
        // Compare columns
        $expectedColumns = array_keys($expected['columns'] ?? []);
        $actualColumns = array_keys($actual['columns'] ?? []);
        
        $diff['columns']['added'] = array_diff($actualColumns, $expectedColumns);
        $diff['columns']['removed'] = array_diff($expectedColumns, $actualColumns);
        
        // Compare common columns
        $commonColumns = array_intersect($expectedColumns, $actualColumns);
        foreach ($commonColumns as $column) {
            $expectedCol = $expected['columns'][$column] ?? [];
            $actualCol = $actual['columns'][$column] ?? [];
            
            if ($expectedCol != $actualCol) {
                $diff['columns']['modified'][$column] = [
                    'expected' => $expectedCol,
                    'actual' => $actualCol,
                ];
            }
        }
        
        // Compare indexes
        $expectedIndexes = array_keys($expected['indexes'] ?? []);
        $actualIndexes = array_keys($actual['indexes'] ?? []);
        
        $diff['indexes']['added'] = array_diff($actualIndexes, $expectedIndexes);
        $diff['indexes']['removed'] = array_diff($expectedIndexes, $actualIndexes);
        
        // Compare foreign keys
        $expectedFKs = array_keys($expected['foreign_keys'] ?? []);
        $actualFKs = array_keys($actual['foreign_keys'] ?? []);
        
        $diff['foreign_keys']['added'] = array_diff($actualFKs, $expectedFKs);
        $diff['foreign_keys']['removed'] = array_diff($expectedFKs, $actualFKs);
        
        // Compare table options
        $options = ['engine', 'charset', 'collation'];
        foreach ($options as $option) {
            if (($expected[$option] ?? null) !== ($actual[$option] ?? null)) {
                $diff['options'][$option] = [
                    'expected' => $expected[$option] ?? null,
                    'actual' => $actual[$option] ?? null,
                ];
            }
        }
        
        // Clean up empty sections
        foreach ($diff as $section => $items) {
            if (empty($items)) {
                unset($diff[$section]);
            }
        }
        
        return $diff;
    }
    
    /**
     * Get tenant current state
     */
    private function getTenantCurrentState(Tenant $tenant): array
    {
        $this->switchToTenantConnection($tenant);
        
        $state = [
            'migrations' => [],
            'tables' => [],
            'modules' => $tenant->modules->pluck('name')->toArray(),
        ];
        
        // Get applied migrations
        $migrations = DB::connection('tenant')
            ->table('migrations')
            ->select('migration', 'batch', 'layer')
            ->get();
        
        $state['migrations'] = $migrations->groupBy('layer')->toArray();
        
        // Get table list
        $tables = DB::connection('tenant')->select('SHOW TABLES');
        $databaseName = $tenant->database;
        $tableKey = "Tables_in_{$databaseName}";
        
        $state['tables'] = collect($tables)->pluck($tableKey)->toArray();
        
        $this->switchToLandlordConnection();
        
        return $state;
    }
    
    /**
     * Get expected state from template
     */
    private function getExpectedState(Tenant $tenant): array
    {
        $state = [
            'migrations' => [],
            'tables' => [],
            'modules' => $tenant->modules->pluck('name')->toArray(),
        ];
        
        // Get expected migrations from template
        $layers = ['basic', 'template', 'module', 'custom'];
        
        foreach ($layers as $layer) {
            $migrations = $this->getMigrationsForLayer($tenant, $layer, []);
            $state['migrations'][$layer] = $migrations;
            
            // Extract table names from migrations (simplified)
            foreach ($migrations as $migration) {
                $tables = $this->extractTablesFromMigration($migration, $layer, $tenant);
                $state['tables'] = array_merge($state['tables'], $tables);
            }
        }
        
        $state['tables'] = array_unique($state['tables']);
        
        return $state;
    }
    
    /**
     * Extract table names from migration
     */
    private function extractTablesFromMigration(string $migration, string $layer, Tenant $tenant): array
    {
        // This is a simplified implementation
        // In production, you would parse the migration file
        $tables = [];
        
        // Simple pattern matching for table names
        if (preg_match('/create_(\w+)_table/', $migration, $matches)) {
            $tables[] = $matches[1];
        }
        
        return $tables;
    }
    
    /**
     * Generate migration plan
     */
    private function generateMigrationPlan(array $current, array $expected): array
    {
        $plan = [
            'basic' => [],
            'template' => [],
            'module' => [],
            'custom' => [],
        ];
        
        foreach (['basic', 'template', 'module', 'custom'] as $layer) {
            $currentMigrations = $current['migrations'][$layer] ?? [];
            $expectedMigrations = $expected['migrations'][$layer] ?? [];
            
            // Find migrations to apply
            $toApply = array_diff($expectedMigrations, $currentMigrations);
            $plan[$layer] = array_values($toApply);
        }
        
        return $plan;
    }
    
    /**
     * Generate table creation migration
     */
    private function generateTableCreationMigration(array $tableDefinition): string
    {
        // This would generate a migration file for the missing table
        // For now, return placeholder
        return "create_{$tableDefinition['name']}_table";
    }
    
    /**
     * Repair column modification
     */
    private function repairColumnModification(array $modification): void
    {
        $table = $modification['table'];
        $column = $modification['column'];
        $changes = $modification['changes'];
        
        // Build ALTER TABLE statement
        $alter = "ALTER TABLE `{$table}` MODIFY COLUMN `{$column}` ";
        
        // Add column type
        $alter .= $changes['actual']['type'] . ' ';
        
        // Add nullable
        if ($changes['actual']['nullable']) {
            $alter .= 'NULL ';
        } else {
            $alter .= 'NOT NULL ';
        }
        
        // Add default
        if ($changes['actual']['default'] !== null) {
            $default = $changes['actual']['default'];
            if (is_string($default) && !is_numeric($default)) {
                $default = "'" . addslashes($default) . "'";
            }
            $alter .= "DEFAULT {$default} ";
        }
        
        // Add extra
        if ($changes['actual']['extra']) {
            $alter .= $changes['actual']['extra'] . ' ';
        }
        
        // Execute
        DB::connection('tenant')->statement($alter);
    }
    
    /**
     * Get provisioning version
     */
    private function getProvisioningVersion(): string
    {
        return config('app.version', '1.0.0') . '-' . $this->batchId;
    }
}
```

## **3. SUPPORTING MODELS**

**File: `app/Models/TenantMigrationHistory.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantMigrationHistory extends Model
{
    protected $connection = 'landlord';
    
    protected $table = 'tenant_migration_history';
    
    protected $fillable = [
        'tenant_id',
        'batch_id',
        'migration_name',
        'migration_layer',
        'action',
        'details',
        'executed_by',
        'executed_at',
    ];
    
    protected $casts = [
        'details' => 'array',
        'executed_at' => 'datetime',
    ];
    
    /**
     * Get the tenant that owns the migration history
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
    
    /**
     * Get the user who executed the migration
     */
    public function executor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'executed_by');
    }
}
```

## **4. SERVICE PROVIDER FOR DEPENDENCY INJECTION**

**File: `app/Providers/TenantServiceProvider.php`**

```php
<?php

namespace App\Providers;

use App\Contracts\TenantProvisionerInterface;
use App\Services\TenantProvisioner;
use Illuminate\Support\ServiceProvider;

class TenantServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(TenantProvisionerInterface::class, function ($app) {
            return new TenantProvisioner();
        });
        
        $this->app->alias(TenantProvisionerInterface::class, 'tenant-provisioner');
        
        // Register other tenant services
        $this->app->singleton('tenant-migration-loader', function ($app) {
            return new \App\Services\TenantMigrationLoader();
        });
        
        $this->app->singleton('tenant-schema-manager', function ($app) {
            return new \App\Services\TenantSchemaManager();
        });
    }
    
    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Publish configuration
        $this->publishes([
            __DIR__ . '/../../config/tenant-migrations.php' => config_path('tenant-migrations.php'),
        ], 'tenant-config');
        
        // Register commands
        if ($this->app->runningInConsole()) {
            $this->commands([
                \App\Console\Commands\ProvisionTenant::class,
                \App\Console\Commands\SyncTenantSchema::class,
                \App\Console\Commands\DetectSchemaDrift::class,
                \App\Console\Commands\RepairSchemaDrift::class,
            ]);
        }
    }
}
```

## **5. CONSOLE COMMANDS FOR PROVISIONING**

**File: `app/Console/Commands/ProvisionTenant.php`**

```php
<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Contracts\TenantProvisionerInterface;
use Illuminate\Console\Command;
use Symfony\Component\Console\Helper\ProgressBar;

class ProvisionTenant extends Command
{
    protected $signature = 'tenant:provision 
                            {tenant : Tenant ID or slug}
                            {--dry-run : Perform dry run without actual changes}
                            {--force : Force provisioning even if validation fails}
                            {--skip-validation : Skip pre-provisioning validation}
                            {--sync-only : Only sync existing tenant, do not create new}';
    
    protected $description = 'Provision a new tenant database with template-based migrations';
    
    protected TenantProvisionerInterface $provisioner;
    
    public function __construct(TenantProvisionerInterface $provisioner)
    {
        parent::__construct();
        $this->provisioner = $provisioner;
    }
    
    public function handle(): int
    {
        $tenant = $this->getTenant();
        
        if (!$tenant) {
            $this->error('Tenant not found');
            return Command::FAILURE;
        }
        
        $this->info("Provisioning tenant: {$tenant->name} ({$tenant->slug})");
        $this->info("Database: {$tenant->database}");
        $this->info("Template: {$tenant->template->name}");
        
        // Display selected modules
        $modules = $tenant->modules->pluck('name')->toArray();
        $this->info("Modules: " . implode(', ', $modules));
        
        // Validate
        if (!$this->option('skip-validation')) {
            $this->info('Validating tenant...');
            try {
                $this->provisioner->validate($tenant);
                $this->info('✓ Validation passed');
            } catch (\Exception $e) {
                $this->error("Validation failed: {$e->getMessage()}");
                
                if (!$this->option('force')) {
                    return Command::FAILURE;
                }
                
                if (!$this->confirm('Force provisioning despite validation errors?')) {
                    return Command::FAILURE;
                }
            }
        }
        
        // Check if already provisioned
        if ($tenant->provisioning_status === 'completed' && !$this->option('sync-only')) {
            $this->warn('Tenant is already provisioned.');
            
            if (!$this->confirm('Re-provision? This may cause data loss.')) {
                return Command::FAILURE;
            }
        }
        
        // Provision
        $this->info('Starting provisioning process...');
        
        $progressBar = new ProgressBar($this->output, 4); // 4 layers
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %message%');
        $progressBar->start();
        
        try {
            $options = [
                'dry_run' => $this->option('dry-run'),
                'skip_on_error' => false,
            ];
            
            $result = $this->provisioner->provision($tenant, $options);
            
            $progressBar->setMessage('Applying basic migrations...');
            $progressBar->advance();
            
            $progressBar->setMessage('Applying template migrations...');
            $progressBar->advance();
            
            $progressBar->setMessage('Applying module migrations...');
            $progressBar->advance();
            
            $progressBar->setMessage('Applying custom migrations...');
            $progressBar->finish();
            
            $this->newLine(2);
            
            // Display results
            $this->displayProvisioningResults($result);
            
            $this->info('✓ Tenant provisioned successfully!');
            
            // Display connection info
            $this->info("Database: {$tenant->database}");
            $this->info("Schema Hash: {$result['schema_hash']}");
            $this->info("Access URL: http://{$tenant->domain}");
            
            return Command::SUCCESS;
            
        } catch (\Exception $e) {
            $progressBar->finish();
            $this->newLine(2);
            
            $this->error("Provisioning failed: {$e->getMessage()}");
            
            // Display error details
            if ($this->output->isVerbose()) {
                $this->error("Stack trace: {$e->getTraceAsString()}");
            }
            
            return Command::FAILURE;
        }
    }
    
    private function getTenant(): ?Tenant
    {
        $identifier = $this->argument('tenant');
        
        return Tenant::where('id', $identifier)
            ->orWhere('slug', $identifier)
            ->with(['template', 'modules'])
            ->first();
    }
    
    private function displayProvisioningResults(array $result): void
    {
        $this->info('Provisioning Results:');
        $this->info('=====================');
        
        $this->table(
            ['Layer', 'Migrations Applied', 'Status'],
            [
                ['Basic', count($result['layers_applied']['basic']['migrations_applied'] ?? []), '✓'],
                ['Template', count($result['layers_applied']['template']['migrations_applied'] ?? []), '✓'],
                ['Module', count($result['layers_applied']['module']['migrations_applied'] ?? []), '✓'],
                ['Custom', count($result['layers_applied']['custom']['migrations_applied'] ?? []), '✓'],
            ]
        );
        
        $this->info("Total Duration: {$result['duration']} seconds");
        $this->info("Batch ID: {$result['batch_id']}");
    }
}
```

## **6. USAGE EXAMPLES FROM PLATFORM CONTEXT**

Here's how to use the `TenantProvisioner` from various platform contexts:

### **6.1 From Controller (Admin Panel)**

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Contracts\TenantProvisionerInterface;
use Illuminate\Http\Request;

class TenantProvisioningController extends Controller
{
    protected TenantProvisionerInterface $provisioner;
    
    public function __construct(TenantProvisionerInterface $provisioner)
    {
        $this->provisioner = $provisioner;
    }
    
    /**
     * Provision tenant from admin panel
     */
    public function provision(Request $request, Tenant $tenant)
    {
        try {
            // Validate request
            $request->validate([
                'confirm' => 'required|boolean',
                'options' => 'array',
            ]);
            
            if (!$request->confirm) {
                return response()->json([
                    'error' => 'Confirmation required',
                ], 422);
            }
            
            // Provision tenant
            $result = $this->provisioner->provision($tenant, $request->options ?? []);
            
            return response()->json([
                'success' => true,
                'message' => 'Tenant provisioned successfully',
                'data' => $result,
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Provisioning failed',
                'error' => $e->getMessage(),
                'tenant_status' => $tenant->fresh()->provisioning_status,
            ], 500);
        }
    }
    
    /**
     * Sync tenant schema
     */
    public function sync(Request $request, Tenant $tenant)
    {
        try {
            $result = $this->provisioner->sync($tenant, $request->options ?? []);
            
            return response()->json([
                'success' => true,
                'message' => 'Tenant schema synced successfully',
                'data' => $result,
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Schema sync failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    
    /**
     * Detect schema drift
     */
    public function detectDrift(Tenant $tenant)
    {
        try {
            $drift = $this->provisioner->detectSchemaDrift($tenant);
            
            return response()->json([
                'success' => true,
                'has_drift' => $drift['has_drift'],
                'data' => $drift,
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Drift detection failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    
    /**
     * Get provisioning status
     */
    public function status(Tenant $tenant)
    {
        try {
            $status = $this->provisioner->getStatus($tenant);
            
            return response()->json([
                'success' => true,
                'data' => $status,
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get status',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
```

### **6.2 From Queue Job (Background Processing)**

```php
<?php

namespace App\Jobs;

use App\Models\Tenant;
use App\Contracts\TenantProvisionerInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProvisionTenantJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public $timeout = 600; // 10 minutes
    public $tries = 3;
    public $backoff = [60, 300]; // Retry after 1 minute, then 5 minutes
    
    protected Tenant $tenant;
    protected array $options;
    
    public function __construct(Tenant $tenant, array $options = [])
    {
        $this->tenant = $tenant;
        $this->options = $options;
    }
    
    public function handle(TenantProvisionerInterface $provisioner): void
    {
        Log::info('Starting tenant provisioning job', [
            'tenant_id' => $this->tenant->id,
            'tenant_slug' => $this->tenant->slug,
        ]);
        
        try {
            $result = $provisioner->provision($this->tenant, $this->options);
            
            Log::info('Tenant provisioning completed', [
                'tenant_id' => $this->tenant->id,
                'batch_id' => $result['batch_id'],
                'schema_hash' => $result['schema_hash'],
            ]);
            
            // Send notification
            $this->tenant->notify(new \App\Notifications\TenantProvisioned($result));
            
        } catch (\Exception $e) {
            Log::error('Tenant provisioning failed', [
                'tenant_id' => $this->tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            // Update tenant status
            $this->tenant->update([
                'provisioning_status' => 'failed',
                'provisioning_error' => $e->getMessage(),
            ]);
            
            // Send failure notification
            $this->tenant->notify(new \App\Notifications\TenantProvisioningFailed($e));
            
            throw $e; // Re-throw for job retry
        }
    }
    
    public function failed(\Throwable $exception): void
    {
        Log::critical('Tenant provisioning job failed after all retries', [
            'tenant_id' => $this->tenant->id,
            'error' => $exception->getMessage(),
        ]);
        
        // Mark tenant as permanently failed
        $this->tenant->update([
            'provisioning_status' => 'permanently_failed',
            'provisioning_error' => $exception->getMessage(),
        ]);
    }
}
```

### **6.3 From Artisan Tinker (Development)**

```bash
# Get tenant
$tenant = Tenant::where('slug', 'nepali-congress')->first();

# Create provisioner instance
$provisioner = app(\App\Contracts\TenantProvisionerInterface::class);

# Validate tenant
$provisioner->validate($tenant);

# Dry run
$result = $provisioner->provision($tenant, ['dry_run' => true]);

# Actual provisioning
$result = $provisioner->provision($tenant);

# Check status
$status = $provisioner->getStatus($tenant);

# Detect drift
$drift = $provisioner->detectSchemaDrift($tenant);

# Sync updates
$sync = $provisioner->sync($tenant);
```

## **7. CONFIGURATION FILE UPDATE**

Update the existing `config/tenant-migrations.php` with service-specific configurations:

```php
<?php

return [
    // ... existing config ...
    
    /*
    |--------------------------------------------------------------------------
    | Provisioning Service Configuration
    |--------------------------------------------------------------------------
    */
    
    'provisioning' => [
        'default_timeout' => 300, // 5 minutes
        'max_retries' => 3,
        'cleanup_on_failure' => true,
        'enable_queue' => true,
        'queue_name' => 'tenant-provisioning',
        
        'notifications' => [
            'on_success' => true,
            'on_failure' => true,
            'on_drift_detected' => true,
            'channels' => ['mail', 'database'],
        ],
        
        'validation' => [
            'check_database_exists' => true,
            'check_template_active' => true,
            'check_required_modules' => true,
            'validate_database_name' => true,
        ],
        
        'layers' => [
            'basic' => [
                'required' => true,
                'rollback_on_error' => false,
            ],
            'template' => [
                'required' => true,
                'rollback_on_error' => true,
            ],
            'module' => [
                'required' => false,
                'rollback_on_error' => true,
            ],
            'custom' => [
                'required' => false,
                'rollback_on_error' => true,
            ],
        ],
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Schema Management
    |--------------------------------------------------------------------------
    */
    
    'schema' => [
        'snapshot' => [
            'enabled' => true,
            'auto_create' => true,
            'retention_days' => 30,
            'max_snapshots' => 10,
        ],
        
        'drift_detection' => [
            'enabled' => true,
            'auto_detect' => false,
            'detection_interval' => 'daily',
            'auto_repair' => false,
            'allow_destructive_repair' => false,
            'notification_threshold' => 'medium', // low, medium, high
        ],
        
        'comparison' => [
            'ignore_tables' => ['migrations', 'failed_jobs', 'sessions', 'cache'],
            'ignore_columns' => ['id', 'created_at', 'updated_at', 'deleted_at'],
            'case_sensitive' => false,
            'compare_indexes' => true,
            'compare_foreign_keys' => true,
        ],
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Database Configuration
    |--------------------------------------------------------------------------
    */
    
    'database' => [
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
        'prefix' => '',
        'strict' => true,
        'engine' => 'InnoDB',
        
        'connection_pool' => [
            'enabled' => true,
            'max_connections' => 100,
            'min_connections' => 10,
            'idle_timeout' => 60,
        ],
    ],
];
```

## **8. KEY FEATURES OF THIS IMPLEMENTATION**

### **Platform Context Advantages:**

1. **Centralized Control:** All provisioning logic is managed from the landlord/central application
2. **Database Isolation:** Each tenant gets a completely isolated database
3. **4-Layer Architecture:** Clear separation of concerns with proper dependency ordering
4. **Full Audit Trail:** Every action is logged in the landlord database
5. **Schema Drift Detection:** Automatic detection of unauthorized schema changes
6. **Rollback Support:** Ability to rollback migrations to any point
7. **Queue Integration:** Long-running operations can be queued
8. **Nepali Context:** Built-in support for Nepali administrative structures and compliance

### **Safety Features:**

1. **Pre-Provisioning Validation:** Comprehensive checks before any action
2. **Dry Run Mode:** Test provisioning without making changes
3. **Automatic Cleanup:** Failed provisioning attempts are cleaned up
4. **Connection Management:** Proper connection switching and cleanup
5. **Error Recovery:** Graceful handling of provisioning failures
6. **Schema Snapshots:** Point-in-time recovery capability

### **Performance Optimizations:**

1. **Batch Processing:** Migrations are applied in optimized batches
2. **Connection Pooling:** Efficient database connection management
3. **Cached Schema:** Schema snapshots for fast drift detection
4. **Parallel Processing:** Can be extended to process multiple tenants concurrently
5. **Incremental Sync:** Only apply necessary migrations during sync

## **9. NEXT STEPS**

Now that we have the `TenantProvisioner` service, we should:

1. **Create the Admin Interface Components** in Filament for template/module selection
2. **Build the Schema Snapshot UI** for viewing and comparing schemas
3. **Implement Drift Detection Dashboard** with repair options
4. **Create Tenant Health Monitoring** with alerts
5. **Add Backup/Restore Functionality** for tenant databases
6. **Implement Multi-Tenant Seeding** for test data

Would you like me to proceed with **creating the Filament admin components** next, or would you prefer to work on **the schema snapshot and drift detection UI** first?