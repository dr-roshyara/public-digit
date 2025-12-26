# 🎯 **ARCHITECTURAL SYNTHESIS: CURRENT STATE & STRATEGIC PATH FORWARD**

I can see you've **already completed Day 1** of your implementation and have made significant progress. Let me analyze what you have and provide a focused continuation plan.

## 📊 **CURRENT STATE ANALYSIS**

### ✅ **WHAT YOU HAVE COMPLETED (Day 1):**

1. **Geography Service**: `GeographyService` with full caching, hierarchy validation, and query capabilities
2. **TenantUser-Member Integration**: Basic validation logic is in place
3. **Foundation**: Multi-tenant architecture with landlord/tenant separation

### 🔄 **WHAT'S MISSING FROM YOUR PHASE 1 PLAN:**

Based on your original plan, you need to complete:

```
DAY 2: Geography Path System (Materialized paths for performance) ❌
DAY 3: Jurisdiction Scope (Automatic data filtering) ❌  
DAY 4: API Controllers (RESTful endpoints) ❌
DAY 5: Vue Components (Admin UI with geography filtering) ❌
```

---

## 🚀 **STRATEGIC CONTINUATION PLAN (Days 2-5)**

Since you already have a solid `GeographyService`, let me provide the **exact next prompts** to continue your TDD/DDD implementation.

### **🎯 PROMPT 2.1: CREATE GEOGRAPHY PATH SYSTEM (DAY 2)**

```
Create PestPHP tests for GeographyPathService to implement materialized paths:

Test File: tests/Feature/Contexts/Membership/GeographyPathServiceTest.php

Requirements:
1. Extends TestCase and uses your existing test infrastructure
2. Mock GeographyService for hierarchy validation
3. Test PostgreSQL ltree path generation
4. Test path caching with Redis

Test Cases:
1. test_generates_ltree_path_for_member()
   - Input: Member with province=1, district=12, local=123, ward=1234
   - Expected: "1.12.123.1234" (ltree format)
   - Mock: GeographyService::validateHierarchy() returns true

2. test_throws_exception_for_invalid_hierarchy()
   - Setup: district not child of province
   - Mock: GeographyService::validateHierarchy() returns false
   - Expect: InvalidGeographyException

3. test_generates_partial_paths()
   - Input: Only province=1, district=12 (levels 3-4 null)
   - Expected: "1.12"
   - Should still be valid

4. test_caches_generated_paths()
   - Same member inputs should return cached path
   - Verify Cache::remember() is called

5. test_handles_custom_levels_5_8()
   - Input: All 8 levels (official 1-4 + custom 5-8)
   - Expected: "1.12.123.1234.12345.123456.1234567.12345678"
   - Note: Custom levels have different ID ranges

Follow TDD: Create test first, run to fail (red), then implement.
```

### **🎯 PROMPT 2.2: IMPLEMENT GEOGRAPHY PATH SERVICE**

```
Based on the failing tests from Prompt 2.1, implement GeographyPathService:

File: app/Contexts/Membership/Application/Services/GeographyPathService.php

Requirements:
1. Constructor accepts: GeographyService, Cache interface
2. Method: generatePath(array $geoIds): string (ltree path)
   - $geoIds = [level1, level2, level3, level4, level5, level6, level7, level8]
   - Can handle null values (partial paths)
3. Business Rules:
   - Validate hierarchy using GeographyService
   - Use PostgreSQL ltree format: "1.12.123.1234"
   - Cache paths with key: "geo:path:{hash_of_ids}"
   - TTL: 24 hours
4. Create DomainException: InvalidGeographyException
5. Use your existing GeographyService for validation

Implementation Steps:
1. Filter null values from $geoIds
2. Validate hierarchy using GeographyService::validateGeographyHierarchy()
3. Generate dot-separated string
4. Cache result
5. Return path
```

### **🎯 PROMPT 3.1: JURISDICTION SCOPE (DAY 3)**

```
Create tests for JurisdictionScope system:

Test File: tests/Feature/Contexts/Membership/JurisdictionScopeTest.php

Requirements:
1. Automatic filtering based on TenantUser's geography assignment
2. Should work with your existing TenantUser model (has admin_unit_level* columns)
3. Should integrate with Laravel's global scopes

Test Cases:
1. test_applies_jurisdiction_filter_to_member_queries()
   - Setup: TenantUser assigned to province=1
   - Query: Member::all()
   - Expected: Only members in province=1 returned
   - Verify SQL where clause

2. test_respects_tenant_user_without_geography()
   - Setup: TenantUser with null geography columns
   - Expected: No filtering applied (all members in tenant)
   - Verify no where clause added

3. test_applies_deep_hierarchy_filters()
   - Setup: TenantUser at ward level (level4)
   - Expected: Members filtered to exact ward
   - Should use ltree path matching

4. test_allows_admin_override()
   - Setup: Admin user (role=admin) should see all members
   - Expected: No jurisdiction filtering for admins
   - Verify scope is not applied

5. test_works_with_relationships()
   - Setup: Member with geography, query via relationship
   - Expected: Jurisdiction filter still applies
   - Test: tenantUser->members()->count()
```

