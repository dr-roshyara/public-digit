# 📘 **Developer Guide: Phase 1 - Geography Context Implementation**

## 🏗️ **Architecture Overview**

### **Context Boundaries**
```
Geography Context (Shared Kernel)
├── Domain Layer
│   ├── Value Objects (7)
│   ├── Entity (1 Aggregate Root)
│   ├── Repository Interface (1)
│   └── Domain Exceptions (5)
├── Application Layer
│   └── Domain Service (1)
└── Tests
    ├── Service Tests (5)
    └── Value Object Tests (8)
```

## 🔧 **Value Objects (Immutable)**

### **1. GeoPath**
**Purpose**: PostgreSQL ltree path representation
```php
// Creation
$path = GeoPath::fromString('1.12.123'); // From ltree string
$path = GeoPath::fromIds([1, 12, 123]);  // From array of IDs

// Usage
$path->toString();           // "1.12.123"
$path->getDepth();           // 3
$path->getParentPath();      // GeoPath("1.12")
$path->isDescendantOf($other); // bool
```

### **2. CountryCode**
**Purpose**: ISO 3166-1 alpha-2 validation
```php
$code = CountryCode::fromString('NP');
$code->toString();           // "NP"
$code->getName();            // "Nepal"
$code->getHierarchyLevels(); // Array of level configs
$code->isLevelRequired(1);   // true for Nepal
```

### **3. GeographyHierarchy**
**Purpose**: 8-level hierarchy with validation
```php
$hierarchy = GeographyHierarchy::fromLevelIds(
    CountryCode::fromString('NP'),
    [1, 12, 123, null, null, null, null, null]
);

// Validation rules enforced:
// 1. No gaps in hierarchy
// 2. Required levels must be filled
// 3. All IDs must be integers or null
```

### **4. Other Value Objects**
- **GeoUnitId**: Positive integer wrapper
- **GeographyLevel**: Level 1-8 with validation
- **LocalizedName**: Multilingual names with fallback
- **GeographicCode**: Official government codes

## 🏛️ **Entities**

### **GeoAdministrativeUnit (Aggregate Root)**
```php
// Factory methods
$root = GeoAdministrativeUnit::createRoot($id, $countryCode, $name);
$child = GeoAdministrativeUnit::createChild($id, $countryCode, $level, $parent, $name);

// Business rules enforced:
// 1. Cannot be own parent
// 2. Max depth 8 levels (via GeographyLevel)
// 3. Path must match parent hierarchy
// 4. Official codes unique per country+level (repository enforced)
```

## 🛠️ **Services**

### **GeographyPathService**
**Purpose**: Generate materialized paths with caching
```php
// Constructor dependencies
$service = new GeographyPathService(
    $geoUnitRepository, // GeoUnitRepositoryInterface
    $cache              // Illuminate\Contracts\Cache\Repository
);

// Main method
$hierarchy = GeographyHierarchy::fromLevelIds($countryCode, [1, 12, 123]);
$path = $service->generatePath($hierarchy); // Returns GeoPath

// Caching: 24-hour TTL, key based on hierarchy hash
```

## 🗄️ **Repository Pattern**

### **GeoUnitRepositoryInterface**
```php
interface GeoUnitRepositoryInterface
{
    public function findById(GeoUnitId $unitId): ?GeoAdministrativeUnit;
    public function isChildOf(GeoUnitId $childId, GeoUnitId $parentId): bool;
    public function getCountryConfig(CountryCode $countryCode): array;
    // ... other methods
}
```

**Note**: Implementation (`EloquentGeoUnitRepository`) is COMPLETED ✅

## 🧪 **Testing Strategy**

### **TDD Approach**
```
RED → GREEN → REFACTOR
1. Write failing test
2. Implement minimal code to pass
3. Refactor while tests pass
```

