Ah! Now I understand your complete architecture. You have a **two-phase migration system**:

1. **Phase 1: Basic migrations** - Run automatically during tenant provisioning
2. **Phase 2: Template-based migrations** - Run on-demand based on tenant type/template

## Current Issue

The problem is that **Phase 1 migrations aren't running at all** because `runTenantMigrations()` is just a stub. So `tenant_users` table is either:
- Not created at all
- Created with wrong schema (if some other code creates it)

## The Solution

We need to fix the `runTenantMigrations()` method to run **basic migrations** during provisioning, and create a separate system for **template migrations**.

### Step 1: Fix TenantDatabaseManager

Here's the corrected `runTenantMigrations()` method that runs basic migrations:

```php
// In TenantDatabaseManager.php

public function runTenantMigrations(Tenant $tenant): bool
{
    try {
        Log::info('Running tenant database migrations', [
            'tenant_id' => $tenant->getId(),
            'tenant_slug' => $tenant->getSlug()->toString(),
        ]);

        // Switch to tenant connection
        $this->switchToTenantConnection($tenant);
        
        $connectionName = $this->getTenantConnectionName($tenant);
        
        // Set the database name
        config([
            "database.connections.{$connectionName}.database" => $tenant->getDatabaseName()->toString()
        ]);
        
        // Purge and reconnect
        DB::purge($connectionName);
        DB::reconnect($connectionName);
        
        // Run BASIC migrations (Phase 1)
        // These are the core TenantAuth migrations that every tenant needs
        $basicMigrationPath = 'packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations';
        
        Artisan::call('migrate', [
            '--database' => $connectionName,
            '--path' => $basicMigrationPath,
            '--force' => true,
        ]);
        
        Log::info('Basic tenant migrations completed', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
        ]);

        return true;
    } catch (Exception $e) {
        Log::error('Failed to run tenant migrations', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'error' => $e->getMessage(),
        ]);
        throw new Exception("Failed to run tenant migrations: {$e->getMessage()}", 0, $e);
    }
}
```

### Step 2: Create Template Migration System

Create a service for template-based migrations:

```php
// app/Contexts/TenantAuth/Application/Services/TemplateMigrationService.php

namespace App\Contexts\TenantAuth\Application\Services;

use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TemplateMigrationService
{
    /**
     * Run template-specific migrations for a tenant
     */
    public function runTemplateMigrations(Tenant $tenant, string $templateSlug): bool
    {
        try {
            Log::info('Running template migrations', [
                'tenant_id' => $tenant->id,
                'template' => $templateSlug,
            ]);
            
            $connectionName = 'tenant'; // or get tenant connection
            
            // Switch to tenant database
            config(['database.connections.tenant.database' => $tenant->database_name]);
            DB::purge('tenant');
            DB::reconnect('tenant');
            
            // Determine migration path based on template
            $migrationPath = $this->getMigrationPathForTemplate($templateSlug);
            
            if (!$migrationPath) {
                throw new \Exception("No migrations found for template: {$templateSlug}");
            }
            
            // Run migrations
            Artisan::call('migrate', [
                '--database' => 'tenant',
                '--path' => $migrationPath,
                '--force' => true,
            ]);
            
            Log::info('Template migrations completed', [
                'tenant_id' => $tenant->id,
                'template' => $templateSlug,
                'output' => Artisan::output(),
            ]);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Template migration failed', [
                'tenant_id' => $tenant->id,
                'template' => $templateSlug,
                'error' => $e->getMessage(),
            ]);
            
            throw $e;
        }
    }
    
    /**
     * Get migration path for a specific template
     */
    private function getMigrationPathForTemplate(string $templateSlug): ?string
    {
        $templateMappings = [
            'political-party-nepal' => 'database/migrations/templates/political-party-nepal',
            'non-profit-org' => 'database/migrations/templates/non-profit',
            'government-org' => 'database/migrations/templates/government',
            // Add more templates as needed
        ];
        
        return $templateMappings[$templateSlug] ?? null;
    }
    
    /**
     * List available templates with descriptions
     */
    public function getAvailableTemplates(): array
    {
        return [
            'political-party-nepal' => [
                'name' => 'Political Party (Nepal)',
                'description' => 'Adds political party specific tables: parties, members, elections, etc.',
                'tables' => ['parties', 'party_members', 'party_positions', 'election_committees'],
            ],
            'non-profit-org' => [
                'name' => 'Non-Profit Organization',
                'description' => 'Non-profit specific tables: donors, campaigns, volunteers',
                'tables' => ['donors', 'campaigns', 'volunteers', 'donations'],
            ],
            // Add more templates
        ];
    }
}
```

### Step 3: Create Artisan Commands

Create commands for manual migration management:

```bash
# Create command for basic migrations
php artisan make:command TenantAuthMigrate

# Create command for template migrations
php artisan make:command TenantTemplateMigrate
```

```php
// app/Console/Commands/TenantAuthMigrate.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use App\Contexts\TenantAuth\Infrastructure\Database\TenantDatabaseManager;

class TenantAuthMigrate extends Command
{
    protected $signature = 'tenantauth:migrate 
                            {slug? : Tenant slug (optional, runs for all if not specified)}
                            {--fresh : Drop all tables and re-run migrations}
                            {--seed : Seed the database after migrating}';
    
    protected $description = 'Run TenantAuth migrations for tenant(s)';
    
    public function handle()
    {
        $slug = $this->argument('slug');
        
        if ($slug) {
            $tenants = Tenant::where('slug', $slug)->get();
        } else {
            $tenants = Tenant::where('status', 'active')->get();
        }
        
        $this->info("Running migrations for {$tenants->count()} tenant(s)");
        
        $manager = app(TenantDatabaseManager::class);
        
        foreach ($tenants as $tenant) {
            $this->info("Migrating: {$tenant->name} ({$tenant->slug})...");
            
            try {
                if ($this->option('fresh')) {
                    // Drop all tables and re-migrate
                    // You'll need to implement this in TenantDatabaseManager
                    $this->call('migrate:fresh', [
                        '--database' => 'tenant',
                        '--path' => 'packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
                        '--force' => true,
                    ]);
                } else {
                    $manager->runTenantMigrations($tenant);
                }
                
                if ($this->option('seed')) {
                    $this->call('db:seed', [
                        '--database' => 'tenant',
                        '--class' => 'TenantDatabaseSeeder',
                    ]);
                }
                
                $this->info("  ✅ Success");
                
            } catch (\Exception $e) {
                $this->error("  ❌ Failed: " . $e->getMessage());
            }
        }
        
        $this->info("\nMigration process completed!");
        return 0;
    }
}
```

