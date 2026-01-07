Correction to prompt instructions: 
Below is a **professionally rewritten AI-execution prompt plan**, designed to:

* Lock in the **corrected DDD model**
* Prevent persistence-driven or CRUD-driven drift
* Enforce **command-first, invariant-first development**
* Be usable **step-by-step with Claude / ChatGPT / Copilot**
* Scale across backend + frontend without architectural erosion

This is **not documentation**.
This is an **AI Operating Manual** for Phase 4.

---

# 🤖 **PHASE 4 – AI DEVELOPMENT EXECUTION PROMPT (ARCHITECT-GRADE)**

**Tenant Branding Admin Dashboard – Domain-Correct, Command-Driven Implementation**

---

## 🎯 PURPOSE OF THIS PROMPT

You are an **AI software engineer** working under the supervision of a **DDD-oriented Solution Architect**.

Your task is to **implement Phase 4 (Tenant Branding Admin Dashboard)** while **strictly adhering** to:

* Corrected DDD aggregate design
* Command-driven APIs (no CRUD leakage)
* Domain-owned invariants (WCAG, versioning)
* Existing Platform::Branding bounded context
* 6-Case Routing rules

You must **not invent new bounded contexts**, **not treat database tables as aggregates**, and **not place business rules in controllers or services**.

---

## 🧱 NON-NEGOTIABLE ARCHITECTURAL RULES

### 1️⃣ BOUNDED CONTEXT (LOCKED)

```
Context: Platform::Branding
```

* ❌ DO NOT create `BrandingManagement` as a separate context
* ❌ DO NOT duplicate domain concepts for admin vs public
* ✅ Admin and Public are **different adapters**, same domain

---

### 2️⃣ AGGREGATE DESIGN (CRITICAL)

**Aggregate Root: `BrandingBundle`**

```
BrandingBundle (Aggregate Root)
├── BrandingBundleId
├── TenantId
├── BrandingVisuals
│   ├── BrandingColor
│   └── FontFamily
├── BrandingContent
├── Version
└── AuditTrail
```

#### Mandatory Rules

* Aggregate **protects invariants**
* Aggregate **emits domain events**
* Aggregate **owns versioning**
* Persistence concerns are secondary

❌ Database table names are NOT domain models
❌ Services must NOT mutate state directly

---

### 3️⃣ DOMAIN INVARIANTS (ENFORCED)

| Rule               | Where it lives                |
| ------------------ | ----------------------------- |
| WCAG AA contrast   | `BrandingVisuals` constructor |
| Version increment  | `BrandingBundle::update()`    |
| Audit logging      | `AuditTrail` value object     |
| Concurrency safety | `Version` value object        |

❌ No validation in controllers
❌ No validation in application services

---

### 4️⃣ COMMAND-DRIVEN API (NO CRUD)

**Write Side = Commands**

```http
POST /api/v1/commands
```

```json
{
  "commandType": "UpdateBrandingCommand",
  "tenantId": "nrna",
  "visuals": {
    "primaryColor": "#1976D2",
    "secondaryColor": "#2E7D32"
  },
  "content": {
    "heroTitle": "Updated Organization"
  },
  "expectedVersion": 5
}
```

**Read Side = Queries**

```http
GET /api/v1/admin/branding/views/tenants
GET /api/v1/admin/branding/views/{tenantId}/current
GET /api/v1/admin/branding/views/{tenantId}/history
```

❌ No `PUT /branding/{id}`
❌ No entity exposure

---

## 🧪 TDD EXECUTION ORDER (MANDATORY)

AI must follow **this order strictly**:

### Step 1 — Domain Tests (FIRST)

* Aggregate behavior
* Invariants
* Version handling
* Event emission

### Step 2 — Domain Implementation

* Aggregate Root
* Value Objects
* Domain Events

### Step 3 — Application Layer

* Command objects
* Command handlers
* Repository interfaces

### Step 4 — Infrastructure

* Repository implementations
* Event dispatchers
* Read model projections

### Step 5 — API Adapters

* Command controller
* Query controllers

### Step 6 — Frontend

* Admin UI
* Command submission
* Read-model consumption

❌ AI must never skip steps
❌ No UI before domain stability

---

## 🧠 AI PROMPT – DOMAIN MODELING (DAY 1)

### Prompt 1: Aggregate Design

