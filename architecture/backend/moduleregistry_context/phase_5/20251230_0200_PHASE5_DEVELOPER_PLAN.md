# 🚀 PHASE 5: APPLICATION & INFRASTRUCTURE LAYER
## ModuleRegistry Context - Developer Plan & Architecture

**Created:** 2025-12-30 02:00
**Status:** Ready for Implementation
**Architect:** Senior Backend Developer
**Timeline:** 10-15 working days
**Approach:** TDD + Hexagonal Architecture + DDD

---

## 📊 CURRENT STATUS ASSESSMENT

### ✅ **What We've Completed:**

```
Phase 1: Domain Layer ✅ COMPLETE
├─ 108 tests, 299 assertions
├─ 5 Value Objects
├─ 3 Aggregates (Module, TenantModule, ModuleInstallationJob)
├─ 2 Domain Services (DependencyResolver, SubscriptionValidator)
├─ 7 Domain Exceptions
├─ 5 Domain Events
└─ 100% Pure PHP (zero framework dependencies)

Phase 4 (Partial): Platform API ✅ COMPLETE (Day 22)
├─ ModuleCatalogController (87 lines, thin controller)
├─ 10/10 integration tests passing (65 assertions)
├─ GET /api/v1/platform/modules (list all modules)
├─ GET /api/v1/platform/modules/{id} (show single module)
├─ Sanctum authentication working
├─ Instance Binding pattern for final classes
└─ Hexagonal architecture maintained
```

### 📋 **What's Missing (Critical Gap):**

```
Phase 2: Application Layer ❌ NOT STARTED
├─ No Application Services
├─ No Commands/Handlers (CQRS)
├─ No DTOs for data transfer
├─ No Application-level validators
└─ Controllers directly use Domain (WRONG!)

Phase 3: Infrastructure Layer ❌ NOT STARTED
├─ No Eloquent Repositories
├─ No Database Migrations
├─ No Event Publishers
├─ No Service Provider bindings
└─ No actual persistence layer!

Phase 4 (Remaining): Complete API ⚠️ PARTIALLY DONE
├─ Missing: TenantModuleController
├─ Missing: ModuleInstallationController
├─ Missing: Form Requests (validation)
├─ Missing: API Resources (transformers)
└─ Missing: Integration tests for full workflows
```

---

## 🎯 PHASE 5 OBJECTIVES

**Phase 5 combines Application + Infrastructure layers** because:
1. ✅ Domain is complete and stable
2. ✅ Basic API structure is established
3. ❌ No persistence layer exists (critical!)
4. ❌ No orchestration layer exists (critical!)
5. ✅ We can build both layers in parallel

**Goal:** Build the **missing middle layers** between Domain and API to enable actual module installation workflows.

---

## 🏗️ PHASE 5 ARCHITECTURE OVERVIEW

### **Current Architecture (Incomplete):**

```
┌─────────────────────────────────────┐
│  Presentation Layer (API)           │
│  ✅ ModuleCatalogController         │
│      (directly calling Domain?!)    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ❌ APPLICATION LAYER MISSING!      │
│  No Services, No Commands, No DTOs  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Domain Layer                        │
│  ✅ Module, TenantModule, Job       │
│  ✅ DependencyResolver              │
│  ✅ SubscriptionValidator           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ❌ INFRASTRUCTURE LAYER MISSING!   │
│  No Repositories, No Persistence!   │
└─────────────────────────────────────┘
```

### **Target Architecture (Phase 5 Complete):**

```
┌─────────────────────────────────────────────────┐
│  PRESENTATION LAYER (API Controllers)           │
│  ✅ ModuleCatalogController                     │
│  🆕 TenantModuleController                      │
│  🆕 ModuleInstallationController                │
│  🆕 Form Requests (validation)                  │
│  🆕 API Resources (JSON transformation)         │
└──────────────┬──────────────────────────────────┘
               │ uses
               ▼
┌─────────────────────────────────────────────────┐
│  APPLICATION LAYER (Orchestration)              │
│  🆕 ModuleInstallationService                   │
│  🆕 ModuleRegistrationService                   │
│  🆕 Commands (InstallModuleCommand, etc.)       │
│  🆕 Query Services (GetAllModulesQuery, etc.)   │
│  🆕 DTOs (ModuleDTO, TenantModuleDTO)           │
│  🆕 Application Validators                      │
└──────────────┬──────────────────────────────────┘
               │ uses
               ▼
┌─────────────────────────────────────────────────┐
│  DOMAIN LAYER (Business Logic)                  │
│  ✅ Module, TenantModule, Job (Aggregates)      │
│  ✅ DependencyResolver (Domain Service)         │
│  ✅ SubscriptionValidator (Domain Service)      │
│  ✅ Domain Events                               │
│  ✅ Repository Interfaces (Ports)               │
└──────────────┬──────────────────────────────────┘
               │ implemented by
               ▼
┌─────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER (Adapters)                │
│  🆕 EloquentModuleRepository                    │
│  🆕 EloquentTenantModuleRepository              │
│  🆕 EloquentInstallationJobRepository           │
│  🆕 Database Migrations (5 tables)              │
│  🆕 Eloquent Models                             │
│  🆕 LaravelEventPublisher                       │
│  🆕 ModuleRegistryServiceProvider               │
└─────────────────────────────────────────────────┘
```

---

## 📅 PHASE 5 IMPLEMENTATION PLAN

### **Week 1: Application Layer (Days 1-5)**

---

#### **DAY 1: Query Services & DTOs (6-8 hours)**

**Goal:** Build the **read side** of CQRS pattern

##### **1.1 Create Query Services**

```php
// app/Contexts/ModuleRegistry/Application/Queries/GetAllModulesQuery.php

final readonly class GetAllModulesQuery
{
    public function __construct(
        private ModuleRepositoryInterface $repository
    ) {}

    public function execute(
        int $page = 1,
        int $perPage = 15,
        string $status = 'published',
        ?string $search = null
    ): ModuleCollectionResponseDTO {
        // Query repository
        $result = $this->repository->findAllPaginated(
            page: $page,
            perPage: $perPage,
            filters: ['status' => $status, 'search' => $search]
        );

        // Transform to DTOs
        $modules = array_map(
            fn($module) => ModuleResponseDTO::fromAggregate($module),
            $result->items
        );

        return new ModuleCollectionResponseDTO(
            modules: $modules,
            currentPage: $result->currentPage,
            perPage: $result->perPage,
            total: $result->total,
            lastPage: $result->lastPage
        );
    }
}
```

