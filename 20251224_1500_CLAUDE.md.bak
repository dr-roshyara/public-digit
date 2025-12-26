# Public Digit Platform - AI Assistant Instructions

**Laravel 12.35.1 | DDD Multi-Tenant Election System | Angular Mobile App**

---

## CRITICAL CONSTRAINTS (NON-NEGOTIABLE)

### Development Methodology
- **MUST** follow strict Test-Driven Development (TDD) - Write failing tests FIRST
- **MUST** maintain 80%+ test coverage for all changes
- **MUST** follow Domain-Driven Design (DDD) principles
- **MUST** ask for clarification when uncertain - NEVER assume
- **MUST NOT** make changes without explicit user approval

### Self-Improving Documentation (Meta-Instruction)
- **MUST** proactively identify patterns, rules, or constraints discovered during work
- **MUST** document important learnings as hooks in this CLAUDE.md file
- **MUST** use professional prompt engineering when adding new instructions:
  - Use MUST/MUST NOT/SHOULD directive patterns
  - Front-load critical information
  - Provide decision trees or checklists for complex scenarios
  - Include examples (WRONG vs RIGHT comparisons)
  - Keep additions concise and scannable
- **MUST** ask user approval before adding new sections to CLAUDE.md
- **WHEN TO ADD**: Patterns repeated 2+ times, critical debugging insights, architecture clarifications, common mistakes to avoid

### Architecture Immutability
- **MUST NOT** move or refactor `packages/laravel-backend/` structure
- **MUST NOT** modify existing route files without user confirmation
- **MUST** preserve desktop admin UI functionality (Inertia.js + Vue 3)
- **MUST** treat mobile app as ADDITIVE client, not replacement

### Security Requirements
- **MUST** enforce 100% tenant data isolation (zero cross-tenant access)
- **MUST** validate tenant context for all tenant operations
- **MUST** prevent OWASP Top 10 vulnerabilities (XSS, SQLi, CSRF, etc.)
- **MUST** implement unique voter slug per election (one vote per person)
- **MUST** use Sanctum token-based authentication for mobile APIs

### Route Management
- **CRITICAL**: When deleting routes from any file, MUST relocate to correct destination
- **MUST** verify route is not already defined before adding
- **MUST** preserve reserved routes configuration (`config/tenant.php`)

---

## SYSTEM ARCHITECTURE

### 6-Case Routing Architecture (CRITICAL)

**The platform serves TWO applications**: Vue Desktop (web) + Angular Mobile (Capacitor)

```
┌─────────────────────────────────────────────────────────────────┐
│ CASE 1: /mapi/*           → Platform Angular Mobile API         │
│         Middleware: ['api']                                      │
│         Database: Landlord                                       │
│         Example: POST /mapi/v1/auth/login                       │
├─────────────────────────────────────────────────────────────────┤
│ CASE 2: /{tenant}/mapi/*  → Tenant Angular Mobile API          │
│         Middleware: ['api', 'identify.tenant']                  │
│         Database: Tenant-specific                               │
│         Example: POST /nrna/mapi/v1/elections/1/vote           │
├─────────────────────────────────────────────────────────────────┤
│ CASE 3: /api/*            → Platform Vue Desktop API            │
│         Middleware: ['web'] or ['api']                          │
│         Database: Landlord                                       │
│         Example: GET /api/v1/users                              │
├─────────────────────────────────────────────────────────────────┤
│ CASE 4: /{tenant}/api/*   → Tenant Vue Desktop API             │
│         Middleware: ['web', 'identify.tenant']                  │
│         Database: Tenant-specific                               │
│         Example: POST /nrna/api/v1/elections                    │
├─────────────────────────────────────────────────────────────────┤
│ CASE 5: /*                → Platform Vue Desktop Pages          │
│         Middleware: ['web']                                      │
│         Database: Landlord                                       │
│         Example: GET /login, GET /register, GET /dashboard      │
├─────────────────────────────────────────────────────────────────┤
│ CASE 6: /{tenant}/*       → Tenant Vue Desktop Pages + Catch-all│
│         Middleware: ['web', 'identify.tenant']                  │
│         Database: Tenant-specific                               │
│         Example: GET /nrna/login, GET /nrna/dashboard          │
│         CATCH-ALL: /{tenant}/{any?} (SPA fallback, MUST BE LAST)│
└─────────────────────────────────────────────────────────────────┘
```

