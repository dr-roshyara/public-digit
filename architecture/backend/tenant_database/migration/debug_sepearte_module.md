# 🐛 **Developer Debug Guide: Solving "php artisan migrate Installs Tenant Modules" Problem**

## **📋 Problem Statement**

**Symptom**: Running `php artisan migrate` incorrectly attempts to install tenant-specific modules (like Membership, DigitalCard) instead of just framework migrations.

**Expected Behavior**:
- `php artisan migrate` → Only installs framework/landlord tables
- `php artisan context:install Membership --tenant=nrna` → Installs tenant modules

**Actual Behavior**:
- `php artisan migrate` → Tries to create `members` table and other tenant tables

---

## **🔍 Diagnostic Phase**

### **Step 1: Confirm the Problem**

```bash
# Check migration status
php artisan migrate:status

# Look for tenant module migrations (should be NOT in this list)
php artisan migrate:status | grep -E "(members|digital_card|election)"

# Expected output: No tenant module migrations should appear
# Actual output: You'll see them as "Pending"
```

### **Step 2: Identify Which Migrations Are Being Discovered**

```bash
# List all migration paths Laravel knows about
php artisan tinker --execute="
\$migrator = app('migrator');
echo '=== Migration Paths ===\\n';
foreach (\$migrator->paths() as \$path) {
    echo '📁 ' . \$path . '\\n';
    
    // Check contents
    if (is_dir(\$path)) {
        \$files = glob(\$path . '/*.php');
        foreach (\$files as \$file) {
            \$filename = basename(\$file);
            if (preg_match('/(members|digital.?card|election)/i', \$filename)) {
                echo '   ❌ Tenant migration: ' . \$filename . '\\n';
            }
        }
    }
}
"
```

### **Step 3: Find the Culprit - Service Provider Analysis**

```bash
# Find ALL loadMigrationsFrom calls in the codebase
grep -r "loadMigrationsFrom" app/ --include="*.php"

# Specifically look for tenant context providers
find app/Contexts -name "*ServiceProvider.php" -exec grep -l "loadMigrationsFrom" {} \;

# Check each problematic provider
for provider in $(grep -l "loadMigrationsFrom.*Tenant" app/Contexts/*/Infrastructure/Providers/*.php 2>/dev/null); do
    echo "🔍 Checking: $provider"
    grep -n "loadMigrationsFrom" "$provider"
    echo "---"
done
```

### **Step 4: Check Migration Table Records**

```bash
# See if tenant migrations are already in the landlord migrations table
php artisan tinker --execute="
use Illuminate\\Support\\Facades\\DB;

echo '=== Migration Table Analysis ===\\n';

// Check landlord database
\$migrations = DB::connection('landlord')
    ->table('migrations')
    ->orderBy('id')
    ->get();

\$tenantMigrations = [];
foreach (\$migrations as \$m) {
    if (preg_match('/(members|digital.?card|election)/i', \$m->migration)) {
        \$tenantMigrations[] = \$m;
    }
}

if (count(\$tenantMigrations) > 0) {
    echo '❌ Found ' . count(\$tenantMigrations) . ' tenant migrations in landlord DB:\\n';
    foreach (\$tenantMigrations as \$m) {
        echo '   - ' . \$m->migration . ' (batch: ' . \$m->batch . ')\\n';
    }
} else {
    echo '✅ No tenant migrations in landlord DB\\n';
}
"
```

---

## **🔧 Fix Phase**

### **Step 1: Fix the Service Provider(s)**

#### **Identify the Problematic Code:**

Typically found in files like:
- `app/Contexts/Membership/Infrastructure/Providers/MembershipServiceProvider.php`
- `app/Contexts/DigitalCard/Infrastructure/Providers/DigitalCardServiceProvider.php`

**Problematic Code Pattern:**
```php
public function boot()
{
    // ❌ WRONG - This loads tenant migrations globally
    $this->loadMigrationsFrom([
        base_path('app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant'),
    ]);
}
```

#### **Fix Options:**

**Option A: Comment Out (Quick Fix)**
```php
public function boot()
{
    // ❌ REMOVE or COMMENT OUT - Tenant migrations should NOT be loaded globally
    // $this->loadMigrationsFrom([
    //     base_path('app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant'),
    // ]);
    
    // ✅ Keep other boot functionality
    $this->registerPolicies();
    $this->loadRoutesFrom(__DIR__ . '/../Routes/api.php');
}
```

