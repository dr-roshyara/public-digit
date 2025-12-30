# Phase 4: Integration & API Layer - Detailed Implementation Guide

**ModuleRegistry Context - Integration & API Layer**
**Week 4 Implementation (Days 22-28)**
**Target: 52 tests, 13 files**

---

## 📋 Overview

Phase 4 implements the **Integration & API Layer** - REST API endpoints, API resources (transformers), route definitions, and comprehensive integration tests that verify the entire system end-to-end.

### Key Principles

1. **RESTful API Design** - Standard HTTP methods and status codes
2. **API Versioning** - `/api/v1/` prefix for future compatibility
3. **6-Case Routing System** - Follows platform routing architecture
4. **Authorization** - Sanctum tokens + policy-based authorization
5. **Transformation** - API Resources for consistent response format
6. **Integration Testing** - Test entire request → response flow

---

## 🎯 Success Criteria

| Metric | Target |
|--------|--------|
| **Tests** | 52 |
| **Code Coverage** | ≥90% |
| **API Documentation** | Complete OpenAPI spec |
| **Response Times** | <200ms for catalog, <500ms for installation |
| **Authorization** | 100% endpoint coverage |

---

## 📁 File Structure

```
app/Contexts/ModuleRegistry/
├── Presentation/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Desktop/           # Vue Desktop API (CASE 3/4)
│   │   │   │   ├── ModuleCatalogController.php
│   │   │   │   ├── TenantModuleController.php
│   │   │   │   └── ModuleInstallationController.php
│   │   │   └── Mobile/            # Angular Mobile API (CASE 1/2)
│   │   │       └── TenantModuleController.php
│   │   └── Resources/
│   │       ├── ModuleResource.php
│   │       ├── ModuleCollection.php
│   │       ├── TenantModuleResource.php
│   │       ├── TenantModuleCollection.php
│   │       └── ModuleInstallationJobResource.php
│   └── Routes/
│       ├── desktop_api.php        # Desktop API routes
│       └── mobile_api.php         # Mobile API routes

tests/Feature/Contexts/ModuleRegistry/
├── Desktop/
│   ├── ModuleCatalogApiTest.php (12 tests)
│   ├── TenantModuleApiTest.php (15 tests)
│   └── ModuleInstallationApiTest.php (10 tests)
├── Mobile/
│   └── TenantModuleApiTest.php (8 tests)
└── Integration/
    └── ModuleInstallationWorkflowTest.php (7 tests)
```

---

## 🗺️ API Routes Design

### Desktop API (Vue Admin)

**Platform Routes (CASE 3: `/api/*`)**
```php
// routes/api_desktop.php or ModuleRegistry desktop_api.php

Route::prefix('api/v1')->middleware(['api'])->group(function () {
    // Module Catalog (Platform-level, NO tenant context)
    Route::get('/modules', [ModuleCatalogController::class, 'index']);
    Route::get('/modules/{module}', [ModuleCatalogController::class, 'show']);
    Route::post('/modules', [ModuleCatalogController::class, 'register']);
});
```

**Tenant Routes (CASE 4: `/{tenant}/api/*`)**
```php
Route::prefix('{tenant}/api/v1')
    ->middleware(['web', 'identify.tenant', 'auth:sanctum'])
    ->group(function () {
        // Tenant Module Management
        Route::get('/tenant-modules', [TenantModuleController::class, 'index']);
        Route::post('/tenant-modules', [TenantModuleController::class, 'install']);
        Route::delete('/tenant-modules/{module}', [TenantModuleController::class, 'uninstall']);

        // Installation Jobs
        Route::get('/installation-jobs', [ModuleInstallationController::class, 'index']);
        Route::get('/installation-jobs/{job}', [ModuleInstallationController::class, 'show']);
        Route::post('/installation-jobs/{job}/retry', [ModuleInstallationController::class, 'retry']);
    });
```

### Mobile API (Angular)

