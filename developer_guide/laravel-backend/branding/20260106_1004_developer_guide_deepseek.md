# 🏗️ **DEVELOPER GUIDE: TENANT BRANDING SYSTEM - Platform Context**

## **📋 EXECUTIVE SUMMARY**

A **Domain-Driven Design (DDD)** implementation of multi-tenant branding for an election platform. Provides secure, WCAG-compliant branding configuration for 50+ political organizations with strict tenant isolation.

---

## **🎯 ARCHITECTURE OVERVIEW**

### **Bounded Context: Platform**
**Purpose:** Manage tenant-specific visual identity and messaging
**Database:** Landlord connection (platform-wide data)
**Tenant Identification:** `tenant_slug` as natural key

### **Layer Architecture**
```
┌─────────────────────────────────────────────────────────┐
│                    PLATFORM CONTEXT                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    DOMAIN   │  │ APPLICATION │  │INFRASTRUCTURE│    │
│  │    LAYER    │  │    LAYER    │  │    LAYER    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│         │                  │                  │        │
│  Pure business   Business workflows   Database & API   │
│  Zero framework  Transaction mgmt     implementations  │
│  Immutable VOs   Command/Query        Eloquent models  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## **🏗️ DOMAIN MODEL**

### **Core Value Objects (Immutable)**

#### **1. BrandingIdentity**
```php
// Organizational identity elements
BrandingIdentity::create(
    organizationName: 'National Election Commission',
    organizationTagline: 'Building Democracy Together',
    faviconUrl: 'https://example.com/favicon.ico'  // Optional
);
```
**Purpose:** Company/organization identification
**Fields:** `organization_name`, `organization_tagline`, `favicon_url`

#### **2. BrandingVisuals**
```php
// Visual design elements
BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#1976D2'),
    secondaryColor: BrandingColor::fromString('#2E7D32'),
    logoUrl: 'https://example.com/logo.png',
    fontFamily: 'Inter, system-ui, sans-serif'
);
```
**Purpose:** Colors, logo, typography
**Fields:** `primary_color`, `secondary_color`, `logo_url`, `font_family`

#### **3. BrandingContent**
```php
// Textual content for landing pages
BrandingContent::create(
    welcomeMessage: 'Welcome to our election platform',
    heroTitle: 'Democracy in Action',
    heroSubtitle: 'Make your voice heard in secure elections',
    ctaText: 'Get Started'  // Call-to-action button text
);
```
**Purpose:** Landing page messaging
**Fields:** `welcome_message`, `hero_title`, `hero_subtitle`, `cta_text`

#### **4. BrandingBundle (Composite)**
```php
// Complete branding package
BrandingBundle::create(
    visuals: $brandingVisuals,
    content: $brandingContent,
    identity: $brandingIdentity
);
```
**Purpose:** Aggregate all branding components
**Features:** WCAG compliance checking, immutability with `with*()` methods

### **Core Entity**

#### **TenantBranding**
```php
// Root aggregate for tenant branding
$branding = TenantBranding::createForTenant(
    tenantId: TenantId::fromSlug('nrna'),
    branding: $brandingBundle
);

// Business operation with domain events
$branding->updateBranding($newBundle, $userId);
```
**Purpose:** Manage tenant branding lifecycle
**Features:** Domain events, WCAG validation, rate limiting

---

## **🗄️ DATABASE SCHEMA**

### **Table: `tenant_brandings` (Landlord Database)**
```sql
-- MVP Fields (12 total)
tenant_db_id          BIGINT        -- FK to tenants.numeric_id
tenant_slug           VARCHAR(64)   -- Natural key, unique

-- BrandingVisuals (4 fields)
primary_color         VARCHAR(7)    -- #RRGGBB format
secondary_color       VARCHAR(7)
logo_url              VARCHAR(255)  NULLABLE
font_family           VARCHAR(100)

-- BrandingIdentity (3 fields)  
organization_name     VARCHAR(255)
tagline               VARCHAR(255)  NULLABLE  -- Maps to organizationTagline
favicon_url           VARCHAR(255)  NULLABLE  -- Optional

-- BrandingContent (4 fields)
welcome_message       VARCHAR(500)
hero_title            VARCHAR(255)
hero_subtitle         TEXT
cta_text              VARCHAR(100)  -- Call-to-action text

