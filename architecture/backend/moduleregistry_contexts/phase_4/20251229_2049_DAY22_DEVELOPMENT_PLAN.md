# 🏗️ DAY 22: ModuleRegistry API Layer Development Plan

**Role:** Senior Solution Architect & Full-Stack Developer
**Approach:** DDD + TDD-First
**Phase:** Phase 4 - Integration & API Layer
**Status:** Ready for Approval
**Date:** 2025-12-29

---

## 📊 EXECUTIVE SUMMARY

### What We're Building

**Day 22** focuses on implementing the **HTTP API Layer** for ModuleRegistry context, creating the "front door" that allows:
- **Platform Admins** to manage the global module catalog (Case 3 routing)
- **Tenant Admins** to install/uninstall modules for their organizations (Case 4 routing)
- **System Integration** via RESTful API following Laravel best practices

### Business Value

1. **Revenue Enablement**: API enables module marketplace where tenants can browse and install paid modules
2. **Self-Service**: Tenant admins can manage their modules without platform admin intervention
3. **Integration Ready**: Third-party systems can integrate with module registry via standard REST API
4. **Audit Trail**: All module operations tracked for compliance and troubleshooting

### Architectural Significance

This is the **first production-ready API** in the ModuleRegistry context, demonstrating:
- ✅ Hexagonal architecture in practice (HTTP → Application → Domain)
- ✅ Multi-tenant routing (landlord vs tenant databases)
- ✅ TDD workflow (RED → GREEN → REFACTOR)
- ✅ API resource transformation (hide internal models)
- ✅ Async job patterns (202 Accepted for long-running operations)

---

## 🎯 SCOPE OF WORK

### What We're Developing (Day 22)

| Component | Type | Count | Purpose |
|-----------|------|-------|---------|
| **Controllers** | HTTP Controllers | 3 | Handle HTTP requests, delegate to Application Layer |
| **API Resources** | Transformers | 3 | Transform domain/eloquent to JSON API format |
| **Form Requests** | Validation | 2 | Validate incoming request data |
| **Routes** | Route Definitions | 2 groups | Case 3 (Platform) + Case 4 (Tenant) |
| **Feature Tests** | Integration Tests | 12+ | TDD-first test suite |

### Controllers to Implement

#### 1. **ModuleCatalogController** (Case 3 - Platform API)
**Route Base:** `/api/v1/platform/modules`
**Database:** Landlord (publicdigit)
**Purpose:** Manage global module catalog

**Methods:**
```php
- index()   // GET /api/v1/platform/modules - List all modules
- show()    // GET /api/v1/platform/modules/{id} - Get single module
- store()   // POST /api/v1/platform/modules - Register new module
```

**Business Rules:**
- Only authenticated platform admins can POST
- Module names must be unique
- Version must follow semver (1.0.0)
- Response time target: <200ms

#### 2. **TenantModuleController** (Case 4 - Tenant API)
**Route Base:** `/{tenant}/api/v1/modules`
**Database:** Tenant (tenant_nrna, etc.)
**Purpose:** Manage module installations for specific tenant

**Methods:**
```php
- index()   // GET /{tenant}/api/v1/modules - List installed modules
- store()   // POST /{tenant}/api/v1/modules - Install module
- destroy() // DELETE /{tenant}/api/v1/modules/{id} - Uninstall module
```

**Business Rules:**
- Tenant isolation enforced by middleware
- Installation is async (returns 202 Accepted with job_id)
- Must check subscription before install
- Dependency resolution required

#### 3. **ModuleInstallationController** (Case 4 - Job Tracking)
**Route Base:** `/{tenant}/api/v1/installation-jobs`
**Database:** Tenant
**Purpose:** Track async installation/uninstallation jobs

**Methods:**
```php
- index()  // GET /{tenant}/api/v1/installation-jobs - List jobs
- show()   // GET /{tenant}/api/v1/installation-jobs/{id} - Job status
- retry()  // POST /{tenant}/api/v1/installation-jobs/{id}/retry - Retry failed job
```

**Business Rules:**
- Real-time job status polling
- Failed jobs can be retried
- Complete audit trail of all steps

---

