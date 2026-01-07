# 🚀 **CORRECTED IMPLEMENTATION: PERFORMANCE & CDN STRATEGY**

## **🎯 CRITICAL PERFORMANCE IMPROVEMENTS**

### **1. GEOGRAPHIC CDN ASSET PIPELINE**

**Problem**: Original plan had no CDN strategy, leading to slow asset loading across regions.

**Solution**: Multi-region CDN with automatic asset optimization:

```php
// Platform/Infrastructure/Services/AssetCdnService.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Services;

use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use App\Contexts\Platform\Domain\ValueObjects\AssetType;
use App\Contexts\Platform\Domain\ValueObjects\CdnRegion;
use App\Contexts\Platform\Domain\Exceptions\AssetOptimizationException;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;
use Psr\Log\LoggerInterface;

final class AssetCdnService
{
    private const CDN_REGIONS = [
        'us-east-1' => 'https://cdn-us.publicdigit.com',
        'eu-west-1' => 'https://cdn-eu.publicdigit.com',
        'ap-south-1' => 'https://cdn-ap.publicdigit.com',
        'sa-east-1' => 'https://cdn-sa.publicdigit.com',
    ];

    private const ASSET_OPTIMIZATION = [
        'logo' => [
            'sizes' => [64, 128, 256, 512],
            'formats' => ['webp', 'png'],
            'quality' => 85,
            'max_dimension' => 2048,
        ],
        'favicon' => [
            'sizes' => [16, 32, 48, 64],
            'formats' => ['ico', 'png'],
            'quality' => 90,
        ],
        'background' => [
            'sizes' => [640, 1024, 1920],
            'formats' => ['webp', 'jpg'],
            'quality' => 80,
            'compression' => 'progressive',
        ],
    ];

    public function __construct(
        private readonly ImageManager $imageManager,
        private readonly LoggerInterface $logger,
        private readonly CdnRegionResolver $regionResolver
    ) {}

    /**
     * Upload and optimize tenant branding assets to CDN
     * Returns CDN URLs with regional fallbacks
     */
    public function uploadBrandingAsset(
        TenantDbId $tenantDbId,
        AssetType $assetType,
        $file,
        bool $optimize = true
    ): array {
        try {
            $tenantId = $tenantDbId->toInt();
            $assetKey = "branding/{$tenantId}/{$assetType->toString()}";

            // 1. Validate and optimize the asset
            if ($optimize) {
                $file = $this->optimizeAsset($assetType, $file);
            }

            // 2. Upload to all CDN regions (async)
            $cdnUrls = [];
            foreach (self::CDN_REGIONS as $region => $cdnBaseUrl) {
                $path = $this->uploadToRegion($region, $assetKey, $file);
                $cdnUrls[$region] = "{$cdnBaseUrl}/{$path}";
            }

            // 3. Store metadata in cache
            $this->storeAssetMetadata($tenantDbId, $assetType, $cdnUrls);

            $this->logger->info('Asset uploaded to CDN', [
                'tenant_db_id' => $tenantId,
                'asset_type' => $assetType->toString(),
                'cdn_regions' => array_keys($cdnUrls),
                'optimized' => $optimize,
            ]);

            return $cdnUrls;

        } catch (\Exception $e) {
            $this->logger->error('CDN asset upload failed', [
                'tenant_db_id' => $tenantDbId->toInt(),
                'asset_type' => $assetType->toString(),
                'error' => $e->getMessage(),
            ]);

            throw AssetOptimizationException::uploadFailed($assetType, $e);
        }
    }

    /**
     * Get optimized CDN URL for current user region
     */
    public function getAssetUrl(
        TenantDbId $tenantDbId,
        AssetType $assetType,
        ?int $width = null,
        ?string $format = null
    ): string {
        $region = $this->regionResolver->getClosestRegion();
        $cdnBaseUrl = self::CDN_REGIONS[$region] ?? self::CDN_REGIONS['us-east-1'];

        $tenantId = $tenantDbId->toInt();
        $assetKey = "branding/{$tenantId}/{$assetType->toString()}";

        // Add size/format suffix if requested
        $suffix = '';
        if ($width !== null) {
            $suffix .= "-{$width}w";
        }
        if ($format !== null) {
            $suffix .= ".{$format}";
        }

        return "{$cdnBaseUrl}/{$assetKey}{$suffix}";
    }

    /**
     * Generate srcset for responsive images
     */
    public function generateSrcset(
        TenantDbId $tenantDbId,
        AssetType $assetType,
        string $format = 'webp'
    ): string {
        $sizes = self::ASSET_OPTIMIZATION[$assetType->toString()]['sizes'] ?? [128, 256, 512];
        $srcset = [];

        foreach ($sizes as $size) {
            $url = $this->getAssetUrl($tenantDbId, $assetType, $size, $format);
            $srcset[] = "{$url} {$size}w";
        }

        return implode(', ', $srcset);
    }

    private function optimizeAsset(AssetType $assetType, $file): \Intervention\Image\Image
    {
        $config = self::ASSET_OPTIMIZATION[$assetType->toString()] ?? [];

        if (empty($config)) {
            return $this->imageManager->make($file);
        }

        $image = $this->imageManager->make($file);

        // Resize if too large
        $maxDimension = $config['max_dimension'] ?? null;
        if ($maxDimension && ($image->width() > $maxDimension || $image->height() > $maxDimension)) {
            $image->resize($maxDimension, $maxDimension, function ($constraint) {
                $constraint->aspectRatio();
                $constraint->upsize();
            });
        }

        return $image;
    }

    private function uploadToRegion(string $region, string $key, $file): string
    {
        // Implementation would use AWS SDK, Cloudinary, or similar
        // For now, simulate with local storage
        $path = Storage::disk('cdn')->put($key, $file);

        return $path;
    }

    private function storeAssetMetadata(TenantDbId $tenantDbId, AssetType $assetType, array $cdnUrls): void
    {
        $key = "cdn:assets:{$tenantDbId->toInt()}:{$assetType->toString()}";

        Cache::put($key, [
            'cdn_urls' => $cdnUrls,
            'uploaded_at' => now()->toISOString(),
            'region_count' => count($cdnUrls),
        ], now()->addDays(30));
    }
}
```