**Other Query Classes:**
- `GetModuleByIdQuery.php`
- `GetTenantModulesQuery.php`
- `GetInstallationJobQuery.php`

##### **1.2 Create Response DTOs**

```php
// app/Contexts/ModuleRegistry/Application/DTOs/Responses/ModuleResponseDTO.php

final readonly class ModuleResponseDTO
{
    public function __construct(
        public string $id,
        public string $name,
        public string $displayName,
        public string $version,
        public string $description,
        public string $status,
        public bool $requiresSubscription,
        public ?string $publishedAt
    ) {}

    public static function fromAggregate(Module $module): self
    {
        return new self(
            id: $module->id()->toString(),
            name: $module->name()->toString(),
            displayName: $module->displayName(),
            version: $module->version()->toString(),
            description: $module->description(),
            status: $module->status()->value,
            requiresSubscription: $module->requiresSubscription(),
            publishedAt: $module->publishedAt()?->format('c')
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'display_name' => $this->displayName,
            'version' => $this->version,
            'description' => $this->description,
            'status' => $this->status,
            'requires_subscription' => $this->requiresSubscription,
            'published_at' => $this->publishedAt,
        ];
    }
}
```

**Other DTOs:**
- `ModuleCollectionResponseDTO.php`
- `TenantModuleResponseDTO.php`
- `InstallationJobResponseDTO.php`

##### **1.3 Tests (20 tests)**

```php
// tests/Unit/Contexts/ModuleRegistry/Application/Queries/GetAllModulesQueryTest.php

final class GetAllModulesQueryTest extends TestCase
{
    private MockObject $repository;
    private GetAllModulesQuery $query;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = $this->createMock(ModuleRepositoryInterface::class);
        $this->query = new GetAllModulesQuery($this->repository);
    }

    /** @test */
    public function it_transforms_modules_to_dto_collection(): void
    {
        // Arrange
        $module = $this->createTestModule();

        $this->repository->method('findAllPaginated')
            ->willReturn((object) [
                'items' => [$module],
                'currentPage' => 1,
                'perPage' => 15,
                'total' => 1,
                'lastPage' => 1,
            ]);

        // Act
        $result = $this->query->execute();

        // Assert
        $this->assertInstanceOf(ModuleCollectionResponseDTO::class, $result);
        $this->assertCount(1, $result->modules);
        $this->assertEquals(1, $result->total);
    }
}
```

**Deliverables:**
- 4 Query classes
- 4 DTO classes
- 20 unit tests

---

#### **DAY 2: Command Classes & Handlers (6-8 hours)**

**Goal:** Build the **write side** of CQRS pattern

##### **2.1 Create Commands**

```php
// app/Contexts/ModuleRegistry/Application/Commands/InstallModuleCommand.php

final readonly class InstallModuleCommand
{
    public function __construct(
        public string $moduleId,
        public string $tenantId,
        public string $installedBy,
        public ?array $configuration = null
    ) {
        $this->validate();
    }

    private function validate(): void
    {
        if (empty($this->moduleId) || !$this->isValidUuid($this->moduleId)) {
            throw new InvalidCommandException('Invalid module ID');
        }

        if (empty($this->tenantId)) {
            throw new InvalidCommandException('Tenant ID is required');
        }

        if (empty($this->installedBy)) {
            throw new InvalidCommandException('Installed by user ID is required');
        }
    }

    private function isValidUuid(string $uuid): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid) === 1;
    }
}
```

**Other Commands:**
- `UninstallModuleCommand.php`
- `RegisterModuleCommand.php`
- `PublishModuleCommand.php`
- `DeprecateModuleCommand.php`

##### **2.2 Tests (15 tests)**

```php
// tests/Unit/Contexts/ModuleRegistry/Application/Commands/InstallModuleCommandTest.php

final class InstallModuleCommandTest extends TestCase
{
    /** @test */
    public function it_creates_command_with_valid_data(): void
    {
        // Act
        $command = new InstallModuleCommand(
            moduleId: '550e8400-e29b-41d4-a716-446655440000',
            tenantId: 'nrna',
            installedBy: 'user-123'
        );

        // Assert
        $this->assertInstanceOf(InstallModuleCommand::class, $command);
        $this->assertEquals('550e8400-e29b-41d4-a716-446655440000', $command->moduleId);
    }

    /** @test */
    public function it_throws_exception_for_invalid_module_id(): void
    {
        // Assert
        $this->expectException(InvalidCommandException::class);
        $this->expectExceptionMessage('Invalid module ID');

        // Act
        new InstallModuleCommand(
            moduleId: 'invalid-uuid',
            tenantId: 'nrna',
            installedBy: 'user-123'
        );
    }
}
```

**Deliverables:**
- 5 Command classes
- 15 validation tests

---

#### **DAY 3: Application Services (Orchestration) (8-10 hours)**

**Goal:** Build the **orchestration layer** that coordinates domain logic

##### **3.1 ModuleInstallationService**

