# Admin API - Domain Layer Deep Dive

**Date**: 2026-01-08 02:05
**Audience**: Backend Developers, Domain Modelers
**Prerequisites**: Understanding of DDD, Value Objects, Aggregates

---

## 🎯 **OVERVIEW**

This guide provides in-depth technical documentation of the Phase 4 domain layer extensions for **TenantBranding**.

---

## 📦 **VALUE OBJECTS**

### **1. Version**

**Purpose**: Optimistic locking for concurrent edit prevention

**Location**: `app/Contexts/Platform/Domain/ValueObjects/Version.php`

**API**:
```php
// Create
Version::initial();              // v1
Version::fromInt(5);             // v5

// Operations
$version->increment();           // Returns NEW Version (immutable)
$version->toInt();               // Get integer value
$version->equals($other);        // Compare versions
```

**Business Rules**:
- Always starts at 1
- Cannot be negative
- Immutable (increment returns new instance)
- Used for optimistic locking (detect concurrent edits)

**Example**:
```php
$v1 = Version::initial();           // v1
$v2 = $v1->increment();             // v2
$v1->toInt();                       // Still 1 (immutable)
$v2->toInt();                       // 2
```

---

### **2. BrandingState**

**Purpose**: Type-safe state machine for branding lifecycle

**Location**: `app/Contexts/Platform/Domain/ValueObjects/BrandingState.php`

**States**:
```php
BrandingState::draft();         // Editable, not visible to public
BrandingState::published();     // Live, visible to members/voters
BrandingState::archived();      // Historical, immutable
```

**API**:
```php
// Factories
BrandingState::draft();
BrandingState::published();
BrandingState::archived();
BrandingState::fromString('published');

// Queries
$state->isDraft();
$state->isPublished();
$state->isArchived();
$state->isEditable();           // Only drafts are editable
$state->toString();             // 'draft', 'published', 'archived'

// Validation
$state->canTransitionTo($newState);         // Returns bool
$state->validNextStates();                  // Returns array of allowed states
$state->explainTransition($newState);       // Returns string explanation
```

**State Transition Matrix**:
```
FROM          TO             ALLOWED?    REASON
────────────────────────────────────────────────────────────────
draft      → draft          ✅          Idempotent operations
draft      → published      ✅          Normal workflow
draft      → archived       ❌          Must publish first (audit trail)

published  → draft          ❌          Cannot unpublish
published  → published      ✅          Idempotent operations
published  → archived       ✅          Normal archival

archived   → draft          ❌          Immutable final state
archived   → published      ❌          Immutable final state
archived   → archived       ✅          Idempotent operations
```

**Example**:
```php
$draft = BrandingState::draft();
$published = BrandingState::published();

$draft->canTransitionTo($published);      // true
$draft->explainTransition($archived);     // "Must publish branding before..."
```

---

### **3. AssetPath**

**Purpose**: Domain-pure file paths (NO CDN URLs)

**Location**: `app/Contexts/Platform/Domain/ValueObjects/AssetPath.php`

**Business Rule**: Domain layer must remain infrastructure-agnostic

**API**:
```php
AssetPath::fromString('tenants/nrna/logos/primary.png');

$path->toString();              // Get path string
$path->equals($other);          // Compare paths
```

**Validation**:
```php
// ✅ VALID
AssetPath::fromString('tenants/nrna/logos/primary.png');
AssetPath::fromString('uploads/branding/logo.svg');

// ❌ INVALID (throws InvalidAssetPathException)
AssetPath::fromString('https://cdn.cloudinary.com/...');  // No URLs
AssetPath::fromString('http://example.com/logo.png');     // No URLs
AssetPath::fromString('s3://bucket/file.png');            // No cloud providers
```

**Why?**:
- Domain layer should not know about CDN infrastructure
- URL generation happens in presentation layer
- Allows switching CDN providers without domain changes

---

### **4. Dimensions**

