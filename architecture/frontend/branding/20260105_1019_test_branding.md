# 🔍 **ARCHITECTURE AUDIT: Single Source of Truth Check**

## **📊 CURRENT STATE ANALYSIS**

### **✅ WHAT'S IMPLEMENTED (Correct)**
1. ✅ **Landlord Database Table**: `tenant_brandings` exists with dual identifiers
2. ✅ **No Tenant DB Branding Table**: We only created landlord table (correct)
3. ✅ **SetTenantContext Middleware**: Queries landlord DB only (correct)
4. ✅ **TenantIdentifierResolver**: Maps slugs to IDs without tenant DB (correct)

### **⚠️ WHAT'S INCOMPLETE**
1. ❌ **TenantBrandingService Still Uses Tenant DB**: Our service still queries tenant databases
2. ❌ **No Data Migration**: Existing tenant branding data not moved to landlord
3. ❌ **Dual System Running**: Tenant DB has branding, Landlord DB mostly empty

## **🎯 IMMEDIATE ACTION: Complete Single Source Architecture**

### **Step 1: Update TenantBrandingService to Use Landlord DB**

```php
// File: app/Contexts/TenantAuth/Application/Services/TenantBrandingService.php

// Add these imports at top:
use App\Services\TenantIdentifierResolver;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;

// Update constructor:
public function __construct(
    private CacheRepository $cache,
    private ?LoggerInterface $logger = null,
    private ?TenantIdentifierResolver $tenantResolver = null
) {
    $this->logger = $logger ?? app('log');
    $this->tenantResolver = $tenantResolver ?? app(TenantIdentifierResolver::class);
}

// Update getBrandingForTenant method:
public function getBrandingForTenant(Tenant $tenant): array
{
    try {
        // Convert to TenantSlug
        $tenantSlug = TenantSlug::fromString($tenant->slug);
        
        // Get TenantDbId via resolver
        $tenantDbId = $this->tenantResolver->resolveToDbId($tenantSlug);
        
        if (!$tenantDbId) {
            return $this->getDefaultBranding();
        }
        
        // Query landlord DB (NOT tenant DB)
        $cacheKey = 'tenant:branding:' . $tenantDbId->toInt();
        
        return $this->cache->remember($cacheKey, 3600, function () use ($tenantDbId) {
            $branding = DB::connection('landlord')
                ->table('tenant_brandings')
                ->where('tenant_db_id', $tenantDbId->toInt())
                ->first();
            
            return $branding ? (array) $branding : $this->getDefaultBranding();
        });
        
    } catch (\Exception $e) {
        $this->logger->error('Failed to get tenant branding', [
            'tenant_id' => $tenant->id,
            'error' => $e->getMessage()
        ]);
        
        return $this->getDefaultBranding();
    }
}

// Update updateBrandingForTenant method:
public function updateBrandingForTenant(Tenant $tenant, array $brandingData): bool
{
    try {
        // Validate data
        $validated = $this->validateBrandingData($brandingData);
        
        // Get identifiers
        $tenantSlug = TenantSlug::fromString($tenant->slug);
        $tenantDbId = $this->tenantResolver->resolveToDbId($tenantSlug);
        
        if (!$tenantDbId) {
            throw new \RuntimeException('Could not resolve tenant DB ID');
        }
        
        // SINGLE WRITE: To landlord DB only
        DB::connection('landlord')->transaction(function () use ($tenantDbId, $tenantSlug, $validated) {
            DB::connection('landlord')
                ->table('tenant_brandings')
                ->updateOrInsert(
                    [
                        'tenant_db_id' => $tenantDbId->toInt(),
                        'tenant_slug' => $tenantSlug->toString(),
                    ],
                    array_merge($validated, [
                        'version' => '2.0',
                        'updated_at' => now(),
                    ])
                );
        });
        
        // Invalidate cache
        $cacheKey = 'tenant:branding:' . $tenantDbId->toInt();
        $this->cache->forget($cacheKey);
        
        return true;
        
    } catch (\Exception $e) {
        $this->logger->error('Failed to update tenant branding', [
            'tenant_id' => $tenant->id,
            'error' => $e->getMessage()
        ]);
        
        return false;
    }
}
```

### **Step 2: Run Data Migration NOW**

