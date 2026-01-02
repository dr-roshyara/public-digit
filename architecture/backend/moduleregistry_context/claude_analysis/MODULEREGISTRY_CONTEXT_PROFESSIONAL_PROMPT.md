# **MODULEREGISTRY CONTEXT - PROFESSIONAL CLAUDE CLI PROMPT**
## **Scalable Multi-Tenant Module Management System**

**Project:** Public Digit Platform  
**Context:** ModuleRegistry (Bounded Context for module lifecycle management)  
**Approach:** DDD + TDD + Hexagonal Architecture  
**Duration:** 3-4 weeks (iterative implementation)  
**Status:** Specification complete, ready for implementation

---

## **SECTION 1: STRATEGIC CONTEXT**

### **Current Platform State**

Your multi-tenant SaaS platform currently has:
- ✅ **DigitalCard Context** - Complete with hexagonal architecture (6 ports, 97 tests)
- ✅ **Membership Context** - User/member management
- ✅ **TenantAuth Context** - Authentication & authorization
- ✅ **Subscription Context** - Plans, features, billing
- 🚀 **Finance Context** (Node.js/Microservice) - Under development
- 🚀 **MembershipForum Context** - Under development

**The Problem You're Solving:**

Currently, every tenant's database comes with **ALL modules' schemas** pre-created. This creates:
- ❌ Bloated databases for tenants who don't use certain modules
- ❌ No clear record of which modules each tenant has installed
- ❌ Difficult to add new modules without affecting all tenants
- ❌ No installation/uninstallation workflow
- ❌ Violates principle: "Tenants pay for what they use"

**The Solution: ModuleRegistry Context**

A new Bounded Context that:
- ✅ Maintains central catalog of all available modules
- ✅ Tracks which modules each tenant has installed
- ✅ Orchestrates installation/uninstallation workflows
- ✅ Validates subscriptions before installation
- ✅ Manages module dependencies
- ✅ Handles tenant-specific migrations
- ✅ Provides lifecycle hooks (pre/post install, pre/post uninstall)

---

## **SECTION 2: MODULEREGISTRY DOMAIN MODEL**

### **2.1 Core Aggregates**

#### **Aggregate 1: Module (Landlord DB)**

```
Module (Aggregate Root)
├── Attributes:
│   ├── ModuleId (VO) - UUID
│   ├── Name (VO) - string 'digital_card', 'membership_forum', 'elections'
│   ├── DisplayName - string 'Digital Cards', 'Membership Forum'
│   ├── Version (VO) - semantic versioning (1.0.0, 1.0.1, etc.)
│   ├── Description - text
│   ├── Namespace - string 'DigitalCard\\', 'MembershipForum\\'
│   ├── MigrationsPath - string for tenant migrations
│   ├── RequiresSubscription - boolean
│   ├── Dependencies (Collection[ModuleDependency]) - other modules required
│   ├── Configuration (ValueObject) - default settings
│   ├── Status - enum: ACTIVE, DEPRECATED, MAINTENANCE
│   ├── CreatedAt, UpdatedAt
│   └── PublishedAt - when released to marketplace

Domain Rules:
- Module name must be unique, lowercase, no spaces
- Version must follow semantic versioning
- Cannot deprecate if tenants are actively using it
- Dependencies must exist in catalog
- Namespace must match Laravel namespace conventions
```

#### **Aggregate 2: TenantModule (Landlord DB)**

```
TenantModule (Aggregate Root)
├── Attributes:
│   ├── TenantModuleId (VO) - UUID
│   ├── TenantId (VO) - from Shared Kernel
│   ├── ModuleId (VO) - reference to Module aggregate
│   ├── InstalledVersion (VO) - tracks which version is installed
│   ├── Status - enum: PENDING, INSTALLING, INSTALLED, FAILED, UNINSTALLING
│   ├── InstalledAt - DateTimeImmutable or null
│   ├── InstalledBy (UserId or null) - who triggered installation
│   ├── Configuration (ValueObject) - tenant-specific module config
│   ├── LastUsedAt - DateTimeImmutable or null (for analytics)
│   ├── FailureReason - string or null (if status = FAILED)
│   ├── CreatedAt, UpdatedAt
│   └── UniqueConstraint: (tenant_id, module_id)

Domain Rules:
- One installation per tenant per module
- Cannot install if subscription not valid
- Cannot uninstall while installation in progress
- Cannot install if dependencies not installed
- Configuration immutable after installation (versioned separately)
```

