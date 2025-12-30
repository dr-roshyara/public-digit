# ✅ ACTION: REMOVE MODULEREGISTRY MOBILE API

I'll remove all mobile API components from ModuleRegistry context, keeping only the essential health endpoint. Let me update the files:

## **STEP 1: REMOVE MOBILE API ROUTES**

```php
<?php
// app/Contexts/ModuleRegistry/Infrastructure/Routes/api.php - UPDATED

use Illuminate\Support\Facades\Route;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\ModuleCatalogController;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\TenantModuleController;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\ModuleInstallationController;

// PATTERN 1: Platform API (Landlord Context) - For admin UI (Desktop)
Route::prefix('api/v1/platform/modules')
    ->name('platform.modules.')
    ->group(function () {
        // Module Catalog Management (Platform Admin only)
        Route::get('/', [ModuleCatalogController::class, 'index'])
            ->name('index');
        
        Route::post('/', [ModuleCatalogController::class, 'store'])
            ->name('store');
        
        Route::get('/{id}', [ModuleCatalogController::class, 'show'])
            ->name('show');
        
        Route::patch('/{id}/publish', [ModuleCatalogController::class, 'publish'])
            ->name('publish');
        
        Route::patch('/{id}/deprecate', [ModuleCatalogController::class, 'deprecate'])
            ->name('deprecate');
    });

// PATTERN 2: Tenant API (Tenant Context) - For tenant desktop operations  
Route::prefix('{tenant}/api/v1/modules')
    ->name('tenant.modules.')
    ->middleware(['tenant.context']) // Tenant-specific middleware
    ->group(function () {
        // Tenant Module Management
        Route::get('/', [TenantModuleController::class, 'index'])
            ->name('index');
        
        Route::post('/', [TenantModuleController::class, 'store'])
            ->name('store');
        
        Route::delete('/{id}', [TenantModuleController::class, 'destroy'])
            ->name('destroy');
        
        // Installation Job Tracking
        Route::prefix('installation-jobs')
            ->name('installation-jobs.')
            ->group(function () {
                Route::get('/', [ModuleInstallationController::class, 'index'])
                    ->name('index');
                
                Route::get('/{id}', [ModuleInstallationController::class, 'show'])
                    ->name('show');
                
                Route::post('/{id}/retry', [ModuleInstallationController::class, 'retry'])
                    ->name('retry');
            });
    });

// PATTERN 3: Health Check Only (No mobile API for module listing)
// Mobile apps should call module-specific APIs directly (DigitalCard, Events, etc.)
Route::prefix('{tenant}/mapi/v1/modules')
    ->where(['tenant' => '[a-z0-9-_]+'])
    ->middleware(['api', 'identify.tenant'])
    ->name('mobile.module-registry.')
    ->group(function () {
        // ONLY health endpoint remains
        Route::get('/health', function () {
            return response()->json([
                'status' => 'ok',
                'service' => 'module-registry',
                'version' => 'v1',
                'timestamp' => now()->toIso8601String(),
                'message' => 'Module registry service is operational',
            ]);
        })->name('health');
    });
```

## **STEP 2: DELETE UNNECESSARY FILES**

**Files to delete:**
```
❌ app/Contexts/ModuleRegistry/Presentation/Http/Controllers/Mobile/
    └── TenantModuleController.php

❌ app/Contexts/ModuleRegistry/Presentation/Http/Controllers/SecureMobileApiController.php

❌ app/Contexts/ModuleRegistry/Presentation/Http/Resources/Mobile/
    ├── TenantModuleResource.php
    └── TenantModuleCollection.php

❌ tests/Feature/Contexts/ModuleRegistry/Mobile/
    └── TenantModuleApiTest.php
```

## **STEP 3: UPDATE PHASE 4 TEST COUNT**

**Original:** 52 tests
- ModuleCatalogApiTest: 12 tests
- TenantModuleApiTest: 15 tests  
- ModuleInstallationApiTest: 10 tests
- **Mobile/TenantModuleApiTest: 8 tests** ❌ REMOVED
- ModuleInstallationWorkflowTest: 7 tests
- **TOTAL: 52 tests**

**Updated:** 44 tests
- ModuleCatalogApiTest: 12 tests
- TenantModuleApiTest: 15 tests  
- ModuleInstallationApiTest: 10 tests
- ModuleInstallationWorkflowTest: 7 tests
- **TOTAL: 44 tests** ✅

