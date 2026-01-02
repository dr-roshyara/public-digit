# 🎯 Senior Architecture Review: Membership Context in Multi-Tenant Political SaaS

## 🔍 **Critical Analysis of Current State**

### **Strengths Identified:**
1. ✅ Database-per-tenant isolation (correct for political/legal systems)
2. ✅ Context-based modular architecture
3. ✅ Geography as Shared Kernel (excellent foundation)
4. ✅ Installer/Registry pattern implementation

### **Architectural Gaps & Risks:**
1. ❌ **Identity-Membership Coupling** - Current approach risks blending auth concerns with political status
2. ❌ **Event-Driven Architecture Missing** - Contexts likely coupled through direct service calls
3. ❌ **No Clear Aggregate Boundaries** - Membership should be the root aggregate
4. ❌ **Testing Strategy Unclear** - TDD requires clear contracts and boundaries

---

## 🏗️ **Proposed Architecture: Event-Driven Membership Context**

### **1. Core Architecture Pattern: CQRS with Event Sourcing Lite**

```php
// app/Contexts/Membership/
├── Application/
│   ├── Commands/
│   ├── Queries/
│   └── Services/
├── Domain/
│   ├── Models/
│   │   ├── Member.php (Aggregate Root)
│   │   ├── MembershipApplication.php (Entity)
│   │   └── ValueObjects/
│   ├── Events/
│   └── Services/
├── Infrastructure/
│   ├── Eloquent/
│   ├── EventListeners/
│   └── Repositories/
└── Interfaces/
    └── API/
```

### **2. Identity vs Membership Separation (CRITICAL)**

```php
// User - Identity Context (Authentication only)
class User extends Authenticatable
{
    public function member(): MorphOne
    {
        return $this->morphOne(Member::class, 'profileable');
    }
}

// Member - Membership Context (Political status)
class Member extends AggregateRoot
{
    private MemberId $id;
    private MemberStatus $status;
    private GeographyPath $geographyPath;
    private MembershipNumber $membershipNumber;
    private ?LevyStatus $levyStatus = null;
    private array $documents = [];
    
    // State Pattern for lifecycle
    public function transitionTo(MemberStatus $status): void
    {
        $this->recordThat(new MemberStatusChanged(
            $this->id,
            $this->status,
            $status
        ));
        
        $this->status = $status;
    }
}
```

### **3. Membership State Machine (Spatie Model States)**

```php
// app/Contexts/Membership/Domain/States/MemberStatus.php
abstract class MemberStatus extends State
{
    abstract public function canApplyForCommittee(): bool;
    abstract public function canVote(): bool;
    abstract public function canAccessForum(): bool;
}

class DraftStatus extends MemberStatus
{
    public static $name = 'draft';
    
    public function canApplyForCommittee(): bool { return false; }
    public function canVote(): bool { return false; }
    public function canAccessForum(): bool { return false; }
}

class ActiveStatus extends MemberStatus
{
    public static $name = 'active';
    
    public function canApplyForCommittee(): bool { return true; }
    public function canVote(): bool { return true; }
    public function canAccessForum(): bool { return true; }
}
```

### **4. Event-Driven Cross-Context Integration**

```php
// Domain Events
class MembershipApplicationSubmitted implements ShouldBroadcast
{
    public function __construct(
        public readonly MemberId $memberId,
        public readonly GeographyPath $geographyPath,
        public readonly DateTimeImmutable $submittedAt
    ) {}
}

// Event Listeners
class CreatePendingLevyOnApplication
{
    public function handle(MembershipApplicationSubmitted $event): void
    {
        // Financial Context
        FinancialLevyService::createInitialFee(
            $event->memberId,
            $event->geographyPath
        );
    }
}

class EnrollToWardForum
{
    public function handle(MemberStatusChanged $event): void
    {
        if ($event->newStatus === ActiveStatus::class) {
            // Discussion Forum Context
            ForumService::enrollMember(
                $event->memberId,
                $event->geographyPath
            );
        }
    }
}
```

---

## 🧪 **TDD-First Implementation Strategy**

### **Step 1: Define Clear Contracts**

