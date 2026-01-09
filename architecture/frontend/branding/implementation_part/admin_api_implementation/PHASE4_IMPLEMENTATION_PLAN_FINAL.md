# 🏛️ **PHASE 4 FINAL IMPLEMENTATION PLAN: Admin API & Dashboard**

**Version:** 2.0 (Final - Post-Review)
**Created:** 2026-01-07
**Status:** ✅ APPROVED - Ready for Implementation
**Architect:** Senior Software Architect
**Sprint Duration:** 14 days (2 weeks)
**Overall Score:** 9.2/10 (Post-corrections)

---

## 📋 **EXECUTIVE SUMMARY**

This is the **final, approved implementation plan** for Phase 4, incorporating critical feedback from three senior architect reviews.

### **Major Revisions from Original Plan:**

| Change | Original | Final | Reason |
|--------|----------|-------|--------|
| **Timeline** | 28 days | 14 days | Realistic MVP delivery |
| **Scope** | 5 logo variants | Primary logo only | Avoid over-engineering |
| **Week 1 Priority** | Domain model | Data migration | Admin needs existing data |
| **API Pattern** | Command-driven | CRUD for MVP | Pragmatic approach |
| **CQRS** | Day 1 | Phase 5 (future) | Premature optimization |
| **Aggregate Root** | BrandingBundle | TenantBranding | Clearer boundaries |
| **Domain Purity** | Contains CDN refs | Pure (AssetPath only) | Fix DDD violation |

### **Critical Architectural Corrections:**

✅ **FIXED:** Domain layer purified - no infrastructure dependencies
✅ **FIXED:** TenantBranding as explicit Aggregate Root
✅ **FIXED:** Data migration added as Week 1 priority
✅ **FIXED:** Scope reduced to deliverable MVP (primary logo only)
✅ **FIXED:** TDD enforcement with contract testing
✅ **FIXED:** State management (Draft → Published) explicit

---

## 🎯 **PHASE 4 SCOPE & OBJECTIVES**

### **Primary Goal:**
Enable platform administrators to manage tenant branding through a working admin dashboard **in 14 days**, using **existing migrated data**, with **primary logo support only**.

### **MVP User Stories:**

**As a Platform Admin, I want to:**
- View all tenant branding configurations in a centralized dashboard
- Update colors and content for any tenant
- Upload and manage primary logo for any tenant
- Preview branding changes before publishing
- See WCAG validation feedback in real-time

**Deferred to Phase 5:**
- ❌ Multiple logo variants (dark mode, favicon, email, mobile)
- ❌ Full CQRS with materialized views
- ❌ Complex event sourcing
- ❌ Advanced version history UI
- ❌ Batch operations

---

## 🚨 **CRITICAL ARCHITECTURAL DECISIONS (FINAL)**

### **DECISION 1: Domain Purity (DDD Violation Fixed)**

**Problem Identified by Principal Architect:**
```php
// ❌ WRONG - Domain knows about infrastructure
final class LogoUrl implements ValueObject {
    private CdnProvider $cdnProvider;  // Infrastructure leak!
    private string $url;                // CDN-specific URL
}
```

**✅ CORRECTED - Pure Domain Model:**
```php
// Domain Layer (Pure - No infrastructure)
final class AssetPath implements ValueObject {
    private string $path; // "tenants/{tenant_id}/logos/primary.png"

    public function __construct(string $path) {
        if (!$this->isValidPath($path)) {
            throw new InvalidAssetPathException();
        }
        $this->path = $path;
    }

    public function toString(): string {
        return $this->path;
    }

    // No CDN, no URLs, no infrastructure!
}

// Infrastructure Layer (Adapter)
interface AssetUrlResolver {
    public function resolve(AssetPath $path): string;
}

final class CloudinaryUrlResolver implements AssetUrlResolver {
    public function resolve(AssetPath $path): string {
        return "https://res.cloudinary.com/{$this->cloudName}/{$path->toString()}";
    }
}

final class S3UrlResolver implements AssetUrlResolver {
    public function resolve(AssetPath $path): string {
        return "https://{$this->bucket}.s3.amazonaws.com/{$path->toString()}";
    }
}
```

**Why This Matters:**
- Domain tests can run without CDN credentials
- Can swap CDN providers without changing domain
- Easier to test, easier to maintain
- True hexagonal architecture

---

### **DECISION 2: Aggregate Root Clarified**

**✅ FINAL DECISION: TenantBranding as Aggregate Root**

```php
// app/Contexts/Platform/Domain/Branding/TenantBranding.php
final class TenantBranding implements AggregateRoot {
    use RecordsEvents;

    private TenantBrandingId $id;
    private TenantId $tenantId;

    // Aggregate components
    private BrandingTheme $theme;         // Colors, fonts (Value Object)
    private BrandingContent $content;      // Texts (Value Object)
    private BrandingAssetCollection $assets; // Asset references (Entity Collection)

    // State management
    private BrandingState $state;          // Draft, Published, Archived
    private Version $version;              // Optimistic locking

    // Timestamps (infrastructure concern but needed for business)
    private \DateTimeImmutable $createdAt;
    private \DateTimeImmutable $updatedAt;
    private ?\DateTimeImmutable $publishedAt = null;

    // Aggregate identity
    public function id(): TenantBrandingId {
        return $this->id;
    }

    public function tenantId(): TenantId {
        return $this->tenantId;
    }

    // Business methods (enforce invariants)
    public function updateTheme(
        BrandingTheme $newTheme,
        UserId $updaterId
    ): void {
        // Business rule: Validate WCAG compliance
        if (!$newTheme->isWcagCompliant()) {
            throw new WcagContrastViolation();
        }

        $this->theme = $newTheme;
        $this->version = $this->version->increment();
        $this->updatedAt = new \DateTimeImmutable();

        $this->recordThat(new BrandingThemeUpdated(
            $this->tenantId,
            $newTheme,
            $this->version,
            $updaterId
        ));
    }

    public function updatePrimaryLogo(
        AssetPath $assetPath,
        AssetMetadata $metadata,
        UserId $updaterId
    ): void {
        // Business rule: Validate dimensions
        if (!$metadata->dimensions()->isValidForPrimaryLogo()) {
            throw new InvalidLogoDimensionsException(
                'Primary logo must be approximately 800×400px'
            );
        }

        // Business rule: Only one active primary logo
        $this->assets = $this->assets->replacePrimaryLogo(
            new BrandingAsset(
                id: BrandingAssetId::generate(),
                type: LogoType::PRIMARY,
                path: $assetPath,
                metadata: $metadata,
                status: AssetStatus::ACTIVE
            )
        );

        $this->version = $this->version->increment();
        $this->updatedAt = new \DateTimeImmutable();

        $this->recordThat(new PrimaryLogoUpdated(
            $this->tenantId,
            $assetPath,
            $this->version,
            $updaterId
        ));
    }

    public function publish(UserId $publisherId): void {
        // Business rule: Can only publish draft
        if (!$this->state->isDraft()) {
            throw new InvalidStateTransitionException(
                "Only draft branding can be published"
            );
        }

        $this->state = BrandingState::published();
        $this->publishedAt = new \DateTimeImmutable();
        $this->version = $this->version->increment();

        $this->recordThat(new BrandingPublished(
            $this->tenantId,
            $this->version,
            $publisherId,
            $this->publishedAt
        ));
    }

    public function archive(): void {
        $this->state = BrandingState::archived();
        $this->recordThat(new BrandingArchived($this->tenantId));
    }
}
```

**Aggregate Boundary Rules:**
1. `TenantBranding` is the ONLY entry point for all branding changes
2. `BrandingAsset` entities can ONLY be modified through `TenantBranding`
3. Consistency boundary = all branding for one tenant
4. Version control at aggregate root level (optimistic locking)

---

### **DECISION 3: Timeline & Scope (Realistic MVP)**

**✅ APPROVED: 14 Days, Primary Logo Only**

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | Domain + Data Migration + API | Pure domain model, migrated data, working API |
| **Week 2** | Vue Dashboard + CDN + Polish | Admin UI, CDN integration, production ready |

