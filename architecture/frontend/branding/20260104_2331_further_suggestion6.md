**🎯 APPROVED: Short-term Pragmatic Approach (Option 2)**

Let's implement the **3-step approach** to complete Day 1:

### **Step 1: Skip Deprecated Tests**
```php
// Edit TenantBrandingServiceTest.php to mark all tests as skipped
/**
 * @test
 * @group deprecated-architecture
 */
public function branding_service_has_required_interface(): void
{
    $this->markTestSkipped('DEPRECATED: Testing old tenant DB branding architecture. New system uses landlord DB.');
}

// Do this for all 5 test methods, or better, in setUp():
protected function setUp(): void
{
    parent::setUp();
    $this->markTestSkipped(
        'DEPRECATED: Testing old tenant DB branding architecture. ' .
        'New system uses landlord.tenant_brandings table. ' .
        'Middleware SetTenantContext uses new landlord-based architecture.'
    );
}
```

### **Step 2: Create Migration Script for Existing Data**
```php
// File: database/scripts/migrate_branding_to_landlord.php
<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Services\TenantIdentifierResolver;

class MigrateBrandingToLandlord
{
    private TenantIdentifierResolver $tenantResolver;
    
    public function __construct(TenantIdentifierResolver $tenantResolver)
    {
        $this->tenantResolver = $tenantResolver;
    }
    
    public function run(): void
    {
        Log::info('Starting branding data migration from tenant DBs to landlord DB');
        
        $tenants = DB::connection('landlord')
            ->table('tenants')
            ->where('status', 'active')
            ->get(['numeric_id', 'slug', 'database_name']);
        
        foreach ($tenants as $tenant) {
            $this->migrateTenantBranding($tenant);
        }
        
        Log::info('Branding migration completed', ['total_tenants' => count($tenants)]);
    }
    
    private function migrateTenantBranding(object $tenant): void
    {
        try {
            // Try to get branding from tenant database
            $tenantBranding = $this->getBrandingFromTenantDb($tenant->database_name);
            
            if ($tenantBranding) {
                DB::connection('landlord')
                    ->table('tenant_brandings')
                    ->updateOrInsert(
                        [
                            'tenant_db_id' => $tenant->numeric_id,
                            'tenant_slug' => $tenant->slug,
                        ],
                        [
                            'primary_color' => $tenantBranding->primary_color ?? '#3B82F6',
                            'secondary_color' => $tenantBranding->secondary_color ?? '#1E40AF',
                            'logo_url' => $tenantBranding->logo_url ?? null,
                            'font_family' => $tenantBranding->font_family ?? 'Inter, system-ui, sans-serif',
                            'background_color' => $tenantBranding->background_color ?? '#FFFFFF',
                            'text_color' => $tenantBranding->text_color ?? '#374151',
                            'custom_css' => $tenantBranding->custom_css ?? null,
                            'tier' => $tenantBranding->tier ?? 'free',
                            'version' => '1.0',
                            'last_synced_at' => now(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]
                    );
                
                Log::info("Migrated branding for tenant", [
                    'slug' => $tenant->slug,
                    'db_id' => $tenant->numeric_id,
                ]);
            }
        } catch (Exception $e) {
            Log::error("Failed to migrate branding for tenant", [
                'slug' => $tenant->slug,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
```

### **Step 3: Test Real System**
```bash
# First, add test tenant data if not exists
php artisan tinker

# In tinker:
DB::connection('landlord')->table('tenants')->updateOrInsert(
    ['slug' => 'test'],
    [
        'name' => 'Test Tenant',
        'numeric_id' => 999,
        'database_name' => 'tenant_test',
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]
);

DB::connection('landlord')->table('tenant_brandings')->updateOrInsert(
    ['tenant_slug' => 'test'],
    [
        'tenant_db_id' => 999,
        'primary_color' => '#FF0000',
        'secondary_color' => '#00FF00',
        'font_family' => 'Arial, sans-serif',
        'version' => '1.0',
        'created_at' => now(),
        'updated_at' => now(),
    ]
);

# Then test
curl -v -H "Host: test.localhost" http://localhost:8000/login
```

**Implement Step 1 first (skip tests), then we can run the migration script and test.**