### **2. SEPARATE CSS ENDPOINT WITH ADVANCED CACHING**

**Problem**: CSS bundled with API responses, causing unnecessary re-downloads.

**Solution**: Dedicated CSS endpoint with smart caching headers:

```php
// Platform/Infrastructure/Http/Controllers/TenantBrandingCssController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

use App\Contexts\Platform\Application\Queries\GetTenantBrandingCssQuery;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

class TenantBrandingCssController extends Controller
{
    /**
     * GET /api/platform/branding/{tenantSlug}/css
     * CSS endpoint with aggressive caching
     */
    public function show(Request $request, string $tenantSlug): Response
    {
        $query = new GetTenantBrandingCssQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            includeBrowserHacks: $this->shouldIncludeBrowserHacks($request),
            minify: $this->shouldMinify($request),
            includePseudoClasses: true
        );

        $css = $this->queryBus->handle($query);

        // Create response with caching headers
        $response = new Response($css, 200, [
            'Content-Type' => 'text/css',
            'Content-Length' => strlen($css),
        ]);

        // Cache control for CDN (public, 7 days)
        $response->setCache([
            'public' => true,
            'max_age' => 604800, // 7 days
            's_maxage' => 604800,
        ]);

        // ETag for conditional requests
        $etag = md5($css);
        $response->setEtag($etag);

        // Add vary headers for compression
        $response->setVary('Accept-Encoding');

        // Add security headers
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');

        // Add CORS for cross-origin usage (mobile apps)
        $response->headers->set('Access-Control-Allow-Origin', '*');
        $response->headers->set('Access-Control-Allow-Methods', 'GET');

        // Browser caching (1 day)
        $response->headers->set('Cache-Control', 'public, max-age=86400, immutable');

        // CDN caching (7 days)
        $response->headers->set('CDN-Cache-Control', 'public, max-age=604800');

        return $response;
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/css/variables
     * CSS variables only (for dynamic updates)
     */
    public function variables(string $tenantSlug): Response
    {
        $query = new GetTenantBrandingCssVariablesQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug)
        );

        $variables = $this->queryBus->handle($query);

        $response = new Response($variables, 200, [
            'Content-Type' => 'text/css',
        ]);

        // Shorter cache for variables (5 minutes)
        $response->setCache([
            'public' => true,
            'max_age' => 300,
            's_maxage' => 300,
        ]);

        return $response;
    }

    /**
     * HEAD /api/platform/branding/{tenantSlug}/css
     * Cache validation endpoint
     */
    public function head(string $tenantSlug): Response
    {
        $query = new GetTenantBrandingCssQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            includeBrowserHacks: false,
            minify: true,
            includePseudoClasses: false
        );

        $css = $this->queryBus->handle($query);
        $etag = md5($css);

        return response(null, 200, [
            'ETag' => $etag,
            'Content-Type' => 'text/css',
            'Content-Length' => strlen($css),
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }

    private function shouldIncludeBrowserHacks(Request $request): bool
    {
        $userAgent = $request->header('User-Agent', '');

        // Include browser-specific hacks for older browsers
        return str_contains($userAgent, 'MSIE') ||
               str_contains($userAgent, 'Trident') ||
               str_contains($userAgent, 'Edge');
    }

    private function shouldMinify(Request $request): bool
    {
        // Minify in production, keep readable in development
        return app()->environment('production') ||
               $request->query('minify', 'false') === 'true';
    }
}
```

