# DDD + Hexagonal Architecture Structure Plan
**Date**: 2025-11-21
**Project**: Public Digit Platform - Angular Mobile App
**Approach**: Incremental Strangler Pattern with Immediate Value

## 🎯 EXECUTIVE SUMMARY

This document outlines the **complete folder structure** and **implementation plan** for transforming the current Angular mobile app from traditional component-based architecture to DDD + Hexagonal Architecture.

## 📁 COMPLETE FOLDER STRUCTURE

### Target Architecture (After Refactoring)
```
apps/mobile/src/app/
├── domain/                          # PURE BUSINESS LOGIC
│   ├── organization/                # Organization Bounded Context
│   │   ├── organization.model.ts    # Rich domain model with behavior
│   │   ├── organization-id.value.ts # Value object for organization IDs
│   │   ├── organization.repository.ts # Repository interface
│   │   └── organization-created.event.ts # Domain events
│   ├── member/                      # Member Bounded Context
│   │   ├── member.model.ts
│   │   ├── member-role.value.ts
│   │   └── member.repository.ts
│   └── election/                    # Election Bounded Context
│       ├── election.model.ts
│       ├── election-status.value.ts
│       └── election.repository.ts
├── application/                     # USE CASE ORCHESTRATION
│   ├── organization.facade.ts       # Application service for Organization
│   ├── member.facade.ts             # Application service for Member
│   └── election.facade.ts           # Application service for Election
├── infrastructure/                  # EXTERNAL DEPENDENCIES
│   ├── repositories/                # Repository implementations
│   │   ├── organization-http.repository.ts
│   │   ├── member-http.repository.ts
│   │   └── election-http.repository.ts
│   ├── mappers/                     # Domain ↔ Infrastructure mapping
│   │   ├── organization.mapper.ts
│   │   ├── member.mapper.ts
│   │   └── election.mapper.ts
│   └── shared/                      # Shared infrastructure
│       ├── event-bus.ts             # Event bus implementation
│       └── http-client.ts           # HTTP client wrapper
├── features/                        # EXISTING: Keep during migration
│   ├── membership/                  # ← Gradually extract to domain/member/
│   ├── elections/                   # ← Gradually extract to domain/election/
│   └── finance/                     # ← Keep as-is for now
├── core/                           # EXISTING: Keep during migration
│   ├── guards/
│   ├── interceptors/
│   ├── models/
│   └── services/
├── components/                      # EXISTING: Update incrementally
│   ├── header/
│   ├── hero/
│   └── features/
├── pages/                          # EXISTING: Update incrementally
│   ├── login/
│   ├── tenant-selection/
│   └── dashboard/
└── landing/                        # EXISTING: Keep as-is
    └── landing.component.ts
```

## 🔄 MIGRATION STRATEGY

### Phase 1: Organization Domain (Week 1)
**Extract from existing code**:
- `core/services/tenant-context.service.ts` → `domain/organization/organization.model.ts`
- `features/membership/models/member.models.ts` → Additional organization logic

### Phase 2: Member Domain (Week 2)
**Extract from existing code**:
- `features/membership/models/member.models.ts` → `domain/member/member.model.ts`
- `features/membership/services/` → `domain/member/` + `application/member.facade.ts`

### Phase 3: Election Domain (Week 3)
**Extract from existing code**:
- `features/elections/` → `domain/election/` + `application/election.facade.ts`

## 📋 FILE SPECIFICATIONS

### Domain Layer Files

#### `domain/organization/organization.model.ts`
```typescript
// Rich domain model with business behavior
class Organization {
  constructor(
    public readonly id: OrganizationId,
    public readonly name: string,
    public readonly type: 'POLITICAL_PARTY' | 'NGO',
    private memberCount: number,
    private createdAt: Date
  ) {}

  // Business methods (currently scattered in services)
  static create(name: string, type: string): Organization {
    // Extract validation from existing services
    if (!name?.trim()) throw new Error('Organization name required');
    if (!['POLITICAL_PARTY', 'NGO'].includes(type)) throw new Error('Invalid type');

    return new Organization(
      OrganizationId.generate(),
      name.trim(),
      type,
      0,
      new Date()
    );
  }

  addMember(): void {
    this.memberCount++;
    // Business logic currently in services
  }
}
```

#### `domain/organization/organization.repository.ts`
```typescript
// Repository interface (abstraction)
interface OrganizationRepository {
  findAll(): Observable<Organization[]>;
  findById(id: OrganizationId): Observable<Organization | null>;
  save(organization: Organization): Observable<void>;
}
```

