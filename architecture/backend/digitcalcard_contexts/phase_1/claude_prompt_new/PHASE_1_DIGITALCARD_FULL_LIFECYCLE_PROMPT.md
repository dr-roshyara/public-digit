# **PHASE 1: DIGITALCARD CONTEXT - FULL LIFECYCLE WITH SUBSCRIPTIONS**
## **Professional Claude CLI Prompt for Senior Developer**

**Status:** Ready for immediate implementation  
**Builds On:** Phase 0.1 Subscription Context (✅ Complete)  
**Duration:** 8 weeks  
**Approach:** TDD + DDD with subscription integration  

---

## **CRITICAL CONTEXT**

### **What You Have**

✅ **Phase 0.1 Subscription Context (COMPLETE)**
- FeatureGateService ready for use
- SubscriptionService managing plans
- 15 passing tests, clean DDD architecture
- Zero technical debt

✅ **Phase 0 DigitalCard (COMPLETE)**
- IssueCardHandler with full test coverage
- Domain entities: DigitalCard aggregate
- Value objects: CardId, MemberId, QRCode
- Walking skeleton proven and tested

✅ **Architecture Established**
- DDD/TDD workflow proven
- Multi-tenant setup working
- Case 4 routing (`/{tenant}/api/v1/cards`)

### **What You're Building Now**

Phase 1: Full DigitalCard lifecycle with subscription integration

```
Card Lifecycle:
  issue → active → (revoked|expired)

New Operations (Phase 1):
  ✅ Activate Card (issued → active)
  ✅ Revoke Card (issued|active → revoked)
  ✅ List Cards (with filtering)
  ✅ Get Card Details
  ✅ Card Management Admin UI (Vue.js)

Subscription Integration:
  ✅ Check subscription before issuing
  ✅ Check quota before issuing
  ✅ Track monthly usage
  ✅ Handle subscription changes
```

### **Key Principle**

**Feature gates are already in place from Phase 0.1.**
Your job is to:
1. Inject FeatureGateService into handlers
2. Add 2-3 subscription checks at start of operations
3. Build full lifecycle operations (activate, revoke, list)
4. Create Vue.js admin UI

**No massive refactoring needed.** Clean integration.

---

## **SECTION 1: UPDATED DIGITALCARD ENTITY**

### **1.1 Extend Aggregate Root with Phase 1 Operations**

