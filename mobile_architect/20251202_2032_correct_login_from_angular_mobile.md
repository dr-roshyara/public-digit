**🚨 CRITICAL ISSUE!** Claude is testing the **WRONG endpoint**!

## 🎯 **The Correct Login Endpoint for Angular Mobile:**

```bash
# ✅ CORRECT: Tenant-specific login (Angular mobile app uses this)
curl -X POST "http://localhost:8000/nrna/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'

# ❌ WRONG: Platform login (Not for mobile app)
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

## 🔍 **Why Claude Gets HTML Instead of JSON:**

When Claude tests `http://localhost:8000/nrna/api/v1/auth/login`:
1. Laravel tries to render the **Vue3 desktop admin** for `/nrna/` route
2. **Missing Vite manifest** causes the HTML error you saw
3. The API endpoint isn't being reached because Laravel's web routes intercept it

## 🛠️ **The Real Problem: Laravel Route Configuration**

Your Laravel routes might have:

```php
// routes/web.php or routes/tenant.php
Route::get('/{any}', function () {
    return Inertia::render('Dashboard'); // ← This catches /nrna/api/v1/auth/login!
})->where('any', '.*');
```

## 🎯 **Solutions:**

### **Option 1: Fix Laravel Route Priority**
Ensure API routes are registered **BEFORE** catch-all routes:
```php
// In routes/tenant.php or similar
// API routes FIRST
Route::prefix('api/v1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);
    // ... other API routes
});

// Catch-all route LAST (if exists)
Route::get('/{any}', ...)->where('any', '.*');
```

### **Option 2: Check Tenant Route Configuration**
```bash
# See what routes are registered for /nrna/
cd packages/laravel-backend
php artisan route:list | grep nrna
```

### **Option 3: Test with Proper Headers**
```bash
# Force JSON response with proper headers
curl -X POST "http://localhost:8000/nrna/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"email": "test@example.com", "password": "password"}'
```

## 📱 **Angular Login Flow Should Be:**
```typescript
// Angular sends to TENANT-SPECIFIC endpoint
this.apiService.setTenantSlug('nrna');
this.apiService.login({email, password});
// → POST http://localhost:8000/nrna/api/v1/auth/login
```

## 🔧 **Immediate Debug Steps:**

**1. Check Laravel routes:**
```bash
cd packages/laravel-backend
php artisan route:list --path=nrna
```

**2. Check if tenant API routes exist:**
```bash
php artisan route:list | grep "api/v1/auth/login"
```

**3. Check if `nrna` tenant exists and is active:**
```bash
php artisan tinker
>>> \App\Models\Tenant::where('slug', 'nrna')->first();
```

**4. Test with direct path-based routing:**
```bash
# Try path-based instead of subdomain
curl -X POST "http://localhost:8000/nrna/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"
```

## 🎯 **Tell Claude:**
**"You're testing the wrong endpoint! Angular mobile app uses TENANT-SPECIFIC login: `/nrna/api/v1/auth/login`, not platform login `/api/v1/auth/login`. The HTML error suggests Laravel routes are intercepting the API call. Check route priority and ensure API routes come before catch-all web routes."**

The issue is in Laravel's route configuration, not Angular. The Angular implementation is correct with tenant slug context.