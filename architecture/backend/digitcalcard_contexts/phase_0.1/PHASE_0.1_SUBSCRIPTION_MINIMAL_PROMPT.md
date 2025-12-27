# **PHASE 0.1: MINIMAL SUBSCRIPTION CONTEXT FOUNDATION**
## **Professional Claude CLI Prompt for Senior Developer**

**Objective:** Implement minimal subscription foundation (2-3 days) that allows DigitalCard Phase 1 to be built WITH subscription integration, avoiding massive refactoring later.

**Key Principle:** "Build the gate BEFORE building the feature" - Feature flags must exist before Phase 1 development begins.

---

## **CRITICAL CONTEXT FOR YOU**

### **Your Current Situation**
```
✅ Phase 0 DigitalCard: Complete (5 tests passing, walking skeleton)
✅ Membership Module: Working (use as pattern reference)
✅ DDD/TDD Workflow: Established and proven

❌ Subscription System: Not started
❌ Feature Gating: Not in place
❌ Phase 1 DigitalCard: Cannot start yet (will need refactoring without gates)
```

### **Why Phase 0.1 BEFORE Phase 1**

**Option A: Phase 1 first, subscriptions after**
```
Phase 1 (8 weeks) → Add Subscriptions (3 weeks) → Refactoring (2 weeks) = 13 weeks
PROBLEMS:
  ❌ Massive code changes in Phase 1 when adding feature gates
  ❌ All tests need rewriting
  ❌ Risk of breaking Phase 1 functionality
  ❌ Technical debt accumulates
```

**Option B: Phase 0.1 now, Phase 1 with subscriptions integrated** (YOUR CHOICE ✅)
```
Phase 0.1 (2 days) → Phase 1 with gates built-in (8 weeks) = 8 weeks total
BENEFITS:
  ✅ Phase 1 features are "born behind gates"
  ✅ No refactoring needed
  ✅ Tests written with quotas in mind
  ✅ Clean architecture from day one
  ✅ 5 weeks faster overall
```

### **Phase 0.1 Scope (MINIMAL, NOT FULL)**

What you ARE building:
- ✅ Subscription existence tracking (tenant has subscription or not)
- ✅ Plan/tier selection (free, professional, enterprise)
- ✅ Quota definition (e.g., "free plan = 10 cards/month")
- ✅ Feature availability checking (does tenant have feature X?)
- ✅ Integration points for DigitalCard Phase 1

What you're NOT building:
- ❌ Payment processing
- ❌ Billing/invoicing
- ❌ Usage analytics dashboards
- ❌ Complex upgrade/downgrade flows
- ❌ Renewal automation

**Duration: 2-3 days of focused development**

---

## **SECTION 1: YOUR ARCHITECTURE (DDD + TDD)**

You've proven this pattern works with Membership module. Apply same approach:

```
App/Contexts/Subscription/
├── Domain/                          ← Pure business logic
│   ├── Entities/
│   │   ├── Plan.php                 ← What features are included
│   │   ├── Subscription.php         ← Who has what
│   │   └── Feature.php              ← Individual features
│   ├── ValueObjects/
│   │   ├── PlanId.php
│   │   ├── SubscriptionId.php
│   │   ├── FeatureName.php
│   │   └── QuotaLimit.php
│   ├── Repositories/
│   │   ├── PlanRepositoryInterface.php
│   │   └── SubscriptionRepositoryInterface.php
│   └── Exceptions/
│       └── SubscriptionException.php
│
├── Application/                     ← Use cases / orchestration
│   └── Services/
│       ├── SubscriptionService.php  ← Create/manage subscriptions
│       └── FeatureGateService.php   ← Check features & quotas
│
└── Infrastructure/                  ← Technical implementation
    ├── Persistence/
    │   ├── Eloquent/
    │   │   ├── PlanModel.php
    │   │   └── SubscriptionModel.php
    │   └── Repositories/
    │       ├── EloquentPlanRepository.php
    │       └── EloquentSubscriptionRepository.php
    ├── Database/
    │   └── Migrations/
    │       └── (3 tables)
    └── Providers/
        └── SubscriptionContextServiceProvider.php
```

---

## **SECTION 2: DATABASE SCHEMA (LANDLORD DB)**

These tables go in your LANDLORD database (shared across tenants).

