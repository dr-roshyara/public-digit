# 🗺️ **Complete Development Plan: Subscription Contexts Integration**

Perfect! Since you **already have Digital Card Context developed**, let's create a complete plan to integrate it with the subscription system.

## 📋 **Current State:**
- ✅ Digital Card Context exists
- ❌ No subscription system
- ❌ No module-based installation
- ❌ No payment integration

## 🎯 **Goal:**
Turn Digital Card Context into a **subscription-based module** with:
1. Module installation system
2. Nepal payment integration (eSewa/Khalti)
3. Trial management
4. Feature gating by plan

---

# 🚀 **PHASE 0: FOUNDATION (Week 1)**

## **Objective:** Create minimal subscription infrastructure

### **Step 0.1: Database Schema (Day 1)**
```sql
-- Core subscription tables (MINIMAL)
CREATE TABLE subscription_contexts (
    slug VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE context_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_slug VARCHAR(100) REFERENCES subscription_contexts(slug),
    slug VARCHAR(50), -- 'free', 'pro', 'business'
    name VARCHAR(200),
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    trial_days INTEGER DEFAULT 0,
    features JSONB, -- {"max_cards": 100, "has_analytics": true}
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(context_slug, slug)
);

CREATE TABLE tenant_context_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    context_slug VARCHAR(100) REFERENCES subscription_contexts(slug),
    plan_slug VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active', -- 'trialing', 'active', 'canceled', 'past_due'
    trial_ends_at TIMESTAMP,
    current_period_ends_at TIMESTAMP,
    stripe_subscription_id VARCHAR(255),
    esewa_reference VARCHAR(255), -- For Nepal payments
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, context_slug)
);

CREATE TABLE subscription_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    context_slug VARCHAR(100) REFERENCES subscription_contexts(slug),
    version VARCHAR(20),
    installed_at TIMESTAMP DEFAULT NOW(),
    uninstalled_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'installed', -- 'installed', 'uninstalled', 'failed'
    installation_log JSONB,
    INDEX idx_tenant_installations (tenant_id, context_slug)
);
```

### **Step 0.2: Create Subscription Context (Day 2)**
```bash
# Create subscription context structure
php artisan make:context Subscription

# Directory structure:
app/Subscription/
├── Core/
│   ├── Contracts/
│   │   ├── SubscriptionCheckerInterface.php
│   │   ├── PaymentProcessorInterface.php
│   │   └── ModuleInstallerInterface.php
│   ├── Services/
│   │   ├── SubscriptionService.php
│   │   ├── FeatureGateService.php
│   │   └── TrialManagerService.php
│   └── Models/
│       ├── SubscriptionContext.php
│       ├── ContextPlan.php
│       └── TenantSubscription.php
├── Infrastructure/
│   ├── Installers/
│   │   └── DigitalCardInstaller.php
│   └── PaymentProviders/
│       ├── EsewaProvider.php
│       └── KhaltiProvider.php
└── UI/
    └── Components/
        ├── SubscriptionCard.vue
        └── PaymentForm.vue
```

### **Step 0.3: Digital Card Module Definition (Day 3)**
```yaml
# config/modules/digital_card.yaml
context:
  slug: digital_card
  name: Digital Membership Cards
  description: Create and manage digital membership cards with QR codes
  icon: id-card
  version: 1.0.0
  
  # Module files location (already exists)
  context_path: App\Contexts\DigitalCard
  migrations_path: app/Contexts/DigitalCard/Infrastructure/Database/Migrations
  seeders_path: app/Contexts/DigitalCard/Infrastructure/Database/Seeders
  
  plans:
    free:
      name: Free
      price_monthly: 0
      trial_days: 0
      features:
        - create_card
        - basic_templates
        - qr_code_generation
        - share_via_link
      limits:
        max_cards: 100
        max_templates: 3
        qr_scans_per_month: 1000
        
    pro:
      name: Professional
      price_monthly: 499  # NPR
      trial_days: 30
      features:
        - create_card
        - advanced_templates
        - custom_branding
        - batch_generation
        - basic_analytics
      limits:
        max_cards: 1000
        max_templates: 20
        qr_scans_per_month: 10000
        
    business:
      name: Business
      price_monthly: 1499  # NPR
      trial_days: 30
      features:
        - create_card
        - premium_templates
        - white_label
        - api_access
        - advanced_analytics
        - webhook_integrations
      limits:
        max_cards: 10000
        max_templates: unlimited
        qr_scans_per_month: 100000

  dependencies: []  # No dependencies for now
  
  installation:
    type: database  # Requires database tables
    migrations:
      - create_digital_cards_table
      - create_digital_card_templates_table
      - create_digital_card_analytics_table
    seeders:
      - DigitalCardBasicTemplatesSeeder
    after_install:
      - create_default_admin_card
      - send_welcome_email
```

