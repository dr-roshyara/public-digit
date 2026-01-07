# 🏗️ **CURRENT DEVELOPMENT SCENARIO: Dual-System Architecture**

## **📊 CURRENT STATE ANALYSIS**

### **You Have TWO Parallel Systems Running:**
```
┌─────────────────────────────────────┐
│          CURRENT ARCHITECTURE       │
├─────────────────────────────────────┤
│ 1. TENANT DATABASES (Legacy/Active) │
│    • tenant_brandings table         │
│    • TenantBrandingService queries  │
│    • Vue components use this        │
│    ❌ Login pages can't access      │
├─────────────────────────────────────┤
│ 2. LANDLORD DATABASE (New/Active)   │
│    • tenant_brandings table         │
│    • SetTenantContext middleware    │
│    • Login pages use this           │
│    ✅ Works without authentication  │
└─────────────────────────────────────┘
```

## **🎯 IMMEDIATE GOAL: Make TenantBrandingService Work with Both Systems**

---

## **🔧 STEP 1: Create DUAL-READ TenantBrandingService**

```php
<?php

declare(strict_types=1);

namespace App\Contexts\TenantAuth\Application\Services;

use App\Landlord\Domain\Entities\Tenant;
use App\Services\TenantIdentifierResolver;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Psr\Log\LoggerInterface;

/**
 * DUAL-READ TenantBrandingService
 * 
 * Strategy:
 * 1. FIRST try landlord DB (for login pages, public access)
 * 2. FALLBACK to tenant DB (for admin interfaces, backward compatibility)
 * 3. Eventual sync between both systems
 */
class DualReadTenantBrandingService
{
    private const CACHE_TTL = 3600;
    private const CACHE_PREFIX = 'branding:dual:';
    
    public function __construct(
        private CacheRepository $cache,
        private LoggerInterface $logger,
        private TenantIdentifierResolver $tenantResolver
    ) {}
    
    /**
     * SMART GET: Try landlord first, fallback to tenant DB
     */
    public function getBrandingForTenant(Tenant $tenant): array
    {
        $cacheKey = self::CACHE_PREFIX . 'tenant:' . $tenant->id;
        
        return $this->cache->remember($cacheKey, self::CACHE_TTL, function () use ($tenant) {
            // PHASE 1: Try landlord DB (new system)
            $landlordBranding = $this->getFromLandlordDb($tenant);
            
            if ($landlordBranding && $this->isValidBranding($landlordBranding)) {
                $this->logger->debug('Using landlord DB branding', ['tenant' => $tenant->slug]);
                return $landlordBranding;
            }
            
            // PHASE 2: Fallback to tenant DB (legacy system)
            $tenantBranding = $this->getFromTenantDb($tenant);
            
            if ($tenantBranding) {
                // ASYNC SYNC: Queue job to sync to landlord DB
                dispatch(new SyncBrandingToLandlordJob($tenant->id, $tenantBranding));
                
                $this->logger->debug('Using tenant DB branding (fallback)', ['tenant' => $tenant->slug]);
                return $tenantBranding;
            }
            
            // PHASE 3: Return defaults
            $this->logger->debug('Using default branding', ['tenant' => $tenant->slug]);
            return $this->getDefaultBranding($tenant);
        });
    }
    
    /**
     * DUAL-WRITE: Write to both systems
     */
    public function updateBrandingForTenant(Tenant $tenant, array $data): bool
    {
        try {
            // 1. Validate data
            $validatedData = $this->validateBrandingData($data);
            
            // 2. Write to TENANT DB (immediate, for existing UI)
            $tenantDbSuccess = $this->updateTenantDb($tenant, $validatedData);
            
            if (!$tenantDbSuccess) {
                throw new \RuntimeException('Failed to update tenant DB');
            }
            
            // 3. Write to LANDLORD DB (immediate, for login pages)
            $landlordDbSuccess = $this->updateLandlordDb($tenant, $validatedData);
            
            if (!$landlordDbSuccess) {
                $this->logger->warning('Landlord DB update failed, but tenant DB succeeded', [
                    'tenant' => $tenant->slug
                ]);
                // Continue - tenant DB is primary source of truth during transition
            }
            
            // 4. Invalidate cache
            $this->invalidateCache($tenant);
            
            // 5. Dispatch sync job to ensure consistency
            dispatch(new EnsureBrandingConsistencyJob($tenant->id));
            
            return true;
            
        } catch (\Exception $e) {
            $this->logger->error('Dual-write branding update failed', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage()
            ]);
            
            return false;
        }
    }
    
    /**
     * Get from landlord DB (new system)
     */
    private function getFromLandlordDb(Tenant $tenant): ?array
    {
        try {
            // Convert to TenantDbId
            $tenantSlug = TenantSlug::fromString($tenant->slug);
            $tenantDbId = $this->tenantResolver->resolveToDbId($tenantSlug);
            
            if (!$tenantDbId) {
                return null;
            }
            
            $branding = DB::connection('landlord')
                ->table('tenant_brandings')
                ->where('tenant_db_id', $tenantDbId->toInt())
                ->first();
            
            return $branding ? (array) $branding : null;
            
        } catch (\Exception $e) {
            $this->logger->warning('Failed to read from landlord DB', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage()
            ]);
            
            return null;
        }
    }
    
    /**
     * Get from tenant DB (legacy system)
     */
    private function getFromTenantDb(Tenant $tenant): ?array
    {
        try {
            // Switch to tenant database
            config(['database.connections.tenant_temp.database' => $tenant->database_name]);
            DB::purge('tenant_temp');
            
            $branding = DB::connection('tenant_temp')
                ->table('tenant_brandings')
                ->first();
            
            return $branding ? (array) $branding : null;
            
        } catch (\Exception $e) {
            $this->logger->warning('Failed to read from tenant DB', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage()
            ]);
            
            return null;
        }
    }
    
    /**
     * Update tenant DB (legacy system)
     */
    private function updateTenantDb(Tenant $tenant, array $data): bool
    {
        try {
            config(['database.connections.tenant_temp.database' => $tenant->database_name]);
            DB::purge('tenant_temp');
            
            return DB::connection('tenant_temp')
                ->table('tenant_brandings')
                ->updateOrInsert(['id' => 1], $data) > 0;
            
        } catch (\Exception $e) {
            $this->logger->error('Failed to update tenant DB', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage()
            ]);
            
            return false;
        }
    }
    
    /**
     * Update landlord DB (new system)
     */
    private function updateLandlordDb(Tenant $tenant, array $data): bool
    {
        try {
            $tenantSlug = TenantSlug::fromString($tenant->slug);
            $tenantDbId = $this->tenantResolver->resolveToDbId($tenantSlug);
            
            if (!$tenantDbId) {
                throw new \RuntimeException('Could not resolve tenant to DB ID');
            }
            
            return DB::connection('landlord')
                ->table('tenant_brandings')
                ->updateOrInsert(
                    [
                        'tenant_db_id' => $tenantDbId->toInt(),
                        'tenant_slug' => $tenantSlug->toString(),
                    ],
                    array_merge($data, [
                        'version' => '2.0',
                        'updated_at' => now(),
                    ])
                ) > 0;
            
        } catch (\Exception $e) {
            $this->logger->error('Failed to update landlord DB', [
                'tenant' => $tenant->slug,
                'error' => $e->getMessage()
            ]);
            
            return false;
        }
    }
}
```

