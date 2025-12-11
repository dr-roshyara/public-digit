# Mobile Frontend Migration Architecture & Implementation Plan

## 🎯 **Project Context & Rationale**

**Current State**: Phase 1 (Core Authentication) is fully functional in Laravel 12 with Inertia.js + Vue3 desktop interface.

**Migration Rationale**: Need to implement Angular frontend for:
- Cross-platform mobile capabilities (Android/iOS via Capacitor)
- Consistent codebase for both mobile and desktop
- Enhanced developer productivity with Angular ecosystem

**Key Constraint**: Must maintain 100% compatibility with existing Laravel backend APIs and authentication flows.

## 🏗️ **Migration Architecture Plan**

### **Current Backend API Structure (Already Working)**

```yaml
Authentication Endpoints:
  Platform Level:
    - GET    /api/v1/tenants            # List user's available tenants
    - POST   /api/v1/auth/login         # Platform authentication
    - GET    /api/v1/auth/me            # Current user with tenant membership
  
  Tenant Level:
    - POST   {tenant-slug}/api/v1/auth/login    # Tenant authentication
    - GET    {tenant-slug}/api/v1/auth/me       # Tenant-scoped user data
```

### **Angular Frontend Architecture**

```
apps/mobile/ (Angular App)
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   ├── auth/                          # Authentication module
│   │   │   │   ├── services/
│   │   │   │   │   ├── platform-auth.service.ts    # Platform APIs
│   │   │   │   │   ├── tenant-auth.service.ts      # Tenant APIs  
│   │   │   │   │   └── auth-state.service.ts       # Auth state management
│   │   │   │   ├── guards/
│   │   │   │   │   ├── platform-auth.guard.ts
│   │   │   │   │   └── tenant-auth.guard.ts
│   │   │   │   ├── pages/
│   │   │   │   │   ├── welcome/                   # Welcome screen
│   │   │   │   │   ├── platform-login/            # Platform login
│   │   │   │   │   ├── tenant-selection/          # Choose tenant
│   │   │   │   │   ├── tenant-login/              # Tenant authentication
│   │   │   │   │   └── membership-application/    # Apply for membership
│   │   │   │   └── components/
│   │   │   │
│   │   │   ├── dashboard/                         # Tenant dashboard module
│   │   │   │   ├── services/tenant-api.service.ts
│   │   │   │   └── pages/tenant-dashboard/
│   │   │   │
│   │   │   └── core/
│   │   │       ├── services/
│   │   │       │   ├── api-interceptor.service.ts
│   │   │       │   ├── language.service.ts       # Location-based i18n
│   │   │       │   └── tenant-context.service.ts
│   │   │       ├── guards/
│   │   │       │   └── tenant-context.guard.ts
│   │   │       └── models/
│   │   │           ├── tenant.model.ts
│   │   │           └── user.model.ts
│   │   │
│   │   ├── shared/
│   │   │   ├── components/                      # Reusable UI components
│   │   │   ├── directives/                      # Custom directives
│   │   │   └── pipes/                           # Transformation pipes
│   │   │
│   │   └── core/
│   │       ├── layout/                          # App layout components
│   │       ├── interceptors/                    # HTTP interceptors
│   │       └── utils/                           # Utility functions
│   │
│   └── environments/
│       ├── environment.ts
│       └── environment.prod.ts
│
├── capacitor.config.ts                         # Native mobile config
├── angular.json                               # Angular configuration
└── package.json
```

## 🔄 **Authentication Flow Implementation**

### **Dual-Authentication Strategy**

```typescript
// Phase 1: Platform Authentication
1. User opens app → Welcome screen with language detection
2. User clicks login → Platform login page
3. User provides email/password → POST /api/v1/auth/login
4. Success → Get user's tenants → GET /api/v1/auth/me

// Phase 2: Tenant Context Selection
5. If user has one tenant → Auto-select
6. If user has multiple tenants → Show selection page
7. If user has no tenants → Show membership application

// Phase 3: Tenant Authentication
8. User selects tenant → Switch to tenant context
9. Tenant authentication → POST {tenant-slug}/api/v1/auth/login
10. Success → Navigate to tenant dashboard
```