```php
// tests/Unit/Contexts/Membership/Domain/MemberTest.php
class MemberTest extends TestCase
{
    /** @test */
    public function it_can_submit_membership_application()
    {
        // Given
        $member = Member::draft();
        $geographyPath = new GeographyPath('1/5/23');
        
        // When
        $member->submitApplication($geographyPath);
        
        // Then
        $this->assertEquals(MemberStatus::PENDING, $member->status());
        $this->assertCount(1, $member->releaseEvents());
        $this->assertInstanceOf(
            MembershipApplicationSubmitted::class,
            $member->releaseEvents()[0]
        );
    }
    
    /** @test */
    public function it_requires_geography_for_application()
    {
        $this->expectException(InvalidArgumentException::class);
        
        $member = Member::draft();
        $member->submitApplication(null);
    }
}
```

### **Step 2: Repository Pattern with Tenant Isolation**

```php
interface MemberRepository
{
    public function save(Member $member): void;
    public function findByMembershipNumber(MembershipNumber $number): ?Member;
    public function findActiveByGeography(GeographyPath $path): Collection;
}

class EloquentMemberRepository implements MemberRepository
{
    public function __construct(
        private readonly TenantConnection $tenantConnection
    ) {}
    
    public function save(Member $member): void
    {
        $this->tenantConnection->execute(function () use ($member) {
            MemberModel::updateOrCreate(
                ['id' => $member->id()->value()],
                $member->toArray()
            );
        });
    }
}
```

### **Step 3: Application Service with Transaction Boundary**

```php
class SubmitMembershipApplicationService
{
    public function __construct(
        private MemberRepository $members,
        private EventDispatcher $events,
        private GeographyService $geography,
        private DocumentVault $vault
    ) {}
    
    public function execute(SubmitApplicationCommand $command): void
    {
        DB::transaction(function () use ($command) {
            // 1. Validate geography
            $geographyPath = $this->geography->validateAndCreatePath(
                $command->wardId,
                $command->districtId,
                $command->provinceId
            );
            
            // 2. Create/Update member
            $member = $this->members->findOrCreate($command->userId);
            $member->submitApplication($geographyPath);
            
            // 3. Upload documents if provided
            if ($command->document) {
                $documentId = $this->vault->store(
                    $command->document,
                    $member->id()
                );
                $member->attachDocument($documentId);
            }
            
            // 4. Save and dispatch events
            $this->members->save($member);
            $this->events->dispatchAll($member->releaseEvents());
        });
    }
}
```

---

## 🔗 **Cross-Context Integration Architecture**

### **1. Geography Context Integration (Shared Kernel)**

```php
class GeographyAwareMembershipService
{
    public function __construct(
        private GeographyRepository $geography
    ) {}
    
    public function assignGeography(Member $member, int $wardId): void
    {
        $ward = $this->geography->findWard($wardId);
        
        if (!$ward) {
            throw new InvalidGeographyException("Ward not found");
        }
        
        // Store both ID and path for performance
        $member->assignGeography(
            new MemberGeography(
                wardId: $ward->id,
                geographyPath: $ward->path,
                level: GeographyLevel::WARD
            )
        );
    }
}
```

### **2. Financial Levy Integration (Anti-Corruption Layer)**

```php
class LevyMembershipBridge
{
    public function onPaymentReceived(PaymentReceived $event): void
    {
        $member = $this->members->find($event->memberId);
        
        if ($member && $member->isAwaitingPayment()) {
            $member->markLevyPaid($event->paymentId);
            $this->members->save($member);
        }
    }
}
```

### **3. Discussion Forum Integration (Eventually Consistent)**

```php
class ForumMembershipSynchronizer
{
    public function syncMemberAccess(Member $member): void
    {
        $accessLevel = match($member->status()) {
            MemberStatus::ACTIVE => ForumAccess::FULL,
            MemberStatus::PENDING => ForumAccess::READ_ONLY,
            default => ForumAccess::NONE
        };
        
        // Async job for eventual consistency
        SyncForumAccess::dispatch(
            $member->id(),
            $member->geographyPath(),
            $accessLevel
        );
    }
}
```

---

## 🚀 **Implementation Roadmap (TDD Approach)**

