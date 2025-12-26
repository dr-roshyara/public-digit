# 🐛 **DDD Geography Integration Debugging Guide**

## 📋 **Overview**

This guide provides detailed debugging instructions for the DDD Geography integration with Membership Context. Based on real implementation experience, it addresses the most common issues developers face when working with:

- **Service container binding errors**
- **Test creation and integration test failures**
- **Database migration and permission issues**
- **Cross-context validation problems**

---

## 🚨 **Common Issues & Quick Fixes**

### **Issue 1: Service Binding Resolution Errors**

**Symptoms:**
- `Target [App\Contexts\...] is not instantiable.`
- `Unresolvable dependency resolving [Parameter #0 ...]`
- Service not found when using `app()->make()` or dependency injection

**Root Cause:** Missing or incorrect service provider bindings in `AppServiceProvider.php`.

**Debugging Steps:**
1. **Check constructor dependencies:**
   ```bash
   # Navigate to the service class
   grep -n "__construct" packages/laravel-backend/app/Contexts/Membership/Application/Services/MemberGeographyValidator.php
   ```

2. **Verify current bindings in AppServiceProvider:**
   ```php
   // Example: Check if MemberGeographyValidator is properly bound
   $this->app->bind(
       \App\Contexts\Membership\Application\Services\MemberGeographyValidator::class,
       function ($app) {
           return new \App\Contexts\Membership\Application\Services\MemberGeographyValidator(
               $app->make(\App\Contexts\Geography\Application\Services\GeographyAntiCorruptionLayer::class)
           );
       }
   );
   ```

3. **Test resolution manually:**
   ```bash
   php artisan tinker
   >>> app()->make(\App\Contexts\Membership\Application\Services\MemberGeographyValidator::class);
   # Should return instance without errors
   ```

**Fix Pattern:**
```php
// WRONG: Simple binding without dependencies
$this->app->bind(MemberGeographyValidator::class);

// RIGHT: Factory closure with dependency injection
$this->app->bind(MemberGeographyValidator::class, function ($app) {
    return new MemberGeographyValidator(
        $app->make(GeographyAntiCorruptionLayer::class)
    );
});
```

### **Issue 2: Contextual Binding Conflicts**

**Symptoms:**
- `GeographyService` bound incorrectly when `GeographyAntiCorruptionLayer` needs it
- Circular dependency errors

**Solution:** Use contextual binding for special cases:

```php
// AppServiceProvider.php - Critical contextual binding
$this->app->when(\App\Contexts\Geography\Application\Services\GeographyAntiCorruptionLayer::class)
    ->needs(\App\Contexts\Geography\Application\Services\GeographyService::class)
    ->give(function ($app) {
        return new \App\Contexts\Geography\Application\Services\GeographyService();
    });
```

**Why this matters:** `GeographyAntiCorruptionLayer` implements `GeographyService` interface but also needs a concrete `GeographyService` instance internally. Contextual binding provides the concrete instance only when requested by the ACL.

### **Issue 3: Test Database Setup Failures**

**Symptoms:**
- `Database [publicdigit_test] already exists`
- `template database "template1" is being accessed by other users`
- Permission denied for schema `public`

**Debugging Commands:**
```bash
# 1. Kill existing connections
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname LIKE '%test%'"

# 2. Run setup with debug flag
php setup_test_db.php --fresh --debug

# 3. Check PostgreSQL ltree extension
sudo -u postgres psql -c "\dx" | grep ltree

# 4. Verify database ownership
sudo -u postgres psql -c "\l publicdigit_test"
```

**Fix Sequence:**
1. Ensure PostgreSQL is running
2. Use the setup script's retry logic
3. Check `.env.testing` configuration
4. Verify application user has proper permissions

### **Issue 4: GeographyTestSeeder Integration Test Failures**

**Symptoms:**
- `Table 'geo_administrative_units' doesn't exist`
- `Column 'admin_level' not found`
- Hardcoded IDs (1, 12, 123, 1234) don't match actual seeded data

