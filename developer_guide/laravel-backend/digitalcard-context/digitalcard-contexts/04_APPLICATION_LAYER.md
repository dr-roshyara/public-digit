# Application Layer - DigitalCard Context

**Version:** Phase 1.3
**Purpose:** Orchestrate use cases using domain logic
**Location:** `app/Contexts/DigitalCard/Application/`

---

## Application Layer Overview

The Application layer **orchestrates** domain logic to fulfill use cases.

**Responsibilities:**
- Accept commands from controllers
- Validate input
- Call domain methods
- Persist via repositories
- Publish events
- Return DTOs

**Does NOT contain business logic** (that's in Domain layer)

---

## Structure

```
Application/
├── Commands/
│   ├── IssueCardCommand.php
│   ├── ActivateCardCommand.php
│   └── RevokeCardCommand.php
│
├── Handlers/
│   ├── IssueCardHandler.php
│   ├── ActivateCardHandler.php
│   └── RevokeCardHandler.php
│
└── DTOs/
    └── CardDTO.php
```

---

## Commands

Commands are **immutable value objects** representing user intent.

### IssueCardCommand

```php
final readonly class IssueCardCommand
{
    public function __construct(
        public string $memberId,
        public string $fullName,
        public ?string $email = null,
        public ?string $phone = null,
        public ?string $photoUrl = null,
        public ?string $cardId = null,  // Optional: for custom IDs
    ) {}
}
```

**Usage:**
```php
$command = new IssueCardCommand(
    memberId: 'M12345',
    fullName: 'John Doe',
    email: 'john@example.com',
);
```

### ActivateCardCommand

```php
final readonly class ActivateCardCommand
{
    public function __construct(
        public string $cardId,
        public string $tenantId,
    ) {}
}
```

### RevokeCardCommand

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

---

## Handlers

Handlers implement the **Command Handler pattern**.

### IssueCardHandler

**File:** `Application/Handlers/IssueCardHandler.php`

**Full Implementation:**

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

    public function handle(IssueCardCommand $command): CardDTO
    {
        // 1. Verify tenant context
        $tenantId = $this->tenantContext->currentTenantId();
        if ($tenantId === null) {
            throw new \DomainException('Tenant context required');
        }

        // 2. Check subscription (Phase 1.3)
        $this->moduleAccess->ensureCanPerform($tenantId, 'cards.create');

        // 3. Check quota (Phase 1.3)
        $this->moduleAccess->ensureWithinQuota($tenantId);

        // 4. Generate card ID
        $cardId = $command->cardId
            ? CardId::fromString($command->cardId)
            : CardId::fromString($this->idGenerator->generate());

        // 5. Generate QR code
        $qrCodeData = $this->qrCodeGenerator->generate($cardId->toString());
        $qrCode = QRCode::fromString($qrCodeData);

        // 6. Get current time
        $issuedAt = $this->clock->now();

        // 7. Calculate expiry (1 year)
        $expiresAt = $issuedAt->modify('+1 year');

        // 8. Create domain aggregate
        $card = DigitalCard::issue(
            $cardId,
            MemberId::fromString($command->memberId),
            $tenantId,
            $qrCode,
            $issuedAt,
            $expiresAt
        );

        // 9. Persist
        $this->repository->save($card);

        // 10. Publish event
        $this->eventPublisher->publish(new CardIssued(
            cardId: $cardId->toString(),
            memberId: $command->memberId,
            tenantId: $tenantId,
            issuedAt: $issuedAt,
        ));

        // 11. Return DTO
        return CardDTO::fromDomainEntity($card);
    }
}
```

**Orchestration Steps:**

1. **Validate context** - Ensure tenant exists
2. **Check permissions** - Subscription & quota
3. **Generate identifiers** - Card ID, QR code
4. **Call domain** - `DigitalCard::issue()`
5. **Persist** - Save via repository
6. **Publish events** - Notify other contexts
7. **Return DTO** - Framework-friendly response

### ActivateCardHandler

**File:** `Application/Handlers/ActivateCardHandler.php`

```php
final class ActivateCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
        private readonly ClockInterface $clock,
        private readonly ModuleAccessInterface $moduleAccess,
        private readonly EventPublisherInterface $eventPublisher,
    ) {}

    public function handle(ActivateCardCommand $command): void
    {
        // 1. Check subscription
        $this->moduleAccess->ensureCanPerform($command->tenantId, 'cards.activate');

        // 2. Get card
        $card = $this->cardRepository->findForTenant(
            CardId::fromString($command->cardId),
            $command->tenantId
        );

        if ($card === null) {
            throw new CardNotFoundException("Card not found: {$command->cardId}");
        }

        // 3. Get current time
        $activatedAt = $this->clock->now();

        // 4. Execute domain logic
        $card->activate($activatedAt);

        // 5. Persist
        $this->cardRepository->save($card);

        // 6. Publish event
        $this->eventPublisher->publish(new CardActivated(
            cardId: $command->cardId,
            tenantId: $command->tenantId,
            activatedAt: $activatedAt,
        ));
    }
}
```

### RevokeCardHandler

**File:** `Application/Handlers/RevokeCardHandler.php`

```php
final class RevokeCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
        private readonly ClockInterface $clock,
        private readonly ModuleAccessInterface $moduleAccess,
        private readonly EventPublisherInterface $eventPublisher,
    ) {}

    public function handle(RevokeCardCommand $command): void
    {
        // 1. Check subscription
        $this->moduleAccess->ensureCanPerform($command->tenantId, 'cards.revoke');

        // 2. Get card
        $card = $this->cardRepository->findForTenant(
            CardId::fromString($command->cardId),
            $command->tenantId
        );

        if ($card === null) {
            throw new CardNotFoundException("Card not found: {$command->cardId}");
        }

        // 3. Get current time
        $revokedAt = $this->clock->now();

        // 4. Execute domain logic
        $card->revoke($command->reason, $revokedAt);

        // 5. Persist
        $this->cardRepository->save($card);

        // 6. Publish event
        $this->eventPublisher->publish(new CardRevoked(
            cardId: $command->cardId,
            tenantId: $command->tenantId,
            reason: $command->reason,
            revokedAt: $revokedAt,
        ));
    }
}
```

---

## DTOs (Data Transfer Objects)

DTOs convert domain entities to framework-friendly formats.

### CardDTO

**File:** `Application/DTOs/CardDTO.php`

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

    public static function fromDomainEntity(DigitalCard $card): self
    {
        return new self(
            cardId: $card->id()->toString(),
            memberId: $card->memberId()->toString(),
            tenantId: $card->tenantId(),
            fullName: $card->fullName(),
            email: $card->email(),
            phone: $card->phone(),
            photoUrl: $card->photoUrl(),
            qrCode: $card->qrCode()->toString(),
            status: $card->status()->value,
            issuedAt: $card->issuedAt(),
            expiresAt: $card->expiresAt(),
            activatedAt: $card->activatedAt(),
            revokedAt: $card->revokedAt(),
            revocationReason: $card->revocationReason(),
        );
    }

    public function toArray(): array
    {
        return [
            'card_id' => $this->cardId,
            'member_id' => $this->memberId,
            'tenant_id' => $this->tenantId,
            'full_name' => $this->fullName,
            'email' => $this->email,
            'phone' => $this->phone,
            'photo_url' => $this->photoUrl,
            'qr_code' => $this->qrCode,
            'status' => $this->status,
            'issued_at' => $this->issuedAt->format('Y-m-d H:i:s'),
            'expires_at' => $this->expiresAt->format('Y-m-d H:i:s'),
            'activated_at' => $this->activatedAt?->format('Y-m-d H:i:s'),
            'revoked_at' => $this->revokedAt?->format('Y-m-d H:i:s'),
            'revocation_reason' => $this->revocationReason,
        ];
    }
}
```

