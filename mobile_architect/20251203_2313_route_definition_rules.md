# 🎯 **CLAUDE PROMPT: IMPLEMENT MULTI-TENANT API ARCHITECTURE WITH CLEAR BOUNDARY RULES**

## 🏗️ **ARCHITECTURE RULES SUMMARY**

### **CORE PRINCIPLES:**
1. **Tenant slugs are BOUNDARIES** between tenants - NEVER remove from URL paths
2. **Tenant slug identifies WHICH tenant database** to use
3. **Routes include tenant slug** for proper tenant context isolation

### **RULES DEFINITION:**

**Rule 0: Reserved Slugs Cannot Be Tenant Slugs**
- All slugs in `config/reserved-slugs.php` CANNOT be used as tenant slugs
- Examples: `api`, `mapi`, `login`, `register`, `admin`, `setup`

**Rule 1: `api/*` → Vue Desktop API**
- Platform-level API endpoints
- No tenant context (platform operations)

**Rule 2: First Slug in Path = Tenant Identifier**
- First path segment after domain = tenant slug (if not reserved)
- Example: `/nrna/...` → tenant = "nrna"

**Rule 3: `mapi/*` → Angular Mobile API**
- Mobile-specific API endpoints
- Stateless, token-based authentication

**Rule 4: `{tenant}/api/*` → Desktop API for Specific Tenant**
- Vue desktop application APIs
- Tenant slug IN route: `/{tenant}/api/v1/...`
- Session-based authentication

**Rule 5: `{tenant}/mapi/*` → Mobile API for Specific Tenant**
- Angular mobile application APIs  
- Tenant slug IN route: `/{tenant}/mapi/v1/...`
- Sanctum token authentication

### **CRITICAL CONSTRAINTS:**
- ✅ **NEVER remove tenant slug** from URL path
- ✅ **Tenant slug stays in route** for matching
- ✅ **Middleware extracts tenant** from route parameter
- ✅ **Database switches** based on tenant slug
- ✅ **Clear separation**: Desktop vs Mobile APIs

## 📁 **IMPLEMENTATION REQUIREMENTS**

### **1. File Structure:**
```
routes/
├── web.php              # Platform web routes
├── api.php              # Platform APIs (Rule 1)
├── tenant.php           # Tenant desktop APIs (Rule 4)
├── mobileapp.php        # Tenant mobile APIs (Rule 5)
└── tenant-auth.php      # Tenant auth pages (Vue desktop)
```

### **2. Route Patterns:**

```php
// Rule 4: Desktop API WITH tenant slug
Route::prefix('{tenant}/api/v1')
    ->where('tenant', '[a-z0-9-_]+')
    ->middleware(['web', 'identify.tenant'])
    ->group(...);

// Rule 5: Mobile API WITH tenant slug  
Route::prefix('{tenant}/mapi/v1')
    ->where('tenant', '[a-z0-9-_]+')
    ->middleware(['api', 'identify.tenant'])
    ->group(...);

// Vue Desktop Pages WITH tenant slug
Route::prefix('{tenant}')
    ->where('tenant', '[a-z0-9-_]+')
    ->middleware(['web', 'identify.tenant'])
    ->group(function () {
        Route::get('/login', ...);     // /nrna/login
        Route::get('/dashboard', ...); // /nrna/dashboard
        Route::get('/register', ...);  // /nrna/register
    });
```

### **3. Current Issues to Fix:**

**Problem 1:** `routes/tenant.php` has `api/v1` (WRONG - missing `{tenant}/`)
- Current: `Route::prefix('api/v1')`
- Should be: `Route::prefix('{tenant}/api/v1')`

**Problem 2:** Catch-all route catches Vue desktop pages
- Current regex excludes only `/api/` and `/mapi/`
- Should also exclude Vue routes: `login`, `register`, `dashboard`, etc.

**Problem 3:** `routes/mobileapp.php` is correct ✅
- Already has `{tenant}/mapi/v1`

## 🔧 **SPECIFIC TASKS FOR CLAUDE:**

### **Task 1: Create/Update `config/reserved-slugs.php`**
```php
return [
    'api', 'mapi',
    'login', 'logout', 'register', 'forgot-password', 'reset-password',
    'admin', 'setup', 'apply-for-tenant', 'tenant-applications',
    'dashboard', 'profile', 'elections', 'finance', 'forum',
    'health', 'docs', 'platform'
];
```

### **Task 2: Fix `routes/tenant.php`**
```php
// FROM:
Route::prefix('api/v1')->middleware('api')->name('api.v1.')->group(...);

// TO:
Route::prefix('{tenant}/api/v1')
    ->where('tenant', '[a-z0-9-_]+')
    ->middleware(['web', 'identify.tenant'])
    ->name('desktop.api.v1.')
    ->group(...);
```

