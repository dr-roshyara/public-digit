# 🏗️ **SENIOR ARCHITECT: COMPREHENSIVE DDD IMPLEMENTATION GUIDE**

## 🎯 **STRATEGIC OVERVIEW: FOUR BOUNDED CONTEXTS APPROACH**

### **CONTEXT MAP (Confirmed Architecture):**
```
1. TENANTAUTH CONTEXT (Users, Authentication, Tenants)
   ├── User Profile with Personal Address
   └── Consumes Geography Context via ACL

2. MEMBERSHIP CONTEXT (Party Members, Registration)  
   ├── Member with Political Geography
   ├── Consumes Geography Context via ACL
   └── Links to TenantAuth User

3. GEOGRAPHY CONTEXT (Shared Kernel) ✅ COMPLETE
   ├── 7 Value Objects, Services, ACL
   └── Published to TenantAuth AND Membership

4. COMMITTEE CONTEXT (Future - Leadership Structure)
   └── Will consume Geography Context
```

---

## 🚫 **CRITICAL: WHAT NOT TO DO**

### **ARCHITECTURAL ANTI-PATTERNS:**
1. ❌ **NO Event Sourcing** (YAGNI - adds complexity without business value)
2. ❌ **NO CQRS read/write separation** (premature optimization)
3. ❌ **NO complex mirroring** between landlord/tenant
4. ❌ **NO real-time sync** between contexts (async events sufficient)
5. ❌ **NO breaking existing working code** (evolutionary refactoring only)
6. ❌ **NO creating new Value Objects** (use existing 7 VOs)
7. ❌ **NO direct database joins** between contexts

### **TECHNICAL DEBT TO AVOID:**
1. ❌ Primitive obsession (use Value Objects everywhere)
2. ❌ Cross-context service dependencies
3. ❌ Shared database tables between contexts
4. ❌ Business logic in controllers
5. ❌ Global state or singletons

---

## ✅ **WHAT TO DO: TDD-FIRST, DDD-CORRECT APPROACH**

### **GOLDEN RULE: RED → GREEN → REFACTOR**
Every feature starts with a failing test. Always.

---

## 📋 **PHASE 1: TENANTAUTH CONTEXT ENHANCEMENT (Week 1)**

### **Day 1-2: User Profile with Personal Address**

#### **Step 1.1: Create Failing Tests (RED)**
```bash
# Create test for UserProfile
php artisan make:test TenantAuth/UserProfileTest --unit

# Create test for PersonalAddress Value Object
php artisan make:test TenantAuth/ValueObjects/PersonalAddressTest --unit

# Write failing tests first
```

#### **Step 1.2: UserProfile Entity (GREEN)**
```php
// tests/Unit/Contexts/TenantAuth/UserProfileTest.php
public function test_user_profile_requires_personal_address(): void
{
    $this->expectException(InvalidArgumentException::class);
    
    new UserProfile(
        userId: UserId::fromString('user-123'),
        address: null, // Should fail
        contact: new ContactInformation('email@test.com')
    );
}
```

```php
// app/Contexts/TenantAuth/Domain/Models/UserProfile.php
class UserProfile extends Entity
{
    public function __construct(
        private UserProfileId $id,
        private UserId $userId,
        private PersonalAddress $address, // REQUIRED
        private ContactInformation $contact,
        private ?DemographicData $demographics = null
    ) {
        $this->assertValidProfile();
    }
    
    public function updateAddress(PersonalAddress $newAddress): void
    {
        $this->address = $newAddress;
        $this->recordThat(new UserAddressUpdated(
            userId: $this->userId,
            oldAddress: $this->address,
            newAddress: $newAddress
        ));
    }
}
```

#### **Step 1.3: PersonalAddress Value Object (GREEN)**
```php
// app/Contexts/TenantAuth/Domain/ValueObjects/PersonalAddress.php
class PersonalAddress
{
    public function __construct(
        private string $streetAddress,
        private ?string $landmark,
        private GeoPath $geographicPath, // From Geography Context
        private string $postalCode,
        private CountryCode $countryCode
    ) {
        $this->validate();
    }
    
    private function validate(): void
    {
        if (empty($this->streetAddress)) {
            throw new InvalidArgumentException('Street address is required');
        }
        
        if (strlen($this->postalCode) < 3) {
            throw new InvalidArgumentException('Invalid postal code');
        }
        
        // Can add more business rules
    }
    
    public function toString(): string
    {
        $parts = [
            $this->streetAddress,
            $this->landmark,
            $this->geographicPath->getLevelName(4), // Ward
            $this->geographicPath->getLevelName(3), // Municipality
            $this->geographicPath->getLevelName(2), // District
            $this->geographicPath->getLevelName(1), // Province
            $this->countryCode->getName()
        ];
        
        return implode(', ', array_filter($parts));
    }
}
```