#### **Aggregate 3: ModuleInstallationJob (Landlord DB)**

```
ModuleInstallationJob (Aggregate Root)
├── Purpose: Audit trail and rollback capability for installations
├── Attributes:
│   ├── InstallationJobId (VO) - UUID
│   ├── TenantId (VO)
│   ├── ModuleId (VO)
│   ├── JobType - enum: INSTALL, UNINSTALL, UPGRADE
│   ├── Status - enum: PENDING, IN_PROGRESS, COMPLETED, FAILED, ROLLED_BACK
│   ├── Steps (Collection[InstallationStep]) - granular tracking
│   │   ├── Step: CREATE_INSTALLATION_RECORD (completed)
│   │   ├── Step: VALIDATE_SUBSCRIPTION (completed)
│   │   ├── Step: CHECK_DEPENDENCIES (completed)
│   │   ├── Step: CONNECT_TENANT_DB (completed)
│   │   ├── Step: RUN_MIGRATIONS (completed)
│   │   ├── Step: SEED_DATA (pending)
│   │   ├── Step: RUN_POST_INSTALL_HOOKS (pending)
│   │   └── Step: UPDATE_INSTALLATION_RECORD (pending)
│   ├── StartedAt, CompletedAt
│   ├── ErrorMessage (null unless failed)
│   ├── RolledBackAt (null unless rolled back)
│   ├── RollbackReason (string or null)
│   └── CreatedAt, UpdatedAt

Domain Rules:
- Cannot have multiple concurrent jobs for same (tenant, module) pair
- Must create before starting installation
- Each step must be idempotent (can retry without side effects)
- Rollback must restore previous state
```

### **2.2 Value Objects**

```php
// All in Domain\ValueObjects

ModuleId extends ValueObject {
    - private string $id (UUID)
    - static generate(): self
}

ModuleName extends ValueObject {
    - private string $value (lowercase, no spaces)
    - Validation: regex, uniqueness check
}

ModuleVersion extends ValueObject {
    - private string $version (semantic: 1.0.0)
    - Methods: major(), minor(), patch(), isGreaterThan()
}

ModuleDependency extends ValueObject {
    - private ModuleName $moduleName
    - private string $versionConstraint ('1.0', '^1.0', '>=1.0', etc.)
    - Method: satisfiedBy(ModuleVersion $version): bool
}

ModuleStatus extends Enum {
    - ACTIVE = 'active'
    - DEPRECATED = 'deprecated'
    - MAINTENANCE = 'maintenance'
    - ARCHIVED = 'archived'
}

ModuleConfiguration extends ValueObject {
    - private array $settings (JSON)
    - Methods: get(string $key, $default), set(string $key, $value)
}

InstallationStatus extends Enum {
    - PENDING = 'pending'
    - INSTALLING = 'installing'
    - INSTALLED = 'installed'
    - FAILED = 'failed'
    - UNINSTALLING = 'uninstalling'
}
```

### **2.3 Domain Services**

```php
// Domain\Services

DependencyResolver {
    - resolveDependencies(Module $module, TenantId $tenantId): ModuleDependency[]
    - validateDependencies(Module $module, InstalledModules $installed): ValidationResult
    - Methods: checkCircularDependencies(), validateVersionConstraints()
    - Returns: list of dependencies in installation order
}

SubscriptionValidator {
    - canInstall(TenantId $tenantId, Module $module): bool
    - canUninstall(TenantId $tenantId, Module $module): bool
    - getRequiredPlanForModule(Module $module): Plan|null
    - Methods: checkQuota(), checkFeatureAccess(), validateLicensing()
}

ModuleInstallationOrchestrator {
    - plan(Module $module, TenantId $tenantId): InstallationPlan
    - validate(InstallationPlan $plan): ValidationResult
    - Methods: checkDiskSpace(), verifyDatabaseAccess(), validatePermissions()
}
```

