# Ports & Adapters - DigitalCard Context

**Version:** Phase 1.3
**Pattern:** Hexagonal Architecture
**Total Ports:** 6

---

## What are Ports and Adapters?

**Ports** = Interfaces defined in Domain layer
**Adapters** = Implementations in Infrastructure layer

```
┌─────────────────┐
│   DOMAIN        │
│   (Core)        │  Defines Port ─────────┐
│                 │  (interface)           │
└─────────────────┘                        │
                                           │
                                           ▼
┌─────────────────┐            ┌──────────────────┐
│  INFRASTRUCTURE │            │  ADAPTER         │
│  (Outside)      │◄───────────│  (Implementation)│
└─────────────────┘            └──────────────────┘
```

**Benefits:**
- Domain doesn't depend on infrastructure
- Easy to swap implementations
- Testable with fakes
- Framework independence

---

## Port 1: ClockInterface

### Purpose
Abstract time operations to allow frozen time in tests.

### Port Definition

**File:** `Domain/Ports/ClockInterface.php`

```php
namespace App\Contexts\DigitalCard\Domain\Ports;

use DateTimeImmutable;

interface ClockInterface
{
    public function now(): DateTimeImmutable;
}
```

### Real Adapter: LaravelClock

**File:** `Infrastructure/Adapters/LaravelClock.php`

```php
namespace App\Contexts\DigitalCard\Infrastructure\Adapters;

use App\Contexts\DigitalCard\Domain\Ports\ClockInterface;
use DateTimeImmutable;

final class LaravelClock implements ClockInterface
{
    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable();
    }
}
```

**Features:**
- Returns current system time
- Uses PHP's `DateTimeImmutable`
- Thread-safe, immutable

### Fake Adapter: FakeClock

**File:** `Infrastructure/Testing/FakeClock.php`

```php
final class FakeClock implements ClockInterface
{
    private DateTimeImmutable $frozenTime;

    public function __construct(?DateTimeImmutable $frozenTime = null)
    {
        $this->frozenTime = $frozenTime ?? new DateTimeImmutable();
    }

    public function now(): DateTimeImmutable
    {
        return $this->frozenTime;
    }

    public function freeze(DateTimeImmutable $time): void
    {
        $this->frozenTime = $time;
    }

    public function reset(): void
    {
        $this->frozenTime = new DateTimeImmutable();
    }
}
```

**Usage in Tests:**

```php
$clock = new FakeClock(new DateTimeImmutable('2025-01-01 10:00:00'));
$handler = new IssueCardHandler($repository, $clock, /* ... */);

$cardDTO = $handler->handle($command);
$this->assertEquals('2025-01-01 10:00:00', $cardDTO->issuedAt->format('Y-m-d H:i:s'));
```

---

## Port 2: IdGeneratorInterface

### Purpose
Abstract UUID generation for predictable IDs in tests.

### Port Definition

**File:** `Domain/Ports/IdGeneratorInterface.php`

```php
namespace App\Contexts\DigitalCard\Domain\Ports;

interface IdGeneratorInterface
{
    public function generate(): string;
}
```

### Real Adapter: LaravelIdGenerator

**File:** `Infrastructure/Adapters/LaravelIdGenerator.php`

```php
final class LaravelIdGenerator implements IdGeneratorInterface
{
    public function generate(): string
    {
        return \Illuminate\Support\Str::uuid()->toString();
    }
}
```

**Features:**
- Uses Laravel's UUID generator (Ramsey\Uuid under the hood)
- Returns string format UUID v4

### Fake Adapter: FakeIdGenerator

**File:** `Infrastructure/Testing/FakeIdGenerator.php`

```php
final class FakeIdGenerator implements IdGeneratorInterface
{
    private int $counter = 1;
    private ?string $nextId = null;

    public function generate(): string
    {
        if ($this->nextId !== null) {
            $id = $this->nextId;
            $this->nextId = null;
            return $id;
        }

        return "test-uuid-{$this->counter++}";
    }

    public function setNextId(string $id): void
    {
        $this->nextId = $id;
    }

    public function reset(): void
    {
        $this->counter = 1;
        $this->nextId = null;
    }
}
```

