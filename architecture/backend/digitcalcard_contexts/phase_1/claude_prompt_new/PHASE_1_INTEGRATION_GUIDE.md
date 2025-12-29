# **PHASE 1 DIGITALCARD CONTEXT - NEXT STEPS**
## **Integration Guide & Implementation Plan**

**Status:** Phase 0.1 ✅ COMPLETE → Phase 1 🚀 READY TO START  
**Date:** 2025-12-27  
**Duration:** 8 weeks  
**Approach:** TDD + DDD with subscription integration  

---

## **PHASE 0.1 COMPLETION SUMMARY**

Your Phase 0.1 Subscription Context is now complete:

```
✅ Tests: 15 passing (22 assertions)
✅ Time: 11 hours (73% of planned)
✅ Architecture: Clean DDD with zero Laravel in Domain
✅ Services Ready: SubscriptionService, FeatureGateService
✅ Database: 3 tables (plans, plan_features, subscriptions)
✅ Cost Savings: $18,400 + 5 weeks of development time
```

**Key Achievement:** You can now build Phase 1 with feature gates already in place, avoiding massive refactoring.

---

## **WHAT PHASE 1 IS**

**Building:** Full DigitalCard lifecycle with subscription integration

```
Card Operations:
  Phase 0: Issue card (issued status) ✅ DONE
  Phase 1 NEW:
    └─ Activate card (issued → active)
    └─ Revoke card (active/issued → revoked)
    └─ List cards (with filtering & pagination)
    └─ Get card details
    └─ Admin UI (Vue.js)

Subscription Integration:
    └─ Check subscription before issuing/activating
    └─ Check quotas (e.g., free plan = 10 cards/month)
    └─ Handle quota violations
    └─ Usage tracking
```

**Scope:** ~8 weeks of focused development

---

## **THE INTEGRATION PATTERN (2-3 LINES)**

Here's exactly how Phase 1 uses Phase 0.1:

```php
// In any DigitalCard handler:

class IssueCardHandler
{
    public function __construct(
        private FeatureGateService $featureGate,  // ← From Phase 0.1
        private DigitalCardRepository $cards,
    ) {}

    public function handle(IssueCardCommand $command): CardDTO
    {
        // ✅ NEW: 2-3 lines of subscription checks
        if (!$this->featureGate->can(
            $command->tenantId,
            'digital_card',  // Module name
            'digital_cards'  // Feature name
        )) {
            throw new ModuleNotSubscribedException();
        }

        // ✅ NEW: Check quota if needed
        $monthlyUsage = $this->getMonthlyUsage($command->tenantId);
        if ($this->featureGate->isQuotaExceeded(
            $command->tenantId,
            'digital_card',
            'digital_cards',
            $monthlyUsage
        )) {
            throw new QuotaExceededException();
        }

        // ✅ EXISTING: Your Phase 0 business logic continues
        $card = DigitalCard::issue(
            CardId::generate(),
            $command->tenantId,
            $command->memberId,
            $command->expiresAt,
        );

        $this->cards->save($card);
        // ... publish events, etc.

        return CardDTO::fromEntity($card);
    }
}
```

**That's it.** Feature gates are transparent. Your business logic is clean.

---

## **YOUR NEXT STEPS (START MONDAY)**

### **Step 1: Copy Phase 1 Specification**

File: `PHASE_1_DIGITALCARD_FULL_LIFECYCLE_PROMPT.md` (in /outputs/)

Contains:
- Complete updated DigitalCard entity
- All Phase 1 commands and handlers
- Database migrations
- Controller with all actions
- Vue.js components (index, modals, etc.)
- Authorization policies
- Tests (15+ test cases)
- Event listeners

### **Step 2: Send to Claude**

```
I have Phase 0 DigitalCard (walking skeleton) complete
and Phase 0.1 Subscription Context (15 tests passing) complete.

Now implement Phase 1: Full DigitalCard lifecycle.

Here's the complete specification:
[PASTE PHASE_1_DIGITALCARD_FULL_LIFECYCLE_PROMPT.md]

Please implement step by step, starting with:
1. Updated DigitalCard entity
2. Commands and handlers
3. Database migrations
4. Tests
5. Controller
6. Vue.js UI
```

### **Step 3: Follow 8-Week Plan**

```
Week 1: Domain layer + tests (RED → GREEN)
Week 2: Infrastructure + controllers
Week 3-4: Vue.js UI components
Week 5-6: Authorization, policies, middleware
Week 7-8: Performance, documentation, polish
```

---

## **WHAT'S ALREADY DONE (YOU CAN USE)**

### **From Phase 0.1 Subscription**

✅ `FeatureGateService` - Check if tenant has feature access
```php
$featureGate->can($tenantId, 'digital_card', 'digital_cards')  // true/false
$featureGate->quota($tenantId, 'digital_card', 'digital_cards')  // 10 or null
$featureGate->isQuotaExceeded(...)  // true/false
```

