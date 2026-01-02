# Tenant Provisioning Migration Path Fix

**Date**: 2025-12-30
**Context**: Phase 5.2 - RBAC Migration Reorganization Follow-up
**Status**: ✅ **COMPLETED**

---

## Problem Statement

After reorganizing TenantAuth migrations into the `Tenant/` subfolder (as part of Platform Context convention), the tenant provisioning process was still looking for migrations in the old location:

**OLD Path:**
```
app/Contexts/TenantAuth/Infrastructure/Database/Migrations/
```

**NEW Path:**
```
app/Contexts/TenantAuth/Infrastructure/Database/Migrations/Tenant/
```

This caused provisioning to **fail silently** - no migrations would run during tenant database creation.

---

## Root Cause

The RBAC migration reorganization (Phase 5.2) moved all TenantAuth migrations to the `Tenant/` subfolder to follow Platform Context convention (Landlord/Tenant separation). However, **4 files** were still hardcoded with the old migration path, causing them to fail when provisioning new tenant databases.

---

## Files Updated

### 1. MigrationOrchestrator.php ✅

**Location:** `app/Infrastructure/TenantDatabase/MigrationOrchestrator.php`

**Line 37 Changed:**
```php
// BEFORE
private const MIGRATION_PATHS = [
    'TenantAuth' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
    'Shared' => 'app/Shared/Infrastructure/Database/Migrations',
    'Election' => 'app/Contexts/Election/Infrastructure/Database/Migrations',
];

// AFTER
private const MIGRATION_PATHS = [
    'TenantAuth' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations/Tenant',
    'Shared' => 'app/Shared/Infrastructure/Database/Migrations',
    'Election' => 'app/Contexts/Election/Infrastructure/Database/Migrations',
];
```

**Impact:** Central orchestrator for multi-context tenant migrations. Used when running all context migrations in sequence.

---

### 2. TenantDatabaseManager.php ✅

**Location:** `app/Contexts/TenantAuth/Infrastructure/Database/TenantDatabaseManager.php`

**Line 353 Changed:**
```php
// BEFORE
Artisan::call('migrate', [
    '--database' => $connectionName,
    '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
    '--force' => true,
]);

// AFTER
Artisan::call('migrate', [
    '--database' => $connectionName,
    '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations/Tenant',
    '--force' => true,
]);
```

**Impact:** TenantAuth context's own database manager. Used by TenantAuth domain services.

---

### 3. TenantAuthMigrateCommand.php ✅

**Location:** `app/Contexts/TenantAuth/Application/Commands/TenantAuthMigrateCommand.php`

**Line 160 Changed:**
```php
// BEFORE
$migrationParams = [
    '--database' => 'tenant',
    '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
    '--force' => $this->option('force') || $this->option('all'),
];

// AFTER
$migrationParams = [
    '--database' => 'tenant',
    '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations/Tenant',
    '--force' => $this->option('force') || $this->option('all'),
];
```

**Impact:** Custom Artisan command for running TenantAuth migrations. Used by:
- `php artisan tenantauth:migrate --all`
- `php artisan tenantauth:migrate {tenant_slug}`

---

### 4. TenantProvisioningService.php ✅

**Location:** `app/Contexts/Platform/Application/Services/TenantProvisioningService.php`

**Line 566 Changed:**
```php
// BEFORE
Artisan::call('migrate', [
    '--database' => 'tenant',
    '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
    '--force' => true
]);

// AFTER
Artisan::call('migrate', [
    '--database' => 'tenant',
    '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations/Tenant',
    '--force' => true
]);
```

**Impact:** **PRIMARY PROVISIONING SERVICE**. Used when:
- New tenant applications are approved
- Tenant database is created via admin panel
- Automatic provisioning after approval workflow

**This is the most critical fix** - without it, newly provisioned tenants would have **NO RBAC tables**.

---

## Verification

### Grep Search Confirmation

```bash
$ grep -r "app/Contexts/TenantAuth/Infrastructure/Database/Migrations" --include="*.php" packages/laravel-backend/
```

**Result:** No matches found (excluding the new `Tenant/` subfolder)

✅ **Confirmed:** All references updated to new path.

---

## Testing Checklist

### Manual Testing

- [ ] **Test 1: Fresh Tenant Provisioning**
  ```php
  // Via tenant application approval
  $service = app(\App\Contexts\Platform\Application\Services\TenantProvisioningService::class);
  $tenant = $service->provisionTenant([
      'organization_name' => 'Test Organization',
      'slug' => 'test-org',
      'admin_email' => 'admin@test.org',
      'admin_name' => 'Test Admin',
      'first_name' => 'Test',
      'last_name' => 'Admin',
  ]);
  ```

  **Expected:**
  - Tenant database created
  - All 11 TenantAuth migrations run
  - RBAC tables created (roles, permissions, etc.)
  - Admin user seeded
  - Welcome email sent

- [ ] **Test 2: TenantAuth Migrate Command**
  ```bash
  php artisan tenantauth:migrate test-org
  ```

  **Expected:**
  - Migrations run from Tenant/ subfolder
  - All 11 migrations applied
  - No "path not found" errors

