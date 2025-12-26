# 🏗️ **ARCHITECTURAL ADOPTION STRATEGY: EVOLUTIONARY DDD INTEGRATION**

## 🔍 **ANALYSIS: CURRENT STATE vs TARGET ARCHITECTURE**

### **YOUR CURRENT STATE (Hybrid Approach):**
```
📊 Landlord DB (publicdigit)
├── MasterGeoUnit (np_geo_administrative_units)
├── Static official hierarchy (Levels 1-4)
└── Manual mirroring to tenants

📊 Tenant DB (tenant_xxx)
├── GeoAdministrativeUnit (mirrored + custom)
├── Member (8-level denormalized geography)
└── TenantUser (with geography columns)
```

### **TARGET DDD ARCHITECTURE:**
```
🏛️ Geography Context (Shared Kernel)
├── CanonicalGeoUnit Aggregate (Event-sourced)
├── Value Objects (Immutable business rules)
├── Event-driven sync (Reactive)
└── Published Language (Stable contracts)

🏢 Tenant Contexts (Bounded Contexts)
├── Member Aggregate (Domain model)
├── TenantGeoUnit Entity (Local representation)
├── Anti-corruption Layer (Translation)
└── Business rules (Validation, jurisdiction)
```

---

## 🎯 **STRATEGIC ADOPTION PLAN: PHASED EVOLUTION**

### **PHASE 0: FOUNDATION WITHOUT DISRUPTION (Week 1)**
**Goal:** Add DDD layer ON TOP of existing code, not replace it.

```php
// STRATEGY: Wrap existing models with DDD Value Objects
class LegacyToDomainBridge
{
    public function wrapMasterGeoUnit(MasterGeoUnit $legacy): CanonicalGeoUnit
    {
        // Convert to DDD Aggregate without touching database
        return CanonicalGeoUnit::reconstitute(
            id: GeoUnitId::fromInt($legacy->id),
            countryCode: CountryCode::fromString('NP'),
            // ... map other properties
        );
    }
    
    public function wrapTenantGeoUnit(GeoAdministrativeUnit $legacy): TenantGeoUnit
    {
        // Convert to DDD Entity
        return TenantGeoUnit::create(
            tenantId: TenantId::fromInt($legacy->tenant_id),
            canonicalId: $legacy->external_geo_id 
                ? GeoUnitId::fromInt($legacy->external_geo_id)
                : null,
            // ... other properties
        );
    }
}
```

### **PHASE 1: PARALLEL RUN (Week 2-3)**
**Goal:** Run DDD system alongside existing system.

```
┌─────────────────────────────────────────────────────────┐
│ EXISTING SYSTEM (Legacy)                                 │
│ • MasterGeoUnit                                          │
│ • GeographyMirrorService                                 │
│ • Current APIs working                                   │
├─────────────────────────────────────────────────────────┤
│ SYNC BRIDGE (Bidirectional)                              │
│ • Event listeners on legacy models                       │
│ • Projections to DDD aggregates                          │
│ • Fallback to legacy if DDD not ready                    │
├─────────────────────────────────────────────────────────┤
│ DDD SYSTEM (New)                                         │
│ • CanonicalGeoUnit Aggregate                             │
│ • Domain Events                                          │
│ • Read models for queries                                │
└─────────────────────────────────────────────────────────┘
```

### **PHASE 2: GRADUAL MIGRATION (Week 4-5)**
**Goal:** Redirect traffic component by component.

```
Week 4: Member Registration → Use DDD Member Aggregate
Week 5: Geography Validation → Use DDD Value Objects
Week 6: Sync Operations → Use Event-driven sync
Week 7: Analytics → Use CQRS Read Models
Week 8: Deprecate Legacy → Mark old models as @deprecated
```

---

## 🤖 **PROMPT ENGINEERING TEMPLATE FOR CLAUDE/AI**

### **GENERAL INSTRUCTIONS (Include in EVERY prompt)**

