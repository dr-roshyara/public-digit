# ModuleRegistry Context - Implementation Roadmap

**Created:** 2025-12-28 03:35
**Status:** Phase 1 Complete ✅, Phases 2-4 Planned
**Timeline:** 4 weeks total

---

## Overview

This roadmap outlines the complete implementation of the ModuleRegistry bounded context for our multi-tenant SaaS platform. The context manages module catalog, tenant installations, dependencies, and subscriptions.

---

## Phase 1: Domain Layer ✅ COMPLETE

**Duration:** Week 1
**Status:** ✅ **COMPLETE**
**Completion Date:** 2025-12-28
**Tests:** 108 tests, 299 assertions
**Coverage:** ~95% (estimated)

### Completed Deliverables

- ✅ 5 Value Objects (46 tests)
- ✅ 3 Aggregates (38 tests)
- ✅ 2 Domain Services (24 tests)
- ✅ 7 Domain Exceptions
- ✅ 5 Domain Events
- ✅ 1 Port Interface
- ✅ Zero framework imports (100% pure PHP)
- ✅ Developer guide created

### Key Achievements

1. **Hexagonal Architecture** - Complete domain isolation
2. **Golden Rule #1 Compliance** - All tenant aggregates validated
3. **Idempotent Operations** - Retry-safe step execution
4. **TDD Discipline** - All code test-first
5. **DFS Algorithm** - Efficient dependency resolution

---

## Phase 2: Application Layer 📋 PLANNED

**Duration:** Week 2 (5 working days)
**Status:** 📋 Not Started
**Estimated Tests:** 60+ tests
**Target Coverage:** 90%+

### Objectives

Build the **orchestration layer** that coordinates domain logic, enforces workflows, and provides use case implementations.

### 2.1 Application Services (3 days)

**Purpose:** Orchestrate domain operations, handle cross-aggregate workflows

#### ModuleRegistrationService
```php
app/Contexts/ModuleRegistry/Application/Services/ModuleRegistrationService.php
```

**Responsibilities:**
- Register new modules in catalog
- Validate module metadata
- Publish registration events
- Update module versions

**Methods:**
- `registerModule(RegisterModuleCommand): ModuleId`
- `updateModuleVersion(UpdateVersionCommand): void`
- `publishModule(PublishModuleCommand): void`
- `deprecateModule(DeprecateModuleCommand): void`

**Tests:** 12 tests

---

#### ModuleInstallationService
```php
app/Contexts/ModuleRegistry/Application/Services/ModuleInstallationService.php
```

**Responsibilities:**
- Install modules for tenants
- Validate subscriptions and dependencies
- Create installation jobs
- Handle installation workflow

**Methods:**
- `installForTenant(InstallModuleCommand): TenantModuleId`
- `uninstallForTenant(UninstallModuleCommand): void`
- `upgradeForTenant(UpgradeModuleCommand): void`

**Workflow:**
1. Validate subscription (SubscriptionValidator)
2. Validate dependencies (DependencyResolver)
3. Create installation job
4. Execute installation steps
5. Mark TenantModule as installed
6. Publish events

**Tests:** 15 tests

---

#### ModuleInstallationJobService
```php
app/Contexts/ModuleRegistry/Application/Services/ModuleInstallationJobService.php
```

**Responsibilities:**
- Manage job lifecycle
- Execute job steps
- Handle failures and rollbacks
- Track job progress

**Methods:**
- `startJob(StartJobCommand): void`
- `recordStepCompletion(RecordStepCommand): void`
- `completeJob(CompleteJobCommand): void`
- `failJob(FailJobCommand): void`
- `rollbackJob(RollbackJobCommand): void`

**Tests:** 10 tests

---

#### ModuleQueryService (Read Model)
```php
app/Contexts/ModuleRegistry/Application/Services/ModuleQueryService.php
```

**Responsibilities:**
- Query module catalog
- Get tenant installations
- Get installation jobs
- Generate reports

**Methods:**
- `findModuleById(ModuleId): ModuleDTO`
- `findModuleByName(ModuleName): ModuleDTO`
- `listAvailableModules(): ModuleDTO[]`
- `listTenantModules(TenantId): TenantModuleDTO[]`
- `getInstallationJob(JobId): InstallationJobDTO`

**Tests:** 8 tests

---

### 2.2 Commands (CQRS Write Side) (1 day)

**Location:** `app/Contexts/ModuleRegistry/Application/Commands/`

#### Module Commands
```php
RegisterModuleCommand.php          // Register new module
UpdateModuleVersionCommand.php     // Update module version
PublishModuleCommand.php           // Publish module
DeprecateModuleCommand.php         // Deprecate module
```

