# 🏛️ **DOMAIN EXTENSION ANALYSIS: Phase 2/3 → Phase 4**

**Date:** 2026-01-07
**Task:** Extend existing TenantBranding domain for Phase 4 requirements
**Approach:** Incremental enhancement, not replacement

---

## 📊 **EXISTING DOMAIN MODEL (Phase 2/3)**

### **Aggregate Root: TenantBranding**
**Location:** `app/Contexts/Platform/Domain/Entities/TenantBranding.php`

```php
final class TenantBranding {
    private readonly TenantId $tenantId;
    private BrandingBundle $branding;  // Mutable (can be updated)
    private readonly DateTimeImmutable $createdAt;
    private DateTimeImmutable $updatedAt;
    private array $domainEvents = [];

    // Methods
    public static function create(TenantId $tenantId, BrandingBundle $branding): self
    public function updateBranding(BrandingBundle $branding): void
    public function belongsToTenant(TenantId $tenantId): bool
    public function isWcagCompliant(): bool
    public function getDomainEvents(): array
}
```

### **Value Objects Hierarchy:**

```
BrandingBundle (Composite VO)
├── visuals: BrandingVisuals
│   ├── primaryColor: BrandingColor ✅
│   ├── secondaryColor: BrandingColor ✅
│   ├── logoUrl: ?string ❌ (Should be AssetPath)
│   └── fontFamily: string ✅
├── content: BrandingContent ✅
│   ├── welcomeMessage
│   ├── heroTitle
│   ├── heroSubtitle
│   └── ctaText
└── identity: BrandingIdentity ✅
    ├── organizationName
    ├── organizationTagline
    └── faviconUrl: ?string ❌ (Should be AssetPath)
```

### **Domain Events (Existing):**
- `BrandingCreated` ✅
- `BrandingUpdated` ✅

### **Exceptions (Existing):**
- `InvalidBrandingException` ✅
- `InvalidBrandingColorException` ✅

### **Business Rules (Already Implemented):**
1. ✅ WCAG 2.1 AA compliance validation
2. ✅ Color contrast checking
3. ✅ Immutable value objects
4. ✅ Domain events on state changes
5. ✅ Tenant ownership validation

---

## ❌ **MISSING FOR PHASE 4**

### **1. State Management**
**Issue:** No Draft/Published/Archived states

**Required:**
```php
// New Value Object
final class BrandingState {
    private const DRAFT = 'draft';
    private const PUBLISHED = 'published';
    private const ARCHIVED = 'archived';

    private string $value;

    public static function draft(): self;
    public static function published(): self;
    public static function archived(): self;
    public function isDraft(): bool;
    public function isPublished(): bool;
    public function isArchived(): bool;
    public function canTransitionTo(self $newState): bool;
}

// Extend TenantBranding
class TenantBranding {
    private BrandingState $state;  // NEW
    private ?DateTimeImmutable $publishedAt = null;  // NEW

    public function publish(UserId $publisher): void;  // NEW
    public function archive(): void;  // NEW
}
```

### **2. Version Control (Optimistic Locking)**
**Issue:** No version tracking for concurrent edit detection

**Required:**
```php
// New Value Object
final class Version {
    private int $value;

    public static function initial(): self;  // Creates version 1
    public function increment(): self;       // Immutable increment
    public function toInt(): int;
    public function equals(Version $other): bool;
}

// Extend TenantBranding
class TenantBranding {
    private Version $version;  // NEW

    // All update methods increment version:
    public function updateTheme(...): void {
        $this->version = $this->version->increment();
    }
}
```

### **3. Asset Management (Logo with Metadata)**
**Issue:** Logo is just a URL string, no dimensions/metadata

**Current (Wrong):**
```php
BrandingVisuals {
    private ?string $logoUrl;  // ❌ Just a string!
}
```

**Required:**
```php
// New Value Objects
final class AssetPath implements ValueObject {
    private string $path;  // "tenants/nrna/logos/primary.png"

    public static function fromString(string $path): self;
    public static function fromUrl(string $url): self;  // Extract path from URL
    public function toString(): string;
}

final class Dimensions implements ValueObject {
    private int $width;
    private int $height;

    public function isWithinTolerance(Dimensions $expected, float $tolerance = 0.2): bool;
    public function isValidForPrimaryLogo(): bool;  // 800x400 ±20%
}

final class AssetMetadata implements ValueObject {
    private Dimensions $dimensions;
    private int $fileSize;
    private string $mimeType;

    public function dimensions(): Dimensions;
    public function fileSize(): int;
    public function mimeType(): string;
}

final class LogoType {
    public const PRIMARY = 'primary';
    // Future: DARK_MODE, FAVICON, EMAIL, MOBILE
}

// Extend BrandingVisuals (or create BrandingAssets)
// Option A: Extend existing BrandingVisuals
BrandingVisuals {
    private ?AssetPath $logoPath;  // ✅ Domain-pure path
    private ?AssetMetadata $logoMetadata;  // ✅ Dimensions, size, etc.
}

// Option B: New composite VO (cleaner separation)
BrandingAssets {
    private ?AssetPath $primaryLogoPath;
    private ?AssetMetadata $primaryLogoMetadata;
}

BrandingBundle {
    private BrandingVisuals $visuals;
    private BrandingContent $content;
    private BrandingIdentity $identity;
    private BrandingAssets $assets;  // NEW
}
```

