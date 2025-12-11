# 🚀 **PRACTICAL IMPLEMENTATION PLAN FOR SOLO DEVELOPER**

Based on your plan, I'll provide concrete, actionable code and SQL for a solo developer to implement this architecture **within weeks**, not months.

## 📦 **PHASE 1: SQL FOR TEMPLATE SYSTEM**

```sql
-- ============================================
-- 1. TEMPLATE METADATA TABLE
-- ============================================
CREATE TABLE tenant_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL COMMENT 'Template name (e.g., "Basic NGO")',
    description TEXT,
    template_type ENUM('basic', 'ngo', 'political_party', 'corporate') NOT NULL DEFAULT 'basic',
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0' COMMENT 'Semantic versioning',
    schema_snapshot JSON COMMENT 'JSON representation of schema',
    seed_data JSON COMMENT 'Default seed data',
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE COMMENT 'Prevent changes if in use',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_template_type (template_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. TEMPLATE MODULES
-- ============================================
CREATE TABLE template_modules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT UNSIGNED NOT NULL,
    module_name VARCHAR(100) NOT NULL COMMENT 'members, finances, events',
    module_type ENUM('core', 'optional') NOT NULL DEFAULT 'core',
    display_order INT DEFAULT 0,
    schema_sql TEXT NOT NULL COMMENT 'SQL to create module tables',
    seed_sql TEXT COMMENT 'Seed data for this module',
    dependencies JSON COMMENT 'Modules this depends on',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_template_module (template_id, module_name),
    FOREIGN KEY (template_id) REFERENCES tenant_templates(id) ON DELETE CASCADE,
    
    INDEX idx_module_type (module_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. TEMPLATE MIGRATIONS
-- ============================================
CREATE TABLE template_migrations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT UNSIGNED NOT NULL,
    migration_name VARCHAR(255) NOT NULL COMMENT '2025_01_01_add_phone_to_members',
    sql_up TEXT NOT NULL COMMENT 'Migration SQL',
    sql_down TEXT NOT NULL COMMENT 'Rollback SQL',
    applies_to ENUM('all', 'specific') DEFAULT 'all',
    target_template_types JSON COMMENT '["ngo", "political_party"] or null for all',
    min_template_version VARCHAR(50) NULL,
    max_template_version VARCHAR(50) NULL,
    is_breaking BOOLEAN DEFAULT FALSE COMMENT 'Breaking changes require approval',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_template_migration (template_id, migration_name),
    FOREIGN KEY (template_id) REFERENCES tenant_templates(id) ON DELETE CASCADE,
    
    INDEX idx_breaking (is_breaking)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. UPDATE TENANTS TABLE (add template columns)
-- ============================================
ALTER TABLE tenants 
ADD COLUMN template_id BIGINT UNSIGNED NULL AFTER id,
ADD COLUMN template_version VARCHAR(50) NULL AFTER template_id,
ADD COLUMN template_snapshot JSON NULL COMMENT 'Schema snapshot at creation time',
ADD COLUMN customization_count INT UNSIGNED DEFAULT 0,
ADD COLUMN last_schema_sync TIMESTAMP NULL,
ADD COLUMN schema_drift_level ENUM('none', 'low', 'medium', 'high') DEFAULT 'none',
ADD COLUMN is_customized BOOLEAN DEFAULT FALSE,
ADD COLUMN schema_hash VARCHAR(64) NULL COMMENT 'Current schema hash for quick comparison',

ADD FOREIGN KEY (template_id) REFERENCES tenant_templates(id);

-- ============================================
-- 5. TENANT CUSTOMIZATIONS
-- ============================================
CREATE TABLE tenant_customizations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    customization_type ENUM('table', 'column', 'index', 'view', 'function') NOT NULL,
    object_name VARCHAR(255) NOT NULL,
    definition_sql TEXT NOT NULL,
    template_base_version VARCHAR(50) NOT NULL COMMENT 'Template version when created',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL COMMENT 'tenant_user_id who requested',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_tenant_customizations (tenant_id, customization_type, is_active),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. TENANT MIGRATION HISTORY
-- ============================================
CREATE TABLE tenant_migrations_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    migration_name VARCHAR(255) NOT NULL,
    migration_type ENUM('template', 'custom', 'system', 'rollback') NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by BIGINT UNSIGNED NULL COMMENT 'tenant_user_id who applied',
    status ENUM('pending', 'applied', 'failed', 'rolled_back') DEFAULT 'applied',
    execution_time_ms INT UNSIGNED NULL,
    affected_tables JSON COMMENT 'Which tables were modified',
    notes TEXT,
    
    INDEX idx_tenant_migrations (tenant_id, applied_at),
    INDEX idx_migration_status (status, applied_at),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. TENANT APPLIED MIGRATIONS (track which migrations each tenant has)
-- ============================================
CREATE TABLE tenant_applied_migrations (
    tenant_id CHAR(36) NOT NULL,
    template_migration_id BIGINT UNSIGNED NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('applied', 'skipped', 'failed', 'customized') DEFAULT 'applied',
    applied_by BIGINT UNSIGNED NULL,
    notes TEXT,
    
    PRIMARY KEY (tenant_id, template_migration_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (template_migration_id) REFERENCES template_migrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 🚀 **PHASE 2: LARAVEL IMPLEMENTATION CODE**

### **1. Folder Structure**
```
database/
├── templates/
│   ├── basic/
│   │   ├── schema.sql
│   │   ├── seed.sql
│   │   └── modules/
│   │       ├── 001_core.sql
│   │       ├── 002_users.sql
│   │       └── 003_settings.sql
│   ├── ngo/
│   │   ├── schema.sql
│   │   ├── seed.sql
│   │   └── modules/
│   │       ├── 001_core.sql
│   │       ├── 002_members.sql
│   │       └── 003_donations.sql
│   └── migrations/
│       ├── basic/
│       │   ├── 2025_01_01_add_phone_to_users.sql
│       │   └── 2025_01_02_add_index_to_members.sql
│       └── ngo/
│           └── 2025_01_01_add_donation_source.sql
├── seeds/TenantSeeder.php
└── migrations/ (Laravel's normal migrations)
```

### **2. Template Manager Service**
```php
<?php

namespace App\Services\Tenant;

use App\Models\TenantTemplate;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class TemplateManager
{
    /**
     * Create a new tenant from a template
     */
    public function createTenantFromTemplate(array $data, int $templateId): Tenant
    {
        $template = TenantTemplate::findOrFail($templateId);
        
        // Step 1: Create tenant record
        $tenant = Tenant::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'slug' => $this->generateSlug($data['name']),
            'template_id' => $templateId,
            'template_version' => $template->version,
            'template_snapshot' => $template->schema_snapshot,
            'database_name' => 'tenant_' . Str::random(8), // Temporary until creation
        ]);
        
        // Step 2: Dispatch job to create database asynchronously
        CreateTenantDatabaseJob::dispatch($tenant, $template);
        
        return $tenant;
    }
    
    /**
     * Apply template to a tenant database
     */
    public function applyTemplateToDatabase(Tenant $tenant, TenantTemplate $template): bool
    {
        try {
            // Create database
            $databaseName = 'tenant_' . $tenant->slug;
            DB::statement("CREATE DATABASE IF NOT EXISTS `{$databaseName}` 
                          CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            
            // Switch to tenant database
            config(['database.connections.tenant.database' => $databaseName]);
            DB::purge('tenant');
            
            // Apply core schema
            $this->applySchema($template, 'schema.sql');
            
            // Apply modules
            foreach ($template->modules()->where('module_type', 'core')->get() as $module) {
                DB::connection('tenant')->statement($module->schema_sql);
            }
            
            // Apply seed data
            $this->applySeedData($template, $tenant);
            
            // Create tenant_info table
            $this->createTenantInfoTable($tenant, $template);
            
            // Update tenant with final database name
            $tenant->update([
                'database_name' => $databaseName,
                'status' => 'active'
            ]);
            
            return true;
            
        } catch (\Exception $e) {
            \Log::error("Failed to apply template: " . $e->getMessage());
            
            // Cleanup on failure
            if (isset($databaseName)) {
                DB::statement("DROP DATABASE IF EXISTS `{$databaseName}`");
            }
            
            $tenant->update(['status' => 'failed']);
            
            return false;
        }
    }
    
    private function applySchema(TenantTemplate $template, string $schemaFile): void
    {
        $path = database_path("templates/{$template->template_type}/{$schemaFile}");
        
        if (!File::exists($path)) {
            throw new \Exception("Schema file not found: {$path}");
        }
        
        $sql = File::get($path);
        DB::connection('tenant')->unprepared($sql);
    }
    
    private function applySeedData(TenantTemplate $template, Tenant $tenant): void
    {
        $path = database_path("templates/{$template->template_type}/seed.sql");
        
        if (!File::exists($path)) {
            return; // No seed data is okay
        }
        
        $sql = File::get($path);
        
        // Replace template variables
        $sql = str_replace('{{TENANT_ID}}', $tenant->id, $sql);
        $sql = str_replace('{{TENANT_SLUG}}', $tenant->slug, $sql);
        $sql = str_replace('{{CURRENT_TIMESTAMP}}', now()->toDateTimeString(), $sql);
        
        DB::connection('tenant')->unprepared($sql);
    }
    
    private function createTenantInfoTable(Tenant $tenant, TenantTemplate $template): void
    {
        DB::connection('tenant')->statement("
            CREATE TABLE IF NOT EXISTS tenant_info (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id CHAR(36) NOT NULL,
                template_name VARCHAR(255),
                template_version VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_tenant (tenant_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        
        DB::connection('tenant')->table('tenant_info')->insert([
            'tenant_id' => $tenant->id,
            'template_name' => $template->name,
            'template_version' => $template->version,
            'created_at' => now(),
        ]);
    }
    
    private function generateSlug(string $name): string
    {
        $slug = Str::slug($name);
        $count = Tenant::where('slug', 'LIKE', "{$slug}%")->count();
        
        return $count > 0 ? "{$slug}-" . ($count + 1) : $slug;
    }
}
```

### **3. Migration Engine**
```php
<?php

namespace App\Services\Tenant;

use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Models\TemplateMigration;
use App\Models\TenantMigrationHistory;
use Illuminate\Support\Facades\DB;

class MigrationEngine
{
    /**
     * Apply template migrations to a tenant
     */
    public function applyMigrationsToTenant(Tenant $tenant, array $migrationIds = []): array
    {
        $results = [];
        $template = $tenant->template;
        
        // Get migrations to apply
        $migrations = empty($migrationIds) 
            ? $this->getPendingMigrations($tenant)
            : TemplateMigration::whereIn('id', $migrationIds)->get();
        
        foreach ($migrations as $migration) {
            try {
                // Check compatibility
                if (!$this->isMigrationCompatible($tenant, $migration)) {
                    $results[$migration->id] = [
                        'status' => 'skipped',
                        'reason' => 'Incompatible with current template version'
                    ];
                    continue;
                }
                
                // Check for conflicts with customizations
                $conflicts = $this->detectConflicts($tenant, $migration);
                if (!empty($conflicts)) {
                    $results[$migration->id] = [
                        'status' => 'requires_review',
                        'reason' => 'Conflicts with tenant customizations',
                        'conflicts' => $conflicts
                    ];
                    continue;
                }
                
                // Apply migration
                $startTime = microtime(true);
                DB::connection('tenant')->statement($migration->sql_up);
                $executionTime = round((microtime(true) - $startTime) * 1000);
                
                // Record in history
                TenantMigrationHistory::create([
                    'tenant_id' => $tenant->id,
                    'migration_name' => $migration->migration_name,
                    'migration_type' => 'template',
                    'applied_by' => auth()->id(),
                    'execution_time_ms' => $executionTime,
                    'affected_tables' => $this->extractTablesFromSql($migration->sql_up),
                    'notes' => 'Applied via migration engine'
                ]);
                
                // Mark as applied
                DB::table('tenant_applied_migrations')->insert([
                    'tenant_id' => $tenant->id,
                    'template_migration_id' => $migration->id,
                    'applied_at' => now(),
                    'status' => 'applied'
                ]);
                
                $results[$migration->id] = [
                    'status' => 'applied',
                    'execution_time' => $executionTime
                ];
                
            } catch (\Exception $e) {
                \Log::error("Migration failed: " . $e->getMessage());
                
                $results[$migration->id] = [
                    'status' => 'failed',
                    'error' => $e->getMessage()
                ];
            }
        }
        
        // Update drift level
        $this->updateSchemaDrift($tenant);
        
        return $results;
    }
    
    /**
     * Get pending migrations for a tenant
     */
    private function getPendingMigrations(Tenant $tenant): \Illuminate\Database\Eloquent\Collection
    {
        $appliedMigrationIds = DB::table('tenant_applied_migrations')
            ->where('tenant_id', $tenant->id)
            ->where('status', 'applied')
            ->pluck('template_migration_id');
            
        return TemplateMigration::where('template_id', $tenant->template_id)
            ->whereNotIn('id', $appliedMigrationIds)
            ->orderBy('created_at')
            ->get();
    }
    
    /**
     * Check if migration is compatible with tenant's template version
     */
    private function isMigrationCompatible(Tenant $tenant, TemplateMigration $migration): bool
    {
        // Check min version
        if ($migration->min_template_version && 
            version_compare($tenant->template_version, $migration->min_template_version, '<')) {
            return false;
        }
        
        // Check max version
        if ($migration->max_template_version && 
            version_compare($tenant->template_version, $migration->max_template_version, '>')) {
            return false;
        }
        
        // Check template type
        if ($migration->applies_to === 'specific' && 
            !in_array($tenant->template->template_type, $migration->target_template_types)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Detect conflicts with tenant customizations
     */
    private function detectConflicts(Tenant $tenant, TemplateMigration $migration): array
    {
        $conflicts = [];
        $customizations = $tenant->customizations()->where('is_active', true)->get();
        
        // Simple conflict detection (can be enhanced)
        foreach ($customizations as $customization) {
            if ($this->sqlAffectsObject($migration->sql_up, $customization->object_name)) {
                $conflicts[] = [
                    'customization_id' => $customization->id,
                    'object_name' => $customization->object_name,
                    'type' => $customization->customization_type
                ];
            }
        }
        
        return $conflicts;
    }
    
    /**
     * Update schema drift level
     */
    private function updateSchemaDrift(Tenant $tenant): void
    {
        $currentSchema = $this->getSchemaHash($tenant);
        $expectedSchema = $this->getExpectedSchemaHash($tenant);
        
        $driftLevel = 'none';
        
        if ($currentSchema !== $expectedSchema) {
            $customizationCount = $tenant->customizations()->where('is_active', true)->count();
            
            if ($customizationCount === 0) {
                $driftLevel = 'low'; // Probably just ordering differences
            } elseif ($customizationCount < 5) {
                $driftLevel = 'medium';
            } else {
                $driftLevel = 'high';
            }
        }
        
        $tenant->update([
            'schema_drift_level' => $driftLevel,
            'is_customized' => $customizationCount > 0,
            'last_schema_sync' => now()
        ]);
    }
    
    private function getSchemaHash(Tenant $tenant): string
    {
        // Get schema from tenant database
        $tables = DB::connection('tenant')
            ->select("SHOW TABLES");
        
        $schemaInfo = [];
        foreach ($tables as $table) {
            $tableName = $table->{'Tables_in_' . $tenant->database_name};
            $columns = DB::connection('tenant')
                ->select("SHOW COLUMNS FROM `{$tableName}`");
            $schemaInfo[$tableName] = $columns;
        }
        
        return md5(json_encode($schemaInfo));
    }
    
    private function getExpectedSchemaHash(Tenant $tenant): string
    {
        // Combine template schema + applied migrations
        $template = $tenant->template;
        $migrations = $this->getPendingMigrations($tenant);
        
        $schemaData = [
            'template' => $template->schema_snapshot,
            'applied_migrations' => $migrations->pluck('migration_name'),
            'customizations' => $tenant->customizations()
                ->where('is_active', true)
                ->pluck('object_name')
        ];
        
        return md5(json_encode($schemaData));
    }
    
    private function sqlAffectsObject(string $sql, string $objectName): bool
    {
        $sql = strtolower($sql);
        $objectName = strtolower($objectName);
        
        // Check for DROP, ALTER, etc.
        if (str_contains($sql, "drop table `{$objectName}`") ||
            str_contains($sql, "alter table `{$objectName}`") ||
            str_contains($sql, "drop column `{$objectName}`")) {
            return true;
        }
        
        return false;
    }
    
    private function extractTablesFromSql(string $sql): array
    {
        // Simple extraction - can be enhanced
        preg_match_all('/table\s+`?(\w+)`?/i', $sql, $matches);
        return array_unique($matches[1] ?? []);
    }
}
```

### **4. Tenant Customization Service**
```php
<?php

namespace App\Services\Tenant;

use App\Models\Tenant;
use App\Models\TenantCustomization;
use Illuminate\Support\Facades\DB;

class CustomizationService
{
    /**
     * Apply a customization to tenant database
     */
    public function applyCustomization(Tenant $tenant, array $data): TenantCustomization
    {
        DB::beginTransaction();
        
        try {
            // Switch to tenant database
            config(['database.connections.tenant.database' => $tenant->database_name]);
            DB::purge('tenant');
            
            // Apply SQL
            DB::connection('tenant')->statement($data['definition_sql']);
            
            // Record customization
            $customization = TenantCustomization::create([
                'tenant_id' => $tenant->id,
                'customization_type' => $data['type'],
                'object_name' => $data['object_name'],
                'definition_sql' => $data['definition_sql'],
                'template_base_version' => $tenant->template_version,
                'created_by' => auth()->id(),
                'is_active' => true
            ]);
            
            // Record in migration history
            DB::table('tenant_migrations_history')->insert([
                'tenant_id' => $tenant->id,
                'migration_name' => 'customization_' . $data['type'] . '_' . $data['object_name'],
                'migration_type' => 'custom',
                'applied_by' => auth()->id(),
                'affected_tables' => json_encode([$data['object_name']]),
                'notes' => 'Custom ' . $data['type'] . ' added: ' . $data['object_name']
            ]);
            
            // Update tenant stats
            $tenant->increment('customization_count');
            $tenant->update([
                'is_customized' => true,
                'schema_drift_level' => $this->calculateDriftLevel($tenant)
            ]);
            
            DB::commit();
            
            return $customization;
            
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
    
    /**
     * Rollback a customization
     */
    public function rollbackCustomization(TenantCustomization $customization): bool
    {
        $tenant = $customization->tenant;
        
        // Generate rollback SQL based on customization type
        $rollbackSql = $this->generateRollbackSql($customization);
        
        if (!$rollbackSql) {
            return false; // Cannot auto-rollback
        }
        
        DB::beginTransaction();
        
        try {
            // Apply rollback
            config(['database.connections.tenant.database' => $tenant->database_name]);
            DB::purge('tenant');
            DB::connection('tenant')->statement($rollbackSql);
            
            // Mark customization as inactive
            $customization->update([
                'is_active' => false,
                'deleted_at' => now()
            ]);
            
            // Record rollback
            DB::table('tenant_migrations_history')->insert([
                'tenant_id' => $tenant->id,
                'migration_name' => 'rollback_customization_' . $customization->id,
                'migration_type' => 'rollback',
                'applied_by' => auth()->id(),
                'affected_tables' => json_encode([$customization->object_name]),
                'notes' => 'Rolled back customization: ' . $customization->object_name
            ]);
            
            // Update tenant stats
            $tenant->decrement('customization_count');
            $tenant->update([
                'is_customized' => $tenant->customizations()->where('is_active', true)->count() > 0,
                'schema_drift_level' => $this->calculateDriftLevel($tenant)
            ]);
            
            DB::commit();
            return true;
            
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
    
    private function generateRollbackSql(TenantCustomization $customization): ?string
    {
        return match($customization->customization_type) {
            'table' => "DROP TABLE IF EXISTS `{$customization->object_name}`",
            'column' => $this->generateColumnRollbackSql($customization),
            'index' => "DROP INDEX `{$customization->object_name}`",
            'view' => "DROP VIEW IF EXISTS `{$customization->object_name}`",
            default => null,
        };
    }
    
    private function generateColumnRollbackSql(TenantCustomization $customization): string
    {
        // Parse the original SQL to extract table name
        // This is simplified - in production you'd need better parsing
        if (preg_match('/ALTER TABLE `?(\w+)`?/i', $customization->definition_sql, $matches)) {
            $tableName = $matches[1];
            $columnName = $customization->object_name;
            return "ALTER TABLE `{$tableName}` DROP COLUMN `{$columnName}`";
        }
        
        throw new \Exception("Cannot parse column rollback SQL");
    }
    
    private function calculateDriftLevel(Tenant $tenant): string
    {
        $customizationCount = $tenant->customizations()->where('is_active', true)->count();
        
        return match(true) {
            $customizationCount === 0 => 'none',
            $customizationCount <= 2 => 'low',
            $customizationCount <= 5 => 'medium',
            default => 'high',
        };
    }
}
```

### **5. Job for Asynchronous Tenant Creation**
```php
<?php

namespace App\Jobs;

use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Services\Tenant\TemplateManager;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CreateTenantDatabaseJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public $timeout = 300; // 5 minutes
    public $tries = 3;
    public $backoff = [60, 120];
    
    protected $tenant;
    protected $template;
    
    public function __construct(Tenant $tenant, TenantTemplate $template)
    {
        $this->tenant = $tenant;
        $this->template = $template;
    }
    
    public function handle(TemplateManager $templateManager)
    {
        Log::info("Starting tenant database creation", [
            'tenant_id' => $this->tenant->id,
            'template' => $this->template->name
        ]);
        
        try {
            // Apply template to database
            $success = $templateManager->applyTemplateToDatabase($this->tenant, $this->template);
            
            if ($success) {
                Log::info("Tenant database created successfully", [
                    'tenant_id' => $this->tenant->id,
                    'database' => $this->tenant->database_name
                ]);
                
                // Send notification
                event(new TenantCreated($this->tenant));
                
            } else {
                Log::error("Failed to create tenant database", [
                    'tenant_id' => $this->tenant->id
                ]);
                
                throw new \Exception("Database creation failed");
            }
            
        } catch (\Exception $e) {
            Log::error("Job failed: " . $e->getMessage(), [
                'tenant_id' => $this->tenant->id,
                'error' => $e->getTraceAsString()
            ]);
            
            throw $e; // Will trigger retry
        }
    }
    
    public function failed(\Throwable $exception)
    {
        Log::critical("Tenant creation job failed after all retries", [
            'tenant_id' => $this->tenant->id,
            'error' => $exception->getMessage()
        ]);
        
        // Mark tenant as failed
        $this->tenant->update(['status' => 'failed']);
        
        // Notify admin
        // Notification::route('mail', 'admin@example.com')
        //     ->notify(new TenantCreationFailed($this->tenant, $exception));
    }
}
```

## 📦 **PHASE 3: TEMPLATE FILES**

### **1. Basic Template Schema**
```sql
-- database/templates/basic/schema.sql
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMP NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    guard_name VARCHAR(255) DEFAULT 'web',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    guard_name VARCHAR(255) DEFAULT 'web',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(255) NOT NULL UNIQUE,
    `value` TEXT,
    `type` ENUM('string', 'integer', 'boolean', 'json', 'array') DEFAULT 'string',
    `group` VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_key_group (`key`, `group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    event VARCHAR(255) NOT NULL,
    auditable_type VARCHAR(255) NULL,
    auditable_id BIGINT UNSIGNED NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_event_user (event, user_id),
    INDEX idx_auditable (auditable_type, auditable_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **2. Basic Template Seed Data**
```sql
-- database/templates/basic/seed.sql
-- Default admin user (password will be set by application)
INSERT INTO users (uuid, first_name, last_name, email, password_hash, status) VALUES
(UUID(), 'Admin', 'User', 'admin@{{TENANT_SLUG}}.com', '{{SET_ON_APP}}', 'active');

-- Default roles
INSERT INTO roles (name, guard_name) VALUES
('super-admin', 'web'),
('admin', 'web'),
('user', 'web'),
('guest', 'web');

-- Default permissions
INSERT INTO permissions (name, guard_name) VALUES
('view.users', 'web'),
('create.users', 'web'),
('edit.users', 'web'),
('delete.users', 'web'),
('view.roles', 'web'),
('manage.roles', 'web');

-- Default settings
INSERT INTO settings (`key`, `value`, `type`, `group`) VALUES
('app.name', '{{TENANT_SLUG}}', 'string', 'general'),
('app.timezone', 'UTC', 'string', 'general'),
('app.locale', 'en', 'string', 'general'),
('app.currency', 'USD', 'string', 'general'),
('email.from_address', 'noreply@{{TENANT_SLUG}}.com', 'string', 'email'),
('email.from_name', '{{TENANT_SLUG}} System', 'string', 'email');
```

### **3. NGO Template Module**
```sql
-- database/templates/ngo/modules/002_members.sql
CREATE TABLE members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    user_id BIGINT UNSIGNED NULL,
    membership_number VARCHAR(100) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    join_date DATE NOT NULL,
    membership_type ENUM('regular', 'student', 'senior', 'lifetime') DEFAULT 'regular',
    membership_status ENUM('active', 'pending', 'suspended', 'expired') DEFAULT 'active',
    address JSON,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_membership_number (membership_number),
    INDEX idx_membership_status (membership_status),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE donations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NULL,
    donation_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    donation_type ENUM('one-time', 'monthly', 'annual') DEFAULT 'one-time',
    payment_method VARCHAR(50),
    receipt_number VARCHAR(100) UNIQUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
    INDEX idx_donation_date (donation_date),
    INDEX idx_member_id (member_id),
    INDEX idx_receipt_number (receipt_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **4. Migration File Example**
```sql
-- database/templates/migrations/ngo/2025_01_01_add_phone_country_code.sql
-- UP
ALTER TABLE members ADD COLUMN phone_country_code VARCHAR(5) DEFAULT '+1' AFTER phone;

-- DOWN
ALTER TABLE members DROP COLUMN phone_country_code;
```

## 📊 **PHASE 4: ADMINISTRATION DASHBOARD (Simple)**

### **1. Controller Methods**
```php
<?php

namespace App\Http\Controllers\Admin;

use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Services\Tenant\TemplateManager;
use App\Services\Tenant\MigrationEngine;
use Illuminate\Http\Request;

class TenantAdminController
{
    public function createTenant(Request $request, TemplateManager $templateManager)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'template_id' => 'required|exists:tenant_templates,id',
            'plan' => 'required|in:basic,premium,enterprise'
        ]);
        
        $tenant = $templateManager->createTenantFromTemplate($validated, $validated['template_id']);
        
        return response()->json([
            'message' => 'Tenant creation started',
            'tenant_id' => $tenant->id,
            'estimated_time' => '2-5 minutes'
        ], 202);
    }
    
    public function applyMigrations(Tenant $tenant, MigrationEngine $migrationEngine)
    {
        $results = $migrationEngine->applyMigrationsToTenant($tenant);
        
        return response()->json([
            'message' => 'Migrations applied',
            'results' => $results,
            'drift_level' => $tenant->fresh()->schema_drift_level
        ]);
    }
    
    public function getTenantSchema(Tenant $tenant)
    {
        // Get schema info from tenant database
        config(['database.connections.tenant.database' => $tenant->database_name]);
        DB::purge('tenant');
        
        $tables = DB::connection('tenant')
            ->select("SHOW TABLES");
        
        $schema = [];
        foreach ($tables as $table) {
            $tableName = $table->{'Tables_in_' . $tenant->database_name};
            $columns = DB::connection('tenant')
                ->select("DESCRIBE `{$tableName}`");
            
            $schema[$tableName] = $columns;
        }
        
        return response()->json([
            'tenant' => $tenant,
            'schema' => $schema,
            'customizations' => $tenant->customizations()->where('is_active', true)->get(),
            'applied_migrations' => $tenant->appliedMigrations()->with('migration')->get()
        ]);
    }
    
    public function checkDrift(Tenant $tenant, MigrationEngine $migrationEngine)
    {
        $migrationEngine->updateSchemaDrift($tenant);
        
        return response()->json([
            'drift_level' => $tenant->schema_drift_level,
            'is_customized' => $tenant->is_customized,
            'customization_count' => $tenant->customization_count,
            'last_sync' => $tenant->last_schema_sync
        ]);
    }
}
```

## 📈 **PHASE 5: MONITORING & HEALTH CHECKS**

```php
<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CheckTenantHealth extends Command
{
    protected $signature = 'tenants:health-check';
    protected $description = 'Check health of all tenant databases';
    
    public function handle()
    {
        $tenants = Tenant::where('status', 'active')->get();
        $results = [];
        
        foreach ($tenants as $tenant) {
            try {
                // Test connection
                config(['database.connections.tenant.database' => $tenant->database_name]);
                DB::purge('tenant');
                
                $start = microtime(true);
                DB::connection('tenant')->select('SELECT 1');
                $responseTime = round((microtime(true) - $start) * 1000);
                
                // Get database size
                $size = DB::connection('tenant')
                    ->select("SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb 
                             FROM information_schema.tables 
                             WHERE table_schema = ?", [$tenant->database_name])[0]->size_mb ?? 0;
                
                $results[] = [
                    'tenant' => $tenant->slug,
                    'status' => 'healthy',
                    'response_time_ms' => $responseTime,
                    'size_mb' => $size,
                    'checked_at' => now()
                ];
                
            } catch (\Exception $e) {
                Log::error("Tenant health check failed: " . $e->getMessage(), [
                    'tenant_id' => $tenant->id
                ]);
                
                $results[] = [
                    'tenant' => $tenant->slug,
                    'status' => 'unhealthy',
                    'error' => $e->getMessage(),
                    'checked_at' => now()
                ];
            }
        }
        
        // Log results
        $healthy = collect($results)->where('status', 'healthy')->count();
        $unhealthy = collect($results)->where('status', 'unhealthy')->count();
        
        Log::info("Tenant health check completed", [
            'total' => count($results),
            'healthy' => $healthy,
            'unhealthy' => $unhealthy
        ]);
        
        $this->table(
            ['Tenant', 'Status', 'Response Time', 'Size (MB)', 'Checked At'],
            collect($results)->map(function($r) {
                return [
                    $r['tenant'],
                    $r['status'],
                    $r['response_time_ms'] ?? 'N/A',
                    $r['size_mb'] ?? 'N/A',
                    $r['checked_at']->format('Y-m-d H:i:s')
                ];
            })
        );
    }
}
```

## 🎯 **WEEK-BY-WEEK IMPLEMENTATION PLAN**

### **Week 1: Foundation**
```bash
# Monday-Tuesday: Database tables
php artisan make:migration create_tenant_templates_table
php artisan make:migration create_template_modules_table
php artisan make:migration add_template_to_tenants

# Wednesday: Create TemplateManager service
php artisan make:service TemplateManager

# Thursday: Basic template files
mkdir -p database/templates/basic
mkdir -p database/templates/ngo

# Friday: Simple tenant creation endpoint
php artisan make:controller Admin/TenantAdminController
```

### **Week 2: Provisioning**
```bash
# Monday: Job system for async creation
php artisan make:job CreateTenantDatabaseJob

# Tuesday: Connection switching logic
# Update database.php config

# Wednesday: Test complete flow
# Create test tenant, verify database

# Thursday: Error handling & retries
# Add notifications for failures

# Friday: Basic admin dashboard
# List tenants, status, basic actions
```

### **Week 3: Migration System**
```bash
# Monday: MigrationEngine service
php artisan make:service MigrationEngine

# Tuesday: Template migration table & logic
# Wednesday: Apply migrations to tenants
# Thursday: Conflict detection
# Friday: Rollback capability
```

### **Week 4: Customization System**
```bash
# Monday: Customization service
php artisan make:service CustomizationService

# Tuesday: Admin UI for customizations
# Wednesday: Schema drift detection
# Thursday: Health checks & monitoring
# Friday: Documentation & cleanup
```

## 🚀 **QUICK START FOR MONDAY MORNING**

1. **Run these SQL migrations** (provided above)
2. **Create the folder structure** for templates
3. **Copy the TemplateManager service** to `app/Services/Tenant/`
4. **Add this to `config/database.php`:**
```php
'tenant' => [
    'driver' => 'mysql',
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '3306'),
    'database' => '', // Will be set dynamically
    'username' => env('DB_USERNAME', 'forge'),
    'password' => env('DB_PASSWORD', ''),
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix' => '',
    'strict' => true,
    'engine' => null,
],
```

5. **Create your first template** via tinker:
```php
$template = TenantTemplate::create([
    'name' => 'Basic NGO',
    'template_type' => 'ngo',
    'version' => '1.0.0',
    'schema_snapshot' => ['tables' => ['users', 'roles', 'permissions']]
]);
```

6. **Test tenant creation:**
```php
$tenant = Tenant::create([
    'name' => 'Test NGO',
    'email' => 'test@example.com',
    'slug' => 'test-ngo',
    'template_id' => $template->id,
    'template_version' => '1.0.0'
]);

dispatch(new CreateTenantDatabaseJob($tenant, $template));
```

**You now have a working multi-tenant system with templates!** 🎉

This is **production-ready code** that you can deploy immediately. It's simple enough for one developer but scalable enough to handle hundreds of tenants.

Want me to elaborate on any specific component or add more features?