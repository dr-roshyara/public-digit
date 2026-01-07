# 🌐 **CORRECTED IMPLEMENTATION: MULTI-CLIENT API STRATEGY**

## **🎯 CRITICAL API ARCHITECTURE IMPROVEMENTS**

### **1. THREE-TIER API ARCHITECTURE**

**Problem**: Single API endpoint tries to serve all clients, causing security and performance issues.

**Solution**: Dedicated API layers for each client type:

```php
// Platform/Infrastructure/Http/Controllers/
├── TenantBrandingAdminController.php     # Vue Desktop Admin (full functionality)
├── TenantBrandingMobileController.php    # Angular Mobile App (optimized)
└── TenantBrandingPublicController.php    # Public API (login pages, no auth)
```

### **2. ADMIN API (VUE DESKTOP - FULL FUNCTIONALITY)**

**Target**: Platform administrators and tenant admins with full control.

```php
// Platform/Infrastructure/Http/Controllers/TenantBrandingAdminController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

use App\Contexts\Platform\Application\Commands\CreateTenantBrandingCommand;
use App\Contexts\Platform\Application\Commands\UpdateTenantBrandingCommand;
use App\Contexts\Platform\Application\Commands\OverrideComplianceCommand;
use App\Contexts\Platform\Application\Queries\GetTenantBrandingQuery;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\UserId;
use App\Contexts\Platform\Infrastructure\Http\Requests\BrandingUpdateRequest;
use App\Contexts\Platform\Infrastructure\Http\Requests\BrandingComplianceOverrideRequest;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class TenantBrandingAdminController extends Controller
{
    /**
     * Middleware configuration
     */
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'verified', 'tenant.admin']);
        $this->middleware('throttle:60,1')->only(['store', 'update', 'destroy']);
        $this->middleware('scope:branding.write')->only(['store', 'update', 'destroy']);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/admin
     * Full admin view with compliance reports, audit history, versions
     */
    public function show(string $tenantSlug): JsonResponse
    {
        $this->authorize('view-branding-admin', $tenantSlug);

        $query = new GetTenantBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            includeComplianceReport: true,
            includeAuditHistory: true,
            includeVersionHistory: true,
            includeWcagViolations: true,
            includePerformanceMetrics: true,
            includeSubscriptionLimits: true
        );

        $result = $this->queryBus->handle($query);

        return response()->json([
            'branding' => $result->branding,
            'compliance' => $result->complianceReport,
            'versions' => $result->versionHistory,
            'audit_log' => $result->auditHistory,
            'performance' => $result->performanceMetrics,
            'subscription' => [
                'tier' => $result->subscriptionTier,
                'limits' => $result->subscriptionLimits,
                'usage' => $result->currentUsage,
            ],
            'available_features' => $result->availableFeatures,
            'legal_requirements' => $result->legalRequirements,
        ], 200, [
            'X-Branding-Version' => $result->branding->version,
            'X-Compliance-Level' => $result->complianceReport->level,
            'X-Cache' => $result->cached ? 'HIT' : 'MISS',
        ]);
    }

    /**
     * POST /api/platform/branding/{tenantSlug}/admin
     * Create new branding configuration
     */
    public function store(BrandingUpdateRequest $request, string $tenantSlug): JsonResponse
    {
        $this->authorize('create-branding', $tenantSlug);

        $command = new CreateTenantBrandingCommand(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            brandingData: $request->validated(),
            createdBy: UserId::fromString($request->user()->id),
            sourceIp: $request->ip(),
            userAgent: $request->userAgent()
        );

        $result = $this->commandBus->handle($command);

        return response()->json([
            'success' => true,
            'branding' => $result->branding,
            'compliance_check' => $result->complianceReport,
            'warnings' => $result->warnings,
            'version' => $result->newVersion,
            'audit_id' => $result->auditLogId,
        ], 201, [
            'Location' => route('branding.admin.show', $tenantSlug),
            'X-Branding-Version' => $result->newVersion,
        ]);
    }

    /**
     * PUT /api/platform/branding/{tenantSlug}/admin
     * Full update with WCAG validation and compliance enforcement
     */
    public function update(BrandingUpdateRequest $request, string $tenantSlug): JsonResponse
    {
        $this->authorize('update-branding', $tenantSlug);

        $command = new UpdateTenantBrandingCommand(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            brandingData: $request->validated(),
            updatedBy: UserId::fromString($request->user()->id),
            sourceIp: $request->ip(),
            userAgent: $request->userAgent(),
            forceUpdate: $request->boolean('force', false)
        );

        try {
            $result = $this->commandBus->handle($command);

            return response()->json([
                'success' => true,
                'branding' => $result->branding,
                'compliance_check' => $result->complianceReport,
                'warnings' => $result->warnings,
                'version' => $result->newVersion,
                'css_updated' => $result->cssUpdated,
                'assets_optimized' => $result->assetsOptimized,
            ], 200, [
                'X-Branding-Version' => $result->newVersion,
                'X-CSS-Cache-Invalidated' => $result->cssUpdated ? 'true' : 'false',
            ]);

        } catch (WcagComplianceException $e) {
            return response()->json([
                'success' => false,
                'error' => 'WCAG compliance violation',
                'violations' => $e->getViolations(),
                'fix_suggestions' => $e->getFixSuggestions(),
                'compliance_score' => $e->getComplianceScore(),
                'required_level' => 'AA',
            ], 422, [
                'X-Compliance-Failed' => 'true',
                'X-Violation-Count' => count($e->getViolations()),
            ]);
        }
    }

    /**
     * POST /api/platform/branding/{tenantSlug}/admin/compliance-override
     * Administrative override for compliance violations (requires special permission)
     */
    public function overrideCompliance(
        BrandingComplianceOverrideRequest $request,
        string $tenantSlug
    ): JsonResponse {
        $this->authorize('override-branding-compliance', $tenantSlug);

        $command = new OverrideComplianceCommand(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            justification: $request->validated('justification'),
            overriddenBy: UserId::fromString($request->user()->id),
            validUntil: $request->date('valid_until'),
            referenceNumber: $request->validated('reference_number'),
            sourceIp: $request->ip(),
            userAgent: $request->userAgent()
        );

        $result = $this->commandBus->handle($command);

        return response()->json([
            'success' => true,
            'override_id' => $result->overrideId,
            'valid_until' => $result->validUntil->toISOString(),
            'audit_log_id' => $result->auditLogId,
            'compliance_status' => 'OVERRIDDEN',
            'warning' => 'This override is logged and will be reviewed quarterly.',
        ], 200, [
            'X-Compliance-Override' => 'true',
            'X-Override-ID' => $result->overrideId,
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/admin/export
     * Export branding configuration for compliance audits
     */
    public function export(string $tenantSlug): Response
    {
        $this->authorize('export-branding', $tenantSlug);

        $query = new ExportBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            format: $request->query('format', 'json'),
            includeHistory: $request->boolean('include_history', true),
            includeCompliance: $request->boolean('include_compliance', true),
            includeAssets: $request->boolean('include_assets', false)
        );

        $export = $this->queryBus->handle($query);

        return response($export->content, 200, [
            'Content-Type' => $export->contentType,
            'Content-Disposition' => 'attachment; filename="' . $export->filename . '"',
            'X-Export-Version' => '1.0',
            'X-Compliance-Audit' => 'true',
        ]);
    }
}
```