**Tenant Routes (CASE 2: `/{tenant}/mapi/*`)**
```php
Route::prefix('{tenant}/mapi/v1')
    ->middleware(['api', 'identify.tenant', 'auth:sanctum'])
    ->group(function () {
        // Mobile: View installed modules
        Route::get('/modules', [Mobile\TenantModuleController::class, 'index']);
        Route::get('/modules/{module}', [Mobile\TenantModuleController::class, 'show']);
    });
```

---

## 🎮 Controller Implementations

### 1. ModuleCatalogController (Platform Desktop)

**Purpose**: Manage platform-level module catalog (NO tenant context)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop;

use App\Http\Controllers\Controller;
use App\Contexts\ModuleRegistry\Application\Services\ModuleRegistrationService;
use App\Contexts\ModuleRegistry\Application\Commands\RegisterModuleCommand;
use App\Contexts\ModuleRegistry\Application\Queries\GetAllModulesQuery;
use App\Contexts\ModuleRegistry\Application\Queries\GetModuleByIdQuery;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\ModuleResource;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\ModuleCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ModuleCatalogController - Platform Module Catalog API
 *
 * PRESENTATION LAYER - Framework Coupling Allowed
 * Handles platform-level module catalog operations
 *
 * Routes: CASE 3 (/api/v1/modules)
 * Database: LANDLORD
 * Audience: Platform administrators
 */
final class ModuleCatalogController extends Controller
{
    public function __construct(
        private ModuleRegistrationService $moduleRegistrationService,
        private GetAllModulesQuery $getAllModulesQuery,
        private GetModuleByIdQuery $getModuleByIdQuery
    ) {
    }

    /**
     * List all modules in catalog
     *
     * GET /api/v1/modules
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $modules = $this->getAllModulesQuery->execute();

        return response()->json(
            new ModuleCollection($modules)
        );
    }

    /**
     * Get module details
     *
     * GET /api/v1/modules/{module}
     *
     * @param string $moduleId Module ID (UUID)
     * @return JsonResponse
     */
    public function show(string $moduleId): JsonResponse
    {
        $module = $this->getModuleByIdQuery->execute($moduleId);

        if ($module === null) {
            return response()->json([
                'error' => 'Module not found',
            ], 404);
        }

        return response()->json(
            new ModuleResource($module)
        );
    }

    /**
     * Register new module
     *
     * POST /api/v1/modules
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|min:3|max:50|regex:/^[a-z0-9_]+$/',
            'display_name' => 'required|string|max:100',
            'version' => 'required|string|regex:/^\d+\.\d+\.\d+$/',
            'namespace' => 'required|string|max:100',
            'migrations_path' => 'nullable|string|max:255',
            'requires_subscription' => 'required|boolean',
            'configuration' => 'nullable|array',
            'dependencies' => 'nullable|array',
            'dependencies.*.module_name' => 'required_with:dependencies|string',
            'dependencies.*.version_constraint' => 'required_with:dependencies|string',
        ]);

        $command = new RegisterModuleCommand(
            name: $validated['name'],
            displayName: $validated['display_name'],
            version: $validated['version'],
            namespace: $validated['namespace'],
            migrationsPath: $validated['migrations_path'] ?? null,
            requiresSubscription: $validated['requires_subscription'],
            configuration: $validated['configuration'] ?? [],
            dependencies: $validated['dependencies'] ?? []
        );

        $moduleId = $this->moduleRegistrationService->registerModule($command);

        $module = $this->getModuleByIdQuery->execute($moduleId->toString());

        return response()->json(
            new ModuleResource($module),
            201
        );
    }
}
```

### 2. TenantModuleController (Tenant Desktop)

**Purpose**: Manage tenant-specific module installations

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop;

use App\Http\Controllers\Controller;
use App\Contexts\ModuleRegistry\Application\Services\ModuleInstallationService;
use App\Contexts\ModuleRegistry\Application\Commands\InstallModuleCommand;
use App\Contexts\ModuleRegistry\Application\Commands\UninstallModuleCommand;
use App\Contexts\ModuleRegistry\Application\Queries\GetTenantModulesQuery;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\TenantModuleResource;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\TenantModuleCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * TenantModuleController - Tenant Module Installation API
 *
 * PRESENTATION LAYER - Framework Coupling Allowed
 * Handles tenant-specific module installation operations
 *
 * Routes: CASE 4 (/{tenant}/api/v1/tenant-modules)
 * Database: TENANT
 * Audience: Tenant administrators
 */
final class TenantModuleController extends Controller
{
    public function __construct(
        private ModuleInstallationService $moduleInstallationService,
        private GetTenantModulesQuery $getTenantModulesQuery
    ) {
    }