> You are a Domain-Driven Design expert.
>
> Design the `BrandingBundle` aggregate for the Platform::Branding context.
>
> Requirements:
>
> * Aggregate root owns WCAG validation
> * Versioning must support optimistic locking
> * Audit trail must be immutable
> * Domain events must be recorded internally
>
> Output:
>
> * PHP aggregate code
> * Value objects
> * Domain events
> * PHPUnit tests (failing first)

🚨 **Reject output if**:

* Database fields drive the design
* Validation occurs outside domain objects

---

## 🧠 AI PROMPT – COMMAND HANDLING (DAY 2)

### Prompt 2: Command Side

> Implement command-driven write flow for branding updates.
>
> Constraints:
>
> * Commands are immutable
> * Handlers orchestrate, never validate business rules
> * Aggregate enforces invariants
>
> Deliver:
>
> * UpdateBrandingCommand
> * UpdateBrandingHandler
> * Repository interface
> * Tests for concurrency & rejection

🚨 **Reject output if**:

* Handler validates WCAG
* Handler mutates state directly

---

## 🧠 AI PROMPT – QUERY MODELS (DAY 3)

### Prompt 3: Read Models

> Design read-optimized models for admin branding UI.
>
> Requirements:
>
> * No domain logic
> * Optimized for UI consumption
> * Built from domain events
>
> Deliver:
>
> * Read model DTOs
> * Projection handlers
> * Query controllers
> * Tests

🚨 **Reject output if**:

* Read model mutates domain state
* Domain objects leak into API

---

## 🧠 AI PROMPT – VUE 3 ADMIN UI (DAY 4–7)

### Prompt 4: Admin UI Architecture

> Implement Vue 3 admin branding UI using Composition API and Pinia.
>
> Constraints:
>
> * UI talks ONLY to command/query APIs
> * No business rules in UI
> * WCAG validation shown using domain feedback
>
> Deliver:
>
> * BrandingEditor
> * BrandingPreview
> * AuditTimeline
> * Store + services
> * Component tests

🚨 **Reject output if**:

* UI calculates contrast ratios
* UI constructs domain rules

---

## 🔁 EVENT FLOW (LOCKED)

```
Command → Aggregate → Domain Event
                ↓
        Event Handlers
                ↓
     Read Model Projection
                ↓
           Admin UI
```

---

## 🛑 FORBIDDEN SHORTCUTS

AI must NOT:

* Generate CRUD controllers
* Treat tables as aggregates
* Add “manager” services
* Skip tests
* Invent new contexts
* Validate WCAG outside domain

---

## ✅ DEFINITION OF DONE (AI OUTPUT)

An implementation is **acceptable** only if:

* Domain layer has **zero framework dependencies**
* Aggregate enforces all invariants
* APIs are command/query based
* Admin UI consumes read models only
* All tests pass (domain → E2E)

---

## 🧠 FINAL ARCHITECT NOTE

> This phase is **not about UI speed**.
> It is about **locking a correct domain model that will survive 5+ years**.

If the AI tries to “help” by simplifying domain rules,
**that output is wrong**.

---

### ✅ NEXT ACTION FOR YOU

If you want, next we can:

1. **Turn this into a reusable “AI Architecture Guardrail” template**
2. **Write the Day-1 exact PHPUnit tests for BrandingBundle**
3. **Design the exact event payloads**
4. **Create a Claude-specific version of this prompt**

Just tell me which one you want to do next.
# 🏛️ **SENIOR SOFTWARE ARCHITECT ANALYSIS & IMPROVED PLAN**

## **🔍 CRITICAL ARCHITECTURE ASSESSMENT**

After analyzing all provided documentation, I've identified **fundamental architectural issues** that must be addressed before any implementation. The current plan has good intentions but violates several core DDD principles.

---

## **🚨 CRITICAL FINDINGS**

### **1. **IDENTITY CRISIS - Most Severe Issue**
The system has **TWO competing domain models** for the same concept:
- **From Phase 2/3**: `BrandingBundle` (Domain Object) with limited fields
- **From Phase 4 Plan**: `TenantBranding` (treated as Entity/Aggregate with audit fields)

This is a **domain modeling failure** that will cause:
- Data duplication
- Inconsistent business rules
- Maintenance nightmare

### **2. **BOUNDED CONTEXT CONFUSION**
Creating separate `BrandingManagement` context for admin features is **architectural over-engineering**. Admin vs public is a **user role concern**, not a bounded context boundary.