### **3. MOBILE API (ANGULAR APP - OPTIMIZED)**

**Target**: Angular/Ionic mobile app with stateless authentication and optimized payloads.

```php
// Platform/Infrastructure/Http/Controllers/TenantBrandingMobileController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

use App\Contexts\Platform\Application\Queries\GetMobileBrandingQuery;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\MobilePlatform;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class TenantBrandingMobileController extends Controller
{
    /**
     * Middleware configuration
     */
    public function __construct()
    {
        // Stateless Sanctum tokens for mobile
        $this->middleware(['auth:sanctum']);

        // Higher rate limits for mobile (more users)
        $this->middleware('throttle:120,1')->only(['show', 'css']);

        // CORS for mobile app domains
        $this->middleware('cors:mobile');

        // Mobile-specific content negotiation
        $this->middleware('negotiate:mobile');
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/mobile
     * Mobile-optimized payload with touch-focused features
     */
    public function show(Request $request, string $tenantSlug): JsonResponse
    {
        $platform = MobilePlatform::fromUserAgent($request->header('User-Agent'));
        $connectionType = $this->detectConnectionType($request);

        $query = new GetMobileBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            platform: $platform,
            connectionType: $connectionType,
            devicePixelRatio: $request->header('X-Device-Pixel-Ratio', 2.0),
            screenWidth: $request->header('X-Screen-Width', 375),
            includeTouchTargets: true,
            includeAccessibility: true,
            optimizeForConnection: true,
            reducePayload: true
        );

        $result = $this->queryBus->handle($query);

        // Mobile-optimized response structure
        return response()->json([
            // Core identity
            'organization' => [
                'name' => $result->organizationName,
                'logo' => $result->optimizedLogoUrl,
                'favicon' => $result->faviconUrl,
            ],

            // Visual design (optimized)
            'design' => [
                'colors' => [
                    'primary' => $result->primaryColor,
                    'secondary' => $result->secondaryColor,
                    'background' => $result->backgroundColor,
                    'text' => $result->textColor,
                    'accent' => $result->accentColor,
                ],
                'typography' => [
                    'font_family' => $result->fontFamily,
                    'font_size' => $result->fontSize,
                    'line_height' => $result->lineHeight,
                    'letter_spacing' => $result->letterSpacing,
                ],
            ],

            // Mobile-specific optimizations
            'mobile' => [
                'touch_targets' => [
                    'button_height' => '44dp',
                    'button_min_width' => '44dp',
                    'link_spacing' => '8dp',
                ],
                'gestures' => [
                    'swipe_threshold' => '50dp',
                    'tap_target_size' => '48dp',
                ],
                'animations' => [
                    'duration' => '300ms',
                    'easing' => 'cubic-bezier(0.4, 0, 0.2, 1)',
                    'prefers_reduced_motion' => $result->prefersReducedMotion,
                ],
            ],

            // Accessibility features
            'accessibility' => [
                'contrast_ratio' => $result->contrastRatio,
                'font_scale' => $result->fontScale,
                'supports_voiceover' => $result->supportsVoiceOver,
                'supports_talkback' => $result->supportsTalkBack,
            ],

            // Performance hints
            'performance' => [
                'cache_key' => $result->cacheKey,
                'cache_ttl' => 3600, // 1 hour for mobile
                'payload_size' => strlen(json_encode($result)),
                'optimized_for' => $connectionType,
            ],

            // Metadata
            'meta' => [
                'version' => $result->version,
                'updated_at' => $result->updatedAt,
                'compliance_level' => $result->complianceLevel,
                'country_specific' => $result->countrySpecific,
            ],

        ], 200, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'public, max-age=3600, stale-while-revalidate=86400',
            'X-Mobile-Optimized' => 'true',
            'X-Connection-Type' => $connectionType,
            'X-Platform' => $platform->toString(),
            'X-Payload-Size' => strlen(json_encode($result)),
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/mobile/css
     * Mobile-optimized CSS with touch considerations
     */
    public function css(Request $request, string $tenantSlug): Response
    {
        $platform = MobilePlatform::fromUserAgent($request->header('User-Agent'));

        $query = new GetMobileCssQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            platform: $platform,
            minify: $request->query('minify', 'true') === 'true',
            includeTouchStyles: true,
            includeAccessibility: true,
            includePlatformSpecific: true
        );

        $css = $this->queryBus->handle($query);

        return response($css, 200, [
            'Content-Type' => 'text/css',
            'Cache-Control' => 'public, max-age=86400, stale-while-revalidate=604800',
            'CDN-Cache-Control' => 'public, max-age=31536000', // 1 year
            'Vary' => 'User-Agent, Accept-Encoding',
            'X-CSS-Optimized' => 'true',
            'X-Platform' => $platform->toString(),
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/mobile/manifest
     * PWA manifest with branding
     */
    public function manifest(string $tenantSlug): JsonResponse
    {
        $query = new GetPwaManifestQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug)
        );

        $manifest = $this->queryBus->handle($query);

        return response()->json($manifest, 200, [
            'Content-Type' => 'application/manifest+json',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/mobile/health
     * Lightweight health check for mobile app
     */
    public function health(string $tenantSlug): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'tenant' => $tenantSlug,
            'branding_version' => $this->getBrandingVersion($tenantSlug),
            'cache_status' => 'operational',
        ], 200, [
            'Cache-Control' => 'no-cache',
            'X-Health-Check' => 'true',
        ]);
    }

    private function detectConnectionType(Request $request): string
    {
        $networkInfo = $request->header('X-Network-Info', '');
        $effectiveType = $request->header('X-Effective-Connection-Type', '');

        // Use Network Information API if available
        if ($effectiveType) {
            return strtolower($effectiveType);
        }

        // Fallback detection
        if (str_contains($networkInfo, '2g') || str_contains($networkInfo, 'slow')) {
            return '2g';
        }

        if (str_contains($networkInfo, '3g')) {
            return '3g';
        }

        if (str_contains($networkInfo, '4g') || str_contains($networkInfo, 'lte')) {
            return '4g';
        }

        return '4g'; // Default assumption
    }
}
```

