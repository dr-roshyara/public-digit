now business case. develop for business  
I want to offer the whole Digitalcard in two phases 
phase 1-01  for a level of price   level 1 price 
phase 1-02 for next level of price   level 2 price. 
For this I want to develop two dynamically instalable modules in implement digital card functionalities in landard database which acts as service provider. 
if the tenant says I pay only level 1 price then he gets this functionality and if the tenant pays level 2 price the he gets all functionalities. 
how can i do this ?
#
To implement a tiered pricing model with dynamically "installable" modules in a multi-tenant (Landlord/Tenant) architecture, you need to transition from a "standard" feature set to a **Feature-Flagged Subscription System**.

In this model, the **Landlord database** acts as the "source of truth" for what each tenant is allowed to do, while the **Tenant application** checks these permissions before executing code.

### 1. Proposed Business Tier Split

Based on your Phase 1 implementation files, here is a logical split for your price levels:

* **Level 1 (Core Lifecycle):** Implementation 01–04.
* Individual Card Issuance, Activation, and Revocation.
* Basic Management UI and Search.


* **Level 2 (Advanced/Bulk):** Implementation 05–07.
* **Bulk Operations** (Queue-based 1,000+ card processing).
* **Advanced Exports** (CSV, Excel, PDF).
* **Real-time synchronization** (WebSockets/Echo).



---

### 2. Architectural Blueprint

The Landlord database must manage a "Feature Registry." When a tenant logs in, the system determines their "Feature Profile."

---

### 3. Step-by-Step Technical Implementation

#### Step 1: Landlord Database Schema

In your Landlord database, add a `features` table and a many-to-many relationship with `tenants`.

```php
// Landlord Migration: create_tenant_features_table.php
Schema::create('features', function (Blueprint $table) {
    $table->id();
    $table->string('slug')->unique(); // 'cards.bulk', 'cards.export'
    $table->string('name');
    $table->integer('price_level'); // 1 or 2
    $table->timestamps();
});

Schema::create('feature_tenant', function (Blueprint $table) {
    $table->foreignId('tenant_id')->constrained();
    $table->foreignId('feature_id')->constrained();
    $table->timestamp('expires_at')->nullable();
});

```

#### Step 2: The Feature Manager Service

Create a service in your `App\Services` namespace that sits between the Landlord and the DigitalCard context.

```php
namespace App\Services;

class FeatureManager 
{
    public function tenantHasFeature(Tenant $tenant, string $featureSlug): bool 
    {
        // Cache this for performance
        return cache()->remember("tenant_{$tenant->id}_feature_{$featureSlug}", 3600, function() use ($tenant, $featureSlug) {
            return $tenant->features()->where('slug', $featureSlug)->exists();
        });
    }
}

```

#### Step 3: Protecting Backend Routes & Logic

Use Laravel **Middleware** to protect the Level 2 modules (Bulk and Export).

```php
// app/Http/Middleware/EnsureFeatureAccess.php
public function handle($request, Closure $next, $feature)
{
    $tenant = tenancy()->getCurrentTenant();
    
    if (!app(FeatureManager::class)->tenantHasFeature($tenant, $feature)) {
        return response()->json(['error' => 'Upgrade to Level 2 to access this feature.'], 403);
    }

    return $next($request);
}

// In your Routes file:
Route::middleware(['auth', 'tenant', 'feature:cards.bulk'])
    ->post('/{tenant}/api/v1/cards/bulk', [BulkCardController::class, 'store']);

```

#### Step 4: Dynamically Hiding UI Components

In your Vue.js frontend (Implementation 04), pass the "Feature Set" as an Inertia prop.

```vue
<template>
  <div>
    <div v-if="features.includes('cards.bulk')" class="bulk-actions">
       <button @click="openBulkModal">Bulk Issue</button>
    </div>
    
    <button v-if="features.includes('cards.export')" @click="triggerExport">
       Export CSV
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  features: Array // Passed via Inertia Share from HandleInertiaRequests middleware
});
</script>

```

---

### 4. Critical Analysis of this "Module" Approach

**Pros:**

* **Single Codebase:** You don't have to maintain two different versions of the app. You simply "unlock" code that is already there.
* **Upsell Path:** You can show "locked" buttons to Level 1 users. When they click, you show a "Upgrade to Level 2" marketing modal.
* **Scalability:** If you add a "Level 3" (e.g., AI Analytics), you just add a new slug to the Landlord DB.

**Improvement Suggestions for the Business Case:**

1. **Trial Period Logic:** Add a `trial_ends_at` column in the Landlord `feature_tenant` table. This allows you to give Level 1 tenants a 14-day "taste" of Level 2 features automatically.
2. **The "Graceful Degradation" UI:** Instead of just hiding Level 2 buttons, keep them visible but **grayscale** with a "Pro" badge. This increases conversion rates by reminding users of what they are missing.
3. **Modular Service Provider:** To make it truly "dynamically installable" at the code level, you can use **Laravel Packages**. Level 2 would be a separate composer package that the Landlord's `composer.json` includes. However, for a SaaS, the **Feature Flag** approach (Step 3) is usually more maintainable.

### **Next Steps Recommendation**

