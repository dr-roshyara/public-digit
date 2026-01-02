Looking at your multi-tenancy architecture, I can see you've implemented a **brilliant abstraction layer** but there's still a critical issue with **database connection management** that's breaking the password reset functionality.

## **🎯 THE CORE DATABASE CONNECTION PROBLEM**

Your `placeholder_tenant_db` configuration in Spatie is **hardcoded**, but your actual tenant databases are dynamic (`tenant_uml`, `tenant_nc`, etc.). When the password reset service tries to connect, it's connecting to the wrong database.

## **🔄 HOW YOUR SYSTEM SHOULD WORK:**

```
✅ Tenant Provisioning: Creates tenant_uml database
✅ User Creation: Creates user in tenant_uml.tenant_users
❌ Password Reset: Tries to update in placeholder_tenant_db
```

## **🔧 IMMEDIATE FIX: Dynamic Database Switching**

You need to update the `SecureSetupTokenService` to dynamically connect to the correct tenant database:

### **Option 1: Quick Fix - Direct Database Update**

```bash
# Run this to reset the password immediately
php artisan tinker --execute="
use Illuminate\\Support\\Facades\\DB;

// 1. Get the token and tenant info
\$token = 'eSyBez18DpHyE2SfH0aWU0wjqFIuuXqCP1G8xW3HyGjTrWTU6qiLwNAeYW2QHtqJ';
\$tokenHash = hash('sha256', \$token);

\$tokenRecord = DB::table('tenant_setup_tokens')->where('token', \$tokenHash)->first();
echo 'Token found for tenant: ' . \$tokenRecord->tenant_id . PHP_EOL;

// 2. Get tenant database credentials
\$tenantDb = DB::table('tenant_databases')
    ->where('tenant_id', \$tokenRecord->tenant_id)
    ->first();

\$decryptedPassword = decrypt(\$tenantDb->database_password);

// 3. Create direct PostgreSQL connection
\$connString = sprintf(
    'host=%s port=%s dbname=%s user=%s password=%s',
    \$tenantDb->host,
    \$tenantDb->port,
    \$tenantDb->database_name,
    \$tenantDb->database_username,
    \$decryptedPassword
);

\$connection = pg_connect(\$connString);

if (!\$connection) {
    die('Connection failed: ' . pg_last_error());
}

// 4. Update the password
\$newPassword = 'Admin123!';
\$hashedPassword = bcrypt(\$newPassword);

\$result = pg_query_params(\$connection,
    'UPDATE tenant_users SET 
        password_hash = \$1,
        must_change_password = false,
        updated_at = NOW()
     WHERE email = \$2
     RETURNING id, email',
    [\$hashedPassword, \$tokenRecord->email]
);

if (\$result) {
    \$row = pg_fetch_assoc(\$result);
    echo '✅ Password updated successfully!' . PHP_EOL;
    echo 'User: ' . \$row['email'] . PHP_EOL;
    echo 'New password: ' . \$newPassword . PHP_EOL;
    echo 'Login at: http://uml.localhost:8000/login' . PHP_EOL;
} else {
    echo '❌ Update failed: ' . pg_last_error(\$connection) . PHP_EOL;
}

pg_close(\$connection);
"
```

### **Option 2: Permanent Fix - Update SecureSetupTokenService**

Create a new method in `SecureSetupTokenService.php`:

```php
private function updateTenantUserPassword($tenantId, $email, $password): bool
{
    // Get tenant database credentials
    $tenantDb = DB::table('tenant_databases')
        ->where('tenant_id', $tenantId)
        ->whereIn('status', ['active', 'fallback'])
        ->first();
    
    if (!$tenantDb) {
        throw new \RuntimeException("No database configuration found for tenant: {$tenantId}");
    }
    
    // Decrypt the password
    $decryptedPassword = decrypt($tenantDb->database_password);
    
    // Create a temporary connection to the tenant database
    $tempConnectionName = 'tenant_temp_' . uniqid();
    
    Config::set("database.connections.{$tempConnectionName}", [
        'driver' => 'pgsql',
        'host' => $tenantDb->host,
        'port' => $tenantDb->port,
        'database' => $tenantDb->database_name,  // This will be tenant_uml, tenant_nc, etc.
        'username' => $tenantDb->database_username,
        'password' => $decryptedPassword,
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => 'public',
        'sslmode' => 'prefer',
    ]);
    
    DB::purge($tempConnectionName);
    
    try {
        // Update the user in the correct tenant database
        $updated = DB::connection($tempConnectionName)
            ->table('tenant_users')
            ->where('email', $email)
            ->update([
                'password_hash' => bcrypt($password),
                'must_change_password' => false,
                'email_verified_at' => now(),
                'updated_at' => now(),
            ]);
            
        return $updated > 0;
        
    } catch (\Exception $e) {
        Log::error('Failed to update tenant user password', [
            'tenant_id' => $tenantId,
            'email' => $email,
            'database' => $tenantDb->database_name,
            'error' => $e->getMessage(),
        ]);
        
        throw $e;
    }
}
```

