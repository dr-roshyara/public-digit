# Phase 2 Application Layer - Implementation Plan

**ModuleRegistry Context - Application Layer**
**Start Date**: 2025-12-28
**Target**: 79 tests, 26 files
**Developer**: Senior Software Architect with DDD/TDD expertise

---

## 🎯 Phase 2 Objectives

### Primary Goals
1. **Application Services** - Orchestrate domain logic, coordinate workflows
2. **Commands** - Immutable DTOs representing user intentions
3. **DTOs** - Data Transfer Objects for cross-layer communication
4. **Validators** - Input validation before domain operations
5. **Queries** - Read-side operations for retrieving data

### Success Criteria
- ✅ 79 tests passing (all green)
- ✅ Zero framework imports in Application layer (pure PHP)
- ✅ 100% hexagonal compliance (depend on ports only)
- ✅ TDD workflow followed for every file (RED → GREEN → REFACTOR)
- ✅ Integration with Phase 1 Domain layer verified

---

## 📁 Directory Structure

```
app/Contexts/ModuleRegistry/
└── Application/
    ├── Services/                    # Orchestration services
    │   ├── ModuleRegistrationService.php
    │   ├── ModuleInstallationService.php
    │   └── ModuleInstallationJobService.php
    ├── Commands/                    # Write-side intentions
    │   ├── RegisterModuleCommand.php
    │   ├── InstallModuleCommand.php
    │   ├── UninstallModuleCommand.php
    │   ├── UpdateModuleVersionCommand.php
    │   └── DeprecateModuleCommand.php
    ├── Queries/                     # Read-side operations
    │   ├── GetAllModulesQuery.php
    │   ├── GetModuleByIdQuery.php
    │   ├── GetModuleByNameQuery.php
    │   ├── GetTenantModulesQuery.php
    │   ├── GetInstallationJobsQuery.php
    │   └── GetInstallationJobByIdQuery.php
    ├── DTOs/                        # Data Transfer Objects
    │   ├── ModuleDTO.php
    │   ├── TenantModuleDTO.php
    │   └── ModuleInstallationJobDTO.php
    ├── Validators/                  # Input validation
    │   ├── ModuleRegistrationValidator.php
    │   └── InstallationRequestValidator.php
    └── Exceptions/                  # Application exceptions
        ├── ModuleAlreadyExistsException.php
        ├── ModuleNotFoundException.php
        ├── TenantModuleAlreadyInstalledException.php
        └── InstallationJobNotFoundException.php

tests/Unit/Contexts/ModuleRegistry/Application/
├── Services/
│   ├── ModuleRegistrationServiceTest.php (15 tests)
│   ├── ModuleInstallationServiceTest.php (18 tests)
│   └── ModuleInstallationJobServiceTest.php (12 tests)
├── Commands/
│   ├── RegisterModuleCommandTest.php (6 tests)
│   ├── InstallModuleCommandTest.php (5 tests)
│   └── UninstallModuleCommandTest.php (3 tests)
├── Queries/
│   ├── GetAllModulesQueryTest.php (3 tests)
│   ├── GetModuleByIdQueryTest.php (2 tests)
│   └── GetTenantModulesQueryTest.php (3 tests)
└── Validators/
    ├── ModuleRegistrationValidatorTest.php (10 tests)
    └── InstallationRequestValidatorTest.php (8 tests)
```

---

## 📅 Day-by-Day Implementation Plan

### **Day 1: Foundation & ModuleRegistrationService**

**Morning (3 hours): Setup & First Service**
1. ✅ Create directory structure
2. ✅ Write `ModuleRegistrationServiceTest.php` (15 tests - RED phase)
3. ✅ Implement `RegisterModuleCommand` (immutable, validated)
4. ✅ Implement `ModuleRegistrationService` (GREEN phase)
5. ✅ Refactor for clarity (REFACTOR phase)

