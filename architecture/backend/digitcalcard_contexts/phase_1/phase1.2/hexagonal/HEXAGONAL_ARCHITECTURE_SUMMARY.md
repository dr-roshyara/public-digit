# **HEXAGONAL ARCHITECTURE REFACTORING - SUMMARY & QUICK START**

**Date:** 2025-12-27  
**Objective:** Make DigitalCard Context framework-independent through Ports & Adapters  
**Duration:** 2-3 days (BEFORE Phase 1)  
**Investment Value:** Saves weeks of refactoring, enables framework swappability

---

## **THE PROBLEM YOU'RE SOLVING**

### **Current State (DDD but not Hexagonal)**
```
❌ Domain imports: Illuminate\Support\Str::uuid()
❌ Application layer: Coupled to Laravel/Spatie directly
❌ Testing: Cannot test without framework bootstrap
❌ Swappability: Changing from Spatie→Laravel Tenancy requires massive refactoring
```

### **After Refactoring (True Hexagonal)**
```
✅ Domain: Zero framework dependencies (pure PHP)
✅ Application: Depends only on Ports (interfaces)
✅ Testing: Use fake implementations, no framework needed
✅ Swappability: Change adapter in ONE line, business logic unchanged
```

---

## **CORE CONCEPT: PORTS & ADAPTERS**

### **What are Ports?**
Interfaces/contracts that abstract external dependencies:
- `Clock` - time operations
- `IdGenerator` - UUID generation
- `QRCodeGenerator` - QR code creation
- `TenantContext` - current tenant info
- `TenantConnectionSwitcher` - database switching
- `EventPublisher` - event publishing

### **What are Adapters?**
Implementations that provide framework-specific behavior:
- `LaravelClock` - time using Laravel/PHP
- `RandomIdGenerator` - pure PHP UUID generation
- `SimpleQRCodeGenerator` - endroid/qr-code implementation
- `SpatieTenantContext` - Spatie-specific tenant context
- `SpatieTenantConnectionSwitcher` - Spatie database switching
- `LaravelEventPublisher` - Laravel event dispatcher

### **The Magic**
```php
// Handler depends on PORT (interface):
public function __construct(private Clock $clock) {}

// You can inject ANY adapter that implements Clock:
$handler = new Handler(new LaravelClock());      // Production
$handler = new Handler(new FakeClock());          // Testing
$handler = new Handler(new SymfonyClock());       // Future

// Business logic is unchanged. Adapters are swappable!
```

---

## **ARCHITECTURE BEFORE & AFTER**

### **BEFORE (Current)**
```
┌──────────────────────────────┐
│  DigitalCard Handlers        │
│  (depends on)                │
│  ↓↓↓↓↓                       │
│  Laravel, Spatie, Eloquent   │
│  (Framework coupled)         │
└──────────────────────────────┘
```

### **AFTER (Hexagonal)**
```
┌──────────────────────────────┐
│  DigitalCard Handlers        │
│  (depends on)                │
│  ↓↓↓↓↓                       │
│  Clock, TenantContext, etc.  │
│  (Port interfaces)           │
│  ↓↓↓↓↓                       │
│  LaravelClock, Spatie...     │
│  (Adapter implementations)   │
│  (Framework specific)        │
└──────────────────────────────┘
```

---

## **STEP-BY-STEP IMPLEMENTATION**

### **Day 1: Create Ports (6-8 hours)**

Create 6 core port interfaces in `app/Contexts/Shared/Contracts/`:

```
app/Contexts/Shared/Contracts/
├── System/
│   ├── Clock.php              (interface)
│   └── IdGenerator.php        (interface)
├── Media/
│   └── QRCodeGenerator.php    (interface)
├── Tenancy/
│   ├── TenantContext.php      (interface)
│   └── TenantConnectionSwitcher.php (interface)
└── Events/
    └── EventPublisher.php     (interface)
```

Then create adapters in `app/Infrastructure/Adapters/`:

```
app/Infrastructure/Adapters/
├── LaravelClock.php
├── RandomIdGenerator.php
├── SimpleQRCodeGenerator.php
├── SpatieTenantContext.php
├── SpatieTenantConnectionSwitcher.php
└── LaravelEventPublisher.php
```

