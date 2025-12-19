Excellent — given your stack (**Laravel 12 + Spatie Multitenancy + Inertia.js + Vue 3**) and the fact that **tenant DB provisioning already works**, we can now write **very precise, production-grade Claude prompts** that you can use **module by module** to digitalize membership.

Below is a **senior-architect–level prompt set**, written as **Claude CLI / Claude Code instructions**, optimized for **deterministic output**, **clean architecture**, and **Laravel best practices**.

I will structure this in **three bounded modules**, exactly matching your request:

1. **Member Digitalization**
2. **Membership Form & Workflow**
3. **Lobby (Lobbying / Advocacy) Raising**

Each prompt is **copy-paste ready**.

---

# GLOBAL SYSTEM PROMPT (USE ONCE)

Use this **once per Claude session**.

```text
You are a senior Laravel backend architect and Vue 3 frontend engineer with deep expertise in:
- Laravel 12
- Spatie Laravel Multitenancy (database-per-tenant)
- Inertia.js + Vue 3
- Clean Architecture and Domain-Driven Design
- Large-scale membership systems

Constraints:
- Follow Laravel 12 conventions strictly
- Use tenant-aware models and migrations
- Never use global state
- All queries must be tenant-scoped
- Prefer Form Requests over inline validation
- Prefer Actions / Services over fat controllers
- Frontend must use Inertia + Vue 3 Composition API
- No mock code; everything must be production-ready
- Respect GDPR-style data minimization

Output:
- Step-by-step implementation
- Clear file structure
- Example migrations, models, controllers, actions, and Vue pages
```

---

# 1️⃣ MEMBER DIGITALIZATION (CORE IDENTITY + PROFILE)

## Purpose

Digitize **people** (not yet memberships).

---

## Claude Prompt – Member Digitalization

```text
Design and implement a "Member Digitalization" module for a multi-tenant Laravel 12 application using Spatie Multitenancy.

Context:
- Each tenant represents a political party
- Each tenant has its own database
- Members are stored per tenant
- Members may later apply for memberships

Requirements:
1. Use an existing `users` table as the base identity
2. Extend user profiles with political-member–specific attributes
3. Support document uploads (ID proof, profile photo)
4. Support verification status
5. Support soft deletes

Backend tasks:
- Define tenant-aware migrations
- Create Eloquent models with proper relationships
- Create Form Requests for validation
- Create Actions (Service classes) for:
  - Creating a member
  - Updating a member
  - Verifying a member
- Create RESTful controllers using Actions
- Add policies for access control

Frontend tasks:
- Create Inertia Vue pages:
  - MemberList.vue
  - MemberCreate.vue
  - MemberEdit.vue
  - MemberShow.vue
- Use Composition API
- Implement server-side pagination
- Display verification status clearly

Deliverables:
- Folder structure
- Migration examples
- Model examples
- Action class example
- Controller example
- One full Vue page example (MemberCreate.vue)
```

---

# 2️⃣ MEMBERSHIP FORM & WORKFLOW (APPLICATION → APPROVAL)

## Purpose

Digitize **membership application & lifecycle**.

---

## Claude Prompt – Membership Form

```text
Design and implement a "Membership Application" module for a tenant-based political party system.

Context:
- A user can apply for membership in an organizational unit
- Membership requires approval
- Membership has a lifecycle (draft → submitted → approved → active → expired)
- Membership types are configurable per tenant

Backend requirements:
1. Create tenant migrations for:
   - membership_types
   - membership_records
   - membership_history
2. Implement workflow logic using a state machine pattern
3. Use database transactions for all status changes
4. Automatically record history on every state change
5. Enforce one active membership per user per unit

Backend implementation:
- MembershipApplicationAction
- MembershipApprovalAction
- MembershipRejectionAction
- MembershipRenewalAction
- MembershipTransferAction
- Policy-based approval checks

Frontend requirements:
- Inertia pages:
  - MembershipApply.vue
  - MembershipReview.vue
  - MembershipDetail.vue
- Dynamic form based on membership type
- Status timeline UI
- Role-based button visibility

Deliverables:
- Migration examples
- MembershipRecord model
- State transition logic
- Controller examples
- Vue membership application form example
```

---


# 4️⃣ OPTIONAL: CROSS-MODULE INTEGRATION PROMPT