**Afternoon (3 hours): DTOs & Queries**
6. ✅ Implement `ModuleDTO` with `fromAggregate()` mapping
7. ✅ Write `GetAllModulesQueryTest.php` (3 tests)
8. ✅ Implement `GetAllModulesQuery`
9. ✅ Write `GetModuleByIdQueryTest.php` (2 tests)
10. ✅ Implement `GetModuleByIdQuery`

**Evening: Validation**
- Run tests: `php artisan test tests/Unit/Contexts/ModuleRegistry/Application/`
- Verify zero framework imports
- Document lessons learned

**Target**: 20 tests passing by end of Day 1

---

### **Day 2: ModuleInstallationService (Core Workflow)**

**Morning (3 hours): Installation Service TDD**
1. ✅ Write `ModuleInstallationServiceTest.php` (18 tests - RED phase)
   - Test subscription validation
   - Test dependency resolution
   - Test job creation
   - Test duplicate installation detection
   - Test missing module handling

2. ✅ Implement `InstallModuleCommand`
3. ✅ Implement `UninstallModuleCommand`

**Afternoon (3 hours): Service Implementation**
4. ✅ Implement `ModuleInstallationService` (GREEN phase)
   - Use `SubscriptionValidator` from Domain
   - Use `DependencyResolver` from Domain
   - Create `ModuleInstallationJob` aggregate
   - Publish domain events

5. ✅ Refactor for clarity

**Evening: Integration Testing**
- Test integration with Domain layer
- Verify subscription checks work
- Verify dependency resolution works
- Test job creation workflow

**Target**: 38+ tests passing (cumulative)

---

### **Day 3: InstallationJobService & Validators**

**Morning (3 hours): Job Management Service**
1. ✅ Write `ModuleInstallationJobServiceTest.php` (12 tests)
2. ✅ Implement `ModuleInstallationJobService`
   - Start job execution
   - Record step completion (idempotent)
   - Handle failures
   - Retry failed jobs

**Afternoon (3 hours): Validators**
3. ✅ Write `ModuleRegistrationValidatorTest.php` (10 tests)
4. ✅ Implement `ModuleRegistrationValidator`
   - Name format validation
   - Version format validation
   - Namespace validation
   - Dependency format validation

5. ✅ Write `InstallationRequestValidatorTest.php` (8 tests)
6. ✅ Implement `InstallationRequestValidator`
   - Module exists validation
   - Tenant subscription validation
   - Dependency availability validation

**Evening: Comprehensive Testing**
- Run full Phase 2 test suite
- Integration tests with Phase 1
- Performance profiling

**Target**: 70+ tests passing (cumulative)

---

### **Day 4: Remaining DTOs, Queries & Polish**

**Morning (3 hours): Complete DTOs & Queries**
1. ✅ Implement `TenantModuleDTO`
2. ✅ Implement `ModuleInstallationJobDTO`
3. ✅ Write `GetTenantModulesQueryTest.php` (3 tests)
4. ✅ Implement `GetTenantModulesQuery`
5. ✅ Write `GetInstallationJobsQueryTest.php` (3 tests)
6. ✅ Implement `GetInstallationJobsQuery`

**Afternoon (2 hours): Exception Handling**
7. ✅ Create application-level exceptions:
   - `ModuleAlreadyExistsException`
   - `ModuleNotFoundException`
   - `TenantModuleAlreadyInstalledException`
   - `InstallationJobNotFoundException`

**Afternoon (2 hours): Final Validation**
8. ✅ Run complete test suite (target: 79 tests)
9. ✅ Verify zero framework imports:
   ```bash
   grep -r "Illuminate\|Laravel\|Spatie\|Ramsey" app/Contexts/ModuleRegistry/Application/
   ```
10. ✅ Architecture compliance check
11. ✅ Code review and refactoring

**Evening: Documentation**
- Write Phase 2 completion summary
- Update developer guide
- Create architecture diagrams

**Target**: 79 tests passing ✅

---

## 🏗️ Architectural Compliance Checklist

### Before Each Implementation

**1. Domain Purity Verification**
```bash
# MUST return NO OUTPUT
grep -r "Illuminate\|Laravel\|Spatie\|Ramsey" app/Contexts/ModuleRegistry/Application/
```

