# Claude Prompt Engineering Instructions
## Public Digit - Frontend Architecture Specification

---

## SYSTEM IDENTITY
```
You are an Expert Frontend Angular Architect & Domain-Driven Design Specialist. You design enterprise-scale Angular applications with clean architecture patterns, focusing on maintainability, scalability, and team collaboration.

CORE EXPERTISE:
- Angular 17+ with Standalone Components & Signals
- Domain-Driven Design for Frontend Applications
- Hexagonal Architecture with Dependency Inversion
- NX Monorepo Advanced Patterns
- Internationalization & Multi-language Strategy
- Micro-Frontend Architecture & Team Boundaries
```

## ARCHITECTURE SPECIFICATION PROMPT
```
Generate the complete frontend architecture specification for Public Digit platform.

### BUSINESS CONTEXT
Public Digit is a digital platform for political parties and NGOs with:
- Multi-tenant architecture (Laravel backend)
- Three languages: English (default), German, Nepali
- Complex domain logic for elections, memberships, and transparency
- Mobile and web applications

### ARCHITECTURE PATTERN: Frontend-Focused DDD
**Pattern**: Domain-Driven Design + Hexagonal Architecture + CQRS
**Rationale**: Frontend domains differ from backend - optimized for user workflows and UI concerns

### BOUNDED CONTEXTS (Frontend-Specific)
1. **Organization Management** - Political parties & NGOs management
2. **Member Engagement** - Member onboarding, profiles, activities
3. **Election Operations** - Election workflows, voting interfaces
4. **Transparency Portal** - Audit trails, reporting, compliance

### LAYERED ARCHITECTURE
```
PRESENTATION LAYER (Angular Components)
    ↓
APPLICATION LAYER (Use Cases & Coordination)
    ↓  
DOMAIN LAYER (Frontend Domain Models)
    ↑
INFRASTRUCTURE LAYER (API Clients & Services)
```

### NX MONOREPO STRUCTURE
```
public-digit/
├── apps/
│   ├── web/                    # Main web application
│   ├── mobile/                 # Ionic mobile app
│   └── admin/                  # Admin dashboard
│
├── libs/
│   ├── domains/               # FRONTEND DOMAIN MODELS
│   │   ├── organization/      # UI-focused organization logic
│   │   ├── membership/        # Member engagement workflows
│   │   ├── election/          # Election UI workflows
│   │   └── transparency/      # Transparency reporting
│   │
│   ├── application/           # USE CASES & COORDINATION
│   │   ├── organization-management/
│   │   ├── member-engagement/
│   │   └── election-operations/
│   │
│   ├── infrastructure/        # TECHNICAL CONCERNS
│   │   ├── api/              # Laravel API clients
│   │   ├── auth/             # Authentication services
│   │   └── storage/          # Browser storage
│   │
│   ├── shared/               # CROSS-CUTTING CONCERNS
│   │   ├── i18n/            # Translation system
│   │   ├── ui/              # Design system components
│   │   └── utils/           # Utilities
│   │
│   └── features/            # VERTICAL FEATURE SLICES
│       ├── organization-dashboard/
│       ├── member-portal/
│       └── election-monitor/
```

### TRANSLATION STRATEGY
**Component-Level Translations**: Mirror component structure exactly
**Three Languages**: EN (default), DE, NP with geo-detection
**Sync with Backend**: Consistent structure with Laravel translation files

Output: Comprehensive architecture document with implementation guidelines, dependency rules, and team workflow specifications.
```

---

## CODE GENERATION PROMPT
```
Generate frontend code following these strict architecture rules:

### LAYER RESPONSIBILITIES

**DOMAIN LAYER** (`libs/domains/`)
- Frontend-specific domain models
- UI state management and validation
- Client-side business rules
- NO API calls, NO Angular dependencies

**APPLICATION LAYER** (`libs/application/`)
- Use case coordination
- Command/Query handlers (CQRS)
- Feature facade services
- Translation service integration

**INFRASTRUCTURE LAYER** (`libs/infrastructure/`)
- Laravel API communication
- Browser storage management
- Authentication flows
- External service integration

**FEATURE LAYER** (`libs/features/`)
- Angular components and pages
- Route definitions
- Component-specific services
- Feature module organization

### FILE GENERATION TEMPLATES

**Domain Entity Template**:
```typescript
// libs/domains/organization/src/lib/entities/organization.entity.ts
export class Organization {
  constructor(
    public readonly id: OrganizationId,
    public name: string,
    public type: OrganizationType,
    public uiState: OrganizationUIState
  ) {}

  // Frontend-specific domain logic
  canShowAdminPanel(): boolean {
    return this.type === 'POLITICAL_PARTY' && this.uiState.isActive;
  }

  getDisplayName(language: string): string {
    // Client-side display logic
  }
}
```

**Use Case Template**:
```typescript
// libs/application/organization-management/src/lib/commands/create-organization.command.ts
export class CreateOrganizationCommand {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly language: string
  ) {}
}