**MVP Features (14 days):**
- ✅ View all tenant branding
- ✅ Update colors with WCAG validation
- ✅ Update content (hero, CTA, etc.)
- ✅ Upload primary logo (via CDN)
- ✅ Real-time preview
- ✅ Draft/Publish workflow
- ✅ Simple version tracking

**Deferred to Phase 5:**
- ❌ Multiple logo variants (favicon, dark mode, email, mobile)
- ❌ Complex event sourcing
- ❌ Full CQRS with read models
- ❌ Advanced audit UI
- ❌ Batch tenant operations

---

### **DECISION 4: API Pattern (Pragmatic Approach)**

**✅ APPROVED: Start with CRUD, Evolve to Commands**

```bash
# Week 1 MVP API (Simple CRUD)
GET    /api/v1/admin/branding                # List all tenant branding
GET    /api/v1/admin/branding/{tenant}       # Get specific tenant branding
PUT    /api/v1/admin/branding/{tenant}       # Update branding (atomic)
POST   /api/v1/admin/branding/{tenant}/logo  # Upload primary logo
POST   /api/v1/admin/branding/{tenant}/publish # Publish draft branding

# Phase 5 Evolution (Command Pattern)
POST   /api/v1/commands                      # Command bus endpoint
GET    /api/v1/queries                       # CQRS read queries
```

**Rationale:**
- MVP needs working UI fast (14 days)
- CRUD is simpler to implement and test
- Can refactor to commands in Phase 5 without breaking contracts
- Focus on domain purity, not API pattern perfection

---

### **DECISION 5: State Management (Explicit States)**

**✅ APPROVED: Draft → Published → Archived Flow**

```php
// app/Contexts/Platform/Domain/Branding/ValueObjects/BrandingState.php
final class BrandingState implements ValueObject {
    private const DRAFT = 'draft';
    private const PUBLISHED = 'published';
    private const ARCHIVED = 'archived';

    private string $value;

    private function __construct(string $value) {
        $this->value = $value;
    }

    public static function draft(): self {
        return new self(self::DRAFT);
    }

    public static function published(): self {
        return new self(self::PUBLISHED);
    }

    public static function archived(): self {
        return new self(self::ARCHIVED);
    }

    public function isDraft(): bool {
        return $this->value === self::DRAFT;
    }

    public function isPublished(): bool {
        return $this->value === self::PUBLISHED;
    }

    public function canTransitionTo(self $newState): bool {
        return match([$this->value, $newState->value]) {
            [self::DRAFT, self::PUBLISHED] => true,
            [self::PUBLISHED, self::ARCHIVED] => true,
            [self::DRAFT, self::ARCHIVED] => true,
            default => false,
        };
    }
}
```

**State Transition Rules:**
```
DRAFT ──────publish()─────► PUBLISHED
  │                             │
  └─────archive()───────────────┘
                    │
                    ▼
                ARCHIVED
```

---

### **DECISION 6: Testing Strategy (TDD Enforced)**

**✅ APPROVED: Test Pyramid with Contract Testing**

```
         UI Tests (5%)
       /─────────────\
      /  Vitest, Cypress  \
     /─────────────────────\
    / Infrastructure (10%)  \
   /   Contract Tests        \
  /─────────────────────────────\
 /   Application Layer (25%)     \
/  Command Handlers, Services     \
──────────────────────────────────
       Domain Tests (60%)
    Pure Business Logic
──────────────────────────────────
```

**Test Order (Mandatory):**
1. **Domain Tests** (Write FIRST - No framework)
2. **Application Tests** (Command handlers)
3. **Infrastructure Tests** (Repositories, CDN adapters)
4. **UI Tests** (Component tests last)

**Contract Testing for CDN:**
```php
// tests/Contracts/AssetStorageAdapterContractTest.php
abstract class AssetStorageAdapterContractTest extends TestCase {
    abstract protected function createAdapter(): AssetStorageAdapter;

    /** @test */
    public function it_uploads_asset_and_returns_path(): void {
        $adapter = $this->createAdapter();
        $upload = new AssetUpload(
            file: UploadedFile::fake()->image('logo.png', 800, 400),
            path: AssetPath::fromString('tenants/nrna/logos/primary.png')
        );

        $result = $adapter->upload($upload);

        $this->assertInstanceOf(StoredAsset::class, $result);
        $this->assertNotEmpty($result->assetId());
        $this->assertEquals($upload->path(), $result->path());
    }

    /** @test */
    public function it_deletes_asset_by_path(): void {
        // ... contract test for deletion
    }
}

// Concrete implementation tests
class CloudinaryAdapterTest extends AssetStorageAdapterContractTest {
    protected function createAdapter(): AssetStorageAdapter {
        return new CloudinaryAdapter(/* config */);
    }
}

class S3AdapterTest extends AssetStorageAdapterContractTest {
    protected function createAdapter(): AssetStorageAdapter {
        return new S3Adapter(/* config */);
    }
}

class FakeAdapterTest extends AssetStorageAdapterContractTest {
    protected function createAdapter(): AssetStorageAdapter {
        return new FakeInMemoryAdapter();
    }
}
```

---

## 🏗️ **14-DAY IMPLEMENTATION ROADMAP**

### **WEEK 1: PURE DOMAIN + DATA MIGRATION + MVP API (Days 1-7)**

#### **🔴 CRITICAL: Day 1-2 Priority - Data Migration**

**WHY THIS IS DAY 1:**
- Admin dashboard with no data is useless
- Need existing tenant branding to test UI
- Validates domain model against real data
- Enables backward compatibility testing

**Day 1: Migration Strategy & Script**
```php
// app/Console/Commands/MigrateExistingBranding.php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Contexts\Platform\Domain\Branding\TenantBranding;
use App\Contexts\Platform\Infrastructure\Repositories\TenantBrandingRepository;

class MigrateExistingBranding extends Command
{
    protected $signature = 'branding:migrate-existing
                            {--tenant= : Specific tenant slug}
                            {--dry-run : Preview without committing}
                            {--force : Skip confirmation}';

    protected $description = 'Migrate existing tenant branding from tenant DBs to landlord';

    public function handle(
        TenantBrandingRepository $repository,
        LegacyBrandingService $legacyService
    ): int {
        $this->info('🔄 Starting branding migration...');

        $tenants = $this->option('tenant')
            ? [Tenant::whereSlug($this->option('tenant'))->firstOrFail()]
            : Tenant::all();

        $stats = [
            'total' => count($tenants),
            'migrated' => 0,
            'skipped' => 0,
            'failed' => 0,
        ];

        foreach ($tenants as $tenant) {
            try {
                $this->info("Processing tenant: {$tenant->name} ({$tenant->slug})");

                // 1. Fetch legacy branding from tenant database
                $legacyBranding = $legacyService->getBrandingForTenant($tenant);

                if (!$legacyBranding) {
                    $this->warn("  ⚠️  No branding found, using defaults");
                    $stats['skipped']++;
                    continue;
                }

                // 2. Transform to domain model
                $tenantBranding = $this->transformToDomain($tenant, $legacyBranding);

                // 3. Validate
                $this->validateBranding($tenantBranding);

                // 4. Save (if not dry-run)
                if (!$this->option('dry-run')) {
                    $repository->save($tenantBranding);
                    $this->info("  ✅ Migrated successfully");
                    $stats['migrated']++;
                } else {
                    $this->info("  👁️  Dry-run: Would migrate");
                }

            } catch (\Exception $e) {
                $this->error("  ❌ Failed: {$e->getMessage()}");
                $stats['failed']++;

                if (!$this->option('force')) {
                    if (!$this->confirm('Continue with remaining tenants?')) {
                        break;
                    }
                }
            }
        }

        // Summary
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total Tenants', $stats['total']],
                ['Migrated', $stats['migrated']],
                ['Skipped', $stats['skipped']],
                ['Failed', $stats['failed']],
            ]
        );

        return $stats['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function transformToDomain(Tenant $tenant, array $legacyBranding): TenantBranding
    {
        return TenantBranding::create(
            id: TenantBrandingId::generate(),
            tenantId: TenantId::fromInt($tenant->id),
            theme: BrandingTheme::create(
                primaryColor: BrandingColor::fromHex($legacyBranding['primary_color'] ?? '#1976D2'),
                secondaryColor: BrandingColor::fromHex($legacyBranding['secondary_color'] ?? '#FF5722'),
                fontFamily: $legacyBranding['font_family'] ?? null
            ),
            content: BrandingContent::create(
                welcomeMessage: $legacyBranding['welcome_message'] ?? '',
                heroTitle: $legacyBranding['hero_title'] ?? '',
                heroSubtitle: $legacyBranding['hero_subtitle'] ?? '',
                ctaText: $legacyBranding['cta_text'] ?? 'Get Started'
            ),
            assets: $this->transformAssets($legacyBranding),
            state: BrandingState::published(), // Existing branding is published
            version: Version::initial()
        );
    }

    private function transformAssets(array $legacyBranding): BrandingAssetCollection
    {
        $assets = [];

        // Transform legacy logo_url to AssetPath
        if (!empty($legacyBranding['logo_url'])) {
            $assets[] = new BrandingAsset(
                id: BrandingAssetId::generate(),
                type: LogoType::PRIMARY,
                path: AssetPath::fromUrl($legacyBranding['logo_url']), // Extract path from URL
                metadata: AssetMetadata::fromLegacyUrl($legacyBranding['logo_url']),
                status: AssetStatus::ACTIVE
            );
        }

        return BrandingAssetCollection::fromArray($assets);
    }

    private function validateBranding(TenantBranding $branding): void
    {
        // Validate WCAG
        if (!$branding->theme()->isWcagCompliant()) {
            throw new \RuntimeException('WCAG validation failed');
        }

        // Validate asset dimensions (if logo exists)
        // ... additional validations
    }
}
```

