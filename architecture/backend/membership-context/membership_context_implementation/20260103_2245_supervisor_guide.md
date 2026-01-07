# 🏛️ **PROJECT BACKGROUND & CURRENT STATUS - Code Mentor Session**

## **🌍 PROJECT OVERVIEW: Political Party Digital Operating System**

Building a **global political party management SaaS** that digitalizes party operations while respecting political hierarchies, data sovereignty, and organizational diversity.

### **CORE VALUE PROPOSITION**
- **For Local Parties**: Ward-level digital organization in Nepal
- **For Diaspora**: International chapter management  
- **For National Parties**: Central committee + geographic hierarchy
- **For All**: Membership lifecycle, committees, finance, discussions

### **MARKET SEGMENTS**
1. **Nepal**: 7 provinces → 77 districts → 753 municipalities → 6,743 wards
2. **India**: 28 states → 766 districts → 6,000+ tehsils
3. **Germany**: 16 states → 401 districts → 11,000 municipalities
4. **Diaspora**: Country → State/Province → City → Chapter

---

## **📊 DEVELOPMENT STATUS (PHASE 1-3 COMPLETE)**

### **✅ COMPLETED: PHASE 1 - DOMAIN LAYER (Week 1)**
**Membership Context Domain Layer** - Business rules encoded in aggregates and value objects
- **Member Aggregate Root** with business methods
- **Value Objects**: Email, PersonalInfo, MemberStatus, MemberId, TenantUserId, RegistrationChannel
- **Domain Events**: MemberRegistered with RecordsEvents trait
- **Business Rules**:
  - Digital identity first (Member REQUIRES TenantUser 1:1)
  - Geography decoupled (string reference only, no IDs)
  - Registration channel determines initial status (Mobile→DRAFT, Desktop→PENDING)

### **✅ COMPLETED: PHASE 2 - APPLICATION LAYER (Week 2)**
**Application Services & Repository Pattern** - Orchestration layer
- **Repository Pattern**: `MemberRepositoryInterface` with Eloquent implementation
- **Domain Service Interfaces**: `TenantUserProvisioningInterface`, `GeographyResolverInterface`
- **Application Services**:
  - `MobileMemberRegistrationService` - Orchestrates mobile registration flow
  - `DesktopMemberRegistrationService` - Orchestrates desktop admin registration
- **DTOs**: `MobileRegistrationDto`, `DesktopRegistrationDto` for data transfer

### **✅ COMPLETED: PHASE 3 - MOBILE API LAYER (Week 3, Days 1-2)**
**CASE 2: Tenant Mobile API** (`/{tenant}/mapi/v1/members/*`) - Angular mobile app
- **Thin Controller**: `Mobile/MemberController` - HTTP concerns only
- **Validation**: `Mobile/RegisterMemberRequest` - Form request with tenant-scoped uniqueness
- **Resources**: `MobileMemberResource` - JSON:API format for mobile clients
- **Routes**: `routes/tenant-mapi/membership.php` loaded via `mobileapp.php`
- **Infrastructure Adapters** (Stub implementations):
  - `TenantAuthProvisioningAdapter` - Creates tenant users for mobile
  - `GeographyValidationAdapter` - Validates geography references
- **Testing**: 9 comprehensive feature tests (7 passing, 2 skipped for JSON validation)

### **✅ COMPLETED: PHASE 4 - DESKTOP API INFRASTRUCTURE (Week 3, Day 3)**
**CASE 4: Tenant Desktop API** (`/{tenant}/api/v1/members/*`) - Vue Desktop Admin
- **Thin Controller**: `Desktop/MemberController` - HTTP concerns only
- **Validation**: `Desktop/RegisterMemberRequest` - Desktop-specific validation
- **Resources**: `DesktopMemberResource` - Admin-focused JSON:API response
- **Routes**: `routes/tenant-api/membership.php` loaded in `tenant-api.php`
- **Tests**: `MemberRegistrationApiTest.php` - 7 tests (1 passing, 6 failing - TDD RED phase)
- **Current Issue**: Tests hanging on service binding/authentication

### **🏗️ ARCHITECTURE DECISIONS IMPLEMENTED**
1. **DDD Layers Strictly Separated**: Domain → Application → Infrastructure
2. **Thin Controllers**: Zero business logic, only HTTP orchestration
3. **Anti-Corruption Layers**: Domain service interfaces decouple contexts
4. **Multi-Tenant Routing**: 6-case strategy (CASE 2 & 4 implemented)
5. **TDD First**: Tests written before implementation (RED→GREEN→REFACTOR)