**2. Hexagonal Compliance**
```php
// ✅ CORRECT: Depend on ports (interfaces)
public function __construct(
    private ModuleRepositoryInterface $moduleRepository,      // PORT
    private EventPublisherInterface $eventPublisher,          // PORT
    private SubscriptionValidator $subscriptionValidator      // DOMAIN SERVICE
) {}

// ❌ WRONG: Depend on concrete implementations
public function __construct(
    private EloquentModuleRepository $moduleRepository,       // CONCRETE
    private LaravelEventDispatcher $eventDispatcher          // FRAMEWORK
) {}
```

**3. TDD Workflow (NON-NEGOTIABLE)**
```
Step 1: RED    - Write failing test first
Step 2: GREEN  - Minimal code to pass test
Step 3: REFACTOR - Improve without breaking tests
```

**4. Command Immutability**
```php
// ✅ CORRECT: Readonly properties
final readonly class RegisterModuleCommand
{
    public function __construct(
        public string $name,
        public string $displayName,
        // ... all readonly
    ) {}
}

// ❌ WRONG: Mutable properties
class RegisterModuleCommand
{
    public string $name;  // Can be modified!
}
```

**5. DTO Mapping Pattern**
```php
// ✅ CORRECT: Static factory from aggregate
final class ModuleDTO
{
    public static function fromAggregate(Module $module): self
    {
        return new self(
            id: $module->id()->toString(),
            name: $module->name()->toString(),
            // ... map all properties
        );
    }
}
```

---

## 🧪 Testing Strategy

### Test Structure

**Unit Tests (Pure PHP, Fast)**
```php
final class ModuleRegistrationServiceTest extends TestCase
{
    private ModuleRegistrationService $service;
    private ModuleRepositoryInterface $moduleRepository;
    private EventPublisherInterface $eventPublisher;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock dependencies (interfaces only)
        $this->moduleRepository = $this->createMock(ModuleRepositoryInterface::class);
        $this->eventPublisher = $this->createMock(EventPublisherInterface::class);

        // Create service with mocked dependencies
        $this->service = new ModuleRegistrationService(
            $this->moduleRepository,
            $this->eventPublisher
        );
    }

    public function test_registers_new_module_successfully(): void
    {
        // Arrange
        $command = new RegisterModuleCommand(
            name: 'test_module',
            displayName: 'Test Module',
            version: '1.0.0',
            namespace: 'App\\Modules\\Test',
            migrationsPath: null,
            requiresSubscription: false,
            configuration: [],
            dependencies: []
        );

        $this->moduleRepository
            ->expects($this->once())
            ->method('findByName')
            ->willReturn(null); // Module doesn't exist

        $this->moduleRepository
            ->expects($this->once())
            ->method('save');

        $this->eventPublisher
            ->expects($this->once())
            ->method('publish');

        // Act
        $moduleId = $this->service->registerModule($command);

        // Assert
        $this->assertInstanceOf(ModuleId::class, $moduleId);
    }
}
```

### Test Coverage Targets

| Component | Tests | Coverage |
|-----------|-------|----------|
| ModuleRegistrationService | 15 | ≥95% |
| ModuleInstallationService | 18 | ≥95% |
| ModuleInstallationJobService | 12 | ≥95% |
| Commands | 14 | 100% |
| Queries | 14 | ≥90% |
| Validators | 18 | 100% |
| DTOs | 8 | 100% |
| **TOTAL** | **79** | **≥90%** |

---

## 🔗 Integration with Phase 1 (Domain Layer)

### Using Domain Aggregates

