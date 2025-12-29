# **HEXAGONAL ARCHITECTURE: MAKE DIGITALCARD CONTEXT FRAMEWORK INDEPENDENT**
## **Professional Claude CLI Prompt for Senior Architect**

**Objective:** Refactor DigitalCard Context to implement proper Hexagonal Architecture with Ports and Adapters, achieving zero framework dependencies in Domain/Application layers.

**Duration:** 2-3 days (Priority before Phase 1)  
**Benefit:** Framework swappability, true testability, architecture clarity  
**Investment:** 2-3 days now = Saves weeks of refactoring later

---

## **SECTION 1: THE PROBLEM & SOLUTION**

### **Current State (DDD but not Hexagonal)**

```
❌ PROBLEM:
   Domain layer: Imports Illuminate\Support\Str::uuid()
   Application layer: No port abstractions
   Handlers: Directly coupled to Laravel, Spatie, framework details
   Tests: Cannot easily test without framework bootstrapping
   Swappability: Cannot switch from Spatie to Laravel Tenancy without refactoring
```

### **Target State (True Hexagonal)**

```
✅ SOLUTION:
   Domain layer: Zero framework dependencies (pure PHP)
   Application layer: Depends only on Ports (interfaces)
   Handlers: Coupled to abstractions, not implementations
   Tests: Can inject fake implementations without framework
   Swappability: Switch Spatie→Laravel Tenancy in one adapter class
   
Architecture:
┌────────────────────────────────────┐
│   DIGITALCARD CONTEXT              │
│   Domain + Application layers      │
│   Pure business logic              │
└────────────────────────────────────┘
          ↓ depends on ↓
┌────────────────────────────────────┐
│   PORTS (Interfaces)               │
│   Clock, TenantContext, etc.       │
│   Framework agnostic               │
└────────────────────────────────────┘
          ↓ implemented by ↓
┌────────────────────────────────────┐
│   ADAPTERS (Implementations)       │
│   LaravelClock, SpatieTenantContext│
│   Framework specific               │
└────────────────────────────────────┘
```

---

## **SECTION 2: CREATE SHARED CONTRACTS (PORTS LAYER)**

### **2.1 System Contracts**

```php
<?php
// app/Contexts/Shared/Contracts/System/Clock.php

declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\System;

final interface Clock
{
    /**
     * Get current date and time
     */
    public function now(): \DateTimeImmutable;

    /**
     * Get today's date at midnight
     */
    public function today(): \DateTimeImmutable;

    /**
     * Get specific time for testing
     */
    public function at(string $dateString): \DateTimeImmutable;
}

// app/Contexts/Shared/Contracts/System/IdGenerator.php

declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\System;

final interface IdGenerator
{
    /**
     * Generate a UUID v4
     */
    public function uuid(): string;

    /**
     * Generate a random string
     */
    public function randomString(int $length = 16): string;
}
```

### **2.2 Media Contracts**

```php
<?php
// app/Contexts/Shared/Contracts/Media/QRCodeGenerator.php

declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\Media;

final interface QRCodeGenerator
{
    /**
     * Generate QR code for member ID
     * Returns raw SVG or base64 string
     */
    public function generate(string $memberId): string;

    /**
     * Generate with custom options
     */
    public function generateWithOptions(string $memberId, array $options = []): string;
}
```

### **2.3 Tenancy Contracts**

```php
<?php
// app/Contexts/Shared/Contracts/Tenancy/TenantContext.php

declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\Tenancy;

final interface TenantContext
{
    /**
     * Get currently active tenant ID
     */
    public function getTenantId(): string;

    /**
     * Get currently active tenant slug
     */
    public function getTenantSlug(): string;

    /**
     * Check if tenant context is valid
     */
    public function isValid(): bool;

    /**
     * Get tenant connection name (for query builder)
     */
    public function getConnectionName(): string;
}

// app/Contexts/Shared/Contracts/Tenancy/TenantConnectionSwitcher.php

declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\Tenancy;

final interface TenantConnectionSwitcher
{
    /**
     * Switch to tenant's database connection
     * For operations that need to access tenant data
     */
    public function switchToTenant(string $tenantId): void;

    /**
     * Return to landlord connection
     */
    public function switchToLandlord(): void;

    /**
     * Execute callback in tenant context
     */
    public function forTenant(string $tenantId, callable $callback): mixed;
}
```

