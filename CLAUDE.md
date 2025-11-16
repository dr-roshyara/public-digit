# Public Digit Platform - Multi-Tenant Election System

## Project Overview

A sophisticated **Laravel 12 DDD Multi-Tenant Election Platform** with an **Angular Mobile App**, maintaining strict architectural integrity, tenant isolation, and desktop functionality.

**Version**: Laravel 12.35.1
**Architecture**: Domain-Driven Design (DDD)
**Multi-Tenancy**: Hybrid (Subdomain + Path-based)
**Mobile**: Angular with Capacitor (Nx monorepo)

---

## 🏗️ Complete Architecture

### Dual-API System Architecture

The platform implements a **dual-API architecture** to separate platform-level operations from tenant-specific operations:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM APIs (Landlord DB)                  │
│  Endpoint Pattern: /api/v1/*                             │
│  Middleware: ['api', 'throttle:api-v1']                     │
│  Database: Landlord (central) database only                     │
│  Purpose: Platform auth, tenant listing, app initialization     │
│  Examples:                                                       │
│    - POST /api/v1/auth/login                             │
│    - GET /api/v1/auth/me                                 │
│    - GET /api/v1/health                                  │
│    - GET /api/v1/tenants (user's available tenants)      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    TENANT APIs (Tenant DB)                      │
│  Endpoint Pattern: {slug}.publicdigit.com/api/v1/*             │
│  Middleware: ['web', 'identify.tenant', 'auth:sanctum']         │
│  Database: Tenant-specific database                             │
│  Purpose: All tenant operations (elections, voting, profiles)   │
│  Examples:                                                       │
│    - GET nrna.publicdigit.com/api/v1/elections                 │
│    - POST nrna.publicdigit.com/api/v1/elections/{id}/vote      │
│    - GET nrna.publicdigit.com/api/v1/profile                   │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Architecture (Laravel 12)

```
packages/laravel-backend/
├── app/
│   ├── Contexts/                           # DDD Bounded Contexts
│   │   ├── Platform/
│   │   │   ├── Domain/                     # Business logic
│   │   │   ├── Application/                # Use cases
│   │   │   └── Infrastructure/             # Implementation
│   │   │       ├── Http/
│   │   │       │   ├── Controllers/
│   │   │       │   └── Middleware/
│   │   │       │       └── IdentifyTenantFromRequest.php  # Tenant identification
│   │   │       └── Providers/
│   │   │
│   │   ├── TenantAuth/                     # Multi-tenant authentication
│   │   │   ├── Domain/
│   │   │   │   ├── Entities/Tenant.php
│   │   │   │   └── ValueObjects/
│   │   │   │       ├── TenantSlug.php
│   │   │   │       ├── EmailAddress.php
│   │   │   │       └── TenantStatus.php
│   │   │   ├── Application/
│   │   │   └── Infrastructure/
│   │   │       └── Http/
│   │   │           ├── Controllers/
│   │   │           │   └── MemberProfileController.php
│   │   │           └── Routes/
│   │   │               └── mass-registration.php
│   │   │
│   │   ├── ElectionSetup/                  # Election management
│   │   │   ├── Domain/
│   │   │   ├── Application/
│   │   │   └── Infrastructure/
│   │   │
│   │   ├── MobileDevice/                   # Mobile-specific logic
│   │   │   ├── Domain/
│   │   │   ├── Application/
│   │   │   └── Infrastructure/
│   │   │       └── Http/
│   │   │           └── Controllers/
│   │   │               └── DeviceController.php
│   │   │
│   │   └── Shared/                         # Cross-context utilities
│   │       ├── Domain/
│   │       └── Infrastructure/
│   │           ├── Http/Middleware/
│   │           │   └── TenantAwareSessionMiddleware.php
│   │           └── Providers/
│   │               └── SessionServiceProvider.php
│   │
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── Api/
│   │   │       ├── AuthController.php       # Platform auth
│   │   │       ├── ElectionController.php   # Election API
│   │   │       ├── PlatformController.php   # Platform API
│   │   │       └── Mobile/
│   │   │           └── PushNotificationController.php
│   │   │
│   │   └── Middleware/
│   │       ├── HandleInertiaRequests.php
│   │       ├── SetLocale.php
│   │       └── HandleAppearance.php
│   │
│   ├── Models/
│   │   ├── Tenant.php                       # Tenant Eloquent model
│   │   └── User.php                         # User Eloquent model
│   │
│   ├── Multitenancy/
│   │   └── HybridTenantFinder.php          # Spatie tenant identification
│   │
│   └── Providers/
│       ├── AppServiceProvider.php
│       ├── EventServiceProvider.php
│       ├── ElectionServiceProvider.php
│       ├── TenantAuthServiceProvider.php
│       ├── MobileDeviceServiceProvider.php
│       └── MobileApiServiceProvider.php    # Mobile API routes (CRITICAL)
│
├── bootstrap/
│   ├── app.php                             # Application bootstrap
│   └── providers.php                       # Service provider registration
│
├── config/
│   ├── multitenancy.php                    # Spatie multitenancy config
│   ├── tenant.php                          # Tenant identification config
│   ├── sanctum.php                         # API authentication
│   └── domain.php                          # DDD configuration
│
├── database/
│   ├── migrations/
│   │   ├── landlord/                       # Landlord DB migrations
│   │   └── tenant/                         # Tenant DB migrations
│   │
│   └── seeders/
│
├── resources/
│   ├── js/
│   │   ├── pages/                          # Inertia+Vue3 desktop UI
│   │   └── mobile.ts                       # Mobile app bootstrap
│   │
│   └── views/
│
├── routes/
│   ├── web.php                             # Web routes (desktop UI)
│   ├── api.php                             # General API routes (⚠️ loaded via web.php)
│   ├── mobile.php                          # Mobile API routes (✅ loaded via MobileApiServiceProvider)
│   ├── platform-api.php                    # Platform context routes
│   ├── tenant.php                          # Tenant routes
│   ├── tenant-provisioning.php             # Tenant provisioning
│   ├── setup.php                           # Setup routes
│   ├── auth.php                            # Authentication routes
│   ├── tenant-auth.php                     # Tenant authentication
│   ├── election.php                        # Election routes
│   ├── election-request.php                # Election request routes
│   ├── tenant-applications.php             # Tenant application routes
│   └── console.php                         # Artisan commands
│
└── tests/
    ├── Unit/                               # Unit tests (80%+ coverage)
    ├── Feature/                            # Feature tests
    └── Integration/                        # Integration tests
```

### Frontend Architecture (Angular Mobile)

```
apps/mobile/                                # Angular mobile app
├── src/
│   ├── app/
│   │   ├── auth/                          # Authentication module
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts        # Authentication logic
│   │   │   │   └── platform-api.service.ts # Platform API calls
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts
│   │   │   └── pages/
│   │   │       ├── login/
│   │   │       └── tenant-selection/
│   │   │
│   │   ├── elections/                     # Election features
│   │   │   ├── services/
│   │   │   │   └── tenant-api.service.ts  # Tenant API calls
│   │   │   ├── pages/
│   │   │   │   ├── election-list/
│   │   │   │   ├── election-detail/
│   │   │   │   └── voting/
│   │   │   └── models/
│   │   │
│   │   ├── profile/                       # User management
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │
│   │   └── core/
│   │       ├── services/
│   │       │   ├── api.service.ts         # Base API service
│   │       │   └── storage.service.ts     # Secure storage
│   │       ├── interceptors/
│   │       │   ├── auth.interceptor.ts    # Token injection
│   │       │   └── tenant.interceptor.ts  # Tenant context
│   │       └── guards/
│   │           └── tenant.guard.ts        # Tenant selection guard
│   │
│   ├── assets/
│   ├── environments/
│   │   ├── environment.ts                 # Dev config
│   │   └── environment.prod.ts            # Production config
│   │
│   └── main.ts                            # Mobile-optimized bootstrap
│
├── capacitor.config.ts                    # Native mobile config
├── angular.json                           # Angular configuration
├── tsconfig.json                          # TypeScript configuration
└── package.json                           # Dependencies
```

---

## 🔧 Technical Stack

### Backend
- **Framework**: Laravel 12.35.1
- **PHP**: 8.1+
- **Architecture**: Domain-Driven Design (DDD)
- **Multi-Tenancy**:
  - Spatie Laravel Multitenancy
  - Custom HybridTenantFinder (subdomain + path-based)
- **Authentication**: Laravel Sanctum (stateless tokens)
- **Database**: MySQL (Landlord + Tenant databases)
- **Frontend (Desktop)**: Inertia.js + Vue 3
- **Testing**: PHPUnit (80%+ coverage required)

### Mobile Frontend
- **Framework**: Angular (latest)
- **Monorepo**: Nx
- **State Management**: RxJS reactive patterns
- **API Client**: HttpClient with interceptors
- **Native**: Capacitor for device features
- **Storage**: Capacitor Preferences (secure storage)
- **Testing**: Jest (unit) + Cypress (E2E)

---

## 🎯 Current Status

### ✅ Completed

1. **Multi-Tenancy Fixed** - Mobile API routes now properly excluded from tenant identification
2. **Mobile APIs Working** - `/api/v1/*` returns JSON (not HTML)
3. **MobileApiServiceProvider Registered** - Routes load with correct middleware
4. **Duplicate Routes Removed** - Mobile routes load only once with proper middleware
5. **Sanctum Authentication** - Token-based auth working for mobile APIs
6. **Angular Mobile App** - Bootstrapped with authentication service
7. **Desktop Admin UI** - Fully functional with Inertia + Vue3

### 🚧 In Progress

1. **Angular Mobile App Development** - Implementing dual-API architecture
2. **Tenant Context Switching** - Mobile app tenant selection flow
3. **Election Features** - Mobile voting interface
4. **Push Notifications** - Device registration and notification handling

### 📋 Next Steps

1. **Test Mobile Authentication Flow** - End-to-end testing
2. **Implement Tenant Service** - Angular service for tenant API calls
3. **Election Listing** - Display tenant elections in mobile app
4. **Voting Interface** - Secure mobile voting with business rules
5. **Profile Management** - User profile CRUD operations

---

## 🔐 Multi-Tenancy System

### Tenant Identification Strategies

The system uses **two tenant identification mechanisms**:

#### 1. HybridTenantFinder (Spatie Multitenancy)

**Location**: `packages/laravel-backend/app/Multitenancy/HybridTenantFinder.php`

**Strategies**:
1. **DOMAIN_EXACT**: Exact domain match (production: `nrna.com`)
2. **DOMAIN_SMART**: Slug extraction from `.localhost` domains (local: `nrna.localhost`)
3. **PATH_BASED**: URL path segment extraction (local: `/nrna/...`)

**Reserved Routes** (skipped by tenant finder):
```php
// config/tenant.php - 'reserved_routes'
[
    'api',                    // ✅ Mobile API routes excluded
    'platform', 'health', 'docs',
    'admin', 'login', 'logout', 'register',
    'dashboard', 'settings', 'profile',
    'setup', 'apply-for-tenant', 'tenant-applications',
    'election', 'elections', 'election-request',
    // ... and many more
]
```

#### 2. IdentifyTenantFromRequest Middleware

**Location**: `packages/laravel-backend/app/Contexts/Platform/Infrastructure/Http/Middleware/IdentifyTenantFromRequest.php`

**Responsibilities**:
- Extract tenant slug from subdomain or path
- Check if route is reserved (central/landlord route)
- Find active tenant by slug
- Initialize tenant context (set in container, view, request)
- Skip asset requests (CSS, JS, images)

**Key Methods**:
```php
extractTenantSlug()      // Priority 1: Path, Priority 2: Subdomain
isCentralRoute()         // Check against reserved_routes
findActiveTenant()       // Query landlord DB for active tenant
initializeTenantContext() // Set tenant in app container
isAssetRequest()         // Skip tenant ID for static assets
```

### Reserved Routes Configuration

**File**: `packages/laravel-backend/config/tenant.php`

```php
'reserved_routes' => [
    // Core Platform Routes
    'api',           // ✅ CRITICAL: Excludes /api/v1/*
    'platform',
    'health',
    'docs',

    // Admin Routes
    'admin',

    // Authentication Routes (Landlord)
    'login', 'logout', 'register',
    'forgot-password', 'reset-password',
    'verify-email', 'confirm-password',
    'email', 'auth',

    // Dashboard & User Routes (Landlord)
    'dashboard', 'settings', 'profile',

    // Tenant Management Routes (Landlord)
    'setup', 'apply-for-tenant',
    'tenant-applications', 'tenant-application',
    'tenant-provisioning',

    // Election Management Routes (Landlord)
    'election', 'elections', 'election-request',

    // ... more routes
],

'asset_paths' => [
    'build', 'assets', 'storage', 'vendor',
    'images', '_ignition', '@vite',
],

'asset_extensions' => [
    'css', 'js', 'png', 'jpg', 'jpeg', 'gif',
    'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'map',
],
```

---

## 🔀 Route Loading System

### Bootstrap Configuration

**File**: `packages/laravel-backend/bootstrap/app.php`

```php
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        // ⚠️ NOTE: api.php NOT loaded here (loaded via web.php require)
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Setup routes
            Route::middleware('web')->group(base_path('routes/setup.php'));

            // Tenant routes
            Route::middleware('web')->group(__DIR__.'/../routes/tenant.php');

            // Tenant provisioning routes
            Route::middleware('web')->group(__DIR__.'/../routes/tenant-provisioning.php');

            // Platform Context routes
            Route::group([], __DIR__.'/../routes/platform-api.php');

            // TenantAuth Context routes - Mass Registration
            Route::middleware('web')->group(__DIR__.'/../app/Contexts/TenantAuth/Infrastructure/Http/Routes/mass-registration.php');
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Encrypt cookies except
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // CSRF exceptions for APIs
        $middleware->validateCsrfTokens(except: [
            'api/v1/*',                  // ✅ API v1 excluded
            'api/*',                     // ✅ All API routes excluded
            'sanctum/csrf-cookie',
            'api/election/validate-specification-field',
            'api/elections/*/transitions',
            'api/tenant-slug/*',
            'tenant-provisioning/api/*',
            'api/mass-registration/*'
        ]);

        // IMPORTANT: TenantAwareSessionMiddleware MUST run before StartSession
        $middleware->web(prepend: [
            \App\Contexts\Shared\Infrastructure\Http\Middleware\TenantAwareSessionMiddleware::class,
        ]);

        $middleware->web(append: [
            SetLocale::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            \App\Contexts\Platform\Infrastructure\Http\Middleware\IdentifyTenantFromRequest::class,  // Tenant identification
        ]);

        // Middleware aliases
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'election.context' => \App\Domain\Election\Presentation\Http\Middleware\ElectionContextMiddleware::class,
            'tenant.rbac' => \App\Domain\Election\Presentation\Http\Middleware\TenantRBACMiddleware::class,
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'setup-security-headers' => \App\Http\Middleware\SetupSecurityHeadersMiddleware::class,
            'tenant.subdomain' => \App\Http\Middleware\TenantSubdomainMiddleware::class,
            'throttle.auth' => \App\Contexts\TenantAuth\Infrastructure\Http\Middleware\ThrottleAuthAttempts::class,
            'enhanced.identify.tenant' => \App\Contexts\TenantAuth\Infrastructure\Http\Middleware\EnhancedIdentifyTenant::class,
            'identify.tenant' => \App\Contexts\Platform\Infrastructure\Http\Middleware\IdentifyTenantFromRequest::class,
        ]);
    })
    ->create();
