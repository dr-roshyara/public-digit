# 🏛️ **PHASE 4 IMPLEMENTATION PLAN: Admin API & Dashboard for Branding**

**Version:** 1.0
**Created:** 2026-01-07
**Status:** 🟡 Awaiting Approval
**Architect:** Senior Software Architect
**Sprint Duration:** 28 days (4 weeks)

---

## 📋 **EXECUTIVE SUMMARY**

This plan addresses **Phase 4** of the Platform Branding System: implementing Admin API and Vue 3 Dashboard for platform administrators to manage branding for all tenants, with integrated asset management (logo uploads, CDN delivery, version control).

### **Architectural Foundations Respected:**
- ✅ Domain-Driven Design (DDD) with clean bounded contexts
- ✅ Test-Driven Development (TDD) - Red/Green/Refactor
- ✅ 6-Case Routing System compliance
- ✅ Command-driven API (not RESTful CRUD)
- ✅ CQRS pattern for read/write separation
- ✅ Event sourcing for audit trail

### **Critical Architectural Corrections Applied:**

Based on comprehensive analysis of all architecture documents, this plan **corrects** the following issues identified in the original Phase 4 plan (scored 7.5/10):

1. **Domain Model Confusion (HIGH SEVERITY)** - Fixed by making `BrandingBundle` the aggregate root
2. **Bounded Context Pollution (MEDIUM)** - Fixed by staying in `Platform::Branding` context
3. **API Design Flaws (MEDIUM)** - Fixed by using command-driven API instead of RESTful
4. **Asset Management Gap (HIGH)** - Fixed by integrating `BrandingAssets` domain model

---

## 🎯 **PHASE 4 SCOPE & OBJECTIVES**

### **Primary Goal:**
Enable platform administrators to manage branding for all tenants through:
1. **Admin API** - Command-driven backend for branding operations
2. **Admin Dashboard** - Vue 3 SPA with real-time preview and asset management
3. **Asset Management** - Logo upload, CDN delivery, version control
4. **WCAG Validation** - Real-time accessibility checks using domain rules

### **User Stories:**

**As a Platform Admin, I want to:**
- View all tenant branding configurations in a centralized dashboard
- Update colors, logos, and content for any tenant
- Upload and manage logo assets (primary, dark mode, favicon, email, mobile)
- Preview branding changes before publishing
- Rollback branding to previous versions
- Validate WCAG contrast between colors and logos
- View audit trail of who changed what and when

**As a System, I must:**
- Enforce domain invariants at all layers
- Validate WCAG AA compliance before accepting changes
- Track all changes with optimistic locking (version control)
- Emit domain events for cross-context integration
- Cache branding data for mobile/public API performance

---

## 🚨 **CRITICAL ARCHITECTURAL DECISIONS RESOLVED**

### **DECISION 1: API Routing Pattern (RESOLVED)**

**Conflict Identified:** Two different patterns in architecture docs:
- `/platform/api/branding` (from Phase 3 TODOs)
- `/api/v1/admin/branding` (from CLAUDE.md)

**✅ APPROVED ROUTING:**
```
PLATFORM ADMIN (CASE 3):
POST /api/v1/commands                          # Command bus endpoint
GET  /api/v1/admin/branding                    # List all tenants (CQRS read)
GET  /api/v1/admin/branding/{tenantId}         # Get specific tenant (CQRS read)
POST /api/v1/admin/branding/{tenantId}/preview # Preview changes

TENANT ADMIN (CASE 4):
GET  /{tenant}/api/v1/branding                 # Get own branding (CQRS read)
POST /api/v1/commands                          # Uses same command bus

PUBLIC (CASE 1 - Already Implemented):
GET  /mapi/v1/public/branding/{tenantSlug}     # Mobile API
```

**Rationale:**
- Command-driven API uses single `/api/v1/commands` endpoint for all mutations
- Read operations use RESTful endpoints for admin convenience
- Aligns with 6-Case routing system
- Clear separation between platform admin and tenant admin

---

### **DECISION 2: Aggregate Root Design (CORRECTED)**

**Original Mistake:** Treating `TenantBranding` (database table entity) as aggregate root

**✅ CORRECTED DESIGN:**
```php
// ❌ WRONG (from original plan)
class TenantBranding extends AggregateRoot {
    // This is a database table entity, not a domain aggregate
}

// ✅ CORRECT (DDD-compliant)
class BrandingBundle implements AggregateRoot {
    private BrandingBundleId $id;
    private TenantId $tenantId;
    private BrandingVisuals $visuals;
    private BrandingContent $content;
    private BrandingAssets $assets;        // ✅ Asset integration
    private BrandingMetadata $metadata;     // Version, audit trail

    // Business rules enforced here
    public function updateColors(...): void;
    public function updateLogo(...): void;
    public function publish(): void;
}
```

**Rationale:**
- `BrandingBundle` represents the complete branding configuration
- Enforces domain invariants (WCAG validation, dimension checks)
- Database table `tenant_brandings` is just persistence detail
- Aggregate emits domain events for all state changes

---

### **DECISION 3: Command-Driven vs RESTful API (RESOLVED)**

**Original Mistake:** RESTful CRUD endpoints like `PUT /api/v1/admin/branding/{tenantId}`

**✅ APPROVED PATTERN:**
```php
// ❌ WRONG - RESTful but not domain-driven
PUT /api/v1/admin/branding/{tenantId}
{
  "primaryColor": "#1976D2",
  "secondaryColor": "#FF5722"
}

// ✅ CORRECT - Command-driven API
POST /api/v1/commands
{
  "commandType": "UpdateBrandingColors",
  "tenantId": "nrna",
  "primaryColor": "#1976D2",
  "secondaryColor": "#FF5722",
  "updaterId": "admin-123",
  "expectedVersion": 5
}
```

**Rationale:**
- Commands make business intent explicit
- Enable optimistic locking via `expectedVersion`
- Support complex validations before handling
- Emit domain events for audit trail
- Allow future CQRS/Event Sourcing evolution

---

### **DECISION 4: Asset Management Integration (MANDATORY)**

**Gap Identified:** Current domain model only has `logoUrl` string - insufficient for production

**✅ APPROVED ARCHITECTURE:**

```php
// Domain Model
final class BrandingAssets implements ValueObject {
    public function __construct(
        private ?LogoReference $primaryLogo = null,
        private ?LogoReference $darkModeLogo = null,
        private ?LogoReference $favicon = null,
        private ?LogoReference $emailLogo = null,
        private ?LogoReference $mobileLogo = null
    ) {}
}

final class LogoReference implements ValueObject {
    public function __construct(
        private AssetId $assetId,          // UUID from branding_assets table
        private LogoUrl $url,              // CDN URL (Cloudinary/S3)
        private Dimensions $dimensions,     // Width x Height validation
        private ?Color $dominantColor,      // For WCAG contrast checks
        private ?FileHash $fileHash         // For deduplication
    ) {}
}

// Database Schema
CREATE TABLE branding_assets (
    id UUID PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    asset_id VARCHAR(100) NOT NULL,
    logo_type VARCHAR(50) NOT NULL,
    cdn_provider VARCHAR(50) NOT NULL,
    cdn_url VARCHAR(500) NOT NULL,
    dimensions JSONB NOT NULL,
    dominant_color VARCHAR(7) NULL,
    file_hash VARCHAR(64) NOT NULL,
    uploaded_by BIGINT REFERENCES users(id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMP NULL,
    UNIQUE(asset_id),
    UNIQUE(tenant_id, logo_type) WHERE deactivated_at IS NULL
);
```

**Rationale:**
- Assets are first-class domain citizens
- CDN URLs stored, not binary data
- Dominant color enables WCAG validation
- Version control via soft-delete (deactivated_at)
- Supports multiple logo variants (primary, dark mode, favicon, etc.)

---

### **DECISION 5: WCAG Validation Location (CORRECTED)**

**Original Mistake:** WCAG validation in application service layer

**✅ APPROVED LOCATION:** Domain Layer

```php
// ✅ CORRECT - Domain business rule
class BrandingBundle implements AggregateRoot {
    public function updateColors(
        BrandingColor $primaryColor,
        BrandingColor $secondaryColor,
        UserId $updater
    ): void {
        // Business rule: Validate contrast
        if (!$primaryColor->hasAdequateContrastWith($secondaryColor)) {
            throw new WcagContrastViolation(
                "Primary and secondary colors must have 4.5:1 contrast ratio"
            );
        }

        // Business rule: Validate with logo dominant color
        if ($this->assets->hasPrimaryLogo()) {
            $logoColor = $this->assets->primaryLogo()->dominantColor();
            if (!$primaryColor->hasAdequateContrastWith($logoColor)) {
                throw new WcagContrastViolation(
                    "Primary color must have adequate contrast with logo"
                );
            }
        }

        // ... update colors
    }
}
```