Use this **after all three modules exist**.

```text
Refactor the system to integrate:
- Members
- Memberships
- Lobby Campaigns

Tasks:
- Ensure only verified members can join lobby campaigns
- Display membership status on campaign pages
- Add dashboard widgets for:
  - Total members
  - Active memberships
  - Active lobby campaigns
- Ensure all queries are tenant-safe

Deliverables:
- Policy rules
- Query scopes
- Dashboard example
```

---

# FINAL ARCHITECT ADVICE

You are now at the **correct stage**:

* ✅ Multi-tenancy done
* ✅ Stack modern
* ✅ Schema enterprise-grade

**Do NOT build everything at once.**
Build in this order:

1. Member Digitalization
2. Membership Application
Excellent — given your stack (**Laravel 12 + Spatie Multitenancy + Inertia.js + Vue 3**) and the fact that **tenant DB provisioning already works**, we can now write **very precise, production-grade Claude prompts** that you can use **module by module** to digitalize membership.

Below is a **senior-architect–level prompt set**, written as **Claude CLI / Claude Code instructions**, optimized for **deterministic output**, **clean architecture**, and **Laravel best practices**.

I will structure this in **three bounded modules**, exactly matching your request:

1. **Member Digitalization**
2. **Membership Form & Workflow**
3. **Lobby (Lobbying / Advocacy) Raising**

Each prompt is **copy-paste ready**.

---

# GLOBAL SYSTEM PROMPT (USE ONCE)

Use this **once per Claude session**.

```text
You are a senior Laravel backend architect and Vue 3 frontend engineer with deep expertise in:
- Laravel 12
- Spatie Laravel Multitenancy (database-per-tenant)
- Inertia.js + Vue 3
- Clean Architecture and Domain-Driven Design
- Large-scale membership systems

Constraints:
- Follow Laravel 12 conventions strictly
- Use tenant-aware models and migrations
- Never use global state
- All queries must be tenant-scoped
- Prefer Form Requests over inline validation
- Prefer Actions / Services over fat controllers
- Frontend must use Inertia + Vue 3 Composition API
- No mock code; everything must be production-ready
- Respect GDPR-style data minimization

Output:
- Step-by-step implementation
- Clear file structure
- Example migrations, models, controllers, actions, and Vue pages
```

---

# 1️⃣ MEMBER DIGITALIZATION (CORE IDENTITY + PROFILE)

## Purpose

Digitize **people** (not yet memberships).

---

## Claude Prompt – Member Digitalization

```text
Design and implement a "Member Digitalization" module for a multi-tenant Laravel 12 application using Spatie Multitenancy.

Context:
- Each tenant represents a political party
- Each tenant has its own database
- Members are stored per tenant
- Members may later apply for memberships

Requirements:
1. Use an existing `users` table as the base identity
2. Extend user profiles with political-member–specific attributes
3. Support document uploads (ID proof, profile photo)
4. Support verification status
5. Support soft deletes

Backend tasks:
- Define tenant-aware migrations
- Create Eloquent models with proper relationships
- Create Form Requests for validation
- Create Actions (Service classes) for:
  - Creating a member
  - Updating a member
  - Verifying a member
- Create RESTful controllers using Actions
- Add policies for access control

Frontend tasks:
- Create Inertia Vue pages:
  - MemberList.vue
  - MemberCreate.vue
  - MemberEdit.vue
  - MemberShow.vue
- Use Composition API
- Implement server-side pagination
- Display verification status clearly

Deliverables:
- Folder structure
- Migration examples
- Model examples
- Action class example
- Controller example
- One full Vue page example (MemberCreate.vue)
```

---

# 2️⃣ MEMBERSHIP FORM & WORKFLOW (APPLICATION → APPROVAL)

## Purpose

Digitize **membership application & lifecycle**.

---

## Claude Prompt – Membership Form

