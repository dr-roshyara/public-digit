# Standardized Testing Approach for Multi-Tenant DDD Contexts

**Date:** 2026-01-03
**Context:** Public Digit Platform - All Bounded Contexts
**Author:** Claude (Senior Software Architect)

---

## Executive Summary

Based on analysis of existing test patterns across TenantAuth, Geography, ModuleRegistry, and migration testing contexts, this document establishes a standardized testing approach for all bounded contexts in the Public Digit Platform. The approach ensures consistency, maintainability, and architectural compliance while supporting TDD workflows and multi-tenant isolation.

---

## 1. Foundational Principles

### **TDD First (RED → GREEN → REFACTOR)**
```php
/**
 * @test
 * RED PHASE: This test should FAIL because [reason]
 * Expected failure guides implementation
 */
public function it_performs_specific_behavior(): void
{
    // Test written before implementation
    // Documents expected behavior
    // Guides development
}
```

### **Architectural Layer Compliance**
- **Domain Layer**: Pure PHP, no framework dependencies
- **Application Layer**: Framework-agnostic business logic
- **Infrastructure Layer**: Framework-specific implementations
- **API Layer**: HTTP/JSON compliance testing

### **Multi-Tenant Isolation**
- All tests must respect tenant boundaries
- No cross-tenant data leakage
- Tenant-specific database connections
- Tenant-scoped business rules

---

## 2. Test Class Hierarchy & Structure

### **Standard Test Class Structure**
```
tests/
├── Unit/
│   └── Contexts/
│       └── {ContextName}/
│           ├── Domain/                    # Pure domain tests
│           ├── Application/               # Application service tests
│           └── Infrastructure/            # Infrastructure adapter tests
│
├── Feature/
│   └── Contexts/
│       └── {ContextName}/
│           ├── Desktop/                   # Desktop API tests
│           ├── Mobile/                    # Mobile API tests
│           └── Integration/               # Cross-context integration
│
└── Doubles/
    └── Fakes/                            # Test doubles and fakes
```

---

## 3. Base Test Classes & Traits

### **TenantTestCase** (For Tenant-Specific Tests)
```php
abstract class TenantTestCase extends BaseTestCase
{
    protected $tenant;
    protected string $testDatabaseName = 'tenant_test_' . uniqid();

    protected function setUp(): void
    {
        parent::setUp();

        // Switch to landlord connection for tenant creation
        config(['database.default' => 'landlord']);

        // Create test tenant
        $this->tenant = Tenant::factory()->create([
            'slug' => 'test-tenant',
            'database_name' => $this->testDatabaseName,
            'status' => 'active',
        ]);

        // Create tenant database
        $this->createTenantDatabase();

        // Switch to tenant context
        $this->tenant->makeCurrent();

        // Run tenant migrations
        $this->runTenantMigrations();
    }

    protected function tearDown(): void
    {
        // Clean up tenant context
        if ($this->tenant && $this->tenant->exists) {
            $this->tenant->forgetCurrent();
        }

        // Drop test database
        try {
            DB::statement("DROP DATABASE IF EXISTS `{$this->testDatabaseName}`");
        } catch (\Exception $e) {
            // Ignore cleanup errors
        }

        parent::tearDown();
    }

    abstract protected function runTenantMigrations(): void;
    abstract protected function createTenantDatabase(): void;
}
```

### **LandlordTestCase** (For Shared/Landlord Tests)
```php
abstract class LandlordTestCase extends BaseTestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'landlord_test']);
    }

    protected function migrateFreshUsing(): array
    {
        return [
            '--path' => 'app/Contexts/{ContextName}/Infrastructure/Database/Migrations/Landlord',
            '--database' => 'landlord_test',
            '--realpath' => true,
        ];
    }
}
```

### **ApiTestCase** (For API Testing)
```php
abstract class ApiTestCase extends TestCase
{
    use DatabaseTransactions;

    protected $connectionsToTransact = ['tenant_test'];

    protected function setUp(): void
    {
        parent::setUp();

        // Set up tenant for middleware
        $this->createTestTenant();

        // Mock authentication if needed
        $this->mockAuthentication();

        // Fake queues
        Queue::fake();
    }

    abstract protected function createTestTenant(): void;
    abstract protected function mockAuthentication(): void;
}
```

---

## 4. Authentication Mocking Patterns

