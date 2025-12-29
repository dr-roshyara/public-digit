# ModuleRegistry Context - Phase 1 Domain Layer Developer Guide

**Date:** 2025-12-28 03:30
**Phase:** 1 - Domain Layer (Complete)
**Author:** Claude (Senior Software Architect)
**Status:** Production Ready ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Value Objects](#value-objects)
5. [Aggregates](#aggregates)
6. [Domain Services](#domain-services)
7. [Domain Events](#domain-events)
8. [Exception Handling](#exception-handling)
9. [Testing Guide](#testing-guide)
10. [Best Practices](#best-practices)
11. [Common Patterns](#common-patterns)
12. [Troubleshooting](#troubleshooting)

---

## Overview

### What is ModuleRegistry Context?

The ModuleRegistry Context is a **bounded context** in our multi-tenant SaaS platform that manages:

- **Module Catalog** - Available modules in the platform
- **Tenant Installations** - Per-tenant module installations
- **Installation Jobs** - Tracking installation/uninstallation/upgrade operations
- **Dependencies** - Module dependency resolution and validation
- **Subscriptions** - Subscription-based access control

### Why Domain-Driven Design?

We use **strict DDD** to:
- Isolate business logic from framework concerns
- Enable easy testing without database/framework
- Maintain clear boundaries between contexts
- Enforce business rules at the domain level
- Support future migration to different frameworks

### Key Principles

1. **Hexagonal Architecture** - Domain has zero framework dependencies
2. **Golden Rule #1** - Tenant-specific aggregates MUST have `tenantId()` and `belongsToTenant()`
3. **TDD First** - Tests written before implementation
4. **Immutability** - Value objects are immutable
5. **Idempotency** - Operations can be safely retried

---

## Architecture

### Directory Structure

```
app/Contexts/ModuleRegistry/
├── Domain/
│   ├── Models/                    # Aggregates (root entities)
│   │   ├── Module.php
│   │   ├── TenantModule.php
│   │   └── ModuleInstallationJob.php
│   │
│   ├── ValueObjects/              # Immutable value objects
│   │   ├── ModuleId.php
│   │   ├── ModuleName.php
│   │   ├── ModuleVersion.php
│   │   ├── ModuleDependency.php
│   │   ├── ModuleConfiguration.php
│   │   ├── TenantId.php
│   │   ├── JobType.php
│   │   ├── JobStatus.php
│   │   └── InstallationStep.php
│   │
│   ├── Services/                  # Domain services
│   │   ├── DependencyResolver.php
│   │   └── SubscriptionValidator.php
│   │
│   ├── Ports/                     # Interfaces (hexagonal)
│   │   └── SubscriptionServiceInterface.php
│   │
│   ├── Events/                    # Domain events
│   │   ├── ModuleRegistered.php
│   │   ├── ModuleInstalledForTenant.php
│   │   ├── InstallationJobStarted.php
│   │   ├── InstallationJobCompleted.php
│   │   └── InstallationJobFailed.php
│   │
│   └── Exceptions/                # Domain exceptions
│       ├── ModuleCannotBeDeprecatedException.php
│       ├── InvalidInstallationStateException.php
│       ├── MissingDependenciesException.php
│       ├── CircularDependencyException.php
│       ├── IncompatibleVersionException.php
│       └── SubscriptionRequiredException.php
│
└── Application/                   # [Phase 2 - Coming Soon]
└── Infrastructure/                # [Phase 3 - Coming Soon]
```

### Layering Rules

```
┌─────────────────────────────────────┐
│   Presentation Layer (Future)      │
├─────────────────────────────────────┤
│   Application Layer (Phase 2)      │ ← DTOs, Commands, Queries
├─────────────────────────────────────┤
│   Domain Layer (Phase 1) ✅        │ ← Pure PHP, NO framework
├─────────────────────────────────────┤
│   Infrastructure Layer (Phase 3)   │ ← Eloquent, Events, DB
└─────────────────────────────────────┘
```

**Critical Rule:** Domain layer NEVER imports from Application or Infrastructure layers.

---

## Getting Started

### Running Tests

```bash
# All ModuleRegistry tests
cd packages/laravel-backend
./vendor/bin/phpunit tests/Unit/Contexts/ModuleRegistry/

# Specific component
./vendor/bin/phpunit tests/Unit/Contexts/ModuleRegistry/Domain/Models/ModuleTest.php

# With coverage report
./vendor/bin/phpunit tests/Unit/Contexts/ModuleRegistry/ --coverage-html coverage/
```

### Verifying Domain Purity

```bash
# Check for framework imports (should return nothing)
grep -r "Illuminate\|Laravel\|Spatie" app/Contexts/ModuleRegistry/Domain/
```

---

## Value Objects

### ModuleId

**Purpose:** Unique identifier for modules (UUID v4)

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;

// Generate new ID
$id = ModuleId::generate();

// From existing UUID
$id = ModuleId::fromString('550e8400-e29b-41d4-a716-446655440000');

// Compare
if ($id1->equals($id2)) {
    // Same module
}

// Convert to string
$uuid = $id->toString(); // "550e8400-e29b-41d4-a716-446655440000"
```

**Key Points:**
- ✅ Pure PHP UUID generation (no external libraries)
- ✅ RFC 4122 compliant
- ✅ Immutable

---

### ModuleName

**Purpose:** Module name with validation rules

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName;

// Valid names
$name = ModuleName::fromString('finance_module');
$name = ModuleName::fromString('crm_v2');

// Invalid (throws InvalidArgumentException)
$name = ModuleName::fromString('Finance');     // ❌ Uppercase
$name = ModuleName::fromString('ab');          // ❌ Too short (< 3)
$name = ModuleName::fromString('has spaces');  // ❌ Spaces
```

**Validation Rules:**
- ✅ 3-50 characters
- ✅ Lowercase letters only
- ✅ Numbers and underscores allowed
- ❌ No spaces or special characters

---

### ModuleVersion

**Purpose:** Semantic versioning with comparison

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleVersion;

$version = ModuleVersion::fromString('1.2.3');

// Access components
$version->major();  // 1
$version->minor();  // 2
$version->patch();  // 3

// Comparison
$v1 = ModuleVersion::fromString('1.5.0');
$v2 = ModuleVersion::fromString('2.0.0');

if ($v2->isGreaterThan($v1)) {
    echo "v2 is newer";
}

if ($v1->isLessThan($v2)) {
    echo "v1 is older";
}

if ($v1->equals($v1)) {
    echo "Same version";
}
```

**Comparison Logic:**
1. Major version compared first
2. If equal, minor version compared
3. If equal, patch version compared

---

### ModuleDependency

**Purpose:** Module dependency with version constraints

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleDependency;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName;

$dependency = new ModuleDependency(
    ModuleName::fromString('finance_module'),
    '>=1.0.0'
);

// Check if version satisfies constraint
$version = ModuleVersion::fromString('1.5.0');
if ($dependency->isSatisfiedBy($version)) {
    echo "Version compatible";
}

// Get constraint string
$constraint = $dependency->versionConstraint(); // ">=1.0.0"
```

**Supported Constraints:**

| Operator | Meaning | Example | Satisfies |
|----------|---------|---------|-----------|
| `>=` | Greater or equal | `>=1.0.0` | 1.0.0, 1.5.0, 2.0.0 |
| `=` | Exact version | `=1.0.0` | 1.0.0 only |
| `^` | Caret (minor updates) | `^1.0.0` | 1.0.0 - 1.9.9 |
| `~` | Tilde (patch updates) | `~1.0.0` | 1.0.0 - 1.0.9 |

**Caret Constraint (`^`):**
- `^1.0.0` = `>=1.0.0 <2.0.0` (allows 1.x.x)
- `^0.1.0` = `>=0.1.0 <0.2.0` (allows 0.1.x)

**Tilde Constraint (`~`):**
- `~1.0.0` = `>=1.0.0 <1.1.0` (allows 1.0.x)

---

### ModuleConfiguration

**Purpose:** Immutable configuration storage

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleConfiguration;

// Create from array
$config = new ModuleConfiguration([
    'max_users' => 100,
    'features' => ['reports', 'dashboard'],
    'enabled' => true
]);

// Get values
$maxUsers = $config->get('max_users');           // 100
$timeout = $config->get('timeout', 30);          // 30 (default)

// Check existence
if ($config->has('features')) {
    $features = $config->get('features');
}

// Immutable updates (returns NEW instance)
$newConfig = $config->set('max_users', 200);
// $config still has 100, $newConfig has 200

// Merge configurations
$merged = $config->merge($otherConfig);

// JSON serialization
$json = $config->toJson();
$restored = ModuleConfiguration::fromJson($json);

// Array conversion
$array = $config->toArray();
```

**Key Points:**
- ✅ Immutable (set/merge return new instances)
- ✅ JSON serialization support
- ✅ Default value support

---

## Aggregates

### Module (Platform-Level)

**Purpose:** Represents a module in the platform catalog

**Key Characteristics:**
- ❌ NO `TenantId` (platform-level)
- ✅ Platform-wide module metadata
- ✅ Manages dependencies
- ✅ Lifecycle: ACTIVE → DEPRECATED/MAINTENANCE

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\Models\Module;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\*;

// Create new module
$module = new Module(
    ModuleId::generate(),
    ModuleName::fromString('finance_module'),
    'Finance Module',                          // Display name
    ModuleVersion::fromString('1.0.0'),
    'Financial management system',             // Description
    'App\\Modules\\Finance',                   // Namespace
    'database/migrations/finance',             // Migrations path
    true,                                      // Requires subscription
    new ModuleConfiguration([
        'max_transactions' => 10000
    ])
);

// Add dependencies
$module->addDependency(new ModuleDependency(
    ModuleName::fromString('core_module'),
    '>=1.0.0'
));

// Check if has dependency
if ($module->hasDependency(ModuleName::fromString('core_module'))) {
    echo "Core module required";
}

// Publish module
$module->publish();

// Update version (only upgrades allowed)
$module->updateVersion(ModuleVersion::fromString('1.1.0')); // ✅ OK
$module->updateVersion(ModuleVersion::fromString('0.9.0')); // ❌ Throws exception

// Deprecate (only if no tenants using it)
$activeTenantCount = 5;
$module->deprecate($activeTenantCount); // ❌ Throws ModuleCannotBeDeprecatedException

$activeTenantCount = 0;
$module->deprecate($activeTenantCount); // ✅ OK

// Maintenance mode
$module->enterMaintenanceMode();
$module->exitMaintenanceMode();

// Check status
if ($module->isActive()) { /* ... */ }
if ($module->isDeprecated()) { /* ... */ }
if ($module->isPublished()) { /* ... */ }
```

**Business Rules:**
1. ✅ Cannot deprecate if tenants still using it
2. ✅ Cannot downgrade version
3. ✅ Cannot publish twice
4. ✅ Cannot add duplicate dependencies

**Domain Events:**
- `ModuleRegistered` - Emitted on construction

---

### TenantModule (Tenant-Specific)

**Purpose:** Represents module installation for a specific tenant

**Key Characteristics:**
- ✅ HAS `TenantId` (Golden Rule #1 compliant)
- ✅ Tenant-specific installation
- ✅ Lifecycle: PENDING → INSTALLING → INSTALLED/FAILED
- ✅ Audit trail (who, when)

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\Models\TenantModule;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\*;

// Create tenant module (starts as PENDING)
$tenantModule = new TenantModule(
    TenantModuleId::generate(),
    TenantId::fromString('tenant-123'),
    ModuleId::generate(),
    ModuleVersion::fromString('1.0.0'),
    new ModuleConfiguration([
        'custom_setting' => 'value'
    ])
);

// Check status
if ($tenantModule->isPending()) {
    echo "Not yet installed";
}

// Mark as installing
$tenantModule->markAsInstalling();

// Mark as installed (requires INSTALLING state)
$tenantModule->markAsInstalled(
    'admin@example.com',           // Who installed
    new DateTimeImmutable()         // When installed
);

// Or mark as failed
$tenantModule->markAsFailed('Migration failed: syntax error');

// Update last used timestamp (for analytics)
$tenantModule->updateLastUsedAt(new DateTimeImmutable());

// Update tenant-specific configuration
$newConfig = new ModuleConfiguration(['theme' => 'dark']);
$tenantModule->updateConfiguration($newConfig);

// Golden Rule #1 - Check tenant ownership
$tenantId = TenantId::fromString('tenant-123');
if ($tenantModule->belongsToTenant($tenantId)) {
    echo "Belongs to tenant-123";
}
```

**Business Rules:**
1. ✅ Cannot mark as installed if not in INSTALLING state
2. ✅ Must track who installed (audit trail)
3. ✅ Starts in PENDING status

**Domain Events:**
- `ModuleInstalledForTenant` - Emitted when successfully installed

**Golden Rule #1 Compliance:**
```php
// MUST have these methods
$tenantModule->tenantId(): TenantId
$tenantModule->belongsToTenant(TenantId $id): bool
```

---

### ModuleInstallationJob (Job Tracking)

**Purpose:** Tracks installation/uninstallation/upgrade operations with idempotent steps

**Key Characteristics:**
- ✅ HAS `TenantId` (Golden Rule #1 compliant)
- ✅ Job types: INSTALL, UNINSTALL, UPGRADE
- ✅ **Idempotent step operations** (retry-safe)
- ✅ Rollback support
- ✅ Detailed error tracking

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\Models\ModuleInstallationJob;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\*;

// Create installation job (starts as PENDING)
$job = new ModuleInstallationJob(
    ModuleInstallationJobId::generate(),
    TenantId::fromString('tenant-123'),
    ModuleId::generate(),
    JobType::INSTALL,                 // or UNINSTALL, UPGRADE
    'admin@example.com'               // Started by
);

// Mark as running
$job->markAsRunning(new DateTimeImmutable());

// Record step completion (IDEMPOTENT - can call multiple times safely)
$job->recordStepCompletion('VALIDATE_SUBSCRIPTION');
$job->recordStepCompletion('CHECK_DEPENDENCIES');
$job->recordStepCompletion('RUN_MIGRATIONS');

// Record step failure
$job->recordStepFailure('RUN_SEEDS', 'Seeder class not found');

// Get step information
$allSteps = $job->steps();
$completedSteps = $job->completedSteps();
$failedSteps = $job->failedSteps();

// Check if can mark as completed
if ($job->canMarkAsCompleted()) {
    $job->markAsCompleted(new DateTimeImmutable());
} else {
    // Has failed steps - cannot complete
    $job->markAsFailed('Installation failed', new DateTimeImmutable());
}

// Rollback with reason
$job->rollback(
    'Migration corrupted tenant database',
    new DateTimeImmutable()
);

// Golden Rule #1 - Check tenant ownership
if ($job->belongsToTenant($tenantId)) {
    echo "Belongs to tenant";
}
```

**Idempotency Example:**
```php
// Calling same step twice doesn't create duplicates
$job->recordStepCompletion('VALIDATE_SUBSCRIPTION');
$job->recordStepCompletion('VALIDATE_SUBSCRIPTION'); // ✅ Idempotent!

$steps = $job->steps();
count($steps); // 1 (not 2!)
```

**Retry Failed Steps:**
```php
// Step failed initially
$job->recordStepFailure('RUN_MIGRATIONS', 'Timeout');

// Retry the step (mark as completed)
$job->recordStepCompletion('RUN_MIGRATIONS'); // ✅ Retry works!

$steps = $job->steps();
$steps[0]->isCompleted(); // true (retried successfully)
```

**Business Rules:**
1. ✅ Steps must be idempotent (can retry)
2. ✅ Cannot mark completed if any step failed
3. ✅ Cannot rollback twice
4. ✅ Tracks error messages and rollback reasons

**Domain Events:**
- `InstallationJobStarted` - When job starts running
- `InstallationJobCompleted` - When job completes successfully
- `InstallationJobFailed` - When job fails

---

## Domain Services

### DependencyResolver

**Purpose:** Resolve module dependencies in correct installation order

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\Services\DependencyResolver;

$resolver = new DependencyResolver();

// Resolve dependencies in topological order
$moduleC = /* module that depends on A and B */;
$installedModules = [$moduleA, $moduleB];

try {
    $dependencies = $resolver->resolveDependencies($moduleC, $installedModules);
    // Returns: [$moduleA, $moduleB] in installation order

    foreach ($dependencies as $dependency) {
        echo "Install: " . $dependency->name()->toString();
    }
} catch (MissingDependenciesException $e) {
    echo "Missing: " . $e->getMessage();
} catch (CircularDependencyException $e) {
    echo "Circular dependency: " . $e->getMessage();
} catch (IncompatibleVersionException $e) {
    echo "Version mismatch: " . $e->getMessage();
}

// Validate only (doesn't return sorted list)
$resolver->validateDependencies($moduleC, $installedModules);
```

**Features:**
- ✅ Topological sort (DFS algorithm)
- ✅ Circular dependency detection
- ✅ Missing dependency validation
- ✅ Version constraint checking

**Example Dependency Graph:**
```
Module D depends on C
Module C depends on B
Module B depends on A

Result: [A, B, C] (installation order for D)
```

**Diamond Dependencies:**
```
    A
   / \
  B   C
   \ /
    D

Result: [A, B, C] or [A, C, B] (both valid)
```

---

### SubscriptionValidator

**Purpose:** Validate subscription requirements before installation

**Usage:**
```php
use App\Contexts\ModuleRegistry\Domain\Services\SubscriptionValidator;

// Inject subscription service (port pattern)
$subscriptionService = /* Infrastructure implementation */;
$validator = new SubscriptionValidator($subscriptionService);

$tenantId = TenantId::fromString('tenant-123');
$module = /* module instance */;

// Validate can install
try {
    $validator->canInstall($tenantId, $module);
    echo "Can install";
} catch (SubscriptionRequiredException $e) {
    echo "No subscription: " . $e->getMessage();
}

// Get quota (usage limit)
$quota = $validator->getQuota($tenantId, $module);
if ($quota === null) {
    echo "Unlimited usage";
} elseif ($quota === 0) {
    echo "Quota exhausted";
} else {
    echo "Quota remaining: $quota";
}
```

**Business Rules:**
- ✅ Free modules (requiresSubscription = false) bypass check
- ✅ Paid modules (requiresSubscription = true) require subscription
- ✅ Returns quota (null = unlimited, 0 = exhausted)

---

## Domain Events

### What Are Domain Events?

Domain events represent **something significant that happened** in the domain.

### ModuleRegistered

**When:** Module is created in the catalog

**Payload:**
```php
$event = ModuleRegistered::now(
    $moduleId,
    $moduleName,
    $version
);

$event->moduleId;     // ModuleId
$event->moduleName;   // ModuleName
$event->version;      // ModuleVersion
$event->occurredAt;   // DateTimeImmutable
```

---

### ModuleInstalledForTenant

**When:** Module successfully installed for tenant

**Payload:**
```php
$event = ModuleInstalledForTenant::now(
    $tenantModuleId,
    $tenantId,
    $moduleId,
    $version,
    $installedBy
);

$event->tenantModuleId;  // TenantModuleId
$event->tenantId;        // TenantId
$event->moduleId;        // ModuleId
$event->version;         // ModuleVersion
$event->installedBy;     // string
$event->occurredAt;      // DateTimeImmutable
```

---

### InstallationJobStarted

**When:** Installation job begins execution

**Payload:**
```php
$event = InstallationJobStarted::now(
    $jobId,
    $tenantId,
    $moduleId,
    $jobType,
    $startedBy
);

$event->jobId;        // ModuleInstallationJobId
$event->tenantId;     // TenantId
$event->moduleId;     // ModuleId
$event->jobType;      // JobType
$event->startedBy;    // string
$event->occurredAt;   // DateTimeImmutable
```

---

### Releasing Events

**Aggregates accumulate events:**
```php
$module = new Module(/* ... */);
// ModuleRegistered event recorded internally

$events = $module->releaseEvents();
// Returns: [ModuleRegistered]
// Clears internal event list

$events = $module->releaseEvents();
// Returns: [] (already released)
```

**In Application Layer (Phase 2), events will be published to event bus.**

---

## Exception Handling

### Domain Exception Hierarchy

All domain exceptions extend `DomainException` (standard PHP exception).

### ModuleCannotBeDeprecatedException

**When:** Attempting to deprecate module with active tenant installations

```php
try {
    $module->deprecate(5); // 5 active tenants
} catch (ModuleCannotBeDeprecatedException $e) {
    echo $e->getMessage();
    // "Cannot deprecate module: 5 active tenant(s) still using it"
}
```

---

### InvalidInstallationStateException

**When:** Invalid state transition in TenantModule

```php
$tenantModule = new TenantModule(/* ... */);
// Status: PENDING

try {
    $tenantModule->markAsInstalled('user', new DateTimeImmutable());
    // ❌ Cannot mark installed if not INSTALLING
} catch (InvalidInstallationStateException $e) {
    echo $e->getMessage();
    // "Cannot mark as installed: module is not in installing state"
}
```

---

### MissingDependenciesException

**When:** Required dependencies are not installed

```php
try {
    $resolver->resolveDependencies($module, $installedModules);
} catch (MissingDependenciesException $e) {
    echo $e->getMessage();
    // "Module "crm_module" has missing dependencies: finance_module, core_module"
}
```

---

### CircularDependencyException

**When:** Circular dependency detected in dependency graph

```php
// Module A depends on B
// Module B depends on A (circular!)

try {
    $resolver->resolveDependencies($moduleA, [$moduleB]);
} catch (CircularDependencyException $e) {
    echo $e->getMessage();
    // "Circular dependency detected: module_a → module_b → module_a"
}
```

---

### IncompatibleVersionException

**When:** Installed version doesn't satisfy dependency constraint

```php
// Module B requires Module A >=2.0.0
// But Module A is only 1.0.0

try {
    $resolver->resolveDependencies($moduleB, [$moduleA]);
} catch (IncompatibleVersionException $e) {
    echo $e->getMessage();
    // "Module "module_b" requires "module_a" >=2.0.0, but version 1.0.0 is installed"
}
```

---

### SubscriptionRequiredException

**When:** Tenant attempts to install paid module without subscription

```php
try {
    $validator->canInstall($tenantId, $paidModule);
} catch (SubscriptionRequiredException $e) {
    echo $e->getMessage();
    // "Tenant "tenant-123" does not have subscription for module "premium_module""
}
```

---

## Testing Guide

### Test Structure

All tests follow **TDD: RED → GREEN → REFACTOR**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Contexts\ModuleRegistry\Domain\Models;

use PHPUnit\Framework\TestCase;

final class ModuleTest extends TestCase
{
    // === Test 1: Descriptive name ===

    public function test_can_create_module_with_required_properties(): void
    {
        $module = new Module(/* ... */);

        $this->assertInstanceOf(Module::class, $module);
        $this->assertTrue($module->isActive());
    }

    // === Test 2: Business rule validation ===

    public function test_cannot_deprecate_if_tenants_using_it(): void
    {
        $module = new Module(/* ... */);

        $this->expectException(ModuleCannotBeDeprecatedException::class);

        $module->deprecate(5); // 5 active tenants
    }
}
```

### Running Specific Tests

```bash
# Single test method
./vendor/bin/phpunit --filter test_cannot_deprecate_if_tenants_using_it

# Single test file
./vendor/bin/phpunit tests/Unit/Contexts/ModuleRegistry/Domain/Models/ModuleTest.php

# All ModuleRegistry tests
./vendor/bin/phpunit tests/Unit/Contexts/ModuleRegistry/
```

### Test Coverage

```bash
# Generate HTML coverage report
./vendor/bin/phpunit tests/Unit/Contexts/ModuleRegistry/ \
    --coverage-html coverage/moduleregistry

# View report
open coverage/moduleregistry/index.html
```

---

## Best Practices

### 1. Always Use Value Objects

**❌ Don't:**
```php
function installModule(string $moduleId, string $tenantId) {
    // Primitive obsession!
}
```

**✅ Do:**
```php
function installModule(ModuleId $moduleId, TenantId $tenantId) {
    // Type-safe with domain validation
}
```

---

### 2. Leverage Immutability

**❌ Don't:**
```php
$config->set('key', 'value'); // Mutates in place
```

**✅ Do:**
```php
$newConfig = $config->set('key', 'value'); // Returns new instance
```

---

### 3. Check Aggregate State Before Operations

**❌ Don't:**
```php
$tenantModule->markAsInstalled(/* ... */);
// Might fail if not in INSTALLING state
```

**✅ Do:**
```php
if ($tenantModule->isInstalling()) {
    $tenantModule->markAsInstalled(/* ... */);
} else {
    throw new InvalidOperationException();
}
```

---

### 4. Use Factory Methods for Complex Creation

**❌ Don't:**
```php
$version = new ModuleVersion(1, 2, 3); // Constructor too complex
```

**✅ Do:**
```php
$version = ModuleVersion::fromString('1.2.3'); // Clear intent
```

---

### 5. Release Events After Persisting

**Application Layer Pattern (Phase 2):**
```php
// 1. Execute domain logic
$module = new Module(/* ... */);

// 2. Persist aggregate
$repository->save($module);

// 3. Release and publish events
$events = $module->releaseEvents();
foreach ($events as $event) {
    $eventBus->publish($event);
}
```

---

## Common Patterns

### Pattern 1: Module Installation Workflow

```php
// 1. Validate subscription
$validator->canInstall($tenantId, $module);

// 2. Validate dependencies
$resolver->validateDependencies($module, $installedModules);

// 3. Create installation job
$job = new ModuleInstallationJob(
    ModuleInstallationJobId::generate(),
    $tenantId,
    $module->id(),
    JobType::INSTALL,
    $userId
);

// 4. Mark as running
$job->markAsRunning(new DateTimeImmutable());

// 5. Execute steps (idempotent)
$job->recordStepCompletion('VALIDATE_SUBSCRIPTION');
$job->recordStepCompletion('CHECK_DEPENDENCIES');
$job->recordStepCompletion('RUN_MIGRATIONS');

// 6. Mark job as completed
if ($job->canMarkAsCompleted()) {
    $job->markAsCompleted(new DateTimeImmutable());
}

// 7. Mark module as installed
$tenantModule->markAsInstalling();
$tenantModule->markAsInstalled($userId, new DateTimeImmutable());
```

---

### Pattern 2: Dependency Resolution

```php
// Get all dependencies in correct order
$dependencies = $resolver->resolveDependencies($module, $installedModules);

// Install in order
foreach ($dependencies as $dependency) {
    installModule($dependency);
}

// Finally install the module itself
installModule($module);
```

---

### Pattern 3: Idempotent Step Retry

```php
// Initial attempt - fails
$job->recordStepFailure('RUN_MIGRATIONS', 'Database locked');

// Retry logic
$maxRetries = 3;
$attempt = 0;

while ($attempt < $maxRetries) {
    try {
        runMigrations();
        $job->recordStepCompletion('RUN_MIGRATIONS'); // ✅ Idempotent!
        break;
    } catch (Exception $e) {
        $attempt++;
        if ($attempt >= $maxRetries) {
            $job->recordStepFailure('RUN_MIGRATIONS', $e->getMessage());
        }
    }
}
```

---

## Troubleshooting

### Issue 1: "Call to undefined method fromArray()"

**Error:**
```
Call to undefined method ModuleConfiguration::fromArray()
```

**Solution:**
Use constructor directly:
```php
// ❌ Wrong
$config = ModuleConfiguration::fromArray([]);

// ✅ Correct
$config = new ModuleConfiguration([]);
```

---

### Issue 2: "Cannot add duplicate dependency"

**Error:**
```
InvalidArgumentException: Dependency on module "core_module" already exists
```

**Solution:**
Check before adding:
```php
if (!$module->hasDependency($moduleName)) {
    $module->addDependency($dependency);
}
```

---

### Issue 3: "Cannot mark as installed: not in installing state"

**Error:**
```
InvalidInstallationStateException: Cannot mark as installed: module is not in installing state
```

**Solution:**
Call `markAsInstalling()` first:
```php
$tenantModule->markAsInstalling();
$tenantModule->markAsInstalled($userId, $now);
```

---

### Issue 4: Circular Dependency Detected

**Error:**
```
CircularDependencyException: Circular dependency detected: module_a → module_b → module_a
```

**Solution:**
Review dependency graph and remove circular references. Dependencies must be **acyclic**.

---

### Issue 5: Framework Import in Domain Layer

**Error:**
```
Domain purity violation: Found "Illuminate\Support\Facades\DB"
```

**Solution:**
Remove framework imports. Use ports/interfaces instead:
```php
// ❌ Wrong
use Illuminate\Support\Facades\DB;

// ✅ Correct
use App\Contexts\ModuleRegistry\Domain\Ports\RepositoryInterface;
```

---

## Summary

### What You've Learned

1. ✅ **Value Objects** - Immutable, self-validating
2. ✅ **Aggregates** - Module, TenantModule, ModuleInstallationJob
3. ✅ **Domain Services** - DependencyResolver, SubscriptionValidator
4. ✅ **Domain Events** - Significant domain occurrences
5. ✅ **Exceptions** - Business rule violations
6. ✅ **Hexagonal Architecture** - Domain isolation
7. ✅ **Golden Rule #1** - Tenant aggregates compliance
8. ✅ **Idempotency** - Retry-safe operations

### Next Steps

**Phase 2: Application Layer**
- Application services (orchestration)
- DTOs (data transfer objects)
- Commands and queries (CQRS)
- Use case implementations

**Phase 3: Infrastructure Layer**
- Eloquent repositories
- Event publishers
- Database migrations
- Service providers

**Phase 4: Integration Testing**
- End-to-end tests
- Database integration
- Event handling verification

---

## Quick Reference Card

```php
// VALUE OBJECTS
$id = ModuleId::generate();
$name = ModuleName::fromString('finance');
$version = ModuleVersion::fromString('1.2.3');
$dependency = new ModuleDependency($name, '>=1.0.0');
$config = new ModuleConfiguration(['key' => 'value']);

// AGGREGATES
$module = new Module($id, $name, ...);
$tenantModule = new TenantModule($id, $tenantId, ...);
$job = new ModuleInstallationJob($id, $tenantId, ...);

// DOMAIN SERVICES
$resolver = new DependencyResolver();
$validator = new SubscriptionValidator($service);

// COMMON OPERATIONS
$module->addDependency($dependency);
$tenantModule->markAsInstalled($user, $now);
$job->recordStepCompletion('STEP_NAME');
$dependencies = $resolver->resolveDependencies($module, $installed);
$validator->canInstall($tenantId, $module);

// EVENTS
$events = $aggregate->releaseEvents();

// TENANT OWNERSHIP (Golden Rule #1)
$aggregate->tenantId();
$aggregate->belongsToTenant($tenantId);
```

---

**End of Phase 1 Developer Guide**

For questions or issues, refer to test files for concrete examples:
- `tests/Unit/Contexts/ModuleRegistry/Domain/`