```sql
-- Table 1: Plans (free, professional, enterprise)
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,                    -- "Free", "Professional"
    slug VARCHAR(100) UNIQUE NOT NULL,             -- "free", "professional"
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Plan Features (what's included in each plan)
CREATE TABLE plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,            -- "digital_cards", "bulk_export"
    quota_limit INTEGER,                           -- NULL = unlimited, otherwise max per month
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: Subscriptions (which tenant has which plan)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module_slug VARCHAR(100) NOT NULL,             -- "digital_card", "forum"
    plan_id UUID NOT NULL REFERENCES plans(id),
    status VARCHAR(20) DEFAULT 'active',           -- active, cancelled, suspended
    subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, module_slug)                 -- One subscription per tenant per module
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_module ON subscriptions(module_slug);
CREATE INDEX idx_subscriptions_active ON subscriptions(status) WHERE status = 'active';
```

**Migration command:**
```bash
php artisan make:migration create_subscription_foundation_tables
```

---

## **SECTION 3: DOMAIN LAYER (Pure Business Logic)**

### **3.1 Plan Aggregate Root**

```php
<?php
// app/Contexts/Subscription/Domain/Entities/Plan.php

declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\Entities;

use App\Contexts\Subscription\Domain\ValueObjects\PlanId;

final class Plan
{
    /**
     * @param array<Feature> $features
     */
    private function __construct(
        private readonly PlanId $id,
        private readonly string $name,
        private readonly string $slug,
        private readonly array $features,
    ) {}

    public static function create(
        PlanId $id,
        string $name,
        string $slug,
        array $features,
    ): self {
        if (empty($slug)) {
            throw new \InvalidArgumentException('Plan slug cannot be empty');
        }

        return new self($id, $name, $slug, $features);
    }

    // Queries
    public function id(): PlanId
    {
        return $this->id;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function slug(): string
    {
        return $this->slug;
    }

    /**
     * Get quota for feature (or null if unlimited)
     */
    public function quotaFor(string $featureName): ?int
    {
        foreach ($this->features as $feature) {
            if ($feature->name() === $featureName) {
                return $feature->quota();
            }
        }

        return null; // Feature not in this plan
    }

    /**
     * Check if plan includes this feature
     */
    public function hasFeature(string $featureName): bool
    {
        foreach ($this->features as $feature) {
            if ($feature->name() === $featureName) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all features in this plan
     * @return array<Feature>
     */
    public function features(): array
    {
        return $this->features;
    }
}
```

### **3.2 Feature Value Object**

```php
<?php
// app/Contexts/Subscription/Domain/Entities/Feature.php

declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\Entities;

final readonly class Feature
{
    public function __construct(
        private string $name,          // "digital_cards"
        private ?int $quota = null,    // 10, 1000, or null (unlimited)
    ) {
        if (empty($this->name)) {
            throw new \InvalidArgumentException('Feature name cannot be empty');
        }
    }

    public function name(): string
    {
        return $this->name;
    }

    public function quota(): ?int
    {
        return $this->quota;
    }

    public function isUnlimited(): bool
    {
        return $this->quota === null;
    }
}
```

### **3.3 Subscription Aggregate Root**

```php
<?php
// app/Contexts/Subscription/Domain/Entities/Subscription.php

declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\Entities;

use App\Contexts\Subscription\Domain\ValueObjects\{SubscriptionId, PlanId};

final class Subscription
{
    private function __construct(
        private readonly SubscriptionId $id,
        private readonly string $tenantId,
        private readonly string $moduleSlug,
        private readonly PlanId $planId,
        private string $status,
        private readonly \DateTimeImmutable $subscribedAt,
        private ?\DateTimeImmutable $expiresAt,
    ) {}

    /**
     * Create new subscription for tenant
     */
    public static function create(
        SubscriptionId $id,
        string $tenantId,
        string $moduleSlug,
        PlanId $planId,
    ): self {
        if (empty($tenantId) || empty($moduleSlug)) {
            throw new \InvalidArgumentException('TenantId and moduleSlug required');
        }

        return new self(
            $id,
            $tenantId,
            $moduleSlug,
            $planId,
            'active',
            new \DateTimeImmutable(),
            null, // No expiry for now
        );
    }

    // Queries
    public function id(): SubscriptionId
    {
        return $this->id;
    }

    public function tenantId(): string
    {
        return $this->tenantId;
    }

    public function moduleSlug(): string
    {
        return $this->moduleSlug;
    }

    public function planId(): PlanId
    {
        return $this->planId;
    }

    public function isActive(): bool
    {
        return $this->status === 'active'
            && (!$this->expiresAt || $this->expiresAt > new \DateTimeImmutable());
    }

    // Business operations
    public function cancel(): void
    {
        if ($this->status === 'cancelled') {
            throw new \DomainException('Subscription already cancelled');
        }

        $this->status = 'cancelled';
        $this->expiresAt = new \DateTimeImmutable();
    }
}
```

