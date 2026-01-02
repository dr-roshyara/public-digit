# 🚀 **Senior Solution Architect Implementation Commands**

## 📋 **DAY 2 IMPLEMENTATION: Correct DDD Approach**

### **PHASE 1: SETUP & VALUE OBJECTS (Foundation)**

```bash
# 1. Create Value Objects Directory Structure
mkdir -p app/Contexts/Geography/Domain/{ValueObjects,Exceptions,Repositories,Services}
mkdir -p tests/Unit/Contexts/Geography/{ValueObjects,Services}

# 2. Create GeoPath Value Object (Foundation)
cat > app/Contexts/Geography/Domain/ValueObjects/GeoPath.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\ValueObjects;

use App\Contexts\Geography\Domain\Exceptions\InvalidGeoPathException;
use App\Contexts\Geography\Domain\Exceptions\MaxHierarchyDepthException;
use Stringable;

final class GeoPath implements Stringable
{
    private string $path;
    
    public function __construct(string $path)
    {
        // Validate ltree format: digits separated by dots
        if (!preg_match('/^\d+(\.\d+)*$/', $path)) {
            throw new InvalidGeoPathException($path);
        }
        
        // Validate max depth (8 levels for political parties)
        $depth = substr_count($path, '.') + 1;
        if ($depth > 8) {
            throw new MaxHierarchyDepthException($depth);
        }
        
        $this->path = $path;
    }
    
    public static function fromIds(array $ids): self
    {
        $validIds = array_filter($ids, fn($id) => !is_null($id) && $id > 0);
        return new self(implode('.', $validIds));
    }
    
    public function toString(): string
    {
        return $this->path;
    }
    
    public function __toString(): string
    {
        return $this->toString();
    }
    
    public function equals(self $other): bool
    {
        return $this->path === $other->path;
    }
    
    public function isDescendantOf(self $ancestor): bool
    {
        return strpos($this->path, $ancestor->path . '.') === 0;
    }
    
    public function getDepth(): int
    {
        return substr_count($this->path, '.') + 1;
    }
    
    public function getParentPath(): ?self
    {
        $lastDot = strrpos($this->path, '.');
        if ($lastDot === false) {
            return null;
        }
        
        return new self(substr($this->path, 0, $lastDot));
    }
}
EOF

# 3. Create CountryCode Value Object
cat > app/Contexts/Geography/Domain/ValueObjects/CountryCode.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\ValueObjects;

use App\Contexts\Geography\Domain\Exceptions\InvalidCountryCodeException;

final class CountryCode
{
    private string $code;
    
    public function __construct(string $code)
    {
        $normalized = strtoupper(trim($code));
        
        if (!preg_match('/^[A-Z]{2}$/', $normalized)) {
            throw new InvalidCountryCodeException($code);
        }
        
        $this->code = $normalized;
    }
    
    public function equals(self $other): bool
    {
        return $this->code === $other->code;
    }
    
    public function toString(): string
    {
        return $this->code;
    }
    
    public function __toString(): string
    {
        return $this->toString();
    }
    
    public static function nepal(): self
    {
        return new self('NP');
    }
    
    public static function india(): self
    {
        return new self('IN');
    }
    
    public static function germany(): self
    {
        return new self('DE');
    }
}
EOF

# 4. Create Domain Exceptions
cat > app/Contexts/Geography/Domain/Exceptions/InvalidGeoPathException.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Exceptions;

use DomainException;

class InvalidGeoPathException extends DomainException
{
    public function __construct(string $path)
    {
        parent::__construct(
            sprintf('Invalid GeoPath format: "%s". Must be dot-separated digits (e.g., "1.12.123").', $path)
        );
    }
}
EOF

cat > app/Contexts/Geography/Domain/Exceptions/MaxHierarchyDepthException.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Exceptions;

use DomainException;

class MaxHierarchyDepthException extends DomainException
{
    public function __construct(int $depth)
    {
        parent::__construct(
            sprintf('Maximum hierarchy depth of 8 exceeded: %d levels detected.', $depth)
        );
    }
}
EOF

cat > app/Contexts/Geography/Domain/Exceptions/InvalidCountryCodeException.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Exceptions;

use DomainException;

class InvalidCountryCodeException extends DomainException
{
    public function __construct(string $code)
    {
        parent::__construct(
            sprintf('Invalid country code: "%s". Must be ISO 3166-1 alpha-2 format (e.g., NP, IN, DE).', $code)
        );
    }
}
EOF

cat > app/Contexts/Geography/Domain/Exceptions/InvalidHierarchyException.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Exceptions;

use DomainException;

class InvalidHierarchyException extends DomainException
{
    public function __construct(string $message)
    {
        parent::__construct($message);
    }
}
EOF

cat > app/Contexts/Geography/Domain/Exceptions/InvalidParentChildException.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Exceptions;

use DomainException;

class InvalidParentChildException extends DomainException
{
    public function __construct(string $message)
    {
        parent::__construct($message);
    }
}
EOF

cat > app/Contexts/Geography/Domain/Exceptions/MissingRequiredLevelException.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Exceptions;

use DomainException;

class MissingRequiredLevelException extends DomainException
{
    public function __construct(string $level, string $countryCode)
    {
        parent::__construct(
            sprintf('Required level "%s" is missing for country "%s".', $level, $countryCode)
        );
    }
}
EOF
```

