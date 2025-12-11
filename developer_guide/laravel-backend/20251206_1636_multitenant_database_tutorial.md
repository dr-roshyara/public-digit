  # 🎯 **TUTORIAL: Tenant-Specific Database Migrations with Spatie Multitenancy**

## 📋 **ARCHITECTURE OVERVIEW**

```
DATABASE STRUCTURE:
├── Landlord Database (election)
│   ├── tenants table
│   ├── tenant_applications
│   └── platform tables
│
└── Tenant Databases (per tenant)
    ├── tenant_nrna (NRNA organization)
    │   ├── tenant_users
    │   ├── organizational_units
    │   ├── roles, permissions
    │   └── election tables (votes, candidates, etc.)
    │
    └── tenant_uml (UML party)
        ├── tenant_users
        ├── organizational_units
        ├── roles, permissions
        └── DIFFERENT election tables (may vary!)
```

**Key Concept**: Each tenant can have DIFFERENT tables based on their needs!

---

## 🚀 **PART 1: MIGRATING TO A SPECIFIC TENANT**

### **Method A: Using Spatie's `tenants:artisan` Command**

```bash
# Migrate ALL tenant databases
php artisan tenants:artisan "migrate --database=tenant"

# Migrate specific tenant by slug
php artisan tenants:artisan "migrate --database=tenant" --tenant=nrna

# Migrate with fresh database
php artisan tenants:artisan "migrate:fresh --database=tenant" --tenant=nrna

# Migrate with seeding
php artisan tenants:artisan "migrate --database=tenant --seed" --tenant=nrna
```

### **Method B: Using Custom Artisan Command**

Create a custom command for more control:

```bash
# Create command
php artisan make:command MigrateTenantDatabase
```

**File: `app/Console/Commands/MigrateTenantDatabase.php`**
```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;

class MigrateTenantDatabase extends Command
{
    protected $signature = 'tenant:migrate 
                            {tenant? : Tenant slug (optional, migrates all if omitted)}
                            {--fresh : Drop all tables and re-run migrations}
                            {--seed : Seed the database after migration}
                            {--path= : Path to migrations directory}';
    
    protected $description = 'Run migrations on tenant database(s)';

    public function handle()
    {
        $tenantSlug = $this->argument('tenant');
        
        if ($tenantSlug) {
            // Migrate specific tenant
            $tenant = Tenant::where('slug', $tenantSlug)->firstOrFail();
            $this->migrateTenant($tenant);
        } else {
            // Migrate all tenants
            Tenant::all()->each(function ($tenant) {
                $this->migrateTenant($tenant);
            });
        }
    }
    
    protected function migrateTenant(Tenant $tenant)
    {
        $this->info("Migrating tenant: {$tenant->name} ({$tenant->slug})");
        
        $tenant->makeCurrent();
        
        $command = 'migrate';
        if ($this->option('fresh')) {
            $command = 'migrate:fresh';
        }
        
        $options = ['--database' => 'tenant'];
        
        if ($this->option('path')) {
            $options['--path'] = $this->option('path');
        }
        
        if ($this->option('seed')) {
            $options['--seed'] = true;
        }
        
        Artisan::call($command, $options);
        
        $this->info("✅ Completed: {$tenant->name}");
    }
}
```

**Usage:**
```bash
# Migrate specific tenant
php artisan tenant:migrate nrna

# Fresh migrate with seeding
php artisan tenant:migrate nrna --fresh --seed

# Migrate specific migration path
php artisan tenant:migrate nrna --path=database/migrations/tenant

# Migrate all tenants
php artisan tenant:migrate
```

---

## 🏗️ **PART 2: CONTEXT-SPECIFIC MIGRATIONS (DDD)**

### **Scenario: Different tenants need different tables**

Example:
- **NRNA**: Needs `membership_records`, `donations`, `chapter_meetings`
- **UML**: Needs `party_positions`, `election_campaigns`, `constituencies`
- **Common**: All need `tenant_users`, `organizational_units`, `roles`

