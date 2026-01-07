# Branding System Troubleshooting Guide

**Last Updated**: 2026-01-07
**Version**: 1.0
**Difficulty**: Beginner to Advanced

---

## 📋 Table of Contents

1. [Quick Diagnostic Checklist](#quick-diagnostic-checklist)
2. [Common Issues](#common-issues)
3. [API Issues](#api-issues)
4. [Database Issues](#database-issues)
5. [Mobile App Issues](#mobile-app-issues)
6. [Performance Issues](#performance-issues)
7. [Testing Issues](#testing-issues)
8. [Debug Tools](#debug-tools)
9. [Getting Help](#getting-help)

---

## Quick Diagnostic Checklist

Before diving into specific issues, run through this checklist:

```bash
# 1. Routes registered?
php artisan route:list --path=mapi | grep branding

# 2. Database tables exist?
php artisan tinker
> Schema::hasTable('tenant_brandings')
> Schema::hasTable('tenants')

# 3. Test data exists?
> DB::table('tenant_brandings')->count()
> DB::table('tenants')->where('slug', 'nrna')->first()

# 4. Repository binding registered?
> app(App\Contexts\Platform\Domain\Repositories\TenantBrandingRepositoryInterface::class)

# 5. Logs clean?
tail -f storage/logs/laravel.log

# 6. Cache clear?
php artisan config:clear
php artisan cache:clear
php artisan route:clear

# 7. Endpoint works?
curl -X GET "http://localhost:8000/mapi/v1/public/branding/nrna"
```

**Expected Outputs**:
- ✅ Routes: 3 routes (`show`, `css`, `version`)
- ✅ Tables: Both exist, returns `true`
- ✅ Data: At least 1 record in each table
- ✅ Binding: Returns repository instance (no error)
- ✅ Logs: No PHP errors or exceptions
- ✅ Endpoint: Returns JSON with `200 OK` status

---

## Common Issues

### 1. 404 Not Found for Branding Endpoint

**Symptom**:
```http
GET /mapi/v1/public/branding/nrna
→ 404 Not Found
```

#### Cause A: Routes Not Registered

**Check**:
```bash
php artisan route:list --path=mapi
```

**Expected Output**:
```
GET|HEAD  mapi/v1/public/branding/{tenantSlug} ... BrandingController@show
GET|HEAD  mapi/v1/public/branding/{tenantSlug}/css ... BrandingController@css
HEAD|GET  mapi/v1/public/branding/{tenantSlug}/version ... BrandingController@version
```

**Fix if missing**:

1. Verify route file exists:
```bash
ls -l routes/platform-mapi/branding.php
```

2. Verify main.php loads it:
```bash
grep "branding.php" routes/platform-mapi/main.php
```

Expected: `require __DIR__.'/branding.php';`

3. If missing, add to `routes/platform-mapi/main.php` (around line 139):
```php
// Load branding routes
require __DIR__.'/branding.php';
```

4. Clear route cache:
```bash
php artisan route:clear
php artisan route:cache
```

#### Cause B: Middleware Blocking Request

**Check**:
```bash
php artisan route:list --name=public.branding.show --columns=method,uri,middleware
```

**Expected**: Should show `['api', 'throttle:api-v1']` middleware only

**Fix if wrong**:
```php
// routes/platform-mapi/branding.php
// ❌ WRONG
Route::middleware(['auth'])->group(function () {

// ✅ CORRECT (no extra middleware)
Route::prefix('public')->group(function () {
```

#### Cause C: Route Pattern Mismatch

**Check**: URL exactly matches route pattern
```
Route pattern: /mapi/v1/public/branding/{tenantSlug}
Your URL: /mapi/v1/public/branding/nrna
```

**Common mistakes**:
- Missing `/mapi` prefix
- Using `/api` instead of `/mapi`
- Typo in URL (`brandin` instead of `branding`)

---

### 2. Branding Always Returns Defaults (is_default: true)

**Symptom**:
```json
{
  "data": {
    "is_default": true,
    // ... default branding
  }
}
```

Even when custom branding exists in database.

#### Cause A: No Record in Database

**Check**:
```bash
php artisan tinker
> DB::table('tenant_brandings')->where('tenant_slug', 'nrna')->get();
```

**Expected**: Should return at least 1 record

**Fix if empty**:
```php
// Insert test branding
DB::table('tenant_brandings')->insert([
    'tenant_db_id' => 1,
    'tenant_slug' => 'nrna',
    'primary_color' => '#0D47A1',
    'secondary_color' => '#1B5E20',
    'logo_url' => null,
    'font_family' => 'Inter, system-ui, sans-serif',
    'welcome_message' => 'Welcome to NRNA',
    'hero_title' => 'Vote with Confidence',
    'hero_subtitle' => 'Secure, Transparent, Democratic',
    'cta_text' => 'Get Started',
    'organization_name' => 'NRNA',
    'tagline' => 'Excellence in Democracy',
    'favicon_url' => null,
    'wcag_compliant' => true,
    'tier' => 'free',
    'version' => '1.0',
    'created_at' => now(),
    'updated_at' => now(),
]);
```

#### Cause B: Tenant Slug Mismatch

**Check**:
```bash
# Check tenants table
php artisan tinker
> DB::table('tenants')->where('slug', 'nrna')->first();

# Check tenant_brandings table
> DB::table('tenant_brandings')->where('tenant_slug', 'nrna')->first();
```

**Common issues**:
- Case mismatch: `NRNA` vs `nrna`
- Extra spaces: `nrna ` (trailing space)
- Typo in one of the tables

**Fix**:
```sql
-- Update tenant_brandings to match tenants table
UPDATE tenant_brandings
SET tenant_slug = 'nrna'
WHERE tenant_slug = 'NRNA';
```

#### Cause C: Tenant Not Active

**Check**:
```bash
php artisan tinker
> DB::table('tenants')->where('slug', 'nrna')->value('status');
```

**Expected**: Should return `'active'`

**Fix if suspended/inactive**:
```php
DB::table('tenants')->where('slug', 'nrna')->update(['status' => 'active']);
```

#### Cause D: Foreign Key Mismatch

**Check**:
```bash
php artisan tinker
> $tenant = DB::table('tenants')->where('slug', 'nrna')->first();
> $branding = DB::table('tenant_brandings')->where('tenant_slug', 'nrna')->first();
> echo "Tenant numeric_id: " . $tenant->numeric_id;
> echo "Branding tenant_db_id: " . $branding->tenant_db_id;
```

**Expected**: Both should match

**Fix if mismatch**:
```php
DB::table('tenant_brandings')
    ->where('tenant_slug', 'nrna')
    ->update(['tenant_db_id' => $tenant->numeric_id]);
```

---

### 3. 500 Internal Server Error

**Symptom**:
```http
GET /mapi/v1/public/branding/nrna
→ 500 Internal Server Error
```

#### Step 1: Check Laravel Logs

```bash
tail -f storage/logs/laravel.log
```

Common errors and fixes:

##### Error A: Repository Binding Not Found

**Log Error**:
```
Target [App\Contexts\Platform\Domain\Repositories\TenantBrandingRepositoryInterface] is not instantiable.
```

**Fix**: Register binding in service provider

```php
// app/Providers/AppServiceProvider.php or PlatformServiceProvider.php
use App\Contexts\Platform\Domain\Repositories\TenantBrandingRepositoryInterface;
use App\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepository;

public function register(): void
{
    $this->app->bind(
        TenantBrandingRepositoryInterface::class,
        EloquentTenantBrandingRepository::class
    );
}
```

Then clear cache:
```bash
php artisan config:clear
php artisan cache:clear
```

##### Error B: Database Connection Failed

**Log Error**:
```
SQLSTATE[HY000] [2002] Connection refused
```

**Fix**: Check database configuration

```bash
# Check .env file
cat .env | grep DB_

# Expected:
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=publicdigit
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

Test connection:
```bash
php artisan tinker
> DB::connection()->getPdo();
```

##### Error C: Invalid Data in tenant_brandings Table

**Log Error**:
```
Trying to get property 'primary_color' of non-object
```

**Check for NULL or invalid values**:
```sql
SELECT id, tenant_slug, primary_color, secondary_color, logo_url
FROM tenant_brandings
WHERE primary_color IS NULL
   OR secondary_color IS NULL;
```

**Fix NULL values**:
```sql
UPDATE tenant_brandings
SET primary_color = '#1976D2'
WHERE primary_color IS NULL;

UPDATE tenant_brandings
SET secondary_color = '#388E3C'
WHERE secondary_color IS NULL;
```

##### Error D: Method Not Found on Domain Model

**Log Error**:
```
Call to undefined method App\Contexts\Platform\Domain\ValueObjects\BrandingVisuals::getBackgroundColor()
```

**This is a domain model limitation (v1.0)** - the code is calling methods that don't exist.

**Fix**: Use only available methods:
```php
// ❌ WRONG (v1.0 domain model doesn't have these)
$backgroundColor = $visuals->getBackgroundColor();
$textColor = $visuals->getTextColor();

// ✅ CORRECT (use hard-coded defaults)
$backgroundColor = '#FFFFFF';  // Standard accessible default
$textColor = '#212121';        // High contrast
```

---

### 4. CORS Errors in Mobile App

**Symptom**:
```
Access to XMLHttpRequest at 'http://localhost:8000/mapi/v1/public/branding/nrna'
from origin 'capacitor://localhost' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

#### Fix: Configure CORS for Mobile

**1. Install CORS package** (if not already installed):
```bash
composer require fruitcake/laravel-cors
```

**2. Configure CORS** in `config/cors.php`:
```php
return [
    'paths' => ['mapi/*', 'api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'capacitor://localhost',
        'http://localhost:8100',  // Ionic dev server
        'https://localhost:8100', // Ionic dev server (SSL)
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [
        'ETag',
        'X-Offline-TTL',
        'X-Branding-Version',
        'X-Branding-Type',
        'X-CSS-Strategy',
        'Retry-After',
    ],

    'max_age' => 0,

    'supports_credentials' => false,
];
```

**3. Verify middleware** in `bootstrap/app.php` or `app/Http/Kernel.php`:
```php
protected $middleware = [
    // ...
    \Fruitcake\Cors\HandleCors::class,
];
```

**4. Test CORS**:
```bash
curl -X OPTIONS \
  -H "Origin: capacitor://localhost" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:8000/mapi/v1/public/branding/nrna -v
```

Expected headers in response:
```
Access-Control-Allow-Origin: capacitor://localhost
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
```

---

### 5. Payload Size Exceeds 5KB

**Symptom**:
Test `test_mobile_response_payload_is_under_5kb` fails

**Check payload size**:
```bash
curl -X GET "http://localhost:8000/mapi/v1/public/branding/nrna" | wc -c
```

Expected: <5120 bytes (5KB)

#### Cause: Too Much Data in Content Fields

**Check long fields**:
```sql
SELECT
    tenant_slug,
    LENGTH(welcome_message) as welcome_len,
    LENGTH(hero_title) as title_len,
    LENGTH(hero_subtitle) as subtitle_len,
    LENGTH(organization_name) as org_len,
    LENGTH(tagline) as tagline_len
FROM tenant_brandings
WHERE tenant_slug = 'nrna';
```

**Fix**: Truncate long text fields
```sql
UPDATE tenant_brandings
SET welcome_message = LEFT(welcome_message, 200),
    hero_title = LEFT(hero_title, 100),
    hero_subtitle = LEFT(hero_subtitle, 150),
    organization_name = LEFT(organization_name, 100),
    tagline = LEFT(tagline, 100)
WHERE tenant_slug = 'nrna';
```

---

## API Issues

### Invalid Slug Returns 500 Instead of 400

**Symptom**:
```bash
curl -X GET "http://localhost:8000/mapi/v1/public/branding/INVALID_SLUG"
→ 500 Internal Server Error
```

Expected: 400 Bad Request

#### Cause: Exception Not Caught

**Check controller**:
```php
// app/Contexts/Platform/Infrastructure/Http/Controllers/Api/Mobile/BrandingController.php

try {
    $tenantId = TenantId::fromSlug($tenantSlug);
} catch (InvalidTenantException | \InvalidArgumentException $e) {
    return $this->handleError($e, $tenantSlug);
}
```

**Verify exception mapping**:
```php
// app/Contexts/Platform/Infrastructure/Http/Responses/Mobile/ErrorResponse.php

private static function getErrorCode(Throwable $e): string
{
    return match (true) {
        $e instanceof \App\Contexts\Shared\Domain\Exceptions\InvalidTenantException => 'INVALID_INPUT',
        $e instanceof \InvalidArgumentException => 'INVALID_INPUT',
        // ... rest
        default => 'INTERNAL_ERROR',
    };
}
```

**Fix**: Ensure fully qualified namespace is used and exception is caught.

---

### ETag Never Changes

**Symptom**:
```bash
curl -I "http://localhost:8000/mapi/v1/public/branding/nrna"
→ ETag: "abc123"

# Update branding in database
# ...

curl -I "http://localhost:8000/mapi/v1/public/branding/nrna"
→ ETag: "abc123"  # Same!
```

#### Cause: ETag Generation Not Based on Data

**Check**:
```php
// app/Contexts/Platform/Infrastructure/Http/Responses/Mobile/BrandingResponse.php

// ❌ WRONG - Static ETag
$etag = 'v1.0';

// ✅ CORRECT - Data-based ETag
$etag = md5(json_encode($data));
```

**Fix**: Regenerate ETag from actual data
```php
public static function fromBrandingBundle(...): self
{
    // ... build $data array

    // Generate ETag based on actual data
    $etag = md5(json_encode($data));

    return new self($data, $meta, $links, $etag);
}
```

---

## Database Issues

### Migration Fails: Column Already Exists

**Symptom**:
```
SQLSTATE[42701]: Duplicate column: 7 ERROR: column "tagline" already exists
```

#### Fix: Make Migration Idempotent

```php
// migration file
public function up(): void
{
    Schema::table('tenant_brandings', function (Blueprint $table) {
        if (!Schema::hasColumn('tenant_brandings', 'tagline')) {
            $table->string('tagline', 200)->nullable();
        }
    });
}
```

Or rollback and re-run:
```bash
php artisan migrate:rollback --step=1
php artisan migrate
```

---

### Foreign Key Constraint Fails

**Symptom**:
```
SQLSTATE[23503]: Foreign key violation: 7 ERROR: insert or update on table
"tenant_brandings" violates foreign key constraint "tenant_brandings_tenant_db_id_foreign"
```

#### Cause: tenant_db_id Doesn't Match tenants.numeric_id

**Check**:
```sql
SELECT id, slug, numeric_id FROM tenants WHERE slug = 'nrna';
```

**Fix**: Use correct numeric_id when inserting:
```php
$tenant = DB::table('tenants')->where('slug', 'nrna')->first();

DB::table('tenant_brandings')->insert([
    'tenant_db_id' => $tenant->numeric_id,  // ← Use this, not UUID
    'tenant_slug' => 'nrna',
    // ... rest of fields
]);
```

---

## Mobile App Issues

### Branding Not Updating in Mobile App

**Symptom**: Updated branding in database but mobile app still shows old values

#### Cause A: Local Storage Cache

**Fix in mobile app**:
```typescript
// Clear cache
localStorage.removeItem('branding_nrna');

// Or clear all branding
Object.keys(localStorage)
  .filter(key => key.startsWith('branding_'))
  .forEach(key => localStorage.removeItem(key));
```

#### Cause B: HTTP Cache

**Fix in mobile app**:
```typescript
// Force fresh fetch
this.http.get(url, {
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
})
```

#### Cause C: Service Worker Cache

**Fix**: Clear service worker cache
```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}

// Then reload
window.location.reload();
```

---

### CSS Variables Not Applied

**Symptom**: Mobile app shows default colors, not tenant branding

#### Cause A: CSS Not Loaded

**Check**: Inspect DOM in browser DevTools
```html
<!-- Should see -->
<link rel="stylesheet" href="/mapi/v1/public/branding/nrna/css" id="tenant-branding-css">
```

**Fix**:
```typescript
// Ensure CSS is loaded
this.brandingService.applyBrandingCss(tenantSlug);
```

#### Cause B: CSS Variables Not Used in Components

**Check component styles**:
```scss
// ❌ WRONG - Hard-coded color
.primary-button {
  background-color: #1976D2;
}

// ✅ CORRECT - CSS variable
.primary-button {
  background-color: var(--color-primary);
}
```

---

## Performance Issues

### Slow Response Times (>1000ms)

**Symptom**: API takes >1 second to respond

#### Diagnosis

```bash
# Enable query logging
php artisan tinker
> DB::enableQueryLog();

# Make request
> app('App\Contexts\Platform\Infrastructure\Http\Controllers\Api\Mobile\BrandingController')
    ->show('nrna', request());

# Check queries
> DB::getQueryLog();
```

#### Cause A: N+1 Query Problem

**Symptom**: Multiple queries for same data

**Fix**: Eager load relationships
```php
// If using Eloquent relationships
$branding = TenantBranding::with('tenant')->find($id);
```

#### Cause B: Missing Index

**Check**:
```sql
EXPLAIN SELECT * FROM tenant_brandings WHERE tenant_slug = 'nrna';
```

**Fix**: Add index
```php
// migration
Schema::table('tenant_brandings', function (Blueprint $table) {
    $table->index('tenant_slug');
});
```

#### Cause C: No Database Connection Pooling

**Fix**: Configure `max_connections` in PostgreSQL and Laravel
```php
// config/database.php
'pgsql' => [
    // ...
    'pooling' => true,
    'pool_size' => 10,
],
```

---

## Testing Issues

### Tests Fail: Table 'tenant_brandings' doesn't exist

**Symptom**:
```
SQLSTATE[42P01]: Undefined table: 7 ERROR: relation "tenant_brandings" does not exist
```

#### Cause: Test Database Not Migrated

**Fix**:
```php
// tests/Feature/.../BrandingControllerTest.php

protected function setUp(): void
{
    parent::setUp();

    // Set test database connection
    config(['database.default' => 'landlord_test']);

    // Run migrations
    $this->artisan('migrate', [
        '--database' => 'landlord_test',
        '--path' => 'app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord',
        '--force' => true,
    ]);
}
```

Or use `RefreshDatabase` trait:
```php
use Illuminate\Foundation\Testing\RefreshDatabase;

class BrandingControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'landlord_test']);
    }
}
```

---

### Test Expects 400 but Gets 500

**Symptom**:
```
Expected status code 400 but received 500.
```

#### Diagnosis

```php
// Add this to test
$response->dump();  // See full response
$response->assertStatus(400);
```

**Common causes**:
1. Exception not caught properly
2. Wrong exception type
3. ErrorResponse not mapping exception

**Fix**: Check exception handling chain:
```php
// Controller
try {
    $tenantId = TenantId::fromSlug($tenantSlug);
} catch (InvalidTenantException | \InvalidArgumentException $e) {
    return $this->handleError($e, $tenantSlug);  // ← Must catch
}

// ErrorResponse
private static function getErrorCode(Throwable $e): string
{
    return match (true) {
        $e instanceof \App\Contexts\Shared\Domain\Exceptions\InvalidTenantException => 'INVALID_INPUT',  // ← Must map
        // ...
    };
}
```

---

## Debug Tools

### Laravel Telescope

**Install** (development only):
```bash
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate
```

**Access**: http://localhost:8000/telescope

**View**:
- Requests tab: See all API requests
- Queries tab: SQL queries with timing
- Exceptions tab: All thrown exceptions
- Logs tab: Application logs

### Laravel Debugbar

**Install**:
```bash
composer require barryvdh/laravel-debugbar --dev
```

**Usage**: Automatically shows at bottom of page in browser

### API Testing Tools

**Postman**:
```
GET http://localhost:8000/mapi/v1/public/branding/nrna
Headers:
  Accept: application/json
```

**HTTPie**:
```bash
http GET http://localhost:8000/mapi/v1/public/branding/nrna
```

**cURL with verbose output**:
```bash
curl -X GET "http://localhost:8000/mapi/v1/public/branding/nrna" \
  -H "Accept: application/json" \
  -v
```

---

## Getting Help

### Before Asking for Help

1. ✅ Run through [Quick Diagnostic Checklist](#quick-diagnostic-checklist)
2. ✅ Check [Common Issues](#common-issues)
3. ✅ Review Laravel logs: `storage/logs/laravel.log`
4. ✅ Run tests: `php artisan test --filter=BrandingControllerTest`
5. ✅ Clear all caches:
```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

### Information to Provide

When asking for help, include:

```markdown
## Environment
- Laravel version: `php artisan --version`
- PHP version: `php -v`
- Database: PostgreSQL `SELECT version();`
- OS: Windows/Linux/Mac

## Issue
- What you're trying to do
- What you expected
- What actually happened

## Steps to Reproduce
1. Step 1
2. Step 2
3. Error occurs

## Error Messages
```
[paste error from logs]
```

## Code
```php
// Relevant code snippets
```

## What I've Tried
- Thing 1
- Thing 2
```

### Internal Resources

- **[Mobile API Reference](./07_mobile_api_reference.md)** - API specification
- **[Domain Model Guide](./02_domain_model.md)** - Domain layer details
- **[Testing Guide](./04_testing_guide.md)** - Test setup and patterns
- **CLAUDE.md** - Overall system architecture

### External Resources

- **Laravel Documentation**: https://laravel.com/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Ionic Framework**: https://ionicframework.com/docs

---

## Summary

**Most Common Issues**:
1. 404 Not Found → Check route registration
2. Always defaults → Check database records
3. 500 Error → Check Laravel logs for exception
4. CORS errors → Configure `config/cors.php`
5. Tests fail → Check test database migrations

**Quick Fixes**:
```bash
# Clear everything
php artisan config:clear && php artisan cache:clear && php artisan route:clear

# Verify routes
php artisan route:list --path=mapi

# Check database
php artisan tinker
> DB::table('tenant_brandings')->count()

# Run tests
php artisan test --filter=BrandingControllerTest
```

**Remember**: The branding system uses **graceful degradation** - it should NEVER break the mobile app, always returning default branding as fallback.

---

**Last Updated**: 2026-01-07
**Difficulty**: Beginner to Advanced
**Maintainer**: Platform Team
