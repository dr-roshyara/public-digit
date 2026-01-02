# 🚀 **SUPERVISOR APPROVAL: MODULE REGISTRATION MIGRATION COMMAND**

## ✅ **APPROVED - EXCELLENT IDEA!**

This is a **critical infrastructure component** for module installation. Let's design it properly:

## 🏗️ **ARCHITECTURE FOR MODULE MIGRATION COMMAND**

### **Command Structure:**
```bash
# Install module tables for specific tenant
php artisan module-registry:migrate digital_card --tenant=acme-corp

# Install for all tenants  
php artisan module-registry:migrate digital_card --all

# Rollback migrations
php artisan module-registry:migrate digital_card --tenant=acme-corp --rollback

# Fresh install (drop & recreate)
php artisan module-registry:migrate digital_card --tenant=acme-corp --fresh

# Status check
php artisan module-registry:migrate digital_card --tenant=acme-corp --status
```

### **Database Strategy:**
```
Test Environment:
- Landlord: publicdigit_test
- Tenant: tenant_test (for testing tenant migrations)

Production:
- Landlord: publicdigit
- Tenant: tenant_{slug} (dynamic per tenant)
```

## 📋 **IMPLEMENTATION PLAN:**

### **Phase 1: Command Infrastructure**
```php
// app/Console/Commands/ModuleMigrateCommand.php
class ModuleMigrateCommand extends Command
{
    protected $signature = 'module-registry:migrate 
                            {module : Module name (e.g., digital_card)}
                            {--tenant= : Tenant slug}
                            {--all : Migrate for all tenants}
                            {--rollback : Rollback migrations}
                            {--fresh : Fresh migration (drop tables)}
                            {--status : Show migration status}';
    
    public function handle(ModuleInstaller $installer)
    {
        $module = $this->argument('module');
        
        if ($this->option('all')) {
            return $this->migrateAllTenants($module, $installer);
        }
        
        if ($this->option('tenant')) {
            return $this->migrateSingleTenant(
                $module, 
                $this->option('tenant'), 
                $installer
            );
        }
        
        $this->error('Please specify --tenant or --all');
    }
}
```

### **Phase 2: Multi-Database Migration System**
```php
class ModuleInstaller
{
    public function migrateForTenant(string $moduleName, string $tenantSlug)
    {
        // 1. Get module from catalog
        $module = $this->moduleRepository->findByName($moduleName);
        
        // 2. Get tenant database connection
        $tenantDb = $this->getTenantDatabase($tenantSlug);
        
        // 3. Switch to tenant database
        config(['database.default' => $tenantDb]);
        
        // 4. Run module migrations
        $this->runModuleMigrations($module->migrationsPath());
        
        // 5. Record migration in tenant_modules table
        $this->recordMigration($tenantSlug, $module->id());
    }
    
    private function runModuleMigrations(string $migrationPath)
    {
        $migrator = app('migrator');
        
        // Load migration files from module path
        $migrator->run([base_path($migrationPath)]);
        
        // Create tenant-specific migration table if not exists
        $this->ensureMigrationTableExists();
    }
}
```

### **Phase 3: Tenant Database Manager**
```php
class TenantDatabaseManager
{
    public function getTenantConnection(string $tenantSlug): string
    {
        // Test environment
        if (app()->environment('testing')) {
            return 'tenant_test';
        }
        
        // Production: tenant_{slug} database
        $databaseName = "tenant_{$tenantSlug}";
        
        // Create dynamic database connection
        config(["database.connections.{$databaseName}" => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST'),
            'port' => env('DB_PORT'),
            'database' => $databaseName,
            'username' => env('DB_USERNAME'),
            'password' => env('DB_PASSWORD'),
        ]]);
        
        return $databaseName;
    }
}
```

## 🔧 **TEST ENVIRONMENT SUPPORT:**

### **phpunit.xml Configuration:**
```xml
<php>
    <env name="DB_CONNECTION" value="pgsql"/>
    <env name="LANDLORD_DB_DATABASE" value="publicdigit_test"/>
    <env name="TENANT_DB_DATABASE_PREFIX" value="tenant_test"/>
</php>
```