**Rationale:**
- WCAG compliance is a business rule, not a technical concern
- Domain layer enforces invariants
- Application layer just orchestrates
- Enables testing without framework dependencies

---

## 📐 **DOMAIN MODEL ARCHITECTURE**

### **Bounded Context:** Platform::Branding (Existing - No New Context)

### **Aggregate Root:** BrandingBundle

```
BrandingBundle (Aggregate Root)
├── BrandingBundleId (Identity VO)
├── TenantId (Reference to tenant)
├── BrandingVisuals (VO)
│   ├── BrandingColor (primaryColor)
│   ├── BrandingColor (secondaryColor)
│   ├── FontFamily (optional)
│   └── LogoUrl (deprecated → migrated to BrandingAssets)
├── BrandingContent (VO)
│   ├── WelcomeMessage
│   ├── HeroTitle
│   ├── HeroSubtitle
│   └── CtaText
├── BrandingAssets (VO) ✨ NEW
│   ├── LogoReference (primary)
│   ├── LogoReference (darkMode)
│   ├── LogoReference (favicon)
│   ├── LogoReference (email)
│   └── LogoReference (mobile)
└── BrandingMetadata (VO)
    ├── Version (optimistic locking)
    ├── AuditTrail (changes history)
    ├── PublishedAt (optional)
    └── DraftState (optional)
```

### **Domain Events:**
```php
- BrandingColorsUpdated
- LogoUploaded
- LogoUpdated
- BrandingPublished
- BrandingRolledBack
- WcagViolationDetected
```

### **Domain Exceptions:**
```php
- InvalidBrandingException
- WcagContrastViolation
- InvalidLogoDimensionsException
- ConcurrencyException (version mismatch)
- LogoProcessingFailedException
```

---

## 🏗️ **IMPLEMENTATION ROADMAP: 28 DAYS**

### **WEEK 1: DOMAIN MODEL & COMMANDS (Days 1-7)**

#### **Day 1: Domain Tests - Asset Integration**
**TDD First:** Write failing tests

```php
// tests/Unit/Contexts/Platform/Domain/Models/BrandingBundleTest.php

/** @test */
public function it_can_update_logo_with_domain_validation(): void
{
    // Given
    $bundle = BrandingBundleFactory::withPrimaryLogo();
    $newLogo = LogoReferenceFactory::create([
        'dimensions' => new Dimensions(800, 400),
        'assetId' => AssetId::generate(),
    ]);

    // When
    $bundle->updateLogo(LogoType::PRIMARY, $newLogo, UserId::fromString('user-123'));

    // Then
    $events = $bundle->releaseEvents();
    $this->assertCount(1, $events);
    $this->assertInstanceOf(LogoUpdated::class, $events[0]);
}

/** @test */
public function it_rejects_logo_with_wrong_dimensions(): void
{
    // Given
    $bundle = BrandingBundleFactory::create();
    $wrongSizeLogo = LogoReferenceFactory::create([
        'dimensions' => new Dimensions(1000, 1000), // Too large
    ]);

    // When/Then
    $this->expectException(InvalidLogoDimensionsException::class);
    $bundle->updateLogo(LogoType::PRIMARY, $wrongSizeLogo, UserId::fromString('user-123'));
}

/** @test */
public function it_validates_wcag_contrast_with_logo(): void
{
    // Given: Logo with black dominant color
    $logo = LogoReferenceFactory::withDominantColor('#000000');
    $bundle = BrandingBundleFactory::withLogo($logo);

    // When: Try to set white text (poor contrast)
    $this->expectException(WcagContrastViolation::class);
    $bundle->updateColors(
        BrandingColor::fromHex('#FFFFFF'),
        BrandingColor::fromHex('#F0F0F0'),
        UserId::fromString('user-123')
    );
}
```

**Deliverables:**
- [ ] `BrandingBundleTest.php` with 20+ asset scenarios
- [ ] All tests RED (failing)

---

#### **Day 2-3: Value Objects Implementation**

**Implement:** Asset-enabled value objects

```php
// app/Contexts/Platform/Domain/ValueObjects/BrandingAssets.php
final class BrandingAssets implements ValueObject {
    private array $logos;

    public function __construct(
        ?LogoReference $primaryLogo = null,
        ?LogoReference $darkModeLogo = null,
        ?LogoReference $favicon = null,
        ?LogoReference $emailLogo = null,
        ?LogoReference $mobileLogo = null
    ) {
        $this->logos = array_filter([...]);
        $this->validateAssetRelationships();
    }

    public function withUpdatedLogo(LogoType $type, LogoReference $logo): self
    {
        $newLogos = $this->logos;
        $newLogos[$type->value()] = $logo;
        return new self(...array_values($newLogos));
    }
}

// app/Contexts/Platform/Domain/ValueObjects/LogoReference.php
final class LogoReference implements ValueObject {
    public function __construct(
        private AssetId $assetId,
        private LogoUrl $url,
        private Dimensions $dimensions,
        private ?Color $dominantColor = null,
        private ?FileHash $fileHash = null
    ) {
        $this->validate();
    }
}

// app/Contexts/Platform/Domain/ValueObjects/Dimensions.php
final class Dimensions implements ValueObject {
    public function __construct(
        private int $width,
        private int $height
    ) {
        if ($width <= 0 || $height <= 0) {
            throw new InvalidArgumentException("Dimensions must be positive");
        }
    }

    public function isWithinTolerance(Dimensions $required, float $tolerance = 0.2): bool
    {
        // Allow 20% deviation from required dimensions
        $widthRatio = abs($this->width - $required->width) / $required->width;
        $heightRatio = abs($this->height - $required->height) / $required->height;

        return $widthRatio <= $tolerance && $heightRatio <= $tolerance;
    }
}
```

**Deliverables:**
- [ ] `BrandingAssets.php`
- [ ] `LogoReference.php`
- [ ] `LogoUrl.php`
- [ ] `AssetId.php`
- [ ] `Dimensions.php`
- [ ] `FileHash.php`
- [ ] All value object tests GREEN

---

#### **Day 4-5: Aggregate Implementation**

**Implement:** BrandingBundle aggregate with asset methods

```php
// app/Contexts/Platform/Domain/Models/BrandingBundle.php
final class BrandingBundle implements AggregateRoot {
    use RecordsEvents;

    private BrandingBundleId $id;
    private TenantId $tenantId;
    private BrandingVisuals $visuals;
    private BrandingContent $content;
    private BrandingAssets $assets;
    private BrandingMetadata $metadata;

    public function updateLogo(
        LogoType $type,
        LogoReference $logoReference,
        UserId $updater
    ): void {
        // Business rule: Validate dimensions per type
        $this->validateLogoDimensions($type, $logoReference);

        // Update assets
        $this->assets = $this->assets->withUpdatedLogo($type, $logoReference);

        // Update metadata
        $this->metadata = $this->metadata->recordUpdate($updater);

        // Emit event
        $this->recordThat(new LogoUpdated(
            $this->tenantId,
            $type,
            $logoReference->assetId(),
            $this->metadata->version()
        ));
    }

    public function updateColors(
        BrandingColor $primaryColor,
        BrandingColor $secondaryColor,
        UserId $updater
    ): void {
        // Business rule: WCAG validation
        if (!$primaryColor->hasAdequateContrastWith($secondaryColor)) {
            throw new WcagContrastViolation("Insufficient contrast ratio");
        }

        // Business rule: Validate with logo
        if ($this->assets->hasPrimaryLogo()) {
            $logoColor = $this->assets->primaryLogo()->dominantColor();
            if ($logoColor && !$primaryColor->hasAdequateContrastWith($logoColor)) {
                throw new WcagContrastViolation("Insufficient contrast with logo");
            }
        }

        $newVisuals = $this->visuals->withColors($primaryColor, $secondaryColor);
        $this->visuals = $newVisuals;
        $this->metadata = $this->metadata->recordUpdate($updater);

        $this->recordThat(new BrandingColorsUpdated(
            $this->tenantId,
            $primaryColor,
            $secondaryColor,
            $this->metadata->version()
        ));
    }

    private function validateLogoDimensions(LogoType $type, LogoReference $logo): void
    {
        $requiredDimensions = match($type) {
            LogoType::PRIMARY => new Dimensions(800, 400),
            LogoType::FAVICON => new Dimensions(64, 64),
            LogoType::EMAIL => new Dimensions(600, 300),
            LogoType::MOBILE => new Dimensions(512, 512),
            LogoType::DARK_MODE => new Dimensions(800, 400),
        };

        if (!$logo->dimensions()->isWithinTolerance($requiredDimensions)) {
            throw new InvalidLogoDimensionsException(
                "Logo dimensions must be approximately {$requiredDimensions}"
            );
        }
    }
}
```

