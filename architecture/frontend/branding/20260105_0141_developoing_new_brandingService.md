# 🧹 **LEGACY CLEANUP & NEW BRANDING ARCHITECTURE ROADMAP**

## **🎯 PHASED APPROACH: 3-Phase Migration**

### **PHASE 1: LEGACY CLEANUP (Week 1-2)**
### **PHASE 2: NEW BRANDING SERVICE (Week 3-4)**
### **PHASE 3: FULL MIGRATION (Week 5-6)**

---

## **🚀 PHASE 1: LEGACY CLEANUP (IMMEDIATE)**

### **Step 1: Deprecate TenantBrandingService Tenant DB Methods**
```php
// File: app/Contexts/TenantAuth/Application/Services/TenantBrandingService.php

/**
 * @deprecated 2026-01-05 Use LandlordBrandingService instead
 * This method queries tenant databases which violates new architecture
 */
public function getBrandingForTenant(Tenant $tenant): array
{
    trigger_error(
        'Method ' . __METHOD__ . ' is deprecated. Use LandlordBrandingService::getBrandingBySlug()',
        E_USER_DEPRECATED
    );
    
    // Keep working for backward compatibility during transition
    return $this->getBrandingForTenantInternal($tenant);
}

/**
 * @deprecated 2026-01-05 Use LandlordBrandingService::updateBranding() instead
 */
public function updateBrandingForTenant(Tenant $tenant, array $data): bool
{
    trigger_error(
        'Method ' . __METHOD__ . ' is deprecated. Use LandlordBrandingService::updateBranding()',
        E_USER_DEPRECATED
    );
    
    return $this->updateBrandingForTenantInternal($tenant, $data);
}
```

### **Step 2: Update All Callers**
```bash
# Find all usages of TenantBrandingService tenant DB methods
grep -r "getBrandingForTenant\|updateBrandingForTenant" \
  --include="*.php" \
  packages/laravel-backend/app/

# Update SetTenantContext middleware to use landlord methods
# Update Vue components to use new API endpoints
```

### **Step 3: Create Data Migration Script**
```php
// File: database/scripts/migrate_branding_data.php
<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Services\TenantIdentifierResolver;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;

class MigrateBrandingData
{
    public function run(bool $dryRun = true): MigrationReport
    {
        $report = new MigrationReport();
        
        $tenants = DB::connection('landlord')
            ->table('tenants')
            ->where('status', 'active')
            ->get(['numeric_id', 'slug', 'database_name']);
        
        foreach ($tenants as $tenant) {
            $this->migrateTenant($tenant, $dryRun, $report);
        }
        
        return $report;
    }
    
    private function migrateTenant(object $tenant, bool $dryRun, MigrationReport $report): void
    {
        try {
            // 1. Get branding from tenant database (old)
            $oldBranding = $this->getOldBranding($tenant->database_name);
            
            if (!$oldBranding) {
                $report->addSkipped($tenant->slug, 'No branding in tenant DB');
                return;
            }
            
            // 2. Transform to new format
            $newBranding = $this->transformBranding($oldBranding);
            
            // 3. Save to landlord DB (new)
            if (!$dryRun) {
                DB::connection('landlord')
                    ->table('tenant_brandings')
                    ->updateOrInsert(
                        ['tenant_slug' => $tenant->slug],
                        array_merge($newBranding, [
                            'tenant_db_id' => $tenant->numeric_id,
                            'version' => '2.0',
                            'migrated_at' => now(),
                        ])
                    );
            }
            
            $report->addSuccess($tenant->slug, $oldBranding, $newBranding);
            
        } catch (Exception $e) {
            $report->addError($tenant->slug, $e->getMessage());
        }
    }
}
```

---

## **🏗️ PHASE 2: NEW BRANDING SERVICE**

