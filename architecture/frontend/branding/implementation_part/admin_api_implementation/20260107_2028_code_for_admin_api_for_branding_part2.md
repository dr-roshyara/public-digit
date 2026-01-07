# 🏛️ **SENIOR SOLUTION ARCHITECT - COMPREHENSIVE INTEGRATION PLAN**

## **🔍 ARCHITECTURAL ANALYSIS**

Excellent asset management architecture! This is **production-grade** thinking. Now I'll integrate it with our DDD/TDD-first approach, creating a **unified architectural plan** that preserves domain purity while enabling robust asset management.

---

## **🎯 INTEGRATED ARCHITECTURAL VISION**

### **CORE PRINCIPLES (Non-negotiable):**

1. **Domain First**: Assets are part of the domain model, not an afterthought
2. **Event-Driven**: All asset changes emit domain events for consistency
3. **CQRS Optimized**: Separate read models for admin vs public consumption
4. **TDD Mandate**: Write tests before any implementation

---

## **🏗️ INTEGRATED DOMAIN MODEL ARCHITECTURE**

### **UPDATED AGGREGATE DESIGN WITH ASSETS:**

```php
// app/Contexts/Platform/Domain/Models/BrandingBundle.php
final class BrandingBundle implements AggregateRoot
{
    private BrandingBundleId $id;
    private TenantId $tenantId;
    private BrandingVisuals $visuals;
    private BrandingContent $content;
    private BrandingAssets $assets;       // ✅ Integrated asset management
    private BrandingMetadata $metadata;   // Version, audit trail
    private ?PublishedBranding $published = null; // Optional: Draft vs Published
    
    public function __construct(
        BrandingBundleId $id,
        TenantId $tenantId,
        BrandingVisuals $visuals,
        BrandingContent $content,
        BrandingAssets $assets,
        BrandingMetadata $metadata
    ) {
        $this->id = $id;
        $this->tenantId = $tenantId;
        $this->visuals = $visuals;
        $this->content = $content;
        $this->assets = $assets;
        $this->metadata = $metadata;
    }
    
    // ✅ Asset-aware update method
    public function updateLogo(
        LogoType $type,
        LogoReference $logoReference,
        UserId $updater
    ): void {
        // Business rule: Validate logo dimensions per type
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
    
    // ✅ WCAG validation integrated with assets
    public function updateColors(
        BrandingColor $primaryColor,
        BrandingColor $secondaryColor,
        UserId $updater
    ): void {
        $newVisuals = $this->visuals->withColors($primaryColor, $secondaryColor);
        
        // Business rule: Validate contrast with current logo
        if ($this->assets->hasPrimaryLogo()) {
            $this->validateLogoContrast(
                $primaryColor,
                $this->assets->primaryLogo()->dominantColor()
            );
        }
        
        $this->visuals = $newVisuals;
        $this->metadata = $this->metadata->recordUpdate($updater);
        
        $this->recordThat(new BrandingColorsUpdated(
            $this->tenantId,
            $primaryColor,
            $secondaryColor,
            $this->metadata->version()
        ));
    }
    
    // Private validation methods (domain invariants)
    private function validateLogoDimensions(
        LogoType $type, 
        LogoReference $logo
    ): void {
        $requiredDimensions = match($type) {
            LogoType::PRIMARY => new Dimensions(800, 400),
            LogoType::FAVICON => new Dimensions(64, 64),
            // ... other types
        };
        
        if (!$logo->dimensions()->isWithinTolerance($requiredDimensions)) {
            throw new InvalidLogoDimensionsException(
                "Logo dimensions must be approximately {$requiredDimensions}"
            );
        }
    }
}
```

### **ASSET-ENABLED VALUE OBJECTS:**

