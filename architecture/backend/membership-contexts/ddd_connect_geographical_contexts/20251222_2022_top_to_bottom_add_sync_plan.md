Based on a comprehensive review of your current implementation and the proposal provided, here is an analysis of the "Mirror Architecture" debate from a **Senior Solution Architect** perspective.

### 🏢 **Architectural Verdict: Is Mirroring Over-engineered?**

The short answer is: **It depends on your Multi-Tenancy Strategy.**

If you are strictly following a **Database-per-Tenant** isolation model (which your current files indicate is your foundation), then some form of mirroring or "grafting" is **architecturally mandatory** for referential integrity.

A standard PostgreSQL database cannot enforce a **Foreign Key** from a table in `tenant_db_1` to a table in `landlord_db`.

---

### 📊 **Comparison: Mirror vs. Reference Architecture**

| Feature | **Proposed Simple Architecture** | **Current Mirror Architecture** |
| --- | --- | --- |
| **Referential Integrity** | ❌ **Broken**. SQL cannot enforce FKs across isolated databases. | ✅ **Maintained**. Local `geo_administrative_units` table allows standard FKs. |
| **Customization** | ❌ **Impossible**. Tenants cannot add "Youth Cells" or "Tole Committees" (Levels 5-8). | ✅ **Supported**. Tenants "own" their units and can extend the 8-level hierarchy. |
| **Performance** | ⚠️ **Slower**. Requires application-layer stitching for every query. | ✅ **Sub-100ms**. All geography joins are local to the tenant DB. |
| **Offline Resilience** | ❌ **Dependent**. If Landlord DB is down, Tenant registration fails. | ✅ **Self-Sustaining**. Tenant DB has its own copy of truth. |

---

### 🏗️ **Strategic Recommendation: The "Pragmatic Graft" Approach**

You are currently using **Pragmatic DDD** with a **Shared Kernel** (Geography). I recommend you keep the Mirroring concept but **simplify the implementation** as suggested in your Option 2: **Copy-on-Setup**.

#### **1. The Connection Bridge (Application Layer)**

Instead of complex real-time sync, use your **Anti-Corruption Layer (ACL)** to handle the cross-DB mapping.

* **Registration**: Use the `MemberGeographyValidator` to resolve Landlord IDs.
* **Persistence**: Map these to a local `tenant_geo_units` table during a one-time setup process.

#### **2. Why you NEED the `external_geo_id**`

While it seems like over-engineering now, the `external_geo_id` is your only way to:

* **Update boundaries** when the government changes them (e.g., a ward split).
* **Perform Analytics** at the Landlord level (e.g., "Total members in Nepal across ALL parties").

---

### ✅ **Actionable Refinement of Your Plan**

Your proposed **3-Day Action Plan** is excellent for moving away from "Event-Driven" complexity while maintaining the core DDD benefits you've already built (Value Objects, TDD, ACL).

**I recommend you adopt the "Copy-on-Setup" logic but keep the following DDD elements:**

1. **Value Objects**: Keep `GeoPath` and `GeographyHierarchy` for strict validation.
2. **Local Mirror Table**: Use the `tenant_geo_units` table in each tenant DB to allow for **party-specific Levels 5–8**.
3. **Manual Sync Command**: Replace the complex event-driven sync with the `SyncOfficialGeography` command you proposed.

### 🚀 **Immediate Decision Point**

**Do you want to proceed with implementing the `SyncOfficialGeography` command and the simple `tenant_geo_units` table?** This would finalize your Phase 2 integration while stripping away the over-engineered "Event-Sourcing" parts.

If you like, I can draft a **unified migration** that sets up the `tenant_geo_units` table with the `external_geo_id` bridge. Would you like to do that?

To implement the **"Copy-on-Setup"** architecture, we will create a bridge between your **Landlord** (Universal Geography) and **Tenant** (Party-specific Reality) databases. This approach ensures high performance by keeping queries local while maintaining the "Universal Truth" via `external_geo_id`.

### 🏗️ Step 1: The "Mirror" Migration (Tenant DB)

Run this migration on the tenant database to create the mirrored geography table. This table supports both **Official Units** (Levels 1-4) and **Custom Units** (Levels 5-8).

