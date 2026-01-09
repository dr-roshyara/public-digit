# Day 8: Asset Upload Management - Architecture Plan

**Date**: January 9, 2026
**Phase**: Implementation Planning
**Status**: Planning → TDD

---

## Executive Summary

Day 8 implements **asset upload management** for branding logos. This enables tenant admins to upload custom logo images with automatic validation, storage, and metadata extraction.

### Key Features
- Primary logo upload (PNG, JPG, SVG)
- Asset validation (size, dimensions, format)
- Automatic dominant color extraction for WCAG validation
- File storage with organized tenant directories
- Asset removal with file cleanup
- State-aware upload (only DRAFT/PUBLISHED allowed)

---

## Architecture Overview

### Domain Model (Already Exists)

```
BrandingAssets (Value Object)
├── AssetPath (tenants/{slug}/logos/{filename})
├── AssetMetadata (dimensions, file size, MIME type, dominant color)
│   └── Dimensions (800×400 ±20% for primary logo)
├── withPrimaryLogo(path, metadata) → new BrandingAssets
└── withoutPrimaryLogo() → empty BrandingAssets

Repository Layer
├── EloquentTenantBrandingRepository
│   └── assets column (JSONB) already persisted
└── TenantBrandingRepositoryInterface
```

### New Components (Day 8)

```
Application Layer
├── Commands
│   ├── UploadPrimaryLogoCommand (tenantId, uploadedFile)
│   └── RemovePrimaryLogoCommand (tenantId)
├── Handlers
│   ├── UploadPrimaryLogoHandler
│   └── RemovePrimaryLogoHandler
└── Services
    └── AssetValidationService (validates size, dimensions, format)

Infrastructure Layer
├── Services
│   ├── AssetStorageService (store/delete files)
│   └── ImageAnalysisService (extract dimensions, dominant color)
└── Controllers
    └── BrandingAssetController
        ├── POST /api/v1/admin/branding/{tenantSlug}/assets/logo
        └── DELETE /api/v1/admin/branding/{tenantSlug}/assets/logo
```

---

## Business Rules

### Upload Rules
1. **State Validation**: Only DRAFT or PUBLISHED branding can upload assets
2. **Archived Protection**: ARCHIVED branding is read-only (no uploads)
3. **File Size**: Maximum 5MB (5,242,880 bytes)
4. **Supported Formats**:
   - PNG (image/png)
   - JPG (image/jpeg, image/jpg)
   - SVG (image/svg+xml)
5. **Dimensions**: 800×400 ±20% (640-960 pixels × 320-480 pixels)
6. **State Preservation**: Upload does NOT change branding state
7. **File Replacement**: Uploading new logo deletes old logo file

### Removal Rules
1. **State Validation**: Only DRAFT or PUBLISHED branding can remove assets
2. **ARCHIVED Protection**: ARCHIVED branding is read-only
3. **File Cleanup**: Deletes physical file from storage
4. **State Preservation**: Removal does NOT change branding state
5. **Idempotent**: Removing non-existent logo is allowed (no-op)

### Storage Rules
1. **Directory Structure**: `storage/app/public/tenants/{tenant-slug}/branding/`
2. **Filename Format**: `logo-{timestamp}.{extension}` (e.g., `logo-1736436000.png`)
3. **Public Access**: Files stored in public disk (accessible via URL)
4. **Path Format**: `tenants/{slug}/branding/logo-{timestamp}.{ext}`

---

## API Endpoints

### Upload Primary Logo

**Endpoint**: `POST /api/v1/admin/branding/{tenantSlug}/assets/logo`

**Request**:
```http
POST /api/v1/admin/branding/nrna/assets/logo HTTP/1.1
Content-Type: multipart/form-data

logo: (binary file data)
```

**Success Response (200)**:
```json
{
  "message": "Logo uploaded successfully",
  "asset": {
    "path": "tenants/nrna/branding/logo-1736436000.png",
    "metadata": {
      "dimensions": "800×400",
      "file_size": 102400,
      "file_size_formatted": "100 KB",
      "mime_type": "image/png",
      "dominant_color": "#1E3A8A"
    }
  },
  "branding_state": "draft"
}
```

**Error Responses**:
- **404**: Tenant not found
- **400**: Invalid file (size, dimensions, format)
- **403**: Branding is archived (read-only)
- **413**: File too large (>5MB)

---

### Remove Primary Logo

**Endpoint**: `DELETE /api/v1/admin/branding/{tenantSlug}/assets/logo`

**Request**:
```http
DELETE /api/v1/admin/branding/nrna/assets/logo HTTP/1.1
```

**Success Response (200)**:
```json
{
  "message": "Logo removed successfully",
  "branding_state": "draft"
}
```

**Error Responses**:
- **404**: Tenant not found
- **403**: Branding is archived (read-only)

---

## Data Flow

### Upload Flow