### **3. **PERSISTENCE-FIRST THINKING**
The plan focuses on database tables (`tenant_brandings` table) rather than domain concepts. This leads to **anemic domain models**.

---

## **🎯 ARCHITECTURAL DECISIONS REQUIRED NOW**

### **DECISION 1: Define the TRUE Aggregate Root**

**Options:**
1. **Option A**: `BrandingBundle` is Aggregate Root (current domain model)
   - Pros: Already exists, simple
   - Cons: Missing audit fields, no versioning

2. **Option B**: Create `TenantBranding` as new Aggregate Root  
   - Pros: Can include all required fields
   - Cons: Breaks existing domain model, migration needed

3. **Option C**: **Hybrid** - `BrandingBundle` with `BrandingMetadata` Value Object
   - **Recommended**: Preserves existing while extending

**My Decision: Option C with evolution strategy**
```php
// Evolve BrandingBundle to be proper Aggregate Root
class BrandingBundle implements AggregateRoot {
    private BrandingBundleId $id;
    private TenantId $tenantId;
    private BrandingVisuals $visuals;
    private BrandingContent $content;
    private BrandingMetadata $metadata; // NEW: version, audit trail
    private BrandingAssets $assets;     // NEW: logo references
    
    public function updateVisuals(
        BrandingVisuals $newVisuals, 
        UserId $updater
    ): void {
        $this->visuals = $newVisuals;
        $this->metadata = $this->metadata->recordUpdate($updater);
        $this->recordThat(new BrandingVisualsUpdated(
            $this->tenantId,
            $this->metadata->version(),
            $updater
        ));
    }
}
```

### **DECISION 2: API Strategy - CQRS from Day 1**

**Given Admin needs different data than Public API:**
- ✅ **Read Side**: Optimized views for admin UI (include audit, versions)
- ✅ **Write Side**: Command handlers for mutations
- ✅ **Public Side**: Existing simplified view

**Implementation:**
```php
// THREE SEPARATE MODELS:
1. BrandingBundle (Domain/Aggregate) - Business rules, invariants
2. AdminBrandingView (Read Model) - Includes audit, versions for admin UI
3. PublicBrandingView (Read Model) - Simplified for public/mobile API

// Command Pattern:
POST /api/v1/admin/commands
{
    "command": "UpdateBrandingVisuals",
    "tenantId": "nrna",
    "visuals": {...},
    "updaterId": "user-123",
    "expectedVersion": 5
}
```

### **DECISION 3: Asset Management Strategy**

**From your comprehensive plan**: External CDN with metadata in landlord DB
**Decision**: ✅ **APPROVED** with domain integration

```php
// Domain Model Integration
class BrandingAssets implements ValueObject {
    public function __construct(
        private LogoReference $primaryLogo,
        private ?LogoReference $darkModeLogo = null,
        private ?LogoReference $favicon = null
    ) {}
}

class LogoReference implements ValueObject {
    public function __construct(
        private AssetId $assetId,     // Reference to branding_assets table
        private CdnUrl $url,          // CDN URL
        private Dimensions $dimensions
    ) {}
}
```

---

## **📋 REVISED PHASE 4 IMPLEMENTATION PLAN**

### **PHASE 4A: DOMAIN MODEL CORRECTION (Week 1)**

#### **Day 1: Domain Workshop & Redesign**
```bash
# TASKS:
1. Define Aggregate boundaries clearly
2. Design Value Objects for audit, metadata, assets
3. Create Domain Event structure
4. Write failing domain tests

# DELIVERABLES:
- Updated Domain Model diagrams
- Failing domain tests (TDD)
- Event definitions
```

#### **Day 2-3: Repository & Persistence Design**
```php
// BrandingBundleRepositoryInterface
interface BrandingBundleRepository {
    public function nextIdentity(): BrandingBundleId;
    public function save(BrandingBundle $bundle): void;
    public function findByTenant(TenantId $tenantId): ?BrandingBundle;
    public function getHistory(TenantId $tenantId): BrandingHistory;
}

// Database Schema Updates
ALTER TABLE tenant_brandings 
ADD COLUMN metadata_json JSONB,  -- version, audit
ADD COLUMN assets_json JSONB;    -- logo references
```

