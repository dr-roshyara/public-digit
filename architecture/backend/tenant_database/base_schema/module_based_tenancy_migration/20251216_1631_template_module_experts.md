# 🏗️ **INFRASTRUCTURE LAYER IMPLEMENTATION WITH VUE3 + INERTIA.JS**

Let's implement the infrastructure layer with API-first approach using Laravel 12, Vue3, and Inertia.js. We'll maintain DDD principles while adapting to modern SPA architecture.

## **1. INFRASTRUCTURE LAYER STRUCTURE**

```
app/
├── Infrastructure/
│   ├── Platform/
│   │   ├── Admin/
│   │   │   ├── Contexts/
│   │   │   │   ├── TenantManagement/
│   │   │   │   │   ├── Repositories/
│   │   │   │   │   ├── Mappers/
│   │   │   │   │   ├── Controllers/
│   │   │   │   │   └── Resources/
│   │   │   │   ├── TemplateManagement/
│   │   │   │   │   ├── Repositories/
│   │   │   │   │   ├── Mappers/
│   │   │   │   │   ├── Controllers/
│   │   │   │   │   └── Resources/
│   │   │   │   └── SchemaManagement/
│   │   │   │       ├── Repositories/
│   │   │   │       ├── Mappers/
│   │   │   │       ├── Controllers/
│   │   │   │       └── Resources/
│   │   │   ├── Http/
│   │   │   │   ├── Requests/
│   │   │   │   ├── Responses/
│   │   │   │   └── Middleware/
│   │   │   └── Events/
│   │   ├── Shared/
│   │   │   ├── Http/
│   │   │   └── Events/
│   └── Core/
│       ├── Database/
│       ├── Cache/
│       └── Queue/
```

## **2. REPOSITORY IMPLEMENTATIONS**

### **2.1 Tenant Repository**

**File: `app/Infrastructure/Platform/Admin/Contexts/TenantManagement/Repositories/EloquentTenantRepository.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Repositories;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Repositories\TenantRepositoryInterface;
use App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantConfiguration;
use App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantStatus;
use App\Domain\Platform\Shared\ValueObjects\DomainName;
use App\Domain\Platform\Shared\ValueObjects\DatabaseName;
use App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Mappers\TenantMapper;
use App\Models\Tenant as TenantModel;
use Illuminate\Support\Collection;

class EloquentTenantRepository implements TenantRepositoryInterface
{
    private TenantMapper $mapper;
    
    public function __construct(TenantMapper $mapper)
    {
        $this->mapper = $mapper;
    }
    
    public function findById(string $id): ?TenantAggregate
    {
        $model = TenantModel::with(['template', 'modules', 'provisioningHistory'])
            ->find($id);
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function findBySlug(string $slug): ?TenantAggregate
    {
        $model = TenantModel::with(['template', 'modules', 'provisioningHistory'])
            ->where('slug', $slug)
            ->first();
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function findByDomain(string $domain): ?TenantAggregate
    {
        $model = TenantModel::with(['template', 'modules', 'provisioningHistory'])
            ->where('domain', $domain)
            ->first();
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function save(TenantAggregate $tenant): void
    {
        $model = $this->mapper->toEloquent($tenant);
        $model->save();
        
        // Save relationships
        if ($tenant->getTemplate()) {
            $model->template()->associate($tenant->getTemplate()->getId());
        }
        
        // Sync modules
        $moduleIds = $tenant->getModules()->map(fn($module) => $module->getId())->toArray();
        $model->modules()->sync($moduleIds);
        
        // Update tenant ID if it was created
        if (!$tenant->getId()) {
            $tenantReflection = new \ReflectionClass($tenant);
            $idProperty = $tenantReflection->getProperty('id');
            $idProperty->setAccessible(true);
            $idProperty->setValue($tenant, $model->id);
        }
    }
    
    public function delete(TenantAggregate $tenant): void
    {
        $model = TenantModel::find($tenant->getId());
        
        if ($model) {
            $model->delete();
        }
    }
    
    public function findByStatus(TenantStatus $status): Collection
    {
        $models = TenantModel::with(['template', 'modules'])
            ->where('provisioning_status', $status->value)
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function findByTemplate(string $templateId): Collection
    {
        $models = TenantModel::with(['template', 'modules'])
            ->where('template_id', $templateId)
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function paginate(int $perPage = 15, array $filters = []): array
    {
        $query = TenantModel::with(['template', 'modules']);
        
        // Apply filters
        if (isset($filters['status'])) {
            $query->where('provisioning_status', $filters['status']);
        }
        
        if (isset($filters['template_id'])) {
            $query->where('template_id', $filters['template_id']);
        }
        
        if (isset($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('name', 'like', "%{$filters['search']}%")
                  ->orWhere('slug', 'like', "%{$filters['search']}%")
                  ->orWhere('domain', 'like', "%{$filters['search']}%");
            });
        }
        
        if (isset($filters['has_drift'])) {
            $query->whereNotNull('schema_drift_detected_at');
        }
        
        $paginator = $query->orderBy('created_at', 'desc')->paginate($perPage);
        
        return [
            'data' => $paginator->map(fn($model) => $this->mapper->toDomain($model)),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }
    
    public function getStatistics(): array
    {
        return [
            'total' => TenantModel::count(),
            'active' => TenantModel::where('is_active', true)->count(),
            'provisioning' => TenantModel::where('provisioning_status', 'provisioning')->count(),
            'with_drift' => TenantModel::whereNotNull('schema_drift_detected_at')->count(),
            'by_template' => TenantModel::with('template')
                ->selectRaw('template_id, COUNT(*) as count')
                ->groupBy('template_id')
                ->get()
                ->mapWithKeys(fn($item) => [$item->template?->name ?? 'Unknown' => $item->count])
                ->toArray(),
        ];
    }
}
```

### **2.2 Tenant Mapper**

**File: `app/Infrastructure/Platform/Admin/Contexts/TenantManagement/Mappers/TenantMapper.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Mappers;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;
use App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantConfiguration;
use App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantStatus;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities\Template;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\Entities\Module;
use App\Domain\Platform\Shared\ValueObjects\DomainName;
use App\Domain\Platform\Shared\ValueObjects\DatabaseName;
use App\Models\Tenant as TenantModel;
use App\Models\TenantTemplate as TemplateModel;
use App\Models\TemplateModule as ModuleModel;

class TenantMapper
{
    public function toDomain(TenantModel $model): TenantAggregate
    {
        $configuration = new TenantConfiguration(
            settings: json_decode($model->config ?? '{}', true) ?: [],
            provisioningError: $model->provisioning_error,
            provisionedAt: $model->database_created_at ? new \DateTimeImmutable($model->database_created_at) : null,
            schemaHash: $model->schema_hash
        );
        
        $tenant = new TenantAggregate(
            id: (string) $model->id,
            name: $model->name,
            slug: $model->slug,
            domain: new DomainName($model->domain),
            database: new DatabaseName($model->database),
            status: TenantStatus::from($model->provisioning_status),
            configuration: $configuration
        );
        
        // Set template if exists
        if ($model->relationLoaded('template') && $model->template) {
            $templateMapper = new \App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Mappers\TemplateMapper();
            $template = $templateMapper->toDomain($model->template);
            $tenant->setTemplate($template);
        }
        
        // Add modules
        if ($model->relationLoaded('modules')) {
            $moduleMapper = new \App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Mappers\ModuleMapper();
            foreach ($model->modules as $moduleModel) {
                $module = $moduleMapper->toDomain($moduleModel);
                $tenant->addModule($module);
            }
        }
        
        return $tenant;
    }
    
    public function toEloquent(TenantAggregate $tenant): TenantModel
    {
        $model = TenantModel::find($tenant->getId()) ?? new TenantModel();
        
        $model->fill([
            'name' => $tenant->getName(),
            'slug' => $tenant->getSlug(),
            'domain' => $tenant->getDomain()->getValue(),
            'database' => $tenant->getDatabase()->getValue(),
            'provisioning_status' => $tenant->getStatus()->value,
            'config' => json_encode($tenant->getConfiguration()->getSettings()),
            'provisioning_error' => $tenant->getConfiguration()->getProvisioningError(),
            'schema_hash' => $tenant->getConfiguration()->getSchemaHash(),
            'is_active' => $tenant->getStatus() === TenantStatus::ACTIVE,
        ]);
        
        if ($tenant->getConfiguration()->getProvisionedAt()) {
            $model->database_created_at = $tenant->getConfiguration()->getProvisionedAt();
        }
        
        return $model;
    }
    
    public function toApiResource(TenantAggregate $tenant): array
    {
        return [
            'id' => $tenant->getId(),
            'name' => $tenant->getName(),
            'slug' => $tenant->getSlug(),
            'domain' => $tenant->getDomain()->getValue(),
            'database' => $tenant->getDatabase()->getValue(),
            'status' => [
                'value' => $tenant->getStatus()->value,
                'label' => $tenant->getStatus()->getLabel(),
                'color' => $tenant->getStatus()->getColor(),
            ],
            'is_active' => $tenant->getStatus() === TenantStatus::ACTIVE,
            'template' => $tenant->getTemplate() ? [
                'id' => $tenant->getTemplate()->getId(),
                'name' => $tenant->getTemplate()->getName(),
                'slug' => $tenant->getTemplate()->getSlug(),
                'version' => $tenant->getTemplate()->getVersion()->getValue(),
            ] : null,
            'modules' => $tenant->getModules()->map(fn($module) => [
                'id' => $module->getId(),
                'name' => $module->getName(),
                'display_name' => $module->getDisplayName(),
                'version' => $module->getVersion()->getValue(),
            ])->toArray(),
            'configuration' => $tenant->getConfiguration()->getSettings(),
            'provisioning_error' => $tenant->getConfiguration()->getProvisioningError(),
            'schema_hash' => $tenant->getConfiguration()->getSchemaHash(),
            'created_at' => $tenant->getCreatedAt()?->format('c'),
            'updated_at' => $tenant->getUpdatedAt()?->format('c'),
        ];
    }
}
```