```php
// app/Console/Commands/TenantTemplateMigrate.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use App\Contexts\TenantAuth\Application\Services\TemplateMigrationService;

class TenantTemplateMigrate extends Command
{
    protected $signature = 'tenant:template-migrate 
                            {slug : Tenant slug}
                            {template : Template name (e.g., political-party-nepal)}
                            {--list : List available templates}';
    
    protected $description = 'Run template-specific migrations for a tenant';
    
    public function handle()
    {
        $service = app(TemplateMigrationService::class);
        
        if ($this->option('list')) {
            $this->listTemplates($service);
            return 0;
        }
        
        $slug = $this->argument('slug');
        $template = $this->argument('template');
        
        $tenant = Tenant::where('slug', $slug)->firstOrFail();
        
        $this->info("Running template migrations for: {$tenant->name}");
        $this->info("Template: {$template}");
        
        try {
            $service->runTemplateMigrations($tenant, $template);
            $this->info("✅ Template migrations completed successfully");
            
        } catch (\Exception $e) {
            $this->error("❌ Failed: " . $e->getMessage());
            return 1;
        }
        
        return 0;
    }
    
    private function listTemplates(TemplateMigrationService $service)
    {
        $templates = $service->getAvailableTemplates();
        
        $this->info("Available Templates:");
        $this->newLine();
        
        foreach ($templates as $slug => $info) {
            $this->line("<fg=cyan>{$slug}</>");
            $this->line("  Name: {$info['name']}");
            $this->line("  Description: {$info['description']}");
            $this->line("  Tables: " . implode(', ', $info['tables']));
            $this->newLine();
        }
    }
}
```

### Step 4: Create Admin Dashboard Integration

Create a controller for admin dashboard:

```php
// app/Http/Controllers/Tenant/TemplateMigrationController.php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Contexts\TenantAuth\Application\Services\TemplateMigrationService;
use Illuminate\Http\Request;

class TemplateMigrationController extends Controller
{
    protected $templateService;
    
    public function __construct(TemplateMigrationService $templateService)
    {
        $this->templateService = $templateService;
    }
    
    /**
     * Show available templates
     */
    public function index()
    {
        $templates = $this->templateService->getAvailableTemplates();
        
        return view('tenant.templates.index', compact('templates'));
    }
    
    /**
     * Apply a template to current tenant
     */
    public function apply(Request $request)
    {
        $request->validate([
            'template' => 'required|string',
        ]);
        
        $tenant = app('current_tenant');
        
        try {
            $this->templateService->runTemplateMigrations(
                $tenant,
                $request->input('template')
            );
            
            return redirect()->back()->with('success', 'Template applied successfully!');
            
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to apply template: ' . $e->getMessage());
        }
    }
}
```

### Step 5: Fix Your Current Tenant

For your existing tenant `uml`:

```bash
# 1. First fix the runTenantMigrations method
# 2. Then run basic migrations
php artisan tinker
```

```php
// In Tinker
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$manager = app(\App\Contexts\TenantAuth\Infrastructure\Database\TenantDatabaseManager::class);

// Run basic migrations
$manager->runTenantMigrations($tenant);

// Check if tables were created
config(['database.connections.tenant.database' => 'tenant_uml']);
DB::purge('tenant');
$tables = DB::connection('tenant')->select('SHOW TABLES');
foreach ($tables as $table) {
    echo $table->Tables_in_tenant_uml . "\n";
}
```

### Step 6: Directory Structure for Template Migrations

Create this directory structure:

```
database/
├── migrations/
│   ├── templates/
│   │   ├── political-party-nepal/
│   │   │   ├── 2025_01_01_000001_create_parties_table.php
│   │   │   ├── 2025_01_01_000002_create_party_members_table.php
│   │   │   └── 2025_01_01_000003_create_elections_table.php
│   │   ├── non-profit-org/
│   │   │   ├── 2025_01_01_000001_create_donors_table.php
│   │   │   └── 2025_01_01_000002_create_donations_table.php
│   │   └── government-org/
│   │       ├── 2025_01_01_000001_create_departments_table.php
│   │       └── 2025_01_01_000002_create_government_positions_table.php
```

## Summary

Now you have:

1. **✅ Phase 1: Basic migrations** - Automatically run during provisioning
2. **✅ Phase 2: Template migrations** - Run on-demand via admin dashboard or CLI
3. **✅ Commands** for manual management
4. **✅ Dashboard integration** for admin users

Would you like me to:
1. **Create the complete TemplateMigrationService** with all methods?
2. **Create the template migration directories** and sample migrations?
3. **Fix your current `tenant_uml` database** first?
4. **Create a UI for the admin dashboard** to apply templates?

Let me know which part you want to implement first!

##################################
#next steps
##################################################

Excellent! You found the root cause. **The `runTenantMigrations()` method is just a stub - it doesn't actually run migrations!** This explains everything:

## The Problem

When a tenant is provisioned:
1. ✅ Database is created (`createTenantDatabase()`)
2. ❌ Migrations are NOT run (`runTenantMigrations()` just logs a message)
3. ❌ `tenant_users` table is created with wrong schema (or not at all)
4. ❌ Password setup fails because wrong column name

## The Solution

We need to **implement the actual migration execution** in `TenantDatabaseManager::runTenantMigrations()`.

Here's the fix:

```php
// In TenantDatabaseManager.php - Replace the entire runTenantMigrations method

public function runTenantMigrations(Tenant $tenant): bool
{
    try {
        Log::info('Running tenant database migrations', [
            'tenant_id' => $tenant->getId(),
            'tenant_slug' => $tenant->getSlug()->toString(),
        ]);

        // Switch to tenant connection
        $this->switchToTenantConnection($tenant);
        
        // Get the tenant connection name
        $connectionName = $this->getTenantConnectionName($tenant);
        
        // IMPORTANT: Ensure database is set correctly
        config([
            "database.connections.{$connectionName}.database" => $tenant->getDatabaseName()->toString()
        ]);
        
        // Purge and reconnect to use new database
        DB::purge($connectionName);
        DB::reconnect($connectionName);
        
        // Run migrations using Artisan call
        Artisan::call('migrate', [
            '--database' => $connectionName,
            '--path' => 'packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
            '--force' => true,
        ]);
        
        Log::info('Tenant migrations completed successfully', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'output' => Artisan::output(),
        ]);

        return true;
    } catch (Exception $e) {
        Log::error('Failed to run tenant migrations', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ]);
        throw new Exception("Failed to run tenant migrations: {$e->getMessage()}", 0, $e);
    }
}
```

## But First, Let's Test Your Existing Tenant

Before we fix the code, let's check what happened with `tenant_uml`:

