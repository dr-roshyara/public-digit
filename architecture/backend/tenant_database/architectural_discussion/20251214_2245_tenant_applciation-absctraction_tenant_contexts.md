# **PROMPT ENGINEERING INSTRUCTIONS FOR CLAUDE CLI**

## **COMMAND: Implement TenantContext Service with TDD Approach**

### **Context Setup:**
```
We are implementing a TenantContext service to provide package-agnostic tenant identification while respecting our existing safety guards (TenantProvisioningGuard, SafeTenantDatabaseSelector).

Current System:
- Using Spatie/laravel-multitenancy
- TenantInterface abstraction layer already exists
- Comprehensive safety system in place
- Need to abstract tenant identification for future package flexibility

Goal: Create TenantContext service with Test-Driven Development, ensuring it works with existing safety guards.
```

### **Phase 1: TDD - Write Tests First**
```
Create comprehensive test suite for TenantContext service following TDD principles.
```

**File 1: Create Feature Test**
```bash
claude --prompt "Create feature test for TenantContext service with: 1) Test class TenantContextTest in tests/Feature/TenantContextTest.php, 2) Setup method that creates test tenant using existing Tenant model, 3) Tests for: getCurrentTenant() returns tenant when context exists, getCurrentTenant() returns null when no context, getTenantById() finds tenant by ID, getTenantById() returns null for invalid ID, ensureTenantContext() throws exception when no tenant, ensureTenantContext() passes when tenant exists, 4) Mock SafeTenantDatabaseSelector interactions, 5) Respect existing TenantProvisioningGuard validations" --file "tests/Feature/TenantContextTest.php" --edit
```

**File 2: Create Unit Test for Edge Cases**
```bash
claude --prompt "Create unit test for TenantContext edge cases: 1) Test class TenantContextUnitTest in tests/Unit/Services/TenantContextUnitTest.php, 2) Tests for: multiple tenancy package detection (simulate Spatie vs future Stancl), environment-specific behavior (testing vs production), exception handling when packages missing, compatibility with TenantInterface contract, interaction with existing safety guards, 3) Use PHPUnit data providers for different scenarios, 4) Mock dependencies appropriately" --file "tests/Unit/Services/TenantContextUnitTest.php" --edit
```

### **Phase 2: Implement TenantContext Service**
```
Implement the TenantContext service to pass the tests.
```

**File 3: Create TenantContext Service Interface**
```bash
claude --prompt "Create TenantContext service interface with: 1) Interface TenantContextInterface in app/Contracts/TenantContextInterface.php, 2) Methods: getCurrentTenant(): ?TenantInterface, getTenantById(string $id): ?TenantInterface, ensureTenantContext(): void (throws exception if no tenant), isTenantContextSet(): bool, clearTenantContext(): void, 3) Type hints and strict types, 4) Document each method with PHPDoc" --file "app/Contracts/TenantContextInterface.php" --edit
```

**File 4: Implement TenantContext Service**
```bash
claude --prompt "Implement TenantContext service in app/Services/TenantContext.php with: 1) Implements TenantContextInterface, 2) Constructor that optionally accepts tenant model class name for flexibility, 3) getCurrentTenant() that tries: Spatie's Tenant::current() first, then other detection methods, returns null if no tenant, 4) getTenantById() that uses tenant model to find by ID, 5) ensureTenantContext() that throws TenantContextException if no tenant, 6) isTenantContextSet() checks if tenant context exists, 7) clearTenantContext() for testing/cleanup, 8) Respects TenantProvisioningGuard by validating tenant before returning, 9) Logs tenant context changes for audit trail, 10) Type-safe returns with TenantInterface" --file "app/Services/TenantContext.php" --edit
```

**File 5: Create Custom Exception**
```bash
claude --prompt "Create custom exception for tenant context errors: 1) TenantContextException in app/Exceptions/TenantContextException.php, 2) Extends Exception, 3) Additional properties: tenantId, contextType, previousContext, 4) Constructor that accepts these properties, 5) Method getContextInfo() returns array of context details, 6) Proper PHPDoc documentation" --file "app/Exceptions/TenantContextException.php" --edit
```