## **3. API CONTROLLERS**

### **3.1 Tenant API Controller**

**File: `app/Infrastructure/Platform/Admin/Contexts/TenantManagement/Controllers/Api/TenantController.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Controllers\Api;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Services\TenantProvisioningService;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Specifications\TenantCanBeProvisionedSpecification;
use App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Repositories\EloquentTenantRepository;
use App\Infrastructure\Platform\Admin\Http\Requests\Tenant\CreateTenantRequest;
use App\Infrastructure\Platform\Admin\Http\Requests\Tenant\UpdateTenantRequest;
use App\Infrastructure\Platform\Admin\Http\Requests\Tenant\ProvisionTenantRequest;
use App\Infrastructure\Platform\Admin\Http\Requests\Tenant\SyncTenantRequest;
use App\Infrastructure\Platform\Admin\Http\Resources\TenantResource;
use App\Infrastructure\Platform\Shared\Http\Controllers\ApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends ApiController
{
    private EloquentTenantRepository $repository;
    private TenantProvisioningService $provisioningService;
    private TenantCanBeProvisionedSpecification $provisioningSpecification;
    
    public function __construct(
        EloquentTenantRepository $repository,
        TenantProvisioningService $provisioningService,
        TenantCanBeProvisionedSpecification $provisioningSpecification
    ) {
        $this->repository = $repository;
        $this->provisioningService = $provisioningService;
        $this->provisioningSpecification = $provisioningSpecification;
        
        $this->middleware('auth:sanctum');
        $this->middleware('can:manage_tenants');
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/tenants",
     *     summary="List tenants",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *         required=false,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="per_page",
     *         in="query",
     *         description="Items per page",
     *         required=false,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search term",
     *         required=false,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         description="Filter by status",
     *         required=false,
     *         @OA\Schema(type="string", enum={"draft", "pending", "provisioning", "active", "suspended", "failed", "archived"})
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="array", @OA\Items(ref="#/components/schemas/Tenant")),
     *             @OA\Property(property="meta", ref="#/components/schemas/PaginationMeta")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->get('per_page', 15);
        $filters = $request->only(['search', 'status', 'template_id', 'has_drift']);
        
        $result = $this->repository->paginate($perPage, $filters);
        
        return $this->successResponse([
            'data' => $result['data']->map(fn($tenant) => TenantResource::make($tenant)),
            'meta' => $result['meta'],
        ]);
    }
    
    /**
     * @OA\Post(
     *     path="/api/v1/admin/tenants",
     *     summary="Create a new tenant",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/CreateTenantRequest")
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Tenant created successfully",
     *         @OA\JsonContent(ref="#/components/schemas/Tenant")
     *     )
     * )
     */
    public function store(CreateTenantRequest $request): JsonResponse
    {
        $data = $request->validated();
        
        // Create tenant aggregate
        $tenant = new \App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate(
            id: \Illuminate\Support\Str::uuid()->toString(),
            name: $data['name'],
            slug: $data['slug'],
            domain: new \App\Domain\Platform\Shared\ValueObjects\DomainName($data['domain']),
            database: new \App\Domain\Platform\Shared\ValueObjects\DatabaseName($data['database']),
            status: \App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantStatus::DRAFT,
            configuration: new \App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantConfiguration(
                settings: $data['config'] ?? []
            )
        );
        
        // Set template
        if (isset($data['template_id'])) {
            $templateRepository = app(\App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories\TemplateRepositoryInterface::class);
            $template = $templateRepository->findById($data['template_id']);
            
            if ($template) {
                $tenant->setTemplate($template);
            }
        }
        
        // Save tenant
        $this->repository->save($tenant);
        
        return $this->createdResponse(
            TenantResource::make($tenant)
        );
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/tenants/{tenant}",
     *     summary="Get tenant details",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="tenant",
     *         in="path",
     *         description="Tenant ID or slug",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(ref="#/components/schemas/Tenant")
     *     )
     * )
     */
    public function show(string $identifier): JsonResponse
    {
        $tenant = is_numeric($identifier) 
            ? $this->repository->findById($identifier)
            : $this->repository->findBySlug($identifier);
        
        if (!$tenant) {
            return $this->notFoundResponse('Tenant not found');
        }
        
        return $this->successResponse(
            TenantResource::make($tenant)
        );
    }
    
    /**
     * @OA\Put(
     *     path="/api/v1/admin/tenants/{tenant}",
     *     summary="Update tenant",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="tenant",
     *         in="path",
     *         description="Tenant ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/UpdateTenantRequest")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Tenant updated successfully",
     *         @OA\JsonContent(ref="#/components/schemas/Tenant")
     *     )
     * )
     */
    public function update(UpdateTenantRequest $request, string $id): JsonResponse
    {
        $tenant = $this->repository->findById($id);
        
        if (!$tenant) {
            return $this->notFoundResponse('Tenant not found');
        }
        
        $data = $request->validated();
        
        // Update basic properties
        if (isset($data['name'])) {
            // In a real implementation, we'd have a setName method on the aggregate
            // For now, we'll use reflection
            $reflection = new \ReflectionClass($tenant);
            $nameProperty = $reflection->getProperty('name');
            $nameProperty->setAccessible(true);
            $nameProperty->setValue($tenant, $data['name']);
        }
        
        // Update configuration
        if (isset($data['config'])) {
            $configuration = $tenant->getConfiguration();
            $tenant->getConfiguration()->withSettings($data['config']);
        }
        
        // Update template
        if (isset($data['template_id'])) {
            $templateRepository = app(\App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories\TemplateRepositoryInterface::class);
            $template = $templateRepository->findById($data['template_id']);
            
            if ($template) {
                $tenant->setTemplate($template);
            }
        }
        
        // Update modules
        if (isset($data['modules'])) {
            $moduleRepository = app(\App\Domain\Platform\Admin\Contexts\ModuleManagement\Repositories\ModuleRepositoryInterface::class);
            
            // Clear existing modules
            $tenant->getModules()->clear();
            
            // Add new modules
            foreach ($data['modules'] as $moduleId) {
                $module = $moduleRepository->findById($moduleId);
                if ($module) {
                    $tenant->addModule($module);
                }
            }
        }
        
        $this->repository->save($tenant);
        
        return $this->successResponse(
            TenantResource::make($tenant)
        );
    }
    
    /**
     * @OA\Delete(
     *     path="/api/v1/admin/tenants/{tenant}",
     *     summary="Delete tenant",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="tenant",
     *         in="path",
     *         description="Tenant ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=204,
     *         description="Tenant deleted successfully"
     *     )
     * )
     */
    public function destroy(string $id): JsonResponse
    {
        $tenant = $this->repository->findById($id);
        
        if (!$tenant) {
            return $this->notFoundResponse('Tenant not found');
        }
        
        // Check if tenant can be deleted
        if ($tenant->getStatus() === \App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantStatus::ACTIVE) {
            return $this->errorResponse('Cannot delete active tenant', 422);
        }
        
        $this->repository->delete($tenant);
        
        return $this->successResponse(null, 204);
    }
    
    /**
     * @OA\Post(
     *     path="/api/v1/admin/tenants/{tenant}/provision",
     *     summary="Provision tenant",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="tenant",
     *         in="path",
     *         description="Tenant ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/ProvisionTenantRequest")
     *     ),
     *     @OA\Response(
     *         response=202,
     *         description="Provisioning started",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string"),
     *             @OA\Property(property="job_id", type="string"),
     *             @OA\Property(property="tenant", ref="#/components/schemas/Tenant")
     *         )
     *     )
     * )
     */
    public function provision(ProvisionTenantRequest $request, string $id): JsonResponse
    {
        $tenant = $this->repository->findById($id);
        
        if (!$tenant) {
            return $this->notFoundResponse('Tenant not found');
        }
        
        // Validate tenant can be provisioned
        if (!$this->provisioningSpecification->isSatisfiedBy($tenant)) {
            return $this->errorResponse('Tenant cannot be provisioned in current state', 422);
        }
        
        $data = $request->validated();
        
        // Start provisioning
        try {
            $result = $this->provisioningService->provision($tenant, $data);
            
            return $this->successResponse([
                'message' => 'Tenant provisioning started',
                'job_id' => $result['batch_id'] ?? null,
                'tenant' => TenantResource::make($tenant),
            ], 202);
            
        } catch (\Exception $e) {
            return $this->errorResponse('Provisioning failed: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * @OA\Post(
     *     path="/api/v1/admin/tenants/{tenant}/sync",
     *     summary="Sync tenant schema",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="tenant",
     *         in="path",
     *         description="Tenant ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/SyncTenantRequest")
     *     ),
     *     @OA\Response(
     *         response=202,
     *         description="Sync started",
     *         @OA\JsonContent(
     *             @OA\Property(property="message", type="string"),
     *             @OA\Property(property="job_id", type="string")
     *         )
     *     )
     * )
     */
    public function sync(SyncTenantRequest $request, string $id): JsonResponse
    {
        $tenant = $this->repository->findById($id);
        
        if (!$tenant) {
            return $this->notFoundResponse('Tenant not found');
        }
        
        // Check if tenant is provisioned
        if (!$tenant->getConfiguration()->isProvisioned()) {
            return $this->errorResponse('Tenant is not provisioned', 422);
        }
        
        $data = $request->validated();
        
        // Queue sync job
        $job = \App\Jobs\SyncTenantSchema::dispatch($tenant, $data);
        
        return $this->successResponse([
            'message' => 'Schema sync queued',
            'job_id' => $job->getJobId(),
        ], 202);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/tenants/{tenant}/drift",
     *     summary="Detect schema drift",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="tenant",
     *         in="path",
     *         description="Tenant ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Drift detection results",
     *         @OA\JsonContent(ref="#/components/schemas/SchemaDrift")
     *     )
     * )
     */
    public function detectDrift(string $id): JsonResponse
    {
        $tenant = $this->repository->findById($id);
        
        if (!$tenant) {
            return $this->notFoundResponse('Tenant not found');
        }
        
        $driftService = app(\App\Domain\Platform\Admin\Contexts\SchemaManagement\Services\SchemaComparisonService::class);
        $drift = $driftService->compareWithExpected($tenant);
        
        return $this->successResponse([
            'has_drift' => $drift->hasChanges(),
            'severity' => $drift->getSeverity(),
            'details' => $drift->toArray(),
            'detected_at' => now()->toISOString(),
        ]);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/tenants/{tenant}/status",
     *     summary="Get tenant status",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="tenant",
     *         in="path",
     *         description="Tenant ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Tenant status",
     *         @OA\JsonContent(
     *             @OA\Property(property="status", type="string"),
     *             @OA\Property(property="health", type="object"),
     *             @OA\Property(property="metrics", type="object")
     *         )
     *     )
     * )
     */
    public function status(string $id): JsonResponse
    {
        $tenant = $this->repository->findById($id);
        
        if (!$tenant) {
            return $this->notFoundResponse('Tenant not found');
        }
        
        $statusService = app(\App\Domain\Platform\Admin\Contexts\TenantManagement\Services\TenantStatusService::class);
        $status = $statusService->getDetailedStatus($tenant);
        
        return $this->successResponse($status);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/tenants/statistics",
     *     summary="Get tenant statistics",
     *     tags={"Tenants"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Statistics",
     *         @OA\JsonContent(type="object")
     *     )
     * )
     */
    public function statistics(): JsonResponse
    {
        $stats = $this->repository->getStatistics();
        
        return $this->successResponse($stats);
    }
}
```

