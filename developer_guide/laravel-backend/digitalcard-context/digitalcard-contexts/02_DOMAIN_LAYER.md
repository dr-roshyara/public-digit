# Domain Layer Guide - DigitalCard Context

**Version:** Phase 1.3
**Pattern:** Domain-Driven Design (DDD)
**Purity:** 100% Framework-Free

---

## Domain Layer Overview

The Domain layer is the **heart** of the DigitalCard Context. It contains **pure business logic** with **zero framework dependencies**.

**Location:** `app/Contexts/DigitalCard/Domain/`

**Contents:**
- Entities & Aggregates
- Value Objects
- Enums
- Domain Events
- Ports (interfaces)
- Domain Exceptions
- Repositories (interfaces)

**Golden Rule:** NO Laravel, NO database, NO HTTP dependencies.

---

## Aggregate Root: DigitalCard

**File:** `Domain/Entities/DigitalCard.php`

The `DigitalCard` aggregate root is the primary domain entity.

### Responsibilities

1. **Enforce business invariants**
2. **Encapsulate state transitions**
3. **Publish domain events**
4. **Protect business rules**

### Design Pattern

```php
final class DigitalCard
{
    // Private constructor - use named constructors
    private function __construct(
        private readonly CardId $cardId,
        private readonly MemberId $memberId,
        private readonly string $tenantId,
        private readonly QRCode $qrCode,
        private readonly DateTimeImmutable $issuedAt,
        private readonly DateTimeImmutable $expiresAt,
        private CardStatus $status = CardStatus::ISSUED,
        private ?DateTimeImmutable $activatedAt = null,
        private ?DateTimeImmutable $revokedAt = null,
        private ?string $revocationReason = null,
    ) {}
}
```

### Key Features

**1. Immutability**
- All properties `readonly` except mutable state (`status`, `activatedAt`, `revokedAt`)
- Private constructor prevents direct instantiation
- State changes only via business methods

**2. Named Constructors**
```php
// Factory method
public static function issue(
    CardId $cardId,
    MemberId $memberId,
    string $tenantId,
    QRCode $qrCode,
    DateTimeImmutable $issuedAt,
    DateTimeImmutable $expiresAt
): self
```

**3. Reconstitution (for Repositories)**
```php
// Internal method - used ONLY by repositories
public static function reconstitute(
    CardId $cardId,
    MemberId $memberId,
    string $tenantId,
    QRCode $qrCode,
    DateTimeImmutable $issuedAt,
    DateTimeImmutable $expiresAt,
    CardStatus $status,
    ?DateTimeImmutable $activatedAt = null,
    ?DateTimeImmutable $revokedAt = null,
    ?string $revocationReason = null
): self
```

### Business Methods

**Issue Card**
```php
$card = DigitalCard::issue(
    $cardId,
    $memberId,
    $tenantId,
    $qrCode,
    $issuedAt,
    $expiresAt
);
```

**Activate Card**
```php
$card->activate($activatedAt);
```

**Revoke Card**
```php
$card->revoke($reason, $revokedAt);
```

**Check Validity**
```php
$isValid = $card->isValidAt($someTime);
```

### Business Rules

The aggregate enforces these invariants:

1. **Expiry After Issue**
   ```php
   if ($expiresAt <= $issuedAt) {
       throw new InvalidArgumentException(
           'Card expiry date must be after issue date'
       );
   }
   ```

2. **Tenant Required**
   ```php
   if (empty($tenantId)) {
       throw new InvalidArgumentException('Tenant ID is required');
   }
   ```

3. **Only ISSUED cards can be activated**
   ```php
   if ($this->status !== CardStatus::ISSUED) {
       throw new DomainException(
           'Cannot activate card with status: ' . $this->status->value
       );
   }
   ```

4. **Cannot activate expired card**
   ```php
   if ($activatedAt >= $this->expiresAt) {
       throw new DomainException('Cannot activate expired card');
   }
   ```

5. **Only ISSUED or ACTIVE cards can be revoked**
   ```php
   $allowedStatuses = [CardStatus::ISSUED, CardStatus::ACTIVE];
   if (!in_array($this->status, $allowedStatuses, true)) {
       throw new DomainException('Cannot revoke card with status: ...');
   }
   ```

6. **Revocation reason required**
   ```php
   if (empty(trim($reason))) {
       throw new InvalidArgumentException('Revocation reason is required');
   }
   ```

### Domain Events

The aggregate records events internally:

```php
private array $domainEvents = [];

private function recordThat(object $event): void
{
    $this->domainEvents[] = $event;
}

public function releaseEvents(): array
{
    $events = $this->domainEvents;
    $this->domainEvents = [];
    return $events;
}
```

**Events are released by the repository after persistence:**

