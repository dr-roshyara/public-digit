# 🌏 **CLAUDE CLI INSTRUCTIONS FOR FURTHER DEVELOPMENT**

## **📋 WEEK 2: EXTEND TENANTAUTH WITH GEOGRAPHY**

### **Prompt 1: Create Migration to Extend Tenant Users**

```text
CREATE MIGRATION TO ADD GLOBAL GEOGRAPHY TO TENANT_USERS

CONTEXT:
Geography Context is complete (Week 1). Now need to connect tenant users (members) to global geography.
Current tenant_users table has no geography references.
We need to add global geography fields using generic names (not Nepal-specific).

REQUIREMENTS:

1. CREATE MIGRATION FILE:
   Location: packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database/Migrations/
   File: 2025_01_02_000001_add_global_geography_to_tenant_users.php

2. ADD THESE COLUMNS to tenant_users table:
   - country_code CHAR(2) DEFAULT 'NP' → References landlord.countries.code
   - admin_unit_level1_id BIGINT UNSIGNED NULL → References landlord.geo_administrative_units.id
   - admin_unit_level2_id BIGINT UNSIGNED NULL → References landlord.geo_administrative_units.id
   - admin_unit_level3_id BIGINT UNSIGNED NULL → References landlord.geo_administrative_units.id
   - admin_unit_level4_id BIGINT UNSIGNED NULL → References landlord.geo_administrative_units.id

3. USE GENERIC NAMES:
   - admin_unit_level1_id (NOT province_id) → Works for Nepal provinces, Indian states, US states
   - admin_unit_level2_id (NOT district_id) → Works for Nepal districts, Indian districts, US counties
   - etc.

4. DATABASE CONSTRAINTS:
   - Cannot use foreign keys across different databases (tenant DB → landlord DB)
   - Add indexes for performance
   - Add validation in application layer

5. MIGRATION CODE:
   ```php
   public function up(): void
   {
       Schema::table('tenant_users', function (Blueprint $table) {
           $table->char('country_code', 2)->default('NP')->after('phone');
           
           // Generic admin unit references (levels 1-4)
           $table->unsignedBigInteger('admin_unit_level1_id')->nullable()->after('country_code');
           $table->unsignedBigInteger('admin_unit_level2_id')->nullable()->after('admin_unit_level1_id');
           $table->unsignedBigInteger('admin_unit_level3_id')->nullable()->after('admin_unit_level2_id');
           $table->unsignedBigInteger('admin_unit_level4_id')->nullable()->after('admin_unit_level3_id');
           
           // Indexes for filtering
           $table->index('country_code');
           $table->index('admin_unit_level1_id');
           $table->index('admin_unit_level2_id');
           $table->index('admin_unit_level3_id');
           $table->index('admin_unit_level4_id');
           
           // Note: Foreign keys cannot be used across different databases
           // Validation happens in application layer using GeographyService
       });
   }
   ```

6. ROLLBACK:
   Remove all geography columns in down() method.

CONSTRAINTS:
- MUST use generic admin_unit_levelX_id column names
- MUST NOT use Nepal-specific names (province_id, district_id)
- MUST add proper indexes for query performance
- MUST include comments about cross-database validation
- MUST follow existing TenantAuth migration patterns

DELIVERABLES:
1. Complete migration file with up() and down() methods
2. Proper column definitions with indexes
3. Clear documentation comments

ACCEPTANCE CRITERIA:
```bash
# Run migration on a tenant database
php artisan tenantauth:migrate --tenant=test_tenant

# Verify columns added
DESCRIBE tenant_users;
# Should show new columns: country_code, admin_unit_level1_id, etc.
```
```

### **Prompt 2: Extend TenantUser Model with Geography**