### **Test Database Setup:**
```php
// tests/TestCase.php
protected function setUp(): void
{
    parent::setUp();
    
    // Create test tenant database if not exists
    if (!Schema::connection('tenant_test')->hasTable('migrations')) {
        Artisan::call('migrate', [
            '--database' => 'tenant_test',
            '--path' => 'database/migrations/tenant'
        ]);
    }
}
```

## 🎯 **IMMEDIATE ACTION:**

**1. Create the migration command:**
```bash
php artisan make:command ModuleMigrateCommand
```

**2. Create ModuleInstaller service:**
```php
// app/Services/ModuleInstaller.php
```

**3. Update database configuration:**
```php
// config/database.php - Add tenant_test connection
```

**4. Create test:**
```php
// tests/Feature/ModuleMigrationCommandTest.php
```

## 📊 **SUPERVISOR DIRECTIVE:**

**APPROVE this architecture.** This is essential for:

1. ✅ **Module installation workflow** - Click install → Run migrations
2. ✅ **Developer tooling** - Manual migration control
3. ✅ **Testing infrastructure** - Clean tenant databases
4. ✅ **Production deployment** - Safe tenant migrations

**Proceed with implementation.** This command will be the **core engine** behind the "Install" button in the admin dashboard.

---

**Should we:**
1. **Implement this command first** (infrastructure)


# 🏗️ **ARCHITECTURAL DECISION: COMMAND CONTEXT LOCATION**

## 📊 **ANALYSIS OF OPTIONS:**

### **Option 1: ModuleRegistry Context (Recommended)**
```
packages/laravel-backend/app/Contexts/ModuleRegistry/
├── Application/
│   └── Commands/                 ← Module migration commands
│       └── MigrateModuleCommand.php
├── Domain/                       ← Business logic
└── Infrastructure/
    └── Console/                  ← Console service providers
        └── ModuleRegistryConsoleServiceProvider.php
```

**Pros:**
- ✅ **Domain-aligned** - Command belongs to module management domain
- ✅ **Co-located** - With other ModuleRegistry business logic
- ✅ **Reusable** - Can be called from other contexts
- ✅ **Hexagonal** - Command is Application layer concern

**Cons:**
- ⚠️ **Registration needed** - Must register in main Laravel console

---

### **Option 2: Platform Root (Laravel Default)**
```
packages/laravel-backend/app/Console/Commands/
└── ModuleMigrateCommand.php      ← Mixed with other commands
```

**Pros:**
- ✅ **Automatic discovery** - Laravel finds it automatically
- ✅ **Simple** - No extra registration

**Cons:**
- ❌ **Architecture violation** - Breaks bounded context isolation
- ❌ **Hard to maintain** - Module logic scattered
- ❌ **Tight coupling** - Mixed with unrelated commands

---

### **Option 3: Shared Infrastructure Layer**
```
packages/laravel-backend/app/Shared/
├── Infrastructure/
│   └── Console/
│       └── Commands/
│           └── ModuleMigrateCommand.php
```

**Pros:**
- ✅ **Separated** - From both contexts
- ✅ **Reusable** - Across multiple contexts

**Cons:**
- ⚠️ **Architecture smell** - "Shared" often becomes dumping ground
- ⚠️ **Ownership unclear** - Who maintains it?

---

## 🎯 **RECOMMENDATION: OPTION 1 (ModuleRegistry Context)**

### **Implementation Structure:**
```
packages/laravel-backend/app/Contexts/ModuleRegistry/
├── Application/
│   ├── Commands/                           ← NEW
│   │   ├── MigrateModuleCommand.php
│   │   ├── RollbackModuleCommand.php
│   │   └── ModuleMigrationStatusCommand.php
│   ├── Handlers/                           ← NEW
│   │   └── MigrateModuleHandler.php
│   └── Services/
│       └── ModuleMigrationService.php      ← Business logic
├── Domain/
│   └── Models/
│       └── Module.php
└── Infrastructure/
    ├── Console/
    │   └── ModuleRegistryConsoleServiceProvider.php  ← NEW
    └── Database/
        └── Migrations/
            └── tenant_module_migrations.php
```

