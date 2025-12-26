# **🧠 Phase 1 Implementation: Prompt Engineering Guide (DDD + TDD)**

## **🎯 PHASE 1 MISSION STATEMENT**
*"Implement a production-ready Member Registration System with Geography Validation, TenantUser Integration, and Jurisdiction-Based Security using Domain-Driven Design with Test-Driven Development."*

---

## **📋 ARCHITECTURAL CONTEXT FOR CLAUDE/AI**

### **1. PROJECT FOUNDATION**
```
Technology Stack: Laravel 12.35.1 + PostgreSQL 15+ + Vue 3 + Inertia.js
Architecture: Domain-Driven Design (Bounded Contexts)
Database: Multi-tenant (Landlord + Tenant Databases)
Testing: TDD with PestPHP 3.0
```

### **2. CURRENT STATE (What's Already Built)**
- ✅ **Landlord DB**: `geo_administrative_units` with Nepal hierarchy (Level 1-4)
- ✅ **Tenant DB**: `members` table with geography columns (admin_unit_level1_id → level4_id)
- ✅ **Tenant DB**: `tenant_users` table with geography columns
- ✅ **Module Installation**: `InstallMembershipModule` job creates tables in tenant DBs
- ✅ **MemberRegistrationService**: Basic member creation with membership number generation

### **3. PHASE 1 GAPS TO FILL**
1. ❌ **TenantUser Validator** - Business rule validation
2. ❌ **Geography Path System** - Materialized path for performance
3. ❌ **Jurisdiction Scope** - Automatic data filtering
4. ❌ **API Controllers** - RESTful endpoints
5. ❌ **Vue Components** - Admin UI with geography filtering

---

## **🤖 PROMPT TEMPLATE FOR CLAUDE CODING**

### **COMMON INSTRUCTIONS (Include in EVERY prompt)**
> **Role**: Senior Laravel Backend Developer following Domain-Driven Design
> **Architecture Constraints**:
> - Use PestPHP for ALL tests (TDD First)
> - Follow DDD Bounded Contexts: `/app/Contexts/Membership/`
> - Multi-tenancy: Tenant data isolation is CRITICAL
> - PostgreSQL specific: Use ltree extension where applicable
> - Connection: `tenant` connection for tenant models
> 
> **Code Style**:
> - PHP 8.3+ features (readonly classes, typed properties)
> - Strict typing: `declare(strict_types=1)`
> - Dependency Injection via constructor
> - Domain Exceptions for business rule violations
> 
> **Testing Rules**:
> 1. Write test FIRST (red phase)
> 2. Minimal implementation (green phase)
> 3. Refactor (refactor phase)
> 4. Aim for 90%+ coverage
> 5. Mock external dependencies (database, services)

---

## **🔧 PHASE 1: WEEK 1 IMPLEMENTATION PROMPTS**

### **DAY 1: TENANTUSER VALIDATOR SERVICE**

**🎯 Prompt 1.1: Create TenantUserValidator Test**
```
Create a PestPHP test file for TenantUserValidator with the following test cases:

Test File: tests/Feature/Contexts/Membership/TenantUserValidatorTest.php

Test Cases:
1. test_validates_active_tenant_user()
   - Mock TenantUserRepository
   - Should return TenantUser when valid
   - Assert returns correct TenantUser instance

2. test_throws_exception_for_inactive_user()
   - Setup inactive TenantUser
   - Expect DomainException with "User is inactive"

3. test_throws_exception_for_user_already_linked()
   - Setup TenantUser already linked to Member
   - Expect DomainException with "User already has member profile"

4. test_throws_exception_for_cross_tenant_user()
   - Setup TenantUser from different tenant
   - Expect DomainException with "User belongs to different tenant"

5. test_throws_exception_for_nonexistent_user()
   - Mock repository to return null
   - Expect DomainException with "User not found"

Follow TDD: Create test file first, run to fail, then we'll implement.
```

