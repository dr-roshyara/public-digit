# Testing Guide - Developer Guide

**Test-Driven Development for Multi-Tenancy System**

---

## Table of Contents

1. [Overview](#overview)
2. [TDD Approach](#tdd-approach)
3. [Test Structure](#test-structure)
4. [Unit Tests](#unit-tests)
5. [Feature Tests](#feature-tests)
6. [Integration Tests](#integration-tests)
7. [Test Coverage](#test-coverage)
8. [Running Tests](#running-tests)

---

## Overview

The multi-tenancy template system follows **strict Test-Driven Development (TDD)** principles:

### Testing Requirements

✅ **MUST:**
- Write tests BEFORE implementation (red-green-refactor)
- Maintain 80%+ test coverage
- Test all public methods
- Test error conditions and edge cases
- Test tenant isolation (no cross-tenant data access)

❌ **MUST NOT:**
- Write code without tests
- Skip tests for "simple" methods
- Test only happy paths
- Ignore failing tests

### Test Types

| Type | Purpose | Example |
|------|---------|---------|
| **Unit Tests** | Test individual methods in isolation | Test `calculateSchemaHash()` method |
| **Feature Tests** | Test complete features end-to-end | Test template application workflow |
| **Integration Tests** | Test interaction between components | Test service + model + database |

---

## TDD Approach

### Red-Green-Refactor Cycle

```
1. RED → Write failing test
   ↓
2. GREEN → Write minimum code to pass
   ↓
3. REFACTOR → Improve code quality
   ↓
4. REPEAT
```

### Example: TDD Workflow for New Feature

**Requirement:** Add method to check if template has specific module

#### Step 1: RED (Write Failing Test)

```php
// tests/Unit/Models/TenantTemplateTest.php

/** @test */
public function it_can_check_if_template_has_module(): void
{
    $template = TenantTemplate::factory()->create([
        'required_modules' => [1, 2, 3],
        'optional_modules' => [4, 5],
    ]);

    $this->assertTrue($template->hasModule(1)); // Required module
    $this->assertTrue($template->hasModule(5)); // Optional module
    $this->assertFalse($template->hasModule(99)); // Not included
}
```

**Run test** (should FAIL):
```bash
php artisan test --filter=it_can_check_if_template_has_module

# Error: Call to undefined method hasModule()
```

#### Step 2: GREEN (Implement Method)

```php
// app/Models/TenantTemplate.php

public function hasModule(int $moduleId): bool
{
    return in_array($moduleId, $this->required_modules ?? [])
        || in_array($moduleId, $this->optional_modules ?? []);
}
```

**Run test** (should PASS):
```bash
php artisan test --filter=it_can_check_if_template_has_module

# PASS  Tests\Unit\Models\TenantTemplateTest
# ✓ it can check if template has module
```

#### Step 3: REFACTOR (Improve If Needed)

```php
// Already clean, no refactoring needed
```

#### Step 4: Add Edge Cases

```php
/** @test */
public function it_returns_false_when_no_modules_defined(): void
{
    $template = TenantTemplate::factory()->create([
        'required_modules' => null,
        'optional_modules' => null,
    ]);

    $this->assertFalse($template->hasModule(1));
}

/** @test */
public function it_returns_false_when_empty_modules_array(): void
{
    $template = TenantTemplate::factory()->create([
        'required_modules' => [],
        'optional_modules' => [],
    ]);

    $this->assertFalse($template->hasModule(1));
}
```

---

## Test Structure

### Directory Structure

```
tests/
├── Feature/
│   ├── TemplateProvisioningTest.php      # Template application
│   ├── TemplateVersionUpdateTest.php     # Version updates
│   ├── ModuleInstallationTest.php        # Module installation
│   └── SchemaDriftDetectionTest.php      # Drift detection
│
├── Unit/
│   ├── Models/
│   │   ├── TenantTemplateTest.php
│   │   ├── TemplateModuleTest.php
│   │   ├── TemplateVersionTest.php
│   │   └── TenantTemplateHistoryTest.php
│   └── Services/
│       └── TemplateProvisioningServiceTest.php
│
└── Integration/
    └── TenantIsolationTest.php           # Cross-tenant access prevention
```

### Naming Conventions

```php
// ✅ GOOD: Descriptive test names
/** @test */
public function it_applies_template_to_tenant_successfully(): void

/** @test */
public function it_throws_exception_when_template_is_inactive(): void

/** @test */
public function it_calculates_schema_hash_correctly(): void

// ❌ BAD: Vague test names
/** @test */
public function test1(): void

/** @test */
public function testTemplateApplication(): void
```

---

## Unit Tests

### Example 1: Model Test

```php
// tests/Unit/Models/TenantTemplateTest.php

namespace Tests\Unit\Models;

use App\Models\TenantTemplate;
use App\Models\TemplateModule;
use App\Models\TemplateVersion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantTemplateTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_has_fillable_attributes(): void
    {
        $fillable = [
            'name', 'slug', 'type', 'version', 'description',
            'schema_sql', 'seed_sql', 'config',
            'required_modules', 'optional_modules',
            'is_active', 'is_default', 'metadata', 'usage_count',
        ];

        $template = new TenantTemplate();

        $this->assertEquals($fillable, $template->getFillable());
    }

    /** @test */
    public function it_casts_attributes_correctly(): void
    {
        $template = TenantTemplate::factory()->create([
            'config' => ['key' => 'value'],
            'required_modules' => [1, 2, 3],
            'is_active' => true,
        ]);

        $this->assertIsArray($template->config);
        $this->assertIsArray($template->required_modules);
        $this->assertIsBool($template->is_active);
    }

    /** @test */
    public function it_has_modules_relationship(): void
    {
        $template = TenantTemplate::factory()->create();
        $module = TemplateModule::factory()->create(['template_id' => $template->id]);

        $this->assertTrue($template->modules->contains($module));
    }

    /** @test */
    public function it_can_get_current_version(): void
    {
        $template = TenantTemplate::factory()->create();

        TemplateVersion::factory()->create([
            'template_id' => $template->id,
            'version' => '1.0.0',
            'is_current' => false,
        ]);

        $currentVersion = TemplateVersion::factory()->create([
            'template_id' => $template->id,
            'version' => '1.1.0',
            'is_current' => true,
        ]);

        $this->assertEquals($currentVersion->id, $template->getCurrentVersion()->id);
    }

    /** @test */
    public function it_filters_active_templates(): void
    {
        TenantTemplate::factory()->create(['is_active' => true, 'name' => 'Active Template']);
        TenantTemplate::factory()->create(['is_active' => false, 'name' => 'Inactive Template']);

        $activeTemplates = TenantTemplate::active()->get();

        $this->assertCount(1, $activeTemplates);
        $this->assertEquals('Active Template', $activeTemplates->first()->name);
    }

    /** @test */
    public function it_increments_usage_count(): void
    {
        $template = TenantTemplate::factory()->create(['usage_count' => 5]);

        $template->incrementUsage();

        $this->assertEquals(6, $template->fresh()->usage_count);
    }
}
```

### Example 2: Service Method Test

```php
// tests/Unit/Services/TemplateProvisioningServiceTest.php

namespace Tests\Unit\Services;

use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use Tests\TestCase;

class TemplateProvisioningServiceTest extends TestCase
{
    /** @test */
    public function it_splits_sql_statements_correctly(): void
    {
        $service = new TemplateProvisioningService();

        $sql = "
            CREATE TABLE users (id INT);
            CREATE TABLE posts (id INT);
            -- Comment line
            INSERT INTO users VALUES (1);
        ";

        // Use reflection to access private method
        $reflection = new \ReflectionClass($service);
        $method = $reflection->getMethod('splitSQLStatements');
        $method->setAccessible(true);

        $statements = $method->invoke($service, $sql);

        $this->assertCount(3, $statements);
        $this->assertStringContainsString('CREATE TABLE users', $statements[0]);
        $this->assertStringContainsString('CREATE TABLE posts', $statements[1]);
        $this->assertStringContainsString('INSERT INTO users', $statements[2]);
    }

    /** @test */
    public function it_removes_sql_comments(): void
    {
        $service = new TemplateProvisioningService();

        $sql = "
            -- Single line comment
            CREATE TABLE users (id INT); -- Inline comment
            /* Multi-line
               comment */
            INSERT INTO users VALUES (1);
        ";

        $reflection = new \ReflectionClass($service);
        $method = $reflection->getMethod('splitSQLStatements');
        $method->setAccessible(true);

        $statements = $method->invoke($service, $sql);

        foreach ($statements as $statement) {
            $this->assertStringNotContainsString('--', $statement);
            $this->assertStringNotContainsString('/*', $statement);
        }
    }
}
```

---

## Feature Tests

### Example 1: Template Application

```php
// tests/Feature/TemplateProvisioningTest.php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Models\TemplateModule;
use App\Models\TenantTemplateHistory;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TemplateProvisioningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create RBAC module
        $this->rbacModule = TemplateModule::factory()->create([
            'slug' => 'rbac',
            'name' => 'RBAC Module',
            'module_type' => 'core',
            'is_optional' => false,
        ]);

        // Create template
        $this->template = TenantTemplate::factory()->create([
            'slug' => 'test_template',
            'required_modules' => [$this->rbacModule->id],
        ]);

        // Create test tenant
        $this->tenant = Tenant::factory()->create([
            'slug' => 'test-tenant',
            'database_name' => 'tenant_test',
        ]);

        // Create tenant database
        DB::statement('CREATE DATABASE IF NOT EXISTS tenant_test');
    }

    protected function tearDown(): void
    {
        // Drop tenant database
        DB::statement('DROP DATABASE IF EXISTS tenant_test');

        parent::tearDown();
    }

    /** @test */
    public function it_applies_template_to_tenant_successfully(): void
    {
        $service = new TemplateProvisioningService();

        $history = $service->applyTemplate($this->tenant, $this->template);

        $this->assertEquals('completed', $history->status);
        $this->assertEquals('synced', $this->tenant->fresh()->schema_status);
        $this->assertNotNull($this->tenant->fresh()->initial_schema_hash);
    }

    /** @test */
    public function it_creates_history_record_for_template_application(): void
    {
        $service = new TemplateProvisioningService();

        $service->applyTemplate($this->tenant, $this->template);

        $this->assertDatabaseHas('tenant_template_history', [
            'tenant_id' => $this->tenant->id,
            'template_id' => $this->template->id,
            'action' => 'create',
            'status' => 'completed',
        ]);
    }

    /** @test */
    public function it_increments_template_usage_count(): void
    {
        $initialCount = $this->template->usage_count;

        $service = new TemplateProvisioningService();
        $service->applyTemplate($this->tenant, $this->template);

        $this->assertEquals($initialCount + 1, $this->template->fresh()->usage_count);
    }

    /** @test */
    public function it_throws_exception_when_template_is_inactive(): void
    {
        $this->template->update(['is_active' => false]);

        $service = new TemplateProvisioningService();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not active');

        $service->applyTemplate($this->tenant, $this->template);
    }

    /** @test */
    public function it_creates_required_tables_in_tenant_database(): void
    {
        $service = new TemplateProvisioningService();
        $service->applyTemplate($this->tenant, $this->template);

        // Switch to tenant database
        config(['database.connections.tenant.database' => 'tenant_test']);
        DB::purge('tenant');
        DB::reconnect('tenant');

        // Check required tables exist
        $this->assertTrue(Schema::connection('tenant')->hasTable('permissions'));
        $this->assertTrue(Schema::connection('tenant')->hasTable('roles'));
    }

    /** @test */
    public function it_rolls_back_on_failure(): void
    {
        // Create template with invalid SQL
        $invalidTemplate = TenantTemplate::factory()->create([
            'schema_sql' => 'INVALID SQL SYNTAX;',
        ]);

        $service = new TemplateProvisioningService();

        try {
            $service->applyTemplate($this->tenant, $invalidTemplate);
        } catch (\Exception $e) {
            // Expected exception
        }

        // Check tenant metadata was rolled back
        $this->assertNull($this->tenant->fresh()->template_id);
        $this->assertEquals('unknown', $this->tenant->fresh()->schema_status);

        // Check history marked as failed
        $this->assertDatabaseHas('tenant_template_history', [
            'tenant_id' => $this->tenant->id,
            'status' => 'failed',
        ]);
    }
}
```

### Example 2: Version Update

```php
// tests/Feature/TemplateVersionUpdateTest.php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Models\TemplateVersion;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TemplateVersionUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create template
        $this->template = TenantTemplate::factory()->create();

        // Create versions
        $this->v1 = TemplateVersion::factory()->create([
            'template_id' => $this->template->id,
            'version' => '1.0.0',
            'is_current' => false,
        ]);

        $this->v2 = TemplateVersion::factory()->create([
            'template_id' => $this->template->id,
            'version' => '1.1.0',
            'previous_version' => '1.0.0',
            'migration_sql' => 'ALTER TABLE test ADD COLUMN new_field VARCHAR(255);',
            'is_current' => true,
        ]);

        // Create tenant with v1.0.0 applied
        $this->tenant = Tenant::factory()->create([
            'template_id' => $this->template->id,
            'template_version' => '1.0.0',
        ]);

        DB::statement('CREATE DATABASE IF NOT EXISTS tenant_test');
        $this->tenant->update(['database_name' => 'tenant_test']);
    }

    protected function tearDown(): void
    {
        DB::statement('DROP DATABASE IF EXISTS tenant_test');
        parent::tearDown();
    }

    /** @test */
    public function it_updates_tenant_to_new_version(): void
    {
        $service = new TemplateProvisioningService();

        $history = $service->updateTemplateVersion($this->tenant, $this->v2);

        $this->assertEquals('completed', $history->status);
        $this->assertEquals('1.1.0', $this->tenant->fresh()->template_version);
    }

    /** @test */
    public function it_records_version_update_history(): void
    {
        $service = new TemplateProvisioningService();

        $service->updateTemplateVersion($this->tenant, $this->v2);

        $this->assertDatabaseHas('tenant_template_history', [
            'tenant_id' => $this->tenant->id,
            'action' => 'update',
            'from_version' => '1.0.0',
            'to_version' => '1.1.0',
            'status' => 'completed',
        ]);
    }

    /** @test */
    public function it_throws_exception_when_migration_sql_missing(): void
    {
        $versionWithoutMigration = TemplateVersion::factory()->create([
            'template_id' => $this->template->id,
            'version' => '1.2.0',
            'migration_sql' => null,
        ]);

        $service = new TemplateProvisioningService();

        $this->expectException(\RuntimeException::class);

        $service->updateTemplateVersion($this->tenant, $versionWithoutMigration);
    }
}
```

---

## Integration Tests

### Example: Tenant Isolation Test

```php
// tests/Integration/TenantIsolationTest.php

namespace Tests\Integration;

use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function tenants_have_separate_databases(): void
    {
        $template = TenantTemplate::factory()->create();

        $tenant1 = Tenant::factory()->create([
            'slug' => 'tenant-one',
            'database_name' => 'tenant_one',
        ]);

        $tenant2 = Tenant::factory()->create([
            'slug' => 'tenant-two',
            'database_name' => 'tenant_two',
        ]);

        // Create databases
        DB::statement('CREATE DATABASE tenant_one');
        DB::statement('CREATE DATABASE tenant_two');

        // Apply template to both
        $service = new TemplateProvisioningService();
        $service->applyTemplate($tenant1, $template);
        $service->applyTemplate($tenant2, $template);

        // Insert data into tenant1
        config(['database.connections.tenant.database' => 'tenant_one']);
        DB::purge('tenant');
        DB::reconnect('tenant');
        DB::connection('tenant')->table('roles')->insert(['name' => 'admin', 'guard_name' => 'web']);

        // Check tenant2 doesn't have this data
        config(['database.connections.tenant.database' => 'tenant_two']);
        DB::purge('tenant');
        DB::reconnect('tenant');

        $roles = DB::connection('tenant')->table('roles')->get();
        $this->assertCount(0, $roles);

        // Cleanup
        DB::statement('DROP DATABASE tenant_one');
        DB::statement('DROP DATABASE tenant_two');
    }

    /** @test */
    public function schema_hash_is_unique_per_tenant(): void
    {
        $template = TenantTemplate::factory()->create();

        $tenant1 = Tenant::factory()->create(['database_name' => 'tenant_a']);
        $tenant2 = Tenant::factory()->create(['database_name' => 'tenant_b']);

        DB::statement('CREATE DATABASE tenant_a');
        DB::statement('CREATE DATABASE tenant_b');

        $service = new TemplateProvisioningService();
        $service->applyTemplate($tenant1, $template);
        $service->applyTemplate($tenant2, $template);

        // Initially same hash (same template)
        $this->assertEquals($tenant1->initial_schema_hash, $tenant2->initial_schema_hash);

        // Modify tenant1 schema
        config(['database.connections.tenant.database' => 'tenant_a']);
        DB::purge('tenant');
        DB::reconnect('tenant');
        DB::connection('tenant')->statement('CREATE TABLE custom_table (id INT)');

        // Recalculate hashes
        $reflection = new \ReflectionClass($service);
        $method = $reflection->getMethod('calculateSchemaHash');
        $method->setAccessible(true);

        $hash1 = $method->invoke($service, 'tenant_a');
        $hash2 = $method->invoke($service, 'tenant_b');

        // Hashes should now differ
        $this->assertNotEquals($hash1, $hash2);

        // Cleanup
        DB::statement('DROP DATABASE tenant_a');
        DB::statement('DROP DATABASE tenant_b');
    }
}
```

---

## Test Coverage

### Coverage Requirements

- **Minimum**: 80% overall coverage
- **Models**: 90%+ coverage (all public methods)
- **Services**: 85%+ coverage (all business logic)
- **Controllers**: 75%+ coverage (main flows)

### Generating Coverage Report

```bash
# HTML coverage report
php artisan test --coverage-html coverage

# Terminal coverage report
php artisan test --coverage

# Minimum coverage check (fails if below 80%)
php artisan test --coverage --min=80
```

### Example Coverage Output

```
Tests:  42 passed
Time:   15.23s

  App\Models\TenantTemplate .................... 95.2%
  App\Models\TemplateModule ..................... 92.8%
  App\Models\TemplateVersion .................... 88.5%
  App\Models\TenantTemplateHistory .............. 91.3%
  App\Contexts\Platform\...\TemplateProvisioningService ... 87.4%

  Total coverage ............................... 89.7%
```

---

## Running Tests

### Run All Tests

```bash
php artisan test
```

### Run Specific Test File

```bash
php artisan test tests/Feature/TemplateProvisioningTest.php
```

### Run Specific Test Method

```bash
php artisan test --filter=it_applies_template_to_tenant_successfully
```

### Run Tests by Group

```php
/** @test @group templates */
public function it_applies_template(): void { ... }

/** @test @group modules */
public function it_installs_module(): void { ... }
```

```bash
php artisan test --group=templates
php artisan test --group=modules
```

### Run Tests in Parallel

```bash
php artisan test --parallel
```

### Watch Mode (Re-run on file changes)

```bash
# Install package
composer require --dev spatie/phpunit-watcher

# Run watcher
./vendor/bin/phpunit-watcher watch
```

---

**Next:** [09 - API Reference](09-api-reference.md)
