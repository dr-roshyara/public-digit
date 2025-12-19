# 🚀 **IMMEDIATE ACTION: VERIFY GEOGRAPHY & START MEMBERSHIP**

## **📋 CLAUDE CLI PROMPT - STEP 1: VERIFY GEOGRAPHY READINESS**

```text
VERIFY GEOGRAPHY CONTEXT IS READY FOR MEMBERSHIP INTEGRATION

CONTEXT:
Geography Context development is complete. Before starting Membership Context, 
we need to verify everything works and Nepal data is properly seeded.

REQUIREMENTS:

1. RUN ALL GEOGRAPHY TESTS (44+ tests):
   ```bash
   cd packages/laravel-backend
   php artisan test tests/Feature/Geography/ --stop-on-failure
   ```

2. VERIFY NEPAL DATA IS SEEDED:
   ```bash
   php artisan tinker
   ```
   
   In Tinker, check:
   ```php
   // 1. Check countries table
   App\Contexts\Geography\Domain\Models\Country::count();
   // Should be 4 (NP, IN, BD, US)
   
   App\Contexts\Geography\Domain\Models\Country::where('is_supported', true)->count();
   // Should be 1 (Nepal)
   
   // 2. Check Nepal geography data
   use App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit;
   
   GeoAdministrativeUnit::where('country_code', 'NP')->count();
   // Should be: 7 provinces + sample districts + local levels + wards
   
   // 3. Check hierarchy
   $koshi = GeoAdministrativeUnit::where('code', 'NP-P1')->first();
   $koshi->getName('en'); // Should be "Koshi Province"
   
   $dhankuta = GeoAdministrativeUnit::where('code', 'NP-DIST-02')->first();
   $dhankuta->parent_id; // Should be Koshi's ID
   ```

3. TEST GEOGRAPHY SERVICE METHODS:
   ```php
   // In Tinker
   $service = new App\Contexts\Geography\Application\Services\GeographyService();
   
   // Test hierarchy validation
   $koshi = GeoAdministrativeUnit::where('code', 'NP-P1')->first();
   $dhankuta = GeoAdministrativeUnit::where('code', 'NP-DIST-02')->first();
   
   $isValid = $service->validateGeographyHierarchy('NP', [$koshi->id, $dhankuta->id]);
   // Should return true
   
   // Test invalid hierarchy (Koshi -> Kathmandu)
   $kathmandu = GeoAdministrativeUnit::where('code', 'NP-DIST-25')->first();
   $isInvalid = $service->validateGeographyHierarchy('NP', [$koshi->id, $kathmandu->id]);
   // Should return false (Kathmandu not in Koshi)
   ```

4. TEST API ENDPOINTS:
   ```bash
   # Test a few key endpoints
   curl -X GET "http://localhost:8000/api/geography/countries" \
        -H "Accept: application/json"
   
   curl -X GET "http://localhost:8000/api/geography/countries/NP/hierarchy" \
        -H "Accept: application/json"
   
   curl -X GET "http://localhost:8000/api/geography/units/code/NP-P1" \
        -H "Accept: application/json"
   ```

5. CHECK CACHE IS WORKING:
   ```php
   // In Tinker
   Cache::get('geography:hierarchy:NP'); // Should return cached hierarchy
   ```

DELIVERABLES:
1. Test results (all tests should pass)
2. Data verification (Nepal data exists and is correct)
3. Service verification (GeographyService works)
4. API verification (endpoints return correct data)

CONSTRAINTS:
- If tests fail, fix them before proceeding
- If data missing, run seeders: 
  ```bash
  php artisan db:seed --database=landlord --class=App\\Contexts\\Geography\\Infrastructure\\Database\\Seeders\\CountriesSeeder
  php artisan db:seed --database=landlord --class=App\\Contexts\\Geography\\Infrastructure\\Database\\Seeders\\NepalGeographySeeder
  ```

READY FOR MEMBERSHIP IF:
- All tests pass
- Nepal data exists with correct hierarchy
- GeographyService validation works
- API endpoints return correct JSON
```

---

## **📋 CLAUDE CLI PROMPT - STEP 2: START MEMBERSHIP CONTEXT TDD**