### **Test Structure**
```
tests/Unit/Contexts/Geography/
├── Services/
│   └── GeographyPathServiceTest.php (5 tests)
└── ValueObjects/
    └── GeographyHierarchyTest.php (8 tests)
```

### **Mocking Dependencies**
```php
// Mock repository
$this->repositoryMock = Mockery::mock(GeoUnitRepositoryInterface::class);
$this->repositoryMock->shouldReceive('findById')
    ->with(Mockery::type(GeoUnitId::class))
    ->andReturn($unit);

// Mock cache
$this->cacheMock = Mockery::mock(CacheRepository::class);
$this->cacheMock->shouldReceive('get')->andReturn(null);
$this->cacheMock->shouldReceive('put')->withAnyArgs();
```

## 🐛 **Debugging Methods & Techniques**

### **1. Value Object Debugging**

#### **GeoPath Debugging**
```php
// Debug path structure
$path = GeoPath::fromString('1.12.123.1234');
dump($path->getLevelIds());      // [1, 12, 123, 1234]
dump($path->getDepth());         // 4
dump($path->getParentPath());    // GeoPath("1.12.123")

// Validate ltree format
$isValid = GeoPath::isValid('1.12.123'); // true
$isValid = GeoPath::isValid('1.12.abc'); // false
```

#### **GeographyHierarchy Debugging**
```php
$hierarchy = GeographyHierarchy::fromLevelIds($countryCode, [1, 12, null, 1234]);

dump($hierarchy->getFilledLevels());   // [1, 2, 4]
dump($hierarchy->getMissingLevels());  // [3, 5, 6, 7, 8]
dump($hierarchy->isComplete());        // false
dump($hierarchy->getDepth());          // 4
dump($hierarchy->toArray());           // ['country_code' => 'NP', 'level_ids' => [...]]
```

### **2. Entity Debugging**

#### **GeoAdministrativeUnit State Inspection**
```php
$unit = GeoAdministrativeUnit::createRoot($id, $countryCode, $name);

dump($unit->getId()->toInt());          // 1
dump($unit->getCountryCode()->toString()); // "NP"
dump($unit->getLevel()->toInt());       // 1
dump($unit->getPath()->toString());     // "1"
dump($unit->isRoot());                  // true
dump($unit->getEnglishName());          // "Province Name"
```

### **3. Service Debugging**

#### **GeographyPathService Debugging**
```php
// Enable debug logging in service
class GeographyPathService
{
    private bool $debug = true;
    
    private function log(string $message, array $context = []): void
    {
        if ($this->debug) {
            \Log::debug("[GeographyPathService] $message", $context);
        }
    }
    
    public function generatePath(GeographyHierarchy $hierarchy): GeoPath
    {
        $this->log('Generating path', [
            'country' => $hierarchy->getCountryCode()->toString(),
            'levels' => $hierarchy->getLevelIds()
        ]);
        
        // ... rest of implementation
    }
}
```

#### **Cache Debugging**
```php
// Check cache hits/misses
$cacheKey = 'geo:path:' . md5(serialize($hierarchyData));
$cached = Cache::get($cacheKey);

if ($cached) {
    \Log::info("Cache HIT for key: $cacheKey");
} else {
    \Log::info("Cache MISS for key: $cacheKey");
}
```

### **4. Validation Debugging**

#### **Hierarchy Validation Errors**
```php
try {
    $hierarchy = GeographyHierarchy::fromLevelIds(
        CountryCode::fromString('NP'),
        [1, null, 3] // Gap at level 2
    );
} catch (InvalidArgumentException $e) {
    // Error: "Missing level 2 in hierarchy. Cannot have level 3 without level 2."
    \Log::error('Hierarchy validation failed', [
        'error' => $e->getMessage(),
        'levels' => [1, null, 3],
        'country' => 'NP'
    ]);
}
```