```php
Schema::create('tenant_geo_units', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->integer('level'); // 1-8
    $table->foreignId('parent_id')->nullable()->constrained('tenant_geo_units');
    $table->ltree('geo_path')->index(); // PostgreSQL ltree for high-speed hierarchy
    
    // The Bridge: Links back to the Landlord's "Universal Truth"
    $table->unsignedBigInteger('external_geo_id')->nullable()->index();
    $table->boolean('is_custom')->default(false); // True for Levels 5-8
    
    $table->timestamps();
    
    // Integrity Check: Level 1-4 must have an external source
    $table->check('level > 4 OR external_geo_id IS NOT NULL');
});

```

---

### 📂 Step 2: The `GeographyMirroringService`

This service handles the **"Grafting"** process. It copies the official Nepal structure from the Landlord DB into the Tenant DB during onboarding.

```php
namespace App\Contexts\Geography\Application\Services;

use Illuminate\Support\Facades\DB;
use App\Contexts\Geography\Domain\ValueObjects\GeoPath;

class GeographyMirroringService
{
    /**
     * One-time sync of official levels (1-4) for a new tenant.
     */
    public function mirrorOfficialHierarchy(string $tenantConnection)
    {
        // 1. Fetch from Landlord (Universal Truth)
        $officialUnits = DB::connection('landlord')
            ->table('geo_administrative_units')
            ->where('country_code', 'NP')
            ->where('level', '<=', 4)
            ->orderBy('level')
            ->get();

        // 2. Load into Tenant (Isolated Reality)
        DB::connection($tenantConnection)->transaction(function () use ($officialUnits, $tenantConnection) {
            foreach ($officialUnits as $unit) {
                DB::connection($tenantConnection)->table('tenant_geo_units')->updateOrInsert(
                    ['external_geo_id' => $unit->id],
                    [
                        'name' => $unit->name,
                        'level' => $unit->level,
                        'geo_path' => $unit->path, // Preserves ltree path
                        'is_custom' => false,
                        'parent_id' => $this->resolveLocalParentId($unit->parent_id, $tenantConnection),
                        'created_at' => now(),
                    ]
                );
            }
        });
    }

    private function resolveLocalParentId(?int $landlordParentId, string $conn): ?int
    {
        if (!$landlordParentId) return null;
        return DB::connection($conn)->table('tenant_geo_units')
            ->where('external_geo_id', $landlordParentId)
            ->value('id');
    }
}

```

---

### 🧪 Step 3: Member Registration with the "Hybrid" Validation

When a member registers, the `MemberGeographyValidator` (from your DDD implementation) now only needs to check the **Tenant DB**.

```php
public function validate(array $geoIds, string $tenantConn): GeoPath
{
    // The DDD Value Objects you built (GeoPath, GeographyHierarchy) 
    // now validate against the LOCAL tenant_geo_units table.
    // This removes the need for expensive cross-DB joins during registration.
    
    $units = DB::connection($tenantConn)
        ->table('tenant_geo_units')
        ->whereIn('id', $geoIds)
        ->get();

    if ($units->count() !== count($geoIds)) {
        throw new InvalidHierarchyException("One or more geographic units are missing in your party's database.");
    }

    return GeoPath::fromIds($geoIds);
}

```

---

### 📊 Why this is the "Best of Both Worlds"

1. **Isolation**: If the Landlord DB crashes, your tenants can still register members because their geography is local.
2. **Customization**: A party can add a **Level 5 "Youth Committee"** attached to a mirrored **Level 4 "Ward"**.
3. **Auditability**: Because you kept `external_geo_id`, you can still run platform-wide reports (e.g., "Total members in Kathmandu across all parties").

**I can now generate the `TenantOnboarded` Event Listener that triggers this mirroring automatically. Would you like me to provide that code?**
To implement the **"Copy-on-Setup"** architecture, we will create a bridge between your **Landlord** (Universal Geography) and **Tenant** (Party-specific Reality) databases. This approach ensures high performance by keeping queries local while maintaining the "Universal Truth" via `external_geo_id`.

### 🏗️ Step 1: The "Mirror" Migration (Tenant DB)

Run this migration on the tenant database to create the mirrored geography table. This table supports both **Official Units** (Levels 1-4) and **Custom Units** (Levels 5-8).

