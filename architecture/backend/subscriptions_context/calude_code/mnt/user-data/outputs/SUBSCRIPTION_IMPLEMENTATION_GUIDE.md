# **SUBSCRIPTION CONTEXT & DIGITALCARD INTEGRATION**
## **Detailed Implementation Strategy & Execution Roadmap**

**Version:** 1.0  
**Audience:** Senior Developers, Architects, Tech Leads  
**Estimated Duration:** 8 weeks (4 phases, 2 weeks each)  

---

## **SECTION 1: IMPLEMENTATION FOUNDATION**

### **1.1 Pre-Implementation Checklist**

```
ARCHITECTURE:
  ☐ Subscription Context designed (done: see SUBSCRIPTION_ARCHITECTURE.md)
  ☐ DDD principles understood by team
  ☐ Anti-corruption layers planned
  ☐ Event-driven patterns documented

TEAM:
  ☐ Senior developer assigned (Subscription context)
  ☐ Mid-level developer assigned (DigitalCard context)
  ☐ DevOps engineer setup CI/CD for tests
  ☐ Product owner approval of plans.yaml

TOOLS:
  ☐ Laravel 12.35.1 verified
  ☐ PestPHP configured with coverage
  ☐ PHPStan Level 8 setup
  ☐ Rector configured for code generation
  ☐ Database tools ready (migrations, seeders)

ENVIRONMENT:
  ☐ Development database ready
  ☐ Test database configured
  ☐ Caching layer (Redis) available
  ☐ Queue system (Laravel Horizon) operational
```

### **1.2 DDD Project Structure**