### **🎯 PROMPT 3.2: IMPLEMENT JURISDICTION SCOPE**

```
Implement JurisdictionScope based on the tests:

File: app/Contexts/Membership/Application/Scopes/JurisdictionScope.php

Requirements:
1. Implements Laravel Global Scope
2. Constructor accepts current TenantUser
3. Apply WHERE clause based on TenantUser's geography:
   - If TenantUser has level1: WHERE admin_unit_level1_id = ?
   - If TenantUser has level2: WHERE admin_unit_level2_id = ?
   - If TenantUser has level4: Use ltree path matching
4. Skip for admin users (role = 'admin')
5. Skip if TenantUser has no geography assignment

Implementation Logic:
1. Check TenantUser role - skip if admin
2. Check geography columns - find deepest assigned level
3. Build WHERE clause accordingly
4. For level4, use GeographyPathService to get path

Register in AppServiceProvider:
Member::addGlobalScope(new JurisdictionScope(auth()->user()));
```

### **🎯 PROMPT 4.1: API CONTROLLERS (DAY 4)**

```
Create RESTful API controllers with TDD:

Test File: tests/Feature/Contexts/Membership/Api/MemberControllerTest.php

Test Cases:
1. test_index_returns_members_filtered_by_jurisdiction()
   - Authenticate as TenantUser with geography
   - GET /api/members
   - Assert only members in jurisdiction returned
   - Assert JSON structure with pagination

2. test_store_creates_member_with_geography_validation()
   - POST /api/members with valid data
   - Mock: MemberRegistrationService, GeographyPathService
   - Assert 201 Created with location header
   - Assert member created with correct geography

3. test_show_returns_member()
   - GET /api/members/{id}
   - Assert 200 OK with member data
   - Include geography path in response

4. test_update_validates_jurisdiction()
   - PATCH /api/members/{id}
   - Attempt to update member outside jurisdiction
   - Assert 403 Forbidden

5. test_destroy_soft_deletes_member()
   - DELETE /api/members/{id}
   - Assert soft delete
   - Assert 204 No Content

Follow Laravel API Resource pattern, use Form Requests.
```

### **🎯 PROMPT 4.2: IMPLEMENT MEMBER API CONTROLLER**

```
Implement MemberController based on tests:

Files to Create:
1. app/Contexts/Membership/Api/Controllers/MemberController.php
2. app/Contexts/Membership/Api/Requests/StoreMemberRequest.php
3. app/Contexts/Membership/Api/Requests/UpdateMemberRequest.php
4. app/Contexts/Membership/Api/Resources/MemberResource.php
5. app/Contexts/Membership/Api/Resources/MemberCollection.php

Requirements for Controller:
1. RESTful methods: index, store, show, update, destroy
2. Dependency injection: MemberRegistrationService, GeographyPathService
3. Use Form Requests for validation
4. Use API Resources for response formatting
5. Handle exceptions with JSON responses

Key Business Logic in StoreMemberRequest:
- Validate geography hierarchy exists
- Validate tenant_user_id is valid and belongs to tenant
- Validate membership number uniqueness

Routes in routes/api.php:
Route::apiResource('members', MemberController::class)
    ->middleware(['auth:sanctum', 'tenant']);
```

### **🎯 PROMPT 5.1: VUE COMPONENTS (DAY 5)**

```
Create Vue 3 components for member management:

Test File: tests/Feature/Contexts/Membership/Web/MemberIndexTest.php

Test Cases (Inertia.js):
1. test_member_index_page_loads_with_filtered_data()
   - Authenticate as TenantUser
   - Visit /members
   - Assert page contains member list
   - Assert only jurisdiction members shown

2. test_geography_filter_component_works()
   - Test chained dropdowns for geography filtering
   - Assert Vue component loads child units on parent selection
   - Assert filter applies to member list

3. test_create_member_modal_with_geography_validation()
   - Click "Add Member"
   - Fill form with invalid geography
   - Assert validation errors shown
   - Fill with valid data, assert success

4. test_member_card_generation_ui()
   - Select members, click "Generate Cards"
   - Assert PDF generation modal appears
   - Assert geography displayed on cards

Vue Component Structure:
1. MemberIndex.vue - Main page with table
2. MemberForm.vue - Create/Edit modal
3. GeographyFilter.vue - Chained dropdowns
4. MemberCardPreview.vue - PDF preview
```