    /**
     * List all installed modules for tenant
     *
     * GET /{tenant}/api/v1/tenant-modules
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        // Tenant context from middleware (identify.tenant)
        $tenantId = $request->tenantContext()->id();

        $tenantModules = $this->getTenantModulesQuery->execute($tenantId);

        return response()->json(
            new TenantModuleCollection($tenantModules)
        );
    }

    /**
     * Install module for tenant
     *
     * POST /{tenant}/api/v1/tenant-modules
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function install(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'module_id' => 'required|uuid',
            'installed_by' => 'required|string|max:100',
        ]);

        $tenantId = $request->tenantContext()->id();

        $command = new InstallModuleCommand(
            tenantId: $tenantId,
            moduleId: $validated['module_id'],
            installedBy: $validated['installed_by']
        );

        $jobId = $this->moduleInstallationService->installModule($command);

        return response()->json([
            'message' => 'Module installation started',
            'job_id' => $jobId->toString(),
        ], 202); // 202 Accepted (async operation)
    }

    /**
     * Uninstall module for tenant
     *
     * DELETE /{tenant}/api/v1/tenant-modules/{module}
     *
     * @param Request $request
     * @param string $moduleId Module ID (UUID)
     * @return JsonResponse
     */
    public function uninstall(Request $request, string $moduleId): JsonResponse
    {
        $validated = $request->validate([
            'uninstalled_by' => 'required|string|max:100',
        ]);

        $tenantId = $request->tenantContext()->id();

        $command = new UninstallModuleCommand(
            tenantId: $tenantId,
            moduleId: $moduleId,
            uninstalledBy: $validated['uninstalled_by']
        );

        $jobId = $this->moduleInstallationService->uninstallModule($command);

        return response()->json([
            'message' => 'Module uninstallation started',
            'job_id' => $jobId->toString(),
        ], 202); // 202 Accepted (async operation)
    }
}
```

### 3. ModuleInstallationController (Installation Jobs)

**Purpose**: Track and manage installation jobs

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop;

use App\Http\Controllers\Controller;
use App\Contexts\ModuleRegistry\Application\Queries\GetInstallationJobsQuery;
use App\Contexts\ModuleRegistry\Application\Queries\GetInstallationJobByIdQuery;
use App\Contexts\ModuleRegistry\Application\Services\ModuleInstallationJobService;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\ModuleInstallationJobResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ModuleInstallationController - Installation Job Tracking API
 *
 * PRESENTATION LAYER - Framework Coupling Allowed
 * Tracks installation job progress and allows retry
 *
 * Routes: CASE 4 (/{tenant}/api/v1/installation-jobs)
 * Database: TENANT
 */
final class ModuleInstallationController extends Controller
{
    public function __construct(
        private GetInstallationJobsQuery $getInstallationJobsQuery,
        private GetInstallationJobByIdQuery $getInstallationJobByIdQuery,
        private ModuleInstallationJobService $jobService
    ) {
    }

    /**
     * List installation jobs for tenant
     *
     * GET /{tenant}/api/v1/installation-jobs
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->tenantContext()->id();

        $jobs = $this->getInstallationJobsQuery->execute($tenantId);

        return response()->json(
            $jobs->map(fn($job) => new ModuleInstallationJobResource($job))
        );
    }

    /**
     * Get installation job details
     *
     * GET /{tenant}/api/v1/installation-jobs/{job}
     *
     * @param string $jobId Job ID (UUID)
     * @return JsonResponse
     */
    public function show(string $jobId): JsonResponse
    {
        $job = $this->getInstallationJobByIdQuery->execute($jobId);

        if ($job === null) {
            return response()->json([
                'error' => 'Installation job not found',
            ], 404);
        }

        return response()->json(
            new ModuleInstallationJobResource($job)
        );
    }

    /**
     * Retry failed installation job
     *
     * POST /{tenant}/api/v1/installation-jobs/{job}/retry
     *
     * @param string $jobId Job ID (UUID)
     * @return JsonResponse
     */
    public function retry(string $jobId): JsonResponse
    {
        $newJobId = $this->jobService->retryJob($jobId);

        return response()->json([
            'message' => 'Job retry initiated',
            'new_job_id' => $newJobId->toString(),
        ], 202);
    }
}
```

---

## 🔄 API Resources (Transformers)

### 1. ModuleResource

**Purpose**: Transform Module aggregate to JSON response

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use App\Contexts\ModuleRegistry\Application\DTOs\ModuleDTO;

/**
 * ModuleResource - Module API Response Transformer
 *
 * PRESENTATION LAYER - Framework Coupling Allowed
 * Transforms ModuleDTO to JSON response
 */
final class ModuleResource extends JsonResource
{
    /**
     * Transform ModuleDTO to array
     *
     * @param \Illuminate\Http\Request $request
     * @return array
     */
    public function toArray($request): array
    {
        /** @var ModuleDTO $this->resource */
        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'display_name' => $this->resource->displayName,
            'version' => $this->resource->version,
            'namespace' => $this->resource->namespace,
            'migrations_path' => $this->resource->migrationsPath,
            'status' => $this->resource->status,
            'requires_subscription' => $this->resource->requiresSubscription,
            'configuration' => $this->resource->configuration,
            'published_at' => $this->resource->publishedAt?->format('Y-m-d H:i:s'),
            'dependencies' => $this->resource->dependencies->map(function ($dep) {
                return [
                    'module_name' => $dep->moduleName,
                    'version_constraint' => $dep->versionConstraint,
                ];
            })->toArray(),
        ];
    }
}
```

### 2. TenantModuleResource

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use App\Contexts\ModuleRegistry\Application\DTOs\TenantModuleDTO;

/**
 * TenantModuleResource - Tenant Module API Response Transformer
 */
final class TenantModuleResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var TenantModuleDTO $this->resource */
        return [
            'id' => $this->resource->id,
            'tenant_id' => $this->resource->tenantId,
            'module_id' => $this->resource->moduleId,
            'status' => $this->resource->status,
            'installed_by' => $this->resource->installedBy,
            'installed_at' => $this->resource->installedAt?->format('Y-m-d H:i:s'),
            'failure_reason' => $this->resource->failureReason,
            'last_used_at' => $this->resource->lastUsedAt?->format('Y-m-d H:i:s'),
        ];
    }
}
```

