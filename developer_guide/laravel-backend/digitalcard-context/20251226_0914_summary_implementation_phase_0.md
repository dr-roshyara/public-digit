# **Phase 1: DigitalCard Context - Core Lifecycle MLP**
**Session Preparation Prompt for Next Development Session**

---

## **BACKGROUND CONTEXT FOR NEXT SESSION**

### **Current Status: Phase 0 COMPLETE ✅**
**Walking Skeleton is walking!** All 5 tests passing:

1. `it_creates_digital_card_record_via_desktop_api` ✓
2. `it_prevents_cross_tenant_card_access` ✓  
3. `it_rejects_invalid_expiry_date` ✓
4. `it_requires_member_id` ✓
5. `it_rejects_invalid_member_id_format` ✓

**Architecture Validated:**
- ✅ DDD layers (Domain/Application/Infrastructure)
- ✅ Multi-tenancy with physical database isolation
- ✅ Case 4 routing (`/{tenant}/api/v1/cards`)
- ✅ Domain events (CardIssued)
- ✅ TDD workflow established

---

## **PHASE 1 GOAL: Core Lifecycle MLP**
**Desktop Admin functionality for card management**

### **Business Requirements to Implement:**

#### **1. Card Lifecycle Operations:**
```
Status Transitions:
issued → active → (revoked|expired)

Operations:
- Issue Card (Phase 0 ✓)
- Activate Card (issued → active)
- Revoke Card (issued|active → revoked) with reason
- View Card Details
- List Cards with filtering
```

#### **2. Business Rules to Enforce:**
- **One active card per member** (unique constraint in DB)
- **Expiry date**: 1-2 years in future
- **Authorization**: Only Committee Admin or Platform Admin can manage cards
- **Status validation**: Only valid transitions allowed

#### **3. Vue.js Admin Interface:**
- Card listing with search/filter
- Issue new card modal
- Activate/Revoke actions
- QR code display
- Status badges

---

## **PHASE 1 TECHNICAL SPECIFICATION**

### **Domain Layer Additions:**
```php
// New Domain Events:
CardActivated::class
CardRevoked::class

// Domain Services:
CardIssuancePolicy.php (business rules)
CardStatusTransitionValidator.php

// Domain Exceptions:
CardAlreadyActiveException::class
InvalidTransitionException::class
```

### **Application Layer Additions:**
```php
// Commands:
ActivateCardCommand.php
RevokeCardCommand.php
GetCardQuery.php
ListCardsQuery.php

// Handlers:  
ActivateCardHandler.php
RevokeCardHandler.php
GetCardHandler.php
ListCardsHandler.php

// DTOs:
CardListItemDTO.php (for listing)
CardDetailsDTO.php (extended details)
```

### **Infrastructure Layer Additions:**
```php
// Controller Methods:
PUT /api/v1/cards/{id}/activate
PUT /api/v1/cards/{id}/revoke
GET /api/v1/cards (list with filters)
GET /api/v1/cards/{id} (details)

// Form Requests:
ActivateCardRequest.php
RevokeCardRequest.php
ListCardsRequest.php

// Vue Components:
DigitalCards/Index.vue (listing)
DigitalCards/Show.vue (details)
DigitalCards/IssueModal.vue
DigitalCards/ActivateModal.vue
DigitalCards/RevokeModal.vue
DigitalCards/CardDataTable.vue
DigitalCards/QRCodeDisplay.vue

// Authorization:
DigitalCardPolicy.php (Laravel Policy)
Gates: can:manage-digital-cards
```

### **Database Schema Updates (Phase 1):**
```sql
-- Add Phase 1 columns:
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

-- Add partial unique index for "one active per member":
CREATE UNIQUE INDEX idx_one_active_card_per_member 
ON digital_cards (member_id) 
WHERE status = 'active' AND deleted_at IS NULL;
```

---

## **TDD APPROACH FOR PHASE 1**

### **Test Files to Create:**
```
tests/Feature/Contexts/DigitalCard/
├── ActivateCardTest.php
├── RevokeCardTest.php  
├── ListCardsTest.php
├── GetCardTest.php
└── DigitalCardAuthorizationTest.php
```

### **Test Scenarios:**

**ActivateCardTest:**
```php
it('activates issued card')
it('fails to activate already active card')
it('fails to activate revoked card')
it('requires admin authorization')
it('records activated_at timestamp')
it('publishes CardActivated domain event')
```

**RevokeCardTest:**
```php
it('revokes active card with reason')
it('revokes issued card with reason')
it('fails to revoke already revoked card')
it('requires revocation reason')
it('requires admin authorization')
it('publishes CardRevoked domain event')
```

**Authorization Tests:**
```php
it('admin can manage cards')
it('member cannot manage cards')
it('cross-tenant admin gets 404')
it('enforces one active card per member rule')
```

---

## **STARTING POINT FOR NEXT SESSION**

### **Immediate Next Tasks:**

1. **Create failing test for card activation:**
   ```bash
   php artisan make:test Feature/Contexts/DigitalCard/ActivateCardTest
   ```

2. **Implement ActivateCardCommand/Handler:**
   ```php
   // Follow same pattern as IssueCardHandler
   // Use DigitalCard->activate() domain method
   // Add authorization check
   ```

3. **Add controller endpoint:**
   ```php
   Route::put('/cards/{id}/activate', [DigitalCardController::class, 'activate']);
   ```

4. **Update DigitalCard aggregate:**
   ```php
   public function activate(DateTimeImmutable $activatedAt): void
   {
       // Business rule: only issued cards can be activated
       // Set status = ACTIVE
       // Record activated_at
       // Publish CardActivated event
   }
   ```

### **Quick Start Command:**
```bash
# Start Phase 1 TDD
cd packages/laravel-backend
php artisan make:test Feature/Contexts/DigitalCard/ActivateCardTest
```

---

## **ARCHITECTURAL CONSTRAINTS TO MAINTAIN:**

### **Non-Negotiable (Phase 0 Achievements):**
1. **Domain Layer Purity**: Zero Laravel/framework dependencies
2. **Tenant Isolation**: All operations tenant-scoped
3. **DDD Layers**: Strict separation maintained
4. **Case 4 Routing**: `/api/v1/*` for desktop admin
5. **TDD Workflow**: Tests first, implementation second

### **Phase 1 Additions:**
1. **Authorization**: Laravel Gates/Policies at Infrastructure layer only
2. **Vue Components**: Inertia.js responses, not JSON APIs
3. **Business Rules**: Enforced in Domain layer, tested in isolation

---

## **SUCCESS METRICS FOR PHASE 1:**

- [ ] All card lifecycle operations functional
- [ ] Vue admin interface complete
- [ ] Authorization enforced on all endpoints
- [ ] Business rules tested (100% coverage)
- [ ] Performance: < 200ms P95 for list endpoint
- [ ] 90%+ test coverage maintained
- [ ] PHPStan Level 8 clean

---

## **READY TO START PHASE 1**

**Current codebase state:** Phase 0 foundation solid. All tests passing. Architecture validated.

**Next session:** Begin with `ActivateCardTest` following TDD RED → GREEN → REFACTOR workflow.

**Key files reference:**
- `DigitalCard` aggregate: `app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php`
- `IssueCardHandler` pattern: `app/Contexts/DigitalCard/Application/Handlers/IssueCardHandler.php`
- Test pattern: `tests/Feature/Contexts/DigitalCard/DigitalCardWalkingSkeletonTest.php`

---

**Copy this prompt to start your next session. The DigitalCard Context foundation is production-ready. Phase 1 begins now!** 🚀