**Purpose**: Image dimension validation with tolerance

**Location**: `app/Contexts/Platform/Domain/ValueObjects/Dimensions.php`

**API**:
```php
// Create
Dimensions::create(800, 400);
Dimensions::forPrimaryLogo();   // Returns Dimensions::create(800, 400)

// Queries
$dims->width();                 // 800
$dims->height();                // 400
$dims->toString();              // '800×400'

// Validation
$dims->isValidForPrimaryLogo();                      // Uses 20% tolerance
$dims->isWithinTolerance($expected, $tolerance);     // Custom tolerance
```

**Primary Logo Rules**:
- **Expected**: 800×400 pixels
- **Tolerance**: ±20%
- **Acceptable Range**: 640×320 to 960×480

**Tolerance Calculation**:
```php
// Formula: |actual - expected| <= expected × tolerance

// Examples with 20% tolerance:
800 × 0.20 = 160
Acceptable width: 800 ± 160 = 640 to 960

400 × 0.20 = 80
Acceptable height: 400 ± 80 = 320 to 480
```

**Example**:
```php
$expected = Dimensions::forPrimaryLogo();  // 800×400

Dimensions::create(820, 410)->isWithinTolerance($expected, 0.20);  // true (within range)
Dimensions::create(960, 480)->isWithinTolerance($expected, 0.20);  // true (at boundary)
Dimensions::create(961, 481)->isWithinTolerance($expected, 0.20);  // false (outside)
```

---

### **5. AssetMetadata**

**Purpose**: Store file metadata with optional dominant color

**Location**: `app/Contexts/Platform/Domain/ValueObjects/AssetMetadata.php`

**API**:
```php
// Create (with dominant color)
AssetMetadata::create(
    dimensions: Dimensions::create(800, 400),
    fileSize: 102400,                           // bytes
    mimeType: 'image/png',
    dominantColor: BrandingColor::fromString('#1E3A8A')  // Optional
);

// Create (without dominant color - e.g., SVG)
AssetMetadata::create(
    dimensions: Dimensions::create(800, 400),
    fileSize: 50000,
    mimeType: 'image/svg+xml'
);

// Queries
$metadata->dimensions();        // Returns Dimensions VO
$metadata->fileSize();          // Returns int
$metadata->mimeType();          // Returns string
$metadata->hasDominantColor();  // Returns bool
$metadata->dominantColor();     // Returns BrandingColor or null
```

**Why Dominant Color is Optional?**:
- **SVG files**: No dominant color (vector graphics)
- **Color extraction failed**: Analysis couldn't determine dominant color
- **Not yet extracted**: Logo uploaded but color not yet analyzed

---

### **6. BrandingAssets**

**Purpose**: Manage branding file assets (Phase 4: Primary Logo only)

**Location**: `app/Contexts/Platform/Domain/ValueObjects/BrandingAssets.php`

**API**:
```php
// Create empty (no assets)
$assets = BrandingAssets::empty();

// Add primary logo (returns NEW instance - immutable)
$newAssets = $assets->withPrimaryLogo($path, $metadata);

// Queries
$assets->isEmpty();                                  // true if no assets
$assets->hasPrimaryLogo();                           // true if logo present
$assets->primaryLogoPath();                          // AssetPath or null
$assets->primaryLogoMetadata();                      // AssetMetadata or null
$assets->canValidateLogoContrast();                  // true if has logo + dominant color
$assets->primaryLogoDominantColor();                 // BrandingColor or null

// WCAG Validation
$assets->isLogoContrastCompliant($primaryColor);     // Validates against branding primary color
```

**WCAG Validation Logic**:
```php
public function isLogoContrastCompliant(BrandingColor $primaryColor): bool
{
    // No logo = compliant (nothing to validate)
    if (!$this->hasPrimaryLogo()) {
        return true;
    }

    // No dominant color = compliant (can't validate)
    if (!$this->canValidateLogoContrast()) {
        return true;
    }

    // Check 4.5:1 contrast ratio
    $logoColor = $this->primaryLogoDominantColor();
    return $logoColor->meetsWcagAaContrast($primaryColor);
}
```