**Deliverables:**
- [ ] `BrandingBundle.php` with all business methods
- [ ] Domain event classes
- [ ] Domain exception classes
- [ ] All domain tests GREEN

---

#### **Day 6-7: Commands & Command Handlers**

**Implement:** Command objects and handlers

```php
// app/Contexts/Platform/Application/Commands/UploadLogoCommand.php
final class UploadLogoCommand implements Command {
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly UserId $uploaderId,
        public readonly LogoType $logoType,
        public readonly UploadedFile $file,
        public readonly int $expectedVersion
    ) {
        $this->validateFile();
    }

    private function validateFile(): void
    {
        if ($this->file->getSize() > 2 * 1024 * 1024) {
            throw new FileTooLargeException('Logo must be under 2MB');
        }

        $allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
        if (!in_array($this->file->getMimeType(), $allowedTypes)) {
            throw new InvalidFileTypeException('Invalid logo format');
        }
    }
}

// app/Contexts/Platform/Application/Commands/UpdateBrandingColorsCommand.php
final class UpdateBrandingColorsCommand implements Command {
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly UserId $updaterId,
        public readonly BrandingColor $primaryColor,
        public readonly BrandingColor $secondaryColor,
        public readonly int $expectedVersion
    ) {}
}

// app/Contexts/Platform/Application/Handlers/UploadLogoHandler.php
final class UploadLogoHandler implements CommandHandler {
    public function __construct(
        private BrandingBundleRepository $repository,
        private LogoProcessingService $logoService,
        private EventDispatcher $dispatcher
    ) {}

    public function handle(UploadLogoCommand $command): LogoProcessingResult
    {
        // 1. Get aggregate
        $bundle = $this->repository->findForTenant($command->tenantId);

        // 2. Validate optimistic locking
        if ($bundle->metadata()->version() !== $command->expectedVersion) {
            throw new ConcurrencyException();
        }

        // 3. Process logo (CDN upload, resize, optimize)
        $processingResult = $this->logoService->processUpload(
            $command->file,
            $command->tenantId,
            $command->logoType,
            $command->uploaderId
        );

        // 4. Create domain value object
        $logoReference = new LogoReference(
            $processingResult->assetId(),
            new LogoUrl($processingResult->cdnUrl()),
            $processingResult->dimensions(),
            $processingResult->dominantColor(),
            $processingResult->fileHash()
        );

        // 5. Update aggregate
        $bundle->updateLogo($command->logoType, $logoReference, $command->uploaderId);

        // 6. Persist
        $this->repository->save($bundle);

        // 7. Dispatch events
        $this->dispatcher->dispatchAll($bundle->releaseEvents());

        return $processingResult;
    }
}
```

**Deliverables:**
- [ ] `UploadLogoCommand.php`
- [ ] `UpdateBrandingColorsCommand.php`
- [ ] `UpdateBrandingContentCommand.php`
- [ ] `PublishBrandingCommand.php`
- [ ] All command handlers
- [ ] Command handler tests GREEN

---

### **WEEK 2: INFRASTRUCTURE & CDN INTEGRATION (Days 8-14)**

#### **Day 8-9: Database Schema & Migrations**

**Implement:** Enhanced database schema

```php
// Migration: 2026_01_08_create_branding_assets_table.php
public function up(): void
{
    Schema::connection('landlord')->create('branding_assets', function (Blueprint $table) {
        $table->uuid('id')->primary();
        $table->unsignedBigInteger('tenant_id')->index();

        // Asset identification
        $table->string('asset_id', 100)->unique(); // Cloudinary public_id
        $table->string('logo_type', 50); // primary, dark_mode, favicon, etc.

        // CDN information
        $table->string('cdn_provider', 50)->default('cloudinary');
        $table->string('cdn_url', 500);
        $table->string('storage_path', 500);

        // File metadata
        $table->string('original_filename', 255);
        $table->string('mime_type', 100);
        $table->bigInteger('file_size');
        $table->json('dimensions'); // {width: 800, height: 400}
        $table->string('dominant_color', 7)->nullable(); // Hex color for WCAG
        $table->string('file_hash', 64); // For deduplication

        // Versions (different sizes)
        $table->json('versions_json')->default('{}');

        // Audit
        $table->unsignedBigInteger('uploaded_by')->nullable();
        $table->timestamp('uploaded_at')->useCurrent();
        $table->timestamp('deactivated_at')->nullable();

        // Foreign keys
        $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        $table->foreign('uploaded_by')->references('id')->on('users')->onDelete('set null');

        // Constraints
        $table->unique(['tenant_id', 'logo_type'], 'unique_active_logo')
              ->where('deactivated_at', null);

        // Indexes
        $table->index(['tenant_id', 'logo_type', 'uploaded_at'], 'idx_branding_assets_lookup');
    });
}

// Migration: 2026_01_08_add_assets_to_tenant_brandings.php
public function up(): void
{
    Schema::connection('landlord')->table('tenant_brandings', function (Blueprint $table) {
        $table->json('assets_json')->default('{}')->after('content_json');
        $table->json('metadata_json')->default('{"version": 1}')->after('assets_json');
    });
}
```

**Deliverables:**
- [ ] `create_branding_assets_table.php` migration
- [ ] `add_assets_to_tenant_brandings.php` migration
- [ ] Migration tests (rollback verification)

---

#### **Day 10-11: CDN Integration Service**

**Implement:** Logo processing with CDN upload

```php
// app/Contexts/Platform/Infrastructure/Services/LogoProcessingService.php
final class LogoProcessingService {
    public function __construct(
        private CloudinaryAdapter $cdnService,
        private ColorExtractionService $colorExtractor,
        private AssetRepository $assetRepository
    ) {}

    public function processUpload(
        UploadedFile $file,
        TenantId $tenantId,
        LogoType $logoType,
        UserId $uploaderId
    ): LogoProcessingResult {
        // 1. Extract dominant color (for WCAG validation)
        $dominantColor = $this->colorExtractor->extractDominantColor($file);

        // 2. Upload to CDN with transformations
        $cdnResult = $this->cdnService->uploadAndOptimize(
            $file,
            $this->getCdnOptions($logoType, $tenantId)
        );

        // 3. Create database record
        $asset = $this->createAssetRecord(
            $tenantId,
            $logoType,
            $cdnResult,
            $uploaderId,
            $dominantColor
        );

        // 4. Create optimized versions
        $versions = $this->createOptimizedVersions($cdnResult, $logoType);

        return new LogoProcessingResult(
            assetId: AssetId::fromString($asset->id),
            cdnUrl: $cdnResult->secureUrl,
            dimensions: new Dimensions($cdnResult->width, $cdnResult->height),
            dominantColor: $dominantColor ? Color::fromHex($dominantColor) : null,
            fileHash: FileHash::fromString($cdnResult->fileHash),
            versions: $versions
        );
    }

    private function getCdnOptions(LogoType $type, TenantId $tenantId): array
    {
        return [
            'folder' => "tenants/{$tenantId->toString()}/logos",
            'public_id' => "{$type->value()}_{$this->generateHash()}",
            'transformation' => $this->getTransformationsForType($type),
            'tags' => ["tenant:{$tenantId->toString()}", "type:{$type->value()}"],
            'quality' => 'auto:best',
            'fetch_format' => 'auto',
        ];
    }

    private function getTransformationsForType(LogoType $type): array
    {
        return match($type) {
            LogoType::PRIMARY => ['width' => 800, 'height' => 400, 'crop' => 'fit'],
            LogoType::FAVICON => ['width' => 64, 'height' => 64, 'crop' => 'fill'],
            LogoType::EMAIL => ['width' => 600, 'height' => 300, 'crop' => 'fit'],
            LogoType::MOBILE => ['width' => 512, 'height' => 512, 'crop' => 'fit'],
            LogoType::DARK_MODE => ['width' => 800, 'height' => 400, 'crop' => 'fit'],
        };
    }
}

// app/Contexts/Platform/Infrastructure/Adapters/CloudinaryAdapter.php
final class CloudinaryAdapter {
    public function uploadAndOptimize(UploadedFile $file, array $options): CloudinaryUploadResult
    {
        $cloudinary = new \Cloudinary\Cloudinary([
            'cloud' => [
                'cloud_name' => config('services.cloudinary.cloud_name'),
                'api_key' => config('services.cloudinary.api_key'),
                'api_secret' => config('services.cloudinary.api_secret'),
            ],
        ]);

        $result = $cloudinary->uploadApi()->upload(
            $file->getRealPath(),
            $options
        );

        return new CloudinaryUploadResult(
            publicId: $result['public_id'],
            secureUrl: $result['secure_url'],
            width: $result['width'],
            height: $result['height'],
            format: $result['format'],
            resourceType: $result['resource_type'],
            fileHash: hash_file('sha256', $file->getRealPath())
        );
    }
}
```

