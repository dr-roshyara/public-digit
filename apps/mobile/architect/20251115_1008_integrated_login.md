## 🚀 **PROFESSIONAL IMPLEMENTATION INSTRUCTIONS FOR CLAUDE CLI**

### **PROJECT: Multi-Tenant Election Platform Mobile App**

---

## **🎯 EXECUTIVE SUMMARY**

Implement a **single API endpoint multi-tenant architecture** for an Angular mobile application that seamlessly handles both web/desktop and mobile platforms using context-aware tenant resolution.

---

## **🏗️ ARCHITECTURAL SPECIFICATION**

### **CORE PRINCIPLES**
- **Single API Endpoint**: `http://10.0.2.2:8000/api/v1/` for all operations
- **Context Detection**: Automatic tenant resolution via subdomain (web) or headers (mobile)
- **Unified Authentication**: Same login flow across all platforms
- **Persistent Context**: Tenant slug persistence across app sessions

### **TECHNICAL STACK**
- **Frontend**: Angular 17+ (Standalone Components)
- **Backend**: Laravel 12 (Existing - DO NOT MODIFY)
- **Mobile**: Capacitor for Android
- **Storage**: Secure persistent storage for tenant context

---

## **📱 IMPLEMENTATION REQUIREMENTS**

### **1. ENVIRONMENT CONFIGURATION**

**File**: `apps/mobile/src/environments/environment.ts`
```typescript
export const environment = {
  production: false,
  // Single API endpoint for all operations
  apiUrl: 'http://10.0.2.2:8000/api/v1',
  // Web-specific configuration
  web: {
    useSubdomainDetection: true
  },
  // Mobile-specific configuration  
  mobile: {
    useHeaderBasedTenancy: true
  }
};
```

### **2. TENANT CONTEXT SERVICE**

**Create**: `apps/mobile/src/app/core/services/tenant-context.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private currentTenantSlug = signal<string | null>(null);
  private isMobileApp = false;

  constructor() {
    this.detectPlatform();
    this.initializeFromStorage();
  }

  /**
   * Detect platform and initialize tenant context
   */
  private detectPlatform() {
    this.isMobileApp = this.isRunningInMobileApp();
  }

  /**
   * WEB: Extract tenant slug from subdomain
   * Example: uml.localhost:4200 → returns 'uml'
   */
  detectFromSubdomain(): string | null {
    if (this.isMobileApp) return null;
    
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Skip if localhost or no subdomain present
    if (parts.includes('localhost') || parts.length <= 2) {
      return null;
    }
    
    return parts[0];
  }

  /**
   * MOBILE: Set tenant slug from user input
   */
  setTenantSlug(slug: string): void {
    this.currentTenantSlug.set(slug);
    this.storeInSecureStorage(slug);
  }

  /**
   * Get HTTP headers for current tenant context
   */
  getTenantHeaders(): HttpHeaders {
    let slug: string | null = null;

    if (this.isMobileApp) {
      // Mobile: Use stored slug
      slug = this.currentTenantSlug();
    } else {
      // Web: Use subdomain detection
      slug = this.detectFromSubdomain();
    }

    return slug ? new HttpHeaders({ 'X-Tenant-Slug': slug }) : new HttpHeaders();
  }

  /**
   * Check if tenant context is available
   */
  hasTenantContext(): boolean {
    return !!this.getCurrentSlug();
  }

  /**
   * Get current tenant slug
   */
  getCurrentSlug(): string | null {
    return this.isMobileApp ? 
      this.currentTenantSlug() : 
      this.detectFromSubdomain();
  }

  /**
   * Clear tenant context (for logout or tenant switching)
   */
  clearTenant(): void {
    this.currentTenantSlug.set(null);
    this.clearSecureStorage();
  }

  // Private methods for secure storage
  private async initializeFromStorage() {
    if (this.isMobileApp) {
      const savedSlug = await this.getStoredSlug();
      this.currentTenantSlug.set(savedSlug);
    }
  }

  private async storeInSecureStorage(slug: string): Promise<void> {
    // Implement using @capacitor/preferences
  }

  private async getStoredSlug(): Promise<string | null> {
    // Implement using @capacitor/preferences
    return null;
  }

  private async clearSecureStorage(): Promise<void> {
    // Implement using @capacitor/preferences
  }

  private isRunningInMobileApp(): boolean {
    // Detect if running in Capacitor mobile app
    return !!(window as any).capacitor;
  }
}
```

