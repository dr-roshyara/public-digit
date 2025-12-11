# 📱 **Mobile API Endpoints Architecture Documentation**

**Project**: Multi-Tenant Election Platform  
**Backend**: Laravel 12 DDD + Spatie Multitenancy  
**Frontend Desktop**: Vue3 + Inertia.js  
**Frontend Mobile**: Angular 17 + Capacitor  
**Document Version**: 2.0  
**Last Updated**: 2025-12-03  

---

## 🎯 **Architecture Overview**

### **API Layer Separation**

| API Layer | Prefix | Purpose | Middleware | Authentication |
|-----------|--------|---------|------------|----------------|
| **Platform API** | `/api/v1/` | System-level operations | `api` | Sanctum Tokens |
| **Desktop API** | `/nrna/api/v1/` | Tenant admin/desktop | `web` + `auth:sanctum` | Session-based |
| **Mobile API** | `/nrna/mapi/v1/` | Mobile app endpoints | `api` + `identify.tenant` | Sanctum Tokens |

### **URL Patterns**
```
# PLATFORM (Cross-tenant)
https://platform.publicdigit.com/api/v1/...

# TENANT DESKTOP (Vue/Inertia)
https://nrna.publicdigit.com/api/v1/...
  OR
https://publicdigit.com/nrna/api/v1/...

# TENANT MOBILE (Angular)
https://nrna.publicdigit.com/mapi/v1/...
  OR  
https://publicdigit.com/nrna/mapi/v1/...
```

---

## 🏗️ **Directory Structure**

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Api/                    # Platform API Controllers
│   │   │   ├── PlatformController.php
│   │   │   └── HealthController.php
│   │   │
│   │   ├── Mobile/                 # Mobile API Controllers
│   │   │   ├── TenantAuthController.php
│   │   │   ├── ElectionController.php
│   │   │   ├── MembershipController.php
│   │   │   └── FinanceController.php
│   │   │
│   │   └── Web/                    # Web/Inertia Controllers
│   │       ├── DashboardController.php
│   │       └── TenantAuthController.php
│   │
│   └── Middleware/
│       ├── IdentifyTenantFromRequest.php
│       ├── MobileApiMiddleware.php
│       └── TenantContextMiddleware.php
│
routes/
├── web.php           # Platform web routes
├── api.php           # Platform API routes  
├── tenant.php        # Tenant desktop routes (Vue/Inertia)
└── mobileapp.php     # Tenant mobile routes (Angular) ← NEW
```

---

## 📱 **Mobile API Endpoints (`/mapi/v1/`)**

### **Authentication & Profile**
```
POST    /{tenant}/mapi/v1/auth/login
POST    /{tenant}/mapi/v1/auth/logout
GET     /{tenant}/mapi/v1/auth/me
POST    /{tenant}/mapi/v1/auth/refresh

GET     /{tenant}/mapi/v1/profile
PUT     /{tenant}/mapi/v1/profile
POST    /{tenant}/mapi/v1/profile/photo
GET     /{tenant}/mapi/v1/profile/elections
```

### **Election Management**
```
GET     /{tenant}/mapi/v1/elections
GET     /{tenant}/mapi/v1/elections/active
GET     /{tenant}/mapi/v1/elections/{id}
GET     /{tenant}/mapi/v1/elections/{id}/candidates
POST    /{tenant}/mapi/v1/elections/{id}/vote
GET     /{tenant}/mapi/v1/elections/{id}/results
GET     /{tenant}/mapi/v1/elections/{id}/my-vote
```

### **Finance & Transactions**
```
GET     /{tenant}/mapi/v1/finance/transactions
GET     /{tenant}/mapi/v1/finance/balance  
GET     /{tenant}/mapi/v1/finance/payment-methods
```

### **Communication & Notifications**
```
GET     /{tenant}/mapi/v1/forum/posts
GET     /{tenant}/mapi/v1/forum/posts/{id}
POST    /{tenant}/mapi/v1/forum/posts
POST    /{tenant}/mapi/v1/forum/posts/{id}/comments

GET     /{tenant}/mapi/v1/notifications
POST    /{tenant}/mapi/v1/notifications/{id}/read
POST    /{tenant}/mapi/v1/notifications/mark-all-read
POST    /{tenant}/mapi/v1/notifications/devices
```

### **Health & Diagnostics**
```
GET     /{tenant}/mapi/v1/health
GET     /{tenant}/mapi/v1/tenant/info
```

---

## 🔧 **Route Definitions**

### **`routes/mobileapp.php`**
```php
<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Mobile\TenantAuthController;

// Mobile API Routes for Angular
Route::prefix('{tenant}/mapi/v1')
    ->where(['tenant' => '[a-z0-9-_]+'])
    ->middleware(['api', 'identify.tenant'])
    ->name('mobile.api.v1.')
    ->group(function () {
        
        // Public endpoints
        Route::post('/auth/login', [TenantAuthController::class, 'login'])
            ->middleware('throttle:5,1');
        
        // Protected endpoints  
        Route::middleware(['auth:sanctum'])->group(function () {
            Route::post('/auth/logout', [TenantAuthController::class, 'logout']);
            Route::get('/auth/me', [TenantAuthController::class, 'me']);
            
            // Election endpoints
            Route::get('/elections', [ElectionController::class, 'index']);
            Route::post('/elections/{id}/vote', [ElectionController::class, 'vote']);
            
            // ... other endpoints
        });
    });