#### Installation Commands
```php
InstallModuleCommand.php           // Install module for tenant
UninstallModuleCommand.php         // Uninstall module
UpgradeModuleCommand.php           // Upgrade module version
```

#### Job Commands
```php
StartInstallationJobCommand.php    // Start installation job
RecordStepCompletionCommand.php    // Record step completion
CompleteJobCommand.php             // Complete job
FailJobCommand.php                 // Fail job with reason
RollbackJobCommand.php             // Rollback job
```

**Characteristics:**
- ✅ Immutable (readonly properties)
- ✅ Validation in constructor
- ✅ No business logic
- ✅ Simple DTOs for data transfer

**Tests:** 15 tests (validation tests)

---

### 2.3 DTOs (Data Transfer Objects) (1 day)

**Location:** `app/Contexts/ModuleRegistry/Application/DTOs/`

```php
ModuleDTO.php                      // Module read model
TenantModuleDTO.php                // Tenant installation read model
InstallationJobDTO.php             // Job read model
ModuleDependencyDTO.php            // Dependency read model
```

**Purpose:**
- Transfer data between layers
- API response payloads
- No domain logic
- Serializable to JSON

**Example:**
```php
final readonly class ModuleDTO
{
    public function __construct(
        public string $id,
        public string $name,
        public string $displayName,
        public string $version,
        public string $description,
        public bool $requiresSubscription,
        public string $status,
        public array $dependencies,
        public ?string $publishedAt
    ) {}

    public static function fromAggregate(Module $module): self
    {
        return new self(
            $module->id()->toString(),
            $module->name()->toString(),
            $module->displayName(),
            $module->version()->toString(),
            $module->description(),
            $module->requiresSubscription(),
            $module->status()->value,
            array_map(
                fn($dep) => $dep->toString(),
                $module->dependencies()
            ),
            $module->publishedAt()?->format('Y-m-d H:i:s')
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
            'requires_subscription' => $this->requiresSubscription,
            'status' => $this->status,
            'dependencies' => $this->dependencies,
            'published_at' => $this->publishedAt
        ];
    }
}
```

**Tests:** 8 tests (mapping tests)

---

### 2.4 Validators (Application-Level) (0.5 days)

**Location:** `app/Contexts/ModuleRegistry/Application/Validators/`

```php
ModuleRegistrationValidator.php    // Validate registration data
InstallationRequestValidator.php   // Validate installation requests
```

**Purpose:**
- Application-level validation (not domain)
- Check data format, completeness
- Validate against application rules

**Tests:** 6 tests

---

### 2.5 Exceptions (Application-Level) (0.5 days)

**Location:** `app/Contexts/ModuleRegistry/Application/Exceptions/`

```php
ModuleAlreadyExistsException.php           // Duplicate module
ModuleNotFoundException.php                // Module not found
TenantModuleNotFoundException.php          // Tenant module not found
InstallationJobNotFoundException.php       // Job not found
InvalidCommandException.php                // Invalid command data
```

**Tests:** 5 tests

---

### Phase 2 Deliverables Summary

| Component | Files | Tests | Coverage |
|-----------|-------|-------|----------|
| Application Services | 4 | 45 | 90%+ |
| Commands | 11 | 15 | 100% |
| DTOs | 4 | 8 | 100% |
| Validators | 2 | 6 | 90%+ |
| Exceptions | 5 | 5 | 100% |
| **TOTAL** | **26** | **79** | **90%+** |

---

## Phase 3: Infrastructure Layer 🔧 PLANNED

**Duration:** Week 3 (5 working days)
**Status:** 📋 Not Started
**Estimated Tests:** 50+ integration tests
**Target Coverage:** 85%+

### Objectives

Implement **framework-specific adapters** for persistence, events, and external services.

### 3.1 Eloquent Repositories (2 days)

**Location:** `app/Contexts/ModuleRegistry/Infrastructure/Persistence/`

#### ModuleRepository
```php
app/Contexts/ModuleRegistry/Infrastructure/Persistence/ModuleRepository.php
```

**Implements:** `ModuleRepositoryInterface` (domain port)

**Responsibilities:**
- Save/update modules
- Find modules by ID/name
- List all modules
- Map Eloquent models ↔ Domain aggregates

**Methods:**
- `save(Module): void`
- `findById(ModuleId): ?Module`
- `findByName(ModuleName): ?Module`
- `listAll(): Module[]`
- `delete(ModuleId): void`

**Tests:** 12 integration tests (with database)

---

#### TenantModuleRepository
```php
app/Contexts/ModuleRegistry/Infrastructure/Persistence/TenantModuleRepository.php
```