**Usage in Tests:**

```php
$idGen = new FakeIdGenerator();
$idGen->setNextId('custom-card-id');

$handler = new IssueCardHandler($repository, $clock, $idGen, /* ... */);
$cardDTO = $handler->handle($command);

$this->assertEquals('custom-card-id', $cardDTO->cardId);
```

---

## Port 3: QRCodeGeneratorInterface

### Purpose
Abstract QR code generation to avoid actual image processing in tests.

### Port Definition

**File:** `Domain/Ports/QRCodeGeneratorInterface.php`

```php
namespace App\Contexts\DigitalCard\Domain\Ports;

interface QRCodeGeneratorInterface
{
    public function generate(string $data): string;
}
```

**Returns:** Base64-encoded PNG data

### Real Adapter: LaravelQRCodeGenerator

**File:** `Infrastructure/Adapters/LaravelQRCodeGenerator.php`

```php
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Writer;

final class LaravelQRCodeGenerator implements QRCodeGeneratorInterface
{
    public function generate(string $data): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle(400),
            new SvgImageBackEnd()
        );

        $writer = new Writer($renderer);
        $qrCodeSvg = $writer->writeString($data);

        return base64_encode($qrCodeSvg);
    }
}
```

**Dependencies:**
```bash
composer require bacon/bacon-qr-code
```

**Features:**
- Generates 400x400px QR codes
- Returns base64-encoded SVG
- Can be changed to PNG if needed

### Fake Adapter: FakeQRCodeGenerator

**File:** `Infrastructure/Testing/FakeQRCodeGenerator.php`

```php
final class FakeQRCodeGenerator implements QRCodeGeneratorInterface
{
    private int $callCount = 0;
    private ?string $nextQrCode = null;

    public function generate(string $data): string
    {
        $this->callCount++;

        if ($this->nextQrCode !== null) {
            $qr = $this->nextQrCode;
            $this->nextQrCode = null;
            return $qr;
        }

        return base64_encode("fake-qr-code-{$data}");
    }

    public function setNextQrCode(string $qrCode): void
    {
        $this->nextQrCode = $qrCode;
    }

    public function getCallCount(): int
    {
        return $this->callCount;
    }

    public function reset(): void
    {
        $this->callCount = 0;
        $this->nextQrCode = null;
    }
}
```

**Usage in Tests:**

```php
$qrGen = new FakeQRCodeGenerator();
$handler = new IssueCardHandler(/* ... */, $qrGen, /* ... */);

$cardDTO = $handler->handle($command);
$this->assertStringContainsString('fake-qr-code', base64_decode($cardDTO->qrCode));
$this->assertEquals(1, $qrGen->getCallCount());
```

---

## Port 4: ModuleAccessInterface

### Purpose
Abstract ModuleRegistry communication for subscription and quota checks (Phase 1.3).

### Port Definition

**File:** `Domain/Ports/ModuleAccessInterface.php`

```php
namespace App\Contexts\DigitalCard\Domain\Ports;

interface ModuleAccessInterface
{
    /**
     * Ensure tenant can perform action (throws exception if not)
     *
     * @throws SubscriptionRequiredException
     */
    public function ensureCanPerform(string $tenantId, string $action): void;

    /**
     * Check if tenant can perform action (non-throwing)
     */
    public function canPerform(string $tenantId, string $action): bool;

    /**
     * Get tenant's quota information
     *
     * @return array{used: int, limit: int, remaining: int}
     */
    public function getQuota(string $tenantId): array;

    /**
     * Ensure tenant is within quota (throws exception if exceeded)
     *
     * @throws QuotaExceededException
     */
    public function ensureWithinQuota(string $tenantId): void;
}
```

### Real Adapter: ModuleRegistryAdapter

**File:** `Infrastructure/Adapters/ModuleRegistryAdapter.php`

