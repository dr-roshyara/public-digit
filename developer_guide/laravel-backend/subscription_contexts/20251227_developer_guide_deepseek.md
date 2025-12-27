# **📘 Subscription Context - Developer Guide**

## **🎯 Overview**

**Subscription Context** is a Domain-Driven Design (DDD) bounded context that provides subscription management, feature gating, and quota enforcement for multi-tenant applications. Built during **Phase 0.1** to enable monetization-ready DigitalCard Phase 1 development.

---

## **🏗️ Architecture**

### **DDD Layers Structure**
```
app/Contexts/Subscription/
├── Domain/                          # Pure Business Logic (Zero Laravel)
│   ├── Entities/                    # Business Objects
│   │   ├── Plan.php                 # Aggregate Root (features, quotas)
│   │   ├── Subscription.php         # Aggregate Root (tenant → plan)
│   │   └── Feature.php              # Individual feature with quota
│   ├── ValueObjects/                # Type-safe Wrappers
│   │   ├── PlanId.php               # UUID wrapper
│   │   ├── SubscriptionId.php       # UUID wrapper
│   │   ├── FeatureName.php          # String wrapper
│   │   └── QuotaLimit.php           # Nullable integer wrapper
│   └── Repositories/                # Persistence Contracts
│       ├── PlanRepository.php       # Interface
│       └── SubscriptionRepository.php
├── Application/                     # Use Cases / Orchestration
│   └── Services/
│       ├── SubscriptionService.php  # Create/manage subscriptions
│       └── FeatureGateService.php   # Feature & quota checking
└── Infrastructure/                  # Technical Implementation
    ├── Persistence/
    │   ├── Eloquent/                # Laravel Models
    │   │   ├── PlanModel.php
    │   │   ├── PlanFeatureModel.php
    │   │   └── SubscriptionModel.php
    │   └── Repositories/            # Repository Implementations
    │       ├── EloquentPlanRepository.php
    │       └── EloquentSubscriptionRepository.php
    └── Providers/
        └── SubscriptionContextServiceProvider.php
```

---

## **🗄️ Database Schema (Landlord DB)**

### **Tables**
```sql
-- 1. Plans table
plans (id: uuid, name: string, slug: string, timestamps)

-- 2. Plan Features table  
plan_features (id: uuid, plan_id: uuid, feature_name: string, quota_limit: integer|null)

-- 3. Subscriptions table
subscriptions (id: uuid, tenant_id: uuid, module_slug: string, plan_id: uuid, 
               status: string, subscribed_at: timestamp, expires_at: timestamp|null)
```

### **Relationships**
```
tenants (landlord)
    ↑ (1:N)
subscriptions
    ↓ (N:1)  
plans
    ↓ (1:N)
plan_features
```

---

## **🚀 How To Use**

### **1. Creating a Subscription**
```php
use App\Contexts\Subscription\Application\Services\SubscriptionService;

class TenantOnboardingService
{
    public function __construct(
        private SubscriptionService $subscriptionService
    ) {}
    
    public function onboardTenant(Tenant $tenant, string $planSlug = 'free'): void
    {
        // Subscribe tenant to DigitalCard module with free plan
        $subscription = $this->subscriptionService->subscribe(
            $tenant->id,
            'digital_card',      // Module slug
            $planSlug            // 'free', 'professional', 'enterprise'
        );
        
        // Subscription created and persisted
    }
}
```

### **2. Checking Feature Access (DigitalCard Phase 1)**
```php
use App\Contexts\Subscription\Application\Services\FeatureGateService;

class IssueCardHandler
{
    public function __construct(
        private FeatureGateService $featureGate
    ) {}
    
    public function handle(IssueCardCommand $command): CardDTO
    {
        // 1. Check if tenant has subscription
        if (!$this->featureGate->can(
            $command->tenantId,
            'digital_card',
            'digital_cards'      // Feature name
        )) {
            throw new ModuleNotSubscribedException();
        }
        
        // 2. Check quota
        $monthlyUsage = $this->getMonthlyCardCount($command->tenantId);
        if ($this->featureGate->isQuotaExceeded(
            $command->tenantId,
            'digital_card', 
            'digital_cards',
            $monthlyUsage
        )) {
            throw new QuotaExceededException();
        }
        
        // 3. Proceed with business logic...
    }
}
```

