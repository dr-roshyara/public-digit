# Troubleshooting - Developer Guide

**Common Errors, Debugging Techniques, and Solutions**

---

## Table of Contents

1. [Common Errors](#common-errors)
2. [Debugging Techniques](#debugging-techniques)
3. [Performance Issues](#performance-issues)
4. [FAQ](#faq)

---

## Common Errors

### Error 1: Foreign Key Type Mismatch

**Error Message:**
```
SQLSTATE[HY000]: General error: 3780 Referencing column 'tenant_id' and referenced column 'id' in foreign key constraint 'tenant_template_history_tenant_id_foreign' are incompatible.
```

**Cause:** The `tenants.id` column is UUID (char(36)) but foreign key is defined as bigint.

**Solution:**
```php
// ❌ WRONG
$table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');

// ✅ CORRECT
$table->char('tenant_id', 36)->comment('References tenants.id (UUID)');
$table->foreign('tenant_id')
      ->references('id')
      ->on('tenants')
      ->onDelete('cascade');
```

**Prevention:** Always check the referenced column type before creating foreign keys.

---

### Error 2: Template Not Active

**Error Message:**
```
RuntimeException: Template 'political_party' is not active
```

**Cause:** Trying to apply an inactive template.

**Solution:**
```php
// Check template status before applying
$template = TenantTemplate::where('slug', 'political_party')->first();

if (!$template->is_active) {
    // Activate template
    $template->update(['is_active' => true]);
}

// Now apply
$service->applyTemplate($tenant, $template);
```

**Prevention:** Always use `TenantTemplate::active()` scope when fetching templates.

---

### Error 3: Database Does Not Exist

**Error Message:**
```
SQLSTATE[HY000] [1049] Unknown database 'tenant_nepal_congress'
```

**Cause:** Tenant database not created before applying template.

**Solution:**
```php
use Illuminate\Support\Facades\DB;

$tenant = Tenant::findBySlug('nepal-congress');
$database = $tenant->getDatabaseName();

// Create database first
DB::statement("CREATE DATABASE IF NOT EXISTS {$database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

// Then apply template
$service->applyTemplate($tenant, $template);
```

**Prevention:** Always create tenant database before provisioning.

---

### Error 4: Table Already Exists

**Error Message:**
```
SQLSTATE[42S01]: Base table or view already exists: 1050 Table 'permissions' already exists
```

**Cause:** Previous provisioning attempt left tables in database.

**Solution:**
```php
// Drop all tables before retrying
$database = $tenant->getDatabaseName();

config(['database.connections.tenant.database' => $database]);
DB::purge('tenant');
DB::reconnect('tenant');

// Disable foreign key checks
DB::connection('tenant')->statement('SET FOREIGN_KEY_CHECKS=0');

// Get all tables
$tables = DB::connection('tenant')->select(
    "SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?",
    [$database]
);

// Drop each table
foreach ($tables as $table) {
    $tableName = $table->TABLE_NAME;
    DB::connection('tenant')->statement("DROP TABLE IF EXISTS {$tableName}");
}

// Re-enable foreign key checks
DB::connection('tenant')->statement('SET FOREIGN_KEY_CHECKS=1');

// Now retry template application
$service->applyTemplate($tenant, $template);
```

**Prevention:** Use `IF NOT EXISTS` in all CREATE TABLE statements.

---

### Error 5: No Active Transaction

**Error Message:**
```
PDOException: There is no active transaction
```

**Cause:** Trying to commit a transaction that wasn't started, or DDL statements (CREATE TABLE) auto-commit in MySQL.

**Solution:**
```php
// ❌ WRONG - DDL statements can't be in transactions
DB::transaction(function () {
    DB::connection('tenant')->statement('CREATE TABLE users (id INT)');
});

// ✅ CORRECT - Execute DDL directly
DB::connection('tenant')->statement('CREATE TABLE users (id INT)');
```

**Prevention:** Don't wrap DDL statements in transactions.

---

### Error 6: preg_split Returns False

**Error Message:**
```
TypeError: array_map(): Argument #2 ($array) must be of type array, false given
```

**Cause:** Complex regex in `preg_split()` failed and returned false.

**Solution:**
```php
// ❌ WRONG - Complex regex that may fail
$statements = preg_split('/;(?=(?:[^\'"]|\'[^\']*\'|"[^"]*")*$)/', $sql);

// ✅ CORRECT - Simple split with validation
$statements = explode(';', $sql);
$statements = array_filter(array_map('trim', $statements));

if (empty($statements)) {
    throw new RuntimeException('No SQL statements found');
}
```

**Prevention:** Use simple string operations and validate results.

---

### Error 7: Duplicate Index Name

**Error Message:**
```
SQLSTATE[42000]: Syntax error or access violation: 1061 Duplicate key name 'tenant_template_history_status_index'
```

**Cause:** Index defined twice in migration.

**Solution:**
```php
// Check migration file for duplicate index definitions
// Remove the duplicate

// ✅ Keep only one
$table->enum('status', [...])->default('pending')->index();

// ❌ Remove this duplicate
// $table->index('status');
```

**Prevention:** Review migration files before running.

---

### Error 8: Module Dependency Not Met

**Error Message:**
```
RuntimeException: Module 'advanced_elections' requires module 'rbac' but it is not installed
```

**Cause:** Trying to install module without its dependencies.

**Solution:**
```php
$module = TemplateModule::where('slug', 'advanced_elections')->first();

// Check dependencies
if ($module->hasDependencies()) {
    $dependencies = $module->getDependentModules();

    foreach ($dependencies as $dep) {
        // Install dependency first
        $service->addModule($tenant, $dep);
    }
}

// Now install the module
$service->addModule($tenant, $module);
```

**Prevention:** Always install dependencies before dependent modules.

---

### Error 9: Migration SQL Missing

**Error Message:**
```
RuntimeException: Migration SQL not available for version 1.1.0
```

**Cause:** Trying to update to version without migration SQL.

**Solution:**
```php
// Check if migration SQL exists before updating
$newVersion = TemplateVersion::where('version', '1.1.0')->first();

if (empty($newVersion->migration_sql)) {
    throw new RuntimeException("Cannot update to version {$newVersion->version}: no migration SQL");
}

// Safe to update
$service->updateTemplateVersion($tenant, $newVersion);
```

**Prevention:** Always provide migration_sql for new versions.

---

### Error 10: Connection Not Found

**Error Message:**
```
InvalidArgumentException: Database connection [tenant] not configured.
```

**Cause:** Tenant database connection not defined in config.

**Solution:**
```php
// Ensure tenant connection exists in config/database.php
'connections' => [
    'tenant' => [
        'driver' => 'mysql',
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '3306'),
        'database' => null, // Set dynamically
        'username' => env('DB_USERNAME', 'forge'),
        'password' => env('DB_PASSWORD', ''),
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
        'prefix' => '',
        'strict' => true,
        'engine' => null,
    ],
],
```

**Prevention:** Verify database configuration before provisioning.

---

## Debugging Techniques

### Enable SQL Query Logging

```php
use Illuminate\Support\Facades\DB;

// Enable query log
DB::connection('tenant')->enableQueryLog();

// Execute provisioning
$service->applyTemplate($tenant, $template);

// Get executed queries
$queries = DB::connection('tenant')->getQueryLog();

foreach ($queries as $query) {
    echo $query['query'] . "\n";
    echo "Bindings: " . json_encode($query['bindings']) . "\n";
    echo "Time: {$query['time']}ms\n\n";
}
```

### Add Detailed Logging to Service

```php
// app/Contexts/Platform/Application/Services/TemplateProvisioningService.php

use Illuminate\Support\Facades\Log;

private function executeSQL(string $database, string $sql, string $context = 'unknown'): void
{
    Log::info('Executing SQL', [
        'database' => $database,
        'context' => $context,
        'sql_length' => strlen($sql),
    ]);

    // ... existing code ...

    foreach ($statements as $index => $statement) {
        Log::debug('Executing statement', [
            'index' => $index,
            'statement' => substr($statement, 0, 200), // First 200 chars
        ]);

        try {
            DB::connection('tenant')->statement($statement);
            Log::debug('Statement executed successfully', ['index' => $index]);
        } catch (Exception $e) {
            Log::error('Statement failed', [
                'index' => $index,
                'error' => $e->getMessage(),
                'statement' => $statement,
            ]);
            throw $e;
        }
    }
}
```

### Check Logs

```bash
# Watch logs in real-time
tail -f storage/logs/laravel.log

# Filter for template provisioning
tail -f storage/logs/laravel.log | grep "template provisioning"

# Filter for SQL execution
tail -f storage/logs/laravel.log | grep "SQL execution"

# Filter for errors
tail -f storage/logs/laravel.log | grep "ERROR"
```

### Use Tinker for Interactive Debugging

```bash
php artisan tinker
```

```php
// In tinker

use App\Contracts\TenantInterface;
use App\Models\Tenant;  // Implements TenantInterface
use App\Models\TenantTemplate;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;

// Get tenant and template
$tenant = Tenant::findBySlug('test-tenant');
$template = TenantTemplate::where('slug', 'political_party')->first();

// Check tenant database exists
$database = $tenant->getDatabaseName();
$exists = DB::select("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", [$database]);
echo empty($exists) ? "Database DOES NOT exist\n" : "Database exists\n";

// Check template is active
echo $template->is_active ? "Template is active\n" : "Template is INACTIVE\n";

// Check template has schema SQL
echo empty($template->schema_sql) ? "NO schema SQL\n" : "Schema SQL exists (" . strlen($template->schema_sql) . " bytes)\n";

// Try applying template
$service = new TemplateProvisioningService();
$history = $service->applyTemplate($tenant, $template);

// Check result
echo "Status: {$history->status}\n";
if ($history->hasFailed()) {
    echo "Error: {$history->error_message}\n";
}
```

### Verify Table Creation

```php
// Check if tables were created
config(['database.connections.tenant.database' => $database]);
DB::purge('tenant');
DB::reconnect('tenant');

$tables = DB::connection('tenant')->select(
    "SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?",
    [$database]
);

echo "Tables created: " . count($tables) . "\n";
foreach ($tables as $table) {
    echo "  - {$table->TABLE_NAME}\n";
}
```

### Check Schema Hash

```php
// Calculate and compare schema hashes
$tenant = Tenant::find(1);
$service = new TemplateProvisioningService();

// Use reflection to access private method
$reflection = new \ReflectionClass($service);
$method = $reflection->getMethod('calculateSchemaHash');
$method->setAccessible(true);

$currentHash = $method->invoke($service, $tenant->getDatabaseName());

echo "Initial hash:  {$tenant->initial_schema_hash}\n";
echo "Current hash:  {$currentHash}\n";
echo "Match: " . ($currentHash === $tenant->initial_schema_hash ? 'YES' : 'NO') . "\n";
```

---

## Performance Issues

### Issue 1: Slow Template Application

**Symptom:** Template application takes 30+ seconds.

**Causes:**
1. Large schema SQL (1000+ lines)
2. Many INSERT statements in seed SQL
3. Slow database connection
4. No indexes on foreign keys

**Solutions:**

```php
// 1. Split large SQL files into smaller chunks
private function executeSQL(string $database, string $sql, string $context = 'unknown'): void
{
    $statements = $this->splitSQLStatements($sql);

    // Execute in batches of 50
    $batches = array_chunk($statements, 50);

    foreach ($batches as $batchIndex => $batch) {
        Log::info("Executing batch {$batchIndex}", ['size' => count($batch)]);

        foreach ($batch as $statement) {
            DB::connection('tenant')->statement($statement);
        }
    }
}

// 2. Use bulk inserts in seed SQL
// ❌ SLOW: Multiple INSERT statements
INSERT INTO roles (name, guard_name) VALUES ('admin', 'web');
INSERT INTO roles (name, guard_name) VALUES ('user', 'web');

// ✅ FAST: Single bulk INSERT
INSERT INTO roles (name, guard_name) VALUES
('admin', 'web'),
('user', 'web'),
('editor', 'web');

// 3. Add indexes in schema SQL
CREATE TABLE party_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_number VARCHAR(20) NOT NULL,
    INDEX idx_membership_number (membership_number) -- Add index
);
```

---

### Issue 2: Slow Drift Detection

**Symptom:** Drift detection takes 5+ minutes for large databases.

**Causes:**
1. 100+ tables in database
2. Querying INFORMATION_SCHEMA for each table
3. No caching

**Solutions:**

```php
// 1. Cache schema hashes
use Illuminate\Support\Facades\Cache;

$cacheKey = "tenant_schema_hash_{$tenant->id}";

$currentHash = Cache::remember($cacheKey, 3600, function () use ($tenant, $service) {
    return $this->calculateSchemaHash($tenant->getDatabaseName());
});

// 2. Run drift detection asynchronously
// Create job: app/Jobs/DetectSchemaDrift.php
namespace App\Jobs;

use App\Models\Tenant;  // Jobs use concrete model for serialization
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class DetectSchemaDrift implements ShouldQueue
{
    use InteractsWithQueue, Queueable;

    // Note: Jobs use concrete Tenant model (not interface) for queue serialization
    public function __construct(public Tenant $tenant) {}

    public function handle(): void
    {
        $service = new TemplateProvisioningService();
        // ... drift detection logic ...
    }
}

// Dispatch job
DetectSchemaDrift::dispatch($tenant);

// 3. Sample tables instead of checking all
private function calculateSchemaHashFast(string $database): string
{
    // Only hash core tables, not all tables
    $coreTables = ['permissions', 'roles', 'party_members', 'elections'];

    $schemaData = [];
    foreach ($coreTables as $tableName) {
        if (Schema::connection('tenant')->hasTable($tableName)) {
            $columns = DB::connection('tenant')->select("DESCRIBE {$tableName}");
            $schemaData[$tableName] = $columns;
        }
    }

    return hash('sha256', json_encode($schemaData));
}
```

---

### Issue 3: High Memory Usage

**Symptom:** PHP runs out of memory during provisioning.

**Causes:**
1. Loading entire SQL file into memory
2. Large seed data (10,000+ rows)

**Solutions:**

```php
// 1. Stream SQL file instead of loading all at once
use Illuminate\Support\Facades\File;

private function executeSQL(string $database, string $sqlFile): void
{
    $handle = fopen($sqlFile, 'r');
    $statement = '';

    while (($line = fgets($handle)) !== false) {
        // Skip comments
        if (preg_match('/^\s*--/', $line)) {
            continue;
        }

        $statement .= $line;

        // Execute when we hit semicolon
        if (str_ends_with(trim($line), ';')) {
            DB::connection('tenant')->statement($statement);
            $statement = ''; // Reset
        }
    }

    fclose($handle);
}

// 2. Increase PHP memory limit in config
// php.ini or .env
memory_limit = 512M
```

---

## FAQ

### Q1: Can I apply multiple templates to one tenant?

**A:** No. Each tenant can only have one template. However, you can add multiple modules to a template.

**Alternative:** Create a "composite" template that includes features from multiple templates.

---

### Q2: Can I modify a template after tenants are using it?

**A:** Yes, but create a new version instead of modifying the existing one.

**Steps:**
1. Create new version with `migration_sql`
2. Test migration on copy of production database
3. Update tenants using `updateTemplateVersion()`

---

### Q3: What happens if template application fails halfway?

**A:** The service automatically attempts rollback:
- Clears template metadata from tenant record
- Marks history as failed
- Does NOT drop database tables (admin must manually clean up)

**Recommendation:** Drop tenant database and recreate before retrying.

---

### Q4: Can I customize a tenant's database after provisioning?

**A:** Yes, but:
- Schema status will change to "customized"
- Version updates may overwrite customizations
- Drift will be detected

**Best Practice:** Use `template_customizations` field to document changes.

---

### Q5: How do I test template changes before production?

**A:**
1. Create test tenant
2. Apply template to test tenant
3. Verify all tables created
4. Test application functionality
5. Drop test tenant database
6. If successful, apply to production tenants

---

### Q6: Can I rollback a version update?

**A:** Yes, if the version has `rollback_sql` defined.

**Manual rollback:**
```php
$version = TemplateVersion::where('version', '1.0.0')->first();

if ($version->canRollback()) {
    // Execute rollback SQL
    $database = $tenant->getDatabaseName();
    config(['database.connections.tenant.database' => $database]);
    DB::purge('tenant');
    DB::reconnect('tenant');

    DB::connection('tenant')->statement($version->rollback_sql);

    $tenant->update(['template_version' => $version->previous_version]);
}
```

---

### Q7: How do I debug "Table not found" errors in production?

**A:**
```php
// Check if table exists
$database = $tenant->getDatabaseName();
config(['database.connections.tenant.database' => $database]);
DB::purge('tenant');

$exists = Schema::connection('tenant')->hasTable('party_members');

if (!$exists) {
    // Table missing - check provisioning history
    $history = TenantTemplateHistory::where('tenant_id', $tenant->id)
        ->latest()
        ->first();

    if ($history && $history->hasFailed()) {
        echo "Last provisioning failed: {$history->error_message}";
    }

    // Re-apply template
    $service->applyTemplate($tenant, $tenant->template);
}
```

---

### Q8: Can I have different templates for development and production?

**A:** Yes. Use different template records:

```php
// Seed different templates per environment
if (app()->environment('local')) {
    TenantTemplate::create([
        'slug' => 'political_party_dev',
        'schema_sql' => File::get(base_path('database/templates/political_party/schema_dev.sql')),
        // ... minimal seed data for testing
    ]);
} else {
    TenantTemplate::create([
        'slug' => 'political_party',
        'schema_sql' => File::get(base_path('database/templates/political_party/schema.sql')),
        // ... full production seed data
    ]);
}
```

---

### Q9: How do I migrate existing tenant databases to use templates?

**A:**
1. Calculate schema hash of existing database
2. Find matching template
3. Update tenant record with template metadata
4. Mark schema as "customized" if not exact match

```php
$tenant = Tenant::find(1);
$template = TenantTemplate::where('slug', 'political_party')->first();

$service = new TemplateProvisioningService();
$reflection = new \ReflectionClass($service);
$method = $reflection->getMethod('calculateSchemaHash');
$method->setAccessible(true);

$currentHash = $method->invoke($service, $tenant->getDatabaseName());

$tenant->update([
    'template_id' => $template->id,
    'template_version' => $template->version,
    'initial_schema_hash' => $currentHash,
    'current_schema_hash' => $currentHash,
    'schema_status' => 'customized', // Assume customized
]);
```

---

### Q10: What's the best way to handle Nepal-specific data (provinces, districts)?

**A:** Include it in seed SQL:

```sql
-- database/templates/political_party/seed.sql

-- Insert 7 provinces
INSERT INTO provinces (code, name_en, name_np) VALUES
('P1', 'Koshi', 'कोशी'),
('P2', 'Madhesh', 'मधेश'),
-- ... all 7 provinces

-- Insert 77 districts
INSERT INTO districts (code, name_en, name_np, province_code) VALUES
('KTM', 'Kathmandu', 'काठमाडौं', 'P3'),
-- ... all 77 districts

-- Insert 753 local levels
-- ...
```

Alternatively, create a separate "nepal_geography" module that can be shared across all templates.

---

**End of Documentation**

For additional help:
- Check Laravel logs: `storage/logs/laravel.log`
- Review test files: `tests/Feature/TemplateProvisioningTest.php`
- Consult architecture docs: `01-architecture-overview.md`