---

## **🔄 STEP 2: Create Sync Jobs for Consistency**

```php
<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Landlord\Domain\Entities\Tenant;
use App\Services\TenantIdentifierResolver;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Sync branding from tenant DB → landlord DB
 * Runs when tenant DB has newer data
 */
class SyncBrandingToLandlordJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public function __construct(
        private string $tenantId,
        private array $brandingData
    ) {}
    
    public function handle(TenantIdentifierResolver $resolver): void
    {
        try {
            $tenant = Tenant::find($this->tenantId);
            
            if (!$tenant) {
                Log::warning('Tenant not found for sync job', ['tenant_id' => $this->tenantId]);
                return;
            }
            
            $tenantSlug = TenantSlug::fromString($tenant->slug);
            $tenantDbId = $resolver->resolveToDbId($tenantSlug);
            
            if (!$tenantDbId) {
                Log::warning('Could not resolve tenant DB ID for sync', ['tenant' => $tenant->slug]);
                return;
            }
            
            DB::connection('landlord')
                ->table('tenant_brandings')
                ->updateOrInsert(
                    [
                        'tenant_db_id' => $tenantDbId->toInt(),
                        'tenant_slug' => $tenantSlug->toString(),
                    ],
                    array_merge($this->brandingData, [
                        'synced_at' => now(),
                        'source' => 'tenant_db_sync',
                    ])
                );
            
            Log::info('Branding synced to landlord DB', [
                'tenant' => $tenant->slug,
                'db_id' => $tenantDbId->toInt(),
            ]);
            
        } catch (\Exception $e) {
            Log::error('Failed to sync branding to landlord DB', [
                'tenant_id' => $this->tenantId,
                'error' => $e->getMessage(),
            ]);
            
            // Retry with exponential backoff
            $this->release(60 * $this->attempts());
        }
    }
}
```

