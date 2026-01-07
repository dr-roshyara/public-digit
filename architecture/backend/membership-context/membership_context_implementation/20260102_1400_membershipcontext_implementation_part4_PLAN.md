# Membership Context - Part 4: API Layer Implementation Plan

**Date**: 2026-01-02 14:00
**Phase**: HTTP API Layer (Complete Stack)
**Status**: Implementation Ready
**TDD**: Test-First Approach

---

## Executive Summary

This plan provides a **production-ready implementation strategy** for the Membership Context HTTP API layer that:

1. **Resolves conflicts** between Part 4 specifications and existing codebase patterns
2. **Maintains strict DDD principles** (Domain → Application → Infrastructure separation)
3. **Follows existing architectural patterns** from Geography, DigitalCard, and MobileDevice contexts
4. **Enables TDD workflow** (Tests First → Implementation Second)
5. **Ensures multi-tenancy compliance** with tenant context isolation

---

## Architecture Decisions

### 1. Controller Pattern Decision

**Decision**: Use **Multi-Method Controllers** (NOT Invokable)

**Rationale**:
- ✅ **100% consistency** with existing contexts (Geography, DigitalCard, MobileDevice)
- ✅ **Easier extension** for upcoming operations (approve, activate, list)
- ✅ **Team familiarity** - all existing controllers use this pattern
- ✅ **Context cohesion** - related member operations grouped in one controller

**Part 4 Deviation**: Part 4 specified invokable controller, but we adopt multi-method for consistency

**Evidence**:
```php
// ALL existing controllers use multi-method pattern:
GeographyController        → validateHierarchy(), getUnits()
DeviceController          → register(), updateToken(), unregister()
DigitalCardController     → store(), show()
```

---

## File Structure

```
app/Contexts/Membership/
├── Infrastructure/
│   └── Http/
│       ├── Controllers/
│       │   └── MemberController.php          # NEW
│       ├── Requests/
│       │   └── RegisterMemberRequest.php     # NEW
│       └── Resources/
│           └── MemberResource.php            # NEW

routes/
└── tenant-api/
    └── membership-api.php                    # NEW

tests/
└── Feature/
    └── Contexts/
        └── Membership/
            └── Http/
                └── MemberRegistrationHttpTest.php  # NEW
```

---

## Route Design

### Route Pattern

**Type**: CASE 4 - Tenant Desktop API

```
POST   /{tenant}/api/v1/members               → Register member
GET    /{tenant}/api/v1/members/{id}          → Get member detail
POST   /{tenant}/api/v1/members/{id}/approve  → Approve member (future)
POST   /{tenant}/api/v1/members/{id}/activate → Activate member (future)
GET    /{tenant}/api/v1/members               → List members (future)
```

### Middleware Stack

**Full stack**: `web → identify.tenant → auth:sanctum`

- `web` - Session, CSRF, cookies (from tenant-api.php parent)
- `identify.tenant` - Tenant context resolution (from tenant-api.php parent)
- `auth:sanctum` - Stateless authentication (applied to routes)

### Route File Location

**File**: `routes/tenant-api/membership-api.php`

**Loaded by**: `routes/tenant-api.php` (add line 157):
```php
require __DIR__.'/tenant-api/membership-api.php';
```

**Pattern follows**: `routes/tenant-api/digitalcard-api.php`

---

## Implementation Specifications

### 1. MemberController

**File**: `app/Contexts/Membership/Infrastructure/Http/Controllers/MemberController.php`

**Responsibilities**:
- HTTP request handling ONLY
- Orchestrate command execution via handlers
- Map domain exceptions to HTTP status codes
- Return JSON responses

**Dependencies** (Constructor Injection):
```php
private readonly RegisterMemberHandler $registerHandler
private readonly MemberRepositoryInterface $repository
```

