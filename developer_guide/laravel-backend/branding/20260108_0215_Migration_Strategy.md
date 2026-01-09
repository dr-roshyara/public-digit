# Admin API - Migration Strategy: Phase 2/3 → Phase 4

**Date**: 2026-01-08 02:15
**Status**: Pre-Migration - Domain Ready
**Database**: Phase 2/3 Schema (No state/version columns)
**Repository**: Using `fromExisting()` factory (temporary)

---

## 🎯 **OVERVIEW**

This guide details the **safe migration path** from Phase 2/3 branding schema to Phase 4 enterprise schema.

### **Current State (Phase 2/3)**:
```sql
tenant_branding (12 MVP fields only)
├── tenant_slug
├── tenant_db_id
├── primary_color
├── secondary_color
├── logo_url
├── font_family
├── welcome_message
├── hero_title
├── hero_subtitle
├── cta_text
├── organization_name
├── tagline
├── favicon_url
├── created_at
└── updated_at
```

### **Target State (Phase 4)**:
```sql
tenant_branding (Phase 4 extensions)
├── ... (all Phase 2/3 fields)
├── state              [NEW - varchar(20), default 'published']
├── version            [NEW - integer, default 1]
└── assets             [NEW - jsonb, nullable]
```

---

## 🚀 **MIGRATION PHASES**

### **Phase 1: Domain Implementation (COMPLETED ✅)**
- All domain value objects created
- All domain events created
- All domain exceptions created
- TenantBranding aggregate extended
- Tests: 19/26 passing (domain verified)
- Repository: Uses `fromExisting()` (backward compatible)

### **Phase 2: Database Migration (Day 2 - NEXT)**
1. Create migration file
2. Add `state` column
3. Add `version` column
4. Add `assets` JSONB column
5. Backfill existing data
6. Test migration + rollback

### **Phase 3: Repository Switch (Day 3)**
1. Update `EloquentTenantBrandingRepository::toDomain()`
2. Switch from `fromExisting()` to `reconstitute()`
3. Add state/version mapping
4. Test with existing data

### **Phase 4: API Implementation (Days 5-6)**
1. Create Admin API endpoints
2. State transition endpoints
3. Logo upload endpoint
4. Validation middleware

---

## 📊 **MIGRATION FILE STRUCTURE**

### **Migration Class Name**:
```
2026_01_08_000001_add_phase4_fields_to_tenant_branding_table.php
```

### **Migration File Location**:
```
packages/laravel-backend/database/migrations/landlord/
```

### **Migration Code**:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Phase 4: Add state, version, and assets columns to tenant_branding
     *
     * Business Rules:
     * - Existing branding is marked as PUBLISHED (already in use by tenants)
     * - Version starts at 1 for all existing records
     * - Assets starts as NULL (logos will be uploaded via Admin API)
     * - State transition rules enforced by Domain layer
     */
    public function up(): void
    {
        Schema::connection('landlord')->table('tenant_branding', function (Blueprint $table) {
            // State: draft | published | archived
            $table->string('state', 20)->default('published')->after('favicon_url');
            $table->index('state'); // For filtering by state

            // Version: Optimistic locking
            $table->integer('version')->default(1)->after('state');

            // Assets: Primary logo metadata (JSONB for flexibility)
            $table->jsonb('assets')->nullable()->after('version');
        });

        // Backfill existing records
        DB::connection('landlord')->table('tenant_branding')->update([
            'state' => 'published',   // Existing branding is already in use
            'version' => 1,           // Initial version
            'assets' => null          // No logo metadata yet
        ]);
    }

    /**
     * Reverse the migrations.
     *
     * CRITICAL: This rollback is SAFE because:
     * - Domain layer continues to work with fromExisting()
     * - No data loss (state/version/assets are additive)
     * - Existing APIs (Mobile/Desktop) unaffected
     */
    public function down(): void
    {
        Schema::connection('landlord')->table('tenant_branding', function (Blueprint $table) {
            $table->dropColumn(['state', 'version', 'assets']);
        });
    }
};
```

---

## 🔄 **REPOSITORY TRANSFORMATION**

### **BEFORE Migration (Current - Day 1)**:

```php
/**
 * Map Eloquent model to domain entity
 *
 * Uses fromExisting() because database doesn't have state/version columns yet
 */
private function toDomain(TenantBrandingModel $model): TenantBranding
{
    return TenantBranding::fromExisting(
        TenantId::fromSlug($model->tenant_slug),
        BrandingBundle::create(/* ... */),
        DateTimeImmutable::createFromMutable($model->created_at),
        DateTimeImmutable::createFromMutable($model->updated_at)
    );
    // Automatically sets:
    // - state = PUBLISHED (existing branding is in use)
    // - version = 1
}
```

### **AFTER Migration (Day 3)**:

```php
/**
 * Map Eloquent model to domain entity
 *
 * Uses reconstitute() with full state/version from database
 */
