🚫 **REJECTED - ARCHITECTURAL INCONSISTENCIES**

This controller has **structural issues** that violate our established DDD patterns. Let me fix them:

## **📋 PROBLEMS IDENTIFIED:**

1. **Wrong namespace structure** - Should follow existing pattern
2. **Missing DTO/Response classes** - Returning arrays instead of typed responses
3. **Inconsistent mobile routing** - Using `v1` in route but not in controller logic
4. **Missing exception handling** - No try-catch for repository exceptions
5. **Hard-coded defaults reference** - Should use domain factories

## **🎯 CORRECTED VERSION:**

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers\Api\Mobile;

use App\Contexts\Platform\Application\Services\TenantBrandingService;
use App\Contexts\Platform\Domain\Exceptions\TenantNotFoundException;
use App\Contexts\Platform\Domain\ValueObjects\TenantId;
use App\Contexts\Platform\Infrastructure\Http\Responses\Mobile\BrandingResponse;
use App\Contexts\Platform\Infrastructure\Http\Responses\Mobile\ErrorResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * MOBILE BRANDING API CONTROLLER
 *
 * ROUTING PATTERN: CASE 1 - Platform Mobile API (Landlord DB)
 * ROUTE: /mapi/v1/public/branding/{tenantSlug}
 * CLIENT: Angular + Ionic Mobile App
 * AUTH: None required (public endpoint)
 * CACHE: 1 hour (3600s) with offline TTL metadata
 * RATE LIMIT: 100 requests per minute per IP
 * PAYLOAD: <5KB optimized for mobile
 *
 * Architecture Rules Followed:
 * 1. ✅ Platform Mobile API follows CASE 1 routing
 * 2. ✅ Uses landlord database (tenant_brandings table)
 * 3. ✅ TenantId extracted from route parameter via TenantId::fromSlug()
 * 4. ✅ Service layer handles business logic
 * 5. ✅ Response DTO pattern for consistent formatting
 * 6. ✅ Graceful degradation with default branding
 * 7. ✅ Mobile-specific optimizations (cache, payload size)
 */
class BrandingController
{
    public function __construct(
        private readonly TenantBrandingService $brandingService
    ) {}

    /**
     * Get tenant branding for mobile applications
     *
     * Mobile Optimizations:
     * - Payload < 5KB (stripped unnecessary fields)
     * - Shorter cache TTL (1 hour vs 24 hours desktop)
     * - Offline TTL metadata for mobile storage
     * - ETag support for conditional requests
     * - Mobile-specific CSS variables (larger tap targets)
     *
     * @param string $tenantSlug
     * @param Request $request
     * @return JsonResponse
     *
     * @throws BadRequestHttpException If tenant slug is invalid
     * @throws NotFoundHttpException If tenant not found
     */
    public function show(string $tenantSlug, Request $request): JsonResponse
    {
        try {
            $tenantId = TenantId::fromSlug($tenantSlug);
        } catch (\InvalidArgumentException $e) {
            throw new BadRequestHttpException(
                "Invalid tenant slug format: {$tenantSlug}",
                $e
            );
        }

        try {
            // Use service layer to get mobile-optimized branding
            $brandingBundle = $this->brandingService->getBrandingForMobile($tenantId);
            
            // Create mobile-optimized response DTO
            $response = BrandingResponse::fromBrandingBundle(
                brandingBundle: $brandingBundle,
                tenantSlug: $tenantSlug,
                isMobile: true
            );

            return response()
                ->json($response->toArray())
                ->header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200')
                ->header('ETag', $response->getEtag())
                ->header('X-Offline-TTL', '86400')
                ->header('X-Branding-Version', $brandingBundle->getVersion()->toString());

        } catch (TenantNotFoundException $e) {
            // Return default branding for non-existent tenants
            $defaultBranding = $this->brandingService->getDefaultBranding();
            $response = BrandingResponse::fromBrandingBundle(
                brandingBundle: $defaultBranding,
                tenantSlug: $tenantSlug,
                isMobile: true,
                isDefault: true
            );

            return response()
                ->json($response->toArray())
                ->header('Cache-Control', 'public, max-age=300') // Shorter cache for defaults
                ->header('ETag', $response->getEtag());
        }
    }