Before implementing Phase 1-02 (Bulk/Export), first build the **Feature Flagging Infrastructure** in the Landlord context. This ensures that every line of Level 2 code you write is born behind a "paywall."

**Would you like me to generate the Migration and the "Feature Check" Middleware to start this infrastructure?**
##
Since your **Landlord database** and **Tenant databases** are isolated, the Landlord acts as the **Control Plane** (the brain) and the Tenant databases act as the **Data Plane** (the muscle).

To implement this business case, you need a **Cross-Database Feature Gate**. Even though the Tenant database is isolated, your Laravel application has access to both connections. You will use the Landlord database to store the "Plan" or "Enabled Modules" for each tenant.

### 1. The Business Tier Mapping

Based on the implementation plans we analyzed (01–07), here is the logical split for your modules:

| Module Name | Tier | Plan Files | Core Functionality |
| --- | --- | --- | --- |
| **Basic Card Lifecycle** | Level 1 | 01, 02, 03, 04 | Manual Issue, Activate, Revoke, Basic List |
| **Advanced Management** | Level 2 | 05, 06, 07 | Bulk Operations, Exports, Real-time WebSockets |

---

### 2. Implementation Strategy

#### Step 1: Landlord Schema (The Service Provider)

In your Landlord database, you need to track which modules are "installed" for which tenant.

```php
// Landlord Migration
Schema::create('tenant_modules', function (Blueprint $table) {
    $table->id();
    $table->uuid('tenant_id'); // Matches the Tenant ID in Landlord DB
    $table->string('module_key'); // 'digital_card.basic' or 'digital_card.advanced'
    $table->integer('price_level'); // 1 or 2
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});

```

#### Step 2: The "Module Gate" Middleware

You need a middleware that intercepts requests to your Digital Card API. Before allowing the code to reach the Tenant database, it must query the Landlord database to verify the subscription level.

```php
namespace App\Http\Middleware;

class EnsureModuleIsInstalled
{
    public function handle($request, $next, $requiredLevel)
    {
        $tenantId = tenancy()->getCurrentTenant()->id;

        // Force connection to LANDLORD to check subscription
        $maxPriceLevel = DB::connection('landlord')
            ->table('tenant_modules')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->max('price_level');

        if (!$maxPriceLevel || $maxPriceLevel < $requiredLevel) {
            return response()->json([
                'error' => 'Module not installed',
                'required_level' => "Price Level $requiredLevel",
                'message' => 'Please upgrade your plan in the main dashboard.'
            ], 402); // 402 Payment Required
        }

        return $next($request);
    }
}

```

#### Step 3: Routing the Modules

Apply the middleware to your routes to create the "Dynamic" installation feel.

```php
// Level 1 Routes (Phase 1: 01-04)
Route::middleware(['tenant', 'module:1'])->group(function () {
    Route::post('/cards', [DigitalCardController::class, 'store']);
    Route::put('/cards/{id}/activate', [DigitalCardController::class, 'activate']);
});

// Level 2 Routes (Phase 1: 05-07)
Route::middleware(['tenant', 'module:2'])->group(function () {
    Route::post('/cards/bulk', [BulkCardController::class, 'process']);
    Route::get('/cards/export', [ExportController::class, 'download']);
});

```

---

### 3. Critical Improvements for the Business Case

#### A. The "Cached Feature" Pattern

Querying the Landlord database on every API call (Step 2) adds latency.
**Improvement:** When a tenant's plan is updated in the Landlord DB, fire a webhook or job that saves their `active_modules` into a JSON column inside the **Tenant's own database** or a Redis cache. This allows the Tenant DB to be "self-aware" of its limits without talking back to the Landlord on every request.

#### B. Dynamic UI Modules (Vue 3)

In your Phase 1-04 implementation (Inertia/Vue), you shouldn't just hide buttons; you should treat them as "Locked Modules."

```vue
<template>
  <div class="flex gap-2">
    <button @click="activate">Activate</button>

    <template v-if="!hasLevel2">
      <div class="relative group">
        <button class="bg-gray-300 cursor-not-allowed">Bulk Action (PRO)</button>
        <div class="hidden group-hover:block absolute bottom-full p-2 bg-black text-white text-xs">
          This feature requires Price Level 2. Click to upgrade.
        </div>
      </div>
    </template>
    <button v-else @click="bulkAction">Bulk Action</button>
  </div>
</template>

```

#### C. Service Provider Registration

To make modules "dynamically installable" at the code level, use **Conditional Service Providers**. You can check the tenant's plan in the `register()` method of your `DigitalCardServiceProvider`:

```php
public function boot()
{
    // Only register Bulk & Export listeners if the tenant has Level 2
    if ($this->app->make(SubscriptionService::class)->hasLevel(2)) {
        Event::listen(BulkOperationStarted::class, [NotifyAdmin::class, 'handle']);
    }
}

```

### Summary of Analysis

By using the **Landlord database as the source of truth for modules**, you keep your architecture clean. Level 1 code (01-04) and Level 2 code (05-07) coexist in the same project, but the "Module Gate" ensures that a Level 1 tenant cannot execute Level 2 logic, even if they know the API endpoint.

