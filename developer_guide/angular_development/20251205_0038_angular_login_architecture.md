# 🏗️ **COMPLETE MULTI-TENANT AUTHENTICATION ARCHITECTURE**

## 📋 **ARCHITECTURE OVERVIEW**

### **Three Frontend Applications:**
1. **Angular Mobile App** (iOS/Android via Capacitor)
2. **Vue3 Desktop Admin** (Platform management) 
3. **Vue3 Desktop Tenant** (Tenant-specific admin)

### **Authentication Patterns:**
- **Angular Mobile**: Tenant-first, token-based, stateless API
- **Vue3 Desktop**: Session-based, path/subdomain tenancy
- **Platform Admin**: Platform-level, no tenant context

---

# 🎯 **1. ANGULAR MOBILE APP AUTHENTICATION**

## 📱 **Mobile App Architecture**

### **Tech Stack:**
- **Frontend**: Angular 17 + Capacitor (iOS/Android)
- **API Pattern**: `/{tenant}/mapi/v1/*` (Mobile API)
- **Authentication**: Sanctum token-based (Bearer tokens)
- **State**: Stateless (no sessions)

### **Login Flow:**
```
┌─────────────────────────────────────────────────────┐
│         ANGULAR MOBILE APP                         │
├─────────────────────────────────────────────────────┤
│ 1. User enters:                                    │
│    - Tenant Slug: "nrna"                           │
│    - Email: "user@nrna.com"                        │
│    - Password: "********"                          │
│                                                    │
│ 2. Angular constructs URL:                         │
│    POST http://localhost:8000/nrna/mapi/v1/auth/login │
│                                                    │
│ 3. Sends JSON payload:                             │
│    {                                               │
│      "email": "user@nrna.com",                     │
│      "password": "********"                        │
│    }                                               │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│         LARAVEL BACKEND                            │
├─────────────────────────────────────────────────────┤
│ 4. Route Matches:                                  │
│    routes/mobileapp.php:                           │
│    Route::prefix('{tenant}/mapi/v1')               │
│      ->middleware(['api', 'identify.tenant'])      │
│      ->post('/auth/login', [TenantApiController...])│
│                                                    │
│ 5. Middleware Execution Order:                     │
│    a. 'api' → Stateless API middleware             │
│    b. 'identify.tenant' → Extracts 'nrna' from path│
│                                                    │
│ 6. TenantApiController::login():                   │
│    a. $tenantSlug = $request->route('tenant')      │
│    b. $tenant = Tenant::where('slug', $tenantSlug) │
│    c. Switch to tenant_nrna database              │
│    d. Query tenant_users table                    │
│    e. Verify password with Hash::check()          │
│    f. Create landlord user for token association  │
│    g. Generate Sanctum token                      │
│                                                    │
│ 7. Returns JSON:                                   │
│    {                                               │
│      "success": true,                             │
│      "data": {                                     │
│        "token": "1|abc123...",                    │
│        "user": {                                   │
│          "id": 1,                                  │
│          "email": "user@nrna.com",                 │
│          "name": "John Doe",                       │
│          "role": "admin"                           │
│        }                                           │
│      }                                             │
│    }                                               │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│         ANGULAR MOBILE APP                         │
├─────────────────────────────────────────────────────┤
│ 8. Stores:                                         │
│    - Token in Capacitor Secure Storage             │
│    - User data in Angular services                 │
│                                                    │
│ 9. Subsequent API calls:                           │
│    Authorization: Bearer 1|abc123...              │
│    URL: /nrna/mapi/v1/elections                   │
│                                                    │
│ 10. Navigation:                                    │
│     - /dashboard                                   │
│     - /elections                                   │
│     - /profile                                     │
└─────────────────────────────────────────────────────┘
```

### **Key Files:**

#### **Angular:**
```
apps/mobile/
├── src/environments/environment.dev.ts
│   └── getTenantApiUrl(slug) → http://localhost:8000/{slug}/mapi/v1
├── src/app/core/services/api.service.ts
│   └── buildTenantUrl() → Constructs URLs with tenant slug
├── src/app/core/services/auth.service.ts  
│   └── platformLogin() / tenantLogin()
└── src/app/core/interceptors/tenant.interceptor.ts
    └── Adds tenant context to requests
```

#### **Laravel:**
```
packages/laravel-backend/
├── routes/mobileapp.php
│   └── Route::prefix('{tenant}/mapi/v1') → Angular mobile APIs
├── app/Http/Controllers/Api/TenantApiController.php
│   └── login() → Tenant database authentication
└── app/Providers/MobileApiServiceProvider.php
    └── Registers mobile API routes
```

