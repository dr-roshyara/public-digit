# RBAC Unique Constraints Fix - COMPLETE ✅

**Date:** 2025-12-13 13:30
**Issue:** `php artisan db:seed` fails for multiple tenants due to unique constraint not including tenant_id
**Status:** ✅ FIXED

---

## Problem Summary

When running `php artisan db:seed`, permissions and roles were NOT created for all tenants. The seeder failed with:

```
SQLSTATE[23000]: Integrity constraint violation: 1062 Duplicate entry 'users.view-web'
for key 'permissions.permissions_name_guard_name_unique'
```

### Root Cause

**Unique constraints on RBAC tables did NOT include `tenant_id`:**

```sql
-- ❌ WRONG (before fix):
UNIQUE KEY permissions_name_guard_name_unique (name, guard_name)
UNIQUE KEY roles_name_guard_name_unique (name, guard_name)

-- Problem: Same permission name cannot exist for multiple tenants!
```

**Result:**
- First tenant seeding: ✅ Creates 21 permissions + 6 roles
- Second tenant seeding: ❌ Fails - "users.view" already exists!

---

## Solution Implemented

### 1. Fixed Unique Constraints

**Migration:** `2025_12_13_132156_fix_rbac_unique_constraints_to_include_tenant_id.php`

**Changes:**
```sql
-- ✅ CORRECT (after fix):
UNIQUE KEY permissions_name_guard_tenant_unique (name, guard_name, tenant_id)
UNIQUE KEY roles_name_guard_tenant_unique (name, guard_name, tenant_id)

-- Benefit: Each tenant can have their own copy of "users.view" permission!
```

**Implementation:**
```php
// Drop old constraint
$table->dropUnique('permissions_name_guard_name_unique');

// Create new constraint including tenant_id
$table->unique(['name', 'guard_name', 'tenant_id'], 'permissions_name_guard_tenant_unique');
```

### 2. What This Allows

**Multi-Tenant RBAC Isolation:**
| Tenant | Permission | tenant_id | Result |
|--------|-----------|-----------|--------|
| Nepali Congress | users.view | 1 | ✅ Created |
| UML Party | users.view | 2 | ✅ Created (same name, different tenant) |
| Nepali Congress | users.view | 1 | ❌ Fails (duplicate within same tenant) |

---

## Testing Results

### Test 1: Multiple Tenants Seeding ✅

```bash
# Create tenants
$ php artisan tinker
>>> Tenant::create(['name' => 'Nepali Congress', 'slug' => 'nc', 'status' => 'active', ...])
>>> Tenant::create(['name' => 'UML Party', 'slug' => 'uml', 'status' => 'active', ...])

# Run seeder
$ php artisan db:seed

✅ Seeding default roles for tenant: Nepali Congress
✅ Seeding default roles for tenant: UML Party
✅ Default roles and permissions seeded for all active tenants.
```

### Test 2: Verification ✅

```
Tenant: Nepali Congress (numeric_id: 1)
  Permissions: 21 ✅
  Roles: 6 ✅

Tenant: UML Party (numeric_id: 2)
  Permissions: 21 ✅
  Roles: 6 ✅

TOTAL:
  Total permissions: 42 (21 × 2 tenants)
  Total roles: 12 (6 × 2 tenants)
```

---

## How It Works Now

### Before Fix ❌
```
Tenant 1 seeding:
- Create "users.view" → Success
- Create "users.create" → Success
- ...21 permissions created

Tenant 2 seeding:
- Create "users.view" → FAIL! Already exists
- Seeding stops → Only Tenant 1 has permissions
```

### After Fix ✅
```
Tenant 1 seeding:
- Create "users.view" (tenant_id=1) → Success
- Create "users.create" (tenant_id=1) → Success
- ...21 permissions created

Tenant 2 seeding:
- Create "users.view" (tenant_id=2) → Success (different tenant_id!)
- Create "users.create" (tenant_id=2) → Success
- ...21 permissions created

BOTH tenants now have complete RBAC!
```

---

## Database Structure