```

### Service Provider Registration

**File**: `packages/laravel-backend/bootstrap/providers.php`

```php
return [
    // Shared Infrastructure - MUST be first for tenant isolation
    App\Contexts\Shared\Infrastructure\Providers\SessionServiceProvider::class,

    // Application Providers
    App\Providers\AppServiceProvider::class,
    App\Providers\EventServiceProvider::class,
    App\Providers\ElectionServiceProvider::class,
    App\Providers\TenantAuthServiceProvider::class,
    App\Providers\MobileDeviceServiceProvider::class,
    App\Providers\MobileApiServiceProvider::class,  // ✅ Mobile API routes
    Spatie\Permission\PermissionServiceProvider::class,
];
```

### Mobile API Service Provider (CRITICAL)

**File**: `packages/laravel-backend/app/Providers/MobileApiServiceProvider.php`

```php
class MobileApiServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->configureRateLimiting();
        $this->mapMobileRoutes();
    }

    protected function configureRateLimiting(): void
    {
        // Mobile API rate limiting
        RateLimiter::for('mobile-api', function (Request $request) {
            return $request->user()
                ? Limit::perMinute(120)->by($request->user()->id)
                : Limit::perMinute(30)->by($request->ip());
        });

        // Strict rate limiting for authentication endpoints
        RateLimiter::for('mobile-auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });
    }

    protected function mapMobileRoutes(): void
    {
        // ✅ CRITICAL: Uses 'api' middleware (NOT 'web')
        Route::middleware(['api', 'throttle:api-v1'])
            ->prefix('api')
            ->group(base_path('routes/mobile.php'));
    }
}
```

### Web Routes (Desktop)

**File**: `packages/laravel-backend/routes/web.php:213`

```php
///////////////////////////////////////////////////////
require __DIR__.'/api.php';           // ⚠️ Loads api.php with 'web' middleware
require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
require __DIR__.'/tenant-auth.php';
require __DIR__.'/election.php';
require __DIR__.'/election-request.php';
require __DIR__.'/tenant-applications.php';
```

**Issue**: `api.php` is loaded via `web.php` which applies 'web' middleware (includes tenant identification). However, this doesn't affect mobile routes because they're now loaded separately via `MobileApiServiceProvider` with 'api' middleware.

### Mobile Routes

**File**: `packages/laravel-backend/routes/mobile.php`

```php
Route::prefix('mobile/v1')->group(function () {

    // ===========================
    // PUBLIC ROUTES
    // ===========================

    Route::get('health', [PlatformController::class, 'health'])
        ->name('api.v1.health');

    Route::post('auth/login', [AuthController::class, 'login'])
        ->name('api.v1.auth.login');

    Route::post('auth/refresh', [AuthController::class, 'refresh'])
        ->name('api.v1.auth.refresh');

    // ===========================
    // PROTECTED ROUTES
    // ===========================

    Route::middleware(['auth:sanctum'])->group(function () {

        // Authentication
        Route::post('auth/logout', [AuthController::class, 'logout'])
            ->name('api.v1.auth.logout');

        Route::get('auth/me', [AuthController::class, 'me'])
            ->name('api.v1.auth.me');

        // Member Profile
        Route::prefix('profile')->group(function () {
            Route::get('/', [MemberProfileController::class, 'show'])
                ->name('api.v1.profile.show');

            Route::put('/', [MemberProfileController::class, 'update'])
                ->name('api.v1.profile.update');

            Route::post('verify', [MemberProfileController::class, 'verify'])
                ->name('api.v1.profile.verify');

            Route::get('elections', [MemberProfileController::class, 'myElections'])
                ->name('api.v1.profile.elections');
        });

        // Elections
        Route::prefix('elections')->group(function () {
            Route::get('/', [ElectionController::class, 'index'])
                ->name('api.v1.elections.index');

            Route::get('active', [ElectionController::class, 'active'])
                ->name('api.v1.elections.active');

            Route::get('{id}', [ElectionController::class, 'show'])
                ->name('api.v1.elections.show');

            Route::post('{id}/vote', [ElectionController::class, 'castVote'])
                ->name('api.v1.elections.vote');

            Route::get('{id}/results', [ElectionController::class, 'results'])
                ->name('api.v1.elections.results');

            Route::get('{id}/candidates', [ElectionController::class, 'candidates'])
                ->name('api.v1.elections.candidates');
        });

        // Platform Stats
        Route::get('stats', [PlatformController::class, 'stats'])
            ->name('api.v1.stats');
    });
});
```

---

## 🔐 Security & Compliance

### Tenant Isolation

**Database Segregation**:
```
landlord (central database)
├── tenants                    # Tenant metadata
├── users                      # Platform users
├── tenant_applications        # Tenant applications
└── permissions               # Platform permissions

