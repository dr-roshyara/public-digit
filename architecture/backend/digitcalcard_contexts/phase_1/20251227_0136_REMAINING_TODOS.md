# DIGITALCARD CONTEXT - REMAINING TODOS
**Generated:** 2025-12-27
**Status:** Phase 1.1 ✅ COMPLETE | Phase 1.2 🚀 READY TO START

---

## 📊 COMPLETION STATUS

### ✅ COMPLETED (DO NOT REDO)

**Phase 0: Walking Skeleton**
- ✅ DigitalCard aggregate entity with issue() method
- ✅ CardId, MemberId, QRCode Value Objects
- ✅ CardStatus enum (issued, active, revoked, expired)
- ✅ CardIssued domain event
- ✅ IssueCardHandler with TDD tests (5 passing)
- ✅ Database migration (digital_cards table)
- ✅ Multi-tenant routing: /{tenant}/api/v1/cards

**Phase 0.1: Subscription Foundation**
- ✅ FeatureGateService - Check subscription access & quotas
- ✅ SubscriptionService - Manage tenant subscriptions
- ✅ Database: 3 tables (plans, plan_features, subscriptions)
- ✅ Clean DDD architecture (15 passing tests, 22 assertions)
- ✅ Cost savings: $18,400 + 5 weeks development time

**Phase 1.1: DigitalCard Core Lifecycle**
- ✅ Domain entity enhanced:
  - tenantId property added
  - activate(DateTimeImmutable $activatedAt) method
  - revoke(string $reason, DateTimeImmutable $revokedAt) method
  - Business rules: only issued → active, one active per member per tenant
- ✅ Domain Events: CardActivated, CardRevoked
- ✅ Commands: ActivateCardCommand, RevokeCardCommand
- ✅ Handlers with FeatureGateService integration:
  - ActivateCardHandler - subscription check FIRST, uses findForTenant()
  - RevokeCardHandler - subscription check FIRST, uses findForTenant()
- ✅ Database Migration: Added columns
  - tenant_id (required, not null)
  - activated_at, revoked_at (timestamps)
  - revocation_reason (text, audit trail)
  - Partial unique index: One active card per member per tenant
- ✅ Repository Updates:
  - findForTenant(CardId $cardId, string $tenantId): DigitalCard
  - Updated persistence for Phase 1 fields
- ✅ Comprehensive Test Suite:
  - 22 passing tests (61 assertions) - 100% pass rate
  - Domain tests, Handler tests, Command tests
- ✅ Complete Documentation:
  - 67-page Developer Guide
  - 5-page Quick Reference
  - 8-page Phase 1 Summary
  - 4-page Navigation README

---

## 🎯 PHASE 1.2 - IMMEDIATE PRIORITIES (NEXT 4 WEEKS)

### Priority 1: API Endpoints (Week 1-2)

**Status:** 🔴 NOT STARTED

**What to Build:**
- [ ] HTTP Controllers with all Phase 1 endpoints
  - [ ] PUT /{tenant}/api/v1/cards/{cardId}/activate
  - [ ] PUT /{tenant}/api/v1/cards/{cardId}/revoke
  - [ ] GET /{tenant}/api/v1/cards (list with filters)
  - [ ] GET /{tenant}/api/v1/cards/{cardId} (single card details)

**Implementation Details:**
```php
// In DigitalCardController:
public function activate(Request $request, string $cardId): JsonResponse
{
    $this->authorize('activate', 'digital-card');

    $command = new ActivateCardCommand(
        tenantId: $request->tenant()->id,
        cardId: $cardId,
    );

    $card = $this->dispatch($command);

    return response()->json([
        'data' => $card,
        'message' => 'Card activated successfully',
    ]);
}
```

**Technical Requirements:**
- Must use handlers (not business logic in controller)
- Must include authorization checks
- Must return consistent API responses
- Must validate request inputs

**Testing:**
- [ ] Create ActivateCardHttpTest (controller level)
- [ ] Create RevokeCardHttpTest
- [ ] Create ListCardsHttpTest
- [ ] Create GetCardHttpTest
- [ ] Verify 401/403 responses for unauthorized access
- [ ] Verify 422 responses for validation errors

**Files to Create/Modify:**
- app/Contexts/DigitalCard/Infrastructure/Http/Controllers/DigitalCardController.php
- routes/api.php (add new routes)
- tests/Feature/Contexts/DigitalCard/Http/ActivateCardHttpTest.php
- tests/Feature/Contexts/DigitalCard/Http/RevokeCardHttpTest.php

**Dependencies:**
- None (handlers already complete)

**Acceptance Criteria:**
- ✅ All 4 endpoints return 200 on success
- ✅ Authorization middleware working
- ✅ Validation errors return 422 with clear messages
- ✅ Tenant isolation enforced (can't access other tenant's cards)

---

### Priority 2: Vue.js Admin UI (Week 2-3)

