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
- Application data is complete
- Documents may still be pending
- No rights granted

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
- Identity documents verified
- Geography confirmed
- Still no participation rights

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
- Levy paid
- Verification completed
- Full political rights granted
- Downstream contexts MAY act

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
- Rights revoked
- Read-only access may remain
- Forums / voting must block

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
- Irreversible
- No reactivation
- Historical records preserved

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
- Create forum identity
- Assign ward forums
- Revoke access

---

## 5.4 Leadership Score Context

**Subscribes to**
```text
MembershipActivated
MembershipSubmitted (if sponsored)
```

**Actions**
- Award initial points
- Credit sponsor

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
- Write **MembershipApplicationService**
- Define **Event Subscriber skeletons**
- Design **Committee Sponsorship rules**
- Create **tenant-safe migration strategy**

Say the word.