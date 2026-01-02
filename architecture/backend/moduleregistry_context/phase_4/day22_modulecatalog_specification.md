# ModuleCatalogController - Behavior Specification
**Phase 4 Day 22** | **TDD Phase 0** | **Date**: 2025-12-29

---

## BEHAVIOR SPECIFICATION

### Feature Context
Platform API endpoint for managing the global module catalog (landlord database). Provides read and write access to available modules for platform administrators.

### Business Value
- **Platform Admins** can register new modules to make them available for tenant installation
- **Tenant Admins** can browse the module catalog to discover installable modules
- **System** maintains a centralized module registry for multi-tenant platform

### Routing Context
- **Case 3**: Platform Desktop API (`/api/v1/platform/modules`)
- **Database**: Landlord (shared across all tenants)
- **Authentication**: Laravel Sanctum (`auth:sanctum`)
- **Authorization**: Platform admin role required for POST

---

## BDD SCENARIOS (Given-When-Then)

### Scenario 1: List All Available Modules (Primary Happy Path)
```gherkin
Given the module catalog contains 3 published modules
And I am authenticated as a platform admin
When I send GET /api/v1/platform/modules
Then I should receive HTTP 200
And the response should contain 3 modules
And each module should have: id, name, version, description, requires_subscription
And the response should follow JSON API format with "data" key
```

### Scenario 2: View Single Module Details
```gherkin
Given a module "digital_card" exists with version "1.0.0"
And I am authenticated as a platform admin
When I send GET /api/v1/platform/modules/{module_id}
Then I should receive HTTP 200
And the response should contain full module details
And the response should include dependencies array
And the response should follow JSON API format
```

### Scenario 3: Register New Module (Write Operation)
```gherkin
Given I am authenticated as a platform admin
And I have valid module registration data
When I send POST /api/v1/platform/modules with:
  {
    "name": "digital_card",
    "version": "1.0.0",
    "description": "Digital business cards",
    "requires_subscription": true
  }
Then I should receive HTTP 201
And the module should be created in the catalog
And the response should return the created module
And a ModuleRegistered event should be published
```

### Scenario 4: Authentication Required (Security)
```gherkin
Given I am NOT authenticated
When I send GET /api/v1/platform/modules
Then I should receive HTTP 401
And the response should contain an authentication error
```

### Scenario 5: Validation Failure (Error Case)
```gherkin
Given I am authenticated as a platform admin
When I send POST /api/v1/platform/modules with invalid data:
  {
    "name": "",
    "version": "invalid"
  }
Then I should receive HTTP 422
And the response should contain validation errors
And the response should specify which fields failed
```

### Scenario 6: Duplicate Module Registration (Business Rule)
```gherkin
Given a module "digital_card" version "1.0.0" already exists
And I am authenticated as a platform admin
When I send POST /api/v1/platform/modules with:
  {
    "name": "digital_card",
    "version": "1.0.0"
  }
Then I should receive HTTP 422
And the response should indicate duplicate module
```

### Scenario 7: Module Not Found (Error Case)
```gherkin
Given I am authenticated as a platform admin
And module ID "non-existent-id" does not exist
When I send GET /api/v1/platform/modules/non-existent-id
Then I should receive HTTP 404
And the response should indicate module not found
```

### Scenario 8: Pagination Support (Performance)
```gherkin
Given the catalog contains 50 modules
And I am authenticated as a platform admin
When I send GET /api/v1/platform/modules?page=2&per_page=15
Then I should receive HTTP 200
And the response should contain 15 modules
And the response should include pagination meta
And the response should include pagination links (next, prev)
```

---

## ACCEPTANCE CRITERIA (ATDD)

### API Contract
- [ ] **AC1**: GET /api/v1/platform/modules returns paginated module list (default 15 per page)
- [ ] **AC2**: GET /api/v1/platform/modules/{id} returns single module with full details
- [ ] **AC3**: POST /api/v1/platform/modules creates module and returns 201 with resource
- [ ] **AC4**: All endpoints require `auth:sanctum` middleware
- [ ] **AC5**: POST endpoint requires platform admin authorization

### Response Format
- [ ] **AC6**: All responses use JSON API format with `data`, `meta`, `links` keys
- [ ] **AC7**: Success responses return appropriate HTTP status (200, 201)
- [ ] **AC8**: Error responses return appropriate HTTP status (401, 404, 422)
- [ ] **AC9**: Validation errors return field-level error messages

### Performance
- [ ] **AC10**: Module catalog list responds in <200ms (per phase 4 target)
- [ ] **AC11**: Single module retrieval responds in <100ms
- [ ] **AC12**: Database queries use eager loading (no N+1)

### Security
- [ ] **AC13**: Unauthenticated requests return 401
- [ ] **AC14**: Non-admin users cannot POST to catalog
- [ ] **AC15**: All input is validated and sanitized
- [ ] **AC16**: Rate limiting applied (60 requests/minute per user)