### **Solution: Context-Based Migration Directories**

```
database/migrations/
├── universal/           # Tables ALL tenants get
│   ├── 2024_01_01_create_tenant_users_table.php
│   ├── 2024_01_02_create_organizational_units_table.php
│   └── 2024_01_03_create_roles_table.php
│
├── political/          # Tables for political parties
│   ├── 2024_02_01_create_party_positions_table.php
│   ├── 2024_02_02_create_election_campaigns_table.php
│   └── 2024_02_03_create_constituencies_table.php
│
├── ngo/               # Tables for NGOs
│   ├── 2024_03_01_create_membership_records_table.php
│   ├── 2024_03_02_create_donations_table.php
│   └── 2024_03_03_create_chapter_meetings_table.php
│
└── corporate/         # Tables for corporations
    ├── 2024_04_01_create_departments_table.php
    ├── 2024_04_02_create_projects_table.php
    └── 2024_04_03_create_employee_records_table.php
```

### **Step 1: Tag Tenants with Organization Type**

**Add to `tenants` table:**
```php
Schema::table('tenants', function (Blueprint $table) {
    $table->enum('organization_type', [
        'political_party',
        'ngo',
        'corporate',
        'religious',
        'educational'
    ])->default('ngo');
});
```

### **Step 2: Create Migration Selector Service**

**File: `app/Services/TenantMigrationService.php`**
```php
<?php

namespace App\Services;

use App\Models\Tenant;

class TenantMigrationService
{
    protected $migrationPaths = [
        'universal' => 'database/migrations/universal',
        'political_party' => [
            'database/migrations/universal',
            'database/migrations/political',
        ],
        'ngo' => [
            'database/migrations/universal',
            'database/migrations/ngo',
        ],
        'corporate' => [
            'database/migrations/universal',
            'database/migrations/corporate',
        ],
    ];
    
    public function getMigrationPaths(Tenant $tenant): array
    {
        $type = $tenant->organization_type;
        
        if (!isset($this->migrationPaths[$type])) {
            return [$this->migrationPaths['universal']];
        }
        
        $paths = $this->migrationPaths[$type];
        
        if (is_string($paths)) {
            return [$paths];
        }
        
        return $paths;
    }
    
    public function migrateTenant(Tenant $tenant, array $options = [])
    {
        $paths = $this->getMigrationPaths($tenant);
        
        $tenant->makeCurrent();
        
        foreach ($paths as $path) {
            $this->runMigrations($path, $options);
        }
    }
    
    protected function runMigrations(string $path, array $options)
    {
        $command = array_merge([
            'migrate',
            '--database' => 'tenant',
            '--path' => $path,
        ], $options);
        
        Artisan::call($command);
    }
}
```

### **Step 3: Enhanced Migration Command**

**File: `app/Console/Commands/TenantContextMigrate.php`**
```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use App\Services\TenantMigrationService;

class TenantContextMigrate extends Command
{
    protected $signature = 'tenant:context-migrate 
                            {tenant : Tenant slug}
                            {--fresh : Fresh migration}
                            {--seed : Run seeders}';
    
    protected $description = 'Run context-specific migrations for a tenant';
    
    public function handle()
    {
        $tenantSlug = $this->argument('tenant');
        $tenant = Tenant::where('slug', $tenantSlug)->firstOrFail();
        
        $this->info("Migrating {$tenant->name} ({$tenant->organization_type})");
        
        $service = app(TenantMigrationService::class);
        
        $options = [];
        if ($this->option('fresh')) {
            $options['--fresh'] = true;
        }
        
        $service->migrateTenant($tenant, $options);
        
        if ($this->option('seed')) {
            $this->seedTenant($tenant);
        }
        
        $this->info("✅ Migration complete for {$tenant->name}");
    }
    
    protected function seedTenant(Tenant $tenant)
    {
        $tenant->makeCurrent();
        
        $seederClass = $this->getTenantSeeder($tenant);
        
        if ($seederClass && class_exists($seederClass)) {
            Artisan::call('db:seed', [
                '--class' => $seederClass,
                '--database' => 'tenant',
            ]);
        }
    }
    
    protected function getTenantSeeder(Tenant $tenant): ?string
    {
        $seeders = [
            'political_party' => 'PoliticalPartySeeder',
            'ngo' => 'NgoSeeder',
            'corporate' => 'CorporateSeeder',
        ];
        
        return $seeders[$tenant->organization_type] ?? null;
    }
}
```

