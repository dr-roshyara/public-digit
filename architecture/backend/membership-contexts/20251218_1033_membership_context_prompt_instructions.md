# 🎯 **ARCHITECTURAL DECISIONS CONFIRMATION**

## **Q1: Membership Number Format**
**✅ APPROVED:** Use tenant `slug` not numeric ID.
```php
// Format: {tenant_slug}-{year}-{sequence}
// Example: ncp-nepal-2025-000001, uml-nepal-2025-000001
$membershipNumber = strtoupper($tenant->slug) . '-' . date('Y') . '-' . str_pad($sequence, 6, '0', STR_PAD_LEFT);
```

**Reason:** More meaningful than numeric ID, uses existing `slug` field.

## **Q2: Member-User Relationship**
**✅ APPROVED:** **OPTIONAL** link (`tenant_user_id` nullable).

**Reason:** 
- Some members may have user accounts (active party workers)
- Some may not (registered supporters, database-only records)
- Real-world political parties have both types

```sql
-- Schema
`tenant_user_id` BIGINT UNSIGNED NULLABLE
```

## **Q3: Geography Level Requirements**
**✅ APPROVED:** **Province + District required** (levels 1 & 2).

**Reason:**
- Nepal membership registration MUST know province and district
- Local level and ward optional (some rural areas may not have proper ward data)
- Matches real Nepali political party requirements

```php
// Validation logic:
public function validateMemberGeography(array $unitIds): bool
{
    // Must have: Province (level 1) AND District (level 2)
    // Optional: Local Level (3) and Ward (4) if provided
    // All must form valid hierarchy
}
```

## **Q4: Committee Scope**
**✅ APPROVED:** **Defer Committee** for now.