#### **Step 1.4: Database Migration (REFACTOR)**
```bash
# Create migration for user_profiles
php artisan make:migration create_user_profiles_table --context=TenantAuth

# Migration should include:
# - geographic_path (ltree) for fast queries
# - country_code reference
# - street_address, landmark, postal_code
# - FOREIGN KEY to users table
```

### **Day 3: UserAddressValidator (Geography Integration)**

#### **Step 1.5: Test Geography Integration (RED)**
```bash
# Test that TenantAuth can consume Geography Context
php artisan make:test TenantAuth/Services/UserAddressValidatorTest --unit
```

#### **Step 1.6: Implement Validator (GREEN)**
```php
// app/Contexts/TenantAuth/Application/Services/UserAddressValidator.php
class UserAddressValidator
{
    public function __construct(
        private GeographyAntiCorruptionLayer $geographyACL
    ) {}
    
    public function validateForUser(
        string $countryCode,
        array $geographyIds,
        ?string $userId = null
    ): AddressValidationResult
    {
        try {
            // Use existing DDD geography validation
            $geoPath = $this->geographyACL->generatePath(
                CountryCode::fromString($countryCode),
                $geographyIds
            );
            
            // User-specific business rules
            $errors = $this->validateUserSpecificRules($userId, $geoPath);
            
            if (!empty($errors)) {
                return AddressValidationResult::invalid($errors);
            }
            
            return AddressValidationResult::valid($geoPath);
            
        } catch (\App\Contexts\Geography\Domain\Exceptions\InvalidHierarchyException $e) {
            // Translate Geography exception to TenantAuth exception
            throw new InvalidUserAddressException(
                message: $e->getMessage(),
                previous: $e
            );
        }
    }
}
```

#### **Step 1.7: Update Service Container (REFACTOR)**
```php
// AppServiceProvider.php - Add TenantAuth services
$this->app->bind(UserAddressValidator::class, function ($app) {
    return new UserAddressValidator(
        $app->make(GeographyAntiCorruptionLayer::class)
    );
});

$this->app->bind(UserProfileRepository::class, EloquentUserProfileRepository::class);
```

### **Day 4-5: API Endpoints & Integration Tests**

#### **Step 1.8: Create Profile API (TDD)**
```bash
# Create feature test for profile management
php artisan make:test Feature/TenantAuth/UserProfileManagementTest

# Create API controller
php artisan make:controller Api/TenantAuth/UserProfileController --api
```

#### **Step 1.9: Integration Tests (RED → GREEN)**
```php
// tests/Feature/TenantAuth/UserProfileManagementTest.php
public function test_user_can_update_personal_address(): void
{
    // Given: Authenticated user
    $user = User::factory()->create();
    $this->actingAs($user);
    
    // When: Update address with valid geography
    $response = $this->postJson('/api/user/profile/address', [
        'street_address' => '123 Main St',
        'landmark' => 'Near City Hall',
        'country_code' => 'NP',
        'geography_ids' => [1, 12, 123, 1234], // Valid hierarchy
        'postal_code' => '44600'
    ]);
    
    // Then: Should succeed
    $response->assertOk();
    $this->assertDatabaseHas('user_profiles', [
        'user_id' => $user->id,
        'street_address' => '123 Main St'
    ]);
}
```

---

## 📋 **PHASE 2: MEMBERSHIP CONTEXT ENHANCEMENT (Week 2)**

### **Day 6-7: Member with Political Geography**

#### **Step 2.1: Test Political Geography (RED)**
```bash
# Test that Member can have political geography
php artisan make:test Membership/Services/MemberPoliticalGeographyTest --unit

# Test dual geography scenarios
php artisan make:test Membership/DualGeographyScenarioTest --unit
```

