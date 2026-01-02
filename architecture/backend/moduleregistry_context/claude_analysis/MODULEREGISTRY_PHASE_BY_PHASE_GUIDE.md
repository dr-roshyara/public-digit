# **MODULEREGISTRY CONTEXT - PHASE-BY-PHASE IMPLEMENTATION GUIDE**

**Detailed deliverables, acceptance criteria, and validation checkpoints for each phase**

---

## **PHASE 1: DOMAIN LAYER FOUNDATION**

**Duration:** 4-5 days | **Effort:** 20-25 hours | **Team:** 1-2 developers  
**Approach:** TDD (RED → GREEN → REFACTOR) | **Delivery:** Monday-Thursday EOD

---

### **1.1 SETUP & STRUCTURE**

#### **Task 1.1.1: Create Directory Structure**
```bash
# Create ModuleRegistry context directories
mkdir -p app/Contexts/ModuleRegistry/{Domain,Application,Infrastructure}
mkdir -p app/Contexts/ModuleRegistry/Domain/{Models,ValueObjects,Services,Events,Repositories,Exceptions}
mkdir -p app/Contexts/ModuleRegistry/Application/{Commands,Handlers,Services,DTOs}
mkdir -p app/Contexts/ModuleRegistry/Infrastructure/{Database/Migrations,Repositories,Adapters}
mkdir -p tests/Unit/Contexts/ModuleRegistry
mkdir -p tests/Feature/Contexts/ModuleRegistry
```

**Acceptance Criteria:**
- ✅ All directories created
- ✅ PSR-4 autoloading configured
- ✅ Namespace: `App\Contexts\ModuleRegistry`

---

### **1.2 VALUE OBJECTS**

#### **Task 1.2.1: ModuleId Value Object**

**File:** `Domain/ValueObjects/ModuleId.php`

```php
<?php
namespace App\Contexts\ModuleRegistry\Domain\ValueObjects;

final readonly class ModuleId
{
    private function __construct(public string $value) {}
    
    public static function generate(): self { /* Pure PHP UUID */ }
    public static function fromString(string $value): self { /* Validation */ }
    public function toString(): string { /* Return $value */ }
    public function equals(self $other): bool { /* Compare */ }
    public function __toString(): string { /* Return $value */ }
}
```

**Tests to Write:** (8 tests)
```php
public function test_can_generate_valid_uuid() { }
public function test_can_create_from_string() { }
public function test_uuid_is_valid_format() { }
public function test_empty_id_throws_exception() { }
public function test_two_ids_with_same_value_are_equal() { }
public function test_two_ids_with_different_values_not_equal() { }
public function test_can_convert_to_string() { }
public function test_rejects_invalid_uuid_format() { }
```

**Acceptance Criteria:**
- ✅ 8 tests passing
- ✅ Generates valid UUIDs (RFC 4122)
- ✅ Validates input
- ✅ Implements equals() method
- ✅ No framework dependencies

---

#### **Task 1.2.2: ModuleName Value Object**

**File:** `Domain/ValueObjects/ModuleName.php`

```php
final readonly class ModuleName
{
    private function __construct(public string $value) {}
    
    public static function fromString(string $value): self {
        // Validation: lowercase, no spaces, 3-50 chars
    }
}
```

**Tests:** (6 tests)
- Must be lowercase
- No spaces allowed
- Min 3 chars, max 50 chars
- Only alphanumeric + underscore
- Equals comparison
- Rejects invalid names

---

#### **Task 1.2.3: ModuleVersion Value Object**

**File:** `Domain/ValueObjects/ModuleVersion.php`

```php
final readonly class ModuleVersion
{
    private function __construct(
        public string $version // '1.0.0', '2.1.3', etc.
    ) {}
    
    public static function fromString(string $version): self { }
    public function major(): int { }
    public function minor(): int { }
    public function patch(): int { }
    public function isGreaterThan(self $other): bool { }
    public function satisfies(string $constraint): bool { } // '^1.0', '>=1.0', etc.
}
```