tenant_nrna (tenant database)
├── tenant_users              # Tenant-specific users
├── elections                 # Tenant elections
├── candidates                # Election candidates
├── votes                     # Voting records
└── ...                       # Other tenant data
```

**Isolation Rules**:
1. **100% Data Segregation** - No cross-tenant data access
2. **Database Connection Switching** - Automatic per-request based on tenant
3. **Tenant Context Required** - All tenant operations require tenant context
4. **Landlord Operations** - Platform-level operations use landlord DB only
5. **Mobile Platform APIs** - Use landlord DB, no tenant context required

### Authentication & Authorization

**Sanctum Token-Based Authentication**:
```php
// Generate token (login)
$token = $user->createToken('mobile-app')->plainTextToken;

// Validate token (middleware)
Route::middleware(['auth:sanctum'])->group(function () {
    // Protected routes
});

// Token storage (mobile app)
await SecureStorage.set('auth_token', token);
```

**Authorization Levels**:
1. **Platform Level** - Super admin, admin roles (landlord DB)
2. **Tenant Level** - Tenant admin, election chief, voter roles (tenant DB)
3. **Mobile User** - Authenticated user with tenant membership

### Voting Security

**One Vote Per User** (from global instructions):
```php
// Each person can vote only once per election through unique slug
class Vote extends Model
{
    protected $fillable = ['election_id', 'voter_slug', 'candidate_id'];