**Next Recommendation:**
Start by adding the `tenant_modules` table to the **Landlord context** first. This will allow you to build Phase 1-05 (WebSockets) and Phase 1-06 (Bulk) with the "Lock" already in place.

**Would you like me to generate the implementation for the `SubscriptionService` that handles this cross-database check efficiently?**
##
To implement this efficiently while respecting the **isolation** of your databases, we will use a **"Check & Sync"** pattern.

In this pattern, the Landlord database remains the authoritative source of truth (Control Plane), but we cache the "Active Modules" locally within the Tenant context or a shared cache to ensure that a Level 1 tenant cannot call Level 2 code without hitting the Landlord database for every single request.

### 1. Landlord Setup: Module Registry

In your **Landlord database**, create a table to track which price levels/modules are assigned to which tenant.

```php
// Landlord Migration: create_tenant_modules_table.php
Schema::create('tenant_modules', function (Blueprint $table) {
    $table->id();
    $table->uuid('tenant_id')->index(); 
    $table->string('module_key'); // e.g., 'digital_card'
    $table->integer('price_level'); // 1 = Basic, 2 = Advanced
    $table->boolean('is_enabled')->default(true);
    $table->timestamps();
});

```

### 2. The SubscriptionService (Cross-DB Logic)

This service lives in your application layer. It is responsible for switching connections to the Landlord database to verify permissions.

```php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class SubscriptionService
{
    /**
     * Check if the current tenant has access to a specific price level.
     */
    public function hasLevel(int $requiredLevel): bool
    {
        $tenantId = tenancy()->getCurrentTenant()->id;

        // Use Cache to avoid hitting Landlord DB on every single request
        return Cache::tags(['subscriptions', "tenant_{$tenantId}"])
            ->remember("price_level_check_{$requiredLevel}", 3600, function () use ($tenantId, $requiredLevel) {
                
                // Switch to landlord connection
                $subscription = DB::connection('landlord')
                    ->table('tenant_modules')
                    ->where('tenant_id', $tenantId)
                    ->where('module_key', 'digital_card')
                    ->where('is_enabled', true)
                    ->first();

                if (!$subscription) return false;

                return $subscription->price_level >= $requiredLevel;
            });
    }

    /**
     * Call this when an admin updates a plan in the Landlord panel.
     */
    public function clearTenantCache(string $tenantId): void
    {
        Cache::tags(['subscriptions', "tenant_{$tenantId}"])->flush();
    }
}

```

### 3. The "Dynamic Installation" Middleware

This middleware acts as the "Gate" for your two phases.

```php
namespace App\Http\Middleware;

use App\Services\SubscriptionService;
use Closure;
use Illuminate\Http\Request;

class EnsurePriceLevel
{
    public function __construct(protected SubscriptionService $subscription) {}

    public function handle(Request $request, Closure $next, int $level)
    {
        if (!$this->subscription->hasLevel($level)) {
            return response()->json([
                'error' => 'Upgrade Required',
                'message' => "This feature requires Price Level $level. Please contact your service provider.",
                'current_tenant' => tenancy()->getCurrentTenant()->id
            ], 402); // 402 Payment Required
        }

        return $next($request);
    }
}

```

### 4. Routing the Phases (Module Implementation)

Now you can wrap your implemented code (from files 01–07) in these gates.

```php
// routes/tenant.php

// LEVEL 1: Basic Card Lifecycle (Implementation 01-04)
Route::middleware(['auth', 'tenant', 'price.level:1'])->group(function () {
    Route::post('/cards', [DigitalCardController::class, 'store']);
    Route::put('/cards/{id}/activate', [DigitalCardController::class, 'activate']);
    Route::get('/cards', [DigitalCardController::class, 'index']); // Basic List
});

// LEVEL 2: Advanced Modules (Implementation 05-07)
Route::middleware(['auth', 'tenant', 'price.level:2'])->group(function () {
    Route::post('/cards/bulk', [BulkCardController::class, 'process']);
    Route::get('/cards/export', [ExportController::class, 'download']);
    Route::get('/cards/stats', [DigitalCardController::class, 'advancedStats']);
});

```

### 5. UI Implementation (Vue 3)

To make the modules "dynamically installable" in the UI, you pass the `price_level` as a prop via your `HandleInertiaRequests` middleware.

```vue
<template>
  <div>
    <CardTable :cards="cards" />

    <div v-if="priceLevel >= 2" class="p-4 bg-blue-50 border border-blue-200 rounded">
      <h3>Advanced Tools</h3>
      <button @click="openBulkModal">Bulk Issue</button>
      <button @click="exportCSV">Export All Data</button>
    </div>

    <div v-else class="p-4 bg-gray-100 grayscale opacity-75 relative">
       <button disabled>Bulk Issue (Pro Only)</button>
       <span class="absolute top-2 right-2 badge-gold">Upgrade to Level 2</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
    priceLevel: Number, // Injected via Inertia
    cards: Object
});
</script>

```

### Critical Analysis of this Business Model

1. **Strict Isolation**: By using a **Cache Tag** based on the Tenant ID, you ensure that even though the Landlord DB is the provider, the Tenant app doesn't slow down.
2. **Graceful Failover**: If the Landlord database is briefly offline, the cached subscription status in the Tenant's Redis/File cache keeps the app running.
3. **Atomic Upgrades**: When a tenant pays for Level 2, you simply update the `tenant_modules` table in the Landlord DB and fire `SubscriptionService::clearTenantCache($tenantId)`. The next time the user refreshes their dashboard, the "Level 2" features appear instantly.