### **Step 1: Create LandlordBrandingService**
```php
// File: app/Contexts/Platform/Application/Services/LandlordBrandingService.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Application\Services;

use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use App\Contexts\Platform\Domain\Branding\ThemeConfig;
use App\Contexts\Platform\Domain\Branding\ColorScheme;
use App\Contexts\Platform\Domain\Branding\Typography;
use App\Contexts\Platform\Domain\Exceptions\InvalidThemeException;
use App\Contexts\Platform\Domain\Exceptions\TierRestrictionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Psr\Log\LoggerInterface;

/**
 * LandlordBrandingService - Pure landlord DB operations
 * No tenant database dependencies
 */
class LandlordBrandingService
{
    private const CACHE_TTL = 3600;
    private const CACHE_PREFIX = 'branding:landlord:';
    
    public function __construct(
        private CacheRepository $cache,
        private LoggerInterface $logger
    ) {}
    
    /**
     * Get branding for tenant slug (login page use case)
     */
    public function getBrandingBySlug(TenantSlug $slug): ThemeConfig
    {
        $cacheKey = self::CACHE_PREFIX . 'slug:' . $slug->toString();
        
        $data = $this->cache->remember($cacheKey, self::CACHE_TTL, function () use ($slug) {
            $branding = DB::connection('landlord')
                ->table('tenant_brandings')
                ->where('tenant_slug', $slug->toString())
                ->first();
            
            return $branding ? (array) $branding : $this->getDefaultBranding($slug);
        });
        
        return ThemeConfig::fromArray($data);
    }
    
    /**
     * Get branding for tenant database ID (authenticated use case)
     */
    public function getBrandingByDbId(TenantDbId $dbId): ThemeConfig
    {
        $cacheKey = self::CACHE_PREFIX . 'dbid:' . $dbId->toInt();
        
        $data = $this->cache->remember($cacheKey, self::CACHE_TTL, function () use ($dbId) {
            $branding = DB::connection('landlord')
                ->table('tenant_brandings')
                ->where('tenant_db_id', $dbId->toInt())
                ->first();
            
            return $branding ? (array) $branding : $this->getDefaultBrandingForId($dbId);
        });
        
        return ThemeConfig::fromArray($data);
    }
    
    /**
     * Update branding with tier restrictions
     */
    public function updateBranding(TenantSlug $slug, ThemeConfig $theme): void
    {
        // Validate tier restrictions
        $currentBranding = $this->getBrandingBySlug($slug);
        $this->validateTierUpgrade($currentBranding->getTier(), $theme->getTier());
        
        DB::connection('landlord')->transaction(function () use ($slug, $theme) {
            // Update in landlord DB
            DB::connection('landlord')
                ->table('tenant_brandings')
                ->updateOrInsert(
                    ['tenant_slug' => $slug->toString()],
                    array_merge($theme->toArray(), [
                        'version' => $this->generateVersion(),
                        'updated_at' => now(),
                    ])
                );
            
            // Invalidate cache
            $this->cache->forget(self::CACHE_PREFIX . 'slug:' . $slug->toString());
            
            // Also invalidate by DB ID if we have it
            $dbId = app(TenantIdentifierResolver::class)->resolveToDbId($slug);
            if ($dbId) {
                $this->cache->forget(self::CACHE_PREFIX . 'dbid:' . $dbId->toInt());
            }
        });
    }
    
    /**
     * Generate CSS variables from theme
     */
    public function generateCssVariables(ThemeConfig $theme): string
    {
        return $theme->toCssVariables();
    }
}
```

### **Step 2: Create Domain Value Objects**
```php
// File: app/Contexts/Platform/Domain/Branding/ThemeConfig.php
// File: app/Contexts/Platform/Domain/Branding/ColorScheme.php  
// File: app/Contexts/Platform/Domain/Branding/Typography.php
// File: app/Contexts/Platform/Domain/Branding/LayoutConfig.php

// These are pure domain objects with business logic:
// - WCAG compliance validation
// - Tier restriction enforcement
// - Color contrast validation
// - Font family validation
```

### **Step 3: Create API Controllers**
```php
// File: app/Http/Controllers/Platform/BrandingController.php (Platform admin)
// File: app/Http/Controllers/Tenant/BrandingController.php (Tenant admin)
// File: app/Http/Controllers/Public/BrandingController.php (Login page access)
```

### **Step 4: Update Middleware**
```php
// Update SetTenantContext to use LandlordBrandingService
private function getBrandingForTenant(TenantDbId $dbId): ThemeConfig
{
    return app(LandlordBrandingService::class)->getBrandingByDbId($dbId);
}
```

---

## **🔄 PHASE 3: FULL MIGRATION**

### **Step 1: Remove Tenant Database Branding Tables**
```php
// Create migration to drop tenant_brandings from ALL tenant databases
// Must run after confirming all data is migrated

// File: database/migrations/tenant/2026_01_XX_drop_tenant_brandings_table.php
class DropTenantBrandingsTable extends Migration
{
    public function up(): void
    {
        // This runs in EACH tenant database
        Schema::dropIfExists('tenant_brandings');
    }
}
```

### **Step 2: Remove TenantBrandingService**
```php
// 1. Update composer.json to remove service from autoload
// 2. Delete the file
// 3. Update service container bindings
// 4. Remove all deprecated method stubs
```

### **Step 3: Update Vue Components**
```vue
<!-- File: resources/js/Pages/Contexts/TenantAuth/Tenant/Branding/Edit.vue -->
<!-- Use new API endpoints and LandlordBrandingService -->
```

### **Step 4: Update Angular Mobile App**
```typescript
// File: ionic-angular-project/src/app/services/branding.service.ts
// Use new landlord API endpoints
```

---

## **📋 CONCRETE ACTION PLAN**

