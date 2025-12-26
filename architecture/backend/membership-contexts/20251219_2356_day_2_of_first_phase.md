Perfect! Let's begin **Day 1** implementation.

## **🚀 DAY 1 EXECUTION: CREATE THE FAILING TEST**

### **Step 1: Create the Test File Structure**
Run this command in your terminal:

```bash
php artisan make:test Contexts/Membership/TenantUserValidatorTest --pest
```

### **Step 2: Generate the Failing Tests**
Now use this **exact prompt** with Claude (Code/CLI):

> **Role:** Senior Laravel Backend Developer following strict Test-Driven Development (TDD).
> **Current Phase:** RED (Create failing tests)
> 
> **Task:** Write comprehensive PestPHP tests for the `TenantUserValidator` service.
> 
> **File to Edit:** `tests/Feature/Contexts/Membership/TenantUserValidatorTest.php`
> 
> **Requirements:**
> 1. **Namespace:** `Tests\Feature\Contexts\Membership`
> 2. **Use:** `DatabaseTransactions` trait for database tests
> 3. **Mocking Strategy:** Mock `TenantUserRepositoryInterface` using Pest's mocking helpers
> 4. **Test Structure:** Use Pest's `it()` function or `test()` method for each case
> 
> **Write these 5 test cases (ALL MUST FAIL INITIALLY):**
> 
> 1. **`it('validates an active tenant user')`**
>    - Mock repository to return a valid TenantUser with `status = 'active'` and no linked member
>    - Call validator with correct tenant ID
>    - Assert returns the TenantUser instance
>    - Assert no exception thrown
> 
> 2. **`it('throws exception for inactive user')`**
>    - Mock TenantUser with `status = 'inactive'`
>    - Expect `InvalidTenantUserException` with message containing "inactive"
>    - Use `expectException()` or `$this->expectException()`
> 
> 3. **`it('throws exception for user already linked to member')`**
>    - Mock TenantUser where `member` relationship returns a non-null value
>    - Expect exception with message containing "already linked"
> 
> 4. **`it('throws exception for cross-tenant user access')`**
>    - Mock TenantUser with `tenant_id = 1`
>    - Call validator with `$tenantId = 2` (different tenant)
>    - Expect exception with message containing "different tenant" or "tenant mismatch"
> 
> 5. **`it('throws exception for non-existent user')`**
>    - Mock repository to return `null`
>    - Expect exception with message containing "not found"
> 
> **Important TDD Rules:**
> - Do NOT create the `TenantUserValidator` class yet
> - Do NOT create the `InvalidTenantUserException` yet
> - Tests should fail because classes don't exist
> - Use descriptive failure messages
> - Use strict type hints in closures
> 
> **Example test structure:**
> ```php
> it('validates an active tenant user', function () {
>     // Arrange
>     $mockUser = mock(TenantUser::class);
>     $mockUser->shouldReceive('getAttribute')->with('status')->andReturn('active');
>     // ... more mocking
>     
>     // Act & Assert
>     // This will fail initially - that's correct for TDD
>     $validator = new TenantUserValidator($mockRepository);
>     $result = $validator->validate(1, 1);
>     
>     expect($result)->toBe($mockUser);
> });
> ```

### **Step 3: Verify Tests Fail (RED Phase)**
After generating the tests, run them:

```bash
./vendor/bin/pest tests/Feature/Contexts/Membership/TenantUserValidatorTest.php --stop-on-failure
```

**Expected Output:** All 5 tests should fail with errors like:
- `Class "App\Contexts\Membership\Application\Services\TenantUserValidator" not found`
- `Class "App\Contexts\Membership\Domain\Exceptions\InvalidTenantUserException" not found`

This is **CORRECT** for the RED phase of TDD.

---

## **📋 WHAT TO DO NEXT**

Once you confirm the tests are failing:

1. **Report back** with the test failure output
2. **I'll provide the next prompt** to create the implementation (GREEN phase)
3. **Fill in the progress tracker**

**Ready? Execute Step 1 now (`php artisan make:test...`) and let me know when you have the failing tests.**