**Debugging Steps:**
1. **Check actual database schema:**
   ```sql
   \c publicdigit_test
   \d geo_administrative_units
   -- Note column names: admin_level (not level_1, level_2, etc.)
   ```

2. **Verify seeded data:**
   ```bash
   php artisan db:seed --class=GeographyTestSeeder --database=landlord_test
   php artisan tinker --database=landlord_test
   >>> DB::table('geo_administrative_units')->count()
   ```

3. **Test seeder directly:**
   ```php
   // Create a simple test script
   require_once 'vendor/autoload.php';
   $app = require_once 'bootstrap/app.php';
   $app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

   Artisan::call('db:seed', ['--class' => 'GeographyTestSeeder', '--database' => 'landlord_test']);
   ```

### **Issue 5: Cross-Context Exception Translation Failures**

**Symptoms:**
- Geography exceptions leaking to membership API
- Wrong exception type caught
- Business rules not enforced

**Debugging Pattern:**
```php
try {
    // Original call
    $geoPath = $this->geographyACL->generatePath($country, $geographyIds);
} catch (\App\Contexts\Geography\Domain\Exceptions\InvalidHierarchyException $e) {
    // Correct: Translate to membership exception
    throw \App\Contexts\Membership\Domain\Exceptions\InvalidMemberGeographyException::invalidHierarchy(
        $e->getMessage()
    );
} catch (\Exception $e) {
    // Generic fallback
    throw new \App\Contexts\Membership\Domain\Exceptions\InvalidMemberGeographyException(
        "Geography validation failed: " . $e->getMessage()
    );
}
```

**Verification:**
- Geography exceptions should NEVER reach membership controllers
- All exceptions should be typed appropriately for their context
- Exception messages should be user-friendly (no stack traces)

---

## 🔍 **Debugging Workflow**

### **Step-by-Step Diagnostic Process**

**When tests fail:**
1. **Isolate the failure:**
   ```bash
   # Run single test
   ./vendor/bin/phpunit tests/Unit/Contexts/Membership/Services/MemberGeographyValidatorTest.php --filter test_validates_nepal_geography

   # Run with verbose output
   ./vendor/bin/phpunit --verbose tests/Unit/Contexts/Membership/Services/MemberGeographyValidatorTest.php
   ```

2. **Check database state:**
   ```bash
   # Connect to test database
   PGPASSWORD=password psql -h localhost -U publicdigit_user -d publicdigit_test

   # Check tables
   \dt

   # Check geography data
   SELECT id, country_code, admin_level, parent_id, path
   FROM geo_administrative_units
   ORDER BY country_code, admin_level, parent_id;
   ```

3. **Verify service resolution:**
   ```bash
   php artisan tinker --env=testing
   >>> $validator = app()->make(\App\Contexts\Membership\Application\Services\MemberGeographyValidator::class);
   >>> get_class($validator);  # Should return MemberGeographyValidator
   >>> $validator->validateForRegistration('NP', [1, 12, 123]);
   ```

4. **Check logs:**
   ```bash
   tail -f storage/logs/laravel.log
   # Or for test environment
   tail -f storage/logs/test.log
   ```

### **Environment-Specific Issues**

**Local Development:**
- `.env.testing` must be configured correctly
- PostgreSQL must have ltree extension
- Test databases must be created with proper permissions

**CI/CD Pipeline:**
- Environment variables must be set
- Database setup script must handle concurrency
- Cache must be cleared between runs

**Production:**
- Feature flags for gradual rollout
- Monitoring for geography validation failures
- Rollback plan ready

---

## 🛠️ **Tools & Commands Reference**

### **Essential Debugging Commands**

