# Phase 3: Infrastructure Layer - Detailed Implementation Guide

**ModuleRegistry Context - Infrastructure Layer**
**Week 3 Implementation (Days 15-21)**
**Target: 59 tests, 16 files**

---

## 📋 Overview

Phase 3 implements the **Infrastructure Layer** - the concrete implementations of domain ports (repositories, event publishers) and persistence mechanisms (Eloquent models, migrations).

### Key Principles

1. **Hexagonal Architecture** - Infrastructure adapts to domain, not vice versa
2. **Repository Pattern** - Map between domain aggregates and Eloquent models
3. **Event Publishing** - Bridge domain events to Laravel's event system
4. **Database Migrations** - PostgreSQL schema with proper indexing
5. **Zero Domain Contamination** - Domain layer remains framework-free

---

## 🎯 Success Criteria

| Metric | Target |
|--------|--------|
| **Tests** | 59 |
| **Code Coverage** | ≥90% |
| **Framework Coupling** | Infrastructure layer ONLY |
| **Migration Reversibility** | 100% (all `down()` methods work) |
| **Database Performance** | Proper indexes on foreign keys, searches |

---

## 📁 File Structure

```
app/Contexts/ModuleRegistry/
├── Infrastructure/
│   ├── Persistence/
│   │   ├── Eloquent/
│   │   │   ├── ModuleModel.php
│   │   │   ├── TenantModuleModel.php
│   │   │   ├── ModuleInstallationJobModel.php
│   │   │   ├── InstallationStepModel.php
│   │   │   └── ModuleDependencyModel.php
│   │   └── Repositories/
│   │       ├── EloquentModuleRepository.php
│   │       ├── EloquentTenantModuleRepository.php
│   │       └── EloquentModuleInstallationJobRepository.php
│   ├── Events/
│   │   └── LaravelEventPublisher.php
│   └── Services/
│       └── LaravelSubscriptionService.php
└── Providers/
    └── ModuleRegistryServiceProvider.php

database/migrations/
├── landlord/
│   ├── 2025_01_15_000001_create_modules_table.php
│   └── 2025_01_15_000002_create_module_dependencies_table.php
└── tenant/
    ├── 2025_01_15_000003_create_tenant_modules_table.php
    ├── 2025_01_15_000004_create_module_installation_jobs_table.php
    └── 2025_01_15_000005_create_installation_steps_table.php

tests/Unit/Contexts/ModuleRegistry/Infrastructure/
├── Persistence/
│   ├── EloquentModuleRepositoryTest.php (15 tests)
│   ├── EloquentTenantModuleRepositoryTest.php (14 tests)
│   └── EloquentModuleInstallationJobRepositoryTest.php (16 tests)
├── Events/
│   └── LaravelEventPublisherTest.php (8 tests)
└── Services/
    └── LaravelSubscriptionServiceTest.php (6 tests)
```

---

## 🗄️ Database Schema Design

### Landlord Database (Platform Catalog)

**modules table:**
```sql
CREATE TABLE modules (
    id UUID PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    namespace VARCHAR(100) NOT NULL,
    migrations_path VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    requires_subscription BOOLEAN NOT NULL DEFAULT false,
    configuration JSONB,
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    INDEX idx_name (name),
    INDEX idx_status (status),
    INDEX idx_requires_subscription (requires_subscription)
);
```

**module_dependencies table:**
```sql
CREATE TABLE module_dependencies (
    id BIGSERIAL PRIMARY KEY,
    module_id UUID NOT NULL,
    depends_on_module_name VARCHAR(50) NOT NULL,
    version_constraint VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,

    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    INDEX idx_module_id (module_id)
);
```

### Tenant Database (Installation Tracking)

**tenant_modules table:**
```sql
CREATE TABLE tenant_modules (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    module_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    installed_by VARCHAR(100),
    installed_at TIMESTAMP,
    failure_reason TEXT,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    UNIQUE KEY unique_tenant_module (tenant_id, module_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_module_id (module_id),
    INDEX idx_status (status)
);
```

**module_installation_jobs table:**
```sql
CREATE TABLE module_installation_jobs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    module_id UUID NOT NULL,
    job_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    rollback_reason TEXT,
    rolled_back_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    INDEX idx_tenant_id (tenant_id),
    INDEX idx_module_id (module_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
```