#### **Day 4-5: CQRS Read Model Implementation**
```php
// AdminBrandingReadModel (Application Service)
class AdminBrandingReadModel {
    public function getForAdmin(TenantId $tenantId): AdminBrandingView
    {
        return $this->readDb->table('v_admin_branding')
            ->where('tenant_id', $tenantId)
            ->first();
    }
}

// Database View for Admin
CREATE VIEW v_admin_branding AS
SELECT 
    tb.*,
    tb.metadata_json->>'version' as version,
    tb.metadata_json->>'last_updated_by' as last_updated_by,
    a.name as tenant_name,
    u.email as updater_email
FROM tenant_brandings tb
JOIN tenants t ON tb.tenant_id = t.id
LEFT JOIN users u ON (tb.metadata_json->>'last_updated_by')::INT = u.id;
```

### **PHASE 4B: ADMIN API IMPLEMENTATION (Week 2)**

#### **Day 6-7: Command API Endpoints**
```php
// CASE 3 Routing: /api/v1/admin/*
Route::prefix('api/v1/admin')
    ->middleware(['auth:sanctum', 'role:platform-admin'])
    ->group(function () {
        // Commands
        Route::post('commands/update-branding-visuals', [BrandingCommandController::class, 'updateVisuals']);
        Route::post('commands/update-branding-content', [BrandingCommandController::class, 'updateContent']);
        Route::post('commands/upload-logo', [BrandingCommandController::class, 'uploadLogo']);
        
        // Queries (Read Model)
        Route::get('branding/tenants', [BrandingQueryController::class, 'listTenants']);
        Route::get('branding/{tenantId}/current', [BrandingQueryController::class, 'getCurrent']);
        Route::get('branding/{tenantId}/history', [BrandingQueryController::class, 'getHistory']);
    });
```

#### **Day 8-9: Logo Upload & CDN Integration**
Implement your comprehensive logo upload plan with:
1. File validation service
2. CDN upload service (Cloudinary/S3)
3. Domain integration via `LogoReference` value objects
4. Audit logging

#### **Day 10: WCAG Validation Domain Integration**
```php
// Domain-level validation
class BrandingColor implements ValueObject {
    public function __construct(private string $hexColor) {
        $this->validateHexFormat();
        // WCAG validation as domain invariant
        // $this->validateMinimumContrast($otherColor);
    }
    
    public function contrastRatioWith(BrandingColor $other): float
    {
        return ColorContrastCalculator::calculate(
            $this->hexColor,
            $other->hexColor
        );
    }
}
```

### **PHASE 4C: VUE 3 ADMIN DASHBOARD (Week 3)**

#### **Day 11-12: Admin Layout & Navigation**
- Platform admin layout
- Tenant list view
- Navigation between platform/tenant contexts

#### **Day 13-14: Branding Management UI**
- Real-time preview component
- Color picker with WCAG validation
- Logo upload component
- Version history viewer

#### **Day 15: Audit Trail & Analytics**
- Change history display
- Rollback functionality
- Usage analytics dashboard

---

## **🏗️ TECHNICAL ARCHITECTURE REDESIGN**

### **LAYERED ARCHITECTURE:**
```
1. DOMAIN LAYER (Pure Business Logic)
   ├── BrandingBundle (Aggregate Root)
   ├── BrandingVisuals (Entity)
   ├── BrandingContent (Entity)
   ├── BrandingMetadata (Value Object)
   └── BrandingAssets (Value Object)

2. APPLICATION LAYER (Use Cases)
   ├── Commands (UpdateBrandingVisuals, UploadLogo)
   ├── Queries (GetAdminBrandingView)
   └── Services (LogoProcessing, WcagValidation)

3. INFRASTRUCTURE LAYER
   ├── Repositories (BrandingBundleRepository)
   ├── CDN Services (CloudinaryService)
   ├── Read Models (AdminBrandingView)
   └── Event Handlers
```

### **DATABASE STRATEGY:**
```
LANDLORD DATABASE:
├── tenant_brandings (main table)
│   ├── visuals_json (colors, fonts)
│   ├── content_json (text content)
│   ├── metadata_json (version, audit)
│   └── assets_json (logo references)
├── branding_assets (CDN metadata)
├── branding_events (event sourcing optional)
└── v_admin_branding (materialized view)

TENANT DATABASES:
└── (No branding data - all moved to landlord)
```