```php
// app/Contexts/ModuleRegistry/Application/Services/ModuleInstallationService.php

final class ModuleInstallationService
{
    public function __construct(
        private ModuleRepositoryInterface $moduleRepository,
        private TenantModuleRepositoryInterface $tenantModuleRepository,
        private InstallationJobRepositoryInterface $jobRepository,
        private DependencyResolver $dependencyResolver,
        private SubscriptionValidator $subscriptionValidator,
        private EventPublisherInterface $eventPublisher
    ) {}

    public function installModule(InstallModuleCommand $command): TenantModuleId
    {
        // 1. Validate module exists
        $module = $this->moduleRepository->findById(
            ModuleId::fromString($command->moduleId)
        );

        if (!$module) {
            throw new ModuleNotFoundException(
                "Module not found: {$command->moduleId}"
            );
        }

        // 2. Validate subscription
        $tenantId = TenantId::fromString($command->tenantId);

        if ($module->requiresSubscription()) {
            $this->subscriptionValidator->validate($tenantId, $module);
        }

        // 3. Check dependencies
        $dependencies = $this->dependencyResolver->resolve($module);

        foreach ($dependencies as $dependency) {
            $this->ensureDependencyInstalled($tenantId, $dependency);
        }

        // 4. Check if already installed
        $existing = $this->tenantModuleRepository->findByTenantAndModule(
            $tenantId,
            $module->id()
        );

        if ($existing && $existing->isInstalled()) {
            throw new ModuleAlreadyInstalledException(
                "Module already installed for tenant {$command->tenantId}"
            );
        }

        // 5. Create TenantModule aggregate
        $tenantModule = TenantModule::create(
            tenantId: $tenantId,
            moduleId: $module->id(),
            version: $module->version(),
            installedBy: $command->installedBy,
            configuration: $command->configuration ?
                ModuleConfiguration::fromArray($command->configuration) :
                null
        );

        // 6. Create installation job
        $job = ModuleInstallationJob::create(
            tenantId: $tenantId,
            moduleId: $module->id(),
            startedBy: $command->installedBy,
            jobType: JobType::INSTALLATION
        );

        // 7. Persist
        $this->tenantModuleRepository->save($tenantModule);
        $this->jobRepository->save($job);

        // 8. Publish event
        $this->eventPublisher->publish(
            new ModuleInstallationStarted(
                tenantModuleId: $tenantModule->id(),
                moduleId: $module->id(),
                tenantId: $tenantId,
                occurredAt: new \DateTimeImmutable()
            )
        );

        return $tenantModule->id();
    }

    private function ensureDependencyInstalled(
        TenantId $tenantId,
        Module $dependency
    ): void {
        $installed = $this->tenantModuleRepository->findByTenantAndModule(
            $tenantId,
            $dependency->id()
        );

        if (!$installed || !$installed->isInstalled()) {
            throw new DependencyNotMetException(
                "Dependency not met: {$dependency->name()->toString()} must be installed first"
            );
        }
    }
}
```

##### **3.2 ModuleRegistrationService**

```php
// app/Contexts/ModuleRegistry/Application/Services/ModuleRegistrationService.php

final class ModuleRegistrationService
{
    public function __construct(
        private ModuleRepositoryInterface $moduleRepository,
        private EventPublisherInterface $eventPublisher
    ) {}

    public function registerModule(RegisterModuleCommand $command): ModuleId
    {
        // 1. Check if module already exists
        $existing = $this->moduleRepository->findByName(
            ModuleName::fromString($command->name)
        );

        if ($existing) {
            throw new ModuleAlreadyExistsException(
                "Module with name '{$command->name}' already exists"
            );
        }

        // 2. Create Module aggregate
        $module = Module::create(
            name: ModuleName::fromString($command->name),
            displayName: $command->displayName,
            version: ModuleVersion::fromString($command->version),
            description: $command->description,
            namespace: $command->namespace,
            migrationsPath: $command->migrationsPath,
            requiresSubscription: $command->requiresSubscription,
            configuration: $command->configuration ?
                ModuleConfiguration::fromArray($command->configuration) :
                null
        );

        // 3. Add dependencies
        foreach ($command->dependencies as $depName => $constraint) {
            $module->addDependency(
                ModuleName::fromString($depName),
                $constraint
            );
        }

        // 4. Persist
        $this->moduleRepository->save($module);

        // 5. Publish event
        $this->eventPublisher->publish(
            new ModuleRegistered(
                moduleId: $module->id(),
                moduleName: $module->name(),
                version: $module->version(),
                occurredAt: new \DateTimeImmutable()
            )
        );

        return $module->id();
    }

    public function publishModule(PublishModuleCommand $command): void
    {
        $module = $this->moduleRepository->findById(
            ModuleId::fromString($command->moduleId)
        );

        if (!$module) {
            throw new ModuleNotFoundException(
                "Module not found: {$command->moduleId}"
            );
        }

        $module->publish();

        $this->moduleRepository->save($module);

        $this->eventPublisher->publish(
            new ModulePublished(
                moduleId: $module->id(),
                moduleName: $module->name(),
                occurredAt: new \DateTimeImmutable()
            )
        );
    }
}
```

##### **3.3 Tests (25 tests)**

```php
// tests/Unit/Contexts/ModuleRegistry/Application/Services/ModuleInstallationServiceTest.php

final class ModuleInstallationServiceTest extends TestCase
{
    private MockObject $moduleRepository;
    private MockObject $tenantModuleRepository;
    private MockObject $jobRepository;
    private MockObject $dependencyResolver;
    private MockObject $subscriptionValidator;
    private MockObject $eventPublisher;
    private ModuleInstallationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->moduleRepository = $this->createMock(ModuleRepositoryInterface::class);
        $this->tenantModuleRepository = $this->createMock(TenantModuleRepositoryInterface::class);
        $this->jobRepository = $this->createMock(InstallationJobRepositoryInterface::class);
        $this->dependencyResolver = $this->createMock(DependencyResolver::class);
        $this->subscriptionValidator = $this->createMock(SubscriptionValidator::class);
        $this->eventPublisher = $this->createMock(EventPublisherInterface::class);

        $this->service = new ModuleInstallationService(
            $this->moduleRepository,
            $this->tenantModuleRepository,
            $this->jobRepository,
            $this->dependencyResolver,
            $this->subscriptionValidator,
            $this->eventPublisher
        );
    }

    /** @test */
    public function it_installs_module_successfully(): void
    {
        // Arrange
        $module = $this->createTestModule();
        $command = new InstallModuleCommand(
            moduleId: $module->id()->toString(),
            tenantId: 'nrna',
            installedBy: 'user-123'
        );

        $this->moduleRepository->method('findById')->willReturn($module);
        $this->dependencyResolver->method('resolve')->willReturn([]);
        $this->tenantModuleRepository->method('findByTenantAndModule')->willReturn(null);

        $this->tenantModuleRepository->expects($this->once())->method('save');
        $this->jobRepository->expects($this->once())->method('save');
        $this->eventPublisher->expects($this->once())->method('publish');

        // Act
        $tenantModuleId = $this->service->installModule($command);

        // Assert
        $this->assertInstanceOf(TenantModuleId::class, $tenantModuleId);
    }

    /** @test */
    public function it_throws_exception_when_module_not_found(): void
    {
        // Arrange
        $command = new InstallModuleCommand(
            moduleId: '550e8400-e29b-41d4-a716-446655440000',
            tenantId: 'nrna',
            installedBy: 'user-123'
        );

        $this->moduleRepository->method('findById')->willReturn(null);

        // Assert
        $this->expectException(ModuleNotFoundException::class);

        // Act
        $this->service->installModule($command);
    }

    /** @test */
    public function it_validates_subscription_when_required(): void
    {
        // Arrange
        $module = $this->createTestModule(['requiresSubscription' => true]);
        $command = new InstallModuleCommand(
            moduleId: $module->id()->toString(),
            tenantId: 'nrna',
            installedBy: 'user-123'
        );

        $this->moduleRepository->method('findById')->willReturn($module);
        $this->subscriptionValidator->expects($this->once())->method('validate');
        $this->dependencyResolver->method('resolve')->willReturn([]);
        $this->tenantModuleRepository->method('findByTenantAndModule')->willReturn(null);

        // Act
        $this->service->installModule($command);

        // Assert: Validator was called (verified by expects above)
    }

    /** @test */
    public function it_checks_dependencies_before_installation(): void
    {
        // Arrange
        $module = $this->createTestModule();
        $dependency = $this->createTestModule(['name' => 'dependency-module']);

        $command = new InstallModuleCommand(
            moduleId: $module->id()->toString(),
            tenantId: 'nrna',
            installedBy: 'user-123'
        );

        $this->moduleRepository->method('findById')->willReturn($module);
        $this->dependencyResolver->method('resolve')->willReturn([$dependency]);

        // Dependency not installed
        $this->tenantModuleRepository->method('findByTenantAndModule')
            ->willReturnOnConsecutiveCalls(null, null);

        // Assert
        $this->expectException(DependencyNotMetException::class);

        // Act
        $this->service->installModule($command);
    }

    /** @test */
    public function it_prevents_duplicate_installation(): void
    {
        // Arrange
        $module = $this->createTestModule();
        $existingTenantModule = $this->createTestTenantModule(['status' => 'installed']);

        $command = new InstallModuleCommand(
            moduleId: $module->id()->toString(),
            tenantId: 'nrna',
            installedBy: 'user-123'
        );

        $this->moduleRepository->method('findById')->willReturn($module);
        $this->dependencyResolver->method('resolve')->willReturn([]);
        $this->tenantModuleRepository->method('findByTenantAndModule')
            ->willReturn($existingTenantModule);

        // Assert
        $this->expectException(ModuleAlreadyInstalledException::class);

        // Act
        $this->service->installModule($command);
    }
}
```

