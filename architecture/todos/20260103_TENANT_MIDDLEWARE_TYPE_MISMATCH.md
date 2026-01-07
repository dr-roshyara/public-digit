# 🚨 ARCHITECTURE ISSUE: Tenant Middleware Type Mismatch

**Status**: 🔴 **BLOCKING** - Affects integration testing for new contexts
**Priority**: **HIGH**
**Category**: Architecture / DDD / Shared Kernel
**Discovered**: 2026-01-03
**Discoverer**: Claude (during Membership Context DAY 2 implementation)
**Affected Components**: All bounded contexts using tenant middleware

---

## 📋 **EXECUTIVE SUMMARY**

The platform's `TenantContextService` expects `TenantInterface` but receives concrete `TenantAuth\Domain\Entities\Tenant` entity, causing a **type mismatch error** in middleware. This violates **DDD Shared Kernel principles** and prevents integration testing of new bounded contexts.

**Impact**: Cannot run HTTP integration tests for new contexts (e.g., Membership) without mocking middleware.

---

## 🔍 **DETAILED PROBLEM DESCRIPTION**

### **Error Message**
```
TypeError: App\Services\TenantContextService::setTenant():
Argument #1 ($tenant) must be of type App\Contracts\TenantInterface,
App\Contexts\TenantAuth\Domain\Entities\Tenant given,
called in app/Contexts/Platform/Infrastructure/Http/Middleware/IdentifyTenantFromRequest.php on line 148
```

### **Stack Trace Analysis**
```
IdentifyTenantFromRequest (middleware)
  ↓ line 148: calls setTenant()
  ↓
TenantContextService::setTenant(TenantInterface $tenant)
  ↓
ERROR: receives TenantAuth\Domain\Entities\Tenant (NOT TenantInterface)
```

---

## 🏗️ **ROOT CAUSE ANALYSIS**

### **Current Architecture (BROKEN)**

```
┌─────────────────────────────────────────────────────────────┐
│ Platform Layer (Shared Kernel)                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  TenantContextService                                        │
│  ├─ setTenant(TenantInterface $tenant) ← EXPECTS INTERFACE  │
│  └─ Uses: App\Contracts\TenantInterface                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ TYPE MISMATCH HERE
                            │
┌─────────────────────────────────────────────────────────────┐
│ TenantAuth Context (Bounded Context)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  TenantAuth\Domain\Entities\Tenant                          │
│  ├─ Does NOT implement TenantInterface ← PROBLEM            │
│  └─ Just a plain Eloquent model                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### **Why This Happens**

1. **Platform Layer** defines `TenantInterface` contract
2. **TenantContextService** (platform service) type-hints this interface
3. **TenantAuth Context** has a `Tenant` entity but **doesn't implement interface**
4. **Middleware** retrieves `Tenant` entity and tries to pass it to service
5. **PHP type system** rejects the call (strict typing)

---

## 📊 **ARCHITECTURAL VIOLATION ANALYSIS**

### **DDD Shared Kernel Principle**

**CORRECT Pattern:**
```
Shared Kernel (Platform)
├── TenantInterface (Contract)
└── Platform services use TenantInterface

Bounded Context (TenantAuth)
├── Tenant (Entity) implements TenantInterface
└── Returns Tenant to platform layer
```

**CURRENT Pattern (WRONG):**
```
Shared Kernel (Platform)
├── TenantInterface (Contract)
└── Platform services use TenantInterface

