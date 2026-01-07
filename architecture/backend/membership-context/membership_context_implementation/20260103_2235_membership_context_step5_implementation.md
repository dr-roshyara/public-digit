🚀 **COMPLETE DDD + TDD PARALLEL DEVELOPMENT PLAN**

## **📁 PROJECT STRUCTURE:**

```
app/Contexts/Membership/
├── Domain/
│   ├── Models/
│   │   └── Member.php (add approve/reject methods)
│   ├── ValueObjects/
│   │   └── MemberStatus.php (add APPROVED/REJECTED)
│   └── Events/
│       ├── MemberApproved.php    ← NEW
│       └── MemberRejected.php    ← NEW
├── Application/
│   ├── Services/
│   │   ├── DesktopMemberApprovalService.php  ← NEW
│   │   └── DesktopMemberRejectionService.php ← NEW
│   └── DTOs/
│       └── MemberApprovalDto.php ← NEW
└── Infrastructure/
    └── Http/
        ├── Controllers/
        │   └── Desktop/
        │       └── MemberApprovalController.php ← NEW
        ├── Requests/
        │   └── Desktop/
        │       └── ApproveMemberRequest.php ← NEW
        └── Resources/
            └── Desktop/
                └── MemberApprovalResource.php ← NEW
```

## **🔴 PHASE 1: TDD RED - FAILING TESTS FIRST**

### **Step 1.1: Create Failing Domain Tests**

```php
// tests/Unit/Contexts/Membership/Domain/MemberApprovalTest.php
<?php

declare(strict_types=1);

namespace Tests\Unit\Contexts\Membership\Domain;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\MemberId;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberRejected;
use PHPUnit\Framework\TestCase;

class MemberApprovalTest extends TestCase
{
    private Member $pendingMember;
    private string $adminUserId = '01JKADMIN1234567890ABCDEF';
    
    protected function setUp(): void
    {
        // Create a member with PENDING status
        $this->pendingMember = Member::registerForDesktop(
            MemberId::fromString('01JKMEMBER1234567890ABCDEF'),
            'tenant_123',
            '01JKUSER1234567890ABCDEF',
            new PersonalInfo('John Citizen', Email::fromString('john@example.com')),
            null,
            'UML-2025-001'
        );
    }
    
    /** @test */
    public function pending_member_can_be_approved(): void
    {
        // Act
        $this->pendingMember->approve($this->adminUserId);
        
        // Assert
        $this->assertTrue($this->pendingMember->status->isApproved());
        $this->assertCount(1, $this->pendingMember->releaseEvents());
        
        $events = $this->pendingMember->releaseEvents();
        $this->assertInstanceOf(MemberApproved::class, $events[0]);
    }
    
    /** @test */
    public function non_pending_member_cannot_be_approved(): void
    {
        // Arrange: Approve first
        $this->pendingMember->approve($this->adminUserId);
        
        // Act & Assert: Try to approve again
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Only pending members can be approved.');
        
        $this->pendingMember->approve($this->adminUserId);
    }
    
    /** @test */
    public function pending_member_can_be_rejected_with_reason(): void
    {
        $rejectionReason = 'Incomplete documentation';
        
        // Act
        $this->pendingMember->reject($this->adminUserId, $rejectionReason);
        
        // Assert
        $this->assertTrue($this->pendingMember->status->isRejected());
        
        $events = $this->pendingMember->releaseEvents();
        $this->assertInstanceOf(MemberRejected::class, $events[0]);
    }
    
    /** @test */
    public function rejection_requires_reason(): void
    {
        // Act & Assert
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Rejection reason is required.');
        
        $this->pendingMember->reject($this->adminUserId, '');
    }
    
    /** @test */
    public function approved_member_cannot_be_rejected(): void
    {
        // Arrange: Approve first
        $this->pendingMember->approve($this->adminUserId);
        
        // Act & Assert
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Only pending members can be rejected.');
        
        $this->pendingMember->reject($this->adminUserId, 'Some reason');
    }
}
```

### **Step 1.2: Create Domain Events**

```php
// app/Contexts/Membership/Domain/Events/MemberApproved.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Events;

use App\Shared\Domain\Events\AbstractDomainEvent;

final class MemberApproved extends AbstractDomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly string $approvedByUserId,
        public readonly \DateTimeImmutable $approvedAt
    ) {
        parent::__construct();
    }
    
    public static function eventName(): string
    {
        return 'member.approved';
    }
}

// app/Contexts/Membership/Domain/Events/MemberRejected.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Events;

use App\Shared\Domain\Events\AbstractDomainEvent;

final class MemberRejected extends AbstractDomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly string $rejectedByUserId,
        public readonly string $reason,
        public readonly \DateTimeImmutable $rejectedAt
    ) {
        parent::__construct();
    }
    
    public static function eventName(): string
    {
        return 'member.rejected';
    }
}
```

