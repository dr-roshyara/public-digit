# 🏗️ **ARCHITECTURAL DECISION: TEST MIGRATION STRATEGY**

## **✅ RECOMMENDED SOLUTION: Option B - Register in TestCase**

```php
// In packages/laravel-backend/tests/TestCase.php
protected function defineDatabaseMigrations(): void
{
    // Platform/System migrations (default)
    $this->loadMigrationsFrom(database_path('migrations'));
    
    // DDD Context migrations
    $this->loadMigrationsFrom([
        // Geography Context (Landlord DB)
        app_path('Contexts/Geography/Infrastructure/Database/Migrations'),
        
        // Membership Context (Tenant DBs - needs tenant switching)
        app_path('Contexts/Membership/Infrastructure/Database/Migrations'),
    ]);
}
```

## **🔍 BUT THERE'S A BIGGER ISSUE:**

**Membership migrations run in TENANT databases, not default connection.**  
**Geography migrations run in LANDLORD database.**

**We need a TWO-STEP approach:**

### **Step 1: Geography Tests (Landlord DB)**
```php
// tests/Feature/Geography/*Test.php
protected function setUp(): void
{
    parent::setUp();
    config(['database.default' => 'landlord']);
}
```

### **Step 2: Membership Tests (Tenant DB)**
```php
// tests/Feature/Membership/*Test.php  
protected function setUp(): void
{
    parent::setUp();
    
    // 1. Create test tenant database
    // 2. Switch to tenant connection
    // 3. Run membership migrations in tenant DB
}
```

## **🚨 CHECK EXISTING PATTERN FIRST:**

**Before deciding, check how TenantAuth context handles this:**

```bash
cd packages/laravel-backend

# Check existing test patterns
grep -r "RefreshDatabase" tests/Feature/TenantAuth/ || echo "No TenantAuth tests found"

# Check how tenant switching works
grep -r "Tenant::current" tests/ || echo "No tenant switching in tests"

# Check if there's a base test class for tenants
find tests -name "*Tenant*Test.php" -type f
```

## **📋 IMMEDIATE ACTION PLAN:**

### **1. First, CHECK existing patterns:**
```bash
# Check if TenantAuth tests exist and how they handle migrations
ls -la packages/laravel-backend/tests/Feature/TenantAuth/

# Check if there's a TenantTestCase or similar
find packages/laravel-backend/tests -name "*Tenant*" -type f
```

### **2. Then, DECIDE based on findings:**

**If pattern exists:** Follow existing approach  
**If no pattern:** Use Option B with tenant switching

### **3. Create TENANT TEST BASE CLASS:**
```php
// tests/TenantTestCase.php
abstract class TenantTestCase extends TestCase
{
    protected Tenant $tenant;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // 1. Create test tenant
        $this->tenant = Tenant::create(['name' => 'Test Tenant']);
        
        // 2. Switch to tenant
        $this->tenant->makeCurrent();
        
        // 3. Run tenant-specific migrations
        $this->runTenantMigrations();
    }
    
    protected function runTenantMigrations(): void
    {
        // Run membership migrations in tenant DB
        Artisan::call('migrate', [
            '--path' => 'app/Contexts/Membership/Infrastructure/Database/Migrations',
            '--database' => 'tenant',
        ]);
    }
}
```

## **🎯 WHAT DO YOU WANT ME TO DO?**

**Option A:** First check existing patterns in TenantAuth  
**Option B:** Create TenantTestCase approach  
**Option C:** Something else?

**Recommendation:** Check existing patterns first (Option A), then decide.

```bash
# 🔍 ANALYZING EXISTING TENANT AUTH TEST PATTERNS

# 1. Check TenantAuth test directory structure
ls -la packages/laravel-backend/tests/Feature/TenantAuth/

# 2. Look for existing test files in TenantAuth
find packages/laravel-backend/tests/Feature/TenantAuth -name "*.php" -type f

# 3. Check for migration loading patterns
grep -r "loadMigrationsFrom\|RefreshDatabase\|migrate" packages/laravel-backend/tests/Feature/TenantAuth/ || echo "No migration patterns found in TenantAuth tests"

# 4. Check how tenant switching is handled in existing tests
grep -r "Tenant::current\|tenant()\|makeCurrent" packages/laravel-backend/tests/ || echo "No tenant switching patterns found"

# 5. Check for any base test classes
find packages/laravel-backend/tests -name "*TestCase*.php" -type f | grep -v "TestCase.php"

# 6. Look at TenantAuth test setup to understand pattern
cat packages/laravel-backend/tests/Feature/TenantAuth/TenantUserRegistrationTest.php 2>/dev/null || echo "TenantUserRegistrationTest.php not found"

# 7. Check if there's a specific database configuration for tests
find packages/laravel-backend -name "*test*.php" -path "*/database/*" -type f

# 8. Check TestCase.php for existing migration configuration
grep -n "defineDatabaseMigrations\|loadMigrationsFrom" packages/laravel-backend/tests/TestCase.php
```

# 🔥 **YES - CRITICAL ARCHITECTURAL CLARIFICATION:**

## **✅ MEMBERSHIP TABLES GO IN TENANT DATABASES**

**CORRECT ARCHITECTURE:**
```
LANDLORD DATABASE (Global):
├── countries (Geography Context)
├── geo_administrative_units (Geography Context)
└── tenants (Platform Context)

TENANT DATABASES (Per-Political-Party):
├── members (Membership Context) ✅
├── committees (Membership Context - future)
├── tenant_users (TenantAuth Context)
├── roles, permissions (TenantAuth Context)
└── forum_posts, etc. (Other contexts)
```

## **🎯 MEMBERSHIP CONTEXT IS TENANT-SPECIFIC:**

1. **Each political party** gets its own database
2. **Each tenant database** gets `members` table when membership module is installed
3. **Geography references** point from tenant DB → landlord DB (cross-database)

## **🚨 TESTING IMPLICATION:**

**Problem:** We can't test Membership without a **real tenant database**.
**Solution:** Tests need to:
1. Create a test tenant
2. Switch to tenant connection
3. Run membership migrations in tenant DB
4. Run tests against tenant DB

## **🧪 TEST STRATEGY NEEDED:**

```php
// tests/Feature/Membership/MemberRegistrationTest.php
class MemberRegistrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // 1. Create a test tenant
        $tenant = Tenant::create([
            'name' => 'Test Political Party',
            'slug' => 'test-party',
        ]);
        
        // 2. Switch to tenant context
        $tenant->makeCurrent();
        
        // 3. Run membership migrations IN TENANT DB
        $this->artisan('migrate', [
            '--database' => 'tenant', // Key difference!
            '--path' => 'app/Contexts/Membership/Infrastructure/Database/Migrations',
        ]);
    }
}
```

## **🤔 CHECK EXISTING PATTERN:**

**Let me see how TenantAuth handles this:**

```bash
# Look at how TenantAuth tests work
grep -A 10 -B 5 "setUp\|RefreshDatabase" packages/laravel-backend/tests/Feature/TenantAuth/*.php 2>/dev/null || echo "No TenantAuth tests found"

# Check if there's already a tenant test helper
find packages/laravel-backend -name "*Tenant*Test*.php" -type f
```

## **🎯 DECISION NEEDED:**

**Do you want me to:**
1. **First** check how existing TenantAuth tests handle tenant databases?
2. **Or** create a TenantTestCase base class for all tenant-context tests?

**Recommendation:** Check existing TenantAuth first, then follow their pattern if it exists.