### **3. Getting Subscription Information**
```php
$subscriptionService = app(SubscriptionService::class);

// Check if tenant has subscription
$hasSubscription = $subscriptionService->hasSubscription(
    $tenantId, 
    'digital_card'
);

// Get current plan
$plan = $subscriptionService->getPlanFor(
    $tenantId,
    'digital_card'
);

if ($plan) {
    echo "Plan: {$plan->name()}"; // "Free", "Professional"
    echo "Has bulk export: " . ($plan->hasFeature('bulk_export') ? 'Yes' : 'No');
}
```

---

## **🎯 Feature Matrix (Example)**

### **Plans & Features**
| Plan | Digital Cards | Bulk Export | Real-time | API Access | Price |
|------|--------------|-------------|-----------|------------|-------|
| **Free** | 10/month | ❌ | ❌ | ❌ | $0 |
| **Professional** | Unlimited | ✅ | ❌ | ❌ | $9.99/month |
| **Enterprise** | Unlimited | ✅ | ✅ | ✅ | $29.99/month |

**Database seeding:**
```php
// In PlanSeeder.php
'free' => [
    ['feature_name' => 'digital_cards', 'quota_limit' => 10]
],
'professional' => [
    ['feature_name' => 'digital_cards', 'quota_limit' => null], // Unlimited
    ['feature_name' => 'bulk_export', 'quota_limit' => null],
],
'enterprise' => [
    // All features unlimited
]
```

---

## **🔧 Development Workflow**

### **Adding a New Feature**
1. **Add to plan_features table:**
   ```sql
   INSERT INTO plan_features (plan_id, feature_name, quota_limit)
   VALUES ('pro-plan-id', 'advanced_analytics', NULL);
   ```

2. **Use in code:**
   ```php
   if ($featureGate->can($tenantId, 'module', 'advanced_analytics')) {
       // Show advanced analytics
   }
   ```

### **Adding a New Module**
1. **Subscribe tenant to new module:**
   ```php
   $subscriptionService->subscribe($tenantId, 'new_module', 'professional');
   ```

2. **Check access in new module:**
   ```php
   $featureGate->can($tenantId, 'new_module', 'feature_name');
   ```

---

## **🧪 Testing**

### **Running Tests**
```bash
# Run all subscription tests
php artisan test tests/Feature/Contexts/Subscription/

# Run specific test
php artisan test tests/Feature/Contexts/Subscription/CreateSubscriptionTest.php

# With coverage
php artisan test tests/Feature/Contexts/Subscription/ --coverage-text
```

### **Test Structure**
```php
// Example test
test('denies feature if not in plan', function () {
    $tenant = Tenant::factory()->create();
    
    // Subscribe to free plan (no bulk_export feature)
    app(SubscriptionService::class)->subscribe($tenant->id, 'digital_card', 'free');
    
    $featureGate = app(FeatureGateService::class);
    expect($featureGate->can($tenant->id, 'digital_card', 'bulk_export'))
        ->toBeFalse();
});
```

---

## **🔒 Security & Best Practices**

### **Tenant Isolation**
- ✅ All queries include `tenant_id` check
- ✅ Subscriptions are tenant-scoped
- ✅ No cross-tenant data leaks possible

### **Domain Layer Purity**
- ✅ **Domain layer has ZERO Laravel/framework dependencies**
- ✅ All framework code isolated in Infrastructure layer
- ✅ Business logic testable without Laravel

### **Type Safety**
```php
// ✅ GOOD: Using Value Objects
$planId = PlanId::fromString($uuid);
$featureName = FeatureName::from('digital_cards');

// ❌ BAD: Using primitives
$planId = $uuid; // String
$featureName = 'digital_cards'; // String
```

---

## **🚀 Integration with Other Contexts**

### **DigitalCard Context (Phase 1)**
```php
// In DigitalCardServiceProvider
public function register(): void
{
    $this->app->when(IssueCardHandler::class)
        ->needs(FeatureGateService::class)
        ->give(function ($app) {
            return $app->make(FeatureGateService::class);
        });
}
```