**Methods**:
```php
public function store(RegisterMemberRequest $request): JsonResponse
{
    // 1. Create command from validated request
    // 2. Execute via handler
    // 3. Return 201 Created with resource
    // 4. Map exceptions to HTTP errors
}

public function show(string $id): JsonResponse
{
    // 1. Get tenant from route
    // 2. Find member via repository
    // 3. Return 200 OK with resource or 404
}
```

**Error Mapping**:
- `InvalidArgumentException` (Command validation) → 422 Unprocessable Entity
- `InvalidArgumentException` (Duplicate member) → 409 Conflict
- `InvalidArgumentException` (Missing identity) → 400 Bad Request
- Repository returns null → 404 Not Found
- FormRequest validation fails → 422 Unprocessable Entity

---

### 2. RegisterMemberRequest

**File**: `app/Contexts/Membership/Infrastructure/Http/Requests/RegisterMemberRequest.php`

**Responsibilities**:
- HTTP input validation
- Authorization (must be authenticated)
- Tenant context integration
- Custom error messages

**Validation Rules**:

```php
'tenant_user_id' => [
    'required',
    'string',
    'size:26',  // ULID = 26 characters
    'regex:/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/',
    Rule::exists('tenant_users', 'id')
        ->where('tenant_id', $tenant),
]

'full_name' => [
    'required',
    'string',
    'min:2',
    'max:255',
]

'email' => [
    'required',
    'email:rfc,dns',
    'max:255',
]

'phone' => [
    'nullable',
    'string',
    'max:20',
    'regex:/^\+?[0-9\s\-\(\)]+$/',
]

'member_id' => [
    'nullable',
    'string',
    'max:50',
    'regex:/^[A-Z0-9\-]+$/',
    Rule::unique('members', 'member_id')
        ->where('tenant_id', $tenant),
]

'geo_reference' => [
    'nullable',
    'string',
    'max:500',
]
```

**Authorization**:
```php
public function authorize(): bool
{
    return $this->user() !== null;
}
```

**Tenant Context**:
```php
protected function prepareForValidation(): void
{
    $this->merge([
        'tenant_id' => $this->route('tenant'),
    ]);
}
```

---

### 3. MemberResource

**File**: `app/Contexts/Membership/Infrastructure/Http/Resources/MemberResource.php`

**Responsibilities**:
- Transform Member domain entity to JSON:API format
- Provide HATEOAS links
- Hide internal domain structure

**Response Format** (JSON:API 1.0):

```json
{
  "data": {
    "type": "members",
    "id": "01JKABCD1234567890ABCDEFGH",
    "attributes": {
      "member_id": "UML-2024-0001",
      "tenant_user_id": "01JKUSER1234567890ABCDEFGH",
      "tenant_id": "uml",
      "personal_info": {
        "full_name": "John Doe",
        "email": "john@example.com",
        "phone": "+977-9841234567"
      },
      "status": "draft",
      "residence_geo_reference": "np.3.15.234.1.2",
      "membership_type": "regular",
      "can_vote": false,
      "can_hold_committee_role": false
    },
    "meta": {
      "created_at": "2026-01-02T14:00:00+00:00",
      "updated_at": "2026-01-02T14:00:00+00:00"
    },
    "links": {
      "self": "https://example.com/uml/api/v1/members/01JK..."
    }
  },
  "jsonapi": {
    "version": "1.0"
  }
}
```

**Key Transformations**:
```php
'member_id' => $member->member_id?->value(),  // Value Object → string
'email' => $member->personal_info->email->value(),  // Nested VO
'status' => $member->status->value(),  // Enum VO → string
'can_vote' => $member->canVote(),  // Business rule method
```

---

### 4. Routes Configuration

**File**: `routes/tenant-api/membership-api.php`