**Option B: Move to Landlord-Only (If Needed)**
```php
public function boot()
{
    // Only load landlord migrations (if this context has any)
    $landlordPath = __DIR__ . '/../Database/Migrations/Landlord';
    if (is_dir($landlordPath)) {
        $this->loadMigrationsFrom($landlordPath);  // ✅ OK for landlord
    }
    
    // ❌ DO NOT load Tenant/ migrations
    // Tenant migrations are handled by Platform Context's ContextScanner
}
```

### **Step 2: Clean Up Database State**

```bash
# Remove tenant migrations from landlord migrations table
php artisan tinker --execute="
use Illuminate\\Support\\Facades\\DB;

echo '=== Cleaning Migration Table ===\\n';

// List of tenant migration patterns to remove
\$patterns = [
    '%members%',
    '%digital_card%',
    '%digitalcard%',
    '%election%',
    '%tenant_%',  // Any tenant-specific tables
];

foreach (\$patterns as \$pattern) {
    \$count = DB::connection('landlord')
        ->table('migrations')
        ->where('migration', 'like', \$pattern)
        ->count();
    
    if (\$count > 0) {
        echo 'Found ' . \$count . ' migrations matching: ' . \$pattern . '\\n';
        
        // Show what will be removed
        \$migrations = DB::connection('landlord')
            ->table('migrations')
            ->where('migration', 'like', \$pattern)
            ->get();
        
        foreach (\$migrations as \$m) {
            echo '   - ' . \$m->migration . '\\n';
        }
        
        // Confirm before deleting
        echo 'Remove these migrations? (yes/no): ';
        \$handle = fopen('php://stdin', 'r');
        \$response = trim(fgets(\$handle));
        
        if (strtolower(\$response) === 'yes') {
            \$deleted = DB::connection('landlord')
                ->table('migrations')
                ->where('migration', 'like', \$pattern)
                ->delete();
            
            echo 'Removed ' . \$deleted . ' migrations\\n';
        }
    }
}
"
```

### **Step 3: Verify Other Contexts**

```bash
# Create a verification script
cat > check-tenant-migrations.sh << 'EOF'
#!/bin/bash

echo "=== Tenant Migration Configuration Check ==="

# Check all contexts
for context_dir in app/Contexts/*; do
    context=$(basename $context_dir)
    
    echo -e "\n🔍 Context: $context"
    
    # Check for ServiceProvider
    provider_file="$context_dir/Infrastructure/Providers/${context}ServiceProvider.php"
    
    if [ -f "$provider_file" ]; then
        echo "  ServiceProvider: ✅ Found"
        
        # Check for loadMigrationsFrom
        if grep -q "loadMigrationsFrom" "$provider_file"; then
            echo "  loadMigrationsFrom: ⚠️  FOUND"
            grep -n "loadMigrationsFrom" "$provider_file" | sed 's/^/    /'
            
            # Check if it's loading Tenant migrations
            if grep -q "loadMigrationsFrom.*Tenant" "$provider_file"; then
                echo "  ❌ PROBLEM: Loading Tenant migrations globally!"
            fi
        else
            echo "  loadMigrationsFrom: ✅ Not found (correct)"
        fi
    else
        echo "  ServiceProvider: ❓ Not found"
    fi
    
    # Check migration directories
    migrations_dir="$context_dir/Infrastructure/Database/Migrations"
    if [ -d "$migrations_dir" ]; then
        echo "  Migration dirs:"
        find "$migrations_dir" -type d -name "Tenant" | while read tenant_dir; do
            echo "    - $tenant_dir"
            count=$(find "$tenant_dir" -name "*.php" | wc -l)
            echo "      Files: $count"
        done
    fi
done
EOF

chmod +x check-tenant-migrations.sh
./check-tenant-migrations.sh
```

### **Step 4: Test the Fix**

