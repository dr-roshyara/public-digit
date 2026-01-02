# 🧠 **Brainstorming: Multi-Payment, Multi-Subscription Hexagonal Architecture**

**Excellent ideas!** Let's think this through holistically:

## 🎯 **Core Insight:** 
You're not just building a subscription system - you're building a **global monetization platform** with multiple payment methods, multiple subscription types, and country-specific adaptations.

## 🔄 **The Challenge:**

1. **Payment Diversity** → Stripe (global), eSewa (Nepal), Khalti (Nepal), credit cards, bank transfers
2. **Subscription Types** → Digital Card sub, Membership sub, Context sub, Feature sub
3. **Regional Variations** → Nepal laws, India GST, EU VAT
4. **Pricing Models** → One-time, monthly, annual, usage-based, freemium

## 🏗️ **Proposed: Hexagonal Architecture inside DDD**

### **The "Monetization Hexagon":**
```
┌─────────────────────────────────────────────────────┐
│                BUSINESS DOMAIN                      │
│  (Core DDD Contexts)                                │
│  • Elections Context                                │
│  • Finance Context                                  │
│  • Membership Context                               │
│  • Digital Card Context                             │
└─────────────────────────────────────────────────────┘
                    │
                    ▼  (Ports)
┌─────────────────────────────────────────────────────┐
│            MONETIZATION HEXAGON                     │
│  (Payment/Subscription Core)                        │
│  ┌─────────────────────────────────────────────┐   │
│  │           PORTS (Interfaces)                │   │
│  │  • PaymentProviderPort                      │   │
│  │  • SubscriptionPort                         │   │
│  │  • BillingPort                              │   │
│  │  • TaxPort                                  │   │
│  └─────────────────────────────────────────────┘   │
│                    │                                │
│                    ▼  (Adapters)                   │
│  ┌─────────────────────────────────────────────┐   │
│  │          ADAPTERS (Implementations)         │   │
│  │  • StripeAdapter     • eSewaAdapter         │   │
│  │  • KhaltiAdapter     • BankTransferAdapter  │   │
│  │  • DigitalCardSubscriptionAdapter           │   │
│  │  • ContextSubscriptionAdapter               │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              EXTERNAL SYSTEMS                       │
│  • Stripe API        • eSewa API                    │
│  • Khalti API        • Bank APIs                    │
│  • Tax APIs          • Accounting Systems           │
└─────────────────────────────────────────────────────┘
```

## 📐 **Directory Structure:**

```
app/
├── Contexts/                          # DDD Business Contexts
│   ├── Elections/                     # Elections business logic
│   ├── Finance/                       # Finance business logic
│   ├── Membership/                    # Membership business logic
│   └── DigitalCard/                   # Digital Card business logic
│
├── Monetization/                      ← NEW: Monetization Hexagon
│   ├── Core/                          # Hexagon core
│   │   ├── Domain/                    # Monetization domain models
│   │   │   ├── Entities/
│   │   │   ├── ValueObjects/
│   │   │   └── Events/
│   │   │
│   │   ├── Ports/                     ← PORTS (Interfaces)
│   │   │   ├── PaymentProviderPort.php
│   │   │   ├── SubscriptionPort.php
│   │   │   ├── BillingPort.php
│   │   │   └── TaxPort.php
│   │   │
│   │   └── Services/                  # Domain services
│   │       ├── SubscriptionOrchestrator.php
│   │       ├── PaymentCoordinator.php
│   │       └── BillingCalculator.php
│   │
│   ├── Infrastructure/                ← ADAPTERS (Implementations)
│   │   ├── PaymentProviders/
│   │   │   ├── StripeAdapter.php
│   │   │   ├── EsewaAdapter.php
│   │   │   ├── KhaltiAdapter.php
│   │   │   └── CreditCardAdapter.php
│   │   │
│   │   ├── SubscriptionTypes/
│   │   │   ├── ContextSubscriptionAdapter.php
│   │   │   ├── DigitalCardSubscriptionAdapter.php
│   │   │   ├── MembershipSubscriptionAdapter.php
│   │   │   └── FeatureSubscriptionAdapter.php
│   │   │
│   │   └── Regional/
│   │       ├── NepalTaxAdapter.php
│   │       ├── IndiaGSTAdapter.php
│   │       └── EUVATAdapter.php
│   │
│   └── UI/                            # Monetization UI
│       ├── PaymentSelection.vue
│       ├── SubscriptionPlans.vue
│       └── BillingPortal.vue
│
└── Modules/                           # Subscription definitions
    ├── elections/                     # Elections subscription module
    ├── digital-card/                  # Digital Card subscription module
    └── membership/                    # Membership subscription module
```

