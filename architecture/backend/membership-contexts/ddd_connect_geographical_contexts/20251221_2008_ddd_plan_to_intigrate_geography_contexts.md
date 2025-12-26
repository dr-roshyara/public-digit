# 🚀 **Phase 2: Membership Context Integration - Implementation Guide**

## 📋 **OVERVIEW**

**Objective**: Integrate Geography Context with Membership Context to enable geographic-based party membership management with full validation.

**Duration**: 2 days  
**Prerequisites**: ✅ Phase 1 (Geography Context) complete

---

## 🎯 **IMPLEMENTATION TASKS**

### **TASK 2.1: UPDATE MEMBER AGGREGATE WITH GEOGRAPHY**

#### **Goal**: Add geographic location to Member entities with proper validation

#### **Step-by-Step Implementation:**

```php
// 1. Add geography fields to Member entity (Domain/Member/Entities/Member.php)
class Member extends AggregateRoot
{
    private GeoPath $geographyPath;  // Materialized path (e.g., "1.12.123.1234")
    private CountryCode $countryCode; // ISO country code
    
    // 2. Add geography to factory methods
    public static function registerMember(
        MemberId $id,
        PersonalInfo $personalInfo,
        PartyMembershipInfo $partyInfo,
        CountryCode $countryCode,
        GeoPath $geographyPath
    ): self {
        $member = new self();
        $member->apply(new MemberRegistered(
            $id,
            $personalInfo,
            $partyInfo,
            $countryCode->toString(),
            $geographyPath->toString()
        ));
        
        return $member;
    }
    
    // 3. Add geography update method
    public function updateGeography(
        CountryCode $countryCode,
        GeoPath $geographyPath
    ): void {
        if (!$this->geographyPath->equals($geographyPath) || 
            !$this->countryCode->equals($countryCode)) {
            
            $this->apply(new MemberGeographyUpdated(
                $this->id,
                $countryCode->toString(),
                $geographyPath->toString()
            ));
        }
    }
    
    // 4. Add geography getters
    public function getGeographyPath(): GeoPath
    {
        return $this->geographyPath;
    }
    
    public function getCountryCode(): CountryCode
    {
        return $this->countryCode;
    }
}
```

#### **Step-by-Step Instructions:**

1. **Update Member Entity**:
   - Add `GeoPath $geographyPath` and `CountryCode $countryCode` properties
   - Update constructor and factory methods to accept geography parameters
   - Add `updateGeography()` method for changes
   - Add getters for geography information

2. **Update Member Domain Events**:
   ```php
   // Domain/Member/Events/MemberRegistered.php
   class MemberRegistered implements DomainEvent
   {
       public function __construct(
           private MemberId $memberId,
           private PersonalInfo $personalInfo,
           private PartyMembershipInfo $partyInfo,
           private string $countryCode,
           private string $geographyPath
       ) {}
       
       // Add getters for geography fields
       public function getCountryCode(): string { return $this->countryCode; }
       public function getGeographyPath(): string { return $this->geographyPath; }
   }
   ```

3. **Update Member Projections**:
   ```php
   // Infrastructure/Member/Projections/MemberProjector.php
   public function onMemberRegistered(MemberRegistered $event): void
   {
       DB::table('members')->insert([
           'id' => $event->getMemberId()->toString(),
           'country_code' => $event->getCountryCode(),
           'geography_path' => $event->getGeographyPath(),
           // ... other fields
       ]);
   }
   ```

4. **Create Database Migration**:
   ```php
   // database/migrations/YYYY_MM_DD_add_geography_to_members.php
   Schema::table('members', function (Blueprint $table) {
       $table->string('country_code', 2)->after('id');
       $table->string('geography_path')->nullable()->after('country_code');
       
       // Index for geographic queries
       $table->index(['country_code', 'geography_path']);
   });
   ```

---

### **TASK 2.2: CREATE CROSS-CONTEXT SERVICE**

#### **Goal**: Create a service that validates geography when members register or update

#### **Step-by-Step Implementation:**

