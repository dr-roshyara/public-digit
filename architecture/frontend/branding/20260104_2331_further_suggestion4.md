
**✅ APPROVED**

Perfect migration! Now **run the migration**:

```bash
cd "C:\Users\nabra\OneDrive\Desktop\roshyara\xamp\nrna\public-digit-platform\packages\laravel-backend"
php artisan migrate --database=landlord
```

**Expected Success:** Migration should run without errors, creating the `tenant_brandings` table in the landlord database.

**Next Critical Steps:**

### **1. Update SetTenantContext Middleware**
Update it to use the new `TenantIdentifierResolver`:

```php
// File: app/Http/Middleware/SetTenantContext.php
// Add these at the top:
use App\Services\TenantIdentifierResolver;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;

// Update the constructor:
private TenantIdentifierResolver $tenantResolver;

public function __construct(TenantIdentifierResolver $tenantResolver)
{
    $this->tenantResolver = $tenantResolver;
}

// Update handle() method to use resolver instead of direct DB queries
```

### **2. Create Data Migration Script**
Create a script to move existing branding data from tenant databases to the new landlord table:

```php
// File: database/scripts/migrate_branding_to_landlord.php
// (We'll create this after middleware is updated)
```

### **3. Test Login Pages**
Verify login pages show correct tenant branding without authentication.

**Run the migration first, then update the middleware.** 