## 🔧 **Core Ports (Interfaces):**

### **1. Payment Provider Port**
```php
namespace App\Monetization\Core\Ports;

interface PaymentProviderPort
{
    public function getId(): string; // 'stripe', 'esewa', 'khalti'
    public function getName(): string;
    public function getSupportedCountries(): array;
    public function getSupportedCurrencies(): array;
    
    public function createPaymentIntent(
        PaymentRequest $request
    ): PaymentResult;
    
    public function handleWebhook(
        array $webhookData
    ): WebhookResult;
    
    public function refund(
        string $paymentId, 
        float $amount
    ): RefundResult;
    
    public function isAvailableForCountry(string $countryCode): bool;
}
```

### **2. Subscription Port**
```php
interface SubscriptionPort
{
    public function getType(): string; // 'context', 'digital_card', 'membership'
    public function getName(): string;
    
    public function createSubscription(
        Tenant $tenant,
        SubscriptionPlan $plan,
        PaymentMethod $paymentMethod
    ): Subscription;
    
    public function cancelSubscription(
        Subscription $subscription
    ): CancellationResult;
    
    public function upgradeSubscription(
        Subscription $subscription,
        SubscriptionPlan $newPlan
    ): UpgradeResult;
    
    public function getUsage(
        Subscription $subscription
    ): UsageReport;
}
```

### **3. Billing Port**
```php
interface BillingPort
{
    public function calculateInvoice(
        Subscription $subscription,
        array $usageData = []
    ): Invoice;
    
    public function applyTaxes(
        Invoice $invoice,
        string $countryCode
    ): TaxCalculation;
    
    public function applyDiscounts(
        Invoice $invoice,
        array $promoCodes
    ): DiscountApplication;
    
    public function generateReceipt(
        Invoice $invoice
    ): Receipt;
}
```

## 🎪 **Adapters (Implementations):**

### **1. Payment Provider Adapters**
```php
// Stripe Adapter (Global)
class StripeAdapter implements PaymentProviderPort
{
    public function getId(): string { return 'stripe'; }
    public function getName(): string { return 'Stripe'; }
    public function getSupportedCountries(): array 
    { 
        return ['US', 'CA', 'GB', 'AU', 'EU']; // Many countries
    }
    
    public function createPaymentIntent(PaymentRequest $request): PaymentResult
    {
        $stripe = new \Stripe\StripeClient(config('services.stripe.secret'));
        
        return PaymentResult::fromStripe(
            $stripe->paymentIntents->create([
                'amount' => $request->amountInCents(),
                'currency' => $request->getCurrency(),
                'customer' => $this->getStripeCustomerId($request->getTenant()),
                'payment_method_types' => ['card'],
            ])
        );
    }
}

// eSewa Adapter (Nepal)
class EsewaAdapter implements PaymentProviderPort
{
    public function getId(): string { return 'esewa'; }
    public function getName(): string { return 'eSewa'; }
    public function getSupportedCountries(): array 
    { 
        return ['NP']; // Only Nepal
    }
    
    public function createPaymentIntent(PaymentRequest $request): PaymentResult
    {
        // eSewa specific implementation
        $esewa = new EsewaClient(config('services.esewa'));
        
        return PaymentResult::fromEsewa(
            $esewa->initiatePayment([
                'amount' => $request->amount,
                'tax_amount' => $request->calculateVAT(), // Nepal VAT
                'total_amount' => $request->amount + $request->calculateVAT(),
                'transaction_uuid' => Str::uuid(),
                'product_code' => 'EPAYTEST',
                'success_url' => route('payment.esewa.success'),
                'failure_url' => route('payment.esewa.failure'),
            ])
        );
    }
}

// Khalti Adapter (Nepal)
class KhaltiAdapter implements PaymentProviderPort
{
    public function getId(): string { return 'khalti'; }
    public function getName(): string { return 'Khalti'; }
    public function getSupportedCountries(): array 
    { 
        return ['NP']; // Only Nepal
    }
    
    public function createPaymentIntent(PaymentRequest $request): PaymentResult
    {
        $khalti = new KhaltiClient(config('services.khalti'));
        
        return PaymentResult::fromKhalti(
            $khalti->initiatePayment([
                'amount' => $request->amount * 100, // Khalti uses paisa
                'mobile' => $request->getUser()->phone, // Mobile-based
                'product_identity' => $request->getProductId(),
                'product_name' => $request->getProductName(),
            ])
        );
    }
}
```