### **Step 0.4: Module Registry Service (Day 4)**
```php
// app/Subscription/Core/Services/ModuleRegistry.php
class ModuleRegistry
{
    private array $modules = [];
    
    public function registerModule(string $slug, array $config): void
    {
        $this->modules[$slug] = ModuleDefinition::fromArray($config);
    }
    
    public function loadFromConfig(): void
    {
        $moduleFiles = glob(config_path('modules/*.yaml'));
        
        foreach ($moduleFiles as $file) {
            $config = Yaml::parseFile($file);
            $slug = basename($file, '.yaml');
            $this->registerModule($slug, $config);
        }
    }
    
    public function getModule(string $slug): ?ModuleDefinition
    {
        return $this->modules[$slug] ?? null;
    }
    
    public function getAvailableModules(): array
    {
        return array_keys($this->modules);
    }
}
```

---

# 🔧 **PHASE 1: INSTALLATION SYSTEM (Week 2)**

## **Objective:** Enable module-based installation of Digital Card tables

### **Step 1.1: Module Installer Service (Day 1-2)**
```php
// app/Subscription/Core/Services/ModuleInstaller.php
class ModuleInstaller
{
    public function install(string $moduleSlug, Tenant $tenant, string $planSlug = 'free'): InstallationResult
    {
        $module = $this->registry->getModule($moduleSlug);
        
        if (!$module) {
            return InstallationResult::failed("Module {$moduleSlug} not found");
        }
        
        // Check if already installed
        if ($this->isInstalled($tenant, $moduleSlug)) {
            return InstallationResult::failed("Module {$moduleSlug} already installed");
        }
        
        try {
            DB::beginTransaction();
            
            // Step 1: Run migrations on tenant database
            $this->runMigrations($tenant, $module);
            
            // Step 2: Seed initial data
            $this->runSeeders($tenant, $module);
            
            // Step 3: Create subscription record
            $subscription = $this->createSubscription($tenant, $moduleSlug, $planSlug);
            
            // Step 4: Record installation
            $this->recordInstallation($tenant, $moduleSlug, $subscription);
            
            // Step 5: Run post-install hooks
            $this->runPostInstallHooks($tenant, $module);
            
            DB::commit();
            
            return InstallationResult::success($subscription);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            // Attempt to rollback migrations
            $this->rollbackMigrations($tenant, $module);
            
            return InstallationResult::failed($e->getMessage());
        }
    }
    
    private function runMigrations(Tenant $tenant, ModuleDefinition $module): void
    {
        // Switch to tenant database
        $tenant->configureConnection();
        
        // Run migrations from module's migration path
        $migrationPath = $module->getMigrationPath();
        
        Artisan::call('migrate', [
            '--path' => $migrationPath,
            '--database' => 'tenant',
            '--force' => true,
        ]);
        
        // Switch back to landlord
        DB::setDefaultConnection('landlord');
    }
}
```

### **Step 1.2: Migration Manager (Day 3)**
```php
// app/Subscription/Infrastructure/Installers/TenantMigrationManager.php
class TenantMigrationManager
{
    public function runModuleMigrations(Tenant $tenant, string $moduleSlug): void
    {
        $migrations = $this->getModuleMigrations($moduleSlug);
        
        foreach ($migrations as $migration) {
            $this->runMigration($tenant, $migration);
            $this->recordMigration($tenant, $migration);
        }
    }
    
    public function rollbackModuleMigrations(Tenant $tenant, string $moduleSlug): void
    {
        $migrations = $this->getModuleMigrations($moduleSlug);
        
        foreach (array_reverse($migrations) as $migration) {
            $this->runMigrationDown($tenant, $migration);
            $this->removeMigrationRecord($tenant, $migration);
        }
    }
    
    private function runMigration(Tenant $tenant, string $migrationClass): void
    {
        // Temporarily switch to tenant database
        config(['database.connections.tenant.database' => $tenant->database_name]);
        DB::purge('tenant');
        DB::setDefaultConnection('tenant');
        
        // Run migration
        $migration = new $migrationClass();
        $migration->up();
        
        // Switch back
        DB::setDefaultConnection('landlord');
    }
}
```