### **PHASE 2: CREATE FAILING TESTS (TDD RED PHASE)**

```bash
# 5. Create failing tests for GeographyPathService
cat > tests/Unit/Contexts/Geography/Services/GeographyPathServiceTest.php << 'EOF'
<?php

namespace Tests\Unit\Contexts\Geography\Services;

use App\Contexts\Geography\Domain\Exceptions\InvalidHierarchyException;
use App\Contexts\Geography\Domain\Exceptions\InvalidParentChildException;
use App\Contexts\Geography\Domain\Services\GeographyPathService;
use App\Contexts\Geography\Domain\ValueObjects\CountryCode;
use App\Contexts\Geography\Domain\ValueObjects\GeographyHierarchy;
use Mockery;
use Tests\TestCase;

class GeographyPathServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
    
    /** @test */
    public function it_generates_geo_path_from_valid_hierarchy(): void
    {
        // Arrange: Create mock repository
        $mockRepo = Mockery::mock('App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface');
        
        // Mock country configuration for Nepal
        $mockRepo->shouldReceive('getCountryConfig')
            ->with(Mockery::type('App\Contexts\Geography\Domain\ValueObjects\CountryCode'))
            ->andReturn([
                'level_sequence' => ['province_id', 'district_id', 'local_level_id', 'ward_id'],
                'required_levels' => ['province_id', 'district_id']
            ]);
        
        // Mock parent-child validation
        $mockRepo->shouldReceive('isChildOf')
            ->with(12, 1)
            ->andReturn(true);
        $mockRepo->shouldReceive('isChildOf')
            ->with(123, 12)
            ->andReturn(true);
        $mockRepo->shouldReceive('isChildOf')
            ->with(1234, 123)
            ->andReturn(true);
        
        $service = new GeographyPathService($mockRepo);
        
        // Create hierarchy - THIS WILL FAIL INITIALLY (RED PHASE)
        $hierarchy = new GeographyHierarchy(
            new CountryCode('NP'),
            [
                'province_id' => 1,
                'district_id' => 12,
                'local_level_id' => 123,
                'ward_id' => 1234
            ]
        );
        
        // Act
        $result = $service->generatePath($hierarchy);
        
        // Assert
        $this->assertEquals('1.12.123.1234', $result->toString());
    }
    
    /** @test */
    public function it_throws_exception_for_invalid_hierarchy_sequence(): void
    {
        $mockRepo = Mockery::mock('App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface');
        $mockRepo->shouldReceive('getCountryConfig')
            ->andReturn([
                'level_sequence' => ['province_id', 'district_id', 'local_level_id', 'ward_id'],
                'required_levels' => ['province_id', 'district_id']
            ]);
        
        $service = new GeographyPathService($mockRepo);
        
        // Missing local_level_id but has ward_id - invalid sequence
        $hierarchy = new GeographyHierarchy(
            new CountryCode('NP'),
            [
                'province_id' => 1,
                'district_id' => 12,
                'ward_id' => 1234 // Missing local_level_id
            ]
        );
        
        $this->expectException(InvalidHierarchyException::class);
        $service->generatePath($hierarchy);
    }
    
    /** @test */
    public function it_throws_exception_for_invalid_parent_child_relationship(): void
    {
        $mockRepo = Mockery::mock('App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface');
        $mockRepo->shouldReceive('getCountryConfig')
            ->andReturn([
                'level_sequence' => ['province_id', 'district_id'],
                'required_levels' => ['province_id', 'district_id']
            ]);
        
        // Mock: District 99 is NOT a child of Province 1
        $mockRepo->shouldReceive('isChildOf')
            ->with(99, 1)
            ->andReturn(false);
        
        $service = new GeographyPathService($mockRepo);
        
        $hierarchy = new GeographyHierarchy(
            new CountryCode('NP'),
            [
                'province_id' => 1,
                'district_id' => 99, // Not a child of province 1
            ]
        );
        
        $this->expectException(InvalidParentChildException::class);
        $service->generatePath($hierarchy);
    }
    
    /** @test */
    public function it_generates_partial_path_when_optional_levels_missing(): void
    {
        $mockRepo = Mockery::mock('App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface');
        $mockRepo->shouldReceive('getCountryConfig')
            ->andReturn([
                'level_sequence' => ['province_id', 'district_id', 'local_level_id', 'ward_id'],
                'required_levels' => ['province_id', 'district_id']
            ]);
        
        $mockRepo->shouldReceive('isChildOf')
            ->with(12, 1)
            ->andReturn(true);
        
        $service = new GeographyPathService($mockRepo);
        
        // Only required levels provided
        $hierarchy = new GeographyHierarchy(
            new CountryCode('NP'),
            [
                'province_id' => 1,
                'district_id' => 12
                // local_level_id and ward_id are optional
            ]
        );
        
        $result = $service->generatePath($hierarchy);
        $this->assertEquals('1.12', $result->toString());
    }
    
    /** @test */
    public function it_handles_different_country_hierarchies(): void
    {
        $mockRepo = Mockery::mock('App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface');
        
        // Nepal configuration
        $mockRepo->shouldReceive('getCountryConfig')
            ->with(Mockery::on(fn($cc) => $cc->toString() === 'NP'))
            ->andReturn([
                'level_sequence' => ['province_id', 'district_id', 'local_level_id', 'ward_id'],
                'required_levels' => ['province_id', 'district_id']
            ]);
        
        // India configuration
        $mockRepo->shouldReceive('getCountryConfig')
            ->with(Mockery::on(fn($cc) => $cc->toString() === 'IN'))
            ->andReturn([
                'level_sequence' => ['state_id', 'district_id', 'subdistrict_id'],
                'required_levels' => ['state_id', 'district_id']
            ]);
        
        $mockRepo->shouldReceive('isChildOf')
            ->andReturn(true); // All relationships valid for simplicity
        
        $service = new GeographyPathService($mockRepo);
        
        // Nepal hierarchy
        $nepalHierarchy = new GeographyHierarchy(
            new CountryCode('NP'),
            [
                'province_id' => 1,
                'district_id' => 12,
                'local_level_id' => 123
            ]
        );
        
        // India hierarchy
        $indiaHierarchy = new GeographyHierarchy(
            new CountryCode('IN'),
            [
                'state_id' => 1,
                'district_id' => 12,
                'subdistrict_id' => 123
            ]
        );
        
        $nepalPath = $service->generatePath($nepalHierarchy);
        $indiaPath = $service->generatePath($indiaHierarchy);
        
        $this->assertEquals('1.12.123', $nepalPath->toString());
        $this->assertEquals('1.12.123', $indiaPath->toString());
    }
}
EOF

# 6. Run the failing tests (RED PHASE)
echo "Running tests - they should ALL FAIL (RED phase)..."
php artisan test tests/Unit/Contexts/Geography/Services/GeographyPathServiceTest.php --stop-on-failure
```

