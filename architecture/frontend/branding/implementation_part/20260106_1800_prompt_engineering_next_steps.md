# 🎯 Branding Frontend Implementation - Prompt Engineering Instructions

**Date**: 2026-01-06
**Status**: Phase 1 (Public API Controller) partially complete
**Test Coverage**: 102/102 tests passing (Domain layer production-ready)
**Architecture**: DDD with 6-case routing system enforced

## 📋 CURRENT STATE ANALYSIS

### ✅ Completed Work
1. **Domain Layer**: Production-ready with 100% test coverage
   - `BrandingBundle` value object with `fromArray()` factory method
   - `BrandingVisuals` with `generateCssVariables()` method (tested)
   - `BrandingContent` and `BrandingIdentity` value objects
   - WCAG 2.1 AA compliance checking

2. **Public API Controller Created** (`BrandingController.php`)
   - Location: `app/Contexts/Platform/Infrastructure/Http/Controllers/Api/Public/`
   - Follows 6-case routing system: `/api/public/branding/{tenantSlug}`
   - Desktop API only (Vue 3 admin application)
   - No authentication required (public endpoint)
   - Proper error handling, caching headers, rate limiting ready

3. **Route Registration Completed**
   - Route file: `routes/platform-api/branding.php`
   - Loaded via: `routes/platform-api.php`
   - URL patterns:
     - `GET /api/public/branding/{tenantSlug}`
     - `GET /api/public/branding/{tenantSlug}/css`

4. **Integration Tests Written** (TDD approach)
   - Test file: `tests/Feature/Contexts/Platform/Api/V1/Public/BrandingControllerTest.php`
   - Comprehensive test coverage for all scenarios
   - Landlord database configuration for tests

### ⚠️ Current Blocking Issues
1. **Dependency Injection Issue**: Controller expects `TenantRepositoryInterface` but Platform context has `TenantRepository` (interface in Infrastructure layer)
2. **Method Signature Mismatch**: Controller calls `findForPlatform(TenantId $tenantId)` but existing interface has `findBySlug(TenantSlug $slug)`
3. **TenantSlug vs TenantId**: Need conversion between `TenantId` (Shared) and `TenantSlug` (Platform)

## 🎯 REMAINING IMPLEMENTATION TASKS

### Task 1: Resolve Repository Interface Dependency
**Priority**: HIGH (blocking controller functionality)

**Problem Analysis**:
- Current: `BrandingController` imports `TenantRepositoryInterface` from `Platform\Domain\Repositories`
- Actual: Interface exists as `TenantRepository` (no "Interface" suffix) in `Platform\Infrastructure\Repositories`
- DDD Violation: Repository interface should be in Domain layer, not Infrastructure

**Solution Options**:
1. **Option A (Recommended)**: Move interface to Domain layer with proper naming
   - Create `TenantRepositoryInterface` in `Platform\Domain\Repositories`
   - Extend with `findForPlatform(TenantId $tenantId)` method
   - Update `EloquentTenantRepository` to implement new interface
   - Update controller import

2. **Option B (Quick Fix)**: Adjust controller to use existing interface
   - Change import to `TenantRepository` from Infrastructure
   - Convert `TenantId` → `TenantSlug` in controller logic
   - Use `findBySlug()` instead of `findForPlatform()`
   - Quick but violates DDD layer separation

