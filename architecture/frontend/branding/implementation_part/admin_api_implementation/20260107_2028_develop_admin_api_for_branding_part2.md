# 🎨 **BRANDING ASSET MANAGEMENT - COMPREHENSIVE ARCHITECTURE**

## **🔍 CRITICAL REALITY CHECK**

**Current State Analysis**: Our domain model (`BrandingVisuals`) only has `primaryColor`, `secondaryColor`, `logoUrl`, `fontFamily`. This is **insufficient** for a production branding system.

**Missing Critical Features**:
1. **Logo asset storage** (upload, resize, CDN delivery)
2. **Favicon support** 
3. **Multiple logo variants** (light/dark, horizontal/vertical)
4. **Asset versioning** (when branding updates, what happens to old logos?)
5. **Storage optimization** (different sizes for different devices)

---

## **🏗️ ARCHITECTURAL DECISIONS REQUIRED**

### **OPTION 1: EXTERNAL CDN APPROACH (RECOMMENDED)**

```
Upload → Laravel → S3/Cloud Storage → CDN → URL in DB
```

**Pros**:
- Scalable (handles 10,000+ tenants)
- Cost-effective (pay for storage/bandwidth used)
- Professional (CDN for global delivery)
- Decoupled (storage independent of application)

**Cons**:
- External dependency
- More complex implementation

### **OPTION 2: INTERNAL STORAGE**

```
Upload → Laravel → Local/Storage → URL in DB
```

**Pros**:
- Simple
- No external dependencies
- Full control

**Cons**:
- Doesn't scale
- Single point of failure
- Bandwidth costs on your server

### **OPTION 3: HYBRID APPROACH**

- Small assets (favicons) → Internal
- Large assets (logos) → CDN

---

## **📁 PROPOSED ARCHITECTURE**

### **DOMAIN MODEL ENHANCEMENT:**

```php
// app/Contexts/Platform/Domain/ValueObjects/BrandingAssets.php
final class BrandingAssets implements ValueObject
{
    public function __construct(
        private BrandingLogo $primaryLogo,
        private ?BrandingLogo $darkModeLogo = null,
        private ?BrandingLogo $favicon = null,
        private ?BrandingLogo $emailLogo = null,
        private ?BrandingLogo $mobileLogo = null
    ) {
        $this->validateAssetRelationships();
    }
}

// app/Contexts/Platform/Domain/ValueObjects/BrandingLogo.php
final class BrandingLogo implements ValueObject
{
    public function __construct(
        private LogoId $id,
        private LogoUrl $url,
        private LogoDimensions $dimensions,
        private LogoFormat $format,
        private FileSize $size,
        private ?LogoVariant $variant = null
    ) {}
}

// app/Contexts/Platform/Domain/ValueObjects/LogoUrl.php
final class LogoUrl implements ValueObject
{
    public function __construct(
        private string $path, // "tenants/nrna/logos/primary-light-20240107.png"
        private CdnProvider $cdnProvider = CdnProvider::CLOUDFLARE
    ) {
        $this->validateUrl();
    }
    
    public function getFullUrl(): string
    {
        return $this->cdnProvider->buildUrl($this->path);
    }
    
    public function getOptimizedUrl(string $size = 'original'): string
    {
        return $this->cdnProvider->buildOptimizedUrl($this->path, $size);
    }
}
```

### **DATABASE SCHEMA:**

```sql
-- landlord.tenant_brandings (existing)
ALTER TABLE tenant_brandings 
ADD COLUMN assets_json JSONB DEFAULT '{}';

-- NEW: landlord.branding_assets (for asset tracking)
CREATE TABLE branding_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    logo_id VARCHAR(50) NOT NULL, -- "primary", "dark", "favicon", "email"
    storage_path VARCHAR(500) NOT NULL, -- "tenants/{tenant}/logos/{logo_id}-{timestamp}.{ext}"
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    dimensions JSONB, -- {"width": 800, "height": 400}
    cdn_url VARCHAR(500) NOT NULL,
    cdn_provider VARCHAR(50) DEFAULT 'cloudinary',
    versions JSONB DEFAULT '{}', -- Different sizes: {"large": "...", "medium": "...", "small": "..."}
    uploaded_by BIGINT REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(tenant_id, logo_id, is_active) -- Only one active logo per type
);

-- Indexes
CREATE INDEX idx_branding_assets_tenant ON branding_assets(tenant_id);
CREATE INDEX idx_branding_assets_active ON branding_assets(tenant_id, is_active) WHERE is_active = true;
```