### **Command Registration:**
```php
// ModuleRegistryConsoleServiceProvider.php
namespace App\Contexts\ModuleRegistry\Infrastructure\Console;

use Illuminate\Support\ServiceProvider;
use App\Contexts\ModuleRegistry\Application\Commands\MigrateModuleCommand;

class ModuleRegistryConsoleServiceProvider extends ServiceProvider
{
    protected $commands = [
        MigrateModuleCommand::class,
        // ... other module commands
    ];
    
    public function register()
    {
        $this->commands($this->commands);
    }
}
```

```php
// packages/laravel-backend/bootstrap/app.php or config/app.php
$app->register(
    \App\Contexts\ModuleRegistry\Infrastructure\Console\ModuleRegistryConsoleServiceProvider::class
);
```

---

## 🔧 **COMMAND DESIGN PATTERN:**

### **CQRS Style Command:**
```php
namespace App\Contexts\ModuleRegistry\Application\Commands;

class MigrateModuleCommand
{
    public function __construct(
        public readonly string $moduleName,
        public readonly ?string $tenantSlug = null,
        public readonly bool $allTenants = false,
        public readonly bool $rollback = false,
        public readonly bool $fresh = false
    ) {}
}
```

### **Command Handler:**
```php
class MigrateModuleHandler
{
    public function __construct(
        private ModuleMigrationService $migrationService
    ) {}
    
    public function handle(MigrateModuleCommand $command): void
    {
        if ($command->allTenants) {
            $this->migrationService->migrateForAllTenants($command->moduleName);
            return;
        }
        
        if ($command->tenantSlug) {
            $this->migrationService->migrateForTenant(
                $command->moduleName,
                $command->tenantSlug
            );
            return;
        }
        
        throw new \InvalidArgumentException('Specify --tenant or --all');
    }
}
```

### **Console Command Wrapper:**
```php
namespace App\Contexts\ModuleRegistry\Infrastructure\Console\Commands;

use Illuminate\Console\Command;
use App\Contexts\ModuleRegistry\Application\Commands\MigrateModuleCommand;
use App\Contexts\ModuleRegistry\Application\Handlers\MigrateModuleHandler;

class MigrateModuleConsoleCommand extends Command
{
    protected $signature = 'module-registry:migrate 
                            {module : Module name}
                            {--tenant= : Tenant slug}
                            {--all : All tenants}
                            {--rollback : Rollback}
                            {--fresh : Fresh install}';
    
    public function handle(MigrateModuleHandler $handler)
    {
        $command = new MigrateModuleCommand(
            moduleName: $this->argument('module'),
            tenantSlug: $this->option('tenant'),
            allTenants: $this->option('all'),
            rollback: $this->option('rollback'),
            fresh: $this->option('fresh')
        );
        
        $handler->handle($command);
        
        $this->info('Migration completed successfully');
    }
}
```

---

## 🚀 **DEPLOYMENT STRATEGY:**

### **Development Workflow:**
```bash
# 1. Developer creates module
php artisan make:module DigitalCard

# 2. Creates migrations in module context
# packages/laravel-backend/app/Contexts/DigitalCard/Infrastructure/Database/Migrations/

# 3. Register module in catalog
php artisan module:register digital_card

# 4. Test migration on test tenant
php artisan module-registry:migrate digital_card --tenant=test_tenant

# 5. Deploy to production
php artisan module-registry:migrate digital_card --all
```

### **Production Safety:**
```php
class MigrateModuleHandler
{
    public function handle(MigrateModuleCommand $command): void
    {
        // Safety checks
        if (app()->environment('production') && $command->fresh) {
            throw new \Exception('--fresh not allowed in production');
        }
        
        if (app()->environment('production') && !$command->tenantSlug) {
            // Require explicit tenant in production
            if (!$this->confirm('Migrate for ALL tenants in production?')) {
                return;
            }
        }
        
        // Proceed with migration
    }
}
```

---

## 📋 **SUPERVISOR DECISION:**