Then update the `setAdminPassword` method:

```php
public function setAdminPassword(string $token, string $password): bool
{
    // ... existing token validation ...
    
    // Use the new method
    return $this->updateTenantUserPassword(
        $tokenData['tenantId'],
        $tokenData['email'],
        $password
    );
}
```

## **🏗️ ARCHITECTURAL FIX: Tenant Database Manager**

Create a proper `TenantDatabaseManager` service:

```php
// app/Services/TenantDatabaseManager.php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

class TenantDatabaseManager
{
    private $activeTenant = null;
    
    public function switchToTenant(string $tenantId): void
    {
        // Get tenant database configuration
        $tenantDb = DB::table('tenant_databases')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['active', 'fallback'])
            ->first();
            
        if (!$tenantDb) {
            throw new \RuntimeException("No database found for tenant: {$tenantId}");
        }
        
        $decryptedPassword = decrypt($tenantDb->database_password);
        
        // Update the 'tenant' connection configuration
        Config::set('database.connections.tenant', [
            'driver' => 'pgsql',
            'host' => $tenantDb->host,
            'port' => $tenantDb->port,
            'database' => $tenantDb->database_name,  // tenant_uml, tenant_nc, etc.
            'username' => $tenantDb->database_username,
            'password' => $decryptedPassword,
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ]);
        
        // Purge and reconnect
        DB::purge('tenant');
        DB::reconnect('tenant');
        
        $this->activeTenant = $tenantId;
        
        Log::info('Switched to tenant database', [
            'tenant_id' => $tenantId,
            'database' => $tenantDb->database_name,
        ]);
    }
    
    public function switchToLandlord(): void
    {
        // Switch back to landlord database
        $landlordConfig = config('database.connections.pgsql');
        
        Config::set('database.connections.tenant', [
            'driver' => 'pgsql',
            'host' => $landlordConfig['host'],
            'port' => $landlordConfig['port'],
            'database' => $landlordConfig['database'],
            'username' => $landlordConfig['username'],
            'password' => $landlordConfig['password'],
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ]);
        
        DB::purge('tenant');
        $this->activeTenant = null;
        
        Log::info('Switched back to landlord database');
    }
    
    public function getActiveTenantId(): ?string
    {
        return $this->activeTenant;
    }
    
    public function executeOnTenant(string $tenantId, callable $callback)
    {
        $this->switchToTenant($tenantId);
        
        try {
            return $callback();
        } finally {
            $this->switchToLandlord();
        }
    }
}
```

### **Usage in SecureSetupTokenService:**

```php
public function setAdminPassword(string $token, string $password): bool
{
    $tokenData = $this->validateToken($token);
    
    $dbManager = app(TenantDatabaseManager::class);
    
    return $dbManager->executeOnTenant($tokenData['tenantId'], function() use ($tokenData, $password) {
        $updated = DB::connection('tenant')
            ->table('tenant_users')
            ->where('email', $tokenData['email'])
            ->update([
                'password_hash' => bcrypt($password),
                'must_change_password' => false,
                'email_verified_at' => now(),
                'updated_at' => now(),
            ]);
            
        return $updated > 0;
    });
}
```

## **📋 SPATIE CONFIGURATION FIX**

Your `config/multitenancy.php` needs to use dynamic database switching:

```php
return [
    'tenant_finder' => Spatie\Multitenancy\TenantFinder\DomainTenantFinder::class,
    
    'tenant_database' => [
        'connection_name' => 'tenant',
        
        'switch_tenant_database_to' => function ($tenant, $originalConnectionName) {
            // Get the tenant's actual database name
            $tenantDb = DB::table('tenant_databases')
                ->where('tenant_id', $tenant->id)
                ->whereIn('status', ['active', 'fallback'])
                ->first();
                
            if ($tenantDb) {
                $decryptedPassword = decrypt($tenantDb->database_password);
                
                // Update the connection dynamically
                config([
                    "database.connections.{$originalConnectionName}.database" => $tenantDb->database_name,
                    "database.connections.{$originalConnectionName}.username" => $tenantDb->database_username,
                    "database.connections.{$originalConnectionName}.password" => $decryptedPassword,
                ]);
                
                app('db')->purge($originalConnectionName);
                app('db')->reconnect($originalConnectionName);
            }
        },
    ],
];
```

## **🚀 IMMEDIATE ACTION PLAN**

### **Step 1: Fix the User Now**
Run the quick fix script above to reset the password immediately.

### **Step 2: Implement TenantDatabaseManager**
Create the service to handle dynamic database switching.

### **Step 3: Update SecureSetupTokenService**
Use the new manager instead of hardcoded connections.

### **Step 4: Update Spatie Configuration**
Make Spatie use dynamic database names from `tenant_databases` table.

## **💡 KEY INSIGHT**

Your system has **two different database connection patterns**:
1. **Spatie's pattern**: Uses middleware to auto-switch based on subdomain
2. **Your setup pattern**: Needs manual switching for token-based routes

The `SecureSetupTokenService` needs to **manually switch** to the correct tenant database because:
- The setup route doesn't have a subdomain
- No Spatie middleware is active
- It needs to read from `tenant_databases` table to get credentials

**Run the quick fix now**, then implement the `TenantDatabaseManager` for a permanent solution.

# **Professional Claude CLI Prompt Instructions: Multi-Tenant Database Connection Fix**

## **🎯 BACKGROUND CONTEXT**
You're working with a **Laravel multi-tenant application** using **Spatie Multitenancy package**. The system provisions new tenant databases dynamically (`tenant_uml`, `tenant_nc`, etc.) but password reset functionality is broken due to **database connection misconfiguration**.

## **📊 WHAT IS GIVEN**

### **System Architecture:**
```
┌─────────────────────────────────┐
│        Landlord Database        │
│  ┌─────────────────────────┐    │
│  │ tenant_databases table  │    │
│  │ • tenant_id             │    │
│  │ • database_name         │    │
│  │ • encrypted credentials │    │
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

### **Current Configuration Issues:**
1. **`.env`**: `TENANT_PLACEHOLDER_DB=placeholder_tenant_db` (hardcoded)
2. **`config/database.php`**: Uses static database name instead of dynamic switching
3. **`SecureSetupTokenService`**: Queries wrong database (`placeholder_tenant_db` instead of `tenant_uml`)
4. **Spatie Middleware**: Not active on `/setup/password/{token}` routes

### **Technical Stack:**
- **Framework**: Laravel 12.x
- **Database**: PostgreSQL 15+
- **Multi-tenancy**: Spatie/Laravel-Multitenancy
- **Encryption**: Laravel's built-in encryption for DB credentials

## **🔴 THE PROBLEM**

### **Core Issue:**
Password reset requests fail because database queries go to `placeholder_tenant_db` instead of actual tenant databases (`tenant_uml`, `tenant_nc`).

### **Symptoms:**
1. ✅ **Tenant provisioning works**: Creates `tenant_uml` database successfully
2. ✅ **User creation works**: Admin user created in `tenant_uml.tenant_users`
3. ✅ **Token generation works**: Setup tokens stored in landlord DB
4. ❌ **Password update fails**: `UPDATE` returns `0 rows` because it queries wrong DB
5. ❌ **Silent failure**: No error messages, just fails

### **Debug Evidence:**
```bash
# User EXISTS in PostgreSQL:
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d tenant_uml -c "SELECT * FROM tenant_users;"
# Returns: restaurant.namastenepal@gmail.com ✅

# But Laravel can't find it:
php artisan tinker --execute="DB::table('tenant_users')->where('email', 'restaurant.namastenepal@gmail.com')->first();"
# Returns: null ❌