    // Unique constraint on (election_id, voter_slug)
    public function getUniqueIdentifier(): string
    {
        return $this->voter_slug;
    }
}
```

**Vote Integrity**:
- Unique slug per voter (prevents duplicate voting)
- Vote encryption in transit
- Audit trail in tenant database
- State machine for election lifecycle
- Verification mechanisms

---

## 📱 Mobile App Integration Guide

### Dual-API Service Architecture

**Platform Service** (Landlord DB):

```typescript
// src/app/core/services/platform-api.service.ts
@Injectable({ providedIn: 'root' })
export class PlatformApiService {
  private baseUrl = 'http://localhost:8000/api/v1';

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.baseUrl}/auth/login`,
      credentials
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/auth/me`);
  }

  getUserTenants(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(`${this.baseUrl}/tenants`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {});
  }
}
```

**Tenant Service** (Tenant DB):

```typescript
// src/app/core/services/tenant-api.service.ts
@Injectable({ providedIn: 'root' })
export class TenantApiService {
  private currentTenant$ = new BehaviorSubject<Tenant | null>(null);

  private get baseUrl(): string {
    const tenant = this.currentTenant$.value;
    if (!tenant) throw new Error('No tenant selected');
    return `https://${tenant.slug}.publicdigit.com/api/v1`;
  }