### **2.4 Event Contracts**

```php
<?php
// app/Contexts/Shared/Contracts/Events/EventPublisher.php

declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\Events;

final interface EventPublisher
{
    /**
     * Publish a domain event
     */
    public function publish(object $event): void;

    /**
     * Publish multiple events
     */
    public function publishMany(array $events): void;
}
```

---

## **SECTION 3: CREATE ADAPTER IMPLEMENTATIONS**

### **3.1 System Adapters**

```php
<?php
// app/Infrastructure/Adapters/LaravelClock.php

declare(strict_types=1);

namespace App\Infrastructure\Adapters;

use App\Contexts\Shared\Contracts\System\Clock;

final class LaravelClock implements Clock
{
    public function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable(); // Pure PHP, no framework
    }

    public function today(): \DateTimeImmutable
    {
        return $this->now()->setTime(0, 0, 0);
    }

    public function at(string $dateString): \DateTimeImmutable
    {
        return new \DateTimeImmutable($dateString);
    }
}

// app/Infrastructure/Adapters/RandomIdGenerator.php

declare(strict_types=1);

namespace App\Infrastructure\Adapters;

use App\Contexts\Shared\Contracts\System\IdGenerator;

final class RandomIdGenerator implements IdGenerator
{
    public function uuid(): string
    {
        // Pure PHP UUID v4 generation - no framework dependency
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    public function randomString(int $length = 16): string
    {
        return substr(str_shuffle(str_repeat('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', ceil($length / 62))), 0, $length);
    }
}
```

### **3.2 Media Adapters**

```php
<?php
// app/Infrastructure/Adapters/SimpleQRCodeGenerator.php

declare(strict_types=1);

namespace App\Infrastructure\Adapters;

use App\Contexts\Shared\Contracts\Media\QRCodeGenerator;

final class SimpleQRCodeGenerator implements QRCodeGenerator
{
    public function generate(string $memberId): string
    {
        return $this->generateWithOptions($memberId);
    }

    public function generateWithOptions(string $memberId, array $options = []): string
    {
        // Using endroid/qr-code package (framework agnostic)
        $qr = new \Endroid\QrCode\QrCode($memberId);
        $qr->setSize($options['size'] ?? 300);
        $qr->setMargin($options['margin'] ?? 10);

        return $qr->writeString();
    }
}
```

### **3.3 Tenancy Adapters**

```php
<?php
// app/Infrastructure/Adapters/SpatieTenantContext.php

declare(strict_types=1);

namespace App\Infrastructure\Adapters;

use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use Spatie\Multitenancy\Models\Tenant;

final class SpatieTenantContext implements TenantContext
{
    public function getTenantId(): string
    {
        $tenant = Tenant::current();
        
        if (!$tenant) {
            throw new \RuntimeException('No active tenant context');
        }

        return $tenant->id;
    }

    public function getTenantSlug(): string
    {
        $tenant = Tenant::current();
        
        if (!$tenant) {
            throw new \RuntimeException('No active tenant context');
        }

        return $tenant->slug;
    }

    public function isValid(): bool
    {
        return Tenant::current() !== null;
    }

    public function getConnectionName(): string
    {
        return Tenant::current()?->database_connection ?? 'tenant';
    }
}

// app/Infrastructure/Adapters/SpatieTenantConnectionSwitcher.php

declare(strict_types=1);

namespace App\Infrastructure\Adapters;

use App\Contexts\Shared\Contracts\Tenancy\TenantConnectionSwitcher;
use Spatie\Multitenancy\Models\Tenant;

final class SpatieTenantConnectionSwitcher implements TenantConnectionSwitcher
{
    public function switchToTenant(string $tenantId): void
    {
        $tenant = Tenant::find($tenantId);
        
        if (!$tenant) {
            throw new \RuntimeException("Tenant {$tenantId} not found");
        }

        Tenant::makeCurrent($tenant);
    }

    public function switchToLandlord(): void
    {
        Tenant::forgetCurrent();
    }

    public function forTenant(string $tenantId, callable $callback): mixed
    {
        $original = Tenant::current();
        
        try {
            $this->switchToTenant($tenantId);
            return $callback();
        } finally {
            if ($original) {
                Tenant::makeCurrent($original);
            } else {
                $this->switchToLandlord();
            }
        }
    }
}

// app/Infrastructure/Adapters/LaravelEventPublisher.php

declare(strict_types=1);

namespace App\Infrastructure\Adapters;

use App\Contexts\Shared\Contracts\Events\EventPublisher;
use Illuminate\Events\Dispatcher;

final class LaravelEventPublisher implements EventPublisher
{
    public function __construct(private Dispatcher $events)
    {
    }

    public function publish(object $event): void
    {
        $this->events->dispatch($event);
    }

    public function publishMany(array $events): void
    {
        foreach ($events as $event) {
            $this->publish($event);
        }
    }
}
```

