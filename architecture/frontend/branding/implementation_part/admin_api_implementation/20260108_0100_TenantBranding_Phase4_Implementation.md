# TenantBranding Phase 4 Implementation Guide

**Status**: Ready for Review
**Date**: 2026-01-08 01:00
**Phase**: Day 1 Task 3 - Domain Model Extension

---

## 🎯 **OBJECTIVE:**

Extend `TenantBranding` aggregate root with Phase 4 features while maintaining:
- ✅ Backward compatibility
- ✅ Domain purity (no framework dependencies)
- ✅ TDD (28 tests must pass)
- ✅ Existing business rules

---

## 📋 **CHANGES SUMMARY:**

### **1. New Properties (Private):**
```php
private BrandingState $state;      // DRAFT → PUBLISHED → ARCHIVED
private Version $version;           // Optimistic locking (v1, v2, v3...)
```

### **2. Updated Constructor:**
```php
private function __construct(
    private readonly TenantId $tenantId,
    private BrandingBundle $branding,
    private readonly DateTimeImmutable $createdAt,
    private DateTimeImmutable $updatedAt,
    private BrandingState $state,           // NEW
    private Version $version                // NEW
) {
    $this->validateWcagCompliance($this->branding);
}
```

### **3. New Public Methods:**
```php
// State accessors
public function state(): BrandingState
public function version(): Version
public function isEditable(): bool
public function canTransitionTo(BrandingState $newState): bool

// State transition methods
public function publish(UserId $publisher): void
public function archive(UserId $archiver): void

// Asset management
public function updatePrimaryLogo(AssetPath $path, AssetMetadata $metadata, UserId $updater): void
```

### **4. Updated Factory Methods:**
```php
// create() - defaults to DRAFT state, v1
// reconstitute() - accepts state and version for DB restoration
// NEW: fromExisting() - for migration from Phase 2/3 data
```

### **5. New Domain Events:**
```php
PrimaryLogoUpdated      // When logo is added/changed
BrandingPublished       // When state: DRAFT → PUBLISHED
BrandingArchived        // When state: PUBLISHED → ARCHIVED
```

### **6. New Exceptions:**
```php
InvalidStateTransitionException  // Invalid state machine transition
ConcurrencyException            // Version mismatch (optimistic locking)
WcagLogoContrastViolation       // Logo contrast fails WCAG AA
InvalidLogoDimensionsException  // Logo dimensions outside tolerance
```

---

## 🏗️ **COMPLETE IMPLEMENTATION:**

### **Step 1: Add Imports**

```php
namespace App\Contexts\Platform\Domain\Entities;

use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;
use App\Contexts\Platform\Domain\ValueObjects\BrandingState;
use App\Contexts\Platform\Domain\ValueObjects\Version;
use App\Contexts\Platform\Domain\ValueObjects\AssetPath;
use App\Contexts\Platform\Domain\ValueObjects\AssetMetadata;
use App\Contexts\Platform\Domain\ValueObjects\UserId;
use App\Contexts\Platform\Domain\Events\BrandingCreated;
use App\Contexts\Platform\Domain\Events\BrandingUpdated;
use App\Contexts\Platform\Domain\Events\PrimaryLogoUpdated;
use App\Contexts\Platform\Domain\Events\BrandingPublished;
use App\Contexts\Platform\Domain\Events\BrandingArchived;
use App\Contexts\Shared\Domain\ValueObjects\TenantId;
use App\Contexts\Platform\Domain\Exceptions\InvalidBrandingException;
use App\Contexts\Platform\Domain\Exceptions\InvalidStateTransitionException;
use App\Contexts\Platform\Domain\Exceptions\ConcurrencyException;
use App\Contexts\Platform\Domain\Exceptions\WcagLogoContrastViolation;
use App\Contexts\Platform\Domain\Exceptions\InvalidLogoDimensionsException;
use DateTimeImmutable;
```

### **Step 2: Update Class Documentation**