**Implements:** `TenantModuleRepositoryInterface` (domain port)

**Responsibilities:**
- Save tenant modules
- Find by tenant ID
- List tenant installations
- Map Eloquent ↔ Domain

**Methods:**
- `save(TenantModule): void`
- `findById(TenantModuleId): ?TenantModule`
- `findByTenant(TenantId): TenantModule[]`
- `findByTenantAndModule(TenantId, ModuleId): ?TenantModule`

**Tests:** 10 integration tests

---

#### InstallationJobRepository
```php
app/Contexts/ModuleRegistry/Infrastructure/Persistence/InstallationJobRepository.php
```

**Implements:** `InstallationJobRepositoryInterface` (domain port)

**Methods:**
- `save(ModuleInstallationJob): void`
- `findById(JobId): ?ModuleInstallationJob`
- `findByTenant(TenantId): ModuleInstallationJob[]`
- `findPendingJobs(): ModuleInstallationJob[]`

**Tests:** 8 integration tests

---

### 3.2 Eloquent Models (1 day)

**Location:** `app/Contexts/ModuleRegistry/Infrastructure/Persistence/Models/`

```php
ModuleModel.php                    // modules table
TenantModuleModel.php              // tenant_modules table
InstallationJobModel.php           // installation_jobs table
InstallationStepModel.php          // installation_steps table
ModuleDependencyModel.php          // module_dependencies table
```

**Characteristics:**
- Standard Laravel Eloquent models
- Relationships defined
- Casts for JSON fields
- Soft deletes where appropriate

**Tests:** N/A (tested via repositories)

---

### 3.3 Database Migrations (1 day)

**Location:** `app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations/`

#### modules table
```php
2025_12_28_000001_create_modules_table.php
```

**Schema:**
```sql
CREATE TABLE modules (
    id UUID PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    namespace VARCHAR(255) NOT NULL,
    migrations_path VARCHAR(255) NOT NULL,
    requires_subscription BOOLEAN DEFAULT FALSE,
    configuration JSON,
    status VARCHAR(20) DEFAULT 'active',
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_modules_name ON modules(name);
CREATE INDEX idx_modules_status ON modules(status);
```

---

#### tenant_modules table
```php
2025_12_28_000002_create_tenant_modules_table.php
```

**Schema:**
```sql
CREATE TABLE tenant_modules (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    module_id UUID NOT NULL,
    installed_version VARCHAR(20) NOT NULL,
    configuration JSON,
    status VARCHAR(20) DEFAULT 'pending',
    installed_by VARCHAR(255) NULL,
    installed_at TIMESTAMP NULL,
    failure_reason TEXT NULL,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, module_id)
);

CREATE INDEX idx_tenant_modules_tenant ON tenant_modules(tenant_id);
CREATE INDEX idx_tenant_modules_status ON tenant_modules(status);
```

---

#### installation_jobs table
```php
2025_12_28_000003_create_installation_jobs_table.php
```

**Schema:**
```sql
CREATE TABLE installation_jobs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    module_id UUID NOT NULL,
    job_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    started_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    failed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    rollback_reason TEXT NULL,
    rolled_back_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_tenant ON installation_jobs(tenant_id);
CREATE INDEX idx_jobs_status ON installation_jobs(status);
```

---

#### installation_steps table
```php
2025_12_28_000004_create_installation_steps_table.php
```

**Schema:**
```sql
CREATE TABLE installation_steps (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (job_id) REFERENCES installation_jobs(id) ON DELETE CASCADE,
    UNIQUE(job_id, step_name)
);

CREATE INDEX idx_steps_job ON installation_steps(job_id);
```

---

#### module_dependencies table
```php
2025_12_28_000005_create_module_dependencies_table.php
```

**Schema:**
```sql
CREATE TABLE module_dependencies (
    id BIGSERIAL PRIMARY KEY,
    module_id UUID NOT NULL,
    dependency_name VARCHAR(50) NOT NULL,
    version_constraint VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    UNIQUE(module_id, dependency_name)
);

CREATE INDEX idx_dependencies_module ON module_dependencies(module_id);
```

**Tests:** 10 migration tests (schema validation)

---

### 3.4 Event Publishers (1 day)

**Location:** `app/Contexts/ModuleRegistry/Infrastructure/Events/`

#### LaravelEventPublisher
```php
app/Contexts/ModuleRegistry/Infrastructure/Events/LaravelEventPublisher.php
```

**Implements:** `EventPublisherInterface` (domain port)

**Responsibilities:**
- Publish domain events to Laravel event system
- Map domain events to Laravel events
- Handle async event dispatch

