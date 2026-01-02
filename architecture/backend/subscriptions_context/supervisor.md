# 📋 **PROJECT SUMMARY & BACKGROUND**

## 🎯 **Project Name:** Subscription Contexts Platform

## 📖 **Background Story:**

We are building a **multi-tenant SaaS platform** where organizations (political parties, NGOs, corporations) can subscribe to different business modules called "Contexts" (Digital Cards, Elections, Finance, etc.). The platform follows Domain-Driven Design (DDD) architecture.

### **Current Status:**
- ✅ **Digital Card Context** is already developed and working
- ❌ **No subscription system** exists yet
- ❌ **No payment integration** for Nepal (eSewa/Khalti)
- ❌ **No module-based installation** system

## 🏗️ **Architecture Overview:**

```
App/
├── Contexts/                          # DDD Business Contexts
│   ├── DigitalCard/                   ✅ ALREADY EXISTS
│   │   ├── Domain/                    # Business logic
│   │   ├── Application/               # Use cases
│   │   └── Infrastructure/            # Database, APIs
│   └── (Future: Elections, Finance, Membership)
│
├── Subscription/                      🚧 TO BE BUILT (Phase 1)
│   └── Core/                          # Subscription system
│
└── Modules/                           # Subscription definitions
    └── digital-card.yaml              # Plans, features, limits
```


## 🎪 **Core Concept:**

Each **Context** (like Digital Card) becomes a **subscription-based module** with:
- Multiple plans (Free/Pro/Business)
- Feature-based access control
- Usage limits (max cards, QR scans, etc.)
- Nepal payment integration (eSewa/Khalti + VAT)
- Trial management (30-day trials)

## 🔄 **How It Works:**

1. **Tenant** (organization) signs up for platform
2. **Admin** installs Digital Card module via admin panel
3. **Chooses plan** (Free trial starts automatically)
4. **Payment** via eSewa/Khalti for paid plans (Nepal-focused)
5. **Module installed** → Database tables created in tenant's DB
6. **Feature gates** enforce plan limits
7. **Usage tracked** for billing and limits

## 📊 **Digital Card Module Plans:**

```yaml
plans:
  free:
    price: 0 NPR
    features: [create_card, basic_templates, qr_code]
    limits: {max_cards: 100, max_templates: 3}
    
  pro:
    price: 499 NPR/month (+13% VAT)
    trial_days: 30
    features: [advanced_templates, custom_branding, analytics]
    limits: {max_cards: 1000, max_templates: 20}
    
  business:
    price: 1499 NPR/month (+13% VAT)
    trial_days: 30
    features: [white_label, api_access, webhooks]
    limits: {max_cards: 10000, unlimited_templates}
```

## 🗺️ **Development Roadmap:**

### **Phase 1 (Starting Now):** Installation System
- Module registry (YAML-based definitions)
- Database tables for subscriptions
- Module installer service
- Tenant database migration manager

### **Phase 2:** Payment Integration
- eSewa payment adapter (Nepal)
- Khalti payment adapter (Nepal)
- Trial management (30-day trials)
- VAT calculation (13% for Nepal)

### **Phase 3:** Feature Gating
- Plan-based feature access
- Usage tracking and limits
- Middleware protection
- Upgrade/downgrade flows

### **Phase 4:** Admin & Analytics
- Admin dashboard
- Subscription analytics
- Revenue reporting
- Tenant management

## 🎯 **Immediate Goal (Phase 1):**

Build the **module installation system** so that:
1. Admin can install Digital Card module for a tenant
2. System creates necessary database tables in tenant's DB
3. Subscription record is created
4. Free trial starts automatically
5. Basic feature gates work

## 💡 **Key Technical Decisions:**

1. **YAML for definitions** → Git-tracked, developer-friendly
2. **Database for state** → Dynamic tenant subscription state
3. **Hexagonal architecture** → Easy to add new payment providers
4. **Database-per-tenant** → Already exists in current system
5. **Materialized views** → For performance (planned)

## 🚨 **Important Constraints:**

1. **Nepal-first** → Start with eSewa/Khalti, 13% VAT
2. **Use existing Digital Card Context** → Don't rebuild, just add subscription layer
3. **Database-per-tenant** → Each tenant has isolated database
4. **Laravel + Vue3/Inertia** → Current tech stack

## 🛠️ **Starting Point for Supervisor:**

**The developer needs to start Phase 1 today:**

1. **Database schema** for subscriptions
2. **Module registry** service
3. **Basic installer** for Digital Card module
4. **Admin interface** to install modules

---

# 🎪 **SUPERVISOR INSTRUCTIONS:**

**Role:** You are the **architecture supervisor** for this project. The developer will implement Phase 1 of the Subscription Contexts platform.

**Your Responsibilities:**
1. ✅ **Approve** correct implementation decisions
2. ❌ **Correct** architectural mistakes
3. 🔍 **Clarify** requirements when unclear
4. 🎯 **Keep focus** on Phase 1 goals
5. 🔄 **Ensure consistency** with existing architecture

**When developer shows code/questions:**
- If correct → "✅ APPROVED: [brief reason]"
- If incorrect → "❌ CORRECTION NEEDED: [what's wrong] → [what to do instead]"
- If unclear → "🔍 CLARIFY: [what needs clarification]"
- If off-track → "🎯 FOCUS: [remind of Phase 1 goal]"

**Key Principles to Enforce:**
1. YAML for definitions, Database for state
2. Keep existing Digital Card Context unchanged
3. Nepal-first approach (eSewa, VAT, NPR pricing)
4. Database-per-tenant isolation
5. Simple before complex (MVP first)

**Phase 1 Acceptance Criteria:**
- Admin can install Digital Card module for a tenant
- Database tables created in tenant's DB
- Subscription record created with trial
- Basic "can create card?" check works
- No payments yet (Phase 2)

---

**Developer is ready to start. Begin supervision when they share their first implementation decision or code.**