### **PHASE 3: IMPLEMENT TO PASS TESTS (TDD GREEN PHASE)**

```bash
# 7. Create missing GeographyHierarchy Value Object
cat > app/Contexts/Geography/Domain/ValueObjects/GeographyHierarchy.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\ValueObjects;

use App\Contexts\Geography\Domain\Exceptions\InvalidHierarchyException;
use App\Contexts\Geography\Domain\Exceptions\MissingRequiredLevelException;

final class GeographyHierarchy
{
    private CountryCode $countryCode;
    private array $levels;
    
    public function __construct(CountryCode $countryCode, array $levels)
    {
        $this->countryCode = $countryCode;
        $this->levels = $levels;
    }
    
    public function getCountryCode(): CountryCode
    {
        return $this->countryCode;
    }
    
    public function getLevels(): array
    {
        return $this->levels;
    }
    
    public function getLevelValue(string $levelName): ?int
    {
        return $this->levels[$levelName] ?? null;
    }
    
    public function hasLevel(string $levelName): bool
    {
        return isset($this->levels[$levelName]) && $this->levels[$levelName] > 0;
    }
    
    public function validateAgainstConfig(array $config): void
    {
        // Check required levels
        foreach ($config['required_levels'] ?? [] as $requiredLevel) {
            if (!$this->hasLevel($requiredLevel)) {
                throw new MissingRequiredLevelException($requiredLevel, $this->countryCode->toString());
            }
        }
        
        // Validate sequence (if level N has value, level N+1 must also have value unless it's optional)
        $sequence = $config['level_sequence'] ?? [];
        
        for ($i = 0; $i < count($sequence) - 1; $i++) {
            $currentLevel = $sequence[$i];
            $nextLevel = $sequence[$i + 1];
            
            $currentHasValue = $this->hasLevel($currentLevel);
            $nextHasValue = $this->hasLevel($nextLevel);
            
            // If current level has value but next level doesn't, and next level is required, throw
            if ($currentHasValue && !$nextHasValue) {
                $nextIsRequired = in_array($nextLevel, $config['required_levels'] ?? []);
                if ($nextIsRequired) {
                    throw new InvalidHierarchyException(
                        sprintf('Level "%s" has value but required level "%s" is missing.', $currentLevel, $nextLevel)
                    );
                }
            }
        }
    }
    
    public function getIdsInSequence(array $sequence): array
    {
        $ids = [];
        foreach ($sequence as $level) {
            if ($this->hasLevel($level)) {
                $ids[] = $this->levels[$level];
            }
        }
        return $ids;
    }
}
EOF

# 8. Create Repository Interface
cat > app/Contexts/Geography/Domain/Repositories/GeoUnitRepositoryInterface.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Repositories;

use App\Contexts\Geography\Domain\ValueObjects\CountryCode;

interface GeoUnitRepositoryInterface
{
    public function findById(int $id): ?object; // Returns GeoUnit entity (to be defined later)
    public function isChildOf(int $childId, int $parentId): bool;
    public function getCountryConfig(CountryCode $countryCode): array;
    public function findChildren(int $parentId): array;
}
EOF

# 9. Create GeographyPathService Implementation
cat > app/Contexts/Geography/Domain/Services/GeographyPathService.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Services;

use App\Contexts\Geography\Domain\Exceptions\InvalidParentChildException;
use App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface;
use App\Contexts\Geography\Domain\ValueObjects\GeographyHierarchy;
use App\Contexts\Geography\Domain\ValueObjects\GeoPath;

final class GeographyPathService
{
    public function __construct(
        private GeoUnitRepositoryInterface $repository
    ) {}
    
    public function generatePath(GeographyHierarchy $hierarchy): GeoPath
    {
        // 1. Get country-specific configuration
        $countryConfig = $this->repository->getCountryConfig($hierarchy->getCountryCode());
        
        // 2. Validate hierarchy against country configuration
        $hierarchy->validateAgainstConfig($countryConfig);
        
        // 3. Validate parent-child relationships
        $this->validateParentChildRelationships($hierarchy, $countryConfig);
        
        // 4. Extract IDs in correct sequence and generate path
        $ids = $hierarchy->getIdsInSequence($countryConfig['level_sequence']);
        
        return GeoPath::fromIds($ids);
    }
    
    private function validateParentChildRelationships(
        GeographyHierarchy $hierarchy,
        array $countryConfig
    ): void {
        $levels = $hierarchy->getLevels();
        $sequence = $countryConfig['level_sequence'];
        
        // For each level in sequence that has a value
        $previousId = null;
        $previousLevel = null;
        
        foreach ($sequence as $currentLevel) {
            $currentId = $levels[$currentLevel] ?? null;
            
            if (!$currentId) {
                continue; // Skip optional levels that aren't provided
            }
            
            // If we have a previous level, validate parent-child relationship
            if ($previousId && $previousLevel) {
                if (!$this->repository->isChildOf($currentId, $previousId)) {
                    throw new InvalidParentChildException(
                        sprintf(
                            'Level "%s" (ID: %d) is not a valid child of "%s" (ID: %d)',
                            $currentLevel,
                            $currentId,
                            $previousLevel,
                            $previousId
                        )
                    );
                }
            }
            
            $previousId = $currentId;
            $previousLevel = $currentLevel;
        }
    }
}
EOF

# 10. Run tests again - they should now PASS (GREEN phase)
echo "Running tests again - they should NOW PASS (GREEN phase)..."
php artisan test tests/Unit/Contexts/Geography/Services/GeographyPathServiceTest.php
```