## **4. API RESOURCES**

### **4.1 Tenant Resource**

**File: `app/Infrastructure/Platform/Admin/Contexts/TenantManagement/Http/Resources/TenantResource.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Http\Resources;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;
use Illuminate\Http\Resources\Json\JsonResource;

class TenantResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        /** @var TenantAggregate $tenant */
        $tenant = $this->resource;
        
        $mapper = new \App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Mappers\TenantMapper();
        
        return $mapper->toApiResource($tenant);
    }
    
    /**
     * Customize the outgoing response.
     */
    public function withResponse($request, $response)
    {
        $response->header('X-Tenant-API-Version', '1.0.0');
    }
}
```

### **4.2 Collection Resources**

**File: `app/Infrastructure/Platform/Admin/Contexts/TenantManagement/Http/Resources/TenantCollection.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Http\Resources;

use Illuminate\Http\Resources\Json\ResourceCollection;

class TenantCollection extends ResourceCollection
{
    /**
     * Transform the resource collection into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        return [
            'data' => $this->collection,
            'links' => [
                'self' => $request->fullUrl(),
            ],
        ];
    }
    
    /**
     * Get additional data that should be returned with the resource array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function with($request)
    {
        return [
            'meta' => [
                'version' => '1.0.0',
                'api_docs' => route('api.docs'),
            ],
        ];
    }
}
```

## **5. API REQUESTS (FORM REQUESTS)**

### **5.1 Tenant Request Classes**

**File: `app/Infrastructure/Platform/Admin/Http/Requests/Tenant/CreateTenantRequest.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Http\Requests\Tenant;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateTenantRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('create_tenants');
    }
    
    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:tenants,slug'],
            'domain' => ['required', 'string', 'max:255', 'unique:tenants,domain'],
            'database' => ['required', 'string', 'max:64', 'regex:/^[a-z][a-z0-9_]*$/', 'unique:tenants,database'],
            'template_id' => ['required', 'exists:tenant_templates,id'],
            'modules' => ['array'],
            'modules.*' => ['exists:template_modules,id'],
            'config' => ['array'],
            'config.nepali_context' => ['boolean'],
            'config.election_commission_compliance' => ['boolean'],
            'config.multi_language' => ['boolean'],
            'config.default_language' => ['in:en,np'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:20'],
            'notes' => ['nullable', 'string'],
            'provisioning_strategy' => ['in:standard,minimal,custom'],
            'auto_provision' => ['boolean'],
        ];
    }
    
    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'database.regex' => 'Database name must start with a letter and contain only lowercase letters, numbers, and underscores.',
            'template_id.exists' => 'The selected template does not exist.',
            'modules.*.exists' => 'One or more selected modules do not exist.',
        ];
    }
    
    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        if (!$this->has('database')) {
            $this->merge([
                'database' => 'tenant_' . strtolower($this->input('slug', '')),
            ]);
        }
        
        if (!$this->has('config')) {
            $this->merge([
                'config' => [],
            ]);
        }
        
        if (!$this->has('modules')) {
            $this->merge([
                'modules' => [],
            ]);
        }
    }
}
```

**File: `app/Infrastructure/Platform/Admin/Http/Requests/Tenant/ProvisionTenantRequest.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Http\Requests\Tenant;

use Illuminate\Foundation\Http\FormRequest;

class ProvisionTenantRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('provision_tenants');
    }
    
    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'strategy' => ['required', 'in:standard,minimal,custom'],
            'queue' => ['boolean'],
            'notify_on_completion' => ['boolean'],
            'options' => ['array'],
            'options.skip_validation' => ['boolean'],
            'options.force' => ['boolean'],
            'options.dry_run' => ['boolean'],
        ];
    }
    
    /**
     * Get default values.
     */
    public function defaults(): array
    {
        return [
            'strategy' => 'standard',
            'queue' => true,
            'notify_on_completion' => true,
            'options' => [],
        ];
    }
}
```

## **6. VUE3 COMPONENTS WITH INERTIA.JS**

### **6.1 Base API Service**

**File: `resources/js/services/api/TenantService.js`**