### **UPLOAD FLOW:**

```
1. Admin uploads logo (Vue component)
2. Frontend validates (size, dimensions, type)
3. POST /api/v1/admin/branding/{tenantId}/upload-logo
4. Laravel processes (resize, optimize)
5. Upload to Cloudinary/S3
6. Store metadata in landlord.branding_assets
7. Update tenant_brandings.assets_json
8. Return CDN URLs to frontend
9. Frontend shows preview
```

---

## **🔧 IMPLEMENTATION DETAILS**

### **API ENDPOINTS:**

```bash
# Logo Management
POST   /api/v1/admin/branding/{tenantId}/logos          # Upload new logo
PUT    /api/v1/admin/branding/{tenantId}/logos/{type}   # Update specific logo  
DELETE /api/v1/admin/branding/{tenantId}/logos/{type}   # Remove logo
GET    /api/v1/admin/branding/{tenantId}/logos          # List all logos
GET    /api/v1/admin/branding/{tenantId}/logos/history  # Version history

# Branding Configuration
PUT    /api/v1/admin/branding/{tenantId}/config         # Update colors, text, etc.
POST   /api/v1/admin/branding/{tenantId}/preview        # Generate preview
POST   /api/v1/admin/branding/{tenantId}/publish        # Publish changes
POST   /api/v1/admin/branding/{tenantId}/reset          # Reset to defaults
```

### **LOGO PROCESSING SERVICE:**

```php
// app/Services/Branding/LogoProcessingService.php
class LogoProcessingService
{
    public function processUpload(
        UploadedFile $file, 
        TenantId $tenantId, 
        LogoType $type,
        UserId $uploader
    ): LogoProcessingResult {
        // 1. Validate
        $this->validator->validate($file, $type);
        
        // 2. Process image
        $processed = $this->imageProcessor->process(
            $file,
            $this->getDimensionsForType($type),
            $this->getFormatsForType($type)
        );
        
        // 3. Generate storage path
        $path = $this->generateStoragePath(
            tenantId: $tenantId,
            type: $type,
            originalName: $file->getClientOriginalName(),
            hash: $processed->getHash()
        );
        
        // 4. Upload to CDN
        $cdnResult = $this->cdnService->upload(
            path: $path,
            contents: $processed->getContents(),
            options: [
                'public_id' => $this->generatePublicId($tenantId, $type),
                'folder' => "tenants/{$tenantId}/logos",
                'transformation' => $this->getTransformationsForType($type)
            ]
        );
        
        // 5. Create versions (different sizes)
        $versions = $this->createVersions($processed, $path);
        
        // 6. Save to database
        $asset = BrandingAsset::create([
            'tenant_id' => $tenantId->toInt(),
            'logo_id' => $type->value(),
            'storage_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $processed->getMimeType(),
            'file_size' => $processed->getSize(),
            'dimensions' => $processed->getDimensions()->toArray(),
            'cdn_url' => $cdnResult->getSecureUrl(),
            'cdn_provider' => $this->cdnService->getProviderName(),
            'versions' => $versions->toArray(),
            'uploaded_by' => $uploader->toInt(),
            'uploaded_at' => now(),
            'is_active' => false, // Not active until branding is published
        ]);
        
        return new LogoProcessingResult(
            asset: $asset,
            previewUrl: $versions->getPreviewUrl(),
            fullUrl: $cdnResult->getSecureUrl()
        );
    }
    
    private function getDimensionsForType(LogoType $type): Dimensions
    {
        return match ($type) {
            LogoType::PRIMARY => new Dimensions(800, 400),
            LogoType::DARK_MODE => new Dimensions(800, 400),
            LogoType::FAVICON => new Dimensions(64, 64),
            LogoType::EMAIL => new Dimensions(600, 200),
            LogoType::MOBILE => new Dimensions(400, 200),
        };
    }
}
```

### **CDN STRATEGY (CLOUDINARY EXAMPLE):**

