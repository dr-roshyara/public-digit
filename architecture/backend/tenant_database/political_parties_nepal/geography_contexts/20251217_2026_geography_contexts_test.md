# 🌏 **GEOGRAPHY CONTEXT BACKGROUND SUMMARY**

## **What We've Built (Completed):**

### **Global Geography Architecture (Polymorphic Design):**

**✅ Database Schema:**
- `countries` table - ISO data with admin hierarchy configuration
- `geo_administrative_units` table - SINGLE polymorphic table for ALL countries
  - Nepal data stored as: country_code='NP', admin_level=1 (province), 2 (district), etc.
  - Ready for India: country_code='IN', admin_level=1 (state), 2 (district), etc.
  - Ready for USA: country_code='US', admin_level=1 (state), 2 (county), etc.

**✅ DDD Structure (Geography Context):**
```
packages/laravel-backend/app/Contexts/Geography/
├── Domain/Models/
│   ├── Country.php                 # Country aggregate with admin configuration
│   └── GeoAdministrativeUnit.php   # Polymorphic admin unit for all countries
├── Application/Services/
│   └── GeographyService.php        # Cached geography service with validation
└── Infrastructure/Database/
    ├── Migrations/
    │   ├── create_countries_table.php
    │   └── create_geo_administrative_units_table.php
    └── Seeders/
        ├── CountriesSeeder.php     # ISO data + Nepal/India/US config
        └── NepalGeographySeeder.php # Nepal data in global table
```

**✅ TDD Test Suite:**
- `CountriesTableTest.php` - Schema validation
- `GeoAdministrativeUnitsTableTest.php` - Polymorphic table validation
- `CountryModelTest.php` - Model business logic
- `GeographyServiceTest.php` - Service layer with caching

## **Current Status:**
- ✅ **Code written**: All migrations, models, services, seeders, tests
- ❌ **Database not migrated**: Tables don't exist yet
- ❌ **Tests failing**: Can't run because migrations not executed
- ❌ **Data not seeded**: Need to run seeders

## **What's Ready to Run:**

### **Migration Commands:**
```bash
# Navigate to backend
cd packages/laravel-backend

# Run geography migrations in landlord DB
php artisan migrate --database=landlord --path=app/Contexts/Geography/Infrastructure/Database/Migrations
```

### **Seeder Commands:**
```bash
# Seed countries (ISO data + Nepal configuration)
php artisan db:seed --database=landlord --class=App\\Contexts\\Geography\\Infrastructure\\Database\\Seeders\\CountriesSeeder

# Seed Nepal geography into global table
php artisan db:seed --database=landlord --class=App\\Contexts\\Geography\\Infrastructure\\Database\\Seeders\\NepalGeographySeeder
```

### **Test Commands:**
```bash
# Run all geography tests
php artisan test tests/Feature/Geography/ --stop-on-failure

# Run specific test classes
php artisan test tests/Feature/Geography/CountriesTableTest.php
php artisan test tests/Feature/Geography/GeoAdministrativeUnitsTableTest.php
php artisan test tests/Feature/Geography/CountryModelTest.php
php artisan test tests/Feature/Geography/GeographyServiceTest.php
```

---

# 🚀 **NEXT PHASE PROMPT INSTRUCTIONS**

## **Prompt 1: Execute Migrations & Initial Testing**

```text
EXECUTE GEOGRAPHY CONTEXT MIGRATIONS AND RUN TDD TESTS

CONTEXT:
We have completed development of Geography Context with:
1. ✅ Complete migrations for global geography schema
2. ✅ DDD models (Country, GeoAdministrativeUnit)
3. ✅ Application service (GeographyService) with caching
4. ✅ Seeders for countries and Nepal data
5. ✅ Comprehensive TDD test suite

PROBLEM:
Tests are failing because database tables don't exist yet.
We need to run migrations first, then run tests.

REQUIREMENTS:

1. FIRST, RUN MIGRATIONS:
   ```bash
   cd packages/laravel-backend
   php artisan migrate --database=landlord --path=app/Contexts/Geography/Infrastructure/Database/Migrations
   ```

2. VERIFY TABLES CREATED:
   ```bash
   php artisan tinker
   // In Tinker:
   DB::connection('landlord')->getDoctrineSchemaManager()->listTableNames();
   // Should show: countries, geo_administrative_units
   ```

3. THEN, RUN TESTS (TDD CYCLE):
   ```bash
   # Tests should pass after migrations
   php artisan test tests/Feature/Geography/ --stop-on-failure
   
   # Expected: All 4 test classes should pass
   # 1. CountriesTableTest
   # 2. GeoAdministrativeUnitsTableTest  
   # 3. CountryModelTest
   # 4. GeographyServiceTest
   ```

4. IF TESTS FAIL:
   - Check error messages
   - Fix any migration issues
   - Run `php artisan migrate:fresh --database=landlord` if needed
   - Re-run tests

DELIVERABLES:
1. Migration execution output
2. Test results (all 4 test classes passing)
3. Database verification (tables exist with correct schema)

CONSTRAINTS:
- MUST use landlord database connection
- MUST stop on first test failure
- MUST verify table structure matches tests
```

