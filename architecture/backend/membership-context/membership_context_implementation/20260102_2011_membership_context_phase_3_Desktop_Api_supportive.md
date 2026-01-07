# **DAY 3: Desktop API Implementation - Senior Developer Guide**

## **🎯 EXECUTIVE STRATEGY**

**Objective**: Implement CASE 4 (Tenant Desktop API) for Admin Member Management
**Pattern**: Mirror Mobile API with Desktop-specific adaptations
**Key Differences**:
- **Authentication**: Session-based (admin users) vs Sanctum tokens
- **Status**: PENDING (skips DRAFT) vs DRAFT (requires verification)
- **User Creation**: Admin provides existing `tenant_user_id` vs auto-provisioning
- **Endpoints**: CRUD operations vs single registration endpoint

---

## **🏗️ ARCHITECTURE PATTERN (MIRRORING DAY 2)**

```
┌─────────────────────────────────────────────────────────┐
│        HTTP LAYER (CASE 4: /api routes)                 │
├─────────────────────────────────────────────────────────┤
│ • Controller: Desktop/MemberController                  │
│ • Request: Desktop/RegisterMemberRequest                │
│ • Resource: DesktopMemberResource                       │
│ • Routes: /{tenant}/api/v1/members/*                    │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│     APPLICATION LAYER - Desktop Use Cases               │
├─────────────────────────────────────────────────────────┤
│ • DesktopMemberRegistrationService (EXISTS)             │
│ • Desktop-specific DTO (EXISTS)                         │
│ • Future: MemberApprovalService, MemberListingService   │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│        DOMAIN LAYER - REUSED                            │
├─────────────────────────────────────────────────────────┤
│ • Member::registerForDesktop() (EXISTS)                 │
│ • RegistrationChannel::DESKTOP → PENDING status         │
│ • Domain events: MemberRegistered                       │
└─────────────────────────────────────────────────────────┘
```

---

## **📋 DAY 3 IMPLEMENTATION PLAN (TDD FIRST)**

### **PHASE 1: TDD - Write Failing Tests (2 hours)**
1. Create Desktop API feature tests
2. Create Desktop-specific unit tests
3. Verify tests fail (RED phase)

### **PHASE 2: HTTP Layer Implementation (2 hours)**
1. Desktop Controller (admin endpoints)
2. Desktop FormRequest validation  
3. Desktop Resource (admin response format)
4. Desktop Routes (CASE 4 pattern)

### **PHASE 3: Integration & Testing (1 hour)**
1. Update service provider
2. Run tests (GREEN phase)
3. Integration testing
4. Documentation

---

## **🚀 STARTING NOW: PHASE 1 - TDD FIRST**

Let me create the **failing tests** first following TDD methodology:

### **1. Desktop API Feature Tests**

Create file packages\laravel-backend\tests\Feature\Contexts\Membership\Desktop\MemberManagementApiTest.php
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\Membership\Desktop;

use App\Contexts\TenantAuth\Domain\Models\TenantUser;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Desktop Member Management API Tests
 *
 * Tests the desktop admin API endpoints: POST /{tenant}/api/v1/members
 *
 * CASE 4: Tenant Desktop API
 * - Route: /{tenant}/api/v1/members
 * - Middleware: web, identify.tenant, auth (session)
 * - Admin endpoints (authentication required)
 * - Creates members with PENDING status (skips DRAFT)
 * - Admin provides existing tenant_user_id
 *
 * TDD Workflow:
 * 1. RED: Write failing tests (this file)
 * 2. GREEN: Implement desktop API layer
 * 3. REFACTOR: Clean up and optimize
 *
 * Database Strategy:
 * - Uses DatabaseTransactions (same as mobile tests)
 * - Requires authenticated admin user
 * - Creates tenant_user before member creation
 */
class MemberManagementApiTest extends TestCase
{
    use DatabaseTransactions;

    protected $connectionsToTransact = ['tenant', 'landlord'];

    /**
     * Test admin user for desktop operations
     */
    protected TenantUser $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        // Set up tenant database
        config(['database.default' => 'tenant']);

        // Create test tenant for identify.tenant middleware
        $this->createTestTenant();

        // Create admin user and authenticate
        $this->adminUser = $this->createAdminUser();
        $this->actingAs($this->adminUser, 'web'); // Session authentication