**installation_steps table:**
```sql
CREATE TABLE installation_steps (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    FOREIGN KEY (job_id) REFERENCES module_installation_jobs(id) ON DELETE CASCADE,
    UNIQUE KEY unique_job_step (job_id, step_name),
    INDEX idx_job_id (job_id),
    INDEX idx_status (status)
);
```

---

## 🔧 Implementation Details

### 1. Eloquent Models

**ModuleModel.php** (Platform-level, Landlord DB)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Eloquent Model for Module
 *
 * INFRASTRUCTURE LAYER - Framework Coupling Allowed
 * Maps to modules table in LANDLORD database
 */
final class ModuleModel extends Model
{
    protected $table = 'modules';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'display_name',
        'version',
        'namespace',
        'migrations_path',
        'status',
        'requires_subscription',
        'configuration',
        'published_at',
    ];

    protected $casts = [
        'id' => 'string',
        'requires_subscription' => 'boolean',
        'configuration' => 'array',
        'published_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relationship: Module has many dependencies
     */
    public function dependencies(): HasMany
    {
        return $this->hasMany(ModuleDependencyModel::class, 'module_id');
    }
}
```

**TenantModuleModel.php** (Tenant-specific, Tenant DB)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;

/**
 * Eloquent Model for TenantModule
 *
 * INFRASTRUCTURE LAYER - Framework Coupling Allowed
 * Maps to tenant_modules table in TENANT database
 */
final class TenantModuleModel extends Model
{
    protected $table = 'tenant_modules';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'tenant_id',
        'module_id',
        'status',
        'installed_by',
        'installed_at',
        'failure_reason',
        'last_used_at',
    ];

    protected $casts = [
        'id' => 'string',
        'tenant_id' => 'string',
        'module_id' => 'string',
        'installed_at' => 'datetime',
        'last_used_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
```

**ModuleInstallationJobModel.php** (Tenant-specific, Tenant DB)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Eloquent Model for ModuleInstallationJob
 *
 * INFRASTRUCTURE LAYER - Framework Coupling Allowed
 * Maps to module_installation_jobs table in TENANT database
 */
