# **SUBSCRIPTION ARCHITECTURE & DIGITALCARD AS SUBSCRIPTION MODULE**
## **Professional Architectural Plan & Implementation Strategy**

**Version:** 1.0  
**Status:** Production Ready  
**Date:** 2025-12-25  
**Architect:** Senior Solution Architect & Software Architect  

---

## **EXECUTIVE SUMMARY**

The original brainstorming document provides a solid foundation but requires significant architectural refinement. This rewrite addresses critical gaps:

1. **Missing Subscription Context:** Modules need a governing Subscription system
2. **Unclear DigitalCard positioning:** Should be subscription-driven, not standalone
3. **Weak DDD modeling:** Needs proper bounded contexts and domain entities
4. **Insufficient business logic:** Feature gates without subscription semantics
5. **Scaling concerns:** Not addressed at architectural level

**This document reframes the architecture around a primary SubscriptionContext** that governs all module/feature access through a professional DDD approach.

---

## **SECTION 1: ARCHITECTURAL ANALYSIS**

### **1.1 Issues with Original Brainstorming**

| Issue | Impact | Severity |
|-------|--------|----------|
| No Subscription Context | Module access not gated by subscriptions | CRITICAL |
| DigitalCard as module (not feature) | Can't create subscription tiers easily | HIGH |
| Feature flags without entitlements | No connection to billing/plans | HIGH |
| Weak domain modeling | No aggregate roots, value objects | HIGH |
| Installation jobs vs. subscriptions | Unclear state management | MEDIUM |
| No billing integration points | Revenue tracking impossible | HIGH |
| Missing usage tracking | Can't enforce limits | MEDIUM |
| Unclear module dependencies | Modules don't compose cleanly | MEDIUM |

### **1.2 Gaps Identified**

**Missing Components:**
- ✗ Subscription entity (core aggregate)
- ✗ Plan/Tier management
- ✗ Entitlements system
- ✗ Usage quota enforcement
- ✗ Billing event hooks
- ✗ Customer journey mapping
- ✗ Revenue recognition
- ✗ Churn/retention patterns

**Weak Areas:**
- ✗ Feature access control (too simplistic)
- ✗ Module lifecycle (installation vs. subscription)
- ✗ State transitions (no state machine)
- ✗ Event-driven architecture (missing events)
- ✗ Anti-corruption layers (no cross-context boundaries)
- ✗ Tenant isolation in subscriptions

---

## **SECTION 2: SUBSCRIPTION CONTEXT - CORE ARCHITECTURE**

### **2.1 Strategic Vision**

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION CONTEXT                     │
│              (PRIMARY GOVERNING BOUNDED CONTEXT)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RESPONSIBILITIES:                                         │
│  ✓ Manage Plans and Pricing Tiers                          │
│  ✓ Manage Tenant Subscriptions                             │
│  ✓ Manage Entitlements (what tenants can do)               │
│  ✓ Track Usage and Enforce Quotas                          │
│  ✓ Generate Billing Events                                │
│  ✓ Manage Subscription Lifecycle (creation→renewal→cancel) │
│  ✓ Support upsell/downgrade flows                          │
│  ✓ Revenue analytics and reporting                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  DRIVEN BY BUSINESS QUESTIONS:                              │
│  - What can this tenant do? (Entitlements)                 │
│  - How much have they used? (Usage tracking)               │
│  - Can they use more? (Quota enforcement)                  │
│  - What should we bill? (Billing events)                   │
│  - Why are they churning? (Analytics)                      │
│  - What should we upsell? (Growth)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
    Governs Module/Feature Access Through Entitlements
