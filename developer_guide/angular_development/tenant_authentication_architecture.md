# Angular Tenant-First Authentication Architecture
**Last Updated**: 2025-12-02
**Status**: ✅ Implemented
**Complexity**: High - Multi-tenant with Clean Separation

---

## 🎯 **Overview**

This document describes the **tenant-first authentication flow** for the Angular mobile application in a multi-tenant DDD architecture. The authentication requires the user to **select their tenant first**, then authenticate within that tenant's context.

---

## 🏗️ **Architecture Decision: Two Valid Approaches**

### **Approach A: Platform-Level Mobile API** (✅ Currently Implemented)

**URL Pattern**: `/mapi/v1/*` (NO tenant slug in path)
**Tenant Context**: Via session, headers, or subdomain in production

```
Development: http://localhost:8000/mapi/v1/auth/login
Production:  https://nrna.publicdigit.com/mapi/v1/auth/login (subdomain)
```

**Advantages**:
- ✅ Clean URLs
- ✅ Simpler routing
- ✅ Works with reserved routes pattern
- ✅ Tenant context from subdomain in production

**Disadvantages**:
- ❌ Tenant context less explicit in development
- ❌ Requires session/header management

---

### **Approach B: Tenant-Scoped Mobile API** (Alternative)

**URL Pattern**: `/{tenant}/mapi/v1/*` (tenant slug IN path)
**Tenant Context**: Extracted from path by `identify.tenant` middleware

```
Development: http://localhost:8000/nrna/mapi/v1/auth/login
Production:  https://nrna.publicdigit.com/mapi/v1/auth/login (subdomain)
```

**Advantages**:
- ✅ Explicit tenant context in URL
- ✅ `identify.tenant` middleware automatically sets context
- ✅ Clearer debugging

**Disadvantages**:
- ❌ Requires `mapi` NOT to be in reserved routes
- ❌ More complex URL construction
- ❌ Route matching complexity

---

## ✅ **Current Implementation: Approach A (Platform-Level)**

We've chosen **Approach A** for the following reasons:

1. **Cleaner Architecture**: Mobile API is platform-level, tenant context via subdomain
2. **Production Ready**: Matches production subdomain pattern
3. **Reserved Routes**: `mapi` stays in reserved routes for security
4. **Session Management**: Tenant context managed by session after login

---

## 🔄 **Authentication Flow**

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Tenant Selection (Angular)                         │
│ User enters: nrna                                           │
│ App stores: localStorage.setItem('tenant_slug', 'nrna')   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Login Request                                       │
│ POST http://localhost:8000/mapi/v1/auth/login             │
│ Headers:                                                     │
│   - X-Tenant-Slug: nrna (optional, from Angular)          │
│ Body:                                                        │
│   {                                                          │
│     "email": "user@nrna.org",                              │
│     "password": "password",                                │
│     "device_name": "angular-mobile",                       │
│     "tenant_slug": "nrna" (sent in body)                  │
│   }                                                          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Laravel Backend Processing                          │
│ 1. TenantApiController@login receives request              │
│ 2. Extracts tenant_slug from request body/header           │
│ 3. Finds tenant: Tenant::where('slug', 'nrna')->first()   │
│ 4. Switches to tenant database                             │
│ 5. Validates credentials in tenant DB                      │
│ 6. Creates Sanctum token                                   │
│ 7. Stores tenant context in session                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Angular Receives Response                           │
│ Response:                                                    │
│ {                                                            │
│   "token": "1|abc123...",                                  │
│   "user": {                                                 │
│     "id": 1,                                               │
│     "email": "user@nrna.org",                             │
│     "name": "John Doe"                                     │
│   },                                                         │
│   "tenant": {                                               │
│     "slug": "nrna",                                        │
│     "name": "NRNA"                                         │
│   }                                                          │
│ }                                                            │
│                                                              │
│ Angular stores:                                              │
│ - localStorage.setItem('auth_token', token)                │
│ - localStorage.setItem('current_user', JSON.stringify(user))│
│ - localStorage.setItem('tenant_context', JSON.stringify(tenant))│
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Subsequent API Requests                             │
│ GET http://localhost:8000/mapi/v1/elections                │
│ Headers:                                                     │
│   - Authorization: Bearer 1|abc123...                      │
│   - X-Tenant-Slug: nrna (from localStorage)               │
│                                                              │
│ Laravel:                                                     │
│ 1. Validates token via Sanctum                             │
│ 2. Retrieves tenant context from session/header           │
│ 3. Switches to tenant database                             │
│ 4. Returns tenant-specific data                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 **Angular Implementation**

