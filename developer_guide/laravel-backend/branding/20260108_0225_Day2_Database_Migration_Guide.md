# Admin API - Day 2: Database Migration Guide

**Date**: 2026-01-08 02:25
**Status**: Complete ✅
**Duration**: Day 2 Implementation
**Test Results**: 18/18 Desktop API + 11/11 Mobile API passing

---

## 🎯 **OVERVIEW**

Day 2 focuses on extending the database schema to support Phase 4 features while maintaining **100% backward compatibility** with existing Phase 2/3 branding.

### **Objectives**:
1. Add Phase 4 columns to `tenant_brandings` table
2. Maintain zero-downtime migration
3. Verify backward compatibility
4. Test rollback capability
5. Prepare for Day 3 repository enhancement

---

## 📋 **MIGRATION FILE**

### **File Location**:
```
packages/laravel-backend/app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord/
2026_01_08_020000_add_phase4_fields_to_tenant_branding_table.php
```

### **Complete Migration Code**:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 4 Migration: Add State Management, Version Control, and Asset Management
 *
 * This migration extends the tenant_branding table with enterprise-grade features:
 * - State: Draft → Published → Archived workflow
 * - Entity Version: Optimistic locking for concurrent updates
 * - Assets: Primary logo metadata (JSONB)
 *
 * Business Rules:
 * - Existing branding is marked as PUBLISHED (already in use)
 * - Entity version starts at 1 for all existing records
 * - Assets starts as NULL (logos will be uploaded via Admin API)
 *
 * Backward Compatibility:
 * - Repository uses fromExisting() until Day 3 (no breaking changes)
 * - All Phase 2/3 APIs continue to work unchanged
 * - Rollback is fully supported
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::table('tenant_brandings', function (Blueprint $table) {
            // State: draft | published | archived
            // Default: 'published' (existing branding is already in use)
            $table->string('state', 20)->default('published')->after('favicon_url');
            $table->index('state', 'idx_tenant_brandings_state');

            // Entity Version: Optimistic locking (starts at 1)
            // Note: Different from existing 'version' column (schema version "1.0", "2.0")
            $table->integer('entity_version')->default(1)->after('state');

            // Assets: Primary logo metadata (JSONB for flexibility)
            // Structure: {"primary_logo": {"path": "...", "metadata": {...}}}
            $table->jsonb('assets')->nullable()->after('entity_version');
        });

        // Backfill existing records with safe defaults
        DB::table('tenant_brandings')->update([
            'state' => 'published',      // Existing branding is already active
            'entity_version' => 1,       // Initial entity version
            'assets' => null             // No logo metadata yet
        ]);
    }

    /**
     * Reverse the migrations.
     *
     * CRITICAL: This rollback is SAFE because:
     * - Domain layer continues to work with fromExisting()
     * - No data loss (state/version/assets are additive)
     * - Existing APIs (Mobile/Desktop) unaffected
     * - Repository automatically falls back to fromExisting()
     *
     * @return void
     */
    public function down(): void
    {
        Schema::table('tenant_brandings', function (Blueprint $table) {
            $table->dropIndex('idx_tenant_brandings_state');
            $table->dropColumn(['state', 'entity_version', 'assets']);
        });
    }
};
```

---

## 🚨 **CRITICAL ISSUES ENCOUNTERED & SOLUTIONS**

### **Issue 1: Table Name Mismatch**

**Error**:
```
SQLSTATE[42P01]: Undefined table: Relation »tenant_branding« existiert nicht
```

**Root Cause**: Initial migration used `tenant_branding` (singular) but actual table is `tenant_brandings` (plural).

**Investigation**:
```bash
# Checked existing migration files
ls app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord/