### **PHASE 4: REFACTOR & ENHANCE (TDD REFACTOR PHASE)**

```bash
# 11. Add caching layer to service (refactoring)
cat > app/Contexts/Geography/Domain/Services/GeographyPathService.php << 'EOF'
<?php

namespace App\Contexts\Geography\Domain\Services;

use App\Contexts\Geography\Domain\Exceptions\InvalidParentChildException;
use App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface;
use App\Contexts\Geography\Domain\ValueObjects\GeographyHierarchy;
use App\Contexts\Geography\Domain\ValueObjects\GeoPath;
use Illuminate\Contracts\Cache\Repository as CacheRepository;

final class GeographyPathService
{
    private const CACHE_TTL = 3600; // 1 hour
    private const CACHE_PREFIX = 'geo_path:';
    
    public function __construct(
        private GeoUnitRepositoryInterface $repository,
        private ?CacheRepository $cache = null
    ) {}
    
    public function generatePath(GeographyHierarchy $hierarchy): GeoPath
    {
        // Generate cache key from hierarchy data
        $cacheKey = $this->generateCacheKey($hierarchy);
        
        // Return cached result if available
        if ($this->cache && $cached = $this->cache->get($cacheKey)) {
            return GeoPath::fromIds($cached);
        }
        
        // 1. Get country-specific configuration
        $countryConfig = $this->repository->getCountryConfig($hierarchy->getCountryCode());
        
        // 2. Validate hierarchy against country configuration
        $hierarchy->validateAgainstConfig($countryConfig);
        
        // 3. Validate parent-child relationships
        $this->validateParentChildRelationships($hierarchy, $countryConfig);
        
        // 4. Extract IDs in correct sequence and generate path
        $ids = $hierarchy->getIdsInSequence($countryConfig['level_sequence']);
        $geoPath = GeoPath::fromIds($ids);
        
        // 5. Cache the result
        if ($this->cache) {
            $this->cache->put($cacheKey, $ids, self::CACHE_TTL);
        }
        
        return $geoPath;
    }
    
    public function invalidateCache(GeographyHierarchy $hierarchy): void
    {
        if (!$this->cache) {
            return;
        }
        
        $cacheKey = $this->generateCacheKey($hierarchy);
        $this->cache->forget($cacheKey);
    }
    
    private function validateParentChildRelationships(
        GeographyHierarchy $hierarchy,
        array $countryConfig
    ): void {
        $levels = $hierarchy->getLevels();
        $sequence = $countryConfig['level_sequence'];
        
        $previousId = null;
        $previousLevel = null;
        
        foreach ($sequence as $currentLevel) {
            $currentId = $levels[$currentLevel] ?? null;
            
            if (!$currentId) {
                continue;
            }
            
            if ($previousId && $previousLevel) {
                if (!$this->repository->isChildOf($currentId, $previousId)) {
                    throw new InvalidParentChildException(
                        sprintf(
                            'Level "%s" (ID: %d) is not a valid child of "%s" (ID: %d)',
                            $currentLevel,
                            $currentId,
                            $previousLevel,
                            $previousId
                        )
                    );
                }
            }
            
            $previousId = $currentId;
            $previousLevel = $currentLevel;
        }
    }
    
    private function generateCacheKey(GeographyHierarchy $hierarchy): string
    {
        $data = [
            'country' => $hierarchy->getCountryCode()->toString(),
            'levels' => $hierarchy->getLevels()
        ];
        
        return self::CACHE_PREFIX . md5(serialize($data));
    }
}
EOF

# 12. Add caching test
cat >> tests/Unit/Contexts/Geography/Services/GeographyPathServiceTest.php << 'EOF'
    
    /** @test */
    public function it_caches_generated_paths(): void
    {
        $mockRepo = Mockery::mock('App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface');
        $mockCache = Mockery::mock('Illuminate\Contracts\Cache\Repository');
        
        $mockRepo->shouldReceive('getCountryConfig')
            ->andReturn([
                'level_sequence' => ['province_id', 'district_id'],
                'required_levels' => ['province_id', 'district_id']
            ]);
        
        $mockRepo->shouldReceive('isChildOf')
            ->with(12, 1)
            ->andReturn(true);
        
        // Expect cache miss first time
        $cacheKey = 'geo_path:' . md5(serialize([
            'country' => 'NP',
            'levels' => ['province_id' => 1, 'district_id' => 12]
        ]));
        
        $mockCache->shouldReceive('get')
            ->with($cacheKey)
            ->once()
            ->andReturn(null); // Cache miss
            
        $mockCache->shouldReceive('put')
            ->with($cacheKey, [1, 12], 3600)
            ->once();
        
        $service = new GeographyPathService($mockRepo, $mockCache);
        
        $hierarchy = new GeographyHierarchy(
            new CountryCode('NP'),
            ['province_id' => 1, 'district_id' => 12]
        );
        
        // First call - should compute and cache
        $result1 = $service->generatePath($hierarchy);
        
        // Reset mock expectations for second call
        Mockery::close();
        $mockRepo = Mockery::mock('App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface');
        $mockCache = Mockery::mock('Illuminate\Contracts\Cache\Repository');
        
        $mockCache->shouldReceive('get')
            ->with($cacheKey)
            ->once()
            ->andReturn([1, 12]); // Cache hit
        
        // Repository should NOT be called for cached results
        $mockRepo->shouldNotReceive('getCountryConfig');
        $mockRepo->shouldNotReceive('isChildOf');
        
        $service = new GeographyPathService($mockRepo, $mockCache);
        
        // Second call - should use cache
        $result2 = $service->generatePath($hierarchy);
        
        $this->assertEquals('1.12', $result2->toString());
    }
    
    /** @test */
    public function it_can_invalidate_cache(): void
    {
        $mockRepo = Mockery::mock('App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface');
        $mockCache = Mockery::mock('Illuminate\Contracts\Cache\Repository');
        
        $cacheKey = 'geo_path:' . md5(serialize([
            'country' => 'NP',
            'levels' => ['province_id' => 1, 'district_id' => 12]
        ]));
        
        $mockCache->shouldReceive('forget')
            ->with($cacheKey)
            ->once();
        
        $service = new GeographyPathService($mockRepo, $mockCache);
        
        $hierarchy = new GeographyHierarchy(
            new CountryCode('NP'),
            ['province_id' => 1, 'district_id' => 12]
        );
        
        $service->invalidateCache($hierarchy);
    }
EOF

# 13. Run all tests to ensure everything works
echo "Running comprehensive tests..."
php artisan test tests/Unit/Contexts/Geography/Services/GeographyPathServiceTest.php
```