```bash
# Check if migrations table exists in tenant_uml
mysql -u softcrew -p -e "USE tenant_uml; SHOW TABLES;"

# Check tenant_users table columns
mysql -u softcrew -p -e "USE tenant_uml; DESCRIBE tenant_users;"

# Check migrations table (if it exists)
mysql -u softcrew -p -e "USE tenant_uml; SELECT * FROM migrations;" 2>/dev/null || echo "No migrations table"
```

## Options to Fix Your Current Tenant

### Option 1: Manually Run Migrations

```bash
# First, fix the runTenantMigrations method
# Then run migrations manually
php artisan tinker
```

```php
// In Tinker
use App\Models\Tenant;
use App\Contexts\TenantAuth\Infrastructure\Database\TenantDatabaseManager;

$tenant = Tenant::where('slug', 'uml')->first();
$manager = app(TenantDatabaseManager::class);

// Run migrations
$manager->runTenantMigrations($tenant);
```

### Option 2: Manually Fix Schema

If the table already exists but with wrong schema:

```sql
-- Check current columns
USE tenant_uml;
DESCRIBE tenant_users;

-- If 'password' column exists, rename it
ALTER TABLE tenant_users 
CHANGE COLUMN password password_hash VARCHAR(255) NULL;

-- Add missing columns from the alignment migration
-- (You might need to run more SQL based on what's missing)
```

## Also Need to Fix the Controllers

Even after fixing migrations, the controllers still use wrong column names. Update:

1. **TenantPasswordResetController** - Change `'password' =>` to `'password_hash' =>`
2. **TenantAuthenticationController** - Change `$user->password` to `$user->password_hash`

## Complete Action Plan

1. **First, implement `runTenantMigrations()`** in TenantDatabaseManager
2. **Fix the controllers** to use `password_hash` column
3. **Run migrations on existing tenant `uml`**
4. **Test password setup**

## Let Me Create the Fix for You

Would you like me to:
1. **Show you the exact code** to replace in `TenantDatabaseManager.php`?
2. **Create a command** to run migrations on all existing tenants?
3. **Fix the controllers** automatically?
4. **Create a test** to verify migrations work?

## Quick Test

Run this to see if migrations table exists:

```bash
mysql -u softcrew -p << 'EOF'
USE tenant_uml;
SHOW TABLES;
SELECT 
    TABLE_NAME,
    TABLE_TYPE 
FROM 
    INFORMATION_SCHEMA.TABLES 
WHERE 
    TABLE_SCHEMA = 'tenant_uml';
EOF
```

**If there's no `migrations` table**, then migrations never ran.
**If there's no `tenant_users` table**, then no tables were created.
**If `tenant_users` has `password` column**, then old migration ran but not the alignment one.


#############################
next Steps
#############################


##$_COOKIE
Perfect! Now I can see the complete picture. Let me analyze the issue:

## Problem Analysis

Looking at the controllers:

1. **`TenantPasswordResetController::updatePassword()`** - Updates `password` column:
   ```php
   ->update([
       'password' => Hash::make($newPassword),  // ❌ Uses 'password' column
       'updated_at' => now(),
   ]);
   ```

2. **`TenantAuthenticationController::authenticateAgainstTenantDatabase()`** - Checks `password` column:
   ```php
   if (!Hash::check($password, $user->password)) {  // ❌ Checks 'password' column
       return false;
   }
   ```

3. **`SecureSetupController::submitPassword()`** - Uses `SecureSetupTokenService::setPasswordWithToken()`

## The Root Cause

The controllers are trying to update/check a `password` column, but your migrations show the table should have `password_hash` column after the alignment migration.

## Let's Check What's Actually in the Database

Run this command to see the current state:

```bash
mysql -u softcrew -p << 'EOF'
USE tenant_uml;
DESCRIBE tenant_users;
SHOW COLUMNS FROM tenant_users LIKE 'password%';
EOF
```

## Immediate Fixes Needed

### Fix 1: Update TenantPasswordResetController

```php
// In TenantPasswordResetController::updatePassword()
->update([
    'password_hash' => Hash::make($newPassword),  // ✅ Use password_hash
    'updated_at' => now(),
]);
```

### Fix 2: Update TenantAuthenticationController

```php
// In TenantAuthenticationController::authenticateAgainstTenantDatabase()
// Change this:
if (!Hash::check($password, $user->password)) {
    return false;
}

// To:
if (!Hash::check($password, $user->password_hash)) {  // ✅ Use password_hash
    return false;
}

// Also in authenticateWithTenantFiltering():
if (!Hash::check($password, $user->password_hash)) {  // ✅ Use password_hash
    return false;
}
```

## But Wait! Let's Check the SecureSetupTokenService

The actual error is coming from `SecureSetupController::submitPassword()`, which calls `SecureSetupTokenService::setPasswordWithToken()`. Let me find this service:

```bash
# Find SecureSetupTokenService
find . -name "*SecureSetupTokenService*" -type f

# Or search for setPasswordWithToken
grep -r "setPasswordWithToken" . --include="*.php"
```

## Let Me Also Check the Migrations

The migration `2025_12_06_120000_align_tenant_users_with_universal_core_schema.php` should rename `password` to `password_hash`. Let's see what it does:

```bash
# Check the alignment migration
cat app/Contexts/TenantAuth/Infrastructure/Database/Migrations/2025_12_06_120000_align_tenant_users_with_universal_core_schema.php | head -100
```

## Quick Diagnostic Script

Run this to see the complete picture:

```bash
#!/bin/bash

echo "🔍 TENANT PASSWORD COLUMN DIAGNOSTIC"
echo "===================================="

echo ""
echo "1. Checking tenant_uml database schema..."
mysql -u softcrew -p << 'EOF' 2>/dev/null || echo "MySQL error"
USE tenant_uml;
SHOW TABLES;
DESCRIBE tenant_users;
EOF

echo ""
echo "2. Checking migrations table..."
mysql -u softcrew -p << 'EOF' 2>/dev/null || echo "MySQL error"
USE tenant_uml;
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'tenant_uml' 
AND TABLE_NAME = 'migrations';

-- If migrations table exists
SELECT migration, batch FROM migrations 
WHERE migration LIKE '%tenant_users%' 
ORDER BY batch DESC;
EOF

echo ""
echo "3. Checking which password column is used in controllers..."
echo ""
echo "   TenantPasswordResetController:"
grep -n "password.*=>.*Hash::make" app/Contexts/TenantAuth/Infrastructure/Http/Controllers/TenantPasswordResetController.php

echo ""
echo "   TenantAuthenticationController:"
grep -n "Hash::check.*password" app/Contexts/TenantAuth/Infrastructure/Http/Controllers/TenantAuthenticationController.php

echo ""
echo "4. Looking for SecureSetupTokenService..."
SERVICE=$(find . -name "*SecureSetupTokenService*" -type f | head -1)
if [ -n "$SERVICE" ]; then
    echo "   Found at: $SERVICE"
    echo ""
    echo "   setPasswordWithToken method:"
    grep -n -A 20 "setPasswordWithToken" "$SERVICE" || echo "   Method not found in file"
fi
```