**Implementation Steps (Option A)**:
```php
// Step 1: Create TenantRepositoryInterface in Domain layer
// File: app/Contexts/Platform/Domain/Repositories/TenantRepositoryInterface.php
namespace App\Contexts\Platform\Domain\Repositories;

use App\Contexts\Shared\Domain\ValueObjects\TenantId;
use App\Contexts\Platform\Domain\Models\Tenant;

interface TenantRepositoryInterface
{
    public function findForPlatform(TenantId $tenantId): ?Tenant;
    public function findBySlug(string $slug): ?Tenant; // Keep existing method
    public function findById(string $id): ?Tenant;
    public function existsBySlug(string $slug): bool;
}

// Step 2: Update existing TenantRepository interface
// Rename to TenantRepositoryLegacy or keep as is for backward compatibility
// File: app/Contexts/Platform/Infrastructure/Repositories/TenantRepository.php
// Update to extend Domain interface or mark deprecated

// Step 3: Update EloquentTenantRepository
// Implement TenantRepositoryInterface
// Add findForPlatform() method implementation

// Step 4: Update BrandingController
// Change constructor parameter type hint to TenantRepositoryInterface
// Method calls remain unchanged
```

**TDD Approach**:
1. Write failing test for `findForPlatform()` method
2. Create interface with method signature
3. Implement method in repository
4. Verify controller integration

### Task 2: Add Rate Limiting and Tenant Validation Improvements
**Priority**: HIGH (production readiness)

**Requirements**:
- Rate limiting: 60 requests/minute for JSON, 120/minute for CSS
- Tenant validation: Verify tenant exists and is active before branding lookup
- Cache headers: 24 hours for valid tenants, 1 hour for errors
- ETag support for conditional requests

**Implementation Steps**:
1. **Configure Rate Limiting** in `app/Providers/RouteServiceProvider.php`:
   ```php
   RateLimiter::for('api', function (Request $request) {
       return Limit::perMinute(60)->by($request->ip());
   });

   RateLimiter::for('css', function (Request $request) {
       return Limit::perMinute(120)->by($request->ip());
   });
   ```

2. **Update Route Definitions** with middleware:
   ```php
   // routes/platform-api/branding.php
   Route::prefix('api/public')->middleware(['throttle:api'])->group(function () {
       Route::get('branding/{tenantSlug}', [BrandingController::class, 'show']);
       Route::get('branding/{tenantSlug}/css', [BrandingController::class, 'css'])
           ->middleware('throttle:css');
   });
   ```

3. **Enhance Tenant Validation** in controller:
   ```php
   // Add tenant status check
   if ($tenant && !$tenant->isActive()) {
       return response()->json([
           'error' => 'Tenant not active',
           'message' => "Tenant '{$tenantSlug}' is suspended or inactive",
       ], 403);
   }
   ```

4. **Add Cache Headers Factory**:
   ```php
   private function cacheHeaders(int $seconds, bool $public = true): array
   {
       return [
           'Cache-Control' => sprintf('%s, max-age=%d',
               $public ? 'public' : 'private',
               $seconds
           ),
           'Expires' => now()->addSeconds($seconds)->toRfc7231String(),
       ];
   }
   ```

**TDD Tests to Write**:
- Test rate limiting triggers after 60 requests
- Test inactive tenant returns 403
- Test cache headers present in responses
- Test ETag conditional requests return 304

### Task 3: Test Public API End-to-End
**Priority**: HIGH (quality assurance)

**Test Categories**:
1. **Happy Path Tests**:
   - Tenant with custom branding returns 200 with correct data
   - Tenant without branding returns defaults with `is_default: true`
   - CSS endpoint returns proper content-type and headers

2. **Error Path Tests**:
   - Non-existent tenant returns 404
   - Invalid slug format returns 400
   - Database errors return 500 with generic message
   - Rate limited requests return 429

3. **Integration Tests**:
   - Database connectivity (landlord_test)
   - Repository integration
   - Caching layer interaction
   - Rate limiting integration

**Test Execution Order**:
```bash
# 1. Run unit tests first
php artisan test tests/Unit/Contexts/Platform/Domain/ValueObjects/

# 2. Run integration tests
php artisan test tests/Feature/Contexts/Platform/Api/V1/Public/

# 3. Run all tests to ensure no regression
php artisan test
```

