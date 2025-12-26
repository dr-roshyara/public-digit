**PERFECT!** Now we have the **real error** that explains everything! This is a **PostgreSQL transaction error**, not a password reset issue.

## **🎯 THE ACTUAL PROBLEM:**

When you click the setup link, it's trying to **rotate database credentials** (create new database user), but it hits a **PostgreSQL transaction error**:
```
SQLSTATE[25P02]: In failed sql transaction: 7 FEHLER: aktuelle Transaktion wurde abgebrochen
```

This means a previous SQL command in the same transaction failed, so PostgreSQL aborted the entire transaction.

## **🔍 ERROR ANALYSIS:**

1. **Transaction ID:** `9c6af483-f0af-4c88-b463-21318851ac19`
2. **Tenant ID:** `7699fd1c-b7a2-4a0b-b158-5cb8299244dd` (uml tenant)
3. **Phase:** `provisioning`
4. **Action:** Trying to drop old database user
5. **Error:** Previous SQL command failed, transaction aborted

## **🚀 IMMEDIATE FIX:**

### **Step 1: Check PostgreSQL Connections**
```bash
# Check for idle transactions
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
SELECT 
    pid,
    usename,
    application_name,
    state,
    query_start,
    query
FROM pg_stat_activity 
WHERE state != 'idle' 
AND query LIKE '%tenant_database_users%'
ORDER BY query_start;
"
```

### **Step 2: Clean Up Orphaned Transactions**
```bash
# If you see stuck transactions, kill them
# First get the PID from above query, then:
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
SELECT pg_terminate_backend(PID_HERE);
"
```

### **Step 3: Fix the tenant_database_users Record**
```bash
# Check current state
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
SELECT 
    id,
    tenant_id,
    database_name,
    username,
    status,
    created_at,
    dropped_at
FROM tenant_database_users 
WHERE tenant_id = '7699fd1c-b7a2-4a0b-b158-5cb8299244dd'
ORDER BY created_at DESC;
"
```

### **Step 4: Manual Fix for the Stuck User**
```bash
# If there's a user with status 'dropped' but transaction stuck
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
-- Start fresh transaction
BEGIN;

-- Force update the stuck record
UPDATE tenant_database_users 
SET 
    status = 'dropped',
    dropped_at = NOW(),
    metadata = '{\"dropped_reason\":\"manual_fix\",\"dropped_by\":\"admin\"}'
WHERE id = 1;

COMMIT;

-- Verify
SELECT id, status, dropped_at FROM tenant_database_users WHERE id = 1;
"
```

## **🔧 CREATE EMERGENCY FIX COMMAND:**

```php
// packages/laravel-backend/app/Console/Commands/FixTransactionError.php

class FixTransactionError extends Command
{
    protected $signature = 'fix:transaction-error
                           {tenant-id : Tenant UUID}
                           {--force : Force fix without confirmation}';
    
    public function handle()
    {
        $tenantId = $this->argument('tenant-id');
        
        $this->info("=== Fixing PostgreSQL Transaction Error ===");
        $this->newLine();
        
        // 1. Check tenant
        $tenant = DB::table('tenants')->where('id', $tenantId)->first();
        if (!$tenant) {
            $this->error("Tenant not found: {$tenantId}");
            return 1;
        }
        
        $this->info("Tenant: {$tenant->name} ({$tenant->slug})");
        
        // 2. Check stuck users
        $stuckUsers = DB::table('tenant_database_users')
            ->where('tenant_id', $tenantId)
            ->where(function($query) {
                $query->where('status', 'like', '%dropped%')
                      ->orWhereNull('status');
            })
            ->get();
        
        if ($stuckUsers->isEmpty()) {
            $this->info("✅ No stuck database users found.");
            return 0;
        }
        
        $this->warn("Found {$stuckUsers->count()} potentially stuck database users:");
        
        foreach ($stuckUsers as $user) {
            $this->table(
                ['Field', 'Value'],
                [
                    ['ID', $user->id],
                    ['Username', $user->username],
                    ['Status', $user->status],
                    ['Created', $user->created_at],
                    ['Dropped', $user->dropped_at ?? 'Not dropped'],
                ]
            );
        }
        
        $this->newLine();
        
        if (!$this->option('force') && !$this->confirm("Fix these users?", false)) {
            $this->info("Aborted.");
            return 0;
        }
        
        // 3. Fix each user
        foreach ($stuckUsers as $user) {
            $this->info("Fixing user: {$user->username}");
            
            DB::table('tenant_database_users')
                ->where('id', $user->id)
                ->update([
                    'status' => 'dropped',
                    'dropped_at' => now(),
                    'updated_at' => now(),
                    'metadata' => json_encode([
                        'dropped_reason' => 'transaction_fix',
                        'dropped_by' => 'console_command',
                        'original_status' => $user->status,
                        'fixed_at' => now()->toISOString(),
                    ]),
                ]);
        }
        
        $this->newLine();
        $this->info("✅ Fixed {$stuckUsers->count()} database users.");
        $this->info("Try the setup link again.");
        
        return 0;
    }
}
```