## 🏛️ ARCHITECTURE

### Hexagonal Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST                             │
│                     (User/Mobile/Desktop)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Controller (Thin)                                       │   │
│  │  - Extract route parameters                              │   │
│  │  - Validate via FormRequest                              │   │
│  │  - Map to Command/Query DTO                              │   │
│  │  - Delegate to Application Service                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Application Service (Phase 2 - Already Implemented)    │   │
│  │  - ModuleRegistrationService                             │   │
│  │  - GetAllModulesQuery                                    │   │
│  │  - GetModuleByIdQuery                                    │   │
│  │  - InstallModuleCommand                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Domain Services, Aggregates, Value Objects              │   │
│  │  (Phase 1 - Already Implemented)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Repositories, Eloquent Models                           │   │
│  │  (Phase 3 - Already Implemented)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Thin Controllers**: Controllers contain ZERO business logic
   - Extract parameters
   - Validate input
   - Delegate to Application Layer
   - Transform response via API Resources
   - Return HTTP status code

2. **API Resources**: Hide internal implementation
   - Eloquent models NEVER exposed directly
   - Domain aggregates NEVER exposed directly
   - Only expose what's needed for API contract
   - Apply JSON:API format consistently

3. **Tenant Isolation**: Enforced at multiple layers
   - Middleware resolves `{tenant}` slug → `TenantId`
   - Application Service receives `TenantId` parameter
   - Repository queries filtered by tenant_id
   - Database context switched (landlord vs tenant)

4. **Async Operations**: Long-running tasks return immediately
   - Installation returns 202 Accepted with job_id
   - Client polls `/installation-jobs/{id}` for status
   - Failed jobs can be retried without data loss

---

## 🗺️ ROUTING ARCHITECTURE

### Case 3: Platform API (Landlord Context)

**Purpose:** Manage global module catalog (all tenants)
**Database:** Landlord (publicdigit / publicdigit_test)
**Authentication:** Platform admin only

```php
// routes/api.php
Route::prefix('api/v1/platform/modules')
    ->middleware(['auth:sanctum', 'role:platform-admin'])
    ->name('platform.modules.')
    ->group(function () {
        Route::get('/', [ModuleCatalogController::class, 'index']);
        Route::post('/', [ModuleCatalogController::class, 'store']);
        Route::get('/{id}', [ModuleCatalogController::class, 'show']);
    });
```

**URLs:**
- `GET /api/v1/platform/modules` - List all modules in catalog
- `POST /api/v1/platform/modules` - Register new module
- `GET /api/v1/platform/modules/{id}` - Get module details

### Case 4: Tenant API (Tenant Context)

**Purpose:** Manage module installations for specific tenant
**Database:** Tenant (tenant_nrna, tenant_test_1, etc.)
**Authentication:** Tenant admin

```php
// routes/api.php
Route::prefix('{tenant}/api/v1/modules')
    ->middleware(['auth:sanctum', 'identify.tenant', 'role:tenant-admin'])
    ->name('tenant.modules.')
    ->group(function () {
        Route::get('/', [TenantModuleController::class, 'index']);
        Route::post('/', [TenantModuleController::class, 'store']);
        Route::delete('/{id}', [TenantModuleController::class, 'destroy']);
    });

Route::prefix('{tenant}/api/v1/installation-jobs')
    ->middleware(['auth:sanctum', 'identify.tenant'])
    ->name('tenant.installation-jobs.')
    ->group(function () {
        Route::get('/', [ModuleInstallationController::class, 'index']);
        Route::get('/{id}', [ModuleInstallationController::class, 'show']);
        Route::post('/{id}/retry', [ModuleInstallationController::class, 'retry']);
    });
```

**URLs:**
- `GET /nrna/api/v1/modules` - List modules installed for NRNA
- `POST /nrna/api/v1/modules` - Install module for NRNA
- `DELETE /nrna/api/v1/modules/{id}` - Uninstall module
- `GET /nrna/api/v1/installation-jobs` - List installation jobs
- `GET /nrna/api/v1/installation-jobs/{id}` - Get job status
- `POST /nrna/api/v1/installation-jobs/{id}/retry` - Retry failed job

