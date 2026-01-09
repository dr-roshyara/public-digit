# Admin API - Implementation Guide: Phase 4 Endpoints

**Date**: 2026-01-08 02:20
**Status**: Pre-Implementation Planning
**Target**: Days 5-6 (After Repository Enhancement)
**Prerequisites**: Database migrated, Repository using `reconstitute()`

---

## 🎯 **OVERVIEW**

This guide provides the **complete implementation plan** for Phase 4 Admin API endpoints.

### **New Endpoints (Admin Dashboard Only)**:
```
POST   /{tenant}/api/v1/branding/publish          # Draft → Published
POST   /{tenant}/api/v1/branding/archive          # Published → Archived
POST   /{tenant}/api/v1/branding/logo             # Upload primary logo
GET    /{tenant}/api/v1/branding/state            # Get current state
GET    /{tenant}/api/v1/branding/version          # Get current version
```

### **Existing Endpoints (Unchanged)**:
```
GET    /{tenant}/api/v1/branding                  # Get branding (Phase 2/3)
PUT    /{tenant}/api/v1/branding                  # Update branding (Phase 2/3)
```

---

## 🏗️ **ARCHITECTURE OVERVIEW**

### **Request Flow**:
```
Vue 3 Dashboard
    ↓ HTTP Request
API Controller (Presentation Layer)
    ↓ Extract TenantId, Validate Input
Command/Query Bus (Application Layer)
    ↓ Dispatch Command
Command Handler (Application Layer)
    ↓ Load Aggregate, Execute Business Logic
TenantBranding Aggregate (Domain Layer)
    ↓ Validate Business Rules, Emit Events
Repository (Infrastructure Layer)
    ↓ Persist Changes
Database (tenant_branding table)
```

### **Architectural Constraints**:
- **NO** TenantId in domain layer (belongs to Shared context)
- **ONLY** Platform branding (not tenant-specific per RULE 1)
- **Web** middleware (not API middleware)
- **Session-based** authentication (not Sanctum)
- **CSRF** protection required

---

## 📋 **ENDPOINT SPECIFICATIONS**

### **1. Publish Branding**

**Purpose**: Transition branding from DRAFT to PUBLISHED state

**Route**:
```php
POST /{tenant}/api/v1/branding/publish
```

**Request Headers**:
```
Content-Type: application/json
X-CSRF-TOKEN: {token}
Cookie: {session}
```

**Request Body**:
```json
{
  "published_by": "admin-123"
}
```

**Success Response (200 OK)**:
```json
{
  "data": {
    "tenant_id": "nrna",
    "state": "published",
    "version": 2,
    "published_at": "2026-01-08T02:20:00Z",
    "branding": {
      "visuals": {
        "primary_color": "#1E3A8A",
        "secondary_color": "#FBBF24",
        "logo_url": "https://cdn.example.com/tenants/nrna/logo.png",
        "font_family": "Inter"
      },
      "content": {
        "welcome_message": "Welcome to NRNA",
        "hero_title": "Join Our Community",
        "hero_subtitle": "Connect with Nepali diaspora worldwide",
        "cta_text": "Get Started"
      },
      "identity": {
        "organization_name": "NRNA",
        "organization_tagline": "Global Nepali Network",
        "favicon_url": "https://cdn.example.com/tenants/nrna/favicon.ico"
      }
    }
  },
  "message": "Branding published successfully"
}
```

**Error Responses**:

**400 Bad Request** (Already Published):
```json
{
  "error": "InvalidStateTransition",
  "message": "Branding is already published",
  "current_state": "published"
}
```

**422 Unprocessable Entity** (Validation Failed):
```json
{
  "error": "ValidationError",
  "message": "The published_by field is required.",
  "errors": {
    "published_by": ["The published_by field is required."]
  }
}
```

---

### **2. Archive Branding**

**Purpose**: Transition branding from PUBLISHED to ARCHIVED state

**Route**:
```php
POST /{tenant}/api/v1/branding/archive
```

**Request Body**:
```json
{
  "archived_by": "admin-456"
}
```

**Success Response (200 OK)**:
```json
{
  "data": {
    "tenant_id": "nrna",
    "state": "archived",
    "version": 3,
    "archived_at": "2026-01-08T03:00:00Z",
    "branding": { /* same structure as publish */ }
  },
  "message": "Branding archived successfully"
}
```

**Error Responses**:

**400 Bad Request** (Not Published):
```json
{
  "error": "InvalidStateTransition",
  "message": "Only published branding can be archived",
  "current_state": "draft"
}
```

