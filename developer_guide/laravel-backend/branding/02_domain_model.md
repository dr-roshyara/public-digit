# Domain Model Documentation

**Document Version:** 1.0
**Last Updated:** 2026-01-06

---

## 📋 Overview

The Platform Branding domain model consists of:

- **1 Aggregate Root:** `TenantBranding`
- **5 Value Objects:** `BrandingBundle`, `BrandingVisuals`, `BrandingContent`, `BrandingIdentity`, `BrandingColor`
- **1 Repository Interface:** `TenantBrandingRepositoryInterface`
- **2 Domain Events:** `TenantBrandingCreated`, `TenantBrandingUpdated`
- **1 Domain Exception:** `InvalidBrandingException`

All domain code is **pure PHP** with **zero framework dependencies**.

---

## 🏗️ Aggregate Root: TenantBranding

**Location:** `app/Contexts/Platform/Domain/Entities/TenantBranding.php`

### Purpose

The `TenantBranding` entity is the **Aggregate Root** responsible for:
- Maintaining branding consistency
- Enforcing business rules
- Publishing domain events
- Controlling access to branding state

### Class Structure

```php
final class TenantBranding
{
    private array $domainEvents = [];

    private function __construct(
        private TenantId $tenantId,
        private BrandingBundle $branding,
        private ?DateTimeImmutable $createdAt = null,
        private ?DateTimeImmutable $updatedAt = null
    ) {}

    // Factory methods
    public static function create(TenantId $tenantId, BrandingBundle $branding): self;
    public static function reconstitute(...): self; // For repository

    // Business operations
    public function updateBranding(BrandingBundle $newBranding): void;

    // Queries
    public function getTenantId(): TenantId;
    public function getBranding(): BrandingBundle;
    public function getCreatedAt(): ?DateTimeImmutable;
    public function getUpdatedAt(): ?DateTimeImmutable;

    // Domain events
    public function getDomainEvents(): array;
    public function clearDomainEvents(): void;
}
```

### Factory Methods

**1. create() - For New Branding**

```php
$tenantId = TenantId::fromSlug('nrna');
$bundle = BrandingBundle::defaults();

$branding = TenantBranding::create($tenantId, $bundle);
// Publishes: TenantBrandingCreated event
```

**2. reconstitute() - For Repository**

```php
// Used by repository to recreate entity from database
$branding = TenantBranding::reconstitute(
    tenantId: $tenantId,
    branding: $bundle,
    createdAt: $createdAt,
    updatedAt: $updatedAt
);
// No events published (already exists in DB)
```

### Business Operations

**updateBranding()**

```php
$newBundle = $branding->getBranding()->withVisuals($newVisuals);
$branding->updateBranding($newBundle);
// Publishes: TenantBrandingUpdated event
```

**Rules Enforced:**
- Cannot update to null branding
- Automatically sets `updatedAt` timestamp
- Records domain event for audit trail

---

## 🎨 Value Object: BrandingBundle

**Location:** `app/Contexts/Platform/Domain/ValueObjects/BrandingBundle.php`

### Purpose

Composite Value Object that combines all branding aspects into a cohesive unit.

### Structure

```php
final class BrandingBundle
{
    private function __construct(
        private readonly BrandingVisuals $visuals,
        private readonly BrandingContent $content,
        private readonly BrandingIdentity $identity
    ) {}

    public static function create(
        BrandingVisuals $visuals,
        BrandingContent $content,
        BrandingIdentity $identity
    ): self;

    public static function defaults(): self;
    public static function fromArray(array $data): self;

    // Getters
    public function getVisuals(): BrandingVisuals;
    public function getContent(): BrandingContent;
    public function getIdentity(): BrandingIdentity;

    // Immutable updates
    public function withVisuals(BrandingVisuals $visuals): self;
    public function withContent(BrandingContent $content): self;
    public function withIdentity(BrandingIdentity $identity): self;

    // Validation
    public function isComplete(): bool;
    public function isWcagCompliant(): bool;

    // Conversion
    public function toArray(): array;
}
```

### Usage Examples

**Creating Default Bundle:**

```php
$bundle = BrandingBundle::defaults();
// Uses sensible defaults for all fields
```

**Creating Custom Bundle:**