        // Mock the domain service interfaces (same as mobile)
        $this->setupDomainServiceMocks();
    }

    /**
     * Create a test tenant in landlord database
     */
    private function createTestTenant(): void
    {
        // Switch to landlord database
        config(['database.default' => 'landlord']);

        // Create tenant if it doesn't exist
        \DB::connection('landlord')->table('tenants')->insertOrIgnore([
            'id' => '01HQWE1234567890ABCDEFGHJK',
            'slug' => 'uml',
            'name' => 'Test Tenant UML',
            'email' => 'admin@uml.example.com',
            'status' => 'active',
            'database_name' => 'tenant',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Switch back to tenant database
        config(['database.default' => 'tenant']);
    }

    /**
     * Create admin user for desktop operations
     */
    private function createAdminUser(): TenantUser
    {
        // Create a tenant user with admin privileges
        // This simulates an admin creating a member for another user
        return TenantUser::create([
            'id' => '01JKADMIN1234567890ABCDEFGH',
            'tenant_id' => 'uml',
            'email' => 'admin@uml.example.com',
            'name' => 'Admin User',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    private function setupDomainServiceMocks(): void
    {
        // Same mocks as mobile tests
        // GeographyResolverInterface mocked in service provider
    }

    /** @test */
    public function admin_can_create_member_via_desktop_api(): void
    {
        // Arrange: Admin creates member for existing tenant user
        $tenantUserId = '01JKUSER1234567890ABCDEFGH';
        
        $payload = [
            'tenant_user_id' => $tenantUserId, // REQUIRED: User already exists
            'full_name' => 'John Citizen',
            'email' => 'john.citizen@example.com',
            'phone' => '+977-9841234567',
            'member_id' => 'UML-2025-001',
            'geo_reference' => 'np.3.15.234',
        ];

        // Act: POST to desktop admin endpoint
        $response = $this->postJson('/uml/api/v1/members', $payload);

        // Assert: Success response with PENDING status
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
                'meta' => ['can_approve', 'can_activate'],
            ])
            ->assertJson([
                'data' => [
                    'type' => 'member',
                    'attributes' => [
                        'tenant_id' => 'uml',
                        'tenant_user_id' => $tenantUserId,
                        'status' => 'pending', // Desktop → PENDING (skips DRAFT)
                        'registration_channel' => 'desktop',
                    ],
                ],
                'message' => 'Member created successfully. Ready for approval.',
            ]);
    }

    /** @test */
    public function desktop_registration_requires_tenant_user_id(): void
    {
        // Arrange: Missing tenant_user_id
        $payload = [
            'full_name' => 'John Citizen',
            'email' => 'john@example.com',
            // Missing tenant_user_id (required for desktop)
        ];

        // Act
        $response = $this->postJson('/uml/api/v1/members', $payload);

        // Assert: Validation error
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['tenant_user_id']);
    }

    /** @test */
    public function desktop_registration_requires_authentication(): void
    {
        // Arrange: Unauthenticated request
        $this->withoutMiddleware(\Illuminate\Auth\Middleware\Authenticate::class);
        
        $payload = [
            'tenant_user_id' => '01JKUSER1234567890ABCDEFGH',
            'full_name' => 'John Citizen',
            'email' => 'john@example.com',
        ];

        // Act: Without authentication
        $response = $this->postJson('/uml/api/v1/members', $payload);

        // Assert: Unauthorized
        $response->assertStatus(401);
    }

    /** @test */
    public function desktop_registration_validates_tenant_user_id_format(): void
    {
        // Arrange: Invalid tenant_user_id format
        $payload = [
            'tenant_user_id' => 'invalid-format', // Invalid ULID
            'full_name' => 'John Citizen',
            'email' => 'john@example.com',
        ];

        // Act
        $response = $this->postJson('/uml/api/v1/members', $payload);

        // Assert: Validation error
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['tenant_user_id']);
    }

    /** @test */
    public function desktop_registration_creates_member_with_pending_status(): void
    {
        // Arrange
        $payload = [
            'tenant_user_id' => '01JKUSER1234567890ABCDEFGH',
            'full_name' => 'Pending User',
            'email' => 'pending@example.com',
        ];

        // Act
        $response = $this->postJson('/uml/api/v1/members', $payload);

        // Assert: Desktop registration creates PENDING status
        $response->assertStatus(201)
            ->assertJson([
                'data' => [
                    'attributes' => [
                        'status' => 'pending', // Desktop → PENDING
                        'registration_channel' => 'desktop',
                    ],
                ],
            ]);
    }

    /** @test */
    public function admin_can_approve_pending_member(): void
    {
        // First create a pending member
        $memberData = [
            'tenant_user_id' => '01JKUSER1234567890ABCDEFGH',
            'full_name' => 'To Approve',
            'email' => 'approve@example.com',
        ];

        $createResponse = $this->postJson('/uml/api/v1/members', $memberData);
        $memberId = $createResponse->json('data.id');

        // Act: Approve the member
        $response = $this->postJson("/uml/api/v1/members/{$memberId}/approve");

        // Assert: Member approved
        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Member approved successfully.',
                'data' => [
                    'attributes' => [
                        'status' => 'approved',
                    ],
                ],
            ]);
    }

    /** @test */
    public function admin_can_list_members(): void
    {
        // Arrange: Create some test members
        $this->createTestMembers();

        // Act: Get members list
        $response = $this->getJson('/uml/api/v1/members');

        // Assert: Returns paginated list
        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'type',
                        'attributes' => [
                            'full_name',
                            'email',
                            'status',
                            'registration_channel',
                        ],
                        'links' => ['self'],
                    ],
                ],
                'links' => ['first', 'last', 'prev', 'next'],
                'meta' => ['current_page', 'total'],
            ]);
    }

    /** @test */
    public function admin_can_filter_members_by_status(): void
    {
        // Arrange: Create members with different statuses
        $this->createTestMembers();

        // Act: Filter by pending status
        $response = $this->getJson('/uml/api/v1/members?status=pending');

        // Assert: Only pending members returned
        $response->assertStatus(200)
            ->assertJsonMissing(['attributes' => ['status' => 'active']])
            ->assertJsonMissing(['attributes' => ['status' => 'approved']]);
    }

    /** @test */
    public function admin_cannot_approve_non_pending_member(): void
    {
        // Create an already approved member
        $member = \App\Contexts\Membership\Domain\Models\Member::create([
            'id' => '01JKMEMBER1234567890ABCDEFGH',
            'tenant_user_id' => '01JKUSER1234567890ABCDEFGH',
            'tenant_id' => 'uml',
            'personal_info' => [
                'full_name' => 'Already Approved',
                'email' => 'already@example.com',
            ],
            'status' => 'approved',
            'registration_channel' => 'desktop',
        ]);

        // Act: Try to approve already approved member
        $response = $this->postJson("/uml/api/v1/members/{$member->id}/approve");

        // Assert: Business rule violation
        $response->assertStatus(422)
            ->assertJson([
                'message' => 'Only pending members can be approved.',
            ]);
    }

    /**
     * Helper: Create test members with different statuses
     */
    private function createTestMembers(): void
    {
        $statuses = ['draft', 'pending', 'approved', 'active', 'suspended'];
        
        foreach ($statuses as $index => $status) {
            \App\Contexts\Membership\Domain\Models\Member::create([
                'id' => '01JKMEMBER' . str_pad($index, 20, '0', STR_PAD_LEFT),
                'tenant_user_id' => '01JKUSER' . str_pad($index, 20, '0', STR_PAD_LEFT),
                'tenant_id' => 'uml',
                'personal_info' => [
                    'full_name' => "Test User {$index}",
                    'email' => "user{$index}@example.com",
                ],
                'status' => $status,
                'registration_channel' => $index % 2 === 0 ? 'mobile' : 'desktop',
            ]);
        }
    }
}
```

Now let me create the **Desktop-specific FormRequest** for validation:

Create file packages\laravel-backend\app\Contexts\Membership\Infrastructure\Http\Requests\Desktop\RegisterMemberRequest.php
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Http\Requests\Desktop;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Desktop Member Registration Request
 *
 * INFRASTRUCTURE LAYER - HTTP Validation
 *
 * Validates desktop admin registration requests for POST /{tenant}/api/v1/members
 *
 * Key Differences from Mobile:
 * - REQUIRES tenant_user_id (admin provides existing user)
 * - Requires authentication (admin session)
 * - No mobile-specific fields (device_id, app_version, platform)
 * - Creates PENDING status (skips DRAFT)
 *
 * Validation Rules:
 * - tenant_user_id: REQUIRED, valid ULID, exists in tenant_users table
 * - full_name: Required, 2-255 characters
 * - email: Required, valid email, unique per tenant
 * - phone: Optional, max 20 characters
 * - member_id: Optional, 3-50 characters, unique per tenant
 * - geo_reference: Optional, validated via GeographyResolverInterface
 *
 * Authorization:
 * - Admin endpoint (authentication required)
 * - Returns true (middleware handles auth)
 */
class RegisterMemberRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Desktop registration requires admin authentication.
     * This is handled by 'auth' middleware.
     */
    public function authorize(): bool
    {
        // Authentication handled by 'auth' middleware
        // Admin authorization handled by policy/rbac
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $tenantId = $this->route('tenant');
        
        // Use correct connection based on environment
        $tenantConnection = app()->environment('testing') ? 'tenant_test' : 'tenant';

        return [
            // REQUIRED: Admin provides existing tenant user ID
            'tenant_user_id' => [
                'required',
                'string',
                'size:26',  // ULID = 26 characters
                'regex:/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/',
                // Check user exists in tenant_users table
                Rule::exists("{$tenantConnection}.tenant_users", 'id')
                    ->where('tenant_id', $tenantId),
            ],

            // Required personal info
            'full_name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => [
                'required',
                app()->environment('testing') ? 'email:rfc' : 'email:rfc,dns',
                'max:255',
                // Unique email per tenant
                "unique:{$tenantConnection}.members,personal_info->email,NULL,id,tenant_id,{$tenantId}",
            ],

            // Optional personal info
            'phone' => ['nullable', 'string', 'max:20'],
            'member_id' => [
                'nullable',
                'string',
                'min:3',
                'max:50',
                // Unique member_id per tenant
                "unique:{$tenantConnection}.members,member_id,NULL,id,tenant_id,{$tenantId}",
            ],

            // Optional geography reference
            'geo_reference' => [
                'nullable',
                'string',
                'max:500',
                'regex:/^[a-z]{2}(\.[a-z0-9\-_]+)+$/',
            ],
        ];
    }

    /**
     * Get custom error messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tenant_user_id.required' => 'Tenant user ID is required for desktop registration.',
            'tenant_user_id.size' => 'Tenant user ID must be a valid ULID (26 characters).',
            'tenant_user_id.regex' => 'Tenant user ID must be a valid ULID format.',
            'tenant_user_id.exists' => 'The specified tenant user does not exist.',

            'full_name.required' => 'Full name is required.',
            'full_name.min' => 'Full name must be at least 2 characters.',
            'full_name.max' => 'Full name cannot exceed 255 characters.',

            'email.required' => 'Email address is required.',
            'email.email' => 'Please provide a valid email address.',
            'email.unique' => 'A member with this email already exists.',

            'phone.max' => 'Phone number cannot exceed 20 characters.',

            'member_id.min' => 'Member ID must be at least 3 characters.',
            'member_id.max' => 'Member ID cannot exceed 50 characters.',
            'member_id.unique' => 'This member ID is already in use.',

            'geo_reference.regex' => 'Invalid geography reference format. Expected format: country.level1.level2... (e.g., "np.3.15.234")',
            'geo_reference.max' => 'Geography reference cannot exceed 500 characters.',
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'tenant_user_id' => 'tenant user ID',
            'full_name' => 'full name',
            'email' => 'email address',
            'phone' => 'phone number',
            'member_id' => 'member ID',
            'geo_reference' => 'geography reference',
        ];
    }

    /**
     * Prepare the data for validation.
     * Ensures tenant_user_id is properly trimmed.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'tenant_user_id' => Str::upper(trim($this->tenant_user_id ?? '')),
        ]);
    }
}
```