```php
use Illuminate\Support\Facades\Http;

final class ModuleRegistryAdapter implements ModuleAccessInterface
{
    private const MODULE_NAME = 'digital_card';

    public function __construct(
        private readonly string $moduleRegistryUrl
    ) {}

    public function ensureCanPerform(string $tenantId, string $action): void
    {
        $response = Http::acceptJson()
            ->contentType('application/json')
            ->post("{$this->moduleRegistryUrl}/api/check-access", [
                'tenant_id' => $tenantId,
                'action' => $action,
                'module' => self::MODULE_NAME,
            ]);

        if (!$response->successful()) {
            $message = $response->json('message') ?? 'No active subscription';
            throw SubscriptionRequiredException::withMessage($message);
        }
    }

    public function canPerform(string $tenantId, string $action): bool
    {
        try {
            $this->ensureCanPerform($tenantId, $action);
            return true;
        } catch (SubscriptionRequiredException) {
            return false;
        }
    }

    public function getQuota(string $tenantId): array
    {
        $response = Http::get("{$this->moduleRegistryUrl}/api/quota", [
            'tenant_id' => $tenantId,
            'module' => self::MODULE_NAME,
        ]);

        return $response->json();
    }

    public function ensureWithinQuota(string $tenantId): void
    {
        $quota = $this->getQuota($tenantId);

        if ($quota['remaining'] <= 0) {
            throw QuotaExceededException::withMessage(
                "Card limit reached ({$quota['used']}/{$quota['limit']})"
            );
        }
    }
}
```

**Configuration:**

Set in `.env`:
```env
MODULE_REGISTRY_URL=http://module-registry.test
```

Bound in ServiceProvider:
```php
$this->app->bind(ModuleAccessInterface::class, function ($app) {
    return new ModuleRegistryAdapter(
        config('services.module_registry.url')
    );
});
```

### Fake Adapter: FakeModuleAccess

**File:** `Infrastructure/Testing/FakeModuleAccess.php`

```php
final class FakeModuleAccess implements ModuleAccessInterface
{
    private bool $hasSubscription = true;
    private bool $withinQuota = true;
    private array $quota = ['used' => 0, 'limit' => 100, 'remaining' => 100];
    private array $calls = [];

    public function ensureCanPerform(string $tenantId, string $action): void
    {
        $this->calls[] = ['method' => 'ensureCanPerform', 'tenantId' => $tenantId, 'action' => $action];

        if (!$this->hasSubscription) {
            throw SubscriptionRequiredException::withMessage('No active subscription');
        }
    }

    public function ensureWithinQuota(string $tenantId): void
    {
        $this->calls[] = ['method' => 'ensureWithinQuota', 'tenantId' => $tenantId];

        if (!$this->withinQuota) {
            throw QuotaExceededException::withMessage('Quota exceeded');
        }
    }

    public function setHasSubscription(bool $has): void
    {
        $this->hasSubscription = $has;
    }

    public function setWithinQuota(bool $within): void
    {
        $this->withinQuota = $within;
    }

    public function setQuota(array $quota): void
    {
        $this->quota = $quota;
    }

    public function getCalls(): array
    {
        return $this->calls;
    }

    public function reset(): void
    {
        $this->hasSubscription = true;
        $this->withinQuota = true;
        $this->quota = ['used' => 0, 'limit' => 100, 'remaining' => 100];
        $this->calls = [];
    }
}
```

**Usage in Tests:**

```php
$moduleAccess = new FakeModuleAccess();
$moduleAccess->setHasSubscription(false);

$handler = new IssueCardHandler(/* ... */, $moduleAccess, /* ... */);

$this->expectException(SubscriptionRequiredException::class);
$handler->handle($command);
```

---

## Port 5: TenantContextInterface

### Purpose
Abstract multi-tenancy to remove Spatie dependency from Domain.

### Port Definition

**File:** `Domain/Ports/TenantContextInterface.php`

```php
namespace App\Contexts\DigitalCard\Domain\Ports;

interface TenantContextInterface
{
    public function currentTenantId(): ?string;

    public function hasTenant(): bool;

    public function getTenantProperty(string $key): mixed;
}
```

### Real Adapter: SpatieTenantContextAdapter

