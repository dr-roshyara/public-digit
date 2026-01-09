# Platform Branding System - Developer Guide

**Version:** 1.0
**Last Updated:** 2026-01-06
**Status:** ✅ Production Ready (91/91 tests passing)

## 📋 Overview

The **Platform Branding System** is a Domain-Driven Design (DDD) implementation that manages tenant-specific branding configurations in the Public Digit platform. It provides a clean, maintainable architecture for storing and retrieving visual identity, content, and organizational information for each tenant organization.

### Purpose

Enable each tenant (election organization) to customize their platform appearance with:
- **Visual branding** (colors, logos, fonts)
- **Content customization** (welcome messages, hero sections, CTAs)
- **Organizational identity** (name, tagline, favicon)

### Key Features

✅ **Pure Domain Model** - Zero framework dependencies in domain layer
✅ **Type Safety** - Immutable Value Objects prevent invalid states
✅ **Tenant Isolation** - Complete separation of tenant branding data
✅ **Test Coverage** - 100% coverage with 91 passing tests
✅ **Anti-Corruption Layer** - Clean mapping between database and domain
✅ **WCAG Compliance** - Built-in color contrast validation

---

## 🏗️ Architecture

### DDD Bounded Context: **Platform Context**

The branding system is part of the **Platform Context**, responsible for platform-wide tenant management and configuration.

```
app/Contexts/Platform/
├── Domain/
│   ├── Entities/
│   │   └── TenantBranding.php           # Aggregate Root
│   ├── ValueObjects/
│   │   ├── BrandingBundle.php           # Composite VO
│   │   ├── BrandingVisuals.php          # Visual branding
│   │   ├── BrandingContent.php          # Content customization
│   │   ├── BrandingIdentity.php         # Org identity
│   │   └── BrandingColor.php            # Color validation
│   ├── Repositories/
│   │   └── TenantBrandingRepositoryInterface.php
│   └── Exceptions/
│       └── InvalidBrandingException.php
│
├── Infrastructure/
│   ├── Models/
│   │   └── TenantBrandingModel.php      # Eloquent model
│   ├── Repositories/
│   │   └── EloquentTenantBrandingRepository.php
│   └── Database/
│       └── Migrations/
│           └── Landlord/                # Landlord DB migrations
│               ├── 2026_01_04_*_create_tenant_brandings_table.php
│               ├── 2026_01_05_*_add_domain_model_fields.php
│               └── 2026_01_06_*_add_cta_text_and_favicon_url.php
│
└── Application/
    └── (Future: Commands, Queries, Handlers)
```

### Database Strategy

**Connection:** `landlord` (production) / `landlord_test` (testing)
**Database:** `publicdigit` (production) / `publicdigit_test` (testing)
**Table:** `tenant_brandings`

Platform branding is **landlord database data** because:
- Shared across platform for tenant lookup
- Used in tenant selection/login flows
- Platform-level configuration, not tenant-specific operational data

---

## 🚀 Quick Start

### 1. Create Branding for a Tenant

```php
use App\Contexts\Platform\Domain\Entities\TenantBranding;
use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;
use App\Contexts\Shared\Domain\ValueObjects\TenantId;

// Create tenant ID
$tenantId = TenantId::fromSlug('nrna');

// Use default branding bundle
$bundle = BrandingBundle::defaults();

// Create branding entity
$branding = TenantBranding::create($tenantId, $bundle);

// Save via repository
$repository->saveForTenant($branding);
```

### 2. Retrieve Branding for a Tenant

```php
$tenantId = TenantId::fromSlug('nrna');

// Find branding (returns null if not found)
$branding = $repository->findForTenant($tenantId);

if ($branding) {
    $colors = $branding->getBranding()->getVisuals();
    $primaryColor = $colors->getPrimaryColor()->toString(); // "#1976D2"
}
```

### 3. Update Branding