```php
Schema::create('tenant_geo_units', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->integer('level'); // 1-8
    $table->foreignId('parent_id')->nullable()->constrained('tenant_geo_units');
    $table->ltree('geo_path')->index(); // PostgreSQL ltree for high-speed hierarchy
    
    // The Bridge: Links back to the Landlord's "Universal Truth"
    $table->unsignedBigInteger('external_geo_id')->nullable()->index();
    $table->boolean('is_custom')->default(false); // True for Levels 5-8
    
    $table->timestamps();
    
    // Integrity Check: Level 1-4 must have an external source
    $table->check('level > 4 OR external_geo_id IS NOT NULL');
});

```

---

### 📂 Step 2: The `GeographyMirroringService`

This service handles the **"Grafting"** process. It copies the official Nepal structure from the Landlord DB into the Tenant DB during onboarding.

```php
namespace App\Contexts\Geography\Application\Services;

use Illuminate\Support\Facades\DB;
use App\Contexts\Geography\Domain\ValueObjects\GeoPath;

class GeographyMirroringService
{
    /**
     * One-time sync of official levels (1-4) for a new tenant.
     */
    public function mirrorOfficialHierarchy(string $tenantConnection)
    {
        // 1. Fetch from Landlord (Universal Truth)
        $officialUnits = DB::connection('landlord')
            ->table('geo_administrative_units')
            ->where('country_code', 'NP')
            ->where('level', '<=', 4)
            ->orderBy('level')
            ->get();

        // 2. Load into Tenant (Isolated Reality)
        DB::connection($tenantConnection)->transaction(function () use ($officialUnits, $tenantConnection) {
            foreach ($officialUnits as $unit) {
                DB::connection($tenantConnection)->table('tenant_geo_units')->updateOrInsert(
                    ['external_geo_id' => $unit->id],
                    [
                        'name' => $unit->name,
                        'level' => $unit->level,
                        'geo_path' => $unit->path, // Preserves ltree path
                        'is_custom' => false,
                        'parent_id' => $this->resolveLocalParentId($unit->parent_id, $tenantConnection),
                        'created_at' => now(),
                    ]
                );
            }
        });
    }

    private function resolveLocalParentId(?int $landlordParentId, string $conn): ?int
    {
        if (!$landlordParentId) return null;
        return DB::connection($conn)->table('tenant_geo_units')
            ->where('external_geo_id', $landlordParentId)
            ->value('id');
    }
}

```

---

### 🧪 Step 3: Member Registration with the "Hybrid" Validation

When a member registers, the `MemberGeographyValidator` (from your DDD implementation) now only needs to check the **Tenant DB**.

```php
public function validate(array $geoIds, string $tenantConn): GeoPath
{
    // The DDD Value Objects you built (GeoPath, GeographyHierarchy) 
    // now validate against the LOCAL tenant_geo_units table.
    // This removes the need for expensive cross-DB joins during registration.
    
    $units = DB::connection($tenantConn)
        ->table('tenant_geo_units')
        ->whereIn('id', $geoIds)
        ->get();

    if ($units->count() !== count($geoIds)) {
        throw new InvalidHierarchyException("One or more geographic units are missing in your party's database.");
    }

    return GeoPath::fromIds($geoIds);
}

```

---

### 📊 Why this is the "Best of Both Worlds"

1. **Isolation**: If the Landlord DB crashes, your tenants can still register members because their geography is local.
2. **Customization**: A party can add a **Level 5 "Youth Committee"** attached to a mirrored **Level 4 "Ward"**.
3. **Auditability**: Because you kept `external_geo_id`, you can still run platform-wide reports (e.g., "Total members in Kathmandu across all parties").

**I can now generate the `TenantOnboarded` Event Listener that triggers this mirroring automatically. Would you like me to provide that code?**
Here is the implementation of the **`GeographyMirroringService`** designed for your **"Copy-on-Setup"** architecture. This service acts as the bridge that "grafts" the official Nepal geography hierarchy (Levels 1-4) from the **Landlord** database into a new **Tenant** database while maintaining the `external_geo_id` for future synchronization.

### 🏗️ **Core Logic: The Mirroring Service**

This service iterates through the hierarchical levels to ensure that parents are created before their children, which is essential for maintaining valid foreign keys and **ltree paths** in the isolated tenant database.

