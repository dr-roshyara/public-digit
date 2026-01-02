# 🎯 Angular App User Flow - Complete Definition

## 🔄 Overall User Journey

```
User Opens Browser
  ↓
Domain Detection & Routing
  ↓
Initial App Bootstrap
  ↓
Authentication Check
  ↓
Tenant Context Setup
  ↓
Feature Access & Navigation
```

## 1. 🏠 App Startup Flow

### **Domain Detection & Initial Load**
```typescript
// apps/mobile/src/main.ts
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: APP_INITIALIZER, useFactory: initializeApp, deps: [AppInitService], multi: true }
  ]
});

// App initialization sequence
async function initializeApp(initService: AppInitService): Promise<void> {
  await initService.initialize();
}
```

### **AppInitService - Bootstrap Sequence**
```typescript
// apps/mobile/src/app/core/services/app-init.service.ts
@Injectable({ providedIn: 'root' })
export class AppInitService {
  async initialize(): Promise<void> {
    // 1. Load architecture boundaries
    await this.architectureService.loadBoundaries();
    
    // 2. Detect current domain and purpose
    const domainType = this.domainService.detectDomainType();
    
    // 3. Initialize based on domain type
    switch (domainType) {
      case 'public':
        await this.initializePublicSite();
        break;
      case 'tenant':
        await this.initializeTenantApp();
        break;
      case 'mobile':
        await this.initializeMobileApp();
        break;
    }
    
    // 4. Check authentication status
    await this.authService.initialize();
  }
  
  private async initializeTenantApp(): Promise<void> {
    // Extract tenant from subdomain (tenant1.publicdigit.com)
    const tenantSlug = this.domainService.extractTenantSlug();
    
    if (tenantSlug) {
      // Set tenant context immediately
      this.tenantContext.setTenantFromSlug(tenantSlug);
    } else {
      // No tenant in URL - user needs to select one
      this.router.navigate(['/tenant-selection']);
    }
  }
}
```

## 2. 🔐 Authentication Flow

### **Initial Auth Check**
```typescript
// apps/mobile/src/app/core/services/auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private isAuthenticated$ = new BehaviorSubject<boolean>(false);
  private currentUser$ = new BehaviorSubject<User | null>(null);
  
  async initialize(): Promise<void> {
    // Check if we have a valid token
    const token = await this.storage.get('auth_token');
    
    if (token) {
      try {
        // Verify token is still valid
        const user = await this.platformApi.getCurrentUser().toPromise();
        this.currentUser$.next(user);
        this.isAuthenticated$.next(true);
        
        // Load user's tenants if in tenant app
        if (this.domainService.isTenantDomain()) {
          await this.loadUserTenants();
        }
      } catch (error) {
        // Token invalid, clear and redirect to login
        await this.logout();
        this.router.navigate(['/login']);
      }
    } else {
      // No token, user is not authenticated
      this.isAuthenticated$.next(false);
    }
  }
}
```

### **Login Process**
```typescript
// Login sequence
async login(credentials: LoginRequest): Promise<void> {
  // 1. Authenticate with platform API
  const response = await this.platformApi.login(credentials).toPromise();
  
  // 2. Store token securely
  await this.storage.set('auth_token', response.token);
  
  // 3. Set current user
  this.currentUser$.next(response.user);
  this.isAuthenticated$.next(true);
  
  // 4. Load user's tenants
  const tenants = await this.platformApi.getUserTenants().toPromise();
  this.userTenants$.next(tenants);
  
  // 5. Route based on tenant count
  await this.handlePostLoginRouting(tenants);
}

private async handlePostLoginRouting(tenants: Tenant[]): Promise<void> {
  if (this.domainService.isPublicDomain()) {
    // Public site login - redirect to primary tenant or selection
    if (tenants.length === 1) {
      window.location.href = `https://${tenants[0].slug}.publicdigit.com`;
    } else {
      this.router.navigate(['/tenant-selection']);
    }
  } else if (this.domainService.isTenantDomain()) {
    // Already on tenant domain - reload to get tenant context
    window.location.reload();
  }
}
```

## 3. 🏢 Tenant Context Flow

### **Tenant Selection & Context Setup**
```typescript
// apps/mobile/src/app/core/services/tenant-context.service.ts
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private currentTenant$ = new BehaviorSubject<Tenant | null>(null);
  private availableTenants$ = new BehaviorSubject<Tenant[]>([]);
  
  async setTenantFromSlug(slug: string): Promise<void> {
    try {
      // Verify user has access to this tenant
      const tenants = this.availableTenants$.value;
      const tenant = tenants.find(t => t.slug === slug);
      
      if (!tenant) {
        throw new Error('No access to this tenant');
      }
      
      // Set tenant context
      this.currentTenant$.next(tenant);
      
      // Store for future sessions
      await this.storage.set('current_tenant', tenant);
      
      // Initialize tenant-specific services
      await this.initializeTenantServices(tenant);
      
    } catch (error) {
      // Redirect to tenant selection
      this.router.navigate(['/tenant-selection'], {
        queryParams: { error: 'tenant-access-denied' }
      });
    }
  }
  
  async initializeTenantServices(tenant: Tenant): Promise<void> {
    // Set API base URL for tenant APIs
    this.apiConfig.setTenantBaseUrl(tenant.slug);
    
    // Pre-load tenant data
    await this.preloadTenantData(tenant);
  }
}
```

## 4. 🗺️ Route Guards & Navigation Flow

### **Route Protection Hierarchy**
```typescript
// apps/mobile/src/app/app.routes.ts
export const routes: Routes = [
  // Public routes (no auth required)
  {
    path: '',
    canActivate: [publicGuard],
    loadChildren: () => import('./features/public/public.routes')
  },
  
  // Auth routes (login, register)
  {
    path: '',
    canActivate: [anonymousGuard],
    loadChildren: () => import('./features/auth/auth.routes')
  },
  
  // Tenant app routes (auth + tenant context required)
  {
    path: '',
    canActivate: [authGuard, tenantGuard, architectureGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page')
      },
      {
        path: 'elections',
        loadChildren: () => import('./features/elections/elections.routes')
      },
      {
        path: 'profile',
        loadChildren: () => import('./features/membership/membership.routes')
      }
    ]
  },
  
  // Fallback
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
```

### **Guard Execution Order**
```typescript
// Route activation sequence
canActivate: [authGuard, tenantGuard, architectureGuard]