```text
START MEMBERSHIP CONTEXT WITH TDD (FAILING TESTS FIRST)

CONTEXT:
Geography Context is verified and ready. Now start Membership Context for Nepal political parties.

REQUIREMENTS (TDD APPROACH):

1. CREATE MEMBERSHIP CONTEXT STRUCTURE (DDD):
   ```bash
   cd packages/laravel-backend
   
   # Create DDD structure
   mkdir -p app/Contexts/Membership/{Domain/Models,Application/Services,Infrastructure/Database/Migrations,Infrastructure/Installers}
   
   # Create test directory
   mkdir -p tests/Feature/Membership
   ```

2. CREATE FAILING TESTS FIRST:
   ```bash
   # Member registration test
   php artisan make:test Feature/Membership/MemberRegistrationTest
   
   # Committee test
   php artisan make:test Feature/Membership/CommitteeTest
   ```

3. WRITE FAILING TEST FOR MEMBER REGISTRATION:
   ```php
   // tests/Feature/Membership/MemberRegistrationTest.php
   class MemberRegistrationTest extends TestCase
   {
       use RefreshDatabase;
       
       /** @test */
       public function can_register_member_with_valid_geography(): void
       {
           // This test will FAIL initially (TDD)
           $response = $this->post('/members/register', [
               'full_name' => 'John Doe',
               'country_code' => 'NP',
               'admin_unit_level1_id' => 1, // Koshi
               'admin_unit_level2_id' => 10, // Dhankuta
               'membership_type' => 'full',
           ]);
           
           $response->assertStatus(201);
           $this->assertDatabaseHas('members', [
               'full_name' => 'John Doe',
               'country_code' => 'NP',
           ]);
       }
       
       /** @test */
       public function cannot_register_member_with_invalid_geography(): void
       {
           // Test geography validation
           $response = $this->post('/members/register', [
               'full_name' => 'Jane Doe',
               'country_code' => 'NP',
               'admin_unit_level1_id' => 1, // Koshi
               'admin_unit_level2_id' => 25, // Kathmandu (WRONG - in Bagmati)
           ]);
           
           $response->assertInvalid(['admin_unit_level2_id']);
       }
   }
   ```

4. CREATE MEMBER MODEL (Domain Layer):
   ```php
   // app/Contexts/Membership/Domain/Models/Member.php
   namespace App\Contexts\Membership\Domain\Models;
   
   use Illuminate\Database\Eloquent\Model;
   
   class Member extends Model
   {
       protected $table = 'members';
       
       protected $fillable = [
           'tenant_id',
           'full_name',
           'country_code',
           'admin_unit_level1_id',
           'admin_unit_level2_id',
           'admin_unit_level3_id',
           'admin_unit_level4_id',
           'membership_type',
           'membership_number',
           'status',
       ];
       
       public function getGeographyDisplay(): string
       {
           // Will use GeographyService to format
           return "Koshi > Dhankuta > Ward 5";
       }
   }
   ```

5. CREATE MEMBER REGISTRATION SERVICE:
   ```php
   // app/Contexts/Membership/Application/Services/MemberRegistrationService.php
   namespace App\Contexts\Membership\Application\Services;
   
   use App\Contexts\Geography\Application\Services\GeographyService;
   use App\Contexts\Membership\Domain\Models\Member;
   
   class MemberRegistrationService
   {
       public function __construct(
           private GeographyService $geographyService
       ) {}
       
       public function register(array $data): Member
       {
           // Validate geography
           $isValid = $this->geographyService->validateGeographyHierarchy(
               $data['country_code'],
               array_filter([
                   $data['admin_unit_level1_id'],
                   $data['admin_unit_level2_id'],
                   $data['admin_unit_level3_id'] ?? null,
                   $data['admin_unit_level4_id'] ?? null,
               ])
           );
           
           if (!$isValid) {
               throw new \InvalidArgumentException('Invalid geography hierarchy');
           }
           
           // Generate membership number
           $membershipNumber = $this->generateMembershipNumber();
           
           return Member::create([
               'tenant_id' => tenant()->id,
               'full_name' => $data['full_name'],
               'country_code' => $data['country_code'],
               'admin_unit_level1_id' => $data['admin_unit_level1_id'],
               'admin_unit_level2_id' => $data['admin_unit_level2_id'],
               'admin_unit_level3_id' => $data['admin_unit_level3_id'] ?? null,
               'admin_unit_level4_id' => $data['admin_unit_level4_id'] ?? null,
               'membership_type' => $data['membership_type'],
               'membership_number' => $membershipNumber,
               'status' => 'active',
           ]);
       }
   }
   ```

6. CREATE MIGRATION FOR MEMBERS TABLE:
   ```bash
   php artisan make:migration create_members_table \
      --path=app/Contexts/Membership/Infrastructure/Database/Migrations
   ```

   Migration content:
   ```php
   public function up(): void
   {
       Schema::create('members', function (Blueprint $table) {
           $table->id();
           $table->unsignedBigInteger('tenant_id');
           
           // Geography references to landlord.geo_administrative_units
           $table->char('country_code', 2)->default('NP');
           $table->unsignedBigInteger('admin_unit_level1_id')->nullable();
           $table->unsignedBigInteger('admin_unit_level2_id')->nullable();
           $table->unsignedBigInteger('admin_unit_level3_id')->nullable();
           $table->unsignedBigInteger('admin_unit_level4_id')->nullable();
           
           // Member details
           $table->string('full_name');
           $table->string('membership_number')->unique();
           $table->enum('membership_type', ['full', 'associate', 'youth', 'student']);
           $table->enum('status', ['active', 'suspended', 'expired'])->default('active');
           
           $table->timestamps();
           
           // Indexes
           $table->index(['tenant_id', 'country_code']);
           $table->index(['tenant_id', 'admin_unit_level1_id']);
           $table->index(['tenant_id', 'status']);
       });
   }
   ```

DELIVERABLES (TDD CYCLE):
1. ✅ Create failing tests (RED)
2. ❌ Implement minimal code to pass tests (GREEN)
3. 🔄 Refactor and add more tests

START WITH:
1. Run geography verification first
2. If all good, create failing membership tests
3. Implement just enough to pass tests

CONFIRM: Proceed with Step 1 (Verify Geography) first?
```