**Tests:** (10 tests)
- Valid semantic versioning
- Major/minor/patch extraction
- Version comparison
- Constraint matching (^1.0, >=1.0, ~1.0, =1.0)
- Invalid versions rejected

---

#### **Task 1.2.4: ModuleDependency Value Object**

**File:** `Domain/ValueObjects/ModuleDependency.php`

```php
final readonly class ModuleDependency
{
    public function __construct(
        public ModuleName $moduleName,
        public string $versionConstraint // '^1.0', '>=1.0', etc.
    ) {}
    
    public function isSatisfiedBy(ModuleVersion $version): bool { }
}
```

**Tests:** (6 tests)
- Version constraint parsing
- Constraint satisfaction checking
- Invalid constraints rejected

---

#### **Task 1.2.5: Enums (ModuleStatus, InstallationStatus)**

**Files:**
- `Domain/ValueObjects/ModuleStatus.php`
- `Domain/ValueObjects/InstallationStatus.php`

```php
enum ModuleStatus: string {
    case ACTIVE = 'active';
    case DEPRECATED = 'deprecated';
    case MAINTENANCE = 'maintenance';
    case ARCHIVED = 'archived';
}

enum InstallationStatus: string {
    case PENDING = 'pending';
    case INSTALLING = 'installing';
    case INSTALLED = 'installed';
    case FAILED = 'failed';
    case UNINSTALLING = 'uninstalling';
}
```

**Tests:** (4 tests each)
- Enum values correct
- Conversion to string
- Comparison

**Phase 1.2 Subtotal:**
- ✅ 5 value objects
- ✅ 40+ tests
- ✅ All pure PHP
- ✅ No Laravel imports

---

### **1.3 DOMAIN AGGREGATES**

#### **Task 1.3.1: Module Aggregate**

**File:** `Domain/Models/Module.php`

```php
<?php
final class Module extends AggregateRoot
{
    private ModuleId $id;
    private ModuleName $name;
    private string $displayName;
    private ModuleVersion $version;
    private string $description;
    private string $namespace;
    private string $migrationsPath;
    private bool $requiresSubscription;
    private array $dependencies = []; // Collection[ModuleDependency]
    private ModuleStatus $status;
    private array $configuration = [];
    private DateTimeImmutable $createdAt;
    private DateTimeImmutable $updatedAt;
    private ?DateTimeImmutable $publishedAt = null;
    
    // Constructor (private)
    private function __construct(
        ModuleId $id,
        ModuleName $name,
        string $displayName,
        ModuleVersion $version,
        // ...
    ) {}
    
    // Static factory
    public static function create(
        ModuleName $name,
        string $displayName,
        ModuleVersion $version,
        // ...
    ): self { }
    
    // Domain methods
    public function publish(): void { }
    public function deprecate(): void { }
    public function addDependency(ModuleDependency $dep): void { }
    public function removeDependency(ModuleName $depName): void { }
    public function updateConfiguration(array $config): void { }
    
    // Getters
    public function getId(): ModuleId { }
    public function getName(): ModuleName { }
    public function getVersion(): ModuleVersion { }
    public function getStatus(): ModuleStatus { }
    public function getDependencies(): array { }
    public function isActive(): bool { }
    public function requiresSubscription(): bool { }
    
    // Domain Rules
    public function canBeUninstalled(int $activeTenantCount): bool {
        // Cannot deprecate if tenants actively using it
    }
    
    public function validateDependencies(array $availableModules): void {
        // Check for circular dependencies
        // Check all dependencies exist
    }
}
```

**Tests:** (12 tests)
```php
public function test_can_create_module() { }
public function test_module_must_have_unique_name() { }
public function test_module_version_must_be_valid() { }
public function test_can_publish_module() { }
public function test_published_module_has_published_at() { }
public function test_can_add_dependencies() { }
public function test_detects_circular_dependencies() { }
public function test_cannot_deprecate_if_tenants_using_it() { }
public function test_cannot_remove_if_tenants_depend_on_it() { }
public function test_inactive_modules_cannot_be_installed() { }
public function test_configuration_is_updateable() { }
public function test_module_tracks_creation_timestamp() { }
```

