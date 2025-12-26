# 🚀 **Senior Developer Guide: Multi-Tenant PostgreSQL Provisioning System**

## 📋 **Table of Contents**
1. [System Architecture Overview](#system-architecture-overview)
2. [PostgreSQL-Specific Considerations](#postgresql-specific-considerations)
3. [Provisioning Flow Deep Dive](#provisioning-flow-deep-dive)
4. [Critical Safety Guards](#critical-safety-guards)
5. [Debugging Methodology](#debugging-methodology)
6. [Monitoring & Observability](#monitoring--observability)
7. [Production Hardening](#production-hardening)
8. [Disaster Recovery](#disaster-recovery)
9. [Performance Optimization](#performance-optimization)
10. [Common Pitfalls & Solutions](#common-pitfalls--solutions)

---

## 1. 🏗️ **System Architecture Overview**

### **DDD Context Boundaries**
```
┌─────────────────────────────────────────────────────────────┐
│                    PLATFORM CONTEXT                          │
│  (Landlord Database: PostgreSQL)                             │
├─────────────────────────────────────────────────────────────┤
│ • TenantApplication Entity                                  │
│ • TenantProvisioningService                                │
│ • Tenant records (tenants table)                            │
│ • Tenant applications tracking                              │
│ • Admin approval workflows                                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ Tenant Database Creation
┌─────────────────────────────────────────────────────────────┐
│                    TENANTAUTH CONTEXT                        │
│  (Tenant Databases: tenant_{slug})                           │
├─────────────────────────────────────────────────────────────┤
│ • tenant_users table (Universal Core Schema)                │
│ • Tenant-specific authentication                            │
│ • Role/permissions system                                   │
│ • Domain-specific business logic                            │
└─────────────────────────────────────────────────────────────┘
```

### **Database Isolation Strategy**
- **One database per tenant** (`tenant_{slug}`)
- **Dedicated PostgreSQL users** per tenant (`tenant_{slug}_user`)
- **Cross-database foreign keys** using `tenants.numeric_id` ↔ `tenant_users.tenant_id`
- **Connection pooling per tenant** to prevent resource contention

---

## 2. 🐘 **PostgreSQL-Specific Considerations**

### **Critical PostgreSQL Settings**

```env
# .env configuration
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=landlord
DB_USERNAME=postgres                # Must have CREATEDB privilege
DB_PASSWORD=your_secure_password

# PostgreSQL extensions required
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   # For UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; # For monitoring
```

### **User Permissions Required**
```sql
-- Application user needs these privileges
ALTER USER your_app_user CREATEDB CREATEROLE;

-- Verify permissions
SELECT rolname, rolcreatedb, rolcreaterole, rolsuper 
FROM pg_roles 
WHERE rolname = 'your_app_user';
```

### **Database Creation Template**
```sql
-- Always use template0 for consistent encoding
CREATE DATABASE "tenant_slug" 
WITH ENCODING 'UTF8' 
LC_COLLATE = 'en_US.UTF-8' 
LC_CTYPE = 'en_US.UTF-8' 
TEMPLATE template0;
```

### **PostgreSQL Connection Limits**
```bash
# Monitor connection usage
sudo -u postgres psql -c "SHOW max_connections;"
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Tenant-specific connections
sudo -u postgres psql -c "
    SELECT datname, count(*) as connections
    FROM pg_stat_activity 
    WHERE datname LIKE 'tenant_%'
    GROUP BY datname;
"
```

---

## 3. 🔄 **Provisioning Flow Deep Dive**

### **Step-by-Step Execution**

```php
// 1. Permission Validation (Pre-Flight Check)
public function checkPostgreSQLPermissions(): array
{
    // Checks: CREATEDB, CREATEROLE, connection to 'postgres' database
    // Fail fast if user lacks privileges
}

// 2. Tenant Record Creation
private function createTenantRecord(array $tenantData): Tenant
{
    // Creates record in landlords.tenants table
    // Generates database_name: tenant_{slug}
    // Sets numeric_id for foreign key references
}

// 3. Database Creation (PostgreSQL Specific)
private function createTenantDatabase(Tenant $tenant): void
{
    // Critical: Connect to 'postgres' database first
    config(['database.connections.pgsql.database' => 'postgres']);
    
    // Create database with UTF8 encoding
    DB::statement("CREATE DATABASE \"{$databaseName}\" ENCODING 'UTF8' ...");
    
    // Restore original connection
}

// 4. Permission Granting
private function grantPostgreSQLPermissions(Tenant $tenant): void
{
    // Grant privileges to application user
    // Grant privileges to dedicated tenant user
    // Set default privileges for future objects
}

// 5. Migration Execution
private function runTenantMigrations(Tenant $tenant): void
{
    // Switch to tenant database connection
    // Run TenantAuth context migrations
    // Run core tenant migrations
}

// 6. Admin User Creation
private function seedTenantData(Tenant $tenant, array $tenantData): void
{
    // Create admin user with Start1234! password
    // Set must_change_password = true
    // Add metadata for audit trail
}

// 7. Email Notification
private function sendWelcomeEmail(Tenant $tenant, array $tenantData): void
{
    // Generate secure token (SHA256 hashed)
    // Store token in tenant_setup_tokens
    // Send email with correct URL pattern: /setup/password/{token}
}
```

### **Atomic Transaction Flow**
```php
DB::beginTransaction();
try {
    $tenant = $this->createTenantRecord($data);      // Step 1
    $this->createTenantDatabase($tenant);            // Step 2-3
    $this->runTenantMigrations($tenant);             // Step 4
    $this->seedTenantData($tenant, $data);           // Step 5
    $this->sendWelcomeEmail($tenant, $data);         // Step 6
    
    DB::commit();
    
} catch (\Exception $e) {
    DB::rollBack();
    $this->cleanupFailedProvisioning($tenant);       // Cleanup any created resources
    throw $e;
}
```

---

## 4. 🛡️ **Critical Safety Guards**

### **Pre-Provisioning Validation**
```php
class TenantProvisioningGuard
{
    public function validate(): array
    {
        return [
            // 1. PostgreSQL Permission Check
            'postgresql_permissions' => $this->checkPostgreSQLPermissions(),
            
            // 2. Database Connection Test
            'database_connection' => $this->testDatabaseConnection(),
            
            // 3. Disk Space Check
            'disk_space' => $this->checkDiskSpace('/var/lib/postgresql'),
            
            // 4. Connection Limit Check
            'connection_limits' => $this->checkConnectionLimits(),
            
            // 5. Tenant Slug Validation
            'slug_validation' => $this->validateSlug($slug),
        ];
    }
}
```

### **Duplicate Prevention**
```php
private function createTenantRecord(array $tenantData): Tenant
{
    // Check including soft-deleted tenants
    $existing = Tenant::withTrashed()
        ->where('slug', $tenantData['slug'])
        ->first();
    
    if ($existing) {
        throw new Exception("Tenant with slug '{$tenantData['slug']}' already exists");
    }
    
    // Check reserved slugs
    $reserved = ['admin', 'api', 'www', 'mail', 'test'];
    if (in_array($tenantData['slug'], $reserved)) {
        throw new Exception("Slug '{$tenantData['slug']}' is reserved");
    }
    
    // PostgreSQL identifier length limit (63 chars)
    if (strlen("tenant_{$tenantData['slug']}") > 63) {
        throw new Exception("Database name exceeds 63 character limit");
    }
}
```

### **Rate Limiting**
```php
// In controller
RateLimiter::for('tenant-provisioning', function (Request $request) {
    return Limit::perHour(10)->by($request->user()?->id ?: $request->ip());
});

// In database layer
DB::table('provisioning_attempts')->insert([
    'user_id' => auth()->id(),
    'slug' => $slug,
    'ip_address' => $request->ip(),
    'created_at' => now(),
]);
```

---

## 5. 🔍 **Debugging Methodology**

### **Tiered Debugging Approach**

#### **Tier 1: Quick Diagnostics**
```bash
# 1. Check PostgreSQL service
sudo systemctl status postgresql

# 2. Check connection
psql -h localhost -p 5432 -U postgres -d landlord

# 3. Check permissions
sudo -u postgres psql -c "\du"

# 4. Check logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

#### **Tier 2: Application-Level Debugging**
```bash
# 1. Enable debug logging
tail -f storage/logs/laravel.log | grep -E "(CREATE TENANT|PostgreSQL|provision)"

# 2. Test provisioning manually
php artisan tinker --execute="
    \$service = app('tenant.provisioning');
    \$tenant = \$service->provisionTenant([
        'organization_name' => 'Debug Test',
        'slug' => 'debug-' . time(),
        'admin_email' => 'debug@test.com',
        'admin_name' => 'Debug User'
    ]);
    echo 'Success: ' . \$tenant->id;
"

# 3. Check queue status
php artisan queue:failed
php artisan queue:monitor tenant-provisioning

# 4. Database connectivity test
php artisan tinker --execute="
    try {
        DB::connection('pgsql')->getPdo();
        echo '✅ PostgreSQL connection: OK' . PHP_EOL;
        
        // Test database creation
        DB::statement('CREATE DATABASE test_debug_provisioning');
        echo '✅ Database creation: OK' . PHP_EOL;
        
        DB::statement('DROP DATABASE test_debug_provisioning');
    } catch (\\\\Exception \$e) {
        echo '❌ Error: ' . \$e->getMessage() . PHP_EOL;
    }
"
```

#### **Tier 3: Deep PostgreSQL Debugging**
```bash
# 1. Check active connections
sudo -u postgres psql -c "
    SELECT pid, usename, application_name, client_addr, 
           state, query_start, query 
    FROM pg_stat_activity 
    WHERE datname LIKE 'tenant_%' 
    OR query LIKE '%CREATE DATABASE%';
"

# 2. Check locks
sudo -u postgres psql -c "
    SELECT locktype, relation::regclass, mode, granted, pid 
    FROM pg_locks 
    WHERE relation::regclass::text LIKE 'tenant_%';
"

# 3. Check database sizes
sudo -u postgres psql -c "
    SELECT datname, pg_size_pretty(pg_database_size(datname)) as size
    FROM pg_database 
    WHERE datname LIKE 'tenant_%'
    ORDER BY pg_database_size(datname) DESC;
"

# 4. Check slow queries
sudo -u postgres psql -c "
    SELECT query, calls, total_time, mean_time, rows
    FROM pg_stat_statements 
    WHERE query LIKE '%tenant_%'
    ORDER BY mean_time DESC 
    LIMIT 10;
"
```

#### **Tier 4: Provisioning-Specific Debug Routes**
```php
// Add to routes/debug.php (development only)
Route::prefix('debug/provisioning')->group(function () {
    
    // 1. Permission check
    Route::get('/permissions', function() {
        $service = app('tenant.provisioning');
        return response()->json($service->checkPostgreSQLPermissions());
    });
    
    // 2. Database creation test
    Route::get('/test-db-creation/{slug}', function($slug) {
        $databaseName = 'tenant_' . $slug;
        
        try {
            $originalConfig = config('database.connections.pgsql');
            config(['database.connections.pgsql.database' => 'postgres']);
            DB::purge('pgsql');
            
            $exists = DB::select("SELECT 1 FROM pg_database WHERE datname = ?", [$databaseName]);
            
            if (empty($exists)) {
                DB::statement("CREATE DATABASE \"{$databaseName}\" ENCODING 'UTF8'");
                $created = true;
            } else {
                $created = false;
            }
            
            config(['database.connections.pgsql' => $originalConfig]);
            DB::purge('pgsql');
            
            return response()->json([
                'database' => $databaseName,
                'created' => $created,
                'exists' => !empty($exists)
            ]);
            
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });
    
    // 3. Tenant connection test
    Route::get('/test-connection/{slug}', function($slug) {
        $tenant = DB::table('tenants')->where('slug', $slug)->first();
        
        if (!$tenant) {
            return response()->json(['error' => 'Tenant not found'], 404);
        }
        
        $config = config('database.connections.pgsql');
        $config['database'] = $tenant->database_name;
        $config['options'] = [PDO::ATTR_TIMEOUT => 5];
        
        Config::set('database.connections.tenant_test', $config);
        DB::purge('tenant_test');
        
        try {
            $start = microtime(true);
            DB::connection('tenant_test')->getPdo();
            $time = microtime(true) - $start;
            
            return response()->json([
                'success' => true,
                'tenant' => $tenant->slug,
                'database' => $tenant->database_name,
                'connection_time' => round($time * 1000, 2) . 'ms'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    });
});
```

### **Common Debugging Scenarios**

#### **Scenario 1: "Cannot create database"**
```bash
# Step 1: Check user permissions
sudo -u postgres psql -c "ALTER USER app_user CREATEDB CREATEROLE;"

# Step 2: Check connection to 'postgres' database
php artisan tinker --execute="
    config(['database.connections.pgsql.database' => 'postgres']);
    DB::purge('pgsql');
    try {
        DB::connection('pgsql')->getPdo();
        echo '✅ Can connect to postgres database' . PHP_EOL;
    } catch (\\\\Exception \$e) {
        echo '❌ Cannot connect: ' . \$e->getMessage() . PHP_EOL;
    }
"

# Step 3: Check disk space
df -h /var/lib/postgresql
```

#### **Scenario 2: "Password setup timeout"**
```bash
# Step 1: Check tenant database connectivity
curl http://localhost:8000/debug/provisioning/test-connection/{slug}

# Step 2: Check PostgreSQL connection limits
sudo -u postgres psql -c "SHOW max_connections;"
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';"

# Step 3: Check for locks
sudo -u postgres psql -d tenant_{slug} -c "\l"
sudo -u postgres psql -d tenant_{slug} -c "SELECT * FROM pg_locks;"
```

#### **Scenario 3: "Duplicate slug error"**
```bash
# Step 1: Check all occurrences (including soft-deleted)
php artisan tinker --execute="
    \$slug = 'problem-slug';
    \$existing = DB::table('tenants')
        ->where('slug', \$slug)
        ->orWhere('database_name', 'tenant_' . \$slug)
        ->get();
    echo 'Found: ' . \$existing->count() . ' records' . PHP_EOL;
"

# Step 2: Check PostgreSQL databases
sudo -u postgres psql -c "\l tenant_problem-slug"

# Step 3: Check case sensitivity
php artisan tinker --execute="
    \$slug = 'Problem-Slug'; // Different case
    \$existing = DB::table('tenants')
        ->whereRaw('LOWER(slug) = ?', [strtolower(\$slug)])
        ->get();
"
```

---

## 6. 📊 **Monitoring & Observability**

### **Key Metrics to Monitor**
```sql
-- 1. Provisioning Success Rate
SELECT 
    DATE(created_at) as day,
    COUNT(*) as total,
    SUM(CASE WHEN status = 'provisioned' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(100.0 * SUM(CASE WHEN status = 'provisioned' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM tenant_applications
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;

-- 2. Provisioning Duration
SELECT 
    tenant_slug,
    EXTRACT(EPOCH FROM (provisioning_completed_at - provisioning_started_at)) as duration_seconds,
    database_size_mb
FROM tenant_provisioning_logs
WHERE provisioning_completed_at IS NOT NULL
ORDER BY duration_seconds DESC
LIMIT 10;

-- 3. PostgreSQL Resource Usage
SELECT 
    datname,
    numbackends as connections,
    xact_commit + xact_rollback as transactions,
    tup_inserted + tup_updated + tup_deleted as row_operations
FROM pg_stat_database 
WHERE datname LIKE 'tenant_%';
```

### **Logging Strategy**
```php
class TenantProvisioningLogger
{
    public function logProvisioningStep(string $step, array $context = []): void
    {
        Log::channel('provisioning')->info("[PROVISIONING] {$step}", [
            'timestamp' => now()->toISOString(),
            'execution_id' => $this->executionId,
            'tenant_slug' => $context['slug'] ?? 'unknown',
            'database_driver' => config('database.default'),
            'memory_usage' => memory_get_usage(true) / 1024 / 1024 . ' MB',
            'context' => $context
        ]);
        
        // Also log to structured storage for analytics
        DB::table('provisioning_audit_log')->insert([
            'execution_id' => $this->executionId,
            'step' => $step,
            'context' => json_encode($context),
            'duration_ms' => $this->getStepDuration(),
            'created_at' => now(),
        ]);
    }
}
```

### **Alerting Rules**
```yaml
# Prometheus alert rules
groups:
  - name: tenant_provisioning
    rules:
      - alert: HighProvisioningFailureRate
        expr: |
          rate(tenant_provisioning_failed_total[5m]) 
          / rate(tenant_provisioning_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High tenant provisioning failure rate"
          
      - alert: ProvisioningTimeout
        expr: tenant_provisioning_duration_seconds > 60
        labels:
          severity: warning
        annotations:
          summary: "Tenant provisioning taking too long"
```

---

## 7. 🏭 **Production Hardening**

### **Connection Pool Management**
```php
// Tenant database connection with pooling
'connections' => [
    'tenant' => [
        'driver' => 'pgsql',
        'url' => env('DATABASE_URL'),
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '5432'),
        'database' => ':tenant_database:', // Dynamic
        'username' => env('DB_USERNAME', 'postgres'),
        'password' => env('DB_PASSWORD', ''),
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => 'public',
        'sslmode' => 'prefer',
        'pool' => [
            'max_connections' => 20,
            'min_connections' => 5,
            'max_idle_time' => 300,
        ],
    ],
],
```

### **Rate Limiting & Throttling**
```php
// In ProvisionTenantJob
public $tries = 3;
public $backoff = [60, 300, 600]; // 1min, 5min, 10min
public $timeout = 300; // 5 minutes
public $maxExceptions = 3;

public function handle()
{
    // Check system load before starting
    if ($this->systemLoadTooHigh()) {
        $this->release(60); // Delay by 1 minute
        return;
    }
    
    // Check database connection count
    if ($this->tooManyConnections()) {
        $this->release(30);
        return;
    }
}
```

### **Security Considerations**
```php
// 1. Input validation
$validator = Validator::make($data, [
    'slug' => [
        'required',
        'string',
        'min:2',
        'max:50',
        'regex:/^[a-z0-9-]+$/',
        'not_in:' . implode(',', config('reserved-slugs')),
        new UniqueSlugRule,
    ],
    'admin_email' => [
        'required',
        'email:rfc,dns',
        'max:255',
        new CorporateEmailRule, // Prevent personal emails
    ],
]);

// 2. Secure password generation
private function generateDatabasePassword(): string
{
    return \Str::password(32); // Laravel 9+ secure password
}

// 3. Credential encryption
private function storeDatabaseCredentials(Tenant $tenant, string $username, string $password): void
{
    DB::table('tenant_databases')->insert([
        'tenant_id' => $tenant->id,
        'database_username' => $username,
        'database_password' => encrypt($password), // Laravel encryption
        'encryption_key_id' => config('app.key_id'), // Key rotation support
        'created_at' => now(),
    ]);
}
```

---

## 8. 🚨 **Disaster Recovery**

### **Backup Strategy**
```bash
#!/bin/bash
# tenant-backup.sh

# Backup all tenant databases
for DB in $(psql -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'"); do
    echo "Backing up $DB..."
    pg_dump -Fc "$DB" > "/backups/tenant-databases/$DB-$(date +%Y%m%d).dump"
done

# Backup landlord database
pg_dump -Fc "landlord" > "/backups/landlord/landlord-$(date +%Y%m%d).dump"

# Rotate backups (keep 30 days)
find /backups -name "*.dump" -mtime +30 -delete
```

### **Restoration Procedure**
```php
class TenantRestorationService
{
    public function restoreTenant(string $tenantId, string $backupFile): void
    {
        // 1. Validate backup file
        $this->validateBackup($backupFile);
        
        // 2. Stop connections to tenant database
        $this->terminateConnections($tenantId);
        
        // 3. Restore database
        $command = "pg_restore -c -d tenant_{$slug} {$backupFile}";
        exec($command, $output, $exitCode);
        
        // 4. Verify restoration
        $this->verifyRestoration($tenantId);
        
        // 5. Update application state
        DB::table('tenants')
            ->where('id', $tenantId)
            ->update(['restored_at' => now()]);
    }
}
```

### **High Availability Setup**
```yaml
# docker-compose.high-availability.yml
version: '3.8'
services:
  postgres-primary:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: landlord
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    
  postgres-replica:
    image: postgres:15
    depends_on:
      - postgres-primary
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    command: >
      bash -c "
      until pg_isready -h postgres-primary; do sleep 1; done &&
      pg_basebackup -h postgres-primary -D /var/lib/postgresql/data -U replicator -v -P &&
      echo \"primary_conninfo = 'host=postgres-primary user=replicator password=${REPLICATOR_PASSWORD}'\" >> /var/lib/postgresql/data/postgresql.conf &&
      echo \"primary_slot_name = 'replication_slot'\" >> /var/lib/postgresql/data/postgresql.conf &&
      touch /var/lib/postgresql/data/standby.signal &&
      postgres
      "
```

---

## 9. ⚡ **Performance Optimization**

### **Database Connection Pooling**
```php
// Use PgBouncer for connection pooling
'connections' => [
    'pgsql' => [
        'driver' => 'pgsql',
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', 6432), // PgBouncer port
        // ... rest of config
    ],
],

// In PostgreSQL configuration
# pgbouncer.ini
[databases]
landlord = host=localhost port=5432 dbname=landlord
* = host=localhost port=5432

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

### **Parallel Provisioning**
```php
class ParallelProvisioningService
{
    public function provisionMultiple(array $applications): void
    {
        $chunks = array_chunk($applications, 5); // Process 5 at a time
        
        foreach ($chunks as $chunk) {
            $promises = [];
            
            foreach ($chunk as $application) {
                $promises[] = Async::run(function () use ($application) {
                    return $this->provisioningService->provisionTenant($application);
                });
            }
            
            // Wait for all promises to complete
            Promise\all($promises)->wait();
            
            // Small delay between chunks
            usleep(500000); // 0.5 seconds
        }
    }
}
```

### **Caching Strategy**
```php
class TenantMetadataCache
{
    public function getTenantBySlug(string $slug): ?Tenant
    {
        $cacheKey = "tenant:slug:{$slug}";
        
        return Cache::remember($cacheKey, 3600, function () use ($slug) {
            return Tenant::where('slug', $slug)->first();
        });
    }
    
    public function getTenantDatabase(string $tenantId): ?array
    {
        $cacheKey = "tenant:database:{$tenantId}";
        
        return Cache::remember($cacheKey, 300, function () use ($tenantId) {
            return DB::table('tenant_databases')
                ->where('tenant_id', $tenantId)
                ->first();
        });
    }
}
```

---

## 10. ⚠️ **Common Pitfalls & Solutions**

### **Pitfall 1: PostgreSQL Identifier Limits**
```php
// Problem: Database name > 63 characters
$databaseName = "tenant_very-long-organization-name-slug";

// Solution: Truncate intelligently
private function generateDatabaseName(string $slug): string
{
    $maxLength = 63;
    $prefix = 'tenant_';
    $maxSlugLength = $maxLength - strlen($prefix);
    
    return $prefix . substr($slug, 0, $maxSlugLength);
}
```

### **Pitfall 2: Connection Pool Exhaustion**
```bash
# Monitor connection usage
watch -n 5 "psql -c \"SELECT count(*) FROM pg_stat_activity WHERE datname LIKE 'tenant_%';\""

# Implement connection recycling
'connections' => [
    'tenant' => [
        // ... config
        'options' => [
            PDO::ATTR_PERSISTENT => false, // Don't use persistent connections
            PDO::ATTR_TIMEOUT => 30,
        ],
    ],
],
```

### **Pitfall 3: Case Sensitivity in URLs**
```php
// Problem: /setup-password/{token} vs /setup/password/{token}
// Solution: Centralized URL generation
class TenantUrlGenerator
{
    public static function passwordSetupUrl(string $token): string
    {
        return url("/setup/password/{$token}");
    }
    
    public static function tenantLoginUrl(string $slug): string
    {
        return app()->environment('production')
            ? "https://{$slug}.yourdomain.com/login"
            : url("/{$slug}/login");
    }
}
```

### **Pitfall 4: Mixed Database Drivers**
```php
// Problem: Hardcoded MySQL in migration commands
// Solution: Database-agnostic commands
private function configureTenantConnection(Tenant $tenant): void
{
    $driver = config('database.default');
    
    if ($driver === 'pgsql') {
        // PostgreSQL config
        $config = config('database.connections.pgsql');
    } else {
        // MySQL config
        $config = config('database.connections.mysql');
    }
    
    $config['database'] = $tenant->database_name;
    
    Config::set('database.connections.tenant', $config);
    DB::purge('tenant');
}
```

### **Pitfall 5: Missing PostgreSQL Extensions**
```bash
# Check required extensions
sudo -u postgres psql -d landlord -c "\dx"

# Install missing extensions
sudo -u postgres psql -d landlord -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"
sudo -u postgres psql -d landlord -c "CREATE EXTENSION IF NOT EXISTS \"pg_stat_statements\";"
```

---

## 🎯 **Final Checklist Before Production**

### **Pre-Production Verification**
```bash
# 1. PostgreSQL Configuration
./scripts/verify-postgresql.sh

# 2. Provisioning Test Suite
php artisan test tests/Feature/TenantAuth/TenantProvisioningWorkflowTest.php

# 3. Load Testing
./scripts/load-test-provisioning.sh --concurrency=5 --iterations=10

# 4. Disaster Recovery Test
./scripts/test-restoration.sh

# 5. Monitoring Setup
curl http://localhost:8000/debug/provisioning/permissions
curl http://localhost:8000/debug/provisioning/test-db-creation/test-$(date +%s)
```

### **Production Readiness Checklist**
- [ ] PostgreSQL user has `CREATEDB` and `CREATEROLE` privileges
- [ ] Connection pooling configured (PgBouncer)
- [ ] Backup strategy implemented and tested
- [ ] Monitoring and alerting configured
- [ ] Rate limiting enabled
- [ ] All migrations are database-agnostic
- [ ] URL patterns consistent (slash vs dash)
- [ ] Logging captures all provisioning steps
- [ ] Error handling with proper rollback
- [ ] Security audit completed

---

## 📚 **Additional Resources**

### **Essential Commands**
```bash
# PostgreSQL Management
pg_dump -Fc database_name > backup.dump
pg_restore -d database_name backup.dump
pg_basebackup -h primary -D /backup -U replicator -v -P

# Monitoring
pg_top                          # PostgreSQL top
pg_activity                     # Better process viewer
pgbadger postgresql.log         # Log analyzer

# Maintenance
vacuumdb --analyze --verbose database_name
reindexdb --verbose database_name
```

### **Useful Queries**
```sql
-- Find long-running queries
SELECT pid, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_all_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

**Remember:** Multi-tenant PostgreSQL provisioning requires careful attention to connection management, resource isolation, and error handling. Always test thoroughly in staging before production deployment, and implement comprehensive monitoring to catch issues early.