### **PHASE 5: INTEGRATION WITH MEMBERSHIP CONTEXT**

```bash
# 14. Create Service Provider for Geography Context
cat > app/Providers/GeographyServiceProvider.php << 'EOF'
<?php

namespace App\Providers;

use App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface;
use App\Contexts\Geography\Domain\Services\GeographyPathService;
use App\Contexts\Geography\Infrastructure\Repositories\EloquentGeoUnitRepository;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\ServiceProvider;

class GeographyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind repository interface to implementation
        $this->app->bind(
            GeoUnitRepositoryInterface::class,
            EloquentGeoUnitRepository::class
        );
        
        // Bind GeographyPathService with dependencies
        $this->app->singleton(GeographyPathService::class, function ($app) {
            return new GeographyPathService(
                $app->make(GeoUnitRepositoryInterface::class),
                $app->make(CacheRepository::class)
            );
        });
    }
    
    public function boot(): void
    {
        // Register migrations from Geography context
        $this->loadMigrationsFrom([
            base_path('app/Contexts/Geography/Infrastructure/Database/Migrations'),
        ]);
    }
}
EOF

# 15. Update config/app.php to include provider
sed -i "/'providers' => \[/a\        App\\\Providers\\\GeographyServiceProvider::class," config/app.php

# 16. Create example usage in Membership Context
cat > app/Contexts/Membership/Application/Services/MemberGeographyService.php << 'EOF'
<?php

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Geography\Domain\Services\GeographyPathService;
use App\Contexts\Geography\Domain\ValueObjects\CountryCode;
use App\Contexts\Geography\Domain\ValueObjects\GeographyHierarchy;
use App\Contexts\Membership\Domain\Models\Member;

class MemberGeographyService
{
    public function __construct(
        private GeographyPathService $geographyPathService
    ) {}
    
    public function assignGeographyToMember(Member $member, array $geographyData): void
    {
        // Convert raw data from form to GeographyHierarchy Value Object
        $hierarchy = $this->createHierarchyFromFormData($geographyData);
        
        // Use Geography Context service to generate path
        $geoPath = $this->geographyPathService->generatePath($hierarchy);
        
        // Update member with generated path
        $member->update([
            'geo_path' => $geoPath->toString(),
            'admin_unit_level1_id' => $geographyData['province_id'] ?? null,
            'admin_unit_level2_id' => $geographyData['district_id'] ?? null,
            'admin_unit_level3_id' => $geographyData['local_level_id'] ?? null,
            'admin_unit_level4_id' => $geographyData['ward_id'] ?? null,
        ]);
    }
    
    private function createHierarchyFromFormData(array $data): GeographyHierarchy
    {
        // Determine country (default to Nepal)
        $countryCode = new CountryCode($data['country_code'] ?? 'NP');
        
        // Extract levels from form data
        $levels = [];
        
        $levelMapping = [
            'province_id' => 'province_id',
            'district_id' => 'district_id',
            'local_level_id' => 'local_level_id',
            'ward_id' => 'ward_id',
            'state_id' => 'state_id', // For India
            'subdistrict_id' => 'subdistrict_id', // For India
        ];
        
        foreach ($levelMapping as $formField => $levelName) {
            if (isset($data[$formField]) && $data[$formField]) {
                $levels[$levelName] = (int) $data[$formField];
            }
        }
        
        return new GeographyHierarchy($countryCode, $levels);
    }
}
EOF
```