### 3. ModuleInstallationJobResource

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use App\Contexts\ModuleRegistry\Application\DTOs\ModuleInstallationJobDTO;

/**
 * ModuleInstallationJobResource - Installation Job Transformer
 */
final class ModuleInstallationJobResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var ModuleInstallationJobDTO $this->resource */
        return [
            'id' => $this->resource->id,
            'tenant_id' => $this->resource->tenantId,
            'module_id' => $this->resource->moduleId,
            'job_type' => $this->resource->jobType,
            'status' => $this->resource->status,
            'started_at' => $this->resource->startedAt?->format('Y-m-d H:i:s'),
            'completed_at' => $this->resource->completedAt?->format('Y-m-d H:i:s'),
            'failed_at' => $this->resource->failedAt?->format('Y-m-d H:i:s'),
            'error_message' => $this->resource->errorMessage,
            'steps' => $this->resource->steps->map(function ($step) {
                return [
                    'step_name' => $step->stepName,
                    'status' => $step->status,
                    'started_at' => $step->startedAt?->format('Y-m-d H:i:s'),
                    'completed_at' => $step->completedAt?->format('Y-m-d H:i:s'),
                    'error_message' => $step->errorMessage,
                ];
            })->toArray(),
        ];
    }
}
```

---

## 🧪 Integration Tests

### 1. ModuleCatalogApiTest (12 tests)

**Purpose**: Test platform-level module catalog API

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\ModuleRegistry\Desktop;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Contexts\ModuleRegistry\Domain\Models\Module;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName;

/**
 * ModuleCatalogApiTest - Integration Tests for Module Catalog API
 *
 * Tests CASE 3: /api/v1/modules
 * Database: LANDLORD
 */
final class ModuleCatalogApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'landlord']);
        $this->artisan('migrate', ['--database' => 'landlord']);
    }

    public function test_can_list_all_modules(): void
    {
        // Arrange: Create modules
        $this->createModule('module_a', '1.0.0');
        $this->createModule('module_b', '2.0.0');

        // Act: GET /api/v1/modules
        $response = $this->getJson('/api/v1/modules');

        // Assert
        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonFragment(['name' => 'module_a']);
        $response->assertJsonFragment(['name' => 'module_b']);
    }

    public function test_can_get_module_details(): void
    {
        // Arrange
        $module = $this->createModule('test_module', '1.0.0');

        // Act: GET /api/v1/modules/{id}
        $response = $this->getJson("/api/v1/modules/{$module->id()->toString()}");

        // Assert
        $response->assertOk();
        $response->assertJson([
            'data' => [
                'id' => $module->id()->toString(),
                'name' => 'test_module',
                'version' => '1.0.0',
            ],
        ]);
    }

    public function test_returns_404_for_nonexistent_module(): void
    {
        // Arrange: Non-existent UUID
        $fakeId = ModuleId::generate()->toString();

        // Act
        $response = $this->getJson("/api/v1/modules/{$fakeId}");

        // Assert
        $response->assertNotFound();
        $response->assertJson(['error' => 'Module not found']);
    }

    public function test_can_register_new_module(): void
    {
        // Act: POST /api/v1/modules
        $response = $this->postJson('/api/v1/modules', [
            'name' => 'new_module',
            'display_name' => 'New Module',
            'version' => '1.0.0',
            'namespace' => 'App\\Modules\\New',
            'requires_subscription' => false,
            'configuration' => ['key' => 'value'],
        ]);

        // Assert
        $response->assertCreated();
        $response->assertJsonFragment(['name' => 'new_module']);
        $this->assertDatabaseHas('modules', ['name' => 'new_module']);
    }

    public function test_validates_required_fields_when_registering(): void
    {
        // Act: POST with missing fields
        $response = $this->postJson('/api/v1/modules', [
            'name' => 'incomplete',
        ]);

        // Assert
        $response->assertUnprocessable();
        $response->assertJsonValidationErrors([
            'display_name',
            'version',
            'namespace',
            'requires_subscription',
        ]);
    }

    public function test_validates_module_name_format(): void
    {
        // Act: POST with invalid name (uppercase, spaces)
        $response = $this->postJson('/api/v1/modules', [
            'name' => 'Invalid Name!',
            'display_name' => 'Invalid Module',
            'version' => '1.0.0',
            'namespace' => 'App\\Invalid',
            'requires_subscription' => false,
        ]);

        // Assert
        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['name']);
    }

    public function test_can_register_module_with_dependencies(): void
    {
        // Arrange: Create dependency module first
        $coreModule = $this->createModule('core', '1.0.0');

        // Act: Register module with dependency
        $response = $this->postJson('/api/v1/modules', [
            'name' => 'addon',
            'display_name' => 'Addon Module',
            'version' => '1.0.0',
            'namespace' => 'App\\Modules\\Addon',
            'requires_subscription' => false,
            'dependencies' => [
                [
                    'module_name' => 'core',
                    'version_constraint' => '>=1.0.0',
                ],
            ],
        ]);

        // Assert
        $response->assertCreated();
        $this->assertDatabaseHas('module_dependencies', [
            'depends_on_module_name' => 'core',
            'version_constraint' => '>=1.0.0',
        ]);
    }

    // ... 5 more tests (pagination, filtering, duplicate detection, etc.)

    private function createModule(string $name, string $version): Module
    {
        $module = new Module(
            ModuleId::generate(),
            ModuleName::fromString($name),
            ucfirst($name),
            ModuleVersion::fromString($version),
            "App\\Modules\\" . ucfirst($name),
            null,
            ModuleStatus::ACTIVE,
            false,
            new ModuleConfiguration([])
        );

        app(ModuleRepositoryInterface::class)->save($module);
        return $module;
    }
}
```

