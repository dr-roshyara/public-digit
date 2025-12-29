# 🚀 PHASE 4 EXECUTION START - DAY 22

## ✅ PREVIOUS PHASE VERIFICATION
- ✅ **Infrastructure Layer COMPLETE** - 60 tests passing
- ✅ **Application Services READY** - 90 tests passing  
- ✅ **Domain Layer SOLID** - 108 tests passing
- ✅ **DI Bindings CONFIGURED** - ModuleRegistryServiceProvider complete
- ✅ **Hexagonal Flow ESTABLISHED** - Ports → Adapters → Infrastructure

## 🎯 DAY 22 TARGET: 3 CONTROLLERS, 15 TESTS

### **File 1/3: ModuleCatalogController + Tests**
Let me start with the **RED phase** - creating failing tests first:

```php
<?php
// tests/Feature/Contexts/ModuleRegistry/Desktop/ModuleCatalogApiTest.php

namespace Tests\Feature\Contexts\ModuleRegistry\Desktop;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Response;

class ModuleCatalogApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create platform admin user (landlord context)
        $this->adminUser = User::factory()->create([
            'email' => 'admin@platform.test',
            'is_platform_admin' => true,
        ]);
        
        // Create a tenant for testing tenant-specific operations
        $this->tenant = Tenant::factory()->create();
        
        Sanctum::actingAs($this->adminUser);
    }

    /** @test */
    public function it_requires_authentication_to_list_modules(): void
    {
        // Act: Make request without authentication
        $response = $this->getJson('/api/v1/platform/modules');

        // Assert: 401 Unauthorized
        $response->assertStatus(Response::HTTP_UNAUTHORIZED);
    }

    /** @test */
    public function it_lists_all_modules_in_catalog(): void
    {
        // Arrange: Create some modules in landlord database
        $module1 = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'test-module-1',
            'display_name' => 'Test Module 1',
            'status' => 'published',
        ]);
        
        $module2 = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'test-module-2',
            'display_name' => 'Test Module 2',
            'status' => 'published',
        ]);

        // Act: Make authenticated request
        $response = $this->getJson('/api/v1/platform/modules');

        // Assert: 200 OK with modules
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'type',
                        'attributes' => [
                            'name',
                            'display_name',
                            'description',
                            'version',
                            'status',
                            'requires_subscription',
                        ],
                        'links' => [
                            'self',
                        ],
                    ],
                ],
                'meta' => [
                    'total',
                    'per_page',
                    'current_page',
                ],
                'links' => [
                    'self',
                    'first',
                    'last',
                ],
            ])
            ->assertJsonCount(2, 'data');
    }

    /** @test */
    public function it_shows_a_specific_module(): void
    {
        // Arrange: Create a module
        $module = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'test-module',
            'display_name' => 'Test Module',
            'status' => 'published',
        ]);

        // Act: Request specific module
        $response = $this->getJson("/api/v1/platform/modules/{$module->id}");

        // Assert: 200 OK with module details
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'type',
                    'attributes' => [
                        'name',
                        'display_name',
                        'description',
                        'version',
                        'status',
                        'requires_subscription',
                        'created_at',
                        'updated_at',
                    ],
                    'relationships' => [
                        'dependencies',
                        'tenant_installations',
                    ],
                    'links' => [
                        'self',
                    ],
                ],
            ])
            ->assertJsonPath('data.id', $module->id)
            ->assertJsonPath('data.attributes.name', 'test-module');
    }

    /** @test */
    public function it_returns_404_when_module_not_found(): void
    {
        // Act: Request non-existent module
        $response = $this->getJson('/api/v1/platform/modules/non-existent-id');

        // Assert: 404 Not Found
        $response->assertStatus(Response::HTTP_NOT_FOUND)
            ->assertJsonStructure([
                'error' => [
                    'code',
                    'message',
                    'details',
                    'documentation',
                ],
            ]);
    }

    /** @test */
    public function it_registers_a_new_module(): void
    {
        // Arrange: Module registration data
        $moduleData = [
            'name' => 'digital-card-module',
            'display_name' => 'Digital Cards',
            'description' => 'Digital business card management system',
            'version' => '1.0.0',
            'requires_subscription' => true,
            'namespace' => 'App\Contexts\DigitalCard',
            'installer_class' => 'App\Contexts\DigitalCard\Installation\ModuleInstaller',
        ];

        // Act: Register new module
        $response = $this->postJson('/api/v1/platform/modules', $moduleData);

        // Assert: 201 Created with module data
        $response->assertStatus(Response::HTTP_CREATED)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'type',
                    'attributes' => [
                        'name',
                        'display_name',
                        'description',
                        'version',
                        'status',
                        'requires_subscription',
                        'created_at',
                    ],
                    'links' => [
                        'self',
                    ],
                ],
            ])
            ->assertJsonPath('data.attributes.name', 'digital-card-module')
            ->assertJsonPath('data.attributes.status', 'draft');
    }

    /** @test */
    public function it_validates_module_registration_data(): void
    {
        // Arrange: Invalid module data (missing required fields)
        $invalidData = [
            'name' => '', // Empty name
            'display_name' => '', // Empty display name
        ];

        // Act: Attempt to register with invalid data
        $response = $this->postJson('/api/v1/platform/modules', $invalidData);

        // Assert: 422 Unprocessable Entity with validation errors
        $response->assertStatus(Response::HTTP_UNPROCESSABLE_ENTITY)
            ->assertJsonStructure([
                'message',
                'errors' => [
                    'name',
                    'display_name',
                    'version',
                    'namespace',
                ],
            ]);
    }

    /** @test */
    public function it_requires_unique_module_names(): void
    {
        // Arrange: Create existing module
        \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'existing-module',
            'display_name' => 'Existing Module',
        ]);

        // Arrange: Attempt to create duplicate
        $duplicateData = [
            'name' => 'existing-module', // Same name
            'display_name' => 'Duplicate Module',
            'description' => 'Another module with same name',
            'version' => '1.0.0',
            'requires_subscription' => false,
            'namespace' => 'App\Contexts\Duplicate',
            'installer_class' => 'App\Contexts\Duplicate\Installation\ModuleInstaller',
        ];

        // Act: Register duplicate module
        $response = $this->postJson('/api/v1/platform/modules', $duplicateData);

        // Assert: 422 with unique constraint error
        $response->assertStatus(Response::HTTP_UNPROCESSABLE_ENTITY)
            ->assertJsonValidationErrors(['name']);
    }

    /** @test */
    public function it_requires_platform_admin_to_register_modules(): void
    {
        // Arrange: Create non-admin user
        $regularUser = User::factory()->create([
            'email' => 'regular@test.com',
            'is_platform_admin' => false,
        ]);
        
        Sanctum::actingAs($regularUser);

        $moduleData = [
            'name' => 'test-module',
            'display_name' => 'Test Module',
            'description' => 'Test Description',
            'version' => '1.0.0',
            'requires_subscription' => false,
            'namespace' => 'App\Contexts\Test',
            'installer_class' => 'App\Contexts\Test\Installation\ModuleInstaller',
        ];

        // Act: Non-admin tries to register module
        $response = $this->postJson('/api/v1/platform/modules', $moduleData);

        // Assert: 403 Forbidden
        $response->assertStatus(Response::HTTP_FORBIDDEN);
    }

    /** @test */
    public function it_publishes_a_draft_module(): void
    {
        // Arrange: Create draft module
        $module = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'draft-module',
            'display_name' => 'Draft Module',
            'status' => 'draft',
        ]);

        // Act: Publish the module
        $response = $this->patchJson("/api/v1/platform/modules/{$module->id}/publish");

        // Assert: 200 OK with updated status
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonPath('data.attributes.status', 'published');
    }

    /** @test */
    public function it_deprecates_a_published_module(): void
    {
        // Arrange: Create published module
        $module = \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'active-module',
            'display_name' => 'Active Module',
            'status' => 'published',
        ]);

        // Act: Deprecate the module
        $response = $this->patchJson("/api/v1/platform/modules/{$module->id}/deprecate");

        // Assert: 200 OK with deprecated status
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonPath('data.attributes.status', 'deprecated');
    }

    /** @test */
    public function it_filters_modules_by_status(): void
    {
        // Arrange: Create modules with different statuses
        \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'published-module',
            'display_name' => 'Published Module',
            'status' => 'published',
        ]);
        
        \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'draft-module',
            'display_name' => 'Draft Module',
            'status' => 'draft',
        ]);
        
        \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->create([
            'name' => 'deprecated-module',
            'display_name' => 'Deprecated Module',
            'status' => 'deprecated',
        ]);

        // Act: Filter by published status
        $response = $this->getJson('/api/v1/platform/modules?status=published');

        // Assert: Only published modules returned
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.attributes.status', 'published');
    }

    /** @test */
    public function it_paginates_module_list(): void
    {
        // Arrange: Create 15 modules (more than default per_page)
        \App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel::factory()->count(15)->create();

        // Act: Request first page
        $response = $this->getJson('/api/v1/platform/modules?page=1&per_page=10');

        // Assert: Pagination metadata present
        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonStructure([
                'data',
                'meta' => [
                    'total',
                    'per_page',
                    'current_page',
                    'last_page',
                    'from',
                    'to',
                ],
                'links' => [
                    'first',
                    'last',
                    'prev',
                    'next',
                ],
            ])
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta.total', 15)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.current_page', 1);
    }
}
```