---

## Handler Dependency Injection

Laravel's container automatically injects dependencies:

```php
// In controller
public function __construct(
    private readonly IssueCardHandler $handler
) {}

// Laravel resolves:
// 1. IssueCardHandler
// 2. All 7 dependencies (repository + 6 ports)
// 3. Bindings from DigitalCardServiceProvider
```

---

## Error Handling

Handlers throw domain exceptions, controllers catch them:

```php
// In controller
try {
    $cardDTO = $this->issueHandler->handle($command);
    return response()->json(['success' => true, 'data' => $cardDTO]);

} catch (SubscriptionRequiredException $e) {
    return response()->json(['error' => $e->getMessage()], 403);

} catch (QuotaExceededException $e) {
    return response()->json(['error' => $e->getMessage()], 429);

} catch (CardNotFoundException $e) {
    return response()->json(['error' => $e->getMessage()], 404);
}
```

---

## Testing Handlers

```php
public function test_issue_card_handler(): void
{
    // Arrange
    $repository = new InMemoryDigitalCardRepository();
    $clock = new FakeClock();
    $idGen = new FakeIdGenerator();
    $qrGen = new FakeQRCodeGenerator();
    $moduleAccess = new FakeModuleAccess();
    $tenantContext = new FakeTenantContext();
    $eventPublisher = new FakeEventPublisher();

    $tenantContext->setTenantId('tenant-123');
    $moduleAccess->setHasSubscription(true);
    $moduleAccess->setWithinQuota(true);

    $handler = new IssueCardHandler(
        $repository,
        $clock,
        $idGen,
        $qrGen,
        $moduleAccess,
        $tenantContext,
        $eventPublisher,
    );

    $command = new IssueCardCommand(
        memberId: 'M123',
        fullName: 'John Doe',
    );

    // Act
    $cardDTO = $handler->handle($command);

    // Assert
    $this->assertEquals('M123', $cardDTO->memberId);
    $this->assertTrue($eventPublisher->wasPublished(CardIssued::class));
}
```

---

## Application Layer Rules

✅ **Allowed:**
- Call domain methods
- Use ports (interfaces)
- Validate input
- Orchestrate workflows
- Map to DTOs

❌ **Forbidden:**
- Business logic (belongs in Domain)
- Direct framework usage (use ports)
- Database queries (use repositories)
- HTTP requests (use ports)

---

## Next Steps

- Read [How to Use](05_HOW_TO_USE.md) for practical controller examples
- Read [Adding Features](06_ADDING_FEATURES.md) to create new handlers
- Read [Testing Guide](07_TESTING_GUIDE.md) for handler testing strategies
