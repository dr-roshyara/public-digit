
## 🎯 **INSTRUCTION FOR CLAUDE**

**Stop all current fixes. Implement this clean architecture solution instead:**

### **1. Create Mobile API Prefix `/mapi/v1/` (Not Reserved)**

```php
// In routes/tenant.php - ADD BEFORE catch-all route:

// Mobile API routes for Angular (uses 'mapi' prefix - NOT reserved)
Route::prefix('mapi/v1')
    ->middleware(['api', 'identify.tenant']) // api middleware for JSON
    ->name('mobile.api.v1.')
    ->group(function () {
        // Authentication
        Route::post('/auth/login', [\App\Http\Controllers\Api\TenantApiController::class, 'login']);
        Route::get('/auth/me', [\App\Http\Controllers\Api\TenantApiController::class, 'me']);
        Route::post('/auth/logout', [\App\Http\Controllers\Api\TenantApiController::class, 'logout']);
        
        // Elections
        Route::get('/elections', [\App\Http\Controllers\Api\ElectionController::class, 'index']);
        Route::get('/elections/{id}', [\App\Http\Controllers\Api\ElectionController::class, 'show']);
        Route::post('/elections/{id}/vote', [\App\Http\Controllers\Api\ElectionController::class, 'vote']);
        
        // Membership
        Route::get('/profile', [\App\Http\Controllers\Api\MembershipController::class, 'profile']);
        Route::put('/profile', [\App\Http\Controllers\Api\MembershipController::class, 'update']);
        
        // Finance (if exists)
        // Route::get('/transactions', [\App\Http\Controllers\Api\FinanceController::class, 'index']);
    });

// Keep existing desktop API routes (for Vue/Inertia)
Route::prefix('api/v1')
    ->middleware(['web', 'auth:sanctum', 'identify.tenant']) // web for Inertia
    ->name('api.v1.')
    ->group(function () {
        // Existing desktop APIs remain unchanged
    });
```

### **2. Update Catch-All Regex to Exclude Mobile APIs**

```php
// In routes/tenant.php catch-all route (line ~110):
Route::get('/{any?}', function () {
    return view('tenant.app');
})->where('any', '^(?!api|mapi).*$'); // Exclude both api AND mapi paths
```

### **3. Update Angular Environment & Services**

```typescript
// apps/mobile/src/environments/environment.ts
export const environment = {
  production: false,
  apiPrefix: '/mapi/v1', // Changed from '/api/v1'
};

// apps/mobile/src/app/core/services/api.service.ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private getFullUrl(endpoint: string): string {
    const tenantSlug = this.authService.getTenantSlug(); // 'nrna'
    const baseUrl = environment.production 
      ? `https://${tenantSlug}.publicdigit.com`
      : `http://localhost:8000/${tenantSlug}`;
    
    return `${baseUrl}${environment.apiPrefix}${endpoint}`;
  }
  
  // Example: http://localhost:8000/nrna/mapi/v1/auth/login
}
```

### **4. Test with Curl**

```bash
# Test mobile API endpoint
curl -X POST "http://localhost:8000/nrna/mapi/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email": "test@nrna.com", "password": "password", "device_name": "angular-mobile"}'