### **1. Environment Configuration**

```typescript
// environment.ts (Development)
function getTenantApiUrl(slug?: string): string {
  // Platform-level mobile API
  // Tenant context via headers/body
  return 'http://localhost:8000/mapi/v1';
}

export const environment = {
  production: false,
  getTenantApiUrl
};
```

```typescript
// environment.prod.ts (Production)
function getTenantApiUrl(slug: string): string {
  // Production uses subdomain
  return `https://${slug}.publicdigit.com/mapi/v1`;
}

export const environment = {
  production: true,
  getTenantApiUrl
};
```

### **2. Auth Service**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  email: string;
  password: string;
  device_name: string;
  tenant_slug: string;  // CRITICAL: Include tenant slug
}

export interface AuthResponse {
  token: string;
  user: User;
  tenant: Tenant;
}

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface Tenant {
  slug: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = environment.getTenantApiUrl();
  private tenantSlugSubject = new BehaviorSubject<string | null>(null);
  private userSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  public tenantSlug$ = this.tenantSlugSubject.asObservable();
  public user$ = this.userSubject.asObservable();
  public isAuthenticated$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    // Restore from localStorage
    const storedSlug = localStorage.getItem('tenant_slug');
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('current_user');

    if (storedSlug) this.tenantSlugSubject.next(storedSlug);
    if (storedToken) this.tokenSubject.next(storedToken);
    if (storedUser) this.userSubject.next(JSON.parse(storedUser));
  }

  /**
   * Step 1: Set tenant slug (before login)
   */
  setTenantSlug(slug: string): void {
    this.tenantSlugSubject.next(slug);
    localStorage.setItem('tenant_slug', slug);
  }

  /**
   * Step 2: Login with tenant context
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    // CRITICAL: Include tenant_slug in request body
    const body = {
      email: credentials.email,
      password: credentials.password,
      device_name: credentials.device_name,
      tenant_slug: credentials.tenant_slug
    };

    // Optional: Also send as header
    const headers = new HttpHeaders({
      'X-Tenant-Slug': credentials.tenant_slug
    });

    return this.http.post<AuthResponse>(
      `${this.baseUrl}/auth/login`,
      body,
      { headers }
    ).pipe(
      tap(response => {
        // Store authentication data
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('current_user', JSON.stringify(response.user));
        localStorage.setItem('tenant_context', JSON.stringify(response.tenant));

        this.tokenSubject.next(response.token);
        this.userSubject.next(response.user);
      })
    );
  }

  /**
   * Get current tenant slug
   */
  getTenantSlug(): string | null {
    return this.tenantSlugSubject.value;
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return this.tokenSubject.value || localStorage.getItem('auth_token');
  }

  /**
   * Logout
   */
  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}).pipe(
      tap(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
        localStorage.removeItem('tenant_context');

        this.tokenSubject.next(null);
        this.userSubject.next(null);
      })
    );
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
```

### **3. HTTP Interceptor**

```typescript
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    const tenantSlug = this.authService.getTenantSlug();

    // Clone request and add headers
    let headers = req.headers;

    // Add Authorization header if token exists
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // Add tenant context header
    if (tenantSlug) {
      headers = headers.set('X-Tenant-Slug', tenantSlug);
    }

    const authReq = req.clone({ headers });
    return next.handle(authReq);
  }
}
```

### **4. Login Component**

```typescript
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html'
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      tenantSlug: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.error = null;

    const { tenantSlug, email, password } = this.loginForm.value;

    // Step 1: Set tenant context
    this.authService.setTenantSlug(tenantSlug);

    // Step 2: Login with tenant context
    this.authService.login({
      email,
      password,
      device_name: 'angular-mobile',
      tenant_slug: tenantSlug
    }).subscribe({
      next: (response) => {
        console.log('Login successful', response);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Login failed';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }
}
```