**Reason:** YAGNI (You Aren't Gonna Need It). Focus on Member registration first.

---

# 🚀 **APPROVED MINIMAL VIABLE MEMBERSHIP:**

## **1. Membership Number:** `{SLUG}-{YEAR}-{SEQUENCE}`  
## **2. Member-User Link:** Optional (nullable)  
## **3. Geography:** Province + District required  
## **4. Scope:** Member registration only (no committees yet)

---

# 📋 **FINAL CLAUDE CLI INSTRUCTIONS:**

```text
IMPLEMENT MEMBERSHIP CONTEXT WITH TDD APPROACH

CONTEXT:
Architectural decisions confirmed:
1. Membership Number: {tenant_slug}-{year}-{sequence}
2. Member-User: Optional link (tenant_user_id nullable)
3. Geography: Province + District required, levels 3-4 optional
4. Scope: Member registration only (defer committees)

REQUIREMENTS (TDD - RED-GREEN-REFACTOR):

PART 1: CREATE FAILING TESTS (RED) - 10 minutes

1. Create test structure:
   ```bash
   cd packages/laravel-backend
   
   # Create test directory
   mkdir -p tests/Feature/Membership
   
   # Create failing tests
   php artisan make:test Feature/Membership/MemberRegistrationTest
   php artisan make:test Feature/Membership/MemberModelTest
   ```

2. Write failing tests in MemberRegistrationTest.php:
   ```php
   class MemberRegistrationTest extends TestCase
   {
       /** @test */
       public function member_registration_service_exists(): void
       {
           $service = new \App\Contexts\Membership\Application\Services\MemberRegistrationService(
               $this->mock(\App\Contexts\Geography\Application\Services\GeographyService::class)
           );
           
           $this->assertInstanceOf(
               \App\Contexts\Membership\Application\Services\MemberRegistrationService::class,
               $service
           );
       }
       
       /** @test */
       public function can_register_member_with_valid_geography(): void
       {
           // This will FAIL - no implementation yet (RED)
           $response = $this->post('/api/members/register', [
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
           // Koshi -> Kathmandu (invalid - Kathmandu in Bagmati)
           $response = $this->post('/api/members/register', [
               'full_name' => 'Jane Doe',
               'country_code' => 'NP',
               'admin_unit_level1_id' => 1, // Koshi
               'admin_unit_level2_id' => 25, // Kathmandu (WRONG province)
           ]);
           
           $response->assertInvalid(['admin_unit_level2_id']);
       }
   }
   ```

PART 2: CREATE DDD STRUCTURE - 5 minutes

1. Create Membership Context structure:
   ```bash
   mkdir -p app/Contexts/Membership/{Domain/{Models,Exceptions},Application/{Services,DTOs},Infrastructure/Database/Migrations}
   ```

2. Create minimal files (empty for now):
   ```
   app/Contexts/Membership/
   ├── Domain/
   │   ├── Models/Member.php
   │   └── Exceptions/InvalidGeographyException.php
   ├── Application/
   │   ├── Services/MemberRegistrationService.php
   │   └── DTOs/RegisterMemberDTO.php
   └── Infrastructure/Database/Migrations/
       └── create_members_table.php
   ```

PART 3: RUN TESTS (SHOULD FAIL - RED) - 2 minutes
```bash
php artisan test tests/Feature/Membership/MemberRegistrationTest --stop-on-failure
# Expected: All tests fail (no implementation yet)
```

DELIVERABLES (Phase 1 - RED):
1. ✅ Failing test suite created
2. ✅ DDD directory structure created
3. ✅ Tests running and failing (as expected in TDD)

CONSTRAINTS:
- DON'T implement any logic yet
- Just create structure and failing tests
- Verify tests fail (confirming TDD is working)

NEXT (After RED phase):
1. Implement minimal code to pass one test (GREEN)
2. Refactor
3. Repeat for next test

CONFIRM: Proceed with creating failing tests first?
```

**Ready to start TDD with failing tests first?**
# 🚀 **EXECUTING TDD: CREATING FAILING TESTS FIRST**

## **📋 CLAUDE CLI PROMPT - PHASE 1: CREATE FAILING TESTS**

```text
CREATE FAILING TESTS FOR MEMBERSHIP CONTEXT (TDD - RED PHASE)

CONTEXT:
Starting TDD for Membership Context. First create failing tests, then implement.

REQUIREMENTS:

STEP 1: CREATE TEST DIRECTORY STRUCTURE
```bash
cd packages/laravel-backend

# Create test directory
mkdir -p tests/Feature/Membership

# Create failing tests
php artisan make:test Feature/Membership/MemberRegistrationTest
php artisan make:test Feature/Membership/MemberModelTest
```

STEP 2: WRITE FAILING TESTS IN MemberRegistrationTest.php
```php
<?php

namespace Tests\Feature\Membership;

use Tests\TestCase;
use App\Contexts\Geography\Application\Services\GeographyService;
use Mockery;

class MemberRegistrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // Mock tenant context for tests
        $tenant = new \stdClass();
        $tenant->id = 'test-tenant-uuid';
        $tenant->slug = 'test-party';
        $tenant->numeric_id = 1;
        
        // Mock the tenant resolution (Spatie Multitenancy)
        $tenantMock = Mockery::mock(\Spatie\Multitenancy\Models\Tenant::class);
        $tenantMock->shouldReceive('current')->andReturn($tenant);
        $this->app->instance(\Spatie\Multitenancy\Models\Tenant::class, $tenantMock);
    }
    
    /** @test */
    public function member_registration_service_can_be_instantiated(): void
    {
        // Arrange: Mock GeographyService
        $geographyServiceMock = Mockery::mock(GeographyService::class);
        
        // Act: Try to instantiate service (will fail - class doesn't exist)
        $service = new \App\Contexts\Membership\Application\Services\MemberRegistrationService(
            $geographyServiceMock
        );
        
        // Assert: Service exists
        $this->assertInstanceOf(
            \App\Contexts\Membership\Application\Services\MemberRegistrationService::class,
            $service
        );
    }
    
    /** @test */
    public function can_register_member_with_valid_geography(): void
    {
        // Arrange: Mock GeographyService to return valid
        $geographyServiceMock = Mockery::mock(GeographyService::class);
        $geographyServiceMock->shouldReceive('validateGeographyHierarchy')
            ->with('NP', [1, 10])
            ->once()
            ->andReturn(true);
        
        // Act: Try to register member (will fail - endpoint doesn't exist)
        $response = $this->postJson('/api/members/register', [
            'full_name' => 'John Doe',
            'country_code' => 'NP',
            'admin_unit_level1_id' => 1, // Koshi Province
            'admin_unit_level2_id' => 10, // Dhankuta District
            'membership_type' => 'full',
        ]);
        
        // Assert: Registration succeeds
        $response->assertStatus(201);
        
        // Assert: Member created in database (will fail - table doesn't exist)
        $this->assertDatabaseHas('members', [
            'full_name' => 'John Doe',
            'country_code' => 'NP',
            'admin_unit_level1_id' => 1,
            'admin_unit_level2_id' => 10,
            'membership_type' => 'full',
            'tenant_id' => 'test-tenant-uuid',
        ]);
    }
    
    /** @test */
    public function cannot_register_member_with_invalid_geography(): void
    {
        // Arrange: Mock GeographyService to return invalid
        $geographyServiceMock = Mockery::mock(GeographyService::class);
        $geographyServiceMock->shouldReceive('validateGeographyHierarchy')
            ->with('NP', [1, 25])
            ->once()
            ->andReturn(false);
        
        // Act: Try to register with invalid geography
        $response = $this->postJson('/api/members/register', [
            'full_name' => 'Jane Doe',
            'country_code' => 'NP',
            'admin_unit_level1_id' => 1, // Koshi Province
            'admin_unit_level2_id' => 25, // Kathmandu District (WRONG - in Bagmati)
            'membership_type' => 'full',
        ]);
        
        // Assert: Validation fails
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['admin_unit_level2_id']);
    }
    
    /** @test */
    public function membership_number_is_generated_correctly(): void
    {
        // Arrange: Mock GeographyService
        $geographyServiceMock = Mockery::mock(GeographyService::class);
        $geographyServiceMock->shouldReceive('validateGeographyHierarchy')
            ->andReturn(true);
        
        $service = new \App\Contexts\Membership\Application\Services\MemberRegistrationService(
            $geographyServiceMock
        );
        
        // Act & Assert: Membership number format
        // This test will fail initially
        $member = $service->register([
            'full_name' => 'Test User',
            'country_code' => 'NP',
            'admin_unit_level1_id' => 1,
            'admin_unit_level2_id' => 10,
            'membership_type' => 'full',
        ]);
        
        // Format: TEST-PARTY-2025-000001
        $this->assertStringStartsWith('TEST-PARTY-', $member->membership_number);
        $this->assertMatchesRegularExpression('/^TEST-PARTY-\d{4}-\d{6}$/', $member->membership_number);
    }
}
```

STEP 3: WRITE FAILING TESTS IN MemberModelTest.php
```php
<?php

