# API Reference - DigitalCard Context

**Version:** Phase 1.3
**Last Updated:** December 27, 2025

---

## Domain Entities

### DigitalCard (Aggregate Root)

**Namespace:** `App\Contexts\DigitalCard\Domain\Entities\DigitalCard`

#### Factory Methods

```php
public static function issue(
    CardId $cardId,
    MemberId $memberId,
    string $tenantId,
    QRCode $qrCode,
    DateTimeImmutable $issuedAt,
    DateTimeImmutable $expiresAt
): self
```

**Description:** Create a new digital card

**Throws:**
- `InvalidArgumentException` - If expiry before issue date
- `InvalidArgumentException` - If tenant ID empty

**Events:** `CardIssued`

---

```php
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

**Description:** Reconstitute card from persistence (repository use only)

**Note:** Does not record events

#### Business Methods

```php
public function activate(DateTimeImmutable $activatedAt): void
```

**Description:** Activate an issued card

**Throws:**
- `DomainException` - If card not in ISSUED status
- `DomainException` - If card already expired

**Events:** `CardActivated`

---

```php
public function revoke(string $reason, DateTimeImmutable $revokedAt): void
```

**Description:** Revoke an active or issued card

**Throws:**
- `DomainException` - If card not in ISSUED or ACTIVE status
- `InvalidArgumentException` - If reason empty

**Events:** `CardRevoked`

---

```php
public function isValidAt(DateTimeImmutable $atTime): bool
```

**Description:** Check if card is valid at given time

**Returns:** `true` if card is ACTIVE and within validity period

#### Getters

```php
public function id(): CardId
public function memberId(): MemberId
public function tenantId(): string
public function qrCode(): QRCode
public function status(): CardStatus
public function issuedAt(): DateTimeImmutable
public function expiresAt(): DateTimeImmutable
public function activatedAt(): ?DateTimeImmutable
public function revokedAt(): ?DateTimeImmutable
public function revocationReason(): ?string
```

#### Event Methods

```php
public function releaseEvents(): array<object>
```

**Description:** Release and clear recorded domain events

---

## Value Objects

### CardId

**Namespace:** `App\Contexts\DigitalCard\Domain\ValueObjects\CardId`

```php
public static function generate(): self
public static function fromString(string $value): self
public function toString(): string
public function equals(self $other): bool
public function __toString(): string
```

**Validation:** Must be valid UUID v4 format

---

### MemberId

**Namespace:** `App\Contexts\DigitalCard\Domain\ValueObjects\MemberId`

```php
public static function fromString(string $value): self
public function toString(): string
public function equals(self $other): bool
```

---

### QRCode

**Namespace:** `App\Contexts\DigitalCard\Domain\ValueObjects\QRCode`

```php
public static function fromString(string $data): self
public function toString(): string
public function toHash(): string
public function equals(self $other): bool
```

**Data Format:** Base64-encoded PNG/SVG

---

## Enums

### CardStatus

**Namespace:** `App\Contexts\DigitalCard\Domain\Enums\CardStatus`

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
public function equals(self $other): bool
public function allowedTransitions(): array<self>
public function canTransitionTo(self $target): bool
public function isValid(): bool
public function isTerminal(): bool
public function isUsable(): bool
```

**State Transitions:**

```
ISSUED → [ACTIVE, REVOKED]
ACTIVE → [REVOKED, EXPIRED, SUSPENDED]
SUSPENDED → [ACTIVE, REVOKED]
REVOKED → []
EXPIRED → []
```

---

## Domain Events

### CardIssued

**Namespace:** `App\Contexts\DigitalCard\Domain\Events\CardIssued`

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

---

### CardActivated

**Namespace:** `App\Contexts\DigitalCard\Domain\Events\CardActivated`

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

---

### CardRevoked

**Namespace:** `App\Contexts\DigitalCard\Domain\Events\CardRevoked`

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

---

## Domain Ports (Interfaces)

### Port 1: ClockInterface

**Namespace:** `App\Contexts\DigitalCard\Domain\Ports\ClockInterface`

```php
interface ClockInterface
{
    public function now(): DateTimeImmutable;
}
```

**Purpose:** Time abstraction

**Implementations:**
- `LaravelClock` (real)
- `FakeClock` (testing)

---

### Port 2: IdGeneratorInterface

**Namespace:** `App\Contexts\DigitalCard\Domain\Ports\IdGeneratorInterface`

```php
interface IdGeneratorInterface
{
    public function generate(): string;
}
```

**Purpose:** UUID generation

**Returns:** UUID v4 string