**Do you want me to help you create the Landlord Admin Controller that handles the activation/deactivation of these modules?**
##
To create the **Landlord Admin Controller**, we need to ensure it operates strictly on the `landlord` database connection and includes a "Cache Busting" mechanism. This ensures that as soon as you upgrade a tenant's price level in the central portal, their isolated application immediately recognizes the new features.

### 1. Landlord Admin Controller Implementation

This controller would typically reside in your **Landlord Context** (the service provider side of the app).

```php
namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Controller;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TenantModuleController extends Controller
{
    public function __construct(
        protected SubscriptionService $subscriptionService
    ) {
        // Ensure only platform-level super admins can access this
        $this->middleware('auth:platform_admin');
    }

    /**
     * Assign or Upgrade a Module for a Tenant
     */
    public function update(Request $request, string $tenantId)
    {
        $validated = $request->validate([
            'module_key' => 'required|string', // e.g., 'digital_card'
            'price_level' => 'required|integer|min:1|max:2',
            'is_enabled' => 'boolean'
        ]);

        // Perform the update on the Landlord connection
        DB::connection('landlord')->table('tenant_modules')->updateOrInsert(
            ['tenant_id' => $tenantId, 'module_key' => $validated['module_key']],
            [
                'price_level' => $validated['price_level'],
                'is_enabled' => $validated['is_enabled'] ?? true,
                'updated_at' => now(),
            ]
        );

        // CRITICAL: Bust the cache for this tenant so the change is instant
        $this->subscriptionService->clearTenantCache($tenantId);

        return response()->json([
            'message' => "Tenant {$tenantId} upgraded to Level {$validated['price_level']}",
            'status' => 'success'
        ]);
    }

    /**
     * Disable a module (e.g., for non-payment)
     */
    public function disable(string $tenantId, string $moduleKey)
    {
        DB::connection('landlord')
            ->table('tenant_modules')
            ->where('tenant_id', $tenantId)
            ->where('module_key', $moduleKey)
            ->update(['is_enabled' => false]);

        $this->subscriptionService->clearTenantCache($tenantId);

        return response()->json(['message' => 'Module deactivated.']);
    }
}

```

### 2. Integration with your Phase 1 Modules

With this controller and the previously built `SubscriptionService`, your two-phase business model is now fully operational:

1. **The Purchase Flow**: A tenant pays for "Advanced Digital Cards" (Level 2) in your main service provider portal.
2. **The Activation**: Your portal calls `TenantModuleController@update` with `price_level => 2`.
3. **The Cache Sync**: The `SubscriptionService` clears the Redis/File cache for that specific tenant.
4. **Instant Access**: The next time the tenant's admin visits their dashboard:
* The **Middleware** allows access to `/cards/bulk` and `/cards/export`.
* The **Vue.js Frontend** (receiving the new `priceLevel` prop) removes the "Pro Only" badges and unlocks the bulk action buttons.



### 3. Improvement Suggestion: Feature Metadata

To make this even more "dynamic," you can add a `metadata` JSON column to your `tenant_modules` table. This allows you to toggle specific sub-features within a price level.

**Example Use Case**:

* **Level 2 Price**: Includes Bulk operations.
* **Level 2 + Add-on**: You can add `{"custom_branding": true}` to the metadata without creating a "Level 3."

### **Summary of the Final Architecture**

| Layer | Responsibility |
| --- | --- |
| **Landlord DB** | Stores the "Truth" of what a tenant bought. |
| **Landlord Controller** | Modifies the truth and triggers cache clearing. |
| **Subscription Service** | Reads the truth efficiently (with caching) across DB boundaries. |
| **Middleware** | Blocks Level 2 API routes for Level 1 tenants. |
| **Vue 3 UI** | Hides/Shows buttons based on the price level injected by Inertia. |

**This structure perfectly handles your requirement of offering Phase 1 in two different price tiers while keeping your databases isolated.**

Would you like to review the **Migration for the metadata column** or a **Vue.js "Upgrade Required" modal** implementation to help with the upselling flow?
##
To support granular feature toggling (like "Custom Branding" or "API Access") within a specific price level, we will add a JSON `metadata` column to the `tenant_modules` table in the **Landlord database**.

This allows you to sell "add-ons" without needing to create a "Level 3" or "Level 4" for every small variation.

### 1. The Migration (Landlord Database)

Since your Landlord database is isolated, this migration should be run specifically on the landlord connection.

```php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations on the 'landlord' connection.
     */
    public function up(): void
    {
        Schema::connection('landlord')->table('tenant_modules', function (Blueprint $table) {
            // Using jsonb for PostgreSQL performance, or json for MySQL
            $table->json('metadata')->nullable()->after('price_level');
        });
    }

    public function down(): void
    {
        Schema::connection('landlord')->table('tenant_modules', function (Blueprint $table) {
            $table->dropColumn('metadata');
        });
    }
};

```

### 2. Updating the SubscriptionService