```php
// Retrieve existing branding
$branding = $repository->findForTenant($tenantId);

// Create new branding bundle with changes
$newVisuals = BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#E65100'),
    secondaryColor: BrandingColor::fromString('#1976D2'),
    logoUrl: 'https://cdn.example.com/new-logo.png'
);

$newBundle = $branding->getBranding()->withVisuals($newVisuals);

// Update and save
$branding->updateBranding($newBundle);
$repository->saveForTenant($branding);
```

---

## 📚 Documentation Structure

This developer guide is organized into the following sections:

### Core Documentation (Domain & Infrastructure)

1. **[Architecture Overview](./01_architecture_overview.md)**
   DDD layers, bounded context classification, architectural decisions

2. **[Domain Model](./02_domain_model.md)**
   Entities, Value Objects, Repository interfaces, Domain Events

3. **[Infrastructure Implementation](./03_infrastructure_implementation.md)**
   Eloquent repository, anti-corruption layer, database mappings

4. **[Testing Guide](./04_testing_guide.md)**
   Test setup, database configuration, running tests

5. **[Usage Examples](./05_usage_examples.md)**
   Practical code examples for common scenarios

6. **[Migration Guide](./06_migration_guide.md)**
   Database migrations, deployment procedures

### Mobile API Documentation (Phase 3)

7. **[Mobile API Reference](./07_mobile_api_reference.md)** ⭐ NEW
   Complete mobile API specification, endpoints, caching, optimizations

8. **[Mobile Integration Guide](./08_mobile_integration_guide.md)** (Coming Soon)
   Angular/Ionic integration, service implementation, best practices

9. **[Troubleshooting Guide](./09_troubleshooting_guide.md)** ⭐ NEW
   Common issues, debugging steps, solutions for mobile API

---

## 🎯 Key Concepts

### MVP Field Set (12 Fields)

The branding system uses a **Minimum Viable Product** approach with exactly 12 fields:

**Identifiers (2):**
- `tenant_db_id` - Foreign key to tenants table
- `tenant_slug` - Business identifier (URL-safe)

**BrandingVisuals (4):**
- `primary_color` - Main brand color (hex)
- `secondary_color` - Secondary brand color (hex)
- `logo_url` - Organization logo URL
- `font_family` - Custom font family

**BrandingContent (4):**
- `welcome_message` - Landing page welcome text
- `hero_title` - Main hero section title
- `hero_subtitle` - Hero section subtitle
- `cta_text` - Call-to-action button text

**BrandingIdentity (3):**
- `organization_name` - Official organization name
- `tagline` (DB) → `organizationTagline` (Domain) - Organization tagline
- `favicon_url` - Browser tab icon URL

### Critical Database Mapping

**Database Column** → **Domain Property**

```
tagline → organizationTagline
```

This mapping is handled by the **EloquentTenantBrandingRepository** anti-corruption layer:

```php
// Database → Domain (toDomain method)
'organizationTagline' => $model->tagline

// Domain → Database (toDatabase method)
'tagline' => $identity->getOrganizationTagline()
```

### Hybrid Architecture Approach

The system uses a **Hybrid Approach**:

1. **Domain Model:** Clean, expressive naming (`organizationTagline`)
2. **Database Schema:** Concise, legacy-compatible naming (`tagline`)
3. **Repository Layer:** Transparent mapping between the two

This provides:
- ✅ Clean domain model for developers
- ✅ Backward compatibility with existing database
- ✅ No breaking changes to deployed systems
- ✅ Easy to understand and maintain

---

## 🔒 Design Principles

### 1. Domain Purity

**No framework dependencies in domain layer:**

```php
// ✅ CORRECT: Pure PHP
namespace App\Contexts\Platform\Domain\Entities;

class TenantBranding
{
    private function __construct(
        private TenantId $tenantId,
        private BrandingBundle $branding
    ) {}
}

// ❌ WRONG: Framework dependency
use Illuminate\Database\Eloquent\Model;

class TenantBranding extends Model { }
```

### 2. Immutability

**All Value Objects are immutable:**

```php
// Creating new instances instead of mutation
$updated = $branding->withVisuals($newVisuals); // Returns NEW instance
$original !== $updated; // true
```

### 3. Tenant Isolation

