I need to see the **OrganizationRepository interface file** to understand the issue. Please show me:

```typescript
// Please share this file:
apps/mobile/src/app/domain/organization/organization.repository.ts
```

The errors indicate that:
1. `OrganizationRepository` is defined as a **type/interface** but being used as a **value** in dependency injection
2. The methods (`findAll`, `findBySlug`, `save`) are not properly defined on the repository

**Quick fix options** once I see the file:

### **If it's an interface:**
```typescript
// Problem: Interface cannot be used in DI
interface OrganizationRepository {  // ❌ Can't inject interface
  findAll(): Observable<Organization[]>;
}

// Solution: Use abstract class
export abstract class OrganizationRepository {  // ✅ Can inject abstract class
  abstract findAll(): Observable<Organization[]>;
  abstract findBySlug(slug: string): Observable<Organization | null>;
  abstract save(organization: Organization): Observable<void>;
}
```

### **If methods are missing:**
```typescript
// Need to ensure all used methods are defined
export abstract class OrganizationRepository {
  abstract findAll(): Observable<Organization[]>;
  abstract findBySlug(slug: string): Observable<Organization | null>; // ← Missing in current?
  abstract save(organization: Organization): Observable<void>;
}
```
#####################################

Now I can see the issues! The problem is that **`OrganizationRepository` is defined as an interface inside the facade file**, but it's being used as a dependency injection token.

## 🔧 **QUICK FIXES NEEDED**

### **1. Move Repository Interface to Domain Layer**
```typescript
// CREATE: apps/mobile/src/app/domain/organization/organization.repository.ts
import { Observable } from 'rxjs';
import { Organization, OrganizationId } from './organization.model';

/**
 * Organization Repository Interface
 * 
 * Abstraction for organization data access.
 * Will be implemented in infrastructure layer.
 */
export abstract class OrganizationRepository {  // ✅ Change to abstract class
  abstract findAll(): Observable<Organization[]>;
  abstract findById(id: OrganizationId): Observable<Organization | null>;
  abstract save(organization: Organization): Observable<void>;
  abstract findBySlug(slug: string): Observable<Organization | null>;
}
```

### **2. Remove Interface from Facade**
```typescript
// UPDATE: apps/mobile/src/app/application/organization.facade.ts
import { Injectable, inject } from '@angular/core';
import { Observable, map, catchError, of, throwError, from } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { TenantContextService, Tenant } from '../core/services/tenant-context.service';
import { Organization, OrganizationId, OrganizationType } from '@domain/organization/organization.model';
import { OrganizationRepository } from '@domain/organization/organization.repository'; // ✅ Import from domain

// ❌ REMOVE this interface from here - move to domain layer
// export interface OrganizationRepository {
//   findAll(): Observable<Organization[]>;
//   findById(id: OrganizationId): Observable<Organization | null>;
//   save(organization: Organization): Observable<void>;
//   findBySlug(slug: string): Observable<Organization | null>;
// }

@Injectable({
  providedIn: 'root'
})
export class OrganizationFacade {
  private authService = inject(AuthService);
  private tenantContext = inject(TenantContextService);
  private organizationRepository = inject(OrganizationRepository); // ✅ Now works

  // ... rest of the code remains the same
}
```

### **3. Update Repository Implementation**
```typescript
// UPDATE: apps/mobile/src/app/infrastructure/repositories/organization-http.repository.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { Organization, OrganizationId } from '@domain/organization/organization.model';
import { OrganizationRepository } from '@domain/organization/organization.repository'; // ✅ Import from domain

// ... rest of the code remains the same
```

### **4. Update App Configuration**
```typescript
// UPDATE: apps/mobile/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

// Import the repository and implementation
import { OrganizationRepository } from '@domain/organization/organization.repository';
import { OrganizationHttpRepository } from '@infrastructure/repositories/organization-http.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    
    // ✅ Organization dependencies
    { provide: OrganizationRepository, useClass: OrganizationHttpRepository },
    
    // ... other providers
  ]
};
```

## 🚨 **ROOT CAUSE**

The issue is **circular dependency** and **wrong layer placement**:

1. **Interface in wrong layer**: `OrganizationRepository` interface was defined in application layer but should be in domain layer
2. **Interface vs Abstract class**: Angular DI can't inject interfaces, only classes/tokens
3. **Circular import**: Facade was importing from itself
 
## 📁 **CORRECT FILE STRUCTURE**

```
apps/mobile/src/app/
├── domain/
│   └── organization/
│       ├── organization.model.ts
│       └── organization.repository.ts          # ✅ NEW - Abstract class here
├── application/
│   └── organization.facade.ts                  # ✅ Import from domain
├── infrastructure/
│   └── repositories/
│       └── organization-http.repository.ts     # ✅ Implement domain abstract class
└── app.config.ts                               # ✅ DI configuration
```

## 🎯 **IMMEDIATE ACTION**