We need a way to check for specific "flags" inside that metadata JSON efficiently.

```php
namespace App\Services;

class SubscriptionService
{
    // ... existing hasLevel() code ...

    /**
     * Check if a specific sub-feature flag is enabled in the metadata.
     */
    public function hasFeatureFlag(string $flag): bool
    {
        $tenantId = tenancy()->getCurrentTenant()->id;

        $metadata = Cache::tags(['subscriptions', "tenant_{$tenantId}"])
            ->remember("metadata_flags", 3600, function () use ($tenantId) {
                $row = DB::connection('landlord')
                    ->table('tenant_modules')
                    ->where('tenant_id', $tenantId)
                    ->where('module_key', 'digital_card')
                    ->first();

                return json_decode($row->metadata ?? '{}', true);
            });

        return (bool) ($metadata[$flag] ?? false);
    }
}

```

### 3. Updating the Landlord Admin Controller

Now, your service provider portal can enable specific sub-features when a tenant pays for an add-on.

```php
// Inside Landlord/TenantModuleController.php

public function updateMetadata(Request $request, string $tenantId)
{
    $validated = $request->validate([
        'features' => 'required|array', // e.g., ['custom_branding' => true, 'api_access' => false]
    ]);

    DB::connection('landlord')
        ->table('tenant_modules')
        ->where('tenant_id', $tenantId)
        ->where('module_key', 'digital_card')
        ->update([
            'metadata' => json_encode($validated['features']),
            'updated_at' => now(),
        ]);

    // Clear cache so the tenant sees the change immediately
    $this->subscriptionService->clearTenantCache($tenantId);

    return response()->json(['message' => 'Metadata updated successfully.']);
}

```

### 4. Business Use Case Examples

Now you can implement logic like this throughout your application layers:

**In a Blade/Vue Template (Branding):**

```html
<div v-if="hasFeatureFlag('custom_branding')">
    <img :src="tenantLogo" alt="Tenant Brand" />
</div>
<div v-else>
    <img src="/default-platform-logo.png" alt="Platform Logo" />
</div>

```

**In a Controller (API Limits):**

```php
public function apiExport() 
{
    if (!app(SubscriptionService::class)->hasFeatureFlag('api_access')) {
        abort(403, 'Your current plan does not include API access.');
    }
    // ... process export
}

```

### **Critical Analysis of the Metadata Approach**

* **Pros**:
* **Extensibility**: You can add new features (e.g., `max_cards => 5000`) without changing the database schema again.
* **Commercial Flexibility**: You can offer "Level 1" but gift a single "Level 2" feature (like `export_csv => true`) to specific VIP clients.


* **Cons**:
* **Schema Rigidity**: Because it's JSON, you lose some database-level validation. Ensure your Landlord Controller strictly validates the keys being saved.



**What's Next?**
With the **Landlord Controller**, **Subscription Service**, and **Metadata Migration** ready, the business infrastructure for Phase 1 is complete.

Would you like me to create a **"Plan Switcher" UI component** for the Landlord portal to help you manage these settings visually?
#
To implement the business model of "Phase 1 Level 1" and "Phase 1 Level 2" as dynamically installable modules in a multi-tenant environment, we need to create a **Control Plane** (Landlord) that dictates what the **Data Plane** (Tenant) can do.

Here is the implementation for the **Landlord Admin Controller** and the **Subscription Service** that bridges these isolated databases.

### 1. Landlord Database: The Module Registry

In your Landlord database, you need to track which modules and price levels are assigned to which tenant.

```php
// Landlord Migration: create_tenant_modules_table.php
Schema::create('tenant_modules', function (Blueprint $table) {
    $table->id();
    $table->uuid('tenant_id')->index(); 
    $table->string('module_key'); // e.g., 'digital_card'
    $table->integer('price_level'); // 1 = Basic, 2 = Advanced
    $table->json('metadata')->nullable(); // For specific feature flags
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});

```

### 2. The Subscription Service (The Bridge)

This service is the most critical part. It sits in your application and switches the connection context to the Landlord database to verify permissions, while using **Cache Tags** to ensure it doesn't slow down the Tenant's API.

```php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class SubscriptionService
{
    /**
     * Check if the current tenant has access to a specific price level.
     */
    public function hasLevel(int $requiredLevel): bool
    {
        $tenantId = tenancy()->getCurrentTenant()->id;

        // Cache the result to prevent cross-database latency on every request
        return Cache::tags(['subscriptions', "tenant_{$tenantId}"])
            ->remember("price_level_{$requiredLevel}", 3600, function () use ($tenantId, $requiredLevel) {
                
                // Explicitly use the 'landlord' connection
                $sub = DB::connection('landlord')
                    ->table('tenant_modules')
                    ->where('tenant_id', $tenantId)
                    ->where('module_key', 'digital_card')
                    ->where('is_active', true)
                    ->first();

                return ($sub && $sub->price_level >= $requiredLevel);
            });
    }

    /**
     * Clear the cache for a tenant when their plan is upgraded.
     */
    public function clearTenantCache(string $tenantId): void
    {
        Cache::tags(['subscriptions', "tenant_{$tenantId}"])->flush();
    }
}

```

### 3. The Landlord Admin Controller