-- Timestamps (infrastructure)
created_at            TIMESTAMP
updated_at            TIMESTAMP
```

### **Important Notes:**
- **Legacy fields exist** but are ignored by domain (`tier`, `cache_key`, `version`, etc.)
- **`tagline` column** maps to `organizationTagline` domain property
- **Foreign key:** `tenant_db_id` references `tenants.numeric_id`

---

## **🔌 INFRASTRUCTURE LAYER**

### **1. TenantBrandingModel (Eloquent)**
```php
// Location: app/Contexts/Platform/Infrastructure/Models/
class TenantBrandingModel extends Model
{
    protected $connection = 'landlord';
    protected $table = 'tenant_brandings';
    
    // Only MVP fields are fillable (12 fields)
    protected $fillable = [
        'tenant_db_id', 'tenant_slug',
        'primary_color', 'secondary_color', 'logo_url', 'font_family',
        'organization_name', 'tagline', 'favicon_url',
        'welcome_message', 'hero_title', 'hero_subtitle', 'cta_text'
    ];
}
```

### **2. EloquentTenantBrandingRepository**
```php
// Location: app/Contexts/Platform/Infrastructure/Repositories/
class EloquentTenantBrandingRepository implements TenantBrandingRepositoryInterface
{
    // Anti-corruption layer pattern
    private function toDomain(TenantBrandingModel $model): TenantBranding
    {
        return TenantBranding::reconstitute(
            tenantId: TenantId::fromSlug($model->tenant_slug),
            branding: BrandingBundle::create(...),
            createdAt: DateTimeImmutable::createFromMutable($model->created_at),
            updatedAt: DateTimeImmutable::createFromMutable($model->updated_at)
        );
    }
    
    private function toDatabase(TenantBranding $branding): array
    {
        return [
            'tenant_slug' => $branding->getTenantId()->getSlug(),
            'primary_color' => $branding->getBranding()->getVisuals()->getPrimaryColor()->toString(),
            'tagline' => $branding->getBranding()->getIdentity()->getOrganizationTagline(), // Mapping!
            // ... other fields
        ];
    }
}
```

### **3. Repository Interface**
```php
// Location: app/Contexts/Platform/Domain/Repositories/
interface TenantBrandingRepositoryInterface
{
    public function findForTenant(TenantId $tenantId): ?TenantBranding;
    public function saveForTenant(TenantBranding $branding): void;
    public function existsForTenant(TenantId $tenantId): bool;
    public function deleteForTenant(TenantId $tenantId): void;
}
```

---

## **⚙️ ANTI-CORRUPTION PATTERN**

### **Database ↔ Domain Mapping**
```
Database Column     → Domain Property
─────────────────────────────────────
tagline            → organizationTagline
primary_color      → primaryColor (BrandingColor VO)
secondary_color    → secondaryColor (BrandingColor VO)
logo_url           → logoUrl (string)
font_family        → fontFamily (string)

organization_name  → organizationName
favicon_url        → faviconUrl (nullable)

welcome_message    → welcomeMessage
hero_title         → heroTitle  
hero_subtitle      → heroSubtitle
cta_text           → ctaText
```

### **Key Principles:**
1. **Repository handles all mapping** - Domain never sees database schema
2. **Legacy fields ignored** - Exist in DB but not in domain
3. **Value Object wrapping** - Raw strings become typed objects
4. **Timestamps conversion** - Eloquent Carbon → PHP DateTimeImmutable

---

## **🔒 SECURITY & COMPLIANCE**

### **WCAG 2.1 AA Enforcement**
```php
// Built into domain model
class BrandingBundle
{
    public function isWcagCompliant(): bool
    {
        return $this->visuals->hasSufficientContrast();
    }
}

class TenantBranding
{
    private function validateBrandingForElectionPlatform(): void
    {
        if (!$this->bundle->getComplianceReport()->hasSufficientContrast()) {
            throw new BrandingValidationException(
                'Branding colors must have sufficient contrast for accessibility'
            );
        }
    }
}
```

### **Tenant Isolation**
```php
// All repository methods are tenant-scoped
$repository->findForTenant(TenantId::fromSlug('nrna'));
$repository->saveForTenant($tenantBranding); // Implicit tenant from entity
```

### **Rate Limiting (Domain Level)**
```php
class TenantBranding
{
    private function validateNewBranding(BrandingBundle $newBundle): void
    {
        // Prevent rapid changes (5-minute cooldown)
        $timeSinceLastUpdate = $this->updatedAt->diff(new DateTimeImmutable());
        if ($timeSinceLastUpdate->i < 5) {
            throw new BrandingValidationException(
                'Branding can only be updated once every 5 minutes'
            );
        }
    }
}
```

---

## **🧪 TESTING STRATEGY**

### **1. Domain Tests (Pure PHPUnit)**
```bash
# Value Objects
php artisan test tests/Unit/Contexts/Platform/Domain/ValueObjects/