### **Task 3: Update Catch-All Route Exclusion**
```php
// List Vue desktop routes that should NOT go to Angular
$vueRoutes = [
    'login', 'logout', 'register', 'dashboard',
    'forgot-password', 'reset-password.*',
    'admin.*', 'setup.*', 'apply-for-tenant',
    'tenant-applications.*', 'registrations.*'
];

$exclusionRegex = '^(?!.*\/(api|mapi)\/|' . 
    implode('|', array_map('preg_quote', $vueRoutes)) . ').*$';

Route::get('/{any?}', ...)->where('any', $exclusionRegex);
```

### **Task 4: Verify Middleware Logic**
Ensure `IdentifyTenantFromRequest` middleware:
- Extracts tenant from route parameter (`$request->route('tenant')`)
- Sets tenant context WITHOUT modifying URL path
- Switches database connection based on tenant

## 🧪 **TESTING REQUIREMENTS**

### **Test URLs:**
```bash
# Should go to Vue Desktop
curl -v "https://publicdigit.com/nrna/login"
curl -v "https://publicdigit.com/nrna/dashboard"
curl -v "https://publicdigit.com/nrna/register"

# Should go to Vue Desktop API (Rule 4)
curl -X POST "https://publicdigit.com/nrna/api/v1/auth/login"

# Should go to Angular Mobile API (Rule 5)  
curl -X POST "https://publicdigit.com/nrna/mapi/v1/auth/login"

# Should go to Angular Mobile App
curl -v "https://publicdigit.com/nrna/"
curl -v "https://publicdigit.com/nrna/elections"
curl -v "https://publicdigit.com/nrna/profile"
```

### **Expected Results:**
- ✅ Vue desktop pages show Vue application
- ✅ Desktop API returns JSON for Vue app
- ✅ Mobile API returns JSON for Angular app  
- ✅ Non-Vue routes show Angular application

## 🚨 **CRITICAL REMINDERS:**

### **DO NOT:**
- ❌ Remove tenant slug from URL paths
- ❌ Change Angular URL construction (already correct)
- ❌ Break existing Vue desktop functionality
- ❌ Modify `IdentifyTenantFromRequest` to strip paths

### **DO:**
- ✅ Keep tenant slug in all route definitions
- ✅ Maintain clear boundary between desktop/mobile APIs
- ✅ Preserve existing Vue desktop application flow
- ✅ Ensure tenant database switching works correctly

## 📋 **IMPLEMENTATION STEPS:**

1. **First**: Check current route files and identify discrepancies
2. **Second**: Update `routes/tenant.php` to include `{tenant}/` prefix
3. **Third**: Fix catch-all regex to exclude Vue desktop routes
4. **Fourth**: Test all three applications work correctly
5. **Fifth**: Document the final architecture

## 🎯 **SUCCESS CRITERIA:**

- [ ] Tenant slug remains in all URLs
- [ ] Vue desktop app accessible at `/{tenant}/login`, `/{tenant}/dashboard`
- [ ] Desktop API accessible at `/{tenant}/api/v1/...`
- [ ] Mobile API accessible at `/{tenant}/mapi/v1/...`
- [ ] Angular app serves for non-Vue routes
- [ ] Database switches correctly per tenant
- [ ] All existing functionality preserved

**REMEMBER:** Tenant slugs are BOUNDARIES - they stay in the URL and are essential for tenant identification and database switching. Never remove them!
####################################################################################
**I AGREE!** Your separation plan is **EXCELLENT**! 🎯 

Here's how Claude should structure it:

## 📁 **ROUTE FILE STRUCTURE:**

```
routes/
├── web.php                    # Platform web pages
├── api.php                    # Platform APIs (Rule 1)
├── tenant-pages.php           # Vue Desktop Pages (NEW)
├── tenant-api.php             # Vue Desktop APIs (NEW - from tenant.php)
├── mobileapp.php              # Angular Mobile APIs (✓ Already correct)
└── tenant-spa.php             # Angular SPA Catch-all (NEW)
```

## 🏗️ **CLEAR SEPARATION:**

### **1. `routes/tenant-pages.php` - Vue Desktop Pages**
```php
// Vue Desktop Application Pages
Route::prefix('{tenant}')
    ->where('tenant', '[a-z0-9-_]+')
    ->middleware(['web', 'identify.tenant'])
    ->group(function () {
        // Authentication pages
        Route::get('/login', ...);           // /nrna/login
        Route::get('/register', ...);        // /nrna/register
        Route::get('/dashboard', ...);       // /nrna/dashboard
        
        // Admin pages
        Route::get('/admin/tenant-applications', ...);
        Route::get('/admin/registrations', ...);
        
        // Setup pages
        Route::get('/setup/password/{token}', ...);
    });
```

