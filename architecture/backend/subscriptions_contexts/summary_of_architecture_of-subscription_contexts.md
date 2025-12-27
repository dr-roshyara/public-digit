# 📋 **ARCHITECTURE SUMMARY & BACKGROUND**

## 🎯 **PROJECT: "Subscription Contexts" - Multi-Tenant Module Monetization Platform**

### **What We're Building:**
A subscription-based system that turns DDD contexts (like Digital Cards, Elections, Finance) into **monetizable modules** with Nepal-first payment integration.

---

## 🏗️ **ARCHITECTURE OVERVIEW**

### **Core Concept:**
```
YAML Module Definitions (Git-tracked)
         ↓
Module Registry + CQRS Pattern
         ↓
Hexagonal Architecture (Ports/Adapters)
         ↓
Database for Tenant State Only
         ↓
Materialized Views for Performance
```

### **Directory Structure (Final):**
```
app/
├── Contexts/                          # Existing DDD Business Contexts
│   ├── DigitalCard/                   ✅ ALREADY EXISTS
│   ├── Elections/                     # Future
│   ├── Finance/                       # Future
│   └── Membership/                    # Future
│
├── Subscription/                      ← NEW: Monetization System
│   ├── Core/                          # Domain Layer
│   │   ├── Contracts/                 # Ports (Interfaces)
│   │   ├── Services/                  # Domain Services
│   │   └── Models/                    # Domain Models
│   │
│   ├── Infrastructure/                # Adapters Layer
│   │   ├── PaymentProviders/          # eSewa, Khalti, Stripe
│   │   ├── Installers/                # Module Installation
│   │   └── Regional/                  # Nepal VAT, India GST
│   │
│   └── UI/                            # Vue3 Components
│       ├── Marketplace/
│       ├── Dashboard/
│       └── Payment/
│
└── Modules/                           # Module Definitions (YAML)
    ├── digital-card.yaml              # Digital Card subscription config
    ├── elections.yaml                 # Future
    └── finance.yaml                   # Future
```

---

## 🔑 **KEY DECISIONS MADE:**

### **1. Hybrid Definition System**
- **YAML files** for module definitions (version controlled)
- **Database** only for tenant state (who has what)
- **Materialized views** for fast queries

### **2. Nepal-First Strategy**
- Start with **eSewa & Khalti** payment integration
- **13% VAT** calculation built-in
- Nepali pricing (रू 499/month = ~$3.75)
- **30-day free trials** for paid plans

### **3. Design Patterns Used:**
- **Hexagonal Architecture** for payment providers
- **CQRS** for performance (separate read/write models)
- **Decorator Pattern** for plan features
- **Strategy Pattern** for installation methods
- **Observer Pattern** for real-time updates
- **Command Pattern** for undo/rollback

### **4. Digital Card as First Product**
```
Plans:
• Free: 100 cards, 3 templates
• Pro (रू 499/month): 1,000 cards, 20 templates, analytics
• Business (रू 1499/month): 10,000 cards, unlimited, API access
```

---

## 📊 **CURRENT STATUS:**

### **✅ COMPLETED:**
1. **Digital Card Context** - Full DDD implementation exists
2. **Architecture Design** - Finalized and reviewed

### **⏳ TO BUILD (Next Steps):**

#### **PHASE 0: Foundation (Week 1)**
1. Database schema for subscriptions
2. Subscription context structure
3. Digital Card module YAML definition
4. Module registry service

#### **PHASE 1: Installation System (Week 2)**
1. Module installer service
2. Tenant migration manager  
3. Admin installation interface
4. Rollback capability

#### **PHASE 2: Payment Integration (Week 3)**
1. eSewa payment adapter
2. Khalti payment adapter
3. Trial management
4. Payment webhooks

#### **PHASE 3: Feature Gating (Week 4)**
1. Feature gate service
2. Usage tracking
3. Limit enforcement