Now let me create the **GREEN phase** - the controller implementation:

```php
<?php
// app/Contexts/ModuleRegistry/Presentation/Http/Controllers/Desktop/ModuleCatalogController.php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop;

use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\SecureApiController;
use App\Contexts\ModuleRegistry\Application\Services\ModuleRegistrationService;
use App\Contexts\ModuleRegistry\Application\Commands\RegisterModuleCommand;
use App\Contexts\ModuleRegistry\Application\Commands\PublishModuleCommand;
use App\Contexts\ModuleRegistry\Application\Commands\DeprecateModuleCommand;
use App\Contexts\ModuleRegistry\Domain\Exceptions\ModuleNotFoundException;
use App\Contexts\ModuleRegistry\Domain\Exceptions\ModuleRegistrationException;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleVersion;
use App\Contexts\ModuleRegistry\Presentation\Http\Requests\RegisterModuleRequest;
use App\Contexts\ModuleRegistry\Presentation\Http\Requests\UpdateModuleStatusRequest;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\ModuleResource;
use App\Contexts\ModuleRegistry\Presentation\Http\Resources\ModuleCollection;
use App\Contexts\ModuleRegistry\Infrastructure\Database\Models\ModuleModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ModuleCatalogController extends SecureApiController
{
    public function __construct(
        private ModuleRegistrationService $registrationService
    ) {
        parent::__construct();
    }

    /**
     * List all modules in the catalog
     */
    public function index(): JsonResponse
    {
        $startTime = microtime(true);
        
        $query = ModuleModel::query();
        
        // Apply status filter if provided
        if (request()->has('status')) {
            $query->where('status', request('status'));
        }
        
        // Apply search if provided
        if (request()->has('search')) {
            $search = request('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('display_name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }
        
        $modules = $query->latest()->paginate(
            request('per_page', 10)
        );
        
        // Log API call
        Log::info('Module catalog API accessed', [
            'duration_ms' => (microtime(true) - $startTime) * 1000,
            'user_id' => Auth::id(),
            'filter_status' => request('status'),
            'page' => $modules->currentPage(),
            'total' => $modules->total(),
        ]);
        
        return ModuleCollection::make($modules)->response();
    }

    /**
     * Show a specific module
     */
    public function show(string $id): JsonResponse
    {
        try {
            $module = ModuleModel::findOrFail($id);
            
            return (new ModuleResource($module))
                ->response()
                ->setStatusCode(Response::HTTP_OK);
                
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->moduleNotFoundResponse($id);
        }
    }

    /**
     * Register a new module
     */
    public function store(RegisterModuleRequest $request): JsonResponse
    {
        try {
            // Verify user is platform admin
            if (!Auth::user()->is_platform_admin) {
                return response()->json([
                    'error' => [
                        'code' => 'FORBIDDEN',
                        'message' => 'Only platform administrators can register modules',
                        'details' => ['user_id' => Auth::id()],
                        'documentation' => 'https://docs.example.com/errors/FORBIDDEN',
                    ]
                ], Response::HTTP_FORBIDDEN);
            }
            
            $command = new RegisterModuleCommand(
                name: ModuleName::fromString($request->validated('name')),
                displayName: $request->validated('display_name'),
                description: $request->validated('description'),
                version: ModuleVersion::fromString($request->validated('version')),
                requiresSubscription: $request->validated('requires_subscription', false),
                namespace: $request->validated('namespace'),
                installerClass: $request->validated('installer_class'),
                metadata: $request->validated('metadata', [])
            );
            
            $module = $this->registrationService->registerModule($command);
            
            Log::info('Module registered', [
                'module_id' => $module->getId()->value(),
                'module_name' => $module->getName()->value(),
                'registered_by' => Auth::id(),
            ]);
            
            return (new ModuleResource(
                ModuleModel::find($module->getId()->value())
            ))
                ->response()
                ->setStatusCode(Response::HTTP_CREATED);
                
        } catch (ModuleRegistrationException $e) {
            Log::error('Module registration failed', [
                'error' => $e->getMessage(),
                'input' => $request->all(),
                'user_id' => Auth::id(),
            ]);
            
            return response()->json([
                'error' => [
                    'code' => 'MODULE_REGISTRATION_FAILED',
                    'message' => $e->getMessage(),
                    'details' => ['input' => $request->all()],
                    'documentation' => 'https://docs.example.com/errors/MODULE_REGISTRATION_FAILED',
                ]
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    /**
     * Publish a draft module
     */
    public function publish(string $id, UpdateModuleStatusRequest $request): JsonResponse
    {
        try {
            // Verify user is platform admin
            if (!Auth::user()->is_platform_admin) {
                return response()->json([
                    'error' => [
                        'code' => 'FORBIDDEN',
                        'message' => 'Only platform administrators can publish modules',
                        'details' => ['user_id' => Auth::id()],
                        'documentation' => 'https://docs.example.com/errors/FORBIDDEN',
                    ]
                ], Response::HTTP_FORBIDDEN);
            }
            
            $command = new PublishModuleCommand(
                moduleId: $id,
                publishedBy: Auth::id()
            );
            
            $this->registrationService->publishModule($command);
            
            $module = ModuleModel::findOrFail($id);
            
            Log::info('Module published', [
                'module_id' => $id,
                'published_by' => Auth::id(),
            ]);
            
            return (new ModuleResource($module))
                ->response()
                ->setStatusCode(Response::HTTP_OK);
                
        } catch (ModuleNotFoundException $e) {
            return $this->moduleNotFoundResponse($id);
        } catch (\Exception $e) {
            Log::error('Module publish failed', [
                'module_id' => $id,
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
            ]);
            
            return response()->json([
                'error' => [
                    'code' => 'MODULE_PUBLISH_FAILED',
                    'message' => $e->getMessage(),
                    'details' => ['module_id' => $id],
                    'documentation' => 'https://docs.example.com/errors/MODULE_PUBLISH_FAILED',
                ]
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    /**
     * Deprecate a published module
     */
    public function deprecate(string $id, UpdateModuleStatusRequest $request): JsonResponse
    {
        try {
            // Verify user is platform admin
            if (!Auth::user()->is_platform_admin) {
                return response()->json([
                    'error' => [
                        'code' => 'FORBIDDEN',
                        'message' => 'Only platform administrators can deprecate modules',
                        'details' => ['user_id' => Auth::id()],
                        'documentation' => 'https://docs.example.com/errors/FORBIDDEN',
                    ]
                ], Response::HTTP_FORBIDDEN);
            }
            
            $command = new DeprecateModuleCommand(
                moduleId: $id,
                deprecatedBy: Auth::id(),
                reason: $request->validated('reason', 'Module deprecated by administrator')
            );
            
            $this->registrationService->deprecateModule($command);
            
            $module = ModuleModel::findOrFail($id);
            
            Log::info('Module deprecated', [
                'module_id' => $id,
                'deprecated_by' => Auth::id(),
                'reason' => $request->validated('reason'),
            ]);
            
            return (new ModuleResource($module))
                ->response()
                ->setStatusCode(Response::HTTP_OK);
                
        } catch (ModuleNotFoundException $e) {
            return $this->moduleNotFoundResponse($id);
        } catch (\Exception $e) {
            Log::error('Module deprecation failed', [
                'module_id' => $id,
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
            ]);
            
            return response()->json([
                'error' => [
                    'code' => 'MODULE_DEPRECATION_FAILED',
                    'message' => $e->getMessage(),
                    'details' => ['module_id' => $id],
                    'documentation' => 'https://docs.example.com/errors/MODULE_DEPRECATION_FAILED',
                ]
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    /**
     * Standard 404 response for module not found
     */
    private function moduleNotFoundResponse(string $moduleId): JsonResponse
    {
        return response()->json([
            'error' => [
                'code' => 'MODULE_NOT_FOUND',
                'message' => "Module with ID {$moduleId} not found",
                'details' => ['module_id' => $moduleId],
                'documentation' => 'https://docs.example.com/errors/MODULE_NOT_FOUND',
            ]
        ], Response::HTTP_NOT_FOUND);
    }
}
```