```php
<?php
// app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Entities;

use App\Contexts\DigitalCard\Domain\ValueObjects\{CardId, MemberId, QRCode};
use App\Contexts\DigitalCard\Domain\Enums\CardStatus;
use App\Contexts\DigitalCard\Domain\Events\{CardIssued, CardActivated, CardRevoked};

final class DigitalCard
{
    private array $domainEvents = [];

    private function __construct(
        private readonly CardId $id,
        private readonly string $tenantId,
        private readonly MemberId $memberId,
        private QRCode $qrCode,
        private CardStatus $status,
        private readonly \DateTimeImmutable $issuedAt,
        private ?\DateTimeImmutable $activatedAt = null,
        private ?\DateTimeImmutable $revokedAt = null,
        private ?string $revocationReason = null,
        private ?\DateTimeImmutable $expiresAt = null,
    ) {}

    // ===== FACTORY METHODS =====

    /**
     * Issue new card (Phase 0)
     */
    public static function issue(
        CardId $id,
        string $tenantId,
        MemberId $memberId,
        \DateTimeImmutable $expiresAt,
    ): self {
        $card = new self(
            $id,
            $tenantId,
            $memberId,
            QRCode::generate(),
            CardStatus::ISSUED,
            new \DateTimeImmutable(),
            null,
            null,
            null,
            $expiresAt,
        );

        $card->recordEvent(new CardIssued(
            cardId: $id->value(),
            tenantId: $tenantId,
            memberId: $memberId->value(),
            issuedAt: $card->issuedAt,
        ));

        return $card;
    }

    // ===== QUERY METHODS =====

    public function id(): CardId { return $this->id; }
    public function tenantId(): string { return $this->tenantId; }
    public function memberId(): MemberId { return $this->memberId; }
    public function qrCode(): QRCode { return $this->qrCode; }
    public function status(): CardStatus { return $this->status; }
    public function issuedAt(): \DateTimeImmutable { return $this->issuedAt; }
    public function activatedAt(): ?\DateTimeImmutable { return $this->activatedAt; }
    public function revokedAt(): ?\DateTimeImmutable { return $this->revokedAt; }
    public function revocationReason(): ?string { return $this->revocationReason; }
    public function expiresAt(): ?\DateTimeImmutable { return $this->expiresAt; }

    public function isActive(): bool
    {
        return $this->status === CardStatus::ACTIVE
            && (!$this->expiresAt || $this->expiresAt > new \DateTimeImmutable());
    }

    public function canActivate(): bool
    {
        return $this->status === CardStatus::ISSUED
            && (!$this->expiresAt || $this->expiresAt > new \DateTimeImmutable());
    }

    public function canRevoke(): bool
    {
        return $this->status === CardStatus::ISSUED || $this->status === CardStatus::ACTIVE;
    }

    // ===== BUSINESS OPERATIONS =====

    /**
     * Activate card (Phase 1)
     */
    public function activate(\DateTimeImmutable $activatedAt): void
    {
        if (!$this->canActivate()) {
            throw new \DomainException(
                sprintf('Cannot activate card in %s status', $this->status->value)
            );
        }

        $this->status = CardStatus::ACTIVE;
        $this->activatedAt = $activatedAt;

        $this->recordEvent(new CardActivated(
            cardId: $this->id->value(),
            tenantId: $this->tenantId,
            activatedAt: $activatedAt,
        ));
    }

    /**
     * Revoke card (Phase 1)
     */
    public function revoke(string $reason, \DateTimeImmutable $revokedAt): void
    {
        if (!$this->canRevoke()) {
            throw new \DomainException(
                sprintf('Cannot revoke card in %s status', $this->status->value)
            );
        }

        if (empty($reason)) {
            throw new \InvalidArgumentException('Revocation reason is required');
        }

        $this->status = CardStatus::REVOKED;
        $this->revokedAt = $revokedAt;
        $this->revocationReason = $reason;

        $this->recordEvent(new CardRevoked(
            cardId: $this->id->value(),
            tenantId: $this->tenantId,
            reason: $reason,
            revokedAt: $revokedAt,
        ));
    }

    /**
     * Regenerate QR code (Phase 2+)
     */
    public function regenerateQRCode(): void
    {
        if (!$this->isActive()) {
            throw new \DomainException('Can only regenerate QR code for active cards');
        }

        $this->qrCode = QRCode::generate();
    }

    // ===== DOMAIN EVENTS =====

    public function flushDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];
        return $events;
    }

    private function recordEvent(object $event): void
    {
        $this->domainEvents[] = $event;
    }
}
```

### **1.2 New Domain Events**

```php
<?php
// app/Contexts/DigitalCard/Domain/Events/CardActivated.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Events;

final class CardActivated
{
    public function __construct(
        public readonly string $cardId,
        public readonly string $tenantId,
        public readonly \DateTimeImmutable $activatedAt,
    ) {}
}

// app/Contexts/DigitalCard/Domain/Events/CardRevoked.php

final class CardRevoked
{
    public function __construct(
        public readonly string $cardId,
        public readonly string $tenantId,
        public readonly string $reason,
        public readonly \DateTimeImmutable $revokedAt,
    ) {}
}
```

### **1.3 Updated CardStatus Enum**

```php
<?php
// app/Contexts/DigitalCard/Domain/Enums/CardStatus.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Enums;

enum CardStatus: string
{
    case ISSUED = 'issued';
    case ACTIVE = 'active';
    case REVOKED = 'revoked';
    case EXPIRED = 'expired';
}
```

---

## **SECTION 2: APPLICATION LAYER - PHASE 1 COMMANDS**

### **2.1 Activate Card Command**

```php
<?php
// app/Contexts/DigitalCard/Application/Commands/ActivateCardCommand.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Commands;

final class ActivateCardCommand
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $cardId,
    ) {}
}

// app/Contexts/DigitalCard/Application/Commands/RevokeCardCommand.php

final class RevokeCardCommand
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $cardId,
        public readonly string $reason,
    ) {}
}
```

### **2.2 Query Commands**