```bash
# Create and run migration script
php artisan make:command MigrateBrandingData --command=branding:migrate-data
```

```php
// File: app/Console/Commands/MigrateBrandingData.php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Landlord\Domain\Entities\Tenant;
use App\Services\TenantIdentifierResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MigrateBrandingData extends Command
{
    protected $signature = 'branding:migrate-data';
    protected $description = 'Migrate branding data from tenant DBs to landlord DB';
    
    private TenantIdentifierResolver $resolver;
    
    public function __construct(TenantIdentifierResolver $resolver)
    {
        parent::__construct();
        $this->resolver = $resolver;
    }
    
    public function handle()
    {
        $this->info('Starting branding data migration...');
        
        $tenants = Tenant::where('status', 'active')->get();
        $migrated = 0;
        $failed = 0;
        
        foreach ($tenants as $tenant) {
            try {
                $this->migrateTenantBranding($tenant);
                $migrated++;
                $this->info("✓ Migrated: {$tenant->slug}");
            } catch (\Exception $e) {
                $failed++;
                $this->error("✗ Failed: {$tenant->slug} - {$e->getMessage()}");
                Log::error('Branding migration failed', [
                    'tenant' => $tenant->slug,
                    'error' => $e->getMessage()
                ]);
            }
        }
        
        $this->info("Migration complete: {$migrated} succeeded, {$failed} failed");
    }
    
    private function migrateTenantBranding(Tenant $tenant): void
    {
        // Get branding from tenant DB (old system)
        $oldBranding = $this->getBrandingFromTenantDb($tenant);
        
        if (!$oldBranding) {
            return; // No branding to migrate
        }
        
        // Get identifiers for landlord DB
        $tenantSlug = \App\Contexts\Platform\Domain\ValueObjects\TenantSlug::fromString($tenant->slug);
        $tenantDbId = $this->resolver->resolveToDbId($tenantSlug);
        
        if (!$tenantDbId) {
            throw new \RuntimeException('Could not resolve tenant DB ID');
        }
        
        // Insert into landlord DB
        DB::connection('landlord')
            ->table('tenant_brandings')
            ->updateOrInsert(
                [
                    'tenant_db_id' => $tenantDbId->toInt(),
                    'tenant_slug' => $tenantSlug->toString(),
                ],
                [
                    'primary_color' => $oldBranding->primary_color ?? '#3B82F6',
                    'secondary_color' => $oldBranding->secondary_color ?? '#1E40AF',
                    'logo_url' => $oldBranding->logo_url ?? null,
                    'font_family' => $oldBranding->font_family ?? 'Inter, system-ui, sans-serif',
                    'background_color' => $oldBranding->background_color ?? '#FFFFFF',
                    'text_color' => $oldBranding->text_color ?? '#374151',
                    'custom_css' => $oldBranding->custom_css ?? null,
                    'tier' => $oldBranding->tier ?? 'free',
                    'version' => '1.0',
                    'migrated_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
    }
    
    private function getBrandingFromTenantDb(Tenant $tenant): ?object
    {
        try {
            config(['database.connections.tenant_temp.database' => $tenant->database_name]);
            DB::purge('tenant_temp');
            
            // Check if tenant_brandings table exists
            $tableExists = DB::connection('tenant_temp')
                ->getSchemaBuilder()
                ->hasTable('tenant_brandings');
            
            if (!$tableExists) {
                return null;
            }
            
            return DB::connection('tenant_temp')
                ->table('tenant_brandings')
                ->first();
                
        } catch (\Exception $e) {
            Log::warning('Tenant DB not accessible for branding migration', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage()
            ]);
            
            return null;
        }
    }
}
```

### **Step 3: Run Migration Command**

```bash
# Run the migration
php artisan branding:migrate-data

# Expected output:
# Starting branding data migration...
# ✓ Migrated: nrna
# ✓ Migrated: uml
# ✓ Migrated: congress-usa
# Migration complete: 3 succeeded, 0 failed
```

---

# 📚 **TENANT BRANDING IMPLEMENTATION GUIDE**

## **🎯 OVERVIEW**

**Purpose**: Provide white-label branding for tenants (political parties, NGOs, diaspora groups)
**Architecture**: Single source of truth in landlord database
**Access**: Available pre-authentication for login pages, post-authentication for admin

## **🏗️ ARCHITECTURE**

