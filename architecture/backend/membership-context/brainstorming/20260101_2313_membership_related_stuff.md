Below is the **exact, formal definition** of the **Membership Aggregate Root**, written at **DDD / solution-architect level**, and **ready to be implemented in Laravel 12**.

This is the **single most important domain model** in your system. Everything else must orbit around it.

---

# Membership Aggregate Root

*(Authoritative Definition)*

## 1. What the Membership Aggregate IS (and IS NOT)

### IS

* The **legal and political representation of a person inside a party**
* The **single source of truth** for:

  * Rights
  * Eligibility
  * Participation
  * Standing
  * Geography alignment
* The **only entity allowed** to grant access to:

  * Voting
  * Forums
  * Committees
  * Leadership scoring

### IS NOT

* An authentication account
* A payment record
* A document store
* A forum profile
* A leaderboard entry

> ⚠️ Any logic placed outside this aggregate that *decides rights* is a design violation.

---

## 2. Aggregate Root Definition (DDD)

### Aggregate Root Name

```
Membership
```

### Aggregate Boundary

Everything inside this boundary **must be transactionally consistent**.

Everything outside communicates **only via domain events**.

---

## 3. Membership Aggregate Structure

```
Membership (AGGREGATE ROOT)
│
├── IdentityReference (UserId)
├── MembershipNumber (Value Object)
├── Status (State Machine)
│
├── PersonalProfile (Value Object)
│   ├── LegalName
│   ├── DateOfBirth
│   ├── Gender (optional)
│
├── GeographyAssignment (Value Object)
│   ├── geography_node_id
│   ├── geography_path_snapshot
│
├── Sponsorship (Entity)
│   ├── sponsor_membership_id
│   ├── sponsorship_type
│
├── FinancialStanding (Value Object)
│   ├── levy_status
│   ├── last_payment_at
│
├── VerificationStatus (Value Object)
│   ├── document_verified
│   ├── verified_at
│
├── ParticipationFlags (Derived)
│   ├── can_vote
│   ├── can_post
│   ├── can_hold_office
│
└── AuditTrail (Implicit via Events)
```

---

## 4. Membership Aggregate Invariants (CRITICAL)

These rules **must never be violated**:

### Invariant 1 – Identity Separation

```text
User exists WITHOUT Membership
Membership cannot exist WITHOUT User
```

### Invariant 2 – Geography Binding

```text
Every ACTIVE Membership MUST be bound to exactly ONE Ward
```

### Invariant 3 – Status Authority

```text
Only Membership Status determines rights
```

### Invariant 4 – Financial Neutrality

```text
Membership does NOT calculate payments
It reacts to payment events
```

### Invariant 5 – Verification Gate

```text
No ACTIVE status without verification
```

---

## 5. Membership State Machine (Exact)

### States

```php
Draft
Submitted
Verified
AwaitingLevy
Active
Suspended
Terminated
```

### Allowed Transitions (STRICT)

```
Draft → Submitted
Submitted → Verified
Verified → AwaitingLevy
AwaitingLevy → Active
Active → Suspended
Suspended → Active
Active → Terminated
```

❌ No shortcuts
❌ No backward jumps
❌ No controller-based overrides

---

## 6. Membership Aggregate Responsibilities

### Membership CAN:

* Transition its own state
* Assign geography
* Accept sponsorship
* React to verification result
* React to levy result
* Emit domain events

### Membership CANNOT:

* Upload documents
* Charge money
* Create forum accounts
* Calculate leadership score

---

## 7. Domain Events Emitted by Membership

These are **contractual guarantees** to other contexts.

```php
MembershipSubmitted
MembershipVerified
MembershipActivated
MembershipSuspended
MembershipTerminated
```

> Other contexts **subscribe**, never query Membership directly.

---

## 8. Laravel 12 – Aggregate Implementation Skeleton

### Aggregate Root Model

