# Platform Branding - Infrastructure Implementation

**Document Version:** 1.0
**Last Updated:** 2026-01-06

---

## 📋 Overview

This guide covers the **Infrastructure Layer** implementation of the Platform Branding system. The infrastructure layer is responsible for:

- **Persistence:** Eloquent models and database interaction
- **Repository Implementation:** EloquentTenantBrandingRepository
- **Anti-Corruption Layer:** Mapping between database schema and domain model
- **Connection Management:** Dynamic database connection resolution

---

## 🏗️ Infrastructure Architecture

```
app/Contexts/Platform/Infrastructure/
├── Models/
│   └── TenantBrandingModel.php          # Eloquent model
├── Repositories/
│   └── EloquentTenantBrandingRepository.php  # Repository implementation
└── Database/
    └── Migrations/
        └── Landlord/
            ├── 2026_01_04_*_create_tenant_brandings_table.php
            ├── 2026_01_05_*_add_domain_model_fields.php
            └── 2026_01_06_*_add_cta_text_and_favicon_url.php
```

---

## 🔧 TenantBrandingModel

### Purpose

The `TenantBrandingModel` is an **Eloquent model** that:
- Maps to the `tenant_brandings` table
- Uses **landlord database** (production) or **landlord_test** (testing)
- Contains **only MVP fields** (12 fields)
- Provides dynamic connection resolution for testing

### Complete Implementation

**File:** `app/Contexts/Platform/Infrastructure/Models/TenantBrandingModel.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Eloquent Model for tenant branding configuration
 *
 * This model acts as an anti-corruption layer between the database
 * and the domain model. It contains ONLY MVP fields.
 */
final class TenantBrandingModel extends Model
{
    /**
     * Database connection (production)
     *
     * @var string
     */
    protected $connection = 'landlord';

    /**
     * Database table name
     *
     * @var string
     */
    protected $table = 'tenant_brandings';

    /**
     * Mass-assignable attributes
     *
     * Contains EXACTLY 12 MVP fields - NO legacy fields
     *
     * @var array<string>
     */
    protected $fillable = [
        // Identifiers (2)
        'tenant_db_id',
        'tenant_slug',

        // BrandingVisuals (4)
        'primary_color',
        'secondary_color',
        'logo_url',
        'font_family',

        // BrandingIdentity (3)
        'organization_name',
        'tagline',              // Maps to Domain: organizationTagline
        'favicon_url',

        // BrandingContent (4)
        'welcome_message',
        'hero_title',
        'hero_subtitle',
        'cta_text',
    ];

    /**
     * Dynamic connection resolution for testing
     *
     * Returns:
     * - 'landlord_test' when running tests with landlord_test as default
     * - 'landlord' for production
     *
     * @return string
     */
    public function getConnectionName()
    {
        if (app()->environment('testing') && config('database.default') === 'landlord_test') {
            return 'landlord_test';
        }

        return $this->connection ?? config('database.default');
    }
}
```

### Key Design Decisions

#### 1. MVP Fields Only

**Why?**
- Clean separation from legacy fields
- Prevents accidental use of deprecated columns
- Makes domain model requirements explicit

**What's Excluded:**
- Legacy tagline_i18n
- Old metadata columns
- Deprecated branding fields

#### 2. Dynamic Connection Resolution

**Production:**
```php
$model->getConnectionName(); // Returns: 'landlord'
```

**Testing:**
```php
config(['database.default' => 'landlord_test']);
$model->getConnectionName(); // Returns: 'landlord_test'
```

**Benefits:**
- Single model definition
- No environment-specific code
- Tests use isolated test database

#### 3. No Business Logic

**The model contains:**
- ✅ Database mapping configuration
- ✅ Connection management
- ✅ Table and column definitions

**The model does NOT contain:**
- ❌ Validation logic (belongs in domain)
- ❌ Business rules (belongs in domain)
- ❌ Query scopes (kept simple)

---

## 🗄️ EloquentTenantBrandingRepository

### Purpose

The `EloquentTenantBrandingRepository` implements `TenantBrandingRepositoryInterface` and provides:
- Database persistence for TenantBranding aggregates
- Anti-corruption layer (database ↔ domain mapping)
- Tenant isolation enforcement
- Connection-aware operations

### Complete Implementation