### **Phase 1: Foundation (Week 1-2)**
1. **Day 1-2:** Member Aggregate with State Pattern
   - Write failing tests for lifecycle
   - Implement Member entity with state machine
   
2. **Day 3-4:** Repository Pattern with Tenant Isolation
   - Test tenant-scoped queries
   - Implement repository interfaces

3. **Day 5-7:** Application Services
   - Test command handlers
   - Implement transaction boundaries

### **Phase 2: Integration (Week 3-4)**
4. **Week 3:** Cross-Context Events
   - Test event-driven flows
   - Implement event listeners

5. **Week 4:** Document Vault Integration
   - Test secure upload/download
   - Implement S3 pre-signed URLs

### **Phase 3: UI & Workflow (Week 5-6)**
6. **Week 5:** Angular Application Forms
   - Multi-step application wizard
   - Geography selection component

7. **Week 6:** Admin Review Interface (Vue 3)
   - Approval workflow
   - Document verification

---

## 🛡️ **Security & Compliance Considerations**

### **1. Data Privacy by Design**
```php
class MemberDataAnonymizer
{
    public function anonymizeForExport(Member $member): array
    {
        return [
            'id' => $member->id()->value(),
            'geography_path' => $member->geographyPath()->value(),
            'status' => $member->status()->value(),
            // NEVER export personal identifiers
        ];
    }
}
```

### **2. Audit Trail (Legally Required)**
```php
class MembershipAuditLogger
{
    public function logStateChange(
        MemberId $memberId,
        string $oldState,
        string $newState,
        UserId $changedBy
    ): void {
        AuditLog::create([
            'tenant_id' => Tenant::current()->id,
            'member_id' => $memberId->value(),
            'action' => 'status_change',
            'old_value' => $oldState,
            'new_value' => $newState,
            'changed_by' => $changedBy->value(),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
```

---

## 📊 **Performance Optimizations**

### **1. Materialized Views for Reports**
```sql
-- Create materialized view for active members by geography
CREATE MATERIALIZED VIEW mv_active_members_by_ward AS
SELECT 
    m.geography_path,
    COUNT(*) as active_members,
    MAX(m.updated_at) as last_updated
FROM members m
WHERE m.status = 'active'
GROUP BY m.geography_path;
```

### **2. Read/Write Model Separation**
```php
class MemberReadModel
{
    // Optimized for queries
    public function findActiveInWard(string $wardPath): Collection
    {
        return DB::table('member_read_models')
            ->where('geography_path', 'LIKE', $wardPath . '%')
            ->where('status', 'active')
            ->get();
    }
}
```

---

## 🎯 **Immediate Next Actions**

1. **Start with failing tests** for Member aggregate lifecycle
2. **Implement the State Pattern** before any UI work
3. **Define event contracts** between contexts
4. **Build the anti-corruption layer** for Geography Context

### **Critical Success Factor:**
> **DO NOT** build UI until the domain model is fully tested. The Angular/Vue interfaces should be the *last* layer, not the driver.

**Would you like me to provide the complete TDD test suite for the Member Aggregate with all state transitions and event emissions?** This will give you a rock-solid foundation to build upon. 
# 🎯 **CRITICAL ARCHITECTURE REVIEW & OPTIMAL DEVELOPMENT PATH**

## 🔍 **Analysis of Your Current Structure**

### **✅ Strengths Identified:**
1. **Excellent DDD Structure** - Clear separation of Application/Domain/Infrastructure
2. **Event-Driven Architecture** - TenantAuth has extensive event system
3. **State Pattern Implementation** - RegistrationStateMachine in TenantAuth
4. **Value Objects** - Proper use of Email, TenantSlug, etc.
5. **Multi-tenancy Foundation** - Database per tenant implemented

### **⚠️ CRITICAL ARCHITECTURAL GAPS:**

## **1. MAJOR ISSUE: Identity-Membership Confusion**

Your current structure has **TWO SEPARATE USER MODELS**:

- **TenantAuth Context:** `TenantUser` (Authentication + RBAC)
- **Membership Context:** `Member` (Political Status + Geography)