### **Step 1.3: Update Member Aggregate**

```php
// In app/Contexts/Membership/Domain/Models/Member.php
public function approve(string $approvedByUserId): void
{
    if (!$this->status->isPending()) {
        throw new \DomainException('Only pending members can be approved.');
    }
    
    $this->status = MemberStatus::approved();
    $this->recordEvent(new MemberApproved(
        $this->id->value(),
        $this->tenantId,
        $approvedByUserId,
        new \DateTimeImmutable()
    ));
}

public function reject(string $rejectedByUserId, string $reason): void
{
    if (!$this->status->isPending()) {
        throw new \DomainException('Only pending members can be rejected.');
    }
    
    if (empty(trim($reason))) {
        throw new \InvalidArgumentException('Rejection reason is required.');
    }
    
    $this->status = MemberStatus::rejected();
    $this->recordEvent(new MemberRejected(
        $this->id->value(),
        $this->tenantId,
        $rejectedByUserId,
        trim($reason),
        new \DateTimeImmutable()
    ));
}
```

### **Step 1.4: Update MemberStatus Value Object**

```php
// app/Contexts/Membership/Domain/ValueObjects/MemberStatus.php
class MemberStatus extends Enum
{
    const DRAFT = 'draft';
    const PENDING = 'pending';
    const APPROVED = 'approved';
    const REJECTED = 'rejected';
    const ACTIVE = 'active';
    const SUSPENDED = 'suspended';
    const INACTIVE = 'inactive';
    const ARCHIVED = 'archived';
    
    public function isPending(): bool
    {
        return $this->value === self::PENDING;
    }
    
    public function isApproved(): bool
    {
        return $this->value === self::APPROVED;
    }
    
    public function isRejected(): bool
    {
        return $this->value === self::REJECTED;
    }
    
    public static function approved(): self
    {
        return new self(self::APPROVED);
    }
    
    public static function rejected(): self
    {
        return new self(self::REJECTED);
    }
}
```

## **🟡 PHASE 2: APPLICATION LAYER (GREEN)**

### **Step 2.1: Create Application Service Tests**

```php
// tests/Unit/Contexts/Membership/Application/DesktopMemberApprovalServiceTest.php
<?php

declare(strict_types=1);

namespace Tests\Unit\Contexts\Membership\Application;

use App\Contexts\Membership\Application\Services\DesktopMemberApprovalService;
use App\Contexts\Membership\Application\DTOs\MemberApprovalDto;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\MemberId;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use PHPUnit\Framework\TestCase;
use Mockery;

class DesktopMemberApprovalServiceTest extends TestCase
{
    private $memberRepository;
    private $approvalService;
    private $pendingMember;
    
    protected function setUp(): void
    {
        $this->memberRepository = Mockery::mock(MemberRepositoryInterface::class);
        $this->approvalService = new DesktopMemberApprovalService($this->memberRepository);
        
        // Create a pending member
        $this->pendingMember = Member::registerForDesktop(
            MemberId::fromString('01JKMEMBER1234567890ABCDEF'),
            'tenant_123',
            '01JKUSER1234567890ABCDEF',
            new PersonalInfo('John Citizen', Email::fromString('john@example.com')),
            null,
            'UML-2025-001'
        );
    }
    
    /** @test */
    public function it_approves_pending_member(): void
    {
        // Arrange
        $dto = new MemberApprovalDto(
            memberId: '01JKMEMBER1234567890ABCDEF',
            tenantId: 'tenant_123',
            adminUserId: '01JKADMIN1234567890ABCDEF'
        );
        
        $this->memberRepository->shouldReceive('getById')
            ->with('01JKMEMBER1234567890ABCDEF')
            ->andReturn($this->pendingMember);
            
        $this->memberRepository->shouldReceive('save')
            ->with(Mockery::type(Member::class))
            ->once();
        
        // Act
        $result = $this->approvalService->approve($dto);
        
        // Assert
        $this->assertTrue($result->status->isApproved());
    }
    
    /** @test */
    public function it_throws_exception_when_member_not_found(): void
    {
        // Arrange
        $dto = new MemberApprovalDto(
            memberId: 'NONEXISTENT',
            tenantId: 'tenant_123',
            adminUserId: '01JKADMIN1234567890ABCDEF'
        );
        
        $this->memberRepository->shouldReceive('getById')
            ->with('NONEXISTENT')
            ->andReturn(null);
        
        // Act & Assert
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Member not found.');
        
        $this->approvalService->approve($dto);
    }
}
```

### **Step 2.2: Create Application Services**

