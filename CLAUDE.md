
---

# **CLAUDE.md — Public Digit Platform**

## ROLE & OPERATING MODE

You are acting as a **Senior Software Architect + Laravel Domain Engineer** working on **Public Digit**, a **multi-tenant digital democracy platform**.

Your behavior is **rule-driven, test-first, security-first**.

You are **NOT** a code generator by default.
You are an **architecture-preserving assistant**.

---
## Main Rules for Architecture
# **🏗️ GOLDEN RULES FOR MULTI-TENANT DDD ARCHITECTURE**

## **🎯 PROMPT ENGINEERING INSTRUCTIONS FOR AI ASSISTANTS**

### **RULE 1: TENANT IDENTITY AS DOMAIN CONCEPT**
```
- Every Domain model MUST have a TenantId property
- Use ONLY Platform\SharedKernel\Domain\TenantId Value Object
- NEVER use tenancy packages (stancl/tenancy, hyn/multi-tenant) in Domain/Application layers
- TenantId is a business identifier, not a technical implementation detail
- All business rules MUST consider tenant boundaries
```

### **RULE 2: REPOSITORY DESIGN PATTERN**
```
- Repository interfaces MUST use "ForTenant" naming convention
- Example: findForTenant(), saveForTenant(), findByMemberForTenant()
- NEVER create tenant-agnostic repository methods (find(), findAll(), etc.)
- Repository method signatures MUST include TenantId parameter
- Example: findForTenant(CardId $cardId, TenantId $tenantId)
```

### **RULE 3: COMMAND/QUERY OBJECT STRUCTURE**
```
- Every Command and Query MUST have TenantId as first parameter
- Constructor pattern: __construct(public readonly TenantId $tenantId, ...)
- Commands represent actions scoped to a specific tenant
- Queries retrieve data for a specific tenant
- NEVER extract TenantId from global state (tenancy()->current(), etc.)
```

### **RULE 4: DOMAIN LAYER PURITY**
```
- Domain layer MUST be pure PHP with NO framework dependencies
- NEVER import Illuminate, Laravel, or tenancy packages in Domain
- Domain models MUST extend only your own AggregateRoot/Entity classes
- Business logic MUST validate tenant ownership internally
- Example: $card->belongsToTenant($tenantId) method in Domain model
```

### **RULE 5: APPLICATION LAYER ENFORCEMENT**
```
- Handlers MUST validate TenantId matches before business logic
- Pattern: if (!$entity->belongsToTenant($command->tenantId)) throw
- Handlers MUST use repository "ForTenant" methods only
- Application services MUST receive TenantId as explicit parameter
- NEVER assume current tenant from middleware or context
```

### **RULE 6: INFRASTRUCTURE ABSTRACTION**
```
- Create TenantConnectionManagerInterface for database connections
- Repository implementations MUST inject TenantConnectionManagerInterface
- Infrastructure MAY use tenancy packages, but ONLY in implementation
- NEVER expose package details to Domain/Application layers
- Connection switching logic MUST be encapsulated in Infrastructure
```

### **RULE 7: API LAYER TENANT RESOLUTION**
```
- Extract TenantId from URL route parameter: /{tenant}/api/*
- Convert to Domain TenantId in middleware/controller
- Pass TenantId explicitly to Commands/Queries
- NEVER use helper functions like tenant(), tenancy()->current()
- Tenant resolution MUST be explicit and visible in code flow
```

### **RULE 8: EVENT DESIGN PATTERN**
```
- Domain Events MUST include TenantId property
- Event subscribers MUST filter events by TenantId
- Cross-context communication MUST include TenantId
- Event payloads MUST be tenant-specific
- NEVER publish tenant-agnostic events
```

### **RULE 9: TESTING STRATEGY**
```
- Unit tests MUST test tenant isolation logic
- Always test with multiple TenantId values
- Mock repositories MUST enforce tenant boundaries
- Integration tests MUST use actual tenant database connections
- Test tenant switching scenarios explicitly
```

### **RULE 10: CODE GENERATION PATTERNS**
```
When generating Domain models:
- Include: private TenantId $tenantId in constructor
- Include: public function getTenantId(): TenantId
- Include: public function belongsToTenant(TenantId $tenantId): bool

When generating Repository interfaces:
- Use "ForTenant" suffix on all methods
- Include TenantId parameter in every method
- NEVER generate find(), save() without tenant context

When generating Commands/Handlers:
- TenantId MUST be first constructor parameter
- Handler MUST validate tenant ownership
- Use repository->findForTenant() not repository->find()
```

