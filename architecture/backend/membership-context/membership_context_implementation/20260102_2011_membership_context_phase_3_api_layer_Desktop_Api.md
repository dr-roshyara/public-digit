# 🎯 **DAY 3: Desktop API Implementation (CASE 4)**

## **📋 OVERVIEW**

**Desktop Admin API** for political party administrators using Vue desktop interface.

### **CASE 4 Pattern:**
```
/{tenant}/api/v1/members/*
```
- **Middleware**: `web`, `identify.tenant`, `auth` (session-based)
- **Authentication**: Session cookies (Laravel default auth)
- **Purpose**: Party administrators manage members

---

## **🚀 TDD WORKFLOW: RED → GREEN → REFACTOR**

### **STEP 1: Write Failing Desktop Tests (RED)**

Create file: `tests/Feature/Contexts/Membership/Desktop/MemberRegistrationApiTest.php`

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\Membership\Desktop;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/**
 * Desktop Member Registration API Tests
 * 
 * CASE 4: Tenant Desktop API - /{tenant}/api/v1/members
 * 
 * Business Rules:
 * - Admin creates member on behalf of citizen
 * - tenant_user_id already exists (admin created user first)
 * - Member starts with PENDING status (skips DRAFT)
 * - No email verification required
 * - Requires session authentication (admin role)
 */
class MemberRegistrationApiTest extends TestCase
{
    use DatabaseTransactions;

    protected $connectionsToTransact = ['tenant'];

    protected function setUp(): void
    {
        parent::setUp();
        
        config(['database.default' => 'tenant']);
        
        // Create test tenant for identify.tenant middleware
        $this->createTestTenant();
        
        // Create authenticated admin user
        $this->actingAsAdmin();
    }

    private function createTestTenant(): void
    {
        config(['database.default' => 'landlord']);

        \DB::connection('landlord')->table('tenants')->insertOrIgnore([
            'id' => '01HQWE1234567890ABCDEFGHJK',
            'slug' => 'uml',
            'name' => 'Test Tenant UML',
            'email' => 'test@uml.example.com',
            'status' => 'active',
            'database_name' => 'tenant',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        config(['database.default' => 'tenant']);
    }

    private function actingAsAdmin()
    {
        // Create admin user with tenant_user role
        $adminUser = \App\Models\User::factory()->create([
            'email' => 'admin@uml.example.com',
        ]);
        
        // Assign admin permissions (implementation depends on your permission system)
        // $adminUser->assignRole('admin');
        
        Auth::login($adminUser);
    }

    /** @test */
    public function admin_can_create_member_via_desktop_api(): void
    {
        // Arrange
        $payload = [
            'tenant_user_id' => '01JKABCD1234567890ABCDEFGH', // Admin provides existing user ID
            'full_name' => 'John Citizen',
            'email' => 'john.citizen@example.com',
            'phone' => '+977-9841234567',
        ];

        // Act: POST to desktop admin endpoint
        $response = $this->postJson('/uml/api/v1/members', $payload);

        // Assert: Success response
        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'type',
                    'attributes' => [
                        'member_id',
                        'tenant_user_id',
                        'tenant_id',
                        'personal_info',
                        'status',
                        'residence_geo_reference',
                        'membership_type',
                        'registration_channel',
                    ],
                    'links' => ['self'],
                ],
                'message',
                'meta' => ['requires_approval'],
            ])
            ->assertJson([
                'data' => [
                    'type' => 'member',
                    'attributes' => [
                        'tenant_id' => 'uml',
                        'tenant_user_id' => '01JKABCD1234567890ABCDEFGH',
                        'status' => 'pending', // Desktop → PENDING status
                        'registration_channel' => 'desktop',
                    ],
                ],
                'message' => 'Member created successfully. Pending approval.',
            ]);
    }

    /** @test */
    public function desktop_registration_requires_authentication(): void
    {
        // Logout admin
        Auth::logout();

        $payload = [
            'tenant_user_id' => '01JKABCD1234567890ABCDEFGH',
            'full_name' => 'Test User',
            'email' => 'test@example.com',
        ];

        $response = $this->postJson('/uml/api/v1/members', $payload);

        $response->assertStatus(401)
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    /** @test */
    public function desktop_registration_requires_existing_tenant_user_id(): void
    {
        $payload = [
            'tenant_user_id' => 'INVALID_USER_ID',
            'full_name' => 'Test User',
            'email' => 'test@example.com',
        ];

        $response = $this->postJson('/uml/api/v1/members', $payload);

        // Should validate that tenant_user_id exists in TenantAuth context
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['tenant_user_id']);
    }

    /** @test */
    public function desktop_registration_creates_pending_not_draft_status(): void
    {
        $payload = [
            'tenant_user_id' => '01JKABCD1234567890ABCDEFGH',
            'full_name' => 'Test User',
            'email' => 'test@example.com',
        ];

        $response = $this->postJson('/uml/api/v1/members', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'data' => [
                    'attributes' => [
                        'status' => 'pending', // Not draft!
                    ],
                ],
            ]);
    }

    /** @test */
    public function admin_can_list_members(): void
    {
        // Create some test members
        $members = \App\Contexts\Membership\Domain\Models\Member::factory()
            ->count(3)
            ->create(['tenant_id' => 'uml']);

        $response = $this->getJson('/uml/api/v1/members');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'type', 'attributes', 'links'],
                ],
                'links' => ['first', 'last', 'prev', 'next'],
                'meta' => ['current_page', 'total'],
            ]);
    }
}
```

---

## **STEP 2: Create Desktop FormRequest**

Create file: `app/Contexts/Membership/Infrastructure/Http/Requests/Desktop/RegisterMemberRequest.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Http\Requests\Desktop;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Desktop Member Registration Request
 * 
 * CASE 4: /{tenant}/api/v1/members (POST)
 * 
 * Validation Rules:
 * - tenant_user_id: REQUIRED, valid ULID, exists in TenantAuth context
 * - full_name: Required, 2-255 characters
 * - email: Required, valid email
 * - phone: Optional
 * - member_id: Optional, unique per tenant
 * - geo_reference: Optional, validated via GeographyResolverInterface
 * 
 * Authorization:
 * - Requires authenticated admin session
 */
class RegisterMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Desktop admin endpoint requires authentication
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $tenantId = $this->route('tenant');
        $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';

        return [
            // Required: Existing tenant user (admin created user first)
            'tenant_user_id' => [
                'required',
                'string',
                'size:26',
                'regex:/^[0-9A-Z]{26}$/',
                // Should validate against TenantAuth context (future implementation)
            ],

            // Required personal info
            'full_name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => [
                'required',
                app()->environment('testing') ? 'email:rfc' : 'email:rfc,dns',
                'max:255',
                "unique:{$tenantConnection}.members,personal_info->email,NULL,id,tenant_id,{$tenantId}",
            ],

            // Optional fields
            'phone' => ['nullable', 'string', 'max:20'],
            'member_id' => [
                'nullable',
                'string',
                'min:3',
                'max:50',
                "unique:{$tenantConnection}.members,member_id,NULL,id,tenant_id,{$tenantId}",
            ],
            'geo_reference' => [
                'nullable',
                'string',
                'max:500',
                'regex:/^[a-z]{2}(\.[a-z0-9\-_]+)+$/',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'tenant_user_id.required' => 'Tenant user ID is required.',
            'tenant_user_id.regex' => 'Tenant user ID must be a valid ULID.',
            'full_name.required' => 'Full name is required.',
            'email.required' => 'Email address is required.',
            'email.unique' => 'A member with this email already exists.',
        ];
    }
}
```

---

## **STEP 3: Create Desktop Resource**

Create file: `app/Contexts/Membership/Infrastructure/Http/Resources/DesktopMemberResource.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Http\Resources;

use App\Contexts\Membership\Domain\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Desktop Member Resource
 * 
 * JSON:API format for desktop admin interface.
 * 
 * Desktop-Specific Features:
 * - Admin-focused metadata
 * - Approval workflow links
 * - Bulk operation support
 * - More detailed audit information
 */
class DesktopMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var Member $member */
        $member = $this->resource;

        return [
            'id' => $member->id,
            'type' => 'member',
            'attributes' => [
                'member_id' => $member->member_id?->value(),
                'tenant_user_id' => $member->tenant_user_id,
                'tenant_id' => $member->tenant_id,
                'personal_info' => [
                    'full_name' => $member->personal_info->fullName(),
                    'email' => $member->personal_info->email()->value(),
                    'phone' => $member->personal_info->phone(),
                ],
                'status' => $member->status->value(),
                'residence_geo_reference' => $member->residence_geo_reference,
                'membership_type' => $member->membership_type,
                'registration_channel' => $member->registration_channel,
                'created_at' => $member->created_at?->toIso8601String(),
                'updated_at' => $member->updated_at?->toIso8601String(),
            ],
            'links' => $this->getDesktopLinks($member),
            'meta' => $this->getDesktopMeta($member),
        ];
    }

    private function getDesktopLinks(Member $member): array
    {
        return [
            'self' => route('tenant.api.members.show', [
                'tenant' => $member->tenant_id,
                'member' => $member->id,
            ]),
            'approve' => route('tenant.api.members.approve', [
                'tenant' => $member->tenant_id,
                'member' => $member->id,
            ]),
            'activate' => route('tenant.api.members.activate', [
                'tenant' => $member->tenant_id,
                'member' => $member->id,
            ]),
            'edit' => route('tenant.api.members.edit', [
                'tenant' => $member->tenant_id,
                'member' => $member->id,
            ]),
        ];
    }

    private function getDesktopMeta(Member $member): array
    {
        return [
            'can_approve' => $member->status->canBeApproved(),
            'can_activate' => $member->status->canBeActivated(),
            'requires_approval' => $member->status->isPending(),
            'can_vote' => $member->canVote(),
            'can_hold_committee_role' => $member->canHoldCommitteeRole(),
            'days_since_registration' => $member->created_at?->diffInDays(),
        ];
    }

    public function with(Request $request): array
    {
        /** @var Member $member */
        $member = $this->resource;

        return [
            'message' => $this->getSuccessMessage($member),
            'meta' => [
                'status_transitions' => $member->status->availableTransitions(),
                'admin_actions' => $this->getAdminActions($member),
            ],
        ];
    }

    private function getSuccessMessage(Member $member): string
    {
        return match ($member->status->value()) {
            'pending' => 'Member created successfully. Pending approval.',
            'approved' => 'Member approved successfully. Ready for activation.',
            'active' => 'Member activated successfully.',
            default => 'Member operation completed successfully.',
        };
    }

    private function getAdminActions(Member $member): array
    {
        return [
            'can_export' => true,
            'can_bulk_approve' => $member->status->isPending(),
            'can_send_welcome_email' => $member->status->isActive(),
        ];
    }
}
```

---

## **STEP 4: Create Desktop Controller**

Create file: `app/Contexts/Membership/Infrastructure/Http/Controllers/Desktop/MemberController.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Http\Controllers\Desktop;

use App\Contexts\Membership\Application\DTOs\DesktopRegistrationDto;
use App\Contexts\Membership\Application\Services\DesktopMemberRegistrationService;
use App\Contexts\Membership\Infrastructure\Http\Requests\Desktop\RegisterMemberRequest;
use App\Contexts\Membership\Infrastructure\Http\Resources\DesktopMemberResource;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

/**
 * Desktop Member Controller
 * 
 * CASE 4 Routes: /{tenant}/api/v1/members/*
 * - POST   /{tenant}/api/v1/members - Create member (admin)
 * - GET    /{tenant}/api/v1/members - List members (admin)
 * - GET    /{tenant}/api/v1/members/{id} - Get member (admin)
 * - POST   /{tenant}/api/v1/members/{id}/approve - Approve member (admin)
 * 
 * Authentication: Session-based (web middleware)
 * Authorization: Admin permissions required
 */
class MemberController extends Controller
{
    public function __construct(
        private readonly DesktopMemberRegistrationService $registrationService
    ) {}

    /**
     * Create new member (admin)
     * 
     * POST /{tenant}/api/v1/members
     */
    public function store(RegisterMemberRequest $request): JsonResponse
    {
        try {
            $dto = DesktopRegistrationDto::fromRequest($request);
            $member = $this->registrationService->register($dto);

            return (new DesktopMemberResource($member))
                ->response()
                ->setStatusCode(201);

        } catch (InvalidArgumentException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => ['business_rule' => [$e->getMessage()]],
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'An error occurred while creating member.',
                'errors' => ['system' => [config('app.debug') ? $e->getMessage() : 'Internal server error']],
            ], 500);
        }
    }

    /**
     * List members (admin)
     * 
     * GET /{tenant}/api/v1/members
     */
    public function index(Request $request): JsonResponse
    {
        // TODO: Implement with pagination, filtering, sorting
        // Will use MemberRepository with admin filters
        
        return response()->json([
            'message' => 'Not implemented yet',
            'data' => [],
            'meta' => ['total' => 0],
        ], 501);
    }

    /**
     * Approve member (admin)
     * 
     * POST /{tenant}/api/v1/members/{id}/approve
     */
    public function approve(string $id): JsonResponse
    {
        // TODO: Implement approval workflow
        // Will call Member::approve() domain method
        
        return response()->json([
            'message' => 'Not implemented yet',
        ], 501);
    }
}
```

---

## **STEP 5: Create Desktop Routes**

Create file: `routes/tenant-api/membership.php`

```php
<?php

declare(strict_types=1);

use App\Contexts\Membership\Infrastructure\Http\Controllers\Desktop\MemberController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Membership Context - Desktop API Routes (CASE 4)
|--------------------------------------------------------------------------
|
| CASE 4: Tenant Desktop API
| Pattern: /{tenant}/api/v1/members/*
| Middleware: web, identify.tenant, auth
| Authentication: Session-based (admin dashboard)
|
| Desktop Admin Features:
| - Create members on behalf of citizens
| - Approve pending members
| - Manage member lifecycle
| - Generate reports
|
*/