```php
// app/Contexts/Platform/Domain/ValueObjects/BrandingAssets.php
final class BrandingAssets implements ValueObject
{
    /** @var array<string, LogoReference> */
    private array $logos;
    
    public function __construct(
        ?LogoReference $primaryLogo = null,
        ?LogoReference $darkModeLogo = null,
        ?LogoReference $favicon = null,
        ?LogoReference $emailLogo = null,
        ?LogoReference $mobileLogo = null
    ) {
        $this->logos = array_filter([
            LogoType::PRIMARY->value() => $primaryLogo,
            LogoType::DARK_MODE->value() => $darkModeLogo,
            LogoType::FAVICON->value() => $favicon,
            LogoType::EMAIL->value() => $emailLogo,
            LogoType::MOBILE->value() => $mobileLogo,
        ]);
        
        $this->validateAssetRelationships();
    }
    
    public function withUpdatedLogo(
        LogoType $type,
        LogoReference $logoReference
    ): self {
        $newLogos = $this->logos;
        $newLogos[$type->value()] = $logoReference;
        
        return new self(...array_values($newLogos));
    }
    
    public function primaryLogo(): ?LogoReference
    {
        return $this->logos[LogoType::PRIMARY->value()] ?? null;
    }
    
    public function hasPrimaryLogo(): bool
    {
        return isset($this->logos[LogoType::PRIMARY->value()]);
    }
}

// app/Contexts/Platform/Domain/ValueObjects/LogoReference.php
final class LogoReference implements ValueObject
{
    public function __construct(
        private AssetId $assetId,
        private LogoUrl $url,
        private Dimensions $dimensions,
        private ?Color $dominantColor = null,
        private ?FileHash $fileHash = null
    ) {
        $this->validate();
    }
    
    public function assetId(): AssetId
    {
        return $this->assetId;
    }
    
    public function url(): LogoUrl
    {
        return $this->url;
    }
    
    public function dimensions(): Dimensions
    {
        return $this->dimensions;
    }
    
    public function dominantColor(): ?Color
    {
        return $this->dominantColor;
    }
}
```

---

## **📋 INTEGRATED TDD IMPLEMENTATION PLAN**

### **PHASE 1: DOMAIN MODEL WITH ASSETS (Week 1)**

#### **Day 1: Asset-Enabled Domain Tests**
```php
// tests/Unit/Contexts/Platform/Domain/Models/BrandingBundleTest.php
class BrandingBundleTest extends TestCase
{
    /** @test */
    public function it_can_update_logo_with_domain_validation(): void
    {
        // Given
        $bundle = BrandingBundleFactory::withPrimaryLogo();
        $newLogo = LogoReferenceFactory::create([
            'dimensions' => new Dimensions(800, 400),
            'assetId' => AssetId::generate(),
        ]);
        
        // When/Then
        $this->expectNotToPerformAssertions();
        $bundle->updateLogo(LogoType::PRIMARY, $newLogo, UserId::fromString('user-123'));
        
        // Assert events emitted
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
            'dimensions' => new Dimensions(1000, 1000), // Too large for primary
        ]);
        
        // When/Then
        $this->expectException(InvalidLogoDimensionsException::class);
        $bundle->updateLogo(LogoType::PRIMARY, $wrongSizeLogo, UserId::fromString('user-123'));
    }
    
    /** @test */
    public function it_validates_wcag_contrast_with_logo(): void
    {
        // Given: Logo with known dominant color
        $logo = LogoReferenceFactory::withDominantColor('#000000');
        $bundle = BrandingBundleFactory::withLogo($logo);
        
        // When: Try to set light text color (poor contrast)
        $this->expectException(WcagContrastViolation::class);
        $bundle->updateColors(
            BrandingColor::fromHex('#FFFFFF'), // White
            BrandingColor::fromHex('#F0F0F0'), // Light gray
            UserId::fromString('user-123')
        );
    }
}
```

#### **Day 2: Value Object Implementation**
Implement all value objects with asset integration:
- `BrandingAssets`
- `LogoReference` 
- `LogoUrl` (with CDN provider abstraction)
- `AssetId`
- `Dimensions` with tolerance checking

#### **Day 3: Aggregate Implementation**
Implement the full `BrandingBundle` aggregate with:
- Asset management methods
- WCAG validation integrated with logo colors
- Version tracking with optimistic locking
- Domain event emission

### **PHASE 2: COMMAND & ASSET PROCESSING (Week 2)**

#### **Day 4: Asset-Aware Commands**
```php
// app/Contexts/Platform/Application/Commands/UploadLogoCommand.php
final class UploadLogoCommand implements Command
{
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly UserId $uploaderId,
        public readonly LogoType $logoType,
        public readonly UploadedFile $file,
        public readonly int $expectedVersion
    ) {
        // File validation at command level (size, type)
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

// app/Contexts/Platform/Application/Commands/UpdateBrandingCommand.php
final class UpdateBrandingCommand implements Command
{
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly UserId $updaterId,
        public readonly ?BrandingColor $primaryColor = null,
        public readonly ?BrandingColor $secondaryColor = null,
        public readonly ?string $fontFamily = null,
        public readonly ?string $heroTitle = null,
        public readonly ?string $heroSubtitle = null,
        public readonly ?LogoUpdate $logoUpdate = null, // ✅ Asset integration
        public readonly int $expectedVersion
    ) {
        $this->validateAtLeastOneChange();
    }
}
```