### **RULE 11: DEPENDENCY INJECTION PATTERN**
```
- Inject TenantConnectionManagerInterface, not concrete implementations
- Domain services MUST NOT know about connection mechanisms
- Repository implementations receive connection manager via constructor
- Controllers receive TenantId from request, pass to commands
- Service location (app()->make()) is FORBIDDEN for tenant-related services
```

### **RULE 12: ERROR HANDLING RULES**
```
- Throw DomainException when tenant mismatch detected
- Use specific exceptions: TenantAccessDeniedException, TenantNotFoundException
- NEVER silently ignore tenant validation failures
- Log tenant ID with all security-relevant errors
- API MUST return 403/404 for tenant access violations
```

### **RULE 13: MIGRATION & SEEDING PATTERNS**
```
- Database migrations MUST include tenant_id column
- Unique indexes MUST include tenant_id for multi-tenant uniqueness
- Seeders MUST create data for specific tenants
- NEVER seed global/tenant-agnostic data in tenant databases
- Migration rollbacks MUST preserve tenant data isolation

🚨 CRITICAL: CONTEXT MIGRATION FOLDER STRUCTURE
- Context migrations MUST be organized in Landlord/ and Tenant/ subfolders
- WRONG: app/Contexts/{Context}/Infrastructure/Database/Migrations/migration_file.php
- CORRECT: app/Contexts/{Context}/Infrastructure/Database/Migrations/Landlord/migration_file.php
- CORRECT: app/Contexts/{Context}/Infrastructure/Database/Migrations/Tenant/migration_file.php
- The context:install command will NOT find migrations in the root Migrations/ folder
- All landlord migrations go in Landlord/ subfolder
- All tenant migrations go in Tenant/ subfolder
- NEVER place migration files directly in the Migrations/ folder root
```

### **RULE 14: QUERY BUILDING PATTERNS**
```
- ALL database queries MUST include WHERE tenant_id = ?
- Use query scopes: ->where('tenant_id', $tenantId->toString())
- NEVER query across multiple tenants in single query
- Aggregations MUST be tenant-scoped
- Reporting queries MUST filter by TenantId
```

### **RULE 15: MODULE REGISTRY INTEGRATION**
```
- Modules MUST declare tenant-aware in module.json
- Installation MUST run tenant-specific migrations
- Module services MUST be tenant-scoped
- Module configuration MUST be per-tenant
- Uninstallation MUST respect tenant data isolation
```

---

## **🚫 ABSOLUTE FORBIDDEN PATTERNS**
```
❌ NEVER: tenancy()->current()->id in Domain/Application layers
❌ NEVER: DB::table()->without tenant scope
❌ NEVER: Global scopes that automatically add tenant_id
❌ NEVER: Tenant-agnostic repository methods
❌ NEVER: Commands without TenantId parameter
❌ NEVER: Domain models without TenantId property
❌ NEVER: Events without TenantId context
❌ NEVER: Sharing database connections between tenants
```

---

## **✅ ACCEPTED PATTERNS**
```
✅ ALWAYS: new TenantId($request->route('tenant'))
✅ ALWAYS: $repository->findForTenant($id, $tenantId)
✅ ALWAYS: $command = new Command($tenantId, ...)
✅ ALWAYS: if (!$entity->belongsToTenant($tenantId)) throw
✅ ALWAYS: Domain\Events\SomethingHappened($tenantId, ...)
✅ ALWAYS: WHERE tenant_id = ? in every database query
✅ ALWAYS: Unique constraint: UNIQUE(column, tenant_id)
✅ ALWAYS: TenantConnectionManagerInterface injection
```

---

## **🔧 AI PROMPT TEMPLATES FOR CODE GENERATION**

### **When generating Domain Models:**
```
Create a {ModelName} Domain model with:
1. Private TenantId $tenantId property
2. Constructor with TenantId parameter
3. getTenantId(): TenantId method
4. belongsToTenant(TenantId $tenantId): bool method
5. All business logic methods must validate tenant ownership
6. NO framework dependencies
```

### **When generating Repository Interfaces:**
```
Create a {ModelName}RepositoryInterface with:
1. All methods MUST have "ForTenant" suffix
2. All methods MUST include TenantId parameter
3. Example: findForTenant({ModelId} $id, TenantId $tenantId): {ModelName}
4. Example: saveForTenant({ModelName} $model): void
5. NO tenant-agnostic methods allowed
```

### **When generating Commands/Handlers:**
```
Create {ActionName}Command and {ActionName}Handler:
1. Command MUST have TenantId as first constructor parameter
2. Handler MUST inject repository and validate tenant ownership
3. Handler MUST use repository->findForTenant() method
4. Handler MUST check $entity->belongsToTenant($command->tenantId)
5. Throw DomainException on tenant mismatch
```