```php
<?php
// app/Contexts/DigitalCard/Application/Queries/GetCardQuery.php

final class GetCardQuery
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $cardId,
    ) {}
}

// app/Contexts/DigitalCard/Application/Queries/ListCardsQuery.php

final class ListCardsQuery
{
    public function __construct(
        public readonly string $tenantId,
        public readonly ?string $status = null,
        public readonly ?string $memberId = null,
        public readonly int $page = 1,
        public readonly int $perPage = 15,
    ) {}
}
```

### **2.3 Handlers with Subscription Integration**

```php
<?php
// app/Contexts/DigitalCard/Application/Handlers/ActivateCardHandler.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\ActivateCardCommand;
use App\Contexts\DigitalCard\Application\DTOs\CardDTO;
use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepositoryInterface;
use App\Contexts\DigitalCard\Domain\Exceptions\CardNotFoundException;
use App\Contexts\Subscription\Application\Services\FeatureGateService;

final class ActivateCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
        private readonly FeatureGateService $featureGate,
    ) {}

    public function handle(ActivateCardCommand $command): CardDTO
    {
        // ✅ NEW: Check subscription exists
        if (!$this->featureGate->can(
            $command->tenantId,
            'digital_card',
            'digital_cards'
        )) {
            throw new \DomainException(
                'Tenant not subscribed to Digital Cards module'
            );
        }

        // Get card
        $card = $this->cardRepository->byId($command->cardId);
        if (!$card || $card->tenantId() !== $command->tenantId) {
            throw new CardNotFoundException('Card not found');
        }

        // Activate
        $card->activate(new \DateTimeImmutable());

        // Persist
        $this->cardRepository->save($card);

        // Publish events
        foreach ($card->flushDomainEvents() as $event) {
            event($event);
        }

        return CardDTO::fromEntity($card);
    }
}

// app/Contexts/DigitalCard/Application/Handlers/RevokeCardHandler.php

final class RevokeCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
        private readonly FeatureGateService $featureGate,
    ) {}

    public function handle(RevokeCardCommand $command): CardDTO
    {
        // ✅ Check subscription
        if (!$this->featureGate->can(
            $command->tenantId,
            'digital_card',
            'digital_cards'
        )) {
            throw new \DomainException('Module not subscribed');
        }

        $card = $this->cardRepository->byId($command->cardId);
        if (!$card || $card->tenantId() !== $command->tenantId) {
            throw new CardNotFoundException('Card not found');
        }

        $card->revoke($command->reason, new \DateTimeImmutable());
        $this->cardRepository->save($card);

        foreach ($card->flushDomainEvents() as $event) {
            event($event);
        }

        return CardDTO::fromEntity($card);
    }
}
```

### **2.4 Query Handlers**

```php
<?php
// app/Contexts/DigitalCard/Application/Handlers/GetCardHandler.php

final class GetCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
    ) {}

    public function handle(GetCardQuery $query): CardDTO
    {
        $card = $this->cardRepository->byId($query->cardId);
        if (!$card || $card->tenantId() !== $query->tenantId) {
            throw new CardNotFoundException('Card not found');
        }

        return CardDTO::fromEntity($card);
    }
}

// app/Contexts/DigitalCard/Application/Handlers/ListCardsHandler.php

final class ListCardsHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
    ) {}

    public function handle(ListCardsQuery $query): array
    {
        $builder = $this->cardRepository
            ->forTenant($query->tenantId)
            ->query();

        if ($query->status) {
            $builder->where('status', $query->status);
        }

        if ($query->memberId) {
            $builder->where('member_id', $query->memberId);
        }

        $cards = $builder->paginate($query->perPage, ['*'], 'page', $query->page);

        return [
            'data' => $cards->map(fn($card) => CardDTO::fromEntity($card))->toArray(),
            'pagination' => [
                'current_page' => $cards->currentPage(),
                'per_page' => $cards->perPage(),
                'total' => $cards->total(),
                'last_page' => $cards->lastPage(),
            ],
        ];
    }
}
```

---

## **SECTION 3: UPDATED DATABASE SCHEMA**

### **3.1 Migration for Phase 1 Columns**