### Mobile API (Minimal Footprint)

**Decision:** NO module management via mobile API
**Rationale:** Module installation is administrative, not end-user facing

```php
// Only health check endpoint for mobile
Route::prefix('{tenant}/mapi/v1/modules')
    ->middleware(['api', 'identify.tenant'])
    ->group(function () {
        Route::get('/health', fn() => response()->json(['status' => 'ok']));
    });
```

---

## 🧪 TDD STRATEGY

### Test-Driven Development Workflow

```
RED Phase: Write Failing Tests (Day 22 Morning)
  ↓
GREEN Phase: Minimal Implementation (Day 22 Afternoon)
  ↓
REFACTOR Phase: Clean Up & Optimize (Day 23)
```

### Test Structure

#### 1. ModuleCatalogApiTest (12 tests)

**File:** `tests/Feature/Contexts/ModuleRegistry/Desktop/ModuleCatalogApiTest.php`

**Test Categories:**
```php
// Authentication & Authorization (3 tests)
test_unauthenticated_request_returns_401()
test_authenticated_user_can_list_modules()
test_only_platform_admin_can_register_module()

// Module Listing (3 tests)
test_can_list_all_modules_in_catalog()
test_module_list_includes_correct_attributes()
test_module_list_supports_pagination()

// Single Module Retrieval (2 tests)
test_can_retrieve_single_module_by_id()
test_returns_404_when_module_not_found()

// Module Registration (3 tests)
test_can_register_new_module()
test_registration_validates_required_fields()
test_cannot_register_duplicate_module()

// Response Format (1 test)
test_responses_follow_json_api_format()
```

#### 2. TenantModuleApiTest (15 tests)

**File:** `tests/Feature/Contexts/ModuleRegistry/Desktop/TenantModuleApiTest.php`

**Test Categories:**
```php
// Tenant Isolation (4 tests)
test_tenant_a_cannot_see_tenant_b_modules()
test_invalid_tenant_slug_returns_404()
test_tenant_context_resolved_correctly()
test_modules_filtered_by_tenant_id()

// Module Installation (5 tests)
test_can_install_module_for_tenant()
test_installation_returns_202_with_job_id()
test_cannot_install_without_subscription()
test_cannot_install_missing_dependencies()
test_idempotent_installation_same_job_id()

// Module Listing (3 tests)
test_can_list_installed_modules()
test_list_shows_installation_status()
test_list_includes_subscription_info()

// Module Uninstallation (3 tests)
test_can_uninstall_module()
test_uninstall_checks_dependencies()
test_uninstall_returns_202_with_job_id()
```

#### 3. ModuleInstallationApiTest (10 tests)

**File:** `tests/Feature/Contexts/ModuleRegistry/Desktop/ModuleInstallationApiTest.php`

**Test Categories:**
```php
// Job Listing (2 tests)
test_can_list_installation_jobs()
test_jobs_filtered_by_tenant()

// Job Status Tracking (4 tests)
test_can_get_job_status()
test_job_includes_progress_steps()
test_completed_job_shows_success()
test_failed_job_shows_error_reason()

// Job Retry (3 tests)
test_can_retry_failed_job()
test_cannot_retry_successful_job()
test_retry_creates_new_job()

// Real-time Updates (1 test)
test_job_status_updates_in_real_time()
```

### Test Database Strategy

**Following:** `developer_guide/laravel-backend/tenant-database/20251229_1352_database_testing_setting.md`

```php
// Test setup example
protected function setUp(): void
{
    parent::setUp();

    // For Case 3 (Platform API) - Use landlord_test
    config(['database.default' => 'landlord_test']);

    // For Case 4 (Tenant API) - Use tenant_test
    $this->tenant = Tenant::factory()->create();
    $this->tenant->makeCurrent();
    config(['database.default' => 'tenant_test']);
}
```

---

## 📂 FILE STRUCTURE

### Files to Create (Day 22)

