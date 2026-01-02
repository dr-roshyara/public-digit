# Membership Context RBAC Migration Analysis

**Date**: 2025-12-30
**Context**: Platform Context Installation Infrastructure - Phase 5.2
**Issue**: RBAC tables misplaced in landlord database instead of tenant databases

---

## Executive Summary

The RBAC (Role-Based Access Control) tables (roles, permissions, model_has_*, role_has_permissions) are currently being created in the **landlord database** but should be in **tenant databases**. This misalignment causes the TenantAuth domain models to fail when attempting tenant-specific authentication and authorization.

---

## Problem Analysis

### Tables Affected

The user identified 10 tables that are incorrectly placed in the landlord database:

#### Tenant-Specific Tables (Should be in tenant databases):
1. **model_has_permissions** - Spatie polymorphic permission assignments
2. **model_has_roles** - Spatie polymorphic role assignments
3. **organizational_units** - Committee/organizational structure
4. **permissions** - Permission definitions
5. **role_has_permissions** - Role-permission relationships
6. **roles** - Role definitions
7. **tenant_brandings** - Tenant-specific branding
8. **tenant_user_registration_transitions** - User registration state machine
9. **tenant_user_registrations** - User registration records
10. **tenant_users** - Tenant committee users

### Root Cause

**Migrations in wrong location:**

```
Current (WRONG):
database/migrations/
├── 2024_01_01_000002_create_unified_permissions_tables.php
├── 2025_12_06_184741_add_tenant_columns_to_spatie_tables.php
└── 2025_12_13_132156_fix_rbac_unique_constraints_to_include_tenant_id.php
```

These migrations run on the **landlord connection** because they're in `database/migrations/`.

**Expected (CORRECT):**

```
app/Contexts/TenantAuth/Infrastructure/Database/Migrations/
└── Tenant/  ← NEW FOLDER STRUCTURE
    ├── 2024_01_01_000002_create_unified_permissions_tables.php
    ├── 2025_12_06_184741_add_tenant_columns_to_spatie_tables.php
    └── 2025_12_13_132156_fix_rbac_unique_constraints_to_include_tenant_id.php
```

These migrations should run on **tenant connections** during tenant provisioning.

---

## Domain Model Analysis

### TenantAuth Context Models

#### 1. TenantRole (app/Contexts/TenantAuth/Domain/Models/TenantRole.php)

```php
class TenantRole extends SpatieRole
{
    protected $table = 'roles';  // ← Expects 'roles' in TENANT database

    protected $fillable = [
        'name', 'guard_name', 'code', 'scope_type',
        'is_system_role', 'hierarchy_level', 'tenant_id',
        'default_permissions', 'metadata'
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
```

**Implications:**
- Has `tenant_id` foreign key → tenant-scoped
- Uses Spatie permission system → requires model_has_roles, role_has_permissions
- Must exist in tenant database to avoid cross-database FK violations

#### 2. TenantPermission (app/Contexts/TenantAuth/Domain/Models/TenantPermission.php)

```php
class TenantPermission extends SpatiePermission
{
    protected $table = 'permissions';  // ← Expects 'permissions' in TENANT database

    protected $fillable = [
        'name', 'guard_name', 'tenant_id',
        'is_global', 'description', 'category', 'metadata'
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
```

**Implications:**
- Has `tenant_id` foreign key → tenant-scoped
- Uses `is_global` flag for system vs tenant permissions
- Must exist in tenant database

#### 3. TenantUser (app/Contexts/TenantAuth/Domain/Models/TenantUser.php)

```php
class TenantUser extends Authenticatable
{
    use HasRoles;  // ← Spatie permission trait

    protected $table = 'tenant_users';  // ← Expects in TENANT database

    public function isCommitteeChief(): bool
    {
        return $this->hasRole(self::ROLE_COMMITTEE_CHIEF);  // ← Queries roles table
    }
}
```

**Implications:**
- Uses Spatie HasRoles trait → requires roles, model_has_roles
- Geography-aware → integrates with Geography context
- Must exist in tenant database

---

## Migration Analysis

### Current Global Migrations (Need to Move)

#### 1. create_unified_permissions_tables.php (2024_01_01_000002)

**Creates:**
- permissions
- roles
- model_has_permissions
- model_has_roles
- role_has_permissions