```php
// In EloquentDigitalCardRepository
public function save(DigitalCard $card): void
{
    // Persist...
    $model->save();

    // Release and publish events
    $events = $card->releaseEvents();
    foreach ($events as $event) {
        event($event);
    }
}
```

---

## Value Objects

Value Objects prevent **primitive obsession** and enforce **type safety**.

### 1. CardId

**File:** `Domain/ValueObjects/CardId.php`

**Purpose:** Type-safe card identifier

```php
readonly class CardId
{
    private string $value;

    // Factory: Generate new UUID
    public static function generate(): self

    // Factory: From string
    public static function fromString(string $value): self

    // Convert to string
    public function toString(): string

    // Equality
    public function equals(self $other): bool
}
```

**Features:**
- Self-validating (rejects invalid UUIDs)
- Immutable (`readonly`)
- No external dependencies (pure PHP UUID v4 generation)

**Usage:**
```php
// Generate new
$cardId = CardId::generate();

// From existing
$cardId = CardId::fromString('a3f2e7d8-9c4b-4d5f-8e6a-1b2c3d4e5f6g');

// Compare
if ($cardId->equals($otherCardId)) {
    // Same card
}
```

**UUID Generation (Framework-Free):**
```php
private static function generateUuidV4(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // Version 4
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // Variant RFC 4122
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
```

### 2. MemberId

**File:** `Domain/ValueObjects/MemberId.php`

**Purpose:** Type-safe member identifier

```php
readonly class MemberId
{
    private string $value;

    public static function fromString(string $value): self
    public function toString(): string
    public function equals(self $other): bool
}
```

**Usage:**
```php
$memberId = MemberId::fromString('M12345');
```

### 3. QRCode

**File:** `Domain/ValueObjects/QRCode.php`

**Purpose:** Type-safe QR code data

```php
readonly class QRCode
{
    private string $data;

    public static function fromString(string $data): self
    public function toString(): string
    public function toHash(): string  // SHA-256 hash for events
    public function equals(self $other): bool
}
```