```php
namespace App\Contexts\Geography\Application\Services;

use Illuminate\Support\Facades\DB;
use App\Contexts\Geography\Domain\ValueObjects\GeoPath;

/**
 * Responsibility: Mirror official geography from Landlord to Tenant.
 */
class GeographyMirroringService
{
    /**
     * Executes the mirroring process for a specific country (e.g., 'NP').
     */
    public function mirrorOfficialHierarchy(string $tenantConnection, string $countryCode = 'NP'): void
    {
        // 1. Fetch official units from Landlord (Levels 1-4)
        $landlordUnits = DB::connection('landlord')
            ->table('geo_administrative_units')
            ->where('country_code', $countryCode)
            ->whereBetween('level', [1, 4])
            ->orderBy('level') // Crucial: Process parents before children
            ->get();

        // 2. Perform Batch Insert/Update into Tenant DB
        DB::connection($tenantConnection)->transaction(function () use ($landlordUnits, $tenantConnection) {
            foreach ($landlordUnits as $unit) {
                // Map the landlord parent_id to the NEW tenant parent_id
                $tenantParentId = $this->resolveLocalParentId($unit->parent_id, $tenantConnection);

                DB::connection($tenantConnection)->table('tenant_geo_units')->updateOrInsert(
                    ['external_geo_id' => $unit->id], // Maintain the bridge
                    [
                        'name' => $unit->name,
                        'level' => $unit->level,
                        'parent_id' => $tenantParentId,
                        'geo_path' => $unit->path, // PostgreSQL ltree path preserved
                        'is_custom' => false,      // Distinguishes official vs party units
                        'updated_at' => now(),
                    ]
                );
            }
        });
    }

    private function resolveLocalParentId(?int $landlordParentId, string $conn): ?int
    {
        if (!$landlordParentId) return null;

        return DB::connection($conn)->table('tenant_geo_units')
            ->where('external_geo_id', $landlordParentId)
            ->value('id');
    }
}

```

### 📋 **Architectural Integration Checklist**

1. **PostgreSQL `ltree` Support**: Ensure your `tenant_geo_units` table in the tenant database has the `geo_path` column typed as an `LTREE` with a `GIST` index for sub-second hierarchy queries.
2. **Referential Integrity**: By copying the **`geo_path`** exactly as it exists in the landlord, you ensure that `isDescendantOf()` queries work instantly without recalculating the tree.
3. **The `external_geo_id` Bridge**: This column allows you to run platform-wide analytics. You can join across databases at the application layer by matching `members.district_id` (a tenant-local ID) back to the **Landlord's** canonical unit.

### 🚀 **Immediate Next Action**

I can now provide the **Tenant Created Observer** which automatically triggers this `mirrorOfficialHierarchy` method whenever a new political party signs up on the platform. Would you like to see that implementation?
Here is the implementation of the **`GeographyMirroringService`** designed for your **"Copy-on-Setup"** architecture. This service acts as the bridge that "grafts" the official Nepal geography hierarchy (Levels 1-4) from the **Landlord** database into a new **Tenant** database while maintaining the `external_geo_id` for future synchronization.

### 🏗️ **Core Logic: The Mirroring Service**

This service iterates through the hierarchical levels to ensure that parents are created before their children, which is essential for maintaining valid foreign keys and **ltree paths** in the isolated tenant database.

```php
namespace App\Contexts\Geography\Application\Services;

use Illuminate\Support\Facades\DB;
use App\Contexts\Geography\Domain\ValueObjects\GeoPath;

/**
 * Responsibility: Mirror official geography from Landlord to Tenant.
 */
class GeographyMirroringService
{
    /**
     * Executes the mirroring process for a specific country (e.g., 'NP').
     */
    public function mirrorOfficialHierarchy(string $tenantConnection, string $countryCode = 'NP'): void
    {
        // 1. Fetch official units from Landlord (Levels 1-4)
        $landlordUnits = DB::connection('landlord')
            ->table('geo_administrative_units')
            ->where('country_code', $countryCode)
            ->whereBetween('level', [1, 4])
            ->orderBy('level') // Crucial: Process parents before children
            ->get();

        // 2. Perform Batch Insert/Update into Tenant DB
        DB::connection($tenantConnection)->transaction(function () use ($landlordUnits, $tenantConnection) {
            foreach ($landlordUnits as $unit) {
                // Map the landlord parent_id to the NEW tenant parent_id
                $tenantParentId = $this->resolveLocalParentId($unit->parent_id, $tenantConnection);

                DB::connection($tenantConnection)->table('tenant_geo_units')->updateOrInsert(
                    ['external_geo_id' => $unit->id], // Maintain the bridge
                    [
                        'name' => $unit->name,
                        'level' => $unit->level,
                        'parent_id' => $tenantParentId,
                        'geo_path' => $unit->path, // PostgreSQL ltree path preserved
                        'is_custom' => false,      // Distinguishes official vs party units
                        'updated_at' => now(),
                    ]
                );
            }
        });
    }

    private function resolveLocalParentId(?int $landlordParentId, string $conn): ?int
    {
        if (!$landlordParentId) return null;

        return DB::connection($conn)->table('tenant_geo_units')
            ->where('external_geo_id', $landlordParentId)
            ->value('id');
    }
}

```