---

### **3. Upload Primary Logo**

**Purpose**: Upload and validate primary logo with WCAG compliance

**Route**:
```php
POST /{tenant}/api/v1/branding/logo
```

**Request Type**: `multipart/form-data`

**Request Fields**:
```
logo: File (PNG/JPG, max 2MB)
uploaded_by: string (user ID)
```

**Success Response (200 OK)**:
```json
{
  "data": {
    "tenant_id": "nrna",
    "version": 4,
    "assets": {
      "primary_logo": {
        "path": "tenants/nrna/logos/primary_20260108_0220.png",
        "url": "https://cdn.example.com/tenants/nrna/logos/primary_20260108_0220.png",
        "metadata": {
          "dimensions": {
            "width": 800,
            "height": 400
          },
          "file_size": 102400,
          "mime_type": "image/png",
          "dominant_color": "#1E3A8A"
        }
      }
    }
  },
  "message": "Logo uploaded successfully"
}
```

**Error Responses**:

**400 Bad Request** (WCAG Violation):
```json
{
  "error": "WcagLogoContrastViolation",
  "message": "Logo dominant color (#FFFFFF) has insufficient contrast with primary color (#F0F0F0). Required ratio: 4.5:1, actual: 1.2:1",
  "wcag_standard": "WCAG 2.1 AA",
  "min_contrast_ratio": 4.5,
  "actual_contrast_ratio": 1.2
}
```

**400 Bad Request** (Dimensions Invalid):
```json
{
  "error": "InvalidLogoDimensions",
  "message": "Logo dimensions (200×100) are outside tolerance. Expected: 800×400 ±20%",
  "expected": {
    "width": 800,
    "height": 400,
    "tolerance": 0.2
  },
  "actual": {
    "width": 200,
    "height": 100
  }
}
```

**400 Bad Request** (Not Editable):
```json
{
  "error": "InvalidStateTransition",
  "message": "Cannot update logo for archived branding. Only draft branding is editable.",
  "current_state": "archived"
}
```

**413 Payload Too Large** (File Too Large):
```json
{
  "error": "FileTooLarge",
  "message": "Logo file size exceeds maximum of 2MB",
  "max_size": 2097152,
  "actual_size": 3145728
}
```

---

### **4. Get Branding State**

**Purpose**: Check current state and version

**Route**:
```php
GET /{tenant}/api/v1/branding/state
```

**Success Response (200 OK)**:
```json
{
  "data": {
    "tenant_id": "nrna",
    "state": "published",
    "version": 2,
    "is_editable": false,
    "can_publish": false,
    "can_archive": true,
    "updated_at": "2026-01-08T02:20:00Z"
  }
}
```

---

### **5. Get Branding Version**

**Purpose**: Get version history metadata

**Route**:
```php
GET /{tenant}/api/v1/branding/version
```

**Success Response (200 OK)**:
```json
{
  "data": {
    "tenant_id": "nrna",
    "current_version": 2,
    "created_at": "2026-01-01T10:00:00Z",
    "updated_at": "2026-01-08T02:20:00Z",
    "change_count": 1
  }
}
```

---

## 🧩 **CONTROLLER IMPLEMENTATION**

### **File Location**:
```
packages/laravel-backend/app/Http/Controllers/Api/TenantBrandingController.php
```

### **Complete Controller Code**:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Contexts\Platform\Application\Commands\PublishBrandingCommand;
use App\Contexts\Platform\Application\Commands\ArchiveBrandingCommand;
use App\Contexts\Platform\Application\Commands\UpdatePrimaryLogoCommand;
use App\Contexts\Platform\Application\Queries\GetBrandingStateQuery;
use App\Contexts\Platform\Domain\Exceptions\InvalidStateTransitionException;
use App\Contexts\Platform\Domain\Exceptions\WcagLogoContrastViolation;
use App\Contexts\Platform\Domain\Exceptions\InvalidLogoDimensionsException;
use App\Contexts\Platform\Domain\ValueObjects\UserId;
use App\Contexts\Shared\Domain\ValueObjects\TenantId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;

