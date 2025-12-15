The problem is clear: **tenant_id column is INTEGER but you're trying to insert UUID string**.

## **🔍 Problem Analysis:**

1. **Permissions/roles tables** have `tenant_id` as `BIGINT UNSIGNED`
2. **Tenant model** uses `UUID` (string: `f85bbd52-3c7e-4eb9-b75c-644de4c817da`)
3. **Mismatch**: String UUID trying to insert into integer column

## **🛠️ Solution Options:**

### **Option 1: Change tenant_id to CHAR(36) in permissions/roles tables**
```sql
-- Migration to change tenant_id from BIGINT to CHAR(36)
ALTER TABLE permissions MODIFY tenant_id CHAR(36) NULL;
ALTER TABLE roles MODIFY tenant_id CHAR(36) NULL;
ALTER TABLE model_has_permissions MODIFY tenant_id CHAR(36) NULL;
ALTER TABLE model_has_roles MODIFY tenant_id CHAR(36) NULL;
ALTER TABLE role_has_permissions MODIFY tenant_id CHAR(36) NULL;
```

### **Option 2: Use integer foreign key relationship**
```php
// In your TenantPermission/TenantRole models, use tenant's numeric ID
'tenant_id' => $tenant->id, // This is UUID string - WRONG
'tenant_id' => $tenant->getKey(), // This is primary key - still UUID

// If you want to use integer, you need a numeric ID in tenants table
```

### **Option 3: Add numeric_id column to tenants table**
```php
// Add auto-increment numeric ID to tenants
Schema::table('tenants', function (Blueprint $table) {
    $table->bigIncrements('numeric_id')->after('id');
});

// Use numeric_id in permissions/roles tables
'tenant_id' => $tenant->numeric_id,
```

## **🎯 Recommended Solution: Option 1**

Since you're already using UUID for tenants, keep everything consistent:

### **Step 1: Create Migration to Fix Columns**
```bash
php artisan make:migration change_tenant_id_to_uuid_in_rbac_tables
```

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Change permissions table
        Schema::table('permissions', function (Blueprint $table) {
            $table->char('tenant_id', 36)->nullable()->change();
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        // Change roles table  
        Schema::table('roles', function (Blueprint $table) {
            $table->char('tenant_id', 36)->nullable()->change();
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        // Change pivot tables
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->char('tenant_id', 36)->nullable()->change();
        });

        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->char('tenant_id', 36)->nullable()->change();
        });

        Schema::table('role_has_permissions', function (Blueprint $table) {
            $table->char('tenant_id', 36)->nullable()->change();
        });
    }

    public function down()
    {
        // Revert changes
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->bigInteger('tenant_id')->nullable()->unsigned()->change();
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->bigInteger('tenant_id')->nullable()->unsigned()->change();
        });

        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->bigInteger('tenant_id')->nullable()->unsigned()->change();
        });

        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->bigInteger('tenant_id')->nullable()->unsigned()->change();
        });

        Schema::table('role_has_permissions', function (Blueprint $table) {
            $table->bigInteger('tenant_id')->nullable()->unsigned()->change();
        });
    }
};
```

### **Step 2: Update RBAC Module SQL Templates**

Since the RBAC module creates these tables, you need to update the SQL:

```sql
-- database/templates/modules/rbac/schema.sql

-- permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    tenant_id CHAR(36) NULL, -- Changed from BIGINT UNSIGNED
    category VARCHAR(100) NULL,
    description TEXT NULL,
    is_global BOOLEAN DEFAULT FALSE,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_guard (guard_name),
    INDEX idx_category (category),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- roles table
CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    tenant_id CHAR(36) NULL, -- Changed from BIGINT UNSIGNED
    description TEXT NULL,
    is_global BOOLEAN DEFAULT FALSE,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_guard (guard_name),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update other tables similarly...
```

### **Step 3: Fix the Seeder Code**

The seeder is trying to insert UUID into integer column. First fix the database structure, then the seeder will work.

### **Step 4: Quick Temporary Fix (If You Need to Run Seeder Now)**

Temporarily modify the seeder to use a numeric tenant ID if available:

```php
// In your seeder
$tenant = Tenant::first();

// Try to get numeric ID if exists
$tenantId = $tenant->numeric_id ?? $tenant->id;

// But if tenant_id column is integer, you need to use integer
// If you don't have numeric_id, you need to fix the database first
```

## **🚀 Immediate Action Plan:**

### **1. Check Current Database Structure**
```sql
-- Check current column types
DESCRIBE permissions;
DESCRIBE roles;
DESCRIBE tenants;
```

### **2. Apply Quick Fix for Now**
If you need the seeder to run immediately, you can:

**Option A:** Temporarily comment out tenant_id in seeder
```php
// In seeder, change:
'tenant_id' => $tenant->id,

