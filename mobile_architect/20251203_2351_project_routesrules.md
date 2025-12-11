# 🎯 **CLAUDE PROMPT: IMPLEMENT 6-CASE MULTI-TENANT ROUTING ARCHITECTURE**

## 🏗️ **ARCHITECTURE OVERVIEW**

**Six Routing Cases:**
1. `/{tenant}/mapi/*` → Tenant Angular Mobile API
2. `/{tenant}/api/*` → Tenant Vue Desktop API
3. `/{tenant}/*` (no api/mapi) → Tenant Vue Desktop Pages
4. `/mapi/*` → Platform Angular Mobile API
5. `/api/*` → Platform Vue Desktop API
6. `/{anyword}/*` → Platform Vue Desktop Pages

**Core Principle:** Tenant slugs are boundaries - NEVER remove from URL paths.

---

## 📋 **TASK 1: CREATE CONFIGURATION FILES**

### **1.1 Create `config/reserved-slugs.php`:**
```php
<?php
// config/reserved-slugs.php
return [
    // API prefixes
    'api', 'mapi',
    
    // Authentication pages
    'login', 'logout', 'register', 
    'forgot-password', 'reset-password',
    
    // Admin/management
    'admin', 'setup', 'dashboard', 'profile',
    
    // Features (platform-level)
    'elections', 'finance', 'forum', 
    'health', 'docs', 'platform',
    
    // Tenant application flow
    'apply-for-tenant', 'tenant-applications',
];
```

### **1.2 Create `config/tenant.php`:**
```php
<?php
// config/tenant.php
return [
    'slugs' => [
        'nrna',
        'uml',
        'test-tenant',
        // Add all active tenant slugs here
    ],
    
    // Validation: Ensure no reserved slugs are used as tenant slugs
    'validate' => function() {
        $reserved = config('reserved-slugs');
        $tenantSlugs = config('tenant.slugs');
        
        $conflict = array_intersect($reserved, $tenantSlugs);
        if (!empty($conflict)) {
            throw new \Exception(
                "Configuration conflict. Reserved slugs used as tenant slugs: " .
                implode(', ', $conflict)
            );
        }
    }
];
```

---

## 📋 **TASK 2: UPDATE BOOTSTRAP/APP.PHP LOADING ORDER**

### **2.1 Current `bootstrap/app.php` (update section):**
```php
// Find the route loading section and REPLACE with:

/*
|--------------------------------------------------------------------------
| Load The Application Routes
|--------------------------------------------------------------------------
|
| Here we will load all the route files for the application.
| CRITICAL: Load order matters for route precedence.
|
*/

// ===== PLATFORM ROUTES (FIRST - most specific) =====
require base_path('routes/platform-web.php');     // CASE 6: /login, /register, etc.
require base_path('routes/platform-api.php');     // CASE 5: /api/v1/*
require base_path('routes/platform-mapi.php');    // CASE 4: /mapi/v1/*

// ===== TENANT ROUTES (SECOND - tenant-specific) =====
require base_path('routes/tenant-web.php');       // CASE 3: /{tenant}/login, /dashboard
require base_path('routes/tenant-api.php');       // CASE 2: /{tenant}/api/v1/*
require base_path('routes/tenant-mapi.php');      // CASE 1: /{tenant}/mapi/v1/*

// ===== ANGULAR SPA CATCH-ALL (LAST) =====
require base_path('routes/angular-spa.php');      // /{tenant}/{any?} → Angular App
```

---

## 📋 **TASK 3: CREATE/UPDATE ROUTE FILES**

### **3.1 Create `routes/platform-web.php` (CASE 6):**
```php
<?php
// routes/platform-web.php
// Platform Vue Desktop Pages
// Handles: /login, /register, /admin, etc.

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Platform\AuthController;
use App\Http\Controllers\Platform\AdminController;

Route::middleware(['web'])->group(function () {
    // Authentication
    Route::get('/login', [AuthController::class, 'showLoginForm'])->name('platform.login');
    Route::get('/register', [AuthController::class, 'showRegisterForm'])->name('platform.register');
    Route::get('/forgot-password', [AuthController::class, 'showForgotPasswordForm'])->name('platform.password.request');
    Route::get('/reset-password/{token}', [AuthController::class, 'showResetPasswordForm'])->name('platform.password.reset');
    
    // Admin
    Route::get('/admin', [AdminController::class, 'dashboard'])->name('platform.admin.dashboard');
    Route::get('/admin/tenant-applications', [AdminController::class, 'tenantApplications'])->name('platform.admin.tenant-applications');
    
    // Tenant application
    Route::get('/apply-for-tenant', [AdminController::class, 'applyForTenant'])->name('platform.apply-for-tenant');
});
```