### **3. TENANT HTTP INTERCEPTOR**

**Create**: `apps/mobile/src/app/core/interceptors/tenant.interceptor.ts`

```typescript
@Injectable()
export class TenantInterceptor implements HttpInterceptor {
  
  constructor(private tenantContext: TenantContextService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only intercept API calls to our backend
    if (!req.url.includes(environment.apiUrl)) {
      return next.handle(req);
    }

    // Add tenant headers to all API requests
    const tenantHeaders = this.tenantContext.getTenantHeaders();
    
    const clonedReq = req.clone({
      headers: tenantHeaders
    });

    return next.handle(clonedReq);
  }
}
```

### **4. AUTHENTICATION SERVICE**

**Update**: `apps/mobile/src/app/core/services/auth.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  
  constructor(
    private http: HttpClient,
    private tenantContext: TenantContextService,
    private router: Router
  ) {}

  /**
   * Unified login method for both web and mobile
   */
  login(credentials: { email: string; password: string }, tenantSlug?: string): Observable<LoginResponse> {
    // Set tenant context if provided (mobile scenario)
    if (tenantSlug) {
      this.tenantContext.setTenantSlug(tenantSlug);
    }

    return this.http.post<LoginResponse>(
      `${environment.apiUrl}/auth/login`,
      credentials
    ).pipe(
      tap(response => {
        this.handleSuccessfulLogin(response);
      }),
      catchError(error => this.handleLoginError(error))
    );
  }

  /**
   * Check if user is already authenticated
   */
  isAuthenticated(): Observable<boolean> {
    return this.http.get<{ authenticated: boolean }>(
      `${environment.apiUrl}/auth/check`
    ).pipe(
      map(response => response.authenticated),
      catchError(() => of(false))
    );
  }

  /**
   * Logout - clear auth token but preserve tenant context
   */
  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, {}).pipe(
      tap(() => {
        this.clearAuthToken();
        // NOTE: Tenant context is preserved for next login
        this.router.navigate(['/login']);
      })
    );
  }

  private handleSuccessfulLogin(response: LoginResponse): void {
    this.storeAuthToken(response.token);
    
    // Navigate based on platform and tenant context
    if (this.tenantContext.hasTenantContext()) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/tenant-selection']);
    }
  }

  private handleLoginError(error: any): Observable<never> {
    // Clear tenant context on auth failure
    this.tenantContext.clearTenant();
    return throwError(() => error);
  }

  private storeAuthToken(token: string): void {
    // Implement secure token storage
  }

  private clearAuthToken(): void {
    // Implement token clearance
  }
}
```

### **5. LOGIN COMPONENT**

**Create**: `apps/mobile/src/app/auth/login/login.component.ts`

