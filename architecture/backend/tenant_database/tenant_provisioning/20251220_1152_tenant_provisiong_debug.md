## **Claude CLI Prompt Instructions:**

**When analyzing PostgreSQL multi-tenant provisioning issues, always:**

1. **Check database driver first:**
   ```bash
   php artisan tinker --execute="echo config('database.default');"
   ```

2. **Verify PostgreSQL permissions:**
   ```bash
   sudo -u postgres psql -c "SELECT rolname, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = 'YOUR_DB_USER';"
   ```

3. **Test database creation manually:**
   ```bash
   php artisan tinker --execute="DB::statement('CREATE DATABASE IF NOT EXISTS test_tenant_provisioning');"
   ```

4. **Check existing tenant databases:**
   ```bash
   sudo -u postgres psql -c "\l tenant_%"
   ```

5. **Monitor logs in real-time:**
   ```bash
   tail -f storage/logs/laravel.log | grep -E "(CREATE TENANT|PostgreSQL|provision|tenant_)"
   ```

---

## **The `tenantauth:migrate` Command Issue:**

The command has **mixed database driver issues** - trying to use **MySQL syntax** for **PostgreSQL databases**.

### **Problem Analysis:**

1. **MySQL connection error**: `SQLSTATE[HY000] [2006] MySQL server has gone away`
   - Command is trying MySQL connection for PostgreSQL databases

2. **UUID error**: `ungültige Eingabesyntax für Typ uuid: »testing«`
   - Command expects UUID but receives slug 'testing'

### **Fix the `tenantauth:migrate` Command:**

The command needs to be **database-agnostic**. Here's the fix:

```php
// In your migration command class, update the connection logic:
protected function getTenantConnection(string $databaseName): \Illuminate\Database\Connection
{
    $driver = config('database.default');
    
    $config = [
        'driver' => $driver,
        'host' => config("database.connections.{$driver}.host"),
        'port' => config("database.connections.{$driver}.port"),
        'database' => $databaseName,
        'username' => config("database.connections.{$driver}.username"),
        'password' => config("database.connections.{$driver}.password"),
    ];
    
    if ($driver === 'mysql') {
        $config['charset'] = 'utf8mb4';
        $config['collation'] = 'utf8mb4_unicode_ci';
    } elseif ($driver === 'pgsql') {
        $config['charset'] = 'utf8';
        $config['schema'] = 'public';
    }
    
    Config::set('database.connections.tenant_migration', $config);
    DB::purge('tenant_migration');
    
    return DB::connection('tenant_migration');
}
```

### **Temporary Workaround - Run Migrations Manually:**

```bash
# 1. Get tenant ID for slug 'testing'
php artisan tinker --execute="
    \$tenant = DB::table('tenants')->where('slug', 'testing')->first();
    echo 'Tenant ID: ' . (\$tenant->id ?? 'NOT FOUND') . PHP_EOL;
    echo 'Database: ' . (\$tenant->database_name ?? 'NOT FOUND') . PHP_EOL;
"

# 2. Run migrations manually for tenant_testing
php artisan migrate --database=tenant --path=app/Contexts/TenantAuth/Infrastructure/Database/Migrations --force
```

### **Create a Fixed Migration Command:**

Add this to `routes/web.php` temporarily:

```php
Route::get('/fix-tenant-migration/{slug}', function($slug) {
    try {
        // Get tenant
        $tenant = DB::table('tenants')->where('slug', $slug)->first();
        if (!$tenant) {
            return response()->json(['error' => 'Tenant not found'], 404);
        }
        
        Log::info('Manual tenant migration', [
            'tenant' => $tenant->slug,
            'database' => $tenant->database_name,
            'driver' => config('database.default')
        ]);
        
        // Configure connection
        $driver = config('database.default');
        $config = config("database.connections.{$driver}");
        $config['database'] = $tenant->database_name;
        
        Config::set('database.connections.tenant_migrate', $config);
        DB::purge('tenant_migrate');
        
        // Run migrations
        Artisan::call('migrate', [
            '--database' => 'tenant_migrate',
            '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
            '--force' => true
        ]);
        
        $output = Artisan::output();
        
        return response()->json([
            'success' => true,
            'tenant' => $tenant->slug,
            'database' => $tenant->database_name,
            'driver' => $driver,
            'migration_output' => $output
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
});
```