---

#### **Task 1.3.2: TenantModule Aggregate**

**File:** `Domain/Models/TenantModule.php`

```php
<?php
final class TenantModule extends AggregateRoot
{
    private TenantModuleId $id;
    private TenantId $tenantId;           // ✅ RULE 1: TenantId in every aggregate
    private ModuleId $moduleId;
    private ModuleVersion $installedVersion;
    private InstallationStatus $status;
    private array $configuration = [];
    private DateTimeImmutable $createdAt;
    private DateTimeImmutable $updatedAt;
    private ?DateTimeImmutable $installedAt = null;
    private ?string $installedBy = null;
    private ?DateTimeImmutable $lastUsedAt = null;
    private ?string $failureReason = null;
    
    // Domain methods
    public static function createPending(
        TenantModuleId $id,
        TenantId $tenantId,
        ModuleId $moduleId,
        ModuleVersion $version
    ): self { }
    
    public function markAsInstallingStarted(): void { }
    public function markAsInstalled(DateTimeImmutable $installedAt, ?string $installedBy): void { }
    public function markAsFailed(string $reason): void { }
    public function updateLastUsedAt(DateTimeImmutable $time): void { }
    
    // Domain Rules
    public function belongsToTenant(TenantId $tenantId): bool {
        // ✅ RULE 4: Validate tenant ownership
        return $this->tenantId->equals($tenantId);
    }
    
    public function isInstalled(): bool {
        return $this->status === InstallationStatus::INSTALLED;
    }
    
    public function isInstalling(): bool {
        return $this->status === InstallationStatus::INSTALLING;
    }
}
```

**Tests:** (10 tests)
```php
public function test_can_create_pending_tenant_module() { }
public function test_status_starts_as_pending() { }
public function test_can_mark_as_installing() { }
public function test_can_mark_as_installed() { }
public function test_installed_module_has_installed_at_timestamp() { }
public function test_can_mark_as_failed_with_reason() { }
public function test_respects_tenant_boundaries() { }
public function test_cannot_modify_another_tenants_module() { }
public function test_tracks_last_used_time() { }
public function test_installation_details_recorded() { }
```

---

#### **Task 1.3.3: ModuleInstallationJob Aggregate**

**File:** `Domain/Models/ModuleInstallationJob.php`

```php
<?php
final class ModuleInstallationJob extends AggregateRoot
{
    private InstallationJobId $id;
    private TenantId $tenantId;           // ✅ RULE 1: TenantId
    private ModuleId $moduleId;
    private JobType $jobType; // INSTALL, UNINSTALL, UPGRADE
    private InstallationStatus $status;
    private array $steps = [];            // Collection[InstallationStep]
    private array $errorMessage = null;
    private DateTimeImmutable $createdAt;
    private ?DateTimeImmutable $startedAt = null;
    private ?DateTimeImmutable $completedAt = null;
    private ?DateTimeImmutable $rolledBackAt = null;
    private ?string $rollbackReason = null;
    
    // Domain methods
    public static function createInstallation(
        InstallationJobId $id,
        TenantId $tenantId,
        ModuleId $moduleId
    ): self { }
    
    public function recordStepCompletion(string $stepName): void { }
    public function recordStepFailure(string $stepName, string $error): void { }
    public function markAsStarted(DateTimeImmutable $time): void { }
    public function markAsCompleted(DateTimeImmutable $time): void { }
    public function markAsFailed(string $error): void { }
    public function rollback(string $reason): void { }
    
    // Domain Rules
    public function belongsToTenant(TenantId $tenantId): bool {
        return $this->tenantId->equals($tenantId);
    }
    
    public function isInProgress(): bool {
        return $this->status === InstallationStatus::INSTALLING;
    }
    
    public function getCompletedSteps(): array {
        return array_filter($this->steps, fn($s) => $s->isCompleted());
    }
}
```