### Application Layer Files

#### `application/organization.facade.ts`
```typescript
// Application service that orchestrates use cases
@Injectable()
export class OrganizationFacade {
  constructor(
    private organizationRepository: OrganizationRepository,
    private existingTenantService: TenantContextService // Bridge to existing
  ) {}

  // Use new domain but work with existing services
  getOrganizations(): Observable<Organization[]> {
    return this.existingTenantService.tenant$.pipe(
      map(tenants => tenants?.map(tenant => Organization.fromExisting(tenant)) || [])
    );
  }
}
```

### Infrastructure Layer Files

#### `infrastructure/repositories/organization-http.repository.ts`
```typescript
// Repository implementation
@Injectable()
export class OrganizationHttpRepository implements OrganizationRepository {
  constructor(private http: HttpClient) {}

  findAll(): Observable<Organization[]> {
    return this.http.get<OrganizationDto[]>('/api/organizations').pipe(
      map(dtos => dtos.map(dto => OrganizationMapper.toDomain(dto)))
    );
  }
}
```

## 🎯 COMPONENT MIGRATION PLAN

### Components to Update (Incremental)

#### 1. Organization List Component
**Current**: `components/features/features.component.ts`
**Migration**: Use `OrganizationFacade` instead of direct service calls

#### 2. Tenant Selection Component
**Current**: `auth/tenant-selection/tenant-selection.component.ts`
**Migration**: Use `OrganizationFacade` for organization data

#### 3. Member Registration Component
**Current**: `features/membership/components/`
**Migration**: Use `MemberFacade` instead of direct service calls

## 🔧 TECHNICAL IMPLEMENTATION

### TypeScript Configuration
```json
// tsconfig.base.json
{
  "compilerOptions": {
    "paths": {
      "@domain/*": ["apps/mobile/src/app/domain/*"],
      "@application/*": ["apps/mobile/src/app/application/*"],
      "@infrastructure/*": ["apps/mobile/src/app/infrastructure/*"],
      "@shared/*": ["apps/mobile/src/app/shared/*"]
    }
  }
}
```

### Dependency Injection
```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    // New DDD services
    { provide: OrganizationFacade, useClass: OrganizationFacade },
    { provide: OrganizationRepository, useClass: OrganizationHttpRepository },

    // Existing services (keep during migration)
    TenantContextService,
    // ... other existing services
  ]
};
```

## 🧪 TESTING STRATEGY

### Test Files Structure
```
tests/
├── domain/
│   ├── organization/
│   │   └── organization.model.spec.ts
│   └── member/
│       └── member.model.spec.ts
├── application/
│   ├── organization.facade.spec.ts
│   └── member.facade.spec.ts
└── infrastructure/
    ├── repositories/
    │   └── organization-http.repository.spec.ts
    └── mappers/
        └── organization.mapper.spec.ts
```

## 📊 SUCCESS METRICS

### Phase 1 Success (Week 1)
- ✅ Organization domain with real business logic
- ✅ OrganizationFacade working with existing services
- ✅ 1+ components using new architecture
- ✅ All existing functionality preserved

### Phase 2 Success (Week 2)
- ✅ Member domain extracted
- ✅ 2-3 more components migrated
- ✅ Clear migration patterns established

### Phase 3 Success (Week 3)
- ✅ Election domain extracted
- ✅ Team can self-service migration
- ✅ Architecture compliance monitoring

## 🚀 IMMEDIATE NEXT STEPS

### Day 1: Foundation
1. **Create folder structure** (domain/, application/, infrastructure/)
2. **Update TypeScript paths** for new aliases
3. **Extract Organization domain** from existing Tenant interface

### Day 2: Integration
1. **Create OrganizationFacade** with bridge to existing services
2. **Update OrganizationListComponent** to use new facade
3. **Add fallback mechanisms** for existing code

### Day 3: Testing
1. **Write TDD tests** for Organization domain
2. **Test integration** between new and existing code
3. **Verify no regression** in existing functionality

## 📝 NOTES

### Key Principles
1. **Incremental Migration**: Never break existing functionality
2. **Extract-Then-Refactor**: Leverage existing code rather than rewrite
3. **Fallback Mechanisms**: Always have working fallbacks during transition
4. **Business Value First**: Each phase delivers immediate value

### Risk Mitigation
- **Preserve existing functionality** during migration
- **Comprehensive testing** before each deployment
- **Team training** on new patterns
- **Clear rollback procedures** if needed

---