```php
// ✅ Application Service creates Domain Aggregates
class ModuleRegistrationService
{
    public function registerModule(RegisterModuleCommand $command): ModuleId
    {
        // 1. Create domain aggregate (from Phase 1)
        $module = new Module(
            ModuleId::generate(),
            ModuleName::fromString($command->name),
            $command->displayName,
            ModuleVersion::fromString($command->version),
            // ... rest of parameters
        );

        // 2. Add dependencies (domain method)
        foreach ($command->dependencies as $dep) {
            $module->addDependency(
                new ModuleDependency(
                    ModuleName::fromString($dep['module_name']),
                    $dep['version_constraint']
                )
            );
        }

        // 3. Persist via repository (port)
        $this->moduleRepository->save($module);

        // 4. Publish domain events
        $events = $module->releaseEvents();
        foreach ($events as $event) {
            $this->eventPublisher->publish($event);
        }

        return $module->id();
    }
}
```

### Using Domain Services

```php
// ✅ Application Service delegates to Domain Service
class ModuleInstallationService
{
    public function __construct(
        private SubscriptionValidator $subscriptionValidator,  // DOMAIN SERVICE
        private DependencyResolver $dependencyResolver         // DOMAIN SERVICE
    ) {}

    public function installModule(InstallModuleCommand $command): ModuleInstallationJobId
    {
        // 1. Validate subscription (domain service)
        $this->subscriptionValidator->canInstall(
            $command->tenantId,
            $module
        );

        // 2. Resolve dependencies (domain service)
        $installationOrder = $this->dependencyResolver->resolveDependencies(
            $module,
            $installedModules
        );

        // 3. Create job (domain aggregate)
        $job = new ModuleInstallationJob(
            ModuleInstallationJobId::generate(),
            $command->tenantId,
            $module->id(),
            JobType::INSTALL
        );

        // Application service orchestrates, Domain decides business rules
    }
}
```

---

## 🚨 Common Pitfalls & Solutions

| Pitfall | Example | Solution |
|---------|---------|----------|
| **Business logic in Application layer** | `if ($module->version() < '2.0.0') { }` | Move to Domain aggregate/service |
| **Framework coupling** | `use Illuminate\Support\Collection;` | Use PHP arrays or custom collections |
| **Mutable commands** | `$command->name = 'new_name';` | Use `readonly` properties |
| **Direct Eloquent usage** | `Module::where('name', $name)->first()` | Use repository interface |
| **Missing validation** | No check for duplicate module | Add in validator before service |
| **Non-idempotent operations** | Append-only step recording | Use find-and-update pattern |

---

## ✅ Phase 2 Completion Criteria

### Functional Requirements
- ✅ 79 tests passing (100% green)
- ✅ All 3 Application Services working
- ✅ All 5 Commands validated and immutable
- ✅ All 6 Queries returning correct data
- ✅ All 3 DTOs mapping correctly
- ✅ All 2 Validators working

### Architectural Requirements
- ✅ Zero framework imports in Application layer
- ✅ 100% hexagonal compliance (ports only)
- ✅ TDD workflow followed for all files
- ✅ Integration with Phase 1 Domain verified
- ✅ Code coverage ≥90%

### Documentation Requirements
- ✅ Phase 2 completion summary written
- ✅ Developer guide updated
- ✅ Architecture diagrams created
- ✅ Lessons learned documented

---

## 🚀 Starting Point

**First Task**: Create directory structure
**First Test**: `ModuleRegistrationServiceTest::test_registers_new_module_successfully()`
**First Implementation**: `RegisterModuleCommand` + `ModuleRegistrationService`

**Command to start**:
```bash
# Create directory structure
mkdir -p app/Contexts/ModuleRegistry/Application/{Services,Commands,Queries,DTOs,Validators,Exceptions}
mkdir -p tests/Unit/Contexts/ModuleRegistry/Application/{Services,Commands,Queries,Validators}

# Verify Phase 1 tests still passing
php artisan test tests/Unit/Contexts/ModuleRegistry/Domain/

# Begin Phase 2
# Next: Create ModuleRegistrationServiceTest.php
```

---

**Phase 2 Implementation Plan: READY TO EXECUTE ✅**

**Developer mindset**: Senior Architect, DDD expert, TDD practitioner
**Approach**: Test-first, domain-centric, architecture-preserving
**Goal**: 79 tests passing, zero framework coupling, production-ready Application layer

**Let's build Phase 2 with the same discipline as Phase 1!** 🚀