```php
$visuals = BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#1976D2'),
    secondaryColor: BrandingColor::fromString('#2E7D32'),
    logoUrl: 'https://example.com/logo.png'
);

$content = BrandingContent::create(
    welcomeMessage: 'Welcome to our platform',
    heroTitle: 'Vote Today',
    heroSubtitle: 'Make your voice heard',
    ctaText: 'Get Started'
);

$identity = BrandingIdentity::create(
    organizationName: 'Election Commission',
    organizationTagline: 'Democracy First'
);

$bundle = BrandingBundle::create($visuals, $content, $identity);
```

**Immutable Updates:**

```php
$original = BrandingBundle::defaults();

$newVisuals = BrandingVisuals::create(/*...*/);
$updated = $original->withVisuals($newVisuals);

// $original unchanged, $updated is new instance
$original !== $updated; // true
```

**Validation:**

```php
// Check if all required fields are present
$bundle->isComplete(); // true

// Check WCAG color contrast compliance
$bundle->isWcagCompliant(); // true/false
```

---

## 🖼️ Value Object: BrandingVisuals

**Location:** `app/Contexts/Platform/Domain/ValueObjects/BrandingVisuals.php`

### Purpose

Encapsulates visual branding elements (colors, logos, fonts).

### Structure

```php
final class BrandingVisuals
{
    private function __construct(
        private readonly BrandingColor $primaryColor,
        private readonly BrandingColor $secondaryColor,
        private readonly ?string $logoUrl,
        private readonly string $fontFamily
    ) {
        $this->validateLogoUrl($logoUrl);
        $this->validateFontFamily($fontFamily);
    }

    public static function create(
        BrandingColor $primaryColor,
        BrandingColor $secondaryColor,
        ?string $logoUrl = null,
        string $fontFamily = 'Inter, system-ui, sans-serif'
    ): self;

    public static function defaults(): self;

    // Getters
    public function getPrimaryColor(): BrandingColor;
    public function getSecondaryColor(): BrandingColor;
    public function getLogoUrl(): ?string;
    public function getFontFamily(): string;

    // Validation
    public function isWcagCompliant(): bool;

    // Conversion
    public function toArray(): array;
}
```

### Validation Rules

**Logo URL:**
- Optional (can be null)
- Must be valid URL if provided
- Maximum length: 500 characters

**Font Family:**
- Required
- Maximum length: 255 characters
- Defaults to: `'Inter, system-ui, sans-serif'`

**Colors:**
- Validated by `BrandingColor` Value Object
- Must be hex format: `#RRGGBB`

### WCAG Compliance

```php
$visuals = BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#1976D2'), // Blue
    secondaryColor: BrandingColor::fromString('#2E7D32')  // Green
);

$visuals->isWcagCompliant(); // true (good contrast)

$visuals = BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#FFEB3B'), // Light yellow
    secondaryColor: BrandingColor::fromString('#FFF176')  // Light yellow
);

$visuals->isWcagCompliant(); // false (poor contrast)
```

---

## 📝 Value Object: BrandingContent

**Location:** `app/Contexts/Platform/Domain/ValueObjects/BrandingContent.php`

### Purpose

Encapsulates textual content for landing pages and user-facing messages.

### Structure

```php
final class BrandingContent
{
    private function __construct(
        private readonly string $welcomeMessage,
        private readonly string $heroTitle,
        private readonly string $heroSubtitle,
        private readonly string $ctaText
    ) {
        $this->validateWelcomeMessage($welcomeMessage);
        $this->validateHeroTitle($heroTitle);
        $this->validateHeroSubtitle($heroSubtitle);
        $this->validateCtaText($ctaText);
    }

    public static function create(
        string $welcomeMessage,
        string $heroTitle,
        string $heroSubtitle,
        string $ctaText
    ): self;

    public static function defaults(): self;

    // Getters
    public function getWelcomeMessage(): string;
    public function getHeroTitle(): string;
    public function getHeroSubtitle(): string;
    public function getCtaText(): string;

    // Conversion
    public function toArray(): array;
}
```

### Validation Rules

| Field | Max Length | Required | Default |
|-------|-----------|----------|---------|
| `welcomeMessage` | 200 chars | Yes | "Welcome to our election platform" |
| `heroTitle` | 100 chars | Yes | "Democracy in Action" |
| `heroSubtitle` | 200 chars | Yes | "Participate, vote, and make your voice heard" |
| `ctaText` | 100 chars | Yes | "Get Started" |

**All fields:**
- Cannot be empty
- Automatically trimmed
- Maximum lengths enforced

### Example