**Tests:** (12 tests)
```php
public function test_can_create_installation_job() { }
public function test_starts_as_pending() { }
public function test_can_record_step_completion() { }
public function test_can_record_step_failure() { }
public function test_marks_as_started() { }
public function test_marks_as_completed_with_timestamp() { }
public function test_marks_as_failed_with_error() { }
public function test_can_rollback_with_reason() { }
public function test_respects_tenant_boundaries() { }
public function test_tracks_all_steps() { }
public function test_cannot_complete_if_any_step_failed() { }
public function test_returns_completed_steps() { }
```

**Phase 1.3 Subtotal:**
- ✅ 3 aggregates
- ✅ 34 tests
- ✅ All domain rules enforced
- ✅ Tenant isolation verified

---

### **1.4 DOMAIN SERVICES & EXCEPTIONS**

#### **Task 1.4.1: DependencyResolver Domain Service**

**File:** `Domain/Services/DependencyResolver.php`

```php
<?php
final class DependencyResolver
{
    /**
     * Resolve module dependencies in correct installation order
     */
    public function resolveDependencies(
        Module $module,
        array $installedModules
    ): array {
        // 1. Validate all dependencies exist
        // 2. Detect circular dependencies
        // 3. Return in topological order
    }
    
    /**
     * Check if all dependencies are installed
     */
    public function validateDependencies(
        Module $module,
        array $installedModules
    ): void {
        // Throw MissingDependenciesException if missing
    }
    
    private function detectCircularDependencies(Module $module): void {
        // Depth-first search to detect cycles
    }
}
```

**Tests:** (8 tests)
```php
public function test_resolves_dependencies_in_correct_order() { }
public function test_detects_missing_dependencies() { }
public function test_detects_circular_dependencies() { }
public function test_validates_version_constraints() { }
public function test_handles_multiple_dependencies() { }
public function test_handles_transitive_dependencies() { }
public function test_throws_for_incompatible_versions() { }
public function test_handles_no_dependencies() { }
```

---

#### **Task 1.4.2: SubscriptionValidator Domain Service**

**File:** `Domain/Services/SubscriptionValidator.php`

```php
<?php
final class SubscriptionValidator
{
    public function __construct(
        private SubscriptionServiceInterface $subscriptionService
    ) {}
    
    public function canInstall(
        TenantId $tenantId,
        Module $module
    ): void {
        if (!$module->requiresSubscription()) {
            return; // Free module, no check needed
        }
        
        if (!$this->subscriptionService->hasSubscriptionForModule($tenantId, $module)) {
            throw new SubscriptionRequiredException(
                "Tenant does not have subscription for {$module->getName()}"
            );
        }
    }
    
    public function getQuota(TenantId $tenantId, Module $module): ?int {
        return $this->subscriptionService->getSubscriptionQuota($tenantId, $module);
    }
}
```

**Tests:** (6 tests)
```php
public function test_allows_installation_with_subscription() { }
public function test_blocks_installation_without_subscription() { }
public function test_allows_free_modules_without_subscription() { }
public function test_returns_quota_if_available() { }
public function test_returns_null_for_unlimited_quota() { }
public function test_throws_subscription_exception_if_no_subscription() { }
```

---

#### **Task 1.4.3: Domain Exceptions**

**Files:**
- `Domain/Exceptions/ModuleRegistryException.php` (Base)
- `Domain/Exceptions/SubscriptionRequiredException.php`
- `Domain/Exceptions/MissingDependenciesException.php`
- `Domain/Exceptions/CircularDependencyException.php`
- `Domain/Exceptions/ModuleAlreadyInstalledException.php`
- `Domain/Exceptions/ModuleNotFound.php`

```php
<?php
class ModuleRegistryException extends DomainException {}

final class SubscriptionRequiredException extends ModuleRegistryException {}

final class MissingDependenciesException extends ModuleRegistryException {
    public function __construct(private array $missingDependencies) {}
    public function getMissingDependencies(): array { return $this->missingDependencies; }
}

// ... more exception classes
```