### **Laravel Auth Facade Mocking**
```php
// Mock specific guard
Auth::shouldReceive('guard')
    ->with('tenant')  // or 'web' for landlord
    ->andReturnSelf();

// Mock authentication attempt
Auth::shouldReceive('attempt')
    ->with($credentials, $remember)
    ->andReturn(true);

// Mock authenticated user
$mockUser = Mockery::mock();
$mockUser->shouldReceive('getAttribute')->with('id')->andReturn(1);
Auth::shouldReceive('user')->andReturn($mockUser);
```

### **TenantContext Service Mocking**
```php
$this->tenantContext = Mockery::mock(TenantContextInterface::class);
$this->tenantContext
    ->shouldReceive('getCurrentTenant')
    ->andReturn($tenant);

$this->tenantContext
    ->shouldReceive('setTenant')
    ->with($tenant)
    ->once();
```

### **Request Session Mocking**
```php
$request = Request::create('/endpoint', 'POST', $data);
$request->shouldReceive('session->regenerate')->once();
$request->shouldReceive('session->pull')
    ->with('url.intended', route('dashboard'))
    ->andReturn(route('dashboard'));
```

---

## 5. Database Connection Management

### **Connection Switching Pattern**
```php
// Switch to tenant database
config(['database.connections.tenant.database' => $tenantDatabaseName]);
DB::purge('tenant');
DB::reconnect('tenant');

// Use connection-aware assertions
Schema::connection('tenant')->hasTable('table_name');
DB::connection('tenant')->table('table_name')->get();
```

### **Multi-Database Test Setup**
```php
protected function setUp(): void
{
    parent::setUp();

    // Landlord operations
    config(['database.default' => 'landlord']);
    $this->createLandlordData();

    // Tenant operations
    config(['database.default' => 'tenant']);
    $this->createTenantData();

    // Reset to default for test
    config(['database.default' => 'landlord_test']);
}
```

### **Transaction Management**
```php
// For DDL operations (CREATE/ALTER TABLE)
use DatabaseTransactions;  // Rolls back data, preserves schema

// For schema changes
use RefreshDatabase;  // Drops and recreates tables

// For performance-critical tests
DB::beginTransaction();
// Test operations
DB::rollBack();
```

---

## 6. Test Data Creation Patterns

### **Factory Pattern**
```php
// Use Laravel factories for Eloquent models
$tenant = Tenant::factory()->create([
    'slug' => 'test-tenant',
    'database_name' => 'tenant_test',
]);

$user = User::factory()->create([
    'tenant_id' => $tenant->id,
    'email' => 'test@example.com',
]);
```

### **Domain Object Creation**
```php
// Create domain value objects
$tenantId = new TenantId('123e4567-e89b-12d3-a456-426614174000');
$email = EmailAddress::fromString('user@example.com');
$slug = TenantSlug::fromString('test-org');

// Create domain entities
$tenant = new Tenant(
    id: $tenantId,
    name: 'Test Organization',
    email: $email,
    slug: $slug,
    status: TenantStatus::active()
);
```

### **Helper Methods for Complex Data**
```php
protected function createFullTenantWithUsers(): Tenant
{
    $tenant = $this->createTenant();
    $this->createAdminUser($tenant);
    $this->createRegularUsers($tenant, 5);
    $this->createPermissions($tenant);
    return $tenant;
}

protected function createAdminUser(Tenant $tenant): User
{
    return User::factory()->create([
        'tenant_id' => $tenant->id,
        'email' => 'admin@' . $tenant->slug . '.com',
        'role' => 'admin',
    ]);
}
```

---

## 7. Migration Testing Patterns

### **Schema Validation Testing**
```php
/** @test */
public function it_creates_table_with_required_columns(): void
{
    // Run migrations
    $this->artisan('migrate', [
        '--path' => 'app/Contexts/{Context}/Infrastructure/Database/Migrations',
        '--database' => 'tenant',
        '--force' => true,
    ]);

    // Validate table existence
    $this->assertTrue(
        Schema::connection('tenant')->hasTable('table_name'),
        'Table should exist'
    );

    // Validate columns
    $requiredColumns = ['id', 'tenant_id', 'created_at', 'updated_at'];
    foreach ($requiredColumns as $column) {
        $this->assertTrue(
            Schema::connection('tenant')->hasColumn('table_name', $column),
            "Table should have '{$column}' column"
        );
    }
}
```

### **Migration Tracking Testing**
```php
/** @test */
public function it_records_migrations_in_migrations_table(): void
{
    // Run migrations
    $this->runMigrations();

    // Verify migrations recorded
    $migrations = DB::connection('tenant')
        ->table('migrations')
        ->where('migration', 'like', '%table_name%')
        ->get();

    $this->assertGreaterThan(0, $migrations->count());
}
```

