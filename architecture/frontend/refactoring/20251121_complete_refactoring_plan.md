# Complete DDD + Hexagonal Architecture Refactoring Plan
**Date**: 2025-11-21
**Project**: Public Digit Platform - Angular Mobile App
**Architecture**: Domain-Driven Design + Hexagonal Architecture
**Approach**: TDD-First with Architecture Guardrails

## 🎯 EXECUTIVE SUMMARY

This document outlines the complete refactoring plan to transform the current Angular mobile app from a traditional component-based architecture to a robust DDD + Hexagonal Architecture. The plan follows a phased approach with automated architecture enforcement to ensure long-term maintainability.

## 📋 CURRENT STATE ANALYSIS

### Current Architecture Issues
- **Anemic Domain Models**: Data containers without behavior
- **Mixed Concerns**: Services handle infrastructure + business logic
- **Direct Infrastructure Dependencies**: HTTP client in domain services
- **Missing Layers**: No clear Domain/Application/Infrastructure separation
- **No Repository Pattern**: Direct data access without abstraction
- **Missing Domain Events**: Synchronous coupling between contexts

### Target Architecture
```
src/app/
├── domain/                        # Pure business logic
│   ├── contexts/                  # Bounded Contexts
│   │   ├── organization/          # Organization Context
│   │   ├── member/                # Member Context
│   │   ├── election/              # Election Context
│   │   └── transparency/          # Transparency Context
│   └── shared/                    # Shared kernel
├── application/                   # Use case orchestration
│   ├── use-cases/                 # Application services
│   ├── commands/                  # Write operations
│   ├── queries/                   # Read operations
│   └── dtos/                      # Data transfer objects
└── infrastructure/                # External dependencies
    ├── repositories/              # Data access implementations
    ├── services/                  # External service adapters
    └── adapters/                  # Framework adapters
```

## 🚀 PHASED IMPLEMENTATION PLAN

### PHASE 1: ARCHITECTURE GUARDRALS (Week 1)
**Goal**: Establish unbreakable architectural boundaries before writing functional code

#### 1.1 TSConfig Path Mapping
**File**: `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@public-digit/domain/*": ["apps/mobile/src/app/domain/*/src/index.ts"],
      "@public-digit/application/*": ["apps/mobile/src/app/application/*/src/index.ts"],
      "@public-digit/infrastructure/*": ["apps/mobile/src/app/infrastructure/*/src/index.ts"],
      "@public-digit/shared/*": ["apps/mobile/src/app/shared/*/src/index.ts"],
      "@public-digit/features/*": ["apps/mobile/src/app/features/*/src/index.ts"]
    }
  }
}
```

#### 1.2 Barrel Export Index Files
**Pattern**: Each layer exports only its public API

**Domain Layer** (`domain/organization/src/index.ts`):
```typescript
export { Organization } from './lib/entities/organization.entity';
export { OrganizationRepository } from './lib/repositories/organization.repository';
export { OrganizationCreatedEvent } from './lib/events/organization-created.event';
// ❌ NOT exported: internal domain services, value objects
```

**Application Layer** (`application/organization/src/index.ts`):
```typescript
export { CreateOrganizationCommand } from './lib/commands/create-organization/create-organization.command';
export { GetOrganizationQuery } from './lib/queries/get-organization/get-organization.query';
export { OrganizationFacadeService } from './lib/services/organization-facade.service';
// ❌ NOT exported: handlers, internal DTOs
```

#### 1.3 ESLint Layer Restriction Rules
**File**: `.eslintrc.js`
```javascript
module.exports = {
  rules: {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["@public-digit/domain/*"],
          "importNames": ["default"],
          "message": "Domain imports restricted - use application layer instead"
        },
        {
          "group": ["@public-digit/infrastructure/*"],
          "importNames": ["default"],
          "message": "Infrastructure should not be imported directly"
        }
      ]
    }]
  }
};
```