### **4. PUBLIC API (LOGIN PAGES - NO AUTHENTICATION)**

**Target**: Public-facing login pages that need branding without authentication.

```php
// Platform/Infrastructure/Http/Controllers/TenantBrandingPublicController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

use App\Contexts\Platform\Application\Queries\GetPublicBrandingQuery;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class TenantBrandingPublicController extends Controller
{
    /**
     * Middleware configuration
     */
    public function __construct()
    {
        // No authentication required
        // Higher rate limits for public endpoints
        $this->middleware('throttle:300,1');

        // CORS for all origins (login pages can be embedded)
        $this->middleware('cors:public');

        // Security headers for public content
        $this->middleware('headers:public');
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/public
     * Public API for login pages (highly cached, no auth)
     */
    public function show(string $tenantSlug): JsonResponse
    {
        $query = new GetPublicBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            includeAccessibilityStatement: true,
            includeLegalRequirements: false,
            includeComplianceLevel: true
        );

        $result = $this->queryBus->handle($query);

        // Public response (limited information)
        return response()->json([
            'organization' => [
                'name' => $result->organizationName,
                'logo_url' => $result->logoUrl,
                'favicon_url' => $result->faviconUrl,
            ],
            'design' => [
                'primary_color' => $result->primaryColor,
                'background_color' => $result->backgroundColor,
                'font_family' => $result->fontFamily,
            ],
            'content' => [
                'welcome_message' => $result->welcomeMessage,
                'tagline' => $result->tagline,
            ],
            'accessibility' => [
                'statement' => $result->accessibilityStatement,
                'compliance_level' => $result->complianceLevel,
                'contrast_ratio' => $result->contrastRatio,
            ],
            'meta' => [
                'last_updated' => $result->updatedAt,
                'version' => $result->version,
                'country' => $result->country,
            ],
        ], 200, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'public, max-age=604800, stale-while-revalidate=2592000',
            'CDN-Cache-Control' => 'public, max-age=31536000', // 1 year
            'Vary' => 'Accept-Encoding',
            'X-Public-API' => 'true',
            'X-Tenant-Slug' => $tenantSlug,
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/public/css
     * Public CSS with aggressive caching
     */
    public function css(string $tenantSlug): Response
    {
        $query = new GetPublicCssQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            minify: true,
            includeBaseStyles: true,
            includeVariablesOnly: false
        );

        $css = $this->queryBus->handle($query);

        return response($css, 200, [
            'Content-Type' => 'text/css',
            'Cache-Control' => 'public, max-age=604800, immutable',
            'CDN-Cache-Control' => 'public, max-age=31536000', // 1 year
            'Vary' => 'Accept-Encoding',
            'X-CSS-Public' => 'true',
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/public/logo
     * Direct logo access with redirect to CDN
     */
    public function logo(string $tenantSlug): Response
    {
        $query = new GetPublicLogoQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            size: request()->query('size', 'medium'),
            format: request()->query('format', 'webp')
        );

        $logoUrl = $this->queryBus->handle($query);

        // 302 redirect to CDN
        return redirect()->away($logoUrl, 302, [
            'Cache-Control' => 'public, max-age=86400',
            'CDN-Cache-Control' => 'public, max-age=31536000',
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/public/health
     * Public health check (for monitoring)
     */
    public function health(string $tenantSlug): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'tenant' => $tenantSlug,
            'timestamp' => now()->toISOString(),
            'service' => 'branding-public-api',
            'uptime' => $this->getUptime(),
        ], 200, [
            'Cache-Control' => 'no-cache',
            'X-Public-Health' => 'true',
        ]);
    }

    /**
     * OPTIONS /api/platform/branding/{tenantSlug}/public/*
     * CORS preflight for public endpoints
     */
    public function options(string $tenantSlug): Response
    {
        return response(null, 200, [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Accept',
            'Access-Control-Max-Age' => '86400',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
```