**Methods:**
- `publish(DomainEvent): void`
- `publishBatch(DomainEvent[]): void`

**Tests:** 5 integration tests

---

### 3.5 Subscription Service Adapter (0.5 days)

**Location:** `app/Contexts/ModuleRegistry/Infrastructure/Services/`

```php
LaravelSubscriptionService.php
```

**Implements:** `SubscriptionServiceInterface` (domain port)

**Responsibilities:**
- Check tenant subscriptions
- Get subscription quotas
- Integrate with billing context

**Tests:** 6 integration tests

---

### 3.6 Service Provider (0.5 days)

**Location:** `app/Contexts/ModuleRegistry/Infrastructure/Providers/`

```php
ModuleRegistryServiceProvider.php
```

**Responsibilities:**
- Register repositories
- Bind interfaces to implementations
- Register domain services
- Register application services
- Register event listeners

**Example:**
```php
public function register(): void
{
    // Domain Services
    $this->app->singleton(DependencyResolver::class);
    $this->app->singleton(SubscriptionValidator::class);

    // Application Services
    $this->app->singleton(ModuleRegistrationService::class);
    $this->app->singleton(ModuleInstallationService::class);

    // Repositories
    $this->app->bind(
        ModuleRepositoryInterface::class,
        ModuleRepository::class
    );

    // Ports
    $this->app->bind(
        SubscriptionServiceInterface::class,
        LaravelSubscriptionService::class
    );
}
```

**Tests:** 8 tests (binding verification)

---

### Phase 3 Deliverables Summary

| Component | Files | Tests | Coverage |
|-----------|-------|-------|----------|
| Repositories | 3 | 30 | 85%+ |
| Eloquent Models | 5 | N/A | N/A |
| Migrations | 5 | 10 | 100% |
| Event Publishers | 1 | 5 | 85%+ |
| Service Adapters | 1 | 6 | 85%+ |
| Service Provider | 1 | 8 | 90%+ |
| **TOTAL** | **16** | **59** | **85%+** |

---

## Phase 4: Integration & API Layer 🌐 PLANNED

**Duration:** Week 4 (5 working days)
**Status:** 📋 Not Started
**Estimated Tests:** 40+ E2E tests
**Target Coverage:** 80%+

### Objectives

Build **end-to-end integration**, API endpoints, and comprehensive testing.

### 4.1 HTTP Controllers (2 days)

**Location:** `app/Contexts/ModuleRegistry/Presentation/Http/Controllers/`

#### ModuleCatalogController
```php
app/Contexts/ModuleRegistry/Presentation/Http/Controllers/ModuleCatalogController.php
```

**Routes:**
- `GET /api/modules` - List all modules
- `GET /api/modules/{id}` - Get module details
- `POST /api/modules` - Register new module
- `PUT /api/modules/{id}` - Update module
- `DELETE /api/modules/{id}` - Delete module

**Tests:** 10 feature tests

---

#### TenantModuleController
```php
app/Contexts/ModuleRegistry/Presentation/Http/Controllers/TenantModuleController.php
```

**Routes:**
- `GET /{tenant}/modules` - List tenant's modules
- `POST /{tenant}/modules/{moduleId}/install` - Install module
- `DELETE /{tenant}/modules/{moduleId}` - Uninstall module
- `PUT /{tenant}/modules/{moduleId}/upgrade` - Upgrade module

**Tests:** 12 feature tests

---

#### InstallationJobController
```php
app/Contexts/ModuleRegistry/Presentation/Http/Controllers/InstallationJobController.php
```

**Routes:**
- `GET /{tenant}/installation-jobs` - List jobs
- `GET /{tenant}/installation-jobs/{id}` - Get job details
- `POST /{tenant}/installation-jobs/{id}/retry` - Retry failed job

**Tests:** 8 feature tests

---

### 4.2 API Resources (Transformers) (0.5 days)

**Location:** `app/Contexts/ModuleRegistry/Presentation/Http/Resources/`

```php
ModuleResource.php                 // Transform ModuleDTO to JSON
TenantModuleResource.php           // Transform TenantModuleDTO
InstallationJobResource.php        // Transform JobDTO
```

**Tests:** 3 tests

---

### 4.3 Form Requests (Validation) (0.5 days)

**Location:** `app/Contexts/ModuleRegistry/Presentation/Http/Requests/`

```php
RegisterModuleRequest.php          // Validate module registration
InstallModuleRequest.php           // Validate installation request
```

**Tests:** 4 tests

---

### 4.4 Integration Tests (2 days)

**Location:** `tests/Integration/Contexts/ModuleRegistry/`