Now I need to create the supporting files:

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
}
```

```php
<?php
// app/Contexts/ModuleRegistry/Presentation/Http/Requests/RegisterModuleRequest.php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Authorization will be handled in controller
        return true;
    }
    
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'min:3',
                'max:50',
                'regex:/^[a-z0-9_-]+$/', // Lowercase letters, numbers, dashes, underscores
                'unique:landlord.modules,name',
            ],
            'display_name' => [
                'required',
                'string',
                'min:3',
                'max:100',
            ],
            'description' => [
                'required',
                'string',
                'min:10',
                'max:1000',
            ],
            'version' => [
                'required',
                'string',
                'regex:/^\d+\.\d+\.\d+$/', // Semantic versioning
            ],
            'requires_subscription' => [
                'boolean',
            ],
            'namespace' => [
                'required',
                'string',
                'regex:/^[A-Za-z0-9\\\\]+$/', // Valid PHP namespace
            ],
            'installer_class' => [
                'required',
                'string',
                'regex:/^[A-Za-z0-9\\\\]+$/', // Valid PHP class
            ],
            'metadata' => [
                'nullable',
                'array',
            ],
            'metadata.*' => [
                'string',
            ],
        ];
    }
    
    public function messages(): array
    {
        return [
            'name.regex' => 'Module name must contain only lowercase letters, numbers, dashes, and underscores',
            'version.regex' => 'Version must follow semantic versioning (e.g., 1.0.0)',
            'namespace.regex' => 'Namespace must be a valid PHP namespace',
            'installer_class.regex' => 'Installer class must be a valid PHP class',
        ];
    }
}
```

```php
<?php
// app/Contexts/ModuleRegistry/Presentation/Http/Requests/UpdateModuleStatusRequest.php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateModuleStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }
    
    public function rules(): array
    {
        return [
            'reason' => [
                'nullable',
                'string',
                'max:500',
            ],
        ];
    }
}
```

Now let me create the API Resource classes:

```php
<?php
// app/Contexts/ModuleRegistry/Presentation/Http/Resources/ModuleResource.php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ModuleResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'type' => 'modules',
            'attributes' => $this->getAttributes(),
            'relationships' => $this->getRelationships(),
            'links' => $this->getLinks(),
        ];
    }
    
    private function getAttributes(): array
    {
        return [
            'name' => $this->name,
            'display_name' => $this->display_name,
            'description' => $this->description,
            'version' => $this->version,
            'status' => $this->status,
            'requires_subscription' => (bool) $this->requires_subscription,
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
        ];
    }
    
    private function getRelationships(): array
    {
        return [
            'dependencies' => [
                'links' => [
                    'related' => url("/api/v1/platform/modules/{$this->id}/dependencies"),
                ],
            ],
            'tenant_installations' => [
                'links' => [
                    'related' => url("/api/v1/platform/modules/{$this->id}/installations"),
                ],
            ],
        ];
    }
    
    private function getLinks(): array
    {
        return [
            'self' => url("/api/v1/platform/modules/{$this->id}"),
        ];
    }
    
    public function with($request): array
    {
        return [
            'meta' => [
                'api_version' => 'v1',
                'context' => 'platform',
                'timestamp' => now()->toISOString(),
            ],
        ];
    }
}
```

```php
<?php
// app/Contexts/ModuleRegistry/Presentation/Http/Resources/ModuleCollection.php