#### **Parent-Child Validation**
```php
try {
    $service->generatePath($hierarchy);
} catch (InvalidParentChildException $e) {
    // Error: "Geography unit ID 123 at level 3 is not a child of parent ID 12."
    \Log::error('Parent-child validation failed', [
        'error' => $e->getMessage(),
        'hierarchy' => $hierarchy->toArray()
    ]);
}
```

### **5. Performance Debugging**

#### **Cache Performance**
```php
// Add timing to service
$start = microtime(true);
$path = $service->generatePath($hierarchy);
$time = microtime(true) - $start;

\Log::info("Path generation time: {$time}s", [
    'cached' => $time < 0.01, // Approximate cache hit threshold
    'depth' => $hierarchy->getDepth()
]);
```

#### **Repository Query Debugging**
```php
// In repository implementation (when created)
class EloquentGeoUnitRepository implements GeoUnitRepositoryInterface
{
    public function findById(GeoUnitId $unitId): ?GeoAdministrativeUnit
    {
        \DB::enableQueryLog();
        
        $unit = GeoAdministrativeUnit::where('id', $unitId->toInt())->first();
        
        $queries = \DB::getQueryLog();
        \Log::debug('Repository query executed', [
            'query' => $queries[0]['query'] ?? null,
            'bindings' => $queries[0]['bindings'] ?? [],
            'time' => $queries[0]['time'] ?? 0
        ]);
        
        return $unit;
    }
}
```

### **6. Unit Test Debugging**

#### **Test Data Generation**
```php
// Helper for test debugging
private function debugTestHierarchy(array $levelIds, string $countryCode = 'NP'): void
{
    $hierarchy = GeographyHierarchy::fromLevelIds(
        CountryCode::fromString($countryCode),
        $levelIds
    );
    
    dump([
        'input' => $levelIds,
        'country' => $countryCode,
        'filled_levels' => $hierarchy->getFilledLevels(),
        'missing_levels' => $hierarchy->getMissingLevels(),
        'depth' => $hierarchy->getDepth(),
        'path' => $hierarchy->toGeoPath()->toString()
    ]);
}

// Usage in tests
$this->debugTestHierarchy([1, 12, 123]);
```

#### **Mock Verification Debugging**
```php
// Verify mock interactions
public function test_generates_path_for_valid_hierarchy(): void
{
    // ... test setup
    
    $result = $this->service->generatePath($hierarchy);
    
    // Debug mock calls
    Mockery::getContainer()->mockery_getExpectationCount();
    
    // Or check specific calls were made
    $this->repositoryMock->shouldHaveReceived('findById')
        ->times(4); // Should be called 4 times for 4 levels
        
    $this->repositoryMock->shouldHaveReceived('isChildOf')
        ->times(3); // Should be called 3 times for parent-child checks
}
```

### **7. Integration Debugging**

#### **Log All Geography Operations**
```php
// Create a debugging middleware
class GeographyDebugMiddleware
{
    public function handle($request, Closure $next)
    {
        if (config('app.debug')) {
            \Log::channel('geography')->info('Geography operation started', [
                'endpoint' => $request->path(),
                'method' => $request->method(),
                'ip' => $request->ip()
            ]);
        }
        
        $response = $next($request);
        
        if (config('app.debug')) {
            \Log::channel('geography')->info('Geography operation completed', [
                'status' => $response->status(),
                'duration' => microtime(true) - LARAVEL_START
            ]);
        }
        
        return $response;
    }
}
```

### **8. Common Issues & Solutions**

#### **Issue: "Invalid ltree path format"**
```php
// Debug: Check what's being passed
dump($inputString); // Should match regex: /^\d+(\.\d+)*$/

// Common mistakes:
// "1.12. "   // Trailing space
// ".1.12"    // Leading dot
// "1..12"    // Double dots
// "1.12.abc" // Non-numeric
```