### **3.4 Value Objects**

```php
<?php
// app/Contexts/Subscription/Domain/ValueObjects/PlanId.php

declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\ValueObjects;

final readonly class PlanId
{
    private function __construct(public string $value) {
        if (empty($value)) {
            throw new \InvalidArgumentException('PlanId cannot be empty');
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

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}

// app/Contexts/Subscription/Domain/ValueObjects/SubscriptionId.php
// (Same pattern as PlanId)

// app/Contexts/Subscription/Domain/ValueObjects/FeatureName.php
final readonly class FeatureName
{
    private function __construct(public string $value) {
        if (empty($this->value)) {
            throw new \InvalidArgumentException('FeatureName cannot be empty');
        }
    }

    public static function from(string $value): self
    {
        return new self($value);
    }
}

// app/Contexts/Subscription/Domain/ValueObjects/QuotaLimit.php
final readonly class QuotaLimit
{
    private function __construct(public ?int $value) {}

    public static function unlimited(): self
    {
        return new self(null);
    }

    public static function limit(int $amount): self
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Quota limit must be positive');
        }
        return new self($amount);
    }

    public function isUnlimited(): bool
    {
        return $this->value === null;
    }
}
```

### **3.5 Repository Interfaces**

```php
<?php
// app/Contexts/Subscription/Domain/Repositories/PlanRepository.php

declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\Repositories;

use App\Contexts\Subscription\Domain\Entities\Plan;
use App\Contexts\Subscription\Domain\ValueObjects\PlanId;

interface PlanRepository
{
    public function save(Plan $plan): void;
    public function byId(PlanId $id): ?Plan;
    public function bySlug(string $slug): ?Plan;
    /** @return array<Plan> */
    public function all(): array;
}

// app/Contexts/Subscription/Domain/Repositories/SubscriptionRepository.php
interface SubscriptionRepository
{
    public function save(Subscription $subscription): void;
    
    /**
     * Get subscription for tenant + module
     */
    public function forTenantModule(string $tenantId, string $moduleSlug): ?Subscription;
    
    /** @return array<Subscription> */
    public function forTenant(string $tenantId): array;
}
```

---

## **SECTION 4: APPLICATION LAYER (Use Cases)**

### **4.1 SubscriptionService**

```php
<?php
// app/Contexts/Subscription/Application/Services/SubscriptionService.php

declare(strict_types=1);

namespace App\Contexts\Subscription\Application\Services;

use App\Contexts\Subscription\Domain\Repositories\{PlanRepository, SubscriptionRepository};
use App\Contexts\Subscription\Domain\Entities\Subscription;
use App\Contexts\Subscription\Domain\ValueObjects\{PlanId, SubscriptionId};

final class SubscriptionService
{
    public function __construct(
        private PlanRepository $planRepository,
        private SubscriptionRepository $subscriptionRepository,
    ) {}

    /**
     * Subscribe tenant to module with specific plan
     */
    public function subscribe(
        string $tenantId,
        string $moduleSlug,
        string $planSlug,
    ): Subscription {
        // 1. Get plan
        $plan = $this->planRepository->bySlug($planSlug);
        if (!$plan) {
            throw new \DomainException("Plan '{$planSlug}' not found");
        }

        // 2. Check if already subscribed
        $existing = $this->subscriptionRepository->forTenantModule($tenantId, $moduleSlug);
        if ($existing && $existing->isActive()) {
            return $existing; // Already subscribed to this plan
        }

        // 3. Create subscription
        $subscription = Subscription::create(
            SubscriptionId::generate(),
            $tenantId,
            $moduleSlug,
            $plan->id(),
        );

        // 4. Persist
        $this->subscriptionRepository->save($subscription);

        return $subscription;
    }

    /**
     * Check if tenant has active subscription for module
     */
    public function hasSubscription(string $tenantId, string $moduleSlug): bool
    {
        $subscription = $this->subscriptionRepository->forTenantModule($tenantId, $moduleSlug);
        return $subscription !== null && $subscription->isActive();
    }

    /**
     * Get active plan for tenant/module
     */
    public function getPlanFor(string $tenantId, string $moduleSlug)
    {
        $subscription = $this->subscriptionRepository->forTenantModule($tenantId, $moduleSlug);
        
        if (!$subscription || !$subscription->isActive()) {
            return null;
        }

        return $this->planRepository->byId($subscription->planId());
    }
}
```