### **When generating API Controllers:**
```
Create {ModelName}Controller with:
1. Extract TenantId from route: $tenantId = new TenantId($request->route('tenant'))
2. Create Command with TenantId parameter
3. Pass Command to Handler
4. Return appropriate HTTP responses
5. NEVER use tenancy helpers
```

---

## **🎯 ARCHITECTURE VERIFICATION CHECKLIST**
```
For every code change, verify:
1. ✅ Domain models have TenantId property
2. ✅ Repository methods use "ForTenant" naming
3. ✅ Commands include TenantId parameter
4. ✅ Handlers validate tenant ownership
5. ✅ Queries include WHERE tenant_id = ?
6. ✅ Events include TenantId context
7. ✅ NO tenancy package imports in Domain/Application
8. ✅ Tests verify tenant isolation
```

**These rules ensure:**
- **Tenant isolation** is baked into the Domain
- **Business logic** is tenant-aware by design
- **Infrastructure details** don't leak into business rules
- **Code is testable** without tenancy packages
- **System can evolve** from monolith to microservices
- **Different contexts** can use different tenancy implementations# **🏗️ GOLDEN RULES FOR MULTI-TENANT DDD ARCHITECTURE**

## **🎯 PROMPT ENGINEERING INSTRUCTIONS FOR AI ASSISTANTS**

### **RULE 1: TENANT IDENTITY AS DOMAIN CONCEPT**
```
- Every Domain model MUST have a TenantId property
- Use ONLY Platform\SharedKernel\Domain\TenantId Value Object
- NEVER use tenancy packages (stancl/tenancy, hyn/multi-tenant) in Domain/Application layers
- TenantId is a business identifier, not a technical implementation detail
- All business rules MUST consider tenant boundaries
```

### **RULE 2: REPOSITORY DESIGN PATTERN**
```
- Repository interfaces MUST use "ForTenant" naming convention
- Example: findForTenant(), saveForTenant(), findByMemberForTenant()
- NEVER create tenant-agnostic repository methods (find(), findAll(), etc.)
- Repository method signatures MUST include TenantId parameter
- Example: findForTenant(CardId $cardId, TenantId $tenantId)
```

### **RULE 3: COMMAND/QUERY OBJECT STRUCTURE**
```
- Every Command and Query MUST have TenantId as first parameter
- Constructor pattern: __construct(public readonly TenantId $tenantId, ...)
- Commands represent actions scoped to a specific tenant
- Queries retrieve data for a specific tenant
- NEVER extract TenantId from global state (tenancy()->current(), etc.)
```

### **RULE 4: DOMAIN LAYER PURITY**
```
- Domain layer MUST be pure PHP with NO framework dependencies
- NEVER import Illuminate, Laravel, or tenancy packages in Domain
- Domain models MUST extend only your own AggregateRoot/Entity classes
- Business logic MUST validate tenant ownership internally
- Example: $card->belongsToTenant($tenantId) method in Domain model
```

### **RULE 5: APPLICATION LAYER ENFORCEMENT**
```
- Handlers MUST validate TenantId matches before business logic
- Pattern: if (!$entity->belongsToTenant($command->tenantId)) throw
- Handlers MUST use repository "ForTenant" methods only
- Application services MUST receive TenantId as explicit parameter
- NEVER assume current tenant from middleware or context
```

### **RULE 6: INFRASTRUCTURE ABSTRACTION**
```
- Create TenantConnectionManagerInterface for database connections
- Repository implementations MUST inject TenantConnectionManagerInterface
- Infrastructure MAY use tenancy packages, but ONLY in implementation
- NEVER expose package details to Domain/Application layers
- Connection switching logic MUST be encapsulated in Infrastructure
```

### **RULE 7: API LAYER TENANT RESOLUTION**
```
- Extract TenantId from URL route parameter: /{tenant}/api/*
- Convert to Domain TenantId in middleware/controller
- Pass TenantId explicitly to Commands/Queries
- NEVER use helper functions like tenant(), tenancy()->current()
- Tenant resolution MUST be explicit and visible in code flow
```

### **RULE 8: EVENT DESIGN PATTERN**
```
- Domain Events MUST include TenantId property
- Event subscribers MUST filter events by TenantId
- Cross-context communication MUST include TenantId
- Event payloads MUST be tenant-specific
- NEVER publish tenant-agnostic events
```

### **RULE 9: TESTING STRATEGY**
```
- Unit tests MUST test tenant isolation logic
- Always test with multiple TenantId values
- Mock repositories MUST enforce tenant boundaries
- Integration tests MUST use actual tenant database connections
- Test tenant switching scenarios explicitly
```