### **3.2 Create `routes/platform-api.php` (CASE 5):**
```php
<?php
// routes/platform-api.php
// Platform Vue Desktop APIs
// Handles: /api/v1/*

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Platform\Api\AuthController;
use App\Http\Controllers\Platform\Api\TenantController;

Route::prefix('api/v1')
    ->middleware(['api'])  // Stateless API middleware
    ->name('platform.api.')
    ->group(function () {
        // Authentication
        Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum')->name('auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->middleware('auth:sanctum')->name('auth.me');
        
        // Tenant management (platform admin)
        Route::get('/tenants', [TenantController::class, 'index'])->middleware('auth:sanctum')->name('tenants.index');
        Route::post('/tenants', [TenantController::class, 'store'])->middleware('auth:sanctum')->name('tenants.store');
        Route::put('/tenants/{id}', [TenantController::class, 'update'])->middleware('auth:sanctum')->name('tenants.update');
        
        // Health check
        Route::get('/health', function () {
            return response()->json(['status' => 'healthy']);
        })->name('health');
    });
```

### **3.3 Create `routes/platform-mapi.php` (CASE 4):**
```php
<?php
// routes/platform-mapi.php
// Platform Angular Mobile APIs
// Handles: /mapi/v1/*

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Platform\Mobile\AuthController;
use App\Http\Controllers\Platform\Mobile\TenantController;

Route::prefix('mapi/v1')
    ->middleware(['api'])  // Stateless API middleware
    ->name('platform.mapi.')
    ->group(function () {
        // Platform mobile authentication
        Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum')->name('auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->middleware('auth:sanctum')->name('auth.me');
        
        // Tenant discovery (for mobile app tenant selection)
        Route::get('/tenants', [TenantController::class, 'index'])->name('tenants.index');
        Route::get('/tenants/search', [TenantController::class, 'search'])->name('tenants.search');
        
        // Health check for mobile
        Route::get('/health', function () {
            return response()->json([
                'status' => 'healthy',
                'service' => 'mobile-platform-api'
            ]);
        })->name('health');
    });
```

### **3.4 Create `routes/tenant-web.php` (CASE 3):**
```php
<?php
// routes/tenant-web.php
// Tenant Vue Desktop Pages
// Handles: /{tenant}/login, /{tenant}/dashboard, etc.

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Tenant\AuthController;
use App\Http\Controllers\Tenant\DashboardController;

Route::prefix('{tenant}')
    ->where('tenant', function ($slug) {
        // Validate: Must be in tenant config AND not reserved
        return in_array($slug, config('tenant.slugs')) 
            && !in_array($slug, config('reserved-slugs'));
    })
    ->middleware(['web', 'identify.tenant'])
    ->group(function () {
        // Tenant authentication pages
        Route::get('/login', [AuthController::class, 'showLoginForm'])->name('tenant.login');
        Route::get('/register', [AuthController::class, 'showRegisterForm'])->name('tenant.register');
        Route::get('/forgot-password', [AuthController::class, 'showForgotPasswordForm'])->name('tenant.password.request');
        Route::get('/reset-password/{token}', [AuthController::class, 'showResetPasswordForm'])->name('tenant.password.reset');
        
        // Tenant dashboard and admin
        Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('auth')->name('tenant.dashboard');
        Route::get('/admin', [DashboardController::class, 'admin'])->middleware(['auth', 'can:admin'])->name('tenant.admin');
        
        // Setup flow
        Route::get('/setup/password/{token}', [AuthController::class, 'showSetupPasswordForm'])->name('tenant.setup.password');
    });
```