```php
$content = BrandingContent::create(
    welcomeMessage: 'Welcome to NRNA Elections 2026',
    heroTitle: 'Your Vote Matters',
    heroSubtitle: 'Join thousands of members in shaping our future',
    ctaText: 'Vote Now'
);

// ❌ Throws InvalidBrandingException
$content = BrandingContent::create(
    welcomeMessage: '', // Empty not allowed
    heroTitle: str_repeat('a', 101), // Too long
    heroSubtitle: 'Valid',
    ctaText: 'Vote'
);
```

---

## 🏢 Value Object: BrandingIdentity

**Location:** `app/Contexts/Platform/Domain/ValueObjects/BrandingIdentity.php`

### Purpose

Encapsulates organizational identity (name, tagline, favicon).

### Structure

```php
final class BrandingIdentity
{
    private function __construct(
        private readonly string $organizationName,
        private readonly string $organizationTagline,
        private readonly ?string $faviconUrl = null
    ) {
        $this->validateOrganizationName($organizationName);
        $this->validateOrganizationTagline($organizationTagline);
        if ($faviconUrl !== null) {
            $this->validateFaviconUrl($faviconUrl);
        }
    }

    public static function create(
        string $organizationName,
        string $organizationTagline,
        ?string $faviconUrl = null
    ): self;

    public static function defaults(): self;

    // Getters
    public function getOrganizationName(): string;
    public function getOrganizationTagline(): string;
    public function getFaviconUrl(): ?string;

    // Conversion
    public function toArray(): array;
}
```

### Validation Rules

| Field | Max Length | Required | Default |
|-------|-----------|----------|---------|
| `organizationName` | 100 chars | Yes | "Election Platform" |
| `organizationTagline` | 150 chars | Yes | "Making democracy accessible to everyone" |
| `faviconUrl` | 500 chars | No | `null` |

**organizationName & organizationTagline:**
- Cannot be empty
- Automatically trimmed
- Must not exceed maximum length

**faviconUrl:**
- Optional (can be null)
- Must be valid URL if provided
- Must not exceed 500 characters

### Key Architectural Note

**Field Naming:** `organizationTagline` (Domain) vs `tagline` (Database)

```php
// Domain model uses expressive naming
$identity = BrandingIdentity::create(
    organizationName: 'NRNA',
    organizationTagline: 'Connecting Nepalis Worldwide' // ✅ Clear
);

// Database column is concise
// Column: 'tagline'

// Repository maps between them
```

### Example

```php
$identity = BrandingIdentity::create(
    organizationName: 'National Election Commission',
    organizationTagline: 'Building Democracy Together',
    faviconUrl: 'https://cdn.example.com/favicon.ico'
);

// Access
$identity->getOrganizationName(); // "National Election Commission"
$identity->getOrganizationTagline(); // "Building Democracy Together"
$identity->getFaviconUrl(); // "https://cdn.example.com/favicon.ico"

// ❌ Throws InvalidBrandingException
$identity = BrandingIdentity::create(
    organizationName: str_repeat('a', 101), // Too long
    organizationTagline: 'Valid tagline'
);
```

---

## 🎨 Value Object: BrandingColor

**Location:** `app/Contexts/Platform/Domain/ValueObjects/BrandingColor.php`

### Purpose

Ensures all colors are valid hex format and provides color manipulation utilities.

### Structure

```php
final class BrandingColor
{
    private function __construct(
        private readonly string $value
    ) {
        $this->validate();
    }

    public static function fromString(string $color): self;
    public static function defaults(): array; // [primary, secondary]

    public function toString(): string;
    public function toRgb(): array;
    public function equals(self $other): bool;

    // WCAG utilities
    public function getContrastRatio(self $other): float;
    public function isWcagCompliantWith(self $other): bool;
}
```

### Validation Rules

**Format:** Must match `/^#[0-9A-Fa-f]{6}$/`

**Examples:**
- ✅ `#1976D2` (Material Blue)
- ✅ `#2E7D32` (Material Green)
- ✅ `#FFFFFF` (White)
- ❌ `#FFF` (Too short)
- ❌ `rgb(25, 118, 210)` (Not hex)
- ❌ `blue` (Not hex)

### Color Manipulation

**RGB Conversion:**

```php
$color = BrandingColor::fromString('#1976D2');
$rgb = $color->toRgb();
// ['r' => 25, 'g' => 118, 'b' => 210]
```

**Equality:**

```php
$color1 = BrandingColor::fromString('#1976D2');
$color2 = BrandingColor::fromString('#1976d2'); // Case insensitive
$color1->equals($color2); // true
```