**🎯 Prompt 1.2: Implement TenantUserValidator Service**
```
Based on the failing tests from Prompt 1.1, implement the TenantUserValidator service:

File: app/Contexts/Membership/Application/Services/TenantUserValidator.php

Requirements:
1. Constructor: Accept TenantUserRepositoryInterface
2. Method: validate(int $tenantUserId, int $tenantId): TenantUser
3. Business Rules:
   - TenantUser must exist in repository
   - TenantUser.tenant_id must match $tenantId
   - TenantUser.status must be 'active'
   - TenantUser must NOT already have a Member record
4. Throw DomainException for any violation
5. Return validated TenantUser instance

Use dependency injection. Create DomainException in app/Contexts/Membership/Domain/Exceptions/
```

### **DAY 2: GEOGRAPHY PATH SYSTEM**

**🎯 Prompt 2.1: Create GeographyPathService Test**
```
Create PestPHP tests for GeographyPathService:

Test File: tests/Feature/Contexts/Membership/GeographyPathServiceTest.php

Test Cases:
1. test_generates_path_with_province_only()
   - Input: province_id = 1, others null
   - Expected: "1"

2. test_generates_path_with_province_district()
   - Input: province_id = 1, district_id = 12
   - Expected: "1.12"

3. test_generates_path_full_hierarchy()
   - Input: province=1, district=12, local=123, ward=1234
   - Expected: "1.12.123.1234"

4. test_validates_hierarchy_integrity()
   - Mock GeoRepository to validate parent-child relationships
   - Should throw DomainException if district not child of province

5. test_caches_path_generation()
   - Same inputs should return cached result
   - Use Laravel Cache facade

Note: Use PostgreSQL ltree syntax (dot-separated).
```

**🎯 Prompt 2.2: Implement GeographyPathService**
```
Implement GeographyPathService to pass tests from Prompt 2.1:

File: app/Contexts/Membership/Application/Services/GeographyPathService.php

Requirements:
1. Constructor: Accept GeoRepositoryInterface and Cache
2. Method: generatePath(array $geographyIds): string
3. Parameters: ['province_id', 'district_id', 'local_level_id', 'ward_id']
4. Logic:
   - Validate each non-null ID exists in GeoRepository
   - Validate parent-child relationships (district belongs to province, etc.)
   - Generate ltree string: "province.district.local.ward"
   - Cache result: key = md5(serialize($geographyIds))
5. Return: string ltree path

Create GeoRepositoryInterface with find() and isChildOf() methods.
```

### **DAY 3: UPDATE MEMBER REGISTRATION SERVICE**

**🎯 Prompt 3.1: Test Enhanced MemberRegistrationService**
```
Create comprehensive tests for updated MemberRegistrationService:

Test File: tests/Feature/Contexts/Membership/MemberRegistrationServiceTest.php

Test Cases:
1. test_registers_member_without_tenant_user()
   - Mock dependencies
   - Should create Member with geo_path
   - Should NOT link to TenantUser

2. test_registers_member_with_valid_tenant_user()
   - Mock TenantUserValidator to return valid TenantUser
   - Should create Member with tenant_user_id
   - Should generate correct membership_number

3. test_throws_when_tenant_user_validation_fails()
   - Mock TenantUserValidator to throw DomainException
   - Should not create Member
   - Should propagate exception

4. test_generates_geo_path_during_registration()
   - Mock GeographyPathService
   - Verify geo_path is set on Member

5. test_handles_duplicate_membership_numbers()
   - Setup collision in membership number generation
   - Should retry with new number (max 3 attempts)

Use DatabaseTransactions trait for database tests.
```

**🎯 Prompt 3.2: Implement Enhanced MemberRegistrationService**
```
Update existing MemberRegistrationService to integrate new validators:

File: app/Contexts/Membership/Application/Services/MemberRegistrationService.php

Updated Constructor:
__construct(
    private TenantUserValidator $tenantUserValidator,
    private GeographyPathService $geographyPathService,
    private MembershipNumberGenerator $numberGenerator,
    private MemberRepository $memberRepository
)

Updated register() method logic:
1. Validate geography hierarchy using GeographyPathService
2. Validate TenantUser (if provided) using TenantUserValidator
3. Generate membership number
4. Generate geo_path
5. Create Member with:
   - geography IDs
   - geo_path (string)
   - tenant_user_id (nullable)
   - membership_number
6. Return persisted Member

Add try-catch for validation failures.
```