```bash
# 1. Database inspection
php artisan db:show --database=landlord_test
php artisan migrate:status --database=landlord_test

# 2. Service container inspection
php artisan tinker
>>> app()->bound(\App\Contexts\Membership\Application\Services\MemberGeographyValidator::class)
>>> app()->make(\App\Contexts\Membership\Application\Services\MemberGeographyValidator::class)

# 3. Route and middleware inspection
php artisan route:list --path=api
php artisan route:list --path=mapi

# 4. Test database management
php setup_test_db.php --fresh --seed      # Full reset with data
php setup_test_db.php --landlord-only     # Only landlord database
php setup_test_db.php --tenant-only       # Only tenant database
php setup_test_db.php --debug             # Verbose output

# 5. Composer test scripts
composer run test:setup-db    # Setup test databases
composer run test:geography   # Run geography tests
composer run test:membership  # Run membership tests
composer run test:unit        # Run all unit tests
composer run test:feature     # Run all feature tests
```

### **PostgreSQL Specific Commands**

```sql
-- Check ltree extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'ltree';

-- Check geography data hierarchy
WITH RECURSIVE geo_tree AS (
  SELECT id, name, admin_level, path, parent_id, 1 as depth
  FROM geo_administrative_units
  WHERE parent_id IS NULL AND country_code = 'NP'
  UNION ALL
  SELECT g.id, g.name, g.admin_level, g.path, g.parent_id, gt.depth + 1
  FROM geo_administrative_units g
  INNER JOIN geo_tree gt ON g.parent_id = gt.id
)
SELECT * FROM geo_tree ORDER BY path;

-- Check member geography data
SELECT m.id, m.geo_path, m.level_1_id, m.level_2_id, m.level_3_id
FROM members m
WHERE m.geo_path IS NOT NULL
LIMIT 10;
```

### **PHPUnit Debug Commands**

```bash
# Run specific test class
./vendor/bin/phpunit tests/Unit/Contexts/Membership/Services/MemberGeographyValidatorTest.php

# Run single test method
./vendor/bin/phpunit --filter test_validates_nepal_geography

# Run with coverage
./vendor/bin/phpunit --coverage-text tests/Unit/Contexts/Membership/

# Debug with Xdebug
XDEBUG_MODE=develop,debug ./vendor/bin/phpunit --filter MemberGeographyValidatorTest
```

---

## 📝 **Common Pitfalls & Solutions**

### **Pitfall 1: Hardcoded Test Data**

**WRONG:**
```php
$testUnitIds = [1, 12, 123, 1234]; // Assumes specific IDs
```

**RIGHT:**
```php
// Use actual seeded data
$nepalUnits = DB::connection('landlord_test')
    ->table('geo_administrative_units')
    ->where('country_code', 'NP')
    ->orderBy('admin_level')
    ->orderBy('parent_id')
    ->get();

// Build hierarchy dynamically
$testUnitIds = [];
$currentParentId = null;
foreach ([1, 2, 3] as $level) {
    if (isset($unitsByLevel[$level])) {
        $unit = collect($unitsByLevel[$level])
            ->first(function ($u) use ($currentParentId) {
                return $u->parent_id == $currentParentId ||
                       ($currentParentId === null && $u->parent_id === null);
            });

        if ($unit) {
            $testUnitIds[] = $unit->id;
            $currentParentId = $unit->id;
        }
    }
}
```

### **Pitfall 2: Missing Test Database Migrations**

**WRONG:**
```php
class GeographySeederIntegrationTest extends TestCase
{
    use RefreshDatabase; // Only works with default connection
}
```

**RIGHT:**
```php
protected function setUp(): void
{
    parent::setUp();

    // Run migrations for landlord_test connection
    \Illuminate\Support\Facades\Artisan::call('migrate', [
        '--database' => 'landlord_test',
        '--path' => 'database/migrations',
    ]);

    // Run geography context migrations
    \Illuminate\Support\Facades\Artisan::call('migrate', [
        '--database' => 'landlord_test',
        '--path' => 'app/Contexts/Geography/Infrastructure/Database/Migrations',
    ]);
}
```

### **Pitfall 3: Incorrect Exception Hierarchy**