### **Phase 3: Service Provider & Configuration**
```
Register and configure the TenantContext service.
```

**File 6: Create Service Provider**
```bash
claude --prompt "Create TenantContextServiceProvider in app/Providers/TenantContextServiceProvider.php with: 1) Registers TenantContext as singleton, 2) Binds TenantContextInterface to TenantContext implementation, 3) Provides configuration for tenant model class (defaults to App\Models\Tenant), 4) Boot method that sets up any event listeners for tenant context changes, 5) Integration with existing AppServiceProvider safety monitoring" --file "app/Providers/TenantContextServiceProvider.php" --edit
```

**File 7: Add Configuration**
```bash
claude --prompt "Create configuration file config/tenant-context.php with: 1) Default tenant model class, 2) Detection order (Spatie first, then others), 3) Logging settings for tenant context changes, 4) Safety validation settings (whether to use TenantProvisioningGuard), 5) Environment-specific overrides, 6) Cache settings for tenant lookups" --file "config/tenant-context.php" --edit
```

### **Phase 4: Integration with Safety System**
```
Ensure TenantContext integrates with existing safety guards.
```

**File 8: Update TenantProvisioningGuard**
```bash
claude --prompt "Update TenantProvisioningGuard to work with TenantContext: 1) Add method validateTenantContext() that uses TenantContext service, 2) Update validateProvisioningFlow() to check tenant context validity, 3) Add integration methods that ensure safety guards respect tenant context, 4) Log tenant context validation results, 5) Throw specific exceptions for context violations" --file "app/Contexts/Platform/Application/Services/TenantProvisioningGuard.php" --edit
```

**File 9: Update SafeTenantDatabaseSelector**
```bash
claude --prompt "Update SafeTenantDatabaseSelector to use TenantContext: 1) Modify switchToTenant() to validate tenant context before switching, 2) Add method getCurrentTenantFromContext() that uses TenantContext service, 3) Update logging to include tenant context information, 4) Ensure pre-flight checks respect tenant context, 5) Add context validation in connection configuration" --file "app/Contexts/TenantAuth/Infrastructure/Database/SafeTenantDatabaseSelector.php" --edit
```

### **Phase 5: TDD - Implement Additional Tests**
```
Add integration tests for the complete system.
```

**File 10: Integration Test with Safety Guards**
```bash
claude --prompt "Create integration test showing TenantContext with safety guards: 1) Test class TenantContextSafetyIntegrationTest in tests/Integration/TenantContextSafetyIntegrationTest.php, 2) Tests that verify: TenantContext works with TenantProvisioningGuard, TenantContext works with SafeTenantDatabaseSelector, Tenant context is maintained during database switching, Safety validations respect tenant context, Audit logging includes tenant context info, 3) Simulate full tenant lifecycle (create, switch, operate, clear), 4) Verify no safety violations when using TenantContext" --file "tests/Integration/TenantContextSafetyIntegrationTest.php" --edit
```

**File 11: Middleware Test**
```bash
claude --prompt "Create test for TenantContextMiddleware (to be created): 1) Test class TenantContextMiddlewareTest in tests/Feature/Middleware/TenantContextMiddlewareTest.php, 2) Tests for: middleware sets tenant context from request, middleware validates tenant context with safety guards, middleware clears context after request, middleware handles missing tenant gracefully, middleware integrates with authentication, 3) Simulate HTTP requests with different tenant contexts" --file "tests/Feature/Middleware/TenantContextMiddlewareTest.php" --edit
```

### **Phase 6: Additional Components (Optional)**
```
Create supporting components for complete implementation.
```

**File 12: Create TenantContextMiddleware**
```bash
claude --prompt "Create TenantContextMiddleware in app/Http/Middleware/TenantContextMiddleware.php with: 1) Sets tenant context based on request (slug, domain, header), 2) Uses TenantContext service, 3) Validates context with TenantProvisioningGuard, 4) Clears context after response, 5) Logs context changes, 6) Handles exceptions gracefully, 7) Integrates with existing authentication" --file "app/Http/Middleware/TenantContextMiddleware.php" --edit
```