```php
<?php

use App\Contexts\Membership\Infrastructure\Http\Controllers\MemberController;
use Illuminate\Support\Facades\Route;

/**
 * Membership API Routes (Tenant-Scoped Desktop API)
 *
 * Base URL: /{tenant}/api/v1/members
 * Middleware: web → identify.tenant → auth:sanctum
 * Database: Tenant-specific (switched via identify.tenant)
 */

Route::prefix('members')
    ->name('members.')
    ->middleware(['auth:sanctum'])
    ->group(function () {

        // POST /{tenant}/api/v1/members - Register new member
        Route::post('/', [MemberController::class, 'store'])
            ->name('store');

        // GET /{tenant}/api/v1/members/{id} - Get member detail
        Route::get('/{id}', [MemberController::class, 'show'])
            ->where('id', '[0-9A-Z]{26}')  // ULID format
            ->name('show');

        // Future endpoints (commented for now)
        // Route::post('/{id}/approve', [MemberController::class, 'approve'])
        //     ->name('approve');
        // Route::post('/{id}/activate', [MemberController::class, 'activate'])
        //     ->name('activate');
        // Route::get('/', [MemberController::class, 'index'])
        //     ->name('index');
    });
```

**Load in**: `routes/tenant-api.php` (line 157):
```php
// Membership API routes
require __DIR__.'/tenant-api/membership-api.php';
```

---

## Testing Strategy

### Test-Driven Development (TDD) Workflow

**RED → GREEN → REFACTOR**

1. **RED**: Write failing tests first
2. **GREEN**: Implement minimum code to pass tests
3. **REFACTOR**: Improve code quality while keeping tests green

### Test File

**Location**: `tests/Feature/Contexts/Membership/Http/MemberRegistrationHttpTest.php`

### Test Cases (7 Total)

#### 1. Happy Path - Successful Registration

```php
/** @test */
public function member_can_be_registered_via_http_api()
{
    // Given: Authenticated tenant user
    $tenantUser = TenantUser::factory()->create(['tenant_id' => 'uml']);
    $this->actingAs($tenantUser, 'sanctum');

    // When: POST request to register member
    $response = $this->postJson('/uml/api/v1/members', [
        'tenant_user_id' => $tenantUser->id,
        'full_name' => 'John Doe',
        'email' => 'john@example.com',
        'phone' => '+977-9841234567',
        'member_id' => 'UML-2024-0001',
    ]);

    // Then: Member created successfully
    $response->assertStatus(201)
             ->assertJsonStructure([
                 'data' => ['type', 'id', 'attributes'],
                 'message',
                 'links' => ['self'],
             ]);

    $this->assertDatabaseHas('members', [
        'tenant_user_id' => $tenantUser->id,
        'tenant_id' => 'uml',
    ]);
}
```

#### 2. Validation - Invalid Email

```php
/** @test */
public function member_registration_fails_with_invalid_email()
{
    $tenantUser = TenantUser::factory()->create();
    $this->actingAs($tenantUser, 'sanctum');

    $response = $this->postJson('/uml/api/v1/members', [
        'tenant_user_id' => $tenantUser->id,
        'full_name' => 'John Doe',
        'email' => 'not-an-email',
    ]);

    $response->assertStatus(422)
             ->assertJsonValidationErrors(['email']);
}
```

#### 3. Business Rule - Duplicate Member

```php
/** @test */
public function member_registration_fails_if_user_already_has_membership()
{
    // Given: User already has member record
    $tenantUser = TenantUser::factory()->create();
    Member::factory()->create(['tenant_user_id' => $tenantUser->id]);

    $this->actingAs($tenantUser, 'sanctum');

    // When: Try to register same user again
    $response = $this->postJson('/uml/api/v1/members', [
        'tenant_user_id' => $tenantUser->id,
        'full_name' => 'John Doe',
        'email' => 'john@example.com',
    ]);

    // Then: Returns 422 with error
    $response->assertStatus(422)
             ->assertJson([
                 'message' => 'Registration failed',
             ]);
}
```

#### 4. Business Rule - Missing Identity

```php
/** @test */
public function member_registration_fails_if_tenant_user_does_not_exist()
{
    $this->actingAs(TenantUser::factory()->create(), 'sanctum');

    $response = $this->postJson('/uml/api/v1/members', [
        'tenant_user_id' => '01JKNONEXISTENT1234567890',
        'full_name' => 'John Doe',
        'email' => 'john@example.com',
    ]);

    $response->assertStatus(422)
             ->assertJsonValidationErrors(['tenant_user_id']);
}
```