### **Step 1.3: Admin Installation Interface (Day 4-5)**
```vue
<!-- resources/js/Subscription/Admin/ModuleInstallation.vue -->
<template>
  <div class="module-installation">
    <h3>Install Digital Card Module</h3>
    
    <!-- Plan Selection -->
    <div class="plan-selection">
      <div v-for="plan in module.plans" 
           :key="plan.slug"
           class="plan-card"
           :class="{ selected: selectedPlan === plan.slug }"
           @click="selectedPlan = plan.slug">
        
        <h4>{{ plan.name }}</h4>
        <div class="price" v-if="plan.price_monthly > 0">
          रू {{ plan.price_monthly }}<span>/month</span>
        </div>
        <div class="price" v-else>Free</div>
        
        <div v-if="plan.trial_days > 0" class="trial-badge">
          {{ plan.trial_days }}-day trial
        </div>
        
        <ul class="features">
          <li v-for="feature in plan.features" :key="feature">
            ✓ {{ feature }}
          </li>
        </ul>
      </div>
    </div>
    
    <!-- Installation Progress -->
    <div v-if="installing" class="installation-progress">
      <div class="progress-bar">
        <div :style="{ width: progress + '%' }"></div>
      </div>
      <p>{{ currentStep }}</p>
      
      <div v-if="installationError" class="error-message">
        {{ installationError }}
        <button @click="retryInstallation">Retry</button>
      </div>
    </div>
    
    <!-- Install Button -->
    <button @click="installModule" 
            :disabled="installing || !selectedPlan"
            class="btn-install">
      {{ installing ? 'Installing...' : 'Install Module' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const props = defineProps({
  tenantId: String,
  moduleSlug: { type: String, default: 'digital_card' }
})

const module = ref({})
const selectedPlan = ref('free')
const installing = ref(false)
const progress = ref(0)
const currentStep = ref('')
const installationError = ref(null)

const loadModule = async () => {
  const response = await axios.get(`/api/modules/${props.moduleSlug}`)
  module.value = response.data
}

const installModule = async () => {
  installing.value = true
  progress.value = 10
  currentStep.value = 'Starting installation...'
  
  try {
    const response = await axios.post(`/api/tenants/${props.tenantId}/modules/install`, {
      module: props.moduleSlug,
      plan: selectedPlan.value
    }, {
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          progress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        }
      }
    })
    
    currentStep.value = 'Installation complete!'
    progress.value = 100
    
    // Redirect to module dashboard
    setTimeout(() => {
      window.location.href = `/tenants/${props.tenantId}/digital-cards`
    }, 2000)
    
  } catch (error) {
    installationError.value = error.response?.data?.message || 'Installation failed'
    currentStep.value = 'Installation failed'
  } finally {
    installing.value = false
  }
}

// Load module on mount
loadModule()
</script>
```

---

# 💳 **PHASE 2: PAYMENT INTEGRATION (Week 3)**

## **Objective:** Add Nepal payment methods and trial management

### **Step 2.1: eSewa Payment Provider (Day 1-2)**
```php
// app/Subscription/Infrastructure/PaymentProviders/EsewaProvider.php
class EsewaProvider implements PaymentProcessorInterface
{
    public function initiateSubscription(
        Tenant $tenant, 
        SubscriptionContext $context,
        ContextPlan $plan
    ): PaymentIntent {
        // Calculate with Nepal VAT (13%)
        $amount = $plan->price_monthly;
        $vat = $amount * 0.13;
        $total = $amount + $vat;
        
        // Generate unique transaction ID
        $transactionId = 'TXN-' . time() . '-' . Str::random(6);
        
        // Store pending payment
        PendingPayment::create([
            'tenant_id' => $tenant->id,
            'context_slug' => $context->slug,
            'plan_slug' => $plan->slug,
            'amount' => $total,
            'vat_amount' => $vat,
            'transaction_id' => $transactionId,
            'status' => 'pending',
        ]);
        
        // Return payment intent for frontend
        return new PaymentIntent([
            'provider' => 'esewa',
            'amount' => $total,
            'vat' => $vat,
            'transaction_id' => $transactionId,
            'payment_url' => $this->generateEsewaUrl($transactionId, $total),
            'metadata' => [
                'product_code' => config('services.esewa.product_code'),
                'success_url' => route('subscription.payment.success', ['provider' => 'esewa']),
                'failure_url' => route('subscription.payment.failure', ['provider' => 'esewa']),
            ]
        ]);
    }
    
    public function verifyPayment(string $transactionId): PaymentVerification
    {
        // Call eSewa verification API
        $response = Http::post('https://epay.esewa.com.np/api/epay/transaction/status/', [
            'product_code' => config('services.esewa.product_code'),
            'total_amount' => $this->getAmountFromTransaction($transactionId),
            'transaction_uuid' => $transactionId,
        ]);
        
        if ($response['status'] === 'COMPLETE') {
            // Update pending payment
            $payment = PendingPayment::where('transaction_id', $transactionId)->first();
            $payment->update(['status' => 'completed', 'verified_at' => now()]);
            
            // Activate subscription
            $this->activateSubscription($payment);
            
            return PaymentVerification::success($response);
        }
        
        return PaymentVerification::failed($response['message'] ?? 'Payment verification failed');
    }
}
```