### **2.4 Domain Events**

```php
// Domain\Events

ModuleInstallationStarted {
    - tenantId: TenantId
    - moduleId: ModuleId
    - version: ModuleVersion
    - installationJobId: InstallationJobId
    - timestamp: DateTimeImmutable
}

ModuleInstallationCompleted {
    - tenantId: TenantId
    - moduleId: ModuleId
    - version: ModuleVersion
    - duration: int (seconds)
    - timestamp: DateTimeImmutable
}

ModuleInstallationFailed {
    - tenantId: TenantId
    - moduleId: ModuleId
    - failureReason: string
    - failedAtStep: string
    - timestamp: DateTimeImmutable
}

ModuleUninstallationStarted {
    - tenantId: TenantId
    - moduleId: ModuleId
    - preserveData: bool
    - timestamp: DateTimeImmutable
}

ModuleUninstallationCompleted {
    - tenantId: TenantId
    - moduleId: ModuleId
    - dataPreserved: bool
    - timestamp: DateTimeImmutable
}

ModuleVersionDeprecated {
    - moduleId: ModuleId
    - version: ModuleVersion
    - replacementVersion: ModuleVersion|null
    - deprecationDate: DateTimeImmutable
}
```

### **2.5 Repository Interfaces (Domain Layer)**

```php
// Domain\Repositories

interface ModuleRepository {
    public function save(Module $module): void;
    public function findById(ModuleId $id): ?Module;
    public function findByName(ModuleName $name): ?Module;
    public function all(): Collection[Module];
    public function activeModules(): Collection[Module];
    public function findDependencies(Module $module): Collection[Module];
}

interface TenantModuleRepository {
    // ✅ ALL METHODS INCLUDE TENANT ID (Rule #2)
    public function saveForTenant(TenantModule $tenantModule, TenantId $tenantId): void;
    public function findForTenant(TenantId $tenantId, ModuleId $moduleId): ?TenantModule;
    public function installedForTenant(TenantId $tenantId): Collection[TenantModule];
    public function isInstalledForTenant(TenantId $tenantId, ModuleId $moduleId): bool;
    public function findInstalledVersionForTenant(TenantId $tenantId, ModuleId $moduleId): ?ModuleVersion;
    public function removeForTenant(TenantId $tenantId, ModuleId $moduleId): void;
}

interface ModuleInstallationJobRepository {
    public function save(ModuleInstallationJob $job): void;
    public function findForTenant(TenantId $tenantId, ModuleId $moduleId): ?ModuleInstallationJob;
    public function findInProgressForTenant(TenantId $tenantId): Collection[ModuleInstallationJob];
    public function findLastJobForModule(TenantId $tenantId, ModuleId $moduleId): ?ModuleInstallationJob;
}
```

---

## **SECTION 3: APPLICATION LAYER**

### **3.1 Commands**

```php
// Application\Commands

InstallModuleCommand {
    public readonly TenantId $tenantId,           // Rule #3: TenantId first
    public readonly ModuleId $moduleId,
    public readonly string|null $installedBy,     // Who triggered installation
    public readonly array $configuration = []      // Tenant-specific config
}

UninstallModuleCommand {
    public readonly TenantId $tenantId,
    public readonly ModuleId $moduleId,
    public readonly bool $preserveData = false,
    public readonly string|null $reason = null
}

UpgradeModuleCommand {
    public readonly TenantId $tenantId,
    public readonly ModuleId $moduleId,
    public readonly ModuleVersion $targetVersion,
    public readonly bool $rollbackOnFailure = true
}

RegisterModuleCommand {
    public readonly ModuleName $name,
    public readonly string $displayName,
    public readonly ModuleVersion $version,
    public readonly string $namespace,
    public readonly bool $requiresSubscription
}

DeprecateModuleVersionCommand {
    public readonly ModuleId $moduleId,
    public readonly ModuleVersion $version,
    public readonly ModuleVersion|null $replacementVersion
}
```

### **3.2 Command Handlers**