  setTenant(tenant: Tenant): void {
    this.currentTenant$.next(tenant);
  }

  getElections(): Observable<Election[]> {
    return this.http.get<Election[]>(`${this.baseUrl}/elections`);
  }

  getElectionDetails(id: number): Observable<Election> {
    return this.http.get<Election>(`${this.baseUrl}/elections/${id}`);
  }

  castVote(electionId: number, vote: VoteRequest): Observable<VoteResponse> {
    return this.http.post<VoteResponse>(
      `${this.baseUrl}/elections/${electionId}/vote`,
      vote
    );
  }

  getProfile(): Observable<Profile> {
    return this.http.get<Profile>(`${this.baseUrl}/profile`);
  }
}
```

### Authentication Flow

```typescript
// 1. User Login (Platform API)
platformApi.login({ email, password })
  .subscribe(response => {
    // Store token
    storage.set('auth_token', response.token);

    // Get user info
    platformApi.getCurrentUser()
      .subscribe(user => {
        // Get user's tenants
        platformApi.getUserTenants()
          .subscribe(tenants => {
            // Show tenant selection
            if (tenants.length === 1) {
              selectTenant(tenants[0]);
            } else {
              showTenantSelection(tenants);
            }
          });
      });
  });

// 2. Tenant Selection
function selectTenant(tenant: Tenant): void {
  // Set tenant in service
  tenantApi.setTenant(tenant);

  // Store tenant context
  storage.set('current_tenant', tenant);

  // Navigate to dashboard
  router.navigate(['/dashboard']);
}