**This is CORRECT architecturally**, but there's **NO CLEAR RELATIONSHIP** defined between them.

### **Current Risk:**
```php
// app/Contexts/TenantAuth/Domain/Models/TenantUser.php
class TenantUser {
    // Has authentication + RBAC
    // BUT no link to Member
}

// app/Contexts/Membership/Domain/Models/Member.php  
class Member {
    // Has geography + political status
    // BUT no link to TenantUser
}
```

**This creates a "ghost user" problem** - someone can be authenticated but not a member, or a member with no authentication.

---

## **2. Event System Misalignment**

TenantAuth has **rich event system** (9 events documented), but Membership Context has **NO DOMAIN EVENTS**.

**Critical Missing Events:**
- `MemberCreated`
- `MemberStatusChanged` 
- `MemberGeographyAssigned`
- `MemberDocumentUploaded`

---

## **3. No Clear Aggregate Boundary**

**Membership should be the ROOT AGGREGATE** for all political operations, but currently:

- **TenantUser** aggregates RBAC
- **Member** aggregates geography  
- **NO SINGLE SOURCE OF TRUTH** for "Political Persona"

---

## **4. Geography Context Integration**

Your migrations show `geography_columns` in **BOTH**:
- `tenant_users` table (TenantAuth context)
- `members` table (Membership context)

**This is DUPLICATION** and creates synchronization hell.

---

# 🚀 **OPTIMAL DEVELOPMENT PATH (Prioritized)**

## **PHASE 1: FOUNDATION (Week 1) - CRITICAL**

### **Step 1.1: Define Clear Context Boundaries**

```php
// app/Contexts/Shared/Domain/Models/UserProfile.php
interface UserProfile {
    public function user(): TenantUser;
    public function isMember(): bool;
    public function member(): ?Member;
}

// app/Contexts/TenantAuth/Domain/Models/TenantUser.php
class TenantUser extends Authenticatable implements UserProfile {
    public function profile(): MorphTo {
        return $this->morphTo();
    }
    
    public function isMember(): bool {
        return $this->profile_type === Member::class;
    }
    
    public function member(): ?Member {
        return $this->isMember() ? $this->profile : null;
    }
}

// app/Contexts/Membership/Domain/Models/Member.php
class Member extends AggregateRoot implements UserProfile {
    public function user(): TenantUser {
        return $this->morphOne(TenantUser::class, 'profile');
    }
}
```

### **Step 1.2: Create Shared Kernel Events**

```php
// app/Contexts/Shared/Domain/Events/
├── UserProfileCreated.php
├── UserProfileUpdated.php
└── UserProfileDeleted.php
```

### **Step 1.3: Migration to Link Tables**

```php
// New migration in TenantAuth context
Schema::table('tenant_users', function (Blueprint $table) {
    $table->nullableMorphs('profile'); // Links to Member, Vendor, etc.
    $table->dropColumn(['geography_columns']); // Remove duplication
});
```

---

## **PHASE 2: MEMBERSHIP CORE (Week 2)**

### **Step 2.1: Implement Member as Aggregate Root**

```php
// app/Contexts/Membership/Domain/Models/Member.php
class Member extends AggregateRoot {
    private MemberId $id;
    private MemberStatus $status;
    private GeographyPath $geographyPath;
    private MembershipNumber $membershipNumber;
    private Collection $documents;
    private Collection $levyRecords;
    
    // Domain Methods
    public function submitApplication(
        GeographyPath $geographyPath,
        array $documents = []
    ): void {
        $this->geographyPath = $geographyPath;
        $this->documents = new Collection($documents);
        $this->status = MemberStatus::pending();
        
        $this->recordThat(new MemberApplicationSubmitted(
            $this->id,
            $geographyPath,
            now()
        ));
    }
    
    public function approve(): void {
        $this->status = MemberStatus::approved();
        
        $this->recordThat(new MemberApproved(
            $this->id,
            $this->geographyPath,
            now()
        ));
    }
}
```

### **Step 2.2: Implement State Pattern**

