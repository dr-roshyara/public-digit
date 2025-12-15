# API Reference - Developer Guide

**Complete API Documentation for Multi-Tenancy System**

---

## ⚠️ Important: Package-Agnostic Abstraction

**As of 2025-12-13**, the TemplateProvisioningService uses `TenantInterface` instead of concrete `Tenant` model. This allows the service to work with **any** tenancy package (Spatie, Stancl, or custom implementations).

**What this means:**
- ✅ All examples still work (Tenant model implements TenantInterface)
- ✅ Service is now package-agnostic
- ✅ Can switch tenancy packages without code changes

For details, see: `architecture/backend/tenant_database/architectural_discussion/spatie_to_tenancy_Stancl/ABSTRACTION_LAYER_IMPLEMENTATION_COMPLETE.md`

---

## Table of Contents

1. [Service APIs](#service-apis)
2. [Model APIs](#model-apis)
3. [Query Scopes](#query-scopes)
4. [Helper Methods](#helper-methods)
5. [Constants](#constants)

---

## Service APIs

### TemplateProvisioningService

**Namespace:** `App\Contexts\Platform\Application\Services\TemplateProvisioningService`

**Abstraction:** Uses `App\Contracts\TenantInterface` for package-agnostic tenant handling

#### Constructor

```php
public function __construct()
```

**Description:** Initializes the service (no dependencies).

---

#### applyTemplate()

**Signature:**
```php
public function applyTemplate(
    TenantInterface $tenant,
    TenantTemplate $template,
    array $moduleIds = [],
    array $customizations = []
): TenantTemplateHistory
```

**Description:** Apply a complete template to a tenant database.

**Parameters:**
- `$tenant` *TenantInterface* - Tenant instance implementing TenantInterface (must have existing database)
- `$template` *TenantTemplate* - Template to apply
- `$moduleIds` *array* - Array of optional module IDs to install (default: `[]`)
- `$customizations` *array* - Array of custom configuration values (default: `[]`)

**Returns:** `TenantTemplateHistory` - History record with provisioning results

**Throws:** `RuntimeException` - On validation failure or SQL execution error

**Example:**
```php
$service = new TemplateProvisioningService();
$tenant = Tenant::findBySlug('nepal-congress');
$template = TenantTemplate::where('slug', 'political_party')->first();

$history = $service->applyTemplate($tenant, $template);

if ($history->isCompleted()) {
    echo "Template applied successfully";
}
```

---

#### updateTemplateVersion()

**Signature:**
```php
public function updateTemplateVersion(
    TenantInterface $tenant,
    TemplateVersion $newVersion
): TenantTemplateHistory
```

**Description:** Migrate a tenant to a new template version.

**Parameters:**
- `$tenant` *TenantInterface* - Tenant instance implementing TenantInterface
- `$newVersion` *TemplateVersion* - New version to migrate to

**Returns:** `TenantTemplateHistory` - History record

**Throws:** `RuntimeException` - If migration SQL not available or execution fails

**Requirements:**
- Tenant must already have a template applied
- New version must have `migration_sql` defined
- New version must be for same template

**Example:**
```php
$tenant = Tenant::findBySlug('nrna');
$newVersion = TemplateVersion::where('version', '1.1.0')->first();

$history = $service->updateTemplateVersion($tenant, $newVersion);

echo "Updated from {$history->from_version} to {$history->to_version}";
```

---

#### addModule()

**Signature:**
```php
public function addModule(
    TenantInterface $tenant,
    TemplateModule $module
): TenantTemplateHistory
```

**Description:** Add a module to an existing tenant.

**Parameters:**
- `$tenant` *TenantInterface* - Tenant instance implementing TenantInterface
- `$module` *TemplateModule* - Module to install

**Returns:** `TenantTemplateHistory` - History record

**Throws:** `RuntimeException` - On dependency check failure or SQL execution error

**Dependency Check:** Validates all module dependencies are already installed

**Example:**
```php
$tenant = Tenant::findBySlug('nrna');
$module = TemplateModule::where('slug', 'advanced_elections')->first();

$history = $service->addModule($tenant, $module);

echo "Module added: {$history->changes['module_name']}";
```

---

## Model APIs

### TenantTemplate

**Namespace:** `App\Models\TenantTemplate`

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | int | Primary key |
| `name` | string | Template name |
| `slug` | string | URL-friendly identifier (unique) |
| `type` | string | Template category |
| `version` | string | Semantic version |
| `description` | string\|null | Template description |
| `schema_sql` | string | Complete database schema SQL |
| `seed_sql` | string\|null | Seed data SQL |
| `config` | array\|null | Template configuration |
| `required_modules` | array\|null | Required module IDs |
| `optional_modules` | array\|null | Optional module IDs |
| `is_active` | bool | Is template active |
| `is_default` | bool | Is default template for type |
| `metadata` | array\|null | Additional metadata |
| `usage_count` | int | Number of tenants using |
| `created_at` | Carbon | Created timestamp |
| `updated_at` | Carbon | Updated timestamp |
| `deleted_at` | Carbon\|null | Soft delete timestamp |

#### Relationships

```php
public function modules(): HasMany           // TemplateModule instances
public function versions(): HasMany          // TemplateVersion instances
public function tenants(): HasMany           // Tenant instances
public function history(): HasMany           // TenantTemplateHistory instances
```

#### Methods

```php
public function getCurrentVersion(): ?TemplateVersion
public function getRequiredModules(): Collection
public function getOptionalModules(): Collection
public function incrementUsage(): void
public function hasModule(int $moduleId): bool
```

---

### TemplateModule

**Namespace:** `App\Models\TemplateModule`

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | int | Primary key |
| `template_id` | int\|null | Template (null = global module) |
| `name` | string | Module name |
| `slug` | string | URL-friendly identifier (unique) |
| `module_type` | string | Module category (core/feature/integration) |
| `description` | string\|null | Module description |
| `schema_sql` | string | Module database schema SQL |
| `seed_sql` | string\|null | Module seed data SQL |
| `migration_sql` | string\|null | Migration SQL for adding to existing DB |
| `rollback_sql` | string\|null | SQL to remove module |
| `dependencies` | array\|null | Required module IDs |
| `conflicts` | array\|null | Incompatible module IDs |
| `config` | array\|null | Module-specific configuration |
| `display_order` | int | Order in UI |
| `is_optional` | bool | Can be excluded from template |
| `is_active` | bool | Is module active |
| `metadata` | array\|null | Additional metadata |

#### Relationships

```php
public function template(): BelongsTo        // TenantTemplate instance
```

#### Methods

```php
public function getDependentModules(): Collection
public function getConflictingModules(): Collection
public function hasDependencies(): bool
public function conflictsWith(int $moduleId): bool
public function dependsOn(int $moduleId): bool
public function isGlobal(): bool
public function isCore(): bool
```

---

### TemplateVersion

**Namespace:** `App\Models\TemplateVersion`

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | int | Primary key |
| `template_id` | int | Template this version belongs to |
| `version` | string | Semantic version (1.2.0) |
| `previous_version` | string\|null | Version this upgrades from |
| `changes` | string | What changed in this version |
| `migration_sql` | string\|null | SQL to migrate from previous version |
| `rollback_sql` | string\|null | SQL to rollback to previous version |
| `schema_sql` | string | Complete schema at this version |
| `seed_sql` | string\|null | Seed data at this version |
| `is_current` | bool | Current active version |
| `is_breaking` | bool | Breaking changes require manual intervention |
| `metadata` | array\|null | Release notes, author, etc. |

#### Relationships

```php
public function template(): BelongsTo        // TenantTemplate instance
```

#### Methods

```php
public function getPreviousVersion(): ?self
public function getNextVersion(): ?self
public function setAsCurrent(): void
public function canRollback(): bool
public function requiresManualMigration(): bool
public function getVersionComponents(): array
public function compareWith(string $otherVersion): int
public function isNewerThan(string $otherVersion): bool
public function isOlderThan(string $otherVersion): bool
```

---

### TenantTemplateHistory

**Namespace:** `App\Models\TenantTemplateHistory`

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | int | Primary key |
| `tenant_id` | string | References tenants.id (UUID) |
| `template_id` | int | Template ID |
| `from_version` | string\|null | Version before update |
| `to_version` | string | Version after update |
| `action` | string | Type of action |
| `description` | string\|null | Action description |
| `changes` | array\|null | What was changed |
| `status` | string | Status (pending/in_progress/completed/failed/rolled_back) |
| `error_message` | string\|null | Error message if failed |
| `metadata` | array\|null | Additional metadata |
| `applied_by` | int\|null | User who applied this change |
| `started_at` | Carbon\|null | Started timestamp |
| `completed_at` | Carbon\|null | Completed timestamp |

#### Relationships

```php
public function tenant(): BelongsTo          // Tenant instance
public function template(): BelongsTo        // TenantTemplate instance
```

#### Methods

```php
public function markAsStarted(): void
public function markAsCompleted(): void
public function markAsFailed(string $errorMessage): void
public function markAsRolledBack(): void
public function isCompleted(): bool
public function hasFailed(): bool
public function isInProgress(): bool
public function isPending(): bool
public function getDuration(): ?int
public function getActionName(): string
```

---

### Tenant (Extended)

**Namespace:** `App\Models\Tenant`

#### Additional Properties (Template-Related)

| Property | Type | Description |
|----------|------|-------------|
| `template_id` | int\|null | Applied template ID |
| `template_version` | string\|null | Applied template version |
| `selected_modules` | array\|null | Selected module IDs |
| `initial_schema_hash` | string\|null | Schema hash after provisioning |
| `current_schema_hash` | string\|null | Current schema hash |
| `schema_status` | string | Schema status (synced/customized/unknown/outdated/failed) |
| `last_schema_sync` | Carbon\|null | Last schema sync time |
| `template_customizations` | array\|null | Template customizations |

#### Additional Relationships

```php
public function template(): BelongsTo        // TenantTemplate instance
```

---

## Query Scopes

### TenantTemplate Scopes

```php
TenantTemplate::active()->get();             // Active templates only
TenantTemplate::default()->get();            // Default templates only
TenantTemplate::byType('political_party')->get();  // Filter by type
```

### TemplateModule Scopes

```php
TemplateModule::active()->get();             // Active modules only
TemplateModule::optional()->get();           // Optional modules only
TemplateModule::required()->get();           // Required modules only
TemplateModule::global()->get();             // Global modules (not template-specific)
TemplateModule::byType('core')->get();       // Filter by module type
TemplateModule::ordered()->get();            // Order by display_order
```

### TemplateVersion Scopes

```php
TemplateVersion::current()->get();           // Current versions only
TemplateVersion::breaking()->get();          // Breaking versions only
TemplateVersion::nonBreaking()->get();       // Non-breaking versions only
TemplateVersion::latest()->get();            // Order by created_at DESC
```

### TenantTemplateHistory Scopes

```php
TenantTemplateHistory::byAction('create')->get();    // Filter by action
TenantTemplateHistory::byStatus('completed')->get(); // Filter by status
TenantTemplateHistory::pending()->get();             // Pending only
TenantTemplateHistory::inProgress()->get();          // In progress only
TenantTemplateHistory::completed()->get();           // Completed only
TenantTemplateHistory::failed()->get();              // Failed only
TenantTemplateHistory::latest()->get();              // Most recent first
```

---

## Helper Methods

### TenantTemplate Helpers

#### getCurrentVersion()
```php
$template = TenantTemplate::find(1);
$version = $template->getCurrentVersion();
// Returns: TemplateVersion|null
```

#### getRequiredModules()
```php
$template = TenantTemplate::find(1);
$modules = $template->getRequiredModules();
// Returns: Collection<TemplateModule>
```

#### getOptionalModules()
```php
$template = TenantTemplate::find(1);
$modules = $template->getOptionalModules();
// Returns: Collection<TemplateModule>
```

#### incrementUsage()
```php
$template->incrementUsage();
// Increments usage_count by 1
```

#### hasModule()
```php
$hasRbac = $template->hasModule(1);
// Returns: bool
```

---

### TemplateModule Helpers

#### getDependentModules()
```php
$module = TemplateModule::find(5);
$dependencies = $module->getDependentModules();
// Returns: Collection<TemplateModule>
```

#### getConflictingModules()
```php
$module = TemplateModule::find(5);
$conflicts = $module->getConflictingModules();
// Returns: Collection<TemplateModule>
```

#### hasDependencies()
```php
if ($module->hasDependencies()) {
    // Module has dependencies
}
// Returns: bool
```

#### conflictsWith()
```php
if ($module->conflictsWith(3)) {
    // Module conflicts with module ID 3
}
// Returns: bool
```

#### dependsOn()
```php
if ($module->dependsOn(1)) {
    // Module depends on module ID 1
}
// Returns: bool
```

#### isGlobal()
```php
if ($module->isGlobal()) {
    // Module is not template-specific
}
// Returns: bool
```

#### isCore()
```php
if ($module->isCore()) {
    // Module is core (required)
}
// Returns: bool
```

---

### TemplateVersion Helpers

#### getPreviousVersion()
```php
$version = TemplateVersion::find(3);
$previous = $version->getPreviousVersion();
// Returns: TemplateVersion|null
```

#### getNextVersion()
```php
$version = TemplateVersion::find(1);
$next = $version->getNextVersion();
// Returns: TemplateVersion|null
```

#### setAsCurrent()
```php
$version->setAsCurrent();
// Sets this version as current, unsets others
```

#### canRollback()
```php
if ($version->canRollback()) {
    // Version has rollback SQL
}
// Returns: bool
```

#### requiresManualMigration()
```php
if ($version->requiresManualMigration()) {
    // Version has breaking changes
}
// Returns: bool
```

#### getVersionComponents()
```php
$components = $version->getVersionComponents();
// Returns: ['major' => 1, 'minor' => 2, 'patch' => 0]
```

#### compareWith()
```php
$result = $version->compareWith('1.0.0');
// Returns: 1 (newer), 0 (equal), -1 (older)
```

#### isNewerThan()
```php
if ($version->isNewerThan('1.0.0')) {
    // Version is newer
}
// Returns: bool
```

#### isOlderThan()
```php
if ($version->isOlderThan('2.0.0')) {
    // Version is older
}
// Returns: bool
```

---

### TenantTemplateHistory Helpers

#### markAsStarted()
```php
$history->markAsStarted();
// Sets status to 'in_progress', started_at to now()
```

#### markAsCompleted()
```php
$history->markAsCompleted();
// Sets status to 'completed', completed_at to now()
```

#### markAsFailed()
```php
$history->markAsFailed('SQL execution failed: ...');
// Sets status to 'failed', error_message, completed_at to now()
```

#### markAsRolledBack()
```php
$history->markAsRolledBack();
// Sets status to 'rolled_back', completed_at to now()
```

#### isCompleted()
```php
if ($history->isCompleted()) {
    // Action completed successfully
}
// Returns: bool
```

#### hasFailed()
```php
if ($history->hasFailed()) {
    echo $history->error_message;
}
// Returns: bool
```

#### isInProgress()
```php
if ($history->isInProgress()) {
    // Action still running
}
// Returns: bool
```

#### isPending()
```php
if ($history->isPending()) {
    // Action not yet started
}
// Returns: bool
```

#### getDuration()
```php
$duration = $history->getDuration();
echo "Took {$duration} seconds";
// Returns: int|null (seconds)
```

#### getActionName()
```php
$name = $history->getActionName();
// Returns: string ('Template Creation', 'Template Update', etc.)
```

---

## Constants

### TenantTemplateHistory Actions

```php
TenantTemplateHistory::ACTION_CREATE          // 'create'
TenantTemplateHistory::ACTION_UPDATE          // 'update'
TenantTemplateHistory::ACTION_ROLLBACK        // 'rollback'
TenantTemplateHistory::ACTION_MODULE_ADD      // 'module_add'
TenantTemplateHistory::ACTION_MODULE_REMOVE   // 'module_remove'
```

**Usage:**
```php
$history = TenantTemplateHistory::byAction(
    TenantTemplateHistory::ACTION_CREATE
)->get();
```

### TenantTemplateHistory Statuses

```php
TenantTemplateHistory::STATUS_PENDING         // 'pending'
TenantTemplateHistory::STATUS_IN_PROGRESS     // 'in_progress'
TenantTemplateHistory::STATUS_COMPLETED       // 'completed'
TenantTemplateHistory::STATUS_FAILED          // 'failed'
TenantTemplateHistory::STATUS_ROLLED_BACK     // 'rolled_back'
```

**Usage:**
```php
$failed = TenantTemplateHistory::byStatus(
    TenantTemplateHistory::STATUS_FAILED
)->get();
```

---

## Full Example: Complete Workflow

```php
use App\Contracts\TenantInterface;  // ✅ Package-agnostic interface
use App\Models\Tenant;              // ✅ Implements TenantInterface
use App\Models\TenantTemplate;
use App\Models\TemplateModule;
use App\Models\TemplateVersion;
use App\Models\TenantTemplateHistory;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;

// 1. Get template and modules
$template = TenantTemplate::active()
    ->byType('political_party')
    ->first();

$optionalModules = TemplateModule::optional()
    ->byType('feature')
    ->get();

// 2. Get tenant
$tenant = Tenant::findBySlug('nepal-congress');

// 3. Apply template
$service = new TemplateProvisioningService();

$history = $service->applyTemplate(
    tenant: $tenant,
    template: $template,
    moduleIds: $optionalModules->pluck('id')->toArray()
);

// 4. Check result
if ($history->isCompleted()) {
    echo "✅ Template applied successfully\n";
    echo "Duration: {$history->getDuration()} seconds\n";

    $tenant->refresh();
    echo "Schema status: {$tenant->schema_status}\n";
    echo "Template version: {$tenant->template_version}\n";
} else {
    echo "❌ Template application failed\n";
    echo "Error: {$history->error_message}\n";
}

// 5. Later: Update to new version
$newVersion = TemplateVersion::where('version', '1.1.0')
    ->where('template_id', $template->id)
    ->first();

if ($newVersion && $newVersion->isNewerThan($tenant->template_version)) {
    $updateHistory = $service->updateTemplateVersion($tenant, $newVersion);

    if ($updateHistory->isCompleted()) {
        echo "✅ Updated to {$newVersion->version}\n";
    }
}
```

---

**Next:** [10 - Troubleshooting](10-troubleshooting.md)