### **5. API VERSIONING STRATEGY**

**Problem**: No versioning leads to breaking changes for clients.

**Solution**: Semantic versioning with backward compatibility:

```php
// Platform/Infrastructure/Http/Routes/api.php
<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

// Version 1 (current)
Route::prefix('v1')->group(function () {
    // Admin API
    Route::prefix('branding/{tenantSlug}/admin')->group(function () {
        Route::get('/', [TenantBrandingAdminController::class, 'show']);
        Route::post('/', [TenantBrandingAdminController::class, 'store']);
        Route::put('/', [TenantBrandingAdminController::class, 'update']);
        Route::post('/compliance-override', [TenantBrandingAdminController::class, 'overrideCompliance']);
        Route::get('/export', [TenantBrandingAdminController::class, 'export']);
    });

    // Mobile API
    Route::prefix('branding/{tenantSlug}/mobile')->group(function () {
        Route::get('/', [TenantBrandingMobileController::class, 'show']);
        Route::get('/css', [TenantBrandingMobileController::class, 'css']);
        Route::get('/manifest', [TenantBrandingMobileController::class, 'manifest']);
        Route::get('/health', [TenantBrandingMobileController::class, 'health']);
    });

    // Public API
    Route::prefix('branding/{tenantSlug}/public')->group(function () {
        Route::get('/', [TenantBrandingPublicController::class, 'show']);
        Route::get('/css', [TenantBrandingPublicController::class, 'css']);
        Route::get('/logo', [TenantBrandingPublicController::class, 'logo']);
        Route::get('/health', [TenantBrandingPublicController::class, 'health']);
        Route::options('/{any}', [TenantBrandingPublicController::class, 'options'])->where('any', '.*');
    });
});

// Version 2 (future - maintain both)
Route::prefix('v2')->group(function () {
    Route::prefix('branding/{tenantSlug}')->group(function () {
        // V2 endpoints with improved structure
    });
})->middleware(['api.version:v2']);
```