#### 1.4 Architecture Validation Script
**File**: `tools/architecture/validate-structure.js`
```javascript
const ARCHITECTURE_RULES = {
  'apps/mobile/src/app/domain': {
    allowed: ['entities/', 'value-objects/', 'repositories/', 'events/'],
    forbidden: ['components/', 'services/', '*.component.ts']
  },
  'apps/mobile/src/app/application': {
    allowed: ['commands/', 'queries/', 'dtos/', 'services/'],
    forbidden: ['entities/', 'components/']
  },
  'apps/mobile/src/app/infrastructure': {
    allowed: ['repositories/', 'services/', 'mappers/', 'interceptors/'],
    forbidden: ['entities/', 'commands/']
  }
};
```

### PHASE 2: DOMAIN LAYER IMPLEMENTATION (Week 2)
**Goal**: Implement core domain models with TDD approach

#### 2.1 Organization Domain
**File**: `domain/organization/src/lib/entities/organization.entity.ts`
```typescript
class Organization {
  constructor(
    public readonly id: OrganizationId,
    public readonly name: OrganizationName,
    public readonly type: OrganizationType,
    private memberCount: number,
    private createdAt: Date
  ) {}

  static create(data: CreateOrganizationCommand): Organization {
    // Business validation
    if (!data.name) throw new InvalidOrganizationError('Name required');

    return new Organization(
      OrganizationId.create(),
      OrganizationName.create(data.name),
      OrganizationType.create(data.type),
      0,
      new Date()
    );
  }

  addMember(): void {
    this.memberCount++;
    this.addDomainEvent(new MemberAddedEvent(this.id, this.memberCount));
  }
}
```

#### 2.2 Value Objects
**File**: `domain/organization/src/lib/value-objects/organization-id.value.ts`
```typescript
class OrganizationId {
  constructor(private readonly value: string) {}

  static create(): OrganizationId {
    return new OrganizationId(`org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  }

  equals(other: OrganizationId): boolean {
    return this.value === other.value;
  }
}
```

#### 2.3 Repository Interfaces
**File**: `domain/organization/src/lib/repositories/organization.repository.ts`
```typescript
interface OrganizationRepository {
  findAll(): Observable<Organization[]>;
  findById(id: OrganizationId): Observable<Organization | null>;
  findByType(type: OrganizationType): Observable<Organization[]>;
  save(organization: Organization): Observable<void>;
}
```

#### 2.4 Domain Events
**File**: `domain/organization/src/lib/events/organization-created.event.ts`
```typescript
class OrganizationCreatedEvent implements DomainEvent {
  constructor(
    public readonly organizationId: OrganizationId,
    public readonly organizationName: OrganizationName,
    public readonly timestamp: Date
  ) {}
}
```

### PHASE 3: APPLICATION LAYER (Week 3)
**Goal**: Implement use case orchestration and CQRS pattern

#### 3.1 Commands
**File**: `application/organization/src/lib/commands/create-organization/create-organization.command.ts`
```typescript
class CreateOrganizationCommand {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly description: string
  ) {}
}
```

#### 3.2 Queries
**File**: `application/organization/src/lib/queries/get-organizations/get-organizations.query.ts`
```typescript
class GetOrganizationsQuery {
  constructor(
    public readonly type?: string,
    public readonly limit?: number
  ) {}
}
```

#### 3.3 Use Case Services
**File**: `application/organization/src/lib/services/create-organization.use-case.ts`
```typescript
@Injectable()
class CreateOrganizationUseCase {
  constructor(
    private organizationRepository: OrganizationRepository,
    private eventBus: EventBus
  ) {}

  execute(command: CreateOrganizationCommand): Observable<Organization> {
    const organization = Organization.create(command);

    return this.organizationRepository.save(organization).pipe(
      tap(() => this.eventBus.publishAll(organization.getDomainEvents())),
      map(() => organization)
    );
  }
}
```

### PHASE 4: INFRASTRUCTURE LAYER (Week 4)
**Goal**: Implement external dependencies and adapters

#### 4.1 Repository Implementations
**File**: `infrastructure/repositories/src/lib/organization-http.repository.ts`
```typescript
@Injectable()
class OrganizationHttpRepository implements OrganizationRepository {
  constructor(private httpClient: HttpClient) {}

