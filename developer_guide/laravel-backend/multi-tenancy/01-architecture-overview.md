# Architecture Overview

**Multi-Tenancy Template System**

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Design](#database-design)
3. [Component Responsibilities](#component-responsibilities)
4. [Data Flow](#data-flow)
5. [Design Decisions](#design-decisions)

---

## System Architecture

### Architectural Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Admin UI   │  │  Artisan CLI │  │  REST API    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  TemplateProvisioningService                        │    │
│  │  ├─ applyTemplate()                                 │    │
│  │  ├─ updateTemplateVersion()                         │    │
│  │  └─ addModule()                                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │TenantTemplate│  │TemplateModule│  │TemplateVersion│     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────────────────────┐        │
│  │   Tenant     │  │  TenantTemplateHistory       │        │
│  └──────────────┘  └──────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                INFRASTRUCTURE LAYER                          │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │  Landlord Database   │  │  Tenant Databases    │        │
│  │  (election)          │  │  (tenant_xxx)        │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### DDD Context Mapping

This system is part of the **Platform** bounded context:

```
Platform Context
├── TenantManagement (existing)
├── TenantProvisioning (existing)
└── TemplateManagement (NEW)
    ├── Template definition
    ├── Module management
    ├── Version control
    └── Schema drift detection
```

**Integration Points:**
- **TenantAuth Context**: Provides RBAC module
- **ElectionSetup Context**: May provide Election module (future)
- **Shared Context**: Value objects and utilities

---

## Database Design

### Landlord Database Schema

```sql
┌─────────────────────────────────────────────────────────────┐
│                    tenant_templates                          │
├──────────────┬──────────────────────────────────────────────┤
│ id           │ Primary Key                                   │
│ name         │ Template name                                 │
│ slug         │ Unique identifier                             │
│ type         │ Template category                             │
│ version      │ Current version                               │
│ schema_sql   │ Complete database schema (LONGTEXT)           │
│ seed_sql     │ Initial data (LONGTEXT)                       │
│ config       │ Template configuration (JSON)                 │
│ required_modules │ Module IDs (JSON array)                   │
│ optional_modules │ Module IDs (JSON array)                   │
│ is_active    │ Active status                                 │
│ usage_count  │ Number of tenants using this                  │
└──────────────┴──────────────────────────────────────────────┘
              1
              │
              │ hasMany
              ↓
              *
┌─────────────────────────────────────────────────────────────┐
│                   template_modules                           │
├──────────────┬──────────────────────────────────────────────┤
│ id           │ Primary Key                                   │
│ template_id  │ Foreign Key (nullable for global modules)    │
│ name         │ Module name                                   │
│ slug         │ Unique identifier                             │
│ module_type  │ core, feature, integration                    │
│ schema_sql   │ Module schema (LONGTEXT)                      │
│ seed_sql     │ Module seed data (LONGTEXT)                   │
│ migration_sql│ SQL to add module to existing DB              │
│ rollback_sql │ SQL to remove module                          │
│ dependencies │ Required module IDs (JSON)                    │
│ is_optional  │ Can be excluded from template                 │
└──────────────┴──────────────────────────────────────────────┘
              1
              │
              │ hasMany
              ↓
              *
┌─────────────────────────────────────────────────────────────┐
│                   template_versions                          │
├──────────────┬──────────────────────────────────────────────┤
│ id           │ Primary Key                                   │
│ template_id  │ Foreign Key                                   │
│ version      │ Semantic version (1.2.0)                      │
│ previous_version │ Version this upgrades from                │
│ migration_sql│ SQL to migrate from previous                  │
│ rollback_sql │ SQL to rollback                               │
│ schema_sql   │ Complete schema at this version               │
│ is_current   │ Current active version                        │
│ is_breaking  │ Requires manual intervention                  │
└──────────────┴──────────────────────────────────────────────┘
```

### Tenant Table Extensions

```sql
ALTER TABLE tenants ADD (
    -- Template Linkage
    template_id           BIGINT UNSIGNED,
    template_version      VARCHAR(20),
    selected_modules      JSON,
    template_customizations JSON,

    -- Schema Tracking
    initial_schema_hash   VARCHAR(64),
    last_schema_sync      TIMESTAMP,
    schema_status         ENUM('synced', 'drifted', 'customized', 'unknown'),
    is_customized         BOOLEAN,
    customization_count   INT UNSIGNED,
    template_config       JSON,

    FOREIGN KEY (template_id) REFERENCES tenant_templates(id)
);
```

### Provisioning Audit Trail

```sql
┌─────────────────────────────────────────────────────────────┐
│               tenant_template_history                        │
├──────────────┬──────────────────────────────────────────────┤
│ id           │ Primary Key                                   │
│ tenant_id    │ CHAR(36) - UUID reference to tenants         │
│ template_id  │ Foreign Key to tenant_templates              │
│ from_version │ Version before update                         │
│ to_version   │ Version after update                          │
│ action       │ create, update, rollback, module_add/remove   │
│ status       │ pending, in_progress, completed, failed       │
│ started_at   │ Timestamp when action started                 │
│ completed_at │ Timestamp when action completed               │
│ error_message│ Error details if failed                       │
└──────────────┴──────────────────────────────────────────────┘
```

### Relationships Summary

```
TenantTemplate (1) ─→ (N) TemplateModule
TenantTemplate (1) ─→ (N) TemplateVersion
TenantTemplate (1) ─→ (N) Tenant
TenantTemplate (1) ─→ (N) TenantTemplateHistory

Tenant (1) ─→ (N) TenantTemplateHistory
```

---

## Component Responsibilities

### 1. TemplateProvisioningService

**Responsibility:** Apply templates and modules to tenant databases

**Methods:**
- `applyTemplate()` - Apply template to new tenant
- `updateTemplateVersion()` - Migrate tenant to new version
- `addModule()` - Add module to existing tenant

**Key Features:**
- SQL execution with transaction safety
- Schema hash calculation
- History tracking
- Automatic rollback on failure

**File:** `app/Contexts/Platform/Application/Services/TemplateProvisioningService.php`

### 2. TenantTemplate Model

**Responsibility:** Template definition and management

**Relationships:**
- `modules()` - hasMany TemplateModule
- `versions()` - hasMany TemplateVersion
- `tenants()` - hasMany Tenant

**Helper Methods:**
- `getCurrentVersion()`
- `getRequiredModules()`
- `incrementUsage()`

**File:** `app/Models/TenantTemplate.php`

### 3. TemplateModule Model

**Responsibility:** Modular component management

**Key Methods:**
- `getDependentModules()`
- `conflictsWith()`
- `isGlobal()`
- `isCore()`

**File:** `app/Models/TemplateModule.php`

### 4. TemplateVersion Model

**Responsibility:** Version tracking and comparison

**Key Methods:**
- `setAsCurrent()`
- `compareWith()`
- `isNewerThan()`
- `canRollback()`

**File:** `app/Models/TemplateVersion.php`

### 5. TenantTemplateHistory Model

**Responsibility:** Audit trail for provisioning actions

**Status Management:**
- `markAsStarted()`
- `markAsCompleted()`
- `markAsFailed()`

**File:** `app/Models/TenantTemplateHistory.php`

### 6. Tenant Model (Extended)

**New Responsibilities:** Template relationship management

**Template Methods:**
- `hasTemplate()`
- `isSchemaInSync()`
- `hasSchemaDrift()`
- `updateTemplateVersion()`
- `markAsCustomized()`

**File:** `app/Models/Tenant.php`

---

## Data Flow

### Template Application Flow

```
┌─────────────┐
│ Admin/CLI   │
│ Requests    │
│ Template    │
└──────┬──────┘
       │
       │ 1. Get Tenant & Template
       ↓
┌─────────────────────────────────────────┐
│ TemplateProvisioningService             │
├─────────────────────────────────────────┤
│ 2. Validate Template & Modules          │
│ 3. Create History Record (pending)      │
│ 4. Switch to Tenant Database            │
└──────┬──────────────────────────────────┘
       │
       │ 5. Apply Required Modules (RBAC)
       ↓
┌─────────────────────────────────────────┐
│ Tenant Database                          │
│ ├─ Execute Module SQL                   │
│ ├─ Execute Module Seed Data             │
│ └─ Create RBAC tables + seed roles      │
└──────┬──────────────────────────────────┘
       │
       │ 6. Apply Core Template Schema
       ↓
┌─────────────────────────────────────────┐
│ Tenant Database                          │
│ ├─ Execute Template Schema SQL          │
│ ├─ Execute Template Seed SQL            │
│ └─ Create 10 Political Party tables     │
└──────┬──────────────────────────────────┘
       │
       │ 7. Apply Optional Modules (if any)
       │ 8. Calculate Schema Hash
       ↓
┌─────────────────────────────────────────┐
│ Landlord Database                        │
│ ├─ Update Tenant Record                 │
│ │   • template_id                       │
│ │   • template_version                  │
│ │   • initial_schema_hash               │
│ │   • schema_status = 'synced'          │
│ ├─ Update History (completed)           │
│ └─ Increment Template usage_count       │
└─────────────────────────────────────────┘
```

### Version Update Flow

```
┌──────────────┐
│ Request      │
│ Version      │
│ Update       │
└──────┬───────┘
       │
       │ 1. Validate Version
       ↓
┌─────────────────────────────────────────┐
│ TemplateProvisioningService             │
│ ├─ Check if migration SQL exists        │
│ └─ Create History (pending)             │
└──────┬──────────────────────────────────┘
       │
       │ 2. Apply Migration SQL
       ↓
┌─────────────────────────────────────────┐
│ Tenant Database                          │
│ └─ Execute version migration SQL        │
└──────┬──────────────────────────────────┘
       │
       │ 3. Update Tenant & History
       ↓
┌─────────────────────────────────────────┐
│ Landlord Database                        │
│ ├─ Update tenant.template_version       │
│ ├─ Recalculate schema hash              │
│ └─ Mark history as completed            │
└─────────────────────────────────────────┘
```

---

## Design Decisions

### 1. Template Storage: Database vs Files

**Decision:** Hybrid approach

**Rationale:**
- SQL files stored in `database/templates/` for version control
- Template definitions stored in database for runtime management
- Seeder loads SQL files into database at deployment

**Benefits:**
- Git tracks SQL file changes
- Database provides query interface
- Easy backup and restore

### 2. SQL Execution: Transaction vs Direct

**Decision:** Direct execution (no explicit transactions)

**Rationale:**
- DDL statements (CREATE TABLE) auto-commit in MySQL
- Explicit transactions cause "no active transaction" errors
- Each statement executes individually

**Trade-off:**
- Less transactional safety
- Better compatibility with DDL operations

### 3. Schema Hash: Full vs Partial

**Decision:** Full schema hash (all tables and columns)

**Rationale:**
- Detects any schema changes
- Simple SHA-256 of complete DESCRIBE output
- Stored as 64-character string

**Calculation:**
```php
$tables = DB::select("SHOW TABLES");
$schemaData = [];
foreach ($tables as $table) {
    $columns = DB::select("DESCRIBE {$table}");
    $schemaData[$table] = $columns;
}
$hash = hash('sha256', json_encode($schemaData));
```

### 4. Module Dependencies: Strict vs Flexible

**Decision:** Strict validation

**Rationale:**
- Prevents broken installations
- Validates dependencies before installation
- Throws exceptions on conflicts

**Validation:**
```php
if (!empty($module->dependencies)) {
    foreach ($module->dependencies as $requiredId) {
        if (!in_array($requiredId, $selectedModules)) {
            throw new RuntimeException("Missing dependency");
        }
    }
}
```

### 5. Rollback Strategy: Partial vs Full

**Decision:** Partial cleanup (metadata only)

**Rationale:**
- Full database rollback is complex
- Metadata cleanup is safe and fast
- Admin can manually fix database if needed

**Implementation:**
```php
// On failure, clear template info from tenant
$tenant->update([
    'template_id' => null,
    'template_version' => null,
    'schema_status' => 'unknown',
]);
```

### 6. Version Comparison: String vs Semantic

**Decision:** Semantic versioning with `version_compare()`

**Rationale:**
- PHP native function
- Handles 1.0.0 < 1.1.0 < 2.0.0
- Standard in software industry

**Usage:**
```php
public function isNewerThan(string $otherVersion): bool
{
    return version_compare($this->version, $otherVersion) > 0;
}
```

---

## Security Considerations

### 1. Database Isolation

✅ **All SQL executes on tenant database, never landlord**

```php
config(['database.connections.tenant.database' => $database]);
DB::connection('tenant')->statement($sql);
```

### 2. SQL Injection Protection

✅ **No user input in SQL statements**

- Templates are admin-defined
- No dynamic SQL from user input
- Uses Laravel query builder where possible

### 3. Tenant Context Validation

✅ **Verify tenant owns database before operations**

```php
private function ensureDatabaseExists(string $database): void
{
    $exists = DB::select(
        "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
        [$database]
    );

    if (empty($exists)) {
        throw new RuntimeException("Database does not exist");
    }
}
```

### 4. Audit Trail

✅ **Complete history of all provisioning actions**

- Who applied template
- When it was applied
- What version
- Success/failure status
- Error messages

---

## Performance Optimization

### 1. SQL Statement Batching

**Problem:** Executing thousands of statements one-by-one is slow

**Solution:** Batch similar statements

```php
foreach ($statements as $statement) {
    DB::connection('tenant')->statement($statement);
}
```

### 2. Schema Hash Caching

**Problem:** Recalculating hash on every request is expensive

**Solution:** Calculate once, store in tenant record

```php
$hash = $this->calculateSchemaHash($database);
$tenant->update(['initial_schema_hash' => $hash]);
```

### 3. Connection Reuse

**Problem:** Opening new database connections is slow

**Solution:** Purge and reconnect existing connection

```php
DB::purge('tenant');
DB::reconnect('tenant');
```

---

## Testing Strategy

### Unit Tests

Test individual components in isolation:

```php
class TemplateProvisioningServiceTest extends TestCase
{
    public function test_validates_template_before_application()
    {
        $service = new TemplateProvisioningService();
        $inactiveTemplate = TenantTemplate::factory()->inactive()->create();

        $this->expectException(RuntimeException::class);
        $service->applyTemplate($tenant, $inactiveTemplate);
    }
}
```

### Integration Tests

Test complete provisioning workflow:

```php
public function test_applies_template_successfully()
{
    $tenant = Tenant::factory()->create();
    $template = TenantTemplate::factory()->create();

    $service = new TemplateProvisioningService();
    $history = $service->applyTemplate($tenant, $template);

    $this->assertEquals('completed', $history->status);
    $this->assertDatabaseHas('tenant_test', 'permissions');
}
```

### Coverage Requirements

- Minimum 80% code coverage
- 100% coverage on critical paths (provisioning, version updates)

---

**Next:** [02 - Template System](02-template-system.md)
