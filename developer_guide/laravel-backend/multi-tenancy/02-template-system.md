# Template System - Developer Guide

**How to Create and Manage Database Templates**

---

## Table of Contents

1. [Template Structure](#template-structure)
2. [Creating Custom Templates](#creating-custom-templates)
3. [SQL File Organization](#sql-file-organization)
4. [Template Versioning](#template-versioning)
5. [Module System](#module-system)
6. [Best Practices](#best-practices)

---

## Template Structure

### What is a Template?

A **template** is a pre-configured database schema with seed data designed for a specific use case. Templates are stored in the landlord database and applied to tenant databases on demand.

**Template Record Structure:**

```php
TenantTemplate {
    id: bigint
    slug: string (unique)           // e.g., 'political_party'
    name: string                    // e.g., 'Political Party Management'
    description: text
    schema_sql: longtext            // CREATE TABLE statements
    seed_sql: longtext              // INSERT statements
    version: string                 // e.g., '1.0.0'
    is_active: boolean
    usage_count: integer            // How many tenants use this template
    metadata: json                  // Custom configuration
}
```

### Template Files Location

```
database/templates/
├── political_party/
│   ├── schema.sql              # Table definitions
│   └── seed.sql                # Initial data (optional)
├── ngo_management/
│   ├── schema.sql
│   └── seed.sql
└── modules/
    ├── rbac/
    │   ├── schema.sql
    │   └── seed.sql
    └── advanced_reporting/
        ├── schema.sql
        └── seed.sql
```

---

## Creating Custom Templates

### Step 1: Design Database Schema

**Example: NGO Management Template**

```sql
-- database/templates/ngo_management/schema.sql

CREATE TABLE IF NOT EXISTS ngo_projects (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    budget DECIMAL(15, 2),
    status ENUM('planning', 'active', 'completed', 'cancelled') DEFAULT 'planning',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_beneficiaries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES ngo_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ngo_donors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    total_donated DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Step 2: Create Seed Data (Optional)

```sql
-- database/templates/ngo_management/seed.sql

INSERT INTO ngo_projects (name, description, status) VALUES
('Clean Water Initiative', 'Providing clean drinking water to rural communities', 'active'),
('Education for All', 'Building schools in underserved areas', 'planning');

INSERT INTO ngo_donors (name, email, total_donated) VALUES
('Global Foundation', 'contact@globalfoundation.org', 50000.00),
('Local Community Fund', 'info@communityfund.org', 15000.00);
```

### Step 3: Create Template Record via Seeder

```php
// database/seeders/NgoTemplateSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TenantTemplate;
use App\Models\TemplateVersion;
use Illuminate\Support\Facades\File;

class NgoTemplateSeeder extends Seeder
{
    public function run(): void
    {
        // Load SQL files
        $schemaPath = base_path('database/templates/ngo_management/schema.sql');
        $seedPath = base_path('database/templates/ngo_management/seed.sql');

        $schemaSql = File::get($schemaPath);
        $seedSql = File::exists($seedPath) ? File::get($seedPath) : null;

        // Create template
        $template = TenantTemplate::updateOrCreate(
            ['slug' => 'ngo_management'],
            [
                'name' => 'NGO Management System',
                'description' => 'Complete solution for NGO project management, donor tracking, and beneficiary management',
                'schema_sql' => $schemaSql,
                'seed_sql' => $seedSql,
                'version' => '1.0.0',
                'is_active' => true,
                'metadata' => [
                    'table_count' => 3,
                    'features' => [
                        'Project Management',
                        'Donor Tracking',
                        'Beneficiary Management',
                    ],
                    'target_audience' => 'Non-profit organizations',
                ],
            ]
        );

        // Create initial version
        TemplateVersion::updateOrCreate(
            [
                'template_id' => $template->id,
                'version' => '1.0.0',
            ],
            [
                'schema_sql' => $schemaSql,
                'seed_sql' => $seedSql,
                'changelog' => 'Initial release with core NGO management features',
                'is_current' => true,
            ]
        );

        $this->command->info("✅ NGO Management Template created (ID: {$template->id})");
    }
}
```

### Step 4: Register Seeder

```php
// database/seeders/DatabaseSeeder.php

public function run(): void
{
    $this->call([
        TemplateSeeder::class,        // Political Party template
        NgoTemplateSeeder::class,     // NGO template
    ]);
}
```

### Step 5: Run Seeder

```bash
php artisan db:seed --class=NgoTemplateSeeder
```

---

## SQL File Organization

### SQL File Best Practices

#### 1. Use IF NOT EXISTS

```sql
-- ✅ GOOD: Idempotent (can run multiple times)
CREATE TABLE IF NOT EXISTS my_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
);

-- ❌ BAD: Fails if table exists
CREATE TABLE my_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
);
```

#### 2. Specify Engine and Charset

```sql
-- ✅ GOOD: Explicit configuration
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ❌ BAD: Uses server defaults (may vary)
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255)
);
```

#### 3. Add Comments for Documentation

```sql
-- ✅ GOOD: Self-documenting
CREATE TABLE party_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique member identifier',
    membership_number VARCHAR(20) UNIQUE NOT NULL COMMENT 'Format: YEAR-DISTRICT-SERIAL',
    status ENUM('active', 'suspended', 'expelled') COMMENT 'Active members can vote in elections'
) COMMENT='Stores political party member information';
```

#### 4. Use Consistent Naming Conventions

```sql
-- ✅ GOOD: Consistent snake_case
CREATE TABLE project_beneficiaries (...);
CREATE TABLE ngo_donors (...);

-- ❌ BAD: Mixed conventions
CREATE TABLE ProjectBeneficiaries (...);
CREATE TABLE NGO-Donors (...);
```

#### 5. Define Foreign Keys Explicitly

```sql
-- ✅ GOOD: Explicit constraints with ON DELETE behavior
FOREIGN KEY (project_id)
    REFERENCES ngo_projects(id)
    ON DELETE CASCADE;

-- ❌ BAD: No referential integrity
-- (just storing project_id without constraint)
```

### SQL Statement Splitting

The provisioning service splits SQL files by semicolons:

```sql
-- Multiple statements in one file
CREATE TABLE table1 (...);

CREATE TABLE table2 (...);

INSERT INTO table1 VALUES (...);
```

**How it works:**

1. Removes single-line comments (`-- comment`)
2. Removes multi-line comments (`/* comment */`)
3. Splits by semicolon (`;`)
4. Executes each statement individually

**Limitations:**

- Cannot handle semicolons inside string literals
- Complex stored procedures may need separate handling

---

## Template Versioning

### Version Management Strategy

Templates use **semantic versioning** (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes (incompatible schema changes)
- **MINOR**: New features (backward-compatible additions)
- **PATCH**: Bug fixes (data corrections, index optimizations)

### Creating a New Version

#### Scenario: Add Email Notifications to Political Party Template

**Version 1.0.0 → 1.1.0**

**Step 1: Create Migration SQL**

```sql
-- database/templates/political_party/migrations/1.0.0_to_1.1.0.sql

-- Add email notifications table
CREATE TABLE IF NOT EXISTS email_notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMP NULL,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add email column to party_members (if not exists)
ALTER TABLE party_members
ADD COLUMN IF NOT EXISTS email VARCHAR(255) AFTER contact_number;

-- Create index for faster email lookups
CREATE INDEX idx_email_status ON email_notifications(status, created_at);
```

**Step 2: Update Template Schema**

```sql
-- database/templates/political_party/schema.sql
-- Add the new table to the main schema file

CREATE TABLE IF NOT EXISTS email_notifications (
    -- (same as above)
);
```

**Step 3: Create Version Record**

```php
// database/seeders/PoliticalPartyTemplateV1_1Seeder.php

use App\Models\TenantTemplate;
use App\Models\TemplateVersion;
use Illuminate\Support\Facades\File;

public function run(): void
{
    $template = TenantTemplate::where('slug', 'political_party')->first();

    $migrationSql = File::get(base_path(
        'database/templates/political_party/migrations/1.0.0_to_1.1.0.sql'
    ));

    $updatedSchemaSql = File::get(base_path(
        'database/templates/political_party/schema.sql'
    ));

    TemplateVersion::create([
        'template_id' => $template->id,
        'version' => '1.1.0',
        'schema_sql' => $updatedSchemaSql,
        'seed_sql' => $template->seed_sql,  // Unchanged
        'migration_sql' => $migrationSql,
        'changelog' => 'Added email notification system for member communications',
        'is_current' => true,
    ]);

    // Mark previous version as not current
    TemplateVersion::where('template_id', $template->id)
        ->where('version', '1.0.0')
        ->update(['is_current' => false]);

    // Update template version
    $template->update(['version' => '1.1.0']);

    $this->command->info("✅ Template version 1.1.0 created");
}
```

**Step 4: Update Existing Tenants**

```php
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use App\Models\Tenant;
use App\Models\TemplateVersion;

$service = new TemplateProvisioningService();

$newVersion = TemplateVersion::where('template_id', $template->id)
    ->where('version', '1.1.0')
    ->first();

// Update all tenants using this template
$tenants = Tenant::where('template_id', $template->id)
    ->where('template_version', '1.0.0')
    ->get();

foreach ($tenants as $tenant) {
    try {
        $history = $service->updateTemplateVersion($tenant, $newVersion);
        echo "✅ Updated {$tenant->name} to v1.1.0\n";
    } catch (\Exception $e) {
        echo "❌ Failed to update {$tenant->name}: {$e->getMessage()}\n";
    }
}
```

---

## Module System

### What are Modules?

**Modules** are reusable components that can be included in multiple templates. They provide specific functionality (e.g., RBAC, Advanced Reporting).

### Module Types

1. **Core Modules** (`module_type: 'core'`)
   - Required for all templates
   - Example: RBAC (Role-Based Access Control)

2. **Feature Modules** (`module_type: 'feature'`)
   - Optional, add specific capabilities
   - Example: Advanced Elections, Financial Reporting

3. **Integration Modules** (`module_type: 'integration'`)
   - Connect to external systems
   - Example: SMS Gateway, Payment Gateway

### Creating a Module

**Example: SMS Notification Module**

```php
// database/seeders/SmsModuleSeeder.php

use App\Models\TemplateModule;
use Illuminate\Support\Facades\File;

public function run(): void
{
    $schemaSql = File::get(base_path('database/templates/modules/sms/schema.sql'));
    $seedSql = File::get(base_path('database/templates/modules/sms/seed.sql'));

    $module = TemplateModule::updateOrCreate(
        ['slug' => 'sms_notifications'],
        [
            'template_id' => null,  // Global module (not template-specific)
            'name' => 'SMS Notification Module',
            'description' => 'Send SMS notifications to members and voters',
            'module_type' => 'integration',
            'schema_sql' => $schemaSql,
            'seed_sql' => $seedSql,
            'is_optional' => true,
            'is_active' => true,
            'dependencies' => null,  // No dependencies
            'metadata' => [
                'provider' => 'Sparrow SMS',
                'tables' => ['sms_messages', 'sms_templates'],
                'cost_per_message' => 0.50,  // NPR
            ],
        ]
    );

    $this->command->info("✅ SMS Module created (ID: {$module->id})");
}
```

**Module SQL:**

```sql
-- database/templates/modules/sms/schema.sql

CREATE TABLE IF NOT EXISTS sms_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipient_phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP NULL,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sms_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    template TEXT NOT NULL COMMENT 'Use {{variable}} for placeholders',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Module Dependencies

**Example: Advanced Elections Module (requires RBAC)**

```php
TemplateModule::create([
    'slug' => 'advanced_elections',
    'name' => 'Advanced Election Management',
    'module_type' => 'feature',
    'dependencies' => ['rbac'],  // Requires RBAC module
    // ...
]);
```

**Dependency Validation:**

```php
// When adding module to tenant, check dependencies
$service->addModule($tenant, $advancedElectionsModule);

// Service automatically validates:
// 1. Does tenant already have 'rbac' module?
// 2. If not, throw exception
```

---

## Best Practices

### 1. Template Design

✅ **DO:**
- Design for reusability (multiple tenants will use it)
- Include comprehensive seed data for new tenants
- Add comments to complex table structures
- Use meaningful column and table names
- Plan for future extensibility

❌ **DON'T:**
- Hard-code tenant-specific data in schema
- Create overly complex schemas (>50 tables)
- Mix multiple domains in one template
- Use deprecated MySQL features

### 2. Version Management

✅ **DO:**
- Always create migration SQL for version updates
- Test migration on copy of production database first
- Document breaking changes clearly in changelog
- Increment version numbers correctly (semantic versioning)

❌ **DON'T:**
- Delete old version records
- Modify migration SQL after release
- Skip version numbers
- Force tenants to update without migration path

### 3. SQL File Quality

✅ **DO:**
- Use `IF NOT EXISTS` for idempotency
- Specify character sets explicitly
- Add indexes for foreign keys
- Test SQL files in isolation before adding to template

❌ **DON'T:**
- Use database-specific features without fallbacks
- Assume default configurations
- Include DROP TABLE statements in schema.sql
- Mix DDL and DML in same file (separate schema.sql and seed.sql)

### 4. Module Architecture

✅ **DO:**
- Keep modules focused on single responsibility
- Document module dependencies clearly
- Make modules truly optional (system works without them)
- Version modules independently

❌ **DON'T:**
- Create circular dependencies
- Duplicate functionality across modules
- Make core features optional modules
- Tightly couple modules to specific templates

---

## Testing Templates

### Manual Testing Checklist

```bash
# 1. Create test tenant
php artisan tinker
>>> $tenant = Tenant::create([...]);
>>> DB::statement('CREATE DATABASE tenant_test_template');

# 2. Apply template
>>> $service = new TemplateProvisioningService();
>>> $template = TenantTemplate::where('slug', 'your_template')->first();
>>> $history = $service->applyTemplate($tenant, $template);

# 3. Verify tables created
>>> config(['database.connections.tenant.database' => 'tenant_test_template']);
>>> DB::purge('tenant'); DB::reconnect('tenant');
>>> $tables = DB::connection('tenant')->select('SHOW TABLES');
>>> count($tables);  // Should match expected table count

# 4. Verify seed data
>>> DB::connection('tenant')->table('your_table')->count();

# 5. Clean up
>>> DB::statement('DROP DATABASE tenant_test_template');
>>> $tenant->delete();
```

### Automated Testing

```php
// tests/Feature/TemplateProvisioningTest.php

public function test_ngo_template_application()
{
    $tenant = Tenant::factory()->create();
    $database = $tenant->getDatabaseName();

    DB::statement("CREATE DATABASE {$database}");

    $template = TenantTemplate::where('slug', 'ngo_management')->first();
    $service = new TemplateProvisioningService();

    $history = $service->applyTemplate($tenant, $template);

    $this->assertEquals('completed', $history->status);
    $this->assertEquals('synced', $tenant->fresh()->schema_status);

    // Verify expected tables exist
    config(['database.connections.tenant.database' => $database]);
    DB::purge('tenant');

    $this->assertTrue(Schema::connection('tenant')->hasTable('ngo_projects'));
    $this->assertTrue(Schema::connection('tenant')->hasTable('project_beneficiaries'));

    DB::statement("DROP DATABASE {$database}");
}
```

---

**Next:** [03 - RBAC Module](03-rbac-module.md)