**Day 2: Backward Compatibility Layer**
```php
// app/Contexts/Platform/Infrastructure/Adapters/LegacyBrandingAdapter.php
final class LegacyBrandingAdapter {
    /**
     * Enables gradual rollout - old APIs still work during migration
     */
    public function getBrandingForMobileApi(string $tenantSlug): array
    {
        $branding = $this->repository->findByTenantSlug($tenantSlug);

        // Return in legacy format for mobile API compatibility
        return [
            'primaryColor' => $branding->theme()->primaryColor()->toHex(),
            'secondaryColor' => $branding->theme()->secondaryColor()->toHex(),
            'logoUrl' => $this->urlResolver->resolve($branding->assets()->primaryLogo()?->path()),
            'welcomeMessage' => $branding->content()->welcomeMessage(),
            // ... other fields
        ];
    }
}
```

**Deliverables Day 1-2:**
- [ ] Migration command implemented
- [ ] Backward compatibility adapter
- [ ] Data integrity validation tests
- [ ] Dry-run testing on staging
- [ ] Migration executed successfully

---

#### **Day 3-4: Pure Domain Model with TDD**

**Day 3 Morning: Write Failing Domain Tests**

```php
// tests/Unit/Contexts/Platform/Domain/Branding/TenantBrandingTest.php
<?php

namespace Tests\Unit\Contexts\Platform\Domain\Branding;

use PHPUnit\Framework\TestCase;
use App\Contexts\Platform\Domain\Branding\TenantBranding;
use App\Contexts\Platform\Domain\Branding\TenantBrandingId;
use App\Contexts\Platform\Domain\Branding\ValueObjects\*;
use App\Contexts\Platform\Domain\Branding\Exceptions\*;
use App\Contexts\Shared\Domain\ValueObjects\TenantId;
use App\Contexts\Shared\Domain\ValueObjects\UserId;

class TenantBrandingTest extends TestCase
{
    /** @test */
    public function it_creates_tenant_branding_with_defaults(): void
    {
        // GIVEN
        $tenantId = TenantId::fromString('nrna');

        // WHEN
        $branding = TenantBranding::create(
            id: TenantBrandingId::generate(),
            tenantId: $tenantId,
            theme: BrandingTheme::defaults(),
            content: BrandingContent::defaults(),
            assets: BrandingAssetCollection::empty(),
            state: BrandingState::draft(),
            version: Version::initial()
        );

        // THEN
        $this->assertInstanceOf(TenantBranding::class, $branding);
        $this->assertTrue($branding->state()->isDraft());
        $this->assertEquals(1, $branding->version()->toInt());
    }

    /** @test */
    public function it_rejects_wcag_non_compliant_colors(): void
    {
        // GIVEN
        $branding = $this->createDraftBranding();
        $updater = UserId::fromString('admin-123');

        // White on light gray - poor contrast
        $badTheme = BrandingTheme::create(
            primaryColor: BrandingColor::fromHex('#FFFFFF'),
            secondaryColor: BrandingColor::fromHex('#F0F0F0'),
            fontFamily: null
        );

        // WHEN/THEN
        $this->expectException(WcagContrastViolation::class);
        $this->expectExceptionMessage('Contrast ratio 1.2:1 does not meet WCAG AA');

        $branding->updateTheme($badTheme, $updater);
    }

    /** @test */
    public function it_accepts_wcag_compliant_colors(): void
    {
        // GIVEN
        $branding = $this->createDraftBranding();
        $updater = UserId::fromString('admin-123');

        // Blue on orange - good contrast
        $goodTheme = BrandingTheme::create(
            primaryColor: BrandingColor::fromHex('#1976D2'),
            secondaryColor: BrandingColor::fromHex('#FF5722'),
            fontFamily: null
        );

        // WHEN
        $branding->updateTheme($goodTheme, $updater);

        // THEN
        $this->assertEquals('#1976D2', $branding->theme()->primaryColor()->toHex());
        $this->assertEquals(2, $branding->version()->toInt()); // Version incremented
    }

    /** @test */
    public function it_rejects_logo_with_invalid_dimensions(): void
    {
        // GIVEN
        $branding = $this->createDraftBranding();
        $updater = UserId::fromString('admin-123');

        // Too large for primary logo
        $invalidMetadata = new AssetMetadata(
            dimensions: new Dimensions(2000, 2000),
            fileSize: 500000,
            mimeType: 'image/png'
        );

        // WHEN/THEN
        $this->expectException(InvalidLogoDimensionsException::class);
        $this->expectExceptionMessage('Primary logo must be approximately 800×400px');

        $branding->updatePrimaryLogo(
            AssetPath::fromString('tenants/nrna/logos/too-large.png'),
            $invalidMetadata,
            $updater
        );
    }

    /** @test */
    public function it_accepts_logo_with_valid_dimensions(): void
    {
        // GIVEN
        $branding = $this->createDraftBranding();
        $updater = UserId::fromString('admin-123');

        // Correct dimensions (within tolerance)
        $validMetadata = new AssetMetadata(
            dimensions: new Dimensions(800, 400),
            fileSize: 150000,
            mimeType: 'image/png'
        );

        // WHEN
        $branding->updatePrimaryLogo(
            AssetPath::fromString('tenants/nrna/logos/primary.png'),
            $validMetadata,
            $updater
        );

        // THEN
        $this->assertTrue($branding->assets()->hasPrimaryLogo());
        $this->assertEquals('tenants/nrna/logos/primary.png',
            $branding->assets()->primaryLogo()->path()->toString()
        );
    }

    /** @test */
    public function it_enforces_only_one_active_primary_logo(): void
    {
        // GIVEN
        $branding = $this->createBrandingWithPrimaryLogo();
        $updater = UserId::fromString('admin-123');

        $oldLogoPath = $branding->assets()->primaryLogo()->path();

        // WHEN: Upload new primary logo
        $newMetadata = new AssetMetadata(
            dimensions: new Dimensions(800, 400),
            fileSize: 200000,
            mimeType: 'image/png'
        );

        $branding->updatePrimaryLogo(
            AssetPath::fromString('tenants/nrna/logos/new-primary.png'),
            $newMetadata,
            $updater
        );

        // THEN: New logo is active
        $this->assertEquals('tenants/nrna/logos/new-primary.png',
            $branding->assets()->primaryLogo()->path()->toString()
        );

        // Old logo should be deactivated (business rule)
        $this->assertFalse($branding->assets()->hasAssetWithPath($oldLogoPath));
    }

    /** @test */
    public function it_can_only_publish_draft_branding(): void
    {
        // GIVEN: Already published branding
        $branding = $this->createPublishedBranding();
        $publisher = UserId::fromString('admin-123');

        // WHEN/THEN
        $this->expectException(InvalidStateTransitionException::class);
        $this->expectExceptionMessage('Only draft branding can be published');

        $branding->publish($publisher);
    }

    /** @test */
    public function it_publishes_draft_branding_successfully(): void
    {
        // GIVEN
        $branding = $this->createDraftBranding();
        $publisher = UserId::fromString('admin-123');

        // WHEN
        $branding->publish($publisher);

        // THEN
        $this->assertTrue($branding->state()->isPublished());
        $this->assertNotNull($branding->publishedAt());
        $this->assertEquals(2, $branding->version()->toInt());

        // Verify event emitted
        $events = $branding->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(BrandingPublished::class, $events[0]);
    }

    /** @test */
    public function it_increments_version_on_each_change(): void
    {
        // GIVEN
        $branding = $this->createDraftBranding();
        $updater = UserId::fromString('admin-123');

        $this->assertEquals(1, $branding->version()->toInt());

        // WHEN: Make multiple changes
        $branding->updateTheme(
            BrandingTheme::create(
                BrandingColor::fromHex('#1976D2'),
                BrandingColor::fromHex('#FF5722'),
                null
            ),
            $updater
        );

        $this->assertEquals(2, $branding->version()->toInt());

        $branding->updateContent(
            BrandingContent::create(
                'New welcome',
                'New title',
                'New subtitle',
                'New CTA'
            ),
            $updater
        );

        // THEN
        $this->assertEquals(3, $branding->version()->toInt());
    }

    // Helper methods
    private function createDraftBranding(): TenantBranding
    {
        return TenantBranding::create(
            id: TenantBrandingId::generate(),
            tenantId: TenantId::fromString('nrna'),
            theme: BrandingTheme::defaults(),
            content: BrandingContent::defaults(),
            assets: BrandingAssetCollection::empty(),
            state: BrandingState::draft(),
            version: Version::initial()
        );
    }

    private function createPublishedBranding(): TenantBranding
    {
        $branding = $this->createDraftBranding();
        $branding->publish(UserId::fromString('admin-123'));
        return $branding;
    }

    private function createBrandingWithPrimaryLogo(): TenantBranding
    {
        $branding = $this->createDraftBranding();
        $branding->updatePrimaryLogo(
            AssetPath::fromString('tenants/nrna/logos/existing.png'),
            new AssetMetadata(
                new Dimensions(800, 400),
                150000,
                'image/png'
            ),
            UserId::fromString('admin-123')
        );
        return $branding;
    }
}
```