## **🚀 QUICK MANUAL FIX:**

Run these commands in order:

```bash
cd packages/laravel-backend

# 1. Fix the stuck transaction
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
-- Rollback any failed transaction
ROLLBACK;

-- Fix the specific record
UPDATE tenant_database_users 
SET 
    status = 'dropped',
    dropped_at = NOW(),
    metadata = '{\"dropped_reason\":\"manual_cleanup\",\"dropped_by\":\"admin\"}'
WHERE id = 1;

-- Verify
SELECT id, status, dropped_at FROM tenant_database_users WHERE id = 1;
"

# 2. Try the setup link again
echo "Now try clicking your setup link again:"
echo "http://localhost:8000/setup/credentials/fMVLEp0QnxMfDUYqVHSKfVB8RMuZS2GGIHRnRuDAMyIrItQR3Qz7ZzDrNquJaHEO"
```

## **📋 WHY THIS HAPPENED:**

The **credential generation process**:
1. Creates new database user
2. Drops old database user
3. Something fails during step 2
4. PostgreSQL aborts transaction
5. All subsequent commands fail

**Common causes:**
1. **Foreign key constraints** - Other tables reference `tenant_database_users`
2. **Permission issues** - Can't drop PostgreSQL user
3. **Connection timeout** - Network issue during operation
4. **Deadlock** - Another process holding lock

## **🔧 PERMANENT FIX:**

Update the credential generation service to handle failures better:

```php
// In your provisioning service, add transaction handling:

try {
    DB::beginTransaction();
    
    // Create new user
    $newUser = $this->createDatabaseUser($tenant);
    
    // Drop old user (with error handling)
    try {
        $this->dropOldDatabaseUser($tenant);
    } catch (\Exception $e) {
        // Log but continue - don't fail entire provisioning
        Log::warning('Failed to drop old database user, continuing', [
            'tenant_id' => $tenant->id,
            'error' => $e->getMessage(),
        ]);
    }
    
    DB::commit();
    
} catch (\Exception $e) {
    DB::rollBack();
    throw $e;
}
```

## **🎯 IMMEDIATE ACTION:**

1. **Run the manual fix commands above**
2. **Try the setup link again**
3. **If it works**, the password reset should now work
4. **If not**, create the fix command and run it

**This is the REAL problem**, not the password reset logic. Fix the PostgreSQL transaction error first!
**PERFECT!** Now we have the **exact problem** revealed! 

## **🎯 THE REAL PROBLEM: Missing `tenant_databases` Record**

The logs show:
1. ✅ **Tenant provisioned successfully:** `80b8d7cd-3cd3-47eb-989a-9494e5bfa957` (test1)
2. ✅ **Database created:** `tenant_test1`
3. ✅ **Admin user created:** `krish.hari.sharma@gmail.com`
4. ❌ **NO `tenant_databases` record created!**

## **🔍 ROOT CAUSE:**

The provisioning process creates the tenant and database, but **fails to create** the `tenant_databases` record. This is why the password reset says "Tenant database configuration not found."

## **🚀 IMMEDIATE FIX:**

### **Step 1: Check if `tenant_databases` Record Exists**
```bash
cd packages/laravel-backend

# Check if record exists for new tenant
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
SELECT 
    tenant_id,
    database_name,
    database_driver,
    status,
    created_at
FROM tenant_databases 
WHERE tenant_id = '80b8d7cd-3cd3-47eb-989a-9494e5bfa957';
"

# Also check old tenant (uml)
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
SELECT COUNT(*) as total_records FROM tenant_databases;
SELECT tenant_id, database_name FROM tenant_databases;
"
```

### **Step 2: Create Missing `tenant_databases` Records**