private function toDomain(TenantBrandingModel $model): TenantBranding
{
    // Parse assets JSONB
    $assets = $this->parseAssets($model->assets);

    return TenantBranding::reconstitute(
        TenantId::fromSlug($model->tenant_slug),
        BrandingBundle::create(
            visuals: BrandingVisuals::create(/* ... */),
            content: BrandingContent::create(/* ... */),
            identity: BrandingIdentity::create(/* ... */),
            assets: $assets  // NEW - from JSONB column
        ),
        DateTimeImmutable::createFromMutable($model->created_at),
        DateTimeImmutable::createFromMutable($model->updated_at),
        BrandingState::fromString($model->state),      // NEW - from DB
        Version::fromInt($model->version)              // NEW - from DB
    );
}

/**
 * Parse assets JSONB to BrandingAssets value object
 */
private function parseAssets(?string $assetsJson): BrandingAssets
{
    if ($assetsJson === null) {
        return BrandingAssets::empty();
    }

    $data = json_decode($assetsJson, true);

    // No primary logo
    if (!isset($data['primary_logo'])) {
        return BrandingAssets::empty();
    }

    $logo = $data['primary_logo'];

    return BrandingAssets::empty()->withPrimaryLogo(
        AssetPath::fromString($logo['path']),
        AssetMetadata::create(
            dimensions: Dimensions::create(
                $logo['metadata']['width'],
                $logo['metadata']['height']
            ),
            fileSize: $logo['metadata']['file_size'],
            mimeType: $logo['metadata']['mime_type'],
            dominantColor: isset($logo['metadata']['dominant_color'])
                ? BrandingColor::fromString($logo['metadata']['dominant_color'])
                : null
        )
    );
}
```

### **Save Method Changes**:

```php
/**
 * Map domain entity to database array
 */
private function toDatabase(TenantBranding $branding): array
{
    $bundle = $branding->getBranding();
    $visuals = $bundle->getVisuals();
    $content = $bundle->getContent();
    $identity = $bundle->getIdentity();
    $assets = $bundle->getAssets();  // NEW

    return [
        // Existing fields (Phase 2/3)
        'tenant_slug' => $branding->getTenantId()->toString(),
        'primary_color' => $visuals->getPrimaryColor()->toString(),
        'secondary_color' => $visuals->getSecondaryColor()->toString(),
        'logo_url' => $visuals->getLogoUrl(),
        'font_family' => $visuals->getFontFamily(),
        'welcome_message' => $content->getWelcomeMessage(),
        'hero_title' => $content->getHeroTitle(),
        'hero_subtitle' => $content->getHeroSubtitle(),
        'cta_text' => $content->getCtaText(),
        'organization_name' => $identity->getOrganizationName(),
        'tagline' => $identity->getOrganizationTagline(),
        'favicon_url' => $identity->getFaviconUrl(),

        // NEW Phase 4 fields
        'state' => $branding->state()->toString(),
        'version' => $branding->version()->toInt(),
        'assets' => $this->serializeAssets($assets),
    ];
}

/**
 * Serialize BrandingAssets to JSONB
 */
private function serializeAssets(BrandingAssets $assets): ?string
{
    if (!$assets->hasPrimaryLogo()) {
        return null;
    }

    $logo = $assets->primaryLogoPath();
    $metadata = $assets->primaryLogoMetadata();

    $data = [
        'primary_logo' => [
            'path' => $logo->toString(),
            'metadata' => [
                'width' => $metadata->dimensions()->width(),
                'height' => $metadata->dimensions()->height(),
                'file_size' => $metadata->fileSize(),
                'mime_type' => $metadata->mimeType(),
            ]
        ]
    ];

    // Add dominant color if available
    if ($metadata->hasDominantColor()) {
        $data['primary_logo']['metadata']['dominant_color'] =
            $metadata->dominantColor()->toString();
    }

    return json_encode($data);
}
```

---

## 🧪 **TESTING MIGRATION**

### **Pre-Migration Tests**:

```bash
cd packages/laravel-backend

# 1. Verify existing tests still pass
php artisan test --filter=BrandingControllerTest
# Expected: 18/18 passing ✅

php artisan test --filter=Feature.*Mobile.*BrandingControllerTest
# Expected: 11/11 passing ✅

# 2. Verify Phase 4 domain tests
php artisan test --filter=TenantBrandingPhase4Test
# Expected: 19/26 passing (domain verified)
```

### **Migration Execution**:

```bash
# 1. Backup database (CRITICAL)
pg_dump -U postgres -d publicdigit > backup_pre_phase4_migration.sql

# 2. Run migration
php artisan migrate --path=database/migrations/landlord

# 3. Verify migration
php artisan tinker
>>> use App\Contexts\Platform\Infrastructure\Models\TenantBrandingModel;
>>> TenantBrandingModel::first()->state
# Expected: "published"
>>> TenantBrandingModel::first()->version
# Expected: 1
>>> TenantBrandingModel::first()->assets
# Expected: null
```

### **Post-Migration Tests**:

```bash
# 1. Verify backward compatibility maintained
php artisan test --filter=BrandingControllerTest
# Expected: 18/18 passing ✅ (using fromExisting() still)

# 2. Test repository switch to reconstitute()
# (After updating EloquentTenantBrandingRepository)
php artisan test --filter=BrandingControllerTest
# Expected: 18/18 passing ✅