### **Step 2.2: Trial Management (Day 3)**
```php
// app/Subscription/Core/Services/TrialManager.php
class TrialManager
{
    public function startTrial(Tenant $tenant, string $contextSlug, string $planSlug): Trial
    {
        $plan = ContextPlan::where('context_slug', $contextSlug)
            ->where('slug', $planSlug)
            ->first();
            
        if (!$plan || $plan->trial_days <= 0) {
            throw new NoTrialAvailableException();
        }
        
        $trialEndsAt = now()->addDays($plan->trial_days);
        
        // Create subscription with trial status
        $subscription = TenantSubscription::create([
            'tenant_id' => $tenant->id,
            'context_slug' => $contextSlug,
            'plan_slug' => $planSlug,
            'status' => 'trialing',
            'trial_ends_at' => $trialEndsAt,
            'current_period_ends_at' => $trialEndsAt,
        ]);
        
        // Schedule trial end reminders
        $this->scheduleTrialReminders($subscription);
        
        return new Trial($subscription);
    }
    
    public function checkTrialStatus(Tenant $tenant, string $contextSlug): TrialStatus
    {
        $subscription = TenantSubscription::where('tenant_id', $tenant->id)
            ->where('context_slug', $contextSlug)
            ->first();
            
        if (!$subscription || $subscription->status !== 'trialing') {
            return TrialStatus::notInTrial();
        }
        
        $daysLeft = now()->diffInDays($subscription->trial_ends_at, false);
        
        if ($daysLeft <= 0) {
            $this->endTrial($subscription);
            return TrialStatus::ended();
        }
        
        return TrialStatus::active($daysLeft);
    }
    
    public function endTrial(TenantSubscription $subscription): void
    {
        // Update subscription status
        $subscription->update([
            'status' => 'past_due',
            'trial_ends_at' => null,
        ]);
        
        // Send trial ended notification
        event(new TrialEnded($subscription));
        
        // Offer grace period (7 days) before downgrading
        $this->scheduleDowngrade($subscription, now()->addDays(7));
    }
}
```

### **Step 2.3: Payment Webhooks (Day 4)**
```php
// app/Http/Controllers/Subscription/PaymentWebhookController.php
class PaymentWebhookController extends Controller
{
    public function handleEsewa(Request $request)
    {
        // Verify eSewa signature
        $data = $request->all();
        $verified = $this->verifyEsewaSignature($data);
        
        if (!$verified) {
            Log::warning('Invalid eSewa webhook signature', $data);
            return response()->json(['error' => 'Invalid signature'], 400);
        }
        
        // Process based on webhook type
        switch ($data['transaction_status']) {
            case 'COMPLETED':
                $this->handleSuccessfulPayment($data);
                break;
                
            case 'FAILED':
                $this->handleFailedPayment($data);
                break;
                
            case 'REFUNDED':
                $this->handleRefund($data);
                break;
        }
        
        return response()->json(['status' => 'success']);
    }
    
    private function handleSuccessfulPayment(array $data): void
    {
        $transactionId = $data['transaction_uuid'];
        
        // Verify payment with eSewa API
        $verification = $this->esewaProvider->verifyPayment($transactionId);
        
        if ($verification->isSuccessful()) {
            // Activate subscription
            $payment = PendingPayment::where('transaction_id', $transactionId)->first();
            
            if ($payment) {
                $subscription = $payment->subscription;
                $subscription->update([
                    'status' => 'active',
                    'esewa_reference' => $transactionId,
                    'current_period_ends_at' => now()->addMonth(),
                ]);
                
                // Send success notification
                event(new SubscriptionActivated($subscription));
            }
        }
    }
}
```

