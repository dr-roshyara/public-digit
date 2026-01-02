In a multi-database architecture, the **Landlord** database (e.g., `publicdigit`) acts as your "Master Library," while each **Tenant** database (e.g., `tenant_uml`) is an isolated "Workplace."

To get your geography units from the Master Library into the Tenant Workplace, you don't use regular seeding. Instead, you use a **Mirroring Job**.

### 🏗️ The Mirroring Process

The goal is to copy rows from the `np_geo_administrative_units` table in the Landlord DB to the `geo_administrative_units` table in your Tenant DB.

#### **Step 1: The Model Connection Setup**

First, ensure your models are looking at the right databases.

```php
// app/Models/Landlord/MasterGeoUnit.php
class MasterGeoUnit extends Model {
    protected $connection = 'landlord'; // Point to 'publicdigit'
    protected $table = 'np_geo_administrative_units';
}

// app/Models/Tenant/GeoAdministrativeUnit.php
class GeoAdministrativeUnit extends Model {
    protected $connection = 'tenant'; // Dynamically switches for the active tenant
    protected $table = 'geo_administrative_units';
}

```

#### **Step 2: The Mirroring Logic**

You need a service that runs after a new tenant is created or during a setup command. This service fetches data from one connection and writes it to the other.

```php
namespace App\Services;

use App\Models\Landlord\MasterGeoUnit;
use App\Models\Tenant\GeoAdministrativeUnit;

class GeographyMirrorService
{
    public function mirrorToTenant($tenant)
    {
        // 1. Switch context to the specific tenant database (e.g., tenant_uml)
        $tenant->makeCurrent(); 

        // 2. Fetch all official units from the Landlord DB
        // Use orderBy level so we insert parents before children
        $masterUnits = MasterGeoUnit::orderBy('admin_level')->get();

        $idMap = []; // To keep track of new IDs vs old Master IDs

        foreach ($masterUnits as $master) {
            $newUnit = GeoAdministrativeUnit::create([
                'name_en'         => $master->name_en,
                'admin_level'     => $master->admin_level,
                'external_geo_id' => $master->id, // Store the Landlord ID for reference
                'is_official'     => true,
                'parent_id'       => $master->parent_id ? ($idMap[$master->parent_id] ?? null) : null,
            ]);

            // Save the mapping so children can find their new parent ID
            $idMap[$master->id] = $newUnit->id;
        }
    }
}

```

### 🛠️ How to Trigger This

You have three main ways to run this:

1. **On Tenant Creation:** Use a Laravel **Observer** or **Event Listener** (`TenantCreated`). The moment you create `tenant_uml` in your `tenants` table, the script runs.
2. **Custom Artisan Command:** Create a command like `php artisan geo:mirror {tenant_id}`.
```bash
php artisan geo:mirror tenant_uml

```


3. **Tenant Seeder:** Call the service from within your `TenantDatabaseSeeder`.

---

### 📊 Comparison of Methods

| Method | Best For... | Efficiency |
| --- | --- | --- |
| **Mirroring Service** | **Production SaaS.** Keeps tenants fast and independent. | ⭐⭐⭐⭐⭐ |
| **Direct Cross-DB Join** | **Internal Tools.** Querying Landlord tables directly from Tenant SQL. | ⭐⭐⭐ |
| **Manual Export/Import** | **Testing.** Running SQL dumps manually. | ⭐ |

### 🚀 Next Steps

Would you like me to help you write the **Tenant Observer** so that every time you create a new tenant, it automatically seeds their geography units without you doing anything manually?