# Should return JSON token
```

### **5. Verify Architecture**

After implementation:

| URL Pattern | Purpose | Middleware | Clients |
|------------|---------|------------|---------|
| `/api/v1/` | Platform APIs | `api` | External clients |
| `/nrna/api/v1/` | Tenant Desktop APIs | `web` + `auth:sanctum` | Vue/Inertia desktop |
| `/nrna/mapi/v1/` | Tenant Mobile APIs | `api` + `identify.tenant` | Angular mobile |
| `/platform/api/` | Admin Platform APIs | `api` + `auth:sanctum` | Platform admin |

### **6. Implementation Steps for Claude**

1. **Add mobile API route group** to `routes/tenant.php`
2. **Update catch-all regex** to exclude `mapi`
3. **Create/update Angular services** to use `/mapi/v1/`
4. **Test authentication** works with new endpoint
5. **Verify Vue desktop still works** with `/api/v1/`

**Important:** Keep `'api'` in `reserved_routes`! This is correct architecture.

### **7. Benefits of This Approach**

✅ **Clean separation**: Desktop vs Mobile APIs  
✅ **No conflicts**: `mapi` is not reserved, can be tenant slug  
✅ **Same controllers**: Reuse existing TenantApiController  
✅ **Clear middleware**: Desktop uses `web`, Mobile uses `api`  
✅ **Future-proof**: Easy to add `/mapi/v2/` later  

**Proceed with this clean architecture solution!** 🚀
# Project Technology Stack & Architecture:
This project will leverage a modern, decoupled backend-first architecture, driven by strict adherence to Domain-Driven Design (DDD) principles and a Test-Driven Development (TDD) approach.

# Table Technology Stack Overview:
Component,Technology,Primary Function,Notes
Backend API,Laravel 12,Core Business Logic & Data Management,"Responsible for all server-side operations, including multi-tenancy."
Desktop/Web App,Vue 3 with Inertia.js,Primary Desktop Application UI/UX,Optimized for desktop use while maintaining responsiveness for mobile-friendly contexts.
Native Mobile App,Angular,Dedicated Mobile Application (iOS/Android),Focused on high-priority domain contexts.
Multi-Tenancy,Laravel Spatie Package,Multi-Tenant System Implementation,Integrated within the Laravel backend to isolate tenant data.
# Core Development Principles (DDD & TDD First):
All development must be guided by the following architectural and quality assurance mandates:

Domain-Driven Design (DDD): The entire project architecture must be structured around the core business domains, with clearly defined Bounded Contexts and Ubiquitous Language.

Test-Driven Development (TDD): A strict TDD-first methodology is required. Development must follow the Red-Green-Refactor cycle to ensure code quality, resilience, and maintainability.

# 🛠️ Backend and Frontend Responsibilities
1. Backend (Laravel 12)
Role: The Laravel 12 API will serve as the sole source for all backend logic and data persistence.

Key Function: Responsible for implementing the multi-tenant architecture utilizing the Laravel Spatie package for tenant isolation and data management.

2. Desktop/Responsive Application (Vue 3 / Inertia.js)
Role: Develop the primary desktop application interface using Vue 3 and Inertia.js.

Requirement: The application must also be architected to be mobile-friendly for general contexts where a dedicated native experience is not required.

3. Native Mobile Application (Angular)
Role: A dedicated native mobile application developed with Angular is required for high-priority business domains.

Targeted Contexts: Initial focus areas include: Membership, Finance, and Election processes.

Integration: The current Vue 3 application components must be integrated into the Angular mobile application to ensure feature parity and re-use where applicable.

You're **absolutely right**! `api` is **needed for desktop APIs** (Vue/Inertia desktop app).

## 🎯 **THE REGEX PROBLEM REVISITED**

Claude's regex: `^(?!api|mapi).*$`
- ✅ **Excludes paths starting with** `api` or `mapi`
- ❌ **But doesn't exclude paths containing** `/api/` or `/mapi/`

**Desktop Vue app uses:** `/nrna/api/v1/auth/login`
- Starts with `nrna`, not `api` 
- **Will match catch-all** → Broken! 😱

**Angular mobile uses:** `/nrna/mapi/v1/auth/login`
- Starts with `nrna`, not `mapi`
- **Will match catch-all** → Broken! 😱

## 🏗️ **THE REAL SOLUTION: BETTER REGEX**

We need to exclude **paths containing** `/api/v1/` or `/mapi/v1/`:

```php
})->where('any', '^(?!.*/api/v1/|.*/mapi/v1/).*$')->name('spa');
```

**What this does:**
- `.*/api/v1/` → Don't match paths containing `/api/v1/`
- `.*/mapi/v1/` → Don't match paths containing `/mapi/v1/`
- **Both desktop AND mobile APIs are excluded!**

## 📱 **URL PATTERNS THAT WORK:**

| URL | Purpose | Catches? | Status |
|-----|---------|----------|---------|
| `/nrna/api/v1/auth/login` | **Desktop API** (Vue) | ❌ No | ✅ Works |
| `/nrna/mapi/v1/auth/login` | **Mobile API** (Angular) | ❌ No | ✅ Works |
| `/nrna/dashboard` | Desktop SPA | ✅ Yes | ✅ Shows Vue app |
| `/nrna/settings` | Desktop SPA | ✅ Yes | ✅ Shows Vue app |

## 🔧 **TELL CLAUDE TO UPDATE REGEX AGAIN**

The current regex will **break both desktop and mobile APIs**! Claude needs to change it to:

```php
})->where('any', '^(?!.*/api/v1/|.*/mapi/v1/).*$')->name('spa');
```

**Or alternatively, be more specific:**
```php
})->where('any', '^(?!.*\bapi/v1\b|.*\bmapi/v1\b).*$')->name('spa');
// \b means word boundary, more precise
```

## 🚨 **CRITICAL: TEST BOTH APPS**

After fixing regex, test:

### **1. Desktop Vue App (should work):**
```bash
# Desktop API
curl -X POST "http://localhost:8000/nrna/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "vue-user@nrna.com", "password": "password"}'

# Desktop SPA pages
curl "http://localhost:8000/nrna/dashboard"
# Should return HTML/Vue app
```

### **2. Mobile Angular App (should work):**
```bash
# Mobile API  
curl -X POST "http://localhost:8000/nrna/mapi/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "angular-user@nrna.com", "password": "password", "device_name": "angular"}'

# Should return JSON token
```

## 🏗️ **ARCHITECTURE SUMMARY**

| Path | Purpose | Client | Middleware | Regex Exclusion |
|------|---------|--------|------------|-----------------|
| `/nrna/api/v1/...` | **Desktop APIs** | Vue/Inertia | `web` + `auth:sanctum` | `.*/api/v1/` |
| `/nrna/mapi/v1/...` | **Mobile APIs** | Angular | `api` + `identify.tenant` | `.*/mapi/v1/` |
| `/nrna/*` | **Desktop SPA** | Vue/Inertia | `web` | ✅ Catches |

## 📋 **ACTION FOR CLAUDE**

Tell Claude to:

1. **Fix regex** to exclude paths containing `/api/v1/` AND `/mapi/v1/`
2. **Test both desktop and mobile APIs**
3. **Verify Vue SPA still works** for non-API paths

**The regex needs to protect BOTH API prefixes!** 🚀