```typescript
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="login-container">
      <h2>Login to PublicDigit</h2>
      
      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
        <!-- Tenant Slug Input (shown only when no subdomain detected) -->
        <div class="form-group" *ngIf="showTenantInput">
          <label for="tenantSlug">Organization ID</label>
          <input
            id="tenantSlug"
            type="text"
            formControlName="tenantSlug"
            placeholder="Enter your organization ID"
            class="form-input"
          />
          <div class="error" *ngIf="loginForm.get('tenantSlug')?.invalid && loginForm.get('tenantSlug')?.touched">
            Organization ID is required
          </div>
        </div>

        <!-- Email Input -->
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            formControlName="email"
            placeholder="Enter your email"
            class="form-input"
          />
          <div class="error" *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched">
            Valid email is required
          </div>
        </div>

        <!-- Password Input -->
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            formControlName="password"
            placeholder="Enter your password"
            class="form-input"
          />
          <div class="error" *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched">
            Password is required
          </div>
        </div>

        <button 
          type="submit" 
          class="login-btn"
          [disabled]="loginForm.invalid || isLoading"
        >
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>

        <div class="error-message" *ngIf="error">
          {{ error }}
        </div>
      </form>

      <div class="login-info" *ngIf="!showTenantInput">
        <p>Logging into: <strong>{{ currentTenant }}</strong></p>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  error = '';
  showTenantInput = true;
  currentTenant = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private tenantContext: TenantContextService
  ) {
    this.loginForm = this.createForm();
  }

  ngOnInit() {
    this.detectTenantContext();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      tenantSlug: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  private detectTenantContext(): void {
    const currentSlug = this.tenantContext.getCurrentSlug();
    
    if (currentSlug) {
      // Tenant context detected via subdomain or storage
      this.showTenantInput = false;
      this.currentTenant = currentSlug;
      this.loginForm.get('tenantSlug')?.setValue(currentSlug);
      this.loginForm.get('tenantSlug')?.disable();
    }
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.error = '';

      const formValue = this.loginForm.getRawValue();
      
      try {
        await this.authService.login(
          {
            email: formValue.email,
            password: formValue.password
          },
          formValue.tenantSlug
        ).toPromise();
      } catch (error: any) {
        this.error = error.message || 'Login failed. Please check your credentials.';
        this.isLoading = false;
      }
    }
  }
}
```

### **6. APP INITIALIZATION**

**Update**: `apps/mobile/src/main.ts`

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Mobile-optimized bootstrap with tenant context initialization
function initializeApp(): Promise<any> {
  return new Promise((resolve) => {
    // Tenant context is automatically initialized in TenantContextService
    console.log('Tenant context initialized');
    resolve(true);
  });
}

initializeApp().then(() => {
  bootstrapApplication(AppComponent, appConfig)
    .catch(err => console.error('Bootstrap failed:', err));
});
```

---

## **🔧 CONFIGURATION FILES**

### **App Config** (`apps/mobile/src/app/app.config.ts`)
```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([tenantInterceptor])),
    provideAnimations(),
    // Services are providedIn: 'root'
  ]
};
```

### **Route Configuration** (`apps/mobile/src/app/app.routes.ts`)
```typescript
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [authGuard] // Protect tenant-specific routes
  },
  { path: 'tenant-selection', component: TenantSelectionComponent },
  { path: '**', redirectTo: 'login' }
];
```

---

## **🎯 IMPLEMENTATION PRIORITIES FOR CLAUDE CLI**

### **PHASE 1: CORE INFRASTRUCTURE**
1. ✅ Implement `TenantContextService` with platform detection
2. ✅ Create `TenantInterceptor` for header injection
3. ✅ Update `AuthService` with unified login flow
4. ✅ Build `LoginComponent` with conditional tenant input

### **PHASE 2: USER EXPERIENCE**
1. ✅ Implement secure storage for tenant persistence
2. ✅ Create auto-login flow with stored context
3. ✅ Build tenant selection component
4. ✅ Implement auth guards for protected routes

### **PHASE 3: MOBILE OPTIMIZATION**
1. ✅ Capacitor configuration for Android
2. ✅ Platform-specific styling and UX
3. ✅ Offline capability planning
4. ✅ Performance optimization

---

## **✅ SUCCESS CRITERIA**

- ✅ Single API endpoint with context-aware tenant resolution
- ✅ Automatic subdomain detection for web users
- ✅ Header-based tenancy for mobile users  
- ✅ Persistent tenant context across app sessions
- ✅ Unified authentication flow across platforms
- ✅ Secure storage implementation for mobile
- ✅ Clean separation of concerns in services

**Claude CLI: Implement this exact architecture starting with the TenantContextService and working through each component systematically.**