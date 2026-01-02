# Geography Context Test Installation Plan

**Date**: 2025-12-31
**Analyst**: Senior Laravel Backend Developer
**Issue**: Geography context installation in test database
**Status**: Analysis Complete - Plan Ready

---

## 📋 Problem Analysis

### Current Situation

```
Production Database (publicdigit):
✅ Has countries table
✅ Has geo_administrative_units table
✅ Geography works perfectly

Test Database (publicdigit_test):
❌ NO countries table
❌ NO geo_administrative_units table
❌ Tests fail due to missing tables
```

### User Requirement

> "I want to use `php artisan context:install Geography` command in testing procedure,
> and the tables should be installed in `publicdigit_test`"

### Root Causes Identified

1. **Migration Folder Structure Was Wrong** ✅ FIXED
   - Migrations were in root `Migrations/` folder
   - Moved to `Landlord/` subfolder
   - `context:install` can now find them

2. **Test Database Not Bootstrapped** ❌ NOT FIXED
   - Geography tables don't exist in test database
   - No mechanism to create them during test setup

3. **No --database Option in Command** ❌ LIMITATION
   - `context:install` has no `--database` flag
   - Always installs to default connection
   - Tests need to ensure default = test database

---

## 🎯 Solution Strategy

### Approach: Bootstrap Test Database Before Tests Run

Laravel testing best practice: Use `setUp()` method to prepare test environment.

#### Why This Approach?

1. **Laravel Standard**: Uses `RefreshDatabase` trait pattern
2. **Isolation**: Each test gets clean state
3. **Repeatability**: Tests can run multiple times
4. **No Command Changes**: Don't modify production code for tests

---

## 📐 Technical Plan

### Phase 1: Verify Migration Structure ✅ COMPLETE

```bash
app/Contexts/Geography/Infrastructure/Database/Migrations/
├── Landlord/
│   ├── 2025_01_01_000001_create_countries_table.php  ✅
│   └── 2025_01_01_000002_create_geo_administrative_units_table.php  ✅
└── Tenant/
    └── 2025_01_01_000001_create_geo_administrative_units_table.php  ✅
```

**Status**: ✅ Already fixed

---

### Phase 2: Create Test Base Class for Geography Tests

**File**: `tests/Feature/Geography/GeographyTestCase.php`

**Purpose**: Base class that sets up Geography tables before each test

```php
<?php

namespace Tests\Feature\Geography;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

abstract class GeographyTestCase extends TestCase
{
    use RefreshDatabase;

    /**
     * Setup runs before EACH test
     * This ensures Geography tables exist in test database
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Ensure we're using test database (configured in phpunit.xml)
        $this->assertEquals('publicdigit_test', DB::getDatabaseName());

        // Run Geography landlord migrations if tables don't exist
        $this->bootstrapGeographyTables();
    }

    /**
     * Bootstrap Geography tables in test database
     * Only runs migrations if tables don't already exist
     */
    protected function bootstrapGeographyTables(): void
    {
        // Check if countries table exists
        if (!Schema::hasTable('countries')) {
            // Run Geography landlord migrations
            Artisan::call('migrate', [
                '--path' => 'app/Contexts/Geography/Infrastructure/Database/Migrations/Landlord',
                '--database' => 'testing',  // Use test connection
                '--force' => true,
            ]);
        }

        // Verify tables now exist
        $this->assertTrue(Schema::hasTable('countries'));
        $this->assertTrue(Schema::hasTable('geo_administrative_units'));
    }
}
```

---

### Phase 3: Create Geography Installation Test

**File**: `tests/Feature/Geography/GeographyContextInstallTest.php`

**Purpose**: Test the actual `context:install Geography` command

