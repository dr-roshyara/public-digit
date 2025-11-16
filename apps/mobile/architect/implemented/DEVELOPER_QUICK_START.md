# Multi-Tenant Architecture - Developer Quick Start

**For:** Developers working with the mobile app
**Updated:** November 15, 2025

---

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
cd apps/mobile
npm install
```

### 2. Run Development Server
```bash
npm start
# Visit: http://localhost:4200
```

### 3. Test Login
- **Organization ID:** `nrna`
- **Email:** `test@test.com`
- **Password:** `password123`

---

## 📚 Core Services

### TenantContextService

**Location:** `apps/mobile/src/app/core/services/tenant-context.service.ts`

**Usage:**
```typescript
import { TenantContextService } from '@app/core/services/tenant-context.service';

constructor(private tenantContext: TenantContextService) {}

// Get current tenant slug
const slug = this.tenantContext.getCurrentSlug();

// Set tenant (mobile)
await this.tenantContext.setTenantSlug('nrna');

// Check if tenant available
if (this.tenantContext.hasTenantContext()) {
  // Tenant set
}

// Clear tenant
await this.tenantContext.clearTenant();

// Get as signal (reactive)
const tenantSlug$ = this.tenantContext.tenantSlug$;
```

---

### AuthService

**Location:** `apps/mobile/src/app/core/services/auth.service.ts`

**Usage:**
```typescript
import { AuthService } from '@app/core/services/auth.service';

constructor(private authService: AuthService) {}

// Login with tenant
this.authService.login(
  { email: 'user@example.com', password: 'password' },
  'nrna'  // Optional tenant slug
).subscribe({
  next: (response) => console.log('Logged in:', response),
  error: (error) => console.error('Login failed:', error)
});

// Logout (preserves tenant)
this.authService.logout().subscribe();

// Check authentication
if (this.authService.isAuthenticated()) {
  // User logged in
}

// Get current user
this.authService.getCurrentUser().subscribe(user => {
  console.log('Current user:', user);
});
```

---

## 🔀 HTTP Interceptors

### Interceptor Chain
```
Request
  ↓
1. API Headers Interceptor
   → Content-Type: application/json
   → Accept: application/json
   → X-Requested-With: XMLHttpRequest
  ↓
2. Tenant Interceptor ⭐
   → X-Tenant-Slug: nrna
  ↓
3. Auth Interceptor
   → Authorization: Bearer {token}
  ↓
Backend
```

**No manual header management needed!** All interceptors run automatically.

---

## 🎨 Adding a New Protected Page

### 1. Create Component
```typescript
import { Component } from '@angular/core';
import { TenantContextService } from '@app/core/services/tenant-context.service';
import { ApiService } from '@app/core/services/api.service';

@Component({
  selector: 'app-my-page',
  standalone: true,
  template: `
    <h1>My Tenant Page</h1>
    <p>Current tenant: {{ currentTenant }}</p>
  `
})
export class MyPageComponent {
  currentTenant: string | null;

  constructor(
    private tenantContext: TenantContextService,
    private apiService: ApiService
  ) {
    this.currentTenant = this.tenantContext.getCurrentSlug();
  }

  loadData() {
    // API call will automatically include X-Tenant-Slug header
    this.apiService.getElections().subscribe(data => {
      console.log('Elections:', data);
    });
  }
}
```

### 2. Add Route
```typescript
// app.routes.ts
{
  path: 'my-page',
  component: MyPageComponent,
  canActivate: [authGuard]  // Protect with auth guard
}
```

### 3. That's It!
The TenantInterceptor will automatically add `X-Tenant-Slug` to all API requests from this page.

---

## 🧪 Testing

### Browser Testing
```bash
# No subdomain (shows Organization ID field)
http://localhost:4200

# With subdomain (auto-detects tenant)
# Add to hosts file: 127.0.0.1 nrna.localhost
http://nrna.localhost:4200
```

### Android Emulator Testing
```bash
# Build
nx build mobile --configuration=development

# Sync
cd apps/mobile && npx cap sync android

# Open Android Studio
npx cap open android

# Run on emulator
# Will use: http://10.0.2.2:8000/api/v1
```

### Check Console Logs
```javascript
// Platform detection
🔍 Platform detected: Mobile (Capacitor)

// Tenant loaded
📱 Restored tenant context from storage: nrna

// Header injection
🔀 Tenant Interceptor: Injected X-Tenant-Slug for /api/v1/...

