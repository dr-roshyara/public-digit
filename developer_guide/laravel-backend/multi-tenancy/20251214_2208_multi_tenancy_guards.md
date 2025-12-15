# **TENANT PROVISIONING DEVELOPER GUIDE**

## **📋 Table of Contents**
1. [Overview & Architecture](#overview--architecture)
2. [Safety System Components](#safety-system-components)
3. [Development Workflows](#development-workflows)
4. [Debugging & Troubleshooting](#debugging--troubleshooting)
5. [Database Safety](#database-safety)
6. [Code Review Standards](#code-review-standards)
7. [Production Monitoring](#production-monitoring)
8. [Common Tasks & Examples](#common-tasks--examples)
9. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## **1. OVERVIEW & ARCHITECTURE**

### **The Problem We Solved**
Tenant provisioning had a critical bug: **applicants weren't being added as admin users** in tenant databases after approval. The root causes were:
- Missing `first_name` and `last_name` fields in data flow
- Field name mismatches (`organization_name` vs `name`)
- No safety mechanisms to prevent similar bugs

### **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TENANT PROVISIONING FLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────────────┐     ┌──────────────┐  │
│  │ APPLICATION │────▶│  PLATFORM CONTEXT   │────▶│ TENANTAUTH   │  │
│  │   SUBMIT    │     │   (Orchestration)   │     │   CONTEXT    │  │
│  └─────────────┘     └─────────────────────┘     └──────────────┘  │
│         │                    │                            │         │
│         ▼                    ▼                            ▼         │
│  ┌─────────────┐     ┌─────────────────────┐     ┌──────────────┐  │
│  │ tenant_     │     │ ProvisionTenantJob  │     │ Tenant DB    │  │
│  │ applications│     │  (Background Job)   │     │ Operations   │  │
│  └─────────────┘     └─────────────────────┘     └──────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    SAFETY LAYER                              │  │
│  │  • TenantProvisioningGuard   • SafeTenantDatabaseSelector    │  │
│  │  • Production Monitoring      • Code Review Checklist        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### **Context Boundaries**

| **Platform Context** | **TenantAuth Context** |
|----------------------|------------------------|
| Tenant applications | Tenant database operations |
| Provisioning orchestration | User management within tenant |
| Main database (`election`) | Tenant databases (`tenant_{slug}`) |
| Event dispatching | Authentication/Authorization |
| **DOES NOT:** Access tenant DBs | **DOES NOT:** Handle applications |

### **Database Separation**

```
┌─────────────────┐        ┌─────────────────┐
│  LANDLORD DB    │        │   TENANT DB     │
│   (election)    │        │  (tenant_{slug})│
├─────────────────┤        ├─────────────────┤
│ • tenants       │        │ • tenant_users  │
│ • applications  │        │ • tenant_data   │
│ • setup_tokens  │        │ • tenant_tables │
└─────────────────┘        └─────────────────┘
      │                            ▲
      └────────────────────────────┘
       SafeTenantDatabaseSelector
```

---

## **2. SAFETY SYSTEM COMPONENTS**

### **2.1 TenantProvisioningGuard**
**Location:** `app/Contexts/Platform/Application/Services/TenantProvisioningGuard.php`

**Purpose:** Validates everything is in the right state before provisioning.

**Key Methods:**
```php
// 1. Validate context and connections
TenantProvisioningGuard::validateProvisioningFlow();

// 2. Validate data structure
TenantProvisioningGuard::validateProvisioningData([
    'first_name' => 'John',
    'last_name' => 'Doe',
    'admin_email' => 'john@example.com',
    'organization_name' => 'Acme Corp',
    'slug' => 'acme'
]);

// 3. Validate database switch
TenantProvisioningGuard::validateTenantDatabaseSwitch('acme');
```

**What it validates:**
- ✅ Correct database connection (must be `mysql`, not `tenant`)
- ✅ Not in tenant database context during provisioning
- ✅ All required fields present and valid
- ✅ Email format is valid
- ✅ Slug format is valid (`/^[a-z0-9-]+$/`)
- ✅ Tenant exists before switching to its database
- ✅ Database exists before switching

### **2.2 SafeTenantDatabaseSelector**
**Location:** `app/Contexts/TenantAuth/Infrastructure/Database/SafeTenantDatabaseSelector.php`

**Purpose:** Safe, validated switching to tenant databases.

**Key Methods:**
```php
// 1. Safe switching (with pre-flight checks)
SafeTenantDatabaseSelector::switchToTenant('acme');

// 2. Get current state
$currentDb = SafeTenantDatabaseSelector::getCurrentTenantDatabase();
$isConnected = SafeTenantDatabaseSelector::isConnectedToTenant();

// 3. Debug history
$history = SafeTenantDatabaseSelector::getSelectionHistory();
SafeTenantDatabaseSelector::clearSelectionHistory();
```

**What it does:**
1. **Pre-flight check:** Validates tenant exists in landlord DB
2. **Pre-flight check:** Validates database exists in MySQL
3. **Safe configuration:** Updates config without side effects
4. **Clean switching:** Purges and reconnects connection
5. **History tracking:** Records every switch for debugging

### **2.3 TenantSafeDebug CLI Command**
**Location:** `app/Console/Commands/TenantSafeDebug.php`

**Purpose:** Safe debugging and repair of tenants.

**Usage:**
```bash
# View tenant information
php artisan tenant:debug acme --action=view

# Run tenant migrations (requires confirmation)
php artisan tenant:debug acme --action=repair

# Create/repair admin user (requires confirmation)
php artisan tenant:debug acme --action=fix-admin

# View database switch history
php artisan tenant:debug acme --action=list-history

# Clear switch history (requires confirmation)
php artisan tenant:debug acme --action=reset-history
```

### **2.4 Production Monitoring**
**Location:** `app/Providers/AppServiceProvider.php` (lines 61-167)

**What it monitors:**
1. **Direct tenant queries** (bypassing safe selector)
2. **Context violations** (Platform context accessing tenant DB)
3. **Unsafe database switching** (direct `config()` calls)

**Example log output:**
```
[2025-12-14 19:54:26] production.WARNING: Direct tenant database query detected (bypassing SafeTenantDatabaseSelector) {
    "sql": "SELECT * FROM tenant_users WHERE email = ?",
    "connection": "tenant",
    "caller": {"file": "SomeController.php", "line": 42, "class": "App\\Http\\Controllers\\SomeController"},
    "note": "All tenant database access should use SafeTenantDatabaseSelector"
}
```

---

## **3. DEVELOPMENT WORKFLOWS**

### **3.1 Creating New Tenant-Related Code**

**Step 1: Determine the Context**
```php
// Is this about applications? → Platform Context
// Is this about tenant data? → TenantAuth Context
// Never mix them!
```

**Step 2: Add Safety Guards**
```php
// In Platform Context code:
use App\Contexts\Platform\Application\Services\TenantProvisioningGuard;

public function someMethod()
{
    // Validate context first
    TenantProvisioningGuard::validateProvisioningFlow();
    
    // Validate data if applicable
    TenantProvisioningGuard::validateProvisioningData($data);
    
    // Your logic here...
}
```

**Step 3: Safe Database Access**
```php
// In TenantAuth Context code:
use App\Contexts\TenantAuth\Infrastructure\Database\SafeTenantDatabaseSelector;

public function someTenantOperation(string $tenantSlug)
{
    // ALWAYS use safe selector
    SafeTenantDatabaseSelector::switchToTenant($tenantSlug);
    
    // Now you can query tenant database
    $users = DB::connection('tenant')->table('tenant_users')->get();
    
    // Your logic here...
}
```

### **3.2 Required Data Flow**

**When provisioning a tenant, you MUST pass:**

```php
$tenantData = [
    // From application contact
    'first_name' => $application->getFirstName(),
    'last_name' => $application->getLastName(),
    'admin_email' => $application->getContactEmail()->toString(),
    
    // From application organization
    'organization_name' => $application->getOrganizationName(),
    'slug' => $application->getRequestedSlug(),
    
    // Additional
    'organization_type' => $application->getOrganizationType()->toString(),
    'provisioned_by' => $provisionerId
];
```

**Validation Rules:**
- `first_name`, `last_name`: Required, non-empty strings
- `admin_email`: Valid email format, required
- `organization_name`: Required, non-empty
- `slug`: Lowercase letters, numbers, hyphens only (`^[a-z0-9-]+$`)

### **3.3 Modifying Existing Code**

**Before:**
```php
// ❌ UNSAFE - Direct configuration
config(['database.connections.tenant.database' => "tenant_{$slug}"]);
DB::purge('tenant');
DB::reconnect('tenant');
```

**After:**
```php
// ✅ SAFE - Using selector
use App\Contexts\TenantAuth\Infrastructure\Database\SafeTenantDatabaseSelector;

SafeTenantDatabaseSelector::switchToTenant($slug);
// That's it! All validation and safety built-in
```

---

## **4. DEBUGGING & TROUBLESHOOTING**

### **4.1 Using TenantSafeDebug Command**

**Basic Debugging:**
```bash
# Get complete tenant overview
php artisan tenant:debug acme --action=view

# Output includes:
# - Landlord database info (tenants table)
# - Tenant database connection status
# - Table counts
# - User counts
# - Admin user details (if exists)
```

**Repair Operations:**
```bash
# Run tenant migrations (will ask for confirmation)
php artisan tenant:debug acme --action=repair

# Create missing admin user (will ask for confirmation)
php artisan tenant:debug acme --action=fix-admin
```

**Diagnostics:**
```bash
# See who's switching databases and when
php artisan tenant:debug acme --action=list-history

# Example output:
# +---+-------------+----------------+----------------------------+----------------+----------------+
# | # | Tenant Slug | Database       | Timestamp                 | Called From    | File           |
# +---+-------------+----------------+----------------------------+----------------+----------------+
# | 1 | acme        | tenant_acme    | 2025-12-14T19:54:26.123Z  | handleViewAction | TenantSafeDebug.php |
# +---+-------------+----------------+----------------------------+----------------+----------------+
```

### **4.2 Reading Logs for Debugging**

**Look for these patterns:**
```bash
# Safety guard messages
tail -f storage/logs/laravel.log | grep -i "safety guard\|validation"

# Database switching
tail -f storage/logs/laravel.log | grep -i "switch.*tenant\|selector"

# Critical errors
tail -f storage/logs/laravel.log | grep -i "critical\|error.*tenant"

# Production monitoring warnings
tail -f storage/logs/laravel.log | grep -i "warning.*tenant\|monitor.*tenant"
```

**Example debug session:**
```bash
# 1. Check if tenant exists in landlord
mysql -u root -p -e "USE election; SELECT * FROM tenants WHERE slug = 'acme';"

# 2. Check if database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'tenant_acme';"

# 3. Use CLI to debug
php artisan tenant:debug acme --action=view

# 4. Check logs for recent activity
tail -n 100 storage/logs/laravel.log | grep -i "acme"

# 5. If admin user missing, fix it
php artisan tenant:debug acme --action=fix-admin
```

### **4.3 Common Debug Scenarios**

**Scenario 1: "Admin user not found"**
```bash
# 1. Check if user exists in tenant DB
php artisan tenant:debug acme --action=view

# 2. If missing, create it
php artisan tenant:debug acme --action=fix-admin

# 3. Verify creation
php artisan tenant:debug acme --action=view
```

**Scenario 2: "Database connection failed"**
```bash
# 1. Check landlord record exists
php artisan tinker
>>> \App\Models\Tenant::where('slug', 'acme')->first();

# 2. Check database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'tenant_acme';"

# 3. Try safe switch in tinker
>>> use App\Contexts\TenantAuth\Infrastructure\Database\SafeTenantDatabaseSelector;
>>> SafeTenantDatabaseSelector::switchToTenant('acme');
```

**Scenario 3: "Validation failed"**
```bash
# Check logs for specific validation error
tail -n 50 storage/logs/laravel.log | grep -B5 -A5 "validation.*failed"

# Test validation manually
php artisan tinker
>>> use App\Contexts\Platform\Application\Services\TenantProvisioningGuard;
>>> $data = ['first_name' => 'Test', ...]; // Your data
>>> TenantProvisioningGuard::validateProvisioningData($data);
```

### **4.4 Using Tinker for Debugging**

**Quick validations:**
```php
php artisan tinker

// Test provisioning flow validation
>>> use App\Contexts\Platform\Application\Services\TenantProvisioningGuard;
>>> TenantProvisioningGuard::validateProvisioningFlow();

// Test data validation
>>> $testData = [
    'first_name' => 'Test',
    'last_name' => 'User',
    'admin_email' => 'test@example.com',
    'organization_name' => 'Test Corp',
    'slug' => 'test-corp'
];
>>> TenantProvisioningGuard::validateProvisioningData($testData);

// Test safe database switching
>>> use App\Contexts\TenantAuth\Infrastructure\Database\SafeTenantDatabaseSelector;
>>> SafeTenantDatabaseSelector::switchToTenant('um1');
>>> DB::connection('tenant')->table('tenant_users')->count();
```

---

## **5. DATABASE SAFETY**

### **5.1 Golden Rules**

**✅ DO:**
```php
// Use safe selector for ALL tenant DB access
SafeTenantDatabaseSelector::switchToTenant($slug);

// Use after switching
DB::connection('tenant')->table('tenant_users')->get();
```

**❌ DO NOT:**
```php
// Never configure tenant connection directly
config(['database.connections.tenant.database' => "tenant_{$slug}"]);

// Never use DB::connection('tenant') without switching first
DB::connection('tenant')->... // WRONG without switchToTenant()

// Never access tenant DB from Platform context
// Platform context should only use main DB
```

### **5.2 Connection Lifecycle**

**Correct Pattern:**
```php
public function doTenantOperation(string $tenantSlug)
{
    // 1. Switch safely (includes validation)
    SafeTenantDatabaseSelector::switchToTenant($tenantSlug);
    
    // 2. Perform operations
    $result = DB::connection('tenant')->table('some_table')->get();
    
    // 3. Connection automatically persists for this request
    // No need to "switch back" - Laravel handles connections
    
    return $result;
}
```

### **5.3 Testing Database Safety**

**Unit Test Example:**
```php
public function test_safe_database_switching()
{
    // Should fail - tenant doesn't exist
    $this->expectException(Exception::class);
    SafeTenantDatabaseSelector::switchToTenant('nonexistent');
    
    // Should succeed - tenant exists
    SafeTenantDatabaseSelector::switchToTenant('um1');
    
    // Verify connection
    $this->assertTrue(SafeTenantDatabaseSelector::isConnectedToTenant());
    $this->assertEquals(
        'tenant_um1',
        SafeTenantDatabaseSelector::getCurrentTenantDatabase()
    );
}
```

---

## **6. CODE REVIEW STANDARDS**

### **6.1 Mandatory Checklist**
Always review `.tenant-provisioning-checklist.md` before merging. Key sections:

**Data Flow:**
- [ ] `first_name`, `last_name`, `admin_email`, `organization_name`, `slug` passed
- [ ] Email and slug format validated
- [ ] `TenantProvisioningGuard::validateProvisioningData()` called

**Database Safety:**
- [ ] Uses `SafeTenantDatabaseSelector::switchToTenant()`
- [ ] NO direct `config()` calls for tenant DB
- [ ] Context boundaries respected

**Error Handling:**
- [ ] Transactions with rollback
- [ ] Comprehensive logging with caller info
- [ ] NO silent failures

### **6.2 Common Code Review Comments**

**If you see this:**
```php
// ❌ Bad - Direct configuration
config(['database.connections.tenant.database' => "tenant_{$slug}"]);
```

**Comment this:**
```
❌ UNSAFE DATABASE SWITCHING DETECTED

Please use SafeTenantDatabaseSelector instead:
```php
use App\Contexts\TenantAuth\Infrastructure\Database\SafeTenantDatabaseSelector;
SafeTenantDatabaseSelector::switchToTenant($slug);
```

This ensures:
1. Tenant exists validation
2. Database exists validation  
3. Safe connection switching
4. Audit logging
```

**If you see this:**
```php
// ❌ Bad - Platform context accessing tenant DB
class PlatformContextService
{
    public function someMethod()
    {
        DB::connection('tenant')->... // WRONG!
    }
}
```

**Comment this:**
```
❌ CONTEXT BOUNDARY VIOLATION

Platform context should NEVER directly access tenant databases.

Responsibilities:
- Platform Context: Applications, orchestration, main DB operations
- TenantAuth Context: Tenant database operations

Please move this logic to TenantAuth context or use proper abstraction.
```

---

## **7. PRODUCTION MONITORING**

### **7.1 What Gets Monitored**

**In production/staging environments only:**

1. **Direct tenant queries:**
   ```sql
   SELECT * FROM tenant_users WHERE ...  # Triggers warning
   SELECT * FROM tenant_applications ... # OK (landlord table)
   ```

2. **Context violations:**
   ```php
   // If code in Platform namespace uses 'tenant' connection
   namespace App\Contexts\Platform;
   DB::connection('tenant')->...  # Triggers warning
   ```

3. **Unsafe switching:**
   ```php
   config(['database.connections.tenant.database' => ...])  # Triggers warning
   ```

### **7.2 Responding to Warnings**

**If you see this in logs:**
```
[WARNING] Direct tenant database query detected
```

**Investigation steps:**
1. **Find the code:** Use caller information in log
2. **Check context:** Is it Platform or TenantAuth?
3. **Fix:** Replace with `SafeTenantDatabaseSelector`

**Example fix:**
```php
// Before (triggers warning):
DB::connection('tenant')->table('tenant_users')->where(...)->get();

// After (safe):
use App\Contexts\TenantAuth\Infrastructure\Database\SafeTenantDatabaseSelector;

SafeTenantDatabaseSelector::switchToTenant($tenantSlug);
DB::connection('tenant')->table('tenant_users')->where(...)->get();
```

---

## **8. COMMON TASKS & EXAMPLES**

### **8.1 Creating a New Tenant Service**

**Step-by-step:**
```php
<?php

namespace App\Contexts\TenantAuth\Application\Services;

use App\Contexts\TenantAuth\Infrastructure\Database\SafeTenantDatabaseSelector;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TenantUserService
{
    public function getUsers(string $tenantSlug): array
    {
        // 1. Always switch safely first
        SafeTenantDatabaseSelector::switchToTenant($tenantSlug);
        
        // 2. Log for audit trail
        Log::info('Fetching users for tenant', [
            'tenant_slug' => $tenantSlug,
            'caller' => $this->getCallerInfo()
        ]);
        
        // 3. Perform tenant database operations
        return DB::connection('tenant')
            ->table('tenant_users')
            ->get()
            ->toArray();
    }
    
    private function getCallerInfo(): array
    {
        $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 3);
        $caller = $backtrace[2] ?? $backtrace[1] ?? $backtrace[0] ?? [];
        
        return [
            'file' => $caller['file'] ?? 'unknown',
            'line' => $caller['line'] ?? 0,
            'function' => $caller['function'] ?? 'unknown',
            'class' => $caller['class'] ?? 'unknown'
        ];
    }
}
```

### **8.2 Adding New Fields to Provisioning**

**If you need to add a new field (e.g., `phone_number`):**

1. **Update TenantProvisioningGuard:**
```php
// In validateProvisioningData() method:
$requiredFields = [
    'first_name', 'last_name', 'admin_email', 
    'organization_name', 'slug', 'phone_number'  // Added
];
```

2. **Update ProvisionTenantJob:**
```php
$tenantData = [
    // Existing fields...
    'phone_number' => $application->getContactPhone(), // New field
];
```

3. **Update validation in guard:**
```php
// Add phone validation if needed
if (!empty($tenantData['phone_number'])) {
    // Your phone validation logic
}
```

### **8.3 Testing the Complete Flow**

**Integration test example:**
```php
public function test_complete_tenant_provisioning_flow()
{
    // 1. Create application
    $application = $this->createTestApplication();
    
    // 2. Approve
    $this->approveApplication($application);
    
    // 3. Trigger provisioning job
    $job = new ProvisionTenantJob($application->id, 'test-admin');
    $job->handle(...);
    
    // 4. Verify safety guards passed
    $log = Storage::get('logs/laravel.log');
    $this->assertStringContainsString('Safety guard: Provisioning flow validation passed', $log);
    $this->assertStringContainsString('Safety guard: Provisioning data validation passed', $log);
    
    // 5. Verify tenant created
    $this->assertDatabaseHas('tenants', [
        'slug' => $application->requested_slug,
        'email' => $application->contact_email
    ]);
    
    // 6. Verify admin user in tenant DB
    SafeTenantDatabaseSelector::switchToTenant($application->requested_slug);
    $this->assertDatabaseHas('tenant_users', [
        'email' => $application->contact_email
    ]);
}
```

---

## **9. FAQ & TROUBLESHOOTING**

### **Q1: I'm getting "Tenant validation failed" error**
**A:** Check:
1. Does tenant exist in `tenants` table? `SELECT * FROM tenants WHERE slug = 'yourslug'`
2. Is tenant deleted? Check `deleted_at` is NULL
3. Use: `php artisan tenant:debug yourslug --action=view`

### **Q2: "Database validation failed" error**
**A:** Check:
1. Does database exist? `SHOW DATABASES LIKE 'tenant_yourslug'`
2. If not, tenant wasn't fully provisioned
3. Fix: Re-run provisioning or use `--action=repair` (with caution)

### **Q3: Safety guard fails in production but works locally**
**A:** Likely context issue:
1. Check `config('database.default')` - must be `mysql` for provisioning
2. Check you're not in tenant connection during provisioning
3. Check logs for specific error from `TenantProvisioningGuard`

### **Q4: How to temporarily bypass safety for emergency fix?**
**A:** DON'T! Instead:
1. Use `TenantSafeDebug --action=fix-admin` for user issues
2. Use `--action=repair` for migration issues
3. If absolutely necessary, modify code but REVERT immediately after

### **Q5: I need to query multiple tenant databases**
**A:** Pattern:
```php
foreach ($tenantSlugs as $slug) {
    SafeTenantDatabaseSelector::switchToTenant($slug);
    // Do operations...
    // Connection automatically handles switching
}
```

### **Q6: How to add logging to my tenant operations?**
**A:** Always include caller info:
```php
Log::info('Tenant operation performed', [
    'tenant_slug' => $slug,
    'operation' => 'user_update',
    'caller' => debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2)[1]
]);
```

### **Q7: My tests are failing with safety guards**
**A:** In tests:
```php
// Mock the guard if needed
$this->mock(TenantProvisioningGuard::class, function ($mock) {
    $mock->shouldReceive('validateProvisioningFlow')->once();
    $mock->shouldReceive('validateProvisioningData')->once();
});

// Or disable for specific tests
Config::set('app.tenant_safety_disabled', true); // Add config check in guard
```

### **Q8: How to handle tenant-specific configuration?**
**A:** Store in tenant database, not config:
```php
// ❌ Wrong - in config files
'tenant_config' => ['acme' => [...]];

// ✅ Right - in tenant database
SafeTenantDatabaseSelector::switchToTenant('acme');
$config = DB::connection('tenant')->table('tenant_config')->first();
```

---

## **🚀 QUICK REFERENCE CARD**

### **Essential Commands:**
```bash
# Debug tenant
php artisan tenant:debug {slug} --action=view

# Run migrations
php artisan tenant:debug {slug} --action=repair

# Fix admin user  
php artisan tenant:debug {slug} --action=fix-admin

# Check logs
tail -f storage/logs/laravel.log | grep -i "tenant\|safety\|guard"
```

### **Essential Code Patterns:**
```php
// Always validate first
TenantProvisioningGuard::validateProvisioningData($data);

// Always switch safely
SafeTenantDatabaseSelector::switchToTenant($slug);

// Always log with context
Log::info('Operation', ['tenant' => $slug, 'caller' => debug_backtrace(...)]);
```

### **Emergency Contacts:**
- **Validation Issues:** Check `TenantProvisioningGuard` logs
- **Database Issues:** Use `TenantSafeDebug --action=view`
- **Production Warnings:** Check `AppServiceProvider` monitoring logs
- **Architecture Questions:** Refer to bounded context diagrams

---

**Remember:** The safety system is there to PREVENT bugs, not make life difficult. If something feels hard or wrong, you're probably trying to bypass a safety mechanism. Step back and follow the patterns. ✅

**Last Updated:** 2025-12-14  
**Maintainer:** Platform Engineering Team  
**Status:** **PRODUCTION READY** 🚀