**Key Rules**:
- Angular Mobile uses `/mapi/*` ONLY (never `/api/*`)
- Vue Desktop uses `/api/*` ONLY (never `/mapi/*`)
- Tenant slugs ALWAYS stay in URL path (never removed)
- Platform routes = Landlord DB | Tenant routes = Tenant-specific DB

### Tech Stack Summary

**Backend**
- Laravel 12.35.1 (PHP 8.1+) with DDD architecture
- Spatie Laravel Multitenancy + Custom HybridTenantFinder
- Laravel Sanctum (stateless tokens)
- MySQL (landlord + tenant databases)
- Tailwind CSS v4.1.1 with @tailwindcss/vite
- Inertia.js + Vue 3 (desktop UI)

**Mobile**
- Angular (latest) in Nx monorepo
- Capacitor for native features
- RxJS reactive state management
- HttpClient with auth/tenant interceptors

**Testing**
- PHPUnit (backend, 80%+ coverage)
- Jest (Angular unit tests)
- Cypress (E2E tests)

---

## DDD BOUNDED CONTEXTS

```
packages/laravel-backend/app/Contexts/
├── Platform/          # Core platform operations (landlord)
├── TenantAuth/        # Multi-tenant authentication
├── ElectionSetup/     # Election management domain
├── MobileDevice/      # Mobile-specific logic
└── Shared/            # Cross-context utilities
└── Membership/            # Members digitilization and member forum
├── Geography/         # Geography 
```

**DDD Patterns MUST Follow**:
1. Domain/Application/Infrastructure layering
2. Value Objects instead of primitives (TenantSlug, EmailAddress, etc.)
3. Domain events for cross-context communication
4. Repository pattern for data access
5. Service layer for business logic

---

## MULTI-TENANCY SYSTEM

### Tenant Identification (Two Mechanisms)

**1. HybridTenantFinder** (`app/Multitenancy/HybridTenantFinder.php`)
- Strategy 1: DOMAIN_EXACT - `nrna.com` (production)
- Strategy 2: DOMAIN_SMART - `nrna.localhost` (local dev)
- Strategy 3: PATH_BASED - `/nrna/...` (local dev)

**2. IdentifyTenantFromRequest Middleware** (`app/Contexts/Platform/Infrastructure/Http/Middleware/IdentifyTenantFromRequest.php`)
- Extracts slug from subdomain/path (path priority over subdomain)
- Checks reserved routes (`config/tenant.php` -> 'reserved_routes')
- Finds active tenant in landlord DB
- Initializes tenant context (sets in app container, view, request)
- Skips assets (CSS, JS, images)

### Reserved Routes & Slugs (Platform-Level)

**CRITICAL Configuration Files:**

**1. config/reserved-slugs.php** - Slugs that CANNOT be used as tenant identifiers
```php
<?php
return [
    'api',      // CASE 3 & 4: Vue Desktop API routes
    'mapi',     // CASE 1 & 2: Angular Mobile API routes
    'platform', 'health', 'docs', 'admin',
    'login', 'logout', 'register', 'dashboard',
    'settings', 'profile', 'setup',
    'tenant-applications', 'election-request',
    // Add more as needed
];
```

**2. config/tenant.php** - Valid tenant slugs (from database)
```php
<?php
// This should query the database, but example:
return ['nrna', 'uml', 'other-valid-tenants'];
```

**Reserved Route Validation Rules:**
- MUST validate tenant slug against `config/reserved-slugs.php` before tenant identification
- Unknown slugs in `/{tenant}/*` routes should NOT be used as tenant context
- 'api' and 'mapi' are RESERVED prefixes (never tenant slugs)