```javascript
import axios from 'axios';
import { usePage } from '@inertiajs/vue3';

class TenantService {
    constructor() {
        this.client = axios.create({
            baseURL: '/api/v1/admin',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        
        // Add auth token from Laravel Sanctum
        const page = usePage();
        const token = page.props.auth?.token;
        if (token) {
            this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        
        // Add CSRF token
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (csrfToken) {
            this.client.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
        }
    }
    
    // Tenants
    async getTenants(params = {}) {
        const response = await this.client.get('/tenants', { params });
        return response.data;
    }
    
    async getTenant(idOrSlug) {
        const response = await this.client.get(`/tenants/${idOrSlug}`);
        return response.data;
    }
    
    async createTenant(data) {
        const response = await this.client.post('/tenants', data);
        return response.data;
    }
    
    async updateTenant(id, data) {
        const response = await this.client.put(`/tenants/${id}`, data);
        return response.data;
    }
    
    async deleteTenant(id) {
        const response = await this.client.delete(`/tenants/${id}`);
        return response.data;
    }
    
    async provisionTenant(id, data = {}) {
        const response = await this.client.post(`/tenants/${id}/provision`, data);
        return response.data;
    }
    
    async syncTenant(id, data = {}) {
        const response = await this.client.post(`/tenants/${id}/sync`, data);
        return response.data;
    }
    
    async detectDrift(id) {
        const response = await this.client.get(`/tenants/${id}/drift`);
        return response.data;
    }
    
    async getTenantStatus(id) {
        const response = await this.client.get(`/tenants/${id}/status`);
        return response.data;
    }
    
    async getTenantStatistics() {
        const response = await this.client.get('/tenants/statistics');
        return response.data;
    }
    
    // Templates
    async getTemplates(params = {}) {
        const response = await this.client.get('/templates', { params });
        return response.data;
    }
    
    async getTemplate(id) {
        const response = await this.client.get(`/templates/${id}`);
        return response.data;
    }
    
    // Modules
    async getModules(params = {}) {
        const response = await this.client.get('/modules', { params });
        return response.data;
    }
    
    // Provisioning Queue
    async getProvisioningQueue(params = {}) {
        const response = await this.client.get('/provisioning-queue', { params });
        return response.data;
    }
    
    async retryJob(jobId) {
        const response = await this.client.post(`/provisioning-queue/${jobId}/retry`);
        return response.data;
    }
    
    async cancelJob(jobId) {
        const response = await this.client.delete(`/provisioning-queue/${jobId}`);
        return response.data;
    }
}

export default new TenantService();
```

### **6.2 Tenant List Component**

**File: `resources/js/Pages/Admin/Tenants/Index.vue`**

```vue
<template>
  <AdminLayout title="Tenant Management">
    <template #header>
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-semibold text-gray-900">Tenant Management</h1>
        <div class="flex space-x-3">
          <Button @click="showCreateModal = true" variant="primary">
            <PlusIcon class="w-5 h-5 mr-2" />
            Create Tenant
          </Button>
          <Button @click="refreshData" variant="outline">
            <ArrowPathIcon class="w-5 h-5" />
          </Button>
        </div>
      </div>
    </template>

    <div class="mt-6">
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <Input
              v-model="filters.search"
              placeholder="Search tenants..."
              @input="debouncedSearch"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select v-model="filters.status" :options="statusOptions" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Template</label>
            <Select v-model="filters.template_id" :options="templateOptions" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Actions</label>
            <div class="flex space-x-2">
              <Button @click="applyFilters" variant="primary" class="w-full">
                Apply Filters
              </Button>
              <Button @click="resetFilters" variant="outline">
                <XMarkIcon class="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Tenants"
          :value="statistics.total"
          icon="BuildingOfficeIcon"
          color="blue"
        />
        <StatCard
          title="Active"
          :value="statistics.active"
          icon="CheckCircleIcon"
          color="green"
        />
        <StatCard
          title="Provisioning"
          :value="statistics.provisioning"
          icon="PlayIcon"
          color="yellow"
        />
        <StatCard
          title="With Drift"
          :value="statistics.with_drift"
          icon="ExclamationTriangleIcon"
          color="red"
        />
      </div>

      <!-- Tenant Table -->
      <div class="bg-white shadow overflow-hidden sm:rounded-lg">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Database
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="tenant in tenants.data" :key="tenant.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <BuildingOfficeIcon class="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">
                        {{ tenant.name }}
                      </div>
                      <div class="text-sm text-gray-500">
                        {{ tenant.slug }} • {{ tenant.domain }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <Badge :color="tenant.status.color" size="sm">
                    {{ tenant.status.label }}
                  </Badge>
                  <div v-if="tenant.provisioning_error" class="mt-1 text-xs text-red-600">
                    {{ tenant.provisioning_error }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div v-if="tenant.template">
                    {{ tenant.template.name }}
                    <div class="text-xs text-gray-400">
                      v{{ tenant.template.version }}
                    </div>
                  </div>
                  <div v-else class="text-gray-400">No template</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <code class="text-xs bg-gray-100 px-2 py-1 rounded">{{ tenant.database }}</code>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(tenant.created_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Dropdown align="right" width="48">
                    <template #trigger>
                      <button class="text-gray-400 hover:text-gray-600">
                        <EllipsisVerticalIcon class="h-5 w-5" />
                      </button>
                    </template>
                    <template #content>
                      <DropdownLink :href="route('admin.tenants.show', tenant.id)" as="button">
                        <EyeIcon class="h-4 w-4 mr-2" />
                        View Details
                      </DropdownLink>
                      <DropdownLink :href="route('admin.tenants.edit', tenant.id)" as="button">
                        <PencilIcon class="h-4 w-4 mr-2" />
                        Edit
                      </DropdownLink>
                      <DropdownSeparator />
                      <DropdownItem
                        v-if="tenant.status.value === 'pending'"
                        @click="provisionTenant(tenant)"
                        class="text-green-600"
                      >
                        <PlayIcon class="h-4 w-4 mr-2" />
                        Provision
                      </DropdownItem>
                      <DropdownItem
                        v-if="tenant.status.value === 'completed'"
                        @click="syncTenant(tenant)"
                        class="text-yellow-600"
                      >
                        <ArrowPathIcon class="h-4 w-4 mr-2" />
                        Sync Schema
                      </DropdownItem>
                      <DropdownItem
                        v-if="tenant.status.value === 'completed'"
                        @click="detectDrift(tenant)"
                        class="text-orange-600"
                      >
                        <MagnifyingGlassIcon class="h-4 w-4 mr-2" />
                        Detect Drift
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem
                        @click="deleteTenant(tenant)"
                        class="text-red-600"
                      >
                        <TrashIcon class="h-4 w-4 mr-2" />
                        Delete
                      </DropdownItem>
                    </template>
                  </Dropdown>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="tenants.meta.last_page > 1" class="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <Pagination
            :meta="tenants.meta"
            @page-changed="changePage"
          />
        </div>

        <!-- Empty State -->
        <div v-if="tenants.data.length === 0" class="text-center py-12">
          <BuildingOfficeIcon class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900">No tenants</h3>
          <p class="mt-1 text-sm text-gray-500">
            Get started by creating a new tenant.
          </p>
          <div class="mt-6">
            <Button @click="showCreateModal = true" variant="primary">
              <PlusIcon class="h-5 w-5 mr-2" />
              New Tenant
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Tenant Modal -->
    <Modal :show="showCreateModal" @close="showCreateModal = false" max-width="5xl">
      <CreateTenantForm
        @created="handleTenantCreated"
        @cancel="showCreateModal = false"
      />
    </Modal>

    <!-- Provision Modal -->
    <Modal :show="showProvisionModal" @close="showProvisionModal = false">
      <div class="p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">
          Provision Tenant
        </h2>
        <p class="text-sm text-gray-600 mb-6">
          Are you sure you want to provision <strong>{{ selectedTenant?.name }}</strong>?
          This will create the tenant database and apply all migrations.
        </p>
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div class="flex">
            <ExclamationTriangleIcon class="h-5 w-5 text-yellow-400" />
            <div class="ml-3">
              <p class="text-sm text-yellow-700">
                This action cannot be undone. The tenant database will be created and configured.
              </p>
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end space-x-3">
          <Button @click="showProvisionModal = false" variant="outline">
            Cancel
          </Button>
          <Button @click="confirmProvision" variant="primary" :loading="provisioning">
            Start Provisioning
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Drift Detection Modal -->
    <Modal :show="showDriftModal" @close="showDriftModal = false" max-width="4xl">
      <div class="p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">
          Schema Drift Detection
        </h2>
        <div v-if="driftLoading" class="text-center py-8">
          <LoadingSpinner />
          <p class="mt-2 text-sm text-gray-500">Detecting schema drift...</p>
        </div>
        <div v-else-if="driftResult">
          <SchemaDriftViewer
            :drift="driftResult"
            :tenant="selectedTenant"
            @close="showDriftModal = false"
          />
        </div>
      </div>
    </Modal>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { debounce } from 'lodash'
import {
  BuildingOfficeIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckCircleIcon,
  PlayIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline'
import AdminLayout from '@/Layouts/AdminLayout.vue'
import Button from '@/Components/Button.vue'
import Input from '@/Components/Input.vue'
import Select from '@/Components/Select.vue'
import Badge from '@/Components/Badge.vue'
import StatCard from '@/Components/StatCard.vue'
import Dropdown from '@/Components/Dropdown.vue'
import DropdownLink from '@/Components/DropdownLink.vue'
import DropdownItem from '@/Components/DropdownItem.vue'
import DropdownSeparator from '@/Components/DropdownSeparator.vue'
import Modal from '@/Components/Modal.vue'
import Pagination from '@/Components/Pagination.vue'
import LoadingSpinner from '@/Components/LoadingSpinner.vue'
import CreateTenantForm from './Partials/CreateTenantForm.vue'
import SchemaDriftViewer from './Partials/SchemaDriftViewer.vue'
import TenantService from '@/Services/api/TenantService'
import NotificationService from '@/Services/NotificationService'

// State
const showCreateModal = ref(false)
const showProvisionModal = ref(false)
const showDriftModal = ref(false)
const selectedTenant = ref(null)
const provisioning = ref(false)
const driftLoading = ref(false)
const driftResult = ref(null)

// Filters
const filters = reactive({
  search: '',
  status: '',
  template_id: '',
  page: 1,
  per_page: 15,
})

// Data
const tenants = ref({
  data: [],
  meta: {},
})
const statistics = ref({
  total: 0,
  active: 0,
  provisioning: 0,
  with_drift: 0,
})
const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'active', label: 'Active' },
  { value: 'failed', label: 'Failed' },
]
const templateOptions = ref([])

// Methods
const loadTenants = async () => {
  try {
    const response = await TenantService.getTenants(filters)
    tenants.value = response.data
  } catch (error) {
    NotificationService.error('Failed to load tenants')
    console.error('Error loading tenants:', error)
  }
}

const loadStatistics = async () => {
  try {
    const response = await TenantService.getTenantStatistics()
    statistics.value = response.data
  } catch (error) {
    console.error('Error loading statistics:', error)
  }
}

const loadTemplates = async () => {
  try {
    const response = await TenantService.getTemplates({ per_page: 100 })
    templateOptions.value = [
      { value: '', label: 'All Templates' },
      ...response.data.data.map(template => ({
        value: template.id,
        label: template.name,
      }))
    ]
  } catch (error) {
    console.error('Error loading templates:', error)
  }
}

const refreshData = () => {
  loadTenants()
  loadStatistics()
}

const applyFilters = () => {
  filters.page = 1
  loadTenants()
}

const resetFilters = () => {
  filters.search = ''
  filters.status = ''
  filters.template_id = ''
  filters.page = 1
  loadTenants()
}

const changePage = (page) => {
  filters.page = page
  loadTenants()
}

const debouncedSearch = debounce(() => {
  filters.page = 1
  loadTenants()
}, 500)

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const provisionTenant = (tenant) => {
  selectedTenant.value = tenant
  showProvisionModal.value = true
}

const confirmProvision = async () => {
  if (!selectedTenant.value) return

  provisioning.value = true
  try {
    await TenantService.provisionTenant(selectedTenant.value.id, {
      strategy: 'standard',
      queue: true,
      notify_on_completion: true,
    })

    NotificationService.success('Tenant provisioning started')
    showProvisionModal.value = false
    refreshData()
  } catch (error) {
    NotificationService.error('Failed to start provisioning')
    console.error('Error provisioning tenant:', error)
  } finally {
    provisioning.value = false
  }
}

const syncTenant = async (tenant) => {
  try {
    await TenantService.syncTenant(tenant.id)
    NotificationService.success('Schema sync queued')
  } catch (error) {
    NotificationService.error('Failed to queue sync')
    console.error('Error syncing tenant:', error)
  }
}

const detectDrift = async (tenant) => {
  selectedTenant.value = tenant
  driftLoading.value = true
  showDriftModal.value = true

  try {
    const response = await TenantService.detectDrift(tenant.id)
    driftResult.value = response.data
  } catch (error) {
    NotificationService.error('Failed to detect drift')
    console.error('Error detecting drift:', error)
  } finally {
    driftLoading.value = false
  }
}

const deleteTenant = (tenant) => {
  if (!confirm(`Are you sure you want to delete ${tenant.name}?`)) {
    return
  }

  TenantService.deleteTenant(tenant.id)
    .then(() => {
      NotificationService.success('Tenant deleted successfully')
      refreshData()
    })
    .catch(error => {
      NotificationService.error('Failed to delete tenant')
      console.error('Error deleting tenant:', error)
    })
}

const handleTenantCreated = () => {
  showCreateModal.value = false
  refreshData()
}

// Lifecycle
onMounted(() => {
  loadTenants()
  loadStatistics()
  loadTemplates()
})

// Watch filters for changes
watch(() => filters.status, () => {
  if (filters.status !== '') {
    loadTenants()
  }
})

watch(() => filters.template_id, () => {
  if (filters.template_id !== '') {
    loadTenants()
  }
})
</script>
```