**Status**: Structure Plan Complete
**Next Action**: Begin Day 1 Implementation after review
# DDD + Hexagonal Architecture Structure Plan
**Date**: 2025-11-21
**Project**: Public Digit Platform - Angular Mobile App
**Approach**: Incremental Strangler Pattern with Immediate Value

## 🎯 EXECUTIVE SUMMARY

This document outlines the **complete folder structure** and **implementation plan** for transforming the current Angular mobile app from traditional component-based architecture to DDD + Hexagonal Architecture.

## 📁 COMPLETE FOLDER STRUCTURE

### Target Architecture (After Refactoring)
```
apps/mobile/src/app/
├── domain/                          # PURE BUSINESS LOGIC
│   ├── organization/                # Organization Bounded Context
│   │   ├── organization.model.ts    # Rich domain model with behavior
│   │   ├── organization-id.value.ts # Value object for organization IDs
│   │   ├── organization.repository.ts # Repository interface
│   │   └── organization-created.event.ts # Domain events
│   ├── member/                      # Member Bounded Context
│   │   ├── member.model.ts
│   │   ├── member-role.value.ts
│   │   └── member.repository.ts
│   └── election/                    # Election Bounded Context
│       ├── election.model.ts
│       ├── election-status.value.ts
│       └── election.repository.ts
├── application/                     # USE CASE ORCHESTRATION
│   ├── organization.facade.ts       # Application service for Organization
│   ├── member.facade.ts             # Application service for Member
│   └── election.facade.ts           # Application service for Election
├── infrastructure/                  # EXTERNAL DEPENDENCIES
│   ├── repositories/                # Repository implementations
│   │   ├── organization-http.repository.ts
│   │   ├── member-http.repository.ts
│   │   └── election-http.repository.ts
│   ├── mappers/                     # Domain ↔ Infrastructure mapping
│   │   ├── organization.mapper.ts
│   │   ├── member.mapper.ts
│   │   └── election.mapper.ts
│   └── shared/                      # Shared infrastructure
│       ├── event-bus.ts             # Event bus implementation
│       └── http-client.ts           # HTTP client wrapper
├── features/                        # EXISTING: Keep during migration
│   ├── membership/                  # ← Gradually extract to domain/member/
│   ├── elections/                   # ← Gradually extract to domain/election/
│   └── finance/                     # ← Keep as-is for now
├── core/                           # EXISTING: Keep during migration
│   ├── guards/
│   ├── interceptors/
│   ├── models/
│   └── services/
├── components/                      # EXISTING: Update incrementally
│   ├── header/ 
│   ├── hero/
│   └── features/
├── pages/                          # EXISTING: Update incrementally
│   ├── login/
│   ├── tenant-selection/
│   └── dashboard/
└── landing/                        # EXISTING: Keep as-is
    └── landing.component.ts
```

## 🔄 MIGRATION STRATEGY

### Phase 1: Organization Domain (Week 1)
**Extract from existing code**:
- `core/services/tenant-context.service.ts` → `domain/organization/organization.model.ts`
- `features/membership/models/member.models.ts` → Additional organization logic

### Phase 2: Member Domain (Week 2)
**Extract from existing code**:
- `features/membership/models/member.models.ts` → `domain/member/member.model.ts`
- `features/membership/services/` → `domain/member/` + `application/member.facade.ts`

### Phase 3: Election Domain (Week 3)
**Extract from existing code**:
- `features/elections/` → `domain/election/` + `application/election.facade.ts`

## 📋 FILE SPECIFICATIONS

### Domain Layer Files

#### `domain/organization/organization.model.ts`
```typescript
// Rich domain model with business behavior
class Organization {
  constructor(
    public readonly id: OrganizationId,
    public readonly name: string,
    public readonly type: 'POLITICAL_PARTY' | 'NGO',
    private memberCount: number,
    private createdAt: Date
  ) {}

  // Business methods (currently scattered in services)
  static create(name: string, type: string): Organization {
    // Extract validation from existing services
    if (!name?.trim()) throw new Error('Organization name required');
    if (!['POLITICAL_PARTY', 'NGO'].includes(type)) throw new Error('Invalid type');

    return new Organization(
      OrganizationId.generate(),
      name.trim(),
      type,
      0,
      new Date()
    );
  }

  addMember(): void {
    this.memberCount++;
    // Business logic currently in services
  }
}
```

#### `domain/organization/organization.repository.ts`
```typescript
// Repository interface (abstraction)
interface OrganizationRepository {
  findAll(): Observable<Organization[]>;
  findById(id: OrganizationId): Observable<Organization | null>;
  save(organization: Organization): Observable<void>;
}
```