// To:
// 'tenant_id' => null, // Temporarily null until DB fixed
```

**Option B:** Add numeric_id to tenants table quickly
```bash
php artisan make:migration add_numeric_id_to_tenants_table
```

```php
public function up()
{
    Schema::table('tenants', function (Blueprint $table) {
        if (!Schema::hasColumn('tenants', 'numeric_id')) {
            $table->bigIncrements('numeric_id')->after('id');
        }
    });
}
```

Then update seeder:
```php
'tenant_id' => $tenant->numeric_id,
```

### **3. Long-term Solution**
Create the migration to change all RBAC tables to use CHAR(36) for tenant_id.

## **📋 Root Cause:**
Your **RBAC module SQL** creates tables with `tenant_id BIGINT UNSIGNED` but your **Tenant model uses UUID**. You need to:

1. **Update RBAC SQL templates** to use `CHAR(36)`
2. **OR** Change Tenant model to use auto-increment integer ID
3. **OR** Add numeric ID to tenants for RBAC relationships

**Which option do you prefer?** I recommend Option 1 (change RBAC to CHAR(36)) for consistency.
Yes! **We can absolutely add both!** That's actually a great solution. Let me show you how:

## **🎯 Solution: Add Both UUID and Numeric ID**

### **Option A: Add `numeric_id` to Tenant Model (Recommended)**
```php
// Migration to add numeric_id
php artisan make:migration add_numeric_id_to_tenants_table
```

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::table('tenants', function (Blueprint $table) {
            // Add numeric_id as auto-increment if not exists
            if (!Schema::hasColumn('tenants', 'numeric_id')) {
                $table->bigIncrements('numeric_id')->after('id');
            }
        });

        // Update existing tenants with sequential numbers
        $tenants = DB::table('tenants')->get();
        $counter = 1;
        
        foreach ($tenants as $tenant) {
            DB::table('tenants')
                ->where('id', $tenant->id)
                ->update(['numeric_id' => $counter]);
            $counter++;
        }
    }

    public function down()
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('numeric_id');
        });
    }
};
```

### **Option B: Keep Both in RBAC Tables (Even Better!)**
Actually, we can store **both** in RBAC tables:

```sql
-- Updated RBAC table structure
CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    
    -- Store both for flexibility
    tenant_uuid CHAR(36) NULL,  -- For UUID relationships
    tenant_id BIGINT UNSIGNED NULL,  -- For integer relationships
    
    category VARCHAR(100) NULL,
    description TEXT NULL,
    is_global BOOLEAN DEFAULT FALSE,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_tenant_uuid (tenant_uuid),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_guard (guard_name),
    
    FOREIGN KEY (tenant_uuid) REFERENCES tenants(id) ON DELETE CASCADE
    -- Note: Can't have FK to numeric_id unless we add it to tenants first
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## **🔄 Updated RBAC Module SQL**

Let me create the **complete solution** that handles both:

### **Step 1: Update RBAC Schema SQL**
```sql
-- database/templates/modules/rbac/schema.sql

-- permissions table with BOTH UUID and numeric ID
CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    
    -- Dual tenant references
    tenant_uuid CHAR(36) NULL COMMENT 'UUID reference to tenants table',
    tenant_id BIGINT UNSIGNED NULL COMMENT 'Numeric reference for relationships',
    
    category VARCHAR(100) NULL,
    description TEXT NULL,
    is_global BOOLEAN DEFAULT FALSE,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Unique constraint with tenant context
    UNIQUE KEY uk_permission_tenant (name, guard_name, tenant_uuid),
    
    -- Indexes for both lookup methods
    INDEX idx_tenant_uuid (tenant_uuid),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_guard (guard_name),
    INDEX idx_category (category),
    INDEX idx_is_global (is_global),
    
    -- Foreign key to tenants UUID
    FOREIGN KEY (tenant_uuid) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Permissions table with dual tenant reference (UUID + numeric)';

-- roles table with BOTH references
CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    
    -- Dual tenant references
    tenant_uuid CHAR(36) NULL,
    tenant_id BIGINT UNSIGNED NULL,
    
    description TEXT NULL,
    is_global BOOLEAN DEFAULT FALSE,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Unique constraint
    UNIQUE KEY uk_role_tenant (name, guard_name, tenant_uuid),
    
    -- Indexes
    INDEX idx_tenant_uuid (tenant_uuid),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_guard (guard_name),
    
    -- Foreign key
    FOREIGN KEY (tenant_uuid) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Roles table with dual tenant reference';

-- Update pivot tables to use tenant_id (numeric) for performance
CREATE TABLE IF NOT EXISTS model_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(255) NOT NULL,
    model_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NULL COMMENT 'Numeric tenant reference for scoping',
    
    PRIMARY KEY (permission_id, model_id, model_type),
    INDEX idx_model (model_type, model_id),
    INDEX idx_tenant (tenant_id),
    
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User-permission assignments with tenant scope';