```
app/Contexts/
├── Subscription/
│   ├── Domain/
│   │   ├── Entities/
│   │   │   ├── Plan.php
│   │   │   ├── Subscription.php
│   │   │   ├── EntitlementSet.php
│   │   │   └── Entitlement.php
│   │   ├── ValueObjects/
│   │   │   ├── PlanId.php
│   │   │   ├── SubscriptionId.php
│   │   │   ├── TenantId.php
│   │   │   ├── Price.php
│   │   │   ├── PlanName.php
│   │   │   ├── Feature.php
│   │   │   ├── SubscriptionDuration.php (Enum)
│   │   │   ├── SubscriptionStatus.php (Enum)
│   │   │   └── EntitlementSetId.php
│   │   ├── Repositories/
│   │   │   ├── PlanRepository.php (Interface)
│   │   │   ├── SubscriptionRepository.php (Interface)
│   │   │   └── EntitlementSetRepository.php (Interface)
│   │   ├── Services/
│   │   │   ├── SubscriptionCalculator.php
│   │   │   ├── RenewalService.php
│   │   │   └── EntitlementEvaluator.php
│   │   ├── Events/
│   │   │   ├── SubscriptionEvent.php (Abstract)
│   │   │   ├── SubscriptionCreated.php
│   │   │   ├── SubscriptionRenewed.php
│   │   │   ├── SubscriptionCancelled.php
│   │   │   ├── SubscriptionSuspended.php
│   │   │   └── SubscriptionDowngraded.php
│   │   └── Exceptions/
│   │       └── SubscriptionException.php
│   │
│   ├── Application/
│   │   ├── Commands/
│   │   │   ├── CreateSubscriptionCommand.php
│   │   │   ├── RenewSubscriptionCommand.php
│   │   │   ├── CancelSubscriptionCommand.php
│   │   │   ├── SuspendSubscriptionCommand.php
│   │   │   └── UpgradeSubscriptionCommand.php
│   │   ├── CommandHandlers/
│   │   │   ├── CreateSubscriptionHandler.php
│   │   │   ├── RenewSubscriptionHandler.php
│   │   │   └── ... (handler for each command)
│   │   ├── Queries/
│   │   │   ├── GetSubscriptionQuery.php
│   │   │   ├── ListTenantSubscriptionsQuery.php
│   │   │   └── GetAvailablePlansQuery.php
│   │   ├── QueryHandlers/
│   │   │   └── ... (handlers)
│   │   ├── DTOs/
│   │   │   ├── CreateSubscriptionDTO.php
│   │   │   ├── SubscriptionDTO.php
│   │   │   └── PlanDTO.php
│   │   └── Services/
│   │       ├── SubscriptionApplicationService.php
│   │       ├── EntitlementService.php
│   │       └── PlanLoaderService.php
│   │
│   └── Infrastructure/
│       ├── Persistence/
│       │   ├── Eloquent/
│       │   │   ├── EloquentPlan.php
│       │   │   ├── EloquentSubscription.php
│       │   │   └── EloquentEntitlementSet.php
│       │   ├── Repositories/
│       │   │   ├── EloquentPlanRepository.php
│       │   │   ├── EloquentSubscriptionRepository.php
│       │   │   └── EloquentEntitlementSetRepository.php
│       │   └── Database/
│       │       └── Migrations/
│       │           ├── 2025_12_25_create_plans_table.php
│       │           ├── 2025_12_25_create_plan_features_table.php
│       │           ├── 2025_12_25_create_subscriptions_table.php
│       │           ├── 2025_12_25_create_entitlement_sets_table.php
│       │           └── 2025_12_25_create_entitlements_table.php
│       ├── EventSubscribers/
│       │   └── SubscriptionEventSubscriber.php
│       ├── Providers/
│       │   └── SubscriptionContextServiceProvider.php
│       └── Config/
│           └── plans.yaml
│
├── DigitalCard/
│   ├── Domain/
│   │   ├── Entities/
│   │   │   └── DigitalCard.php
│   │   ├── ValueObjects/
│   │   │   ├── CardId.php
│   │   │   ├── MemberId.php
│   │   │   ├── QRCode.php
│   │   │   ├── CardStatus.php (Enum)
│   │   │   └── CardUsageStatistics.php
│   │   ├── Repositories/
│   │   │   ├── DigitalCardRepository.php (Interface)
│   │   │   └── UsageStatsRepository.php (Interface)
│   │   ├── Services/
│   │   │   └── UsageTracker.php (Interface)
│   │   ├── Events/
│   │   │   ├── CardEvent.php (Abstract)
│   │   │   ├── CardIssued.php
│   │   │   ├── CardActivated.php
│   │   │   ├── CardRevoked.php
│   │   │   ├── CardValidated.php
│   │   │   └── QRCodeRegenerated.php
│   │   └── Exceptions/
│   │       └── CardException.php
│   │
│   ├── Application/
│   │   ├── Commands/
│   │   │   ├── IssueCardCommand.php
│   │   │   ├── ActivateCardCommand.php
│   │   │   ├── RevokeCardCommand.php
│   │   │   └── ValidateCardCommand.php
│   │   ├── CommandHandlers/
│   │   │   ├── IssueCardHandler.php
│   │   │   ├── ActivateCardHandler.php
│   │   │   ├── RevokeCardHandler.php
│   │   │   └── ValidateCardHandler.php
│   │   ├── Queries/
│   │   │   ├── GetCardQuery.php
│   │   │   ├── ListTenantCardsQuery.php
│   │   │   └── GetAvailableTemplatesQuery.php
│   │   ├── DTOs/
│   │   │   ├── IssueCardDTO.php
│   │   │   ├── CardDTO.php
│   │   │   └── TemplateDTO.php
│   │   └── Services/
│   │       ├── DigitalCardApplicationService.php
│   │       └── CardTemplateService.php
│   │
│   └── Infrastructure/
│       ├── Persistence/
│       │   ├── Eloquent/
│       │   │   ├── EloquentDigitalCard.php
│       │   │   └── EloquentUsageStats.php
│       │   ├── Repositories/
│       │   │   ├── EloquentDigitalCardRepository.php
│       │   │   └── EloquentUsageStatsRepository.php
│       │   └── Database/
│       │       └── Migrations/
│       │           ├── 2025_12_25_create_digital_cards_table.php
│       │           └── 2025_12_25_create_card_usage_stats_table.php
│       ├── AntiCorruptionLayer/
│       │   └── SubscriptionAwareDigitalCardService.php
│       ├── EventSubscribers/
│       │   └── SubscriptionEventSubscriber.php
│       ├── Providers/
│       │   └── DigitalCardContextServiceProvider.php
│       └── Http/
│           ├── Controllers/
│           │   ├── CardController.php
│           │   └── TemplateController.php
│           └── Requests/
│               ├── IssueCardRequest.php
│               └── ActivateCardRequest.php

tests/Contexts/
├── Subscription/
│   ├── Unit/
│   │   ├── Domain/
│   │   │   ├── Entities/PlanTest.php
│   │   │   ├── Entities/SubscriptionTest.php
│   │   │   ├── ValueObjects/PriceTest.php
│   │   │   └── ValueObjects/PlanNameTest.php
│   │   └── Application/
│   │       ├── CreateSubscriptionHandlerTest.php
│   │       └── EntitlementServiceTest.php
│   │
│   └── Feature/
│       ├── CreateSubscriptionTest.php
│       ├── RenewSubscriptionTest.php
│       ├── CancelSubscriptionTest.php
│       ├── UpgradeSubscriptionTest.php
│       └── EntitlementCheckTest.php
│
└── DigitalCard/
    ├── Unit/
    │   ├── Domain/
    │   │   ├── Entities/DigitalCardTest.php
    │   │   └── ValueObjects/QRCodeTest.php
    │   └── Application/
    │       └── IssueCardHandlerTest.php
    │
    └── Feature/
        ├── IssueCardWithEntitlementTest.php
        ├── CardQuotaEnforcementTest.php
        ├── SubscriptionIntegrationTest.php
        └── CardRevokedOnSubscriptionCancelTest.php
```

