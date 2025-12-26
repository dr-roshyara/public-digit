# 📘 **Developer Guide: Geography Context Implementation (DDD)**

## 🏗️ **Architecture Overview**

### **Bounded Context: Geography (Shared Kernel)**
**Purpose**: Manage geographic hierarchies for political party membership system

### **Architecture Layers:**
```
Geography Context
├── Domain Layer (Business Logic)
│   ├── Value Objects (7) - Immutable business concepts
│   ├── Entity (1) - GeoAdministrativeUnit (Aggregate Root)
│   ├── Repository Interface - GeoUnitRepositoryInterface
│   └── Domain Exceptions (5) - Business rule violations
├── Application Layer (Use Cases)
│   ├── GeographyPathService - Core path generation logic
│   └── GeographyAntiCorruptionLayer - Bridge to legacy system
├── Infrastructure Layer (Persistence)
│   └── EloquentGeoUnitRepository - Database implementation
└── Tests
    ├── Domain Value Objects (8 tests)
    ├── Application Services (5 + 8 tests)
    └── Comprehensive TDD coverage
```

---

## 🔧 **CORE COMPONENTS**

### **1. Value Objects (Immutable Business Concepts)**

#### **GeoPath** - PostgreSQL ltree path
```php
// Creation
$path = GeoPath::fromString('1.12.123');      // "1.12.123"
$path = GeoPath::fromIds([1, 12, 123]);       // Same from array

// Usage
$path->toString();           // "1.12.123"
$path->getDepth();           // 3
$path->getParentPath();      // GeoPath("1.12")
$path->isDescendantOf($parent); // true/false
$path->getLevelIds();        // [1, 12, 123]

// Validation: /^\d+(\.\d+)*$/
```

#### **CountryCode** - ISO 3166-1 alpha-2
```php
$country = CountryCode::fromString('NP');
$country->toString();        // "NP"
$country->getName();         // "Nepal"
$country->isSupported();     // true
$country->getHierarchyLevels(); // Array of level configs
$country->isLevelRequired(1); // true for Nepal
```

#### **GeographyHierarchy** - 8-level hierarchy
```php
$hierarchy = GeographyHierarchy::fromLevelIds(
    CountryCode::fromString('NP'),
    [1, 12, 123, null, null, null, null, null] // 8 levels
);

// Business rules enforced:
// 1. No gaps in hierarchy (level 2 missing, level 3 filled = ❌)
// 2. Required levels must be filled (NP requires levels 1-2)
// 3. All IDs must be integers or null

// Methods
$hierarchy->toGeoPath();     // Converts to GeoPath
$hierarchy->getFilledLevels(); // [1, 2, 3]
$hierarchy->getMissingLevels(); // [4, 5, 6, 7, 8]
$hierarchy->isComplete();    // false
$hierarchy->isEmpty();       // false
```

#### **Other Value Objects:**
- **GeoUnitId**: Positive integer wrapper (`fromInt(123)`)
- **GeographyLevel**: Level 1-8 with validation (`fromInt(3)`)
- **LocalizedName**: Multilingual names with fallback (`english('Kathmandu')`)
- **GeographicCode**: Official government codes (`fromString('NP-P1')`)

---

### **2. Entity: GeoAdministrativeUnit (Aggregate Root)**

```php
// Factory methods (preferred creation)
$root = GeoAdministrativeUnit::createRoot(
    GeoUnitId::fromInt(1),
    CountryCode::fromString('NP'),
    LocalizedName::english('Province 1')
);

$child = GeoAdministrativeUnit::createChild(
    GeoUnitId::fromInt(12),
    CountryCode::fromString('NP'),
    GeographyLevel::fromInt(2), // Must be > parent level
    $root,                      // Parent unit
    LocalizedName::english('District 12')
);

// Business rules enforced:
// 1. Cannot be own parent
// 2. Child level must be lower than parent level
// 3. Must belong to same country as parent
// 4. Path must match parent hierarchy

// State inspection
$unit->isRoot();              // true/false
$unit->isAncestorOf($other);  // true/false
$unit->isDescendantOf($other); // true/false
$unit->getDepth();            // Path depth
```