**APPROVE: Option 1 - ModuleRegistry Context**

### **Implementation Order:**

1. **First:** Complete current API tests (Phase 4 Day 22)
2. **Then:** Create ModuleMigrationService (business logic)
3. **Then:** Create Command + Handler (CQRS pattern)
4. **Then:** Create Console wrapper + ServiceProvider
5. **Then:** Test with DigitalCard module

### **Key Benefits:**

1. **Architecturally pure** - Stays within bounded context
2. **Testable** - Commands can be unit tested without console
3. **Reusable** - Same handler can be called from API or CLI
4. **Scalable** - Easy to add new module-related commands
5. **Maintainable** - All module logic in one place

**This aligns perfectly with our Hexagonal Architecture and will serve as the foundation for the module installation webhook flow.**

**Proceed with this architecture after completing current test work.**
# 🏗️ **MULTI-DATABASE TABLE STRATEGY FOR MODULES**

## 📊 **ARCHITECTURAL DECISION: TABLE SEGREGATION**

### **Rule-Based Classification:**

```
LANDLORD DATABASE (publicdigit):
├── Module Catalog Tables (Global)
│   ├── modules              ← Module definitions
│   ├── module_registrations ← Pending registrations
│   ├── tenant_modules       ← Which tenants have which modules
│   └── module_dependencies  ← Cross-module dependencies
│
├── Platform Tables (Shared)
│   ├── users                ← Platform admins
│   ├── tenants              ← Tenant registry
│   └── subscriptions        ← Tenant subscriptions
│
└── MODULE TABLES (Landlord-scoped):
    └── [module_name]_config ← Module GLOBAL configuration
        (e.g., digital_card_global_settings)

TENANT DATABASE (tenant_{slug}):
└── MODULE TABLES (Tenant-scoped):
    ├── digital_cards        ← Tenant's digital cards
    ├── card_templates       ← Tenant's templates  
    └── card_analytics       ← Tenant's usage data
```

---

## 🔧 **SOLUTION: MODULE MANIFEST WITH DATABASE SCOPING**

### **1. Extended Module Manifest (`module.json`):**
```json
{
  "name": "digital_card",
  "displayName": "Digital Cards",
  "version": "1.0.0",
  "database": {
    "scopes": {
      "landlord": {
        "tables": [
          {
            "name": "digital_card_global_settings",
            "description": "Global module configuration",
            "migration": "database/migrations/landlord/2025_01_01_create_digital_card_global_settings.php"
          }
        ]
      },
      "tenant": {
        "tables": [
          {
            "name": "digital_cards",
            "description": "Individual digital cards",
            "migration": "database/migrations/tenant/2025_01_01_create_digital_cards_table.php"
          },
          {
            "name": "card_templates", 
            "description": "Card templates",
            "migration": "database/migrations/tenant/2025_01_02_create_card_templates_table.php"
          }
        ]
      }
    }
  }
}
```

### **2. Migration File Structure:**
```
app/Contexts/DigitalCard/Infrastructure/Database/
├── Migrations/
│   ├── landlord/                    ← Landlord database migrations
│   │   └── 2025_01_01_000001_create_digital_card_global_settings.php
│   └── tenant/                      ← Tenant database migrations  
│       ├── 2025_01_01_000001_create_digital_cards_table.php
│       └── 2025_01_01_000002_create_card_templates_table.php
├── Seeders/
│   ├── LandlordDigitalCardSeeder.php
│   └── TenantDigitalCardSeeder.php
└── Factories/
    └── DigitalCardFactory.php
```

---

## 🚀 **COMMAND IMPLEMENTATION WITH DATABASE SCOPING**