```text
EXTEND TENANTUSER MODEL WITH GEOGRAPHY RELATIONSHIPS

CONTEXT:
Migration created to add geography fields to tenant_users.
Now need to extend TenantUser model with:
1. Geography fields in $fillable
2. Cross-database relationships to landlord models
3. Helper methods for geography access
4. Validation integration

REQUIREMENTS:

1. EXTEND EXISTING TenantUser MODEL:
   File: packages/laravel-backend/app/Contexts/TenantAuth/Domain/Models/TenantUser.php
   
   ADD to $fillable array:
   - 'country_code'
   - 'admin_unit_level1_id'
   - 'admin_unit_level2_id'
   - 'admin_unit_level3_id'
   - 'admin_unit_level4_id'

2. ADD RELATIONSHIPS (Cross-database):
   ```php
   // Relationships to landlord geography models
   public function country()
   {
       return $this->belongsTo(
           \App\Contexts\Geography\Domain\Models\Country::class,
           'country_code',
           'code'
       )->setConnection('landlord');
   }
   
   public function geographyLevel1()
   {
       return $this->belongsTo(
           \App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit::class,
           'admin_unit_level1_id'
       )->setConnection('landlord');
   }
   
   // Repeat for levels 2, 3, 4
   ```

3. ADD HELPER METHODS:
   ```php
   public function getGeographyAttribute(): array
   {
       return [
           'country' => $this->country,
           'level1' => $this->geographyLevel1,
           'level2' => $this->geographyLevel2,
           'level3' => $this->geographyLevel3,
           'level4' => $this->geographyLevel4,
       ];
   }
   
   public function getFullGeographyPath(string $language = 'en'): ?string
   {
       // Returns: "Nepal > Koshi Province > Dhankuta > Dhankuta Municipality > Ward 1"
   }
   
   public function isInSameGeographyAs(TenantUser $otherUser): bool
   {
       // Compare geography hierarchy
   }
   ```

4. ADD SCOPES FOR GEOGRAPHIC FILTERING:
   ```php
   public function scopeInCountry($query, string $countryCode)
   public function scopeInAdminUnit($query, int $level, int $unitId)
   public function scopeInSameWardAs($query, TenantUser $user)
   ```

5. CREATE GEOGRAPHY VALIDATION SERVICE:
   File: packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/GeographyValidationService.php
   
   Methods:
   - validateUserGeography(array $data): ValidationResult
   - ensureHierarchyConsistency(TenantUser $user): bool
   - getAvailableGeographyForUser(TenantUser $user): array

CONSTRAINTS:
- MUST extend existing TenantUser model, NOT create new
- MUST handle cross-database relationships properly
- MUST use GeographyService for validation logic
- MUST include caching for frequent geography lookups
- MUST follow existing TenantAuth patterns

DELIVERABLES:
1. Extended TenantUser model with geography relationships
2. GeographyValidationService with business logic
3. Comprehensive helper methods
4. Query scopes for geographic filtering

ACCEPTANCE CRITERIA:
```php
// In tinker (after migration):
$user = TenantUser::first();
$user->update([
    'country_code' => 'NP',
    'admin_unit_level1_id' => 1, // Koshi Province
    'admin_unit_level2_id' => 10, // Dhankuta District
]);

$user->country->name_en; // Should return "Nepal"
$user->geographyLevel1->getName('np'); // Should return "कोशी प्रदेश"
$user->getFullGeographyPath(); // Should return full hierarchy path
```
```

### **Prompt 3: Update Registration Forms with Geography**

```text
UPDATE REGISTRATION FORMS WITH GEOGRAPHY CASCADING SELECTS

CONTEXT:
TenantUser model now has geography fields.
Need to update registration/profile forms to include geography selection.

REQUIREMENTS:

1. CREATE VUE 3 GEOGRAPHY SELECT COMPONENTS:
   Location: packages/laravel-backend/resources/js/Components/TenantAuth/Geography/
   
   Components:
   - GeographyCountrySelect.vue - Country dropdown
   - GeographyLevelSelect.vue - Cascading select for admin levels
   - GeographyFullSelector.vue - Complete geography selector

2. COMPONENT FEATURES:
   - Real-time loading from Geography API
   - Cascading behavior: Country → Level 1 → Level 2 → Level 3 → Level 4
   - Loading states and error handling
   - Validation feedback
   - Support for multiple languages

3. UPDATE REGISTRATION CONTROLLER:
   File: packages/laravel-backend/app/Contexts/TenantAuth/Http/Controllers/RegistrationController.php
   
   Add:
   - Load geography data for forms
   - Validate geography in registration
   - Save geography with user creation

4. UPDATE REGISTRATION FORM:
   File: packages/laravel-backend/resources/js/Pages/TenantAuth/Register.vue
   
   Add geography selector component:
   ```vue
   <GeographyFullSelector
     v-model:country="form.country_code"
     v-model:level1="form.admin_unit_level1_id"
     v-model:level2="form.admin_unit_level2_id"
     v-model:level3="form.admin_unit_level3_id"
     v-model:level4="form.admin_unit_level4_id"
     :required-levels="[1, 2]" // Require country, province, district
   />
   ```

5. CREATE FORM REQUEST VALIDATION:
   File: packages/laravel-backend/app/Contexts/TenantAuth/Http/Requests/RegisterWithGeographyRequest.php
   
   Validation:
   - country_code exists in supported countries
   - admin_unit_levelX_id exists in geo_administrative_units
   - Hierarchy validation using GeographyService

6. API ENDPOINTS FOR FRONTEND:
   Add to existing Geography API:
   - GET /api/geography/countries/supported - Only supported countries
   - GET /api/geography/user/available-geography - Geography available for user

CONSTRAINTS:
- MUST use existing Geography API endpoints
- MUST support cascading selects with loading states
- MUST validate geography hierarchy on server
- MUST handle errors gracefully
- MUST be responsive (mobile/desktop)

DELIVERABLES:
1. Vue 3 geography selector components
2. Updated registration controller and form
3. Form request validation for geography
4. Additional API endpoints if needed
5. Comprehensive error handling

ACCEPTANCE CRITERIA:
```javascript
// User flow:
1. User selects country (default: Nepal)
2. Level 1 dropdown loads (provinces for Nepal, states for India)
3. User selects province → Level 2 loads (districts)
4. User selects district → Level 3 loads (local levels)
5. User selects local level → Level 4 loads (wards)
6. All selections validated on server
```
```