### **Day 2: Refactor Code (6-8 hours)**

Update handlers to use ports instead of framework:

```php
// BEFORE:
public function __construct(private DigitalCardRepository $repo) {}

// AFTER:
public function __construct(
    private DigitalCardRepository $repo,
    private Clock $clock,                    // Port
    private QRCodeGenerator $qrGenerator,   // Port
    private EventPublisher $eventPublisher, // Port
) {}
```

Remove framework imports from Domain layer:

```php
// BEFORE:
use Illuminate\Support\Str;
$id = Str::uuid();

// AFTER (pure PHP):
private static function generateUuid(): string {
    $data = random_bytes(16);
    // ... pure PHP implementation
}
```

### **Day 3: Create Fakes & Test (4-6 hours)**

Create fake implementations for testing:

```php
// tests/Doubles/Fakes/FakeClock.php
class FakeClock implements Clock {
    private ?DateTimeImmutable $fixedTime = null;
    
    public function fixTime(DateTimeImmutable $time): void {
        $this->fixedTime = $time;
    }
    
    public function now(): DateTimeImmutable {
        return $this->fixedTime ?? new DateTimeImmutable();
    }
}
```

Test with fakes - no framework bootstrap:

```php
// Unit test with fakes
$clock = new FakeClock();
$clock->fixTime(new DateTimeImmutable('2024-01-01'));
$handler = new IssueCardHandler($repo, $clock, ...);
$card = $handler->handle($command);
// No framework needed!
```

---

## **KEY BENEFITS UNLOCKED**

### **1. Framework Swappability** ⚡

**Scenario: Switch from Spatie to Laravel Tenancy**

```php
// Create ONE new adapter:
class LaravelTenancyContext implements TenantContext {
    // Implementation using Laravel Tenancy
}

// Update ServiceProvider (one line):
$this->app->bind(
    TenantContext::class,
    LaravelTenancyContext::class  // ← This is the ONLY change
);

// Result: ALL business logic works unchanged!
//         No refactoring of handlers, entities, or domain logic needed!
```

### **2. True Unit Testing** 🧪

```php
// Test with fake implementations - no framework bootstrap
$fakeClock = new FakeClock();
$fakeQR = new FakeQRCodeGenerator();
$fakeEvents = new FakeEventPublisher();

$handler = new IssueCardHandler(
    $mockRepository,
    $fakeClock,
    $fakeQR,
    $fakeEvents,
    $mockFeatureGate
);

$result = $handler->handle($command);

// Assertions:
expect($fakeQR->wasGenerated($memberId))->toBeTrue();
expect($fakeEvents->wasPublished(CardIssued::class))->toBeTrue();
```

### **3. Clear Boundaries** 🎯

```
DOMAIN LAYER:           Pure business logic, NO framework
APPLICATION LAYER:      Use cases, depends ONLY on Ports
PORTS LAYER:           Abstractions for external systems
ADAPTERS LAYER:        Framework/package implementations
```

### **4. Package Independence** 📦

You can change:
- QR library (endroid → Google Charts)
- Event system (Laravel → custom queue)
- Tenancy (Spatie → Laravel Tenancy)
- Database (PostgreSQL → MySQL)

**Without touching business logic.**

---

## **FILE YOU'LL USE**

### **HEXAGONAL_ARCHITECTURE_REFACTORING_PROMPT.md** (Main)

This is your complete refactoring guide with:
- All port interfaces (6 core contracts)
- All adapter implementations
- Refactored handlers using ports
- Fake implementations for testing
- Updated service provider
- Full test examples
- Implementation checklist
- Verification steps

**Usage:** Copy entire file → Paste into Claude → Follow instructions

---

## **SUCCESS CRITERIA**

By end of Day 3, verify:

✅ **Domain Layer**
- Zero `use Illuminate\` statements
- Zero `use Spatie\` statements
- All dependencies are interfaces
- Pure PHP UUID generation works

✅ **Application Layer**
- All handlers depend on ports only
- No direct framework class references
- Clean dependency injection

✅ **Testing**
- Unit tests pass without framework
- Fakes can be injected
- 90%+ coverage maintained

✅ **Swappability**
- Can create alternate adapter without changing handlers
- Service provider binding is the only change point

---

## **QUICK REFERENCE: The 6 Core Ports**

```php
// 1. CLOCK - Time abstraction
interface Clock {
    public function now(): DateTimeImmutable;
    public function today(): DateTimeImmutable;
}

// 2. ID GENERATOR - UUID generation
interface IdGenerator {
    public function uuid(): string;
    public function randomString(int $length): string;
}

// 3. QR CODE GENERATOR - QR creation
interface QRCodeGenerator {
    public function generate(string $memberId): string;
}

// 4. TENANT CONTEXT - Current tenant
interface TenantContext {
    public function getTenantId(): string;
    public function getTenantSlug(): string;
    public function isValid(): bool;
}

// 5. TENANT CONNECTION SWITCHER - DB switching
interface TenantConnectionSwitcher {
    public function switchToTenant(string $tenantId): void;
    public function switchToLandlord(): void;
    public function forTenant(string $tenantId, callable $callback): mixed;
}

// 6. EVENT PUBLISHER - Event publishing
interface EventPublisher {
    public function publish(object $event): void;
    public function publishMany(array $events): void;
}
```

---

## **IMMEDIATE ACTION PLAN**

### **Tomorrow Morning:**
1. Read: **HEXAGONAL_ARCHITECTURE_REFACTORING_PROMPT.md** (Sections 1-5)
2. Understand: The ports you need to create (Section 2)
3. Prepare: Create the 6 interface files

### **Day 1:**
1. Create all port interfaces (6 files)
2. Create all adapter implementations (6 files)
3. Update ServiceProvider with bindings
4. Verify all tests still pass

### **Day 2:**
1. Refactor handlers to use ports
2. Remove framework dependencies from domain
3. Run all tests
4. Verify zero framework imports in domain

### **Day 3:**
1. Create fake implementations
2. Write new unit tests with fakes
3. Verify 90%+ coverage
4. Final verification of swappability

---

## **WHY DO THIS BEFORE PHASE 1?**

If you implement Hexagonal Architecture NOW:
- ✅ Phase 1 built from day one with ports
- ✅ No refactoring needed mid-Phase 1
- ✅ Clear boundaries from the start
- ✅ Easier for team to understand

If you skip this and do Phase 1 first:
- ❌ Phase 1 code couples to framework
- ❌ Refactoring required later (2-3 weeks)
- ❌ More complex testing
- ❌ Harder to swap packages later

**2-3 day investment now = Saves weeks later**

---

## **READING ORDER**

1. **This file** (2 min) - Overview
2. **20251227_1506_phase1_hexagonal_architecture.md** (10 min) - Analysis
3. **HEXAGONAL_ARCHITECTURE_REFACTORING_PROMPT.md** (30 min reading) - Full implementation guide
4. **Start implementation** - Follow the 3-day checklist

---

## **QUESTIONS ANSWERED**

**Q: Why is this important?**
A: Enables framework swappability, true testability, and clear architecture.

**Q: Will existing tests break?**
A: No. Tests remain compatible, and you add new unit tests with fakes.

**Q: How long does this take?**
A: 2-3 days (before Phase 1 starts).

**Q: Do I need to redo Phase 0.1?**
A: No. Phase 0.1 (Subscription) doesn't need refactoring. Focus on DigitalCard Context.

**Q: Can I do this during Phase 1?**
A: Technically yes, but it will slow Phase 1. Better to do it now.

**Q: What if I don't do this?**
A: You'll end up refactoring when you want to switch packages or frameworks later (3-4 weeks of work).

---

## **FINAL THOUGHTS**

This is **professional-grade architecture work** that:
- ✅ Makes business logic portable
- ✅ Enables easy testing
- ✅ Allows package/framework swapping
- ✅ Establishes team standards
- ✅ Prevents future refactoring

**2-3 days now = Weeks saved later**

---

**Status:** Ready to implement tomorrow ✅

**Next:** Read `HEXAGONAL_ARCHITECTURE_REFACTORING_PROMPT.md` and start creating ports on Day 1.