```php
// Application\Handlers

InstallModuleHandler {
    Dependencies:
    - ModuleRepository
    - TenantModuleRepository
    - ModuleInstallationJobRepository
    - SubscriptionValidator (Domain Service)
    - DependencyResolver (Domain Service)
    - TenantConnectionManager (Port)
    - MigrationRunner (Port)
    - EventPublisher (Port)
    - ModuleInstaller (Application Service)

    Process:
    1. Load Module aggregate from ModuleRepository
    2. Validate module exists and is active
    3. Use SubscriptionValidator to check tenant has subscription
    4. Create ModuleInstallationJob entity
    5. Use DependencyResolver to check all dependencies are installed
    6. Save job as PENDING
    7. Delegate to ModuleInstaller service
    8. ModuleInstaller orchestrates: migrations → hooks → seeds
    9. Handle success/failure
    10. Publish ModuleInstallationCompleted or ModuleInstallationFailed event
    
    Error Handling:
    - Throw SubscriptionRequiredException if not subscribed
    - Throw MissingDependenciesException if dependencies missing
    - Throw ModuleAlreadyInstalledException if already installed
    - Roll back on any failure (idempotent migrations help)
}

UninstallModuleHandler {
    Similar pattern to InstallModuleHandler but:
    - Check module is installed
    - Run pre-uninstall hooks
    - Drop tables OR archive data
    - Emit ModuleUninstallationCompleted event
}
```

### **3.3 Application Services**

```php
// Application\Services

class ModuleInstaller {
    - Orchestrates the actual installation process
    - Coordinates with infrastructure ports
    - Runs each step of InstallationJob
    - Handles rollback on failure
    - Each step must be idempotent
    
    Private methods:
    - runMigrations($tenantConnection, Module $module)
    - seedData(Module $module, TenantId $tenantId)
    - runPostInstallHooks(Module $module, TenantId $tenantId)
    - rollback(ModuleInstallationJob $job)
}

class ModuleVersionManager {
    - Handle semantic versioning
    - Track version history
    - Manage deprecation timeline
    - Coordinate upgrades
    
    Methods:
    - releaseVersion(Module $module, ModuleVersion $version)
    - deprecateVersion(Module $module, ModuleVersion $version)
    - findCompatibleVersions(Module $module, VersionConstraint $constraint)
}

class ModuleDiscoveryService {
    - Scan codebase for available modules
    - Detect module manifests
    - Auto-register modules
    
    Methods:
    - discoverModules(): Collection[Module]
    - registerDiscoveredModules()
}
```

---

## **SECTION 4: INFRASTRUCTURE LAYER**

### **4.1 Database Schema**

```sql
-- LANDLORD DB ONLY (Shared across all tenants)

CREATE TABLE modules (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    namespace VARCHAR(255) NOT NULL,
    migrations_path VARCHAR(500),
    requires_subscription BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active',  -- active, deprecated, maintenance, archived
    configuration JSONB DEFAULT '{}',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_modules_status (status)
);

CREATE TABLE module_dependencies (
    id UUID PRIMARY KEY,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    depends_on_module_id UUID NOT NULL REFERENCES modules(id),
    version_constraint VARCHAR(50) NOT NULL,  -- '1.0', '^1.0', '>=1.0', etc.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module_id, depends_on_module_id),
    INDEX idx_module_deps (module_id)
);

CREATE TABLE tenant_modules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id),
    installed_version VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'installed',  -- pending, installing, installed, failed, uninstalling
    configuration JSONB DEFAULT '{}',
    installed_at TIMESTAMPTZ,
    installed_by UUID,  -- user_id
    last_used_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, module_id),
    INDEX idx_tenant_modules_tenant (tenant_id),
    INDEX idx_tenant_modules_status (status)
);

CREATE TABLE module_installation_jobs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    module_id UUID NOT NULL REFERENCES modules(id),
    job_type VARCHAR(50) NOT NULL,  -- install, uninstall, upgrade
    status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, failed, rolled_back
    steps JSONB NOT NULL DEFAULT '[]',  -- Array of step objects with status
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    rolled_back_at TIMESTAMPTZ,
    rollback_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_installation_jobs_status (status),
    INDEX idx_installation_jobs_tenant (tenant_id, module_id)
);

CREATE TABLE module_version_history (
    id UUID PRIMARY KEY,
    module_id UUID NOT NULL REFERENCES modules(id),
    version VARCHAR(20) NOT NULL,
    released_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,
    replacement_version VARCHAR(20),
    release_notes TEXT,
    created_at TIMESTAMPTZ,
    UNIQUE(module_id, version),
    INDEX idx_version_history_module (module_id)
);

-- NO TENANT-SPECIFIC TABLES (modules managed centrally)
```

