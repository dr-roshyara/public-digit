Below is a **senior engineer + solution architect review** of your **Phase 1 Activation plan**, with **verification**, **risks**, and a **recommended “Phase‑1 corrected blueprint”** that fits your existing **Spatie multi‑tenancy + abstraction layer**, your **Phase‑0 API contract**, and **DDD/TDD** goals.

I’m going to be direct: the overall intent is good (TDD-first, domain event, activation lifecycle), but there are several **critical mismatches** that will cause you pain (or false greens) unless addressed now.

***

## 1) Executive Summary (Verdict)

✅ **Good direction**

*   Adds the correct next lifecycle capability: **Activation**
*   Keeps the workflow: **RED → GREEN → refactor**
*   Adds domain events and timestamps (good for auditability and future integrations)

⚠️ **Not production-aligned (must fix)**

*   The plan mixes **Stancl tenancy APIs** (`tenancy()->initialize`) with **Spatie tenancy** (current tenant is bound via finder + tasks). Spatie exposes `makeCurrent()` / `forgetCurrent()` and binds the tenant under `currentTenant`. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/working-with-the-current-tenant), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant)
*   The plan breaks Phase‑0 contract by changing:
    *   tenant identifier usage (id vs slug)
    *   payload fields (`member_name`, `expiry_date`) vs earlier `expires_at`
    *   response structure (`id` vs `data.card_id`)  
        This will regress compatibility across contexts.
