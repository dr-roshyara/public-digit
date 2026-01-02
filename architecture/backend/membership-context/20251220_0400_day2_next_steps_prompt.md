# Day 2: 8-Level Geography Implementation - Next Steps

**Document Type:** Developer Prompt Instructions
**Created:** 2025-12-20 04:00
**Status:** BLOCKED - Database Configuration Issue
**Phase:** Testing & Service Implementation
**Priority:** HIGH

---

## Executive Summary

Day 2 implementation has completed all schema design and migration files for extending Members geography from 4 to 8 levels using PostgreSQL ltree extension. However, we are **BLOCKED** by a database configuration issue preventing test execution.

**Current Blocker:** Tests attempting to connect to MySQL port 3306 despite phpunit.xml configured for PostgreSQL (port 5432).

---

## Current Implementation Status

### ✅ Completed (GREEN)

1. **Schema Design** - 8-level geography hierarchy designed
2. **ltree Extension Migration** - `2025_12_20_153947_enable_ltree_extension.php` created
3. **8-Level Geography Migration** - `2025_12_20_154139_add_8_level_geography_to_members.php` created
4. **Member Model Updated** - Added levels 5-8, geo_path, ltree scopes, helper methods
5. **Test Configuration** - phpunit.xml updated to use pgsql
6. **ltree Extension Tests** - `PostgresLtreeExtensionTest.php` created with 8 test cases
7. **Developer Guide** - Comprehensive documentation written

### 🔴 Blocked (RED)

1. **Database Connection Issue** - Tests failing with:
   ```
   SQLSTATE[08006] [7] connection to server at "127.0.0.1", port 3306 failed
   (Connection: pgsql, SQL: SELECT * FROM pg_extension WHERE extname = 'ltree')
   ```

2. **Root Cause:** Laravel is configured with `DB_CONNECTION=pgsql` but attempting to connect to MySQL port 3306

### ⏳ Pending (Not Started)

1. Run ltree extension tests (GREEN phase)
2. Run 8-level migrations on tenant database
3. Create GeographyPathService with TDD
4. Create GeoMigrationService with TDD
5. Update MemberRegistrationService for 8 levels
6. Create MembershipDensityService with TDD
7. Create analytics API endpoints
8. Full test suite validation (90%+ coverage)

---

## CRITICAL: Resolve Database Configuration Blocker

### Problem Analysis

**Symptom:** PostgreSQL connection configured but attempting MySQL port 3306

**Evidence:**
- phpunit.xml: `<env name="DB_CONNECTION" value="pgsql"/>`
- phpunit.xml: `<env name="DB_DATABASE" value="publicdigit"/>`
- Error message: "connection to server at '127.0.0.1', port 3306 failed"

**Possible Causes:**
1. `.env` file has conflicting `DB_CONNECTION=mysql` configuration
2. Cached configuration not cleared
3. PostgreSQL environment variables missing (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD)
4. Multiple database connections defined in `config/database.php` with incorrect defaults

### Required Actions (Execute in Order)

#### Step 1: Verify .env Configuration

**Prompt for Claude:**
```
Read the .env file and check the following PostgreSQL configuration:

REQUIRED VARIABLES:
- DB_CONNECTION=pgsql
- DB_HOST=127.0.0.1
- DB_PORT=5432
- DB_DATABASE=publicdigit
- DB_USERNAME=[postgres_user]
- DB_PASSWORD=[postgres_password]

If any MySQL configuration exists (DB_CONNECTION=mysql, DB_PORT=3306),
report the conflict and ask user which database to use for testing.
```

#### Step 2: Clear Configuration Cache

