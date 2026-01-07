# 🎯 Membership Context - Phase 3: API Layer (CORRECTED)

**Date**: 2026-01-02 20:30
**Status**: Production-Ready Architecture (Post-Review)
**Approach**: TDD-First, DDD-Compliant, Mobile-First

---

## Executive Summary

This plan **corrects critical architectural flaws** identified in the initial plan and incorporates insights from senior architecture review. The corrected approach:

1. ✅ **Mobile-First**: Prioritizes CASE 2 (`/mapi`) over CASE 4 (`/api`)
2. ✅ **Thin Controllers**: Business logic in Application Services, not controllers
3. ✅ **Context Boundaries**: Domain service interfaces prevent coupling
4. ✅ **Separate Resources**: Mobile vs Desktop concerns isolated
5. ✅ **Domain Factory**: Creation logic in domain layer
6. ✅ **Anti-Corruption**: Geography context accessed via ACL
7. ✅ **Proper Testing**: 60% domain/application, 30% HTTP, 10% integration

---

## Critical Corrections from Initial Plan

### ❌ WRONG (Initial Plan)

```php
// FAT CONTROLLER - Business logic in HTTP layer
class MemberController
{
    public function store(RegisterMemberRequest $request): JsonResponse
    {
        // ❌ Creating command directly in controller
        $command = new RegisterMemberCommand(...);

        // ❌ Calling handler directly
        $member = $this->handler->handle($command);

        // ❌ Single resource for both mobile and desktop
        return response()->json(['data' => new MemberResource($member)], 201);
    }
}
```

**Problems**:
- Controller orchestrates business flow
- No separation between mobile and desktop
- Direct handler calls (should use Application Service)
- Missing cross-context boundaries

### ✅ CORRECT (Corrected Plan)

```php
// THIN CONTROLLER - Delegates to Application Service
class MobileMemberController
{
    public function register(MobileRegisterMemberRequest $request): JsonResponse
    {
        // ✅ Convert request to DTO
        $dto = MobileRegistrationDto::fromRequest($request);

        // ✅ Delegate to Application Service
        $member = $this->mobileRegistrationService->register($dto);

        // ✅ Mobile-specific resource
        return MobileMemberResource::make($member)
            ->response()
            ->setStatusCode(201);
    }
}
```

**Benefits**:
- Controller only handles HTTP concerns
- Application Service orchestrates business logic
- Clear mobile vs desktop separation
- Testable without HTTP layer

---

## Corrected Architecture Layers

```
┌──────────────────────────────────────────────────────┐
│ HTTP LAYER (Infrastructure - THIN)                   │
│ ├── MobileMemberController (routes: /mapi/*)        │
│ └── DesktopMemberController (routes: /api/*)        │
│     • Validate HTTP input                           │
│     • Convert to DTOs                               │
│     • Call Application Services                      │
│     • Return HTTP responses                          │
└──────────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│ APPLICATION LAYER (Use Cases - ORCHESTRATION)        │
│ ├── MobileMemberRegistrationService                  │
│ └── DesktopMemberRegistrationService                 │
│     • Orchestrate workflows                          │
│     • Coordinate domain services                     │
│     • Handle transactions                            │
│     • Dispatch events                                │
└──────────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│ DOMAIN LAYER (Business Logic - PURE)                 │
│ ├── Domain Services (Interfaces)                     │
│ │   ├── TenantUserProvisioningInterface             │
│ │   └── GeographyResolverInterface                  │
│ ├── Factories                                        │
│ │   └── MemberFactory                               │
│ ├── Aggregates                                       │
│ │   └── Member (approve, activate, canVote)         │
│ └── Events                                           │
│     └── MemberRegistered, MemberApproved             │
└──────────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER (Technical - ADAPTERS)          │
│ ├── Adapters                                         │
│ │   ├── TenantAuthProvisioningAdapter               │
│ │   └── GeographyValidationAdapter                  │
│ ├── Repositories                                     │
│ │   └── EloquentMemberRepository                    │
│ └── Resources                                        │
│     ├── MobileMemberResource                        │
│     └── DesktopMemberResource                       │
└──────────────────────────────────────────────────────┘
```

---

## Implementation Order (TDD-First)

### DAY 1: Domain & Application Layer Foundation (8 hours)

#### Phase 1.1: Domain Service Interfaces (1 hour)

**Test First (RED)**:
```bash
php artisan make:test Unit/Contexts/Membership/Domain/Services/TenantUserProvisioningTest
```

