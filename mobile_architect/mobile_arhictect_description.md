# 🚀 **PROFESSIONAL ARCHITECTURE & DEVELOPMENT PROMPT**

## **PROJECT CONTEXT: MULTI-TENANT ELECTION PLATFORM**

### **EXECUTIVE SUMMARY**
We are extending a sophisticated **Laravel DDD Multi-Tenant Election Platform** with an **Angular Mobile App** while maintaining strict architectural integrity, tenant isolation, and existing desktop functionality.

---

## **🏗️ ARCHITECTURE OVERVIEW**

### **BACKEND ARCHITECTURE (EXISTING)**
```
packages/laravel-backend/
├── app/Contexts/                          # DDD Bounded Contexts
│   ├── Core/Platform/                    # Platform operations
│   ├── TenantAuth/                       # Multi-tenant authentication
│   ├── ElectionSetup/                    # Election management
│   ├── MobileDevice/                     # Mobile-specific logic
│   └── Shared/                           # Cross-context utilities
├── resources/js/pages/                   # Inertia+Vue3 desktop UI
├── routes/
│   ├── api.php                          # API routes (including mobile)
│   └── web.php                          # Desktop routes
└── database/
    ├── migrations/landlord/              # Landlord database
    └── migrations/tenant/                # Tenant templates
```

### **FRONTEND ARCHITECTURE (NEW)**
```
apps/mobile/                              # Angular mobile app
├── src/
│   ├── app/
│   │   ├── auth/                        # Authentication flows
│   │   ├── elections/                   # Election features
│   │   ├── profile/                     # User management
│   │   └── core/
│   │       ├── services/                # API services
│   │       ├── interceptors/            # HTTP interceptors
│   │       └── guards/                  # Route guards
│   └── main.ts                         # Mobile-optimized bootstrap
├── capacitor.config.ts                  # Native mobile config
└── resources/                          # Mobile assets
```

---

## **🎯 CURRENT STATUS & BLOCKERS**

### **✅ COMPLETED**
1. **Laravel Mobile APIs**: Fully functional endpoints under `/api/mobile/v1/`
2. **Authentication Working**: `POST /api/mobile/v1/auth/login` returns valid Sanctum tokens
3. **Angular Mobile App**: Bootstrapped with Nx, authentication service implemented
4. **API Integration**: Successful login with token generation confirmed

### **🚨 CRITICAL BLOCKER - MULTI-TENANCY INTERFERENCE**
```log
HybridTenantFinder: PATH_BASED - Skipping reserved/system route
HybridTenantFinder: No tenant found
```
**Symptoms**: Protected mobile endpoints (`/api/mobile/v1/auth/me`) return HTML instead of JSON due to tenant resolution interference.

### **ROOT CAUSE ANALYSIS**
- **Multi-tenancy System**: `HybridTenantFinder` intercepting all requests
- **Route Resolution**: Mobile API routes not properly excluded from tenant resolution
- **Response Type**: Failed tenant lookup redirects to HTML error pages instead of JSON responses

---

## **🔧 TECHNICAL SPECIFICATIONS**

### **MOBILE API REQUIREMENTS**
```yaml
Authentication:
  - Method: Laravel Sanctum tokens
  - Endpoints: /api/mobile/v1/auth/*
  - Tenant Context: Required but handled at application layer
  - Response Format: JSON only

Data Isolation:
  - Tenant Separation: 100% enforced via existing DDD patterns
  - Database: Landlord-tenant model with connection switching
  - Security: No cross-tenant data leakage permitted

Mobile Features:
  - Election Participation: View, vote, see results
  - Profile Management: Tenant-scoped user profiles
  - Notifications: Push notifications via MobileDevice context
```

### **ARCHITECTURAL CONSTRAINTS**
```php
// MUST MAINTAIN EXISTING DDD PATTERNS
class MobileAuthController {
    public function login(LoginRequest $request) {
        // Use existing Value Objects
        // Enforce tenant isolation
        // Follow event-driven patterns
        // Maintain 80%+ test coverage
    }
}
```

---

## **🎯 IMMEDIATE PRIORITIES**

