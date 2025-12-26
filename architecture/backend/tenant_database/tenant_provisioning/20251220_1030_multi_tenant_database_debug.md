Now I understand your sophisticated tenant provisioning system! Let me analyze the PostgreSQL issue systematically. The problem is likely in the **database creation permissions** or **queue processing**.

## Step 1: Identify the Exact Failure Point

Let's first check where the process is breaking. Add this debug route:

```php
// Add to routes/web.php or a debug route file
Route::get('/debug-provisioning/{applicationId}', function($applicationId) {
    try {
        // 1. Check if application exists
        $application = DB::table('tenant_applications')->where('id', $applicationId)->first();
        if (!$application) {
            return response()->json(['error' => 'Application not found'], 404);
        }

        // 2. Check if tenant record was created
        $tenant = DB::table('tenants')->where('email', $application->contact_email)->first();
        
        // 3. Check if job is queued
        $jobs = DB::table('jobs')->where('queue', 'tenant-provisioning')->count();
        $failedJobs = DB::table('failed_jobs')->count();

        // 4. Check PostgreSQL permissions
        $canCreateDb = false;
        try {
            $result = DB::select("SELECT rolcreatedb FROM pg_roles WHERE rolname = ?", 
                [config('database.connections.pgsql.username')]);
            $canCreateDb = $result[0]->rolcreatedb ?? false;
        } catch (\Exception $e) {
            $canCreateDb = 'Error: ' . $e->getMessage();
        }

        return response()->json([
            'application' => [
                'id' => $application->id,
                'status' => $application->status,
                'slug' => $application->requested_slug,
                'contact_email' => $application->contact_email,
                'created_at' => $application->created_at,
            ],
            'tenant_record' => $tenant ? [
                'id' => $tenant->id,
                'database_name' => $tenant->database_name,
                'status' => $tenant->status,
            ] : null,
            'queue_status' => [
                'pending_jobs' => $jobs,
                'failed_jobs' => $failedJobs,
                'queue_connection' => config('queue.default'),
            ],
            'postgresql_permissions' => [
                'username' => config('database.connections.pgsql.username'),
                'can_create_database' => $canCreateDb,
                'host' => config('database.connections.pgsql.host'),
            ],
            'provisioning_status' => $tenant ? 'Tenant record exists' : 'No tenant record',
            'next_step' => $application->status === 'approved' 
                ? 'Should be processed by ProvisionTenantJob' 
                : 'Needs approval first'
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
})->name('debug.provisioning');
```

## Step 2: Fix PostgreSQL Database Creation

Your main issue is likely that **PostgreSQL requires different permissions and connection handling**. Update your `createTenantDatabase` method:

```php
private function createTenantDatabase(Tenant $tenant): void
{
    $databaseName = $tenant->database_name;
    $driver = config('database.default');
    
    Log::info('=== CREATE TENANT DATABASE ===', [
        'tenant_id' => $tenant->id,
        'database_name' => $databaseName,
        'driver' => $driver,
        'username' => config('database.connections.pgsql.username'),
        'host' => config('database.connections.pgsql.host')
    ]);
    
    try {
        if ($driver === 'pgsql') {
            // CRITICAL: For PostgreSQL, we must use a different approach
            
            // 1. Store original connection
            $originalConnection = config('database.connections.pgsql');
            
            // 2. Connect to 'postgres' database to create new database
            config([
                'database.connections.pgsql.database' => 'postgres',
                'database.connections.pgsql.username' => env('DB_USERNAME', 'postgres'),
                'database.connections.pgsql.password' => env('DB_PASSWORD', '')
            ]);
            
            DB::purge('pgsql');
            DB::reconnect('pgsql');
            
            // 3. Check if database already exists
            $exists = DB::select("SELECT 1 FROM pg_database WHERE datname = ?", [$databaseName]);
            
            if (empty($exists)) {
                // 4. Create the database with UTF8 encoding
                $query = sprintf(
                    "CREATE DATABASE \"%s\" WITH ENCODING 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8' TEMPLATE template0",
                    $databaseName
                );
                
                DB::statement($query);
                
                Log::info('PostgreSQL database created successfully', [
                    'database' => $databaseName,
                    'query' => $query
                ]);
            } else {
                Log::warning('PostgreSQL database already exists', ['database' => $databaseName]);
            }
            
            // 5. Restore original connection
            config(['database.connections.pgsql' => $originalConnection]);
            DB::purge('pgsql');
            DB::reconnect('pgsql');
            
            // 6. Grant permissions to application user
            $this->grantPostgreSQLPermissions($tenant);
            
        } elseif ($driver === 'mysql') {
            // Original MySQL logic
            DB::statement("CREATE DATABASE IF NOT EXISTS `{$databaseName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }
        
    } catch (\Exception $e) {
        Log::error('Failed to create tenant database', [
            'database' => $databaseName,
            'driver' => $driver,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        throw new \Exception("Database creation failed: " . $e->getMessage());
    }
}
```

## Step 3: Fix PostgreSQL Permissions Granting

Add this method to handle PostgreSQL permissions:

```php
private function grantPostgreSQLPermissions(Tenant $tenant): void
{
    try {
        $databaseName = $tenant->database_name;
        $appUsername = config('database.connections.pgsql.username');
        
        Log::info('Granting PostgreSQL permissions', [
            'database' => $databaseName,
            'username' => $appUsername
        ]);
        
        // Switch to the new database to grant permissions
        $originalConfig = config('database.connections.pgsql');
        config(['database.connections.pgsql.database' => $databaseName]);
        DB::purge('pgsql');
        DB::reconnect('pgsql');
        
        // Grant all privileges to the application user
        DB::statement("GRANT ALL PRIVILEGES ON DATABASE \"{$databaseName}\" TO \"{$appUsername}\"");
        DB::statement("GRANT ALL ON SCHEMA public TO \"{$appUsername}\"");
        
        // For existing tables (if any)
        DB::statement("GRANT ALL ON ALL TABLES IN SCHEMA public TO \"{$appUsername}\"");
        DB::statement("GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO \"{$appUsername}\"");
        DB::statement("GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO \"{$appUsername}\"");
        
        // For future tables
        DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"{$appUsername}\"");
        DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"{$appUsername}\"");
        DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO \"{$appUsername}\"");
        
        Log::info('PostgreSQL permissions granted successfully');
        
        // Restore original connection
        config(['database.connections.pgsql' => $originalConfig]);
        DB::purge('pgsql');
        DB::reconnect('pgsql');
        
    } catch (\Exception $e) {
        Log::error('Failed to grant PostgreSQL permissions', [
            'error' => $e->getMessage(),
            'database' => $databaseName ?? 'unknown'
        ]);
        
        // Continue anyway - some permissions might still work
    }
}
```

## Step 4: Ensure Queue is Processing

Check your queue configuration. Create a test route to verify:

```php
Route::get('/test-queue', function() {
    // Test if queue is working
    $jobId = \App\Contexts\Platform\Application\Jobs\TestQueueJob::dispatch();
    
    return response()->json([
        'message' => 'Test job dispatched',
        'job_id' => $jobId,
        'queue_connection' => config('queue.default'),
        'queue_driver' => config('queue.connections.' . config('queue.default') . '.driver'),
        'tenant_provisioning_queue' => 'tenant-provisioning'
    ]);
});

