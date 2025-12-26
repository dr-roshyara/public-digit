# 🎯 **YES! "Subscription Contexts" is PERFECT!**

That's an **excellent name** that captures exactly what we're building. Let's formalize this:

## 📦 **Project Name: Subscription Contexts**

### **Why This Name Works:**

1. **"Subscription"** → Payment-based access control
2. **"Contexts"** → DDD alignment (Elections Context, Finance Context, etc.)
3. **Clear Purpose** → Immediately tells what it does
4. **Scalable** → Can have unlimited contexts

## 🏗️ **Architecture: Subscription Contexts System**

### **Core Philosophy:**
> "Every business context (module) is a subscription-managed capability"

### **Directory Structure:**
```
app/
├── Contexts/                          ← Existing DDD contexts
│   ├── Elections/                     # Elections domain
│   ├── Finance/                       # Finance domain  
│   ├── Membership/                    # Membership domain
│   └── ...                            # Other contexts
│
├── Subscription/                      ← NEW: Subscription Contexts System
│   ├── Core/                          # Subscription system core
│   │   ├── Contracts/                 # Interfaces
│   │   ├── Registry/                  # Context registry
│   │   ├── Installer/                 # Installation engine
│   │   ├── Validator/                 # Validation engine
│   │   └── Events/                    # Domain events
│   │
│   ├── Management/                    # Subscription management
│   │   ├── Plans/                     # Plan definitions
│   │   ├── Billing/                   # Payment processing
│   │   ├── Entitlements/              # Feature access control
│   │   └── Analytics/                 # Usage analytics
│   │
│   ├── Admin/                         # Admin interface
│   │   ├── Controllers/
│   │   ├── Requests/
│   │   └── Resources/
│   │
│   └── UI/                            # Vue3 components
│       ├── Marketplace/
│       ├── Dashboard/
│       └── Installer/
│
└── Modules/                           ← NEW: Subscription Module Definitions
    ├── Elections/                     # Elections subscription module
    │   ├── Module.yaml               # Module definition
    │   ├── Features.yaml             # Feature definitions
    │   ├── Plans.yaml                # Pricing plans
    │   └── Dependencies.yaml         # Dependencies
    │
    ├── Finance/                      # Finance subscription module
    └── Membership/                   # Membership subscription module
```

## 🔄 **How It Works:**

### **1. Context Registration**
```php
// Each DDD context registers itself
namespace App\Contexts\Elections;

class ElectionsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Register with Subscription Contexts system
        SubscriptionRegistry::registerContext(
            slug: 'elections',
            name: 'Elections System',
            description: 'Complete election management',
            contextClass: self::class,
            features: [
                'create_election',
                'manage_candidates', 
                'voter_registration'
            ]
        );
    }
}
```

### **2. Subscription Management**
```php
namespace App\Subscription\Management;

class SubscriptionManager
{
    public function subscribe(Tenant $tenant, string $contextSlug, string $planSlug): Subscription
    {
        // 1. Validate context exists
        $context = SubscriptionRegistry::getContext($contextSlug);
        
        // 2. Process payment
        $payment = $this->billing->charge($tenant, $context, $planSlug);
        
        // 3. Install context
        $this->installer->install($tenant, $context, $planSlug);
        
        // 4. Create subscription record
        return Subscription::create([
            'tenant_id' => $tenant->id,
            'context_slug' => $contextSlug,
            'plan_slug' => $planSlug,
            'status' => 'active',
            'period_start' => now(),
            'period_end' => now()->addMonth()
        ]);
    }
}
```

### **3. Feature Gate (Middleware)**
```php
namespace App\Subscription\Middleware;

class SubscriptionContextMiddleware
{
    public function handle(Request $request, Closure $next, string $context, string $feature)
    {
        $tenant = $request->tenant();
        
        if (!SubscriptionGate::allows($tenant, $context, $feature)) {
            // Redirect to upgrade page or show error
            return redirect()->route('subscription.upgrade', [
                'context' => $context,
                'required_feature' => $feature
            ]);
        }
        
        return $next($request);
    }
}

// Usage in routes
Route::post('/elections', [ElectionController::class, 'store'])
    ->middleware('subscription:elections,create_election');
```

## 🎨 **Admin Interface Structure**

### **1. Subscription Dashboard**
```vue
<!-- resources/js/Subscription/UI/Dashboard.vue -->
<template>
  <div class="subscription-dashboard">
    <!-- Tenant's Current Subscriptions -->
    <div class="current-subscriptions">
      <h3>Active Contexts</h3>
      <div v-for="subscription in subscriptions" 
           :key="subscription.context_slug"
           class="subscription-card">
        <h4>{{ subscription.context_name }}</h4>
        <p>Plan: {{ subscription.plan_name }}</p>
        <p>Renews: {{ formatDate(subscription.period_end) }}</p>
        <button @click="manageSubscription(subscription)">
          Manage
        </button>
      </div>
    </div>
    
    <!-- Available Contexts -->
    <div class="available-contexts">
      <h3>Available Contexts</h3>
      <ContextMarketplace 
        :tenant="tenant"
        @select-context="showContextDetails" />
    </div>
  </div>
</template>
```