```

### **2.2 Domain Model - Core Entities**

**Aggregate Roots:**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\Entities;

use App\Contexts\Subscription\Domain\ValueObjects\{
    PlanId, SubscriptionId, EntitlementId, TenantId, 
    PlanName, Price, Duration, Feature
};

// AGGREGATE ROOT: Plan
// Represents a subscription offering (e.g., "Professional Plan", "Enterprise Plan")
final class Plan
{
    private function __construct(
        private readonly PlanId $id,
        private readonly PlanName $name,
        private readonly string $slug,           // professional, enterprise
        private readonly Price $monthlyPrice,
        private readonly Price $annualPrice,
        /** @var array<Feature> */
        private readonly array $includedFeatures,
        /** @var array<string, int> */
        private readonly array $quotas,         // e.g., ['digital_cards' => 1000]
        private readonly int $maxTeamMembers,
        private readonly int $maxApiKeys,
        private bool $isActive = true,
        private readonly \DateTimeImmutable $createdAt = new \DateTimeImmutable(),
    ) {}

    // Factory method
    public static function create(
        PlanId $id,
        PlanName $name,
        string $slug,
        Price $monthlyPrice,
        Price $annualPrice,
        array $features,
        array $quotas,
        int $maxTeamMembers,
        int $maxApiKeys,
    ): self {
        return new self(
            $id,
            $name,
            $slug,
            $monthlyPrice,
            $annualPrice,
            $features,
            $quotas,
            $maxTeamMembers,
            $maxApiKeys
        );
    }

    // Business logic
    public function canUpgradeTo(Plan $otherPlan): bool
    {
        // Can only upgrade to plan with more features
        return count($otherPlan->includedFeatures) > count($this->includedFeatures);
    }

    public function priceFor(SubscriptionDuration $duration): Price
    {
        return match($duration) {
            SubscriptionDuration::MONTHLY => $this->monthlyPrice,
            SubscriptionDuration::ANNUAL => $this->annualPrice,
        };
    }

    public function getQuotaFor(string $feature): ?int
    {
        return $this->quotas[$feature] ?? null;
    }

    // Getters
    public function id(): PlanId { return $this->id; }
    public function name(): PlanName { return $this->name; }
    public function slug(): string { return $this->slug; }
    public function includedFeatures(): array { return $this->includedFeatures; }
}

// AGGREGATE ROOT: Subscription
// Represents a tenant's active subscription to a plan
final class Subscription
{
    /** @var array<SubscriptionEvent> */
    private array $domainEvents = [];

    private function __construct(
        private readonly SubscriptionId $id,
        private readonly TenantId $tenantId,
        private readonly PlanId $planId,
        private SubscriptionStatus $status,           // active, cancelled, suspended, expired
        private readonly \DateTimeImmutable $startedAt,
        private ?\DateTimeImmutable $expiresAt,
        private SubscriptionDuration $billingCycle,  // monthly, annual
        private readonly \DateTimeImmutable $createdAt,
        private \DateTimeImmutable $updatedAt,
    ) {}

    // Factory: New subscription
    public static function create(
        SubscriptionId $id,
        TenantId $tenantId,
        PlanId $planId,
        SubscriptionDuration $billingCycle,
    ): self {
        $subscription = new self(
            $id,
            $tenantId,
            $planId,
            SubscriptionStatus::ACTIVE,
            now: new \DateTimeImmutable(),
            expiresAt: null,
            billingCycle: $billingCycle,
            createdAt: new \DateTimeImmutable(),
            updatedAt: new \DateTimeImmutable(),
        );

        $subscription->recordThat(new SubscriptionCreated(
            subscriptionId: $subscription->id,
            tenantId: $subscription->tenantId,
            planId: $subscription->planId,
            billingCycle: $billingCycle,
            startedAt: $subscription->startedAt,
        ));

        return $subscription;
    }

    // Business operations
    public function cancel(string $reason): void
    {
        if (!$this->isActive()) {
            throw SubscriptionException::alreadyCancelled($this->id);
        }

        $this->status = SubscriptionStatus::CANCELLED;
        $this->updatedAt = new \DateTimeImmutable();

        $this->recordThat(new SubscriptionCancelled(
            subscriptionId: $this->id,
            tenantId: $this->tenantId,
            reason: $reason,
            cancelledAt: $this->updatedAt,
        ));
    }

    public function renew(PlanId $newPlanId = null): void
    {
        if (!$this->isExpiring()) {
            throw SubscriptionException::notExpiring($this->id);
        }

        $planId = $newPlanId ?? $this->planId;
        $this->planId = $planId;
        $this->expiresAt = $this->calculateNextExpiration();
        $this->status = SubscriptionStatus::ACTIVE;
        $this->updatedAt = new \DateTimeImmutable();

        $this->recordThat(new SubscriptionRenewed(
            subscriptionId: $this->id,
            tenantId: $this->tenantId,
            planId: $planId,
            renewedAt: $this->updatedAt,
            expiresAt: $this->expiresAt,
        ));
    }

    public function suspend(string $reason): void
    {
        if (!$this->isActive()) {
            throw SubscriptionException::notActive($this->id);
        }

        $this->status = SubscriptionStatus::SUSPENDED;
        $this->updatedAt = new \DateTimeImmutable();

        $this->recordThat(new SubscriptionSuspended(
            subscriptionId: $this->id,
            tenantId: $this->tenantId,
            reason: $reason,
            suspendedAt: $this->updatedAt,
        ));
    }

    // Query methods
    public function isActive(): bool
    {
        return $this->status === SubscriptionStatus::ACTIVE;
    }

    public function isExpiring(): bool
    {
        return $this->expiresAt !== null 
            && $this->expiresAt <= new \DateTimeImmutable('+30 days');
    }

    public function daysUntilExpiration(): ?int
    {
        if ($this->expiresAt === null) {
            return null;
        }
        return (int)$this->expiresAt->diff(new \DateTimeImmutable())->days;
    }

    // Domain events
    protected function recordThat(SubscriptionEvent $event): void
    {
        $this->domainEvents[] = $event;
    }

    /** @return array<SubscriptionEvent> */
    public function flushDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];
        return $events;
    }

    // Getters
    public function id(): SubscriptionId { return $this->id; }
    public function tenantId(): TenantId { return $this->tenantId; }
    public function planId(): PlanId { return $this->planId; }
    public function status(): SubscriptionStatus { return $this->status; }
    public function billingCycle(): SubscriptionDuration { return $this->billingCycle; }
    public function startedAt(): \DateTimeImmutable { return $this->startedAt; }
    public function expiresAt(): ?\DateTimeImmutable { return $this->expiresAt; }

    // Helper
    private function calculateNextExpiration(): \DateTimeImmutable
    {
        return match($this->billingCycle) {
            SubscriptionDuration::MONTHLY => 
                (new \DateTimeImmutable())->modify('+1 month'),
            SubscriptionDuration::ANNUAL => 
                (new \DateTimeImmutable())->modify('+1 year'),
        };
    }
}

// AGGREGATE ROOT: EntitlementSet
// Represents what a tenant can do based on their subscription
final class EntitlementSet
{
    /**
     * @param array<Entitlement> $entitlements
     */
    private function __construct(
        private readonly EntitlementSetId $id,
        private readonly TenantId $tenantId,
        private readonly SubscriptionId $subscriptionId,
        private readonly array $entitlements,
        private readonly \DateTimeImmutable $validFrom,
        private readonly \DateTimeImmutable $validUntil,
    ) {}

    public static function fromSubscription(
        EntitlementSetId $id,
        TenantId $tenantId,
        Subscription $subscription,
        Plan $plan,
    ): self {
        $entitlements = [];

        // Create entitlements from plan features
        foreach ($plan->includedFeatures() as $feature) {
            $entitlements[] = Entitlement::grant(
                EntitlementId::generate(),
                $tenantId,
                $feature->name(),
                EntitlementType::FEATURE,
                $subscription->expiresAt() ?? new \DateTimeImmutable('+1000 years'),
            );
        }

        return new self(
            $id,
            $tenantId,
            $subscription->id(),
            $entitlements,
            $subscription->startedAt(),
            $subscription->expiresAt() ?? new \DateTimeImmutable('+1000 years'),
        );
    }

    public function hasFeature(string $featureName): bool
    {
        return collect($this->entitlements)
            ->where('name', $featureName)
            ->where('isActive', true)
            ->isNotEmpty();
    }

    public function getQuota(string $featureName): ?int
    {
        return collect($this->entitlements)
            ->where('name', $featureName)
            ->first()?->quota();
    }

    public function isValid(): bool
    {
        $now = new \DateTimeImmutable();
        return $now >= $this->validFrom && $now < $this->validUntil;
    }

    // Getters
    public function id(): EntitlementSetId { return $this->id; }
    public function tenantId(): TenantId { return $this->tenantId; }
    public function subscriptionId(): SubscriptionId { return $this->subscriptionId; }
    /** @return array<Entitlement> */
    public function entitlements(): array { return $this->entitlements; }
}
```

### **2.3 Domain Value Objects**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\ValueObjects;