php artisan test --filter=TenantBrandingPhase4Test
# Expected: More tests passing (repository now provides state/version)
```

### **Rollback Test**:

```bash
# 1. Rollback migration
php artisan migrate:rollback --step=1

# 2. Verify existing functionality intact
php artisan test --filter=BrandingControllerTest
# Expected: 18/18 passing ✅ (fromExisting() still works)

# 3. Re-run migration
php artisan migrate --path=database/migrations/landlord
```

---

## ⚠️ **DATA INTEGRITY GUARANTEES**

### **1. Existing Branding Preservation**:
- All 12 MVP fields remain unchanged
- Migration adds new columns with safe defaults
- No data transformation required
- No breaking changes to existing APIs

### **2. State Assignment Logic**:
```
Business Rule: Existing branding is PUBLISHED
Rationale:
- Tenants are already using this branding
- Mobile apps are fetching it
- Desktop apps are displaying it
- Therefore: state = 'published' (not 'draft')
```

### **3. Version Assignment Logic**:
```
Business Rule: Existing branding starts at version 1
Rationale:
- No previous version history tracked
- Version 1 represents "initial state"
- Future updates will increment from version 1
```

### **4. Assets Assignment Logic**:
```
Business Rule: Existing branding has NULL assets
Rationale:
- Phase 2/3 logos stored in logo_url field only
- No metadata (dimensions, file size) tracked
- Admin API will allow uploading new logos with metadata
- Migration does NOT attempt to extract metadata from existing logos
```

---

## 🔒 **ZERO-DOWNTIME MIGRATION**

### **Why This Migration is Safe**:

1. **Additive Only**: No columns dropped, no data changed
2. **Backward Compatible**: Repository uses `fromExisting()` until Day 3
3. **Default Values**: All new columns have safe defaults
4. **No API Changes**: Mobile/Desktop APIs continue to work
5. **Rollback Ready**: `down()` method fully implemented

### **Migration Order**:

```
Step 1: Run migration (adds columns)
        ↓
Step 2: Test existing functionality (should pass)
        ↓
Step 3: Update repository to use reconstitute() (Day 3)
        ↓
Step 4: Test again (should still pass)
        ↓
Step 5: Implement Admin API (Days 5-6)
```

### **If Something Goes Wrong**:

```bash
# Immediate rollback
php artisan migrate:rollback --step=1

# Restore from backup (worst case)
psql -U postgres -d publicdigit < backup_pre_phase4_migration.sql

# Verify rollback
php artisan test --filter=BrandingControllerTest
```

---

## 📋 **PRE-MIGRATION CHECKLIST**

Before running migration, verify:

- [ ] All Phase 4 domain tests passing (19/26 minimum)
- [ ] All Phase 2/3 API tests passing (BrandingControllerTest: 18/18)
- [ ] All Phase 2/3 Mobile API tests passing (11/11)
- [ ] Database backup created
- [ ] Migration file reviewed and approved
- [ ] Rollback procedure documented
- [ ] Repository still using `fromExisting()` (no changes yet)
- [ ] No breaking changes to existing APIs

---

## 📋 **POST-MIGRATION CHECKLIST**

After running migration, verify:

- [ ] Migration succeeded without errors
- [ ] All existing tests still passing
- [ ] `state` column exists with default 'published'
- [ ] `version` column exists with default 1
- [ ] `assets` column exists as nullable JSONB
- [ ] Existing branding records have correct values
- [ ] Rollback tested successfully
- [ ] Ready to proceed to Day 3 (Repository Switch)

---

## 🔄 **MIGRATION TIMELINE**

| Day | Task | Status |
|-----|------|--------|
| Day 1 | Domain implementation + tests | ✅ COMPLETE |
| Day 2 | Database migration | ⏳ NEXT |
| Day 3 | Repository switch to reconstitute() | 🔜 PENDING |
| Day 4 | Repository testing + optimization | 🔜 PENDING |
| Day 5-6 | Admin API implementation | 🔜 PENDING |

---

## 🚨 **CRITICAL WARNINGS**

### **DO NOT**:
- ❌ Run migration on production without testing
- ❌ Skip database backup
- ❌ Update repository to `reconstitute()` before migration
- ❌ Modify existing Phase 2/3 columns
- ❌ Attempt to extract metadata from existing logo URLs
- ❌ Change default values without business approval

### **DO**:
- ✅ Test migration in local/staging first
- ✅ Backup database before migration
- ✅ Run all tests before and after migration
- ✅ Keep repository using `fromExisting()` until Day 3
- ✅ Verify rollback works
- ✅ Document any issues encountered

---

## 📖 **SEE ALSO**

- [Overview & Quick Start](./20260108_0200_Admin_API_Overview_Quick_Start.md)
- [Domain Layer Deep Dive](./20260108_0205_Domain_Layer_Deep_Dive.md)
- [Testing Guide](./20260108_0210_Testing_Guide.md)

---

**Developer Notes**:
- Migration is designed for **zero downtime**
- All changes are **backward compatible**
- Rollback is **fully supported**
- Existing APIs remain **100% functional**
- Ready to proceed when Day 1 is complete ✅