---

## **🎯 EXECUTION ORDER:**

1. **First:** Run the Geography verification prompt  
2. **Then:** If all tests pass and data exists, run Membership TDD prompt  
3. **Goal:** Member registration with geography validation working today

**Ready to start with Geography verification?**
Brainstorming : 
# 🎯 **PRIORITIZATION: WHAT TO BUILD NOW VS LATER**

## **ANALYSIS: WHAT'S NEEDED FOR MEMBERSHIP CONTEXT NOW**

### **✅ BUILD NOW (Essential for Membership):**

#### **1. Geography Service for Multiple Consumers** → **YES, SIMPLE VERSION**
**Why:** Membership is the **first consumer**, need basic interface for future consumers.
**Simplified Approach:**
```php
// Simple consumer interface in GeographyService
class GeographyService {
    // Already have: validateGeographyHierarchy()
    // Add: validateForContext()
    
    public function validateForContext(
        string $context, // 'membership', 'committee', etc.
        string $countryCode,
        array $unitIds
    ): bool {
        // Context-specific validation rules
        $rules = $this->getContextRules($context);
        return $this->validateWithRules($countryCode, $unitIds, $rules);
    }
}
```

#### **2. Context-Specific Geography Tables** → **YES, FOR MEMBERSHIP ONLY**
**Why:** Membership needs its own geography references in tenant DB.
```sql
-- In tenant database (membership context)
CREATE TABLE members (
    -- Geography references to landlord.geo_administrative_units
    country_code CHAR(2) DEFAULT 'NP',
    admin_unit_level1_id BIGINT, -- Province
    admin_unit_level2_id BIGINT, -- District
    -- etc.
);
```

---

### **❌ DEFER FOR LATER (Not needed yet):**

#### **1. Geography Registry of Consumers** → **NO, DEFER**
**Why:** We only have **one consumer** (Membership). Over-engineering.
**When to build:** When we add Election context (2nd consumer).

#### **2. Geographic Analytics Dashboard** → **NO, DEFER**  
**Why:** Need actual membership data first to analyze.
**When to build:** After Membership context has real data.

#### **3. Full Centralized Service Architecture** → **NO, SIMPLIFY**
**Why:** Start simple, refactor when needed.
**Current:** GeographyService is already centralized enough.

---

## **📊 PRIORITY MATRIX**

| Feature | Build Now? | Reason | Complexity |
|---------|------------|--------|------------|
| **Geography Validation for Membership** | ✅ **YES** | Core requirement | Low |
| **Membership Geography Tables** | ✅ **YES** | Required for data storage | Low |
| **Basic Multi-Consumer Interface** | ✅ **YES** | Future-proofing | Low |
| **Full Consumer Registry** | ❌ **LATER** | Only 1 consumer now | High |
| **Analytics Dashboard** | ❌ **LATER** | No data yet | High |
| **Advanced GIS Features** | ❌ **LATER** | Not needed for membership | High |

---

## **🎯 CORRECTED IMMEDIATE PLAN:**