**File:** `Infrastructure/Adapters/SpatieTenantContextAdapter.php`

```php
use Spatie\Multitenancy\Models\Tenant;

final class SpatieTenantContextAdapter implements TenantContextInterface
{
    public function currentTenantId(): ?string
    {
        $tenant = Tenant::current();
        return $tenant ? (string) $tenant->id : null;
    }

    public function hasTenant(): bool
    {
        return Tenant::current() !== null;
    }

    public function getTenantProperty(string $key): mixed
    {
        $tenant = Tenant::current();
        return $tenant?->{$key} ?? null;
    }
}
```

**Features:**
- Wraps `Tenant::current()`
- Returns `null` when no tenant context
- Type-safe string conversion

### Fake Adapter: FakeTenantContext

**File:** `Infrastructure/Testing/FakeTenantContext.php`

```php
final class FakeTenantContext implements TenantContextInterface
{
    private ?string $tenantId = null;
    private array $properties = [];

    public function currentTenantId(): ?string
    {
        return $this->tenantId;
    }

    public function hasTenant(): bool
    {
        return $this->tenantId !== null;
    }

    public function getTenantProperty(string $key): mixed
    {
        return $this->properties[$key] ?? null;
    }

    public function setTenantId(?string $tenantId): void
    {
        $this->tenantId = $tenantId;
    }

    public function setTenantProperty(string $key, mixed $value): void
    {
        $this->properties[$key] = $value;
    }

    public function setTenant(string $id, array $properties = []): void
    {
        $this->tenantId = $id;
        $this->properties = $properties;
    }

    public function reset(): void
    {
        $this->tenantId = null;
        $this->properties = [];
    }
}
```

**Usage in Tests:**

```php
$tenantContext = new FakeTenantContext();
$tenantContext->setTenantId('tenant-123');

$handler = new IssueCardHandler(/* ... */, $tenantContext, /* ... */);
$cardDTO = $handler->handle($command);

$this->assertEquals('tenant-123', $cardDTO->tenantId);
```

---

## Port 6: EventPublisherInterface

### Purpose
Abstract event dispatching to remove `event()` helper dependency.

### Port Definition

**File:** `Domain/Ports/EventPublisherInterface.php`

```php
namespace App\Contexts\DigitalCard\Domain\Ports;

interface EventPublisherInterface
{
    public function publish(object $event): void;
}
```

### Real Adapter: LaravelEventPublisher

**File:** `Infrastructure/Adapters/LaravelEventPublisher.php`

```php
final class LaravelEventPublisher implements EventPublisherInterface
{
    public function publish(object $event): void
    {
        event($event);
    }
}
```

**Features:**
- Simple wrapper around Laravel's `event()` helper
- Works with Laravel's event system
- Supports queued listeners

### Fake Adapter: FakeEventPublisher

**File:** `Infrastructure/Testing/FakeEventPublisher.php`

```php
final class FakeEventPublisher implements EventPublisherInterface
{
    private array $publishedEvents = [];

    public function publish(object $event): void
    {
        $this->publishedEvents[] = $event;
    }

    public function wasPublished(string $eventClass): bool
    {
        foreach ($this->publishedEvents as $event) {
            if ($event instanceof $eventClass) {
                return true;
            }
        }
        return false;
    }

    public function countPublished(string $eventClass): int
    {
        $count = 0;
        foreach ($this->publishedEvents as $event) {
            if ($event instanceof $eventClass) {
                $count++;
            }
        }
        return $count;
    }

    public function getFirstPublished(string $eventClass): ?object
    {
        foreach ($this->publishedEvents as $event) {
            if ($event instanceof $eventClass) {
                return $event;
            }
        }
        return null;
    }

    public function getPublishedEvents(): array
    {
        return $this->publishedEvents;
    }

    public function reset(): void
    {
        $this->publishedEvents = [];
    }
}
```

**Usage in Tests:**

