# Hybrid Geography Architecture - Debug Guide

**Last Updated**: 2025-12-31 03:20 AM
**Audience**: Developers, DevOps
**Purpose**: Troubleshooting common issues
**Difficulty**: Intermediate

---

## 📋 Table of Contents

1. [Diagnostic Commands](#diagnostic-commands)
2. [Common Errors](#common-errors)
3. [Database Issues](#database-issues)
4. [Migration Problems](#migration-problems)
5. [FK Constraint Failures](#fk-constraint-failures)
6. [Performance Issues](#performance-issues)
7. [Data Integrity Problems](#data-integrity-problems)

---

## 🔍 Diagnostic Commands

### Check Landlord Geography Status
```bash
php artisan tinker --execute="
echo '=== Landlord Geography Status ===' . PHP_EOL;
echo 'Countries table: ' . (Schema::connection('landlord')->hasTable('countries') ? '✅' : '❌') . PHP_EOL;
echo 'Geo units table: ' . (Schema::connection('landlord')->hasTable('geo_administrative_units') ? '✅' : '❌') . PHP_EOL;
echo 'Countries count: ' . DB::connection('landlord')->table('countries')->count() . PHP_EOL;
echo 'Nepal units: ' . DB::connection('landlord')->table('geo_administrative_units')->where('country_code', 'NP')->count() . PHP_EOL;
"
```

**Expected**:
```
=== Landlord Geography Status ===
Countries table: ✅
Geo units table: ✅
Countries count: 4
Nepal units: 62
```

---

### Check Tenant Geography Status
```bash
php artisan tinker --execute="
use App\Models\Tenant;

\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

echo '=== Tenant Geography Status ===' . PHP_EOL;
echo 'Tenant: ' . \$tenant->slug . PHP_EOL;
echo 'Database: ' . config('database.connections.tenant.database') . PHP_EOL;
echo 'Geo table exists: ' . (Schema::connection('tenant')->hasTable('geo_administrative_units') ? '✅' : '❌') . PHP_EOL;
echo 'Geo units count: ' . DB::connection('tenant')->table('geo_administrative_units')->count() . PHP_EOL;
echo 'Members table exists: ' . (Schema::connection('tenant')->hasTable('members') ? '✅' : '❌') . PHP_EOL;
"
```

---

### Check Foreign Keys
```bash
php artisan tinker --execute="
use App\Models\Tenant;

\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

\$fks = DB::connection('tenant')->select(\"
    SELECT
        tc.constraint_name,
        kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'members'
        AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY kcu.column_name
\");

echo '=== Foreign Keys on Members Table ===' . PHP_EOL;
foreach (\$fks as \$fk) {
    echo '  ✓ ' . \$fk->column_name . ' (' . \$fk->constraint_name . ')' . PHP_EOL;
}
echo 'Total: ' . count(\$fks) . ' foreign keys' . PHP_EOL;
"
```

**Expected**: 8 foreign keys (admin_unit_level1_id through admin_unit_level8_id)

---

### Check Migration Status
```bash
# Landlord migrations
php artisan migrate:status --database=landlord | grep geo

# Tenant migrations
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();
"

php artisan migrate:status --database=tenant | grep geo
```

---

### Verify ID Mapping
```bash
php artisan tinker --execute="
use App\Models\Tenant;

\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

// Get a district with parent
\$district = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('admin_level', 2)
    ->whereNotNull('parent_id')
    ->first();

if (\$district) {
    \$province = DB::connection('tenant')
        ->table('geo_administrative_units')
        ->find(\$district->parent_id);

    echo '=== ID Mapping Verification ===' . PHP_EOL;
    echo 'District: ' . json_decode(\$district->name_local)->en . PHP_EOL;
    echo '  Tenant ID: ' . \$district->id . PHP_EOL;
    echo '  Parent ID (tenant): ' . \$district->parent_id . PHP_EOL;
    echo '  Landlord ID: ' . \$district->landlord_geo_id . PHP_EOL;

    echo 'Province: ' . json_decode(\$province->name_local)->en . PHP_EOL;
    echo '  Tenant ID: ' . \$province->id . PHP_EOL;
    echo '  Landlord ID: ' . \$province->landlord_geo_id . PHP_EOL;

    // Verify landlord relationship
    \$landlordDistrict = DB::connection('landlord')
        ->table('geo_administrative_units')
        ->find(\$district->landlord_geo_id);

    if (\$landlordDistrict->parent_id == \$province->landlord_geo_id) {
        echo PHP_EOL . '✅ ID mapping correct!' . PHP_EOL;
    } else {
        echo PHP_EOL . '❌ ID mapping broken!' . PHP_EOL;
    }
}
"
```

---

## 🐛 Common Errors

### Error 1: "geo_administrative_units table not found"

**Full Error**:
```
SQLSTATE[42P01]: Undefined table: 7 FEHLER: Relation "geo_administrative_units" existiert nicht
```

**Cause**: Geography not mirrored to tenant database

**Diagnosis**:
```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();
echo Schema::connection('tenant')->hasTable('geo_administrative_units') ? 'Table EXISTS' : 'Table MISSING';
"
```

**Solutions**:

**Option A**: Run Geography tenant migration manually
```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

Artisan::call('migrate', [
    '--path' => 'app/Contexts/Geography/Infrastructure/Database/Migrations/Tenant',
    '--database' => 'tenant',
    '--force' => true
]);

echo Artisan::output();
"
```

**Option B**: Re-run Membership installation (will trigger mirroring)
```bash
# First rollback Membership
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

Artisan::call('migrate:rollback', [
    '--path' => 'app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant',
    '--database' => 'tenant',
    '--force' => true
]);
"

# Then re-install
php artisan context:install Membership --tenant=YOUR-TENANT
```

---

### Error 2: "CREATE INDEX CONCURRENTLY cannot run in a transaction block"

**Full Error**:
```
SQLSTATE[25001]: Active sql transaction: 7 FEHLER: CREATE INDEX CONCURRENTLY kann nicht in einem Transaktionsblock laufen
```

**Cause**: Migration using CONCURRENTLY without disabling transactions

**Diagnosis**:
```bash
grep -n "CREATE INDEX CONCURRENTLY" \
    app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/*.php
```

**Solution**: Check if `$withinTransaction = false` is set

```bash
# Verify fix is applied
grep -B5 "CREATE INDEX CONCURRENTLY" \
    app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/2025_12_20_154139_add_8_level_geography_to_members.php | \
    grep withinTransaction
```

**Expected**: `public $withinTransaction = false;`

**If missing**, add to migration:
```php
return new class extends Migration
{
    public $withinTransaction = false;  // ADD THIS

    public function up(): void
    {
        DB::statement('CREATE INDEX CONCURRENTLY ...');
    }
}
```

---

### Error 3: "Parent unit not found in mapping"

**Full Error**:
```
RuntimeException: Parent unit ID 5 not mirrored yet for child unit ID 12
```

**Cause**: Geography units not ordered by admin_level during mirroring

**Diagnosis**:
```bash
# Check if landlord data is properly ordered
php artisan tinker --execute="
\$unitsOutOfOrder = DB::connection('landlord')
    ->table('geo_administrative_units')
    ->where('country_code', 'NP')
    ->whereNotNull('parent_id')
    ->get()
    ->filter(function (\$unit) {
        \$parent = DB::connection('landlord')
            ->table('geo_administrative_units')
            ->find(\$unit->parent_id);
        return \$parent && \$parent->admin_level >= \$unit->admin_level;
    });

echo count(\$unitsOutOfOrder) . ' units with invalid hierarchy' . PHP_EOL;
"
```

**Solution**: Verify GeographyMirrorService orders by admin_level

```php
// Check this line exists in GeographyMirrorService.php
$units = DB::connection('landlord')
    ->table('geo_administrative_units')
    ->where('country_code', $countryCode)
    ->orderBy('admin_level')  // CRITICAL: Parents before children
    ->orderBy('id')
    ->get();
```

---

### Error 4: "Foreign key violation"

**Full Error**:
```
SQLSTATE[23503]: Foreign key violation: insert or update on table "members" violates foreign key constraint
```

**Cause**: Trying to insert member with non-existent geography ID

**Diagnosis**:
```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

// Check if geography ID exists
\$geoId = 99999;  // Replace with failing ID
\$exists = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('id', \$geoId)
    ->exists();

echo 'Geography ID ' . \$geoId . ': ' . (\$exists ? '✅ EXISTS' : '❌ NOT FOUND') . PHP_EOL;
"
```

**Solution**: Use valid geography IDs

```php
// Get valid geography units
$province = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('admin_level', 1)
    ->where('is_active', true)
    ->first();

$district = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('admin_level', 2)
    ->where('parent_id', $province->id)
    ->where('is_active', true)
    ->first();

// Use these IDs
DB::table('members')->insert([
    'admin_unit_level1_id' => $province->id,
    'admin_unit_level2_id' => $district->id,
]);
```

---

### Error 5: "Database does not exist"

**Full Error**:
```
SQLSTATE[08006]: connection failed: FATAL: Datenbank "tenant_xyz" existiert nicht
```

**Cause**: Tenant database not created

**Diagnosis**:
```bash
# List all databases
php artisan tinker --execute="
\$databases = DB::select('SELECT datname FROM pg_database WHERE datistemplate = false');
echo 'Databases:' . PHP_EOL;
foreach (\$databases as \$db) {
    echo '  - ' . \$db->datname . PHP_EOL;
}
"
```

**Solution**: Create tenant database

```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$dbName = \$tenant->getDatabaseName();

DB::statement(\"CREATE DATABASE \\\"\$dbName\\\"\");
echo '✅ Database created: ' . \$dbName . PHP_EOL;
"
```

---

## 🗄️ Database Issues

### Orphaned Records (parent_id points to non-existent ID)

**Symptom**: Integrity check fails, orphaned units found

**Diagnosis**:
```bash
php artisan tinker --execute="
use App\Contexts\Geography\Application\Services\GeographyMirrorService;
use App\Models\Tenant;

\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

\$service = app(GeographyMirrorService::class);
\$integrity = \$service->verifyMirrorIntegrity();

if (!\$integrity['valid']) {
    echo '❌ Orphaned records found:' . PHP_EOL;
    foreach (\$integrity['issues'] as \$issue) {
        echo '  - ' . \$issue . PHP_EOL;
    }
} else {
    echo '✅ No orphaned records' . PHP_EOL;
}
"
```

**Solution**: Re-mirror geography

```bash
# 1. Backup existing data (if any members exist)
# 2. Truncate geography
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

DB::connection('tenant')->table('geo_administrative_units')->truncate();
echo '✅ Geography truncated' . PHP_EOL;
"

# 3. Re-mirror
php artisan tinker --execute="
use App\Contexts\Geography\Application\Services\GeographyMirrorService;
use App\Models\Tenant;

\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

\$service = app(GeographyMirrorService::class);
\$result = \$service->mirrorCountryToTenant(\$tenant->slug, 'NP');

echo '✅ Mirrored: ' . \$result['units_mirrored'] . ' units' . PHP_EOL;
"
```

---

### Duplicate Geography Units

**Symptom**: Same unit appears multiple times

**Diagnosis**:
```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

\$duplicates = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->selectRaw('code, count(*) as count')
    ->groupBy('code')
    ->having(DB::raw('count(*)'), '>', 1)
    ->get();

if (\$duplicates->isEmpty()) {
    echo '✅ No duplicates found' . PHP_EOL;
} else {
    echo '❌ Duplicates found:' . PHP_EOL;
    foreach (\$duplicates as \$dup) {
        echo '  - ' . \$dup->code . ' (appears ' . \$dup->count . ' times)' . PHP_EOL;
    }
}
"
```

**Solution**: Re-mirror after clearing duplicates

```bash
# 1. Backup data
# 2. Delete ALL geography
# 3. Re-mirror (see previous solution)
```

---

### Missing landlord_geo_id

**Symptom**: Cannot sync updates from landlord

**Diagnosis**:
```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

\$missingLandlordId = DB::connection('tenant')
    ->table('geo_administrative_units')
    ->where('is_official', true)
    ->whereNull('landlord_geo_id')
    ->count();

echo 'Official units without landlord_geo_id: ' . \$missingLandlordId . PHP_EOL;
"
```

**Solution**: Re-mirror (landlord_geo_id is set during mirroring)

---

## 🚨 Migration Problems

### Migration Already Ran (Can't Modify)

**Symptom**: Changed migration but changes not applied

**Cause**: Migration already in `migrations` table

**Diagnosis**:
```bash
php artisan migrate:status --database=tenant | grep members
```

**Solution A**: Rollback and re-run
```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

Artisan::call('migrate:rollback', [
    '--path' => 'app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant',
    '--database' => 'tenant',
    '--step' => 1,
    '--force' => true
]);

Artisan::call('migrate', [
    '--path' => 'app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant',
    '--database' => 'tenant',
    '--force' => true
]);

echo Artisan::output();
"
```

**Solution B**: Create new migration for changes
```bash
php artisan make:migration add_missing_fks_to_members_table \
    --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant
```

---

### Can't Rollback (FK Constraints)

**Symptom**: Rollback fails due to FK constraints

**Full Error**:
```
SQLSTATE[23503]: cannot drop table geo_administrative_units because other objects depend on it
```

**Solution**: Drop dependent tables first

```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

// Drop members table first (has FKs to geography)
Schema::connection('tenant')->dropIfExists('members');

// Now drop geography
Schema::connection('tenant')->dropIfExists('geo_administrative_units');

echo '✅ Tables dropped' . PHP_EOL;
"
```

---

## 🔗 FK Constraint Failures

### FK Constraint on Level 1-4 Missing

**Symptom**: Only 4 FKs exist (levels 5-8), missing levels 1-4

**Cause**: Migration ran before FKs were added to `create_members_table.php`

**Diagnosis**:
```bash
# Check FK count
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

\$fkCount = DB::connection('tenant')->select(\"
    SELECT count(*) as count
    FROM information_schema.table_constraints
    WHERE table_name = 'members'
    AND constraint_type = 'FOREIGN KEY'
\");

echo 'FK count: ' . \$fkCount[0]->count . ' (expected: 8)' . PHP_EOL;
"
```

**Solution**: Create alter migration

```bash
# Create new migration
php artisan make:migration add_fks_levels_1_4_to_members_table \
    --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant
```

```php
// In migration file:
public function up(): void
{
    Schema::table('members', function (Blueprint $table) {
        // Check if FKs already exist before adding
        if (!$this->foreignKeyExists('members', 'members_admin_unit_level1_id_foreign')) {
            $table->foreign('admin_unit_level1_id')
                ->references('id')
                ->on('geo_administrative_units')
                ->onDelete('restrict');
        }

        // Repeat for levels 2-4
    });
}

private function foreignKeyExists(string $table, string $constraint): bool
{
    $result = DB::select("
        SELECT count(*) as count
        FROM information_schema.table_constraints
        WHERE table_name = ? AND constraint_name = ?
    ", [$table, $constraint]);

    return $result[0]->count > 0;
}
```

---

## ⚡ Performance Issues

### Slow Geography Mirroring

**Symptom**: Mirroring takes >30 seconds

**Diagnosis**:
```bash
# Time the mirroring
time php artisan tinker --execute="
use App\Contexts\Geography\Application\Services\GeographyMirrorService;
\$service = app(GeographyMirrorService::class);
\$service->mirrorCountryToTenant('test-tenant', 'NP');
"
```

**Causes & Solutions**:

**Cause 1**: No transaction (each insert is separate commit)
- **Solution**: GeographyMirrorService already uses transaction (verify)

**Cause 2**: Too many units (USA has 180,000 units)
- **Solution**: Use batch inserts (future optimization)

**Cause 3**: Slow database connection
- **Solution**: Check database latency, optimize connection pooling

---

### Slow Member Queries

**Symptom**: Queries joining members + geography are slow

**Diagnosis**:
```sql
EXPLAIN ANALYZE
SELECT m.*, g.name_local
FROM members m
JOIN geo_administrative_units g ON m.admin_unit_level1_id = g.id
WHERE m.tenant_id = 'xxx';
```

**Solutions**:

**Solution 1**: Add missing indexes
```sql
CREATE INDEX idx_members_level1 ON members(admin_unit_level1_id);
CREATE INDEX idx_geo_units_id ON geo_administrative_units(id);
```

**Solution 2**: Use covering indexes
```sql
CREATE INDEX idx_members_composite ON members(tenant_id, admin_unit_level1_id, full_name);
```

---

## 🩹 Data Integrity Problems

### Hierarchy Gaps (Missing Intermediate Levels)

**Symptom**: Province → Ward (skips District, Local Level)

**Diagnosis**:
```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

// Find units with parent at wrong level
\$invalidHierarchy = DB::connection('tenant')
    ->table('geo_administrative_units as child')
    ->join('geo_administrative_units as parent', 'child.parent_id', '=', 'parent.id')
    ->whereRaw('child.admin_level != parent.admin_level + 1')
    ->select('child.code', 'child.admin_level', 'parent.code as parent_code', 'parent.admin_level as parent_level')
    ->get();

if (\$invalidHierarchy->isEmpty()) {
    echo '✅ No hierarchy gaps' . PHP_EOL;
} else {
    echo '❌ Hierarchy gaps found:' . PHP_EOL;
    foreach (\$invalidHierarchy as \$gap) {
        echo sprintf('  - %s (L%d) → %s (L%d)', \$gap->code, \$gap->admin_level, \$gap->parent_code, \$gap->parent_level) . PHP_EOL;
    }
}
"
```

**Solution**: Fix landlord data and re-mirror

---

### Inactive Units Referenced

**Symptom**: Members reference is_active = false units

**Diagnosis**:
```bash
php artisan tinker --execute="
use App\Models\Tenant;
\$tenant = Tenant::where('slug', 'YOUR-TENANT')->first();
\$tenant->makeCurrent();

\$inactiveRefs = DB::connection('tenant')
    ->table('members as m')
    ->join('geo_administrative_units as g', 'm.admin_unit_level1_id', '=', 'g.id')
    ->where('g.is_active', false)
    ->count('m.id');

echo 'Members referencing inactive units: ' . \$inactiveRefs . PHP_EOL;
"
```

**Solution**: Either reactivate units or update member references

---

## 📞 Getting Help

### Enable Debug Logging
```php
// In GeographyMirrorService.php or InstallMembershipModule.php
Log::debug('Geography mirroring started', [
    'tenant' => $tenantSlug,
    'country' => $countryCode,
    'timestamp' => now(),
]);
```

### Check Laravel Logs
```bash
tail -f storage/logs/laravel.log | grep -E "(Geography|Membership|ERROR)"
```

### Report Issue Template
When reporting issues, include:

```
**Environment:**
- Laravel version: [php artisan --version]
- PostgreSQL version: [psql --version]
- Tenant slug: [xyz]

**Steps to Reproduce:**
1. [First step]
2. [Second step]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Error Message:**
[Full error message]

**Diagnostic Output:**
[Output from diagnostic commands above]
```

---

## 🎯 Quick Troubleshooting Checklist

When something goes wrong, check in this order:

1. ☐ Landlord geography tables exist
2. ☐ Landlord geography data seeded (62 Nepal units)
3. ☐ Tenant database exists
4. ☐ Tenant geography migration ran
5. ☐ Tenant geography data exists
6. ☐ Members table exists
7. ☐ Foreign keys exist (8 total)
8. ☐ Integrity check passes
9. ☐ Logs show no errors
10. ☐ No orphaned records

---

**Debug Guide Complete**
**Related**: [Developer Guide](./20251231_0300_hybrid_geography_developer_guide.md) | [Implementation Guide](./20251231_0310_hybrid_geography_implementation_guide.md)