### **6.3 Tenant Creation Wizard Component**

**File: `resources/js/Pages/Admin/Tenants/Partials/CreateTenantForm.vue`**

```vue
<template>
  <div>
    <div class="px-6 py-4 border-b border-gray-200">
      <h2 class="text-lg font-medium text-gray-900">
        Create New Tenant
      </h2>
      <p class="mt-1 text-sm text-gray-600">
        Configure a new tenant with template-based provisioning
      </p>
    </div>

    <form @submit.prevent="submitForm">
      <!-- Wizard Steps -->
      <div class="px-6 py-4">
        <div class="mb-8">
          <nav class="flex items-center justify-center" aria-label="Progress">
            <ol class="flex items-center space-x-8">
              <li v-for="(step, index) in steps" :key="step.id">
                <button
                  type="button"
                  @click="currentStep = index"
                  class="flex items-center"
                  :class="{
                    'cursor-pointer': step.completed || index === currentStep,
                    'opacity-50': !step.completed && index !== currentStep
                  }"
                >
                  <span
                    class="relative flex h-8 w-8 items-center justify-center rounded-full border-2"
                    :class="[
                      step.completed ? 'border-green-600 bg-green-600' :
                      index === currentStep ? 'border-blue-600' :
                      'border-gray-300'
                    ]"
                  >
                    <span
                      v-if="step.completed"
                      class="h-5 w-5 text-white"
                    >
                      <CheckIcon />
                    </span>
                    <span
                      v-else
                      class="h-5 w-5"
                      :class="index === currentStep ? 'text-blue-600' : 'text-gray-500'"
                    >
                      {{ index + 1 }}
                    </span>
                  </span>
                  <span
                    class="ml-3 text-sm font-medium"
                    :class="[
                      step.completed ? 'text-green-600' :
                      index === currentStep ? 'text-blue-600' :
                      'text-gray-500'
                    ]"
                  >
                    {{ step.name }}
                  </span>
                </button>
              </li>
            </ol>
          </nav>
        </div>

        <!-- Step Content -->
        <div class="mt-6">
          <!-- Step 1: Template Selection -->
          <div v-if="currentStep === 0">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Select Template</h3>
            <p class="text-sm text-gray-600 mb-6">
              Choose a template that defines the base structure for your tenant.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                v-for="template in templates"
                :key="template.id"
                @click="selectTemplate(template)"
                class="border rounded-lg p-6 cursor-pointer transition-all duration-200"
                :class="[
                  selectedTemplate?.id === template.id
                    ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                ]"
              >
                <div class="flex items-start">
                  <div class="flex-shrink-0">
                    <DocumentDuplicateIcon
                      class="h-8 w-8"
                      :class="selectedTemplate?.id === template.id ? 'text-blue-600' : 'text-gray-400'"
                    />
                  </div>
                  <div class="ml-4">
                    <h4 class="text-lg font-medium text-gray-900">
                      {{ template.name }}
                      <span class="text-sm text-gray-500">v{{ template.version }}</span>
                    </h4>
                    <p class="mt-1 text-sm text-gray-600">
                      {{ template.description }}
                    </p>
                    <div class="mt-4">
                      <div class="flex items-center text-sm text-gray-500">
                        <CheckCircleIcon class="h-4 w-4 mr-1 text-green-500" />
                        <span>{{ template.required_modules?.length || 0 }} required modules</span>
                      </div>
                      <div class="mt-2">
                        <span
                          v-for="feature in template.features || []"
                          :key="feature"
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2 mb-2"
                        >
                          {{ feature }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="selectedTemplate" class="mt-8 p-4 bg-blue-50 rounded-lg">
              <h4 class="font-medium text-blue-900 mb-2">Selected Template: {{ selectedTemplate.name }}</h4>
              <p class="text-sm text-blue-700">{{ selectedTemplate.description }}</p>
              <div v-if="selectedTemplate.config?.nepali_context" class="mt-2 text-sm text-blue-700">
                <div class="flex items-center">
                  <FlagIcon class="h-4 w-4 mr-1" />
                  Includes Nepali context support
                </div>
              </div>
            </div>

            <div v-if="!templates.length" class="text-center py-12">
              <DocumentDuplicateIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-900">No templates available</h3>
              <p class="mt-1 text-sm text-gray-500">
                You need to create templates before creating tenants.
              </p>
            </div>
          </div>

          <!-- Step 2: Module Selection -->
          <div v-if="currentStep === 1">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Select Modules</h3>
            <p class="text-sm text-gray-600 mb-6">
              Choose additional modules to enable specific features for this tenant.
            </p>

            <div v-if="selectedTemplate">
              <!-- Required Modules -->
              <div class="mb-8">
                <h4 class="font-medium text-gray-900 mb-4">Required Modules</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    v-for="module in requiredModules"
                    :key="module.id"
                    class="border border-green-200 bg-green-50 rounded-lg p-4"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <h5 class="font-medium text-green-900">{{ module.display_name }}</h5>
                        <p class="text-sm text-green-700 mt-1">{{ module.description }}</p>
                      </div>
                      <Badge color="green" size="sm">Required</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Optional Modules -->
              <div>
                <h4 class="font-medium text-gray-900 mb-4">Optional Modules</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    v-for="module in optionalModules"
                    :key="module.id"
                    @click="toggleModule(module)"
                    class="border rounded-lg p-4 cursor-pointer transition-all duration-200"
                    :class="[
                      selectedModules.some(m => m.id === module.id)
                        ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    ]"
                  >
                    <div class="flex items-start justify-between">
                      <div>
                        <h5 class="font-medium text-gray-900">{{ module.display_name }}</h5>
                        <p class="text-sm text-gray-600 mt-1">{{ module.description }}</p>
                        <div class="mt-2">
                          <span class="text-xs text-gray-500">v{{ module.version }}</span>
                          <span
                            v-if="module.category"
                            class="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800"
                          >
                            {{ module.category }}
                          </span>
                        </div>
                      </div>
                      <CheckCircleIcon
                        v-if="selectedModules.some(m => m.id === module.id)"
                        class="h-5 w-5 text-blue-600"
                      />
                    </div>
                    <div v-if="module.dependencies?.length" class="mt-3 text-xs text-gray-500">
                      <div class="flex items-center">
                        <LinkIcon class="h-3 w-3 mr-1" />
                        Depends on: {{ module.dependencies.map(d => d.display_name).join(', ') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-12">
              <ExclamationTriangleIcon class="mx-auto h-12 w-12 text-yellow-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-900">Select a template first</h3>
              <p class="mt-1 text-sm text-gray-500">
                Please go back and select a template to see available modules.
              </p>
            </div>
          </div>

          <!-- Step 3: Configuration -->
          <div v-if="currentStep === 2">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Tenant Configuration</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Basic Information -->
              <div class="space-y-4">
                <h4 class="font-medium text-gray-900">Basic Information</h4>
                <Input
                  v-model="form.name"
                  label="Organization Name"
                  required
                  :error="errors.name"
                  placeholder="e.g., Nepali Congress Party"
                />
                <Input
                  v-model="form.slug"
                  label="URL Slug"
                  required
                  :error="errors.slug"
                  placeholder="e.g., nepali-congress"
                  helper-text="Used in URLs and database names"
                />
                <Input
                  v-model="form.domain"
                  label="Domain"
                  required
                  :error="errors.domain"
                  placeholder="e.g., nepali-congress.platform.local"
                />
                <Input
                  v-model="form.database"
                  label="Database Name"
                  required
                  :error="errors.database"
                  :helper-text="`Auto-generated: ${form.database}`"
                  readonly
                />
              </div>

              <!-- Nepali Context Settings -->
              <div class="space-y-4">
                <h4 class="font-medium text-gray-900">Nepali Context</h4>
                <Toggle
                  v-model="form.config.nepali_context"
                  label="Enable Nepali Context"
                  :disabled="!selectedTemplate?.config?.nepali_context"
                />
                <Toggle
                  v-model="form.config.election_commission_compliance"
                  label="Election Commission Compliance"
                  :disabled="!selectedTemplate?.config?.election_commission_compliance"
                />
                <Toggle
                  v-model="form.config.multi_language"
                  label="Multi-language Support"
                />
                <Select
                  v-model="form.config.default_language"
                  label="Default Language"
                  :options="[
                    { value: 'np', label: 'Nepali (नेपाली)' },
                    { value: 'en', label: 'English' },
                  ]"
                />
                <Toggle
                  v-model="form.config.citizenship_validation"
                  label="Citizenship Validation"
                />
              </div>
            </div>

            <!-- Additional Settings -->
            <div class="mt-8">
              <h4 class="font-medium text-gray-900 mb-4">Additional Settings</h4>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input
                  v-model="form.contact_email"
                  label="Contact Email"
                  type="email"
                  :error="errors.contact_email"
                />
                <Input
                  v-model="form.contact_phone"
                  label="Contact Phone"
                  :error="errors.contact_phone"
                />
                <Select
                  v-model="form.provisioning_strategy"
                  label="Provisioning Strategy"
                  :options="[
                    { value: 'standard', label: 'Standard (Recommended)' },
                    { value: 'minimal', label: 'Minimal Schema' },
                    { value: 'custom', label: 'Custom Configuration' },
                  ]"
                />
              </div>
            </div>
          </div>

          <!-- Step 4: Review -->
          <div v-if="currentStep === 3">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Review & Confirm</h3>

            <div class="bg-gray-50 rounded-lg p-6 mb-6">
              <h4 class="font-medium text-gray-900 mb-4">Provisioning Summary</h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 class="text-sm font-medium text-gray-700 mb-2">Tenant Details</h5>
                  <dl class="space-y-2">
                    <div class="flex justify-between">
                      <dt class="text-sm text-gray-600">Name:</dt>
                      <dd class="text-sm font-medium text-gray-900">{{ form.name }}</dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-sm text-gray-600">Slug:</dt>
                      <dd class="text-sm font-medium text-gray-900">{{ form.slug }}</dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-sm text-gray-600">Domain:</dt>
                      <dd class="text-sm font-medium text-gray-900">{{ form.domain }}</dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-sm text-gray-600">Database:</dt>
                      <dd class="text-sm font-medium text-gray-900">
                        <code class="text-xs">{{ form.database }}</code>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h5 class="text-sm font-medium text-gray-700 mb-2">Template & Modules</h5>
                  <dl class="space-y-2">
                    <div class="flex justify-between">
                      <dt class="text-sm text-gray-600">Template:</dt>
                      <dd class="text-sm font-medium text-gray-900">{{ selectedTemplate?.name }}</dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-sm text-gray-600">Total Modules:</dt>
                      <dd class="text-sm font-medium text-gray-900">
                        {{ requiredModules.length + selectedModules.length }}
                      </dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-sm text-gray-600">Required:</dt>
                      <dd class="text-sm font-medium text-gray-900">{{ requiredModules.length }}</dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-sm text-gray-600">Optional:</dt>
                      <dd class="text-sm font-medium text-gray-900">{{ selectedModules.length }}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <!-- Selected Modules List -->
              <div class="mt-6">
                <h5 class="text-sm font-medium text-gray-700 mb-2">Selected Modules</h5>
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="module in requiredModules"
                    :key="module.id"
                    color="green"
                  >
                    {{ module.display_name }} (Required)
                  </Badge>
                  <Badge
                    v-for="module in selectedModules"
                    :key="module.id"
                    color="blue"
                  >
                    {{ module.display_name }}
                  </Badge>
                </div>
              </div>
            </div>

            <!-- Confirmation -->
            <div class="space-y-4">
              <Toggle
                v-model="form.auto_provision"
                label="Auto-provision after creation"
                helper-text="Automatically start provisioning after saving"
              />
              <Toggle
                v-model="form.confirm_terms"
                label="I confirm that I want to create this tenant with the selected configuration."
                required
                :error="errors.confirm_terms"
              />
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="mt-8 flex justify-between">
          <Button
            v-if="currentStep > 0"
            @click="prevStep"
            variant="outline"
          >
            Previous
          </Button>
          <div v-else></div>

          <div class="flex space-x-3">
            <Button
              v-if="currentStep < steps.length - 1"
              @click="nextStep"
              variant="primary"
              :disabled="!canProceedToNextStep"
            >
              Next
            </Button>
            <Button
              v-else
              type="submit"
              variant="primary"
              :loading="submitting"
              :disabled="!form.confirm_terms"
            >
              Create Tenant
            </Button>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import {
  DocumentDuplicateIcon,
  CheckIcon,
  CheckCircleIcon,
  FlagIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import Button from '@/Components/Button.vue'
import Input from '@/Components/Input.vue'
import Select from '@/Components/Select.vue'
import Toggle from '@/Components/Toggle.vue'
import Badge from '@/Components/Badge.vue'
import TenantService from '@/Services/api/TenantService'
import NotificationService from '@/Services/NotificationService'

const emit = defineEmits(['created', 'cancel'])

// State
const currentStep = ref(0)
const submitting = ref(false)
const templates = ref([])
const allModules = ref([])
const selectedTemplate = ref(null)
const selectedModules = ref([])

// Form
const form = reactive({
  name: '',
  slug: '',
  domain: '',
  database: '',
  template_id: null,
  modules: [],
  config: {
    nepali_context: true,
    election_commission_compliance: true,
    multi_language: true,
    default_language: 'np',
    citizenship_validation: true,
  },
  contact_email: '',
  contact_phone: '',
  provisioning_strategy: 'standard',
  auto_provision: false,
  confirm_terms: false,
})

const errors = reactive({})

// Steps
const steps = ref([
  { id: 'template', name: 'Template', completed: false },
  { id: 'modules', name: 'Modules', completed: false },
  { id: 'configuration', name: 'Configuration', completed: false },
  { id: 'review', name: 'Review', completed: false },
])

// Computed
const requiredModules = computed(() => {
  if (!selectedTemplate.value) return []
  return selectedTemplate.value.required_modules || []
})

const optionalModules = computed(() => {
  if (!selectedTemplate.value) return []
  const requiredIds = requiredModules.value.map(m => m.id)
  return allModules.value.filter(module => 
    !requiredIds.includes(module.id) &&
    module.is_active
  )
})

const canProceedToNextStep = computed(() => {
  switch (currentStep.value) {
    case 0:
      return selectedTemplate.value !== null
    case 1:
      return true // Modules are optional
    case 2:
      return form.name && form.slug && form.domain
    case 3:
      return form.confirm_terms
    default:
      return true
  }
})

// Methods
const loadTemplates = async () => {
  try {
    const response = await TenantService.getTemplates({ 
      is_active: true,
      per_page: 50 
    })
    templates.value = response.data.data
  } catch (error) {
    console.error('Error loading templates:', error)
    NotificationService.error('Failed to load templates')
  }
}

const loadModules = async () => {
  try {
    const response = await TenantService.getModules({ 
      is_active: true,
      per_page: 100 
    })
    allModules.value = response.data.data
  } catch (error) {
    console.error('Error loading modules:', error)
    NotificationService.error('Failed to load modules')
  }
}

const selectTemplate = (template) => {
  selectedTemplate.value = template
  form.template_id = template.id
  
  // Auto-select required modules
  selectedModules.value = template.required_modules || []
  
  // Generate database name
  if (!form.database) {
    form.database = `tenant_${form.slug || template.slug}_${Date.now().toString(36)}`
  }
  
  // Update steps
  steps.value[0].completed = true
}

const toggleModule = (module) => {
  const index = selectedModules.value.findIndex(m => m.id === module.id)
  if (index === -1) {
    selectedModules.value.push(module)
  } else {
    selectedModules.value.splice(index, 1)
  }
}

const nextStep = () => {
  if (currentStep.value < steps.length - 1) {
    steps.value[currentStep.value].completed = true
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const submitForm = async () => {
  submitting.value = true
  errors.value = {}

  // Prepare form data
  const formData = {
    ...form,
    modules: [
      ...requiredModules.value.map(m => m.id),
      ...selectedModules.value.map(m => m.id)
    ]
  }

  try {
    const response = await TenantService.createTenant(formData)
    
    NotificationService.success('Tenant created successfully')
    
    // Auto-provision if selected
    if (form.auto_provision) {
      await TenantService.provisionTenant(response.data.id, {
        strategy: form.provisioning_strategy,
        queue: true,
        notify_on_completion: true,
      })
      NotificationService.success('Tenant provisioning started')
    }
    
    emit('created')
    
  } catch (error) {
    if (error.response?.status === 422) {
      // Validation errors
      errors.value = error.response.data.errors || {}
      NotificationService.error('Please fix the validation errors')
    } else {
      NotificationService.error('Failed to create tenant')
      console.error('Error creating tenant:', error)
    }
  } finally {
    submitting.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadTemplates()
  loadModules()
})

// Watch for slug changes to generate database name
watch(() => form.slug, (newSlug) => {
  if (newSlug && !form.database) {
    form.database = `tenant_${newSlug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  }
})