This controller allows you to "install" or "upgrade" modules for a specific tenant from your main Service Provider portal.

```php
namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Controller;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TenantModuleController extends Controller
{
    public function __construct(protected SubscriptionService $subscription) {}

    /**
     * Upgrade a tenant to a new Price Level
     */
    public function upgrade(Request $request, string $tenantId)
    {
        $validated = $request->validate([
            'price_level' => 'required|integer|in:1,2',
            'features' => 'nullable|array' // e.g., ['custom_branding' => true]
        ]);

        // Update the Landlord truth
        DB::connection('landlord')->table('tenant_modules')->updateOrInsert(
            ['tenant_id' => $tenantId, 'module_key' => 'digital_card'],
            [
                'price_level' => $validated['price_level'],
                'metadata' => json_encode($validated['features'] ?? []),
                'is_active' => true,
                'updated_at' => now()
            ]
        );

        // Immediate cache bust so the Tenant app updates instantly
        $this->subscription->clearTenantCache($tenantId);

        return response()->json(['message' => 'Tenant upgraded successfully.']);
    }
}

```

### 4. Protecting the Phases (Middleware)

You can now wrap your Phase 1 implementations in a middleware that uses this service.

```php
// Level 1: Core Lifecycle (Files 01-04)
Route::middleware(['tenant', 'price.level:1'])->group(function () {
    Route::post('/cards', [DigitalCardController::class, 'store']);
    Route::put('/cards/{id}/activate', [DigitalCardController::class, 'activate']);
});

// Level 2: Advanced Modules (Files 05-07)
Route::middleware(['tenant', 'price.level:2'])->group(function () {
    Route::post('/cards/bulk', [BulkCardController::class, 'process']);
    Route::get('/cards/export', [ExportController::class, 'download']);
});

```

### 5. Critical Improvement: The "Plan Sync"

Because the databases are isolated, if the Landlord DB goes down, the Tenant app could lose its "memory" of what it owns.
**Recommendation:** Always use a persistent cache (like Redis) for the `SubscriptionService`. This ensures that even if the Landlord database is unreachable for a few minutes, the Tenant's modules remain "installed" based on the last cached state.

**Would you like me to generate a Vue.js "Upgrade Required" modal that automatically pops up when a Level 1 user tries to click a Level 2 feature?**
To complete this business architecture, we need a visual way for you to manage which tenants have which "modules" installed. This **Plan Switcher UI** would live in your **Landlord Admin Portal** (the Service Provider dashboard).

The following implementation provides a clear interface to toggle between Level 1 (Basic) and Level 2 (Advanced), as well as a way to manage granular metadata flags.

### 1. Landlord Plan Switcher Component (Vue 3)

This component would be used by your internal staff to manage a specific tenant's subscription.

```vue
<template>
  <div class="bg-white shadow sm:rounded-lg p-6">
    <h3 class="text-lg font-medium text-gray-900 border-b pb-4">
      Module Subscription: Digital Cards
    </h3>

    <div class="mt-6 space-y-6">
      <fieldset>
        <legend class="text-base font-semibold text-gray-900">Subscription Tier</legend>
        <div class="mt-4 grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
          
          <div 
            @click="form.price_level = 1"
            :class="[form.price_level === 1 ? 'border-blue-600 ring-2 ring-blue-600' : 'border-gray-300']"
            class="relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none"
          >
            <span class="flex flex-1">
              <span class="flex flex-col">
                <span class="block text-sm font-medium text-gray-900">Level 1: Core Lifecycle</span>
                <span class="mt-1 flex items-center text-xs text-gray-500">Manual Issue, Activate, Revoke</span>
              </span>
            </span>
            <CheckCircleIcon v-if="form.price_level === 1" class="h-5 w-5 text-blue-600" />
          </div>

          <div 
            @click="form.price_level = 2"
            :class="[form.price_level === 2 ? 'border-blue-600 ring-2 ring-blue-600' : 'border-gray-300']"
            class="relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none"
          >
            <span class="flex flex-1">
              <span class="flex flex-col">
                <span class="block text-sm font-medium text-gray-900">Level 2: Enterprise</span>
                <span class="mt-1 flex items-center text-xs text-gray-500">Bulk Ops, Exports, WebSockets</span>
              </span>
            </span>
            <CheckCircleIcon v-if="form.price_level === 2" class="h-5 w-5 text-blue-600" />
          </div>
        </div>
      </fieldset>

      <div class="pt-4">
        <h4 class="text-sm font-semibold text-gray-900">Feature Add-ons</h4>
        <div class="mt-2 space-y-3">
          <div class="flex items-start">
            <div class="flex h-6 items-center">
              <input v-model="form.features.custom_branding" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600" />
            </div>
            <div class="ml-3 text-sm leading-6">
              <label class="font-medium text-gray-900">Custom Branding</label>
              <p class="text-gray-500 text-xs">Allow tenant to upload their own card designs.</p>
            </div>
          </div>
          
          <div class="flex items-start">
            <div class="flex h-6 items-center">
              <input v-model="form.features.api_access" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600" />
            </div>
            <div class="ml-3 text-sm leading-6">
              <label class="font-medium text-gray-900">External API Access</label>
              <p class="text-gray-500 text-xs">Enable 3rd party integrations via REST API.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-5 border-t">
        <button 
          @click="submit" 
          :disabled="form.processing"
          class="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          Save Subscription Changes
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useForm } from '@inertiajs/vue3';
import { CheckCircleIcon } from '@heroicons/vue/20/solid';

const props = defineProps({
    tenant: Object,
    currentSubscription: Object
});

const form = useForm({
    price_level: props.currentSubscription?.price_level || 1,
    features: {
        custom_branding: props.currentSubscription?.metadata?.custom_branding || false,
        api_access: props.currentSubscription?.metadata?.api_access || false,
    }
});

const submit = () => {
    form.put(route('landlord.tenants.modules.update', props.tenant.id));
};
</script>

```

