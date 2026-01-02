# **MODULEREGISTRY CONTEXT - QUICK START ORIENTATION GUIDE**

**Your entry point to the ModuleRegistry Context implementation**

---

## **🎯 WHAT YOU'RE BUILDING**

A **Bounded Context** that manages the lifecycle of modules across your multi-tenant SaaS platform.

**Current State:**
- ✅ 3 existing contexts complete (DigitalCard, Membership, TenantAuth)
- ✅ Hexagonal architecture proven and working
- ✅ TDD workflow established
- ✅ Domain purity standards enforced

**Your Mission:**
Build ModuleRegistry Context to orchestrate module installation/uninstallation for all future modules (Finance, MembershipForum, Elections, etc.)

**Why It Matters:**
- Currently: ALL tenants have ALL module tables → wastes space
- With ModuleRegistry: Tenants install only modules they pay for → efficient
- Clear module lifecycle → easier team scaling

---

## **📚 READ THESE FIRST (In Order)**

### **1. QUICK READ (30 minutes)**

Start with these 3 files to understand what you're building:

```
1. This file (you're reading it)          [5 min] - Overview
2. MODULEREGISTRY_ARCHITECTURE_ANALYSIS.md [15 min] - Strategic context
3. MODULEREGISTRY_CONTEXT_PROFESSIONAL_PROMPT.md - Sections 1-3 [10 min]
```

**After reading:** You'll understand:
- ✅ Why ModuleRegistry is needed
- ✅ How it fits in the platform
- ✅ High-level architecture

### **2. DETAILED SPEC (2 hours)**

```
MODULEREGISTRY_CONTEXT_PROFESSIONAL_PROMPT.md
├─ Section 1: Strategic Context (10 min)
├─ Section 2: Domain Model (20 min)
├─ Section 3: Application Layer (15 min)
├─ Section 4: Infrastructure (15 min)
├─ Section 5: API Layer (10 min)
├─ Section 6: Testing Strategy (20 min)
├─ Section 7: Implementation Phases (15 min)
├─ Section 8: Architectural Constraints (10 min)
└─ Section 9: Success Metrics (5 min)
```

**After reading:** You'll have:
- ✅ Complete domain model
- ✅ All value objects defined
- ✅ All aggregates specified
- ✅ Database schema
- ✅ Port interfaces

### **3. IMPLEMENTATION GUIDE (Bookmark, Use While Coding)**

```
MODULEREGISTRY_PHASE_BY_PHASE_GUIDE.md
```

**This is your step-by-step checklist for coding.**

---

## **🏗️ ARCHITECTURE AT A GLANCE**

### **The Core Problem You're Solving:**

```
BEFORE ModuleRegistry:
   Every tenant has tables for:
   ├─ digital_cards (whether they use it or not)
   ├─ membership_forum (whether they use it or not)
   ├─ finance (whether they use it or not)
   └─ etc...
   
   Result: Bloated databases, unclear state

AFTER ModuleRegistry:
   Tenant A has tables for:
   ├─ digital_cards (subscribed & installed)
   └─ finance (subscribed & installed)
   
   Tenant B has tables for:
   ├─ membership_forum (subscribed & installed)
   ├─ elections (subscribed & installed)
   └─ (nothing else)
   
   Result: Efficient, clear, scalable
```

### **How It Works:**

```
1. Tenant subscribes to "Finance" module
2. Finance module becomes available in marketplace
3. Tenant clicks "Install Finance"
4. ModuleRegistry validates:
   ├─ Subscription active? ✓
   ├─ Dependencies installed? (e.g., Membership) ✓
   ├─ Disk space available? ✓
   └─ No version conflicts? ✓
5. ModuleRegistry installs:
   ├─ Creates installation job (audit trail)
   ├─ Connects to tenant's database
   ├─ Runs Finance module migrations
   ├─ Seeds default data
   ├─ Runs post-install hooks
   └─ Marks as installed
6. Tenant can now use Finance module
```

### **Architecture Diagram:**