**Command:**
```bash
cd packages/laravel-backend
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

**Expected Output:** All caches cleared successfully

#### Step 3: Verify Database Connection

**Command:**
```bash
php artisan tinker --execute="echo DB::connection()->getDatabaseName() . ' (' . DB::connection()->getDriverName() . ')';"
```

**Expected Output:** `publicdigit (pgsql)`

**If Output Shows:** `election (mysql)` → Configuration still pointing to MySQL

#### Step 4: Verify PostgreSQL Service Running

**Command (Windows):**
```bash
netstat -ano | findstr :5432
```

**Expected Output:** PostgreSQL listening on port 5432

**If No Output:** PostgreSQL service not running → Start PostgreSQL service

#### Step 5: Test Direct PostgreSQL Connection

**Command:**
```bash
php artisan tinker
```

**Execute in Tinker:**
```php
DB::purge('pgsql');
$pdo = DB::connection('pgsql')->getPdo();
echo "Connected to: " . DB::connection('pgsql')->getDatabaseName();
```

**Expected Output:** `Connected to: publicdigit`

---

## Next Steps After Blocker Resolved

### Phase 1: TDD GREEN - Validate ltree Extension (30 minutes)

**Objective:** Confirm PostgreSQL ltree extension works correctly

**Steps:**

1. **Run ltree Extension Tests**
   ```bash
   ./vendor/bin/pest tests/Feature/Membership/PostgresLtreeExtensionTest.php --verbose
   ```

2. **Expected Results:** 8 tests GREEN
   - ✅ ltree extension is installed
   - ✅ btree_gin extension is installed
   - ✅ ltree data type works
   - ✅ ltree descendant operator `<@` works
   - ✅ ltree ancestor operator `@>` works
   - ✅ ltree path matching `~` works
   - ✅ ltree `subpath()` function works
   - ✅ ltree `nlevel()` function works for 8 levels

3. **If Any Test Fails:** Document the failure and investigate ltree installation

**Success Criteria:** All 8 tests pass (GREEN)

---

### Phase 2: Run 8-Level Geography Migrations (45 minutes)

**Objective:** Apply migrations to tenant database with zero downtime

**Prerequisites:**
- PostgreSQL running
- ltree extension tests GREEN
- Tenant database exists (`tenant_nrna` or similar)

**Steps:**

1. **Verify geo_administrative_units Table Exists in Tenant DB**
   ```bash
   php artisan tinker --execute="
   DB::connection('tenant')->table('geo_administrative_units')->count();
   "
   ```

   **Expected:** Row count > 0 (geography data mirrored from landlord)

   **If Error:** Run InstallMembershipModule first to mirror geography

2. **Run ltree Extension Migration**
   ```bash
   php artisan tenants:artisan "migrate --path=app/Contexts/Membership/Infrastructure/Database/Migrations/2025_12_20_153947_enable_ltree_extension.php" --tenant=nrna
   ```

   **Expected Output:** "Migration completed successfully"

3. **Verify Extensions Installed**
   ```bash
   php artisan tinker
   ```
   ```php
   $extensions = DB::connection('tenant')->select("SELECT extname FROM pg_extension WHERE extname IN ('ltree', 'btree_gin')");
   print_r($extensions);
   ```

   **Expected:** Both ltree and btree_gin listed

4. **Run 8-Level Geography Migration**
   ```bash
   php artisan tenants:artisan "migrate --path=app/Contexts/Membership/Infrastructure/Database/Migrations/2025_12_20_154139_add_8_level_geography_to_members.php" --tenant=nrna
   ```

   **Expected Output:**
   - Foreign keys created for levels 5-8
   - geo_path ltree column added
   - 3 indexes created (GiST, B-tree, composite)
   - Backfill completed with log messages

5. **Verify Schema Changes**
   ```bash
   php artisan tinker
   ```
   ```php
   Schema::connection('tenant')->hasColumn('members', 'admin_unit_level5_id'); // true
   Schema::connection('tenant')->hasColumn('members', 'admin_unit_level6_id'); // true
   Schema::connection('tenant')->hasColumn('members', 'admin_unit_level7_id'); // true
   Schema::connection('tenant')->hasColumn('members', 'admin_unit_level8_id'); // true
   Schema::connection('tenant')->hasColumn('members', 'geo_path'); // true
   ```

6. **Verify Indexes Created**
   ```bash
   php artisan tinker
   ```
   ```php
   $indexes = DB::connection('tenant')->select("
       SELECT indexname FROM pg_indexes
       WHERE tablename = 'members'
       AND indexname LIKE '%geo_path%'
   ");
   print_r($indexes);
   ```

   **Expected:** 3 indexes:
   - members_geo_path_gist_idx
   - members_geo_path_btree_idx
   - members_tenant_geopath_idx

**Success Criteria:**
- All migrations run successfully
- All 8 level columns exist
- geo_path column exists
- All 3 indexes created
- No migration errors

---

### Phase 3: Create GeographyPathService (TDD - 2 hours)

**Objective:** Auto-generate and update geo_path when geography levels change

**File Structure:**
```
app/Contexts/Membership/
├── Application/Services/GeographyPathService.php
└── Tests/Unit/Services/GeographyPathServiceTest.php
```

**TDD Workflow:**

#### Step 1: Write Failing Tests (RED)

**Prompt for Claude:**
```
Create TDD tests for GeographyPathService with the following test cases:

1. test_generates_geo_path_from_all_8_levels()
   - Given: member with levels 1-8 populated
   - When: buildGeoPath() called
   - Then: returns "1.12.123.1234.5.6.7.8"

2. test_generates_geo_path_with_partial_levels()
   - Given: member with only levels 1-4 populated
   - When: buildGeoPath() called
   - Then: returns "1.12.123.1234"

3. test_validates_hierarchy_continuity()
   - Given: member with levels 1,2,4 (missing level 3)
   - When: validateHierarchy() called
   - Then: throws HierarchyIntegrityException

4. test_updates_geo_path_on_level_change()
   - Given: member with geo_path "1.12.123.1234"
   - When: admin_unit_level5_id added
   - Then: geo_path updates to "1.12.123.1234.5"

5. test_nullifies_child_levels_on_parent_change()
   - Given: member with levels 1-8 populated
   - When: admin_unit_level3_id changed
   - Then: levels 4-8 set to null, geo_path recalculated

6. test_handles_null_geo_path_gracefully()
   - Given: member with null geo_path
   - When: getGeographyDepth() called
   - Then: returns count of non-null level columns

FILE LOCATION: tests/Unit/Membership/Services/GeographyPathServiceTest.php

Use strict DDD principles:
- Service should be in Application layer
- Use value objects for validation
- Throw domain-specific exceptions
- Use Laravel's DB facade with parameterized queries
```

**Expected Output:** 6 failing tests (RED)

#### Step 2: Implement Service (GREEN)

**Prompt for Claude:**
```
Implement GeographyPathService with the following methods:

1. buildGeoPath(Member $member): string
   - Builds ltree path from member's geography levels
   - Returns format: "1.12.123.1234.5.6.7.8"
   - Filters null values

2. validateHierarchy(Member $member): void
   - Ensures no gaps in hierarchy (if level 4 exists, level 3 must exist)
   - Throws HierarchyIntegrityException if gaps found

3. updateGeoPath(Member $member): void
   - Updates member's geo_path column in database
   - Uses parameterized query for safety

4. syncGeoPath(Member $member): Member
   - Calls buildGeoPath() and updateGeoPath()
   - Returns updated member instance

5. nullifyChildLevels(Member $member, int $fromLevel): void
   - Sets all levels >= fromLevel to null
   - Used when parent geography changes

FILE LOCATION: app/Contexts/Membership/Application/Services/GeographyPathService.php

CRITICAL REQUIREMENTS:
- Use readonly constructor properties (PHP 8.1+)
- Use strict types (declare(strict_types=1))
- All database queries MUST be parameterized
- Follow PSR-12 coding standards
- Add comprehensive PHPDoc blocks
```

**Expected Output:** All 6 tests GREEN

#### Step 3: Integration Test (GREEN)

**Prompt for Claude:**
```
Create integration test that:

1. Creates member with 4 levels
2. Calls GeographyPathService::syncGeoPath()
3. Asserts geo_path = "1.12.123.1234"
4. Adds level 5
5. Calls syncGeoPath() again
6. Asserts geo_path = "1.12.123.1234.5"

FILE LOCATION: tests/Feature/Membership/Services/GeographyPathServiceIntegrationTest.php

Use RefreshDatabase trait and tenant database connection.
```

**Success Criteria:** All tests GREEN + integration test GREEN

---

### Phase 4: Create Model Observer for Auto geo_path Updates (1 hour)

**Objective:** Automatically update geo_path when member geography changes

**File Structure:**
```
app/Contexts/Membership/
├── Domain/Observers/MemberGeographyObserver.php
└── Tests/Unit/Observers/MemberGeographyObserverTest.php
```

**Prompt for Claude:**
```
Create MemberGeographyObserver with TDD approach:

OBSERVER REQUIREMENTS:
1. Listen to Member::saving event
2. If any admin_unit_level*_id changed, call GeographyPathService::syncGeoPath()
3. If parent level changed (e.g., level 2), nullify child levels (3-8)

TDD TEST CASES:
1. test_updates_geo_path_on_creating_member()
2. test_updates_geo_path_on_level_change()
3. test_nullifies_children_on_parent_change()
4. test_skips_update_if_no_geography_changes()

REGISTRATION:
Add to MembershipServiceProvider::boot():
Member::observe(MemberGeographyObserver::class);

FILE LOCATIONS:
- app/Contexts/Membership/Domain/Observers/MemberGeographyObserver.php
- tests/Unit/Membership/Observers/MemberGeographyObserverTest.php
```

---

### Phase 5: Update MemberRegistrationService (1.5 hours)

**Objective:** Extend registration service to handle 8-level geography

**Existing File:** `app/Contexts/Membership/Application/Services/MemberRegistrationService.php`

**Prompt for Claude:**
```
Update MemberRegistrationService to support 8-level geography:

REQUIRED CHANGES:
1. Add validation for levels 5-8 in validateGeographyData()
2. Update member creation to accept admin_unit_level5_id through admin_unit_level8_id
3. Ensure hierarchy validation (no gaps)
4. Call GeographyPathService::syncGeoPath() after member creation

EXISTING TESTS TO UPDATE:
- tests/Unit/Membership/Services/MemberRegistrationServiceTest.php
- tests/Feature/Membership/MemberRegistrationTest.php

NEW TEST CASES:
1. test_creates_member_with_8_levels()
   - Given: registration data with all 8 levels
   - When: register() called
   - Then: member created with geo_path = "1.12.123.1234.5.6.7.8"

2. test_rejects_registration_with_hierarchy_gap()
   - Given: registration data with levels 1,2,4 (missing 3)
   - When: register() called
   - Then: throws ValidationException

3. test_accepts_partial_hierarchy()
   - Given: registration data with levels 1-5 only
   - When: register() called
   - Then: member created with geo_path = "1.12.123.1234.5"

FOLLOW TDD:
1. Add failing tests first (RED)
2. Update service implementation (GREEN)
3. Refactor if needed (REFACTOR)

MAINTAIN BACKWARD COMPATIBILITY:
- 4-level geography should still work
- Levels 5-8 are OPTIONAL
```

---

### Phase 6: Create MembershipDensityService (2 hours)

**Objective:** Analytics and reporting by geography level

**File Structure:**
```
app/Contexts/Membership/
├── Application/Services/MembershipDensityService.php
└── Tests/Unit/Services/MembershipDensityServiceTest.php
```

**Prompt for Claude:**
```
Create MembershipDensityService using TDD approach:

SERVICE METHODS:

1. getMemberCountByLevel(int $level, ?string $tenantId = null): Collection
   - Returns member count grouped by geography level
   - Example: Level 1 → [Province 1: 1500, Province 2: 2300, ...]
   - Uses ltree queries for efficiency

2. getMembersByGeographyPath(string $geoPath, ?string $tenantId = null): Collection
   - Returns all members under a geography path
   - Uses ltree descendant operator: geo_path <@ $geoPath::ltree
   - Example: "1.12" returns all members in Province 1, District 12

3. getHierarchyDepthDistribution(?string $tenantId = null): array
   - Returns count of members by hierarchy depth
   - Example: [2 levels: 50, 4 levels: 1200, 8 levels: 300]

4. getDensityHeatmap(int $level, ?string $tenantId = null): array
   - Returns member density for visualization
   - Format: ['id' => int, 'name' => string, 'count' => int, 'percentage' => float]

TDD TEST CASES:
1. test_counts_members_by_province()
2. test_counts_members_by_district()
3. test_finds_members_by_geography_path()
4. test_calculates_hierarchy_depth_distribution()
5. test_generates_density_heatmap()
6. test_filters_by_tenant_id()
7. test_handles_empty_results_gracefully()

PERFORMANCE REQUIREMENTS:
- Use ltree GiST indexes (fast hierarchical queries)
- Use query builder (avoid N+1 queries)
- Cache results for 5 minutes (use Laravel cache)

FILE LOCATIONS:
- app/Contexts/Membership/Application/Services/MembershipDensityService.php
- tests/Unit/Membership/Services/MembershipDensityServiceTest.php
```

---

### Phase 7: Create Analytics API Endpoints (1.5 hours)

**Objective:** RESTful endpoints for membership analytics

**File Structure:**
```
app/Contexts/Membership/
├── Infrastructure/Http/Controllers/Api/MembershipAnalyticsController.php
└── Tests/Feature/Membership/Api/MembershipAnalyticsApiTest.php
```

**Prompt for Claude:**
```
Create MembershipAnalyticsController with TDD approach:

API ENDPOINTS (Tenant-scoped):

1. GET /{tenant}/mapi/v1/membership/analytics/density/{level}
   - Returns member count by geography level
   - Response: { "data": [{"id": 1, "name": "Province 1", "count": 1500}] }

2. GET /{tenant}/mapi/v1/membership/analytics/geography/{path}
   - Returns members under geography path
   - Example: /analytics/geography/1.12
   - Response: { "data": [...members], "meta": {"total": 150} }

3. GET /{tenant}/mapi/v1/membership/analytics/depth-distribution
   - Returns hierarchy depth distribution
   - Response: { "data": {"2": 50, "4": 1200, "8": 300} }

4. GET /{tenant}/mapi/v1/membership/analytics/heatmap/{level}
   - Returns density heatmap data
   - Response: { "data": [...], "meta": {"max": 2500, "min": 10} }

ROUTE FILE: routes/tenant-mapi/membership.php

Route::prefix('{tenant}/mapi/v1/membership')
    ->middleware(['api', 'identify.tenant', 'auth:sanctum'])
    ->group(function () {
        Route::get('analytics/density/{level}', [MembershipAnalyticsController::class, 'density']);
        Route::get('analytics/geography/{path}', [MembershipAnalyticsController::class, 'byGeography']);
        Route::get('analytics/depth-distribution', [MembershipAnalyticsController::class, 'depthDistribution']);
        Route::get('analytics/heatmap/{level}', [MembershipAnalyticsController::class, 'heatmap']);
    });

TDD TEST CASES:
1. test_returns_density_by_province()
2. test_returns_density_by_district()
3. test_returns_members_by_geography_path()
4. test_returns_depth_distribution()
5. test_returns_heatmap_data()
6. test_requires_authentication()
7. test_requires_tenant_context()
8. test_validates_level_parameter()

FOLLOW API STANDARDS:
- Use JSON:API format
- Include meta information
- Proper HTTP status codes
- Error handling with meaningful messages
```

---

## Testing & Quality Assurance

### Test Coverage Requirements

**Minimum Coverage:** 90%

**Coverage Breakdown:**
- Unit Tests: 95%+ (services, observers, value objects)
- Feature Tests: 85%+ (API endpoints, migrations)
- Integration Tests: 80%+ (end-to-end workflows)

**Run Coverage Report:**
```bash
./vendor/bin/pest --coverage --min=90
```

### Test Execution Checklist

- [ ] All unit tests GREEN
- [ ] All feature tests GREEN
- [ ] All integration tests GREEN
- [ ] No skipped tests
- [ ] No deprecated PHPUnit annotations (use attributes)
- [ ] Code coverage ≥ 90%
- [ ] No code smells (run PHPStan level 6)

---

## Success Criteria

### Definition of Done

- [x] ltree extension migration created
- [x] 8-level geography migration created
- [x] Member model updated for 8 levels
- [x] ltree scopes and helper methods added
- [x] Developer guide written
- [ ] **BLOCKER RESOLVED:** PostgreSQL connection working
- [ ] ltree extension tests GREEN (8/8 passing)
- [ ] Migrations run successfully on tenant database
- [ ] GeographyPathService implemented with TDD
- [ ] MemberGeographyObserver implemented with TDD
- [ ] MemberRegistrationService updated for 8 levels
- [ ] MembershipDensityService implemented with TDD
- [ ] Analytics API endpoints created with TDD
- [ ] All tests GREEN (unit + feature + integration)
- [ ] Test coverage ≥ 90%
- [ ] Performance benchmarks meet targets (ltree queries < 50ms)
- [ ] No breaking changes to existing 4-level functionality

### Performance Benchmarks

**Target:** ltree queries should be 50-200x faster than recursive CTEs

**Benchmarks:**
1. Find all members in Province 1:
   - ltree query: < 50ms
   - Recursive CTE: > 2000ms

2. Find members 8 levels deep:
   - ltree nlevel() + descendant query: < 100ms
   - Manual level filtering: > 5000ms

3. Hierarchy depth distribution:
   - ltree nlevel() aggregation: < 200ms
   - N+1 queries: > 10000ms

**Monitoring:** Add query logging to measure actual performance

---

## Risk Management

### Identified Risks

1. **PostgreSQL Connection Issue (CRITICAL - Current Blocker)**
   - Impact: Cannot proceed with testing
   - Mitigation: Resolve .env configuration, clear caches
   - Owner: Developer

2. **ltree Extension Not Available in Production**
   - Impact: Migrations will fail
   - Mitigation: Verify PostgreSQL version (ltree requires 9.1+), install extension before deployment
   - Owner: DevOps

3. **Breaking Changes to Existing 4-Level Geography**
   - Impact: Existing members cannot be registered
   - Mitigation: Maintain backward compatibility, levels 5-8 are optional
   - Owner: Developer

4. **Performance Degradation on Large Datasets**
   - Impact: Slow queries, poor user experience
   - Mitigation: Proper indexing (GiST + B-tree), query optimization, benchmarking
   - Owner: Developer

5. **Hierarchy Integrity Violations**
   - Impact: Invalid geo_path data
   - Mitigation: Observer pattern, validation in service layer, database constraints
   - Owner: Developer

### Contingency Plans

**If PostgreSQL connection cannot be resolved:**
- Option A: Revert to MySQL and use adjacency list pattern (slower, but functional)
- Option B: Use SQLite for testing, PostgreSQL for production only

**If ltree extension unavailable:**
- Option A: Use closure table pattern (separate `geography_paths` table)
- Option B: Use recursive CTEs (slower but works on all PostgreSQL versions)

---

## Communication & Handoff

### Documentation Requirements

- [x] Architecture documents updated
- [x] Developer guide created (`20251220_day2_8level_geography_implementation.md`)
- [ ] API documentation updated with new analytics endpoints
- [ ] Migration runbook created for production deployment
- [ ] Performance benchmarking report

### Handoff Checklist

Before handing off to another developer:

- [ ] All tests GREEN
- [ ] Code reviewed and approved
- [ ] Documentation complete and up-to-date
- [ ] No outstanding TODO comments
- [ ] Database migration verified on staging environment
- [ ] Performance benchmarks documented
- [ ] Known issues documented with workarounds

---

## Appendix

### File Reference

**Migrations:**
- `app/Contexts/Membership/Infrastructure/Database/Migrations/2025_12_20_153947_enable_ltree_extension.php`
- `app/Contexts/Membership/Infrastructure/Database/Migrations/2025_12_20_154139_add_8_level_geography_to_members.php`

**Models:**
- `app/Contexts/Membership/Domain/Models/Member.php`

**Tests:**
- `tests/Feature/Membership/PostgresLtreeExtensionTest.php`

**Configuration:**
- `phpunit.xml`
- `.env` (to be verified)
- `config/database.php` (to be verified)

**Documentation:**
- `developer_guide/laravel-backend/membership-context/20251220_day2_8level_geography_implementation.md`
- `architecture/backend/membership-contexts/20251220_0400_day2_next_steps_prompt.md` (this document)

### PostgreSQL ltree Resources

- [PostgreSQL ltree Documentation](https://www.postgresql.org/docs/current/ltree.html)
- [ltree Tutorial](https://www.cybertec-postgresql.com/en/postgresql-ltree-vs-with-recursive/)
- [GiST Index Performance](https://www.postgresql.org/docs/current/gist.html)

### Contact & Support

**Technical Lead:** [TBD]
**Architecture Review:** [TBD]
**DevOps Contact:** [TBD]

---

**END OF DOCUMENT**