### **Database Schema**
```sql
-- Landlord database (publicdigit_landlord)
CREATE TABLE tenant_brandings (
    id BIGSERIAL PRIMARY KEY,
    tenant_db_id BIGINT NOT NULL,           -- Foreign key to tenants.numeric_id
    tenant_slug VARCHAR(64) UNIQUE NOT NULL, -- Business identifier (nrna, uml, etc.)
    
    -- Branding fields
    primary_color VARCHAR(7) DEFAULT '#3B82F6',
    secondary_color VARCHAR(7) DEFAULT '#1E40AF',
    logo_url TEXT,
    font_family TEXT DEFAULT 'Inter, system-ui, sans-serif',
    background_color VARCHAR(7) DEFAULT '#FFFFFF',
    text_color VARCHAR(7) DEFAULT '#374151',
    custom_css JSONB,
    
    -- Tier management
    tier VARCHAR(20) DEFAULT 'free', -- free, pro, premium
    version VARCHAR(50) DEFAULT '1.0',
    wcag_compliant BOOLEAN DEFAULT false,
    
    -- Metadata
    migrated_at TIMESTAMP,
    last_synced_at TIMESTAMP,
    last_updated_by BIGINT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (tenant_db_id) REFERENCES tenants(numeric_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_tenant_brandings_slug ON tenant_brandings(tenant_slug);
CREATE INDEX idx_tenant_brandings_db_id ON tenant_brandings(tenant_db_id);
CREATE INDEX idx_tenant_brandings_tier ON tenant_brandings(tier);
```

### **Value Objects (DDD)**

```php
// TenantSlug.php - Business identifier
$slug = TenantSlug::fromString('nrna');
$slug = TenantSlug::fromUrl('https://nrna.election.com/login', 'election.com');

// TenantDbId.php - Database identifier  
$dbId = TenantDbId::fromInt(123);
```

### **Services**

#### **TenantIdentifierResolver**
```php
// Maps between TenantSlug (business) and TenantDbId (database)
$resolver = app(TenantIdentifierResolver::class);

// Get database ID from slug
$dbId = $resolver->resolveToDbId(TenantSlug::fromString('nrna'));

// Get slug from database ID  
$slug = $resolver->resolveToSlug(TenantDbId::fromInt(123));

// Resolve from URL
$identifiers = $resolver->resolveFromUrl('https://nrna.election.com/login');
// Returns: ['slug' => TenantSlug, 'db_id' => TenantDbId]
```

#### **TenantBrandingService**
```php
// Main service for branding operations
$service = app(TenantBrandingService::class);

// Get branding (reads from landlord DB)
$branding = $service->getBrandingForTenant($tenant);

// Update branding (writes to landlord DB)
$success = $service->updateBrandingForTenant($tenant, [
    'primary_color' => '#FF0000',
    'logo_url' => 'https://cdn.example.com/logo.png',
]);

// Generate CSS variables
$css = $service->generateCssVariablesFromArray($branding);
```

## **🚀 GETTING STARTED**

### **1. For New Tenants**

```bash
# 1. Create tenant in landlord database
INSERT INTO tenants (slug, name, numeric_id, database_name, status) 
VALUES ('new-party', 'New Political Party', 1001, 'tenant_new_party', 'active');

# 2. Add default branding
INSERT INTO tenant_brandings (tenant_db_id, tenant_slug) 
VALUES (1001, 'new-party');

# 3. Update branding via API or admin panel
```

### **2. For Existing Tenants**

```bash
# 1. Migrate existing branding data
php artisan branding:migrate-data

# 2. Verify migration
php artisan tinker
>>> DB::connection('landlord')->table('tenant_brandings')->count()

# 3. Test login page
curl -H "Host: nrna.localhost" http://localhost/login
```

## **🔧 API ENDPOINTS**

### **Public API (No Authentication)**

```http
GET /api/branding/{tenantSlug}
# Returns branding for login pages
# Response: { "primary_color": "#FF0000", "logo_url": "...", "css": "...variables" }

GET /api/branding/{tenantSlug}/css
# Returns CSS variables only
# Response: ":root { --primary-color: #FF0000; }"
```

### **Admin API (Tenant Authentication Required)**