```php
// config/branding.php
'cdn' => [
    'default' => 'cloudinary',
    'providers' => [
        'cloudinary' => [
            'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
            'api_key' => env('CLOUDINARY_API_KEY'),
            'api_secret' => env('CLOUDINARY_API_SECRET'),
            'secure' => true,
            'folder' => 'public-digit/tenants',
            'transformations' => [
                'logo_primary' => [
                    'width' => 800,
                    'height' => 400,
                    'crop' => 'limit',
                    'quality' => 'auto:good',
                    'format' => 'png'
                ],
                'favicon' => [
                    'width' => 64,
                    'height' => 64,
                    'crop' => 'fill',
                    'quality' => 'best',
                    'format' => 'ico'
                ]
            ]
        ],
        's3' => [
            'bucket' => env('AWS_BRANDING_BUCKET'),
            'region' => env('AWS_DEFAULT_REGION'),
            'cdn_url' => env('AWS_CDN_URL'),
            'folder' => 'tenants'
        ]
    ]
]
```

### **DOMAIN COMMAND FOR UPDATING BRANDING:**

```php
// app/Contexts/Platform/Application/Commands/UpdateBrandingCommand.php
final class UpdateBrandingCommand implements Command
{
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly UserId $updaterId,
        public readonly ?BrandingColor $primaryColor = null,
        public readonly ?BrandingColor $secondaryColor = null,
        public readonly ?BrandingColor $backgroundColor = null,
        public readonly ?BrandingColor $textColor = null,
        public readonly ?string $fontFamily = null,
        public readonly ?string $heroTitle = null,
        public readonly ?string $heroSubtitle = null,
        public readonly ?string $welcomeMessage = null,
        public readonly ?LogoUpdate $logoUpdate = null,
        public readonly ?LogoUpdate $faviconUpdate = null,
        public readonly int $expectedVersion
    ) {
        $this->validateAtLeastOneChange();
    }
}

// Value Object for logo updates
final class LogoUpdate implements ValueObject
{
    public function __construct(
        public readonly LogoType $type,
        public readonly ?UploadedFile $file = null,
        public readonly ?string $externalUrl = null,
        public readonly bool $remove = false
    ) {
        $this->validate();
    }
}
```

### **VUE 3 UPLOAD COMPONENT:**

```vue
<!-- resources/js/Components/Admin/Branding/LogoUploader.vue -->
<template>
  <div class="logo-uploader">
    <div v-if="!logoUrl" class="upload-area" @dragover.prevent @drop="handleDrop">
      <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*" />
      <div class="upload-prompt">
        <UploadIcon class="icon" />
        <p>Drag & drop or click to upload {{ logoType }} logo</p>
        <p class="requirements">PNG, JPG, SVG • Max 2MB • {{ dimensions }}</p>
      </div>
    </div>
    
    <div v-else class="logo-preview">
      <img :src="previewUrl" :alt="`${tenantSlug} ${logoType} logo`" />
      <div class="logo-actions">
        <button @click="replaceLogo">Replace</button>
        <button @click="removeLogo" class="danger">Remove</button>
        <button @click="openOptimizer">Optimize</button>
      </div>
      <div class="logo-info">
        <span>{{ fileName }}</span>
        <span>{{ fileSize }}</span>
        <span v-if="dimensionsInfo">{{ dimensionsInfo }}</span>
        <a :href="logoUrl" target="_blank" class="view-full">View Full</a>
      </div>
    </div>
    
    <WcagContrastChecker 
      v-if="logoUrl && primaryColor" 
      :logo="logoUrl" 
      :backgroundColor="backgroundColor" 
    />
    
    <ProgressBar v-if="uploading" :progress="uploadProgress" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useBrandingStore } from '@/Stores/brandingStore';
import { useLogoUpload } from '@/Composables/useLogoUpload';

const props = defineProps({
  tenantId: { type: String, required: true },
  logoType: { type: String, required: true }, // 'primary', 'dark', 'favicon'
  currentLogoUrl: String,
  primaryColor: String,
  backgroundColor: String
});

const brandingStore = useBrandingStore();
const { uploadLogo, uploading, uploadProgress } = useLogoUpload();

const fileInput = ref(null);
const selectedFile = ref(null);

const dimensions = computed(() => {
  const sizes = {
    primary: '800×400px',
    dark: '800×400px', 
    favicon: '64×64px',
    email: '600×200px',
    mobile: '400×200px'
  };
  return sizes[props.logoType] || '800×400px';
});

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  await uploadLogo({
    tenantId: props.tenantId,
    logoType: props.logoType,
    file,
    onSuccess: (result) => {
      brandingStore.updateLogo(props.tenantId, props.logoType, result);
    },
    onError: (error) => {
      showError(`Failed to upload logo: ${error.message}`);
    }
  });
}

function handleDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    selectedFile.value = file;
    handleFileSelect({ target: { files: [file] } });
  }
}
</script>
```

