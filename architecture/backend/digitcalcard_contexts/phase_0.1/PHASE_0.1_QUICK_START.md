# **PHASE 0.1 SUBSCRIPTION CONTEXT**
## **Quick Start & Execution Summary**

**Status:** ✅ Ready to implement immediately  
**Duration:** 2-3 days (12-15 hours focused work)  
**Approach:** TDD + DDD, copy from Membership module pattern  

---

## **WHAT YOU'RE DOING RIGHT NOW**

You've completed Phase 0 of DigitalCard (walking skeleton). Before starting Phase 1, you're implementing Phase 0.1 Subscription Context to:

1. **Prevent massive refactoring later** - Feature gates exist BEFORE Phase 1 code
2. **Enable clean architecture** - Phase 1 features are "born behind gates"
3. **Establish monetization foundation** - Plans, quotas, feature availability ready
4. **Save 4-6 weeks of work** - 30-40% less development time overall

---

## **YOUR STARTING POINT**

```
What you have:
✅ DigitalCard Phase 0: Complete (5 tests, walking skeleton)
✅ Membership Module: Pattern reference
✅ DDD/TDD Workflow: Proven and working
✅ Multi-tenant architecture: Established

What you're adding:
⬜ Subscription Context (Phase 0.1)
   ├─ Plan selection (free, pro, enterprise)
   ├─ Feature gating (can tenant access feature X?)
   └─ Quota enforcement (10 cards/month for free, unlimited for pro)

What comes next:
⬜ Phase 1 DigitalCard (with subscriptions integrated)
```

---

## **THE MINIMAL SCOPE**

### **Building (DO THIS)**

✅ Subscription existence tracking  
✅ Plan/tier system (3 tiers: free, professional, enterprise)  
✅ Feature inclusion in plans  
✅ Quota definition (e.g., 10 cards/month for free)  
✅ Feature checking API (`$featureGate->can()`)  
✅ Quota enforcement API (`$featureGate->isQuotaExceeded()`)  

### **Not Building Yet (DON'T DO THIS)**

❌ Payment processing  
❌ Billing/invoicing  
❌ Usage analytics  
❌ Upgrade/downgrade flows  
❌ Complex renewal logic  

**Scope:** ~5% of full subscription system. Just the foundation.

---

## **ARCHITECTURE AT A GLANCE**

```
Domain Layer (Pure Business Logic):
  ├─ Plan (what features are included?)
  ├─ Subscription (which tenant has which plan?)
  ├─ Feature (individual features with quotas)
  └─ Repositories (interfaces)

Application Layer (Use Cases):
  ├─ SubscriptionService (create subscription, check if exists)
  └─ FeatureGateService (check features, check quotas)

Infrastructure Layer (Technical):
  ├─ Eloquent Models
  ├─ Repository Implementations
  └─ Service Provider

Database (Landlord DB):
  ├─ plans
  ├─ plan_features
  └─ subscriptions
```

---

## **THE THREE FILES YOU NEED**

All three are in `/mnt/user-data/outputs/`:

### **1. PHASE_0.1_SUBSCRIPTION_MINIMAL_PROMPT.md** ⭐ (THIS ONE)

**What it is:** Complete, professional Claude CLI prompt with all code

**Contains:**
- Full explanation of why (avoid massive refactoring)
- Complete folder structure
- Database schema (DDL)
- All domain entities with code
- All application services with code
- All Eloquent implementations
- All test examples
- Integration with DigitalCard Phase 1

**How to use:**
1. Open this file
2. Copy entire content
3. Paste into Claude chat
4. Claude will implement it section by section
5. Follow the checklist

**Best for:** Giving to Claude for development

---

### **2. README.md & SUBSCRIPTION_ARCHITECTURE.md**

**What they are:** Reference documents for understanding the bigger picture

**Contains:**
- Strategic reasoning
- Architectural principles
- How subscriptions fit in overall system
- Future roadmap (Phases 1-4)

**How to use:**
- Read for context and understanding
- Reference when Claude asks questions
- Share with team for alignment

**Best for:** Understanding why this design, team discussions

---

### **3. PHASE_0_MINIMAL_SUMMARY.txt** (Create yourself from this file)

**What it is:** One-page cheat sheet

**Copy this:**