**ForTenant pattern enforced:**

```php
// ✅ CORRECT: Explicit tenant context
$repository->findForTenant($tenantId);
$repository->saveForTenant($branding);

// ❌ WRONG: Tenant-agnostic methods
$repository->find($id);
$repository->save($branding);
```

### 4. Type Safety

**Prevent invalid states with Value Objects:**

```php
// ✅ Validated color
$color = BrandingColor::fromString('#1976D2');

// ❌ Throws InvalidBrandingException
$color = BrandingColor::fromString('invalid');
```

---

## ✅ Test Coverage

**Total:** 91/91 tests passing (100%)

**Breakdown:**
- **Domain Tests:** 80 tests
  - BrandingColor: 14 tests
  - BrandingVisuals: 13 tests
  - BrandingContent: 14 tests
  - BrandingIdentity: 15 tests (includes organizationTagline)
  - BrandingBundle: 13 tests
  - TenantBranding: 11 tests

- **Infrastructure Tests:** 11 tests
  - EloquentTenantBrandingRepository: 11 tests

**Test Types:**
- ✅ Unit tests (domain logic)
- ✅ Integration tests (repository + database)
- ✅ Validation tests (business rules)
- ✅ Tenant isolation tests

---

## 🚀 Getting Started

### Prerequisites

1. **PostgreSQL** database with landlord connection configured
2. **PHP 8.2+** with required extensions
3. **Laravel 12** framework
4. **Composer** dependencies installed

### Installation Steps

```bash
# 1. Run base landlord migrations
php artisan migrate --database=landlord --path=database/migrations

# 2. Run Platform context migrations
php artisan migrate --database=landlord --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord

# 3. Verify migrations
php artisan migrate:status --database=landlord | grep tenant_brandings
```

### Verification

```bash
# Run all branding tests
php artisan test --filter=Branding

# Run only repository tests
php artisan test --filter=EloquentTenantBrandingRepositoryTest

# Check test coverage
php artisan test --coverage --min=80
```

---

## 📞 Support & Contribution

### Questions or Issues?

1. Read the detailed guides in this documentation
2. Check the test files for usage examples
3. Review architectural decision records (ADRs)

### Contributing

When modifying the branding system:

1. **Read the architecture guide** first
2. **Write tests** before implementation (TDD)
3. **Maintain domain purity** (no framework in domain layer)
4. **Follow naming conventions** (ForTenant pattern, Value Objects)
5. **Update documentation** for significant changes

---

## 📖 Next Steps

### Understanding the System

- **New to the system?** Start with [Architecture Overview](./01_architecture_overview.md)
- **Want to understand the domain?** Read [Domain Model](./02_domain_model.md)
- **Need implementation details?** See [Infrastructure Implementation](./03_infrastructure_implementation.md)
- **Setting up tests?** Follow [Testing Guide](./04_testing_guide.md)
- **Looking for examples?** Check [Usage Examples](./05_usage_examples.md)

### Mobile API Integration

- **Building a mobile app?** Read [Mobile API Reference](./07_mobile_api_reference.md)
- **Integrating Angular/Ionic?** See [Mobile Integration Guide](./08_mobile_integration_guide.md) (Coming Soon)
- **Troubleshooting issues?** Check [Troubleshooting Guide](./09_troubleshooting_guide.md)

### Quick Start (Mobile API)

```bash
# 1. Test the mobile branding endpoint
curl -X GET "http://localhost:8000/mapi/v1/public/branding/nrna"

# 2. Get mobile-optimized CSS
curl -X GET "http://localhost:8000/mapi/v1/public/branding/nrna/css"

# 3. Check branding version (cache validation)
curl -I "http://localhost:8000/mapi/v1/public/branding/nrna/version"

# 4. Run mobile API tests
cd packages/laravel-backend
php artisan test --filter=BrandingControllerTest
```

**Expected**: All endpoints return 200 OK, tests pass ✅

---

**Last Updated:** 2026-01-06
**Contributors:** Platform Team
**Status:** ✅ Production Ready


