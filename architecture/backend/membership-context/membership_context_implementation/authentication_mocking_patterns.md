# Authentication Mocking Patterns in Multi-Tenant DDD Tests

**Date:** 2026-01-03
**Context:** Public Digit Platform - Membership Context Implementation
**Author:** Claude (Senior Software Architect)

---

## Executive Summary

Analysis of authentication mocking patterns across existing bounded contexts (TenantAuth, Geography) reveals consistent, DDD-compliant approaches for testing multi-tenant authentication systems. These patterns ensure proper tenant isolation, guard separation, and test coverage while maintaining architectural integrity.

---

## 1. Laravel Auth Facade Mocking Patterns

### Basic Auth Guard Mocking
```php
// Mocking specific guard authentication
Auth::shouldReceive('guard')
    ->with('web')  // or 'tenant' for tenant guard
    ->andReturnSelf();

Auth::shouldReceive('attempt')
    ->with($credentials, $remember)
    ->andReturn(true);  // or false for failed auth
```

### User Retrieval Mocking
```php
// Mock user object with attributes
$mockUser = Mockery::mock();
$mockUser->shouldReceive('getAttribute')->with('id')->andReturn(1);
$mockUser->shouldReceive('getAttribute')->with('email')->andReturn('user@example.com');
$mockUser->shouldReceive('getAttribute')->with('name')->andReturn('Test User');
$mockUser->shouldReceive('getAttribute')->with('roles')->andReturn(['user']);

Auth::shouldReceive('user')->andReturn($mockUser);
```

### Session Token Validation
```php
Auth::shouldReceive('guard')
    ->with('web')
    ->andReturnSelf();

Auth::shouldReceive('setToken')
    ->with($sessionToken)
    ->andReturnSelf();

Auth::shouldReceive('user')
    ->andReturn($mockUser);  // or null for invalid token
```

---

## 2. Tenant Context Mocking Patterns

### TenantContext Service Mocking
```php
// Mock tenant context service
$this->tenantContext = Mockery::mock(TenantContext::class);

// Mock getting current tenant
$this->tenantContext
    ->shouldReceive('getCurrentTenant')
    ->andReturn($tenant);  // or null for landlord context

// Mock setting tenant
$this->tenantContext
    ->shouldReceive('setTenant')
    ->with($tenant)
    ->once();

// Mock clearing tenant
$this->tenantContext
    ->shouldReceive('clearTenant')
    ->once();
```

### Tenant Object Creation
```php
// Creating tenant domain objects for testing
$tenant = new Tenant(
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Organization',
    email: EmailAddress::fromString('admin@test-org.com'),
    slug: TenantSlug::fromString('test-org'),
    status: TenantStatus::active()
);
```

---

## 3. Request & Session Mocking Patterns

### Request Session Mocking
```php
$request = Request::create('/login', 'POST', $credentials);
$request->merge(['remember' => false]);

// Mock session regeneration
$request->shouldReceive('session->regenerate')->once();

// Mock session data retrieval
$request->shouldReceive('session->pull')
    ->with('url.intended', route('landlord.dashboard'))
    ->andReturn(route('landlord.dashboard'));
```

### Request Attribute Mocking
```php
// Setting tenant context on request
$request->attributes->set('tenant_context', [
    'tenant_id' => '123e4567-e89b-12d3-a456-426614174000',
    'tenant_slug' => 'test-org',
    'tenant_name' => 'Test Organization',
    'guard' => 'tenant',
    'context_type' => 'tenant'
]);
```

---

## 4. AuthService Mocking Patterns

### Service Layer Mocking
```php
$this->authService = Mockery::mock(AuthService::class);

// Mock authentication attempts
$this->authService
    ->shouldReceive('attemptLogin')
    ->with($credentials, $request)
    ->andReturn(true);  // or false

// Mock redirect path resolution
$this->authService
    ->shouldReceive('getRedirectPath')
    ->with($request)
    ->andReturn('/dashboard');

// Mock password validation
$this->authService
    ->shouldReceive('validatePasswordStrength')
    ->with($password)
    ->andReturn([]);  // or array of errors
```

---

## 5. Database & Permission Mocking Patterns

### Permission Table Testing
```php
// Testing multi-tenant permission constraints
$perm1 = TenantPermission::create([
    'name' => 'users.view',
    'guard_name' => 'web',
    'tenant_id' => $tenant1->numeric_id,  // Tenant-scoped unique constraint
    'category' => 'users',
]);

$perm2 = TenantPermission::create([
    'name' => 'users.view',
    'guard_name' => 'web',
    'tenant_id' => $tenant2->numeric_id,  // Same name, different tenant
    'category' => 'users',
]);
```