### **2. Subscription Type Adapters**
```php
// Context Subscription (Elections, Finance, etc.)
class ContextSubscriptionAdapter implements SubscriptionPort
{
    public function getType(): string { return 'context'; }
    
    public function createSubscription(
        Tenant $tenant,
        SubscriptionPlan $plan,
        PaymentMethod $paymentMethod
    ): Subscription {
        // 1. Install the context
        $this->installContext($tenant, $plan->getContextSlug());
        
        // 2. Create subscription record
        return Subscription::create([
            'tenant_id' => $tenant->id,
            'type' => 'context',
            'context_slug' => $plan->getContextSlug(),
            'plan_slug' => $plan->getSlug(),
            'payment_provider' => $paymentMethod->getProvider(),
            'status' => 'active',
        ]);
    }
}

// Digital Card Subscription
class DigitalCardSubscriptionAdapter implements SubscriptionPort
{
    public function getType(): string { return 'digital_card'; }
    
    public function createSubscription(
        Tenant $tenant,
        SubscriptionPlan $plan,
        PaymentMethod $paymentMethod
    ): Subscription {
        // Digital Card specific logic
        // - Generate cards based on plan limits
        // - Setup card templates
        // - Configure card sharing
        
        $this->cardService->setupForTenant($tenant, $plan);
        
        return Subscription::create([
            'tenant_id' => $tenant->id,
            'type' => 'digital_card',
            'card_plan' => $plan->getSlug(),
            'max_cards' => $plan->getLimit('max_cards'),
            'features' => $plan->getFeatures(),
        ]);
    }
}

// Membership Subscription
class MembershipSubscriptionAdapter implements SubscriptionPort
{
    public function getType(): string { return 'membership'; }
    
    public function createSubscription(
        Tenant $tenant,
        SubscriptionPlan $plan,
        PaymentMethod $paymentMethod
    ): Subscription {
        // Membership specific logic
        // - Setup member types
        // - Configure membership rules
        // - Setup renewal workflows
        
        $this->membershipService->configureForTenant($tenant, $plan);
        
        return Subscription::create([
            'tenant_id' => $tenant->id,
            'type' => 'membership',
            'member_plan' => $plan->getSlug(),
            'max_members' => $plan->getLimit('max_members'),
            'renewal_frequency' => $plan->getBillingCycle(),
        ]);
    }
}
```

## 🌍 **Regional Adapters:**

```php
// Nepal Tax Adapter (13% VAT)
class NepalTaxAdapter implements TaxPort
{
    public function calculateTax(Invoice $invoice): TaxCalculation
    {
        $vatRate = 0.13; // 13% VAT in Nepal
        $vatAmount = $invoice->getSubtotal() * $vatRate;
        
        return new TaxCalculation([
            'country' => 'NP',
            'tax_name' => 'VAT',
            'tax_rate' => $vatRate,
            'tax_amount' => $vatAmount,
            'tax_number_required' => true, // VAT/PAN required
        ]);
    }
}

// India GST Adapter (18% GST)
class IndiaGSTAdapter implements TaxPort
{
    public function calculateTax(Invoice $invoice): TaxCalculation
    {
        $gstRate = 0.18; // 18% GST in India
        $gstAmount = $invoice->getSubtotal() * $gstRate;
        
        return new TaxCalculation([
            'country' => 'IN',
            'tax_name' => 'GST',
            'tax_rate' => $gstRate,
            'tax_amount' => $gstAmount,
            'gstin_required' => true, // GSTIN required
        ]);
    }
}
```

## 🔄 **Payment Selection Flow:**