**File:** `app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantBrandingRepository.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Repositories;

use App\Contexts\Platform\Domain\Entities\TenantBranding;
use App\Contexts\Platform\Domain\Repositories\TenantBrandingRepositoryInterface;
use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;
use App\Contexts\Platform\Domain\ValueObjects\BrandingColor;
use App\Contexts\Platform\Domain\ValueObjects\BrandingContent;
use App\Contexts\Platform\Domain\ValueObjects\BrandingIdentity;
use App\Contexts\Platform\Domain\ValueObjects\BrandingVisuals;
use App\Contexts\Platform\Infrastructure\Models\TenantBrandingModel;
use App\Contexts\Shared\Domain\ValueObjects\TenantId;
use DateTimeImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Eloquent implementation of TenantBrandingRepositoryInterface
 *
 * Responsibilities:
 * - Persist TenantBranding aggregates to database
 * - Map between domain model and database schema (anti-corruption layer)
 * - Resolve tenant_db_id from tenant_slug
 * - Enforce tenant isolation
 */
final class EloquentTenantBrandingRepository implements TenantBrandingRepositoryInterface
{
    /**
     * @param TenantBrandingModel $model Injected Eloquent model
     */
    public function __construct(
        private readonly TenantBrandingModel $model
    ) {}

    /**
     * Find branding for a specific tenant
     *
     * @param TenantId $tenantId
     * @return TenantBranding|null Returns null if not found
     */
    public function findForTenant(TenantId $tenantId): ?TenantBranding
    {
        $tenantSlug = $tenantId->toString();

        $model = $this->model->newQuery()
            ->where('tenant_slug', $tenantSlug)
            ->first();

        return $model ? $this->toDomain($model) : null;
    }

    /**
     * Save branding for a specific tenant
     *
     * Uses updateOrCreate to maintain one-to-one relationship
     * Resolves tenant_db_id from tenant_slug
     *
     * @param TenantBranding $branding
     * @return void
     */
    public function saveForTenant(TenantBranding $branding): void
    {
        $tenantSlug = $branding->getTenantId()->toString();

        // Resolve tenant_db_id from tenant_slug
        $connection = $this->model->getConnectionName();
        $tenant = DB::connection($connection)
            ->table('tenants')
            ->where('slug', $tenantSlug)
            ->select('numeric_id')
            ->first();

        if (!$tenant) {
            throw new \RuntimeException(
                "Tenant with slug '{$tenantSlug}' not found."
            );
        }

        $data = $this->toDatabase($branding);
        $data['tenant_db_id'] = $tenant->numeric_id;

        $this->model->updateOrCreate(
            ['tenant_slug' => $tenantSlug],
            $data
        );
    }

    /**
     * Check if branding exists for a tenant
     *
     * @param TenantId $tenantId
     * @return bool
     */
    public function existsForTenant(TenantId $tenantId): bool
    {
        return $this->model->newQuery()
            ->where('tenant_slug', $tenantId->toString())
            ->exists();
    }

    /**
     * Delete branding for a tenant
     *
     * Idempotent - does not throw error if branding doesn't exist
     *
     * @param TenantId $tenantId
     * @return void
     */
    public function deleteForTenant(TenantId $tenantId): void
    {
        $this->model->newQuery()
            ->where('tenant_slug', $tenantId->toString())
            ->delete();
    }

    /**
     * Anti-Corruption Layer: Database Model → Domain Entity
     *
     * CRITICAL MAPPING:
     * - Database: 'tagline' → Domain: 'organizationTagline'
     *
     * @param TenantBrandingModel $model
     * @return TenantBranding
     */
    private function toDomain(TenantBrandingModel $model): TenantBranding
    {
        // Map BrandingVisuals
        $visuals = BrandingVisuals::create(
            primaryColor: BrandingColor::fromString(
                $model->primary_color ?? BrandingVisuals::defaults()->getPrimaryColor()->toString()
            ),
            secondaryColor: BrandingColor::fromString(
                $model->secondary_color ?? BrandingVisuals::defaults()->getSecondaryColor()->toString()
            ),
            logoUrl: $model->logo_url,
            fontFamily: $model->font_family
        );

        // Map BrandingContent
        $content = BrandingContent::create(
            welcomeMessage: $model->welcome_message ?? BrandingContent::defaults()->getWelcomeMessage(),
            heroTitle: $model->hero_title ?? BrandingContent::defaults()->getHeroTitle(),
            heroSubtitle: $model->hero_subtitle ?? BrandingContent::defaults()->getHeroSubtitle(),
            ctaText: $model->cta_text ?? BrandingContent::defaults()->getCtaText()
        );

        // Map BrandingIdentity
        // ⚠️ CRITICAL: Database 'tagline' → Domain 'organizationTagline'
        $identity = BrandingIdentity::create(
            organizationName: $model->organization_name ?? BrandingIdentity::defaults()->getOrganizationName(),
            organizationTagline: $model->tagline ?? BrandingIdentity::defaults()->getOrganizationTagline(),
            faviconUrl: $model->favicon_url
        );

        // Create BrandingBundle
        $bundle = BrandingBundle::create($visuals, $content, $identity);

        // Reconstitute TenantBranding aggregate
        return TenantBranding::reconstitute(
            tenantId: TenantId::fromSlug($model->tenant_slug),
            branding: $bundle,
            createdAt: DateTimeImmutable::createFromMutable($model->created_at),
            updatedAt: DateTimeImmutable::createFromMutable($model->updated_at)
        );
    }

    /**
     * Anti-Corruption Layer: Domain Entity → Database Array
     *
     * CRITICAL MAPPING:
     * - Domain: 'organizationTagline' → Database: 'tagline'
     *
     * @param TenantBranding $branding
     * @return array<string, mixed>
     */
    private function toDatabase(TenantBranding $branding): array
    {
        $bundle = $branding->getBranding();
        $visuals = $bundle->getVisuals();
        $content = $bundle->getContent();
        $identity = $bundle->getIdentity();

        return [
            'tenant_slug' => $branding->getTenantId()->toString(),

            // BrandingVisuals
            'primary_color' => $visuals->getPrimaryColor()->toString(),
            'secondary_color' => $visuals->getSecondaryColor()->toString(),
            'logo_url' => $visuals->getLogoUrl(),
            'font_family' => $visuals->getFontFamily(),

            // BrandingContent
            'welcome_message' => $content->getWelcomeMessage(),
            'hero_title' => $content->getHeroTitle(),
            'hero_subtitle' => $content->getHeroSubtitle(),
            'cta_text' => $content->getCtaText(),

            // BrandingIdentity
            // ⚠️ CRITICAL: Domain 'organizationTagline' → Database 'tagline'
            'organization_name' => $identity->getOrganizationName(),
            'tagline' => $identity->getOrganizationTagline(),
            'favicon_url' => $identity->getFaviconUrl(),
        ];
    }
}
```