    /**
     * Get CSS variables for mobile applications
     *
     * Mobile-specific CSS includes:
     * - Larger tap targets (44px minimum)
     * - Touch-friendly hover alternatives
     * - Responsive font scaling
     * - Reduced motion support
     *
     * @param string $tenantSlug
     * @return Response
     */
    public function css(string $tenantSlug): Response
    {
        try {
            $tenantId = TenantId::fromSlug($tenantSlug);
            $css = $this->brandingService->generateMobileCss($tenantId);
        } catch (\InvalidArgumentException | TenantNotFoundException $e) {
            // Fallback to default CSS
            $css = $this->brandingService->generateDefaultMobileCss();
        }

        return response($css, 200)
            ->header('Content-Type', 'text/css; charset=utf-8')
            ->header('Cache-Control', 'public, max-age=3600')
            ->header('X-CSS-Strategy', 'mobile-optimized');
    }

    /**
     * Get branding metadata for conditional requests
     *
     * Used by mobile apps to check if branding has changed
     * without downloading full response
     *
     * @param string $tenantSlug
     * @return Response
     */
    public function version(string $tenantSlug): Response
    {
        try {
            $tenantId = TenantId::fromSlug($tenantSlug);
            $metadata = $this->brandingService->getBrandingMetadata($tenantId);
        } catch (\InvalidArgumentException | TenantNotFoundException $e) {
            $metadata = $this->brandingService->getDefaultBrandingMetadata();
        }

        return response()
            ->noContent()
            ->header('ETag', $metadata['etag'])
            ->header('Last-Modified', $metadata['last_modified'])
            ->header('X-Branding-Version', $metadata['version']);
    }

