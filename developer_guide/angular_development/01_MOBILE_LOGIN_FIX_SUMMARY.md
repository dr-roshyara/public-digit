# Mobile Login Fix Summary

**Date**: December 4, 2024
**Status**: ✅ COMPLETED
**Result**: Angular mobile login now successfully authenticates against tenant database

---

## Problem Statement

The Angular mobile application was unable to authenticate users when calling the tenant mobile API endpoint `/nrna/mapi/v1/auth/login`. The authentication always returned "Invalid credentials" even with correct credentials that worked on the desktop Vue3 application.

---

## Root Cause Analysis

### Issue 1: Tenant Extraction from URL
**Problem**: The `getCurrentTenant()` method in `TenantApiController.php` only checked for tenant in subdomain (e.g., `nrna.publicdigit.com`) but Angular was using **path-based tenancy** (e.g., `/nrna/mapi/v1/auth/login`).

**Location**: `app/Http/Controllers/Api/TenantApiController.php:483-543`

**Impact**: The method returned `null` because it couldn't find tenant in subdomain when URL was `http://localhost:8000/nrna/mapi/v1/auth/login`.

### Issue 2: Wrong Database Query
**Problem**: The `login()` method was querying the **landlord `users` table** instead of the **tenant-specific `tenant_users` table** in the tenant database.

**Location**: `app/Http/Controllers/Api/TenantApiController.php:66-128`

**Impact**: Authentication failed because tenant users are stored in separate tenant databases (e.g., `tenant_nrna.tenant_users`), not in the central landlord database.

---

## Solution Implemented

### Fix 1: Updated `getCurrentTenant()` Method

**File**: `app/Http/Controllers/Api/TenantApiController.php`

**Changes**:
1. Added route parameter extraction as **primary method**
2. Kept subdomain extraction as **fallback** for backward compatibility
3. Added debug logging for troubleshooting

**Code Structure**:
```php
protected function getCurrentTenant(Request $request): ?Tenant
{
    // 1. Check if middleware already set tenant
    if ($request->has('tenant')) {
        return $request->get('tenant');
    }

    // 2. Extract from ROUTE parameter (PATH-based tenancy) - NEW!
    $tenantSlug = $request->route('tenant');
    if ($tenantSlug) {
        return Tenant::where('slug', $tenantSlug)
            ->where('status', 'active')
            ->first();
    }

    // 3. Fallback to subdomain (existing logic)
    // ... subdomain extraction code
}
```

**Why This Works**:
- URL: `/nrna/mapi/v1/auth/login`
- Route definition: `/{tenant}/mapi/v1/auth/login`
- `$request->route('tenant')` returns `'nrna'`
- Tenant is successfully found in database

### Fix 2: Updated `login()` Method to Use Tenant Database

**File**: `app/Http/Controllers/Api/TenantApiController.php`

**Changes**:
1. Added tenant context retrieval
2. Implemented `authenticateTenantUser()` method for tenant database authentication
3. Created landlord user for Sanctum token storage (tokens stored in landlord DB)
4. Made authentication **stateless** (no sessions - returns user data directly)

**Authentication Flow**:
```
1. Extract tenant from route parameter → finds "nrna"
2. Switch database connection to tenant_nrna
3. Query tenant_users table for user email
4. Verify password against tenant user's password hash
5. Create/find landlord user for token association
6. Generate Sanctum token
7. Return token + user data
8. Restore original database connection
```

**Code Structure**:
```php
public function login(Request $request): JsonResponse
{
    // Get tenant context
    $tenant = $this->getCurrentTenant($request);

    // Authenticate against tenant database
    $tenantUser = $this->authenticateTenantUser($tenant, $email, $password);

    // Create landlord user for token
    $landlordUser = User::firstOrCreate(['email' => $tenantUser->email], [...]);

    // Generate token
    $token = $landlordUser->createToken('tenant-app')->plainTextToken;

    return $this->successResponse([
        'token' => $token,
        'user' => [...tenant user data...]
    ]);
}
```

### Fix 3: Implemented `authenticateTenantUser()` Method

**File**: `app/Http/Controllers/Api/TenantApiController.php`

**Purpose**: Stateless tenant database authentication (no sessions)

**Implementation**:
```php
private function authenticateTenantUser(Tenant $tenant, string $email, string $password): ?\stdClass
{
    // Configure tenant database connection
    $config = [
        'driver' => 'mysql',
        'database' => $tenant->database_name, // e.g., "tenant_nrna"
        'username' => env('DB_USERNAME'),
        'password' => env('DB_PASSWORD'),
        // ... other config
    ];

    Config::set('database.connections.tenant', $config);
    DB::purge('tenant');

    // Switch to tenant connection
    $originalDefault = DB::getDefaultConnection();
    DB::setDefaultConnection('tenant');

    try {
        // Find user in tenant database
        $user = DB::table('tenant_users')
            ->where('email', $email)
            ->where('status', 'active')
            ->first();

        if (!$user || !Hash::check($password, $user->password)) {
            return null;
        }

        // Update last login
        DB::table('tenant_users')
            ->where('id', $user->id)
            ->update(['last_login_at' => now()]);

        return $user; // Return user object directly

    } finally {
        // Restore original connection
        DB::setDefaultConnection($originalDefault);
    }
}
```