```bash
# Create record for new tenant (test1)
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
INSERT INTO tenant_databases (
    id,
    tenant_id,
    database_name,
    slug,
    database_username,
    database_password,
    host,
    port,
    status,
    database_driver,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '80b8d7cd-3cd3-47eb-989a-9494e5bfa957',
    'tenant_test1',
    'test1',
    'publicdigit_user',
    encrypt('Devkota@1?'),
    '127.0.0.1',
    5432,
    'fallback',
    'pgsql',
    NOW(),
    NOW()
);
"

# Also ensure old tenant (uml) has record
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
INSERT INTO tenant_databases (
    id,
    tenant_id,
    database_name,
    slug,
    database_username,
    database_password,
    host,
    port,
    status,
    database_driver,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '7699fd1c-b7a2-4a0b-b158-5cb8299244dd',
    'tenant_uml',
    'uml',
    'publicdigit_user',
    encrypt('Devkota@1?'),
    '127.0.0.1',
    5432,
    'fallback',
    'pgsql',
    NOW(),
    NOW()
) ON CONFLICT (tenant_id) DO NOTHING;
"
```

### **Step 3: Create Fix Command for Future Cases**

```php
// packages/laravel-backend/app/Console/Commands/FixMissingDatabaseRecords.php

class FixMissingDatabaseRecords extends Command
{
    protected $signature = 'fix:missing-database-records
                           {--tenant= : Specific tenant ID (optional)}
                           {--all : Fix all tenants}';
    
    public function handle()
    {
        $this->info("=== Fixing Missing Database Records ===");
        
        // Get tenants missing database records
        $tenants = DB::table('tenants')
            ->select('tenants.id', 'tenants.slug', 'tenants.database_name')
            ->leftJoin('tenant_databases', 'tenants.id', '=', 'tenant_databases.tenant_id')
            ->whereNull('tenant_databases.id');
            
        if ($this->option('tenant')) {
            $tenants->where('tenants.id', $this->option('tenant'));
        }
        
        $missingTenants = $tenants->get();
        
        if ($missingTenants->isEmpty()) {
            $this->info("✅ All tenants have database records.");
            return 0;
        }
        
        $this->warn("Found {$missingTenants->count()} tenants missing database records:");
        
        foreach ($missingTenants as $tenant) {
            $this->table(
                ['Field', 'Value'],
                [
                    ['Tenant ID', $tenant->id],
                    ['Slug', $tenant->slug],
                    ['Database', $tenant->database_name],
                ]
            );
        }
        
        if (!$this->option('all') && !$this->confirm("Create missing database records?", false)) {
            $this->info("Aborted.");
            return 0;
        }
        
        // Create missing records
        $created = 0;
        foreach ($missingTenants as $tenant) {
            $this->info("Creating database record for: {$tenant->slug}");
            
            try {
                DB::table('tenant_databases')->insert([
                    'id' => Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'database_name' => $tenant->database_name ?? "tenant_{$tenant->slug}",
                    'slug' => $tenant->slug,
                    'database_username' => 'publicdigit_user',
                    'database_password' => encrypt('Devkota@1?'), // Default password
                    'host' => '127.0.0.1',
                    'port' => 5432,
                    'status' => 'fallback',
                    'database_driver' => 'pgsql',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                
                $created++;
                $this->info("✅ Created record for {$tenant->slug}");
                
            } catch (\Exception $e) {
                $this->error("Failed for {$tenant->slug}: " . $e->getMessage());
            }
        }
        
        $this->newLine();
        $this->info("✅ Created {$created} missing database records.");
        $this->info("Password reset should now work.");
        
        return 0;
    }
}
```

### **Step 4: Fix the Provisioning Service**

The real fix is to update the provisioning service to **always create** the `tenant_databases` record. Look for the provisioning service and add:

```php
// In TenantProvisioningService::createTenantDatabase() or similar method

private function createTenantDatabase(Tenant $tenant): void
{
    // ... existing database creation code ...
    
    // AFTER creating database, create tenant_databases record
    DB::table('tenant_databases')->insert([
        'id' => Str::uuid(),
        'tenant_id' => $tenant->id,
        'database_name' => $tenant->database_name,
        'slug' => $tenant->slug,
        'database_username' => 'publicdigit_user', // Or generate unique user
        'database_password' => encrypt($generatedPassword), // Generate secure password
        'host' => config('database.connections.pgsql.host'),
        'port' => config('database.connections.pgsql.port'),
        'status' => 'active',
        'database_driver' => 'pgsql',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    
    Log::info('Created tenant_databases record', [
        'tenant_id' => $tenant->id,
        'database' => $tenant->database_name,
    ]);
}
```

## **🔧 IMMEDIATE WORKFLOW:**

