# 🐛 **Debug Instructions: Why `php artisan migrate` Installs Membership Tables**

## **Problem Analysis**

When you run `php artisan migrate`, it's **incorrectly trying to run Membership migrations** that should ONLY run via Platform Context installation. This happens because:

### **Likely Root Causes:**

1. **Migration path included in default migration paths**
2. **Migrations not properly namespaced/isolated**
3. **Auto-discovery picking up tenant migrations**
4. **Config/database.php not properly configured**

## **🔍 Step-by-Step Debug Instructions**

### **Step 1: Check What Migrations Are Being Run**

```bash
# 1. List all migrations that would run
php artisan migrate:status

# 2. Check specifically for Membership migrations
php artisan migrate:status | grep -i member

# 3. Verbose output to see which migration files are being considered
php artisan migrate --pretend --vvv
```

### **Step 2: Check Migration Configuration**

```bash
# 1. Check Laravel's migration paths
php artisan tinker --execute="
\$paths = config('database.migrations');
echo 'Migration paths:\\n';
foreach (\$paths as \$path) {
    echo '  - ' . \$path . '\\n';
}
"

# 2. Check if Membership migrations are in any of these paths
php artisan tinker --execute="
\$membershipPath = 'app/Contexts/Membership/Infrastructure/Database/Migrations';
\$tenantPath = \$membershipPath . '/Tenant';

\$paths = config('database.migrations');
echo 'Searching for membership migrations...\\n';

foreach (\$paths as \$path) {
    \$fullPath = base_path(\$path);
    echo 'Checking: ' . \$fullPath . '\\n';
    
    // Check main path
    if (strpos(\$fullPath, \$membershipPath) !== false) {
        echo '  ❌ Membership path found in migration paths!\\n';
    }
    
    // Check Tenant subpath
    if (strpos(\$fullPath, \$tenantPath) !== false) {
        echo '  ❌ Tenant migrations found in migration paths!\\n';
    }
}
"
```

### **Step 3: Check Database Connection Configuration**

```bash
# Check which connection is being used for migrations
php artisan tinker --execute="
echo 'Current default connection: ' . config('database.default') . '\\n';
echo 'Database for this connection: ' . config('database.connections.' . config('database.default') . '.database') . '\\n';

// Check if we're on tenant or landlord
\$conn = config('database.default');
if (\$conn === 'tenant') {
    echo '⚠️  WARNING: Running migrations on tenant connection!\\n';
    echo 'This will try to install tenant modules.\\n';
}
"
```

### **Step 4: Trace Migration File Discovery**

Create a debug script to see exactly what's happening:

```bash
# debug-migration-discovery.php
<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

// Run with verbose output
$kernel->call('migrate', [
    '--pretend' => true,
    '--vvv' => true
]);

// Or check migration paths directly
echo "\n\n=== Migration Paths ===\n";
$paths = $app->make('migrator')->paths();
foreach ($paths as $path) {
    echo "  $path\n";
}

// Check for membership migration files
echo "\n\n=== Searching for Membership migrations ===\n";
$migrator = $app->make('migrator');
$files = $migrator->getMigrationFiles($paths);

foreach ($files as $file => $path) {
    if (strpos($path, 'Membership') !== false) {
        echo "  ❌ FOUND: $file\n";
        echo "     Path: $path\n";
    }
}
```

### **Step 5: Check for Auto-Discovery Issues**

```bash
# Check if Laravel is auto-discovering migrations
php artisan tinker --execute="
// Check Service Providers
\$providers = config('app.providers');
foreach (\$providers as \$provider) {
    if (strpos(\$provider, 'Membership') !== false) {
        echo 'Membership Service Provider: ' . \$provider . '\\n';
        
        // Check if it adds migration paths
        \$providerClass = new \$provider(app());
        if (method_exists(\$providerClass, 'boot')) {
            echo '  Has boot method - may be adding migration paths\\n';
        }
    }
}
"
```

## **🔧 Immediate Fixes to Try**

### **Fix 1: Remove Migration Path from Config**

Check `config/database.php`:

```php
// Should NOT include tenant migration paths
'migrations' => [
    'database/migrations',
    // ❌ DO NOT include: 'app/Contexts/Membership/Infrastructure/Database/Migrations',
    // ❌ DO NOT include: 'app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant',
],
```

### **Fix 2: Check Service Providers**

Look for any ServiceProvider that might be adding migration paths:

```bash
grep -r "addMigrationPath" app/ vendor/ --include="*.php"
```

### **Fix 3: Use Database-Specific Migrations**

When running migrations, specify which database:

```bash
# For landlord database only
php artisan migrate --database=landlord

# For testing only
php artisan migrate --database=landlord_test
```

### **Fix 4: Create a Safe Migration Command**

Create an Artisan command that prevents tenant migrations:

```php
// app/Console/Commands/MigrateSafe.php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class MigrateSafe extends Command
{
    protected $signature = 'migrate:safe 
                            {--database= : The database connection to use}
                            {--path= : The path to the migrations files}
                            {--pretend : Dump the SQL queries that would be run}';
    
    protected $description = 'Run migrations but exclude tenant module migrations';
    
    public function handle()
    {
        $paths = $this->getSafeMigrationPaths();
        
        foreach ($paths as $path) {
            $this->call('migrate', [
                '--database' => $this->option('database') ?: 'landlord',
                '--path' => $path,
                '--pretend' => $this->option('pretend'),
            ]);
        }
    }
    
    protected function getSafeMigrationPaths(): array
    {
        return [
            'database/migrations',
            'app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations',
            'app/Contexts/Geography/Infrastructure/Database/Migrations',
            // ❌ DO NOT INCLUDE Tenant module migrations
        ];
    }
}
```