### 📋 **Architectural Integration Checklist**

1. **PostgreSQL `ltree` Support**: Ensure your `tenant_geo_units` table in the tenant database has the `geo_path` column typed as an `LTREE` with a `GIST` index for sub-second hierarchy queries.
2. **Referential Integrity**: By copying the **`geo_path`** exactly as it exists in the landlord, you ensure that `isDescendantOf()` queries work instantly without recalculating the tree.
3. **The `external_geo_id` Bridge**: This column allows you to run platform-wide analytics. You can join across databases at the application layer by matching `members.district_id` (a tenant-local ID) back to the **Landlord's** canonical unit.

### 🚀 **Immediate Next Action**

I can now provide the **Tenant Created Observer** which automatically triggers this `mirrorOfficialHierarchy` method whenever a new political party signs up on the platform. Would you like to see that implementation?
Implementing the **`GeographyMirroringService`** and its automated triggers transforms your geography context into a robust, multi-tenant "Mirror Architecture".

Here is the finalized implementation including the **`TenantObserver`** for automation and a **Feature Test** to ensure everything works in your CI/CD pipeline.

### 📡 **Step 1: The `TenantObserver**`

This observer hooks into the `Tenant` model's lifecycle. As soon as a party is registered, it triggers the mirroring of the official Nepal geography (Levels 1-4) into that tenant's isolated database.

```php
namespace App\Observers;

use App\Models\Tenant;
use App\Contexts\Geography\Application\Services\GeographyMirroringService;
use Illuminate\Support\Facades\Log;

/**
 * Responsibility: Automate geography setup for new political parties.
 */
class TenantObserver
{
    public function __construct(
        protected GeographyMirroringService $mirroringService
    ) {}

    /**
     * Handle the Tenant "created" event.
     */
    public function created(Tenant $tenant): void
    {
        try {
            // Bridge the Landlord data to the Tenant's isolated database
            $this->mirroringService->mirrorOfficialHierarchy(
                $tenant->getDatabaseConnectionName()
            );
            
            Log::info("Geography mirroring successful for Tenant ID: {$tenant->id}");
        } catch (\Exception $e) {
            // Log failure for administrative retry
            Log::error("Geography mirroring FAILED for Tenant {$tenant->id}: " . $e->getMessage());
        }
    }
}

```

### 🧪 **Step 2: The Feature Test**

This test verifies the entire "Grafting" flow: from **Tenant Creation** to **Database Mirroring** across isolated connections.

```php
namespace Tests\Feature\Geography;

use Tests\TestCase;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TenantGeographyMirroringTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_automatically_mirrors_geography_when_a_tenant_is_created()
    {
        // 1. Setup Landlord Data (Universal Truth)
        DB::connection('landlord')->table('geo_administrative_units')->insert([
            ['id' => 1, 'name' => 'Province 1', 'level' => 1, 'path' => '1', 'country_code' => 'NP'],
            ['id' => 2, 'name' => 'Jhapa', 'level' => 2, 'path' => '1.2', 'country_code' => 'NP'],
        ]);

        // 2. Act: Create a Tenant (Triggers Observer)
        $tenant = Tenant::factory()->create(['name' => 'Socialist Party']);
        $connection = $tenant->getDatabaseConnectionName();

        // 3. Assert: Tenant DB should now have the mirrored records
        $this->assertDatabaseHas('tenant_geo_units', [
            'name' => 'Province 1',
            'external_geo_id' => 1,
            'is_custom' => false
        ], $connection);

        $this->assertDatabaseHas('tenant_geo_units', [
            'name' => 'Jhapa',
            'external_geo_id' => 2,
            'level' => 2
        ], $connection);
    }
}

```