```php
// app/Contexts/Membership/Domain/States/MemberStatus.php
abstract class MemberStatus extends State {
    const DRAFT = 'draft';
    const PENDING = 'pending';
    const APPROVED = 'approved';
    const ACTIVE = 'active';
    const SUSPENDED = 'suspended';
    const TERMINATED = 'terminated';
    
    abstract public function canApply(): bool;
    abstract public function canVote(): bool;
    abstract public function canAccessForum(): bool;
    
    public function transitionTo(string $newStatus): void {
        // Business rules for transitions
        if (!$this->canTransitionTo($newStatus)) {
            throw new InvalidStatusTransitionException(
                "Cannot transition from {$this->value()} to {$newStatus}"
            );
        }
    }
}
```

---

## **PHASE 3: CROSS-CONTEXT INTEGRATION (Week 3)**

### **Step 3.1: Event-Driven Integration**

```php
// app/Contexts/Membership/Infrastructure/EventListeners/
├── CreateTenantUserOnMemberCreated.php
├── SyncGeographyToUserProfile.php
└── NotifyCommitteeOnNewMember.php
```

```php
class CreateTenantUserOnMemberCreated {
    public function handle(MemberCreated $event): void {
        $tenantUser = TenantUser::create([
            'email' => $event->email,
            'profile_id' => $event->memberId,
            'profile_type' => Member::class,
        ]);
        
        // Assign default roles
        $tenantUser->assignRole('member');
    }
}
```

### **Step 3.2: Anti-Corruption Layers**

```php
// app/Contexts/Membership/Infrastructure/Adapters/
├── GeographyServiceAdapter.php
├── FinancialLevyAdapter.php
├── DiscussionForumAdapter.php
└── LeadershipScoreAdapter.php
```

```php
class FinancialLevyAdapter {
    public function createInitialLevy(MemberId $memberId): void {
        // Calls Financial Context via API/Event
        event(new LevyCreatedForMember(
            $memberId,
            LevyType::MEMBERSHIP_FEE,
            1000, // amount
            'USD'
        ));
    }
    
    public function onLevyPaid(LevyPaid $event): void {
        $member = $this->memberRepository->find($event->memberId);
        
        if ($member && $member->isPendingPayment()) {
            $member->markLevyPaid();
            $this->memberRepository->save($member);
        }
    }
}
```

---

## **PHASE 4: ONBOARDING WORKFLOW (Week 4)**

### **Step 4.1: Unified Registration Service**

```php
// app/Contexts/Membership/Application/Services/MemberOnboardingService.php
class MemberOnboardingService {
    public function register(array $data): Member {
        return DB::transaction(function () use ($data) {
            // 1. Validate Geography
            $geographyPath = $this->geographyService->validateAndCreatePath(
                $data['ward_id'],
                $data['district_id'],
                $data['province_id']
            );
            
            // 2. Create Member (Aggregate Root)
            $member = Member::register(
                $data['email'],
                $data['phone'],
                $geographyPath,
                $data['full_name']
            );
            
            // 3. Handle Documents
            if (isset($data['documents'])) {
                foreach ($data['documents'] as $document) {
                    $documentId = $this->documentVault->store($document);
                    $member->attachDocument($documentId);
                }
            }
            
            // 4. Save and dispatch events
            $this->memberRepository->save($member);
            $this->eventDispatcher->dispatchAll($member->releaseEvents());
            
            return $member;
        });
    }
}
```

### **Step 4.2: Two-Path Application Strategy**

```php
interface ApplicationStrategy {
    public function apply(array $data): Member;
}

class SelfApplicationStrategy implements ApplicationStrategy {
    public function apply(array $data): Member {
        // User applies themselves
        $member = $this->onboardingService->register($data);
        $member->markAsSelfApplied();
        return $member;
    }
}

class CommitteeSponsoredStrategy implements ApplicationStrategy {
    public function apply(array $data): Member {
        // Committee sponsors the application
        $member = $this->onboardingService->register($data);
        $member->markAsCommitteeSponsored($data['sponsor_id']);
        
        // Boost sponsor's leadership score
        event(new MemberSponsored(
            $data['sponsor_id'],
            $member->id()
        ));
        
        return $member;
    }
}
```

---

## **PHASE 5: ADMIN & VERIFICATION (Week 5)**