final class TenantBrandingController
{
    /**
     * Publish branding (Draft → Published)
     *
     * POST /{tenant}/api/v1/branding/publish
     */
    public function publish(Request $request): JsonResponse
    {
        $request->validate([
            'published_by' => 'required|string',
        ]);

        try {
            $tenantId = TenantId::fromSlug($request->route('tenant'));
            $publisherId = UserId::fromString($request->input('published_by'));

            $command = new PublishBrandingCommand($tenantId, $publisherId);
            $branding = Bus::dispatch($command);

            return response()->json([
                'data' => $branding->toArray(),
                'message' => 'Branding published successfully',
            ], 200);

        } catch (InvalidStateTransitionException $e) {
            return response()->json([
                'error' => 'InvalidStateTransition',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Archive branding (Published → Archived)
     *
     * POST /{tenant}/api/v1/branding/archive
     */
    public function archive(Request $request): JsonResponse
    {
        $request->validate([
            'archived_by' => 'required|string',
        ]);

        try {
            $tenantId = TenantId::fromSlug($request->route('tenant'));
            $archiverId = UserId::fromString($request->input('archived_by'));

            $command = new ArchiveBrandingCommand($tenantId, $archiverId);
            $branding = Bus::dispatch($command);

            return response()->json([
                'data' => $branding->toArray(),
                'message' => 'Branding archived successfully',
            ], 200);

        } catch (InvalidStateTransitionException $e) {
            return response()->json([
                'error' => 'InvalidStateTransition',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Upload primary logo
     *
     * POST /{tenant}/api/v1/branding/logo
     */
    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => 'required|file|image|mimes:png,jpg,jpeg|max:2048',
            'uploaded_by' => 'required|string',
        ]);

        try {
            $tenantId = TenantId::fromSlug($request->route('tenant'));
            $uploaderId = UserId::fromString($request->input('uploaded_by'));

            // Store file and extract metadata (implementation below)
            $logoData = $this->processLogoUpload($request->file('logo'), $tenantId);

            $command = new UpdatePrimaryLogoCommand(
                $tenantId,
                $logoData['path'],
                $logoData['metadata'],
                $uploaderId
            );

            $branding = Bus::dispatch($command);

            return response()->json([
                'data' => $branding->toArray(),
                'message' => 'Logo uploaded successfully',
            ], 200);

        } catch (InvalidStateTransitionException $e) {
            return response()->json([
                'error' => 'InvalidStateTransition',
                'message' => $e->getMessage(),
            ], 400);

        } catch (WcagLogoContrastViolation $e) {
            return response()->json([
                'error' => 'WcagLogoContrastViolation',
                'message' => $e->getMessage(),
                'wcag_standard' => 'WCAG 2.1 AA',
                'min_contrast_ratio' => 4.5,
            ], 400);

        } catch (InvalidLogoDimensionsException $e) {
            return response()->json([
                'error' => 'InvalidLogoDimensions',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Get branding state
     *
     * GET /{tenant}/api/v1/branding/state
     */
    public function getState(Request $request): JsonResponse
    {
        $tenantId = TenantId::fromSlug($request->route('tenant'));
        $query = new GetBrandingStateQuery($tenantId);
        $state = Bus::dispatch($query);

        return response()->json([
            'data' => $state,
        ], 200);
    }

    /**
     * Process uploaded logo file
     *
     * Infrastructure concern: File storage + metadata extraction
     */
    private function processLogoUpload($file, TenantId $tenantId): array
    {
        // 1. Store file in storage/app/public/tenants/{slug}/logos/
        $path = $file->store("tenants/{$tenantId->toString()}/logos", 'public');

        // 2. Extract dimensions
        [$width, $height] = getimagesize(storage_path("app/public/{$path}"));

        // 3. Extract dominant color (requires image processing library)
        $dominantColor = $this->extractDominantColor(storage_path("app/public/{$path}"));

        // 4. Return domain-compatible data
        return [
            'path' => AssetPath::fromString($path),
            'metadata' => AssetMetadata::create(
                dimensions: Dimensions::create($width, $height),
                fileSize: $file->getSize(),
                mimeType: $file->getMimeType(),
                dominantColor: $dominantColor ? BrandingColor::fromString($dominantColor) : null
            ),
        ];
    }

    /**
     * Extract dominant color from image
     *
     * Uses image processing to find most prominent color
     */
    private function extractDominantColor(string $path): ?string
    {
        // Implementation using GD or Imagick
        // Returns hex color string or null
        // Example: "#1E3A8A"
    }
}
```

---

## 📦 **COMMAND/HANDLER IMPLEMENTATION**

### **1. PublishBrandingCommand**

**File**: `app/Contexts/Platform/Application/Commands/PublishBrandingCommand.php`

```php
<?php

namespace App\Contexts\Platform\Application\Commands;

use App\Contexts\Platform\Domain\ValueObjects\UserId;
use App\Contexts\Shared\Domain\ValueObjects\TenantId;

final readonly class PublishBrandingCommand
{
    public function __construct(
        public TenantId $tenantId,
        public UserId $publisherId
    ) {}
}
```

### **2. PublishBrandingHandler**

**File**: `app/Contexts/Platform/Application/Handlers/PublishBrandingHandler.php`

```php
<?php

namespace App\Contexts\Platform\Application\Handlers;

use App\Contexts\Platform\Application\Commands\PublishBrandingCommand;
use App\Contexts\Platform\Domain\Entities\TenantBranding;
use App\Contexts\Platform\Domain\Repositories\TenantBrandingRepositoryInterface;

final readonly class PublishBrandingHandler
{
    public function __construct(
        private TenantBrandingRepositoryInterface $repository
    ) {}

    public function handle(PublishBrandingCommand $command): TenantBranding
    {
        // Load branding
        $branding = $this->repository->findForTenant($command->tenantId);

        if (!$branding) {
            throw new \DomainException("Branding not found for tenant: {$command->tenantId->toString()}");
        }

        // Execute business logic
        $branding->publish($command->publisherId);

        // Persist changes
        $this->repository->saveForTenant($branding);

        // Return updated branding
        return $branding;
    }
}
```

---

## 🛡️ **VALIDATION RULES**

### **Request Validation**:

```php
// Publish/Archive
[
    'published_by' => 'required|string|max:255',
    'archived_by' => 'required|string|max:255',
]

// Logo Upload
[
    'logo' => 'required|file|image|mimes:png,jpg,jpeg|max:2048',
    'uploaded_by' => 'required|string|max:255',
]
```

### **Domain Validation** (Automatic):
- State transition rules (enforced by TenantBranding)
- WCAG contrast ratio (enforced by BrandingColor)
- Logo dimensions (enforced by Dimensions)
- Version increment (enforced by Version)

---

## 🔐 **AUTHENTICATION & AUTHORIZATION**

### **Middleware Stack**:
```php
Route::middleware(['web', 'auth', 'identify.tenant'])
    ->prefix('{tenant}/api/v1/branding')
    ->group(function () {
        Route::post('/publish', [TenantBrandingController::class, 'publish']);
        Route::post('/archive', [TenantBrandingController::class, 'archive']);
        Route::post('/logo', [TenantBrandingController::class, 'uploadLogo']);
        Route::get('/state', [TenantBrandingController::class, 'getState']);
        Route::get('/version', [TenantBrandingController::class, 'getVersion']);
    });
```

### **Authorization**:
```php
// In controller method
$this->authorize('update', $branding);

// Policy
public function update(User $user, TenantBranding $branding): bool
{
    return $user->hasPermission('branding.update')
        && $user->tenant_id === $branding->getTenantId()->toString();
}
```

---

## 🧪 **API TESTING**

### **Feature Test Structure**:

**File**: `tests/Feature/Http/Controllers/Api/TenantBrandingControllerTest.php`

```php
/** @test */
public function it_can_publish_draft_branding()
{
    // Arrange
    $tenant = Tenant::factory()->create(['slug' => 'nrna']);
    $user = User::factory()->create(['tenant_id' => $tenant->id]);

    // Create draft branding
    $branding = TenantBranding::create(
        TenantId::fromSlug('nrna'),
        BrandingBundle::defaults()
    );
    $this->repository->saveForTenant($branding);

    // Act
    $response = $this->actingAs($user)->postJson('/nrna/api/v1/branding/publish', [
        'published_by' => 'admin-123',
    ]);

    // Assert
    $response->assertStatus(200);
    $response->assertJson([
        'data' => [
            'state' => 'published',
            'version' => 2,
        ],
        'message' => 'Branding published successfully',
    ]);
}
```

---

## 📖 **SEE ALSO**

- [Overview & Quick Start](./20260108_0200_Admin_API_Overview_Quick_Start.md)
- [Domain Layer Deep Dive](./20260108_0205_Domain_Layer_Deep_Dive.md)
- [Testing Guide](./20260108_0210_Testing_Guide.md)
- [Migration Strategy](./20260108_0215_Migration_Strategy.md)

---

**Developer Notes**:
- Implement after Day 3-4 (Repository Enhancement complete)
- All domain validation is automatic (no controller logic)
- WCAG validation happens in domain layer
- Logo processing is infrastructure concern (controller)
- Ready for Vue 3 Dashboard integration (Days 7-8)