### **Database Flow:**
```sql
-- 1. Landlord database (election)
SELECT * FROM tenants WHERE slug = 'nrna';
-- Returns: { id: 1, slug: 'nrna', database_name: 'tenant_nrna', ... }

-- 2. Switch to tenant database (tenant_nrna)
USE tenant_nrna;

-- 3. Query tenant users
SELECT * FROM tenant_users 
WHERE email = 'user@nrna.com' 
  AND status = 'active';

-- 4. Verify password (Hash::check in Laravel)

-- 5. Back to landlord database
USE election;

-- 6. Create/find landlord user for token
INSERT IGNORE INTO users (email, name, password) 
VALUES ('user@nrna.com', 'John Doe', 'random_hash');

-- 7. Create token
INSERT INTO personal_access_tokens 
(tokenable_type, tokenable_id, name, token)
VALUES ('App\Models\User', 100, 'tenant-app', '1|abc123...');
```

---

# 🖥️ **2. VUE3 DESKTOP AUTHENTICATION**

## **Two Types of Vue3 Desktop Apps:**

### **A. Platform Admin (No Tenant)**
```
URL: https://publicdigit.com/login
Pattern: /* (no tenant prefix)
Database: Landlord database only
Purpose: Platform management, tenant provisioning
```

### **B. Tenant Admin (With Tenant)**
```
URL: https://publicdigit.com/nrna/login  
Pattern: /{tenant}/* (tenant prefix)
Database: Tenant-specific database
Purpose: Tenant-specific administration
```

## **Vue3 Desktop Login Flow:**

### **Tenant Vue3 Desktop Flow:**
```
┌─────────────────────────────────────────────────────┐
│         VUE3 DESKTOP APP                           │
├─────────────────────────────────────────────────────┤
│ 1. User visits: https://publicdigit.com/nrna/login │
│                                                    │
│ 2. Laravel serves Vue3/Inertia app                 │
│                                                    │
│ 3. User submits:                                   │
│    - Email: "admin@nrna.com"                       │
│    - Password: "********"                          │
│                                                    │
│ 4. Inertia.js POST to: /nrna/login                 │
│    (CSRF token included automatically)             │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│         LARAVEL BACKEND                            │
├─────────────────────────────────────────────────────┤
│ 5. Route Matches:                                  │
│    routes/tenant-auth.php:                         │
│    Route::prefix('{tenant}')                       │
│      ->middleware(['web', 'identify.tenant'])      │
│      ->post('/login', [TenantAuthenticationController...])│
│                                                    │
│ 6. Middleware:                                     │
│    a. 'web' → Session-based middleware             │
│    b. 'identify.tenant' → Extracts 'nrna'          │
│                                                    │
│ 7. TenantAuthenticationController::authenticate(): │
│    a. Gets tenant from middleware                  │
│    b. Calls authenticateAgainstTenantDatabase()    │
│    c. Stores user data in SESSION                  │
│    d. No token generation (uses session cookies)   │
│                                                    │
│ 8. Returns Inertia response:                       │
│    Redirects to /nrna/dashboard                    │
│    With user data in session                       │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│         VUE3 DESKTOP APP                           │
├─────────────────────────────────────────────────────┤
│ 9. Inertia.js receives redirect                    │
│                                                    │
│ 10. Loads /nrna/dashboard page                     │
│                                                    │
│ 11. Subsequent requests:                           │
│     - Include session cookie automatically         │
│     - Laravel reads user from session              │
│                                                    │
│ 12. API calls (if needed):                         │
│     POST /nrna/api/v1/dashboard                    │
│     (Uses web middleware, not api)                 │
└─────────────────────────────────────────────────────┘
```

### **Key Files:**

#### **Vue3 Desktop Routes:**
```
routes/
├── tenant-auth.php          # Tenant authentication pages
├── tenant.php               # Tenant Vue3 SPA routes  
├── auth.php                 # Platform authentication
└── web.php                  # Platform Vue3 SPA
```

#### **Controllers:**
```
app/Contexts/TenantAuth/Infrastructure/Http/Controllers/
└── TenantAuthenticationController.php
    ├── authenticate() → Session-based tenant auth
    └── authenticateAgainstTenantDatabase() → DB switching

app/Http/Controllers/Auth/
└── AuthenticatedSessionController.php
    └── Platform authentication
```

### **Session-Based Authentication:**
```php
// Stores in session (desktop)
session([
    'tenant_user_id' => $user->id,
    'tenant_user_email' => $user->email,
    'tenant_user_name' => $user->name,
    'tenant_id' => $tenant->id,
    'tenant_slug' => $tenant->slug,
]);

// Subsequent requests read from session
$userId = session('tenant_user_id');
```