// PlanId - Type-safe plan identifier
final readonly class PlanId
{
    private function __construct(public string $value) {
        if (!uuid_is_valid($this->value)) {
            throw PlanException::invalidId($this->value);
        }
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }

    public static function generate(): self
    {
        return new self((string)\Illuminate\Support\Str::uuid());
    }

    public function equals(PlanId $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}

// SubscriptionId - Type-safe subscription identifier
final readonly class SubscriptionId
{
    private function __construct(public string $value) {
        if (!uuid_is_valid($this->value)) {
            throw SubscriptionException::invalidId($this->value);
        }
    }

    public static function generate(): self
    {
        return new self((string)\Illuminate\Support\Str::uuid());
    }

    public function equals(SubscriptionId $other): bool
    {
        return $this->value === $other->value;
    }
}

// TenantId - Type-safe tenant identifier
final readonly class TenantId
{
    private function __construct(public string $value) {
        if (empty($this->value)) {
            throw new \InvalidArgumentException('TenantId cannot be empty');
        }
    }

    public static function from(\App\Models\Tenant $tenant): self
    {
        return new self((string)$tenant->id);
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }
}

// Price - Money value object (amount + currency)
final readonly class Price
{
    public function __construct(
        public int $amountInCents,
        public string $currency = 'USD',
    ) {
        if ($this->amountInCents < 0) {
            throw new \InvalidArgumentException('Price cannot be negative');
        }
    }

    public static function usd(int $dollars): self
    {
        return new self($dollars * 100, 'USD');
    }

    public static function fromCents(int $cents, string $currency = 'USD'): self
    {
        return new self($cents, $currency);
    }

    public function dollars(): float
    {
        return $this->amountInCents / 100;
    }

    public function add(Price $other): Price
    {
        if ($this->currency !== $other->currency) {
            throw new \InvalidArgumentException('Cannot add prices in different currencies');
        }
        return new self($this->amountInCents + $other->amountInCents, $this->currency);
    }

    public function multiply(int $quantity): Price
    {
        return new self($this->amountInCents * $quantity, $this->currency);
    }

    public function equals(Price $other): bool
    {
        return $this->amountInCents === $other->amountInCents 
            && $this->currency === $other->currency;
    }
}

// PlanName - Constrained name value object
final readonly class PlanName
{
    public function __construct(public string $value)
    {
        if (strlen($value) < 3 || strlen($value) > 100) {
            throw new \InvalidArgumentException('PlanName must be 3-100 characters');
        }
    }

    public function equals(PlanName $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}

// SubscriptionDuration - Enumeration for billing cycles
enum SubscriptionDuration: string
{
    case MONTHLY = 'monthly';
    case ANNUAL = 'annual';

    public function daysUntilRenewal(): int
    {
        return match($this) {
            self::MONTHLY => 30,
            self::ANNUAL => 365,
        };
    }
}

// SubscriptionStatus - Enumeration for subscription states
enum SubscriptionStatus: string
{
    case ACTIVE = 'active';
    case CANCELLED = 'cancelled';
    case SUSPENDED = 'suspended';
    case EXPIRED = 'expired';
    case PAST_DUE = 'past_due';
}

// Feature - Value object representing a feature
final readonly class Feature
{
    public function __construct(
        public string $name,              // 'digital_cards', 'advanced_analytics'
        public string $displayName,       // 'Digital Cards', 'Advanced Analytics'
        public string $description,
        public ?int $defaultQuota = null, // null = unlimited
    ) {}

    public function equals(Feature $other): bool
    {
        return $this->name === $other->name;
    }
}
```

### **2.4 Repository Interfaces**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\Repositories;

use App\Contexts\Subscription\Domain\Entities\{Plan, Subscription, EntitlementSet};
use App\Contexts\Subscription\Domain\ValueObjects\{PlanId, SubscriptionId, TenantId};

interface PlanRepository
{
    public function save(Plan $plan): void;
    public function byId(PlanId $id): ?Plan;
    public function bySlug(string $slug): ?Plan;
    public function allActive(): array; // Returns Plan[]
    public function findUpgradeOptions(PlanId $currentPlan): array; // Returns Plan[]
}

interface SubscriptionRepository
{
    public function save(Subscription $subscription): void;
    public function byId(SubscriptionId $id): ?Subscription;
    public function byTenant(TenantId $tenantId): ?Subscription; // Current active
    public function allForTenant(TenantId $tenantId): array;
    
    public function findExpiringIn(int $days): array; // Returns Subscription[]
    public function findExpired(): array;
    public function findSuspended(): array;
}

interface EntitlementSetRepository
{
    public function save(EntitlementSet $entitlementSet): void;
    public function currentForTenant(TenantId $tenantId): ?EntitlementSet;
    public function bySubscription(SubscriptionId $subscriptionId): ?EntitlementSet;
}
```

---

## **SECTION 3: DIGITALCARD AS SUBSCRIPTION MODULE**

### **3.1 Strategic Positioning**

```
BEFORE (Brainstorming):
  DigitalCard = Standalone module
  → Installation job
  → Feature flags
  → But: No connection to plans/pricing/subscriptions
  → Result: Can't monetize effectively

AFTER (Architecture):
  DigitalCard = Subscription feature
  → Plan includes "Digital Cards"
  → Subscription grants entitlements
  → Quotas enforced (1000 cards/month on Pro plan)
  → Usage tracked
  → Revenue captured
  → Upgrade path clear
  → Result: Scalable SaaS business model
```

### **3.2 DigitalCard Bounded Context**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Entities;

use App\Contexts\DigitalCard\Domain\ValueObjects\{
    CardId, MemberId, QRCode, CardStatus
};
use App\Contexts\Subscription\Domain\ValueObjects\TenantId;

// AGGREGATE ROOT: DigitalCard
// Only exists if tenant has DigitalCard entitlement
final class DigitalCard
{
    /** @var array<CardEvent> */
    private array $domainEvents = [];

    private function __construct(
        private readonly CardId $id,
        private readonly TenantId $tenantId,
        private readonly MemberId $memberId,
        private QRCode $qrCode,
        private CardStatus $status,
        private readonly string $templateSlug,      // basic, professional, premium
        private ?\DateTimeImmutable $expiresAt,
        private readonly \DateTimeImmutable $issuedAt,
        private \DateTimeImmutable $updatedAt,
    ) {}

    // Factory with subscription validation
    public static function issue(
        CardId $id,
        TenantId $tenantId,
        MemberId $memberId,
        string $templateSlug,
    ): self {
        // BUSINESS RULE: Only issue if tenant has entitlement
        // (This validation happens in Application layer via Subscription Context)

        $card = new self(
            $id,
            $tenantId,
            $memberId,
            QRCode::generate($id),
            CardStatus::ISSUED,
            $templateSlug,
            expiresAt: null,
            issuedAt: new \DateTimeImmutable(),
            updatedAt: new \DateTimeImmutable(),
        );

        $card->recordThat(new CardIssued(
            cardId: $card->id,
            tenantId: $card->tenantId,
            memberId: $card->memberId,
            templateSlug: $templateSlug,
        ));

        return $card;
    }

    // Business operations
    public function activate(): void
    {
        if ($this->status !== CardStatus::ISSUED) {
            throw CardException::invalidStatus($this->id, $this->status);
        }

        $this->status = CardStatus::ACTIVE;
        $this->updatedAt = new \DateTimeImmutable();

        $this->recordThat(new CardActivated(
            cardId: $this->id,
            tenantId: $this->tenantId,
            activatedAt: $this->updatedAt,
        ));
    }

    public function revoke(string $reason): void
    {
        if ($this->status === CardStatus::REVOKED) {
            throw CardException::alreadyRevoked($this->id);
        }

        $this->status = CardStatus::REVOKED;
        $this->updatedAt = new \DateTimeImmutable();

        $this->recordThat(new CardRevoked(
            cardId: $this->id,
            tenantId: $this->tenantId,
            reason: $reason,
            revokedAt: $this->updatedAt,
        ));
    }

    public function regenerateQR(): void
    {
        $this->qrCode = QRCode::generate($this->id);
        $this->updatedAt = new \DateTimeImmutable();

        $this->recordThat(new QRCodeRegenerated(
            cardId: $this->id,
            tenantId: $this->tenantId,
        ));
    }

    // Query methods
    public function isActive(): bool
    {
        return $this->status === CardStatus::ACTIVE
            && (!$this->expiresAt || $this->expiresAt > new \DateTimeImmutable());
    }

    // Domain events
    protected function recordThat(CardEvent $event): void
    {
        $this->domainEvents[] = $event;
    }

    /** @return array<CardEvent> */
    public function flushDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];
        return $events;
    }

    // Getters
    public function id(): CardId { return $this->id; }
    public function tenantId(): TenantId { return $this->tenantId; }
    public function memberId(): MemberId { return $this->memberId; }
    public function qrCode(): QRCode { return $this->qrCode; }
    public function status(): CardStatus { return $this->status; }
    public function templateSlug(): string { return $this->templateSlug; }
    public function issuedAt(): \DateTimeImmutable { return $this->issuedAt; }
}
```

### **3.3 Usage Tracking Integration**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Services;

use App\Contexts\Subscription\Domain\ValueObjects\TenantId;

// Service that coordinates with Subscription Context
// This is where we enforce quotas from entitlements
interface UsageTracker
{
    /**
     * Track a card issuance
     * Throws exception if quota exceeded
     */
    public function trackCardIssued(TenantId $tenantId, CardId $cardId): void;

    /**
     * Track a card validation/scan
     * Throws exception if API call quota exceeded
     */
    public function trackValidation(TenantId $tenantId, CardId $cardId): void;

    /**
     * Get current month usage
     */
    public function currentMonthUsage(TenantId $tenantId): CardUsageStatistics;

    /**
     * Check if tenant can issue more cards
     */
    public function canIssueMore(TenantId $tenantId): bool;
}

// Value object for usage statistics
final readonly class CardUsageStatistics
{
    public function __construct(
        public int $cardsIssued,
        public int $cardsActive,
        public int $validationsThisMonth,
        public int $quotaRemaining,
        public float $percentageUsed,
    ) {}
}
```