### **4.2 Ports (Hexagonal Architecture)**

```php
// Infrastructure\Ports

interface TenantConnectionManagerInterface {
    // Connect to specific tenant's database
    public function connectionForTenant(TenantId $tenantId): Connection;
    public function switchToTenant(TenantId $tenantId): void;
    public function switchToLandlord(): void;
}

interface MigrationRunnerInterface {
    // Run module-specific migrations in tenant DB
    public function runMigrationsForModule(
        Connection $tenantConnection,
        Module $module,
        TenantId $tenantId
    ): void;
    
    public function rollbackMigrationsForModule(
        Connection $tenantConnection,
        Module $module,
        TenantId $tenantId
    ): void;
}

interface ModuleHookRunnerInterface {
    // Run pre/post install/uninstall hooks
    public function runPostInstallHook(Module $module, TenantId $tenantId): void;
    public function runPreUninstallHook(Module $module, TenantId $tenantId): void;
}

interface ModuleDiscoveryInterface {
    // Scan filesystem for modules
    public function discoverModules(): Collection[ModuleDefinition];
}

interface EventPublisherInterface {
    // Publish domain events
    public function publish(object $event): void;
}

interface SubscriptionServiceInterface {
    // Check subscription status (communicates with Subscription Context)
    public function hasSubscriptionForModule(TenantId $tenantId, Module $module): bool;
    public function getSubscriptionQuota(TenantId $tenantId, Module $module): ?int;
}
```

### **4.3 Adapters (Framework-Specific)**

```php
// Infrastructure\Adapters

class EloquentModuleRepository implements ModuleRepository {
    // Maps Eloquent\ModuleModel ↔ Domain\Module aggregate
}

class EloquentTenantModuleRepository implements TenantModuleRepository {
    // Maps Eloquent\TenantModuleModel ↔ Domain\TenantModule aggregate
    // All methods scoped to tenant_id (Rule #2, #14)
}

class SpatieTenantConnectionManager implements TenantConnectionManagerInterface {
    // Wraps Spatie\Multitenancy for tenant database switching
}

class LaravelMigrationRunner implements MigrationRunnerInterface {
    // Uses Laravel\Artisan to run migrations in tenant DB
}

class LaravelModuleHookRunner implements ModuleHookRunnerInterface {
    // Loads and executes hook classes from modules
}

class FilesystemModuleDiscovery implements ModuleDiscoveryInterface {
    // Scans app/Contexts/*/module.json files
}

class LaravelEventPublisher implements EventPublisherInterface {
    // Publishes events via Laravel's event() dispatcher
}

class SubscriptionContextAdapter implements SubscriptionServiceInterface {
    // Communicates with Subscription Context via:
    // - HTTP API calls (if separate service)
    // - Or direct service calls (if same application)
}
```

### **4.4 Service Provider**

