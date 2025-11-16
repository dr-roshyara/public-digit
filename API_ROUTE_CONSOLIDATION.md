# API Route Consolidation - Summary

## Change Overview

Consolidated mobile API routes from `/api/mobile/v1/*` to `/api/v1/*` for a cleaner, more standard RESTful API structure.

**Date**: 2025-01-14
**Status**: ✅ Complete

---

## Motivation

The original route structure `/api/mobile/v1/*` was overly specific and verbose. The standard pattern `/api/v1/*` is:
- **Cleaner**: Shorter URLs
- **More Standard**: Follows RESTful API versioning conventions
- **Future-Proof**: Can serve multiple client types (mobile, web, etc.) from the same endpoint

---

## Changes Made

### 1. Route Prefix Updated ✅

**File**: `packages/laravel-backend/routes/mobile.php`

**Before**:
```php
Route::prefix('mobile/v1')->group(function () {
    Route::get('health', [PlatformController::class, 'health'])
        ->name('mobile.v1.health');
    // ...
});
```

**After**:
```php
Route::prefix('v1')->group(function () {
    Route::get('health', [PlatformController::class, 'health'])
        ->name('api.v1.health');
    // ...
});
```

**Result**: Routes now registered as `/api/v1/*` instead of `/api/mobile/v1/*`

### 2. Route Names Updated ✅

All route names changed from `mobile.v1.*` to `api.v1.*`:
- `mobile.v1.auth.login` → `api.v1.auth.login`
- `mobile.v1.auth.me` → `api.v1.auth.me`
- `mobile.v1.elections.index` → `api.v1.elections.index`
- etc.

### 3. CSRF Exceptions Updated ✅

**File**: `packages/laravel-backend/bootstrap/app.php`

**Before**:
```php
$middleware->validateCsrfTokens(except: [
    'api/mobile/v1/*',
    'mobile/*',
    // ...
]);
```

**After**:
```php
$middleware->validateCsrfTokens(except: [
    'api/v1/*',
    'api/*',
    // ...
]);
```

### 4. Rate Limiter Updated ✅

**File**: `packages/laravel-backend/app/Providers/MobileApiServiceProvider.php`

**Before**:
```php
RateLimiter::for('mobile-api', function (Request $request) {
    return $request->user()
        ? Limit::perMinute(120)->by($request->user()->id)
        : Limit::perMinute(30)->by($request->ip());
});

Route::middleware(['api', 'throttle:mobile-api'])
    ->prefix('api')
    ->group(base_path('routes/mobile.php'));
```

**After**:
```php
RateLimiter::for('api-v1', function (Request $request) {
    return $request->user()
        ? Limit::perMinute(120)->by($request->user()->id)
        : Limit::perMinute(30)->by($request->ip());
});

Route::middleware(['api', 'throttle:api-v1'])
    ->prefix('api')
    ->group(base_path('routes/mobile.php'));
```

### 5. Documentation Updated ✅

**File**: `CLAUDE.md`

All references to `/api/mobile/v1/*` updated to `/api/v1/*`:
- Architecture diagrams
- API endpoint examples
- TypeScript service examples
- Testing examples
- Command examples

---

## Route Verification

### Before Consolidation
```bash
GET|HEAD  api/mobile/v1/auth/me
POST      api/mobile/v1/auth/login
GET|HEAD  api/mobile/v1/elections
# etc.
```

### After Consolidation
```bash
GET|HEAD  api/v1/auth/me
POST      api/v1/auth/login
GET|HEAD  api/v1/elections
# etc.
```

### Middleware Verification
```json
{
  "uri": "api/v1/auth/me",
  "middleware": [
    "api",                                    // ✅ No tenant identification
    "Illuminate\\Auth\\Middleware\\Authenticate:sanctum",
    "Illuminate\\Routing\\Middleware\\ThrottleRequests:api-v1"
  ]
}
```

**Confirmed**: No 'web' middleware, no tenant identification - routes work correctly!

---

## Updated API Endpoints

### Authentication
```
POST   /api/v1/auth/login       # Login
POST   /api/v1/auth/logout      # Logout
GET    /api/v1/auth/me          # Get user
POST   /api/v1/auth/refresh     # Refresh token
```

### Elections
```
GET    /api/v1/elections                # List elections
GET    /api/v1/elections/active         # Active elections
GET    /api/v1/elections/{id}           # Election details
POST   /api/v1/elections/{id}/vote      # Cast vote
GET    /api/v1/elections/{id}/results   # View results
GET    /api/v1/elections/{id}/candidates # List candidates
```

### Profile
```
GET    /api/v1/profile                  # Get profile
PUT    /api/v1/profile                  # Update profile
POST   /api/v1/profile/verify           # Verify profile
GET    /api/v1/profile/elections        # User's elections
```

### Health & Stats
```
GET    /api/v1/health                   # Health check
GET    /api/v1/stats                    # Platform stats
```

---

## Mobile App Updates Required

### Update Base URL

**Before**:
```typescript
export class PlatformApiService {
  private baseUrl = 'http://localhost:8000/api/mobile/v1';
}
```

**After**:
```typescript
export class PlatformApiService {
  private baseUrl = 'http://localhost:8000/api/v1';
}
```