```php
final class Membership extends Model
{
    protected $table = 'memberships';

    protected $casts = [
        'status' => MembershipStatus::class,
        'personal_profile' => PersonalProfile::class,
        'geography' => GeographyAssignment::class,
        'financial_standing' => FinancialStanding::class,
        'verification_status' => VerificationStatus::class,
    ];

    /* -------------------------
       Aggregate Commands
    ------------------------- */

    public function submit(): void
    {
        $this->status->transitionTo(Submitted::class);
        event(new MembershipSubmitted($this));
    }

    public function verify(): void
    {
        $this->status->transitionTo(Verified::class);
        event(new MembershipVerified($this));
    }

    public function activate(): void
    {
        $this->guardActivation();
        $this->status->transitionTo(Active::class);
        event(new MembershipActivated($this));
    }

    private function guardActivation(): void
    {
        if (!$this->verification_status->isVerified()) {
            throw new DomainException('Membership not verified');
        }

        if (!$this->financial_standing->isClear()) {
            throw new DomainException('Levy not cleared');
        }
    }
}
```

---

## 9. Value Objects (Why They Matter)

### Example: GeographyAssignment

```php
final class GeographyAssignment
{
    public function __construct(
        public int $nodeId,
        public string $pathSnapshot
    ) {}
}
```

Benefits:

* Immutable
* Testable
* No accidental mutation
* Political audit safety

---

## 10. How Other Contexts Interact (Cleanly)

| Context          | Interaction Type          |
| ---------------- | ------------------------- |
| Geography        | Read-only lookup          |
| Document Vault   | Emits verification result |
| Financial Levy   | Emits payment result      |
| Forum            | Subscribes to activation  |
| Leadership Score | Subscribes to events      |

---

## 11. Why This Aggregate Is Correct

✔ Legally defensible
✔ Politically neutral
✔ Technically scalable
✔ Auditable
✔ Tenant-safe
✔ Context-independent

This is **exactly** how serious civic / electoral systems are built.

---

## 12. Next Logical Step (Architectural)

If you want to continue *correctly*, the next steps should be **in this order**:

1. Define **Membership Domain Events (exact payloads)**
2. Define **Application Services (Commands)**
3. Define **Event Subscribers per context**
4. Lock database migrations to this model

If you want, I can next:

* Design **Membership Application Service**
* Define **Event Contracts**
* Design **Admin Review Workflow**
* Define **Committee Sponsorship Rules**

Just tell me the direction.
Below is a **production-grade, opinionated, and internally consistent** definition of:

1. **Laravel folder structures per context (DDD + Hexagonal)**
2. **Exact Membership Domain Events**
3. **Event Contracts (payloads + guarantees)**
4. **Rules for cross-context interaction**

This is written so you can **freeze it as an architectural constitution** and build safely for years.

---

# 1. Global Laravel Project Structure (Context-First)

You are **not** building a classic `app/Models` Laravel app.

Your root rule:

> **No class may live outside a Context unless it is truly shared infrastructure.**

---

## 1.1 Top-Level `app/` Structure

```text
app/
├── Contexts/
│   ├── Identity/
│   ├── Membership/
│   ├── Geography/
│   ├── Verification/
│   ├── FinancialLevy/
│   ├── DiscussionForum/
│   └── LeadershipScore/
│
├── Shared/
│   ├── Domain/
│   ├── Infrastructure/
│   └── Events/
│
├── Tenancy/
│   ├── Middleware/
│   └── Bootstrap/
│
└── Providers/
```

---

# 2. Standard Internal Structure of a Context (Hexagonal)

Every context **must follow the same skeleton**.

### Canonical Context Layout

```text
Contexts/{ContextName}/
├── Domain/
│   ├── Aggregates/
│   ├── Entities/
│   ├── ValueObjects/
│   ├── Events/
│   ├── Exceptions/
│   └── Repositories/
│
├── Application/
│   ├── Commands/
│   ├── Services/
│   └── DTOs/
│
├── Infrastructure/
│   ├── Persistence/
│   │   ├── Eloquent/
│   │   └── Migrations/
│   │
│   ├── EventSubscribers/
│   ├── Http/
│   │   ├── Controllers/
│   │   └── Requests/
│   │
│   └── Providers/
│
└── Tests/
```

> 📌 If a folder is empty, **keep it anyway**. Structure is law.

