# Architecture Overview - DigitalCard Context

**Version:** Phase 1.3
**Pattern:** Hexagonal Architecture (Ports & Adapters)
**Paradigm:** Domain-Driven Design (DDD)

---

## What is Hexagonal Architecture?

Hexagonal Architecture (also called "Ports & Adapters") is an architectural pattern that achieves **framework independence** by inverting dependencies.

### The Problem It Solves

Traditional layered architectures create tight coupling to frameworks:

```php
// ❌ BAD: Domain depends on Laravel
class IssueCardHandler
{
    public function handle($command)
    {
        $cardId = Str::uuid();  // Laravel dependency
        $now = Carbon::now();   // Laravel dependency
        $tenant = Tenant::current(); // Spatie dependency
    }
}
```

**Problems:**
- Cannot test without Laravel
- Cannot swap implementations
- Framework changes break domain logic
- Cannot reuse domain in other contexts

### The Hexagonal Solution

```php
// ✅ GOOD: Domain depends on interfaces
class IssueCardHandler
{
    public function __construct(
        private IdGeneratorInterface $idGenerator,
        private ClockInterface $clock,
        private TenantContextInterface $tenantContext,
    ) {}

    public function handle($command)
    {
        $cardId = $this->idGenerator->generate();
        $now = $this->clock->now();
        $tenant = $this->tenantContext->currentTenantId();
    }
}
```

**Benefits:**
- Domain layer is 100% framework-independent
- Easy to test with fakes
- Can swap implementations without changing domain
- Domain logic is portable

---

## The Hexagonal Architecture Layers

```
┌─────────────────────────────────────────────────┐
│         INFRASTRUCTURE LAYER                    │
│  (Laravel Adapters, HTTP, Database, External)  │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │      APPLICATION LAYER                    │ │
│  │  (Command Handlers, DTOs, Orchestration)  │ │
│  │                                           │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │     DOMAIN LAYER                    │ │ │
│  │  │  (Pure Business Logic, Aggregates)  │ │ │
│  │  │                                     │ │ │
│  │  │  - Entities & Aggregates            │ │ │
│  │  │  - Value Objects                    │ │ │
│  │  │  - Domain Events                    │ │ │
│  │  │  - Business Rules                   │ │ │
│  │  │  - PORTS (interfaces)               │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### 1. Domain Layer (Core)

**Location:** `app/Contexts/DigitalCard/Domain/`

**Contains:**
- Aggregates: `DigitalCard`
- Value Objects: `CardId`, `MemberId`, `QRCode`, `CardStatus`
- Domain Events: `CardIssued`, `CardActivated`, `CardRevoked`
- Ports (interfaces): All 6 hexagonal ports
- Domain Exceptions: `CardAlreadyActivatedException`, `CardNotIssuedException`

**Rules:**
- ✅ NO framework dependencies
- ✅ NO database dependencies
- ✅ NO HTTP dependencies
- ✅ Pure PHP objects only
- ✅ 100% testable with PHPUnit

#### 2. Application Layer (Orchestration)

**Location:** `app/Contexts/DigitalCard/Application/`

**Contains:**
- Command Handlers: `IssueCardHandler`, `ActivateCardHandler`, `RevokeCardHandler`
- Commands: `IssueCardCommand`, `ActivateCardCommand`, `RevokeCardCommand`
- DTOs: `CardDTO`

**Responsibilities:**
- Orchestrate use cases
- Validate input
- Call domain methods
- Persist via repositories
- Publish domain events

**Rules:**
- ✅ Can depend on Domain layer
- ✅ Can depend on Ports (interfaces)
- ❌ NO direct framework usage (use ports instead)
- ❌ NO business logic (belongs in Domain)

#### 3. Infrastructure Layer (Adapters)

**Location:** `app/Contexts/DigitalCard/Infrastructure/`

**Contains:**
- Adapters: `LaravelClock`, `LaravelIdGenerator`, `ModuleRegistryAdapter`
- Repositories: `EloquentDigitalCardRepository`
- Models: `DigitalCard` (Eloquent model)
- Service Provider: `DigitalCardServiceProvider`

**Responsibilities:**
- Implement ports with real technology
- Laravel framework integration
- Database persistence
- HTTP communication
- External service integration

**Rules:**
- ✅ Can use ANY framework code
- ✅ Implements port interfaces
- ❌ NO business logic

---

## The 6 Hexagonal Ports

Every port follows this pattern:

1. **Interface (Port)** - Defined in Domain layer
2. **Real Adapter** - Implemented in Infrastructure layer
3. **Fake Adapter** - For deterministic testing

### Port 1: ClockInterface

**Purpose:** Abstract time operations

```php
// Domain/Ports/ClockInterface.php
interface ClockInterface
{
    public function now(): DateTimeImmutable;
}