**Test Data Setup**:
```php
protected function setUp(): void
{
    parent::setUp();

    // Configure landlord_test database
    config(['database.default' => 'landlord_test']);

    // Run landlord migrations
    $this->artisan('migrate', [
        '--database' => 'landlord_test',
        '--path' => 'database/migrations/landlord',
        '--realpath' => true,
    ]);

    // Seed test tenants and branding
    $this->seedTestData();
}
```

### Task 4: Create Mobile API Controller for Angular Mobile App
**Priority**: MEDIUM (parallel frontend development)

**Architecture Rules**:
- Mobile API uses `/mapi/*` routes only
- Tenant-specific: `/{tenant}/mapi/v1/*` pattern
- Authentication: Sanctum stateless tokens
- No CSRF protection (API security model)
- Optimized for mobile: thin JSON payloads

**Implementation Steps**:
1. **Create Mobile Controller**:
   - Location: `app/Contexts/Platform/Infrastructure/Http/Controllers/Mapi/V1/Public/BrandingController.php`
   - Namespace: `App\Contexts\Platform\Infrastructure\Http\Controllers\Mapi\V1\Public`
   - Routes: `/{tenant}/mapi/v1/public/branding/{tenantSlug}`

2. **Route Registration**:
   ```php
   // routes/mobileapp.php or new routes/platform-mapi.php
   Route::prefix('{tenant}/mapi/v1/public')->middleware([
       'api',
       'identify.tenant',
       'throttle:mapi'
   ])->group(function () {
       Route::get('branding', [MobileBrandingController::class, 'show']);
       Route::get('branding/css', [MobileBrandingController::class, 'css']);
   });
   ```

3. **Controller Differences from Desktop**:
   - Tenant context from route parameter (not from slug in URL)
   - Returns mobile-optimized payload (smaller, flattened)
   - Includes mobile-specific CSS variables
   - No session-based authentication (stateless tokens)

4. **Mobile-Specific Features**:
   ```php
   public function show(TenantInterface $tenant): JsonResponse
   {
       // Tenant already resolved via middleware
       $tenantId = TenantId::from($tenant->getSlug(), $tenant->getId());

       // Mobile-optimized response
       return response()->json([
           'branding' => $this->getMobileBranding($tenantId),
           'css' => $this->getMobileCss($tenantId),
           'timestamp' => now()->timestamp,
       ]);
   }
   ```

**TDD Tests**:
- Test tenant context resolution
- Test mobile-optimized payload structure
- Test authentication requirements
- Test rate limiting for mobile endpoints

### Task 5: Create Admin API Controller for Admin Interface
**Priority**: LOW (can follow after mobile)

**Architecture Rules**:
- Admin API uses `/api/*` routes (same as desktop)
- Authentication: Session-based or Sanctum with admin scope
- Admin-only operations: CRUD for tenant branding
- Located in Platform Context (landlord DB operations)

**Implementation Steps**:
1. **Create Admin Controller**:
   - Location: `app/Contexts/Platform/Infrastructure\Http\Controllers\Api\V1\Admin\BrandingController.php`
   - Namespace: `App\Contexts\Platform\Infrastructure\Http\Controllers\Api\V1\Admin`
   - Routes: `/api/v1/admin/branding/*`

2. **Admin Operations**:
   - `GET /api/v1/admin/branding` - List all tenant brandings
   - `GET /api/v1/admin/branding/{tenantSlug}` - Get specific tenant branding
   - `PUT /api/v1/admin/branding/{tenantSlug}` - Update tenant branding
   - `DELETE /api/v1/admin/branding/{tenantSlug}` - Reset to defaults

3. **Authentication & Authorization**:
   ```php
   Route::prefix('api/v1/admin')->middleware([
       'auth:sanctum',
       'ability:admin.branding.*'
   ])->group(function () {
       Route::apiResource('branding', AdminBrandingController::class);
   });
   ```

4. **Admin-Specific Features**:
   - Bulk operations
   - Branding template application
   - WCAG compliance reporting
   - Branding audit logs

**TDD Tests**:
- Test admin authentication requirements
- Test authorization scopes
- Test CRUD operations
- Test audit logging