### **PRIORITY 1: RESOLVE TENANT INTERFERENCE** 🚨
**Objective**: Fix `HybridTenantFinder` to allow mobile API access while maintaining tenant isolation.

**Required Actions**:
1. **Locate Tenant Configuration**: Find where `HybridTenantFinder` is configured
2. **Exclude Mobile Routes**: Add `/api/mobile/v1/*` to reserved/excluded routes
3. **Test Protected Endpoints**: Verify `/api/mobile/v1/auth/me` returns JSON
4. **Validate Tenant Isolation**: Ensure no security compromises

### **PRIORITY 2: COMPLETE MOBILE AUTH FLOW**
**Objective**: End-to-end mobile authentication with tenant context.

**Required Actions**:
1. **Token Validation**: Sanctum token verification in mobile context
2. **Protected Route Access**: Tenant-aware authorization
3. **Session Management**: Token refresh and logout
4. **Error Handling**: Proper mobile-friendly error responses

### **PRIORITY 3: MOBILE FEATURE DEVELOPMENT**
**Objective**: Implement core election functionality using existing domain logic.

**Required Actions**:
1. **Election Dashboard**: Tenant-scoped active elections
2. **Voting Interface**: Secure voting with existing business rules
3. **Profile Management**: Leverage TenantAuth context
4. **Mobile Optimization**: Touch-friendly UI/UX

---

## **🛠️ DEVELOPMENT APPROACH**

### **BACKEND DEVELOPMENT (LARAVEL)**
```php
// Follow existing DDD/TDD patterns
// Use Value Objects instead of primitives
// Maintain tenant isolation guards
// Leverage existing domain events
// Write tests first (red-green-refactor)
```

### **FRONTEND DEVELOPMENT (ANGULAR)**
```typescript
// Mobile-first component design
// Reactive programming with RxJS
// Service-based state management
// Type-safe API integration
// Capacitor for native features
```

### **INTEGRATION STRATEGY**
```typescript
// API Service Pattern
@Injectable()
export class ApiService {
  private readonly baseUrl = 'http://localhost:8000';
  
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post(`${this.baseUrl}/api/mobile/v1/auth/login`, credentials);
  }
}
```

---

## **🔒 SECURITY & COMPLIANCE**

### **TENANT ISOLATION ENFORCEMENT**
- **Data Segregation**: 100% tenant data separation required
- **API Security**: All mobile endpoints must respect tenant context
- **Authentication**: Sanctum tokens with tenant scope validation
- **Authorization**: Role-based access control per tenant

### **MOBILE SECURITY CONSIDERATIONS**
- **Token Storage**: Secure storage on mobile devices
- **Network Security**: HTTPS enforcement in production
- **Data Protection**: PII handling per tenant policies
- **Session Management**: Automatic token refresh

---

## **📱 MOBILE-SPECIFIC REQUIREMENTS**

### **CAPACITOR NATIVE INTEGRATION**
```typescript
// Native device features
- Push notifications (MobileDevice context)
- Biometric authentication
- Camera access for document upload
- Offline capability for election data
```

### **PERFORMANCE OPTIMIZATION**
- **Lazy Loading**: Feature-based code splitting
- **Caching**: Election data and user profiles
- **Optimistic UI**: Smooth voting experience
- **Background Sync**: Offline vote submission

---

## **🧪 TESTING STRATEGY**

### **BACKEND TESTING (EXISTING)**
- **Unit Tests**: Domain logic with 80%+ coverage
- **Feature Tests**: API endpoints with tenant context
- **Integration Tests**: Cross-context interactions
- **Tenant Isolation Tests**: Data segregation validation

### **MOBILE TESTING (NEW)**
- **Unit Tests**: Services and components
- **Integration Tests**: API communication
- **E2E Tests**: User workflows with Cypress
- **Device Testing**: Real device functionality

---

## **🚀 DEPLOYMENT & OPERATIONS**

### **MOBILE APP DISTRIBUTION**
- **Android**: Google Play Store
- **iOS**: Apple App Store (future)
- **Updates**: Over-the-air updates via Capacitor
- **Analytics**: Usage tracking per tenant