// Infrastructure/Adapters/LaravelClock.php
class LaravelClock implements ClockInterface
{
    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable();
    }
}

// Infrastructure/Testing/FakeClock.php
class FakeClock implements ClockInterface
{
    private DateTimeImmutable $frozenTime;

    public function now(): DateTimeImmutable
    {
        return $this->frozenTime;
    }
}
```

**Why?**
- Tests can freeze time
- Swap implementations (UTC, timezone-aware, etc.)
- No `new DateTimeImmutable()` in domain

### Port 2: IdGeneratorInterface

**Purpose:** Abstract UUID generation

```php
interface IdGeneratorInterface
{
    public function generate(): string;
}
```

**Why?**
- Tests can use predictable IDs
- Can swap UUID libraries
- No `Str::uuid()` in domain

### Port 3: QRCodeGeneratorInterface

**Purpose:** Abstract QR code creation

```php
interface QRCodeGeneratorInterface
{
    public function generate(string $data): string;
}
```

**Why?**
- Tests can skip actual QR generation
- Can swap QR libraries
- Can add different formats later

### Port 4: ModuleAccessInterface

**Purpose:** Abstract ModuleRegistry communication (Phase 1.3)

```php
interface ModuleAccessInterface
{
    public function ensureCanPerform(string $tenantId, string $action): void;
    public function canPerform(string $tenantId, string $action): bool;
    public function getQuota(string $tenantId): array;
    public function ensureWithinQuota(string $tenantId): void;
}
```

**Why?**
- Tests don't need real ModuleRegistry
- Can swap subscription systems
- Enforces subscription & quota rules

### Port 5: TenantContextInterface

**Purpose:** Abstract multi-tenancy

```php
interface TenantContextInterface
{
    public function currentTenantId(): ?string;
    public function hasTenant(): bool;
    public function getTenantProperty(string $key): mixed;
}
```

**Why?**
- Tests can set tenant context
- No Spatie dependency in domain
- Can swap tenancy systems

### Port 6: EventPublisherInterface

**Purpose:** Abstract event dispatching

```php
interface EventPublisherInterface
{
    public function publish(object $event): void;
}
```

**Why?**
- Tests can track events without listeners
- Can swap event systems
- No `event()` helper in domain

---

## Dependency Rules (CRITICAL)

```
Domain ──────> (nothing)
   ↑
   │
Application ──> Domain (via interfaces)
   ↑
   │