final class ModuleInstallationJobModel extends Model
{
    protected $table = 'module_installation_jobs';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'tenant_id',
        'module_id',
        'job_type',
        'status',
        'started_at',
        'completed_at',
        'failed_at',
        'error_message',
        'rollback_reason',
        'rolled_back_at',
    ];

    protected $casts = [
        'id' => 'string',
        'tenant_id' => 'string',
        'module_id' => 'string',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'failed_at' => 'datetime',
        'rolled_back_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relationship: Job has many steps
     */
    public function steps(): HasMany
    {
        return $this->hasMany(InstallationStepModel::class, 'job_id');
    }
}
```

---

### 2. Repository Implementations

**EloquentModuleRepository.php** (15 tests)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories;

use App\Contexts\ModuleRegistry\Domain\Models\Module;
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleDependencyModel;

/**
 * EloquentModuleRepository - Repository Pattern Implementation
 *
 * INFRASTRUCTURE LAYER - Framework Coupling Allowed
 * Maps between Module aggregate (domain) and ModuleModel (Eloquent)
 *
 * Responsibilities:
 * 1. Convert Module aggregate → ModuleModel
 * 2. Convert ModuleModel → Module aggregate
 * 3. Handle dependencies as separate table
 * 4. Provide query methods
 */
final class EloquentModuleRepository implements ModuleRepositoryInterface
{
    /**
     * Save module aggregate
     *
     * @param Module $module Domain aggregate
     */
    public function save(Module $module): void
    {
        $model = ModuleModel::query()->updateOrCreate(
            ['id' => $module->id()->toString()],
            [
                'name' => $module->name()->toString(),
                'display_name' => $module->displayName(),
                'version' => $module->version()->toString(),
                'namespace' => $module->namespace(),
                'migrations_path' => $module->migrationsPath(),
                'status' => $module->status()->value,
                'requires_subscription' => $module->requiresSubscription(),
                'configuration' => $module->configuration()->toArray(),
                'published_at' => $module->publishedAt(),
            ]
        );

        // Delete existing dependencies and recreate (simplest approach)
        ModuleDependencyModel::query()
            ->where('module_id', $module->id()->toString())
            ->delete();

        foreach ($module->dependencies() as $dependency) {
            ModuleDependencyModel::query()->create([
                'module_id' => $module->id()->toString(),
                'depends_on_module_name' => $dependency->moduleName()->toString(),
                'version_constraint' => $dependency->versionConstraint(),
            ]);
        }
    }

    /**
     * Find module by ID
     *
     * @param ModuleId $id Module identifier
     * @return Module|null Domain aggregate or null
     */
    public function findById(ModuleId $id): ?Module
    {
        $model = ModuleModel::query()
            ->with('dependencies')
            ->find($id->toString());

        if ($model === null) {
            return null;
        }

        return $this->toDomainModel($model);
    }

    /**
     * Find module by name
     *
     * @param ModuleName $name Module name
     * @return Module|null Domain aggregate or null
     */
    public function findByName(ModuleName $name): ?Module
    {
        $model = ModuleModel::query()
            ->with('dependencies')
            ->where('name', $name->toString())
            ->first();

        if ($model === null) {
            return null;
        }

        return $this->toDomainModel($model);
    }

    /**
     * Get all active modules
     *
     * @return Module[] Array of domain aggregates
     */
    public function getAllActive(): array
    {
        $models = ModuleModel::query()
            ->with('dependencies')
            ->where('status', 'ACTIVE')
            ->get();

        return $models->map(fn($model) => $this->toDomainModel($model))->all();
    }

    /**
     * Delete module
     *
     * @param ModuleId $id Module identifier
     */
    public function delete(ModuleId $id): void
    {
        ModuleModel::query()->where('id', $id->toString())->delete();
    }

    /**
     * Convert Eloquent model to domain aggregate
     *
     * CRITICAL: This method reconstructs the domain aggregate from database state
     * - Must rebuild all value objects
     * - Must restore all dependencies
     * - Must maintain domain invariants
     *
     * @param ModuleModel $model Eloquent model
     * @return Module Domain aggregate
     */
    private function toDomainModel(ModuleModel $model): Module
    {
        $module = new Module(
            ModuleId::fromString($model->id),
            ModuleName::fromString($model->name),
            $model->display_name,
            ModuleVersion::fromString($model->version),
            $model->namespace,
            $model->migrations_path,
            ModuleStatus::from($model->status),
            $model->requires_subscription,
            new ModuleConfiguration($model->configuration ?? [])
        );

        // Restore dependencies
        foreach ($model->dependencies as $dependencyModel) {
            $module->addDependency(
                new ModuleDependency(
                    ModuleName::fromString($dependencyModel->depends_on_module_name),
                    $dependencyModel->version_constraint
                )
            );
        }

        // Restore published state
        if ($model->published_at !== null) {
            $module->publish($model->published_at);
        }

        return $module;
    }
}
```

**EloquentTenantModuleRepository.php** (14 tests)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories;

use App\Contexts\ModuleRegistry\Domain\Models\TenantModule;
use App\Contexts\ModuleRegistry\Domain\Ports\TenantModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\TenantId;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\TenantModuleModel;

/**
 * EloquentTenantModuleRepository - Repository Pattern Implementation
 *
 * INFRASTRUCTURE LAYER - Framework Coupling Allowed
 * Maps between TenantModule aggregate (domain) and TenantModuleModel (Eloquent)
 *
 * CRITICAL: This repository operates on TENANT database
 */
final class EloquentTenantModuleRepository implements TenantModuleRepositoryInterface
{
    public function save(TenantModule $tenantModule): void
    {
        TenantModuleModel::query()->updateOrCreate(
            [
                'id' => $tenantModule->id()->toString(),
            ],
            [
                'tenant_id' => $tenantModule->tenantId()->toString(),
                'module_id' => $tenantModule->moduleId()->toString(),
                'status' => $tenantModule->status()->value,
                'installed_by' => $tenantModule->installedBy(),
                'installed_at' => $tenantModule->installedAt(),
                'failure_reason' => $tenantModule->failureReason(),
                'last_used_at' => $tenantModule->lastUsedAt(),
            ]
        );
    }

    public function findById(TenantModuleId $id): ?TenantModule
    {
        $model = TenantModuleModel::query()->find($id->toString());

        if ($model === null) {
            return null;
        }

        return $this->toDomainModel($model);
    }