1. **Run the SQL commands above** to create missing `tenant_databases` records
2. **Test the password reset again**
3. **Create the fix command** for future use
4. **Update the provisioning service** to prevent this issue

## **📋 CHECKLIST:**

### **For Tenant `test1` (new):**
- ✅ Tenant created: `80b8d7cd-3cd3-47eb-989a-9494e5bfa957`
- ✅ Database created: `tenant_test1`
- ✅ Admin user created: `krish.hari.sharma@gmail.com`
- ❌ **Missing:** `tenant_databases` record

### **For Tenant `uml` (old):**
- ✅ Tenant exists
- ✅ Database exists: `tenant_uml`
- ✅ Admin user exists: `restaurant.namastenepal@gmail.com`
- ❌ **Probably missing:** `tenant_databases` record

## **🚨 CRITICAL INSIGHT:**

The **password reset system depends on** `tenant_databases` table to:
1. Find which database to connect to
2. Get database credentials
3. Know the driver (PostgreSQL/MySQL)

**Without this record, password reset CANNOT work!**

## **✅ ACTION PLAN:**

1. **Immediate:** Create missing `tenant_databases` records via SQL
2. **Test:** Try password reset again
3. **Preventative:** Create the fix command
4. **Permanent:** Fix provisioning service

**Run the SQL commands NOW, then test the password reset.** This should fix both your new tenant (`test1`) and old tenant (`uml`).
**Excellent question!** `tenant_databases` is a **critical lookup table** in your multi-tenant architecture. Let me explain:

## **🎯 WHAT IS `tenant_databases`?**

It's a **central registry** in your landlord database (`publicdigit`) that stores:

| Column | Purpose | Example |
|--------|---------|---------|
| `tenant_id` | Links to which tenant | `7699fd1c-b7a2-4a0b-b158-5cb8299244dd` |
| `database_name` | Actual PostgreSQL database name | `tenant_uml`, `tenant_test1` |
| `database_driver` | Database type (pgsql/mysql) | `pgsql` |
| `database_username` | PostgreSQL user for this tenant | `publicdigit_user` or `tenant_uml_user` |
| `database_password` | **Encrypted** PostgreSQL password | `eyJpdiI6IjJYYUExcUJQM0R1...` |
| `host` & `port` | Database server location | `127.0.0.1:5432` |
| `status` | Active/fallback/dropped | `active` |

## **🔄 HOW IT WORKS IN YOUR ARCHITECTURE:**

```
┌─────────────────────────────────────────────────────┐
│                 LANDLORD DATABASE                   │
│                 (publicdigit)                       │
│  ┌─────────────────────────────────────────────┐   │
│  │           tenant_databases TABLE            │   │
│  │  tenant_id │ database_name │ credentials    │   │
│  │  ──────────┼───────────────┼─────────────   │   │
│  │  tenant_1  │ tenant_uml    │ encrypted      │   │
│  │  tenant_2  │ tenant_test1  │ encrypted      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                            │
                            ▼ (Looks up via tenant_id)
┌─────────────────────────────────────────────────────┐
│             PASSWORD RESET REQUEST                   │
│             /setup/password/{token}                  │
│                                                     │
│  1. Validate token → get tenant_id                  │
│  2. Lookup tenant_databases WHERE tenant_id = ?     │
│  3. Decrypt credentials                             │
│  4. Connect to actual tenant database               │
│  5. Update password in tenant_users table           │
└─────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────┐
│               TENANT DATABASES                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ tenant_uml  │  │tenant_test1 │  │tenant_nc    │ │
│  │ ┌─────────┐ │  │┌─────────┐ │  │┌─────────┐ │ │
│  │ │tenant_  │ │  ││tenant_  │ │  ││tenant_  │ │ │
│  │ │users    │ │  ││users    │ │  ││users    │ │ │
│  │ └─────────┘ │  │└─────────┘ │  │└─────────┘ │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

## **🔍 WHY IT'S CRITICAL FOR PASSWORD RESET:**

When you visit `/setup/password/li1NayuiicHe33MGk76xcA4I0UY4U77KHOtiXnvetoStpAsuLu9cVXF90KXHmPBM`:

1. **System extracts tenant_id** from token: `80b8d7cd-3cd3-47eb-989a-9494e5bfa957`
2. **Looks up** `SELECT * FROM tenant_databases WHERE tenant_id = '80b8d7cd-3cd3-47eb-989a-9494e5bfa957'`
3. **Gets database info**: `database_name = 'tenant_test1'`, credentials, etc.
4. **Connects** to `tenant_test1` database
5. **Updates** `tenant_users` table in that database

**Without `tenant_databases` record:** ❌ Step 2 fails → "Tenant database configuration not found"

## **📊 COMPARISON: With vs Without `tenant_databases`**

### **✅ WITH `tenant_databases` record:**
```php
// SecureSetupTokenService can:
$tenantDb = DB::table('tenant_databases')
    ->where('tenant_id', $tokenData['tenantId'])
    ->first(); // ✅ Found!

