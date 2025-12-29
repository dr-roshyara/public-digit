# Adding New Features - DigitalCard Context

**Version:** Phase 1.3
**Approach:** Test-Driven Development (TDD)
**Architecture:** Hexagonal (Ports & Adapters)

---

## TDD Workflow (MANDATORY)

**Rule:** Tests FIRST, implementation SECOND.

```
RED → GREEN → REFACTOR
```

1. **RED** - Write failing test
2. **GREEN** - Make test pass (minimal code)
3. **REFACTOR** - Clean up code

---

## Step-by-Step Guide: Adding "Renew Card" Feature

Let's add a new feature to renew expired cards.

### Step 1: Write Domain Test (RED)

**File:** `tests/Unit/Contexts/DigitalCard/Domain/Entities/DigitalCardRenewTest.php`

```php
<?php

namespace Tests\Unit\Contexts\DigitalCard\Domain\Entities;

use PHPUnit\Framework\TestCase;
use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;
use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;
use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;
use App\Contexts\DigitalCard\Domain\Enums\CardStatus;
use DateTimeImmutable;

class DigitalCardRenewTest extends TestCase
{
    public function test_can_renew_expired_card(): void
    {
        // Arrange
        $card = DigitalCard::issue(
            CardId::generate(),
            MemberId::fromString('M123'),
            'tenant-123',
            QRCode::fromString('qr-data'),
            new DateTimeImmutable('2024-01-01'),
            new DateTimeImmutable('2025-01-01'),
        );

        // Make card expired
        $renewedAt = new DateTimeImmutable('2025-06-01');
        $newExpiresAt = new DateTimeImmutable('2026-06-01');

        // Act
        $card->renew($renewedAt, $newExpiresAt);

        // Assert
        $this->assertEquals(CardStatus::ACTIVE, $card->status());
        $this->assertEquals($newExpiresAt, $card->expiresAt());
    }

    public function test_cannot_renew_active_card(): void
    {
        // Arrange
        $card = DigitalCard::issue(/* ... */);
        $card->activate(new DateTimeImmutable('2024-06-01'));

        // Act & Assert
        $this->expectException(\DomainException::class);
        $card->renew(new DateTimeImmutable(), new DateTimeImmutable());
    }
}
```

**Run Test (should FAIL):**

```bash
php artisan test --filter=DigitalCardRenewTest
```

### Step 2: Implement Domain Method (GREEN)

**File:** `app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php`

Add method to aggregate:

```php
/**
 * BUSINESS METHOD: Renew an expired card
 */
public function renew(DateTimeImmutable $renewedAt, DateTimeImmutable $newExpiresAt): void
{
    // Business Rule: Only expired or issued cards can be renewed
    $allowedStatuses = [CardStatus::EXPIRED, CardStatus::ISSUED];
    if (!in_array($this->status, $allowedStatuses, true)) {
        throw new \DomainException(
            sprintf('Cannot renew card with status: %s', $this->status->value)
        );
    }

    // Business Rule: New expiry must be after renewal date
    if ($newExpiresAt <= $renewedAt) {
        throw new \InvalidArgumentException('Expiry must be after renewal date');
    }

    // Update state
    $this->status = CardStatus::ACTIVE;
    $this->expiresAt = $newExpiresAt;
    $this->activatedAt = $renewedAt;

    // Record event
    $this->recordThat(new CardRenewed(
        cardId: $this->cardId->toString(),
        tenantId: $this->tenantId,
        renewedAt: $renewedAt,
        newExpiresAt: $newExpiresAt,
    ));
}
```

**Run Test (should PASS):**

```bash
php artisan test --filter=DigitalCardRenewTest
```

### Step 3: Create Domain Event

**File:** `app/Contexts/DigitalCard/Domain/Events/CardRenewed.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Events;

use DateTimeImmutable;

final readonly class CardRenewed
{
    public function __construct(
        public string $cardId,
        public string $tenantId,
        public DateTimeImmutable $renewedAt,
        public DateTimeImmutable $newExpiresAt,
    ) {}
}
```