**Day 3 Afternoon: Implement Domain Value Objects**

```php
// app/Contexts/Platform/Domain/Branding/ValueObjects/BrandingTheme.php
final class BrandingTheme implements ValueObject {
    public function __construct(
        private BrandingColor $primaryColor,
        private BrandingColor $secondaryColor,
        private ?string $fontFamily = null
    ) {
        $this->validateWcagCompliance();
    }

    public static function defaults(): self {
        return new self(
            BrandingColor::fromHex('#1976D2'),
            BrandingColor::fromHex('#FF5722'),
            null
        );
    }

    public static function create(
        BrandingColor $primaryColor,
        BrandingColor $secondaryColor,
        ?string $fontFamily
    ): self {
        return new self($primaryColor, $secondaryColor, $fontFamily);
    }

    private function validateWcagCompliance(): void {
        $contrastRatio = $this->primaryColor->contrastRatioWith($this->secondaryColor);

        if ($contrastRatio < 4.5) {
            throw new WcagContrastViolation(
                "Contrast ratio {$contrastRatio}:1 does not meet WCAG AA (requires 4.5:1)"
            );
        }
    }

    public function isWcagCompliant(): bool {
        try {
            $this->validateWcagCompliance();
            return true;
        } catch (WcagContrastViolation) {
            return false;
        }
    }

    public function primaryColor(): BrandingColor {
        return $this->primaryColor;
    }

    public function secondaryColor(): BrandingColor {
        return $this->secondaryColor;
    }

    public function fontFamily(): ?string {
        return $this->fontFamily;
    }

    public function equals(ValueObject $other): bool {
        return $other instanceof self
            && $this->primaryColor->equals($other->primaryColor)
            && $this->secondaryColor->equals($other->secondaryColor)
            && $this->fontFamily === $other->fontFamily;
    }
}

// app/Contexts/Platform/Domain/Branding/ValueObjects/BrandingColor.php
final class BrandingColor implements ValueObject {
    private string $hex;
    private array $rgb;

    private function __construct(string $hex) {
        $this->hex = strtoupper($hex);
        $this->rgb = $this->hexToRgb($hex);
    }

    public static function fromHex(string $hex): self {
        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $hex)) {
            throw new InvalidColorException("Invalid hex color: {$hex}");
        }

        return new self($hex);
    }

    public function toHex(): string {
        return $this->hex;
    }

    public function toRgb(): array {
        return $this->rgb;
    }

    /**
     * Calculate WCAG contrast ratio with another color
     * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
     */
    public function contrastRatioWith(self $other): float {
        $l1 = $this->relativeLuminance();
        $l2 = $other->relativeLuminance();

        $lighter = max($l1, $l2);
        $darker = min($l1, $l2);

        return ($lighter + 0.05) / ($darker + 0.05);
    }

    private function relativeLuminance(): float {
        $rgb = array_map(function($value) {
            $value = $value / 255;
            return $value <= 0.03928
                ? $value / 12.92
                : pow(($value + 0.055) / 1.055, 2.4);
        }, $this->rgb);

        return 0.2126 * $rgb['r'] + 0.7152 * $rgb['g'] + 0.0722 * $rgb['b'];
    }

    private function hexToRgb(string $hex): array {
        $hex = ltrim($hex, '#');
        return [
            'r' => hexdec(substr($hex, 0, 2)),
            'g' => hexdec(substr($hex, 2, 2)),
            'b' => hexdec(substr($hex, 4, 2)),
        ];
    }

    public function equals(ValueObject $other): bool {
        return $other instanceof self && $this->hex === $other->hex;
    }
}

// app/Contexts/Platform/Domain/Branding/ValueObjects/AssetPath.php
final class AssetPath implements ValueObject {
    private string $path;

    private function __construct(string $path) {
        if (empty(trim($path))) {
            throw new InvalidAssetPathException('Asset path cannot be empty');
        }

        // Business rule: Path must follow pattern
        if (!preg_match('/^tenants\/[a-z0-9-]+\/logos\/[a-z0-9-]+\.(png|jpg|jpeg|svg)$/i', $path)) {
            throw new InvalidAssetPathException("Invalid asset path format: {$path}");
        }

        $this->path = $path;
    }

    public static function fromString(string $path): self {
        return new self($path);
    }

    /**
     * Extract path from legacy CDN URL
     * Example: "https://cdn.cloudinary.com/tenants/nrna/logos/primary.png"
     * Returns: "tenants/nrna/logos/primary.png"
     */
    public static function fromUrl(string $url): self {
        $parsed = parse_url($url);
        $path = ltrim($parsed['path'] ?? '', '/');

        return new self($path);
    }

    public function toString(): string {
        return $this->path;
    }

    public function equals(ValueObject $other): bool {
        return $other instanceof self && $this->path === $other->path;
    }
}

// app/Contexts/Platform/Domain/Branding/ValueObjects/Dimensions.php
final class Dimensions implements ValueObject {
    public function __construct(
        private int $width,
        private int $height
    ) {
        if ($width <= 0 || $height <= 0) {
            throw new InvalidArgumentException('Dimensions must be positive integers');
        }
    }

    public function width(): int {
        return $this->width;
    }

    public function height(): int {
        return $this->height;
    }

    /**
     * Check if dimensions are within tolerance of expected dimensions
     * 20% tolerance by default (e.g., 800×400 allows 640-960 width, 320-480 height)
     */
    public function isWithinTolerance(self $expected, float $tolerance = 0.2): bool {
        $widthRatio = abs($this->width - $expected->width) / $expected->width;
        $heightRatio = abs($this->height - $expected->height) / $expected->height;

        return $widthRatio <= $tolerance && $heightRatio <= $tolerance;
    }

    public function isValidForPrimaryLogo(): bool {
        $expected = new self(800, 400);
        return $this->isWithinTolerance($expected);
    }

    public function toString(): string {
        return "{$this->width}×{$this->height}";
    }

    public function toArray(): array {
        return [
            'width' => $this->width,
            'height' => $this->height,
        ];
    }

    public function equals(ValueObject $other): bool {
        return $other instanceof self
            && $this->width === $other->width
            && $this->height === $other->height;
    }
}
```