### **3.5 Create `routes/tenant-api.php` (CASE 2):**
```php
<?php
// routes/tenant-api.php
// Tenant Vue Desktop APIs
// Handles: /{tenant}/api/v1/*

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Tenant\Api\AuthController;
use App\Http\Controllers\Tenant\Api\DashboardController;

Route::prefix('{tenant}/api/v1')
    ->where('tenant', function ($slug) {
        return in_array($slug, config('tenant.slugs')) 
            && !in_array($slug, config('reserved-slugs'));
    })
    ->middleware(['web', 'identify.tenant'])  // Web middleware for Vue/Inertia
    ->name('tenant.api.')
    ->group(function () {
        // Tenant desktop authentication
        Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum')->name('auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->middleware('auth:sanctum')->name('auth.me');
        
        // Tenant dashboard data
        Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('auth:sanctum')->name('dashboard');
        
        // Tenant management
        Route::get('/profile', [DashboardController::class, 'profile'])->middleware('auth:sanctum')->name('profile');
        Route::put('/profile', [DashboardController::class, 'updateProfile'])->middleware('auth:sanctum')->name('profile.update');
        
        // Health check for tenant desktop API
        Route::get('/health', function () {
            return response()->json([
                'status' => 'healthy',
                'service' => 'tenant-desktop-api'
            ]);
        })->name('health');
    });
```

### **3.6 Create `routes/tenant-mapi.php` (CASE 1):**
```php
<?php
// routes/tenant-mapi.php
// Tenant Angular Mobile APIs
// Handles: /{tenant}/mapi/v1/*
// *** THIS IS THE FILE ANGULAR SHOULD USE ***

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Tenant\Mobile\AuthController;
use App\Http\Controllers\Tenant\Mobile\ElectionController;

Route::prefix('{tenant}/mapi/v1')
    ->where('tenant', function ($slug) {
        return in_array($slug, config('tenant.slugs')) 
            && !in_array($slug, config('reserved-slugs'));
    })
    ->middleware(['api', 'identify.tenant'])  // API middleware for mobile (stateless)
    ->name('tenant.mapi.')
    ->group(function () {
        // Tenant mobile authentication
        Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum')->name('auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->middleware('auth:sanctum')->name('auth.me');
        Route::post('/auth/refresh', [AuthController::class, 'refresh'])->name('auth.refresh');
        
        // Elections (mobile-specific endpoints)
        Route::get('/elections', [ElectionController::class, 'index'])->middleware('auth:sanctum')->name('elections.index');
        Route::get('/elections/{id}', [ElectionController::class, 'show'])->middleware('auth:sanctum')->name('elections.show');
        Route::post('/elections/{id}/vote', [ElectionController::class, 'vote'])->middleware('auth:sanctum')->name('elections.vote');
        
        // Profile (mobile-optimized)
        Route::get('/profile', [AuthController::class, 'profile'])->middleware('auth:sanctum')->name('profile');
        
        // Health check for tenant mobile API
        Route::get('/health', function ($tenant) {
            return response()->json([
                'status' => 'healthy',
                'service' => 'tenant-mobile-api',
                'tenant' => $tenant
            ]);
        })->name('health');
    });
```

### **3.7 Create `routes/angular-spa.php` (Catch-all):**
```php
<?php
// routes/angular-spa.php
// Angular Mobile App SPA (Catch-all for tenant routes)
// Handles: /{tenant}/{any?} → Serves Angular app

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AngularSpaController;

Route::get('/{tenant}/{any?}', [AngularSpaController::class, 'serve'])
    ->where('tenant', function ($slug) {
        // Allow valid tenants AND unknown slugs (for Angular routing)
        // But block reserved slugs
        return !in_array($slug, config('reserved-slugs'));
    })
    ->where('any', '.*')
    ->name('angular.spa');
```

---

## 📋 **TASK 4: CREATE ANGULAR SPA CONTROLLER**

### **4.1 Create `app/Http/Controllers/AngularSpaController.php`:**
```php
<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class AngularSpaController extends Controller
{
    /**
     * Serve Angular mobile application
     * 
     * @param string $tenant
     * @param string|null $any
     * @return \Illuminate\Http\Response
     */
    public function serve($tenant, $any = null)
    {
        // Check if tenant exists (optional - for better UX)
        try {
            if (in_array($tenant, config('tenant.slugs'))) {
                // Valid tenant - could set tenant context here if needed
                // But Angular will handle API calls with tenant in URL
            }
        } catch (\Exception $e) {
            // Continue anyway - Angular will handle 404s
        }
        
        // Serve Angular index.html
        $angularPath = public_path('mobile-app/index.html');
        
        if (file_exists($angularPath)) {
            return response()->file($angularPath);
        }
        
        // Fallback - Angular app not built yet
        return response()->view('angular-placeholder', [
            'tenant' => $tenant,
            'path' => $any,
            'message' => 'Angular mobile application is being served here.',
            'api_base' => url("/{$tenant}/mapi/v1")
        ]);
    }
}
```