### **4. New Domain Events**
```php
// app/Contexts/Platform/Domain/Events/PrimaryLogoUpdated.php
final class PrimaryLogoUpdated {
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly AssetPath $assetPath,
        public readonly Version $version,
        public readonly UserId $updaterId,
        public readonly DateTimeImmutable $occurredAt
    ) {}
}

// app/Contexts/Platform/Domain/Events/BrandingPublished.php
final class BrandingPublished {
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly Version $version,
        public readonly UserId $publisherId,
        public readonly DateTimeImmutable $publishedAt
    ) {}
}

// app/Contexts/Platform/Domain/Events/BrandingArchived.php
final class BrandingArchived {
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly DateTimeImmutable $occurredAt
    ) {}
}
```

### **5. New Domain Exceptions**
```php
// app/Contexts/Platform/Domain/Exceptions/InvalidLogoDimensionsException.php
final class InvalidLogoDimensionsException extends DomainInvariantViolationException {
    public static function forPrimaryLogo(Dimensions $actual, Dimensions $expected): self
    {
        return new self(
            "Primary logo dimensions {$actual} do not match expected {$expected}"
        );
    }
}

// app/Contexts/Platform/Domain/Exceptions/WcagContrastViolation.php
// (May already exist as InvalidBrandingException, check)

// app/Contexts/Platform/Domain/Exceptions/InvalidAssetPathException.php
final class InvalidAssetPathException extends DomainInvariantViolationException {
    public static function invalidFormat(string $path): self
    {
        return new self("Invalid asset path format: {$path}");
    }
}
```

### **6. Extended Aggregate Methods**
```php
final class TenantBranding {
    // NEW: Update primary logo with dimension validation
    public function updatePrimaryLogo(
        AssetPath $assetPath,
        AssetMetadata $metadata,
        UserId $updater
    ): void {
        // Business rule: Validate dimensions
        if (!$metadata->dimensions()->isValidForPrimaryLogo()) {
            throw InvalidLogoDimensionsException::forPrimaryLogo(
                $metadata->dimensions(),
                new Dimensions(800, 400)
            );
        }

        // Update branding bundle with new asset
        $newAssets = $this->branding->getAssets()->withPrimaryLogo($assetPath, $metadata);
        $this->branding = $this->branding->withAssets($newAssets);

        // Update version and timestamp
        $this->version = $this->version->increment();
        $this->updatedAt = new DateTimeImmutable();

        // Record event
        $this->recordEvent(new PrimaryLogoUpdated(
            $this->tenantId,
            $assetPath,
            $this->version,
            $updater,
            $this->updatedAt
        ));
    }

    // NEW: Publish draft branding
    public function publish(UserId $publisher): void {
        // Business rule: Can only publish draft
        if (!$this->state->isDraft()) {
            throw new InvalidStateTransitionException(
                'Only draft branding can be published'
            );
        }

        $this->state = BrandingState::published();
        $this->publishedAt = new DateTimeImmutable();
        $this->version = $this->version->increment();

        $this->recordEvent(new BrandingPublished(
            $this->tenantId,
            $this->version,
            $publisher,
            $this->publishedAt
        ));
    }

    // NEW: Archive branding
    public function archive(): void {
        // Business rule: Can archive from any state
        $this->state = BrandingState::archived();

        $this->recordEvent(new BrandingArchived(
            $this->tenantId,
            new DateTimeImmutable()
        ));
    }
}
```

---

## 🎯 **EXTENSION STRATEGY**

### **Approach: Incremental Enhancement**

We will **extend** the existing domain model, NOT replace it. This ensures:
- ✅ Backward compatibility
- ✅ Existing tests continue to pass
- ✅ Minimal disruption
- ✅ Clear migration path

### **Extension Order (TDD-Driven):**

#### **Day 1 - Task 2: Write Minimal Extension Tests**
Create `tests/Unit/Contexts/Platform/Domain/Branding/TenantBrandingPhase4Test.php`:

```php
class TenantBrandingPhase4Test extends TestCase {
    /** @test - NEW FEATURE */
    public function it_can_publish_draft_branding(): void

    /** @test - NEW FEATURE */
    public function it_rejects_publishing_already_published_branding(): void

    /** @test - NEW FEATURE */
    public function it_validates_logo_dimensions_for_primary_logo(): void

    /** @test - NEW FEATURE */
    public function it_increments_version_on_each_change(): void

    /** @test - NEW FEATURE */
    public function it_emits_logo_updated_event(): void

    /** @test - NEW FEATURE */
    public function it_emits_branding_published_event(): void
}
```

#### **Day 1 - Task 3: Implement Extensions**

**Step 1: Create New Value Objects (2 hours)**
1. `BrandingState.php`
2. `Version.php`
3. `AssetPath.php`
4. `Dimensions.php`
5. `AssetMetadata.php`
6. `LogoType.php` (enum)

