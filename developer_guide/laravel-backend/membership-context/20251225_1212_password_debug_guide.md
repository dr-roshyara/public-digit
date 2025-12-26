# **🔧 Developer Guide: Multi-Tenant Password Reset Debugging & Architecture**

## **📋 Table of Contents**
1. [Architecture Overview](#architecture-overview)
2. [Password Reset Systems](#password-reset-systems)
3. [Debugging Methodology](#debugging-methodology)
4. [Common Issues & Solutions](#common-issues--solutions)
5. [Database Connection Patterns](#database-connection-patterns)
6. [Logging & Monitoring](#logging--monitoring)
7. [Testing Strategy](#testing-strategy)

---

## **🏗️ Architecture Overview**

### **System Architecture**
```
┌─────────────────────────────────┐
│        Landlord Database        │
│  ┌─────────────────────────┐    │
│  │ tenant_databases table  │    │
│  │ • tenant_id             │    │
│  │ • database_name         │    │
│  │ • encrypted credentials │    │
│  └─────────────────────────┘    │
│  │ tenants table           │    │
│  │ • id, slug, name        │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│   Tenant Databases (Dynamic)    │
│  ┌─────────────┬─────────────┐  │
│  │ tenant_uml  │ tenant_nc   │  │
│  │ ┌─────────┐ │ ┌─────────┐ │  │
│  │ │tenant_  │ │ │tenant_  │ │  │
│  │ │users    │ │ │users    │ │  │
│  │ └─────────┘ │ └─────────┘ │  │
│  └─────────────┴─────────────┘  │
└─────────────────────────────────┘
```

### **File Hierarchy**
```
packages/laravel-backend/
├── app/
│   ├── Contexts/
│   │   ├── Platform/                    # Platform Context (DDD)
│   │   │   ├── Application/
│   │   │   │   └── Services/
│   │   │   │       ├── SecureSetupTokenService.php
│   │   │   │       ├── DynamicDatabaseProvisioningService.php
│   │   │   │       └── CredentialValidationService.php
│   │   │   └── Infrastructure/
│   │   │       └── Http/
│   │   │           └── Controllers/
│   │   │               └── SecureSetupController.php
│   │   └── TenantAuth/                  # Tenant Authentication Context
│   │       └── Infrastructure/
│   │           └── Http/
│   │               └── Controllers/
│   │                   └── TenantPasswordResetController.php
│   ├── Http/
│   │   ├── Middleware/
│   │   │   └── HandleInertiaRequests.php
│   │   └── Controllers/
│   └── Console/
│       └── Commands/
│           └── SyncMissingTenantDatabaseRecords.php
├── config/
│   ├── database.php
│   └── multitenancy.php
└── routes/
    └── web.php
```

---

## **🔐 Password Reset Systems**

### **1. New Tenant Setup Password (`/setup/password/{token}`)**
**Purpose:** Initial password setup for new tenant admin users
**Controller:** `SecureSetupController@submitPassword`
**Service:** `SecureSetupTokenService::setPasswordWithToken()`
**Flow:**
```
1. User clicks setup link from welcome email
2. Token validation via tenant_setup_tokens table
3. Get tenant database config from tenant_databases table
4. Switch to tenant database connection
5. Update password in tenant_users table
6. Set must_change_password = false
```

### **2. Existing Tenant Password Reset (`/{tenant}/reset-password/{token}`)**
**Purpose:** Password reset for existing tenant users
**Controller:** `TenantPasswordResetController@resetPassword`
**Flow:**
```
1. User requests password reset from tenant login page
2. Email sent with tenant-specific reset link
3. Token stored in tenant_password_reset_tokens table
4. User clicks link and resets password in tenant context
```

### **3. View Database Credentials (`/setup/credentials/{token}`)**
**Purpose:** Display database credentials after password setup
**Controller:** `SecureSetupController@showCredentials`
**Service:** `DynamicDatabaseProvisioningService::generateAndProvisionCredentials()`

---

## **🔍 Debugging Methodology**

### **Step 1: Identify the Problem**
```bash
# Check which route is failing
php artisan route:list --path="password/"
php artisan route:list --path="credentials/"

# Expected output:
# GET|HEAD   setup/password/{token}      → SecureSetupController@showPasswordSetup
# POST       setup/password/{token}      → SecureSetupController@submitPassword  
# GET|HEAD   setup/credentials/{token}   → SecureSetupController@showCredentials
# GET|HEAD   {tenant}/reset-password/{token} → TenantPasswordResetController@showResetPasswordForm
```

### **Step 2: Check Database State**
```bash
# 1. Check tenant_databases table exists and has records
php artisan tinker --execute="
use Illuminate\Support\Facades\DB;
echo 'Tenants: ' . DB::table('tenants')->count() . PHP_EOL;
echo 'Tenant Databases: ' . DB::table('tenant_databases')->count() . PHP_EOL;
"

# 2. Fix missing records
php artisan tenant:sync-database-records --all --force
```

### **Step 3: Test Database Connections**
```bash
# Test PostgreSQL connectivity
PGPASSWORD="your_password" psql -h 127.0.0.1 -p 5432 -U postgres -d tenant_nrna -c "SELECT email FROM tenant_users;"

# Test via Laravel
php artisan tinker --execute="
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;

\$config = [
    'driver' => 'pgsql',
    'host' => '127.0.0.1',
    'port' => 5432,
    'database' => 'tenant_nrna',
    'username' => 'postgres',
    'password' => 'your_password',
    'charset' => 'utf8',
];

Config::set('database.connections.test', \$config);
DB::purge('test');

try {
    \$users = DB::connection('test')->table('tenant_users')->count();
    echo '✅ Connected: ' . \$users . ' users' . PHP_EOL;
} catch (\\Exception \$e) {
    echo '❌ Connection failed: ' . \$e->getMessage() . PHP_EOL;
}
"
```

### **Step 4: Monitor Logs**
```bash
# Tail logs in real-time
tail -f storage/logs/laravel.log

# Search for specific errors
grep -i "password\|tenant\|database\|mysql\|pgsql" storage/logs/laravel.log | tail -50

# Clear and watch fresh logs
php artisan optimize:clear && tail -f storage/logs/laravel.log
```

### **Step 5: Create Diagnostic Commands**
```php
// app/Console/Commands/DebugPasswordReset.php
class DebugPasswordReset extends Command
{
    protected $signature = 'debug:password-reset 
                           {--token= : Test specific token}
                           {--tenant= : Test specific tenant}';
    
    public function handle()
    {
        $this->checkTenantDatabases();
        $this->testDatabaseConnections();
        $this->checkRateLimits();
        $this->verifyTokenValidity();
    }
}
```

---

## **⚠️ Common Issues & Solutions**

### **Issue 1: "Tenant database configuration not found"**
**Root Cause:** Missing `tenant_databases` table records
**Solution:**
```bash
# 1. Create missing table
CREATE TABLE IF NOT EXISTS tenant_databases (...);

# 2. Sync existing tenants
php artisan tenant:sync-database-records --all --force

# 3. Verify
SELECT t.slug, td.database_name 
FROM tenants t 
LEFT JOIN tenant_databases td ON t.id = td.tenant_id 
WHERE td.id IS NULL;
```

### **Issue 2: "Maximum execution time of 30 seconds exceeded"**
**Root Cause:** Wrong database driver (MySQL instead of PostgreSQL)
**Symptoms:** Hangs at `CredentialValidationService.php:44`
**Solution:**
```php
// ❌ WRONG (causes timeout):
'pdo' => new PDO('mysql:host=%s;port=%d;dbname=%s', ...);

// ✅ CORRECT:
'pdo' => new PDO('pgsql:host=%s;port=%d;dbname=%s;', ...);
```

**Files to check:**
1. `CredentialValidationService.php` - Line 44
2. `TenantPasswordResetController.php` - Lines 102, 156
3. `SecureSetupTokenService.php` - Database driver configuration

### **Issue 3: "Call to undefined method toString() on string"**
**Root Cause:** Calling object methods on string values
**Location:** `HandleInertiaRequests.php:79-80`
**Solution:**
```php
// ❌ WRONG:
'slug' => $currentTenant->getSlug()->toString(),
'email' => $currentTenant->getEmail()->toString(),

// ✅ CORRECT:
'slug' => $currentTenant->getSlug(),  // Already returns string
'email' => $currentTenant->getEmail(), // Already returns string
```

### **Issue 4: "Rate limit exceeded for tenant"**
**Root Cause:** Security feature preventing abuse
**Solution:**
```bash
# 1. Wait 1 hour (rate limit resets automatically)
# 2. OR Clear rate limit cache
php artisan tinker --execute="
Cache::forget('softcrew_cache_rate_limit:TENANT_ID:credential_generation');
"

# 3. Check current status
php artisan tinker --execute="
echo 'Attempts: ' . Cache::get('softcrew_cache_rate_limit:TENANT_ID:credential_generation', 0);
"
```

### **Issue 5: Wrong Redirect After Password Change**
**Root Cause:** Controller redirects to credentials page instead of success page
**Location:** `SecureSetupController::submitPassword()`
**Solution:**
```php
// Option A: Show success page
return Inertia::render('Contexts/Platform/Setup/PasswordSuccess', [...]);

// Option B: Redirect to tenant login
return redirect("http://{$tenantSlug}.localhost:8000/login")
    ->with('success', 'Password changed!');
```

---

## **🔗 Database Connection Patterns**

### **Pattern 1: Dynamic Tenant Database Switching**
```php
// SecureSetupTokenService::setPasswordWithToken()
$tenantDb = DB::table('tenant_databases')
    ->where('tenant_id', $tenant->id)
    ->whereIn('status', ['active', 'fallback'])
    ->first();

$config = [
    'driver' => $tenantDb->database_driver ?? 'pgsql',
    'host' => $tenantDb->host,
    'port' => $tenantDb->port,
    'database' => $tenantDb->database_name,
    'username' => $tenantDb->database_username,
    'password' => decrypt($tenantDb->database_password),
];

Config::set('database.connections.tenant', $config);
DB::purge('tenant');
DB::setDefaultConnection('tenant');
```

### **Pattern 2: Fallback Connection**
```php
private function findTenantUser($tenant, string $email)
{
    $driver = env('DB_CONNECTION', 'pgsql'); // ✅ PostgreSQL default
    
    if ($driver === 'sqlite') {
        // Test environment
        return DB::table('tenant_users')->where('email', $email)->first();
    }
    
    // Production with tenant-specific database
    $config = [
        'driver' => 'pgsql', // ❌ Was 'mysql'
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', 5432), // ❌ Was 3306
        'database' => $tenant->database_name,
        'username' => env('DB_USERNAME', 'postgres'), // ❌ Was 'root'
        'password' => env('DB_PASSWORD', ''),
    ];
    
    // Use unique connection name to avoid conflicts
    $connectionName = 'tenant_temp_' . uniqid();
    Config::set("database.connections.{$connectionName}", $config);
    DB::purge($connectionName);
    
    try {
        return DB::connection($connectionName)
            ->table('tenant_users')
            ->where('email', $email)
            ->first();
    } finally {
        // Clean up temporary connection
    }
}
```

### **Pattern 3: Credential Validation**
```php
public function validateCredentials(DatabaseCredentials $credentials): bool
{
    // ❌ OLD (MySQL - caused timeout):
    $pdo = new PDO(
        'mysql:host=%s;port=%d;dbname=%s',
        $credentials->getHost(),
        $credentials->getPort(),
        $credentials->getDatabaseName()
    );
    
    // ✅ NEW (PostgreSQL - works instantly):
    $pdo = new PDO(
        'pgsql:host=%s;port=%d;dbname=%s;', // Note trailing semicolon
        $credentials->getHost(),
        $credentials->getPort(),
        $credentials->getDatabaseName()
    );
}
```

---

## **📊 Logging & Monitoring**

### **Key Log Patterns**
```php
// SecureSetupTokenService.php
Log::info('[PASSWORD_SETUP] Starting password setup', [
    'token_preview' => substr(hash('sha256', $token), 0, 16) . '...',
    'tenant_id' => $tenant->id,
]);

Log::error('[PASSWORD_SETUP] Failed to set password', [
    'tenant_id' => $tenant->id,
    'error' => $e->getMessage(),
    'driver' => $driver,
    'trace' => $e->getTraceAsString(), // Include stack trace for debugging
]);
```

### **Debug Log Levels**
```bash
# Enable detailed logging
tail -f storage/logs/laravel.log | grep -E "(PASSWORD|SETUP|TENANT|DATABASE)"

# Common log messages to monitor:
# [PASSWORD_SETUP] Admin password set successfully
# [SETUP_TOKEN] Dynamic credential generation started
# [CREDENTIAL_VALIDATION] Starting validation
# [RESOURCE_PROTECTION] Rate limit exceeded
# Maximum execution time of 30 seconds exceeded
```

---

## **🧪 Testing Strategy**

### **Unit Test Structure**
```php
class PasswordResetTest extends TestCase
{
    public function test_tenant_database_records_exist()
    {
        $tenants = Tenant::all();
        foreach ($tenants as $tenant) {
            $this->assertDatabaseHas('tenant_databases', [
                'tenant_id' => $tenant->id
            ]);
        }
    }
    
    public function test_password_reset_uses_postgresql_driver()
    {
        $controller = new TenantPasswordResetController();
        $reflection = new ReflectionClass($controller);
        $method = $reflection->getMethod('findTenantUser');
        $method->setAccessible(true);
        
        // Test that driver is 'pgsql' not 'mysql'
        $this->assertStringContainsString("'driver' => 'pgsql'", 
            $this->getSourceCode($method));
    }
}
```

### **Integration Test Flow**
```bash
# 1. Provision test tenant
php artisan tenant:provision-test --slug=testdebug

# 2. Test password reset flow
curl -X POST http://testdebug.localhost:8000/forgot-password \
  -d "email=admin@testdebug.local"

# 3. Verify email sent
php artisan tinker --execute="DB::table('tenant_password_reset_tokens')->count();"

# 4. Test reset link
curl http://testdebug.localhost:8000/reset-password/TOKEN

# 5. Verify password update
curl -X POST http://testdebug.localhost:8000/reset-password \
  -d "token=TOKEN&email=admin@testdebug.local&password=NewPass123!"
```

---

## **🎯 Key Takeaways**

### **1. Database Driver Consistency**
- **Always use `'pgsql'`** for PostgreSQL databases
- **Port `5432`** for PostgreSQL, not `3306` (MySQL)
- **Username `'postgres'`** not `'root'`
- **DSN format:** `'pgsql:host=%s;port=%d;dbname=%s;'` (note semicolon)

### **2. Tenant Database Management**
- **Always check `tenant_databases` table** exists and has records
- **Use `SyncMissingTenantDatabaseRecords` command** to fix missing records
- **Encrypt database passwords** in `tenant_databases` table

### **3. Error Handling**
- **Monitor `storage/logs/laravel.log`** for real-time debugging
- **Check for `toString()` calls** on string values
- **Validate database connections** before attempting operations

### **4. Security Features**
- **Rate limiting** is intentional - respect limits or clear cache in dev
- **Token expiration** (24 hours for setup tokens)
- **One-time use tokens** prevent replay attacks

### **5. Development Workflow**
1. **Identify route** → Check `php artisan route:list`
2. **Check logs** → `tail -f storage/logs/laravel.log`
3. **Verify database** → Check `tenant_databases` records
4. **Test connection** → Direct PostgreSQL connection test
5. **Fix driver issues** → Ensure `pgsql` not `mysql`
6. **Clear cache** → `php artisan optimize:clear`

---

## **🚀 Quick Reference Commands**

```bash
# 1. Fix all common issues
php artisan tenant:sync-database-records --all --force
php artisan optimize:clear

# 2. Test specific tenant
php artisan tinker --execute="
\$tenant = DB::table('tenants')->where('slug', 'nrna')->first();
echo 'Database: ' . \$tenant->database_name;
"

# 3. Clear rate limits
php artisan tinker --execute="
Cache::forget('softcrew_cache_rate_limit:TENANT_ID:credential_generation');
"

# 4. Verify PostgreSQL driver
grep -n "mysql:\|pgsql:" app/Contexts/Platform/Application/Services/CredentialValidationService.php

# 5. Monitor real-time
tail -f storage/logs/laravel.log | grep -i "password\|error\|exception"
```

This guide captures the comprehensive debugging approach for multi-tenant password reset systems, combining architectural understanding with practical debugging techniques. The key insight is maintaining consistency between your actual database technology (PostgreSQL) and the configuration throughout your codebase.