## **🔄 The Correct Workflow**

### **For Framework Migrations:**
```bash
# Landlord database only
php artisan migrate --database=landlord

# Or use safe command
php artisan migrate:safe
```

### **For Tenant Module Installation:**
```bash
# NEVER use php artisan migrate
# INSTEAD use Platform Context installer

# Via admin UI: Click "Install Membership" button

# Or via CLI for development:
php artisan context:install Membership --tenant=your-tenant-slug
```

## **📝 Investigation Checklist**

Run these commands to diagnose:

```bash
# 1. What migrations would actually run?
php artisan migrate --pretend 2>&1 | grep -A2 -B2 "members"

# 2. Check migration table for existing migrations
php artisan tinker --execute="
use Illuminate\Support\Facades\DB;
\$migrations = DB::table('migrations')->where('migration', 'like', '%member%')->get();
echo 'Found ' . \$migrations->count() . ' membership migrations in migrations table\\n';
foreach (\$migrations as \$m) {
    echo '  - ' . \$m->migration . ' (batch: ' . \$m->batch . ')\\n';
}
"

# 3. Check all migration files on disk
find . -name "*member*" -type f | grep -i migration

# 4. Check composer.json for auto-discovery
grep -A5 -B5 "Membership" composer.json

# 5. Check package discovery
cat bootstrap/cache/packages.php | grep -i member
```

## **🚨 Emergency Fix (If Migration Already Ran)**

If the migration already created the table incorrectly:

```bash
# 1. Rollback the specific migration
php artisan migrate:rollback --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/2026_01_02_140853_create_members_table.php

# 2. Remove from migrations table
php artisan tinker --execute="
DB::table('migrations')
    ->where('migration', '2026_01_02_140853_create_members_table')
    ->delete();
echo 'Removed from migrations table\\n';
"

# 3. Drop the table if it exists
php artisan tinker --execute="
\$tenant = App\\Models\\Tenant::first();
if (\$tenant) {
    \$tenant->makeCurrent();
    config(['database.connections.tenant.database' => \$tenant->database_name]);
    \\Illuminate\\Support\\Facades\\DB::purge('tenant');
    
    if (\\Illuminate\\Support\\Facades\\Schema::connection('tenant')->hasTable('members')) {
        \\Illuminate\\Support\\Facades\\Schema::connection('tenant')->drop('members');
        echo 'Dropped members table from tenant database\\n';
    }
}
"
```

## **🏗️ Long-Term Solution**

### **1. Create Migration Path Policy**

Add this to `AppServiceProvider`:

```php
public function boot()
{
    // Prevent tenant migrations from being discovered
    $migrator = $this->app->make('migrator');
    
    $migrator->path(function ($paths) {
        return array_filter($paths, function ($path) {
            // Block tenant module migrations
            $blockedPatterns = [
                '/Infrastructure\/Database\/Migrations\/Tenant/',
                '/Membership.*Migrations/',
            ];
            
            foreach ($blockedPatterns as $pattern) {
                if (preg_match($pattern, $path)) {
                    return false;
                }
            }
            
            return true;
        });
    });
}
```

### **2. Update Deployment Documentation**

Add clear warnings:

```markdown
## 🚨 CRITICAL: NEVER RUN `php artisan migrate` WITHOUT PARAMETERS

### **Correct Commands:**

# Landlord database only
php artisan migrate --database=landlord

# Test database only  
php artisan migrate --database=landlord_test

# Tenant modules should ONLY be installed via:
php artisan context:install {ModuleName} --tenant={slug}

### **What Happens If You Run Plain `php artisan migrate`:**
- ❌ Tries to install tenant modules on landlord database
- ❌ Creates duplicate tables
- ❌ Breaks multi-tenancy isolation
- ❌ Requires manual cleanup
```

### **3. Add Safety Check to Migration**

Add this to the beginning of tenant migration files:

```php
public function up()
{
    // SAFETY CHECK: Prevent running via standard migrate command
    if (!app()->runningInConsole() || 
        !str_contains(request()->server('argv')[1] ?? '', 'context:install')) {
        
        throw new \RuntimeException(
            'This migration should ONLY run via Platform Context installer. ' .
            'Use: php artisan context:install Membership --tenant={slug}'
        );
    }
    
    // Rest of migration...
}
```

## **📊 Diagnostic Report Template**

When reporting this issue, include:

```bash
# 1. System info
php artisan about

# 2. Migration paths
php artisan tinker --execute="print_r(config('database.migrations'));"

# 3. Migration status
php artisan migrate:status --database=landlord

# 4. Context installer status
php artisan context:list

# 5. Current connections
php artisan tinker --execute="
echo 'Default: ' . config('database.default') . '\\n';
echo 'Landlord: ' . config('database.connections.landlord.database') . '\\n';
echo 'Tenant: ' . config('database.connections.tenant.database') . '\\n';
"
```

## **🎯 Quick Answer to Your Question**

**Why does `php artisan migrate` try to install Membership tables?**

Because:
1. **Migration paths** in `config/database.php` likely include the Membership migration directory
2. **Auto-discovery** might be picking up migrations from the `app/Contexts/Membership` folder
3. **Default connection** might be set to `tenant` instead of `landlord`

**Solution:** 
1. Run `php artisan migrate --database=landlord` instead
2. Remove tenant migration paths from config
3. Use `php artisan context:install Membership` for tenant module installation

**Immediate fix:** Run this diagnostic:

```bash
# Find the culprit
php artisan tinker --execute="
\$paths = config('database.migrations');
foreach (\$paths as \$path) {
    if (strpos(\$path, 'Membership') !== false) {
        echo '❌ FOUND: ' . \$path . '\\n';
    }
}
"
```

Then remove the offending path from `config/database.php`.