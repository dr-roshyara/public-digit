# Multi-Tenant Database Connection Debugging Guide

**Created:** 2026-01-03 13:40
**Context:** Membership Context - Mobile API Testing
**Status:** Production-Ready Debugging Checklist

---

## 🎯 Overview

This guide documents all database connection issues encountered during Membership Context DAY 2 implementation and provides systematic debugging procedures.

**Environment:**
- **Testing**: Uses `tenant_test` connection → `tenant_test` database
- **Production**: Uses `tenant` connection → dynamically switched database (Spatie)
- **Landlord Testing**: Uses `landlord_test` connection → `publicdigit_test` database
- **Landlord Production**: Uses `landlord` connection → `publicdigit` database

---

## 📊 Issues Encountered (Chronological)

### ❌ Issue 1: Database "tenant" Does Not Exist (Testing Environment)

**Symptom:**
```
SQLSTATE[08006] [7] FATAL: Datenbank "tenant" existiert nicht
```

**Root Cause:**
- Middleware tried to connect to database `"tenant"` in testing environment
- Testing should use `"tenant_test"` database
- Tenant record in `landlord_test` database had wrong `database_name`

**Diagnosis:**
```bash
# Check tenant record
PGPASSWORD="password" psql -U publicdigit_user -d publicdigit_test \
  -c "SELECT slug, database_name FROM tenants WHERE slug='uml';"

# Expected in testing: database_name = 'tenant_test'
# Actual: database_name = 'tenant'
```

**Fix:**
```bash
# Update tenant record
PGPASSWORD="Rudolfvogt%27%" psql -U publicdigit_user -d publicdigit_test \
  -c "UPDATE tenants SET database_name = 'tenant_test' WHERE slug = 'uml';"
```

**Prevention:**
```php
// In test setup, use updateOrInsert with dynamic database name
private function createTestTenant(): void
{
    $landlordConnection = app()->environment('testing') ? 'landlord_test' : 'landlord';
    $tenantDbName = config('database.connections.tenant.database'); // Dynamic!

    \DB::connection($landlordConnection)->table('tenants')->updateOrInsert(
        ['slug' => 'uml'], // Match condition
        [
            'database_name' => $tenantDbName, // Uses config value
            // ... other fields
        ]
    );
}
```

---

### ❌ Issue 2: Migrations Using Hardcoded "tenant" Connection

**Symptom:**
- Migrations ran successfully but tables created in wrong database
- Testing couldn't find tables because they were in `tenant` database, not `tenant_test`

**Root Cause:**
```php
// WRONG: Hardcoded connection
Schema::connection('tenant')->create('members', function ($table) {
    // ...
});
```

**Fix:**
```php
// CORRECT: Environment-aware connection
public function up(): void
{
    $connectionName = app()->environment('testing') ? 'tenant_test' : 'tenant';

    Schema::connection($connectionName)->create('members', function (Blueprint $table) {
        // ...
    });
}

public function down(): void
{
    $connectionName = app()->environment('testing') ? 'tenant_test' : 'tenant';

    Schema::connection($connectionName)->dropIfExists('members');
}
```

**Prevention:**
- **Always** make migrations environment-aware for tenant databases
- Add comment in migration file referencing testing guide
- Use migration template with environment detection built-in

---

### ❌ Issue 3: Test Using Wrong Database Connection

**Symptom:**
```php
// Test setup used 'tenant' instead of 'tenant_test'
protected $connectionsToTransact = ['tenant']; // WRONG
```

**Root Cause:**
- DatabaseTransactions trait was configured for production connection
- Testing requires `tenant_test` connection

**Fix:**
```php
// CORRECT
protected $connectionsToTransact = ['tenant_test'];

protected function setUp(): void
{
    parent::setUp();

    // Use tenant_test connection in testing environment
    $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';

    \DB::connection($tenantConnection)->enableQueryLog();
    config(['database.default' => $tenantConnection]);
}
```

**Prevention:**
- **All feature tests** for tenant contexts must use `tenant_test` connection
- Add comment in test file referencing database testing guide
- Create base test class with proper connection setup

---

### ❌ Issue 4: Validation Rules Using Wrong Connection

**Symptom:**
```
"A member with this email already exists."
```
But database is empty!

**Root Cause:**
```php
// Validation checking wrong database
"unique:tenant.members,personal_info->email,..." // WRONG in testing
```

**Diagnosis:**
```bash
# Check which database validation is querying
# Enable query log in test setup:
\DB::connection('tenant_test')->enableQueryLog();

# After test failure, dump queries:
dd(\DB::connection('tenant_test')->getQueryLog());
```