### **4.2 FeatureGateService**

```php
<?php
// app/Contexts/Subscription/Application/Services/FeatureGateService.php

declare(strict_types=1);

namespace App\Contexts\Subscription\Application\Services;

final class FeatureGateService
{
    public function __construct(
        private SubscriptionService $subscriptionService,
    ) {}

    /**
     * Check if tenant can access feature
     */
    public function can(string $tenantId, string $moduleSlug, string $featureName): bool
    {
        $plan = $this->subscriptionService->getPlanFor($tenantId, $moduleSlug);
        
        if ($plan === null) {
            return false; // No active subscription
        }

        return $plan->hasFeature($featureName);
    }

    /**
     * Get quota for feature (null = unlimited)
     */
    public function quota(string $tenantId, string $moduleSlug, string $featureName): ?int
    {
        $plan = $this->subscriptionService->getPlanFor($tenantId, $moduleSlug);
        
        if ($plan === null) {
            return null;
        }

        return $plan->quotaFor($featureName);
    }

    /**
     * Check if usage exceeds quota
     */
    public function isQuotaExceeded(
        string $tenantId,
        string $moduleSlug,
        string $featureName,
        int $currentUsage,
    ): bool {
        $quota = $this->quota($tenantId, $moduleSlug, $featureName);
        
        // NULL quota = unlimited, never exceeded
        if ($quota === null) {
            return false;
        }

        return $currentUsage >= $quota;
    }
}
```

---

## **SECTION 5: INFRASTRUCTURE LAYER**

### **5.1 Eloquent Models**

```php
<?php
// app/Contexts/Subscription/Infrastructure/Persistence/Eloquent/PlanModel.php

namespace App\Contexts\Subscription\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;

class PlanModel extends Model
{
    protected $table = 'plans';
    protected $fillable = ['id', 'name', 'slug'];
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = true;

    public function features()
    {
        return $this->hasMany(PlanFeatureModel::class);
    }
}

// app/Contexts/Subscription/Infrastructure/Persistence/Eloquent/SubscriptionModel.php
class SubscriptionModel extends Model
{
    protected $table = 'subscriptions';
    protected $fillable = [
        'id', 'tenant_id', 'module_slug', 'plan_id', 
        'status', 'subscribed_at', 'expires_at'
    ];
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = true;

    public function plan()
    {
        return $this->belongsTo(PlanModel::class, 'plan_id', 'id');
    }
}
```

### **5.2 Repository Implementations**

