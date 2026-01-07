**🎉 PERFECT! ALL TESTS PASS!**

Now **run the migration** to create the landlord branding table:

```bash
cd "C:\Users\nabra\OneDrive\Desktop\roshyara\xamp\nrna\public-digit-platform\packages\laravel-backend"
php artisan migrate --database=landlord
```

**Expected Output:**
```
Migrating: 2026_01_04_224847_create_tenant_brandings_table
Migrated:  2026_01_04_224847_create_tenant_brandings_table (XX.XXms)
```

**Next Critical Steps:**

### **1. Update SetTenantContext Middleware**
Update it to use the new `TenantIdentifierResolver` instead of direct DB queries:

```php
// File: app/Http/Middleware/SetTenantContext.php
// Add at top:
use App\Services\TenantIdentifierResolver;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;

// Update constructor:
private TenantIdentifierResolver $tenantResolver;

public function __construct(TenantIdentifierResolver $tenantResolver)
{
    $this->tenantResolver = $tenantResolver;
}

// Update handle() method to use resolver
public function handle(Request $request, Closure $next): Response
{
    // Use resolver instead of direct DB queries
    $identifiers = $this->tenantResolver->resolveFromUrl($request->url());
    
    if ($identifiers) {
        /** @var TenantSlug $tenantSlug */
        /** @var TenantDbId $tenantDbId */
        $tenantSlug = $identifiers['slug'];
        $tenantDbId = $identifiers['db_id'];
        
        // Get tenant using numeric_id
        $tenant = Tenant::where('numeric_id', $tenantDbId->toInt())->first();
        
        if ($tenant) {
            Tenant::setCurrent($tenant);
            
            // Get branding from landlord DB
            $branding = $this->getBrandingForTenant($tenantDbId);
            
            // Share with Inertia
            $this->shareBrandingWithInertia($tenantSlug, $branding);
            
            // Inject CSS variables
            $this->injectCssVariables($branding);
        }
    }
    
    return $next($request);
}

// Update getBrandingForTenant() to use landlord DB
private function getBrandingForTenant(TenantDbId $dbId): array
{
    // Query landlord.tenant_brandings table
    $branding = DB::connection('landlord')
        ->table('tenant_brandings')
        ->where('tenant_db_id', $dbId->toInt())
        ->first();
    
    return $branding ? (array) $branding : $this->getDefaultBranding();
}
```

### **2. Create Data Migration Script**
After middleware is updated, create script to migrate existing branding data.

### **3. Test Login Pages**
Verify branding works on login pages without authentication.

**Run the migration first, then update the middleware.**