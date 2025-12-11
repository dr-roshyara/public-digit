# 🎯 **CLAUDI CLI PROMPT INSTRUCTIONS: Multi-Tenant Election Platform**

## 📋 **PROJECT BACKGROUND & CONTEXT**

### **🏗️ ARCHITECTURE OVERVIEW**
```
PROJECT: Multi-Tenant Election Platform with Laravel 12 DDD + Angular Mobile
STATUS: Phase 1 (Core Authentication) - Angular Mobile App Integration
KEY DECISION: Tenant-first authentication for mobile (NOT platform-first)
```

### **🔧 TECHNICAL STACK**
- **Backend**: Laravel 12.35.1 with DDD, Spatie Multitenancy, Sanctum
- **Frontend Desktop**: Inertia.js + Vue3 (existing, unchanged)
- **Frontend Mobile**: Angular 17 + Capacitor (NEW implementation)
- **Database**: MySQL with Landlord/Tenant separation

### **📱 MOBILE AUTHENTICATION ARCHITECTURE**
**Tenant-First Flow (VALIDATED & IMPLEMENTED):**
1. User enters tenant slug (e.g., 'nrna') + credentials
2. App authenticates directly to tenant API: `POST /{tenant}/api/v1/auth/login`
3. All subsequent calls use tenant context: `GET /{tenant}/api/v1/elections`

**REJECTED APPROACHES:**
- ❌ Platform-first authentication (login → tenant selection → tenant auth)
- ❌ Dual API services (PlatformApiService + TenantApiService)
- ❌ Web-based tenant discovery (subdomain detection)

### **✅ CURRENTLY WORKING**
1. **Angular Mobile App**: Builds successfully, DDD boundaries respected
2. **ApiService**: Dynamic tenant URL construction with environment detection
3. **AuthService**: Simplified tenant-first authentication flow  
4. **Login Component**: Tenant slug + credentials form with localStorage persistence
5. **Environment Config**: Dev/Prod/Android/iOS URL patterns configured
6. **Route Guards**: Authentication + tenant context protection

### **🚨 CURRENT BLOCKER**
**Missing Tenant API Routes in Laravel**
- Angular correctly calls: `POST /nrna/api/v1/auth/login`
- Laravel `routes/tenant.php` has ONLY health check in API group
- Missing: auth/login, auth/me, elections, profile endpoints
- Result: Catch-all route returns HTML instead of JSON

## 🎯 **IMMEDIATE TASK FOR CLAUDE**

### **1. EXAMINE CURRENT ROUTE STRUCTURE**
```bash
# Check what exists in tenant.php API group
cat packages/laravel-backend/routes/tenant.php | grep -A50 "api/v1"

# Check existing controllers
ls -la packages/laravel-backend/app/Contexts/*/Infrastructure/Http/Controllers/
```

### **2. ADD MISSING TENANT API ROUTES**
**Edit `packages/laravel-backend/routes/tenant.php`:**

Inside existing `Route::prefix('api/v1')->name('api.v1.')->group(function () {` add:

```php
// Tenant Authentication (REQUIRED)
Route::post('/auth/login', [TenantAuthController::class, 'login'])->name('auth.login');
Route::post('/auth/logout', [TenantAuthController::class, 'logout'])->name('auth.logout');
Route::get('/auth/me', [TenantAuthController::class, 'me'])->name('auth.me');

// Tenant Elections (REQUIRED)
Route::prefix('elections')->group(function () {
    Route::get('/', [TenantElectionController::class, 'index'])->name('elections.index');
    Route::get('/{id}', [TenantElectionController::class, 'show'])->name('elections.show');
    Route::post('/{id}/vote', [TenantElectionController::class, 'vote'])->name('elections.vote');
});

// Tenant Profile (REQUIRED)
Route::prefix('profile')->group(function () {
    Route::get('/', [MemberProfileController::class, 'show'])->name('profile.show');
    Route::put('/', [MemberProfileController::class, 'update'])->name('profile.update');
});
```