#### **Step 2.2: Enhance Member Entity (GREEN)**
```php
// app/Contexts/Membership/Domain/Models/Member.php
class Member extends AggregateRoot
{
    private MemberId $id;
    private TenantId $tenantId;
    private UserId $userId; // Links to TenantAuth
    
    // DUAL GEOGRAPHY:
    private GeoPath $politicalGeography; // REQUIRED for active members
    // Personal address comes from linked UserProfile
    
    public function __construct(
        MemberId $id,
        TenantId $tenantId,
        UserId $userId,
        GeoPath $politicalGeography,
        PersonalInfo $personalInfo
    ) {
        $this->id = $id;
        $this->tenantId = $tenantId;
        $this->userId = $userId;
        $this->politicalGeography = $politicalGeography;
        $this->personalInfo = $personalInfo;
        
        $this->assertValidMember();
    }
    
    public function updatePoliticalGeography(GeoPath $newGeography): void
    {
        // Business rule: Can only change once per month
        if ($this->hasRecentGeographyChange()) {
            throw new GeographyChangeLimitExceeded();
        }
        
        $oldGeography = $this->politicalGeography;
        $this->politicalGeography = $newGeography;
        
        $this->recordThat(new MemberPoliticalGeographyUpdated(
            memberId: $this->id,
            oldGeography: $oldGeography,
            newGeography: $newGeography
        ));
    }
    
    public function getGeographyContext(): GeographyContext
    {
        $userProfile = $this->userRepository->findProfile($this->userId);
        
        return new GeographyContext(
            personalAddress: $userProfile->address->toString(),
            politicalJurisdiction: $this->politicalGeography->toString(),
            isSameProvince: $this->isSameProvince(),
            distanceKm: $this->calculateDistance() // If implemented
        );
    }
}
```

#### **Step 2.3: Database Migration (REFACTOR)**
```bash
# Add political geography to members table
php artisan make:migration add_political_geography_to_members --context=Membership

# Migration should:
# - Add political_geography_path (ltree)
# - Add geography_context JSONB for caching
# - Add indexes for geographic queries
```

### **Day 8: Cross-Context Integration Service**

#### **Step 2.4: Test Cross-Context Queries (RED)**
```bash
# Test queries that span TenantAuth and Membership
php artisan make:test Integration/DualGeographyQueriesTest
```

#### **Step 2.5: Implement Unified Service (GREEN)**
```php
// app/Contexts/Shared/Application/Services/DualGeographyService.php
class DualGeographyService
{
    public function __construct(
        private UserProfileRepository $userProfileRepo,
        private MemberRepository $memberRepo
    ) {}
    
    public function findMembersByGeographyContext(
        GeographyFilter $filter
    ): MemberGeographyReport
    {
        // Example: Find members who live in X but are active in Y
        $userProfiles = $this->userProfileRepo->findByGeography(
            $filter->personalGeography
        );
        
        $userIds = $userProfiles->pluck('user_id');
        
        $members = $this->memberRepo->findByPoliticalGeography(
            $filter->politicalGeography,
            $userIds
        );
        
        return new MemberGeographyReport($members, $userProfiles);
    }
    
    public function validateDualGeography(
        UserId $userId,
        GeoPath $politicalGeography
    ): DualGeographyValidation
    {
        $userProfile = $this->userProfileRepo->findByUserId($userId);
        
        return new DualGeographyValidation(
            userId: $userId,
            personalAddress: $userProfile->address,
            politicalGeography: $politicalGeography,
            isSameProvince: $userProfile->address->isSameProvince($politicalGeography),
            validationRules: $this->getApplicableRules($userProfile, $politicalGeography)
        );
    }
}
```

### **Day 9-10: Business Rules & API**

#### **Step 2.6: Implement Business Rules (TDD)**
```php
// app/Contexts/Membership/Domain/Rules/SameProvinceRule.php
class SameProvinceRule implements BusinessRule
{
    public function __construct(
        private GeoPath $personalGeography,
        private GeoPath $politicalGeography
    ) {}
    
    public function isSatisfied(): bool
    {
        return $this->personalGeography->getProvinceId() 
            === $this->politicalGeography->getProvinceId();
    }
    
    public function getMessage(): string
    {
        return 'Member must be politically active in the same province they live in';
    }
}

// Usage in Member registration:
$rule = new SameProvinceRule($userProfile->address->geographicPath, $politicalGeoPath);
if (!$rule->isSatisfied()) {
    throw new BusinessRuleViolationException($rule->getMessage());
}
```