### **Rollback Testing**
```php
/** @test */
public function it_rolls_back_migrations_successfully(): void
{
    // Run migrations
    $this->runMigrations();
    $this->assertTrue(Schema::hasTable('table_name'));

    // Rollback
    $this->artisan('migrate:rollback', [
        '--path' => 'app/Contexts/{Context}/Infrastructure/Database/Migrations',
        '--database' => 'tenant',
        '--step' => 1,
    ]);

    // Verify rollback
    $this->assertFalse(Schema::hasTable('table_name'));
}
```

---

## 8. API Testing Patterns

### **Mobile API Testing (MAPI)**
```php
class MobileApiTest extends ApiTestCase
{
    /** @test */
    public function mobile_endpoint_returns_correct_format(): void
    {
        $response = $this->postJson('/{tenant}/mapi/v1/endpoint', $payload);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'type',
                    'attributes' => [...],
                    'links' => ['self'],
                ],
                'message',
                'meta' => [...],
            ]);
    }
}
```

### **Desktop API Testing**
```php
class DesktopApiTest extends ApiTestCase
{
    /** @test */
    public function desktop_endpoint_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/endpoint');

        $response->assertStatus(401)
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    /** @test */
    public function authenticated_user_can_access_endpoint(): void
    {
        $this->authenticateAsUser();

        $response = $this->getJson('/api/v1/endpoint');

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => [...]]);
    }
}
```

### **Validation Testing**
```php
/** @test */
public function it_validates_required_fields(): void
{
    $response = $this->postJson('/endpoint', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['field1', 'field2']);
}

/** @test */
public function it_validates_field_formats(): void
{
    $response = $this->postJson('/endpoint', [
        'email' => 'invalid-email',
        'phone' => 'not-a-phone',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email', 'phone']);
}
```

---

## 9. ModuleRegistry Testing Patterns

### **Module Installation Testing**
```php
class ModuleInstallationTest extends TenantTestCase
{
    /** @test */
    public function it_installs_module_with_dependencies(): void
    {
        $module = Module::factory()->create(['requires_subscription' => false]);
        $dependency = Module::factory()->create();

        $result = $this->moduleInstaller->install(
            tenant: $this->tenant,
            module: $module,
            dependencies: [$dependency]
        );

        $this->assertTrue($result);
        $this->assertDatabaseHas('tenant_modules', [
            'tenant_id' => $this->tenant->id,
            'module_id' => $module->id,
            'status' => 'installed',
        ]);
    }
}
```

### **Module Configuration Testing**
```php
/** @test */
public function it_applies_module_configuration(): void
{
    $module = Module::factory()->create([
        'configuration' => ['max_users' => 100, 'allow_export' => true],
    ]);

    $this->moduleInstaller->install($this->tenant, $module);

    $this->assertTrue(
        Schema::connection('tenant')->hasTable('module_specific_table'),
        'Module table should be created'
    );

    $this->assertDatabaseHas('tenant_configurations', [
        'tenant_id' => $this->tenant->id,
        'key' => 'module.max_users',
        'value' => '100',
    ]);
}
```

---

## 10. Cross-Context Integration Testing

### **Event-Based Integration**
```php
class CrossContextIntegrationTest extends TestCase
{
    /** @test */
    public function domain_event_triggers_cross_context_action(): void
    {
        Event::fake();

        // Action in Context A
        $member = $this->membershipService->registerMember($data);

        // Verify event published
        Event::assertDispatched(MemberRegistered::class, function ($event) use ($member) {
            return $event->memberId === $member->id
                && $event->tenantId === $this->tenant->id;
        });

        // Verify Context B receives event
        Event::assertDispatchedToContext(
            GeographyContext::class,
            MemberRegistered::class
        );
    }
}
```

### **Anti-Corruption Layer Testing**
```php
class AntiCorruptionLayerTest extends TestCase
{
    /** @test */
    public function it_converts_legacy_format_to_domain_objects(): void
    {
        $legacyData = [
            'geo_code' => 'np.3.15.234',
            'member_type' => 'regular',
        ];

        $result = $this->antiCorruptionLayer->convertMemberData($legacyData);

        $this->assertInstanceOf(GeographyReference::class, $result->geography);
        $this->assertInstanceOf(MembershipType::class, $result->membershipType);
        $this->assertEquals('np.3.15.234', $result->geography->toString());
    }
}
```

---

## 11. Performance & Load Testing Patterns