## Most Likely Scenarios

### Scenario 1: Migrations never ran
The alignment migration (`2025_12_06_120000_align_tenant_users_with_universal_core_schema.php`) never executed on `tenant_uml`.

**Solution:**
```sql
-- Manually rename the column
USE tenant_uml;
ALTER TABLE tenant_users CHANGE COLUMN password password_hash VARCHAR(255) NULL;
```

### Scenario 2: Controllers use wrong column name
Even if table has `password_hash`, controllers are using `password`.

**Solution:** Update both controllers as shown above.

### Scenario 3: Both issues exist
Table has `password` column AND controllers use `password`.

**Solution:** Do both fixes.

## Let's Check Your Current State

Run this quick check:

```bash
# Check what column exists
mysql -u softcrew -p -e "USE tenant_uml; SHOW COLUMNS FROM tenant_users LIKE 'password%';"
```

## Based on what you find:

**If output shows `password` column:**
```sql
-- Run this fix
ALTER TABLE tenant_uml.tenant_users CHANGE COLUMN password password_hash VARCHAR(255) NULL;
```

**Then update the controllers** (both TenantPasswordResetController and TenantAuthenticationController).

## But Also Need to Check SecureSetupTokenService

Since the error is coming from `SecureSetupController::submitPassword()`, we need to fix the service it calls. Let me search for it:

```bash
# Find the service
find . -type f -name "*.php" -exec grep -l "SecureSetupTokenService" {} \;

# Check what's in the service
find . -type f -name "*SecureSetupTokenService*.php" -exec cat {} \;
```

## Create a Comprehensive Fix

Let me create a fix command that handles everything:

```bash
php artisan make:command FixTenantPasswordSchema
```

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class FixTenantPasswordSchema extends Command
{
    protected $signature = 'tenant:fix-password-schema {slug : Tenant slug}';
    protected $description = 'Fix tenant password schema issues';

    public function handle()
    {
        $slug = $this->argument('slug');
        $tenant = Tenant::where('slug', $slug)->firstOrFail();
        
        $this->info("🔧 Fixing password schema for tenant: {$tenant->name}");
        
        // 1. Check current database schema
        $this->checkDatabaseSchema($tenant);
        
        // 2. Fix controllers if needed
        $this->fixControllers();
        
        // 3. Run migrations if needed
        if ($this->confirm('Run tenant migrations to ensure schema is correct?')) {
            $this->runTenantMigrations($tenant);
        }
        
        $this->info("\n✅ Password schema fix completed!");
        return 0;
    }
    
    private function checkDatabaseSchema($tenant)
    {
        config(['database.connections.tenant.database' => $tenant->database_name]);
        DB::purge('tenant');
        DB::reconnect('tenant');
        
        try {
            $columns = DB::connection('tenant')
                ->select('SHOW COLUMNS FROM tenant_users');
            
            $columnNames = array_column($columns, 'Field');
            
            $hasPassword = in_array('password', $columnNames);
            $hasPasswordHash = in_array('password_hash', $columnNames);
            
            $this->table(['Check', 'Status'], [
                ['Database exists', '✅'],
                ['password column exists', $hasPassword ? '⚠️' : '✅'],
                ['password_hash column exists', $hasPasswordHash ? '✅' : '❌'],
            ]);
            
            if ($hasPassword && !$hasPasswordHash) {
                $this->warn("Table has 'password' column but not 'password_hash'");
                if ($this->confirm('Rename password to password_hash?')) {
                    DB::connection('tenant')->statement(
                        "ALTER TABLE tenant_users CHANGE COLUMN password password_hash VARCHAR(255) NULL"
                    );
                    $this->info("✅ Column renamed");
                }
            } elseif ($hasPassword && $hasPasswordHash) {
                $this->warn("Both 'password' and 'password_hash' columns exist");
                if ($this->confirm('Drop the old password column?')) {
                    DB::connection('tenant')->statement(
                        "ALTER TABLE tenant_users DROP COLUMN password"
                    );
                    $this->info("✅ Old column dropped");
                }
            } elseif (!$hasPasswordHash) {
                $this->error("No password_hash column!");
                if ($this->confirm('Add password_hash column?')) {
                    DB::connection('tenant')->statement(
                        "ALTER TABLE tenant_users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email"
                    );
                    $this->info("✅ Column added");
                }
            }
            
        } catch (\Exception $e) {
            $this->error("Error checking schema: " . $e->getMessage());
        }
    }
    
    private function fixControllers()
    {
        $this->info("\nChecking controllers for password column usage...");
        
        $controllers = [
            'TenantPasswordResetController' => 'app/Contexts/TenantAuth/Infrastructure/Http/Controllers/TenantPasswordResetController.php',
            'TenantAuthenticationController' => 'app/Contexts/TenantAuth/Infrastructure/Http/Controllers/TenantAuthenticationController.php',
        ];
        
        foreach ($controllers as $name => $path) {
            if (File::exists($path)) {
                $content = File::get($path);
                
                // Check for password column usage
                $usesPassword = str_contains($content, "'password' =>") && str_contains($content, 'Hash::make');
                $checksPassword = str_contains($content, 'Hash::check') && str_contains($content, '$user->password');
                
                if ($usesPassword || $checksPassword) {
                    $this->warn("⚠️  $name uses 'password' column");
                    
                    if ($this->confirm("Fix $name to use 'password_hash'?")) {
                        $newContent = str_replace(
                            ["'password' =>", '$user->password'],
                            ["'password_hash' =>", '$user->password_hash'],
                            $content
                        );
                        
                        File::put($path, $newContent);
                        $this->info("✅ $name updated");
                    }
                } else {
                    $this->info("✅ $name uses correct column");
                }
            }
        }
    }
    
    private function runTenantMigrations($tenant)
    {
        $this->info("\nRunning tenant migrations...");
        
        try {
            config(['database.connections.tenant.database' => $tenant->database_name]);
            DB::purge('tenant');
            
            $this->call('migrate', [
                '--database' => 'tenant',
                '--path' => 'packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
                '--force' => true,
            ]);
            
        } catch (\Exception $e) {
            $this->error("Migration failed: " . $e->getMessage());
        }
    }
}
```

## Immediate Action

1. **First, check what column exists:**
```bash
mysql -u softcrew -p -e "USE tenant_uml; SHOW COLUMNS FROM tenant_users LIKE 'password%';"
```

2. **Based on output:**
   - If `password` exists: Rename it to `password_hash`
   - If both exist: Drop `password` column
   - If neither: Run migrations

3. **Update controllers** to use `password_hash` 

4. **Find and fix `SecureSetupTokenService`**

Would you like me to:
1. Show you the exact SQL to fix the database?
2. Help you find and fix the SecureSetupTokenService?
3. Run the diagnostic first to see current state?
###################################################

## Root Cause Analysis

1. **Tenant database `tenant_uml` was created** ✅
2. **Tenant migrations were NOT run** ❌ (because `runTenantMigrations()` is just a stub)
3. **Result**: The `tenant_users` table in `tenant_uml` has the wrong schema (missing `password_hash` column, has `password` column)

## Evidence

From your error:
```sql
update `tenant_users` set `password` = $2y$12$...
```

From your table schema:
```sql
mysql> describe tenant_users;
+---------------------------+------------------------------------------------------------+
| Field                     | Type                                                       |
+---------------------------+------------------------------------------------------------+
| password_hash             | varchar(255)                                               |  # ✅ Correct column
| ...                       | ...                                                        |
+---------------------------+------------------------------------------------------------+
```

But you said the table is empty:
```sql
mysql> select * from tenant_users;
Empty set (0.01 sec)
```

This suggests **two different `tenant_users` tables** or **the schema is wrong**.

## Debug Steps

Let me help you debug this:

### Step 1: Check Actual Tenant Database Schema

```bash
# Connect to MySQL and check
mysql -u softcrew -p