### **4.2 Create placeholder view `resources/views/angular-placeholder.blade.php`:**
```blade
<!DOCTYPE html>
<html>
<head>
    <title>Angular Mobile App - {{ $tenant }}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .info { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .api-info { margin-top: 20px; padding: 15px; background: #e8f4f8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Angular Mobile Application</h1>
        <div class="info">
            <p><strong>Tenant:</strong> {{ $tenant }}</p>
            <p><strong>Path:</strong> /{{ $any ?? '(root)' }}</p>
            <p>{{ $message }}</p>
        </div>
        <div class="api-info">
            <h3>API Information:</h3>
            <p>Mobile API Base URL: <code>{{ $api_base }}</code></p>
            <p>Example login endpoint: <code>POST {{ $api_base }}/auth/login</code></p>
        </div>
    </div>
</body>
</html>
```

---

## 📋 **TASK 5: UPDATE COMPOSER.JSON AUTOLOAD**

### **5.1 Update `composer.json`:**
```json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\Factories\\": "database/factories/",
            "Database\\Seeders\\": "database/seeders/"
        },
        "files": [
            "config/reserved-slugs.php",
            "config/tenant.php"
        ]
    }
}
```

### **5.2 Run composer dump-autoload:**
```bash
composer dump-autoload
```

---

## 📋 **TASK 6: UPDATE ANGULAR CONFIGURATION**

### **6.1 Create Angular environment template:**
```typescript
// apps/mobile/src/environments/environment.ts
export const environment = {
  production: false,
  
  // === CORRECT API URLS ===
  
  // Tenant Mobile API (CASE 1)
  tenantApiUrl: 'http://localhost:8000/{tenant}/mapi/v1',
  
  // Platform Mobile API (CASE 4) - for tenant discovery
  platformApiUrl: 'http://localhost:8000/mapi/v1',
  
  // Angular SPA Base URL
  spaBaseUrl: 'http://localhost:8000',
  
  // === MIGRATION NOTE ===
  // Change from: /{tenant}/api/v1  (Vue Desktop API - WRONG)
  // Change to:   /{tenant}/mapi/v1 (Angular Mobile API - CORRECT)
};

// apps/mobile/src/environments/environment.prod.ts  
export const environment = {
  production: true,
  tenantApiUrl: 'https://publicdigit.com/{tenant}/mapi/v1',
  platformApiUrl: 'https://publicdigit.com/mapi/v1',
  spaBaseUrl: 'https://publicdigit.com'
};
```