**Status:** 🔴 NOT STARTED

**What to Build:**

**2.1 Cards Index Component**
- [ ] Create main listing page with filters
  - [ ] Status filter (issued, active, revoked, expired)
  - [ ] Member ID search
  - [ ] Date range filter (issued_at, expires_at)
  - [ ] Pagination (15 per page)
- [ ] Data table with columns:
  - [ ] Card ID (truncated, copyable)
  - [ ] Member ID
  - [ ] Status badge (color-coded)
  - [ ] Issued date
  - [ ] Activated date
  - [ ] Actions (View, Activate, Revoke)
- [ ] Statistics cards at top:
  - [ ] Total cards
  - [ ] Active cards
  - [ ] Revoked cards
  - [ ] Expiring soon

**2.2 Supporting Components**
- [ ] IssueCardModal.vue
  - [ ] Member selection dropdown
  - [ ] Expiry date picker (must be future)
  - [ ] Form validation
  - [ ] Success/error toast notifications
- [ ] CardDetailsModal.vue
  - [ ] Full card information display
  - [ ] QR code preview
  - [ ] Audit trail (issued, activated, revoked events)
  - [ ] Download QR code button
- [ ] RevokeCardModal.vue
  - [ ] Reason textarea (required, min 10 chars)
  - [ ] Character counter (500 max)
  - [ ] Confirmation warning
- [ ] StatusBadge.vue
  - [ ] Color-coded badges (yellow=issued, green=active, red=revoked, gray=expired)

**Implementation Reference:**
```vue
<!-- resources/js/Pages/DigitalCards/Index.vue -->
<template>
  <layout>
    <div class="container mx-auto py-6">
      <!-- Header with Issue Button -->
      <div class="flex justify-between mb-6">
        <h1 class="text-3xl font-bold">Digital Cards</h1>
        <button @click="showIssueModal = true">Issue New Card</button>
      </div>

      <!-- Filters -->
      <div class="bg-white p-4 rounded shadow mb-6">
        <select v-model="filters.status" @change="fetchCards">
          <option value="">All Status</option>
          <option value="issued">Issued</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <!-- Cards Table -->
      <card-data-table :cards="cards.data" @activate="activateCard" @revoke="openRevokeModal" />

      <!-- Pagination -->
      <pagination :data="cards.pagination" @page-change="fetchCards" />
    </div>
  </layout>
</template>
```

**Technical Requirements:**
- Must use Inertia.js for server-side rendering
- Must debounce search inputs (300ms)
- Must handle loading states
- Must show error messages for failed operations
- Must refresh data after CRUD operations

**Testing:**
- [ ] Create Cypress/Dusk tests for card listing
- [ ] Test filtering by status
- [ ] Test pagination
- [ ] Test activate card flow
- [ ] Test revoke card flow with reason validation
- [ ] Test responsive design (mobile, tablet, desktop)

**Files to Create:**
- resources/js/Pages/DigitalCards/Index.vue
- resources/js/Components/DigitalCards/IssueCardModal.vue
- resources/js/Components/DigitalCards/CardDetailsModal.vue
- resources/js/Components/DigitalCards/RevokeCardModal.vue
- resources/js/Components/DigitalCards/StatusBadge.vue
- resources/js/Components/DigitalCards/CardDataTable.vue

**Dependencies:**
- Priority 1 (API endpoints) must be complete

**Acceptance Criteria:**
- ✅ Admin can see paginated list of cards
- ✅ Admin can filter by status and search by member ID
- ✅ Admin can activate issued cards
- ✅ Admin can revoke active/issued cards with reason
- ✅ Admin can view full card details including QR code
- ✅ UI is responsive and works on mobile devices

---

### Priority 3: Laravel Policies (Week 3)

**Status:** 🔴 NOT STARTED

**What to Build:**

**3.1 DigitalCardPolicy**
```php
<?php
// app/Policies/DigitalCardPolicy.php

namespace App\Policies;

use App\Models\User;

class DigitalCardPolicy
{
    /**
     * Global authorization for platform admins
     */
    public function before(User $user): ?bool
    {
        if ($user->isPlatformAdmin()) {
            return true; // Platform admins can do everything
        }
        return null; // Continue to individual checks
    }

    /**
     * Issue new cards
     */
    public function create(User $user): bool
    {
        return $user->hasRole(['admin', 'committee_admin']);
    }

    /**
     * View cards list
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRole(['admin', 'committee_admin', 'member']);
    }

    /**
     * View single card
     */
    public function view(User $user): bool
    {
        return $user->hasRole(['admin', 'committee_admin', 'member']);
    }

    /**
     * Activate cards
     */
    public function activate(User $user): bool
    {
        return $user->hasRole(['admin', 'committee_admin']);
    }

    /**
     * Revoke cards
     */
    public function revoke(User $user): bool
    {
        return $user->hasRole(['admin', 'committee_admin']);
    }
}
```