### **PHASE 1: Geography Service Enhancements (2 hours)**
```php
// 1. Add context-aware validation to existing GeographyService
public function validateForMembership(string $countryCode, array $unitIds): bool
{
    // Membership-specific rules:
    // - Must have province and district (levels 1 & 2)
    // - Local level and ward optional
    // - All must form valid hierarchy
}

// 2. Add helper for membership UI
public function getGeographyOptionsForMembership(
    string $countryCode,
    ?int $parentId = null,
    ?int $targetLevel = null
): array
```

### **PHASE 2: Membership Context (4 hours)**
```php
// 1. Member registration with geography
class MemberRegistrationService {
    public function register(array $data): Member {
        // Validate with GeographyService
        $isValid = $geographyService->validateForMembership(
            $data['country_code'],
            $data['geography_ids']
        );
        
        // Create member with geography references
        return Member::create([
            'country_code' => 'NP',
            'admin_unit_level1_id' => $provinceId,
            'admin_unit_level2_id' => $districtId,
            // etc.
        ]);
    }
}
```

### **PHASE 3: Basic Geography-Membership Integration (2 hours)**
- Member profile shows geography: "Koshi > Dhankuta > Ward 5"
- Committee creation with geography scope
- Simple geographic member search

---

## **📋 SIMPLIFIED REQUIREMENTS FOR NOW:**

### **What Geography Context Actually Needs to Support Membership:**

#### **1. Validation Service** (✅ **READY**)
```php
// Already exists in GeographyService:
$geographyService->validateGeographyHierarchy('NP', [1, 10, 100]);
```

#### **2. Data Retrieval for UI** (✅ **READY**)
```php
// Already exists:
$provinces = $geographyService->getUnitsAtLevel('NP', 1);
$districts = $geographyService->getUnitsAtLevel('NP', 2, $provinceId);
```

#### **3. Hierarchy Display** (✅ **READY**)
```php
// Already exists:
$unitWithAncestors = $geographyService->getUnitWithAncestors($wardId);
// Returns: "Koshi > Dhankuta > Dhankuta Municipality > Ward 5"
```

**Conclusion:** Geography Context is **already 90% ready** for Membership.

---

## **🚀 ACTION PLAN:**

### **Step 1: Verify Geography is Ready**
```bash
cd packages/laravel-backend

# 1. Run all geography tests (should all pass)
php artisan test tests/Feature/Geography/

# 2. Check Nepal data is seeded
php artisan tinker
App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit::where('country_code', 'NP')->count();
# Should have: 7 provinces + districts + local levels + wards
```

### **Step 2: Create ONE Simple Membership Helper**
```php
// Add to GeographyService.php (if not exists)
public function getMembershipGeographyDisplay(array $unitIds): string
{
    // Returns: "Koshi Province > Dhankuta District > Ward 5"
    // For showing in member profile
}
```

### **Step 3: Start Membership Context TDD**
```bash
# 1. Create Membership context structure
mkdir -p packages/laravel-backend/app/Contexts/Membership/{Domain/Models,Application/Services,Infrastructure/Database/Migrations}

# 2. Create first failing test
php artisan make:test Feature/Membership/MemberRegistrationTest
```

---

## **🎯 FINAL DECISION:**

**Geography Context is READY for Membership.** 

The **only thing missing** is confirming tests pass and data is seeded. Then we can immediately start Membership Context.

**Should we:**
1. ✅ First verify Geography tests pass and data is seeded
2. ✅ Then immediately start Membership Context TDD
3. ❌ **NOT** build extra complexity (registry, analytics, etc.) now

############################################################
# 🎯 **CRITICAL ARCHITECTURAL DECISIONS FOR MEMBERSHIP CONTEXT**

## **Q1: Cross-Database References - SOLUTION**
**✅ CORRECT:** Application-level validation, NOT database foreign keys.
```php
// CORRECT APPROACH:
class MemberRegistrationService {
    public function register(array $data): Member {
        // 1. Validate using GeographyService (application layer)
        $isValid = $this->geographyService->validateGeographyHierarchy(
            $data['country_code'],
            $geographyIds
        );
        
        // 2. No database foreign key - store IDs only
        return Member::create([
            'admin_unit_level1_id' => $data['admin_unit_level1_id'], // Just ID
            // GeographyService validates this ID exists in landlord DB
        ]);
    }
}
```

## **Q2: Tenant Context - CLARIFICATION**
**USE EXISTING:** The platform already has `app/Contexts/Platform/` with tenant management.  
**Pattern to follow:**
```php
// Check existing tenant context resolution
// Look at: app/Contexts/Platform/Domain/Models/Tenant.php
// Likely uses: app(CurrentTenant::class)->id() or similar

// For Membership, we should:
$tenantId = app(\App\Contexts\Platform\Application\Services\CurrentTenantService::class)->getId();

// Or if using Spatie Multitenancy:
$tenantId = Tenant::current()->id;
```