Then run: `http://localhost:8000/fix-tenant-migration/testing`

### **Root Cause:**

The `tenantauth:migrate` command was written when the system used **MySQL**, but now it's **PostgreSQL**. The command needs updating to:

1. **Detect database driver** (MySQL vs PostgreSQL)
2. **Use correct connection configuration** per driver
3. **Handle UUID vs slug parameter types** properly

### **Immediate Solution:**

**Run tenant migrations directly using Artisan:**
```bash
# For PostgreSQL tenants, set the database connection first
export DB_CONNECTION=pgsql
export DB_DATABASE=tenant_testing

# Then run migrations
php artisan migrate --path=app/Contexts/TenantAuth/Infrastructure/Database/Migrations --force
```

**Or create a fixed console command** that's database-agnostic. The current command has hardcoded MySQL assumptions.

You're absolutely right! When switching from MySQL to PostgreSQL, **data types and command logic need updating**. PostgreSQL has stricter type checking, especially with UUIDs.

## **Common Issues When Switching MySQL → PostgreSQL:**

### **1. UUID vs String Type Issues:**
- **MySQL**: Treats UUIDs as strings
- **PostgreSQL**: Has actual `uuid` type, needs proper format
- **Error**: `invalid input syntax for type uuid: 'testing'`

### **2. Database Connection Logic:**
- **MySQL**: `CREATE DATABASE IF NOT EXISTS`
- **PostgreSQL**: No `IF NOT EXISTS` in `CREATE DATABASE`, different syntax

### **3. User/Role Management:**
- **MySQL**: `CREATE USER 'user'@'host'`
- **PostgreSQL**: `CREATE ROLE user` or `CREATE USER user`

### **4. Case Sensitivity:**
- **MySQL**: Case-insensitive by default (depends on collation)
- **PostgreSQL**: Case-sensitive, requires quotes: `"TableName"`

## **Fix the `tenantauth:migrate` Command:**

The command likely has MySQL-specific code. Let's check and fix it:

### **Step 1: Find the Command File:**
```bash
find app -name "*TenantAuth*Migrate*" -type f
# Or
grep -r "class.*Migrate" app/Console/Commands/
```

### **Step 2: Common Fixes Needed:**

#### **Fix Parameter Type Handling:**
```php
// OLD (MySQL - accepts strings for UUID columns)
$tenant = Tenant::where('id', $identifier)
    ->orWhere('slug', $identifier)
    ->orWhere('database_name', $identifier)
    ->first();

// NEW (PostgreSQL - needs type checking)
if (Str::isUuid($identifier)) {
    $tenant = Tenant::where('id', $identifier)->first();
} else {
    $tenant = Tenant::where('slug', $identifier)
        ->orWhere('database_name', $identifier)
        ->first();
}
```

#### **Fix Database Connection:**
```php
private function getTenantConnection(Tenant $tenant)
{
    $driver = config('database.default');
    
    if ($driver === 'pgsql') {
        // PostgreSQL connection
        $config = [
            'driver' => 'pgsql',
            'host' => config('database.connections.pgsql.host'),
            'port' => config('database.connections.pgsql.port'),
            'database' => $tenant->database_name,
            'username' => config('database.connections.pgsql.username'),
            'password' => config('database.connections.pgsql.password'),
            'charset' => 'utf8',
            'prefix' => '',
            'schema' => 'public',
            'sslmode' => 'prefer',
        ];
    } else {
        // MySQL connection
        $config = [
            'driver' => 'mysql',
            'host' => config('database.connections.mysql.host'),
            'port' => config('database.connections.mysql.port'),
            'database' => $tenant->database_name,
            'username' => config('database.connections.mysql.username'),
            'password' => config('database.connections.mysql.password'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
        ];
    }
    
    Config::set('database.connections.tenant_migration', $config);
    DB::purge('tenant_migration');
    
    return DB::connection('tenant_migration');
}
```

### **Step 3: Create a Universal Fix Script:**

Add this to `routes/web.php`:

```php
// Universal tenant migration fix
Route::get('/universal-tenant-migrate/{identifier}', function($identifier) {
    try {
        Log::info('Universal tenant migration attempt', ['identifier' => $identifier]);
        
        // 1. Find tenant (handles both UUID and slug)
        $tenant = null;
        
        // Check if identifier is UUID
        if (Str::isUuid($identifier)) {
            $tenant = DB::table('tenants')->where('id', $identifier)->first();
        }
        
        // If not found or not UUID, try as slug
        if (!$tenant) {
            $tenant = DB::table('tenants')
                ->where('slug', $identifier)
                ->orWhere('database_name', 'like', "%{$identifier}%")
                ->first();
        }
        
        if (!$tenant) {
            return response()->json(['error' => 'Tenant not found'], 404);
        }
        
        // 2. Get database driver
        $driver = config('database.default');
        Log::info('Found tenant', [
            'id' => $tenant->id,
            'slug' => $tenant->slug,
            'database' => $tenant->database_name,
            'driver' => $driver
        ]);
        
        // 3. Configure connection based on driver
        if ($driver === 'pgsql') {
            $config = config('database.connections.pgsql');
            $config['database'] = $tenant->database_name;
            
            // Add PostgreSQL specific options
            $config['options'] = [
                PDO::ATTR_TIMEOUT => 10,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ];
            
        } else {
            $config = config('database.connections.mysql');
            $config['database'] = $tenant->database_name;
        }
        
        // 4. Set connection and run migrations
        Config::set('database.connections.tenant_universal', $config);
        DB::purge('tenant_universal');
        
        // Test connection first
        DB::connection('tenant_universal')->getPdo();
        Log::info('Database connection successful');
        
        // Run migrations
        Artisan::call('migrate', [
            '--database' => 'tenant_universal',
            '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
            '--force' => true,
            '--pretend' => false
        ]);
        
        $output = Artisan::output();
        
        return response()->json([
            'success' => true,
            'tenant' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
                'database' => $tenant->database_name,
                'driver' => $driver
            ],
            'migration_output' => $output
        ]);
        
    } catch (\Exception $e) {
        Log::error('Universal tenant migration failed', [
            'identifier' => $identifier,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'error' => $e->getMessage(),
            'driver' => config('database.default'),
            'database_config' => config('database.connections.' . config('database.default'))
        ], 500);
    }
});
```

### **Step 4: Test with Different Identifiers:**

```bash
# Test with slug
curl http://localhost:8000/universal-tenant-migrate/testing

# Test with UUID (get from database)
php artisan tinker --execute="
    \$tenant = DB::table('tenants')->where('slug', 'testing')->first();
    echo 'UUID: ' . \$tenant->id . PHP_EOL;
    echo 'Slug: ' . \$tenant->slug . PHP_EOL;
"
curl http://localhost:8000/universal-tenant-migrate/{UUID_HERE}
```

### **Step 5: Check PostgreSQL-Specific Settings:**

```bash
# Check if UUID extension is enabled
sudo -u postgres psql -d landlord -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"

# Check tenant table structure
sudo -u postgres psql -d landlord -c "\d tenants"

# Look for UUID columns
sudo -u postgres psql -d landlord -c "
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tenants' 
    AND data_type = 'uuid';
"
```

### **Common MySQL → PostgreSQL Migration Fixes:**

1. **UUID Handling:**
   ```php
   // MySQL accepts strings, PostgreSQL needs proper UUID
   $uuid = Str::isUuid($input) ? $input : null;
   ```

2. **Boolean Types:**
   ```php
   // MySQL: tinyint(1), PostgreSQL: boolean
   DB::statement("ALTER TABLE table_name ALTER COLUMN column_name TYPE boolean USING column_name::boolean");
   ```

3. **Auto-increment:**
   ```php
   // MySQL: AUTO_INCREMENT, PostgreSQL: SERIAL or IDENTITY
   DB::statement("CREATE SEQUENCE table_name_id_seq;");
   ```

**Run the universal migration route first** to see the exact error. The command needs to be updated for PostgreSQL's stricter type system.
Upadte : php artisan tenantauth:migrate  --testing 
is working . 