**File 13: Create Facade for Easy Access**
```bash
claude --prompt "Create TenantContext facade in app/Facades/TenantContext.php with: 1) Extends Illuminate\Support\Facades\Facade, 2) getFacadeAccessor() returns 'tenant-context', 3) Documented facade methods matching TenantContextInterface, 4) Type hints for IDE support" --file "app/Facades/TenantContext.php" --edit
```

### **Phase 7: Documentation & Examples**
```
Document the implementation and provide usage examples.
```

**File 14: Create Usage Documentation**
```bash
claude --prompt "Create documentation in docs/tenant-context-usage.md with: 1) Quick start guide, 2) Basic usage examples with code, 3) Integration with safety guards, 4) Testing with TenantContext, 5) Migration from direct Tenant::current() calls, 6) Common patterns and best practices, 7) Troubleshooting guide" --file "docs/tenant-context-usage.md" --edit
```

**File 15: Update Developer Guide**
```bash
claude --prompt "Update DEVELOPER-GUIDE-TENANT-SAFETY.md to include TenantContext section: 1) Add TenantContext to safety system overview, 2) Show how to use TenantContext instead of direct package calls, 3) Update code examples to use TenantContext, 4) Add TenantContext to code review checklist, 5) Explain benefits for future package migration" --file "docs/DEVELOPER-GUIDE-TENANT-SAFETY.md" --edit
```

## **TDD EXECUTION SEQUENCE**

### **Step 1: Run Initial Tests (Should Fail)**
```bash
# Run the first test to see red (TDD first phase)
./vendor/bin/phpunit tests/Feature/TenantContextTest.php
```

### **Step 2: Implement Minimum Code to Pass Tests**
```bash
# Implement TenantContext service
# Run tests after each implementation step
./vendor/bin/phpunit tests/Feature/TenantContextTest.php --filter testGetCurrentTenant
./vendor/bin/phpunit tests/Feature/TenantContextTest.php --filter testGetTenantById
```

### **Step 3: Implement Integration with Safety Guards**
```bash
# Update existing safety guards to use TenantContext
# Run integration tests
./vendor/bin/phpunit tests/Integration/TenantContextSafetyIntegrationTest.php
```

### **Step 4: Run Full Test Suite**
```bash
# Verify everything works together
./vendor/bin/phpunit --testsuite=Feature,Unit,Integration
```

## **VALIDATION CHECKLIST**

After implementation, verify:

```bash
# 1. All tests pass
./vendor/bin/phpunit

# 2. No safety guard violations
php artisan tinker
>>> use App\Services\TenantContext;
>>> $context = app(TenantContext::class);
>>> $tenant = $context->getCurrentTenant(); # Should return null or valid tenant

# 3. Integration with existing system
php artisan tenant:debug um1 --action=view # Should still work

# 4. Check logs for tenant context changes
tail -n 50 storage/logs/laravel.log | grep -i "tenant.context"
```

## **CRITICAL REQUIREMENTS FOR CLAUDE:**

1. **TDD Discipline** - Write tests FIRST, then minimal implementation
2. **Respect Safety Guards** - All changes must maintain existing safety
3. **Backward Compatibility** - Existing code should continue to work
4. **Type Safety** - Use TenantInterface consistently
5. **Audit Logging** - Log all tenant context changes
6. **Error Handling** - Graceful degradation when no tenant context
7. **No Breaking Changes** - Phased migration path for existing code

## **EXPECTED OUTCOME:**

After implementation:
- ✅ Tests written and passing (TDD complete)
- ✅ TenantContext service providing package-agnostic tenant identification
- ✅ Integration with existing safety guards maintained
- ✅ Audit logging for tenant context changes
- ✅ Clear migration path from direct package calls
- ✅ Foundation for future package migration

**Run Phase 1 first (tests), then implement minimum code to pass tests, following strict TDD methodology.**