---

## **🎯 CURRENT TDD STATUS: APPROVAL PROCESS DEVELOPMENT**

### **🟢 JUST COMPLETED: APPROVAL DOMAIN TESTS (TDD RED)**
Created `MemberApprovalTest.php` with 9 comprehensive domain tests:
1. ✅ Pending member can be approved
2. ✅ Non-pending member cannot be approved  
3. ✅ Pending member can be rejected with reason
4. ✅ Rejection requires non-empty reason
5. ✅ Rejection requires non-whitespace reason
6. ✅ Approved member cannot be rejected
7. ✅ Rejected member cannot be approved
8. ✅ Draft member cannot be approved
9. ✅ Approval and rejection are mutually exclusive

### **🔴 CURRENTLY FAILING: Domain Events & Aggregate Methods**
**Missing implementations:**
1. `MemberApproved` domain event (created but not integrated)
2. `MemberRejected` domain event (not created)
3. `Member::approve()` method (not implemented)
4. `Member::reject()` method (not implemented)
5. `MemberStatus::approved()` and `::rejected()` methods (not implemented)

---

## **🚀 PARALLEL DEVELOPMENT PLAN (TDD APPROACH)**

### **PHASE 1: APPROVAL PROCESS DOMAIN LAYER (CURRENT)**
```
TDD Step 1: RED
- ✅ Created failing domain tests (9 tests)
- ❌ Need to implement domain logic

TDD Step 2: GREEN  
- Create MemberApproved event ✓
- Create MemberRejected event
- Implement Member::approve()
- Implement Member::reject()
- Add MemberStatus::approved()/::rejected()

TDD Step 3: REFACTOR
- Clean up domain logic
- Ensure all 9 tests pass
```

### **PHASE 2: APPROVAL PROCESS APPLICATION LAYER**
```
TDD Step 1: RED
- Create failing application service tests
- Test DesktopMemberApprovalService
- Test DesktopMemberRejectionService

TDD Step 2: GREEN
- Create MemberApprovalDto
- Create MemberRejectionDto  
- Implement approval service
- Implement rejection service

TDD Step 3: REFACTOR
- Ensure proper dependency injection
- Validate business rules in application layer
```

### **PHASE 3: APPROVAL PROCESS INFRASTRUCTURE LAYER**
```
TDD Step 1: RED
- Create failing API endpoint tests
- Test POST /{tenant}/api/v1/members/{id}/approve
- Test POST /{tenant}/api/v1/members/{id}/reject

TDD Step 2: GREEN
- Create MemberApprovalController
- Create ApproveMemberRequest validation
- Create RejectMemberRequest validation
- Add approval routes

TDD Step 3: REFACTOR
- Ensure proper error handling
- Add admin permission checks
- Implement audit logging
```

### **PHASE 4: DESKTOP API COMPLETION & TEST FIXING**
```
Priority 1: Fix hanging MemberRegistrationApiTest
- Debug service binding in MembershipServiceProvider
- Fix authentication mocking for Desktop API
- Ensure tenant switching works in tests

Priority 2: Complete Desktop API Registration
- Get all 7 registration tests passing
- Verify PENDING status for desktop registration
- Ensure admin authentication works

Priority 3: Integrate Approval APIs
- Connect approval endpoints to frontend
- Create Vue admin approval interface
- Test full workflow: Register → Approve → Active
```

---

## **🔧 CRITICAL TECHNICAL CONTEXT FOR NEXT SESSION**

### **MULTI-TENANT ARCHITECTURE:**
```
6 ROUTING CASES:
1. /api/v1/members              → Landlord API (central management)
2. /{tenant}/mapi/v1/members    → Tenant Mobile API ✓ COMPLETE
3. /mapi/v1/members             → Universal Mobile API (no tenant)
4. /{tenant}/api/v1/members     → Tenant Desktop API ⏳ IN PROGRESS
5. /api/v1/{tenant}/members     → Alternative Admin API
6. /members/{tenant}            → Public Facing API
```

### **DATABASE CONNECTIONS:**
```php
// Testing Environment (.env.testing)
DB_CONNECTION=tenant_test          # Default for tests
DB_TENANT_DATABASE=tenant_test     # Tenant test database
DB_LANDLORD_DATABASE=publicdigit_test  # Landlord test database

// Production uses Spatie tenant switching
'tenant' => [
    'database' => env('TENANT_PLACEHOLDER_DB', 'placeholder_tenant_db'),
    // Spatie switches database name per tenant at runtime
]
```