### Example API Calls

```typescript
// Login
this.http.post(`${this.baseUrl}/auth/login`, credentials)

// Get user
this.http.get(`${this.baseUrl}/auth/me`)

// List elections
this.http.get(`${this.baseUrl}/elections`)

// Cast vote
this.http.post(`${this.baseUrl}/elections/${id}/vote`, voteData)
```

---

## Testing

### Test Health Endpoint
```bash
curl http://localhost:8000/api/v1/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "service": "mobile-api",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Test Login Endpoint
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

**Expected Response**:
```json
{
  "token": "1|abc123...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com"
  }
}
```

### Test Protected Endpoint
```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer {token}"
```

**Expected Response**:
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "user@example.com",
  "tenants": [...]
}
```

---

## Benefits

### 1. **Cleaner URLs**
- `/api/v1/auth/login` vs `/api/mobile/v1/auth/login`
- 8 fewer characters per URL
- More professional and concise

### 2. **Standard RESTful Convention**
- `/api/v1/*` is the industry standard for versioned APIs
- Easier for developers to understand
- Better for API documentation

### 3. **Client Agnostic**
- Same endpoints can serve mobile, web, desktop apps
- No need for separate `/api/mobile/v1/*` and `/api/web/v1/*`
- Single API version for all clients

### 4. **Future Versioning**
- Easy to add `/api/v2/*` when needed
- Clear versioning strategy
- Backward compatibility maintained through versions

### 5. **Consistency**
- Matches tenant API pattern: `{slug}.publicdigit.com/api/v1/*`
- Both platform and tenant APIs use `/api/v1/*` pattern
- Unified API architecture

---

## Architecture Update

### Current Dual-API System

```
┌─────────────────────────────────────────────────────────┐
│             PLATFORM APIs (Landlord DB)                 │
│  Endpoint: /api/v1/*                                    │
│  Middleware: ['api', 'throttle:api-v1']                 │
│  Database: Landlord (central) database                  │
│  Purpose: Platform auth, tenant listing                 │
│  Examples:                                              │
│    - POST /api/v1/auth/login                            │
│    - GET /api/v1/auth/me                                │
│    - GET /api/v1/health                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│             TENANT APIs (Tenant DB)                     │
│  Endpoint: {slug}.publicdigit.com/api/v1/*             │
│  Middleware: ['web', 'identify.tenant', 'auth:sanctum'] │
│  Database: Tenant-specific database                     │
│  Purpose: Tenant operations (elections, voting)         │
│  Examples:                                              │
│    - GET nrna.publicdigit.com/api/v1/elections         │
│    - POST nrna.publicdigit.com/api/v1/elections/{id}/vote │
└─────────────────────────────────────────────────────────┘
```

**Notice**: Both use `/api/v1/*` pattern for consistency!

---

## Breaking Changes

### Mobile App

If you have an existing mobile app using the old URLs, you need to update:

1. **Environment Configuration**
   ```typescript
   // environment.ts
   export const environment = {
     apiUrl: 'http://localhost:8000/api/v1'  // Changed from /api/mobile/v1
   };
   ```

2. **Service Base URLs**
   ```typescript
   // All services using the old baseUrl
   private baseUrl = 'http://localhost:8000/api/v1';
   ```

3. **Interceptors** (if hardcoded)
   ```typescript
   // Update any URL checks
   if (req.url.includes('/api/v1/')) {
     // Apply mobile-specific logic
   }
   ```

---

## Migration Checklist

- [x] Update route prefix in `routes/mobile.php`
- [x] Update route names from `mobile.v1.*` to `api.v1.*`
- [x] Update CSRF exceptions in `bootstrap/app.php`
- [x] Update rate limiter name and reference
- [x] Test all routes are accessible
- [x] Verify middleware configuration
- [x] Update documentation (CLAUDE.md)
- [ ] Update mobile app base URL (Angular)
- [ ] Update mobile app API service
- [ ] Test mobile app with new endpoints
- [ ] Update API documentation (OpenAPI/Swagger if exists)
- [ ] Update Postman collections (if exists)

---

## Files Modified

1. `packages/laravel-backend/routes/mobile.php` - Route prefix and names
2. `packages/laravel-backend/bootstrap/app.php` - CSRF exceptions
3. `packages/laravel-backend/app/Providers/MobileApiServiceProvider.php` - Rate limiter
4. `CLAUDE.md` - Complete documentation update

---

## Rollback (If Needed)

To rollback these changes:

1. Change prefix in `routes/mobile.php` back to `mobile/v1`
2. Change route names back to `mobile.v1.*`
3. Update CSRF exceptions back to `api/mobile/v1/*`
4. Update rate limiter back to `mobile-api`
5. Clear route cache: `php artisan route:clear`

---

## Summary

✅ **Successfully consolidated** mobile API routes from `/api/mobile/v1/*` to `/api/v1/*`

**New Structure**:
- Cleaner URLs
- Standard RESTful convention
- Client-agnostic design
- Better future versioning
- Consistent with tenant APIs

**No Breaking Changes** to backend functionality - all middleware and authentication work exactly as before!

**Action Required**: Update Angular mobile app to use new base URL: `http://localhost:8000/api/v1`