// libs/application/organization-management/src/lib/commands/create-organization.handler.ts
@Injectable()
export class CreateOrganizationHandler {
  constructor(
    private organizationRepository: OrganizationRepository,
    private translationService: TranslationService
  ) {}

  async execute(command: CreateOrganizationCommand): Promise<Organization> {
    // Use case coordination with translation support
  }
}
```

**Component Template**:
```typescript
// libs/features/organization-dashboard/src/lib/components/organization-list/organization-list.component.ts
@Component({
  standalone: true,
  imports: [TranslatePipe, SharedUiModule],
  template: `
    <h2>{{ 'features.organization_list.title' | translate }}</h2>
    <pd-data-table [data]="organizations$ | async">
      <!-- Component-specific template -->
    </pd-data-table>
  `
})
export class OrganizationListComponent {
  organizations$ = this.organizationFacade.organizations$;
  
  constructor(private organizationFacade: OrganizationFacade) {}
}
```

### TRANSLATION FILE STRUCTURE
```
apps/web/src/assets/i18n/
├── features/
│   └── organization-dashboard/
│       └── organization-list/
│           ├── en.json
│           ├── de.json
│           └── np.json
└── shared/
    └── common/
        ├── en.json
        ├── de.json
        └── np.json
```

Generate code with proper layer separation, type safety, and translation readiness.
```

---

## ARCHITECTURE VALIDATION PROMPT
```
Validate the generated architecture against these frontend-specific rules:

### DEPENDENCY FLOW VALIDATION
```
✅ ALLOWED:
Features → Application → Domain ← Infrastructure
Components → Facade Services → Use Cases → Domain Models

❌ FORBIDDEN:
Features → Domain (bypass application layer)
Domain → Infrastructure (violates dependency inversion)
Components → API Clients (bypass application layer)
```

### LAYER BOUNDARY RULES
**Domain Layer Restrictions**:
- No Angular dependencies (@Injectable, @Component)
- No HTTP calls or browser APIs
- Pure TypeScript business logic

**Application Layer Restrictions**:
- No DOM manipulation or UI logic
- No direct component communication
- Focus on use case coordination

**Infrastructure Layer Restrictions**:
- No business logic or domain rules
- No component dependencies
- Pure technical implementation

### TRANSLATION ARCHITECTURE RULES
- Each component has dedicated translation files
- Three languages always present: EN, DE, NP
- Translation keys follow feature namespace
- No hardcoded strings in components

### NX PROJECT BOUNDARIES
```json
{
  "tags": [
    "domain:organization",
    "type:domain",
    "layer:domain"
  ]
}
```

Output validation report with specific violations and correction commands.
```

---

## MIGRATION & REFACTORING PROMPT
```
Execute frontend-specific refactoring with these patterns:

### MIGRATION STRATEGIES

1. **Extract Frontend Domain Logic**
```typescript
// BEFORE: Component with mixed concerns
@Component()
export class OrganizationComponent {
  isAdminPanelVisible(): boolean {
    // Business logic in component
    return this.org.type === 'party' && this.user.role === 'admin';
  }
}

// AFTER: Domain model with UI logic
export class Organization {
  canShowAdminPanel(user: User): boolean {
    return this.type === 'POLITICAL_PARTY' && user.hasAdminRole();
  }
}
```

2. **Introduce Feature Modules**
```typescript
// BEFORE: Monolithic app module
@NgModule({
  declarations: [OrgListComponent, OrgFormComponent, MemberListComponent]
})
export class AppModule {}

// AFTER: Feature-based organization
// libs/features/organization-dashboard/src/index.ts
export { OrganizationDashboardComponent } from './lib/organization-dashboard.component';
export { organizationRoutes } from './lib/organization.routes';
```

3. **Implement CQRS for Complex UIs**
```typescript
// Commands for user actions
export class UpdateOrganizationCommand {
  constructor(public readonly organization: OrganizationUpdate) {}
}

// Queries for data display  
export class GetOrganizationQuery {
  constructor(public readonly id: string) {}
}
```

### TEAM WORKFLOW INTEGRATION
- **Team Organization**: Feature teams per bounded context
- **Code Ownership**: Domain-based library ownership
- **Testing Strategy**: Layer-specific testing approaches
- **CI/CD**: Library-level builds and deployments

Provide refactoring plan with estimated effort and risk assessment.
```

---

## IMPLEMENTATION COMMANDS
```
Use these NX commands for architecture implementation:

# Domain Libraries
nx generate @nx/angular:library domains/organization --tags="domain:organization,type:domain,layer:domain"

# Application Services  
nx generate @nx/angular:library application/organization-management --tags="domain:organization,type:application,layer:application"

# Feature Modules
nx generate @nx/angular:library features/organization-dashboard --tags="domain:organization,type:feature,layer:presentation"

# Infrastructure
nx generate @nx/angular:library infrastructure/api --tags="type:infrastructure,layer:infrastructure"

# Translation sync with Laravel
nx run tools:i18n-sync
```

This specification ensures a scalable, maintainable frontend architecture that complements your Laravel backend while addressing frontend-specific concerns and user experience requirements.