**Deliverables:**
- [ ] `LogoProcessingService.php`
- [ ] `CloudinaryAdapter.php`
- [ ] `ColorExtractionService.php`
- [ ] CDN integration tests
- [ ] Environment configuration

---

#### **Day 12-13: Repository Implementation**

**Implement:** Enhanced repository with asset serialization

```php
// app/Contexts/Platform/Infrastructure/Repositories/EloquentBrandingBundleRepository.php
final class EloquentBrandingBundleRepository implements BrandingBundleRepository {
    public function findForTenant(TenantId $tenantId): BrandingBundle
    {
        $model = TenantBrandingModel::where('tenant_id', $tenantId->toInt())->firstOrFail();

        return $this->toDomain($model);
    }

    public function save(BrandingBundle $bundle): void
    {
        $model = TenantBrandingModel::firstOrNew([
            'tenant_id' => $bundle->getTenantId()->toInt(),
        ]);

        $model->visuals_json = $this->serializeVisuals($bundle->getVisuals());
        $model->content_json = $this->serializeContent($bundle->getContent());
        $model->assets_json = $this->serializeAssets($bundle->getAssets());
        $model->metadata_json = $this->serializeMetadata($bundle->getMetadata());

        $model->save();
    }

    private function toDomain(TenantBrandingModel $model): BrandingBundle
    {
        return new BrandingBundle(
            id: BrandingBundleId::fromString($model->id),
            tenantId: TenantId::fromInt($model->tenant_id),
            visuals: $this->deserializeVisuals($model->visuals_json),
            content: $this->deserializeContent($model->content_json),
            assets: $this->deserializeAssets($model->assets_json),
            metadata: $this->deserializeMetadata($model->metadata_json)
        );
    }

    private function serializeAssets(BrandingAssets $assets): array
    {
        return [
            'primary' => $assets->primaryLogo()
                ? $this->serializeLogoReference($assets->primaryLogo())
                : null,
            'dark_mode' => $assets->darkModeLogo()
                ? $this->serializeLogoReference($assets->darkModeLogo())
                : null,
            // ... other logo types
        ];
    }

    private function serializeLogoReference(LogoReference $logo): array
    {
        return [
            'assetId' => $logo->assetId()->toString(),
            'url' => $logo->url()->toString(),
            'dimensions' => [
                'width' => $logo->dimensions()->width(),
                'height' => $logo->dimensions()->height(),
            ],
            'dominantColor' => $logo->dominantColor()?->toHex(),
            'fileHash' => $logo->fileHash()?->toString(),
        ];
    }
}
```

**Deliverables:**
- [ ] `EloquentBrandingBundleRepository.php`
- [ ] Asset serialization/deserialization
- [ ] Repository integration tests

---

#### **Day 14: CQRS Read Models**

**Implement:** Optimized read models for admin queries

```php
// app/Contexts/Platform/Application/ReadModels/AdminBrandingView.php
final class AdminBrandingView implements ReadModel {
    public function __construct(
        public readonly string $tenantId,
        public readonly string $tenantName,
        public readonly BrandingVisualsDTO $visuals,
        public readonly BrandingContentDTO $content,
        public readonly BrandingAssetsDTO $assets,
        public readonly BrandingMetadataDTO $metadata,
        public readonly array $logoHistory,
        public readonly ?string $previewUrl
    ) {}
}

// app/Contexts/Platform/Application/Queries/GetAllTenantBrandingQuery.php
final class GetAllTenantBrandingQuery implements Query {
    public function __construct(
        public readonly ?int $page = 1,
        public readonly ?int $perPage = 20,
        public readonly ?string $searchTerm = null
    ) {}
}

// app/Contexts/Platform/Application/Queries/Handlers/GetAllTenantBrandingHandler.php
final class GetAllTenantBrandingHandler implements QueryHandler {
    public function handle(GetAllTenantBrandingQuery $query): AdminBrandingCollection
    {
        $models = TenantBrandingModel::with('tenant', 'activeAssets')
            ->when($query->searchTerm, fn($q) => $q->whereHas('tenant', fn($q) =>
                $q->where('name', 'LIKE', "%{$query->searchTerm}%")
            ))
            ->paginate($query->perPage);

        return new AdminBrandingCollection(
            items: $models->map(fn($model) => $this->toAdminView($model)),
            total: $models->total(),
            page: $models->currentPage(),
            perPage: $models->perPage()
        );
    }
}
```

**Deliverables:**
- [ ] `AdminBrandingView.php` read model
- [ ] Query objects and handlers
- [ ] DTO classes for data transfer

---

### **WEEK 3: API LAYER & CONTROLLERS (Days 15-21)**

#### **Day 15-16: Admin API Controllers**

**Implement:** Command and Query controllers

```php
// routes/platform-api/branding.php
Route::prefix('admin/branding')->middleware(['auth:sanctum', 'admin'])->group(function () {
    // CQRS Read endpoints
    Route::get('/', [BrandingQueryController::class, 'index']);
    Route::get('/{tenant}', [BrandingQueryController::class, 'show']);
    Route::get('/{tenant}/preview', [BrandingQueryController::class, 'preview']);
    Route::get('/{tenant}/history', [BrandingQueryController::class, 'history']);
});

Route::prefix('commands')->middleware(['auth:sanctum', 'admin'])->group(function () {
    // Command bus endpoint
    Route::post('/', [CommandBusController::class, 'dispatch']);
});

Route::prefix('admin/branding/{tenant}')->middleware(['auth:sanctum', 'admin'])->group(function () {
    // Specialized upload endpoint (multipart/form-data)
    Route::post('/upload-logo', [BrandingCommandController::class, 'uploadLogo']);
});

// app/Contexts/Platform/Infrastructure/Http/Controllers/Admin/BrandingQueryController.php
final class BrandingQueryController extends Controller {
    public function index(Request $request): JsonResponse
    {
        $query = new GetAllTenantBrandingQuery(
            page: $request->query('page', 1),
            perPage: $request->query('per_page', 20),
            searchTerm: $request->query('search')
        );

        $result = $this->queryBus->dispatch($query);

        return response()->json([
            'data' => $result->items,
            'meta' => [
                'total' => $result->total,
                'page' => $result->page,
                'per_page' => $result->perPage,
            ],
        ]);
    }

    public function show(string $tenant): JsonResponse
    {
        $query = new GetTenantBrandingQuery(
            tenantId: TenantId::fromString($tenant)
        );

        $branding = $this->queryBus->dispatch($query);

        return response()->json(['data' => $branding]);
    }
}

// app/Contexts/Platform/Infrastructure/Http/Controllers/Admin/BrandingCommandController.php
final class BrandingCommandController extends Controller {
    public function uploadLogo(
        UploadLogoRequest $request,
        string $tenant
    ): JsonResponse {
        $command = new UploadLogoCommand(
            tenantId: TenantId::fromString($tenant),
            uploaderId: UserId::fromInt(auth()->id()),
            logoType: LogoType::from($request->input('type')),
            file: $request->file('logo'),
            expectedVersion: $request->input('expected_version')
        );

        $result = $this->commandBus->dispatch($command);

        return response()->json([
            'success' => true,
            'data' => [
                'assetId' => $result->assetId()->toString(),
                'url' => $result->cdnUrl(),
                'preview' => $result->previewUrl(),
                'dimensions' => $result->dimensions()->toArray(),
                'newVersion' => $result->newVersion(),
            ],
        ]);
    }
}

// app/Contexts/Platform/Infrastructure/Http/Controllers/CommandBusController.php
final class CommandBusController extends Controller {
    public function dispatch(Request $request): JsonResponse
    {
        $commandType = $request->input('commandType');

        $command = match($commandType) {
            'UpdateBrandingColors' => new UpdateBrandingColorsCommand(
                tenantId: TenantId::fromString($request->input('tenantId')),
                updaterId: UserId::fromInt(auth()->id()),
                primaryColor: BrandingColor::fromHex($request->input('primaryColor')),
                secondaryColor: BrandingColor::fromHex($request->input('secondaryColor')),
                expectedVersion: $request->input('expectedVersion')
            ),
            'UpdateBrandingContent' => new UpdateBrandingContentCommand(
                // ... construct command
            ),
            'PublishBranding' => new PublishBrandingCommand(
                // ... construct command
            ),
            default => throw new UnknownCommandException("Unknown command: {$commandType}")
        };

        $this->commandBus->dispatch($command);

        return response()->json(['success' => true]);
    }
}
```