```php
/**
 * TenantBranding Entity (Aggregate Root)
 *
 * Domain model representing a tenant's complete branding configuration.
 * Uses TenantId as natural key identity due to one-to-one business relationship.
 *
 * Business Rules:
 * - One tenant = one branding configuration (1:1 relationship)
 * - TenantId serves as natural key identity
 * - All branding MUST comply with WCAG 2.1 AA standards
 * - Logo dominant color must have 4.5:1 contrast with primary color
 * - Logo dimensions must be approximately 800×400 (±20% tolerance)
 * - Branding can be updated but must remain WCAG compliant
 * - Creation and update timestamps are immutable once set
 * - Domain Events are recorded for all state changes
 *
 * Phase 4 Extensions:
 * - State Management: DRAFT → PUBLISHED → ARCHIVED
 * - Version Control: Optimistic locking for concurrent updates
 * - Asset Management: Primary logo with WCAG validation
 * - Audit Trail: All state transitions emit domain events with version
 *
 * DDD Pattern: Entity with Natural Key + Domain Events + State Machine
 * Multi-Tenant: Tenant ownership validated via belongsToTenant()
 * Clean Architecture: Pure domain logic, no application/infrastructure concerns
 */
```

### **Step 3: Update Constructor**

```php
/**
 * Private constructor enforces use of factory methods
 *
 * Phase 4: Added state and version for state machine + optimistic locking
 */
private function __construct(
    private readonly TenantId $tenantId,
    private BrandingBundle $branding,
    private readonly DateTimeImmutable $createdAt,
    private DateTimeImmutable $updatedAt,
    private BrandingState $state,
    private Version $version
) {
    $this->validateWcagCompliance($this->branding);
}
```

### **Step 4: Update create() Factory**

```php
/**
 * Create new TenantBranding entity
 *
 * Factory method that validates WCAG compliance before creation.
 * Records BrandingCreated domain event.
 *
 * Phase 4: New brandings start in DRAFT state with version 1
 *
 * @throws InvalidBrandingException if branding is not WCAG compliant
 */
public static function create(TenantId $tenantId, BrandingBundle $branding): self
{
    $now = new DateTimeImmutable();

    $entity = new self(
        tenantId: $tenantId,
        branding: $branding,
        createdAt: $now,
        updatedAt: $now,
        state: BrandingState::draft(),      // NEW: Default to DRAFT
        version: Version::initial()         // NEW: Start at v1
    );

    $entity->recordEvent(new BrandingCreated(
        tenantId: $tenantId,
        brandingBundle: $branding,
        occurredAt: $now
    ));

    return $entity;
}
```

### **Step 5: Update reconstitute() Factory**

```php
/**
 * Reconstitute TenantBranding entity from persistence
 *
 * Factory method for restoring entities from database/event store.
 * Does NOT record domain events (events are transient, not persisted).
 *
 * Phase 4: Accepts state and version for complete restoration
 *
 * @throws InvalidBrandingException if branding is not WCAG compliant
 */
public static function reconstitute(
    TenantId $tenantId,
    BrandingBundle $branding,
    DateTimeImmutable $createdAt,
    DateTimeImmutable $updatedAt,
    BrandingState $state,
    Version $version
): self {
    return new self(
        tenantId: $tenantId,
        branding: $branding,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        state: $state,
        version: $version
    );
    // No domain events recorded - events are transient
}
```

### **Step 6: Add fromExisting() Factory (Migration)**

```php
/**
 * Create from existing Phase 2/3 branding (migration factory)
 *
 * Used for data migration to convert existing branding to Phase 4 format.
 * Existing branding is marked as PUBLISHED (not DRAFT) since it's already in use.
 *
 * Business Rule: Migrated branding starts at version 1 in PUBLISHED state
 *
 * @throws InvalidBrandingException if branding is not WCAG compliant
 */
public static function fromExisting(
    TenantId $tenantId,
    BrandingBundle $branding,
    DateTimeImmutable $createdAt,
    DateTimeImmutable $updatedAt
): self {
    return new self(
        tenantId: $tenantId,
        branding: $branding,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        state: BrandingState::published(),  // Existing branding is live
        version: Version::initial()          // Start at v1
    );
    // No domain events - this is migration/reconstitution
}
```