### **3.4 DigitalCard Database Schema**

```sql
-- SUBSCRIPTION CONTEXT (Landlord DB or shared across tenants)
CREATE TABLE plans (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    monthly_price_cents INTEGER NOT NULL,
    annual_price_cents INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE TABLE plan_features (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES plans(id),
    feature_name VARCHAR(100) NOT NULL,
    feature_display_name VARCHAR(100) NOT NULL,
    description TEXT,
    default_quota INTEGER,
    created_at TIMESTAMPTZ
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status VARCHAR(20) NOT NULL,                  -- active, cancelled, suspended, expired
    billing_cycle VARCHAR(20) NOT NULL,           -- monthly, annual
    started_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    renewal_date TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    
    INDEX idx_subscriptions_tenant (tenant_id),
    INDEX idx_subscriptions_status (status),
    INDEX idx_subscriptions_expires (expires_at)
);

CREATE TABLE entitlement_sets (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ,
    
    INDEX idx_entitlements_tenant (tenant_id),
    INDEX idx_entitlements_subscription (subscription_id)
);

CREATE TABLE entitlements (
    id UUID PRIMARY KEY,
    entitlement_set_id UUID NOT NULL REFERENCES entitlement_sets(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    feature_type VARCHAR(50) NOT NULL,           -- feature, quota, api_call
    quota INTEGER,                                 -- NULL = unlimited
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    
    INDEX idx_entitlements_set (entitlement_set_id),
    INDEX idx_entitlements_tenant_feature (tenant_id, feature_name)
);

-- DIGITALCARD CONTEXT (Tenant DB)
CREATE TABLE digital_cards (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    member_id UUID NOT NULL,
    qr_code_hash VARCHAR(64) NOT NULL,
    qr_code_version INTEGER DEFAULT 1,
    status VARCHAR(20) NOT NULL,                  -- issued, active, revoked, expired
    template_slug VARCHAR(100) NOT NULL DEFAULT 'basic',
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    
    INDEX idx_cards_member_status (member_id, status),
    INDEX idx_cards_tenant_status (tenant_id, status),
    INDEX idx_cards_issued_at (issued_at)
);

-- Usage tracking (Tenant DB or shared)
CREATE TABLE card_usage_stats (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    year_month DATE NOT NULL,                     -- YYYY-01-01 format
    cards_issued_count INTEGER DEFAULT 0,
    cards_active_count INTEGER DEFAULT 0,
    validations_count INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ,
    
    UNIQUE (tenant_id, year_month),
    INDEX idx_usage_tenant_month (tenant_id, year_month)
);

-- Entitlement enforcement log
CREATE TABLE entitlement_violations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    violation_type VARCHAR(50) NOT NULL,          -- quota_exceeded, not_entitled
    attempted_action TEXT,
    timestamp TIMESTAMPTZ,
    
    INDEX idx_violations_tenant (tenant_id),
    INDEX idx_violations_timestamp (timestamp)
);
```

---

## **SECTION 4: ANTI-CORRUPTION LAYER**

### **4.1 Integration Between Contexts**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\AntiCorruptionLayer;

