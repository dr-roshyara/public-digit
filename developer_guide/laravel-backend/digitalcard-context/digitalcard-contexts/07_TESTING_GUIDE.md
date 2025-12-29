# Testing Guide - DigitalCard Context

**Version:** Phase 1.3
**Approach:** Test-Driven Development (TDD)
**Coverage Target:** ≥ 80%

---

## Testing Philosophy

**Tests First, Code Second**

```
1. Write test → FAIL (RED)
2. Write code → PASS (GREEN)
3. Refactor → STILL PASS
```

---

## Test Pyramid

```
      ┌──────────┐
      │    E2E   │ (Few - slow, expensive)
      ├──────────┤
      │Integration│ (Some - medium speed)
      ├──────────┤
      │   Unit    │ (Many - fast, cheap)
      └──────────┘
```

**Distribution:**
- 70% Unit tests (domain, handlers)
- 20% Integration tests (full stack)
- 10% E2E tests (API endpoints)

---

## Unit Testing (Domain Layer)

### Testing Aggregates

**File:** `tests/Unit/Contexts/DigitalCard/Domain/Entities/DigitalCardTest.php`

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

class DigitalCardTest extends TestCase
{
    public function test_can_issue_new_card(): void
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
        $this->assertInstanceOf(DateTimeImmutable::class, $card->issuedAt());
    }

    public function test_cannot_issue_card_with_past_expiry(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('expiry date must be after issue date');

        DigitalCard::issue(
            CardId::generate(),
            MemberId::fromString('M123'),
            'tenant-123',
            QRCode::fromString('qr-data'),
            new DateTimeImmutable('2026-01-01'),
            new DateTimeImmutable('2025-01-01'), // Past!
        );
    }

    public function test_can_activate_issued_card(): void
    {
        $card = DigitalCard::issue(/* ... */);
        $card->activate(new DateTimeImmutable('2025-06-01'));

        $this->assertEquals(CardStatus::ACTIVE, $card->status());
        $this->assertNotNull($card->activatedAt());
    }

    public function test_cannot_activate_already_active_card(): void
    {
        $card = DigitalCard::issue(/* ... */);
        $card->activate(new DateTimeImmutable('2025-06-01'));

        $this->expectException(\DomainException::class);
        $card->activate(new DateTimeImmutable('2025-07-01'));
    }

    public function test_can_revoke_active_card(): void
    {
        $card = DigitalCard::issue(/* ... */);
        $card->activate(new DateTimeImmutable('2025-06-01'));
        $card->revoke('Lost card', new DateTimeImmutable('2025-07-01'));

        $this->assertEquals(CardStatus::REVOKED, $card->status());
        $this->assertEquals('Lost card', $card->revocationReason());
    }
}
```

**Run:**
```bash
php artisan test --filter=DigitalCardTest
```

### Testing Value Objects

**File:** `tests/Unit/Contexts/DigitalCard/Domain/ValueObjects/CardIdTest.php`

```php
public function test_generates_valid_uuid(): void
{
    $cardId = CardId::generate();
    $uuid = $cardId->toString();

    $this->assertMatchesRegularExpression(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
        $uuid
    );
}

public function test_rejects_invalid_uuid(): void
{
    $this->expectException(\InvalidArgumentException::class);
    CardId::fromString('not-a-uuid');
}

public function test_equality_works(): void
{
    $id1 = CardId::fromString('a3f2e7d8-9c4b-4d5f-8e6a-1b2c3d4e5f6g');
    $id2 = CardId::fromString('a3f2e7d8-9c4b-4d5f-8e6a-1b2c3d4e5f6g');
    $id3 = CardId::generate();

    $this->assertTrue($id1->equals($id2));
    $this->assertFalse($id1->equals($id3));
}
```

---

## Unit Testing (Application Layer)

### Testing Handlers with Fakes

**File:** `tests/Unit/Contexts/DigitalCard/Application/Handlers/IssueCardHandlerTest.php`

```php
<?php

namespace Tests\Unit\Contexts\DigitalCard\Application\Handlers;