Bounded Context (TenantAuth)
├── Tenant (Entity) → NO IMPLEMENTATION ❌
└── Returns Tenant to platform layer → TYPE ERROR
```

### **Violated Principles**

1. ❌ **Dependency Inversion Principle (DIP)**
   Platform depends on concrete implementation, not abstraction

2. ❌ **Shared Kernel Pattern**
   Interface exists but isn't implemented by bounded context

3. ❌ **Contract-Based Integration**
   Contexts should integrate via contracts, not concrete classes

---

## 🎯 **IMPACT ASSESSMENT**

### **Current Impact**
- ✅ **Production**: Works (likely due to runtime duck typing or older PHP version)
- ❌ **Testing**: HTTP integration tests fail with type error
- ❌ **New Contexts**: Cannot write integration tests for new bounded contexts
- ⚠️ **Type Safety**: No compile-time guarantees

### **Future Risk**
- **High**: When PHP strict typing enforcement increases
- **High**: When adding new contexts (like Membership, Geography, etc.)
- **Medium**: Maintenance burden (mocking required in all tests)
- **Low**: Production runtime (currently works despite type mismatch)

---

## 🔧 **PROPOSED SOLUTIONS**

### **Solution 1: Implement TenantInterface in TenantAuth Context** ⭐ **RECOMMENDED**

**Changes Required:**
```php
// File: app/Contexts/TenantAuth/Domain/Entities/Tenant.php

namespace App\Contexts\TenantAuth\Domain\Entities;

use App\Contracts\TenantInterface; // Import platform interface

class Tenant extends AggregateRoot implements TenantInterface // Add implementation
{
    // Implement required interface methods
    public function getTenantId(): string
    {
        return $this->id;
    }

    public function getTenantSlug(): string
    {
        return $this->slug;
    }

    public function getTenantName(): string
    {
        return $this->name;
    }

    // ... rest of existing code
}
```

**Pros:**
- ✅ Follows DDD principles
- ✅ Fixes root cause
- ✅ Enables type safety
- ✅ No mocking needed in tests

**Cons:**
- ⚠️ Requires modifying existing context
- ⚠️ Needs regression testing
- ⚠️ May affect other code depending on Tenant entity

**Effort**: 2-4 hours (implementation + testing)
**Risk**: Medium (touches core infrastructure)

---

### **Solution 2: Update TenantContextService to Accept Concrete Type**

**Changes Required:**
```php
// File: app/Services/TenantContextService.php

use App\Contexts\TenantAuth\Domain\Entities\Tenant;

class TenantContextService
{
    // Change from TenantInterface to concrete Tenant
    public function setTenant(Tenant $tenant): void
    {
        // ... existing code
    }
}
```

**Pros:**
- ✅ Quick fix
- ✅ Low risk

**Cons:**
- ❌ Violates DIP (Dependency Inversion)
- ❌ Platform depends on bounded context
- ❌ Wrong direction of dependency
- ❌ Makes platform rigid

**Effort**: 30 minutes
**Risk**: Low (immediate), High (architectural debt)

**Verdict**: ❌ **NOT RECOMMENDED** - Wrong architectural direction

---

### **Solution 3: Create Adapter in Middleware** ⚠️

**Changes Required:**
```php
// File: app/Contexts/Platform/Infrastructure/Http/Middleware/IdentifyTenantFromRequest.php

private function initializeTenantContext($tenant, Request $request): void
{
    // Create adapter that implements TenantInterface
    $tenantAdapter = new TenantAdapter($tenant);

    $this->tenantContext->setTenant($tenantAdapter);
}
```

**Pros:**
- ✅ Doesn't touch existing contexts
- ✅ Anti-corruption layer pattern

**Cons:**
- ⚠️ Adds complexity
- ⚠️ Doesn't fix root cause
- ⚠️ Every middleware needs adapter

**Effort**: 1-2 hours
**Risk**: Low

**Verdict**: ⚠️ **ACCEPTABLE** as temporary measure

---

## 📅 **IMPLEMENTATION ROADMAP**

### **Short-term (Immediate)**
1. **Workaround for Membership Context Tests** (Today)
   - Mock `TenantContextService` in HTTP tests
   - Focus on unit tests for business logic
   - Document technical debt (this file)

### **Medium-term (Next Sprint)**
2. **Implement Solution 1** (2-4 hours)
   - Make `TenantAuth\Tenant` implement `TenantInterface`
   - Run regression tests
   - Update integration tests
   - Remove mocks from new contexts

### **Long-term (Architecture Review)**
3. **Audit All Context Integrations**
   - Verify all contexts use Shared Kernel interfaces
   - Document platform contracts
   - Create architecture compliance tests

---

## 🧪 **TESTING STRATEGY**

### **Verification Steps After Fix**
```bash
# 1. Run all TenantAuth context tests
php artisan test tests/Feature/Contexts/TenantAuth/