```php
// app/Contexts/Membership/Application/Services/DesktopMemberApprovalService.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Application\DTOs\MemberApprovalDto;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Models\Member;

class DesktopMemberApprovalService
{
    public function __construct(
        private readonly MemberRepositoryInterface $memberRepository
    ) {}
    
    public function approve(MemberApprovalDto $dto): Member
    {
        $member = $this->memberRepository->getById($dto->memberId);
        
        if (!$member) {
            throw new \DomainException('Member not found.');
        }
        
        if ($member->tenantId !== $dto->tenantId) {
            throw new \DomainException('Member does not belong to this tenant.');
        }
        
        $member->approve($dto->adminUserId);
        $this->memberRepository->save($member);
        
        return $member;
    }
}

// app/Contexts/Membership/Application/Services/DesktopMemberRejectionService.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Application\DTOs\MemberRejectionDto;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Models\Member;

class DesktopMemberRejectionService
{
    public function __construct(
        private readonly MemberRepositoryInterface $memberRepository
    ) {}
    
    public function reject(MemberRejectionDto $dto): Member
    {
        $member = $this->memberRepository->getById($dto->memberId);
        
        if (!$member) {
            throw new \DomainException('Member not found.');
        }
        
        if ($member->tenantId !== $dto->tenantId) {
            throw new \DomainException('Member does not belong to this tenant.');
        }
        
        $member->reject($dto->adminUserId, $dto->reason);
        $this->memberRepository->save($member);
        
        return $member;
    }
}
```

### **Step 2.3: Create DTOs**

```php
// app/Contexts/Membership/Application/DTOs/MemberApprovalDto.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\DTOs;

class MemberApprovalDto
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly string $adminUserId
    ) {}
}

// app/Contexts/Membership/Application/DTOs/MemberRejectionDto.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\DTOs;

class MemberRejectionDto
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly string $adminUserId,
        public readonly string $reason
    ) {}
}
```

## **🟢 PHASE 3: INFRASTRUCTURE LAYER**

### **Step 3.1: Create Infrastructure Tests**

```php
// tests/Feature/Contexts/Membership/Desktop/MemberApprovalApiTest.php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\Membership\Desktop;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class MemberApprovalApiTest extends TestCase
{
    use DatabaseTransactions;
    
    protected $connectionsToTransact = ['tenant_test'];
    protected string $testTenantSlug;
    protected string $pendingMemberId;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        config(['database.default' => 'tenant_test']);
        $this->testTenantSlug = 'test-uml-' . Str::random(6);
        $this->createTestTenant();
        $this->createAndAuthenticateAdmin();
        
        // Create a pending member first
        $this->pendingMemberId = $this->createPendingMember();
    }
    
    /** @test */
    public function admin_can_approve_pending_member(): void
    {
        // Act: Approve the member
        $response = $this->postJson(
            "/{$this->testTenantSlug}/api/v1/members/{$this->pendingMemberId}/approve"
        );
        
        // Assert
        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'attributes' => [
                        'status' => 'approved',
                    ],
                ],
            ]);
    }
    
    /** @test */
    public function admin_can_reject_pending_member_with_reason(): void
    {
        // Act: Reject with reason
        $response = $this->postJson(
            "/{$this->testTenantSlug}/api/v1/members/{$this->pendingMemberId}/reject",
            ['reason' => 'Incomplete documentation']
        );
        
        // Assert
        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'attributes' => [
                        'status' => 'rejected',
                    ],
                ],
            ]);
    }
    
    /** @test */
    public function rejection_requires_reason(): void
    {
        // Act: Try to reject without reason
        $response = $this->postJson(
            "/{$this->testTenantSlug}/api/v1/members/{$this->pendingMemberId}/reject",
            ['reason' => '']
        );
        
        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);
    }
    
    private function createPendingMember(): string
    {
        $response = $this->postJson("/{$this->testTenantSlug}/api/v1/members", [
            'tenant_user_id' => '01JKUSER' . Str::upper(Str::random(18)),
            'full_name' => 'Pending User',
            'email' => 'pending.' . Str::random(8) . '@example.com',
        ]);
        
        return $response->json('data.id');
    }
}
```

### **Step 3.2: Create Controller**

```php
// app/Contexts/Membership/Infrastructure/Http/Controllers/Desktop/MemberApprovalController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Http\Controllers\Desktop;

use App\Contexts\Membership\Application\DTOs\MemberApprovalDto;
use App\Contexts\Membership\Application\DTOs\MemberRejectionDto;
use App\Contexts\Membership\Application\Services\DesktopMemberApprovalService;
use App\Contexts\Membership\Application\Services\DesktopMemberRejectionService;
use App\Contexts\Membership\Infrastructure\Http\Requests\Desktop\ApproveMemberRequest;
use App\Contexts\Membership\Infrastructure\Http\Requests\Desktop\RejectMemberRequest;
use App\Contexts\Membership\Infrastructure\Http\Resources\Desktop\DesktopMemberResource;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class MemberApprovalController extends Controller
{
    public function __construct(
        private readonly DesktopMemberApprovalService $approvalService,
        private readonly DesktopMemberRejectionService $rejectionService
    ) {}
    
    public function approve(string $tenant, string $memberId): JsonResponse
    {
        $member = $this->approvalService->approve(
            new MemberApprovalDto(
                memberId: $memberId,
                tenantId: $tenant,
                adminUserId: auth()->id()
            )
        );
        
        return (new DesktopMemberResource($member))
            ->response()
            ->setStatusCode(200);
    }
    
    public function reject(string $tenant, string $memberId, RejectMemberRequest $request): JsonResponse
    {
        $member = $this->rejectionService->reject(
            new MemberRejectionDto(
                memberId: $memberId,
                tenantId: $tenant,
                adminUserId: auth()->id(),
                reason: $request->validated('reason')
            )
        );
        
        return (new DesktopMemberResource($member))
            ->response()
            ->setStatusCode(200);
    }
}
```