## 🌐 **Internationalization Implementation has already done please check **


## 📋 **Phase 1 Migration Tasks**

### **Task 1: Core Authentication Services**
```typescript
// platform-auth.service.ts
@Injectable()
export class PlatformAuthService {
  private readonly platformBaseUrl = 'http://localhost:8000/api/v1';
  
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post(`${this.platformBaseUrl}/auth/login`, credentials);
  }
  
  getCurrentUser(): Observable<UserWithTenants> {
    return this.http.get(`${this.platformBaseUrl}/auth/me`);
  }
  
  getAvailableTenants(): Observable<Tenant[]> {
    return this.http.get(`${this.platformBaseUrl}/tenants`);
  }
}
```

### **Task 2: Tenant Context Management**
```typescript
// tenant-context.service.ts
@Injectable()
export class TenantContextService {
  private currentTenant = new BehaviorSubject<Tenant | null>(null);
  
  setTenant(tenant: Tenant): void {
    this.currentTenant.next(tenant);
    // Update all API services with tenant context
    this.updateApiConfig(tenant.slug);
  }
  
  private updateApiConfig(slug: string): void {
    // Switch API base URL to tenant subdomain
    const tenantBaseUrl = `https://${slug}.publicdigit.com/api/v1`;
    this.apiConfig.setBaseUrl(tenantBaseUrl);
  }
}
```

### **Task 3: Authentication Guards**
```typescript
// platform-auth.guard.ts
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private authService: PlatformAuthService) {}
  
  canActivate(): Observable<boolean> {
    return this.authService.isAuthenticated().pipe(
      tap(isAuth => {
        if (!isAuth) {
          this.router.navigate(['/welcome']);
        }
      })
    );
  }
}
```

### **Task 4: HTTP Interceptor for Tenant Context**
```typescript
// tenant-interceptor.service.ts
@Injectable()
export class TenantInterceptor implements HttpInterceptor {
  constructor(private tenantContext: TenantContextService) {}
  
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const tenant = this.tenantContext.getCurrentTenant();
    
    if (tenant && req.url.includes('publicdigit.com')) {
      const cloned = req.clone({
        headers: req.headers.set('X-Tenant-Slug', tenant.slug)
      });
      return next.handle(cloned);
    }
    
    return next.handle(req);
  }
}
```

## 🎨 **UI Component Migration**

### **From Vue3 to Angular Equivalents**

| Vue3 Component | Angular Component | Purpose |
|----------------|------------------|---------|
| `v-form` | Reactive Forms Module | Login forms |
| `v-card` | Material Card Component | Dashboard cards |
| `v-data-table` | Angular Material Table | Tenant lists |
| `v-navigation-drawer` | Angular Material Sidenav | Navigation |
| `v-alert` | Custom Alert Component | Status messages |

### **Responsive Design Strategy**
```scss
// Mobile-first responsive approach
@mixin mobile {
  @media (max-width: 768px) { @content; }
}

@mixin tablet {
  @media (min-width: 769px) and (max-width: 1024px) { @content; }
}

@mixin desktop {
  @media (min-width: 1025px) { @content; }
}
```

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
describe('PlatformAuthService', () => {
  let service: PlatformAuthService;
  let httpMock: HttpTestingController;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PlatformAuthService]
    });
    
    service = TestBed.inject(PlatformAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });
  
  it('should login successfully', () => {
    const credentials = { email: 'test@example.com', password: 'password' };
    const mockResponse = { token: 'jwt-token', user: { id: 1 } };
    
    service.login(credentials).subscribe(response => {
      expect(response.token).toBe('jwt-token');
    });
    
    const req = httpMock.expectOne('http://localhost:8000/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
```