**Usage:**
```bash
# Migrate with context-specific tables
php artisan tenant:context-migrate nrna

# Fresh migrate political party
php artisan tenant:context-migrate uml --fresh --seed
```

---

## 🔧 **PART 3: DDD CONTEXT MIGRATIONS**

### **Scenario: Migrate specific DDD bounded context to tenant**

You have DDD contexts:
- `TenantAuth` - Authentication & users
- `Election` - Election operations  
- `Membership` - Membership management
- `Finance` - Financial transactions

### **Solution: Context-Aware Migration Runner**

**File: `app/Console/Commands/TenantContextMigrate.php`**
```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;

class TenantContextMigrate extends Command
{
    protected $signature = 'tenant:context-migrate 
                            {tenant : Tenant slug}
                            {context? : DDD context name (e.g., Election, Membership)}
                            {--all : Migrate all contexts}
                            {--list : List available contexts}';
    
    protected $description = 'Migrate specific DDD context to tenant';
    
    protected $contextPaths = [
        'TenantAuth' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
        'Election' => 'app/Contexts/Election/Infrastructure/Database/Migrations',
        'Membership' => 'app/Contexts/Membership/Infrastructure/Database/Migrations',
        'Finance' => 'app/Contexts/Finance/Infrastructure/Database/Migrations',
        'UniversalCore' => 'app/Contexts/UniversalCore/Infrastructure/Database/Migrations',
    ];
    
    public function handle()
    {
        if ($this->option('list')) {
            $this->listContexts();
            return;
        }
        
        $tenantSlug = $this->argument('tenant');
        $tenant = Tenant::where('slug', $tenantSlug)->firstOrFail();
        
        $context = $this->argument('context');
        
        if ($this->option('all')) {
            $this->migrateAllContexts($tenant);
        } elseif ($context) {
            $this->migrateContext($tenant, $context);
        } else {
            $this->error('Please specify a context or use --all');
        }
    }
    
    protected function listContexts()
    {
        $this->info("Available DDD Contexts:");
        foreach ($this->contextPaths as $context => $path) {
            $this->line("  • {$context} -> {$path}");
        }
    }
    
    protected function migrateAllContexts(Tenant $tenant)
    {
        $tenant->makeCurrent();
        
        foreach ($this->contextPaths as $context => $path) {
            $this->migratePath($tenant, $context, $path);
        }
    }
    
    protected function migrateContext(Tenant $tenant, string $context)
    {
        if (!isset($this->contextPaths[$context])) {
            $this->error("Context '{$context}' not found. Available: " . implode(', ', array_keys($this->contextPaths)));
            return;
        }
        
        $tenant->makeCurrent();
        $path = $this->contextPaths[$context];
        
        $this->migratePath($tenant, $context, $path);
    }
    
    protected function migratePath(Tenant $tenant, string $context, string $path)
    {
        $this->info("Migrating {$context} context to {$tenant->name}");
        
        if (!is_dir($path)) {
            $this->warn("No migrations found for {$context} at {$path}");
            return;
        }
        
        Artisan::call('migrate', [
            '--database' => 'tenant',
            '--path' => $path,
            '--force' => true,
        ]);
        
        $this->info("✅ {$context} migrated successfully");
    }
}
```