---

### **3. Domain Service: GeographyPathService**

**Purpose**: Generate and validate materialized paths with caching

```php
// Constructor dependencies
$service = new GeographyPathService(
    $repository,      // GeoUnitRepositoryInterface
    $cache            // Illuminate\Contracts\Cache\Repository
);

// Main method
$hierarchy = GeographyHierarchy::fromLevelIds(
    CountryCode::fromString('NP'),
    [1, 12, 123, 1234]
);

$path = $service->generatePath($hierarchy); // Returns GeoPath

// Validates:
// 1. All units exist
// 2. Units belong to correct country
// 3. Valid parent-child relationships
// 4. Required levels present
// 5. No hierarchy gaps

// Caching: 24-hour TTL
// Key: 'geo:path:' + md5(serialize(hierarchy))
```

---

### **4. Repository Pattern**

#### **Interface (Domain):**
```php
interface GeoUnitRepositoryInterface
{
    public function findById(GeoUnitId $unitId): ?GeoAdministrativeUnit;
    public function isChildOf(GeoUnitId $childId, GeoUnitId $parentId): bool;
    public function getCountryConfig(CountryCode $countryCode): array;
    public function validateHierarchy(CountryCode $countryCode, array $unitIds): bool;
    public function getParentId(GeoUnitId $unitId): ?GeoUnitId;
    public function getUnitsByLevel(CountryCode $countryCode, int $level): array;
    public function findMany(array $unitIds): array;
    public function unitExists(GeoUnitId $unitId): bool;
    public function getUnitCountryCode(GeoUnitId $unitId): ?CountryCode;
    public function getUnitLevel(GeoUnitId $unitId): ?int;
}
```

#### **Implementation (Infrastructure):**
```php
class EloquentGeoUnitRepository implements GeoUnitRepositoryInterface
{
    // Uses Eloquent models, converts to DDD Entities
    // Implements materialized path queries
    // Batch operations for performance
}
```

---

### **5. Anti-Corruption Layer**

**Purpose**: Bridge between legacy system and new DDD architecture

```php
class GeographyAntiCorruptionLayer
{
    // Same public API as old GeographyService
    // Internally converts to DDD, uses new services
    // Maintains backward compatibility
}

// Example: Legacy validation → DDD validation
public function validateGeographyHierarchy(string $countryCode, array $unitIds): bool
{
    // Convert primitives to Value Objects
    $countryCodeVO = CountryCode::fromString($countryCode);
    $hierarchy = GeographyHierarchy::fromLevelIds($countryCodeVO, $unitIds);
    
    // Use DDD service
    try {
        $this->pathService->generatePath($hierarchy);
        return true;
    } catch (DomainException $e) {
        return false; // Convert to legacy boolean
    }
}
```

---

## 🧪 **TESTING STRATEGY**

### **TDD Approach: RED → GREEN → REFACTOR**

#### **1. Value Object Tests** (`GeographyHierarchyTest.php`)
- 8 comprehensive tests
- Valid creation scenarios
- Invalid scenarios (gaps, missing required levels)
- Business rule validation

#### **2. Service Tests** (`GeographyPathServiceTest.php`)
- 5 unit tests with mocking
- Valid hierarchy generation
- Invalid hierarchy exceptions
- Caching behavior
- Parent-child validation

#### **3. Anti-Corruption Layer Tests** (`GeographyAntiCorruptionLayerTest.php`)
- 8 integration tests
- Legacy → DDD conversion
- Exception translation
- Delegation verification

### **Testing Philosophy:**
- **Isolation**: Each layer tested independently
- **Mocking**: External dependencies mocked
- **Business Rules**: Every rule has corresponding test
- **Edge Cases**: Empty hierarchies, gaps, invalid IDs

---

## 🚀 **DEVELOPMENT WORKFLOW**