### Database Isolation

```
landlord              → tenants, users, tenant_applications, permissions
tenant_{slug}         → tenant_users, elections, candidates, votes
```

**Isolation Enforcement**:
- Automatic database connection switching per request
- 100% data segregation (no cross-tenant queries)
- Tenant context validation for all tenant operations

---

## ROUTE LOADING SYSTEM

### Route File Organization (6-Case Strategy)

**MUST organize routes into 6 separate files:**

```
routes/
├── platform-mapi.php     # CASE 1: /mapi/* (Angular mobile - platform)
├── tenant-mapi.php       # CASE 2: /{tenant}/mapi/* (Angular mobile - tenant)
├── platform-api.php      # CASE 3: /api/* (Vue desktop API - platform)
├── tenant-api.php        # CASE 4: /{tenant}/api/* (Vue desktop API - tenant)
├── platform-web.php      # CASE 5: /* (Vue desktop pages - platform)
└── tenant-web.php        # CASE 6: /{tenant}/* (Vue desktop pages - tenant)
```

### CRITICAL: Route Loading Order in bootstrap/app.php

**Order MATTERS** (load in this sequence):

```php
// 1. Platform routes FIRST (no tenant context)
require __DIR__.'/../routes/platform-web.php';     // CASE 5
require __DIR__.'/../routes/platform-api.php';     // CASE 3
require __DIR__.'/../routes/platform-mapi.php';    // CASE 1

// 2. Tenant routes SECOND (with tenant context)
require __DIR__.'/../routes/tenant-mapi.php';      // CASE 2 (Angular API FIRST)
require __DIR__.'/../routes/tenant-api.php';       // CASE 4 (Vue API)
require __DIR__.'/../routes/tenant-web.php';       // CASE 6 (Vue pages + catch-all LAST)
```

**WHY THIS ORDER**:
- Platform routes load first (more specific, no dynamic segments)
- Tenant routes load second (dynamic `{tenant}` parameter)
- Tenant catch-all `/{tenant}/{any?}` MUST be absolute last (greedy match)

### Route File Structure Examples

**File: routes/platform-mapi.php** (CASE 1)
```php
Route::prefix('mapi/v1')->middleware(['api'])->group(function () {
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::get('health', [PlatformController::class, 'health']);
});
```

**File: routes/tenant-mapi.php** (CASE 2)
```php
Route::prefix('{tenant}/mapi/v1')
    ->middleware(['api', 'identify.tenant'])
    ->group(function () {
        Route::post('elections/{id}/vote', [ElectionController::class, 'vote']);
        Route::get('elections', [ElectionController::class, 'index']);
    });
```

**File: routes/tenant-web.php** (CASE 6)
```php
Route::prefix('{tenant}')
    ->middleware(['web', 'identify.tenant'])
    ->group(function () {
        Route::get('login', [TenantAuthController::class, 'showLogin']);
        Route::get('dashboard', [DashboardController::class, 'index']);

        // CRITICAL: Catch-all MUST be last route in file
        Route::get('{any?}', [VueController::class, 'index'])
            ->where('any', '.*')
            ->name('tenant.spa.catchall');
    });
```

### Service Provider Chain

**File**: `bootstrap/providers.php`
```
Order CRITICAL:
1. SessionServiceProvider (Shared) - MUST be first for tenant isolation
2. AppServiceProvider
3. ElectionServiceProvider, TenantAuthServiceProvider
4. MobileDeviceServiceProvider
5. MobileApiServiceProvider ✅ - Loads mobile API routes
```

### Middleware Stack

**web middleware** (desktop):
1. TenantAwareSessionMiddleware (prepend - MUST run before StartSession)
2. SetLocale, HandleAppearance, HandleInertiaRequests
3. IdentifyTenantFromRequest (append)

**api middleware** (mobile):
- No tenant identification
- No CSRF validation
- No session handling

---

## KEY FILE LOCATIONS (Quick Reference)