---

## **SECTION 2: PHASE 1 - SUBSCRIPTION CORE (Weeks 1-2)**

### **2.1 Week 1: Domain Layer**

#### **Day 1-2: Value Objects**

```php
// FILE: app/Contexts/Subscription/Domain/ValueObjects/PlanId.php

<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Domain\ValueObjects;

use App\Contexts\Subscription\Domain\Exceptions\InvalidPlanId;

final readonly class PlanId
{
    public function __construct(public string $value)
    {
        if (empty($this->value)) {
            throw InvalidPlanId::empty();
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

// TEST FILE: tests/Contexts/Subscription/Unit/Domain/ValueObjects/PlanIdTest.php

<?php
namespace Tests\Contexts\Subscription\Unit\Domain\ValueObjects;

use App\Contexts\Subscription\Domain\ValueObjects\PlanId;
use App\Contexts\Subscription\Domain\Exceptions\InvalidPlanId;
use PHPUnit\Framework\TestCase;

class PlanIdTest extends TestCase
{
    it('creates from string', function () {
        $id = PlanId::fromString('123e4567-e89b-12d3-a456-426614174000');
        expect($id->value)->toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('generates new UUID', function () {
        $id = PlanId::generate();
        expect($id->value)->toBeString();
        expect(strlen($id->value))->toBe(36);
    });

    it('throws on empty value', function () {
        this->expectException(InvalidPlanId::class);
        new PlanId('');
    });

    it('equals same values', function () {
        $id1 = PlanId::fromString('123e4567-e89b-12d3-a456-426614174000');
        $id2 = PlanId::fromString('123e4567-e89b-12d3-a456-426614174000');
        expect($id1->equals($id2))->toBe(true);
    });
}
```

**Deliverables (Day 1-2):**
- ✓ All value objects created with tests
- ✓ Enum classes (SubscriptionStatus, SubscriptionDuration)
- ✓ Exception classes
- ✓ All passing tests

#### **Day 3-4: Domain Entities**

**Create Plan aggregate:**