#### 5. Security - Unauthorized Access

```php
/** @test */
public function member_registration_requires_authentication()
{
    // When: Unauthenticated request
    $response = $this->postJson('/uml/api/v1/members', [
        'tenant_user_id' => '01JKVALID123456789012345',
        'full_name' => 'John Doe',
        'email' => 'john@example.com',
    ]);

    // Then: Returns 401
    $response->assertStatus(401);
}
```

#### 6. Get Member Detail - Success

```php
/** @test */
public function authenticated_user_can_get_member_details()
{
    // Given: Member exists
    $member = Member::factory()->create(['tenant_id' => 'uml']);
    $this->actingAs($member->tenantUser, 'sanctum');

    // When: GET request
    $response = $this->getJson("/uml/api/v1/members/{$member->id}");

    // Then: Returns member data
    $response->assertStatus(200)
             ->assertJsonStructure([
                 'data' => ['type', 'id', 'attributes'],
             ]);
}
```

#### 7. Get Member Detail - Not Found

```php
/** @test */
public function get_member_returns_404_for_non_existent_member()
{
    $this->actingAs(TenantUser::factory()->create(), 'sanctum');

    $response = $this->getJson('/uml/api/v1/members/01JKNONEXISTENT1234567890');

    $response->assertStatus(404)
             ->assertJson(['message' => 'Member not found']);
}
```

### Test Coverage Requirements

- **Minimum**: 80% (per CLAUDE.md)
- **Target**: 90%+
- **Critical paths**: 100% (registration, validation, error handling)

---

## Implementation Order (TDD Workflow)

### Phase 1: Foundation Setup (30 minutes)

**Step 1**: Create directory structure
```bash
mkdir -p app/Contexts/Membership/Infrastructure/Http/Controllers
mkdir -p app/Contexts/Membership/Infrastructure/Http/Requests
mkdir -p app/Contexts/Membership/Infrastructure/Http/Resources
mkdir -p routes/tenant-api
mkdir -p tests/Feature/Contexts/Membership/Http
```

**Step 2**: Create stub files (empty classes)
- `MemberController.php` - Empty controller with namespace
- `RegisterMemberRequest.php` - Empty FormRequest
- `MemberResource.php` - Empty JsonResource
- `membership-api.php` - Empty route file

---

### Phase 2: Write Failing Tests - RED (1.5 hours)

**Step 3**: Create `MemberRegistrationHttpTest.php`

Write all 7 test cases:
1. ✅ Happy path registration
2. ✅ Invalid email validation
3. ✅ Duplicate member prevention
4. ✅ Missing identity validation
5. ✅ Unauthorized access
6. ✅ Get member detail success
7. ✅ Get member detail not found

**Step 4**: Run tests
```bash
php artisan test tests/Feature/Contexts/Membership/Http/MemberRegistrationHttpTest.php
```

**Expected Result**: 🔴 **ALL TESTS FAIL** (RED phase)

---

### Phase 3: Implement FormRequest - GREEN (45 minutes)

**Step 5**: Implement `RegisterMemberRequest.php`

```php
- authorize() method → return $this->user() !== null
- rules() method → all validation rules
- messages() method → custom error messages
- attributes() method → friendly attribute names
- prepareForValidation() → inject tenant_id from route
```

**Step 6**: Run validation tests
```bash
php artisan test --filter=member_registration_fails
```

**Expected Result**: 🟢 **Validation tests PASS**

---

### Phase 4: Implement Resource - GREEN (30 minutes)

**Step 7**: Implement `MemberResource.php`

```php
- toArray() method → JSON:API format
- with() method → jsonapi version
- Transform value objects to primitives
- Add HATEOAS links
```

**Step 8**: Test resource manually (optional)
```php
php artisan tinker
$member = Member::first();
new MemberResource($member);
```

---

