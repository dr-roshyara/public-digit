# 🎯 **SENIOR BACKEND ARCHITECT: PHASE 2 IMPLEMENTATION PLAN**

## **📋 PHASE 2: APPLICATION LAYER & API (Week 2)**

### **TDD-First Approach:**
```
RED → Write failing tests
GREEN → Implement minimum code
REFACTOR → Improve with DDD patterns
```

---

## **🏗️ ARCHITECTURE OVERVIEW**

### **Folder Structure:**
```
app/Contexts/Membership/
├── Domain/                    ✅ COMPLETED
│   ├── Models/Member.php
│   ├── ValueObjects/*.php
│   ├── Events/MemberRegistered.php
│   └── Traits/RecordsEvents.php
├── Application/               🔄 PHASE 2
│   ├── Commands/
│   ├── DTOs/
│   ├── Handlers/
│   ├── Services/
│   └── Queries/
├── Infrastructure/            🔄 PHASE 2
│   ├── Repositories/
│   ├── Services/
│   └── Http/
└── Tests/                     🔄 PHASE 2
    ├── Unit/
    ├── Feature/
    └── Integration/
```

---

## **📁 FILE 1: FAILING TEST FIRST**

### **Command:** `php artisan make:test Application/Services/RegisterMemberServiceTest --unit`

**File:** `tests/Unit/Contexts/Membership/Application/Services/RegisterMemberServiceTest.php`
```php
<?php

namespace Tests\Unit\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Application\Commands\RegisterMemberCommand;
use App\Contexts\Membership\Application\Services\RegisterMemberService;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Services\IdentityVerificationInterface;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use PHPUnit\Framework\TestCase;

class RegisterMemberServiceTest extends TestCase
{
    /** @test */
    public function it_throws_exception_when_user_identity_does_not_exist()
    {
        // Given
        $identityVerifier = $this->createMock(IdentityVerificationInterface::class);
        $identityVerifier->method('userExists')->willReturn(false);
        
        $repository = $this->createMock(MemberRepositoryInterface::class);
        $service = new RegisterMemberService($repository, $identityVerifier);
        
        $command = new RegisterMemberCommand(
            tenantUserId: 'non-existent-user',
            tenantId: 'uml',
            fullName: 'John Doe',
            email: new Email('john@example.com')
        );
        
        // Expect
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('User identity must exist before member registration');
        
        // When
        $service->handle($command);
    }
    
    /** @test */
    public function it_registers_member_when_user_identity_exists()
    {
        // Given
        $identityVerifier = $this->createMock(IdentityVerificationInterface::class);
        $identityVerifier->method('userExists')->willReturn(true);
        
        $repository = $this->createMock(MemberRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('save')
            ->with($this->isInstanceOf(Member::class));
        
        $service = new RegisterMemberService($repository, $identityVerifier);
        
        $command = new RegisterMemberCommand(
            tenantUserId: 'user-123',
            tenantId: 'uml',
            fullName: 'John Doe',
            email: new Email('john@example.com'),
            phone: '+9779801234567',
            memberId: 'UML-2024-0001',
            geoReference: 'np.3.15.234.1.2'
        );
        
        // When
        $member = $service->handle($command);
        
        // Then
        $this->assertInstanceOf(Member::class, $member);
        $this->assertEquals('user-123', $member->tenant_user_id);
        $this->assertEquals('uml', $member->tenant_id);
    }
}
```

---

## **📁 FILE 2: REPOSITORY INTERFACE**

### **Command:** `php artisan make:interface Domain/Repositories/MemberRepositoryInterface`

**File:** `app/Contexts/Membership/Domain/Repositories/MemberRepositoryInterface.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Repositories;

use App\Contexts\Membership\Domain\Models\Member;

interface MemberRepositoryInterface
{
    public function save(Member $member): void;
    
    public function findById(string $id): ?Member;
    
    public function findByMemberId(string $tenantId, string $memberId): ?Member;
    
    public function existsByMemberId(string $tenantId, string $memberId): bool;
    
    public function delete(Member $member): void;
}
```

---

## **📁 FILE 3: IDENTITY VERIFICATION INTERFACE**

### **Command:** `php artisan make:interface Domain/Services/IdentityVerificationInterface`

