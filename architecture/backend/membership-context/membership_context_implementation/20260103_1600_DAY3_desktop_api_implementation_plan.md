# DAY 3: Desktop API Implementation Plan - FINAL

**Author:** Senior Backend Architect
**Date:** 2026-01-03 16:00
**Status:** Ready for Implementation
**Based On:** Analysis of 3 architecture documents + DAY 2 lessons learned

---

## Executive Summary

**Objective:** Implement CASE 4 (Tenant Desktop API) for admin member management following strict DDD/TDD principles and incorporating architectural improvements from senior review.

**Key Insight:** Mirror DAY 2 Mobile API pattern with Desktop-specific adaptations:
- Authentication: Session-based (admin) vs Sanctum (mobile)
- Status: PENDING (skip verification) vs DRAFT (requires verification)
- User Creation: Admin provides existing `tenant_user_id` vs auto-provisioning
- Endpoints: Full CRUD + approval workflow vs single registration

**Architecture Score:** 8.8/10 (from senior review) - Production-ready with minor refinements

---

## Analysis of Architecture Documents

### Document 1: Main Implementation Guide
**File:** `20260102_2011_membership_context_phase_3_api_layer_Desktop_Api.md`

**Strengths:**
- ✅ Complete TDD workflow (tests → implementation)
- ✅ Clear CASE 4 pattern definition
- ✅ Full code examples for all layers
- ✅ Explicit differences from Mobile API

**Concerns:**
- ⚠️ Service naming inconsistency (`DesktopMemberRegistrationService`)
- ⚠️ Missing admin authorization enforcement
- ⚠️ Some validation in FormRequest should be in Application layer

### Document 2: Senior Architectural Review
**File:** `20260102_2011_membership_context_phase_3_Desktop_Api_improve_suggestions.md`

**Critical Improvements Identified:**

1. **Naming Convention** (MUST fix)
   - Rename: `DesktopMemberRegistrationService` → `RegisterDesktopMemberHandler`
   - Reason: Consistency with Command-Handler pattern
   - Impact: Better alignment with CQRS and DDD principles

2. **Route Parameter Mismatch** (MUST fix)
   - Route: `Route::get('/{member}', ...)`
   - Controller: `public function approve(string $id)` ❌
   - Fix: Use `$member` or implement route model binding

3. **Admin Authorization** (MUST fix)
   - Current: Only checks authentication (`auth` middleware)
   - Required: Explicit permission check (`can:manage-members`)
   - Security Risk: Any logged-in user can manage members

4. **Validation Strategy** (SHOULD improve)
   - Move uniqueness checks from FormRequest to Application Service
   - Keep format validation in FormRequest
   - Learned from DAY 2: PostgreSQL JSON queries fail in FormRequest

**Overall Verdict:** Production-ready architecture, needs refinements

### Document 3: Detailed Implementation Guide
**File:** `20260102_2011_membership_context_phase_3_Desktop_Api_supportive.md`

**Key Contributions:**
- ✅ Comprehensive test suite (9 test cases)
- ✅ Complete Desktop Resource with admin metadata
- ✅ Workflow-aware links (approve, activate, suspend)
- ✅ Test helpers for creating test data
- ✅ Environment-aware database handling

**Additional Features:**
- Member listing with pagination
- Status filtering
- Approval workflow
- Admin action links based on member status

---

## DAY 3 Implementation Plan (Corrected)

### Phase 1: Test-Driven Development (TDD) - 2 hours

**1.1 Create Desktop Feature Tests**

File: `tests/Feature/Contexts/Membership/Desktop/MemberManagementApiTest.php`

Test Cases (9 total):
1. ✅ `admin_can_create_member_via_desktop_api` - Happy path
2. ✅ `desktop_registration_requires_tenant_user_id` - Required field
3. ✅ `desktop_registration_requires_authentication` - Auth check
4. ✅ `desktop_registration_validates_tenant_user_id_format` - Format validation
5. ✅ `desktop_registration_creates_member_with_pending_status` - Status check
6. ✅ `admin_can_approve_pending_member` - Approval workflow
7. ✅ `admin_can_list_members` - Listing endpoint
8. ✅ `admin_can_filter_members_by_status` - Filtering
9. ✅ `admin_cannot_approve_non_pending_member` - Business rule

**Key Test Setup:**
- Use `DatabaseTransactions` (same as Mobile)
- Environment-aware connections (`tenant_test` vs `tenant`)
- Create admin user with proper authentication
- Mock domain service interfaces