// Create a test job
namespace App\Contexts\Platform\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class TestQueueJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public $queue = 'tenant-provisioning';
    
    public function handle()
    {
        Log::info('TestQueueJob executed successfully at ' . now());
        
        return true;
    }
}
```

## Step 5: Update the ProvisionTenantJob

Make sure the job handles PostgreSQL correctly:

```php
// In ProvisionTenantJob.php
public function handle(TenantProvisioningService $provisioningService): void
{
    Log::info('=== PROVISION TENANT JOB STARTED ===', [
        'application_id' => $this->application->getId(),
        'slug' => $this->application->getRequestedSlug(),
        'queue' => $this->queue,
        'driver' => config('database.default'),
        'memory_usage' => memory_get_usage(true) / 1024 / 1024 . ' MB'
    ]);
    
    try {
        // 1. Check PostgreSQL connection
        $driver = config('database.default');
        if ($driver === 'pgsql') {
            try {
                DB::connection('pgsql')->getPdo();
                Log::info('PostgreSQL connection OK');
            } catch (\Exception $e) {
                Log::error('PostgreSQL connection failed', [
                    'error' => $e->getMessage(),
                    'config' => config('database.connections.pgsql')
                ]);
                throw $e;
            }
        }
        
        // 2. Prepare tenant data
        $tenantData = [
            'organization_name' => $this->application->getOrganizationName(),
            'slug' => $this->application->getRequestedSlug(),
            'admin_email' => $this->application->getContactEmail()->toString(),
            'admin_name' => $this->application->getContactName(),
            'organization_type' => $this->application->getOrganizationType()->toString(),
            'provisioned_by' => $this->adminId
        ];
        
        // 3. Execute provisioning
        Log::info('Calling provisionTenant service');
        $tenant = $provisioningService->provisionTenant($tenantData);
        
        // 4. Update application
        $this->application->completeProvisioning($tenant->id);
        $this->applicationRepository->save($this->application);
        
        Log::info('=== PROVISION TENANT JOB COMPLETED ===', [
            'tenant_id' => $tenant->id,
            'database_name' => $tenant->database_name,
            'duration' => round(microtime(true) - LARAVEL_START, 2) . ' seconds'
        ]);
        
    } catch (\Exception $e) {
        Log::error('=== PROVISION TENANT JOB FAILED ===', [
            'application_id' => $this->application->getId(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'driver' => config('database.default')
        ]);
        
        $this->application->markProvisioningFailed($e->getMessage());
        $this->applicationRepository->save($this->application);
        
        // Also log to failed_jobs table
        throw $e;
    }
}
```

## Step 6: Check and Fix PostgreSQL User Permissions

Run these SQL commands as PostgreSQL superuser:

```sql
-- 1. Check current user permissions
SELECT rolname, rolcreatedb, rolcreaterole, rolsuper 
FROM pg_roles 
WHERE rolname = 'your_app_username';

-- 2. Grant necessary permissions if missing
ALTER USER your_app_username CREATEDB CREATEROLE;

-- 3. Check if you can connect to postgres database
\c postgres

-- 4. Test creating a database
CREATE DATABASE test_tenant_provisioning;
DROP DATABASE test_tenant_provisioning;
```

## Step 7: Manual Provisioning Test

Create a route to manually trigger provisioning (for debugging):

```php
Route::get('/manual-provision/{slug}', function($slug) {
    try {
        $provisioningService = app('tenant.provisioning');
        
        $tenantData = [
            'organization_name' => 'Test Organization ' . time(),
            'slug' => $slug,
            'admin_email' => 'test@example.com',
            'admin_name' => 'Test Admin',
            'organization_type' => 'non_profit',
            'provisioned_by' => '1'
        ];
        
        Log::info('Manual provisioning started', $tenantData);
        
        $tenant = $provisioningService->provisionTenant($tenantData);
        
        return response()->json([
            'success' => true,
            'tenant' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
                'database_name' => $tenant->database_name,
                'status' => $tenant->status
            ],
            'database_driver' => config('database.default')
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
});
```

## Step 8: Verify Your PostgreSQL Configuration

Check your `.env` file:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=landlord
DB_USERNAME=postgres  # This user MUST have CREATEDB privilege
DB_PASSWORD=your_password

# For queue processing
QUEUE_CONNECTION=database  # Make sure this is 'database' or 'redis'
```

## Immediate Action Plan:

1. **First, run the debug route** to see where it's failing:
   ```
   http://localhost:8000/debug-provisioning/66be5042-c8e1-4cc4-86f9-6aec87345514
   ```

2. **Check PostgreSQL permissions**:
   ```bash
   sudo -u postgres psql -c "SELECT rolname, rolcreatedb FROM pg_roles WHERE rolname = 'YOUR_DB_USERNAME';"
   ```

3. **Start queue worker**:
   ```bash
   php artisan queue:work --queue=tenant-provisioning --tries=3 --timeout=300
   ```

4. **Check logs in real-time**:
   ```bash
   tail -f storage/logs/laravel.log | grep -i "provisioning\|postgresql\|queue\|tenant_"
   ```

## Most Likely Issues:

1. **PostgreSQL user lacks CREATEDB privilege** - Fix with: `ALTER USER username CREATEDB;`
2. **Queue worker not running** - Start with: `php artisan queue:work`
3. **Connection to 'postgres' database failing** - Need to connect to 'postgres' DB to create new DBs
4. **Permission issues with template0** - PostgreSQL needs template0 for UTF8 databases

**Run the debug route first and share the output** - that will tell us exactly where the process is breaking.