// Watch for template selection to update modules
watch(() => form.template_id, (newTemplateId) => {
  if (newTemplateId) {
    const template = templates.value.find(t => t.id === newTemplateId)
    if (template) {
      selectedTemplate.value = template
      selectedModules.value = template.required_modules || []
    }
  }
})
</script>
```

## **7. INERTIA.JS ROUTE CONFIGURATION**

**File: `routes/web.php`**

```php
<?php

use App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Controllers\Web\TenantController;
use App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Controllers\Web\TemplateController;
use App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Controllers\Web\ModuleController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'verified'])->group(function () {
    // Admin Dashboard
    Route::get('/admin/dashboard', function () {
        return Inertia::render('Admin/Dashboard');
    })->name('admin.dashboard');
    
    // Tenant Management
    Route::prefix('admin/tenants')->name('admin.tenants.')->group(function () {
        Route::get('/', [TenantController::class, 'index'])->name('index');
        Route::get('/create', [TenantController::class, 'create'])->name('create');
        Route::get('/{tenant}', [TenantController::class, 'show'])->name('show');
        Route::get('/{tenant}/edit', [TenantController::class, 'edit'])->name('edit');
    });
    
    // Template Management
    Route::prefix('admin/templates')->name('admin.templates.')->group(function () {
        Route::get('/', [TemplateController::class, 'index'])->name('index');
        Route::get('/create', [TemplateController::class, 'create'])->name('create');
        Route::get('/{template}', [TemplateController::class, 'show'])->name('show');
        Route::get('/{template}/edit', [TemplateController::class, 'edit'])->name('edit');
    });
    
    // Module Management
    Route::prefix('admin/modules')->name('admin.modules.')->group(function () {
        Route::get('/', [ModuleController::class, 'index'])->name('index');
        Route::get('/create', [ModuleController::class, 'create'])->name('create');
        Route::get('/{module}', [ModuleController::class, 'show'])->name('show');
        Route::get('/{module}/edit', [ModuleController::class, 'edit'])->name('edit');
    });
    
    // Provisioning Queue
    Route::get('/admin/provisioning-queue', function () {
        return Inertia::render('Admin/ProvisioningQueue/Index');
    })->name('admin.provisioning-queue.index');
});
```

**File: `routes/api.php`**

```php
<?php