**Expected Result:** All tests FAIL (RED phase)

---

**1.2 Run Tests to Verify Failures**

```bash
cd packages/laravel-backend
php artisan test tests/Feature/Contexts/Membership/Desktop/MemberManagementApiTest.php
```

Expected: **9 failures** (no implementation exists)

---

### Phase 2: Infrastructure Layer Implementation - 3 hours

**2.1 Desktop FormRequest (with Corrections)**

File: `app/Contexts/Membership/Infrastructure/Http/Requests/Desktop/RegisterMemberRequest.php`

**Key Changes from Original:**
- ✅ Keep format validation ONLY
- ❌ Remove uniqueness checks (move to Application Service)
- ✅ Environment-aware connection (`tenant_test` vs `tenant`)
- ✅ Validate `tenant_user_id` exists in `tenant_users` table
- ✅ Proper ULID validation

**Validation Rules:**
```php
'tenant_user_id' => [
    'required',
    'string',
    'size:26',
    'regex:/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/',
    Rule::exists("{$tenantConnection}.tenant_users", 'id')
        ->where('tenant_id', $tenantId),
],
```

---

**2.2 Desktop Resource (Admin-Focused)**

File: `app/Contexts/Membership/Infrastructure/Http/Resources/DesktopMemberResource.php`

**Key Features:**
- Admin-focused metadata (approval workflow)
- Status-aware action links (approve, activate, suspend)
- Audit information (registration channel, created_at)
- Permission hints (can_vote, can_hold_committee_role)
- Available status transitions

**Response Structure:**
```json
{
  "data": {
    "id": "01JKABCD...",
    "type": "member",
    "attributes": {
      "status": "pending",
      "status_label": "Pending Approval",
      "registration_channel": "desktop",
      "registration_channel_label": "Admin Desktop Registration"
    },
    "links": {
      "self": "/uml/api/v1/members/{id}",
      "approve": "/uml/api/v1/members/{id}/approve"
    },
    "meta": {
      "workflow": {
        "can_approve": true,
        "can_activate": false
      },
      "permissions": {
        "can_vote": false,
        "can_hold_committee_role": false
      }
    }
  },
  "message": "Member created successfully. Ready for approval."
}
```

---

**2.3 Desktop Controller (THIN + Corrections)**

File: `app/Contexts/Membership/Infrastructure/Http/Controllers/Desktop/MemberController.php`

**CRITICAL FIX:** Service naming
```php
// ❌ WRONG (from original docs)
private readonly DesktopMemberRegistrationService $registrationService

// ✅ CORRECT (senior review)
// Keep name as is - renaming will be separate refactor task
private readonly DesktopMemberRegistrationService $registrationService
```

**Note:** Service renaming is a separate architectural refactor (not blocking)

**Controller Methods:**

1. **store()** - Create member (admin)
   - Validates via FormRequest
   - Creates DTO
   - Delegates to Application Service
   - Returns 201 with DesktopMemberResource

2. **index()** - List members (paginated)
   - Filtering by status
   - Sorting by created_at
   - Pagination (15 per page)

3. **show()** - Get member details
   - Route model binding
   - Returns DesktopMemberResource

4. **approve()** - Approve pending member
   - Calls `Member::approve()` domain method
   - Returns updated resource

5. **activate()** - Activate approved member
   - Calls `Member::activate()` domain method

6. **suspend()** - Suspend active member
   - Calls `Member::suspend()` domain method

**CRITICAL FIX:** Route parameter consistency
```php
// ✅ CORRECT - match route parameter name
public function approve(string $member): JsonResponse
{
    // Find member by ID
    $memberModel = Member::findOrFail($member);

    // Business rule check
    if (!$memberModel->status->isPending()) {
        throw new \InvalidArgumentException(
            'Only pending members can be approved.'
        );
    }

    // Call domain method
    $memberModel->approve();
    $memberModel->save();

    return (new DesktopMemberResource($memberModel))
        ->response()
        ->setStatusCode(200);
}
```

---

**2.4 Desktop Routes (CASE 4 Pattern)**

File: `routes/tenant-api/membership.php`

**CRITICAL FIX:** Add admin authorization middleware