```php
// FILE: app/Contexts/Subscription/Domain/Entities/Plan.php
// (See SUBSCRIPTION_ARCHITECTURE.md Section 2.2 for full implementation)

// TEST: tests/Contexts/Subscription/Unit/Domain/Entities/PlanTest.php
<?php
namespace Tests\Contexts\Subscription\Unit\Domain\Entities;

describe('Plan aggregate', function () {
    it('creates new plan from factory', function () {
        $plan = Plan::create(
            id: PlanId::generate(),
            name: new PlanName('Professional'),
            slug: 'professional',
            monthlyPrice: Price::usd(79),
            annualPrice: Price::usd(790),
            features: [
                new Feature('digital_cards', 'Digital Cards', 'Create membership cards', 1000),
            ],
            quotas: ['digital_cards' => 1000, 'team_members' => 15],
            maxTeamMembers: 15,
            maxApiKeys: 5,
        );

        expect($plan->slug())->toBe('professional');
        expect($plan->name()->value)->toBe('Professional');
    });

    it('returns correct price for duration', function () {
        $plan = Plan::create(...);
        
        $monthlyPrice = $plan->priceFor(SubscriptionDuration::MONTHLY);
        expect($monthlyPrice->dollars())->toBe(79.00);
    });

    it('gets quota for feature', function () {
        $plan = Plan::create(...);
        
        expect($plan->getQuotaFor('digital_cards'))->toBe(1000);
        expect($plan->getQuotaFor('team_members'))->toBe(15);
    });

    it('returns null for unknown quota', function () {
        $plan = Plan::create(...);
        expect($plan->getQuotaFor('unknown'))->toBeNull();
    });
});
```

**Create Subscription aggregate:**

```php
// Same pattern as above - see SUBSCRIPTION_ARCHITECTURE.md
```

**Deliverables (Day 3-4):**
- ✓ All domain entities created
- ✓ Factory methods with invariants
- ✓ Business methods (cancel, renew, suspend)
- ✓ Domain events recorded
- ✓ All tests passing

#### **Day 5: Repository Interfaces**

```php
// FILE: app/Contexts/Subscription/Domain/Repositories/PlanRepository.php
interface PlanRepository
{
    public function save(Plan $plan): void;
    public function byId(PlanId $id): ?Plan;
    public function bySlug(string $slug): ?Plan;
    public function allActive(): array;
}

// Same for SubscriptionRepository, EntitlementSetRepository
```

**Deliverables (Day 5):**
- ✓ All repository interfaces defined
- ✓ No tests needed (interfaces)

### **2.2 Week 2: Infrastructure & Application**

#### **Day 6-7: Database Layer**

```php
// FILE: database/migrations/tenant/2025_12_25_create_plans_table.php

<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->integer('monthly_price_cents');
            $table->integer('annual_price_cents');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('plan_features', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('plan_id')->constrained('plans')->cascadeOnDelete();
            $table->string('feature_name');
            $table->string('feature_display_name');
            $table->text('description')->nullable();
            $table->integer('default_quota')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_features');
        Schema::dropIfExists('plans');
    }
};

// FILE: database/migrations/tenant/2025_12_25_create_subscriptions_table.php
// (See full implementation)

// Run migrations test
<?php
test('subscription migration creates tables', function () {
    expect(Schema::hasTable('plans'))->toBe(true);
    expect(Schema::hasTable('plan_features'))->toBe(true);
    expect(Schema::hasTable('subscriptions'))->toBe(true);
    expect(Schema::hasTable('entitlement_sets'))->toBe(true);
    expect(Schema::hasTable('entitlements'))->toBe(true);
});
```

**Deliverables (Day 6-7):**
- ✓ All migrations created
- ✓ Database schema matches domain model
- ✓ Indexes for performance
- ✓ Constraints enforce business rules

#### **Day 8: Eloquent Models & Repositories**