---

## **SECTION 4: REFACTOR DOMAIN LAYER**

### **4.1 Update Value Objects (Remove Framework Dependencies)**

```php
<?php
// app/Contexts/DigitalCard/Domain/ValueObjects/CardId.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

final readonly class CardId
{
    private function __construct(public string $value)
    {
        if (empty($this->value)) {
            throw new \InvalidArgumentException('CardId cannot be empty');
        }
    }

    /**
     * Generate new CardId with pure PHP UUID
     * No framework dependency!
     */
    public static function generate(): self
    {
        return new self(self::generateUuid());
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }

    /**
     * Pure PHP UUID v4 generation
     * Can be called anywhere without framework
     */
    private static function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}

// app/Contexts/DigitalCard/Domain/ValueObjects/QRCode.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

final readonly class QRCode
{
    private function __construct(public string $data)
    {
        if (empty($this->data)) {
            throw new \InvalidArgumentException('QRCode data cannot be empty');
        }
    }

    /**
     * Create from generated data
     * Domain doesn't know HOW it was generated
     */
    public static function from(string $data): self
    {
        return new self($data);
    }

    public function getData(): string
    {
        return $this->data;
    }
}
```

---

## **SECTION 5: REFACTOR APPLICATION LAYER**

### **5.1 Update Handlers to Use Ports**

```php
<?php
// app/Contexts/DigitalCard/Application/Handlers/IssueCardHandler.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use App\Contexts\DigitalCard\Application\DTOs\CardDTO;
use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;
use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;
use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;
use App\Contexts\Shared\Contracts\System\Clock;
use App\Contexts\Shared\Contracts\Media\QRCodeGenerator;
use App\Contexts\Shared\Contracts\Events\EventPublisher;
use App\Contexts\Subscription\Application\Services\FeatureGateService;

final class IssueCardHandler
{
    public function __construct(
        private DigitalCardRepository $cardRepository,
        private Clock $clock,                           // ✅ Port
        private QRCodeGenerator $qrGenerator,          // ✅ Port
        private EventPublisher $eventPublisher,        // ✅ Port
        private FeatureGateService $featureGate,
    ) {}

    public function handle(IssueCardCommand $command): CardDTO
    {
        // ✅ Check subscription
        if (!$this->featureGate->can(
            $command->tenantId,
            'digital_card',
            'digital_cards'
        )) {
            throw new \DomainException('Not subscribed');
        }

        // ✅ Using ports - no framework coupling
        $now = $this->clock->now();
        $qrCode = $this->qrGenerator->generate($command->memberId->value());
        
        // Business logic
        $card = DigitalCard::issue(
            CardId::generate(),
            $command->tenantId,
            $command->memberId,
            $command->expiresAt,
            $qrCode,
        );

        // Persist
        $this->cardRepository->save($card);

        // Publish events
        foreach ($card->flushDomainEvents() as $event) {
            $this->eventPublisher->publish($event);
        }

        return CardDTO::fromEntity($card);
    }
}

// app/Contexts/DigitalCard/Application/Handlers/ActivateCardHandler.php

final class ActivateCardHandler
{
    public function __construct(
        private DigitalCardRepository $cardRepository,
        private Clock $clock,                           // ✅ Port
        private EventPublisher $eventPublisher,        // ✅ Port
    ) {}

    public function handle(ActivateCardCommand $command): CardDTO
    {
        $card = $this->cardRepository->byId($command->cardId);
        
        if (!$card || $card->tenantId() !== $command->tenantId) {
            throw new \DomainException('Card not found');
        }

        // Using port for time
        $card->activate($this->clock->now());

        $this->cardRepository->save($card);

        foreach ($card->flushDomainEvents() as $event) {
            $this->eventPublisher->publish($event);
        }

        return CardDTO::fromEntity($card);
    }
}
```