```php
// Providers\ModuleRegistryServiceProvider

class ModuleRegistryServiceProvider extends ServiceProvider {
    public function register(): void {
        // Domain Services
        $this->app->singleton(DependencyResolver::class);
        $this->app->singleton(SubscriptionValidator::class);
        
        // Application Services
        $this->app->singleton(ModuleInstaller::class);
        $this->app->singleton(ModuleVersionManager::class);
        
        // Repositories
        $this->app->bind(ModuleRepository::class, EloquentModuleRepository::class);
        $this->app->bind(TenantModuleRepository::class, EloquentTenantModuleRepository::class);
        $this->app->bind(ModuleInstallationJobRepository::class, EloquentInstallationJobRepository::class);
        
        // Ports
        $this->app->bind(TenantConnectionManagerInterface::class, SpatieTenantConnectionManager::class);
        $this->app->bind(MigrationRunnerInterface::class, LaravelMigrationRunner::class);
        $this->app->bind(ModuleHookRunnerInterface::class, LaravelModuleHookRunner::class);
        $this->app->bind(ModuleDiscoveryInterface::class, FilesystemModuleDiscovery::class);
        $this->app->bind(EventPublisherInterface::class, LaravelEventPublisher::class);
        $this->app->bind(SubscriptionServiceInterface::class, SubscriptionContextAdapter::class);
        
        // Command bus registration
        $this->app->make(CommandBus::class)->register([
            InstallModuleCommand::class => InstallModuleHandler::class,
            UninstallModuleCommand::class => UninstallModuleHandler::class,
            UpgradeModuleCommand::class => UpgradeModuleHandler::class,
            RegisterModuleCommand::class => RegisterModuleHandler::class,
        ]);
    }
    
    public function boot(): void {
        $this->autoDiscoverAndRegisterModules();
    }
}
```

---

## **SECTION 5: API LAYER & HTTP INTEGRATION**

### **5.1 Controllers**

```php
// Http\Controllers\ModuleController

class ModuleController extends Controller {
    public function __construct(
        private CommandBus $commandBus,
        private ModuleRepository $moduleRepository,
        private TenantModuleRepository $tenantModuleRepository,
    ) {}
    
    // GET /tenant/{tenant}/api/v1/modules - List available modules
    public function index(Request $request): JsonResponse {
        $tenantId = new TenantId($request->route('tenant'));
        
        $availableModules = $this->moduleRepository->activeModules();
        $installedModules = $this->tenantModuleRepository->installedForTenant($tenantId);
        
        return response()->json([
            'available' => $availableModules,
            'installed' => $installedModules,
        ]);
    }
    
    // POST /tenant/{tenant}/api/v1/modules/{module}/install
    public function install(Request $request, string $module): JsonResponse {
        $this->authorize('manage-modules');
        
        $tenantId = new TenantId($request->route('tenant'));
        $moduleId = ModuleId::fromString($module);
        
        $command = new InstallModuleCommand(
            tenantId: $tenantId,
            moduleId: $moduleId,
            installedBy: auth()->user()->id,
            configuration: $request->input('configuration', [])
        );
        
        try {
            $this->commandBus->handle($command);
            return response()->json(['message' => 'Installation started'], 202);
        } catch (SubscriptionRequiredException $e) {
            return response()->json(['error' => 'Subscription required'], 402);
        } catch (MissingDependenciesException $e) {
            return response()->json(['error' => 'Missing dependencies: ' . $e->getMessage()], 422);
        }
    }
    
    // DELETE /tenant/{tenant}/api/v1/modules/{module}
    public function uninstall(Request $request, string $module): JsonResponse {
        $this->authorize('manage-modules');
        
        $tenantId = new TenantId($request->route('tenant'));
        $moduleId = ModuleId::fromString($module);
        
        $command = new UninstallModuleCommand(
            tenantId: $tenantId,
            moduleId: $moduleId,
            preserveData: $request->input('preserve_data', false)
        );
        
        $this->commandBus->handle($command);
        return response()->json(['message' => 'Uninstallation started'], 202);
    }
}
```

### **5.2 Routes**

```php
// routes/api.php

Route::middleware(['auth:sanctum', 'tenant'])->prefix('/{tenant}/api/v1')->group(function () {
    // Module management
    Route::get('/modules', [ModuleController::class, 'index']);
    Route::post('/modules/{module}/install', [ModuleController::class, 'install']);
    Route::delete('/modules/{module}', [ModuleController::class, 'uninstall']);
    Route::get('/modules/{module}/status', [ModuleController::class, 'status']);
    Route::get('/modules/{module}/installation-job', [ModuleController::class, 'getInstallationJob']);
});
```

---

## **SECTION 6: TESTING STRATEGY**

### **6.1 Unit Tests (Domain Layer)**