### Application Layer Files

#### `application/organization.facade.ts`
```typescript
// Application service that orchestrates use cases
@Injectable()
export class OrganizationFacade {
  constructor(
    private organizationRepository: OrganizationRepository,
    private existingTenantService: TenantContextService // Bridge to existing
  ) {}

  // Use new domain but work with existing services
  getOrganizations(): Observable<Organization[]> {
    return this.existingTenantService.tenant$.pipe(
      map(tenants => tenants?.map(tenant => Organization.fromExisting(tenant)) || [])
    );
  }
}
```

### Infrastructure Layer Files

#### `infrastructure/repositories/organization-http.repository.ts`
```typescript
// Repository implementation
@Injectable()
export class OrganizationHttpRepository implements OrganizationRepository {
  constructor(private http: HttpClient) {}

  findAll(): Observable<Organization[]> {
    return this.http.get<OrganizationDto[]>('/api/organizations').pipe(
      map(dtos => dtos.map(dto => OrganizationMapper.toDomain(dto)))
    );
  }
}
```

## 🎯 COMPONENT MIGRATION PLAN

### Components to Update (Incremental)

#### 1. Organization List Component
**Current**: `components/features/features.component.ts`
**Migration**: Use `OrganizationFacade` instead of direct service calls

#### 2. Tenant Selection Component
**Current**: `auth/tenant-selection/tenant-selection.component.ts`
**Migration**: Use `OrganizationFacade` for organization data

#### 3. Member Registration Component
**Current**: `features/membership/components/`
**Migration**: Use `MemberFacade` instead of direct service calls

## 🔧 TECHNICAL IMPLEMENTATION

### TypeScript Configuration
```json
// tsconfig.base.json
{
  "compilerOptions": {
    "paths": {
      "@domain/*": ["apps/mobile/src/app/domain/*"],
      "@application/*": ["apps/mobile/src/app/application/*"],
      "@infrastructure/*": ["apps/mobile/src/app/infrastructure/*"],
      "@shared/*": ["apps/mobile/src/app/shared/*"]
    }
  }
}
```

### Dependency Injection
```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    // New DDD services
    { provide: OrganizationFacade, useClass: OrganizationFacade },
    { provide: OrganizationRepository, useClass: OrganizationHttpRepository },

    // Existing services (keep during migration)
    TenantContextService,
    // ... other existing services
  ]
};
```

## 🧪 TESTING STRATEGY

### Test Files Structure
```
tests/
├── domain/
│   ├── organization/
│   │   └── organization.model.spec.ts
│   └── member/
│       └── member.model.spec.ts
├── application/
│   ├── organization.facade.spec.ts
│   └── member.facade.spec.ts
└── infrastructure/
    ├── repositories/
    │   └── organization-http.repository.spec.ts
    └── mappers/
        └── organization.mapper.spec.ts
```

## 📊 SUCCESS METRICS

### Phase 1 Success (Week 1)
- ✅ Organization domain with real business logic
- ✅ OrganizationFacade working with existing services
- ✅ 1+ components using new architecture
- ✅ All existing functionality preserved

### Phase 2 Success (Week 2)
- ✅ Member domain extracted
- ✅ 2-3 more components migrated
- ✅ Clear migration patterns established

### Phase 3 Success (Week 3)
- ✅ Election domain extracted
- ✅ Team can self-service migration
- ✅ Architecture compliance monitoring

## 🚀 IMMEDIATE NEXT STEPS

### Day 1: Foundation
1. **Create folder structure** (domain/, application/, infrastructure/)
2. **Update TypeScript paths** for new aliases
3. **Extract Organization domain** from existing Tenant interface

### Day 2: Integration
1. **Create OrganizationFacade** with bridge to existing services
2. **Update OrganizationListComponent** to use new facade
3. **Add fallback mechanisms** for existing code

### Day 3: Testing
1. **Write TDD tests** for Organization domain
2. **Test integration** between new and existing code
3. **Verify no regression** in existing functionality

## 📝 NOTES

### Key Principles
1. **Incremental Migration**: Never break existing functionality
2. **Extract-Then-Refactor**: Leverage existing code rather than rewrite
3. **Fallback Mechanisms**: Always have working fallbacks during transition
4. **Business Value First**: Each phase delivers immediate value

### Risk Mitigation
- **Preserve existing functionality** during migration
- **Comprehensive testing** before each deployment
- **Team training** on new patterns
- **Clear rollback procedures** if needed

---

**Status**: Structure Plan Complete
**Next Action**: Begin Day 1 Implementation after review