# Because Laravel connects to:
php artisan tinker --execute="echo DB::connection('tenant')->getDatabaseName();"
# Returns: placeholder_tenant_db ❌ (should be tenant_uml)
```

## **🚀 SOLUTION ARCHITECTURE**

### **Phase 1: Immediate Fix (5 minutes)**
```bash
# Run direct PostgreSQL update
php artisan tinker --execute="
// Direct database update bypassing Laravel connection issues
require 'vendor/autoload.php';
\$app = require 'bootstrap/app.php';
\$kernel = \$app->make(Illuminate\\Contracts\\Console\\Kernel::class);
\$kernel->bootstrap();

use Illuminate\\Support\\Facades\\DB;

// 1. Get tenant database credentials
\$tenantDb = DB::table('tenant_databases')
    ->where('tenant_id', '7699fd1c-b7a2-4a0b-b158-5cb8299244dd')
    ->first();

\$decryptedPassword = decrypt(\$tenantDb->database_password);

// 2. Direct PostgreSQL connection
\$conn = pg_connect(sprintf(
    'host=%s port=%s dbname=%s user=%s password=%s',
    \$tenantDb->host,
    \$tenantDb->port,
    \$tenantDb->database_name,
    \$tenantDb->database_username,
    \$decryptedPassword
));

// 3. Update password
\$newPassword = 'Admin123!';
\$hashedPassword = bcrypt(\$newPassword);
pg_query_params(\$conn,
    'UPDATE tenant_users SET password_hash = \$1, must_change_password = false WHERE email = \$2',
    [\$hashedPassword, 'restaurant.namastenepal@gmail.com']
);

echo '✅ Password reset complete!';
echo 'New password: ' . \$newPassword;
"
```

### **Phase 2: Implement TenantDatabaseManager Service**

Create `app/Services/TenantDatabaseManager.php`:
```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

class TenantDatabaseManager
{
    private $activeTenant = null;
    
    /**
     * Switch to a specific tenant's database
     */
    public function switchToTenant(string $tenantId): void
    {
        $tenantDb = DB::table('tenant_databases')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['active', 'fallback'])
            ->first();
            
        if (!$tenantDb) {
            throw new \RuntimeException("No database configuration found for tenant: {$tenantId}");
        }
        
        $decryptedPassword = decrypt($tenantDb->database_password);
        
        // Dynamically configure the tenant connection
        Config::set('database.connections.tenant', [
            'driver' => 'pgsql',
            'host' => $tenantDb->host,
            'port' => $tenantDb->port,
            'database' => $tenantDb->database_name, // tenant_uml, tenant_nc, etc.
            'username' => $tenantDb->database_username,
            'password' => $decryptedPassword,
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ]);
        
        DB::purge('tenant');
        DB::reconnect('tenant');
        
        $this->activeTenant = $tenantId;
        
        Log::debug('Switched to tenant database', [
            'tenant_id' => $tenantId,
            'database' => $tenantDb->database_name,
        ]);
    }
    
    /**
     * Execute code within tenant context
     */
    public function executeOnTenant(string $tenantId, callable $callback)
    {
        $this->switchToTenant($tenantId);
        
        try {
            return $callback();
        } finally {
            $this->switchToLandlord();
        }
    }
}
```

### **Phase 3: Update SecureSetupTokenService**

Modify `app/Contexts/Platform/Application/Services/SecureSetupTokenService.php`:
```php
public function setAdminPassword(string $token, string $password): bool
{
    $tokenData = $this->validateToken($token);
    
    $dbManager = app(\App\Services\TenantDatabaseManager::class);
    
    return $dbManager->executeOnTenant($tokenData['tenantId'], function() use ($tokenData, $password) {
        $updated = DB::connection('tenant')
            ->table('tenant_users')
            ->where('email', $tokenData['email'])
            ->update([
                'password_hash' => bcrypt($password),
                'must_change_password' => false, // ← CRITICAL FIX
                'email_verified_at' => now(),
                'updated_at' => now(),
            ]);
            
        return $updated > 0;
    });
}
```

### **Phase 4: Fix Spatie Configuration**

Update `config/multitenancy.php`:
```php
'tenant_database' => [
    'connection_name' => 'tenant',
    
    'switch_tenant_database_to' => function ($tenant, $originalConnectionName) {
        // Get dynamic database name from tenant_databases table
        $tenantDb = DB::table('tenant_databases')
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['active', 'fallback'])
            ->first();
            
        if ($tenantDb) {
            config([
                "database.connections.{$originalConnectionName}.database" => $tenantDb->database_name
            ]);
            
            app('db')->purge($originalConnectionName);
            app('db')->reconnect($originalConnectionName);
        }
    },
],
```

## **🔍 DEBUG STEP BY STEP**

### **Step 1: Diagnose the Connection Issue**
```bash
# 1. Check current tenant connection
cd packages/laravel-backend
php artisan tinker --execute="
echo '=== Database Connection Debug ===' . PHP_EOL;
echo 'Default connection: ' . config('database.default') . PHP_EOL;
echo 'Tenant connection DB: ' . config('database.connections.tenant.database') . PHP_EOL;
echo 'Actual connected DB: ' . DB::connection('tenant')->getDatabaseName() . PHP_EOL;
echo 'Spatie current tenant: ' . (class_exists('Spatie\Multitenancy\Models\Tenant') ? 
    (Spatie\Multitenancy\Models\Tenant::current() ? 'SET' : 'NOT SET') : 'NOT INSTALLED') . PHP_EOL;