// Login success
✅ Login successful
```

---

## 🐛 Common Issues & Solutions

### Issue: "No tenant context" warning
**Cause:** User hasn't entered organization ID or subdomain not detected

**Solution:**
```typescript
// Check if tenant available before API calls
if (this.tenantContext.hasTenantContext()) {
  // Make API call
} else {
  // Redirect to login or show tenant selection
}
```

### Issue: API returns 404 or tenant not found
**Cause:** Wrong tenant slug or tenant not active

**Solution:**
```typescript
// Verify tenant slug is correct
const slug = this.tenantContext.getCurrentSlug();
console.log('Current tenant:', slug);

// Clear and re-enter if wrong
await this.tenantContext.clearTenant();
```

### Issue: Headers not being added
**Cause:** Interceptor not registered or route doesn't match

**Solution:**
- Check `app.config.ts` has `tenantInterceptor` registered
- Interceptor only works for URLs containing `/api/v1`
- Check console for logs

### Issue: Tenant not persisting on mobile
**Cause:** Capacitor Preferences not working

**Solution:**
```typescript
// Check if Capacitor is available
console.log('Capacitor:', (window as any).Capacitor);

// Manually test storage
import { Preferences } from '@capacitor/preferences';
await Preferences.set({ key: 'test', value: 'hello' });
const { value } = await Preferences.get({ key: 'test' });
console.log('Test value:', value); // Should log 'hello'
```

---

## 📝 Code Snippets

### Check Platform
```typescript
const isMobile = this.tenantContext.isMobile();
if (isMobile) {
  console.log('Running on mobile');
} else {
  console.log('Running in browser');
}
```

### Get Tenant Headers Manually
```typescript
const headers = this.tenantContext.getTenantHeaders();
console.log('Tenant header:', headers.get('X-Tenant-Slug'));
```

### Subscribe to Tenant Changes
```typescript
const tenantSlug$ = this.tenantContext.tenantSlug$;
effect(() => {
  const slug = tenantSlug$();
  console.log('Tenant changed to:', slug);
});
```

### Make API Call with Tenant Context
```typescript
// Option 1: Use ApiService (recommended)
this.apiService.getElections().subscribe(data => {
  // Tenant header automatically included
});

// Option 2: Direct HttpClient (not recommended)
this.http.get('/api/v1/elections').subscribe(data => {
  // Interceptors still run, header included
});
```

---

## 🔑 Environment Variables

### Development (environment.dev.ts)
```typescript
export const environment = {
  production: false,
  apiUrl: getApiUrl(),  // Auto-detected
  // Browser: http://localhost:8000/api/v1
  // Android: http://10.0.2.2:8000/api/v1
};
```

### Production (environment.prod.ts)
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://publicdigit.com/api/v1',
};
```

---

## 📦 Available Services

### Core Services
- `TenantContextService` - Tenant management
- `AuthService` - Authentication
- `ApiService` - API calls

### Interceptors
- `apiHeadersInterceptor` - Base headers
- `tenantInterceptor` - Tenant context
- `authInterceptor` - Authorization

### Models
- `User` - User entity
- `LoginRequest` - Login credentials
- `LoginResponse` - Login result
- `ApiResponse<T>` - Generic API response
- `Tenant` - Tenant entity

---

## 🎯 Best Practices

### DO ✅
- Use `TenantContextService` to get current tenant
- Let interceptors handle headers automatically
- Use TypeScript types from `auth.models.ts`
- Check tenant context before tenant-specific operations
- Use async/await with Capacitor Preferences
- Log important actions for debugging

### DON'T ❌
- Don't manually add `X-Tenant-Slug` header
- Don't use `localStorage` for sensitive data on mobile
- Don't skip tenant context check
- Don't hardcode tenant slugs
- Don't bypass interceptors
- Don't modify tenant context directly

---

## 📞 Need Help?

### Documentation
- **Full Implementation:** `20251115_multi_tenant_architecture_implementation.md`
- **Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Deployment:** `DEPLOYMENT_CHECKLIST.md`

### Code Locations
- **Services:** `apps/mobile/src/app/core/services/`
- **Interceptors:** `apps/mobile/src/app/core/interceptors/`
- **Models:** `apps/mobile/src/app/core/models/`
- **Config:** `apps/mobile/src/app/app.config.ts`

### Common Commands
```bash
# Start dev server
npm start

# Build for development
nx build mobile --configuration=development

# Build for production
nx build mobile --configuration=production

# Sync with Android
npx cap sync android

# Open Android Studio
npx cap open android

# Run tests (if available)
nx test mobile

# Lint code
nx lint mobile
```

---

**Happy Coding! 🚀**