### **Multi-Tenant Performance Testing**
```php
class TenantPerformanceTest extends TestCase
{
    /** @test */
    public function it_handles_multiple_tenants_efficiently(): void
    {
        $tenants = collect();
        for ($i = 0; $i < 100; $i++) {
            $tenants->push(Tenant::factory()->create());
        }

        $startTime = microtime(true);

        foreach ($tenants as $tenant) {
            $connectionManager->connectToTenant($tenant);
            User::factory()->create(['tenant_id' => $tenant->id]);
        }

        $totalTime = microtime(true) - $startTime;

        $this->assertLessThan(5.0, $totalTime, 'Should handle 100 tenants in under 5 seconds');
    }
}
```

### **Database Query Optimization Testing**
```php
/** @test */
public function queries_use_proper_indexes(): void
{
    DB::enableQueryLog();

    // Perform operation
    $users = User::where('tenant_id', $this->tenant->id)
        ->where('status', 'active')
        ->orderBy('created_at', 'desc')
        ->paginate(20);

    $queries = DB::getQueryLog();
    $lastQuery = $queries[count($queries) - 1]['query'];

    // Verify index usage (simplified check)
    $this->assertStringContainsString('tenant_id', $lastQuery);
    $this->assertStringContainsString('status', $lastQuery);
}
```

---

## 12. Test Configuration & Environment

### **PHPUnit Configuration**
```xml
<!-- phpunit.xml -->
<php>
    <env name="APP_ENV" value="testing"/>
    <env name="DB_CONNECTION" value="sqlite"/>
    <env name="DB_DATABASE" value=":memory:"/>
    <env name="TENANT_TEST_DATABASE_PREFIX" value="tenant_test_"/>
    <env name="LANDLORD_TEST_DATABASE" value="landlord_test"/>
</php>
```

### **Database Configuration**
```php
// config/database.php (testing section)
'testing' => [
    'landlord_test' => [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
    ],
    'tenant_test' => [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => 'tenant_',
    ],
],
```

### **Test Environment Variables**
```bash
# .env.testing
APP_ENV=testing
DB_CONNECTION=sqlite
DB_DATABASE=:memory:
TENANT_TEST_DATABASE_PREFIX=tenant_test_
LANDLORD_TEST_DATABASE=landlord_test
QUEUE_CONNECTION=sync
CACHE_DRIVER=array
SESSION_DRIVER=array
```

---

## 13. Code Coverage & Quality Standards

### **Minimum Coverage Requirements**
- **Domain Layer**: 95%+ (business logic critical)
- **Application Layer**: 85%+ (orchestration logic)
- **Infrastructure Layer**: 80%+ (adapter implementations)
- **API Layer**: 75%+ (HTTP endpoints)

### **Coverage Configuration**
```xml
<!-- phpunit.xml -->
<coverage>
    <include>
        <directory suffix=".php">app/Contexts</directory>
    </include>
    <exclude>
        <directory suffix=".php">app/Contexts/*/Infrastructure/Providers</directory>
        <directory suffix=".php">app/Console</directory>
        <directory suffix=".php">app/Exceptions</directory>
    </exclude>
    <report>
        <clover outputFile="build/logs/clover.xml"/>
        <html outputDirectory="build/coverage"/>
        <text outputFile="build/coverage.txt"/>
    </report>
</coverage>
```

### **Quality Gates**
```bash
# Run tests with coverage
php artisan test --coverage --min=80

# Run specific context tests
php artisan test tests/Feature/Contexts/Membership/

# Run with verbose output
php artisan test --verbose
```

---

## 14. Implementation Checklist for New Contexts

### **Step 1: Test Infrastructure**
- [ ] Create base test classes (TenantTestCase, LandlordTestCase)
- [ ] Set up database configurations
- [ ] Create factory definitions
- [ ] Configure PHPUnit for context

### **Step 2: Domain Layer Tests**
- [ ] Write value object tests (pure PHP)
- [ ] Write entity tests (business rules)
- [ ] Write domain service tests
- [ ] Write domain event tests

### **Step 3: Application Layer Tests**
- [ ] Write command/query tests
- [ ] Write handler tests
- [ ] Write application service tests
- [ ] Test tenant isolation

### **Step 4: Infrastructure Layer Tests**
- [ ] Write repository implementation tests
- [ ] Write adapter tests
- [ ] Write migration tests
- [ ] Test database operations

### **Step 5: API Layer Tests**
- [ ] Write mobile API tests (MAPI)
- [ ] Write desktop API tests
- [ ] Write validation tests
- [ ] Write authentication tests