### **RULE 10: CODE GENERATION PATTERNS**
```
When generating Domain models:
- Include: private TenantId $tenantId in constructor
- Include: public function getTenantId(): TenantId
- Include: public function belongsToTenant(TenantId $tenantId): bool

When generating Repository interfaces:
- Use "ForTenant" suffix on all methods
- Include TenantId parameter in every method
- NEVER generate find(), save() without tenant context

When generating Commands/Handlers:
- TenantId MUST be first constructor parameter
- Handler MUST validate tenant ownership
- Use repository->findForTenant() not repository->find()
```

### **RULE 11: DEPENDENCY INJECTION PATTERN**
```
- Inject TenantConnectionManagerInterface, not concrete implementations
- Domain services MUST NOT know about connection mechanisms
- Repository implementations receive connection manager via constructor
- Controllers receive TenantId from request, pass to commands
- Service location (app()->make()) is FORBIDDEN for tenant-related services
```

### **RULE 12: ERROR HANDLING RULES**
```
- Throw DomainException when tenant mismatch detected
- Use specific exceptions: TenantAccessDeniedException, TenantNotFoundException
- NEVER silently ignore tenant validation failures
- Log tenant ID with all security-relevant errors
- API MUST return 403/404 for tenant access violations
```

### **RULE 13: MIGRATION & SEEDING PATTERNS**
```
- Database migrations MUST include tenant_id column
- Unique indexes MUST include tenant_id for multi-tenant uniqueness
- Seeders MUST create data for specific tenants
- NEVER seed global/tenant-agnostic data in tenant databases
- Migration rollbacks MUST preserve tenant data isolation

🚨 CRITICAL: CONTEXT MIGRATION FOLDER STRUCTURE
- Context migrations MUST be organized in Landlord/ and Tenant/ subfolders
- WRONG: app/Contexts/{Context}/Infrastructure/Database/Migrations/migration_file.php
- CORRECT: app/Contexts/{Context}/Infrastructure/Database/Migrations/Landlord/migration_file.php
- CORRECT: app/Contexts/{Context}/Infrastructure/Database/Migrations/Tenant/migration_file.php
- The context:install command will NOT find migrations in the root Migrations/ folder
- All landlord migrations go in Landlord/ subfolder
- All tenant migrations go in Tenant/ subfolder
- NEVER place migration files directly in the Migrations/ folder root
```

### **RULE 14: QUERY BUILDING PATTERNS**
```
- ALL database queries MUST include WHERE tenant_id = ?
- Use query scopes: ->where('tenant_id', $tenantId->toString())
- NEVER query across multiple tenants in single query
- Aggregations MUST be tenant-scoped
- Reporting queries MUST filter by TenantId
```

### **RULE 15: MODULE REGISTRY INTEGRATION**
```
- Modules MUST declare tenant-aware in module.json
- Installation MUST run tenant-specific migrations
- Module services MUST be tenant-scoped
- Module configuration MUST be per-tenant
- Uninstallation MUST respect tenant data isolation
```

---

## **🚫 ABSOLUTE FORBIDDEN PATTERNS**
```
❌ NEVER: tenancy()->current()->id in Domain/Application layers
❌ NEVER: DB::table()->without tenant scope
❌ NEVER: Global scopes that automatically add tenant_id
❌ NEVER: Tenant-agnostic repository methods
❌ NEVER: Commands without TenantId parameter
❌ NEVER: Domain models without TenantId property
❌ NEVER: Events without TenantId context
❌ NEVER: Sharing database connections between tenants
```

---

## **✅ ACCEPTED PATTERNS**
```
✅ ALWAYS: new TenantId($request->route('tenant'))
✅ ALWAYS: $repository->findForTenant($id, $tenantId)
✅ ALWAYS: $command = new Command($tenantId, ...)
✅ ALWAYS: if (!$entity->belongsToTenant($tenantId)) throw
✅ ALWAYS: Domain\Events\SomethingHappened($tenantId, ...)
✅ ALWAYS: WHERE tenant_id = ? in every database query
✅ ALWAYS: Unique constraint: UNIQUE(column, tenant_id)
✅ ALWAYS: TenantConnectionManagerInterface injection
```

---

## **🔧 AI PROMPT TEMPLATES FOR CODE GENERATION**

### **When generating Domain Models:**
```
Create a {ModelName} Domain model with:
1. Private TenantId $tenantId property
2. Constructor with TenantId parameter
3. getTenantId(): TenantId method
4. belongsToTenant(TenantId $tenantId): bool method
5. All business logic methods must validate tenant ownership
6. NO framework dependencies
```

### **When generating Repository Interfaces:**
```
Create a {ModelName}RepositoryInterface with:
1. All methods MUST have "ForTenant" suffix
2. All methods MUST include TenantId parameter
3. Example: findForTenant({ModelId} $id, TenantId $tenantId): {ModelName}
4. Example: saveForTenant({ModelName} $model): void
5. NO tenant-agnostic methods allowed
```