### **3. CHECK/CREATE CONTROLLERS**
**If controllers don't exist:**
- Create in appropriate DDD Contexts
- Ensure they use tenant database connection
- Inherit from correct base classes

**OR reuse existing with tenant middleware:**
```php
Route::post('/auth/login', [\App\Http\Controllers\Api\AuthController::class, 'tenantLogin'])
    ->middleware(['identify.tenant']);
```

### **4. TEST ENDPOINT**
```bash
# Should return JSON, not HTML
curl -X POST "http://localhost:8000/nrna/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

## 📋 **CRITICAL RULES FOR CLAUDE**

### **DO NOT:**
1. ❌ Change Angular architecture (it's correct)
2. ❌ Implement platform-first authentication
3. ❌ Create dual API services
4. ❌ Modify Vue3 desktop admin routes
5. ❌ Remove tenant slug requirement from mobile

### **MUST:**
1. ✅ Keep tenant-first authentication flow
2. ✅ Add routes to `tenant.php` BEFORE catch-all route
3. ✅ Ensure routes are inside `Route::prefix('api/v1')` group
4. ✅ Use proper controller namespaces from DDD Contexts
5. ✅ Test that endpoints return JSON, not HTML

## 🔧 **TROUBLESHOOTING CHECKLIST**

### **If Still Getting HTML:**
1. Verify routes are added BEFORE catch-all route in `tenant.php`
2. Check regex excludes API: `->where('any', '^(?!api).*$')`
3. Ensure proper Content-Type headers in tests
4. Clear Laravel route cache: `php artisan route:clear`

### **If 404 Errors:**
1. Check tenant exists: `\App\Models\Tenant::where('slug', 'nrna')->first()`
2. Verify tenant is active
3. Check database connection switching works

### **If CORS Errors:**
1. Add CORS middleware to Laravel: `\Illuminate\Http\Middleware\HandleCors::class`
2. OR create Angular proxy (temporary fix)

## 🎯 **SUCCESS CRITERIA**

**Angular Mobile App Should:**
1. ✅ Login with tenant slug + credentials
2. ✅ Receive JSON response with Sanctum token
3. ✅ Access tenant-specific endpoints
4. ✅ Maintain tenant context across navigation
5. ✅ Build without compilation errors

## 📞 **ARCHITECTURAL REFERENCES**

### **Key Files:**
- `apps/mobile/src/app/core/services/api.service.ts` - Dynamic URL construction
- `apps/mobile/src/app/core/services/auth.service.ts` - Tenant-first auth
- `apps/mobile/src/environments/*.ts` - Environment URL patterns
- `packages/laravel-backend/routes/tenant.php` - MISSING API ROUTES
- `packages/laravel-backend/routes/mobile.php` - Platform mobile APIs (different!)

### **Domain Contexts:**
- `TenantAuth` Context - Tenant authentication & membership
- `ElectionSetup` Context - Election management
- `Platform` Context - Platform operations (landlord DB)
- `MobileDevice` Context - Mobile-specific features

## 🚀 **NEXT STEPS AFTER FIX**

1. **Test Angular login** with real credentials
2. **Implement dashboard** with tenant election listing
3. **Add language detection** testing
4. **Configure Capacitor** for native builds
5. **Phase 2**: Voting interface implementation

---

**CLAUDI INSTRUCTIONS SUMMARY:**
**"Add missing tenant API routes to `routes/tenant.php` for Angular mobile app. Angular uses tenant-first authentication at `/{tenant}/api/v1/auth/login`. Currently only health check exists - need auth, elections, profile endpoints. Keep Angular architecture unchanged - it's correct. Fix Laravel routing to return JSON instead of HTML."**
#################################### ##############################################################
# 🎯 **CLAUDI CLI PROMPT INSTRUCTIONS: Laravel Mobile App Development Guide**

## 📋 **PROJECT CONTEXT DISCOVERY**

### **🔍 CRITICAL REVELATION**
**There is already a mobile application INSIDE the Laravel backend!**
```
LOCATION: packages/laravel-backend/developer_guide/mobile_application/
PURPOSE: Mobile app development within Laravel framework
RELATIONSHIP: This might be the ORIGINAL mobile app implementation
```

### **🎯 CLAUDE'S IMMEDIATE TASK**
**STOP current Angular mobile app development and FIRST examine existing Laravel mobile app implementation!**

## 🚀 **PROMPT INSTRUCTIONS FOR CLAUDE**

### **1. EXAMINE EXISTING LARAVEL MOBILE APP**
```bash
# Explore the mobile application guide folder
ls -la packages/laravel-backend/developer_guide/mobile_application/

# Read ALL documentation files
find packages/laravel-backend/developer_guide/mobile_application -name "*.md" -o -name "*.txt" | xargs cat

# Check if there's actual mobile app code in Laravel
find packages/laravel-backend -path "*mobile*" -type f | head -20
```

### **2. UNDERSTAND THE ARCHITECTURE**
**Key Questions to Answer:**
1. Is there already a mobile app built WITHIN Laravel?
2. What technology does it use? (Inertia Mobile? Vue Mobile? Separate build?)
3. How does it handle tenant authentication?
4. What's the relationship between this and the Angular mobile app?
5. Are we DUPLICATING effort?

### **3. CHECK FOR EXISTING MOBILE ROUTES/CONTROLLERS**
```bash
# Look for mobile-specific routes in Laravel
grep -r "mobile" packages/laravel-backend/routes/ --include="*.php"

# Check for mobile controllers
find packages/laravel-backend/app -name "*Mobile*" -o -name "*mobile*"

# Examine the routes/mobile.php file in detail
cat packages/laravel-backend/routes/mobile.php

# Check if there are mobile views/Inertia pages
find packages/laravel-backend/resources -path "*mobile*" -type f
```

### **4. UNDERSTAND THE DEVELOPMENT GUIDE**
**Read the mobile_application guide COMPLETELY before proceeding:**
```bash
# Get comprehensive understanding
cat packages/laravel-backend/developer_guide/mobile_application/*.md 2>/dev/null || echo "No markdown files"
cat packages/laravel-backend/developer_guide/mobile_application/*.txt 2>/dev/null || echo "No text files"
```

### **5. DETERMINE RELATIONSHIP WITH ANGULAR APP**
**Questions to Investigate:**
- Is the Angular app a REPLACEMENT for Laravel mobile app?
- Is it an ADDITIONAL client?
- Do they share APIs?
- Which one should we focus on?

## 📋 **CRITICAL DECISION POINTS**

### **If Laravel Mobile App Exists:**
1. **STOP Angular development** until we understand the existing system
2. **Document** what already works in Laravel mobile app
3. **Compare** architectures: Laravel mobile vs Angular mobile
4. **Decide** which path to continue

### **If Laravel Mobile App is Just Documentation:**
1. **Continue** Angular development with better context
2. **Incorporate** insights from Laravel mobile guide
3. **Ensure** compatibility with existing Laravel patterns

## 🎯 **IMMEDIATE ACTIONS FOR CLAUDE**

### **Phase 1: Discovery (DO THIS FIRST)**
1. **Read ALL mobile_application documentation**
2. **Map existing mobile functionality** in Laravel
3. **Identify actual mobile code** vs documentation
4. **Understand the original mobile architecture vision**

### **Phase 2: Analysis**
1. **Compare** Laravel mobile approach vs Angular mobile approach
2. **Identify** overlaps and conflicts
3. **Document** findings clearly
4. **Recommend** next steps

### **Phase 3: Decision**
Based on findings, recommend:
- **Option A**: Continue Angular mobile (if Laravel mobile is just docs)
- **Option B**: Switch to Laravel mobile development (if functional app exists)
- **Option C**: Hybrid approach (Angular consumes Laravel mobile APIs)

## 📝 **OUTPUT REQUIREMENTS**

### **Claude Must Produce:**
1. **Summary Report** of existing Laravel mobile app implementation
2. **Architecture Comparison** between Laravel mobile and Angular mobile
3. **Recommendation** with clear rationale
4. **Action Plan** for next steps

### **Include in Analysis:**
- ✅ Tenant authentication approach in Laravel mobile
- ✅ API endpoint structure  
- ✅ Frontend technology stack
- ✅ Build/deployment process
- ✅ Integration with existing DDD contexts
- ✅ Mobile-specific features implemented

## 🔧 **TECHNICAL INVESTIGATION CHECKLIST**

### **Check for:**
```bash
# 1. Mobile-specific Service Providers
grep -r "Mobile" packages/laravel-backend/app/Providers/

# 2. Mobile middleware
grep -r "mobile" packages/laravel-backend/app/Http/Middleware/

# 3. Mobile database migrations
find packages/laravel-backend/database -name "*mobile*" -o -name "*device*"

# 4. Mobile models/entities
find packages/laravel-backend/app -name "*Mobile*" -o -name "*Device*"

# 5. Mobile API responses (check controllers)
grep -r "json" packages/laravel-backend/app/Http/Controllers/Api/ | head -20
```

## 🚨 **STOP ANGULAR DEVELOPMENT UNTIL**

**Claude MUST complete this investigation BEFORE continuing Angular mobile app work!**

## 📞 **KEY FILES TO EXAMINE**

### **Priority Files:**
1. `packages/laravel-backend/developer_guide/mobile_application/` - ALL files
2. `packages/laravel-backend/routes/mobile.php` - Mobile API routes
3. `packages/laravel-backend/app/Http/Controllers/Api/TenantApiController.php`
4. `packages/laravel-backend/app/Providers/MobileApiServiceProvider.php`
5. `packages/laravel-backend/app/Contexts/MobileDevice/` - Mobile DDD context

## 🎯 **PROMPT SUMMARY FOR CLAUDE**

**"STOP current Angular development. First investigate the existing mobile application implementation in `packages/laravel-backend/developer_guide/mobile_application/`. There might already be a mobile app built within Laravel. Read ALL documentation, examine existing code, understand the architecture, and determine if we're duplicating effort. Report findings before proceeding."**

**Critical Questions:**
1. What mobile functionality already exists in Laravel?
2. How does it differ from our Angular implementation?
3. Which approach should we continue with?
4. Are there conflicts between the two approaches?

**DO NOT proceed with Angular fixes until this investigation is complete!**
# 🎯 **FINAL INSTRUCTION: Angular Mobile App Development**

## 📋 **PROJECT DIRECTION CLARIFICATION**

### **🎯 FINAL DECISION**
**We are developing ANGULAR mobile app, NOT Vue/Laravel mobile app.**

**But we MUST:** Understand existing Laravel mobile structure to ensure Angular integrates correctly.

## 🚀 **CLAUDI PROMPT INSTRUCTIONS**

### **1. INVESTIGATE CURRENT STRUCTURE (Quickly)**
```bash
# 1. Check mobile_application guide for API documentation
cat packages/laravel-backend/developer_guide/mobile_application/* 2>/dev/null | head -100

# 2. Focus on API endpoints and authentication flow
grep -r "auth\|login\|tenant" packages/laravel-backend/developer_guide/mobile_application/ 2>/dev/null

# 3. Check existing mobile APIs (routes/mobile.php already examined)
# This is PLATFORM mobile API - understand its purpose
```

### **2. UNDERSTAND THE GAP**
**We now know:**
1. **Platform Mobile APIs** exist in `routes/mobile.php` 
2. **Tenant Mobile APIs** are MISSING in `routes/tenant.php`
3. **Angular needs** tenant-specific endpoints at `/{tenant}/api/v1/...`

### **3. FIX THE MISSING PIECE**
**Angular is correct.** Laravel needs tenant API routes added to `tenant.php`:

```php
// IN: packages/laravel-backend/routes/tenant.php
// INSIDE: Route::prefix('api/v1')->name('api.v1.')->group(function () {

// ADD THESE TENANT-SPECIFIC ENDPOINTS:
Route::post('/auth/login', [App\Http\Controllers\Api\TenantApiController::class, 'login'])
    ->name('auth.login');

Route::post('/auth/logout', [App\Http\Controllers\Api\TenantApiController::class, 'logout'])
    ->name('auth.logout');

Route::get('/auth/me', [App\Http\Controllers\Api\TenantApiController::class, 'me'])
    ->name('auth.me');

Route::get('/elections', [App\Http\Controllers\Api\TenantApiController::class, 'getElections'])
    ->name('elections.index');

Route::post('/elections/{id}/vote', [App\Http\Controllers\Api\TenantApiController::class, 'vote'])
    ->name('elections.vote');

Route::get('/profile', [App\Http\Controllers\Api\TenantApiController::class, 'getProfile'])
    ->name('profile.show');
```

### **4. TEST TENANTAPICONTROLLER**
```php
// Check TenantApiController methods exist:
// packages/laravel-backend/app/Http/Controllers/Api/TenantApiController.php
public function login(Request $request) { ... }
public function me(Request $request) { ... }
public function getElections(Request $request) { ... }
public function vote(Request $request, $id) { ... }
```

### **5. VERIFY MIDDLEWARE**
Ensure routes in `tenant.php` use correct middleware:
```php
Route::prefix('api/v1')->middleware([
    'identify.tenant',  // Sets tenant database context
    'api'               // API middleware (not web)
])->name('api.v1.')->group(function () {
    // API routes here
});
```

## 🎯 **IMMEDIATE ACTION PLAN FOR CLAUDE**

### **Step 1: Add Missing Routes (5 minutes)**
Add the tenant API routes to `routes/tenant.php` BEFORE the catch-all route.

### **Step 2: Test Endpoint (2 minutes)**
```bash
curl -X POST "http://localhost:8000/nrna/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

### **Step 3: Verify Returns JSON**
Should return: `{"token": "...", "user": {...}}` not HTML.

### **Step 4: Test Angular Login**
Open Angular app `http://localhost:4200`, enter:
- Tenant slug: `nrna`
- Email: `test@example.com`
- Password: `password`

## 📱 **ANGULAR ARCHITECTURE IS CORRECT**

**Your Angular implementation:**
- ✅ Tenant-first authentication
- ✅ Dynamic URL construction
- ✅ Environment-aware URLs
- ✅ Tenant context persistence

**The problem is LARAVEL missing routes, not Angular.**

## 🛠️ **IF STILL FAILS:**

### **Check Route Loading Order:**
```bash
cd packages/laravel-backend
php artisan route:list | grep -A2 -B2 "nrna"
```

### **Check Catch-All Route Regex:**
```php
// In routes/tenant.php line ~109
->where('any', '^(?!api).*$')  // Should exclude /api/ paths
```

### **Clear Caches:**
```bash
php artisan route:clear
php artisan config:clear
php artisan cache:clear
```

## 🎯 **FINAL INSTRUCTION TO CLAUDE**

**"Add the missing tenant API routes to `routes/tenant.php` using `TenantApiController`. Test that `POST /nrna/api/v1/auth/login` returns JSON. Angular mobile app architecture is correct - we just need Laravel to provide the tenant-specific endpoints it's trying to call."**

**Do NOT switch to Vue/Laravel mobile app. This app development is silent and we want to use all the routes to Angular app and  Continue with Angular. Just fix Laravel's missing tenant API routes.**