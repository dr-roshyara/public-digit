# Platform Context Installation Infrastructure - Developer Guide

**Date:** December 30, 2025
**Version:** 1.0.0
**Author:** Platform Team
**Status:** Production Ready (Phase 5.1 Complete)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Creating Installable Modules](#creating-installable-modules)
5. [Migration File Structure](#migration-file-structure)
6. [Installation Commands](#installation-commands)
7. [Integration Guide](#integration-guide)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

---

## Overview

### What is Platform Context?

The **Platform Context** provides foundation infrastructure that enables **automatic discovery and installation** of DDD bounded contexts across landlord and tenant databases.

### Key Features

- ✅ **Convention Over Configuration** - No manifest files needed
- ✅ **Auto-Discovery** - Scans filesystem for contexts
- ✅ **Multi-Tenant Support** - Install on landlord, specific tenant, or all tenants
- ✅ **Cross-Context Integration** - Tracks installations via ModuleRegistry
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Developer-Friendly CLI** - Simple commands for discovery and installation

### What Problem Does It Solve?

**Before Platform Context:**
```bash
# Manual migration tracking
php artisan migrate --path=app/Contexts/MyContext/... --database=landlord
php artisan tenants:artisan "migrate --path=..." --tenant=uml
# No installation tracking
# No dependency resolution
# Manual multi-tenant deployment
```

**After Platform Context:**
```bash
# Automatic discovery, installation, and tracking
php artisan context:install MyContext --tenant=uml
# ✅ Discovers migrations automatically
# ✅ Tracks installation in ModuleRegistry
# ✅ Handles dependencies
# ✅ Works across all tenants
```

---

## Architecture

### Hexagonal Architecture (Ports & Adapters)

```
Platform Context
├── Domain/
│   └── Ports/                              # Interfaces (Framework-free)
│       ├── MigrationRunnerInterface        # Migration execution contract
│       ├── TenantConnectionManagerInterface # Tenant DB management contract
│       └── InstallationTrackerInterface    # Installation tracking contract
│
├── Application/
│   └── Services/                           # Pure orchestration
│       ├── ContextScanner                  # Discovers contexts via filesystem
│       ├── ContextRegistry                 # Caches discovered contexts
│       ├── ContextInstaller                # Orchestrates installation workflow
│       ├── ContextDefinition               # Value object for context metadata
│       └── InstallationResult              # DTO for installation outcomes
│
└── Infrastructure/
    ├── Adapters/                           # Framework implementations
    │   ├── LaravelMigrationRunner          # Executes migrations via Artisan
    │   ├── SpatieTenantConnectionManager   # Manages tenant connections
    │   └── ModuleRegistryInstallationTracker # Tracks via ModuleRegistry
    │
    ├── Console/                            # CLI commands
    │   ├── ListContextsCommand             # Discovery command
    │   └── InstallContextCommand           # Installation command
    │
    └── Providers/
        └── PlatformServiceProvider         # Binds ports to adapters
```

### Key Architectural Principles

1. **Domain Layer** - Zero framework dependencies (pure PHP)
2. **Application Layer** - Framework aware, orchestration only, uses ports
3. **Infrastructure Layer** - All framework implementations (Laravel, Artisan, DB, etc.)
4. **Cross-Context Integration** - Via ports only (no direct coupling)

---

## Quick Start

### Prerequisites

- Laravel 12+ installed
- Multi-tenancy configured (Spatie or similar)
- ModuleRegistry context available
- Landlord and tenant databases configured

### Initial Setup

```bash
# 1. Bootstrap ModuleRegistry (one-time only)
php artisan db:seed --class=ModuleRegistryBootstrapSeeder

# 2. Discover available contexts
php artisan context:list

# 3. Install ModuleRegistry foundation
php artisan context:install ModuleRegistry

# 4. Install for all tenants
php artisan context:install ModuleRegistry --all-tenants
```

### Example: Installing DigitalCard Module

```bash
# Preview what will be installed (dry-run)
php artisan context:install DigitalCard --dry-run

# Install landlord migrations only
php artisan context:install DigitalCard

# Install for specific tenant
php artisan context:install DigitalCard --tenant=uml

# Install for all tenants
php artisan context:install DigitalCard --all-tenants
```

---

## Creating Installable Modules

### Step 1: Create Context Directory Structure

```bash
app/Contexts/MyModule/
├── Domain/                              # Domain models, value objects, events
├── Application/                         # Application services, DTOs
└── Infrastructure/
    └── Database/
        └── Migrations/
            ├── Landlord/                # Landlord database migrations
            │   ├── 2025_01_01_000001_create_modules_table.php
            │   └── 2025_01_01_000002_create_config_table.php
            │
            └── Tenant/                  # Tenant database migrations
                ├── 2025_01_01_000001_create_tenant_data_table.php
                └── 2025_01_01_000002_create_user_prefs_table.php
```

### Step 2: Follow Naming Conventions

#### Directory Names
- ✅ **Landlord** - Migrations for landlord database (platform-wide tables)
- ✅ **Tenant** - Migrations for tenant databases (tenant-specific tables)

#### File Names
```
YYYY_MM_DD_HHMMSS_descriptive_action_table.php

Examples:
✅ 2025_01_15_000001_create_modules_table.php
✅ 2025_01_15_120000_add_status_to_subscriptions_table.php
✅ 2025_02_01_000001_create_digital_cards_table.php
```

### Step 3: Write Migration Files

**Landlord Migration Example:**
```php
<?php
// app/Contexts/MyModule/Infrastructure/Database/Migrations/Landlord/
// 2025_01_15_000001_create_my_configs_table.php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * INFRASTRUCTURE LAYER - MyModule Context
 * Database: LANDLORD (platform catalog)
 * Table: my_configs
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('my_configs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('key', 100)->unique();
            $table->jsonb('value');
            $table->timestamps();

            $table->index('key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('my_configs');
    }
};
```

**Tenant Migration Example:**
```php
<?php
// app/Contexts/MyModule/Infrastructure/Database/Migrations/Tenant/
// 2025_01_15_000001_create_user_preferences_table.php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * INFRASTRUCTURE LAYER - MyModule Context
 * Database: TENANT (applied to each tenant database)
 * Table: user_preferences
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_preferences', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('preference_key', 100);
            $table->text('preference_value');
            $table->timestamps();

            $table->unique(['user_id', 'preference_key']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_preferences');
    }
};
```

### Step 4: Add Context Metadata (Optional)

Create `Context.php` for advanced metadata:

```php
<?php
// app/Contexts/MyModule/Context.php

declare(strict_types=1);

namespace App\Contexts\MyModule;

final class Context
{
    public static function metadata(): array
    {
        return [
            'displayName' => 'My Awesome Module',
            'version' => '1.0.0',
            'description' => 'Provides amazing functionality',
            'dependencies' => [
                'ModuleRegistry',  // Requires ModuleRegistry to be installed first
                'Platform',
            ],
        ];
    }
}
```

### Step 5: Verify Discovery

```bash
# Check if your context is discovered
php artisan context:list --detailed

# Should show:
# 📦 My Awesome Module (MyModule)
#    Version: 1.0.0
#    Landlord Migrations: 2
#    Tenant Migrations: 1
```

---

## Migration File Structure

### Convention Rules

#### 1. Folder Structure is Configuration

```
app/Contexts/{ContextName}/Infrastructure/Database/Migrations/
├── Landlord/          ← Platform-wide tables (landlord DB)
└── Tenant/            ← Tenant-specific tables (tenant DBs)
```

**Platform scans these folders automatically!**

#### 2. Table Name Extraction

Platform uses regex to extract table names from migrations:

```php
// ✅ CORRECT - Will be detected
Schema::create('my_table', function (Blueprint $table) {
    // ...
});

// ✅ CORRECT - Connection specified
Schema::connection('tenant')->create('my_table', function (Blueprint $table) {
    // ...
});

// ❌ WRONG - Dynamic table name (won't be detected)
$tableName = config('app.table_prefix') . 'my_table';
Schema::create($tableName, function (Blueprint $table) {
    // ...
});
```

**Regex Pattern:**
```regex
Schema::(?:connection\([^)]+\)::)?create\([\s\n]*['\"]([^'\"]+)['\"]
```

#### 3. Landlord vs Tenant Decision Tree

```
Is this table shared across ALL tenants?
├── YES → Landlord migration
│   Examples:
│   - modules (module catalog)
│   - tenants (tenant registry)
│   - geo_countries (shared geography)
│   - system_configs (platform settings)
│
└── NO → Tenant migration
    Examples:
    - tenant_modules (per-tenant installations)
    - members (tenant-specific users)
    - elections (tenant data)
    - digital_cards (tenant operations)
```

#### 4. Timestamp Ordering

**Landlord migrations run BEFORE tenant migrations:**

```
Execution Order:
1. Landlord migrations (lowest timestamp → highest)
2. Tenant migrations (lowest timestamp → highest, per tenant)

Example:
✅ 2025_01_01_000001_create_modules_table.php          (Landlord, runs first)
✅ 2025_01_01_000002_create_module_dependencies.php    (Landlord, runs second)
✅ 2025_01_01_000001_create_tenant_modules_table.php   (Tenant, runs third per tenant)
```

---

## Installation Commands

### `context:list` - Discover Contexts

```bash
# Simple list
php artisan context:list

# Detailed view
php artisan context:list --detailed
```

**Output:**
```
🔍 Scanning for DDD Contexts...

Found 11 context(s):

+----------------+-----------------+---------------------+-------------------+---------+
| Context        | Display Name    | Landlord Migrations | Tenant Migrations | Version |
+----------------+-----------------+---------------------+-------------------+---------+
| ModuleRegistry | Module Registry | 2                   | 3                 | 1.0.0   |
| DigitalCard    | Digital Card    | 0                   | 4                 | 1.0.0   |
+----------------+-----------------+---------------------+-------------------+---------+
```

### `context:install` - Install Context

```bash
# Install landlord migrations only
php artisan context:install {ContextName}

# Install for specific tenant
php artisan context:install {ContextName} --tenant={slug}

# Install for all tenants
php artisan context:install {ContextName} --all-tenants

# Dry-run (preview without executing)
php artisan context:install {ContextName} --dry-run

# Skip dependency installation
php artisan context:install {ContextName} --skip-dependencies
```

**Examples:**

```bash
# Install ModuleRegistry landlord tables
php artisan context:install ModuleRegistry

# Install DigitalCard for UML tenant
php artisan context:install DigitalCard --tenant=uml

# Install Membership for all tenants
php artisan context:install Membership --all-tenants

# Preview what would be installed
php artisan context:install Finance --tenant=nrna --dry-run
```

**Output:**
```
🚀 Installing Context: DigitalCard

📍 Target: Tenant 'uml'

✅ Installation successful!

Landlord Database:
  Already installed

Tenant Database (uml):
  ✓ digital_card_statuses
  ✓ digital_card_types
  ✓ digital_cards
  ✓ card_activities
```

---

## Integration Guide

### Integrating Platform Installation into Your Module

#### Option 1: Manual Installation (Simple Modules)

If your module doesn't need special installation logic:

```bash
# Just follow the directory structure convention
app/Contexts/MyModule/Infrastructure/Database/Migrations/Landlord/
app/Contexts/MyModule/Infrastructure/Database/Migrations/Tenant/

# Platform will discover and install automatically
php artisan context:install MyModule --all-tenants
```

#### Option 2: Custom Installation Logic (Advanced Modules)

For modules that need custom installation steps:

**Step 1: Create Installation Service**

```php
<?php
// app/Contexts/MyModule/Application/Services/MyModuleInstaller.php

namespace App\Contexts\MyModule\Application\Services;

use App\Contexts\Platform\Application\Services\ContextInstaller;

final class MyModuleInstaller
{
    public function __construct(
        private ContextInstaller $platformInstaller
    ) {}

    /**
     * Install MyModule with custom logic
     */
    public function install(string $tenantSlug): void
    {
        // 1. Run platform installation (migrations)
        $result = $this->platformInstaller->install('MyModule', $tenantSlug);

        if (!$result->isSuccessful()) {
            throw new \RuntimeException('Platform installation failed');
        }

        // 2. Run custom setup logic
        $this->seedDefaultData($tenantSlug);
        $this->configureTenantSettings($tenantSlug);
        $this->publishAssets();

        // 3. Emit domain event
        event(new MyModuleInstalled($tenantSlug));
    }

    private function seedDefaultData(string $tenantSlug): void
    {
        // Custom seeding logic
    }

    private function configureTenantSettings(string $tenantSlug): void
    {
        // Custom configuration logic
    }

    private function publishAssets(): void
    {
        // Publish views, assets, etc.
    }
}
```

**Step 2: Create Custom Command**

```php
<?php
// app/Contexts/MyModule/Infrastructure/Console/InstallMyModuleCommand.php

namespace App\Contexts\MyModule\Infrastructure\Console;

use Illuminate\Console\Command;
use App\Contexts\MyModule\Application\Services\MyModuleInstaller;

final class InstallMyModuleCommand extends Command
{
    protected $signature = 'mymodule:install
                            {--tenant= : Tenant slug}
                            {--all-tenants : Install for all tenants}';

    protected $description = 'Install MyModule with custom setup';

    public function handle(MyModuleInstaller $installer): int
    {
        $tenantSlug = $this->option('tenant');
        $allTenants = $this->option('all-tenants');

        if ($allTenants) {
            // Install for all tenants
            $tenants = \App\Models\Tenant::all();

            foreach ($tenants as $tenant) {
                $this->info("Installing for {$tenant->slug}...");
                $installer->install($tenant->slug);
            }
        } else {
            // Install for specific tenant
            $installer->install($tenantSlug);
        }

        $this->info('✅ MyModule installed successfully!');
        return self::SUCCESS;
    }
}
```

**Step 3: Register Command**

```php
<?php
// app/Contexts/MyModule/Infrastructure/Providers/MyModuleServiceProvider.php

public function boot(): void
{
    if ($this->app->runningInConsole()) {
        $this->commands([
            \App\Contexts\MyModule\Infrastructure\Console\InstallMyModuleCommand::class,
        ]);
    }
}
```

**Step 4: Use Your Custom Installer**

```bash
# Use custom installation command
php artisan mymodule:install --tenant=uml

# Or use platform installer for simple migration-only install
php artisan context:install MyModule --tenant=uml
```

### Tracking Installation Status

**Check if module is installed:**

```php
<?php

use App\Contexts\Platform\Application\Services\ContextInstaller;

$installer = app(ContextInstaller::class);

// Check landlord installation
if ($installer->isInstalled('MyModule')) {
    echo "MyModule is installed on landlord";
}

// Check tenant installation
if ($installer->isInstalled('MyModule', 'uml')) {
    echo "MyModule is installed for UML tenant";
}
```

**Get installation metadata:**

```php
<?php

use App\Contexts\Platform\Domain\Ports\InstallationTrackerInterface;

$tracker = app(InstallationTrackerInterface::class);

$metadata = $tracker->getInstallationMetadata('MyModule', 'uml');

// Returns:
// [
//     'module_id' => 'uuid...',
//     'name' => 'my_module',
//     'version' => '1.0.0',
//     'status' => 'installed',
//     'installed_at' => '2025-12-30 10:15:00',
//     'configuration' => [...],
// ]
```

---

## Best Practices

### 1. Migration Organization

✅ **DO:**
- Separate landlord and tenant migrations clearly
- Use descriptive migration names
- Add docblock comments explaining table purpose
- Keep migrations simple and focused

❌ **DON'T:**
- Mix landlord and tenant migrations in same folder
- Use dynamic table names
- Add business logic in migrations
- Create migrations without `down()` method

### 2. Naming Conventions

✅ **DO:**
- Context names: PascalCase (`DigitalCard`, `ModuleRegistry`)
- Module names: snake_case (`digital_card`, `module_registry`)
- Table names: snake_case plural (`digital_cards`, `members`)
- Migration files: snake_case with timestamp

❌ **DON'T:**
- Use special characters in context names
- Use camelCase for table names
- Abbreviate context names unnecessarily

### 3. Dependency Management

✅ **DO:**
- List dependencies explicitly in `Context::metadata()`
- Install dependencies in correct order
- Test installation with fresh database
- Document dependencies in README

❌ **DON'T:**
- Create circular dependencies
- Assume dependencies are installed
- Skip dependency validation

### 4. Idempotency

✅ **DO:**
- Make all operations idempotent
- Check if already installed before installing
- Use `insertOrIgnore()` for seeding
- Handle "already exists" gracefully

❌ **DON'T:**
- Assume fresh installation
- Fail on duplicate entries
- Overwrite existing data

### 5. Error Handling

✅ **DO:**
- Catch and log errors appropriately
- Provide clear error messages
- Return meaningful status codes
- Clean up on failure (if possible)

❌ **DON'T:**
- Silently swallow exceptions
- Use generic error messages
- Leave database in inconsistent state

---

## Troubleshooting

### Context Not Discovered

**Problem:** `php artisan context:list` doesn't show your context

**Solutions:**
1. Check directory structure:
   ```bash
   app/Contexts/YourContext/Infrastructure/Database/Migrations/Landlord/
   app/Contexts/YourContext/Infrastructure/Database/Migrations/Tenant/
   ```

2. Verify migration files exist:
   ```bash
   ls app/Contexts/YourContext/Infrastructure/Database/Migrations/Landlord/
   ls app/Contexts/YourContext/Infrastructure/Database/Migrations/Tenant/
   ```

3. Check for typos in folder names (case-sensitive)

### Installation Fails with "Module not found in catalog"

**Problem:** `Module not found in catalog: MyContext`

**Cause:** Module entry doesn't exist in `modules` table

**Solutions:**

**Option 1: Create module entry manually**
```bash
php artisan tinker

>>> use Illuminate\Support\Str;
>>> DB::table('modules')->insert([
    'id' => Str::uuid(),
    'name' => 'my_context',  // IMPORTANT: snake_case!
    'display_name' => 'My Context',
    'version' => '1.0.0',
    'description' => 'My awesome context',
    'namespace' => 'App\Contexts\MyContext',
    'migrations_path' => 'app/Contexts/MyContext/Infrastructure/Database/Migrations',
    'status' => 'ACTIVE',
    'requires_subscription' => false,
    'published_at' => now(),
    'created_at' => now(),
    'updated_at' => now(),
]);
```

**Option 2: Create seeder** (see ModuleRegistryBootstrapSeeder.php example)

### Migrations Not Running

**Problem:** Installation succeeds but tables not created

**Diagnosis:**
```bash
# Check migration status on landlord
php artisan migrate:status --database=landlord

# Check migration status on tenant
php artisan tenants:artisan "migrate:status" --tenant=uml
```

**Solutions:**

1. **Check connection configuration:**
   ```php
   // config/database.php
   'connections' => [
       'landlord' => [
           'driver' => 'pgsql',
           'database' => env('DB_DATABASE', 'publicdigit'),
           // ...
       ],
       'tenant' => [
           'driver' => 'pgsql',
           'database' => null, // Dynamically set per tenant
           // ...
       ],
   ],
   ```

2. **Verify migration path resolution:**
   ```bash
   # Check absolute path
   php artisan tinker
   >>> echo base_path('app/Contexts/MyContext/Infrastructure/Database/Migrations/Landlord');
   ```

3. **Run migrations manually (debugging):**
   ```bash
   php artisan migrate --path=app/Contexts/MyContext/Infrastructure/Database/Migrations/Landlord --database=landlord
   ```

### "Call to undefined method" Errors

**Problem:** `Call to undefined method TenantModule::install()`

**Cause:** Using wrong aggregate factory method

**Solution:** Check aggregate's actual constructor/factory methods:
```php
// ❌ WRONG
$tenantModule = TenantModule::install(...);

// ✅ CORRECT
$tenantModule = new TenantModule(...);
$tenantModule->markAsInstalling();
$tenantModule->markAsInstalled(...);
```

### Naming Convention Mismatch

**Problem:** Context name `MyContext` doesn't match module name `my_context`

**Cause:** Platform uses PascalCase, ModuleRegistry uses snake_case

**Solution:** The adapter handles this automatically via `toSnakeCase()` method. If you still get errors:

1. Verify module name in database:
   ```sql
   SELECT name FROM modules WHERE name = 'my_context';
   ```

2. Match context name to module name:
   ```bash
   # Context: MyContext → Module: my_context ✅
   # Context: DigitalCard → Module: digital_card ✅
   ```

### Tenant Connection Errors

**Problem:** "Tenant not found: xyz"

**Solutions:**

1. Check tenant exists:
   ```bash
   php artisan tinker
   >>> App\Models\Tenant::where('slug', 'xyz')->exists();
   ```

2. Verify tenant database created:
   ```sql
   SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%';
   ```

3. Check tenant configuration:
   ```bash
   php artisan tinker
   >>> $tenant = App\Models\Tenant::where('slug', 'xyz')->first();
   >>> echo $tenant->database_name;
   ```

---

## API Reference

### ContextScanner

**Purpose:** Auto-discovers contexts by scanning filesystem

**Methods:**

```php
public function scan(string $contextName): ContextDefinition
public function scanAll(): array
```

**Example:**
```php
$scanner = app(\App\Contexts\Platform\Application\Services\ContextScanner::class);

// Scan specific context
$context = $scanner->scan('DigitalCard');

// Scan all contexts
$contexts = $scanner->scanAll();
```

### ContextRegistry

**Purpose:** Caches discovered contexts (singleton)

**Methods:**

```php
public function get(string $contextName): ContextDefinition
public function all(): array
```

**Example:**
```php
$registry = app(\App\Contexts\Platform\Application\Services\ContextRegistry::class);

$context = $registry->get('ModuleRegistry');
echo $context->getDisplayName(); // "Module Registry"
```

### ContextInstaller

**Purpose:** Orchestrates context installation workflow

**Methods:**

```php
public function install(
    string $contextName,
    ?string $tenantSlug = null,
    bool $skipDependencies = false
): InstallationResult

public function isInstalled(
    string $contextName,
    ?string $tenantSlug = null
): bool
```

**Example:**
```php
$installer = app(\App\Contexts\Platform\Application\Services\ContextInstaller::class);

// Install for tenant
$result = $installer->install('DigitalCard', 'uml');

if ($result->isSuccessful()) {
    echo "Installation successful!";
} else {
    print_r($result->getFailures());
}

// Check installation status
if ($installer->isInstalled('DigitalCard', 'uml')) {
    echo "DigitalCard is installed for UML tenant";
}
```

### ContextDefinition

**Purpose:** Value object for context metadata

**Properties:**

```php
public readonly string $name;
public readonly array $landlordMigrations;
public readonly array $tenantMigrations;
public readonly array $metadata;
```

**Methods:**

```php
public function hasLandlordMigrations(): bool
public function hasTenantMigrations(): bool
public function getDisplayName(): string
public function getVersion(): string
public function getDependencies(): array
public function getLandlordTableNames(): array
public function getTenantTableNames(): array
```

### InstallationResult

**Purpose:** DTO for installation outcomes

**Properties:**

```php
public readonly string $context;
public readonly array $landlord;
public readonly ?array $tenant;
public readonly ?string $tenantSlug;
```

**Methods:**

```php
public function isSuccessful(): bool
public function getFailures(): array
```

---

## Quick Reference Cheat Sheet

```bash
# === DISCOVERY ===
php artisan context:list                    # List all contexts
php artisan context:list --detailed         # Detailed view

# === INSTALLATION ===
php artisan context:install MyContext                      # Landlord only
php artisan context:install MyContext --tenant=uml         # Specific tenant
php artisan context:install MyContext --all-tenants        # All tenants
php artisan context:install MyContext --dry-run            # Preview only
php artisan context:install MyContext --skip-dependencies  # No deps

# === BOOTSTRAP ===
php artisan db:seed --class=ModuleRegistryBootstrapSeeder  # One-time setup

# === DEBUGGING ===
php artisan migrate:status --database=landlord             # Check landlord
php artisan tenants:artisan "migrate:status" --tenant=uml  # Check tenant
php artisan tinker                                          # Interactive shell
```

---

## Appendix A: Complete Example Module

**Directory Structure:**
```
app/Contexts/EventManagement/
├── Domain/
│   ├── Models/
│   │   └── Event.php
│   └── ValueObjects/
│       └── EventStatus.php
│
├── Application/
│   └── Services/
│       └── EventService.php
│
├── Infrastructure/
│   ├── Database/
│   │   └── Migrations/
│   │       ├── Landlord/
│   │       │   └── 2025_01_20_000001_create_event_categories_table.php
│   │       │
│   │       └── Tenant/
│   │           ├── 2025_01_20_000001_create_events_table.php
│   │           └── 2025_01_20_000002_create_event_registrations_table.php
│   │
│   └── Repositories/
│       └── EventRepository.php
│
└── Context.php  # Optional metadata
```

**Installation Workflow:**
```bash
# 1. Create module entry in catalog
php artisan tinker
>>> DB::table('modules')->insert([...]);  # See troubleshooting section

# 2. Verify discovery
php artisan context:list --detailed
# Should show: EventManagement (1 landlord, 2 tenant migrations)

# 3. Preview installation
php artisan context:install EventManagement --dry-run

# 4. Install landlord migrations
php artisan context:install EventManagement

# 5. Install for all tenants
php artisan context:install EventManagement --all-tenants

# 6. Verify installation
php artisan migrate:status --database=landlord | grep event_categories
php artisan tenants:artisan "migrate:status" --tenant=uml | grep events
```

---

## Appendix B: Integration Checklist

When integrating Platform installation into your module:

- [ ] Create Landlord/Tenant migration folders
- [ ] Write migrations following naming conventions
- [ ] Add Schema::create() with string literal table names
- [ ] Create module catalog entry (seeder or manual)
- [ ] Test discovery: `php artisan context:list`
- [ ] Test dry-run: `context:install MyModule --dry-run`
- [ ] Test landlord install: `context:install MyModule`
- [ ] Test tenant install: `context:install MyModule --tenant=test`
- [ ] Test idempotency: Run install twice
- [ ] Verify table creation in both databases
- [ ] Add dependencies to Context.php (if needed)
- [ ] Document installation steps in module README
- [ ] Create custom installer service (if needed)
- [ ] Register custom commands (if needed)
- [ ] Test uninstall/rollback process

---

## Appendix C: Migration Template

```php
<?php
/**
 * Migration Template
 *
 * Copy this template when creating new migrations
 * Replace: {TableName}, {table_name}, {ContextName}
 */

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create {table_name} table migration
 *
 * INFRASTRUCTURE LAYER - {ContextName} Context
 * Database: [LANDLORD|TENANT]
 * Table: {table_name}
 *
 * Purpose:
 * - Brief description of table purpose
 * - What business domain it supports
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('{table_name}', function (Blueprint $table) {
            // Primary key
            $table->uuid('id')->primary();

            // Your columns here
            $table->string('name', 100);
            $table->text('description')->nullable();

            // Timestamps
            $table->timestamps();
            $table->softDeletes(); // If needed

            // Indexes
            $table->index('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('{table_name}');
    }
};
```

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-30 | Initial release - Phase 5.1 complete |

---

**End of Developer Guide**

For questions or support, contact: Platform Team