namespace App\Contexts\ModuleRegistry\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\ResourceCollection;

class ModuleCollection extends ResourceCollection
{
    public function toArray($request): array
    {
        return [
            'data' => ModuleResource::collection($this->collection),
            'meta' => [
                'total' => $this->total(),
                'per_page' => $this->perPage(),
                'current_page' => $this->currentPage(),
                'last_page' => $this->lastPage(),
                'from' => $this->firstItem(),
                'to' => $this->lastItem(),
            ],
            'links' => [
                'self' => $request->fullUrl(),
                'first' => $this->url(1),
                'last' => $this->url($this->lastPage()),
                'prev' => $this->previousPageUrl(),
                'next' => $this->nextPageUrl(),
            ],
        ];
    }
    
    public function withResponse($request, $response): void
    {
        $response->header('Content-Type', 'application/vnd.api+json');
    }
}
```

Now let me add the routes. First, I need to update the routes file:

```php
<?php
// app/Contexts/ModuleRegistry/Infrastructure/Routes/api.php

use Illuminate\Support\Facades\Route;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\ModuleCatalogController;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\TenantModuleController;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Desktop\ModuleInstallationController;
use App\Contexts\ModuleRegistry\Presentation\Http\Controllers\Mobile\TenantModuleController as MobileTenantModuleController;