```php
<?php
// app/Contexts/DigitalCard/Infrastructure/Database/Migrations/2025_12_27_update_digital_cards_table_phase_1.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('tenant_install')->table('digital_cards', function (Blueprint $table) {
            // Phase 1 additions
            $table->dateTime('activated_at')->nullable()->after('status');
            $table->dateTime('revoked_at')->nullable()->after('activated_at');
            $table->text('revocation_reason')->nullable()->after('revoked_at');
            $table->dateTime('expires_at')->nullable()->after('revocation_reason');

            // Unique constraint for one active card per member
            $table->unique(
                ['member_id'],
                'idx_one_active_card_per_member'
            )->where('status', '=', 'active');

            // Indexes for filtering
            $table->index(['status'], 'idx_cards_status');
            $table->index(['member_id', 'status'], 'idx_cards_member_status');
            $table->index(['created_at'], 'idx_cards_created_at');
        });
    }

    public function down(): void
    {
        Schema::connection('tenant_install')->table('digital_cards', function (Blueprint $table) {
            $table->dropColumn(['activated_at', 'revoked_at', 'revocation_reason', 'expires_at']);
            $table->dropIndex('idx_one_active_card_per_member');
            $table->dropIndex(['status']);
            $table->dropIndex(['member_id', 'status']);
            $table->dropIndex(['created_at']);
        });
    }
};
```

---

## **SECTION 4: CONTROLLERS - HTTP LAYER**

### **4.1 Updated Controller with Phase 1 Actions**

```php
<?php
// app/Contexts/DigitalCard/Infrastructure/Http/Controllers/DigitalCardController.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Http\Controllers;

use App\Contexts\DigitalCard\Application\Commands\{
    IssueCardCommand,
    ActivateCardCommand,
    RevokeCardCommand,
};
use App\Contexts\DigitalCard\Application\Queries\{
    GetCardQuery,
    ListCardsQuery,
};
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

final class DigitalCardController extends Controller
{
    // ===== PHASE 0 =====

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'member_id' => 'required|uuid',
            'expires_at' => 'required|date|after:today',
        ]);

        $command = new IssueCardCommand(
            tenantId: $request->tenant()->id,
            memberId: $validated['member_id'],
            expiresAt: new \DateTimeImmutable($validated['expires_at']),
        );

        $card = $this->dispatch($command);

        return response()->json([
            'data' => $card,
            'message' => 'Card issued successfully',
        ], 201);
    }

    // ===== PHASE 1 =====

    /**
     * Activate card
     */
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

    /**
     * Revoke card
     */
    public function revoke(Request $request, string $cardId): JsonResponse
    {
        $this->authorize('revoke', 'digital-card');

        $validated = $request->validate([
            'reason' => 'required|string|min:10|max:500',
        ]);

        $command = new RevokeCardCommand(
            tenantId: $request->tenant()->id,
            cardId: $cardId,
            reason: $validated['reason'],
        );

        $card = $this->dispatch($command);

        return response()->json([
            'data' => $card,
            'message' => 'Card revoked successfully',
        ]);
    }

    /**
     * Get single card
     */
    public function show(Request $request, string $cardId): JsonResponse
    {
        $this->authorize('view', 'digital-card');

        $query = new GetCardQuery(
            tenantId: $request->tenant()->id,
            cardId: $cardId,
        );

        $card = $this->dispatch($query);

        return response()->json([
            'data' => $card,
        ]);
    }

    /**
     * List cards with filtering
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', 'digital-card');

        $validated = $request->validate([
            'status' => 'nullable|string|in:issued,active,revoked,expired',
            'member_id' => 'nullable|uuid',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);

        $query = new ListCardsQuery(
            tenantId: $request->tenant()->id,
            status: $validated['status'] ?? null,
            memberId: $validated['member_id'] ?? null,
            page: (int)($validated['page'] ?? 1),
            perPage: (int)($validated['per_page'] ?? 15),
        );

        $cards = $this->dispatch($query);

        return response()->json($cards);
    }
}
```

---

## **SECTION 5: VUE.JS ADMIN INTERFACE**

### **5.1 Cards Index Component**