```php
// FILE: app/Contexts/Subscription/Infrastructure/Persistence/Eloquent/EloquentPlan.php

<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;
use App\Contexts\Subscription\Domain\Entities\Plan;
use App\Contexts\Subscription\Domain\ValueObjects\{PlanId, PlanName, Price};

class EloquentPlan extends Model
{
    protected $fillable = ['id', 'name', 'slug', 'monthly_price_cents', 'annual_price_cents', 'is_active'];
    protected $casts = ['id' => 'string', 'is_active' => 'bool'];
    public $incrementing = false;
    protected $keyType = 'string';

    public function toDomainEntity(): Plan
    {
        // Convert Eloquent model to domain entity
        // This is where impedance mismatch is handled
        
        $features = $this->features->map(fn($feature) => 
            new Feature(
                name: $feature->feature_name,
                displayName: $feature->feature_display_name,
                description: $feature->description,
                defaultQuota: $feature->default_quota,
            )
        )->toArray();

        $quotas = [];
        foreach ($this->features as $feature) {
            if ($feature->default_quota !== null) {
                $quotas[$feature->feature_name] = $feature->default_quota;
            }
        }

        return Plan::create(
            id: PlanId::fromString($this->id),
            name: new PlanName($this->name),
            slug: $this->slug,
            monthlyPrice: Price::fromCents($this->monthly_price_cents),
            annualPrice: Price::fromCents($this->annual_price_cents),
            features: $features,
            quotas: $quotas,
            maxTeamMembers: 999999, // From features
            maxApiKeys: 999999,      // From features
        );
    }

    public function features()
    {
        return $this->hasMany(EloquentPlanFeature::class, 'plan_id', 'id');
    }
}

// FILE: app/Contexts/Subscription/Infrastructure/Persistence/Repositories/EloquentPlanRepository.php

<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Infrastructure\Persistence\Repositories;

use App\Contexts\Subscription\Domain\Entities\Plan;
use App\Contexts\Subscription\Domain\Repositories\PlanRepository;
use App\Contexts\Subscription\Domain\ValueObjects\PlanId;
use App\Contexts\Subscription\Infrastructure\Persistence\Eloquent\EloquentPlan;

class EloquentPlanRepository implements PlanRepository
{
    public function save(Plan $plan): void
    {
        // Convert domain entity to Eloquent model
        EloquentPlan::updateOrCreate(
            ['id' => $plan->id()->value],
            [
                'name' => $plan->name()->value,
                'slug' => $plan->slug(),
                'is_active' => true,
            ]
        );
    }

    public function byId(PlanId $id): ?Plan
    {
        $model = EloquentPlan::find($id->value);
        return $model?->toDomainEntity();
    }

    public function bySlug(string $slug): ?Plan
    {
        $model = EloquentPlan::where('slug', $slug)->first();
        return $model?->toDomainEntity();
    }

    public function allActive(): array
    {
        return EloquentPlan::where('is_active', true)
            ->get()
            ->map(fn($model) => $model->toDomainEntity())
            ->toArray();
    }
}

// TEST: tests/Contexts/Subscription/Unit/Infrastructure/Repositories/PlanRepositoryTest.php

<?php
test('saves plan to database', function () {
    $plan = Plan::create(
        id: PlanId::generate(),
        name: new PlanName('Professional'),
        slug: 'professional',
        monthlyPrice: Price::usd(79),
        annualPrice: Price::usd(790),
        features: [],
        quotas: [],
        maxTeamMembers: 15,
        maxApiKeys: 5,
    );

    $repository = new EloquentPlanRepository();
    $repository->save($plan);

    $saved = $repository->bySlug('professional');
    expect($saved)->not()->toBeNull();
    expect($saved->slug())->toBe('professional');
});
```

**Deliverables (Day 8):**
- ✓ Eloquent models created
- ✓ Repository implementations
- ✓ Domain↔Eloquent mapping
- ✓ Repository tests passing

#### **Day 9-10: Application Services**

```php
// FILE: app/Contexts/Subscription/Infrastructure/Services/PlanLoaderFromYAML.php

<?php
declare(strict_types=1);

namespace App\Contexts\Subscription\Infrastructure\Services;

use App\Contexts\Subscription\Domain\Entities\Plan;
use App\Contexts\Subscription\Domain\Repositories\PlanRepository;
use App\Contexts\Subscription\Domain\ValueObjects\{PlanId, PlanName, Price, Feature};
use Symfony\Component\Yaml\Yaml;

class PlanLoaderFromYAML
{
    public function __construct(
        private PlanRepository $planRepository,
    ) {}

    public function loadAndRegisterPlans(): void
    {
        $yaml = Yaml::parseFile(config_path('subscriptions/plans.yaml'));

        foreach ($yaml['plans'] as $slug => $config) {
            $plan = $this->createPlan($slug, $config);
            $this->planRepository->save($plan);
        }
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
            if (isset($feature['quota']) && $feature['quota'] !== null) {
                $quotas[$feature['name']] = $feature['quota'];
            }
        }

        $quotas['team_members'] = $config['limits']['team_members'] ?? 999999;
        $quotas['api_keys'] = $config['limits']['api_keys'] ?? 999999;

        return Plan::create(
            id: PlanId::generate(),
            name: new PlanName($config['name']),
            slug: $slug,
            monthlyPrice: Price::fromCents($config['pricing']['monthly']['amount']),
            annualPrice: Price::fromCents($config['pricing']['annual']['amount']),
            features: $features,
            quotas: $quotas,
            maxTeamMembers: $config['limits']['team_members'] ?? 999999,
            maxApiKeys: $config['limits']['api_keys'] ?? 999999,
        );
    }
}

// Seeder to load plans
<?php
// database/seeders/PlanSeeder.php

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $loader = app(PlanLoaderFromYAML::class);
        $loader->loadAndRegisterPlans();
    }
}

// TEST
test('loads plans from YAML configuration', function () {
    $this->seed(PlanSeeder::class);

    $professional = Plan::repository()->bySlug('professional');
    expect($professional)->not()->toBeNull();
    expect($professional->name()->value)->toBe('Professional');
});
```