```php
<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Landlord\Domain\Entities\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Ensure both databases have consistent branding
 * Runs periodically and on demand
 */
class EnsureBrandingConsistencyJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public function __construct(private string $tenantId) {}
    
    public function handle(): void
    {
        try {
            $tenant = Tenant::find($this->tenantId);
            
            if (!$tenant) {
                return;
            }
            
            // Get from both sources
            $tenantBranding = $this->getFromTenantDb($tenant);
            $landlordBranding = $this->getFromLandlordDb($tenant);
            
            // Compare timestamps
            $tenantUpdated = $tenantBranding['updated_at'] ?? null;
            $landlordUpdated = $landlordBranding['updated_at'] ?? null;
            
            // Resolve conflicts (newest wins)
            if ($tenantUpdated && $landlordUpdated) {
                if ($tenantUpdated > $landlordUpdated) {
                    // Tenant DB has newer data → sync to landlord
                    dispatch(new SyncBrandingToLandlordJob($tenant->id, $tenantBranding));
                } elseif ($landlordUpdated > $tenantUpdated) {
                    // Landlord DB has newer data → sync to tenant
                    dispatch(new SyncBrandingToTenantDbJob($tenant->id, $landlordBranding));
                }
            } elseif ($tenantUpdated && !$landlordUpdated) {
                // Only tenant has data → sync to landlord
                dispatch(new SyncBrandingToLandlordJob($tenant->id, $tenantBranding));
            } elseif (!$tenantUpdated && $landlordUpdated) {
                // Only landlord has data → sync to tenant
                dispatch(new SyncBrandingToTenantDbJob($tenant->id, $landlordBranding));
            }
            
        } catch (\Exception $e) {
            Log::error('Branding consistency check failed', [
                'tenant_id' => $this->tenantId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
```

---

## **⚙️ STEP 3: Update Service Container**

```php
// File: app/Providers/AppServiceProvider.php

public function register(): void
{
    // Bind the new dual-read service
    $this->app->singleton(TenantBrandingService::class, function ($app) {
        return new DualReadTenantBrandingService(
            $app->make(CacheRepository::class),
            $app->make(LoggerInterface::class),
            $app->make(TenantIdentifierResolver::class)
        );
    });
    
    // Alias for backward compatibility
    $this->app->alias(TenantBrandingService::class, 'tenant.branding.service');
}
```

---

## **🎨 STEP 4: Update Vue Components (If Needed)**