# Entities
php artisan test tests/Unit/Contexts/Platform/Domain/Entities/

# All domain tests
php artisan test --filter="Branding"
```

### **2. Infrastructure Tests (Database)**
```php
class EloquentTenantBrandingRepositoryTest extends TestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        // CRITICAL: Set landlord_test connection
        config(['database.default' => 'landlord_test']);
    }
    
    protected function migrateFreshUsing(): array
    {
        return [
            '--path' => 'database/migrations/landlord',
            '--database' => 'landlord_test',
            '--realpath' => true,
        ];
    }
}
```

### **3. Test Data Requirements**
```php
// Tests require tenants in landlord_test database
private function createTestTenant(string $slug, int $numericId): void
{
    DB::connection('landlord_test')->table('tenants')->insert([
        'slug' => $slug,
        'numeric_id' => $numericId,
        // ... other required fields
    ]);
}
```

---

## **🚀 USAGE EXAMPLES**

### **1. Creating Branding for New Tenant**
```php
$tenantId = TenantId::fromSlug('new-tenant');

// Create default branding bundle
$bundle = BrandingBundle::defaults();

// Create tenant branding entity
$tenantBranding = TenantBranding::createForTenant($tenantId, $bundle);

// Save via repository
$repository->saveForTenant($tenantBranding);

// Dispatch domain events
foreach ($tenantBranding->getDomainEvents() as $event) {
    event($event);
}
```

### **2. Updating Existing Branding**
```php
$tenantId = TenantId::fromSlug('existing-tenant');

// Retrieve existing
$branding = $repository->findForTenant($tenantId);

// Create updated visuals
$newVisuals = BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#E65100'),
    secondaryColor: BrandingColor::fromString('#1976D2'),
    logoUrl: 'https://new-logo.com/logo.png',
    fontFamily: 'Inter, system-ui, sans-serif'
);

// Update with new visuals
$branding->updateBranding(
    $branding->getBranding()->withVisuals($newVisuals),
    $userId
);

// Save changes
$repository->saveForTenant($branding);
```

### **3. Generating CSS Variables**
```php
$branding = $repository->findForTenant($tenantId);
$css = $branding->getBranding()->generateCssVariables();

// Outputs:
:root {
  --primary-color: #1976D2;
  --secondary-color: #2E7D32;
  --font-family: 'Inter', system-ui, sans-serif;
}
```

---

## **⚡ PERFORMANCE CONSIDERATIONS**

### **Caching Strategy**
```php
// Recommended cache key pattern
$cacheKey = "tenant:branding:{$tenantSlug}:{$version}";

// Cache durations:
- Public API: 24 hours
- Mobile API: 1 hour  
- Admin API: 5 minutes (invalidate on update)
```

### **Database Indexes**
```sql
-- Essential indexes
CREATE INDEX idx_tenant_brandings_slug ON tenant_brandings(tenant_slug);
CREATE INDEX idx_tenant_brandings_db_id ON tenant_brandings(tenant_db_id);

-- Foreign key already indexed
```

---

## **🔧 MAINTENANCE & EXTENSION**

### **Adding New MVP Fields**
1. **Domain Layer:**
   - Add to appropriate Value Object
   - Update validation rules
   - Update `toArray()` and `fromArray()` methods

2. **Database Layer:**
   - Create additive migration
   ```bash
   php artisan make:migration add_field_to_tenant_brandings \
     --path=database/migrations/landlord/platform
   ```

3. **Infrastructure Layer:**
   - Add to model's `$fillable` array
   - Update repository mapping methods

### **Deprecating Fields**
1. Remove from domain model
2. Keep in database (nullable)
3. Repository ignores deprecated fields
4. Schedule removal in future migration

---

## **🚨 COMMON PITFALLS & SOLUTIONS**

### **1. "Undefined table" in Tests**
**Problem:** Wrong database connection
**Solution:** Ensure `beforeRefreshingDatabase()` sets `landlord_test`

### **2. Foreign Key Violations**
**Problem:** Missing tenant in `tenants` table
**Solution:** Create test tenant before branding operations

### **3. Domain Events Persisting**
**Problem:** Events not cleared after reconstitution
**Solution:** Ensure `reconstitute()` calls `clearDomainEvents()`

### **4. WCAG Compliance Failures**
**Problem:** Branding update rejected
**Solution:** Use `BrandingColor::getContrastRatio()` to validate colors

---

## **📚 RELATED FILES**

### **Core Domain**
```
app/Contexts/Platform/Domain/
├── ValueObjects/
│   ├── BrandingIdentity.php
│   ├── BrandingVisuals.php
│   ├── BrandingContent.php
│   ├── BrandingBundle.php
│   └── BrandingColor.php
├── Entities/
│   └── TenantBranding.php
├── Repositories/
│   └── TenantBrandingRepositoryInterface.php
└── Exceptions/
    └── InvalidBrandingException.php