**Features:**
- Stores base64 PNG data
- Provides hash for domain events
- No QR generation logic (that's in infrastructure)

**Usage:**
```php
$qrCode = QRCode::fromString($base64PngData);
$hash = $qrCode->toHash(); // For domain events
```

---

## Enums

### CardStatus

**File:** `Domain/Enums/CardStatus.php`

**Purpose:** Card lifecycle state machine

```php
enum CardStatus: string
{
    case ISSUED = 'issued';
    case ACTIVE = 'active';
    case REVOKED = 'revoked';
    case EXPIRED = 'expired';
    case SUSPENDED = 'suspended';
}
```

**Methods:**

```php
// Equality
$status->equals(CardStatus::ACTIVE)

// Valid transitions
$allowed = $status->allowedTransitions();
// ISSUED → [ACTIVE, REVOKED]
// ACTIVE → [REVOKED, EXPIRED, SUSPENDED]
// SUSPENDED → [ACTIVE, REVOKED]
// REVOKED → []
// EXPIRED → []

// Check transition
$status->canTransitionTo(CardStatus::ACTIVE)

// State checks
$status->isValid()      // true only for ACTIVE
$status->isTerminal()   // true for REVOKED or EXPIRED
$status->isUsable()     // true for ISSUED or ACTIVE
```

**State Machine Diagram:**

```
ISSUED ──activate()──> ACTIVE ──revoke()──> REVOKED
  │                      │                     (terminal)
  │                      │
  └──revoke()───────────┘
  │                      │
  │                      ├──expire()──> EXPIRED
  │                      │              (terminal)
  │                      │
  │                      └──suspend()──> SUSPENDED
  │                                        │
  └───────────────────────────────────────┘
                                           │
                                           └──activate()──> ACTIVE
```

---

## Domain Events

Domain events represent **facts** that have happened.

**Naming:** Past tense verbs (CardIssued, CardActivated, CardRevoked)

**Properties:** `readonly` for immutability

### 1. CardIssued

**File:** `Domain/Events/CardIssued.php`

```php
final readonly class CardIssued
{
    public function __construct(
        public string $cardId,
        public string $memberId,
        public string $tenantId,
        public DateTimeImmutable $issuedAt,
    ) {}
}
```

**Published When:** Card is issued via `DigitalCard::issue()`

### 2. CardActivated

**File:** `Domain/Events/CardActivated.php`

```php
final readonly class CardActivated
{
    public function __construct(
        public string $cardId,
        public string $tenantId,
        public DateTimeImmutable $activatedAt,
    ) {}
}
```

**Published When:** Card is activated via `$card->activate()`

### 3. CardRevoked

**File:** `Domain/Events/CardRevoked.php`

```php
final readonly class CardRevoked
{
    public function __construct(
        public string $cardId,
        public string $tenantId,
        public string $reason,
        public DateTimeImmutable $revokedAt,
    ) {}
}
```

**Published When:** Card is revoked via `$card->revoke()`

---

## Domain Exceptions

Explicit exceptions for domain violations.

**Rule:** Never use generic `\Exception` - always use specific domain exceptions.

### Exception Hierarchy

```
DomainException (built-in)
├── CardNotFoundException
├── CardAlreadyActivatedException
├── CardAlreadyRevokedException
├── CardRevokedException
├── SubscriptionRequiredException
└── QuotaExceededException

InvalidArgumentException (built-in)
└── (Used for input validation)
```

### Usage

```php
// Not found
throw new CardNotFoundException("Card not found for ID: {$cardId}");

// Business rule violation
throw new CardAlreadyActivatedException("Card already activated");

// Subscription issue
throw new SubscriptionRequiredException("No active subscription");

// Quota issue
throw new QuotaExceededException("Card limit reached (100/100)");
```

---

## Ports (Interfaces)

Ports define **what** the domain needs, not **how** it's implemented.

**Location:** `Domain/Ports/`

**Rule:** Domain depends on ports, infrastructure implements them.

### All 6 Ports

1. **ClockInterface** - Time operations
2. **IdGeneratorInterface** - UUID generation
3. **QRCodeGeneratorInterface** - QR code creation
4. **ModuleAccessInterface** - Subscription checks
5. **TenantContextInterface** - Multi-tenancy
6. **EventPublisherInterface** - Event dispatching

See [Ports & Adapters Guide](03_PORTS_AND_ADAPTERS.md) for full details.

---

## Repository Interface

**File:** `Domain/Repositories/DigitalCardRepositoryInterface.php`

```php
interface DigitalCardRepositoryInterface
{
    public function save(DigitalCard $card): void;

    public function findForTenant(CardId $cardId, string $tenantId): ?DigitalCard;

    public function findByMember(MemberId $memberId, string $tenantId): ?DigitalCard;
}
```

**Why an Interface?**
- Domain doesn't know about Eloquent
- Can swap implementations (in-memory, Redis, etc.)
- Easy testing with fakes

**Implementation:** `Infrastructure/Repositories/EloquentDigitalCardRepository`

---

## Domain Purity Checklist

Use this checklist to ensure domain purity:

✅ **Allowed:**
- Pure PHP classes
- Value Objects
- Enums (PHP 8.1+)
- Domain exceptions
- `DateTimeImmutable`
- Standard SPL interfaces

❌ **Forbidden:**
- `use Illuminate\...`
- `use Spatie\...`
- `use App\Models\...` (Eloquent)
- `DB::`, `Cache::`, `Log::`
- `request()`, `session()`, `auth()`
- Framework helpers

**Example - BAD:**
```php
// ❌ Domain layer with framework dependencies
class DigitalCard
{
    public function issue()
    {
        $this->id = Str::uuid();           // Laravel
        $this->issuedAt = Carbon::now();   // Laravel
        $this->tenantId = Tenant::current()->id; // Spatie
    }
}
```

**Example - GOOD:**
```php
// ✅ Pure domain logic
class DigitalCard
{
    public static function issue(
        CardId $cardId,
        MemberId $memberId,
        string $tenantId,
        QRCode $qrCode,
        DateTimeImmutable $issuedAt,
        DateTimeImmutable $expiresAt
    ): self {
        // Pure business logic
    }
}
```

---

## Testing Domain Logic

Domain layer is **100% unit testable** without Laravel.

```php
class DigitalCardTest extends TestCase
{
    public function test_issue_card_creates_valid_card(): void
    {
        $card = DigitalCard::issue(
            CardId::generate(),
            MemberId::fromString('M123'),
            'tenant-123',
            QRCode::fromString('qr-data'),
            new DateTimeImmutable('2025-01-01'),
            new DateTimeImmutable('2026-01-01'),
        );

        $this->assertEquals(CardStatus::ISSUED, $card->status());
    }

    public function test_cannot_activate_revoked_card(): void
    {
        $card = DigitalCard::issue(/* ... */);
        $card->revoke('Testing', new DateTimeImmutable());

        $this->expectException(DomainException::class);
        $card->activate(new DateTimeImmutable());
    }
}
```

**No database, no framework, just pure logic.**

---

## Design Patterns Used

1. **Aggregate Pattern** - DigitalCard is the aggregate root
2. **Value Object Pattern** - CardId, MemberId, QRCode
3. **Factory Method Pattern** - `DigitalCard::issue()`
4. **State Pattern** - CardStatus with transitions
5. **Event Sourcing Pattern** - Domain events recorded
6. **Repository Pattern** - Persistence abstraction

---

## Next Steps

- Read [Ports & Adapters](03_PORTS_AND_ADAPTERS.md) to understand infrastructure bindings
- Read [Application Layer](04_APPLICATION_LAYER.md) to see how handlers use the domain
- Read [Testing Guide](07_TESTING_GUIDE.md) for domain testing strategies