### Permissions Table
```sql
CREATE TABLE permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    tenant_id BIGINT UNSIGNED NULL,  -- Numeric tenant reference
    category VARCHAR(100) NULL,
    description TEXT NULL,
    is_global BOOLEAN DEFAULT FALSE,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- NEW: Unique constraint includes tenant_id
    UNIQUE KEY permissions_name_guard_tenant_unique (name, guard_name, tenant_id),

    INDEX idx_tenant (tenant_id),
    INDEX idx_guard (guard_name),
    INDEX idx_category (category)
) ENGINE=InnoDB;
```

### Roles Table
```sql
CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    code VARCHAR(50) NULL,
    tenant_id BIGINT UNSIGNED NULL,  -- Numeric tenant reference
    description TEXT NULL,
    hierarchy_level INT NULL,
    scope_type ENUM('global', 'unit', 'individual') DEFAULT 'global',
    is_system_role BOOLEAN DEFAULT FALSE,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- NEW: Unique constraint includes tenant_id
    UNIQUE KEY roles_name_guard_tenant_unique (name, guard_name, tenant_id),
    UNIQUE KEY roles_tenant_id_code_unique (tenant_id, code),

    INDEX idx_tenant (tenant_id),
    INDEX idx_guard (guard_name)
) ENGINE=InnoDB;
```

---

## Seeder Logic

**File:** `app/Contexts/TenantAuth/Infrastructure/Database/Seeders/TenantDefaultRolesSeeder.php`

```php
public function run(): void
{
    // Get all active tenants
    $tenants = Tenant::where('status', 'active')->get();

    if ($tenants->isEmpty()) {
        $this->command->info('No active tenants found. Skipping role seeding.');
        return;
    }

    // Seed EACH tenant
    foreach ($tenants as $tenant) {
        $this->seedForTenant($tenant);
    }

    $this->command->info('✅ Default roles and permissions seeded for all active tenants.');
}

protected function createDefaultPermissions(Tenant $tenant): array
{
    // ...
    foreach ($permissions as $permissionData) {
        $permission = TenantPermission::firstOrCreate(
            [
                'name' => $permissionData['name'],
                'tenant_id' => $tenant->numeric_id, // ✅ Uses numeric_id
            ],
            [
                'guard_name' => 'web',
                'category' => $permissionData['category'],
                'description' => $permissionData['description'],
                'is_global' => false,
                'metadata' => ['is_default' => true],
            ]
        );

        $createdPermissions[$permissionData['name']] = $permission;
    }

    return $createdPermissions;
}
```

---

## Benefits of This Fix

### 1. True Multi-Tenancy ✅
- Each tenant has their own isolated RBAC system
- Same permission/role names across tenants (no naming conflicts)
- Perfect for SaaS with standardized roles

### 2. Data Integrity ✅
- Prevents duplicate permissions within same tenant
- Allows identical permissions across different tenants
- Database-level enforcement

### 3. Scalability ✅
- Seed unlimited tenants with `php artisan db:seed`
- No manual intervention needed per tenant
- Consistent RBAC structure across all tenants

### 4. Flexibility ✅
- Each tenant can customize their permissions later
- Standard permissions start identical
- Tenant-specific customizations tracked separately

---

## Usage Guidelines

### Creating New Tenants

```bash
# 1. Create tenant
php artisan tinker
>>> $tenant = Tenant::create([
...     'name' => 'New Organization',
...     'email' => 'admin@neworg.com',
...     'slug' => 'new-org',
...     'status' => 'active',
...     'schema_status' => 'synced',
...     'is_customized' => false,
...     'customization_count' => 0,
... ]);

# 2. Seed RBAC for new tenant
php artisan db:seed --class="App\\Contexts\\TenantAuth\\Infrastructure\\Database\\Seeders\\TenantDefaultRolesSeeder"

# Result: New tenant gets 21 permissions + 6 roles
```

### Seeding All Tenants

```bash
# Seeds ALL active tenants at once
php artisan db:seed

# Output:
# Seeding default roles for tenant: Tenant 1
# Seeding default roles for tenant: Tenant 2
# Seeding default roles for tenant: Tenant 3
# ✅ Default roles and permissions seeded for all active tenants.
```

---

## Files Modified