```
┌─────────────────────────────────────┐
│  ModuleRegistry Context             │
├─────────────────────────────────────┤
│ DOMAIN LAYER (Pure Business Logic)  │
├─ Models:                            │
│  ├─ Module                          │
│  ├─ TenantModule                    │
│  └─ ModuleInstallationJob           │
├─ Services:                          │
│  ├─ DependencyResolver              │
│  └─ SubscriptionValidator           │
├─ Events:                            │
│  ├─ ModuleInstallationStarted       │
│  ├─ ModuleInstallationCompleted     │
│  └─ ModuleInstallationFailed        │
└─────────────────────────────────────┘
           ↑           ↑           ↑
    depends on    implements     depends on
           │           │           │
┌──────────┴────┬──────┴──┬───────┴────┐
│               │         │             │
Ports:     Repository  Repositories   Ports
├─         Interfaces   (Abstract)     ├─
│          ├─ Module    (Concrete)     │
│          ├─ Tenant                   │
│          └─ Job       ┌────────────┐ │
│                       │ Adapters   │ │
│                       ├───────────┬┘ │
│                       │ Eloquent  │  │
└───────────┬───────────┤ Spatie    ├──┘
            │           │ Laravel   │
            │           │ HTTP      │
            │           └───────────┘
            │
┌───────────┴──────────────┐
│ INFRASTRUCTURE LAYER     │
├─ Database migrations     │
├─ Eloquent models         │
├─ Framework wrappers      │
└─ Service provider        │
```

---

## **🚀 YOUR STEP-BY-STEP IMPLEMENTATION PLAN**

### **WEEK 1: Domain Layer (TDD - RED → GREEN → REFACTOR)**

**Goal:** Build pure business logic with 100+ tests

```
Monday:
  [ ] Create directory structure
  [ ] Write value objects (5 files, 40+ tests)
  [ ] Write aggregates - Module (12+ tests)
  [ ] Write aggregates - TenantModule (10+ tests)
  [ ] VERIFY: 0 Laravel imports in Domain

Tuesday-Wednesday:
  [ ] Write ModuleInstallationJob aggregate (12+ tests)
  [ ] Write domain services (14+ tests)
  [ ] Write domain exceptions (6 tests)
  [ ] Write domain events (5 tests)
  [ ] VERIFY: 105+ tests passing

Thursday:
  [ ] Write repository interfaces
  [ ] Code review for tenant boundaries
  [ ] Final verification: 90%+ coverage
  [ ] DELIVER: Phase 1 complete
  
TOTAL: 105+ unit tests, zero framework dependencies
```

### **WEEK 2: Application Layer & Infrastructure**

**Monday-Tuesday:**
```
  [ ] Write command classes (5 files)
  [ ] Write command handlers (5 files, 25+ tests)
  [ ] Database migrations (5 tables, landlord DB only)
  [ ] Write repository implementations (Eloquent)
  [ ] VERIFY: All integration tests passing
```

**Wednesday-Thursday:**
```
  [ ] Implement port adapters (5 files)
  [ ] Create service provider (wire up dependencies)
  [ ] Write API controllers
  [ ] Write API routes
  [ ] VERIFY: E2E tests passing
  
TOTAL: 40+ integration tests, complete end-to-end
```

### **WEEK 3-4: API, Polish, Advanced Features**

```
Advanced features, monitoring, documentation
```

---

## **🔑 KEY GOLDEN RULES (MEMORIZE THESE)**

### **Rule #1: TenantId in EVERY Aggregate**

```php
❌ WRONG:
class TenantModule {
    // NO TenantId - FAIL IMMEDIATELY
}

✅ CORRECT:
class TenantModule {
    private TenantId $tenantId;  // REQUIRED
    
    public function belongsToTenant(TenantId $tenantId): bool {
        return $this->tenantId->equals($tenantId);
    }
}
```

**Why?** Multi-tenant isolation is CRITICAL. Every domain object must know which tenant it belongs to.

---

### **Rule #2: Repository ForTenant Methods**

```php
❌ WRONG:
interface TenantModuleRepository {
    public function find(ModuleId $id): ?TenantModule;  // Tenant-agnostic - FAIL
}

✅ CORRECT:
interface TenantModuleRepository {
    public function findForTenant(
        ModuleId $id,
        TenantId $tenantId  // Always required
    ): ?TenantModule;
}
```

**Why?** Forces you to always explicitly pass tenant context. Prevents accidental cross-tenant queries.

---

### **Rule #3: Commands Lead with TenantId**