### Business Rules
- [ ] **AC17**: Module name must be unique per version
- [ ] **AC18**: Module name must follow pattern: `^[a-z0-9_]+$` (lowercase, numbers, underscores only)
- [ ] **AC19**: Version must follow semantic versioning (e.g., "1.0.0")
- [ ] **AC20**: Dependencies must reference existing modules

---

## UNIT TEST STRATEGY

### Integration Tests to Write (12 Tests)

**Authentication & Authorization Tests (3)**:
1. `test_unauthenticated_request_returns_401`
2. `test_authenticated_user_can_list_modules`
3. `test_only_platform_admin_can_register_module`

**Module Listing Tests (3)**:
4. `test_can_list_all_modules_in_catalog`
5. `test_module_list_includes_correct_attributes`
6. `test_module_list_supports_pagination`

**Single Module Retrieval Tests (2)**:
7. `test_can_retrieve_single_module_by_id`
8. `test_returns_404_when_module_not_found`

**Module Registration Tests (3)**:
9. `test_can_register_new_module`
10. `test_registration_validates_required_fields`
11. `test_cannot_register_duplicate_module`

**Response Format Tests (1)**:
12. `test_responses_follow_json_api_format`

### Dependencies to Mock/Stub
- **Application Services**: Inject via constructor
  - `ModuleRegistrationService` (for POST)
  - `GetAllModulesQuery` (for index)
  - `GetModuleByIdQuery` (for show)
- **Repository**: NOT mocked (integration test uses real database)
- **Event Publisher**: Use `Event::fake()` to verify events

### Property-Based Invariants
- Module name normalization: `strtolower(trim($name))` should always be applied
- Pagination: `total % per_page` should determine last page correctly
- JSON structure: Every response should have `data` key (never raw array)

---

## CONTROLLER DESIGN (Thin Controller Pattern)

### Architectural Constraints
```php
final class ModuleCatalogController extends Controller
{
    // MUST: Inject application services, NOT repositories
    public function __construct(
        private ModuleRegistrationService $moduleRegistrationService,
        private GetAllModulesQuery $getAllModulesQuery,
        private GetModuleByIdQuery $getModuleByIdQuery
    ) {}

    // MUST: Keep thin - delegate to application layer
    public function index(Request $request): JsonResponse
    {
        // 1. Extract query parameters
        // 2. Call application service
        // 3. Transform to API resource
        // 4. Return JSON response
    }

    // MUST: Return proper HTTP status codes
    // MUST: Use API Resources for transformation
    // MUST NOT: Contain business logic
}
```

### Response Format Standard
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "modules",
      "attributes": {
        "name": "digital_card",
        "version": "1.0.0",
        "description": "...",
        "requires_subscription": true
      },
      "relationships": {
        "dependencies": []
      },
      "links": {
        "self": "/api/v1/platform/modules/{id}"
      }
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 15,
    "total": 50,
    "last_page": 4
  },
  "links": {
    "first": "/api/v1/platform/modules?page=1",
    "last": "/api/v1/platform/modules?page=4",
    "prev": null,
    "next": "/api/v1/platform/modules?page=2"
  }
}
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: RED (Failing Tests)
- [ ] Create test file: `tests/Feature/Contexts/ModuleRegistry/Desktop/ModuleCatalogApiTest.php`
- [ ] Write 12 failing integration tests
- [ ] Verify tests fail for the right reason (not compilation errors)
- [ ] Use `RefreshDatabase` trait
- [ ] Use `Event::fake()` for event testing

### Phase 2: GREEN (Minimal Implementation)
- [ ] Create controller: `app/Contexts/ModuleRegistry/Presentation/Http/Controllers/Desktop/ModuleCatalogController.php`
- [ ] Create API resource: `app/Contexts/ModuleRegistry/Presentation/Http/Resources/ModuleResource.php`
- [ ] Create routes: `routes/api.php` (Platform group)
- [ ] Create form request: `app/Contexts/ModuleRegistry/Presentation/Http/Requests/RegisterModuleRequest.php`
- [ ] Verify all 12 tests pass

### Phase 3: REFACTOR
- [ ] Extract common patterns
- [ ] Improve error messages
- [ ] Add request validation documentation
- [ ] Ensure response format consistency
- [ ] Verify performance targets met

---

## SUCCESS METRICS

**Test Coverage**: 12/12 integration tests passing
**Performance**: <200ms for catalog listing
**Security**: All endpoints require authentication
**Architecture**: Hexagonal flow maintained (Controller → Application Service → Domain)
**Code Quality**: PSR-12 compliant, no static analysis errors

---

**Status**: Specification complete, ready for RED phase (test implementation)
**Next**: Create `ModuleCatalogApiTest.php` with 12 failing tests