✅ `SubscriptionService` - Manage subscriptions
```php
$subscriptionService->subscribe($tenantId, 'digital_card', 'free')
$subscriptionService->hasSubscription($tenantId, 'digital_card')
$subscriptionService->getPlanFor($tenantId, 'digital_card')
```

✅ Database tables
- `plans` (free, professional, enterprise)
- `plan_features` (quotas per plan)
- `subscriptions` (tenant → plan mapping)

✅ 15 passing tests covering all scenarios

### **From Phase 0 DigitalCard**

✅ `DigitalCard` aggregate entity
✅ `CardId`, `MemberId`, `QRCode` value objects
✅ `CardStatus` enum (issued, active, revoked, expired)
✅ `CardIssued` domain event
✅ `IssueCardHandler` (proven pattern)
✅ `DigitalCardRepository` interface
✅ Database migration (`digital_cards` table)
✅ 5 passing tests

---

## **PHASE 1 DELIVERABLES**

By end of 8 weeks, you'll have:

### **Domain Layer**
- ✅ Updated DigitalCard entity (activate, revoke methods)
- ✅ CardActivated, CardRevoked domain events
- ✅ No new value objects needed (reuse Phase 0)

### **Application Layer**
- ✅ ActivateCardCommand/Handler
- ✅ RevokeCardCommand/Handler
- ✅ GetCardQuery/Handler
- ✅ ListCardsQuery/Handler

### **Infrastructure Layer**
- ✅ Updated DigitalCardController (4 new endpoints)
- ✅ Database migration (Phase 1 columns)
- ✅ Authorization policy
- ✅ Event listeners

### **Frontend Layer**
- ✅ Cards index component (listing with filters)
- ✅ Issue card modal
- ✅ Revoke card modal
- ✅ Card details modal
- ✅ Status badge component

### **Tests**
- ✅ 15+ new test cases
- ✅ 90%+ coverage maintained
- ✅ All workflows tested (RED → GREEN → REFACTOR)

### **Documentation**
- ✅ Developer guide
- ✅ Integration examples
- ✅ API documentation
- ✅ Troubleshooting guide

---

## **8-WEEK TIMELINE**

```
WEEK 1 (Domain & Tests):
  Mon-Tue: Update DigitalCard entity, new events
  Wed-Thu: Write Phase 1 tests (TDD RED phase)
  Fri:     Domain logic complete, tests RED

WEEK 2 (Infrastructure):
  Mon-Tue: Create commands/handlers
  Wed-Thu: Database migrations, Eloquent updates
  Fri:     Tests passing (TDD GREEN phase)

WEEK 3-4 (Controller & API):
  Mon-Tue: Update controller with new actions
  Wed-Thu: Authorization policies
  Fri:     API endpoints fully functional

WEEK 5-6 (Vue.js UI):
  Mon-Tue: Index component + table
  Wed-Thu: Modals (issue, activate, revoke, details)
  Fri:     Full UI working with all actions

WEEK 7 (Polish):
  Mon-Tue: Performance optimization
  Wed-Thu: Code cleanup, documentation
  Fri:     Final testing, 90%+ coverage verification

WEEK 8 (Launch Ready):
  Mon-Tue: Edge case handling
  Wed-Thu: Team review, approval
  Fri:     ✅ PHASE 1 COMPLETE - Ready for production
```

---

## **INTEGRATION VERIFICATION**

After you've implemented Phase 1, verify integration:

```bash
# 1. All tests passing
php artisan test tests/Feature/Contexts/DigitalCard/ --coverage-text

# 2. Subscription checks working
# - Try issuing card without subscription → should fail
# - Subscribe tenant → issue card → should succeed
# - Subscribe to free plan (10 cards) → issue 11 → should fail

# 3. Full lifecycle working
# Issue → Activate → List → View → Revoke → All in UI

# 4. Authorization working
# - Member cannot revoke → 403
# - Admin can revoke → 200

# 5. Performance
# - List 1000 cards: < 200ms
# - Single card: < 50ms
# - Subscribe: < 100ms
```

---

## **COMMON PHASE 1 PATTERNS**

### **Pattern 1: Subscription Check in Handler**

```php
public function handle(SomeCardCommand $command)
{
    // Always check subscription first
    if (!$this->featureGate->can(
        $command->tenantId,
        'digital_card',
        'digital_cards'
    )) {
        throw new ModuleNotSubscribedException();
    }

    // Continue with business logic
}
```

### **Pattern 2: Quota Check Before Creating**

```php
// Check if we can issue another card
$monthlyUsage = $this->getMonthlyCardCount($command->tenantId);

if ($this->featureGate->isQuotaExceeded(
    $command->tenantId,
    'digital_card',
    'digital_cards',
    $monthlyUsage
)) {
    throw new QuotaExceededException(
        currentUsage: $monthlyUsage,
        limit: $this->featureGate->quota(...)
    );
}
```