    public function findByTenantAndModule(TenantId $tenantId, ModuleId $moduleId): ?TenantModule
    {
        $model = TenantModuleModel::query()
            ->where('tenant_id', $tenantId->toString())
            ->where('module_id', $moduleId->toString())
            ->first();

        if ($model === null) {
            return null;
        }

        return $this->toDomainModel($model);
    }

    public function getAllForTenant(TenantId $tenantId): array
    {
        $models = TenantModuleModel::query()
            ->where('tenant_id', $tenantId->toString())
            ->get();

        return $models->map(fn($model) => $this->toDomainModel($model))->all();
    }

    public function delete(TenantModuleId $id): void
    {
        TenantModuleModel::query()->where('id', $id->toString())->delete();
    }

    /**
     * Convert Eloquent model to domain aggregate
     */
    private function toDomainModel(TenantModuleModel $model): TenantModule
    {
        $tenantModule = new TenantModule(
            TenantModuleId::fromString($model->id),
            TenantId::fromString($model->tenant_id),
            ModuleId::fromString($model->module_id),
            InstallationStatus::from($model->status)
        );

        // Restore installation state if installed
        if ($model->installed_at !== null && $model->installed_by !== null) {
            $tenantModule->markAsInstalled($model->installed_by, $model->installed_at);
        }

        // Restore failure state if failed
        if ($model->failure_reason !== null) {
            $tenantModule->markAsFailed($model->failure_reason, new \DateTimeImmutable());
        }

        // Restore last used timestamp
        if ($model->last_used_at !== null) {
            $tenantModule->recordUsage($model->last_used_at);
        }

        return $tenantModule;
    }
}
```

---

### 3. Event Publisher

**LaravelEventPublisher.php** (8 tests)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Infrastructure\Events;

use App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface;
use App\Contexts\ModuleRegistry\Domain\Events\DomainEventInterface;
use Illuminate\Contracts\Events\Dispatcher;

/**
 * LaravelEventPublisher - Event Publisher Implementation
 *
 * INFRASTRUCTURE LAYER - Framework Coupling Allowed
 * Bridges domain events to Laravel's event system
 *
 * Design Pattern: Adapter Pattern
 * - Domain events are framework-agnostic
 * - Laravel event dispatcher is framework-specific
 * - This adapter connects them
 */
final class LaravelEventPublisher implements EventPublisherInterface
{
    public function __construct(
        private Dispatcher $eventDispatcher
    ) {
    }

    /**
     * Publish domain event to Laravel event system
     *
     * @param DomainEventInterface $event Domain event
     */
    public function publish(DomainEventInterface $event): void
    {
        $this->eventDispatcher->dispatch($event);
    }

    /**
     * Publish multiple domain events
     *
     * @param DomainEventInterface[] $events Array of domain events
     */
    public function publishMany(array $events): void
    {
        foreach ($events as $event) {
            $this->publish($event);
        }
    }
}
```

---

### 4. Subscription Service Adapter

**LaravelSubscriptionService.php** (6 tests)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Infrastructure\Services;

use App\Contexts\ModuleRegistry\Domain\Ports\SubscriptionServiceInterface;
use App\Contexts\ModuleRegistry\Domain\Models\Module;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\TenantId;
use App\Contexts\Subscription\Application\Services\SubscriptionQueryService;

/**
 * LaravelSubscriptionService - Subscription Service Adapter
 *
 * INFRASTRUCTURE LAYER - Framework Coupling Allowed
 * Bridges to Subscription bounded context
 *
 * Design Pattern: Anti-Corruption Layer
 * - Protects ModuleRegistry domain from Subscription domain changes
 * - Translates between different domain models
 */
final class LaravelSubscriptionService implements SubscriptionServiceInterface
{
    public function __construct(
        private SubscriptionQueryService $subscriptionQueryService
    ) {
    }

    /**
     * Check if tenant has subscription for module
     *
     * @param TenantId $tenantId Tenant identifier
     * @param Module $module Module to check
     * @return bool True if tenant has valid subscription
     */
    public function hasSubscriptionForModule(TenantId $tenantId, Module $module): bool
    {
        // Query Subscription context
        $subscription = $this->subscriptionQueryService->getActiveSubscriptionForTenant(
            $tenantId->toString()
        );

        if ($subscription === null) {
            return false;
        }

        // Check if subscription includes this module
        return $subscription->hasModuleAccess($module->name()->toString());
    }