### **Step 3.3: Create Form Requests**

```php
// app/Contexts/Membership/Infrastructure/Http/Requests/Desktop/ApproveMemberRequest.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Http\Requests\Desktop;

use Illuminate\Foundation\Http\FormRequest;

class ApproveMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check() && auth()->user()->can('approve-members');
    }
    
    public function rules(): array
    {
        return [];
    }
}

// app/Contexts/Membership/Infrastructure/Http/Requests/Desktop/RejectMemberRequest.php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Infrastructure\Http\Requests\Desktop;

use Illuminate\Foundation\Http\FormRequest;

class RejectMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check() && auth()->user()->can('reject-members');
    }
    
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:10', 'max:500'],
        ];
    }
    
    public function messages(): array
    {
        return [
            'reason.required' => 'Rejection reason is required.',
            'reason.min' => 'Rejection reason must be at least 10 characters.',
            'reason.max' => 'Rejection reason must not exceed 500 characters.',
        ];
    }
}
```

### **Step 3.4: Add Routes**

```php
// routes/tenant-api/membership.php (add to existing file)
Route::prefix('members/{member}')
    ->where('member', '[0-9A-Z]{26}') // ULID format
    ->middleware(['auth:web', 'can:manage-members'])
    ->group(function () {
        
        // Approve pending member
        Route::post('approve', [MemberApprovalController::class, 'approve'])
            ->name('tenant.api.members.approve');
        
        // Reject pending member
        Route::post('reject', [MemberApprovalController::class, 'reject'])
            ->name('tenant.api.members.reject');
    });
```

## **📋 EXECUTION ORDER:**

1. **Run Domain Tests** → Should fail (RED)
2. **Implement Domain Layer** → Tests pass (GREEN)
3. **Run Application Tests** → Should fail (RED)  
4. **Implement Application Layer** → Tests pass (GREEN)
5. **Run Infrastructure Tests** → Should fail (RED)
6. **Implement Infrastructure** → Tests pass (GREEN)
7. **Run All Tests** → All pass ✅

## **🚀 START NOW:**

**Begin with:** `tests/Unit/Contexts/Membership/Domain/MemberApprovalTest.php`

**Command:**
```bash
php artisan test tests/Unit/Contexts/Membership/Domain/MemberApprovalTest.php --colors=always
```

**All tests will fail initially (RED phase). Then implement domain logic to make them pass (GREEN phase).**

**Shall I create the first failing test file?**
```diff
Create file packages\laravel-backend\tests\Unit\Contexts\Membership\Domain\MemberApprovalTest.php
```

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Contexts\Membership\Domain;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\MemberId;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberRejected;
use PHPUnit\Framework\TestCase;

/**
 * Domain Layer Tests for Member Approval/Rejection
 * 
 * TDD Workflow:
 * 1. RED: These tests will fail (domain methods not implemented)
 * 2. GREEN: Implement approve() and reject() methods in Member aggregate
 * 3. REFACTOR: Clean up and optimize
 * 
 * Business Rules:
 * - Only PENDING members can be approved/rejected
 * - Rejection requires a reason
 * - Approval/rejection records admin user ID
 * - Events are recorded for audit trail
 */
class MemberApprovalTest extends TestCase
{
    private Member $pendingMember;
    private string $adminUserId = '01JKADMIN1234567890ABCDEF';
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a member with PENDING status (desktop registration)
        $this->pendingMember = Member::registerForDesktop(
            MemberId::fromString('01JKMEMBER1234567890ABCDEF'),
            'tenant_123',
            '01JKUSER1234567890ABCDEF',
            new PersonalInfo('John Citizen', Email::fromString('john@example.com')),
            null, // No geography reference
            'UML-2025-001'
        );
        