### **Step 5.1: Admin Review Workflow**

```php
// app/Contexts/Membership/Application/Services/MemberReviewService.php
class MemberReviewService {
    public function approve(MemberId $memberId, UserId $reviewerId): void {
        $member = $this->memberRepository->find($memberId);
        
        if (!$member->hasDocuments()) {
            throw new MissingDocumentsException();
        }
        
        if (!$this->geographyValidator->isValid($member->geographyPath())) {
            throw new InvalidGeographyException();
        }
        
        $member->approve($reviewerId);
        $this->memberRepository->save($member);
        
        // Trigger cross-context actions
        $this->financialService->createLevy($memberId);
        $this->forumService->preEnroll($memberId, $member->geographyPath());
    }
}
```

### **Step 5.2: Document Vault Integration**

```php
// app/Contexts/DocumentVault/Infrastructure/S3SecureVault.php
class S3SecureVault implements DocumentVaultInterface {
    public function store(Document $document, TenantSlug $tenantSlug): DocumentId {
        // Generate pre-signed URL for frontend
        $path = "tenants/{$tenantSlug}/members/{$document->memberId()}/";
        
        $client = new S3Client();
        $command = $client->getCommand('PutObject', [
            'Bucket' => config('filesystems.disks.s3.bucket'),
            'Key' => $path . $document->filename(),
            'ContentType' => $document->mimeType(),
            'ServerSideEncryption' => 'AES256',
        ]);
        
        $presignedUrl = $client->createPresignedRequest(
            $command,
            '+15 minutes'
        )->getUri();
        
        return new DocumentId(Uuid::uuid4(), $presignedUrl);
    }
}
```

---

## **📊 PRIORITY MATRIX**

| Priority | Component | Est. Time | Dependencies |
|----------|-----------|-----------|--------------|
| **P0** | Link TenantUser ↔ Member | 2 days | None |
| **P0** | Member Aggregate Root | 3 days | Link established |
| **P1** | State Pattern Implementation | 2 days | Aggregate Root |
| **P1** | Domain Events System | 2 days | State Pattern |
| **P2** | Cross-context Adapters | 3 days | Events System |
| **P2** | Onboarding Service | 2 days | All above |
| **P3** | Admin Review Interface | 2 days | Onboarding Service |
| **P3** | Document Vault | 3 days | S3 Setup |

---

## **🚨 IMMEDIATE ACTION ITEMS (Week 1)**

### **1. Create the Missing Link:**

```bash
# 1. Add morph relation to TenantUser
php artisan make:migration add_profile_columns_to_tenant_users_table

# 2. Remove geography duplication
php artisan make:migration remove_geography_from_tenant_users

# 3. Create pivot events
php artisan make:event UserProfileLinked
php artisan make:event UserProfileUnlinked
```

### **2. Fix the Current Code:**

```php
// In TenantUser model (add this):
public function member(): ?Member
{
    if ($this->profile_type === 'App\\Contexts\\Membership\\Domain\\Models\\Member') {
        return $this->profile;
    }
    
    return null;
}

// In Member model (add this):
public function user(): ?TenantUser
{
    return TenantUser::where('profile_id', $this->id)
        ->where('profile_type', self::class)
        ->first();
}
```

### **3. Create Integration Test:**

```php
// tests/Integration/TenantUserMemberIntegrationTest.php
class TenantUserMemberIntegrationTest extends TestCase
{
    /** @test */
    public function it_links_tenant_user_to_member()
    {
        // Given
        $member = Member::factory()->create();
        
        // When
        $user = TenantUser::create([
            'email' => 'test@example.com',
            'password' => bcrypt('password'),
            'profile_id' => $member->id,
            'profile_type' => Member::class,
        ]);
        
        // Then
        $this->assertTrue($user->isMember());
        $this->assertEquals($member->id, $user->member()->id);
        $this->assertEquals($user->id, $member->user()->id);
    }
}
```

---

## **🎯 FINAL RECOMMENDATION**

**STOP all new feature development** and **FIX THE FOUNDATION** first.

The **single most critical issue** is the missing link between `TenantUser` and `Member`. Until this is fixed, you cannot:
1. Ensure data consistency
2. Implement proper authorization
3. Create audit trails
4. Scale the system