```
app/Contexts/ModuleRegistry/
├── Presentation/
│   └── Http/
│       ├── Controllers/
│       │   └── Desktop/
│       │       ├── ModuleCatalogController.php       ⭐ NEW
│       │       ├── TenantModuleController.php        ⭐ NEW
│       │       └── ModuleInstallationController.php  ⭐ NEW
│       │
│       ├── Resources/
│       │   ├── ModuleResource.php                    ⭐ NEW
│       │   ├── TenantModuleResource.php              ⭐ NEW
│       │   └── InstallationJobResource.php           ⭐ NEW
│       │
│       └── Requests/
│           ├── RegisterModuleRequest.php             ⭐ NEW
│           └── InstallModuleRequest.php              ⭐ NEW
│
└── Infrastructure/
    └── Routes/
        └── api.php                                   ⭐ UPDATE

tests/Feature/Contexts/ModuleRegistry/
└── Desktop/
    ├── ModuleCatalogApiTest.php                      ⭐ NEW
    ├── TenantModuleApiTest.php                       ⭐ NEW
    └── ModuleInstallationApiTest.php                 ⭐ NEW
```

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: RED (Write Failing Tests) - 2 hours

**Task 1.1:** Create ModuleCatalogApiTest
```bash
php artisan make:test Feature/Contexts/ModuleRegistry/Desktop/ModuleCatalogApiTest
```

**What to write:**
- 12 failing tests covering all scenarios
- Use `RefreshDatabase` trait
- Use `Event::fake()` for event assertions
- Mock authentication: `Sanctum::actingAs($user)`

**Expected result:** 12 tests failing with clear error messages

**Task 1.2:** Create TenantModuleApiTest
**Expected result:** 15 tests failing

**Task 1.3:** Create ModuleInstallationApiTest
**Expected result:** 10 tests failing

**Checkpoint:** 37 failing tests total

---

### Phase 2: GREEN (Minimal Implementation) - 4 hours

**Task 2.1:** Create Controllers (Thin)

**ModuleCatalogController skeleton:**
```php
<?php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop;

use App\Contexts\ModuleRegistry\Application\Services\ModuleRegistrationService;
use App\Contexts\ModuleRegistry\Application\Queries\GetAllModulesQuery;
use App\Contexts\ModuleRegistry\Application\Queries\GetModuleByIdQuery;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\ModuleResource;
use App\Contexts\ModuleRegistry\Presentation\Http\Requests\RegisterModuleRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ModuleCatalogController extends Controller
{
    public function __construct(
        private ModuleRegistrationService $moduleRegistrationService,
        private GetAllModulesQuery $getAllModulesQuery,
        private GetModuleByIdQuery $getModuleByIdQuery
    ) {}

    public function index(Request $request): JsonResponse
    {
        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 15);

        $result = $this->getAllModulesQuery->execute($page, $perPage);

        return response()->json([
            'data' => ModuleResource::collection($result->modules),
            'meta' => [
                'current_page' => $result->currentPage,
                'per_page' => $result->perPage,
                'total' => $result->total,
                'last_page' => $result->lastPage,
            ],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $module = $this->getModuleByIdQuery->execute($id);

        if (!$module) {
            return response()->json(['error' => 'Module not found'], 404);
        }

        return response()->json([
            'data' => new ModuleResource($module),
        ]);
    }

    public function store(RegisterModuleRequest $request): JsonResponse
    {
        $module = $this->moduleRegistrationService->register(
            $request->input('name'),
            $request->input('version'),
            $request->input('description'),
            $request->boolean('requires_subscription', false)
        );

        return response()->json([
            'data' => new ModuleResource($module),
        ], 201);
    }
}
```

**Task 2.2:** Create API Resources

**ModuleResource:**
```php
<?php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ModuleResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id->toString(),
            'type' => 'modules',
            'attributes' => [
                'name' => $this->name->toString(),
                'display_name' => $this->displayName,
                'version' => $this->version->toString(),
                'description' => $this->description,
                'status' => $this->status->value,
                'requires_subscription' => $this->requiresSubscription,
            ],
            'links' => [
                'self' => route('platform.modules.show', $this->id->toString()),
            ],
        ];
    }
}
```

**Task 2.3:** Create Form Requests