```html
<!-- login.component.html -->
<div class="login-container">
  <h1>Sign In</h1>

  <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
    <!-- Tenant Slug Input -->
    <div class="form-group">
      <label for="tenantSlug">Organization</label>
      <input
        id="tenantSlug"
        type="text"
        formControlName="tenantSlug"
        placeholder="e.g., nrna"
        [class.error]="loginForm.get('tenantSlug')?.invalid && loginForm.get('tenantSlug')?.touched"
      />
      <small *ngIf="loginForm.get('tenantSlug')?.invalid && loginForm.get('tenantSlug')?.touched">
        Please enter your organization code
      </small>
    </div>

    <!-- Email Input -->
    <div class="form-group">
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        formControlName="email"
        placeholder="your.email@example.com"
        [class.error]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
      />
    </div>

    <!-- Password Input -->
    <div class="form-group">
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        formControlName="password"
        placeholder="••••••••"
        [class.error]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
      />
    </div>

    <!-- Error Message -->
    <div class="error-message" *ngIf="error">
      {{ error }}
    </div>

    <!-- Submit Button -->
    <button
      type="submit"
      [disabled]="loginForm.invalid || loading"
      class="btn-primary"
    >
      {{ loading ? 'Signing in...' : 'Sign In' }}
    </button>
  </form>
</div>
```

---

## 🔧 **Laravel Backend Updates Required**

The `TenantApiController@login` method needs to be updated to handle tenant slug from request:

```php
// app/Http/Controllers/Api/TenantApiController.php
public function login(Request $request): JsonResponse
{
    $validator = Validator::make($request->all(), [
        'email' => 'required|email',
        'password' => 'required|string',
        'device_name' => 'required|string',
        'tenant_slug' => 'required|string',  // ADDED
    ]);

    if ($validator->fails()) {
        return $this->errorResponse(
            'Validation failed',
            422,
            $validator->errors()->toArray()
        );
    }

    // Find tenant
    $tenant = Tenant::where('slug', $request->tenant_slug)
        ->where('status', 'active')
        ->first();

    if (!$tenant) {
        return $this->errorResponse('Organization not found', 404);
    }

    // Set tenant context
    app()->instance('tenant', $tenant);

    // Switch to tenant database
    $this->switchTenantDatabase($tenant);

    // Find user in tenant database
    $user = TenantUser::where('email', $request->email)->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        return $this->errorResponse('Invalid credentials', 401);
    }

    // Create token
    $token = $user->createToken($request->device_name)->plainTextToken;

    // Store tenant context in session
    session(['tenant_slug' => $tenant->slug, 'tenant_id' => $tenant->id]);

    return $this->successResponse([
        'token' => $token,
        'user' => [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
        ],
        'tenant' => [
            'slug' => $tenant->slug,
            'name' => $tenant->name,
        ],
    ]);
}

private function switchTenantDatabase(Tenant $tenant): void
{
    // Implementation depends on your multi-tenancy setup
    config(['database.connections.tenant.database' => $tenant->database_name]);
    DB::purge('tenant');
    DB::reconnect('tenant');
}
```

---

## ✅ **Implementation Checklist**

- [x] Updated environment files to use `/mapi/v1/`
- [ ] Create AuthService with tenant context management
- [ ] Implement login component with tenant slug input
- [ ] Add HTTP interceptors for auth token and tenant headers
- [ ] Update Laravel login controller to handle tenant_slug
- [ ] Implement language detection based on tenant
- [ ] Add route guards for authentication
- [ ] Test complete authentication flow

---

## 🧪 **Testing**

### **Test Plan**

1. **Tenant Selection**
   - User enters tenant slug "nrna"
   - App stores slug in localStorage
   - Slug appears in subsequent requests

2. **Login Flow**
   - POST to `/mapi/v1/auth/login` with tenant_slug
   - Receives token and user data
   - Token stored in localStorage

3. **Authenticated Requests**
   - GET `/mapi/v1/elections` with Bearer token
   - X-Tenant-Slug header included
   - Receives tenant-specific elections

4. **Logout**
   - POST to `/mapi/v1/auth/logout`
   - Clears localStorage
   - Redirects to login

---

## 📚 **Related Documentation**

- [Mobile API Implementation](./mobile_api_implementation.md)
- [Multi-Tenant Architecture](../multitenancy.md)
- [DDD Principles](../ddd_guidelines.md)

---

**Status**: Documentation Complete ✅
**Next Step**: Implement AuthService and Login Component