**Day 4: Implement Aggregate Root & Entities**

```php
// app/Contexts/Platform/Domain/Branding/Entities/BrandingAsset.php
final class BrandingAsset {
    public function __construct(
        private BrandingAssetId $id,
        private LogoType $type,
        private AssetPath $path,
        private AssetMetadata $metadata,
        private AssetStatus $status,
        private \DateTimeImmutable $uploadedAt = new \DateTimeImmutable()
    ) {}

    public function id(): BrandingAssetId {
        return $this->id;
    }

    public function type(): LogoType {
        return $this->type;
    }

    public function path(): AssetPath {
        return $this->path;
    }

    public function metadata(): AssetMetadata {
        return $this->metadata;
    }

    public function isActive(): bool {
        return $this->status->isActive();
    }

    public function deactivate(): void {
        $this->status = AssetStatus::inactive();
    }
}

// app/Contexts/Platform/Domain/Branding/Entities/BrandingAssetCollection.php
final class BrandingAssetCollection implements \IteratorAggregate, \Countable {
    /** @var BrandingAsset[] */
    private array $assets;

    private function __construct(array $assets) {
        $this->assets = $assets;
    }

    public static function empty(): self {
        return new self([]);
    }

    public static function fromArray(array $assets): self {
        foreach ($assets as $asset) {
            if (!$asset instanceof BrandingAsset) {
                throw new \InvalidArgumentException('All items must be BrandingAsset instances');
            }
        }

        return new self($assets);
    }

    public function hasPrimaryLogo(): bool {
        return $this->hasActiveAssetOfType(LogoType::PRIMARY);
    }

    public function primaryLogo(): ?BrandingAsset {
        return $this->getActiveAssetOfType(LogoType::PRIMARY);
    }

    /**
     * Replace primary logo (business rule: only one active primary logo)
     */
    public function replacePrimaryLogo(BrandingAsset $newLogo): self {
        if (!$newLogo->type()->equals(LogoType::PRIMARY)) {
            throw new \InvalidArgumentException('Asset must be PRIMARY type');
        }

        $assets = [];

        // Deactivate existing primary logo
        foreach ($this->assets as $asset) {
            if ($asset->type()->equals(LogoType::PRIMARY) && $asset->isActive()) {
                $asset->deactivate();
            }
            $assets[] = $asset;
        }

        // Add new primary logo
        $assets[] = $newLogo;

        return new self($assets);
    }

    private function hasActiveAssetOfType(LogoType $type): bool {
        return $this->getActiveAssetOfType($type) !== null;
    }

    private function getActiveAssetOfType(LogoType $type): ?BrandingAsset {
        foreach ($this->assets as $asset) {
            if ($asset->type()->equals($type) && $asset->isActive()) {
                return $asset;
            }
        }

        return null;
    }

    public function getIterator(): \ArrayIterator {
        return new \ArrayIterator($this->assets);
    }

    public function count(): int {
        return count($this->assets);
    }
}
```

**Deliverables Day 3-4:**
- [ ] All domain value objects implemented
- [ ] TenantBranding aggregate root implemented
- [ ] BrandingAsset entity and collection
- [ ] All domain tests GREEN (60+ tests)
- [ ] Zero framework dependencies in domain

---

#### **Day 5-6: Simple Repository Pattern**

```php
// app/Contexts/Platform/Domain/Repositories/TenantBrandingRepositoryInterface.php
interface TenantBrandingRepositoryInterface {
    public function save(TenantBranding $branding): void;

    public function findById(TenantBrandingId $id): ?TenantBranding;

    public function findByTenantId(TenantId $tenantId): ?TenantBranding;

    public function findByTenantSlug(string $slug): ?TenantBranding;

    /**
     * List all tenant branding with pagination
     */
    public function listAll(int $page = 1, int $perPage = 20): PaginatedResult;

    /**
     * Search by tenant name or slug
     */
    public function search(string $searchTerm, int $page = 1, int $perPage = 20): PaginatedResult;
}

// app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantBrandingRepository.php
final class EloquentTenantBrandingRepository implements TenantBrandingRepositoryInterface {
    public function __construct(
        private AssetUrlResolver $urlResolver
    ) {}

    public function save(TenantBranding $branding): void {
        $model = TenantBrandingModel::updateOrCreate(
            ['tenant_id' => $branding->tenantId()->toInt()],
            [
                'id' => $branding->id()->toString(),
                'theme_json' => $this->serializeTheme($branding->theme()),
                'content_json' => $this->serializeContent($branding->content()),
                'assets_json' => $this->serializeAssets($branding->assets()),
                'state' => $branding->state()->toString(),
                'version' => $branding->version()->toInt(),
                'published_at' => $branding->publishedAt(),
            ]
        );
    }

    public function findByTenantSlug(string $slug): ?TenantBranding {
        $model = TenantBrandingModel::whereHas('tenant', fn($q) => $q->where('slug', $slug))
            ->first();

        return $model ? $this->toDomain($model) : null;
    }

    public function listAll(int $page = 1, int $perPage = 20): PaginatedResult {
        $paginator = TenantBrandingModel::with('tenant')
            ->orderBy('updated_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return new PaginatedResult(
            items: $paginator->items()->map(fn($m) => $this->toDomain($m))->toArray(),
            total: $paginator->total(),
            page: $paginator->currentPage(),
            perPage: $paginator->perPage()
        );
    }

    private function toDomain(TenantBrandingModel $model): TenantBranding {
        return TenantBranding::reconstitute(
            id: TenantBrandingId::fromString($model->id),
            tenantId: TenantId::fromInt($model->tenant_id),
            theme: $this->deserializeTheme($model->theme_json),
            content: $this->deserializeContent($model->content_json),
            assets: $this->deserializeAssets($model->assets_json),
            state: BrandingState::fromString($model->state),
            version: Version::fromInt($model->version),
            createdAt: $model->created_at,
            updatedAt: $model->updated_at,
            publishedAt: $model->published_at
        );
    }

    private function serializeAssets(BrandingAssetCollection $assets): array {
        $serialized = [];

        foreach ($assets as $asset) {
            $serialized[] = [
                'id' => $asset->id()->toString(),
                'type' => $asset->type()->toString(),
                'path' => $asset->path()->toString(),
                'metadata' => [
                    'dimensions' => $asset->metadata()->dimensions()->toArray(),
                    'file_size' => $asset->metadata()->fileSize(),
                    'mime_type' => $asset->metadata()->mimeType(),
                ],
                'status' => $asset->isActive() ? 'active' : 'inactive',
                'uploaded_at' => $asset->uploadedAt()->format('Y-m-d H:i:s'),
            ];
        }

        return $serialized;
    }

    private function deserializeAssets(array $json): BrandingAssetCollection {
        if (empty($json)) {
            return BrandingAssetCollection::empty();
        }

        $assets = [];

        foreach ($json as $data) {
            $assets[] = new BrandingAsset(
                id: BrandingAssetId::fromString($data['id']),
                type: LogoType::fromString($data['type']),
                path: AssetPath::fromString($data['path']),
                metadata: new AssetMetadata(
                    dimensions: new Dimensions($data['metadata']['dimensions']['width'], $data['metadata']['dimensions']['height']),
                    fileSize: $data['metadata']['file_size'],
                    mimeType: $data['metadata']['mime_type']
                ),
                status: AssetStatus::fromString($data['status']),
                uploadedAt: new \DateTimeImmutable($data['uploaded_at'])
            );
        }

        return BrandingAssetCollection::fromArray($assets);
    }
}
```

**Deliverables Day 5-6:**
- [ ] Repository interface (domain)
- [ ] Eloquent implementation (infrastructure)
- [ ] Repository tests (integration tests with database)
- [ ] Serialization/deserialization tests