**Serialization**:
```php
$assets->toArray();
// Returns:
// [
//     'primary_logo' => [
//         'path' => 'tenants/nrna/logos/primary.png',
//         'metadata' => [
//             'dimensions' => '800×400',
//             'file_size' => 102400,
//             'mime_type' => 'image/png',
//             'dominant_color' => '#1E3A8A'
//         ]
//     ]
// ]

$assets->fromArray($data);  // Reconstruct from array
```

---

### **7. UserId**

**Purpose**: Type-safe user identifier for audit trails

**Location**: `app/Contexts/Platform/Domain/ValueObjects/UserId.php`

**CRITICAL**: Use **Platform context** UserId, NOT Shared context:
```php
// ✅ CORRECT
use App\Contexts\Platform\Domain\ValueObjects\UserId;

// ❌ WRONG
use App\Contexts\Shared\Domain\ValueObjects\UserId;
```

**API**:
```php
UserId::fromString('admin-123');

$userId->toString();            // 'admin-123'
$userId->equals($other);        // Compare user IDs
```

---

## 🔧 **EXTENDED VALUE OBJECTS**

### **BrandingBundle Extension**

**Changes**:
```php
// BEFORE (Phase 2/3)
BrandingBundle::create($visuals, $content, $identity);

// AFTER (Phase 4 - backward compatible)
BrandingBundle::create($visuals, $content, $identity);  // Still works!
BrandingBundle::createWithAssets($visuals, $content, $identity, $assets);  // NEW

// Accessors
$bundle->getAssets();           // NEW - returns BrandingAssets
$bundle->withAssets($assets);   // NEW - immutable update

// WCAG Validation Extended
$bundle->isWcagCompliant();     // NOW checks logo contrast too
```

**Implementation**:
```php
private readonly BrandingAssets $assets;

private function __construct(
    private readonly BrandingVisuals $visuals,
    private readonly BrandingContent $content,
    private readonly BrandingIdentity $identity,
    ?BrandingAssets $assets = null
) {
    $this->assets = $assets ?? BrandingAssets::empty();  // Default to empty
}

public function isWcagCompliant(): bool
{
    return $this->visuals->hasSufficientContrast() &&
           $this->assets->isLogoContrastCompliant($this->visuals->getPrimaryColor());
}
```

---

### **BrandingColor Extension**

**Changes** ("Tell, Don't Ask" Pattern):
```php
// NEW METHODS
$color->meetsWcagAaContrast($otherColor);   // 4.5:1 ratio
$color->meetsWcagAaaContrast($otherColor);  // 7:1 ratio

// EXISTING (unchanged)
$color->getContrastRatio($otherColor);      // Returns float
$color->toString();                         // '#1E3A8A'
$color->toRgb();                            // [30, 58, 138]
```

**Why "Tell, Don't Ask"?**:
```php
// ❌ "ASK" Pattern (exposing constants)
if ($color->getContrastRatio($other) >= BrandingColor::WCAG_AA_MIN_CONTRAST) {
    // ...
}

// ✅ "TELL" Pattern (encapsulated logic)
if ($color->meetsWcagAaContrast($other)) {
    // ...
}
```

**Benefits**:
- Encapsulation: Constants remain private
- Testability: Mock behavior, not constants
- Maintainability: Change logic without breaking clients
- Readability: Intention-revealing method names

---

## 🎭 **DOMAIN EVENTS**

### **1. PrimaryLogoUpdated**

**Fired When**: Logo is added or changed

**Location**: `app/Contexts/Platform/Domain/Events/PrimaryLogoUpdated.php`