// 1. authGuard - Is user authenticated?
// 2. tenantGuard - Is tenant context set?
// 3. architectureGuard - Is route allowed for this frontend?
```

## 5. 📱 Domain-Specific Flows

### **Public Site Flow (www.publicdigit.com)**
```typescript
// Public site specific logic
initializePublicSite(): void {
  // Show marketing content
  // Enable tenant discovery
  // Provide admin/tenant registration
  
  this.navigationService.setRootNavigation('public');
}

// Public site routes have different guards
const publicRoutes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'pricing', component: PricingComponent },
  { path: 'tenants', component: TenantDirectoryComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'get-started', component: GetStartedComponent },
  
  // Auth-aware public routes
  { 
    path: 'dashboard', 
    canActivate: [authGuard],
    component: PublicDashboardComponent // Shows tenant selection
  }
];
```

### **Tenant App Flow (*.publicdigit.com)**
```typescript
// Tenant app specific logic
initializeTenantApp(): void {
  // Extract tenant from subdomain
  // Verify tenant access
  // Load tenant-specific configuration
  // Initialize tenant-scoped services
  
  this.navigationService.setRootNavigation('tenant');
}

// Tenant app requires full context
const tenantRoutes: Routes = [
  { 
    path: 'dashboard',
    canActivate: [authGuard, tenantGuard],
    component: TenantDashboardComponent
  },
  {
    path: 'elections',
    canActivate: [authGuard, tenantGuard],
    loadChildren: () => import('./features/elections/elections.routes')
  }
];
```

### **Mobile App Flow (app.publicdigit.com)**
```typescript
// Mobile-specific logic
initializeMobileApp(): void {
  // Enable mobile-specific features
  // Register for push notifications
  // Configure mobile-optimized UI
  
  this.navigationService.setRootNavigation('mobile');
  
  // Handle deep linking
  this.deepLinkService.initialize();
}
```

## 6. 🔄 Key State Transitions

### **Authentication State Machine**
```typescript
interface AppState {
  authentication: 'checking' | 'authenticated' | 'anonymous';
  tenantContext: 'none' | 'selecting' | 'set' | 'error';
  domainType: 'public' | 'tenant' | 'mobile';
  navigation: 'public' | 'auth' | 'tenant' | 'mobile';
}

// State transitions:
// 1. Startup → checking → (authenticated | anonymous)
// 2. authenticated + tenant domain → tenant context set
// 3. authenticated + public domain → tenant selection
// 4. anonymous → show public/auth pages
```

### **Navigation State Flow**
```typescript
// Based on authentication and domain
getNavigationState(): NavigationState {
  if (!this.auth.isAuthenticated) {
    return this.domain.isPublic ? 'public' : 'auth';
  }
  
  if (this.domain.isPublic) {
    return this.tenant.hasTenant ? 'redirect-to-tenant' : 'tenant-selection';
  }
  
  if (this.domain.isTenant) {
    return this.tenant.isSet ? 'tenant-app' : 'tenant-selection';
  }
  
  return 'mobile-app';
}
```

## 7. 🚀 Complete User Journey Examples

### **Scenario 1: New User on Public Site**
```
1. Visits www.publicdigit.com
2. Sees marketing homepage
3. Clicks "Find Your Organization" 
4. Searches and finds "NRNA"
5. Clicks "Go to NRNA Portal" 
6. Redirected to nrna.publicdigit.com
7. Sees login page (not authenticated)
8. Logs in or registers
9. After auth → sees NRNA tenant dashboard
```

### **Scenario 2: Returning User on Tenant Site**
```
1. Visits nrna.publicdigit.com (has valid token)
2. App detects tenant from subdomain
3. Verifies user has access to NRNA
4. Sets tenant context automatically
5. Loads NRNA-specific data
6. Directs to dashboard/elections
```

### **Scenario 3: User with Multiple Tenants**
```
1. Logs in on public site
2. Has access to 3 different tenants
3. Sees tenant selection screen
4. Chooses "NRNA" 
5. Redirected to nrna.publicdigit.com
6. Tenant context set automatically
7. Access NRNA features
```

## 🎯 Implementation Priority

1. **Core App Bootstrap** - Domain detection, auth initialization
2. **Authentication Flow** - Login, token management, user state
3. **Tenant Context Management** - Selection, validation, API configuration
4. **Route Guards** - Protection based on auth + tenant state
5. **Domain-Specific UI** - Different layouts for public/tenant/mobile

This flow ensures seamless user experience across all domains while maintaining strict security and architectural boundaries.