[Multitenancy in Laravel: Migrations and Seeding](https://www.youtube.com/watch?v=592EgykFOz4)

This video is helpful because it demonstrates the practical steps of managing migrations and seeders across both landlord and tenant databases in a real-world Laravel application.
As a senior architect, automating the flow of data from your **Landlord** (Master) to your **Tenant** (Isolated) database is a critical "Day 1" task. To avoid confusion, you should think of the Landlord DB as a "template" and the Tenant DB as the "instance."

The best way to achieve this in a scalable SaaS is through a **Tenant Observer** or a **Job Pipeline**.

### 🏗️ The Logic: How `tenant_uml` gets its data

When you create a new row in your central `tenants` table for "UML," you trigger an event. This event must:

1. Create the `tenant_uml` database.
2. Run migrations (to create the `geo_administrative_units` table structure).
3. **Execute the Mirroring Service** (to fill that table with official Nepal data).

---

### 🛠️ Step 1: Create the Tenant Observer

This observer "watches" your Tenant model. When a new tenant is saved to the central database, it kicks off the process.

```php
namespace App\Observers;

use App\Models\Tenant;
use App\Services\GeographyMirrorService;

class TenantObserver
{
    protected $mirrorService;

    public function __construct(GeographyMirrorService $mirrorService)
    {
        $this->mirrorService = $mirrorService;
    }

    /**
     * Handle the Tenant "created" event.
     */
    public function created(Tenant $tenant)
    {
        // 1. Logic to create and migrate the database is usually handled 
        // by your tenancy package (like stancl/tenancy or spatie/multitenancy).
        
        // 2. We trigger our custom mirroring
        $this->mirrorService->mirrorToTenant($tenant);
    }
}

```

---

### 🛠️ Step 2: Refining the Mirroring Service

Since you are using a **Hybrid Approach**, your service needs to be smart enough to map IDs correctly so that children in the `tenant_uml` DB point to their new local parents, not the Landlord IDs.

```php
public function mirrorToTenant($tenant)
{
    // Initialize the tenant context so 'DB::connection('tenant')' 
    // points to 'tenant_uml'
    tenancy()->initialize($tenant);

    $idMap = [];
    $masterUnits = MasterGeoUnit::orderBy('admin_level')->get();

    foreach ($masterUnits as $master) {
        $newUnit = GeoAdministrativeUnit::create([
            'name_en'         => $master->name_en,
            'admin_level'     => $master->admin_level,
            'external_geo_id' => $master->id, // Critical for future syncs!
            'is_official'     => true,
            'parent_id'       => $master->parent_id ? ($idMap[$master->parent_id] ?? null) : null,
        ]);

        $idMap[$master->id] = $newUnit->id;
    }
}

```

---

### 🚀 Why this is the "Safe Side"

* **Automated Onboarding:** You never have to manually seed a new tenant. It happens in milliseconds the moment they sign up.
* **Referential Integrity:** By storing `external_geo_id`, you can later update the name of a District in the Landlord DB and run a script to update it across ALL 1,000+ tenants automatically.
* **Performance:** `tenant_uml` now has its own local copy of the geography, making member registration and reporting lightning fast because it doesn't have to talk to the Landlord DB anymore.

### 🏁 Next Step

To finalize this, we should register the observer in your `AppServiceProvider`.

**Would you like me to show you the registration code and how to write a test case to verify that `tenant_uml` actually receives the data?**

---

[Laravel Multi-tenancy Guide](https://www.youtube.com/watch?v=YaSPB2uNLYg)

This video is relevant because it provides a comprehensive overview of setting up multi-database tenancy in Laravel, including how to manage events like tenant creation and data isolation which is exactly what your mirroring service requires.
To implement the automated flow where a new tenant (like `tenant_uml`) receives the master geography data from your landlord database, you need to register your observer and then verify it with a robust test case.

### 1. Register the Observer

In your central application context, you must tell Laravel to watch the `Tenant` model for the `created` event.

**File:** `app/Providers/AppServiceProvider.php`

```php
namespace App\Providers;

use App\Models\Tenant;
use App\Observers\TenantObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Tell Laravel to use the TenantObserver for the Tenant model
        Tenant::observe(TenantObserver::class);
    }
}

```

---

### 2. Verify with a Feature Test

As a senior developer, you never assume the code works; you prove it with a test. This test will simulate creating a tenant and check if the geography units exist in the new tenant's database.

**File:** `tests/Feature/TenantGeographyMirrorTest.php`

```php
namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\Landlord\MasterGeoUnit;
use App\Models\Tenant\GeoAdministrativeUnit;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TenantGeographyMirrorTest extends TestCase
{
    use RefreshDatabase; // Refreshes the landlord DB

    /** @test */
    public function it_mirrors_geography_when_a_new_tenant_is_created()
    {
        // 1. Setup: Create sample data in Landlord DB
        $master = MasterGeoUnit::create([
            'name_en' => 'Bagmati Province',
            'admin_level' => 1
        ]);

        // 2. Action: Create a new tenant
        // This triggers the TenantObserver -> GeographyMirrorService
        $tenant = Tenant::create([
            'id' => 'uml',
            'tenancy_db_name' => 'tenant_uml'
        ]);

        // 3. Assertion: Switch to tenant context and check data
        tenancy()->initialize($tenant);

        $this->assertDatabaseHas('geo_administrative_units', [
            'name_en' => 'Bagmati Province',
            'external_geo_id' => $master->id,
            'is_official' => true
        ], 'tenant'); // The 'tenant' connection should now have the data
    }
}

```

---

### 🏛️ The Architecture Summary

* **Central Store**: `AppServiceProvider` handles the "wiring" of the observer.
* **Automatic Trigger**: When `$tenant->save()` is called, the `created` hook fires.
* **Context Switch**: The `GeographyMirrorService` uses the `external_geo_id` to ensure that if you ever update the Landlord's data, you can sync those changes back to the tenants using that reference.

[Implementing Multi-tenancy in Laravel](https://www.youtube.com/watch?v=VF8-zNGbX1k)

This video provides a deep dive into setting up multi-tenancy with a single or multiple database approach, which is essential for understanding how to handle data isolation and mirroring between your landlord and tenant environments.