#### **Issue: "Missing required level"**
```php
// Debug: Check country requirements
$countryCode = CountryCode::fromString('NP');
dump($countryCode->getRequiredLevels());
// Output: [1 => ['name' => 'Province', 'required' => true], ...]

// Solution: Ensure required levels are provided
$hierarchy = GeographyHierarchy::fromLevelIds($countryCode, [1, 12]); // Level 1+2 required for NP
```

#### **Issue: Cache not working**
```php
// Debug: Check cache key generation
$hierarchyData = [
    'country' => 'NP',
    'levels' => [1, 12, 123, null, null, null, null, null]
];
$cacheKey = 'geo:path:' . md5(serialize($hierarchyData));

// Check if key exists
dump(Cache::has($cacheKey));

// Check cache driver
dump(config('cache.default')); // Should be redis/memcached for production
```

## 📋 **Development Workflow**

### **1. Creating New Geography Units**
```php
// Step 1: Create Value Objects
$countryCode = CountryCode::fromString('NP');
$unitId = GeoUnitId::fromInt(123);
$level = GeographyLevel::fromInt(3); // Local Level
$name = LocalizedName::fromArray(['en' => 'Kathmandu', 'np' => 'काठमाडौं']);

// Step 2: Find parent unit
$parent = $repository->findById(GeoUnitId::fromInt(12));

// Step 3: Create child unit
$child = GeoAdministrativeUnit::createChild(
    $unitId,
    $countryCode,
    $level,
    $parent,
    $name
);

// Step 4: Save via repository
$repository->save($child);
```

### **2. Generating Paths for Members**
```php
// Member registration flow
$hierarchy = GeographyHierarchy::fromLevelIds(
    CountryCode::fromString('NP'),
    [$provinceId, $districtId, $localLevelId, $wardId]
);

try {
    $path = $geographyPathService->generatePath($hierarchy);
    $member->setGeographyPath($path);
} catch (InvalidHierarchyException $e) {
    // Handle invalid geography
    return response()->json(['error' => $e->getMessage()], 400);
}
```

## 🔍 **Monitoring & Logging**

### **Log Channels Configuration**
```php
// config/logging.php
'channels' => [
    'geography' => [
        'driver' => 'daily',
        'path' => storage_path('logs/geography.log'),
        'level' => 'debug',
        'days' => 14,
    ],
],
```

### **Key Metrics to Monitor**
1. **Cache hit rate**: Should be > 80% for performance
2. **Path generation time**: Should be < 100ms
3. **Validation failure rate**: Should be low (< 1%)
4. **Repository query performance**: Should be < 50ms per query

## 🚨 **Troubleshooting Checklist**

### **When Tests Fail:**
1. ✅ Check exception messages match exactly
2. ✅ Verify mock expectations are correct
3. ✅ Ensure test data doesn't violate validation rules
4. ✅ Check Value Object immutability isn't broken

### **When Service Fails:**
1. ✅ Verify repository returns correct entities
2. ✅ Check cache is properly configured
3. ✅ Ensure hierarchy validation passes
4. ✅ Verify parent-child relationships exist in database

### **When Performance Suffers:**
1. ✅ Enable query logging for repository
2. ✅ Check cache hit rates
3. ✅ Profile path generation with Xdebug
4. ✅ Verify database indexes exist (when implemented)

---

## 📚 **Quick Reference**

### **Common Methods**
```php
// Create hierarchy
GeographyHierarchy::fromLevelIds($countryCode, $levelIds);

// Generate path
$service->generatePath($hierarchy);

// Clear cache
$service->clearCache($hierarchy);
$service->clearAllCache();

// Debug
$hierarchy->toArray();
$path->getLevelIds();
$unit->getPath()->toString();
```

### **Exception Hierarchy**
```
RuntimeException
├── InvalidHierarchyException
├── InvalidParentChildException
├── MissingRequiredLevelException
├── MaxHierarchyDepthException
└── CountryNotSupportedException
```

This guide provides comprehensive debugging techniques and development patterns for working with the Geography Context implementation. The architecture follows DDD principles with clear boundaries, immutability, and testability.