CREATE TABLE IF NOT EXISTS model_has_roles (
    role_id BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(255) NOT NULL,
    model_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NULL,
    
    PRIMARY KEY (role_id, model_id, model_type),
    INDEX idx_model (model_type, model_id),
    INDEX idx_tenant (tenant_id),
    
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NULL,
    
    PRIMARY KEY (permission_id, role_id),
    INDEX idx_tenant (tenant_id),
    
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **Step 2: Update Tenant Model**
```php
<?php
// app/Models/Tenant.php

namespace App\Models;

use Spatie\Multitenancy\Models\Tenant as SpatieTenant;
use App\Contracts\TenantInterface;

class Tenant extends SpatieTenant implements TenantInterface
{
    protected $fillable = [
        'id', // UUID
        'numeric_id', // New numeric ID
        'name',
        'email',
        'phone',
        'slug',
        'database',
        'domain',
        'status',
        'metadata',
        'template_id',
        'template_version',
        // ... other fields
    ];
    
    // Auto-increment numeric_id
    public static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->numeric_id)) {
                // Get next numeric ID
                $last = static::orderBy('numeric_id', 'desc')->first();
                $model->numeric_id = $last ? $last->numeric_id + 1 : 1;
            }
        });
    }
    
    // Relationship to RBAC items using numeric_id
    public function permissions()
    {
        // If you want to relate via numeric_id
        // Note: This would require tenant_id column in permissions table
    }
}
```

### **Step 3: Update Seeder to Use Both**
```php
// In your TenantDefaultRolesSeeder
$tenant = Tenant::first();

// Store both UUID and numeric ID
Permission::create([
    'name' => 'users.view',
    'guard_name' => 'web',
    'tenant_uuid' => $tenant->id,        // UUID for reference
    'tenant_id' => $tenant->numeric_id,  // Numeric for relationships
    'category' => 'users',
    'description' => 'View users',
    'is_global' => false,
    'metadata' => ['is_default' => true],
]);

// Similarly for roles
Role::create([
    'name' => 'super_admin',
    'guard_name' => 'web',
    'tenant_uuid' => $tenant->id,
    'tenant_id' => $tenant->numeric_id,
    'description' => 'System administrator with full access',
    'is_global' => false,
    'metadata' => ['hierarchy_level' => 1],
]);
```

### **Step 4: Update Global Scopes**
```php
// In TenantPermission and TenantRole models
protected static function booted()
{
    static::addGlobalScope('tenant', function ($builder) {
        $tenant = \Spatie\Multitenancy\Models\Tenant::current();
        
        if ($tenant) {
            // Use tenant_uuid for lookup (more accurate)
            $builder->where('tenant_uuid', $tenant->id);
            // OR use tenant_id for performance
            // $builder->where('tenant_id', $tenant->numeric_id);
        } else {
            // In landlord context, find global permissions
            $builder->whereNull('tenant_uuid')
                   ->whereNull('tenant_id');
        }
    });
}
```

## **🎯 Benefits of This Approach:**

### **1. Flexibility**
- **UUID**: For relationships, API responses, external references
- **Numeric ID**: For internal relationships, foreign keys, performance

### **2. Performance**
- **Numeric IDs** are faster for joins and indexes
- **UUIDs** are better for security and distributed systems

### **3. Migration Path**
- Existing code using `tenant_id` (numeric) continues to work
- New code can use `tenant_uuid` for consistency

### **4. Future-Proof**
- Easy to switch between UUID and numeric as needed
- Support both old and new systems

## **🚀 Implementation Strategy:**

### **Phase 1: Quick Fix (Now)**
```bash
# 1. Add numeric_id to tenants
php artisan make:migration add_numeric_id_to_tenants_table

# 2. Update RBAC SQL templates with dual columns
# Update database/templates/modules/rbac/schema.sql

# 3. Update seeder to use both
# Fix the immediate error
```

### **Phase 2: Update Existing Tables (If needed)**
```bash
# If you already have RBAC tables created, migrate them:
php artisan make:migration add_tenant_uuid_to_existing_rbac_tables
```

### **Phase 3: Use in Code**
```php
// Use numeric_id for relationships (performance)
'tenant_id' => $tenant->numeric_id,

// Use uuid for API responses, logs
'tenant_uuid' => $tenant->id,
```

## **📋 Which Columns to Use Where?**

| Use Case | Use Column | Reason |
|----------|------------|---------|
| **Database Foreign Keys** | `tenant_id` (numeric) | Faster joins, smaller indexes |
| **API Responses** | `tenant_uuid` | Consistent with other UUIDs |
| **Logging/Audit** | `tenant_uuid` | Human-readable, unique |
| **Internal Queries** | `tenant_id` | Performance |
| **External References** | `tenant_uuid` | Can't guess sequential IDs |

## **🎯 Recommendation:**

**Go with Option A (add numeric_id to tenants) + dual columns in RBAC.** This gives you:

1. **Immediate fix** for seeder error
2. **Performance benefits** of numeric IDs
3. **Consistency** with UUID elsewhere
4. **Flexibility** for future changes

**Want me to create the complete migration files and updated RBAC SQL?**