**Deliverables:**
- [ ] `BrandingQueryController.php`
- [ ] `BrandingCommandController.php`
- [ ] `CommandBusController.php`
- [ ] Route definitions
- [ ] Form request validators
- [ ] API integration tests

---

#### **Day 17-18: Event Handlers & Projections**

**Implement:** Event listeners for cache invalidation and read model updates

```php
// app/Contexts/Platform/Application/EventHandlers/BrandingEventSubscriber.php
final class BrandingEventSubscriber {
    public function __construct(
        private CacheManager $cache,
        private AdminBrandingProjection $projection
    ) {}

    public function onLogoUpdated(LogoUpdated $event): void
    {
        // 1. Update read model
        $this->projection->updateLogo(
            $event->tenantId(),
            $event->logoType(),
            [
                'assetId' => $event->assetId()->toString(),
                'uploadedAt' => now(),
            ]
        );

        // 2. Invalidate cache
        $this->cache->tags(['branding', "tenant:{$event->tenantId()}"])->flush();

        // 3. Notify mobile API cache
        event(new MobileBrandingCacheInvalidated($event->tenantId()));
    }

    public function onBrandingColorsUpdated(BrandingColorsUpdated $event): void
    {
        // Similar cache invalidation
    }

    public function subscribe(Dispatcher $events): array
    {
        return [
            LogoUpdated::class => 'onLogoUpdated',
            BrandingColorsUpdated::class => 'onBrandingColorsUpdated',
            BrandingPublished::class => 'onBrandingPublished',
        ];
    }
}

// app/Contexts/Platform/Infrastructure/Projections/AdminBrandingProjection.php
final class AdminBrandingProjection {
    public function updateLogo(TenantId $tenantId, LogoType $type, array $data): void
    {
        // Update materialized view or cache
        DB::connection('landlord')->table('v_admin_branding')
            ->where('tenant_id', $tenantId->toInt())
            ->update([
                "logo_{$type->value()}_url" => $data['url'] ?? null,
                "logo_{$type->value()}_updated_at" => $data['uploadedAt'],
            ]);
    }
}
```

**Deliverables:**
- [ ] `BrandingEventSubscriber.php`
- [ ] `AdminBrandingProjection.php`
- [ ] Cache invalidation logic
- [ ] Event handler tests

---

#### **Day 19-21: API Documentation & Testing**

**Implement:** API tests and documentation

```php
// tests/Feature/Api/Admin/BrandingApiTest.php
class BrandingApiTest extends TestCase {
    use RefreshDatabase;

    /** @test */
    public function admin_can_list_all_tenant_branding(): void
    {
        // Given
        Tenant::factory()->count(3)->create();
        TenantBrandingModel::factory()->count(3)->create();
        $admin = User::factory()->create(['is_admin' => true]);

        // When
        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/branding');

        // Then
        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'tenantId',
                        'tenantName',
                        'visuals',
                        'content',
                        'assets',
                        'metadata',
                    ],
                ],
                'meta' => ['total', 'page', 'per_page'],
            ])
            ->assertJsonCount(3, 'data');
    }

    /** @test */
    public function admin_can_upload_logo_for_tenant(): void
    {
        // Given
        Storage::fake('cloudinary');
        $tenant = Tenant::factory()->create();
        $branding = TenantBrandingModel::factory()->for($tenant)->create([
            'metadata_json' => ['version' => 5],
        ]);
        $admin = User::factory()->create(['is_admin' => true]);

        $file = UploadedFile::fake()->image('logo.png', 800, 400);

        // When
        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/branding/{$tenant->slug}/upload-logo", [
                'type' => 'primary',
                'logo' => $file,
                'expected_version' => 5,
            ]);

        // Then
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'assetId',
                    'url',
                    'preview',
                    'dimensions',
                    'newVersion',
                ],
            ]);

        $this->assertDatabaseHas('branding_assets', [
            'tenant_id' => $tenant->id,
            'logo_type' => 'primary',
            'deactivated_at' => null,
        ]);
    }

    /** @test */
    public function upload_fails_with_version_mismatch(): void
    {
        // Given
        $tenant = Tenant::factory()->create();
        $branding = TenantBrandingModel::factory()->for($tenant)->create([
            'metadata_json' => ['version' => 10],
        ]);
        $admin = User::factory()->create(['is_admin' => true]);

        $file = UploadedFile::fake()->image('logo.png', 800, 400);

        // When
        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/branding/{$tenant->slug}/upload-logo", [
                'type' => 'primary',
                'logo' => $file,
                'expected_version' => 5, // Wrong version
            ]);

        // Then
        $response->assertStatus(409) // Conflict
            ->assertJson([
                'error' => 'ConcurrencyException',
                'message' => 'Branding was modified by another user',
            ]);
    }

    /** @test */
    public function update_colors_via_command_bus(): void
    {
        // Given
        $tenant = Tenant::factory()->create();
        $branding = TenantBrandingModel::factory()->for($tenant)->create([
            'metadata_json' => ['version' => 3],
        ]);
        $admin = User::factory()->create(['is_admin' => true]);

        // When
        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/commands', [
                'commandType' => 'UpdateBrandingColors',
                'tenantId' => $tenant->slug,
                'primaryColor' => '#1976D2',
                'secondaryColor' => '#FF5722',
                'expectedVersion' => 3,
            ]);

        // Then
        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $branding->refresh();
        $this->assertEquals('#1976D2', $branding->visuals_json['primaryColor']);
        $this->assertEquals(4, $branding->metadata_json['version']);
    }
}
```

**Deliverables:**
- [ ] Comprehensive API tests (20+ scenarios)
- [ ] Postman/OpenAPI documentation
- [ ] Rate limiting configuration
- [ ] Security testing (CSRF, XSS, file upload attacks)

---

### **WEEK 4: VUE 3 ADMIN DASHBOARD (Days 22-28)**

#### **Day 22-23: Pinia Store & API Client**

**Implement:** State management and API integration