```

### **Infrastructure**
```
app/Contexts/Platform/Infrastructure/
├── Models/
│   └── TenantBrandingModel.php
├── Repositories/
│   └── EloquentTenantBrandingRepository.php
└── Database/
    └── Migrations/
        └── Landlord/
            └── Platform/  # Platform context migrations
```

### **Tests**
```
tests/Unit/Contexts/Platform/
├── Domain/
│   ├── ValueObjects/  # 28 passing tests
│   └── Entities/      # 17 passing tests
└── Infrastructure/
    └── Repositories/  # 11 passing tests
```

---

## **🎯 KEY DESIGN DECISIONS**

### **1. DDD Over Active Record**
- **Why:** Domain purity, testability, business logic encapsulation
- **Result:** Zero Laravel dependencies in domain layer

### **2. Anti-Corruption Layer**
- **Why:** Decouple domain from database schema
- **Result:** Legacy fields ignored, clean domain model

### **3. Immutable Value Objects**
- **Why:** Thread safety, predictability, validation enforcement
- **Result:** `with*()` methods for updates, no setters

### **4. Tenant Slug as Natural Key**
- **Why:** Human-readable, URL-friendly, consistent across contexts
- **Result:** `TenantId::fromSlug('nrna')` instead of numeric IDs

### **5. WCAG as Domain Invariant**
- **Why:** Legal requirement for election platforms
- **Result:** Compliance enforced at entity creation/update

---

## **🚀 GETTING STARTED FOR NEW DEVELOPERS**

### **1. Environment Setup**
```bash
# Create test databases
sudo -u postgres psql -c "CREATE DATABASE landlord_test;"

# Apply migrations
php artisan migrate --database=landlord_test --path=database/migrations/landlord

# Run tests
php artisan test tests/Unit/Contexts/Platform/
```

### **2. Common Operations Cheatsheet**
```php
// Get tenant branding
$branding = $repository->findForTenant(TenantId::fromSlug('tenant-slug'));

// Update colors
$newVisuals = $branding->getBranding()->getVisuals()
    ->withPrimaryColor(BrandingColor::fromString('#FF0000'));
$branding->updateBranding(
    $branding->getBranding()->withVisuals($newVisuals),
    $userId
);

// Check WCAG compliance
if (!$branding->getBranding()->isWcagCompliant()) {
    throw new InvalidBrandingException('Colors lack sufficient contrast');
}
```

### **3. Debugging Tips**
```php
// Debug domain object
dd($branding->getBranding()->toArray());

// Debug database state
dd(TenantBrandingModel::where('tenant_slug', 'nrna')->first()->toArray());

// Check mapping
$model = TenantBrandingModel::first();
$entity = $repository->toDomain($model);
dd(['model' => $model->toArray(), 'entity' => $entity->getBranding()->toArray()]);
```

---

## **📞 SUPPORT & CONTRIBUTIONS**

### **Architecture Questions**
- **DDD Patterns:** Review `TenantBranding::reconstitute()` pattern
- **Database Mapping:** See `EloquentTenantBrandingRepository::toDomain()`
- **Testing:** Follow existing test patterns

### **When Changing Schema**
1. Always use **additive migrations**
2. Update **all three layers** (Domain, Model, Repository)
3. Maintain **backward compatibility** for 30 days
4. Add **integration tests** for data migration

### **Performance Issues**
1. Check **cache keys** and TTLs
2. Verify **database indexes**
3. Review **N+1 queries** in repository
4. Consider **CSS CDN** for production

---

**Last Updated:** 2026-01-06  
**Test Status:** 56/56 tests passing ✅  
**Architecture:** DDD with Clean Architecture  
**Compliance:** WCAG 2.1 AA enforced at domain level  

*This system is production-ready for multi-tenant election platforms with strict security, accessibility, and compliance requirements.*