    /**
     * Get subscription quota for module
     *
     * @param TenantId $tenantId Tenant identifier
     * @param Module $module Module to check
     * @return int|null Quota limit or null for unlimited
     */
    public function getSubscriptionQuota(TenantId $tenantId, Module $module): ?int
    {
        $subscription = $this->subscriptionQueryService->getActiveSubscriptionForTenant(
            $tenantId->toString()
        );

        if ($subscription === null) {
            return null;
        }

        return $subscription->getModuleQuota($module->name()->toString());
    }
}
```

---

### 5. Service Provider

**ModuleRegistryServiceProvider.php**

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Providers;

use Illuminate\Support\ServiceProvider;
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\Ports\TenantModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleInstallationJobRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface;
use App\Contexts\ModuleRegistry\Domain\Ports\SubscriptionServiceInterface;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories\EloquentModuleRepository;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories\EloquentTenantModuleRepository;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories\EloquentModuleInstallationJobRepository;
use App\Contexts\ModuleRegistry\Infrastructure\Events\LaravelEventPublisher;
use App\Contexts\ModuleRegistry\Infrastructure\Services\LaravelSubscriptionService;

/**
 * ModuleRegistryServiceProvider - DI Container Bindings
 *
 * Binds domain interfaces to infrastructure implementations
 */
final class ModuleRegistryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Repository bindings
        $this->app->bind(
            ModuleRepositoryInterface::class,
            EloquentModuleRepository::class
        );

        $this->app->bind(
            TenantModuleRepositoryInterface::class,
            EloquentTenantModuleRepository::class
        );

        $this->app->bind(
            ModuleInstallationJobRepositoryInterface::class,
            EloquentModuleInstallationJobRepository::class
        );

        // Event publisher binding
        $this->app->bind(
            EventPublisherInterface::class,
            LaravelEventPublisher::class
        );

        // Subscription service binding
        $this->app->bind(
            SubscriptionServiceInterface::class,
            LaravelSubscriptionService::class
        );
    }
}
```

---

## 🧪 Testing Strategy

### Test Categories

1. **Repository Tests (45 tests total)**
   - EloquentModuleRepositoryTest (15 tests)
   - EloquentTenantModuleRepositoryTest (14 tests)
   - EloquentModuleInstallationJobRepositoryTest (16 tests)

2. **Event Publisher Tests (8 tests)**
   - LaravelEventPublisherTest (8 tests)

3. **Service Adapter Tests (6 tests)**
   - LaravelSubscriptionServiceTest (6 tests)

### Test Database Strategy

**Use in-memory SQLite for unit tests:**

```php
// tests/Unit/Contexts/ModuleRegistry/Infrastructure/InfrastructureTestCase.php

abstract class InfrastructureTestCase extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Use in-memory SQLite for fast tests
        config(['database.default' => 'sqlite']);
        config(['database.connections.sqlite.database' => ':memory:']);

        $this->artisan('migrate');
    }
}
```

### Sample Repository Test

**EloquentModuleRepositoryTest.php** (15 tests)

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Contexts\ModuleRegistry\Infrastructure\Persistence;

use Tests\Unit\Contexts\ModuleRegistry\Infrastructure\InfrastructureTestCase;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories\EloquentModuleRepository;
use App\Contexts\ModuleRegistry\Domain\Models\Module;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName;