```typescript
// resources/js/Stores/BrandingStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AdminBrandingView, LogoType, LogoUploadResult } from '@/Types/Branding'
import { brandingApi } from '@/Services/BrandingApiClient'

export const useBrandingStore = defineStore('branding', () => {
  // State
  const allBranding = ref<AdminBrandingView[]>([])
  const currentBranding = ref<AdminBrandingView | null>(null)
  const isLoading = ref(false)
  const uploadProgress = ref<Record<string, number>>({})
  const error = ref<string | null>(null)

  // Getters
  const currentVersion = computed(() => currentBranding.value?.metadata.version ?? 0)

  // Actions
  const loadAllBranding = async (searchTerm?: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await brandingApi.getAll({ searchTerm })
      allBranding.value = response.data
    } catch (e) {
      error.value = 'Failed to load branding data'
      console.error(e)
    } finally {
      isLoading.value = false
    }
  }

  const loadTenantBranding = async (tenantId: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await brandingApi.getTenant(tenantId)
      currentBranding.value = response.data
    } catch (e) {
      error.value = 'Failed to load tenant branding'
      console.error(e)
    } finally {
      isLoading.value = false
    }
  }

  const uploadLogo = async (
    tenantId: string,
    logoType: LogoType,
    file: File
  ): Promise<LogoUploadResult> => {
    try {
      const formData = new FormData()
      formData.append('logo', file)
      formData.append('type', logoType)
      formData.append('expected_version', currentVersion.value.toString())

      const result = await brandingApi.uploadLogo(
        tenantId,
        formData,
        (progressEvent) => {
          uploadProgress.value[logoType] = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total ?? 100)
          )
        }
      )

      // Update local state
      if (currentBranding.value) {
        currentBranding.value.assets[logoType] = {
          url: result.data.url,
          assetId: result.data.assetId,
          dimensions: result.data.dimensions,
        }
        currentBranding.value.metadata.version = result.data.newVersion
      }

      return result.data
    } finally {
      delete uploadProgress.value[logoType]
    }
  }

  const updateColors = async (
    tenantId: string,
    primaryColor: string,
    secondaryColor: string
  ): Promise<void> => {
    const command = {
      commandType: 'UpdateBrandingColors',
      tenantId,
      primaryColor,
      secondaryColor,
      expectedVersion: currentVersion.value,
    }

    await brandingApi.sendCommand(command)

    // Update local state optimistically
    if (currentBranding.value) {
      currentBranding.value.visuals.primaryColor = primaryColor
      currentBranding.value.visuals.secondaryColor = secondaryColor
      currentBranding.value.metadata.version++
    }
  }

  return {
    // State
    allBranding,
    currentBranding,
    isLoading,
    uploadProgress,
    error,

    // Getters
    currentVersion,

    // Actions
    loadAllBranding,
    loadTenantBranding,
    uploadLogo,
    updateColors,
  }
})

// resources/js/Services/BrandingApiClient.ts
import axios from 'axios'
import type { AxiosProgressEvent } from 'axios'

export const brandingApi = {
  getAll: async (params?: { searchTerm?: string; page?: number }) => {
    return axios.get('/api/v1/admin/branding', { params })
  },

  getTenant: async (tenantId: string) => {
    return axios.get(`/api/v1/admin/branding/${tenantId}`)
  },

  uploadLogo: async (
    tenantId: string,
    formData: FormData,
    onProgress?: (event: AxiosProgressEvent) => void
  ) => {
    return axios.post(
      `/api/v1/admin/branding/${tenantId}/upload-logo`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress,
      }
    )
  },

  sendCommand: async (command: any) => {
    return axios.post('/api/v1/commands', command)
  },

  getPreview: async (tenantId: string) => {
    return axios.get(`/api/v1/admin/branding/${tenantId}/preview`)
  },

  getHistory: async (tenantId: string) => {
    return axios.get(`/api/v1/admin/branding/${tenantId}/history`)
  },
}
```

**Deliverables:**
- [ ] `BrandingStore.ts` with full state management
- [ ] `BrandingApiClient.ts` with all endpoints
- [ ] TypeScript type definitions
- [ ] Vitest unit tests for store

---

#### **Day 24-25: Vue Components**

**Implement:** Admin dashboard components