```php
// tests/Unit/Contexts/ModuleRegistry/Domain/

class ModuleTest extends TestCase {
    public function test_module_cannot_be_created_without_name() { ... }
    public function test_module_name_must_be_unique() { ... }
    public function test_module_version_must_be_semantic() { ... }
    public function test_dependencies_cannot_have_circular_references() { ... }
}

class TenantModuleTest extends TestCase {
    public function test_one_installation_per_tenant_per_module() { ... }
    public function test_tenant_module_respects_tenant_boundaries() { ... }
    public function test_cannot_mark_installed_before_job_completes() { ... }
}

class DependencyResolverTest extends TestCase {
    public function test_resolves_dependencies_in_correct_order() { ... }
    public function test_detects_missing_dependencies() { ... }
    public function test_detects_circular_dependencies() { ... }
    public function test_validates_version_constraints() { ... }
}
```

### **6.2 Integration Tests (Command Handlers)**

```php
// tests/Feature/Contexts/ModuleRegistry/

class InstallModuleTest extends TestCase {
    public function test_tenant_can_install_module_with_subscription() {
        // Given: Tenant with subscription, module available
        $tenant = Tenant::factory()->create();
        $this->grantSubscription($tenant, 'digital_card');
        
        $module = $this->createModule('digital_card');
        
        // When: Install command executed
        $command = new InstallModuleCommand(
            tenantId: $tenant->getTenantId(),
            moduleId: $module->id(),
            installedBy: auth()->user()->id
        );
        
        $this->commandBus->handle($command);
        
        // Then: Module installed
        $this->assertTrue($this->tenantModuleRepository->isInstalledForTenant(
            $tenant->getTenantId(),
            $module->id()
        ));
        
        // And: Installation job completed
        $job = $this->getLastInstallationJob($tenant, $module);
        $this->assertEquals('completed', $job->status());
        
        // And: Event published
        $this->eventPublisher->shouldHavePublished(ModuleInstallationCompleted::class);
    }
    
    public function test_cannot_install_without_subscription() {
        // Given: Tenant without subscription
        $tenant = Tenant::factory()->create();
        $module = $this->createModule('digital_card', requiresSubscription: true);
        
        // When/Then: Installation fails
        $this->expectException(SubscriptionRequiredException::class);
        
        $command = new InstallModuleCommand(
            tenantId: $tenant->getTenantId(),
            moduleId: $module->id()
        );
        
        $this->commandBus->handle($command);
    }
    
    public function test_installation_fails_if_dependencies_missing() {
        // Given: Module with dependencies
        $tenant = Tenant::factory()->create();
        $this->grantSubscription($tenant, 'membership_forum');
        
        $membershipModule = $this->createModule('membership');
        $forumModule = $this->createModule('membership_forum')
            ->dependsOn($membershipModule, '^1.0');
        
        // When: Try to install forum without membership
        // Then: Fails with MissingDependenciesException
        $this->expectException(MissingDependenciesException::class);
        
        $command = new InstallModuleCommand(
            tenantId: $tenant->getTenantId(),
            moduleId: $forumModule->id()
        );
        
        $this->commandBus->handle($command);
    }
}
```

### **6.3 End-to-End Tests**

```php
// tests/Feature/ModuleInstallationWorkflow.php

class ModuleInstallationWorkflowTest extends TestCase {
    public function test_complete_installation_workflow() {
        // 1. Tenant subscribes to module
        // 2. Visits module marketplace
        // 3. Clicks install
        // 4. System validates subscription
        // 5. Creates installation job
        // 6. Runs migrations in tenant DB
        // 7. Seeds default data
        // 8. Runs post-install hooks
        // 9. Returns success
        // 10. Tenant can now use module features
    }
    
    public function test_rollback_on_installation_failure() {
        // If any step fails:
        // 1. Mark job as FAILED
        // 2. Drop created tables
        // 3. Publish ModuleInstallationFailed event
        // 4. Update TenantModule status to FAILED
    }
    
    public function test_uninstall_with_data_preservation() {
        // 1. Install module
        // 2. Create data in module tables
        // 3. Uninstall with preserve_data=true
        // 4. Verify tables archived/backed up
        // 5. Verify TenantModule marked as uninstalled
    }
}
```

---

## **SECTION 7: IMPLEMENTATION PHASES**