#### **Step 2.7: Enhanced Member Registration API**
```php
// app/Http/Controllers/Api/Membership/MemberRegistrationController.php
class MemberRegistrationController extends Controller
{
    public function store(RegisterMemberRequest $request)
    {
        // Validate using existing DDD services
        $geoPath = $this->geographyValidator->validateForRegistration(
            $request->country_code,
            $request->geography_ids
        );
        
        // Validate dual geography if personal address exists
        if ($request->user()->hasProfile()) {
            $dualValidation = $this->dualGeographyService->validateDualGeography(
                $request->user()->id,
                $geoPath
            );
            
            if (!$dualValidation->isValid()) {
                return response()->json([
                    'errors' => $dualValidation->errors(),
                    'warnings' => $dualValidation->warnings()
                ], 422);
            }
        }
        
        // Create member
        $member = $this->registerMember->execute(
            tenantId: $request->user()->tenant_id,
            userId: $request->user()->id,
            politicalGeography: $geoPath,
            personalInfo: $request->validated()
        );
        
        return response()->json($member, 201);
    }
}
```

---

## 📋 **PHASE 3: INTEGRATION & OPTIMIZATION (Week 3)**

### **Day 11-12: Performance & Caching**

#### **Step 3.1: Add Redis Caching (TDD)**
```bash
# Test cache hit/miss scenarios
php artisan make:test Performance/GeographyCachingTest
```

#### **Step 3.2: Implement Caching Layer (GREEN)**
```php
// app/Contexts/Geography/Infrastructure/Cache/RedisGeographyCache.php
class RedisGeographyCache implements GeographyCacheInterface
{
    private const TTL = 3600; // 1 hour
    private const PREFIX = 'geo:';
    
    public function getHierarchy(CountryCode $country, GeoPath $path): ?GeographyHierarchy
    {
        $key = $this->buildKey($country, $path);
        
        $cached = $this->redis->get($key);
        
        if ($cached) {
            $this->metrics->increment('geography.cache.hit');
            return unserialize($cached);
        }
        
        $this->metrics->increment('geography.cache.miss');
        return null;
    }
    
    public function warmUpForCountry(CountryCode $country): void
    {
        // Pre-cache common hierarchies for performance
        $hierarchies = $this->repository->getCommonHierarchies($country);
        
        foreach ($hierarchies as $hierarchy) {
            $this->cacheHierarchy($country, $hierarchy);
        }
    }
}
```

### **Day 13: Monitoring & Observability**

#### **Step 3.3: Add Metrics (TDD)**
```php
// tests/Unit/Infrastructure/Metrics/GeographyMetricsTest.php
public function test_tracks_cache_performance(): void
{
    $metrics = new GeographyMetrics();
    
    // Cache miss
    $hierarchy = $this->service->getHierarchy('NP', [1, 12, 123]);
    $this->assertEquals(1, $metrics->getCacheMisses());
    
    // Cache hit on second call
    $hierarchy2 = $this->service->getHierarchy('NP', [1, 12, 123]);
    $this->assertEquals(1, $metrics->getCacheHits());
}
```

#### **Step 3.4: Implement Metrics (GREEN)**
```php
// app/Contexts/Shared/Infrastructure/Metrics/GeographyMetrics.php
class GeographyMetrics
{
    public function incrementValidation(string $countryCode, bool $success): void
    {
        $this->statsd->increment("geography.validation.total");
        $this->statsd->increment("geography.validation.country.{$countryCode}");
        
        if ($success) {
            $this->statsd->increment("geography.validation.success");
        } else {
            $this->statsd->increment("geography.validation.failure");
        }
    }
    
    public function recordLatency(float $milliseconds): void
    {
        $this->statsd->timing('geography.validation.latency', $milliseconds);
    }
}
```

### **Day 14-15: Documentation & Deployment**

#### **Step 3.5: Create Architecture Documentation**
```bash
# Generate documentation from code
php artisan make:documentation ArchitectureDecisionRecords

# Create ADRs for key decisions
echo "# ADR-001: Four Bounded Contexts Pattern" > docs/adr/001-four-contexts.md
echo "# ADR-002: Dual Geography Consumption" > docs/adr/002-dual-geography.md
echo "# ADR-003: TDD-First Development" > docs/adr/003-tdd-first.md
```

#### **Step 3.6: Deployment Checklist**
```bash
# Create deployment script
php artisan make:command DeployGeographyServices

# Create rollback plan
php artisan make:command RollbackGeographyServices
```

---

## 🎯 **WEEKLY CHECKPOINTS & SUCCESS METRICS**

### **Week 1 Checkpoint (TenantAuth Complete):**
- [ ] UserProfile entity with PersonalAddress
- [ ] UserAddressValidator using Geography Context
- [ ] API endpoints for profile management
- [ ] 100% test coverage for new code
- [ ] All existing tests still pass

