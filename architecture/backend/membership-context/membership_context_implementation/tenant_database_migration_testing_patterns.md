# Tenant Database Migration Testing Patterns

**Date:** 2026-01-03
**Context:** Public Digit Platform - Membership Context Implementation
**Author:** Claude (Senior Software Architect)

---

## Executive Summary

Analysis of tenant database migration testing patterns reveals a comprehensive TDD approach with strict schema validation, database isolation testing, and cross-database coordination verification. These patterns ensure tenant database migrations are robust, reversible, and maintain strict multi-tenant isolation.

---

## 1. Foundational Testing Pattern: TDD Red/Green/Refactor

### **RED Phase Documentation**
```php
/**
 * @test
 * RED PHASE: This test should FAIL because runTenantMigrations() is currently a stub
 */
public function it_runs_migrations_and_creates_tenant_users_table()
{
    // Tests written to fail initially - confirms TDD workflow
    // Documented expectations guide implementation
}
```

### **Key Characteristics:**
- ✅ **Explicit RED phase labeling** in test method docblocks
- ✅ **Expected failure reasons** documented for each test
- ✅ **TDD workflow verification** - tests fail before implementation
- ✅ **Implementation guidance** - tells developers what to implement

---

## 2. Database Schema Validation Patterns

### **Table Existence Testing**
```php
$this->assertTrue(
    Schema::connection('tenant')->hasTable('tenant_users'),
    'tenant_users table should exist in tenant database'
);
```

### **Column Existence Testing**
```php
// Positive assertion - column must exist
$this->assertTrue(
    Schema::connection('tenant')->hasColumn('tenant_users', 'password_hash'),
    'tenant_users table should have password_hash column'
);

// Negative assertion - column must NOT exist
$this->assertFalse(
    Schema::connection('tenant')->hasColumn('tenant_users', 'password'),
    'tenant_users table should NOT have password column'
);
```

### **Comprehensive Column Validation**
```php
$requiredColumns = [
    'id',
    'uuid',
    'first_name',
    'last_name',
    'email',
    // ... 20+ columns
];

foreach ($requiredColumns as $column) {
    $this->assertTrue(
        Schema::connection('tenant')->hasColumn('tenant_users', $column),
        "tenant_users table should have '{$column}' column"
    );
}
```

**Pattern Benefits:**
- ✅ **Exhaustive validation** - all required columns tested
- ✅ **Clear error messages** - identifies missing columns
- ✅ **Maintainable** - column list easily updated
- ✅ **Documentation** - serves as schema specification

---

## 3. Database Connection Management Patterns

### **Dynamic Connection Switching**
```php
// Connect to tenant database
config(['database.connections.tenant.database' => $this->testDatabaseName]);
DB::purge('tenant');
DB::reconnect('tenant');
```

### **Pattern Sequence:**
1. **Update config** with tenant database name
2. **Purge connection** to clear cached connection
3. **Reconnect** to establish new connection
4. **Use Schema facade** with explicit connection

### **Connection-Aware Assertions**
```php
// Always specify connection in Schema assertions
Schema::connection('tenant')->hasTable('migrations')
Schema::connection('tenant')->hasColumn('tenant_users', 'email')
```

---

## 4. Migration Tracking Verification

### **Migration Table Validation**
```php
$this->assertTrue(
    Schema::connection('tenant')->hasTable('migrations'),
    'Migrations table should exist in tenant database'
);
```

### **Migration Record Verification**
```php
$migrations = DB::connection('tenant')
    ->table('migrations')
    ->where('migration', 'like', '%tenant_users%')
    ->get();

$this->assertGreaterThan(
    0,
    $migrations->count(),
    'At least one tenant_users migration should be recorded'
);
```

### **Specific Migration Verification**
```php
$expectedMigrations = [
    '2025_09_28_143000_create_tenant_users_table',
    '2025_12_06_120000_align_tenant_users_with_universal_core_schema',
    '2025_12_06_130000_complete_tenant_users_alignment',
];

foreach ($expectedMigrations as $expectedMigration) {
    $found = false;
    foreach ($migrationNames as $name) {
        if (str_contains($name, $expectedMigration)) {
            $found = true;
            break;
        }
    }

    $this->assertTrue(
        $found,
        "Migration '{$expectedMigration}' should be recorded in migrations table"
    );
}
```

---

## 5. Test Setup & Cleanup Patterns

### **Test Setup Pattern**
```php
protected function setUp(): void
{
    parent::setUp();

    $this->databaseManager = app(TenantDatabaseManager::class);

    // Create a test tenant in landlord database
    $this->testTenant = PlatformTenant::factory()->create([
        'slug' => 'test-migration',
        'name' => 'Test Migration Tenant',
        'database_name' => $this->testDatabaseName,
        'status' => 'active',
    ]);
}
```

### **Test Cleanup Pattern**
```php
protected function tearDown(): void
{
    // Clean up: Drop test database
    try {
        DB::statement("DROP DATABASE IF EXISTS `{$this->testDatabaseName}`");
    } catch (\Exception $e) {
        // Ignore errors during cleanup
    }

    parent::tearDown();
}
```

### **Pattern Characteristics:**
- ✅ **Factory creation** - uses `PlatformTenant::factory()->create()`
- ✅ **Explicit database naming** - clear test database identifier
- ✅ **Graceful cleanup** - try/catch for cleanup errors
- ✅ **Database isolation** - separate test database per test run

---

## 6. Cross-Context Schema Validation