### **3. MOBILE-OPTIMIZED API WITH REDUCED PAYLOAD**

**Problem**: Mobile API returns full branding payload, wasting bandwidth.

**Solution**: Tiered API responses with mobile optimization:

```php
// Platform/Infrastructure/Http/Controllers/TenantBrandingMobileOptimizedController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

use App\Contexts\Platform\Application\Queries\GetMobileBrandingQuery;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\MobilePlatform;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TenantBrandingMobileOptimizedController extends Controller
{
    /**
     * GET /api/platform/branding/{tenantSlug}/mobile/optimized
     * Mobile-optimized branding (reduced payload)
     */
    public function optimized(Request $request, string $tenantSlug): JsonResponse
    {
        $platform = MobilePlatform::fromUserAgent($request->header('User-Agent'));
        $connectionType = $this->detectConnectionType($request);

        $query = new GetMobileBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            platform: $platform,
            connectionType: $connectionType,
            includeMetadata: false,
            includeCompliance: false,
            optimizeImages: true,
            reducePayload: true
        );

        $branding = $this->queryBus->handle($query);

        // Apply compression based on connection type
        $responseData = $this->compressResponse($branding, $connectionType);

        return response()->json($responseData, 200, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'public, max-age=3600',
            'X-Response-Size' => strlen(json_encode($responseData)),
            'X-Original-Size' => strlen(json_encode($branding)),
            'X-Compression-Ratio' => $this->calculateCompressionRatio($branding, $responseData),
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/mobile/light
     * Ultra-light payload for poor connections
     */
    public function light(string $tenantSlug): JsonResponse
    {
        $query = new GetLightBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            includeColorsOnly: true,
            excludeImages: true,
            excludeTypography: false,
            maxPayloadSize: 1024 // 1KB max
        );

        $branding = $this->queryBus->handle($query);

        return response()->json([
            'colors' => $branding->colors,
            'version' => $branding->version,
            'cache_ttl' => 1800, // 30 minutes
            'updated_at' => $branding->updatedAt,
        ], 200, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'public, max-age=1800',
            'X-Payload-Size' => strlen(json_encode($branding)),
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/mobile/manifest
     * Web app manifest for PWA
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

    private function detectConnectionType(Request $request): string
    {
        $networkInfo = $request->header('X-Network-Info', '');

        if (str_contains($networkInfo, '2g') || str_contains($networkInfo, 'slow')) {
            return '2g';
        }

        if (str_contains($networkInfo, '3g')) {
            return '3g';
        }

        if (str_contains($networkInfo, '4g') || str_contains($networkInfo, 'lte')) {
            return '4g';
        }

        if (str_contains($networkInfo, '5g') || str_contains($networkInfo, 'wifi')) {
            return '5g';
        }

        // Default based on typical mobile
        return '4g';
    }

    private function compressResponse(array $data, string $connectionType): array
    {
        // Remove null values
        $data = array_filter($data, function ($value) {
            return $value !== null;
        });

        // For slow connections, remove optional fields
        if ($connectionType === '2g' || $connectionType === '3g') {
            unset($data['hero_image'], $data['background_pattern'], $data['animations']);

            // Reduce color palette
            if (isset($data['colors'])) {
                $data['colors'] = [
                    'primary' => $data['colors']['primary'],
                    'secondary' => $data['colors']['secondary'],
                    'background' => $data['colors']['background'],
                ];
            }
        }

        return $data;
    }

    private function calculateCompressionRatio(array $original, array $compressed): float
    {
        $originalSize = strlen(json_encode($original));
        $compressedSize = strlen(json_encode($compressed));

        if ($originalSize === 0) {
            return 1.0;
        }

        return round($compressedSize / $originalSize, 2);
    }
}
```