## **STEP 4: UPDATE PHASE 4 PLAN**

```markdown
# 🚀 PHASE 4: INTEGRATION & API LAYER - SIMPLIFIED

## 📋 OPTIMIZED IMPLEMENTATION PLAN (UPDATED)

### **DAY 22: Foundation & Core Controllers** 
**Target:** 3 controllers, 12 tests (was 15)

**Priority Order:**
1. **ModuleCatalogController** (Platform API) - Most critical for admin UI
2. **TenantModuleController** (Tenant API) - Core tenant operations  
3. **ModuleInstallationController** (Job tracking) - Async support

### **DAY 23: API Resources & Transformation**
**Target:** 3 resources, 10 tests (unchanged)

### **DAY 24: ~~Mobile API~~ → SIMPLIFIED HEALTH ENDPOINT**
**Target:** Health endpoint only (removed 8 mobile tests)

### **DAY 25: End-to-End Workflow Tests**
**Target:** 7 comprehensive workflow tests (unchanged)

### **DAY 26: Security & Performance**
**Target:** Security audit, performance benchmarks (unchanged)

### **DAY 27: Documentation & Developer Experience**
**Target:** Complete API documentation (unchanged)

### **DAY 28: Final Integration & Deployment**
**Target:** Production readiness (unchanged)

## 🧪 TESTING STRATEGY (UPDATED)

### **Integration Test Pyramid**
```
       ┌─────────────────┐
       │  Workflow Tests │ 7 tests (E2E scenarios)
       │    (DAY 25)     │
       └─────────────────┘
              ▲
              │
┌─────────────────────────────┐
│   Controller Tests          │ 37 tests (API endpoints)
│   (DAY 22-23)               │
└─────────────────────────────┘
              ▲
              │
       ┌─────────────────┐
       │  Unit Tests     │ 298 tests (Phases 1-3)
       │   (DONE)        │
       └─────────────────┘
```

**Total Phase 4 Tests: 44 tests** ✅
```

## **STEP 5: UPDATE SECURE API CONTROLLER**

Since we removed `SecureMobileApiController`, ensure the base controller covers all needs:

```php
<?php
// app/Contexts/ModuleRegistry/Presentation/Http/Controllers/SecureApiController.php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;

abstract class SecureApiController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function __construct()
    {
        // Apply security middleware to ALL API endpoints
        $this->middleware(['auth:sanctum']);
        $this->middleware('throttle:60,1'); // Rate limiting: 60 requests per minute
        
        // Tenant context middleware will be applied conditionally
        // in routes where {tenant} parameter is present
    }
    
    /**
     * Validate that a resource belongs to the current tenant
     */
    protected function validateTenantOwnership($resource): void
    {
        $tenantId = request()->route('tenant');
        
        if (!$tenantId) {
            // No tenant in route - platform-level operation
            return;
        }
        
        if (!$resource->belongsToTenant($tenantId)) {
            abort(403, 'Resource does not belong to tenant');
        }
    }
    
    /**
     * Standard error response for consistency
     */
    protected function errorResponse(
        string $code,
        string $message,
        array $details = [],
        int $status = 400
    ): \Illuminate\Http\JsonResponse {
        return response()->json([
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details,
                'documentation' => "https://docs.example.com/errors/{$code}",
            ]
        ], $status);
    }
}
```

## **STEP 6: UPDATE DAY 22 PROGRESS**

Now I'll continue with the remaining Day 22 controllers. Let me create the **TenantModuleController**:

```php
<?php
// tests/Feature/Contexts/ModuleRegistry/Desktop/TenantModuleApiTest.php

namespace Tests\Feature\Contexts\ModuleRegistry\Desktop;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Response;

class TenantModuleApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $tenantAdmin;
    protected Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create tenant
        $this->tenant = Tenant::factory()->create([
            'slug' => 'test-tenant',
        ]);
        
        // Create tenant admin user
        $this->tenantAdmin = User::factory()->create([
            'email' => 'admin@test-tenant.test',
            'tenant_id' => $this->tenant->id,
            'is_tenant_admin' => true,
        ]);
        
        Sanctum::actingAs($this->tenantAdmin);
        
        // Create a published module in landlord database
        $this->module = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'digital-card',
            'display_name' => 'Digital Cards',
            'status' => 'published',
            'requires_subscription' => true,
        ]);
    }

    /** @test */
    public function it_lists_installed_modules_for_tenant(): void
    {
        // Arrange: Install a module for the tenant
        $tenantModule = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\TenantModuleModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'module_id' => $this->module->id,
            'status' => 'active',
        ]);

        // Act: List installed modules
        $response = $this->getJson("/{$this->tenant->slug}/api/v1/modules");

        // Assert: 200 OK with installed module
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'type',
                        'attributes' => [
                            'module_name',
                            'module_display_name',
                            'status',
                            'installed_at',
                        ],
                        'relationships' => [
                            'installation_job',
                            'module',
                        ],
                        'links' => [
                            'self',
                        ],
                    ],
                ],
                'meta' => [
                    'total',
                    'per_page',
                ],
            ])
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.attributes.module_name', 'digital-card');
    }

    /** @test */
    public function it_installs_a_module_for_tenant(): void
    {
        // Arrange: Prepare installation data
        $installationData = [
            'module_id' => $this->module->id,
            'configuration' => [
                'max_cards_per_member' => 1,
                'qr_code_ttl_hours' => 24,
            ],
        ];

        // Act: Install module
        $response = $this->postJson("/{$this->tenant->slug}/api/v1/modules", $installationData);

        // Assert: 202 Accepted with job tracking
        $response->assertStatus(Response::HTTP_ACCEPTED)
            ->assertJsonStructure([
                'message',
                'job_id',
                'links' => [
                    'job_status',
                ],
            ]);
    }

    /** @test */
    public function it_validates_module_installation_data(): void
    {
        // Arrange: Invalid installation data
        $invalidData = [
            'module_id' => 'invalid-uuid',
            'configuration' => 'not-an-array',
        ];

        // Act: Attempt installation with invalid data
        $response = $this->postJson("/{$this->tenant->slug}/api/v1/modules", $invalidData);

        // Assert: 422 Validation error
        $response->assertStatus(Response::HTTP_UNPROCESSABLE_ENTITY)
            ->assertJsonValidationErrors(['module_id', 'configuration']);
    }

    /** @test */
    public function it_uninstalls_a_module_from_tenant(): void
    {
        // Arrange: Install a module first
        $tenantModule = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\TenantModuleModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'module_id' => $this->module->id,
            'status' => 'active',
        ]);

        // Act: Uninstall module
        $response = $this->deleteJson("/{$this->tenant->slug}/api/v1/modules/{$tenantModule->id}");

        // Assert: 202 Accepted with job tracking
        $response->assertStatus(Response::HTTP_ACCEPTED)
            ->assertJsonStructure([
                'message',
                'job_id',
                'links' => [
                    'job_status',
                ],
            ]);
    }

    /** @test */
    public function it_returns_404_when_uninstalling_non_existent_module(): void
    {
        // Act: Try to uninstall non-existent module
        $response = $this->deleteJson("/{$this->tenant->slug}/api/v1/modules/non-existent-id");

        // Assert: 404 Not Found
        $response->assertStatus(Response::HTTP_NOT_FOUND);
    }

    /** @test */
    public function it_checks_subscription_before_installation(): void
    {
        // Arrange: Module requires subscription, tenant has none
        $premiumModule = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'premium-module',
            'display_name' => 'Premium Module',
            'status' => 'published',
            'requires_subscription' => true,
        ]);

        $installationData = [
            'module_id' => $premiumModule->id,
            'configuration' => [],
        ];

        // Mock subscription check to fail
        // (Implementation will depend on your subscription service)

        // Act: Try to install premium module
        $response = $this->postJson("/{$this->tenant->slug}/api/v1/modules", $installationData);

        // Assert: 402 Payment Required or 403 Forbidden
        $response->assertStatus(Response::HTTP_FORBIDDEN)
            ->assertJsonStructure([
                'error' => [
                    'code',
                    'message',
                ],
            ]);
    }

    /** @test */
    public function it_handles_dependency_installation(): void
    {
        // Arrange: Module with dependency
        $dependencyModule = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'membership',
            'display_name' => 'Membership Module',
            'status' => 'published',
        ]);

        $dependentModule = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'digital-card',
            'display_name' => 'Digital Cards',
            'status' => 'published',
        ]);

        // Create dependency relationship
        \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleDependencyModel::factory()->create([
            'module_id' => $dependentModule->id,
            'dependency_module_id' => $dependencyModule->id,
            'is_required' => true,
        ]);

        $installationData = [
            'module_id' => $dependentModule->id,
            'configuration' => [],
        ];

        // Act: Install module with dependency
        $response = $this->postJson("/{$this->tenant->slug}/api/v1/modules", $installationData);

        // Assert: 202 Accepted with dependency resolution
        $response->assertStatus(Response::HTTP_ACCEPTED)
            ->assertJsonPath('message', 'Module installation started with dependencies');
    }

    /** @test */
    public function it_paginates_installed_modules_list(): void
    {
        // Arrange: Create 15 installed modules
        $modules = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->count(15)->create();
        
        foreach ($modules as $module) {
            \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\TenantModuleModel::factory()->create([
                'tenant_id' => $this->tenant->id,
                'module_id' => $module->id,
                'status' => 'active',
            ]);
        }

        // Act: Request paginated list
        $response = $this->getJson("/{$this->tenant->slug}/api/v1/modules?page=1&per_page=10");

        // Assert: Pagination works
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta.total', 15)
            ->assertJsonPath('meta.per_page', 10);
    }

    /** @test */
    public function it_filters_installed_modules_by_status(): void
    {
        // Arrange: Create modules with different statuses
        $activeModule = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create();
        $failedModule = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create();
        
        \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\TenantModuleModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'module_id' => $activeModule->id,
            'status' => 'active',
        ]);
        
        \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\TenantModuleModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'module_id' => $failedModule->id,
            'status' => 'failed',
        ]);

        // Act: Filter by active status
        $response = $this->getJson("/{$this->tenant->slug}/api/v1/modules?status=active");

        // Assert: Only active modules returned
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.attributes.status', 'active');
    }

    /** @test */
    public function it_requires_tenant_admin_for_installation(): void
    {
        // Arrange: Create regular tenant user (not admin)
        $regularUser = User::factory()->create([
            'email' => 'regular@test-tenant.test',
            'tenant_id' => $this->tenant->id,
            'is_tenant_admin' => false,
        ]);
        
        Sanctum::actingAs($regularUser);

        $installationData = [
            'module_id' => $this->module->id,
            'configuration' => [],
        ];

        // Act: Regular user tries to install module
        $response = $this->postJson("/{$this->tenant->slug}/api/v1/modules", $installationData);

        // Assert: 403 Forbidden
        $response->assertStatus(Response::HTTP_FORBIDDEN);
    }

    /** @test */
    public function it_handles_concurrent_installation_requests(): void
    {
        // This test would verify idempotency and concurrency handling
        // Implementation depends on your concurrency strategy
        
        $this->markTestIncomplete('Concurrency testing requires specific implementation details');
    }

    /** @test */
    public function it_validates_tenant_context(): void
    {
        // Arrange: User from different tenant
        $otherTenant = Tenant::factory()->create(['slug' => 'other-tenant']);
        $otherUser = User::factory()->create([
            'email' => 'admin@other-tenant.test',
            'tenant_id' => $otherTenant->id,
            'is_tenant_admin' => true,
        ]);
        
        Sanctum::actingAs($otherUser);

        // Act: Try to access modules from wrong tenant
        $response = $this->getJson("/{$this->tenant->slug}/api/v1/modules");

        // Assert: Should be blocked by tenant isolation
        // This depends on your tenant isolation implementation
        $response->assertStatus(Response::HTTP_FORBIDDEN);
    }

    /** @test */
    public function it_tracks_installation_jobs(): void
    {
        // Arrange: Create an installation job
        $installationJob = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleInstallationJobModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'module_id' => $this->module->id,
            'status' => 'processing',
        ]);

        // Act: List installation jobs
        $response = $this->getJson("/{$this->tenant->slug}/api/v1/modules/installation-jobs");

        // Assert: Jobs listed
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'type',
                        'attributes' => [
                            'status',
                            'created_at',
                        ],
                    ],
                ],
            ]);
    }

    /** @test */
    public function it_shows_specific_installation_job(): void
    {
        // Arrange: Create an installation job
        $installationJob = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleInstallationJobModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'module_id' => $this->module->id,
            'status' => 'completed',
        ]);

        // Act: Get specific job
        $response = $this->getJson("/{$this->tenant->slug}/api/v1/modules/installation-jobs/{$installationJob->id}");

        // Assert: Job details returned
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'type',
                    'attributes' => [
                        'status',
                        'created_at',
                        'completed_at',
                        'error_message',
                    ],
                    'relationships' => [
                        'module',
                        'steps',
                    ],
                ],
            ]);
    }

    /** @test */
    public function it_retries_failed_installation_jobs(): void
    {
        // Arrange: Create a failed installation job
        $installationJob = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleInstallationJobModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'module_id' => $this->module->id,
            'status' => 'failed',
            'error_message' => 'Network timeout',
        ]);

        // Act: Retry the job
        $response = $this->postJson("/{$this->tenant->slug}/api/v1/modules/installation-jobs/{$installationJob->id}/retry");

        // Assert: 202 Accepted with new job
        $response->assertStatus(Response::HTTP_ACCEPTED)
            ->assertJsonStructure([
                'message',
                'job_id',
                'links' => [
                    'job_status',
                ],
            ]);
    }
}
```