**Deliverables:**
- 2 Application Services (Installation, Registration)
- 25 comprehensive tests

---

#### **DAY 4: Application-Level Validators (4-6 hours)**

**Goal:** Add application-level validation logic

##### **4.1 Create Validators**

```php
// app/Contexts/ModuleRegistry/Application/Validators/InstallationRequestValidator.php

final class InstallationRequestValidator
{
    public function __construct(
        private ModuleRepositoryInterface $moduleRepository,
        private TenantModuleRepositoryInterface $tenantModuleRepository
    ) {}

    public function validate(InstallModuleCommand $command): ValidationResult
    {
        $errors = [];

        // Check module exists
        $module = $this->moduleRepository->findById(
            ModuleId::fromString($command->moduleId)
        );

        if (!$module) {
            $errors[] = "Module not found: {$command->moduleId}";
        }

        // Check module is published
        if ($module && $module->status() !== ModuleStatus::PUBLISHED) {
            $errors[] = "Module is not published (status: {$module->status()->value})";
        }

        // Check not already installed
        if ($module) {
            $existing = $this->tenantModuleRepository->findByTenantAndModule(
                TenantId::fromString($command->tenantId),
                $module->id()
            );

            if ($existing && $existing->isInstalled()) {
                $errors[] = "Module is already installed for this tenant";
            }
        }

        return new ValidationResult(
            isValid: count($errors) === 0,
            errors: $errors
        );
    }
}
```

##### **4.2 Tests (10 tests)**

**Deliverables:**
- 2 Validator classes
- 10 validation tests

---

#### **DAY 5: Application-Level Exceptions (2-4 hours)**

**Goal:** Create application-specific exceptions

```php
// app/Contexts/ModuleRegistry/Application/Exceptions/ModuleAlreadyExistsException.php
// app/Contexts/ModuleRegistry/Application/Exceptions/ModuleNotFoundException.php
// app/Contexts/ModuleRegistry/Application/Exceptions/TenantModuleNotFoundException.php
// app/Contexts/ModuleRegistry/Application/Exceptions/InstallationJobNotFoundException.php
// app/Contexts/ModuleRegistry/Application/Exceptions/InvalidCommandException.php
// app/Contexts/ModuleRegistry/Application/Exceptions/ModuleAlreadyInstalledException.php
// app/Contexts/ModuleRegistry/Application/Exceptions/DependencyNotMetException.php
```

**Deliverables:**
- 7 Exception classes
- 7 exception tests

---

### **Week 2: Infrastructure Layer (Days 6-10)**

---

#### **DAY 6-7: Eloquent Repositories (12-16 hours)**

**Goal:** Implement persistence layer with Eloquent ORM

##### **7.1 ModuleRepository Implementation**