```php
// Application/Membership/Services/MemberGeographyValidator.php
namespace App\Application\Membership\Services;

use App\Domain\Geography\Services\GeographyPathService;
use App\Domain\Geography\ValueObjects\CountryCode;
use App\Domain\Geography\ValueObjects\GeographyHierarchy;
use App\Domain\Membership\ValueObjects\MemberRegistrationData;

class MemberGeographyValidator
{
    public function __construct(
        private GeographyPathService $geographyPathService
    ) {}
    
    /**
     * Validate geography for new member registration
     * 
     * @throws InvalidMemberGeographyException
     */
    public function validateForRegistration(MemberRegistrationData $data): void
    {
        // 1. Convert input to geography value objects
        $countryCode = CountryCode::fromString($data->getCountryCode());
        $hierarchy = GeographyHierarchy::fromLevelIds(
            $countryCode,
            $data->getGeographyIds() // [province, district, localLevel, ward]
        );
        
        // 2. Generate and validate path
        try {
            $geographyPath = $this->geographyPathService->generatePath($hierarchy);
            
            // 3. Additional business rules
            $this->validateGeographyRules($countryCode, $geographyPath);
            
        } catch (\Domain\Geography\Exceptions\InvalidHierarchyException $e) {
            throw InvalidMemberGeographyException::invalidHierarchy($e->getMessage());
        } catch (\Domain\Geography\Exceptions\CountryNotSupportedException $e) {
            throw InvalidMemberGeographyException::unsupportedCountry($data->getCountryCode());
        }
    }
    
    /**
     * Business rules specific to membership
     */
    private function validateGeographyRules(CountryCode $countryCode, GeoPath $path): void
    {
        // Rule 1: Must have minimum depth (e.g., at least district level)
        if ($path->getDepth() < 2) {
            throw InvalidMemberGeographyException::insufficientDetail();
        }
        
        // Rule 2: Country-specific rules
        if ($countryCode->toString() === 'NP' && $path->getDepth() < 3) {
            // Nepal requires at least local level
            throw InvalidMemberGeographyException::insufficientDetail(
                'Nepal requires at least local level detail'
            );
        }
        
        // Rule 3: Future: Check if geography is allowed for party
        // (e.g., party only operates in certain regions)
    }
}
```

#### **Step-by-Step Instructions:**

1. **Create MemberGeographyValidator**:
   ```bash
   php artisan make:service MemberGeographyValidator --domain=Membership
   ```

2. **Create MemberRegistrationData Value Object**:
   ```php
   // Domain/Membership/ValueObjects/MemberRegistrationData.php
   class MemberRegistrationData
   {
       public function __construct(
           private string $countryCode,
           private array $geographyIds, // [province, district, localLevel, ward]
           // ... other registration fields
       ) {}
       
       public function getCountryCode(): string { return $this->countryCode; }
       public function getGeographyIds(): array { return $this->geographyIds; }
   }
   ```

3. **Create InvalidMemberGeographyException**:
   ```php
   // Domain/Membership/Exceptions/InvalidMemberGeographyException.php
   class InvalidMemberGeographyException extends \RuntimeException
   {
       public static function invalidHierarchy(string $message): self
       {
           return new self("Invalid geography hierarchy: {$message}");
       }
       
       public static function unsupportedCountry(string $countryCode): self
       {
           return new self("Country '{$countryCode}' is not supported for membership");
       }
       
       public static function insufficientDetail(string $message = null): self
       {
           return new self($message ?? "Insufficient geographic detail provided");
       }
   }
   ```

4. **Update Registration Command Handler**:
   ```php
   // Application/Membership/Commands/RegisterMemberHandler.php
   class RegisterMemberHandler
   {
       public function __construct(
           private MemberRepository $memberRepository,
           private MemberGeographyValidator $geographyValidator
       ) {}
       
       public function handle(RegisterMemberCommand $command): void
       {
           // 1. Validate geography
           $registrationData = new MemberRegistrationData(
               $command->getCountryCode(),
               $command->getGeographyIds()
           );
           
           $this->geographyValidator->validateForRegistration($registrationData);
           
           // 2. Create value objects
           $countryCode = CountryCode::fromString($command->getCountryCode());
           $geographyPath = $this->geographyPathService->generatePath(
               GeographyHierarchy::fromLevelIds($countryCode, $command->getGeographyIds())
           );
           
           // 3. Create member (now includes geography)
           $member = Member::registerMember(
               MemberId::generate(),
               $personalInfo,
               $partyInfo,
               $countryCode,
               $geographyPath
           );
           
           $this->memberRepository->save($member);
       }
   }
   ```

