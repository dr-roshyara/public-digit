# Password Column Audit - All Issues Identified

**Date:** 2025-12-13 15:50
**Audit Scope:** Entire codebase for 'password' column usage
**Status:** ⚠️ CRITICAL ISSUES FOUND

---

## Executive Summary

After fixing SecureSetupTokenService (✅ COMPLETE), a comprehensive codebase audit revealed **TWO ADDITIONAL CRITICAL BUGS** with the same root cause:

### Migration History Recap
- **Dec 6, 2025**: Column renamed from `password` to `password_hash`
- **Migration**: `2025_12_06_130000_complete_tenant_users_alignment.php`
- **Current Schema**: `tenant_users` table has `password_hash` column (NOT `password`)

### Issues Found

| # | File | Line | Severity | Type | Status |
|---|------|------|----------|------|--------|
| 1 | SecureSetupTokenService.php | 213 | 🔴 CRITICAL | Query Builder | ✅ FIXED |
| 2 | TenantProvisioningService.php | 342 | 🔴 CRITICAL | Query Builder | ❌ NOT FIXED |
| 3 | TenantUser.php (model) | 29, 38, 46 | 🟡 HIGH | Eloquent Mapping | ❌ NOT FIXED |

---

## Issue #1: SecureSetupTokenService ✅ FIXED

**File:** `app/Contexts/Platform/Application/Services/SecureSetupTokenService.php`
**Line:** 213
**Status:** ✅ FIXED (as of 2025-12-13 15:30)

**Problem:**
```php
// ❌ BEFORE (broken):
DB::table('tenant_users')
    ->where('email', $tokenData['email'])
    ->update([
        'password' => bcrypt($password),  // Column doesn't exist!
        'email_verified_at' => now(),
    ]);
```

**Solution:**
```php
// ✅ AFTER (fixed):
DB::table('tenant_users')
    ->where('email', $tokenData['email'])
    ->update([
        'password_hash' => bcrypt($password),  // ✅ Correct column
        'email_verified_at' => now(),
    ]);
```

**Impact:** Tenant admin password setup now works.
**Test Coverage:** ✅ SecureSetupPasswordTest.php created

---

## Issue #2: TenantProvisioningService ❌ CRITICAL

**File:** `app/Contexts/Platform/Application/Services/TenantProvisioningService.php`
**Line:** 342
**Status:** ❌ NOT FIXED
**Severity:** 🔴 CRITICAL (breaks tenant provisioning)

**Problem:**
```php
// Line 339-355: ❌ BROKEN
} else {
    // Create admin user from application contact information
    $userId = DB::table('tenant_users')->insertGetId([
        'name' => $adminName,
        'email' => $adminEmail,
        'password' => bcrypt('temporary-password-' . uniqid()), // ❌ WRONG COLUMN!
        'role' => 'admin',
        'status' => 'active',
        'email_verified_at' => null,
        'metadata' => json_encode([
            'tenant_id' => $tenant->id,
            'organization_name' => $tenant->name,
            'created_via' => 'tenant_provisioning',
            'is_initial_admin' => true,
            'application_contact' => true
        ]),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}
```

**Impact:**
- **When triggered**: During tenant provisioning when creating admin user from application
- **Error**: `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'password' in 'field list'`
- **Result**: Tenant provisioning FAILS, admin user NOT created

**Solution:**
```php
// ✅ CORRECT:
$userId = DB::table('tenant_users')->insertGetId([
    'name' => $adminName,
    'email' => $adminEmail,
    'password_hash' => bcrypt('temporary-password-' . uniqid()), // ✅ FIXED
    'role' => 'admin',
    'status' => 'active',
    // ... rest unchanged
]);
```

**TDD Approach Required:**
1. Create test: `TenantProvisioningPasswordTest.php`
2. Test case: Verify admin user created with password_hash column
3. Fix the bug
4. Verify tests pass

---

## Issue #3: TenantUser Model Mapping ❌ HIGH PRIORITY

**File:** `app/Contexts/TenantAuth/Domain/Models/TenantUser.php`
**Lines:** 29, 38, 46
**Status:** ❌ NOT FIXED
**Severity:** 🟡 HIGH (affects ALL Eloquent operations)

**Problem:**

The TenantUser model references `password` attribute, but database column is `password_hash`:

```php
// Line 26-35: ❌ ATTRIBUTE/COLUMN MISMATCH
protected $fillable = [
    'name',
    'email',
    'password',  // ❌ Attribute name
    'role',
    // ...
];

// Line 37-40:
protected $hidden = [
    'password',  // ❌ Attribute name
    'remember_token',
];

// Line 42-47:
protected $casts = [
    'email_verified_at' => 'datetime',
    'last_login_at' => 'datetime',
    'metadata' => 'array',
    'password' => 'hashed',  // ❌ Attribute name
];
```