**Fix:**
```php
public function rules(): array
{
    $tenantId = $this->route('tenant');
    // Dynamic connection based on environment
    $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';

    return [
        'email' => [
            'required',
            'email:rfc',
            "unique:{$tenantConnection}.members,personal_info->email,NULL,id,tenant_id,{$tenantId}",
        ],
        'member_id' => [
            'nullable',
            "unique:{$tenantConnection}.members,member_id,NULL,id,tenant_id,{$tenantId}",
        ],
    ];
}
```

**Prevention:**
- **All validation rules** must use environment-aware connection
- Create validation rule builder helper for tenant-scoped uniqueness
- Add linter rule to catch hardcoded `tenant.` in validation

---

### ❌ Issue 5: Route Naming Mismatch

**Symptom:**
```
Route [tenant.mapi.members.show] not defined.
```

**Root Cause:**
```php
// Route defined with full prefix
Route::get('/{member}', ...)->name('tenant.mapi.members.show');

// But parent group already adds prefix:
Route::prefix('{tenant}/mapi/v1')
    ->name('mobile.api.v1.')  // Adds this prefix
    ->group(function () {
        require __DIR__.'/tenant-mapi/membership.php';
    });

// Actual route name: mobile.api.v1.tenant.mapi.members.show (WRONG)
// Expected in resource: tenant.mapi.members.show (NOT FOUND)
```

**Diagnosis:**
```bash
# Check actual route names
php artisan route:list | grep -i "mapi.*members"

# Output shows:
# mobile.api.v1.tenant.mapi.members.show  (WRONG)
```

**Fix:**
```php
// In routes/tenant-mapi/membership.php
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/{member}', [MemberController::class, 'show'])
        ->name('show'); // Short name, parent adds prefix
});

// In MobileMemberResource.php
'self' => route('mobile.api.v1.show', [
    'tenant' => $member->tenant_id,
    'member' => $member->id,
]),
```

**Prevention:**
- Use **short route names** inside grouped route files
- Parent group prefix becomes part of final name
- Document route naming convention in CLAUDE.md

---

### ❌ Issue 6: Missing "tenant_test" Database

**Symptom:**
```
FATAL: Datenbank "tenant_test" existiert nicht
```

**Root Cause:**
- Migration guide doesn't mention creating test databases
- Developers assume databases auto-create

**Fix:**
```bash
# Create tenant_test database
psql -U postgres -c "CREATE DATABASE tenant_test OWNER publicdigit_user;"

# Verify
psql -U postgres -l | grep tenant_test
```

**Prevention:**
- Add database creation to setup documentation
- Create setup script: `setup-test-databases.sh`
- Add to CI/CD pipeline setup

---

### ❌ Issue 7: Test Using insertOrIgnore() for Tenant

**Symptom:**
- Tenant database name not updating even after fix
- Old tenant record persists with wrong database name

**Root Cause:**
```php
// insertOrIgnore() doesn't update existing records
\DB::connection($landlordConnection)->table('tenants')->insertOrIgnore([
    'slug' => 'uml',
    'database_name' => 'tenant_test', // Not updated if slug exists!
]);
```

**Fix:**
```php
// Use updateOrInsert() instead
\DB::connection($landlordConnection)->table('tenants')->updateOrInsert(
    ['slug' => 'uml'], // Match condition
    [
        'database_name' => $tenantDbName,
        // ... all other fields
    ]
);
```

**Prevention:**
- **Always use `updateOrInsert()`** in test setup
- Ensures fresh configuration on every test run
- Prevents stale data from previous runs

---

### ❌ Issue 8: Column "personal_info" Does Not Exist

**Symptom:**
```
SQLSTATE[42703]: Undefined column: 7 FEHLER: Spalte »personal_info« existiert nicht
LINE 1: select count(*) as aggregate from "members" where "personal_info"->>'email' = ...
```

**Root Cause:**
- Migration may not have run on `tenant_test` database
- OR migration ran on `tenant` database instead
- OR table structure mismatch

**Diagnosis:**
```bash
# Check if table exists
PGPASSWORD="password" psql -U publicdigit_user -d tenant_test \
  -c "\d members"

# Check migration status
cd packages/laravel-backend
php artisan migrate:status --database=tenant_test
```

**Possible Fixes:**

**Option A: Migration Not Run**
```bash
# Run migrations on tenant_test
php artisan migrate --database=tenant_test \
  --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant \
  --force
```

**Option B: Wrong Connection in Migration**
- Check migration file has environment-aware connection (see Issue 2)
- Re-run migration with correct connection