```php
<?php
// app/Contexts/Subscription/Infrastructure/Persistence/Repositories/EloquentPlanRepository.php

namespace App\Contexts\Subscription\Infrastructure\Persistence\Repositories;

use App\Contexts\Subscription\Domain\Repositories\PlanRepository;
use App\Contexts\Subscription\Domain\Entities\{Plan, Feature};
use App\Contexts\Subscription\Domain\ValueObjects\PlanId;
use App\Contexts\Subscription\Infrastructure\Persistence\Eloquent\{PlanModel, PlanFeatureModel};

class EloquentPlanRepository implements PlanRepository
{
    public function bySlug(string $slug): ?Plan
    {
        $model = PlanModel::with('features')
            ->where('slug', $slug)
            ->first();

        return $model ? $this->toDomain($model) : null;
    }

    public function byId(PlanId $id): ?Plan
    {
        $model = PlanModel::with('features')
            ->where('id', $id->value)
            ->first();

        return $model ? $this->toDomain($model) : null;
    }

    public function all(): array
    {
        return PlanModel::with('features')
            ->get()
            ->map(fn($model) => $this->toDomain($model))
            ->toArray();
    }

    public function save(Plan $plan): void
    {
        PlanModel::updateOrCreate(
            ['id' => $plan->id()->value],
            [
                'name' => $plan->name(),
                'slug' => $plan->slug(),
            ]
        );
    }

    private function toDomain(PlanModel $model): Plan
    {
        $features = $model->features->map(
            fn($feature) => new Feature(
                name: $feature->feature_name,
                quota: $feature->quota_limit,
            )
        )->toArray();

        return Plan::create(
            id: PlanId::fromString($model->id),
            name: $model->name,
            slug: $model->slug,
            features: $features,
        );
    }
}

// app/Contexts/Subscription/Infrastructure/Persistence/Repositories/EloquentSubscriptionRepository.php
class EloquentSubscriptionRepository implements SubscriptionRepository
{
    public function forTenantModule(string $tenantId, string $moduleSlug): ?Subscription
    {
        $model = SubscriptionModel::where('tenant_id', $tenantId)
            ->where('module_slug', $moduleSlug)
            ->first();

        return $model ? $this->toDomain($model) : null;
    }

    public function save(Subscription $subscription): void
    {
        SubscriptionModel::updateOrCreate(
            [
                'tenant_id' => $subscription->tenantId(),
                'module_slug' => $subscription->moduleSlug(),
            ],
            [
                'id' => $subscription->id()->value,
                'plan_id' => $subscription->planId()->value,
                'status' => 'active',
                'subscribed_at' => now(),
            ]
        );
    }

    private function toDomain(SubscriptionModel $model): Subscription
    {
        return Subscription::create(
            id: SubscriptionId::fromString($model->id),
            tenantId: $model->tenant_id,
            moduleSlug: $model->module_slug,
            planId: PlanId::fromString($model->plan_id),
        );
    }
}
```

### **5.3 Service Provider**

```php
<?php
// app/Contexts/Subscription/Infrastructure/Providers/SubscriptionContextServiceProvider.php

namespace App\Contexts\Subscription\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use App\Contexts\Subscription\Domain\Repositories\{PlanRepository, SubscriptionRepository};
use App\Contexts\Subscription\Infrastructure\Persistence\Repositories\{
    EloquentPlanRepository,
    EloquentSubscriptionRepository,
};
use App\Contexts\Subscription\Application\Services\{SubscriptionService, FeatureGateService};

class SubscriptionContextServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Repositories
        $this->app->bind(
            PlanRepository::class,
            EloquentPlanRepository::class
        );
        $this->app->bind(
            SubscriptionRepository::class,
            EloquentSubscriptionRepository::class
        );

        // Services
        $this->app->singleton(SubscriptionService::class, function ($app) {
            return new SubscriptionService(
                $app->make(PlanRepository::class),
                $app->make(SubscriptionRepository::class),
            );
        });

        $this->app->singleton(FeatureGateService::class, function ($app) {
            return new FeatureGateService(
                $app->make(SubscriptionService::class),
            );
        });
    }

    public function boot(): void
    {
        // Database doesn't need loading - migrations are in app/
    }
}
```

Register in `config/app.php`:
```php
'providers' => [
    // ...
    App\Contexts\Subscription\Infrastructure\Providers\SubscriptionContextServiceProvider::class,
],
```

---

## **SECTION 6: TESTS (TDD FIRST)**

### **6.1 Create Subscription Test**