### Step 4: Create Command

**File:** `app/Contexts/DigitalCard/Application/Commands/RenewCardCommand.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Commands;

final readonly class RenewCardCommand
{
    public function __construct(
        public string $cardId,
        public string $tenantId,
    ) {}
}
```

### Step 5: Write Handler Test (RED)

**File:** `tests/Unit/Contexts/DigitalCard/Application/Handlers/RenewCardHandlerTest.php`

```php
<?php

namespace Tests\Unit\Contexts\DigitalCard\Application\Handlers;

use PHPUnit\Framework\TestCase;
use App\Contexts\DigitalCard\Application\Handlers\RenewCardHandler;
use App\Contexts\DigitalCard\Application\Commands\RenewCardCommand;
use App\Contexts\DigitalCard\Infrastructure\Testing\*;

class RenewCardHandlerTest extends TestCase
{
    public function test_renew_card_handler(): void
    {
        // Arrange
        $repository = new InMemoryDigitalCardRepository();
        $clock = new FakeClock();
        $moduleAccess = new FakeModuleAccess();
        $eventPublisher = new FakeEventPublisher();

        $moduleAccess->setHasSubscription(true);

        $handler = new RenewCardHandler(
            $repository,
            $clock,
            $moduleAccess,
            $eventPublisher,
        );

        $command = new RenewCardCommand(
            cardId: 'card-123',
            tenantId: 'tenant-123',
        );

        // Act
        $handler->handle($command);

        // Assert
        $this->assertTrue($eventPublisher->wasPublished(CardRenewed::class));
    }
}
```

### Step 6: Implement Handler (GREEN)

**File:** `app/Contexts/DigitalCard/Application/Handlers/RenewCardHandler.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\RenewCardCommand;
use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepositoryInterface;
use App\Contexts\DigitalCard\Domain\Ports\ClockInterface;
use App\Contexts\DigitalCard\Domain\Ports\ModuleAccessInterface;
use App\Contexts\DigitalCard\Domain\Ports\EventPublisherInterface;
use App\Contexts\DigitalCard\Domain\Events\CardRenewed;
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

final class RenewCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
        private readonly ClockInterface $clock,
        private readonly ModuleAccessInterface $moduleAccess,
        private readonly EventPublisherInterface $eventPublisher,
    ) {}

    public function handle(RenewCardCommand $command): void
    {
        // 1. Check subscription
        $this->moduleAccess->ensureCanPerform($command->tenantId, 'cards.renew');

        // 2. Get card
        $card = $this->cardRepository->findForTenant(
            CardId::fromString($command->cardId),
            $command->tenantId
        );

        if ($card === null) {
            throw new \DomainException("Card not found");
        }

        // 3. Get current time
        $renewedAt = $this->clock->now();

        // 4. Calculate new expiry
        $newExpiresAt = $renewedAt->modify('+1 year');

        // 5. Execute domain logic
        $card->renew($renewedAt, $newExpiresAt);

        // 6. Persist
        $this->cardRepository->save($card);

        // 7. Publish event
        $this->eventPublisher->publish(new CardRenewed(
            cardId: $command->cardId,
            tenantId: $command->tenantId,
            renewedAt: $renewedAt,
            newExpiresAt: $newExpiresAt,
        ));
    }
}
```

### Step 7: Create Controller Endpoint

**File:** `app/Http/Controllers/Tenant/DigitalCardController.php`

Add method:

```php
public function renew(string $cardId, RenewCardHandler $handler): JsonResponse
{
    $command = new RenewCardCommand(
        cardId: $cardId,
        tenantId: tenant()->id,
    );

    try {
        $handler->handle($command);

        return response()->json([
            'success' => true,
            'message' => 'Card renewed successfully',
        ]);

    } catch (\DomainException $e) {
        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
        ], 400);
    }
}
```

### Step 8: Add Route

**File:** `routes/tenant.php`