### **EVENT-DRIVEN DESIGN:**
```php
// Domain Events
BrandingVisualsUpdated
BrandingContentUpdated  
LogoUploaded
BrandingResetToDefaults

// Event Handlers (Application Layer)
class UpdateBrandingReadModelHandler {
    public function handle(BrandingVisualsUpdated $event): void
    {
        $this->readModel->updateView($event->tenantId);
        $this->cache->invalidate("branding:{$event->tenantId}");
        $this->auditLogger->log($event);
    }
}
```

---

## **🔧 IMPLEMENTATION PRIORITIES**

### **PRIORITY 1: Fix Domain Model (Week 1)**
1. Evolve `BrandingBundle` to proper Aggregate Root
2. Add `BrandingMetadata` for version/audit
3. Add `BrandingAssets` for logo references
4. Write comprehensive domain tests

### **PRIORITY 2: CQRS Implementation (Week 2)**
1. Command endpoints for mutations
2. Read model optimized for admin UI
3. Separate from public API read model

### **PRIORITY 3: Logo Asset Management (Week 2-3)**
1. CDN integration (Cloudinary)
2. Secure upload with validation
3. Domain integration via `LogoReference`

### **PRIORITY 4: Admin Dashboard (Week 3)**
1. Vue 3 components
2. Real-time preview
3. WCAG validation UI

---

## **🚨 RISK MITIGATION STRATEGY**

### **RISK 1: Breaking Existing Public/Mobile API**
**Mitigation**: 
- Keep existing `BrandingBundle` interface unchanged for public API
- Add new fields via composition (metadata_json, assets_json)
- Version API responses

### **RISK 2: Database Migration Complexity**
**Mitigation**:
```sql
-- Add new JSON columns (non-breaking)
ALTER TABLE tenant_brandings 
ADD COLUMN metadata_json JSONB DEFAULT '{"version": 1}',
ADD COLUMN assets_json JSONB DEFAULT '{}';

-- Migrate existing data in background
UPDATE tenant_brandings 
SET metadata_json = jsonb_build_object(
    'version', 1,
    'created_at', created_at,
    'updated_at', updated_at
);
```

### **RISK 3: Performance with Admin Views**
**Mitigation**:
- Materialized views for admin queries
- Redis caching for tenant lists
- Pagination for large datasets

---

## **📊 SUCCESS METRICS**

### **ARCHITECTURAL METRICS:**
- [ ] Domain model passes all invariants in tests
- [ ] No framework dependencies in Domain layer
- [ ] Commands succeed/fail based on business rules
- [ ] Events capture all meaningful state changes
- [ ] Read models optimized for UI needs

### **OPERATIONAL METRICS:**
- [ ] Admin API response < 200ms p95
- [ ] Logo upload < 5s p95
- [ ] Cache hit rate > 90%
- [ ] Zero data loss in migrations

### **USER METRICS:**
- [ ] Admin can update branding in < 3 minutes
- [ ] Real-time preview updates < 1s
- [ ] WCAG violations caught before save
- [ ] Version history accessible with 1 click

---

## **🎯 IMMEDIATE NEXT STEPS**

### **TODAY (Day 0): Planning & Setup**
1. **Create Architectural Decision Record (ADR)**
   - ADR-001: BrandingBundle as Aggregate Root with Metadata
   - ADR-002: CQRS Pattern for Admin vs Public APIs
   - ADR-003: External CDN for Asset Storage

2. **Setup Development Environment**
   ```bash
   # Create feature branch
   git checkout -b feature/phase4-admin-dashboard
   
   # Setup test database with sample data
   php artisan migrate:fresh --seed
   
   # Create domain test structure
   mkdir -p tests/Unit/Contexts/Platform/Domain/Models
   ```

3. **Start with TDD: First Failing Test**
   ```php
   // tests/Unit/Contexts/Platform/Domain/Models/BrandingBundleTest.php
   public function test_branding_bundle_can_record_metadata_on_update(): void
   {
       $bundle = BrandingBundle::create(...);
       $updaterId = UserId::fromString('user-123');
       
       $bundle->updateVisuals($newVisuals, $updaterId);
       
       $this->assertEquals(2, $bundle->metadata()->version());
       $this->assertEquals($updaterId, $bundle->metadata()->lastUpdatedBy());
   }
   ```

### **TOMORROW (Day 1): Domain Model Implementation**
1. Implement `BrandingMetadata` Value Object
2. Update `BrandingBundle` aggregate
3. Make failing tests pass
4. Write additional domain tests for WCAG validation

---