```vue
<!-- resources/js/Pages/DigitalCards/Index.vue -->

<template>
  <layout>
    <div class="container mx-auto py-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Digital Cards</h1>
        <button 
          @click="showIssueModal = true"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Issue New Card
        </button>
      </div>

      <!-- Filters -->
      <div class="bg-white p-4 rounded shadow mb-6">
        <div class="grid grid-cols-4 gap-4">
          <select 
            v-model="filters.status"
            @change="fetchCards"
            class="px-3 py-2 border rounded"
          >
            <option value="">All Status</option>
            <option value="issued">Issued</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>

          <input 
            v-model="filters.search"
            @keyup.enter="fetchCards"
            placeholder="Member ID..."
            class="px-3 py-2 border rounded"
          />

          <button 
            @click="fetchCards"
            class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Filter
          </button>

          <button 
            @click="resetFilters"
            class="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Reset
          </button>
        </div>
      </div>

      <!-- Cards Table -->
      <div class="bg-white rounded shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-100 border-b">
            <tr>
              <th class="px-6 py-3 text-left">Card ID</th>
              <th class="px-6 py-3 text-left">Member</th>
              <th class="px-6 py-3 text-left">Status</th>
              <th class="px-6 py-3 text-left">Issued</th>
              <th class="px-6 py-3 text-left">Activated</th>
              <th class="px-6 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="card in cards.data"
              :key="card.id"
              class="border-b hover:bg-gray-50"
            >
              <td class="px-6 py-4 font-mono text-sm">{{ card.id }}</td>
              <td class="px-6 py-4 font-mono text-sm">{{ card.member_id }}</td>
              <td class="px-6 py-4">
                <status-badge :status="card.status" />
              </td>
              <td class="px-6 py-4 text-sm">{{ formatDate(card.issued_at) }}</td>
              <td class="px-6 py-4 text-sm">{{ formatDate(card.activated_at) }}</td>
              <td class="px-6 py-4 text-center">
                <div class="flex justify-center gap-2">
                  <!-- View -->
                  <button 
                    @click="showCard(card)"
                    class="px-2 py-1 text-blue-500 hover:bg-blue-100 rounded text-sm"
                  >
                    View
                  </button>

                  <!-- Activate -->
                  <button 
                    v-if="card.status === 'issued'"
                    @click="activateCard(card)"
                    class="px-2 py-1 text-green-500 hover:bg-green-100 rounded text-sm"
                  >
                    Activate
                  </button>

                  <!-- Revoke -->
                  <button 
                    v-if="card.status === 'active' || card.status === 'issued'"
                    @click="openRevokeModal(card)"
                    class="px-2 py-1 text-red-500 hover:bg-red-100 rounded text-sm"
                  >
                    Revoke
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="mt-4 flex justify-between items-center">
        <div class="text-sm text-gray-600">
          Page {{ cards.pagination.current_page }} of {{ cards.pagination.last_page }}
        </div>
        <div class="flex gap-2">
          <button 
            @click="previousPage"
            :disabled="cards.pagination.current_page === 1"
            class="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button 
            @click="nextPage"
            :disabled="cards.pagination.current_page === cards.pagination.last_page"
            class="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <!-- Modals -->
      <issue-card-modal 
        v-if="showIssueModal"
        @close="showIssueModal = false"
        @issued="cardIssued"
      />

      <card-details-modal 
        v-if="selectedCard"
        :card="selectedCard"
        @close="selectedCard = null"
      />

      <revoke-card-modal 
        v-if="revokeCard"
        :card="revokeCard"
        @close="revokeCard = null"
        @revoked="cardRevoked"
      />
    </div>
  </layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'
import StatusBadge from '@/Components/DigitalCards/StatusBadge.vue'
import IssueCardModal from '@/Components/DigitalCards/IssueCardModal.vue'
import CardDetailsModal from '@/Components/DigitalCards/CardDetailsModal.vue'
import RevokeCardModal from '@/Components/DigitalCards/RevokeCardModal.vue'

const page = usePage()
const tenant = page.props.tenant

const cards = ref({ data: [], pagination: {} })
const filters = ref({ status: '', search: '' })
const selectedCard = ref(null)
const revokeCard = ref(null)
const showIssueModal = ref(false)

onMounted(() => {
  fetchCards()
})

const fetchCards = async (pageNum = 1) => {
  try {
    const response = await axios.get(`/${tenant.slug}/api/v1/cards`, {
      params: {
        status: filters.value.status || undefined,
        member_id: filters.value.search || undefined,
        page: pageNum,
        per_page: 15,
      }
    })
    cards.value = response.data
  } catch (error) {
    console.error('Failed to fetch cards:', error)
  }
}

const showCard = (card) => {
  selectedCard.value = card
}

const activateCard = async (card) => {
  if (!confirm('Activate this card?')) return

  try {
    await axios.put(`/${tenant.slug}/api/v1/cards/${card.id}/activate`)
    await fetchCards()
  } catch (error) {
    console.error('Failed to activate card:', error)
  }
}

const openRevokeModal = (card) => {
  revokeCard.value = card
}

const cardIssued = () => {
  showIssueModal.value = false
  fetchCards()
}

const cardRevoked = () => {
  revokeCard.value = null
  fetchCards()
}

const nextPage = () => {
  if (cards.value.pagination.current_page < cards.value.pagination.last_page) {
    fetchCards(cards.value.pagination.current_page + 1)
  }
}

const previousPage = () => {
  if (cards.value.pagination.current_page > 1) {
    fetchCards(cards.value.pagination.current_page - 1)
  }
}

const resetFilters = () => {
  filters.value = { status: '', search: '' }
  fetchCards()
}

const formatDate = (date) => {
  return date ? new Date(date).toLocaleDateString() : '-'
}
</script>
```