```php
class PaymentCoordinator
{
    public function getAvailableProvidersForCountry(string $countryCode): array
    {
        $providers = [];
        
        foreach ($this->paymentProviders as $provider) {
            if ($provider->isAvailableForCountry($countryCode)) {
                $providers[] = $provider;
            }
        }
        
        // Sort by preference for country
        return $this->sortProvidersForCountry($providers, $countryCode);
    }
    
    private function sortProvidersForCountry(array $providers, string $countryCode): array
    {
        $countryPreferences = [
            'NP' => ['esewa', 'khalti', 'stripe'], // Nepal prefers eSewa
            'IN' => ['razorpay', 'stripe'], // India prefers RazorPay
            'US' => ['stripe', 'paypal'], // US prefers Stripe
            'EU' => ['stripe', 'adyen'], // EU prefers Stripe
        ];
        
        $order = $countryPreferences[$countryCode] ?? ['stripe'];
        
        usort($providers, function ($a, $b) use ($order) {
            $posA = array_search($a->getId(), $order);
            $posB = array_search($b->getId(), $order);
            
            return ($posA === false ? 999 : $posA) <=> ($posB === false ? 999 : $posB);
        });
        
        return $providers;
    }
}
```

## 🎨 **Vue3 Payment Selection UI:**

```vue
<template>
  <div class="payment-selector">
    <!-- Country Detection -->
    <div class="country-selection" v-if="!selectedCountry">
      <h4>Select Your Country</h4>
      <select v-model="tempCountry" @change="loadPaymentMethods">
        <option value="NP">🇳🇵 Nepal</option>
        <option value="IN">🇮🇳 India</option>
        <option value="US">🇺🇸 United States</option>
        <option value="GB">🇬🇧 United Kingdom</option>
        <!-- More countries -->
      </select>
    </div>
    
    <!-- Available Payment Methods -->
    <div v-else class="payment-methods">
      <h4>Payment Methods for {{ getCountryName(selectedCountry) }}</h4>
      
      <!-- Nepal: Show local providers first -->
      <div v-if="selectedCountry === 'NP'" class="local-payment-methods">
        <h5>🇳🇵 Nepali Payment Methods</h5>
        <div class="method-grid">
          <button @click="selectProvider('esewa')" class="method-btn esewa">
            <img src="/images/esewa-logo.png" alt="eSewa">
            <span>eSewa</span>
          </button>
          
          <button @click="selectProvider('khalti')" class="method-btn khalti">
            <img src="/images/khalti-logo.png" alt="Khalti">
            <span>Khalti</span>
          </button>
        </div>
      </div>
      
      <!-- Credit Card (Global) -->
      <div class="credit-card-methods">
        <h5>💳 Credit/Debit Card</h5>
        <div class="card-brands">
          <img src="/images/visa.png" alt="Visa">
          <img src="/images/mastercard.png" alt="Mastercard">
          <img src="/images/amex.png" alt="American Express" v-if="selectedCountry === 'US'">
        </div>
        <button @click="selectProvider('stripe')" class="method-btn stripe">
          Pay with Card
        </button>
      </div>
      
      <!-- Bank Transfer (for some countries) -->
      <div v-if="showBankTransfer" class="bank-transfer">
        <button @click="selectProvider('bank_transfer')">
          Bank Transfer
        </button>
      </div>
    </div>
    
    <!-- Subscription Type Selection -->
    <div v-if="selectedProvider" class="subscription-type">
      <h4>What would you like to subscribe to?</h4>
      
      <div class="subscription-options">
        <!-- Digital Card Subscription -->
        <div class="subscription-option" @click="selectSubscriptionType('digital_card')">
          <div class="option-icon">🪪</div>
          <h5>Digital Cards</h5>
          <p>Create and manage digital membership cards</p>
          <div class="plans">
            <span class="plan">Basic: Free</span>
            <span class="plan">Premium: $9.99/month</span>
          </div>
        </div>
        
        <!-- Membership Subscription -->
        <div class="subscription-option" @click="selectSubscriptionType('membership')">
          <div class="option-icon">👥</div>
          <h5>Membership Management</h5>
          <p>Manage organization members and dues</p>
          <div class="plans">
            <span class="plan">Basic: $19.99/month</span>
            <span class="plan">Pro: $49.99/month</span>
          </div>
        </div>
        
        <!-- Context Subscription -->
        <div class="subscription-option" @click="selectSubscriptionType('context')">
          <div class="option-icon">🏛️</div>
          <h5>Business Contexts</h5>
          <p>Add specific business capabilities</p>
          <div class="contexts">
            <span class="context">Elections</span>
            <span class="context">Finance</span>
            <span class="context">Forums</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

## 📊 **Database Schema for Flexibility:**

```sql
-- Payment Providers Configuration
CREATE TABLE payment_providers (
    id VARCHAR(50) PRIMARY KEY, -- 'stripe', 'esewa', 'khalti'
    name VARCHAR(100),
    type VARCHAR(50), -- 'card', 'wallet', 'bank_transfer'
    supported_countries JSONB, -- ['NP', 'IN', 'US']
    supported_currencies JSONB, -- ['USD', 'NPR', 'INR']
    config JSONB, -- Provider-specific configuration
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0 -- For sorting
);