```bash
# Test 1: Verify migration status
echo "=== Test 1: Migration Status ==="
php artisan migrate:status | grep -E "(members|digital_card|election)" && \
    echo "❌ FAIL: Tenant migrations still found" || \
    echo "✅ PASS: No tenant migrations found"

# Test 2: Dry run of migrate
echo -e "\n=== Test 2: Dry Run Migration ==="
php artisan migrate --pretend 2>&1 | grep -E "(members|CREATE TABLE.*members|digital_card)" && \
    echo "❌ FAIL: Would create tenant tables" || \
    echo "✅ PASS: Would not create tenant tables"

# Test 3: Test context install
echo -e "\n=== Test 3: Context Install (Dry Run) ==="
php artisan context:install Membership --tenant=nrna --dry-run && \
    echo "✅ PASS: Context install works" || \
    echo "❌ FAIL: Context install failed"

# Test 4: Check migration paths
echo -e "\n=== Test 4: Migration Paths ==="
php artisan tinker --execute="
\$migrator = app('migrator');
\$hasTenantPaths = false;
foreach (\$migrator->paths() as \$path) {
    if (strpos(\$path, 'Tenant') !== false) {
        echo '❌ Found Tenant path: ' . \$path . '\\n';
        \$hasTenantPaths = true;
    }
}
echo \$hasTenantPaths ? 'FAIL: Tenant paths still present' : '✅ PASS: No Tenant paths';
"
```

---

## **🚨 Emergency Fix Script**

If you need to fix this quickly in production:

```bash
# emergency-fix-tenant-migrations.sh
#!/bin/bash

echo "🚨 Emergency Fix for Tenant Migration Issue"
echo "=========================================="

# 1. Stop any running migrations
echo "1. Stopping any active migrations..."
php artisan migrate:status

# 2. Backup current migration table
echo -e "\n2. Backing up migration table..."
BACKUP_FILE="migrations_backup_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -u root -p landlord migrations > "$BACKUP_FILE"
echo "Backup saved to: $BACKUP_FILE"

# 3. Fix Service Providers
echo -e "\n3. Fixing Service Providers..."
for provider in $(grep -l "loadMigrationsFrom.*Tenant" app/Contexts/*/Infrastructure/Providers/*.php 2>/dev/null); do
    echo "Fixing: $provider"
    sed -i.bak 's/loadMigrationsFrom.*Tenant.*/\/\/ \0  # REMOVED: Tenant migrations should not be loaded globally/' "$provider"
done

# 4. Clear migration cache
echo -e "\n4. Clearing migration cache..."
php artisan cache:clear
php artisan config:clear

# 5. Remove tenant migrations from table
echo -e "\n5. Cleaning migration table..."
php artisan tinker --execute="
use Illuminate\\Support\\Facades\\DB;

\$patterns = ['%members%', '%digital_card%', '%election%'];
foreach (\$patterns as \$pattern) {
    \$count = DB::connection('landlord')
        ->table('migrations')
        ->where('migration', 'like', \$pattern)
        ->count();
    
    if (\$count > 0) {
        echo 'Removing ' . \$count . ' migrations matching: ' . \$pattern . '\\n';
        DB::connection('landlord')
            ->table('migrations')
            ->where('migration', 'like', \$pattern)
            ->delete();
    }
}
"

# 6. Verify fix
echo -e "\n6. Verifying fix..."
php artisan migrate:status | grep -E "(members|digital_card|election)" || echo "✅ Fix successful!"

echo -e "\n🚀 Done! Run 'php artisan migrate --database=landlord' to continue."
```

---

## **📊 Post-Fix Verification Matrix**

| Test | Command | Expected Result | Actual Result |
|------|---------|----------------|---------------|
| 1 | `php artisan migrate:status` | No tenant migrations | |
| 2 | `php artisan migrate --pretend` | No CREATE TABLE for tenant tables | |
| 3 | `php artisan context:install Membership --dry-run` | Shows tenant migrations would install | |
| 4 | Check Service Providers | No `loadMigrationsFrom` for Tenant paths | |
| 5 | Check migration paths | No Tenant paths in migration discovery | |

---

## **🔮 Prevention Measures**

### **1. Add Safety Check to Migration Files**

Add this to the beginning of ALL tenant migration files:

```php
// app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/2026_01_02_140853_create_members_table.php

public function up()
{
    // SAFETY CHECK: Prevent running via standard migrate command
    $argv = $_SERVER['argv'] ?? [];
    $command = implode(' ', $argv);
    
    if (!str_contains($command, 'context:install')) {
        throw new \RuntimeException(
            'This migration should ONLY run via Platform Context installer. ' .
            'Use: php artisan context:install Membership --tenant={slug}'
        );
    }
    
    // Rest of migration...
}
```

### **2. Create Custom Migration Command**