```php
<?php

namespace Tests\Feature\Geography;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class GeographyContextInstallTest extends GeographyTestCase
{
    /**
     * Test 1: context:install Geography runs successfully
     */
    public function test_geography_context_install_command_succeeds(): void
    {
        // Run the actual command
        $exitCode = Artisan::call('context:install', [
            'context' => 'Geography'
        ]);

        // Should exit with 0 (success)
        $this->assertEquals(0, $exitCode);

        // Check output
        $output = Artisan::output();
        $this->assertStringContainsString('Installing Context: Geography', $output);
        $this->assertStringContainsString('Installation successful', $output);
    }

    /**
     * Test 2: Geography tables exist after installation
     */
    public function test_geography_tables_exist_after_install(): void
    {
        // Tables should exist (created in setUp)
        $this->assertTrue(Schema::hasTable('countries'));
        $this->assertTrue(Schema::hasTable('geo_administrative_units'));

        // Run install command
        Artisan::call('context:install', ['context' => 'Geography']);

        // Tables should still exist
        $this->assertTrue(Schema::hasTable('countries'));
        $this->assertTrue(Schema::hasTable('geo_administrative_units'));
    }

    /**
     * Test 3: Can insert and query geography data
     */
    public function test_can_insert_and_query_geography_data(): void
    {
        // Insert a country
        DB::table('countries')->insert([
            'code' => 'NP',
            'name' => 'Nepal',
            'iso_alpha_2' => 'NP',
            'iso_alpha_3' => 'NPL',
            'iso_numeric' => '524',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Insert a province
        DB::table('geo_administrative_units')->insert([
            'country_code' => 'NP',
            'level' => 1,
            'name' => 'Province 1',
            'code' => 'P1',
            'parent_id' => null,
            'path' => '1',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Query back
        $country = DB::table('countries')->where('code', 'NP')->first();
        $this->assertNotNull($country);
        $this->assertEquals('Nepal', $country->name);

        $province = DB::table('geo_administrative_units')
            ->where('country_code', 'NP')
            ->where('level', 1)
            ->first();
        $this->assertNotNull($province);
        $this->assertEquals('Province 1', $province->name);
    }

    /**
     * Test 4: Geography shows "Already installed" when run twice
     */
    public function test_geography_shows_already_installed_on_second_run(): void
    {
        // First install
        Artisan::call('context:install', ['context' => 'Geography']);

        // Second install
        Artisan::call('context:install', ['context' => 'Geography']);
        $output = Artisan::output();

        // Should show "Already installed"
        $this->assertStringContainsString('Already installed', $output);
    }
}
```

---

### Phase 4: Update Membership Tests to Use Geography

**File**: `tests/Feature/Membership/OptionalGeographyTest.php`

**Current Issue**: Test extends `TestCase`, needs Geography tables

**Fix**: Extend `GeographyTestCase` instead

```php
<?php

namespace Tests\Feature\Membership;

use App\Contexts\Membership\Domain\Models\Member;
use Tests\Feature\Geography\GeographyTestCase; // ← Change this
use App\Models\Tenant;

class OptionalGeographyTest extends GeographyTestCase // ← Change this
{
    // Now setUp() will automatically create Geography tables
    // Rest of tests remain the same

    protected function setUp(): void
    {
        parent::setUp(); // Calls GeographyTestCase::setUp()

        // Create test tenant
        $tenant = Tenant::factory()->create(['slug' => 'test-optional-geo']);
        $tenant->makeCurrent();
    }

    // ... rest of tests unchanged
}
```

---

## 🔄 Execution Flow

### When Running Tests

```
1. PHPUnit starts
   ↓
2. phpunit.xml sets DB_DATABASE=publicdigit_test
   ↓
3. RefreshDatabase trait runs migrations
   ↓
4. GeographyTestCase::setUp() runs
   ↓
5. bootstrapGeographyTables() checks if tables exist
   ↓
6. If NOT exist: Run Geography landlord migrations
   ↓
7. Test runs with Geography tables available
   ↓
8. RefreshDatabase rolls back after test
```

---

## ✅ Validation Steps

### Step 1: Run Geography Installation Test

```bash
cd packages/laravel-backend
php artisan test tests/Feature/Geography/GeographyContextInstallTest.php
```