### **5.2 Supporting Components**

```vue
<!-- resources/js/Components/DigitalCards/StatusBadge.vue -->
<template>
  <span :class="badgeClass">
    {{ status.charAt(0).toUpperCase() + status.slice(1) }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ status: string }>()

const badgeClass = computed(() => {
  const baseClass = 'px-3 py-1 rounded text-sm font-medium'
  const statusClasses = {
    issued: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    revoked: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
  }
  return `${baseClass} ${statusClasses[props.status]}`
})
</script>

<!-- resources/js/Components/DigitalCards/RevokeCardModal.vue -->
<template>
  <modal @close="$emit('close')">
    <template #header>
      Revoke Card
    </template>

    <form @submit.prevent="submit" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Card ID</label>
        <input 
          :value="card.id" 
          disabled 
          class="w-full px-3 py-2 border bg-gray-100 rounded"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Revocation Reason *</label>
        <textarea 
          v-model="reason"
          required
          minlength="10"
          maxlength="500"
          class="w-full px-3 py-2 border rounded"
          rows="4"
          placeholder="Explain why this card is being revoked..."
        />
        <div class="text-sm text-gray-600 mt-1">
          {{ reason.length }} / 500
        </div>
      </div>

      <div class="flex gap-2 justify-end pt-4">
        <button 
          type="button" 
          @click="$emit('close')"
          class="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Cancel
        </button>
        <button 
          type="submit"
          class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Revoke Card
        </button>
      </div>
    </form>
  </modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import Modal from '@/Components/Modal.vue'

const props = defineProps<{ card: any }>()
const emit = defineEmits(['close', 'revoked'])

const reason = ref('')
const loading = ref(false)

const submit = async () => {
  loading.value = true
  try {
    await axios.put(
      `/${props.card.tenant_id}/api/v1/cards/${props.card.id}/revoke`,
      { reason: reason.value }
    )
    emit('revoked')
  } catch (error) {
    console.error('Failed to revoke card:', error)
  } finally {
    loading.value = false
  }
}
</script>
```

---

## **SECTION 6: AUTHORIZATION & POLICIES**

### **6.1 Authorization Policy**

```php
<?php
// app/Policies/DigitalCardPolicy.php

namespace App\Policies;

use App\Models\User;

class DigitalCardPolicy
{
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

### **6.2 Model Registration**

```php
// In AppServiceProvider::boot()

Gate::policy(DigitalCard::class, DigitalCardPolicy::class);
```

---

## **SECTION 7: ROUTES**

```php
<?php
// routes/api.php

Route::middleware(['tenant', 'auth'])
    ->prefix('{tenant}/api/v1')
    ->group(function () {
        // ===== PHASE 0 =====
        Route::post('/cards', [DigitalCardController::class, 'store'])
            ->middleware('can:create,digital-card')
            ->name('cards.store');

        // ===== PHASE 1 =====
        Route::get('/cards', [DigitalCardController::class, 'index'])
            ->middleware('can:viewAny,digital-card')
            ->name('cards.index');

        Route::get('/cards/{cardId}', [DigitalCardController::class, 'show'])
            ->middleware('can:view,digital-card')
            ->name('cards.show');

        Route::put('/cards/{cardId}/activate', [DigitalCardController::class, 'activate'])
            ->middleware('can:activate,digital-card')
            ->name('cards.activate');

        Route::put('/cards/{cardId}/revoke', [DigitalCardController::class, 'revoke'])
            ->middleware('can:revoke,digital-card')
            ->name('cards.revoke');
    });