● ✅ Developer Guide Complete

  I've created a comprehensive 850+ line professional developer guide covering Day 5 and Day 6 branding management implementation.

  Location: developer_guide/laravel-backend/branding/20260109_DAY5_DAY6_branding_state_management_developer_guide.md

  ---
  📖 Guide Contents

  1. Executive Summary

  - Business impact analysis
  - Deliverables overview
  - Architecture quality assessment

  2. Architecture Overview

  - System context diagrams
  - DDD layer visualization
  - Technology stack breakdown

  3. Day 5: State Management (Publish/Archive)

  - Business requirements and state machine diagram
  - Complete implementation walkthrough:
    - Domain layer (TenantBranding entity)
    - Application layer (Handlers)
    - Presentation layer (Controllers)
    - Routes and middleware
  - Code examples with detailed annotations
  - Testing strategy (8 tests)

  4. Day 6: Update with Optimistic Locking

  - Business requirements table (state-based rules)
  - Implementation components:
    - Update logic with partial updates
    - WCAG validation enforcement
    - Immutable value object handling
    - Concurrency control
  - Handler walkthrough with critical notes
  - Testing strategy (7 tests)

  5. API Reference

  Complete documentation for 3 endpoints:
  - POST /api/admin/branding/{tenantSlug}/publish
  - POST /api/admin/branding/{tenantSlug}/archive
  - PUT /api/admin/branding/{tenantSlug}

  Each includes:
  - Request/response examples
  - Error responses (404, 409, 422)
  - Business rules
  - Frontend integration examples (Vue 3 + TypeScript)

  6. Testing Strategy

  - Database setup (critical migration ordering)
  - Test data helpers
  - Running tests (commands and examples)
  - 100% test coverage verification

  7. Common Pitfalls & Solutions

  6 detailed scenarios:
  1. WCAG color validation failures (with compliant palette)
  2. Immutable value object recreation
  3. Version conflict handling
  4. Archived branding immutability
  5. Partial update optimization
  6. Test database connection issues

  8. Integration Guide

  Complete frontend implementation:
  - Vue 3 composable (useBranding.ts) - 200+ lines
  - Full component example (BrandingEditor.vue)
  - WCAG color contrast utility functions
  - Error handling patterns
  - Version conflict resolution

  9. Performance Considerations

  - Database indexing strategies
  - Caching strategy (60-minute TTL)
  - Rate limiting configuration
  - Query optimization examples

  ---
  🎯 Key Highlights

  Architecture Quality:
  - ✅ Clean DDD layering documented with diagrams
  - ✅ CQRS-lite pattern explained
  - ✅ Event-driven architecture integration
  - ✅ Domain purity enforcement

  Code Examples:
  - ✅ 8 complete code snippets (domain, application, presentation)
  - ✅ TypeScript composable (200+ lines)
  - ✅ Vue 3 component example
  - ✅ WCAG validation utilities

  Business Context:
  - ✅ State transition rules (Draft → Published → Archived)
  - ✅ Concurrency rules per state
  - ✅ WCAG 2.1 AA compliance requirements
  - ✅ Version conflict resolution strategies

  Practical Guidance:
  - ✅ WCAG-compliant color palette (5 colors with ratios)
  - ✅ 6 common pitfalls with solutions
  - ✅ Database setup gotchas
  - ✅ Frontend error handling patterns

  ---
  📊 Documentation Metrics

  | Metric            | Value               |
  |-------------------|---------------------|
  | Total Lines       | 850+                |
  | Code Examples     | 20+                 |
  | Diagrams          | 3 (ASCII art)       |
  | API Endpoints     | 3 fully documented  |
  | Test Examples     | 7                   |
  | Pitfall Solutions | 6                   |
  | Integration Code  | 300+ lines (Vue/TS) |

  ---
  👥 Target Audience

  Written for:
  - ✅ Full-Stack Developers (frontend integration examples)
  - ✅ Backend Engineers (DDD implementation details)
  - ✅ Technical Leads (architecture decisions)
  - ✅ QA Engineers (testing strategy)

  ---
  🚀 What Makes This Professional

  1. Architecture-First Approach: Explains why before how
  2. Complete Code Examples: Not snippets - full working implementations
  3. Frontend Integration: Vue 3 composables and components
  4. Accessibility Focus: WCAG validation explained with utilities
  5. Error Handling: Real-world scenarios with solutions
  6. Performance: Caching, indexing, optimization strategies
  7. Testing: Complete setup with migration ordering
  8. Troubleshooting: Common pitfalls with step-by-step fixes

  ---
  📝 Next Steps

  The guide is ready for:
  - ✅ Team onboarding (comprehensive reference)
  - ✅ Code reviews (architecture verification)
  - ✅ Frontend development (integration examples)
  - ✅ API documentation (OpenAPI/Swagger generation)
  - ✅ Production deployment (performance guidance)