### **Enhanced Migration Command:**
```php
class ModuleMigrationService
{
    public function migrateModule(string $moduleName, ?string $tenantSlug = null): void
    {
        $module = $this->getModule($moduleName);
        $manifest = $module->getManifest();
        
        // 1. Always run landlord migrations first
        $this->runLandlordMigrations($manifest);
        
        // 2. Run tenant migrations if specified
        if ($tenantSlug) {
            $this->runTenantMigrations($manifest, $tenantSlug);
        }
        
        // 3. Record migration history
        $this->recordMigration($module, $tenantSlug);
    }
    
    private function runLandlordMigrations(array $manifest): void
    {
        $landlordTables = $manifest['database']['scopes']['landlord']['tables'] ?? [];
        
        foreach ($landlordTables as $table) {
            $this->info("Migrating landlord table: {$table['name']}");
            
            // Switch to landlord connection
            DB::setDefaultConnection('landlord');
            
            // Run specific migration file
            $migrator = app('migrator');
            $migrator->run([base_path($table['migration'])]);
            
            $this->info("✓ Created: {$table['name']}");
        }
    }
    
    private function runTenantMigrations(array $manifest, string $tenantSlug): void
    {
        $tenantTables = $manifest['database']['scopes']['tenant']['tables'] ?? [];
        
        // Get tenant database connection
        $tenantConnection = $this->getTenantConnection($tenantSlug);
        
        foreach ($tenantTables as $table) {
            $this->info("Migrating tenant table for {$tenantSlug}: {$table['name']}");
            
            // Switch to tenant database
            DB::setDefaultConnection($tenantConnection);
            
            // Run migration
            $migrator = app('migrator');
            $migrator->run([base_path($table['migration'])]);
            
            $this->info("✓ Created: {$table['name']} in tenant_{$tenantSlug}");
        }
    }
}
```

---

## 🎯 **DECISION MATRIX: WHERE SHOULD TABLE GO?**

### **LANDLORD DATABASE Tables (When):**
```php
// ✅ Global configuration
$table->inLandlordWhen(function($table) {
    return $table->isGlobalConfig() 
        || $table->isCrossTenantAggregate()
        || $table->isModuleRegistryRelated();
});

// Examples:
- digital_card_global_settings    // Module-wide settings
- module_statistics               // Usage across all tenants  
- license_keys                    // License management
```

### **TENANT DATABASE Tables (When):**
```php
// ✅ Tenant-specific data
$table->inTenantWhen(function($table) {
    return $table->isTenantData()
        || $table->isUserGeneratedContent()
        || $table->hasTenantForeignKey();
});

// Examples:
- digital_cards                   // Tenant's cards
- card_templates                  // Tenant's templates
- card_shares                     // Tenant's sharing data
```

### **SHARED TABLES (Special Case):**
```php
// ⚠️ Reference tables (cached in landlord, replicated to tenants)
$table->isReferenceDataWhen(function($table) {
    return $table->isReadMostly()
        && $table->changesInfrequently()
        && $table->neededByAllTenants();
});

// Examples:
- countries                      // Static country list
- currencies                     // Currency codes
- timezones                      // Timezone data
```

---

## 🔍 **AUTOMATED TABLE CLASSIFICATION:**

### **Migration Analyzer:**
```php
class MigrationScopeAnalyzer
{
    public function determineScope(string $migrationFile): string
    {
        $content = file_get_contents($migrationFile);
        
        // Heuristic 1: Table name pattern
        if (preg_match('/create_(\w+)_global_/', $content)) {
            return 'landlord';
        }
        
        if (preg_match('/create_(\w+)_table/', $content)) {
            return 'tenant'; // Default assumption
        }
        
        // Heuristic 2: Foreign key analysis
        if (str_contains($content, "foreignId('tenant_id')")) {
            return 'tenant';
        }
        
        if (str_contains($content, "foreignId('module_id')")) {
            return 'landlord';
        }
        
        // Heuristic 3: Index patterns
        if (str_contains($content, "index(['tenant_id', 'created_at'])")) {
            return 'tenant';
        }
        
        // Default to tenant (safer)
        return 'tenant';
    }
}
```

---

## 📋 **MIGRATION COMMAND ENHANCEMENT:**

### **Command with Scope Detection:**
```bash
# Migrate with automatic scope detection
php artisan module-registry:migrate digital_card --tenant=acme

# Force landlord only
php artisan module-registry:migrate digital_card --scope=landlord

# Force tenant only  
php artisan module-registry:migrate digital_card --tenant=acme --scope=tenant

# Show what will be migrated (dry run)
php artisan module-registry:migrate digital_card --tenant=acme --dry-run

# Output:
# Landlord tables to create:
#   - digital_card_global_settings
# Tenant tables to create:
#   - digital_cards
#   - card_templates
```