### **DAY 4: JURISDICTION SCOPE SYSTEM**

**🎯 Prompt 4.1: Test Jurisdiction Scope**
```
Create tests for JurisdictionScope (Global Scope):

Test File: tests/Feature/Contexts/Membership/JurisdictionScopeTest.php

Test Cases:
1. test_applies_scope_for_authenticated_user()
   - Create authenticated TenantUser with scope_path = "1.12"
   - Query Member::all()
   - Should add WHERE geo_path LIKE '1.12%'

2. test_no_scope_for_unauthenticated_user()
   - Without authentication
   - Should NOT add WHERE clause

3. test_scope_with_different_user_paths()
   - Test with scope_path = "1"
   - Should include all members in province 1
   - Test with scope_path = "1.12.123"
   - Should include only members in specific local level

4. test_scope_works_with_other_query_conditions()
   - Combine with where(), orderBy(), paginate()
   - Scope should not break other query builders

Note: Mock authentication using Sanctum/Passport.
```

**🎯 Prompt 4.2: Implement Jurisdiction Scope**
```
Implement JurisdictionScope global scope:

File: app/Contexts/Membership/Domain/Models/Scopes/JurisdictionScope.php

Implementation:
1. Implement Illuminate\Database\Eloquent\Scope interface
2. apply() method:
   - Check if user is authenticated (Auth::check())
   - Get user's scope_path (Auth::user()->scope_path)
   - Add whereRaw("geo_path <@ ?", [$scopePath]) for PostgreSQL ltree
   - OR where("geo_path", "LIKE", "$scopePath%") for MySQL
3. Add to Member model booted() method

Also create Policy for fine-grained authorization:

File: app/Contexts/Membership/Domain/Policies/MemberPolicy.php

Methods:
- view(): User's scope_path must be prefix of member's geo_path
- update(): Same as view
- delete(): Only for admins with full scope

Use str_starts_with() for prefix checking.
```

### **DAY 5: API CONTROLLERS & RESOURCES**

**🎯 Prompt 5.1: Test Member API Endpoints**
```
Create PestPHP API tests for MemberController:

Test File: tests/Feature/Contexts/Membership/Http/Controllers/MemberControllerTest.php

Test Cases (using Pest's API testing):
1. test_index_returns_members_filtered_by_jurisdiction()
   - Authenticate user with scope
   - GET /api/members
   - Assert only visible members returned

2. test_store_creates_member_with_valid_data()
   - POST /api/members with valid geography
   - Assert 201 Created
   - Assert response includes membership_number

3. test_store_validates_geography_hierarchy()
   - POST with invalid hierarchy (district not in province)
   - Assert 422 Unprocessable Entity
   - Assert validation errors

4. test_show_returns_member_within_jurisdiction()
   - GET /api/members/{id}
   - Assert member data with geography

5. test_update_respects_jurisdiction()
   - PATCH /api/members/{id} outside user's scope
   - Assert 403 Forbidden

Use DatabaseMigrations and actingAs() helper.
```

**🎯 Prompt 5.2: Implement MemberController**
```
Implement RESTful MemberController:

File: app/Contexts/Membership/Application/Http/Controllers/MemberController.php

Endpoints:
1. GET /api/members (index)
   - Use MemberListQuery (DTO pattern)
   - Apply pagination
   - Filter by geography if provided
   - Return MemberCollection

2. POST /api/members (store)
   - Validate with StoreMemberRequest (Form Request)
   - Use MemberRegistrationService
   - Return MemberResource with 201

3. GET /api/members/{id} (show)
   - Authorize with MemberPolicy::view
   - Return MemberResource

4. PATCH /api/members/{id} (update)
   - Authorize with MemberPolicy::update
   - Validate with UpdateMemberRequest
   - Update using MemberRepository
   - Return MemberResource

5. DELETE /api/members/{id} (destroy)
   - Authorize with MemberPolicy::delete
   - Soft delete
   - Return 204 No Content

Create all supporting classes: Requests, Resources, Query DTO.
```

### **DAY 6-7: VUE COMPONENTS**