**Option C: Table Structure Mismatch**
```bash
# Drop and recreate
php artisan migrate:fresh --database=tenant_test \
  --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant \
  --force
```

**Prevention:**
- Verify migration ran successfully before running tests
- Add migration check to test setup
- Create test database seeder that validates structure

---

## 🔧 Systematic Debugging Procedure

### Step 1: Verify Database Existence

```bash
# List all databases
psql -U postgres -l

# Expected in testing:
# - publicdigit_test (landlord)
# - tenant_test (tenant)

# If missing, create:
psql -U postgres -c "CREATE DATABASE tenant_test OWNER publicdigit_user;"
```

---

### Step 2: Verify Tenant Record Configuration

```bash
# Check tenant configuration
PGPASSWORD="Rudolfvogt%27%" psql -U publicdigit_user -d publicdigit_test \
  -c "SELECT id, slug, database_name, status FROM tenants WHERE slug='uml';"

# Expected output:
#   id                                   | slug | database_name | status
# ---------------------------------------+------+---------------+--------
#  550e8400-e29b-41d4-a716-446655440000 | uml  | tenant_test   | active
```

**If database_name is wrong:**
```bash
# Update tenant record
PGPASSWORD="Rudolfvogt%27%" psql -U publicdigit_user -d publicdigit_test \
  -c "UPDATE tenants SET database_name = 'tenant_test' WHERE slug = 'uml';"
```

---

### Step 3: Verify Migration Status

```bash
cd packages/laravel-backend

# Check which migrations have run on tenant_test
php artisan migrate:status --database=tenant_test

# Expected output should show Membership migrations
```

**If migrations missing:**
```bash
# Run migrations
php artisan migrate --database=tenant_test \
  --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant \
  --force
```

---

### Step 4: Verify Table Structure

```bash
# Check members table structure
PGPASSWORD="Rudolfvogt%27%" psql -U publicdigit_user -d tenant_test \
  -c "\d members"

# Expected columns:
# - id (string, ULID)
# - tenant_id (string)
# - tenant_user_id (string)
# - personal_info (json)  ← CRITICAL
# - status (string)
# - residence_geo_reference (string, nullable)
# - membership_type (string)
# - registration_channel (string, nullable)
# - metadata (json, nullable)
# - created_at, updated_at, deleted_at
```

**If column missing:**
```bash
# Fresh migration
php artisan migrate:fresh --database=tenant_test \
  --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant \
  --force
```

---

### Step 5: Enable Query Logging in Tests

```php
protected function setUp(): void
{
    parent::setUp();

    $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';

    // Enable query logging for debugging
    \DB::connection($tenantConnection)->enableQueryLog();

    config(['database.default' => $tenantConnection]);

    // ... rest of setup
}

/** @test */
public function mobile_user_can_register_via_api(): void
{
    // ... test code

    // If test fails, dump queries
    if ($response->status() !== 201) {
        $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';
        dump(\DB::connection($tenantConnection)->getQueryLog());
    }

    $response->assertStatus(201);
}
```

---

### Step 6: Check Laravel Logs

```bash
# Clear log
echo "" > packages/laravel-backend/storage/logs/laravel.log

# Run single test
cd packages/laravel-backend
php artisan test --filter=mobile_user_can_register_via_api

# Check log for SQL errors
cat storage/logs/laravel.log | grep -A 5 "SQLSTATE"
```

---

## 📋 Quick Reference Checklist

### Before Running Tests

- [ ] `tenant_test` database exists in PostgreSQL
- [ ] `publicdigit_test` database exists in PostgreSQL
- [ ] Tenant record in `publicdigit_test` has `database_name = 'tenant_test'`
- [ ] Migrations have run on `tenant_test` database
- [ ] All required tables exist with correct structure
- [ ] Test uses `protected $connectionsToTransact = ['tenant_test'];`
- [ ] Test setup uses environment-aware connection selection
- [ ] Validation rules use `$tenantConnection` variable
- [ ] Routes use short names (parent group adds prefix)

### Common Commands

```bash
# Create test databases
psql -U postgres -c "CREATE DATABASE tenant_test OWNER publicdigit_user;"
psql -U postgres -c "CREATE DATABASE publicdigit_test OWNER publicdigit_user;"

# Update tenant record
PGPASSWORD="Rudolfvogt%27%" psql -U publicdigit_user -d publicdigit_test \
  -c "UPDATE tenants SET database_name = 'tenant_test' WHERE slug = 'uml';"

# Run migrations
cd packages/laravel-backend
php artisan migrate --database=tenant_test \
  --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant \
  --force

# Check migration status
php artisan migrate:status --database=tenant_test

# Verify table structure
PGPASSWORD="Rudolfvogt%27%" psql -U publicdigit_user -d tenant_test -c "\d members"

# Run specific test
php artisan test --filter=mobile_user_can_register_via_api
```