```vue
<!-- resources/js/Pages/Admin/Branding/Index.vue -->
<template>
  <AdminLayout title="Tenant Branding Management">
    <div class="branding-dashboard">
      <!-- Header with search -->
      <div class="header">
        <h1>Tenant Branding</h1>
        <div class="search-bar">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Search tenants..."
            @input="debouncedSearch"
          />
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="brandingStore.isLoading" class="loading">
        <Spinner />
      </div>

      <!-- Error state -->
      <div v-else-if="brandingStore.error" class="error">
        {{ brandingStore.error }}
      </div>

      <!-- Branding list -->
      <div v-else class="branding-grid">
        <BrandingCard
          v-for="branding in brandingStore.allBranding"
          :key="branding.tenantId"
          :branding="branding"
          @edit="handleEdit"
        />
      </div>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBrandingStore } from '@/Stores/BrandingStore'
import { useDebounceFn } from '@vueuse/core'
import BrandingCard from '@/Components/Admin/Branding/BrandingCard.vue'

const brandingStore = useBrandingStore()
const searchTerm = ref('')

const debouncedSearch = useDebounceFn(() => {
  brandingStore.loadAllBranding(searchTerm.value)
}, 300)

onMounted(() => {
  brandingStore.loadAllBranding()
})

function handleEdit(tenantId: string) {
  router.push(`/admin/branding/${tenantId}/edit`)
}
</script>

<!-- resources/js/Pages/Admin/Branding/Edit.vue -->
<template>
  <AdminLayout :title="`Edit Branding: ${branding?.tenantName}`">
    <div v-if="branding" class="branding-editor">
      <!-- Tabs -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Colors Tab -->
      <div v-show="activeTab === 'Colors'" class="tab-content">
        <ColorEditor
          :branding="branding"
          @update="handleColorsUpdate"
        />
      </div>

      <!-- Logos Tab -->
      <div v-show="activeTab === 'Logos'" class="tab-content">
        <LogoManager
          :tenant-id="branding.tenantId"
          :tenant-name="branding.tenantName"
          :branding="branding"
          @uploaded="handleLogoUploaded"
        />
      </div>

      <!-- Content Tab -->
      <div v-show="activeTab === 'Content'" class="tab-content">
        <ContentEditor
          :branding="branding"
          @update="handleContentUpdate"
        />
      </div>

      <!-- Preview Tab -->
      <div v-show="activeTab === 'Preview'" class="tab-content">
        <BrandingPreview :branding="branding" />
      </div>

      <!-- History Tab -->
      <div v-show="activeTab === 'History'" class="tab-content">
        <BrandingHistory :tenant-id="branding.tenantId" />
      </div>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useBrandingStore } from '@/Stores/BrandingStore'
import ColorEditor from '@/Components/Admin/Branding/ColorEditor.vue'
import LogoManager from '@/Components/Admin/Branding/LogoManager.vue'
import ContentEditor from '@/Components/Admin/Branding/ContentEditor.vue'
import BrandingPreview from '@/Components/Admin/Branding/BrandingPreview.vue'
import BrandingHistory from '@/Components/Admin/Branding/BrandingHistory.vue'

const route = useRoute()
const brandingStore = useBrandingStore()
const activeTab = ref('Colors')
const tabs = ['Colors', 'Logos', 'Content', 'Preview', 'History']

const branding = computed(() => brandingStore.currentBranding)

onMounted(async () => {
  await brandingStore.loadTenantBranding(route.params.tenant as string)
})

async function handleColorsUpdate(colors: { primary: string; secondary: string }) {
  try {
    await brandingStore.updateColors(
      route.params.tenant as string,
      colors.primary,
      colors.secondary
    )
    // Show success toast
  } catch (error) {
    // Show error toast
  }
}

function handleLogoUploaded(result: any) {
  // Show success toast
  // Optionally refresh preview
}
</script>

<!-- resources/js/Components/Admin/Branding/ColorEditor.vue -->
<template>
  <div class="color-editor">
    <div class="color-inputs">
      <!-- Primary Color -->
      <div class="color-input-group">
        <label>Primary Color</label>
        <div class="color-picker-wrapper">
          <input
            v-model="localPrimaryColor"
            type="color"
            @input="handleColorChange"
          />
          <input
            v-model="localPrimaryColor"
            type="text"
            pattern="^#[0-9A-Fa-f]{6}$"
            placeholder="#1976D2"
          />
        </div>
      </div>

      <!-- Secondary Color -->
      <div class="color-input-group">
        <label>Secondary Color</label>
        <div class="color-picker-wrapper">
          <input
            v-model="localSecondaryColor"
            type="color"
            @input="handleColorChange"
          />
          <input
            v-model="localSecondaryColor"
            type="text"
            pattern="^#[0-9A-Fa-f]{6}$"
            placeholder="#FF5722"
          />
        </div>
      </div>
    </div>

    <!-- WCAG Validation -->
    <div v-if="contrastWarning" class="wcag-warning">
      <Icon name="warning" />
      <span>{{ contrastWarning }}</span>
    </div>

    <!-- Live Preview -->
    <div class="live-preview">
      <h3>Preview</h3>
      <div
        class="preview-box"
        :style="{
          backgroundColor: localPrimaryColor,
          color: localSecondaryColor,
        }"
      >
        <p>Sample Text</p>
        <button :style="{ backgroundColor: localSecondaryColor, color: localPrimaryColor }">
          Button
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button
        :disabled="!hasChanges || !!contrastWarning"
        @click="saveChanges"
      >
        Save Changes
      </button>
      <button @click="resetChanges">Reset</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AdminBrandingView } from '@/Types/Branding'
import { calculateContrastRatio } from '@/Utils/WcagValidator'

const props = defineProps<{
  branding: AdminBrandingView
}>()

const emit = defineEmits<{
  update: [colors: { primary: string; secondary: string }]
}>()

const localPrimaryColor = ref(props.branding.visuals.primaryColor)
const localSecondaryColor = ref(props.branding.visuals.secondaryColor)

const hasChanges = computed(() => {
  return (
    localPrimaryColor.value !== props.branding.visuals.primaryColor ||
    localSecondaryColor.value !== props.branding.visuals.secondaryColor
  )
})

const contrastWarning = computed(() => {
  const ratio = calculateContrastRatio(
    localPrimaryColor.value,
    localSecondaryColor.value
  )

  if (ratio < 4.5) {
    return `Contrast ratio ${ratio.toFixed(2)}:1 does not meet WCAG AA (requires 4.5:1)`
  }

  // Check contrast with logo dominant color if available
  if (props.branding.assets.primary?.dominantColor) {
    const logoRatio = calculateContrastRatio(
      localPrimaryColor.value,
      props.branding.assets.primary.dominantColor
    )

    if (logoRatio < 4.5) {
      return `Primary color has poor contrast with logo (${logoRatio.toFixed(2)}:1)`
    }
  }

  return null
})

function handleColorChange() {
  // Debounced validation
}

function saveChanges() {
  if (hasChanges.value && !contrastWarning.value) {
    emit('update', {
      primary: localPrimaryColor.value,
      secondary: localSecondaryColor.value,
    })
  }
}

function resetChanges() {
  localPrimaryColor.value = props.branding.visuals.primaryColor
  localSecondaryColor.value = props.branding.visuals.secondaryColor
}
</script>

<!-- resources/js/Components/Admin/Branding/LogoManager.vue -->
<template>
  <div class="logo-manager">
    <!-- Logo Type Tabs -->
    <div class="logo-types">
      <button
        v-for="type in logoTypes"
        :key="type"
        :class="{ active: activeType === type }"
        @click="activeType = type"
      >
        {{ formatLogoType(type) }}
        <span v-if="branding.assets[type]" class="badge">✓</span>
      </button>
    </div>

    <!-- Current Logo Preview -->
    <div v-if="currentLogo" class="current-logo">
      <div class="logo-preview">
        <img
          :src="currentLogo.url"
          :alt="`${tenantName} ${activeType} logo`"
          :style="getLogoPreviewStyle()"
        />
      </div>

      <div class="logo-info">
        <p><strong>Dimensions:</strong> {{ formatDimensions(currentLogo.dimensions) }}</p>
        <p v-if="currentLogo.dominantColor">
          <strong>Dominant Color:</strong>
          <span
            class="color-swatch"
            :style="{ backgroundColor: currentLogo.dominantColor }"
          ></span>
          {{ currentLogo.dominantColor }}
        </p>
        <p v-if="currentLogo.uploadedAt">
          <strong>Uploaded:</strong> {{ formatDate(currentLogo.uploadedAt) }}
        </p>
      </div>

      <div v-if="contrastWarning" class="warning">
        <Icon name="warning" />
        {{ contrastWarning }}
      </div>
    </div>

    <!-- Upload Area -->
    <div class="upload-area">
      <LogoUploader
        :tenant-id="tenantId"
        :logo-type="activeType"
        :current-logo="currentLogo"
        :recommended-dimensions="getRecommendedDimensions(activeType)"
        @uploading="handleUploading"
        @uploaded="handleUploaded"
        @error="handleUploadError"
      />

      <!-- Upload Progress -->
      <div v-if="uploadProgress[activeType]" class="upload-progress">
        <progress :value="uploadProgress[activeType]" max="100"></progress>
        <span>{{ uploadProgress[activeType] }}%</span>
      </div>
    </div>

    <!-- Logo History -->
    <div v-if="logoHistory[activeType]?.length" class="logo-history">
      <h3>Previous Versions</h3>
      <LogoHistory
        :history="logoHistory[activeType]"
        @restore="handleRestore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBrandingStore } from '@/Stores/BrandingStore'
import type { LogoType, AdminBrandingView } from '@/Types/Branding'
import LogoUploader from './LogoUploader.vue'
import LogoHistory from './LogoHistory.vue'

const props = defineProps<{
  tenantId: string
  tenantName: string
  branding: AdminBrandingView
}>()

const emit = defineEmits<{
  uploaded: [result: any]
}>()

const brandingStore = useBrandingStore()
const activeType = ref<LogoType>('primary')

const logoTypes: LogoType[] = ['primary', 'dark_mode', 'favicon', 'email', 'mobile']

const currentLogo = computed(() => {
  return props.branding.assets[activeType.value]
})

const uploadProgress = computed(() => brandingStore.uploadProgress)

const contrastWarning = computed(() => {
  if (!currentLogo.value?.dominantColor || !props.branding.visuals.primaryColor) {
    return null
  }

  // Use domain-provided validation from API response
  return props.branding.warnings?.logoContrast?.[activeType.value]
})

function formatLogoType(type: LogoType): string {
  return type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDimensions(dimensions: { width: number; height: number }): string {
  return `${dimensions.width} × ${dimensions.height} px`
}

function getRecommendedDimensions(type: LogoType): { width: number; height: number } {
  const dimensions = {
    primary: { width: 800, height: 400 },
    dark_mode: { width: 800, height: 400 },
    favicon: { width: 64, height: 64 },
    email: { width: 600, height: 300 },
    mobile: { width: 512, height: 512 },
  }

  return dimensions[type]
}

function getLogoPreviewStyle() {
  // Apply appropriate background for preview
  if (activeType.value === 'dark_mode') {
    return { backgroundColor: '#1e1e1e' }
  }
  return { backgroundColor: '#f5f5f5' }
}

function handleUploading() {
  // Optional: disable interactions during upload
}

async function handleUploaded(file: File) {
  try {
    const result = await brandingStore.uploadLogo(
      props.tenantId,
      activeType.value,
      file
    )
    emit('uploaded', result)
  } catch (error) {
    console.error('Upload failed:', error)
  }
}

function handleUploadError(error: any) {
  // Show error toast
  console.error('Upload error:', error)
}

function handleRestore(assetId: string) {
  // Implement logo restoration
}
</script>
```

**Deliverables:**
- [ ] Dashboard pages (Index, Edit)
- [ ] All editor components (Colors, Logos, Content)
- [ ] Preview component with live CSS
- [ ] History component with version rollback
- [ ] Vitest component tests
- [ ] Tailwind CSS styling

---

#### **Day 26: E2E Testing**

**Implement:** Cypress E2E tests

```typescript
// cypress/e2e/admin/branding.cy.ts
describe('Admin Branding Management', () => {
  beforeEach(() => {
    cy.login('admin@example.com', 'password')
    cy.visit('/admin/branding')
  })

  it('displays list of tenant branding', () => {
    cy.get('.branding-grid').should('exist')
    cy.get('.branding-card').should('have.length.at.least', 1)
  })

  it('allows searching for tenants', () => {
    cy.get('input[placeholder="Search tenants..."]').type('NRNA')
    cy.wait(500) // Debounce
    cy.get('.branding-card').should('have.length', 1)
    cy.get('.branding-card').should('contain', 'NRNA')
  })

  it('allows editing tenant colors', () => {
    cy.get('.branding-card').first().click()
    cy.url().should('include', '/admin/branding/')

    // Select Colors tab
    cy.contains('button', 'Colors').click()

    // Change primary color
    cy.get('input[type="color"]').first().invoke('val', '#FF0000').trigger('input')

    // Verify preview updates
    cy.get('.preview-box').should('have.css', 'background-color', 'rgb(255, 0, 0)')

    // Save changes
    cy.contains('button', 'Save Changes').click()

    // Verify success message
    cy.contains('Branding updated successfully').should('be.visible')
  })

  it('prevents saving colors with poor WCAG contrast', () => {
    cy.get('.branding-card').first().click()
    cy.contains('button', 'Colors').click()

    // Set colors with poor contrast
    cy.get('input[type="text"]').first().clear().type('#FFFFFF')
    cy.get('input[type="text"]').eq(1).clear().type('#F0F0F0')

    // Verify warning appears
    cy.get('.wcag-warning').should('contain', 'does not meet WCAG AA')

    // Verify save button is disabled
    cy.contains('button', 'Save Changes').should('be.disabled')
  })

  it('allows uploading a logo', () => {
    cy.get('.branding-card').first().click()
    cy.contains('button', 'Logos').click()

    // Select logo type
    cy.contains('button', 'Primary').click()

    // Upload file
    cy.get('input[type="file"]').selectFile('cypress/fixtures/logo.png', {
      force: true,
    })

    // Wait for upload
    cy.get('.upload-progress', { timeout: 10000 }).should('not.exist')

    // Verify logo appears
    cy.get('.current-logo img').should('have.attr', 'src').and('include', 'cloudinary')
  })

  it('displays logo upload progress', () => {
    cy.get('.branding-card').first().click()
    cy.contains('button', 'Logos').click()

    cy.intercept('POST', '**/upload-logo', (req) => {
      // Simulate slow upload
      req.on('response', (res) => {
        res.setDelay(2000)
      })
    }).as('uploadLogo')

    cy.get('input[type="file"]').selectFile('cypress/fixtures/large-logo.png', {
      force: true,
    })

    // Verify progress bar appears
    cy.get('.upload-progress').should('be.visible')
    cy.get('progress').should('exist')

    cy.wait('@uploadLogo')
  })

  it('shows version history', () => {
    cy.get('.branding-card').first().click()
    cy.contains('button', 'History').click()

    cy.get('.version-history').should('exist')
    cy.get('.version-entry').should('have.length.at.least', 1)
  })
})
```