```php
// app/Contexts/ModuleRegistry/Infrastructure/Persistence/EloquentModuleRepository.php

final class EloquentModuleRepository implements ModuleRepositoryInterface
{
    public function save(Module $module): void
    {
        $model = ModuleModel::find($module->id()->toString());

        if (!$model) {
            $model = new ModuleModel();
            $model->id = $module->id()->toString();
        }

        $model->name = $module->name()->toString();
        $model->display_name = $module->displayName();
        $model->version = $module->version()->toString();
        $model->description = $module->description();
        $model->namespace = $module->namespace();
        $model->migrations_path = $module->migrationsPath();
        $model->requires_subscription = $module->requiresSubscription();
        $model->configuration = $module->configuration()?->toJson();
        $model->status = $module->status()->value;
        $model->published_at = $module->publishedAt();

        $model->save();

        // Save dependencies
        $this->saveDependencies($module);
    }

    public function findById(ModuleId $id): ?Module
    {
        $model = ModuleModel::with('dependencies')->find($id->toString());

        if (!$model) {
            return null;
        }

        return $this->toDomain($model);
    }

    public function findByName(ModuleName $name): ?Module
    {
        $model = ModuleModel::with('dependencies')
            ->where('name', $name->toString())
            ->first();

        if (!$model) {
            return null;
        }

        return $this->toDomain($model);
    }

    public function findAllPaginated(
        int $page,
        int $perPage,
        array $filters = []
    ): object {
        $query = ModuleModel::query()->with('dependencies');

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('display_name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return (object) [
            'items' => $paginator->items()->map(fn($model) => $this->toDomain($model))->all(),
            'currentPage' => $paginator->currentPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
            'lastPage' => $paginator->lastPage(),
        ];
    }

    private function toDomain(ModuleModel $model): Module
    {
        $module = Module::reconstitute(
            id: ModuleId::fromString($model->id),
            name: ModuleName::fromString($model->name),
            displayName: $model->display_name,
            version: ModuleVersion::fromString($model->version),
            description: $model->description,
            namespace: $model->namespace,
            migrationsPath: $model->migrations_path,
            requiresSubscription: $model->requires_subscription,
            configuration: $model->configuration ?
                ModuleConfiguration::fromJson($model->configuration) :
                null,
            status: ModuleStatus::from($model->status),
            publishedAt: $model->published_at ?
                new \DateTimeImmutable($model->published_at) :
                null
        );

        // Reconstruct dependencies
        foreach ($model->dependencies as $dep) {
            $module->addDependency(
                ModuleName::fromString($dep->dependency_name),
                $dep->version_constraint
            );
        }

        return $module;
    }

    private function saveDependencies(Module $module): void
    {
        // Delete existing dependencies
        ModuleDependencyModel::where('module_id', $module->id()->toString())->delete();

        // Save new dependencies
        foreach ($module->dependencies() as $dependency) {
            ModuleDependencyModel::create([
                'module_id' => $module->id()->toString(),
                'dependency_name' => $dependency->name()->toString(),
                'version_constraint' => $dependency->versionConstraint(),
            ]);
        }
    }
}
```

##### **7.2 Tests (30 integration tests)**

```php
// tests/Integration/Contexts/ModuleRegistry/Infrastructure/EloquentModuleRepositoryTest.php

final class EloquentModuleRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private EloquentModuleRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();

        // Run migrations
        $this->artisan('migrate', [
            '--path' => 'app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations',
            '--realpath' => true,
        ]);

        $this->repository = new EloquentModuleRepository();
    }

    /** @test */
    public function it_saves_module_to_database(): void
    {
        // Arrange
        $module = Module::create(
            name: ModuleName::fromString('digital_card'),
            displayName: 'Digital Cards',
            version: ModuleVersion::fromString('1.0.0'),
            description: 'Digital business cards',
            namespace: 'App\\Modules\\DigitalCard',
            migrationsPath: 'database/migrations/digital_card',
            requiresSubscription: true
        );

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertDatabaseHas('modules', [
            'id' => $module->id()->toString(),
            'name' => 'digital_card',
            'display_name' => 'Digital Cards',
            'version' => '1.0.0',
        ]);
    }

    /** @test */
    public function it_finds_module_by_id(): void
    {
        // Arrange
        $module = $this->createAndSaveTestModule();

        // Act
        $found = $this->repository->findById($module->id());

        // Assert
        $this->assertInstanceOf(Module::class, $found);
        $this->assertTrue($module->id()->equals($found->id()));
        $this->assertEquals($module->name()->toString(), $found->name()->toString());
    }

    /** @test */
    public function it_returns_null_when_module_not_found(): void
    {
        // Arrange
        $nonExistentId = ModuleId::generate();

        // Act
        $found = $this->repository->findById($nonExistentId);

        // Assert
        $this->assertNull($found);
    }

    /** @test */
    public function it_saves_and_retrieves_module_dependencies(): void
    {
        // Arrange
        $module = Module::create(
            name: ModuleName::fromString('finance'),
            displayName: 'Finance Module',
            version: ModuleVersion::fromString('1.0.0'),
            description: 'Financial management',
            namespace: 'App\\Modules\\Finance',
            migrationsPath: 'database/migrations/finance',
            requiresSubscription: true
        );

        $module->addDependency(
            ModuleName::fromString('digital_card'),
            '^1.0'
        );

        // Act
        $this->repository->save($module);
        $found = $this->repository->findById($module->id());

        // Assert
        $this->assertCount(1, $found->dependencies());
        $this->assertEquals('digital_card', $found->dependencies()[0]->name()->toString());
        $this->assertEquals('^1.0', $found->dependencies()[0]->versionConstraint());
    }

    /** @test */
    public function it_paginates_modules_correctly(): void
    {
        // Arrange: Create 25 modules
        for ($i = 1; $i <= 25; $i++) {
            $module = Module::create(
                name: ModuleName::fromString("module_{$i}"),
                displayName: "Module {$i}",
                version: ModuleVersion::fromString('1.0.0'),
                description: "Test module {$i}",
                namespace: "App\\Modules\\Module{$i}",
                migrationsPath: "database/migrations/module_{$i}",
                requiresSubscription: false
            );

            $this->repository->save($module);
        }

        // Act: Get page 2 with 10 items per page
        $result = $this->repository->findAllPaginated(
            page: 2,
            perPage: 10
        );

        // Assert
        $this->assertCount(10, $result->items);
        $this->assertEquals(2, $result->currentPage);
        $this->assertEquals(10, $result->perPage);
        $this->assertEquals(25, $result->total);
        $this->assertEquals(3, $result->lastPage);
    }

    /** @test */
    public function it_filters_modules_by_status(): void
    {
        // Arrange
        $published = $this->createTestModule(['status' => ModuleStatus::PUBLISHED]);
        $draft = $this->createTestModule(['name' => 'draft-module', 'status' => ModuleStatus::DRAFT]);

        $this->repository->save($published);
        $this->repository->save($draft);

        // Act
        $result = $this->repository->findAllPaginated(
            page: 1,
            perPage: 10,
            filters: ['status' => 'published']
        );

        // Assert
        $this->assertCount(1, $result->items);
        $this->assertEquals('published', $result->items[0]->status()->value);
    }

    /** @test */
    public function it_searches_modules_by_name_and_description(): void
    {
        // Arrange
        $card = $this->createTestModule([
            'name' => 'digital_card',
            'displayName' => 'Digital Cards',
            'description' => 'Business card management'
        ]);

        $finance = $this->createTestModule([
            'name' => 'finance',
            'displayName' => 'Finance Module',
            'description' => 'Financial operations'
        ]);

        $this->repository->save($card);
        $this->repository->save($finance);

        // Act
        $result = $this->repository->findAllPaginated(
            page: 1,
            perPage: 10,
            filters: ['search' => 'card']
        );

        // Assert
        $this->assertCount(1, $result->items);
        $this->assertEquals('digital_card', $result->items[0]->name()->toString());
    }

    /** @test */
    public function it_updates_existing_module(): void
    {
        // Arrange
        $module = $this->createAndSaveTestModule();
        $originalId = $module->id();

        // Act: Update module
        $module->publish();
        $this->repository->save($module);

        // Assert
        $found = $this->repository->findById($originalId);
        $this->assertEquals('published', $found->status()->value);
        $this->assertNotNull($found->publishedAt());
    }

    private function createAndSaveTestModule(array $overrides = []): Module
    {
        $module = $this->createTestModule($overrides);
        $this->repository->save($module);
        return $module;
    }

    private function createTestModule(array $overrides = []): Module
    {
        return Module::create(
            name: ModuleName::fromString($overrides['name'] ?? 'test_module'),
            displayName: $overrides['displayName'] ?? 'Test Module',
            version: ModuleVersion::fromString($overrides['version'] ?? '1.0.0'),
            description: $overrides['description'] ?? 'Test description',
            namespace: $overrides['namespace'] ?? 'App\\Modules\\TestModule',
            migrationsPath: $overrides['migrationsPath'] ?? 'database/migrations/test',
            requiresSubscription: $overrides['requiresSubscription'] ?? false,
            status: $overrides['status'] ?? ModuleStatus::DRAFT
        );
    }
}
```

