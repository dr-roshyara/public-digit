# Platform Branding - Testing Guide

**Document Version:** 1.0
**Last Updated:** 2026-01-06

---

## 📋 Test Coverage Overview

**Total Tests:** 91/91 passing ✅
**Coverage:** 100%

**Breakdown:**
- **Domain Layer:** 80 tests (pure PHP unit tests)
- **Infrastructure Layer:** 11 tests (integration tests with database)

---

## 🏗️ Test Structure

```
tests/
├── Unit/Contexts/Platform/Domain/
│   ├── Entities/
│   │   └── TenantBrandingTest.php (11 tests)
│   └── ValueObjects/
│       ├── BrandingColorTest.php (14 tests)
│       ├── BrandingVisualsTest.php (13 tests)
│       ├── BrandingContentTest.php (14 tests)
│       ├── BrandingIdentityTest.php (15 tests)
│       └── BrandingBundleTest.php (13 tests)
│
└── Unit/Contexts/Platform/Infrastructure/
    └── Repositories/
        └── EloquentTenantBrandingRepositoryTest.php (11 tests)
```

---

## 🎯 Database Testing Setup

### Connection Configuration

**Platform Branding uses landlord database:**

**Production:**
- Connection: `landlord`
- Database: `publicdigit`

**Testing:**
- Connection: `landlord_test`
- Database: `publicdigit_test`

### Test Database Configuration

**1. Ensure test database exists:**

```bash
# Check if test database exists
psql -U postgres -l | grep publicdigit_test

# If not, create it
sudo -u postgres psql -c "CREATE DATABASE publicdigit_test;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE publicdigit_test TO publicdigit_user;"
```

**2. Verify `.env.testing`:**

```env
# .env.testing
DB_CONNECTION=landlord_test
DB_LANDLORD_DATABASE=publicdigit_test
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=publicdigit_user
DB_PASSWORD=your_password
```

**3. Check `config/database.php`:**

```php
'landlord_test' => [
    'driver' => 'pgsql',
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '5432'),
    'database' => env('DB_LANDLORD_DATABASE', 'publicdigit_test'),
    'username' => env('DB_USERNAME', 'publicdigit_user'),
    'password' => env('DB_PASSWORD', ''),
    // ... other config
],
```

### RefreshDatabase Pattern

**Repository tests use `RefreshDatabase` trait correctly:**

```php
use Illuminate\Foundation\Testing\RefreshDatabase;

class EloquentTenantBrandingRepositoryTest extends TestCase
{
    use RefreshDatabase;

    /**
     * CRITICAL: Set connection BEFORE database refresh
     */
    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'landlord_test']);
    }

    /**
     * Specify base migrations to run
     */
    protected function migrateFreshUsing(): array
    {
        return [
            '--database' => 'landlord_test',
            '--path' => 'database/migrations',
            '--realpath' => true,
        ];
    }

    protected function setUp(): void
    {
        parent::setUp();

        // Run Platform context migrations
        $this->artisan('migrate', [
            '--database' => 'landlord_test',
            '--path' => 'app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord',
            '--realpath' => true,
        ]);

        // Create test tenants
        $this->createTestTenant('nrna', 1);
        $this->createTestTenant('munich', 2);

        // Initialize repository
        $this->repository = new EloquentTenantBrandingRepository(
            new TenantBrandingModel()
        );
    }
}
```

**Key Points:**
- `beforeRefreshingDatabase()` runs BEFORE migrations
- Sets `landlord_test` as default connection
- `migrateFreshUsing()` specifies base migrations
- `setUp()` runs Platform context migrations
- Creates test tenants for repository tests

---

## 🧪 Running Tests

### All Branding Tests

```bash
# Run all Platform branding tests
php artisan test tests/Unit/Contexts/Platform/

# Expected output:
# Tests:    91 passed (128 assertions)
# Duration: ~15s
```

### Domain Tests Only

```bash
# All domain tests (fast - no database)
php artisan test tests/Unit/Contexts/Platform/Domain/

# Expected output:
# Tests:    80 passed
# Duration: ~2s
```

### Infrastructure Tests Only

```bash
# Repository tests (slower - uses database)
php artisan test --filter=EloquentTenantBrandingRepositoryTest

# Expected output:
# Tests:    11 passed
# Duration: ~20s (first run includes migrations)
```

### Specific Value Object Tests

```bash
# Test BrandingIdentity (includes organizationTagline tests)
php artisan test tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingIdentityTest

# Test BrandingColor
php artisan test tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingColorTest

# Test BrandingBundle
php artisan test tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingBundleTest
```

### Single Test Method

```bash
# Run specific test
php artisan test --filter=it_can_save_branding_for_tenant

# Run with coverage
php artisan test --filter=it_can_save_branding_for_tenant --coverage
```

---

## ✅ Repository Test Coverage

**File:** `EloquentTenantBrandingRepositoryTest.php`

### Tests Included

1. ✅ **it_implements_repository_interface**
   - Verifies repository implements domain interface

2. ✅ **it_can_save_branding_for_tenant**
   - Creates branding and verifies existence

3. ✅ **it_can_find_branding_for_tenant**
   - Saves and retrieves branding
   - Verifies correct tenant ID

4. ✅ **it_returns_null_when_branding_not_found**
   - Tests graceful handling of missing branding

5. ✅ **it_can_update_existing_branding**
   - Creates, updates, and verifies changes

6. ✅ **it_can_check_if_branding_exists**
   - Tests `existsForTenant()` method