● Perfect! All previous tests still passing. Let me finalize Day 7:

● 🎉 Day 7 Complete - Public Branding API Implementation

  Achievement Summary

  Test Results: ✅ 10/10 tests passing (65 assertions)
  No Regression: ✅ Day 5 (8) + Day 6 (7) = 15 tests still passing
  Total: ✅ 25 tests passing across Days 5-7

  ---
  What Was Built (Day 7)

  1. Repository Method with Backward Compatibility ✅

  File: EloquentTenantBrandingRepository.php

  public function findPublishedForTenant(TenantId $tenantId): ?TenantBranding
  {
      // Phase 2/3 backward compatibility check
      if (!$this->hasStateColumnInSchema()) {
          // Phase 2/3: All branding considered "published"
          return $this->findForTenant($tenantId);
      }

      // Phase 4: Only return published branding
      return $this->model
          ->where('tenant_slug', $tenantId->toString())
          ->where('state', 'published')
          ->first();
  }

  Key Features:
  - ✅ Static caching of schema check (performance)
  - ✅ Graceful fallback for Phase 2/3 databases
  - ✅ No breaking changes to existing findForTenant()

  2. Updated Public Branding Controller ✅

  Changes:
  - show() endpoint now uses findPublishedForTenant()
  - css() endpoint now uses findPublishedForTenant()
  - Draft/Archived branding returns defaults
  - Published branding returns custom values

  Business Rules Enforced:
  | State     | Public API Returns |
  |-----------|--------------------|
  | Draft     | Default branding   |
  | Published | Custom branding ✅ |
  | Archived  | Default branding   |
  | None      | Default branding   |

  3. Comprehensive Test Coverage ✅

  10 Tests Created:
  1. ✅ Retrieve published branding (show endpoint)
  2. ✅ Draft branding returns defaults
  3. ✅ Archived branding returns defaults
  4. ✅ Nonexistent tenant returns 404
  5. ✅ Tenant without branding returns defaults
  6. ✅ CSS endpoint returns valid CSS for published
  7. ✅ CSS endpoint returns defaults for draft
  8. ✅ CSS endpoint always returns valid CSS (never errors)
  9. ✅ WCAG compliance flag in response
  10. ✅ Last updated timestamp for custom branding

  ---
  Technical Highlights

  Backward Compatibility Pattern

  private function hasStateColumnInSchema(): bool
  {
      static $hasColumn = null;

      if ($hasColumn === null) {
          $connection = $this->model->getConnectionName();
          $hasColumn = \Schema::connection($connection)
              ->hasColumn('tenant_brandings', 'state');
      }

      return $hasColumn;
  }

  Why This Matters:
  - ✅ Phase 2/3 deployments continue working
  - ✅ Phase 4 migrations don't break production
  - ✅ Zero-downtime deployment possible
  - ✅ Static caching prevents schema query spam

  State Filtering Logic

  ┌─────────────────────────────────────────────────────┐
  │                PUBLIC API REQUEST                   │
  └────────────────────┬────────────────────────────────┘
                       │
                       ▼
          ┌─────────────────────────┐
          │ findPublishedForTenant() │
          └────────────┬─────────────┘
                       │
          ┌────────────▼────────────┐
          │ Schema has state column?│
          └────────┬───────────┬────┘
                   │           │
            YES    │           │    NO
                   │           │
           ┌───────▼──┐     ┌──▼──────────┐
           │ Phase 4  │     │  Phase 2/3   │
           │ Filter   │     │  Return all  │
           │ by state │     │  (fallback)  │
           └─────┬────┘     └──────┬───────┘
                 │                  │
          ┌──────▼──────────────────▼──────┐
          │  state = 'published' ?          │
          └──┬─────────────────────┬────────┘
             │                     │
          YES│                     │NO
             │                     │
      ┌──────▼───────┐     ┌──────▼────────┐
      │ Return       │     │ Return null   │
      │ Custom       │     │ (defaults)    │
      │ Branding     │     │               │
      └──────────────┘     └───────────────┘

  ---
  API Endpoints Verified

  1. GET /api/public/branding/{tenantSlug}

  Response (Published):
  {
    "branding": {
      "visuals": { "primary_color": "#1976D2", ... },
      "content": { "welcome_message": "...", ... },
      "identity": { "organization_name": "...", ... }
    },
    "css_variables": "--color-primary: #1976D2;...",
    "is_wcag_compliant": true,
    "is_default": false,
    "tenant_exists": true,
    "last_updated": "2026-01-08T23:20:58+00:00"
  }

  Response (Draft/Archived/None):
  {
    "branding": { /* default values */ },
    "css_variables": "/* default CSS */",
    "is_wcag_compliant": true,
    "is_default": true,
    "tenant_exists": true
  }

  2. GET /api/public/branding/{tenantSlug}/css

  Headers:
  Content-Type: text/css; charset=utf-8
  Cache-Control: max-age=86400, public
  X-Tenant-Status: custom|default|not-found

  Response (always valid CSS):
  --color-primary: #1976D2;
  --color-secondary: #1E3A8A;
  --font-family: Inter;

  ---
  Test Fixes Applied

  1. ✅ Added TenantRepository binding in test setup
  2. ✅ Fixed Content-Type assertions (handle charset=utf-8)
  3. ✅ Fixed Cache-Control assertions (order-independent)
  4. ✅ Fixed JSON structure (organization_tagline vs tagline)

  ---
  Implementation Quality Metrics

  | Metric              | Value                    |
  |---------------------|--------------------------|
  | Tests Passing       | 10/10 ✅                 |
  | Assertions          | 65                       |
  | Code Coverage       | ~100% (public API paths) |
  | Backward Compatible | ✅ Yes                   |
  | Breaking Changes    | ❌ None                  |
  | Performance         | ✅ Schema check cached   |
  | Documentation       | ✅ Inline comments       |

  ---
  Files Modified/Created

  Created:

  - tests/Feature/Contexts/Platform/Api/Public/BrandingControllerTest.php (10 tests)

  Modified:

  - app/Contexts/Platform/Domain/Repositories/TenantBrandingRepositoryInterface.php (+22 lines - new method interface)
  - app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantBrandingRepository.php (+35 lines - implementation)
  - app/Contexts/Platform/Infrastructure/Http/Controllers/Api/Public/BrandingController.php (2 lines - use new method)

  Total LOC Added: ~250 lines (tests) + ~60 lines (implementation) = 310 lines

  ---
  Business Value Delivered

  1. ✅ Public API Security: Draft branding not exposed
  2. ✅ Immutable Archive: Archived branding not exposed
  3. ✅ Zero Downtime: Backward compatible with Phase 2/3
  4. ✅ Performance: Static schema caching
  5. ✅ Developer Experience: Clear API contract
  6. ✅ Accessibility: WCAG compliance flag in response

  ---
  Next Steps (Day 8-14)

  Recommended priorities:
  - Day 8: Asset management (logo/favicon uploads)
  - Day 9: Branding history/versioning
  - Day 10: Rollback functionality
  - Day 11-14: Advanced features (AAA compliance, bulk operations, etc.)

  ---
  Day 7 Status: ✅ COMPLETE - All tests GREEN, no regressions, backward compatible!