**Test Code**:
```php
/** @test */
public function it_provisions_tenant_user_for_mobile_registration()
{
    $dto = new MobileRegistrationDto(
        tenantId: 'uml',
        email: 'john@example.com',
        fullName: 'John Doe'
    );

    $userId = $this->provisioningService->provisionForMobile($dto);

    $this->assertInstanceOf(TenantUserId::class, $userId);
}
```

**Implementation (GREEN)**:

1. Create interface:
```php
// app/Contexts/Membership/Domain/Services/TenantUserProvisioningInterface.php
interface TenantUserProvisioningInterface
{
    /**
     * Provision tenant user for mobile registration
     *
     * Creates pending user account in TenantAuth context
     */
    public function provisionForMobile(MobileRegistrationDto $dto): TenantUserId;

    /**
     * Provision tenant user for desktop admin registration
     */
    public function provisionForDesktop(DesktopRegistrationDto $dto): TenantUserId;
}
```

2. Create geography interface:
```php
// app/Contexts/Membership/Domain/Services/GeographyResolverInterface.php
interface GeographyResolverInterface
{
    /**
     * Validate geography reference
     *
     * Anti-corruption layer for Geography context
     */
    public function validate(?string $geoReference): ?GeoReference;
}
```

#### Phase 1.2: DTOs (Data Transfer Objects) (1 hour)

**Create DTOs**:

```php
// app/Contexts/Membership/Application/DTOs/MobileRegistrationDto.php
readonly class MobileRegistrationDto
{
    public function __construct(
        public string $tenantId,
        public string $fullName,
        public string $email,
        public ?string $phone = null,
        public ?string $memberId = null,
        public ?string $geoReference = null,
        public ?string $deviceId = null,
        public ?string $appVersion = null,
        public ?string $platform = null
    ) {}

    public static function fromRequest(Request $request): self
    {
        return new self(
            tenantId: $request->route('tenant'),
            fullName: $request->input('full_name'),
            email: $request->input('email'),
            phone: $request->input('phone'),
            memberId: $request->input('member_id'),
            geoReference: $request->input('geo_reference'),
            deviceId: $request->input('device_id'),
            appVersion: $request->input('app_version'),
            platform: $request->input('platform')
        );
    }
}
```

```php
// app/Contexts/Membership/Application/DTOs/DesktopRegistrationDto.php
readonly class DesktopRegistrationDto
{
    public function __construct(
        public string $tenantId,
        public string $tenantUserId,  // Already exists (admin creates for user)
        public string $fullName,
        public string $email,
        public ?string $phone = null,
        public ?string $memberId = null,
        public ?string $geoReference = null
    ) {}

    public static function fromRequest(Request $request): self
    {
        return new self(
            tenantId: $request->route('tenant'),
            tenantUserId: $request->input('tenant_user_id'),
            fullName: $request->input('full_name'),
            email: $request->input('email'),
            phone: $request->input('phone'),
            memberId: $request->input('member_id'),
            geoReference: $request->input('geo_reference')
        );
    }
}
```

#### Phase 1.3: Domain Factory (2 hours)

**Test First (RED)**:
```bash
php artisan make:test Unit/Contexts/Membership/Domain/Factories/MemberFactoryTest
```

**Test Code**:
```php
/** @test */
public function it_creates_member_with_draft_status_for_mobile_channel()
{
    $member = MemberFactory::createForMobile(
        tenantId: new TenantId('uml'),
        tenantUserId: new TenantUserId('user_123'),
        personalInfo: new PersonalInfo('John Doe', new Email('john@example.com'))
    );

    $this->assertEquals('draft', $member->status->value());
    $this->assertEquals('mobile', $member->registration_channel);
}

/** @test */
public function it_creates_member_with_pending_status_for_desktop_channel()
{
    $member = MemberFactory::createForDesktop(
        tenantId: new TenantId('uml'),
        tenantUserId: new TenantUserId('user_123'),
        personalInfo: new PersonalInfo('John Doe', new Email('john@example.com'))
    );

    $this->assertEquals('pending', $member->status->value());
    $this->assertEquals('desktop', $member->registration_channel);
}
```

**Implementation (GREEN)**:

```php
// app/Contexts/Membership/Domain/Factories/MemberFactory.php
class MemberFactory
{
    /**
     * Create member from mobile registration
     *
     * Business Rule: Mobile registrations start as DRAFT
     */
    public static function createForMobile(
        TenantId $tenantId,
        TenantUserId $tenantUserId,
        PersonalInfo $personalInfo,
        ?MemberId $memberId = null,
        ?GeoReference $geoReference = null
    ): Member {
        return Member::register(
            tenantUserId: $tenantUserId->value(),
            tenantId: $tenantId->value(),
            personalInfo: $personalInfo,
            memberId: $memberId,
            geoReference: $geoReference?->value(),
            initialStatus: MemberStatus::draft(),  // Mobile → DRAFT
            registrationChannel: 'mobile'
        );
    }

    /**
     * Create member from desktop admin registration
     *
     * Business Rule: Admin registrations start as PENDING (skip DRAFT)
     */
    public static function createForDesktop(
        TenantId $tenantId,
        TenantUserId $tenantUserId,
        PersonalInfo $personalInfo,
        ?MemberId $memberId = null,
        ?GeoReference $geoReference = null
    ): Member {
        return Member::register(
            tenantUserId: $tenantUserId->value(),
            tenantId: $tenantId->value(),
            personalInfo: $personalInfo,
            memberId: $memberId,
            geoReference: $geoReference?->value(),
            initialStatus: MemberStatus::pending(),  // Desktop → PENDING
            registrationChannel: 'desktop'
        );
    }
}
```

**Update Member Aggregate**:

```php
// app/Contexts/Membership/Domain/Models/Member.php
public static function register(
    string $tenantUserId,
    string $tenantId,
    PersonalInfo $personalInfo,
    ?MemberId $memberId = null,
    ?string $geoReference = null,
    ?MemberStatus $initialStatus = null,  // NEW: Allow factory to set status
    ?string $registrationChannel = null   // NEW: Track channel
): self {
    // Validation
    if (empty(trim($tenantUserId))) {
        throw new \InvalidArgumentException('tenant_user_id cannot be empty');
    }

    // Create member
    $member = new self();
    $member->id = Str::ulid()->toBase32();
    $member->tenant_user_id = $tenantUserId;
    $member->tenant_id = $tenantId;
    $member->personal_info = $personalInfo;
    $member->member_id = $memberId;
    $member->residence_geo_reference = $geoReference;
    $member->status = $initialStatus ?? MemberStatus::draft();  // Default DRAFT
    $member->registration_channel = $registrationChannel ?? 'unknown';

    // Record domain event
    $member->recordThat(new MemberRegistered(
        memberId: $member->id,
        tenantUserId: $member->tenant_user_id,
        tenantId: $member->tenant_id,
        status: $member->status,
        personalInfo: $member->personal_info->toArray(),
        registrationChannel: $member->registration_channel
    ));

    return $member;
}
```

#### Phase 1.4: Application Services (4 hours)

**Test First (RED)**:
```bash
php artisan make:test Unit/Contexts/Membership/Application/Services/MobileMemberRegistrationServiceTest
```

**Test Code**:
```php
class MobileMemberRegistrationServiceTest extends TestCase
{
    /** @test */
    public function it_registers_member_from_mobile_with_draft_status()
    {
        // Mock dependencies
        $provisioning = Mockery::mock(TenantUserProvisioningInterface::class);
        $geoResolver = Mockery::mock(GeographyResolverInterface::class);
        $repository = Mockery::mock(MemberRepositoryInterface::class);

        // Setup mocks
        $provisioning->shouldReceive('provisionForMobile')
            ->andReturn(new TenantUserId('user_123'));

        $geoResolver->shouldReceive('validate')
            ->andReturn(null);

        $repository->shouldReceive('existsByTenantUserId')
            ->andReturn(false);

        $repository->shouldReceive('save')
            ->once();

        // Create service
        $service = new MobileMemberRegistrationService(
            $provisioning,
            $geoResolver,
            $repository
        );

        // Create DTO
        $dto = new MobileRegistrationDto(
            tenantId: 'uml',
            fullName: 'John Doe',
            email: 'john@example.com'
        );

        // Act
        $member = $service->register($dto);

        // Assert
        $this->assertEquals('draft', $member->status->value());
        $this->assertEquals('mobile', $member->registration_channel);
    }
}
```

**Implementation (GREEN)**:

```php
// app/Contexts/Membership/Application/Services/MobileMemberRegistrationService.php
class MobileMemberRegistrationService
{
    public function __construct(
        private readonly TenantUserProvisioningInterface $userProvisioning,
        private readonly GeographyResolverInterface $geoResolver,
        private readonly MemberRepositoryInterface $memberRepository
    ) {}

    public function register(MobileRegistrationDto $dto): Member
    {
        // 1. Provision tenant user (cross-context via interface)
        $tenantUserId = $this->userProvisioning->provisionForMobile($dto);

        // 2. Check if user already has membership
        if ($this->memberRepository->existsByTenantUserId($dto->tenantId, $tenantUserId->value())) {
            throw new \InvalidArgumentException(
                'This user is already registered as a member.'
            );
        }

        // 3. Validate geography reference (anti-corruption layer)
        $geoReference = $this->geoResolver->validate($dto->geoReference);

        // 4. Create value objects
        $personalInfo = new PersonalInfo(
            fullName: $dto->fullName,
            email: new Email($dto->email),
            phone: $dto->phone
        );

        $memberId = $dto->memberId ? new MemberId($dto->memberId) : null;

        // 5. Use factory to create member (domain decides status)
        $member = MemberFactory::createForMobile(
            tenantId: new TenantId($dto->tenantId),
            tenantUserId: $tenantUserId,
            personalInfo: $personalInfo,
            memberId: $memberId,
            geoReference: $geoReference
        );

        // 6. Persist
        $this->memberRepository->save($member);

        // 7. Side effects (queued jobs for email, push notifications, etc.)
        // Event listeners will handle these

        return $member;
    }
}
```

---

### DAY 2: Mobile API Implementation (CASE 2) (8 hours)

#### Phase 2.1: Mobile Controller (THIN) (2 hours)

**Create controller**:

```php
// app/Contexts/Membership/Infrastructure/Http/Controllers/Mobile/MemberController.php
class MemberController
{
    public function __construct(
        private readonly MobileMemberRegistrationService $registrationService,
        private readonly MemberRepositoryInterface $repository
    ) {}

    /**
     * Register member from mobile app
     *
     * POST /{tenant}/mapi/v1/members/register
     *
     * No authentication required (public endpoint)
     */
    public function register(MobileRegisterMemberRequest $request): JsonResponse
    {
        try {
            // Convert request to DTO
            $dto = MobileRegistrationDto::fromRequest($request);

            // Delegate to application service
            $member = $this->registrationService->register($dto);

            // Return mobile-specific resource
            return MobileMemberResource::make($member)
                ->additional([
                    'message' => 'Registration successful. Please check your email for verification.',
                ])
                ->response()
                ->setStatusCode(201);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'message' => 'Registration failed',
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get member profile (authenticated)
     *
     * GET /{tenant}/mapi/v1/members/me
     */
    public function profile(Request $request): JsonResponse
    {
        $member = $this->repository->findByTenantUserId(
            $request->route('tenant'),
            $request->user()->id
        );

        if (!$member) {
            return response()->json(['message' => 'Member not found'], 404);
        }

        return MobileMemberResource::make($member)
            ->response();
    }
}
```

#### Phase 2.2: Mobile FormRequest (2 hours)

```php
// app/Contexts/Membership/Infrastructure/Http/Requests/Mobile/RegisterMemberRequest.php
class RegisterMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Public endpoint - no authentication required
        return true;
    }

    public function rules(): array
    {
        $tenant = $this->route('tenant');

        return [
            'full_name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => ['required', 'email:rfc,dns', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9\s\-\(\)]+$/'],
            'member_id' => [
                'nullable',
                'string',
                'max:50',
                'regex:/^[A-Z0-9\-]+$/',
                Rule::unique('members', 'member_id')->where('tenant_id', $tenant),
            ],
            'geo_reference' => ['nullable', 'string', 'max:500'],

            // Mobile-specific fields
            'device_id' => ['nullable', 'string', 'max:255'],
            'app_version' => ['required', 'string', 'max:50'],
            'platform' => ['required', 'string', 'in:ios,android,web'],
        ];
    }

    public function messages(): array
    {
        return [
            'full_name.required' => 'Full name is required.',
            'email.required' => 'Email address is required.',
            'email.email' => 'Email address must be valid.',
            'app_version.required' => 'App version is required.',
            'platform.required' => 'Platform (ios/android/web) is required.',
        ];
    }
}
```

#### Phase 2.3: Mobile Resource (2 hours)