**Deliverables:**
- [ ] Comprehensive E2E test suite
- [ ] Test fixtures (sample images, JSON)
- [ ] CI/CD integration

---

#### **Day 27-28: Documentation & Deployment**

**Implement:** Final documentation and deployment preparation

**Documentation:**
```markdown
# Admin Branding Dashboard - User Guide

## Overview
The Admin Branding Dashboard allows platform administrators to customize the visual appearance of each tenant organization's platform presence.

## Features

### 1. Color Customization
- Primary and secondary color selection
- Real-time WCAG contrast validation
- Live preview of color changes
- Automatic validation against logo colors

### 2. Logo Management
- Support for 5 logo variants:
  - Primary (800×400px recommended)
  - Dark Mode (800×400px recommended)
  - Favicon (64×64px recommended)
  - Email (600×300px recommended)
  - Mobile (512×512px recommended)
- Drag-and-drop file upload
- Real-time upload progress
- Automatic image optimization via CDN
- Version history with rollback

### 3. Content Editing
- Welcome message
- Hero title and subtitle
- Call-to-action text
- Character limits enforced

### 4. Preview
- Real-time preview of all changes
- Separate preview for light/dark modes
- Mobile responsive preview

### 5. Version Control
- Automatic version tracking
- Optimistic locking (prevents conflicts)
- Audit trail of all changes
- Rollback to previous versions

## Usage

### Editing Colors
1. Navigate to Admin > Branding
2. Click on the tenant card you want to edit
3. Select the "Colors" tab
4. Use color pickers or enter hex values
5. Verify WCAG contrast warnings
6. Click "Save Changes"

### Uploading Logos
1. Navigate to the tenant's branding page
2. Select the "Logos" tab
3. Choose the logo type (Primary, Dark Mode, etc.)
4. Drag and drop an image or click to browse
5. Wait for upload to complete
6. Verify the preview

### Best Practices
- Always verify WCAG contrast before saving colors
- Use high-resolution logos (at least 2x recommended dimensions)
- Test dark mode logos against dark backgrounds
- Preview changes before publishing
- Keep branding consistent across all variants

## Technical Details
- Maximum file size: 2MB per logo
- Supported formats: PNG, JPEG, SVG
- CDN: Cloudinary (automatic optimization)
- WCAG: AA compliance enforced (4.5:1 contrast ratio)
```

**Deployment Checklist:**
```markdown
# Phase 4 Deployment Checklist

## Pre-Deployment
- [ ] All tests passing (100% coverage)
- [ ] Database migrations reviewed
- [ ] CDN credentials configured
- [ ] Environment variables set
- [ ] Backup strategy confirmed

## Deployment Steps
1. [ ] Run migrations on staging
2. [ ] Seed test data
3. [ ] Run smoke tests
4. [ ] Deploy backend to staging
5. [ ] Deploy frontend to staging
6. [ ] Run E2E tests on staging
7. [ ] Performance testing
8. [ ] Security audit
9. [ ] UAT with stakeholders
10. [ ] Production deployment plan approved

## Post-Deployment
- [ ] Monitor error logs
- [ ] Check CDN upload success rate
- [ ] Verify cache invalidation
- [ ] Monitor API response times
- [ ] User feedback collection

## Rollback Plan
- [ ] Database migration rollback tested
- [ ] Previous version tagged
- [ ] Rollback procedure documented
```

**Deliverables:**
- [ ] Admin user guide
- [ ] Technical documentation
- [ ] API reference (OpenAPI spec)
- [ ] Deployment runbook
- [ ] Monitoring dashboard setup

---

## 🎯 **APPROVAL CHECKLIST**

Before proceeding with implementation, please review and approve the following decisions:

### **Architecture Decisions:**
- [ ] **DECISION 1 APPROVED:** Use `/api/v1/admin/branding` for platform admin, `/api/v1/commands` for mutations
- [ ] **DECISION 2 APPROVED:** `BrandingBundle` as aggregate root (not TenantBranding table)
- [ ] **DECISION 3 APPROVED:** Command-driven API pattern (not RESTful CRUD)
- [ ] **DECISION 4 APPROVED:** Integrated asset management with CDN (Cloudinary)
- [ ] **DECISION 5 APPROVED:** WCAG validation in domain layer

### **Implementation Scope:**
- [ ] **APPROVED:** 28-day sprint (4 weeks)
- [ ] **APPROVED:** TDD-first approach (tests before implementation)
- [ ] **APPROVED:** Week 1 - Domain Model & Commands
- [ ] **APPROVED:** Week 2 - Infrastructure & CDN
- [ ] **APPROVED:** Week 3 - API Layer
- [ ] **APPROVED:** Week 4 - Vue 3 Dashboard

### **Technical Stack:**
- [ ] **APPROVED:** Laravel 12 + PostgreSQL
- [ ] **APPROVED:** Vue 3 + Pinia + TypeScript
- [ ] **APPROVED:** Cloudinary CDN for asset storage
- [ ] **APPROVED:** PHPUnit + Vitest + Cypress for testing

### **Risk Mitigation:**
- [ ] **REVIEWED:** Optimistic locking strategy (version control)
- [ ] **REVIEWED:** CDN failure handling (graceful degradation)
- [ ] **REVIEWED:** Cache invalidation strategy
- [ ] **REVIEWED:** Security measures (file upload validation, XSS prevention)

---

## 📊 **SUCCESS CRITERIA**

This implementation will be considered successful when:

1. **Domain Tests:** 100% of domain business rules tested and passing
2. **API Tests:** All endpoints tested with 95%+ coverage
3. **E2E Tests:** Critical user flows verified in Cypress
4. **Performance:** API response time < 200ms (90th percentile)
5. **CDN Uploads:** 99% success rate for logo uploads
6. **WCAG Compliance:** 100% of color combinations validated
7. **User Acceptance:** Platform admins can manage branding for all tenants without errors

---

## 🚀 **NEXT STEPS AFTER APPROVAL**

Upon approval, we will:

1. **Day 0:** Create Git feature branch `feature/phase4-admin-branding`
2. **Day 1:** Begin TDD implementation with domain tests
3. **Weekly:** Progress reviews every Friday
4. **Week 4:** UAT with stakeholders
5. **Week 5:** Production deployment (if UAT passes)

---

## 📞 **QUESTIONS FOR STAKEHOLDER**

Before starting implementation, please confirm:

1. **CDN Provider:** Cloudinary is approved? (Alternative: AWS S3 + CloudFront)
2. **Logo Variants:** Are all 5 logo types required? (Primary, Dark Mode, Favicon, Email, Mobile)
3. **Version History:** How many versions should we retain? (Recommend: 30 days)
4. **Rollback Permissions:** Can all platform admins rollback branding? Or restricted?
5. **Preview Publishing:** Should branding changes go live immediately or require explicit "Publish" action?

---

**Status:** 🟡 **AWAITING YOUR APPROVAL**

Please review this plan and provide approval or feedback. Once approved, we will begin Day 1 implementation immediately.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Author:** Senior Software Architect
**Estimated Effort:** 28 days (4 weeks) with 1 senior developer + 1 mid-level frontend developer