```http
GET /api/tenant/branding
# Returns current tenant's branding
# Requires: auth:tenant middleware

PUT /api/tenant/branding
# Updates current tenant's branding
# Body: { "primary_color": "#FF0000", "logo_url": "..." }

POST /api/tenant/branding/preview
# Preview changes without saving
# Body: { "primary_color": "#FF0000" }
# Returns: CSS variables for preview
```

## **🎨 FRONTEND INTEGRATION**

### **Vue 3 Composable**

```javascript
// resources/js/composables/useTenantBranding.js
import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

export function useTenantBranding() {
    const page = usePage()
    
    const branding = computed(() => page.props.tenant?.branding || {})
    const cssVariables = computed(() => page.props.tenant?.cssVariables || '')
    
    // Apply CSS variables to document
    const applyBranding = () => {
        const style = document.createElement('style')
        style.id = 'tenant-branding-variables'
        style.textContent = `:root { ${cssVariables.value} }`
        
        // Remove old styles
        const oldStyle = document.getElementById('tenant-branding-variables')
        if (oldStyle) oldStyle.remove()
        
        document.head.appendChild(style)
    }
    
    return { branding, cssVariables, applyBranding }
}
```

### **Usage in Components**

```vue
<template>
  <div :style="{ '--primary-color': branding.primary_color }" class="tenant-themed">
    <img v-if="branding.logo_url" :src="branding.logo_url" :alt="tenant.name">
    <h1 :style="{ color: branding.primary_color }">
      Welcome to {{ tenant.name }}
    </h1>
  </div>
</template>

<script setup>
import { useTenantBranding } from '@/composables/useTenantBranding'
import { usePage } from '@inertiajs/vue3'

const { branding, applyBranding } = useTenantBranding()
const { tenant } = usePage().props

onMounted(() => {
  applyBranding()
})
</script>
```

## **⚙️ CONFIGURATION**

### **Environment Variables**
```env
# Branding System
BRANDING_CACHE_TTL=3600
BRANDING_CACHE_PREFIX=tenant:branding:
BRANDING_DEFAULT_PRIMARY_COLOR=#3B82F6
BRANDING_DEFAULT_SECONDARY_COLOR=#1E40AF
```

### **Cache Configuration**
```php
// config/cache.php
'stores' => [
    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
        'lock_connection' => 'default',
    ],
],

// Branding cache keys
'branding' => [
    'ttl' => env('BRANDING_CACHE_TTL', 3600),
    'prefix' => env('BRANDING_CACHE_PREFIX', 'tenant:branding:'),
],
```

## **🔐 SECURITY CONSIDERATIONS**

### **Tenant Enumeration Protection**
```php
// 1. Negative caching (5 minutes for "not found")
Cache::put('tenant:slug:nonexistent', null, 300);

// 2. Uniform response timing
usleep(100000); // 100ms delay for all responses

// 3. Generic error messages
// Never reveal "tenant does not exist"
```

### **CSS Injection Prevention**
```php
// Sanitize CSS values in TenantBrandingService
private function sanitizeCssValue(string $value): string
{
    // Remove dangerous characters
    $value = strip_tags($value);
    $value = preg_replace('/[^a-zA-Z0-9#\s,()\-.]/', '', $value);
    
    // Validate color format
    if (str_starts_with($value, '#')) {
        if (!preg_match('/^#[0-9A-F]{6}$/i', $value)) {
            return '#3B82F6'; // Fallback to safe color
        }
    }
    
    return $value;
}
```

## **📊 MONITORING & METRICS**

### **Key Metrics**
```bash
# Cache hit rate
redis-cli info stats | grep -E "(keyspace_hits|keyspace_misses)"

# Database queries
tail -f storage/logs/laravel.log | grep "tenant_brandings"

# Tenant resolution
grep "TenantIdentifierResolver" storage/logs/laravel.log
```

### **Health Checks**
```php
// Health check endpoint
Route::get('/health/branding', function () {
    return [
        'landlord_db' => DB::connection('landlord')->getPdo() !== null,
        'cache' => Cache::getDefaultDriver(),
        'tenants_with_branding' => DB::connection('landlord')
            ->table('tenant_brandings')
            ->count(),
        'last_sync' => DB::connection('landlord')
            ->table('tenant_brandings')
            ->max('updated_at'),
    ];
});
```

## **🚨 TROUBLESHOOTING**

### **Common Issues**