### **Middleware for Route Protection**
```php
// app/Http/Middleware/CheckSubscription.php
class CheckSubscription
{
    public function handle($request, $next, $moduleSlug)
    {
        $featureGate = app(FeatureGateService::class);
        
        if (!$featureGate->can($request->tenant()->id, $moduleSlug, 'access')) {
            return response()->json(['error' => 'Subscription required'], 402);
        }
        
        return $next($request);
    }
}

// In routes
Route::middleware(['tenant', 'auth', 'check_subscription:digital_card'])
    ->group(function () {
        Route::post('/cards', [CardController::class, 'store']);
    });
```

---

## **📈 Monitoring & Debugging**

### **Checking Current State**
```php
// Debug helper
public function debugSubscription(string $tenantId, string $moduleSlug): array
{
    $subscriptionService = app(SubscriptionService::class);
    $featureGate = app(FeatureGateService::class);
    
    return [
        'has_subscription' => $subscriptionService->hasSubscription($tenantId, $moduleSlug),
        'plan' => $subscriptionService->getPlanFor($tenantId, $moduleSlug)?->name(),
        'can_access' => $featureGate->can($tenantId, $moduleSlug, 'digital_cards'),
        'quota' => $featureGate->quota($tenantId, $moduleSlug, 'digital_cards'),
    ];
}
```

### **Database Queries**
```sql
-- Find all tenants subscribed to DigitalCard
SELECT t.name, t.email, p.name as plan_name
FROM tenants t
JOIN subscriptions s ON t.id = s.tenant_id
JOIN plans p ON s.plan_id = p.id
WHERE s.module_slug = 'digital_card'
  AND s.status = 'active';

-- Check quota usage
SELECT COUNT(*) as cards_issued
FROM tenant_databases.tenant_{id}.digital_cards
WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
```

---

## **🔮 Future Enhancements (Phase 2+)**

### **1. Payment Processing** ⏳
```php
// Planned: Payment integration
interface PaymentProcessor
{
    public function createInvoice(Tenant $tenant, Plan $plan): Invoice;
    public function processPayment(Invoice $invoice, PaymentMethod $method): PaymentResult;
}

// Integration with eSewa/Stripe
class EsewaPaymentProcessor implements PaymentProcessor { ... }
class StripePaymentProcessor implements PaymentProcessor { ... }
```

### **2. Advanced Billing Features** ⏳
- Usage-based pricing (per card beyond quota)
- Annual vs monthly billing
- Volume discounts
- Coupon codes

### **3. Subscription Management UI** ⏳
```vue
<!-- Admin UI for subscription management -->
<SubscriptionManagement
    :tenant="tenant"
    :current-subscription="subscription"
    @upgrade="handleUpgrade"
    @downgrade="handleDowngrade"
    @cancel="handleCancellation"
/>
```

### **4. Analytics & Reporting** ⏳
- Usage dashboards
- Revenue reports
- Churn analysis
- Forecasting

### **5. Webhook System** ⏳
```php
// Notify other services on subscription events
SubscriptionCreated::class => [
    SendWelcomeEmail::class,
    UpdateAnalytics::class,
    SyncToCRM::class,
],
SubscriptionCancelled::class => [
    SendCancellationEmail::class,
    TriggerRetentionCampaign::class,
],
```

### **6. Trial Management** ⏳
```php
// Enhanced trial logic
class TrialManager
{
    public function grantTrial(Tenant $tenant, string $module, int $days = 30): Trial;
    public function checkTrialStatus(Tenant $tenant, string $module): TrialStatus;
    public function convertTrialToPaid(Trial $trial, string $planSlug): Subscription;
}
```

### **7. Multi-Module Bundles** ⏳
```php
// Bundle multiple modules
$bundle = new ModuleBundle('political_party_essentials', [
    'digital_card' => 'enterprise',
    'membership' => 'professional',
    'forum' => 'basic'
]);

$subscriptionService->subscribeToBundle($tenantId, $bundle);
```

---

## **⚠️ Common Pitfalls & Solutions**

### **1. Missing Tenant Context**
```php
// ❌ Wrong: No tenant check
$subscription = SubscriptionModel::where('module_slug', 'digital_card')->first();

// ✅ Correct: Always include tenant_id
$subscription = SubscriptionModel::where('tenant_id', $tenantId)
    ->where('module_slug', 'digital_card')
    ->first();
```

### **2. Primitive Obsession**
```php
// ❌ Wrong: Using strings directly
if ($plan->hasFeature('bulk_export')) { ... }

// ✅ Correct: Using Value Objects
$featureName = FeatureName::from('bulk_export');
if ($plan->hasFeature($featureName)) { ... }
```