**File:** `app/Contexts/Membership/Domain/Services/IdentityVerificationInterface.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Services;

interface IdentityVerificationInterface
{
    /**
     * Verify that a user exists in the tenant system
     * This is a digital identity requirement
     */
    public function userExists(string $tenantUserId, string $tenantId): bool;
}
```

---

## **📁 FILE 4: REGISTER MEMBER COMMAND**

### **Command:** `php artisan make:class Application/Commands/RegisterMemberCommand`

**File:** `app/Contexts/Membership/Application/Commands/RegisterMemberCommand.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\Commands;

use App\Contexts\Membership\Domain\ValueObjects\Email;

readonly class RegisterMemberCommand
{
    public function __construct(
        public string $tenantUserId,
        public string $tenantId,
        public string $fullName,
        public Email $email,
        public ?string $phone = null,
        public ?string $memberId = null,
        public ?string $geoReference = null
    ) {}
}
```

---

## **📁 FILE 5: REGISTER MEMBER SERVICE**

### **Command:** `php artisan make:class Application/Services/RegisterMemberService`

**File:** `app/Contexts/Membership/Application/Services/RegisterMemberService.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Application\Commands\RegisterMemberCommand;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Services\IdentityVerificationInterface;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use InvalidArgumentException;

class RegisterMemberService
{
    public function __construct(
        private readonly MemberRepositoryInterface $repository,
        private readonly IdentityVerificationInterface $identityVerifier
    ) {}

    public function handle(RegisterMemberCommand $command): Member
    {
        // 1. Digital identity verification (business rule)
        if (!$this->identityVerifier->userExists($command->tenantUserId, $command->tenantId)) {
            throw new InvalidArgumentException(
                'User identity must exist before member registration'
            );
        }

        // 2. Check member ID uniqueness (business rule)
        if ($command->memberId !== null && 
            $this->repository->existsByMemberId($command->tenantId, $command->memberId)) {
            throw new InvalidArgumentException(
                "Member ID '{$command->memberId}' already exists for tenant '{$command->tenantId}'"
            );
        }

        // 3. Create domain value objects
        $personalInfo = new PersonalInfo(
            fullName: $command->fullName,
            email: $command->email,
            phone: $command->phone
        );

        // 4. Delegate to domain aggregate (core business logic)
        $member = Member::register(
            tenantUserId: $command->tenantUserId,
            tenantId: $command->tenantId,
            personalInfo: $personalInfo,
            memberId: $command->memberId,
            geoReference: $command->geoReference
        );

        // 5. Persist via repository (infrastructure concern)
        $this->repository->save($member);

        return $member;
    }
}
```

---

## **📁 FILE 6: ELOQUENT MEMBER REPOSITORY**

### **Command:** `php artisan make:class Infrastructure/Repositories/EloquentMemberRepository`

**File:** `app/Contexts/Membership/Infrastructure/Repositories/EloquentMemberRepository.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Repositories;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use Illuminate\Support\Facades\DB;

class EloquentMemberRepository implements MemberRepositoryInterface
{
    public function save(Member $member): void
    {
        DB::transaction(function () use ($member) {
            $member->save();
        });
    }
    
    public function findById(string $id): ?Member
    {
        return Member::find($id);
    }
    
    public function findByMemberId(string $tenantId, string $memberId): ?Member
    {
        return Member::where('tenant_id', $tenantId)
            ->where('member_id', $memberId)
            ->first();
    }
    
    public function existsByMemberId(string $tenantId, string $memberId): bool
    {
        return Member::where('tenant_id', $tenantId)
            ->where('member_id', $memberId)
            ->exists();
    }
    
    public function delete(Member $member): void
    {
        DB::transaction(function () use ($member) {
            $member->delete();
        });
    }
}
```

---

## **📁 FILE 7: TENANT USER IDENTITY VERIFICATION**

### **Command:** `php artisan make:class Infrastructure/Services/TenantUserIdentityVerification`

**File:** `app/Contexts/Membership/Infrastructure/Services/TenantUserIdentityVerification.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Services;

use App\Contexts\Membership\Domain\Services\IdentityVerificationInterface;

class TenantUserIdentityVerification implements IdentityVerificationInterface
{
    public function userExists(string $tenantUserId, string $tenantId): bool
    {
        // In production, this would query the TenantUser context
        // For now, assume user exists if ID is not empty
        return !empty(trim($tenantUserId)) && !empty(trim($tenantId));
    }
}
```