```php
❌ WRONG:
class InstallModuleCommand {
    public function __construct(
        public readonly ModuleId $moduleId,    // WRONG ORDER
        public readonly TenantId $tenantId,
    ) {}
}

✅ CORRECT:
class InstallModuleCommand {
    public function __construct(
        public readonly TenantId $tenantId,    // FIRST
        public readonly ModuleId $moduleId,
    ) {}
}
```

**Why?** Makes tenant context explicit and primary. Easier to read ("For this tenant, do this").

---

### **Rule #4: Domain Layer = Pure PHP**

```bash
❌ WRONG:
$ grep -r "Illuminate\|Laravel\|Spatie" app/Contexts/ModuleRegistry/Domain/
  Domain/Models/Module.php: use Illuminate\Support\Str;  ← FOUND SOMETHING - FAIL

✅ CORRECT:
$ grep -r "Illuminate\|Laravel\|Spatie" app/Contexts/ModuleRegistry/Domain/
  (no output - returns nothing - PASS)
```

**Why?** Domain logic must be independent of framework. Framework is a detail that can change.

---

### **Rule #5: Handlers Use Domain Services**

```php
❌ WRONG:
class InstallModuleHandler {
    public function handle(InstallModuleCommand $cmd) {
        // Check subscription directly
        if (!Subscription::where('tenant_id', $cmd->tenantId)->exists()) {
            throw new Exception();  // ← WRONG - direct database access
        }
    }
}

✅ CORRECT:
class InstallModuleHandler {
    public function __construct(
        private SubscriptionValidator $subscriptionValidator  // ← DOMAIN SERVICE
    ) {}
    
    public function handle(InstallModuleCommand $cmd) {
        // Use domain service
        $this->subscriptionValidator->canInstall(
            $cmd->tenantId,
            $module
        );
    }
}
```

**Why?** Business logic belongs in Domain, not scattered in handlers.

---

## **⚠️ MOST COMMON MISTAKES (Avoid These)**

### **Mistake 1: Forgetting TenantId in Aggregate**
```
SYMPTOM: Tests pass locally, but fail with multiple tenants
ROOT CAUSE: Aggregate doesn't track tenantId
FIX: Add TenantId property to EVERY aggregate
```

### **Mistake 2: Repository Methods Without TenantId**
```
SYMPTOM: Cross-tenant queries, security breach
ROOT CAUSE: Repository methods don't require TenantId
FIX: All repository methods MUST include TenantId parameter
```

### **Mistake 3: Framework Imports in Domain**
```
SYMPTOM: Domain layer not portable, tightly coupled to Laravel
ROOT CAUSE: Used Illuminate\* or framework classes in Domain
FIX: Use only pure PHP in Domain layer
```

### **Mistake 4: Skipping Repository Interfaces**
```
SYMPTOM: Hard to test, can't use fakes
ROOT CAUSE: No interfaces defined for repositories
FIX: Define repository interfaces in Domain layer
```

### **Mistake 5: Not Writing Tests First**
```
SYMPTOM: Architecture collapses, quality decreases
ROOT CAUSE: Wrote code first, tests second
FIX: TDD workflow: RED → GREEN → REFACTOR
```

---

## **📋 YOUR DAILY CHECKLIST**

### **Each Day, Before You Start:**

```
[ ] Read the architecture analysis again (10 min)
[ ] Review yesterday's code for rule violations
[ ] Know what phase you're in
[ ] Have specific test case in mind before writing code
```

### **Each Hour of Coding:**

```
[ ] Write failing test first (RED)
[ ] Write minimal code to pass test (GREEN)
[ ] Refactor for clarity (REFACTOR)
[ ] Check for framework imports in Domain (RED FLAG)
[ ] Verify tenant boundaries (RED FLAG)
```

### **End of Each Phase:**

```
[ ] 90%+ code coverage
[ ] All tests passing
[ ] Run: grep -r "Illuminate" app/Contexts/ModuleRegistry/Domain/ → NOTHING
[ ] Code review for tenant isolation
[ ] Supervisor validation passed
```

---

## **💬 WHEN YOU'RE STUCK**

### **Problem: "Where do I put this code?"**