  findAll(): Observable<Organization[]> {
    return this.httpClient.get<OrganizationDto[]>('/api/organizations').pipe(
      map(dtos => dtos.map(dto => OrganizationMapper.toDomain(dto)))
    );
  }
}
```

#### 4.2 Mappers
**File**: `infrastructure/mappers/src/lib/organization.mapper.ts`
```typescript
class OrganizationMapper {
  static toDomain(dto: OrganizationDto): Organization {
    return new Organization(
      OrganizationId.create(dto.id),
      OrganizationName.create(dto.name),
      OrganizationType.create(dto.type),
      dto.memberCount,
      new Date(dto.createdAt)
    );
  }

  static toDto(organization: Organization): OrganizationDto {
    return {
      id: organization.id.toString(),
      name: organization.name.toString(),
      type: organization.type.toString(),
      memberCount: organization.memberCount,
      createdAt: organization.createdAt.toISOString()
    };
  }
}
```

### PHASE 5: COMPONENT REFACTORING (Week 5)
**Goal**: Update existing components to use new DDD architecture

#### 5.1 Component Migration Pattern
**Before**:
```typescript
@Component()
export class OrganizationListComponent {
  organizations: any[] = [];

  constructor(private organizationService: OrganizationService) {}

  ngOnInit() {
    this.organizationService.getOrganizations().subscribe(orgs => {
      this.organizations = orgs;
    });
  }
}
```

**After**:
```typescript
@Component()
export class OrganizationListComponent {
  organizations: Organization[] = [];

  constructor(private getOrganizationsUseCase: GetOrganizationsUseCase) {}

  ngOnInit() {
    this.getOrganizationsUseCase.execute(new GetOrganizationsQuery())
      .subscribe(organizations => {
        this.organizations = organizations;
      });
  }
}
```

## 🧪 TESTING STRATEGY

### TDD Approach: Red-Green-Refactor Cycle

#### 2.1 Domain Model Tests
**File**: `domain/organization/src/lib/entities/organization.entity.spec.ts`
```typescript
describe('Organization', () => {
  it('should create organization with valid data', () => {
    // RED: Write failing test
    const organization = Organization.create({
      name: 'Test Organization',
      type: 'POLITICAL_PARTY'
    });

    // GREEN: Make test pass
    expect(organization).toBeInstanceOf(Organization);
    expect(organization.name.toString()).toBe('Test Organization');
  });

  it('should throw error for invalid organization name', () => {
    // RED
    expect(() => Organization.create({
      name: '',
      type: 'POLITICAL_PARTY'
    })).toThrow(InvalidOrganizationError);
  });
});
```

#### 2.2 Use Case Tests
**File**: `application/organization/src/lib/services/create-organization.use-case.spec.ts`
```typescript
describe('CreateOrganizationUseCase', () => {
  let useCase: CreateOrganizationUseCase;
  let mockRepository: jest.Mocked<OrganizationRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn()
    } as any;
    mockEventBus = {
      publishAll: jest.fn()
    } as any;

    useCase = new CreateOrganizationUseCase(mockRepository, mockEventBus);
  });

  it('should create and save organization', (done) => {
    const command = new CreateOrganizationCommand('Test Org', 'POLITICAL_PARTY', 'Test description');

    mockRepository.save.mockReturnValue(of(undefined));

    useCase.execute(command).subscribe(organization => {
      expect(organization).toBeInstanceOf(Organization);
      expect(mockRepository.save).toHaveBeenCalledWith(organization);
      expect(mockEventBus.publishAll).toHaveBeenCalled();
      done();
    });
  });
});
```

## 🔧 TECHNICAL IMPLEMENTATION DETAILS

### Dependency Injection Configuration
**File**: `apps/mobile/src/app/app.config.ts`
```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    // Domain layer - no dependencies
    // Application layer - depends on domain interfaces
    { provide: GetOrganizationsUseCase, useClass: GetOrganizationsUseCase },
    // Infrastructure layer - implements domain interfaces
    { provide: OrganizationRepository, useClass: OrganizationHttpRepository },
    // Cross-cutting concerns
    { provide: EventBus, useClass: InMemoryEventBus }
  ]
};
```

### Layer Access Rules
```typescript
// ✅ ALLOWED: Presentation → Application
import { GetOrganizationsUseCase } from '@public-digit/application/organization';