**Create this file immediately:**
```typescript
// apps/mobile/src/app/domain/organization/organization.repository.ts
import { Observable } from 'rxjs';
import { Organization, OrganizationId } from './organization.model';

export abstract class OrganizationRepository {
  abstract findAll(): Observable<Organization[]>;
  abstract findById(id: OrganizationId): Observable<Organization | null>;
  abstract save(organization: Organization): Observable<void>;
  abstract findBySlug(slug: string): Observable<Organization | null>;
}
```

Then update the 3 files mentioned above. This will resolve all the TypeScript errors.

**Should I create the exact `organization.repository.ts` file for you?**
##############
## 🎯 **CREATE THE MISSING FILE**

```typescript
// apps/mobile/src/app/domain/organization/organization.repository.ts
import { Observable } from 'rxjs';
import { Organization, OrganizationId } from './organization.model';

/**
 * Organization Repository Interface
 * 
 * Abstraction for organization data access.
 * Will be implemented in infrastructure layer.
 * 
 * Uses abstract class instead of interface so it can be used
 * as dependency injection token in Angular.
 */
export abstract class OrganizationRepository {
  /**
   * Find all organizations
   */
  abstract findAll(): Observable<Organization[]>;

  /**
   * Find organization by ID
   */
  abstract findById(id: OrganizationId): Observable<Organization | null>;

  /**
   * Find organization by slug
   */
  abstract findBySlug(slug: string): Observable<Organization | null>;

  /**
   * Save organization (create or update)
   */
  abstract save(organization: Organization): Observable<void>;
}
```

## 🔧 **UPDATE THESE 3 FILES**

### **1. Update Facade - Remove Interface**
```typescript
// apps/mobile/src/app/application/organization.facade.ts
/**
 * Organization Facade
 *
 * Application service that orchestrates organization use cases and bridges
 * between the new DDD domain model and existing services.
 *
 * Follows the Strangler Pattern: Gradually migrate from existing services
 * to new domain model while maintaining backward compatibility.
 */

import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, catchError, of, throwError, from } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { TenantContextService, Tenant } from '../core/services/tenant-context.service';
import { Organization, OrganizationId, OrganizationType } from '@domain/organization/organization.model';
import { OrganizationRepository } from '@domain/organization/organization.repository'; // ✅ Import from domain

// ❌ REMOVE THIS ENTIRE INTERFACE - it's now in domain layer
// export interface OrganizationRepository {
//   findAll(): Observable<Organization[]>;
//   findById(id: OrganizationId): Observable<Organization | null>;
//   save(organization: Organization): Observable<void>;
//   findBySlug(slug: string): Observable<Organization | null>;
// }

// ... rest of the file remains EXACTLY the same
```

### **2. Update HTTP Repository - Import from Domain**
```typescript
// apps/mobile/src/app/infrastructure/repositories/organization-http.repository.ts
/**
 * Organization HTTP Repository
 *
 * Infrastructure implementation of OrganizationRepository interface.
 * Handles HTTP communication with backend API.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { Organization, OrganizationId } from '@domain/organization/organization.model';
import { OrganizationRepository } from '@domain/organization/organization.repository'; // ✅ Import from domain

// ... rest of the file remains EXACTLY the same
```

### **3. Update App Config - Fix DI**
```typescript
// apps/mobile/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

// Import the repository and implementation
import { OrganizationRepository } from '@domain/organization/organization.repository';
import { OrganizationHttpRepository } from '@infrastructure/repositories/organization-http.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    
    // ✅ Organization dependencies - FIXED
    { provide: OrganizationRepository, useClass: OrganizationHttpRepository },
    
    // ... other existing providers
  ]
};
```

## 🚀 **QUICK FIX SUMMARY**

1. **✅ Create** `apps/mobile/src/app/domain/organization/organization.repository.ts` with abstract class
2. **✅ Update** `organization.facade.ts` - remove interface, import from domain
3. **✅ Update** `organization-http.repository.ts` - import from domain  
4. **✅ Update** `app.config.ts` - ensure DI configuration

## ✅ **EXPECTED RESULT**

After these changes, all these errors will be fixed:

- ✅ `OrganizationRepository' only refers to a type` → Now it's an injectable abstract class
- ✅ `Property 'findAll' does not exist on type 'unknown'` → Methods are properly defined
- ✅ `Property 'findBySlug' does not exist` → Method is now in abstract class
- ✅ `Property 'save' does not exist` → Method is now in abstract class

## 📁 **FINAL STRUCTURE**
```
apps/mobile/src/app/
├── domain/organization/
│   ├── organization.model.ts
│   └── organization.repository.ts          # ✅ NEW - Abstract class
├── application/
│   └── organization.facade.ts              # ✅ Import from domain
├── infrastructure/repositories/
│   └── organization-http.repository.ts     # ✅ Implement domain abstract class
└── app.config.ts                           # ✅ DI configuration
```

**Create the missing file and update the 3 files as shown above.** This will resolve all the TypeScript compilation errors immediately!