**Tests:** (1 test each = 6 tests)
- Each exception constructs correctly
- Error messages are clear

**Phase 1.4 Subtotal:**
- ✅ 2 domain services
- ✅ 6 exception classes
- ✅ 14 tests

---

### **1.5 DOMAIN EVENTS**

**File:** `Domain/Events/ModuleInstallationStarted.php` (and others)

```php
<?php
final readonly class ModuleInstallationStarted
{
    public function __construct(
        public TenantId $tenantId,
        public ModuleId $moduleId,
        public ModuleVersion $version,
        public InstallationJobId $jobId,
        public DateTimeImmutable $timestamp = new DateTimeImmutable()
    ) {}
}

final readonly class ModuleInstallationCompleted {
    // Similar structure
}

final readonly class ModuleInstallationFailed {
    public function __construct(
        public TenantId $tenantId,
        public ModuleId $moduleId,
        public string $failureReason,
        public string $failedAtStep,
        public DateTimeImmutable $timestamp = new DateTimeImmutable()
    ) {}
}

// Plus: ModuleUninstallationStarted, ModuleUninstallationCompleted
//       ModuleVersionDeprecated, ModuleUpgradeStarted, ModuleUpgradeCompleted
```

**Tests:** (6 tests, 1 per event)
- Each event constructs correctly
- TenantId is included
- Timestamp recorded

---

### **1.6 REPOSITORY INTERFACES**

**File:** `Domain/Repositories/ModuleRepository.php`

```php
<?php
interface ModuleRepository
{
    public function save(Module $module): void;
    public function findById(ModuleId $id): ?Module;
    public function findByName(ModuleName $name): ?Module;
    public function all(): Collection;
    public function activeModules(): Collection;
    public function findDependencies(Module $module): Collection;
}

interface TenantModuleRepository
{
    // ✅ RULE 2: ALL methods include TenantId
    public function saveForTenant(TenantModule $tenantModule, TenantId $tenantId): void;
    public function findForTenant(ModuleId $moduleId, TenantId $tenantId): ?TenantModule;
    public function installedForTenant(TenantId $tenantId): Collection;
    public function isInstalledForTenant(ModuleId $moduleId, TenantId $tenantId): bool;
    public function findInstalledVersionForTenant(ModuleId $moduleId, TenantId $tenantId): ?ModuleVersion;
    public function removeForTenant(ModuleId $moduleId, TenantId $tenantId): void;
}

interface ModuleInstallationJobRepository
{
    public function save(ModuleInstallationJob $job): void;
    public function findForTenant(TenantId $tenantId, ModuleId $moduleId): ?ModuleInstallationJob;
    public function findInProgressForTenant(TenantId $tenantId): Collection;
    public function findLastJobForModule(TenantId $tenantId, ModuleId $moduleId): ?ModuleInstallationJob;
}
```

**Tests:** (6 tests)
- All repository interfaces defined
- All methods include TenantId where appropriate
- No tenant-agnostic methods

---

### **1.7 PHASE 1 VERIFICATION CHECKLIST**

**Acceptance Criteria for Phase 1:**

```
DOMAIN LAYER COMPLETION:
✅ 5 Value Objects created (40+ tests)
✅ 3 Aggregates created (34 tests)
✅ 2 Domain Services created (14 tests)
✅ 6 Exception classes created (6 tests)
✅ 5 Domain Events created (5 tests)
✅ 3 Repository interfaces defined (6 tests)

TOTAL PHASE 1:
✅ 105+ tests passing
✅ 0 Laravel/framework imports in Domain layer
✅ All domain rules enforced
✅ All aggregates have belongsToTenant()
✅ All repositories use ForTenant naming
✅ Pure PHP, production-quality code
✅ 90%+ code coverage

VALIDATION:
✅ Run: grep -r "Illuminate\|Laravel\|Spatie" app/Contexts/ModuleRegistry/Domain/ 
        → Should return NOTHING
✅ Run: phpunit tests/Unit/Contexts/ModuleRegistry/ --coverage
        → Should show 90%+ coverage
✅ Code review: Each PR must enforce tenant boundaries
```