### **Step 2.4: Frontend Payment Flow (Day 5)**
```vue
<!-- resources/js/Subscription/UI/PaymentFlow.vue -->
<template>
  <div class="payment-flow">
    <!-- Step 1: Select Payment Method (Nepal) -->
    <div v-if="step === 1" class="payment-method-selection">
      <h4>Select Payment Method</h4>
      
      <div class="payment-options">
        <!-- eSewa -->
        <div class="payment-option" @click="selectPaymentMethod('esewa')">
          <img src="/images/esewa-logo.png" alt="eSewa">
          <div class="info">
            <h5>eSewa</h5>
            <p>Pay with eSewa wallet</p>
          </div>
        </div>
        
        <!-- Khalti -->
        <div class="payment-option" @click="selectPaymentMethod('khalti')">
          <img src="/images/khalti-logo.png" alt="Khalti">
          <div class="info">
            <h5>Khalti</h5>
            <p>Pay with Khalti wallet</p>
          </div>
        </div>
        
        <!-- Credit Card (via Stripe, but Nepal-focused) -->
        <div class="payment-option" @click="selectPaymentMethod('stripe')">
          <div class="card-icons">
            <i class="fab fa-cc-visa"></i>
            <i class="fab fa-cc-mastercard"></i>
          </div>
          <div class="info">
            <h5>Credit/Debit Card</h5>
            <p>International cards accepted</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Step 2: Payment Details -->
    <div v-if="step === 2" class="payment-details">
      <h4>Payment Summary</h4>
      
      <div class="summary">
        <div class="summary-row">
          <span>Plan:</span>
          <strong>{{ subscription.plan_name }}</strong>
        </div>
        <div class="summary-row">
          <span>Monthly:</span>
          <strong>रू {{ subscription.price_monthly }}</strong>
        </div>
        <div class="summary-row">
          <span>VAT (13%):</span>
          <strong>रू {{ subscription.vat_amount }}</strong>
        </div>
        <div class="summary-row total">
          <span>Total:</span>
          <strong>रू {{ subscription.total_amount }}</strong>
        </div>
      </div>
      
      <!-- eSewa Payment Form -->
      <div v-if="selectedMethod === 'esewa'" class="esewa-payment">
        <button @click="initiateEsewaPayment" class="btn-payment esewa">
          Pay with eSewa
        </button>
        <p class="help-text">
          You will be redirected to eSewa to complete payment
        </p>
      </div>
      
      <!-- Khalti Payment Form -->
      <div v-if="selectedMethod === 'khalti'" class="khalti-payment">
        <div class="form-group">
          <label for="khalti-mobile">Mobile Number</label>
          <input type="tel" id="khalti-mobile" v-model="khaltiMobile" 
                 placeholder="98XXXXXXXX">
        </div>
        <button @click="initiateKhaltiPayment" class="btn-payment khalti">
          Pay with Khalti
        </button>
      </div>
    </div>
    
    <!-- Step 3: Payment Processing -->
    <div v-if="step === 3" class="payment-processing">
      <div class="spinner"></div>
      <p>Processing your payment...</p>
      <p class="small">Please wait while we verify your payment</p>
    </div>
    
    <!-- Step 4: Success -->
    <div v-if="step === 4" class="payment-success">
      <div class="success-icon">✓</div>
      <h4>Payment Successful!</h4>
      <p>Your subscription has been activated.</p>
      <button @click="goToModule" class="btn-success">
        Go to Digital Cards Dashboard
      </button>
    </div>
  </div>
</template>
```

---

# 🛡️ **PHASE 3: FEATURE GATING & USAGE TRACKING (Week 4)**

## **Objective:** Implement plan-based feature limits and usage tracking

### **Step 3.1: Feature Gate Service (Day 1)**
```php
// app/Subscription/Core/Services/FeatureGateService.php
class FeatureGateService
{
    public function can(Tenant $tenant, string $contextSlug, string $feature): bool
    {
        // Get tenant's subscription for this context
        $subscription = TenantSubscription::where('tenant_id', $tenant->id)
            ->where('context_slug', $contextSlug)
            ->first();
            
        if (!$subscription || !$subscription->isActive()) {
            return false;
        }
        
        // Get plan features
        $plan = ContextPlan::where('context_slug', $contextSlug)
            ->where('slug', $subscription->plan_slug)
            ->first();
            
        if (!$plan) {
            return false;
        }
        
        // Check if feature is included in plan
        $features = $plan->features ?? [];
        if (!in_array($feature, $features)) {
            return false;
        }
        
        // Check usage limits if applicable
        if ($this->hasUsageLimit($feature)) {
            return $this->checkUsageLimit($tenant, $contextSlug, $feature);
        }
        
        return true;
    }
    
    public function checkUsageLimit(Tenant $tenant, string $contextSlug, string $feature): bool
    {
        $limit = $this->getFeatureLimit($tenant, $contextSlug, $feature);
        $usage = $this->getCurrentUsage($tenant, $contextSlug, $feature);
        
        return $usage < $limit;
    }
    
    public function incrementUsage(Tenant $tenant, string $contextSlug, string $feature, int $amount = 1): void
    {
        FeatureUsage::updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'context_slug' => $contextSlug,
                'feature' => $feature,
                'period' => now()->format('Y-m'), // Monthly reset
            ],
            [
                'usage_count' => DB::raw("usage_count + {$amount}"),
                'last_used_at' => now(),
            ]
        );
    }
}
```