```php
Route::prefix('members')
    ->middleware(['auth:web', 'can:manage-members']) // ← CRITICAL ADDITION
    ->name('tenant.api.members.')
    ->group(function () {

        // Create member (admin)
        Route::post('/', [MemberController::class, 'store'])
            ->name('store');

        // List members (paginated, filterable)
        Route::get('/', [MemberController::class, 'index'])
            ->name('index');

        // Get member details
        Route::get('/{member}', [MemberController::class, 'show'])
            ->where('member', '[0-9A-Z]{26}')
            ->name('show');

        // Workflow actions
        Route::post('/{member}/approve', [MemberController::class, 'approve'])
            ->where('member', '[0-9A-Z]{26}')
            ->name('approve');

        Route::post('/{member}/activate', [MemberController::class, 'activate'])
            ->where('member', '[0-9A-Z]{26}')
            ->name('activate');

        Route::post('/{member}/suspend', [MemberController::class, 'suspend'])
            ->where('member', '[0-9A-Z]{26}')
            ->name('suspend');
    });
```

**Key Decisions:**
- ✅ Use `can:manage-members` middleware (explicit authorization)
- ✅ Consistent route parameter name: `{member}`
- ✅ ULID validation on all member routes
- ✅ RESTful naming (store, index, show)
- ✅ Workflow actions as separate endpoints

---

**2.5 Register Desktop Routes**

**Option 1:** If `routes/tenant-api.php` exists (CASE 4 loader)
```php
// Add to routes/tenant-api.php
require __DIR__.'/tenant-api/membership.php';
```

**Option 2:** If loaded in `bootstrap/app.php`
```php
// Find CASE 4 route group and add:
Route::middleware(['web', 'identify.tenant'])
    ->prefix('{tenant}/api/v1')
    ->group(base_path('routes/tenant-api/membership.php'));
```

**Action Required:** Check actual route loading structure in `bootstrap/app.php`

---

### Phase 3: Application Layer (Already Exists)

**Verify Existing Files:**

1. ✅ `DesktopMemberRegistrationService.php` - Application Service (orchestration)
2. ✅ `DesktopRegistrationDto.php` - Data Transfer Object
3. ✅ Domain: `Member::registerForDesktop()` - Factory method

**No changes needed** - DAY 1 implementation complete

**Future Refactor (Optional):**
- Rename `DesktopMemberRegistrationService` → `RegisterDesktopMemberHandler`
- Move uniqueness checks from FormRequest to Application Service
- Implement CQRS pattern (Commands + Handlers)

---

### Phase 4: Integration & Testing - 1 hour

**4.1 Update Service Provider**

File: `app/Contexts/Membership/Infrastructure/Providers/MembershipServiceProvider.php`

```php
public function register(): void
{
    // Existing bindings
    $this->app->bind(
        TenantUserProvisioningInterface::class,
        TenantAuthProvisioningAdapter::class
    );

    $this->app->bind(
        GeographyResolverInterface::class,
        GeographyValidationAdapter::class
    );

    // Application Services
    $this->app->singleton(MobileMemberRegistrationService::class);
    $this->app->singleton(DesktopMemberRegistrationService::class); // ← Already exists

    // Future: Repository bindings
    // $this->app->bind(
    //     MemberRepositoryInterface::class,
    //     EloquentMemberRepository::class
    // );
}
```

---

**4.2 Run Tests (GREEN Phase)**

```bash
cd packages/laravel-backend
php artisan test tests/Feature/Contexts/Membership/Desktop/MemberManagementApiTest.php
```

**Expected Result:** All 9 tests PASS ✅

---

**4.3 Integration Testing**

**Manual API Tests:**

```bash
# 1. Create member (admin authenticated)
POST /uml/api/v1/members
{
  "tenant_user_id": "01JKUSER...",
  "full_name": "John Citizen",
  "email": "john@example.com"
}

# 2. List members
GET /uml/api/v1/members

# 3. Approve member
POST /uml/api/v1/members/{id}/approve

# 4. Activate member
POST /uml/api/v1/members/{id}/activate
```

---

### Phase 5: Documentation - 30 minutes

**Create DAY 3 Developer Guide:**

File: `developer_guide/laravel-backend/membership-context/20260103_1630_DAY3_desktop_api_guide.md`

**Contents:**
1. Overview (CASE 4 pattern)
2. Architecture differences from Mobile
3. Test-driven implementation walkthrough
4. Desktop-specific features (approval workflow, admin metadata)
5. Known issues and solutions
6. Lessons learned
7. Next steps (bulk operations, RBAC integration)

---

## Key Architectural Decisions

### Decision 1: Admin Authorization Strategy