# Use tenant_uml database
USE tenant_uml;

# Show ALL tables
SHOW TABLES;

# Show tenant_users table structure
DESCRIBE tenant_users;

# Check if there's a 'password' column
SHOW COLUMNS FROM tenant_users LIKE 'password%';

# Check for any migrations table
SHOW TABLES LIKE '%migrations%';
```

### Step 2: Fix the TenantDatabaseManager

The `runTenantMigrations()` method needs to be implemented. Here's the fix:

```php
// packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/TenantDatabaseManager.php

/**
 * Run tenant database migrations
 */
public function runTenantMigrations(Tenant $tenant): bool
{
    try {
        Log::info('Running tenant database migrations', [
            'tenant_id' => $tenant->getId(),
            'tenant_slug' => $tenant->getSlug()->toString(),
        ]);

        // Switch to tenant connection
        $this->switchToTenantConnection($tenant);

        // Get the tenant connection name
        $connectionName = $this->getTenantConnectionName($tenant);
        
        // IMPORTANT: Set the database name on the connection
        config([
            "database.connections.{$connectionName}.database" => $tenant->getDatabaseName()->toString()
        ]);
        
        // Purge and reconnect to ensure new database is used
        DB::purge($connectionName);
        DB::reconnect($connectionName);

        // Run migrations specific to TenantAuth context
        $migrator = app('migrator');
        $migrator->setConnection($connectionName);
        
        // Get migration paths for TenantAuth
        $paths = [
            base_path('packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations')
        ];
        
        // Run the migrations
        $migrator->run($paths);

        Log::info('Tenant migrations completed successfully', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'ran_migrations' => $migrator->getMigrationFiles($paths),
        ]);

        return true;
    } catch (Exception $e) {
        Log::error('Failed to run tenant migrations', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ]);
        throw new Exception("Failed to run tenant migrations: {$e->getMessage()}", 0, $e);
    }
}
```

### Step 3: Run Migrations on Existing Tenants

```bash
# First, let's create a command to run migrations on existing tenants
php artisan make:command TenantMigrateAll

# Then run migrations on all tenants
php artisan tenant:migrate-all
```

### Step 4: Create a Test Tenant to Verify

```bash
# Create a test tenant using Tinker
php artisan tinker

// In Tinker
$tenant = \App\Models\Tenant::create([
    'name' => 'Test Tenant',
    'email' => 'test@test.com',
    'slug' => 'test-tenant',
    'database_name' => 'tenant_test',
    'status' => 'active'
]);

// Run provisioning
$service = app(\App\Contexts\TenantAuth\Application\Services\TenantProvisioningService::class);
$service->provisionTenant($tenant);

// Check the database
DB::connection('tenant')->statement('USE tenant_test');
DB::connection('tenant')->select('SHOW TABLES');
```

## Immediate Fix for Your Current Tenant

Since `tenant_uml` already exists but has wrong schema:

### Option 1: Drop and Recreate

```bash
# Drop the database
php artisan tinker
DB::statement('DROP DATABASE IF EXISTS tenant_uml');

# Update tenant record to mark as not provisioned
\App\Models\Tenant::where('slug', 'uml')->update([
    'schema_status' => 'unknown',
    'initial_schema_hash' => null
]);

# Reprovision
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$service = app(\App\Contexts\TenantAuth\Application\Services\TenantProvisioningService::class);
$service->provisionTenant($tenant);
```

### Option 2: Manually Fix Schema

```sql
-- Check current columns
USE tenant_uml;
DESCRIBE tenant_users;

-- If you see 'password' column, rename it
ALTER TABLE tenant_users 
RENAME COLUMN password TO password_hash;

-- OR if both exist, drop the old one
ALTER TABLE tenant_users DROP COLUMN password;