**Database Reality:**
```sql
mysql> DESCRIBE tenant_users;
+-------------------+--------------+------+
| Field             | Type         | Null |
+-------------------+--------------+------+
| password_hash     | varchar(255) | YES  |  -- ✅ Actual column
+-------------------+--------------+------+
-- NO 'password' column exists!
```

**Impact:**

### Affected Code Locations:
1. **ElectionRequestAdminController.php** (Lines 760, 774):
```php
// Line 769-774: Uses Eloquent with 'password' attribute
$committeeChief = $tenantUserInstance->firstOrCreate(
    ['email' => $electionRequest->proposed_chief_email],
    [
        'name' => $electionRequest->proposed_chief_name,
        'email' => $electionRequest->proposed_chief_email,
        'password' => Hash::make($autoPassword),  // ⚠️ Uses model's 'password' attribute
        'role' => TenantUser::ROLE_COMMITTEE_CHIEF,
        // ...
    ]
);
```

**Question:** Does this work or fail?
- **If Laravel auto-maps:** `password` attribute → `password_hash` column (unlikely without custom mutator)
- **If Laravel doesn't map:** Query tries to insert into non-existent `password` column → FAILS

### Solutions (Choose One):

#### Option A: Update Model to Use password_hash (RECOMMENDED)

**Pros:**
- Explicit column mapping (no magic)
- Matches actual database schema
- Clear and obvious

**Cons:**
- Changes model interface
- Need to update all code using `$user->password =`

```php
// ✅ SOLUTION A:
protected $fillable = [
    'name',
    'email',
    'password_hash',  // ✅ Explicit column name
    'role',
    // ...
];

protected $hidden = [
    'password_hash',  // ✅ Hide the hash
    'remember_token',
];

protected $casts = [
    'password_hash' => 'hashed',  // ✅ Auto-hash on save
    // ...
];
```

**Code Update Required:**
```php
// Instead of:
$user->password = 'new-password';

// Use:
$user->password_hash = 'new-password';  // Auto-hashed by Laravel

// OR in arrays:
TenantUser::create([
    'email' => 'admin@example.com',
    'password_hash' => 'new-password',  // Auto-hashed
]);
```

#### Option B: Add Custom Accessor/Mutator (INTERMEDIATE)

**Pros:**
- Keeps `password` attribute interface
- Backward compatible
- Automatic mapping

**Cons:**
- Hidden behavior (magic)
- Potential confusion

```php
// ✅ SOLUTION B: Add to TenantUser model

protected $fillable = [
    'name',
    'email',
    'password',  // Keep attribute name
    'role',
    // ...
];

protected $casts = [
    // Remove 'password' => 'hashed' from here
    // ...
];

// Custom mutator (Laravel 11 style)
protected function password(): Attribute
{
    return Attribute::make(
        get: fn ($value) => $value,
        set: fn ($value) => ['password_hash' => bcrypt($value)],
    );
}

// OR Laravel 10 style:
public function setPasswordAttribute($value): void
{
    $this->attributes['password_hash'] = bcrypt($value);
}

public function getPasswordAttribute(): ?string
{
    return $this->attributes['password_hash'] ?? null;
}
```

**Usage (transparent):**
```php
// Still use 'password' attribute (mapped automatically):
$user->password = 'new-password';  // Auto-hashed and stored in password_hash
$user->save();

TenantUser::create([
    'email' => 'admin@example.com',
    'password' => 'new-password',  // Auto-hashed and stored in password_hash
]);
```

#### Option C: Database Column Rename (NOT RECOMMENDED)

**Pros:**
- No code changes needed

**Cons:**
- Reverses the Dec 6 migration (backwards step)
- `password_hash` is more explicit and secure naming convention
- Against Laravel best practices

```sql
-- ❌ NOT RECOMMENDED:
ALTER TABLE tenant_users CHANGE password_hash password VARCHAR(255);
```

---

## Recommendation

### Immediate Actions (Priority Order):

1. **Fix TenantProvisioningService.php (Line 342)** 🔴 CRITICAL
   - Change `'password' =>` to `'password_hash' =>`
   - Create TDD test first
   - This is a Query Builder bug (same as SecureSetupTokenService)

2. **Fix TenantUser Model** 🟡 HIGH
   - **Recommended:** Use Option B (Custom Mutator)
   - Keeps backward compatibility
   - Auto-maps `password` attribute to `password_hash` column
   - Less code changes needed

3. **Test ElectionRequestAdminController** 🟢 MEDIUM
   - Test if committee chief creation works
   - If fails, it will be fixed by fixing TenantUser model