**Deliverables (Day 9-10):**
- ✓ PlanLoaderFromYAML service created
- ✓ Config/plans.yaml set up
- ✓ Seeder for plan data
- ✓ Integration tests passing
- ✓ **Phase 1 Complete: 90%+ coverage, all tests green**

---

## **SECTION 3: PHASE 2 - DIGITALCARD INTEGRATION (Weeks 3-4)**

### **3.1 Implementation Pattern (TDD)**

**For each feature:**

```
1. RED: Write failing integration test
   └─ Test asserts subscription entitlement is checked
   
2. GREEN: Implement minimal code
   └─ Add entitlement check to application service
   └─ Make test pass
   
3. REFACTOR: Improve architecture
   └─ Extract to separate ACL service
   └─ Add domain events
   └─ Improve naming
```

### **3.2 Week 3: DigitalCard Domain & Integration**

**Day 11-12: DigitalCard Domain**
- Create CardId, MemberId, QRCode value objects
- Create DigitalCard aggregate
- Create CardStatus enum
- Domain tests (90%+ coverage)

**Day 13-14: Subscription ACL Layer**
- Create SubscriptionAwareDigitalCardService
- Implement entitlement checking
- Implement quota enforcement
- Integration tests

**Example Test (showing subscription integration):**

```php
// FILE: tests/Contexts/DigitalCard/Feature/SubscriptionIntegrationTest.php

<?php
describe('DigitalCard with Subscription integration', function () {
    
    it('allows issuing card if tenant has entitlement', function () {
        // Arrange
        $tenant = Tenant::factory()->create();
        $plan = Plan::factory()->professional()->create();
        $subscription = Subscription::subscribe($tenant, $plan);
        
        $member = Member::factory()->for($tenant)->create();
        
        // Act
        $service = resolve(SubscriptionAwareDigitalCardService::class);
        $card = $service->issueCard(
            tenantId: TenantId::from($tenant),
            memberId: MemberId::from($member),
            template: 'basic'
        );
        
        // Assert
        expect($card)->toBeInstanceOf(DigitalCard::class);
        $this->assertDatabaseHas('digital_cards', [
            'id' => $card->id()->value,
            'member_id' => $member->id,
        ]);
    });

    it('prevents issuing card if tenant lacks entitlement', function () {
        // Arrange
        $tenant = Tenant::factory()->create();
        // No subscription created - no entitlements
        
        $member = Member::factory()->for($tenant)->create();
        
        // Act & Assert
        $service = resolve(SubscriptionAwareDigitalCardService::class);
        
        expect(fn() => $service->issueCard(
            tenantId: TenantId::from($tenant),
            memberId: MemberId::from($member),
            template: 'basic'
        ))->toThrow(NoDigitalCardEntitlementException::class);
    });

    it('prevents issuing card if quota exceeded', function () {
        // Arrange
        $tenant = Tenant::factory()->create();
        $plan = Plan::factory()->starter()->create(); // 100 cards/month quota
        $subscription = Subscription::subscribe($tenant, $plan);
        
        // Issue 100 cards already
        $this->issueCards($tenant, 100);
        
        $member = Member::factory()->for($tenant)->create();
        
        // Act & Assert
        $service = resolve(SubscriptionAwareDigitalCardService::class);
        
        expect(fn() => $service->issueCard(
            tenantId: TenantId::from($tenant),
            memberId: MemberId::from($member),
            template: 'basic'
        ))->toThrow(QuotaExceededException::class);
    });

    it('revokes all cards when subscription is cancelled', function () {
        // Arrange
        $tenant = Tenant::factory()->create();
        $subscription = Subscription::subscribe($tenant, Plan::factory()->professional()->create());
        
        $member = Member::factory()->for($tenant)->create();
        $service = resolve(SubscriptionAwareDigitalCardService::class);
        
        $card1 = $service->issueCard(TenantId::from($tenant), MemberId::from($member), 'basic');
        $card2 = $service->issueCard(TenantId::from($tenant), MemberId::from($member), 'basic');
        
        // Activate
        $service->activateCard($card1->id());
        $service->activateCard($card2->id());
        
        // Act - Cancel subscription
        $subscription->cancel('Customer request');
        
        // Event: SubscriptionCancelled is published
        // Event handler: SubscriptionEventSubscriber.handle(SubscriptionCancelled)
        // Result: All active cards are revoked
        
        // Assert
        $this->assertDatabaseHas('digital_cards', [
            'id' => $card1->id()->value,
            'status' => 'revoked',
        ]);
        $this->assertDatabaseHas('digital_cards', [
            'id' => $card2->id()->value,
            'status' => 'revoked',
        ]);
    });
});
```