### **Pattern 3: Domain Event Publishing**

```php
// After creating/modifying card
foreach ($card->flushDomainEvents() as $event) {
    event($event);  // Triggers listeners
}
```

### **Pattern 4: Authorization in Controller**

```php
public function activate(Request $request, string $cardId)
{
    // Laravel authorization
    $this->authorize('activate', 'digital-card');

    // Subscription check happens in handler
    $command = new ActivateCardCommand(...);
    $card = $this->dispatch($command);

    return response()->json(['data' => $card]);
}
```

---

## **WHAT TO DO RIGHT NOW**

### **Today (Friday)**
1. ✅ Read this guide
2. ✅ Read `PHASE_1_DIGITALCARD_FULL_LIFECYCLE_PROMPT.md`
3. ✅ Understand the integration points
4. ✅ Plan your first week

### **Monday (Start Phase 1)**
1. ✅ Copy Phase 1 prompt to Claude
2. ✅ Start with entity updates (section 1)
3. ✅ Write failing tests (TDD RED)
4. ✅ Implement to make tests pass (TDD GREEN)

### **Week 1 Goal**
- ✅ Updated DigitalCard entity complete
- ✅ Phase 1 tests written (failing)
- ✅ Core methods: activate(), revoke() working
- ✅ Tests passing

---

## **EXPECTED OUTCOMES**

### **By End of Phase 1**

✅ **Monetization Ready**
- Feature gating enforced from day one
- Quota limits prevent free tier abuse
- Upgrade path clear to users

✅ **Production Quality**
- 90%+ test coverage
- Clean DDD architecture
- Zero technical debt
- Performance optimized

✅ **Team Ready**
- UI fully functional
- APIs documented
- Handlers demonstrate patterns
- Easy to extend for Phase 2

### **By End of Phase 2+ (Future)**

- Payment processing (Stripe)
- Billing/invoicing
- Usage analytics
- Upgrade/downgrade flows
- Team plans
- Custom pricing

---

## **SUCCESS METRICS**

Track these during Phase 1:

```
✅ Code Quality:
   - Test coverage: 90%+
   - Tests passing: 100%
   - PHPStan clean: 0 errors
   - Code review: 2+ approvals

✅ Performance:
   - Card creation: < 150ms
   - Card activation: < 100ms
   - List cards: < 200ms (1000 cards)
   - Subscription check: < 10ms

✅ User Experience:
   - All CRUD operations working
   - Error messages helpful
   - UI responsive
   - Filters functional
   - Pagination smooth

✅ Architecture:
   - DDD principles followed
   - No framework in Domain
   - Repository pattern used
   - Events published correctly
```

---

## **FILE LOCATIONS**

In `/mnt/user-data/outputs/`:

**Phase 1 Implementation:**
- `PHASE_1_DIGITALCARD_FULL_LIFECYCLE_PROMPT.md` ⭐ (MAIN - 45 KB)

**Phase 0.1 Completion:**
- `20251227_completion_report_phase_0_1.md` (Completion report - uploaded)

**Reference & Architecture:**
- `SUBSCRIPTION_ARCHITECTURE.md` (59 KB)
- `PHASE_0_DIGITALCARD_CONTEXT_PROMPT.md` (Original spec - 40 KB)

---

## **NEXT COMMAND**

When ready to start Phase 1 (Monday morning):

```bash
# Verify Phase 0.1 is still clean
php artisan test tests/Feature/Contexts/Subscription/ --coverage-text

# Create Phase 1 test file
php artisan make:test Feature/Contexts/DigitalCard/ActivateCardTest

# Copy Phase 1 prompt to Claude
# Follow TDD workflow
```

---

## **YOU'RE READY FOR PHASE 1**

✅ Phase 0.1 is complete and working  
✅ Feature gates are in place  
✅ Subscription foundation is solid  
✅ Phase 1 specification is comprehensive  
✅ Architecture is proven  
✅ 8-week plan is clear  

**Start Monday. You've got everything you need.** 🚀

---

**Status:** ✅ **READY FOR PHASE 1 - BEGIN MONDAY**

Your subscription foundation is solid.
Your specification is complete.
Your timeline is clear.
Your integration is minimal (2-3 lines per handler).

**Time to build the full DigitalCard lifecycle with monetization built-in.** 🎯

---

## **Questions?**

- "How do I integrate subscriptions?" → See Integration Pattern (above)
- "What's the Phase 1 timeline?" → See 8-Week Timeline (above)
- "How much work is Phase 1?" → 8 weeks, 4-5 developers
- "How do quotas work?" → FeatureGateService.isQuotaExceeded()
- "What if I need help?" → Copy Phase 1 prompt to Claude, it'll guide you

**Good luck with Phase 1! You're going to crush it.** 💪