### 2. TenantModuleApiTest (15 tests)

**Purpose**: Test tenant-specific module installation API

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\ModuleRegistry\Desktop;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\Tenant;

/**
 * TenantModuleApiTest - Integration Tests for Tenant Module API
 *
 * Tests CASE 4: /{tenant}/api/v1/tenant-modules
 * Database: TENANT
 */
final class TenantModuleApiTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        // Create tenant and set context
        $this->tenant = Tenant::factory()->create(['slug' => 'test_org']);
        $this->tenant->makeCurrent();

        // Run tenant migrations
        $this->artisan('migrate', ['--database' => 'tenant']);
    }

    public function test_can_list_installed_modules_for_tenant(): void
    {
        // Arrange: Install modules for tenant
        $this->installModuleForTenant('module_a');
        $this->installModuleForTenant('module_b');

        // Act: GET /{tenant}/api/v1/tenant-modules
        $response = $this->getJson("/test_org/api/v1/tenant-modules");

        // Assert
        $response->assertOk();
        $response->assertJsonCount(2, 'data');
    }

    public function test_can_install_module_for_tenant(): void
    {
        // Arrange: Create module in catalog
        $module = $this->createCatalogModule('new_module');

        // Act: POST /{tenant}/api/v1/tenant-modules
        $response = $this->postJson("/test_org/api/v1/tenant-modules", [
            'module_id' => $module->id()->toString(),
            'installed_by' => 'admin@test.com',
        ]);

        // Assert: Returns 202 Accepted (async)
        $response->assertAccepted();
        $response->assertJson([
            'message' => 'Module installation started',
        ]);
        $response->assertJsonStructure(['job_id']);
    }

    public function test_installation_creates_job(): void
    {
        // Arrange
        $module = $this->createCatalogModule('test_module');

        // Act: Install
        $response = $this->postJson("/test_org/api/v1/tenant-modules", [
            'module_id' => $module->id()->toString(),
            'installed_by' => 'admin@test.com',
        ]);

        // Assert: Job created
        $jobId = $response->json('job_id');
        $this->assertDatabaseHas('module_installation_jobs', [
            'id' => $jobId,
            'tenant_id' => $this->tenant->id,
            'module_id' => $module->id()->toString(),
            'job_type' => 'INSTALL',
            'status' => 'PENDING',
        ]);
    }

    public function test_cannot_install_duplicate_module(): void
    {
        // Arrange: Install module once
        $module = $this->createCatalogModule('unique_module');
        $this->installModuleForTenant('unique_module');

        // Act: Try to install again
        $response = $this->postJson("/test_org/api/v1/tenant-modules", [
            'module_id' => $module->id()->toString(),
            'installed_by' => 'admin@test.com',
        ]);

        // Assert: Conflict error
        $response->assertStatus(409); // 409 Conflict
        $response->assertJson([
            'error' => 'Module already installed for this tenant',
        ]);
    }

    public function test_can_uninstall_module(): void
    {
        // Arrange: Install module
        $module = $this->createCatalogModule('removable');
        $this->installModuleForTenant('removable');

        // Act: DELETE /{tenant}/api/v1/tenant-modules/{module}
        $response = $this->deleteJson("/test_org/api/v1/tenant-modules/{$module->id()->toString()}", [
            'uninstalled_by' => 'admin@test.com',
        ]);

        // Assert: Returns 202 Accepted
        $response->assertAccepted();
        $response->assertJsonStructure(['job_id']);
    }

    public function test_validates_module_exists_before_installation(): void
    {
        // Act: Install non-existent module
        $fakeId = ModuleId::generate()->toString();
        $response = $this->postJson("/test_org/api/v1/tenant-modules", [
            'module_id' => $fakeId,
            'installed_by' => 'admin@test.com',
        ]);

        // Assert: Not found error
        $response->assertNotFound();
    }

    public function test_checks_subscription_for_paid_modules(): void
    {
        // Arrange: Create paid module
        $paidModule = $this->createCatalogModule('premium', requiresSubscription: true);

        // Act: Try to install without subscription
        $response = $this->postJson("/test_org/api/v1/tenant-modules", [
            'module_id' => $paidModule->id()->toString(),
            'installed_by' => 'admin@test.com',
        ]);

        // Assert: Forbidden (subscription required)
        $response->assertForbidden();
        $response->assertJson([
            'error' => 'Active subscription required for this module',
        ]);
    }

    // ... 8 more tests (authorization, dependency validation, etc.)
}
```

### 3. ModuleInstallationWorkflowTest (7 tests)

**Purpose**: End-to-end workflow tests

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\ModuleRegistry\Integration;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * ModuleInstallationWorkflowTest - End-to-End Workflow Tests
 *
 * Tests complete installation workflow from start to finish
 */
final class ModuleInstallationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_complete_module_installation_workflow(): void
    {
        // Step 1: Register module in catalog
        $catalogResponse = $this->postJson('/api/v1/modules', [
            'name' => 'workflow_module',
            'display_name' => 'Workflow Module',
            'version' => '1.0.0',
            'namespace' => 'App\\Modules\\Workflow',
            'requires_subscription' => false,
        ]);
        $catalogResponse->assertCreated();
        $moduleId = $catalogResponse->json('data.id');

        // Step 2: Install for tenant
        $installResponse = $this->postJson('/test_org/api/v1/tenant-modules', [
            'module_id' => $moduleId,
            'installed_by' => 'admin@test.com',
        ]);
        $installResponse->assertAccepted();
        $jobId = $installResponse->json('job_id');

        // Step 3: Check job status
        $jobResponse = $this->getJson("/test_org/api/v1/installation-jobs/{$jobId}");
        $jobResponse->assertOk();
        $jobResponse->assertJson([
            'data' => [
                'id' => $jobId,
                'status' => 'PENDING',
            ],
        ]);

        // Step 4: Simulate job processing (would be queue worker)
        $this->artisan('queue:work', ['--once' => true]);

        // Step 5: Verify installation complete
        $jobResponse = $this->getJson("/test_org/api/v1/installation-jobs/{$jobId}");
        $jobResponse->assertOk();
        $jobResponse->assertJson([
            'data' => [
                'status' => 'COMPLETED',
            ],
        ]);

        // Step 6: Verify module appears in tenant's installed list
        $listResponse = $this->getJson('/test_org/api/v1/tenant-modules');
        $listResponse->assertOk();
        $listResponse->assertJsonFragment(['module_id' => $moduleId]);
    }

    public function test_installation_with_dependencies(): void
    {
        // Step 1: Register core module
        $coreResponse = $this->postJson('/api/v1/modules', [
            'name' => 'core',
            'display_name' => 'Core',
            'version' => '1.0.0',
            'namespace' => 'App\\Modules\\Core',
            'requires_subscription' => false,
        ]);
        $coreId = $coreResponse->json('data.id');

        // Step 2: Register addon with dependency
        $addonResponse = $this->postJson('/api/v1/modules', [
            'name' => 'addon',
            'display_name' => 'Addon',
            'version' => '1.0.0',
            'namespace' => 'App\\Modules\\Addon',
            'requires_subscription' => false,
            'dependencies' => [
                ['module_name' => 'core', 'version_constraint' => '>=1.0.0'],
            ],
        ]);
        $addonId = $addonResponse->json('data.id');

        // Step 3: Install addon (should auto-install core first)
        $installResponse = $this->postJson('/test_org/api/v1/tenant-modules', [
            'module_id' => $addonId,
            'installed_by' => 'admin@test.com',
        ]);
        $installResponse->assertAccepted();

        // Step 4: Process queue
        $this->artisan('queue:work', ['--stop-when-empty' => true]);

        // Step 5: Verify both installed
        $listResponse = $this->getJson('/test_org/api/v1/tenant-modules');
        $listResponse->assertOk();
        $listResponse->assertJsonFragment(['module_id' => $coreId]);
        $listResponse->assertJsonFragment(['module_id' => $addonId]);
    }

    // ... 5 more tests (failure handling, retry workflow, etc.)
}
```