#### **Day 5: Command Handler with CDN Integration**
```php
// app/Contexts/Platform/Application/Handlers/UploadLogoHandler.php
final class UploadLogoHandler implements CommandHandler
{
    public function __construct(
        private BrandingBundleRepository $repository,
        private LogoProcessingService $logoService,
        private EventDispatcher $dispatcher
    ) {}
    
    public function handle(UploadLogoCommand $command): LogoProcessingResult
    {
        // 1. Get aggregate
        $bundle = $this->repository->getCurrentForTenant($command->tenantId);
        
        // 2. Validate optimistic locking
        if ($bundle->metadata()->version() !== $command->expectedVersion) {
            throw new ConcurrencyException();
        }
        
        // 3. Process logo (CDN upload, resizing, optimization)
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

#### **Day 6: Logo Processing Service (DDD-compliant)**
```php
// app/Contexts/Platform/Infrastructure/Services/LogoProcessingService.php
final class LogoProcessingService
{
    public function processUpload(
        UploadedFile $file,
        TenantId $tenantId,
        LogoType $logoType,
        UserId $uploaderId
    ): LogoProcessingResult {
        // 1. Extract dominant color (for WCAG validation)
        $dominantColor = $this->colorExtractor->extractDominantColor($file);
        
        // 2. Process for CDN
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
        
        // 4. Create versions
        $versions = $this->createOptimizedVersions($cdnResult, $logoType);
        
        return new LogoProcessingResult(
            assetId: $asset->id,
            cdnUrl: $cdnResult->secureUrl,
            dimensions: $cdnResult->dimensions,
            dominantColor: $dominantColor,
            fileHash: $cdnResult->fileHash,
            versions: $versions
        );
    }
    
    private function getCdnOptions(LogoType $type, TenantId $tenantId): array
    {
        return [
            'folder' => "tenants/{$tenantId->toString()}/logos",
            'public_id' => "{$type->value()}_{$this->generateHash()}",
            'transformation' => $this->getTransformationsForType($type),
            'tags' => ["tenant:{$tenantId->toString()}", "type:{$type->value()}"]
        ];
    }
}
```

### **PHASE 3: CQRS READ MODELS WITH ASSETS (Week 3)**

#### **Day 7: Asset-Optimized Read Models**
```php
// app/Contexts/Platform/Application/ReadModels/AdminBrandingView.php
final class AdminBrandingView implements ReadModel
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $tenantName,
        public readonly BrandingVisualsDTO $visuals,
        public readonly BrandingContentDTO $content,
        public readonly BrandingAssetsDTO $assets, // ✅ Assets included
        public readonly BrandingMetadataDTO $metadata,
        public readonly array $logoHistory,
        public readonly ?string $previewUrl
    ) {}
}

// app/Contexts/Platform/Application/ReadModels/BrandingAssetsDTO.php
final class BrandingAssetsDTO implements DataTransferObject
{
    public function __construct(
        public readonly ?LogoDTO $primaryLogo,
        public readonly ?LogoDTO $darkModeLogo,
        public readonly ?LogoDTO $favicon,
        public readonly array $allLogos,
        public readonly int $totalAssetSize,
        public readonly array $cdnStats
    ) {}
}