### **2. Context Marketplace**
```vue
<!-- resources/js/Subscription/UI/Marketplace/ContextCard.vue -->
<template>
  <div class="context-card" :class="{ 'has-subscription': hasSubscription }">
    <div class="context-icon">
      <i :class="context.icon"></i>
    </div>
    
    <div class="context-info">
      <h4>{{ context.name }}</h4>
      <p>{{ context.description }}</p>
      
      <!-- Feature List -->
      <div class="features">
        <span v-for="feature in context.features" 
              :key="feature"
              class="feature-badge">
          {{ feature }}
        </span>
      </div>
    </div>
    
    <!-- Plan Selector -->
    <div class="plan-selector" v-if="!hasSubscription">
      <select v-model="selectedPlan">
        <option v-for="plan in context.plans" 
                :key="plan.slug"
                :value="plan.slug">
          {{ plan.name }} - ${{ plan.price }}/{{ plan.cycle }}
        </option>
      </select>
      
      <button @click="subscribe" class="btn-subscribe">
        Subscribe
      </button>
    </div>
    
    <!-- Manage Subscription -->
    <div v-else class="current-plan">
      <p>Current: {{ currentPlan.name }}</p>
      <button @click="upgrade" class="btn-upgrade">
        Upgrade/Downgrade
      </button>
    </div>
  </div>
</template>
```

## 📊 **Database Schema**

```sql
-- Subscription Contexts Core Tables
CREATE TABLE subscription_contexts (
    slug VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200),
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
);

CREATE TABLE context_features (
    id UUID PRIMARY KEY,
    context_slug VARCHAR(100) REFERENCES subscription_contexts(slug),
    slug VARCHAR(100),
    name VARCHAR(200),
    description TEXT,
    is_core BOOLEAN DEFAULT false,
    UNIQUE(context_slug, slug)
);

CREATE TABLE context_plans (
    id UUID PRIMARY KEY,
    context_slug VARCHAR(100) REFERENCES subscription_contexts(slug),
    slug VARCHAR(50),
    name VARCHAR(200),
    description TEXT,
    price DECIMAL(10,2),
    billing_cycle VARCHAR(20), -- monthly, annual
    trial_days INTEGER,
    features JSONB, -- Which features included
    limits JSONB,   -- Usage limits
    is_active BOOLEAN DEFAULT true,
    UNIQUE(context_slug, slug)
);

-- Tenant Subscriptions
CREATE TABLE tenant_context_subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    context_slug VARCHAR(100) REFERENCES subscription_contexts(slug),
    plan_slug VARCHAR(50),
    status VARCHAR(20), -- active, canceled, past_due
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    stripe_subscription_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP,
    UNIQUE(tenant_id, context_slug)
);

-- Feature Usage Tracking
CREATE TABLE tenant_feature_usage (
    tenant_id UUID REFERENCES tenants(id),
    context_slug VARCHAR(100),
    feature_slug VARCHAR(100),
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    period_reset_at TIMESTAMP,
    PRIMARY KEY (tenant_id, context_slug, feature_slug)
);
```

## 🔧 **Implementation Roadmap**

### **Phase 1: Core Subscription System (Week 1-2)**
```
1. Subscription Context Registry
2. Basic YAML module definitions  
3. Simple installation engine
4. Feature gate middleware
```

### **Phase 2: Payment Integration (Week 3-4)**
```
1. Stripe/Paddle integration
2. Subscription lifecycle management
3. Webhook handlers
4. Billing portal
```

### **Phase 3: Admin Interface (Week 5-6)**
```
1. Vue3 marketplace
2. Subscription dashboard
3. Usage analytics
4. Upgrade/downgrade flows
```

### **Phase 4: Advanced Features (Week 7-8)**
```
1. Bundle subscriptions
2. Trial periods
3. Usage-based billing
4. API for third-party contexts
```

## 🚀 **First Implementation Steps**

### **Step 1: Create Subscription Core**
```bash
php artisan make:context Subscription
# Creates: app/Subscription/Core/

php artisan make:model SubscriptionContext -m
php artisan make:model TenantSubscription -m
```

### **Step 2: Create YAML Definitions**
```yaml
# modules/elections/Context.yaml
context:
  slug: elections
  name: Elections System
  icon: vote-yea
  category: governance
  
  features:
    - slug: create_election
      name: Create Election
      
    - slug: manage_candidates
      name: Manage Candidates
      requires: [create_election]
  
  plans:
    basic:
      name: Basic Elections
      price: 0
      features: [create_election]
      
    professional:
      name: Professional
      price: 99
      features: [create_election, manage_candidates]
```

### **Step 3: Basic Installation**
```php
// Install a context
$subscriptionManager->subscribe(
    tenant: $tenant,
    context: 'elections',
    plan: 'professional'
);

// Results in:
// 1. Elections context installed in tenant DB
// 2. Subscription record created
// 3. Feature gates activated
```

## 📈 **Business Benefits**

1. **Clear Pricing** → Each context has clear plans/features
2. **Easy Upselling** → "Upgrade Elections to Professional"
3. **Usage Tracking** → Monitor which contexts are used
4. **Clean Architecture** → Separation of payment from business logic
5. **Marketplace Ready** → Can sell contexts independently

## 🎯 **How This Fits Your Needs:**

For your modules:
- **Elections Context** → Subscription plans (Basic/Pro/Enterprise)
- **Finance Context** → Subscription plans (Basic/Pro)
- **Membership Context** → Subscription plans (Basic/Premium)
- **Digital Card Context** → Subscription plans
- **Forum Context** → Subscription plans

**Each becomes a monetizable product!**

## ❓ **Questions to Decide:**

1. **Should we start with Elections context as first example?**
2. **Which payment provider? Stripe or Paddle?**
3. **Do you want trial periods for contexts?**
4. **Should bundles be implemented from start?**

**Ready to start building "Subscription Contexts"?** I can create the first implementation files for you!