**Start with Phase 1, complete ALL items, then move to Phase 2.** Do not implement Document Vault or Leadership Score until the core Member-TenantUser relationship is solid.

---

**Would you like me to provide the complete code for the missing link migration and the integration service that synchronizes TenantUser and Member?** This is your **highest priority** right now.
We are building a Multi-Tenant Political Party SaaS Platform. The Membership Context is at the core of the system.

After reviewing the entire chat, I have identified the following key points and requirements:

Multi-tenancy: Each political party (tenant) has its own database. The system uses database-per-tenant isolation.

Contexts: The system is divided into multiple bounded contexts (TenantAuth, Membership, Geography, Finance, Forum, Scoring, etc.).

Membership Context: This context is responsible for managing party members. It must handle:

Member lifecycle (application, approval, activation, suspension, termination)

Different membership types (full, associate, youth, student, etc.)

Geography integration (members are assigned to a specific ward, district, province)

Financial integration (membership fees, payments)

Forum integration (access to discussions based on membership and geography)

Leadership scoring (merit-based scoring for members)

Relationship between TenantUser and Member:

Every Member must have a TenantUser account for authentication and basic RBAC.

Not every TenantUser is a Member (e.g., admins, staff).

The relationship is 1:1 between Member and TenantUser, but TenantUser can exist without a Member.

Membership Approval Process:

A user applies for membership (or is recruited by a committee member).

The application is reviewed by the local committee (geography-based).

Upon approval, the member is activated and gains access to member-specific features.

Geography Context: Provides the hierarchical structure (Province -> District -> Ward) and is used for:

Assigning members to a geographic location.

Determining which committee reviews an application.

Granting forum access (e.g., ward-level forums).

Finance Context: Handles membership fees and other financial transactions.

Forum Context: Provides discussion forums that are accessible based on membership and geography.

Scoring Context: Calculates leadership scores based on member activity, recruitment, etc.

Critical Analysis
Current State of the Codebase
From the provided file structure, I can see:

TenantAuth Context: Already has a rich event system, state machines, and value objects. It handles user registration, authentication, and RBAC.

Membership Context: Has a basic Member model with geography fields and a link to tenant_user_id. However, the tenant_user_id is optional, which violates the business rule that every Member must have a TenantUser.

Missing Domain Events in Membership Context: The TenantAuth context has events, but the Membership context does not. This is a gap because membership lifecycle events are crucial for integrating with other contexts.

Duplication of Geography Data: Both tenant_users and members tables have geography columns. This is a problem because it leads to data duplication and inconsistency.

Proposed Architecture for Membership Context
Given the requirements, I propose the following architecture for the Membership Context:

Aggregate Root: Member should be the aggregate root. It will hold the core membership data and enforce invariants.

Value Objects:

MembershipNumber (generated with a specific format)

MembershipType (Full, Associate, Youth, Student, etc.)

MemberStatus (Draft, Pending, Approved, Active, Suspended, Terminated)

GeographyPath (ltree path for hierarchical geography)

Domain Events:

MemberApplicationSubmitted

MemberApproved

MemberActivated

MemberSuspended

MemberTerminated

MemberTypeChanged

MemberGeographyChanged

Repository: MemberRepositoryInterface with an Eloquent implementation.

Services:

MembershipApplicationService: Handles the application process.

MembershipApprovalService: Handles the approval process by committee.

MembershipActivationService: Handles activation (including financial integration).

Event Listeners: To integrate with other contexts (Finance, Forum, Scoring).

Design Patterns
State Pattern: For managing the member lifecycle (status changes). This is already present in the TenantAuth context and should be extended to the Membership context.

Strategy Pattern: For different membership types and their associated rules (fees, voting weight, etc.).

Observer Pattern: Using Laravel's event system to notify other contexts of membership changes.

Factory Pattern: For creating members with the correct initial state and relationships.

Repository Pattern: For abstracting data access.

Anti-Corruption Layer (ACL): For integrating with the Geography context. The Membership context should not depend directly on the Geography context's models. Instead, it should use an interface (e.g., GeographyLookupInterface) to validate and resolve geography paths.