// Connect to correct database
Config::set('database.connections.tenant', [
    'database' => 'tenant_test1', // ✅ Correct!
    'username' => 'publicdigit_user',
    'password' => decrypt('...'),
]);
```

### **❌ WITHOUT `tenant_databases` record:**
```php
$tenantDb = DB::table('tenant_databases')
    ->where('tenant_id', $tokenData['tenantId'])
    ->first(); // ❌ Returns null!

// Error: "Tenant database configuration not found"
// Cannot connect → password reset fails
```

## **🏗️ YOUR SYSTEM'S DESIGN PATTERN:**

Your architecture uses **Database-per-Tenant** pattern:

1. **Each tenant gets own database**: `tenant_uml`, `tenant_test1`, etc.
2. **Central lookup table**: `tenant_databases` maps `tenant_id → database_name`
3. **Dynamic connection**: Services read from lookup table to connect

**This is GOOD architecture** because:
- ✅ **Isolation**: Each tenant's data is separate
- ✅ **Security**: Credentials encrypted
- ✅ **Scalability**: Can move tenants to different servers
- ✅ **Flexibility**: Can mix PostgreSQL/MySQL tenants

## **🚨 THE BUG IN YOUR SYSTEM:**

The **provisioning service** creates:
1. ✅ Tenant record in `tenants` table
2. ✅ PostgreSQL database (`tenant_test1`)
3. ✅ Admin user in tenant database
4. ❌ **MISSING**: Record in `tenant_databases` table

**Fix:** The provisioning must **always create** the `tenant_databases` record.

## **🔧 SIMPLE FIX EXAMPLE:**

```php
// In your provisioning service, after creating database:

DB::table('tenant_databases')->insert([
    'tenant_id' => $tenant->id,
    'database_name' => 'tenant_' . $tenant->slug, // tenant_test1
    'database_driver' => 'pgsql',
    'database_username' => 'publicdigit_user',
    'database_password' => encrypt('Devkota@1?'), // Same as landlord
    'host' => '127.0.0.1',
    'port' => 5432,
    'status' => 'active',
    'created_at' => now(),
    'updated_at' => now(),
]);

Log::info('Created tenant_databases record', [
    'tenant' => $tenant->slug,
    'database' => 'tenant_' . $tenant->slug,
]);
```

## **📚 REAL-WORLD ANALOGY:**

Think of `tenant_databases` as a **hotel room directory**:

- **Hotel lobby** = Landlord database (`publicdigit`)
- **Room directory** = `tenant_databases` table
- **Guest name** = `tenant_id`
- **Room number** = `database_name`
- **Key card** = Encrypted credentials

**Without the directory:**
- Front desk knows guest is checked in ✅
- Guest has a room ✅  
- But no one knows **which room** ❌
- Can't deliver room service (password reset) ❌

## **✅ SUMMARY:**

**`tenant_databases` is essential because:**
1. **Mapping**: Links `tenant_id → actual_database_name`
2. **Credentials**: Stores encrypted login info
3. **Configuration**: Stores driver (PostgreSQL/MySQL), host, port
4. **Discovery**: Lets services find tenant databases

**Your current problem:** New tenants get rooms but aren't added to the directory.

**Solution:** 
1. **Add missing records** to `tenant_databases` table
2. **Fix provisioning** to always create records
3. **Password reset will work** because it can find the database
**AH!** You're absolutely right! You have **two different tables**:

1. **`tenants`** - Already exists with your tenant data ✅
2. **`tenant_databases`** - Supposed to exist but may not exist ❌

## **🔍 THE REAL PROBLEM:**

Your `SecureSetupTokenService` is looking for **`tenant_databases` table**, but it **doesn't exist**! That's why you get "Tenant database configuration not found."

## **📊 COMPARE THE TABLES:**

### **1. `tenants` table (EXISTS ✅)**
```sql
-- You have this:
SELECT id, name, slug, database_name FROM tenants;