---

## 📅 Implementation Timeline

### Day 22-23: Desktop API Controllers
- ✅ Implement ModuleCatalogController
- ✅ Implement TenantModuleController
- ✅ Implement ModuleInstallationController
- ✅ Write 37 integration tests (12 + 15 + 10)

### Day 24: Mobile API
- ✅ Implement Mobile\TenantModuleController
- ✅ Write 8 integration tests

### Day 25: API Resources
- ✅ Implement ModuleResource
- ✅ Implement TenantModuleResource
- ✅ Implement ModuleInstallationJobResource
- ✅ Implement Collection resources

### Day 26: Workflow Tests
- ✅ Write end-to-end workflow tests (7 tests)
- ✅ Test complete installation lifecycle
- ✅ Test dependency resolution workflow

### Day 27: API Documentation
- ✅ Generate OpenAPI specification
- ✅ Write API usage guide
- ✅ Create Postman collection

### Day 28: Final Integration
- ✅ Run full test suite (Phase 1-4)
- ✅ Performance testing
- ✅ Security audit (OWASP)
- ✅ Final documentation review

---

## ✅ Acceptance Criteria

| Criteria | Target | Verification |
|----------|--------|--------------|
| All tests passing | 52/52 | `php artisan test --filter=ModuleRegistry\\Presentation` |
| API documentation | 100% | OpenAPI spec generated |
| Response times | <200ms catalog, <500ms install | Load testing |
| Security | OWASP Top 10 | Security audit checklist |
| Authorization | 100% endpoints | Policy coverage report |