use App\Contexts\Subscription\Domain\ValueObjects\TenantId;
use App\Contexts\Subscription\Application\Services\EntitlementService;

// This ACL translates between DigitalCard and Subscription contexts
final class SubscriptionAwareDigitalCardService
{
    public function __construct(
        private EntitlementService $entitlementService,
        private UsageTracker $usageTracker,
        private DigitalCardRepository $cardRepository,
    ) {}

    /**
     * Issue a digital card with subscription entitlement check
     * 
     * IMPORTANT: This is where the two contexts meet.
     * - DigitalCard context owns the card logic
     * - Subscription context governs what's allowed
     */
    public function issueCard(
        TenantId $tenantId,
        MemberId $memberId,
        string $template,
    ): DigitalCard {
        // 1. Check if tenant has entitlement
        if (!$this->entitlementService->canAccess($tenantId, 'digital_cards')) {
            throw DigitalCardException::noEntitlement($tenantId);
        }

        // 2. Check quota
        if (!$this->usageTracker->canIssueMore($tenantId)) {
            throw DigitalCardException::quotaExceeded($tenantId);
        }

        // 3. Create the card (domain logic)
        $card = DigitalCard::issue(
            CardId::generate(),
            $tenantId,
            $memberId,
            $template,
        );

        // 4. Persist
        $this->cardRepository->save($card);

        // 5. Track usage
        $this->usageTracker->trackCardIssued($tenantId, $card->id());

        // 6. Dispatch domain events
        $this->publishEvents($card->flushDomainEvents());

        return $card;
    }

    /**
     * Check if template is available based on entitlements
     */
    public function getAvailableTemplates(TenantId $tenantId): array
    {
        $templates = [
            'basic' => 'Basic Template',
            'professional' => 'Professional Template',
            'premium' => 'Premium Template with AI Design',
            'custom' => 'Custom Design',
        ];

        // Filter templates based on subscription plan
        return collect($templates)
            ->filter(fn($name, $slug) => 
                $this->entitlementService->canAccess(
                    $tenantId, 
                    "digital_card_template_{$slug}"
                )
            )
            ->toArray();
    }
}
```

### **4.2 Event-Driven Synchronization**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\EventSubscribers;

use App\Contexts\Subscription\Domain\Events\{
    SubscriptionCreated,
    SubscriptionCancelled,
    SubscriptionDowngraded,
};

// Listens to subscription events and handles DigitalCard cleanup
final class SubscriptionEventSubscriber
{
    public function handle(SubscriptionCancelled $event): void
    {
        // When subscription is cancelled, revoke all active cards
        $cards = $this->cardRepository
            ->forTenant($event->tenantId())
            ->active()
            ->get();

        foreach ($cards as $card) {
            $card->revoke('Subscription cancelled');
            $this->cardRepository->save($card);
        }

        // Publish event: cards revoked due to subscription cancellation
        event(new CardsRevokedDueToSubscriptionCancellation(
            tenantId: $event->tenantId(),
            subscriptionId: $event->subscriptionId(),
            revokedCards: count($cards),
        ));
    }

    public function handle(SubscriptionDowngraded $event): void
    {
        // When subscription downgraded, may need to reduce quotas
        // E.g., Basic plan only allows 100 cards, Pro has 1000
        
        $usage = $this->usageTracker->currentMonthUsage($event->tenantId());
        $newQuota = $event->newPlan()->getQuotaFor('digital_cards');

        if ($usage->cardsIssued > $newQuota) {
            // Log violation
            ViolationLogger::log(ViolationEvent::QUOTA_EXCEEDED_AFTER_DOWNGRADE, [
                'tenant_id' => $event->tenantId(),
                'cards_issued' => $usage->cardsIssued,
                'new_quota' => $newQuota,
            ]);

            // Could: revoke oldest cards, or just warn
        }
    }
}
```

---

## **SECTION 5: APPLICATION LAYER**

### **5.1 Use Cases**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\UseCases;

// USE CASE: Issue Digital Card
final class IssueDigitalCardUseCase
{
    public function __construct(
        private DigitalCardRepository $cardRepository,
        private EntitlementService $entitlementService,
        private UsageTracker $usageTracker,
        private EventPublisher $eventPublisher,
    ) {}

    public function execute(IssueCardCommand $command): IssuedCardResponse
    {
        // Validate entitlements
        if (!$this->entitlementService->canAccess(
            $command->tenantId,
            'digital_cards'
        )) {
            throw new NoDigitalCardEntitlementException();
        }

        // Check quota
        if (!$this->usageTracker->canIssueMore($command->tenantId)) {
            throw new QuotaExceededException(
                'Digital card quota exceeded for this month'
            );
        }

        // Create card
        $card = DigitalCard::issue(
            CardId::generate(),
            $command->tenantId,
            $command->memberId,
            $command->templateSlug,
        );

        // Persist
        $this->cardRepository->save($card);

        // Track usage
        $this->usageTracker->trackCardIssued(
            $command->tenantId,
            $card->id()
        );

        // Publish domain events
        foreach ($card->flushDomainEvents() as $event) {
            $this->eventPublisher->publish($event);
        }

        // Return DTO
        return new IssuedCardResponse(
            cardId: $card->id()->value,
            memberId: $card->memberId()->value,
            qrCode: $card->qrCode()->encoded(),
            status: $card->status()->value,
        );
    }
}

// DTO: Issue Card Command
final readonly class IssueCardCommand
{
    public function __construct(
        public string $tenantId,
        public string $memberId,
        public string $templateSlug = 'basic',
    ) {}
}