**WRONG:**
```php
try {
    $geoPath = $this->geographyACL->generatePath($country, $geographyIds);
} catch (\Exception $e) {
    // Too generic - leaks implementation details
    throw new \Exception("Geography error: " . $e->getMessage());
}
```

**RIGHT:**
```php
try {
    $geoPath = $this->geographyACL->generatePath($country, $geographyIds);
} catch (InvalidHierarchyException $e) {
    throw InvalidMemberGeographyException::invalidHierarchy($e->getMessage());
} catch (InvalidCountryCodeException $e) {
    throw InvalidMemberGeographyException::invalidCountry($e->getMessage());
} catch (GeographyException $e) {
    throw InvalidMemberGeographyException::generic($e->getMessage());
}
```

### **Pitfall 4: Service Binding Order Dependencies**

**WRONG:**
```php
// Binding order matters - this might fail
$this->app->bind(MemberGeographyValidator::class);
$this->app->bind(GeographyAntiCorruptionLayer::class);
```

**RIGHT:**
```php
// Bind dependencies first
$this->app->bind(GeographyService::class, GeographyAntiCorruptionLayer::class);

// Contextual binding for ACL's internal needs
$this->app->when(GeographyAntiCorruptionLayer::class)
    ->needs(GeographyService::class)
    ->give(function ($app) {
        return new GeographyService();
    });

// Then bind services that depend on them
$this->app->bind(MemberGeographyValidator::class, function ($app) {
    return new MemberGeographyValidator(
        $app->make(GeographyAntiCorruptionLayer::class)
    );
});
```

---

## 🧪 **Integration Testing Patterns**

### **Valid Integration Test Structure**

```php
class GeographySeederIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // 1. Setup landlord database (geography)
        Artisan::call('migrate', [
            '--database' => 'landlord_test',
            '--path' => 'database/migrations',
        ]);

        // 2. Setup geography context migrations
        Artisan::call('migrate', [
            '--database' => 'landlord_test',
            '--path' => 'app/Contexts/Geography/Infrastructure/Database/Migrations',
        ]);

        // 3. Seed test data
        $this->artisan('db:seed', [
            '--class' => 'GeographyTestSeeder',
            '--database' => 'landlord_test'
        ]);
    }

    /** @test */
    public function test_geography_seeder_creates_valid_data(): void
    {
        $unitCount = DB::connection('landlord_test')
            ->table('geo_administrative_units')
            ->count();

        $this->assertGreaterThan(0, $unitCount);
    }
}
```

### **Testing Cross-Context Validation**

```php
/** @test */
public function test_member_registration_with_valid_geography(): void
{
    // Setup tenant database
    $this->setupTenantDatabase();

    // Get validator from container
    $validator = app(MemberGeographyValidator::class);

    // Get actual seeded geography IDs
    $geographyIds = $this->getValidGeographyHierarchy('NP');

    // Test validation
    $geoPath = $validator->validateForRegistration('NP', $geographyIds);

    // Assert valid GeoPath returned
    $this->assertInstanceOf(GeoPath::class, $geoPath);
    $this->assertNotEmpty($geoPath->toString());

    // Test member registration service
    $registrationService = app(MemberRegistrationService::class);
    $member = $registrationService->register([
        'name' => 'Test Member',
        'country_code' => 'NP',
        'geography_ids' => $geographyIds,
        // ... other fields
    ]);

    $this->assertNotNull($member->geo_path);
}
```

---

## 🔄 **Deployment Checklist**

### **Pre-Deployment Verification**

1. **Service Bindings:**
   - [ ] All DDD services bound in `AppServiceProvider`
   - [ ] Contextual bindings for anti-corruption layer
   - [ ] No circular dependencies

2. **Database Schema:**
   - [ ] `geo_administrative_units` table exists with correct columns
   - [ ] `members.geo_path` column (ltree type) exists
   - [ ] PostgreSQL ltree extension enabled
   - [ ] GiST indexes on `geo_path` columns