### **Prompt 4: Create Geographic User Queries & Reports**

```text
CREATE GEOGRAPHIC USER QUERIES AND REPORTS

CONTEXT:
Users now have geography data. Need to create geographic queries and reports:
- Member distribution by geography
- Geographic analytics
- Location-based user segmentation

REQUIREMENTS:

1. CREATE GEOGRAPHY QUERY SERVICE:
   File: packages/laravel-backend/app/Contexts/TenantAuth/Application/Services/GeographyQueryService.php
   
   Methods:
   - getMembersByGeography(string $countryCode, int $level, ?int $unitId): Collection
   - getGeographyDistribution(string $tenantId): array
   - findUsersInSameArea(TenantUser $user, int $radiusKm = 10): Collection
   - getGeographicGrowthMetrics(DateTime $start, DateTime $end): array

2. CREATE GEOGRAPHIC REPORTS:
   File: packages/laravel-backend/app/Contexts/TenantAuth/Http/Controllers/GeographyReportController.php
   
   Endpoints:
   - GET /api/tenant/geography/distribution - Member distribution by geography
   - GET /api/tenant/geography/growth - Geographic growth metrics
   - GET /api/tenant/geography/heatmap - Heatmap data for visualization

3. CREATE DASHBOARD WIDGETS (Vue 3):
   Location: packages/laravel-backend/resources/js/Components/Dashboard/Geography/
   
   Widgets:
   - GeographyDistributionChart.vue - Pie/bar chart of member distribution
   - GeographyHeatmap.vue - Interactive heatmap
   - GeographyGrowthMetrics.vue - Growth trends by area

4. CREATE GEOGRAPHY-BASED SCOPES FOR FORUMS:
   Extend forum queries to filter by user geography:
   ```php
   // In ForumPost model
   public function scopeVisibleToUserGeography($query, TenantUser $user)
   {
       return $query->where(function($q) use ($user) {
           // National posts
           $q->where('geography_scope', 'national');
           
           // Posts in user's geography
           if ($user->admin_unit_level4_id) {
               $q->orWhere('geography_scope', 'ward')
                 ->where('geography_unit_id', $user->admin_unit_level4_id);
           }
           // ... other levels
       });
   }
   ```

5. CREATE GAMIFICATION BY GEOGRAPHY:
   Extend gamification to include geographic leaderboards:
   - Ward-level leaderboards
   - District-level rankings
   - Province-level competitions

CONSTRAINTS:
- MUST work with multi-tenant databases
- MUST be performant with large datasets
- MUST cache frequently accessed reports
- MUST respect user privacy settings
- MUST support real-time updates

DELIVERABLES:
1. GeographyQueryService with business logic
2. GeographyReportController with API endpoints
3. Vue 3 dashboard widgets
4. Geographic scopes for existing systems (forums, gamification)
5. Caching strategy for geographic reports

ACCEPTANCE CRITERIA:
```php
// Example queries:
$service = new GeographyQueryService();

// Get all members in Kathmandu district
$kathmanduMembers = $service->getMembersByGeography('NP', 2, 25);

// Get geographic distribution for tenant
$distribution = $service->getGeographyDistribution($tenantId);
// Returns: ['provinces' => [...], 'districts' => [...], 'wards' => [...]]

// Find nearby users
$nearbyUsers = $service->findUsersInSameArea($currentUser, 5); // 5km radius
```
```

### **Prompt 5: Integration Tests for Geography + Auth**