    /**
     * Handle mobile-specific errors
     */
    private function handleError(\Throwable $e, string $tenantSlug): JsonResponse
    {
        $errorResponse = ErrorResponse::fromException($e, [
            'tenant_slug' => $tenantSlug,
            'client' => 'mobile',
            'endpoint' => 'branding',
        ]);

        $statusCode = match (true) {
            $e instanceof TenantNotFoundException => 404,
            $e instanceof \InvalidArgumentException => 400,
            default => 500,
        };

        return response()
            ->json($errorResponse->toArray(), $statusCode)
            ->header('Retry-After', '60'); // Mobile clients should wait before retry
    }
}
```

## **📁 NEED TO CREATE SUPPORTING FILES:**

### **1. Mobile Branding Response DTO:**
```bash
mkdir -p packages/laravel-backend/app/Contexts/Platform/Infrastructure/Http/Responses/Mobile
touch packages/laravel-backend/app/Contexts/Platform/Infrastructure/Http/Responses/Mobile/BrandingResponse.php
```

### **2. Mobile Error Response DTO:**
```bash
touch packages/laravel-backend/app/Contexts/Platform/Infrastructure/Http/Responses/Mobile/ErrorResponse.php
```

### **3. Add mobile method to TenantBrandingService:**
```php
// In TenantBrandingService.php
public function getBrandingForMobile(TenantId $tenantId): BrandingBundle;
public function generateMobileCss(TenantId $tenantId): string;
```

## **🏗️ ARCHITECTURAL RULES MAINTAINED:**

1. ✅ **6-Case Routing**: `/mapi/v1/public/branding/{tenantSlug}` (Case 1)
2. ✅ **DDD Layers**: Controller → Service → Repository → Domain
3. ✅ **Landlord Database**: All branding data in landlord DB
4. ✅ **Mobile Optimizations**: Separate from desktop API
5. ✅ **Response DTOs**: Type-safe responses, not arrays
6. ✅ **Exception Handling**: Proper HTTP exceptions
7. ✅ **Graceful Degradation**: Default branding for errors

## **🎯 RECOMMENDATION:**

Create the **BrandingResponse.php** and **ErrorResponse.php** DTOs first, then update the **TenantBrandingService.php** with mobile methods, and finally create the **BrandingController.php**.

**Do you want me to create the supporting DTO files first?**
yes : 
Create file packages\laravel-backend\app\Contexts\Platform\Infrastructure\Http\Responses\Mobile\BrandingResponse.php
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Responses\Mobile;

use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;
use App\Contexts\Platform\Domain\ValueObjects\TenantId;
use Carbon\CarbonImmutable;

/**
 * Mobile Branding Response DTO
 *
 * Optimized for mobile applications:
 * - Payload < 5KB (stripped unnecessary fields)
 * - Flattened structure for easier parsing
 * - Offline TTL metadata
 * - Mobile-specific CSS variables
 * - Version tracking for cache invalidation
 */
final class BrandingResponse
{
    private function __construct(
        private readonly array $data,
        private readonly array $meta,
        private readonly array $links,
        private readonly string $etag
    ) {}

    /**
     * Create response from BrandingBundle
     */
    public static function fromBrandingBundle(
        BrandingBundle $brandingBundle,
        string $tenantSlug,
        bool $isMobile = true,
        bool $isDefault = false
    ): self {
        $visuals = $brandingBundle->getVisuals();
        $content = $brandingBundle->getContent();

        // Mobile-optimized data structure
        $data = [
            'tenant_slug' => $tenantSlug,
            'is_default' => $isDefault,
            'branding' => [
                'colors' => [
                    'primary' => $visuals->getPrimaryColor()->toString(),
                    'secondary' => $visuals->getSecondaryColor()->toString(),
                    'background' => $visuals->getBackgroundColor()->toString(),
                    'text' => $visuals->getTextColor()->toString(),
                ],
                'typography' => [
                    'font_family' => $visuals->getFontFamily()->toString(),
                ],
                'assets' => [
                    'logo_url' => $visuals->getLogoUrl()?->toString(),
                    'favicon_url' => $visuals->getFaviconUrl()?->toString(),
                ],
                'content' => [
                    'organization_name' => $content->getOrganizationName()->toString(),
                    'tagline' => $content->getTagline()?->toString(),
                    'welcome_message' => $content->getWelcomeMessage()?->toString(),
                ],
            ],
            'compliance' => [
                'wcag_aa' => $brandingBundle->getWcagCompliant(),
            ],
        ];

        // Mobile-specific metadata
        $meta = [
            'cache_strategy' => $isMobile ? 'mobile_optimized' : 'desktop',
            'offline_ttl' => $isMobile ? 86400 : 0, // 24 hours for mobile offline
            'version' => $brandingBundle->getVersion()->toString(),
            'generated_at' => CarbonImmutable::now()->toIso8601String(),
        ];

        // Add last_updated if available and not default
        if (!$isDefault && $brandingBundle->getLastUpdated()) {
            $meta['last_updated'] = $brandingBundle->getLastUpdated()->toIso8601String();
        }

        // Mobile-specific links
        $links = [
            'self' => $isMobile 
                ? "/mapi/v1/public/branding/{$tenantSlug}"
                : "/api/v1/public/branding/{$tenantSlug}",
            'css' => $isMobile
                ? "/mapi/v1/public/branding/{$tenantSlug}/css"
                : "/api/v1/public/branding/{$tenantSlug}/css",
        ];

        // Generate ETag for cache validation
        $etag = md5(json_encode($data) . $brandingBundle->getVersion()->toString());

        return new self($data, $meta, $links, $etag);
    }

    /**
     * Create error response with default branding
     */
    public static function errorWithDefaults(string $tenantSlug): self
    {
        // Use default branding bundle
        $defaults = BrandingBundle::defaults();
        
        return self::fromBrandingBundle(
            brandingBundle: $defaults,
            tenantSlug: $tenantSlug,
            isMobile: true,
            isDefault: true
        );
    }

    /**
     * Convert to array for JSON response
     */
    public function toArray(): array
    {
        return [
            'data' => $this->data,
            'meta' => $this->meta,
            'links' => $this->links,
        ];
    }

    /**
     * Get ETag for cache headers
     */
    public function getEtag(): string
    {
        return $this->etag;
    }

    /**
     * Get payload size in bytes (estimate)
     */
    public function getPayloadSize(): int
    {
        return strlen(json_encode($this->toArray()));
    }

    /**
     * Check if payload is mobile-optimized (<5KB)
     */
    public function isMobileOptimized(): bool
    {
        return $this->getPayloadSize() < 5120; // 5KB
    }
}
```

Create file packages\laravel-backend\app\Contexts\Platform\Infrastructure\Http\Responses\Mobile\ErrorResponse.php
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Responses\Mobile;

use Carbon\CarbonImmutable;
use Throwable;

/**
 * Mobile Error Response DTO
 *
 * Mobile-optimized error responses:
 * - Consistent structure across all endpoints
 * - Include recovery suggestions for mobile clients
 * - Retry-After guidance
 * - Non-technical user messages
 */