---

## **PHASE 2: APPLICATION LAYER (Week 2)**

### **2.1 Commands & Handlers Structure**

**Commands:**
```
├── InstallModuleCommand
├── UninstallModuleCommand
├── UpgradeModuleCommand
├── RegisterModuleCommand
└── DeprecateModuleVersionCommand
```

**Handlers:**
```
├── InstallModuleHandler
├── UninstallModuleHandler
├── UpgradeModuleHandler
├── RegisterModuleHandler
└── DeprecateModuleVersionHandler
```

### **2.2 Application Services**

```
├── ModuleInstaller (orchestrates installation)
├── ModuleVersionManager (handles versioning)
├── ModuleDiscoveryService (scans for modules)
└── ModuleUpgradeService (handles upgrades)
```

### **2.3 Phase 2 Deliverables**

- ✅ 5 command classes
- ✅ 5 command handlers
- ✅ 25+ integration tests
- ✅ All handlers use domain services
- ✅ All handlers include subscription checks
- ✅ All handlers respect tenant boundaries

---

## **PHASE 3: INFRASTRUCTURE LAYER (Week 2-3)**

### **3.1 Database Migrations**

- ✅ Landlord DB: modules table
- ✅ Landlord DB: module_dependencies table
- ✅ Landlord DB: tenant_modules table
- ✅ Landlord DB: module_installation_jobs table
- ✅ Landlord DB: module_version_history table

### **3.2 Repository Implementations**

- ✅ EloquentModuleRepository
- ✅ EloquentTenantModuleRepository
- ✅ EloquentModuleInstallationJobRepository

### **3.3 Port Implementations (Adapters)**

- ✅ TenantConnectionManager (Spatie wrapper)
- ✅ MigrationRunner (Laravel wrapper)
- ✅ ModuleDiscovery (filesystem scanner)
- ✅ EventPublisher (Laravel events)
- ✅ SubscriptionServiceAdapter (external service call)

### **3.4 Service Provider**

- ✅ All ports bound to adapters
- ✅ All repositories registered
- ✅ All domain services registered
- ✅ Command bus wired up

---

## **PHASE 4: API LAYER (Week 3-4)**

### **4.1 Controllers**

```
ModuleController:
├── index() - List available modules
├── install() - Install module for tenant
├── uninstall() - Uninstall module
├── status() - Get installation status
└── getInstallationJob() - Get job details
```

### **4.2 Routes**

```
GET  /api/v1/modules                      - List modules
POST /api/v1/modules/{module}/install     - Install module
DELETE /api/v1/modules/{module}           - Uninstall module
GET  /api/v1/modules/{module}/status      - Check status
GET  /api/v1/modules/{module}/job         - Get job details
```

### **4.3 Authorization Policies**

- ✅ ModulePolicy::install()
- ✅ ModulePolicy::uninstall()
- ✅ ModulePolicy::view()

---

## **PHASE 5: ADVANCED FEATURES (Week 4)**

### **5.1 Module Versioning**

- ✅ Track versions per module
- ✅ Support upgrades
- ✅ Manage deprecation

### **5.2 Installation Hooks**

- ✅ Pre-install hooks
- ✅ Post-install hooks
- ✅ Pre-uninstall hooks
- ✅ Post-uninstall hooks

### **5.3 Monitoring & Analytics**

- ✅ Installation metrics
- ✅ Module usage tracking
- ✅ Error logging
- ✅ Performance monitoring

---

## **SUPERVISOR VALIDATION CHECKLIST**

**After each phase, supervisor should validate:**

### **Phase 1 Validation:**
```
Domain Layer Purity:
[ ] grep "Illuminate\|Laravel\|Spatie" returns NOTHING
[ ] All files in Domain/ are pure PHP
[ ] No framework imports found

Testing:
[ ] 105+ tests passing
[ ] 90%+ code coverage
[ ] All tests are unit (not integration)
[ ] Domain logic tested in isolation

Architecture:
[ ] All aggregates have TenantId property
[ ] All aggregates implement belongsToTenant()
[ ] All repository methods use ForTenant naming
[ ] All domain rules enforced by tests

Code Quality:
[ ] PSR-12 compliance
[ ] No magic numbers or strings
[ ] Clear, self-documenting code
[ ] Comprehensive docblocks
```

