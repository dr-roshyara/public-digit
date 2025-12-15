# **Claude CLI Instructions: Complete TenantContext Service Implementation**

## **BACKGROUND & ARCHITECTURAL CONTEXT**

### **Project Overview**
You're working on a Laravel-based multi-tenant platform with Domain-Driven Design (DDD) architecture. The system uses **Spatie/laravel-multitenancy** but needs to be package-agnostic to allow future migration to other tenancy packages (Stancl, custom implementations, etc.).

### **Current State**
You've successfully implemented a **package-agnostic TenantContext service** following TDD principles. The implementation includes:

1. ✅ **TenantContextInterface** - Package-agnostic contract in `App\Contracts\TenantContextInterface`
2. ✅ **TenantContextException** - Domain-specific exceptions in `App\Exceptions\TenantContextException`
3. ✅ **TenantContextService** - Implementation in `App\Services\TenantContextService`
4. ✅ **Configuration** - `config/tenant-context.php` with detection methods, safety guards, caching
5. ✅ **Service Provider** - `App\Providers\TenantContextServiceProvider` with DI setup
6. ✅ **Feature Tests** - `tests/Feature/TenantContextServiceTest.php` (TDD-first approach)

### **Key Architectural Decisions**
- **Package Agnosticism**: Works with any tenancy package (Spatie, Stancl, or custom)
- **Safety Guard Integration**: Integrates with existing `TenantProvisioningGuard` and `SafeTenantDatabaseSelector`
- **Backward Compatibility**: Maintains compatibility with existing `TenantContext` usage
- **TDD-First**: Tests written before implementation
- **Configuration-Driven**: Detection methods, safety guards, caching configurable via config

### **Current Challenge**
The implementation is **minimal but functional**. Safety guard integration exists but needs refinement. Some tests are marked incomplete because they require actual safety guard integration.

---

## **COMPLETE INSTRUCTIONS FOR CLAUDE CLI**

### **Step 1: Verify Current Implementation**
```bash
# Navigate to project
cd packages/laravel-backend

# Run existing tests
php artisan test tests/Feature/TenantContextServiceTest.php

# Check what passes/fails
# You should see:
# - Basic interface tests pass
# - Safety guard integration tests marked incomplete
# - Database-dependent tests may fail
```

### **Step 2: Update Safety Guard Integration**
The safety guard integration is currently minimal. Need to:

#### **2.1. Check Existing Safety Guards**
```bash
# Examine existing safety guards
cat app/Contexts/Platform/Application/Services/TenantProvisioningGuard.php
cat app/Contexts/TenantAuth/Infrastructure/Database/SafeTenantDatabaseSelector.php

# Understand their interfaces:
# - What methods do they expose?
# - How should TenantContextService interact with them?
```

#### **2.2. Update TenantContextService Integration**
Based on safety guard interfaces, update:
1. **`validateTenantWithSafetyGuards()`** - Call actual guard methods
2. **`integrateWithSafeTenantDatabaseSelector()`** - Proper database switching
3. Add proper error handling and logging

### **Step 3: Add Package Detection Logic**
Currently only detects Spatie. Need to:

#### **3.1. Implement Package Detection Strategy**
```php
// In TenantContextService, enhance getCurrentTenant():
private function detectTenantUsingMethod(string $method): ?TenantInterface
{
    switch($method) {
        case 'spatie': return $this->detectSpatieTenant();
        case 'stancl': return $this->detectStanclTenant();
        case 'request': return $this->detectFromRequest();
        case 'session': return $this->detectFromSession();
        case 'header': return $this->detectFromHeader();
    }
}
```

#### **3.2. Create Adapter Pattern for Different Packages**
Since Spatie tenant may not implement `TenantInterface`, create adapters:
```php
// App\Adapters\SpatieTenantAdapter.php
class SpatieTenantAdapter implements TenantInterface {
    public function __construct(private $spatieTenant) {}
    public function getId(): string { return (string)$this->spatieTenant->id; }
    // ... other interface methods
}
```

### **Step 4: Complete Test Suite**
Update `TenantContextServiceTest.php`:

#### **4.1. Fix Database Mocking Tests**
```php
// Instead of mocking Tenant::find(), create actual test tenant
// Or use Laravel's model factory/mocking tools
```

#### **4.2. Add Safety Guard Integration Tests**
```php
/** @test */
public function it_validates_tenant_with_provisioning_guard()
{
    // Mock TenantProvisioningGuard
    // Set up tenant
    // Call getCurrentTenant()
    // Assert guard was called
}
```

#### **4.3. Add Package Detection Tests**
```php
/** @test */
public function it_detects_spatie_tenant_when_available()
{
    // Mock Spatie\Multitenancy\Models\Tenant::current()
    // Call getCurrentTenant()
    // Assert Spatie detection was used
}
```

### **Step 5: Update Existing Code to Use New Service**
#### **5.1. Check Existing TenantContext Usage**
```bash
# Find all usages of existing TenantContext
grep -r "TenantContext" app/ --include="*.php"
grep -r "tenant.context" app/ --include="*.php"
```