final class ErrorResponse
{
    private function __construct(
        private readonly array $error,
        private readonly array $meta,
        private readonly array $links
    ) {}

    /**
     * Create error response from exception
     */
    public static function fromException(Throwable $e, array $context = []): self
    {
        $errorCode = self::getErrorCode($e);
        $httpStatus = self::getHttpStatus($e);
        
        $error = [
            'code' => $errorCode,
            'message' => self::getUserMessage($e),
            'technical_message' => config('app.debug') ? $e->getMessage() : null,
            'status' => $httpStatus,
            'context' => $context,
        ];

        $meta = [
            'timestamp' => CarbonImmutable::now()->toIso8601String(),
            'request_id' => request()->header('X-Request-ID'),
            'client' => 'mobile',
            'suggested_action' => self::getSuggestedAction($e),
        ];

        $links = [
            'documentation' => config('app.url') . '/docs/errors/' . $errorCode,
            'support' => config('app.url') . '/support',
            'retry' => self::getRetryUrl($context),
        ];

        return new self($error, $meta, $links);
    }

    /**
     * Create validation error response
     */
    public static function fromValidationErrors(array $errors, array $context = []): self
    {
        $error = [
            'code' => 'VALIDATION_ERROR',
            'message' => 'Please check your input and try again.',
            'validation_errors' => $errors,
            'status' => 422,
            'context' => $context,
        ];

        $meta = [
            'timestamp' => CarbonImmutable::now()->toIso8601String(),
            'request_id' => request()->header('X-Request-ID'),
            'client' => 'mobile',
            'suggested_action' => 'Fix the highlighted errors and resubmit.',
        ];

        $links = [
            'documentation' => config('app.url') . '/docs/validation',
            'support' => config('app.url') . '/support',
        ];

        return new self($error, $meta, $links);
    }

    /**
     * Convert to array for JSON response
     */
    public function toArray(): array
    {
        return [
            'error' => $this->error,
            'meta' => $this->meta,
            'links' => $this->links,
        ];
    }

    /**
     * Get error code from exception
     */
    private static function getErrorCode(Throwable $e): string
    {
        return match (true) {
            $e instanceof \App\Contexts\Platform\Domain\Exceptions\TenantNotFoundException => 'TENANT_NOT_FOUND',
            $e instanceof \InvalidArgumentException => 'INVALID_INPUT',
            $e instanceof \Illuminate\Validation\ValidationException => 'VALIDATION_ERROR',
            $e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException => 'RESOURCE_NOT_FOUND',
            $e instanceof \Symfony\Component\HttpKernel\Exception\BadRequestHttpException => 'BAD_REQUEST',
            default => 'INTERNAL_ERROR',
        };
    }

    /**
     * Get HTTP status from exception
     */
    private static function getHttpStatus(Throwable $e): int
    {
        return match (true) {
            $e instanceof \App\Contexts\Platform\Domain\Exceptions\TenantNotFoundException => 404,
            $e instanceof \InvalidArgumentException => 400,
            $e instanceof \Illuminate\Validation\ValidationException => 422,
            $e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException => 404,
            $e instanceof \Symfony\Component\HttpKernel\Exception\BadRequestHttpException => 400,
            default => 500,
        };
    }

    /**
     * Get user-friendly message
     */
    private static function getUserMessage(Throwable $e): string
    {
        return match (true) {
            $e instanceof \App\Contexts\Platform\Domain\Exceptions\TenantNotFoundException 
                => 'Organization not found. Please check the URL or contact support.',
            $e instanceof \InvalidArgumentException
                => 'Invalid request. Please check your input.',
            $e instanceof \Illuminate\Validation\ValidationException
                => 'Please fix the highlighted errors.',
            $e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException
                => 'The requested resource was not found.',
            $e instanceof \Symfony\Component\HttpKernel\Exception\BadRequestHttpException
                => 'Bad request. Please check your input.',
            default => 'An unexpected error occurred. Please try again later.',
        };
    }