### Phase 5: Implement Controller - GREEN (1 hour)

**Step 9**: Implement `MemberController.php`

```php
- Constructor injection (handler, repository)
- store() method → handle registration
- show() method → get member detail
- Error handling (try-catch)
- HTTP status code mapping
```

**Step 10**: Implement routes (`membership-api.php`)

```php
- POST /members → store
- GET /members/{id} → show
- Middleware: auth:sanctum
- Route naming: members.store, members.show
```

**Step 11**: Load routes in `routes/tenant-api.php`

---

### Phase 6: Run All Tests - GREEN (30 minutes)

**Step 12**: Run full test suite
```bash
php artisan test tests/Feature/Contexts/Membership/Http/MemberRegistrationHttpTest.php
```

**Expected Result**: 🟢 **ALL 7 TESTS PASS** (GREEN phase)

**Step 13**: Run all membership tests
```bash
php artisan test tests/Unit/Contexts/Membership/
php artisan test tests/Feature/Contexts/Membership/
```

**Expected Result**: 🟢 **ALL TESTS PASS**

---

### Phase 7: Integration Testing (1 hour)

**Step 14**: Manual API testing with Postman/Insomnia

**Test 1**: Register member
```http
POST http://localhost:8000/uml/api/v1/members
Authorization: Bearer {sanctum_token}
Content-Type: application/json

{
  "tenant_user_id": "01JKUSER1234567890ABCDEFGH",
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+977-9841234567",
  "member_id": "UML-2024-0001",
  "geo_reference": "np.3.15.234.1.2"
}
```

**Expected Response**: 201 Created
```json
{
  "data": {
    "type": "members",
    "id": "01JKMEMBER1234567890ABCDEFGH",
    "attributes": {
      "member_id": "UML-2024-0001",
      "tenant_user_id": "01JKUSER1234567890ABCDEFGH",
      "tenant_id": "uml",
      "personal_info": {
        "full_name": "John Doe",
        "email": "john@example.com",
        "phone": "+977-9841234567"
      },
      "status": "draft",
      "residence_geo_reference": "np.3.15.234.1.2",
      "membership_type": "regular",
      "can_vote": false,
      "can_hold_committee_role": false
    },
    "meta": {
      "created_at": "2026-01-02T14:30:00Z",
      "updated_at": "2026-01-02T14:30:00Z"
    },
    "links": {
      "self": "http://localhost:8000/uml/api/v1/members/01JKMEMBER1234567890ABCDEFGH"
    }
  },
  "message": "Member registered successfully. Pending approval by organization administrator.",
  "links": {
    "self": "http://localhost:8000/uml/api/v1/members/01JKMEMBER1234567890ABCDEFGH"
  },
  "jsonapi": {
    "version": "1.0"
  }
}
```

**Test 2**: Get member detail
```http
GET http://localhost:8000/uml/api/v1/members/01JKMEMBER1234567890ABCDEFGH
Authorization: Bearer {sanctum_token}
```

**Expected Response**: 200 OK (same data structure as above)

**Test 3**: Validation error
```http
POST http://localhost:8000/uml/api/v1/members
Authorization: Bearer {sanctum_token}
Content-Type: application/json

{
  "tenant_user_id": "invalid-ulid",
  "full_name": "J",
  "email": "not-an-email"
}
```

**Expected Response**: 422 Unprocessable Entity
```json
{
  "message": "Validation failed",
  "errors": {
    "tenant_user_id": [
      "Tenant user ID must be a valid ULID (26 characters)."
    ],
    "full_name": [
      "Full name must be at least 2 characters."
    ],
    "email": [
      "Email address must be valid."
    ]
  }
}
```

**Test 4**: Duplicate member
```http
POST http://localhost:8000/uml/api/v1/members
Authorization: Bearer {sanctum_token}
Content-Type: application/json

{
  "tenant_user_id": "01JKUSER1234567890ABCDEFGH",
  "full_name": "John Doe",
  "email": "john@example.com"
}
```