---

#### **Day 7: Simple MVP Admin API**

```php
// routes/platform-api/branding.php
Route::prefix('admin/branding')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/', [BrandingAdminController::class, 'index']);
    Route::get('/{tenant}', [BrandingAdminController::class, 'show']);
    Route::put('/{tenant}', [BrandingAdminController::class, 'update']);
    Route::post('/{tenant}/logo', [BrandingAdminController::class, 'uploadLogo']);
    Route::post('/{tenant}/publish', [BrandingAdminController::class, 'publish']);
});

// app/Http/Controllers/Admin/BrandingAdminController.php
final class BrandingAdminController extends Controller {
    public function __construct(
        private TenantBrandingRepositoryInterface $repository,
        private AssetStorageAdapter $assetStorage,
        private AssetUrlResolver $urlResolver
    ) {}

    public function index(Request $request): JsonResponse {
        $searchTerm = $request->query('search');
        $page = $request->query('page', 1);
        $perPage = $request->query('per_page', 20);

        $result = $searchTerm
            ? $this->repository->search($searchTerm, $page, $perPage)
            : $this->repository->listAll($page, $perPage);

        return response()->json([
            'data' => array_map(
                fn($branding) => $this->toAdminDto($branding),
                $result->items
            ),
            'meta' => [
                'total' => $result->total,
                'page' => $result->page,
                'per_page' => $result->perPage,
            ],
        ]);
    }

    public function show(string $tenant): JsonResponse {
        $branding = $this->repository->findByTenantSlug($tenant);

        if (!$branding) {
            return response()->json(['error' => 'Branding not found'], 404);
        }

        return response()->json([
            'data' => $this->toAdminDto($branding),
        ]);
    }

    public function update(UpdateBrandingRequest $request, string $tenant): JsonResponse {
        $branding = $this->repository->findByTenantSlug($tenant);

        if (!$branding) {
            return response()->json(['error' => 'Branding not found'], 404);
        }

        // Optimistic locking check
        if ($request->input('expected_version') !== $branding->version()->toInt()) {
            return response()->json([
                'error' => 'ConcurrencyException',
                'message' => 'Branding was modified by another user',
                'current_version' => $branding->version()->toInt(),
            ], 409);
        }

        $updater = UserId::fromInt(auth()->id());

        // Update theme if provided
        if ($request->has('theme')) {
            try {
                $branding->updateTheme(
                    BrandingTheme::create(
                        BrandingColor::fromHex($request->input('theme.primary_color')),
                        BrandingColor::fromHex($request->input('theme.secondary_color')),
                        $request->input('theme.font_family')
                    ),
                    $updater
                );
            } catch (WcagContrastViolation $e) {
                return response()->json([
                    'error' => 'WcagContrastViolation',
                    'message' => $e->getMessage(),
                ], 422);
            }
        }

        // Update content if provided
        if ($request->has('content')) {
            $branding->updateContent(
                BrandingContent::create(
                    $request->input('content.welcome_message'),
                    $request->input('content.hero_title'),
                    $request->input('content.hero_subtitle'),
                    $request->input('content.cta_text')
                ),
                $updater
            );
        }

        $this->repository->save($branding);

        return response()->json([
            'data' => $this->toAdminDto($branding),
            'message' => 'Branding updated successfully',
        ]);
    }

    public function uploadLogo(UploadLogoRequest $request, string $tenant): JsonResponse {
        $branding = $this->repository->findByTenantSlug($tenant);

        if (!$branding) {
            return response()->json(['error' => 'Branding not found'], 404);
        }

        $file = $request->file('logo');
        $updater = UserId::fromInt(auth()->id());

        // Upload to CDN
        $assetPath = AssetPath::fromString("tenants/{$tenant}/logos/primary-" . time() . ".{$file->extension()}");

        $uploadResult = $this->assetStorage->upload(
            new AssetUpload($file, $assetPath)
        );

        // Update domain
        try {
            $branding->updatePrimaryLogo(
                $assetPath,
                new AssetMetadata(
                    new Dimensions($uploadResult->width(), $uploadResult->height()),
                    $file->getSize(),
                    $file->getMimeType()
                ),
                $updater
            );
        } catch (InvalidLogoDimensionsException $e) {
            // Cleanup uploaded asset
            $this->assetStorage->delete($assetPath);

            return response()->json([
                'error' => 'InvalidLogoDimensions',
                'message' => $e->getMessage(),
            ], 422);
        }

        $this->repository->save($branding);

        return response()->json([
            'data' => [
                'path' => $assetPath->toString(),
                'url' => $this->urlResolver->resolve($assetPath),
                'dimensions' => $uploadResult->dimensions()->toArray(),
                'version' => $branding->version()->toInt(),
            ],
            'message' => 'Logo uploaded successfully',
        ]);
    }

    public function publish(Request $request, string $tenant): JsonResponse {
        $branding = $this->repository->findByTenantSlug($tenant);

        if (!$branding) {
            return response()->json(['error' => 'Branding not found'], 404);
        }

        $publisher = UserId::fromInt(auth()->id());

        try {
            $branding->publish($publisher);
        } catch (InvalidStateTransitionException $e) {
            return response()->json([
                'error' => 'InvalidStateTransition',
                'message' => $e->getMessage(),
            ], 422);
        }

        $this->repository->save($branding);

        return response()->json([
            'data' => $this->toAdminDto($branding),
            'message' => 'Branding published successfully',
        ]);
    }

    private function toAdminDto(TenantBranding $branding): array {
        return [
            'id' => $branding->id()->toString(),
            'tenant_id' => $branding->tenantId()->toString(),
            'theme' => [
                'primary_color' => $branding->theme()->primaryColor()->toHex(),
                'secondary_color' => $branding->theme()->secondaryColor()->toHex(),
                'font_family' => $branding->theme()->fontFamily(),
            ],
            'content' => [
                'welcome_message' => $branding->content()->welcomeMessage(),
                'hero_title' => $branding->content()->heroTitle(),
                'hero_subtitle' => $branding->content()->heroSubtitle(),
                'cta_text' => $branding->content()->ctaText(),
            ],
            'assets' => [
                'primary_logo' => $branding->assets()->primaryLogo()
                    ? [
                        'path' => $branding->assets()->primaryLogo()->path()->toString(),
                        'url' => $this->urlResolver->resolve($branding->assets()->primaryLogo()->path()),
                        'dimensions' => $branding->assets()->primaryLogo()->metadata()->dimensions()->toArray(),
                    ]
                    : null,
            ],
            'state' => $branding->state()->toString(),
            'version' => $branding->version()->toInt(),
            'published_at' => $branding->publishedAt()?->format('Y-m-d H:i:s'),
            'updated_at' => $branding->updatedAt()->format('Y-m-d H:i:s'),
        ];
    }
}
```

**Deliverables Day 7:**
- [ ] Admin API endpoints implemented
- [ ] Request validation classes
- [ ] API integration tests
- [ ] Postman/OpenAPI documentation

---

### **WEEK 2: VUE DASHBOARD + CDN + POLISH (Days 8-14)**

#### **Day 8-9: Vue 3 Admin Dashboard MVP**