```vue
<!-- File: resources/js/Pages/Contexts/TenantAuth/Tenant/Branding/Edit.vue -->
<template>
    <div>
        <h2>Branding Configuration</h2>
        <p class="text-sm text-gray-600">
            <span v-if="isUsingLandlordDb" class="text-green-600">
                ✅ Using new system (landlord database)
            </span>
            <span v-else class="text-yellow-600">
                ⚠️ Using legacy system (tenant database) - update pending
            </span>
        </p>
        
        <!-- Rest of your form stays the same -->
        <!-- The API calls will use the dual-write service -->
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    branding: Object,
    tenant: Object
})

// Detect which system is being used
const isUsingLandlordDb = computed(() => {
    return props.branding?.version === '2.0' || props.branding?.synced_at
})
</script>
```

---

## **📊 STEP 5: Create Migration Dashboard**

```php
// File: app/Http/Controllers/Admin/BrandingMigrationController.php

class BrandingMigrationController extends Controller
{
    public function dashboard()
    {
        $tenants = DB::connection('landlord')
            ->table('tenants')
            ->where('status', 'active')
            ->get(['id', 'slug', 'numeric_id', 'database_name']);
        
        $migrationStatus = [];
        
        foreach ($tenants as $tenant) {
            $migrationStatus[] = [
                'tenant' => $tenant->slug,
                'tenant_db' => $this->hasTenantDbBranding($tenant),
                'landlord_db' => $this->hasLandlordDbBranding($tenant),
                'last_synced' => $this->getLastSyncTime($tenant),
                'consistent' => $this->isConsistent($tenant),
            ];
        }
        
        return view('admin.branding-migration', [
            'status' => $migrationStatus,
            'summary' => $this->calculateSummary($migrationStatus),
        ]);
    }
    
    public function syncTenant(string $tenantSlug)
    {
        $tenant = Tenant::where('slug', $tenantSlug)->first();
        
        if (!$tenant) {
            return back()->with('error', 'Tenant not found');
        }
        
        // Force sync
        dispatch(new EnsureBrandingConsistencyJob($tenant->id));
        
        return back()->with('success', 'Sync job dispatched for ' . $tenantSlug);
    }
    
    public function forceLandlordDb(string $tenantSlug)
    {
        // Force use landlord DB only (for testing)
        Cache::put('branding:force:landlord:' . $tenantSlug, true, 3600);
        
        return back()->with('success', 'Forced landlord DB mode for ' . $tenantSlug);
    }
}
```

---

## **🔧 STEP 6: Configuration & Feature Flags**

```php
// File: config/branding.php
<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Branding System Configuration
    |--------------------------------------------------------------------------
    |
    | Controls the dual-system architecture during migration
    |
    */
    
    'dual_system' => [
        'enabled' => env('BRANDING_DUAL_SYSTEM_ENABLED', true),
        
        // Read strategy: 'landlord_first' or 'tenant_first'
        'read_strategy' => env('BRANDING_READ_STRATEGY', 'landlord_first'),
        
        // Write strategy: 'both' or 'landlord_only' or 'tenant_only'
        'write_strategy' => env('BRANDING_WRITE_STRATEGY', 'both'),
        
        // Auto-sync interval in minutes
        'sync_interval' => env('BRANDING_SYNC_INTERVAL', 5),
        
        // Tenant-specific overrides
        'overrides' => [
            // 'tenant-slug' => ['read_strategy' => 'tenant_first'],
        ],
    ],
    
    'cache' => [
        'ttl' => env('BRANDING_CACHE_TTL', 3600),
        'prefix' => env('BRANDING_CACHE_PREFIX', 'branding:'),
    ],
];
```

---

## **🚀 STEP 7: Deployment Strategy**

### **Phase A: Dual-System Rollout**
```bash
# 1. Deploy DualReadTenantBrandingService
# 2. Enable read from landlord DB
# 3. Write to both systems
# 4. Monitor for inconsistencies

# Commands:
php artisan migrate --database=landlord
php artisan queue:restart  # For sync jobs
php artisan config:cache
```

### **Phase B: Gradual Tenant Migration**
```bash
# Migrate tenants in batches:
# 1. Low-risk tenants first (test tenants)
# 2. Small tenants
# 3. Large tenants during off-hours

# Migration command per tenant:
php artisan branding:migrate-tenant {tenant-slug}
```