### **3.3 Week 4: Usage Tracking & Refinement**

**Day 15-16: Usage Tracking**
- Create UsageTracker service
- Create card_usage_stats table
- Implement quota checking before issuance
- Usage tracking tests

**Day 17-18: Event Subscribers**
- Create SubscriptionEventSubscriber
- Handle subscription cancellation → card revocation
- Handle subscription downgrade → quota validation
- End-to-end tests

**Day 19-20: HTTP Layer & Polish**
- Create CardController
- Create API endpoints
- Request validation
- Response DTOs
- API tests

**Deliverables (Phase 2 Complete):**
- ✓ DigitalCard domain implemented
- ✓ Subscription integration complete
- ✓ Entitlement checking enforced
- ✓ Quota enforcement working
- ✓ Event-driven synchronization
- ✓ API endpoints functional
- ✓ 90%+ coverage both contexts
- ✓ All tests passing, PHPStan clean

---

## **SECTION 4: EXECUTION CHECKLIST**

### **Daily Checklist**

```
MORNING:
  ☐ Read test failures (if any)
  ☐ Check CI/CD pipeline
  ☐ Review code coverage report
  ☐ Check team Slack for blockers

DEVELOPMENT:
  ☐ Follow TDD: RED → GREEN → REFACTOR
  ☐ Run tests after each change
  ☐ PHPStan after creating classes
  ☐ Commit frequently with meaningful messages

AFTERNOON:
  ☐ Code review from peer
  ☐ Update progress tracking
  ☐ Document decisions if needed
  ☐ Plan next day's work

EOD:
  ☐ All tests passing locally
  ☐ Push to feature branch
  ☐ CI/CD pipeline green
  ☐ Update project board
```

### **Weekly Progress Tracking**

```
WEEK 1:
  ☐ Day 1-2: Value objects (5 classes, 5 tests)
  ☐ Day 3-4: Domain entities (3 classes, 3 tests)
  ☐ Day 5: Repository interfaces (3 interfaces)
  Coverage: ~60% (domain is mostly logic)

WEEK 2:
  ☐ Day 6-7: Migrations (5 tables, seeders)
  ☐ Day 8: Eloquent models & repositories (5 files)
  ☐ Day 9-10: Application services (2 services + seeder)
  Coverage: ~85%
  
  PHASE 1 COMPLETE CRITERIA:
    ✓ All domain tests passing
    ✓ All repository tests passing
    ✓ All application tests passing
    ✓ Coverage ≥ 90%
    ✓ PHPStan Level 8 clean
    ✓ Can create & retrieve subscriptions
    ✓ Plans loaded from YAML successfully

WEEKS 3-4: (Same pattern for DigitalCard)
  PHASE 2 COMPLETE CRITERIA:
    ✓ Can issue cards only with entitlements
    ✓ Quota enforcement working
    ✓ Events published and subscribed
    ✓ Cards revoked on subscription cancel
    ✓ Integration tests all passing
    ✓ API endpoints functional
```

