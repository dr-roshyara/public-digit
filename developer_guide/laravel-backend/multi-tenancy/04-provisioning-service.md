# Provisioning Service - Developer Guide

**TemplateProvisioningService API Documentation**

---

## ⚠️ Package-Agnostic Abstraction (Updated 2025-12-13)

The `TemplateProvisioningService` now uses `TenantInterface` instead of the concrete `Tenant` model. This makes it **package-agnostic** and able to work with any tenancy package (Spatie, Stancl, or custom).

**What changed:**
- ✅ Method signatures use `TenantInterface $tenant` instead of `Tenant $tenant`
- ✅ Service works with ANY tenant implementation
- ✅ All existing code still works (Tenant implements TenantInterface)

For details, see: `ABSTRACTION_LAYER_IMPLEMENTATION_COMPLETE.md`

---

## Table of Contents

1. [Overview](#overview)
2. [Service API](#service-api)
3. [Usage Examples](#usage-examples)
4. [Error Handling](#error-handling)
5. [Internal Methods](#internal-methods)
6. [Workflow Diagrams](#workflow-diagrams)

---

## Overview

The `TemplateProvisioningService` is the core service responsible for applying database templates to tenant databases. It handles:

- Template application to new tenants
- Module installation (required + optional)
- Template version updates
- Module additions to existing tenants
- Schema hash calculation
- Provisioning history tracking
- Automatic rollback on failure

**Location:** `app/Contexts/Platform/Application/Services/TemplateProvisioningService.php`

**Context:** Platform (Landlord-level operations)

**Abstraction:** Uses `TenantInterface` for package-agnostic tenant handling

---

## Service API

### Public Methods

#### 1. applyTemplate()

Apply a complete template to a tenant database.

**Signature:**
```php
public function applyTemplate(
    TenantInterface $tenant,
    TenantTemplate $template,
    array $moduleIds = [],
    array $customizations = []
): TenantTemplateHistory
```

**Parameters:**
- `$tenant` - Tenant instance implementing TenantInterface (must have existing database)
- `$template` - Template to apply
- `$moduleIds` - Array of optional module IDs to install
- `$customizations` - Array of custom configuration values

**Returns:** `TenantTemplateHistory` record with provisioning results

**Throws:** `RuntimeException` on failure

**Example:**
```php
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use App\Contracts\TenantInterface;
use App\Models\Tenant;  // Implements TenantInterface
use App\Models\TenantTemplate;

$service = new TemplateProvisioningService();
$tenant = Tenant::findBySlug('nepal-congress');
$template = TenantTemplate::where('slug', 'political_party')->first();

$history = $service->applyTemplate($tenant, $template);

echo "Status: {$history->status}";
```

**Workflow:**
1. Validate template and modules
2. Create history record (pending)
3. Mark as started
4. Apply required modules (RBAC)
5. Apply core template schema
6. Apply optional modules
7. Run seed data
8. Calculate schema hash
9. Update tenant record
10. Increment template usage
11. Mark as completed

---

#### 2. updateTemplateVersion()

Migrate a tenant to a new template version.

**Signature:**
```php
public function updateTemplateVersion(
    TenantInterface $tenant,
    TemplateVersion $newVersion
): TenantTemplateHistory
```

**Parameters:**
- `$tenant` - Tenant instance implementing TenantInterface
- `$newVersion` - New version to migrate to

**Returns:** `TenantTemplateHistory` record

**Throws:** `RuntimeException` if migration SQL not available or execution fails

**Example:**
```php
$tenant = Tenant::findBySlug('nepal-congress');
$newVersion = TemplateVersion::where('template_id', $tenant->template_id)
    ->where('version', '1.1.0')
    ->first();

$history = $service->updateTemplateVersion($tenant, $newVersion);

echo "Updated from {$history->from_version} to {$history->to_version}";
```

**Requirements:**
- Tenant must already have a template applied
- New version must have `migration_sql` defined
- New version must be for same template

**Workflow:**
1. Create history record (update action)
2. Mark as started
3. Execute migration SQL on tenant database
4. Update tenant version
5. Recalculate schema hash
6. Mark tenant as synced
7. Mark history as completed

---

#### 3. addModule()

Add a module to an existing tenant.

**Signature:**
```php
public function addModule(
    TenantInterface $tenant,
    TemplateModule $module
): TenantTemplateHistory
```

**Parameters:**
- `$tenant` - Tenant to add module to
- `$module` - Module to install

**Returns:** `TenantTemplateHistory` record

**Throws:** `RuntimeException` on dependency check failure or SQL execution error

**Example:**
```php
$tenant = Tenant::findBySlug('nepal-congress');
$advancedElectionsModule = TemplateModule::where('slug', 'advanced_elections')->first();

$history = $service->addModule($tenant, $advancedElectionsModule);

echo "Module added: {$history->changes['module_name']}";
```

**Dependency Check:**
- Validates all module dependencies are already installed
- Throws exception if dependencies missing

**Workflow:**
1. Create history record (module_add action)
2. Mark as started
3. Check module dependencies
4. Apply module migration SQL
5. Update tenant's selected_modules array
6. Mark history as completed

---

## Usage Examples

### Example 1: Basic Template Application

```php
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use App\Models\Tenant;
use App\Models\TenantTemplate;

// Initialize service
$service = new TemplateProvisioningService();

// Get tenant and template
$tenant = Tenant::findBySlug('nrna');
$template = TenantTemplate::where('slug', 'political_party')->first();

// Apply template (with no optional modules)
try {
    $history = $service->applyTemplate($tenant, $template);

    echo "✅ Template applied successfully!\n";
    echo "Duration: {$history->getDuration()} seconds\n";

} catch (RuntimeException $e) {
    echo "❌ Failed: {$e->getMessage()}\n";
}
```

### Example 2: Template with Optional Modules

```php
// Get optional modules
$electionModule = TemplateModule::where('slug', 'advanced_elections')->first();
$financeModule = TemplateModule::where('slug', 'advanced_finance')->first();

$optionalModules = [$electionModule->id, $financeModule->id];

// Apply template with modules
$history = $service->applyTemplate(
    tenant: $tenant,
    template: $template,
    moduleIds: $optionalModules
);

// Verify modules installed
$tenant->refresh();
echo "Modules installed: " . count($tenant->selected_modules ?? []) . "\n";
```

### Example 3: Template with Customizations

```php
// Define customizations
$customizations = [
    'party_code' => 'NC',
    'enable_candidate_self_nomination' => false,
    'require_ec_approval_for_donations' => true,
    'membership_approval_workflow' => 'two_tier',
];

// Apply with customizations
$history = $service->applyTemplate(
    tenant: $tenant,
    template: $template,
    moduleIds: [],
    customizations: $customizations
);

// Check customizations stored
$tenant->refresh();
echo json_encode($tenant->template_customizations, JSON_PRETTY_PRINT);
```

### Example 4: Version Update

```php
$tenant = Tenant::findBySlug('nrna');

// Get current and new version
echo "Current version: {$tenant->template_version}\n";

$newVersion = TemplateVersion::where('template_id', $tenant->template_id)
    ->where('version', '1.1.0')
    ->first();

// Update version
try {
    $history = $service->updateTemplateVersion($tenant, $newVersion);

    echo "✅ Updated to version {$newVersion->version}\n";
    echo "Duration: {$history->getDuration()} seconds\n";

} catch (RuntimeException $e) {
    echo "❌ Update failed: {$e->getMessage()}\n";
}
```

### Example 5: Add Module After Provisioning

```php
$tenant = Tenant::findBySlug('nrna');

// Get module
$eventsModule = TemplateModule::where('slug', 'advanced_events')->first();

// Check dependencies
if (!$eventsModule->dependencies) {
    // No dependencies, safe to install

    $history = $service->addModule($tenant, $eventsModule);

    echo "✅ Module added: {$eventsModule->name}\n";
} else {
    echo "⚠️  Module has dependencies, install those first.\n";
}
```

### Example 6: Complete Workflow with Error Handling

```php
use Illuminate\Support\Facades\Log;

$service = new TemplateProvisioningService();
$tenant = Tenant::findBySlug('test-party');
$template = TenantTemplate::where('slug', 'political_party')->first();

// Apply template with comprehensive error handling
try {
    Log::info("Starting template provisioning", [
        'tenant' => $tenant->slug,
        'template' => $template->slug,
    ]);

    $history = $service->applyTemplate($tenant, $template);

    Log::info("Template provisioning completed", [
        'history_id' => $history->id,
        'duration' => $history->getDuration(),
    ]);

    // Verify results
    $tenant->refresh();

    if ($tenant->schema_status === 'synced') {
        echo "✅ Template applied and synced successfully!\n";
    } else {
        echo "⚠️  Template applied but schema status: {$tenant->schema_status}\n";
    }

} catch (RuntimeException $e) {
    Log::error("Template provisioning failed", [
        'tenant' => $tenant->slug,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
    ]);

    // Check history for error details
    $failedHistory = TenantTemplateHistory::where('tenant_id', $tenant->id)
        ->where('status', 'failed')
        ->latest()
        ->first();

    if ($failedHistory) {
        echo "❌ Provisioning failed:\n";
        echo "   Error: {$failedHistory->error_message}\n";
        echo "   Check logs for details.\n";
    }

    throw $e;
}
```

---

## Error Handling

### Common Exceptions

#### 1. Template Validation Errors

**Exception:** `RuntimeException`

**Causes:**
- Template is not active
- Template has no schema SQL
- Template files missing

**Example:**
```php
try {
    $service->applyTemplate($tenant, $inactiveTemplate);
} catch (RuntimeException $e) {
    if (str_contains($e->getMessage(), 'not active')) {
        echo "Template is disabled. Enable it first.";
    }
}
```

#### 2. Database Errors

**Exception:** `RuntimeException` wrapping `QueryException`

**Causes:**
- Tenant database doesn't exist
- SQL syntax errors in template
- Foreign key constraint violations

**Example:**
```php
try {
    $service->applyTemplate($tenant, $template);
} catch (RuntimeException $e) {
    if (str_contains($e->getMessage(), 'does not exist')) {
        echo "Create tenant database first.";
    }
}
```

#### 3. Module Dependency Errors

**Exception:** `RuntimeException`

**Causes:**
- Required module not included
- Module conflicts with installed modules

**Example:**
```php
try {
    $service->addModule($tenant, $moduleWithDeps);
} catch (RuntimeException $e) {
    if (str_contains($e->getMessage(), 'requires')) {
        echo "Install dependencies first.";
    }
}
```

### Error Recovery

The service automatically attempts rollback on failure:

```php
private function attemptRollback(Tenant $tenant, TenantTemplateHistory $history): void
{
    try {
        // Clear template information from tenant
        $tenant->update([
            'template_id' => null,
            'template_version' => null,
            'selected_modules' => null,
            'schema_status' => 'unknown',
        ]);

        Log::info('Rollback completed');
    } catch (Exception $e) {
        Log::error('Rollback failed', ['error' => $e->getMessage()]);
    }
}
```

**What rollback does:**
- ✅ Clears template metadata from tenant record
- ✅ Marks history as failed with error message
- ❌ Does NOT drop database tables (admin must do this manually)

---

## Internal Methods

### Private Helper Methods

#### validateTemplate()

Validates template integrity before application.

```php
private function validateTemplate(TenantTemplate $template): void
{
    if (!$template->is_active) {
        throw new RuntimeException("Template is not active");
    }

    if (empty($template->schema_sql)) {
        throw new RuntimeException("Template has no schema SQL");
    }
}
```

#### validateModules()

Validates and categorizes modules into required/optional.

```php
private function validateModules(TenantTemplate $template, array $moduleIds): array
{
    $required = $template->getRequiredModules();
    $optional = TemplateModule::whereIn('id', $moduleIds)
        ->where('is_active', true)
        ->get();

    return [
        'required' => $required,
        'optional' => $optional,
    ];
}
```

#### executeSQL()

Executes SQL statements on tenant database.

```php
private function executeSQL(string $database, string $sql, string $context): void
{
    // Switch to tenant database
    config(['database.connections.tenant.database' => $database]);
    DB::purge('tenant');
    DB::reconnect('tenant');

    // Split and execute statements
    $statements = $this->splitSQLStatements($sql);

    foreach ($statements as $statement) {
        DB::connection('tenant')->statement($statement);
    }
}
```

#### splitSQLStatements()

Splits SQL file into individual statements.

```php
private function splitSQLStatements(string $sql): array
{
    // Remove SQL comments
    $lines = explode("\n", $sql);
    $cleanedLines = [];

    foreach ($lines as $line) {
        if (!preg_match('/^\s*--/', $line)) {
            $cleanedLines[] = $line;
        }
    }

    $sql = implode("\n", $cleanedLines);
    $sql = preg_replace('/\/\*.*?\*\//s', '', $sql);

    // Split by semicolon
    return array_filter(array_map('trim', explode(';', $sql)));
}
```

#### calculateSchemaHash()

Calculates SHA-256 hash of tenant schema for drift detection.

```php
private function calculateSchemaHash(string $database): string
{
    config(['database.connections.tenant.database' => $database]);
    DB::purge('tenant');

    $tables = DB::connection('tenant')
        ->select("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?", [$database]);

    $schemaData = [];
    foreach ($tables as $table) {
        $columns = DB::connection('tenant')->select("DESCRIBE {$table->TABLE_NAME}");
        $schemaData[$table->TABLE_NAME] = $columns;
    }

    return hash('sha256', json_encode($schemaData));
}
```

---

## Workflow Diagrams

### Template Application Workflow

```
START
  │
  ├─→ Validate Template & Modules
  │   └─→ Check is_active, schema_sql, module conflicts
  │
  ├─→ Create History Record (pending)
  │
  ├─→ Mark History as Started (in_progress)
  │
  ├─→ Apply Required Modules
  │   ├─→ Execute module.schema_sql
  │   └─→ Execute module.seed_sql
  │
  ├─→ Apply Core Template Schema
  │   ├─→ Execute template.schema_sql
  │   └─→ Execute template.seed_sql
  │
  ├─→ Apply Optional Modules
  │   └─→ For each module: execute SQL
  │
  ├─→ Calculate Schema Hash
  │   └─→ SHA-256 of all table structures
  │
  ├─→ Update Tenant Record
  │   ├─→ template_id
  │   ├─→ template_version
  │   ├─→ initial_schema_hash
  │   ├─→ schema_status = 'synced'
  │   └─→ selected_modules = [...]
  │
  ├─→ Increment Template usage_count
  │
  ├─→ Mark History as Completed
  │
END (Success)

[On Error]
  │
  ├─→ Log Error with Context
  │
  ├─→ Mark History as Failed
  │
  ├─→ Attempt Rollback
  │   └─→ Clear tenant template metadata
  │
  └─→ Throw RuntimeException
```

### Version Update Workflow

```
START
  │
  ├─→ Validate New Version
  │   └─→ Check migration_sql exists
  │
  ├─→ Create History Record (update action)
  │
  ├─→ Mark as Started
  │
  ├─→ Execute Migration SQL
  │   └─→ Apply version-specific changes
  │
  ├─→ Update Tenant Version
  │   ├─→ template_version = new version
  │   └─→ last_schema_sync = now()
  │
  ├─→ Recalculate Schema Hash
  │
  ├─→ Mark Tenant as Synced
  │
  ├─→ Mark History as Completed
  │
END (Success)
```

---

## Best Practices

### 1. Always Check Tenant Has Database

```php
// ✅ Good: Verify database exists
$database = $tenant->getDatabaseName();
$exists = DB::select("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", [$database]);

if (empty($exists)) {
    throw new RuntimeException("Database {$database} does not exist");
}

$service->applyTemplate($tenant, $template);
```

### 2. Use Try-Catch for Production

```php
// ✅ Good: Handle errors gracefully
try {
    $history = $service->applyTemplate($tenant, $template);
    // Success handling
} catch (RuntimeException $e) {
    Log::error('Provisioning failed', ['error' => $e->getMessage()]);
    // Error handling
}
```

### 3. Verify Results After Provisioning

```php
// ✅ Good: Verify provisioning succeeded
$history = $service->applyTemplate($tenant, $template);

$tenant->refresh();

if ($tenant->schema_status !== 'synced') {
    throw new RuntimeException("Schema not synced after provisioning");
}

if ($history->status !== 'completed') {
    throw new RuntimeException("Provisioning not completed");
}
```

### 4. Log Important Events

```php
// ✅ Good: Log for debugging
Log::info('Starting template application', [
    'tenant_id' => $tenant->id,
    'template_id' => $template->id,
]);

$history = $service->applyTemplate($tenant, $template);

Log::info('Template applied', [
    'history_id' => $history->id,
    'duration' => $history->getDuration(),
]);
```

---

**Next:** [05 - Models & Relationships](05-models-relationships.md)