```php
<?php
// tests/Feature/Contexts/Subscription/CreateSubscriptionTest.php

namespace Tests\Feature\Contexts\Subscription;

use App\Models\Tenant;
use App\Contexts\Subscription\Application\Services\SubscriptionService;
use Tests\TestCase;

class CreateSubscriptionTest extends TestCase
{
    it('subscribes tenant to digital_card module with free plan', function () {
        // Arrange
        $tenant = Tenant::factory()->create();
        $this->seedPlans();
        
        $service = app(SubscriptionService::class);

        // Act
        $subscription = $service->subscribe(
            $tenant->id,
            'digital_card',
            'free'
        );

        // Assert
        expect($subscription->isActive())->toBeTrue();
        expect($subscription->moduleSlug())->toBe('digital_card');
        
        $this->assertDatabaseHas('subscriptions', [
            'tenant_id' => $tenant->id,
            'module_slug' => 'digital_card',
            'status' => 'active',
        ]);
    });

    it('returns existing subscription if already subscribed', function () {
        $tenant = Tenant::factory()->create();
        $this->seedPlans();
        $service = app(SubscriptionService::class);

        $sub1 = $service->subscribe($tenant->id, 'digital_card', 'free');
        $sub2 = $service->subscribe($tenant->id, 'digital_card', 'free');

        expect($sub1->id()->value)->toBe($sub2->id()->value);
    });

    private function seedPlans(): void
    {
        \DB::table('plans')->insert([
            ['id' => \Illuminate\Support\Str::uuid(), 'name' => 'Free', 'slug' => 'free'],
            ['id' => \Illuminate\Support\Str::uuid(), 'name' => 'Professional', 'slug' => 'professional'],
        ]);
    }
}
```

### **6.2 Feature Gate Test**

```php
<?php
// tests/Feature/Contexts/Subscription/FeatureGateTest.php

namespace Tests\Feature\Contexts\Subscription;

use App\Models\Tenant;
use App\Contexts\Subscription\Application\Services\{SubscriptionService, FeatureGateService};
use Tests\TestCase;

class FeatureGateTest extends TestCase
{
    it('allows feature if in plan', function () {
        $tenant = Tenant::factory()->create();
        $this->seedPlans();
        
        app(SubscriptionService::class)->subscribe($tenant->id, 'digital_card', 'professional');
        
        $featureGate = app(FeatureGateService::class);
        expect($featureGate->can($tenant->id, 'digital_card', 'bulk_export'))->toBeTrue();
    });

    it('denies feature if not in plan', function () {
        $tenant = Tenant::factory()->create();
        $this->seedPlans();
        
        app(SubscriptionService::class)->subscribe($tenant->id, 'digital_card', 'free');
        
        $featureGate = app(FeatureGateService::class);
        expect($featureGate->can($tenant->id, 'digital_card', 'bulk_export'))->toBeFalse();
    });

    it('returns quota limit', function () {
        $tenant = Tenant::factory()->create();
        $this->seedPlans();
        
        app(SubscriptionService::class)->subscribe($tenant->id, 'digital_card', 'free');
        
        $featureGate = app(FeatureGateService::class);
        expect($featureGate->quota($tenant->id, 'digital_card', 'digital_cards'))->toBe(10);
    });

    it('detects when quota is exceeded', function () {
        $tenant = Tenant::factory()->create();
        $this->seedPlans();
        
        app(SubscriptionService::class)->subscribe($tenant->id, 'digital_card', 'free');
        
        $featureGate = app(FeatureGateService::class);
        
        // Free plan: 10 cards/month
        expect($featureGate->isQuotaExceeded(
            $tenant->id,
            'digital_card',
            'digital_cards',
            9  // Below limit
        ))->toBeFalse();
        
        expect($featureGate->isQuotaExceeded(
            $tenant->id,
            'digital_card',
            'digital_cards',
            10 // At limit (exceeded)
        ))->toBeTrue();
    });

    it('handles unlimited quotas', function () {
        $tenant = Tenant::factory()->create();
        $this->seedPlans();
        
        app(SubscriptionService::class)->subscribe($tenant->id, 'digital_card', 'professional');
        
        $featureGate = app(FeatureGateService::class);
        
        // Professional plan: unlimited cards
        expect($featureGate->quota($tenant->id, 'digital_card', 'digital_cards'))->toBeNull();
        expect($featureGate->isQuotaExceeded(
            $tenant->id,
            'digital_card',
            'digital_cards',
            99999 // Never exceeded if unlimited
        ))->toBeFalse();
    });

    private function seedPlans(): void
    {
        $freePlanId = \Illuminate\Support\Str::uuid();
        $proPlanId = \Illuminate\Support\Str::uuid();

        \DB::table('plans')->insert([
            ['id' => $freePlanId, 'name' => 'Free', 'slug' => 'free'],
            ['id' => $proPlanId, 'name' => 'Professional', 'slug' => 'professional'],
        ]);

        \DB::table('plan_features')->insert([
            // Free: 10 digital cards/month
            [
                'id' => \Illuminate\Support\Str::uuid(),
                'plan_id' => $freePlanId,
                'feature_name' => 'digital_cards',
                'quota_limit' => 10,
            ],
            // Professional: unlimited cards
            [
                'id' => \Illuminate\Support\Str::uuid(),
                'plan_id' => $proPlanId,
                'feature_name' => 'digital_cards',
                'quota_limit' => null, // Unlimited
            ],
            // Professional: bulk export
            [
                'id' => \Illuminate\Support\Str::uuid(),
                'plan_id' => $proPlanId,
                'feature_name' => 'bulk_export',
                'quota_limit' => null,
            ],
        ]);
    }
}
```

