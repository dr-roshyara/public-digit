**NO! STOP!** 🚨 Claude is making a **CRITICAL ERROR**!

Claude is changing the Angular URLs to **REMOVE THE TENANT SLUG**:

```typescript
// WRONG! Claude is doing this:
return 'http://localhost:8000/mapi/v1';  // NO TENANT SLUG!

// CORRECT! Should be this:
return `http://localhost:8000/${slug}/mapi/v1`;  // WITH TENANT SLUG!
```

## 🎯 **THE CORRECT URL PATTERN**

The mobile API routes are defined as:
```php
// In routes/mobileapp.php
Route::prefix('mapi/v1')
    ->middleware(['api', 'identify.tenant'])  // ← NEEDS tenant slug!
    ->group(...);
```

**The `identify.tenant` middleware needs the tenant slug in the path!**

## ✅ **CORRECT ANGULAR URLS**

```typescript
function getTenantApiUrl(slug: string): string {
  const isMobile = !!(window as any).Capacitor;

  if (!isMobile) {
    // Browser development - WITH tenant slug
    return `http://localhost:8000/${slug}/mapi/v1`;
  }

  if (platform === 'android') {
    // Android - WITH tenant slug
    return `http://10.0.2.2:8000/${slug}/mapi/v1`;
  }

  if (platform === 'ios') {
    // iOS - WITH tenant slug
    return `http://localhost:8000/${slug}/mapi/v1`;
  }

  return `http://localhost:8000/${slug}/mapi/v1`;
}
```

## 🚨 **TELL CLAUDE: "NO! DO IT DIFFERENTLY!"**

Click **"3. No, and tell Claude what to do differently"** and say:

```
"NO! You're removing the tenant slug from URLs! That's wrong!

The correct URLs must include the tenant slug:
- FROM: http://localhost:8000/mapi/v1  ❌ WRONG
- TO: http://localhost:8000/nrna/mapi/v1  ✅ CORRECT

Update the function to keep ${slug} in all URLs:

function getTenantApiUrl(slug: string): string {
  // KEEP slug parameter required
  if (!slug) throw new Error('Tenant slug required');
  
  // All URLs must include ${slug}
  return `http://localhost:8000/${slug}/mapi/v1`;
}

Angular must send: POST http://localhost:8000/nrna/mapi/v1/auth/login
Not: POST http://localhost:8000/mapi/v1/auth/login

The identify.tenant middleware needs the tenant slug in the path!"
```

## 📋 **WHY THIS MATTERS**

1. **Tenant identification**: `identify.tenant` middleware extracts `nrna` from `/nrna/mapi/v1/...`
2. **Database switching**: Uses tenant slug to switch to correct tenant DB
3. **Multi-tenancy**: Each tenant has separate data

## 🧪 **TEST THE CORRECT URL**

```bash
# This should work (with tenant slug):
curl -X POST "http://localhost:8000/nrna/mapi/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@nrna.com", "password": "password", "device_name": "angular"}'

# This will fail (no tenant slug):
curl -X POST "http://localhost:8000/mapi/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@nrna.com", "password": "password", "device_name": "angular"}'
```

## 🚀 **CORRECT IMPLEMENTATION**

Claude should:
1. **Keep `${slug}`** in all URLs
2. **Change `/api/v1/` to `/mapi/v1/`** but keep tenant slug
3. **Test with actual tenant slug**

**Reject this edit and tell Claude to keep tenant slugs in URLs!** 🎯