        // Verify member is indeed pending
        $this->assertTrue($this->pendingMember->status->isPending());
    }
    
    /** @test */
    public function pending_member_can_be_approved(): void
    {
        // Act: Approve the pending member
        $this->pendingMember->approve($this->adminUserId);
        
        // Assert: Status changed to APPROVED
        $this->assertTrue($this->pendingMember->status->isApproved());
        $this->assertFalse($this->pendingMember->status->isPending());
        
        // Assert: MemberApproved event was recorded
        $events = $this->pendingMember->releaseEvents();
        $this->assertCount(1, $events);
        
        $approvalEvent = $events[0];
        $this->assertInstanceOf(MemberApproved::class, $approvalEvent);
        $this->assertEquals('01JKMEMBER1234567890ABCDEF', $approvalEvent->memberId);
        $this->assertEquals('tenant_123', $approvalEvent->tenantId);
        $this->assertEquals($this->adminUserId, $approvalEvent->approvedByUserId);
    }
    
    /** @test */
    public function non_pending_member_cannot_be_approved(): void
    {
        // Arrange: Approve the member first
        $this->pendingMember->approve($this->adminUserId);
        
        // Act & Assert: Try to approve an already approved member
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Only pending members can be approved.');
        
        $this->pendingMember->approve($this->adminUserId);
    }
    
    /** @test */
    public function pending_member_can_be_rejected_with_reason(): void
    {
        $rejectionReason = 'Incomplete documentation provided.';
        
        // Act: Reject the pending member with reason
        $this->pendingMember->reject($this->adminUserId, $rejectionReason);
        
        // Assert: Status changed to REJECTED
        $this->assertTrue($this->pendingMember->status->isRejected());
        $this->assertFalse($this->pendingMember->status->isPending());
        
        // Assert: MemberRejected event was recorded with reason
        $events = $this->pendingMember->releaseEvents();
        $this->assertCount(1, $events);
        
        $rejectionEvent = $events[0];
        $this->assertInstanceOf(MemberRejected::class, $rejectionEvent);
        $this->assertEquals('01JKMEMBER1234567890ABCDEF', $rejectionEvent->memberId);
        $this->assertEquals('tenant_123', $rejectionEvent->tenantId);
        $this->assertEquals($this->adminUserId, $rejectionEvent->rejectedByUserId);
        $this->assertEquals($rejectionReason, $rejectionEvent->reason);
    }
    
    /** @test */
    public function rejection_requires_non_empty_reason(): void
    {
        // Act & Assert: Try to reject with empty reason
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Rejection reason is required.');
        
        $this->pendingMember->reject($this->adminUserId, '');
    }
    
    /** @test */
    public function rejection_requires_non_whitespace_reason(): void
    {
        // Act & Assert: Try to reject with whitespace-only reason
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Rejection reason is required.');
        
        $this->pendingMember->reject($this->adminUserId, '   ');
    }
    
    /** @test */
    public function approved_member_cannot_be_rejected(): void
    {
        // Arrange: Approve the member first
        $this->pendingMember->approve($this->adminUserId);
        
        // Act & Assert: Try to reject an approved member
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Only pending members can be rejected.');
        
        $this->pendingMember->reject($this->adminUserId, 'Some reason');
    }
    
    /** @test */
    public function rejected_member_cannot_be_approved(): void
    {
        // Arrange: Reject the member first
        $this->pendingMember->reject($this->adminUserId, 'Invalid documents');
        
        // Act & Assert: Try to approve a rejected member
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Only pending members can be approved.');
        
        $this->pendingMember->approve($this->adminUserId);
    }
    
    /** @test */
    public function draft_member_cannot_be_approved(): void
    {
        // Arrange: Create a DRAFT member (mobile registration)
        $draftMember = Member::registerForMobile(
            MemberId::fromString('01JKMEMBER9876543210ABCDEF'),
            'tenant_123',
            '01JKUSER9876543210ABCDEF',
            new PersonalInfo('Jane Citizen', Email::fromString('jane@example.com')),
            null,
            'UML-2025-002'
        );
        
        // Verify member is in DRAFT status
        $this->assertTrue($draftMember->status->isDraft());
        
        // Act & Assert: Try to approve a DRAFT member
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Only pending members can be approved.');
        
        $draftMember->approve($this->adminUserId);
    }
    
    /** @test */
    public function approval_and_rejection_are_mutually_exclusive(): void
    {
        // Act: Approve the member
        $this->pendingMember->approve($this->adminUserId);
        
        // Assert: Cannot reject after approval
        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Only pending members can be rejected.');
        
        $this->pendingMember->reject($this->adminUserId, 'Some reason');
    }
}
```
```diff
Create file packages\laravel-backend\app\Contexts\Membership\Domain\Events\MemberApproved.php
```

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Events;

use App\Shared\Domain\Events\AbstractDomainEvent;

/**
 * Member Approved Domain Event
 * 
 * Raised when a pending member is approved by an admin.
 * Contains audit trail information for compliance.
 * 
 * Properties:
 * - memberId: The ID of the member who was approved
 * - tenantId: The tenant to which the member belongs
 * - approvedByUserId: The admin user ID who performed the approval
 * - approvedAt: Timestamp when approval occurred
 */
final class MemberApproved extends AbstractDomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly string $approvedByUserId,
        public readonly \DateTimeImmutable $approvedAt
    ) {
        parent::__construct();
    }
    
    public static function eventName(): string
    {
        return 'member.approved';
    }
    
    /**
     * Get event metadata for auditing
     */
    public function metadata(): array
    {
        return [
            'member_id' => $this->memberId,
            'tenant_id' => $this->tenantId,
            'approved_by' => $this->approvedByUserId,
            'approved_at' => $this->approvedAt->format(\DateTimeInterface::ATOM),
            'event_type' => self::eventName(),
        ];
    }
}
```
### udnerstanding the background : 
# 🚀 **NEXT SESSION: DOMAIN LAYER IMPLEMENTATION (GREEN PHASE) - START**