```

---

## 🛡️ **Middleware Stack**

### **Mobile API Middleware Chain**
```php
// 1. API Middleware (routes/mobileapp.php)
->middleware(['api', 'identify.tenant'])

// 2. Authentication Middleware (within group)
->middleware(['auth:sanctum'])
```

### **Middleware Responsibilities**

| Middleware | Purpose | Mobile API | Desktop API |
|------------|---------|------------|-------------|
| **`api`** | JSON responses, no sessions | ✅ Required | ❌ Not used |
| **`web`** | Session, CSRF, Inertia | ❌ Not used | ✅ Required |
| **`identify.tenant`** | Tenant context extraction | ✅ Required | ✅ Required |
| **`auth:sanctum`** | Token authentication | ✅ Required | ✅ Required |
| **`throttle`** | Rate limiting | ✅ Optional | ✅ Optional |

---

## 🔐 **Authentication Flow**

### **Mobile Authentication (Stateless)**
```
1. Angular → POST /nrna/mapi/v1/auth/login
   Body: {email, password, device_name}
   
2. Laravel → Validate → Create Sanctum token
   Response: {token, user, tenant}
   
3. Angular → Store token → Use in Authorization header
   Header: Authorization: Bearer {token}
   
4. Subsequent requests include token
   Laravel validates via auth:sanctum middleware
```

### **Desktop Authentication (Stateful)**
```
1. Vue → POST /nrna/api/v1/auth/login (via Inertia)
   Body: {email, password}
   
2. Laravel → Validate → Create session
   Response: Inertia redirect
   
3. Browser → Maintains session cookie
   Subsequent requests use session
```

---

## 🗄️ **Database Context Switching**

### **Tenant Identification Logic**
```php
// IdentifyTenantFromRequest Middleware
public function handle($request, $next)
{
    // 1. Extract tenant from route parameter
    $tenantSlug = $request->route('tenant'); // 'nrna'
    
    // 2. Find tenant in database
    $tenant = Tenant::where('slug', $tenantSlug)
        ->where('status', 'active')
        ->first();
    
    // 3. Set tenant context
    if ($tenant) {
        tenancy()->initialize($tenant);
        $request->merge(['tenant' => $tenant]);
    }
    
    return $next($request);
}
```

### **Database Connections**
```php
// config/database.php
'connections' => [
    'tenant' => [
        'driver' => 'mysql',
        'url' => env('DATABASE_URL'),
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '3306'),
        'database' => null, // Set dynamically per tenant
        'username' => env('DB_USERNAME', 'root'),
        'password' => env('DB_PASSWORD', ''),
        // ...
    ],
],
```

---

## 📡 **Request/Response Format**

### **Request Headers**
```http
POST /nrna/mapi/v1/auth/login HTTP/1.1
Host: localhost:8000
Content-Type: application/json
Accept: application/json
Authorization: Bearer {token}  # For protected endpoints

