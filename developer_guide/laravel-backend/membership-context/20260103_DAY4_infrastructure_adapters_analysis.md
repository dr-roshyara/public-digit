# DAY 4: Infrastructure Adapters - Analysis & Production Roadmap

**Date**: 2026-01-03
**Status**: ✅ Analysis Complete
**Current State**: Test/Stub Implementations Working
**Production Ready**: ⚠️ Requires integration with Geography & TenantAuth contexts

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Current Implementation Status](#current-implementation-status)
3. [Adapter Analysis](#adapter-analysis)
4. [Production Implementation Roadmap](#production-implementation-roadmap)
5. [Testing Strategy](#testing-strategy)
6. [Integration Requirements](#integration-requirements)
7. [Migration Path (Stub → Production)](#migration-path-stub--production)

---

## Overview

### What Are Infrastructure Adapters?

Infrastructure adapters are the **Anti-Corruption Layer (ACL)** between bounded contexts in DDD. They:

1. **Isolate** the Membership context from external dependencies (Geography, TenantAuth)
2. **Translate** between different domain models and data structures
3. **Protect** domain logic from changes in external contexts
4. **Enable** independent evolution of bounded contexts

### Why Stub Implementations First?

**Test-Driven Development Approach**:
- ✅ Domain layer can be built independently
- ✅ Application services can be tested in isolation
- ✅ API layer can be implemented without waiting for other contexts
- ✅ Parallel development of bounded contexts possible

**Migration Strategy**:
```
Phase 1 (DAY 1-3): Stub implementations → Domain + API working
Phase 2 (DAY 4): Analysis → Document production requirements
Phase 3 (Future): Production → Replace stubs with real integrations
```

---

## Current Implementation Status

### Adapters Implemented (Stubs)

| Adapter | Interface | Status | Purpose |
|---------|-----------|--------|---------|
| **GeographyValidationAdapter** | GeographyResolverInterface | ✅ Test/Stub | Validate geography references |
| **TenantAuthProvisioningAdapter** | TenantUserProvisioningInterface | ✅ Test/Stub | Provision tenant users |
| **TenantUserIdentityVerification** | IdentityVerificationInterface | ✅ Test/Stub | Verify user identity |

### Service Provider Bindings

**File**: `MembershipServiceProvider.php`

```php
// Infrastructure layer bindings (Anti-Corruption Layer)
$this->app->bind(
    GeographyResolverInterface::class,
    GeographyValidationAdapter::class // Stub implementation
);

$this->app->bind(
    TenantUserProvisioningInterface::class,
    TenantAuthProvisioningAdapter::class // Stub implementation
);

$this->app->bind(
    IdentityVerificationInterface::class,
    TenantUserIdentityVerification::class // Stub implementation
);
```

**Current Behavior**: Container resolves to stub implementations during runtime.

---

## Adapter Analysis

### 1. GeographyValidationAdapter

**Location**: `Infrastructure/Services/GeographyValidationAdapter.php`

#### Current Implementation (Stub)

**Functionality**:
```php
public function validate(?string $geoReference): ?GeoReference
{
    // Basic format validation only
    $pattern = '/^[a-z]{2}(\.[a-z0-9\-_]+)+$/';

    if (!preg_match($pattern, strtolower($geoReference))) {
        return null; // Invalid format
    }

    return new GeoReference($geoReference); // Assume valid
}
```

**What It Does** (Stub):
- ✅ Validates format: `country.level.id` (e.g., `np.3.15.234`)
- ✅ Returns `GeoReference` value object if format valid
- ✅ Returns `null` if invalid format
- ❌ Does NOT check if geography exists in Geography context
- ❌ Does NOT validate hierarchy (country → province → district)
- ❌ Does NOT check if geography is active/published

**Logs**:
```
[DEBUG] GeographyValidationAdapter: Validated geography reference
  geo_reference: np.3.15.234
```

#### Production Implementation Requirements

**What It Should Do** (Production):

1. **Validate Existence**:
   ```php
   // Query Geography context
   $geoUnit = $this->geographyService->findByReference($geoReference);

   if (!$geoUnit || !$geoUnit->isActive()) {
       throw new GeographyNotFoundException("Geography not found: {$geoReference}");
   }
   ```

2. **Validate Hierarchy**:
   ```php
   // Ensure complete hierarchy exists
   if (!$geoUnit->hasCompleteHierarchy()) {
       throw new InvalidGeographyHierarchyException();
   }
   ```

3. **Cache Results**:
   ```php
   // Cache validated references (Redis, 24h TTL)
   return Cache::remember("geo:{$geoReference}", 86400, function () use ($geoReference) {
       return $this->geographyService->findByReference($geoReference);
   });
   ```

4. **Resolve Names**:
   ```php
   public function resolveName(string $geoReference): ?string
   {
       // Example: "np.3.15.234" → "Nepal, Bagmati Province, Kathmandu, Ward 15"
       return $this->geographyService->getFullName($geoReference);
   }
   ```

**Integration Points**:
- **Geography Service**: `GeographyService` from Geography bounded context
- **Database**: `geo_units` table (landlord database, shared read-only)
- **Cache**: Redis for validated references
- **Events**: Subscribe to `GeographyUpdated` events to invalidate cache

**Error Handling**:
```php
try {
    $geoUnit = $this->geographyService->validate($geoReference);
} catch (GeographyServiceUnavailableException $e) {
    // Log error, return null (optional field)
    \Log::error('Geography service unavailable', [
        'geo_reference' => $geoReference,
        'error' => $e->getMessage(),
    ]);
    return null; // Degrade gracefully
}
```

---

### 2. TenantAuthProvisioningAdapter

**Location**: `Infrastructure/Services/TenantAuthProvisioningAdapter.php`

#### Current Implementation (Stub)

**Mobile Registration** (Stub):
```php
public function provisionForMobile(MobileRegistrationDto $dto): TenantUserId
{
    // Generate fake ULID
    $fakeTenantUserId = (string) Str::ulid();

    \Log::debug('Provisioning user for mobile', [
        'tenant_id' => $dto->tenantId,
        'email' => $dto->email,
        'generated_user_id' => $fakeTenantUserId,
    ]);

    return new TenantUserId($fakeTenantUserId);
}
```

**Desktop Registration** (Stub):
```php
public function provisionForDesktop(DesktopRegistrationDto $dto): TenantUserId
{
    // Assume user exists, return from DTO
    \Log::debug('Desktop registration (user already exists)', [
        'tenant_id' => $dto->tenantId,
        'tenant_user_id' => $dto->tenantUserId,
    ]);

    return new TenantUserId($dto->tenantUserId);
}
```

**What It Does** (Stub):
- ✅ Mobile: Generates fake ULID for testing
- ✅ Desktop: Returns provided tenant_user_id without validation
- ❌ Does NOT create actual tenant_user record
- ❌ Does NOT validate user exists (Desktop)
- ❌ Does NOT send verification emails
- ❌ Does NOT set initial user status

#### Production Implementation Requirements

**Mobile Registration** (Production):

```php
public function provisionForMobile(MobileRegistrationDto $dto): TenantUserId
{
    // 1. Create tenant_user record in TenantAuth context
    $tenantUser = $this->tenantAuthService->createUser([
        'tenant_id' => $dto->tenantId,
        'email' => $dto->email,
        'full_name' => $dto->fullName,
        'phone' => $dto->phone,
        'status' => 'pending_verification',
        'source' => 'mobile_member_registration',
        'metadata' => [
            'device_id' => $dto->deviceId,
            'app_version' => $dto->appVersion,
            'platform' => $dto->platform,
        ],
    ]);

    // 2. Generate email verification token
    $verificationToken = $this->tenantAuthService->generateVerificationToken(
        $tenantUser->id
    );

    // 3. Dispatch email verification event
    event(new TenantUserCreated($tenantUser->id, $verificationToken));

    // 4. Return tenant user ID
    return new TenantUserId($tenantUser->id);
}
```

**Desktop Registration** (Production):

```php
public function provisionForDesktop(DesktopRegistrationDto $dto): TenantUserId
{
    // 1. Validate user exists in TenantAuth context
    $tenantUser = $this->tenantAuthService->findUserById(
        $dto->tenantUserId,
        $dto->tenantId
    );

    if (!$tenantUser) {
        throw new TenantUserNotFoundException(
            "Tenant user not found: {$dto->tenantUserId}"
        );
    }

    // 2. Validate user is active/eligible for membership
    if (!$tenantUser->canBecomeMember()) {
        throw new TenantUserNotEligibleException(
            "User {$dto->tenantUserId} cannot become member (status: {$tenantUser->status})"
        );
    }

    // 3. Check if user already has member record (prevent duplicates)
    if ($this->memberRepository->existsForTenantUser($dto->tenantUserId)) {
        throw new MemberAlreadyExistsException(
            "Member already exists for user {$dto->tenantUserId}"
        );
    }

    // 4. Return validated tenant user ID
    return new TenantUserId($tenantUser->id);
}
```

**Integration Points**:
- **TenantAuth Service**: `TenantAuthService` from TenantAuth bounded context
- **Database**: `tenant_users` table (tenant database)
- **Events**: Dispatch `TenantUserCreated`, subscribe to `TenantUserVerified`
- **Queue**: Email verification jobs

**Error Handling**:
```php
try {
    $tenantUser = $this->tenantAuthService->createUser($data);
} catch (TenantAuthServiceException $e) {
    // Log and throw domain exception
    \Log::error('Failed to provision tenant user', [
        'tenant_id' => $dto->tenantId,
        'email' => $dto->email,
        'error' => $e->getMessage(),
    ]);

    throw new UserProvisioningFailedException(
        'Failed to create tenant user account',
        previous: $e
    );
}
```

---

### 3. TenantUserIdentityVerification

**Location**: `Infrastructure/Services/TenantUserIdentityVerification.php`

#### Current Implementation (Stub)

**Assumed Implementation** (not read, but likely similar):
```php
public function verifyIdentity(TenantUserId $userId): bool
{
    // Stub: Always return true
    return true;
}
```

**What It Should Do** (Production):

```php
public function verifyIdentity(TenantUserId $userId): bool
{
    // 1. Check email verification status
    $tenantUser = $this->tenantAuthService->findUserById($userId->value());

    if (!$tenantUser || !$tenantUser->isEmailVerified()) {
        return false; // Not verified
    }

    // 2. Optional: Additional verification checks
    // - Phone verification status
    // - Document upload status
    // - Admin approval status

    return true; // Identity verified
}

public function sendVerificationEmail(TenantUserId $userId): void
{
    // Trigger email verification flow
    $this->tenantAuthService->sendVerificationEmail($userId->value());
}
```

---

## Production Implementation Roadmap

### Phase 1: Infrastructure Setup (2-4 hours)

**Prerequisites**:
1. Geography context API/Service available
2. TenantAuth context API/Service available
3. Redis cache configured
4. Queue workers running

**Tasks**:
- [ ] Create `GeographyServiceInterface` (if not exists)
- [ ] Create `TenantAuthServiceInterface` (if not exists)
- [ ] Configure service provider bindings
- [ ] Set up cache configuration
- [ ] Configure event listeners

### Phase 2: Geography Adapter Production Implementation (4-6 hours)

**File**: `GeographyProductionAdapter.php` (new file)

**Tasks**:
1. **Implement Existence Validation**:
   ```php
   $geoUnit = $this->geographyService->findByReference($geoReference);
   ```

2. **Add Hierarchy Validation**:
   ```php
   if (!$geoUnit->hasCompleteHierarchy()) {
       throw new InvalidGeographyHierarchyException();
   }
   ```

3. **Implement Caching**:
   ```php
   Cache::remember("geo:{$geoReference}", 86400, ...);
   ```

4. **Implement Name Resolution**:
   ```php
   public function resolveName(string $geoReference): ?string
   ```

5. **Add Error Handling**:
   - Service unavailable
   - Network timeouts
   - Invalid responses

6. **Write Tests**:
   - Unit tests (mock Geography service)
   - Integration tests (real Geography context)

### Phase 3: TenantAuth Adapter Production Implementation (6-8 hours)

**File**: `TenantAuthProductionAdapter.php` (new file)

**Tasks**:
1. **Implement Mobile Provisioning**:
   - Create tenant_user record
   - Generate verification token
   - Dispatch email verification event

2. **Implement Desktop Validation**:
   - Validate user exists
   - Check user eligibility
   - Prevent duplicate members

3. **Add Transaction Handling**:
   ```php
   DB::transaction(function () {
       // Create user
       // Generate token
       // Dispatch events
   });
   ```

4. **Add Error Handling**:
   - User creation failures
   - Duplicate email errors
   - Invalid tenant errors

5. **Write Tests**:
   - Unit tests (mock TenantAuth service)
   - Integration tests (real TenantAuth context)

### Phase 4: Service Provider Configuration (1-2 hours)

**Update**: `MembershipServiceProvider.php`

**Environment-Based Bindings**:
```php
public function register(): void
{
    // Geography resolver binding
    if (app()->environment('testing')) {
        $this->app->bind(
            GeographyResolverInterface::class,
            GeographyValidationAdapter::class // Stub for tests
        );
    } else {
        $this->app->bind(
            GeographyResolverInterface::class,
            GeographyProductionAdapter::class // Production
        );
    }

    // TenantAuth provisioning binding
    if (app()->environment('testing')) {
        $this->app->bind(
            TenantUserProvisioningInterface::class,
            TenantAuthProvisioningAdapter::class // Stub for tests
        );
    } else {
        $this->app->bind(
            TenantUserProvisioningInterface::class,
            TenantAuthProductionAdapter::class // Production
        );
    }
}
```

### Phase 5: Integration Testing (4-6 hours)

**Test Scenarios**:
1. Geography validation with real Geography context
2. User provisioning with real TenantAuth context
3. Error handling (service unavailable, network errors)
4. Cache performance testing
5. Event dispatching verification

**Integration Test Example**:
```php
/** @test */
public function it_validates_geography_with_real_geography_context()
{
    // Arrange: Create real geography in Geography context
    $geoUnit = GeographyFactory::createNepalWard('np.3.15.234');

    // Act: Validate through adapter
    $adapter = app(GeographyResolverInterface::class);
    $geoReference = $adapter->validate('np.3.15.234');

    // Assert: Validated successfully
    $this->assertInstanceOf(GeoReference::class, $geoReference);
    $this->assertEquals('np.3.15.234', $geoReference->value());
}
```

---

## Testing Strategy

### Current Testing Approach (Stubs)

**Advantages**:
- ✅ Fast test execution (no external dependencies)
- ✅ Deterministic results (no network/DB variability)
- ✅ Isolated domain logic testing
- ✅ Parallel development possible

**Limitations**:
- ❌ Doesn't test actual integration
- ❌ Can't catch integration bugs
- ❌ Doesn't test error scenarios (service down, timeouts)

### Production Testing Approach

**Unit Tests** (Keep using stubs):
```php
// Mock the adapter
$mockAdapter = Mockery::mock(GeographyResolverInterface::class);
$mockAdapter->shouldReceive('validate')
    ->with('np.3.15.234')
    ->andReturn(new GeoReference('np.3.15.234'));

$this->app->instance(GeographyResolverInterface::class, $mockAdapter);
```

**Integration Tests** (Use real adapters):
```php
// Use real Geography context
$this->app->bind(
    GeographyResolverInterface::class,
    GeographyProductionAdapter::class
);

// Test with real data
$adapter = app(GeographyResolverInterface::class);
$result = $adapter->validate('np.3.15.234');
```

**Test Pyramid**:
```
     /\
    /  \  E2E Tests (1-2 tests)
   /____\
  /      \ Integration Tests (10-15 tests)
 /________\
/          \ Unit Tests (50-100 tests)
```

---

## Integration Requirements

### Geography Context Dependencies

**Required Services**:
1. `GeographyService::findByReference(string $ref): ?GeoUnit`
2. `GeographyService::getFullName(string $ref): ?string`
3. `GeographyService::isActive(string $ref): bool`

**Database Access**:
- **Table**: `geo_units` (landlord database, read-only)
- **Columns**: `id`, `reference`, `name`, `status`, `hierarchy_path`

**Cache Requirements**:
- **Driver**: Redis preferred (Memcached acceptable)
- **TTL**: 24 hours (86400 seconds)
- **Keys**: `geo:{reference}` (e.g., `geo:np.3.15.234`)

**Events to Subscribe**:
- `GeographyUpdated` → Invalidate cache for updated geography
- `GeographyDeactivated` → Invalidate cache, prevent new references

### TenantAuth Context Dependencies

**Required Services**:
1. `TenantAuthService::createUser(array $data): TenantUser`
2. `TenantAuthService::findUserById(string $id, string $tenantId): ?TenantUser`
3. `TenantAuthService::generateVerificationToken(string $userId): string`
4. `TenantAuthService::sendVerificationEmail(string $userId): void`

**Database Access**:
- **Table**: `tenant_users` (tenant database, read-write)
- **Columns**: `id`, `tenant_id`, `email`, `status`, `email_verified_at`

**Events to Dispatch**:
- `TenantUserCreated` → Trigger email verification
- `MemberLinkedToUser` → Notify TenantAuth that user has member record

**Events to Subscribe**:
- `TenantUserVerified` → Update member status (DRAFT → PENDING)
- `TenantUserDeactivated` → Update member status (ACTIVE → INACTIVE)

---

## Migration Path (Stub → Production)

### Step 1: Prepare Production Adapters (Without Breaking Tests)

**Create New Files** (parallel to stubs):
```
Infrastructure/Services/
├── GeographyValidationAdapter.php          # Keep (stub for tests)
├── GeographyProductionAdapter.php          # New (production)
├── TenantAuthProvisioningAdapter.php       # Keep (stub for tests)
└── TenantAuthProductionAdapter.php         # New (production)
```

### Step 2: Environment-Based Binding

**Update** `MembershipServiceProvider.php`:
```php
public function register(): void
{
    // Use stub in testing, production in other environments
    $geographyAdapter = app()->environment('testing')
        ? GeographyValidationAdapter::class
        : GeographyProductionAdapter::class;

    $this->app->bind(GeographyResolverInterface::class, $geographyAdapter);
}
```

### Step 3: Feature Flag (Optional)

**Add Configuration** (`config/membership.php`):
```php
return [
    'adapters' => [
        'geography' => [
            'use_production' => env('MEMBERSHIP_GEOGRAPHY_PRODUCTION', false),
            'cache_ttl' => env('MEMBERSHIP_GEOGRAPHY_CACHE_TTL', 86400),
        ],
        'tenant_auth' => [
            'use_production' => env('MEMBERSHIP_TENANTAUTH_PRODUCTION', false),
        ],
    ],
];
```

**Update Service Provider**:
```php
$geographyAdapter = config('membership.adapters.geography.use_production')
    ? GeographyProductionAdapter::class
    : GeographyValidationAdapter::class;
```

### Step 4: Gradual Rollout

**Phase 1**: Production adapters in staging environment only
**Phase 2**: Production adapters in production for 10% of requests (feature flag)
**Phase 3**: Production adapters for 50% of requests
**Phase 4**: Production adapters for 100% of requests
**Phase 5**: Remove stub adapters (keep for tests only)

---

## Summary

### Current State ✅

1. ✅ **Stub adapters working** - Domain + Application + API layers functional
2. ✅ **Tests passing** - TDD approach validated with stubs
3. ✅ **Clean architecture** - Anti-Corruption Layer properly implemented
4. ✅ **Independent development** - Membership context not blocked by other contexts

### Production Requirements ⚠️

1. ⚠️ **Geography integration** - Requires Geography context API/Service
2. ⚠️ **TenantAuth integration** - Requires TenantAuth context API/Service
3. ⚠️ **Cache infrastructure** - Requires Redis/Memcached
4. ⚠️ **Event infrastructure** - Requires event bus/queue workers

### Next Steps (When Dependencies Ready)

1. **Implement Geography Production Adapter**
   - Integrate with Geography service
   - Add caching layer
   - Write integration tests

2. **Implement TenantAuth Production Adapter**
   - Integrate with TenantAuth service
   - Add transaction handling
   - Write integration tests

3. **Configure Environment-Based Bindings**
   - Stub for testing
   - Production for staging/production

4. **End-to-End Integration Testing**
   - Test with real Geography context
   - Test with real TenantAuth context
   - Verify event propagation

---

**Last Updated**: 2026-01-03 19:30 UTC
**Status**: ✅ Analysis Complete, Production Implementation Deferred
**Blocked By**: Geography Context API, TenantAuth Context API
**Next Phase**: DAY 5 - Complete Testing & Integration (when dependencies ready)