## **Prompt 2: Seed Data & Integration Testing**

```text
SEED GEOGRAPHY DATA AND TEST INTEGRATION

CONTEXT:
Migrations are now complete and basic tests pass.
Now need to seed real data and test the complete system.

REQUIREMENTS:

1. SEED COUNTRIES DATA:
   ```bash
   php artisan db:seed --database=landlord --class=App\\Contexts\\Geography\\Infrastructure\\Database\\Seeders\\CountriesSeeder
   
   # Verify: Should seed Nepal (supported) + India/US/BD (future)
   ```

2. SEED NEPAL GEOGRAPHY:
   ```bash
   php artisan db:seed --database=landlord --class=App\\Contexts\\Geography\\Infrastructure\\Database\\Seeders\\NepalGeographySeeder
   
   # Verify: 7 provinces, sample districts/local-levels/wards
   ```

3. VERIFY DATA INTEGRITY:
   ```bash
   php artisan tinker
   // Check counts
   App\Contexts\Geography\Domain\Models\Country::count(); // Should be 4
   App\Contexts\Geography\Domain\Models\Country::where('is_supported', true)->count(); // Should be 1 (Nepal)
   
   // Check Nepal geography
   App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit::where('country_code', 'NP')->count();
   // Should have: 7 provinces + districts + local-levels + wards
   ```

4. RUN INTEGRATION TESTS:
   ```bash
   # Test service with real data
   php artisan test tests/Feature/Geography/GeographyServiceTest.php
   
   # Test caching works
   php artisan test --filter "test_get_country_hierarchy_caches_result"
   ```

5. TEST GEOGRAPHY SERVICE METHODS:
   ```bash
   php artisan tinker
   // Test hierarchy
   $service = new App\Contexts\Geography\Application\Services\GeographyService();
   $hierarchy = $service->getCountryHierarchy('NP');
   // Should return Nepal hierarchy with provinces
   
   // Test validation
   $koshi = App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit::where('code', 'NP-P1')->first();
   $dhankuta = App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit::where('code', 'NP-DIST-02')->first();
   $isValid = $service->validateGeographyHierarchy('NP', [$koshi->id, $dhankuta->id]);
   // Should return true
   ```

DELIVERABLES:
1. Seeding completion confirmation
2. Data integrity verification
3. Service integration test results
4. Caching behavior verification
```

## **Prompt 3: Extend TenantAuth with Geography**

```text
EXTEND TENANTAUTH WITH GLOBAL GEOGRAPHY REFERENCES

CONTEXT:
Geography Context is now working with real Nepal data.
Need to connect it to TenantAuth for user geography.

REQUIREMENTS:

1. CREATE MIGRATION TO EXTEND tenant_users:
   File: packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations/YYYY_MM_DD_add_global_geography_to_tenant_users.php

   Add columns:
   ```php
   $table->char('country_code', 2)->default('NP')->after('phone');
   $table->bigInteger('admin_unit_level1_id')->unsigned()->nullable()->after('country_code');
   $table->bigInteger('admin_unit_level2_id')->unsigned()->nullable()->after('admin_unit_level1_id');
   $table->bigInteger('admin_unit_level3_id')->unsigned()->nullable()->after('admin_unit_level2_id');
   $table->bigInteger('admin_unit_level4_id')->unsigned()->nullable()->after('admin_unit_level3_id');
   ```

2. EXTEND TenantUser MODEL:
   - Add geography fields to $fillable
   - Add relationships to GeoAdministrativeUnit
   - Add validation methods

3. CREATE GEOGRAPHY VALIDATION SERVICE:
   File: packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/GeographyValidationService.php
   - Validate hierarchy using GeographyService
   - Cross-database validation

4. UPDATE REGISTRATION FORMS:
   - Cascading selects: Country → Province → District → Local Level → Ward
   - Use GeographyService for data loading

CONSTRAINTS:
- Use global admin_unit_levelX_id columns (not province_id, district_id)
- Cross-database relationships (tenant DB → landlord DB)
- Use GeographyService for validation
```

---

## **IMMEDIATE NEXT ACTION:**

```text
EXECUTE STEP 1 NOW:

Run the migrations and initial tests:

```bash
cd packages/laravel-backend

# 1. Run geography migrations
php artisan migrate --database=landlord --path=app/Contexts/Geography/Infrastructure/Database/Migrations

# 2. Verify tables
php artisan tinker
DB::connection('landlord')->getDoctrineSchemaManager()->listTableNames();

# 3. Run TDD tests
php artisan test tests/Feature/Geography/ --stop-on-failure

# 4. Report results
```

**Provide the output of these commands.**
```

**Start with Prompt 1 to execute migrations and get tests passing, then proceed through the sequence.**