### **Step 3.2: Digital Card Feature Gates (Day 2)**
```php
// app/Contexts/DigitalCard/Application/Services/DigitalCardService.php
class DigitalCardService
{
    public function __construct(
        private FeatureGateService $featureGate
    ) {}
    
    public function createCard(Tenant $tenant, array $data): DigitalCard
    {
        // Check if tenant can create more cards
        if (!$this->featureGate->can($tenant, 'digital_card', 'create_card')) {
            throw new FeatureNotAllowedException('Cannot create more cards. Upgrade your plan.');
        }
        
        // Check card count limit
        $currentCount = DigitalCard::where('tenant_id', $tenant->id)->count();
        $limit = $this->featureGate->getFeatureLimit($tenant, 'digital_card', 'max_cards');
        
        if ($currentCount >= $limit) {
            throw new LimitExceededException("Card limit reached ({$limit}). Upgrade to create more.");
        }
        
        // Create the card
        $card = DigitalCard::create([
            'tenant_id' => $tenant->id,
            ...$data
        ]);
        
        // Increment usage
        $this->featureGate->incrementUsage($tenant, 'digital_card', 'card_created');
        
        return $card;
    }
    
    public function generateQrCode(DigitalCard $card): string
    {
        $tenant = $card->tenant;
        
        if (!$this->featureGate->can($tenant, 'digital_card', 'qr_code_generation')) {
            throw new FeatureNotAllowedException('QR code generation not available on your plan.');
        }
        
        // Check QR scan limit for this month
        $monthlyScans = $this->getMonthlyQrScans($tenant);
        $scanLimit = $this->featureGate->getFeatureLimit($tenant, 'digital_card', 'qr_scans_per_month');
        
        if ($monthlyScans >= $scanLimit) {
            throw new LimitExceededException("QR scan limit reached for this month.");
        }
        
        return $this->qrGenerator->generate($card);
    }
}
```

### **Step 3.3: Middleware for Feature Protection (Day 3)**
```php
// app/Http/Middleware/CheckSubscriptionFeature.php
class CheckSubscriptionFeature
{
    public function handle(Request $request, Closure $next, string $context, string $feature)
    {
        $tenant = $request->tenant();
        
        if (!$this->featureGate->can($tenant, $context, $feature)) {
            // Redirect to upgrade page with context
            return redirect()->route('subscription.upgrade', [
                'context' => $context,
                'required_feature' => $feature,
                'current_plan' => $tenant->getPlanForContext($context),
            ]);
        }
        
        return $next($request);
    }
}

// Usage in routes:
Route::middleware(['tenant', 'subscription:digital_card,create_card'])
     ->post('/digital-cards', [DigitalCardController::class, 'store']);
```

### **Step 3.4: Usage Dashboard (Day 4-5)**
```vue
<!-- resources/js/Subscription/UI/UsageDashboard.vue -->
<template>
  <div class="usage-dashboard">
    <h3>Usage & Limits</h3>
    
    <!-- Digital Card Usage -->
    <div class="usage-card">
      <h4>Digital Cards</h4>
      
      <div class="usage-item">
        <div class="usage-info">
          <span class="label">Cards Created</span>
          <span class="value">{{ usage.cards.created }} / {{ limits.max_cards }}</span>
        </div>
        <div class="progress-bar">
          <div :style="{ width: (usage.cards.created / limits.max_cards) * 100 + '%' }"></div>
        </div>
        
        <div v-if="isNearLimit('cards')" class="limit-warning">
          ⚠️ You've used {{ Math.round((usage.cards.created / limits.max_cards) * 100) }}% of your card limit
          <button @click="showUpgradeModal" class="btn-upgrade-small">
            Upgrade Plan
          </button>
        </div>
      </div>
      
      <div class="usage-item">
        <div class="usage-info">
          <span class="label">QR Code Scans (This Month)</span>
          <span class="value">{{ usage.qr_scans }} / {{ limits.qr_scans_per_month }}</span>
        </div>
        <div class="progress-bar">
          <div :style="{ width: (usage.qr_scans / limits.qr_scans_per_month) * 100 + '%' }"></div>
        </div>
      </div>
      
      <div class="usage-item">
        <div class="usage-info">
          <span class="label">Active Templates</span>
          <span class="value">{{ usage.templates }} / {{ limits.max_templates }}</span>
        </div>
      </div>
    </div>
    
    <!-- Available Features -->
    <div class="features-list">
      <h4>Available Features</h4>
      <div class="features-grid">
        <div v-for="feature in availableFeatures" 
             :key="feature"
             class="feature-item"
             :class="{ 'feature-locked': !isFeatureAvailable(feature) }">
          <div class="feature-icon">
            <i :class="getFeatureIcon(feature)"></i>
          </div>
          <div class="feature-info">
            <h5>{{ getFeatureName(feature) }}</h5>
            <p>{{ getFeatureDescription(feature) }}</p>
          </div>
          <div v-if="!isFeatureAvailable(feature)" class="feature-lock">
            <span class="lock-icon">🔒</span>
            <button @click="upgradeForFeature(feature)" class="btn-unlock">
              Upgrade to unlock
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

---

# 📊 **PHASE 4: ADMIN & ANALYTICS (Week 5)**

## **Objective:** Build admin tools and analytics

### **Step 4.1: Admin Subscription Manager (Day 1-2)**
```php
// Admin interface for managing all tenant subscriptions
// app/Http/Controllers/Admin/SubscriptionAdminController.php