#### **PHASE 4: Admin & Analytics (Week 5)**
1. Admin dashboard
2. Analytics service
3. Scheduled jobs

---

## 🗄️ **DATABASE SCHEMA (Core Tables):**

```sql
-- Module Definitions (loaded from YAML)
subscription_contexts(slug, name, description, is_active)

-- Pricing Plans per Context  
context_plans(id, context_slug, slug, name, price_monthly, trial_days, features, limits)

-- Tenant Subscriptions
tenant_context_subscriptions(id, tenant_id, context_slug, plan_slug, status, trial_ends_at)

-- Installation Tracking
subscription_installations(id, tenant_id, context_slug, version, installed_at)

-- Payment Records
payments(id, subscription_id, provider, amount, status, provider_reference)

-- Feature Usage Tracking
feature_usage(tenant_id, context_slug, feature, usage_count, period)
```

---

## 💳 **PAYMENT PROVIDER STRATEGY:**

### **Phase 1: Nepal Only**
1. **eSewa** - Primary wallet payment
2. **Khalti** - Secondary wallet payment  
3. **13% VAT** automatic calculation

### **Phase 2: Global Expansion**
1. **Stripe** - Credit cards worldwide
2. **Regional tax adapters** (India GST, EU VAT)
3. **Multiple currencies**

---

## 🎨 **USER FLOW (Digital Card First):**

```
1. Admin logs into tenant dashboard
2. Clicks "Add Digital Cards" module
3. Selects plan (Free/Pro/Business)
4. For paid plans: Redirect to eSewa/Khalti
5. Payment success → Automatic installation
6. Digital Card tables created in tenant DB
7. Feature limits enforced based on plan
8. Usage dashboard shows limits/usage
```

---

## 🔧 **IMMEDIATE NEXT TASKS:**

### **Task 1: Database Migration**
```bash
php artisan make:migration create_subscription_tables
```

### **Task 2: Create Subscription Context**
```bash
php artisan make:context Subscription
```

### **Task 3: Digital Card Module YAML**
```yaml
# config/modules/digital-card.yaml
context:
  slug: digital_card
  name: Digital Membership Cards
  plans:
    free: {price: 0, features: [...]}
    pro: {price: 499, trial_days: 30, features: [...]}
    business: {price: 1499, trial_days: 30, features: [...]}
```

### **Task 4: Basic Module Registry**
```php
class ModuleRegistry {
    public function loadFromYaml() { ... }
    public function getModule(string $slug) { ... }
}
```

---

## 🎯 **SUCCESS METRICS (MVP):**

1. **10+ Nepali organizations** using Digital Card subscriptions
2. **90% payment success rate** with eSewa/Khalti
3. **< 60 second installation** from payment to ready
4. **30% conversion rate** from Free to Pro within 90 days

---

## 📚 **KEY FILES TO REFERENCE:**

### **Existing:**
- `app/Contexts/DigitalCard/` - Your existing Digital Card context
- Digital Card migrations/seeds - Already exist

### **To Create:**
- `app/Subscription/` - New monetization system
- `config/modules/digital-card.yaml` - Module definition
- Database migrations for subscription tables
- eSewa/Khalti payment adapters

---

## 🚀 **READY TO START IN NEW CHAT**

**Starting Point:** Begin with **PHASE 0 - Foundation**

**First File to Create:** `database/migrations/2024_01_xx_create_subscription_tables.php`

**First Command to Run:**
```bash
php artisan make:migration create_subscription_tables
```

**Key Question for Next Session:** "Should we start with the database schema or the YAML module definition first?"

---

## 💡 **REMEMBER:**
- **Digital Card context already exists** - We're adding monetization to it
- **Nepal-first approach** - Start with eSewa/Khalti
- **YAML for definitions** - Git-tracked, developer-friendly
- **Database for state only** - Who has what subscription

**Copy this summary to start your new chat session!** 🚀