**🎯 Prompt 6.1: Test Vue Geography Components**
```
Create Vitest tests for Vue 3 Geography components:

Test File: tests/Unit/Components/GeographyFilter.spec.js

Test Cases:
1. test_loads_provinces_on_mount()
   - Mock axios.get to return provinces
   - Assert provinces populated

2. test_changing_province_loads_districts()
   - Simulate select change
   - Assert districts API called with province_id
   - Assert districts populated

3. test_emits_filter_event()
   - Fill all geography levels
   - Click filter button
   - Assert emitted event with correct path

4. test_resets_child_dropdowns()
   - Change province after district selected
   - Assert district cleared and disabled
   - Assert local level cleared and disabled

Use Vue Testing Library with happy-dom.
```

**🎯 Prompt 6.2: Build Vue Geography Components**
```
Build Vue 3 components for geography management:

Component 1: GeographyFilter.vue
- Location: resources/js/Components/Membership/GeographyFilter.vue
- Features:
  * 4-level cascade dropdown (Province → District → Local → Ward)
  * Dynamic loading via API: /api/geography/children/{parentId}
  * Emits 'filter' event with selected path
  * Uses Tailwind CSS for styling
  * Loading states for async operations

Component 2: MemberTable.vue
- Location: resources/js/Components/Membership/MemberTable.vue
- Features:
  * Displays members with pagination
  * Columns: Name, Membership #, Geography, Status
  * Actions: View, Edit, Delete (with permission checks)
  * Integrates with GeographyFilter
  * Uses Inertia.js for navigation

API Integration:
- Create composable: useGeographyApi()
- Methods: getProvinces(), getChildren(parentId), searchMembers(filters)

Design: Clean, political party admin style with blue accent.
```

---

## **🔧 INFRASTRUCTURE SETUP PROMPTS**

### **DATABASE MIGRATION PROMPTS**

**🎯 Prompt DB1: Add geo_path Column**
```
Create a database migration to add geo_path column to members table:

File: database/migrations/tenant/YYYY_MM_DD_HHMMSS_add_geo_path_to_members_table.php

Migration Requirements:
1. Check if PostgreSQL: Use DB::statement for ltree
2. If MySQL: Use string column with index
3. Add column: geo_path (ltree for PG, string for MySQL)
4. Create GiST index for PostgreSQL
5. Create regular index for MySQL
6. Reverse migration drops column and index

Add to InstallMembershipModule job to run this migration.
```

**🎯 Prompt DB2: Add Scope Path to TenantUsers**
```
Create migration to add scope_path to tenant_users table:

File: database/migrations/tenant/YYYY_MM_DD_HHMMSS_add_scope_path_to_tenant_users.php

Requirements:
1. Add column: scope_path (string, nullable)
2. Add index for performance
3. Populate with default based on user's geography assignment
4. Migration should be safe for existing data

This enables JurisdictionScope functionality.
```

---

## **🧪 TESTING STRATEGY PROMPT**

**🎯 Prompt TEST: Run Complete Test Suite**
```
Create a testing command sequence for Phase 1:

Command Sequence:
1. Run Unit Tests (fast)
   php artisan test --testsuite=Unit --parallel

2. Run Feature Tests (comprehensive)
   php artisan test --testsuite=Feature --parallel --coverage --min=80

3. Run Vue Component Tests
   npm run test:unit

4. Generate Coverage Report
   php artisan test --coverage-html coverage-report

5. Run Performance Tests
   php artisan test --group=performance

Create GitHub Actions workflow:
- Run on push to main
- Run all test suites
- Fail if < 80% coverage
- Upload coverage report
```

---

## **🚀 DEPLOYMENT CHECKLIST PROMPT**