```
ROLE: Senior Laravel Backend Developer & Solution Architect
ARCHITECTURE: Domain-Driven Design with Evolutionary Adoption

PRIMARY CONSTRAINT: DO NOT BREAK EXISTING FUNCTIONALITY
- Wrap existing models with DDD constructs
- Create anti-corruption layers
- Maintain backward compatibility
- Use feature flags for gradual rollout

TECHNICAL STACK:
- Laravel 12.35.1
- PostgreSQL 15+ (ltree extension available)
- Redis for caching/events
- PestPHP for TDD
- PHP 8.3+ features

DEVELOPMENT PRINCIPLES:
1. TDD First: Write failing test → Minimal implementation → Refactor
2. DDD Boundaries: Clear context separation (Geography vs Membership)
3. Evolutionary Design: Build alongside, not instead of
4. Performance: Use materialized paths, caching, optimized queries
5. Security: Tenant isolation is non-negotiable

CODING STANDARDS:
- declare(strict_types=1) in every file
- PHP 8.3 readonly classes where applicable
- Constructor property promotion
- Domain Exceptions for business rules
- Repository pattern for persistence
- Dependency injection via constructor

TESTING REQUIREMENTS:
- 90%+ test coverage
- Mock external dependencies
- Test business rules, not implementation
- Integration tests for cross-context boundaries
- Performance tests for critical paths

DELIVERABLE FORMAT:
1. Complete PestPHP test file (failing tests)
2. Domain Value Objects (immutable)
3. Domain Entities/Aggregates
4. Application Services
5. Infrastructure adapters
6. Integration with existing models
```

---

## 🎯 **SPECIFIC IMPLEMENTATION PROMPTS**

### **PROMPT 1: CREATE GEOGRAPHY VALUE OBJECTS (Week 1)**

```
Create Geography Context Value Objects that wrap your existing MasterGeoUnit:

REQUIREMENTS:
1. Create GeoPath Value Object
   - Immutable with readonly properties
   - Validates PostgreSQL ltree format: /^\d+(\.\d+)*$/
   - Methods: isDescendantOf(), getDepth(), getParentPath()
   - Factory method from existing MasterGeoUnit hierarchy

2. Create CountryCode Value Object  
   - ISO 3166-1 alpha-2 validation
   - Factory method: fromExistingCountryRecord()
   - Localized name retrieval from your existing Country model

3. Create GeographyHierarchy Value Object
   - Validates level sequence per country rules
   - Can be built from existing Member's 8 geography IDs
   - Methods: isComplete(), getMissingLevels(), validateAgainstMaster()

4. Create LocalizedName Value Object
   - JSON structure: {en: "Kathmandu", np: "काठमाडौं"}
   - Fallback logic: en → np → first available
   - Factory from existing geo_administrative_units.name_local

TDD APPROACH:
1. Write tests for each Value Object first
2. Test wrapping existing database records
3. Test validation rules match your existing business logic
4. Test immutability guarantees

INTEGRATION WITH EXISTING:
- Use your GeographyService for validation
- Read from existing MasterGeoUnit table
- Cache results for performance
- No database schema changes
```

### **PROMPT 2: CREATE ANTI-CORRUPTION LAYER (Week 2)**

```
Create anti-corruption layer between existing models and DDD aggregates:

REQUIREMENTS:
1. LegacyGeographyAdapter
   - Implements GeoUnitRepositoryInterface (DDD)
   - Uses existing MasterGeoUnit and GeoAdministrativeUnit models
   - Maps database records to DDD aggregates
   - Handles caching using existing GeographyService cache

2. TenantMembershipAdapter  
   - Implements MemberRepositoryInterface (DDD)
   - Uses existing Member model
   - Maps 8-level geography IDs to GeographyHierarchy Value Object
   - Handles tenant isolation using existing multi-tenancy

3. SyncEventBridge
   - Listens to existing model events (created, updated, deleted)
   - Translates to DDD domain events
   - Publishes to event bus for new DDD system
   - Maintains backward compatibility

TDD APPROACH:
1. Test that adapter returns same data as direct model query
2. Test event translation preserves all data
3. Test performance is not degraded
4. Test error handling when legacy models fail

INTEGRATION POINTS:
- Use existing database connections
- Respect existing tenant middleware
- Use existing validation rules
- Maintain existing API responses format
```

### **PROMPT 3: CREATE CANONICALGEOUNIT AGGREGATE (Week 3)**

