# Schema Drift Detection - Developer Guide

**Tracking Database Customizations and Deviations**

---

## Table of Contents

1. [Overview](#overview)
2. [How Schema Hashing Works](#how-schema-hashing-works)
3. [Schema Status States](#schema-status-states)
4. [Drift Detection Algorithm](#drift-detection-algorithm)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)

---

## Overview

**Schema drift** occurs when a tenant's database structure deviates from the template it was provisioned from. This can happen when:

- Tenant adds custom tables
- Tenant modifies existing table structures
- Tenant adds/removes columns
- Tenant creates custom indexes
- Tenant makes direct database changes outside the application

### Why Drift Detection Matters

1. **Version Updates**: Knowing if a tenant has customized their schema is critical before applying version updates
2. **Troubleshooting**: Drift can cause unexpected behavior or errors
3. **Support**: Understanding customizations helps support teams
4. **Compliance**: Some industries require tracking all schema changes

### How It Works

```
Template Applied
      ↓
Calculate Schema Hash (SHA-256)
      ↓
Store as initial_schema_hash
      ↓
      ┌─────────────────────────────┐
      │  Tenant Uses Database       │
      │  (may add custom tables)    │
      └─────────────────────────────┘
      ↓
Periodic Drift Check
      ↓
Calculate Current Schema Hash
      ↓
Compare: current_schema_hash vs initial_schema_hash
      ↓
      ├─ MATCH → schema_status = 'synced'
      └─ DIFFERENT → schema_status = 'customized'
```

---

## How Schema Hashing Works

### Hash Calculation Algorithm

The system calculates a **SHA-256 hash** of the entire database schema:

```php
// app/Contexts/Platform/Application/Services/TemplateProvisioningService.php

private function calculateSchemaHash(string $database): string
{
    // Connect to tenant database
    config(['database.connections.tenant.database' => $database]);
    DB::purge('tenant');
    DB::reconnect('tenant');

    // Get all tables
    $tables = DB::connection('tenant')->select(
        "SELECT TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ?",
        [$database]
    );

    // Get structure for each table
    $schemaData = [];
    foreach ($tables as $table) {
        $tableName = $table->TABLE_NAME;

        // Get column definitions
        $columns = DB::connection('tenant')->select(
            "DESCRIBE {$tableName}"
        );

        $schemaData[$tableName] = $columns;
    }

    // Generate hash
    return hash('sha256', json_encode($schemaData));
}
```

### What's Included in Hash

The hash includes:

✅ **Included:**
- Table names
- Column names
- Column data types
- Column nullability
- Column default values
- Column keys (primary, foreign, indexes)
- Column extra attributes (auto_increment, etc.)

❌ **Not Included:**
- Table data (INSERT/UPDATE/DELETE doesn't change hash)
- Auto-increment counters
- Table statistics
- Index statistics

### Hash Format

```php
// Example hash (64 characters)
"a3f7b2c8d1e9f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1"
```

---

## Schema Status States

The `schema_status` column on the `tenants` table tracks the current state:

### 1. unknown (Default)

**When:** Tenant created but template not yet applied

```php
$tenant = Tenant::create([
    'name' => 'New Party',
    'slug' => 'new-party',
    'schema_status' => 'unknown', // Default
]);
```

**Meaning:**
- Database exists but no template applied
- No baseline schema hash
- Cannot detect drift

### 2. synced

**When:** Schema matches template exactly

```php
// After template application
$tenant->schema_status = 'synced';
$tenant->initial_schema_hash = 'a3f7b2c8...';
$tenant->current_schema_hash = 'a3f7b2c8...'; // Same as initial
```

**Meaning:**
- Database structure matches template
- No customizations detected
- Safe to apply version updates automatically

### 3. customized

**When:** Schema differs from template

```php
// After drift detection
$tenant->schema_status = 'customized';
$tenant->initial_schema_hash = 'a3f7b2c8...'; // Original
$tenant->current_schema_hash = 'b4f8c3d9...'; // Different!
```

**Meaning:**
- Tenant has made custom changes
- Version updates require manual review
- Customizations may be lost during update

### 4. outdated

**When:** Template has newer version available

```php
// Template version updated
$tenant->template_version = '1.0.0';
$currentTemplateVersion = '1.1.0'; // Newer available

$tenant->schema_status = 'outdated';
```

**Meaning:**
- Tenant is using old template version
- Should consider upgrading
- May be missing new features

### 5. failed

**When:** Last provisioning/update failed

```php
// After failed template application
$tenant->schema_status = 'failed';
```

**Meaning:**
- Template application or update failed
- Database may be in inconsistent state
- Manual intervention required

---

## Drift Detection Algorithm

### Full Drift Check

```php
// Manual drift check for a tenant

use App\Models\Tenant;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;

$tenant = Tenant::find(1);
$service = new TemplateProvisioningService();

// Calculate current hash
$database = $tenant->getDatabaseName();
$currentHash = $service->calculateSchemaHash($database); // Using reflection to call private method

// Compare with initial hash
if ($currentHash === $tenant->initial_schema_hash) {
    $tenant->update([
        'current_schema_hash' => $currentHash,
        'schema_status' => 'synced',
        'last_schema_sync' => now(),
    ]);

    echo "✅ Schema is synced\n";
} else {
    $tenant->update([
        'current_schema_hash' => $currentHash,
        'schema_status' => 'customized',
        'last_schema_sync' => now(),
    ]);

    echo "⚠️  Schema has been customized\n";
    echo "Initial hash: {$tenant->initial_schema_hash}\n";
    echo "Current hash: {$currentHash}\n";
}
```

### Scheduled Drift Detection

Create artisan command to run nightly:

```php
// app/Console/Commands/DetectSchemaDrift.php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use Illuminate\Console\Command;

class DetectSchemaDrift extends Command
{
    protected $signature = 'tenants:detect-drift {--tenant= : Specific tenant slug}';
    protected $description = 'Detect schema drift for tenants';

    public function handle()
    {
        $service = new TemplateProvisioningService();

        $query = Tenant::whereNotNull('template_id')
            ->where('schema_status', '!=', 'unknown');

        if ($this->option('tenant')) {
            $query->where('slug', $this->option('tenant'));
        }

        $tenants = $query->get();

        $this->info("Checking {$tenants->count()} tenants for schema drift...");

        $synced = 0;
        $customized = 0;
        $errors = 0;

        foreach ($tenants as $tenant) {
            try {
                $database = $tenant->getDatabaseName();

                // Use reflection to access private method
                $reflection = new \ReflectionClass($service);
                $method = $reflection->getMethod('calculateSchemaHash');
                $method->setAccessible(true);
                $currentHash = $method->invoke($service, $database);

                if ($currentHash === $tenant->initial_schema_hash) {
                    $tenant->update([
                        'current_schema_hash' => $currentHash,
                        'schema_status' => 'synced',
                        'last_schema_sync' => now(),
                    ]);
                    $synced++;
                    $this->line("  ✅ {$tenant->name}: synced");
                } else {
                    $tenant->update([
                        'current_schema_hash' => $currentHash,
                        'schema_status' => 'customized',
                        'last_schema_sync' => now(),
                    ]);
                    $customized++;
                    $this->warn("  ⚠️  {$tenant->name}: customized");
                }
            } catch (\Exception $e) {
                $errors++;
                $this->error("  ❌ {$tenant->name}: {$e->getMessage()}");
            }
        }

        $this->newLine();
        $this->info("Results:");
        $this->line("  Synced: {$synced}");
        $this->line("  Customized: {$customized}");
        $this->line("  Errors: {$errors}");
    }
}
```

**Schedule in** `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule)
{
    // Run nightly at 2 AM
    $schedule->command('tenants:detect-drift')
        ->dailyAt('02:00')
        ->emailOutputOnFailure('admin@example.com');
}
```

---

## Usage Examples

### Example 1: Check Drift Before Version Update

```php
use App\Models\Tenant;
use App\Models\TemplateVersion;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;

$tenant = Tenant::find(1);
$newVersion = TemplateVersion::where('version', '1.1.0')->first();

// Check for drift first
if ($tenant->schema_status === 'customized') {
    echo "⚠️  WARNING: Tenant has customized schema!\n";
    echo "Updating may overwrite customizations.\n";

    $confirm = readline("Continue anyway? (yes/no): ");

    if ($confirm !== 'yes') {
        echo "Update cancelled.\n";
        exit;
    }
}

// Proceed with update
$service = new TemplateProvisioningService();
$history = $service->updateTemplateVersion($tenant, $newVersion);

echo "✅ Updated to version {$newVersion->version}\n";
```

### Example 2: Identify Customized Tables

To find WHAT was customized, you need to compare schemas manually:

```php
$tenant = Tenant::find(1);
$database = $tenant->getDatabaseName();

// Connect to tenant database
config(['database.connections.tenant.database' => $database]);
DB::purge('tenant');
DB::reconnect('tenant');

// Get current tables
$currentTables = DB::connection('tenant')->select(
    "SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?",
    [$database]
);

$currentTableNames = array_map(fn($t) => $t->TABLE_NAME, $currentTables);

// Get template tables (from template SQL - would need parsing)
$template = $tenant->template;
// ... parse $template->schema_sql to get expected table names ...
$expectedTableNames = ['permissions', 'roles', 'party_members', /* ... */];

// Find extra tables (customizations)
$extraTables = array_diff($currentTableNames, $expectedTableNames);

if (!empty($extraTables)) {
    echo "Custom tables found:\n";
    foreach ($extraTables as $table) {
        echo "  - {$table}\n";
    }
}
```

### Example 3: Generate Drift Report

```php
use App\Models\Tenant;

// Find all customized tenants
$customizedTenants = Tenant::where('schema_status', 'customized')
    ->with('template')
    ->get();

echo "Schema Drift Report\n";
echo "===================\n\n";

foreach ($customizedTenants as $tenant) {
    echo "Tenant: {$tenant->name}\n";
    echo "Template: {$tenant->template->name} v{$tenant->template_version}\n";
    echo "Last sync: {$tenant->last_schema_sync}\n";
    echo "Initial hash: {$tenant->initial_schema_hash}\n";
    echo "Current hash: {$tenant->current_schema_hash}\n";
    echo "\n";
}

echo "Total customized tenants: {$customizedTenants->count()}\n";
```

### Example 4: Fix Drift (Re-sync)

**WARNING**: This will DROP all custom tables and reset to template!

```php
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;

$tenant = Tenant::find(1);

if ($tenant->schema_status !== 'customized') {
    echo "Tenant schema is not customized.\n";
    exit;
}

// Confirm action
echo "⚠️  WARNING: This will RESET database to template!\n";
echo "ALL custom tables and columns will be LOST!\n";
$confirm = readline("Type 'RESET' to continue: ");

if ($confirm !== 'RESET') {
    echo "Cancelled.\n";
    exit;
}

// Drop all tables
$database = $tenant->getDatabaseName();
config(['database.connections.tenant.database' => $database]);
DB::purge('tenant');
DB::reconnect('tenant');

DB::connection('tenant')->statement('SET FOREIGN_KEY_CHECKS=0');

$tables = DB::connection('tenant')->select(
    "SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?",
    [$database]
);

foreach ($tables as $table) {
    $tableName = $table->TABLE_NAME;
    DB::connection('tenant')->statement("DROP TABLE IF EXISTS {$tableName}");
    echo "Dropped: {$tableName}\n";
}

DB::connection('tenant')->statement('SET FOREIGN_KEY_CHECKS=1');

// Re-apply template
$service = new TemplateProvisioningService();
$template = $tenant->template;

$history = $service->applyTemplate($tenant, $template);

echo "✅ Template re-applied successfully\n";
echo "Schema status: {$tenant->fresh()->schema_status}\n";
```

---

## Best Practices

### 1. Run Drift Detection Regularly

✅ **DO:**
- Schedule nightly drift detection
- Email alerts when drift detected
- Log drift events

❌ **DON'T:**
- Only check drift when problems occur
- Ignore customized tenants
- Apply updates without drift check

### 2. Document Customizations

✅ **DO:**
- Store customization details in `template_customizations` JSON field
- Require approval for schema changes
- Keep changelog of custom tables

**Example:**
```php
$tenant->update([
    'template_customizations' => [
        'custom_tables' => [
            'special_members' => 'Created 2025-12-10 for VIP tracking',
            'donation_receipts' => 'Created 2025-12-11 for EC compliance',
        ],
        'modified_tables' => [
            'party_members' => 'Added custom_field_1 column on 2025-12-09',
        ],
    ],
]);
```

### 3. Version Update Strategy

✅ **DO:**
- Check drift before all updates
- Test updates on copy of customized tenants
- Provide migration scripts for common customizations

❌ **DON'T:**
- Force updates on customized schemas
- Assume updates are safe
- Ignore tenant feedback after updates

### 4. Prevent Unwanted Drift

✅ **DO:**
- Educate tenant admins about risks of direct DB changes
- Provide UI for common customizations
- Offer "custom fields" feature in template

❌ **DON'T:**
- Give tenant users direct database access
- Encourage workarounds via SQL
- Make templates too rigid

### 5. Performance Optimization

✅ **DO:**
- Cache hash calculations
- Run drift detection during off-peak hours
- Use database indexes for faster schema queries

**Example with caching:**
```php
use Illuminate\Support\Facades\Cache;

$cacheKey = "tenant_schema_hash_{$tenant->id}";

$currentHash = Cache::remember($cacheKey, 3600, function () use ($tenant, $service) {
    $database = $tenant->getDatabaseName();

    $reflection = new \ReflectionClass($service);
    $method = $reflection->getMethod('calculateSchemaHash');
    $method->setAccessible(true);

    return $method->invoke($service, $database);
});
```

---

## Troubleshooting

### Problem: Hash Changes Even Without Customizations

**Cause:** Auto-increment values, table statistics, or MySQL version differences can affect `DESCRIBE` output.

**Solution:** Ensure hash calculation only includes structural data, not statistics.

### Problem: Drift Detection Slow for Large Databases

**Cause:** Querying INFORMATION_SCHEMA for 100+ tables is slow.

**Solution:**
- Cache hashes for longer periods
- Run detection asynchronously (queue job)
- Sample tables instead of all tables

### Problem: False Positives on Index Names

**Cause:** MySQL auto-generates index names that may vary.

**Solution:** Normalize index names in hash calculation or exclude auto-generated indexes.

---

**Next:** [08 - Testing Guide](08-testing-guide.md)