```text
Design and implement a "Membership Application" module for a tenant-based political party system.

Context:
- A user can apply for membership in an organizational unit
- Membership requires approval
- Membership has a lifecycle (draft → submitted → approved → active → expired)
- Membership types are configurable per tenant

Backend requirements:
1. Create tenant migrations for:
   - membership_types
   - membership_records
   - membership_history
2. Implement workflow logic using a state machine pattern
3. Use database transactions for all status changes
4. Automatically record history on every state change
5. Enforce one active membership per user per unit

Backend implementation:
- MembershipApplicationAction
- MembershipApprovalAction
- MembershipRejectionAction
- MembershipRenewalAction
- MembershipTransferAction
- Policy-based approval checks

Frontend requirements:
- Inertia pages:
  - MembershipApply.vue
  - MembershipReview.vue
  - MembershipDetail.vue
- Dynamic form based on membership type
- Status timeline UI
- Role-based button visibility

Deliverables:
- Migration examples
- MembershipRecord model
- State transition logic
- Controller examples
- Vue membership application form example
```

---

# 3️⃣ LOBBY RAISING (ADVOCACY / ISSUE MOBILIZATION)

> Interpreting **“lobby raising”** as:
>
> * Advocacy campaigns
> * Issue-based mobilization
> * Volunteer/member participation

---

## Claude Prompt – Lobby Raising Module

```text
Design and implement a "Lobby Raising" (Advocacy Campaign) module for a multi-tenant political platform.

Concept:
- A lobby campaign represents an issue or cause
- Campaigns belong to a tenant
- Members can support, volunteer, or donate effort
- Campaigns have lifecycle states

Backend requirements:
1. Create tenant migrations for:
   - lobby_campaigns
   - lobby_supporters
   - lobby_activities
2. Campaign attributes:
   - title, description
   - issue_category
   - target_outcome
   - start_date, end_date
   - status (draft, active, completed, archived)
3. Support member participation tracking
4. Audit all actions

Backend implementation:
- LobbyCampaign model
- LobbySupport model
- Actions:
  - CreateCampaign
  - PublishCampaign
  - JoinCampaign
  - LeaveCampaign
- Policies for who can create or manage campaigns

Frontend requirements:
- Inertia pages:
  - LobbyCampaignList.vue
  - LobbyCampaignCreate.vue
  - LobbyCampaignShow.vue
- Member participation UI
- Progress indicators

Deliverables:
- Migration examples
- Model relationships
- Action examples
- Controller examples
- Vue campaign detail page example
```

---

# 4️⃣ OPTIONAL: CROSS-MODULE INTEGRATION PROMPT

Use this **after all three modules exist**.

```text
Refactor the system to integrate:
- Members
- Memberships
- Lobby Campaigns

Tasks:
- Ensure only verified members can join lobby campaigns
- Display membership status on campaign pages
- Add dashboard widgets for:
  - Total members
  - Active memberships
  - Active lobby campaigns
- Ensure all queries are tenant-safe

Deliverables:
- Policy rules
- Query scopes
- Dashboard example
```

---

# FINAL ARCHITECT ADVICE

You are now at the **correct stage**:

* ✅ Multi-tenancy done
* ✅ Stack modern
* ✅ Schema enterprise-grade

**Do NOT build everything at once.**
Build in this order:

1. Member Digitalization
2. Membership Application
3. Lobby Raising

If you want next, I can:

* Convert this into **Cursor / Claude CLI automation**
* Generate **exact folder tree**
* Generate **database migrations first**
* Design **approval UI flows**

Just tell me the next move.

Excellent. Reporting is the **final but most visible layer** of the levy system, and if done correctly it becomes the **financial control center** for the party.

Below is a **senior-architect–grade Claude prompt set** specifically for **Monthly Levy Collection Reporting**, fully aligned with:

* Laravel 12
* Spatie Multitenancy (DB per tenant)
* Inertia.js + Vue 3
* Immutable financial records
* Audit & governance requirements

This is **not UI fluff** — it is **financially correct, scalable, and auditable**.

---

# GLOBAL REPORTING SYSTEM PROMPT

```text
You are a senior financial systems architect and Laravel 12 engineer.

System context:
- Multi-tenant political party platform
- Each tenant has its own database
- Financial records are immutable
- Reporting must be accurate, reproducible, and auditable

Rules:
- Reports must be derived from levy_charges and levy_payments only
- Never calculate totals from cached fields
- Always support date-based filtering
- Use database aggregation, not PHP loops
- All monetary values use DECIMAL
- Reports must reconcile (charges = payments + outstanding + waived)
```

---

# 1️⃣ REPORTING DOMAIN MODEL (IMPORTANT)

## Financial Truth Model