// 3. Access Tenant Resources
tenantApi.getElections()
  .subscribe(elections => {
    // Display elections
  });
```

### HTTP Interceptors

**Auth Interceptor** (Token Injection):

```typescript
// src/app/core/interceptors/auth.interceptor.ts
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = storage.get('auth_token');

    if (token) {
      const cloned = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      return next.handle(cloned);
    }

    return next.handle(req);
  }
}
```

**Tenant Interceptor** (Tenant Context):

```typescript
// src/app/core/interceptors/tenant.interceptor.ts
@Injectable()
export class TenantInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only for tenant API calls
    if (req.url.includes('.publicdigit.com')) {
      const tenant = storage.get('current_tenant');

      if (tenant) {
        const cloned = req.clone({
          headers: req.headers.set('X-Tenant-ID', tenant.id.toString())
        });
        return next.handle(cloned);
      }
    }

    return next.handle(req);
  }
}
```

---

## 🧪 Testing Strategy

### Backend Testing

**Unit Tests** (80%+ coverage required):
```php
// tests/Unit/TenantAuth/TenantSlugTest.php
class TenantSlugTest extends TestCase
{
    /** @test */
    public function it_creates_valid_tenant_slug(): void
    {
        $slug = TenantSlug::fromString('nrna');

        $this->assertEquals('nrna', $slug->toString());
    }