```
Create CanonicalGeoUnit Aggregate Root that works alongside existing MasterGeoUnit:

REQUIREMENTS:
1. Aggregate Structure
   - Reconstitute from existing MasterGeoUnit records
   - Event sourcing: rebuild state from Domain Events
   - Business rules: uniqueness, hierarchy validation
   - Published methods: establish(), rename(), moveToParent()

2. Domain Events
   - CanonicalGeoUnitEstablished (when new unit verified)
   - GeoUnitNameChanged (when consensus name emerges)
   - GeoUnitHierarchyUpdated (when parent changes)
   - All events include tenant source information

3. Projections
   - Build read models that match existing MasterGeoUnit structure
   - Materialized views for fast queries
   - Cache for frequently accessed data
   - Sync with existing table for backward compatibility

TDD APPROACH:
1. Test aggregate business rules
2. Test event sourcing rebuilds correct state
3. Test projections match existing data
4. Test concurrent modification handling

EVOLUTIONARY DESIGN:
- Initially populate from existing MasterGeoUnit
- Listen to existing model changes
- Gradually shift writes to aggregate
- Keep both systems in sync
```

### **PROMPT 4: CREATE TENANT CONTEXT WITH JURISDICTION (Week 4)**

```
Create Tenant Context with Member Aggregate and jurisdiction system:

REQUIREMENTS:
1. Member Aggregate
   - Constructor accepts TenantUser from existing system
   - Geography assignment using GeographyHierarchy Value Object
   - Business rules: unique membership number, status transitions
   - Jurisdiction validation based on TenantUser's geography

2. Jurisdiction Service
   - Automatic filtering based on authenticated TenantUser
   - Works with existing admin_unit_level* columns
   - Respects existing role-based permissions
   - Can be disabled via feature flag

3. MemberRegistrationService (DDD version)
   - Uses existing Member model for persistence
   - Uses DDD aggregates for business logic
   - Emits domain events for analytics
   - Compatible with existing API endpoints

TDD APPROACH:
1. Test jurisdiction filtering matches existing behavior
2. Test business rules are stricter than existing validation
3. Test domain events contain all necessary data
4. Test backward compatibility with existing member data

GRADUAL ROLLOUT:
- Feature flag to switch between old/new service
- A/B test with subset of tenants
- Monitor for performance regressions
- Rollback capability
```

### **PROMPT 5: CREATE EVENT-DRIVEN SYNC (Week 5)**

```
Create event-driven sync system that replaces GeographyMirrorService:

REQUIREMENTS:
1. Event Store
   - PostgreSQL table for domain events
   - Event replay capability
   - Idempotent event handling
   - Schema compatible with existing data

2. Sync Service
   - Listens to TenantGeoUnitCreated events
   - Matches with existing CanonicalGeoUnit
   - Handles naming conflicts using consensus algorithm
   - Emits sync result events

3. Conflict Resolution
   - Detects when different tenants report same unit
   - Applies business rules for name selection
   - Administrator override capability
   - Audit trail of all decisions

TDD APPROACH:
1. Test event sourcing rebuilds correct state
2. Test conflict detection algorithm
3. Test idempotency of event handlers
4. Test performance with large datasets

MIGRATION PATH:
1. Run existing GeographyMirrorService
2. Start emitting events from it
3. Build event handlers that do nothing initially
4. Gradually add functionality to event handlers
5. Eventually disable GeographyMirrorService
```

---

## 🔧 **IMMEDIATE STARTING POINT (Today)**

### **Prompt for Day 1 Implementation:**

```
ROLE: Senior Laravel Backend Developer
MISSION: Create GeoPath Value Object that works with existing MasterGeoUnit

CONTEXT: We have existing MasterGeoUnit model with hierarchy. Need to create immutable GeoPath Value Object that can be constructed from existing data.

TDD STEPS:
1. Create test: tests/Unit/Contexts/Geography/ValueObjects/GeoPathTest.php
   - test_can_be_created_from_master_geo_unit()
   - test_validates_ltree_format()
   - test_calculates_parent_path()
   - test_detects_descendant_relationship()

2. Implement GeoPath Value Object:
   - app/Contexts/Geography/Domain/ValueObjects/GeoPath.php
   - Factory method: fromMasterGeoUnit(MasterGeoUnit $unit)
   - Use existing parent_id relationships
   - Cache generated paths

3. Create adapter for existing usage:
   - app/Contexts/Geography/Infrastructure/Adapters/LegacyGeoPathAdapter.php
   - Method: getPathForMember(Member $member): GeoPath
   - Uses existing admin_unit_level* columns

4. Integration test:
   - Verify GeoPath matches existing hierarchy queries
   - Performance comparison with direct SQL
   - Backward compatibility check

CONSTRAINTS:
- No changes to existing database schema
- No breaking changes to existing APIs
- Use existing GeographyService for validation
- Cache aggressively for performance

DELIVER: Complete working code with 100% test coverage.
```