```php
// app/Contexts/Membership/Infrastructure/Http/Resources/MobileMemberResource.php
class MobileMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'type' => 'members',
            'id' => $this->id,
            'attributes' => [
                'member_id' => $this->member_id?->value(),
                'personal_info' => [
                    'full_name' => $this->personal_info->fullName,
                    'email' => $this->personal_info->email->value(),
                    'phone' => $this->personal_info->phone,
                ],
                'status' => $this->status->value(),
                'residence_geo_reference' => $this->residence_geo_reference,
                'membership_type' => $this->membership_type,
            ],
            'meta' => [
                'verification_required' => $this->status->isDraft(),
                'next_action' => $this->getNextAction(),
                'created_at' => $this->created_at?->toIso8601String(),
            ],
            'links' => $this->mobileLinks(),
        ];
    }

    private function mobileLinks(): array
    {
        return [
            'self' => route('mobile.members.profile', [
                'tenant' => $this->tenant_id,
            ]),
            'verify' => $this->status->isDraft()
                ? route('mobile.members.verify', ['tenant' => $this->tenant_id])
                : null,
        ];
    }

    private function getNextAction(): string
    {
        return match($this->status->value()) {
            'draft' => 'verify_email',
            'pending' => 'await_approval',
            'approved' => 'activate_account',
            'active' => 'explore_features',
            default => 'contact_support',
        };
    }
}
```

#### Phase 2.4: Mobile Routes (2 hours)

```php
// routes/tenant-mapi/membership.php
use App\Contexts\Membership\Infrastructure\Http\Controllers\Mobile\MemberController;

Route::prefix('{tenant}/mapi/v1/members')
    ->middleware(['api', 'identify.tenant'])
    ->name('mobile.members.')
    ->group(function () {

        // PUBLIC: Member registration
        Route::post('/register', [MemberController::class, 'register'])
            ->middleware(['throttle:mobile.registration'])
            ->name('register');

        // PROTECTED: Member profile (requires Sanctum token)
        Route::middleware(['auth:sanctum'])->group(function () {
            Route::get('/me', [MemberController::class, 'profile'])
                ->name('profile');

            Route::put('/me', [MemberController::class, 'update'])
                ->name('update');

            Route::post('/verify', [MemberController::class, 'verify'])
                ->name('verify');
        });
    });
```

**Load routes** in `bootstrap/app.php`:
```php
// After existing tenant routes
if (file_exists(base_path('routes/tenant-mapi/membership.php'))) {
    require base_path('routes/tenant-mapi/membership.php');
}
```

**Configure rate limiter** in `app/Providers/AppServiceProvider.php`:
```php
RateLimiter::for('mobile.registration', function (Request $request) {
    return Limit::perMinute(10)->by($request->ip());
});
```

---

### DAY 3: Desktop API Implementation (CASE 4) (8 hours)

#### Phase 3.1: Desktop Application Service (2 hours)

```php
// app/Contexts/Membership/Application/Services/DesktopMemberRegistrationService.php
class DesktopMemberRegistrationService
{
    public function __construct(
        private readonly TenantUserProvisioningInterface $userProvisioning,
        private readonly GeographyResolverInterface $geoResolver,
        private readonly MemberRepositoryInterface $memberRepository,
        private readonly IdentityVerificationInterface $identityVerifier
    ) {}

    public function register(DesktopRegistrationDto $dto): Member
    {
        // 1. Verify tenant user exists (admin provides existing user ID)
        if (!$this->identityVerifier->userExists($dto->tenantUserId, $dto->tenantId)) {
            throw new \InvalidArgumentException(
                'User identity must exist before member registration.'
            );
        }

        // 2. Check if user already has membership
        if ($this->memberRepository->existsByTenantUserId($dto->tenantId, $dto->tenantUserId)) {
            throw new \InvalidArgumentException(
                'This user is already registered as a member.'
            );
        }

        // 3. Validate geography reference
        $geoReference = $this->geoResolver->validate($dto->geoReference);

        // 4. Create value objects
        $personalInfo = new PersonalInfo(
            fullName: $dto->fullName,
            email: new Email($dto->email),
            phone: $dto->phone
        );

        $memberId = $dto->memberId ? new MemberId($dto->memberId) : null;

        // 5. Use factory to create member (desktop → PENDING status)
        $member = MemberFactory::createForDesktop(
            tenantId: new TenantId($dto->tenantId),
            tenantUserId: new TenantUserId($dto->tenantUserId),
            personalInfo: $personalInfo,
            memberId: $memberId,
            geoReference: $geoReference
        );

        // 6. Persist
        $this->memberRepository->save($member);

        return $member;
    }
}
```

#### Phase 3.2: Desktop Controller (2 hours)