---

## 🔄 Anti-Corruption Layer

### Purpose

The anti-corruption layer **isolates the domain model from database schema concerns**.

### Critical Mapping: tagline ↔ organizationTagline

**Why This Mapping Exists:**

**Problem:**
- Database schema uses concise column name: `tagline`
- Domain model uses expressive property: `organizationTagline`

**Solution:**
- Repository acts as translator between the two

**Database → Domain (toDomain method):**

```php
// Database column name
$model->tagline

// ↓ Maps to ↓

// Domain property name
BrandingIdentity::create(
    organizationName: '...',
    organizationTagline: $model->tagline,  // ⚠️ Mapping happens here
    faviconUrl: '...'
);
```

**Domain → Database (toDatabase method):**

```php
// Domain property name
$identity->getOrganizationTagline()

// ↓ Maps to ↓

// Database column name
return [
    'tagline' => $identity->getOrganizationTagline(),  // ⚠️ Mapping happens here
];
```

### Mapping Table

| Domain Property             | Database Column       | Notes                            |
|-----------------------------|-----------------------|----------------------------------|
| `organizationName`          | `organization_name`   | Direct mapping                   |
| **`organizationTagline`**   | **`tagline`**         | **⚠️ Anti-corruption mapping**   |
| `faviconUrl`                | `favicon_url`         | Direct mapping                   |
| `primaryColor`              | `primary_color`       | Direct mapping                   |
| `secondaryColor`            | `secondary_color`     | Direct mapping                   |
| `logoUrl`                   | `logo_url`            | Direct mapping                   |
| `fontFamily`                | `font_family`         | Direct mapping                   |
| `welcomeMessage`            | `welcome_message`     | Direct mapping                   |
| `heroTitle`                 | `hero_title`          | Direct mapping                   |
| `heroSubtitle`              | `hero_subtitle`       | Direct mapping                   |
| `ctaText`                   | `cta_text`            | Direct mapping                   |

### Benefits of This Approach