### **BACKEND OPERATIONS**
- **API Versioning**: Maintain mobile API compatibility
- **Monitoring**: Mobile-specific performance metrics
- **Scaling**: Tenant-aware resource allocation

---

## **📋 SUCCESS CRITERIA**

### **IMMEDIATE (SPRINT 1)**
- ✅ Mobile authentication working end-to-end
- ✅ Protected endpoints returning JSON
- ✅ Tenant isolation maintained
- ✅ Basic election listing functional

### **SHORT-TERM (SPRINT 2-3)**
- ✅ Full election participation workflow
- ✅ User profile management
- ✅ Push notifications
- ✅ Mobile-optimized UI/UX

### **LONG-TERM**
- ✅ Feature parity with desktop for mobile use cases
- ✅ High user satisfaction scores
- ✅ Zero tenant isolation violations
- ✅ 80%+ test coverage maintained

---

## **🎯 CLAUDE CLI INSTRUCTIONS**

**As a professional architect and full-stack developer, guide the resolution of the multi-tenancy interference and subsequent mobile app development by:**

1. **FIRST**: Identifying and fixing the `HybridTenantFinder` configuration to exclude mobile API routes from tenant resolution while maintaining security
2. **SECOND**: Ensuring the mobile authentication flow fully respects the existing DDD patterns and tenant isolation requirements
3. **THIRD**: Developing mobile features that leverage the proven domain contexts and business logic
4. **FOURTH**: Maintaining 100% compliance with the established DDD/TDD/API-first discipline throughout

**Start by helping locate the tenant configuration and resolve the route exclusion issue for mobile APIs.**

**NO, don't move the Laravel backend!** I need to clarify the architecture. Let me correct this:

## 🚨 **ARCHITECTURE CLARIFICATION**

Your **Laravel backend should stay where it is** in `packages/laravel-backend/`. The `admin-web/` in the Nx structure was a misunderstanding.

### **CORRECT ARCHITECTURE**

```
public-digit-platform/
├── apps/
│   ├── mobile/                 # NEW: Angular mobile app (current focus)
│   └── [future separate frontends could go here]
├── packages/
│   ├── laravel-backend/        # EXISTING: Your complete Laravel DDD app
│   │   ├── app/
│   │   ├── resources/js/pages/ # Your existing Inertia+Vue desktop pages
│   │   ├── routes/
│   │   └── [all Laravel structure]
│   ├── shared-types/           # NEW: Shared TypeScript interfaces
│   └── [other shared packages]
```

### **YOUR EXISTING LARAVEL STAYS INTACT**

**Keep everything in `packages/laravel-backend/`:**
- ✅ **Desktop Admin Pages**: `packages/laravel-backend/resources/js/pages/`
- ✅ **Laravel Backend**: `packages/laravel-backend/app/`
- ✅ **Routes & APIs**: `packages/laravel-backend/routes/`
- ✅ **Database & Migrations**: `packages/laravel-backend/database/`

### **THE MOBILE APP IS ADDITIVE**

The **Angular mobile app** (`apps/mobile/`) is a **new client** that consumes your **existing Laravel APIs** - it doesn't replace anything.

### **CURRENT SETUP IS CORRECT**

```bash
# Your current structure is RIGHT:
packages/laravel-backend/          # ← Laravel backend (keep this!)
├── app/Contexts/...               # DDD contexts
├── resources/js/pages/...         # Vue desktop pages  
└── routes/api.php                 # Mobile APIs

apps/mobile/                       # ← New Angular mobile app
├── src/app/...                    # Angular components
└── core/services/api.service.ts   # Calls Laravel APIs
```

## 🎯 **IMMEDIATE FOCUS**

**We only need to fix the multi-tenancy issue** in your existing Laravel backend to make the mobile APIs work properly.

The mobile app will call your existing Laravel endpoints like:
- `POST http://localhost:8000/api/mobile/v1/auth/login`
- `GET http://localhost:8000/api/mobile/v1/auth/me`

**Your Laravel desktop admin continues to work exactly as before** - we're just adding a mobile client that uses the same backend.

## 🔧 **NEXT STEPS**