**Expected Output**:
```
PASS  Tests\Feature\Geography\GeographyContextInstallTest
✓ geography context install command succeeds
✓ geography tables exist after install
✓ can insert and query geography data
✓ geography shows already installed on second run

Tests:  4 passed
```

### Step 2: Verify Test Database

```bash
psql -h 127.0.0.1 -U publicdigit_user -d publicdigit_test -c "\dt"
```

**Expected Tables** (after test runs):
```
countries
geo_administrative_units
migrations
... other test tables
```

### Step 3: Run Membership Tests

```bash
php artisan test tests/Feature/Membership/OptionalGeographyTest.php
```

**Expected**: All tests pass (Geography tables available)

---

## 📦 Deliverables

| File | Purpose | Status |
|------|---------|--------|
| `tests/Feature/Geography/GeographyTestCase.php` | Base test class with Geography setup | To Create |
| `tests/Feature/Geography/GeographyContextInstallTest.php` | Test context:install command | To Create |
| `tests/Feature/Membership/OptionalGeographyTest.php` | Update to extend GeographyTestCase | To Update |
| `tests/Feature/Membership/MakeGeographyOptionalMigrationTest.php` | Update to extend GeographyTestCase | To Update |

---

## 🚨 Important Notes

### 1. RefreshDatabase Trait

The `RefreshDatabase` trait:
- ✅ Runs migrations automatically
- ✅ Rolls back after each test
- ✅ Ensures test isolation
- ❌ Does NOT run context migrations by default

**Solution**: Our `GeographyTestCase` handles context migrations in `setUp()`

### 2. Test Database Configuration

**File**: `phpunit.xml`

```xml
<env name="DB_CONNECTION" value="testing"/>
<env name="DB_DATABASE" value="publicdigit_test"/>
```

This ensures all tests use test database.

### 3. Migration Idempotency

The `bootstrapGeographyTables()` method:
- Checks if tables exist before running migrations
- Safe to call multiple times
- Won't error if tables already exist

---

## 🎯 Success Criteria

- [x] Geography migration structure fixed (Landlord/ folder)
- [ ] GeographyTestCase base class created
- [ ] GeographyContextInstallTest created
- [ ] Membership tests updated to use GeographyTestCase
- [ ] All tests pass with Geography tables in test database
- [ ] `context:install Geography` works in test environment
- [ ] Test database has Geography tables after test runs

---

## 🔮 Future Improvements

### Option 1: Database Seeders for Test Data

Create `database/seeders/GeographyTestSeeder.php`:
```php
class GeographyTestSeeder extends Seeder
{
    public function run()
    {
        // Seed Nepal geography data
        // Seed test provinces, districts
    }
}
```

### Option 2: Add --database Flag to context:install

Modify `InstallContextCommand` to accept `--database` option:
```php
protected $signature = 'context:install
    {context}
    {--tenant=}
    {--database= : Database connection to use}';
```

### Option 3: Create Test-Specific Installer

```php
class TestContextInstaller extends ContextInstaller
{
    protected $database = 'testing';
}
```

---

## 📚 References

- [Laravel Testing Database](https://laravel.com/docs/12.x/database-testing)
- [RefreshDatabase Trait](https://laravel.com/docs/12.x/database-testing#resetting-the-database-after-each-test)
- [PHPUnit XML Configuration](https://docs.phpunit.de/en/10.5/configuration.html)

---

## 🎉 Summary

**The Plan**:
1. Create `GeographyTestCase` base class that bootstraps Geography tables
2. Create `GeographyContextInstallTest` to test the actual command
3. Update existing tests to extend `GeographyTestCase`
4. Run tests and verify they pass

**Why This Works**:
- Uses Laravel testing best practices
- No changes to production code
- Tests are isolated and repeatable
- Geography tables available for all tests that need them

**Next Action**: Implement Phase 2 - Create GeographyTestCase

---

**Status**: ✅ PLAN COMPLETE - READY TO IMPLEMENT
**Confidence**: HIGH (follows Laravel testing standards)
**Risk**: LOW (uses established patterns)