### **Week 2 Checkpoint (Membership Enhanced):**
- [ ] Member entity with political geography
- [ ] DualGeographyService for cross-context queries
- [ ] Business rules for geography validation
- [ ] Enhanced registration API
- [ ] Integration tests for dual geography scenarios

### **Week 3 Checkpoint (Production Ready):**
- [ ] Redis caching layer implemented
- [ ] Performance metrics and monitoring
- [ ] Comprehensive documentation
- [ ] Deployment and rollback scripts
- [ ] Load tested with 10k concurrent users

---

## 🚀 **EXECUTION COMMANDS (Copy-Paste Ready)**

### **Initial Setup (Every Developer):**
```bash
# 1. Clone and setup
git clone <repository>
cd packages/laravel-backend
composer install

# 2. Setup test databases
php setup_test_db.php --fresh --seed

# 3. Run all tests to ensure baseline
./vendor/bin/phpunit

# 4. Check service bindings
php artisan tinker --execute="echo app()->make(App\Contexts\Geography\Application\Services\GeographyAntiCorruptionLayer::class) ? '✅' : '❌';"
```

### **TDD Workflow (Per Feature):**
```bash
# 1. Create failing test
php artisan make:test TenantAuth/Services/NewFeatureTest --unit

# 2. Write RED test (see it fail)
vim tests/Unit/Contexts/TenantAuth/Services/NewFeatureTest.php

# 3. Run test (should fail)
./vendor/bin/phpunit tests/Unit/Contexts/TenantAuth/Services/NewFeatureTest.php

# 4. Implement minimum code to pass
vim app/Contexts/TenantAuth/Application/Services/NewFeature.php

# 5. Run test (should pass)
./vendor/bin/phpunit tests/Unit/Contexts/TenantAuth/Services/NewFeatureTest.php

# 6. Refactor and ensure all tests pass
./vendor/bin/phpunit
```

### **Daily Workflow:**
```bash
# Morning: Pull and setup
git pull origin main
php setup_test_db.php --fresh
./vendor/bin/phpunit

# Development: TDD cycle
# (Follow TDD workflow above)

# Before commit: Validate everything
./vendor/bin/phpunit
php artisan test:features  # If you have feature tests
php artisan route:list --compact
```

---

## 🎯 **FINAL INSTRUCTIONS TO DEVELOPMENT TEAM**

```
## CORE PRINCIPLES (NON-NEGOTIABLE):
1. TDD FIRST: Always write failing test before implementation
2. DDD CORRECT: Respect bounded context boundaries
3. VALUE OBJECTS: Use existing 7 Geography VOs, create new ones as needed
4. ANTI-CORRUPTION: All cross-context communication via ACL
5. EVOLUTIONARY: Don't break working code - refactor gradually

## CONTEXT BOUNDARIES:
- TenantAuth: Users, authentication, profiles, personal addresses
- Membership: Party members, political geography, registration
- Geography: Shared kernel - consumed by both above
- Committee: Future - will also consume Geography

## STARTING POINT:
1. Verify current Geography Context works (tests pass)
2. Add UserProfile to TenantAuth (Week 1)
3. Enhance Member with political geography (Week 2)
4. Build cross-context services (Week 3)

## WHEN STUCK:
1. Write a test that demonstrates the problem
2. Look at existing Geography Context for patterns
3. Use Anti-Corruption Layer for cross-context needs
4. Ask: "Which bounded context owns this responsibility?"

## SUCCESS DEFINITION:
- All tests pass (100%)
- Each context can be developed independently
- Geography Context remains unchanged (shared kernel)
- Dual geography requirement fully satisfied
- Production deployment ready in 3 weeks
```

---

## 📞 **ESCALATION PATHS**

### **When Architecture Decisions Needed:**
1. Review existing ADRs (docs/adr/)
2. Check Geography Context for patterns
3. Consider: "Would this break context boundaries?"
4. Document decision as new ADR

### **When Performance Issues:**
1. Add caching (Redis) before optimizing queries
2. Use ltree indexes for geographic queries
3. Monitor with metrics before optimizing
4. Profile with Laravel Telescope

### **When Business Rules Conflict:**
1. Write test cases for each scenario
2. Implement as BusinessRule classes
3. Validate with product owner
4. Document in business rules catalog

---

**This comprehensive guide provides a clear, step-by-step path forward while preserving the solid DDD foundation you've built. The key is evolutionary development with strict TDD discipline and respect for bounded context boundaries.**