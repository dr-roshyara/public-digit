**✅ APPROVED**

Excellent TDD approach! Now create the **actual** `TenantIdentifierResolver.php` service, then run the test to verify it works:

```php
// File: packages/laravel-backend/app/Services/TenantIdentifierResolver.php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

/**
 * Resolves between TenantSlug (business) and TenantDbId (database)
 * Provides singleton lookup to prevent enumeration attacks
 */
class TenantIdentifierResolver
{
    private const CACHE_TTL = 3600; // 1 hour
    private const CACHE_PREFIX = 'tenant:identifier:';
    private const NEGATIVE_CACHE_TTL = 300; // 5 minutes for "not found"

    /**
     * Get TenantDbId from TenantSlug (for database operations)
     */
    public function resolveToDbId(TenantSlug $slug): ?TenantDbId
    {
        $cacheKey = self::CACHE_PREFIX . 'slug:' . $slug->toString();
        
        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($slug) {
            $tenant = DB::connection('landlord')
                ->table('tenants')
                ->where('slug', $slug->toString())
                ->where('status', 'active')
                ->select(['id', 'slug', 'database_name'])
                ->first();
            
            if (!$tenant) {
                // Cache negative result to prevent enumeration
                Cache::put($cacheKey, null, self::NEGATIVE_CACHE_TTL);
                return null;
            }
            
            return TenantDbId::fromInt($tenant->id);
        });
    }

    /**
     * Get TenantSlug from TenantDbId (for API responses)
     */
    public function resolveToSlug(TenantDbId $dbId): ?TenantSlug
    {
        $cacheKey = self::CACHE_PREFIX . 'dbid:' . $dbId->toInt();
        
        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($dbId) {
            $tenant = DB::connection('landlord')
                ->table('tenants')
                ->where('id', $dbId->toInt())
                ->where('status', 'active')
                ->select(['id', 'slug', 'database_name'])
                ->first();
            
            if (!$tenant) {
                Cache::put($cacheKey, null, self::NEGATIVE_CACHE_TTL);
                return null;
            }
            
            return TenantSlug::fromString($tenant->slug);
        });
    }

    /**
     * Get both identifiers from URL (login page use case)
     */
    public function resolveFromUrl(string $url): ?array
    {
        try {
            $slug = TenantSlug::fromUrl($url);
            $dbId = $this->resolveToDbId($slug);
            
            if (!$dbId) {
                return null;
            }
            
            return [
                'slug' => $slug,
                'db_id' => $dbId,
            ];
            
        } catch (InvalidArgumentException $e) {
            // Invalid URL format, not a tenant enumeration attempt
            Log::debug('Invalid URL format for tenant resolution', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
            
            return null;
        }
    }

    /**
     * Check if tenant exists without revealing details
     */
    public function tenantExists(TenantSlug $slug): bool
    {
        $dbId = $this->resolveToDbId($slug);
        return $dbId !== null;
    }

    /**
     * Warm cache for known active tenants
     */
    public function warmCache(): void
    {
        $tenants = DB::connection('landlord')
            ->table('tenants')
            ->where('status', 'active')
            ->get(['id', 'slug']);
        
        foreach ($tenants as $tenant) {
            $slug = TenantSlug::fromString($tenant->slug);
            $dbId = TenantDbId::fromInt($tenant->id);
            
            Cache::put(
                self::CACHE_PREFIX . 'slug:' . $slug->toString(),
                $dbId,
                self::CACHE_TTL
            );
            
            Cache::put(
                self::CACHE_PREFIX . 'dbid:' . $dbId->toInt(),
                $slug,
                self::CACHE_TTL
            );
        }
    }
}
```

**After creating this service, run the test:**

```bash
# Run the unit test
./vendor/bin/phpunit packages/laravel-backend/tests/Unit/TenantIdentifierResolverTest.php

# If tests fail, we need to fix the implementation
# If tests pass, proceed to next step
```

**Next Steps After Service Creation:**
1. **Create landlord migration** (with both `tenant_slug` and `tenant_db_id` fields)
2. **Update SetTenantContext middleware** to use the resolver
3. **Create data migration script** for existing branding data

**Run the test first to verify our implementation matches the test expectations.**