---

# 3. Membership Context – Exact Folder Structure

```text
Contexts/Membership/
├── Domain/
│   ├── Aggregates/
│   │   └── Membership.php
│   │
│   ├── ValueObjects/
│   │   ├── MembershipNumber.php
│   │   ├── PersonalProfile.php
│   │   ├── GeographyAssignment.php
│   │   ├── FinancialStanding.php
│   │   └── VerificationStatus.php
│   │
│   ├── States/
│   │   ├── MembershipState.php
│   │   ├── Draft.php
│   │   ├── Submitted.php
│   │   ├── Verified.php
│   │   ├── AwaitingLevy.php
│   │   ├── Active.php
│   │   ├── Suspended.php
│   │   └── Terminated.php
│   │
│   ├── Events/
│   │   ├── MembershipSubmitted.php
│   │   ├── MembershipVerified.php
│   │   ├── MembershipActivated.php
│   │   ├── MembershipSuspended.php
│   │   └── MembershipTerminated.php
│   │
│   ├── Exceptions/
│   │   ├── InvalidMembershipTransition.php
│   │   └── MembershipInvariantViolation.php
│   │
│   └── Repositories/
│       └── MembershipRepository.php
│
├── Application/
│   ├── Commands/
│   │   ├── SubmitMembershipCommand.php
│   │   ├── VerifyMembershipCommand.php
│   │   ├── ActivateMembershipCommand.php
│   │   └── SuspendMembershipCommand.php
│   │
│   └── Services/
│       └── MembershipApplicationService.php
│
├── Infrastructure/
│   ├── Persistence/
│   │   ├── Eloquent/
│   │   │   └── EloquentMembershipRepository.php
│   │   └── Migrations/
│   │       └── tenant_create_memberships_table.php
│   │
│   ├── EventSubscribers/
│   │   ├── OnDocumentVerified.php
│   │   └── OnLevyPaid.php
│   │
│   └── Providers/
│       └── MembershipServiceProvider.php
│
└── Tests/
```

---

# 4. Membership Domain Events (Exact Definitions)

These are **pure domain events**.
They contain **facts**, not behavior.

---

## 4.1 Base Event Contract (Shared)

```php
namespace App\Shared\Events;

interface DomainEvent
{
    public function occurredOn(): \DateTimeImmutable;
    public function aggregateId(): string;
}
```

---

## 4.2 MembershipSubmitted

```php
final class MembershipSubmitted implements DomainEvent
{
    public function __construct(
        public readonly string $membershipId,
        public readonly string $userId,
        public readonly int $geographyNodeId,
        public readonly string $geographyPathSnapshot,
        public readonly ?string $sponsorMembershipId,
        public readonly \DateTimeImmutable $occurredOn
    ) {}

    public function aggregateId(): string
    {
        return $this->membershipId;
    }
}
```

### Guarantees

* Application data is complete
* Documents may still be pending
* No rights granted

---

## 4.3 MembershipVerified

```php
final class MembershipVerified implements DomainEvent
{
    public function __construct(
        public readonly string $membershipId,
        public readonly string $verifiedByAdminId,
        public readonly \DateTimeImmutable $verifiedAt
    ) {}

    public function aggregateId(): string
    {
        return $this->membershipId;
    }
}
```

### Guarantees

* Identity documents verified
* Geography confirmed
* Still no participation rights

---

## 4.4 MembershipActivated (MOST IMPORTANT)

```php
final class MembershipActivated implements DomainEvent
{
    public function __construct(
        public readonly string $membershipId,
        public readonly string $userId,
        public readonly int $wardNodeId,
        public readonly string $geographyPathSnapshot,
        public readonly string $membershipNumber,
        public readonly \DateTimeImmutable $activatedAt
    ) {}

    public function aggregateId(): string
    {
        return $this->membershipId;
    }
}
```

### Guarantees

* Levy paid
* Verification completed
* Full political rights granted
* Downstream contexts MAY act

---

## 4.5 MembershipSuspended