**Expected Response**: 422 Unprocessable Entity
```json
{
  "message": "Registration failed",
  "error": "This user is already registered as a member. One user can only be one member per tenant."
}
```

**Test 5**: Unauthorized access
```http
POST http://localhost:8000/uml/api/v1/members
Content-Type: application/json

{
  "tenant_user_id": "01JKUSER1234567890ABCDEFGH",
  "full_name": "John Doe",
  "email": "john@example.com"
}
```

**Expected Response**: 401 Unauthorized
```json
{
  "message": "Unauthenticated."
}
```

**Step 15**: Verify tenant isolation
- Create member in `uml` tenant
- Try to access from `nrna` tenant context
- Should return 404 (tenant boundary enforced)

**Step 16**: Verify database records
```bash
php artisan tinker
>>> Member::where('tenant_id', 'uml')->count()
>>> Member::first()->toArray()
```

---

### Phase 8: Refactor (30 minutes)

**Step 17**: Code quality improvements
- Extract magic strings to constants
- Add PHPDoc comments
- Improve error messages
- Add logging for critical operations

**Step 18**: Run tests again after refactoring
```bash
php artisan test tests/Feature/Contexts/Membership/
```

**Expected Result**: 🟢 **ALL TESTS STILL PASS**

---

## Dependencies & Prerequisites

### ✅ Already Implemented

- Domain Layer: `Member` aggregate, Value Objects, Events
- Application Layer: `RegisterMemberCommand`, `RegisterMemberHandler`
- Infrastructure Layer: `EloquentMemberRepository`, `TenantUserIdentityVerification`
- Service Provider: `MembershipServiceProvider` with bindings
- Database Migration: `create_members_table.php`
- Unit Tests: `MemberRequiresUserAccountTest.php` (4/4 passing)

### ✅ Required Middleware (Existing)

- `web` - Session-based middleware
- `identify.tenant` - Tenant context resolution
- `auth:sanctum` - Stateless token authentication

### ✅ Database Tables (Existing)

- `members` - Tenant database
- `tenant_users` - Tenant database (for FK validation)

---

## Architectural Compliance Checklist

### DDD Compliance

- ✅ **Domain Layer Purity**: No HTTP concerns in domain
- ✅ **Application Layer Orchestration**: Handler coordinates workflow
- ✅ **Infrastructure Layer HTTP**: Controller handles HTTP only
- ✅ **Value Objects**: Email, MemberId used correctly in responses
- ✅ **Repository Pattern**: Interface abstraction maintained
- ✅ **Domain Events**: MemberRegistered event recorded on registration

### Multi-Tenancy Compliance

- ✅ **Tenant Context**: Via `identify.tenant` middleware from route
- ✅ **Tenant Isolation**: All queries scoped to tenant via repository
- ✅ **No Cross-Tenant Access**: Repository enforces tenant boundary
- ✅ **Tenant ID in Route**: `/{tenant}/api/v1/*` pattern followed

### Security Compliance

- ✅ **Authentication Required**: `auth:sanctum` middleware enforced
- ✅ **Authorization**: FormRequest `authorize()` method checks authentication
- ✅ **Input Validation**: FormRequest rules validate all inputs
- ✅ **SQL Injection Prevention**: Eloquent ORM (no raw queries)
- ✅ **Mass Assignment Protection**: Fillable properties defined in Member model
- ✅ **CSRF Protection**: Web middleware (for session-based requests)
- ✅ **Rate Limiting**: Can be added via `throttle:60,1` middleware

### Testing Compliance

- ✅ **TDD First**: Tests written before implementation (RED → GREEN)
- ✅ **80% Coverage**: All critical paths covered (7 test cases)
- ✅ **Feature Tests**: HTTP layer end-to-end testing
- ✅ **Error Scenarios**: All error cases tested (validation, duplicate, missing identity, unauthorized)
- ✅ **Authentication Tests**: Unauthorized access tested

---

## Success Criteria

### Functional Requirements