3. **Test Coverage:**
   - [ ] Unit tests for all DDD Value Objects
   - [ ] Integration tests for cross-context validation
   - [ ] GeographyTestSeeder tested with fresh database
   - [ ] All tests pass in CI/CD pipeline

4. **Exception Handling:**
   - [ ] Geography exceptions translated to membership exceptions
   - [ ] No exception messages leak to users
   - [ ] Business rules properly enforced

### **Post-Deployment Monitoring**

1. **Logs to Watch:**
   - Geography validation failures
   - Database connection errors
   - Permission denied errors

2. **Metrics to Track:**
   - Geography validation success rate
   - Average validation time
   - Member registration success rate

3. **Rollback Plan:**
   - Feature flag to revert to legacy validation
   - Database migration rollback scripts
   - Cache clear procedures

---

## ❓ **Frequently Asked Questions**

### **Q1: Why do I get "Target is not instantiable" errors?**
**A:** Check service provider bindings. Each service with constructor dependencies needs a factory closure. Use `php artisan tinker` to test resolution.

### **Q2: How do I debug test database creation issues?**
**A:** Use `php setup_test_db.php --fresh --debug`. This shows detailed output including SQL errors and retry attempts.

### **Q3: Why does GeographyTestSeeder create different IDs than expected?**
**A:** The seeder uses `DB::insert()` which may not return IDs predictably. Always query the database for actual IDs instead of hardcoding.

### **Q4: How do I verify ltree extension is working?**
**A:** In PostgreSQL: `\dx` should list `ltree`. Test with: `SELECT '1.2.3'::ltree;`

### **Q5: What's the difference between `GeographyService` and `GeographyAntiCorruptionLayer`?**
**A:** `GeographyService` is the legacy interface. `GeographyAntiCorruptionLayer` implements this interface but uses DDD patterns internally. Contextual binding provides the legacy implementation when ACL needs it.

### **Q6: How do I add a new country's geography rules?**
**A:** Update the `minimumDepthRequirements` array in `MemberGeographyValidator` and add corresponding test data to `GeographyTestSeeder`.

### **Q7: Why do integration tests need explicit migrations in `setUp()`?**
**A:** `RefreshDatabase` trait only works with the default database connection. Multi-tenant tests need explicit migration calls for each connection.

---

## 📚 **Additional Resources**

1. **Code Files:**
   - `AppServiceProvider.php` - Service bindings
   - `MemberGeographyValidator.php` - Cross-context validation
   - `GeographyAntiCorruptionLayer.php` - DDD bridge
   - `GeographySeederIntegrationTest.php` - Integration test example

2. **Documentation:**
   - DDD Geography Integration Guide (`20251222_0013_membership_contexts_ddd_with_geography.md`)
   - Architecture Decision Records (`architecture/backend/membership-contexts/ddd_connect_geographical_contexts/`)

3. **External Links:**
   - [Laravel Service Container](https://laravel.com/docs/container)
   - [PostgreSQL ltree Extension](https://www.postgresql.org/docs/current/ltree.html)
   - [Domain-Driven Design Patterns](https://domainlanguage.com/ddd/)

---

## 🎯 **Summary**

This debugging guide captures the hard-earned lessons from implementing DDD geography integration. Key takeaways:

1. **Service bindings are critical** - Use factory closures for dependencies
2. **Test with real data** - Never hardcode IDs, always query database
3. **Explicit migrations** - Multi-tenant tests need manual setup
4. **Exception translation** - Keep context boundaries clean
5. **Tooling matters** - Use provided scripts (`setup_test_db.php`, composer scripts)

When in doubt, follow the debugging workflow: isolate, inspect, verify, fix. The system is designed to be debuggable with proper logging and error messages.

**Remember:** The goal is not just to fix issues, but to understand why they occurred and prevent them in the future. Document any new issues and solutions to improve this guide.

---

**Last Updated:** 2025-12-22
**Based on Implementation Experience:** Phase 2 DDD Geography Integration
**Status:** ✅ Production Ready