// DTO: Response
final readonly class IssuedCardResponse
{
    public function __construct(
        public string $cardId,
        public string $memberId,
        public string $qrCode,
        public string $status,
    ) {}
}
```

### **5.2 Subscription Application Services**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Application\Services;

use App\Contexts\Subscription\Domain\Repositories\{
    PlanRepository,
    SubscriptionRepository,
    EntitlementSetRepository,
};

// High-level subscription service
final class SubscriptionApplicationService
{
    public function __construct(
        private PlanRepository $planRepository,
        private SubscriptionRepository $subscriptionRepository,
        private EntitlementSetRepository $entitlementSetRepository,
        private EventPublisher $eventPublisher,
    ) {}

    /**
     * Subscribe a tenant to a plan
     */
    public function subscribe(
        TenantId $tenantId,
        string $planSlug,
        SubscriptionDuration $billingCycle,
    ): SubscriptionResponse {
        // Get plan
        $plan = $this->planRepository->bySlug($planSlug);
        if (!$plan) {
            throw PlanNotFoundException::bySlug($planSlug);
        }

        // Create subscription
        $subscription = Subscription::create(
            SubscriptionId::generate(),
            $tenantId,
            $plan->id(),
            $billingCycle,
        );

        // Create entitlements from plan
        $entitlements = EntitlementSet::fromSubscription(
            EntitlementSetId::generate(),
            $tenantId,
            $subscription,
            $plan,
        );

        // Persist
        $this->subscriptionRepository->save($subscription);
        $this->entitlementSetRepository->save($entitlements);

        // Publish events
        foreach ($subscription->flushDomainEvents() as $event) {
            $this->eventPublisher->publish($event);
        }

        return new SubscriptionResponse(
            subscriptionId: $subscription->id()->value,
            planSlug: $plan->slug(),
            planName: $plan->name()->value,
            status: $subscription->status()->value,
            expiresAt: $subscription->expiresAt(),
        );
    }

    /**
     * Check if tenant can access a feature
     */
    public function canAccess(TenantId $tenantId, string $feature): bool
    {
        $entitlements = $this->entitlementSetRepository
            ->currentForTenant($tenantId);

        if (!$entitlements || !$entitlements->isValid()) {
            return false;
        }

        return $entitlements->hasFeature($feature);
    }
}
```

---

## **SECTION 6: SUBSCRIPTION PLAN DEFINITION SYSTEM**

### **6.1 Plan Configuration (YAML)**

```yaml
# config/subscriptions/plans.yaml

plans:
  starter:
    name: "Starter"
    description: "Perfect for getting started"
    icon: "rocket"
    
    pricing:
      monthly:
        currency: "USD"
        amount: 2900          # $29.00
      annual:
        currency: "USD"
        amount: 29000         # $290.00 (saves $58)
    
    features:
      - name: "digital_cards"
        display_name: "Digital Membership Cards"
        quota: 100            # 100 cards per month
      
      - name: "basic_templates"
        display_name: "Basic Card Templates"
        quota: null           # Unlimited
      
      - name: "qr_codes"
        display_name: "QR Code Generation"
        quota: null
    
    limits:
      team_members: 3
      api_keys: 1
      api_calls_per_month: 10000
    
    order: 1
    is_popular: false

  professional:
    name: "Professional"
    description: "For growing organizations"
    icon: "star"
    
    pricing:
      monthly:
        currency: "USD"
        amount: 7900          # $79.00
      annual:
        currency: "USD"
        amount: 79000         # $790.00 (saves $158)
    
    features:
      - name: "digital_cards"
        display_name: "Digital Membership Cards"
        quota: 1000           # 1000 cards per month
      
      - name: "basic_templates"
        display_name: "Basic Card Templates"
        quota: null
      
      - name: "advanced_templates"
        display_name: "Advanced Card Templates"
        quota: null
      
      - name: "qr_codes"
        display_name: "QR Code Generation"
        quota: null
      
      - name: "card_analytics"
        display_name: "Analytics Dashboard"
        quota: null
      
      - name: "bulk_generation"
        display_name: "Bulk Card Generation"
        quota: null
    
    limits:
      team_members: 15
      api_keys: 5
      api_calls_per_month: 100000
    
    order: 2
    is_popular: true

  enterprise:
    name: "Enterprise"
    description: "For large-scale operations"
    icon: "crown"
    
    pricing:
      monthly:
        currency: "USD"
        amount: 29900         # $299.00 (custom pricing available)
      annual:
        currency: "USD"
        amount: 299000        # $2,990.00
    
    features:
      - name: "digital_cards"
        display_name: "Digital Membership Cards"
        quota: null           # Unlimited
      
      - name: "basic_templates"
        display_name: "Basic Card Templates"
        quota: null
      
      - name: "advanced_templates"
        display_name: "Advanced Card Templates"
        quota: null
      
      - name: "custom_design"
        display_name: "Custom Card Design"
        quota: null
      
      - name: "qr_codes"
        display_name: "QR Code Generation"
        quota: null
      
      - name: "card_analytics"
        display_name: "Analytics Dashboard"
        quota: null
      
      - name: "bulk_generation"
        display_name: "Bulk Card Generation"
        quota: null
      
      - name: "api_access"
        display_name: "Full API Access"
        quota: null
      
      - name: "webhooks"
        display_name: "Webhook Integrations"
        quota: null
      
      - name: "sso"
        display_name: "Single Sign-On (SSO)"
        quota: null
      
      - name: "priority_support"
        display_name: "Priority Support"
        quota: null
    
    limits:
      team_members: null     # Unlimited
      api_keys: null         # Unlimited
      api_calls_per_month: null  # Unlimited
    
    order: 3
    is_popular: false
    note: "Custom pricing available for large deployments"

upgrade_paths:
  starter:
    - professional
    - enterprise
  
  professional:
    - enterprise

addon_services:
  custom_design:
    name: "Custom Card Design"
    price: 49900            # $499.00 one-time
    billing_model: "one_time"
  
  dedicated_support:
    name: "Dedicated Support"
    price: 99900            # $999.00 per month
    billing_model: "monthly"
```

### **6.2 Plan Loader Service**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Infrastructure\Services;

use App\Contexts\Subscription\Domain\Entities\Plan;
use Symfony\Component\Yaml\Yaml;

final class PlanLoaderFromYAML
{
    public function loadPlans(): array
    {
        $yaml = Yaml::parseFile(config_path('subscriptions/plans.yaml'));
        $plans = [];

        foreach ($yaml['plans'] as $slug => $planConfig) {
            $plans[] = $this->createPlan($slug, $planConfig);
        }

        return $plans;
    }

    private function createPlan(string $slug, array $config): Plan
    {
        $features = array_map(
            fn($feature) => new Feature(
                name: $feature['name'],
                displayName: $feature['display_name'],
                description: $feature['display_name'],
                defaultQuota: $feature['quota'] ?? null,
            ),
            $config['features']
        );

        $quotas = [];
        foreach ($config['features'] as $feature) {
            if ($feature['quota'] !== null) {
                $quotas[$feature['name']] = $feature['quota'];
            }
        }
        $quotas = array_merge($quotas, $config['limits']);

        return Plan::create(
            id: PlanId::generate(),
            name: new PlanName($config['name']),
            slug: $slug,
            monthlyPrice: Price::fromCents(
                $config['pricing']['monthly']['amount'],
                $config['pricing']['monthly']['currency']
            ),
            annualPrice: Price::fromCents(
                $config['pricing']['annual']['amount'],
                $config['pricing']['annual']['currency']
            ),
            features: $features,
            quotas: $quotas,
            maxTeamMembers: $config['limits']['team_members'] ?? 999999,
            maxApiKeys: $config['limits']['api_keys'] ?? 999999,
        );
    }
}
```

---

## **SECTION 7: MODULE MARKETPLACE (Powered by Subscriptions)**

### **7.1 Module as Subscription Feature**

```
ARCHITECTURE SHIFT:

Before:  Modules → Independent installation → Feature flags
After:   Subscription Plans → Include modules/features → Quotas + Billing

Example:
  Professional Plan includes:
    ✓ Digital Cards (1000/month)
    ✓ Advanced Templates (unlimited)
    ✓ Basic Forum (unlimited)
    ✗ Enterprise Analytics (not included - available in Enterprise plan)
```

### **7.2 Module Definition (Still YAML, but referenced by plans)**

```yaml
# config/subscriptions/modules.yaml

modules:
  digital_cards:
    name: "Digital Membership Cards"
    description: "Create and manage digital member cards with QR codes"
    category: "membership"
    icon: "credit-card"
    
    # This module is available in these plans
    available_in_plans:
      - starter
      - professional
      - enterprise
    
    # Different configurations per plan
    plan_configs:
      starter:
        quota: 100
        features:
          - basic_qr
          - basic_templates
        max_template_customization: 0    # No customization
      
      professional:
        quota: 1000
        features:
          - basic_qr
          - advanced_qr
          - advanced_templates
          - bulk_generation
        max_template_customization: 5
      
      enterprise:
        quota: null                       # Unlimited
        features:
          - all
        max_template_customization: null  # Unlimited

  forum:
    name: "Community Forum"
    description: "Create discussion forums for your members"
    category: "community"
    icon: "message-circle"
    
    available_in_plans:
      - professional
      - enterprise
    
    plan_configs:
      professional:
        quota: null
        features:
          - threads
          - posts
          - basic_moderation
      
      enterprise:
        quota: null
        features:
          - all
          - advanced_moderation
          - webhooks

  advanced_analytics:
    name: "Advanced Analytics"
    description: "In-depth analytics and reporting"
    category: "analytics"
    icon: "chart-bar"
    
    available_in_plans:
      - professional
      - enterprise
    
    plan_configs:
      professional:
        quota: null
        features:
          - basic_dashboards
          - export_csv
      
      enterprise:
        quota: null
        features:
          - all
          - real_time_dashboards
          - api_access
```

### **7.3 Module Installation Driven by Subscriptions**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Application\Services;

// When subscription is created, auto-install modules based on plan
final class SubscriptionModuleInstaller
{
    public function installModulesForSubscription(
        Subscription $subscription,
        Plan $plan,
    ): void {
        $modulesForPlan = $this->getModulesForPlan($plan->slug());

        foreach ($modulesForPlan as $moduleSlug => $moduleConfig) {
            // Install module with config from this plan
            $this->moduleInstaller->install(
                tenantId: $subscription->tenantId(),
                moduleSlug: $moduleSlug,
                config: $moduleConfig,
            );

            // Link to subscription for tracking
            $this->linkModuleToSubscription(
                subscriptionId: $subscription->id(),
                moduleSlug: $moduleSlug,
            );
        }
    }

    public function uninstallModulesForSubscription(
        Subscription $subscription,
        Plan $oldPlan,
        Plan $newPlan,
    ): void {
        $oldModules = $this->getModulesForPlan($oldPlan->slug());
        $newModules = $this->getModulesForPlan($newPlan->slug());

        // Modules that were available but are no longer
        $toRemove = array_diff_key($oldModules, $newModules);

        foreach (array_keys($toRemove) as $moduleSlug) {
            // Uninstall module
            $this->moduleInstaller->uninstall(
                tenantId: $subscription->tenantId(),
                moduleSlug: $moduleSlug,
            );

            // Dispatch event for cleanup
            event(new ModuleRemovedDueToDowngrade(
                tenantId: $subscription->tenantId(),
                moduleSlug: $moduleSlug,
                fromPlan: $oldPlan->slug(),
                toPlan: $newPlan->slug(),
            ));
        }
    }
}
```

---

## **SECTION 8: IMPLEMENTATION ROADMAP**

### **8.1 Phase 1: Subscription Core (Weeks 1-2)**

**Deliverables:**
- ✓ Plan YAML configuration system
- ✓ Subscription domain entities (Plan, Subscription, Entitlements)
- ✓ Subscription repository implementations
- ✓ Plan loader service
- ✓ Basic subscription creation use case
- ✓ Database schema (plans, subscriptions, entitlements)
- ✓ TDD: All tests passing, 90%+ coverage

**Key Tests:**
```php
test_create_subscription_from_plan()
test_subscription_status_transitions()
test_entitlements_created_from_plan_features()
test_quota_enforcement()
test_subscription_expiration_detection()
```

### **8.2 Phase 2: DigitalCard Integration (Weeks 3-4)**

**Deliverables:**
- ✓ DigitalCard context with domain entities
- ✓ Anti-corruption layer (SubscriptionAwareDigitalCardService)
- ✓ Entitlement checks before card issuance
- ✓ Usage tracking and quota enforcement
- ✓ Domain events (CardIssued, CardRevoked, etc.)
- ✓ Integration tests with Subscription context

**Key Tests:**
```php
test_can_only_issue_card_if_entitled()
test_quota_exceeded_prevents_card_issuance()
test_card_revoked_when_subscription_cancelled()
test_usage_tracking_increments()
test_available_templates_based_on_entitlements()
```

### **8.3 Phase 3: Subscription Lifecycle & Events (Weeks 5-6)**

**Deliverables:**
- ✓ Subscription upgrade/downgrade
- ✓ Subscription renewal flows
- ✓ Domain events published for all state changes
- ✓ Event subscribers for cross-context coordination
- ✓ Billing event hooks (for payment system)
- ✓ Usage statistics aggregation

**Key Tests:**
```php
test_upgrade_subscription()
test_downgrade_reduces_quotas()
test_subscription_renewal()
test_subscription_cancellation_revokes_resources()
test_events_published_for_all_state_changes()
```

### **8.4 Phase 4: Module Marketplace (Weeks 7-8)**

**Deliverables:**
- ✓ Module YAML configuration
- ✓ Subscription-driven module installation
- ✓ Module uninstall on downgrade
- ✓ Vue3 marketplace UI
- ✓ Module recommendations engine
- ✓ Usage analytics dashboard