// ✅ ALLOWED: Application → Domain
import { Organization } from '@public-digit/domain/organization';

// ✅ ALLOWED: Infrastructure → Domain
import { OrganizationRepository } from '@public-digit/domain/organization';

// ❌ FORBIDDEN: Presentation → Domain (bypasses application layer)
// import { Organization } from '@public-digit/domain/organization';

// ❌ FORBIDDEN: Domain → Infrastructure (dependency inversion)
// import { OrganizationHttpRepository } from '@public-digit/infrastructure/repositories';
```

## 📊 SUCCESS METRICS

### Architecture Quality
- **100%** layer boundary compliance
- **0** direct infrastructure dependencies in domain
- **80%+** test coverage for domain models
- **All** domain models with behavior (not anemic)

### Code Quality
- **Reduced** cyclomatic complexity in services
- **Increased** domain logic encapsulation
- **Improved** testability of business rules
- **Clear** separation of concerns

### Development Velocity
- **Faster** onboarding for new developers
- **Easier** feature development within bounded contexts
- **Reduced** regression bugs through domain validation
- **Better** team collaboration with clear context boundaries

## 🚨 RISK MITIGATION

### Technical Risks
1. **Performance Overhead**: Monitor repository pattern impact
2. **Complexity**: Ensure gradual adoption with clear examples
3. **Team Learning Curve**: Provide comprehensive documentation

### Mitigation Strategies
1. **Incremental Migration**: Refactor one context at a time
2. **Comprehensive Testing**: Maintain 80%+ test coverage
3. **Architecture Validation**: Automated build-time checks
4. **Documentation**: Clear examples and patterns

## 📅 IMPLEMENTATION TIMELINE

### Week 1: Architecture Guardrails
- Day 1-2: TSConfig path mapping
- Day 3-4: Barrel exports and ESLint rules
- Day 5-7: Architecture validation script

### Week 2: Organization Domain
- Day 1-2: Organization entity and value objects
- Day 3-4: Repository interface and domain events
- Day 5-7: Domain service and TDD tests

### Week 3: Application Layer
- Day 1-2: Commands and queries
- Day 3-4: Use case services
- Day 5-7: Application layer tests

### Week 4: Infrastructure Layer
- Day 1-2: HTTP repository implementations
- Day 3-4: Mappers and adapters
- Day 5-7: Infrastructure tests

### Week 5: Component Refactoring
- Day 1-3: Organization-related components
- Day 4-5: Member-related components
- Day 6-7: Integration testing and documentation

## 🎯 DELIVERABLES

### Phase 1 Deliverables
- ✅ TSConfig path mapping for DDD layers
- ✅ Barrel export index files
- ✅ ESLint layer restriction rules
- ✅ Architecture validation script

### Phase 2 Deliverables
- ✅ Organization domain with rich models
- ✅ Value objects for domain primitives
- ✅ Repository interfaces
- ✅ Domain events

### Phase 3 Deliverables
- ✅ Application use cases
- ✅ CQRS commands and queries
- ✅ Application layer tests

### Phase 4 Deliverables
- ✅ Infrastructure repository implementations
- ✅ Mappers for domain ↔ infrastructure
- ✅ Dependency injection configuration

### Phase 5 Deliverables
- ✅ Refactored components using DDD architecture
- ✅ Comprehensive test suite
- ✅ Architecture documentation

## 🔗 DEPENDENCIES

### External Dependencies
- **Angular**: Latest version (already in use)
- **RxJS**: Reactive programming (already in use)
- **Jest**: Testing framework (already in use)

### Internal Dependencies
- **Existing Laravel Backend**: API endpoints remain unchanged
- **Current Mobile App**: Maintain backward compatibility during migration
- **Development Team**: Training on DDD patterns

## 📝 NEXT STEPS

1. **Review and Approval**: Stakeholder review of this plan
2. **Team Training**: DDD and Hexagonal Architecture training
3. **Implementation**: Begin Phase 1 architecture guardrails
4. **Continuous Integration**: Set up automated architecture validation
5. **Documentation**: Create developer guides and examples

---

**Status**: Plan Ready for Review
**Next Action**: Begin Phase 1 Implementation after approval