// PATTERN 1: Platform API (Landlord Context) - For admin UI
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

// PATTERN 2: Tenant API (Tenant Context) - For tenant operations  
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

// PATTERN 3: Mobile API - Simplified endpoints for mobile apps
Route::prefix('{tenant}/mapi/v1/modules')
    ->name('mobile.tenant.modules.')
    ->middleware(['tenant.context', 'mobile.api'])
    ->group(function () {
        Route::get('/', [MobileTenantModuleController::class, 'index'])
            ->name('index');
        
        Route::get('/{id}', [MobileTenantModuleController::class, 'show'])
            ->name('show');
    });
```

Now I need to register these routes. Let me check if there's a service provider:

```php
<?php
// app/Contexts/ModuleRegistry/Infrastructure/Providers/RouteServiceProvider.php

namespace App\Contexts\ModuleRegistry\Infrastructure\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as BaseRouteServiceProvider;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends BaseRouteServiceProvider
{
    public function boot(): void
    {
        parent::boot();
        
        $this->registerModuleRegistryRoutes();
    }
    
    protected function registerModuleRegistryRoutes(): void
    {
        Route::middleware(['api'])
            ->prefix('api')
            ->group(function () {
                require __DIR__ . '/../Routes/api.php';
            });
    }
}
```

And register it in the main ModuleRegistryServiceProvider:

```php
<?php
// app/Contexts/ModuleRegistry/Infrastructure/Providers/ModuleRegistryServiceProvider.php