| Purpose | File Path |
|---------|-----------|
| **Configuration** | |
| Reserved slugs config | `config/reserved-slugs.php` |
| Tenant slugs config | `config/tenant.php` |
| Spatie multitenancy config | `config/multitenancy.php` |
| API authentication | `config/sanctum.php` |
| Bootstrap & middleware | `bootstrap/app.php` |
| Service providers | `bootstrap/providers.php` |
| **Route Files (6-Case Strategy)** | |
| CASE 1: Platform Mobile API | `routes/platform-mapi/*.php` |
| CASE 2: Tenant Mobile API | `routes/tenant-mapi/*.php` |
| CASE 3: Platform Desktop API | `routes/platform-api/*.php` |
| CASE 4: Tenant Desktop API | `routes/tenant-api/*.php` |
| CASE 5: Platform Desktop Pages | `routes/platform-web/*.php` |
| CASE 6: Tenant Desktop Pages | `routes/tenant-web/*.php` |
| **Multitenancy** | |
| Hybrid tenant finder | `app/Multitenancy/HybridTenantFinder.php` |
| Tenant identification middleware | `app/Contexts/Platform/Infrastructure/Http/Middleware/IdentifyTenantFromRequest.php` |
| **Controllers** | |
| Platform APIs | `app/Http/Controllers/Api/AuthController.php`, `PlatformController.php` |
| Election APIs | `app/Http/Controllers/Api/ElectionController.php` |
| **DDD Contexts** | |
| Bounded contexts | `app/Contexts/{Platform,TenantAuth,ElectionSetup,MobileDevice,Shared}/` |

---

## ROUTE SELECTION STRATEGY (DECISION HOOKS)

**When adding or modifying ANY route, ask these questions in order:**

### 1. What client is making the request?
- **Angular Mobile** → Use `/mapi/*` or `/{tenant}/mapi/*`
- **Vue Desktop** → Use `/api/*` or `/{tenant}/api/*` or page routes

### 2. Does this route need tenant context?
- **YES (tenant-specific data)** → Use `/{tenant}/...` prefix
- **NO (platform-level data)** → Use `/...` (no tenant prefix)

### 3. What type of route is this?
- **Mobile API** + **No tenant** → CASE 1: `platform-mapi.php` (`/mapi/*`)
- **Mobile API** + **With tenant** → CASE 2: `tenant-mapi.php` (`/{tenant}/mapi/*`)
- **Desktop API** + **No tenant** → CASE 3: `platform-api.php` (`/api/*`)
- **Desktop API** + **With tenant** → CASE 4: `tenant-api.php` (`/{tenant}/api/*`)
- **Desktop Page** + **No tenant** → CASE 5: `platform-web.php` (`/*`)
- **Desktop Page** + **With tenant** → CASE 6: `tenant-web.php` (`/{tenant}/*`)

### 4. What middleware is required?
- **Angular API routes** → `['api']` (no CSRF, no session)
- **Vue Desktop routes** → `['web']` (CSRF protection, sessions)
- **Tenant routes** → Add `'identify.tenant'` middleware

### 5. Validation Checklist
- [ ] Route file matches the 6-case strategy
- [ ] Middleware appropriate for client type (api vs web)
- [ ] Tenant middleware added for tenant-specific routes
- [ ] Reserved slugs ('api', 'mapi', 'admin', etc.) not used as tenant slugs
- [ ] Route not already defined in another file
- [ ] Catch-all routes placed LAST in their file

### Example Decision Tree

```
User asks: "Add login endpoint for mobile app"

Q1: Client? → Angular Mobile
Q2: Tenant context? → No (platform login)
Q3: Type? → Mobile API + No tenant = CASE 1

Decision: Add to routes/platform-mapi.php
Route: POST /mapi/v1/auth/login
Middleware: ['api']
```

```
User asks: "Add voting endpoint"

Q1: Client? → Angular Mobile (voting is mobile feature)
Q2: Tenant context? → Yes (votes are tenant-specific)
Q3: Type? → Mobile API + With tenant = CASE 2

Decision: Add to routes/tenant-mapi.php
Route: POST /{tenant}/mapi/v1/elections/{id}/vote
Middleware: ['api', 'identify.tenant']
```