### **3. Business Logic in Controllers**
```php
// ❌ Wrong: Business logic in controller
class SubscriptionController
{
    public function store(Request $request)
    {
        // Complex validation and business logic here
    }
}

// ✅ Correct: Business logic in Domain/Application
class SubscriptionService
{
    public function subscribe(string $tenantId, string $moduleSlug, string $planSlug): Subscription
    {
        // Business logic here
    }
}
```

---

## **📚 Learning Resources**

### **Key Concepts**
1. **Domain-Driven Design**: Bounded Contexts, Aggregates, Value Objects
2. **Repository Pattern**: Interface segregation, persistence ignorance
3. **Dependency Injection**: Inversion of Control, testability
4. **Multi-tenancy**: Database isolation, tenant context

### **Recommended Reading**
- "Domain-Driven Design" by Eric Evans
- "Implementing Domain-Driven Design" by Vaughn Vernon
- Laravel documentation on Service Providers, Eloquent

---

## **🎯 Quick Reference**

### **Service Instantiation**
```php
// Through dependency injection (recommended)
public function __construct(FeatureGateService $featureGate) { ... }

// Through service container
$featureGate = app(FeatureGateService::class);
$subscriptionService = app(SubscriptionService::class);
```

### **Common Operations**
```php
// 1. Subscribe tenant
$subscriptionService->subscribe($tenantId, 'digital_card', 'professional');

// 2. Check feature access
$canAccess = $featureGate->can($tenantId, 'digital_card', 'bulk_export');

// 3. Check quota
$quota = $featureGate->quota($tenantId, 'digital_card', 'digital_cards');
$isExceeded = $featureGate->isQuotaExceeded($tenantId, 'digital_card', 'digital_cards', $usage);

// 4. Get subscription info
$hasSubscription = $subscriptionService->hasSubscription($tenantId, 'digital_card');
$plan = $subscriptionService->getPlanFor($tenantId, 'digital_card');
```

---

## **🛠️ Maintenance & Updates**

### **Database Migrations**
```bash
# Create new migration
php artisan make:migration add_new_feature_to_plans --connection=landlord

# Run migrations
php artisan migrate --path=app/Contexts/Subscription/Infrastructure/Database/Migrations/
```

### **Adding New Plan**
1. Insert into `plans` table
2. Insert features into `plan_features`
3. Update `PlanSeeder.php`
4. Update documentation

### **Versioning**
- Keep backward compatibility when modifying Domain interfaces
- Use feature flags for new functionality
- Maintain comprehensive test coverage

---

## **✅ Success Checklist**

### **Before Production**
- [ ] All tests passing (15/15)
- [ ] PHPStan Level 8 clean
- [ ] Database indexes verified
- [ ] Tenant isolation tested
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Monitoring alerts set up
- [ ] Backup strategy in place

### **Ongoing**
- [ ] Regular security audits
- [ ] Performance monitoring
- [ ] Usage analytics
- [ ] Customer feedback collection
- [ ] Plan optimization based on data

---

## **🚨 Emergency Procedures**

### **Subscription System Down**
1. **Check logs**: `tail -f storage/logs/laravel.log`
2. **Verify database connection**: `php artisan db:monitor`
3. **Check service provider registration**: `php artisan route:list`
4. **Test with minimal setup**: Use test tenant

### **Data Corruption**
1. **Restore from backup**
2. **Run data integrity checks**
3. **Audit subscription consistency**
4. **Notify affected tenants**

---

## **🎉 Congratulations!**

You have successfully implemented a **production-ready subscription system** with:
- ✅ Clean DDD architecture
- ✅ Comprehensive test coverage  
- ✅ Tenant isolation
- ✅ Feature gating & quotas
- ✅ Ready for Phase 1 integration

**Next Step**: Begin **Phase 1 DigitalCard** development with subscription checks built-in from day one!

**Questions?** Refer to:
- Test files for usage examples
- Domain entities for business logic
- Service interfaces for available methods
- This guide for architecture decisions

---

**📅 Last Updated**: 2025-12-26  
**📈 Status**: **Phase 0.1 COMPLETE** ✅  
**🚀 Next Phase**: **Phase 1 DigitalCard Development**