**WCAG Contrast:**

```php
$primary = BrandingColor::fromString('#1976D2'); // Blue
$secondary = BrandingColor::fromString('#FFFFFF'); // White

$ratio = $primary->getContrastRatio($secondary); // ~4.5

$isCompliant = $primary->isWcagCompliantWith($secondary);
// true if ratio >= 4.5 (WCAG AA)
```

### Default Colors

```php
[$primary, $secondary] = BrandingColor::defaults();

$primary->toString(); // '#1976D2' (Material Blue 700)
$secondary->toString(); // '#2E7D32' (Material Green 700)
```

---

## 🔄 Repository Interface

**Location:** `app/Contexts/Platform/Domain/Repositories/TenantBrandingRepositoryInterface.php`

### Purpose

Defines domain contract for persisting and retrieving `TenantBranding` aggregates.

### Interface

```php
interface TenantBrandingRepositoryInterface
{
    /**
     * Find branding for a specific tenant
     */
    public function findForTenant(TenantId $tenantId): ?TenantBranding;

    /**
     * Save branding for a tenant (create or update)
     */
    public function saveForTenant(TenantBranding $branding): void;

    /**
     * Check if branding exists for tenant
     */
    public function existsForTenant(TenantId $tenantId): bool;

    /**
     * Delete branding for tenant (idempotent)
     */
    public function deleteForTenant(TenantId $tenantId): void;
}
```

### ForTenant Pattern

**All methods include tenant context explicitly:**

```php
// ✅ CORRECT: Tenant-scoped
$repository->findForTenant($tenantId);
$repository->saveForTenant($branding);
$repository->existsForTenant($tenantId);
$repository->deleteForTenant($tenantId);

// ❌ WRONG: Tenant-agnostic methods don't exist
$repository->find($id); // Method doesn't exist
$repository->findAll(); // Method doesn't exist
$repository->save($branding); // Method doesn't exist
```

**Why This Matters:**
- Forces developers to think about tenant context
- Prevents accidental cross-tenant data access
- Makes tenant isolation explicit in code
- Impossible to forget tenant filtering

### Usage

**Find:**

```php
$tenantId = TenantId::fromSlug('nrna');
$branding = $repository->findForTenant($tenantId);

if ($branding === null) {
    // No branding configured for this tenant
    $branding = TenantBranding::create($tenantId, BrandingBundle::defaults());
}
```

**Save:**

```php
$repository->saveForTenant($branding);
// Handles both create and update automatically
```

**Exists:**

```php
if ($repository->existsForTenant($tenantId)) {
    // Branding already configured
} else {
    // Need to create branding
}
```

**Delete:**

```php
$repository->deleteForTenant($tenantId);
// Idempotent: safe to call even if branding doesn't exist
```

---

## 📢 Domain Events

### TenantBrandingCreated

**Location:** `app/Contexts/Platform/Domain/Events/TenantBrandingCreated.php`

```php
final class TenantBrandingCreated
{
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly DateTimeImmutable $occurredAt
    ) {}
}
```

**Published When:** New branding is created via `TenantBranding::create()`

**Use Cases:**
- Audit logging
- Analytics tracking
- Welcome email notification
- Cache warming

### TenantBrandingUpdated

**Location:** `app/Contexts/Platform/Domain/Events/TenantBrandingUpdated.php`

```php
final class TenantBrandingUpdated
{
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly DateTimeImmutable $occurredAt
    ) {}
}
```

**Published When:** Branding is updated via `updateBranding()`

**Use Cases:**
- Audit logging
- Cache invalidation
- CDN purge
- Platform admin notification

### Event Handling

**Current Implementation:**

```php
// Events are collected but not dispatched (future enhancement)
$events = $branding->getDomainEvents();
// [TenantBrandingCreated, TenantBrandingUpdated]

$branding->clearDomainEvents();
```

**Future Implementation (Application Layer):**

```php
class UpdateTenantBrandingHandler
{
    public function handle(UpdateTenantBrandingCommand $command): void
    {
        $branding = $this->repository->findForTenant($command->tenantId);
        $branding->updateBranding($command->newBranding);

        $this->repository->saveForTenant($branding);

        // Dispatch events
        foreach ($branding->getDomainEvents() as $event) {
            $this->eventDispatcher->dispatch($event);
        }

        $branding->clearDomainEvents();
    }
}
```

---

## ⚠️ Domain Exceptions

### InvalidBrandingException