-- Add any missing columns from the migration
ALTER TABLE tenant_users 
ADD COLUMN uuid CHAR(36) NOT NULL AFTER id,
ADD COLUMN first_name VARCHAR(100) NOT NULL,
ADD COLUMN last_name VARCHAR(100) NOT NULL,
-- ... add all other columns from the migration
ADD COLUMN metadata JSON NULL;
```

## Create a Diagnostic Command

Let me create a command to diagnose the issue:

```bash
php artisan make:command DiagnoseTenantSchema
```

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DiagnoseTenantSchema extends Command
{
    protected $signature = 'tenant:diagnose {slug? : Tenant slug}';
    protected $description = 'Diagnose tenant database schema issues';

    public function handle()
    {
        $slug = $this->argument('slug');
        
        if ($slug) {
            $tenants = Tenant::where('slug', $slug)->get();
        } else {
            $tenants = Tenant::all();
        }

        foreach ($tenants as $tenant) {
            $this->info("🔍 Diagnosing tenant: {$tenant->name} ({$tenant->slug})");
            
            try {
                // Try to connect to tenant database
                config(['database.connections.tenant.database' => $tenant->database_name]);
                DB::purge('tenant');
                DB::reconnect('tenant');
                
                // Check if database exists
                $exists = DB::select("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", 
                    [$tenant->database_name]);
                
                if (empty($exists)) {
                    $this->error("  ❌ Database {$tenant->database_name} does not exist");
                    continue;
                }
                
                $this->info("  ✅ Database exists: {$tenant->database_name}");
                
                // Check tenant_users table
                try {
                    $tables = DB::connection('tenant')->select('SHOW TABLES');
                    $tableList = array_column($tables, 'Tables_in_' . $tenant->database_name);
                    
                    if (in_array('tenant_users', $tableList)) {
                        $this->info("  ✅ tenant_users table exists");
                        
                        // Check columns
                        $columns = DB::connection('tenant')
                            ->select("SHOW COLUMNS FROM tenant_users");
                        
                        $hasPassword = false;
                        $hasPasswordHash = false;
                        
                        foreach ($columns as $column) {
                            if ($column->Field === 'password') {
                                $hasPassword = true;
                            }
                            if ($column->Field === 'password_hash') {
                                $hasPasswordHash = true;
                            }
                        }
                        
                        if ($hasPassword) {
                            $this->warn("  ⚠️  Table has 'password' column (should be 'password_hash')");
                        }
                        
                        if ($hasPasswordHash) {
                            $this->info("  ✅ Table has 'password_hash' column");
                        }
                        
                        if (!$hasPassword && !$hasPasswordHash) {
                            $this->error("  ❌ Table has neither 'password' nor 'password_hash' column");
                        }
                        
                    } else {
                        $this->error("  ❌ tenant_users table does not exist");
                    }
                    
                    // Check migrations table
                    if (in_array('migrations', $tableList)) {
                        $migrations = DB::connection('tenant')
                            ->table('migrations')
                            ->where('migration', 'like', '%tenant_users%')
                            ->get();
                        
                        if ($migrations->isEmpty()) {
                            $this->warn("  ⚠️  No tenant_users migrations found in migrations table");
                        } else {
                            $this->info("  ✅ Found tenant_users migrations: " . $migrations->count());
                        }
                    } else {
                        $this->warn("  ⚠️  No migrations table found");
                    }
                    
                } catch (\Exception $e) {
                    $this->error("  ❌ Error checking tables: " . $e->getMessage());
                }
                
            } catch (\Exception $e) {
                $this->error("  ❌ Error connecting to tenant database: " . $e->getMessage());
            }
            
            $this->line("");
        }
        
        return 0;
    }
}
```

## Recommended Action Plan

1. **First, run the diagnostic:**
```bash
php artisan tenant:diagnose uml
```

2. **Fix the TenantDatabaseManager** to actually run migrations
3. **For existing tenant `uml`:**
   - If schema is wrong: Option 2 (manually fix) is quicker
   - If you can recreate: Option 1 (drop and recreate) is cleaner
4. **Test password setup again** after fixing

########################################
next Steps
########################################
Now I see the complete picture! The issue is in the `runTenantMigrations()` method of `TenantDatabaseManager`. It's just logging a message but not actually running migrations. Let me examine the current implementation:

## Current Problem

From the code you shared, I can see that the `runTenantMigrations()` method only logs:
```php
// Note: In actual implementation, this would use Artisan::call with tenant connection
// For now, we'll log the intent  ⚠️ ⚠️ ⚠️
Log::info('Tenant migrations would be executed here', [
    'tenant_id' => $tenant->getId(),
    'connection' => $this->getTenantConnectionName($tenant),
]);
```

## The Fix

We need to implement the actual migration execution. Here's what we need to do:

### 1. First, Let's Check if Migrations are in the Right Place

```bash
# Check where migrations are stored
ls -la packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations/

# They should be here:
# 2025_09_28_143000_create_tenant_users_table.php
# 2025_12_06_120000_align_tenant_users_with_universal_core_schema.php
# etc.
```

### 2. Fix the TenantDatabaseManager

Here's the corrected `runTenantMigrations()` method:

```php
// In TenantDatabaseManager.php
public function runTenantMigrations(Tenant $tenant): bool
{
    try {
        Log::info('Running tenant database migrations', [
            'tenant_id' => $tenant->getId(),
            'tenant_slug' => $tenant->getSlug()->toString(),
        ]);

        // Switch to tenant connection
        $this->switchToTenantConnection($tenant);
        
        // Get the tenant connection name
        $connectionName = $this->getTenantConnectionName($tenant);
        
        // Set the database name explicitly
        config([
            "database.connections.{$connectionName}.database" => $tenant->getDatabaseName()->toString()
        ]);
        
        // Purge and reconnect to ensure new config is used
        DB::purge($connectionName);
        DB::reconnect($connectionName);
        
        // Run migrations using the migrator
        $migrator = app('migrator');
        $migrator->setConnection($connectionName);
        
        // Path to TenantAuth migrations
        $migrationPath = base_path('packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations');
        
        // Get all migration files
        $files = $migrator->getMigrationFiles($migrationPath);
        
        // Run migrations
        $migrator->run($migrationPath);
        
        Log::info('Tenant migrations completed successfully', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'migrations_run' => count($files),
        ]);

        return true;
    } catch (Exception $e) {
        Log::error('Failed to run tenant migrations', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ]);
        throw new Exception("Failed to run tenant migrations: {$e->getMessage()}", 0, $e);
    }
}
```

### 3. Test with Your Existing Tenant

Let's manually run migrations on your `tenant_uml` database:

```bash
php artisan tinker
```

```php
// In Tinker
use App\Models\Tenant;
use App\Contexts\TenantAuth\Infrastructure\Database\TenantDatabaseManager;

$tenant = Tenant::where('slug', 'uml')->first();
$manager = app(TenantDatabaseManager::class);

// First, let's check current tables
config(['database.connections.tenant.database' => 'tenant_uml']);
DB::purge('tenant');
DB::reconnect('tenant');

$tables = DB::connection('tenant')->select('SHOW TABLES');
echo "Current tables in tenant_uml:\n";
foreach ($tables as $table) {
    echo "- " . $table->Tables_in_tenant_uml . "\n";
}

// Check tenant_users table structure if it exists
try {
    $columns = DB::connection('tenant')->select('SHOW COLUMNS FROM tenant_users');
    echo "\nCurrent tenant_users columns:\n";
    foreach ($columns as $column) {
        echo "- {$column->Field} ({$column->Type})\n";
    }
} catch (Exception $e) {
    echo "No tenant_users table or error: " . $e->getMessage() . "\n";
}

// Now run migrations
echo "\nRunning migrations...\n";
$result = $manager->runTenantMigrations($tenant);
echo "Migrations result: " . ($result ? 'SUCCESS' : 'FAILED') . "\n";

// Check tables again
$tables = DB::connection('tenant')->select('SHOW TABLES');
echo "\nTables after migrations:\n";
foreach ($tables as $table) {
    echo "- " . $table->Tables_in_tenant_uml . "\n";
}
```