```
PHASE 0.1 SUBSCRIPTION CONTEXT - 2-3 DAY IMPLEMENTATION

WHAT: Minimal subscription foundation (plans, features, quotas)
WHY: Avoid massive refactoring when adding subscriptions to Phase 1
HOW: TDD + DDD following Membership module pattern

KEY FILES:
  - Plans table (free, pro, enterprise)
  - Subscriptions table (tenant → module → plan)
  - Domain entities: Plan, Subscription, Feature
  - Services: SubscriptionService, FeatureGateService
  - Tests: CreateSubscriptionTest, FeatureGateTest

USAGE IN PHASE 1 DIGITALCARD:
  if (!$featureGate->can($tenantId, 'digital_card', 'digital_cards')) {
    throw DigitalCardException::moduleNotSubscribed();
  }

TIMELINE:
  Day 1: Domain layer + tests (4-5 hours)
  Day 2: Application + Infrastructure (4-5 hours)
  Day 3: Testing + Polish (2-3 hours)

SUCCESS: All tests green, 90% coverage, PHPStan Level 8 clean
```

---

## **THREE-DAY EXECUTION PLAN**

### **Day 1: Build the Domain (TDD RED Phase)**

**Morning (2-3 hours):**
1. Create migration for 3 tables (plans, plan_features, subscriptions)
2. Create test files: `CreateSubscriptionTest.php`, `FeatureGateTest.php`
3. Write failing tests (RED phase)

**Afternoon (2-3 hours):**
1. Implement domain entities: Plan, Subscription, Feature
2. Implement value objects: PlanId, SubscriptionId
3. Create repository interfaces
4. Tests still failing

**Command:**
```bash
cd packages/laravel-backend

# Create migration
php artisan make:migration create_subscription_foundation_tables

# Create test files
php artisan make:test Feature/Contexts/Subscription/CreateSubscriptionTest
php artisan make:test Feature/Contexts/Subscription/FeatureGateTest

# Run tests (should fail)
php artisan test tests/Feature/Contexts/Subscription/
```

---

### **Day 2: Build Implementation (TDD GREEN Phase)**

**Morning (2-3 hours):**
1. Create Eloquent models: PlanModel, SubscriptionModel
2. Create repository implementations
3. Tests start passing

**Afternoon (2-3 hours):**
1. Create SubscriptionService
2. Create FeatureGateService
3. Register ServiceProvider
4. All tests passing (GREEN phase)

**Command:**
```bash
# Run tests (should pass)
php artisan test tests/Feature/Contexts/Subscription/

# Check coverage
php artisan test tests/Feature/Contexts/Subscription/ --coverage-text
```

---

### **Day 3: Polish & Verify (TDD REFACTOR Phase)**

**Morning (1-2 hours):**
1. Clean up code (REFACTOR phase)
2. Add documentation comments
3. Verify type hints everywhere
4. Run static analysis

**Afternoon (1 hour):**
1. Create seeder: `PlanSeeder.php`
2. Test with seeded data
3. Verify all 90%+ coverage
4. Final checks

**Command:**
```bash
# Static analysis
vendor/bin/phpstan analyse --level=8 app/Contexts/Subscription/

# Seeder
php artisan make:seeder PlanSeeder

# Final test run
php artisan test tests/Feature/Contexts/Subscription/
```

---

## **HOW TO START RIGHT NOW**

### **Step 1: Open Claude Chat (2 minutes)**

Go to https://claude.ai and start new conversation

### **Step 2: Copy the Prompt (2 minutes)**

Open `/mnt/user-data/outputs/PHASE_0.1_SUBSCRIPTION_MINIMAL_PROMPT.md`  
Copy entire content  
Paste into Claude chat

### **Step 3: Add Your Context (3 minutes)**

Send Claude this message first:

```
I have a Laravel 12 multi-tenant application with:
- Membership module working (use as pattern reference)
- DigitalCard Context Phase 0 complete (walking skeleton)
- DDD/TDD workflow established
- Using PestPHP for tests

I need to implement Phase 0.1: Minimal Subscription Context 
(plans, features, quotas) in 2-3 days using the TDD approach.

Here's the complete specification:
[PASTE PHASE_0.1_SUBSCRIPTION_MINIMAL_PROMPT.md CONTENT HERE]

Please implement this step by step, showing all code.
```

### **Step 4: Claude Will Implement Section by Section**