### **Step 7: Add State Accessor Methods**

```php
/**
 * Get current state (Phase 4)
 */
public function state(): BrandingState
{
    return $this->state;
}

/**
 * Get current version (Phase 4)
 */
public function version(): Version
{
    return $this->version;
}

/**
 * Check if branding is editable
 *
 * Business Rule: Only DRAFT branding can be edited
 */
public function isEditable(): bool
{
    return $this->state->isEditable();
}

/**
 * Check if can transition to new state
 *
 * Business Rules:
 * - DRAFT → PUBLISHED only
 * - PUBLISHED → ARCHIVED only
 * - ARCHIVED is final (no transitions)
 * - Same state allowed (idempotency)
 */
public function canTransitionTo(BrandingState $newState): bool
{
    return $this->state->canTransitionTo($newState);
}
```

### **Step 8: Add State Transition Methods**

```php
/**
 * Publish branding (DRAFT → PUBLISHED)
 *
 * Makes branding visible to members/voters.
 * Increments version for optimistic locking.
 * Records BrandingPublished domain event.
 *
 * Business Rules:
 * - Only DRAFT branding can be published
 * - Version increments on state change
 * - Event includes version for audit trail
 *
 * @throws InvalidStateTransitionException if current state is not DRAFT
 */
public function publish(UserId $publisher): void
{
    $newState = BrandingState::published();

    if (!$this->canTransitionTo($newState)) {
        throw InvalidStateTransitionException::fromTransition($this->state, $newState);
    }

    $this->state = $newState;
    $this->version = $this->version->increment();
    $this->updatedAt = new DateTimeImmutable();

    $this->recordEvent(BrandingPublished::now(
        tenantId: $this->tenantId,
        publishedBy: $publisher,
        version: $this->version
    ));
}

/**
 * Archive branding (PUBLISHED → ARCHIVED)
 *
 * Marks branding as historical (no longer active).
 * Increments version for optimistic locking.
 * Records BrandingArchived domain event.
 *
 * Business Rules:
 * - Only PUBLISHED branding can be archived
 * - DRAFTS CANNOT be archived (must publish first)
 * - Archived branding is immutable (final state)
 * - Version increments on state change
 *
 * @throws InvalidStateTransitionException if current state is not PUBLISHED
 */
public function archive(UserId $archiver): void
{
    $newState = BrandingState::archived();

    if (!$this->canTransitionTo($newState)) {
        throw InvalidStateTransitionException::fromTransition($this->state, $newState);
    }

    $this->state = $newState;
    $this->version = $this->version->increment();
    $this->updatedAt = new DateTimeImmutable();

    $this->recordEvent(BrandingArchived::now(
        tenantId: $this->tenantId,
        archivedBy: $archiver,
        version: $this->version
    ));
}
```

### **Step 9: Add Asset Management Methods**