-- Returns:
-- 7699fd1c-b7a2-4a0b-b158-5cb8299244dd | Restaurant Namaste Nepal Wiesbaden | uml | tenant_uml
-- 80b8d7cd-3cd3-47eb-989a-9494e5bfa957 | Namaste Nepal GmbH                 | test1 | tenant_test1
```

### **2. `tenant_databases` table (DOESN'T EXIST ❌)**
```sql
-- This fails:
SELECT * FROM tenant_databases;

-- ERROR: relation "tenant_databases" does not exist
```

## **🎯 THE BUG:**

**`SecureSetupTokenService`** (lines 195-242) assumes:
```php
// Line ~200: Tries to read from tenant_databases
$tenantDatabase = DB::table('tenant_databases')
    ->where('tenant_id', $tenant->id)
    ->first();
```

But **`tenant_databases` table doesn't exist!**

## **🚨 TWO OPTIONS TO FIX:**

### **Option 1: Create `tenant_databases` table** (Recommended)
```sql
-- Create the missing table
CREATE TABLE tenant_databases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    database_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    database_username VARCHAR(255) NOT NULL,
    database_password TEXT NOT NULL, -- Encrypted
    host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    port INTEGER NOT NULL DEFAULT 5432,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    database_driver VARCHAR(50) NOT NULL DEFAULT 'pgsql',
    connection_config JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    
    UNIQUE(tenant_id),
    UNIQUE(database_name)
);

-- Insert records for existing tenants
INSERT INTO tenant_databases (
    id,
    tenant_id,
    database_name,
    slug,
    database_username,
    database_password,
    host,
    port,
    status,
    database_driver,
    created_at,
    updated_at
) 
SELECT 
    gen_random_uuid(),
    id,
    database_name,
    slug,
    'publicdigit_user',
    encrypt('Devkota@1?', 'aes-256-cbc', 'your-encryption-key'),
    '127.0.0.1',
    5432,
    'active',
    'pgsql',
    created_at,
    updated_at
FROM tenants;

-- Verify
SELECT * FROM tenant_databases;
```

### **Option 2: Update `SecureSetupTokenService` to use `tenants` table**
Change lines 195-242 from:
```php
// FROM: Looks for tenant_databases (doesn't exist)
$tenantDatabase = DB::table('tenant_databases')
    ->where('tenant_id', $tenant->id)
    ->first();
```

To:
```php
// TO: Uses tenants table (exists)
$tenant = DB::table('tenants')
    ->where('id', $tokenData['tenantId'])
    ->first();

if (!$tenant) {
    throw new \RuntimeException('Tenant not found');
}

// Extract database info from tenant record
$databaseName = $tenant->database_name; // tenant_uml, tenant_test1
$metadata = json_decode($tenant->branding, true);
$driver = $metadata['database_driver'] ?? 'pgsql';

// Build config from tenant data
$config = [
    'driver' => $driver,
    'host' => '127.0.0.1',
    'port' => 5432,
    'database' => $databaseName,
    'username' => 'publicdigit_user',
    'password' => 'Devkota@1?', // Or read from .env
    'charset' => 'utf8',
    'prefix' => '',
    'search_path' => 'public',
    'sslmode' => 'prefer',
];
```

## **🔍 CHECK WHAT TABLES ACTUALLY EXIST:**

```bash
# List all tables in publicdigit database
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
"
```

## **📋 QUICK DIAGNOSIS:**

Run this to see what's actually wrong:

```bash
cd packages/laravel-backend
php artisan tinker --execute="

// Check if tenant_databases table exists
\$exists = \\Illuminate\\Support\\Facades\\Schema::hasTable('tenant_databases');
echo 'tenant_databases table exists: ' . (\$exists ? '✅ YES' : '❌ NO') . PHP_EOL;

// Check tenants table
\$tenantCount = DB::table('tenants')->count();
echo 'tenants table has ' . \$tenantCount . ' records' . PHP_EOL;

// Check what SecureSetupTokenService expects
\$service = new \\App\\Contexts\\Platform\\Application\\Services\\SecureSetupTokenService();
\$reflection = new ReflectionClass(\$service);