{
    "email": "user@nrna.com",
    "password": "password",
    "device_name": "angular-mobile"
}
```

### **Success Response**
```json
{
    "success": true,
    "data": {
        "token": "sanctum-token-here",
        "user": {
            "id": 1,
            "name": "John Doe",
            "email": "user@nrna.com",
            "roles": ["member"]
        },
        "tenant": {
            "slug": "nrna",
            "name": "NRNA Association"
        }
    },
    "message": "Login successful"
}
```

### **Error Response**
```json
{
    "success": false,
    "data": null,
    "message": "Invalid credentials",
    "errors": {
        "email": ["The provided credentials are incorrect."]
    }
}
```

---

## ⚙️ **Configuration Files**

### **`config/tenant.php`**
```php
return [
    'reserved_routes' => [
        'api',       // Platform APIs
        'mapi',      // Mobile APIs (prevents 'mapi' as tenant slug)
        'platform',  // Platform admin
        'login', 'register', 'admin',
        // ... other reserved routes
    ],
    
    'identification_method' => 'hybrid', // subdomain + path
    'base_domain' => env('TENANT_DOMAIN', 'publicdigit.com'),
];
```

### **`bootstrap/app.php`**
```php
// Route loading order
require base_path('routes/web.php');      // Platform web
require base_path('routes/api.php');      // Platform API  
require base_path('routes/tenant.php');   // Tenant desktop
require base_path('routes/mobileapp.php'); // Tenant mobile ← Loaded LAST
```

---

## 🔄 **CORS Configuration**

### **`config/cors.php`**
```php
return [
    'paths' => ['api/*', 'mapi/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'http://localhost:4200', // Angular dev
        'capacitor://localhost', // Capacitor
        'http://localhost',      // iOS simulator
        'http://10.0.2.2',      // Android emulator
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false, // true for web, false for mobile API
];
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```php
// tests/Feature/Mobile/AuthTest.php
class MobileAuthTest extends TestCase
{
    public function test_mobile_login_returns_token()
    {
        $response = $this->postJson('/nrna/mapi/v1/auth/login', [
            'email' => 'test@nrna.com',
            'password' => 'password',
            'device_name' => 'test-device'
        ]);
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => ['token', 'user', 'tenant'],
                'message'
            ]);
    }
}
```

### **API Testing Commands**
```bash
# Test mobile authentication
curl -X POST "http://localhost:8000/nrna/mapi/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@nrna.com", "password": "password", "device_name": "test"}'

# Test protected endpoint with token
curl -X GET "http://localhost:8000/nrna/mapi/v1/auth/me" \
  -H "Authorization: Bearer {token}"

# Test health endpoint
curl "http://localhost:8000/nrna/mapi/v1/health"
```

---

## 🚀 **Deployment Considerations**

### **Environment Variables**
```env
# Mobile API Configuration
MOBILE_API_PREFIX=mapi/v1
MOBILE_API_RATE_LIMIT=60,1  # 60 requests per minute

# Tenant Configuration
TENANT_DOMAIN=publicdigit.com
TENANT_IDENTIFICATION_METHOD=hybrid

# CORS for Mobile
CORS_ALLOWED_ORIGINS=http://localhost:4200,capacitor://localhost,http://10.0.2.2
```

### **Nginx Configuration**
```nginx
# Mobile API routes
location ~ ^/([a-z0-9-_]+)/mapi/v1 {
    try_files $uri $uri/ /index.php?$query_string;
    
    # Mobile-specific optimizations
    client_max_body_size 10M;  # For photo uploads
    proxy_read_timeout 60s;    # Longer timeout for mobile
}
```

---

## 📊 **Monitoring & Analytics**

### **Logging Structure**
```
# Mobile API logs
app/Contexts/MobileDevice/Infrastructure/Logging/MobileApiLogger.php

# Log format
[2025-12-03 10:30:00] mobile.INFO: Tenant authentication {
    "tenant": "nrna",
    "user_id": 123,
    "endpoint": "/auth/login",
    "device": "angular-mobile",
    "ip": "192.168.1.100",
    "response_time": "150ms"
}
```

### **Metrics to Track**
- API response times by endpoint
- Tenant-specific usage patterns
- Mobile vs desktop authentication rates
- Error rates by mobile platform (iOS/Android/Web)

---

## 🔄 **Versioning Strategy**

### **API Versioning**
```
# Current version
/{tenant}/mapi/v1/*

# Future versions
/{tenant}/mapi/v2/*
/{tenant}/mapi/v3/*
```

### **Backward Compatibility**
```php
// Support multiple versions
Route::prefix('{tenant}/mapi')
    ->group(function () {
        Route::prefix('v1')->group(base_path('routes/mobileapp_v1.php'));
        Route::prefix('v2')->group(base_path('routes/mobileapp_v2.php'));
    });
```

---

## 🎯 **Key Architectural Decisions**

### **1. Separate Mobile API (`/mapi/`)**
- ✅ **Clean separation** from desktop APIs
- ✅ **Different middleware** (api vs web)
- ✅ **Mobile-optimized** responses
- ✅ **No session/cookie** dependencies

### **2. Tenant Slug in Route Parameter**
- ✅ **Explicit tenant identification**
- ✅ **Works with path/subdomain** tenancy
- ✅ **Middleware extracts** tenant context
- ✅ **Database switching** based on slug

### **3. Stateless Authentication**
- ✅ **Sanctum tokens** for mobile
- ✅ **No session storage** required
- ✅ **Device-specific** tokens
- ✅ **Easy token revocation**

### **4. DDD Context Boundaries**
- ✅ **Election** context: voting, candidates, results
- ✅ **Membership** context: profiles, registration
- ✅ **Finance** context: transactions, payments
- ✅ **Communication** context: notifications, forum

---

## 📞 **Support & Troubleshooting**

### **Common Issues & Solutions**

| Issue | Solution |
|-------|----------|
| **404 Route not found** | Check tenant slug exists, `mapi` in reserved routes |
| **Method not allowed** | Check catch-all regex excludes `/mapi/` |
| **Tenant context missing** | Verify `identify.tenant` middleware runs |
| **CORS errors** | Check `config/cors.php` mobile origins |
| **Token authentication fails** | Verify `auth:sanctum` middleware, token in header |

### **Debug Commands**
```bash
# List all mobile routes
php artisan route:list --path=mapi

# Check tenant exists
php artisan tinker
>>> \App\Models\Tenant::where('slug', 'nrna')->first();

# Test middleware flow
php artisan route:clear
php artisan config:clear
```

---

## 📚 **References**

1. **Laravel Sanctum Documentation** - Token-based authentication
2. **Spatie Laravel Multitenancy** - Tenant database switching
3. **Laravel Route Parameters** - Dynamic route segments
4. **Angular HTTP Client** - Mobile API integration
5. **DDD Implementation Guide** - Context boundaries

---

**Document Maintainer**: Platform Architecture Team  
**Review Cycle**: Monthly  
**Next Review**: 2026-01-03