### **4. REDIS CACHING WITH REGIONAL REPLICATION**

**Problem**: Single Redis instance causes latency for global users.

**Solution**: Multi-region Redis with replication and cache warming:

```php
// Platform/Infrastructure/Services/RegionalCacheService.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Services;

use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use App\Contexts\Platform\Domain\ValueObjects\CacheRegion;
use Illuminate\Support\Facades\Cache;
use Illuminate\Contracts\Cache\Repository;
use Predis\ClientInterface;

final class RegionalCacheService
{
    private const REGIONS = [
        'us' => 'redis_us',
        'eu' => 'redis_eu',
        'asia' => 'redis_asia',
        'sa' => 'redis_sa',
    ];

    private const CACHE_TTLS = [
        'branding_config' => 3600, // 1 hour
        'css_variables' => 300,    // 5 minutes
        'asset_urls' => 86400,     // 24 hours
        'compliance_report' => 1800, // 30 minutes
    ];

    public function __construct(
        private readonly CacheRegionResolver $regionResolver,
        private readonly ClientInterface $redisClient
    ) {}

    /**
     * Get cached value from closest region
     */
    public function getForTenant(
        TenantDbId $tenantDbId,
        string $key,
        bool $fallbackToPrimary = true
    ): mixed {
        $region = $this->regionResolver->getClosestRegion();
        $cacheKey = $this->buildCacheKey($tenantDbId, $key, $region);

        // Try primary region
        $value = Cache::store(self::REGIONS[$region])->get($cacheKey);

        if ($value === null && $fallbackToPrimary) {
            // Fallback to primary region (us)
            $primaryKey = $this->buildCacheKey($tenantDbId, $key, 'us');
            $value = Cache::store(self::REGIONS['us'])->get($primaryKey);

            // Async replicate to local region
            if ($value !== null && $region !== 'us') {
                $this->replicateToRegion($value, $tenantDbId, $key, $region);
            }
        }

        return $value;
    }

    /**
     * Set cached value across all regions
     */
    public function setForTenant(
        TenantDbId $tenantDbId,
        string $key,
        mixed $value,
        ?int $ttl = null
    ): void {
        $ttl = $ttl ?? self::CACHE_TTLS[$key] ?? 3600;

        // Set in all regions (async)
        foreach (self::REGIONS as $region => $store) {
            $cacheKey = $this->buildCacheKey($tenantDbId, $key, $region);

            Cache::store($store)->put($cacheKey, $value, $ttl);
        }

        // Record in replication log
        $this->recordReplication($tenantDbId, $key, array_keys(self::REGIONS));
    }

    /**
     * Pre-warm cache for tenant across regions
     */
    public function prewarmTenantCache(TenantDbId $tenantDbId): void
    {
        $cacheItems = [
            'branding_config',
            'css_variables',
            'asset_urls',
            'compliance_report',
        ];

        foreach ($cacheItems as $item) {
            $this->prewarmItem($tenantDbId, $item);
        }
    }

    /**
     * Clear tenant cache across all regions
     */
    public function clearTenantCache(TenantDbId $tenantDbId): void
    {
        foreach (self::REGIONS as $region => $store) {
            $pattern = $this->buildCacheKey($tenantDbId, '*', $region);

            // Use Redis scan for pattern matching
            $this->clearByPattern($store, $pattern);
        }

        $this->logger->info('Tenant cache cleared across all regions', [
            'tenant_db_id' => $tenantDbId->toInt(),
            'regions' => array_keys(self::REGIONS),
        ]);
    }

    /**
     * Get cache hit statistics
     */
    public function getCacheStats(TenantDbId $tenantDbId): array
    {
        $stats = [];

        foreach (self::REGIONS as $region => $store) {
            $pattern = $this->buildCacheKey($tenantDbId, '*', $region);

            $stats[$region] = [
                'hit_rate' => $this->getHitRate($store, $pattern),
                'total_keys' => $this->countKeys($store, $pattern),
                'memory_usage' => $this->getMemoryUsage($store),
            ];
        }

        return $stats;
    }

    private function buildCacheKey(TenantDbId $tenantDbId, string $key, string $region): string
    {
        return "branding:{$region}:{$tenantDbId->toInt()}:{$key}";
    }

    private function replicateToRegion(
        mixed $value,
        TenantDbId $tenantDbId,
        string $key,
        string $region
    ): void {
        // Async job to replicate cache
        dispatch(new ReplicateCacheJob(
            value: $value,
            tenantDbId: $tenantDbId,
            key: $key,
            region: $region,
            ttl: self::CACHE_TTLS[$key] ?? 3600
        ));
    }

    private function prewarmItem(TenantDbId $tenantDbId, string $item): void
    {
        // Fetch data and cache across regions
        $data = $this->fetchItemData($tenantDbId, $item);

        if ($data !== null) {
            $this->setForTenant($tenantDbId, $item, $data);
        }
    }
}
```