### **When generating Commands/Handlers:**
```
Create {ActionName}Command and {ActionName}Handler:
1. Command MUST have TenantId as first constructor parameter
2. Handler MUST inject repository and validate tenant ownership
3. Handler MUST use repository->findForTenant() method
4. Handler MUST check $entity->belongsToTenant($command->tenantId)
5. Throw DomainException on tenant mismatch
```

### **When generating API Controllers:**
```
Create {ModelName}Controller with:
1. Extract TenantId from route: $tenantId = new TenantId($request->route('tenant'))
2. Create Command with TenantId parameter
3. Pass Command to Handler
4. Return appropriate HTTP responses
5. NEVER use tenancy helpers
```

---

## **🎯 ARCHITECTURE VERIFICATION CHECKLIST**
```
For every code change, verify:
1. ✅ Domain models have TenantId property
2. ✅ Repository methods use "ForTenant" naming
3. ✅ Commands include TenantId parameter
4. ✅ Handlers validate tenant ownership
5. ✅ Queries include WHERE tenant_id = ?
6. ✅ Events include TenantId context
7. ✅ NO tenancy package imports in Domain/Application
8. ✅ Tests verify tenant isolation
```

**These rules ensure:**
- **Tenant isolation** is baked into the Domain
- **Business logic** is tenant-aware by design
- **Infrastructure details** don't leak into business rules
- **Code is testable** without tenancy packages
- **System can evolve** from monolith to microservices
- **Different contexts** can use different tenancy implementations

## ABSOLUTE RULES (NON-NEGOTIABLE)

### Engineering Discipline

* **MUST** follow **Test-Driven Development (TDD)**

  * Tests FIRST
  * Implementation SECOND
* **MUST** maintain **≥ 80% test coverage**
* **MUST** follow **Domain-Driven Design (DDD)**
* **MUST** ask clarifying questions when uncertain
* **MUST NOT** assume requirements
* **MUST NOT** implement changes without explicit user approval

---

## ARCHITECTURE IMMUTABILITY

* **MUST NOT** move or refactor
  `packages/laravel-backend/`
* **MUST NOT** modify existing route files without approval
* **MUST** preserve **Inertia.js + Vue 3 desktop admin**
* **MUST** treat Angular Mobile as **additive**, never a replacement

---

## SECURITY & TENANCY (ZERO TOLERANCE)

* **MUST** enforce **100% tenant isolation**
* **MUST** validate tenant context on **every tenant request**
* **MUST** prevent OWASP Top-10 vulnerabilities
* **MUST** enforce **one vote per voter slug per election**
* **MUST** use **Laravel Sanctum (stateless tokens)** for mobile APIs

---

## SYSTEM OVERVIEW

Public Digit serves **TWO clients**:

| Client             | Purpose                          |
| ------------------ | -------------------------------- |
| **Vue Desktop**    | Admin, election setup, reporting |
| **Angular Mobile** | Member participation & voting    |

**They NEVER share APIs.**

---

## ROUTING LAW — 6-CASE SYSTEM (CRITICAL)

All routing follows this model:

```
CASE 1: /mapi/*           → Platform Mobile API (Landlord DB)
CASE 2: /{tenant}/mapi/*  → Tenant Mobile API (Tenant DB)

CASE 3: /api/*            → Platform Desktop API (Landlord DB)
CASE 4: /{tenant}/api/*   → Tenant Desktop API (Tenant DB)

CASE 5: /*                → Platform Desktop Pages
CASE 6: /{tenant}/*       → Tenant Desktop Pages + SPA catch-all
```

### HARD RULES

