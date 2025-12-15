# 🎯 **PROFESSIONAL CLAUDE CLI PROMPT: TENANT PERMISSION SIGNATURE FIX**

## **CONTEXT**
You are working on a Laravel 12 multi-tenant election management system. The system uses:
- **Spatie Multi-tenancy** for tenant isolation
- **Spatie Permission package** for RBAC with custom `TenantPermission` and `TenantRole` models
- **Template-based provisioning** with `TemplateProvisioningService`
- **TenantInterface** abstraction layer (recently implemented)

## **PROBLEM STATEMENT**
After implementing `TenantInterface` abstraction in the template system, the user registration flow is broken with a **method signature mismatch error**.

### **Error Details:**
```
Symfony\Component\ErrorHandler\Error\FatalError
app\Contexts\TenantAuth\Domain\Models\TenantPermission.php:110
Declaration of App\Contexts\TenantAuth\Domain\Models\TenantPermission::findByName(string $name, $tenantId = null, $guardName = null): ?App\Contexts\TenantAuth\Domain\Models\TenantPermission must be compatible with Spatie\Permission\Models\Permission::findByName(string $name, ?string $guardName = null): Spatie\Permission\Contracts\Permission
```

### **Root Cause Analysis:**
1. **Custom `TenantPermission` model** extends `Spatie\Permission\Models\Permission`
2. **Overrides `findByName()` method** with signature: `findByName(string $name, $tenantId = null, $guardName = null): ?self`
3. **Parent class expects**: `findByName(string $name, ?string $guardName = null): Permission`
4. **Signature mismatch** causes fatal error during Laravel's auth flow (registration/login)

### **Impact:**
- ✅ **Before**: Registration worked fine
- ❌ **After**: `POST /register` fails with fatal error
- ❌ **Tenant slug detection** might be interfering with landlord auth routes

## **IMMEDIATE OBJECTIVES**

### **Priority 1: Fix Method Signature Compliance**
Make `TenantPermission::findByName()` compatible with parent class while preserving tenant isolation logic.

### **Priority 2: Ensure Tenant Context Isolation**
Maintain tenant-scoped permission queries without breaking parent contract.

### **Priority 3: Fix Registration Flow**
Ensure `/register`, `/login`, and other landlord auth routes work without tenant interference.

## **REQUIREMENTS**

### **Must Have:**
1. ✅ **Backward Compatibility**: Existing tenant permission queries must still work
2. ✅ **Parent Contract Compliance**: Must match `Spatie\Permission\Models\Permission::findByName()` signature
3. ✅ **Tenant Isolation**: Permissions must be scoped to current tenant automatically
4. ✅ **Landlord Context**: Global permissions (tenant_id = null) must work in landlord context

### **Must Not:**
1. ❌ **Break Spatie Permission Package**: Core functionality must remain intact
2. ❌ **Remove Tenant Scope**: Tenant isolation is critical for multi-tenancy
3. ❌ **Modify SQL Templates**: Template system is working and package-agnostic

## **IMPLEMENTATION GUIDANCE**

### **Step 1: Fix TenantPermission::findByName()**

**Current (Incorrect):**
```php
public static function findByName(string $name, $tenantId = null, $guardName = null): ?self
{
    // Custom logic with tenant_id parameter
}
```

**Required (Correct):**
```php
public static function findByName(string $name, ?string $guardName = null): ?self
{
    $guardName = $guardName ?: config('auth.defaults.guard');
    
    // Get current tenant from Spatie's tenant context
    $tenant = \Spatie\Multitenancy\Models\Tenant::current();
    
    $query = static::where('name', $name);
    
    // Apply tenant scope automatically
    if ($tenant) {
        $query->where('tenant_id', $tenant->id);
    } else {
        // In landlord context, find global permissions
        $query->whereNull('tenant_id');
    }
    
    return $query->where('guard_name', $guardName)->first();
}
```

### **Step 2: Add Helper Method for Tenant-Specific Lookups**

```php
/**
 * Custom method for tenant-specific permission lookup
 * (Doesn't override parent, used internally)
 */
public static function findByNameForTenant(string $name, $tenantId, ?string $guardName = null): ?self
{
    $guardName = $guardName ?: config('auth.defaults.guard');
    
    return static::where('name', $name)
        ->where('tenant_id', $tenantId)
        ->where('guard_name', $guardName)
        ->first();
}
```