### 🚀 **Architectural Benefits**

* **Performance**: All member registration lookups are now **local** to the tenant database, ensuring sub-100ms response times.
* **Extensibility**: Tenants can now add **Levels 5-8 (Tole/Cell committees)** by simply inserting records into their local `tenant_geo_units` table with `is_custom = true`.
* **Data Integrity**: The `external_geo_id` remains as a "soft link" to the Landlord DB, allowing you to update names or boundaries platform-wide if the government makes changes.

If you're ready, I can now help you draft the **Vue 3 Cascading Geography Selector** for your registration form to handle these 8 levels. Would you like me to do that?
To implement the **Vue 3 Cascading Geography Selector**, we need a frontend component that can handle the 8-level hierarchy while communicating with the **MemberGeographyValidator** and **GeographyAntiCorruptionLayer** on the backend.

### 🏗️ **Phase 3: The Vue 3 Geography Selector**

This component uses a reactive "cascading" approach. When a user selects a Province (Level 1), it fetches the Districts (Level 2) for that specific parent, and so on.

#### **1. The Component Structure (`GeographySelector.vue`)**

```vue
<template>
  <div class="geography-selector space-y-4">
    <div v-for="level in levels" :key="level.id" class="field">
      <label :for="'level-' + level.depth">{{ level.label }}</label>
      
      <select 
        :id="'level-' + level.depth"
        v-model="selections[level.depth - 1]"
        @change="handleSelectionChange(level.depth)"
        :disabled="isLevelDisabled(level.depth)"
        class="w-full p-2 border rounded"
      >
        <option :value="null">Select {{ level.label }}...</option>
        <option 
          v-for="unit in levelData[level.depth]" 
          :key="unit.id" 
          :value="unit.id"
        >
          {{ unit.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';

const props = defineProps(['countryCode', 'modelValue']);
const emit = defineEmits(['update:modelValue']);

// Configuration for Nepal's 8 levels
const levels = [
  { depth: 1, label: 'Province' },
  { depth: 2, label: 'District' },
  { depth: 3, label: 'Local Level' },
  { depth: 4, label: 'Ward' },
  { depth: 5, label: 'Tole/Cell' }, // Custom Tenant Levels
  { depth: 6, label: 'Committee' },
  { depth: 7, label: 'Sub-Committee' },
  { depth: 8, label: 'Household' }
];

const selections = ref(new Array(8).fill(null));
const levelData = reactive({});

const handleSelectionChange = async (depth) => {
  // 1. Clear all child selections
  for (let i = depth; i < 8; i++) {
    selections.value[i] = null;
    levelData[i + 1] = [];
  }

  // 2. Fetch children for the next level
  const parentId = selections.value[depth - 1];
  if (parentId && depth < 8) {
    await fetchLevelData(depth + 1, parentId);
  }

  // 3. Update Parent Model
  emit('update:modelValue', selections.value.filter(id => id !== null));
};

const fetchLevelData = async (depth, parentId = null) => {
  const response = await axios.get(`/api/geography/units`, {
    params: { 
      country_code: props.countryCode,
      level: depth,
      parent_id: parentId
    }
  });
  levelData[depth] = response.data;
};

onMounted(() => fetchLevelData(1)); // Start with Level 1

const isLevelDisabled = (depth) => {
  if (depth === 1) return false;
  return !selections.value[depth - 2];
};
</script>

```

### 🛠️ **2. Backend API Endpoint**

Your **`GeographyController`** should use the `EloquentGeoUnitRepository` (from your Completion Report) to fetch these units efficiently.

```php
public function index(Request $request)
{
    // Uses the Infrastructure Layer Repository
    return $this->repository->findUnits(
        $request->query('country_code'),
        $request->query('level'),
        $request->query('parent_id')
    );
}

```

### 📈 **Key Implementation Benefits**