**Deliverables:**
- 3 Repository implementations (Module, TenantModule, InstallationJob)
- 30 integration tests

---

#### **DAY 8: Database Migrations (6-8 hours)**

**Goal:** Create database schema for ModuleRegistry

##### **8.1 Create Migrations**

```php
// app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations/2025_12_30_000001_create_modules_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100)->unique();
            $table->string('display_name', 255);
            $table->string('version', 50);
            $table->text('description')->nullable();
            $table->string('namespace', 255);
            $table->string('migrations_path', 255);
            $table->boolean('requires_subscription')->default(false);
            $table->json('configuration')->nullable();
            $table->enum('status', ['draft', 'published', 'deprecated'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index('name');
            $table->index('status');
            $table->index('requires_subscription');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modules');
    }
};
```

**Other Migrations:**
- `2025_12_30_000002_create_module_dependencies_table.php`
- `2025_12_30_000003_create_tenant_modules_table.php`
- `2025_12_30_000004_create_installation_jobs_table.php`
- `2025_12_30_000005_create_installation_steps_table.php`

##### **8.2 Tests (10 migration tests)**

```php
// tests/Integration/Contexts/ModuleRegistry/Infrastructure/MigrationTest.php

final class MigrationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function modules_table_has_correct_schema(): void
    {
        // Assert: Table exists
        $this->assertTrue(Schema::hasTable('modules'));

        // Assert: Columns exist
        $this->assertTrue(Schema::hasColumn('modules', 'id'));
        $this->assertTrue(Schema::hasColumn('modules', 'name'));
        $this->assertTrue(Schema::hasColumn('modules', 'display_name'));
        $this->assertTrue(Schema::hasColumn('modules', 'version'));
        $this->assertTrue(Schema::hasColumn('modules', 'status'));
        $this->assertTrue(Schema::hasColumn('modules', 'requires_subscription'));
        $this->assertTrue(Schema::hasColumn('modules', 'configuration'));

        // Assert: Indexes exist
        $indexes = $this->getTableIndexes('modules');
        $this->assertArrayHasKey('modules_name_index', $indexes);
        $this->assertArrayHasKey('modules_status_index', $indexes);
    }

    private function getTableIndexes(string $table): array
    {
        $connection = Schema::connection()->getConnection();
        $database = $connection->getDatabaseName();

        $indexes = $connection->select(
            "SELECT DISTINCT index_name
             FROM information_schema.statistics
             WHERE table_schema = ?
             AND table_name = ?",
            [$database, $table]
        );

        $result = [];
        foreach ($indexes as $index) {
            $result[$index->index_name] = true;
        }
        return $result;
    }
}
```

**Deliverables:**
- 5 Migration files
- 10 schema validation tests

---

#### **DAY 9: Event Publishers & Service Provider (6-8 hours)**

##### **9.1 LaravelEventPublisher**

```php
// app/Contexts/ModuleRegistry/Infrastructure/Events/LaravelEventPublisher.php

final class LaravelEventPublisher implements EventPublisherInterface
{
    public function publish(DomainEvent $event): void
    {
        Event::dispatch($this->toLaravelEvent($event));
    }

    public function publishBatch(array $events): void
    {
        foreach ($events as $event) {
            $this->publish($event);
        }
    }

    private function toLaravelEvent(DomainEvent $event): object
    {
        return match ($event::class) {
            ModuleRegistered::class => new \App\Events\ModuleRegistered(
                moduleId: $event->moduleId()->toString(),
                moduleName: $event->moduleName()->toString(),
                version: $event->version()->toString(),
                occurredAt: $event->occurredAt()
            ),
            ModuleInstallationStarted::class => new \App\Events\ModuleInstallationStarted(
                tenantModuleId: $event->tenantModuleId()->toString(),
                moduleId: $event->moduleId()->toString(),
                tenantId: $event->tenantId()->toString(),
                occurredAt: $event->occurredAt()
            ),
            // ... other events
            default => throw new \RuntimeException("Unknown domain event: " . $event::class)
        };
    }
}
```

##### **9.2 ModuleRegistryServiceProvider**