```
1. Controller receives multipart/form-data
   ↓
2. Create UploadPrimaryLogoCommand(tenantId, uploadedFile)
   ↓
3. UploadPrimaryLogoHandler:
   a. Load branding (findForTenant)
   b. Validate state (not ARCHIVED)
   c. Validate file (AssetValidationService)
      - Check file size (≤5MB)
      - Check MIME type (PNG, JPG, SVG)
      - Extract dimensions (ImageAnalysisService)
      - Validate dimensions (800×400 ±20%)
   d. Store file (AssetStorageService)
      - Delete old logo if exists
      - Save new file to storage
      - Generate domain path
   e. Extract metadata (ImageAnalysisService)
      - Dimensions: width × height
      - File size: bytes
      - Dominant color: hex (optional)
   f. Update branding entity
      - branding.updateAssets(assets.withPrimaryLogo(path, metadata))
   g. Save to repository (saveForTenant)
   ↓
4. Return success response
```

### Removal Flow

```
1. Controller receives DELETE request
   ↓
2. Create RemovePrimaryLogoCommand(tenantId)
   ↓
3. RemovePrimaryLogoHandler:
   a. Load branding (findForTenant)
   b. Validate state (not ARCHIVED)
   c. Check if logo exists
   d. Delete file (AssetStorageService)
   e. Update branding entity
      - branding.updateAssets(assets.withoutPrimaryLogo())
   f. Save to repository (saveForTenant)
   ↓
4. Return success response
```

---

## Implementation Components

### 1. Commands (Application Layer)

#### UploadPrimaryLogoCommand
```php
final class UploadPrimaryLogoCommand
{
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly UploadedFile $file
    ) {}
}
```

#### RemovePrimaryLogoCommand
```php
final class RemovePrimaryLogoCommand
{
    public function __construct(
        public readonly TenantId $tenantId
    ) {}
}
```

### 2. Handlers (Application Layer)

#### UploadPrimaryLogoHandler
```php
final class UploadPrimaryLogoHandler
{
    public function __construct(
        private readonly TenantBrandingRepositoryInterface $repository,
        private readonly AssetValidationService $validator,
        private readonly AssetStorageService $storage,
        private readonly ImageAnalysisService $analysis
    ) {}

    public function handle(UploadPrimaryLogoCommand $command): TenantBranding
    {
        // 1. Load branding
        $branding = $this->repository->findForTenant($command->tenantId);
        if (!$branding) {
            throw TenantBrandingNotFoundException::forTenant($command->tenantId);
        }

        // 2. Validate state (not archived)
        if ($branding->state()->isArchived()) {
            throw InvalidBrandingStateException::cannotUploadToArchived();
        }

        // 3. Validate file
        $this->validator->validateLogo($command->file);

        // 4. Delete old logo if exists
        if ($branding->getBranding()->getAssets()->hasPrimaryLogo()) {
            $oldPath = $branding->getBranding()->getAssets()->primaryLogoPath();
            $this->storage->delete($oldPath);
        }

        // 5. Store new file
        $path = $this->storage->store(
            $command->file,
            $command->tenantId->toString(),
            'logo'
        );

        // 6. Extract metadata
        $metadata = $this->analysis->extractMetadata($command->file);

        // 7. Update branding
        $newAssets = $branding->getBranding()->getAssets()->withPrimaryLogo(
            AssetPath::fromString($path),
            $metadata
        );

        $branding->updateAssets($newAssets);

        // 8. Save
        $this->repository->saveForTenant($branding);

        return $branding;
    }
}
```

### 3. Services (Infrastructure Layer)

#### AssetStorageService
```php
final class AssetStorageService
{
    public function store(
        UploadedFile $file,
        string $tenantSlug,
        string $type // 'logo', 'favicon', etc.
    ): string {
        // Generate filename: logo-{timestamp}.{ext}
        $timestamp = time();
        $extension = $file->getClientOriginalExtension();
        $filename = "{$type}-{$timestamp}.{$extension}";

        // Store in: tenants/{slug}/branding/
        $directory = "tenants/{$tenantSlug}/branding";

        $file->storeAs($directory, $filename, 'public');

        // Return domain path
        return "{$directory}/{$filename}";
    }

    public function delete(AssetPath $path): void
    {
        Storage::disk('public')->delete($path->toString());
    }

    public function exists(AssetPath $path): bool
    {
        return Storage::disk('public')->exists($path->toString());
    }
}
```

#### ImageAnalysisService
```php
final class ImageAnalysisService
{
    public function extractMetadata(UploadedFile $file): AssetMetadata
    {
        // Get dimensions
        $image = getimagesize($file->getRealPath());
        $dimensions = Dimensions::create($image[0], $image[1]);

        // Get file size
        $fileSize = $file->getSize();

        // Get MIME type
        $mimeType = $file->getMimeType();

        // Extract dominant color (optional, for PNG/JPG only)
        $dominantColor = null;
        if (in_array($mimeType, ['image/png', 'image/jpeg', 'image/jpg'])) {
            $dominantColor = $this->extractDominantColor($file);
        }

        return AssetMetadata::create(
            dimensions: $dimensions,
            fileSize: $fileSize,
            mimeType: $mimeType,
            dominantColor: $dominantColor
        );
    }

    private function extractDominantColor(UploadedFile $file): ?BrandingColor
    {
        // Use GD library to extract dominant color
        // Simplified: Sample center pixel or use color quantization
        // Returns null on failure
    }
}
```