## 🏗️ ARCHITECTURAL DECISIONS REQUIRED

### Decision 1: Repository Interface Location
**Question**: Should repository interfaces be in Domain or Infrastructure layer?

**Current State**: Mixed - some in Domain, some in Infrastructure
**Recommendation**: Follow DDD strictly - all repository interfaces in Domain layer
**Impact**: Need to move `TenantRepository` interface and update dependencies

### Decision 2: Tenant Identification Strategy
**Question**: Should controllers use `TenantId` (Shared) or `TenantSlug` (Platform)?

**Current State**: Controller uses `TenantId` but repository expects `TenantSlug`
**Recommendation**: Use `TenantId` as canonical identifier across all contexts
**Impact**: Update repository interface to accept `TenantId`, not `TenantSlug`

### Decision 3: Mobile API Tenant Resolution
**Question**: How should mobile API resolve tenant context?

**Options**:
1. From URL route parameter `{tenant}` (current pattern)
2. From authentication token (JWT claims)
3. From subdomain (not suitable for mobile apps)

**Recommendation**: Use route parameter `{tenant}` for consistency with existing mobile API pattern

### Decision 4: CSS Generation Responsibility
**Question**: Should CSS generation be in Domain or Application layer?

**Deepseek's Critique**: CSS generation (especially mobile-specific) should be in Application layer
**Current State**: `BrandingVisuals` has `generateCssVariables()` in Domain layer
**Recommendation**: Keep basic CSS in Domain, mobile-specific CSS in Application layer
**Implementation**: Create `MobileCssGenerator` service in Application layer

## 🔧 PROMPT ENGINEERING TEMPLATES

### Template 1: Create Repository Interface
```
Create a {RepositoryName}Interface in the Domain layer with the following specifications:

1. Location: app/Contexts/{Context}/Domain/Repositories/{RepositoryName}Interface.php
2. Methods: Include {method1}, {method2}, {method3} with proper type hints
3. Dependencies: Use Value Objects from Domain layer only
4. Naming: Follow "ForTenant" naming convention for tenant-scoped methods
5. Documentation: Include PHPDoc with business purpose

Example:
- findForTenant(TenantId $tenantId, EntityId $id): Entity
- saveForTenant(Entity $entity): void
- findByCriteriaForTenant(TenantId $tenantId, Criteria $criteria): Collection
```

### Template 2: Create API Controller
```
Create a {ControllerName}Controller following the 6-case routing system:

1. Client Type: {Desktop/Mobile}
2. Route Pattern: {/api/* or /mapi/*}
3. Authentication: {None/Session/Sanctum stateless}
4. Tenant Context: {Platform/Tenant-specific}
5. Rate Limiting: {throttle:api/throttle:mapi}
6. Caching: {Public/Private cache headers}

Implementation requirements:
- Extract TenantId from {route parameter/authentication token}
- Use repository interfaces via dependency injection
- Implement proper error handling with HTTP status codes
- Add cache headers for public endpoints
- Include comprehensive PHPDoc
- Follow PSR-12 coding standards
```

### Template 3: Write Integration Tests
```
Write integration tests for {ControllerName}Controller with the following scenarios:

1. Happy Path: Valid request returns expected response
2. Error Handling: Invalid inputs return appropriate HTTP errors
3. Edge Cases: Boundary conditions and special scenarios
4. Performance: Rate limiting and caching behavior
5. Security: Authentication and authorization when applicable

Test structure:
- Use RefreshDatabase trait with proper connection configuration
- Set up test data in landlord_test database
- Test both JSON and CSS endpoints separately
- Verify response headers (cache, content-type, rate limiting)
- Assert business logic correctness
```