### User Model Mocking
```php
// Mocking User creation (landlord)
$user = Mockery::mock(User::class);
$user->shouldReceive('update')
    ->with(['type' => 'landlord_user'])
    ->once();

User::shouldReceive('create')
    ->with([
        'name' => 'John Doe',
        'email' => 'john@platform.com',
        'password' => Mockery::on(function ($hashedPassword) {
            return Hash::check('securepassword123', $hashedPassword);
        })
    ])
    ->andReturn($user);

// Mocking TenantUser creation
$tenantUser = Mockery::mock(TenantUser::class);
$tenantUser->shouldReceive('update')
    ->with(['type' => 'tenant_user'])
    ->once();
```

---

## 6. Test Double Patterns (Fakes)

### FakeTenantContext Test Double
```php
// Using test doubles for deterministic testing
$fakeTenant = new FakeTenantContext();
$fakeTenant->setTenantId('tenant-123');
$fakeTenant->setTenantProperty('name', 'NRNA Germany');

// Implements TenantContextInterface for hexagonal architecture
final class FakeTenantContext implements TenantContextInterface
{
    private ?string $tenantId = null;
    private array $properties = [];

    public function currentTenantId(): ?string
    {
        return $this->tenantId;
    }

    public function hasTenant(): bool
    {
        return $this->tenantId !== null;
    }
}
```

---

## 7. Multi-Tenant Guard Switching Patterns

### Guard Resolution Mocking
```php
$this->tenantResolver = Mockery::mock(TenantAuthResolver::class);

// Mock guard resolution based on context
$this->tenantResolver
    ->shouldReceive('getCurrentGuard')
    ->andReturn('web');  // or 'tenant'

// Mock tenant resolution from request
$this->tenantResolver
    ->shouldReceive('resolveFromRequest')
    ->with($request)
    ->andReturn($tenant);  // or null

// Mock database connection configuration
$this->tenantResolver
    ->shouldReceive('configureTenantConnection')
    ->with($tenant)
    ->once();
```

---

## 8. Common Test Setup Patterns

### Typical Test Setup
```php
protected function setUp(): void
{
    parent::setUp();

    // Mock dependencies
    $this->authService = Mockery::mock(AuthService::class);
    $this->tenantContext = Mockery::mock(TenantContext::class);
    $this->tenantResolver = Mockery::mock(TenantAuthResolver::class);

    // Create service under test
    $this->controller = new EnhancedAuthenticatedSessionController(
        $this->authService,
        $this->tenantContext
    );
}

protected function tearDown(): void
{
    Mockery::close();
    parent::tearDown();
}
```

---

## Key Patterns Identified

1. **Guard Isolation**: Clear separation between `'web'` (landlord) and `'tenant'` guards
2. **Tenant Context Injection**: Explicit tenant context passing through services
3. **Session Security**: Mocking session regeneration and token validation
4. **Password Validation**: Testing password strength requirements
5. **Multi-Tenant Permissions**: Testing tenant-scoped unique constraints
6. **Test Doubles**: Using fakes for deterministic testing
7. **Request Mocking**: Comprehensive request and session mocking
8. **Database Isolation**: Proper tenant database connection mocking

---

## Files Examined

1. `tests/Contexts/TenantAuth/Application/Services/AuthServiceTest.php`
2. `tests/Contexts/TenantAuth/Infrastructure/Http/Controllers/EnhancedAuthenticatedSessionControllerTest.php`
3. `tests/Unit/Contexts/TenantAuth/Application/Commands/ProvisionCommitteeUsersCommandTest.php`
4. `tests/Feature/TenantAuth/PermissionsUniqueConstraintTest.php`
5. `tests/Unit/Contexts/Platform/Infrastructure/Adapters/LaravelAuthAdapterTest.php`
6. `tests/Doubles/Fakes/FakeTenantContext.php`
7. `tests/Contexts/TenantAuth/Infrastructure/Http/Middleware/EnhancedIdentifyTenantTest.php`

---

## Application to Membership Context

For Membership Context testing, these patterns should be adapted:

1. **Member Authentication**: Mock member-specific guards and authentication
2. **Tenant Scoping**: Ensure all membership operations are tenant-scoped
3. **Permission Testing**: Test member-specific permissions and roles
4. **Database Isolation**: Mock proper tenant database connections for member data
5. **Session Management**: Mock session handling for member authentication flows

---

## Next Steps

Based on these patterns, the next task is to:
1. Extract tenant creation/management patterns from existing tests
2. Create a standardized testing trait/approach for all contexts
3. Fix current Membership tests using established patterns
4. Document the complete multi-tenant testing strategy

---
**Status:** Authentication mocking patterns analysis complete ✅