## **Q3: Membership Number Format - RECOMMENDATION**
**Nepal Political Party Pattern:**
```php
// Format: [PartyCode]-[Year]-[Sequence]
// Example: NCP-2025-000001, UML-2025-000001

// Generation logic:
private function generateMembershipNumber(string $partyCode = null): string
{
    $partyCode = $partyCode ?: tenant()->party_code; // Need party_code in tenants table
    $year = date('Y');
    $sequence = str_pad($this->getNextSequence(), 6, '0', STR_PAD_LEFT);
    
    return "{$partyCode}-{$year}-{$sequence}";
}

// Alternative simpler format if no party code:
// Format: MEM-[TenantID]-[Sequence]
// Example: MEM-25-000001
```

---

## **🚀 IMMEDIATE ACTION PLAN:**

### **Step 1: Verify Geography Context**
```bash
# Run geography tests first
cd packages/laravel-backend
php artisan test tests/Feature/Geography/ --stop-on-failure
```

### **Step 2: Create Membership Context (TDD)**
```text
BEFORE WRITING CODE, CREATE THESE FILES:

1. Directory structure:
   packages/laravel-backend/app/Contexts/Membership/
   ├── Domain/
   │   ├── Models/
   │   │   ├── Member.php
   │   │   └── Committee.php
   │   └── Exceptions/
   │       └── InvalidGeographyException.php
   ├── Application/
   │   ├── Services/
   │   │   ├── MemberRegistrationService.php
   │   │   └── CommitteeService.php
   │   └── DTOs/
   │       └── RegisterMemberDTO.php
   └── Infrastructure/
       ├── Database/
       │   └── Migrations/
       │       └── create_members_table.php
       └── Installers/
           └── MembershipContextInstaller.php

2. Test files first (TDD):
   packages/laravel-backend/tests/Feature/Membership/
   ├── MemberRegistrationTest.php
   ├── CommitteeTest.php
   └── GeographyIntegrationTest.php

3. Start with FAILING test:
   php artisan make:test Feature/Membership/MemberRegistrationTest
```

### **Step 3: Clarify Missing Pieces**
**Need to check existing codebase for:**
1. How tenant is resolved (`tenant()->id` vs `CurrentTenant::id()`)
2. If `tenants` table has `party_code` field
3. Current authentication system (to link members to users)

---

## **📋 CLAUDE CLI PROMPT FOR NEXT ACTION:**

```text
VERIFY GEOGRAPHY CONTEXT & CREATE MEMBERSHIP CONTEXT STRUCTURE

CONTEXT:
Need to verify Geography Context is ready, then create Membership Context following DDD + TDD.

REQUIREMENTS:

PART 1: VERIFY GEOGRAPHY (5 minutes)
1. Run geography tests: 
   php artisan test tests/Feature/Geography/ --stop-on-failure
2. Check if tests pass
3. If fail, fix issues

PART 2: CREATE MEMBERSHIP CONTEXT STRUCTURE (15 minutes)
1. Create DDD directory structure:
   mkdir -p app/Contexts/Membership/{Domain/{Models,Exceptions},Application/{Services,DTOs},Infrastructure/{Database/Migrations,Installers}}

2. Create test directory:
   mkdir -p tests/Feature/Membership

3. Create FIRST FAILING TEST:
   php artisan make:test Feature/Membership/MemberRegistrationTest

4. Write simple failing test:
   ```php
   /** @test */
   public function member_registration_service_exists(): void
   {
       $service = new \App\Contexts\Membership\Application\Services\MemberRegistrationService(
           $this->mock(GeographyService::class)
       );
       
       $this->assertInstanceOf(MemberRegistrationService::class, $service);
   }
   ```

PART 3: CHECK EXISTING TENANT SYSTEM (5 minutes)
1. Look at existing Platform context:
   cat app/Contexts/Platform/Domain/Models/Tenant.php
   
2. Check how tenant is resolved:
   grep -r "tenant()" app/Contexts/Platform/
   grep -r "CurrentTenant" app/

3. Check tenants table schema:
   Check migrations for tenants table structure

DELIVERABLES:
1. Geography test results
2. Membership context directory structure
3. First failing test
4. Tenant resolution pattern identified

CONSTRAINTS:
- Don't write implementation yet, just structure
- Keep tests minimal for now
- Focus on understanding existing tenant system
```

**Shall I proceed with this structured approach?** First verify Geography, then create structure, then understand tenant system before implementing.