**Implementation Tasks:**
- [ ] Create DigitalCardPolicy class
- [ ] Register policy in AuthServiceProvider
- [ ] Add authorization checks to controller methods
- [ ] Create role-based test scenarios
- [ ] Document permission matrix

**Testing:**
- [ ] Test platform admin has full access
- [ ] Test committee admin can create/activate/revoke
- [ ] Test member can only view
- [ ] Test guest gets 401
- [ ] Test cross-tenant access prevention (403)

**Files to Create/Modify:**
- app/Policies/DigitalCardPolicy.php
- app/Providers/AuthServiceProvider.php
- tests/Feature/Contexts/DigitalCard/Policies/DigitalCardPolicyTest.php

**Dependencies:**
- Priority 1 (API endpoints) must be complete

**Acceptance Criteria:**
- ✅ All endpoints have proper authorization checks
- ✅ Users with wrong roles get 403 Forbidden
- ✅ Cross-tenant access blocked (tenant A can't access tenant B's cards)
- ✅ Platform admins can access all tenants

---

### Priority 4: Real-time Updates with WebSockets (Week 4)

**Status:** 🔴 NOT STARTED

**What to Build:**

**4.1 Laravel Broadcasting Setup**
- [ ] Configure Laravel Echo Server or Pusher
- [ ] Create private channel for tenant cards
- [ ] Broadcast events on card state changes

**4.2 Domain Event Broadcasting**
```php
<?php
// app/Listeners/DigitalCard/OnCardActivated.php

namespace App\Listeners\DigitalCard;

use App\Contexts\DigitalCard\Domain\Events\CardActivated;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

final class BroadcastCardActivated implements ShouldBroadcast
{
    public function __construct(public CardActivated $event) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->event->tenantId}.cards")
        ];
    }

    public function broadcastAs(): string
    {
        return 'card.activated';
    }

    public function broadcastWith(): array
    {
        return [
            'card_id' => $this->event->cardId,
            'activated_at' => $this->event->activatedAt->toIso8601String(),
        ];
    }
}
```

**4.3 Vue.js Integration**
```vue
<script setup>
import { onMounted } from 'vue'
import Echo from 'laravel-echo'

const props = defineProps({ tenant: Object })

onMounted(() => {
  Echo.private(`tenant.${props.tenant.id}.cards`)
    .listen('.card.activated', (e) => {
      // Update UI - refresh specific card or show toast
      console.log(`Card ${e.card_id} activated at ${e.activated_at}`)
      fetchCards() // Refresh list
    })
    .listen('.card.revoked', (e) => {
      console.log(`Card ${e.card_id} revoked: ${e.reason}`)
      fetchCards()
    })
})
</script>
```

**Implementation Tasks:**
- [ ] Configure broadcasting driver (Redis/Pusher)
- [ ] Create broadcast listeners for CardActivated, CardRevoked
- [ ] Implement channel authorization in channels.php
- [ ] Add Laravel Echo to Vue frontend
- [ ] Test real-time updates across multiple browser tabs

**Technical Requirements:**
- Channel must be scoped by tenant_id (prevent cross-tenant listening)
- Must verify user belongs to tenant before joining channel
- Must handle reconnection if WebSocket drops
- Must show visual indicator when real-time updates active