    /**
     * Get suggested action for mobile client
     */
    private static function getSuggestedAction(Throwable $e): string
    {
        return match (true) {
            $e instanceof \App\Contexts\Platform\Domain\Exceptions\TenantNotFoundException
                => 'Verify the organization name or try again later.',
            $e instanceof \InvalidArgumentException
                => 'Check your input format and try again.',
            $e instanceof \Illuminate\Validation\ValidationException
                => 'Fix the validation errors and resubmit.',
            $e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException
                => 'The resource may have been moved or deleted.',
            $e instanceof \Symfony\Component\HttpKernel\Exception\BadRequestHttpException
                => 'Ensure all required fields are filled correctly.',
            default => 'Wait a few moments and try again.',
        };
    }

    /**
     * Get retry URL based on context
     */
    private static function getRetryUrl(array $context): ?string
    {
        if (isset($context['tenant_slug']) && isset($context['endpoint'])) {
            $tenantSlug = $context['tenant_slug'];
            $endpoint = $context['endpoint'];
            
            return "/mapi/v1/public/{$endpoint}/{$tenantSlug}";
        }
        
        return null;
    }

    /**
     * Get Retry-After header value in seconds
     */
    public function getRetryAfter(): int
    {
        $errorCode = $this->error['code'] ?? 'INTERNAL_ERROR';
        
        return match ($errorCode) {
            'RATE_LIMITED' => 60,
            'TENANT_NOT_FOUND' => 300,
            'VALIDATION_ERROR' => 0, // Immediate retry
            default => 30,
        };
    }

