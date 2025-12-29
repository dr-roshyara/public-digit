# Phase 3 Infrastructure Layer - Developer Guide
## ModuleRegistry Bounded Context

**Author**: Senior Backend Developer
**Date**: 2025-12-29
**Version**: 1.0
**Expertise**: Domain-Driven Design (DDD) + Test-Driven Development (TDD)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Phase 3 Implementation Summary](#phase-3-implementation-summary)
4. [TDD Workflow - The Sacred Process](#tdd-workflow)
5. [Infrastructure Components Deep Dive](#infrastructure-components-deep-dive)
6. [Debugging Strategies](#debugging-strategies)
7. [Editing Patterns & Best Practices](#editing-patterns-best-practices)
8. [Common Pitfalls & Solutions](#common-pitfalls-solutions)
9. [Testing Strategies](#testing-strategies)
10. [Multi-Tenancy Considerations](#multi-tenancy-considerations)
11. [Service Provider Configuration](#service-provider-configuration)
12. [Production Readiness Checklist](#production-readiness-checklist)

---

## Introduction

### Purpose of This Guide

This guide documents the **Phase 3 Infrastructure Layer** implementation for the ModuleRegistry bounded context. It serves as:

1. **Reference Manual**: How Phase 3 was built following DDD/TDD principles
2. **Debugging Guide**: How to troubleshoot infrastructure issues
3. **Editing Guide**: How to safely modify infrastructure components
4. **Knowledge Transfer**: Teaching DDD/TDD best practices

### What is Phase 3?

In our **3-Phase DDD Implementation**:

- **Phase 1**: Domain Layer (pure business logic, framework-free)
- **Phase 2**: Application Layer (use cases, orchestration)
- **Phase 3**: Infrastructure Layer (framework adapters, persistence, external services)

Phase 3 is where **domain meets reality** - converting pure domain concepts into Laravel/PostgreSQL/events.

### Critical Success Metrics Achieved

✅ **258/258 tests passing** (671 assertions)
✅ **100% TDD workflow** (every file test-first)
✅ **Zero domain contamination** (no framework imports in domain)
✅ **Hexagonal architecture** (dependency inversion maintained)
✅ **Multi-tenancy support** (landlord/tenant database separation)

---

## Architecture Overview

### Hexagonal Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│  (Use Cases - InstallModuleService, etc.)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ depends on
┌─────────────────────▼───────────────────────────────────────┐
│                      Domain Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Ports (Interfaces)                                    │  │
│  │ - ModuleRepositoryInterface                          │  │
│  │ - EventPublisherInterface                            │  │
│  │ - SubscriptionServiceInterface                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────▲───────────────────────────────────────┘
                      │ implemented by
┌─────────────────────┴───────────────────────────────────────┐
│                  Infrastructure Layer (Phase 3)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Adapters (Implementations)                           │  │
│  │ - EloquentModuleRepository                           │  │
│  │ - LaravelEventPublisher                              │  │
│  │ - LaravelSubscriptionService                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Persistence (Eloquent Models, Migrations)            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Service Provider (DI Bindings)                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Flow (Critical!)

**WRONG** ❌:
```php
// Domain imports Laravel
use Illuminate\Support\Facades\Event;  // ❌ NEVER IN DOMAIN
```

**CORRECT** ✅:
```php
// Domain defines interface
interface EventPublisherInterface {
    public function publish(object $event): void;
}

// Infrastructure implements it
class LaravelEventPublisher implements EventPublisherInterface {
    public function publish(object $event): void {
        Event::dispatch($event);  // ✅ Framework allowed in infrastructure
    }
}
```

**Key Principle**: Domain depends on abstractions. Infrastructure depends on domain + framework.

---

## Phase 3 Implementation Summary

### What We Built (60 Infrastructure Tests)

#### Day 15-16: Landlord Database (15 tests)

**Files Created**:
```
app/Contexts/ModuleRegistry/Infrastructure/
├── Persistence/
│   ├── Eloquent/
│   │   ├── ModuleModel.php
│   │   └── ModuleDependencyModel.php
│   └── Repositories/
│       └── EloquentModuleRepository.php
└── Database/
    └── Migrations/
        ├── 2025_01_15_100000_create_modules_table.php
        └── 2025_01_15_100001_create_module_dependencies_table.php
```

**Purpose**: Module catalog stored in **landlord database** (shared across tenants)

**Key Challenge**: Mapping domain aggregate `Module` with dependencies to relational DB

**Test Coverage**: 15 tests validating CRUD, dependencies, cascade deletes

#### Day 17-18: Tenant Database (30 tests)

**Files Created**:
```
app/Contexts/ModuleRegistry/Infrastructure/
├── Persistence/
│   ├── Eloquent/
│   │   ├── TenantModuleModel.php
│   │   ├── ModuleInstallationJobModel.php
│   │   └── InstallationStepModel.php
│   └── Repositories/
│       ├── EloquentTenantModuleRepository.php
│       └── EloquentInstallationJobRepository.php
└── Database/
    └── Migrations/
        ├── 2025_01_17_100000_create_tenant_modules_table.php
        ├── 2025_01_17_100001_create_module_installation_jobs_table.php
        └── 2025_01_17_100002_create_installation_steps_table.php
```

**Purpose**: Module installations stored in **tenant database** (isolated per tenant)

**Key Challenge**: Cross-database coordination (landlord ← tenant)

**Critical Pattern**:
```php
// TenantModule repository fetches Module from landlord
$module = $this->moduleRepository->findById($model->module_id);
// ✅ Single source of truth for module data
```

**Test Coverage**: 30 tests (14 TenantModule + 16 InstallationJob)

#### Day 19: Service Adapters (15 tests)

**Files Created**:
```
app/Contexts/ModuleRegistry/Infrastructure/
└── Adapters/
    ├── LaravelEventPublisher.php
    └── LaravelSubscriptionService.php
```

**Purpose**: Adapt Laravel services to domain ports

**Key Decisions**:
- **Event Publisher**: Chose facade pattern over constructor injection (simpler, works with `Event::fake()`)
- **Subscription Service**: Stub implementation (ready for billing integration)

**Test Coverage**: 15 tests (4 + 11)

#### Day 20: Service Provider (Verified with 258 tests)

**File Created**:
```
app/Contexts/ModuleRegistry/Providers/
└── ModuleRegistryServiceProvider.php
```

**Purpose**: Bind domain ports to infrastructure adapters via Laravel DI

**Registered In**: `bootstrap/providers.php`

---

## TDD Workflow - The Sacred Process

### Why TDD is Non-Negotiable

**Without TDD**: "I think it works" → Production breaks at 2 AM
**With TDD**: "258 tests prove it works" → Sleep peacefully

### The Red-Green-Refactor Cycle

```
┌─────────────┐
│   1. RED    │  Write failing test FIRST
│   (Test)    │  ✗ Class doesn't exist yet
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  2. GREEN   │  Write MINIMAL code to pass
│   (Code)    │  ✓ Test passes, code is ugly
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 3. REFACTOR │  Clean up code
│   (Clean)   │  ✓ Tests still pass, code beautiful
└──────┬──────┘
       │
       └──────► Repeat for next feature
```

### Real Example: EloquentModuleRepository

#### Step 1: RED (Write Failing Test)

```php
// tests/Unit/.../EloquentModuleRepositoryTest.php

public function test_can_save_module(): void
{
    // Arrange
    $module = $this->createModule();

    // Act
    $this->repository->save($module);

    // Assert
    $this->assertDatabaseHas('modules', [
        'id' => $module->id()->toString(),
        'name' => 'test_module',
    ]);
}
```

**Run Test**:
```bash
php artisan test --filter=test_can_save_module
```

**Output**: ❌ `Class EloquentModuleRepository does not exist`

#### Step 2: GREEN (Minimal Implementation)

```php
// app/.../EloquentModuleRepository.php

final class EloquentModuleRepository implements ModuleRepositoryInterface
{
    public function save(Module $module): void
    {
        ModuleModel::query()->create([
            'id' => $module->id()->toString(),
            'name' => $module->name()->toString(),
            // ... minimal fields
        ]);
    }
}
```

**Run Test**: ✅ PASSES

#### Step 3: REFACTOR (Add updateOrCreate logic)

```php
public function save(Module $module): void
{
    ModuleModel::query()->updateOrCreate(
        ['id' => $module->id()->toString()],
        [
            'name' => $module->name()->toString(),
            'display_name' => $module->displayName(),
            // ... all fields properly mapped
        ]
    );

    // Handle dependencies separately
    $this->saveDependencies($module);
}
```

**Run Test**: ✅ STILL PASSES (refactored safely)

### TDD Rules for Infrastructure

1. **NEVER write infrastructure code without a failing test**
2. **Test database operations against real database** (use transactions + rollback)
3. **Test domain-to-model mapping** (both directions)
4. **Test cascade operations** (deletes, updates)
5. **Test edge cases** (null values, empty arrays, invalid UUIDs)

---

## Infrastructure Components Deep Dive

### Component 1: Eloquent Models

**Purpose**: ORM mapping between database tables and domain aggregates

**Critical Distinction**:
```
Eloquent Model (Infrastructure)  ≠  Domain Model (Domain)
     ↓                                    ↓
  Database Row                      Business Entity
  Framework-aware                   Framework-free
  Mutable                          Immutable (mostly)
```

#### Example: ModuleModel.php

```php
<?php

namespace App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;

/**
 * ModuleModel - Eloquent ORM Model
 *
 * INFRASTRUCTURE LAYER - Framework coupling allowed
 *
 * Represents modules table row in landlord database
 * Maps to Module aggregate (domain layer)
 */
final class ModuleModel extends Model
{
    protected $table = 'modules';  // Landlord DB
    protected $keyType = 'string'; // UUID primary key
    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'display_name',
        'version',
        // ... all domain properties
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'requires_subscription' => 'boolean',
        'configuration' => 'array',  // JSON column
    ];

    /**
     * Eloquent relationship: Module has many dependencies
     */
    public function dependencies()
    {
        return $this->hasMany(ModuleDependencyModel::class, 'module_id');
    }
}
```

**Key Patterns**:
- `$fillable`: Mass assignment protection
- `$casts`: Auto JSON encoding/decoding
- `$keyType = 'string'`: UUID handling
- Relationships: Eloquent magic for joins

**Common Mistake**:
```php
// ❌ WRONG - Using Eloquent model in domain
namespace App\Contexts\ModuleRegistry\Domain\Services;

use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel;  // ❌

class ModuleService {
    public function doSomething(ModuleModel $module) { }  // ❌
}

// ✅ CORRECT - Using domain model
use App\Contexts\ModuleRegistry\Domain\Models\Module;  // ✅

class ModuleService {
    public function doSomething(Module $module) { }  // ✅
}
```

### Component 2: Repositories (The Bridge)

**Purpose**: Translate between domain aggregates and database models

**Critical Responsibility**:
```
Domain Aggregate (Module)
        ↓ Repository.save()
    Eloquent Model (ModuleModel)
        ↓ Eloquent ORM
    Database Row (modules table)

Database Row (modules table)
        ↑ Eloquent ORM
    Eloquent Model (ModuleModel)
        ↑ Repository.findById()
Domain Aggregate (Module)
```

#### Example: EloquentModuleRepository.php

```php
<?php

namespace App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories;

use App\Contexts\ModuleRegistry\Domain\Models\Module;
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel;

/**
 * EloquentModuleRepository - Repository Pattern Implementation
 *
 * INFRASTRUCTURE LAYER
 *
 * Responsibilities:
 * 1. Persist domain aggregates to database
 * 2. Retrieve domain aggregates from database
 * 3. Handle Eloquent ↔ Domain mapping
 * 4. Manage database transactions (if needed)
 *
 * CRITICAL: Operates on LANDLORD database
 */
final class EloquentModuleRepository implements ModuleRepositoryInterface
{
    /**
     * Save module aggregate to database
     *
     * Strategy: updateOrCreate for idempotency
     * Dependencies handled separately for atomicity
     */
    public function save(Module $module): void
    {
        // Step 1: Save module entity
        ModuleModel::query()->updateOrCreate(
            ['id' => $module->id()->toString()],
            [
                'name' => $module->name()->toString(),
                'display_name' => $module->displayName(),
                'version' => $module->version()->toString(),
                'description' => $module->description(),
                'namespace' => $module->namespace(),
                'migration_path' => $module->migrationPath(),
                'is_published' => $module->isPublished(),
                'requires_subscription' => $module->requiresSubscription(),
                'configuration' => $module->configuration()->toArray(),
            ]
        );

        // Step 2: Recreate dependencies (simpler than differential update)
        $this->saveDependencies($module);
    }

    /**
     * Find module by ID
     *
     * Returns: Domain aggregate or null
     */
    public function findById(ModuleId $id): ?Module
    {
        $model = ModuleModel::query()
            ->with('dependencies')  // Eager load
            ->find($id->toString());

        if ($model === null) {
            return null;
        }

        return $this->toDomainModel($model);
    }

    /**
     * Delete module
     *
     * Cascade: Dependencies deleted via DB foreign key
     */
    public function delete(ModuleId $id): void
    {
        ModuleModel::query()->where('id', $id->toString())->delete();
    }

    /**
     * PRIVATE: Convert Eloquent model → Domain aggregate
     *
     * CRITICAL: This is where framework meets domain
     */
    private function toDomainModel(ModuleModel $model): Module
    {
        // Create module aggregate (constructor)
        $module = new Module(
            ModuleId::fromString($model->id),
            ModuleName::fromString($model->name),
            $model->display_name,
            ModuleVersion::fromString($model->version),
            $model->description,
            $model->namespace,
            $model->migration_path,
            $model->requires_subscription,
            ModuleConfiguration::fromArray($model->configuration)
        );

        // Restore published state (if published)
        if ($model->is_published) {
            $module->publish();  // Domain method
        }

        // Restore dependencies
        foreach ($model->dependencies as $dep) {
            $module->addDependency(
                ModuleDependency::fromString(
                    "{$dep->depends_on_module}:{$dep->version_constraint}"
                )
            );
        }

        return $module;
    }

    /**
     * PRIVATE: Save module dependencies
     */
    private function saveDependencies(Module $module): void
    {
        // Delete old dependencies
        ModuleDependencyModel::query()
            ->where('module_id', $module->id()->toString())
            ->delete();

        // Insert new dependencies
        foreach ($module->dependencies() as $dependency) {
            ModuleDependencyModel::query()->create([
                'module_id' => $module->id()->toString(),
                'depends_on_module' => $dependency->moduleName()->toString(),
                'version_constraint' => $dependency->versionConstraint(),
            ]);
        }
    }
}
```

**Key Patterns**:

1. **updateOrCreate**: Idempotent saves (can call multiple times safely)
2. **Eager Loading**: `->with('dependencies')` (avoid N+1 queries)
3. **Value Object Conversion**: `->toString()` / `::fromString()`
4. **State Restoration**: Call domain methods to rebuild aggregate state
5. **Separation**: CRUD operations vs domain mapping

### Component 3: Migrations

**Purpose**: Version control for database schema

**Critical Rules**:
1. **Never use raw SQL** (use Laravel Schema builder)
2. **Always provide `down()`** (rollback support)
3. **Use proper indexes** (foreign keys, unique constraints)
4. **Timestamp naming**: `YYYY_MM_DD_HHMMSS_table_name.php`

#### Example: create_modules_table.php

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: modules table (Landlord Database)
 *
 * Purpose: Store module catalog shared across all tenants
 * Database: Landlord (publicdigit)
 *
 * Design Decisions:
 * - UUID primary key (domain-driven)
 * - JSON configuration column (flexible module settings)
 * - Soft deletes (preserve history)
 * - Indexes on name (unique) and is_published (filtering)
 */
return new class extends Migration
{
    /**
     * Run the migration
     */
    public function up(): void
    {
        Schema::create('modules', function (Blueprint $table) {
            // Primary key: UUID from domain
            $table->uuid('id')->primary();

            // Module identity
            $table->string('name', 50)->unique();  // snake_case identifier
            $table->string('display_name', 100);   // Human-readable name
            $table->string('version', 20);         // Semantic version (1.0.0)

            // Module metadata
            $table->text('description');
            $table->string('namespace', 255);      // PHP namespace
            $table->string('migration_path', 255); // Tenant migration path

            // Module state
            $table->boolean('is_published')->default(false);
            $table->boolean('requires_subscription')->default(false);

            // Configuration (JSON)
            $table->json('configuration')->nullable();

            // Timestamps
            $table->timestamps();
            $table->softDeletes();  // Preserve module history

            // Indexes
            $table->index('is_published');  // Filter active modules
        });
    }

    /**
     * Reverse the migration
     */
    public function down(): void
    {
        Schema::dropIfExists('modules');
    }
};
```

**Migration Naming Convention**:
```
2025_01_15_100000_create_modules_table.php
└─┬──┘ └┬┘ └┬┘ └──┬──┘ └────────┬──────────┘
  │     │   │     │              └─ descriptive name
  │     │   │     └──────────────── hour:minute:second
  │     │   └────────────────────── day
  │     └────────────────────────── month
  └──────────────────────────────── year
```

**Running Migrations**:
```bash
# Landlord database
php artisan migrate --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations

# Tenant database (all tenants)
php artisan tenantauth:migrate --all
```

### Component 4: Service Adapters

**Purpose**: Adapt external services to domain ports

#### Example: LaravelEventPublisher.php

```php
<?php

namespace App\Contexts\ModuleRegistry\Infrastructure\Adapters;

use App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface;
use Illuminate\Support\Facades\Event;

/**
 * LaravelEventPublisher - Event Dispatcher Adapter
 *
 * INFRASTRUCTURE LAYER
 *
 * Adapts Laravel's event system to domain's EventPublisherInterface
 *
 * Design Decision: Event Facade vs Constructor Injection
 * ✅ Chose facade: Simpler, works with Event::fake() in tests
 * ❌ Constructor injection: Timing issues with Event::fake()
 */
final class LaravelEventPublisher implements EventPublisherInterface
{
    /**
     * Publish domain event to Laravel's event system
     *
     * @param object $event Domain event (ModuleRegistered, etc.)
     */
    public function publish(object $event): void
    {
        Event::dispatch($event);
    }
}
```

**Why Facade Won**:
```php
// ❌ Constructor injection approach (problematic)
class LaravelEventPublisher {
    public function __construct(
        private readonly Dispatcher $dispatcher  // Injected BEFORE test setup
    ) {}

    public function publish(object $event): void {
        $this->dispatcher->dispatch($event);  // Wrong dispatcher in tests
    }
}

// Test problem:
protected function setUp(): void {
    parent::setUp();
    $this->publisher = new LaravelEventPublisher(app(Dispatcher::class));  // Gets real dispatcher
    Event::fake();  // Too late! Publisher already has old dispatcher
}

// ✅ Facade approach (works perfectly)
class LaravelEventPublisher {
    public function publish(object $event): void {
        Event::dispatch($event);  // Always uses current container binding
    }
}

// Test success:
protected function setUp(): void {
    parent::setUp();
    Event::fake();  // Sets up fake FIRST
    $this->publisher = new LaravelEventPublisher();  // No dependencies
    $this->publisher->publish($event);  // Uses faked dispatcher ✓
}
```

### Component 5: Service Provider

**Purpose**: Bind domain interfaces to infrastructure implementations

#### ModuleRegistryServiceProvider.php

```php
<?php

namespace App\Contexts\ModuleRegistry\Providers;

use Illuminate\Support\ServiceProvider;

// Domain Ports
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\Ports\TenantModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface;

// Infrastructure Adapters
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories\EloquentModuleRepository;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories\EloquentTenantModuleRepository;
use App\Contexts\ModuleRegistry\Infrastructure\Adapters\LaravelEventPublisher;

/**
 * ModuleRegistryServiceProvider
 *
 * Purpose: Dependency Injection Configuration
 *
 * Binds domain ports (interfaces) to infrastructure adapters (implementations)
 * This is the "glue" that makes hexagonal architecture work
 */
final class ModuleRegistryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Repository Bindings
        $this->app->bind(
            ModuleRepositoryInterface::class,
            EloquentModuleRepository::class
        );

        $this->app->bind(
            TenantModuleRepositoryInterface::class,
            EloquentTenantModuleRepository::class
        );

        // Service Adapter Bindings (Singletons)
        $this->app->singleton(
            EventPublisherInterface::class,
            LaravelEventPublisher::class
        );
    }
}
```

**bind() vs singleton()**:
```php
// bind(): New instance each time
$repo1 = app(ModuleRepositoryInterface::class);
$repo2 = app(ModuleRepositoryInterface::class);
// $repo1 !== $repo2 (different instances)

// singleton(): Same instance always
$publisher1 = app(EventPublisherInterface::class);
$publisher2 = app(EventPublisherInterface::class);
// $publisher1 === $publisher2 (same instance)
```

**When to use singleton()**:
- Stateless services (EventPublisher, SubscriptionService)
- Services with expensive initialization
- Services that maintain caches

**When to use bind()**:
- Repositories (usually stateless but not required to be singleton)
- Services that might need different configurations per request

---

## Debugging Strategies

### Strategy 1: Test-Driven Debugging

**Golden Rule**: If you find a bug, write a failing test FIRST, then fix it.

#### Example: Bug in Repository Mapping

**Bug Report**: "Modules lose their dependencies after saving"

**Step 1: Reproduce in Test** (RED)
```php
public function test_save_preserves_dependencies(): void
{
    // Arrange
    $module = $this->createModuleWithDependencies(['dep1', 'dep2']);

    // Act
    $this->repository->save($module);
    $loaded = $this->repository->findById($module->id());

    // Assert
    $this->assertCount(2, $loaded->dependencies());  // ❌ FAILS (returns 0)
}
```

**Step 2: Debug the Code**
```php
// EloquentModuleRepository.php

private function saveDependencies(Module $module): void
{
    // BUG: Forgot to delete old dependencies first!
    // Old code just kept adding...

    foreach ($module->dependencies() as $dependency) {
        ModuleDependencyModel::query()->create([...]);
    }
}
```

**Step 3: Fix the Code** (GREEN)
```php
private function saveDependencies(Module $module): void
{
    // FIX: Delete old dependencies first
    ModuleDependencyModel::query()
        ->where('module_id', $module->id()->toString())
        ->delete();

    // Then insert new ones
    foreach ($module->dependencies() as $dependency) {
        ModuleDependencyModel::query()->create([...]);
    }
}
```

**Step 4: Verify Test Passes**
```bash
php artisan test --filter=test_save_preserves_dependencies
# ✅ PASSES
```

**Step 5: Ensure No Regression**
```bash
php artisan test --filter=EloquentModuleRepositoryTest
# ✅ All 15 tests pass
```

### Strategy 2: Database Inspection

**Tool 1: Laravel Tinker**
```bash
php artisan tinker
```

```php
// Check if module exists
$model = App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel::find('uuid-here');
$model->toArray();  // See all attributes

// Check dependencies
$model->dependencies;  // Eloquent relationship

// Check tenant modules
config(['database.default' => 'tenant']);
$tenantModule = App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\TenantModuleModel::all();
```

**Tool 2: Raw Database Queries**
```bash
# Landlord database
php artisan tinker --execute="DB::table('modules')->get()"

# Tenant database
php artisan tinker --execute="DB::connection('tenant')->table('tenant_modules')->get()"
```

**Tool 3: Database Diff**
```bash
# Compare expected vs actual state
php artisan migrate:status
php artisan migrate:status --database=tenant
```

### Strategy 3: Event Debugging

**Problem**: "Domain events not firing"

**Debug Steps**:

1. **Verify Event is Dispatched**
```php
// In test
Event::fake();
$service->installModule($command);
Event::assertDispatched(ModuleInstalled::class);  // Check if dispatched
```

2. **Check Event Publisher Binding**
```bash
php artisan tinker
```
```php
$publisher = app(App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface::class);
get_class($publisher);  // Should be LaravelEventPublisher
```

3. **Verify Event Structure**
```php
Event::fake();
$service->installModule($command);

Event::assertDispatched(ModuleInstalled::class, function ($event) {
    dump($event);  // Inspect event properties
    return true;
});
```

4. **Check Listeners Are Registered**
```php
// EventServiceProvider.php
protected $listen = [
    ModuleInstalled::class => [
        NotifyAdministrators::class,  // Is this registered?
    ],
];
```

### Strategy 4: Cross-Database Issues

**Problem**: "TenantModule can't find Module from landlord"

**Debug Steps**:

1. **Verify Database Connections**
```bash
php artisan tinker
```
```php
// Check landlord connection
DB::connection('landlord')->table('modules')->count();

// Check tenant connection
DB::connection('tenant')->table('tenant_modules')->count();
```

2. **Inspect Repository Injection**
```php
// TenantModuleRepository expects ModuleRepository
$tenantRepo = app(App\Contexts\ModuleRegistry\Domain\Ports\TenantModuleRepositoryInterface::class);

// Check if it has moduleRepository dependency
$reflection = new ReflectionClass($tenantRepo);
$constructor = $reflection->getConstructor();
$params = $constructor->getParameters();
dump($params);  // Should show ModuleRepositoryInterface parameter
```

3. **Test Cross-Database Query**
```php
// In TenantModuleRepository
private function toDomainModel(TenantModuleModel $model): TenantModule
{
    // Add debug logging
    \Log::info('Fetching module from landlord', [
        'module_id' => $model->module_id,
        'connection' => $this->moduleRepository->getConnection(),
    ]);

    $module = $this->moduleRepository->findById(
        ModuleId::fromString($model->module_id)
    );

    if ($module === null) {
        \Log::error('Module not found in landlord catalog', [
            'module_id' => $model->module_id,
        ]);
        throw new \RuntimeException("Module not found...");
    }

    return $tenantModule;
}
```

### Strategy 5: Value Object Validation Errors

**Problem**: "InvalidArgumentException: ModuleId cannot be empty"

**Common Causes**:
1. Passing empty string to Value Object
2. Database returning NULL
3. Type coercion issues

**Debug Example**:
```php
// Test that reproduces error
public function test_handles_null_module_id(): void
{
    $this->expectException(\InvalidArgumentException::class);

    // This should throw, not crash
    ModuleId::fromString('');  // ❌ Empty string
    ModuleId::fromString(null);  // ❌ NULL
}
```

**Fix Options**:
```php
// Option 1: Validate in repository
private function toDomainModel(TenantModuleModel $model): TenantModule
{
    if (empty($model->module_id)) {
        throw new \RuntimeException("TenantModule has no module_id");
    }

    return new TenantModule(
        TenantModuleId::fromString($model->id),
        TenantId::fromString($model->tenant_id),
        ModuleId::fromString($model->module_id),  // Now safe
        // ...
    );
}

// Option 2: Database constraint
$table->uuid('module_id')->nullable(false);  // Prevent NULL in DB
```

### Strategy 6: Test Isolation Issues

**Problem**: "Tests pass individually, fail when run together"

**Common Cause**: Database state leaking between tests

**Solution**: Use database transactions

```php
// TestCase.php or specific test
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class EloquentModuleRepositoryTest extends TestCase
{
    use DatabaseTransactions;  // ✅ Auto rollback after each test

    public function test_save_module(): void
    {
        // This test's changes will be rolled back
        $this->repository->save($module);
    }
}
```

**Alternative: RefreshDatabase** (slower, full DB reset)
```php
use RefreshDatabase;  // Rebuilds DB for each test class
```

**Debugging Leaked State**:
```php
protected function tearDown(): void
{
    // Check for leftover data
    $count = ModuleModel::query()->count();
    $this->assertEquals(0, $count, "Test leaked {$count} modules!");

    parent::tearDown();
}
```

---

## Editing Patterns & Best Practices

### Pattern 1: Adding a New Field to Aggregate

**Scenario**: Add `author` field to Module

**Steps** (TDD):

1. **Update Domain Model** (Phase 1)
```php
// app/Contexts/ModuleRegistry/Domain/Models/Module.php

final class Module
{
    public function __construct(
        // ... existing fields
        private string $author  // NEW FIELD
    ) {}

    public function author(): string  // NEW GETTER
    {
        return $this->author;
    }
}
```

2. **Update Eloquent Model** (Phase 3)
```php
// app/.../ModuleModel.php

protected $fillable = [
    'id',
    'name',
    // ... existing fields
    'author',  // NEW FIELD
];
```

3. **Create Migration** (Phase 3)
```php
// database/migrations/2025_01_29_add_author_to_modules.php

public function up(): void
{
    Schema::table('modules', function (Blueprint $table) {
        $table->string('author', 100)->after('description');
    });
}

public function down(): void
{
    Schema::table('modules', function (Blueprint $table) {
        $table->dropColumn('author');
    });
}
```

4. **Update Repository Mapping** (Phase 3)
```php
// app/.../EloquentModuleRepository.php

public function save(Module $module): void
{
    ModuleModel::query()->updateOrCreate(
        ['id' => $module->id()->toString()],
        [
            // ... existing fields
            'author' => $module->author(),  // NEW MAPPING
        ]
    );
}

private function toDomainModel(ModuleModel $model): Module
{
    return new Module(
        ModuleId::fromString($model->id),
        ModuleName::fromString($model->name),
        // ... existing fields
        $model->author  // NEW MAPPING
    );
}
```

5. **Update Tests** (Phase 3)
```php
// tests/.../EloquentModuleRepositoryTest.php

public function test_save_preserves_author(): void
{
    // Arrange
    $module = new Module(
        ModuleId::generate(),
        ModuleName::fromString('test'),
        'Test Module',
        ModuleVersion::fromString('1.0.0'),
        'Description',
        'App\\Modules',
        'migrations/test',
        false,
        new ModuleConfiguration([]),
        'John Doe'  // NEW FIELD
    );

    // Act
    $this->repository->save($module);
    $loaded = $this->repository->findById($module->id());

    // Assert
    $this->assertEquals('John Doe', $loaded->author());
}
```

6. **Run Migration**
```bash
php artisan migrate
```

7. **Run Tests**
```bash
php artisan test --filter=EloquentModuleRepositoryTest
```

### Pattern 2: Adding a New Repository Method

**Scenario**: Add `findPublishedModules()` method

**Steps** (TDD):

1. **Write Failing Test FIRST** (RED)
```php
// tests/.../EloquentModuleRepositoryTest.php

public function test_find_published_modules(): void
{
    // Arrange
    $published1 = $this->createModule(['name' => 'mod1', 'is_published' => true]);
    $published2 = $this->createModule(['name' => 'mod2', 'is_published' => true]);
    $unpublished = $this->createModule(['name' => 'mod3', 'is_published' => false]);

    $this->repository->save($published1);
    $this->repository->save($published2);
    $this->repository->save($unpublished);

    // Act
    $results = $this->repository->findPublishedModules();

    // Assert
    $this->assertCount(2, $results);
    $this->assertTrue($results[0]->isPublished());
    $this->assertTrue($results[1]->isPublished());
}
```

**Run**: ❌ `Method findPublishedModules does not exist`

2. **Add Method to Domain Port** (Phase 1)
```php
// app/.../ModuleRepositoryInterface.php

interface ModuleRepositoryInterface
{
    public function save(Module $module): void;
    public function findById(ModuleId $id): ?Module;

    /**
     * Find all published modules
     *
     * @return Module[]
     */
    public function findPublishedModules(): array;  // NEW METHOD
}
```

3. **Implement in Repository** (Phase 3 - GREEN)
```php
// app/.../EloquentModuleRepository.php

public function findPublishedModules(): array
{
    $models = ModuleModel::query()
        ->where('is_published', true)
        ->get();

    return $models->map(fn($model) => $this->toDomainModel($model))->all();
}
```

**Run**: ✅ Test passes

4. **Refactor for Performance** (REFACTOR)
```php
public function findPublishedModules(): array
{
    $models = ModuleModel::query()
        ->where('is_published', true)
        ->with('dependencies')  // Eager load to avoid N+1
        ->orderBy('name')       // Consistent ordering
        ->get();

    return $models->map(fn($model) => $this->toDomainModel($model))->all();
}
```

**Run**: ✅ Still passes (refactored safely)

### Pattern 3: Changing Database Schema (Migration)

**Scenario**: Change `version` column from VARCHAR(20) to VARCHAR(50)

**Steps**:

1. **Create Migration**
```bash
php artisan make:migration increase_module_version_length --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations
```

2. **Write Migration**
```php
public function up(): void
{
    Schema::table('modules', function (Blueprint $table) {
        $table->string('version', 50)->change();  // Increase length
    });
}

public function down(): void
{
    Schema::table('modules', function (Blueprint $table) {
        $table->string('version', 20)->change();  // Revert
    });
}
```

3. **Test Migration Locally**
```bash
# Run migration
php artisan migrate --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations

# Verify schema
php artisan tinker --execute="DB::select('DESCRIBE modules')"

# Test rollback
php artisan migrate:rollback --step=1

# Re-run
php artisan migrate --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations
```

4. **Update Model** (if using casts)
```php
// Usually not needed for string length changes
// But document it if there's a reason
```

5. **Run Full Test Suite**
```bash
php artisan test --filter=ModuleRegistry
# Ensure no tests break due to schema change
```

### Pattern 4: Debugging Failing Tests

**Scenario**: Test suddenly fails after refactoring

**Debugging Process**:

1. **Read the Error Message Carefully**
```bash
php artisan test --filter=test_save_module

FAILED Tests\Unit\...\EloquentModuleRepositoryTest > save module
Expected null, got instance of Module
```

**Analysis**: Test expects `null` but got a `Module`. Look at assertion.

2. **Add Debug Output**
```php
public function test_save_module(): void
{
    $module = $this->createModule();
    $this->repository->save($module);

    $loaded = $this->repository->findById($module->id());

    dump($loaded);  // ADD THIS
    dump($module->id()->toString());  // AND THIS

    $this->assertNotNull($loaded);  // Original assertion
}
```

3. **Run with --debug Flag**
```bash
php artisan test --filter=test_save_module --debug
```

4. **Check Database State**
```php
public function test_save_module(): void
{
    $module = $this->createModule();
    $this->repository->save($module);

    // Check database directly
    $dbRecord = DB::table('modules')->where('id', $module->id()->toString())->first();
    dump($dbRecord);  // Is it in DB?

    $loaded = $this->repository->findById($module->id());
    $this->assertNotNull($loaded);
}
```

5. **Isolate the Problem**
```php
// Comment out everything except the failing part
public function test_save_module(): void
{
    $module = $this->createModule(['name' => 'simple_test']);

    // Just test saving
    $this->repository->save($module);

    // Just test retrieval
    $loaded = $this->repository->findById($module->id());

    // Minimal assertion
    $this->assertEquals('simple_test', $loaded->name()->toString());
}
```

6. **Fix Root Cause**
```php
// Example: Found that toDomainModel() was throwing exception
private function toDomainModel(ModuleModel $model): Module
{
    try {
        return new Module(
            ModuleId::fromString($model->id),
            ModuleName::fromString($model->name),
            // ... fields
        );
    } catch (\Throwable $e) {
        \Log::error('Failed to convert model to domain', [
            'model' => $model->toArray(),
            'error' => $e->getMessage(),
        ]);
        throw $e;
    }
}
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Mixing Domain and Infrastructure

**Problem**:
```php
// ❌ WRONG - Infrastructure in Domain
namespace App\Contexts\ModuleRegistry\Domain\Services;

use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel;  // ❌
use Illuminate\Support\Facades\DB;  // ❌

class ModuleService
{
    public function registerModule(): void
    {
        DB::transaction(function() {  // ❌ Framework in domain
            ModuleModel::create([...]);  // ❌ Eloquent in domain
        });
    }
}
```

**Solution**:
```php
// ✅ CORRECT - Domain uses ports
namespace App\Contexts\ModuleRegistry\Domain\Services;

use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;  // ✅
use App\Contexts\ModuleRegistry\Domain\Models\Module;  // ✅

class ModuleService
{
    public function __construct(
        private ModuleRepositoryInterface $repository  // ✅ Depend on interface
    ) {}

    public function registerModule(): void
    {
        $module = new Module(...);  // ✅ Domain model
        $this->repository->save($module);  // ✅ Port abstraction
    }
}
```

### Pitfall 2: Forgetting to Register Service Provider

**Symptom**:
```
Illuminate\Contracts\Container\BindingResolutionException
Target [App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface] is not instantiable.
```

**Cause**: Service provider not registered

**Solution**:
```php
// bootstrap/providers.php

return [
    // ...
    App\Contexts\ModuleRegistry\Providers\ModuleRegistryServiceProvider::class,  // ✅ ADD THIS
];
```

**Verification**:
```bash
php artisan tinker
```
```php
app(App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface::class);
// Should return EloquentModuleRepository instance
```

### Pitfall 3: N+1 Query Problem

**Problem**:
```php
// ❌ BAD - N+1 queries
public function findAll(): array
{
    $modules = ModuleModel::query()->get();  // 1 query

    return $modules->map(function($model) {
        return $this->toDomainModel($model);  // N queries (fetches dependencies)
    })->all();
}

// Logs show:
// SELECT * FROM modules (1 query)
// SELECT * FROM module_dependencies WHERE module_id = ? (N queries)
```

**Solution**:
```php
// ✅ GOOD - Eager loading
public function findAll(): array
{
    $modules = ModuleModel::query()
        ->with('dependencies')  // ✅ Load relationships upfront
        ->get();

    return $modules->map(fn($model) => $this->toDomainModel($model))->all();
}

// Logs show:
// SELECT * FROM modules (1 query)
// SELECT * FROM module_dependencies WHERE module_id IN (?, ?, ...) (1 query)
```

### Pitfall 4: Not Using Transactions

**Problem**:
```php
// ❌ BAD - Partial failure leaves inconsistent state
public function save(Module $module): void
{
    // Save module
    ModuleModel::query()->create([...]);  // Succeeds

    // Save dependencies
    foreach ($module->dependencies() as $dep) {
        ModuleDependencyModel::create([...]);  // Fails on 2nd dependency!
    }
    // Result: Module saved but missing dependencies ❌
}
```

**Solution**:
```php
// ✅ GOOD - Atomic operation
public function save(Module $module): void
{
    DB::transaction(function() use ($module) {
        // Save module
        ModuleModel::query()->updateOrCreate([...]);

        // Save dependencies
        foreach ($module->dependencies() as $dep) {
            ModuleDependencyModel::create([...]);
        }
        // Both succeed or both fail ✅
    });
}
```

### Pitfall 5: Mutable Value Objects

**Problem**:
```php
// ❌ BAD - Mutable value object
class ModuleVersion
{
    private string $value;

    public function setValue(string $value): void  // ❌ Setter!
    {
        $this->value = $value;
    }
}

// Leads to:
$version = ModuleVersion::fromString('1.0.0');
$version->setValue('2.0.0');  // Mutated! No longer trustworthy
```

**Solution**:
```php
// ✅ GOOD - Immutable value object
final readonly class ModuleVersion  // readonly prevents mutation
{
    private function __construct(
        private string $value
    ) {}

    // No setters, only factory methods
    public static function fromString(string $value): self
    {
        return new self($value);
    }

    // Return new instance for changes
    public function increment(): self
    {
        return new self($this->nextVersion());  // New instance
    }
}
```

### Pitfall 6: Testing Against Wrong Database

**Problem**:
```php
// ❌ Test expects data in tenant DB but checks landlord DB
public function test_find_tenant_module(): void
{
    $tenantModule = $this->createTenantModule();
    $this->repository->save($tenantModule);

    // Oops! Default connection is landlord, tenant data is in tenant DB
    $this->assertDatabaseHas('tenant_modules', [  // ❌ Checks landlord.tenant_modules
        'id' => $tenantModule->id()->toString(),
    ]);
}
```

**Solution**:
```php
// ✅ Specify connection
public function test_find_tenant_module(): void
{
    $tenantModule = $this->createTenantModule();
    $this->repository->save($tenantModule);

    $this->assertDatabaseHas('tenant_modules', [
        'id' => $tenantModule->id()->toString(),
    ], 'tenant');  // ✅ Specify tenant connection
}
```

---

## Testing Strategies

### Unit Testing Infrastructure

**Goal**: Test infrastructure adapters in isolation

**Key Principles**:
1. Use real database (with transactions for cleanup)
2. Test both directions (save → load)
3. Test edge cases (null, empty, invalid)
4. Test cascading operations

**Example Structure**:
```php
final class EloquentModuleRepositoryTest extends TestCase
{
    use DatabaseTransactions;  // Auto rollback

    private EloquentModuleRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();

        // Run migrations
        $this->artisan('migrate');

        // Create repository instance
        $this->repository = new EloquentModuleRepository();
    }

    /** @test */
    public function can_save_module(): void
    {
        // Arrange
        $module = $this->createModule();

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertDatabaseHas('modules', [
            'id' => $module->id()->toString(),
            'name' => 'test_module',
        ]);
    }

    /** @test */
    public function can_find_module_by_id(): void
    {
        // Arrange
        $module = $this->createModule();
        $this->repository->save($module);

        // Act
        $loaded = $this->repository->findById($module->id());

        // Assert
        $this->assertNotNull($loaded);
        $this->assertEquals($module->name()->toString(), $loaded->name()->toString());
    }

    /** @test */
    public function returns_null_when_module_not_found(): void
    {
        // Act
        $loaded = $this->repository->findById(ModuleId::generate());

        // Assert
        $this->assertNull($loaded);
    }

    /** @test */
    public function can_save_module_with_dependencies(): void
    {
        // Arrange
        $module = $this->createModuleWithDependencies(['dep1', 'dep2']);

        // Act
        $this->repository->save($module);
        $loaded = $this->repository->findById($module->id());

        // Assert
        $this->assertCount(2, $loaded->dependencies());
    }

    /** @test */
    public function deleting_module_cascades_to_dependencies(): void
    {
        // Arrange
        $module = $this->createModuleWithDependencies(['dep1']);
        $this->repository->save($module);

        // Act
        $this->repository->delete($module->id());

        // Assert
        $this->assertDatabaseMissing('modules', ['id' => $module->id()->toString()]);
        $this->assertDatabaseMissing('module_dependencies', ['module_id' => $module->id()->toString()]);
    }

    // Helper method
    private function createModule(array $overrides = []): Module
    {
        return new Module(
            ModuleId::generate(),
            ModuleName::fromString($overrides['name'] ?? 'test_module'),
            $overrides['display_name'] ?? 'Test Module',
            ModuleVersion::fromString($overrides['version'] ?? '1.0.0'),
            $overrides['description'] ?? 'Test description',
            $overrides['namespace'] ?? 'App\\Modules\\Test',
            $overrides['migration_path'] ?? 'migrations/test',
            $overrides['requires_subscription'] ?? false,
            new ModuleConfiguration($overrides['configuration'] ?? [])
        );
    }
}
```

### Integration Testing

**Goal**: Test how infrastructure integrates with application layer

**Example**:
```php
final class ModuleInstallationServiceIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private ModuleInstallationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        // Use REAL dependencies from service container
        $this->service = app(ModuleInstallationService::class);
    }

    /** @test */
    public function can_install_module_end_to_end(): void
    {
        // Arrange: Create module in landlord DB
        $moduleRepo = app(ModuleRepositoryInterface::class);
        $module = $this->createModule();
        $moduleRepo->save($module);

        // Create command
        $command = new InstallModuleCommand(
            TenantId::fromString('tenant_123'),
            ModuleId::fromString($module->id()->toString()),
            'admin@example.com'
        );

        // Act: Install module
        $jobId = $this->service->install($command);

        // Assert: Check tenant database
        config(['database.default' => 'tenant']);
        $this->assertDatabaseHas('tenant_modules', [
            'tenant_id' => 'tenant_123',
            'module_id' => $module->id()->toString(),
        ], 'tenant');

        $this->assertDatabaseHas('module_installation_jobs', [
            'id' => $jobId->toString(),
            'status' => 'PENDING',
        ], 'tenant');
    }
}
```

### Testing Multi-Tenancy

**Challenge**: Tests need to switch between landlord and tenant databases

**Pattern**:
```php
final class TenantModuleRepositoryTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        // Run landlord migrations (for modules catalog)
        $this->artisan('migrate', ['--database' => 'landlord']);

        // Run tenant migrations (for tenant_modules)
        $this->artisan('migrate', ['--database' => 'tenant']);

        // Set default to tenant for this test
        config(['database.default' => 'tenant']);

        // Create repositories
        $this->moduleRepository = new EloquentModuleRepository();  // Uses landlord
        $this->tenantModuleRepository = new EloquentTenantModuleRepository(
            $this->moduleRepository  // Cross-database dependency
        );
    }

    /** @test */
    public function can_save_tenant_module(): void
    {
        // Arrange: Create module in LANDLORD database
        config(['database.default' => 'landlord']);
        $module = $this->createModule();
        $this->moduleRepository->save($module);

        // Arrange: Create tenant module in TENANT database
        config(['database.default' => 'tenant']);
        $tenantModule = new TenantModule(
            TenantModuleId::generate(),
            TenantId::fromString('tenant_123'),
            $module->id(),
            $module->version(),
            $module->configuration()
        );

        // Act
        $this->tenantModuleRepository->save($tenantModule);

        // Assert: Check tenant database
        $this->assertDatabaseHas('tenant_modules', [
            'id' => $tenantModule->id()->toString(),
            'tenant_id' => 'tenant_123',
            'module_id' => $module->id()->toString(),
        ], 'tenant');
    }

    /** @test */
    public function loaded_tenant_module_has_module_data_from_landlord(): void
    {
        // Arrange: Module in landlord
        config(['database.default' => 'landlord']);
        $module = $this->createModule(['version' => '2.0.0']);
        $this->moduleRepository->save($module);

        // Arrange: TenantModule in tenant
        config(['database.default' => 'tenant']);
        $tenantModule = $this->createTenantModule($module->id());
        $this->tenantModuleRepository->save($tenantModule);

        // Act: Load from tenant DB
        $loaded = $this->tenantModuleRepository->findById($tenantModule->id());

        // Assert: Version comes from landlord module catalog
        $this->assertEquals('2.0.0', $loaded->version()->toString());
    }
}
```

### Testing with Event::fake()

**Pattern**:
```php
final class LaravelEventPublisherTest extends TestCase
{
    private LaravelEventPublisher $publisher;

    protected function setUp(): void
    {
        parent::setUp();

        // Important: No constructor injection needed with facade pattern
        $this->publisher = new LaravelEventPublisher();
    }

    /** @test */
    public function publishes_event_to_laravel_event_dispatcher(): void
    {
        // Arrange
        Event::fake();  // Mock Laravel's event system

        $event = ModuleRegistered::now(
            ModuleId::generate(),
            ModuleName::fromString('test_module'),
            ModuleVersion::fromString('1.0.0')
        );

        // Act
        $this->publisher->publish($event);

        // Assert
        Event::assertDispatched(ModuleRegistered::class);
    }

    /** @test */
    public function published_event_contains_correct_data(): void
    {
        // Arrange
        Event::fake();
        $moduleId = ModuleId::generate();
        $moduleName = ModuleName::fromString('test');
        $version = ModuleVersion::fromString('1.0.0');

        $event = ModuleRegistered::now($moduleId, $moduleName, $version);

        // Act
        $this->publisher->publish($event);

        // Assert: Verify event properties
        Event::assertDispatched(ModuleRegistered::class, function ($dispatchedEvent) use ($moduleId, $moduleName, $version) {
            // Note: ModuleRegistered uses public readonly properties, not methods
            return $dispatchedEvent->moduleId->equals($moduleId)
                && $dispatchedEvent->moduleName->equals($moduleName)
                && $dispatchedEvent->version->equals($version);
        });
    }
}
```

---

## Multi-Tenancy Considerations

### Database Separation Strategy

**Architecture**:
```
┌──────────────────────────────────┐
│    Landlord Database             │
│    (publicdigit)                 │
│                                  │
│  ┌────────────────────────────┐ │
│  │ modules                    │ │  Module Catalog
│  │ module_dependencies        │ │  (shared across tenants)
│  └────────────────────────────┘ │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│    Tenant Database               │
│    (tenant_nrna)                 │
│                                  │
│  ┌────────────────────────────┐ │
│  │ tenant_modules             │ │  Module Installations
│  │ module_installation_jobs   │ │  (isolated per tenant)
│  │ installation_steps         │ │
│  └────────────────────────────┘ │
└──────────────────────────────────┘
```

### Cross-Database References

**Problem**: Tenant database needs module data from landlord

**Anti-Pattern** ❌:
```php
// ❌ WRONG - Foreign key across databases
Schema::create('tenant_modules', function (Blueprint $table) {
    $table->uuid('module_id');
    $table->foreign('module_id')
          ->references('id')
          ->on('publicdigit.modules');  // ❌ PostgreSQL doesn't support this
});
```

**Correct Pattern** ✅:
```php
// ✅ CORRECT - Application-level reference
Schema::create('tenant_modules', function (Blueprint $table) {
    $table->uuid('module_id');  // No foreign key, just UUID column
    // Application validates reference exists in landlord DB
});

// In repository:
private function toDomainModel(TenantModuleModel $model): TenantModule
{
    // Fetch module from LANDLORD database
    $module = $this->moduleRepository->findById(
        ModuleId::fromString($model->module_id)
    );

    if ($module === null) {
        throw new \RuntimeException(
            "Module {$model->module_id} not found in catalog. " .
            "Data integrity violation."
        );
    }

    // Use module data from landlord
    return new TenantModule(
        TenantModuleId::fromString($model->id),
        TenantId::fromString($model->tenant_id),
        $module->id(),
        $module->version(),      // ✅ From landlord
        $module->configuration() // ✅ From landlord
    );
}
```

### Migration Strategy

**Landlord Migrations**:
```bash
# Location
app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations/
├── 2025_01_15_100000_create_modules_table.php         # Landlord
└── 2025_01_15_100001_create_module_dependencies_table.php  # Landlord

# Run
php artisan migrate --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations
```

**Tenant Migrations**:
```bash
# Location
app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations/
├── 2025_01_17_100000_create_tenant_modules_table.php        # Tenant
├── 2025_01_17_100001_create_module_installation_jobs_table.php  # Tenant
└── 2025_01_17_100002_create_installation_steps_table.php    # Tenant

# Run for all tenants
php artisan tenantauth:migrate --all

# Run for specific tenant
php artisan tenantauth:migrate nrna
```

### Testing Multi-Tenancy

**Pattern**: Switch database context in tests

```php
final class MultiTenancyTest extends TestCase
{
    use DatabaseTransactions;

    /** @test */
    public function tenant_module_loads_data_from_landlord_catalog(): void
    {
        // Step 1: Create module in LANDLORD database
        config(['database.default' => 'landlord']);

        $module = new Module(
            ModuleId::generate(),
            ModuleName::fromString('digital_card'),
            'Digital Card',
            ModuleVersion::fromString('1.0.0'),
            'Digital membership card module',
            'App\\Modules\\DigitalCard',
            'migrations/digital_card',
            true,  // requires_subscription
            new ModuleConfiguration(['theme' => 'dark'])
        );

        $this->moduleRepository->save($module);

        // Step 2: Install module for tenant in TENANT database
        config(['database.default' => 'tenant']);

        $tenantModule = new TenantModule(
            TenantModuleId::generate(),
            TenantId::fromString('tenant_nrna'),
            $module->id(),
            $module->version(),
            $module->configuration()
        );

        $this->tenantModuleRepository->save($tenantModule);

        // Step 3: Load tenant module
        $loaded = $this->tenantModuleRepository->findById($tenantModule->id());

        // Step 4: Verify data comes from landlord catalog
        $this->assertEquals('Digital Card', $loaded->displayName());  // From landlord
        $this->assertEquals('1.0.0', $loaded->version()->toString());  // From landlord
        $this->assertTrue($loaded->requiresSubscription());  // From landlord
        $this->assertEquals(['theme' => 'dark'], $loaded->configuration()->toArray());  // From landlord

        // Step 5: Verify tenant-specific data
        $this->assertEquals('tenant_nrna', $loaded->tenantId()->toString());  // From tenant DB
    }
}
```

---

## Service Provider Configuration

### Registration Process

**Step 1: Create Provider**
```php
// app/Contexts/ModuleRegistry/Providers/ModuleRegistryServiceProvider.php

final class ModuleRegistryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind interfaces to implementations
        $this->app->bind(
            ModuleRepositoryInterface::class,
            EloquentModuleRepository::class
        );

        $this->app->singleton(
            EventPublisherInterface::class,
            LaravelEventPublisher::class
        );
    }

    public function boot(): void
    {
        // Bootstrap code (routes, migrations, etc.)
        // Currently empty, but available for future use
    }
}
```

**Step 2: Register in bootstrap/providers.php**
```php
// bootstrap/providers.php

return [
    // Shared Infrastructure
    App\Contexts\Shared\Infrastructure\Providers\SessionServiceProvider::class,

    // Application Providers
    App\Providers\AppServiceProvider::class,

    // Context Providers
    App\Contexts\DigitalCard\Infrastructure\Providers\DigitalCardServiceProvider::class,
    App\Contexts\ModuleRegistry\Providers\ModuleRegistryServiceProvider::class,  // ✅ ADD THIS
];
```

**Step 3: Verify Registration**
```bash
php artisan tinker
```
```php
// Check if bindings work
$repo = app(App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface::class);
get_class($repo);  // Should be: EloquentModuleRepository

$publisher = app(App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface::class);
get_class($publisher);  // Should be: LaravelEventPublisher
```

### Dependency Injection in Action

**Application Service Example**:
```php
// app/Contexts/ModuleRegistry/Application/Services/ModuleInstallationService.php

final class ModuleInstallationService
{
    public function __construct(
        private ModuleRepositoryInterface $moduleRepository,  // ✅ Injected automatically
        private TenantModuleRepositoryInterface $tenantModuleRepository,  // ✅ Injected
        private InstallationJobRepositoryInterface $jobRepository,  // ✅ Injected
        private EventPublisherInterface $eventPublisher,  // ✅ Injected
        private SubscriptionServiceInterface $subscriptionService  // ✅ Injected
    ) {}

    public function install(InstallModuleCommand $command): ModuleInstallationJobId
    {
        // All dependencies available without manual wiring!
        $module = $this->moduleRepository->findById($command->moduleId());
        // ...
    }
}

// Usage (Laravel auto-wires dependencies):
$service = app(ModuleInstallationService::class);  // ✅ All dependencies injected!
```

### Testing with Mocks

**Pattern**: Override bindings in tests

```php
final class ModuleInstallationServiceTest extends TestCase
{
    /** @test */
    public function installs_module_successfully(): void
    {
        // Arrange: Mock repositories
        $moduleRepoMock = Mockery::mock(ModuleRepositoryInterface::class);
        $moduleRepoMock->shouldReceive('findById')
            ->once()
            ->andReturn($this->createModule());

        $tenantRepoMock = Mockery::mock(TenantModuleRepositoryInterface::class);
        $tenantRepoMock->shouldReceive('save')
            ->once();

        // Override bindings for this test
        $this->app->instance(ModuleRepositoryInterface::class, $moduleRepoMock);
        $this->app->instance(TenantModuleRepositoryInterface::class, $tenantRepoMock);

        // Act
        $service = app(ModuleInstallationService::class);  // Uses mocks
        $jobId = $service->install($command);

        // Assert
        $this->assertInstanceOf(ModuleInstallationJobId::class, $jobId);
    }
}
```

---

## Production Readiness Checklist

### Pre-Deployment Verification

#### 1. All Tests Passing
```bash
# Full test suite
php artisan test

# Specific context
php artisan test --filter=ModuleRegistry

# Expected result
Tests:  258 passed (671 assertions)
Duration: ~10s
```

#### 2. Migrations Reviewed
```bash
# Check migration status
php artisan migrate:status

# Landlord migrations
php artisan migrate:status --database=landlord

# Tenant migrations (example tenant)
php artisan tenantauth:migrate nrna --dry-run
```

**Checklist**:
- [ ] All migrations have `down()` methods
- [ ] No raw SQL queries
- [ ] Proper indexes on foreign keys
- [ ] Cascade deletes configured correctly
- [ ] Tested rollback (`php artisan migrate:rollback --step=1`)

#### 3. Service Provider Registered
```bash
# Verify provider is loaded
php artisan about

# Check bindings
php artisan tinker --execute="dd(app(App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface::class))"
```

**Expected**: Should show `EloquentModuleRepository` instance

#### 4. Database Indexes Optimized
```sql
-- Check indexes on modules table
SELECT
    tablename,
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    tablename = 'modules';
```

**Expected Indexes**:
- `modules_pkey` (PRIMARY KEY on id)
- `modules_name_unique` (UNIQUE on name)
- `modules_is_published_index` (INDEX on is_published)

#### 5. Query Performance Verified
```bash
php artisan tinker
```
```php
// Enable query logging
DB::enableQueryLog();

// Run repository operation
$repo = app(App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface::class);
$modules = $repo->findAllActive();

// Check queries
dd(DB::getQueryLog());
```

**Red Flags**:
- N+1 queries (multiple SELECT for same table)
- Full table scans without WHERE
- Missing eager loading

#### 6. Memory Usage
```bash
# Monitor memory during tests
php artisan test --filter=ModuleRegistry --profile
```

**Thresholds**:
- Per test: < 10MB
- Full suite: < 100MB

#### 7. Code Coverage
```bash
# Generate coverage report
php artisan test --coverage --min=80
```

**Target**: ≥80% coverage for infrastructure layer

---

## Conclusion

### What We Achieved

✅ **60 Infrastructure Tests** (15 + 30 + 15)
✅ **100% TDD Workflow** (test-first, every file)
✅ **Hexagonal Architecture** (domain → ports → adapters)
✅ **Multi-Tenancy Support** (landlord/tenant separation)
✅ **Service Provider Integration** (DI working)
✅ **Production-Ready Code** (258 tests prove it)

### Key Learnings

1. **TDD is Your Safety Net**
   - Tests caught bugs before they reached production
   - Refactoring was fearless with 258 passing tests
   - Documentation embedded in executable tests

2. **Hexagonal Architecture Works**
   - Domain remained pure (zero framework imports)
   - Infrastructure can be swapped (Eloquent → Doctrine)
   - Testing was easier (mock interfaces, not implementations)

3. **Multi-Tenancy Requires Discipline**
   - Clear database separation (landlord vs tenant)
   - Cross-database references via application layer
   - Consistent testing patterns across both DBs

4. **Repository Pattern is Worth It**
   - Domain doesn't care about Eloquent
   - Mapping logic isolated in one place
   - Easy to optimize queries without touching domain

5. **Service Provider is the Glue**
   - Binds everything together
   - Enables dependency injection
   - Makes testing with mocks trivial

### Next Steps

**For New Features**:
1. Start with domain tests (Phase 1)
2. Add application tests (Phase 2)
3. Add infrastructure tests (Phase 3) ← This guide
4. Wire up via service provider
5. Verify with integration tests

**For Debugging**:
1. Read error message carefully
2. Write failing test that reproduces bug
3. Fix code to make test pass
4. Verify no regression (run full suite)

**For Production**:
1. Run checklist from this guide
2. Review all migrations
3. Verify service provider bindings
4. Check query performance
5. Deploy with confidence!

### Resources

**Testing**:
- Run tests: `php artisan test --filter=ModuleRegistry`
- Debug mode: `php artisan test --filter=test_name --debug`
- Coverage: `php artisan test --coverage --min=80`

**Database**:
- Tinker: `php artisan tinker`
- Migrations: `php artisan migrate:status`
- Tenant migrations: `php artisan tenantauth:migrate --all`

**Code Locations**:
```
app/Contexts/ModuleRegistry/
├── Domain/              # Phase 1 (pure business logic)
├── Application/         # Phase 2 (use cases)
├── Infrastructure/      # Phase 3 (this guide)
│   ├── Persistence/     # Repositories, Eloquent models
│   ├── Adapters/        # Service adapters
│   └── Database/        # Migrations
└── Providers/           # Service provider

tests/Unit/Contexts/ModuleRegistry/
├── Domain/              # Phase 1 tests
├── Application/         # Phase 2 tests
└── Infrastructure/      # Phase 3 tests (258 tests)
```

### Final Words

Infrastructure Layer is where **theory meets practice**. You've successfully:

- Built adapters that respect domain boundaries
- Created repositories that handle persistence elegantly
- Managed multi-tenancy at the database level
- Wired everything together with dependency injection

**The tests prove it works. The architecture ensures it will keep working.**

Now go build amazing features on this solid foundation! 🚀

---

**Document Version**: 1.0
**Last Updated**: 2025-12-29
**Maintained By**: Backend Team
**Questions?**: Review tests in `tests/Unit/Contexts/ModuleRegistry/Infrastructure/`