---

## **SECTION 6: CREATE TEST FAKES (For Testing Without Framework)**

### **6.1 Fake Implementations**

```php
<?php
// tests/Doubles/Fakes/FakeClock.php

declare(strict_types=1);

namespace Tests\Doubles\Fakes;

use App\Contexts\Shared\Contracts\System\Clock;

final class FakeClock implements Clock
{
    private ?\DateTimeImmutable $fixedTime = null;

    public function fixTime(\DateTimeImmutable $time): void
    {
        $this->fixedTime = $time;
    }

    public function now(): \DateTimeImmutable
    {
        return $this->fixedTime ?? new \DateTimeImmutable('2024-01-01T12:00:00Z');
    }

    public function today(): \DateTimeImmutable
    {
        return $this->now()->setTime(0, 0, 0);
    }

    public function at(string $dateString): \DateTimeImmutable
    {
        return new \DateTimeImmutable($dateString);
    }
}

// tests/Doubles/Fakes/FakeQRCodeGenerator.php

final class FakeQRCodeGenerator implements QRCodeGenerator
{
    private array $generated = [];

    public function generate(string $memberId): string
    {
        $code = "FAKE_QR_{$memberId}";
        $this->generated[] = $code;
        return $code;
    }

    public function generateWithOptions(string $memberId, array $options = []): string
    {
        return $this->generate($memberId);
    }

    public function wasGenerated(string $memberId): bool
    {
        return in_array("FAKE_QR_{$memberId}", $this->generated);
    }
}

// tests/Doubles/Fakes/FakeTenantContext.php

final class FakeTenantContext implements TenantContext
{
    private string $tenantId = 'tenant-123';
    private string $tenantSlug = 'test-tenant';

    public function setTenantId(string $id): void
    {
        $this->tenantId = $id;
    }

    public function setTenantSlug(string $slug): void
    {
        $this->tenantSlug = $slug;
    }

    public function getTenantId(): string
    {
        return $this->tenantId;
    }

    public function getTenantSlug(): string
    {
        return $this->tenantSlug;
    }

    public function isValid(): bool
    {
        return true;
    }

    public function getConnectionName(): string
    {
        return 'tenant';
    }
}

// tests/Doubles/Fakes/FakeEventPublisher.php

final class FakeEventPublisher implements EventPublisher
{
    private array $published = [];

    public function publish(object $event): void
    {
        $this->published[] = $event;
    }

    public function publishMany(array $events): void
    {
        foreach ($events as $event) {
            $this->publish($event);
        }
    }

    /**
     * For test assertions
     */
    public function wasPublished(string $eventClass): bool
    {
        foreach ($this->published as $event) {
            if ($event::class === $eventClass) {
                return true;
            }
        }
        return false;
    }

    public function getPublished(): array
    {
        return $this->published;
    }
}
```

---

## **SECTION 7: UPDATE SERVICE PROVIDER**

```php
<?php
// app/Providers/ContextServiceProvider.php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

// System contracts
use App\Contexts\Shared\Contracts\System\Clock;
use App\Contexts\Shared\Contracts\System\IdGenerator;
use App\Infrastructure\Adapters\LaravelClock;
use App\Infrastructure\Adapters\RandomIdGenerator;

// Media contracts
use App\Contexts\Shared\Contracts\Media\QRCodeGenerator;
use App\Infrastructure\Adapters\SimpleQRCodeGenerator;

// Tenancy contracts
use App\Contexts\Shared\Contracts\Tenancy\{TenantContext, TenantConnectionSwitcher};
use App\Infrastructure\Adapters\{SpatieTenantContext, SpatieTenantConnectionSwitcher};

// Event contracts
use App\Contexts\Shared\Contracts\Events\EventPublisher;
use App\Infrastructure\Adapters\LaravelEventPublisher;

class ContextServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // System contracts
        $this->app->singleton(Clock::class, LaravelClock::class);
        $this->app->singleton(IdGenerator::class, RandomIdGenerator::class);

        // Media contracts
        $this->app->singleton(QRCodeGenerator::class, SimpleQRCodeGenerator::class);

        // Tenancy contracts
        $this->app->singleton(TenantContext::class, SpatieTenantContext::class);
        $this->app->singleton(TenantConnectionSwitcher::class, SpatieTenantConnectionSwitcher::class);

        // Event contracts
        $this->app->singleton(EventPublisher::class, LaravelEventPublisher::class);
    }
}
```