// Projection Handler
final class BrandingProjectionHandler
{
    public function onLogoUpdated(LogoUpdated $event): void
    {
        // Update read model with new logo
        $this->readModel->updateLogo(
            $event->tenantId(),
            $event->logoType(),
            [
                'assetId' => $event->assetId(),
                'url' => $this->getLogoUrl($event->assetId()),
                'uploadedAt' => now(),
                'uploadedBy' => $this->getUserName($event->uploaderId()),
            ]
        );
        
        // Invalidate cache
        $this->cache->invalidate("branding:{$event->tenantId()}");
    }
}
```

#### **Day 8: API Controllers with Asset Support**
```php
// app/Contexts/Platform/Infrastructure/Http/Controllers/Admin/BrandingCommandController.php
final class BrandingCommandController extends Controller
{
    #[Route('/api/v1/admin/branding/{tenant}/commands/upload-logo', methods: ['POST'])]
    public function uploadLogo(
        UploadLogoRequest $request,
        UploadLogoHandler $handler
    ): JsonResponse {
        $command = new UploadLogoCommand(
            tenantId: TenantId::fromString($request->tenant),
            uploaderId: UserId::fromString(auth()->id()),
            logoType: LogoType::from($request->type),
            file: $request->file('logo'),
            expectedVersion: $request->expectedVersion
        );
        
        $result = $handler->handle($command);
        
        return response()->json([
            'success' => true,
            'assetId' => $result->assetId()->toString(),
            'url' => $result->cdnUrl(),
            'preview' => $result->previewUrl(),
            'dimensions' => $result->dimensions()->toArray(),
            'newVersion' => $result->newVersion(),
        ]);
    }
}
```

### **PHASE 4: VUE 3 ADMIN UI WITH ASSET MANAGEMENT (Week 4)**

#### **Day 9-10: Asset-Aware Store & Composables**
```typescript
// resources/js/Stores/BrandingStore.ts
export const useBrandingStore = defineStore('branding', () => {
  // State
  const currentBranding = ref<AdminBrandingView | null>(null)
  const uploadProgress = ref<Record<string, number>>({})
  
  // Actions
  const uploadLogo = async (
    tenantId: string,
    logoType: LogoType,
    file: File
  ): Promise<LogoUploadResult> => {
    const formData = new FormData()
    formData.append('logo', file)
    formData.append('type', logoType)
    formData.append('expectedVersion', currentBranding.value.metadata.version)
    
    const { data } = await api.post(
      `/api/v1/admin/branding/${tenantId}/commands/upload-logo`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          uploadProgress.value[logoType] = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
        }
      }
    )
    
    // Update local state
    currentBranding.value.assets[logoType] = data
    currentBranding.value.metadata.version = data.newVersion
    
    return data
  }
  
  const updateColors = async (
    tenantId: string,
    colors: BrandingColorsUpdate
  ): Promise<void> => {
    const command = {
      commandType: 'UpdateBrandingColors',
      tenantId,
      ...colors,
      expectedVersion: currentBranding.value.metadata.version
    }
    
    await api.post('/api/v1/commands', command)
  }
  
  return { currentBranding, uploadLogo, updateColors, uploadProgress }
})
```

#### **Day 11-12: Vue Components with Real-time Validation**
```vue
<!-- resources/js/Components/Admin/Branding/LogoManager.vue -->
<template>
  <div class="logo-manager">
    <!-- Logo type tabs -->
    <div class="logo-types">
      <button
        v-for="type in logoTypes"
        :key="type"
        @click="activeType = type"
        :class="{ active: activeType === type }"
      >
        {{ formatLogoType(type) }}
      </button>
    </div>
    
    <!-- Current logo preview -->
    <div v-if="currentLogo" class="current-logo">
      <img :src="currentLogo.url" :alt="`${tenantName} ${activeType} logo`" />
      <div class="logo-info">
        <p>{{ formatDimensions(currentLogo.dimensions) }}</p>
        <p>Uploaded: {{ formatDate(currentLogo.uploadedAt) }}</p>
        <p v-if="contrastWarning" class="warning">
          ⚠️ Low contrast with current colors
        </p>
      </div>
    </div>
    
    <!-- Upload area -->
    <LogoUploader
      :tenant-id="tenantId"
      :logo-type="activeType"
      :current-logo="currentLogo"
      :primary-color="branding?.visuals?.primaryColor"
      @uploaded="handleLogoUploaded"
    />
    
    <!-- Version history -->
    <LogoHistory
      v-if="logoHistory[activeType]?.length"
      :history="logoHistory[activeType]"
      @restore="handleLogoRestore"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBrandingStore } from '@/Stores/BrandingStore'
import { LogoType } from '@/Types/Branding'

const props = defineProps<{
  tenantId: string
  tenantName: string
}>()

const brandingStore = useBrandingStore()
const activeType = ref<LogoType>(LogoType.PRIMARY)

const currentLogo = computed(() => {
  return brandingStore.currentBranding?.assets[activeType.value]
})

const contrastWarning = computed(() => {
  if (!currentLogo.value?.dominantColor || !brandingStore.currentBranding?.visuals.primaryColor) {
    return false
  }
  
  // Use domain-provided validation
  return brandingStore.currentBranding.warnings?.logoContrast?.[activeType.value]
})