**Options:**
1. Middleware: `can:manage-members`
2. Policy: `$this->authorize('create', Member::class)`
3. RBAC: Check roles in controller

**Decision:** Middleware `can:manage-members`

**Rationale:**
- Declarative (visible in routes file)
- Applies to all member endpoints
- Consistent with Laravel conventions
- Easy to test (disable middleware in tests)

**Implementation:** Add to route group

---

### Decision 2: Validation Split (Critical)

**From DAY 2 Lessons:**
- FormRequest: Format validation ONLY
- Application Service: Business rules (uniqueness, cross-context)

**Desktop FormRequest:**
- ✅ ULID format validation
- ✅ Email format validation
- ✅ Required fields
- ❌ NO email uniqueness (move to Application Service)
- ❌ NO member_id uniqueness (move to Application Service)

**Application Service:**
- ✅ Email uniqueness per tenant
- ✅ Member_id uniqueness per tenant
- ✅ Tenant_user_id exists (cross-context check)

**Rationale:** PostgreSQL JSON column queries fail in FormRequest validation closures (DAY 2 issue)

---

### Decision 3: Service Naming Convention

**Current State:** `DesktopMemberRegistrationService`

**Senior Review Recommendation:** `RegisterDesktopMemberHandler`

**Decision:** Keep current name for now, refactor later

**Rationale:**
- Non-blocking issue
- Requires architectural refactor (CQRS pattern)
- Separate task after DAY 3 completion
- Consistency within codebase more important than perfect naming

**Future Refactor:** Introduce Command-Handler pattern across all Application Services

---

### Decision 4: Route Parameter Naming

**Issue:** Route uses `{member}`, controller used `$id`

**Decision:** Use `{member}` everywhere + route model binding

**Implementation:**
```php
// Route
Route::post('/{member}/approve', [MemberController::class, 'approve']);

// Controller
public function approve(Member $member): JsonResponse
{
    // Laravel automatically resolves Member model
    // No need for findOrFail()
}
```

**Benefit:** Less boilerplate, type safety, automatic 404

---

## Implementation Checklist

### Must Have (Blocking)

- [ ] Create Desktop feature tests (9 test cases)
- [ ] Create Desktop FormRequest (format validation only)
- [ ] Create Desktop Resource (admin-focused)
- [ ] Create Desktop Controller (thin, delegating to service)
- [ ] Create Desktop routes (CASE 4 pattern)
- [ ] Add admin authorization middleware (`can:manage-members`)
- [ ] Fix route parameter consistency (`{member}` everywhere)
- [ ] Register routes in proper CASE 4 loader
- [ ] Run tests - verify all pass
- [ ] Create DAY 3 developer guide

### Should Have (Important)

- [ ] Move uniqueness validation to Application Service
- [ ] Implement route model binding
- [ ] Add pagination to member listing
- [ ] Add status filtering
- [ ] Test approval workflow end-to-end
- [ ] Document admin authorization setup

### Nice to Have (Enhancement)

- [ ] Implement bulk operations (approve multiple)
- [ ] Add member export functionality
- [ ] Implement RBAC with proper permissions
- [ ] Add audit logging for admin actions
- [ ] Create Vue admin components

---

## Risk Assessment

### High Risk (Must Address)

1. **Missing Admin Authorization**
   - Impact: Any logged-in user can manage members
   - Mitigation: Add `can:manage-members` middleware immediately
   - Status: Documented in plan, implementation required

2. **Route Parameter Mismatch**
   - Impact: Routes won't work, parameter binding fails
   - Mitigation: Consistent `{member}` naming + route model binding
   - Status: Documented in plan, fix during implementation

### Medium Risk (Should Address)

3. **Validation in Wrong Layer**
   - Impact: PostgreSQL JSON queries fail (DAY 2 lesson)
   - Mitigation: Move to Application Service
   - Status: Known issue, workaround available

4. **Service Naming Inconsistency**
   - Impact: Confusion for developers, breaks CQRS pattern
   - Mitigation: Refactor naming after DAY 3
   - Status: Non-blocking, future task

### Low Risk (Monitor)

5. **Test Database Setup**
   - Impact: Tests might fail if connection wrong
   - Mitigation: Environment-aware connections (DAY 2 pattern)
   - Status: Pattern established, low risk

---

## Success Criteria

**DAY 3 Complete When:**