---

## DEVELOPMENT WORKFLOW

### When Approaching Any Task

1. **Read First** - NEVER propose changes to unread code
2. **Apply Route Strategy** - Use 6-case decision hooks for all routing changes
3. **Create Todo List** - Use TodoWrite for multi-step tasks (3+ steps)
4. **Write Tests First** - TDD approach (red-green-refactor)
5. **Follow DDD** - Use existing Value Objects, Events, Services
6. **Validate Tenant Isolation** - Test cross-tenant data access prevention
7. **Ask When Uncertain** - Use AskUserQuestion for ambiguous requirements
8. **Document Changes** - Update relevant docs, add comments for complex logic

### Critical Checks Before Coding

- [ ] Have I read all relevant files?
- [ ] Do I understand the bounded context?
- [ ] Have I written failing tests?
- [ ] Does this preserve tenant isolation?
- [ ] Does this maintain DDD patterns?
- [ ] Have I asked for clarification if uncertain?

---

## CURRENT PROJECT STATUS

### Completed ✅
- Multi-tenancy system (mobile API routes excluded from tenant identification)
- Mobile API routes return JSON (not HTML)
- MobileApiServiceProvider registered and functional
- Sanctum authentication for mobile APIs
- Angular mobile app bootstrapped
- Desktop admin UI (Inertia + Vue3) fully functional

### In Progress 🚧
- Angular mobile app dual-API architecture implementation
- Tenant context switching in mobile app
- Mobile voting interface
- Language detection feature

### Known Issues 🐛
- Environment variable error: `VITE_SELECT_ALL_REQUIRED` undefined
- Production error: `Attempt to read property "is_active" on string` in `EnsureVoterSlugWindow` middleware
- 404 errors on `/voters/index`
- Too many redirects on `/vote/create`
- Election steps config (`config/election_steps.php`) missing POST request steps

---

## USER CONTEXT & SPECIAL INSTRUCTIONS

### Business Rules
1. **One Vote Per Slug**: Each voter can vote only once per election through unique slug (enforced via database constraint on `(election_id, voter_slug)`)
2. **Reserved Slugs**: 'api' and other platform routes cannot be used as tenant slugs
3. **Voting Window**: Voter slug must be active during voting window (enforced by middleware)

### Mobile App Development

**CRITICAL: Angular MUST use `/mapi/*` routes (NOT `/api/*`)**

**Login Flow:**
1. User enters credentials
2. POST to `/mapi/v1/auth/login` (CASE 1 - platform)
3. Receive token + user tenants list
4. User selects tenant (store tenant slug)
5. All subsequent requests use `/{tenant}/mapi/v1/*` (CASE 2)

**API Service Architecture:**
- `platform-api.service.ts` - Uses `/mapi/v1/*` (Landlord DB, CASE 1)
- `tenant-api.service.ts` - Uses `/{tenant}/mapi/v1/*` (Tenant DB, CASE 2)

**Environment Configuration:**
```typescript
// environment.ts
export const environment = {
  platformApiUrl: 'http://localhost:8000/mapi/v1',          // CASE 1
  getTenantApiUrl: (slug: string) =>
    `http://localhost:8000/${slug}/mapi/v1`,                // CASE 2
};