### 2. Strategic Analysis of the User Flow

By having this UI in the Landlord portal, you separate the **Sales/Management** concerns from the **Business Logic**.

* **For Level 1 Tenants**: Their dashboard is clean and focused. If they try to access a Level 2 feature (like Bulk Export), you can show a **"Locked" state** that redirects them to contact you for an upgrade.
* **For Level 2 Tenants**: The advanced modules are "injected" into their interface. Because you are using Inertia, the `price_level` is passed once during the initial load, keeping the app fast.
* **For the Admin**: You have a single button ("Save Subscription Changes") that:
1. Updates the Landlord SQL table.
2. Flushes the Redis cache.
3. Broadcasts a "Subscription Updated" event.



### 3. Summary of Implementation

With the code we've discussed, you now have:

1. **Isolation**: Databases are separate.
2. **Infrastructure**: A `SubscriptionService` that bridges them efficiently via caching.
3. **Security**: Middleware that blocks unauthorized tier access.
4. **Flexibility**: A metadata column for add-ons.
5. **Control**: A Landlord UI to manage it all.

**Would you like to move on to the actual implementation of the "Bulk Operations" logic (Phase 1-06) while integrating these new price-level checks?**
#
To implement a **Usage-Based Quota** (the "Free till 500" rule) across isolated databases, we will add a **Counter Mechanism** that the Landlord monitors. Since the Landlord is the Service Provider, it needs to know when a Tenant has hit their "Free Tier" ceiling to trigger the payment block.

Here is the implementation plan to add the **500 Member Limit** to your Phase 1 architecture.

### 1. Landlord Schema Update

We will add `usage_limit` and `current_usage` to the `tenant_modules` table in the Landlord database.

```php
// Landlord Migration
Schema::connection('landlord')->table('tenant_modules', function (Blueprint $table) {
    $table->integer('usage_limit')->default(500); // 0 = unlimited
    $table->integer('current_usage')->default(0); 
});

```

### 2. The Quota-Aware Subscription Service

We update the `SubscriptionService` to check the current card count against the allowed limit.

```php
namespace App\Services;

use Illuminate\Support\Facades\DB;

class SubscriptionService
{
    /**
     * Check if the tenant is allowed to issue another card.
     */
    public function canIssueMoreCards(): bool
    {
        $tenantId = tenancy()->getCurrentTenant()->id;

        $sub = DB::connection('landlord')
            ->table('tenant_modules')
            ->where('tenant_id', $tenantId)
            ->where('module_key', 'digital_card')
            ->first();

        if (!$sub) return false;

        // If level 2, assume unlimited or higher limit
        if ($sub->price_level >= 2) return true;

        // Level 1: Check against the 500 limit
        return $sub->current_usage < $sub->usage_limit;
    }

    /**
     * Sync the usage count from Tenant DB to Landlord DB.
     * Run this after a successful issuance.
     */
    public function syncUsageCount(): void
    {
        $tenantId = tenancy()->getCurrentTenant()->id;
        
        // Count cards in the ISOLATED Tenant DB
        $count = DB::table('digital_cards')->count();

        // Update the Control Plane (Landlord)
        DB::connection('landlord')
            ->table('tenant_modules')
            ->where('tenant_id', $tenantId)
            ->update(['current_usage' => $count]);
            
        $this->clearTenantCache($tenantId);
    }
}

```

### 3. Implementing the "Hard Stop" (Backend)

Update your `IssueDigitalCardHandler` (from Phase 0/1) to enforce the limit before proceeding with the database write.

```php
// app/Contexts/DigitalCard/Application/Handlers/IssueDigitalCardHandler.php

public function handle(IssueDigitalCardCommand $command)
{
    // 1. Check Quota via Landlord Service
    if (!$this->subscriptionService->canIssueMoreCards()) {
        throw new QuotaExceededException(
            "Free limit of 500 cards reached. Please upgrade to Level 2."
        );
    }

    // 2. Proceed with issuance logic...
    $card = $this->repository->save($newCard);

    // 3. Update Landlord counter
    $this->subscriptionService->syncUsageCount();

    return $card;
}

```

### 4. User Experience: The "Upgrade Banner" (Vue 3)

In the Vue admin interface (Phase 1-04), we should show a progress bar so the admin knows they are approaching the 500-card limit.