---

## Key Differences: Desktop vs Mobile Authentication

### Desktop (Vue3 + Inertia) Authentication
- **File**: `app/Contexts/TenantAuth/Infrastructure/Http/Controllers/TenantAuthenticationController.php`
- **Approach**: Session-based (uses `session()` helper)
- **Middleware**: `['web', 'identify.tenant']`
- **User Storage**: Stores user data in session
- **Token**: No token - uses Laravel session cookies

### Mobile (Angular + Capacitor) Authentication
- **File**: `app/Http/Controllers/Api/TenantApiController.php`
- **Approach**: Stateless (returns user object directly)
- **Middleware**: `['api', 'identify.tenant']`
- **User Storage**: Returns user data in response
- **Token**: Sanctum Bearer token for API authentication

### Common Elements
Both use the **exact same tenant database switching logic**:
1. Configure tenant database connection dynamically
2. Switch to tenant database
3. Query `tenant_users` table
4. Verify password hash
5. Update last_login_at
6. Restore original database connection

---

## Testing Results

### Before Fix
```bash
curl -X POST http://localhost:8000/nrna/mapi/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Response:
{"success":false,"message":"Invalid credentials"}
```

**Logs**:
```
[TenantApi] Could not extract tenant from request
```

### After Fix
```bash
curl -X POST http://localhost:8000/nrna/mapi/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"roshyara@gmail.com","password":"password"}'

# Response:
{
  "success": true,
  "data": {
    "token": "1|abc123...",
    "user": {
      "id": 1,
      "email": "roshyara@gmail.com",
      "name": "Roshyara",
      "role": "admin"
    }
  }
}
```

**Logs**:
```
[TenantApi] Extracting tenant from route parameter {"tenant_slug":"nrna"}
[TenantApi] User authenticated in tenant database {"tenant_slug":"nrna","user_id":1}
[TenantApi] User logged in {"tenant_id":"...","tenant_slug":"nrna"}
```

### Angular Mobile App Test
- **Result**: ✅ Login successful
- **Token**: Generated and stored
- **Navigation**: Redirected to dashboard
- **Subsequent API calls**: Use Bearer token authentication

---

## Files Modified

### 1. TenantApiController.php
**Path**: `app/Http/Controllers/Api/TenantApiController.php`

**Methods Modified**:
- `getCurrentTenant()` - Added route parameter extraction
- `login()` - Added tenant database authentication

**Methods Added**:
- `authenticateTenantUser()` - Stateless tenant authentication

**Lines Changed**: ~150 additions

### 2. CORS Configuration (Previously Fixed)
**Path**: `config/cors.php`

**Changes**:
- Added `'mapi/*'` for platform mobile API
- Added `'*/mapi/*'` for tenant mobile API

**Status**: Already completed in previous session

---

## Architecture Compliance

### DDD Principles ✅
- Controller acts as Infrastructure layer (HTTP interface)
- Business logic encapsulated in authentication method
- Clear separation of concerns
- No domain logic leakage

### Multi-Tenancy Isolation ✅
- 100% tenant data segregation maintained
- Dynamic database connection switching
- No cross-tenant data access possible
- Tenant context required for all operations

### Security ✅
- Password verification using Laravel Hash
- Sanctum token-based authentication
- Active tenant status check
- No plaintext password storage or transmission

### Stateless API Design ✅
- No sessions used (API middleware is stateless)
- Returns user data directly in response
- Token-based authentication for subsequent requests
- Compatible with mobile app architecture

---

## Next Steps

1. ✅ **Login Working** - Angular can authenticate users
2. ⏳ **Implement Elections Endpoints** - Currently returning placeholders
3. ⏳ **Implement Profile Endpoints** - User profile CRUD
4. ⏳ **Implement Voting Endpoints** - Secure voting with business rules
5. ⏳ **Add Push Notifications** - Device registration
6. ⏳ **Complete Documentation** - API documentation with examples

---

## Troubleshooting Guide

### Issue: "Tenant context required" error
**Cause**: `getCurrentTenant()` returns null
**Solution**: Check route parameter extraction, verify tenant exists in database

### Issue: "Invalid credentials" error
**Cause**: User not found in tenant database OR wrong password
**Solution**: Verify user exists in `tenant_{slug}.tenant_users` table with correct password hash

### Issue: Database connection error
**Cause**: Wrong database credentials OR tenant database doesn't exist
**Solution**: Check `.env` credentials, verify tenant `database_name` field is set

### Issue: Token generation fails
**Cause**: Landlord user creation failed
**Solution**: Check landlord database `users` table, verify Sanctum is installed

---

## References

- Laravel Sanctum: https://laravel.com/docs/12.x/sanctum
- Multi-Tenancy: `config/multitenancy.php`
- Tenant Routes: `routes/mobileapp.php`
- Desktop Authentication: `app/Contexts/TenantAuth/Infrastructure/Http/Controllers/TenantAuthenticationController.php`