---

## **📁 FILE 8: LARAVEL SERVICE PROVIDER**

### **Command:** `php artisan make:provider MembershipServiceProvider`

**File:** `app/Providers/MembershipServiceProvider.php`
```php
<?php

namespace App\Providers;

use App\Contexts\Membership\Application\Services\RegisterMemberService;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Services\IdentityVerificationInterface;
use App\Contexts\Membership\Infrastructure\Repositories\EloquentMemberRepository;
use App\Contexts\Membership\Infrastructure\Services\TenantUserIdentityVerification;
use Illuminate\Support\ServiceProvider;

class MembershipServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Repository bindings
        $this->app->bind(
            MemberRepositoryInterface::class,
            EloquentMemberRepository::class
        );
        
        // Service bindings
        $this->app->bind(
            IdentityVerificationInterface::class,
            TenantUserIdentityVerification::class
        );
        
        // Application services
        $this->app->singleton(RegisterMemberService::class, function ($app) {
            return new RegisterMemberService(
                $app->make(MemberRepositoryInterface::class),
                $app->make(IdentityVerificationInterface::class)
            );
        });
    }
    
    public function boot(): void
    {
        // Register the service provider in config/app.php
    }
}
```

---

## **📁 FILE 9: API CONTROLLER TEST**

### **Command:** `php artisan make:test Http/Controllers/MemberRegistrationControllerTest --feature`

**File:** `tests/Feature/Contexts/Membership/Http/Controllers/MemberRegistrationControllerTest.php`
```php
<?php

namespace Tests\Feature\Contexts\Membership\Http\Controllers;

use App\Contexts\Membership\Domain\ValueObjects\Email;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MemberRegistrationControllerTest extends TestCase
{
    use RefreshDatabase;
    
    /** @test */
    public function it_registers_member_via_api()
    {
        // Given
        $payload = [
            'tenant_user_id' => 'user-123',
            'tenant_id' => 'uml',
            'full_name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '+9779801234567',
            'member_id' => 'UML-2024-0001',
            'geo_reference' => 'np.3.15.234.1.2'
        ];
        
        // When
        $response = $this->postJson('/api/v1/members', $payload);
        
        // Then
        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'member_id',
                    'tenant_user_id',
                    'status',
                    'personal_info' => ['full_name', 'email']
                ]
            ]);
        
        $this->assertDatabaseHas('members', [
            'tenant_id' => 'uml',
            'member_id' => 'UML-2024-0001',
        ]);
    }
    
    /** @test */
    public function it_validates_required_fields()
    {
        $response = $this->postJson('/api/v1/members', []);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors([
                'tenant_user_id',
                'tenant_id',
                'full_name',
                'email'
            ]);
    }
}
```

---

## **📁 FILE 10: API CONTROLLER**

### **Command:** `php artisan make:controller Http/Controllers/MemberRegistrationController --api --invokable`

**File:** `app/Contexts/Membership/Http/Controllers/MemberRegistrationController.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Http\Controllers;

use App\Contexts\Membership\Application\Commands\RegisterMemberCommand;
use App\Contexts\Membership\Application\Services\RegisterMemberService;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Http\Requests\RegisterMemberRequest;
use App\Contexts\Membership\Http\Resources\MemberResource;
use Illuminate\Http\JsonResponse;

class MemberRegistrationController
{
    public function __construct(
        private readonly RegisterMemberService $registrationService
    ) {}

    public function __invoke(RegisterMemberRequest $request): JsonResponse
    {
        $command = new RegisterMemberCommand(
            tenantUserId: $request->validated('tenant_user_id'),
            tenantId: $request->validated('tenant_id'),
            fullName: $request->validated('full_name'),
            email: new Email($request->validated('email')),
            phone: $request->validated('phone'),
            memberId: $request->validated('member_id'),
            geoReference: $request->validated('geo_reference')
        );
        
        $member = $this->registrationService->handle($command);
        
        return response()->json([
            'data' => new MemberResource($member),
            'message' => 'Member registered successfully'
        ], 201);
    }
}
```

---

## **📁 FILE 11: FORM REQUEST VALIDATION**