### **Phase C: Cutover**
```bash
# When all tenants are consistent:
# 1. Switch read strategy to 'landlord_only'
# 2. Switch write strategy to 'landlord_only'
# 3. Disable tenant DB writes
# 4. Archive tenant branding tables
```

---

## **📋 MONITORING & ALERTS**

### **Key Metrics to Monitor:**
```php
$metrics = [
    'read_source' => [
        'landlord_db' => Cache::increment('metrics:branding:read:landlord'),
        'tenant_db' => Cache::increment('metrics:branding:read:tenant'),
        'default' => Cache::increment('metrics:branding:read:default'),
    ],
    
    'write_success' => [
        'both' => Cache::increment('metrics:branding:write:both'),
        'landlord_only' => Cache::increment('metrics:branding:write:landlord'),
        'tenant_only' => Cache::increment('metrics:branding:write:tenant'),
        'failed' => Cache::increment('metrics:branding:write:failed'),
    ],
    
    'consistency' => [
        'in_sync' => Cache::increment('metrics:branding:sync:consistent'),
        'out_of_sync' => Cache::increment('metrics:branding:sync:inconsistent'),
        'sync_jobs' => Cache::increment('metrics:branding:sync:jobs'),
    ],
];
```

### **Alerts to Configure:**
1. **High tenant DB reads** (> 20% after migration)
2. **Write failures** to either database
3. **Consistency check failures**
4. **Sync job backlog** (> 100 pending jobs)

---

## **✅ SUCCESS CRITERIA**

### **Immediate (Week 1):**
- [ ] Login pages work with landlord DB
- [ ] Admin interfaces work with dual-write
- [ ] No breaking changes to existing UI
- [ ] Sync jobs running successfully

### **Short-term (Week 2-3):**
- [ ] > 80% reads from landlord DB
- [ ] < 5% inconsistency rate
- [ ] All tenants have data in both systems
- [ ] Monitoring dashboard operational

### **Long-term (Week 4+):**
- [ ] 100% reads from landlord DB
- [ ] 0% inconsistency rate
- [ ] Tenant DB tables can be archived
- [ ] Performance improved by 50%

---

## **🆘 TROUBLESHOOTING**

### **Common Issues & Fixes:**

#### **1. Tenant DB Connection Failures**
```php
// In DualReadTenantBrandingService:
private function getFromTenantDb(Tenant $tenant): ?array
{
    try {
        // ... existing code
    } catch (\Exception $e) {
        // Log and return null - system will use landlord or defaults
        $this->logger->warning('Tenant DB unavailable', [
            'tenant' => $tenant->slug,
            'error' => $e->getMessage()
        ]);
        
        // Mark tenant as "landlord only" for 1 hour
        Cache::put('branding:tenant_unavailable:' . $tenant->slug, true, 3600);
        
        return null;
    }
}
```

#### **2. Data Inconsistency**
```bash
# Force resync for a tenant
php artisan tinker

>>> $tenant = Tenant::where('slug', 'problem-tenant')->first();
>>> dispatch(new EnsureBrandingConsistencyJob($tenant->id));
```

#### **3. Cache Issues**
```bash
# Clear branding cache
php artisan cache:clear --tags=branding

# Or per-tenant
php artisan cache:forget "branding:dual:tenant:{tenant-id}"
```

---

## **🎯 IMMEDIATE NEXT STEPS**

1. **Implement `DualReadTenantBrandingService`** (2-3 hours)
2. **Create sync jobs** (1-2 hours)
3. **Update service container bindings** (30 minutes)
4. **Deploy and monitor** (1 hour)
5. **Create migration dashboard** (2-3 hours)

**Estimated Total: 7-10 hours**

---

**This approach gives you:**  
✅ **Immediate fix** for login pages (landlord DB)  
✅ **No breaking changes** for admin interfaces (dual-write)  
✅ **Gradual migration path** with rollback capability  
✅ **Monitoring and consistency checks**  
✅ **Production-safe deployment**

**Ready to implement the dual-read service?**