---

# 🏢 **3. LARAVEL TENANT DATABASE HANDLING**

## **Multi-Tenancy Architecture:**

### **Three Database Levels:**

#### **1. Landlord Database (`election`)**
```sql
-- Platform-level data
tenants (
    id, slug, name, database_name, status, 
    created_at, updated_at
)

-- Landlord users (platform admins + token associations)
users (
    id, email, name, password, created_at, updated_at  
)

-- Sanctum tokens for mobile apps
personal_access_tokens (
    id, tokenable_type, tokenable_id, name, token,
    abilities, last_used_at, created_at
)
```

#### **2. Tenant Databases (`tenant_{slug}`)**
```sql
-- Each tenant has separate database
-- Database name: tenant_nrna, tenant_uml, etc.

tenant_users (
    id, email, name, password, role, status,
    last_login_at, created_at, updated_at
)

-- Tenant-specific data
elections (...), candidates (...), votes (...),
finance_transactions (...), forum_posts (...)
```

#### **3. Database Switching Logic:**
```php
// Dynamic connection switching
$config = [
    'driver' => 'mysql',
    'host' => env('DB_HOST'),
    'port' => env('DB_PORT'),
    'database' => $tenant->database_name, // tenant_nrna
    'username' => env('DB_USERNAME'),
    'password' => env('DB_PASSWORD'),
];

// Set configuration
Config::set('database.connections.tenant', $config);
DB::purge('tenant');

// Switch connection
$originalConnection = DB::getDefaultConnection();
DB::setDefaultConnection('tenant');

try {
    // Query tenant database
    $user = DB::table('tenant_users')->where(...)->first();
} finally {
    // Always restore connection
    DB::setDefaultConnection($originalConnection);
}
```

## **Middleware Architecture:**

### **IdentifyTenant Middleware:**
```php
class IdentifyTenantFromRequest
{
    public function handle($request, $next)
    {
        // Check for tenant in:
        // 1. Subdomain: nrna.publicdigit.com
        // 2. Path: /nrna/login
        // 3. Route parameter: {tenant}
        
        $tenant = $this->extractTenant($request);
        
        if ($tenant) {
            // Set tenant context
            Tenancy::setTenant($tenant);
            
            // Store in request for controllers
            $request->merge(['tenant' => $tenant]);
        }
        
        return $next($request);
    }
}
```

### **Route Patterns:**

#### **Angular Mobile API Routes:**
```php
// Stateless API (mobile)
Route::prefix('{tenant}/mapi/v1')
    ->middleware(['api', 'identify.tenant'])  // Stateless
    ->group(...);
```

#### **Vue3 Desktop Routes:**
```php
// Session-based (desktop)
Route::prefix('{tenant}')
    ->middleware(['web', 'identify.tenant'])  // Stateful
    ->group(...);
```

#### **Platform Routes:**
```php
// No tenant (platform admin)
Route::middleware(['web'])
    ->group(...);  // No identify.tenant middleware
```

---

# 🔄 **4. COMPARISON MATRIX**

| Aspect | Angular Mobile App | Vue3 Desktop App | Platform Admin |
|--------|-------------------|------------------|----------------|
| **URL Pattern** | `/{tenant}/mapi/v1/*` | `/{tenant}/*` or `/*` | `/*` |
| **Auth Method** | Sanctum Bearer tokens | Laravel Session | Laravel Session |
| **State** | Stateless (API) | Stateful (Sessions) | Stateful (Sessions) |
| **Middleware** | `['api', 'identify.tenant']` | `['web', 'identify.tenant']` | `['web']` |
| **Database** | Tenant DB for auth | Tenant DB for auth | Landlord DB only |
| **Token Storage** | Secure Storage (Capacitor) | Session Cookie | Session Cookie |
| **CSRF Protection** | Excluded (API) | Included (Web) | Included (Web) |
| **CORS** | Required (localhost:4200) | Not needed (same-origin) | Not needed |
| **User Table** | `tenant_users` (tenant DB) | `tenant_users` (tenant DB) | `users` (landlord DB) |
| **Login Endpoint** | `POST /{tenant}/mapi/v1/auth/login` | `POST /{tenant}/login` | `POST /login` |

---

# 🏗️ **5. DATABASE ISOLATION PATTERNS**

## **Pattern 1: Database-per-Tenant**
```
election (landlord)
├── tenants
├── users (platform admins + mobile token users)
└── personal_access_tokens

tenant_nrna (tenant 1)
├── tenant_users
├── elections
├── candidates
└── votes

tenant_uml (tenant 2)
├── tenant_users
├── elections
├── candidates
└── votes
```