---

## **SECTION 8: REFACTORED TESTS**

```php
<?php
// tests/Feature/Contexts/DigitalCard/IssueCardHandlerTest.php

namespace Tests\Feature\Contexts\DigitalCard;

use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;
use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;
use App\Contexts\DigitalCard\Infrastructure\Models\DigitalCardModel;
use App\Models\Tenant;
use Tests\Doubles\Fakes\{FakeClock, FakeQRCodeGenerator, FakeEventPublisher};
use Tests\TestCase;

class IssueCardHandlerTest extends TestCase
{
    it('issues card with fakes - no framework needed', function () {
        // Setup
        $tenant = Tenant::factory()->create();
        $subscribeToModule($tenant, 'digital_card', 'free');

        // Create fakes - NO FRAMEWORK BOOTSTRAP NEEDED
        $clock = new FakeClock();
        $qrGenerator = new FakeQRCodeGenerator();
        $eventPublisher = new FakeEventPublisher();

        // Get repository (still needs Eloquent for persistence)
        $repository = app('digitalcard-repository');

        // Handler with fakes
        $handler = new IssueCardHandler(
            $repository,
            $clock,
            $qrGenerator,
            $eventPublisher,
            app('feature-gate'),
        );

        // Execute
        $command = new IssueCardCommand(
            tenantId: $tenant->id,
            memberId: MemberId::from('member-123'),
            expiresAt: new \DateTimeImmutable('+1 year'),
        );

        $card = $handler->handle($command);

        // Assertions
        expect($card->status)->toBe('issued');
        expect($qrGenerator->wasGenerated('member-123'))->toBeTrue();
        expect($eventPublisher->wasPublished(CardIssued::class))->toBeTrue();
    });

    it('can test with fixed time using FakeClock', function () {
        $tenant = Tenant::factory()->create();
        $subscribeToModule($tenant, 'digital_card', 'free');

        $clock = new FakeClock();
        $clock->fixTime(new \DateTimeImmutable('2024-01-15T10:30:00Z'));

        // Assert that handler uses the fixed time
        $qrGenerator = new FakeQRCodeGenerator();
        $eventPublisher = new FakeEventPublisher();
        $repository = app('digitalcard-repository');

        $handler = new IssueCardHandler(
            $repository,
            $clock,
            $qrGenerator,
            $eventPublisher,
            app('feature-gate'),
        );

        $command = new IssueCardCommand(
            tenantId: $tenant->id,
            memberId: MemberId::from('member-456'),
            expiresAt: new \DateTimeImmutable('+1 year'),
        );

        $card = $handler->handle($command);

        // The card should be issued at the fixed time
        expect($card->issued_at)->toBe('2024-01-15T10:30:00Z');
    });
}
```

---

## **SECTION 9: IMPLEMENTATION CHECKLIST (2-3 Days)**

### **Day 1: Create Ports & Adapters (6-8 hours)**

- [ ] Create `app/Contexts/Shared/Contracts/` directory structure
- [ ] Implement Clock interface + LaravelClock adapter
- [ ] Implement IdGenerator interface + RandomIdGenerator adapter
- [ ] Implement QRCodeGenerator interface + SimpleQRCodeGenerator adapter
- [ ] Implement TenantContext interface + SpatieTenantContext adapter
- [ ] Implement TenantConnectionSwitcher interface + SpatieTenantConnectionSwitcher adapter
- [ ] Implement EventPublisher interface + LaravelEventPublisher adapter
- [ ] Update ContextServiceProvider with all bindings
- [ ] Verify all tests still pass

### **Day 2: Refactor Domain & Application (6-8 hours)**

- [ ] Remove framework dependencies from Domain layer
- [ ] Update CardId, QRCode, MemberId value objects
- [ ] Update IssueCardHandler to use ports
- [ ] Update ActivateCardHandler to use ports
- [ ] Update RevokeCardHandler to use ports
- [ ] Verify domain layer is zero-framework
- [ ] All tests passing

### **Day 3: Create Test Fakes & Verify (4-6 hours)**