---

## 🎯 Prevention Strategies

### 1. Environment-Aware Patterns

**Migrations:**
```php
public function up(): void
{
    $connectionName = app()->environment('testing') ? 'tenant_test' : 'tenant';
    Schema::connection($connectionName)->create('table_name', function (Blueprint $table) {
        // ...
    });
}
```

**Tests:**
```php
protected $connectionsToTransact = ['tenant_test'];

protected function setUp(): void
{
    parent::setUp();
    $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';
    config(['database.default' => $tenantConnection]);
}
```

**Validation:**
```php
public function rules(): array
{
    $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';
    return [
        'email' => ["unique:{$tenantConnection}.members,email,..."],
    ];
}
```

### 2. Test Setup Best Practices

```php
private function createTestTenant(): void
{
    $landlordConnection = app()->environment('testing') ? 'landlord_test' : 'landlord';
    $tenantDbName = config('database.connections.tenant.database');

    \DB::connection($landlordConnection)->table('tenants')->updateOrInsert(
        ['slug' => 'uml'], // Match condition
        [
            'database_name' => $tenantDbName, // Dynamic from config
            // ... other fields
        ]
    );
}
```

### 3. Route Naming Convention

```php
// Parent group (routes/mobileapp.php)
Route::prefix('{tenant}/mapi/v1')
    ->name('mobile.api.v1.')
    ->group(function () {
        require __DIR__.'/tenant-mapi/membership.php';
    });

// Child routes (routes/tenant-mapi/membership.php)
Route::get('/{member}', [MemberController::class, 'show'])
    ->name('show'); // Short name, becomes: mobile.api.v1.show
```

### 4. Create Base Test Classes

```php
// tests/Feature/Contexts/TenantContextTestCase.php
abstract class TenantContextTestCase extends TestCase
{
    use DatabaseTransactions;

    protected $connectionsToTransact = ['tenant_test'];

    protected function setUp(): void
    {
        parent::setUp();

        $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';
        \DB::connection($tenantConnection)->enableQueryLog();
        config(['database.default' => $tenantConnection]);

        $this->createTestTenant();
    }

    private function createTestTenant(): void
    {
        // Standard implementation
    }
}
```

### 5. Migration Template

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * [Context Name] - [Table Name]
 *
 * Connection Strategy:
 * - Testing: tenant_test → database: tenant_test
 * - Production: tenant → database: dynamically switched by Spatie
 *
 * See: developer_guide/laravel-backend/tenant-database/20251229_1352_database_testing_setting.md
 */
return new class extends Migration
{
    public function up(): void
    {
        $connectionName = app()->environment('testing') ? 'tenant_test' : 'tenant';

        Schema::connection($connectionName)->create('table_name', function (Blueprint $table) {
            // ...
        });
    }

    public function down(): void
    {
        $connectionName = app()->environment('testing') ? 'tenant_test' : 'tenant';

        Schema::connection($connectionName)->dropIfExists('table_name');
    }
};
```

---

## 🚨 Critical Rules

1. **NEVER hardcode `'tenant'` connection in migrations**
   - Always use environment detection
   - Reference testing guide in comments

2. **ALWAYS use `updateOrInsert()` in test setup**
   - Ensures fresh configuration
   - Prevents stale data

3. **ALWAYS use environment-aware validation**
   - Dynamic `$tenantConnection` variable
   - Applies to all `unique:` rules

4. **ALWAYS use short route names in grouped files**
   - Parent group adds prefix
   - Prevents name conflicts

5. **ALWAYS verify database exists before running tests**
   - Add to CI/CD setup scripts
   - Document in README

---

## 📚 Related Documentation

- [Database Testing Setting Guide](./20251229_1352_database_testing_setting.md)
- [Tenant Interface Architecture](../tenant_database/202560103_tenant_interface_setting.md)
- [Why Tenant Interface](../tenant_database/why_tenant_interface.md)
- [Membership Developer Guide](../../membership-context/20260102_membership_developer_guide.md)

---

## 🔄 Update History

- **2026-01-03 13:40**: Initial creation - Documents all DAY 2 database issues
- **Next Update**: Add Issue 8 resolution once fixed

---

**Last Updated:** 2026-01-03 13:40
**Author:** Senior Laravel DDD Architect (Claude)
**Status:** Production-Ready Debug Guide