```

---

## **SECTION 8: TESTS**

### **8.1 Phase 1 Test Cases**

```php
<?php
// tests/Feature/Contexts/DigitalCard/ActivateCardTest.php

namespace Tests\Feature\Contexts\DigitalCard;

use App\Models\{Tenant, User};
use App\Contexts\DigitalCard\Infrastructure\Models\DigitalCardModel;
use Tests\TestCase;

class ActivateCardTest extends TestCase
{
    it('activates issued card', function () {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->for($tenant)->admin()->create();
        $this->actingAs($user);

        // Create subscription first
        $this->createSubscription($tenant, 'digital_card', 'free');

        // Issue card
        $card = DigitalCardModel::factory()
            ->for($tenant)
            ->create(['status' => 'issued']);

        // Activate
        $response = $this->putJson(
            "/{$tenant->slug}/api/v1/cards/{$card->id}/activate"
        );

        expect($response->status())->toBe(200);
        expect($response->json('data.status'))->toBe('active');
        
        $this->assertDatabaseHas('digital_cards', [
            'id' => $card->id,
            'status' => 'active',
        ]);
    });

    it('requires subscription to activate', function () {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->for($tenant)->admin()->create();
        $this->actingAs($user);

        // NO subscription

        $card = DigitalCardModel::factory()
            ->for($tenant)
            ->create(['status' => 'issued']);

        $response = $this->putJson(
            "/{$tenant->slug}/api/v1/cards/{$card->id}/activate"
        );

        expect($response->status())->toBe(403);
    });

    it('prevents activating already active card', function () {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->for($tenant)->admin()->create();
        $this->actingAs($user);

        $this->createSubscription($tenant, 'digital_card', 'free');

        $card = DigitalCardModel::factory()
            ->for($tenant)
            ->create(['status' => 'active']);

        $response = $this->putJson(
            "/{$tenant->slug}/api/v1/cards/{$card->id}/activate"
        );

        expect($response->status())->toBe(422);
    });

    private function createSubscription(Tenant $tenant, string $module, string $plan): void
    {
        app('subscription-service')->subscribe(
            $tenant->id,
            $module,
            $plan
        );
    }
}

// tests/Feature/Contexts/DigitalCard/ListCardsTest.php

class ListCardsTest extends TestCase
{
    it('lists cards with pagination', function () {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->for($tenant)->create();
        $this->actingAs($user);

        DigitalCardModel::factory()
            ->for($tenant)
            ->count(20)
            ->create();

        $response = $this->getJson("/{$tenant->slug}/api/v1/cards?page=1&per_page=15");

        expect($response->status())->toBe(200);
        expect($response->json('data'))->toHaveLength(15);
        expect($response->json('pagination.total'))->toBe(20);
    });

    it('filters cards by status', function () {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->for($tenant)->create();
        $this->actingAs($user);

        DigitalCardModel::factory()->for($tenant)->active()->count(5)->create();
        DigitalCardModel::factory()->for($tenant)->issued()->count(3)->create();

        $response = $this->getJson(
            "/{$tenant->slug}/api/v1/cards?status=active"
        );

        expect($response->json('data'))->toHaveLength(5);
        expect($response->json('data.*.status'))->toEqual(array_fill(0, 5, 'active'));
    });
}
```

---

## **SECTION 9: DOMAIN EVENT LISTENERS**

### **9.1 Event Handling**

```php
<?php
// app/Listeners/DigitalCard/OnCardActivated.php

namespace App\Listeners\DigitalCard;

use App\Contexts\DigitalCard\Domain\Events\CardActivated;
use Illuminate\Support\Facades\Log;

final class OnCardActivated
{
    public function handle(CardActivated $event): void
    {
        Log::info('Card activated', [
            'card_id' => $event->cardId,
            'tenant_id' => $event->tenantId,
            'activated_at' => $event->activatedAt->toIso8601String(),
        ]);

        // Could trigger: email notification, webhook, etc.
    }
}