- [ ] Create FakeClock implementation
- [ ] Create FakeQRCodeGenerator implementation
- [ ] Create FakeTenantContext implementation
- [ ] Create FakeEventPublisher implementation
- [ ] Update existing tests to use fakes
- [ ] Create new unit tests using fakes (no framework)
- [ ] Verify 90%+ coverage maintained
- [ ] Verify all tests pass
- [ ] PHPStan clean (when configured)

---

## **SECTION 10: VERIFICATION CHECKLIST**

✅ **Domain Layer:**
- [ ] Zero `use Illuminate\` statements
- [ ] Zero `use Spatie\` statements
- [ ] All dependencies are interfaces (ports)
- [ ] Pure PHP UUID generation works

✅ **Application Layer:**
- [ ] All handlers depend on port interfaces only
- [ ] No direct framework class instantiation
- [ ] Tests can run with fake implementations

✅ **Port Interface Contracts:**
- [ ] 6 core interfaces defined
- [ ] Clear method signatures
- [ ] Comprehensive docblocks

✅ **Adapter Implementations:**
- [ ] One adapter per port per framework
- [ ] Easy to swap implementations
- [ ] Clear separation from business logic

✅ **Tests:**
- [ ] All existing tests pass
- [ ] New unit tests with fakes pass
- [ ] 90%+ coverage maintained
- [ ] No framework bootstrap needed for unit tests

✅ **Swappability Demonstrated:**
- [ ] Can change Spatie→Laravel Tenancy (just one adapter file)
- [ ] Can change QR implementation (just one adapter file)
- [ ] Business logic unchanged

---

## **SECTION 11: FUTURE SWAPPABILITY EXAMPLES**

### **Example 1: Switch from Spatie to Laravel Tenancy**

```php
// BEFORE (your current approach)
// Uses Spatie throughout

// AFTER (with Hexagonal Architecture)
// Create ONE new adapter class:

class LaravelTenancyContextAdapter implements TenantContext
{
    public function getTenantId(): string
    {
        return \Illuminate\Support\Facades\Tenancy::tenant()?->id ?? throw new Exception();
    }
    // ... other methods
}

// Update one line in ServiceProvider:
$this->app->bind(
    TenantContext::class,
    LaravelTenancyContextAdapter::class  // ← Just this changes
);

// ALL business logic unchanged!
// ALL handlers unchanged!
// Only test one adapter class thoroughly
```

### **Example 2: Switch QR Library**

```php
// BEFORE: If you hardcoded endroid/qr-code

// AFTER: Create new adapter:

class GoogleChartsQRCodeGenerator implements QRCodeGenerator
{
    public function generate(string $memberId): string
    {
        // Use Google Charts API instead of endroid
        return "https://chart.googleapis.com/chart?chs=300x300&chld=M|0&cht=qr&chl=" . urlencode($memberId);
    }
}

// Update one line in ServiceProvider:
$this->app->bind(
    QRCodeGenerator::class,
    GoogleChartsQRCodeGenerator::class  // ← Just this changes
);

// All business logic unchanged!
```

---

## **SECTION 12: BENEFITS SUMMARY**

### **Immediate Benefits**

✅ **Framework Independence** - Switch Spatie ↔ Laravel Tenancy without refactoring business logic  
✅ **True Testability** - Unit test handlers with fakes, no framework bootstrap  
✅ **Clear Boundaries** - Domain knows nothing about framework details  
✅ **Easy Maintenance** - Changes in one layer don't ripple through others  

### **Long-term Benefits**

✅ **Package Swappability** - Change QR library, event publisher, etc. in one line  
✅ **Portability** - Move business logic to different framework/project  
✅ **Team Clarity** - Developers understand boundaries immediately  
✅ **Reduced Coupling** - Easier to parallelize development  

---

## **FINAL RECOMMENDATIONS**

1. **Priority:** Complete this BEFORE Phase 1 (saves weeks of refactoring)
2. **Order:** Ports → Adapters → Refactor Handlers → Tests → Verify
3. **Testing:** Use fakes throughout - unit test without framework
4. **Documentation:** Update architecture docs showing port layer
5. **Review:** Have someone review port design before implementation

---

**Status:** ✅ **READY FOR HEXAGONAL REFACTORING**

This 2-3 day investment will save weeks of refactoring later and establish a professional, swappable architecture for your entire system.

Begin with **Section 2: Create Shared Contracts** tomorrow morning. 🚀