### **Command Implementation:**
```php
protected function handle(): void
{
    $module = $this->argument('module');
    $tenant = $this->option('tenant');
    $scope = $this->option('scope'); // 'landlord', 'tenant', or 'all'
    $dryRun = $this->option('dry-run');
    
    $analyzer = new MigrationScopeAnalyzer();
    $manifest = $this->loadModuleManifest($module);
    
    // Analyze migration files
    $landlordMigrations = [];
    $tenantMigrations = [];
    
    foreach ($manifest['migrations'] as $migration) {
        $scope = $analyzer->determineScope($migration);
        
        if ($scope === 'landlord') {
            $landlordMigrations[] = $migration;
        } else {
            $tenantMigrations[] = $migration;
        }
    }
    
    if ($dryRun) {
        $this->displayMigrationPlan($landlordMigrations, $tenantMigrations);
        return;
    }
    
    // Execute migrations
    if (in_array($scope, ['landlord', 'all'])) {
        $this->runMigrations($landlordMigrations, 'landlord');
    }
    
    if ($tenant && in_array($scope, ['tenant', 'all'])) {
        $this->runMigrations($tenantMigrations, "tenant_{$tenant}");
    }
}
```

---

## 🏗️ **MODULE TEMPLATE GENERATOR:**

### **Automated Scaffolding:**
```bash
php artisan make:module DigitalCard \
  --landlord-tables="global_settings" \
  --tenant-tables="cards,templates,analytics" \
  --with-seeders \
  --with-factories
```

### **Generates:**
```php
// Landlord migration
Schema::connection('landlord')->create('digital_card_global_settings', function (Blueprint $table) {
    $table->id();
    $table->string('key')->unique();
    $table->json('value');
    $table->timestamps();
});

// Tenant migration  
Schema::create('digital_cards', function (Blueprint $table) {
    $table->id();
    $table->foreignId('tenant_id')->constrained(); // Auto-added
    $table->foreignId('user_id')->constrained();
    $table->string('name');
    $table->json('content');
    $table->timestamps();
});
```

---

## 🔐 **SECURITY & DATA ISOLATION:**

### **Tenant Data Isolation:**
```php
// All tenant tables automatically get:
Schema::create('tenant_scoped_table', function (Blueprint $table) {
    $table->id();
    $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
    // ... other columns
    $table->timestamps();
    
    // Auto-index for tenant isolation
    $table->index(['tenant_id', 'created_at']);
});

// Query scoping middleware
class TenantScopeMiddleware
{
    public function handle($request, $next)
    {
        if ($tenant = $request->tenant()) {
            // Automatically scope all tenant table queries
            config(['database.default' => "tenant_{$tenant->slug}"]);
            
            // Add global scope to all tenant models
            TenantModel::addGlobalScope('tenant', function ($query) use ($tenant) {
                $query->where('tenant_id', $tenant->id);
            });
        }
        
        return $next($request);
    }
}
```

---

## 📊 **SUPERVISOR DECISION:**

**APPROVE: Manifest-based Multi-Database Strategy**

### **Implementation Priority:**

1. **First:** Extend `module.json` manifest with `database.scopes`
2. **Second:** Update migration command to read manifest
3. **Third:** Create MigrationScopeAnalyzer for auto-detection
4. **Fourth:** Add `--scope` and `--dry-run` options
5. **Fifth:** Create module scaffolding command

### **Key Benefits:**
- ✅ **Explicit control** - Developers define table scope
- ✅ **Automatic detection** - Fallback heuristics
- ✅ **Safety** - Dry-run shows what will happen
- ✅ **Flexible** - Can migrate landlord/tenant separately
- ✅ **Documentation** - Manifest serves as documentation

**This gives us both control (explicit manifest) and convenience (auto-detection) while maintaining clean data isolation between landlord and tenant databases.**