namespace Tests\Feature\Membership;

use Tests\TestCase;

class MemberModelTest extends TestCase
{
    /** @test */
    public function member_model_exists(): void
    {
        // This will fail - Member model doesn't exist yet
        $member = new \App\Contexts\Membership\Domain\Models\Member();
        
        $this->assertInstanceOf(
            \App\Contexts\Membership\Domain\Models\Member::class,
            $member
        );
    }
    
    /** @test */
    public function member_has_required_fields(): void
    {
        // This will fail - can't create without implementation
        $member = \App\Contexts\Membership\Domain\Models\Member::create([
            'tenant_id' => 'test-tenant-uuid',
            'full_name' => 'Test Member',
            'country_code' => 'NP',
            'admin_unit_level1_id' => 1,
            'admin_unit_level2_id' => 10,
            'membership_type' => 'full',
            'membership_number' => 'TEST-PARTY-2025-000001',
            'status' => 'active',
        ]);
        
        $this->assertEquals('Test Member', $member->full_name);
        $this->assertEquals('NP', $member->country_code);
        $this->assertEquals('active', $member->status);
    }
}
```

STEP 4: CREATE DDD DIRECTORY STRUCTURE
```bash
# Create Membership Context DDD structure
mkdir -p app/Contexts/Membership/{Domain/{Models,Exceptions},Application/{Services,DTOs},Infrastructure/Database/Migrations}

# Create empty files for now
touch app/Contexts/Membership/Domain/Models/Member.php
touch app/Contexts/Membership/Domain/Exceptions/InvalidGeographyException.php
touch app/Contexts/Membership/Application/Services/MemberRegistrationService.php
touch app/Contexts/Membership/Application/DTOs/RegisterMemberDTO.php
touch app/Contexts/Membership/Infrastructure/Database/Migrations/create_members_table.php
```

STEP 5: RUN TESTS (EXPECTED TO FAIL - RED PHASE)
```bash
# Run membership tests - should ALL fail (RED)
php artisan test tests/Feature/Membership/ --stop-on-failure

# Expected output:
# FAIL: MemberRegistrationTest::member_registration_service_can_be_instantiated
# Class "App\Contexts\Membership\Application\Services\MemberRegistrationService" not found
#
# All tests should fail - confirming TDD is working correctly
```

DELIVERABLES (TDD RED PHASE):
1. ✅ Two test files with failing tests
2. ✅ DDD directory structure created
3. ✅ Empty class files created
4. ✅ Tests running and failing (as expected)

CONSTRAINTS:
- DON'T write implementation yet
- Let tests fail naturally
- Verify TDD workflow: Red → Green → Refactor

NEXT AFTER THIS:
1. Create actual MemberRegistrationService class (minimal to pass first test)
2. Run tests - should start passing
3. Continue TDD cycle

ACTION: Execute these commands to create failing tests first.
```