### **Creating New Geography Units:**
```php
// 1. Create Value Objects
$countryCode = CountryCode::fromString('NP');
$unitId = GeoUnitId::fromInt(123);
$level = GeographyLevel::fromInt(3);
$name = LocalizedName::fromArray(['en' => 'Kathmandu', 'np' => 'काठमाडौं']);

// 2. Find parent (via repository)
$parent = $repository->findById(GeoUnitId::fromInt(12));

// 3. Create entity
$child = GeoAdministrativeUnit::createChild(
    $unitId, $countryCode, $level, $parent, $name
);

// 4. Save (when repository has save method)
// $repository->save($child);
```

### **Validating Member Geography:**
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
    // Handle: "Invalid geography hierarchy"
    return response()->json(['error' => $e->getMessage()], 400);
}
```

---

## 🔍 **DEBUGGING & MONITORING**

### **Common Issues & Solutions:**

#### **1. "Invalid ltree path format"**
```php
// Debug
dump($inputString); // Should match: /^\d+(\.\d+)*$/

// Common mistakes:
// "1.12. "   // Trailing space
// ".1.12"    // Leading dot  
// "1..12"    // Double dots
// "1.12.abc" // Non-numeric
```

#### **2. "Missing required level"**
```php
// Check country requirements
$country = CountryCode::fromString('NP');
dump($country->getRequiredLevels());
// Output: [1 => ['name' => 'Province', 'required' => true], ...]

// Solution: Provide required levels
$hierarchy = GeographyHierarchy::fromLevelIds($country, [1, 12]); // Levels 1+2 for NP
```

#### **3. "Gap in hierarchy"**
```php
// Invalid: [1, null, 3]  // Level 2 missing
// Valid: [1, 12, null]   // No gaps, stops at level 2
// Valid: [1, 12, 123]    // All filled, no gaps
```

### **Performance Debugging:**
```php
// Cache hit/miss monitoring
$start = microtime(true);
$path = $service->generatePath($hierarchy);
$time = microtime(true) - $start;

\Log::info("Path generation: {$time}s", [
    'cached' => $time < 0.01,
    'depth' => $hierarchy->getDepth()
]);
```

---

## 🏆 **BEST PRACTICES**

### **1. Always Use Factory Methods:**
```php
// GOOD
$hierarchy = GeographyHierarchy::fromLevelIds($countryCode, $levelIds);
$path = GeoPath::fromIds([1, 12, 123]);

// BAD - Direct construction bypasses validation
// new GeographyHierarchy(...)
```

### **2. Leverage Value Object Methods:**
```php
// Use built-in methods instead of manual logic
$path->isDescendantOf($parent); // Instead of string manipulation
$hierarchy->getFilledLevels();   // Instead of array_filter
$country->isLevelRequired(2);    // Instead of hardcoded checks
```

### **3. Exception-Driven Validation:**
```php
try {
    $path = $service->generatePath($hierarchy);
} catch (InvalidHierarchyException $e) {
    // Handle specific business rule violation
    return response()->json(['error' => $e->getMessage()], 400);
}
```

### **4. Immutable Design:**
```php
// Value Objects are readonly - cannot be modified
// Use with* methods for updates
$newHierarchy = $hierarchy->withLevel(3, 123);

// Entities protect their invariants
$unit->changeParent($newParentId); // Validates before changing
```

---

## 📊 **MIGRATION STRATEGY**

### **Phase 1: Foundation (COMPLETE)**
- ✅ Value Objects with validation
- ✅ Entity with business rules  
- ✅ Repository interface
- ✅ Domain service with TDD
- ✅ Anti-corruption layer

### **Phase 2: Database & Integration**
1. Create database migrations (TODO 3.1-3.3)
2. Seed with Nepal geography data
3. Connect repository to real database
4. Update anti-corruption layer to use DDD

### **Phase 3: Membership Integration**
1. Update Member entity with geography (TODO 2.1)
2. Create cross-context validation service (TODO 2.2)
3. Integrate with member registration

### **Phase 4: Production Deployment**
1. Performance testing with 1M+ records
2. Monitoring and alerting setup
3. Documentation and training

---

## 🔗 **INTEGRATION POINTS**

### **With Membership Context:**
```php
// Member registration will call:
$isValid = $geographyAntiCorruptionLayer->validateGeographyHierarchy(
    $countryCode,
    [$provinceId, $districtId, $localLevelId, $wardId]
);