#### **5.2. Create Compatibility Layer**
Since you have backward compatibility methods in `TenantContextService`, existing code should work. But verify:

```php
// In controllers/services that use TenantContext:
// Old: app('tenant.context')->getTenant()
// New: app(TenantContextInterface::class)->getCurrentTenant()
// Both work due to backward compatibility
```

### **Step 6: Create Integration Tests**
```bash
# Create tests/Feature/TenantContextIntegrationTest.php
# Test actual scenarios:
# 1. Web request with tenant in session
# 2. API request with X-Tenant header
# 3. CLI command with tenant context
# 4. Queue job with tenant context
```

### **Step 7: Documentation & Developer Guide**
#### **7.1. Create Usage Documentation**
```php
// Example: docs/tenant-context-usage.md
// Show how to use in different contexts:

// 1. In controllers:
public function index(TenantContextInterface $context) {
    $tenant = $context->getCurrentTenant();
}

// 2. In services:
app(TenantContextInterface::class)->executeInTenantContext($tenant, function() {
    // Safe tenant operations
});

// 3. In tests:
$context->setCurrentTenant($mockTenant);
```

#### **7.2. Update Architecture Documentation**
Add to architectural docs:
- Package-agnostic design decisions
- Safety guard integration patterns
- Configuration options
- Migration path from old TenantContext

### **Step 8: Performance Optimization**
#### **8.1. Implement Caching**
Currently config has cache settings but not implemented:
```php
// In getTenantById():
if ($this->cacheEnabled) {
    $cached = Cache::get("tenant:{$id}");
    if ($cached) return $cached;
}
// ... find tenant
if ($this->cacheEnabled) {
    Cache::put("tenant:{$id}", $tenant, $this->cacheTtl);
}
```

#### **8.2. Add Request/Session Caching**
Cache tenant context per request to avoid repeated detection.

### **Step 9: Final Validation**
#### **9.1. Run Complete Test Suite**
```bash
php artisan test
# All tests should pass
# No regressions in existing functionality
```

#### **9.2. Manual Testing Scenarios**
Test:
1. **Multi-package detection**: Simulate Spatie vs Stancl environments
2. **Safety guard failures**: Test when guards reject tenants
3. **Context switching**: Landlord ↔ Tenant context switching
4. **Concurrent requests**: Multiple tenants in same request lifecycle

#### **9.3. Code Review Checklist**
- [ ] All interface methods implemented
- [ ] Safety guards properly integrated
- [ ] Package detection works
- [ ] Backward compatibility maintained
- [ ] Error handling comprehensive
- [ ] Logging adequate for debugging
- [ ] Configuration flexible
- [ ] Tests cover edge cases

---

## **CRITICAL NEXT STEPS (Start Here)**

### **Immediate Action Items:**

1. **First, check test status:**
   ```bash
   php artisan test tests/Feature/TenantContextServiceTest.php
   ```

2. **Examine safety guard interfaces:**
   ```bash
   cat app/Contexts/Platform/Application/Services/TenantProvisioningGuard.php
   # Note: What validation methods exist?
   # - validateProvisioningFlow()?
   # - ensureTenantIsProvisioned()?
   # - Other methods?
   ```

3. **Update safety integration based on actual guard methods**
4. **Run tests again**
5. **Iterate until all tests pass**

### **Expected Final Architecture:**
```
TenantContextService (Package-agnostic)
├── Package Detection Strategy
│   ├── SpatieTenantDetector (+Adapter)
│   ├── StanclTenantDetector (+Adapter)  
│   └── CustomTenantDetector
├── Safety Guard Integration
│   ├── TenantProvisioningGuard
│   └── SafeTenantDatabaseSelector
└── Context Management
    ├── Current tenant state
    ├── Context switching
    └── Cache management
```

### **Key Design Patterns Used:**
1. **Strategy Pattern**: Different tenant detection methods
2. **Adapter Pattern**: Convert package tenants to TenantInterface
3. **Decorator Pattern**: Safety guards wrap tenant validation
4. **Singleton Pattern**: Single tenant context per request
5. **Factory Pattern**: Create appropriate tenant adapters

---

## **WHEN STARTING NEW CLAUDE CLI SESSION**

**Copy this entire prompt** and start with:
```bash
# 1. Navigate to project
cd packages/laravel-backend

# 2. Check current state
git status
php artisan test tests/Feature/TenantContextServiceTest.php

# 3. Review what's implemented
cat app/Services/TenantContextService.php | head -50

# 4. Continue from where left off
# (Follow steps above based on test results)
```

The goal is a **production-ready, package-agnostic TenantContext service** that:
1. ✅ Works with any tenancy package
2. ✅ Integrates with safety guards  
3. ✅ Maintains backward compatibility
4. ✅ Has comprehensive test coverage
5. ✅ Is well-documented for developers

**Proceed step-by-step, testing after each change.** Good luck! 🚀