use App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Controllers\Api\TenantController;
use App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Controllers\Api\TemplateController;
use App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Controllers\Api\ModuleController;
use App\Infrastructure\Platform\Admin\Contexts\SchemaManagement\Controllers\Api\SchemaController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // Public routes
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/register', [AuthController::class, 'register']);
    
    // Protected routes
    Route::middleware(['auth:sanctum'])->group(function () {
        // Admin routes
        Route::prefix('admin')->middleware(['can:access_admin'])->group(function () {
            // Tenants
            Route::apiResource('tenants', TenantController::class);
            Route::post('tenants/{tenant}/provision', [TenantController::class, 'provision']);
            Route::post('tenants/{tenant}/sync', [TenantController::class, 'sync']);
            Route::get('tenants/{tenant}/drift', [TenantController::class, 'detectDrift']);
            Route::get('tenants/{tenant}/status', [TenantController::class, 'status']);
            Route::get('tenants/statistics', [TenantController::class, 'statistics']);
            
            // Templates
            Route::apiResource('templates', TemplateController::class);
            Route::post('templates/{template}/create-version', [TemplateController::class, 'createVersion']);
            Route::post('templates/{template}/duplicate', [TemplateController::class, 'duplicate']);
            
            // Modules
            Route::apiResource('modules', ModuleController::class);
            
            // Schema Management
            Route::prefix('schema')->group(function () {
                Route::get('snapshots/{tenant}', [SchemaController::class, 'snapshots']);
                Route::post('snapshots/{tenant}', [SchemaController::class, 'createSnapshot']);
                Route::get('snapshots/{snapshot}/compare/{otherSnapshot}', [SchemaController::class, 'compare']);
            });
            
            // Provisioning Queue
            Route::prefix('provisioning-queue')->group(function () {
                Route::get('/', [ProvisioningQueueController::class, 'index']);
                Route::get('{job}', [ProvisioningQueueController::class, 'show']);
                Route::post('{job}/retry', [ProvisioningQueueController::class, 'retry']);
                Route::delete('{job}', [ProvisioningQueueController::class, 'cancel']);
                Route::get('statistics', [ProvisioningQueueController::class, 'statistics']);
            });
        });
        
        // Tenant-specific routes (scoped by tenant)
        Route::prefix('tenant/{tenant}')->middleware(['tenant.exists', 'tenant.active'])->group(function () {
            // Tenant dashboard
            Route::get('/dashboard', [TenantDashboardController::class, 'index']);
            
            // Tenant-specific resources
            Route::apiResource('members', MemberController::class);
            Route::apiResource('committees', CommitteeController::class);
            Route::apiResource('donations', DonationController::class);
            Route::apiResource('financial-reports', FinancialReportController::class);
            
            // Election Campaign module
            Route::prefix('election-campaign')->group(function () {
                Route::apiResource('campaigns', CampaignController::class);
                Route::apiResource('candidates', CandidateController::class);
                Route::apiResource('voting-stations', VotingStationController::class);
            });
        });
    });
});
```

## **8. SERVICE PROVIDER FOR INFRASTRUCTURE**

**File: `app/Providers/InfrastructureServiceProvider.php`**

```php
<?php