#### AssetValidationService
```php
final class AssetValidationService
{
    private const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private const ALLOWED_MIME_TYPES = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/svg+xml',
    ];

    public function validateLogo(UploadedFile $file): void
    {
        // Check file size
        if ($file->getSize() > self::MAX_FILE_SIZE) {
            throw InvalidAssetException::fileTooLarge(
                $file->getSize(),
                self::MAX_FILE_SIZE
            );
        }

        // Check MIME type
        if (!in_array($file->getMimeType(), self::ALLOWED_MIME_TYPES)) {
            throw InvalidAssetException::invalidMimeType(
                $file->getMimeType(),
                self::ALLOWED_MIME_TYPES
            );
        }

        // Check dimensions (only for raster images)
        if ($this->isRasterImage($file)) {
            $image = getimagesize($file->getRealPath());
            $dimensions = Dimensions::create($image[0], $image[1]);

            if (!$dimensions->isValidForPrimaryLogo()) {
                throw InvalidAssetException::invalidDimensions(
                    $dimensions,
                    Dimensions::forPrimaryLogo()
                );
            }
        }
    }

    private function isRasterImage(UploadedFile $file): bool
    {
        return in_array($file->getMimeType(), [
            'image/png',
            'image/jpeg',
            'image/jpg',
        ]);
    }
}
```

---

## Testing Strategy (TDD)

### Test Categories

#### 1. Upload Tests
- ✅ Upload PNG logo (valid dimensions)
- ✅ Upload JPG logo (valid dimensions)
- ✅ Upload SVG logo (vector format)
- ✅ Reject file too large (>5MB)
- ✅ Reject invalid MIME type
- ✅ Reject invalid dimensions (too small/large)
- ✅ Upload to DRAFT branding (allowed)
- ✅ Upload to PUBLISHED branding (allowed)
- ✅ Upload to ARCHIVED branding (forbidden)
- ✅ Replace existing logo (deletes old file)
- ✅ Extract dominant color (PNG/JPG)
- ✅ No dominant color for SVG (expected)

#### 2. Removal Tests
- ✅ Remove logo from DRAFT branding
- ✅ Remove logo from PUBLISHED branding
- ✅ Remove logo from ARCHIVED branding (forbidden)
- ✅ Remove non-existent logo (idempotent)
- ✅ File deleted from storage

#### 3. Integration Tests
- ✅ Upload → Public API returns custom logo
- ✅ Upload → CSS endpoint includes logo URL
- ✅ Remove → Public API returns default
- ✅ State preservation (upload doesn't change state)

---

## Security Considerations

### File Upload Security
1. **MIME Type Validation**: Server-side verification (not just extension)
2. **File Size Limits**: Prevent DoS via large uploads
3. **Path Traversal**: AssetPath validates no parent directory references
4. **Malicious SVG**: Consider SVG sanitization (Phase 5)
5. **Rate Limiting**: Limit upload frequency per tenant

### Storage Security
1. **Tenant Isolation**: Files stored in tenant-specific directories
2. **Public Access**: Only uploaded assets publicly accessible
3. **No Execution**: Storage directory prevents script execution
4. **File Permissions**: Read-only for web server

---

## Migration Path

### Phase 1: Day 8 Implementation
- ✅ Primary logo upload/removal
- ✅ Local filesystem storage
- ✅ Basic dominant color extraction

### Phase 2: Future Enhancements (Days 9+)
- Favicon upload
- Multiple logo variants (dark mode, mobile)
- Cloud storage (S3, Cloudinary)
- Advanced color extraction
- Image optimization (compression, resizing)
- CDN integration

---

## Success Criteria

### Implementation Complete When:
1. ✅ All upload tests passing (12 tests)
2. ✅ All removal tests passing (5 tests)
3. ✅ All integration tests passing (4 tests)
4. ✅ No regression (Days 1-7 tests still passing)
5. ✅ Upload/removal endpoints functional
6. ✅ Files stored in correct directories
7. ✅ Asset metadata persisted to database
8. ✅ Public API returns uploaded logos

### Performance Targets
- Upload processing: <2 seconds (5MB file)
- Dominant color extraction: <500ms
- File storage: <1 second
- Total endpoint response: <3 seconds

---

## Implementation Order (TDD)

1. **Write Tests (RED)**
   - Upload tests (12)
   - Removal tests (5)
   - Integration tests (4)

2. **Implement (GREEN)**
   - AssetValidationService
   - ImageAnalysisService
   - AssetStorageService
   - Commands & Handlers
   - Controller endpoints

3. **Refactor**
   - Extract common validation logic
   - Optimize image processing
   - Add comprehensive error messages

4. **Documentation**
   - Update API documentation
   - Write developer guide
   - Add usage examples

---

**Status**: Ready for TDD RED Phase
**Next Step**: Create test file with 21 comprehensive tests