### 4. If Migrations Fail Due to Existing Table

If the `tenant_users` table already exists with wrong schema, we need to drop it first:

```php
// In Tinker
DB::connection('tenant')->statement('DROP TABLE IF EXISTS tenant_users');
DB::connection('tenant')->statement('DROP TABLE IF EXISTS migrations');
```

### 5. Create a Command to Run Migrations on All Tenants

```bash
php artisan make:command TenantMigrateAll
```

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use App\Contexts\TenantAuth\Infrastructure\Database\TenantDatabaseManager;

class TenantMigrateAll extends Command
{
    protected $signature = 'tenant:migrate-all {--force : Force migration even if tenant is not active}';
    protected $description = 'Run migrations on all tenant databases';

    public function handle()
    {
        $force = $this->option('force');
        
        $query = Tenant::query();
        if (!$force) {
            $query->where('status', 'active');
        }
        
        $tenants = $query->get();
        
        $this->info("Found {$tenants->count()} tenants to migrate");
        
        $manager = app(TenantDatabaseManager::class);
        
        foreach ($tenants as $tenant) {
            $this->info("Migrating tenant: {$tenant->name} ({$tenant->slug})...");
            
            try {
                $result = $manager->runTenantMigrations($tenant);
                
                if ($result) {
                    $this->info("  ✅ Migrations completed successfully");
                } else {
                    $this->error("  ❌ Migrations failed");
                }
            } catch (\Exception $e) {
                $this->error("  ❌ Error: " . $e->getMessage());
            }
        }
        
        $this->info("\nMigration process completed!");
        return 0;
    }
}
```

### 6. Quick Diagnostic

Run this to see what's happening:

```bash
# Check if tenant_uml has migrations table
mysql -u softcrew -p -e "USE tenant_uml; SHOW TABLES;"

# Check tenant_users table structure
mysql -u softcrew -p -e "USE tenant_uml; DESCRIBE tenant_users;"

# Check what columns exist
mysql -u softcrew -p -e "USE tenant_uml; SHOW COLUMNS FROM tenant_users LIKE 'password%';"
```

## Immediate Actions

1. **First, check current state:**
```bash
mysql -u softcrew -p -e "USE tenant_uml; SHOW TABLES; DESCRIBE tenant_users;"
```

2. **If tenant_users has 'password' column instead of 'password_hash':**
```sql
-- In MySQL
USE tenant_uml;
ALTER TABLE tenant_users RENAME COLUMN password TO password_hash;
-- OR if you want both
ALTER TABLE tenant_users ADD COLUMN password_hash VARCHAR(255) NULL;
UPDATE tenant_users SET password_hash = password;
ALTER TABLE tenant_users DROP COLUMN password;
```

3. **If table doesn't exist at all:**
   - The migrations were never run
   - We need to fix `runTenantMigrations()` method

4. **Run the fixed migrations:**
```bash
php artisan tinker
```

```php
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$manager = app(\App\Contexts\TenantAuth\Infrastructure\Database\TenantDatabaseManager::class);

// Fix the runTenantMigrations method first
// Then run:
$manager->runTenantMigrations($tenant);
```

## The Core Issue Summary

1. ✅ Tenant database `tenant_uml` was created
2. ❌ `tenant_users` table was created with wrong schema OR not created at all
3. ❌ `runTenantMigrations()` method doesn't actually run migrations (it's just a stub)
4. ❌ Password setup tries to update `password` column but table has `password_hash`

**Solution**: Fix `runTenantMigrations()` to actually run the migrations from `packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations/`.

Would you like me to:
1. Show you the exact fix for `runTenantMigrations()` method?
2. Provide SQL to fix your existing `tenant_uml.tenant_users` table?
3. Create a test to verify migrations work correctly?

Let me know and I'll provide the specific solution!
##########################################
#next Steps
##########################################
Perfect! Now I can see the migrations. Let me check what's in the `tenant_users` table migrations to understand the schema evolution:

## Migration Analysis

Looking at the migration files:

1. **`2025_09_28_143000_create_tenant_users_table.php`** - Original table creation
2. **`2025_12_06_120000_align_tenant_users_with_universal_core_schema.php`** - Major upgrade
3. **`2025_12_06_130000_complete_tenant_users_alignment.php`** - Completion

Let me check what columns are defined in these migrations:

### First, let's see the original table structure:

```bash
# Check the initial tenant_users table migration
cat app/Contexts/TenantAuth/Infrastructure/Database/Migrations/2025_09_28_143000_create_tenant_users_table.php
```

### Check the alignment migration:

```bash
# Check what changes were made
cat app/Contexts/TenantAuth/Infrastructure/Database/Migrations/2025_12_06_120000_align_tenant_users_with_universal_core_schema.php
```

### The Critical Issue

The problem is that **when the tenant database was created, only the original migration ran** (or maybe no migrations ran at all). The alignment migrations that rename `password` to `password_hash` never executed.

## Let's Diagnose Your Current Tenant

Run these commands:

```bash
# 1. Check current tenant_uml database tables
mysql -u softcrew -p -e "USE tenant_uml; SHOW TABLES;"

# 2. Check tenant_users table structure
mysql -u softcrew -p -e "USE tenant_uml; DESCRIBE tenant_users;"

# 3. Check migrations table (if it exists)
mysql -u softcrew -p -e "USE tenant_uml; SHOW TABLES LIKE 'migrations';"
mysql -u softcrew -p -e "USE tenant_uml; SELECT * FROM migrations WHERE migration LIKE '%tenant_users%';" 2>/dev/null || echo "No migrations table or error"

# 4. Check which migration batch was run last
mysql -u softcrew -p -e "USE tenant_uml; SELECT batch, migration FROM migrations ORDER BY batch DESC LIMIT 5;" 2>/dev/null || echo "Cannot query migrations"
```

## Quick Fix Options

### Option 1: Manual Schema Fix (Quickest)

If `tenant_users` exists with `password` column:

```sql
-- In MySQL
USE tenant_uml;

-- Check current columns
SHOW COLUMNS FROM tenant_users;

-- If you see 'password' column, rename it to 'password_hash'
ALTER TABLE tenant_users 
CHANGE COLUMN password password_hash VARCHAR(255) NULL DEFAULT NULL;

-- Add any missing columns from the alignment migration
-- (Check what columns are missing by comparing with the migration files)
```

### Option 2: Drop and Recreate with Fixed Migration Runner

First, let's fix the `runTenantMigrations()` method. Here's the corrected version:

```php
// In TenantDatabaseManager.php - Replace the entire runTenantMigrations method