### **2. `routes/tenant-api.php` - Vue Desktop APIs**
```php
// Vue Desktop Application APIs (Rule 4)
Route::prefix('{tenant}/api/v1')
    ->where('tenant', '[a-z0-9-_]+')
    ->middleware(['web', 'identify.tenant', 'auth:sanctum'])
    ->name('desktop.api.v1.')
    ->group(function () {
        // Desktop API endpoints
        Route::post('/auth/login', ...);     // /nrna/api/v1/auth/login
        Route::get('/auth/me', ...);         // /nrna/api/v1/auth/me
        Route::get('/dashboard', ...);       // /nrna/api/v1/dashboard
        // ...
    });
```

### **3. `routes/mobileapp.php` - Angular Mobile APIs (✓ Already correct)**
```php
// Angular Mobile Application APIs (Rule 5) 
Route::prefix('{tenant}/mapi/v1')
    ->where('tenant', '[a-z0-9-_]+')
    ->middleware(['api', 'identify.tenant'])
    ->name('mobile.api.v1.')
    ->group(function () {
        // Mobile API endpoints
        Route::post('/auth/login', ...);     // /nrna/mapi/v1/auth/login
        Route::get('/auth/me', ...);         // /nrna/mapi/v1/auth/me
        // ...
    });
```

### **4. `routes/tenant-spa.php` - Angular SPA Catch-all**
```php
// Angular Mobile Application SPA (Catch-all)
Route::get('/{tenant}/{any?}', function ($tenant, $any = null) {
    // Serve Angular app for tenant
    $angularPath = public_path('angular-tenant/index.html');
    
    if (file_exists($angularPath)) {
        return response()->file($angularPath);
    }
    
    return view('tenant-spa-placeholder', [
        'tenant' => $tenant,
        'message' => 'Angular app will be served here',
    ]);
})->where('tenant', '[a-z0-9-_]+')
  ->where('any', '.*') // Catch everything after tenant
  ->name('angular.spa');
```

## 🔄 **LOADING ORDER IN `bootstrap/app.php`:**
```php
// Load in SPECIFIC order:
require base_path('routes/tenant-pages.php');   // 1. Vue Desktop Pages FIRST
require base_path('routes/tenant-api.php');     // 2. Vue Desktop APIs SECOND
require base_path('routes/mobileapp.php');      // 3. Angular Mobile APIs THIRD
require base_path('routes/tenant-spa.php');     // 4. Angular SPA LAST (catch-all)
```

## 🎯 **FLOW EXPLANATION:**

### **Request: `/nrna/login`**
1. Matches `{tenant}/login` in `tenant-pages.php` → Vue Desktop ✓

### **Request: `/nrna/api/v1/auth/login`**  
2. Matches `{tenant}/api/v1/auth/login` in `tenant-api.php` → Vue Desktop API ✓

### **Request: `/nrna/mapi/v1/auth/login`**
3. Matches `{tenant}/mapi/v1/auth/login` in `mobileapp.php` → Angular Mobile API ✓

### **Request: `/nrna/elections`**
4. No match in above files → Falls to `tenant-spa.php` → Angular SPA ✓

## 📋 **TELL CLAUDE TO IMPLEMENT:**

```
"YES! Implement the 4-file separation:

1. tenant-pages.php - Vue Desktop Pages ({tenant}/login, /dashboard, etc.)
2. tenant-api.php - Vue Desktop APIs ({tenant}/api/v1/*)  
3. mobileapp.php - Angular Mobile APIs ({tenant}/mapi/v1/*) - ALREADY CORRECT
4. tenant-spa.php - Angular SPA Catch-all ({tenant}/{any?})

Loading order in bootstrap/app.php:
1. tenant-pages.php (Vue pages FIRST)
2. tenant-api.php (Vue APIs SECOND)  
3. mobileapp.php (Angular APIs THIRD)
4. tenant-spa.php (Angular SPA LAST - catch-all)

IMPORTANT: All routes MUST include {tenant} parameter!
DO NOT modify existing mobileapp.php - it's already correct.
```

## ✅ **BENEFITS OF THIS STRUCTURE:**

1. **Clean separation** - Each file has single responsibility
2. **Clear loading order** - Vue routes match before Angular catch-all
3. **Easy maintenance** - Add/remove routes in appropriate file
4. **Clear boundaries** - Desktop vs Mobile explicitly separated
5. **Scalable** - Can add more route files as needed

**Your separation plan is PERFECT!** 🚀 Tell Claude to implement this structure!