---

### **TASK 2.3: UPDATE API ENDPOINTS**

#### **Goal**: Update registration API to include geography validation

#### **Step-by-Step Implementation:**

```php
// API/Controllers/MemberRegistrationController.php
class MemberRegistrationController extends Controller
{
    public function register(Request $request)
    {
        // 1. Validate request
        $validated = $request->validate([
            'country_code' => 'required|string|size:2',
            'province_id' => 'required|integer',
            'district_id' => 'required|integer',
            'local_level_id' => 'nullable|integer',
            'ward_id' => 'nullable|integer',
            // ... other fields
        ]);
        
        // 2. Create command
        $command = new RegisterMemberCommand(
            countryCode: $validated['country_code'],
            geographyIds: [
                $validated['province_id'],
                $validated['district_id'],
                $validated['local_level_id'],
                $validated['ward_id']
            ],
            // ... other parameters
        );
        
        try {
            // 3. Execute command
            $this->commandBus->dispatch($command);
            
            return response()->json([
                'message' => 'Member registered successfully'
            ], 201);
            
        } catch (InvalidMemberGeographyException $e) {
            return response()->json([
                'error' => 'Geography validation failed',
                'message' => $e->getMessage()
            ], 422);
        }
    }
}
```

---

### **TASK 2.4: CREATE GEOGRAPHY QUERIES FOR MEMBERSHIP**

#### **Goal**: Enable geographic queries for membership management

```php
// Application/Membership/Queries/GetMembersByGeography.php
class GetMembersByGeographyHandler
{
    public function handle(GetMembersByGeographyQuery $query): array
    {
        // 1. Convert to geography value objects
        $countryCode = CountryCode::fromString($query->countryCode);
        $targetPath = GeoPath::fromIds($query->geographyIds);
        
        // 2. Query members in geography hierarchy
        return $this->memberRepository->findByGeography(
            $countryCode,
            $targetPath,
            $query->includeDescendants
        );
    }
}

// Infrastructure/Membership/Repositories/EloquentMemberRepository.php
class EloquentMemberRepository implements MemberRepository
{
    public function findByGeography(
        CountryCode $countryCode,
        GeoPath $geographyPath,
        bool $includeDescendants = false
    ): array {
        $query = MemberModel::where('country_code', $countryCode->toString());
        
        if ($includeDescendants) {
            // Find all members under this geography
            $query->where('geography_path', 'like', $geographyPath->toString() . '.%');
        } else {
            // Find only members at exact geography
            $query->where('geography_path', $geographyPath->toString());
        }
        
        return $this->toDomainCollection($query->get());
    }
}
```

---

## 🧪 **TESTING PHASE 2**