1. ✅ `database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php` (created)
2. ✅ `database/migrations/2025_12_13_132156_fix_rbac_unique_constraints_to_include_tenant_id.php` (created)
3. ✅ `app/Models/Tenant.php` (updated - added numeric_id)
4. ✅ `app/Contexts/TenantAuth/Infrastructure/Database/Seeders/TenantDefaultRolesSeeder.php` (updated - uses numeric_id)
5. ✅ `tests/Feature/TenantAuth/TenantNumericIdTest.php` (created)
6. ✅ `tests/Feature/TenantAuth/PermissionsUniqueConstraintTest.php` (created)

---

## Migration Commands Run

```bash
# Step 1: Add numeric_id to tenants
php artisan migrate --path=database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php

# Step 2: Fix unique constraints
php artisan migrate --path=database/migrations/2025_12_13_132156_fix_rbac_unique_constraints_to_include_tenant_id.php

# Step 3: Seed all tenants
php artisan db:seed
```

---

## Common Issues & Solutions

### Issue 1: "No active tenants found"
**Cause:** No tenants with `status = 'active'` in database

**Solution:**
```php
// Create active tenant first
Tenant::create([
    'name' => 'Test Org',
    'slug' => 'test',
    'status' => 'active',  // ✅ MUST be 'active'
    'schema_status' => 'synced',
    'is_customized' => false,
    'customization_count' => 0,
]);
```

### Issue 2: Seeder runs but no permissions created
**Cause:** Permissions already exist (firstOrCreate skips existing)

**Solution:**
```bash
# Option 1: Clear existing data
php artisan tinker
>>> DB::table('permissions')->delete();
>>> DB::table('roles')->delete();
>>> exit

# Option 2: Run with fresh database
php artisan migrate:fresh --seed
```

### Issue 3: Second tenant seeding still fails
**Cause:** Unique constraint not fixed properly

**Solution:**
```bash
# Verify constraints include tenant_id
php artisan tinker
>>> $indexes = DB::select('SHOW INDEX FROM permissions WHERE Key_name LIKE "%unique%"');
>>> foreach ($indexes as $i) echo $i->Key_name . ' → ' . $i->Column_name . PHP_EOL;

# Should show:
# permissions_name_guard_tenant_unique → name
# permissions_name_guard_tenant_unique → guard_name
# permissions_name_guard_tenant_unique → tenant_id  ← MUST be here!
```

---

## What's Next

- [x] numeric_id column added to tenants
- [x] Unique constraints fixed on permissions table
- [x] Unique constraints fixed on roles table
- [x] Seeder updated to use numeric_id
- [x] Multi-tenant seeding tested and working
- [ ] Update RBAC module SQL templates (for future template provisioning)
- [ ] Document in developer guides
- [ ] Test with tenant application workflow

---

## Related Documentation

- **numeric_id Implementation**: `20251213_1315_tenant_numeric_id_implementation_complete.md`
- **TenantInterface Abstraction**: `ABSTRACTION_LAYER_IMPLEMENTATION_COMPLETE.md`
- **TenantPermission Fix**: `TENANT_PERMISSION_FIX_COMPLETE.md`

---

**Implementation Date**: 2025-12-13
**Implemented By**: Claude (AI Assistant)
**Status**: ✅ PRODUCTION READY

---

## Quick Verification

```bash
# 1. Check constraints
php artisan tinker --execute="
\$indexes = DB::select('SHOW INDEX FROM permissions WHERE Key_name LIKE \"%tenant%\"');
foreach (\$indexes as \$i) echo \$i->Key_name . ' → ' . \$i->Column_name . PHP_EOL;
"

# Should output:
# permissions_name_guard_tenant_unique → name
# permissions_name_guard_tenant_unique → guard_name
# permissions_name_guard_tenant_unique → tenant_id

# 2. Test seeding
php artisan db:seed

# Should output:
# Seeding default roles for tenant: [Tenant 1]
# Seeding default roles for tenant: [Tenant 2]
# ✅ Default roles and permissions seeded for all active tenants.
```

---

**RESULT**: ✅ `php artisan db:seed` now correctly creates permissions and roles for ALL active tenants!