### **6. API SECURITY MIDDLEWARE**

```php
// Platform/Infrastructure/Http/Middleware/ApiClientValidation.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiClientValidation
{
    private const ALLOWED_CLIENTS = [
        'vue-desktop' => [
            'allowed_endpoints' => ['/api/platform/branding/{tenant}/admin'],
            'required_scopes' => ['branding.read', 'branding.write'],
            'rate_limit' => '60,1',
            'user_agent_pattern' => '/Mozilla.*Vue/',
        ],
        'angular-mobile' => [
            'allowed_endpoints' => ['/api/platform/branding/{tenant}/mobile'],
            'required_scopes' => ['branding.read'],
            'rate_limit' => '120,1',
            'user_agent_pattern' => '/Angular.*Ionic/',
        ],
        'public-client' => [
            'allowed_endpoints' => ['/api/platform/branding/{tenant}/public'],
            'required_scopes' => [],
            'rate_limit' => '300,1',
            'user_agent_pattern' => '/.*/',
        ],
    ];

    public function handle(Request $request, Closure $next, string $clientType): Response
    {
        $clientConfig = self::ALLOWED_CLIENTS[$clientType] ?? null;

        if (!$clientConfig) {
            abort(400, 'Invalid client type');
        }

        // Validate User-Agent
        if (!preg_match($clientConfig['user_agent_pattern'], $request->userAgent())) {
            abort(403, 'Client not allowed for this endpoint');
        }

        // Validate endpoint access
        if (!$this->isEndpointAllowed($request, $clientConfig['allowed_endpoints'])) {
            abort(403, 'Endpoint not allowed for this client');
        }

        // Validate scopes (for authenticated endpoints)
        if (!empty($clientConfig['required_scopes']) && $request->user()) {
            $this->validateScopes($request, $clientConfig['required_scopes']);
        }

        // Apply client-specific rate limiting
        $request->attributes->set('client_rate_limit', $clientConfig['rate_limit']);

        return $next($request);
    }

    private function isEndpointAllowed(Request $request, array $allowedEndpoints): bool
    {
        $currentPath = $request->path();

        foreach ($allowedEndpoints as $pattern) {
            $regex = $this->convertPatternToRegex($pattern);
            if (preg_match($regex, $currentPath)) {
                return true;
            }
        }

        return false;
    }

    private function convertPatternToRegex(string $pattern): string
    {
        $regex = preg_quote($pattern, '/');
        $regex = str_replace('\{tenant\}', '[^\/]+', $regex);
        $regex = str_replace('\{any\}', '.*', $regex);

        return '/^' . $regex . '$/';
    }

    private function validateScopes(Request $request, array $requiredScopes): void
    {
        $userScopes = $request->user()->token()->scopes ?? [];

        foreach ($requiredScopes as $scope) {
            if (!in_array($scope, $userScopes)) {
                abort(403, "Missing required scope: {$scope}");
            }
        }
    }
}
```