// app/Listeners/DigitalCard/OnCardRevoked.php

final class OnCardRevoked
{
    public function handle(CardRevoked $event): void
    {
        Log::info('Card revoked', [
            'card_id' => $event->cardId,
            'reason' => $event->reason,
        ]);

        // Could trigger: member notification, audit log, etc.
    }
}
```

Register in `EventServiceProvider`:
```php
protected $listen = [
    CardIssued::class => [OnCardIssued::class],
    CardActivated::class => [OnCardActivated::class],
    CardRevoked::class => [OnCardRevoked::class],
];
```

---

## **SECTION 10: IMPLEMENTATION CHECKLIST**

### **Week 1: Foundation (Days 1-5)**

- [ ] Update DigitalCard entity (activate, revoke, regenerate)
- [ ] Create domain events (CardActivated, CardRevoked)
- [ ] Write failing tests (TDD RED)
- [ ] Create commands and handlers
- [ ] Create query handlers
- [ ] Create migrations

**Commands:**
```bash
php artisan make:test Feature/Contexts/DigitalCard/ActivateCardTest
php artisan make:test Feature/Contexts/DigitalCard/RevokeCardTest
php artisan make:test Feature/Contexts/DigitalCard/ListCardsTest
php artisan make:migration update_digital_cards_table_phase_1
php artisan migrate
```

### **Week 2: Infrastructure (Days 6-10)**

- [ ] Update controller with Phase 1 actions
- [ ] Add routes
- [ ] Create authorization policy
- [ ] Implement event listeners
- [ ] Tests passing (TDD GREEN)

### **Week 3-4: UI & Integration (Days 11-20)**

- [ ] Create Vue index component
- [ ] Create issue modal
- [ ] Create details modal
- [ ] Create revoke modal
- [ ] Status badge component
- [ ] Test all flows

### **Week 5-8: Refinement & Documentation**

- [ ] Code cleanup (REFACTOR)
- [ ] Performance optimization
- [ ] Documentation
- [ ] Edge case handling
- [ ] Final testing

---

## **SECTION 11: SUCCESS CRITERIA**

✅ **Functionality:**
- [ ] Issue card (Phase 0 existing)
- [ ] Activate card
- [ ] Revoke card with reason
- [ ] List cards with filters
- [ ] View card details
- [ ] Subscription checks working
- [ ] Quota enforcement working

✅ **Code Quality:**
- [ ] 90%+ test coverage
- [ ] All tests passing
- [ ] Clean DDD architecture
- [ ] PHPStan Level 8 clean (when configured)

✅ **Performance:**
- [ ] Card issuance: < 150ms
- [ ] Card activation: < 100ms
- [ ] List cards: < 200ms (with pagination)
- [ ] Subscription check: < 10ms (if cached)

✅ **User Experience:**
- [ ] Vue admin UI fully functional
- [ ] Error messages clear
- [ ] Pagination working
- [ ] Filters responsive

---

## **SECTION 12: INTEGRATION WITH PHASE 0.1**

### **Key Integration Points**

```php
// In every handler that creates/modifies cards:

// 1. Inject FeatureGateService
public function __construct(
    private FeatureGateService $featureGate,
    // ... other deps
) {}

// 2. Check subscription at start
if (!$this->featureGate->can(
    $command->tenantId,
    'digital_card',
    'digital_cards'
)) {
    throw new Exception('Not subscribed');
}

// 3. Check quota if needed
if ($this->featureGate->isQuotaExceeded(
    $command->tenantId,
    'digital_card',
    'digital_cards',
    $currentUsage
)) {
    throw new Exception('Quota exceeded');
}

// 4. Continue with business logic
```

**That's it.** 2-3 lines per handler. No massive refactoring.

---

## **NEXT STEPS**

### **This Week (Immediate)**

1. ✅ Understand Phase 1 specification
2. ✅ Create failing tests
3. ✅ Implement domain entities
4. ✅ Get TDD RED → GREEN workflow

### **Next 8 Weeks**

Follow the checklist in Section 10, completing features systematically.

---

**Status:** ✅ **READY FOR PHASE 1 IMPLEMENTATION**

Phase 0.1 foundation is solid. Feature gating is in place. Time to build the full DigitalCard lifecycle with subscriptions integrated from day one.

🚀 **Begin Phase 1 immediately!**