```
Domain Layer (Pure PHP):
├─ Business rules, validation, domain events
├─ Aggregates, value objects, domain services
└─ No framework, no external dependencies

Application Layer:
├─ Commands & handlers (use cases)
├─ Application services (orchestration)
└─ Uses domain services & repositories

Infrastructure Layer:
├─ Database migrations, Eloquent models
├─ Repository implementations, adapters
└─ Framework wrappers

If unsure: "Is this business logic?" → Domain
           "Is this a use case?" → Application  
           "Is this framework-specific?" → Infrastructure
```

### **Problem: "How do I test this?"**

```
Always use TDD:
1. Write test first (RED) - test the behavior you want
2. Write minimal code to pass (GREEN) - just enough
3. Refactor for clarity (REFACTOR) - improve quality

Never do:
- "I'll test later" - you won't
- "This is too hard to test" - it's not, your design is wrong
- "Let me write the code first" - write test first
```

### **Problem: "Is this correct architecture?"**

```
Check the 5 Golden Rules:
✓ Rule 1: TenantId in every aggregate?
✓ Rule 2: Repository ForTenant methods?
✓ Rule 3: Commands lead with TenantId?
✓ Rule 4: Domain layer pure PHP?
✓ Rule 5: Handlers use domain services?

If all 5 are YES → correct
If ANY is NO → incorrect, fix it before moving on
```

---

## **📞 ASKING FOR HELP**

**When stuck, ask supervisor with:**

```
PROBLEM: [What are you trying to do]
CODE: [Show relevant code snippet]
BLOCKER: [What's preventing progress]
ATTEMPTED: [What you've already tried]
```

**Supervisor will respond:**

```
✅ APPROVED: [Brief reason] 

❌ REJECT: [Specific violation]
   → Expected: [What should have been done]
   → Fix: [Specific instructions]
```

---

## **🎓 LEARNING RESOURCES**

Within this project:

1. **MODULEREGISTRY_CONTEXT_PROFESSIONAL_PROMPT.md** - Complete specification
2. **MODULEREGISTRY_ARCHITECTURE_ANALYSIS.md** - Strategic context
3. **MODULEREGISTRY_PHASE_BY_PHASE_GUIDE.md** - Implementation checklist
4. **Claude.md** (uploaded) - Golden rules for architecture
5. **message_for_supervisor_for_next_level.md** - Supervisor expectations

From your codebase:

1. **DigitalCard Context** - Working example of hexagonal architecture
2. **Subscription Context** - Working example of TDD approach
3. **Tests in DigitalCard** - Working examples of test patterns

---

## **✅ SUCCESS CRITERIA**

### **Phase 1 Success:**
```
[ ] 105+ unit tests passing
[ ] 90%+ code coverage
[ ] Zero framework imports in Domain layer
[ ] All aggregates have belongsToTenant()
[ ] All repositories use ForTenant naming
[ ] All domain rules enforced by tests
[ ] Code review passed
```

### **Phase 2 Success:**
```
[ ] 25+ integration tests passing
[ ] End-to-end installation workflow working
[ ] Subscription checks enforced
[ ] Dependency resolution working
[ ] Tenant isolation verified
```

### **Final Success:**
```
[ ] 110+ total tests passing
[ ] Installation <5 seconds
[ ] Dependency resolution <100ms
[ ] All architectural rules enforced
[ ] Production-ready code
[ ] Supervisor approved
```

---

## **🚀 LET'S GO**

You have:
- ✅ Complete specification (MODULEREGISTRY_CONTEXT_PROFESSIONAL_PROMPT.md)
- ✅ Strategic analysis (MODULEREGISTRY_ARCHITECTURE_ANALYSIS.md)
- ✅ Phase-by-phase guide (MODULEREGISTRY_PHASE_BY_PHASE_GUIDE.md)
- ✅ This orientation (you're reading it)
- ✅ Golden rules (memorize Rule #1-5)
- ✅ Working examples (DigitalCard, Subscription contexts)

**Next 5 minutes:**
1. Create directory structure
2. Open MODULEREGISTRY_PHASE_BY_PHASE_GUIDE.md
3. Start with Task 1.1.1
4. Write first failing test
5. Build the most elegant, pure domain layer ever

**Remember:** TDD. Red → Green → Refactor. Domain purity. Tenant boundaries. You got this.

Let's build ModuleRegistry Context. 🚀

---

**Status:** ✅ **READY TO START CODING**

Begin with Phase 1, Task 1.1.1. Follow the phase-by-phase guide. Trust the architecture. Write tests first.

**Success is inevitable.** 💪