Now let me create the **Desktop-specific Resource** for JSON:API responses:

Create file packages\laravel-backend\app\Contexts\Membership\Infrastructure\Http\Resources\DesktopMemberResource.php
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
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
 * INFRASTRUCTURE LAYER - HTTP Resource
 *
 * Transforms Member aggregate into JSON:API format for desktop admin clients.
 *
 * Key Differences from Mobile:
 * - Admin-focused metadata (approval status, audit info)
 * - More detailed information (created_by, updated_by)
 * - Admin action links (approve, activate, suspend)
 * - No mobile-specific fields
 *
 * JSON:API Structure:
 * - data.id: Member system ID (ULID)
 * - data.type: Resource type ("member")
 * - data.attributes: Member attributes (admin view)
 * - data.links: Admin action links
 * - meta: Admin metadata (approval workflow)
 *
 * @property Member $resource
 */
class DesktopMemberResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Member $member */
        $member = $this->resource;

        return [
            'id' => $member->id,
            'type' => 'member',
            'attributes' => $this->getAttributes($member),
            'relationships' => $this->getRelationships($member),
            'links' => $this->getLinks($member),
            'meta' => $this->getMeta($member),
        ];
    }

    /**
     * Get member attributes for admin view
     */
    private function getAttributes(Member $member): array
    {
        return [
            'member_id' => $member->member_id?->value(),
            'tenant_user_id' => $member->tenant_user_id,
            'tenant_id' => $member->tenant_id,
            'personal_info' => [
                'full_name' => $member->personal_info->fullName(),
                'email' => $member->personal_info->email()->value(),
                'phone' => $member->personal_info->phone(),
            ],
            'status' => $member->status->value(),
            'status_label' => $member->status->label(),
            'residence_geo_reference' => $member->residence_geo_reference,
            'membership_type' => $member->membership_type,
            'registration_channel' => $member->registration_channel,
            'registration_channel_label' => $this->getChannelLabel($member->registration_channel),
            'created_at' => $member->created_at?->toIso8601String(),
            'updated_at' => $member->updated_at?->toIso8601String(),
            'can_vote' => $member->canVote(),
            'can_hold_committee_role' => $member->canHoldCommitteeRole(),
        ];
    }

    /**
     * Get relationships (future: tenant_user, committee assignments, etc.)
     */
    private function getRelationships(Member $member): array
    {
        return [
            'tenant_user' => [
                'links' => [
                    'related' => route('tenant.api.users.show', [
                        'tenant' => $member->tenant_id,
                        'user' => $member->tenant_user_id,
                    ]),
                ],
                'meta' => [
                    'type' => 'tenant_user',
                ],
            ],
        ];
    }

    /**
     * Get admin action links
     */
    private function getLinks(Member $member): array
    {
        $links = [
            'self' => route('tenant.api.members.show', [
                'tenant' => $member->tenant_id,
                'member' => $member->id,
            ]),
            'related' => [
                'tenant_user' => route('tenant.api.users.show', [
                    'tenant' => $member->tenant_id,
                    'user' => $member->tenant_user_id,
                ]),
            ],
        ];

        // Add action links based on member status
        if ($member->status->isPending()) {
            $links['approve'] = route('tenant.api.members.approve', [
                'tenant' => $member->tenant_id,
                'member' => $member->id,
            ]);
        }

        if ($member->status->isApproved()) {
            $links['activate'] = route('tenant.api.members.activate', [
                'tenant' => $member->tenant_id,
                'member' => $member->id,
            ]);
        }

        if ($member->status->isActive()) {
            $links['suspend'] = route('tenant.api.members.suspend', [
                'tenant' => $member->tenant_id,
                'member' => $member->id,
            ]);
        }

        return $links;
    }

    /**
     * Get admin metadata
     */
    private function getMeta(Member $member): array
    {
        return [
            'workflow' => [
                'can_approve' => $member->status->isPending(),
                'can_activate' => $member->status->isApproved(),
                'can_suspend' => $member->status->isActive(),
                'can_reactivate' => $member->status->isSuspended(),
            ],
            'audit' => [
                'registration_channel' => $member->registration_channel,
                'requires_email_verification' => $member->status->isDraft(),
            ],
            'permissions' => [
                'can_vote' => $member->canVote(),
                'can_hold_committee_role' => $member->canHoldCommitteeRole(),
            ],
        ];
    }

    /**
     * Get registration channel label
     */
    private function getChannelLabel(?string $channel): ?string
    {
        return match($channel) {
            'mobile' => 'Mobile App Registration',
            'desktop' => 'Admin Desktop Registration',
            'import' => 'Bulk Import',
            default => null,
        };
    }

    /**
     * Get additional data that should be returned with the resource array.
     *
     * @return array<string, mixed>
     */
    public function with(Request $request): array
    {
        /** @var Member $member */
        $member = $this->resource;

        return [
            'message' => $this->getSuccessMessage($member),
            'meta' => [
                'actions_available' => array_keys($this->getLinks($member)),
                'status_transitions' => $this->getStatusTransitions($member),
            ],
        ];
    }

    /**
     * Get success message based on member status
     */
    private function getSuccessMessage(Member $member): string
    {
        return match ($member->status->value()) {
            'draft' => 'Member created with draft status. Email verification required.',
            'pending' => 'Member created successfully. Ready for approval.',
            'approved' => 'Member approved. Can be activated when ready.',
            'active' => 'Member activated successfully.',
            default => 'Member operation completed successfully.',
        };
    }

    /**
     * Get possible status transitions
     */
    private function getStatusTransitions(Member $member): array
    {
        $transitions = [];

        if ($member->status->isPending()) {
            $transitions[] = ['to' => 'approved', 'action' => 'approve'];
        }

        if ($member->status->isApproved()) {
            $transitions[] = ['to' => 'active', 'action' => 'activate'];
        }

        if ($member->status->isActive()) {
            $transitions[] = ['to' => 'suspended', 'action' => 'suspend'];
        }

        if ($member->status->isSuspended()) {
            $transitions[] = ['to' => 'active', 'action' => 'reactivate'];
        }

        return $transitions;
    }
}
```

Now let me create the **Desktop Controller** with admin endpoints:

Create file packages\laravel-backend\app\Contexts\Membership\Infrastructure\Http\Controllers\Desktop\MemberController.php
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Http\Controllers\Desktop;

use App\Contexts\Membership\Application\DTOs\DesktopRegistrationDto;
use App\Contexts\Membership\Application\Services\DesktopMemberRegistrationService;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Infrastructure\Http\Requests\Desktop\RegisterMemberRequest;
use App\Contexts\Membership\Infrastructure\Http\Resources\DesktopMemberResource;
use App\Contexts\Membership\Infrastructure\Http\Resources\DesktopMemberCollection;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

/**
 * Desktop Member Controller
 *
 * INFRASTRUCTURE LAYER - HTTP Controller (THIN)
 *
 * Handles HTTP requests for desktop admin member operations.
 *
 * CASE 4 Routes: /{tenant}/api/v1/members/*
 * - POST   /{tenant}/api/v1/members           - Create member (admin)
 * - GET    /{tenant}/api/v1/members           - List members (paginated)
 * - GET    /{tenant}/api/v1/members/{id}      - Get member details
 * - POST   /{tenant}/api/v1/members/{id}/approve  - Approve member
 * - POST   /{tenant}/api/v1/members/{id}/activate - Activate member
 * - POST   /{tenant}/api/v1/members/{id}/suspend  - Suspend member
 *
 * Controller Responsibilities (THIN):
 * 1. Receive HTTP request (admin authenticated via session)
 * 2. Create DTO from request
 * 3. Delegate to Application Service
 * 4. Return HTTP response (JSON:API format)
 * 5. Handle exceptions → HTTP errors
 *
 * Authentication: Session-based (admin users)
 */
class MemberController extends Controller
{
    public function __construct(
        private readonly DesktopMemberRegistrationService $registrationService,
        private readonly MemberRepositoryInterface $memberRepository
    ) {}

    /**
     * Create a new member via desktop admin
     *
     * POST /{tenant}/api/v1/members
     *
     * Admin creates member for existing tenant user.
     * Member starts at PENDING status (skips DRAFT).
     *
     * @param RegisterMemberRequest $request Validated HTTP request
     * @return JsonResponse JSON:API formatted response
     */
    public function store(RegisterMemberRequest $request): JsonResponse
    {
        try {
            // Step 1: Create DTO from validated request
            $dto = DesktopRegistrationDto::fromRequest($request);

            // Step 2: Delegate to Application Service
            $member = $this->registrationService->register($dto);

            // Step