final class EloquentModuleRepositoryTest extends InfrastructureTestCase
{
    private EloquentModuleRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new EloquentModuleRepository();
    }

    public function test_can_save_module(): void
    {
        // Arrange
        $module = new Module(
            ModuleId::generate(),
            ModuleName::fromString('test_module'),
            'Test Module',
            ModuleVersion::fromString('1.0.0'),
            'App\\Modules\\Test',
            'database/migrations/modules/test',
            ModuleStatus::ACTIVE,
            false,
            new ModuleConfiguration([])
        );

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertDatabaseHas('modules', [
            'id' => $module->id()->toString(),
            'name' => 'test_module',
            'display_name' => 'Test Module',
        ]);
    }

    public function test_can_find_module_by_id(): void
    {
        // Arrange
        $module = $this->createAndSaveModule();

        // Act
        $foundModule = $this->repository->findById($module->id());

        // Assert
        $this->assertInstanceOf(Module::class, $foundModule);
        $this->assertTrue($foundModule->id()->equals($module->id()));
    }

    public function test_returns_null_when_module_not_found(): void
    {
        // Arrange
        $nonExistentId = ModuleId::generate();

        // Act
        $result = $this->repository->findById($nonExistentId);

        // Assert
        $this->assertNull($result);
    }

    public function test_can_save_module_with_dependencies(): void
    {
        // Arrange
        $module = $this->createModule();
        $module->addDependency(
            new ModuleDependency(
                ModuleName::fromString('core'),
                '>=1.0.0'
            )
        );

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertDatabaseHas('module_dependencies', [
            'module_id' => $module->id()->toString(),
            'depends_on_module_name' => 'core',
            'version_constraint' => '>=1.0.0',
        ]);
    }

    public function test_can_retrieve_module_with_dependencies(): void
    {
        // Arrange
        $module = $this->createModule();
        $module->addDependency(
            new ModuleDependency(ModuleName::fromString('core'), '>=1.0.0')
        );
        $this->repository->save($module);

        // Act
        $retrieved = $this->repository->findById($module->id());

        // Assert
        $this->assertCount(1, $retrieved->dependencies());
        $this->assertEquals('core', $retrieved->dependencies()[0]->moduleName()->toString());
    }

    public function test_can_delete_module(): void
    {
        // Arrange
        $module = $this->createAndSaveModule();

        // Act
        $this->repository->delete($module->id());

        // Assert
        $this->assertDatabaseMissing('modules', [
            'id' => $module->id()->toString(),
        ]);
    }

    public function test_deleting_module_cascades_to_dependencies(): void
    {
        // Arrange
        $module = $this->createModule();
        $module->addDependency(
            new ModuleDependency(ModuleName::fromString('core'), '>=1.0.0')
        );
        $this->repository->save($module);

        // Act
        $this->repository->delete($module->id());

        // Assert
        $this->assertDatabaseMissing('module_dependencies', [
            'module_id' => $module->id()->toString(),
        ]);
    }

    // ... 8 more tests (getAllActive, findByName, update scenarios, etc.)

    private function createModule(): Module
    {
        return new Module(
            ModuleId::generate(),
            ModuleName::fromString('test_module'),
            'Test Module',
            ModuleVersion::fromString('1.0.0'),
            'App\\Modules\\Test',
            null,
            ModuleStatus::ACTIVE,
            false,
            new ModuleConfiguration([])
        );
    }

    private function createAndSaveModule(): Module
    {
        $module = $this->createModule();
        $this->repository->save($module);
        return $module;
    }
}
```

---

## 📅 Implementation Timeline

### Day 15-16: Landlord Database (Modules)
- ✅ Create migrations: modules, module_dependencies
- ✅ Create ModuleModel, ModuleDependencyModel
- ✅ Implement EloquentModuleRepository
- ✅ Write 15 repository tests

### Day 17-18: Tenant Database (Installations)
- ✅ Create migrations: tenant_modules, module_installation_jobs, installation_steps
- ✅ Create TenantModuleModel, ModuleInstallationJobModel, InstallationStepModel
- ✅ Implement EloquentTenantModuleRepository
- ✅ Implement EloquentModuleInstallationJobRepository
- ✅ Write 30 repository tests (14 + 16)

### Day 19: Event & Subscription Adapters
- ✅ Implement LaravelEventPublisher
- ✅ Implement LaravelSubscriptionService
- ✅ Write 14 tests (8 + 6)

### Day 20: Service Provider & Integration
- ✅ Create ModuleRegistryServiceProvider
- ✅ Register in config/app.php
- ✅ Verify DI bindings work

### Day 21: Buffer & Documentation
- ✅ Fix any failing tests
- ✅ Run full test suite (Phase 1 + 2 + 3)
- ✅ Update developer guide

---

## ✅ Acceptance Criteria

| Criteria | Target | Verification |
|----------|--------|--------------|
| All tests passing | 59/59 | `php artisan test --filter=ModuleRegistry\\Infrastructure` |
| Migrations reversible | 100% | `php artisan migrate:rollback --step=5` |
| Zero domain coupling | ✅ | Infrastructure NEVER imports domain internals |
| Database indexes | ✅ | All foreign keys + search columns indexed |

---

**Phase 3 Status: READY FOR IMPLEMENTATION ✅**

Next: **Phase 4 - Integration & API Layer**