- ✅ Member can be registered via HTTP POST request
- ✅ Member details can be retrieved via HTTP GET request
- ✅ Validation errors return 422 with clear messages
- ✅ Business rule violations return appropriate HTTP status codes
- ✅ Unauthorized requests return 401
- ✅ Non-existent members return 404
- ✅ Responses follow JSON:API 1.0 format
- ✅ HATEOAS links included in responses

### Non-Functional Requirements

- ✅ All tests pass (7/7 feature tests + 4/4 unit tests)
- ✅ Test coverage ≥ 80%
- ✅ Response time < 200ms for registration
- ✅ Response time < 100ms for member detail
- ✅ No N+1 query problems
- ✅ Proper error logging
- ✅ Consistent with existing API patterns

---

## Estimated Time

| Phase | Task | Time |
|-------|------|------|
| 1 | Foundation Setup | 30 min |
| 2 | Write Failing Tests (RED) | 1.5 hours |
| 3 | Implement FormRequest (GREEN) | 45 min |
| 4 | Implement Resource (GREEN) | 30 min |
| 5 | Implement Controller (GREEN) | 1 hour |
| 6 | Run All Tests (GREEN) | 30 min |
| 7 | Integration Testing | 1 hour |
| 8 | Refactor | 30 min |
| **TOTAL** | | **~6 hours** |

---

## Risk Assessment

### Low Risks

- ✅ Domain layer already complete and tested
- ✅ Application layer already complete and tested
- ✅ Existing patterns well-established in codebase
- ✅ Clear test cases defined

### Medium Risks

- ⚠️ **Route conflicts**: Ensure membership-api.php loads correctly
  - **Mitigation**: Test route loading immediately after creation

- ⚠️ **Tenant context resolution**: Ensure `identify.tenant` middleware works
  - **Mitigation**: Add integration test for tenant isolation

### High Risks

- 🔴 **Sanctum authentication**: Token generation/validation must work
  - **Mitigation**: Test authentication flow in integration phase
  - **Fallback**: Use session-based auth if Sanctum fails

---

## Post-Implementation Tasks

### Documentation

1. Update API documentation with new endpoints
2. Create Postman collection for Membership API
3. Add examples to developer guide
4. Document error codes and responses

### Future Enhancements

1. Add pagination to member list endpoint
2. Implement member approval workflow (POST /members/{id}/approve)
3. Implement member activation (POST /members/{id}/activate)
4. Add filtering and search to member list
5. Add bulk operations (bulk approve, bulk activate)
6. Add member statistics endpoint

---

## Critical Files Summary

| File | Purpose | Priority |
|------|---------|----------|
| `MemberController.php` | HTTP orchestration, error mapping | 🔴 Critical |
| `RegisterMemberRequest.php` | Input validation, authorization | 🔴 Critical |
| `MemberResource.php` | Response formatting, JSON:API | 🔴 Critical |
| `membership-api.php` | Route definitions | 🔴 Critical |
| `MemberRegistrationHttpTest.php` | End-to-end testing | 🔴 Critical |
| `tenant-api.php` | Route loading | 🟡 Important |

---

## Conclusion

This plan provides a **complete, production-ready implementation strategy** for the Membership Context HTTP API layer that:

1. ✅ Follows **strict TDD workflow** (RED → GREEN → REFACTOR)
2. ✅ Maintains **DDD purity** across all layers
3. ✅ Ensures **multi-tenancy compliance** with tenant isolation
4. ✅ Adopts **existing architectural patterns** for consistency
5. ✅ Provides **comprehensive testing** (7 feature tests + 4 unit tests)
6. ✅ Includes **clear error handling** with appropriate HTTP status codes
7. ✅ Follows **JSON:API 1.0 format** for responses
8. ✅ Enables **future extensibility** (approve, activate, list endpoints)

**Ready for implementation**: Proceed with Phase 1 (Foundation Setup) when approved.

---

**Last Updated**: 2026-01-02 14:00
**Status**: ✅ Implementation Plan Complete
**Next Step**: User approval to proceed with implementation