-- Tenant Payment Methods
CREATE TABLE tenant_payment_methods (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    provider_id VARCHAR(50) REFERENCES payment_providers(id),
    method_data JSONB, -- Stripe: {customer_id: 'cus_xxx'}, eSewa: {username: 'user@esewa'}
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP
);

-- Subscriptions (Polymorphic)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    subscription_type VARCHAR(50), -- 'context', 'digital_card', 'membership', 'feature'
    subscription_data JSONB, -- Type-specific data
    
    -- Common fields
    plan_slug VARCHAR(100),
    status VARCHAR(20), -- 'active', 'canceled', 'past_due'
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    payment_provider_id VARCHAR(50),
    
    -- Nepal-specific: VAT/PAN
    vat_number VARCHAR(50),
    pan_number VARCHAR(50),
    
    created_at TIMESTAMP,
    INDEX idx_tenant_subscriptions (tenant_id, subscription_type),
    INDEX idx_active_subscriptions (status, current_period_end)
);

-- Invoices with tax support
CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    subscription_id UUID REFERENCES subscriptions(id),
    amount DECIMAL(10,2),
    currency VARCHAR(3),
    tax_amount DECIMAL(10,2),
    tax_country VARCHAR(2),
    tax_rate DECIMAL(5,4),
    payment_provider_id VARCHAR(50),
    provider_payment_id VARCHAR(255), -- Stripe: 'pi_xxx', eSewa: 'txn_xxx'
    status VARCHAR(20),
    invoice_data JSONB, -- Raw provider response
    created_at TIMESTAMP
);
```

## 🚀 **Implementation Strategy:**

### **Phase 1: Hexagon Core (Week 1)**
```
1. Port interfaces (PaymentProviderPort, SubscriptionPort)
2. Core domain models
3. Payment coordinator service
```

### **Phase 2: Nepal First (Week 2-3)**
```
1. eSewa adapter
2. Khalti adapter  
3. Nepal tax adapter
4. Digital Card subscription (first product)
```

### **Phase 3: Global Expansion (Week 4-5)**
```
1. Stripe adapter
2. Credit card support
3. More subscription types
```

### **Phase 4: Advanced Features (Week 6-8)**
```
1. Multi-currency
2. Tax automation
3. Subscription bundles
4. Usage-based billing
```

## 💡 **Key Insights:**

1. **Start with Nepal** → Perfect test market with eSewa/Khalti
2. **Digital Card first** → Simple, tangible product
3. **Hexagonal** → Easy to add new payment methods
4. **Context-aware** → Different flows for different countries

## ❓ **Critical Questions:**

1. **Priority**: Should we build Nepal-first or global-first?
2. **First Product**: Digital Card subscription or Membership subscription?
3. **Payment Method**: Support eSewa immediately or start with Stripe?
4. **Tax Complexity**: Handle VAT/PAN from start or later?

## 🎯 **My Recommendation:**

**Start with:**
1. **Nepal market** (eSewa + Khalti)
2. **Digital Card subscription** (simple, visual product)
3. **Hexagonal core** (prepare for global expansion)
4. **Basic tax** (13% VAT for Nepal)

**Build a working monetization system for Nepal first**, then expand globally.

**What do you think? Should we start implementing the hexagonal monetization system?**