"

# 2. Check tenant_databases table
php artisan tinker --execute="
\$db = DB::table('tenant_databases')
    ->where('tenant_id', '7699fd1c-b7a2-4a0b-b158-5cb8299244dd')
    ->first();
    
if (\$db) {
    echo '✅ Tenant DB config found:' . PHP_EOL;
    echo '  Database: ' . \$db->database_name . PHP_EOL;
    echo '  Username: ' . \$db->database_username . PHP_EOL;
    echo '  Status: ' . \$db->status . PHP_EOL;
} else {
    echo '❌ No tenant DB config found' . PHP_EOL;
}
"

# 3. Test direct PostgreSQL access
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d tenant_uml -c "
SELECT 
    'User exists: ' || COUNT(*) as status,
    must_change_password,
    email_verified_at
FROM tenant_users 
WHERE email = 'restaurant.namastenepal@gmail.com';
"
```

### **Step 2: Verify Password Hash Compatibility**
```bash
# Check if bcrypt works between PHP and PostgreSQL
php -r "
echo 'Testing bcrypt generation...' . PHP_EOL;
\$hash = password_hash('Admin123!', PASSWORD_BCRYPT, ['cost' => 12]);
echo 'Hash: ' . substr(\$hash, 0, 30) . '...' . PHP_EOL;
echo 'Length: ' . strlen(\$hash) . PHP_EOL;
echo 'Verify: ' . (password_verify('Admin123!', \$hash) ? '✅ Works' : '❌ Fails') . PHP_EOL;
"
```

### **Step 3: Create Debug Route for Testing**
```php
// Add to routes/web.php (temporary)
Route::get('/debug/tenant-connection/{tenantId}', function($tenantId) {
    try {
        $dbManager = new \App\Services\TenantDatabaseManager();
        $dbManager->switchToTenant($tenantId);
        
        $dbName = DB::connection('tenant')->getDatabaseName();
        $userCount = DB::connection('tenant')->table('tenant_users')->count();
        
        return response()->json([
            'success' => true,
            'tenant_id' => $tenantId,
            'connected_database' => $dbName,
            'user_count' => $userCount,
            'users' => DB::connection('tenant')->table('tenant_users')->get()->toArray(),
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ], 500);
    }
});
```

### **Step 4: Test the Complete Flow**
```bash
# 1. Test token validation
TOKEN="eSyBez18DpHyE2SfH0aWU0wjqFIuuXqCP1G8xW3HyGjTrWTU6qiLwNAeYW2QHtqJ"
curl "http://localhost:8000/debug/token-validation/$TOKEN"

# 2. Test database switching
TENANT_ID="7699fd1c-b7a2-4a0b-b158-5cb8299244dd"
curl "http://localhost:8000/debug/tenant-connection/$TENANT_ID"

# 3. Manual password update test
php artisan tinker --execute="
use App\\Services\\TenantDatabaseManager;
use Illuminate\\Support\\Facades\\DB;

\$manager = new TenantDatabaseManager();