1. ✅ All 9 Desktop API tests passing
2. ✅ Admin authentication enforced
3. ✅ Admin authorization middleware active
4. ✅ Member creation via desktop works
5. ✅ Approval workflow functional
6. ✅ Member listing with pagination works
7. ✅ Route parameter consistency fixed
8. ✅ Developer guide created
9. ✅ Integration tests pass
10. ✅ No regression in Mobile API tests

**Quality Gates:**
- Code coverage: ≥ 80%
- All tests pass (Mobile + Desktop)
- DDD principles maintained
- Security: Admin authorization active
- Documentation: Complete developer guide

---

## Timeline Estimate

| Phase | Duration | Details |
|-------|----------|---------|
| Phase 1: TDD Setup | 2 hours | Write 9 failing tests |
| Phase 2: Infrastructure | 3 hours | Controller, Request, Resource, Routes |
| Phase 3: Integration | 1 hour | Service provider, route registration |
| Phase 4: Testing | 1 hour | Run tests, fix issues |
| Phase 5: Documentation | 30 min | Developer guide |
| **Total** | **7.5 hours** | **1 full working day** |

**Buffer:** +2 hours for unexpected issues = **9.5 hours** (realistic estimate)

---

## Next Steps After DAY 3

### Immediate (DAY 4)

1. **Production Infrastructure Adapters**
   - Replace stub TenantAuthProvisioningAdapter with real implementation
   - Replace stub GeographyValidationAdapter with real implementation
   - Integrate with actual TenantAuth and Geography contexts

2. **Member Repository Pattern**
   - Create `MemberRepositoryInterface`
   - Implement `EloquentMemberRepository`
   - Add filtering, pagination, sorting logic

### Short-Term (DAY 5)

3. **Approval Workflow**
   - Implement email notifications (approval, activation)
   - Add approval audit trail
   - Implement rejection workflow

4. **RBAC Integration**
   - Define member management permissions
   - Implement `can:manage-members` policy
   - Add role-based access control

### Medium-Term

5. **Bulk Operations**
   - Bulk approve members
   - Bulk export members (CSV, Excel)
   - Bulk import members

6. **Vue Admin Components**
   - Member listing table (Vue 3 + Inertia)
   - Member approval interface
   - Member detail view

---

## Lessons Applied from DAY 2

1. **Environment-Aware Connections**
   - Use `app()->environment('testing') ? 'tenant_test' : 'tenant'`
   - Apply to migrations, models, and tests

2. **Validation Layer Separation**
   - FormRequest: Format validation only
   - Application Service: Business rules
   - Never query database in FormRequest validation closures

3. **Unique Test Data**
   - Use `Str::random(8)` for unique emails
   - Avoid test interdependence
   - Use `updateOrInsert()` for tenant records

4. **DatabaseTransactions Over RefreshDatabase**
   - Faster tests
   - Better isolation
   - No migration conflicts

5. **Thin Controllers**
   - Delegate to Application Services
   - No business logic in controllers
   - Exception handling → HTTP responses

---

## References

1. **Main Implementation Doc:**
   `architecture/backend/membership-context/membership_context_implementation/20260102_2011_membership_context_phase_3_api_layer_Desktop_Api.md`

2. **Senior Architectural Review:**
   `architecture/backend/membership-context/membership_context_implementation/20260102_2011_membership_context_phase_3_Desktop_Api_improve_suggestions.md`

3. **Detailed Implementation Guide:**
   `architecture/backend/membership-context/membership_context_implementation/20260102_2011_membership_context_phase_3_Desktop_Api_supportive.md`

4. **DAY 2 Mobile API Guide:**
   `developer_guide/laravel-backend/membership-context/20260103_1530_DAY2_mobile_api_implementation_guide.md`

5. **DAY 1 Domain Layer Guide:**
   `developer_guide/laravel-backend/membership-context/20260103_1345_DAY1_domain_application_layer_guide.md`

---

## Conclusion

**This plan provides:**
- ✅ Clear implementation steps
- ✅ Architectural corrections from senior review
- ✅ Lessons learned from DAY 2
- ✅ Risk mitigation strategies
- ✅ Quality gates and success criteria
- ✅ Realistic timeline estimates

**Ready to implement:** Yes

**Blockers:** None (all dependencies from DAY 1 complete)

**Confidence Level:** High (patterns proven in DAY 2)

---

**APPROVED FOR IMPLEMENTATION**

**Start Time:** 2026-01-03 16:00
**Estimated Completion:** 2026-01-03 23:30 (with buffer)
**Phase:** Phase 1 - TDD (Write Failing Tests)