**Properties**:
```php
public readonly TenantId $tenantId;          // Which tenant
public readonly AssetPath $logoPath;         // New logo path
public readonly AssetMetadata $metadata;     // Logo metadata
public readonly Version $version;            // Version AFTER update
public readonly UserId $updaterId;           // Who made the change
public readonly DateTimeImmutable $occurredAt;
```

**Factory**:
```php
PrimaryLogoUpdated::now($tenantId, $logoPath, $metadata, $version, $updaterId);
```

**Serialization**:
```php
$event->toArray();
// [
//     'tenant_id' => 'nrna',
//     'logo_path' => 'tenants/nrna/logos/primary.png',
//     'metadata' => [...],
//     'version' => 2,
//     'updater_id' => 'admin-123',
//     'occurred_at' => '2026-01-08T02:00:00+00:00'
// ]
```

**Use Cases**:
- CDN synchronization
- Cache invalidation
- Audit trail
- Webhook notifications

---

### **2. BrandingPublished**

**Fired When**: Branding transitions from Draft → Published

**Properties**:
```php
public readonly TenantId $tenantId;
public readonly UserId $publishedBy;         // Who published
public readonly Version $version;            // Version AFTER publish
public readonly DateTimeImmutable $occurredAt;
```

**Use Cases**:
- Notify members of new branding
- Trigger CDN deployment
- Update public-facing website
- Analytics

---

### **3. BrandingArchived**

**Fired When**: Branding transitions from Published → Archived

**Properties**:
```php
public readonly TenantId $tenantId;
public readonly UserId $archivedBy;          // Who archived
public readonly Version $version;            // Version AFTER archive
public readonly DateTimeImmutable $occurredAt;
```

**Use Cases**:
- Historical compliance reporting
- Branding version history
- Audit trail

---

## 💥 **DOMAIN EXCEPTIONS**

### **1. InvalidStateTransitionException**

**When**: Attempted invalid state transition

**Location**: `app/Contexts/Platform/Domain/Exceptions/InvalidStateTransitionException.php`

**Factories**:
```php
// From attempted transition
InvalidStateTransitionException::fromTransition($fromState, $toState);
// Message: "Cannot transition branding from draft to archived. Must publish..."

// Specific scenarios
InvalidStateTransitionException::onlyPublishedCanArchive();
InvalidStateTransitionException::archivedIsImmutable();
```

**Example**:
```php
try {
    $draft->archive($user);  // Draft → Archived (invalid)
} catch (InvalidStateTransitionException $e) {
    // "Cannot transition branding from draft to archived..."
}
```

---

### **2. ConcurrencyException**

**When**: Version mismatch (concurrent edit detected)

**Factories**:
```php
ConcurrencyException::versionMismatch($expectedVersion, $providedVersion);
```

**Example**:
```php
// User A loads branding (v1)
// User B updates branding (v1 → v2)
// User A tries to save (expects v1, but now v2)

throw ConcurrencyException::versionMismatch(
    Version::fromInt(1),  // Expected
    Version::fromInt(2)   // Actual
);
// Message: "Branding has been modified by another user.
//           Expected version 1, but got 2. Please refresh and try again."
```

**Note**: This exception is defined but not yet used (Phase 5 feature).

---

### **3. WcagLogoContrastViolation**

**When**: Logo dominant color has insufficient contrast with primary color

**Factories**:
```php
WcagLogoContrastViolation::insufficientContrast(
    $logoColor,
    $brandingColor,
    $actualRatio
);
```

**Example**:
```php
// Logo: #F0F0F0 (light gray)
// Primary: #FFFFFF (white)
// Contrast: 1.05:1 (needs 4.5:1)

throw WcagLogoContrastViolation::insufficientContrast(
    BrandingColor::fromString('#F0F0F0'),
    BrandingColor::fromString('#FFFFFF'),
    1.05
);
// Message: "Logo does not meet WCAG 2.1 AA contrast requirements.
//           Logo color #F0F0F0 vs branding color #FFFFFF has contrast ratio 1.05:1.
//           Minimum required: 4.5:1"
```