---

## 🔐 Security Checklist

- ✅ All tenant routes protected by `identify.tenant` middleware
- ✅ All endpoints require authentication (`auth:sanctum`)
- ✅ Module installation checks subscription status
- ✅ CSRF protection on state-changing operations
- ✅ Input validation on all endpoints
- ✅ SQL injection prevention (ORM only)
- ✅ Mass assignment protection (fillable/guarded)
- ✅ Rate limiting configured
- ✅ Audit logging for sensitive operations
- ✅ Tenant isolation verified (no cross-tenant data leaks)

---

## 📖 API Usage Examples

### Example 1: Register Module
```bash
POST /api/v1/modules
Content-Type: application/json

{
  "name": "calendar",
  "display_name": "Calendar Module",
  "version": "1.0.0",
  "namespace": "App\\Modules\\Calendar",
  "requires_subscription": true,
  "configuration": {
    "default_view": "month"
  }
}

# Response: 201 Created
{
  "data": {
    "id": "uuid-here",
    "name": "calendar",
    "version": "1.0.0",
    ...
  }
}
```

### Example 2: Install Module for Tenant
```bash
POST /nrna/api/v1/tenant-modules
Authorization: Bearer {token}
Content-Type: application/json

{
  "module_id": "uuid-here",
  "installed_by": "admin@nrna.org"
}

# Response: 202 Accepted
{
  "message": "Module installation started",
  "job_id": "job-uuid-here"
}
```

### Example 3: Check Installation Status
```bash
GET /nrna/api/v1/installation-jobs/job-uuid-here
Authorization: Bearer {token}

# Response: 200 OK
{
  "data": {
    "id": "job-uuid-here",
    "status": "RUNNING",
    "steps": [
      {
        "step_name": "validate_dependencies",
        "status": "COMPLETED"
      },
      {
        "step_name": "run_migrations",
        "status": "RUNNING"
      }
    ]
  }
}
```

---

**Phase 4 Status: READY FOR IMPLEMENTATION ✅**

**ModuleRegistry Context: ALL PHASES DOCUMENTED ✅**

Total Implementation:
- **Phase 1**: 108 tests (Domain Layer) ✅ COMPLETE
- **Phase 2**: 79 tests (Application Layer) 📋 DOCUMENTED
- **Phase 3**: 59 tests (Infrastructure Layer) 📋 DOCUMENTED
- **Phase 4**: 52 tests (Integration & API) 📋 DOCUMENTED

**Grand Total: 298 tests across 4 weeks**