```php
// app/Contexts/ModuleRegistry/Infrastructure/Providers/ModuleRegistryServiceProvider.php

final class ModuleRegistryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Domain Services (Singletons)
        $this->app->singleton(DependencyResolver::class);
        $this->app->singleton(SubscriptionValidator::class, function ($app) {
            return new SubscriptionValidator(
                $app->make(SubscriptionServiceInterface::class)
            );
        });

        // Application Services
        $this->app->singleton(ModuleInstallationService::class);
        $this->app->singleton(ModuleRegistrationService::class);

        // Query Services
        $this->app->bind(GetAllModulesQuery::class);
        $this->app->bind(GetModuleByIdQuery::class);
        $this->app->bind(GetTenantModulesQuery::class);
        $this->app->bind(GetInstallationJobQuery::class);

        // Repositories (bind interfaces to implementations)
        $this->app->bind(
            ModuleRepositoryInterface::class,
            EloquentModuleRepository::class
        );

        $this->app->bind(
            TenantModuleRepositoryInterface::class,
            EloquentTenantModuleRepository::class
        );

        $this->app->bind(
            InstallationJobRepositoryInterface::class,
            EloquentInstallationJobRepository::class
        );

        // Ports (external services)
        $this->app->bind(
            EventPublisherInterface::class,
            LaravelEventPublisher::class
        );

        $this->app->bind(
            SubscriptionServiceInterface::class,
            LaravelSubscriptionService::class
        );
    }

    public function boot(): void
    {
        // Load migrations
        $this->loadMigrationsFrom(
            base_path('app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations')
        );

        // Load routes
        if ($this->app->routesAreCached() === false) {
            $this->loadRoutesFrom(
                base_path('app/Contexts/ModuleRegistry/Infrastructure/Routes/api.php')
            );
        }

        // Register event listeners
        Event::listen(
            ModuleInstallationStarted::class,
            ModuleInstallationStartedListener::class
        );
    }
}
```

**Deliverables:**
- 1 Event Publisher
- 1 Service Provider
- 10 tests (bindings, event publishing)

---

#### **DAY 10: Eloquent Models (4-6 hours)**

```php
// app/Contexts/ModuleRegistry/Infrastructure/Models/ModuleModel.php

final class ModuleModel extends Model
{
    use SoftDeletes;

    protected $table = 'modules';

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'display_name',
        'version',
        'description',
        'namespace',
        'migrations_path',
        'requires_subscription',
        'configuration',
        'status',
        'published_at',
    ];

    protected $casts = [
        'requires_subscription' => 'boolean',
        'configuration' => 'array',
        'published_at' => 'datetime',
    ];

    public function dependencies()
    {
        return $this->hasMany(ModuleDependencyModel::class, 'module_id');
    }

    public function tenantInstallations()
    {
        return $this->hasMany(TenantModuleModel::class, 'module_id');
    }
}
```

**Other Models:**
- `ModuleDependencyModel.php`
- `TenantModuleModel.php`
- `InstallationJobModel.php`
- `InstallationStepModel.php`

**Deliverables:**
- 5 Eloquent Models
- No tests (tested via repositories)

---

### **Week 3: Complete API Layer & Integration (Days 11-15)**

---

#### **DAY 11: TenantModuleController (6-8 hours)**

```php
// app/Contexts/ModuleRegistry/Presentation/Http/Controllers/Desktop/TenantModuleController.php

final class TenantModuleController
{
    public function __construct(
        private ModuleInstallationService $installationService,
        private GetTenantModulesQuery $getTenantModulesQuery
    ) {}

    public function index(string $tenant): JsonResponse
    {
        $tenantId = TenantId::fromString($tenant);

        $result = $this->getTenantModulesQuery->execute($tenantId);

        return response()->json($result->toArray());
    }

    public function store(string $tenant, InstallModuleRequest $request): JsonResponse
    {
        try {
            $command = new InstallModuleCommand(
                moduleId: $request->validated('module_id'),
                tenantId: $tenant,
                installedBy: Auth::id(),
                configuration: $request->validated('configuration')
            );

            $tenantModuleId = $this->installationService->installModule($command);

            return response()->json([
                'message' => 'Module installation started',
                'tenant_module_id' => $tenantModuleId->toString(),
            ], 202); // Accepted
        } catch (ModuleNotFoundException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        } catch (ModuleAlreadyInstalledException $e) {
            return response()->json(['message' => $e->getMessage()], 409); // Conflict
        } catch (DependencyNotMetException $e) {
            return response()->json(['message' => $e->getMessage()], 422); // Unprocessable
        }
    }

    public function destroy(string $tenant, string $moduleId): JsonResponse
    {
        try {
            $command = new UninstallModuleCommand(
                moduleId: $moduleId,
                tenantId: $tenant,
                uninstalledBy: Auth::id()
            );

            $this->installationService->uninstallModule($command);

            return response()->json([
                'message' => 'Module uninstalled successfully',
            ]);
        } catch (ModuleNotFoundException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }
    }
}
```

##### **11.1 Form Requests**

```php
// app/Contexts/ModuleRegistry/Presentation/Http/Requests/InstallModuleRequest.php

final class InstallModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Check if user has permission to install modules for this tenant
        return $this->user()->can('install-modules', $this->route('tenant'));
    }

    public function rules(): array
    {
        return [
            'module_id' => ['required', 'uuid', 'exists:modules,id'],
            'configuration' => ['nullable', 'array'],
            'configuration.*.key' => ['required', 'string'],
            'configuration.*.value' => ['required'],
        ];
    }

    public function messages(): array
    {
        return [
            'module_id.required' => 'Module ID is required',
            'module_id.uuid' => 'Module ID must be a valid UUID',
            'module_id.exists' => 'Module not found',
        ];
    }
}
```

##### **11.2 Tests (15 tests)**

**Deliverables:**
- 1 Controller (TenantModuleController)
- 2 Form Requests
- 15 integration tests

---

#### **DAY 12: ModuleInstallationController (6-8 hours)**

**Controller for tracking installation jobs**

**Deliverables:**
- 1 Controller
- 10 integration tests

---

#### **DAY 13-14: End-to-End Integration Tests (12-16 hours)**

**Goal:** Test complete workflows from API → Application → Domain → Infrastructure