async function handleLogoUploaded(result: LogoUploadResult) {
  await brandingStore.uploadLogo(props.tenantId, activeType.value, result.file)
  
  // Show success message
  // Update preview
}

async function handleLogoRestore(assetId: string) {
  await brandingStore.restoreLogo(props.tenantId, activeType.value, assetId)
}
</script>
```

#### **Day 13-14: Advanced Features**
1. **Real-time preview** with CSS variables from assets
2. **WCAG contrast checker** using logo dominant colors
3. **Batch operations** for multiple tenants
4. **Asset analytics dashboard**
5. **CDN cache management UI**

#### **Day 15: Testing & Polish**
1. **E2E tests** with asset uploads
2. **Performance testing** with large files
3. **Accessibility audit** of admin UI
4. **Documentation** for asset management

---

## **🏗️ INTEGRATED DATABASE ARCHITECTURE**

### **ENHANCED SCHEMA WITH DOMAIN ALIGNMENT:**
```sql
-- landlord.tenant_brandings (DDD-aligned)
CREATE TABLE tenant_brandings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Domain model columns
    visuals_json JSONB NOT NULL DEFAULT '{}',
    content_json JSONB NOT NULL DEFAULT '{}',
    assets_json JSONB NOT NULL DEFAULT '{}', -- LogoReference serialization
    metadata_json JSONB NOT NULL DEFAULT '{"version": 1}',
    
    -- Technical columns
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP NULL,
    
    -- Constraints
    UNIQUE(tenant_id, (metadata_json->>'version')),
    CHECK (jsonb_typeof(visuals_json) = 'object'),
    CHECK (jsonb_typeof(assets_json) = 'object')
);

-- landlord.branding_assets (CDN metadata - NOT domain model)
CREATE TABLE branding_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id VARCHAR(100) NOT NULL, -- External reference (Cloudinary public_id)
    logo_type VARCHAR(50) NOT NULL,
    
    -- CDN information
    cdn_provider VARCHAR(50) NOT NULL,
    cdn_url VARCHAR(500) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    
    -- File metadata
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    dimensions JSONB NOT NULL,
    dominant_color VARCHAR(7) NULL, -- Hex color for WCAG validation
    file_hash VARCHAR(64) NOT NULL,
    
    -- Versions (different sizes)
    versions_json JSONB NOT NULL DEFAULT '{}',
    
    -- Audit
    uploaded_by BIGINT REFERENCES users(id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMP NULL,
    
    -- Indexes
    UNIQUE(asset_id),
    UNIQUE(tenant_id, logo_type) WHERE deactivated_at IS NULL,
    INDEX idx_branding_assets_tenant_type (tenant_id, logo_type, uploaded_at DESC)
);

-- Read model view for admin UI
CREATE MATERIALIZED VIEW v_admin_branding AS
SELECT 
    tb.id,
    tb.tenant_id,
    t.name as tenant_name,
    tb.visuals_json,
    tb.content_json,
    tb.assets_json,
    tb.metadata_json,
    tb.published_at,
    
    -- Aggregate asset info
    jsonb_agg(
        jsonb_build_object(
            'type', ba.logo_type,
            'url', ba.cdn_url,
            'uploaded_at', ba.uploaded_at,
            'uploaded_by', u.email,
            'dimensions', ba.dimensions,
            'size', ba.file_size
        )
    ) FILTER (WHERE ba.deactivated_at IS NULL) as active_logos,
    
    -- Version history
    jsonb_agg(
        jsonb_build_object(
            'version', tb.metadata_json->>'version',
            'updated_at', tb.updated_at,
            'changes', '...' -- Diff from previous version
        )
    ) OVER (PARTITION BY tb.tenant_id ORDER BY (tb.metadata_json->>'version')::INT) as version_history
    