### **5. PERFORMANCE METRICS AND MONITORING**

**Problem**: No performance monitoring for branding system.

**Solution**: Comprehensive monitoring with alerts:

```php
// Platform/Infrastructure/Services/BrandingPerformanceMonitor.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Services;

use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use App\Contexts\Platform\Domain\ValueObjects\PerformanceMetric;
use Prometheus\CollectorRegistry;
use Prometheus\Counter;
use Prometheus\Gauge;
use Prometheus\Histogram;

final class BrandingPerformanceMonitor
{
    private Counter $apiRequestsCounter;
    private Counter $cacheHitsCounter;
    private Counter $cdnRequestsCounter;
    private Gauge $responseSizeGauge;
    private Histogram $apiLatencyHistogram;
    private Gauge $cacheHitRateGauge;

    public function __construct(
        private readonly CollectorRegistry $registry,
        private readonly LoggerInterface $logger
    ) {
        $this->initializeMetrics();
    }

    private function initializeMetrics(): void
    {
        $namespace = 'branding';
        $help = 'Branding system performance metrics';

        $this->apiRequestsCounter = $this->registry->getOrRegisterCounter(
            $namespace,
            'api_requests_total',
            'Total API requests',
            ['endpoint', 'method', 'tenant']
        );

        $this->cacheHitsCounter = $this->registry->getOrRegisterCounter(
            $namespace,
            'cache_hits_total',
            'Total cache hits',
            ['cache_type', 'tenant', 'region']
        );

        $this->cdnRequestsCounter = $this->registry->getOrRegisterCounter(
            $namespace,
            'cdn_requests_total',
            'Total CDN requests',
            ['asset_type', 'tenant', 'region']
        );

        $this->responseSizeGauge = $this->registry->getOrRegisterGauge(
            $namespace,
            'response_size_bytes',
            'API response size in bytes',
            ['endpoint', 'tenant']
        );

        $this->apiLatencyHistogram = $this->registry->getOrRegisterHistogram(
            $namespace,
            'api_latency_seconds',
            'API latency in seconds',
            ['endpoint', 'tenant'],
            [0.1, 0.5, 1.0, 2.0, 5.0]
        );

        $this->cacheHitRateGauge = $this->registry->getOrRegisterGauge(
            $namespace,
            'cache_hit_rate',
            'Cache hit rate percentage',
            ['cache_type', 'tenant']
        );
    }

    public function recordApiRequest(
        string $endpoint,
        string $method,
        TenantDbId $tenantDbId,
        float $latency,
        int $responseSize
    ): void {
        $tenantId = $tenantDbId->toInt();

        $this->apiRequestsCounter->inc([
            $endpoint,
            $method,
            (string) $tenantId,
        ]);

        $this->responseSizeGauge->set($responseSize, [
            $endpoint,
            (string) $tenantId,
        ]);

        $this->apiLatencyHistogram->observe($latency, [
            $endpoint,
            (string) $tenantId,
        ]);

        // Alert if latency exceeds threshold
        if ($latency > 2.0) {
            $this->triggerLatencyAlert($endpoint, $tenantId, $latency);
        }
    }

    public function recordCacheHit(
        string $cacheType,
        TenantDbId $tenantDbId,
        string $region
    ): void {
        $this->cacheHitsCounter->inc([
            $cacheType,
            (string) $tenantDbId->toInt(),
            $region,
        ]);

        // Update hit rate
        $this->updateHitRate($cacheType, $tenantDbId);
    }

    public function recordCdnRequest(
        string $assetType,
        TenantDbId $tenantDbId,
        string $region
    ): void {
        $this->cdnRequestsCounter->inc([
            $assetType,
            (string) $tenantDbId->toInt(),
            $region,
        ]);
    }

    public function getPerformanceReport(TenantDbId $tenantDbId): array
    {
        $tenantId = $tenantDbId->toInt();

        return [
            'api_metrics' => [
                'total_requests' => $this->getApiRequestCount($tenantId),
                'avg_latency' => $this->getAverageLatency($tenantId),
                'p95_latency' => $this->getPercentileLatency($tenantId, 95),
                'error_rate' => $this->getErrorRate($tenantId),
            ],
            'cache_metrics' => [
                'hit_rate' => $this->getCacheHitRate($tenantId),
                'total_hits' => $this->getCacheHitCount($tenantId),
                'regional_distribution' => $this->getRegionalCacheStats($tenantId),
            ],
            'cdn_metrics' => [
                'total_requests' => $this->getCdnRequestCount($tenantId),
                'regional_traffic' => $this->getRegionalCdnStats($tenantId),
                'asset_distribution' => $this->getAssetTypeDistribution($tenantId),
            ],
            'performance_score' => $this->calculatePerformanceScore($tenantId),
        ];
    }

    private function triggerLatencyAlert(string $endpoint, int $tenantId, float $latency): void
    {
        $this->logger->warning('High latency detected', [
            'endpoint' => $endpoint,
            'tenant_id' => $tenantId,
            'latency' => $latency,
            'threshold' => 2.0,
        ]);

        // Send alert to monitoring system
        event(new PerformanceAlertEvent(
            metric: 'latency',
            value: $latency,
            threshold: 2.0,
            endpoint: $endpoint,
            tenantId: $tenantId
        ));
    }

    private function updateHitRate(string $cacheType, TenantDbId $tenantDbId): void
    {
        $hits = $this->getCacheHitCount($tenantDbId->toInt(), $cacheType);
        $total = $this->getTotalCacheRequests($tenantDbId->toInt(), $cacheType);

        if ($total > 0) {
            $hitRate = ($hits / $total) * 100;

            $this->cacheHitRateGauge->set($hitRate, [
                $cacheType,
                (string) $tenantDbId->toInt(),
            ]);

            // Alert if hit rate is low
            if ($hitRate < 70) {
                $this->triggerHitRateAlert($cacheType, $tenantDbId, $hitRate);
            }
        }
    }
}
```