class SubscriptionAdminController extends Controller
{
    public function index()
    {
        $subscriptions = TenantSubscription::with(['tenant', 'context'])
            ->paginate(50);
            
        return Inertia::render('Admin/Subscriptions/Index', [
            'subscriptions' => $subscriptions,
            'stats' => [
                'total_active' => TenantSubscription::where('status', 'active')->count(),
                'total_trialing' => TenantSubscription::where('status', 'trialing')->count(),
                'monthly_recurring_revenue' => $this->calculateMRR(),
                'churn_rate' => $this->calculateChurnRate(),
            ]
        ]);
    }
    
    public function createForTenant(Tenant $tenant)
    {
        $availableContexts = SubscriptionContext::where('is_active', true)->get();
        
        return Inertia::render('Admin/Subscriptions/Create', [
            'tenant' => $tenant,
            'contexts' => $availableContexts,
        ]);
    }
    
    public function storeForTenant(Request $request, Tenant $tenant)
    {
        $validated = $request->validate([
            'context_slug' => 'required|exists:subscription_contexts,slug',
            'plan_slug' => 'required',
            'trial_days' => 'nullable|integer|min:0|max:365',
            'notes' => 'nullable|string',
        ]);
        
        // Admin can override trial days
        $trialDays = $validated['trial_days'] ?? 0;
        
        // Create subscription (admin bypasses payment)
        $subscription = $this->subscriptionService->createAdminSubscription(
            $tenant,
            $validated['context_slug'],
            $validated['plan_slug'],
            $trialDays,
            $validated['notes'] ?? null
        );
        
        // Install module if not already installed
        if (!$tenant->hasModuleInstalled($validated['context_slug'])) {
            $this->moduleInstaller->install(
                $validated['context_slug'],
                $tenant,
                $validated['plan_slug']
            );
        }
        
        return redirect()->route('admin.subscriptions.show', $subscription->id)
            ->with('success', 'Subscription created successfully');
    }
}
```

### **Step 4.2: Analytics Service (Day 3)**
```php
// app/Subscription/Core/Services/SubscriptionAnalytics.php
class SubscriptionAnalytics
{
    public function getContextAnalytics(string $contextSlug, Period $period): ContextAnalytics
    {
        return new ContextAnalytics([
            'subscriptions' => $this->getSubscriptionStats($contextSlug, $period),
            'revenue' => $this->getRevenueStats($contextSlug, $period),
            'usage' => $this->getUsageStats($contextSlug, $period),
            'churn' => $this->getChurnStats($contextSlug, $period),
            'upgrades' => $this->getUpgradeStats($contextSlug, $period),
        ]);
    }
    
    public function getSubscriptionStats(string $contextSlug, Period $period): array
    {
        return [
            'total' => TenantSubscription::where('context_slug', $contextSlug)->count(),
            'active' => TenantSubscription::where('context_slug', $contextSlug)
                ->where('status', 'active')->count(),
            'trialing' => TenantSubscription::where('context_slug', $contextSlug)
                ->where('status', 'trialing')->count(),
            'new_this_month' => TenantSubscription::where('context_slug', $contextSlug)
                ->whereBetween('created_at', [$period->start, $period->end])
                ->count(),
        ];
    }
    
    public function getRevenueStats(string $contextSlug, Period $period): array
    {
        $payments = Payment::whereHas('subscription', function ($query) use ($contextSlug) {
            $query->where('context_slug', $contextSlug);
        })
        ->whereBetween('created_at', [$period->start, $period->end])
        ->where('status', 'completed')
        ->get();
        
        return [
            'total_revenue' => $payments->sum('amount'),
            'monthly_recurring_revenue' => $this->calculateMRRForContext($contextSlug),
            'average_revenue_per_user' => $payments->avg('amount'),
            'revenue_by_plan' => $this->groupRevenueByPlan($payments),
        ];
    }
}
```

### **Step 4.3: Scheduled Jobs (Day 4)**
```php
// app/Console/Commands/SubscriptionMaintenance.php
class SubscriptionMaintenance extends Command
{
    protected $signature = 'subscriptions:maintenance';
    protected $description = 'Run subscription maintenance tasks';
    