## **🎖️ ARCHITECT'S FINAL RECOMMENDATION**

**STOP** the current implementation plan. **START** with:

1. **Domain Model Correction First** - Fix the architectural foundation
2. **CQRS from Beginning** - Separate admin read models
3. **Event-Driven Design** - Prepare for audit trails
4. **Incremental Delivery** - MVP first, then enhancements

**The critical insight**: Admin dashboard needs are **read model optimizations**, not domain model changes. The core domain (`BrandingBundle`) should remain focused on business rules. Admin features should be built on top via CQRS.

**Revised Timeline**:
- **Week 1**: Domain model + CQRS foundation
- **Week 2**: Admin API + Logo management  
- **Week 3**: Vue dashboard + WCAG integration
- **Week 4**: Polish, test, deploy

**This approach**: 
✅ Preserves existing public/mobile API
✅ Creates scalable admin architecture  
✅ Follows DDD principles properly
✅ Enables future enhancements (event sourcing, real-time collaboration)

---

correction to above prompt instructions : 
# 🏛️ **SENIOR ARCHITECT'S CRITICAL ANALYSIS**

## **📊 ASSESSMENT: 8.5/10 - STRONG FOUNDATION WITH MINOR FLAWS**

This AI execution prompt is **excellent** and demonstrates deep DDD understanding. However, I have **critical refinements** needed before deployment.

---

## **✅ WHAT'S EXCELLENT**

### **1. **CORRECT PHILOSOPHICAL FOUNDATION***
✅ "Locking a correct domain model that will survive 5+ years"  
✅ Domain-first, UI-last approach  
✅ Preventing CRUD/leaky abstraction drift

### **2. **PRECISE COMMAND/QUERY SEPARATION***
✅ Clear CQRS implementation plan  
✅ Read models optimized for UI  
✅ No domain leakage in APIs

### **3. **STRONG GUARDRAILS***
✅ Explicit "forbidden shortcuts"  
✅ Rejection criteria for AI output  
✅ TDD-first mandate

---

## **🚨 CRITICAL ARCHITECTURAL GAPS**

### **GAP 1: Missing Asset Management Integration**

**Problem**: The prompt doesn't address how logo uploads/CDN integrate with the domain model. This is a **major architectural omission**.

**Solution Needed**:
```php
// Must be added to domain model
class BrandingBundle {
    private BrandingAssets $assets; // Logo references, CDN URLs
    
    public function updateLogo(LogoUpdate $logoUpdate, UserId $updater): void
    {
        $this->assets = $this->assets->withUpdatedLogo($logoUpdate);
        $this->metadata = $this->metadata->recordUpdate($updater);
        $this->recordThat(new LogoUpdated($this->tenantId, $logoUpdate->type()));
    }
}
```

### **GAP 2: Event Sourcing vs Event-Driven Confusion**

**Problem**: The prompt says "Domain events must be recorded internally" but doesn't specify **event sourcing** vs **event-driven**.

**Critical Decision Required**:
- **Event Sourcing**: Full state rebuild from events (recommended for audit-critical systems)
- **Event-Driven**: Just publish events for side effects

**Recommendation**: Implement **event sourcing lite** - store events for audit, but maintain current state in table.

### **GAP 3: Versioning Strategy Ambiguity**

**Problem**: "Versioning must support optimistic locking" is vague.

**Precise Implementation Needed**:
```php
class Version implements ValueObject {
    public function __construct(private int $value) {}
    
    public function increment(): self {
        return new self($this->value + 1);
    }
    
    public function equals(Version $other): bool {
        return $this->value === $other->value;
    }
}

// In command handler
public function handle(UpdateBrandingCommand $command): void
{
    $bundle = $this->repository->getCurrentForTenant($command->tenantId);
    
    // Optimistic locking check
    if (!$bundle->version()->equals($command->expectedVersion)) {
        throw new ConcurrencyException(
            "Expected version {$command->expectedVersion}, got {$bundle->version()}"
        );
    }
}
```

---

## **🔧 ARCHITECTURAL REFINEMENTS REQUIRED**

### **REFINEMENT 1: API Routing Precision**

The prompt mentions `/api/v1/commands` but needs **6-case routing alignment**.

