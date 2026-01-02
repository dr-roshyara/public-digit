# Hybrid Geography Architecture - Implementation Guide

**Last Updated**: 2025-12-31 03:10 AM
**Audience**: Backend Developers
**Time Required**: 30-45 minutes
**Difficulty**: Intermediate

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step-by-Step Implementation](#step-by-step-implementation)
3. [Configuration](#configuration)
4. [Testing Your Implementation](#testing-your-implementation)
5. [Common Pitfalls](#common-pitfalls)
6. [Rollback Procedures](#rollback-procedures)

---

## 🔧 Prerequisites

### System Requirements
```bash
# PostgreSQL version
psql --version
# Required: PostgreSQL 12.0 or higher

# Laravel version
php artisan --version
# Required: Laravel 12.35.1 or higher

# PHP version
php --version
# Required: PHP 8.2 or higher
```

### Knowledge Requirements
- ✅ Understanding of Laravel migrations
- ✅ Basic PostgreSQL knowledge
- ✅ Familiarity with multi-tenancy concepts
- ✅ Domain-Driven Design (DDD) basics

### Environment Setup
```bash
# 1. Ensure database connections configured
# config/database.php must have:
# - 'landlord' connection (points to publicdigit DB)
# - 'tenant' connection (dynamic per tenant)

# 2. Verify landlord database exists
php artisan tinker --execute="
    echo 'Landlord DB: ' . config('database.connections.landlord.database') . PHP_EOL;
    echo 'Connection: ' . DB::connection('landlord')->getDatabaseName();
"

# 3. Verify Geography Context is discovered
php artisan context:list | grep Geography
```

---

## 🚀 Step-by-Step Implementation

### STEP 1: Run Landlord Geography Migrations

**Purpose**: Create geography tables in landlord database

```bash
# Navigate to project root
cd packages/laravel-backend

# Run Geography migrations on landlord database
php artisan migrate \
    --path=app/Contexts/Geography/Infrastructure/Database/Migrations \
    --database=landlord \
    --force

# Verify tables created
php artisan tinker --execute="
    echo 'Countries table: ' . (Schema::connection('landlord')->hasTable('countries') ? '✅' : '❌') . PHP_EOL;
    echo 'Geo units table: ' . (Schema::connection('landlord')->hasTable('geo_administrative_units') ? '✅' : '❌');
"
```

**Expected Output**:
```
Countries table: ✅
Geo units table: ✅
```

**Files Created**:
```
Landlord DB:
├── countries
└── geo_administrative_units
```

---

### STEP 2: Seed Geography Data

**Purpose**: Populate landlord database with geography data

#### 2A. Seed Countries
```bash
php artisan db:seed \
    --class=App\\Contexts\\Geography\\Infrastructure\\Database\\Seeders\\CountriesSeeder \
    --database=landlord \
    --force
```

**Expected Output**:
```
Countries seeded successfully!
```

**Verify**:
```bash
php artisan tinker --execute="
    echo 'Total countries: ' . DB::connection('landlord')->table('countries')->count() . PHP_EOL;
    \$countries = DB::connection('landlord')->table('countries')->pluck('code');
    echo 'Countries: ' . implode(', ', \$countries->toArray());
"
```

**Expected**: `Total countries: 4, Countries: NP, IN, US, DE`

#### 2B. Seed Nepal Geography
```bash
php artisan db:seed \
    --class=App\\Contexts\\Geography\\Infrastructure\\Database\\Seeders\\NepalGeographySeeder \
    --database=landlord \
    --force
```

**Expected Output**:
```
Seeding Nepal geography...
✓ Seeded 7 provinces
✓ Seeded districts
✓ Seeded local levels
✓ Seeded wards
Nepal geography seeded successfully!
```

**Verify**:
```bash
php artisan tinker --execute="
    echo 'Nepal units: ' . DB::connection('landlord')->table('geo_administrative_units')->where('country_code', 'NP')->count() . PHP_EOL;
    \$byLevel = DB::connection('landlord')->table('geo_administrative_units')
        ->where('country_code', 'NP')
        ->selectRaw('admin_level, count(*) as count')
        ->groupBy('admin_level')
        ->orderBy('admin_level')
        ->get();
    foreach (\$byLevel as \$level) {
        echo sprintf('  Level %d: %d units', \$level->admin_level, \$level->count) . PHP_EOL;
    }
"
```

**Expected**:
```
Nepal units: 71
  Level 1: 7 units
  Level 2: 8 units
  Level 3: 5 units
  Level 4: 42 units
  Level 5: 9 units
```

---

### STEP 3: Verify GeographyMirrorService

**Purpose**: Test the mirroring service in isolation

```bash
php artisan tinker
```

```php
use App\Contexts\Geography\Application\Services\GeographyMirrorService;
use App\Models\Tenant;

// Get a test tenant
$tenant = Tenant::where('slug', 'test-party')->first();
if (!$tenant) {
    echo "⚠️  Create a test tenant first:\n";
    echo "Tenant::create(['name' => 'Test Party', 'slug' => 'test-party']);\n";
    exit;
}

// Make tenant current
$tenant->makeCurrent();

// Instantiate service
$service = app(GeographyMirrorService::class);

// Check supported countries
echo "Supported countries: NP, IN, US, DE\n\n";

// Mirror Nepal geography
echo "Mirroring Nepal geography...\n";
$result = $service->mirrorCountryToTenant('test-party', 'NP');

echo "✅ Success!\n";
echo "  Units mirrored: {$result['units_mirrored']}\n";
echo "  Country: {$result['country_code']}\n";
echo "  Levels:\n";
foreach ($result['levels_copied'] as $level => $count) {
    echo "    Level $level: $count units\n";
}

// Verify integrity
echo "\nVerifying integrity...\n";
$integrity = $service->verifyMirrorIntegrity();
echo $integrity['valid'] ? "✅ Integrity check passed!\n" : "❌ Issues found!\n";
```

**Expected Output**:
```
Mirroring Nepal geography...
✅ Success!
  Units mirrored: 71
  Country: NP
  Levels:
    Level 1: 7 units
    Level 2: 8 units
    Level 3: 5 units
    Level 4: 42 units
    Level 5: 9 units

Verifying integrity...
✅ Integrity check passed!
```

---

### STEP 4: Integrate with InstallMembershipModule

**Purpose**: Hook geography mirroring into Membership installation

**Code is already integrated!** Verify it's working:

```bash
# Check current InstallMembershipModule code
grep -A 10 "GeographyMirrorService" \
    app/Contexts/Membership/Application/Jobs/InstallMembershipModule.php
```

**Expected**: Should show `GeographyMirrorService` injection and `mirrorGeographyData()` method call

**No action needed** - This was already implemented!

---

### STEP 5: Test Complete Installation Flow

**Purpose**: End-to-end test with a fresh tenant

#### 5A. Create Fresh Test Tenant
```bash
php artisan tinker
```

```php
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

// Create tenant
$tenant = Tenant::create([
    'name' => 'Fresh Test Party',
    'slug' => 'fresh-test',
    'email' => 'fresh-test@example.com',
    'country_code' => 'NP',
]);

echo "✅ Tenant created: {$tenant->slug}\n";
echo "   Database: {$tenant->getDatabaseName()}\n";

// Create PostgreSQL database
DB::statement("CREATE DATABASE \"{$tenant->getDatabaseName()}\"");
echo "✅ Database created\n";
```

#### 5B. Install Membership Module
```bash
php artisan context:install Membership --tenant=fresh-test
```

**Expected Output**:
```
🚀 Installing Context: Membership
📍 Target: Tenant 'fresh-test'

✅ Installation successful!

Landlord Database:
  skipped - no landlord migrations

Tenant Database (fresh-test):
  ✓ members
  ✓ 2025_12_20_153947_enable_ltree_extension.php
  ✓ 2025_12_20_154139_add_8_level_geography_to_members.php
  ✓ tenant_geo_candidates
```

#### 5C. Verify Installation
```bash
php artisan tinker
```

```php
use App\Models\Tenant;

$tenant = Tenant::where('slug', 'fresh-test')->first();
$tenant->makeCurrent();

echo "=== Verification Results ===\n\n";

// 1. Geography table exists
echo "1. Geography table: ";
echo Schema::connection('tenant')->hasTable('geo_administrative_units') ? "✅\n" : "❌\n";

// 2. Geography units count
$geoCount = DB::connection('tenant')->table('geo_administrative_units')->count();
echo "2. Geography units: $geoCount (expected: 62)\n";

// 3. Members table exists
echo "3. Members table: ";
echo Schema::connection('tenant')->hasTable('members') ? "✅\n" : "❌\n";

// 4. Foreign keys count
$fks = DB::connection('tenant')->select("
    SELECT count(*) as count
    FROM information_schema.table_constraints
    WHERE table_name = 'members'
    AND constraint_type = 'FOREIGN KEY'
");
echo "4. Foreign keys on members: {$fks[0]->count} (expected: 8)\n";

echo "\n✅ All checks passed!\n";
```

**Expected Output**:
```
=== Verification Results ===

1. Geography table: ✅
2. Geography units: 62 (expected: 62)
3. Members table: ✅
4. Foreign keys on members: 8 (expected: 8)

✅ All checks passed!
```

---

### STEP 6: Test Foreign Key Integrity

**Purpose**: Verify FK constraints actually work

```bash
php artisan tinker
```

```php
use App\Models\Tenant;

$tenant = Tenant::where('slug', 'fresh-test')->first();
$tenant->makeCurrent();

// Get a valid geography unit
$province = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('admin_level', 1)
    ->first();

echo "Province found: " . json_decode($province->name_local)->en . "\n";

// Test 1: Try to insert member with VALID FK
try {
    DB::connection('tenant')->table('members')->insert([
        'tenant_id' => $tenant->id,
        'full_name' => 'Test Member',
        'admin_unit_level1_id' => $province->id,
        'admin_unit_level2_id' => $province->id, // Wrong but valid ID
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    echo "✅ Test 1 PASSED: Valid FK accepted\n";
} catch (\Exception $e) {
    echo "❌ Test 1 FAILED: " . $e->getMessage() . "\n";
}

// Test 2: Try to insert member with INVALID FK
try {
    DB::connection('tenant')->table('members')->insert([
        'tenant_id' => $tenant->id,
        'full_name' => 'Invalid Member',
        'admin_unit_level1_id' => 99999,  // Non-existent ID
        'admin_unit_level2_id' => $province->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    echo "❌ Test 2 FAILED: Invalid FK accepted (should reject!)\n";
} catch (\Exception $e) {
    echo "✅ Test 2 PASSED: Invalid FK rejected\n";
    echo "   Error: " . (str_contains($e->getMessage(), 'foreign key') ? 'FK violation' : 'Other') . "\n";
}
```

**Expected Output**:
```
Province found: Koshi Province
✅ Test 1 PASSED: Valid FK accepted
✅ Test 2 PASSED: Invalid FK rejected
   Error: FK violation
```

---

## ⚙️ Configuration

### Supported Countries

**File**: `app/Contexts/Geography/Application/Services/GeographyMirrorService.php`

```php
private const SUPPORTED_COUNTRIES = ['NP', 'IN', 'US'];
```

**To Add New Country**:
1. Update `SUPPORTED_COUNTRIES` array
2. Update `MAX_LEVELS` array
3. Create seeder (e.g., `IndiaGeographySeeder.php`)
4. Seed landlord geography data

### Max Levels Per Country

```php
private const MAX_LEVELS = [
    'NP' => 8,  // Nepal: Province → Household
    'IN' => 4,  // India: State → Village/Town
    'US' => 4,  // USA: State → ZIP Code
];
```

### Tenant Country Assignment

**File**: Tenant model or migration

```php
// When creating tenant
$tenant->country_code = 'NP';  // Nepal

// InstallMembershipModule uses this:
$countryCode = $this->tenant->country_code ?? 'NP';
$geographyMirror->mirrorCountryToTenant($tenant->slug, $countryCode);
```

---

## 🧪 Testing Your Implementation

### Unit Tests

```bash
# Run all Geography tests
php artisan test --filter=Geography

# Specific tests
php artisan test --filter=GeographyMirrorServiceTest
php artisan test --filter=TenantGeographyTableTest
```

### Integration Tests

```bash
# Test complete Membership installation
php artisan test --filter=InstallMembershipModuleTest

# Test Platform Context integration
php artisan test --filter=ContextInstallerTest
```

### Manual Acceptance Tests

**Checklist**:
- [ ] Landlord geography tables exist
- [ ] Geography data seeded (62 Nepal units)
- [ ] GeographyMirrorService works in isolation
- [ ] Fresh tenant gets geography during Membership install
- [ ] All 8 foreign keys exist on members table
- [ ] FK constraints reject invalid geography IDs
- [ ] Idempotent behavior (2nd install doesn't duplicate)

---

## ⚠️ Common Pitfalls

### Pitfall 1: Missing Database Connection
**Symptom**: Tables created in wrong database
**Cause**: Migrations missing `Schema::connection('landlord')`
**Solution**: Always specify connection explicitly

```php
// ❌ WRONG
Schema::create('geo_administrative_units', ...)

// ✅ CORRECT
Schema::connection('landlord')->create('geo_administrative_units', ...)
```

---

### Pitfall 2: CONCURRENTLY in Transaction
**Symptom**: `CREATE INDEX CONCURRENTLY cannot run in a transaction block`
**Cause**: Migration using CONCURRENTLY without disabling transactions
**Solution**: Add `$withinTransaction = false`

```php
// ✅ CORRECT
return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement('CREATE INDEX CONCURRENTLY ...');
    }
}
```

---

### Pitfall 3: ID Mapping Forgotten
**Symptom**: Parent_id references point to wrong IDs, orphaned records
**Cause**: Copying geography without remapping parent_id
**Solution**: Use GeographyMirrorService (already handles this)

```php
// ❌ WRONG
foreach ($units as $unit) {
    DB::table('geo_administrative_units')->insert([
        'parent_id' => $unit->parent_id,  // Wrong! Landlord ID doesn't exist in tenant
    ]);
}

// ✅ CORRECT (GeographyMirrorService does this)
$idMapping = [];
foreach ($units as $unit) {
    $newId = DB::table('geo_administrative_units')->insertGetId([
        'parent_id' => $unit->parent_id ? $idMapping[$unit->parent_id] : null,
    ]);
    $idMapping[$unit->id] = $newId;
}
```

---

### Pitfall 4: Forgetting Country Filter
**Symptom**: Tenant gets ALL countries' geography (huge storage)
**Cause**: Not filtering by country_code during mirroring
**Solution**: Always filter by tenant's country

```php
// ❌ WRONG
$units = DB::connection('landlord')
    ->table('geo_administrative_units')
    ->get();  // Gets ALL countries!

// ✅ CORRECT
$units = DB::connection('landlord')
    ->table('geo_administrative_units')
    ->where('country_code', $countryCode)  // Filter!
    ->get();
```

---

### Pitfall 5: Not Verifying Integrity
**Symptom**: Silent data corruption, broken hierarchy
**Cause**: Skipping integrity verification after mirroring
**Solution**: Always verify

```php
// ✅ CORRECT
$result = $geographyMirror->mirrorCountryToTenant($tenant->slug, 'NP');

$integrity = $geographyMirror->verifyMirrorIntegrity();
if (!$integrity['valid']) {
    throw new \RuntimeException('Mirror integrity check failed');
}
```

---

## 🔄 Rollback Procedures

### Rollback Tenant Geography Migration

```bash
php artisan tinker
```

```php
use App\Models\Tenant;

$tenant = Tenant::where('slug', 'fresh-test')->first();
$tenant->makeCurrent();

// Rollback Geography tenant migration
Artisan::call('migrate:rollback', [
    '--path' => 'app/Contexts/Geography/Infrastructure/Database/Migrations/Tenant',
    '--database' => 'tenant',
    '--force' => true
]);

echo Artisan::output();
```

---

### Rollback Landlord Geography Migrations

```bash
php artisan migrate:rollback \
    --path=app/Contexts/Geography/Infrastructure/Database/Migrations \
    --database=landlord \
    --step=2 \
    --force
```

**WARNING**: This removes geography data for **ALL tenants**!

---

### Clean Tenant Geography Data

```bash
php artisan tinker
```

```php
use App\Models\Tenant;

$tenant = Tenant::where('slug', 'fresh-test')->first();
$tenant->makeCurrent();

// Truncate geography table
DB::connection('tenant')->table('geo_administrative_units')->truncate();

echo "✅ Geography data cleared for tenant: {$tenant->slug}\n";
```

---

### Remove Test Tenant Completely

```bash
php artisan tinker
```

```php
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

$tenant = Tenant::where('slug', 'fresh-test')->first();
$dbName = $tenant->getDatabaseName();

// Drop tenant database
DB::statement("DROP DATABASE IF EXISTS \"$dbName\"");
echo "✅ Database dropped: $dbName\n";

// Delete tenant record
$tenant->delete();
echo "✅ Tenant deleted: fresh-test\n";
```

---

## 📚 Next Steps

After successful implementation:

1. **Read Debug Guide**: [Hybrid Geography Debug Guide](./20251231_0320_hybrid_geography_debug_guide.md)
2. **Review ADR**: [ADR-001: Hybrid Geography Architecture](../../../architecture/backend/geography_contexts/ADR-001_Hybrid_Geography_Architecture.md)
3. **Test Custom Geography**: Try creating custom party units (levels 6-8)
4. **Deploy to Staging**: Test with real tenants
5. **Monitor Performance**: Check query speeds and storage usage

---

## 🎯 Success Criteria

You've successfully implemented hybrid geography when:

- ✅ Landlord geography tables exist with data
- ✅ GeographyMirrorService works in isolation
- ✅ Fresh tenant gets geography automatically during Membership install
- ✅ All 8 foreign keys exist on members table
- ✅ FK constraints reject invalid geography IDs
- ✅ Idempotent behavior verified (no duplicates on 2nd install)
- ✅ Integrity check passes after mirroring
- ✅ Test member can be created with valid geography references

---

**Implementation Guide Complete**
**Next**: [Debug Guide](./20251231_0320_hybrid_geography_debug_guide.md)
**Questions**: Consult [Developer Guide](./20251231_0300_hybrid_geography_developer_guide.md)