**Location:** `database/migrations/` → Runs on LANDLORD
**Should be:** `app/Contexts/TenantAuth/.../Tenant/` → Run on TENANT

**Migration Content:**
```php
Schema::create('permissions', function (Blueprint $table) {
    $table->bigIncrements('id');
    $table->string('name', 125);
    $table->string('guard_name', 125);
    // ... base Spatie schema (NO tenant_id)
});
```

**Issue:** Creates base Spatie tables without tenant awareness.

#### 2. add_tenant_columns_to_spatie_tables.php (2025_12_06_184741)

**Modifies:**
- Adds `tenant_id` to roles
- Adds `tenant_id` to permissions
- Adds custom columns (code, scope_type, hierarchy_level, metadata)

**Location:** `database/migrations/` → Runs on LANDLORD
**Should be:** `app/Contexts/TenantAuth/.../Tenant/` → Run on TENANT

**Migration Content:**
```php
Schema::table('roles', function (Blueprint $table) {
    $table->unsignedBigInteger('tenant_id')->nullable()->after('id');
    $table->string('code', 50)->nullable()->after('name');
    $table->enum('scope_type', ['global', 'unit'])->default('unit');
    $table->boolean('is_system_role')->default(false);
    // ...
});
```

#### 3. fix_rbac_unique_constraints_to_include_tenant_id.php (2025_12_13_132156)

**Modifies:**
- Changes unique constraint on permissions: (name, guard_name) → (name, guard_name, tenant_id)
- Changes unique constraint on roles: (name, guard_name) → (name, guard_name, tenant_id)

**Location:** `database/migrations/` → Runs on LANDLORD
**Should be:** `app/Contexts/TenantAuth/.../Tenant/` → Run on TENANT

---

### Existing TenantAuth Migrations (Already Correct)

These migrations are already in `app/Contexts/TenantAuth/Infrastructure/Database/Migrations/`:

1. **create_tenant_users_table.php** (2025_09_28_143000)
2. **create_tenant_brandings_table.php** (2025_09_27_000001)
3. **create_organizational_units_table.php** (2025_12_06_160000)
4. **create_tenant_user_registrations_table.php** (2025_01_01_000003)
5. **create_tenant_user_registration_transitions_table.php** (2025_01_01_000004)
6. **create_mass_registration_batches_table.php** (2025_10_07_000001)
7. **add_geography_columns_to_tenant_users_table.php** (2025_12_18_180000)
8. **align_tenant_users_with_universal_core_schema.php** (2025_12_06_120000)

**Status:** ✅ Correctly placed in TenantAuth context

---

## Solution: Reorganize with Landlord/Tenant Folders

### Platform Context Convention

Following the Platform Context installation infrastructure pattern:

```
app/Contexts/{ContextName}/Infrastructure/Database/Migrations/
├── Landlord/          # Migrations for landlord database
└── Tenant/            # Migrations for tenant databases
```

### Proposed Structure for TenantAuth

```
app/Contexts/TenantAuth/Infrastructure/Database/Migrations/
├── Landlord/
│   └── (none - TenantAuth has no landlord tables)
│
└── Tenant/
    ├── 2024_01_01_000001_create_committee_users_table.php
    ├── 2024_01_01_000002_create_unified_permissions_tables.php           ← MOVED
    ├── 2025_01_01_000003_create_tenant_user_registrations_table.php
    ├── 2025_01_01_000004_create_tenant_user_registration_transitions_table.php
    ├── 2025_09_27_000001_create_tenant_brandings_table.php
    ├── 2025_09_28_143000_create_tenant_users_table.php
    ├── 2025_10_07_000001_create_mass_registration_batches_table.php
    ├── 2025_12_06_120000_align_tenant_users_with_universal_core_schema.php
    ├── 2025_12_06_130000_complete_tenant_users_alignment.php
    ├── 2025_12_06_160000_create_organizational_units_table.php
    ├── 2025_12_06_184741_add_tenant_columns_to_spatie_tables.php         ← MOVED
    ├── 2025_12_13_132156_fix_rbac_unique_constraints_to_include_tenant_id.php ← MOVED
    └── 2025_12_18_180000_add_geography_columns_to_tenant_users_table.php
```

---