### **Step 3: Apply Same Fix to TenantRole Model**

If `TenantRole` has similar override, fix it too:

```php
public static function findByName(string $name, ?string $guardName = null): ?self
{
    // Same pattern as TenantPermission
}
```

### **Step 4: Update Global Scopes to Handle Auth Routes**

In both `TenantPermission` and `TenantRole` models:

```php
protected static function booted()
{
    static::addGlobalScope('tenant', function ($builder) {
        // Skip tenant scope during landlord auth routes
        if (request()->is('register', 'login', 'password/*', 'logout')) {
            $builder->whereNull('tenant_id');
            return;
        }
        
        $tenant = \Spatie\Multitenancy\Models\Tenant::current();
        
        if ($tenant) {
            $builder->where('tenant_id', $tenant->id);
        } else {
            $builder->whereNull('tenant_id');
        }
    });
}
```

### **Step 5: Clear Caches**

```bash
php artisan config:clear
php artisan cache:clear
composer dump-autoload
```

## **TESTING REQUIREMENTS**

### **Test Scenario 1: Registration Flow**
```bash
# Clear session and test fresh
curl -X GET http://localhost:8000/register
# Should show registration form (not redirect to tenant)

curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password","password_confirmation":"password"}'
# Should create user, not throw permission error
```

### **Test Scenario 2: Permission Lookups**
```php
// In tinker, test both contexts:
// 1. Landlord context (no tenant)
\Spatie\Multitenancy\Models\Tenant::forgetCurrent();
$permission = TenantPermission::findByName('elections.create');
// Should find global permission (tenant_id = null)

// 2. Tenant context
$tenant = Tenant::first();
$tenant->makeCurrent();
$permission = TenantPermission::findByName('elections.create');
// Should find tenant-scoped permission
```

### **Test Scenario 3: Spatie Package Integration**
```php
// Ensure Spatie's built-in methods still work
$user->hasPermissionTo('elections.create');
$user->assignRole('admin');
$role->givePermissionTo('members.view');
```

## **ROLLBACK PROCEDURE**

If issues persist, revert changes:

```bash
# 1. Revert TenantPermission changes
git checkout app/Contexts/TenantAuth/Domain\Models/TenantPermission.php

# 2. Temporarily remove TenantInterface from TemplateProvisioningService
# Change back to: public function applyTemplate(Tenant $tenant, ...)

# 3. Test registration works again
php artisan serve
```

## **EXPECTED OUTCOME**

After fix:
1. ✅ **Registration works**: `/register` creates landlord users
2. ✅ **Login works**: Both landlord and tenant authentication functional
3. ✅ **Tenant isolation preserved**: Permissions scoped correctly
4. ✅ **Spatie compatibility**: Package methods work as expected
5. ✅ **Template system intact**: `TenantInterface` abstraction functional

## **ADDITIONAL CONSIDERATIONS**

### **Middleware Stack Analysis:**
Check if tenant identification middleware runs during auth routes:

```php
// app/Http/Kernel.php - Ensure auth routes exclude tenant middleware
Route::middleware(['web', 'guest'])->group(function () {
    // These should NOT have 'identify.tenant' middleware
    Route::get('register', [RegisteredUserController::class, 'create']);
    Route::post('register', [RegisteredUserController::class, 'store']);
});
```

### **Permission Cache Isolation:**
Ensure permission cache is tenant-aware:

```php
// In PermissionRegistrar or service provider
$tenant = Tenant::current();
$cacheKey = $tenant ? "permissions.tenant.{$tenant->id}" : "permissions.landlord";
app(PermissionRegistrar::class)->setCacheKey($cacheKey);
```

## **NEXT STEPS AFTER FIX**

1. **Verify TemplateProvisioningService** works with `TenantInterface`
2. **Test tenant creation** with template application
3. **Run full test suite** to ensure no regressions
4. **Document the fix** in developer guides

---

**CLAUDE INSTRUCTIONS:**
Read this prompt carefully and provide:
1. **Fixed TenantPermission.php** with corrected method signature
2. **Fixed TenantRole.php** if similar issue exists
3. **Testing instructions** to verify the fix
4. **Any middleware adjustments** needed for auth routes
5. **Clear explanation** of what was wrong and why the fix works

**Critical:** Maintain backward compatibility while fixing the parent class contract violation.