---

## **📦 ASSET STORAGE STRATEGY**

### **STORAGE PATH PATTERN:**

```
Cloudinary: public-digit/tenants/{tenant_slug}/logos/{type}-{hash}.{ext}
Example: public-digit/tenants/nrna/logos/primary-abc123.png

S3: tenants/{tenant_id}/logos/{type}/{timestamp}-{hash}.{ext}
Example: tenants/123/logos/primary/20240107-abc123.png
```

### **VERSIONING STRATEGY:**

```php
// When updating logo, don't delete old one immediately
// Keep for:
// 1. Rollback capability (7 days)
// 2. Audit trail
// 3. CDN cache invalidation grace period

// Soft delete with cleanup job
$oldLogo->update(['is_active' => false, 'deactivated_at' => now()]);

// Cleanup job runs daily
$expiredLogos = BrandingAsset::where('is_active', false)
    ->where('deactivated_at', '<', now()->subDays(7))
    ->get();

foreach ($expiredLogos as $logo) {
    $this->cdnService->delete($logo->storage_path);
    $logo->delete();
}
```

### **CACHE INVALIDATION:**

```php
// When logo updates, bust cache
class BrandingUpdatedHandler
{
    public function handle(BrandingUpdated $event): void
    {
        // Invalidate caches
        Cache::tags(["branding:{$event->tenantId}"])->flush();
        
        // Purge CDN cache for this tenant's assets
        $this->cdnService->purge([
            "tenants/{$event->tenantId}/logos/*",
            "tenants/{$event->tenantId}/css/*"
        ]);
        
        // Notify mobile apps via WebSocket/Push
        $this->notificationService->notifyBrandingChange(
            $event->tenantId,
            $event->version
        );
    }
}
```

---

## **🔐 SECURITY CONSIDERATIONS**

### **FILE UPLOAD SECURITY:**

```php
class LogoUploadValidator
{
    private array $allowedMimeTypes = [
        'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'
    ];
    
    private array $maxDimensions = [
        'primary' => [2000, 1000],
        'favicon' => [256, 256]
    ];
    
    private int $maxFileSize = 2 * 1024 * 1024; // 2MB
    
    public function validate(UploadedFile $file, LogoType $type): void
    {
        // 1. Basic Laravel validation
        $file->validate([
            'image',
            'mimes:png,jpg,jpeg,svg,webp',
            'max:' . $this->maxFileSize,
        ]);
        
        // 2. MIME type validation
        if (!in_array($file->getMimeType(), $this->allowedMimeTypes)) {
            throw new InvalidLogoException("Invalid file type");
        }
        
        // 3. SVG specific validation (prevent XSS)
        if ($file->getMimeType() === 'image/svg+xml') {
            $this->validateSvg($file->get());
        }
        
        // 4. Dimension validation
        [$width, $height] = getimagesize($file->getPathname());
        [$maxWidth, $maxHeight] = $this->maxDimensions[$type->value()] ?? [2000, 2000];
        
        if ($width > $maxWidth || $height > $maxHeight) {
            throw new InvalidLogoException(
                "Image dimensions too large. Max: {$maxWidth}x{$maxHeight}"
            );
        }
        
        // 5. Aspect ratio validation (for logo types)
        $this->validateAspectRatio($width, $height, $type);
    }
    
    private function validateSvg(string $content): void
    {
        // Check for malicious scripts in SVG
        if (preg_match('/<script/i', $content)) {
            throw new InvalidLogoException("SVG contains scripts");
        }
        
        // Check for external references
        if (preg_match('/xlink:href\s*=\s*["\'](?!data:image)/i', $content)) {
            throw new InvalidLogoException("SVG contains external references");
        }
    }
}
```

### **CDN SECURITY:**