// Returns: bool (backward compatible)
```

### **With Database:**
- **Landlord DB**: `geo_administrative_units` table (shared geography)
- **Tenant DBs**: `members` table references landlord geography IDs
- **Materialized Path**: `path` column enables efficient ancestor/descendant queries

### **With Legacy System:**
- Anti-corruption layer maintains same public API
- Gradual migration method-by-method
- Parallel operation during transition

---

## 📈 **PERFORMANCE CHARACTERISTICS**

### **Optimizations Implemented:**
1. **Materialized Path Pattern**: O(1) ancestor/descendant checks
2. **24-Hour Caching**: Reduces database queries
3. **Batch Operations**: `findMany()` reduces N+1 queries
4. **Database Indexes**: `country_code`, `admin_level`, `path` (GiST)

### **Expected Performance:**
- Path generation: < 10ms (cached), < 50ms (uncached)
- Hierarchy validation: < 20ms
- 1M+ records: Sub-second queries with proper indexes

---

## 🚨 **TROUBLESHOOTING CHECKLIST**

### **When Tests Fail:**
1. ✅ Check exception messages match exactly
2. ✅ Verify mock expectations are correct  
3. ✅ Ensure test data doesn't violate business rules
4. ✅ Check Value Object immutability isn't broken

### **When Service Fails:**
1. ✅ Verify repository returns correct entities
2. ✅ Check cache configuration
3. ✅ Ensure hierarchy validation passes
4. ✅ Verify parent-child relationships in DB

### **When Performance Suffers:**
1. ✅ Enable query logging for repository
2. ✅ Check cache hit rates
3. ✅ Verify database indexes exist
4. ✅ Profile with Xdebug/Blackfire

---

## 📚 **QUICK REFERENCE**

### **Common Operations:**
```php
// Create and validate hierarchy
$hierarchy = GeographyHierarchy::fromLevelIds($countryCode, $unitIds);
$path = $geographyPathService->generatePath($hierarchy);

// Check relationships
$path->isDescendantOf($parentPath);
$unit->isAncestorOf($otherUnit);

// Debug
$hierarchy->toArray();
$path->getLevelIds();
dump($country->getRequiredLevels());
```

### **Exception Hierarchy:**
```
RuntimeException
├── InvalidHierarchyException      // Invalid hierarchy
├── InvalidParentChildException    // Wrong parent-child
├── MissingRequiredLevelException  // Required level missing
├── MaxHierarchyDepthException     // Too many levels
└── CountryNotSupportedException   // Country not supported
```

---

## 🎯 **KEY SUCCESS METRICS**

1. **Test Coverage**: 100% on Domain layer
2. **Performance**: < 50ms for path generation
3. **Cache Hit Rate**: > 80% for repeated queries
4. **Data Integrity**: Zero invalid hierarchies in production
5. **Backward Compatibility**: All existing integrations work

---

## ✅ **IMPLEMENTATION STATUS**

**COMPLETE**: Phase 1 - DDD Foundation
- ✅ 7 Value Objects with validation
- ✅ 1 Aggregate Root Entity
- ✅ 1 Domain Service with TDD
- ✅ 1 Repository Interface + Implementation
- ✅ 5 Domain Exceptions
- ✅ 1 Anti-Corruption Layer
- ✅ 21 Comprehensive Tests

**READY FOR**: Phase 2 - Database & Integration

---

This guide provides everything needed to understand, use, and extend the Geography Context implementation. The architecture follows strict DDD principles with clear boundaries, immutability, and comprehensive testing. 