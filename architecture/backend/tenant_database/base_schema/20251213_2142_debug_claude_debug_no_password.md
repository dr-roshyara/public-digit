**Ah!** Now we see the real issue! The table `tenant_users` doesn't exist in the new tenant database `tenant_nc`. This means:

## The Problem
1. ✅ New tenant database `tenant_nc` was created
2. ❌ **Migrations were NOT run** on this database
3. ❌ `tenant_users` table doesn't exist
4. ❌ Password setup fails

## Root Cause
The `runTenantMigrations()` method we fixed earlier might not have executed, or there's another issue.

## Let's Check

### Step 1: Check What's in `tenant_nc`
```bash
mysql -u root -p << 'EOF'
-- Check if database exists
SHOW DATABASES LIKE 'tenant_nc';

-- Check tables in tenant_nc
USE tenant_nc;
SHOW TABLES;
EOF
```

### Step 2: Check if Migrations Table Exists
```bash
mysql -u root -p -e "USE tenant_nc; SHOW TABLES LIKE 'migrations';"
```

### Step 3: Run Migrations Manually
```bash
# Run migrations on tenant_nc
cd packages/laravel-backend

# First, check current connection config
php artisan tinker
```

```php
// In Tinker - Run migrations on tenant_nc
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

// Set tenant database
config(['database.connections.tenant.database' => 'tenant_nc']);
DB::purge('tenant');

// Check current tables
try {
    $tables = DB::connection('tenant')->select('SHOW TABLES');
    echo "Current tables in tenant_nc:\n";
    foreach ($tables as $table) {
        $tableKey = "Tables_in_tenant_nc";
        echo "- " . $table->$tableKey . "\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

// Run migrations
echo "\nRunning migrations...\n";
Artisan::call('migrate', [
    '--database' => 'tenant',
    '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
    '--force' => true,
]);

echo Artisan::output();
```

### Step 4: Create Admin User for `tenant_nc`

After migrations run, create the admin user:

```php
// Create admin user for tenant_nc
$adminEmail = 'krish.hari.sharma@gmail.com';
$initialPassword = 'Start1234!';

// Check if user exists
$userExists = DB::connection('tenant')
    ->table('tenant_users')
    ->where('email', $adminEmail)
    ->exists();

if (!$userExists) {
    echo "\nCreating admin user...\n";
    
    DB::connection('tenant')->table('tenant_users')->insert([
        'email' => $adminEmail,
        'first_name' => 'Krish',
        'last_name' => 'Hari Sharma',
        'uuid' => \Illuminate\Support\Str::uuid(),
        'password_hash' => \Illuminate\Support\Facades\Hash::make($initialPassword),
        'status' => 'active',
        'email_verified_at' => now(),
        'must_change_password' => 1,
        'tenant_id' => 1, // Adjust based on your tenant_id
        'metadata' => json_encode(['is_initial_admin' => true]),
        'created_at' => now(),
        'updated_at' => now(),
        // Add all other required columns
    ]);
    
    echo "✅ Admin user created!\n";
} else {
    echo "✅ Admin user already exists\n";
}
```

## But Wait - There's a Bigger Issue

If `tenant_nc` doesn't have `tenant_users` table, then **the provisioning process is broken**. The `runTenantMigrations()` method we fixed might not be executing.

Let me check:

### Check Provisioning Logs
```bash
# Check recent logs for provisioning
tail -100 storage/logs/laravel.log | grep -i "tenant.*migration\|provisioning\|tenant_nc"
```

### Debug Provisioning Flow
The error suggests that when you try to set password, it connects to `tenant_nc` but the table doesn't exist. This means:

1. **Either**: Migrations never ran during provisioning
2. **Or**: The provisioning service is skipping migration execution

## Quick Fix Script

Let me create a complete fix script:

```bash
cat > fix_tenant_nc.sh << 'EOF'
#!/bin/bash

echo "🔧 COMPLETE FIX FOR TENANT_NC"
echo "=============================="

# 1. Check database
echo ""
echo "1. Checking tenant_nc database..."
mysql -u root -p << 'MYSQL'
SHOW DATABASES LIKE 'tenant_nc';
USE tenant_nc;
SHOW TABLES;
MYSQL

# 2. Run migrations via Artisan
echo ""
echo "2. Running migrations..."
cd packages/laravel-backend

cat > fix_migrations.php << 'PHP'
<?php
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

echo "Running migrations on tenant_nc...\n";

config(['database.connections.tenant.database' => 'tenant_nc']);
DB::purge('tenant');

Artisan::call('migrate', [
    '--database' => 'tenant',
    '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
    '--force' => true,
]);

echo Artisan::output();

// Check result
$tables = DB::connection('tenant')->select('SHOW TABLES');
echo "Tables after migrations:\n";
foreach ($tables as $table) {
    $tableKey = "Tables_in_tenant_nc";
    echo "- " . $table->$tableKey . "\n";
}
?>
PHP

php artisan tinker < fix_migrations.php
rm fix_migrations.php

# 3. Create admin user
echo ""
echo "3. Creating admin user..."
cat > create_admin.php << 'PHP'
<?php
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

config(['database.connections.tenant.database' => 'tenant_nc']);
DB::purge('tenant');

$adminEmail = 'krish.hari.sharma@gmail.com';
$initialPassword = 'Start1234!';

// Check if exists
$exists = DB::connection('tenant')
    ->table('tenant_users')
    ->where('email', $adminEmail)
    ->exists();

if ($exists) {
    echo "Admin user already exists\n";
    
    // Update with password if needed
    $user = DB::connection('tenant')
        ->table('tenant_users')
        ->where('email', $adminEmail)
        ->first();
    
    if (empty($user->password_hash)) {
        echo "Setting initial password...\n";
        DB::connection('tenant')
            ->table('tenant_users')
            ->where('id', $user->id)
            ->update([
                'password_hash' => Hash::make($initialPassword),
                'status' => 'active',
                'email_verified_at' => now(),
                'must_change_password' => 1,
            ]);
    }
    
} else {
    echo "Creating admin user...\n";
    
    DB::connection('tenant')->table('tenant_users')->insert([
        'email' => $adminEmail,
        'first_name' => 'Krish',
        'last_name' => 'Hari Sharma',
        'uuid' => Str::uuid(),
        'password_hash' => Hash::make($initialPassword),
        'status' => 'active',
        'email_verified_at' => now(),
        'must_change_password' => 1,
        'tenant_id' => 1,
        'metadata' => json_encode(['is_initial_admin' => true]),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    
    echo "✅ Admin user created\n";
}

echo "\nLogin credentials:\n";
echo "Email: {$adminEmail}\n";
echo "Password: {$initialPassword}\n";
?> 
PHP

php artisan tinker < create_admin.php
rm create_admin.php

echo ""
echo "✅ Fix complete! Try password setup again."
EOF

chmod +x fix_tenant_nc.sh
./fix_tenant_nc.sh
```

## The Real Issue

The fact that `tenant_nc` doesn't have `tenant_users` table means **migrations didn't run during provisioning**. We need to:

1. **Fix the immediate issue**: Run migrations on `tenant_nc` manually
2. **Fix the root cause**: Debug why `runTenantMigrations()` isn't working

## Let's Debug the Provisioning

Check if our fix to `runTenantMigrations()` is actually being called:

```bash
# Check the provisioning service logs
grep -n "runTenantMigrations\|Running tenant database migrations" packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/TenantProvisioningService.php
```

**Run the fix script first**, then we need to fix the provisioning flow so new tenants get migrations automatically!