```php
// app/Contexts/Membership/Infrastructure/Http/Controllers/Desktop/MemberController.php
class MemberController
{
    public function __construct(
        private readonly DesktopMemberRegistrationService $registrationService,
        private readonly MemberRepositoryInterface $repository
    ) {}

    /**
     * Register member from desktop admin
     *
     * POST /{tenant}/api/v1/members
     *
     * Authentication required (session-based)
     */
    public function store(DesktopRegisterMemberRequest $request): JsonResponse
    {
        try {
            $dto = DesktopRegistrationDto::fromRequest($request);
            $member = $this->registrationService->register($dto);

            return DesktopMemberResource::make($member)
                ->response()
                ->setStatusCode(201);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'message' => 'Registration failed',
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * List members with filters
     *
     * GET /{tenant}/api/v1/members
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $members = $this->repository->findByTenant(
            $request->route('tenant'),
            $request->input('page', 1),
            $request->input('per_page', 15)
        );

        return DesktopMemberResource::collection($members);
    }

    /**
     * Approve member
     *
     * POST /{tenant}/api/v1/members/{id}/approve
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $member = $this->repository->findById($id);

        if (!$member) {
            return response()->json(['message' => 'Member not found'], 404);
        }

        // Call domain method
        $member->approve();

        // Save
        $this->repository->save($member);

        return response()->json([
            'message' => 'Member approved successfully',
            'data' => new DesktopMemberResource($member),
        ]);
    }
}
```

#### Phase 3.3: Desktop Resource (2 hours)

```php
// app/Contexts/Membership/Infrastructure/Http/Resources/DesktopMemberResource.php
class DesktopMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'type' => 'members',
            'id' => $this->id,
            'attributes' => [
                'member_id' => $this->member_id?->value(),
                'tenant_user_id' => $this->tenant_user_id,
                'personal_info' => $this->personal_info->toArray(),
                'status' => $this->status->value(),
                'residence_geo_reference' => $this->residence_geo_reference,
                'membership_type' => $this->membership_type,
                'registration_channel' => $this->registration_channel,
                'can_vote' => $this->canVote(),
                'can_hold_committee_role' => $this->canHoldCommitteeRole(),
            ],
            'meta' => [
                'created_at' => $this->created_at?->toIso8601String(),
                'updated_at' => $this->updated_at?->toIso8601String(),
                'approval_status' => $this->getApprovalStatus(),
            ],
            'links' => $this->desktopLinks(),
        ];
    }

    private function desktopLinks(): array
    {
        return [
            'self' => route('desktop.members.show', [
                'tenant' => $this->tenant_id,
                'id' => $this->id,
            ]),
            'approve' => $this->status->canBeApproved()
                ? route('desktop.members.approve', ['tenant' => $this->tenant_id, 'id' => $this->id])
                : null,
            'activate' => $this->status->canBeActivated()
                ? route('desktop.members.activate', ['tenant' => $this->tenant_id, 'id' => $this->id])
                : null,
        ];
    }

    private function getApprovalStatus(): array
    {
        return [
            'can_approve' => $this->status->canBeApproved(),
            'can_activate' => $this->status->canBeActivated(),
            'requires_action' => $this->status->isDraft() || $this->status->isPending(),
        ];
    }
}
```

#### Phase 3.4: Desktop Routes (2 hours)

```php
// routes/tenant-api/membership.php
use App\Contexts\Membership\Infrastructure\Http\Controllers\Desktop\MemberController;

Route::prefix('{tenant}/api/v1/members')
    ->middleware(['web', 'identify.tenant', 'auth'])
    ->name('desktop.members.')
    ->group(function () {

        // List members
        Route::get('/', [MemberController::class, 'index'])
            ->name('index');

        // Register member (admin)
        Route::post('/', [MemberController::class, 'store'])
            ->middleware(['can:manage_members'])
            ->name('store');

        // Get member detail
        Route::get('/{id}', [MemberController::class, 'show'])
            ->name('show');

        // Approve member
        Route::post('/{id}/approve', [MemberController::class, 'approve'])
            ->middleware(['can:approve_members'])
            ->name('approve');

        // Activate member
        Route::post('/{id}/activate', [MemberController::class, 'activate'])
            ->middleware(['can:activate_members'])
            ->name('activate');
    });
```

---

### DAY 4: Infrastructure Adapters (8 hours)

#### Phase 4.1: TenantAuth Provisioning Adapter (4 hours)