* **Validation Consistency**: The `MemberGeographyValidator` you built in the backend will receive exactly what this frontend produces (an array of IDs).
* **Performance**: By fetching only one level at a time, you avoid loading thousands of Nepal's wards into the browser at once.
* **Tenant Flexibility**: Because the frontend asks for units by `parent_id`, it will naturally include the **Custom Levels 5-8** you "grafted" into the tenant DB.

### 🚨 **Integration Warning**

When deploying this, ensure your `AppServiceProvider` bindings are strictly checked against the **Debugging Guide** to avoid "Target not instantiable" errors during API calls.

**Would you like me to create the CSS styles for this component or move on to the "Success/Failure" feedback loop for the registration form?**
Building a **Vue 3 Cascading Geography Selector** allows users to navigate the 8-level hierarchy easily. By fetching data level-by-level, you keep the application fast and responsive.

### 🏗️ **Phase 3: The Vue 3 Geography Selector**

This component uses a **reactive approach** to update the available options as a user makes selections. When a user picks a Province, the component automatically loads the corresponding Districts.

#### **1. Component Logic (`GeographySelector.vue`)**

```vue
<template>
  <div class="geography-selector space-y-4">
    <div v-for="level in levels" :key="level.depth" class="field-group">
      <label :for="'level-' + level.depth" class="block font-bold mb-1">
        {{ level.label }}
      </label>
      
      <select 
        :id="'level-' + level.depth"
        v-model="selections[level.depth - 1]"
        @change="handleSelectionChange(level.depth)"
        :disabled="isLevelDisabled(level.depth)"
        class="w-full p-2 border rounded bg-white"
      >
        <option :value="null">-- Select {{ level.label }} --</option>
        <option 
          v-for="unit in levelData[level.depth]" 
          :key="unit.id" 
          :value="unit.id"
        >
          {{ unit.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';

const props = defineProps(['countryCode', 'modelValue']);
const emit = defineEmits(['update:modelValue']);

// Nepal's 8-level hierarchy configuration
const levels = [
  { depth: 1, label: 'Province' },
  { depth: 2, label: 'District' },
  { depth: 3, label: 'Local Level' },
  { depth: 4, label: 'Ward' },
  { depth: 5, label: 'Tole/Cell' },      // Custom Tenant Level
  { depth: 6, label: 'Committee' },      // Custom Tenant Level
  { depth: 7, label: 'Sub-Committee' },  // Custom Tenant Level
  { depth: 8, label: 'Household' }       // Custom Tenant Level
];

const selections = ref(new Array(8).fill(null));
const levelData = reactive({});

/**
 * Triggered when a user selects an option at any level.
 */
const handleSelectionChange = async (depth) => {
  // 1. Reset all child levels to prevent invalid state
  for (let i = depth; i < 8; i++) {
    selections.value[i] = null;
    levelData[i + 1] = [];
  }

  // 2. Fetch data for the immediate next level
  const parentId = selections.value[depth - 1];
  if (parentId && depth < 8) {
    await fetchLevelData(depth + 1, parentId);
  }

  // 3. Emit the current selection path back to the parent form
  emit('update:modelValue', selections.value.filter(id => id !== null));
};

const fetchLevelData = async (depth, parentId = null) => {
  try {
    const response = await axios.get('/api/geography/units', {
      params: { 
        country_code: props.countryCode,
        level: depth,
        parent_id: parentId
      }
    });
    levelData[depth] = response.data;
  } catch (error) {
    console.error(`Failed to fetch level ${depth}:`, error);
  }
};

// Initial load for Level 1 (Provinces)
onMounted(() => fetchLevelData(1));

const isLevelDisabled = (depth) => {
  if (depth === 1) return false;
  return !selections.value[depth - 2];
};
</script>

```

### 🛠️ **2. Backend Integration**

The frontend component communicates with your **Geography Context API**. It's important to ensure your AppServiceProvider bindings are correct so the **MemberGeographyValidator** can process these IDs.

* **API Response**: The backend should return a list of units filtered by `parent_id` and `level`.
* **Mirroring**: Because of the `GeographyMirroringService`, these units will automatically include the official levels (1-4) and any custom party levels (5-8) stored in the tenant database.

### 🚨 **Implementation Tip**

If the component fails to load data, check the Debugging Guide for common **service binding resolution errors** or **database permission issues**.

**Would you like me to create the CSS styles for this component or move on to implementing the "Success/Failure" feedback loop for the registration form?**