### **E2E Tests**
```typescript
describe('Authentication Flow', () => {
  it('should complete platform to tenant authentication', () => {
    cy.visit('/welcome');
    cy.get('[data-cy=login-btn]').click();
    
    // Platform login
    cy.get('[data-cy=email-input]').type('user@example.com');
    cy.get('[data-cy=password-input]').type('password');
    cy.get('[data-cy=platform-login-btn]').click();
    
    // Tenant selection
    cy.get('[data-cy=tenant-list]').should('exist');
    cy.get('[data-cy=tenant-item]:first').click();
    
    // Should land on tenant dashboard
    cy.url().should('include', '/dashboard');
    cy.get('[data-cy=tenant-welcome]').should('contain', 'Welcome');
  });
});
```

## 🔧 **Environment Configuration**

```typescript
// environment.ts
export const environment = {
  production: false,
  api: {
    platformBaseUrl: 'http://localhost:8000/api/v1',
    tenantBaseUrl: (slug: string) => `https://${slug}.publicdigit.com/api/v1`
  },
  i18n: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'ne', 'es', 'fr'],
    locationDetection: true
  },
  features: {
    enablePushNotifications: false,
    enableOfflineMode: false,
    enableBiometricAuth: false
  }
};
```

## 📱 **Capacitor Configuration**

```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.publicdigit.election',
  appName: 'Public Digit Election',
  webDir: 'dist/mobile',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    Geolocation: {
      enableHighAccuracy: true
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF'
    }
  }
};
```

## 🚀 **Implementation Phases**

### **Week 1: Foundation**
- Set up Angular project structure
- Implement core services (auth, language, tenant context)
- Create HTTP interceptors
- Implement welcome and login pages

### **Week 2: Authentication Flow**
- Platform login implementation
- Tenant selection interface
- Tenant authentication integration
- Route guards and navigation

### **Week 3: Dashboard & Polish**
- Tenant dashboard implementation
- Responsive design optimization
- Language switching functionality
- Error handling and loading states

### **Week 4: Testing & Deployment**
- Unit and integration tests
- E2E test scenarios
- Mobile build configuration
- Deployment to test environments

## 📊 **Success Metrics**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Authentication Success Rate | 99% | API response monitoring |
| Page Load Time | < 2s | Lighthouse audits |
| Language Detection Accuracy | 95% | User preference logs |
| Cross-browser Compatibility | 100% | BrowserStack testing |
| Mobile App Performance | 80+ | Lighthouse Mobile Score |

---

# 🎯 **Professional Prompt for Implementation**

**Context**: We are migrating Phase 1 authentication from Vue3 to Angular while maintaining 100% compatibility with existing Laravel 12 backend APIs. The backend authentication endpoints are already working and tested.

**Primary Goal**: Recreate the authentication flow in Angular with enhanced mobile support and internationalization.

**Technical Requirements**:
1. Dual authentication system (platform → tenant context)
2. Location-based language detection
3. Responsive design for mobile/desktop
4. Capacitor integration for native mobile features
5. Maintain existing API contracts and security model

**Implementation Priorities**:
1. **Authentication Services**: PlatformAuthService, TenantAuthService, AuthStateService
2. **Core Infrastructure**: HTTP interceptors, route guards, tenant context management
3. **Internationalization**: Language detection, translation service, language switcher
4. **UI Components**: Welcome screen, login forms, tenant selection, dashboard
5. **Testing**: Unit tests for services, E2E for authentication flow

**Constraints**:
- Do NOT modify existing Laravel backend APIs
- Maintain existing security patterns (Sanctum tokens)
- Support both mobile and desktop from single codebase
- Implement location-based language detection

**Deliverables**:
1. Complete Angular authentication module
2. Working tenant context switching
3. Responsive UI with internationalization
4. Comprehensive test suite
5. Capacitor configuration for mobile builds

**Success Criteria**:
- All existing Vue3 authentication features work identically in Angular
- Mobile app builds successfully with Capacitor
- Language detection works on both web and mobile
- No regression in security or tenant isolation

**Start by**: Creating the core authentication services and implementing the platform login flow with proper error handling and loading states.