```php
// app/Contexts/Membership/Infrastructure/Services/TenantAuthProvisioningAdapter.php
class TenantAuthProvisioningAdapter implements TenantUserProvisioningInterface
{
    public function __construct(
        private readonly TenantUserRepositoryInterface $tenantUserRepository
    ) {}

    public function provisionForMobile(MobileRegistrationDto $dto): TenantUserId
    {
        // Create pending tenant user (no password yet)
        $user = $this->tenantUserRepository->createPendingUser([
            'tenant_id' => $dto->tenantId,
            'email' => $dto->email,
            'full_name' => $dto->fullName,
            'phone' => $dto->phone,
            'status' => 'pending_verification',
            'created_via' => 'mobile_registration',
        ]);

        // Generate verification token
        // This would call TenantAuth context's verification service

        return new TenantUserId($user->id);
    }

    public function provisionForDesktop(DesktopRegistrationDto $dto): TenantUserId
    {
        // Desktop: user already exists, just return ID
        return new TenantUserId($dto->tenantUserId);
    }
}
```

#### Phase 4.2: Geography Validation Adapter (4 hours)

```php
// app/Contexts/Membership/Infrastructure/Services/GeographyValidationAdapter.php
class GeographyValidationAdapter implements GeographyResolverInterface
{
    public function __construct(
        private readonly GeographyServiceInterface $geographyService
    ) {}

    public function validate(?string $geoReference): ?GeoReference
    {
        if ($geoReference === null) {
            return null;
        }

        try {
            // Call Geography context via anti-corruption layer
            $isValid = $this->geographyService->validateReference($geoReference);

            if (!$isValid) {
                throw new \InvalidArgumentException(
                    "Invalid geography reference: {$geoReference}"
                );
            }

            return new GeoReference($geoReference);

        } catch (\Exception $e) {
            // Log error but don't fail registration
            \Log::warning('Geography validation failed', [
                'geo_reference' => $geoReference,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
```

---

### DAY 5: Testing & Integration (8 hours)

#### Phase 5.1: Unit Tests (4 hours)

**Domain Factory Tests**:
```bash
php artisan test tests/Unit/Contexts/Membership/Domain/Factories/MemberFactoryTest.php
```

**Application Service Tests**:
```bash
php artisan test tests/Unit/Contexts/Membership/Application/Services/MobileMemberRegistrationServiceTest.php
php artisan test tests/Unit/Contexts/Membership/Application/Services/DesktopMemberRegistrationServiceTest.php
```

#### Phase 5.2: Feature Tests (3 hours)

**Mobile API Tests**:
```php
// tests/Feature/Contexts/Membership/Mobile/MemberRegistrationTest.php
class MemberRegistrationTest extends TestCase
{
    /** @test */
    public function member_can_register_via_mobile_api()
    {
        $response = $this->postJson('/uml/mapi/v1/members/register', [
            'full_name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '+977-9841234567',
            'app_version' => '1.0.0',
            'platform' => 'ios',
        ]);

        $response->assertStatus(201)
                 ->assertJsonStructure([
                     'data' => ['type', 'id', 'attributes'],
                     'message',
                 ]);

        $this->assertDatabaseHas('members', [
            'status' => 'draft',
            'registration_channel' => 'mobile',
        ]);
    }
}
```

**Desktop API Tests**:
```php
// tests/Feature/Contexts/Membership/Desktop/MemberApprovalTest.php
class MemberApprovalTest extends TestCase
{
    /** @test */
    public function admin_can_approve_draft_member()
    {
        $admin = TenantUser::factory()->create();
        $this->actingAs($admin);

        $member = Member::factory()->create(['status' => 'draft']);

        $response = $this->postJson("/uml/api/v1/members/{$member->id}/approve");

        $response->assertStatus(200);

        $this->assertDatabaseHas('members', [
            'id' => $member->id,
            'status' => 'approved',
        ]);
    }
}
```

#### Phase 5.3: Integration Tests (1 hour)

```php
// tests/Feature/Contexts/Membership/Integration/MobileToDesktopFlowTest.php
class MobileToDesktopFlowTest extends TestCase
{
    /** @test */
    public function full_member_lifecycle_from_mobile_to_activation()
    {
        // 1. Mobile registration
        $mobileResponse = $this->postJson('/uml/mapi/v1/members/register', [
            'full_name' => 'John Doe',
            'email' => 'john@example.com',
            'app_version' => '1.0.0',
            'platform' => 'ios',
        ]);

        $mobileResponse->assertStatus(201);
        $memberId = $mobileResponse->json('data.id');

        // 2. Admin approves (desktop)
        $admin = TenantUser::factory()->create();
        $this->actingAs($admin);

        $approveResponse = $this->postJson("/uml/api/v1/members/{$memberId}/approve");
        $approveResponse->assertStatus(200);

        // 3. Admin activates (desktop)
        $activateResponse = $this->postJson("/uml/api/v1/members/{$memberId}/activate");
        $activateResponse->assertStatus(200);

        // 4. Verify final state
        $this->assertDatabaseHas('members', [
            'id' => $memberId,
            'status' => 'active',
        ]);
    }
}
```