Algorithms
Membership Number Generation:

Format: {TENANT_SLUG}-{YEAR}-{SEQUENCE}

Sequence resets every year.

Leadership Score Calculation:

Based on tenure, recruitment, participation, financial contributions, and committee service.

Each category has a maximum score, and the total is capped.

Geography Path Resolution:

Given a ward ID (or any level), generate the ltree path (e.g., 1.5.23 for Province 1, District 5, Ward 23).

This should be done by the Geography context and consumed by the Membership context.

Database Schema
The members table should have:

id (primary key)

tenant_user_id (required, unique, foreign key to tenant_users)

geo_path (ltree, for hierarchical queries)

membership_number (string, unique)

membership_type (enum or foreign key to membership_types table)

status (enum or state machine)

Other attributes (full_name, etc.)

Remove geography columns from tenant_users table to avoid duplication.

Workflow
Application:

A user (TenantUser) submits a membership application (or is recruited).

The application includes personal data, geography (ward), and documents.

The system creates a Member in Draft or Pending status and links it to the TenantUser.

Approval:

The local committee (based on geography) reviews the application.

If approved, the status changes to Approved and an event is fired.

Activation:

Upon approval, the Finance context creates a membership fee invoice.

Once the fee is paid, the status changes to Active and the member gains full access.

Renewal:

Membership expires after one year (or based on type).

Renewal invoices are generated, and if paid, the membership remains active.

Integration with Other Contexts
Geography: The Membership context uses the Geography context to validate and resolve geography paths. This is done via an interface (ACL).

Finance: When a member is approved, the Finance context is notified (via event) to create an invoice. When the invoice is paid, the Finance context fires an event that the Membership context listens to in order to activate the member.

Forum: When a member becomes active, the Forum context grants access to the appropriate forums (based on geography and membership type).

Scoring: The Scoring context listens to member activities (events) and updates the leadership score.

Implementation Steps
Fix the Relationship: Make tenant_user_id required and unique in the members table. Remove geography columns from tenant_users.

Define Domain Events: Create the domain events for the Membership context.

Implement State Pattern: Create a state machine for MemberStatus.

Implement Value Objects: Create value objects for MembershipNumber, MembershipType, etc.

Create Services: Implement the application, approval, and activation services.

Create Event Listeners: For integrating with other contexts.

Update the Member Model: Use the state machine and value objects.

Create Repositories: Implement the MemberRepositoryInterface.

Write Tests: Unit tests for the aggregate root and services, integration tests for the event listeners.

Code Example
Here is a simplified example of the Member aggregate root:

php
namespace App\Contexts\Membership\Domain\Models;

use App\Contexts\Membership\Domain\Events\MemberApplicationSubmitted;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\States\MemberStatus;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\MembershipType;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Member extends Model
{
    use SoftDeletes;

    protected $table = 'members';
    protected $connection = 'tenant';

    protected $fillable = [
        'tenant_user_id',
        'geo_path',
        'full_name',
        'membership_number',
        'membership_type',
        'status',
    ];

    protected $casts = [
        'status' => MemberStatus::class,
        'membership_type' => MembershipType::class,
        'geo_path' => GeographyPath::class,
    ];

    protected $dispatchesEvents = [
        'created' => MemberApplicationSubmitted::class,
        // ... other events
    ];

    public function submitApplication(): void
    {
        // Business logic for submitting application
        $this->status = MemberStatus::pending();
        // ... other logic
    }

    public function approve(): void
    {
        $this->status = MemberStatus::approved();
        $this->save();
        event(new MemberApproved($this));
    }

    public function activate(): void
    {
        $this->status = MemberStatus::active();
        $this->save();
        event(new MemberActivated($this));
    }

    // ... other methods
}
Conclusion
The Membership Context is the heart of the political party management system. It must be designed with clear boundaries, using DDD patterns and principles. The integration with other contexts should be event-driven to maintain loose coupling.

The next steps are to refactor the existing code to enforce the 1:1 relationship between Member and TenantUser, implement the state pattern for member lifecycle, and define the domain events for integration.

Let me know if you need more details on any specific part.