# 2. Run platform middleware tests
php artisan test tests/Feature/Middleware/IdentifyTenantFromRequestTest.php

# 3. Run Membership context integration tests (should pass)
php artisan test tests/Feature/Contexts/Membership/Mobile/

# 4. Run full test suite
php artisan test
```

### **Regression Risk Areas**
- TenantAuth context functionality
- Middleware tenant resolution
- Multi-tenancy features
- RBAC (if dependent on tenant context)

---

## 📚 **RELATED FILES**

### **Files to Modify (Solution 1)**
```
app/Contexts/TenantAuth/Domain/Entities/Tenant.php
└─ Add: implements TenantInterface
└─ Add: Interface method implementations

app/Contracts/TenantInterface.php
└─ Review: Ensure interface methods match Tenant entity capabilities
```

### **Files to Check During Fix**
```
app/Services/TenantContextService.php
└─ Verify: setTenant() type hint

app/Contexts/Platform/Infrastructure/Http/Middleware/IdentifyTenantFromRequest.php
└─ Verify: Tenant retrieval and passing

tests/**/*Tenant*.php
└─ Verify: No broken tests after change
```

---

## 🔗 **REFERENCES**

### **DDD Patterns**
- **Shared Kernel**: https://martinfowler.com/bliki/BoundedContext.html
- **Anti-Corruption Layer**: Domain-Driven Design (Eric Evans), Chapter 14

### **Related Architecture Decisions**
- `20251230_MODULE_REGISTRY_ARCHITECTURE.md` - Shows proper Shared Kernel usage
- `20251231_FINAL_ARCHITECTURE_VERIFICATION.md` - DDD context boundaries

### **Current Workaround**
```php
// In tests: tests/Feature/Contexts/Membership/Mobile/MemberRegistrationApiTest.php
protected function setUp(): void
{
    parent::setUp();

    // Workaround: Mock TenantContextService to bypass type check
    $tenantContextMock = Mockery::mock(TenantContextService::class);
    $tenantContextMock->shouldReceive('setTenant')->andReturnNull();
    $this->app->instance(TenantContextService::class, $tenantContextMock);
}
```

---

## ✅ **ACCEPTANCE CRITERIA FOR FIX**

Fix is complete when:

1. ✅ `TenantAuth\Domain\Entities\Tenant` implements `TenantInterface`
2. ✅ All TenantAuth context tests pass
3. ✅ Membership context HTTP tests pass WITHOUT mocking
4. ✅ No type errors in middleware
5. ✅ Full test suite passes (regression check)
6. ✅ Documentation updated

---

## 👥 **STAKEHOLDERS**

- **Backend Team**: Must implement fix
- **QA Team**: Must perform regression testing
- **Context Developers**: Benefits all new bounded contexts
- **DevOps**: No deployment changes needed

---

## 🏷️ **TAGS**

`#architecture` `#ddd` `#shared-kernel` `#technical-debt` `#type-safety` `#tenant-middleware` `#multi-tenancy` `#integration-testing`

---

**Created**: 2026-01-03
**Last Updated**: 2026-01-03
**Assigned To**: Backend Team (Architecture)
**Estimated Effort**: 2-4 hours
**Priority**: HIGH (blocks new context testing)

---

## 📝 **NOTES**

- This issue was discovered during Membership Context DAY 2 implementation
- Current workaround: Mock `TenantContextService` in integration tests
- Production is NOT affected (runtime works despite type mismatch)
- Fix should be prioritized before adding more bounded contexts
- Consider creating architecture compliance tests to prevent similar issues