### **Week 1: Preparation**
```bash
# Day 1-2: Deprecation warnings
# Day 3-4: Data migration script
# Day 5: Test migration on staging
```

### **Week 2: New Service Development**
```bash
# Day 6-7: LandlordBrandingService + Domain objects
# Day 8-9: API controllers + tests
# Day 10: Update middleware
```

### **Week 3: Migration Execution**
```bash
# Day 11: Run data migration (off-hours)
# Day 12: Verify data integrity
# Day 13: Update frontend components
# Day 14: Monitor for issues
```

### **Week 4: Cleanup**
```bash
# Day 15: Remove old tables
# Day 16: Remove TenantBrandingService
# Day 17: Update documentation
# Day 18: Final testing
```

---

## **🔧 TECHNICAL SPECIFICS**

### **New Database Schema (Enhanced)**
```sql
-- Enhanced landlord.tenant_brandings table
ALTER TABLE tenant_brandings ADD COLUMN IF NOT EXISTS tier_features JSONB DEFAULT '{}';
ALTER TABLE tenant_brandings ADD COLUMN IF NOT EXISTS wcag_compliance JSONB DEFAULT '{}';
ALTER TABLE tenant_brandings ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]';

-- New table for theme versions (rollback support)
CREATE TABLE tenant_branding_versions (
    id BIGSERIAL PRIMARY KEY,
    tenant_slug VARCHAR(64) NOT NULL,
    version VARCHAR(50) NOT NULL,
    theme_config JSONB NOT NULL,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_tenant_versions (tenant_slug, version)
);
```

### **New API Endpoints**
```
# Public API (login pages)
GET    /api/public/branding/{tenantSlug}          # Get branding for tenant
GET    /api/public/branding/{tenantSlug}/css      # Get CSS variables

# Tenant Admin API (authenticated)
GET    /api/tenant/branding                       # Get tenant's own branding
PUT    /api/tenant/branding                       # Update branding
POST   /api/tenant/branding/preview               # Preview changes
GET    /api/tenant/branding/versions              # Version history
POST   /api/tenant/branding/rollback/{version}    # Rollback to version

# Platform Admin API
GET    /api/platform/branding                     # List all tenant branding
GET    /api/platform/branding/{tenantSlug}        # Get specific tenant
PUT    /api/platform/branding/{tenantSlug}        # Platform override
POST   /api/platform/branding/{tenantSlug}/reset  # Reset to defaults
```

### **Monitoring & Alerting**
```yaml
# Grafana dashboards:
# - Branding cache hit rate
# - Tenant branding update frequency
# - WCAG compliance rate
# - Tier distribution

# Alerts:
# - Cache hit rate < 95%
# - Branding update failures
# - WCAG compliance violations
# - Tenant enumeration attempts
```

---

## **🚨 RISK MITIGATION**

### **Rollback Strategy**
```php
// Feature flags for gradual rollout
if (Feature::active('new-branding-service')) {
    $branding = app(LandlordBrandingService::class)->getBrandingBySlug($slug);
} else {
    $branding = app(TenantBrandingService::class)->getBrandingForTenant($tenant);
}

// Database backup before migration
// Point-in-time recovery capability
// A/B testing with canary deployment
```

### **Data Validation**
```php
// Migration validation script
class ValidateMigration
{
    public function validate(): ValidationReport
    {
        // Compare old vs new data
        // Check for data loss
        // Verify transformation correctness
        // Test random sample of tenants
    }
}
```

---

## **🎯 SUCCESS CRITERIA**

### **Technical Success**
- [ ] Zero queries to tenant databases for branding
- [ ] All branding data in landlord DB
- [ ] Cache hit rate > 98%
- [ ] WCAG compliance 100%
- [ ] No tenant enumeration vulnerabilities

### **Business Success**
- [ ] Login pages work without authentication
- [ ] Branding updates propagate in < 5 seconds
- [ ] Tier restrictions properly enforced
- [ ] White-labeling working for all tenants
- [ ] Support tickets reduced by 80%

### **Developer Success**
- [ ] Clean architecture with clear boundaries
- [ ] Comprehensive test coverage (> 90%)
- [ ] No deprecated code warnings
- [ ] Clear documentation
- [ ] Easy onboarding for new developers

---

## **📞 GETTING HELP**

### **Blocked? Contact:**
1. **Database Migration Issues**: Senior DBA
2. **Cache Invalidation Problems**: DevOps Team  
3. **WCAG Compliance Questions**: Accessibility Specialist
4. **Tier Restriction Logic**: Product Manager
5. **Architecture Decisions**: Senior Architect

### **Emergency Rollback:**
```bash
# Revert to old system immediately
php artisan migrate:rollback --database=landlord --step=1
php artisan cache:clear
# Switch feature flag
```

---

**Ready to begin Phase 1? Start with deprecating TenantBrandingService methods and creating the data migration script.**