### **PHASE 6: VERIFICATION & DEPLOYMENT**

```bash
# 17. Create integration test to verify cross-context communication
cat > tests/Feature/CrossContext/GeographyMembershipIntegrationTest.php << 'EOF'
<?php

namespace Tests\Feature\CrossContext;

use App\Contexts\Geography\Domain\Services\GeographyPathService;
use App\Contexts\Geography\Domain\ValueObjects\CountryCode;
use App\Contexts\Geography\Domain\ValueObjects\GeographyHierarchy;
use App\Contexts\Membership\Application\Services\MemberGeographyService;
use App\Contexts\Membership\Domain\Models\Member;
use Tests\TestCase;

class GeographyMembershipIntegrationTest extends TestCase
{
    /** @test */
    public function membership_context_can_use_geography_path_service(): void
    {
        // Create a mock member
        $member = Member::factory()->create();
        
        // Get the GeographyPathService from container
        $geographyPathService = app(GeographyPathService::class);
        
        // Create a geography hierarchy
        $hierarchy = new GeographyHierarchy(
            new CountryCode('NP'),
            [
                'province_id' => 1,
                'district_id' => 12,
                'local_level_id' => 123
            ]
        );
        
        // Generate path using Geography Context service
        $geoPath = $geographyPathService->generatePath($hierarchy);
        
        // Verify the path is correct
        $this->assertEquals('1.12.123', $geoPath->toString());
        
        // Update member with the path (simulating Membership Context usage)
        $member->update(['geo_path' => $geoPath->toString()]);
        $member->refresh();
        
        $this->assertEquals('1.12.123', $member->geo_path);
    }
    
    /** @test */
    public function member_geography_service_integration(): void
    {
        $member = Member::factory()->create();
        $service = app(MemberGeographyService::class);
        
        // Simulate form data from UI
        $formData = [
            'country_code' => 'NP',
            'province_id' => 1,
            'district_id' => 12,
            'local_level_id' => 123,
            'ward_id' => 1234
        ];
        
        // Assign geography to member
        $service->assignGeographyToMember($member, $formData);
        $member->refresh();
        
        // Verify member has correct geo_path
        $this->assertEquals('1.12.123.1234', $member->geo_path);
        $this->assertEquals(1, $member->admin_unit_level1_id);
        $this->assertEquals(12, $member->admin_unit_level2_id);
        $this->assertEquals(123, $member->admin_unit_level3_id);
        $this->assertEquals(1234, $member->admin_unit_level4_id);
    }
}
EOF

# 18. Run complete test suite
echo "Running complete test suite..."
php artisan test tests/Unit/Contexts/Geography/
php artisan test tests/Feature/CrossContext/

# 19. Create a simple console command to test the service
cat > app/Console/Commands/TestGeographyPath.php << 'EOF'
<?php

namespace App\Console\Commands;

use App\Contexts\Geography\Domain\Services\GeographyPathService;
use App\Contexts\Geography\Domain\ValueObjects\CountryCode;
use App\Contexts\Geography\Domain\ValueObjects\GeographyHierarchy;
use Illuminate\Console\Command;

class TestGeographyPath extends Command
{
    protected $signature = 'geography:test-path 
                            {province : Province ID}
                            {district : District ID}
                            {--local= : Local Level ID}
                            {--ward= : Ward ID}
                            {--country=NP : Country Code}';
    
    protected $description = 'Test GeographyPathService with sample data';
    
    public function handle(GeographyPathService $service): int
    {
        $hierarchyData = [
            'province_id' => (int) $this->argument('province'),
            'district_id' => (int) $this->argument('district'),
        ];
        
        if ($this->option('local')) {
            $hierarchyData['local_level_id'] = (int) $this->option('local');
        }
        
        if ($this->option('ward')) {
            $hierarchyData['ward_id'] = (int) $this->option('ward');
        }