### **AUTHENTICATION STRATEGY:**
- **Mobile API (CASE 2)**: Token-based (Sanctum/JWT) - No auth for registration
- **Desktop API (CASE 4)**: Session-based (auth:web) - Admin authentication required
- **Test Mocking**: Use `Authenticatable` + `Authorizable` interfaces for Spatie permissions

---

## **📋 IMMEDIATE NEXT STEPS FOR NEXT SESSION**

### **TASK 1: COMPLETE DOMAIN LAYER (GREEN PHASE)**
1. **Create `MemberRejected` event** (mirroring `MemberApproved`)
2. **Implement `Member::approve()` method** with domain exception
3. **Implement `Member::reject()` method** with validation
4. **Add `MemberStatus::approved()` and `::rejected()` methods**
5. **Run domain tests** - Should all pass (9/9)

### **TASK 2: FIX DESKTOP API TESTS**
1. **Debug service binding** in `MembershipServiceProvider`
2. **Check `DesktopMemberRegistrationService` binding**
3. **Verify authentication mocking** implements both interfaces
4. **Run registration tests** - Should pass (7/7)

### **TASK 3: CREATE APPLICATION LAYER TESTS (RED)**
1. **Create `DesktopMemberApprovalServiceTest.php`** with failing tests
2. **Create `DesktopMemberRejectionServiceTest.php`** with failing tests
3. **Test service dependencies** and business rule validation

---

## **🎯 BUSINESS WORKFLOWS TO IMPLEMENT**

### **WORKFLOW 1: ADMIN DESKTOP REGISTRATION**
```
Admin creates member → PENDING status → Admin approves → ACTIVE status
Route: POST /{tenant}/api/v1/members → POST /{tenant}/api/v1/members/{id}/approve
```

### **WORKFLOW 2: CITIZEN MOBILE SELF-REGISTRATION**  
```
Citizen registers → DRAFT status → Email verification → Admin approves → ACTIVE status
Route: POST /{tenant}/mapi/v1/members/register → Admin approval via desktop
```

### **WORKFLOW 3: TWO-STEP ONBOARDING (FUTURE)**
```
User registers (tenant user) → Applies for membership → DRAFT status → Admin approves
Route: POST /{tenant}/register → POST /{tenant}/apply-membership → Admin approval
```

---

## **📞 STARTING NEXT SESSION READY FOR:**

### **As Senior Laravel Developer, you should:**
1. **Know DDD layers**: Domain → Application → Infrastructure separation
2. **Understand multi-tenancy**: Spatie package with 6 routing strategies
3. **Implement TDD**: RED→GREEN→REFACTOR cycle strictly
4. **Handle authentication**: Mobile (token) vs Desktop (session) differences
5. **Debug test issues**: Service binding, database connections, middleware

### **Current Challenges to Solve:**
1. **Test hanging** in Desktop API registration
2. **Domain events** need implementation
3. **Approval workflow** needs all three DDD layers
4. **Service binding** in MembershipServiceProvider needs verification

### **Ready to Continue With:**
**Domain Layer Implementation** (GREEN phase for approval tests) OR  
**Debug Test Hanging Issue** (fix Desktop API registration)

---

## **🏁 READY FOR NEXT SESSION**

**The architectural foundation is solid.** We have:
- ✅ DDD layers properly separated
- ✅ Multi-tenant routing strategy implemented  
- ✅ Mobile API complete and tested
- ✅ Desktop API infrastructure built
- ✅ TDD approach established with failing tests

**Next session can begin immediately with either:**
1. Implementing domain approval logic (GREEN phase)
2. Debugging test hanging issue
3. Creating application layer tests for approval

**Which would you prefer to tackle first in the next session?**
# 🚀 **NEXT SESSION START: DOMAIN LAYER IMPLEMENTATION (GREEN PHASE)**

## **📊 CURRENT STATUS: TDD RED PHASE COMPLETE**

✅ **Created**: `MemberApprovalTest.php` - 9 failing domain tests  
✅ **Created**: `MemberApproved.php` domain event  
❌ **Missing**: `MemberRejected.php` domain event  
❌ **Missing**: `Member::approve()` and `::reject()` methods  
❌ **Missing**: `MemberStatus::approved()` and `::rejected()` methods

## **🎯 TASK 1: CREATE MISSING DOMAIN EVENT**