I can see you're ready to proceed with implementing the domain logic for the approval process. Let's start by creating the missing `MemberRejected` domain event file, then update the `MemberStatus` value object, and finally implement the `approve()` and `reject()` methods in the `Member` aggregate.

## **📋 CURRENT ACTION PLAN:**

1. **Create `MemberRejected.php` domain event** - ✅ Ready to create based on your template
2. **Update `MemberStatus.php` value object** - Add missing `approved()` and `rejected()` methods
3. **Implement `Member::approve()` and `::reject()` methods** - Add to the Member aggregate
4. **Run tests to verify GREEN phase** - All 9 tests should pass

## **🎯 FIRST STEP: CREATE MEMBERREJECTED.PHP**

Based on your template, I'll create the file at:
`packages/laravel-backend/app/Contexts/Membership/Domain/Events/MemberRejected.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Events;

use App\Shared\Domain\Events\AbstractDomainEvent;

/**
 * Member Rejected Domain Event
 * 
 * Raised when a pending member is rejected by an admin.
 * Contains rejection reason for audit trail.
 * 
 * Properties:
 * - memberId: The ID of the member who was rejected
 * - tenantId: The tenant to which the member belongs
 * - rejectedByUserId: The admin user ID who performed the rejection
 * - reason: The reason for rejection (required for compliance)
 * - rejectedAt: Timestamp when rejection occurred
 */
final class MemberRejected extends AbstractDomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly string $rejectedByUserId,
        public readonly string $reason,
        public readonly \DateTimeImmutable $rejectedAt
    ) {
        parent::__construct();
    }
    
    public static function eventName(): string
    {
        return 'member.rejected';
    }
    
    /**
     * Get event metadata for auditing
     */
    public function metadata(): array
    {
        return [
            'member_id' => $this->memberId,
            'tenant_id' => $this->tenantId,
            'rejected_by' => $this->rejectedByUserId,
            'reason' => $this->reason,
            'rejected_at' => $this->rejectedAt->format(\DateTimeInterface::ATOM),
            'event_type' => self::eventName(),
        ];
    }
}
```

## **🔧 NEXT STEPS:**

After creating this file, we should:

1. **Check if `MemberApproved` event exists** - Verify it's properly implemented
2. **Update `MemberStatus.php`** - Add the `approved()` and `rejected()` static methods
3. **Add methods to `Member.php` aggregate** - Implement `approve()` and `reject()` methods
4. **Run the tests** to see if we've reached GREEN phase

## **❓ QUESTION FOR YOU:**

**Would you like me to:**
1. Create the `MemberRejected.php` file now, then proceed to update `MemberStatus.php`?
2. Or would you prefer to first check the current test failures to see exactly what's missing?

**Also:** Do you have the `MemberApproved.php` event already created? I noticed it's mentioned as "created but not integrated" in your status.

**Let me know how you'd like to proceed, and I'll guide us through the implementation step by step!**
################################
# 🧠 **UNDERSTANDING THE TESTING APPROACH**

Thank you for sharing the comprehensive testing documentation. I now understand the sophisticated testing strategy implemented in this DDD multi-tenant project. Let me synthesize the key patterns relevant to our current work on the Membership context approval process:

## **🔑 KEY TESTING PRINCIPLES FOR OUR CURRENT TASK:**

### **1. Test Structure & Organization**
```
tests/Unit/Contexts/Membership/Domain/          ← We're working here
tests/Unit/Contexts/Membership/Application/     ← Next phase
tests/Feature/Contexts/Membership/Desktop/      ← Desktop API tests
tests/Feature/Contexts/Membership/Mobile/       ← Mobile API tests
```

### **2. TDD Workflow We Should Follow**
```php
// 1. RED: Write failing test first
/** @test */
public function pending_member_can_be_approved(): void
{
    // Test written before implementation
    $this->expectException(DomainException::class);
    // ... test logic
}

// 2. GREEN: Implement just enough to pass
// 3. REFACTOR: Clean up while maintaining tests
```