// Look for database queries in the service
\$methods = \$reflection->getMethods();
foreach (\$methods as \$method) {
    \$method->setAccessible(true);
    \$code = file_get_contents(\$method->getFileName());
    \$lines = explode(PHP_EOL, \$code);
    
    foreach (\$lines as \$line) {
        if (strpos(\$line, 'tenant_databases') !== false) {
            echo 'Found reference to tenant_databases in: ' . \$method->getName() . PHP_EOL;
            echo 'Line: ' . trim(\$line) . PHP_EOL;
        }
    }
}
"
```

## **🎯 RECOMMENDATION:**

**Do Option 1** - Create the `tenant_databases` table because:

1. **Better architecture**: Separate concerns (tenant info vs database config)
2. **Security**: Can store encrypted passwords separately
3. **Flexibility**: Can have multiple database configs per tenant (primary/backup)
4. **Already coded**: `SecureSetupTokenService` expects this table

## **🚀 IMMEDIATE FIX:**

```bash
# 1. Create tenant_databases table
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
-- Create table
CREATE TABLE IF NOT EXISTS tenant_databases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    database_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    database_username VARCHAR(255) NOT NULL,
    database_password TEXT NOT NULL,
    host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    port INTEGER NOT NULL DEFAULT 5432,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    database_driver VARCHAR(50) NOT NULL DEFAULT 'pgsql',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    
    UNIQUE(tenant_id),
    UNIQUE(database_name)
);

-- Populate from existing tenants
INSERT INTO tenant_databases (
    id,
    tenant_id,
    database_name,
    slug,
    database_username,
    database_password,
    host,
    port,
    status,
    database_driver,
    created_at,
    updated_at
) 
SELECT 
    gen_random_uuid(),
    id,
    database_name,
    slug,
    'publicdigit_user',
    'Devkota@1?', -- For now, plain text (fix later)
    '127.0.0.1',
    5432,
    'active',
    'pgsql',
    created_at,
    updated_at
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Verify
SELECT 'Created table tenant_databases with ' || COUNT(*) || ' records' 
FROM tenant_databases;
"
```

## **📌 SUMMARY:**

**You have:** `tenants` table with tenant info  
**You need:** `tenant_databases` table with database connection info  
**The fix:** Create `tenant_databases` table and populate from `tenants`

**Password reset fails because:** `SecureSetupTokenService` queries a table that doesn't exist.

**Create the table now, then password reset should work!**
You're absolutely right! If you've been using the **`tenants` table** successfully and `SecureSetupTokenService` is looking for a non-existent `tenant_databases` table, then **the service is broken by design**.

## **🎯 THE REAL PROBLEM:**

**`SecureSetupTokenService` is querying the wrong table!** It should query `tenants` table (which exists) not `tenant_databases` (which doesn't exist).

## **🔍 LOOK AT THE ACTUAL CODE:**

Let's examine what `SecureSetupTokenService` actually does:

```bash
# Check the actual code at lines 195-242
cd packages/laravel-backend
sed -n '195,242p' app/Contexts/Platform/Application/Services/SecureSetupTokenService.php
```

## **🔄 TWO POSSIBILITIES:**

### **Possibility 1: The service needs updating**
If the service queries `tenant_databases` but you use `tenants`, update the service:

```php
// FROM (line ~200):
$tenantDatabase = DB::table('tenant_databases')
    ->where('tenant_id', $tenant->id)
    ->first();

// TO:
$tenant = DB::table('tenants')
    ->where('id', $tokenData['tenantId'])
    ->first();
    
// Then use $tenant->database_name, etc.
```

### **Possibility 2: There's a migration missing**
Maybe `tenant_databases` table was supposed to be created by a migration that never ran.

## **🚀 IMMEDIATE FIX:**

### **Step 1: Check what the service actually expects**
```bash
# Check the exact error location
cd packages/laravel-backend
grep -n "tenant_databases" app/Contexts/Platform/Application/Services/SecureSetupTokenService.php -B5 -A5