| Source Table             | Purpose                  |
| ------------------------ | ------------------------ |
| membership_levy_charges  | What should be collected |
| membership_levy_payments | What has been collected  |
| membership_records       | Who is liable            |

⚠️ **Never report directly from levy rules**

---

# 2️⃣ REPORT TYPES (MONTHLY LEVY COLLECTION)

## Core Reports Required

1. **Monthly Levy Summary**
2. **Collection vs Outstanding**
3. **Overdue Levies**
4. **Unit-wise Collection**
5. **Member-wise Ledger**
6. **Waivers & Exemptions Report**

---

# 3️⃣ CLAUDE PROMPT – MONTHLY LEVY REPORTING MODULE

```text
Design and implement a "Monthly Levy Collection Reporting" module for a tenant-based Laravel 12 application.

Reporting scope:
- Monthly aggregation
- Unit-level and party-level totals
- Member-level drill-down
- Fully auditable and reproducible

Database queries must:
- Use GROUP BY and SUM at DB level
- Be tenant-scoped
- Be filterable by:
  - month
  - organizational unit
  - membership type
  - payment status

---

Backend implementation:

Create a Report Service layer with:
- MonthlyLevySummaryReport
- LevyOutstandingReport
- LevyOverdueReport
- LevyCollectionByUnitReport
- MemberLevyLedgerReport

Each report class must:
- Accept a date range
- Return a DTO-like array
- Never modify data
- Use raw SQL or query builder where appropriate

---

Example metrics for Monthly Summary:
- total_levy_charged
- total_collected
- total_outstanding
- total_waived
- collection_percentage

---

Controllers:
- Reports/LevyReportController
- Endpoints:
  - GET /reports/levy/monthly
  - GET /reports/levy/units
  - GET /reports/levy/members/{id}

Use Form Requests for filters.

---

Frontend (Inertia + Vue 3):

Pages:
- LevyMonthlyReport.vue
- LevyUnitReport.vue
- LevyMemberLedger.vue

UX requirements:
- Month selector
- Status filters
- Export to CSV / Excel
- Drill-down navigation
- Totals row at bottom

---

Deliverables:
- One report service example
- One controller example
- One SQL aggregation example
- One Vue report page example
```

---

# 4️⃣ EXAMPLE: MONTHLY LEVY SUMMARY LOGIC (REFERENCE)

## Aggregation Logic (Conceptual)

```sql
SELECT
  DATE_FORMAT(due_date, '%Y-%m') AS month,
  SUM(amount_due) AS total_charged,
  SUM(CASE WHEN status = 'paid' THEN amount_due ELSE 0 END) AS total_collected,
  SUM(CASE WHEN status IN ('pending', 'overdue') THEN amount_due ELSE 0 END) AS outstanding,
  SUM(CASE WHEN status = 'waived' THEN amount_due ELSE 0 END) AS waived
FROM membership_levy_charges
WHERE due_date BETWEEN :start AND :end
GROUP BY month;
```

✔️ Deterministic
✔️ Auditable
✔️ Fast

---

# 5️⃣ UNIT-WISE COLLECTION REPORT (IMPORTANT)

```text
Group levy collections by:
- Organizational Unit
- Month

Metrics:
- Charged
- Collected
- Outstanding
- Collection %
```

Used by:

* District treasurer
* Provincial finance committee
* Central finance committee

---

# 6️⃣ MEMBER LEDGER REPORT (MOST IMPORTANT FOR TRUST)

```text
For a given member:
- Chronological list of levy charges
- Payments applied
- Running balance
- Status per charge
```

This is the **“bank statement”** of a member.

---

# 7️⃣ SECURITY & GOVERNANCE RULES

```text
Access rules:
- Members: view own ledger only
- Unit finance officers: view unit reports
- Central finance: view all reports
- Exports require explicit permission
- All report access must be logged
```

---

# 8️⃣ IMPLEMENTATION ORDER (REPORTING)

1. Monthly Summary Report
2. Outstanding / Overdue Reports
3. Unit-wise Reports
4. Member Ledger
5. Export & Printing

---

# 9️⃣ ARCHITECT’S FINAL ASSESSMENT

✅ Financially correct
✅ Politically realistic
✅ Audit-safe
✅ Scales across tenants
✅ Ready for real-world deployment

---