---

## **SECTION 7: HOW DIGITALCARD PHASE 1 USES THIS**

### **7.1 In DigitalCard IssueCardHandler**

This shows how your Phase 1 DigitalCard will integrate subscriptions:

```php
<?php
// app/Contexts/DigitalCard/Application/Handlers/IssueCardHandler.php

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use App\Contexts\Subscription\Application\Services\FeatureGateService;
use App\Contexts\DigitalCard\Domain\Exceptions\DigitalCardException;

class IssueCardHandler
{
    public function __construct(
        private FeatureGateService $featureGate,
        // ... other dependencies
    ) {}

    public function handle(IssueCardCommand $command): CardDTO
    {
        $tenantId = $command->tenantId;

        // ✅ NEW: Check subscription exists
        if (!$this->featureGate->can($tenantId, 'digital_card', 'digital_cards')) {
            throw DigitalCardException::moduleNotSubscribed($tenantId);
        }

        // ✅ NEW: Check quota
        $monthlyUsage = $this->getMonthlyCardCount($tenantId);
        if ($this->featureGate->isQuotaExceeded(
            $tenantId,
            'digital_card',
            'digital_cards',
            $monthlyUsage
        )) {
            throw DigitalCardException::quotaExceeded(
                $monthlyUsage,
                $this->featureGate->quota($tenantId, 'digital_card', 'digital_cards')
            );
        }

        // ✅ EXISTING: Your Phase 0 logic continues here
        $card = DigitalCard::create(
            CardId::generate(),
            $command->tenantId,
            $command->memberId,
        );

        // ... persist, publish events, etc.
    }

    private function getMonthlyCardCount(string $tenantId): int
    {
        // Count cards issued this month by this tenant
        return DigitalCardModel::where('tenant_id', $tenantId)
            ->whereYear('created_at', now()->year)
            ->whereMonth('created_at', now()->month)
            ->count();
    }
}
```

### **7.2 In DigitalCard Routes**

```php
// routes/api.php

// Digital Card routes - protected by subscription
Route::middleware(['tenant', 'auth'])
    ->prefix('/{tenant}/api/v1')
    ->group(function () {
        Route::post('/cards', [DigitalCardController::class, 'store'])
            ->middleware('check_subscription:digital_card'); // ✅ NEW
        
        Route::put('/cards/{id}/activate', [DigitalCardController::class, 'activate'])
            ->middleware('check_subscription:digital_card'); // ✅ NEW
    });

// app/Http/Middleware/CheckSubscription.php
class CheckSubscription
{
    public function handle($request, $next, $moduleSlug)
    {
        $featureGate = app(FeatureGateService::class);
        
        if (!$featureGate->can($request->tenant()->id, $moduleSlug, 'access')) {
            return response()->json([
                'error' => 'Module not subscribed',
                'module' => $moduleSlug,
                'action' => 'Subscribe to access this feature',
            ], 402); // Payment Required
        }

        return $next($request);
    }
}
```

---

## **SECTION 8: IMPLEMENTATION CHECKLIST (2-3 DAYS)**

### **Day 1: Foundations (4-5 hours)**

- [ ] Create migration: `php artisan make:migration create_subscription_foundation_tables`
  - [ ] Plans table
  - [ ] Plan features table
  - [ ] Subscriptions table
  
- [ ] Create Domain layer files:
  - [ ] `Plan.php` entity
  - [ ] `Feature.php` value object
  - [ ] `Subscription.php` entity
  - [ ] `PlanId.php` value object
  - [ ] `SubscriptionId.php` value object
  - [ ] `PlanRepository.php` interface
  - [ ] `SubscriptionRepository.php` interface