#### **1. Login Page Shows Default Branding**
```bash
# Check tenant exists in landlord DB
php artisan tinker
>>> DB::connection('landlord')->table('tenants')->where('slug', 'nrna')->first()

# Check branding exists
>>> DB::connection('landlord')->table('tenant_brandings')->where('tenant_slug', 'nrna')->first()

# Clear cache
php artisan cache:clear --tags=branding
```

#### **2. CSS Variables Not Applying**
```javascript
// Check browser console for CSS errors
// Verify CSS variables are in DOM
document.querySelector('style#tenant-branding-variables')

// Check Inertia shared data
console.log(window.Inertia.page.props.tenant)
```

#### **3. API Endpoints Return 404**
```bash
# Check route registration
php artisan route:list | grep branding

# Check middleware registration
# In bootstrap/app.php: $app->middleware([SetTenantContext::class])
```

### **Debug Commands**
```bash
# Debug tenant resolution
php artisan tinker
>>> $resolver = app(TenantIdentifierResolver::class)
>>> $resolver->resolveFromUrl('https://nrna.election.com/login')

# Debug branding data
>>> $service = app(TenantBrandingService::class)
>>> $tenant = Tenant::where('slug', 'nrna')->first()
>>> $service->getBrandingForTenant($tenant)

# Check cache
redis-cli keys "tenant:branding:*"
```

## **🔄 MIGRATION FROM OLD SYSTEM**

### **Migration Steps**
1. **Phase 1**: Deploy new landlord database table
2. **Phase 2**: Run `php artisan branding:migrate-data`
3. **Phase 3**: Update `TenantBrandingService` to use landlord DB
4. **Phase 4**: Update `SetTenantContext` middleware
5. **Phase 5**: Remove tenant database branding tables (optional)

### **Rollback Plan**
```sql
-- Rollback SQL (if needed)
-- 1. Copy data back to tenant databases
INSERT INTO tenant_{slug}.tenant_brandings SELECT * FROM landlord.tenant_brandings;

-- 2. Switch service back to tenant DB
-- Update TenantBrandingService::getBrandingForTenant() to query tenant DB
```

## **📈 PERFORMANCE OPTIMIZATION**

### **Caching Strategy**
```php
// Three-level caching
1. Tenant slug → ID mapping (1 hour TTL)
2. Branding data per tenant (1 hour TTL)  
3. CSS variables generation (1 hour TTL)

// Cache invalidation on:
// - Branding updates
// - Tenant status changes
// - Manual cache clear
```

### **Database Optimization**
```sql
-- Ensure indexes exist
EXPLAIN ANALYZE 
SELECT * FROM tenant_brandings 
WHERE tenant_slug = 'nrna';

-- Monitor query performance
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes 
WHERE tablename = 'tenant_brandings';
```

## **🎯 BEST PRACTICES**

### **For Developers**
1. Always use `TenantIdentifierResolver` for slug↔ID mapping
2. Cache all branding queries (1 hour TTL minimum)
3. Validate all CSS values before insertion
4. Log all branding changes for audit trail

### **For Administrators**
1. Test branding changes on staging first
2. Use preview feature before applying changes
3. Monitor cache hit rates regularly
4. Set up alerts for failed branding updates

### **For Product Managers**
1. Tier-based feature rollout:
   - Free: Default colors only
   - Pro: Custom colors + logo
   - Premium: Full branding + CSS customization
2. A/B test branding changes
3. Track tenant adoption metrics

---

## **✅ COMPLETION CHECKLIST**

### **Immediate (Today)**
- [ ] Update `TenantBrandingService` to use landlord DB
- [ ] Run `php artisan branding:migrate-data`
- [ ] Test login page branding works
- [ ] Verify no tenant enumeration vulnerabilities

### **Short-term (This Week)**
- [ ] Create API endpoints for branding management
- [ ] Update Vue components to use new API
- [ ] Add monitoring and alerts
- [ ] Create admin dashboard for branding management

### **Long-term (This Month)**
- [ ] Implement tier-based feature restrictions
- [ ] Add WCAG compliance validation
- [ ] Create branding template system
- [ ] Add multi-brand support per tenant

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-05  
**Status**: ✅ **Day 1 Complete**, **Architecture Fixed**  
**Next Action**: Run data migration and test login pages