✅ **Domain Purity**
- Domain model uses clean, expressive naming
- No database concerns leak into domain

✅ **Database Flexibility**
- Can change database schema without affecting domain
- Can optimize column names for performance/storage

✅ **Backward Compatibility**
- Existing database schema preserved
- No breaking changes to deployed systems

✅ **Maintainability**
- Mapping logic centralized in repository
- Easy to understand and modify

---

## 🔌 Connection Management

### Dynamic Connection Resolution

The repository uses `TenantBrandingModel::getConnectionName()` to determine the database connection.

**Production Environment:**

```php
// config/database.php
'default' => 'landlord',

// TenantBrandingModel
protected $connection = 'landlord';

// Result
$model->getConnectionName(); // Returns: 'landlord'
```

**Testing Environment:**

```php
// Test setup
config(['database.default' => 'landlord_test']);

// TenantBrandingModel detects testing environment
public function getConnectionName()
{
    if (app()->environment('testing')
        && config('database.default') === 'landlord_test') {
        return 'landlord_test';
    }
    return $this->connection;
}

// Result
$model->getConnectionName(); // Returns: 'landlord_test'
```

### Connection Usage in Repository

**Finding branding:**
```php
// Uses model's connection automatically
$model = $this->model->newQuery()
    ->where('tenant_slug', $tenantSlug)
    ->first();
```

**Resolving tenant_db_id:**
```php
// Explicitly uses model's connection
$connection = $this->model->getConnectionName();
$tenant = DB::connection($connection)
    ->table('tenants')
    ->where('slug', $tenantSlug)
    ->first();
```

---

## 💾 Database Schema

### Table: tenant_brandings

**Location:** Landlord database (`publicdigit` / `publicdigit_test`)

**Schema:**

```sql
CREATE TABLE tenant_brandings (
    id BIGSERIAL PRIMARY KEY,

    -- Identifiers
    tenant_db_id INTEGER NOT NULL REFERENCES tenants(numeric_id),
    tenant_slug VARCHAR(255) NOT NULL UNIQUE,

    -- BrandingVisuals
    primary_color VARCHAR(7) NULL,
    secondary_color VARCHAR(7) NULL,
    logo_url VARCHAR(500) NULL,
    font_family VARCHAR(100) NULL,

    -- BrandingIdentity
    organization_name VARCHAR(255) NULL,
    tagline VARCHAR(150) NULL,
    favicon_url VARCHAR(500) NULL,

    -- BrandingContent
    welcome_message VARCHAR(150) NULL,
    hero_title VARCHAR(100) NULL,
    hero_subtitle VARCHAR(200) NULL,
    cta_text VARCHAR(100) NULL,

    -- Timestamps
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    -- Indexes
    INDEX idx_tenant_db_id (tenant_db_id),
    UNIQUE INDEX idx_tenant_slug (tenant_slug)
);
```

### Migration Files

**1. Initial Table Creation**

**File:** `2026_01_04_224847_create_tenant_brandings_table.php`

```php
Schema::create('tenant_brandings', function (Blueprint $table) {
    $table->id();

    $table->integer('tenant_db_id');
    $table->string('tenant_slug', 255)->unique();

    $table->string('primary_color', 7)->nullable();
    $table->string('secondary_color', 7)->nullable();
    $table->string('logo_url', 500)->nullable();

    $table->timestamps();

    $table->index('tenant_db_id');

    $table->foreign('tenant_db_id')
          ->references('numeric_id')
          ->on('tenants')
          ->onDelete('cascade');
});
```

**2. Domain Model Fields**

**File:** `2026_01_05_211646_add_domain_model_fields_to_tenant_brandings_table.php`

```php
Schema::table('tenant_brandings', function (Blueprint $table) {
    $table->string('font_family', 100)->nullable()
          ->after('logo_url');

    $table->string('organization_name', 255)->nullable()
          ->after('font_family');

    $table->string('tagline', 150)->nullable()
          ->after('organization_name');

    $table->string('welcome_message', 150)->nullable()
          ->after('tagline');

    $table->string('hero_title', 100)->nullable()
          ->after('welcome_message');

    $table->string('hero_subtitle', 200)->nullable()
          ->after('hero_title');
});
```

**3. Final MVP Fields**

**File:** `2026_01_06_065955_add_cta_text_and_favicon_url_to_tenant_brandings_table.php`