**Implementations:**
- `LaravelIdGenerator` (real)
- `FakeIdGenerator` (testing)

---

### Port 3: QRCodeGeneratorInterface

**Namespace:** `App\Contexts\DigitalCard\Domain\Ports\QRCodeGeneratorInterface`

```php
interface QRCodeGeneratorInterface
{
    public function generate(string $data): string;
}
```

**Purpose:** QR code generation

**Returns:** Base64-encoded PNG/SVG data

**Implementations:**
- `LaravelQRCodeGenerator` (real)
- `FakeQRCodeGenerator` (testing)

---

### Port 4: ModuleAccessInterface

**Namespace:** `App\Contexts\DigitalCard\Domain\Ports\ModuleAccessInterface`

```php
interface ModuleAccessInterface
{
    /**
     * @throws SubscriptionRequiredException
     */
    public function ensureCanPerform(string $tenantId, string $action): void;

    public function canPerform(string $tenantId, string $action): bool;

    /**
     * @return array{used: int, limit: int, remaining: int}
     */
    public function getQuota(string $tenantId): array;

    /**
     * @throws QuotaExceededException
     */
    public function ensureWithinQuota(string $tenantId): void;
}
```

**Purpose:** ModuleRegistry integration (Phase 1.3)

**Actions:**
- `cards.create`
- `cards.activate`
- `cards.revoke`

**Implementations:**
- `ModuleRegistryAdapter` (real)
- `FakeModuleAccess` (testing)

---

### Port 5: TenantContextInterface

**Namespace:** `App\Contexts\DigitalCard\Domain\Ports\TenantContextInterface`

```php
interface TenantContextInterface
{
    public function currentTenantId(): ?string;
    public function hasTenant(): bool;
    public function getTenantProperty(string $key): mixed;
}
```

**Purpose:** Multi-tenancy abstraction

**Implementations:**
- `SpatieTenantContextAdapter` (real)
- `FakeTenantContext` (testing)

---

### Port 6: EventPublisherInterface

**Namespace:** `App\Contexts\DigitalCard\Domain\Ports\EventPublisherInterface`

```php
interface EventPublisherInterface
{
    public function publish(object $event): void;
}
```

**Purpose:** Event dispatching abstraction

**Implementations:**
- `LaravelEventPublisher` (real)
- `FakeEventPublisher` (testing)

---

## Repository Interface

### DigitalCardRepositoryInterface

**Namespace:** `App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepositoryInterface`

```php
interface DigitalCardRepositoryInterface
{
    public function save(DigitalCard $card): void;

    public function findForTenant(
        CardId $cardId,
        string $tenantId
    ): ?DigitalCard;

    public function findByMember(
        MemberId $memberId,
        string $tenantId
    ): ?DigitalCard;
}
```

**Implementation:** `EloquentDigitalCardRepository`

---

## Application Commands

### IssueCardCommand

**Namespace:** `App\Contexts\DigitalCard\Application\Commands\IssueCardCommand`

```php
final readonly class IssueCardCommand
{
    public function __construct(
        public string $memberId,
        public string $fullName,
        public ?string $email = null,
        public ?string $phone = null,
        public ?string $photoUrl = null,
        public ?string $cardId = null,
    ) {}
}
```

**Handler:** `IssueCardHandler`

---

### ActivateCardCommand

**Namespace:** `App\Contexts\DigitalCard\Application\Commands\ActivateCardCommand`

```php
final readonly class ActivateCardCommand
{
    public function __construct(
        public string $cardId,
        public string $tenantId,
    ) {}
}
```

**Handler:** `ActivateCardHandler`

---

### RevokeCardCommand

**Namespace:** `App\Contexts\DigitalCard\Application\Commands\RevokeCardCommand`

```php
final readonly class RevokeCardCommand
{
    public function __construct(
        public string $cardId,
        public string $tenantId,
        public string $reason,
    ) {}
}
```

**Handler:** `RevokeCardHandler`

---

## Application Handlers

### IssueCardHandler

**Namespace:** `App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler`

```php
final readonly class IssueCardHandler
{
    public function __construct(
        private DigitalCardRepositoryInterface $repository,
        private ClockInterface $clock,
        private IdGeneratorInterface $idGenerator,
        private QRCodeGeneratorInterface $qrCodeGenerator,
        private ModuleAccessInterface $moduleAccess,
        private TenantContextInterface $tenantContext,
        private EventPublisherInterface $eventPublisher,
    ) {}

    public function handle(IssueCardCommand $command): CardDTO;
}
```

**Throws:**
- `DomainException` - If no tenant context
- `SubscriptionRequiredException` - If no subscription
- `QuotaExceededException` - If quota exceeded