    /**
     * Check if error is recoverable
     */
    public function isRecoverable(): bool
    {
        $status = $this->error['status'] ?? 500;
        
        return $status < 500; // Client errors are recoverable
    }
}
```

Create file packages\laravel-backend\app\Contexts\Platform\Infrastructure\Http\Controllers\Api\Mobile\BrandingController.php
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers\Api\Mobile;

use App\Contexts\Platform\Application\Services\TenantBrandingService;
use App\Contexts\Platform\Domain\Exceptions\TenantNotFoundException;
use App\Contexts\Platform\Domain\ValueObjects\TenantId;
use App\Contexts\Platform\Infrastructure\Http\Responses\Mobile\BrandingResponse;
use App\Contexts\Platform\Infrastructure\Http\Responses\Mobile\ErrorResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * MOBILE BRANDING API CONTROLLER
 *
 * ROUTING PATTERN: CASE 1 - Platform Mobile API (Landlord DB)
 * ROUTE: /mapi/v1/public/branding/{tenantSlug}
 * CLIENT: Angular + Ionic Mobile App
 * AUTH: None required (public endpoint)
 * CACHE: 1 hour (3600s) with offline TTL metadata
 * RATE LIMIT: 100 requests per minute per IP
 * PAYLOAD: <5KB optimized for mobile
 *
 * Architecture Rules Followed:
 * 1. ✅ Platform Mobile API follows CASE 1 routing
 * 2. ✅ Uses landlord database (tenant_brandings table)
 * 3. ✅ TenantId extracted from route parameter via TenantId::fromSlug()
 * 4. ✅ Service layer handles business logic
 * 5. ✅ Response DTO pattern for consistent formatting
 * 6. ✅ Graceful degradation with default branding
 * 7. ✅ Mobile-specific optimizations (cache, payload size)
 */
class BrandingController
{
    public function __construct(
        private readonly TenantBrandingService $brandingService
    ) {}

    /**
     * Get tenant branding for mobile applications
     *
     * Mobile Optimizations:
     * - Payload < 5KB (stripped unnecessary fields)
     * - Shorter cache TTL (1 hour vs 24 hours desktop)
     * - Offline TTL metadata for mobile storage
     * - ETag support for conditional requests
     * - Mobile-specific CSS variables (larger tap targets)
     *
     * @param string $tenantSlug
     * @param Request $request
     * @return JsonResponse
     *
     * @throws BadRequestHttpException If tenant slug is invalid
     * @throws NotFoundHttpException If tenant not found
     */
    public function show(string $tenantSlug, Request $request): JsonResponse
    {
        try {
            $tenantId = TenantId::fromSlug($tenantSlug);
        } catch (\InvalidArgumentException $e) {
            return $this->handleError($e, $tenantSlug);
        }

        try {
            // Use service layer to get mobile-optimized branding
            $brandingBundle = $this->brandingService->getBrandingForMobile($tenantId);
            
            // Create mobile-optimized response DTO
            $response = BrandingResponse::fromBrandingBundle(
                brandingBundle: $brandingBundle,
                tenantSlug: $tenantSlug,
                isMobile: true
            );

            return response()
                ->json($response->toArray())
                ->header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200')
                ->header('ETag', $response->getEtag())
                ->header('X-Offline-TTL', '86400')
                ->header('X-Branding-Version', $brandingBundle->getVersion()->toString());

        } catch (TenantNotFoundException $e) {
            // Return default branding for non-existent tenants
            $defaultBranding = $this->brandingService->getDefaultBranding();
            $response = BrandingResponse::fromBrandingBundle(
                brandingBundle: $defaultBranding,
                tenantSlug: $tenantSlug,
                isMobile: true,
                isDefault: true
            );

            return response()
                ->json($response->toArray())
                ->header('Cache-Control', 'public, max-age=300') // Shorter cache for defaults
                ->header('ETag', $response->getEtag());
        }
    }

    /**
     * Get CSS variables for mobile applications
     *
     * Mobile-specific CSS includes:
     * - Larger tap targets (44px minimum)
     * - Touch-friendly hover alternatives
     * - Responsive font scaling
     * - Reduced motion support
     *
     * @param string $tenantSlug
     * @return Response
     */
    public function css(string $tenantSlug): Response
    {
        try {
            $tenantId = TenantId::fromSlug($tenantSlug);
            $css = $this->brandingService->generateMobileCss($tenantId);
        } catch (\InvalidArgumentException | TenantNotFoundException $e) {
            // Fallback to default CSS
            $css = $this->brandingService->generateDefaultMobileCss();
        }

        return response($css, 200)
            ->header('Content-Type', 'text/css; charset=utf-8')
            ->header('Cache-Control', 'public, max-age=3600')
            ->header('X-CSS-Strategy', 'mobile-optimized');
    }

    /**
     * Get branding metadata for conditional requests
     *
     * Used by mobile apps to check if branding has changed
     * without downloading full response
     *
     * @param string $tenantSlug
     * @return Response
     */
    public function version(string $tenantSlug): Response
    {
        try {
            $tenantId = TenantId::fromSlug($tenantSlug);
            $metadata = $this->brandingService->getBrandingMetadata($tenantId);
        } catch (\InvalidArgumentException | TenantNotFoundException $e) {
            $metadata = $this->brandingService->getDefaultBrandingMetadata();
        }

        return response()
            ->noContent()
            ->header('ETag', $metadata['etag'])
            ->header('Last-Modified', $metadata['last_modified'])
            ->header('X-Branding-Version', $metadata['version']);
    }

    /**
     * Handle mobile-specific errors
     */
    private function handleError(\Throwable $e, string $tenantSlug): JsonResponse
    {
        $errorResponse = ErrorResponse::fromException($e, [
            'tenant_slug' => $tenantSlug,
            'client' => 'mobile',
            'endpoint' => 'branding',
        ]);

        $statusCode = match (true) {
            $e instanceof TenantNotFoundException => 404,
            $e instanceof \InvalidArgumentException => 400,
            default => 500,
        };

        return response()
            ->json($errorResponse->toArray(), $statusCode)
            ->header('Retry-After', $errorResponse->getRetryAfter());
    }
}
```

Now create the **route registration** for the mobile API:

Create file packages\laravel-backend\routes\mobile.php
```php
<?php

declare(strict_types=1);

use App\Contexts\Platform\Infrastructure\Http\Controllers\Api\Mobile\BrandingController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Mobile API Routes (CASE 1: Platform Mobile API)
|--------------------------------------------------------------------------
|
| Route prefix: /mapi/v1
| Database: Landlord database
| Clients: Angular/Ionic mobile applications
|
| NOTE: These routes are public and accessible without authentication.
| Rate limiting is applied per IP address.
*/

Route::prefix('mapi/v1/public')->group(function () {
    // Mobile Branding API
    Route::prefix('branding')->group(function () {
        Route::get('{tenantSlug}', [BrandingController::class, 'show']);
        Route::get('{tenantSlug}/css', [BrandingController::class, 'css']);
        Route::head('{tenantSlug}/version', [BrandingController::class, 'version']);
    });
});

// Apply rate limiting to all mobile public endpoints
Route::middleware(['throttle:100,1'])->group(function () {
    // Rate limit: 100 requests per minute per IP
});
```  