---

## **TESTING STRATEGY**

### **Test Coverage Map**

```
SUBSCRIPTION CONTEXT:
  Unit Tests (50% of tests):
    - ValueObjects: All properties, equality
    - Entities: Factories, state transitions
    - Services: Calculations, business logic
  
  Integration Tests (30% of tests):
    - Repositories: Save/load cycles
    - Event publishing
    - YAML loading
  
  Feature Tests (20% of tests):
    - End-to-end subscription flows
    - Plan upgrades/downgrades
    - Entitlement changes

DIGITALCARD CONTEXT:
  Unit Tests (40%):
    - DigitalCard aggregate
    - Value objects
    - Quota calculations
  
  Integration Tests (30%):
    - Repository persistence
    - Usage tracking
    - Event publishing
  
  Feature Tests (30%):
    - Card issuance with entitlements
    - Subscription integration
    - Quota enforcement
    - Event-driven synchronization

TOTAL TARGET: 90%+ coverage
```

### **Critical Test Cases**

```
MUST HAVE:
  ☐ Can create subscription
  ☐ Can renew subscription
  ☐ Can cancel subscription
  ☐ Cannot issue card without entitlement
  ☐ Cannot exceed quota
  ☐ Cards revoked when subscription cancels
  ☐ Usage tracked correctly
  ☐ Events published for state changes
  
SHOULD HAVE:
  ☐ Upgrade/downgrade flows
  ☐ Template availability by plan
  ☐ Concurrent entitlement checks
  ☐ Materialized view queries
  ☐ Cache invalidation
  
NICE TO HAVE:
  ☐ Performance benchmarks
  ☐ Chaos engineering tests
  ☐ Load tests
```

---

## **DEPLOYMENT STRATEGY**

### **Pre-Deployment Validation**

```bash
# 1. Run all tests
php artisan test --coverage-html=coverage

# 2. Static analysis
vendor/bin/phpstan analyse --level=8 app/Contexts/

# 3. Code style
vendor/bin/pint --test app/Contexts/

# 4. Database safety
php artisan tenants:migrate:status
php artisan migrate:refresh --seed

# 5. Performance check
php artisan tinker
>>> \DB::listen(function($query) { dump($query->sql); });
>>> // Test slow queries

# 6. Final green light
git push origin feature/subscription-architecture
# Wait for CI/CD pipeline
```

### **Rollout Plan**

```
PHASE 1 ROLLOUT (Foundation):
  Week 1: Internal testing only
  Week 2: Beta tenant access
  → No end-user impact yet
  → Can rollback easily

PHASE 2 ROLLOUT (Integration):
  Week 3: Limited rollout (10% of tenants)
  Week 4: Ramp to 50% of tenants
  → Monitor quota violations
  → Monitor API latency
  → Ready to rollback

FINAL PRODUCTION:
  Week 5: 100% rollout
  → Full SaaS model active
```

---

## **SUCCESS METRICS**

### **Code Quality**

- ✓ 90%+ test coverage (both contexts)
- ✓ PHPStan Level 8 compliance
- ✓ Zero code duplication (DRY)
- ✓ All domain logic in entities/value objects
- ✓ Clear separation of concerns

### **Performance**

- ✓ Subscription creation: < 200ms P95
- ✓ Entitlement check: < 10ms P95 (cached)
- ✓ Card issuance: < 150ms P95
- ✓ Support 1000+ concurrent subscriptions
- ✓ Zero N+1 query problems

### **Business**

- ✓ Can create 5-tier pricing model
- ✓ Can upsell/downgrade subscriptions
- ✓ Revenue tracking accurate
- ✓ Usage limits enforced
- ✓ Churn metrics visible

---

**Total Estimated Effort:** 8 weeks, one senior + one mid-level developer  
**Complexity:** High (DDD, multi-context, events)  
**Risk Level:** Medium (Event-driven can be tricky)  
**ROI:** Very High (Complete SaaS business model)