### **Step 6: Integration Tests**
- [ ] Write cross-context integration tests
- [ ] Write event handler tests
- [ ] Write anti-corruption layer tests
- [ ] Write end-to-end workflow tests

---

## 15. Common Pitfalls & Solutions

### **Pitfall 1: Cross-Database Foreign Keys**
```php
// ❌ WRONG: Cross-database foreign key
$table->foreign('user_id')->references('id')->on('landlord.users');

// ✅ SOLUTION: Store ID without foreign key
$table->unsignedBigInteger('user_id')->nullable();
// Application logic validates reference
```

### **Pitfall 2: Framework Dependencies in Domain**
```php
// ❌ WRONG: Illuminate dependency in domain
use Illuminate\Support\Str;

// ✅ SOLUTION: Pure PHP implementation
class DomainClass {
    public function generateId(): string
    {
        return bin2hex(random_bytes(16));
    }
}
```

### **Pitfall 3: Tenant Context Leakage**
```php
// ❌ WRONG: Global tenant resolution
$tenant = Tenant::current(); // Assumes current context

// ✅ SOLUTION: Explicit tenant parameter
public function process(TenantInterface $tenant, $data)
{
    // Tenant explicitly passed
    $this->switchToTenant($tenant);
    // Operations...
}
```

### **Pitfall 4: Incomplete Cleanup**
```php
// ❌ WRONG: No cleanup
protected function tearDown(): void
{
    parent::tearDown();
}

// ✅ SOLUTION: Comprehensive cleanup
protected function tearDown(): void
{
    // Clean tenant context
    $this->tenant->forgetCurrent();

    // Drop test database
    try {
        DB::statement("DROP DATABASE IF EXISTS `{$this->testDatabaseName}`");
    } catch (\Exception $e) {
        // Log but continue
    }

    parent::tearDown();
}
```

---

## 16. Template Test Files

### **Domain Value Object Test Template**
```php
<?php

namespace Tests\Unit\Contexts\{Context}\Domain\ValueObjects;

use App\Contexts\{Context}\Domain\ValueObjects\{ValueObjectName};
use Tests\TestCase;

class {ValueObjectName}Test extends TestCase
{
    /** @test */
    public function it_creates_from_valid_value(): void
    {
        $vo = {ValueObjectName}::fromString('valid-value');

        $this->assertInstanceOf({ValueObjectName}::class, $vo);
        $this->assertEquals('valid-value', $vo->toString());
    }

    /** @test */
    public function it_rejects_invalid_value(): void
    {
        $this->expectException(InvalidArgumentException::class);

        {ValueObjectName}::fromString('invalid-value');
    }

    /** @test */
    public function it_is_immutable(): void
    {
        $vo1 = {ValueObjectName}::fromString('value1');
        $vo2 = {ValueObjectName}::fromString('value2');

        $this->assertFalse($vo1->equals($vo2));
    }
}
```

### **Mobile API Test Template**
```php
<?php

namespace Tests\Feature\Contexts\{Context}\Mobile;

use Tests\TestCase;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class {Context}MobileApiTest extends TestCase
{
    use DatabaseTransactions;

    protected $connectionsToTransact = ['tenant_test'];

    protected function setUp(): void
    {
        parent::setUp();

        $this->createTestTenant();
        $this->mockAuthentication();
        Queue::fake();
    }

    /** @test */
    public function it_returns_correct_json_structure(): void
    {
        $response = $this->postJson('/{tenant}/mapi/v1/endpoint', [
            // Test data
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'type',
                    'attributes' => [
                        // Expected attributes
                    ],
                    'links' => ['self'],
                ],
                'message',
                'meta' => [
                    // Expected meta
                ],
            ]);
    }

    private function createTestTenant(): void
    {
        // Tenant creation logic
    }

    private function mockAuthentication(): void
    {
        // Authentication mocking
    }
}
```

---

## Summary

This standardized testing approach ensures:

1. **Consistency**: All contexts follow the same patterns
2. **Maintainability**: Tests are organized and readable
3. **Architectural Compliance**: DDD layers respected
4. **Multi-Tenant Safety**: Tenant isolation maintained
5. **TDD Workflow**: Tests guide development
6. **Quality Assurance**: Comprehensive coverage

**Next Steps for Membership Context:**
1. Apply these patterns to fix current Membership tests
2. Create missing test infrastructure
3. Ensure member_id column exists in migrations
4. Implement comprehensive test suite

---
**Status:** Standardized testing approach defined ✅