```php
/**
 * Update primary logo
 *
 * Validates logo dimensions and WCAG contrast before accepting.
 * Updates branding bundle with new logo assets.
 * Increments version for optimistic locking.
 * Records PrimaryLogoUpdated domain event.
 *
 * Business Rules:
 * - Logo dimensions must be approximately 800×400 (±20% tolerance)
 * - Logo dominant color must have 4.5:1 contrast with primary color
 * - Only editable (DRAFT) branding can update logo
 * - Version increments on update
 *
 * @throws InvalidStateTransitionException if branding is not editable
 * @throws InvalidLogoDimensionsException if dimensions outside tolerance
 * @throws WcagLogoContrastViolation if logo contrast insufficient
 */
public function updatePrimaryLogo(AssetPath $path, AssetMetadata $metadata, UserId $updater): void
{
    if (!$this->isEditable()) {
        throw InvalidStateTransitionException::archivedIsImmutable();
    }

    // Validate dimensions
    if (!$metadata->dimensions()->isValidForPrimaryLogo()) {
        throw InvalidLogoDimensionsException::outsideTolerance(
            actual: $metadata->dimensions(),
            expected: \App\Contexts\Platform\Domain\ValueObjects\Dimensions::forPrimaryLogo()
        );
    }

    // Validate WCAG contrast (if dominant color available)
    if ($metadata->hasDominantColor()) {
        $primaryColor = $this->branding->getVisuals()->getPrimaryColor();
        $dominantColor = $metadata->dominantColor();

        if (!$dominantColor->meetsWcagAaContrast($primaryColor)) {
            throw WcagLogoContrastViolation::insufficientContrast(
                logoColor: $dominantColor,
                brandingColor: $primaryColor,
                actualRatio: $dominantColor->getContrastRatio($primaryColor)
            );
        }
    }

    // Update branding bundle
    $newAssets = $this->branding->getAssets()->withPrimaryLogo($path, $metadata);
    $this->branding = $this->branding->withAssets($newAssets);

    // Increment version and timestamp
    $this->version = $this->version->increment();
    $this->updatedAt = new DateTimeImmutable();

    // Record event
    $this->recordEvent(PrimaryLogoUpdated::now(
        tenantId: $this->tenantId,
        logoPath: $path,
        metadata: $metadata,
        version: $this->version
    ));
}
```

### **Step 10: Update toArray() Serialization**

```php
/**
 * Convert to array for serialization
 *
 * Phase 4: Includes state and version
 */
public function toArray(): array
{
    return [
        'tenant_id' => $this->tenantId->toString(),
        'branding' => $this->branding->toArray(),
        'state' => $this->state->toString(),          // NEW
        'version' => $this->version->toInt(),         // NEW
        'created_at' => $this->createdAt->format('Y-m-d H:i:s'),
        'updated_at' => $this->updatedAt->format('Y-m-d H:i:s'),
        'is_wcag_compliant' => $this->isWcagCompliant(),
    ];
}
```

---

## 🧪 **TEST COMPATIBILITY:**

After these changes:

1. ✅ **Existing 14 tests should still pass** (backward compatibility)
2. ✅ **New 28 Phase 4 tests should pass** (new functionality)
3. ✅ **Total: 42 tests passing**

---

## 🎯 **BACKWARD COMPATIBILITY GUARANTEE:**

### **Existing Code (Phase 2/3):**
```php
// This still works (creates DRAFT branding with v1)
$branding = TenantBranding::create($tenantId, $bundle);
```

### **Migration Code:**
```php
// For existing branding (marks as PUBLISHED with v1)
$branding = TenantBranding::fromExisting($tenantId, $bundle, $createdAt, $updatedAt);
```

### **New Phase 4 Code:**
```php
// Full control over state and version
$branding = TenantBranding::reconstitute($tenantId, $bundle, $createdAt, $updatedAt, $state, $version);
```

---

## ✅ **APPROVAL CHECKLIST:**

- [ ] All imports added
- [ ] Constructor updated with state and version
- [ ] Factory methods updated
- [ ] State accessors added
- [ ] State transition methods added
- [ ] Asset management methods added
- [ ] Serialization updated
- [ ] Documentation updated
- [ ] Business rules enforced
- [ ] Domain events emit with version
- [ ] Exceptions properly thrown
- [ ] Backward compatibility maintained

---

## 🚀 **NEXT STEPS AFTER APPROVAL:**

1. Apply all changes to `TenantBranding.php`
2. Run Phase 4 tests (`TenantBrandingPhase4Test.php`)
3. Verify all 28 tests pass
4. Mark Day 1 Task 3 as COMPLETE
5. Move to Day 2: Data Migration Command

---

**Ready for your review and approval!** 🎯