## Migration Consolidation Strategy

### Option 1: Keep Separate Migrations (Recommended)

**Pros:**
- Preserves migration history
- Easier rollback
- Clear separation of concerns

**Cons:**
- Multiple migration files
- Need to maintain execution order

### Option 2: Consolidate into Single Migration

Create new consolidated migration:

```php
// 2024_01_01_000002_create_tenant_rbac_tables.php

public function up(): void
{
    // 1. Create base Spatie tables with tenant awareness from the start
    Schema::create('permissions', function (Blueprint $table) {
        $table->bigIncrements('id');
        $table->string('name', 125);
        $table->string('guard_name', 125);
        $table->unsignedBigInteger('tenant_id')->nullable();  // ← ADDED
        $table->boolean('is_global')->default(false);
        $table->text('description')->nullable();
        $table->string('category', 50)->nullable();
        $table->json('metadata')->nullable();
        $table->timestamps();

        $table->unique(['name', 'guard_name', 'tenant_id']);  // ← TENANT-AWARE
        $table->index('tenant_id');
    });

    Schema::create('roles', function (Blueprint $table) {
        $table->bigIncrements('id');
        $table->string('name', 125);
        $table->string('guard_name', 125);
        $table->unsignedBigInteger('tenant_id')->nullable();  // ← ADDED
        $table->string('code', 50)->nullable();
        $table->enum('scope_type', ['global', 'unit'])->default('unit');
        $table->boolean('is_system_role')->default(false);
        $table->unsignedInteger('hierarchy_level')->nullable();
        $table->json('default_permissions')->nullable();
        $table->json('metadata')->nullable();
        $table->timestamps();

        $table->unique(['name', 'guard_name', 'tenant_id']);  // ← TENANT-AWARE
        $table->index('tenant_id');
    });

    // model_has_permissions, model_has_roles, role_has_permissions...
}
```

**Pros:**
- Single migration file
- Clean, tenant-aware schema from start
- No incremental column additions

**Cons:**
- Breaks migration history
- Requires data migration if already deployed

**Recommendation:** Use Option 2 for **NEW installations**. For existing systems, keep Option 1.

---

## Testing Strategy

### Unit Tests

Create tests for tenant RBAC functionality:

```php
// tests/Unit/Contexts/TenantAuth/TenantRBACTest.php

final class TenantRBACTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Use tenant database connection
        config(['database.default' => 'tenant']);
    }

    /** @test */
    public function roles_table_exists_with_tenant_columns(): void
    {
        $this->assertTrue(Schema::hasTable('roles'));
        $this->assertTrue(Schema::hasColumn('roles', 'tenant_id'));
        $this->assertTrue(Schema::hasColumn('roles', 'code'));
        $this->assertTrue(Schema::hasColumn('roles', 'scope_type'));
    }

    /** @test */
    public function permissions_table_exists_with_tenant_columns(): void
    {
        $this->assertTrue(Schema::hasTable('permissions'));
        $this->assertTrue(Schema::hasColumn('permissions', 'tenant_id'));
        $this->assertTrue(Schema::hasColumn('permissions', 'is_global'));
    }

    /** @test */
    public function unique_constraint_includes_tenant_id(): void
    {
        // Test that we can create same role name for different tenants
        $role1 = TenantRole::create([
            'name' => 'Committee Chief',
            'guard_name' => 'web',
            'tenant_id' => 1,
        ]);

        $role2 = TenantRole::create([
            'name' => 'Committee Chief',
            'guard_name' => 'web',
            'tenant_id' => 2,
        ]);

        $this->assertNotEquals($role1->id, $role2->id);
    }
}
```

### Integration Tests

Test with Platform Context installation:

```bash
# Install TenantAuth for a specific tenant
php artisan context:install TenantAuth --tenant=nrna --dry-run

# Expected output:
# ✅ TenantAuth Context Discovery
#   - 13 tenant migrations found
#   - Tables: roles, permissions, tenant_users, organizational_units, ...
#
# ✅ Installation Preview (Dry Run)
#   - Tenant: nrna (tenant_nrna)
#   - Migrations to run: 13
#   - Tables to create: 10
```

---

## Implementation Checklist

### Phase 1: Reorganize Migrations (Non-Breaking)