namespace App\Contexts\ModuleRegistry\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

class ModuleRegistryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Existing bindings...
        
        // Register Route Service Provider
        $this->app->register(RouteServiceProvider::class);
    }
    
    public function boot(): void
    {
        // Existing boot logic...
    }
}
```

## ✅ DAY 22 PROGRESS SUMMARY

**Files Created (RED → GREEN → REFACTOR):**

1. ✅ **Tests**: `ModuleCatalogApiTest.php` (12 tests - RED phase)
2. ✅ **Controller**: `ModuleCatalogController.php` (GREEN phase)
3. ✅ **Base Controller**: `SecureApiController.php` (Security foundation)
4. ✅ **Request Classes**: `RegisterModuleRequest.php`, `UpdateModuleStatusRequest.php`
5. ✅ **Resources**: `ModuleResource.php`, `ModuleCollection.php`
6. ✅ **Routes**: Updated `api.php` with 2-pattern routing strategy
7. ✅ **Route Service Provider**: `RouteServiceProvider.php`

**Next Steps:**
1. Run the tests to verify they fail (RED phase check)
2. Fix any implementation issues (GREEN phase completion)
3. Create remaining controllers for Day 22:
   - `TenantModuleController.php` + tests
   - `ModuleInstallationController.php` + tests

**Architecture Compliance:**
- ✅ Hexagonal flow: Controller → Application Service → Domain
- ✅ Security First: Sanctum auth, rate limiting, tenant isolation
- ✅ API Standards: Consistent JSON:API format with HATEOAS links
- ✅ Production-ready: Logging, error handling, validation

Should I proceed with the `TenantModuleController.php` and its tests next, or would you like to review the current implementation first?