```vue
<!-- resources/js/Pages/Admin/Branding/Index.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBrandingStore } from '@/Stores/BrandingStore'
import AdminLayout from '@/Layouts/AdminLayout.vue'
import BrandingCard from '@/Components/Admin/Branding/BrandingCard.vue'
import { useDebounceFn } from '@vueuse/core'

const brandingStore = useBrandingStore()
const searchTerm = ref('')

onMounted(() => {
  brandingStore.loadAll()
})

const debouncedSearch = useDebounceFn(() => {
  brandingStore.loadAll(searchTerm.value)
}, 300)

function handleEdit(tenantSlug: string) {
  router.push(`/admin/branding/${tenantSlug}/edit`)
}
</script>

<template>
  <AdminLayout title="Tenant Branding Management">
    <div class="branding-dashboard">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Tenant Branding</h1>
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search tenants..."
          class="px-4 py-2 border rounded-lg"
          @input="debouncedSearch"
        />
      </div>

      <!-- Loading -->
      <div v-if="brandingStore.isLoading" class="flex justify-center py-12">
        <Spinner />
      </div>

      <!-- Error -->
      <div v-else-if="brandingStore.error" class="bg-red-100 text-red-700 p-4 rounded">
        {{ brandingStore.error }}
      </div>

      <!-- Branding Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <BrandingCard
          v-for="branding in brandingStore.allBranding"
          :key="branding.tenant_id"
          :branding="branding"
          @edit="handleEdit"
        />
      </div>
    </div>
  </AdminLayout>
</template>

<!-- resources/js/Pages/Admin/Branding/Edit.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useBrandingStore } from '@/Stores/BrandingStore'
import AdminLayout from '@/Layouts/AdminLayout.vue'
import ColorEditor from '@/Components/Admin/Branding/ColorEditor.vue'
import LogoUploader from '@/Components/Admin/Branding/LogoUploader.vue'
import ContentEditor from '@/Components/Admin/Branding/ContentEditor.vue'
import BrandingPreview from '@/Components/Admin/Branding/BrandingPreview.vue'

const route = useRoute()
const brandingStore = useBrandingStore()
const activeTab = ref('colors')

const branding = computed(() => brandingStore.currentBranding)

onMounted(async () => {
  await brandingStore.loadTenant(route.params.tenant as string)
})

async function handleColorsUpdate(colors: { primary: string; secondary: string }) {
  await brandingStore.updateColors(route.params.tenant as string, colors)
}

async function handleLogoUpload(file: File) {
  await brandingStore.uploadLogo(route.params.tenant as string, file)
}

async function handlePublish() {
  await brandingStore.publish(route.params.tenant as string)
}
</script>

<template>
  <AdminLayout :title="`Edit Branding: ${branding?.tenant_name}`">
    <div v-if="branding" class="branding-editor">
      <!-- Tabs -->
      <div class="border-b mb-6">
        <nav class="flex space-x-8">
          <button
            @click="activeTab = 'colors'"
            :class="activeTab === 'colors' ? 'border-b-2 border-blue-500' : ''"
            class="pb-4 px-1 font-medium"
          >
            Colors
          </button>
          <button
            @click="activeTab = 'logo'"
            :class="activeTab === 'logo' ? 'border-b-2 border-blue-500' : ''"
            class="pb-4 px-1 font-medium"
          >
            Logo
          </button>
          <button
            @click="activeTab = 'content'"
            :class="activeTab === 'content' ? 'border-b-2 border-blue-500' : ''"
            class="pb-4 px-1 font-medium"
          >
            Content
          </button>
          <button
            @click="activeTab = 'preview'"
            :class="activeTab === 'preview' ? 'border-b-2 border-blue-500' : ''"
            class="pb-4 px-1 font-medium"
          >
            Preview
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <ColorEditor
          v-show="activeTab === 'colors'"
          :branding="branding"
          @update="handleColorsUpdate"
        />

        <LogoUploader
          v-show="activeTab === 'logo'"
          :branding="branding"
          @upload="handleLogoUpload"
        />

        <ContentEditor
          v-show="activeTab === 'content'"
          :branding="branding"
        />

        <BrandingPreview
          v-show="activeTab === 'preview'"
          :branding="branding"
        />
      </div>

      <!-- Actions -->
      <div class="mt-8 flex justify-between">
        <button
          @click="$router.back()"
          class="px-4 py-2 border rounded-lg"
        >
          Cancel
        </button>

        <button
          v-if="branding.state === 'draft'"
          @click="handlePublish"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Publish Changes
        </button>
      </div>
    </div>
  </AdminLayout>
</template>
```

**Deliverables Day 8-9:**
- [ ] Admin dashboard pages (Index, Edit)
- [ ] Basic Pinia store
- [ ] Core components (ColorEditor, LogoUploader, ContentEditor)
- [ ] Tailwind CSS styling
- [ ] Component tests (Vitest)

---

#### **Day 10-11: CDN Integration via Adapters**

```php
// app/Contexts/Platform/Infrastructure/Adapters/CloudinaryAssetStorageAdapter.php
final class CloudinaryAssetStorageAdapter implements AssetStorageAdapter {
    private Cloudinary $cloudinary;

    public function __construct(
        private string $cloudName,
        private string $apiKey,
        private string $apiSecret
    ) {
        $this->cloudinary = new Cloudinary([
            'cloud' => [
                'cloud_name' => $cloudName,
                'api_key' => $apiKey,
                'api_secret' => $apiSecret,
            ],
        ]);
    }

    public function upload(AssetUpload $upload): StoredAsset {
        $file = $upload->file();
        $path = $upload->path();

        // Extract folder and public_id from path
        // "tenants/nrna/logos/primary.png" → folder: "tenants/nrna/logos", public_id: "primary"
        $pathParts = pathinfo($path->toString());
        $folder = $pathParts['dirname'];
        $publicId = $pathParts['filename'];

        $result = $this->cloudinary->uploadApi()->upload(
            $file->getRealPath(),
            [
                'folder' => $folder,
                'public_id' => $publicId,
                'transformation' => [
                    ['quality' => 'auto:best'],
                    ['fetch_format' => 'auto'],
                ],
                'tags' => ['branding', 'primary_logo'],
            ]
        );

        return new StoredAsset(
            assetId: $result['public_id'],
            path: $path,
            url: $result['secure_url'],
            width: $result['width'],
            height: $result['height'],
            fileSize: $result['bytes']
        );
    }

    public function delete(AssetPath $path): void {
        $publicId = $this->extractPublicIdFromPath($path);
        $this->cloudinary->uploadApi()->destroy($publicId);
    }

    private function extractPublicIdFromPath(AssetPath $path): string {
        // "tenants/nrna/logos/primary.png" → "tenants/nrna/logos/primary"
        $pathInfo = pathinfo($path->toString());
        return $pathInfo['dirname'] . '/' . $pathInfo['filename'];
    }
}

// app/Contexts/Platform/Infrastructure/Adapters/CloudinaryUrlResolver.php
final class CloudinaryUrlResolver implements AssetUrlResolver {
    public function __construct(
        private string $cloudName
    ) {}

    public function resolve(AssetPath $path): string {
        return "https://res.cloudinary.com/{$this->cloudName}/{$path->toString()}";
    }
}

// Service Provider Binding
// app/Providers/BrandingServiceProvider.php
public function register(): void {
    // Bind adapter based on config
    $this->app->bind(AssetStorageAdapter::class, function () {
        $driver = config('branding.asset_storage_driver', 'cloudinary');

        return match($driver) {
            'cloudinary' => new CloudinaryAssetStorageAdapter(
                cloudName: config('services.cloudinary.cloud_name'),
                apiKey: config('services.cloudinary.api_key'),
                apiSecret: config('services.cloudinary.api_secret')
            ),
            's3' => new S3AssetStorageAdapter(/* ... */),
            'fake' => new FakeInMemoryAssetStorageAdapter(),
            default => throw new \RuntimeException("Unknown asset storage driver: {$driver}")
        };
    });

    $this->app->bind(AssetUrlResolver::class, function () {
        $driver = config('branding.asset_storage_driver', 'cloudinary');

        return match($driver) {
            'cloudinary' => new CloudinaryUrlResolver(
                cloudName: config('services.cloudinary.cloud_name')
            ),
            's3' => new S3UrlResolver(/* ... */),
            'fake' => new FakeUrlResolver(),
            default => throw new \RuntimeException("Unknown asset storage driver: {$driver}")
        };
    });
}
```

**Deliverables Day 10-11:**
- [ ] Cloudinary adapter implementation
- [ ] URL resolver implementation
- [ ] Contract tests for adapters
- [ ] Configuration in .env
- [ ] CDN integration tests

---

#### **Day 12-13: WCAG Validation & UI Polish**

```typescript
// resources/js/Utils/WcagValidator.ts
export function calculateContrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(color1)
  const l2 = relativeLuminance(color2)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsWcagAA(color1: string, color2: string): boolean {
  return calculateContrastRatio(color1, color2) >= 4.5
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)

  const r = srgbToLinear(rgb.r / 255)
  const g = srgbToLinear(rgb.g / 255)
  const b = srgbToLinear(rgb.b / 255)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function srgbToLinear(value: number): number {
  return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`)
  }

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}
```

```vue
<!-- resources/js/Components/Admin/Branding/ColorEditor.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { calculateContrastRatio, meetsWcagAA } from '@/Utils/WcagValidator'
import type { BrandingDto } from '@/Types/Branding'

