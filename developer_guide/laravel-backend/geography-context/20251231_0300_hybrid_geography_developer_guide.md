# Hybrid Geography Architecture - Developer Guide

**Last Updated**: 2025-12-31 03:00 AM
**Architecture**: Hybrid (Landlord + Tenant Mirroring)
**Status**: Production-Ready
**Complexity**: Intermediate

---

## 📋 Table of Contents

1. [What Was Developed](#what-was-developed)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [How It Works](#how-it-works)
5. [Database Schema](#database-schema)
6. [Code Examples](#code-examples)
7. [Testing Guide](#testing-guide)
8. [API Reference](#api-reference)

---

## 🎯 What Was Developed

### Problem Statement
Political parties need:
- ✅ Official government geography (Provinces → Wards)
- ✅ Custom party units (Neighborhood → Household)
- ✅ Database foreign key integrity for member records
- ✅ Multi-country support (Nepal, India, USA, etc.)

**Technical Challenge**: PostgreSQL doesn't support cross-database foreign keys.

### Solution Implemented
**Hybrid Geography Architecture**:
- **Landlord DB**: Master geography for ALL countries
- **Tenant DB**: Mirrored copy (filtered by country) + custom units
- **Foreign Keys**: Work because geography + members are in SAME database

---

## 🏗️ Architecture Overview

### System Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│ LANDLORD DATABASE (publicdigit)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  geo_administrative_units (GLOBAL MASTER)                       │
│  ├── Nepal (NP): 62 units                                       │
│  ├── India (IN): ~50,000 units                                  │
│  ├── USA (US): ~180,000 units                                   │
│  └── Germany (DE): ~8,000 units                                 │
│                                                                  │
│  countries (ISO 3166-1 data)                                    │
│  ├── NP (Nepal)                                                 │
│  ├── IN (India)                                                 │
│  ├── US (United States)                                         │
│  └── DE (Germany)                                               │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ GeographyMirrorService
                           │ - Country-filtered copy
                           │ - ID mapping algorithm
                           │ - Integrity verification
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ TENANT DATABASE (tenant_nrna)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  geo_administrative_units (TENANT-SPECIFIC)                     │
│  ├── Nepal (NP) units ONLY: 62 units (~15MB)                    │
│  │   ├── Level 1-5: is_official = TRUE (mirrored)              │
│  │   └── Level 6-8: is_official = FALSE (party-created)        │
│  │                                                               │
│  └── Track landlord source via landlord_geo_id                  │
│                                                                  │
│  members                                                         │
│  ├── admin_unit_level1_id FK → geo_administrative_units.id     │
│  ├── admin_unit_level2_id FK → geo_administrative_units.id     │
│  ├── ...                                                         │
│  └── admin_unit_level8_id FK → geo_administrative_units.id     │
│      ✅ FOREIGN KEYS WORK (same database!)                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow
```
1. Tenant Creation
   └→ Membership module installation triggered

2. InstallMembershipModule Job
   ├→ Step 1: Check if geography exists (idempotent)
   │  ├→ IF EXISTS: Skip mirroring
   │  └→ IF NOT EXISTS: Mirror geography
   │
   ├→ Step 2: GeographyMirrorService.mirrorCountryToTenant()
   │  ├→ Fetch geography from landlord (country-filtered)
   │  ├→ Mirror with ID mapping (parent_id remapping)
   │  └→ Verify integrity (no orphaned records)
   │
   └→ Step 3: Install Membership Context
      ├→ Run tenant migrations
      ├→ create_members_table.php (FKs levels 1-4)
      └→ add_8_level_geography_to_members.php (FKs levels 5-8)
      ✅ SUCCESS (FKs work!)
```

---

## 🔧 Core Components

### 1. GeographyMirrorService
**Location**: `app/Contexts/Geography/Application/Services/GeographyMirrorService.php`
**Purpose**: Initial geography provisioning from landlord to tenant

**Public Methods**:
```php
mirrorCountryToTenant(string $tenantSlug, string $countryCode): array
tenantHasGeography(?string $countryCode = null): bool
getMirroringStats(): array
verifyMirrorIntegrity(): array
```

**Key Algorithm**: ID Mapping
```php
$idMapping = []; // landlord_id => tenant_id

foreach ($units as $unit) {
    $newId = DB::connection('tenant')->insertGetId([
        'parent_id' => $unit->parent_id
            ? $idMapping[$unit->parent_id]  // REMAP!
            : null,
        'landlord_geo_id' => $unit->id,     // Track source
    ]);

    $idMapping[$unit->id] = $newId;
}
```

### 2. Tenant Geography Migration
**Location**: `app/Contexts/Geography/Infrastructure/Database/Migrations/Tenant/2025_01_01_000001_create_geo_administrative_units_table.php`

**Creates Table**: `geo_administrative_units` in **TENANT database**

**Tenant-Specific Fields**:
```php
$table->boolean('is_official')->default(true);
// TRUE = Mirrored from landlord (levels 1-5)
// FALSE = Party-created custom (levels 6-8)

$table->unsignedBigInteger('landlord_geo_id')->nullable()->unique();
// Tracks original landlord ID for sync
```

### 3. InstallMembershipModule Integration
**Location**: `app/Contexts/Membership/Application/Jobs/InstallMembershipModule.php`

**Updated to call GeographyMirrorService**:
```php
public function handle(
    ContextInstaller $installer,
    GeographyMirrorService $geographyMirror
): void {
    // STEP 1: Mirror geography
    $this->mirrorGeographyData($geographyMirror);

    // STEP 2: Install Membership (FKs will work)
    $installer->install('Membership', $this->tenant->slug);
}
```

### 4. Members Table Migrations
**Files**:
- `create_members_table.php`: FKs for levels 1-4
- `add_8_level_geography_to_members.php`: FKs for levels 5-8

**Foreign Key Example**:
```php
$table->foreignId('admin_unit_level1_id')
    ->constrained('geo_administrative_units')
    ->onDelete('restrict')
    ->comment('Province - References TENANT.geo_administrative_units');
```

---

## 📊 Database Schema

### Landlord DB: geo_administrative_units
```sql
CREATE TABLE geo_administrative_units (
    id BIGSERIAL PRIMARY KEY,
    country_code CHAR(2) NOT NULL,
    admin_level SMALLINT NOT NULL,
    admin_type VARCHAR(50),
    parent_id BIGINT REFERENCES geo_administrative_units(id),
    code VARCHAR(50) NOT NULL,
    name_local JSONB NOT NULL,
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    UNIQUE(country_code, code)
);

-- Example Data:
-- id | country_code | admin_level | code    | name_local
-- 1  | NP           | 1           | NP-P1   | {"en":"Koshi Province","np":"कोशी प्रदेश"}
-- 8  | NP           | 2           | NP-D08  | {"en":"Bhojpur","np":"भोजपुर"}
```

### Tenant DB: geo_administrative_units
```sql
CREATE TABLE geo_administrative_units (
    id BIGSERIAL PRIMARY KEY,
    country_code CHAR(2) NOT NULL,
    admin_level SMALLINT NOT NULL,
    admin_type VARCHAR(50),
    parent_id BIGINT REFERENCES geo_administrative_units(id),
    code VARCHAR(50) NOT NULL,
    name_local JSONB NOT NULL,
    metadata JSONB,

    -- TENANT-SPECIFIC FIELDS
    is_official BOOLEAN DEFAULT true,       -- Official vs custom
    landlord_geo_id BIGINT UNIQUE,          -- Track landlord source

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    UNIQUE(country_code, code)
);

-- Mirrored Data (is_official = true):
-- id | landlord_geo_id | admin_level | code    | name_local
-- 5  | 1               | 1           | NP-P1   | {"en":"Koshi Province"}
-- 25 | 8               | 2           | NP-D08  | {"en":"Bhojpur"}
--
-- Note: IDs are different (5 vs 1, 25 vs 8) but hierarchy preserved via parent_id mapping
```

### Tenant DB: members
```sql
CREATE TABLE members (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    full_name VARCHAR(255) NOT NULL,

    -- Geography Foreign Keys (ALL 8 LEVELS)
    admin_unit_level1_id BIGINT NOT NULL REFERENCES geo_administrative_units(id),
    admin_unit_level2_id BIGINT NOT NULL REFERENCES geo_administrative_units(id),
    admin_unit_level3_id BIGINT REFERENCES geo_administrative_units(id),
    admin_unit_level4_id BIGINT REFERENCES geo_administrative_units(id),
    admin_unit_level5_id BIGINT REFERENCES geo_administrative_units(id),
    admin_unit_level6_id BIGINT REFERENCES geo_administrative_units(id),
    admin_unit_level7_id BIGINT REFERENCES geo_administrative_units(id),
    admin_unit_level8_id BIGINT REFERENCES geo_administrative_units(id),

    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Foreign Keys Work Because:
-- ✅ geo_administrative_units is in SAME database (tenant DB)
-- ✅ PostgreSQL enforces referential integrity
-- ✅ Cannot delete geography unit if members reference it
```

---

## 💻 Code Examples

### Example 1: Mirror Geography to New Tenant
```php
use App\Contexts\Geography\Application\Services\GeographyMirrorService;
use App\Models\Tenant;

$tenant = Tenant::where('slug', 'new-party')->first();
$tenant->makeCurrent();

$service = app(GeographyMirrorService::class);

// Mirror Nepal geography
$result = $service->mirrorCountryToTenant('new-party', 'NP');

echo "Units mirrored: {$result['units_mirrored']}\n";
echo "Country: {$result['country_code']}\n";
print_r($result['levels_copied']);

// Output:
// Units mirrored: 62
// Country: NP
// Array (
//     [1] => 7
//     [2] => 8
//     [3] => 5
//     [4] => 42
// )
```

### Example 2: Check if Geography Exists (Idempotent)
```php
$service = app(GeographyMirrorService::class);

if ($service->tenantHasGeography('NP')) {
    echo "Geography already exists - skipping mirroring\n";
} else {
    echo "Mirroring geography...\n";
    $service->mirrorCountryToTenant($tenant->slug, 'NP');
}
```

### Example 3: Verify Mirror Integrity
```php
$service = app(GeographyMirrorService::class);

$integrity = $service->verifyMirrorIntegrity();

if ($integrity['valid']) {
    echo "✅ Integrity check passed!\n";
} else {
    echo "❌ Issues found:\n";
    foreach ($integrity['issues'] as $issue) {
        echo "  - $issue\n";
    }
}
```

### Example 4: Get Mirroring Statistics
```php
$service = app(GeographyMirrorService::class);

$stats = $service->getMirroringStats();

foreach ($stats as $country => $levels) {
    echo "Country: $country\n";
    foreach ($levels as $level => $count) {
        echo "  Level $level: $count units\n";
    }
}

// Output:
// Country: NP
//   Level 1: 7 units
//   Level 2: 8 units
//   Level 3: 5 units
//   Level 4: 42 units
```

### Example 5: Create Member with Foreign Keys
```php
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

$tenant = Tenant::where('slug', 'nrna')->first();
$tenant->makeCurrent();

// Get geography units
$province = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('admin_level', 1)
    ->where('code', 'NP-P1')
    ->first();

$district = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('admin_level', 2)
    ->where('parent_id', $province->id)
    ->first();

// Create member (FK constraints enforced!)
DB::connection('tenant')->table('members')->insert([
    'tenant_id' => $tenant->id,
    'full_name' => 'Ram Bahadur Sharma',
    'admin_unit_level1_id' => $province->id,  // FK validated!
    'admin_unit_level2_id' => $district->id,  // FK validated!
    'created_at' => now(),
    'updated_at' => now(),
]);

// ✅ SUCCESS - Foreign keys validated by database
```

### Example 6: Party Creates Custom Geography (Level 6)
```php
$tenant = Tenant::where('slug', 'nrna')->first();
$tenant->makeCurrent();

// Get parent ward (level 4)
$ward = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('admin_level', 4)
    ->where('code', 'NP-W-001')
    ->first();

// Party creates custom "Ward Committee" (level 6)
$committeeId = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->insertGetId([
        'country_code' => 'NP',
        'admin_level' => 6,
        'admin_type' => 'committee',
        'parent_id' => $ward->id,
        'code' => 'NRNA-W001-COM01',
        'name_local' => json_encode([
            'en' => 'Ward 1 Committee',
            'np' => 'वडा १ समिति'
        ]),
        'is_official' => false,           // Party-created!
        'landlord_geo_id' => null,        // No landlord source
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

echo "✅ Custom geography unit created: ID $committeeId\n";
```

---

## 🧪 Testing Guide

### Unit Tests
```bash
# Test GeographyMirrorService
php artisan test --filter=GeographyMirrorServiceTest

# Test tenant geography migration
php artisan test --filter=TenantGeographyTableTest

# Test Membership installation
php artisan test --filter=InstallMembershipModuleTest
```

### Manual Testing
```bash
# 1. Create test tenant
php artisan tinker
>>> $tenant = Tenant::create(['name' => 'Test Party', 'slug' => 'test-party']);

# 2. Install Membership (triggers geography mirroring)
php artisan context:install Membership --tenant=test-party

# 3. Verify geography
php artisan tinker
>>> $tenant = Tenant::where('slug', 'test-party')->first();
>>> $tenant->makeCurrent();
>>> DB::connection('tenant')->table('geo_administrative_units')->count();
// Should return 62 (for Nepal)

# 4. Verify FKs
>>> Schema::connection('tenant')->getForeignKeys('members');
// Should show 8 foreign keys (levels 1-8)
```

---

## 📚 API Reference

### GeographyMirrorService

#### `mirrorCountryToTenant(string $tenantSlug, string $countryCode): array`
**Purpose**: Mirror geography from landlord to tenant database

**Parameters**:
- `$tenantSlug`: Tenant identifier
- `$countryCode`: ISO 3166-1 alpha-2 code (NP, IN, US, DE)

**Returns**:
```php
[
    'units_mirrored' => 62,
    'country_code' => 'NP',
    'levels_copied' => [
        1 => 7,
        2 => 8,
        3 => 5,
        4 => 42
    ]
]
```

**Throws**: `InvalidArgumentException` if country not supported

---

#### `tenantHasGeography(?string $countryCode = null): bool`
**Purpose**: Check if tenant already has geography data

**Parameters**:
- `$countryCode`: Optional country filter

**Returns**: `true` if geography exists, `false` otherwise

---

#### `getMirroringStats(): array`
**Purpose**: Get statistics of mirrored units by country and level

**Returns**:
```php
[
    'NP' => [
        1 => 7,
        2 => 8,
        3 => 5,
        4 => 42
    ]
]
```

---

#### `verifyMirrorIntegrity(): array`
**Purpose**: Verify that all parent_id references are valid

**Returns**:
```php
[
    'valid' => true,
    'issues' => []
]

// OR if issues found:
[
    'valid' => false,
    'issues' => [
        'Unit Ward-1 (ID: 50) references non-existent parent_id: 999'
    ]
]
```

---

## 🎯 Best Practices

### 1. Always Check if Geography Exists
```php
// ✅ GOOD
if (!$geographyMirror->tenantHasGeography($countryCode)) {
    $geographyMirror->mirrorCountryToTenant($tenant->slug, $countryCode);
}

// ❌ BAD
$geographyMirror->mirrorCountryToTenant($tenant->slug, $countryCode);
// May duplicate data or fail
```

### 2. Always Verify Integrity After Mirroring
```php
// ✅ GOOD
$result = $geographyMirror->mirrorCountryToTenant($tenant->slug, 'NP');
$integrity = $geographyMirror->verifyMirrorIntegrity();

if (!$integrity['valid']) {
    throw new \RuntimeException('Mirror integrity check failed');
}

// ❌ BAD
$geographyMirror->mirrorCountryToTenant($tenant->slug, 'NP');
// Continue without verification
```

### 3. Log Mirroring Operations
```php
// ✅ GOOD
Log::info('Starting geography mirroring', [
    'tenant' => $tenant->slug,
    'country' => $countryCode
]);

$result = $geographyMirror->mirrorCountryToTenant($tenant->slug, $countryCode);

Log::info('Geography mirroring completed', [
    'units_mirrored' => $result['units_mirrored'],
    'levels' => $result['levels_copied']
]);
```

### 4. Handle Errors Gracefully
```php
// ✅ GOOD
try {
    $result = $geographyMirror->mirrorCountryToTenant($tenant->slug, 'NP');
} catch (\InvalidArgumentException $e) {
    Log::error('Invalid country code', ['error' => $e->getMessage()]);
    throw $e;
} catch (\Exception $e) {
    Log::error('Geography mirroring failed', [
        'tenant' => $tenant->slug,
        'error' => $e->getMessage()
    ]);
    throw $e;
}
```

---

## 📖 Related Documentation

- [Implementation Guide](./20251231_0310_hybrid_geography_implementation_guide.md)
- [Debug Guide](./20251231_0320_hybrid_geography_debug_guide.md)
- [ADR-001: Hybrid Geography Architecture](../../../architecture/backend/geography_contexts/ADR-001_Hybrid_Geography_Architecture.md)
- [Implementation Complete Summary](../../../architecture/backend/geography_contexts/20251231_0200_HYBRID_IMPLEMENTATION_COMPLETE.md)

---

**Last Updated**: 2025-12-31 03:00 AM
**Maintained By**: Backend Team
**Questions**: Consult ADR-001 or debug guide