```php
ModuleRegistrationFlowTest.php     // Full registration workflow
ModuleInstallationFlowTest.php     // Full installation workflow
DependencyResolutionTest.php       // Dependency resolution integration
SubscriptionValidationTest.php     // Subscription integration
EventPublishingTest.php            // Event system integration
```

**Coverage:**
- Database transactions
- Event publishing
- Repository operations
- Full workflows end-to-end

**Tests:** 15 integration tests

---

### Phase 4 Deliverables Summary

| Component | Files | Tests | Coverage |
|-----------|-------|-------|----------|
| Controllers | 3 | 30 | 80%+ |
| API Resources | 3 | 3 | 100% |
| Form Requests | 2 | 4 | 100% |
| Integration Tests | 5 | 15 | N/A |
| **TOTAL** | **13** | **52** | **80%+** |

---

## Overall Project Summary

| Phase | Duration | Files | Tests | Status |
|-------|----------|-------|-------|--------|
| **Phase 1: Domain** | Week 1 | 34 | 108 | ✅ Complete |
| **Phase 2: Application** | Week 2 | 26 | 79 | 📋 Planned |
| **Phase 3: Infrastructure** | Week 3 | 16 | 59 | 📋 Planned |
| **Phase 4: Integration** | Week 4 | 13 | 52 | 📋 Planned |
| **TOTAL** | 4 weeks | **89** | **298** | 36% Done |

---

## Testing Strategy

### Test Distribution

```
Unit Tests (Domain):          108 tests  (36%)
Unit Tests (Application):      79 tests  (27%)
Integration Tests (Infra):     59 tests  (20%)
E2E Tests (API):              52 tests  (17%)
────────────────────────────────────────
TOTAL:                        298 tests  (100%)
```

### Coverage Goals

- **Domain Layer:** 95%+ (pure logic)
- **Application Layer:** 90%+ (orchestration)
- **Infrastructure Layer:** 85%+ (adapters)
- **API Layer:** 80%+ (controllers)

---

## Risk Management

### Technical Risks

| Risk | Mitigation | Owner |
|------|------------|-------|
| Dependency conflicts | Comprehensive resolver tests | Domain Team |
| Subscription integration | Mock service in tests | Infra Team |
| Event delivery failures | Retry mechanisms | Infra Team |
| Database performance | Indexing strategy | Infra Team |

### Schedule Risks

| Risk | Mitigation | Impact |
|------|------------|--------|
| Phase 2 overrun | Buffer in Phase 4 | Low |
| Migration issues | Rollback scripts | Medium |
| Integration bugs | Comprehensive E2E tests | Medium |

---

## Success Criteria

### Phase Completion Checklist

**Phase 1 ✅**
- [x] All domain tests passing (108/108)
- [x] Zero framework imports
- [x] Golden Rule #1 compliance
- [x] Developer guide complete

**Phase 2 📋**
- [ ] All application tests passing (79+)
- [ ] All commands immutable
- [ ] DTOs serializable
- [ ] Service orchestration correct

**Phase 3 📋**
- [ ] All integration tests passing (59+)
- [ ] Migrations reversible
- [ ] Repository mapping correct
- [ ] Events publishing

**Phase 4 📋**
- [ ] All E2E tests passing (52+)
- [ ] API documented (Swagger/OpenAPI)
- [ ] Load testing complete
- [ ] Production deployment successful

---

## Next Actions

### Immediate (Week 2 Start)

1. **Create Phase 2 branch**
   ```bash
   git checkout -b feature/moduleregistry-phase2
   ```

2. **Set up Application layer structure**
   ```bash
   mkdir -p app/Contexts/ModuleRegistry/Application/{Services,Commands,DTOs,Validators,Exceptions}
   ```

3. **Start with ModuleRegistrationService**
   - Write tests first (TDD)
   - Implement service
   - Verify integration with domain

4. **Daily standup topics:**
   - Tests written today
   - Services completed
   - Blockers encountered

### Week 3 Preparation

- Review domain layer with team
- Finalize database schema
- Prepare migration scripts

### Week 4 Preparation

- API contract review
- Swagger documentation
- Load testing scenarios

---

## Maintenance Plan

### Post-Launch

1. **Monitoring**
   - Installation success rate
   - Job failure rate
   - Dependency resolution time

2. **Performance**
   - Database query optimization
   - Caching strategy
   - Event queue monitoring

3. **Documentation**
   - API documentation updates
   - Developer guide updates
   - Architecture decision records

---

**End of Roadmap**

**Status:** Phase 1 Complete ✅ | Ready for Phase 2 🚀
