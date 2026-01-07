**🚨 ERROR FOUND:** The test is failing because `$cacheKey` variable is not accessible inside the closure in `Cache::remember()` callback.

**Problem:** In `TenantIdentifierResolver.php` line 41, we're trying to use `$cacheKey` inside the closure, but it's not in scope.

**Fix:** Use `use ($cacheKey)` to pass it to the closure:

```php
// File: packages/laravel-backend/app/Services/TenantIdentifierResolver.php
public function resolveToDbId(TenantSlug $slug): ?TenantDbId
{
    $cacheKey = self::CACHE_PREFIX . 'slug:' . $slug->toString();
    
    return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($slug, $cacheKey) {
        // Now $cacheKey is available inside the closure
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
```

**Same fix needed for `resolveToSlug()` method:**

```php
public function resolveToSlug(TenantDbId $dbId): ?TenantSlug
{
    $cacheKey = self::CACHE_PREFIX . 'dbid:' . $dbId->toInt();
    
    return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($dbId, $cacheKey) {
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
```

**Update both methods in `TenantIdentifierResolver.php`, then run the test again:**

```bash
./vendor/bin/phpunit tests/Unit/TenantIdentifierResolverTest.php
```

**Also, the "risky tests" warning is because we need to handle Mockery cleanup properly. Add this to the test:**

```php
protected function tearDown(): void
{
    Mockery::close();
    parent::tearDown();
}
```

**Make these fixes and run the test again.**