**Key Tests:**
```php
test_modules_installed_for_plan()
test_modules_uninstalled_on_downgrade()
test_module_recommendations_based_on_plan()
```

---

## **SECTION 9: KEY ARCHITECTURAL DECISIONS**

### **Decision 1: Subscription Context as Primary Governor**

**Status:** ✅ APPROVED

**Rationale:**
- Subscriptions are the business model
- All feature access flows through subscriptions
- Decouples module installation from monetization
- Enables multi-tier offerings

**Consequences:**
- Every module must check subscription entitlements
- Anti-corruption layers required
- Events coordinate across contexts

---

### **Decision 2: Plans as YAML Configuration**

**Status:** ✅ APPROVED

**Rationale:**
- Easy to modify without code deployment
- Git-tracked for audit
- Developer-friendly
- Version controlled

**Alternative:** Database (rejected - harder to version control)

---

### **Decision 3: DDD Bounded Contexts**

**Status:** ✅ APPROVED

**Rationale:**
- Clear separation of concerns
- Subscription context governs access
- DigitalCard context owns card logic
- Other modules follow same pattern

**Consequences:**
- More service classes needed
- Anti-corruption layers required
- Event-driven coordination

---

### **Decision 4: Event-Driven Architecture**

**Status:** ✅ APPROVED

**Rationale:**
- Loose coupling between contexts
- Audit trail of all state changes
- Enables undo/rollback capabilities
- Real-time analytics

---

## **SECTION 10: SCALABILITY & PERFORMANCE**

### **10.1 Database Optimization**

```sql
-- Materialized View for fast entitlement checks
CREATE MATERIALIZED VIEW tenant_active_entitlements AS
SELECT 
    e.tenant_id,
    e.feature_name,
    e.quota,
    e.valid_until
FROM entitlements e
JOIN entitlement_sets es ON e.entitlement_set_id = es.id
JOIN subscriptions s ON es.subscription_id = s.id
WHERE e.is_active = true
    AND e.valid_until > NOW()
    AND s.status = 'active';

-- Index for fast lookups
CREATE INDEX idx_tenant_entitlements ON tenant_active_entitlements (tenant_id, feature_name);

-- Refresh daily (or on subscription changes)
REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_active_entitlements;
```

### **10.2 Caching Strategy**

```php
<?php
namespace App\Contexts\Subscription\Infrastructure\Services;

class CachedEntitlementService
{
    private const CACHE_TTL = 300; // 5 minutes

    public function canAccess(TenantId $tenantId, string $feature): bool
    {
        return cache()->remember(
            "entitlements:{$tenantId}:{$feature}",
            self::CACHE_TTL,
            fn() => $this->checkEntitlementInDatabase($tenantId, $feature)
        );
    }

    public function invalidateCache(TenantId $tenantId): void
    {
        cache()->forget("entitlements:{$tenantId}:*");
    }
}
```

### **10.3 Tenant Isolation**

```sql
-- Explicit tenant column on all subscription tables
ALTER TABLE subscriptions ADD COLUMN tenant_id UUID NOT NULL;
ALTER TABLE entitlements ADD COLUMN tenant_id UUID NOT NULL;

-- Row-Level Security
CREATE POLICY subscription_tenant_isolation ON subscriptions
    USING (tenant_id = current_tenant_id());

CREATE POLICY entitlement_tenant_isolation ON entitlements
    USING (tenant_id = current_tenant_id());
```

---

## **SECTION 11: SUCCESS METRICS**

### **11.1 Architectural Quality**

- ✓ 90%+ test coverage (both domains)
- ✓ PHPStan Level 8 compliance
- ✓ Zero tight coupling between contexts
- ✓ All domain logic in entities, not services

### **11.2 Business Metrics**

- ✓ Subscription creation: < 200ms P95
- ✓ Entitlement checks: < 10ms P95 (cached)
- ✓ Card issuance: < 150ms P95
- ✓ Support 1000+ concurrent subscriptions
- ✓ Quota enforcement with zero false negatives

### **11.3 Developer Experience**

- ✓ New module integration in < 1 hour
- ✓ Adding new plan takes 5 minutes (YAML)
- ✓ Clear patterns for business logic
- ✓ Comprehensive test examples

---

## **SECTION 12: CRITICAL DIFFERENCES FROM BRAINSTORMING**

| Aspect | Brainstorming | Architecture |
|--------|---|---|
| Module system | Independent modules | Driven by subscriptions |
| Feature gates | Simple flags | Entitlements from plans |
| DigitalCard positioning | Standalone module | Subscription feature |
| Business model | Not modeled | Core (plans, pricing, tiers) |
| Quota enforcement | Mentioned not detailed | Explicit, enforced at API |
| Billing | No hooks | SubscriptionCreated events |
| Event-driven | Mentioned | Comprehensive with events |
| DDD modeling | Not applied | Full aggregate roots, VOs |
| Multi-tenancy | Implicit | Explicit on all entities |
| Scalability | Vague | Detailed (materialized views, caching) |

---

## **FINAL ARCHITECTURAL DIAGRAM**

```
┌──────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT PLATFORM                     │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
    ┌─────────────┐   ┌──────────────────┐   ┌──────────────┐
    │SUBSCRIPTION │   │  DIGITALCARD     │   │    FORUM     │
    │  CONTEXT    │   │    CONTEXT       │   │   CONTEXT    │
    │             │   │                  │   │              │
    │ • Plans     │   │ • Cards          │   │ • Threads    │
    │ • Subscript │   │ • Templates      │   │ • Posts      │
    │ • Entitle   │   │ • QR Codes       │   │ • Mods       │
    │ • Quotas    │   │ • Usage          │   │              │
    │ • Revenue   │   │ • Validation     │   │ (Same ACL    │
    │             │   │                  │   │  Pattern)    │
    └─────────────┘   └──────────────────┘   └──────────────┘
            ▲                 │
            │                 │ ACL
            │                 │ (Entitlement
            │                 │  checks)
            └─────────────────┘
        Event-Driven
        Coordination
```

---

## **NEXT STEPS**

1. **Review & Approve** this architecture with stakeholders
2. **Start Phase 1:** Subscription core with Plan YAML system
3. **Use TDD** for all implementation
4. **DDD patterns** applied strictly
5. **Integration tests** for context coordination

---

**Status:** ✅ PRODUCTION READY FOR IMPLEMENTATION

**Recommendation:** Begin Phase 1 immediately with DigitalCardContext prompt