**Fixed Specification**:
```bash
# CASE 3: Platform Desktop API (Landlord DB)
POST /api/v1/admin/commands             # Platform admin commands
GET  /api/v1/admin/branding/views/*     # Platform admin queries

# CASE 4: Tenant Desktop API (Tenant DB)
POST /{tenant}/api/v1/branding/commands # Tenant admin commands
GET  /{tenant}/api/v1/branding/views/*  # Tenant admin queries
```

### **REFINEMENT 2: Bounded Context Boundaries**

The prompt correctly forbids new contexts but needs **clearer adapter definitions**:

```php
// Correct: Same domain, different adapters
Platform::Branding
├── Application/
│   ├── Commands/           # Write operations
│   ├── Queries/           # Read operations
│   └── Services/          # Domain services
├── Infrastructure/
│   ├── Http/
│   │   ├── AdminApi/      # Admin API adapters
│   │   ├── PublicApi/     # Public API adapters  
│   │   └── TenantApi/     # Tenant admin API adapters
│   └── Persistence/
└── Domain/                # Core domain
```

### **REFINEMENT 3: WCAG Validation Implementation Detail**

"WCAG AA contrast lives in `BrandingVisuals` constructor" is **too simplistic**.

**Proper Implementation**:
```php
class BrandingVisuals {
    public function __construct(
        private BrandingColor $primaryColor,
        private BrandingColor $secondaryColor,
        private ?BrandingColor $backgroundColor = null,
        private ?BrandingColor $textColor = null
    ) {
        $this->validateContrastRatios();
    }
    
    private function validateContrastRatios(): void
    {
        // Business rule: Primary vs Secondary must meet AA
        if ($this->primaryColor->contrastRatio($this->secondaryColor) < 4.5) {
            throw new WcagContrastViolation(
                "Primary vs Secondary color contrast below WCAG AA (4.5:1)"
            );
        }
        
        // Optional: Text vs Background if provided
        if ($this->textColor && $this->backgroundColor) {
            if ($this->textColor->contrastRatio($this->backgroundColor) < 4.5) {
                throw new WcagContrastViolation(
                    "Text vs Background contrast below WCAG AA"
                );
            }
        }
    }
}
```

---

## **🎯 IMPROVED AI EXECUTION PROMPT TEMPLATE**

Here's my **architect-refined version**:

### **🧠 AI PROMPT – DAY 0: ARCHITECTURE VALIDATION**

> Before implementing, validate this architecture against DDD principles:
>
> **Scenario**: Tenant branding system with WCAG compliance, logo management, and audit trails.
>
> **Current Plan**:
> - Aggregate: `BrandingBundle` (Root)
> - Value Objects: `BrandingVisuals`, `BrandingContent`, `BrandingMetadata`, `BrandingAssets`
> - Events: `BrandingUpdated`, `LogoUploaded`, `BrandingReset`
> - CQRS: Commands for writes, Read Models for admin UI
>
> **Validation Questions**:
> 1. Should `BrandingAssets` (logos) be part of the aggregate or separate?
> 2. Should WCAG validation be in constructor or separate domain service?
> 3. How should concurrency be handled across multiple admins?
> 4. Where should CDN URL generation happen?
>
> **Output**: Architecture decision record with justifications.

### **🧠 AI PROMPT – DAY 1: DOMAIN MODEL WITH ASSETS**

> Implement the complete `BrandingBundle` aggregate with ALL required value objects:
>
> **Requirements**:
> 1. Aggregate must include `BrandingAssets` for logo/CDN management
> 2. WCAG validation as aggregate invariants
> 3. Versioning with optimistic locking support
> 4. Immutable audit trail recording
> 5. Domain events for all state changes
>
> **Include**:
> - `LogoReference` value object (CDN URL + metadata)
> - `AssetId` value object for external asset tracking
> - `BrandingColor` with contrast ratio calculation
> - All failing tests first (TDD)
>
> ❌ **Reject if**: Assets are external to aggregate or validation is in services.

### **🧠 AI PROMPT – DAY 2: COMMAND + LOGO UPLOAD FLOW**

> Implement command-driven write flow including logo upload integration:
>
> **Commands Required**:
> 1. `UpdateBrandingVisualsCommand` (colors, fonts)
> 2. `UpdateBrandingContentCommand` (text content)
> 3. `UploadLogoCommand` (file + logo type)
> 4. `PublishBrandingCommand` (activate pending changes)
>
> **Logo Upload Flow**:
> 1. File uploaded to temporary storage
> 2. CDN processing (resize, optimize)
> 3. Create `LogoReference` value object
> 4. Aggregate updates with new logo reference
> 5. Domain event emitted
>
> **Deliver**: Command objects, handlers, repository interface, integration tests.