### **3. Multi-Tenant Isolation in Tests**
- Tenant-specific database connections (`tenant_test`)
- Tenant-switching in `setUp()` and `tearDown()`
- No cross-tenant data leakage
- Tenant-scoped business rules

### **4. Domain Layer Testing Characteristics**
- **Pure PHP** - No framework dependencies
- **No database** - In-memory objects only
- **Business rules** - Tested in isolation
- **Value objects** - Test immutability and validation

## **🎯 RELEVANT PATTERNS FOR OUR APPROVAL PROCESS:**

### **Domain Event Testing Pattern**
```php
/** @test */
public function it_raises_member_approved_event(): void
{
    $member = Member::factory()->pending()->create();
    
    $member->approve('admin-id-123');
    
    $events = $member->releaseEvents();
    $this->assertCount(1, $events);
    $this->assertInstanceOf(MemberApproved::class, $events[0]);
}
```

### **Value Object Testing Pattern**
```php
/** @test */
public function member_status_transitions_correctly(): void
{
    $status = MemberStatus::pending();
    $this->assertTrue($status->isPending());
    
    $approved = MemberStatus::approved();
    $this->assertTrue($approved->isApproved());
    $this->assertFalse($approved->equals($status));
}
```

### **Exception Testing Pattern**
```php
/** @test */
public function non_pending_member_cannot_be_approved(): void
{
    $this->expectException(DomainException::class);
    $this->expectExceptionMessage('Only pending members can be approved.');
    
    $member = Member::factory()->draft()->create();
    $member->approve('admin-id-123');
}
```

## **🔧 CURRENT SITUATION ANALYSIS:**

Looking at the `MemberApprovalTest.php` you mentioned (9 tests), these are likely **domain tests** that:
1. Test business rules in isolation
2. Don't hit the database
3. Use domain objects directly
4. Test state transitions and exceptions

## **🚀 ACTION PLAN BASED ON TESTING APPROACH:**

### **Step 1: Domain Layer Implementation (Current)**
Since we're in the **RED phase** of domain tests:
1. Create missing domain events (`MemberRejected`)
2. Implement missing methods in `MemberStatus` value object
3. Add `approve()` and `reject()` methods to `Member` aggregate
4. **Test**: Run pure PHP domain tests (no database)

### **Step 2: Application Layer Tests (Next)**
Create `DesktopMemberApprovalServiceTest.php` with:
- Service dependencies (repository, etc.)
- Tenant context awareness
- Business rule validation at application layer

### **Step 3: Infrastructure Layer (After)**
Fix the hanging `MemberRegistrationApiTest` by:
1. Debugging service binding in `MembershipServiceProvider`
2. Mocking authentication correctly (Session-based for Desktop API)
3. Ensuring proper tenant database switching

## **📊 TEST EXECUTION COMMAND UNDERSTANDING:**

```bash
# Run domain tests (what we're doing now)
php artisan test tests/Unit/Contexts/Membership/Domain/ --colors=always

# Run specific test file
php artisan test tests/Unit/Contexts/Membership/Domain/MemberApprovalTest.php

# Run application layer tests (next)
php artisan test tests/Unit/Contexts/Membership/Application/

# Run desktop API tests (to fix)
php artisan test tests/Feature/Contexts/Membership/Desktop/MemberRegistrationApiTest.php
```

## **🎯 IMMEDIATE NEXT ACTIONS:**

Given our understanding of the testing approach, let's proceed systematically:

1. **First**: Create the `MemberRejected.php` domain event file
2. **Then**: Update `MemberStatus.php` with `approved()` and `rejected()` methods
3. **Next**: Implement `Member::approve()` and `Member::reject()` methods
4. **Finally**: Run the domain tests to achieve **GREEN phase**

**Question for you:** 
Should I create the `MemberRejected.php` file now, or would you prefer to first examine the current test failures to see the exact error messages?

The testing approach documentation confirms we're on the right track with DDD principles and TDD methodology. Let me know how you'd like to proceed!

####

# 🧠 **COMPREHENSIVE UNDERSTANDING OF TESTING & MIGRATION PATTERNS**

I now have a complete understanding of the sophisticated testing and migration infrastructure in this project. Let me synthesize how all these patterns come together for our current work on the Membership context approval process.

## **🔗 CONNECTING ALL PATTERNS TOGETHER:**

### **1. The Complete Picture**
```
Standardized Testing Approach        Tenant Migration Patterns          Current Approval Workflow
     ↓                                       ↓                                   ↓
Domain/App/Infra Layers          ←  Database Schema Validation  →   Member Table with member_id column
Multi-Tenant Isolation           ←  Dynamic Connection Switching →   Tenant-specific database operations
TDD Red/Green/Refactor           ←  Migration Tracking           →   Schema changes for approval process
```