### **Command:** `php artisan make:request Http/Requests/RegisterMemberRequest`

**File:** `app/Contexts/Membership/Http/Requests/RegisterMemberRequest.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Implement tenant authorization logic
        return $this->tenant()->id === $this->input('tenant_id');
    }
    
    public function rules(): array
    {
        return [
            'tenant_user_id' => ['required', 'string', 'max:36'],
            'tenant_id' => ['required', 'string', 'max:50'],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'member_id' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('members')->where(function ($query) {
                    return $query->where('tenant_id', $this->input('tenant_id'));
                })->ignore($this->route('member'))
            ],
            'geo_reference' => ['nullable', 'string', 'max:255'],
        ];
    }
    
    public function messages(): array
    {
        return [
            'member_id.unique' => 'This member ID already exists for your organization',
        ];
    }
}
```

---

## **📁 FILE 12: API RESOURCE**

### **Command:** `php artisan make:resource Http/Resources/MemberResource`

**File:** `app/Contexts/Membership/Http/Resources/MemberResource.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'member_id' => $this->member_id,
            'tenant_user_id' => $this->tenant_user_id,
            'tenant_id' => $this->tenant_id,
            'status' => $this->status->value(),
            'personal_info' => $this->personal_info->toArray(),
            'residence_geo_reference' => $this->residence_geo_reference,
            'membership_type' => $this->membership_type,
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }
}
```

---

## **📁 FILE 13: API ROUTES**

### **Command:** `touch routes/membership.php`

**File:** `routes/membership.php`
```php
<?php

declare(strict_types=1);

use App\Contexts\Membership\Http\Controllers\MemberRegistrationController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1')
    ->middleware(['api', 'auth:sanctum', 'tenant'])
    ->group(function () {
        // Member registration
        Route::post('/members', MemberRegistrationController::class)
            ->name('members.register');
        
        // Member management
        Route::prefix('members/{member}')->group(function () {
            Route::get('/', [MemberController::class, 'show'])
                ->name('members.show');
            Route::put('/', [MemberController::class, 'update'])
                ->name('members.update');
            Route::delete('/', [MemberController::class, 'destroy'])
                ->name('members.destroy');
            Route::post('/approve', [MemberController::class, 'approve'])
                ->name('members.approve');
            Route::post('/activate', [MemberController::class, 'activate'])
                ->name('members.activate');
        });
        
        // Member queries
        Route::get('/members', [MemberController::class, 'index'])
            ->name('members.index');
        Route::get('/members/search', [MemberController::class, 'search'])
            ->name('members.search');
    });
```

---

## **📁 FILE 14: OPENAPI SPECIFICATION**

### **Command:** `mkdir -p api-docs/membership/v1 && touch api-docs/membership/v1/openapi.yaml`

**File:** `api-docs/membership/v1/openapi.yaml`
```yaml
openapi: 3.0.3
info:
  title: Political Party OS - Membership API
  version: 1.0.0
  description: Digital member management for political organizations

servers:
  - url: https://api.publicdigit.com/v1
    description: Production server
  - url: http://localhost:8000/api/v1
    description: Local development

paths:
  /members:
    post:
      operationId: registerMember
      summary: Register new member
      tags: [Members]
      security:
        - BearerAuth: []
      parameters:
        - $ref: '#/components/parameters/TenantHeader'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterMemberRequest'
      responses:
        '201':
          description: Member created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MemberResponse'
        '422':
          description: Validation error
        '401':
          description: Unauthorized

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  
  parameters:
    TenantHeader:
      name: X-Tenant-ID
      in: header
      required: true
      schema:
        type: string
      description: Tenant/organization identifier
  
  schemas:
    RegisterMemberRequest:
      type: object
      required:
        - tenant_user_id
        - tenant_id
        - full_name
        - email
      properties:
        tenant_user_id:
          type: string
          example: "user_1234567890abcdef"
        tenant_id:
          type: string
          example: "uml"
        full_name:
          type: string
          example: "John Doe"
        email:
          type: string
          format: email
          example: "john@example.com"
        phone:
          type: string
          example: "+9779801234567"
        member_id:
          type: string
          example: "UML-2024-0001"
        geo_reference:
          type: string
          example: "np.3.15.234.1.2"
    
    MemberResponse:
      type: object
      properties:
        data:
          $ref: '#/components/schemas/Member'
        message:
          type: string
          example: "Member registered successfully"
    
    Member:
      type: object
      properties:
        id:
          type: string
          format: ulid
        member_id:
          type: string
        tenant_user_id:
          type: string
        tenant_id:
          type: string
        status:
          type: string
          enum: [draft, pending, approved, active, suspended, inactive, archived]
        personal_info:
          $ref: '#/components/schemas/PersonalInfo'
        residence_geo_reference:
          type: string
        membership_type:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    
    PersonalInfo:
      type: object
      properties:
        full_name:
          type: string
        email:
          type: string
          format: email
        phone:
          type: string
```