```vue
<template>
  <div v-if="priceLevel === 1" class="mb-6 p-4 bg-white rounded-lg border shadow-sm">
    <div class="flex justify-between items-center mb-2">
      <span class="text-sm font-medium text-gray-700">Free Tier Usage</span>
      <span class="text-sm font-bold" :class="usageColor">{{ usage }}/500 cards</span>
    </div>
    
    <div class="w-full bg-gray-200 rounded-full h-2.5">
      <div 
        class="h-2.5 rounded-full transition-all duration-500" 
        :class="barColor"
        :style="{ width: (usage / 500 * 100) + '%' }"
      ></div>
    </div>

    <p v-if="usage >= 450" class="mt-2 text-xs text-red-600 font-semibold animate-pulse">
      Warning: You are almost at your 500 card limit! Upgrade now to avoid interruption.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    usage: Number,
    priceLevel: Number
});

const usageColor = computed(() => props.usage > 450 ? 'text-red-600' : 'text-blue-600');
const barColor = computed(() => props.usage > 450 ? 'bg-red-600' : 'bg-blue-600');
</script>

```

### 5. Critical Analysis of the "Free Tier" Logic

* **Consistency vs. Performance**:
* **The Issue**: If a tenant deletes a card in their isolated DB, the Landlord needs to know.
* **The Solution**: The `syncUsageCount()` method should be triggered by **Domain Events** (`CardIssued`, `CardDeleted`). This ensures the Landlord stays in sync without manual polling.


* **The "Race Condition"**:
* If a tenant uses an automated script to issue 600 cards simultaneously, the `canIssueMoreCards()` check might pass for all of them before the first one finishes syncing.
* **Refinement**: For high-volume tenants, use a **Redis Atomic Counter** shared between the Tenant and Landlord to prevent going over the limit during "burst" issuance.



### **Summary of the Tiered Offer**

1. **Level 1 (Free)**: Up to 500 cards. Basic Lifecycle only.
2. **Level 1 (Paid)**: Unlimited cards. Basic Lifecycle only.
3. **Level 2 (Enterprise)**: Unlimited cards + Bulk Operations + Exports + WebSockets.

**Would you like me to create the Laravel Job that periodically audits all Tenant databases to ensure the Landlord's `current_usage` count is 100% accurate?**
To implement the **Membership Audit Job**, we will create a scheduled task that runs in the background. This job will iterate through all tenants, connect to their isolated databases, calculate the current card count, and sync it back to the `tenant_modules` table in the Landlord database.

This act as a **reconciliation layer** to ensure that your "Free Tier (500 limit)" and "Paid Tiers" are always billed accurately, even if a manual database change occurred.

### 1. The Audit Job Implementation

```php
namespace App\Jobs\Landlord;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use App\Models\Tenant;
use App\Services\SubscriptionService;

class AuditTenantUsageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(SubscriptionService $subscriptionService): void
    {
        // 1. Get all active tenants from the Landlord DB
        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            try {
                // 2. Switch context to the specific Tenant's isolated DB
                tenancy()->initialize($tenant);

                // 3. Count the actual cards in the Tenant DB
                $actualCount = DB::table('digital_cards')->count();

                // 4. Update the Landlord's Control Plane
                DB::connection('landlord')
                    ->table('tenant_modules')
                    ->where('tenant_id', $tenant->id)
                    ->where('module_key', 'digital_card')
                    ->update([
                        'current_usage' => $actualCount,
                        'last_audit_at' => now(),
                    ]);

                // 5. Clear the tenant's cache to reflect the new count in their UI
                $subscriptionService->clearTenantCache($tenant->id);

                tenancy()->end();
            } catch (\Exception $e) {
                \Log::error("Audit failed for tenant {$tenant->id}: " . $e->getMessage());
                continue;
            }
        }
    }
}

```

### 2. Scheduling the Audit

Add this to your `app/Console/Kernel.php` to run every night at midnight.

```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule): void
{
    // Run the audit daily to ensure billing/quota integrity
    $schedule->job(new \App\Jobs\Landlord\AuditTenantUsageJob)->dailyAt('00:00');
}

```

### 3. Business Logic Summary for Phase 1

With this final piece, your **Digital Card Service Provider** business model is fully defined:

* **Tier 0 (Free Trial)**:
* Price Level: 1
* Quota: 500 Cards
* Modules: Basic Lifecycle only (Files 01-04).


* **Tier 1 (Pro)**:
* Price Level: 1
* Quota: Unlimited (or defined limit)
* Modules: Basic Lifecycle only.


* **Tier 2 (Enterprise)**:
* Price Level: 2
* Quota: Unlimited
* Modules: Bulk Operations (File 06), Advanced Exports (File 07), and WebSockets (File 05).



### 4. Further Analysis: Automation of the "Hard Stop"

If the Audit Job detects that a "Free Tier" tenant has reached 501 members:

1. The `SubscriptionService::canIssueMoreCards()` will immediately return `false`.
2. The **Middleware** will block any further `POST /cards` requests.
3. The **Vue.js UI** will display the "Upgrade Required" modal.

**Your architecture is now ready for Phase 1 implementation.** You have a robust, multi-tenant, tiered system that protects your business interests while providing a smooth upgrade path for your customers.

**Would you like to start implementing the code for Phase 1-06 (Bulk Operations) now that the subscription gates are ready?**