**Step 2: Extend BrandingBundle (1 hour)**
Add `BrandingAssets` composite value object:
```php
final class BrandingAssets {
    private ?AssetPath $primaryLogoPath = null;
    private ?AssetMetadata $primaryLogoMetadata = null;

    public function hasPrimaryLogo(): bool;
    public function primaryLogoPath(): ?AssetPath;
    public function primaryLogoMetadata(): ?AssetMetadata;
    public function withPrimaryLogo(AssetPath $path, AssetMetadata $metadata): self;
}
```

**Step 3: Extend TenantBranding Aggregate (2 hours)**
Add new fields and methods:
```php
final class TenantBranding {
    // NEW FIELDS
    private BrandingState $state;
    private Version $version;
    private ?DateTimeImmutable $publishedAt = null;

    // NEW METHODS
    public function updatePrimaryLogo(...): void;
    public function publish(UserId $publisher): void;
    public function archive(): void;
}
```

**Step 4: Create New Domain Events (30 minutes)**
1. `PrimaryLogoUpdated`
2. `BrandingPublished`
3. `BrandingArchived`

**Step 5: Create New Exceptions (30 minutes)**
1. `InvalidLogoDimensionsException`
2. `InvalidAssetPathException`
3. `WcagContrastViolation` (if not exists)

---

## 📋 **COMPATIBILITY MATRIX**

| Component | Phase 2/3 | Phase 4 | Action |
|-----------|-----------|---------|--------|
| `TenantBranding` aggregate | ✅ Exists | ✅ Extend | Add state, version, publish() |
| `BrandingBundle` VO | ✅ Exists | ✅ Extend | Add BrandingAssets |
| `BrandingVisuals` VO | ✅ Exists | ⚠️ Deprecate logoUrl | Keep for backward compat |
| `BrandingColor` VO | ✅ Exists | ✅ Reuse | No changes |
| `BrandingContent` VO | ✅ Exists | ✅ Reuse | No changes |
| `BrandingIdentity` VO | ✅ Exists | ✅ Reuse | No changes |
| `BrandingState` VO | ❌ Missing | ✅ Create | NEW |
| `Version` VO | ❌ Missing | ✅ Create | NEW |
| `AssetPath` VO | ❌ Missing | ✅ Create | NEW |
| `Dimensions` VO | ❌ Missing | ✅ Create | NEW |
| `AssetMetadata` VO | ❌ Missing | ✅ Create | NEW |
| `BrandingAssets` VO | ❌ Missing | ✅ Create | NEW (composite) |

---

## ⚠️ **MIGRATION CONSIDERATIONS**

When migrating existing data (Day 2), we need to:

1. **Set default state:** All existing branding → `published` state
2. **Initialize version:** All existing branding → version 1
3. **Transform logoUrl → AssetPath:**
   ```php
   // Old: "https://cdn.cloudinary.com/tenants/nrna/logos/primary.png"
   // New: AssetPath("tenants/nrna/logos/primary.png")
   ```
4. **Handle missing metadata:**
   - If logo URL exists but no dimensions known → Use default dimensions (800×400)
   - File size unknown → Set to 0 or fetch from CDN
   - MIME type unknown → Infer from extension

---

## ✅ **SUCCESS CRITERIA**

Phase 4 domain extension is complete when:

1. ✅ All new value objects implemented and tested
2. ✅ TenantBranding extended with state/version/publish()
3. ✅ All new domain tests pass
4. ✅ Existing Phase 2/3 tests still pass (backward compatibility)
5. ✅ Domain layer has ZERO infrastructure dependencies
6. ✅ AssetPath is pure domain (no CDN references)
7. ✅ WCAG validation works with new asset structure

---

## 📁 **FILE STRUCTURE AFTER EXTENSION**

```
app/Contexts/Platform/Domain/
├── Entities/
│   └── TenantBranding.php (EXTENDED)
├── ValueObjects/
│   ├── BrandingBundle.php (EXTENDED)
│   ├── BrandingVisuals.php (KEEP for backward compat)
│   ├── BrandingAssets.php (NEW)
│   ├── BrandingState.php (NEW)
│   ├── Version.php (NEW)
│   ├── AssetPath.php (NEW)
│   ├── Dimensions.php (NEW)
│   ├── AssetMetadata.php (NEW)
│   ├── LogoType.php (NEW)
│   └── ... (existing VOs)
├── Events/
│   ├── BrandingCreated.php (EXISTING)
│   ├── BrandingUpdated.php (EXISTING)
│   ├── PrimaryLogoUpdated.php (NEW)
│   ├── BrandingPublished.php (NEW)
│   └── BrandingArchived.php (NEW)
└── Exceptions/
    ├── InvalidBrandingException.php (EXISTING)
    ├── InvalidLogoDimensionsException.php (NEW)
    ├── InvalidAssetPathException.php (NEW)
    └── WcagContrastViolation.php (NEW or extend existing)
```

---

**Next Step:** Proceed to **Day 1 Task 2** - Write minimal extension tests for Phase 4 features.

**Status:** ✅ Analysis Complete - Ready to implement
**Estimated Time:** Day 1 Task 3 implementation = ~6 hours
