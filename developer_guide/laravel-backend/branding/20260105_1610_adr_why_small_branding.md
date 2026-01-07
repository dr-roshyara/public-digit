# ADR-004: Tenant Branding & Welcome Configuration (MVP)

**Status:** Accepted
**Date:** 2026-01-05
**Decision Makers:** Senior Solution Architect, Product Owner
**Context:** Multi-tenant election platform (tenant-admin configurable branding)

---

## 1. Context

The platform supports multiple tenants (political parties / organizations) running legally sensitive election processes. Each tenant requires limited visual identity and messaging customization to establish trust and legitimacy on public-facing pages (e.g. landing page).

An initial proposal introduced a comprehensive branding system including layout control, typography systems, feature flags, JSON-based content management, custom CSS, and advanced theming options.

A feasibility and risk analysis showed that this approach was **over-engineered for an MVP**, introduced **legal and accessibility risks**, and would **delay time-to-value** without proportional business benefit.

---

## 2. Problem Statement

How can tenant-specific branding and welcome messaging be provided such that:

* Non-technical tenant administrators can configure it in < 10 minutes
* Election integrity, accessibility, and legal compliance are not compromised
* The solution is maintainable, testable, and low-risk
* Scope creep and design-system complexity are prevented

---

## 3. Decision

We will implement a **minimal, form-based Tenant Branding & Welcome configuration** with:

* A **single database table** with a **strict field limit (≤ 15)**
* **No layout customization**, **no custom CSS**, **no JSON content editing**
* **Plain-text welcome and landing content only**
* A **single tenant-admin frontend settings page** with 4 tabs

This solution is explicitly **configuration**, not **design tooling**.

---

## 4. Scope (What Is Included)

### 4.1 Database (MVP Fields)

* primary_color
* secondary_color
* logo_url
* favicon_url
* company_name
* company_tagline
* welcome_message (max 300 chars, plain text)
* hero_title
* hero_subtitle
* cta_text
* font_family (single field, locked default)
* is_active
* timestamps

No other branding-related fields are permitted in MVP.

---

## 5. Explicit Non-Goals (What Is Excluded)

The following are **explicitly rejected** for MVP:

* Custom layouts or layout engines
* Typography systems (sizes, scales, heading fonts)
* Dark mode or theme switching
* Custom CSS or style editors
* JSON-based content management
* Navigation or footer customization
* Feature-flag driven UI changes
* A/B testing or experimentation
* Accessibility configuration controls

These features may only be reconsidered after validated user demand and legal review.

---

## 6. Frontend Design Decision

A single **Tenant Admin → Settings → Branding & Welcome** page will be provided, structured into four tabs:

1. Identity
2. Colors & Logo
3. Welcome & Landing
4. Preview (read-only, passive)

Design rules:

* Form-based inputs only
* Safe defaults always present
* No live CSS recompilation
* No real-time iframe syncing

---

## 7. Safety & Compliance Constraints

Branding and welcome configuration:

* MUST NOT influence voting behavior
* MUST NOT apply to ballot, voting, or result certification pages
* MUST NOT allow hiding or reordering legally required information
* MUST use plain text only (no HTML, Markdown, or scripts)

Branding is sandboxed to **landing and informational pages only**.

---

## 8. Rationale

This decision prioritizes:

* Election legitimacy over visual flexibility
* Time-to-market over theoretical extensibility
* Operational simplicity over feature completeness
* User trust over aesthetic customization

Data and UX research indicate that >80% of tenants only require logo, colors, and a short welcome message.

---

## 9. Consequences

### Positive

* MVP deliverable within days, not months
* Minimal support burden
* Low legal and accessibility risk
* Clear architectural boundaries

### Negative

* Some advanced tenants may request more customization
* Branding flexibility is intentionally limited

These trade-offs are accepted and intentional.

---

## 10. Guardrails

The following guardrails are enforced:

* Maximum branding fields: **15**
* Setup time target: **≤ 10 minutes**
* Any new branding feature must:

  * Demonstrate >20% usage among paying tenants
  * Not affect election-critical flows
  * Remove or replace an existing feature

---

## 11. Review Policy

This ADR may only be revisited after:

* 30+ days of production usage
* Measured adoption > 50%
* Support requests < 5 per month
* Legal and accessibility review completed

Until then, this ADR is **binding**.

---

## 12. Final Statement

Branding in an election platform is a **trust mechanism**, not a design system.

This ADR intentionally limits flexibility to protect legitimacy, usability, and delivery speed.