const props = defineProps<{
  branding: BrandingDto
}>()

const emit = defineEmits<{
  update: [colors: { primary: string; secondary: string }]
}>()

const localPrimary = ref(props.branding.theme.primary_color)
const localSecondary = ref(props.branding.theme.secondary_color)

const contrastRatio = computed(() => {
  return calculateContrastRatio(localPrimary.value, localSecondary.value)
})

const wcagCompliant = computed(() => {
  return meetsWcagAA(localPrimary.value, localSecondary.value)
})

const contrastLevel = computed(() => {
  const ratio = contrastRatio.value

  if (ratio >= 7) return { label: 'AAA', color: 'green' }
  if (ratio >= 4.5) return { label: 'AA', color: 'blue' }
  return { label: 'Fail', color: 'red' }
})

function saveColors() {
  if (!wcagCompliant.value) return

  emit('update', {
    primary: localPrimary.value,
    secondary: localSecondary.value,
  })
}
</script>

<template>
  <div class="color-editor max-w-4xl">
    <div class="grid grid-cols-2 gap-8">
      <!-- Primary Color -->
      <div>
        <label class="block text-sm font-medium mb-2">Primary Color</label>
        <div class="flex gap-2">
          <input
            v-model="localPrimary"
            type="color"
            class="w-16 h-16 rounded border cursor-pointer"
          />
          <input
            v-model="localPrimary"
            type="text"
            pattern="^#[0-9A-Fa-f]{6}$"
            class="flex-1 px-4 py-2 border rounded"
          />
        </div>
      </div>

      <!-- Secondary Color -->
      <div>
        <label class="block text-sm font-medium mb-2">Secondary Color</label>
        <div class="flex gap-2">
          <input
            v-model="localSecondary"
            type="color"
            class="w-16 h-16 rounded border cursor-pointer"
          />
          <input
            v-model="localSecondary"
            type="text"
            pattern="^#[0-9A-Fa-f]{6}$"
            class="flex-1 px-4 py-2 border rounded"
          />
        </div>
      </div>
    </div>

    <!-- WCAG Validation -->
    <div class="mt-6 p-4 rounded" :class="{
      'bg-green-100 border border-green-300': wcagCompliant,
      'bg-red-100 border border-red-300': !wcagCompliant
    }">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium">WCAG Contrast Ratio</h3>
          <p class="text-sm text-gray-600">
            {{ contrastRatio.toFixed(2) }}:1
          </p>
        </div>
        <span
          class="px-3 py-1 rounded font-bold"
          :class="{
            'bg-green-600 text-white': contrastLevel.color === 'green',
            'bg-blue-600 text-white': contrastLevel.color === 'blue',
            'bg-red-600 text-white': contrastLevel.color === 'red'
          }"
        >
          {{ contrastLevel.label }}
        </span>
      </div>
      <p v-if="!wcagCompliant" class="mt-2 text-sm text-red-700">
        ⚠️ Colors do not meet WCAG AA standard (requires 4.5:1 minimum)
      </p>
    </div>

    <!-- Live Preview -->
    <div class="mt-8">
      <h3 class="font-medium mb-4">Live Preview</h3>
      <div
        class="p-8 rounded"
        :style="{
          backgroundColor: localPrimary,
          color: localSecondary
        }"
      >
        <h1 class="text-2xl font-bold mb-2">Sample Heading</h1>
        <p class="mb-4">Sample text content to preview contrast</p>
        <button
          :style="{
            backgroundColor: localSecondary,
            color: localPrimary
          }"
          class="px-6 py-2 rounded font-medium"
        >
          Sample Button
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-8 flex justify-end gap-4">
      <button
        @click="resetColors"
        class="px-4 py-2 border rounded hover:bg-gray-50"
      >
        Reset
      </button>
      <button
        @click="saveColors"
        :disabled="!wcagCompliant"
        class="px-6 py-2 rounded font-medium"
        :class="{
          'bg-blue-600 text-white hover:bg-blue-700': wcagCompliant,
          'bg-gray-300 text-gray-500 cursor-not-allowed': !wcagCompliant
        }"
      >
        Save Colors
      </button>
    </div>
  </div>
</template>
```

**Deliverables Day 12-13:**
- [ ] WCAG validation UI
- [ ] Real-time contrast checking
- [ ] Accessibility improvements
- [ ] Component polish and styling

---

#### **Day 14: Testing, Documentation, Deployment**

```bash
# Integration Testing
php artisan test --filter=Branding

# E2E Testing (Cypress)
npm run cypress:run

# Build for production
npm run build

# Deployment checklist
php artisan branding:migrate-existing --dry-run
php artisan migrate --database=landlord
php artisan cache:clear
php artisan config:clear
```

**Deliverables Day 14:**
- [ ] All tests passing (domain, integration, E2E)
- [ ] API documentation updated
- [ ] Deployment runbook created
- [ ] Production deployment successful

---

## ✅ **14-DAY SUCCESS CRITERIA**

### **Week 1 Complete:**
- [ ] Pure domain model (no infrastructure dependencies)
- [ ] Existing tenant data migrated successfully
- [ ] Simple admin API working (CRUD endpoints)
- [ ] 80%+ domain test coverage
- [ ] Zero DDD violations

### **Week 2 Complete:**
- [ ] Vue 3 admin dashboard MVP functional
- [ ] CDN integration via proper adapters
- [ ] Real-time WCAG validation in UI
- [ ] Production deployment ready
- [ ] All tests passing (90%+ coverage)

### **Quality Gates:**
- [ ] Domain layer has ZERO framework dependencies
- [ ] All adapters pass contract tests
- [ ] WCAG validation enforced in domain AND UI
- [ ] Backward compatibility maintained
- [ ] Performance: API < 200ms (90th percentile)
- [ ] CDN uploads: 99%+ success rate

---

## 🎯 **FINAL EXECUTION CHECKLIST**

### **Before Starting (Day 0):**
- [ ] Create feature branch: `feature/phase4-admin-branding-mvp`
- [ ] Review all architecture documents
- [ ] Set up Cloudinary test account
- [ ] Configure .env for development

### **Daily Checkpoints:**
- [ ] Morning: Write failing tests
- [ ] Afternoon: Implement to make tests pass
- [ ] Evening: Commit with meaningful messages
- [ ] Code review with peer before merging

### **Architectural Rules (Enforce Daily):**
1. ❌ **NEVER** put infrastructure code in domain layer
2. ✅ **ALWAYS** write failing test first (TDD)
3. ❌ **NEVER** skip contract testing for adapters
4. ✅ **ALWAYS** use dependency injection
5. ❌ **NEVER** expose domain objects directly in API responses

---

## 📞 **STAKEHOLDER APPROVALS**

### **Final Confirmations:**

1. **CDN Provider:** Cloudinary approved ✅
2. **Logo Scope:** Primary logo only for MVP ✅
3. **Timeline:** 14 days approved ✅
4. **API Pattern:** Start with CRUD, evolve to commands ✅
5. **State Management:** Draft/Published workflow approved ✅

---

## 🚀 **READY TO BEGIN**

**Status:** ✅ **APPROVED - START DAY 1 IMMEDIATELY**

**Your First Task (Day 1 Morning):**

1. Create failing domain test:
   ```bash
   touch tests/Unit/Contexts/Platform/Domain/Branding/TenantBrandingTest.php
   ```

2. Implement the test from this plan (see Day 3 section above)

3. Run test (should fail):
   ```bash
   php artisan test --filter=TenantBrandingTest
   ```

4. Begin implementing domain classes to make test pass

---

**Document Version:** 2.0 (Final)
**Last Updated:** 2026-01-07
**Approved By:** Senior Software Architect + Principal Architect Reviews
**Estimated Effort:** 14 days (1 senior backend + 1 mid-level frontend developer)

**Let's build this right, deliver fast, and maintain architectural excellence!** 🚀

#  Create file packages\laravel-backend\app\Contexts\Platform\Domain\Events\BrandingArchived.php
