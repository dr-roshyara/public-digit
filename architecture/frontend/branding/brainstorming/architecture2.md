Nab, this is the **right question at the right time**.
What you’re asking for is not “what files do I write”, but **how do I sequence work so I don’t paint myself into a corner**.

I’ll answer this like a **senior solution architect giving you a delivery playbook**.

No code yet — **only correct order and responsibilities**.

---

# 🎯 CORE PRINCIPLE (READ THIS FIRST)

> **Branding is NOT a frontend feature.**
> It is a **platform capability** delivered *to* the frontend.

So:

* ❌ Don’t start with UI
* ❌ Don’t start with CSS
* ❌ Don’t start with Playwright

You start with **invariants**.

---

# 🧱 HIGH-LEVEL PHASES

```text
Phase 0 → Architecture Lock
Phase 1 → Backend Domain Core
Phase 2 → Backend Delivery Layer
Phase 3 → Frontend Consumption
Phase 4 → End-to-End Verification
Phase 5 → Hardening (cache, rollback, mobile)
```

You **must** respect this order.

---

# 🟦 PHASE 0 — ARCHITECTURE LOCK (1 day)

### Goal

Make future mistakes impossible.

### You define (on paper / README):

1. **Branding lives in Landlord DB**
2. **Themes are JSON, versioned**
3. **Only validated themes reach clients**
4. **Frontend never “decides” branding**

📄 Output:

* `ARCHITECTURE.md`
* DDD bounded contexts diagram
* Non-negotiable rules

✅ Only move on when this is written.

---

# 🟥 PHASE 1 — BACKEND DOMAIN CORE (START HERE)

> **This is the most important phase.**

### 1️⃣ Tenant Identity (Landlord)

**Build**

* Tenant model
* Domain / slug resolution
* Plan / tier field

**Why first?**
Branding has no meaning without tenant identity.

---

### 2️⃣ Theme Domain Model

**Build**

* `TenantTheme` aggregate
* Versioning logic
* Status: `DRAFT | ACTIVE | FAILED | ROLLED_BACK`

**Do NOT**

* Render CSS
* Think about UI

---

### 3️⃣ Theme Validation Context

**Build**

* CSS value validator
* WCAG contrast checks
* Plan restrictions

**Rule**

> If validation fails, theme is never ACTIVE.

✔ This prevents **CSS injection**
✔ This prevents **tenant self-DOS**

📌 **STOP POINT**
If validation isn’t done, **do not continue**.

---

# 🟧 PHASE 2 — BACKEND DELIVERY LAYER

Now we answer:

> “How does a browser/mobile get the theme?”

### 4️⃣ Theme Delivery Service

**Build**

* `ThemeService::resolve(tenant, clientType)`
* Cache lookup
* Version return (ETag or version number)

**Important**

* Delivery ≠ validation
* Delivery ≠ storage

---

### 5️⃣ Tenant Context Middleware

**Build**

* Subdomain resolution (web)
* JWT / header resolution (future mobile)

**Invariant**

> Every request knows its tenant BEFORE business logic.

---

### 6️⃣ Cache Strategy (Initial)

**Build**

* Redis cache key per tenant
* TTL-based caching (simple first)

🚫 Don’t do Pub/Sub yet
✔ Just make it correct for single-node

---

📌 **STOP POINT**
At this stage:

* Backend can resolve tenant
* Backend can return correct theme JSON

No UI yet.

---

# 🟩 PHASE 3 — FRONTEND CONSUMPTION (ONLY NOW)

> The frontend is a **dumb consumer**.

### 7️⃣ Landlord Welcome Page

**Frontend builds**

* Static platform branding
* No tenant context

**Why first?**
You need a control group.

---

### 8️⃣ Tenant Landing Page

**Frontend does ONLY:**

* Receive theme JSON
* Apply CSS variables
* Render content

**Do NOT**

* Validate theme
* Transform logic
* Decide defaults

---

### 9️⃣ Theme Application Strategy

**Use**

* CSS variables
* Inline `<style>` from backend

**Why?**

* Fast
* SSR safe
* Deterministic

---

📌 **STOP POINT**
You should visually see:

* Platform page
* NRNA tenant page with correct colors

Still **no Playwright**.

---

# 🟪 PHASE 4 — END-TO-END VERIFICATION (PLAYWRIGHT)

Now you **prove guarantees**, not features.

### 10️⃣ Write Playwright Tests For:

| Test             | Purpose             |
| ---------------- | ------------------- |
| Platform page    | Control baseline    |
| Tenant branding  | Correct application |
| Tenant isolation | No leakage          |
| Invalid theme    | Rollback works      |

**Rule**

> Tests validate invariants, not pixels.

---

# 🟨 PHASE 5 — HARDENING (PRODUCTION REALITY)

Only after E2E works.

### 11️⃣ Distributed Cache Invalidation

* Redis Pub/Sub
* Version bump events

### 12️⃣ Rollback & Audit

* Store last N themes
* Auto rollback on render failure

### 13️⃣ Mobile Sync API

* Versioned sync
* Offline storage

---

# 🧭 WHAT YOU BUILD WHERE (CLEAR SEPARATION)

## BACKEND (Landlord Platform)

Build:

* Tenant resolution
* Theme validation
* Theme versioning
* Cache & delivery
* Security rules

Never:

* Assume CSS context
* Trust frontend input

---

## FRONTEND (Web / Mobile)

Build:

* Theme application
* UI rendering
* Offline caching (mobile)

Never:

* Validate branding
* Store authoritative theme state

---

# ⛔ COMMON TRAPS (DO NOT FALL INTO THESE)

❌ “Let’s quickly add UI first”
❌ “We can validate colors in JS”
❌ “Cache later”
❌ “Mobile after launch”

Every one of these leads to **rework**.

---

# 🧠 ARCHITECT’S GOLDEN RULE

> **If branding breaks, trust is broken.**
> This is not cosmetic. It is identity.

You’re building the **identity layer of political organizations**.

---

# ✅ MY RECOMMENDED START (NEXT 48 HOURS)

**Day 1**

* Write `ARCHITECTURE.md`
* Create Tenant + TenantTheme models
* Implement ThemeValidator

**Day 2**

* ThemeService (resolve + cache)
* Tenant context middleware
* Minimal Blade landing pages

---

If you want, next I can:

* Write the **exact task breakdown for Jira**
* Create a **file/folder structure**
* Or convert this into a **developer onboarding checklist**

Just tell me what you want next.