use PHPUnit\Framework\TestCase;
use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;
use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use App\Contexts\DigitalCard\Infrastructure\Testing\*;
use DateTimeImmutable;

class IssueCardHandlerTest extends TestCase
{
    private FakeClock $clock;
    private FakeIdGenerator $idGenerator;
    private FakeQRCodeGenerator $qrGenerator;
    private FakeModuleAccess $moduleAccess;
    private FakeTenantContext $tenantContext;
    private FakeEventPublisher $eventPublisher;
    private InMemoryDigitalCardRepository $repository;
    private IssueCardHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->clock = new FakeClock(new DateTimeImmutable('2025-01-01'));
        $this->idGenerator = new FakeIdGenerator();
        $this->qrGenerator = new FakeQRCodeGenerator();
        $this->moduleAccess = new FakeModuleAccess();
        $this->tenantContext = new FakeTenantContext();
        $this->eventPublisher = new FakeEventPublisher();
        $this->repository = new InMemoryDigitalCardRepository();

        $this->tenantContext->setTenantId('tenant-123');
        $this->moduleAccess->setHasSubscription(true);
        $this->moduleAccess->setWithinQuota(true);

        $this->handler = new IssueCardHandler(
            $this->repository,
            $this->clock,
            $this->idGenerator,
            $this->qrGenerator,
            $this->moduleAccess,
            $this->tenantContext,
            $this->eventPublisher,
        );
    }

    public function test_issues_card_successfully(): void
    {
        $command = new IssueCardCommand(
            memberId: 'M12345',
            fullName: 'John Doe',
        );

        $cardDTO = $this->handler->handle($command);

        $this->assertEquals('M12345', $cardDTO->memberId);
        $this->assertEquals('tenant-123', $cardDTO->tenantId);
        $this->assertTrue($this->eventPublisher->wasPublished(CardIssued::class));
    }

    public function test_checks_subscription_before_issuing(): void
    {
        $this->moduleAccess->setHasSubscription(false);

        $command = new IssueCardCommand(
            memberId: 'M12345',
            fullName: 'John Doe',
        );

        $this->expectException(SubscriptionRequiredException::class);
        $this->handler->handle($command);
    }

    public function test_checks_quota_before_issuing(): void
    {
        $this->moduleAccess->setWithinQuota(false);

        $command = new IssueCardCommand(
            memberId: 'M12345',
            fullName: 'John Doe',
        );

        $this->expectException(QuotaExceededException::class);
        $this->handler->handle($command);
    }

    public function test_requires_tenant_context(): void
    {
        $this->tenantContext->setTenantId(null);

        $command = new IssueCardCommand(
            memberId: 'M12345',
            fullName: 'John Doe',
        );

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('Tenant context required');
        $this->handler->handle($command);
    }
}
```

**Run:**
```bash
php artisan test --filter=IssueCardHandlerTest
```

---

## Integration Testing

### Testing Full Stack with Database

**File:** `tests/Feature/DigitalCard/IssueCardTest.php`

```php
<?php

namespace Tests\Feature\DigitalCard;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\Tenant;

class IssueCardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create and set tenant
        $tenant = Tenant::factory()->create(['id' => 1, 'name' => 'Test Org']);
        $tenant->makeCurrent();
    }

    public function test_can_issue_card_via_api(): void
    {
        $response = $this->postJson('/api/digital-cards', [
            'member_id' => 'M12345',
            'full_name' => 'John Doe',
            'email' => 'john@example.com',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'success',
            'data' => [
                'card_id',
                'member_id',
                'qr_code',
                'status',
                'issued_at',
            ],
        ]);

        $this->assertDatabaseHas('digital_cards', [
            'member_id' => 'M12345',
            'tenant_id' => 1,
        ]);
    }

    public function test_cannot_issue_card_without_subscription(): void
    {
        // Mock ModuleRegistry to return 403
        Http::fake([
            'module-registry.test/*' => Http::response(['message' => 'No subscription'], 403),
        ]);

        $response = $this->postJson('/api/digital-cards', [
            'member_id' => 'M12345',
            'full_name' => 'John Doe',
        ]);

        $response->assertStatus(403);
        $response->assertJson([
            'success' => false,
            'error' => 'Subscription required',
        ]);
    }
}
```

---

## Testing with Fakes (Best Practice)

### Benefits of Fakes over Mocks

✅ **Fakes:**
- Real behavior, fake implementation
- Stateful, trackable
- Reusable across tests
- No brittle expectations

❌ **Mocks:**
- Brittle (breaks when implementation changes)
- Complex setup
- Hard to maintain

### Creating a Fake

```php
final class FakeModuleAccess implements ModuleAccessInterface
{
    private bool $hasSubscription = true;
    private array $calls = [];