---

### **4. InvalidLogoDimensionsException**

**When**: Logo dimensions outside acceptable tolerance

**Factories**:
```php
InvalidLogoDimensionsException::outsideTolerance($actual, $expected);
```

**Example**:
```php
throw InvalidLogoDimensionsException::outsideTolerance(
    Dimensions::create(200, 100),
    Dimensions::forPrimaryLogo()
);
// Message: "Logo dimensions 200×100 are outside the acceptable range.
//           Expected approximately 800×400 (±20%).
//           Acceptable range: 640×320 to 960×480."
```

---

### **5. InvalidAssetPathException**

**When**: Asset path contains forbidden patterns (URLs, CDN references)

**Factories**:
```php
InvalidAssetPathException::invalidFormat($path, $reason);
InvalidAssetPathException::urlNotAllowed($url);
```

**Example**:
```php
throw InvalidAssetPathException::invalidFormat(
    'https://cdn.example.com/logo.png',
    'Path cannot contain URL scheme'
);
```

---

## 🏛️ **AGGREGATE ROOT: TenantBranding**

### **New Properties**:
```php
private BrandingState $state;      // NEW
private Version $version;          // NEW
```

### **Updated Constructor**:
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

### **Factory Methods**:

```php
// NEW branding (Draft, v1)
TenantBranding::create($tenantId, $bundle);

// Reconstitute from DB (full restoration)
TenantBranding::reconstitute(
    $tenantId,
    $bundle,
    $createdAt,
    $updatedAt,
    $state,      // From database
    $version     // From database
);

// Migration factory (existing branding = Published, v1)
TenantBranding::fromExisting(
    $tenantId,
    $bundle,
    $createdAt,
    $updatedAt
);
```

### **State Accessors**:
```php
$branding->state();              // Returns BrandingState
$branding->version();            // Returns Version
$branding->isEditable();         // Returns bool (only drafts editable)
$branding->canTransitionTo($newState);  // Returns bool
```

### **State Transition Methods**:
```php
// Publish (Draft → Published)
$branding->publish(UserId $publisher);
// - Validates transition
// - Increments version
// - Emits BrandingPublished event

// Archive (Published → Archived)
$branding->archive(UserId $archiver);
// - Validates transition
// - Increments version
// - Emits BrandingArchived event
```

### **Asset Management**:
```php
$branding->updatePrimaryLogo(
    AssetPath $path,
    AssetMetadata $metadata,
    UserId $updater
);
// Validates:
// - Branding is editable (not archived)
// - Dimensions within tolerance
// - WCAG contrast (if dominant color present)
// Then:
// - Updates bundle
// - Increments version
// - Emits PrimaryLogoUpdated event
```

### **Updated Methods**:
```php
// NOW increments version
$branding->updateBranding($bundle);
// - Validates WCAG
// - Updates bundle
// - Increments version  ← NEW
// - Emits BrandingUpdated event
```

---

## 🎯 **BUSINESS RULES SUMMARY**

1. **State Machine**:
   - Draft → Published → Archived (linear progression)
   - No backwards transitions
   - Same-state allowed (idempotency)

2. **Version Control**:
   - Starts at 1
   - Increments on all changes
   - Used for optimistic locking

3. **Asset Management**:
   - Only editable branding can update logo
   - Dimensions: 800×400 ±20%
   - WCAG: Logo vs primary color ≥ 4.5:1

4. **WCAG Compliance**:
   - Bundle validates text contrast
   - Bundle validates logo contrast
   - Both must pass

5. **Audit Trail**:
   - All events include UserId
   - All events include Version
   - All events include timestamp

---

## 📖 **SEE ALSO**

- [Overview & Quick Start](./20260108_0200_Admin_API_Overview_Quick_Start.md)
- [Testing Guide](./20260108_0210_Testing_Guide.md)
- [Migration Strategy](./20260108_0215_Migration_Strategy.md)