**RegisterModuleRequest:**
```php
<?php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Check if user has platform-admin role
        return $this->user()->hasRole('platform-admin');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'regex:/^[a-z0-9_]+$/', 'max:50'],
            'display_name' => ['required', 'string', 'max:100'],
            'version' => ['required', 'string', 'regex:/^\d+\.\d+\.\d+$/'],
            'description' => ['nullable', 'string', 'max:500'],
            'requires_subscription' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.regex' => 'Module name must contain only lowercase letters, numbers, and underscores.',
            'version.regex' => 'Version must follow semantic versioning (e.g., 1.0.0).',
        ];
    }
}
```

**Task 2.4:** Update Routes

**routes/api.php:**
```php
// Register ModuleRegistry routes
Route::group([], function () {
    require base_path('app/Contexts/ModuleRegistry/Infrastructure/Routes/api.php');
});
```

**app/Contexts/ModuleRegistry/Infrastructure/Routes/api.php:**
```php
<?php

use Illuminate\Support\Facades\Route;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\ModuleCatalogController;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\TenantModuleController;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\ModuleInstallationController;

// Case 3: Platform API (Landlord Context)
Route::prefix('api/v1/platform/modules')
    ->middleware(['auth:sanctum'])
    ->name('platform.modules.')
    ->group(function () {
        Route::get('/', [ModuleCatalogController::class, 'index'])->name('index');
        Route::post('/', [ModuleCatalogController::class, 'store'])->name('store');
        Route::get('/{id}', [ModuleCatalogController::class, 'show'])->name('show');
    });

// Case 4: Tenant API (Tenant Context)
Route::prefix('{tenant}/api/v1/modules')
    ->middleware(['auth:sanctum', 'identify.tenant'])
    ->name('tenant.modules.')
    ->group(function () {
        Route::get('/', [TenantModuleController::class, 'index'])->name('index');
        Route::post('/', [TenantModuleController::class, 'store'])->name('store');
        Route::delete('/{id}', [TenantModuleController::class, 'destroy'])->name('destroy');
    });

Route::prefix('{tenant}/api/v1/installation-jobs')
    ->middleware(['auth:sanctum', 'identify.tenant'])
    ->name('tenant.installation-jobs.')
    ->group(function () {
        Route::get('/', [ModuleInstallationController::class, 'index'])->name('index');
        Route::get('/{id}', [ModuleInstallationController::class, 'show'])->name('show');
        Route::post('/{id}/retry', [ModuleInstallationController::class, 'retry'])->name('retry');
    });
```

**Checkpoint:** Run tests - expect 37/37 passing

---

### Phase 3: REFACTOR (Clean & Optimize) - 1 hour

**Task 3.1:** Extract common patterns
- Base controller for shared logic
- Response macros for consistent formatting
- Middleware for common validations

**Task 3.2:** Performance optimization
- Add database indexes
- Implement query optimization
- Add response caching for catalog

**Task 3.3:** Documentation
- Add PHPDoc to all public methods
- Document API contracts
- Create Postman collection

---

## ✅ ACCEPTANCE CRITERIA

### Day 22 Complete When:

- [ ] **37 integration tests passing** (12 + 15 + 10)
- [ ] **3 controllers implemented** (ModuleCatalog, TenantModule, ModuleInstallation)
- [ ] **3 API resources created** (Module, TenantModule, InstallationJob)
- [ ] **2 form requests created** (RegisterModule, InstallModule)
- [ ] **Routes defined** (Case 3 + Case 4)
- [ ] **Response time <200ms** for catalog listing
- [ ] **Tenant isolation verified** (cross-tenant tests passing)
- [ ] **Authentication required** (401 tests passing)
- [ ] **Validation working** (422 tests passing)

### Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Test Coverage | 100% of API endpoints | `php artisan test --coverage` |
| Response Time | <200ms for GET requests | PHPUnit assertions in tests |
| Code Quality | PSR-12 compliant, no warnings | `./vendor/bin/phpcs` |
| Security | All endpoints require auth | Security test suite |
| Tenant Isolation | Zero data leakage | Cross-tenant tests |

---

## 🚧 RISKS & MITIGATION

### Risk 1: Middleware Not Resolving TenantId