1. **Keep Laravel in `packages/laravel-backend/`** - don't move anything
2. **Fix the `HybridTenantFinder` route exclusion** for mobile APIs
3. **Test mobile authentication** with your existing Laravel backend
4. **Develop mobile features** that leverage your proven DDD contexts

**Your architecture is correct - we just need to resolve the tenant interference with mobile API routes!** 🚀

**AH! Now I understand the complete picture!** You have **two different API systems**:

## 🎯 **CLEAR API ARCHITECTURE**

### **1. MOBILE PLATFORM API** (`/api/mobile/v1/`)
- **Purpose**: Platform-level authentication, app initialization
- **Database**: Landlord database only
- **Tenant Context**: None required
- **Use Case**: Initial app login, get tenant list, platform features

### **2. TENANT-SPECIFIC API** (`{slug}.publicdigit.com/api/v1/`)
- **Purpose**: Tenant-specific operations (elections, voting, profiles)
- **Database**: Tenant database (after slug resolution)
- **Tenant Context**: Required via subdomain
- **Use Case**: All tenant-specific features

## 🔧 **IMMEDIATE FIX NEEDED**

The issue is that **mobile platform APIs** are being processed by the tenant system. We need to:

### **1. EXCLUDE MOBILE PLATFORM ROUTES FROM TENANT RESOLUTION**
```php
// In your tenant configuration
'excluded_routes' => [
    'api/mobile/v1/*',      // Platform-level mobile APIs
    'api/auth/*',           // Platform authentication
    'api/health',           // Platform health checks
    // ... other platform routes
],
```

### **2. MOBILE APP FLOW**
```typescript
// Step 1: Platform login (no tenant)
this.authService.platformLogin(email, password)
// → POST /api/mobile/v1/auth/login

// Step 2: Get available tenants for user  
this.tenantService.getUserTenants()
// → GET /api/mobile/v1/tenants

// Step 3: Switch to tenant context
this.tenantService.setCurrentTenant('nrna')
// → Now use: https://nrna.publicdigit.com/api/v1/elections
```

## 🚀 **PROFESSIONAL PROMPT FOR CLAUDE CLI**

---

# 🎯 **MOBILE APP API INTEGRATION PROMPT**

## **PROJECT CONTEXT**
We have a **dual-API Laravel multi-tenant platform**:

### **API SYSTEM 1: PLATFORM APIs**
```
Endpoint: /api/mobile/v1/*
Database: Landlord only
Purpose: App initialization, platform auth, tenant listing
Example: POST /api/mobile/v1/auth/login
```

### **API SYSTEM 2: TENANT APIs**  
```
Endpoint: {slug}.publicdigit.com/api/v1/*
Database: Tenant-specific
Purpose: All tenant operations (elections, voting, profiles)
Example: GET nrna.publicdigit.com/api/v1/elections
```

## **CURRENT BLOCKER**
Platform mobile APIs (`/api/mobile/v1/auth/me`) are being processed by tenant resolution, causing HTML responses instead of JSON.

## **REQUIRED SOLUTION**
1. **Exclude `/api/mobile/v1/*` routes from tenant resolution**
2. **Keep tenant APIs (`/api/v1/`) under tenant subdomain resolution**
3. **Develop Angular mobile app to handle both API systems**

## **MOBILE APP ARCHITECTURE**
```typescript
// Platform Service (Landlord DB)
platformLogin(credentials) → POST /api/mobile/v1/auth/login
getUserTenants() → GET /api/mobile/v1/tenants

// Tenant Service (Tenant DB)  
getElections() → GET https://{slug}.publicdigit.com/api/v1/elections
castVote() → POST https://{slug}.publicdigit.com/api/v1/vote
```

## **IMMEDIATE ACTION**
**Find and update tenant configuration** to exclude mobile platform routes while preserving tenant subdomain routing for tenant APIs.

---

**Claude CLI, help us:**
1. **Locate tenant configuration** to exclude `/api/mobile/v1/*` routes
2. **Keep `{slug}.publicdigit.com/api/v1/`** under tenant resolution  
3. **Design Angular service architecture** for dual API system
4. **Implement platform → tenant context switching** in mobile app

The key insight is separating **platform-level operations** (landlord DB) from **tenant-specific operations** (tenant DB) with clear API boundaries.