### **🧠 AI PROMPT – DAY 3: CQRS READ MODELS + PROJECTIONS**

> Design read-optimized models for THREE different consumers:
>
> **1. Admin Dashboard View**:
> - All audit fields
> - Version history
> - Pending vs published states
>
> **2. Public API View**:
> - Current published branding only
> - No audit/version data
> - Mobile-optimized structure
>
> **3. Tenant Admin View**:
> - Tenant's own branding only
> - Basic audit trail
> - Tier restrictions applied
>
> **Implement**: Projection handlers that build views from domain events.

### **🧠 AI PROMPT – DAY 4-7: VUE 3 WITH REAL-TIME VALIDATION**

> Implement Vue 3 admin UI with:
>
> **Architecture**:
> - Pinia store for command/query separation
> - Composition API for reactive preview
> - WebSocket for real-time collaboration notifications
>
> **Features**:
> 1. Color picker with WCAG contrast warnings
> 2. Logo upload with drag-drop + preview
> 3. Real-time CSS variable preview
> 4. Version timeline with diff view
> 5. Concurrent edit detection
>
> **Rules**:
> - UI shows domain validation errors, doesn't calculate them
> - Commands include expected version for optimistic locking
> - Read models drive all displays

---

## **📋 CRITICAL ADDITIONS TO THE PROMPT**

### **ADDITION 1: Concurrency Handling Specification**

Add this section:

```
## 🚦 CONCURRENCY & COLLABORATION

### Optimistic Locking
Every command MUST include `expectedVersion`.
Aggregate MUST reject updates with version mismatch.

### Real-time Collaboration
* WebSocket notifications for branding changes
* "User X is editing" indicators
* Merge strategies for non-conflicting changes

### Offline Support
* Commands can be queued locally
* Conflict resolution on sync
```

### **ADDITION 2: Database Migration Strategy**

Add this section:

```
## 🗄️ PERSISTENCE STRATEGY

### Current State Table
```
landlord.tenant_brandings
├── id (UUID)
├── tenant_id
├── visuals_json
├── content_json  
├── assets_json
├── metadata_json (version, audit)
└── published_at (nullable)
```

### Event Store (Optional)
```
landlord.branding_events
├── event_id (UUID)
├── aggregate_id
├── event_type
├── event_data (JSONB)
├── version
└── timestamp
```

### Read Model Tables
Materialized views updated via event projections.
```

### **ADDITION 3: Deployment Phasing**

Add this section:

```
## 🚀 DEPLOYMENT PHASING

### Phase 4A: Domain + Admin API (Week 1-2)
* New domain model
* Command API
* Basic admin UI

### Phase 4B: Logo Management (Week 3)
* CDN integration
* Advanced UI components
* Batch operations

### Phase 4C: Collaboration Features (Week 4)
* Real-time updates
* Conflict resolution
* Advanced audit trails
```

---

## **🎖️ FINAL VERDICT & RECOMMENDATION**

### **STRENGTHS (KEEP THESE):**
1. ✅ Domain-first, UI-last philosophy
2. ✅ Clear command/query separation
3. ✅ Strong guardrails against anti-patterns
4. ✅ TDD mandate with specific order

### **WEAKNESSES (FIX THESE):**
1. ❌ Missing asset management integration
2. ❌ Vague versioning implementation
3. ❌ No 6-case routing alignment
4. ❌ Oversimplified WCAG validation

### **RECOMMENDED ACTION:**

**Use this prompt AS IS for Day 1 domain modeling**, but **add my refinements** before proceeding to:

1. **Day 2 (Command handling)** - Add logo upload flow
2. **Day 3 (Read models)** - Align with 6-case routing
3. **Day 4+ (UI)** - Include real-time collaboration specs

### **IMMEDIATE NEXT STEP:**

Let me create the **exact Day 1 PHPUnit tests** that will:
1. Validate the corrected aggregate design
2. Include asset management from the start
3. Enforce WCAG as domain invariants
4. Test optimistic locking properly

**Would you like me to:**
A) Write the complete Day 1 test suite (failing tests first)
B) Create a refined prompt template with all my corrections
C) Design the exact event payload structure
D) Something else?

The foundation is excellent - just needs precision in key areas.