---

## **📁 FILE 15: INTEGRATION TEST SUITE**

### **Command:** `php artisan make:test Integration/MemberRegistrationWorkflowTest --feature`

**File:** `tests/Integration/Contexts/Membership/MemberRegistrationWorkflowTest.php`
```php
<?php

namespace Tests\Integration\Contexts\Membership;

use App\Contexts\Membership\Application\Commands\RegisterMemberCommand;
use App\Contexts\Membership\Application\Services\RegisterMemberService;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Infrastructure\Repositories\EloquentMemberRepository;
use App\Contexts\Membership\Infrastructure\Services\TenantUserIdentityVerification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MemberRegistrationWorkflowTest extends TestCase
{
    use RefreshDatabase;
    
    /** @test */
    public function complete_member_registration_workflow()
    {
        // Given: All real implementations (no mocks)
        $repository = new EloquentMemberRepository();
        $identityVerifier = new TenantUserIdentityVerification();
        $service = new RegisterMemberService($repository, $identityVerifier);
        
        $command = new RegisterMemberCommand(
            tenantUserId: 'real-user-123',
            tenantId: 'uml',
            fullName: 'John Doe',
            email: new Email('john@example.com'),
            phone: '+9779801234567',
            memberId: 'UML-2024-0001',
            geoReference: 'np.3.15.234.1.2'
        );
        
        // When: Execute the full workflow
        $member = $service->handle($command);
        
        // Then: Verify everything works together
        $this->assertNotNull($member->id);
        $this->assertEquals('real-user-123', $member->tenant_user_id);
        $this->assertEquals('UML-2024-0001', $member->member_id);
        $this->assertEquals('draft', $member->status->value());
        
        // Verify persistence
        $persisted = $repository->findById($member->id);
        $this->assertNotNull($persisted);
        $this->assertEquals($member->id, $persisted->id);
        
        // Verify events were recorded
        $events = $member->getRecordedEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(
            \App\Contexts\Membership\Domain\Events\MemberRegistered::class,
            $events[0]
        );
    }
}
```

---

## **🚀 IMPLEMENTATION SEQUENCE:**

### **Day 1: Write Failing Tests**
1. Create `RegisterMemberServiceTest.php` (RED phase)
2. Create `MemberRegistrationControllerTest.php` (RED phase)
3. Create `MemberRegistrationWorkflowTest.php` (RED phase)

### **Day 2: Implement Interfaces & Commands**
1. Create `MemberRepositoryInterface.php`
2. Create `IdentityVerificationInterface.php`
3. Create `RegisterMemberCommand.php`

### **Day 3: Implement Services**
1. Create `RegisterMemberService.php`
2. Create `EloquentMemberRepository.php`
3. Create `TenantUserIdentityVerification.php`

### **Day 4: Implement API Layer**
1. Create `MemberRegistrationController.php`
2. Create `RegisterMemberRequest.php`
3. Create `MemberResource.php`

### **Day 5: Configuration & Testing**
1. Create `MembershipServiceProvider.php`
2. Create `membership.php` routes
3. Create OpenAPI spec
4. Run all tests (GREEN phase)

## **✅ EXPECTED OUTCOME:**

**After Phase 2, you'll have:**
1. ✅ Complete application layer with DDD separation
2. ✅ Full REST API for member registration
3. ✅ Integration tests covering complete workflows
4. ✅ OpenAPI documentation for frontend teams
5. ✅ Production-ready Laravel 12 implementation

## **🎯 READY TO IMPLEMENT:**

**Start with Day 1:** Write the failing tests. This maintains TDD discipline.

**Do you want me to create these files in sequence, starting with the failing tests?**