*   The plan introduces **domain impurities** by passing a repository-backed policy *into the aggregate* (domain layer becomes infrastructure-aware).
*   The plan relies on a **partial unique index** via `Schema::table()->unique()->where(...)` which is not supported in Laravel’s schema builder in a portable manner and is DB-engine dependent; it typically requires raw SQL / DB-specific features. [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[deepwiki.com\]](https://deepwiki.com/laravel/framework/2.3.3-schema-builder)
*   The plan maps exceptions via **string matching on exception messages**—fragile, unmaintainable, and the opposite of DDD (exceptions should be typed).

✅ **Recommendation:** Proceed with Phase 1, but adjust it into a **coherent Phase‑1 MLP**: Activation endpoint + domain event + schema update + idempotent behavior + clean exception mapping + tenancy-correct testing.

***

## 2) Tenancy & Routing Alignment (Spatie-specific)

### 2.1 Wrong tenancy API in tests

Your test uses:

```php
tenancy()->initialize($this->tenant);
```

This is **not Spatie**. With Spatie, you typically:

*   determine tenant via a configured tenant finder at request start [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant)
*   or manually call `$tenant->makeCurrent()` and later `Tenant::forgetCurrent()` [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/working-with-the-current-tenant)

**Fix:** In feature tests, either:

*   call `$tenant->makeCurrent()` in Arrange (and `Tenant::forgetCurrent()` in tearDown), or
*   let tenant be resolved through your **PathTenantFinder** (preferred for true end-to-end tests).

### 2.2 Tenant must be enforced on routes

For routes requiring tenant context, Spatie provides `NeedsTenant` middleware (and recommends using it with `EnsureValidTenantSession`). [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/advanced-usage/ensuring-a-current-tenant-has-been-set), [\[github.com\]](https://github.com/spatie/laravel-multitenancy/blob/main/docs/advanced-usage/ensuring-a-current-tenant-has-been-set.md)

**Fix:** ensure Phase‑1 activation route is behind the same tenant middleware group used in Phase‑0.

***

## 3) API Contract Consistency (You’re about to break it)

Phase‑0 contract and test structure expects a response like:

```json
{ "data": { "card_id": "...", "member_id": "...", ... } }
```

But Phase‑1 plan uses:

*   request fields: `member_name`, `expiry_date`
*   response fields: top-level `id`, no `data` wrapper
*   tenant in URL uses tenant **id**, not tenant **slug**

This will break:

*   consumers (Membership Angular client)
*   your walking skeleton tests
*   future versioning strategy

**Fix:** Keep Phase‑0 contract stable:

*   `POST /{tenantSlug}/api/v1/cards` accepts `member_id` and `expires_at`
*   activation endpoint returns the same envelope and naming:
    *   `data.status`
    *   `data.activated_at`
    *   `data.card_id`

If you want to evolve the API, do it explicitly in **v2**, not by drifting contract mid-context.

***

## 4) Testing Strategy Review (TDD Quality)

### 4.1 “One test should make one request” guidance

Laravel’s own guidance warns unexpected behavior may occur when executing multiple requests within a single test.   
Your activation test currently makes **POST + PUT + GET** in one test method. [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)

This doesn’t mean it will always fail, but it increases fragility and makes failure diagnosis harder.

**Fix:** Split into focused tests:

*   `it_activates_an_issued_card()` (POST + PUT ok if you keep it)
*   `it_returns_activated_card_on_show()` (POST + PUT + GET) — or create via repository directly
*   `it_emits_card_activated_event()` (POST + PUT + event assert)

### 4.2 Time freezing is good (but validate formatting carefully)

Using `$this->travelTo(...)` is the correct approach; Laravel provides travel helpers for manipulating time. [\[danda.at\]](https://danda.at/blog/travelling-through-time-in-laravel-tests), [\[stackoverflow.com\]](https://stackoverflow.com/questions/48849090/how-to-mock-time-function-while-testing-in-laravel)

**Fix:** assert using ISO8601 consistently with what your API returns (e.g., `ATOM` / `toISOString()`), and ensure your serialization uses the same formatter everywhere.

***

## 5) Domain Model Review (DDD correctness)

### 5.1 Domain method signature is wrong in your plan

You updated `activate()` to accept a `CardIssuancePolicy`:

```php
public function activate(DateTimeImmutable $activatedAt, CardIssuancePolicy $policy): void
```

This is **DDD anti-pattern**: domain now depends on a service that depends on a repository (infrastructure).

**Fix (DDD-correct):**

*   Keep aggregate pure: `activate(DateTimeImmutable $at): void`
*   Enforce “one active card per member” at the **Application Layer**, where repositories are allowed.
*   Optionally model it as a **Domain Service interface** (port) owned by the Domain, implemented in Infrastructure—but do *not* inject it into the aggregate method.

### 5.2 Exception mapping via message inspection is a hard “no”

This:

```php
if (str_contains($e->getMessage(), 'already active')) ...
```

is brittle and will regress during refactors or translations.

**Fix:** throw typed domain exceptions directly:

*   `InvalidCardTransition`
*   `CardExpiredCannotActivate`
*   `CardAlreadyActive`

Then map them to HTTP at the controller (or exception handler).

***

## 6) Persistence & Migration Review (Multi‑DB + Portability)

### 6.1 Your migration assumes `tenant_id` exists in tenant DB table

If you’re using **database-per-tenant** (typical with Spatie SwitchTenantDatabaseTask), you *do not need* `tenant_id` column in tenant tables. Spatie switches the tenant database connection name based on the tenant’s `database` attribute. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/using-tasks-to-prepare-the-environment/switching-databases), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/installation/using-multiple-databases)

Adding `tenant_id` into tenant databases is redundant and a frequent source of confusion.

**Fix:** Remove `tenant_id` from tenant DB schema unless you are using **single-DB row-level tenancy** (which is a different strategy).

### 6.2 Partial unique index is not portable and often not supported by Laravel’s schema builder

Creating a partial unique constraint like:

```php
$table->unique([...])->where('status', 'active')
```

is not supported consistently through Laravel’s Schema Builder; partial indexes typically require raw SQL and are database-specific. [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[deepwiki.com\]](https://deepwiki.com/laravel/framework/2.3.3-schema-builder)

**Fix:** For Phase‑1 MLP, enforce “one active per member” in application logic with a transaction + lock.  
If you later want DB-level enforcement:

*   Use DB-specific migrations (raw statement) and accept reduced portability
*   Or for MySQL, consider alternate strategies (generated columns) but that is Phase‑2+ hardening.

***

## 7) Controller / Handler Design Review (Clean Architecture)

### 7.1 You use `php artisan make:command` for application commands

In Laravel, `make:command` generates Artisan console commands, not CQRS command objects. Keep your application command as a simple class: `php artisan make:class` (or create manually). (No citation needed—this is Laravel convention, but we can treat as best practice.)

### 7.2 Response serialization should use Resources, not `toArray()` on aggregate

Laravel API Resources are the built-in transformation layer, and they help you keep controllers slim and output stable. [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[api.laravel.com\]](https://api.laravel.com/docs/8.x/Illuminate/Http/Resources/Json/JsonResource.html)

**Fix:** return `DigitalCardResource` (or Context-local resource), keeping the `data` wrapper consistent.

***

## 8) Recommended Phase‑1 Plan (Corrected & Verified)

### Phase‑1 “Activation MLP” — recommended scope

1.  **Feature tests**
    *   activate issued card → 200 + `data.status=active` + `data.activated_at` exists
    *   activating already active card → 422 (or 409) with typed error
    *   cross tenant activate → 404 (Phase‑0 isolation principle)
    *   authorization (admin) → 403  
        Use Spatie tenancy correctly (`makeCurrent()` or path tenant finder). [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/working-with-the-current-tenant), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant)

2.  **Domain**
    *   Add `CardActivated` domain event (pure, no framework dependencies)
    *   Add `activate(DateTimeImmutable $at)` method enforcing:
        *   status must be `ISSUED`
        *   must not be expired (compare against `expiresAt`)
    *   Use typed domain exceptions (no message parsing)

3.  **Application**
    *   `ActivateCard` command object (simple DTO)
    *   `ActivateCardHandler`:
        *   load aggregate by id (tenant-scoped)
        *   call `activate($clock->now())`
        *   persist
        *   dispatch released events

4.  **Infrastructure**
    *   `PUT /{tenant}/api/v1/cards/{cardId}/activate`
    *   Request authorization via FormRequest is fine (403 if false) [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[fajarwz.com\]](https://fajarwz.com/blog/make-good-use-of-authorize-method-in-laravel-form-requests/)
    *   Controller maps typed exceptions to:
        *   404 not found
        *   422 business rule violation (or 409 conflict for state transition)
    *   Update repository mapping to include `activated_at`

5.  **Database**
    *   add `activated_at` nullable timestamp to tenant `digital_cards`
    *   postpone “one active per member” DB constraint until Phase‑2 hardening  
        (enforce via application service first)

6.  **Event**
    *   ensure event is dispatched via `Event::fake()` tests (as you did in Phase‑0)

***

## 9) “One Active Card Per Member” — How to Do It Correctly

### Why not in aggregate?

Because it depends on reading other aggregates (repo query), which is application/infrastructure responsibility.

### Phase‑1 recommended enforcement

In `ActivateCardHandler`, before activating:

*   query for existing active card for `member_id`
*   if exists and it’s not the same card → throw `MemberAlreadyHasActiveCard`

Wrap activation in a transaction and consider a lock to reduce race conditions (Phase‑1 can be “best effort”, Phase‑2 can harden).

DB partial unique index can be revisited later because it’s DB-specific and not reliably done through Schema Builder. [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[deepwiki.com\]](https://deepwiki.com/laravel/framework/2.3.3-schema-builder)

***

## 10) Key Fix List (Actionable)

Here’s what I would change immediately in your written plan:

1.  Replace `tenancy()->initialize()` with Spatie approach (`makeCurrent()`/finder) [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/working-with-the-current-tenant), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant)
2.  Keep tenant identifier as **slug** (consistent with Phase‑0 routing)
3.  Keep request/response contract unchanged (use `expires_at`, `data.card_id`, etc.)
4.  Do not pass repository policy into aggregate
5.  Replace message-based exception mapping with typed exceptions
6.  Remove `tenant_id` from tenant DB tables unless you explicitly use row-level tenancy
7.  Do not attempt partial unique index via Schema Builder in Phase‑1—enforce in app layer first [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[deepwiki.com\]](https://deepwiki.com/laravel/framework/2.3.3-schema-builder)
8.  Split multi-request tests or keep them minimal and focused (Laravel notes unexpected behavior) [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)
9.  Use API Resources for stable output serialization [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[api.laravel.com\]](https://api.laravel.com/docs/8.x/Illuminate/Http/Resources/Json/JsonResource.html)

***

## 11) Final Architectural Suggestion (Phase‑1 end state)

**Sequence (Activation):**

1.  Route resolves tenant via finder (path slug) and binds `currentTenant` [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/working-with-the-current-tenant)
2.  `NeedsTenant` ensures tenant exists for route group [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/advanced-usage/ensuring-a-current-tenant-has-been-set), [\[github.com\]](https://github.com/spatie/laravel-multitenancy/blob/main/docs/advanced-usage/ensuring-a-current-tenant-has-been-set.md)
3.  Controller authorizes request (FormRequest) [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[fajarwz.com\]](https://fajarwz.com/blog/make-good-use-of-authorize-method-in-laravel-form-requests/)
4.  Handler loads aggregate (tenant DB switched by task) [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/using-tasks-to-prepare-the-environment/switching-databases), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/installation/using-multiple-databases)
5.  Aggregate enforces invariants, records `CardActivated`
6.  Repository persists `activated_at`, dispatches domain events

This yields a clean, testable, and context-safe implementation.

***

## Two Clarifying Questions (to “lock” the best version)

1.  Are your tenants **database-per-tenant** (Spatie `SwitchTenantDatabaseTask`) or **single DB with tenant\_id**? [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/using-tasks-to-prepare-the-environment/switching-databases), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/installation/using-multiple-databases)
2.  In URLs you want `{tenant}` to be **slug** (as Phase‑0), correct?

If you answer those, I’ll rewrite your **Phase‑1 test suite + route + handler + domain exception taxonomy** in a cohesive “Phase‑1 PR plan” that will pass Phase‑0 regression tests and remain Spatie-correct.

Absolutely — revocation is the **right next lifecycle capability** for Phase 1 because it closes the “core operational triangle” (**issue → activate → revoke**) and creates the minimum usable lifecycle for downstream contexts (Membership, AccessControl). That said, the plan as written has a few **architectural inconsistencies** that will either break Phase‑0 guarantees or create long‑term maintenance debt. Below is a **senior engineer + solution architect** review with concrete corrections.

***

## 1) Architectural Fit: ✅ Correct Direction, ⚠️ Needs Alignment

**✅ Correct progression:** After activation, revocation is the most valuable next step, since it defines a terminal state and supports real operational flows (lost device, membership cancellation, fraud, etc.). This also helps enforce tenant boundary behavior by adding more state transitions and events. (Spatie promotes tenant context being resolved per request and then bound in container, which fits this event-driven lifecycle nicely.) [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes)

**⚠️ But:** Your plan continues the same two issues from the Activation plan:

1.  **Tenancy API mismatch**: you use `tenancy()->initialize($tenant)` which aligns with other tenancy packages, not Spatie. Spatie expects either automatic resolution via a TenantFinder or manual `$tenant->makeCurrent()` / `Tenant::forgetCurrent()`. [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes)
2.  **API contract drift**: the payload/response and route tenant identifier (`tenant->id`) contradict Phase‑0’s contract (`/{tenantSlug}/api/v1/cards` and `data.card_id`, `expires_at`). A stable contract is essential once a bounded context starts serving other contexts. (Laravel API Resources wrap responses in `data` by default, which matches your Phase‑0 test structure.) [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)

**Recommendation:** Proceed with revocation, but **normalize** the plan to the Phase‑0 contract and Spatie tenancy model.

***

## 2) Tenancy & Isolation: Must-Fix Items

### 2.1 Use Spatie tenancy mechanics in tests

In Spatie, tenant context can be set by the tenant finder at request start and the resolved tenant is bound in the container under `currentTenant`.   
For tests where you don’t want to rely on finder wiring, use Spatie’s manual switching: [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes)

*   `$tenant->makeCurrent()` in Arrange
*   `Tenant::forgetCurrent()` in tearDown / finally

This prevents “invisible” tenant bleed across tests and is aligned with how Spatie expects tenant switching to work. [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes)

### 2.2 Ensure revocation routes require a current tenant

Spatie recommends `NeedsTenant` middleware (often grouped with `EnsureValidTenantSession`) for routes where a tenant must be present; otherwise a `NoCurrentTenant` exception is thrown.   
So revocation routes must live under your tenant middleware group (same as Phase‑0/activation routes). [\[laraveldoctrine.org\]](https://www.laraveldoctrine.org/docs/current/migrations/builder), [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)

***

## 3) API Contract Consistency: Stop the Drift

Right now, tests expect:

*   request: `member_id`, `member_name`, `expiry_date`
*   response: top-level `id`, `status`

But Phase‑0 expects:

*   request: `member_id`, `expires_at` (ISO string)
*   response: `{ data: { card_id, member_id, status, issued_at, expires_at, qrcode } }`

Laravel’s API Resources default to a `data` wrapper, which matches Phase‑0. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)

**Recommendation (Phase‑1 rule):**  
✅ Keep the API contract stable: revocation should return the same envelope and naming (`data.card_id`, `data.revoked_at`, `data.revocation_reason`).  
If Membership (Angular) is already integrating, this is non‑negotiable.

***

## 4) Test Design: Good Coverage, But Needs Structure & Correct Assertions

### 4.1 Too many requests in single test methods

Laravel’s HTTP testing docs explicitly warn that multiple requests in one test can lead to unexpected behavior; tests become harder to diagnose when they fail.   
Your tests often do `POST → PUT activate → PUT revoke → GET`. That’s a full integration scenario and should be separated into: [\[github.com\]](https://github.com/spatie/laravel-multitenancy/blob/main/docs/advanced-usage/ensuring-a-current-tenant-has-been-set.md), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/introduction)

*   **Revocation behavior tests** (1 scenario each)
*   **Lifecycle integration test** (a single “happy path” test is fine)

### 4.2 Time travel is good — keep it deterministic

Laravel provides test “time travel” helpers (`travelTo`, `travelBack`) which is a good practice for timestamp assertions.   
Just ensure your API serialization uses a consistent formatter (`ATOM`) so the test can compare reliably. [\[blog.greeden.me\]](https://blog.greeden.me/en/2025/12/24/field-ready-complete-guide-designing-a-multi-tenant-saas-in-laravel-tenant-isolation-db-schema-row-domain-url-strategy-billing-authorization-auditing-performance-and-an-access/), [\[laravel-news.com\]](https://laravel-news.com/spatie-multitenancy-laravel)

### 4.3 Validation errors should be asserted properly

Using a FormRequest for `reason` is correct; failed validation returns a 422 with validation errors. Laravel’s validation and FormRequest flow is the standard approach.   
However, for “already revoked” you currently assert `assertJsonValidationErrors(['card'])` — that implies you treat it like input validation, but it’s a **domain/business rule violation**. That should be expressed as: [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/using-tasks-to-prepare-the-environment/switching-databases), [\[Mastering...ie Package\]](http://chandandubey.com/mastering-multi-tenancy-in-laravel-with-the-spatie-package/)

*   `422` with a structured business error (or `409 Conflict`), not a fake validation error on a “card” field.

***

## 5) Domain Layer Review: Solid intent, but exception strategy is wrong

### 5.1 Don’t throw generic DomainException strings and parse messages

Your handler maps behavior by `str_contains($e->getMessage(), ...)`. This is brittle and breaks refactoring. Use typed exceptions directly from the domain (e.g. `CardAlreadyRevoked`, `InvalidCardTransition`, `InvalidRevocationReason`). This is classic DDD: exceptions are part of the ubiquitous language and become stable programmatic contracts.

(Spatie + DDD works well here since events and tenant-bound tasks happen outside the domain and don’t pollute it.) [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[laravel.com\]](https://laravel.com/docs/12.x/validation)

### 5.2 Revocation rules: verify business semantics

You enforce:

*   issued/active can revoke ✅
*   expired cannot revoke ✅
*   reason required and min length ✅

Those rules are reasonable. But you should decide **one policy question** now:

> Is **EXPIRED** a terminal state that still allows **REVOKED** for audit/legal reasons?

Some systems allow revocation even after expiry for compliance logging. Your tests currently block it — that’s acceptable, but it’s a product decision. Ensure stakeholders agree.

***

## 6) Persistence & Multi‑DB Concerns (Spatie-specific)

### 6.1 Avoid tenant\_id inside tenant databases (if using DB-per-tenant)

If you’re using Spatie’s DB switching task, it switches the tenant database name on the tenant connection based on the tenant model’s database attribute. That means tenant data is already isolated and doesn’t require `tenant_id` columns.   
Your repository code shows you’re writing `tenant_id` into the card record; that’s typical for **row-level tenancy**, but you’ve indicated Spatie + abstraction, which usually means DB-per-tenant. [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)

**Action:** Confirm your tenancy strategy:

*   **DB-per-tenant** → remove tenant\_id from tenant tables
*   **single DB (tenant\_id)** → you need global scopes and strict query filters

### 6.2 Migration steps should remain tenant-safe

Revocation requires these columns (tenant DB):

*   `revoked_at` nullable timestamp
*   `revocation_reason` nullable text/string

That’s fine.

***

## 7) Route & Middleware: Ensure tenant must be present

Spatie recommends applying `NeedsTenant` (and often `EnsureValidTenantSession`) to routes that must have an active tenant; otherwise it throws.   
So your revocation route should be in the same tenant middleware group as activation and issuance. [\[laraveldoctrine.org\]](https://www.laraveldoctrine.org/docs/current/migrations/builder), [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)

***

## 8) Recommended “Corrected” Revocation Plan (Phase‑1 Quality Bar)

Here’s the **architect-level corrected plan** that keeps your original intent but fixes the main architectural issues:

### A) Tests (TDD-first)

Create **focused tests**:

1.  `revokes_active_card_with_reason()`
2.  `revokes_issued_card_with_reason()`
3.  `cannot_revoke_revoked_card()` → returns 422/409 business error
4.  `requires_reason()` → 422 validation error
5.  `requires_admin()` → 403
6.  `records_revocation_timestamp()` with `travelTo()` [\[blog.greeden.me\]](https://blog.greeden.me/en/2025/12/24/field-ready-complete-guide-designing-a-multi-tenant-saas-in-laravel-tenant-isolation-db-schema-row-domain-url-strategy-billing-authorization-auditing-performance-and-an-access/), [\[laravel-news.com\]](https://laravel-news.com/spatie-multitenancy-laravel)
7.  `cross_tenant_revocation_returns_404()` (must-have for isolation)

Use Spatie tenancy correctly via tenant finder or `$tenant->makeCurrent()`. [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes)

### B) Domain

*   Add `CardRevoked` event (pure)
*   Add `revoke(reason, revokedAt)`:
    *   validate allowed status transitions
    *   validate reason
    *   set status + timestamps
    *   record `CardRevoked`
*   Throw typed domain exceptions, no string parsing

### C) Application

*   `RevokeCard` command object (simple DTO) — don’t use `make:command` (that creates Artisan commands)
*   `RevokeCardHandler`:
    *   load by CardId
    *   call `revoke()`
    *   persist
    *   dispatch domain events

### D) Infrastructure

*   Route: `PUT /{tenant}/api/v1/cards/{cardId}/revoke`
*   FormRequest:
    *   authorize admin
    *   validate reason min/max [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/using-tasks-to-prepare-the-environment/switching-databases), [\[Mastering...ie Package\]](http://chandandubey.com/mastering-multi-tenancy-in-laravel-with-the-spatie-package/)
*   Controller returns via API Resource for contract stability (`data` envelope). [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)

### E) DB Migration

*   Add `revoked_at`, `revocation_reason` to tenant `digital_cards`

***

## 9) Full Lifecycle Test: Keep One, But Don’t Let It Drive Contract Drift

Your “CardLifecycleTest” is good as a **single end-to-end confidence test**, but:

*   it must use the canonical API contract (`data.card_id`, etc.)
*   it must not rely on tenancy APIs from another package
*   it should remain one test, not a suite substitute

Also remember Laravel notes multi-request tests can be unpredictable; so keep it as one integration test, not the primary mechanism for verifying each rule. [\[github.com\]](https://github.com/spatie/laravel-multitenancy/blob/main/docs/advanced-usage/ensuring-a-current-tenant-has-been-set.md), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/introduction)

***

## 10) What to Implement Next (After Revocation)

Your recommendation to do **card listing** next is correct — it’s foundational for the admin UI and will quickly expose whether your repository & tenant isolation are robust.

**I recommend next:**

### ✅ Card Listing (Admin) with filters + pagination

*   `GET /{tenant}/api/v1/cards?status=&member_id=&q=&sort=&page=`
*   Return `data` list + `meta` pagination (Laravel Resources handle this cleanly) [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)
*   Add cross-tenant listing isolation tests

Then:

1.  Policies (fine-grained authorization)
2.  Vue/Inertia DataTable for admin
3.  QR display & regeneration policies (if needed)

***

## Two Quick Questions (so I tailor the exact implementation guidance)

1.  Are you **DB-per-tenant** with Spatie’s `SwitchTenantDatabaseTask` (tenant connection database name changes)? [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)
2.  Is `{tenant}` in routes the **slug** (as in Phase‑0 walking skeleton) or the tenant **id**?

Once you answer, I’ll rewrite your **Revocation test suite + domain exception taxonomy + handler/controller responsibilities** in a Phase‑1-ready, Spatie-correct professional form—without breaking Phase‑0 tests.
Great choice — **card listing (pagination + filters)** is exactly the next “admin‑foundation” capability. As a senior developer / solution architect, I’ll **verify the plan**, highlight **architectural risks**, and propose a **corrected Phase‑1 listing design** that stays consistent with:

*   **Spatie laravel‑multitenancy** (tenant resolved per request / or via `makeCurrent`) and tenant-scoped routes/middleware [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[laraveldoctrine.org\]](https://www.laraveldoctrine.org/docs/current/migrations/builder), [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)
*   Your **Phase‑0 API contract** (stable `data` wrapper and field names)
*   DDD boundaries (domain purity, infra dependencies, clean “read model” separation)
*   Practical performance and maintainability

***

## 1) Overall Assessment

### ✅ What’s strong in your plan

*   You correctly treat listing as **Application Query → Handler → Repository** (CQRS‑style), which keeps the controller thin.
*   Filters cover real admin use cases: status, member fields, date ranges, sorting, per\_page cap.
*   You explicitly test **tenant isolation** and **authorization**, which is non‑negotiable for multi‑tenant SaaS.

### ⚠️ What will hurt you if you implement as-is

There are **four critical issues** that must be corrected before you build on this:

1.  **Tenancy API mismatch** again (`tenancy()->initialize(...)`)  
    With Spatie, tenant context is determined at request start via a configured tenant finder and is bound in the container under `currentTenant`, or manually switched via `$tenant->makeCurrent()`/`forgetCurrent()`.  
    Your current tests risk becoming green for the wrong reasons, or brittle across environments. [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes)

2.  **API contract drift** (IDs, fields, envelope)  
    Your listing test expects `id`, `member_name`, `expiry_date`, etc. But Phase‑0 expects a `data` wrapper and uses `card_id`, `expires_at` etc. Laravel Resources wrap responses in `data` by default, which aligns well with your Phase‑0 contract. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)

3.  **Wrong tenancy model: adding `tenant_id` to tenant DB tables**  
    If you are on **DB-per-tenant** (typical with Spatie + SwitchTenantDatabaseTask), tenant isolation is done by **switching the tenant connection’s database name** when the tenant becomes current.  
    In that model, adding `tenant_id` into tenant tables is redundant and adds complexity + index bloat. [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)

4.  **Domain/Infrastructure coupling via repository returning Laravel paginator**
    Your **domain repository interface** returning `LengthAwarePaginator` pulls a framework type into the domain boundary. DDD-wise, read concerns should be either:
    *   A separate **ReadModel Repository** (application/infrastructure), OR
    *   A domain repository that returns domain objects / collections, not paginators.

Laravel’s docs emphasize resources as the transformation layer for API responses, which belongs in Infrastructure / Interface layer, not Domain. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)

***

## 2) Key Corrections (Senior-level Guidance)

### 2.1 Tenancy: do it the Spatie way (tests + runtime)

**Best practice:** Let your *real routing* set the tenant via your **PathTenantFinder**, and add Spatie’s middleware to ensure tenant exists for these routes. [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources), [\[laraveldoctrine.org\]](https://www.laraveldoctrine.org/docs/current/migrations/builder), [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)

For tests, either:

*   use request URLs that trigger your tenant finder, OR
*   explicitly call `$tenant->makeCurrent()` and `Tenant::forgetCurrent()` around test execution [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes)

> **Avoid** `tenancy()->initialize()` in a Spatie system — it belongs to a different tenancy stack.

***

### 2.2 Keep the Phase‑0 API contract stable

Your listing endpoint must output consistent shape. If Phase‑0 returns:

```json
{ "data": [{...}], "links": {...}, "meta": {...} }
```

then listing should do the same. Laravel API Resources support this cleanly and consistently. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)

**Recommendation:**

*   Use `DigitalCardListResource` / `DigitalCardResourceCollection`
*   Return paginator with resource collection (meta + links automatically)

***

### 2.3 Remove `tenant_id` column if DB-per-tenant (most likely with Spatie)

Spatie’s database-per-tenant setup relies on tenant/landlord connections; the tenant DB name is dynamically switched via a task (e.g. SwitchTenantDatabaseTask) when a tenant is made current. [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)

So, tenant scoping should be achieved by:

*   The tenant connection pointing at the current tenant DB
*   NOT by `tenant_id` global scopes

**If** you are actually doing **single DB row-level tenancy**, then yes, tenant\_id + global scope is correct. But that’s a different tenancy approach than “Spatie switching DB”.

***

### 2.4 SQL portability: don’t use `ILIKE` unless you’re guaranteed Postgres

Your repository uses:

```php
where('member_id', 'ILIKE', '%...%')
```

`ILIKE` is PostgreSQL-specific. MySQL uses `LIKE` with collations. This will break on MySQL/MariaDB.

**Recommendation:** Use `LIKE` universally and, if needed:

*   Normalize input (lowercase both sides) OR
*   Use DB collation / fulltext strategy later

***

## 3) Test Plan Review (What to keep, what to change)

### ✅ Keep (high value)

*   Tenant isolation listing test (excellent)
*   Authorization test (admin-only)
*   Pagination test
*   Sorting test
*   Date-range filter test (good)

### ⚠️ Change (to reduce flakiness and cost)

#### 3.1 Don’t create 25 cards via HTTP POST in a loop

It’s slow and makes listing tests depend on issuance endpoint stability.

Laravel warns that multiple requests per test can cause unexpected behavior; large request loops are even worse. [\[github.com\]](https://github.com/spatie/laravel-multitenancy/blob/main/docs/advanced-usage/ensuring-a-current-tenant-has-been-set.md), [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/introduction)

**Better:** insert cards directly using factory/model on tenant connection, then run a single GET request.

#### 3.2 Don’t enforce performance in PHPUnit with hard “<200ms”

Those tests are notoriously flaky across CI environments and DB drivers. Instead:

*   Assert query count (if you instrument)
*   Assert indexes exist (migration coverage)
*   Run performance checks as **separate benchmark suite**, not unit/feature tests

***

## 4) Recommended Architecture for Listing (DDD + CQRS clean separation)

### 4.1 Split Write vs Read repositories

*   **Domain repository**: `DigitalCardRepository` (save/byId) returning aggregate
*   **Read repository**: `DigitalCardReadRepository` (paginate/filter/sort) returning DTOs/paginator

This keeps domain pure and makes listing evolve independently.

### 4.2 Query/Handler remains correct

Your `ListCardsQuery` is fine — but it should validate and normalize:

*   `perPage` clamped to max (e.g. 50)
*   `sort` validated against allowlist (you already do this)
*   Date parsing should use strict format and convert to immutable objects

Validation belongs in FormRequest (Infrastructure), then Query/Handler handles normalized values. Laravel FormRequest authorization+validation is the standard pattern. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/using-tasks-to-prepare-the-environment/switching-databases), [\[Mastering...ie Package\]](http://chandandubey.com/mastering-multi-tenancy-in-laravel-with-the-spatie-package/)

### 4.3 Controller response should be a Resource Collection

Return:

*   `return DigitalCardListResource::collection($paginator);`

Laravel resources are intended exactly for this transformation layer. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)

***

## 5) Concrete “Corrected Plan” (Minimal, Safe, Phase‑1 quality)

### Step A — Tests (rewrite expectations to match Phase‑0 contract)

*   Listing route: `GET /{tenantSlug}/api/v1/cards`
*   Response: `data[*].card_id`, `member_id`, `status`, `issued_at`, `expires_at`, plus optional fields (`activated_at`, `revoked_at`, `revocation_reason`)
*   Use Spatie tenant finder or `$tenant->makeCurrent()`/`forgetCurrent()` [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources)

### Step B — Read Repository (Infrastructure) with portable filters

*   Use tenant connection (DB-per-tenant) automatically switched by Spatie tasks [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)
*   Use `LIKE`, not `ILIKE` (unless you confirm Postgres-only)
*   Allowlist sorting columns

### Step C — Resource Collection response

Use Laravel Resources to return paginated result with `links/meta`. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/basic-usage/automatically-determining-the-current-tenant), [\[arudhraittechs.org\]](https://arudhraittechs.org/how-build-secure-multi-tenant-application-laravel-2025-edition)

### Step D — Request Validation + Authorization

FormRequest is perfect here:

*   authorize admin
*   validate filters, per\_page max, sort allowlist [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/using-tasks-to-prepare-the-environment/switching-databases), [\[Mastering...ie Package\]](http://chandandubey.com/mastering-multi-tenancy-in-laravel-with-the-spatie-package/)

### Step E — Tenant middleware group

Ensure listing is behind Spatie `NeedsTenant` (and optional `EnsureValidTenantSession`). [\[laraveldoctrine.org\]](https://www.laraveldoctrine.org/docs/current/migrations/builder), [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)

***

## 6) Your “tenant\_id column + global scope” section: ✅ only if row-level tenancy

You currently propose:

*   Add `tenant_id` column
*   Add global scope that filters by tenant\_id

This is correct **only if** your tenancy strategy is **single DB with tenant\_id**.

But if you’re using Spatie’s typical **database-per-tenant** approach, this is the wrong direction because tenant isolation comes from switching tenant DB connection/database name. [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)

**Action:** Decide and lock this now. Otherwise you’ll double-scope and create confusing bugs.

***

## 7) Answer to your final question (“Vue UI next or Policies?”)

### My recommendation as Solution Architect:

✅ **Implement Laravel Policies next** (before Vue UI).

Why:

*   The admin UI will immediately need permissions (“can activate”, “can revoke”, “can list”).
*   Policies prevent leakage when you later add roles/teams and allow non-admin read-only views.
*   It reduces UI complexity (UI consumes `can` flags).

Then:
✅ Build **Vue/Inertia Admin UI** (DataTable + filters + action buttons).

Laravel FormRequest authorization works, but policies are the scalable mechanism for authorization rules as complexity increases. [\[spatie.be\]](https://spatie.be/docs/laravel-multitenancy/v4/using-tasks-to-prepare-the-environment/switching-databases), [\[Mastering...ie Package\]](http://chandandubey.com/mastering-multi-tenancy-in-laravel-with-the-spatie-package/)

***

## 8) Two quick questions to finalize the correct implementation path

1.  **Tenancy strategy:** Are you using **DB-per-tenant** (tenant connection database switching via Spatie tasks) or **single DB row-level**? [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)
2.  **Database engine:** MySQL/MariaDB or PostgreSQL? This determines whether `ILIKE` is valid.

Once you answer those, I’ll provide a **clean, production-ready rewrite** of:

*   `ListCardsTest` (Spatie-correct + Phase‑0 contract)
*   `ListCardsRequest` + query normalization
*   `DigitalCardReadRepository` implementation (portable SQL)
*   `DigitalCardListResource` collection output

…and then we can proceed either to **Policies** or directly to **Vue/Inertia admin components**.

This is a **strong start** for an Inertia/Vue 3 admin UI, and the component decomposition is mostly on point. However, as a senior engineer / solution architect, I’d **not merge this as-is** because there are several **architectural contract mismatches** and a few **implementation bugs** that will create rework and regressions (especially with your Phase‑0 API contract + Spatie tenancy).

Below is a **professional review + a corrected implementation blueprint**, designed to keep your UI clean, your backend stable, and your tenancy boundaries airtight.

***

# 1) High-Level Review (What’s good vs what must change)

## ✅ What’s good

*   **Inertia pattern** is used correctly: page receives `cards`, `filters`, `stats`, `permissions`, and renders stateful UI.
*   **Separation into components** (Filters, Table, Modals, Badge) is the right granularity.
*   **Action flow** is consistent: confirm → execute → reload/refresh.
*   **UX** includes loading states, empty state, toast/notification feedback, and per-page selection.

## ⚠️ What must change (critical)

### 1) You’re mixing **Web (Inertia)** and **API (JSON)** responsibilities in one controller

You propose using the same `DigitalCardController` for:

*   `/admin/digital-cards` (Inertia pages)
*   `/{tenant}/api/v1/cards` (JSON API for Angular/mobile)

This becomes unmaintainable fast and typically causes:

*   accidental response format drift
*   shared auth logic issues
*   route model binding collisions
*   tenancy assumptions leaking across route groups

✅ **Recommendation:** Split into two controllers:

*   `DigitalCardWebController` (Inertia pages + web actions)
*   `DigitalCardApiController` (pure JSON, stable API contract)

Keep them in the same context folder, but separate by delivery mechanism.

***

### 2) Your frontend uses fields that contradict Phase‑0 (contract drift)

Your Vue expects fields like:

*   `card.id`, `expiry_date`, `member_name`, `qr_code_data`

But Phase‑0 walking skeleton contract uses:

*   `data.card_id`, `expires_at`, and it didn’t include `member_name`

If you keep drifting the contract, you’ll break:

*   Phase‑0 tests
*   Membership context integration
*   long-term API versioning

✅ **Recommendation:** pick one contract and stick to it.  
Given Phase‑0 already exists, **normalize frontend to that**:

Use:

*   `card.card_id` (or map `card_id` to `id` in a UI mapper)
*   `expires_at` instead of `expiry_date`
*   keep `member_id`, `status`, `issued_at`

If you want `member_name`, add it intentionally to the backend response and tests, or keep it out until Membership integration provides it via an ACL / projection.

***

### 3) Tenancy mismatch is still present (backend & routes)

You’re using `/{tenant}/admin/digital-cards` which is correct, but your backend earlier plan used tenant id in URLs (`$tenant->id`). With **Spatie** and your existing abstraction layer, tenant should be resolved via your tenant finder (path slug), and **the current tenant should be set per request**.

✅ **Recommendation:**

*   Ensure `{tenant}` is consistently the **slug** (path tenant finder), not the database id.
*   Put **web routes** and **api routes** behind the same “tenant required” middleware group (your Spatie setup).

***

# 2) Concrete Code Issues (Bugs / Foot-guns)

## 2.1 `IssueCardModal.vue`: `loading` is defined twice (bug)

You define:

*   `props.loading`
*   `const loading = ref(false)`

That shadows and breaks the prop.

✅ Fix: rename the local state to `submitting` OR rely exclusively on `props.loading`.

```js
const submitting = ref(false)
```

…and update template bindings accordingly.

***

## 2.2 `router.post` is not `await`-able the way you wrote it

Inertia `router.post(...)` isn’t a Promise in the way typical fetch is. Your `try/await/catch` around `router.post` won’t behave as intended.

✅ Fix: use Inertia’s callback lifecycle:

```js
submitting.value = true
router.post(route('tenant.digital-cards.store'), payload, {
  preserveScroll: true,
  onSuccess: (page) => { /* ... */ },
  onError: (errors) => { /* ... */ },
  onFinish: () => { submitting.value = false },
})
```

***

## 2.3 Using `prompt()` for revoke reason is a UX + security anti-pattern

*   No validation UI
*   No accessibility
*   No consistent error mapping

✅ Fix: implement a `RevokeCardModal` with a textarea + validation.  
Keep `ConfirmationModal` for activate only (no user input required).

***

## 2.4 `Index.vue`: you use `route('tenant.digital-cards.activate', card.id)`

But your card identity in Phase‑0 is `card_id`. If the API returns `card_id`, your UI will send wrong IDs.

✅ Fix: use `card.card_id` everywhere OR create a mapper:

```js
const cardKey = (card) => card.card_id ?? card.id
```

***

## 2.5 “Virtual scrolling for large datasets” is claimed but not implemented

You’re rendering a normal `<table>` with `v-for`. That’s fine for 20–100 rows, but not “virtual scrolling”.

✅ Fix:

*   remove the claim, **or**
*   add a virtualization strategy later (Phase‑2), e.g. `vue-virtual-scroller` + row component.

***

# 3) Recommended Architecture (Clean, future-proof)

## 3.1 Route separation (best practice)

### Web (Inertia UI)

*   `GET /{tenant}/admin/digital-cards` → index page
*   `GET /{tenant}/admin/digital-cards/{cardId}` → details page (optional)
*   Web actions can either:
    *   call the same application services directly (recommended), or
    *   proxy to API endpoints (not recommended; duplicates auth + error handling)

### API (JSON contract)

*   `GET /{tenant}/api/v1/cards` → list
*   `POST /{tenant}/api/v1/cards` → issue
*   `PUT /{tenant}/api/v1/cards/{cardId}/activate`
*   `PUT /{tenant}/api/v1/cards/{cardId}/revoke`

✅ The UI should call **web routes** for web actions when possible (keeps CSRF/session-based auth consistent).

***

## 3.2 Controller split

*   `Infrastructure/Http/Controllers/DigitalCardWebController.php`
*   `Infrastructure/Http/Controllers/DigitalCardApiController.php`

The Web controller returns:

*   `Inertia::render(...)`
*   redirects with flash messages
*   optionally partial reload props (`router.reload({ only: [...] })` works well)

The API controller returns:

*   consistent JSON Resource outputs
*   stable error envelope

***

## 3.3 Use API Resources consistently for `cards` pagination

Even for Inertia props, passing a Laravel paginator is fine, but you should ensure:

*   `cards.data[]` is minimal (list item shape)
*   `cards.meta` and `cards.links` exist

That avoids your frontend needing to “guess” structure.

***

# 4) UI Suggestions (Senior-level enhancements)

## 4.1 Use `useForm()` for Issue/Revoke modals

Inertia’s `useForm` gives:

*   built-in error tracking
*   processing state
*   resets
*   consistent submission handling

Example for Issue modal:

```js
import { useForm } from '@inertiajs/vue3'

const form = useForm({
  member_id: '',
  expires_at: null,
  notes: '',
})

const submit = () => {
  form.post(route('tenant.digital-cards.store'), {
    preserveScroll: true,
    onSuccess: () => form.reset(),
  })
}
```

This will simplify your manual `errors` + `loading` handling.

***

## 4.2 Debounce filters

Your filters emit immediately only on submit (good), but member\_id and member\_name search could optionally support “type-and-search” for UX.

Add a debounced update (later) to avoid hammering the server.

***

## 4.3 Improve date handling and locale support

You hardcode `en-US`. If your tenant base is multi-lingual, use:

*   `Intl.DateTimeFormat` with user locale
*   or a centralized date formatter helper

Also keep backend dates as ISO8601 and let the UI render localized.

***

## 4.4 Accessibility notes

You’re using Headless UI `<Menu>` which is good for keyboard navigation.
For modals:

*   ensure your `Modal` component traps focus and supports ESC close (likely already true).
*   avoid `alert()` and `prompt()` for anything beyond placeholders.

***

# 5) Backend changes required to support this UI cleanly

## 5.1 Add a dedicated “Admin UI endpoint” (Inertia) without breaking API

Don’t change your existing API controller methods; create Web controller methods that use the same Application handlers/queries.

### Minimal Web Controller responsibilities

*   Read `filters` from request
*   Build `ListCardsQuery`
*   Call query handler
*   Provide `stats` (could be derived from repository with groupBy)
*   Provide `permissions` flags

### Strong recommendation: compute `stats` efficiently

Instead of calling `DigitalCardModel::count()` multiple times (N queries), prefer one query with conditional aggregates (DB-specific approach) or fetch once and compute.

***

## 5.2 Keep `eligibleMembers` as an integration seam (ACL)

You currently return dummy data. That’s fine for scaffolding, but architecturally:

*   In a multi-context system, member search typically belongs to Membership context.
*   DigitalCard admin UI can call a “Member lookup endpoint” in Membership context (or your platform gateway).

For now: keep it simple but mark it clearly as stub.

***

# 6) What I would do next (implementation order)

Since you’ve chosen to implement UI first, I’d do:

1.  **Controller split** (Web vs API)
2.  **Normalize data contract** in Vue (use `card_id`, `expires_at`)
3.  Implement **RevokeCardModal** (remove prompt)
4.  Use `useForm()` for Issue + Revoke
5.  Add **Policies** next (server-side truth), then expose `permissions` to UI

> Policies are the guardrails that stop “UI says yes but backend says no” and prevent accidental tenant data leaks when new roles appear.

***

# 7) Quick “must answer” questions (so we align precisely)

1.  What do you want the **canonical field names** in the UI to be?
    *   Option A: keep Phase‑0 API (`card_id`, `expires_at`)
    *   Option B: map to UI-friendly (`id`, `expiry_date`) but do mapping in one place (resource/transformer)

2.  Is `{tenant}` in URLs the **slug** (recommended) or **UUID**?

With those two answers, I can give you a **finalized, production-grade implementation plan** (including the corrected backend web controller, routes, and the Vue changes) that won’t break Phase‑0 tests and won’t conflict with your Spatie tenancy abstraction.
Great—**Policies + real‑time updates** are exactly the right “Phase‑1 hardening” moves *after* the UI and lifecycle endpoints exist. But your current draft has a few **architectural mismatches** (Spatie tenancy, policy 대상 class, channel auth strategy, env var naming in Laravel 12) that will bite you later unless we correct them now.

Below is a **senior software engineer / solution architect verification + corrected implementation blueprint**. I’ll keep it pragmatic and aligned with:

*   **Spatie `laravel-multitenancy`** tenant resolution & container binding (`currentTenant`), plus manual switching (`makeCurrent/forgetCurrent`) [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources)
*   **Tenant-required routing** using `NeedsTenant` / `EnsureValidTenantSession` middleware group [\[laraveldoctrine.org\]](https://www.laraveldoctrine.org/docs/current/migrations/builder), [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)
*   **Laravel 12 broadcasting** best practices, env var **`BROADCAST_CONNECTION`**, channel authorization via `routes/channels.php`, and Echo setup with **VITE\_** envs [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting), [\[vite.dev\]](https://vite.dev/guide/env-and-mode)

***

# 0) Executive Summary (What to change before you implement)

## ✅ Keep

*   A dedicated `DigitalCardPolicy` with abilities: `viewAny`, `view`, `create`, `activate`, `revoke`, `export`, etc.
*   Tenant-scoped private channels for WebSocket events.
*   Avoid broadcasting sensitive QR payloads.

## ❌ Fix (Critical)

1.  **Don’t bind a Laravel Policy to a Domain Entity** (`App\Contexts\...Domain\Entities\DigitalCard`).  
    Policies (and route model binding) expect an **Eloquent model** or at least an object that is not reconstructed via DTO hacks. Your plan currently converts DTO → Domain Entity for authorization—this breaks DDD boundaries and is fragile.

2.  **Stop using `tenancy()->getCurrentTenant()`** in policy/controller/tests—this is not Spatie.  
    In Spatie, the current tenant is bound under `currentTenant` and can be accessed via `app('currentTenant')`, and you can manually set it using `$tenant->makeCurrent()` / `Tenant::forgetCurrent()`. [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources)

3.  **Broadcasting config for Laravel 12 uses `BROADCAST_CONNECTION`**, not `BROADCAST_DRIVER`. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

4.  **Do not create a custom broadcasting auth controller** unless you have a special reason.  
    Laravel’s intended approach is: authorize channels in `routes/channels.php` using `Broadcast::channel(...)`. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

5.  **Don’t broadcast from handlers directly** as your primary design.  
    Use **domain event listeners** to translate domain events → broadcast events. This keeps the Application layer clean and avoids duplication.

***

# 1) Step 1 — Policies (Correct, DDD‑friendly, Spatie‑friendly)

## 1.1 Policy target should be the **Eloquent model**, not the domain aggregate

Create/ensure you have an Eloquent model for cards, e.g.:

*   `App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent\DigitalCardModel`

Then map policy:

```php
// App\Providers\AuthServiceProvider.php
protected $policies = [
    \App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent\DigitalCardModel::class => \App\Policies\DigitalCardPolicy::class,
];
```

**Why:** Route model binding and `can:` middleware work naturally with Eloquent models. It also avoids your current anti‑pattern of “DTO → fake entity conversion”.

## 1.2 Spatie current tenant access inside policy

In Spatie, tenant is available in the container key `currentTenant` after tenant resolution, and you can manually set it via `makeCurrent`/`forgetCurrent`.   
So in policies, replace: [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources)

```php
tenancy()->getCurrentTenant()
```

with:

```php
$tenant = app('currentTenant'); // may be null
```

(Spatie docs explicitly mention `app('currentTenant')` and manual switching via `makeCurrent`.) [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes)

## 1.3 Tenant ownership check: careful with DB‑per‑tenant

If you use **DB‑per‑tenant**, the “tenant\_id column on the card row” is usually unnecessary because isolation is enforced by the tenant connection pointing at the tenant DB. The **tenant boundary should be enforced by scoping + middleware**, not by checking `$card->tenant_id` (which may not exist). [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)

**Recommended policy rule set:**

*   Platform Admin: allowed across tenants (but must explicitly switch tenant context)
*   Committee Admin: allowed within current tenant
*   Member: allowed only for “their” member\_id (if your user model stores member\_id)

> Important: **authorization is not a substitute for tenant isolation**. Tenant isolation must happen at data layer (tenant connection) + route/middleware (`NeedsTenant`). [\[laraveldoctrine.org\]](https://www.laraveldoctrine.org/docs/current/migrations/builder), [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)

## 1.4 Policy: don’t mix business invariants with authorization

Your draft checks `status === issued` inside `activate()` permission. That’s OK for UX and to block obvious invalid actions, but the **domain must remain the ultimate authority** on transitions. Keep that check *optional*, and never rely on it alone.

***

# 2) Routes / Middleware Integration (Correct for Spatie tenancy)

You used middleware `'tenant'`—good. Ensure that group includes Spatie’s `NeedsTenant` so tenant must be resolved for these routes. [\[laraveldoctrine.org\]](https://www.laraveldoctrine.org/docs/current/migrations/builder), [\[laravel.com\]](https://laravel.com/docs/12.x/http-tests)

Example (conceptual):

```php
Route::middleware(['web', 'auth', 'tenant'])
  ->prefix('{tenant}/admin/digital-cards')
  ->name('tenant.digital-cards.')
  ->group(function () {
      Route::get('/', ...)->middleware('can:viewAny,' . DigitalCardModel::class);
      Route::post('/', ...)->middleware('can:create,' . DigitalCardModel::class);

      Route::get('/{card}', ...)->middleware('can:view,card');
      Route::put('/{card}/activate', ...)->middleware('can:activate,card');
      Route::put('/{card}/revoke', ...)->middleware('can:revoke,card');
  });
```

**Key requirement:** `{card}` must bind to the **Eloquent model** (DigitalCardModel), not the domain entity.

***

# 3) Step 2 — WebSockets / Broadcasting (Correct Laravel 12 approach)

## 3.1 Use Laravel’s broadcasting scaffolding

Laravel 12 recommends enabling broadcasting with `install:broadcasting`, which creates `config/broadcasting.php` and `routes/channels.php`. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

## 3.2 Use `BROADCAST_CONNECTION` (Laravel 12)

For Pusher or Reverb, Laravel 12 specifies:

```env
BROADCAST_CONNECTION=pusher
```

(not `BROADCAST_DRIVER`). [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

## 3.3 Echo config: use Vite environment variables

Vite exposes only env vars prefixed with `VITE_` to client-side code.   
Laravel 12 broadcasting docs show `VITE_PUSHER_*` variables for Echo configuration. [\[vite.dev\]](https://vite.dev/guide/env-and-mode) [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

So drop the old `MIX_*` variables and follow the documented `VITE_PUSHER_*` pattern. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting), [\[vite.dev\]](https://vite.dev/guide/env-and-mode)

## 3.4 Channel authorization should live in `routes/channels.php`

Laravel’s recommended mechanism: `Broadcast::channel('name', fn(User $user, $param) => bool)` in `routes/channels.php`. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

So instead of custom `/api/v1/broadcasting/auth` and custom controller logic, do:

*   Keep default `/broadcasting/auth` route (installed by broadcasting scaffolding)
*   Add authorization callback:

```php
// routes/channels.php
Broadcast::channel('tenant.{tenantId}.digital-cards', function (User $user, string $tenantId) {
    // Allow platform admin OR user belongs to tenant
    return $user->isPlatformAdmin() || (string) $user->tenant_id === (string) $tenantId;
});
```

This matches Laravel’s documented channel authorization flow. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

## 3.5 Broadcast events should be queued + after DB commit

Laravel 12 docs explicitly note broadcasting is done via queued jobs and you should run a queue worker.   
Also, broadcasting before the DB transaction commits can lead to clients seeing phantom updates. Prefer broadcasting **after commit**. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

**Architectural recommendation:** **Bridge domain events → broadcast events** using listeners.

***

# 4) Best Practice: Domain Event → Broadcast Event (Clean Architecture)

You already have domain events:

*   `CardIssued`, `CardActivated`, `CardRevoked`

Don’t dispatch WebSocket events inside handlers. Instead:

1.  Repository saves aggregate
2.  Aggregate releases domain events
3.  Domain events are dispatched
4.  A listener translates them into `ShouldBroadcast` events on tenant channel

This keeps:

*   Domain pure
*   Application use-cases focused
*   Infra concerns in infra

Laravel broadcasting events are designed for this pattern. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

***

# 5) Testing Strategy: What to test vs avoid

## ✅ Test

*   That the **broadcast event classes are dispatched** with correct channel + payload shape (fake events).
*   That payload does **not** include sensitive fields.
*   That tenant channel name is correct.

## ⚠️ Avoid

*   End-to-end websocket performance or timing assertions in PHPUnit (flaky in CI).
*   UI tests that depend on actual Pusher/Reverb being up.

Keep tests at “unit-ish” / “feature-ish” level with `Event::fake()`.

***

# 6) Specific issues in your draft (must fix)

### 6.1 Policy uses Domain `DigitalCard` and assumes `$card->tenant_id`

This won’t work if:

*   your cards are domain aggregates without tenant\_id
*   your tenant strategy is DB-per-tenant (tenant\_id not stored) [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)

✅ Fix: Policy should authorize against the **Eloquent card model**.

### 6.2 You are still using `tenancy()->initialize(...)` in tests

That is not Spatie. Use:

*   tenant finder by request, or
*   `$tenant->makeCurrent()` / `Tenant::forgetCurrent()` [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources)

### 6.3 Broadcasting auth endpoint

Laravel’s standard channel auth workflow is via `routes/channels.php` callbacks.   
Custom auth endpoints increase risk and maintenance. [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

***

# 7) My Recommended Implementation Sequence (Phase‑1 finish line)

### Step A — Policies (clean & enforceable)

1.  Create `DigitalCardPolicy` for **DigitalCardModel**
2.  Register policy mapping in `AuthServiceProvider`
3.  Apply `can:` middleware on web routes and API routes
4.  Update Inertia props (`permissions`) based on `$request->user()->can(...)`

### Step B — Broadcasting baseline

1.  `php artisan install:broadcasting` (or ensure scaffolding exists) [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)
2.  Configure `.env` with `BROADCAST_CONNECTION=pusher` (Laravel 12) [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)
3.  Configure Echo using `VITE_*` env vars (required by Vite) [\[vite.dev\]](https://vite.dev/guide/env-and-mode), [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)
4.  Define channel authorization in `routes/channels.php` [\[laravel.com\]](https://laravel.com/docs/12.x/broadcasting)

### Step C — Bridge domain → broadcast

1.  Create listeners for `CardIssued/Activated/Revoked`
2.  Broadcast minimal payload on `PrivateChannel("tenant.{$tenantId}.digital-cards")`
3.  Ensure broadcast happens after commit (queue + afterCommit)

***

# 8) What should we implement next?

Your own recommendation—**Bulk operations**—is correct *after* policies and broadcasting are stable.

✅ Bulk revoke/activate/issue needs:

*   Policies for bulk abilities
*   Background jobs (queue) for long-running bulk work
*   Real-time progress events (your Echo setup becomes very useful here)

***

# 9) Two Clarifications (so I give you the exact final code blueprint)

1.  **Tenancy strategy:** Are you DB‑per‑tenant (Spatie switching tenant connection DB) or single DB with tenant\_id column? This changes both policies and channel naming assumptions. [\[laravel.com\]](https://laravel.com/docs/12.x/validation), [\[laravelexample.com\]](https://www.laravelexample.com/2025/03/laravel-12-form-request-validation.html)
2.  **Tenant identifier in URLs/channels:** do you want channel names keyed by tenant **UUID** or **slug**?

Once you answer, I will provide:

*   A **corrected `DigitalCardPolicy`** against your actual Eloquent model and tenant strategy
*   The **routes/channels.php** callbacks for tenant-scoped channels
*   Listener-based **DomainEvent → BroadcastEvent bridge**
*   Updated tests using Spatie’s tenant context (`currentTenant` / `makeCurrent`) [\[stackoverflow.com\]](https://stackoverflow.com/questions/37844566/laravel-schema-builder-partial-indexes), [\[laravel.com\]](https://laravel.com/docs/12.x/eloquent-resources)

You’re absolutely right. In **DDD**, a bounded context like **DigitalCardContext** must be **independent of framework- or package-specific choices** (e.g., Spatie’s tenancy, Sanctum internals, Eloquent details). Those are **infrastructure** concerns and should be hidden behind **ports** (interfaces) with **adapters** per package. Let’s refactor the scaffolding to **remove any implicit coupling** and make the context fully portable.

Below is a **clean DDD refactor** with **ports/adapters** and **in-memory test doubles**, preserving your 6-case routing and multi-tenant guarantees while keeping **DigitalCardContext** pure.

***

## 1) Core Principle: Ports & Adapters (Hexagonal boundary)

**DigitalCardContext** exposes **Domain** + **Application**. Any package details (Spatie, tenancy middleware, Eloquent, Sanctum, etc.) live **outside** via adapters.

We’ll introduce these **ports** in `Shared` (or inside `DigitalCardContext/Infrastructure/Ports` if you prefer context-local):

*   `TenantContext` (read-only current tenant slug, tenant ID)
*   `TenantConnectionSwitcher` (switches DB connections per tenant)
*   `Clock` (time source)
*   `QrCodeGenerator` (QR generation)
*   `CardRepository` (already present, but make it **package-agnostic**)
*   `EventBus` (publish domain events)

> The **Application Handlers** depend only on these **interfaces**, not on any package types.

***

## 2) New Ports (Interfaces)

### 2.1 Tenant Ports

```php
<?php
// app/Contexts/Shared/Contracts/Tenancy/TenantContext.php
declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\Tenancy;

interface TenantContext
{
    /** Absolute rule: path-based slug is authoritative in your system charter */
    public function slug(): string;
    /** Optional: internal tenant id; not required for DigitalCardContext domain */
    public function id(): ?string;
}
```

```php
<?php
// app/Contexts/Shared/Contracts/Tenancy/TenantConnectionSwitcher.php
declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\Tenancy;

interface TenantConnectionSwitcher
{
    /** Switch to tenant DB for the current request/operation */
    public function toTenant(TenantContext $tenant): void;

    /** Switch to landlord DB (if needed for audit/logging) */
    public function toLandlord(): void;
}
```

> **Important:** **DigitalCardContext** never calls a specific package. It only asks the switcher to ensure the right DB is active. Your existing middleware can fulfill these ports via an adapter that uses Spatie (or any other solution) behind the scenes.

### 2.2 Supporting Ports

```php
<?php
// app/Contexts/Shared/Contracts/System/Clock.php
declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\System;

interface Clock
{
    public function now(): \DateTimeImmutable;
}
```

```php
<?php
// app/Contexts/Shared/Contracts/Media/QrCodeGenerator.php
declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\Media;

interface QrCodeGenerator
{
    public function make(string $payload): string;
}
```

```php
<?php
// app/Contexts/Shared/Contracts/Events/EventBus.php
declare(strict_types=1);

namespace App\Contexts\Shared\Contracts\Events;

interface EventBus
{
    public function publish(object $domainEvent): void;
}
```

***

## 3) DigitalCardContext depends on ports, not packages

### 3.1 Update Application Handlers to use ports

```php
<?php
// app/Contexts/DigitalCard/Application/Handlers/IssueCardHandler.php
declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use App\Contexts\DigitalCard\Application\DTOs\CardDTO;
use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;
use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;
use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;
use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;
use App\Contexts\Shared\Contracts\System\Clock;
use App\Contexts\Shared\Contracts\Media\QrCodeGenerator;
use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use App\Contexts\Shared\Contracts\Tenancy\TenantConnectionSwitcher;

final class IssueCardHandler
{
    public function __construct(
        private readonly DigitalCardRepository $repo,
        private readonly Clock $clock,
        private readonly QrCodeGenerator $qr,
        private readonly TenantContext $tenant,               // read-only
        private readonly TenantConnectionSwitcher $switcher,  // boundary
    ) {}

    public function handle(IssueCardCommand $cmd): CardDTO
    {
        // ALWAYS ensure tenant DB before persistence
        $this->switcher->toTenant($this->tenant);

        $now = $this->clock->now();
        $expires = $cmd->expiresAtIso8601
            ? new \DateTimeImmutable($cmd->expiresAtIso8601)
            : $now->modify('+1 year');

        $cardId = CardId::new();
        $qrStr  = $this->qr->make("card:{$cardId->toString()}");

        $aggregate = DigitalCard::issue(
            $cardId,
            MemberId::fromString($cmd->memberId),
            QRCode::fromString($qrStr),
            $now,
            $expires
        );

        // Business rule (recommendation): one Active/Issued per Member
        // Enforce via repository transaction/service policy as needed.

        $this->repo->save($aggregate);

        return new CardDTO(
            $aggregate->id()->toString(),
            $aggregate->memberId()->toString(),
            $aggregate->status()->value,
            $aggregate->issuedAt()->format(\DateTimeInterface::ATOM),
            $aggregate->expiresAt()->format(\DateTimeInterface::ATOM),
            $aggregate->qrCode()->toString(),
        );
    }
}
```

> **No mention of Spatie**. The handler relies on **ports** only.

Apply the same pattern for `ActivateCardHandler` and `RevokeCardHandler`:

```php
// constructor args include DigitalCardRepository, Clock, TenantContext, TenantConnectionSwitcher
// first line in handle(): $this->switcher->toTenant($this->tenant);
```

***

## 4) Infrastructure Adapters (outside the context)

You can implement **adapters** that bind these ports to your chosen packages **without touching DigitalCardContext**.

### 4.1 Example: Tenancy adapter (package-agnostic)

```php
<?php
// app/Infrastructure/Tenancy/Adapters/RequestPathTenantContext.php
declare(strict_types=1);

namespace App\Infrastructure\Tenancy\Adapters;

use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use Illuminate\Http\Request;

final class RequestPathTenantContext implements TenantContext
{
    public function __construct(private Request $request) {}

    public function slug(): string
    {
        // Your rule: path-based slug has highest priority
        // Example assumes routes like /{tenant}/api/v1/...
        return (string) $this->request->route('tenant');
    }

    public function id(): ?string
    {
        // Optional: resolve to internal id if you maintain a landlord mapping
        return null;
    }
}
```

```php
<?php
// app/Infrastructure/Tenancy/Adapters/ConnectionSwitcherAdapter.php
declare(strict_types=1);

namespace App\Infrastructure\Tenancy\Adapters;

use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use App\Contexts\Shared\Contracts\Tenancy\TenantConnectionSwitcher;

final class ConnectionSwitcherAdapter implements TenantConnectionSwitcher
{
    public function toTenant(TenantContext $tenant): void
    {
        // Here you call your tenancy package or your custom DB manager
        // Example:
        // Tenancy::setTenantSlug($tenant->slug());
        // DB::setDefaultConnection('tenant'); // or via package API
    }

    public function toLandlord(): void
    {
        // DB::setDefaultConnection('landlord');
    }
}
```

> Swap the internals with Spatie, your custom abstraction, or any other solution. **DigitalCardContext never sees it.**

### 4.2 Clock + QR adapters

```php
<?php
// app/Infrastructure/System/LaravelClockAdapter.php
declare(strict_types=1);

namespace App\Infrastructure\System;

use App\Contexts\Shared\Contracts\System\Clock;

final class LaravelClockAdapter implements Clock
{
    public function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now');
    }
}
```

```php
<?php
// app/Infrastructure/Media/SimpleQrAdapter.php
declare(strict_types=1);

namespace App\Infrastructure\Media;

use App\Contexts\Shared\Contracts\Media\QrCodeGenerator;

final class SimpleQrAdapter implements QrCodeGenerator
{
    public function make(string $payload): string
    {
        // Replace with real QR generator. Return string payload or data URL.
        return 'qr:' . $payload;
    }
}
```

### 4.3 Event Bus adapter

```php
<?php
// app/Infrastructure/Events/LaravelEventBusAdapter.php
declare(strict_types=1);

namespace App\Infrastructure\Events;

use App\Contexts\Shared\Contracts\Events\EventBus;

final class LaravelEventBusAdapter implements EventBus
{
    public function publish(object $domainEvent): void
    {
        event($domainEvent); // or dispatch(new ...)
    }
}
```

***

## 5) Service Provider wiring (bindings only; no package leakage)

Bind **ports** to **adapters** in a provider **outside** the context. Your DigitalCard provider should depend only on **interfaces**.

```php
<?php
// app/Providers/ContextBindingsServiceProvider.php
declare(strict_types=1);

namespace App\Providers;

use App\Contexts\Shared\Contracts\Events\EventBus;
use App\Contexts\Shared\Contracts\Media\QrCodeGenerator;
use App\Contexts\Shared\Contracts\System\Clock;
use App\Contexts\Shared\Contracts\Tenancy\TenantConnectionSwitcher;
use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use App\Infrastructure\Events\LaravelEventBusAdapter;
use App\Infrastructure\Media\SimpleQrAdapter;
use App\Infrastructure\System\LaravelClockAdapter;
use App\Infrastructure\Tenancy\Adapters\ConnectionSwitcherAdapter;
use App\Infrastructure\Tenancy\Adapters\RequestPathTenantContext;
use Illuminate\Support\ServiceProvider;
use Illuminate\Http\Request;

final class ContextBindingsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(Clock::class, LaravelClockAdapter::class);
        $this->app->bind(QrCodeGenerator::class, SimpleQrAdapter::class);
        $this->app->bind(EventBus::class, LaravelEventBusAdapter::class);

        // TenantContext from current request path param
        $this->app->bind(TenantContext::class, function ($app) {
            return new RequestPathTenantContext($app->make(Request::class));
        });

        // DB switcher adapter (internals can use Spatie/custom)
        $this->app->bind(TenantConnectionSwitcher::class, ConnectionSwitcherAdapter::class);
    }
}
```

> This provider contains the **only references** to concrete adapters. You can switch packages at any time without touching **DigitalCardContext**.

***

## 6) Repository isolation

Your `DigitalCardRepository` remains a **domain port**. The Eloquent implementation stays in `Infrastructure`, but **doesn’t embed any package types** (only framework-neutral database operations). Tenant switching is done **before** repository calls via the **switcher port**.

If you want **pure domain tests** without DB, implement an **in-memory repository**:

```php
<?php
// tests/Fakes/InMemoryDigitalCardRepository.php
declare(strict_types=1);

namespace Tests\Fakes;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;
use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;
use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

final class InMemoryDigitalCardRepository implements DigitalCardRepository
{
    /** @var array<string, DigitalCard> */
    private array $store = [];

    public function byId(CardId $id): ?DigitalCard
    {
        return $this->store[$id->toString()] ?? null;
    }

    public function byMember(MemberId $memberId): array
    {
        return array_values(array_filter(
            $this->store,
            fn(DigitalCard $c) => $c->memberId()->toString() === $memberId->toString()
        ));
    }

    public function save(DigitalCard $card): void
    {
        $this->store[$card->id()->toString()] = $card;
        foreach ($card->releaseEvents() as $event) {
            // no-op in-memory: tests can assert events separately if needed
        }
    }
}
```

Use this in **unit tests** to get **fast, package-free** coverage.

***

## 7) Controllers & Routes (still DDD-safe)

Controllers live in **Infrastructure** and depend on **handlers** (which depend on **ports**), not on packages. Routes continue to honor your **6‑case model**:

*   **Desktop Admin:** `/{tenant}/api/v1/cards/*`
*   **Mobile Angular:** `/{tenant}/mapi/v1/cards/*`
*   Tenant slug **mandatory** in URL
*   Mobile uses **Sanctum** at the **adapter level** (middleware), not inside handlers

**No handler references Sanctum or Spatie**—only the controllers’ **middleware stacks** handle auth & tenancy resolution externally.

***

## 8) Summary of the refactor

*   ✅ **DigitalCardContext** remains **pure** (Domain + Application).
*   ✅ All package specifics (Spatie tenancy, Sanctum, Eloquent, Laravel events) live in **Infrastructure adapters** bound to **ports**.
*   ✅ **Tests** can use **in-memory repository**, **fake clock/QR**, and **dummy tenant context** for fast TDD.
*   ✅ You can swap the tenancy engine tomorrow without changing **DigitalCardContext**.

***

## 9) Next steps (pick any)

1.  **Generate the in-memory test suite** (unit + feature) wired to ports, no DB.
2.  **Add read/validate endpoint** with a `CardValidationService` port and an adapter that checks QR signature **without leaking package code**.
3.  **Produce Mermaid diagrams** (class + sequence) showing **ports/adapters** around DigitalCardContext.
4.  **Add policies** as adapters (e.g., `AuthorizationService` port) to keep authorization out of domain/application.

Would you like me to **produce the in-memory test suite** (unit + feature, no DB) next, or draft the **Mermaid hexagonal diagram** for this context showing port/adapters and flows?