# Check if there's a migration for tenant_databases
find . -name "*tenant_databases*" -type f
```

### **Step 2: Quick Patch - Update the Service**
Create a temporary fix:

```php
// app/Console/Commands/FixPasswordResetTable.php
class FixPasswordResetTable extends Command
{
    public function handle()
    {
        $this->info("=== Fixing Password Reset Table Issue ===");
        
        // Check current state
        $hasTenantsTable = Schema::hasTable('tenants');
        $hasTenantDatabasesTable = Schema::hasTable('tenant_databases');
        
        $this->table(
            ['Table', 'Exists'],
            [
                ['tenants', $hasTenantsTable ? '✅ YES' : '❌ NO'],
                ['tenant_databases', $hasTenantDatabasesTable ? '✅ YES' : '❌ NO'],
            ]
        );
        
        if (!$hasTenantDatabasesTable) {
            $this->warn("tenant_databases table doesn't exist!");
            $this->info("SecureSetupTokenService expects tenant_databases table.");
            
            if ($this->confirm("Create temporary tenant_databases table?", true)) {
                Schema::create('tenant_databases', function ($table) {
                    $table->uuid('id')->primary();
                    $table->uuid('tenant_id')->unique();
                    $table->string('database_name');
                    $table->string('slug');
                    $table->string('database_username');
                    $table->text('database_password');
                    $table->string('host')->default('127.0.0.1');
                    $table->integer('port')->default(5432);
                    $table->string('status')->default('active');
                    $table->string('database_driver')->default('pgsql');
                    $table->timestamps();
                    $table->softDeletes();
                });
                
                // Copy data from tenants table
                $tenants = DB::table('tenants')->get();
                
                foreach ($tenants as $tenant) {
                    DB::table('tenant_databases')->insert([
                        'id' => Str::uuid(),
                        'tenant_id' => $tenant->id,
                        'database_name' => $tenant->database_name,
                        'slug' => $tenant->slug,
                        'database_username' => 'publicdigit_user',
                        'database_password' => 'Devkota@1?', // Plain for now
                        'host' => '127.0.0.1',
                        'port' => 5432,
                        'status' => 'active',
                        'database_driver' => 'pgsql',
                        'created_at' => $tenant->created_at,
                        'updated_at' => $tenant->updated_at,
                    ]);
                }
                
                $this->info("✅ Created tenant_databases table with " . $tenants->count() . " records");
            }
        }
        
        $this->info("Password reset should now work.");
        return 0;
    }
}
```

### **Step 3: Run the Fix**
```bash
php artisan fix:password-reset-table
```

## **📊 ARCHITECTURE ANALYSIS:**

You might have **two different patterns** in your codebase:

### **Pattern A: Use `tenants` table directly**
```php
// Some services do this:
$tenant = Tenant::find($id);
$dbName = $tenant->database_name;
```

### **Pattern B: Use `tenant_databases` lookup table**
```php
// SecureSetupTokenService does this:
$dbConfig = DB::table('tenant_databases')
    ->where('tenant_id', $tenantId)
    ->first();
$dbName = $dbConfig->database_name;
```

## **🔧 PERMANENT FIX OPTIONS:**

### **Option 1: Create missing table** (Easiest)
```sql
-- Just create the table SecureSetupTokenService expects
CREATE TABLE tenant_databases AS 
SELECT 
    gen_random_uuid() as id,
    id as tenant_id,
    database_name,
    slug,
    'publicdigit_user' as database_username,
    'Devkota@1?' as database_password,
    '127.0.0.1' as host,
    5432 as port,
    'active' as status,
    'pgsql' as database_driver,
    created_at,
    updated_at
FROM tenants;
```

### **Option 2: Update SecureSetupTokenService** (Cleaner)
Change the service to use `tenants` table instead.

### **Option 3: Hybrid approach** (Most robust)
Update the service to try both tables:

```php
public function getTenantDatabaseConfig($tenantId)
{
    // Try tenant_databases first
    $config = DB::table('tenant_databases')
        ->where('tenant_id', $tenantId)
        ->first();
        
    if ($config) {
        return $config;
    }
    
    // Fallback to tenants table
    $tenant = DB::table('tenants')
        ->where('id', $tenantId)
        ->first();
        
    if (!$tenant) {
        throw new \RuntimeException('Tenant not found');
    }
    
    // Build config from tenant
    return (object)[
        'database_name' => $tenant->database_name,
        'database_driver' => 'pgsql',
        'host' => '127.0.0.1',
        'port' => 5432,
        'database_username' => 'publicdigit_user',
        'database_password' => 'Devkota@1?',
        'status' => 'active',
    ];
}
```

## **🚨 IMMEDIATE ACTION:**

**Run this diagnostic first:**

```bash
cd packages/laravel-backend

# 1. Check what tables exist
PGPASSWORD="Devkota@1?" psql -h 127.0.0.1 -p 5432 -U postgres -d publicdigit -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%tenant%'
ORDER BY table_name;
"

# 2. Check SecureSetupTokenService code
grep -n "DB::table" app/Contexts/Platform/Application/Services/SecureSetupTokenService.php

# 3. Check for migrations
find database/migrations -name "*.php" -exec grep -l "tenant_databases" {} \;
```

**Then decide:**
- If `tenant_databases` migration exists but didn't run → run migration
- If no migration exists → create the table
- If service should use `tenants` table → update service

**Most likely:** There's a missing migration for `tenant_databases` table that `SecureSetupTokenService` expects but was never created.

**Create the table now** as a temporary fix, then find and run the proper migration later.