```php
Schema::table('tenant_brandings', function (Blueprint $table) {
    $table->string('cta_text', 100)->nullable()
          ->after('hero_subtitle')
          ->comment('Call to action button text');

    $table->string('favicon_url', 500)->nullable()
          ->after('tagline')
          ->comment('URL to tenant favicon');
});
```

---

## 🎯 Repository Operations

### Create Branding

```php
use App\Contexts\Platform\Domain\Entities\TenantBranding;
use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;
use App\Contexts\Shared\Domain\ValueObjects\TenantId;

$tenantId = TenantId::fromSlug('nrna');
$bundle = BrandingBundle::defaults();
$branding = TenantBranding::create($tenantId, $bundle);

$repository->saveForTenant($branding);

// Database operations:
// 1. Resolve tenant_db_id from 'nrna'
// 2. Map domain model to database array
// 3. Execute updateOrCreate query
```

### Retrieve Branding

```php
$tenantId = TenantId::fromSlug('nrna');
$branding = $repository->findForTenant($tenantId);

if ($branding) {
    // Database operations:
    // 1. Query WHERE tenant_slug = 'nrna'
    // 2. Map database model to domain entity
    // 3. Return TenantBranding aggregate
}
```

### Update Branding

```php
$branding = $repository->findForTenant($tenantId);

$newIdentity = BrandingIdentity::create(
    organizationName: 'New Name',
    organizationTagline: 'New Tagline',
    faviconUrl: 'https://example.com/favicon.ico'
);

$newBundle = $branding->getBranding()->withIdentity($newIdentity);
$branding->updateBranding($newBundle);

$repository->saveForTenant($branding);

// Database operations:
// 1. Resolve tenant_db_id
// 2. Map updated domain model
// 3. Execute updateOrCreate (updates existing row)
```

### Delete Branding

```php
$repository->deleteForTenant($tenantId);

// Database operations:
// 1. Execute DELETE WHERE tenant_slug = 'nrna'
// 2. Idempotent - no error if already deleted
```

---

## 🔍 Query Patterns

### Find by Tenant Slug

```php
// Repository method
public function findForTenant(TenantId $tenantId): ?TenantBranding
{
    $tenantSlug = $tenantId->toString();

    $model = $this->model->newQuery()
        ->where('tenant_slug', $tenantSlug)  // Exact match
        ->first();

    return $model ? $this->toDomain($model) : null;
}
```

**SQL Generated:**
```sql
SELECT * FROM tenant_brandings
WHERE tenant_slug = 'nrna'
LIMIT 1;
```

### Check Existence

```php
// Repository method
public function existsForTenant(TenantId $tenantId): bool
{
    return $this->model->newQuery()
        ->where('tenant_slug', $tenantId->toString())
        ->exists();
}
```

**SQL Generated:**
```sql
SELECT EXISTS(
    SELECT 1 FROM tenant_brandings
    WHERE tenant_slug = 'nrna'
) as exists;
```

### Resolve Tenant DB ID

```php
// Internal repository method
$connection = $this->model->getConnectionName();
$tenant = DB::connection($connection)
    ->table('tenants')
    ->where('slug', $tenantSlug)
    ->select('numeric_id')
    ->first();
```

**SQL Generated:**
```sql
SELECT numeric_id FROM tenants
WHERE slug = 'nrna'
LIMIT 1;
```

---

## ✅ Best Practices

### DO ✅

```php
// ✅ Use repository interface
private TenantBrandingRepositoryInterface $repository;

// ✅ Inject model via constructor
public function __construct(TenantBrandingModel $model) {}

// ✅ Use ForTenant pattern
$repository->findForTenant($tenantId);

// ✅ Map in repository, not in model
private function toDomain(TenantBrandingModel $model): TenantBranding

// ✅ Use dynamic connection
$connection = $this->model->getConnectionName();

// ✅ Validate tenant exists before save
if (!$tenant) {
    throw new \RuntimeException("Tenant not found");
}
```

### DON'T ❌

```php
// ❌ Don't use model directly in domain
use App\Contexts\Platform\Infrastructure\Models\TenantBrandingModel;

// ❌ Don't hardcode connection
DB::connection('landlord')->table('tenant_brandings')

// ❌ Don't add business logic to model
class TenantBrandingModel {
    public function validateBranding() {} // WRONG!
}

// ❌ Don't bypass repository
TenantBrandingModel::where('tenant_slug', $slug)->first();

// ❌ Don't expose database details to domain
return $model->toArray(); // Leaks database structure
```