```php
// Use signed URLs for non-public assets
class SecureCdnService
{
    public function getSignedUrl(
        string $path, 
        int $expiresIn = 3600
    ): string {
        return $this->cloudinary->private_download_url(
            $path,
            [
                'expires_at' => time() + $expiresIn,
                'attachment' => true // Force download
            ]
        );
    }
    
    // Or use Cloudinary's strict transformations
    public function getSecureImageUrl(string $path, array $transformations): string
    {
        return $this->cloudinary->secure_url(
            $path,
            [
                'sign_url' => true,
                'transformation' => $transformations
            ]
        );
    }
}
```

---

## **🚀 DEPLOYMENT CONSIDERATIONS**

### **ENVIRONMENT CONFIGURATION:**

```env
# .env
BRANDING_STORAGE_DRIVER=cloudinary # cloudinary, s3, local
BRANDING_ASSET_CACHE_TTL=2592000 # 30 days
BRANDING_MAX_LOGO_SIZE=2097152 # 2MB
BRANDING_ALLOWED_EXTENSIONS=png,jpg,jpeg,svg,webp

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# Or S3
AWS_BRANDING_BUCKET=public-digit-assets
AWS_CDN_URL=https://assets.publicdigit.com
```

### **MIGRATION SCRIPT:**

```php
// database/migrations/landlord/2024_01_07_add_branding_assets_table.php
public function up(): void
{
    Schema::create('branding_assets', function (Blueprint $table) {
        $table->uuid('id')->primary();
        $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
        $table->string('logo_id', 50); // primary, dark, favicon, email, mobile
        $table->string('storage_path', 500);
        $table->string('original_filename', 255);
        $table->string('mime_type', 100);
        $table->bigInteger('file_size');
        $table->jsonb('dimensions')->nullable();
        $table->string('cdn_url', 500);
        $table->string('cdn_provider', 50)->default('cloudinary');
        $table->jsonb('versions')->default('{}');
        $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
        $table->timestamp('uploaded_at')->useCurrent();
        $table->boolean('is_active')->default(true);
        $table->timestamp('deactivated_at')->nullable();
        
        $table->unique(['tenant_id', 'logo_id', 'is_active']);
        $table->index(['tenant_id', 'is_active']);
    });
    
    // Add assets_json to existing tenant_brandings
    Schema::table('tenant_brandings', function (Blueprint $table) {
        $table->jsonb('assets_json')->nullable()->after('content_json');
    });
}
```

---

## **📊 MONITORING & ANALYTICS**

### **KEY METRICS:**

```yaml
# Grafana Dashboard - Branding Assets
metrics:
  - branding_assets_total
  - branding_assets_by_type
  - branding_upload_success_rate
  - branding_upload_duration_seconds
  - branding_storage_used_bytes
  - branding_cdn_bandwidth_bytes
  - branding_asset_error_rate
```

### **ALERTING:**

```php
// Alert if:
// 1. Upload failure rate > 5%
// 2. Average upload time > 5 seconds
// 3. Storage > 80% capacity
// 4. CDN bandwidth spikes (possible abuse)
```

---

## **🎯 SUMMARY RECOMMENDATIONS**

### **IMMEDIATE ACTIONS:**

1. **Extend Domain Model** with proper `BrandingAssets` value object
2. **Choose CDN Provider** (Cloudinary recommended for image optimization)
3. **Implement Secure Upload** with validation
4. **Design Asset Versioning** strategy
5. **Plan Cache Invalidation** for logo updates

### **ARCHITECTURAL DECISIONS:**

1. **Storage**: External CDN (Cloudinary/S3) over internal storage
2. **Database**: Store metadata + CDN URLs, not files
3. **Versioning**: Keep old logos for 7 days for rollback
4. **Security**: Validate everything, sign URLs for sensitive assets
 
### **IMPLEMENTATION ORDER:**

1. Week 1: Domain model + Upload API
2. Week 2: Vue UI components
3. Week 3: CDN integration + Optimization
4. Week 4: Advanced features (multiple variants, dark mode logos)

**YES**, you can update logos, colors, welcome messages via admin API. Logos will be stored in **Cloudinary/S3 CDN** with metadata in `landlord.branding_assets` table and references in `tenant_brandings.assets_json`.

This architecture supports:
- ✅ Logo uploads with validation
- ✅ Multiple logo variants
- ✅ Automatic optimization/resizing
- ✅ CDN delivery with caching
- ✅ Version history and rollback
- ✅ Security scanning (SVG, file types)
- ✅ WCAG compliance checking