### **6.2 Update ApiService:**
```typescript
// apps/mobile/src/app/core/services/api.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private currentTenant: string = '';
  
  setTenant(tenantSlug: string) {
    this.currentTenant = tenantSlug;
  }
  
  getTenant(): string {
    return this.currentTenant;
  }
  
  // Tenant Mobile API (CASE 1)
  getTenantApiUrl(endpoint: string): string {
    if (!this.currentTenant) {
      throw new Error('Tenant not set. Call setTenant() first.');
    }
    const base = environment.tenantApiUrl.replace('{tenant}', this.currentTenant);
    return `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }
  
  // Platform Mobile API (CASE 4)
  getPlatformApiUrl(endpoint: string): string {
    return `${environment.platformApiUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }
  
  // Example usage:
  tenantLogin(credentials: {email: string, password: string}) {
    return this.http.post(this.getTenantApiUrl('/auth/login'), credentials);
  }
  
  platformLogin(credentials: {email: string, password: string}) {
    return this.http.post(this.getPlatformApiUrl('/auth/login'), credentials);
  }
}
```

---

## 📋 **TASK 7: TEST IMPLEMENTATION**

### **7.1 Test all routes with curl:**
```bash
#!/bin/bash
# test-routes.sh

BASE_URL="http://localhost:8000"

echo "=== Testing 6-Case Routing Architecture ==="
echo

echo "1. CASE 6: Platform Vue Pages (/login, /register)"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login" && echo " - /login"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/register" && echo " - /register"
echo

echo "2. CASE 5: Platform Vue API (/api/v1/*)"
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' \
  -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/login" && echo " - /api/v1/auth/login"
echo

echo "3. CASE 4: Platform Angular API (/mapi/v1/*)"
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' \
  -s -o /dev/null -w "%{http_code}" "$BASE_URL/mapi/v1/auth/login" && echo " - /mapi/v1/auth/login"
echo

echo "4. CASE 3: Tenant Vue Pages (/{tenant}/login)"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nrna/login" && echo " - /nrna/login"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nrna/dashboard" && echo " - /nrna/dashboard"
echo

echo "5. CASE 2: Tenant Vue API (/{tenant}/api/v1/*)"
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' \
  -s -o /dev/null -w "%{http_code}" "$BASE_URL/nrna/api/v1/auth/login" && echo " - /nrna/api/v1/auth/login"
echo

echo "6. CASE 1: Tenant Angular API (/{tenant}/mapi/v1/*) *** ANGULAR SHOULD USE THIS ***"
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' \
  -s -o /dev/null -w "%{http_code}" "$BASE_URL/nrna/mapi/v1/auth/login" && echo " - /nrna/mapi/v1/auth/login"
echo

echo "7. Angular SPA Routes (/{tenant}/elections)"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nrna/elections" && echo " - /nrna/elections"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nrna/profile" && echo " - /nrna/profile"
echo

echo "=== Route Testing Complete ==="
```

### **7.2 Clear caches and test:**
```bash
cd packages/laravel-backend

# Clear all caches
php artisan route:clear
php artisan config:clear
php artisan cache:clear

# Test route listing
php artisan route:list --name=tenant.mapi
php artisan route:list --name=tenant.api
php artisan route:list --name=platform.mapi
php artisan route:list --name=platform.api

# Test specific endpoint
curl -v -X POST "http://localhost:8000/nrna/mapi/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email": "test@nrna.com", "password": "password"}'
```

---

## 🚨 **CRITICAL CHECKPOINTS FOR CLAUDE:**

### **BEFORE STARTING:**
1. ✅ Backup existing route files
2. ✅ Check current `bootstrap/app.php` route loading order
3. ✅ Note existing tenant slugs in database

### **IMPLEMENTATION ORDER:**
1. **FIRST**: Create config files (`reserved-slugs.php`, `tenant.php`)
2. **SECOND**: Update `bootstrap/app.php` loading order
3. **THIRD**: Create new route files (7 files)
4. **FOURTH**: Create AngularSpaController
5. **FIFTH**: Update composer.json and dump-autoload
6. **SIXTH**: Test with curl commands
7. **SEVENTH**: Update Angular configuration

### **VERIFICATION:**
- [ ] `/nrna/mapi/v1/auth/login` returns JSON (not HTML)
- [ ] `/nrna/api/v1/auth/login` still works (Vue desktop)
- [ ] `/login` shows platform login page
- [ ] `/nrna/login` shows tenant login page
- [ ] `/nrna/elections` shows Angular app/placeholder
- [ ] Database switches correctly for tenant routes

### **ERROR HANDLING:**
- If routes return HTML instead of JSON: Check middleware (`api` vs `web`)
- If 404 errors: Check route loading order in `bootstrap/app.php`
- If tenant not found: Check `config/tenant.php` includes the slug
- If reserved slug conflict: Check both config files for overlaps

---

## 📝 **INSTRUCTIONS FOR CLAUDE CLI:**

```
IMPLEMENT THE 6-CASE ROUTING ARCHITECTURE:

1. FIRST create configuration files:
   - config/reserved-slugs.php (list of reserved slugs)
   - config/tenant.php (list of valid tenant slugs)

2. SECOND update bootstrap/app.php with CORRECT loading order:
   - Platform routes FIRST
   - Tenant routes SECOND  
   - Angular SPA LAST

3. THIRD create/update 7 route files:
   - routes/platform-web.php (CASE 6: /login, /register)
   - routes/platform-api.php (CASE 5: /api/v1/*)
   - routes/platform-mapi.php (CASE 4: /mapi/v1/*)
   - routes/tenant-web.php (CASE 3: /{tenant}/login)
   - routes/tenant-api.php (CASE 2: /{tenant}/api/v1/*)
   - routes/tenant-mapi.php (CASE 1: /{tenant}/mapi/v1/*) *** MOST IMPORTANT ***
   - routes/angular-spa.php (Catch-all: /{tenant}/{any?})

4. FOURTH create AngularSpaController and placeholder view

5. Test thoroughly with curl commands before proceeding

REMEMBER: Angular mobile app should use /{tenant}/mapi/v1/* NOT /{tenant}/api/v1/*
```