- [ ] Create `Tenant/` folder in `app/Contexts/TenantAuth/Infrastructure/Database/Migrations/`
- [ ] Copy all existing TenantAuth migrations to `Tenant/` folder
- [ ] Copy 3 RBAC migrations from `database/migrations/` to `TenantAuth/.../Tenant/`
- [ ] Update timestamps if needed to maintain execution order
- [ ] Verify with `php artisan context:list TenantAuth --detailed`

### Phase 2: Update Documentation

- [ ] Update TenantAuth context README
- [ ] Document migration execution order
- [ ] Add troubleshooting guide for common issues
- [ ] Update developer guide with RBAC setup instructions

### Phase 3: Test Migration Discovery

- [ ] Run `php artisan context:scan TenantAuth`
- [ ] Verify all 13 tenant migrations detected
- [ ] Check table names extracted correctly
- [ ] Test dry-run installation

### Phase 4: Test with Fresh Tenant

- [ ] Create test tenant
- [ ] Run `php artisan context:install TenantAuth --tenant=test_tenant`
- [ ] Verify all RBAC tables created in tenant database
- [ ] Test role/permission assignment
- [ ] Test TenantUser authentication

### Phase 5: Cleanup (After Verification)

- [ ] Remove duplicate migrations from `database/migrations/`
- [ ] Update any seeder references
- [ ] Update deployment scripts if needed

---

## Risk Assessment

### High Risk

- **Data Loss:** If RBAC tables already exist in landlord DB with data
  - **Mitigation:** Export data, recreate in tenant DBs, re-import

- **Foreign Key Violations:** Cross-database references
  - **Mitigation:** TenantAuth domain models already use application-level validation

### Medium Risk

- **Spatie Permission Cache:** May cache landlord DB structure
  - **Mitigation:** Clear cache after migration: `php artisan permission:cache-reset`

- **Existing Auth Guards:** May be configured for landlord DB
  - **Mitigation:** Update `config/auth.php` to use tenant connection

### Low Risk

- **Migration Timestamp Conflicts:** Reorganizing may affect order
  - **Mitigation:** Renumber timestamps in Tenant/ folder

---

## Deployment Strategy

### For NEW Installations (Clean Slate)

```bash
# 1. Scaffold platform
php artisan migrate

# 2. Bootstrap ModuleRegistry
php artisan db:seed --class=ModuleRegistryBootstrapSeeder

# 3. Install Platform context
php artisan context:install ModuleRegistry

# 4. Create tenant
php artisan tenants:create nrna --name="NRNA"

# 5. Install TenantAuth for tenant (migrations now in Tenant/ folder)
php artisan context:install TenantAuth --tenant=nrna
```

### For EXISTING Installations (Migration Path)

```bash
# 1. Backup landlord database
pg_dump publicdigit > backup_landlord.sql

# 2. Export RBAC data from landlord DB
php artisan export:rbac-data --output=rbac_data.json

# 3. Reorganize migrations (Phase 1)
# Manual: Copy migrations to Tenant/ folder

# 4. For each tenant:
#    a. Drop RBAC tables from landlord (if empty)
#    b. Run TenantAuth migrations on tenant DB
#    c. Import RBAC data
php artisan tenants:migrate-rbac --import=rbac_data.json

# 5. Update auth guards configuration
# Manual: Edit config/auth.php

# 6. Clear caches
php artisan cache:clear
php artisan permission:cache-reset
```

---

## Success Criteria

✅ All RBAC tables exist in **tenant databases**, NOT landlord
✅ TenantRole, TenantPermission, TenantUser models work correctly
✅ Spatie permission system functions properly per tenant
✅ Platform Context installation discovers all TenantAuth migrations
✅ Unit tests pass with 80%+ coverage
✅ Integration tests pass for fresh tenant provisioning
✅ No cross-database foreign key violations

---

## References

- **Platform Context Developer Guide:** `developer_guide/laravel-backend/tenant-database/20251230_platform_context_installation_guide.md`
- **Spatie Permission Docs:** https://spatie.be/docs/laravel-permission
- **Multi-Tenancy Guide:** `CLAUDE.md` (Tenant Migration Commands section)
- **Geography Context Integration:** `developer_guide/laravel-backend/geography-context/`

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Analysis Complete - Ready for Implementation