Infrastructure ──> Application + Domain (implements interfaces)
```

### Allowed Dependencies

✅ **Domain → Domain**
- Entities can use Value Objects
- Aggregates can use Events

✅ **Application → Domain**
- Handlers use Aggregates
- Handlers use Ports (interfaces)

✅ **Infrastructure → Domain**
- Adapters implement Ports

✅ **Infrastructure → Application**
- ServiceProvider registers Handlers

### FORBIDDEN Dependencies

❌ **Domain → Application**
❌ **Domain → Infrastructure**
❌ **Domain → Framework**
❌ **Application → Infrastructure**

---

## How It All Connects (ServiceProvider)

The `DigitalCardServiceProvider` wires everything together:

```php
class DigitalCardServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Port 1: Clock
        $this->app->bind(ClockInterface::class, LaravelClock::class);

        // Port 2: IdGenerator
        $this->app->bind(IdGeneratorInterface::class, LaravelIdGenerator::class);

        // Port 3: QRCodeGenerator
        $this->app->bind(QRCodeGeneratorInterface::class, LaravelQRCodeGenerator::class);

        // Port 4: ModuleAccess (with config)
        $this->app->bind(ModuleAccessInterface::class, function ($app) {
            return new ModuleRegistryAdapter(
                config('services.module_registry.url')
            );
        });

        // Port 5: TenantContext
        $this->app->bind(TenantContextInterface::class, SpatieTenantContextAdapter::class);

        // Port 6: EventPublisher
        $this->app->bind(EventPublisherInterface::class, LaravelEventPublisher::class);
    }
}
```

**How Laravel's DI Container Uses This:**

1. Controller requests `IssueCardHandler`
2. Laravel sees handler needs `ClockInterface`
3. Laravel looks up binding: `ClockInterface → LaravelClock`
4. Laravel instantiates `LaravelClock`
5. Laravel injects it into handler

**For Testing:**

1. Test manually creates handler
2. Test injects `FakeClock` instead
3. Domain code works identically
4. Test has full control

---

## Design Decisions

### Why Hexagonal Architecture?

**Decision:** Use Hexagonal Architecture instead of traditional layered architecture

**Reasons:**
1. **Framework Independence** - Can replace Laravel without touching domain
2. **Testability** - 100% unit test coverage without database
3. **Flexibility** - Swap implementations (Redis cache, S3 storage, etc.)
4. **Clarity** - Clear boundaries between business logic and infrastructure
5. **Longevity** - Business rules survive framework changes

### Why Domain Events?

**Decision:** Publish domain events after state changes

**Reasons:**
1. **Loose Coupling** - Other contexts can react without tight coupling
2. **Audit Trail** - All state changes are recorded
3. **Event Sourcing Ready** - Can add event sourcing later
4. **Observable** - External systems can listen

### Why Value Objects?

**Decision:** Use Value Objects instead of primitives

**Reasons:**
1. **Type Safety** - `CardId` is not just a string
2. **Validation** - Business rules enforced at construction
3. **Immutability** - Cannot accidentally change
4. **Self-Documenting** - Clear what each field represents

### Why Readonly Classes?

**Decision:** Use PHP 8.2+ `readonly` keyword extensively

**Reasons:**
1. **Immutability** - State cannot change after construction
2. **Thread Safety** - Safe for concurrent access
3. **Predictability** - Easier to reason about
4. **Performance** - PHP optimizes readonly properties

---

## Multi-Tenancy Integration

The DigitalCard Context is **tenant-aware**:

### Tenant Isolation

1. **Every card belongs to ONE tenant**
2. **Repository enforces tenant filtering**
3. **TenantContextInterface provides current tenant**
4. **No cross-tenant access allowed**

### Implementation

```php
// Handler validates tenant context
$tenantId = $this->tenantContext->currentTenantId();
if ($tenantId === null) {
    throw new \DomainException('Tenant context required');
}

// Repository filters by tenant
$card = $this->repository->findForTenant(
    CardId::fromString($cardId),
    $tenantId
);
```

---

## Phase 1.3: ModuleRegistry Integration

The DigitalCard Context integrates with ModuleRegistry for:

### Subscription Enforcement

Before issuing cards:

```php
$this->moduleAccess->ensureCanPerform($tenantId, 'cards.create');
```

Throws `SubscriptionRequiredException` if tenant lacks subscription.

### Quota Enforcement

Before issuing cards:

```php
$this->moduleAccess->ensureWithinQuota($tenantId);
```

Throws `QuotaExceededException` if tenant exceeded limit.

### Configuration

Set in `.env`:

```env
MODULE_REGISTRY_URL=http://module-registry.test
```

Or override in `config/services.php`.

---

## Next Steps

Now that you understand the architecture:

1. Read [Domain Layer Guide](02_DOMAIN_LAYER.md) to understand entities and value objects
2. Read [Ports & Adapters](03_PORTS_AND_ADAPTERS.md) to see all port details
3. Read [How to Use](05_HOW_TO_USE.md) for practical examples