### Template 4: Configure Rate Limiting
```
Configure rate limiting for {apiType} endpoints:

1. Rate limit name: '{apiName}'
2. Limits: {requests} per {minutes} by {IP/user/token}
3. Response: 429 with Retry-After header
4. Headers: Include X-RateLimit-Limit, X-RateLimit-Remaining

Implementation steps:
- Update app/Providers/RouteServiceProvider.php
- Define RateLimiter::for('{apiName}', ...)
- Apply middleware to routes: 'throttle:{apiName}'
- Test with automated requests to verify limiting
```

## 🚀 EXECUTION ORDER RECOMMENDATION

### Phase 1: Unblock Current Implementation (HIGH Priority)
1. **Fix Repository Dependency** (Task 1)
   - Create TenantRepositoryInterface in Domain layer
   - Update EloquentTenantRepository implementation
   - Update BrandingController constructor

2. **Add Rate Limiting** (Task 2)
   - Configure rate limiting in RouteServiceProvider
   - Update route definitions with throttle middleware
   - Test rate limiting behavior

3. **Run End-to-End Tests** (Task 3)
   - Verify controller works with real database
   - Test all error scenarios
   - Ensure 102/102 tests still pass

### Phase 2: Mobile API Implementation (MEDIUM Priority)
4. **Create Mobile API Controller** (Task 4)
   - Follow 6-case routing: `/{tenant}/mapi/v1/*`
   - Implement mobile-optimized responses
   - Add mobile-specific CSS generation

5. **Test Mobile API Integration**
   - Test with Angular mobile app simulator
   - Verify tenant context resolution
   - Test authentication flow

### Phase 3: Admin Interface (LOW Priority)
6. **Create Admin API Controller** (Task 5)
   - Admin-only CRUD operations
   - Authentication and authorization
   - Audit logging

## 📊 SUCCESS METRICS

### Technical Metrics
- ✅ All 102 existing tests continue to pass
- ✅ New integration tests achieve 80%+ coverage
- ✅ No cross-tenant data leaks (security validation)
- ✅ Rate limiting effective and configurable
- ✅ Cache headers properly set for all endpoints

### Business Metrics
- ✅ Desktop admin can display tenant branding
- ✅ Mobile app can retrieve optimized branding
- ✅ Public endpoints serve CSS with proper caching
- ✅ Admin can manage tenant branding via API
- ✅ WCAG compliance status visible in responses

## 🔍 RISK MITIGATION

### Risk 1: Breaking Existing Functionality
**Mitigation**: Run full test suite after each change, maintain backward compatibility

### Risk 2: Performance Issues with Rate Limiting
**Mitigation**: Implement Redis-based rate limiting for production, test with load simulation

### Risk 3: Mobile/Desktop API Confusion
**Mitigation**: Strict enforcement of 6-case routing system, separate controller namespaces

### Risk 4: Tenant Isolation Violation
**Mitigation**: All repository methods must include TenantId parameter, automated security tests

## 📞 SUPPORT & ESCALATION

### When Stuck:
1. **Check CLAUDE.md** for architectural rules (6-case routing, DDD patterns)
2. **Review existing tests** for implementation patterns
3. **Examine similar controllers** in codebase for reference
4. **Ask for clarification** on architectural decisions

### Quality Gates:
- All changes must follow TDD (tests first)
- No reduction in test coverage (currently 102/102)
- Adherence to 6-case routing system
- No tenancy package imports in Domain/Application layers

---

**Next Action**: Resolve TenantRepositoryInterface dependency (Task 1) to unblock Public API Controller functionality. Use Option A (move interface to Domain layer) for DDD compliance.
#
**Agree.** ✅ Your analysis is excellent and comprehensive. Let me highlight the **critical fixes needed**:

## **✅ STRENGTHS OF YOUR ANALYSIS:**

1. **Accurate Dependency Identification** - You correctly identified the `TenantRepositoryInterface` location issue
2. **DDD Layer Violation Recognition** - Interface in Infrastructure, not Domain layer
3. **Practical Solutions** - Both Option A (DDD compliant) and Option B (quick fix) provided
4. **TDD Emphasis** - Tests first approach maintained