---

## 🔧 **IMMEDIATE NEXT STEP (Day 2 Implementation)**

Since you're on **Day 2**, here's the exact code you need:

### **Step 1: Create the Test (GeographyPathServiceTest)**

```php
<?php

namespace Tests\Feature\Contexts\Membership;

use App\Contexts\Membership\Application\Services\GeographyPathService;
use App\Contexts\Membership\Domain\Exceptions\InvalidGeographyException;
use Mockery;
use Tests\TestCase;

class GeographyPathServiceTest extends TestCase
{
    private $geographyServiceMock;
    private $cacheMock;
    private $service;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->geographyServiceMock = Mockery::mock(
            'App\Contexts\Geography\Application\Services\GeographyService'
        );
        $this->cacheMock = Mockery::mock('Illuminate\Contracts\Cache\Repository');
        
        $this->service = new GeographyPathService(
            $this->geographyServiceMock,
            $this->cacheMock
        );
    }

    /** @test */
    public function test_generates_ltree_path_for_member(): void
    {
        // Arrange
        $geoIds = [1, 12, 123, 1234, null, null, null, null];
        
        $this->geographyServiceMock
            ->shouldReceive('validateGeographyHierarchy')
            ->with('NP', [1, 12, 123, 1234])
            ->once()
            ->andReturn(true);
            
        $this->cacheMock
            ->shouldReceive('remember')
            ->with('geo:path:' . md5(serialize([1, 12, 123, 1234])), 86400, Mockery::any())
            ->once()
            ->andReturn('1.12.123.1234');
        
        // Act
        $result = $this->service->generatePath($geoIds, 'NP');
        
        // Assert
        $this->assertEquals('1.12.123.1234', $result);
    }

    /** @test */
    public function test_throws_exception_for_invalid_hierarchy(): void
    {
        // Arrange
        $geoIds = [1, 12, 999, null, null, null, null, null];
        
        $this->geographyServiceMock
            ->shouldReceive('validateGeographyHierarchy')
            ->with('NP', [1, 12, 999])
            ->once()
            ->andReturn(false);
        
        // Assert
        $this->expectException(InvalidGeographyException::class);
        $this->expectExceptionMessage('Invalid geographic hierarchy');
        
        // Act
        $this->service->generatePath($geoIds, 'NP');
    }

    /** @test */
    public function test_generates_partial_paths(): void
    {
        // Arrange
        $geoIds = [1, 12, null, null, null, null, null, null];
        
        $this->geographyServiceMock
            ->shouldReceive('validateGeographyHierarchy')
            ->with('NP', [1, 12])
            ->once()
            ->andReturn(true);
            
        $this->cacheMock
            ->shouldReceive('remember')
            ->with('geo:path:' . md5(serialize([1, 12])), 86400, Mockery::any())
            ->once()
            ->andReturn('1.12');
        
        // Act
        $result = $this->service->generatePath($geoIds, 'NP');
        
        // Assert
        $this->assertEquals('1.12', $result);
    }

    /** @test */
    public function test_handles_custom_levels_5_8(): void
    {
        // Arrange
        $geoIds = [1, 12, 123, 1234, 50001, 50002, 50003, 50004];
        
        $this->geographyServiceMock
            ->shouldReceive('validateGeographyHierarchy')
            ->with('NP', [1, 12, 123, 1234])
            ->once()
            ->andReturn(true);
            
        $this->cacheMock
            ->shouldReceive('remember')
            ->with('geo:path:' . md5(serialize($geoIds)), 86400, Mockery::any())
            ->once()
            ->andReturn('1.12.123.1234.50001.50002.50003.50004');
        
        // Act
        $result = $this->service->generatePath($geoIds, 'NP');
        
        // Assert
        $this->assertEquals('1.12.123.1234.50001.50002.50003.50004', $result);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
```

### **Step 2: Create the Service (GeographyPathService)**