```php
// app/Console/Commands/MigrateSafe.php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class MigrateSafe extends Command
{
    protected $signature = 'migrate:safe {--database=landlord : Database connection}';
    protected $description = 'Safe migration command that blocks tenant migrations';
    
    public function handle()
    {
        // Check for tenant migration attempts
        $migrator = app('migrator');
        $files = $migrator->getMigrationFiles($migrator->paths());
        
        $tenantMigrations = [];
        foreach ($files as $file => $path) {
            if (preg_match('/(members|digital_card|election)/i', $file)) {
                $tenantMigrations[] = $file;
            }
        }
        
        if (!empty($tenantMigrations)) {
            $this->error('❌ Tenant migrations detected!');
            $this->error('The following tenant migrations would run:');
            foreach ($tenantMigrations as $migration) {
                $this->error("  - $migration");
            }
            $this->newLine();
            $this->info('✅ Use: php artisan context:install {Module} --tenant={slug}');
            $this->info('❌ Do NOT use: php artisan migrate');
            return 1;
        }
        
        return $this->call('migrate', [
            '--database' => $this->option('database'),
        ]);
    }
}
```

### **3. Add Git Hook**

Create a pre-commit hook to prevent adding `loadMigrationsFrom` for tenant paths:

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "Checking for incorrect migration loading..."

if grep -r "loadMigrationsFrom.*Tenant" app/ --include="*.php"; then
    echo "❌ ERROR: Found loadMigrationsFrom for Tenant paths!"
    echo "Tenant migrations should NOT be loaded globally."
    echo "Remove these lines from ServiceProviders."
    exit 1
fi

echo "✅ Migration loading check passed"
exit 0
```

---

## **📝 Documentation Update**

After fixing, update your developer documentation:

### **Add to README.md:**

```markdown
## 🚨 Migration Guidelines

### **Tenant Modules (Membership, DigitalCard, Elections)**
- ❌ **NEVER** use `loadMigrationsFrom()` in ServiceProvider
- ✅ Migrations should be in `Database/Migrations/Tenant/` folder
- ✅ Install via: `php artisan context:install {Module} --tenant={slug}`
- ❌ **NEVER** install via: `php artisan migrate`

### **Landlord Contexts (Geography, ModuleRegistry)**
- ✅ **CAN** use `loadMigrationsFrom()` in ServiceProvider
- ✅ Migrations should be in `Database/Migrations/` folder
- ✅ Install via: `php artisan migrate --database=landlord`

### **Debug Command:**
```bash
# Check for incorrect migration loading
php artisan check:tenant-migrations

# Safe migration command
php artisan migrate:safe
```
```

---

## **🧪 Test Suite**

Create a test to prevent regression:

```php
// tests/Unit/MigrationDiscoveryTest.php
<?php

namespace Tests\Unit;

use Tests\TestCase;

class MigrationDiscoveryTest extends TestCase
{
    /** @test */
    public function tenant_migrations_are_not_loaded_globally()
    {
        $migrator = app('migrator');
        $files = $migrator->getMigrationFiles($migrator->paths());
        
        $tenantMigrations = array_filter(array_keys($files), function ($file) {
            return preg_match('/(members|digital_card|election)/i', $file);
        });
        
        $this->assertEmpty(
            $tenantMigrations,
            "Tenant migrations should not be globally discoverable. Found: " . 
            implode(', ', $tenantMigrations)
        );
    }
    
    /** @test */
    public function service_providers_do_not_load_tenant_migrations()
    {
        // Get all service providers
        $providers = app()->getLoadedProviders();
        
        foreach (array_keys($providers) as $provider) {
            if (!class_exists($provider)) {
                continue;
            }
            
            $reflection = new \ReflectionClass($provider);
            $file = $reflection->getFileName();
            $content = file_get_contents($file);
            
            // Check for problematic pattern
            if (strpos($content, 'loadMigrationsFrom') !== false && 
                strpos($content, 'Tenant') !== false) {
                $this->fail("ServiceProvider $provider incorrectly loads tenant migrations");
            }
        }
        
        $this->assertTrue(true);
    }
}
```

---

## **🎯 Summary**

**Problem**: Tenant migrations being loaded globally via `loadMigrationsFrom()` in ServiceProviders.

**Solution**: 
1. Remove/comment out `loadMigrationsFrom()` calls for tenant migration paths
2. Clean up migration table entries
3. Use `context:install` for tenant modules
4. Add prevention measures

**Verification**: 
- `php artisan migrate:status` shows no tenant migrations
- `php artisan context:install` works correctly
- ServiceProviders don't load tenant migrations

**Prevention**: 
- Custom migration command
- Git hooks
- Unit tests
- Clear documentation

This ensures your DDD architecture remains intact: tenant modules are installed **on-demand**, not automatically via Laravel's migration system.