**Location:** `app/Contexts/Platform/Domain/Exceptions/InvalidBrandingException.php`

```php
final class InvalidBrandingException extends DomainException
{
    public static function invalidColor(string $color): self;
    public static function contentTooLong(string $field, int $max, int $actual): self;
    public static function requiredFieldMissing(string $field): self;
    public static function invalidFormat(string $field, string $reason): self;
}
```

### Exception Types

**1. Invalid Color:**

```php
BrandingColor::fromString('invalid');
// InvalidBrandingException: "Invalid color format: 'invalid'. Expected hex format like #1976D2"
```

**2. Content Too Long:**

```php
BrandingIdentity::create(
    organizationName: str_repeat('a', 101),
    organizationTagline: 'Valid'
);
// InvalidBrandingException: "Organization Name exceeds maximum length of 100 characters (actual: 101)"
```

**3. Required Field Missing:**

```php
BrandingContent::create(
    welcomeMessage: '',
    heroTitle: 'Valid',
    heroSubtitle: 'Valid',
    ctaText: 'Valid'
);
// InvalidBrandingException: "Required field \"Welcome Message\" is missing or empty"
```

**4. Invalid Format:**

```php
BrandingIdentity::create(
    organizationName: 'Valid',
    organizationTagline: 'Valid',
    faviconUrl: 'not-a-url'
);
// InvalidBrandingException: "Invalid Favicon URL format: Must be a valid URL"
```

---

## 🧪 Testing the Domain Model

### Unit Test Strategy

**All domain tests are pure PHP unit tests:**
- No database required
- No Laravel framework required
- Fast execution (milliseconds)
- 100% coverage

### Test Organization

```
tests/Unit/Contexts/Platform/Domain/
├── Entities/
│   └── TenantBrandingTest.php (11 tests)
├── ValueObjects/
│   ├── BrandingColorTest.php (14 tests)
│   ├── BrandingVisualsTest.php (13 tests)
│   ├── BrandingContentTest.php (14 tests)
│   ├── BrandingIdentityTest.php (15 tests)
│   └── BrandingBundleTest.php (13 tests)
```

### Example Test

```php
/** @test */
public function it_enforces_organization_name_max_length()
{
    $this->expectException(InvalidBrandingException::class);
    $this->expectExceptionMessage('exceeds maximum length of 100 characters');

    $longName = str_repeat('a', 101);

    BrandingIdentity::create(
        organizationName: $longName,
        organizationTagline: 'Valid Tagline'
    );
}
```

### Running Domain Tests

```bash
# All domain tests
php artisan test tests/Unit/Contexts/Platform/Domain/

# Specific Value Object
php artisan test tests/Unit/Contexts/Platform/Domain/ValueObjects/BrandingIdentityTest

# Specific test method
php artisan test --filter=it_enforces_organization_name_max_length
```

---

## 📊 Domain Model Metrics

**Entities:** 1 (TenantBranding)
**Value Objects:** 5 (Bundle, Visuals, Content, Identity, Color)
**Repository Interfaces:** 1
**Domain Events:** 2
**Domain Exceptions:** 1

**Test Coverage:** 100% (80/80 domain tests passing)
**Lines of Code:** ~800 LOC
**Framework Dependencies:** 0

---

## 🎯 Best Practices

### DO ✅

1. **Use Factory Methods**
   ```php
   $branding = TenantBranding::create($tenantId, $bundle);
   ```

2. **Use Value Objects**
   ```php
   $color = BrandingColor::fromString('#1976D2');
   ```

3. **Use Immutable Updates**
   ```php
   $updated = $bundle->withVisuals($newVisuals);
   ```

4. **Handle Null Returns**
   ```php
   $branding = $repository->findForTenant($tenantId);
   if ($branding === null) {
       // Handle missing branding
   }
   ```

### DON'T ❌

1. **Don't Construct Directly**
   ```php
   new TenantBranding(...); // ❌ Constructor is private
   ```

2. **Don't Bypass Validation**
   ```php
   $identity->organizationName = 'New'; // ❌ Properties are readonly
   ```

3. **Don't Use Raw Strings**
   ```php
   function setBranding(string $color) // ❌ Use BrandingColor
   ```

4. **Don't Forget Tenant Context**
   ```php
   $repository->find($id); // ❌ Method doesn't exist
   ```

---

**Next:** [Infrastructure Implementation](./03_infrastructure_implementation.md)

---

**Last Updated:** 2026-01-06
**Status:** ✅ Production Ready