    /** @test */
    public function it_throws_exception_for_reserved_slug(): void
    {
        $this->expectException(InvalidTenantSlugException::class);

        TenantSlug::fromString('admin');  // Reserved slug
    }
}
```

**Feature Tests** (API endpoints with tenant context):
```php
// tests/Feature/Mobile/AuthenticationTest.php
class AuthenticationTest extends TestCase
{
    /** @test */
    public function mobile_user_can_login(): void
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('password'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email'],
            ]);
    }

    /** @test */
    public function mobile_user_can_access_protected_endpoint(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile-app')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJson([
                'id' => $user->id,
                'email' => $user->email,
            ]);
    }
}
```

**Tenant Isolation Tests**:
```php
// tests/Feature/TenantIsolationTest.php
class TenantIsolationTest extends TestCase
{
    /** @test */
    public function tenant_cannot_access_another_tenants_data(): void
    {
        $tenant1 = Tenant::factory()->create(['slug' => 'tenant1']);
        $tenant2 = Tenant::factory()->create(['slug' => 'tenant2']);

        // Create data for tenant1
        $this->actingAsTenant($tenant1);
        $election1 = Election::create([...]);

        // Try to access from tenant2
        $this->actingAsTenant($tenant2);
        $this->assertDatabaseMissing('elections', ['id' => $election1->id]);
    }
}
```

### Mobile Testing

**Unit Tests** (Services):
```typescript
// src/app/core/services/platform-api.service.spec.ts
describe('PlatformApiService', () => {
  let service: PlatformApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PlatformApiService]
    });

    service = TestBed.inject(PlatformApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should login user', () => {
    const credentials = { email: 'test@example.com', password: 'password' };
    const mockResponse = { token: 'abc123', user: { id: 1, name: 'Test' } };

    service.login(credentials).subscribe(response => {
      expect(response.token).toBe('abc123');
      expect(response.user.id).toBe(1);
    });

    const req = httpMock.expectOne('http://localhost:8000/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
```

**E2E Tests** (Cypress):
```typescript
// cypress/e2e/authentication.cy.ts
describe('Authentication Flow', () => {
  it('should login and select tenant', () => {
    cy.visit('/login');

    cy.get('[data-cy=email]').type('test@example.com');
    cy.get('[data-cy=password]').type('password');
    cy.get('[data-cy=login-button]').click();

    // Should show tenant selection
    cy.get('[data-cy=tenant-list]').should('exist');
    cy.get('[data-cy=tenant-item]').first().click();

    // Should navigate to dashboard
    cy.url().should('include', '/dashboard');
    cy.get('[data-cy=elections-list]').should('exist');
  });
});
```

---

## 📚 API Documentation

### Platform APIs (Mobile)

#### Authentication

**POST /api/v1/auth/login**
```json
Request:
{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "token": "1|abc123...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**GET /api/v1/auth/me**
```json
Headers:
{
  "Authorization": "Bearer 1|abc123..."
}

Response:
{
  "id": 1,
  "name": "John Doe",
  "email": "user@example.com",
  "tenants": [
    {
      "id": 1,
      "slug": "nrna",
      "name": "NRNA",
      "role": "voter"
    }
  ]
}
```

**POST /api/v1/auth/logout**
```json
Headers:
{
  "Authorization": "Bearer 1|abc123..."
}

Response:
{
  "message": "Logged out successfully"
}
```

#### Health Check

**GET /api/v1/health**
```json
Response:
{
  "status": "ok",
  "service": "mobile-api",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Tenant APIs

#### Elections

**GET {slug}.publicdigit.com/api/v1/elections**
```json
Headers:
{
  "Authorization": "Bearer 1|abc123..."
}

Response:
{
  "data": [
    {
      "id": 1,
      "title": "Board Election 2024",
      "status": "active",
      "start_date": "2024-01-15",
      "end_date": "2024-01-20",
      "candidates_count": 5
    }
  ]
}
```

**POST {slug}.publicdigit.com/api/v1/elections/{id}/vote**
```json
Headers:
{
  "Authorization": "Bearer 1|abc123..."
}

Request:
{
  "candidate_id": 3,
  "voter_slug": "unique-voter-identifier"
}

Response:
{
  "message": "Vote cast successfully",
  "vote_id": "encrypted-vote-id"
}
```

---

## 🔑 Key Architectural Principles

### 1. DO NOT MOVE LARAVEL BACKEND
Keep everything in `packages/laravel-backend/`. The mobile app is a **new client**, not a replacement.

### 2. MAINTAIN DDD PATTERNS
- Use existing bounded contexts (Platform, TenantAuth, ElectionSetup, MobileDevice, Shared)
- Value Objects instead of primitives
- Domain events for cross-context communication
- Repository pattern for data access
- Service layer for business logic

### 3. TENANT ISOLATION (100%)
- **Never** allow cross-tenant data access
- **Always** validate tenant context
- **Use** database connection switching
- **Enforce** at middleware and application layers

### 4. DUAL-API ARCHITECTURE
- **Platform APIs** (`/api/v1/*`) → Landlord DB
- **Tenant APIs** (`{slug}.publicdigit.com/api/v1/*`) → Tenant DB
- **Clear separation** of concerns

### 5. SECURITY FIRST
- All changes must preserve security posture
- 80%+ test coverage mandatory
- No security vulnerabilities (XSS, SQL injection, CSRF, etc.)
- Secure token storage on mobile devices

### 6. MOBILE IS ADDITIVE
- Desktop admin UI continues to work exactly as before
- Mobile app uses the same Laravel backend
- No breaking changes to existing functionality

---

## 🚀 Development Workflow

### 1. Understanding Context
- Read existing DDD contexts before making changes
- Review bounded context documentation
- Understand domain logic and business rules

### 2. Test-Driven Development
- Write failing tests first (red-green-refactor)
- Maintain 80%+ test coverage
- Test tenant isolation thoroughly

### 3. Follow Patterns
- Use existing Value Objects, Events, and Services
- Follow established naming conventions
- Maintain DDD structure

### 4. Validate Tenant Isolation
- Test cross-tenant data access prevention
- Verify database connection switching
- Ensure no tenant context leakage

### 5. Document Changes
- Update relevant documentation
- Add comments for complex logic
- Document API changes

### 6. Code Review
- Ensure DDD compliance
- Verify security requirements
- Check test coverage

---

## 🛠️ Common Commands

### Backend (Laravel)

```bash
# Navigate to backend
cd packages/laravel-backend

# Clear caches
php artisan route:clear
php artisan config:clear
php artisan cache:clear

# List routes
php artisan route:list
php artisan route:list --path=api/mobile

# Run tests
php artisan test
php artisan test --filter AuthenticationTest

# Database
php artisan migrate
php artisan migrate:fresh --seed

# Tenant operations
php artisan tenant:list
php artisan tenant:artisan 1 migrate
```

### Mobile (Angular)

```bash
# Navigate to mobile app
cd apps/mobile

# Install dependencies
npm install

# Run development server
npm start

# Build for production
npm run build

# Run tests
npm test
npm run test:e2e

# Generate component
nx generate @nx/angular:component --name=my-component --project=mobile
```

---

## 📝 Important File Locations

### Configuration Files
- `packages/laravel-backend/config/tenant.php` - Tenant configuration & reserved routes
- `packages/laravel-backend/config/multitenancy.php` - Spatie multitenancy config
- `packages/laravel-backend/config/sanctum.php` - API authentication config
- `packages/laravel-backend/bootstrap/app.php` - Application bootstrap & middleware
- `packages/laravel-backend/bootstrap/providers.php` - Service provider registration

### Tenant Identification
- `packages/laravel-backend/app/Multitenancy/HybridTenantFinder.php` - Spatie tenant finder
- `packages/laravel-backend/app/Contexts/Platform/Infrastructure/Http/Middleware/IdentifyTenantFromRequest.php` - Custom middleware

### Mobile API
- `packages/laravel-backend/app/Providers/MobileApiServiceProvider.php` - Mobile route provider
- `packages/laravel-backend/routes/mobile.php` - Mobile API routes
- `packages/laravel-backend/app/Http/Controllers/Api/` - API controllers

### DDD Contexts
- `packages/laravel-backend/app/Contexts/Platform/` - Platform context
- `packages/laravel-backend/app/Contexts/TenantAuth/` - Tenant authentication
- `packages/laravel-backend/app/Contexts/ElectionSetup/` - Election management
- `packages/laravel-backend/app/Contexts/MobileDevice/` - Mobile device management
- `packages/laravel-backend/app/Contexts/Shared/` - Shared utilities

---

## 🎯 Next Steps

### Immediate (Sprint 1)
1. ✅ Test mobile authentication flow end-to-end
2. ✅ Verify protected endpoints return JSON
3. ⏳ Implement Angular dual-API service architecture
4. ⏳ Build tenant selection UI
5. ⏳ Test election listing from mobile app

### Short-term (Sprint 2-3)
1. Full election participation workflow
2. Mobile voting interface with security rules
3. Profile management (CRUD operations)
4. Push notification implementation
5. Offline capability for election data

### Long-term
1. Feature parity with desktop for mobile use cases
2. Comprehensive API documentation (OpenAPI/Swagger)
3. Performance optimization and caching
4. Analytics and monitoring
5. App store deployment (Android/iOS)

---

## 🔗 References

- **Laravel Documentation**: https://laravel.com/docs/12.x
- **Spatie Multitenancy**: https://spatie.be/docs/laravel-multitenancy
- **Laravel Sanctum**: https://laravel.com/docs/12.x/sanctum
- **Angular Documentation**: https://angular.io/docs
- **Nx Monorepo**: https://nx.dev
- **Capacitor**: https://capacitorjs.com

---

## 📞 Support

For questions or issues:
1. Check existing documentation in `packages/laravel-backend/developer_guide/`
2. Review architecture documents in `packages/laravel-backend/architect/`
3. Consult DDD context documentation in respective context folders
4. Review mobile implementation docs in `packages/laravel-backend/developer_guide/mobile_application/`

---

**Last Updated**: 2025-01-14
**Laravel Version**: 12.35.1
**Status**: Multi-tenancy fix complete ✅, Mobile app development in progress 🚧