---

## 📊 **ROLLOUT SCHEDULE & METRICS**

### **Week-by-Week Plan:**

| **Week** | **Focus** | **Success Metrics** | **Rollback Plan** |
|----------|-----------|---------------------|-------------------|
| **Week 1** | Value Objects | 100% test coverage, zero performance impact | Remove Value Objects, revert to primitives |
| **Week 2** | Anti-corruption Layer | All existing tests pass, data consistency | Disable adapters, use models directly |
| **Week 3** | Aggregates (Read-only) | Event sourcing works, projections accurate | Switch back to direct model queries |
| **Week 4** | Business Logic Migration | Business rules enforced, domain events emitted | Feature flag to old service |
| **Week 5** | Event-Driven Sync | Sync performance equal or better | Re-enable GeographyMirrorService |
| **Week 6** | Gradual Traffic Shift | 50% traffic on new system, no errors | Redirect 100% back to old system |
| **Week 7** | Full Migration | 100% traffic, performance improved | Keep old system as read-only backup |
| **Week 8** | Cleanup | Remove deprecated code, reduce complexity | Archive old code in separate branch |

---

## 🚨 **RISK MITIGATION STRATEGIES**

### **1. Feature Flags Everywhere**
```php
// app/Providers/AppServiceProvider.php
class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Feature flag for DDD vs Legacy
        if (config('features.ddd_geography_enabled')) {
            $this->app->bind(GeoUnitRepositoryInterface::class, 
                DddGeoUnitRepository::class);
        } else {
            $this->app->bind(GeoUnitRepositoryInterface::class,
                LegacyGeoUnitRepository::class);
        }
    }
}
```

### **2. Data Consistency Monitoring**
```php
// app/Console/Commands/CheckGeographyConsistency.php
class CheckGeographyConsistency extends Command
{
    public function handle(): void
    {
        // Compare DDD aggregates with legacy models
        $discrepancies = $this->compareAllGeoUnits();
        
        if ($discrepancies > 0) {
            // Alert team, pause rollout
            $this->error("Data inconsistency detected: {$discrepancies} records");
            // Optionally auto-correct or flag for review
        }
    }
}
```

### **3. Performance Baseline & Monitoring**
```bash
# Weekly performance check
php artisan geo:performance-benchmark --system=legacy
php artisan geo:performance-benchmark --system=ddd

# Expected: DDD should be within 10% of legacy
# If DDD is slower, investigate before proceeding
```

---

## 🎯 **KEY DECISIONS FOR TEAM ALIGNMENT**

### **Decision 1: Dual-Write Period**
**Duration:** 4-6 weeks  
**Strategy:** Write to both systems, verify consistency  
**Fallback:** If inconsistencies > 1%, pause and investigate

### **Decision 2: Cutover Strategy**  
**Option A:** Tenant-by-tenant migration (safer)  
**Option B:** Feature-by-feature migration (simpler)  
**Recommendation:** Start with Option B for low-risk features

### **Decision 3: Deprecation Timeline**
**Month 1-2:** Dual run  
**Month 3:** Mark legacy as deprecated  
**Month 4:** Remove from new development  
**Month 6:** Complete removal (if stable)

---

## 📋 **IMMEDIATE ACTION ITEMS**

1. **Today:** Create GeoPath Value Object (2-3 hours)
2. **Tomorrow:** Build anti-corruption layer for Member (3 hours)
3. **Day 3:** Add feature flags and monitoring (2 hours)
4. **Day 4:** Run consistency checks on production data (1 hour)
5. **Day 5:** Deploy to staging, test with real data (4 hours)

**Total Week 1 Effort:** ~12 hours

---

## ❓ **QUESTIONS TO RESOLVE BEFORE STARTING**

1. **Can you share your current Member model structure?** (to ensure proper mapping)
2. **What's your current cache strategy?** (Redis configuration)
3. **Do you have existing event system?** (Laravel events, queues)
4. **What monitoring tools are in place?** (for performance tracking)
5. **Team size & skill level with DDD?** (training needs)

**Once you provide these details, I can generate the exact implementation code for each prompt.**