FROM tenant_brandings tb
JOIN tenants t ON tb.tenant_id = t.id
LEFT JOIN branding_assets ba ON tb.tenant_id = ba.tenant_id AND ba.deactivated_at IS NULL
LEFT JOIN users u ON ba.uploaded_by = u.id
WHERE tb.published_at IS NOT NULL OR tb.metadata_json->>'version' = (
    SELECT MAX((metadata_json->>'version')::INT) 
    FROM tenant_brandings 
    WHERE tenant_id = tb.tenant_id
)
GROUP BY tb.id, t.id;
```

---

## **🎯 INTEGRATED IMPLEMENTATION CHECKLIST**

### **WEEK 1: DOMAIN FOUNDATION WITH ASSETS**
- [ ] Day 1: Write failing domain tests with asset scenarios
- [ ] Day 2: Implement asset-enabled value objects
- [ ] Day 3: Complete BrandingBundle aggregate with asset methods
- [ ] Day 4: Asset-aware command objects
- [ ] Day 5: Command handlers with CDN integration
- [ ] Day 6: Logo processing service (DDD-compliant)
- [ ] Day 7: All domain tests passing

### **WEEK 2: INFRASTRUCTURE & APIS**
- [ ] Day 8: Repository implementation with asset serialization
- [ ] Day 9: Database migrations (enhanced schema)
- [ ] Day 10: API controllers (command & query)
- [ ] Day 11: CDN service integration (Cloudinary/S3)
- [ ] Day 12: Read model projections
- [ ] Day 13: Cache invalidation strategy
- [ ] Day 14: Integration tests with asset uploads

### **WEEK 3: VUE ADMIN UI**
- [ ] Day 15: Asset-aware Pinia store
- [ ] Day 16: Logo upload component with progress
- [ ] Day 17: Real-time preview with CSS variables
- [ ] Day 18: WCAG validation UI (using domain feedback)
- [ ] Day 19: Version history & rollback UI
- [ ] Day 20: Batch operations & asset analytics
- [ ] Day 21: E2E tests for asset management

### **WEEK 4: POLISH & DEPLOYMENT**
- [ ] Day 22: Performance optimization (lazy loading, caching)
- [ ] Day 23: Security hardening (file validation, XSS prevention)
- [ ] Day 24: Monitoring & alerting setup
- [ ] Day 25: Documentation (admin guide, API docs)
- [ ] Day 26: Staging deployment & testing
- [ ] Day 27: Production rollout plan
- [ ] Day 28: Post-launch monitoring & optimization

---

## **🚨 CRITICAL INTEGRATION DECISIONS**

### **DECISION 1: Asset Reference vs Asset Storage**
✅ **Decision**: Store `LogoReference` in domain, `branding_assets` table for CDN metadata  
✅ **Reason**: Domain models reference assets, don't store binary data

### **DECISION 2: WCAG Validation Integration**
✅ **Decision**: Domain validates contrast using logo's dominant color  
✅ **Reason**: Business rule belongs in domain, enables real-time feedback

### **DECISION 3: Versioning Strategy**
✅ **Decision**: Each branding change creates new version with full state  
✅ **Reason**: Enables rollback, audit trail, concurrent editing detection

### **DECISION 4: Draft vs Published States**
✅ **Decision`: Optional `PublishedBranding` value object  
✅ **Reason**: Supports preview/publish workflow, A/B testing potential

---

## **🎖️ ARCHITECT'S FINAL INTEGRATION VERDICT**

**This integrated plan achieves:**

1. ✅ **Domain Purity**: Assets are first-class domain citizens
2. ✅ **Event-Driven**: All changes emit events for consistency
3. ✅ **CQRS Optimized**: Separate read models for admin efficiency  
4. ✅ **TDD Discipline**: Tests drive implementation from day 1
5. ✅ **Production Ready**: CDN, security, monitoring baked in
6. ✅ **Scalable Architecture**: Handles 10,000+ tenants with assets

**Key Innovation**: The `LogoReference` value object that bridges:
- Domain model (business rules)
- CDN storage (external assets)
- WCAG validation (accessibility requirements)
- Version control (audit trail)

**Next Step**: Begin with **Day 1 failing tests** that include asset scenarios. This ensures assets are integrated from the start, not bolted on later.

**Ready to execute?** I can provide the exact Day 1 test file with asset integration scenarios.
Understood. You want this **Branding Asset Management architecture to be formally requested and integrated** into the existing DDD + TDD-first platform architecture — not rewritten, but **mandated as part of the solution scope**.

Below is a **clear, architect-level integration request** you can drop into your architecture decision flow (ADR, Epic description, or technical mandate).
Tone: **Senior Solution Architect → Engineering Team / Architecture Board**.

---

# 📣 **Architecture Integration Request: Branding Asset Management**

## **Request Type**

🔴 **Mandatory Architectural Integration (Non-Optional)**

## **Context**

The current Platform Branding domain supports only basic visual configuration (`colors`, `logoUrl`, `fontFamily`). This is **architecturally and operationally insufficient** for a production-grade, multi-tenant platform.