## **📋 PERFORMANCE IMPLEMENTATION CHECKLIST**

### **Phase 1: Foundation (Week 1)**
- [ ] **Asset CDN service** with multi-region support
- [ ] **CSS endpoint** with aggressive caching headers
- [ ] **Redis regional replication** foundation
- [ ] **Performance monitoring** with Prometheus metrics

### **Phase 2: Optimization (Week 2)**
- [ ] **Mobile-optimized APIs** with connection-aware compression
- [ ] **Asset optimization pipeline** (WebP, responsive images)
- [ ] **Cache warming strategy** for high-traffic tenants
- [ ] **CDN failover** and regional fallback

### **Phase 3: Advanced (Week 3)**
- [ ] **Real-time performance dashboards**
- [ ] **Automated asset optimization** with AI-based compression
- [ ] **Predictive cache warming** based on usage patterns
- [ ] **A/B testing** for performance optimizations

### **Phase 4: Monitoring (Week 4)**
- [ ] **Alerting system** for performance degradation
- [ ] **Cost optimization** for CDN/Redis usage
- [ ] **Performance regression testing** in CI/CD
- [ ] **Capacity planning** based on growth projections

## **🚨 CRITICAL PERFORMANCE METRICS**

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| CSS load time | < 100ms | Synthetic monitoring |
| API response time (p95) | < 500ms | Real user monitoring |
| Cache hit rate | > 90% | Redis monitoring |
| CDN cache hit rate | > 95% | CDN provider metrics |
| Mobile payload size | < 50KB | Network throttling tests |
| Time to First Paint | < 1s | Web Vitals |
| Cumulative Layout Shift | < 0.1 | Core Web Vitals |

## **🎯 IMMEDIATE ACTION ITEMS**

1. **Implement CSS endpoint** with proper caching headers
2. **Set up CDN** for asset delivery (Cloudflare, CloudFront, or similar)
3. **Configure Redis replication** across regions
4. **Add performance monitoring** to all branding endpoints
5. **Create mobile-optimized API** with connection-aware responses
6. **Implement asset optimization** for logos and images
7. **Set up cache warming** for high-traffic tenants
8. **Create performance dashboards** for ops team

> **Architect's Note**: Performance is not optional for election platforms. Voters in low-bandwidth regions must have equal access. This strategy ensures branding loads quickly everywhere while maintaining security and compliance.