**🎯 Prompt DEPLOY: Phase 1 Deployment Steps**
```
Create deployment checklist for Phase 1:

Pre-Deployment:
1. [ ] Database backup
2. [ ] Enable PostgreSQL ltree extension
3. [ ] Run migrations on all tenant databases
4. [ ] Seed geography data if needed
5. [ ] Configure queue workers for module installation

Deployment Steps:
1. [ ] Deploy code to staging
2. [ ] Run comprehensive test suite
3. [ ] Test module installation on one tenant
4. [ ] Test member registration with geography
5. [ ] Test jurisdiction filtering
6. [ ] Test API endpoints
7. [ ] Verify Vue components work

Rollback Plan:
1. [ ] Database migration rollback scripts
2. [ ] Code rollback procedure
3. [ ] Cache clearing steps

Monitoring:
1. [ ] Log geo_path generation errors
2. [ ] Monitor jurisdiction scope queries
3. [ ] Alert on TenantUser validation failures
```

---

## **📊 PROGRESS TRACKING TEMPLATE**

**Copy this template for daily progress:**

```markdown
## PHASE 1 PROGRESS - DAY [X]

### ✅ COMPLETED TODAY
- [ ] Task 1
- [ ] Task 2

### 🔄 IN PROGRESS
- Task (estimated completion: [time])

### 🚨 BLOCKERS
- Issue
- Resolution needed

### 🎯 NEXT UP
1. Next task
2. Following task

### 🧪 TESTS PASSING
- Unit: X/Y passing
- Feature: X/Y passing
- Coverage: XX%

### 📝 NOTES
- Key decisions
- Architecture changes
- Performance considerations
```

---

## **💡 IMPLEMENTATION TIPS FOR CLAUDE**

1. **ONE PROMPT, ONE TASK**: Each prompt should focus on a single, testable unit of work
2. **TDD CYCLE**: Always follow: Test → Fail → Implement → Pass → Refactor
3. **DOMAIN LANGUAGE**: Use business terms (Member, TenantUser, Jurisdiction, not User, Account, Filter)
4. **ERROR HANDLING**: Throw DomainException for business rule violations
5. **PERFORMANCE**: Consider PostgreSQL-specific optimizations (ltree, GiST indexes)
6. **SECURITY**: Always validate tenant isolation in tests

---

## **🔗 START HERE**

**Begin with this command:**
```bash
# Create the first failing test
php artisan make:test TenantUserValidatorTest --pest --context=Membership
```

**Then use Prompt 1.1 to fill in the test, run it (should fail), then Prompt 1.2 to implement.**

Proceed systematically through each day's prompts, maintaining the TDD red-green-refactor cycle. Report progress daily using the tracking template above.

**Ready to begin Day 1? Execute Prompt 1.1 now.**
Perfect! Let's begin with **Day 1** of Phase 1, following the strict **TDD** approach.

## **📅 DAY 1: TENANTUSER VALIDATOR SERVICE**

### **🎯 STEP 1: CREATE THE FAILING TEST**

Here is the specific command and prompt to start. Copy and run this in your terminal.

**1. First, create the test file structure:**
```bash
php artisan make:test Contexts/Membership/TenantUserValidatorTest --pest
```

**2. Now, copy this exact prompt to Claude (Code/CLI) to generate the comprehensive test:**

> **Role:** Senior Laravel Backend Developer following Test-Driven Development (TDD).
> **Task:** Create the complete PestPHP test file for the `TenantUserValidator` service. We are in the **RED** phase.
>
> **File to Create:** `tests/Feature/Contexts/Membership/TenantUserValidatorTest.php`
>
> **Test Requirements:**
> 1. **Namespace & Setup:** Use the standard Laravel test namespace. Use the `DatabaseTransactions` trait.
> 2. **Mocking:** Mock the `TenantUserRepositoryInterface` to control test data. Use Pest's `Mockery` or `fn () => mock()` syntax.
> 3. **Test Cases (Implement ALL):**
>    - `test_validates_active_tenant_user()`: Mocks a valid, active `TenantUser`. The validator should return this user object.
>    - `test_throws_exception_for_inactive_user()`: Mocks a user where `status !== 'active'`. Expect a `DomainException` with message containing "inactive".
>    - `test_throws_exception_for_user_already_linked()`: Mocks a user who already has a related `Member` record (check via `member` relationship). Expect a `DomainException` about existing link.
>    - `test_throws_exception_for_cross_tenant_user()`: Mocks a user whose `tenant_id` does NOT match the `$tenantId` passed to the validator. Expect a `DomainException` about tenant mismatch.
>    - `test_throws_exception_for_nonexistent_user()`: Mocks the repository to return `null`. Expect a `DomainException` about user not found.
> 4. **Follow TDD Workflow:** Write clear, failing test assertions first. Do NOT create the actual `TenantUserValidator` class yet.
> 5. **Code Style:** Use Pest's higher-order testing syntax where applicable (e.g., `it('validates active tenant user', function () { ... })`). Ensure every test has a clear, descriptive failure message.
>
> **Important:** This is step one of TDD. The tests must run and **FAIL** because the service doesn't exist yet.