```php
$eventPublisher = new FakeEventPublisher();
$handler = new IssueCardHandler(/* ... */, $eventPublisher);

$handler->handle($command);

$this->assertTrue($eventPublisher->wasPublished(CardIssued::class));
$this->assertEquals(1, $eventPublisher->countPublished(CardIssued::class));

$event = $eventPublisher->getFirstPublished(CardIssued::class);
$this->assertInstanceOf(CardIssued::class, $event);
```

---

## Port Summary Table

| Port | Purpose | Real Adapter | Fake Adapter |
|------|---------|--------------|--------------|
| 1. ClockInterface | Time operations | LaravelClock | FakeClock |
| 2. IdGeneratorInterface | UUID generation | LaravelIdGenerator | FakeIdGenerator |
| 3. QRCodeGeneratorInterface | QR code creation | LaravelQRCodeGenerator | FakeQRCodeGenerator |
| 4. ModuleAccessInterface | Subscription checks | ModuleRegistryAdapter | FakeModuleAccess |
| 5. TenantContextInterface | Multi-tenancy | SpatieTenantContextAdapter | FakeTenantContext |
| 6. EventPublisherInterface | Event dispatching | LaravelEventPublisher | FakeEventPublisher |

---

## ServiceProvider Bindings

All ports are bound in `DigitalCardServiceProvider`:

**File:** `app/Providers/DigitalCardServiceProvider.php`

```php
public function register(): void
{
    // Port 1
    $this->app->bind(ClockInterface::class, LaravelClock::class);

    // Port 2
    $this->app->bind(IdGeneratorInterface::class, LaravelIdGenerator::class);

    // Port 3
    $this->app->bind(QRCodeGeneratorInterface::class, LaravelQRCodeGenerator::class);

    // Port 4 (with configuration)
    $this->app->bind(ModuleAccessInterface::class, function ($app) {
        return new ModuleRegistryAdapter(
            config('services.module_registry.url', 'http://module-registry.test')
        );
    });

    // Port 5
    $this->app->bind(TenantContextInterface::class, SpatieTenantContextAdapter::class);

    // Port 6
    $this->app->bind(EventPublisherInterface::class, LaravelEventPublisher::class);
}
```

---

## Swapping Implementations

### Example: Use Redis for Clock

```php
// Create new adapter
class RedisClock implements ClockInterface
{
    public function now(): DateTimeImmutable
    {
        $timestamp = Redis::get('system:time');
        return new DateTimeImmutable("@{$timestamp}");
    }
}

// Change binding
$this->app->bind(ClockInterface::class, RedisClock::class);
```

**Domain code doesn't change at all.**

---

## Testing with Fakes

```php
public function test_full_card_lifecycle_with_fakes(): void
{
    // Setup all fakes
    $clock = new FakeClock(new DateTimeImmutable('2025-01-01'));
    $idGen = new FakeIdGenerator();
    $qrGen = new FakeQRCodeGenerator();
    $moduleAccess = new FakeModuleAccess();
    $tenantContext = new FakeTenantContext();
    $eventPublisher = new FakeEventPublisher();

    // Configure fakes
    $tenantContext->setTenantId('tenant-123');
    $moduleAccess->setHasSubscription(true);
    $moduleAccess->setWithinQuota(true);

    // Create handler
    $repository = new InMemoryDigitalCardRepository();
    $handler = new IssueCardHandler(
        $repository,
        $clock,
        $idGen,
        $qrGen,
        $moduleAccess,
        $tenantContext,
        $eventPublisher,
    );

    // Execute
    $command = new IssueCardCommand(
        memberId: 'M123',
        fullName: 'John Doe',
    );

    $cardDTO = $handler->handle($command);

    // Assert
    $this->assertEquals('test-uuid-1', $cardDTO->cardId);
    $this->assertEquals('tenant-123', $cardDTO->tenantId);
    $this->assertTrue($eventPublisher->wasPublished(CardIssued::class));
}
```

---

## Next Steps

- Read [Application Layer](04_APPLICATION_LAYER.md) to see how handlers use these ports
- Read [Testing Guide](07_TESTING_GUIDE.md) for comprehensive testing strategies
- Read [Production Deployment](09_PRODUCTION_DEPLOYMENT.md) for production configuration