// environment.prod.ts
export const environment = {
  platformApiUrl: 'https://publicdigit.com/mapi/v1',        // CASE 1
  getTenantApiUrl: (slug: string) =>
    `https://publicdigit.com/${slug}/mapi/v1`,              // CASE 2
};
```

**ApiService Implementation Requirements:**
```typescript
setTenant(slug: string): void           // Sets tenant context
clearTenant(): void                     // Clears tenant context
private buildUrl(endpoint: string): string  // Dynamic URL construction
constructor()                           // Restores saved tenant from localStorage
```

**WRONG vs RIGHT:**
- ❌ WRONG: `POST /nrna/api/v1/auth/login` (Vue Desktop API)
- ✅ RIGHT: `POST /nrna/mapi/v1/auth/login` (Angular Mobile API)

### Development Philosophy
- **Ask Always**: When confused, ASK (don't assume)
- **TDD First**: Senior PHP developer approach - tests before implementation
- **No Breaking Changes**: Preserve existing functionality at all costs
- **Simple Over Complex**: Avoid over-engineering, only implement what's requested
- **Security First**: Every change must maintain security posture

---

## COMMON ROUTING SCENARIOS (QUICK REFERENCE)

| Scenario | Route Pattern | File | Middleware |
|----------|---------------|------|------------|
| Mobile app login (platform) | `POST /mapi/v1/auth/login` | `platform-mapi.php` | `['api']` |
| Mobile app user tenants list | `GET /mapi/v1/tenants` | `platform-mapi.php` | `['api', 'auth:sanctum']` |
| Mobile voting for tenant | `POST /nrna/mapi/v1/elections/1/vote` | `tenant-mapi.php` | `['api', 'identify.tenant']` |
| Mobile tenant elections list | `GET /nrna/mapi/v1/elections` | `tenant-mapi.php` | `['api', 'identify.tenant']` |
| Desktop admin login page | `GET /login` | `platform-web.php` | `['web']` |
| Desktop admin API call | `POST /api/v1/users` | `platform-api.php` | `['web']` or `['api']` |
| Tenant desktop login page | `GET /nrna/login` | `tenant-web.php` | `['web', 'identify.tenant']` |
| Tenant desktop API call | `GET /nrna/api/v1/elections` | `tenant-api.php` | `['web', 'identify.tenant']` |
| Tenant Vue SPA fallback | `GET /nrna/any-page` | `tenant-web.php` (catch-all) | `['web', 'identify.tenant']` |

---

## COMMON COMMANDS

**Backend (Laravel)**
```bash
cd packages/laravel-backend

# Clear caches
php artisan route:clear && php artisan config:clear && php artisan cache:clear

# List routes by pattern
php artisan route:list --path=mapi        # Mobile API routes
php artisan route:list --path=api         # Desktop API routes
php artisan route:list | grep -E "mapi|api/v1" | head -20

# Test specific routes
php artisan test --filter AuthenticationTest
curl -X POST http://localhost:8000/mapi/v1/auth/login

# Database
php artisan migrate
```

**Mobile (Angular)**
```bash
cd apps/mobile

# Development
npm install
npm start

# Testing
npm test
nx generate @nx/angular:component --name=my-component --project=mobile

# Fix mobile API endpoint (if using wrong URL)
# Update environment files to use /mapi/* instead of /api/*
```

---

## REFERENCES

- Laravel 12: https://laravel.com/docs/12.x
- Spatie Multitenancy: https://spatie.be/docs/laravel-multitenancy
- Laravel Sanctum: https://laravel.com/docs/12.x/sanctum
- Angular: https://angular.io/docs
- Nx: https://nx.dev
- Capacitor: https://capacitorjs.com

---

**Last Updated**: 2025-12-05
**Status**: Multi-tenancy complete ✅ | Mobile app development in progress 🚧
- You MUST follow DDD principle and TDD - tests first, implementation second. And MUST maintain 80%+ test coverage.
- NO - Do NOT create this dangerous raw SQL migration.

## 🚨 **CRITICAL PROBLEMS:**

1. **Database Agnosticism**: Using `IF NOT EXISTS` is MySQL-specific. Laravel migrations should work on PostgreSQL, SQLite, etc.
2. **No Rollback**: Empty `down()` method violates migration principles.
3. **Error Suppression**: Silently catching exceptions hides real issues.
4. **Untested**: Creating a "force" migration without proper testing is dangerous.

## 🎯 **CORRECT NEXT STEPS:**

### **1. FIRST: Run the tests to see EXACT failures**
```bash
php artisan test --filter TenantUsersUniversalCoreAlignmentTest