**3. Run the test to confirm it fails (RED phase):**
```bash
./vendor/bin/pest tests/Feature/Contexts/Membership/TenantUserValidatorTest.php
```
*Expected result: All tests fail with `Class "App\Contexts\Membership\Application\Services\TenantUserValidator" not found` or similar.*

---

### **🎯 STEP 2: CREATE THE MINIMAL IMPLEMENTATION (GREEN PHASE)**

Once you have the failing tests, use this next prompt to generate the `TenantUserValidator` service.

> **Role:** Senior Laravel Backend Developer implementing a Domain Service.
> **Task:** Create the `TenantUserValidator` service to make the failing tests from Step 1 pass (GREEN phase). Implement the **minimum required code** to satisfy the tests.
>
> **Files to Create:**
> 1. **Domain Exception:** `app/Contexts/Membership/Domain/Exceptions/InvalidTenantUserException.php`
> 2. **Repository Interface:** `app/Contexts/Membership/Domain/Repositories/TenantUserRepositoryInterface.php`
> 3. **Main Service:** `app/Contexts/Membership/Application/Services/TenantUserValidator.php`
>
> **Implementation Requirements:**
> 1. **`InvalidTenantUserException`:** Extend `DomainException`. It should accept a string `$reason` in its constructor.
> 2. **`TenantUserRepositoryInterface`:** Declare one method: `find(int $id): ?TenantUser`.
> 3. **`TenantUserValidator` Class:**
>    - **Constructor:** Accepts `TenantUserRepositoryInterface $repository`.
>    - **Method:** `validate(int $tenantUserId, int $tenantId): TenantUser`
>    - **Business Logic (in order):**
>        a. Fetch the user via the repository. If `null`, throw `InvalidTenantUserException` with reason "User not found".
>        b. Check `$user->tenant_id === $tenantId`. If false, throw exception with reason "User belongs to a different tenant".
>        c. Check `$user->status === 'active'`. If false, throw exception with reason "User account is inactive".
>        d. Check `$user->member` relation is `null` (or `!$user->member()->exists()`). If a member exists, throw exception with reason "User is already linked to a member profile".
>        e. If all checks pass, return the `$user` object.
> 4. **Code Quality:** Use strict typing, constructor property promotion, and clear, descriptive exception messages.
>
> **Do NOT** create the Eloquent repository implementation yet. We are only satisfying the unit tests with mocked dependencies.

**4. Run the tests again to see them pass (GREEN phase):**
```bash
./vendor/bin/pest tests/Feature/Contexts/Membership/TenantUserValidatorTest.php
```
*Expected result: All 5 tests pass.*

---

### **🎯 STEP 3: REFACTOR (REFACTOR PHASE)**

With green tests, look for refactoring opportunities. Use this prompt if needed.

> **Role:** Senior Developer performing TDD refactoring.
> **Task:** Review the `TenantUserValidator` and its tests for refactoring opportunities.
>
> **Checklist:**
> 1. **DRY Violations:** Is any validation logic duplicated?
> 2. **Method Extraction:** Could the validation steps be private methods for clarity (e.g., `ensureUserExists`, `ensureCorrectTenant`, etc.)?
> 3. **Test Clarity:** Are the test descriptions perfect? Could any test setup be extracted to a helper function?
> 4. **Exception Messages:** Are the exception messages consistent and useful for logging?
>
> **Refactor the code if necessary, then re-run tests to ensure they still pass.**

---

### **📊 DAY 1 PROGRESS TRACKER**

Copy this template and fill it out after completing the steps above:

```markdown
## PHASE 1 PROGRESS - DAY 1: TENANTUSER VALIDATOR

### ✅ COMPLETED
- [ ] Created failing Pest tests for `TenantUserValidator`
- [ ] Implemented `InvalidTenantUserException`
- [ ] Implemented `TenantUserRepositoryInterface`
- [ ] Implemented `TenantUserValidator` service with all business rules
- [ ] All 5 unit tests are passing (GREEN)

### 🔄 IN PROGRESS
- N/A

### 🚨 BLOCKERS
- None

### 🎯 NEXT UP (DAY 2)
1. Create failing tests for `GeographyPathService`
2. Implement `GeographyPathService` with ltree path generation
3. Refactor and integrate

### 🧪 TESTS STATUS
- **Tests Passing:** 5/5
- **Coverage:** To be measured after integration

### 📝 NOTES
- Used TDD Red-Green-Refactor cycle successfully.
- Decided to create a specific `InvalidTenantUserException` for domain-level validation errors.
- Repository interface keeps service testable and decoupled.
```

---

## **🚀 ACTION PLAN FOR YOU NOW**

1.  **Execute Step 1:** Run the `artisan make:test` command.
2.  **Feed Prompt 1 to Claude:** Generate the failing test file.
3.  **Run the test:** Confirm it fails with `./vendor/bin/pest`.
4.  **Feed Prompt 2 to Claude:** Generate the service implementation.
5.  **Run the test again:** Confirm all tests pass.
6.  **Fill out the Progress Tracker.**

#######################
actual updated plan for first day (Day 1):
Excellent! Now I can see exactly what you have. Your `MemberRegistrationService` is well-structured but **missing critical TenantUser validation**.

## **🔍 ANALYSIS: CURRENT IMPLEMENTATION STATUS**

### **✅ WHAT YOU HAVE:**
1. **Geography validation** (via `GeographyService`)
2. **Membership number generation** (with sequence logic)
3. **Basic field validation** (required fields)
4. **Transaction support** (DB::transaction)

### **❌ WHAT'S MISSING (Critical Gaps):**
1. **❌ TenantUser existence check** - No validation that `tenant_user_id` exists
2. **❌ User status validation** - No check if user is `active`/`inactive`
3. **❌ Tenant isolation** - No check that user belongs to the same tenant
4. **❌ No duplicate links** - User could be linked to multiple members
5. **❌ No Domain Exception** for TenantUser validation failures
6. **❌ No separation of concerns** - All validation in one service

---

## **🎯 DAY 1 ADJUSTED PLAN: EXTRACT & ENHANCE**

Since you have a working `MemberRegistrationService`, we'll **extract TenantUser validation** into its own service, then **enhance it with business rules**.

### **📋 DAY 1 UPDATED TASKS:**
1. **Create `TenantUserValidator`** (extract validation logic)
2. **Add missing business rules** (status, tenant isolation, no duplicates)
3. **Update `MemberRegistrationService`** to use the new validator
4. **Write comprehensive tests** (TDD approach)

---

## **🚀 STEP 1: CREATE FAILING TESTS (RED PHASE)**

**First, create the test file:**
```bash
php artisan make:test Contexts/Membership/TenantUserValidatorTest --pest
```

**Then use this prompt with Claude to create comprehensive tests:**