- [ ] Create tests file:
  - [ ] `CreateSubscriptionTest.php`
  - [ ] `FeatureGateTest.php`

**Commands:**
```bash
cd packages/laravel-backend

# Run migration
php artisan migrate

# Run tests (will fail - TDD!)
php artisan test tests/Feature/Contexts/Subscription/

# Watch for errors, implement domain layer
```

### **Day 2: Application & Infrastructure (4-5 hours)**

- [ ] Create Application layer:
  - [ ] `SubscriptionService.php`
  - [ ] `FeatureGateService.php`

- [ ] Create Infrastructure layer:
  - [ ] `PlanModel.php` (Eloquent)
  - [ ] `SubscriptionModel.php` (Eloquent)
  - [ ] `PlanFeatureModel.php` (Eloquent)
  - [ ] `EloquentPlanRepository.php`
  - [ ] `EloquentSubscriptionRepository.php`
  - [ ] `SubscriptionContextServiceProvider.php`

- [ ] Register service provider in `config/app.php`

**Commands:**
```bash
# Run tests
php artisan test tests/Feature/Contexts/Subscription/

# Should pass now!
```

### **Day 3: Testing & Documentation (2-3 hours)**

- [ ] Run full test suite
  - [ ] `php artisan test tests/Feature/Contexts/Subscription/ --coverage`
  - [ ] Target: 90%+ coverage

- [ ] Run static analysis
  - [ ] `vendor/bin/phpstan analyse --level=8 app/Contexts/Subscription/`
  - [ ] Fix any issues

- [ ] Create seeder for local development:
  - [ ] `database/seeders/PlanSeeder.php`

- [ ] Documentation:
  - [ ] How to subscribe a tenant
  - [ ] How to check features in Phase 1
  - [ ] Integration examples

**Commands:**
```bash
# Coverage check
php artisan test tests/Feature/Contexts/Subscription/ --coverage-html=coverage

# Static analysis
vendor/bin/phpstan analyse --level=8 app/Contexts/Subscription/

# Seeder
php artisan make:seeder PlanSeeder
```

---

## **SECTION 9: SUCCESS CRITERIA**

✅ Phase 0.1 is COMPLETE when:

**Functionality:**
- [ ] Can create subscription for tenant
- [ ] Can check if tenant has subscription
- [ ] Can get plan for subscription
- [ ] Feature checking works (`can()`)
- [ ] Quota checking works (`isQuotaExceeded()`)
- [ ] Unlimited features work (null quota)

**Code Quality:**
- [ ] 90%+ test coverage
- [ ] PHPStan Level 8 clean
- [ ] All tests passing
- [ ] No type errors or warnings

**Architecture:**
- [ ] DDD structure maintained (Domain/Application/Infrastructure)
- [ ] Repository pattern implemented
- [ ] Service provider registered
- [ ] No Laravel dependencies in Domain layer

---

## **SECTION 10: WHAT'S NEXT**

Once Phase 0.1 is complete (by end of day 3):

**Phase 1: DigitalCard Full Lifecycle**
- Features are now "born behind gates"
- IssueCard, ActivateCard, RevokeCard handlers
- All check subscriptions from day one
- No refactoring needed
- Clean architecture maintained
- ~8 weeks of Phase 1 development

---

## **FINAL IMPLEMENTATION DIRECTIVE**

**TDD Workflow (Non-negotiable):**
1. Write failing test
2. Make it pass (minimal)
3. Refactor to clean code
4. Next test

**Folder Structure:**
- Follow your Membership module pattern exactly
- Copy the DDD/TDD approach that works

**Code Style:**
- `declare(strict_types=1)` on all PHP files
- Type hints everywhere
- Value objects are readonly
- Repository interfaces in Domain

**Timeline:**
- Day 1: 4-5 hours
- Day 2: 4-5 hours
- Day 3: 2-3 hours
- **Total: ~12 hours of focused work = 2 full days**

**You now have:**
- ✅ Foundation to gate features
- ✅ Clean integration with Phase 1 DigitalCard
- ✅ No future refactoring needed
- ✅ Ready to monetize from day one

---

**Ready to build Phase 0.1? Copy this prompt into Claude and start with the checklist.** 🚀

Your Phase 1 DigitalCard will integrate seamlessly with this by the end of day 3.