```text
CREATE INTEGRATION TESTS FOR GEOGRAPHY + TENANTAUTH

CONTEXT:
Geography integrated with TenantAuth. Need comprehensive integration tests.

REQUIREMENTS:

1. CREATE TEST DATABASE SETUP:
   File: packages/laravel-backend/tests/Feature/TenantAuth/GeographyIntegrationTest.php
   
   Setup:
   - Create test tenant database
   - Seed landlord geography data
   - Create test users with geography
   - Set up cross-database connections

2. TEST CATEGORIES:
   A. User Registration with Geography
   B. Geography Validation in Forms
   C. Cross-Database Relationship Queries
   D. Geographic User Queries
   E. Geography-Based Permissions
   F. Geographic Report Generation

3. TEST METHODS (Examples):
   ```php
   public function test_user_can_register_with_valid_geography()
   public function test_registration_fails_with_invalid_geography_hierarchy()
   public function test_cross_database_geography_relationships_work()
   public function test_geographic_user_queries_return_correct_results()
   public function test_geography_based_forum_filtering_works()
   public function test_geographic_reports_generate_correctly()
   ```

4. CREATE TEST FACTORIES:
   File: packages/laravel-backend/tests/Factories/TenantUserWithGeographyFactory.php
   
   Methods:
   - createUserWithNepalGeography()
   - createUsersInSameWard()
   - createUsersInDifferentProvinces()

5. TEST PERFORMANCE:
   - Test with large datasets (10,000+ users)
   - Test cross-database query performance
   - Test caching effectiveness
   - Test concurrent geography updates

6. TEST EDGE CASES:
   - Users changing geography
   - Geography data updates (boundary changes)
   - Multi-country users
   - Missing geography data
   - Invalid geography references

CONSTRAINTS:
- MUST test cross-database scenarios
- MUST test real-world use cases
- MUST include performance testing
- MUST test error conditions
- MUST maintain test isolation

DELIVERABLES:
1. Comprehensive integration test class
2. Test factories for geography+user data
3. Performance test scenarios
4. Edge case test coverage
5. Documentation of test scenarios

ACCEPTANCE CRITERIA:
```bash
# Run integration tests
php artisan test tests/Feature/TenantAuth/GeographyIntegrationTest.php

# Should pass all tests including:
- Cross-database relationship queries
- Geography validation in registration
- Geographic user queries
- Performance with large datasets
```
```

---

## **🚀 COMPLETE WEEK 2 IMPLEMENTATION SEQUENCE:**

### **Execution Order:**
1. **Prompt 1**: Create migration to add geography to tenant_users
2. **Prompt 2**: Extend TenantUser model with geography relationships
3. **Prompt 3**: Update registration forms with geography selects
4. **Prompt 4**: Create geographic queries and reports
5. **Prompt 5**: Create integration tests

### **Verification Commands:**
```bash
# After each step, run verification
cd packages/laravel-backend

# 1. Test migration
php artisan tenantauth:migrate --tenant=test_tenant
php artisan tinker --tenant=test_tenant
>>> Schema::getColumnListing('tenant_users');
# Should include new geography columns

# 2. Test model relationships
php artisan tinker
>>> $user = TenantUser::first();
>>> $user->country; // Should return Country model
>>> $user->geographyLevel1; // Should return GeoAdministrativeUnit

# 3. Test API endpoints
curl http://localhost/api/geography/countries/supported
curl http://localhost/api/tenant/geography/distribution

# 4. Run all tests
php artisan test tests/Feature/TenantAuth/GeographyIntegrationTest.php
php artisan test tests/Feature/Geography/ # Should still pass
```

---

## **📊 WEEK 2 SUCCESS METRICS:**

### **Upon Completion:**
- [ ] Users can register with geographic location
- [ ] Cross-database geography relationships work
- [ ] Geographic user queries performant
- [ ] Geography-based filtering in forums
- [ ] Geographic reports available
- [ ] All integration tests passing
- [ ] No performance regression

### **Key Deliverables:**
1. ✅ Migration for geography in tenant_users
2. ✅ Extended TenantUser model
3. ✅ Geography-aware registration forms
4. ✅ Geographic query service
5. ✅ Integration test suite
6. ✅ Performance validation

---

## **🎯 START IMMEDIATELY:**

```text
BEGIN WEEK 2 IMPLEMENTATION:

Start with Prompt 1 - Create migration to add global geography to tenant_users.

Execute this command to Claude:

"Create migration to add global geography fields to tenant_users table with:
- country_code CHAR(2) DEFAULT 'NP'
- admin_unit_level1_id BIGINT UNSIGNED NULL
- admin_unit_level2_id BIGINT UNSIGNED NULL  
- admin_unit_level3_id BIGINT UNSIGNED NULL
- admin_unit_level4_id BIGINT UNSIGNED NULL
- Proper indexes
- Cross-database validation notes

Use generic admin_unit_levelX_id names (not Nepal-specific).
Follow existing TenantAuth migration patterns."
```

**Ready to proceed with Week 2 implementation?**