**Impact:** HIGH - Tenant isolation breaks
**Probability:** MEDIUM
**Mitigation:**
- Write dedicated middleware test first
- Verify `TenantId` binding in container
- Test with invalid tenant slug

### Risk 2: Application Services Not Ready

**Impact:** HIGH - Controllers can't delegate
**Probability:** LOW (Phase 2 should be complete)
**Mitigation:**
- Verify Phase 2 completion before starting
- Test Application Services in isolation
- Mock if needed (but prefer real services)

### Risk 3: Performance Target Not Met

**Impact:** MEDIUM - User experience degrades
**Probability:** LOW
**Mitigation:**
- Add database indexes early
- Implement eager loading
- Add response caching
- Performance tests in CI

### Risk 4: Test Database Issues

**Impact:** HIGH - Tests fail randomly
**Probability:** MEDIUM
**Mitigation:**
- Follow tenant database testing guide
- Ensure tables exist in test DBs
- Use `RefreshDatabase` properly
- Clear cache between tests

---

## 📚 REFERENCE DOCUMENTATION

### Internal Docs (Already Created)
- [Phase 1.3 Developer Guide](../../digitalcard-context/20251229_1800_phase_1.3_complete_guide.md)
- [Database Testing Setup](../../tenant-database/20251229_1352_database_testing_setting.md)
- [6-Case Routing System](../../../CLAUDE.md)
- [Day 22 Specification](./day22_modulecatalog_specification.md)

### Laravel Documentation
- [API Resources](https://laravel.com/docs/11.x/eloquent-resources)
- [Form Request Validation](https://laravel.com/docs/11.x/validation#form-request-validation)
- [Testing](https://laravel.com/docs/11.x/testing)
- [HTTP Tests](https://laravel.com/docs/11.x/http-tests)

### Best Practices
- [JSON:API Specification](https://jsonapi.org/)
- [RESTful API Design](https://restfulapi.net/)
- [API Versioning](https://www.freecodecamp.org/news/how-to-version-a-rest-api/)

---

## 🎯 NEXT STEPS AFTER APPROVAL

### Immediate Actions (RED Phase)

1. **Create Test Files**
   ```bash
   cd packages/laravel-backend
   php artisan make:test Feature/Contexts/ModuleRegistry/Desktop/ModuleCatalogApiTest
   php artisan make:test Feature/Contexts/ModuleRegistry/Desktop/TenantModuleApiTest
   php artisan make:test Feature/Contexts/ModuleRegistry/Desktop/ModuleInstallationApiTest
   ```

2. **Write Failing Tests**
   - Start with `ModuleCatalogApiTest` (12 tests)
   - Follow with `TenantModuleApiTest` (15 tests)
   - Complete with `ModuleInstallationApiTest` (10 tests)

3. **Run Tests - Verify Failures**
   ```bash
   php artisan test --filter=ModuleCatalogApiTest
   # Expected: 12 failures
   ```

### Timeline

**Morning (4 hours):** RED phase - Write all 37 failing tests
**Afternoon (4 hours):** GREEN phase - Implement controllers, resources, routes
**End of Day:** 37/37 tests passing, Day 22 complete

---

## 💬 QUESTIONS FOR STAKEHOLDERS

Before proceeding, please confirm:

1. **Scope Approval:** Are the 3 controllers (ModuleCatalog, TenantModule, ModuleInstallation) the correct priority?
2. **Mobile API:** Confirmed that mobile API is minimal (health check only)?
3. **Authentication:** Should we use existing Sanctum setup or create new guards?
4. **Authorization:** Roles required - `platform-admin` and `tenant-admin` sufficient?
5. **Performance:** Is <200ms response time realistic for catalog with 100+ modules?
6. **Async Jobs:** Should installation jobs use Laravel Queue or custom implementation?

---

**Status:** ✅ Ready for Development (Pending Approval)
**Estimated Duration:** 1 day (8 hours)
**Dependencies:** Phase 1, 2, 3 complete
**Blocker:** Test database setup (Phase 1.3 tables needed)

---

**Prepared by:** Senior Solution Architect
**Date:** 2025-12-29
**Next Review:** After approval from stakeholders