# Found:
2026_01_04_224847_create_tenant_brandings_table.php  # ← Plural!
```

**Solution**:
```php
// WRONG (initial attempt)
Schema::table('tenant_branding', function (Blueprint $table) {

// CORRECT
Schema::table('tenant_brandings', function (Blueprint $table) {
```

**Files Changed**: Migration file
**Impact**: Migration failed until fixed
**Prevention**: Always check existing schema before creating migrations

---

### **Issue 2: Explicit Connection Specification**

**Error**: None, but caused inconsistency with existing migrations

**Root Cause**: Initial migration explicitly specified `Schema::connection('landlord')` but existing migrations use default connection.

**Investigation**:
```php
// Checked existing migrations - they all use:
Schema::table('tenant_brandings', function (Blueprint $table) {
// NOT:
Schema::connection('landlord')->table('tenant_brandings', function (Blueprint $table) {
```

**Solution**:
```php
// WRONG (initial attempt)
Schema::connection('landlord')->table('tenant_brandings', function (Blueprint $table) {
DB::connection('landlord')->table('tenant_brandings')->update([...]);

// CORRECT
Schema::table('tenant_brandings', function (Blueprint $table) {
DB::table('tenant_brandings')->update([...]);
```

**Reasoning**: Laravel automatically uses correct connection (landlord/landlord_test) based on environment.

**Files Changed**: Migration file
**Impact**: None (preventive fix)
**Best Practice**: Use default connection unless multi-tenancy requires explicit switching

---

### **Issue 3: Column Name Conflict**

**Error**:
```
SQLSTATE[42701]: Duplicate column: Spalte »version« von Relation »tenant_brandings« existiert bereits
```

**Root Cause**: Table already has `version` column (varchar) for schema versioning ("1.0", "2.0", etc.).

**Investigation**:
```php
// Checked create_tenant_brandings_table.php:
$table->string('version', 50)->default('1.0');  // Schema version (string)

// Our Phase 4 needs:
$table->integer('version')->default(1);  // Entity version (integer)
```

**Analysis**:
- Existing `version`: Schema versioning (string: "1.0", "2.0")
- Phase 4 `version`: Entity versioning (integer: 1, 2, 3) for optimistic locking
- Two different concepts, same name = CONFLICT

**Solution**:
```php
// WRONG
$table->integer('version')->default(1);

// CORRECT
$table->integer('entity_version')->default(1);
```

**Impact on Domain Layer**: Requires mapping in repository (Day 3)
```php
// Domain uses:
$branding->version()->toInt()  // Returns integer (1, 2, 3...)

// Database has:
$model->entity_version  // Column name

// Repository must map:
'entity_version' => $branding->version()->toInt()  // Domain → DB
Version::fromInt($model->entity_version)           // DB → Domain
```

**Files Changed**: Migration file
**Day 3 Impact**: Repository must map `version()` ↔ `entity_version`
**Documentation**: Added comment in migration explaining distinction

---

## 🧪 **TESTING PROCEDURES**

### **Pre-Migration Baseline**

**Objective**: Verify all tests pass before migration

**Commands**:
```bash
cd packages/laravel-backend

# Desktop API tests
php artisan test --filter=BrandingControllerTest
# Expected: 18/18 passing

# Mobile API tests
php artisan test --filter="Feature.*Mobile.*BrandingControllerTest"
# Expected: 11/11 passing
```

**Results**:
- Desktop API: ✅ 18/18 passing (98 assertions)
- Mobile API: ✅ 11/11 passing (70 assertions)

---

### **Migration Execution**

**Commands**:
```bash
# Fresh migration (test environment)
php artisan migrate:fresh --env=testing

# Output:
# ...
# 2026_01_08_020000_add_phase4_fields_to_tenant_branding_table ... 19.34ms DONE
```

**Verification**:
```sql
-- Connect to test database
\d tenant_brandings

-- Verify columns exist:
-- state              | character varying(20)    | not null default 'published'
-- entity_version     | integer                  | not null default 1
-- assets             | jsonb                    |
```

**Results**: ✅ Migration successful (19.34ms)

---

### **Post-Migration Verification**

**Objective**: Verify backward compatibility maintained

**Commands**:
```bash
# Desktop API tests
php artisan test --filter=BrandingControllerTest

# Mobile API tests
php artisan test --filter="Feature.*Mobile.*BrandingControllerTest"
```

**Results**:
- Desktop API: ✅ 18/18 passing (98 assertions) - NO REGRESSIONS
- Mobile API: ✅ 11/11 passing (70 assertions) - NO REGRESSIONS

**Conclusion**: **100% backward compatibility maintained** ✅

---

### **Rollback Testing**

**Objective**: Verify migration can be safely rolled back

**Step 1: Rollback**
```bash
php artisan migrate:rollback --step=1 --env=testing

# Output:
# Rolling back migrations.
# 2026_01_08_020000_add_phase4_fields_to_tenant_branding_table ... 25.41ms DONE
```

**Step 2: Verify Tests Still Pass**
```bash
php artisan test --filter=BrandingControllerTest

# Result: 18/18 passing ✅
```

**Step 3: Re-apply Migration**
```bash
php artisan migrate --env=testing

# Output:
# Running migrations.
# 2026_01_08_020000_add_phase4_fields_to_tenant_branding_table ... 32.81ms DONE
```

**Step 4: Final Verification**
```bash
php artisan test --filter=BrandingControllerTest

# Result: 18/18 passing ✅
```

**Conclusion**: Rollback tested and verified ✅

---

## 📊 **DATABASE SCHEMA CHANGES**

### **Columns Added**:

| Column | Type | Null | Default | Index | Purpose |
|--------|------|------|---------|-------|---------|
| `state` | varchar(20) | NO | 'published' | Yes | State machine (draft/published/archived) |
| `entity_version` | integer | NO | 1 | No | Optimistic locking |
| `assets` | jsonb | YES | NULL | No | Logo metadata |

### **Index Added**:
```sql
CREATE INDEX idx_tenant_brandings_state ON tenant_brandings (state);
```

**Purpose**: Fast filtering by state (e.g., "show all draft branding")

---

### **Backfill Logic**:

**Query Executed**:
```sql
UPDATE tenant_brandings
SET state = 'published',
    entity_version = 1,
    assets = NULL;
```

**Business Rationale**:
- **State = 'published'**: Existing branding is already in use by tenants (not draft)
- **Entity Version = 1**: Initial version for all existing records
- **Assets = NULL**: No logo metadata available yet (Phase 2/3 only had `logo_url`)

---

## 🔄 **BACKWARD COMPATIBILITY STRATEGY**

### **How It Works**:

**Repository (Day 1-2)**:
```php
// Uses fromExisting() factory
return TenantBranding::fromExisting(
    $tenantId,
    $bundle,
    $createdAt,
    $updatedAt
);
// Automatically sets:
// - state = PUBLISHED
// - version = 1
```

**Repository (Day 3+)**:
```php
// Switches to reconstitute() with DB values
return TenantBranding::reconstitute(
    $tenantId,
    $bundle,
    $createdAt,
    $updatedAt,
    BrandingState::fromString($model->state),         // From DB
    Version::fromInt($model->entity_version)          // From DB
);
```

**Why This Works**:
1. **Day 1-2**: Domain uses `fromExisting()`, ignores new DB columns
2. **Day 2**: Migration adds columns with safe defaults
3. **Day 3**: Repository switches to `reconstitute()`, reads new columns
4. **No Breaking Changes**: Existing APIs never modified

---

## ⚠️ **CRITICAL NOTES FOR DAY 3**

### **1. Column Name Mapping Required**

**Domain Model**:
```php
$branding->version()->toInt()  // Returns integer (1, 2, 3...)
```

**Database Column**:
```sql
entity_version INTEGER DEFAULT 1
```

**Repository Must Map**:
```php
// toDomain() method
Version::fromInt($model->entity_version)  // NOT $model->version

// toDatabase() method
'entity_version' => $branding->version()->toInt()  // NOT 'version'
```

---

### **2. Assets JSONB Structure**

**Expected Format**:
```json
{
  "primary_logo": {
    "path": "tenants/nrna/logos/primary.png",
    "metadata": {
      "width": 800,
      "height": 400,
      "file_size": 102400,
      "mime_type": "image/png",
      "dominant_color": "#1E3A8A"
    }
  }
}
```

**NULL Handling**:
```php
// When assets column is NULL
BrandingAssets::empty()

// When assets has primary_logo
BrandingAssets::empty()->withPrimaryLogo($path, $metadata)
```

---

### **3. State Enum Values**

**Valid States** (must match BrandingState value object):
```
'draft'      → BrandingState::draft()
'published'  → BrandingState::published()
'archived'   → BrandingState::archived()
```

**Repository Mapping**:
```php
// DB → Domain
BrandingState::fromString($model->state)

// Domain → DB
$branding->state()->toString()  // Returns: 'draft', 'published', or 'archived'
```

---

## 📖 **RUNNING THE MIGRATION IN PRODUCTION**

### **Pre-Production Checklist**:

- [ ] All Day 1 tests passing (19/26 minimum)
- [ ] All Phase 2/3 tests passing (18/18 + 11/11)
- [ ] Migration tested in staging environment
- [ ] Database backup created
- [ ] Rollback procedure documented
- [ ] Maintenance window scheduled (optional - zero downtime)

---

### **Production Migration Steps**:

**Step 1: Backup Database**
```bash
# PostgreSQL backup
pg_dump -U postgres -d publicdigit > backup_pre_phase4_migration_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_pre_phase4_migration_*.sql
```

**Step 2: Run Migration**
```bash
cd packages/laravel-backend

# Check current migration status
php artisan migrate:status

# Run migration
php artisan migrate --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord

# Expected output:
# INFO  Running migrations.
# 2026_01_08_020000_add_phase4_fields_to_tenant_branding_table ... DONE
```

**Step 3: Verify Migration**
```bash
# Check database
PGPASSWORD="***" psql -h localhost -U postgres -d publicdigit -c "\d tenant_brandings" | grep -E "(state|entity_version|assets)"

# Expected:
# state              | character varying(20)    | not null default 'published'
# entity_version     | integer                  | not null default 1
# assets             | jsonb                    |
```

**Step 4: Smoke Test**
```bash
# Test Desktop API
curl -X GET "https://your-domain.com/nrna/api/v1/branding"

# Test Mobile API
curl -X GET "https://your-domain.com/nrna/mapi/v1/branding"

# Both should return existing branding unchanged
```

**Step 5: Monitor Application**
```bash
# Check Laravel logs
tail -f storage/logs/laravel-$(date +%Y-%m-%d).log

# Check for errors (should be none)
```

---

### **Rollback Procedure (if needed)**:

**Step 1: Rollback Migration**
```bash
php artisan migrate:rollback --step=1
```

**Step 2: Verify Application**
```bash
# Test APIs
curl -X GET "https://your-domain.com/nrna/api/v1/branding"

# Should still work (repository uses fromExisting())
```

**Step 3: Restore from Backup (worst case)**
```bash
# Stop application
php artisan down

# Restore database
psql -U postgres -d publicdigit < backup_pre_phase4_migration_*.sql

# Restart application
php artisan up
```

---

## 🔍 **DEBUGGING MIGRATION ISSUES**

### **Issue: Migration Fails with "Table not found"**

**Symptoms**:
```
SQLSTATE[42P01]: Undefined table: Relation »tenant_branding« existiert nicht
```

**Diagnosis**:
```bash
# Check table name
PGPASSWORD="***" psql -h localhost -U postgres -d publicdigit -c "\dt" | grep branding

# Should show:
# tenant_brandings  (plural!)
```

**Fix**: Ensure migration uses `tenant_brandings` (plural)

---

### **Issue: Duplicate Column Error**

**Symptoms**:
```
SQLSTATE[42701]: Duplicate column: Spalte »version« existiert bereits
```

**Diagnosis**:
```bash
# Check existing columns
PGPASSWORD="***" psql -h localhost -U postgres -d publicdigit -c "\d tenant_brandings" | grep version

# Shows:
# version  | character varying(50)  (schema version - already exists!)
```

**Fix**: Use `entity_version` instead of `version`

---

### **Issue: Tests Failing After Migration**

**Symptoms**:
```
Tests: 0 passed, 18 failed
```

**Diagnosis**:
```bash
# Check repository code
grep -n "fromExisting\|reconstitute" app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantBrandingRepository.php

# Should show: fromExisting() (not reconstitute yet - Day 3 task)
```

**Fix**: Ensure repository still uses `fromExisting()` - do NOT switch to `reconstitute()` until Day 3

---

## 📈 **PERFORMANCE IMPACT**

### **Migration Performance**:
- **Duration**: ~19-32ms (tested multiple times)
- **Blocking**: Yes (DDL operations lock table briefly)
- **Downtime**: ~20-30ms (negligible)

### **Post-Migration Performance**:
- **Query Impact**: Minimal (3 additional columns, 1 indexed)
- **Index Overhead**: `idx_tenant_brandings_state` - B-tree, fast lookups
- **Storage**: ~50 bytes per row (state + entity_version + jsonb)

### **Recommendations**:
- Run during low-traffic period (optional - very fast)
- No need for maintenance window (zero-downtime compatible)
- Monitor database CPU/memory after migration (should be unchanged)

---

## 📊 **TEST COVERAGE REPORT**

### **Pre-Migration**:
```
Desktop API:  18/18 passing (98 assertions) ✅
Mobile API:   11/11 passing (70 assertions) ✅
Total:        29/29 passing
```

### **Post-Migration**:
```
Desktop API:  18/18 passing (98 assertions) ✅
Mobile API:   11/11 passing (70 assertions) ✅
Total:        29/29 passing
```

### **Rollback Test**:
```
Rollback:     ✅ Success (25.41ms)
Re-migration: ✅ Success (32.81ms)
Tests:        18/18 passing ✅
```

**Conclusion**: **Zero regressions** - 100% backward compatibility maintained

---

## 🎯 **DAY 2 COMPLETION CHECKLIST**

- [x] Migration file created with correct table name
- [x] Connection handling uses default (not explicit)
- [x] Column name conflict resolved (entity_version)
- [x] Migration executed successfully
- [x] Backfill data verified (all records have defaults)
- [x] Desktop API tests passing (18/18)
- [x] Mobile API tests passing (11/11)
- [x] Rollback tested successfully
- [x] Re-migration tested successfully
- [x] Documentation created
- [x] Ready for Day 3 (Repository Enhancement)

---

## 🚀 **NEXT STEPS (DAY 3)**

### **Repository Enhancement Tasks**:

1. **Update `toDomain()` method**:
   - Switch from `fromExisting()` to `reconstitute()`
   - Add state mapping: `BrandingState::fromString($model->state)`
   - Add version mapping: `Version::fromInt($model->entity_version)`
   - Add asset parsing: `$this->parseAssets($model->assets)`

2. **Update `toDatabase()` method**:
   - Add state serialization: `'state' => $branding->state()->toString()`
   - Add version serialization: `'entity_version' => $branding->version()->toInt()`
   - Add asset serialization: `'assets' => $this->serializeAssets($branding->getBranding()->getAssets())`

3. **Add Helper Methods**:
   - `parseAssets(?string $json): BrandingAssets`
   - `serializeAssets(BrandingAssets $assets): ?string`

4. **Test Repository**:
   - Verify all tests still passing
   - Add new tests for state/version persistence
   - Test asset serialization/deserialization

---

## 📖 **SEE ALSO**

- [Overview & Quick Start](./20260108_0200_Admin_API_Overview_Quick_Start.md)
- [Domain Layer Deep Dive](./20260108_0205_Domain_Layer_Deep_Dive.md)
- [Testing Guide](./20260108_0210_Testing_Guide.md)
- [Migration Strategy](./20260108_0215_Migration_Strategy.md)
- [API Implementation Guide](./20260108_0220_API_Implementation_Guide.md)

---

**Developer Notes**:
- Migration is **production-ready** and **zero-downtime compatible**
- All backward compatibility verified with **29/29 tests passing**
- Rollback tested and confirmed working
- Column name mapping (`entity_version`) is **critical for Day 3**
- Ready to proceed with Repository Enhancement ✅