```php
Route::post('/digital-cards/{cardId}/renew', [DigitalCardController::class, 'renew'])
    ->name('digital-cards.renew');
```

### Step 9: Test Integration (Optional)

**File:** `tests/Feature/DigitalCard/RenewCardTest.php`

```php
public function test_can_renew_expired_card_via_api(): void
{
    // Arrange
    $tenant = Tenant::factory()->create();
    $tenant->makeCurrent();

    // Create expired card
    $card = /* create expired card */;

    // Act
    $response = $this->postJson("/digital-cards/{$card->id}/renew");

    // Assert
    $response->assertStatus(200);
    $response->assertJson(['success' => true]);
}
```

---

## Adding a New Port

If your feature needs external service communication:

### Example: Email Notification Port

**Step 1: Define Port (Domain)**

```php
// Domain/Ports/EmailNotificationInterface.php
interface EmailNotificationInterface
{
    public function sendCardIssued(string $email, CardDTO $card): void;
}
```

**Step 2: Create Real Adapter (Infrastructure)**

```php
// Infrastructure/Adapters/LaravelMailAdapter.php
final class LaravelMailAdapter implements EmailNotificationInterface
{
    public function sendCardIssued(string $email, CardDTO $card): void
    {
        Mail::to($email)->send(new CardIssuedMail($card));
    }
}
```

**Step 3: Create Fake (Infrastructure)**

```php
// Infrastructure/Testing/FakeEmailNotification.php
final class FakeEmailNotification implements EmailNotificationInterface
{
    private array $sentEmails = [];

    public function sendCardIssued(string $email, CardDTO $card): void
    {
        $this->sentEmails[] = ['email' => $email, 'card' => $card];
    }

    public function wasSentTo(string $email): bool
    {
        foreach ($this->sentEmails as $sent) {
            if ($sent['email'] === $email) {
                return true;
            }
        }
        return false;
    }
}
```

**Step 4: Bind in ServiceProvider**

```php
// app/Providers/DigitalCardServiceProvider.php
$this->app->bind(EmailNotificationInterface::class, LaravelMailAdapter::class);
```

**Step 5: Use in Handler**

```php
final class IssueCardHandler
{
    public function __construct(
        // ... other ports
        private EmailNotificationInterface $emailNotification,
    ) {}

    public function handle(IssueCardCommand $command): CardDTO
    {
        // ... issue card logic

        if ($command->email) {
            $this->emailNotification->sendCardIssued($command->email, $cardDTO);
        }

        return $cardDTO;
    }
}
```

---

## Design Checklist

Before implementing a feature, ask:

1. ✅ **Is this business logic?** → Domain layer
2. ✅ **Does it need external service?** → Create port
3. ✅ **Is it orchestration?** → Application layer (handler)
4. ✅ **Does it need data formatting?** → Create DTO
5. ✅ **Tests first?** → Always TDD

---

## Common Patterns

### Pattern 1: Add Validation Rule

**Domain:**
```php
// In DigitalCard aggregate
if (empty($newData)) {
    throw new \InvalidArgumentException('Data required');
}
```

### Pattern 2: Add State Transition

**Domain:**
```php
// In CardStatus enum
public function allowedTransitions(): array
{
    return match ($this) {
        self::ACTIVE => [self::SUSPENDED, self::REVOKED],
        // Add new transitions
    };
}
```

### Pattern 3: Add Query Method

**Repository:**
```php
// In DigitalCardRepositoryInterface
public function findExpiredCards(string $tenantId): array;
```

---

## Testing New Features

```bash
# Run domain tests
php artisan test --testsuite=Unit

# Run handler tests
php artisan test --filter=Handlers

# Run integration tests
php artisan test --testsuite=Feature

# Check coverage
php artisan test --coverage --min=80
```

---

## Next Steps

- Read [Testing Guide](07_TESTING_GUIDE.md) for comprehensive testing strategies
- Read [Domain Layer](02_DOMAIN_LAYER.md) for domain patterns
- Read [Ports & Adapters](03_PORTS_AND_ADAPTERS.md) for creating ports
