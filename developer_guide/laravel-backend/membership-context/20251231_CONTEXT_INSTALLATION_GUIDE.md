# Membership Context Installation Guide

**Date**: 2025-12-31
**Status**: Production Ready
**Version**: 2.0 (Optional Geography)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation Steps](#installation-steps)
4. [Optional Geography Feature](#optional-geography-feature)
5. [Post-Installation Verification](#post-installation-verification)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Configuration](#advanced-configuration)

---

## Overview

### What is the Membership Context?

The Membership Context is a **core bounded context** in the Public Digit Platform that handles:

- **Member Registration** - Adding political party members
- **Member Management** - CRUD operations on member data
- **Geography Integration** - (OPTIONAL) Linking members to geographic hierarchies
- **Tenant Isolation** - Ensuring members are scoped to specific tenants

### Architecture Principles

```
✅ DDD (Domain-Driven Design)
✅ Loose Coupling (Geography is optional)
✅ Tenant-Scoped (Multi-tenant architecture)
✅ Test-Driven Development (TDD)
✅ PostgreSQL Compatible
```

### Key Features

| Feature | Status | Notes |
|---------|--------|-------|
| Member CRUD | ✅ Ready | Full Create, Read, Update, Delete |
| Geography Integration | ✅ Optional | Can be added later |
| Tenant Isolation | ✅ Enforced | Members scoped to tenant DB |
| Bulk Registration | ✅ Supported | Mass member import |
| 8-Level Geography | ✅ Optional | Province → Household hierarchy |

---

## Prerequisites

### Required

1. **Laravel Backend** (v12.35.1+)
2. **PostgreSQL Database** (v13+)
3. **Spatie Multitenancy** (configured)
4. **Tenant Database** (created and provisioned)

### Optional

5. **Geography Context** (for geographic hierarchies)

### Check Prerequisites

```bash
# 1. Check Laravel version
php artisan --version

# 2. Check PostgreSQL connection
php artisan tinker <<< "DB::connection('tenant_test')->select('SELECT version()')"

# 3. Check Spatie multitenancy
php artisan tinker <<< "echo class_exists('Spatie\Multitenancy\Models\Tenant') ? '✅' : '❌'"

# 4. List tenants
php artisan tinker <<< "\App\Models\Tenant::all(['slug', 'database_name'])"
```

---

## Installation Steps

### Step 1: Install Membership Context

```bash
# Run the context installation command
php artisan context:install Membership --tenant={tenant_slug}

# Example for 'uml' tenant
php artisan context:install Membership --tenant=uml
```

**What happens:**
1. ✅ Runs tenant-scoped migrations
2. ✅ Creates `members` table in tenant database
3. ✅ Sets up Eloquent models
4. ✅ Registers context routes
5. ✅ Seeds default data (if applicable)

### Step 2: Verify Migration

```bash
# Check migration status
php artisan tenants:artisan "migrate:status" --tenant=uml

# Should show:
# ✅ 2025_12_18_103600_create_members_table
# ✅ 2025_12_20_154139_add_8_level_geography_to_members
# ✅ 2025_12_31_154532_make_geography_optional_in_members_table
```

### Step 3: Verify Table Structure

```bash
# Check members table exists
php artisan tinker << 'EOF'
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$tenant->makeCurrent();

$exists = DB::connection('tenant')->select("
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'members'
    )
");

echo $exists[0]->exists ? '✅ Members table exists' : '❌ Table missing';
EOF
```

---

## Optional Geography Feature

### 🎯 Business Context

**Before (Old Architecture):**
```
Tenant Signs Up → BLOCKED: Must install Geography first → Then add members
Timeline: ~40 seconds to first member
```

**After (New Architecture):**
```
Tenant Signs Up → Add members immediately → (Optional) Install Geography later
Timeline: ~2 seconds to first member
```

### Geography is OPTIONAL

As of **2025-12-31**, geography fields are **OPTIONAL** in the members table:

```sql
-- ALL 8 geography levels are NULLABLE:
admin_unit_level1_id BIGINT NULL  -- Province (optional)
admin_unit_level2_id BIGINT NULL  -- District (optional)
admin_unit_level3_id BIGINT NULL  -- Municipality (optional)
admin_unit_level4_id BIGINT NULL  -- Ward (optional)
admin_unit_level5_id BIGINT NULL  -- Tole (optional)
admin_unit_level6_id BIGINT NULL  -- Block (optional)
admin_unit_level7_id BIGINT NULL  -- Household Group (optional)
admin_unit_level8_id BIGINT NULL  -- Household (optional)
```

### Use Cases

#### Scenario 1: No Geography (Immediate Registration)
```php
// Create member without geography
$member = Member::create([
    'tenant_id' => 'uml',
    'full_name' => 'John Doe',
    'membership_number' => 'UML-001',
    'status' => 'active',
    'membership_type' => 'full',
    'country_code' => 'NP',
    // No geography fields needed!
]);
```

#### Scenario 2: Partial Geography (Province/District Only)
```php
// Create member with basic geography
$member = Member::create([
    'tenant_id' => 'uml',
    'full_name' => 'Jane Smith',
    'membership_number' => 'UML-002',
    'status' => 'active',
    'admin_unit_level1_id' => 1,   // Province only
    'admin_unit_level2_id' => 12,  // District
    // Levels 3-8 are NULL
]);
```

#### Scenario 3: Full Geography (All 8 Levels)
```php
// Create member with complete geography
$member = Member::create([
    'tenant_id' => 'uml',
    'full_name' => 'Bob Johnson',
    'membership_number' => 'UML-003',
    'status' => 'active',
    'admin_unit_level1_id' => 1,        // Province
    'admin_unit_level2_id' => 12,       // District
    'admin_unit_level3_id' => 123,      // Municipality
    'admin_unit_level4_id' => 1234,     // Ward
    'admin_unit_level5_id' => 12345,    // Tole
    'admin_unit_level6_id' => 123456,   // Block
    'admin_unit_level7_id' => 1234567,  // Household Group
    'admin_unit_level8_id' => 12345678, // Household
]);
```

### Progressive Data Entry

Members can be created with minimal data and updated later:

```php
// 1. Create member immediately (no geography)
$member = Member::create([
    'tenant_id' => 'uml',
    'full_name' => 'Alice Williams',
    'membership_number' => 'UML-004',
    'status' => 'active',
]);

// 2. Update with geography later
$member->update([
    'admin_unit_level1_id' => 1,
    'admin_unit_level2_id' => 12,
]);
```

---

## Post-Installation Verification

### Test 1: Create Member Without Geography

```bash
php artisan tinker << 'EOF'
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$tenant->makeCurrent();

$member = \App\Contexts\Membership\Domain\Models\Member::create([
    'tenant_id' => 'uml',
    'full_name' => 'Test Member',
    'membership_number' => 'TEST-001',
    'status' => 'active',
    'membership_type' => 'full',
    'country_code' => 'NP',
]);

echo "✅ Created member: {$member->id}\n";
echo "✅ Geography Level 1: " . ($member->admin_unit_level1_id ?? 'NULL (optional!)') . "\n";
EOF
```

### Test 2: Query Members

```bash
php artisan tinker << 'EOF'
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$tenant->makeCurrent();

$count = \App\Contexts\Membership\Domain\Models\Member::count();
echo "✅ Total members: {$count}\n";

$withoutGeo = \App\Contexts\Membership\Domain\Models\Member::whereNull('admin_unit_level1_id')->count();
echo "✅ Members without geography: {$withoutGeo}\n";
EOF
```

### Test 3: Verify Database Constraints

```bash
php artisan tinker << 'EOF'
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$tenant->makeCurrent();

$columns = DB::connection('tenant')->select("
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'members'
    AND column_name LIKE 'admin_unit_level%'
    ORDER BY column_name
");

echo "Geography Columns Status:\n";
foreach ($columns as $col) {
    $status = $col->is_nullable === 'YES' ? '✅ OPTIONAL' : '❌ REQUIRED';
    echo "{$col->column_name}: {$status}\n";
}
EOF
```

Expected output:
```
admin_unit_level1_id: ✅ OPTIONAL
admin_unit_level2_id: ✅ OPTIONAL
admin_unit_level3_id: ✅ OPTIONAL
admin_unit_level4_id: ✅ OPTIONAL
admin_unit_level5_id: ✅ OPTIONAL
admin_unit_level6_id: ✅ OPTIONAL
admin_unit_level7_id: ✅ OPTIONAL
admin_unit_level8_id: ✅ OPTIONAL
```

---

## Troubleshooting

### Issue 1: "Members table doesn't exist"

**Symptom:**
```
SQLSTATE[42P01]: Undefined table: members
```

**Cause:** Migration not run on tenant database

**Solution:**
```bash
# Run migrations explicitly
php artisan tenants:artisan "migrate --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant" --tenant=uml
```

---

### Issue 2: "NOT NULL violation on geography fields"

**Symptom:**
```
SQLSTATE[23502]: Not null violation: admin_unit_level1_id
```

**Cause:** Old migration still has NOT NULL constraints

**Solution:**
```bash
# Run the optional geography migration
php artisan tenants:artisan "migrate --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant" --tenant=uml

# Or apply manually
php artisan tinker << 'EOF'
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$tenant->makeCurrent();

for ($i = 1; $i <= 8; $i++) {
    DB::connection('tenant')->statement("
        ALTER TABLE members
        ALTER COLUMN admin_unit_level{$i}_id DROP NOT NULL
    ");
}
EOF
```

---

### Issue 3: "Connection not switched to tenant database"

**Symptom:**
```
Member::count() returns 0 but members exist
```

**Cause:** Tenant context not switched (CLI/Tinker issue)

**Solution:**
```bash
# Always switch tenant context first in CLI/Tinker
php artisan tinker << 'EOF'
// 1. Get tenant
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();

// 2. Switch context
$tenant->makeCurrent();

// 3. Now queries work
$members = \App\Contexts\Membership\Domain\Models\Member::all();
EOF
```

---

### Issue 4: "Geography Context not installed"

**Symptom:**
```
geo_units table doesn't exist
```

**Status:** **THIS IS NORMAL!**

**Explanation:**
Geography is **OPTIONAL**. Members can be created without Geography context.

**If you need Geography:**
```bash
# Install Geography context separately
php artisan context:install Geography --tenant=uml
```

---

## Advanced Configuration

### Deploying to Multiple Tenants

```bash
# Deploy to all tenants
php artisan tenants:artisan "migrate --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant"

# Deploy to specific tenants only
for tenant in uml nrna digitalcard-test; do
    php artisan tenants:artisan "migrate --path=app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant" --tenant=$tenant
done
```

### Bulk Member Import

```php
// Import members without geography (fast!)
$members = [
    [
        'tenant_id' => 'uml',
        'full_name' => 'Member 1',
        'membership_number' => 'UML-001',
        'status' => 'active',
        'membership_type' => 'full',
        'country_code' => 'NP',
        'created_at' => now(),
        'updated_at' => now(),
    ],
    // ... more members
];

DB::connection('tenant')->table('members')->insert($members);
```

### Adding Geography Later

```bash
# 1. Install Geography context
php artisan context:install Geography --tenant=uml

# 2. Update members with geography
php artisan tinker << 'EOF'
$tenant = \App\Models\Tenant::where('slug', 'uml')->first();
$tenant->makeCurrent();

// Update members without geography
\App\Contexts\Membership\Domain\Models\Member::whereNull('admin_unit_level1_id')
    ->update([
        'admin_unit_level1_id' => 1,  // Default province
        'admin_unit_level2_id' => 12, // Default district
    ]);
EOF
```

---

## Integration with Geography Context

### When Geography Context is Installed

If Geography context is installed, you can use geographic queries:

```php
// Find members in a specific province
$membersInProvince1 = Member::where('admin_unit_level1_id', 1)->get();

// Find members in a specific district
$membersInDistrict12 = Member::where('admin_unit_level1_id', 1)
    ->where('admin_unit_level2_id', 12)
    ->get();

// Find members without geography (for data cleanup)
$membersNeedingGeo = Member::whereNull('admin_unit_level1_id')->get();
```

### Geography Validation (Optional)

If you want to validate geography references:

```php
// Check if geography unit exists before assigning
use App\Contexts\Geography\Domain\Models\GeoUnit;

$provinceExists = GeoUnit::where('id', 1)
    ->where('level', 1)
    ->exists();

if ($provinceExists) {
    $member->admin_unit_level1_id = 1;
    $member->save();
}
```

---

## Summary

### ✅ Installation Checklist

- [ ] Prerequisites verified (Laravel, PostgreSQL, Spatie)
- [ ] Tenant database created
- [ ] Membership context installed via `context:install`
- [ ] Migrations verified in tenant database
- [ ] Members table created successfully
- [ ] Geography fields are OPTIONAL (nullable)
- [ ] Test member created without geography
- [ ] Member queries working correctly

### 🎯 Key Takeaways

1. **Geography is OPTIONAL** - Members can be created immediately without geography
2. **Progressive Data Entry** - Add geography later when available
3. **Loose Coupling** - Membership context doesn't depend on Geography context
4. **Business Value First** - Remove technical blockers to deliver immediate value
5. **Tenant Isolation** - All members scoped to tenant database

### 📚 Related Documentation

- [Geography Optional Fix](../../../architecture/backend/membership-contexts/20251231_GEOGRAPHY_OPTIONAL_FIX.md)
- [Membership Context Tests](../../../packages/laravel-backend/tests/Feature/Membership/OptionalGeographyTest.php)
- [Migration Guide](../../../packages/laravel-backend/app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/2025_12_31_154532_make_geography_optional_in_members_table.php)

---

**Last Updated**: 2025-12-31
**Maintained By**: Public Digit Platform Team
**Version**: 2.0 (Optional Geography Architecture)