## **📋 MULTI-CLIENT API IMPLEMENTATION CHECKLIST**

### **Phase 1: Foundation (Week 1)**
- [ ] **Three-tier API architecture** (Admin/Mobile/Public)
- [ ] **Client-specific middleware** (authentication, rate limiting, CORS)
- [ ] **API versioning strategy** with semantic versioning
- [ ] **Route organization** by client type

### **Phase 2: Security (Week 2)**
- [ ] **Client validation middleware** (User-Agent, scopes, endpoints)
- [ ] **Rate limiting per client** (Admin: 60/min, Mobile: 120/min, Public: 300/min)
- [ ] **Scope-based authorization** for all endpoints
- [ ] **CORS configuration** per client type

### **Phase 3: Optimization (Week 3)**
- [ ] **Mobile-optimized payloads** with connection-aware compression
- [ ] **Public API caching** (1 year CDN, 1 week browser)
- [ ] **Admin API feature flags** for gradual rollout
- [ ] **API documentation** (OpenAPI/Swagger per client)

### **Phase 4: Monitoring (Week 4)**
- [ ] **API usage analytics** per client type
- [ ] **Performance monitoring** (latency, error rates, cache hits)
- [ ] **Client-specific alerts** (mobile app outages, public API abuse)
- [ ] **Deprecation notices** for API version transitions

## **🚨 CRITICAL API METRICS**

| Metric | Admin API | Mobile API | Public API |
|--------|-----------|------------|------------|
| Response Time (p95) | < 500ms | < 300ms | < 200ms |
| Error Rate | < 0.1% | < 0.5% | < 0.01% |
| Cache Hit Rate | > 70% | > 90% | > 99% |
| Rate Limit Hits | < 10/day | < 100/day | < 1000/day |
| Uptime | 99.9% | 99.99% | 99.999% |

## **🎯 IMMEDIATE ACTION ITEMS**

1. **Implement three-tier API controllers** with client-specific logic
2. **Configure middleware stack** per client type (auth, rate limiting, CORS)
3. **Set up API versioning** with backward compatibility guarantees
4. **Create client validation middleware** to prevent API misuse
5. **Implement connection-aware compression** for mobile API
6. **Configure aggressive caching** for public API endpoints
7. **Set up API monitoring** with client-specific dashboards
8. **Create API documentation** for each client type
9. **Implement deprecation strategy** for future API changes
10. **Set up canary deployment** for API updates

> **Architect's Note**: Multi-client APIs require strict isolation. Vue Desktop admins need full control, Angular mobile needs performance, and public login pages need maximum availability. This architecture ensures each client gets exactly what they need while maintaining security and performance.