namespace App\Providers;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Repositories\TenantRepositoryInterface;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories\TemplateRepositoryInterface;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\Repositories\ModuleRepositoryInterface;
use App\Domain\Platform\Admin\Contexts\SchemaManagement\Repositories\SchemaSnapshotRepositoryInterface;
use App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Repositories\EloquentTenantRepository;
use App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Repositories\EloquentTemplateRepository;
use App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Repositories\EloquentModuleRepository;
use App\Infrastructure\Platform\Admin\Contexts\SchemaManagement\Repositories\EloquentSchemaSnapshotRepository;
use Illuminate\Support\ServiceProvider;

class InfrastructureServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Bind repository interfaces to infrastructure implementations
        $this->app->bind(
            TenantRepositoryInterface::class,
            EloquentTenantRepository::class
        );
        
        $this->app->bind(
            TemplateRepositoryInterface::class,
            EloquentTemplateRepository::class
        );
        
        $this->app->bind(
            ModuleRepositoryInterface::class,
            EloquentModuleRepository::class
        );
        
        $this->app->bind(
            SchemaSnapshotRepositoryInterface::class,
            EloquentSchemaSnapshotRepository::class
        );
        
        // Bind domain services
        $this->app->bind(
            \App\Domain\Platform\Admin\Contexts\TenantManagement\Services\TenantProvisioningService::class,
            function ($app) {
                return new \App\Domain\Platform\Admin\Contexts\TenantManagement\Services\TenantProvisioningService(
                    $app->make(TenantRepositoryInterface::class),
                    $app->make(\App\Domain\Platform\Admin\Contexts\TenantManagement\Specifications\TenantCanBeProvisionedSpecification::class),
                    $app->make(\App\Domain\Platform\Shared\Events\DomainEventDispatcher::class)
                );
            }
        );
        
        // Bind API controllers
        $this->app->bind(
            \App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Controllers\Api\TenantController::class,
            function ($app) {
                return new \App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Controllers\Api\TenantController(
                    $app->make(TenantRepositoryInterface::class),
                    $app->make(\App\Domain\Platform\Admin\Contexts\TenantManagement\Services\TenantProvisioningService::class),
                    $app->make(\App\Domain\Platform\Admin\Contexts\TenantManagement\Specifications\TenantCanBeProvisionedSpecification::class)
                );
            }
        );
    }
    
    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Publish API documentation
        $this->publishes([
            __DIR__ . '/../../resources/openapi.yaml' => resource_path('openapi.yaml'),
        ], 'api-docs');
        
        // Register API response macros
        $this->registerResponseMacros();
    }
    
    /**
     * Register response macros for API.
     */
    protected function registerResponseMacros(): void
    {
        \Illuminate\Routing\ResponseFactory::macro('api', function ($data = null, $status = 200, array $headers = []) {
            $response = [
                'success' => $status >= 200 && $status < 300,
                'data' => $data,
                'timestamp' => now()->toISOString(),
                'version' => config('app.version', '1.0.0'),
            ];
            
            return response()->json($response, $status, $headers);
        });
        
        \Illuminate\Routing\ResponseFactory::macro('apiError', function ($message, $status = 400, $errors = null) {
            $response = [
                'success' => false,
                'message' => $message,
                'errors' => $errors,
                'timestamp' => now()->toISOString(),
            ];
            
            return response()->json($response, $status);
        });
        
        \Illuminate\Routing\ResponseFactory::macro('apiPaginated', function ($paginator, $status = 200) {
            $response = [
                'success' => true,
                'data' => $paginator->items(),
                'meta' => [
                    'total' => $paginator->total(),
                    'per_page' => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
                'links' => [
                    'first' => $paginator->url(1),
                    'last' => $paginator->url($paginator->lastPage()),
                    'prev' => $paginator->previousPageUrl(),
                    'next' => $paginator->nextPageUrl(),
                ],
                'timestamp' => now()->toISOString(),
            ];
            
            return response()->json($response, $status);
        });
    }
}
```

## **9. VITE CONFIGURATION FOR VUE3**

**File: `vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/js/app.js',
                'resources/css/app.css',
            ],
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
            '@Components': path.resolve(__dirname, 'resources/js/Components'),
            '@Layouts': path.resolve(__dirname, 'resources/js/Layouts'),
            '@Pages': path.resolve(__dirname, 'resources/js/Pages'),
            '@Services': path.resolve(__dirname, 'resources/js/Services'),
            '@Stores': path.resolve(__dirname, 'resources/js/Stores'),
            '@Types': path.resolve(__dirname, 'resources/js/Types'),
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        hmr: {
            host: 'localhost',
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor': ['vue', '@inertiajs/vue3', 'axios'],
                    'ui': ['@headlessui/vue', '@heroicons/vue'],
                    'utils': ['lodash', 'dayjs'],
                },
            },
        },
    },
});
```

## **10. ENVIRONMENT CONFIGURATION**

**File: `.env`**

```env
APP_NAME="Nepali Political Party Platform"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
APP_TIMEZONE=Asia/Kathmandu

# API Configuration
API_PREFIX=v1
API_VERSION=1.0.0
API_RATE_LIMIT=60
API_RATE_LIMIT_PER_MINUTE=60

# Database Configuration (Landlord)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=platform_landlord
DB_USERNAME=root
DB_PASSWORD=

# Tenant Database Configuration
TENANT_DB_PREFIX=tenant_
TENANT_DB_CONNECTION=tenant
TENANT_DB_HOST=127.0.0.1
TENANT_DB_PORT=3306
TENANT_DB_USERNAME=root
TENANT_DB_PASSWORD=

# Multi-tenancy
TENANCY_MODEL=\App\Models\Tenant
TENANCY_DATABASE_CONNECTION=tenant
TENANCY_ROUTE_PREFIX={tenant}
TENANCY_SUBDOMAIN_WILDCARD=true

# Cache
CACHE_DRIVER=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Queue
QUEUE_CONNECTION=redis
QUEUE_DEFAULT=default
QUEUE_TENANT_PROVISIONING=tenant-provisioning

# Session
SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_ENCRYPT=false

# Sanctum
SANCTUM_STATEFUL_DOMAINS=localhost,127.0.0.1
SANCTUM_TOKEN_EXPIRATION=525600

# Inertia
INERTIA_SSR_ENABLED=false
INERTIA_SSR_URL=http://127.0.0.1:13714

# Nepali Context
NEPALI_CONTEXT_ENABLED=true
DEFAULT_LANGUAGE=np
SUPPORTED_LANGUAGES=en,np
DATE_FORMAT_BS=true

# Election Commission Compliance
EC_REPORTING_ENABLED=true
EC_DONATION_LIMIT_INDIVIDUAL=1000000
EC_DONATION_LIMIT_ORGANIZATION=5000000
EC_FISCAL_YEAR_START=shrawan
```

## **KEY FEATURES OF THIS IMPLEMENTATION**

### **1. Clean Infrastructure Layer:**
- Repository implementations with proper mapping
- API controllers with OpenAPI documentation
- Form requests for validation
- API resources for serialization

### **2. Modern Frontend Architecture:**
- Vue3 Composition API with TypeScript support
- Inertia.js for SPA-like experience
- Component-based architecture
- Service layer for API calls
- Reactive state management

### **3. API-First Design:**
- RESTful API with proper HTTP verbs
- JSON:API-like response structure
- Comprehensive error handling
- Rate limiting and security

### **4. DDD Principles Maintained:**
- Infrastructure layer depends on Domain layer
- Repository pattern for data access
- Domain events for side effects
- Value objects for validation

### **5. Nepali Context Integration:**
- Multi-language support (Nepali/English)
- Citizenship validation
- Election Commission compliance
- Province/District/Ward structure

### **6. Scalability Features:**
- Queue-based provisioning
- Redis caching
- Database connection pooling
- Tenant isolation at database level

## **NEXT STEPS**

1. **Implement remaining repositories** for Template and Module contexts
2. **Add WebSocket support** for real-time provisioning updates
3. **Implement comprehensive testing** for both backend and frontend
4. **Add API documentation** with Swagger/OpenAPI
5. **Implement monitoring** with health checks
6. **Add audit logging** for compliance
7. **Implement backup/restore** functionality
8. **Add multi-tenant analytics** dashboard

Would you like me to implement any specific part in more detail, or should we proceed with the **WebSocket implementation for real-time updates**?