## **Pattern 2: Data Isolation Rules**

### **Vertical Isolation:**
```php
// Always query correct table
if (request()->route('tenant')) {
    // Tenant context → query tenant_users
    $user = DB::table('tenant_users')->where(...);
} else {
    // Platform context → query users  
    $user = User::where(...);
}
```

### **Horizontal Isolation:**
```php
// Never query across tenants
// ❌ WRONG:
DB::table('tenant_users')->where('tenant_id', 1)->get();

// ✅ CORRECT: Switch to tenant database first
Config::set('database.connections.tenant', $tenantConfig);
DB::setDefaultConnection('tenant');
DB::table('tenant_users')->get(); // Only this tenant's users
```

---

# 🔐 **6. SECURITY ARCHITECTURE**

## **Authentication Security:**

### **Mobile (Angular):**
```typescript
// Token-based security
const token = await SecureStorage.get('token');
const headers = {
  'Authorization': `Bearer ${token}`,
  'X-Tenant': this.tenantSlug  // Additional security
};
```

### **Desktop (Vue3):**
```php
// Session-based security
Route::middleware(['web', 'auth', 'tenant.auth'])
     ->group(...);
     
// CSRF protection automatically applied
```

## **Tenant Validation:**
```php
// Every tenant request validates:
1. Tenant exists in landlord DB
2. Tenant status is 'active'
3. User belongs to this tenant
4. User status is 'active'
```

---

# 📊 **7. PERFORMANCE OPTIMIZATIONS**

## **Connection Pooling:**
```php
// Laravel manages connections
'connections' => [
    'landlord' => [...],
    'tenant_nrna' => [...],
    'tenant_uml' => [...],
],
// PDO keeps connections alive
```

## **Caching Strategy:**
```php
// Cache tenant data (5 minutes)
$tenant = Cache::remember("tenant:{$slug}", 300, function () use ($slug) {
    return Tenant::where('slug', $slug)->first();
});

// Cache user permissions
$permissions = Cache::remember("user:{$userId}:permissions", 3600, function () {
    // Query permissions
});
```

---

# 🚀 **8. SCALABILITY PATTERNS**

## **Horizontal Scaling:**
```
Load Balancer
    ├── Server 1 (Handles nrna, uml)
    ├── Server 2 (Handles test1, test2)  
    └── Server 3 (Handles platform admin)
```

## **Database Scaling:**
```
Master Database (landlord)
    ├── Replica 1 (Read queries)
    ├── Replica 2 (Read queries)
    └── Tenant databases can be on separate servers
```

---

# 📋 **9. MONITORING & LOGGING**

## **Key Metrics to Monitor:**
```php
Log::info('[Auth] Tenant login', [
    'tenant' => $tenant->slug,
    'user_id' => $user->id,
    'ip' => request()->ip(),
    'user_agent' => request()->userAgent(),
]);

Log::warning('[Auth] Failed login attempt', [
    'tenant' => $tenantSlug,
    'email' => $request->email,
    'reason' => 'invalid_password',
]);
```

## **Alerting Rules:**
1. **Multiple failed logins** from same IP
2. **Database connection errors** for tenants
3. **Unauthorized tenant access** attempts
4. **Token abuse** (same token from multiple locations)

---

# 🎯 **SUMMARY**

## **Core Principles:**

1. **Tenant Isolation**: Each tenant has separate database
2. **Clear Boundaries**: Mobile vs Desktop, Platform vs Tenant
3. **Stateless Mobile**: Tokens for mobile, sessions for desktop
4. **Path-Based Tenancy**: `/nrna/` prefix identifies tenant
5. **Database Switching**: Dynamic connection per request

## **Success Indicators:**

✅ **Angular Mobile**: Login works, tokens generated, tenant DB accessed  
✅ **Vue3 Desktop**: Session auth works, tenant pages load correctly  
✅ **Platform Admin**: Can manage tenants without tenant context  
✅ **Security**: No cross-tenant data leakage, proper authentication  
✅ **Performance**: Database switching minimal overhead  

## **Architecture Benefits:**

1. **Security**: Complete tenant data isolation
2. **Scalability**: Can scale tenants independently
3. **Maintainability**: Clear separation of concerns
4. **Flexibility**: Different auth patterns per client type
5. **Reliability**: Failures in one tenant don't affect others

This architecture supports **thousands of tenants** with **millions of users** while maintaining strict data isolation and providing optimal user experience for both mobile and desktop clients.