* Angular Mobile → **/mapi/** ONLY
* Vue Desktop → **/api/** ONLY
* Tenant slug **ALWAYS** remains in URL
* Platform = Landlord DB
* Tenant = Tenant DB
* Tenant SPA catch-all **MUST be last**
In the **Public Digit Platform** architecture, the choice between `/api` (with Vue 3) and `/mapi` (with Angular) is driven by the distinction between **Administrative Management** and **Consumer Experience**.

Following the "Desktop vs Mobile API Business Case" and the "API Application" guides, here is the general rule of thumb for when to use each stack.

---

## 1. The Administrative Stack: `/api` + Vue 3

This combination is used for the **Platform and Tenant Dashboards**. It is designed for complex data entry, system configuration, and high-density information displays.

### When to use it:

* **B2B / Back-Office Operations**: When building tools for Platform Admins or Organization Staff.
* **Complex State Management**: Vue 3 (with Pinia) is excellent for the intricate states required in module registration, subscription management, and multi-step installation wizards.
* **High-Density Data**: For pages containing large data tables, complex filters, and "landlord" level analytics.
* **Form-Heavy Interfaces**: When the primary user task is configuring system settings or managing member databases.

---

## 2. The Member Stack: `/mapi` + Angular (Ionic)

This combination is used for the **Mobile Application**. It is optimized for end-users (members) who need a fast, "app-like" experience on their phones.

### When to use it:

* **B2C / Member-Facing Features**: When building the "Digital Card," "Event Booking," or "Member Profile" views.
* **Cross-Platform Mobile (Ionic)**: When you need a single codebase to deploy to both the Apple App Store and Google Play Store.
* **Stateless & High Performance**: The `/mapi` endpoints are strictly stateless and rate-limited. Angular’s structured framework is used here to ensure a consistent, performant UI across different mobile devices.
* **Low-Bandwidth Scenarios**: `/mapi` provides "thin" JSON payloads tailored for mobile data connections, while Angular handles the heavy lifting of UI rendering on the client side.

---

## 3. Technical Comparison

| Category | `/api` + Vue 3 | `/mapi` + Angular |
| --- | --- | --- |
| **Persona** | Admin / Staff | Organization Member |
| **Device** | Desktop / Large Screen | Mobile / Tablet |
| **Route Prefix** | `/api/v1/` | `/{tenant}/mapi/v1/` |
| **Authentication** | Session / Sanctum | Sanctum (Stateless Token) |
| **CSRF** | Required (Web Security) | **Excluded** (API Security) |
| **UI Paradigm** | High-density / Multi-window | "App-like" / Touch-optimized |
| **Bundling** | Vite (Fast development) | Angular CLI (Strict optimization) |

---

## Summary Implementation Rule

* **Build it in Vue 3 if:** You are adding a button in the **Admin Panel** to install the "Digital Card" module. This will call `POST /api/v1/platform/modules`.
* **Build it in Angular if:** You are adding the screen in the **Mobile App** where the member actually *sees* their "Digital Card." This will call `GET /{tenant}/mapi/v1/digital-card`.

> **Architect's Note:** The `ModuleRegistry` context itself has **almost zero** presence in the Angular/Mobile stack. As per the "Minimal Mobile Footprint" decision, members don't need to see the registry; they only need to see the features that the registry has activated.


---

## ROUTE DECISION CHECKLIST (USE EVERY TIME)

When touching routes, ask **in this order**:

1. **Client?**

   * Angular Mobile → `/mapi/*`
   * Vue Desktop → `/api/*` or pages

2. **Tenant context?**

   * Yes → `/{tenant}/...`
   * No → platform route

3. **Route type?**

   * Mobile API → CASE 1 or 2
   * Desktop API → CASE 3 or 4
   * Desktop Page → CASE 5 or 6

4. **Middleware**

   * Mobile → `['api']`
   * Desktop → `['web']`
   * Tenant → add `identify.tenant`

If any answer is unclear → **ASK FIRST**

---

## DOMAIN-DRIVEN DESIGN (MANDATORY)

### Bounded Contexts

```
app/Contexts/
├── Platform
├── TenantAuth
├── ElectionSetup
├── Membership        # Member digitization & forums
├── Geography
├── MobileDevice
└── Shared
```

### Required Patterns

* Domain / Application / Infrastructure layers
* Value Objects over primitives
* Domain Events for cross-context communication
* Repository pattern for persistence
* Application Services for orchestration

---

## MULTI-TENANCY RULES

### Tenant Identification

* Path-based tenant detection has highest priority
* Reserved slugs (`api`, `mapi`, `login`, etc.) **can NEVER be tenants**
* Unknown slugs must NOT activate tenant context

### Database Isolation

```
Landlord DB → tenants, users, permissions
Tenant DB   → members, elections, votes
```

Cross-tenant queries are **forbidden**.

---

## MOBILE APP CONTRACT (ANGULAR)

### Login Flow (MANDATORY)

1. `POST /mapi/v1/auth/login`
2. Receive token + tenant list
3. User selects tenant
4. All further calls:

   ```
   /{tenant}/mapi/v1/*
   ```

### WRONG vs RIGHT

* ❌ `/nrna/api/v1/auth/login`
* ✅ `/nrna/mapi/v1/auth/login`

---

## PROHIBITED ACTIONS (HARD STOP)

* ❌ Raw SQL migrations
* ❌ Database-specific SQL (e.g. IF NOT EXISTS)
* ❌ Empty rollback migrations
* ❌ Silent exception handling
* ❌ Untested logic
* ❌ Cross-tenant access
* ❌ Guessing requirements

If encountered → **STOP and ASK**

---

## OPERATING PRINCIPLES

* Tests over speed
* Clarity over cleverness
* Security over convenience
* Architecture over shortcuts
* Questions over assumptions

---

## CURRENT STATUS (REFERENCE ONLY)

* ✅ Multi-tenancy foundation complete
* ✅ 6-case routing active
* ✅ Sanctum mobile auth
* 🚧 Angular mobile tenant flow
* 🚧 Voting UI & localization

---

## FINAL DIRECTIVE

You are operating inside a **security-critical, multi-tenant system**.

**Architecture is law.
Tests are mandatory.
Tenant boundaries are sacred.**

If unsure → **ASK FIRST**.

---

Yes — below is a **concise, Claude-compatible summary** that is designed to be **added verbatim to the existing `CLAUDE.md`** you already have.

This version:

* Distills the **architecture + migration strategy** into **enforceable rules**
* Avoids implementation noise
* Uses **MUST / MUST NOT** language
* Fits naturally under sections like **“ARCHITECTURE IMMUTABILITY”** or **“MULTI-TENANCY RULES”**

---

## 🔒 ARCHITECTURE & MIGRATION GUARANTEES (ADD TO CLAUDE.md)

### DATABASE & USER MODEL SEPARATION (CRITICAL)

Public Digit follows **strict physical database separation** with **explicit user model boundaries**.

#### Database Responsibilities

* **Landlord Database (`publicdigit`)**

  * Platform administration ONLY
  * Tenants metadata
  * Platform admins
  * Shared reference data (e.g. geography)

* **Tenant Databases (`tenant_{slug}`)**

  * Election operations ONLY
  * Committee members
  * Members / voters
  * Elections, candidates, votes

**MUST NOT** mix landlord and tenant data in the same database.
**MUST NOT** join across databases.

---

### USER MODEL LAW (NON-NEGOTIABLE)

**Users are NOT universal.**

```
LANDLORD DB:
- LandlordUser     → platform admins only

TENANT DB:
- TenantUser       → election committee members
- Member           → voters / participants
```

Rules:

* **MUST NOT** store tenant users in landlord database
* **MUST NOT** reuse `App\Models\User` across databases
* **MUST** bind authentication guards to database context
* **MUST** scope all permissions to tenant database

If user role is unclear → **ASK FIRST**

---

### MIGRATION RESPONSIBILITY RULES

Migrations are **database-scoped and responsibility-driven**.

| Migration Type | Database    | Purpose                    |
| -------------- | ----------- | -------------------------- |
| Landlord       | Landlord DB | Platform & tenant registry |
| Shared Context | Landlord DB | Read-only shared data      |
| Tenant Context | Tenant DB   | Election & membership data |

Rules:

* **MUST** separate landlord and tenant migrations
* **MUST NOT** create migrations that affect both
* **MUST** provide rollback (`down()`) for every migration
* **MUST NOT** use raw or DB-specific SQL
* **MUST** test migrations before execution

If migration scope is ambiguous → **STOP and ASK**

---

### PERMISSION SYSTEM CONSTRAINTS

Permissions are **tenant-scoped**.

Rules:

* **MUST** use tenant-specific Role & Permission models
* **MUST** resolve permissions from tenant database
* **MUST NOT** use global (landlord) permissions for tenant actions
* **MUST** validate tenant context before permission checks

No tenant context → **403 immediately**

---

### MIGRATION DECISION HOOK (USE EVERY TIME)

```
Need to change schema?
├── Platform concern?
│   └── Landlord migration
├── Shared reference data?
│   └── Context migration on landlord DB
└── Tenant election or membership data?
    └── Tenant migration ONLY
```

If unsure → **ASK FIRST**

---

### FAILURE & RECOVERY PRINCIPLE

* **MUST** assume migrations can fail
* **MUST** support rollback and tenant recovery
* **MUST** never “force-fix” production schemas
* **MUST** preserve tenant data integrity at all costs

---

### ARCHITECTURAL PRIME DIRECTIVE

> **Tenant election data is sacred.**
> It must be **physically isolated**, **logically scoped**, and **operationally independent**.

Violating this rule invalidates the system.

---
Below is a **Claude-compatible prompt / prompt-engineering instruction**, written in the **same structured, deterministic style** as before, but now adapted to your **Geography Context DDD implementation**.

This is suitable for **Claude CLI, Claude Code, or Claude System Prompt usage** to continue development, refactoring, or documentation **without breaking DDD/TDD guarantees**.

---

## Claude Prompt Instruction

**Context: Geography Domain – DDD / TDD / Production-Ready System**

### ROLE

You are a **Senior Software Architect and DDD Practitioner** with deep expertise in:

* Domain-Driven Design (DDD)
* Test-Driven Development (TDD)
* Laravel 12
* PostgreSQL (ltree)
* Redis caching
* Anti-Corruption Layers
* Multi-country administrative geography systems

You must act as a **strict guardian of domain integrity**.

---

### SYSTEM CONTEXT (DO NOT SIMPLIFY OR IGNORE)

A **complete Geography bounded context** has already been implemented with:

* **100% test coverage**
* **Strict TDD**
* **Clean DDD layering**
* **Backward compatibility preserved**

You must **extend or modify this system without violating**:

* Existing business rules
* Value Object immutability
* Domain invariants
* Test coverage
* Anti-corruption guarantees

All 21 tests **must continue to pass**.

---

### DOMAIN MODEL SUMMARY (AUTHORITATIVE)

#### 1. Value Objects (Immutable & Self-Validating)

* `CountryCode` (ISO 3166-1 alpha-2)
* `GeographyLevel` (1–8, country-specific rules)
* `GeoUnitId` (type-safe identifier)
* `GeoPath` (PostgreSQL `ltree` compatible)
* `GeographyHierarchy` (core VO, validates gaps & required levels)
* `LocalizedName` (multi-language support)
* `GeographicCode` (official codes)

⚠️ **Value Objects must never contain persistence logic**

---

#### 2. Domain Exceptions (Explicit Business Rule Failures)

* `InvalidHierarchyException`
* `InvalidParentChildException`
* `MissingRequiredLevelException`
* `MaxHierarchyDepthException`
* `CountryNotSupportedException`

⚠️ **No generic exceptions allowed inside the domain**

---

#### 3. Domain Service

**`GeographyPathService`**

* Generates and validates materialized paths
* Enforces parent-child rules
* Uses Redis caching (24h TTL)
* Uses repository abstraction only
* No framework dependencies inside domain logic

---

#### 4. Repository Pattern

* `GeoUnitRepositoryInterface` (domain contract)
* `EloquentGeoUnitRepository` (infrastructure)
* Entity ↔ Model mapping only
* Supports batch operations

⚠️ **No Eloquent models inside domain layer**

---

#### 5. Anti-Corruption Layer

**`GeographyAntiCorruptionLayer`**

* Converts primitive legacy inputs → Value Objects
* Returns `true` for empty hierarchies (legacy compatibility)
* Migration phases:

  * Phase 1: Validation
  * Phase 2: Queries
  * Phase 3: Caching

⚠️ **Never break legacy GeographyService behavior**

---

### ARCHITECTURAL CONSTRAINTS (STRICT)

#### Materialized Path Pattern

* PostgreSQL `ltree` compatible: `1.12.123.1234`
* Prefix-based ancestry queries
* Max depth: **8**

---

#### Multi-Country Rules

* **Nepal (NP)**: 8 levels (Province → Household)
* **India (IN)**: 4 levels (State → Village/Town)
* **USA (US)**: 4 levels (State → ZIP Code)
* Configuration must be **extensible**

---

#### Validation Rules (NON-NEGOTIABLE)

1. No hierarchy gaps
2. Country-specific required levels
3. Parent-child must be direct
4. All units must exist & be active
5. Country consistency enforced

---

### TESTING REQUIREMENTS

* All changes must be **test-first**
* PHPUnit only
* No skipped tests
* No mocking domain logic
* Existing tests must remain unchanged unless explicitly instructed

Current test suites:

* `GeographyPathServiceTest`
* `GeographyHierarchyTest`
* `GeographyAntiCorruptionLayerTest`

---

### FILE STRUCTURE (MUST BE PRESERVED)

```
app/Contexts/Geography/
├── Domain/
├── Infrastructure/
├── Application/
└── Models/

tests/Unit/Contexts/Geography/
```

No cross-layer imports allowed.

---

### WHAT YOU MAY BE ASKED TO DO

When prompted, you may be asked to:

* Extend country configurations
* Add new geography levels
* Introduce new validation rules
* Optimize caching logic
* Generate documentation
* Produce ADRs (Architecture Decision Records)
* Prepare migration or refactoring plans
* Generate additional tests

---

### WHAT YOU MUST NEVER DO

❌ Introduce primitive obsession
❌ Bypass Value Objects
❌ Add framework logic to domain
❌ Break backward compatibility
❌ Reduce test coverage
❌ Use “quick fixes” or shortcuts

---

### OUTPUT FORMAT REQUIREMENTS

When responding:

* Be explicit and deterministic
* Use headings and bullet points
* Show code **only when requested**
* Explain architectural impact clearly
* Always state whether changes affect:

  * Domain
  * Application
  * Infrastructure
  * Tests

---

### FINAL DIRECTIVE

Treat this system as **production-critical, regulation-grade software**.
Every suggestion must be **architecturally justified**.
Proceed only when fully aligned with the above constraints. 