```php
// tests/Integration/Contexts/ModuleRegistry/Workflows/ModuleInstallationWorkflowTest.php

final class ModuleInstallationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function complete_module_installation_workflow(): void
    {
        // 1. Register a module (as platform admin)
        $this->actingAsPlatformAdmin();

        $registerResponse = $this->postJson('/api/v1/platform/modules', [
            'name' => 'digital_card',
            'display_name' => 'Digital Business Cards',
            'version' => '1.0.0',
            'description' => 'Digital business card management',
            'namespace' => 'App\\Modules\\DigitalCard',
            'migrations_path' => 'database/migrations/digital_card',
            'requires_subscription' => true,
        ]);

        $registerResponse->assertStatus(201);
        $moduleId = $registerResponse->json('id');

        // 2. Publish the module
        $publishResponse = $this->patchJson("/api/v1/platform/modules/{$moduleId}/publish");
        $publishResponse->assertStatus(200);

        // 3. Install module for tenant (as tenant admin)
        $this->actingAsTenantAdmin('nrna');

        $installResponse = $this->postJson('/nrna/api/v1/modules', [
            'module_id' => $moduleId,
        ]);

        $installResponse->assertStatus(202); // Accepted
        $tenantModuleId = $installResponse->json('tenant_module_id');

        // 4. Verify module is installed
        $listResponse = $this->getJson('/nrna/api/v1/modules');
        $listResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.module.name', 'digital_card')
            ->assertJsonPath('data.0.status', 'installed');

        // 5. Verify installation job was created
        $jobResponse = $this->getJson('/nrna/api/v1/modules/installation-jobs');
        $jobResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'completed');
    }

    /** @test */
    public function module_installation_fails_when_dependency_not_met(): void
    {
        // 1. Register module with dependency
        $this->actingAsPlatformAdmin();

        $dependencyResponse = $this->postJson('/api/v1/platform/modules', [
            'name' => 'membership',
            'display_name' => 'Membership',
            'version' => '1.0.0',
            'description' => 'Membership management',
            'namespace' => 'App\\Modules\\Membership',
            'migrations_path' => 'database/migrations/membership',
        ]);

        $financeResponse = $this->postJson('/api/v1/platform/modules', [
            'name' => 'finance',
            'display_name' => 'Finance',
            'version' => '1.0.0',
            'description' => 'Financial management',
            'namespace' => 'App\\Modules\\Finance',
            'migrations_path' => 'database/migrations/finance',
            'dependencies' => [
                'membership' => '^1.0',
            ],
        ]);

        $financeId = $financeResponse->json('id');

        $this->patchJson("/api/v1/platform/modules/{$financeId}/publish");

        // 2. Try to install finance without installing membership first
        $this->actingAsTenantAdmin('nrna');

        $installResponse = $this->postJson('/nrna/api/v1/modules', [
            'module_id' => $financeId,
        ]);

        // Assert: Installation should fail
        $installResponse->assertStatus(422)
            ->assertJson([
                'message' => 'Dependency not met: membership must be installed first',
            ]);
    }
}
```

**Deliverables:**
- 15 end-to-end workflow tests

---

#### **DAY 15: Polish & Documentation (6-8 hours)**

1. **Update API Developer Guide**
2. **Create Architecture Decision Records (ADRs)**
3. **Performance optimization**
4. **Code review and cleanup**

---

## 📊 PHASE 5 DELIVERABLES SUMMARY

| Layer | Components | Files | Tests | Status |
|-------|-----------|-------|-------|--------|
| **Application** | Queries, Commands, Services, DTOs | 26 | 70 | 🆕 New |
| **Infrastructure** | Repositories, Migrations, Models | 16 | 50 | 🆕 New |
| **API (Complete)** | Controllers, Requests, Resources | 8 | 40 | 🆕 New |
| **Integration** | E2E Workflow Tests | 5 | 15 | 🆕 New |
| **TOTAL** | | **55** | **175** | **Phase 5** |

**Combined with Phase 1:**
- **Total Files:** 89 (34 Domain + 55 Phase 5)
- **Total Tests:** 283 (108 Domain + 175 Phase 5)

---

## 🧪 TESTING STRATEGY

### **Test Pyramid:**

```
        E2E Tests (15)
       ──────────────
      /              \
     /  Integration   \
    /    Tests (50)    \
   /────────────────────\
  /                      \
 /   Unit Tests (120)     \
/──────────────────────────\
```

### **Coverage Goals:**

- **Application Layer:** 90%+ (orchestration logic)
- **Infrastructure Layer:** 85%+ (adapters)
- **API Layer:** 80%+ (controllers, requests)
- **Integration:** 100% of critical workflows

---

## 🎯 SUCCESS CRITERIA

### **Phase 5 Complete When:**

- [ ] ✅ All 175 tests passing
- [ ] ✅ Zero direct Domain → API dependencies
- [ ] ✅ All repositories implement interfaces
- [ ] ✅ Service Provider binds all dependencies
- [ ] ✅ Migrations run successfully
- [ ] ✅ End-to-end workflows tested
- [ ] ✅ Documentation updated
- [ ] ✅ Code review approved

---

## 🚀 NEXT STEPS AFTER PHASE 5

Once Phase 5 is complete, we'll have a **fully functional ModuleRegistry** with:
- ✅ Complete Domain Layer
- ✅ Complete Application Layer
- ✅ Complete Infrastructure Layer
- ✅ Complete API Layer

**Then we can proceed to:**
1. **Integrate with DigitalCard Context**
2. **Build tenant provisioning workflows**
3. **Implement module installation webhooks**
4. **Add monitoring and observability**
5. **Production deployment**

---

## 📝 DEVELOPMENT WORKFLOW

### **Daily Routine:**

1. **Morning (9:00 AM):**
   - Review previous day's work
   - Run all tests
   - Update todo list

2. **Development (9:30 AM - 5:00 PM):**
   - **TDD Cycle:** RED → GREEN → REFACTOR
   - Commit after each GREEN phase
   - Push to feature branch daily

3. **End of Day (5:00 PM):**
   - Run full test suite
   - Update progress documentation
   - Create pull request if milestone complete

### **Git Workflow:**

```bash
# Day 1
git checkout -b feature/moduleregistry-phase5-day1-queries
# ... develop ...
git commit -m "feat(moduleregistry): add Query services and DTOs"
git push origin feature/moduleregistry-phase5-day1-queries
# Create PR, get review, merge

# Day 2
git checkout -b feature/moduleregistry-phase5-day2-commands
# ... continue ...
```

---

## ⚠️ CRITICAL REMINDERS

1. **ALWAYS write tests FIRST** (TDD)
2. **NEVER import Laravel in Domain layer**
3. **ALWAYS use Repository interfaces, not implementations**
4. **ALWAYS validate commands in constructors**
5. **ALWAYS publish domain events after state changes**
6. **NEVER skip integration tests**
7. **ALWAYS update documentation**

---

**Status:** ✅ **READY FOR IMPLEMENTATION**
**Estimated Duration:** 10-15 working days
**Team Size:** 1-2 developers
**Risk Level:** Low (following proven patterns)

**Let's build Phase 5!** 🚀