**Testing:**
- [ ] Test card activation broadcasts to all connected admins
- [ ] Test revocation broadcasts with reason
- [ ] Test cross-tenant isolation (tenant A can't listen to tenant B)
- [ ] Test reconnection after network interruption
- [ ] Load test with 10+ concurrent users

**Files to Create/Modify:**
- app/Listeners/DigitalCard/BroadcastCardActivated.php
- app/Listeners/DigitalCard/BroadcastCardRevoked.php
- routes/channels.php
- resources/js/Composables/useCardBroadcasting.js
- config/broadcasting.php

**Dependencies:**
- Priority 1 (API endpoints) must be complete
- Priority 2 (Vue UI) must be complete

**Acceptance Criteria:**
- ✅ Card activation updates UI in real-time for all connected admins
- ✅ Card revocation shows toast notification with reason
- ✅ No performance degradation with 100+ cards
- ✅ Tenant isolation enforced (can't listen to other tenants)

---

### Priority 5: List Cards with Advanced Filtering (Week 4)

**Status:** 🔴 NOT STARTED

**What to Build:**

**5.1 Enhanced Repository Methods**
```php
// In EloquentDigitalCardRepository:

public function listForTenant(
    string $tenantId,
    ?string $status = null,
    ?string $memberId = null,
    ?\DateTimeImmutable $issuedFrom = null,
    ?\DateTimeImmutable $issuedTo = null,
    ?\DateTimeImmutable $expiringBefore = null,
    int $page = 1,
    int $perPage = 15,
): array {
    $query = DigitalCardModel::where('tenant_id', $tenantId);

    if ($status) {
        $query->where('status', $status);
    }

    if ($memberId) {
        $query->where('member_id', 'LIKE', "%{$memberId}%");
    }

    if ($issuedFrom && $issuedTo) {
        $query->whereBetween('issued_at', [$issuedFrom, $issuedTo]);
    }

    if ($expiringBefore) {
        $query->where('expires_at', '<=', $expiringBefore)
              ->where('status', '!=', 'expired');
    }

    $cards = $query->orderBy('created_at', 'desc')
                   ->paginate($perPage, ['*'], 'page', $page);

    return [
        'data' => $cards->map(fn($model) => $this->toDomainEntity($model))->toArray(),
        'pagination' => [
            'current_page' => $cards->currentPage(),
            'per_page' => $cards->perPage(),
            'total' => $cards->total(),
            'last_page' => $cards->lastPage(),
        ],
    ];
}
```

**5.2 Query Handler Enhancement**
- [ ] Update ListCardsQuery to include new filter parameters
- [ ] Update ListCardsHandler to pass filters to repository
- [ ] Add validation for date ranges
- [ ] Add default sorting (created_at DESC)

**5.3 UI Filter Enhancements**
- [ ] Add date range pickers for issued_at
- [ ] Add "Expiring Soon" quick filter (next 30 days)
- [ ] Add "Search by Member Name" (requires join with members table)
- [ ] Add column sorting (click header to sort)
- [ ] Add "Clear Filters" button

**Implementation Tasks:**
- [ ] Extend repository interface with new filter parameters
- [ ] Implement filtering logic in EloquentDigitalCardRepository
- [ ] Add database indexes for filtered columns
- [ ] Update Vue UI with new filter controls
- [ ] Add query caching for common filter combinations

**Testing:**
- [ ] Test filtering by date range
- [ ] Test "Expiring Soon" filter accuracy
- [ ] Test combining multiple filters
- [ ] Test pagination with filters applied
- [ ] Test performance with 10,000+ cards

**Files to Create/Modify:**
- app/Contexts/DigitalCard/Domain/Repositories/DigitalCardRepositoryInterface.php
- app/Contexts/DigitalCard/Infrastructure/Repositories/EloquentDigitalCardRepository.php
- app/Contexts/DigitalCard/Application/Queries/ListCardsQuery.php
- app/Contexts/DigitalCard/Application/Handlers/ListCardsHandler.php
- resources/js/Components/DigitalCards/AdvancedFilters.vue

**Dependencies:**
- Priority 2 (Vue UI) must be complete

**Acceptance Criteria:**
- ✅ Admin can filter by date range (issued_at)
- ✅ Admin can see cards expiring in next 30 days
- ✅ Admin can combine multiple filters
- ✅ Pagination works correctly with filters
- ✅ Performance < 200ms for 10,000 cards

---

### Priority 6: Get Card Details Extended View (Week 4)

**Status:** 🔴 NOT STARTED

**What to Build:**

**6.1 Enhanced Card DTO**
```php
<?php
// app/Contexts/DigitalCard/Application/DTOs/CardDetailDTO.php

final class CardDetailDTO
{
    public function __construct(
        public readonly string $id,
        public readonly string $tenantId,
        public readonly string $memberId,
        public readonly string $memberName,      // NEW: from members table
        public readonly string $qrCode,
        public readonly string $status,
        public readonly string $issuedAt,
        public readonly ?string $activatedAt,
        public readonly ?string $revokedAt,
        public readonly ?string $revocationReason,
        public readonly ?string $expiresAt,
        public readonly array $auditTrail,      // NEW: timeline of events
        public readonly bool $isExpiringSoon,   // NEW: within 30 days
        public readonly ?string $qrCodeImageUrl, // NEW: rendered QR image
    ) {}

    public static function fromEntity(DigitalCard $card, array $memberInfo = []): self
    {
        return new self(
            id: $card->id()->value(),
            tenantId: $card->tenantId(),
            memberId: $card->memberId()->value(),
            memberName: $memberInfo['name'] ?? 'Unknown',
            qrCode: $card->qrCode()->value(),
            status: $card->status()->value,
            issuedAt: $card->issuedAt()->toIso8601String(),
            activatedAt: $card->activatedAt()?->toIso8601String(),
            revokedAt: $card->revokedAt()?->toIso8601String(),
            revocationReason: $card->revocationReason(),
            expiresAt: $card->expiresAt()?->toIso8601String(),
            auditTrail: self::buildAuditTrail($card),
            isExpiringSoon: self::isExpiringSoon($card),
            qrCodeImageUrl: self::generateQRCodeImage($card->qrCode()),
        );
    }
}
```

**6.2 Audit Trail Construction**
- [ ] Create timeline of all card events
  - [ ] Issued: timestamp, by whom
  - [ ] Activated: timestamp, by whom
  - [ ] Revoked: timestamp, by whom, reason
- [ ] Add `issued_by_id`, `activated_by_id`, `revoked_by_id` to database
- [ ] Track admin who performed each action

**6.3 QR Code Image Generation**
- [ ] Install QR code library (endroid/qr-code)
- [ ] Generate PNG/SVG from QR code string
- [ ] Cache generated images
- [ ] Provide download endpoint

**6.4 Enhanced Details Modal**
- [ ] Show full member information (name, email, membership ID)
- [ ] Display large QR code with download button
- [ ] Show complete audit trail as timeline
- [ ] Show "Expiring Soon" warning if within 30 days
- [ ] Add "Regenerate QR Code" button (admin only)

**Implementation Tasks:**
- [ ] Add audit columns to database migration
- [ ] Update handlers to track `performed_by_id`
- [ ] Create CardDetailDTO with extended information
- [ ] Implement QR code image generation service
- [ ] Create enhanced details modal in Vue
- [ ] Add QR code download endpoint

**Testing:**
- [ ] Test audit trail accuracy
- [ ] Test QR code generation and download
- [ ] Test expiry warning displays correctly
- [ ] Test member information loads correctly
- [ ] Test admin tracking (who activated/revoked)

**Files to Create/Modify:**
- app/Contexts/DigitalCard/Application/DTOs/CardDetailDTO.php
- app/Contexts/DigitalCard/Application/Services/QRCodeImageGenerator.php
- app/Contexts/DigitalCard/Infrastructure/Database/Migrations/add_audit_columns.php
- app/Contexts/DigitalCard/Infrastructure/Http/Controllers/DownloadQRCodeController.php
- resources/js/Components/DigitalCards/CardDetailsModal.vue (enhanced version)

**Dependencies:**
- Priority 2 (Vue UI) must be complete

**Acceptance Criteria:**
- ✅ Card details show complete audit trail
- ✅ QR code displayed as image and downloadable
- ✅ Admin who performed each action is tracked
- ✅ "Expiring Soon" warning accurate
- ✅ Member information displayed correctly

---

## 🔧 CRITICAL FIXES (FROM ARCHITECT REVIEW)

**Source:** `20251227_phase1_review.md` - Senior Architect Corrections

### Fix 1: Tenancy API Consistency

**Status:** 🔴 CRITICAL

**Problem:**
```php
// WRONG: Using Stancl API (from Phase 1 review)
tenancy()->getCurrentTenant()

// CORRECT: Should use Spatie API (project standard)
app(TenantContextInterface::class)->getTenant()
```

**What to Fix:**
- [ ] Search codebase for `tenancy()->getCurrentTenant()`
- [ ] Replace with `app(TenantContextInterface::class)->getTenant()`
- [ ] Verify no Stancl\Tenancy imports exist in DigitalCard context
- [ ] Update all handlers to use correct tenant resolution

**Files to Review:**
- app/Contexts/DigitalCard/Application/Handlers/*.php
- tests/Feature/Contexts/DigitalCard/*.php

**Acceptance Criteria:**
- ✅ Zero references to Stancl tenancy API
- ✅ All tenant resolution uses TenantContextInterface
- ✅ Tests still pass with correct API

---

### Fix 2: API Contract Stability

**Status:** 🔴 CRITICAL

**Problem:**
Field name drift between planning docs:
- Some docs: `member_id`
- Others: `memberId`
- Database: `member_id`
- DTOs: `memberId`

**What to Fix:**
- [ ] Standardize on snake_case for database columns
- [ ] Standardize on camelCase for DTOs and API responses
- [ ] Document API contract in OpenAPI/Swagger
- [ ] Add API versioning (v1) to prevent future breaking changes
- [ ] Create API contract tests

**Implementation:**
```php
// Database (snake_case):
Schema::create('digital_cards', function (Blueprint $table) {
    $table->uuid('member_id'); // ✅ CORRECT
});

// DTO (camelCase):
public function toArray(): array
{
    return [
        'memberId' => $this->memberId,  // ✅ CORRECT
        'issuedAt' => $this->issuedAt,  // ✅ CORRECT
    ];
}
```

**Files to Review:**
- All DTOs in app/Contexts/DigitalCard/Application/DTOs/
- API responses in controllers
- Frontend API calls in Vue components

**Acceptance Criteria:**
- ✅ Database uses snake_case consistently
- ✅ API responses use camelCase consistently
- ✅ No mixed naming conventions
- ✅ API contract documented

---

### Fix 3: Domain Purity Violation

**Status:** 🔴 CRITICAL

**Problem:**
From architect review: Repository interface referenced inside DigitalCard aggregate

**What to Fix:**
- [ ] Review DigitalCard entity for any infrastructure imports
- [ ] Remove any repository references from domain layer
- [ ] Ensure aggregate only uses other domain objects
- [ ] Run `grep -r "Illuminate\|Laravel" app/Contexts/DigitalCard/Domain/`
- [ ] Verify zero framework dependencies in Domain layer

**Verification Script:**
```bash
# Should return ZERO results:
grep -r "use Illuminate" app/Contexts/DigitalCard/Domain/
grep -r "use App\Contexts\DigitalCard\Infrastructure" app/Contexts/DigitalCard/Domain/
```

**Files to Review:**
- app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php
- app/Contexts/DigitalCard/Domain/ValueObjects/*.php

**Acceptance Criteria:**
- ✅ Zero Illuminate\* imports in Domain layer
- ✅ Zero Infrastructure imports in Domain layer
- ✅ All domain tests still pass
- ✅ DDD layer separation verified

---

### Fix 4: Typed Exceptions (Not String Matching)

**Status:** 🟡 MEDIUM

**Problem:**
From architect review: Exception handling via string matching is fragile

**Current Anti-Pattern:**
```php
// ❌ BAD: String matching
catch (\Exception $e) {
    if (str_contains($e->getMessage(), 'not found')) {
        return 404;
    }
}
```

**Correct Pattern:**
```php
// ✅ GOOD: Typed exceptions
catch (CardNotFoundException $e) {
    return response()->json(['error' => $e->getMessage()], 404);
}
catch (TenantNotSubscribedException $e) {
    return response()->json(['error' => $e->getMessage()], 403);
}
```

**What to Fix:**
- [ ] Create typed exceptions for all domain errors:
  - [ ] CardNotFoundException
  - [ ] CardAlreadyActivatedException
  - [ ] CardCannotBeRevokedException
  - [ ] TenantNotSubscribedException
  - [ ] QuotaExceededException
- [ ] Replace all generic DomainException throws with typed exceptions
- [ ] Update exception handling in controllers
- [ ] Document exception hierarchy

**Files to Create:**
- app/Contexts/DigitalCard/Domain/Exceptions/CardNotFoundException.php
- app/Contexts/DigitalCard/Domain/Exceptions/CardAlreadyActivatedException.php
- app/Contexts/DigitalCard/Domain/Exceptions/CardCannotBeRevokedException.php
- app/Contexts/Subscription/Domain/Exceptions/TenantNotSubscribedException.php
- app/Contexts/Subscription/Domain/Exceptions/QuotaExceededException.php

**Acceptance Criteria:**
- ✅ All domain exceptions are typed classes
- ✅ No string matching in exception handling
- ✅ Clear exception hierarchy documented
- ✅ All tests use typed exception assertions

---

### Fix 5: Partial Unique Index Portability

**Status:** 🟡 MEDIUM

**Problem:**
PostgreSQL partial unique index may not work in MySQL/SQLite tests

**Current:**
```sql
CREATE UNIQUE INDEX idx_digital_cards_one_active_per_member_tenant
ON digital_cards (member_id, tenant_id)
WHERE status = 'active';  -- PostgreSQL specific
```

**What to Fix:**
- [ ] Add database type detection in migration
- [ ] Use raw SQL for PostgreSQL
- [ ] Use application-level check for MySQL/SQLite
- [ ] Document database requirements (PostgreSQL recommended)
- [ ] Add test for unique constraint enforcement

**Implementation:**
```php
public function up(): void
{
    Schema::table('digital_cards', function (Blueprint $table) {
        // Standard index for all DBs
        $table->index(['member_id', 'tenant_id', 'status']);
    });

    // PostgreSQL partial unique index
    if (DB::getDriverName() === 'pgsql') {
        DB::statement('
            CREATE UNIQUE INDEX idx_one_active_card_per_member
            ON digital_cards (member_id, tenant_id)
            WHERE status = \'active\'
        ');
    }
}
```

**Files to Modify:**
- app/Contexts/DigitalCard/Infrastructure/Database/Migrations/add_phase1_columns.php

**Acceptance Criteria:**
- ✅ Migration works on PostgreSQL, MySQL, SQLite
- ✅ Unique constraint enforced on PostgreSQL
- ✅ Application-level check works on other DBs
- ✅ Tests pass on all database types

---

### Fix 6: Application Layer Business Rule Enforcement

**Status:** 🟡 MEDIUM

**Problem:**
Some business rules only enforced in domain, should also validate in handler

**What to Fix:**
- [ ] Add pre-flight checks in handlers before calling aggregate methods
- [ ] Verify card exists before trying to activate
- [ ] Check subscription quota before issuing
- [ ] Validate tenant ownership before operations
- [ ] Return clear error messages

**Example:**
```php
// In ActivateCardHandler:
public function handle(ActivateCardCommand $command): CardDTO
{
    // 1. Check subscription (application layer)
    if (!$this->featureGate->can(...)) {
        throw TenantNotSubscribedException::forModule('digital_card');
    }

    // 2. Get card with tenant check (application layer)
    $card = $this->repository->findForTenant($command->cardId, $command->tenantId);
    if (!$card) {
        throw CardNotFoundException::withId($command->cardId);
    }

    // 3. Pre-flight business rule check (application layer)
    if (!$card->canActivate()) {
        throw CardCannotBeActivatedException::invalidStatus($card->status());
    }

    // 4. Execute domain logic (domain layer)
    $card->activate(new \DateTimeImmutable());

    // 5. Persist and return
    $this->repository->save($card);
    return CardDTO::fromEntity($card);
}
```

**Files to Review:**
- All handlers in app/Contexts/DigitalCard/Application/Handlers/

**Acceptance Criteria:**
- ✅ All handlers have pre-flight validation
- ✅ Clear error messages for each failure case
- ✅ Tests verify both application and domain validation
- ✅ No cryptic domain exceptions reach users

---

## 🚀 PHASE 2 - FUTURE ENHANCEMENTS (NOT URGENT)

**Source:** Business module documents

### Enhancement 1: Quota Enforcement System

**Status:** 🔵 PLANNED (Phase 2)

**What to Build:**
- [ ] Real-time quota tracking in FeatureGateService
- [ ] "Soft limit" warnings (at 80% of quota)
- [ ] "Hard limit" enforcement (reject at 100%)
- [ ] Quota reset jobs (monthly/annual)
- [ ] Usage dashboard for tenants

**Business Case:**
- Free tier: 500 cards/month
- Pro tier: 5,000 cards/month
- Enterprise tier: Unlimited

**Implementation Priority:** After Phase 1.2 complete

---

### Enhancement 2: Bulk Operations (Level 2 Feature)

**Status:** 🔵 PLANNED (Phase 2)

**What to Build:**
- [ ] Bulk card issuance (CSV upload)
- [ ] Bulk activation
- [ ] Bulk revocation
- [ ] Background job processing with progress tracking
- [ ] Bulk operation history table

**Technical Requirements:**
- Process 1,000+ cards without timeout
- Queue-based with status tracking
- Downloadable results report
- Error handling for partial failures

**Implementation Priority:** After quota enforcement

---

### Enhancement 3: Advanced Exports (Level 2 Feature)

**Status:** 🔵 PLANNED (Phase 2)

**What to Build:**
- [ ] CSV export with custom columns
- [ ] Excel export with formatting
- [ ] PDF export with card designs
- [ ] Scheduled exports (daily/weekly)
- [ ] Export templates

**Technical Requirements:**
- Memory-efficient streaming for large datasets
- Temporary signed URLs for downloads
- Auto-cleanup of export files after 24 hours

**Implementation Priority:** After bulk operations

---

### Enhancement 4: Card Templates & Customization

**Status:** 🔵 PLANNED (Phase 2+)

**What to Build:**
- [ ] Custom card designs per tenant
- [ ] Template library
- [ ] Logo/branding upload
- [ ] QR code positioning options
- [ ] Print-ready PDF generation

**Business Case:**
- Free tier: Default template only
- Pro tier: 3 custom templates
- Enterprise tier: Unlimited templates + custom branding

**Implementation Priority:** Phase 2 or later

---

### Enhancement 5: Card Expiry Processing

**Status:** 🔵 PLANNED (Phase 2+)

**What to Build:**
- [ ] Daily job to mark expired cards
- [ ] Email notifications 30/15/7 days before expiry
- [ ] Auto-renewal for certain card types
- [ ] Grace period for expired cards

**Technical Requirements:**
- Efficient database query (index on expires_at)
- Batch email sending
- Event-driven expiry processing

**Implementation Priority:** Phase 2

---

### Enhancement 6: Metadata-Based Feature Flags

**Status:** 🔵 PLANNED (Phase 2+)

**What to Build:**
- [ ] JSON metadata column in tenant_modules table
- [ ] Granular feature toggles (custom_branding, api_access, etc.)
- [ ] Feature flag UI in landlord admin
- [ ] Runtime feature flag checking

**Business Case:**
Allow selling "add-ons" without creating Level 3/4/5 price tiers

**Example:**
```json
{
  "custom_branding": true,
  "api_access": false,
  "max_cards": 5000
}
```

**Implementation Priority:** Phase 2

---

### Enhancement 7: Audit & Compliance

**Status:** 🔵 PLANNED (Phase 2+)

**What to Build:**
- [ ] Complete audit trail for all card operations
- [ ] IP address logging
- [ ] Admin action tracking (who did what when)
- [ ] Audit log export for compliance
- [ ] Retention policy (7 years)

**Compliance Requirements:**
- GDPR: Right to access, right to erasure
- SOC 2: Audit trail completeness
- ISO 27001: Access logging

**Implementation Priority:** Phase 2 or Phase 3

---

## 📝 TECHNICAL DEBT & IMPROVEMENTS

### Debt 1: Test Database Migration Automation

**Status:** 🟡 KNOWN ISSUE (Non-Critical)

**Problem:**
Test tenant database migrations not automated - manual SQL needed

**Current Workaround:**
```sql
-- Manual migration for test database:
ALTER TABLE digital_cards ADD COLUMN tenant_id VARCHAR(255) NOT NULL;
ALTER TABLE digital_cards ADD COLUMN activated_at TIMESTAMP NULL;
ALTER TABLE digital_cards ADD COLUMN revoked_at TIMESTAMP NULL;
ALTER TABLE digital_cards ADD COLUMN revocation_reason TEXT NULL;
```

**What to Fix:**
- [ ] Create TestCase helper method: `runTenantMigrations()`
- [ ] Auto-run migrations in setUp() for tenant tests
- [ ] Document test database setup in developer guide

**Implementation Priority:** Low (workaround exists)

---

### Debt 2: IssueCardHandler Missing Subscription Check

**Status:** 🟡 BY DESIGN (Phase 0 Handler)

**Problem:**
IssueCardHandler doesn't check subscription (Phase 0 handler, updated for tenantId only)

**What to Fix:**
- [ ] Add FeatureGateService to IssueCardHandler
- [ ] Check subscription before issuing card
- [ ] Check quota before issuing card
- [ ] Update Phase 0 tests to create subscription first

**Implementation Priority:** Medium (should be in Phase 1.2)

---

### Debt 3: Performance Optimization Opportunities

**Status:** 🟢 FUTURE OPTIMIZATION

**What to Optimize:**
- [ ] Add Redis caching for subscription checks
- [ ] Add database read replicas for list queries
- [ ] Implement query result caching (15 minutes)
- [ ] Add eager loading for member information
- [ ] Optimize QR code generation (cache images)

**Implementation Priority:** After Phase 1.2 complete and load tested

---

### Debt 4: Documentation Gaps

**Status:** 🟢 ONGOING

**What to Document:**
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Deployment guide
- [ ] Troubleshooting guide (common errors)
- [ ] Architecture decision records (ADRs)
- [ ] Video tutorials for UI

**Implementation Priority:** Continuous throughout Phase 1.2

---

## 📊 PHASE 1.2 SUCCESS METRICS

**Track These During Development:**

### Code Quality
- [ ] Test coverage: ≥ 90%
- [ ] All tests passing: 100%
- [ ] PHPStan Level 8: 0 errors
- [ ] No DDD violations
- [ ] Code review: 2+ approvals

### Performance
- [ ] Card creation: < 150ms
- [ ] Card activation: < 100ms
- [ ] List 1,000 cards: < 200ms
- [ ] Subscription check: < 10ms (cached)
- [ ] Real-time broadcast: < 50ms

### User Experience
- [ ] All CRUD operations working
- [ ] Error messages clear and actionable
- [ ] UI responsive on mobile
- [ ] Filters performant
- [ ] Real-time updates smooth

### Architecture
- [ ] DDD principles followed
- [ ] No framework in Domain layer
- [ ] Repository pattern used correctly
- [ ] Events published correctly
- [ ] Tenant isolation verified

---

## 🎯 IMPLEMENTATION ORDER (RECOMMENDED)

### Week 1: Foundation
1. Fix critical issues (Tenancy API, Domain Purity)
2. Implement API endpoints
3. Add authorization policies
4. Write HTTP-level tests

### Week 2: UI Core
1. Create Vue index component
2. Implement basic filtering
3. Add modals (issue, view, revoke)
4. Test all CRUD operations

### Week 3: UI Polish
1. Add advanced filtering
2. Implement real-time updates
3. Add QR code image generation
4. Create enhanced details view

### Week 4: Final Polish
1. Performance optimization
2. Security audit
3. Documentation
4. Load testing
5. Team review and approval

---

## 📞 GETTING HELP

### Documentation Hierarchy
1. Quick answer? → `developer_guide/laravel-backend/digitalcard-context/QUICK_REFERENCE.md`
2. Need details? → `developer_guide/laravel-backend/digitalcard-context/20251227_phase1_developer_guide.md`
3. Still stuck? → Read test files for usage examples
4. Production issue? → Check Developer Guide Troubleshooting section

### Code Examples
Best learning resource: Test files in `tests/Feature/Contexts/DigitalCard/`

---

## ✅ DEFINITION OF DONE

**Phase 1.2 is complete when:**

- ✅ All 6 priorities implemented and tested
- ✅ All critical fixes completed
- ✅ Test coverage ≥ 90%
- ✅ All tests passing (100%)
- ✅ Performance metrics met
- ✅ Documentation complete
- ✅ Security audit passed
- ✅ Team review approved
- ✅ Deployed to staging
- ✅ User acceptance testing passed

---

**STATUS:** ✅ **READY FOR PHASE 1.2 IMPLEMENTATION**

Phase 1.1 foundation is solid (22/22 tests passing).
Feature gating is in place.
This TODO list provides clear path for next 4 weeks.

**BEGIN PHASE 1.2 IMMEDIATELY!** 🚀

---

**Last Updated:** 2025-12-27
**Next Review:** After Phase 1.2 Week 1 completion