    public function ensureCanPerform(string $tenantId, string $action): void
    {
        $this->calls[] = ['method' => 'ensureCanPerform', 'tenantId' => $tenantId];

        if (!$this->hasSubscription) {
            throw SubscriptionRequiredException::withMessage('No subscription');
        }
    }

    // Test helpers
    public function setHasSubscription(bool $has): void
    {
        $this->hasSubscription = $has;
    }

    public function getCalls(): array
    {
        return $this->calls;
    }

    public function reset(): void
    {
        $this->hasSubscription = true;
        $this->calls = [];
    }
}
```

---

## Test Coverage

### Check Coverage

```bash
php artisan test --coverage
```

### Minimum Coverage Requirements

- **Domain layer:** 100%
- **Application layer:** ≥ 90%
- **Infrastructure layer:** ≥ 70%
- **Overall:** ≥ 80%

### Coverage Report

```bash
php artisan test --coverage --min=80
```

---

## Common Test Patterns

### Pattern 1: Arrange-Act-Assert

```php
public function test_something(): void
{
    // Arrange - setup
    $fake = new FakeClock();
    $handler = new Handler($fake);

    // Act - execute
    $result = $handler->handle($command);

    // Assert - verify
    $this->assertEquals('expected', $result);
}
```

### Pattern 2: Exception Testing

```php
public function test_throws_exception(): void
{
    $this->expectException(DomainException::class);
    $this->expectExceptionMessage('Card already activated');

    $card->activate($now);
}
```

### Pattern 3: Data Providers

```php
/**
 * @dataProvider invalidUuidProvider
 */
public function test_rejects_invalid_uuids(string $invalidUuid): void
{
    $this->expectException(\InvalidArgumentException::class);
    CardId::fromString($invalidUuid);
}

public static function invalidUuidProvider(): array
{
    return [
        ['not-a-uuid'],
        ['12345678-1234-1234-1234-123456789012'], // Wrong version
        [''],
        ['null'],
    ];
}
```

---

## Testing Checklist

Before committing code:

1. ✅ All tests passing
2. ✅ Coverage ≥ 80%
3. ✅ No skipped tests
4. ✅ No @todo comments in tests
5. ✅ Domain tests use NO mocks (use fakes)
6. ✅ Tests are fast (< 1 second each)

---

## Running Tests

```bash
# All tests
php artisan test

# Unit tests only
php artisan test --testsuite=Unit

# Feature tests only
php artisan test --testsuite=Feature

# Specific test
php artisan test --filter=IssueCardHandlerTest

# With coverage
php artisan test --coverage

# Parallel execution
php artisan test --parallel

# Stop on failure
php artisan test --stop-on-failure
```

---

## Debugging Tests

### Enable Detailed Output

```bash
php artisan test --filter=YourTest --debug
```

### Dump Variables

```php
public function test_something(): void
{
    $result = $handler->handle($command);
    dump($result); // Shows in console
    $this->assertTrue(true);
}
```

### Use dd() for Stopping

```php
public function test_something(): void
{
    $result = $handler->handle($command);
    dd($result); // Dump and die
}
```

---

## Next Steps

- Read [Adding Features](06_ADDING_FEATURES.md) for TDD workflow
- Read [Debugging Guide](08_DEBUGGING_GUIDE.md) for troubleshooting tests
- Read [Production Deployment](09_PRODUCTION_DEPLOYMENT.md) for CI/CD integration