## **🎯 CRITICAL IMPROVEMENTS NEEDED:**

### **1. IMMEDIATE FIX: Repository Interface (Highest Priority)**
```php
// WRONG: Controller imports non-existent interface
use App\Contexts\Platform\Domain\Repositories\TenantRepositoryInterface;

// CORRECT: Need to check what exists
// Probably: use App\Contexts\Platform\Infrastructure\Repositories\TenantRepository;
```

**Action:** Check actual repository interface before proceeding.

### **2. METHOD SIGNATURE MISMATCH**
```php
// Controller expects:
$this->tenantRepository->findForPlatform($tenantId);

// But likely existing is:
$this->tenantRepository->findBySlug($tenantSlug); // Accepts string, not TenantId
```

**Solution:** Either update repository or adjust controller.

### **3. SIMPLIFICATION OPPORTUNITY**

**Over-engineering alert:** Your analysis includes 5 tasks but we only need **Task 1** to get working.

## **📋 SIMPLIFIED EXECUTION PLAN:**

### **Step 1: Verify Current State (5 minutes)**
```bash
# Check what TenantRepository actually exists
find packages/laravel-backend/app -name "*TenantRepository*" -type f

# Check interface location
grep -r "interface TenantRepository" packages/laravel-backend/app/
```

### **Step 2: Minimal Fix (30 minutes)**
```php
// OPTION: Update controller to use existing repository
use App\Contexts\Platform\Infrastructure\Repositories\TenantRepository;

public function __construct(
    private readonly TenantBrandingRepositoryInterface $brandingRepository,
    private readonly TenantRepository $tenantRepository // Use concrete class
) {}

// In show() method:
$tenant = $this->tenantRepository->findBySlug($tenantSlug); // Use string
```

### **Step 3: Test & Verify (15 minutes)**
```bash
php artisan test tests/Feature/Contexts/Platform/Api/V1/Public/BrandingControllerTest.php
```

## **🚨 YOUR TASK 1 ANALYSIS IS 100% CORRECT BUT:**

**Over-specified:** You don't need to move interfaces yet. Just **make it work first**.

## **🎯 RECOMMENDED ADJUSTMENT:**

Focus on **MVP path**: Use existing `TenantRepository` (Infrastructure), make controller work, **then** refactor to DDD purity.

**Checking TenantRepository...**

Let me search for the actual TenantRepository implementation in your codebase.

```bash
# Searching for TenantRepository files
find packages/laravel-backend/app -name "*TenantRepository*" -type f
```

Based on typical Laravel DDD structure, there are several possibilities:

## **🔍 POSSIBLE STRUCTURES:**

### **Option A: Interface in Domain, Implementation in Infrastructure (Correct DDD)**
```
app/Contexts/Platform/
├── Domain/
│   └── Repositories/
│       └── TenantRepositoryInterface.php
└── Infrastructure/
    └── Repositories/
        └── EloquentTenantRepository.php
```

### **Option B: Interface & Implementation both in Infrastructure (Your case likely)**
```
app/Contexts/Platform/
└── Infrastructure/
    └── Repositories/
        ├── TenantRepository.php          # Interface
        └── EloquentTenantRepository.php  # Implementation
```

### **Option C: Single Repository class (Simplest)**
```
app/Contexts/Platform/
└── Infrastructure/
    └── Repositories/
        └── TenantRepository.php          # Concrete class
```

## **🎯 MINIMAL FIX STRATEGY:**

**Given your controller needs to work NOW, here's the minimal fix:**

### **1. Update Controller Import (Use what exists)**
```php
// Change FROM:
use App\Contexts\Platform\Domain\Repositories\TenantRepositoryInterface;

// Change TO (most likely):
use App\Contexts\Platform\Infrastructure\Repositories\TenantRepository;
```