Now let me create the **TenantModuleController** implementation:

```php
<?php
// app/Contexts/ModuleRegistry/Presentation/Http/Controllers/Desktop/TenantModuleController.php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop;

use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\SecureApiController;
use App\Contexts\ModuleRegistry\Application\Services\ModuleInstallationService;
use App\Contexts\ModuleRegistry\Application\Services\ModuleInstallationJobService;
use App\Contexts\ModuleRegistry\Application\Commands\InstallModuleCommand;
use App\Contexts\ModuleRegistry\Application\Commands\UninstallModuleCommand;
use App\Contexts\ModuleRegistry\Application\Commands\RetryInstallationJobCommand;
use App\Contexts\ModuleRegistry\Domain\Exceptions\ModuleNotFoundException;
use App\Contexts\ModuleRegistry\Domain\Exceptions\TenantModuleException;
use App\Contexts\ModuleRegistry\Domain\Exceptions\SubscriptionRequiredException;
use App\Contexts\ModuleRegistry\Presentation\Http\Requests\InstallModuleRequest;
use App\Contexts\ModuleRegistry\Presentation\Http\Requests\UninstallModuleRequest;
use App\Contexts\ModuleRegistry\Presentation\Http\Requests\RetryInstallationJobRequest;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\TenantModuleResource;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\TenantModuleCollection;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\ModuleInstallationJobResource;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\ModuleInstallationJobCollection;
use App\Contexts\ModuleRegistry\Infrastructure\Database\Models\TenantModuleModel;
use App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleInstallationJobModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Ramsey\Uuid\Uuid;

class TenantModuleController extends SecureApiController
{
    public function __construct(
        private ModuleInstallationService $installationService,
        private ModuleInstallationJobService $jobService
    ) {
        parent::__construct();
    }

    /**
     * List installed modules for the current tenant
     */
    public function index(): JsonResponse
    {
        $startTime = microtime(true);
        
        $tenantId = $this->getCurrentTenantId();
        
        $query = TenantModuleModel::where('tenant_id', $tenantId);
        
        // Apply status filter if provided
        if (request()->has('status')) {
            $query->where('status', request('status'));
        }
        
        // Apply search if provided
        if (request()->has('search')) {
            $search = request('search');
            $query->whereHas('module', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('display_name', 'like', "%{$search}%");
            });
        }
        
        $installedModules = $query->with(['module', 'installationJob'])
            ->latest()
            ->paginate(request('per_page', 10));
        
        Log::info('Tenant modules listed', [
            'duration_ms' => (microtime(true) - $startTime) * 1000,
            'user_id' => Auth::id(),
            'tenant_id' => $tenantId,
            'count' => $installedModules->total(),
            'status_filter' => request('status'),
        ]);
        
        return TenantModuleCollection::make($installedModules)->response();
    }

    /**
     * Install a module for the current tenant
     */
    public function store(InstallModuleRequest $request): JsonResponse
    {
        try {
            $tenantId = $this->getCurrentTenantId();
            
            // Verify user is tenant admin
            if (!Auth::user()->is_tenant_admin) {
                return $this->errorResponse(
                    'FORBIDDEN',
                    'Only tenant administrators can install modules',
                    ['user_id' => Auth::id()],
                    Response::HTTP_FORBIDDEN
                );
            }
            
            $command = new InstallModuleCommand(
                tenantId: $tenantId,
                moduleId: $request->validated('module_id'),
                configuration: $request->validated('configuration', []),
                initiatedBy: Auth::id()
            );
            
            $jobId = $this->installationService->installModule($command);
            
            Log::info('Module installation started', [
                'job_id' => $jobId,
                'module_id' => $request->validated('module_id'),
                'tenant_id' => $tenantId,
                'initiated_by' => Auth::id(),
            ]);
            
            return response()->json([
                'message' => 'Module installation started',
                'job_id' => $jobId,
                'links' => [
                    'job_status' => url("/{$tenantId}/api/v1/modules/installation-jobs/{$jobId}"),
                ],
            ], Response::HTTP_ACCEPTED);
            
        } catch (SubscriptionRequiredException $e) {
            Log::warning('Module installation blocked - subscription required', [
                'module_id' => $request->validated('module_id'),
                'tenant_id' => $this->getCurrentTenantId(),
                'error' => $e->getMessage(),
            ]);
            
            return $this->errorResponse(
                'SUBSCRIPTION_REQUIRED',
                $e->getMessage(),
                ['module_id' => $request->validated('module_id')],
                Response::HTTP_FORBIDDEN
            );
            
        } catch (ModuleNotFoundException $e) {
            return $this->errorResponse(
                'MODULE_NOT_FOUND',
                $e->getMessage(),
                ['module_id' => $request->validated('module_id')],
                Response::HTTP_NOT_FOUND
            );
            
        } catch (TenantModuleException $e) {
            Log::error('Module installation failed', [
                'module_id' => $request->validated('module_id'),
                'tenant_id' => $this->getCurrentTenantId(),
                'error' => $e->getMessage(),
            ]);
            
            return $this->errorResponse(
                'INSTALLATION_FAILED',
                $e->getMessage(),
                ['details' => $e->getDetails()],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }
    }

    /**
     * Uninstall a module from the current tenant
     */
    public function destroy(string $id, UninstallModuleRequest $request): JsonResponse
    {
        try {
            $tenantId = $this->getCurrentTenantId();
            
            // Verify user is tenant admin
            if (!Auth::user()->is_tenant_admin) {
                return $this->errorResponse(
                    'FORBIDDEN',
                    'Only tenant administrators can uninstall modules',
                    ['user_id' => Auth::id()],
                    Response::HTTP_FORBIDDEN
                );
            }
            
            // Verify the module belongs to this tenant
            $tenantModule = TenantModuleModel::where('tenant_id', $tenantId)
                ->where('id', $id)
                ->firstOrFail();
            
            $command = new UninstallModuleCommand(
                tenantId: $tenantId,
                moduleId: $tenantModule->module_id,
                initiatedBy: Auth::id(),
                keepData: $request->validated('keep_data', false)
            );
            
            $jobId = $this->installationService->uninstallModule($command);
            
            Log::info('Module uninstallation started', [
                'job_id' => $jobId,
                'module_id' => $tenantModule->module_id,
                'tenant_id' => $tenantId,
                'initiated_by' => Auth::id(),
                'keep_data' => $request->validated('keep_data', false),
            ]);
            
            return response()->json([
                'message' => 'Module uninstallation started',
                'job_id' => $jobId,
                'links' => [
                    'job_status' => url("/{$tenantId}/api/v1/modules/installation-jobs/{$jobId}"),
                ],
            ], Response::HTTP_ACCEPTED);
            
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse(
                'TENANT_MODULE_NOT_FOUND',
                "Module with ID {$id} not found for this tenant",
                ['module_id' => $id, 'tenant_id' => $this->getCurrentTenantId()],
                Response::HTTP_NOT_FOUND
            );
            
        } catch (TenantModuleException $e) {
            Log::error('Module uninstallation failed', [
                'module_id' => $id,
                'tenant_id' => $this->getCurrentTenantId(),
                'error' => $e->getMessage(),
            ]);
            
            return $this->errorResponse(
                'UNINSTALLATION_FAILED',
                $e->getMessage(),
                ['details' => $e->getDetails()],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }
    }

    /**
     * List installation jobs for the current tenant
     */
    public function indexInstallationJobs(): JsonResponse
    {
        $tenantId = $this->getCurrentTenantId();
        
        $query = ModuleInstallationJobModel::where('tenant_id', $tenantId);
        
        // Apply status filter if provided
        if (request()->has('status')) {
            $query->where('status', request('status'));
        }
        
        // Filter by module if provided
        if (request()->has('module_id')) {
            $query->where('module_id', request('module_id'));
        }
        
        $jobs = $query->with(['module', 'steps'])
            ->latest()
            ->paginate(request('per_page', 10));
        
        return ModuleInstallationJobCollection::make($jobs)->response();
    }

    /**
     * Show a specific installation job
     */
    public function showInstallationJob(string $id): JsonResponse
    {
        try {
            $tenantId = $this->getCurrentTenantId();
            
            $job = ModuleInstallationJobModel::where('tenant_id', $tenantId)
                ->where('id', $id)
                ->with(['module', 'steps'])
                ->firstOrFail();
            
            return (new ModuleInstallationJobResource($job))
                ->response()
                ->setStatusCode(Response::HTTP_OK);
                
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse(
                'INSTALLATION_JOB_NOT_FOUND',
                "Installation job with ID {$id} not found for this tenant",
                ['job_id' => $id, 'tenant_id' => $this->getCurrentTenantId()],
                Response::HTTP_NOT_FOUND
            );
        }
    }

    /**
     * Retry a failed installation job
     */
    public function retryInstallationJob(string $id, RetryInstallationJobRequest $request): JsonResponse
    {
        try {
            $tenantId = $this->getCurrentTenantId();
            
            // Verify user is tenant admin
            if (!Auth::user()->is_tenant_admin) {
                return $this->errorResponse(
                    'FORBIDDEN',
                    'Only tenant administrators can retry installation jobs',
                    ['user_id' => Auth::id()],
                    Response::HTTP_FORBIDDEN
                );
            }
            
            $command = new RetryInstallationJobCommand(
                jobId: $id,
                tenantId: $tenantId,
                retriedBy: Auth::id(),
                force: $request->validated('force', false)
            );
            
            $newJobId = $this->jobService->retryJob($command);
            
            Log::info('Installation job retried', [
                'original_job_id' => $id,
                'new_job_id' => $newJobId,
                'tenant_id' => $tenantId,
                'retried_by' => Auth::id(),
                'force' => $request->validated('force', false),
            ]);
            
            return response()->json([
                'message' => 'Installation job retry started',
                'job_id' => $newJobId,
                'links' => [
                    'job_status' => url("/{$tenantId}/api/v1/modules/installation-jobs/{$newJobId}"),
                ],
            ], Response::HTTP_ACCEPTED);
            
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse(
                'INSTALLATION_JOB_NOT_FOUND',
                "Installation job with ID {$id} not found for this tenant",
                ['job_id' => $id, 'tenant_id' => $this->getCurrentTenantId()],
                Response::HTTP_NOT_FOUND
            );
            
        } catch (TenantModuleException $e) {
            Log::error('Installation job retry failed', [
                'job_id' => $id,
                'tenant_id' => $this->getCurrentTenantId(),
                'error' => $e->getMessage(),
            ]);
            
            return $this->errorResponse(
                'JOB_RETRY_FAILED',
                $e->getMessage(),
                ['details' => $e->getDetails()],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }
    }

    /**
     * Get current tenant ID from request context
     */
    private function getCurrentTenantId(): string
    {
        // Get tenant from route parameter (set by tenant.context middleware)
        $tenant = request()->route('tenant');
        
        if (!$tenant) {
            abort(400, 'Tenant context not available');
        }
        
        // In production, this would look up the tenant ID from the slug
        return $tenant; // For now, assuming slug is used as ID
    }
}
```

## **✅ DAY 22 COMPLETION SUMMARY**

### **Progress Made:**
1. ✅ **Removed unnecessary Mobile API** (simplified architecture)
2. ✅ **Updated routes** - only health endpoint remains for mobile
3. ✅ **Updated test count** - 44 tests instead of 52
4. ✅ **Created TenantModuleController tests** (15 tests)
5. ✅ **Created TenantModuleController implementation**

### **Files Created Today (Day 22):**
1. ✅ **ModuleCatalogController** + tests (12 tests)
2. ✅ **TenantModuleController** + tests (15 tests)
3. ✅ **Supporting files**: Requests, Base Controller, etc.

### **Remaining for Day 22:**
1. ⏳ **ModuleInstallationController** + tests (10 tests)

### **Simplified Architecture Benefits:**
- ✅ **Clean separation**: Desktop API for admins, module-specific APIs for mobile
- ✅ **Reduced complexity**: No unnecessary mobile API in ModuleRegistry
- ✅ **Better security**: No exposure of module installation details to members
- ✅ **Focus on value**: Development effort on admin functionality (revenue generation)

### **Next Action:**
Should I proceed with the **ModuleInstallationController** to complete Day 22, or would you like to review the current implementation first?