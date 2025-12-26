Looking at your PostgreSQL multi-tenancy provisioning issue, let's troubleshoot this step by step. The key difference between MySQL and PostgreSQL is often in permissions and connection handling.

## Step 1: Check PostgreSQL Connection and Permissions

First, verify your main PostgreSQL connection works and the user has CREATE DATABASE privileges:

```php
// Test this in tinker or create a quick route to check
Route::get('/test-db-connection', function() {
    $driver = config('database.default');
    $host = config('database.connections.pgsql.host');
    $port = config('database.connections.pgsql.port');
    $username = config('database.connections.pgsql.username');
    $database = config('database.connections.pgsql.database');
    
    try {
        // Test main connection
        DB::connection('pgsql')->getPdo();
        
        // Check if user has create database privileges
        $canCreateDb = DB::select("
            SELECT 1 
            FROM pg_roles 
            WHERE rolname = ? 
            AND rolcreatedb = true
        ", [$username]);
        
        return response()->json([
            'success' => true,
            'driver' => $driver,
            'host' => $host,
            'port' => $port,
            'username' => $username,
            'database' => $database,
            'has_create_db_privilege' => !empty($canCreateDb),
            'connection_status' => 'OK'
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
            'connection_details' => compact('driver', 'host', 'port', 'username', 'database')
        ], 500);
    }
});
```

## Step 2: Debug the Provisioning Process

Add more detailed logging to identify where it fails:

```php
private function createTenantDatabase(Tenant $tenant): void
{
    $databaseName = $tenant->database_name;
    $driver = config('database.default');
    
    Log::info('=== CREATE TENANT DATABASE DEBUG ===', [
        'tenant_id' => $tenant->id,
        'database_name' => $databaseName,
        'driver' => $driver,
        'env' => app()->environment(),
        'db_host' => env('DB_HOST'),
        'db_port' => env('DB_PORT'),
        'db_username' => env('DB_USERNAME'),
        'db_database' => env('DB_DATABASE'),
    ]);
    
    try {
        // For PostgreSQL, we need to use the postgres database for admin operations
        $originalConfig = config('database.connections.pgsql');
        
        if ($driver === 'pgsql') {
            // Switch to postgres database to create new database
            config(['database.connections.pgsql.database' => 'postgres']);
            DB::purge('pgsql');
            
            // Check if database exists
            $exists = DB::select("SELECT 1 FROM pg_database WHERE datname = ?", [$databaseName]);
            
            Log::info('PostgreSQL database check', [
                'database_name' => $databaseName,
                'exists' => !empty($exists),
                'connection_used' => DB::connection()->getDatabaseName()
            ]);
            
            if (empty($exists)) {
                // Create database with UTF8 encoding
                DB::statement("CREATE DATABASE \"{$databaseName}\" ENCODING 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8' TEMPLATE template0");
                
                Log::info('PostgreSQL database created', ['database' => $databaseName]);
                
                // Switch back to original database
                config(['database.connections.pgsql.database' => $originalConfig['database']]);
                DB::purge('pgsql');
                
                // Create dedicated user for this database
                $this->createPostgreSQLDatabaseUser($tenant);
                
            } else {
                Log::info('Tenant database already exists', ['database' => $databaseName]);
                
                // Switch back anyway
                config(['database.connections.pgsql.database' => $originalConfig['database']]);
                DB::purge('pgsql');
            }
            
        } else {
            // MySQL logic...
        }
        
    } catch (\Exception $e) {
        Log::error('Failed to create tenant database', [
            'database' => $databaseName,
            'driver' => $driver,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        // Restore original config on error
        if ($driver === 'pgsql') {
            config(['database.connections.pgsql.database' => $originalConfig['database']]);
            DB::purge('pgsql');
        }
        
        throw $e;
    }
}
```

## Step 3: Fix PostgreSQL User Creation

Update the `createPostgreSQLDatabaseUser` method:

```php
private function createPostgreSQLDatabaseUser(Tenant $tenant): void
{
    $username = "tenant_{$tenant->slug}_user";
    $password = \Str::random(32);
    $databaseName = $tenant->database_name;

    try {
        Log::info('Creating PostgreSQL user', [
            'username' => $username,
            'database' => $databaseName,
            'current_db' => DB::connection()->getDatabaseName()
        ]);

        // Use postgres database for user creation
        $originalConfig = config('database.connections.pgsql');
        config(['database.connections.pgsql.database' => 'postgres']);
        DB::purge('pgsql');

        // Check if user exists
        $userExists = DB::select("SELECT 1 FROM pg_roles WHERE rolname = ?", [$username]);
        
        if (!empty($userExists)) {
            Log::info('PostgreSQL user exists, dropping...', ['username' => $username]);
            
            // First, revoke all privileges
            DB::statement("REVOKE ALL PRIVILEGES ON DATABASE \"{$databaseName}\" FROM \"{$username}\"");
            
            // Drop owned objects if any
            DB::statement("DROP OWNED BY \"{$username}\" CASCADE");
            
            // Drop the user
            DB::statement("DROP USER IF EXISTS \"{$username}\"");
        }

        // Create PostgreSQL user with login privilege
        DB::statement("CREATE USER \"{$username}\" WITH LOGIN PASSWORD '{$password}'");
        
        // Grant connect privilege to the database
        DB::statement("GRANT CONNECT ON DATABASE \"{$databaseName}\" TO \"{$username}\"");
        
        // Switch to the tenant database to grant schema privileges
        config(['database.connections.pgsql.database' => $databaseName]);
        DB::purge('pgsql');
        
        // Grant all privileges on all tables in the public schema
        DB::statement("GRANT ALL PRIVILEGES ON SCHEMA public TO \"{$username}\"");
        DB::statement("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"{$username}\"");
        DB::statement("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"{$username}\"");
        DB::statement("GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO \"{$username}\"");
        
        // Set default privileges for future objects
        DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"{$username}\"");
        DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"{$username}\"");
        DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO \"{$username}\"");

        // Switch back to original database
        config(['database.connections.pgsql.database' => $originalConfig['database']]);
        DB::purge('pgsql');

        $this->storeDatabaseCredentials($tenant, $username, $password, 'pgsql');

        Log::info('PostgreSQL database user created successfully', [
            'tenant_id' => $tenant->id,
            'username' => $username,
            'database' => $databaseName,
        ]);

    } catch (Exception $e) {
        Log::error('Failed to create PostgreSQL database user', [
            'tenant_id' => $tenant->id,
            'username' => $username,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        // Restore original config
        if (isset($originalConfig)) {
            config(['database.connections.pgsql.database' => $originalConfig['database']]);
            DB::purge('pgsql');
        }

        $this->createFallbackDatabaseRecord($tenant);
        Log::warning('Continuing provisioning with fallback database credentials');
    }
}
```