public function runTenantMigrations(Tenant $tenant): bool
{
    try {
        Log::info('Running tenant database migrations', [
            'tenant_id' => $tenant->getId(),
            'tenant_slug' => $tenant->getSlug()->toString(),
        ]);

        // Get tenant connection name
        $connectionName = $this->getTenantConnectionName($tenant);
        
        // Switch to tenant connection
        $this->switchToTenantConnection($tenant);
        
        // IMPORTANT: Ensure database is set correctly
        config([
            "database.connections.{$connectionName}.database" => $tenant->getDatabaseName()->toString()
        ]);
        
        // Purge and reconnect
        DB::purge($connectionName);
        DB::reconnect($connectionName);
        
        // Run migrations using Artisan call
        Artisan::call('migrate', [
            '--database' => $connectionName,
            '--path' => 'packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
            '--force' => true,
        ]);
        
        Log::info('Tenant migrations completed successfully', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'output' => Artisan::output(),
        ]);

        return true;
    } catch (Exception $e) {
        Log::error('Failed to run tenant migrations', [
            'tenant_id' => $tenant->getId(),
            'database' => $tenant->getDatabaseName()->toString(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ]);
        throw new Exception("Failed to run tenant migrations: {$e->getMessage()}", 0, $e);
    }
}
```

### Option 3: Create a Repair Command

```bash
php artisan make:command RepairTenantSchema
```

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

class RepairTenantSchema extends Command
{
    protected $signature = 'tenant:repair {slug : Tenant slug} {--force : Force repair even if destructive}';
    protected $description = 'Repair tenant database schema issues';

    public function handle()
    {
        $slug = $this->argument('slug');
        $force = $this->option('force');
        
        $tenant = Tenant::where('slug', $slug)->firstOrFail();
        
        $this->info("🔧 Repairing tenant: {$tenant->name} ({$tenant->slug})");
        
        // Connect to tenant database
        config(['database.connections.tenant.database' => $tenant->database_name]);
        DB::purge('tenant');
        DB::reconnect('tenant');
        
        try {
            // Check current state
            $columns = DB::connection('tenant')->select('SHOW COLUMNS FROM tenant_users');
            $columnNames = array_column($columns, 'Field');
            
            $this->table(['Column', 'Exists'], [
                ['password', in_array('password', $columnNames) ? '✅ YES' : '❌ NO'],
                ['password_hash', in_array('password_hash', $columnNames) ? '✅ YES' : '❌ NO'],
            ]);
            
            // Fix password column issue
            if (in_array('password', $columnNames) && !in_array('password_hash', $columnNames)) {
                $this->info("Found 'password' column but no 'password_hash' column");
                
                if ($force || $this->confirm('Rename password column to password_hash?')) {
                    DB::connection('tenant')->statement(
                        "ALTER TABLE tenant_users CHANGE COLUMN password password_hash VARCHAR(255) NULL"
                    );
                    $this->info("✅ Renamed password column to password_hash");
                }
            } elseif (in_array('password', $columnNames) && in_array('password_hash', $columnNames)) {
                $this->warn("Both 'password' and 'password_hash' columns exist");
                
                if ($force || $this->confirm('Drop the old password column?')) {
                    // Copy data if needed
                    $hasPasswordData = DB::connection('tenant')
                        ->table('tenant_users')
                        ->whereNotNull('password')
                        ->exists();
                    
                    if ($hasPasswordData) {
                        $this->warn("⚠️  There is data in the password column. Copying to password_hash...");
                        DB::connection('tenant')->statement(
                            "UPDATE tenant_users SET password_hash = password WHERE password IS NOT NULL"
                        );
                    }
                    
                    DB::connection('tenant')->statement("ALTER TABLE tenant_users DROP COLUMN password");
                    $this->info("✅ Dropped old password column");
                }
            } elseif (!in_array('password_hash', $columnNames)) {
                $this->error("No password_hash column found!");
                
                if ($force || $this->confirm('Add password_hash column?')) {
                    DB::connection('tenant')->statement(
                        "ALTER TABLE tenant_users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email"
                    );
                    $this->info("✅ Added password_hash column");
                }
            } else {
                $this->info("✅ Schema looks correct - password_hash column exists");
            }
            
            // Check for other missing columns from alignment migration
            $this->info("\nChecking for other missing columns...");
            
            $expectedColumns = [
                'uuid', 'first_name', 'last_name', 'phone', 'phone_country_code',
                'email_verified_at', 'phone_verified_at', 'failed_login_attempts',
                'locked_until', 'must_change_password', 'status', 'tenant_id',
                'metadata', 'identity_data', 'address_data', 'professional_data',
                'communication_preferences', 'last_login_at', 'created_by_id',
                'updated_by_id', 'deleted_at'
            ];
            
            $missing = array_diff($expectedColumns, $columnNames);
            
            if (!empty($missing)) {
                $this->warn("Missing columns: " . implode(', ', $missing));
                
                if ($force || $this->confirm('Run full alignment migration?')) {
                    $this->call('migrate', [
                        '--database' => 'tenant',
                        '--path' => 'packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
                        '--force' => true,
                    ]);
                }
            } else {
                $this->info("✅ All expected columns present");
            }
            
        } catch (\Exception $e) {
            $this->error("Repair failed: " . $e->getMessage());
            return 1;
        }
        
        $this->info("\n✅ Repair completed!");
        return 0;
    }
}
```

## Recommended Action Plan

1. **First, check current state:**
```bash
mysql -u softcrew -p -e "USE tenant_uml; DESCRIBE tenant_users;"
```

2. **Based on what you find:**
   - If `password` column exists: Use Option 1 (manual fix)
   - If table doesn't exist: Fix `runTenantMigrations()` then rerun

3. **Test the password setup again** after fixing

## Quick Test

Run this to see what you're working with:

```bash
# Check tenant_uml tenant_users table
mysql -u softcrew -p << 'EOF'
USE tenant_uml;
SHOW TABLES;
DESCRIBE tenant_users;
SHOW COLUMNS FROM tenant_users LIKE 'password%';
SELECT COUNT(*) as user_count FROM tenant_users;
EOF
```

## Most Likely Scenario

Based on the error message and your migrations, I suspect:

1. The original `2025_09_28_143000_create_tenant_users_table.php` created a table with `password` column
2. The alignment migration `2025_12_06_120000_align_tenant_users_with_universal_core_schema.php` was supposed to rename it to `password_hash`
3. But the alignment migration never ran on `tenant_uml`

**Quick fix SQL:**
```sql
USE tenant_uml;
ALTER TABLE tenant_users CHANGE COLUMN password password_hash VARCHAR(255) NULL;
```

Run that SQL and your password setup should work!

Let me know what you find when you check the current schema, and I'll give you the exact fix.