7. ✅ **it_can_delete_branding_for_tenant**
   - Creates, deletes, and verifies removal

8. ✅ **it_enforces_tenant_isolation**
   - Saves for tenant1, verifies tenant2 can't see it

9. ✅ **it_maintains_one_to_one_relationship**
   - Verifies updateOrCreate behavior
   - No duplicate branding for same tenant

10. ✅ **delete_is_idempotent**
    - Deleting non-existent branding doesn't throw error

11. ✅ **it_persists_domain_events_separately**
    - Events are transient, not persisted to database

---

## 🎨 Domain Test Examples

### Testing Value Object Validation

```php
/** @test */
public function it_enforces_organization_tagline_max_length()
{
    $this->expectException(InvalidBrandingException::class);
    $this->expectExceptionMessage('exceeds maximum length of 150 characters');

    $longTagline = str_repeat('a', 151);

    BrandingIdentity::create(
        organizationName: 'Organization',
        organizationTagline: $longTagline
    );
}
```

### Testing Immutability

```php
/** @test */
public function it_can_update_identity_immutably()
{
    $original = BrandingBundle::defaults();

    $newIdentity = BrandingIdentity::create(
        organizationName: 'New Organization',
        organizationTagline: 'New Tagline'
    );

    $updated = $original->withIdentity($newIdentity);

    // Original unchanged
    $this->assertNotSame($original, $updated);

    // New instance has updated identity
    $this->assertSame($newIdentity, $updated->getIdentity());

    // Other components preserved
    $this->assertSame($original->getVisuals(), $updated->getVisuals());
    $this->assertSame($original->getContent(), $updated->getContent());
}
```

### Testing WCAG Compliance

```php
/** @test */
public function it_detects_non_wcag_compliant_colors()
{
    $visuals = BrandingVisuals::create(
        primaryColor: BrandingColor::fromString('#FFEB3B'), // Light yellow
        secondaryColor: BrandingColor::fromString('#FFF176'), // Light yellow
        logoUrl: null
    );

    $bundle = BrandingBundle::create(
        $visuals,
        BrandingContent::defaults(),
        BrandingIdentity::defaults()
    );

    $this->assertFalse($bundle->isWcagCompliant());
}
```

---

## 🔍 Debugging Tests

### Common Issues

**1. Database Connection Error**

```
Error: SQLSTATE[08006]: Connection refused
```

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify test database exists
psql -U postgres -l | grep publicdigit_test

# Check connection in tinker
php artisan tinker
>>> config(['database.default' => 'landlord_test']);
>>> DB::connection()->getDatabaseName();
```

**2. Table Does Not Exist**

```
Error: SQLSTATE[42P01]: Undefined table: tenant_brandings
```

**Solution:**
```bash
# Run migrations manually
php artisan migrate --database=landlord_test --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord

# Verify table exists
psql -U postgres -d publicdigit_test -c "\dt" | grep tenant_brandings
```

**3. RefreshDatabase Not Working**

```
Error: Duplicate table: tenant_brandings already exists
```

**Solution:**
- Ensure `beforeRefreshingDatabase()` sets connection BEFORE migrations
- Verify `migrateFreshUsing()` uses correct database and path
- Check migrations don't have hardcoded `Schema::connection('landlord')`

**4. Tenant Not Found Error**

```
RuntimeException: Tenant with slug 'nrna' not found
```

**Solution:**
```php
// Ensure setUp() creates test tenants
protected function setUp(): void
{
    parent::setUp();

    // ... migrations ...

    // Create test tenants
    $this->createTestTenant('nrna', 1);
    $this->createTestTenant('munich', 2);
}
```

### Debug Mode

**Run tests with verbose output:**

```bash
# Show detailed output
php artisan test --filter=EloquentTenantBrandingRepositoryTest -vvv

# Show SQL queries
DB_LOG_QUERIES=true php artisan test --filter=EloquentTenantBrandingRepositoryTest
```

---

## 📊 Test Performance

**Domain Tests (Pure PHP):**
- **Count:** 80 tests
- **Duration:** ~2 seconds
- **No database required**

**Repository Tests (Integration):**
- **Count:** 11 tests
- **Duration:** ~20 seconds (first run with migrations)
- **Duration:** ~5 seconds (subsequent runs)

**Total:**
- **Count:** 91 tests
- **Duration:** ~15 seconds average

**Optimization Tips:**
- Domain tests run first (fast feedback)
- Use `--filter` to run subset during development
- CI/CD should run full suite

---

## 🚀 CI/CD Configuration

**Example GitHub Actions:**

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: publicdigit_test
          POSTGRES_USER: publicdigit_user
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          extensions: pgsql, pdo_pgsql

      - name: Install Dependencies
        run: composer install --prefer-dist --no-interaction

      - name: Run Platform Branding Tests
        env:
          DB_CONNECTION: landlord_test
          DB_LANDLORD_DATABASE: publicdigit_test
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USERNAME: publicdigit_user
          DB_PASSWORD: test_password
        run: php artisan test tests/Unit/Contexts/Platform/
```

---

## ✅ Test Checklist

Before committing branding changes:

- [ ] All 91 branding tests pass
- [ ] Domain tests pass (80/80)
- [ ] Repository tests pass (11/11)
- [ ] No warnings or deprecations
- [ ] Test coverage remains 100%
- [ ] New features have tests
- [ ] Tests follow naming conventions
- [ ] Tests are properly documented

---

**Next:** [Usage Examples](./05_usage_examples.md)

---

**Last Updated:** 2026-01-06
**Status:** ✅ Production Ready