**Usage:**
```bash
# List available contexts
php artisan tenant:context-migrate nrna --list

# Migrate specific context
php artisan tenant:context-migrate nrna Election

# Migrate UniversalCore context (your current need)
php artisan tenant:context-migrate nrna UniversalCore

# Migrate ALL contexts
php artisan tenant:context-migrate nrna --all
```

---

## 🎯 **PART 4: PRACTICAL WORKFLOW EXAMPLES**

### **Example 1: New Tenant Setup**
```bash
# 1. Create tenant in landlord DB
php artisan tinker
>>> Tenant::create([
...     'name' => 'Nepal Communist Party',
...     'slug' => 'ncp',
...     'domain' => 'ncp.localhost',
...     'database' => 'tenant_ncp',
...     'organization_type' => 'political_party',
... ]);

# 2. Create tenant database manually
mysql -e "CREATE DATABASE tenant_ncp;"

# 3. Run universal migrations
php artisan tenant:migrate ncp --path=database/migrations/universal

# 4. Run political party context migrations
php artisan tenant:context-migrate ncp --all

# 5. Seed with party-specific data
php artisan tenants:artisan "db:seed --class=PoliticalPartySeeder" --tenant=ncp
```

### **Example 2: Add New Feature to Existing Tenant**
```bash
# 1. Create new migration in Election context
php artisan make:migration create_election_results_table \
  --path=app/Contexts/Election/Infrastructure/Database/Migrations

# 2. Run migration on specific tenant
php artisan tenant:context-migrate nrna Election

# 3. Verify migration
mysql -e "USE tenant_nrna; DESCRIBE election_results;"
```

### **Example 3: Rollback Tenant Migration**
```bash
# Rollback last migration for specific tenant
php artisan tenants:artisan "migrate:rollback --database=tenant" --tenant=nrna

# Rollback specific step
php artisan tenants:artisan "migrate:rollback --step=2 --database=tenant" --tenant=nrna

# Reset entire tenant database (DANGEROUS!)
php artisan tenants:artisan "migrate:reset --database=tenant" --tenant=nrna
```

---

## ⚠️ **BEST PRACTICES & WARNINGS**

### **1. Always Backup First**
```bash
# Backup tenant database
mysqldump tenant_nrna > backup_nrna_$(date +%Y%m%d).sql

# Backup landlord database  
mysqldump election > backup_landlord_$(date +%Y%m%d).sql
```

### **2. Use Migration Testing Tenant**
```bash
# Create test tenant
php artisan tenant:create-test

# Run migrations on test first
php artisan tenant:context-migrate test_tenant UniversalCore

# Test functionality
php artisan test --filter TenantFunctionalityTest
```

### **3. Track Tenant Migration Status**
```bash
# Check what migrations have run on tenant
mysql -e "USE tenant_nrna; SELECT * FROM migrations;"

# Check migration status for all tenants
php artisan tenant:migration-status
```

### **4. Handle Failed Migrations**
```bash
# Check for failed migrations
php artisan tenants:artisan "migrate:status --database=tenant" --tenant=nrna

# Fix and retry
php artisan tenants:artisan "migrate --database=tenant" --tenant=nrna
```

---

## 🎉 **SUMMARY**

**For YOUR current situation:**

```bash
# 1. Check current tenant status
mysql -e "USE tenant_nrna; SHOW TABLES;"

# 2. Run UniversalCore migrations on nrna tenant
php artisan tenant:context-migrate nrna UniversalCore

# 3. Verify
mysql -e "USE tenant_nrna; DESCRIBE roles; DESCRIBE permissions;"
```

**Key Commands to Remember:**
- `php artisan tenants:artisan` - Spatie's built-in
- `php artisan tenant:migrate` - Custom simple migration
- `php artisan tenant:context-migrate` - DDD context-aware migration

**The power is: Each tenant gets EXACTLY the tables they need, based on their organization type and enabled features!**