### **RBAC Table Enhancement Testing**
```php
// Assert: roles table has tenant columns
if (Schema::connection('tenant')->hasTable('roles')) {
    $rolesColumns = ['tenant_id', 'code', 'scope_type', 'is_system_role'];
    foreach ($rolesColumns as $column) {
        $this->assertTrue(
            Schema::connection('tenant')->hasColumn('roles', $column),
            "roles table should have '{$column}' column"
        );
    }
}

// Assert: permissions table has tenant columns
if (Schema::connection('tenant')->hasTable('permissions')) {
    $permissionsColumns = ['tenant_id', 'is_global', 'category'];
    foreach ($permissionsColumns as $column) {
        $this->assertTrue(
            Schema::connection('tenant')->hasColumn('permissions', $column),
            "permissions table should have '{$column}' column"
        );
    }
}
```

### **Organizational Units Table Testing**
```php
// Assert: organizational_units table exists
$this->assertTrue(
    Schema::connection('tenant')->hasTable('organizational_units'),
    'organizational_units table should exist in tenant database'
);

// Assert: Critical columns exist
$requiredColumns = [
    'id',
    'uuid',
    'parent_id',
    'lft',
    'rgt',
    'depth',
    'materialized_path',
    'unit_type',
    'code',
    'name',
    'leader_id',
    'tenant_id',
    'is_active',
];
```

---

## 7. Database Manager Integration Testing

### **Method Call Testing**
```php
// Arrange: Create tenant database first
$this->databaseManager->createTenantDatabase($this->testTenant);

// Act: Run migrations
$result = $this->databaseManager->runTenantMigrations($this->testTenant);

// Assert: Migrations ran successfully
$this->assertTrue($result, 'runTenantMigrations should return true');
```

### **Integration Test Flow:**
1. **Create database** via `createTenantDatabase()`
2. **Run migrations** via `runTenantMigrations()`
3. **Verify success** with boolean return value
4. **Validate schema** with direct database checks

---

## 8. Multi-Tenant Isolation Verification

### **Tenant-Specific Database Testing**
```php
private string $testDatabaseName = 'tenant_test_migration';
```

### **Isolation Principles:**
- ✅ **Unique database names** - prevents test interference
- ✅ **Explicit connection switching** - ensures correct tenant context
- ✅ **Clean database creation** - fresh schema for each test
- ✅ **Complete cleanup** - removes test databases after tests

---

## 9. Error Case Testing Patterns

### **Graceful Error Handling**
```php
try {
    DB::statement("DROP DATABASE IF EXISTS `{$this->testDatabaseName}`");
} catch (\Exception $e) {
    // Ignore errors during cleanup
}
```

### **Missing Migration Testing**
```php
// Tests verify specific migrations exist
// Failure messages indicate which migration is missing
"Migration '2025_12_06_130000_complete_tenant_users_alignment' should be recorded"
```

---

## 10. File Examined

`tests/Feature/TenantAuth/TenantDatabaseMigrationTest.php` - Contains comprehensive tenant database migration testing patterns with:
- 6 detailed test methods
- 100+ assertions across multiple tables
- TDD RED phase documentation
- Cross-table schema validation
- Migration tracking verification

---

## Application to Membership Context

For Membership Context migration testing, apply these patterns:

### **Membership Migration Test Structure**
```php
class MembershipMigrationTest extends TestCase
{
    use RefreshDatabase;

    private string $testDatabaseName = 'tenant_test_membership';

    protected function setUp(): void
    {
        parent::setUp();

        // Create test tenant
        $this->tenant = PlatformTenant::factory()->create([
            'database_name' => $this->testDatabaseName,
        ]);

        // Create tenant database
        $this->databaseManager->createTenantDatabase($this->tenant);
    }

    /** @test */
    public function it_creates_members_table_with_required_columns()
    {
        // Run membership migrations
        $this->databaseManager->runTenantMigrations($this->tenant);

        // Connect to tenant database
        config(['database.connections.tenant.database' => $this->testDatabaseName]);
        DB::purge('tenant');
        DB::reconnect('tenant');

        // Assert members table exists
        $this->assertTrue(
            Schema::connection('tenant')->hasTable('members'),
            'members table should exist'
        );

        // Assert required columns
        $requiredColumns = [
            'id',
            'member_id',
            'tenant_id',
            'tenant_user_id',
            'personal_info',
            'status',
            'registration_channel',
            // ... other membership columns
        ];

        foreach ($requiredColumns as $column) {
            $this->assertTrue(
                Schema::connection('tenant')->hasColumn('members', $column),
                "members table should have '{$column}' column"
            );
        }
    }
}
```

---

## Key Testing Principles

1. **TDD First**: All migration tests follow RED → GREEN → REFACTOR
2. **Schema Validation**: Comprehensive table and column validation
3. **Migration Tracking**: Verify migrations recorded in migrations table
4. **Database Isolation**: Each test uses unique tenant database
5. **Cleanup Assurance**: Test databases cleaned up after tests
6. **Cross-Context Validation**: Test enhancements to existing tables
7. **Error Resilience**: Graceful handling of cleanup errors
8. **Documentation**: Tests serve as migration specifications

---

## Next Steps for Membership Context

1. **Create MembershipMigrationTest** following established patterns
2. **Verify member_id column** exists (current failing test issue)
3. **Test registration_channel column** for mobile API support
4. **Validate tenant_id foreign key** constraints
5. **Test migration rollback** scenarios
6. **Verify index creation** for performance

---
**Status:** Tenant database migration testing patterns analysis complete ✅