---

## 🚀 Performance Considerations

### Indexing Strategy

**tenant_slug (UNIQUE INDEX)**
- Primary lookup key
- Used in all ForTenant operations
- Ensures one-to-one relationship

**tenant_db_id (INDEX)**
- Foreign key reference
- Used for cascade deletes
- Enforces referential integrity

### Query Optimization

**Use exists() for checks:**
```php
// ✅ Efficient
$exists = $repository->existsForTenant($tenantId);

// ❌ Inefficient
$exists = $repository->findForTenant($tenantId) !== null;
```

**updateOrCreate for saves:**
```php
// ✅ Atomic operation, prevents race conditions
$this->model->updateOrCreate(
    ['tenant_slug' => $tenantSlug],
    $data
);
```

### Caching Considerations

**Future enhancement:**
```php
// Could cache branding by tenant slug
Cache::remember("branding:{$tenantSlug}", 3600, function() {
    return $this->repository->findForTenant($tenantId);
});
```

---

## 🔒 Security & Validation

### Tenant Isolation

**Repository enforces tenant boundaries:**
```php
// ✅ Only returns data for specified tenant
$repository->findForTenant($tenantId);

// ✅ Cannot query other tenants
$repository->findForTenant(TenantId::fromSlug('nrna'));
// Returns ONLY 'nrna' branding, never 'munich' branding
```

### Foreign Key Constraint

**Database enforces tenant existence:**
```sql
FOREIGN KEY (tenant_db_id)
REFERENCES tenants(numeric_id)
ON DELETE CASCADE;
```

**Benefits:**
- Cannot create branding for non-existent tenant
- Cascading delete when tenant removed
- Database-level integrity guarantee

### Input Validation

**Validation happens in domain layer:**
- Repository receives ONLY valid TenantBranding aggregates
- Domain exceptions thrown BEFORE database access
- Repository trusts domain model validity

---

## 📊 Testing Infrastructure

### Test Database Configuration

**Production:**
```php
'landlord' => [
    'driver' => 'pgsql',
    'database' => 'publicdigit',
    // ...
],
```

**Testing:**
```php
'landlord_test' => [
    'driver' => 'pgsql',
    'database' => 'publicdigit_test',
    // ...
],
```

### Test Setup Pattern

```php
use Illuminate\Foundation\Testing\RefreshDatabase;

class EloquentTenantBrandingRepositoryTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'landlord_test']);
    }

    protected function setUp(): void
    {
        parent::setUp();

        // Run context migrations
        $this->artisan('migrate', [
            '--database' => 'landlord_test',
            '--path' => 'app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord',
            '--realpath' => true,
        ]);

        // Create test tenants
        $this->createTestTenant('nrna', 1);

        // Inject repository
        $this->repository = new EloquentTenantBrandingRepository(
            new TenantBrandingModel()
        );
    }
}
```

---

## 🔧 Troubleshooting

### Issue: Wrong Database Connection

**Symptom:**
```
SQLSTATE[42P01]: Undefined table: tenant_brandings
```

**Cause:** Migrations ran on wrong database

**Fix:**
```php
// Ensure migrations use default connection
Schema::create('tenant_brandings', function (Blueprint $table) {
    // NOT: Schema::connection('landlord')->create(...)
});

// Set default connection in test
protected function beforeRefreshingDatabase(): void
{
    config(['database.default' => 'landlord_test']);
}
```

### Issue: Tenant Not Found

**Symptom:**
```
RuntimeException: Tenant with slug 'nrna' not found
```

**Cause:** Missing tenant record in test database

**Fix:**
```php
protected function setUp(): void
{
    // Create test tenant BEFORE repository operations
    $this->createTestTenant('nrna', 1);
}
```

### Issue: NULL tenant_db_id

**Symptom:**
```
SQLSTATE[23502]: Not null violation: tenant_db_id
```

**Cause:** Repository not resolving tenant_db_id

**Fix:**
```php
// Repository must resolve tenant_db_id from slug
$tenant = DB::connection($connection)
    ->table('tenants')
    ->where('slug', $tenantSlug)
    ->first();

$data['tenant_db_id'] = $tenant->numeric_id;
```

---

**Next:** [Testing Guide](./04_testing_guide.md)

---

**Last Updated:** 2026-01-06
**Status:** ✅ Production Ready