### **Phase 2 Validation:**
```
Command Handlers:
[ ] All handlers have subscription checks
[ ] All handlers respect tenant boundaries
[ ] All handlers use domain services
[ ] All handlers include comprehensive error handling

Dependency Injection:
[ ] No service locator pattern (app()->make())
[ ] All dependencies injected via constructor
[ ] Only interfaces injected (ports)

Integration Tests:
[ ] 25+ tests passing
[ ] Tests verify end-to-end workflows
[ ] Tests verify tenant isolation
[ ] Tests verify subscription enforcement
```

### **Phase 3 Validation:**
```
Database:
[ ] All tables use UUID primary keys
[ ] All tenant-scoped tables have tenant_id column
[ ] Correct indexes for performance
[ ] Constraints prevent invalid data

Adapters:
[ ] All ports have concrete implementations
[ ] Adapters wrap framework details
[ ] No framework details leak to domain

Performance:
[ ] Database queries < 100ms (p95)
[ ] No N+1 query problems
[ ] Indexes used correctly
```

### **Phase 4 Validation:**
```
API:
[ ] All endpoints documented
[ ] Proper HTTP status codes used
[ ] Error responses consistent format
[ ] Authorization enforced

E2E Tests:
[ ] 15+ tests passing
[ ] Tests verify complete workflows
[ ] Tests verify user experience
```

### **Phase 5 Validation:**
```
Production Readiness:
[ ] Monitoring in place
[ ] Logging comprehensive
[ ] Error handling graceful
[ ] Performance acceptable (sub-5s installations)
[ ] Rollback capability proven
```

---

## **KEY RULES (NON-NEGOTIABLE)**

### **Rule 1: TenantId in Every Aggregate**
```
✅ CORRECT:
class TenantModule {
    private TenantId $tenantId;
}

❌ WRONG:
class TenantModule {
    // No TenantId - FAIL
}
```

### **Rule 2: ForTenant on All Repository Methods**
```
✅ CORRECT:
public function findForTenant(ModuleId $id, TenantId $tenantId): ?TenantModule

❌ WRONG:
public function find(ModuleId $id): ?TenantModule
```

### **Rule 3: Commands Include TenantId First**
```
✅ CORRECT:
class InstallModuleCommand {
    public function __construct(
        public readonly TenantId $tenantId,  // FIRST
        public readonly ModuleId $moduleId,
    ) {}
}

❌ WRONG:
class InstallModuleCommand {
    public function __construct(
        public readonly ModuleId $moduleId,  // FIRST
        public readonly TenantId $tenantId,
    ) {}
}
```

### **Rule 4: Domain Purity (Zero Framework)**
```
✅ CORRECT:
namespace App\Contexts\ModuleRegistry\Domain\Models;
use App\Shared\Domain\TenantId;

class Module { }

❌ WRONG:
namespace App\Contexts\ModuleRegistry\Domain\Models;
use Illuminate\Database\Eloquent\Model;

class Module extends Model { }
```

### **Rule 5: Hexagonal Architecture**
```
✅ CORRECT:
// Handler depends on port
class InstallModuleHandler {
    public function __construct(
        private MigrationRunnerInterface $migrationRunner,  // PORT
    ) {}
}

❌ WRONG:
// Handler directly uses framework
class InstallModuleHandler {
    public function handle() {
        Artisan::call('migrate', ...);  // WRONG
    }
}
```

---

**Status:** ✅ PHASE-BY-PHASE GUIDE COMPLETE

This guide provides:
- Detailed tasks for each phase
- Specific test cases to write
- Acceptance criteria for validation
- Supervisor checklists
- Non-negotiable rules

Use this as your implementation roadmap. Follow TDD religiously. Success is inevitable.