### **Phase 1: Core Module Registry (Week 1)**
- [ ] Domain layer complete (Module, TenantModule, ModuleInstallationJob)
- [ ] All aggregates, VOs, events defined
- [ ] Repository interfaces defined
- [ ] Unit tests passing (70+)
- [ ] Database migrations (landlord DB only)

### **Phase 2: Installation Service (Week 2)**
- [ ] ModuleInstaller application service
- [ ] DependencyResolver domain service
- [ ] SubscriptionValidator domain service
- [ ] TenantConnectionManager port
- [ ] MigrationRunner port
- [ ] Integration tests (20+)

### **Phase 3: API & Controllers (Week 2-3)**
- [ ] ModuleController endpoints
- [ ] Error handling & validation
- [ ] Authorization (Policies)
- [ ] API documentation
- [ ] E2E tests (15+)

### **Phase 4: Module Discovery & Auto-Registration (Week 3)**
- [ ] ModuleDiscoveryService
- [ ] Module manifest scanning (module.json)
- [ ] Auto-registration in service provider
- [ ] Support for 3rd-party modules

### **Phase 5: Advanced Features (Week 4)**
- [ ] Module versioning & upgrades
- [ ] Deprecation management
- [ ] Installation hooks (pre/post)
- [ ] Rollback capability
- [ ] Analytics & monitoring

---

## **SECTION 8: ARCHITECTURAL CONSTRAINTS (GOLDEN RULES)**

### **Rule 1: TenantId in Every Aggregate**
```php
// Every aggregate MUST have TenantId
class Module extends AggregateRoot {
    // ModuleRegistry context - modules are NOT tenant-specific
    // Lives in landlord DB, shared across all tenants
}

class TenantModule extends AggregateRoot {
    private TenantId $tenantId;  // ✅ REQUIRED
}

class ModuleInstallationJob extends AggregateRoot {
    private TenantId $tenantId;  // ✅ REQUIRED
}
```

### **Rule 2: Repository ForTenant Methods**
```php
interface TenantModuleRepository {
    public function findForTenant(ModuleId $id, TenantId $tenantId): ?TenantModule;
    public function saveForTenant(TenantModule $m, TenantId $tenantId): void;
    // ✅ ALL methods include TenantId parameter
}
```

### **Rule 3: Commands Include TenantId**
```php
class InstallModuleCommand {
    public function __construct(
        public readonly TenantId $tenantId,  // ✅ FIRST PARAMETER
        public readonly ModuleId $moduleId,
        // ...
    ) {}
}
```

### **Rule 4: Domain Purity**
```php
// Domain layer = zero Laravel imports
// No Illuminate\*, no tenancy packages
// Pure PHP business logic only
```

### **Rule 5: Hexagonal Architecture**
```php
// Domain & Application depend on Ports (interfaces)
// Ports implemented by Adapters
// Infrastructure handles framework details
```

---

## **SECTION 9: KEY SUCCESS METRICS**

- ✅ All 15 golden rules enforced
- ✅ 100+ unit tests passing
- ✅ 20+ integration tests passing
- ✅ 15+ E2E tests passing
- ✅ 90%+ code coverage
- ✅ Zero framework imports in Domain layer
- ✅ All hexagonal ports implemented & tested
- ✅ Installation/uninstallation <5 seconds
- ✅ Dependency resolution <100ms
- ✅ Module discovery <200ms

---

## **NEXT STEPS**

1. **Start with Section 2:** Implement domain models
2. **Write tests first:** TDD approach (RED → GREEN → REFACTOR)
3. **Build repositories:** Implement persistence layer
4. **Create service provider:** Wire up dependencies
5. **Build API layer:** Controllers & routes
6. **Iterate:** Refine based on testing

---

**Status:** ✅ SPECIFICATION COMPLETE - READY FOR IMPLEMENTATION

This ModuleRegistry Context is designed to scale from 10 to 10,000+ tenants with hundreds of possible module combinations, while maintaining clear tenant boundaries and architectural purity.

Begin with Domain layer. Follow TDD workflow. Keep Domain layer pure (zero framework dependencies).

**Let's build a scalable, maintainable module system.** 🚀