```php
<?php

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Geography\Application\Services\GeographyService;
use App\Contexts\Membership\Domain\Exceptions\InvalidGeographyException;
use Illuminate\Contracts\Cache\Repository as Cache;

class GeographyPathService
{
    public function __construct(
        private readonly GeographyService $geographyService,
        private readonly Cache $cache
    ) {}

    /**
     * Generate PostgreSQL ltree path from geography IDs
     * 
     * @param array $geoIds Array of 8 geography IDs [level1, level2, ..., level8]
     * @param string $countryCode ISO country code (default: 'NP')
     * @return string PostgreSQL ltree path (e.g., "1.12.123.1234")
     * @throws InvalidGeographyException
     */
    public function generatePath(array $geoIds, string $countryCode = 'NP'): string
    {
        // Ensure we have exactly 8 elements
        $geoIds = array_pad($geoIds, 8, null);
        
        // Filter out null values for validation (only validate official levels 1-4)
        $geoIdsForValidation = array_filter(
            array_slice($geoIds, 0, 4),
            fn($id) => !is_null($id)
        );
        
        // Validate hierarchy for official levels (1-4)
        if (!empty($geoIdsForValidation)) {
            $isValid = $this->geographyService->validateGeographyHierarchy(
                $countryCode,
                array_values($geoIdsForValidation)
            );
            
            if (!$isValid) {
                throw new InvalidGeographyException(
                    'Invalid geographic hierarchy for the provided units'
                );
            }
        }
        
        // Generate cache key
        $cacheKey = 'geo:path:' . md5(serialize($geoIds));
        
        // Generate path (cached)
        return $this->cache->remember($cacheKey, 86400, function () use ($geoIds) {
            // Filter null values and convert to string
            $pathParts = array_filter($geoIds, fn($id) => !is_null($id));
            
            // Convert to ltree format (dot-separated)
            return implode('.', $pathParts);
        });
    }
    
    /**
     * Parse ltree path back to array of IDs
     */
    public function parsePath(string $ltreePath): array
    {
        return array_map('intval', explode('.', $ltreePath));
    }
    
    /**
     * Clear cached paths for specific IDs
     */
    public function clearCache(array $geoIds): void
    {
        $cacheKey = 'geo:path:' . md5(serialize($geoIds));
        $this->cache->forget($cacheKey);
    }
}
```

### **Step 3: Create the Exception**

```php
<?php

namespace App\Contexts\Membership\Domain\Exceptions;

use Exception;

class InvalidGeographyException extends Exception
{
    public function __construct(string $message = "Invalid geographic hierarchy")
    {
        parent::__construct($message);
    }
}
```

---

## 📊 **PROGRESS TRACKER**

| **Day** | **Component** | **Status** | **Next Action** |
|---------|--------------|------------|-----------------|
| Day 1 | TenantUser Validator | ✅ **COMPLETE** | - |
| Day 2 | Geography Path System | 🟡 **IN PROGRESS** | Implement above code |
| Day 3 | Jurisdiction Scope | ⏳ **PENDING** | Create tests & implementation |
| Day 4 | API Controllers | ⏳ **PENDING** | RESTful endpoints |
| Day 5 | Vue Components | ⏳ **PENDING** | Admin UI with filtering |

---

## 🎯 **IMMEDIATE ACTION ITEMS**

1. **Run the test**: `php artisan test tests/Feature/Contexts/Membership/GeographyPathServiceTest.php` (should fail - RED)
2. **Implement the service**: Create the GeographyPathService above
3. **Run test again**: Should pass (GREEN)
4. **Refactor**: Optimize caching logic if needed
5. **Integrate with Member model**: Add `geo_path` column and update on save

---

## 🔗 **INTEGRATION WITH YOUR EXISTING CODE**

Your existing `GeographyService` already has `validateGeographyHierarchy()` method, which the new `GeographyPathService` will use. The integration is clean:

```php
// In MemberRegistrationService or Member model
$geoPath = app(GeographyPathService::class)->generatePath([
    $member->admin_unit_level1_id,
    $member->admin_unit_level2_id,
    // ... up to level8
]);

$member->geo_path = $geoPath;
$member->save();
```

---

## 🚀 **RECOMMENDED WORKFLOW FOR DAYS 2-5**

1. **Today (Day 2)**: Implement GeographyPathService (2-3 hours)
2. **Tomorrow AM (Day 3)**: Implement JurisdictionScope (2 hours)
3. **Tomorrow PM (Day 4)**: Create API controllers (3 hours)
4. **Day After (Day 5)**: Build Vue components (4 hours)

**Total estimated time**: 11-12 hours to complete Phase 1

---

## ❓ **QUESTIONS FOR YOU:**

1. **Should I provide the exact code for each day's implementation as above?**
2. **Do you want to adjust the timeline based on your availability?**
3. **Should we add any additional features to Phase 1 based on your current needs?**
4. **Do you need help integrating these components with your existing Member model?**

**Let me know which specific component you want to tackle next, and I'll provide the exact TDD implementation code.**