### Implementation Plan

#### Step 1: Fix TenantProvisioningService (TDD)

**Create Test:**
```php
// tests/Feature/Platform/TenantProvisioningPasswordTest.php

/** @test */
public function tenant_provisioning_creates_admin_with_password_hash(): void
{
    // 1. Create tenant
    $tenant = Tenant::create([...]);

    // 2. Provision tenant
    $service = app(TenantProvisioningService::class);
    $service->provisionTenant($tenant, 'admin@test.com', 'Admin User');

    // 3. Verify admin user created with password_hash
    $admin = DB::connection('tenant')->table('tenant_users')
        ->where('email', 'admin@test.com')
        ->first();

    $this->assertNotNull($admin);
    $this->assertNotNull($admin->password_hash);
    $this->assertNull($admin->password ?? null);  // Old column shouldn't exist
}
```

**Fix Code:**
```php
// TenantProvisioningService.php line 342:
'password_hash' => bcrypt('temporary-password-' . uniqid()),  // ✅ FIXED
```

#### Step 2: Fix TenantUser Model

**Add Mutator:**
```php
// TenantUser.php

use Illuminate\Database\Eloquent\Casts\Attribute;

// Option 1: Laravel 11 style (if using Laravel 11+)
protected function password(): Attribute
{
    return Attribute::make(
        get: fn ($value) => $value,
        set: fn ($value) => ['password_hash' => bcrypt($value)],
    );
}

// Option 2: Laravel 10 style (if using Laravel 10)
public function setPasswordAttribute($value): void
{
    $this->attributes['password_hash'] = bcrypt($value);
}
```

**Update Casts:**
```php
protected $casts = [
    'email_verified_at' => 'datetime',
    'last_login_at' => 'datetime',
    'metadata' => 'array',
    // Remove 'password' => 'hashed' if using custom mutator
];
```

#### Step 3: Test Everything

```bash
# Run all password-related tests
php artisan test --filter Password

# Test tenant provisioning
php artisan test --filter TenantProvisioning

# Test authentication
php artisan test --filter TenantAuth
```

---

## Files Requiring Changes

### High Priority (MUST FIX):
1. ✅ `app/Contexts/Platform/Application/Services/SecureSetupTokenService.php` (DONE)
2. ❌ `app/Contexts/Platform/Application/Services/TenantProvisioningService.php` (Line 342)
3. ❌ `app/Contexts/TenantAuth/Domain/Models/TenantUser.php` (Add mutator)

### Medium Priority (VERIFY):
4. ❓ `app/Contexts/ElectionSetup/Infrastructure/Http/Controllers/ElectionRequestAdminController.php` (Lines 760, 774)
   - Will be fixed automatically if TenantUser model is fixed

### Low Priority (Database Config - SAFE):
All other files using `'password' =>` are database connection configs (env('DB_PASSWORD')), authentication attempts, or test data - these are SAFE and do NOT need changes.

---

## Test Coverage Required

### Tests to Create:
1. ✅ `SecureSetupPasswordTest.php` (DONE)
2. ❌ `TenantProvisioningPasswordTest.php` (TODO)
3. ❌ `TenantUserPasswordMutatorTest.php` (TODO)
4. ❌ `CommitteeChiefCreationTest.php` (TODO)

### Test Scenarios:
- [ ] Tenant provisioning creates admin with password_hash
- [ ] TenantUser model auto-maps password → password_hash
- [ ] Committee chief creation works with password attribute
- [ ] Password reset works correctly
- [ ] Authentication works after password set

---

## Related Documentation

- **Password Hash Fix (Issue #1):** `20251213_1545_password_hash_column_fix_complete.md`
- **Migration History:** `2025_12_06_130000_complete_tenant_users_alignment.php`
- **Debugging Guide:** `20251213_1527_debug_tenant_appliation.md`

---

**Audit Date:** 2025-12-13 15:50
**Auditor:** Claude (AI Assistant)
**Critical Issues Found:** 2 (1 fixed, 1 pending)
**High Priority Issues:** 1 (TenantUser model)
**Status:** ⚠️ REQUIRES IMMEDIATE ACTION

---

## Next Steps

1. **User Review:** Review this audit and approve fix strategy
2. **TDD Implementation:** Fix TenantProvisioningService with tests first
3. **Model Update:** Add password mutator to TenantUser
4. **Comprehensive Testing:** Run all tests to verify no regressions
5. **Production Verification:** Test actual tenant provisioning flow end-to-end

**Estimated Time:** 1-2 hours (with TDD approach)
**Risk Level:** Medium (affects tenant provisioning, but isolated scope)