### **2. Why Tests Might Be Failing (Desktop API)**
Based on the migration patterns, I now understand the **potential root cause** for the hanging Desktop API tests:

```php
// The failing test might be trying to access a column that doesn't exist
// Or there might be a database connection issue

// Common issues from migration patterns:
// 1. Missing `member_id` column in `members` table
// 2. Improper tenant database connection switching
// 3. Missing foreign key relationships
// 4. Tenant context not properly set in tests
```

### **3. The member_id Column Issue**
From the migration testing document, I notice this critical point:
> "Verify member_id column exists (current failing test issue)"

This suggests that:
- Our domain layer uses `MemberId` value objects
- The database migration needs a `member_id` column
- Tests are failing because they can't find this column

## **🎯 CURRENT DOMAIN IMPLEMENTATION CONTEXT:**

### **We're Working at the Domain Layer**
Right now, we're implementing **pure domain logic** for approval/rejection. According to the testing approach:

1. **Domain Layer Tests**: No database, pure PHP objects
2. **Application Layer Tests**: Use repositories, mock dependencies
3. **Infrastructure Tests**: Actual database operations
4. **API Tests**: HTTP endpoints with full stack

### **Our Current Phase is DOMAIN (Pure Business Logic)**
The 9 failing domain tests in `MemberApprovalTest.php` are testing:
- Business rules (only pending members can be approved)
- State transitions (pending → approved/rejected)
- Domain events (MemberApproved, MemberRejected)
- **No database involved** - pure in-memory objects

## **🚀 UPDATED ACTION PLAN WITH FULL CONTEXT:**

### **Phase 1: Complete Domain Layer (IMMEDIATE)**
**Goal**: Make 9 domain tests pass
**Scope**: Pure PHP, no database
**Tasks**:
1. ✅ Create `MemberRejected` domain event (template provided)
2. ✅ Update `MemberStatus` with `approved()`/`rejected()` methods
3. ✅ Implement `Member::approve()` and `::reject()` methods
4. ✅ Run domain tests - should all pass

### **Phase 2: Fix Migration Issues (NEXT)**
**Goal**: Fix Desktop API hanging tests
**Insight**: Likely `member_id` column missing in database
**Tasks**:
1. Check migration for `members` table
2. Verify `member_id` column exists (string/UUID)
3. Fix any missing columns
4. Run migration tests

### **Phase 3: Application Layer Tests (AFTER)**
**Goal**: Implement application services
**Tasks**:
1. Create `DesktopMemberApprovalServiceTest.php` (RED)
2. Create `DesktopMemberRejectionServiceTest.php` (RED)
3. Implement services with repository dependency
4. Test tenant isolation

## **📊 TEST EXECUTION STRATEGY:**

```bash
# 1. Domain Tests (Current Focus)
php artisan test tests/Unit/Contexts/Membership/Domain/MemberApprovalTest.php

# 2. Migration Tests (If needed)
php artisan test --filter=membership_migration

# 3. Desktop API Tests (To fix)
php artisan test tests/Feature/Contexts/Membership/Desktop/

# 4. Mobile API Tests (Already working)
php artisan test tests/Feature/Contexts/Membership/Mobile/
```

## **🔍 KEY INSIGHTS FROM MIGRATION PATTERNS:**

1. **TDD is Strict**: All tests must follow RED → GREEN → REFACTOR
2. **Schema Validation is Critical**: Every column must be tested
3. **Database Isolation**: Each test gets its own tenant database
4. **Cleanup is Mandatory**: Test databases must be cleaned up

## **❓ CRITICAL QUESTIONS FOR PROCEEDING:**

Given the comprehensive understanding of testing and migration patterns:

1. **Should we first create the `MemberRejected.php` domain event?**
   - This is pure domain work, aligns with current domain tests
   - Follows TDD workflow (we have failing tests that need it)

2. **Or should we check if migration issues are blocking us?**
   - The Desktop API tests might fail due to missing `member_id` column
   - But domain tests shouldn't be affected by database issues

3. **What's the exact error from the 9 failing domain tests?**
   - Are they failing on missing `MemberRejected` class?
   - Or missing methods in `Member` aggregate?

## **🎯 RECOMMENDED PATH FORWARD:**

Since we're in the **Domain Layer** and following **TDD**:

1. **First**: Run the current domain tests to see exact failures
2. **Then**: Create missing domain artifacts (`MemberRejected`, etc.)
3. **After**: Verify all 9 domain tests pass (GREEN phase)
4. **Next**: Move to application layer OR fix migration issues

**This maintains the TDD discipline while addressing the most immediate blockers.**

## **🚀 READY TO EXECUTE:**

**Shall I:**
1. Run the domain tests first to see current failure messages?
2. Or proceed directly to creating the `MemberRejected.php` file?

The migration patterns suggest we should **always verify test failures first** to understand exactly what's missing. Would you like me to run the tests and report the exact error messages?
#####################