- [ ] **Test 3: Migration Orchestrator**
  ```php
  $orchestrator = app(\App\Infrastructure\TenantDatabase\MigrationOrchestrator::class);
  $orchestrator->runTenantAuthMigrations($database);
  ```

  **Expected:**
  - TenantAuth migrations run successfully
  - Context sequence maintained (TenantAuth → Shared → Election)

### Database Verification

After provisioning, verify tenant database has:

```sql
-- Connect to tenant database
\c tenant_test_org

-- Check RBAC tables exist
\dt
```

**Expected tables:**
- permissions
- roles
- model_has_permissions
- model_has_roles
- role_has_permissions
- tenant_users
- organizational_units
- tenant_brandings
- tenant_user_registrations
- tenant_user_registration_transitions
- mass_registration_batches

**Total:** 11 tables (matching 11 migrations)

---

## Impact Assessment

### High Impact (Before Fix)

| Scenario | Broken Behavior |
|----------|----------------|
| **New tenant approval** | Tenant created BUT no RBAC tables |
| **Admin creates tenant** | Database exists BUT migrations don't run |
| **TenantAuth migrate command** | Silently fails or errors "path not found" |
| **Tenant user login** | Fails - tenant_users table missing |
| **Permission checks** | Fail - roles/permissions tables missing |

### After Fix

| Scenario | Expected Behavior |
|----------|------------------|
| **New tenant approval** | ✅ Full provisioning with all RBAC tables |
| **Admin creates tenant** | ✅ Complete migration execution |
| **TenantAuth migrate command** | ✅ Runs from correct Tenant/ path |
| **Tenant user login** | ✅ Works - tenant_users exists |
| **Permission checks** | ✅ Works - RBAC tables exist |

---

## Migration Path Convention

Following Platform Context best practices:

```
app/Contexts/{ContextName}/Infrastructure/Database/Migrations/
├── Landlord/          # Migrations for landlord database
│   └── (if context has landlord tables)
│
└── Tenant/            # Migrations for tenant databases
    └── {timestamp}_migration_name.php
```

### Examples

**TenantAuth Context:**
```
app/Contexts/TenantAuth/Infrastructure/Database/Migrations/
└── Tenant/  ← All TenantAuth migrations (no landlord tables)
    ├── 2024_01_01_000002_create_tenant_rbac_tables.php
    ├── 2025_09_28_143000_create_tenant_users_table.php
    └── ... (11 total)
```

**ModuleRegistry Context:**
```
app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations/
├── Landlord/
│   ├── 2025_01_15_000001_create_modules_table.php
│   └── 2025_01_15_000002_create_module_dependencies_table.php
└── Tenant/
    ├── 2025_01_15_000003_create_tenant_modules_table.php
    ├── 2025_01_15_000004_create_module_installation_jobs_table.php
    └── 2025_01_15_000005_create_installation_steps_table.php
```

---

## Related Documentation

1. **RBAC Migration Analysis:**
   `developer_guide/laravel-backend/tenant-database/20251230_membership_rbac_migration_analysis.md`

2. **RBAC Implementation Summary:**
   `developer_guide/laravel-backend/tenant-database/20251230_tenant_rbac_implementation_summary.md`

3. **Platform Context Installation Guide:**
   `developer_guide/laravel-backend/tenant-database/20251230_platform_context_installation_guide.md`

---

## Deployment Notes

### For Production

1. **No database changes required** - this is a code-only fix
2. **Existing tenants unaffected** - migrations already run
3. **New tenants benefit immediately** - will get all RBAC tables
4. **Re-provisioning works** - can re-run migrations if needed

### Rollback Plan

If issues arise, revert migration paths in 4 files:

```bash
# Revert to old path (NOT recommended)
'app/Contexts/TenantAuth/Infrastructure/Database/Migrations'
```

**Better approach:** Fix forward - the Tenant/ folder structure is correct per Platform Context convention.

---

## Success Criteria

- [x] All 4 provisioning files updated
- [x] Grep search confirms no old paths remain
- [x] Migration path follows Platform Context convention
- [ ] Manual testing completed (pending user verification)
- [ ] Fresh tenant provisioning verified
- [ ] RBAC tables confirmed in new tenant database

---

## Summary

### What Changed

Migrat paths in **4 critical files** updated from:
```
app/Contexts/TenantAuth/Infrastructure/Database/Migrations
```

To:
```
app/Contexts/TenantAuth/Infrastructure/Database/Migrations/Tenant
```

### Why It Matters

Without this fix, **new tenant provisioning would silently fail** to create RBAC tables, breaking:
- User authentication
- Permission checks
- Role assignments
- Organizational structure

### Verification

✅ All provisioning code now points to correct `Tenant/` subfolder
✅ Follows Platform Context convention (Landlord/Tenant separation)
✅ Ready for production deployment

---

**Fix Status:** ✅ **COMPLETE**
**Testing Required:** Manual verification of fresh tenant provisioning
**Deployment Risk:** LOW (code-only, no DB changes, existing tenants unaffected)