### **Test 2.1: Member Geography Integration**
```php
// tests/Unit/Membership/MemberGeographyTest.php
class MemberGeographyTest extends TestCase
{
    /** @test */
    public function member_registration_with_valid_geography()
    {
        // Arrange
        $countryCode = CountryCode::fromString('NP');
        $geographyIds = [1, 12, 123]; // Province, District, Local Level
        
        // Act
        $member = Member::registerMember(
            MemberId::generate(),
            $personalInfo,
            $partyInfo,
            $countryCode,
            $this->mockValidPath($geographyIds)
        );
        
        // Assert
        $this->assertEquals($countryCode, $member->getCountryCode());
        $this->assertEquals('1.12.123', $member->getGeographyPath()->toString());
    }
    
    /** @test */
    public function member_registration_with_invalid_geography_throws_exception()
    {
        $this->expectException(InvalidMemberGeographyException::class);
        
        $validator = new MemberGeographyValidator($mockInvalidService);
        $validator->validateForRegistration($registrationData);
    }
}
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Day 1: Core Integration**
- [ ] **Task 2.1.1**: Add geography fields to Member entity
- [ ] **Task 2.1.2**: Update Member events with geography
- [ ] **Task 2.1.3**: Update Member projector
- [ ] **Task 2.1.4**: Create database migration
- [ ] **Task 2.2.1**: Create MemberGeographyValidator
- [ ] **Task 2.2.2**: Create MemberRegistrationData VO
- [ ] **Task 2.2.3**: Create geography exceptions

### **Day 2: API & Queries**
- [ ] **Task 2.2.4**: Update RegisterMemberHandler
- [ ] **Task 2.3.1**: Update registration API endpoint
- [ ] **Task 2.3.2**: Add geography validation to API
- [ ] **Task 2.4.1**: Create geographic query handler
- [ ] **Task 2.4.2**: Implement repository geographic queries
- [ ] **Task 2.5.1**: Write integration tests
- [ ] **Task 2.5.2**: Test API endpoints

---

## 🔄 **DEPENDENCY INJECTION CONFIGURATION**

```php
// config/app.php - Service Providers
'providers' => [
    // Geography Context
    App\Domain\Geography\Providers\GeographyServiceProvider::class,
    
    // Membership Context with Geography
    App\Domain\Membership\Providers\MembershipServiceProvider::class,
],

// Domain/Membership/Providers/MembershipServiceProvider.php
class MembershipServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind geography services
        $this->app->bind(
            \App\Domain\Geography\Services\GeographyPathService::class,
            \App\Application\Geography\Services\GeographyPathService::class
        );
        
        // Bind membership services with geography dependency
        $this->app->bind(MemberGeographyValidator::class, function ($app) {
            return new MemberGeographyValidator(
                $app->make(GeographyPathService::class)
            );
        });
    }
}
```

---

## 🚨 **MIGRATION NOTES**

### **Backward Compatibility:**
1. **Existing Members**: Create migration to add default geography
   ```php
   // Set default geography for existing members
   DB::table('members')->whereNull('country_code')->update([
       'country_code' => 'NP',
       'geography_path' => null // Will require update
   ]);
   ```

2. **Gradual Rollout**:
   - Phase 1: Add geography to new registrations only
   - Phase 2: Backfill existing members (optional)
   - Phase 3: Make geography required for all operations

### **Performance Considerations:**
1. **Indexes Required**:
   ```sql
   CREATE INDEX idx_members_geography ON members(country_code, geography_path);
   CREATE INDEX idx_members_geography_descendants ON members(geography_path varchar_pattern_ops);
   ```

2. **Cache Geography Validation**:
   - Cache valid geography hierarchies for 1 hour
   - Use Redis for geography lookup caching

---

## ✅ **SUCCESS CRITERIA**

1. **Members register with geography** and receive proper validation
2. **API returns appropriate errors** for invalid geography
3. **Database stores geography paths** correctly
4. **Existing functionality unaffected** (backward compatibility)
5. **All tests pass** with geographic integration
6. **Performance benchmarks** show < 100ms additional latency

---

## 🆘 **TROUBLESHOOTING**

### **Common Issues:**
1. **"Class not found"**: Check service provider bindings
2. **"Invalid geography path"**: Verify ltree format in database
3. **"Country not supported"**: Check CountryCode value object
4. **"Missing required level"**: Review country-specific requirements

### **Debug Commands:**
```bash
# Test geography validation
php artisan tinker
>>> $validator = app(MemberGeographyValidator::class);
>>> $validator->validateForRegistration($testData);

# Check member geography
php artisan db:table members --select=id,country_code,geography_path --limit=5

# Verify indexes
php artisan db:show-indexes members
```

---

## 🚀 **READY TO IMPLEMENT**

**Your tasks are clearly defined and sequenced. Start with Task 2.1.1 and work through the checklist.**

**Estimated Timeline:**
- **Day 1 AM**: Task 2.1 (Member entity updates)
- **Day 1 PM**: Task 2.2 (Cross-context service)
- **Day 2 AM**: Task 2.3 (API updates)
- **Day 2 PM**: Task 2.4 (Queries) & Testing

**Need any clarification on any task before you begin?** 