    public function handle()
    {
        $this->info('Starting subscription maintenance...');
        
        // 1. End expired trials
        $this->endExpiredTrials();
        
        // 2. Send trial reminders
        $this->sendTrialReminders();
        
        // 3. Process overdue subscriptions
        $this->processOverdueSubscriptions();
        
        // 4. Downgrade canceled subscriptions
        $this->downgradeCanceledSubscriptions();
        
        // 5. Generate monthly invoices
        $this->generateMonthlyInvoices();
        
        // 6. Reset monthly usage counters
        $this->resetMonthlyUsageCounters();
        
        $this->info('Subscription maintenance completed.');
    }
    
    private function endExpiredTrials(): void
    {
        $expiredTrials = TenantSubscription::where('status', 'trialing')
            ->where('trial_ends_at', '<', now())
            ->get();
            
        foreach ($expiredTrials as $subscription) {
            $this->trialManager->endTrial($subscription);
            $this->info("Ended trial for tenant: {$subscription->tenant_id}");
        }
    }
    
    private function sendTrialReminders(): void
    {
        $trialsEndingSoon = TenantSubscription::where('status', 'trialing')
            ->whereBetween('trial_ends_at', [now()->addDays(3), now()->addDays(1)])
            ->get();
            
        foreach ($trialsEndingSoon as $subscription) {
            $subscription->tenant->notify(new TrialEndingSoon($subscription));
            $this->info("Sent trial reminder to tenant: {$subscription->tenant_id}");
        }
    }
}
```

### **Step 4.4: Admin Dashboard (Day 5)**
```vue
<!-- resources/js/Admin/Subscriptions/Dashboard.vue -->
<template>
  <div class="subscription-admin-dashboard">
    <!-- Overview Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_subscriptions }}</div>
        <div class="stat-label">Total Subscriptions</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">रू {{ stats.monthly_revenue }}</div>
        <div class="stat-label">Monthly Revenue</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">{{ stats.active_trials }}</div>
        <div class="stat-label">Active Trials</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">{{ stats.churn_rate }}%</div>
        <div class="stat-label">Churn Rate</div>
      </div>
    </div>
    
    <!-- Context Breakdown -->
    <div class="context-breakdown">
      <h4>Subscriptions by Context</h4>
      <div class="breakdown-chart">
        <div v-for="context in contexts" :key="context.slug" class="context-bar">
          <div class="context-name">{{ context.name }}</div>
          <div class="bar-container">
            <div class="bar" :style="{ width: (context.subscriptions / stats.total_subscriptions) * 100 + '%' }">
              <span class="bar-value">{{ context.subscriptions }}</span>
            </div>
          </div>
          <div class="context-revenue">रू {{ context.revenue }}</div>
        </div>
      </div>
    </div>
    
    <!-- Recent Activity -->
    <div class="recent-activity">
      <h4>Recent Subscription Activity</h4>
      <table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Context</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="activity in recentActivity" :key="activity.id">
            <td>{{ activity.tenant_name }}</td>
            <td>{{ activity.context_name }}</td>
            <td>{{ activity.plan_name }}</td>
            <td>
              <span :class="'status-badge ' + activity.status">
                {{ activity.status }}
              </span>
            </td>
            <td>रू {{ activity.amount }}</td>
            <td>{{ formatDate(activity.created_at) }}</td>
            <td>
              <button @click="viewSubscription(activity.id)" class="btn-action">
                View
              </button>
              <button v-if="activity.status === 'trialing'" 
                      @click="convertTrial(activity.id)"
                      class="btn-action success">
                Convert to Paid
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

---

# ✅ **COMPLETION CHECKLIST**

## **Phase 0 - Foundation (Week 1)**
- [ ] Database schema for subscriptions
- [ ] Subscription context structure
- [ ] Digital Card module YAML definition
- [ ] Module registry service

## **Phase 1 - Installation System (Week 2)**
- [ ] Module installer service
- [ ] Tenant migration manager
- [ ] Admin installation interface
- [ ] Rollback capability

## **Phase 2 - Payment Integration (Week 3)**
- [ ] eSewa payment provider
- [ ] Khalti payment provider
- [ ] Trial management system
- [ ] Payment webhooks
- [ ] Frontend payment flow

## **Phase 3 - Feature Gating (Week 4)**
- [ ] Feature gate service
- [ ] Digital Card feature integration
- [ ] Usage tracking
- [ ] Limit enforcement middleware
- [ ] Usage dashboard

## **Phase 4 - Admin & Analytics (Week 5)**
- [ ] Admin subscription manager
- [ ] Analytics service
- [ ] Scheduled maintenance jobs
- [ ] Admin dashboard

---

# 🚀 **START HERE** 


**Immediate Next Steps (Today):**

1. **Create database tables** (Phase 0.1)
2. **Create subscription context structure** (Phase 0.2)
3. **Create Digital Card module YAML** (Phase 0.3)
4. **Test basic module installation** on your existing Digital Card context

**Shall I start with the database migration files and subscription context structure?**