## Step 4: Check PostgreSQL Configuration

Create a test script to verify all PostgreSQL settings:

```php
// routes/web.php - temporary test route
Route::get('/test-pgsql-setup', function() {
    $tests = [];
    
    // Test 1: Basic connection
    try {
        DB::connection('pgsql')->getPdo();
        $tests['basic_connection'] = 'PASS';
    } catch (\Exception $e) {
        $tests['basic_connection'] = 'FAIL: ' . $e->getMessage();
    }
    
    // Test 2: Create database permission
    try {
        $result = DB::select("SELECT rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = ?", 
            [config('database.connections.pgsql.username')]);
        
        if ($result) {
            $tests['create_db_permission'] = $result[0]->rolcreatedb ? 'YES' : 'NO';
            $tests['create_role_permission'] = $result[0]->rolcreaterole ? 'YES' : 'NO';
        }
    } catch (\Exception $e) {
        $tests['permission_check'] = 'FAIL: ' . $e->getMessage();
    }
    
    // Test 3: Try to create a test database
    $testDbName = 'test_provision_' . time();
    try {
        DB::statement("CREATE DATABASE \"{$testDbName}\"");
        $tests['create_database'] = 'PASS';
        
        // Clean up
        DB::statement("DROP DATABASE \"{$testDbName}\"");
    } catch (\Exception $e) {
        $tests['create_database'] = 'FAIL: ' . $e->getMessage();
    }
    
    // Test 4: Check current database connections
    try {
        $connections = DB::select("SELECT datname, numbackends FROM pg_stat_database");
        $tests['current_connections'] = $connections;
    } catch (\Exception $e) {
        $tests['connections_check'] = 'FAIL: ' . $e->getMessage();
    }
    
    return response()->json($tests);
});
```

## Step 5: Check Job Processing

Since you mentioned "provisioning Jobs are not started", check your queue worker:

```bash
# Check if queue worker is running
php artisan queue:work --tries=3 --timeout=300

# Or check failed jobs
php artisan queue:failed

# Test if jobs are being dispatched
php artisan tinker
>>> \App\Models\TenantApplication::first()->provision();
```

## Step 6: Verify Environment Configuration

Check your `.env` file for PostgreSQL settings:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=landlord
DB_USERNAME=postgres
DB_PASSWORD=your_password

# Queue configuration
QUEUE_CONNECTION=database  # or redis
```

## Step 7: Common PostgreSQL Issues

1. **Missing pgcrypto extension** (for UUIDs):
```sql
-- Connect to your landlord database
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

2. **Permission issues** - The PostgreSQL user needs:
```sql
-- Run as superuser (postgres)
ALTER USER your_username CREATEDB CREATEROLE;
```

3. **Template database issues** - Make sure template0 is available:
```sql
SELECT datname FROM pg_database WHERE datistemplate = true;
```

## Step 8: Immediate Debug Steps

Run these commands in order:

```bash
# 1. Clear caches
php artisan config:clear
php artisan cache:clear

# 2. Check logs
tail -f storage/logs/laravel.log

# 3. Test database connection
php artisan tinker
>>> DB::connection('pgsql')->getPdo()

# 4. Manually test database creation
>>> DB::statement("CREATE DATABASE test_tenant_123")
```

## Step 9: Update Database Configuration

Add PostgreSQL-specific configuration to `config/database.php`:

```php
'connections' => [
    'pgsql' => [
        'driver' => 'pgsql',
        'url' => env('DATABASE_URL'),
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '5432'),
        'database' => env('DB_DATABASE', 'forge'),
        'username' => env('DB_USERNAME', 'forge'),
        'password' => env('DB_PASSWORD', ''),
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => 'public',
        'sslmode' => 'prefer',
        'schema' => 'public',
        // Add these for better performance
        'options' => [
            PDO::ATTR_PERSISTENT => false,
            PDO::ATTR_EMULATE_PREPARES => true,
        ],
    ],
],
```

## Next Steps:

1. **Run the test routes** I provided to identify where it fails
2. **Check Laravel logs** for detailed error messages
3. **Verify PostgreSQL user permissions** 
4. **Ensure queue worker is running** if using jobs

The most common issues when switching from MySQL to PostgreSQL are:
- Missing CREATE DATABASE permission
- Connection pool issues (PostgreSQL has connection limits)
- Schema/namespace confusion (PostgreSQL uses schemas, not databases like MySQL)
- Different SQL syntax for user/database management

Share the error logs or test results, and I'll help you fix the specific issue.