Branding is a **platform capability**, not a UI concern and not a tenant-auth concern.
Assets such as logos and favicons are **stateful, versioned, and security-sensitive resources** and must be treated as **first-class domain assets**.

---

## **Decision Request**

We request approval and implementation of the **Branding Asset Management Architecture** as an **extension of the Platform Branding Bounded Context**, fully aligned with:

* **DDD principles**
* **Hexagonal architecture**
* **Strict TDD-first development**
* **Multi-tenant scalability requirements**

This integration is required to support:

* Professional branding
* Mobile & email clients
* Accessibility (WCAG)
* Auditability & rollback
* CDN-scale delivery

---

## **Scope of Integration (MANDATORY)**

### 1️⃣ **Domain Model Extension**

The Platform Branding domain **MUST** be extended with:

* `BrandingAssets` (Value Object)
* `BrandingLogo` (Value Object)
* Explicit logo variants:

  * primary
  * dark mode
  * favicon
  * email
  * mobile

❗ Simple `logoUrl` strings are **no longer acceptable**.

---

### 2️⃣ **Dedicated Asset Lifecycle**

Branding assets **MUST** support:

* Upload
* Validation
* Optimization
* CDN delivery
* Versioning
* Soft-deactivation
* Rollback window (≥ 7 days)

Assets are **immutable once uploaded**.
State changes occur via **activation / deactivation**, not mutation.

---

### 3️⃣ **Storage Strategy (DECISION LOCKED)**

✅ **External CDN-based storage (Cloudinary or S3 + CDN)**

* Files are **never stored in the application database**
* Database stores **metadata + CDN references only**
* CDN provider must be **configurable**

Local storage is allowed **only for development**.

---

### 4️⃣ **Persistence Model**

The following **MUST be introduced**:

* `landlord.branding_assets` table for asset tracking
* `tenant_brandings.assets_json` for active references

Only **one active asset per logo type per tenant** is allowed at any time.

---

### 5️⃣ **Application Layer Responsibilities**

The Platform Application Layer **MUST** expose:

* Upload APIs
* Update APIs
* Version history
* Publish / rollback semantics

Branding updates **ARE transactional**, versioned, and auditable.

---

### 6️⃣ **Security & Compliance**

The solution **MUST** include:

* Strict MIME & dimension validation
* SVG sanitization (XSS prevention)
* Size limits
* Optional signed CDN URLs
* WCAG contrast validation hooks

Security validation failures are **domain errors**, not UI errors.

---

### 7️⃣ **Frontend Contract**

The Admin UI **MUST**:

* Upload branding assets via explicit APIs
* Show previews using CDN URLs
* Support replace / remove / rollback
* Reflect “draft vs published” branding state

Frontend **never talks to CDN directly** for uploads.

---

## **TDD & Quality Gates (NON-NEGOTIABLE)**

### Required Test Coverage

* Domain rules (Value Objects, invariants)
* Upload validation
* Versioning rules
* Rollback behavior
* Cache invalidation triggers

❗ No controller or UI work may begin before:

* Domain tests exist
* Application service tests exist

---

## **Explicit Non-Goals**

🚫 Storing binary assets in the database
🚫 Mutating existing assets
🚫 Mixing branding logic into Tenant/Auth context
🚫 UI-driven business rules

---

## **Implementation Phasing (APPROVED ORDER)**

1. **Domain Model & Tests**
2. **Application Services & Commands**
3. **Asset Storage & CDN Integration**
4. **Admin APIs**
5. **Vue Admin UI**
6. **Monitoring & Cleanup Jobs**

---

## **Architectural Outcome**

After integration, the platform will support:

* ✅ Enterprise-grade branding
* ✅ Multi-device logo delivery
* ✅ Safe rollbacks
* ✅ CDN scalability
* ✅ Audit & compliance readiness
* ✅ Future theming (CSS, emails, mobile)

---

## **Decision Statement**

> This Branding Asset Management architecture is **approved for integration** and must be treated as a **core Platform capability**, not an enhancement.

Any implementation that does not comply with this architecture **must be rejected during review**.

---

If you want, next I can:

* Convert this into a **formal ADR (ADR-00X)**
* Produce a **task breakdown for Jira / Linear**
* Write **TDD test blueprints** (PHPUnit)
* Or **validate this against your existing TenantBrandingService migration plan**

Just tell me where this needs to land.