Claude will:
1. Ask clarifying questions (if any)
2. Show you code for each section
3. Run tests to verify
4. Fix issues

### **Step 5: You Implement in Your Codebase**

As Claude shows code:
1. Copy each code section
2. Create the files
3. Paste the code
4. Run tests locally

---

## **INTEGRATION WITH PHASE 1**

Once Phase 0.1 is done, your Phase 1 DigitalCard code will look like:

```php
// In IssueCardHandler
public function handle(IssueCardCommand $command): CardDTO
{
    // ✅ NEW: Check subscription
    if (!$this->featureGate->can($command->tenantId, 'digital_card', 'digital_cards')) {
        throw DigitalCardException::moduleNotSubscribed();
    }

    // ✅ NEW: Check quota
    $monthlyUsage = $this->getMonthlyCardCount($command->tenantId);
    if ($this->featureGate->isQuotaExceeded(
        $command->tenantId,
        'digital_card',
        'digital_cards',
        $monthlyUsage
    )) {
        throw DigitalCardException::quotaExceeded();
    }

    // ✅ EXISTING: Your Phase 0 business logic continues
    $card = DigitalCard::create(
        CardId::generate(),
        $command->tenantId,
        $command->memberId,
    );
    // ... persist, events, etc.
}
```

No massive refactoring. Just a couple of checks at the beginning.

---

## **SUCCESS CHECKLIST**

By end of day 3, verify:

**Functionality:**
- [ ] Can create subscription
- [ ] Can check if tenant has subscription
- [ ] Feature availability checking works
- [ ] Quota checking works
- [ ] Unlimited features work

**Code Quality:**
- [ ] 90%+ test coverage
- [ ] PHPStan Level 8 clean
- [ ] All tests passing
- [ ] No warnings or errors

**Architecture:**
- [ ] DDD layers maintained
- [ ] No Laravel in Domain
- [ ] Repository pattern used
- [ ] Service provider registered

---

## **WHAT HAPPENS NEXT**

### **Week 1-2: Phase 1 DigitalCard Development**

Start building with subscriptions already in place:
- Activate card operation
- Revoke card operation
- List cards with filters
- Vue admin interface

All with feature gates from day one.

### **Weeks 3-8: Phase 1 Completion**

Continue with high confidence:
- No refactoring for subscriptions
- No breaking existing tests
- No "oh no, we didn't think about quotas"
- Clean, professional architecture

---

## **KEY PRINCIPLES**

**MINIMAL, Not Complete**
- Only what Phase 1 needs
- Don't over-engineer
- 3 tables, 5 services, 2 test files

**TDD-First Approach**
- Write tests before code
- RED → GREEN → REFACTOR
- All tests green by end of day 3

**DDD Architecture**
- Domain layer: pure business logic
- Application layer: use cases
- Infrastructure: technical details
- No framework code in domain

**Copy From Membership**
- Same folder structure
- Same DDD patterns
- Same testing approach
- Same provider registration

---

## **ESTIMATED TIMELINE**

```
Day 1 (Monday):
  9:00-12:00  Domain entities + tests
  1:00-5:00   Test failures, domain implementation
  Result:     Plan, Subscription, Feature entities created
              Tests still RED

Day 2 (Tuesday):
  9:00-12:00  Eloquent models, repositories
  1:00-5:00   Services, provider registration
  Result:     All tests GREEN
              Infrastructure complete

Day 3 (Wednesday):
  9:00-10:00  Code cleanup, documentation
  10:00-12:00 Static analysis, seeder
  1:00-5:00   Final verification, polish
  Result:     ✅ PHASE 0.1 COMPLETE
              Ready to start Phase 1 Thursday morning
```

---

## **FINAL SUMMARY**

**What:** Minimal Subscription Context (plans, features, quotas)  
**When:** 2-3 days (starting now)  
**Why:** Avoid massive refactoring in Phase 1  
**How:** TDD + DDD following Membership module pattern  
**Result:** Foundation ready for Phase 1 DigitalCard with subscriptions integrated  

**Next Phase:** Phase 1 DigitalCard (8 weeks) with subscription checks built-in

---

**You're ready. Start with the PHASE_0.1_SUBSCRIPTION_MINIMAL_PROMPT.md file and copy it to Claude. 🚀**

Questions? Refer to SUBSCRIPTION_ARCHITECTURE.md for design rationale.