\$result = \$manager->executeOnTenant('7699fd1c-b7a2-4a0b-b158-5cb8299244dd', function() {
    return DB::connection('tenant')
        ->table('tenant_users')
        ->where('email', 'restaurant.namastenepal@gmail.com')
        ->update([
            'must_change_password' => false,
            'updated_at' => now(),
        ]);
});

echo 'Update result: ' . (\$result ? '✅ Success' : '❌ Failed') . PHP_EOL;
"
```

## **✅ VERIFICATION CHECKLIST**

After implementing fixes, verify:

1. **✅ Direct PostgreSQL connection works**
   ```bash
   PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d tenant_uml -c "SELECT 1;"
   ```

2. **✅ TenantDatabaseManager switches correctly**
   ```bash
   php artisan tinker --execute="
   \$manager = new App\\Services\\TenantDatabaseManager();
   \$manager->switchToTenant('7699fd1c-b7a2-4a0b-b158-5cb8299244dd');
   echo 'Connected to: ' . DB::connection('tenant')->getDatabaseName();
   "
   ```

3. **✅ Password update works through service**
   ```bash
   php artisan tinker --execute="
   \$service = app('App\\Contexts\\Platform\\Application\\Services\\SecureSetupTokenService');
   \$result = \$service->setAdminPassword('eSyBez18DpHyE2SfH0aWU0wjqFIuuXqCP1G8xW3HyGjTrWTU6qiLwNAeYW2QHtqJ', 'Admin123!');
   echo 'Password update: ' . (\$result ? '✅ Success' : '❌ Failed');
   "
   ```

4. **✅ User can login**
   - Navigate to: `http://uml.localhost:8000/login`
   - Email: `restaurant.namastenepal@gmail.com`
   - Password: `Admin123!`
   - Expected: ✅ Login successful

## **📋 ROOT CAUSE SUMMARY**

| **Layer** | **Problem** | **Solution** |
|-----------|------------|--------------|
| **.env Config** | `TENANT_PLACEHOLDER_DB=placeholder_tenant_db` (static) | Remove or make empty |
| **Spatie Config** | Hardcoded database switching | Dynamic lookup from `tenant_databases` table |
| **SecureSetupTokenService** | Uses default connection (wrong DB) | Use `TenantDatabaseManager` to switch context |
| **Setup Route** | No tenant context middleware | Add manual tenant switching |

## **🚨 CRITICAL FIXES REQUIRED**

### **1. MUST FIX: `must_change_password` flag**
The service updates password but doesn't set `must_change_password = false`, keeping user locked out.

### **2. MUST FIX: Database connection**
Queries go to `placeholder_tenant_db` instead of actual tenant database (`tenant_uml`).

### **3. SHOULD FIX: Error handling**
Silent failures should show clear error messages.

## **🎯 PRIORITY ORDER**

1. **IMMEDIATE (5 min)**: Direct PostgreSQL update to unlock user
2. **SHORT-TERM (30 min)**: Implement `TenantDatabaseManager`
3. **MEDIUM-TERM (2 hours)**: Update all services to use dynamic switching
4. **LONG-TERM (1 day)**: Refactor Spatie configuration for proper multi-tenancy

## **💡 KEY INSIGHTS**

- **Spatie Multitenancy** expects middleware-based context switching
- **Token-based routes** need manual tenant context setup
- **`placeholder_tenant_db`** should be a template name, not a real database
- **Database credentials** are encrypted in `tenant_databases` table and must be decrypted before use
- **PostgreSQL connections** need explicit reconnection after config changes

## **📞 WHEN TO ESCALATE**

If after implementing `TenantDatabaseManager` you still see:
- `0 rows updated` messages
- Connections to `placeholder_tenant_db`
- "User not found" errors when user exists in PostgreSQL

**Escalate by:**
1. Checking PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-15-main.log`
2. Enabling Laravel query logging: `DB::connection('tenant')->enableQueryLog()`
3. Testing with simple `SELECT 1` queries to verify connectivity

---

**Execution Time Estimate:** 45 minutes total
- **Phase 1 (Immediate fix):** 5 minutes
- **Phase 2 (Manager service):** 15 minutes  
- **Phase 3 (Update token service):** 10 minutes
- **Phase 4 (Testing & verification):** 15 minutes

**Success Criteria:** User can login with new password to tenant dashboard at `http://uml.localhost:8000`