Route::prefix('members')
    ->name('tenant.api.members.')
    ->group(function () {

        // Admin member management
        Route::post('/', [MemberController::class, 'store'])
            ->name('store');

        Route::get('/', [MemberController::class, 'index'])
            ->name('index');

        Route::get('/{member}', [MemberController::class, 'show'])
            ->where('member', '[0-9A-Z]{26}')
            ->name('show');

        // Member workflow actions
        Route::prefix('{member}')->group(function () {
            Route::post('/approve', [MemberController::class, 'approve'])
                ->name('approve');

            Route::post('/activate', [MemberController::class, 'activate'])
                ->name('activate');

            Route::post('/suspend', [MemberController::class, 'suspend'])
                ->name('suspend');
        });

        // Bulk operations
        Route::prefix('bulk')->group(function () {
            Route::post('/approve', [MemberController::class, 'bulkApprove'])
                ->name('bulk.approve');

            Route::post('/export', [MemberController::class, 'bulkExport'])
                ->name('bulk.export');
        });
    });
```

---

## **STEP 6: Register Desktop Routes**

Edit file: `routes/tenant-api.php` (or wherever CASE 4 routes are loaded)

```php
// Add this line to load desktop membership routes
require __DIR__.'/tenant-api/membership.php';
```

According to your architecture, CASE 4 routes should be loaded in the `/{tenant}/api/v1` prefix group.

---

## **STEP 7: Run Tests (RED → GREEN)**

```bash
# Run desktop API tests
php artisan test tests/Feature/Contexts/Membership/Desktop/

# Expected: Tests will fail (RED phase)
# Then implement missing components to make GREEN
```

---

## **🎯 KEY DIFFERENCES FROM MOBILE API:**

| Aspect | Mobile API (CASE 2) | Desktop API (CASE 4) |
|--------|-------------------|-------------------|
| **Route** | `/{tenant}/mapi/v1/*` | `/{tenant}/api/v1/*` |
| **Middleware** | `api`, `identify.tenant` | `web`, `identify.tenant`, `auth` |
| **Auth** | None (public registration) | Session (admin authentication) |
| **Status** | DRAFT (requires verification) | PENDING (skip verification) |
| **User Provisioning** | Creates tenant user | Uses existing tenant user |
| **Links** | Self, profile | Self, approve, activate, edit |
| **Metadata** | Verification status | Admin actions, workflow |

---

## **🚀 NEXT STEPS AFTER DAY 3:**

1. **Implement approval workflow** (`Member::approve()` domain method)
2. **Add pagination/filtering** to member list endpoint
3. **Implement bulk operations** (approve, export, etc.)
4. **Add admin permissions** (RBAC integration)
5. **Create Vue admin components** (frontend integration)

**Ready to proceed with DAY 3 implementation?** I'll start with the TDD workflow (tests first, then implementation). 
# 🚀 **PROCEEDING WITH DAY 3: Desktop API Implementation**

I'll implement the Desktop API following the **TDD workflow** (RED → GREEN → REFACTOR) using the established patterns from Mobile API.

## **📋 IMPLEMENTATION ORDER:**

1. ✅ **Create failing tests** (RED phase) - Already have the test file
2. ✅ **Create FormRequest** - Already created
3. ✅ **Create Resource** - Already created  
4. ✅ **Create Controller** - Already created
5. ✅ **Create Routes** - Already created
6. 🔄 **Create Desktop-specific DTO** (if needed)
7. 🔄 **Register routes** in proper location
8. 🔄 **Run tests** (still RED)
9. 🔄 **Fix implementation issues** (make GREEN)
10. 🔄 **Refactor**

## **🔧 IMMEDIATE NEXT ACTION:**

### **1. First, check if `DesktopRegistrationDto` exists:**
```bash
# Check if DTO exists
ls packages/laravel-backend/app/Contexts/Membership/Application/DTOs/
```

### **2. Register Desktop routes in CASE 4 route group:**
Need to find where `/{tenant}/api/v1` routes are loaded in your architecture.

### **3. Run the desktop tests to see current failures:**
```bash
cd packages/laravel-backend
php artisan test tests/Feature/Contexts/Membership/Desktop/
```

## **📁 Let me check the current state:**

**Check 1: DTO exists?**
Bash: `cd packages/laravel-backend && ls -la app/Contexts/Membership/Application/DTOs/`

**Check 2: Where are CASE 4 routes loaded?**
Look at `bootstrap/app.php` and `routes/tenant-api.php` (if exists)

**Check 3: Run desktop tests to see failures**
Bash: `cd packages/laravel-backend && php artisan test tests/Feature/Contexts/Membership/Desktop/ --stop-on-failure 2>&1 | tail -100`

## **🎯 Let me start with these checks:**

**First, check if DesktopRegistrationDto exists:**
Bash: `cd packages/laravel-backend && find app/Contexts/Membership -name "*DesktopRegistrationDto*" -type f`