---

## Testing Coverage Goals

### Unit Tests (60%)
- ✅ MemberFactory (mobile/desktop creation)
- ✅ MobileMemberRegistrationService
- ✅ DesktopMemberRegistrationService
- ✅ Domain service mocks

### Feature Tests (30%)
- ✅ Mobile registration API
- ✅ Mobile profile API
- ✅ Desktop registration API
- ✅ Desktop approval workflow
- ✅ Validation error scenarios

### Integration Tests (10%)
- ✅ Mobile → Desktop flow
- ✅ Draft → Approved → Active lifecycle

---

## Service Provider Bindings

Update `MembershipServiceProvider`:

```php
public function register(): void
{
    // Existing bindings
    $this->app->bind(
        MemberRepositoryInterface::class,
        EloquentMemberRepository::class
    );

    $this->app->bind(
        IdentityVerificationInterface::class,
        TenantUserIdentityVerification::class
    );

    // NEW: Domain service bindings
    $this->app->bind(
        TenantUserProvisioningInterface::class,
        TenantAuthProvisioningAdapter::class
    );

    $this->app->bind(
        GeographyResolverInterface::class,
        GeographyValidationAdapter::class
    );

    // NEW: Application service bindings
    $this->app->singleton(MobileMemberRegistrationService::class);
    $this->app->singleton(DesktopMemberRegistrationService::class);

    // Existing handler binding
    $this->app->singleton(RegisterMemberHandler::class, function ($app) {
        return new RegisterMemberHandler(
            $app->make(MemberRepositoryInterface::class),
            $app->make(IdentityVerificationInterface::class)
        );
    });
}
```

---

## Success Criteria

### Functional
- ✅ Mobile registration creates DRAFT members
- ✅ Desktop registration creates PENDING members
- ✅ Admin can approve members
- ✅ Admin can activate members
- ✅ Geography validation via ACL
- ✅ Tenant user provisioning via interface

### Architectural
- ✅ Controllers are thin (< 20 lines per method)
- ✅ Business logic in Application Services
- ✅ Domain services defined as interfaces
- ✅ Separate mobile/desktop resources
- ✅ Factory pattern for domain creation
- ✅ No direct context coupling

### Testing
- ✅ 60% unit test coverage (domain/application)
- ✅ 30% feature test coverage (HTTP)
- ✅ 10% integration test coverage
- ✅ All tests passing
- ✅ TDD workflow followed

---

## Risk Mitigation

### High Risk: Public Mobile Endpoint

**Threat**: Spam registrations

**Mitigation**:
- Rate limiting (10/min per IP)
- Email verification required
- CAPTCHA for suspicious activity
- Monitoring and alerting

### Medium Risk: Cross-Context Dependencies

**Threat**: Tight coupling to TenantAuth/Geography

**Mitigation**:
- Domain service interfaces
- Anti-corruption layer
- Mock implementations for testing
- Clear contract definitions

---

## Deployment Checklist

- [ ] All tests passing (unit + feature + integration)
- [ ] Service provider bindings registered
- [ ] Routes loaded correctly
- [ ] Rate limiters configured
- [ ] Database migrations run
- [ ] Queue workers running (for emails)
- [ ] Mobile API tested with Postman
- [ ] Desktop API tested with Vue admin
- [ ] Monitoring configured
- [ ] Error logging validated

---

## Conclusion

This corrected plan addresses all architectural flaws identified in the review:

1. ✅ **Thin Controllers**: Business logic in Application Services
2. ✅ **Context Boundaries**: Domain service interfaces prevent coupling
3. ✅ **Separate Concerns**: Mobile/Desktop resources isolated
4. ✅ **Domain Factory**: Creation logic in domain layer
5. ✅ **Anti-Corruption**: Geography accessed via ACL
6. ✅ **Proper Testing**: 60/30/10 pyramid distribution

**Ready for TDD implementation starting with Day 1: Domain & Application Layer Foundation.**

---

**Last Updated**: 2026-01-02 20:30
**Status**: ✅ Corrected Architecture - Ready for Implementation
**Next Step**: Begin Day 1, Phase 1.1 - Domain Service Interfaces (TDD)