**Returns:** `CardDTO`

**Events:** `CardIssued`

---

### ActivateCardHandler

**Namespace:** `App\Contexts\DigitalCard\Application\Handlers\ActivateCardHandler`

```php
final class ActivateCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
        private readonly ClockInterface $clock,
        private readonly ModuleAccessInterface $moduleAccess,
        private readonly EventPublisherInterface $eventPublisher,
    ) {}

    public function handle(ActivateCardCommand $command): void;
}
```

**Throws:**
- `CardNotFoundException` - If card not found
- `DomainException` - If card cannot be activated
- `SubscriptionRequiredException` - If no subscription

**Events:** `CardActivated`

---

### RevokeCardHandler

**Namespace:** `App\Contexts\DigitalCard\Application\Handlers\RevokeCardHandler`

```php
final class RevokeCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
        private readonly ClockInterface $clock,
        private readonly ModuleAccessInterface $moduleAccess,
        private readonly EventPublisherInterface $eventPublisher,
    ) {}

    public function handle(RevokeCardCommand $command): void;
}
```

**Throws:**
- `CardNotFoundException` - If card not found
- `DomainException` - If card cannot be revoked
- `SubscriptionRequiredException` - If no subscription

**Events:** `CardRevoked`

---

## Application DTOs

### CardDTO

**Namespace:** `App\Contexts\DigitalCard\Application\DTOs\CardDTO`

```php
final readonly class CardDTO
{
    public function __construct(
        public string $cardId,
        public string $memberId,
        public string $tenantId,
        public string $fullName,
        public ?string $email,
        public ?string $phone,
        public ?string $photoUrl,
        public string $qrCode,
        public string $status,
        public DateTimeImmutable $issuedAt,
        public DateTimeImmutable $expiresAt,
        public ?DateTimeImmutable $activatedAt,
        public ?DateTimeImmutable $revokedAt,
        public ?string $revocationReason,
    ) {}

    public static function fromDomainEntity(DigitalCard $card): self;
    public function toArray(): array;
}
```

---

## Domain Exceptions

### SubscriptionRequiredException

**Namespace:** `App\Contexts\DigitalCard\Domain\Exceptions\SubscriptionRequiredException`

```php
class SubscriptionRequiredException extends DomainException
{
    public static function withMessage(string $message): self;
}
```

---

### QuotaExceededException

**Namespace:** `App\Contexts\DigitalCard\Domain\Exceptions\QuotaExceededException`

```php
class QuotaExceededException extends DomainException
{
    public static function withMessage(string $message): self;
}
```

---

### CardNotFoundException

**Namespace:** `App\Contexts\DigitalCard\Domain\Exceptions\CardNotFoundException`

```php
class CardNotFoundException extends DomainException
{
    // Standard DomainException usage
}
```

---

## Configuration

### services.php

```php
'module_registry' => [
    'url' => env('MODULE_REGISTRY_URL', 'http://module-registry.test'),
],
```

---

## Environment Variables

```env
MODULE_REGISTRY_URL=http://module-registry.test
```

---

## HTTP Endpoints (Example)

### POST /api/digital-cards

**Request:**
```json
{
  "member_id": "M12345",
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "photo_url": "https://example.com/photo.jpg"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "card_id": "uuid",
    "member_id": "M12345",
    "tenant_id": "tenant-123",
    "qr_code": "base64-data",
    "status": "issued",
    "issued_at": "2025-12-27 10:00:00"
  }
}
```

---

### POST /api/digital-cards/{cardId}/activate

**Response (200):**
```json
{
  "success": true,
  "message": "Card activated successfully"
}
```

---

### POST /api/digital-cards/{cardId}/revoke

**Request:**
```json
{
  "reason": "Member left organization"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Card revoked successfully"
}
```

---

## Testing Fakes

All fakes located in: `Infrastructure/Testing/`

- `FakeClock`
- `FakeIdGenerator`
- `FakeQRCodeGenerator`
- `FakeModuleAccess`
- `FakeTenantContext`
- `FakeEventPublisher`

See [Testing Guide](07_TESTING_GUIDE.md) for usage examples.

---

## Version History

- **Phase 1.3** - ModuleRegistry integration, all 6 ports complete
- **Phase 1.2** - Event publishing, repository pattern
- **Phase 1.1** - Activate/Revoke operations
- **Phase 1.0** - Issue card (walking skeleton)

---

## Support

For questions or issues:
- Read [Debugging Guide](08_DEBUGGING_GUIDE.md)
- Contact Senior Development Team
