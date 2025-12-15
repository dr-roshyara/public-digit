# Models & Relationships - Developer Guide

**Eloquent Models for Template-Based Multi-Tenancy**

---

## Table of Contents

1. [Overview](#overview)
2. [TenantTemplate Model](#tenanttemplate-model)
3. [TemplateModule Model](#templatemodule-model)
4. [TemplateVersion Model](#templateversion-model)
5. [TenantTemplateHistory Model](#tenanttemplate history-model)
6. [Tenant Model Extensions](#tenant-model-extensions)
7. [Relationships Diagram](#relationships-diagram)
8. [Usage Examples](#usage-examples)

---

## Overview

The multi-tenancy template system uses **5 main Eloquent models**:

| Model | Location | Purpose |
|-------|----------|---------|
| `TenantTemplate` | `app/Models/TenantTemplate.php` | Template definitions |
| `TemplateModule` | `app/Models/TemplateModule.php` | Modular components |
| `TemplateVersion` | `app/Models/TemplateVersion.php` | Version tracking |
| `TenantTemplateHistory` | `app/Models/TenantTemplateHistory.php` | Audit trail |
| `Tenant` | `app/Models/Tenant.php` | Tenant with template metadata |

**All models use:**
- ✅ Mass assignment protection (`$fillable`)
- ✅ Attribute casting (`$casts`)
- ✅ Soft deletes (except TenantTemplateHistory, TemplateVersion)
- ✅ Query scopes for filtering
- ✅ Helper methods for common operations
- ✅ Proper relationships (HasMany, BelongsTo)

---

## TenantTemplate Model

**File**: `app/Models/TenantTemplate.php`

### Properties

```php
/**
 * @property int $id
 * @property string $name                  // Template name
 * @property string $slug                  // URL-friendly identifier
 * @property string $type                  // Template category
 * @property string $version               // Semantic version (1.0.0)
 * @property string|null $description      // Template description
 * @property string $schema_sql            // Complete database schema SQL
 * @property string|null $seed_sql         // Seed data SQL
 * @property array|null $config            // Template configuration
 * @property array|null $required_modules  // Required module IDs
 * @property array|null $optional_modules  // Optional module IDs
 * @property bool $is_active               // Is template active
 * @property bool $is_default              // Is default template for type
 * @property array|null $metadata          // Additional metadata
 * @property int $usage_count              // Number of tenants using template
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
```

### Fillable Attributes

```php
protected $fillable = [
    'name', 'slug', 'type', 'version', 'description',
    'schema_sql', 'seed_sql', 'config',
    'required_modules', 'optional_modules',
    'is_active', 'is_default', 'metadata', 'usage_count',
];
```

### Casts

```php
protected $casts = [
    'config' => 'array',
    'required_modules' => 'array',
    'optional_modules' => 'array',
    'metadata' => 'array',
    'is_active' => 'boolean',
    'is_default' => 'boolean',
    'usage_count' => 'integer',
    'created_at' => 'datetime',
    'updated_at' => 'datetime',
    'deleted_at' => 'datetime',
];
```

### Relationships

#### 1. modules() - HasMany

Get modules associated with this template.

```php
public function modules(): HasMany
{
    return $this->hasMany(TemplateModule::class, 'template_id');
}
```

**Usage:**
```php
$template = TenantTemplate::find(1);
$modules = $template->modules; // Collection of TemplateModule

// Only active modules
$activeModules = $template->modules()->active()->get();
```

#### 2. versions() - HasMany

Get all versions of this template.

```php
public function versions(): HasMany
{
    return $this->hasMany(TemplateVersion::class, 'template_id');
}
```

**Usage:**
```php
$template = TenantTemplate::find(1);
$versions = $template->versions; // All versions
$currentVersion = $template->versions()->current()->first(); // Current version
```

#### 3. tenants() - HasMany

Get tenants using this template.

```php
public function tenants(): HasMany
{
    return $this->hasMany(Tenant::class, 'template_id');
}
```

**Usage:**
```php
$template = TenantTemplate::find(1);
$tenants = $template->tenants; // All tenants using this template
$activeTenants = $template->tenants()->where('status', 'active')->get();
```

#### 4. history() - HasMany

Get provisioning history for this template.

```php
public function history(): HasMany
{
    return $this->hasMany(TenantTemplateHistory::class, 'template_id');
}
```

**Usage:**
```php
$template = TenantTemplate::find(1);
$history = $template->history; // All provisioning history
$failures = $template->history()->failed()->get();
```

### Query Scopes

#### active()

Filter active templates only.

```php
public function scopeActive($query)
{
    return $query->where('is_active', true);
}
```

**Usage:**
```php
$activeTemplates = TenantTemplate::active()->get();
```

#### default()

Filter default templates only.

```php
public function scopeDefault($query)
{
    return $query->where('is_default', true);
}
```

**Usage:**
```php
$defaultTemplate = TenantTemplate::default()->first();
```

#### byType()

Filter by template type.

```php
public function scopeByType($query, string $type)
{
    return $query->where('type', $type);
}
```

**Usage:**
```php
$politicalPartyTemplates = TenantTemplate::byType('political_party')->get();
$ngoTemplates = TenantTemplate::byType('ngo')->get();
```

### Helper Methods

#### getCurrentVersion()

Get current version of template.

```php
public function getCurrentVersion(): ?TemplateVersion
{
    return $this->versions()->where('is_current', true)->first();
}
```

**Usage:**
```php
$template = TenantTemplate::find(1);
$version = $template->getCurrentVersion();
echo "Current version: {$version->version}";
```

#### getRequiredModules()

Get required modules for template.

```php
public function getRequiredModules()
{
    if (empty($this->required_modules)) {
        return collect();
    }
    return TemplateModule::whereIn('id', $this->required_modules)->get();
}
```

**Usage:**
```php
$template = TenantTemplate::find(1);
$requiredModules = $template->getRequiredModules();

foreach ($requiredModules as $module) {
    echo "Required: {$module->name}\n";
}
```

#### getOptionalModules()

Get optional modules for template.

```php
public function getOptionalModules()
{
    if (empty($this->optional_modules)) {
        return collect();
    }
    return TemplateModule::whereIn('id', $this->optional_modules)->get();
}
```

#### incrementUsage()

Increment usage count when tenant uses template.

```php
public function incrementUsage(): void
{
    $this->increment('usage_count');
}
```

**Usage:**
```php
$template->incrementUsage();
echo "Usage count: {$template->usage_count}";
```

#### hasModule()

Check if template has specific module.

```php
public function hasModule(int $moduleId): bool
{
    return in_array($moduleId, $this->required_modules ?? [])
        || in_array($moduleId, $this->optional_modules ?? []);
}
```

**Usage:**
```php
if ($template->hasModule(5)) {
    echo "Template includes module ID 5";
}
```

---

## TemplateModule Model

**File**: `app/Models/TemplateModule.php`

### Properties

```php
/**
 * @property int $id
 * @property int|null $template_id        // Template this module belongs to (null = global)
 * @property string $name                 // Module name
 * @property string $slug                 // URL-friendly identifier
 * @property string $module_type          // Module category (core, feature, integration)
 * @property string|null $description     // Module description
 * @property string $schema_sql           // Module database schema SQL
 * @property string|null $seed_sql        // Module seed data SQL
 * @property string|null $migration_sql   // Migration SQL for adding to existing DB
 * @property string|null $rollback_sql    // SQL to remove module
 * @property array|null $dependencies     // Required module IDs
 * @property array|null $conflicts        // Incompatible module IDs
 * @property array|null $config           // Module-specific configuration
 * @property int $display_order           // Order in UI
 * @property bool $is_optional            // Can be excluded from template
 * @property bool $is_active              // Is module active
 * @property array|null $metadata         // Additional metadata
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
```

### Fillable Attributes

```php
protected $fillable = [
    'template_id', 'name', 'slug', 'module_type', 'description',
    'schema_sql', 'seed_sql', 'migration_sql', 'rollback_sql',
    'dependencies', 'conflicts', 'config', 'display_order',
    'is_optional', 'is_active', 'metadata',
];
```

### Casts

```php
protected $casts = [
    'template_id' => 'integer',
    'dependencies' => 'array',
    'conflicts' => 'array',
    'config' => 'array',
    'metadata' => 'array',
    'display_order' => 'integer',
    'is_optional' => 'boolean',
    'is_active' => 'boolean',
    'created_at' => 'datetime',
    'updated_at' => 'datetime',
    'deleted_at' => 'datetime',
];
```

### Relationships

#### template() - BelongsTo

Get template this module belongs to.

```php
public function template(): BelongsTo
{
    return $this->belongsTo(TenantTemplate::class, 'template_id');
}
```

**Usage:**
```php
$module = TemplateModule::find(1);
$template = $module->template; // TenantTemplate instance (or null if global)

if ($template) {
    echo "Module belongs to: {$template->name}";
} else {
    echo "Global module";
}
```

### Query Scopes

#### active()
```php
TemplateModule::active()->get();
```

#### optional()
```php
TemplateModule::optional()->get();
```

#### required()
```php
TemplateModule::required()->get();
```

#### global()
```php
TemplateModule::global()->get(); // Modules not tied to specific template
```

#### byType()
```php
TemplateModule::byType('core')->get();
TemplateModule::byType('feature')->get();
```

#### ordered()
```php
TemplateModule::ordered()->get(); // Order by display_order
```

### Helper Methods

#### getDependentModules()

Get modules this module depends on.

```php
public function getDependentModules()
{
    if (empty($this->dependencies)) {
        return collect();
    }
    return static::whereIn('id', $this->dependencies)->get();
}
```

#### getConflictingModules()

Get modules that conflict with this module.

```php
public function getConflictingModules()
{
    if (empty($this->conflicts)) {
        return collect();
    }
    return static::whereIn('id', $this->conflicts)->get();
}
```

#### hasDependencies()
```php
if ($module->hasDependencies()) {
    echo "Module has dependencies";
}
```

#### conflictsWith()
```php
if ($module->conflictsWith(5)) {
    echo "Module conflicts with module ID 5";
}
```

#### dependsOn()
```php
if ($module->dependsOn(3)) {
    echo "Module depends on module ID 3";
}
```

#### isGlobal()
```php
if ($module->isGlobal()) {
    echo "Module is global (not template-specific)";
}
```

#### isCore()
```php
if ($module->isCore()) {
    echo "Module is core (required, not optional)";
}
```

---

## TemplateVersion Model

**File**: `app/Models/TemplateVersion.php`

### Properties

```php
/**
 * @property int $id
 * @property int $template_id             // Template this version belongs to
 * @property string $version               // Semantic version (1.2.0)
 * @property string|null $previous_version // Version this upgrades from
 * @property string $changes               // What changed in this version
 * @property string|null $migration_sql    // SQL to migrate from previous version
 * @property string|null $rollback_sql     // SQL to rollback to previous version
 * @property string $schema_sql            // Complete schema at this version
 * @property string|null $seed_sql         // Seed data at this version
 * @property bool $is_current              // Current active version
 * @property bool $is_breaking             // Breaking changes require manual intervention
 * @property array|null $metadata          // Release notes, author, etc.
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
```

### Relationships

#### template() - BelongsTo

```php
public function template(): BelongsTo
{
    return $this->belongsTo(TenantTemplate::class, 'template_id');
}
```

**Usage:**
```php
$version = TemplateVersion::find(1);
$template = $version->template;
echo "Version for: {$template->name}";
```

### Query Scopes

#### current()
```php
$currentVersion = TemplateVersion::current()->first();
```

#### breaking()
```php
$breakingVersions = TemplateVersion::breaking()->get();
```

#### nonBreaking()
```php
$nonBreakingVersions = TemplateVersion::nonBreaking()->get();
```

#### latest()
```php
$versions = TemplateVersion::latest()->get(); // Order by created_at DESC
```

### Helper Methods

#### getPreviousVersion()

Get previous version of template.

```php
public function getPreviousVersion(): ?self
{
    if (!$this->previous_version) {
        return null;
    }
    return static::where('template_id', $this->template_id)
        ->where('version', $this->previous_version)
        ->first();
}
```

#### getNextVersion()

Get next version of template.

```php
public function getNextVersion(): ?self
{
    return static::where('template_id', $this->template_id)
        ->where('previous_version', $this->version)
        ->first();
}
```

#### setAsCurrent()

Set this version as current (unsets others).

```php
public function setAsCurrent(): void
{
    static::where('template_id', $this->template_id)
        ->where('id', '!=', $this->id)
        ->update(['is_current' => false]);

    $this->update(['is_current' => true]);
}
```

**Usage:**
```php
$version = TemplateVersion::find(3);
$version->setAsCurrent();
```

#### canRollback()
```php
if ($version->canRollback()) {
    echo "Can rollback to previous version";
}
```

#### requiresManualMigration()
```php
if ($version->requiresManualMigration()) {
    echo "Breaking changes - manual migration required";
}
```

#### getVersionComponents()

Get version number components.

```php
public function getVersionComponents(): array
{
    return [
        'major' => (int) ($parts[0] ?? 0),
        'minor' => (int) ($parts[1] ?? 0),
        'patch' => (int) ($parts[2] ?? 0),
    ];
}
```

**Usage:**
```php
$components = $version->getVersionComponents();
echo "Major: {$components['major']}";
echo "Minor: {$components['minor']}";
echo "Patch: {$components['patch']}";
```

#### compareWith()

Compare version with another.

```php
public function compareWith(string $otherVersion): int
{
    return version_compare($this->version, $otherVersion);
}
```

**Returns:**
- `1` if this version is newer
- `0` if versions are equal
- `-1` if this version is older

#### isNewerThan()
```php
if ($version->isNewerThan('1.0.0')) {
    echo "Version is newer than 1.0.0";
}
```

#### isOlderThan()
```php
if ($version->isOlderThan('2.0.0')) {
    echo "Version is older than 2.0.0";
}
```

---

## TenantTemplateHistory Model

**File**: `app/Models/TenantTemplateHistory.php`

### Properties

```php
/**
 * @property int $id
 * @property string $tenant_id             // References tenants.id (UUID)
 * @property int $template_id
 * @property string|null $from_version     // Version before update
 * @property string $to_version            // Version after update
 * @property string $action                // Type of action (create, update, rollback, etc.)
 * @property string|null $description      // Action description
 * @property array|null $changes           // What was changed
 * @property string $status                // Status (pending, in_progress, completed, failed, etc.)
 * @property string|null $error_message    // Error message if failed
 * @property array|null $metadata          // Additional metadata
 * @property int|null $applied_by          // User who applied this change
 * @property \Carbon\Carbon|null $started_at
 * @property \Carbon\Carbon|null $completed_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
```

### Constants

#### Action Constants
```php
const ACTION_CREATE = 'create';
const ACTION_UPDATE = 'update';
const ACTION_ROLLBACK = 'rollback';
const ACTION_MODULE_ADD = 'module_add';
const ACTION_MODULE_REMOVE = 'module_remove';
```

#### Status Constants
```php
const STATUS_PENDING = 'pending';
const STATUS_IN_PROGRESS = 'in_progress';
const STATUS_COMPLETED = 'completed';
const STATUS_FAILED = 'failed';
const STATUS_ROLLED_BACK = 'rolled_back';
```

### Relationships

#### tenant() - BelongsTo
```php
public function tenant(): BelongsTo
{
    return $this->belongsTo(Tenant::class, 'tenant_id');
}
```

#### template() - BelongsTo
```php
public function template(): BelongsTo
{
    return $this->belongsTo(TenantTemplate::class, 'template_id');
}
```

### Query Scopes

#### byAction()
```php
$createActions = TenantTemplateHistory::byAction('create')->get();
```

#### byStatus()
```php
$failedActions = TenantTemplateHistory::byStatus('failed')->get();
```

#### pending()
```php
$pending = TenantTemplateHistory::pending()->get();
```

#### inProgress()
```php
$inProgress = TenantTemplateHistory::inProgress()->get();
```

#### completed()
```php
$completed = TenantTemplateHistory::completed()->get();
```

#### failed()
```php
$failed = TenantTemplateHistory::failed()->get();
```

#### latest()
```php
$recent = TenantTemplateHistory::latest()->get();
```

### Helper Methods

#### markAsStarted()
```php
$history->markAsStarted();
```

#### markAsCompleted()
```php
$history->markAsCompleted();
```

#### markAsFailed()
```php
$history->markAsFailed('SQL execution failed: ...');
```

#### markAsRolledBack()
```php
$history->markAsRolledBack();
```

#### isCompleted()
```php
if ($history->isCompleted()) {
    echo "Action completed successfully";
}
```

#### hasFailed()
```php
if ($history->hasFailed()) {
    echo "Action failed: {$history->error_message}";
}
```

#### isInProgress()
```php
if ($history->isInProgress()) {
    echo "Action in progress...";
}
```

#### isPending()
```php
if ($history->isPending()) {
    echo "Action pending execution";
}
```

#### getDuration()

Get duration of action in seconds.

```php
public function getDuration(): ?int
{
    if (!$this->started_at || !$this->completed_at) {
        return null;
    }
    return $this->completed_at->diffInSeconds($this->started_at);
}
```

**Usage:**
```php
$duration = $history->getDuration();
echo "Took {$duration} seconds";
```

#### getActionName()

Get human-readable action name.

```php
public function getActionName(): string
{
    return match ($this->action) {
        self::ACTION_CREATE => 'Template Creation',
        self::ACTION_UPDATE => 'Template Update',
        self::ACTION_ROLLBACK => 'Template Rollback',
        self::ACTION_MODULE_ADD => 'Module Addition',
        self::ACTION_MODULE_REMOVE => 'Module Removal',
        default => 'Unknown Action',
    };
}
```

---

## Tenant Model Extensions

**File**: `app/Models/Tenant.php`

### Additional Template-Related Properties

```php
/**
 * @property int|null $template_id         // Applied template ID
 * @property string|null $template_version // Applied template version
 * @property array|null $selected_modules  // Selected module IDs
 * @property string|null $initial_schema_hash  // Schema hash after provisioning
 * @property string|null $current_schema_hash  // Current schema hash
 * @property string $schema_status         // Schema status (synced, customized, unknown)
 * @property \Carbon\Carbon|null $last_schema_sync  // Last schema sync time
 * @property array|null $template_customizations   // Template customizations
 */
```

### Relationship to Template

```php
public function template(): BelongsTo
{
    return $this->belongsTo(TenantTemplate::class, 'template_id');
}
```

**Usage:**
```php
$tenant = Tenant::find(1);
$template = $tenant->template;

if ($template) {
    echo "Tenant uses template: {$template->name}";
    echo "Version: {$tenant->template_version}";
}
```

---

## Relationships Diagram

```
┌─────────────────────┐
│   TenantTemplate    │
│  (id, name, slug)   │
└──────────┬──────────┘
           │
           │ hasMany
           ├──────────────────────────────────┐
           │                                  │
           ↓                                  ↓
   ┌──────────────────┐              ┌──────────────────┐
   │ TemplateModule   │              │ TemplateVersion  │
   │ (id, name, slug) │              │ (id, version)    │
   └──────────────────┘              └──────────────────┘
           │                                  │
           │ belongsTo                        │ belongsTo
           └────────────┬─────────────────────┘
                        │
                        │ hasMany
                        ↓
              ┌──────────────────────┐
              │   Tenant             │
              │ (id, name, slug)     │
              │ template_id          │
              │ template_version     │
              └──────────┬───────────┘
                         │
                         │ hasMany
                         ↓
              ┌──────────────────────────┐
              │ TenantTemplateHistory    │
              │ (id, tenant_id)          │
              │ (template_id, status)    │
              └──────────────────────────┘
```

---

## Usage Examples

### Example 1: Get Template with All Relationships

```php
$template = TenantTemplate::with([
    'modules',
    'versions',
    'tenants',
    'history',
])->find(1);

echo "Template: {$template->name}\n";
echo "Modules: " . $template->modules->count() . "\n";
echo "Versions: " . $template->versions->count() . "\n";
echo "Tenants using: " . $template->tenants->count() . "\n";
echo "History records: " . $template->history->count() . "\n";
```

### Example 2: Get Current Version and Modules

```php
$template = TenantTemplate::find(1);

$currentVersion = $template->getCurrentVersion();
echo "Current version: {$currentVersion->version}\n";

$requiredModules = $template->getRequiredModules();
foreach ($requiredModules as $module) {
    echo "Required: {$module->name}\n";
}

$optionalModules = $template->getOptionalModules();
foreach ($optionalModules as $module) {
    echo "Optional: {$module->name}\n";
}
```

### Example 3: Check Module Dependencies

```php
$module = TemplateModule::find(5);

if ($module->hasDependencies()) {
    $dependencies = $module->getDependentModules();
    echo "Module depends on:\n";
    foreach ($dependencies as $dep) {
        echo "  - {$dep->name}\n";
    }
}

if ($module->getConflictingModules()->isNotEmpty()) {
    echo "Module conflicts with other modules\n";
}
```

### Example 4: Version Comparison

```php
$version1 = TemplateVersion::where('version', '1.0.0')->first();
$version2 = TemplateVersion::where('version', '1.1.0')->first();

if ($version2->isNewerThan($version1->version)) {
    echo "Version 1.1.0 is newer than 1.0.0\n";
}

$components = $version2->getVersionComponents();
echo "Major: {$components['major']}\n";
echo "Minor: {$components['minor']}\n";
echo "Patch: {$components['patch']}\n";
```

### Example 5: Provisioning History

```php
$tenant = Tenant::find(1);

// Get all history for tenant
$history = TenantTemplateHistory::where('tenant_id', $tenant->id)
    ->latest()
    ->get();

foreach ($history as $record) {
    echo "{$record->getActionName()}: {$record->status}\n";

    if ($record->isCompleted()) {
        $duration = $record->getDuration();
        echo "Completed in {$duration} seconds\n";
    } elseif ($record->hasFailed()) {
        echo "Failed: {$record->error_message}\n";
    }
}
```

### Example 6: Find Tenants with Customized Schemas

```php
$customizedTenants = Tenant::where('schema_status', 'customized')
    ->with('template')
    ->get();

foreach ($customizedTenants as $tenant) {
    echo "{$tenant->name} has customized schema\n";
    echo "Template: {$tenant->template->name}\n";
    echo "Expected hash: {$tenant->initial_schema_hash}\n";
    echo "Current hash: {$tenant->current_schema_hash}\n";
}
```

---

**Next:** [07 - Schema Drift Detection](07-schema-drift-detection.md)