```php
final class MembershipSuspended implements DomainEvent
{
    public function __construct(
        public readonly string $membershipId,
        public readonly string $reason,
        public readonly \DateTimeImmutable $suspendedAt
    ) {}

    public function aggregateId(): string
    {
        return $this->membershipId;
    }
}
```

### Guarantees

* Rights revoked
* Read-only access may remain
* Forums / voting must block

---

## 4.6 MembershipTerminated

```php
final class MembershipTerminated implements DomainEvent
{
    public function __construct(
        public readonly string $membershipId,
        public readonly string $terminatedBy,
        public readonly \DateTimeImmutable $terminatedAt
    ) {}

    public function aggregateId(): string
    {
        return $this->membershipId;
    }
}
```

### Guarantees

* Irreversible
* No reactivation
* Historical records preserved

---

# 5. Event Contracts: Who Publishes / Who Subscribes

### Membership Context (Publisher)

```text
MembershipSubmitted
MembershipVerified
MembershipActivated
MembershipSuspended
MembershipTerminated
```

---

## 5.1 Financial Levy Context

**Subscribes to**

```text
MembershipVerified
```

**Publishes**

```text
LevyPaid
LevyOverdue
```

---

## 5.2 Verification Context

**Subscribes to**

```text
MembershipSubmitted
```

**Publishes**

```text
DocumentVerified
DocumentRejected
```

---

## 5.3 Discussion Forum Context

**Subscribes to**

```text
MembershipActivated
MembershipSuspended
MembershipTerminated
```

**Actions**

* Create forum identity
* Assign ward forums
* Revoke access

---

## 5.4 Leadership Score Context

**Subscribes to**

```text
MembershipActivated
MembershipSubmitted (if sponsored)
```

**Actions**

* Award initial points
* Credit sponsor

---

# 6. Event Rules (Non-Negotiable)

1. ❌ No context queries another context’s database
2. ❌ No controller emits domain events
3. ✅ Only aggregate roots emit events
4. ✅ Events are immutable
5. ✅ Events are auditable forever

---

# 7. Why This Architecture Will Survive Reality

✔ Handles political disputes
✔ Supports legal audits
✔ Survives payment failures
✔ Allows future elections module
✔ Enables async processing
✔ Keeps tenant isolation intact

---

# 8. What You Should Do Next (Correct Order)

1. Lock this folder structure
2. Implement Membership aggregate
3. Implement events (no listeners yet)
4. Write tests for state transitions
5. Only then wire Financial / Forum listeners

---

If you want, next I can:

* Write **MembershipApplicationService**
* Define **Event Subscriber skeletons**
* Design **Committee Sponsorship rules**
* Create **tenant-safe migration strategy**

Say the word.
vBelow is the **canonical, production-grade `MembershipApplicationService`**, designed exactly for your:

* Laravel 12
* DDD + Hexagonal Architecture
* Event-driven, tenant-isolated SaaS
* Politically & legally sensitive domain

This is **not a controller** and **not a CRUD service**.
It is the **only entry point** into the Membership domain.

---

# 1. Role of MembershipApplicationService (Very Important)

> **This service orchestrates use-cases.
> It does NOT contain domain rules.**

### It:

* Accepts commands
* Loads aggregates
* Calls aggregate methods
* Persists aggregates
* Commits domain events

### It NEVER:

* Validates business rules directly
* Changes state itself
* Emits events manually
* Talks to other contexts directly

---

# 2. Location (Non-Negotiable)

```text
Contexts/Membership/Application/Services/MembershipApplicationService.php
```

---

# 3. Constructor Dependencies (Ports)

```php
final class MembershipApplicationService
{
    public function __construct(
        private readonly MembershipRepository $memberships,
        private readonly TransactionManager $tx
    ) {}
}
```

### Why?

* `MembershipRepository` → domain persistence port
* `TransactionManager` → atomic safety (DB + events)

---

# 4. Public Use-Cases (Command Handlers)

These are the **only allowed entry points**.

---

## 4.1 Submit Membership Application