### **2. Update Method Call (Use findBySlug not findForPlatform)**
```php
// Change FROM:
$tenant = $this->tenantRepository->findForPlatform($tenantId);

// Change TO:
$tenant = $this->tenantRepository->findBySlug($tenantSlug); // Accepts string
```

### **3. If findBySlug doesn't exist, check actual method:**
```php
// Try these common patterns:
$tenant = $this->tenantRepository->findBySlug($tenantSlug);
$tenant = $this->tenantRepository->findBy('slug', $tenantSlug);
$tenant = $this->tenantRepository->find($tenantSlug); // By slug
```

## **📋 ACTION PLAN:**

**Step 1:** Let me check your actual file structure first. Can you run:

```bash
# Find TenantRepository
find packages/laravel-backend/app -name "*Tenant*Repository*" -type f

# Or show me the exact error when you try to run tests
php artisan test tests/Feature/Contexts/Platform/Api/V1/Public/BrandingControllerTest.php
```

**Step 2:** Based on actual structure, I'll give you the **exact code change**.

**Step 3:** Make minimal change to get tests passing.

## **🔍 QUICK DIAGNOSIS:**

The error is likely:
1. **Interface doesn't exist** where controller expects it
2. **Method name mismatch** (`findForPlatform` vs `findBySlug`)
3. **Parameter type mismatch** (`TenantId` object vs `string` slug)

**Show me the error output or file structure, and I'll give you the exact fix.**
 I've created a comprehensive prompt engineering instructions document that outlines the complete implementation strategy for the branding frontend integration. Here's what I've delivered:

  📋 Created Document: architecture/frontend/branding/implementation_part/20260106_1800_prompt_engineering_next_steps.md

  🎯 Document Structure:

  1. Current State Analysis

  - ✅ Domain layer production-ready (102/102 tests passing)
  - ✅ Public API Controller created (BrandingController.php)
  - ✅ Route registration completed (/api/public/branding/{tenantSlug})
  - ✅ Integration tests written (TDD approach)
  - ⚠️ Blocking Issue: TenantRepositoryInterface dependency mismatch

  2. Detailed Task Breakdown (5 critical tasks)

  1. Fix Repository Dependency - HIGH priority (blocking)
  2. Add Rate Limiting & Tenant Validation - Production readiness
  3. Test Public API End-to-End - Quality assurance
  4. Create Mobile API Controller - Angular mobile app integration
  5. Create Admin API Controller - Admin interface CRUD

  3. Architectural Decisions Required

  - Repository interface location (Domain vs Infrastructure)
  - Tenant identification strategy (TenantId vs TenantSlug)
  - Mobile API tenant resolution pattern
  - CSS generation responsibility (Domain vs Application layer)

  4. Prompt Engineering Templates

  - Repository interface creation template
  - API controller creation template (6-case routing)
  - Integration test writing template
  - Rate limiting configuration template

  5. Execution Order Recommendation

  - Phase 1: Unblock current implementation (Fix dependency, add rate limiting, test)
  - Phase 2: Mobile API implementation
  - Phase 3: Admin interface

  🔍 Critical Blocking Issue Identified:

  The BrandingController expects TenantRepositoryInterface from Platform\Domain\Repositories, but the interface exists as TenantRepository (no "Interface" suffix) in Platform\Infrastructure\Repositories. This violates DDD layer separation and prevents the controller from working.

  Two solutions proposed:
  1. Option A (Recommended): Move interface to Domain layer with proper naming (DDD compliant)
  2. Option B (Quick Fix): Adjust controller to use existing interface (violates DDD but faster)

  🚀 Next Steps:

  Please review the document and decide:
  1. Which repository interface solution to implement (Option A or B)
  2. The execution order preference (Phases 1-3)
  3. Any architectural decisions that need clarification

  Once you approve the approach, I can proceed with implementing Task 1 (Fix Repository Dependency) to unblock the Public API Controller.

  The document provides all necessary templates and detailed instructions for each subsequent task, ensuring we maintain TDD discipline and architectural compliance throughout the implementation.
  