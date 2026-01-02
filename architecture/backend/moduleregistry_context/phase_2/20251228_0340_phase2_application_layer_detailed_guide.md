# ModuleRegistry Context - Phase 2: Application Layer Detailed Guide

**Created:** 2025-12-28 03:40
**Phase:** 2 - Application Layer
**Status:** 📋 Ready to Implement
**Prerequisites:** Phase 1 Complete ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Application Services](#application-services)
3. [Commands (CQRS)](#commands-cqrs)
4. [DTOs](#dtos)
5. [Validators](#validators)
6. [Implementation Steps](#implementation-steps)
7. [Testing Strategy](#testing-strategy)

---

## Overview

### What is the Application Layer?

The Application Layer sits between the **Domain Layer** (pure business logic) and **Infrastructure Layer** (framework-specific code). It orchestrates domain operations, enforces workflows, and provides use case implementations.

### Key Responsibilities

1. **Orchestration** - Coordinate multiple domain aggregates
2. **Transaction Management** - Ensure data consistency
3. **Event Publishing** - Publish domain events after persistence
4. **Use Case Implementation** - Implement business workflows
5. **DTO Mapping** - Convert domain objects to DTOs for presentation

### Layering

```
┌───────────────────────────────────┐
│   Presentation Layer (Phase 4)   │ ← Controllers, Resources
├───────────────────────────────────┤
│   Application Layer (Phase 2) 👈 │ ← Services, Commands, DTOs
├───────────────────────────────────┤
│   Domain Layer (Phase 1) ✅      │ ← Aggregates, VOs, Services
└───────────────────────────────────┘
```

---

## Application Services

### ModuleRegistrationService

**File:** `app/Contexts/ModuleRegistry/Application/Services/ModuleRegistrationService.php`

**Purpose:** Manage module catalog (CRUD operations)

#### Full Implementation

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\Services;

use App\Contexts\ModuleRegistry\Application\Commands\RegisterModuleCommand;
use App\Contexts\ModuleRegistry\Application\Commands\UpdateModuleVersionCommand;
use App\Contexts\ModuleRegistry\Application\Commands\PublishModuleCommand;
use App\Contexts\ModuleRegistry\Application\Commands\DeprecateModuleCommand;
use App\Contexts\ModuleRegistry\Application\DTOs\ModuleDTO;
use App\Contexts\ModuleRegistry\Application\Exceptions\ModuleAlreadyExistsException;
use App\Contexts\ModuleRegistry\Domain\Models\Module;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleVersion;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleConfiguration;
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface;

final class ModuleRegistrationService
{
    public function __construct(
        private ModuleRepositoryInterface $moduleRepository,
        private EventPublisherInterface $eventPublisher
    ) {
    }

    /**
     * Register new module in catalog
     *
     * @throws ModuleAlreadyExistsException if module name already exists
     */
    public function registerModule(RegisterModuleCommand $command): ModuleId
    {
        // Check if module already exists
        $existingModule = $this->moduleRepository->findByName(
            ModuleName::fromString($command->name)
        );

        if ($existingModule !== null) {
            throw ModuleAlreadyExistsException::withName($command->name);
        }

        // Create domain aggregate
        $module = new Module(
            ModuleId::generate(),
            ModuleName::fromString($command->name),
            $command->displayName,
            ModuleVersion::fromString($command->version),
            $command->description,
            $command->namespace,
            $command->migrationsPath,
            $command->requiresSubscription,
            new ModuleConfiguration($command->configuration)
        );

        // Add dependencies
        foreach ($command->dependencies as $dependency) {
            $module->addDependency($dependency);
        }

        // Persist aggregate
        $this->moduleRepository->save($module);

        // Publish domain events
        $events = $module->releaseEvents();
        foreach ($events as $event) {
            $this->eventPublisher->publish($event);
        }

        return $module->id();
    }

    /**
     * Update module version
     */
    public function updateModuleVersion(UpdateModuleVersionCommand $command): void
    {
        $module = $this->moduleRepository->findById(
            ModuleId::fromString($command->moduleId)
        );

        if ($module === null) {
            throw ModuleNotFoundException::withId($command->moduleId);
        }

        // Update version (domain validates no downgrade)
        $module->updateVersion(
            ModuleVersion::fromString($command->newVersion)
        );

        $this->moduleRepository->save($module);
    }

    /**
     * Publish module
     */
    public function publishModule(PublishModuleCommand $command): void
    {
        $module = $this->moduleRepository->findById(
            ModuleId::fromString($command->moduleId)
        );

        if ($module === null) {
            throw ModuleNotFoundException::withId($command->moduleId);
        }

        // Publish (domain validates not already published)
        $module->publish();

        $this->moduleRepository->save($module);
    }

    /**
     * Deprecate module
     */
    public function deprecateModule(DeprecateModuleCommand $command): void
    {
        $module = $this->moduleRepository->findById(
            ModuleId::fromString($command->moduleId)
        );

        if ($module === null) {
            throw ModuleNotFoundException::withId($command->moduleId);
        }

        // Get active tenant count from repository
        $activeTenantCount = $this->moduleRepository->countActiveTenants(
            $module->id()
        );

        // Deprecate (domain validates no active tenants)
        $module->deprecate($activeTenantCount);

        $this->moduleRepository->save($module);
    }
}
```

#### Test Example

```php
<?php

namespace Tests\Unit\Contexts\ModuleRegistry\Application\Services;

use Tests\TestCase;

final class ModuleRegistrationServiceTest extends TestCase
{
    public function test_registers_new_module(): void
    {
        $repository = $this->createMock(ModuleRepositoryInterface::class);
        $eventPublisher = $this->createMock(EventPublisherInterface::class);

        $repository->expects($this->once())
            ->method('findByName')
            ->willReturn(null); // No existing module

        $repository->expects($this->once())
            ->method('save');

        $eventPublisher->expects($this->once())
            ->method('publish');

        $service = new ModuleRegistrationService($repository, $eventPublisher);

        $command = new RegisterModuleCommand(
            name: 'finance_module',
            displayName: 'Finance Module',
            version: '1.0.0',
            description: 'Financial management',
            namespace: 'App\\Modules\\Finance',
            migrationsPath: 'database/migrations/finance',
            requiresSubscription: true,
            configuration: [],
            dependencies: []
        );

        $moduleId = $service->registerModule($command);

        $this->assertInstanceOf(ModuleId::class, $moduleId);
    }

    public function test_throws_exception_if_module_already_exists(): void
    {
        $repository = $this->createMock(ModuleRepositoryInterface::class);
        $eventPublisher = $this->createMock(EventPublisherInterface::class);

        $existingModule = $this->createMock(Module::class);

        $repository->expects($this->once())
            ->method('findByName')
            ->willReturn($existingModule); // Module exists

        $service = new ModuleRegistrationService($repository, $eventPublisher);

        $command = new RegisterModuleCommand(/* ... */);

        $this->expectException(ModuleAlreadyExistsException::class);

        $service->registerModule($command);
    }
}
```

---

### ModuleInstallationService

**File:** `app/Contexts/ModuleRegistry/Application/Services/ModuleInstallationService.php`

**Purpose:** Orchestrate module installation for tenants

#### Implementation Pattern

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\Services;

use App\Contexts\ModuleRegistry\Application\Commands\InstallModuleCommand;
use App\Contexts\ModuleRegistry\Domain\Services\SubscriptionValidator;
use App\Contexts\ModuleRegistry\Domain\Services\DependencyResolver;
use App\Contexts\ModuleRegistry\Domain\Models\TenantModule;
use App\Contexts\ModuleRegistry\Domain\Models\ModuleInstallationJob;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\{TenantModuleId, JobType};

final class ModuleInstallationService
{
    public function __construct(
        private ModuleRepositoryInterface $moduleRepository,
        private TenantModuleRepositoryInterface $tenantModuleRepository,
        private InstallationJobRepositoryInterface $jobRepository,
        private SubscriptionValidator $subscriptionValidator,
        private DependencyResolver $dependencyResolver,
        private EventPublisherInterface $eventPublisher
    ) {
    }

    /**
     * Install module for tenant
     *
     * Workflow:
     * 1. Validate subscription
     * 2. Validate dependencies
     * 3. Create installation job
     * 4. Create tenant module (PENDING)
     * 5. Start job execution
     */
    public function installForTenant(InstallModuleCommand $command): TenantModuleId
    {
        $tenantId = TenantId::fromString($command->tenantId);
        $moduleId = ModuleId::fromString($command->moduleId);

        // Load module from catalog
        $module = $this->moduleRepository->findById($moduleId);
        if ($module === null) {
            throw ModuleNotFoundException::withId($command->moduleId);
        }

        // 1. Validate subscription (domain service)
        $this->subscriptionValidator->canInstall($tenantId, $module);

        // 2. Get installed modules for tenant
        $installedModules = $this->getInstalledModulesForTenant($tenantId);

        // 3. Validate dependencies (domain service)
        $this->dependencyResolver->validateDependencies($module, $installedModules);

        // 4. Create TenantModule (starts as PENDING)
        $tenantModule = new TenantModule(
            TenantModuleId::generate(),
            $tenantId,
            $moduleId,
            $module->version(),
            new ModuleConfiguration($command->configuration ?? [])
        );

        // 5. Create installation job
        $job = new ModuleInstallationJob(
            ModuleInstallationJobId::generate(),
            $tenantId,
            $moduleId,
            JobType::INSTALL,
            $command->installedBy
        );

        // Persist all
        $this->tenantModuleRepository->save($tenantModule);
        $this->jobRepository->save($job);

        // Publish events
        $this->publishEvents($tenantModule, $job);

        return $tenantModule->id();
    }

    private function getInstalledModulesForTenant(TenantId $tenantId): array
    {
        $tenantModules = $this->tenantModuleRepository->findByTenant($tenantId);

        $moduleIds = array_map(
            fn($tm) => $tm->moduleId(),
            array_filter($tenantModules, fn($tm) => $tm->isInstalled())
        );

        return array_map(
            fn($id) => $this->moduleRepository->findById($id),
            $moduleIds
        );
    }

    private function publishEvents(...$aggregates): void
    {
        foreach ($aggregates as $aggregate) {
            foreach ($aggregate->releaseEvents() as $event) {
                $this->eventPublisher->publish($event);
            }
        }
    }
}
```

---

### ModuleInstallationJobService

**File:** `app/Contexts/ModuleRegistry/Application/Services/ModuleInstallationJobService.php`

**Purpose:** Manage installation job lifecycle

#### Key Methods

```php
public function startJob(StartJobCommand $command): void
{
    $job = $this->jobRepository->findById(
        ModuleInstallationJobId::fromString($command->jobId)
    );

    $job->markAsRunning(new DateTimeImmutable());

    $this->jobRepository->save($job);

    // Publish JobStarted event
    $this->publishEvents($job);
}

public function recordStepCompletion(RecordStepCommand $command): void
{
    $job = $this->jobRepository->findById(
        ModuleInstallationJobId::fromString($command->jobId)
    );

    // Idempotent step recording
    $job->recordStepCompletion($command->stepName);

    $this->jobRepository->save($job);
}

public function completeJob(CompleteJobCommand $command): void
{
    $job = $this->jobRepository->findById(
        ModuleInstallationJobId::fromString($command->jobId)
    );

    // Mark as completed (validates no failed steps)
    $job->markAsCompleted(new DateTimeImmutable());

    $this->jobRepository->save($job);

    // Mark tenant module as installed
    $tenantModule = $this->tenantModuleRepository->findByTenantAndModule(
        $job->tenantId(),
        $job->moduleId()
    );

    $tenantModule->markAsInstalling();
    $tenantModule->markAsInstalled($command->completedBy, new DateTimeImmutable());

    $this->tenantModuleRepository->save($tenantModule);

    // Publish events
    $this->publishEvents($job, $tenantModule);
}
```

---

## Commands (CQRS)

### RegisterModuleCommand

**File:** `app/Contexts/ModuleRegistry/Application/Commands/RegisterModuleCommand.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\Commands;

use InvalidArgumentException;

/**
 * RegisterModuleCommand
 *
 * Immutable command for registering a new module
 */
final readonly class RegisterModuleCommand
{
    public function __construct(
        public string $name,
        public string $displayName,
        public string $version,
        public string $description,
        public string $namespace,
        public string $migrationsPath,
        public bool $requiresSubscription,
        public array $configuration,
        public array $dependencies
    ) {
        $this->validate();
    }

    private function validate(): void
    {
        if (empty($this->name)) {
            throw new InvalidArgumentException('Module name cannot be empty');
        }

        if (mb_strlen($this->name) < 3 || mb_strlen($this->name) > 50) {
            throw new InvalidArgumentException('Module name must be 3-50 characters');
        }

        if (!preg_match('/^[a-z0-9_]+$/', $this->name)) {
            throw new InvalidArgumentException('Module name must be lowercase alphanumeric with underscores');
        }

        if (empty($this->displayName)) {
            throw new InvalidArgumentException('Display name cannot be empty');
        }

        if (!preg_match('/^\d+\.\d+\.\d+$/', $this->version)) {
            throw new InvalidArgumentException('Version must be in semantic format (e.g., 1.0.0)');
        }
    }
}
```

### InstallModuleCommand

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\Commands;

final readonly class InstallModuleCommand
{
    public function __construct(
        public string $tenantId,
        public string $moduleId,
        public string $installedBy,
        public ?array $configuration = null
    ) {
        $this->validate();
    }

    private function validate(): void
    {
        if (empty($this->tenantId)) {
            throw new InvalidArgumentException('Tenant ID cannot be empty');
        }

        if (empty($this->moduleId)) {
            throw new InvalidArgumentException('Module ID cannot be empty');
        }

        if (empty($this->installedBy)) {
            throw new InvalidArgumentException('installedBy cannot be empty');
        }
    }
}
```

### Command Testing

```php
public function test_register_module_command_validates_name(): void
{
    $this->expectException(InvalidArgumentException::class);
    $this->expectExceptionMessage('Module name must be lowercase');

    new RegisterModuleCommand(
        name: 'InvalidName', // ❌ Uppercase
        displayName: 'Test',
        version: '1.0.0',
        description: 'Test',
        namespace: 'App\\Test',
        migrationsPath: 'migrations',
        requiresSubscription: false,
        configuration: [],
        dependencies: []
    );
}
```

---

## DTOs

### ModuleDTO

**File:** `app/Contexts/ModuleRegistry/Application/DTOs/ModuleDTO.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\DTOs;

use App\Contexts\ModuleRegistry\Domain\Models\Module;

/**
 * ModuleDTO - Read Model
 *
 * Data transfer object for presenting module data
 */
final readonly class ModuleDTO
{
    public function __construct(
        public string $id,
        public string $name,
        public string $displayName,
        public string $version,
        public string $description,
        public string $namespace,
        public string $migrationsPath,
        public bool $requiresSubscription,
        public string $status,
        public array $configuration,
        public array $dependencies,
        public ?string $publishedAt,
        public string $createdAt
    ) {
    }

    /**
     * Create from domain aggregate
     */
    public static function fromAggregate(Module $module): self
    {
        return new self(
            id: $module->id()->toString(),
            name: $module->name()->toString(),
            displayName: $module->displayName(),
            version: $module->version()->toString(),
            description: $module->description(),
            namespace: $module->namespace(),
            migrationsPath: $module->migrationsPath(),
            requiresSubscription: $module->requiresSubscription(),
            status: $module->status()->value,
            configuration: $module->configuration()->toArray(),
            dependencies: array_map(
                fn($dep) => [
                    'module_name' => $dep->moduleName()->toString(),
                    'version_constraint' => $dep->versionConstraint()
                ],
                $module->dependencies()
            ),
            publishedAt: $module->publishedAt()?->format('Y-m-d H:i:s'),
            createdAt: (new \DateTimeImmutable())->format('Y-m-d H:i:s') // From Eloquent
        );
    }

    /**
     * Convert to array (for JSON API responses)
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'display_name' => $this->displayName,
            'version' => $this->version,
            'description' => $this->description,
            'namespace' => $this->namespace,
            'migrations_path' => $this->migrationsPath,
            'requires_subscription' => $this->requiresSubscription,
            'status' => $this->status,
            'configuration' => $this->configuration,
            'dependencies' => $this->dependencies,
            'published_at' => $this->publishedAt,
            'created_at' => $this->createdAt
        ];
    }

    /**
     * JSON serialization
     */
    public function toJson(): string
    {
        return json_encode($this->toArray(), JSON_THROW_ON_ERROR);
    }
}
```

### DTO Testing

```php
public function test_creates_dto_from_aggregate(): void
{
    $module = new Module(
        ModuleId::generate(),
        ModuleName::fromString('finance'),
        'Finance Module',
        ModuleVersion::fromString('1.0.0'),
        'Description',
        'App\\Finance',
        'migrations/finance',
        true,
        new ModuleConfiguration(['key' => 'value'])
    );

    $dto = ModuleDTO::fromAggregate($module);

    $this->assertEquals('finance', $dto->name);
    $this->assertEquals('Finance Module', $dto->displayName);
    $this->assertEquals('1.0.0', $dto->version);
    $this->assertTrue($dto->requiresSubscription);
}

public function test_converts_dto_to_array(): void
{
    $dto = new ModuleDTO(/* ... */);

    $array = $dto->toArray();

    $this->assertArrayHasKey('id', $array);
    $this->assertArrayHasKey('name', $array);
    $this->assertArrayHasKey('display_name', $array);
}
```

---

## Validators

### ModuleRegistrationValidator

**File:** `app/Contexts/ModuleRegistry/Application/Validators/ModuleRegistrationValidator.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\Validators;

use App\Contexts\ModuleRegistry\Application\Commands\RegisterModuleCommand;
use App\Contexts\ModuleRegistry\Application\Exceptions\InvalidCommandException;

/**
 * ModuleRegistrationValidator
 *
 * Application-level validation for module registration
 */
final class ModuleRegistrationValidator
{
    /**
     * Validate registration command
     *
     * @throws InvalidCommandException if validation fails
     */
    public function validate(RegisterModuleCommand $command): void
    {
        $errors = [];

        // Namespace validation
        if (!$this->isValidNamespace($command->namespace)) {
            $errors[] = 'Invalid namespace format';
        }

        // Migrations path validation
        if (!$this->isValidPath($command->migrationsPath)) {
            $errors[] = 'Invalid migrations path';
        }

        // Configuration validation
        if (!$this->isValidConfiguration($command->configuration)) {
            $errors[] = 'Invalid configuration structure';
        }

        if (!empty($errors)) {
            throw InvalidCommandException::withErrors($errors);
        }
    }

    private function isValidNamespace(string $namespace): bool
    {
        return preg_match('/^[A-Z][a-zA-Z0-9]*(\\\\[A-Z][a-zA-Z0-9]*)*$/', $namespace) === 1;
    }

    private function isValidPath(string $path): bool
    {
        return !str_contains($path, '..') && !str_starts_with($path, '/');
    }

    private function isValidConfiguration(array $config): bool
    {
        return json_encode($config) !== false;
    }
}
```

---

## Implementation Steps

### Day 1-2: Core Application Services

1. **Create directory structure**
   ```bash
   mkdir -p app/Contexts/ModuleRegistry/Application/{Services,Commands,DTOs,Validators,Exceptions}
   ```

2. **Implement ModuleRegistrationService (TDD)**
   - Write test: `test_registers_new_module()`
   - Implement service
   - Write test: `test_throws_if_module_exists()`
   - Add validation

3. **Implement commands**
   - `RegisterModuleCommand` with validation
   - Test command validation

4. **Create repository interfaces (ports)**
   ```php
   app/Contexts/ModuleRegistry/Domain/Ports/ModuleRepositoryInterface.php
   ```

### Day 3-4: Installation Services

1. **Implement ModuleInstallationService**
   - Integration with SubscriptionValidator
   - Integration with DependencyResolver
   - Transaction handling

2. **Implement ModuleInstallationJobService**
   - Job lifecycle management
   - Idempotent step recording

3. **Create installation commands**
   - `InstallModuleCommand`
   - `StartJobCommand`
   - `CompleteJobCommand`

### Day 5: DTOs and Validators

1. **Create all DTOs**
   - `ModuleDTO`
   - `TenantModuleDTO`
   - `InstallationJobDTO`

2. **Implement validators**
   - `ModuleRegistrationValidator`
   - `InstallationRequestValidator`

3. **Create application exceptions**

---

## Testing Strategy

### Unit Tests (Application Services)

```php
// Mock repositories
$repository = $this->createMock(ModuleRepositoryInterface::class);

// Mock domain services
$validator = $this->createMock(SubscriptionValidator::class);

// Test service logic
$service = new ModuleInstallationService($repository, $validator, ...);
$result = $service->installForTenant($command);

$this->assertInstanceOf(TenantModuleId::class, $result);
```

### Command Validation Tests

```php
public function test_command_validates_required_fields(): void
{
    $this->expectException(InvalidArgumentException::class);

    new InstallModuleCommand(
        tenantId: '',  // ❌ Empty
        moduleId: 'module-123',
        installedBy: 'admin'
    );
}
```

### DTO Mapping Tests

```php
public function test_dto_maps_all_aggregate_properties(): void
{
    $module = $this->createModule();
    $dto = ModuleDTO::fromAggregate($module);

    $this->assertEquals($module->id()->toString(), $dto->id);
    $this->assertEquals($module->name()->toString(), $dto->name);
    // ... verify all mappings
}
```

---

## Success Criteria

- [ ] All 79+ application tests passing
- [ ] Services orchestrate domain correctly
- [ ] Commands are immutable and validated
- [ ] DTOs serialize correctly
- [ ] No business logic in application layer
- [ ] Repository interfaces defined
- [ ] Event publishing working

---

**End of Phase 2 Guide**

**Next:** Phase 3 - Infrastructure Layer (Repositories, Migrations, Event Publishers)