```php
// app/Contexts/Membership/Domain/Events/MemberRejected.php
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

## **🎯 TASK 2: UPDATE MEMBERSTATUS VALUE OBJECT**

```php
// In app/Contexts/Membership/Domain/ValueObjects/MemberStatus.php
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
    
    // Ensure these methods exist for test compatibility
    public function isDraft(): bool
    {
        return $this->value === self::DRAFT;
    }
    
    // ... other existing methods
}
```

## **🎯 TASK 3: IMPLEMENT MEMBER AGGREGATE METHODS**

```php
// In app/Contexts/Membership/Domain/Models/Member.php
// Add these methods to the Member class:

use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberRejected;

/**
 * Approve a pending member
 * 
 * Business Rules:
 * - Only PENDING members can be approved
 * - Records who approved and when
 * - Changes status to APPROVED
 * - Raises MemberApproved domain event
 * 
 * @param string $approvedByUserId The admin user ID performing approval
 * @throws \DomainException If member is not in PENDING status
 */
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

/**
 * Reject a pending member with reason
 * 
 * Business Rules:
 * - Only PENDING members can be rejected
 * - Rejection reason is required (non-empty, non-whitespace)
 * - Records who rejected, when, and why
 * - Changes status to REJECTED
 * - Raises MemberRejected domain event
 * 
 * @param string $rejectedByUserId The admin user ID performing rejection
 * @param string $reason The reason for rejection (required)
 * @throws \DomainException If member is not in PENDING status
 * @throws \InvalidArgumentException If reason is empty or whitespace
 */
public function reject(string $rejectedByUserId, string $reason): void
{
    if (!$this->status->isPending()) {
        throw new \DomainException('Only pending members can be rejected.');
    }
    
    $trimmedReason = trim($reason);
    if (empty($trimmedReason)) {
        throw new \InvalidArgumentException('Rejection reason is required.');
    }
    
    $this->status = MemberStatus::rejected();
    $this->recordEvent(new MemberRejected(
        $this->id->value(),
        $this->tenantId,
        $rejectedByUserId,
        $trimmedReason,
        new \DateTimeImmutable()
    ));
}
```

## **🔧 TASK 4: RUN TESTS TO VERIFY GREEN PHASE**

```bash
# Run the domain approval tests
php artisan test tests/Unit/Contexts/Membership/Domain/MemberApprovalTest.php --colors=always
```

## **📋 EXPECTED OUTCOME:**

After implementing the above code, all 9 tests should pass:

```
✅ pending_member_can_be_approved
✅ non_pending_member_cannot_be_approved  
✅ pending_member_can_be_rejected_with_reason
✅ rejection_requires_non_empty_reason
✅ rejection_requires_non_whitespace_reason
✅ approved_member_cannot_be_rejected
✅ rejected_member_cannot_be_approved
✅ draft_member_cannot_be_approved
✅ approval_and_rejection_are_mutually_exclusive
```

## **🚀 NEXT STEPS AFTER GREEN PHASE:**

### **TDD REFACTOR PHASE:**
1. **Check for code duplication** - Extract common validation logic
2. **Ensure proper error messages** - Consistent with business terminology
3. **Verify event metadata** - All required audit fields present
4. **Test edge cases** - Empty strings, null values, special characters

### **PREPARE FOR APPLICATION LAYER:**
```php
// Plan for next session:
1. Create DesktopMemberApprovalServiceTest.php (RED)
2. Create DesktopMemberRejectionServiceTest.php (RED)  
3. Implement DTOs: MemberApprovalDto, MemberRejectionDto
4. Implement application services with repository dependency
```

## **💡 CRITICAL DDD PRINCIPLES TO MAINTAIN:**

### **1. Aggregate Root Responsibility:**
- `Member` aggregate handles its own state transitions
- Business rules enforced at domain level (not application/infrastructure)
- Events capture important state changes for other bounded contexts

### **2. Value Object Immutability:**
- `MemberStatus` is immutable - returns new instances
- Validation happens in constructor/factory methods
- Business logic encapsulated in value objects

### **3. Domain Events:**
- Events are part of the domain model
- Contain all information needed for downstream consumers
- Named in past tense (MemberApproved, MemberRejected)

## **🎯 READY TO IMPLEMENT:**

**Shall I create the `MemberRejected` domain event file first, or would you like to run the tests to see current failures?**
```diff
Create file packages\laravel-backend\app\Contexts\Membership\Domain\Events\MemberRejected.php
```

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