> **Role:** Senior Laravel Developer implementing TDD
> **Phase:** RED (Create failing tests)
> 
> **File:** `tests/Feature/Contexts/Membership/TenantUserValidatorTest.php`
> 
> **Test Requirements:**
> 1. **Mock Dependencies:** Mock `TenantUserRepositoryInterface` and `MemberRepository`
> 2. **Test Cases (7 total):**
> 
>    **A. Valid Scenarios:**
>    1. `test_validates_active_tenant_user_without_existing_member()`
>        - Valid active user, no existing member link
>        - Should return TenantUser instance
> 
>    **B. Invalid Scenarios (should throw DomainException):**
>    2. `test_throws_for_nonexistent_user()`
>        - Repository returns null
>        - Exception: "User not found"
> 
>    3. `test_throws_for_inactive_user()`
>        - User status != 'active'
>        - Exception: "User account is inactive"
> 
>    4. `test_throws_for_cross_tenant_user()`
>        - User's tenant_id != validator's tenant_id
>        - Exception: "User belongs to a different tenant"
> 
>    5. `test_throws_for_user_already_linked_to_member()`
>        - User already has a member relation
>        - Exception: "User is already linked to a member profile"
> 
>    6. `test_handles_optional_tenant_user_id()`
>        - tenant_user_id is null/empty
>        - Should return null (no validation needed)
> 
>    7. `test_uses_correct_repository_methods()`
>        - Verify repository called with correct parameters
> 
> 3. **TDD Rules:**
>    - Write tests that WILL FAIL initially
>    - Do NOT create the service class yet
>    - Use descriptive error messages
>    - Use `expectException()` for exception tests
> 
> **Code Structure:**
> ```php
> use Tests\TestCase;
> use App\Contexts\Membership\Domain\Exceptions\InvalidTenantUserException;
> 
> class TenantUserValidatorTest extends TestCase
> {
>     public function test_validates_active_tenant_user_without_existing_member()
>     {
>         // Mock setup
>         $mockUser = $this->createMock(TenantUser::class);
>         $mockUser->method('getAttribute')->willReturnMap([
>             ['status', 'active'],
>             ['tenant_id', 1]
>         ]);
>         
>         // This will fail - service doesn't exist yet
>         $validator = new TenantUserValidator($mockRepository);
>         $result = $validator->validate(1, 1);
>         
>         $this->assertSame($mockUser, $result);
>     }
> }
> ```

---

## **🔧 WHAT WE'LL BUILD**

After tests fail, we'll create:

### **1. Domain Exception:**
```php
// app/Contexts/Membership/Domain/Exceptions/InvalidTenantUserException.php
class InvalidTenantUserException extends DomainException
{
    public static function notFound(int $userId): self
    public static function inactive(int $userId): self
    public static function wrongTenant(int $userId, int $expectedTenantId): self
    public static function alreadyLinked(int $userId): self
}
```

### **2. Repository Interface:**
```php
// app/Contexts/Membership/Domain/Repositories/TenantUserRepositoryInterface.php
interface TenantUserRepositoryInterface
{
    public function findById(int $id): ?TenantUser;
}
```

### **3. TenantUserValidator Service:**
```php
// app/Contexts/Membership/Application/Services/TenantUserValidator.php
class TenantUserValidator
{
    public function __construct(
        private TenantUserRepositoryInterface $userRepository,
        private MemberRepositoryInterface $memberRepository
    ) {}
    
    public function validate(?int $tenantUserId, int $tenantId): ?TenantUser
    {
        if (!$tenantUserId) {
            return null; // No user ID provided
        }
        
        $user = $this->userRepository->findById($tenantUserId);
        
        // Check: User exists
        // Check: User is active
        // Check: User belongs to correct tenant
        // Check: User not already linked to member
        
        return $user;
    }
}
```

### **4. Update MemberRegistrationService:**
```php
// Add to constructor:
public function __construct(
    protected GeographyService $geographyService,
    protected TenantUserValidator $tenantUserValidator // NEW
) {}

// Update register() method:
public function register(array $data): Member
{
    // ... existing validation
    
    // NEW: Validate TenantUser
    $tenantUser = $this->tenantUserValidator->validate(
        $data['tenant_user_id'] ?? null,
        $tenant->id
    );
    
    return DB::transaction(function () use ($data, $tenant, $membershipNumber, $tenantUser) {
        return Member::create([
            'tenant_id' => $tenant->id,
            'tenant_user_id' => $tenantUser ? $tenantUser->id : null, // Use validated ID
            // ... other fields
        ]);
    });
}
```

---

## **🎯 IMMEDIATE ACTION**

1. **Run the command** to create test file
2. **Use the prompt above** to generate failing tests
3. **Verify tests fail** (RED phase)
4. **I'll provide the next prompt** to implement the validator

**Ready to proceed? Run:**
```bash
php artisan make:test Contexts/Membership/TenantUserValidatorTest --pest
```

Then use the prompt with Claude. Share the test output when done!