```php
public function submit(SubmitMembershipCommand $command): void
{
    $this->tx->run(function () use ($command) {

        $membership = Membership::create(
            membershipId: MembershipId::new(),
            userId: $command->userId,
            personalProfile: $command->personalProfile,
            geography: $command->geographyAssignment,
            sponsorMembershipId: $command->sponsorMembershipId
        );

        $membership->submit();

        $this->memberships->save($membership);
    });
}
```

### Guarantees

* Membership created in `DRAFT`
* Transitioned to `SUBMITTED`
* `MembershipSubmitted` event emitted
* No verification yet

---

## 4.2 Verify Membership (Admin Action)

```php
public function verify(VerifyMembershipCommand $command): void
{
    $this->tx->run(function () use ($command) {

        $membership = $this->memberships->getById($command->membershipId);

        $membership->verify(
            verifiedByAdminId: $command->adminId
        );

        $this->memberships->save($membership);
    });
}
```

### Guarantees

* Only valid from `SUBMITTED`
* Emits `MembershipVerified`
* No activation yet

---

## 4.3 Activate Membership (System-Driven)

> ⚠️ **Controllers must NEVER call this directly**

This is triggered by:

* `DocumentVerified`
* `LevyPaid`

```php
public function activate(ActivateMembershipCommand $command): void
{
    $this->tx->run(function () use ($command) {

        $membership = $this->memberships->getById($command->membershipId);

        $membership->activate(
            membershipNumber: $command->membershipNumber
        );

        $this->memberships->save($membership);
    });
}
```

### Guarantees

* Verification + Levy already satisfied
* Emits `MembershipActivated`
* Downstream contexts may act

---

## 4.4 Suspend Membership

```php
public function suspend(SuspendMembershipCommand $command): void
{
    $this->tx->run(function () use ($command) {

        $membership = $this->memberships->getById($command->membershipId);

        $membership->suspend(
            reason: $command->reason
        );

        $this->memberships->save($membership);
    });
}
```

---

## 4.5 Terminate Membership (Irreversible)

```php
public function terminate(TerminateMembershipCommand $command): void
{
    $this->tx->run(function () use ($command) {

        $membership = $this->memberships->getById($command->membershipId);

        $membership->terminate(
            terminatedBy: $command->terminatedBy
        );

        $this->memberships->save($membership);
    });
}
```

---

# 5. Command Objects (Immutable DTOs)

Example: `SubmitMembershipCommand`

```php
final class SubmitMembershipCommand
{
    public function __construct(
        public readonly string $userId,
        public readonly PersonalProfile $personalProfile,
        public readonly GeographyAssignment $geographyAssignment,
        public readonly ?string $sponsorMembershipId
    ) {}
}
```

📌 Commands are:

* Immutable
* Serializable
* Test-friendly

---

# 6. Transaction Manager (Critical)

```php
interface TransactionManager
{
    public function run(callable $operation): void;
}
```

### Laravel Implementation

```php
final class LaravelTransactionManager implements TransactionManager
{
    public function run(callable $operation): void
    {
        DB::transaction(fn () => $operation());
    }
}
```

This guarantees:

* Aggregate save
* Event dispatch
* Atomic consistency

---

# 7. Repository Contract (Port)

```php
interface MembershipRepository
{
    public function save(Membership $membership): void;

    public function getById(string $membershipId): Membership;
}
```

Infrastructure implements it via Eloquent.

---

# 8. What This Service Protects You From

✔ Fat controllers
✔ Business logic leakage
✔ Cross-context coupling
✔ Inconsistent state
✔ Political/legal violations
✔ Untraceable side effects

---

# 9. Golden Rules (Pin These)

1. Controllers call **Application Services only**
2. Application Services call **Aggregates only**
3. Aggregates emit **Domain Events only**
4. Other contexts react via **Subscribers only**
5. No shortcuts — ever

---

# 10. What Comes Next (Natural Continuation)

The **next correct steps** are:

1. Event Subscriber examples (`OnLevyPaid`, `OnDocumentVerified`)
2. Admin Review Workflow
3. Committee Sponsorship rules
4. Tenant-safe migrations
5. Authorization policies derived from Membership

If you want, say **which one** and I’ll continue at the same depth.
