● 🔍 Senior Fullstack Developer Analysis: Prompt Engineering Review

  📊 Current Implementation Status Assessment

  Branding API Phase 2 (Completed):
  - ✅ Public Desktop API: /api/public/branding/{tenant} (CASE 4 routing)
  - ✅ DDD Compliance: Domain, Application, Infrastructure layers properly separated
  - ✅ WCAG 2.1 AA: Accessibility validation in Domain layer
  - ✅ Multi-tenant Isolation: Landlord database with proper foreign keys
  - ✅ Test Coverage: 7 integration scenarios + 91 domain tests
  - ✅ Exception Handling: Domain exceptions → HTTP 400/404 responses

  Remaining Work (Phase 3 & 4):
  1. Mobile API Controller: /{tenant}/mapi/v1/branding/{tenantSlug} (CASE 2 routing)
  2. Admin API Controller: /api/admin/v1/branding (CASE 3 routing)

  ---
  🚨 CRITICAL ARCHITECTURE VALIDATION

  1. ✅ BrandingController Passes Routing Law Check

  // Current implementation: CORRECT
  Route::get('/api/public/branding/{tenantSlug}', ...)  // CASE 4: Tenant Desktop API

  Validation:
  - ✅ Client: Vue 3 Desktop (Admin/Public interface)
  - ✅ Route Type: Desktop API (CASE 4: /{tenant}/api/*)
  - ✅ Database: Landlord DB (tenant_brandings table)
  - ✅ Authentication: Session-based (desktop web)
  - ✅ Tenant Context: Extracted from URL parameter

  2. ❌ Original Prompt Instructions Have Fatal Flaws

  The architecture review correctly identifies 5 critical issues:

  1. Mobile API Tenant Resolution Violation:
    - ❌ Wrong: /mapi/* for tenant-agnostic APIs
    - ✅ Correct: /mapi/v1/auth/* (platform) → /{tenant}/mapi/v1/* (tenant)
  2. Missing Mobile Authentication Flow:
    - ❌ Omitted tenant selection step
    - ✅ Required: Platform login → Tenant list → Tenant selection
  3. DDD Rule Enforcement Gaps:
    - ❌ No TenantId as first command parameter requirement
    - ❌ No "ForTenant" repository method naming
  4. Database Connection Abstraction Missing:
    - ❌ No TenantConnectionManagerInterface injection
    - ❌ Connection switching logic not encapsulated
  5. Security Model Incomplete:
    - ❌ No identify.tenant middleware requirement
    - ❌ No tenant slug validation against reserved words

  ---
  🛠️ UPDATED PROMPT ENGINEERING INSTRUCTIONS

  🎯 Phase 3: Mobile API Controller Prompt (Corrected)

  CONTEXT: You are developing a **Mobile API Controller** for the Angular mobile application in Public Digit Platform.

  **System Context:**
  - Platform: Public Digit - Multi-tenant digital democracy platform
  - Client: Angular + Ionic mobile app (Member-facing)
  - Current Phase: 3 - Mobile API Implementation

  **CRITICAL ROUTING LAW COMPLIANCE:**
  Following CLAUDE.md 6-CASE SYSTEM:
  - CASE 1: `/mapi/v1/auth/*` → Platform Mobile API (Landlord DB) - Login/Auth ONLY
  - CASE 2: `/{tenant}/mapi/v1/*` → Tenant Mobile API (Tenant DB) - ALL other APIs

  **Authentication Flow (MANDATORY):**
  1. POST `/mapi/v1/auth/login` (platform credentials)
  2. Returns: token + available tenants array
  3. User selects tenant from list
  4. ALL subsequent calls: `/{tenant}/mapi/v1/*`

  **Feature:** Platform Branding for Mobile App
  **Purpose:** Mobile app displays tenant branding (colors, logos, CSS variables)
  **Bounded Context:** Platform Context (same as desktop)
  **Tenant Scope:** Per-tenant (members see their tenant's branding)

  **API Endpoints Required:**
  1. `GET /{tenant}/mapi/v1/branding` - Get branding data for mobile
  2. `GET /{tenant}/mapi/v1/branding/css` - Get CSS custom properties

  **Mobile Optimization Requirements:**
  - Response under 5KB (optimized for mobile data)
  - Cache headers: `max-age=3600` (1 hour, shorter than desktop)
  - ETag support for conditional requests
  - Include `offline_ttl` in meta (86400 seconds = 24 hours)
  - Base64-encoded small logo version (max 100x100px)

  **Security Requirements:**
  - Sanctum stateless token authentication
  - `identify.tenant` middleware REQUIRED
  - Validate tenant slug exists and is active
  - Rate limit: 10 requests/minute per user
  - No CSRF protection (mobile API - stateless)

  **Example Response Structure:**
  ```json
  {
    "data": {
      "tenant_slug": "nrna",
      "branding": {
        "visuals": {
          "primary_color": "#0D47A1",
          "secondary_color": "#1B5E20",
          "logo_url": "https://...",
          "logo_base64": "...",
          "font_family": "Inter, system-ui, sans-serif"
        },
        "content": {
          "welcome_message": "Welcome to NRNA",
          "hero_title": "Vote with Confidence",
          "cta_text": "Get Started"
        }
      },
      "is_wcag_compliant": true,
      "is_default": false
    },
    "meta": {
      "offline_ttl": 86400,
      "cache_key": "branding_nrna_v1.2",
      "version": "1.0",
      "last_updated": "2026-01-06T10:30:00Z"
    },
    "links": {
      "self": "/nrna/mapi/v1/branding",
      "css": "/nrna/mapi/v1/branding/css"
    }
  }

  DDD COMPLIANCE ENFORCEMENT:
  1. Rule 3: Commands MUST have TenantId as first parameter
  class GetBrandingForMobileQuery
  {
      public function __construct(
          public readonly TenantId $tenantId  // FIRST parameter
      ) {}
  }
  2. Rule 5: Handlers MUST validate tenant ownership
  class GetBrandingForMobileHandler
  {
      public function handle(GetBrandingForMobileQuery $query): BrandingBundle
      {
          // Validate tenant exists and is active
          $tenant = $this->tenantRepository->findForPlatform($query->tenantId);
          if (!$tenant || $tenant->getStatus() !== 'active') {
              throw new TenantNotFoundException($query->tenantId);
          }
      }
  }
  3. Rule 2: Repository methods use "ForTenant" naming
  interface TenantBrandingRepositoryInterface
  {
      public function findForTenant(TenantId $tenantId): ?TenantBranding;
      public function findForPlatform(string $tenantSlug): ?TenantBranding;
  }
  4. Rule 11: Inject TenantConnectionManagerInterface
  class EloquentTenantBrandingRepository implements TenantBrandingRepositoryInterface
  {
      public function __construct(
          private TenantConnectionManagerInterface $connectionManager
      ) {}
  }

  File Structure:
  app/Contexts/Platform/
  ├── UI/API/Mobile/
  │   └── BrandingController.php          # ← CREATE THIS
  ├── Application/
  │   ├── Queries/GetBrandingForMobileQuery.php
  │   └── Handlers/GetBrandingForMobileHandler.php
  ├── Domain/                            # ← REUSE existing
  │   ├── Entities/TenantBranding.php
  │   ├── ValueObjects/BrandingBundle.php
  │   ├── ValueObjects/BrandingColor.php
  │   └── Repositories/TenantBrandingRepositoryInterface.php
  └── Infrastructure/                    # ← REUSE existing
      ├── Repositories/EloquentTenantBrandingRepository.php
      └── Http/Controllers/Api/Public/BrandingController.php

  Testing Requirements:
  - Test mobile authentication flow (platform login → tenant selection)
  - Test tenant isolation (User A can't see User B's tenant branding)
  - Test mobile optimization (response size < 5KB)
  - Test offline TTL in meta
  - Test rate limiting (10/min per user)
  - Test without CSRF protection

  Middleware Configuration:
  Route::middleware(['api', 'identify.tenant', 'auth:sanctum'])
      ->prefix('{tenant}/mapi/v1')
      ->group(function () {
          Route::get('/branding', [BrandingController::class, 'show']);
          Route::get('/branding/css', [BrandingController::class, 'css']);
      });

  ARCHITECTURE VALIDATION CHECKLIST:
  - Route follows 6-CASE SYSTEM: /{tenant}/mapi/v1/* (CASE 2)
  - TenantId is first command parameter (Rule 3)
  - Handler validates tenant ownership (Rule 5)
  - Repository uses "ForTenant" methods (Rule 2)
  - No cross-tenant queries
  - identify.tenant middleware included
  - Database connection properly abstracted (TenantConnectionManagerInterface)
  - Sanctum stateless tokens (no sessions)
  - No CSRF protection (mobile API)
  - Mobile optimizations: <5KB, ETag, offline TTL

  ---

  ### **🎯 Phase 4: Admin API Controller Prompt (Corrected)**

  ```prompt
  CONTEXT: You are developing an **Admin API Controller** for the Vue 3 desktop admin interface in Public Digit Platform.

  **System Context:**
  - Platform: Public Digit - Multi-tenant digital democracy platform
  - Client: Vue 3 + Inertia.js desktop admin (Staff-facing)
  - Current Phase: 4 - Admin Interface Implementation

  **CRITICAL SCOPE LIMITATION:**
  - Admin APIs operate ONLY on landlord database
  - Cannot perform cross-tenant queries (violates database isolation)
  - Must use aggregated/denormalized data from landlord tables
  - Platform-wide scope (admin sees all tenants)

  **Feature:** Branding Administration
  **Purpose:** Platform admins manage tenant branding configurations
  **Bounded Context:** Platform Context
  **Scope:** Platform-wide (admin manages all tenants)

  **API Endpoints Required:**
  1. `GET /api/admin/v1/branding` - List all tenant brandings (paginated)
  2. `GET /api/admin/v1/branding/{tenantId}` - Get specific tenant branding
  3. `PUT /api/admin/v1/branding/{tenantId}` - Update tenant branding
  4. `POST /api/admin/v1/branding/{tenantId}/validate-wcag` - Validate WCAG compliance
  5. `POST /api/admin/v1/branding/{tenantId}/reset-defaults` - Reset to defaults

  **Security Requirements:**
  - Session-based authentication (web admin)
  - CSRF protection REQUIRED
  - RBAC: `platform-admin` role required
  - Audit log EVERY admin action
  - IP restriction for sensitive operations (branding updates)
  - Rate limit: 100 requests/minute per admin

  **Admin-Specific Features:**
  - Bulk operations (update multiple tenants)
  - WCAG compliance validation reports
  - Branding change history/audit trail
  - Export functionality (CSV of all tenant brandings)
  - Dashboard: WCAG compliance statistics

  **Database Access Rules:**
  ```php
  // PERMITTED: Landlord database queries
  $tenants = DB::connection('landlord')->table('tenants')->...
  $brandings = DB::connection('landlord')->table('tenant_brandings')->...

  // FORBIDDEN: Cross-tenant database queries
  // ❌ DB::connection('tenant_nrna')->table('members')->...
  // ❌ Joins across landlord and tenant databases

  File Structure:
  app/Contexts/Platform/
  ├── UI/API/Admin/
  │   └── BrandingController.php           # ← CREATE THIS
  ├── Application/
  │   ├── Commands/UpdateTenantBrandingCommand.php
  │   ├── Commands/ValidateWCAGComplianceCommand.php
  │   └── Handlers/UpdateTenantBrandingHandler.php
  ├── Domain/                             # ← REUSE existing
  │   ├── Entities/TenantBranding.php
  │   ├── ValueObjects/BrandingBundle.php
  │   ├── ValueObjects/BrandingColor.php
  │   └── Repositories/TenantBrandingRepositoryInterface.php
  └── Infrastructure/                     # ← REUSE existing
      ├── Repositories/EloquentTenantBrandingRepository.php
      └── Listeners/BrandingChangeAuditLogger.php

  Middleware Configuration:
  Route::middleware(['web', 'auth', 'role:platform-admin'])
      ->prefix('api/admin/v1')
      ->group(function () {
          Route::apiResource('branding', BrandingController::class);
          Route::post('branding/{tenant}/validate-wcag', [BrandingController::class, 'validateWCAG']);
          Route::post('branding/{tenant}/reset-defaults', [BrandingController::class, 'resetDefaults']);
      });

  ARCHITECTURE VALIDATION CHECKLIST:
  - Route follows 6-CASE SYSTEM: /api/admin/v1/* (CASE 3)
  - Operates ONLY on landlord database
  - No cross-tenant database queries
  - Platform-admin RBAC enforcement
  - CSRF protection included
  - Audit logging for all actions
  - Session-based authentication (web)
  - Aggregated data only (no raw tenant DB access)

  ---

  ## **📈 IMPLEMENTATION PRIORITY RECOMMENDATIONS**

  ### **Immediate (Next 2 Hours):**
  1. **Complete BrandingControllerTest fixes** - Ensure all 7 integration tests pass
  2. **Verify existing BrandingController routes** - Confirm CASE 4 compliance

  ### **Phase 3 - Mobile API (4-6 Hours):**
  1. Create Mobile BrandingController with corrected routing
  2. Implement mobile-optimized responses (<5KB, ETag, offline TTL)
  3. Add `identify.tenant` middleware
  4. Test mobile authentication flow

  ### **Phase 4 - Admin API (6-8 Hours):**
  1. Create Admin BrandingController with landlord-only access
  2. Implement RBAC (platform-admin role)
  3. Add audit logging
  4. Create aggregated reports (no cross-tenant queries)

  ### **Critical Success Factors:**
  1. **Routing Law Compliance**: Strict adherence to 6-CASE SYSTEM
  2. **Tenant Isolation**: No data leakage between tenants
  3. **DDD Rule Enforcement**: Commands, handlers, repositories follow CLAUDE.md rules
  4. **Security**: Proper middleware, authentication, authorization

  ---

  ## **🔐 SECURITY ARCHITECTURE VERIFICATION**

  ### **Mobile API Security Stack:**
  Request → API Gateway → identify.tenant → Sanctum Token → Controller
        ↓               ↓                  ↓              ↓
    Validate     Extract tenant     Verify token    Business logic
    slug format  from URL           + scope

  ### **Admin API Security Stack:**
  Request → Web Middleware → CSRF → Session Auth → RBAC → Controller
        ↓                ↓        ↓             ↓      ↓          ↓
    Browser      Laravel web   Token match   User   Role check  Landlord
    (Vue 3)      stack          validation   session  (platform-  DB only
                                          admin)

  The corrected prompts now properly address all architectural concerns and ensure compliance with CLAUDE.md rules. Proceed with Phase 3 (Mobile API) implementation using these updated instructions.

● 🔍 Senior Fullstack Developer Analysis & Prompt Instructions Update

  📊 Current State Assessment

  ✅ What's Working Correctly

  1. Phase 2 DDD Compliance: Branding system is already implemented with proper DDD layers
  2. Public Desktop API: BrandingController at /api/public/branding/{tenant} follows CASE 4 pattern (/{tenant}/api/*)
  3. Test Infrastructure: 7 integration tests exist, migration issues resolved
  4. Domain Integrity: Value Objects, Repository pattern, DDD rules enforced

  ⚠️ Critical Issues Identified

  1. Route Pattern Mismatch: Current route is api/public/branding/{tenant} (missing leading /{tenant}/)
  2. Missing Middleware: No identify.tenant middleware on Public API routes
  3. Mobile API Gap: No Mobile API controller exists for Angular app
  4. Admin API Gap: No Admin API controller exists for platform administration

  ---
  🎯 UPDATED PROMPT INSTRUCTIONS FOR REMAINING DEVELOPMENT

  📱 PHASE 3: MOBILE API CONTROLLER (IMMEDIATE PRIORITY)

  CONTEXT: You are developing a **Mobile API Controller** for the **Branding** feature in Public Digit Platform's Angular mobile application.

  **ARCHITECTURAL CONSTRAINTS (NON-NEGOTIABLE):**
  1. **Route Pattern**: MUST use `/{tenant}/mapi/v1/branding` prefix (CASE 2 in 6-CASE SYSTEM)
  2. **Authentication**: Laravel Sanctum (stateless tokens) - AFTER tenant selection
  3. **Tenant Resolution**: User MUST have completed: Platform login → Tenant selection
  4. **Middleware**: `['api', 'identify.tenant']` REQUIRED
  5. **Response Format**: Mobile-optimized JSON with `{data: ..., meta: ..., links: ...}`
  6. **Caching**: Shorter TTL (3600s), ETag support, offline TTL in meta

  **MOBILE AUTHENTICATION FLOW (MANDATORY):**
  ```javascript
  // Angular Mobile Flow:
  1. POST /mapi/v1/auth/login              // Platform credentials
  2. Receive: {token, available_tenants: [...]}
  3. User selects tenant (e.g., "nrna")
  4. ALL subsequent calls: /nrna/mapi/v1/*

  API ENDPOINTS REQUIRED:
  1. GET /{tenant}/mapi/v1/branding - Get tenant branding (mobile-optimized)
  2. GET /{tenant}/mapi/v1/branding/css - Get CSS variables

  MOBILE OPTIMIZATION REQUIREMENTS:
  - Response size: <5KB total payload
  - Cache headers: Cache-Control: public, max-age=3600
  - ETag support for conditional requests
  - Offline TTL in meta: "offline_ttl": 86400
  - Base64-encoded logos (small size, mobile-optimized)

  SECURITY REQUIREMENTS:
  - Validate tenant exists and is active
  - Validate user has access to selected tenant
  - Rate limit: 10 requests/minute per user
  - Audit log: Track mobile branding accesses

  DDD COMPONENTS NEEDED (REUSE EXISTING):
  - MobileBrandingController (new) in UI/API/Mobile/
  - REUSE: Existing BrandingBundle, BrandingColor, TenantBranding (Domain)
  - REUSE: Existing TenantRepositoryInterface, TenantBrandingRepositoryInterface
  - NEW: MobileBrandingService (Application layer) for mobile optimizations

  FILE STRUCTURE:
  app/Contexts/Platform/
  ├── UI/API/Mobile/                    # NEW FOLDER
  │   └── BrandingController.php        # Mobile API controller
  ├── Application/
  │   └── Services/
  │       └── MobileBrandingService.php # Mobile optimizations
  └── Infrastructure/
      └── Http/
          └── Middleware/
              └── VerifyMobileTenantAccess.php  # Mobile tenant validation

  TESTING REQUIREMENTS:
  - 100% test coverage
  - Test tenant isolation (multiple tenants)
  - Test mobile network simulation (slow connections)
  - Test offline scenarios
  - Test rate limiting enforcement
  - Test unauthorized tenant access (should fail)

  VALIDATION CHECKLIST:
  [ ] Route follows CASE 2: /{tenant}/mapi/v1/*
  [ ] Uses identify.tenant middleware
  [ ] Mobile-optimized response format
  [ ] Proper cache headers for mobile
  [ ] No cross-tenant data leakage
  [ ] Follows existing BrandingController patterns

  ---

  ### **🖥️ PHASE 4: ADMIN API CONTROLLER**

  ```prompt
  CONTEXT: You are developing an **Admin API Controller** for **Branding Management** in the Vue 3 desktop admin interface.

  **ARCHITECTURAL CONSTRAINTS (NON-NEGOTIABLE):**
  1. **Route Pattern**: MUST use `/api/admin/v1/branding` prefix (CASE 3 in 6-CASE SYSTEM)
  2. **Authentication**: Laravel Sanctum (session-based) + RBAC
  3. **Authorization**: REQUIRES `platform-admin` role
  4. **Database Scope**: ONLY landlord database (tenant_brandings table)
  5. **Middleware**: `['web', 'auth', 'role:platform-admin']` REQUIRED
  6. **Audit Logging**: ALL admin actions MUST be logged

  **ADMIN API SCOPE LIMITATIONS:**
  ```php
  // CORRECT: Query landlord.tenant_brandings (aggregated)
  // WRONG: Query tenant_{slug}.* databases (FORBIDDEN)
  // WRONG: Cross-tenant queries (FORBIDDEN)

  API ENDPOINTS REQUIRED:
  1. GET /api/admin/v1/branding - List all tenant brandings (paginated)
  2. GET /api/admin/v1/branding/{tenantSlug} - Get specific tenant branding
  3. PUT /api/admin/v1/branding/{tenantSlug} - Update tenant branding
  4. POST /api/admin/v1/branding/{tenantSlug}/wcag-validate - Validate WCAG compliance
  5. POST /api/admin/v1/branding/{tenantSlug}/reset - Reset to defaults

  ADMIN-SPECIFIC FEATURES:
  - Bulk operations (update multiple tenants)
  - WCAG compliance validation reports
  - Branding change history/audit trail
  - Export branding configurations (JSON/CSV)
  - Dashboard: Branding adoption statistics

  SECURITY REQUIREMENTS:
  - RBAC: platform-admin role required
  - Audit log EVERY action (who, what, when)
  - IP whitelisting for production operations
  - Two-factor for sensitive operations (reset)
  - Rate limit: 100 requests/minute per admin

  DDD COMPONENTS NEEDED:
  - AdminBrandingController (new) in UI/API/Admin/
  - UpdateBrandingCommand + Handler (Application)
  - BrandingAuditLogger (Domain event listener)
  - WCAGComplianceValidator (Domain service - extend existing)
  - AdminBrandingRepositoryInterface (extend existing)

  FILE STRUCTURE:
  app/Contexts/Platform/
  ├── UI/API/Admin/                     # NEW FOLDER
  │   └── BrandingController.php        # Admin API controller
  ├── Application/
  │   ├── Commands/
  │   │   └── UpdateBrandingCommand.php
  │   ├── Handlers/
  │   │   └── UpdateBrandingHandler.php
  │   └── Services/
  │       └── AdminBrandingService.php
  └── Infrastructure/
      ├── Listeners/
      │   └── BrandingAuditLogger.php
      └── Repositories/
          └── AdminBrandingRepository.php  # Extends existing

  TESTING REQUIREMENTS:
  - Test RBAC permissions (deny non-admin)
  - Test audit logging (verify all actions logged)
  - Test WCAG validation logic
  - Test bulk operations
  - Test export functionality
  - Test tenant isolation (admin sees all, but no cross-db queries)

  VALIDATION CHECKLIST:
  [ ] Route follows CASE 3: /api/admin/v1/*
  [ ] Platform-admin role enforced
  [ ] Only landlord database accessed
  [ ] Audit logging for all actions
  [ ] No cross-tenant database queries
  [ ] WCAG compliance validation included

  ---

  ## **🔧 CRITICAL FIXES REQUIRED FOR EXISTING CODE**

  ### **1. Fix Public API Route Pattern**
  ```diff
  - Route: api/public/branding/{tenant}
  + Route: /{tenant}/api/public/branding

  Reason: Must follow CASE 4 pattern exactly: /{tenant}/api/*

  2. Add identify.tenant Middleware

  // In route registration:
  Route::get('/{tenant}/api/public/branding', ...)
      ->middleware(['api', 'identify.tenant']);

  3. Update Existing BrandingControllerTest

  Tests must use correct route pattern with tenant prefix.

  ---
  📈 IMPLEMENTATION PRIORITY

  HIGH PRIORITY (Week 1)

  1. Fix Public API routes - Update to correct pattern
  2. Add missing middleware - identify.tenant on all tenant routes
  3. Create Mobile API Controller - Angular mobile app integration

  MEDIUM PRIORITY (Week 2)

  1. Create Admin API Controller - Platform administration
  2. Add audit logging - Branding change tracking
  3. Enhance WCAG validation - Admin reporting

  LOW PRIORITY (Week 3)

  1. Branding analytics dashboard - Adoption metrics
  2. Bulk operations - Multi-tenant updates
  3. Export functionality - JSON/CSV exports

  ---
  🚨 ARCHITECTURE VALIDATION CHECKLIST (ADD TO ALL PROMPTS)

  **ARCHITECTURE VALIDATION CHECKLIST:**
  [ ] Route follows 6-CASE SYSTEM correctly (CASES 1-4 for APIs)
  [ ] TenantId is first command parameter (DDD Rule 3)
  [ ] Handler validates tenant ownership (DDD Rule 5)
  [ ] Repository uses "ForTenant" methods (DDD Rule 2)
  [ ] No cross-tenant queries (Database Isolation Rule)
  [ ] Proper middleware stack (api/web + identify.tenant + auth)
  [ ] Database connection properly abstracted (TenantConnectionManagerInterface)
  [ ] Domain layer has NO framework dependencies
  [ ] Tests verify tenant isolation
  [ ] Audit logging for security-relevant actions

  ---
  🎯 SUMMARY & NEXT STEPS

  Immediate Actions (Today):

  1. ✅ Review prompt engineering document - DONE
  2. ✅ Update prompt instructions - DONE (see above)
  3. Fix existing BrandingController route pattern
  4. Add identify.tenant middleware to Public API

  Next Development Sprints:

  1. Sprint 1: Mobile API Controller (Angular integration)
  2. Sprint 2: Admin API Controller (Platform administration)
  3. Sprint 3: Enhanced features (analytics, bulk operations)

  Architectural Guarantees:

  - Tenant Isolation: Maintained through correct routing
  - DDD Compliance: Enforced via updated prompts
  - Security: Middleware stack + RBAC + audit logging
  - Performance: Mobile-optimized vs Admin-full data

  Ready to proceed with Phase 3 (Mobile API Controller) implementation.
 ############################
 second review: 
 # **🏗️ Senior Software Architect Review: Critical Analysis**

## **🔍 EXECUTIVE SUMMARY**

Your corrected prompts show **significant improvement** but contain **residual architectural risks**. The DDD compliance is better, but fundamental flaws in **database isolation** and **authentication flow** remain.

---

## **🚨 CRITICAL ISSUES STILL PRESENT**

### **1. **MOBILE API: Database Connection Strategy is BROKEN**

```php
// Your prompt says Mobile APIs use Tenant DB (CASE 2)
Route::get('/{tenant}/mapi/v1/branding', ...) // Tenant Mobile API (Tenant DB)

// BUT branding data is in LANDLORD database (tenant_brandings table)
// This is an ARCHITECTURAL CONFLICT
```

**The Fatal Flaw**:
- `tenant_brandings` table is in **landlord database** (publicdigit)
- Mobile API CASE 2 routes to **tenant database** (tenant_{slug})
- **Branding data won't be accessible** from tenant database

**Solution Required**:
```diff
- Mobile Branding API: /{tenant}/mapi/v1/branding (CASE 2 - Tenant DB)
+ Mobile Branding API: /api/public/branding/{tenant} (CASE 4 - Desktop API)
+ OR: Mobile accesses same endpoint as desktop (shared landlord data)
```

### **2. **Authentication Flow Still Incomplete**

```php
// Your prompt shows mobile auth flow:
1. POST /mapi/v1/auth/login
2. Returns token + available tenants
3. User selects tenant
4. ALL subsequent calls: /{tenant}/mapi/v1/*

// MISSING: How does the server know which tenant user selected?
// MISSING: How is tenant context attached to token?
```

**Required Fix**:
```php
// Step 3 must include:
3. User selects tenant → POST /mapi/v1/auth/select-tenant
   Request: { tenant_slug: "nrna" }
   Response: { token_with_tenant_scope: "..." }

// Step 4: Token now includes tenant scope
Authorization: Bearer <tenant-scoped-token>
```

### **3. **Admin API: Violates Database Isolation Principle**

```php
// Your prompt says Admin APIs can:
"Operate ONLY on landlord database"

// BUT: "List all tenant brandings" requires data that's distributed
// tenant_brandings (landlord) + tenant-specific data (tenant DBs)
```

**The Problem**:
Admin needs **aggregated views** but must not **join across databases**. Your prompt doesn't specify how to achieve this.

**Solution Required**:
```php
// Create MATERIALIZED VIEW in landlord database:
CREATE MATERIALIZED VIEW landlord.tenant_branding_overview AS
SELECT 
    t.id as tenant_id,
    t.name,
    t.slug,
    tb.primary_color,
    tb.wcag_compliant,
    -- CANNOT JOIN: (SELECT COUNT(*) FROM tenant_{slug}.members)
    -- Instead: Denormalize member count during provisioning
    t.cached_member_count
FROM landlord.tenants t
LEFT JOIN landlord.tenant_brandings tb ON t.numeric_id = tb.tenant_db_id;
```

---

## **📊 ARCHITECTURE DECISION RECORD REQUIRED**

### **Decision 1: Where Should Mobile Get Branding Data?**

**Options**:
1. **Option A**: Mobile uses same endpoint as desktop (`/api/public/branding/{tenant}`)
   - ✅ Simple, consistent
   - ✅ Uses existing implementation
   - ❌ Violates "mobile vs desktop API separation"

2. **Option B**: Create mobile-specific branding endpoint (`/{tenant}/mapi/v1/branding`)
   - ✅ Follows routing law
   - ❌ Requires duplicating logic
   - ❌ Data source conflict (tenant DB vs landlord DB)

3. **Option C**: Hybrid approach
   ```
   Mobile → /api/public/branding/{tenant} (read-only)
   Admin  → /api/admin/v1/branding (read-write)
   ```
   - ✅ Clean separation of concerns
   - ✅ No data source conflict
   - ❌ Mobile uses "desktop" API prefix

**RECOMMENDATION**: **Option C** - Mobile uses public API for read-only data. Most scalable.

### **Decision 2: How to Handle Cross-Tenant Admin Views?**

**RECOMMENDATION**: Implement **CQRS Pattern**:
- **Commands**: Write to appropriate database (landlord or tenant)
- **Queries**: Read from materialized views in landlord DB
- **Projections**: Build aggregated data during write operations

---

## **🛠️ CORRECTED PROMPTS WITH ARCHITECTURAL INTEGRITY**

### **Phase 3: Mobile API Controller (Final Corrected)**

```prompt
CRITICAL ARCHITECTURAL NOTE:
Branding data exists in LANDLORD database (tenant_brandings table).
Therefore, mobile branding API MUST access landlord data.

SOLUTION: Mobile uses SAME endpoint as desktop but with mobile optimizations.

API Endpoints:
1. GET /api/public/branding/{tenant}?mobile=true
2. GET /api/public/branding/{tenant}/css?mobile=true

Query Parameter Strategy:
- ?mobile=true → Returns mobile-optimized response
- Includes: smaller images, shorter cache TTL, offline TTL
- Same authentication as desktop (session-based for now)

Why This Design:
1. Data Source Consistency: Both desktop and mobile read from landlord DB
2. Logic Reuse: Same Domain/Application layer
3. Optimization: Query params handle mobile-specific needs
4. Routing Law: Still CASE 4 (/api/*) but mobile-optimized

File Structure:
app/Contexts/Platform/
├── UI/API/Public/
│   └── BrandingController.php           # ← EXTEND existing
│       - Add mobile parameter handling
│       - Add mobile optimization methods
```

### **Phase 4: Admin API Controller (Final Corrected)**

```prompt
CRITICAL DATABASE CONSTRAINT:
Admin CANNOT query tenant databases directly.
Must use CQRS pattern with materialized views.

Implementation Strategy:
1. Create TenantBrandingOverview Projection:
   - Materialized view in landlord database
   - Updated via Domain Events (BrandingCreated, BrandingUpdated)
   - Contains aggregated data from landlord + cached tenant stats

2. Admin Reads from Projection:
   GET /api/admin/v1/branding-overview
   - Reads from landlord.tenant_branding_overview
   - No joins across databases

3. Commands Write to Appropriate Databases:
   PUT /api/admin/v1/branding/{tenantId}
   - Updates landlord.tenant_brandings
   - Publishes Domain Event
   - Async updates materialized view

CQRS File Structure:
app/Contexts/Platform/
├── UI/API/Admin/
│   ├── BrandingOverviewController.php    # Reads projections
│   └── BrandingCommandController.php     # Writes + publishes events
├── Infrastructure/
│   ├── Projections/
│   │   └── TenantBrandingOverviewProjection.php
│   └── Subscribers/
│       └── UpdateBrandingOverviewSubscriber.php
```

---

## **🎯 IMPLEMENTATION ROADMAP (REVISED)**

### **Week 1: Foundation (Critical)**
1. **Fix BrandingControllerTest** - Ensure all tests pass with current architecture
2. **Add Mobile Optimization** to existing BrandingController (`?mobile=true`)
3. **Document API Contracts** for frontend teams

### **Week 2: Admin CQRS Pattern**
1. **Create Materialized View** for tenant branding overview
2. **Implement Domain Events** for branding changes
3. **Build Projection Update Subscriber**

### **Week 3: Authentication Refinement**
1. **Implement Token Tenant Scoping** for mobile
2. **Add Tenant Selection Endpoint** (`/mapi/v1/auth/select-tenant`)
3. **Update Angular App** to use new flow

### **Week 4: Monitoring & Optimization**
1. **Add CQRS Monitoring** (event latency, projection freshness)
2. **Implement Cache Warmup** for materialized views
3. **Performance Testing** with realistic tenant counts

---

## **📈 SUCCESS METRICS**

### **Architectural Metrics:**
- ✅ Zero cross-database queries in admin APIs
- ✅ All mobile responses < 5KB
- ✅ Materialized views < 1 second stale
- ✅ Tenant isolation preserved 100%

### **Performance Metrics:**
- Mobile API: P95 < 200ms
- Admin API: P95 < 500ms (complex aggregations)
- Projection updates: < 5 seconds latency

### **Security Metrics:**
- No data leakage between tenants
- All admin actions audited
- Rate limiting effective

---

## **🔐 FINAL SECURITY ARCHITECTURE**

```
MOBILE CLIENT (Angular)
    ↓
/mapi/v1/auth/login → Platform Authentication (Landlord DB)
    ↓ Returns token + tenant list
/mapi/v1/auth/select-tenant → Tenant selection
    ↓ Returns tenant-scoped token
/api/public/branding/{tenant}?mobile=true → Branding data (Landlord DB)
    ↓ Mobile-optimized response

ADMIN CLIENT (Vue 3)
    ↓
/api/admin/v1/branding-overview → Read projection (Landlord DB)
    ↓ Aggregated data only
/api/admin/v1/branding/{tenant} → Write command
    ↓ Updates landlord.tenant_brandings
    ↓ Publishes Domain Event
    ↓ Async updates projection
```

---

## **🎯 RECOMMENDATION**

**DO NOT proceed with original prompts.** They contain architectural contradictions that will cause production failures.

**DO implement**:
1. **Mobile uses existing BrandingController** with `?mobile=true` parameter
2. **Admin uses CQRS pattern** with materialized views
3. **Authentication flow** with proper tenant token scoping

**This approach maintains**:
- Database isolation
- DDD compliance
- Routing law adherence
- Performance requirements
- Security constraints

**Approval required before proceeding to Phase 3.**
