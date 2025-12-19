# 🎯 CORRECTED IMPLEMENTATION PLAN
## **Political Party Membership Platform - Pragmatic Approach**
### **Working with Existing Codebase**

**Document Version:** 3.0.0 (CORRECTED)
**Date:** 2025-12-17 19:15
**Status:** 🟢 READY FOR IMPLEMENTATION
**Approach:** Extend Existing Systems, Nepal-First, Simple-to-Complex

---

## 🚨 CRITICAL CORRECTION

### **What Was Wrong with Previous Plan:**

❌ **Created 3 competing systems:**
1. New `PoliticalParty/` context → Duplicate of existing `Platform/`
2. New membership system → Duplicate of existing `TenantAuth/`
3. Over-engineered polymorphic geography → Too complex for Phase 1

❌ **Would cause circular dependencies:**
```
Platform → PoliticalParty → Tenant → Platform (CIRCULAR!)
```

❌ **Ignored existing working code:**
- `app/Contexts/Platform/Domain/Models/Tenant.php` - Already exists!
- `app/Contexts/TenantAuth/Domain/Models/TenantUser.php` - Already exists!
- Forum system - Already exists!

---

### **What's Correct Now:**

✅ **EXTEND existing systems** (not rebuild)
✅ **Start SIMPLE** (Nepal-only tables, polymorphism LATER)
✅ **Incremental approach** (working system at each step)
✅ **No circular dependencies**

---

## 📊 EXISTING CODEBASE ANALYSIS

### **What Already Exists:**

```
app/Contexts/
├── Platform/                          ✅ EXISTS - Multi-tenancy
│   ├── Domain/Models/Tenant.php      ✅ Tenant provisioning
│   └── Application/Services/
│       └── TenantProvisioningService.php
│
├── TenantAuth/                        ✅ EXISTS - Authentication
│   ├── Domain/Models/TenantUser.php  ✅ User management
│   └── Infrastructure/Database/
│       └── Migrations/2025_12_06_*.php
│
├── ElectionSetup/                     ✅ EXISTS - Elections
├── MobileDevice/                      ✅ EXISTS - Mobile support
└── Shared/                            ✅ EXISTS - Shared utilities
```

### **What We Need to Add:**

```
1. Landlord DB: Nepal geography tables (4 simple tables)
2. TenantAuth: Geography references (province_id, district_id, ward_id)
3. Forums: Geographic scoping (ward-level discussions)
4. Gamification: Points system for engagement
5. Dashboard: Geography-based analytics
```

---

## 🗂️ REVISED DATABASE ARCHITECTURE (2-TIER, NOT 3-TIER)

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: LANDLORD DATABASE (landlord)                            │
│ Purpose: Global reference data (geography ONLY for now)         │
├─────────────────────────────────────────────────────────────────┤
│ CONNECTION: 'landlord' (ALREADY EXISTS)                         │
│                                                                  │
│ NEW TABLES (Simple Nepal-Only):                                 │
│ • np_provinces (7 provinces)                                    │
│ • np_districts (77 districts)                                   │
│ • np_local_levels (753 local levels)                            │
│ • np_wards (~6,743 wards)                                       │
│                                                                  │
│ Characteristics:                                                 │
│ - Simple structure (no polymorphism yet)                        │
│ - Nepal-specific table names (np_ prefix)                       │
│ - Will refactor to geo_administrative_units when adding India   │
│ - Cached in Redis (24h TTL)                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TIER 2: TENANT DATABASES (per party) - ALREADY EXISTS           │
│ Purpose: Party-specific operational data                        │
├─────────────────────────────────────────────────────────────────┤
│ CONNECTION: Dynamic (Spatie Multitenancy) - ALREADY CONFIGURED  │
│                                                                  │
│ EXISTING TABLES (TenantAuth):                                   │
│ • tenant_users (members) ✅ EXISTS                              │
│ • roles, permissions ✅ EXISTS                                  │
│ • forums, forum_posts ✅ EXISTS (if forum enabled)              │
│                                                                  │
│ NEW FIELDS TO ADD:                                               │
│ • tenant_users.province_id → landlord.np_provinces.id          │
│ • tenant_users.district_id → landlord.np_districts.id          │
│ • tenant_users.ward_id → landlord.np_wards.id                  │
│                                                                  │
│ NEW TABLES TO ADD:                                               │
│ • member_points (gamification)                                   │
│ • member_activities (activity log)                              │
│                                                                  │
│ MODIFIED TABLES:                                                 │
│ • forum_posts.geography_scope JSON (ward/district/province)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 CORRECTED 6-STEP IMPLEMENTATION (6 WEEKS)

### **WEEK 1: Simple Nepal Geography in Landlord**

**Objective:** Create 4 simple tables for Nepal geography (NO polymorphism)

**Tasks:**
1. Create migrations in Landlord DB:
   ```sql
   -- Simple, Nepal-specific tables
   CREATE TABLE np_provinces (
       id TINYINT UNSIGNED PRIMARY KEY,  -- 1-7
       name_en VARCHAR(100) NOT NULL,
       name_np VARCHAR(100) NOT NULL,
       iso_code VARCHAR(10) UNIQUE,      -- NP-P1 to NP-P7
       capital_city_en VARCHAR(100),
       capital_city_np VARCHAR(100),
       is_active BOOLEAN DEFAULT TRUE
   );

   CREATE TABLE np_districts (
       id SMALLINT UNSIGNED PRIMARY KEY,  -- 1-77
       province_id TINYINT UNSIGNED NOT NULL,
       name_en VARCHAR(100) NOT NULL,
       name_np VARCHAR(100) NOT NULL,
       cbs_code VARCHAR(5) UNIQUE,
       is_active BOOLEAN DEFAULT TRUE,
       FOREIGN KEY (province_id) REFERENCES np_provinces(id)
   );

   CREATE TABLE np_local_levels (
       id MEDIUMINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
       district_id SMALLINT UNSIGNED NOT NULL,
       name_en VARCHAR(100) NOT NULL,
       name_np VARCHAR(100) NOT NULL,
       type ENUM('Metropolitan City', 'Sub-Metropolitan City', 'Municipality', 'Rural Municipality'),
       total_wards TINYINT UNSIGNED,
       is_active BOOLEAN DEFAULT TRUE,
       FOREIGN KEY (district_id) REFERENCES np_districts(id)
   );

   CREATE TABLE np_wards (
       id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
       local_level_id MEDIUMINT UNSIGNED NOT NULL,
       ward_number TINYINT UNSIGNED NOT NULL,
       name_en VARCHAR(100) NOT NULL,
       name_np VARCHAR(100) NOT NULL,
       is_active BOOLEAN DEFAULT TRUE,
       FOREIGN KEY (local_level_id) REFERENCES np_local_levels(id),
       UNIQUE KEY uk_local_level_ward (local_level_id, ward_number)
   );
   ```

2. Create seeder for Nepal data (7→77→753→6,743)

3. Simple Eloquent models (NO DDD complexity yet):
   ```php
   app/Models/Landlord/NpProvince.php
   app/Models/Landlord/NpDistrict.php
   app/Models/Landlord/NpLocalLevel.php
   app/Models/Landlord/NpWard.php
   ```

**Deliverables:**
- ✅ 4 migration files
- ✅ 4 Eloquent models
- ✅ Seeder with complete Nepal data
- ✅ Basic tests for data integrity

**Acceptance Criteria:**
```bash
# Seed data
php artisan db:seed --database=landlord --class=NepalGeographySeeder

# Verify
php artisan tinker
DB::connection('landlord')->table('np_provinces')->count(); // Should be 7
DB::connection('landlord')->table('np_districts')->count(); // Should be 77
DB::connection('landlord')->table('np_local_levels')->count(); // Should be 753
DB::connection('landlord')->table('np_wards')->count(); // Should be ~6,743
```

---

### **WEEK 2: Extend TenantAuth with Geography**

**Objective:** Add geography fields to existing TenantUser model

**Tasks:**
1. Create migration to extend tenant_users table:
   ```php
   // app/Contexts/TenantAuth/Infrastructure/Database/Migrations/
   // 2025_12_18_000001_add_geography_to_tenant_users.php

   public function up(): void
   {
       Schema::table('tenant_users', function (Blueprint $table) {
           // References to Landlord geography
           $table->tinyInteger('province_id')->unsigned()->nullable()->after('phone');
           $table->smallInteger('district_id')->unsigned()->nullable()->after('province_id');
           $table->integer('ward_id')->unsigned()->nullable()->after('district_id');

           // Indexes for filtering
           $table->index('province_id');
           $table->index('district_id');
           $table->index('ward_id');

           // IMPORTANT: Cannot use foreign keys across databases
           // Validation happens in application layer
       });
   }
   ```

2. Extend TenantUser model:
   ```php
   // app/Contexts/TenantAuth/Domain/Models/TenantUser.php

   class TenantUser extends Authenticatable
   {
       // ADD these fields
       protected $fillable = [
           // ... existing fields
           'province_id',
           'district_id',
           'ward_id',
       ];

       // ADD these relationships (to Landlord)
       public function province()
       {
           return $this->belongsTo(
               \App\Models\Landlord\NpProvince::class,
               'province_id'
           )->setConnection('landlord');
       }

       public function district()
       {
           return $this->belongsTo(
               \App\Models\Landlord\NpDistrict::class,
               'district_id'
           )->setConnection('landlord');
       }

       public function ward()
       {
           return $this->belongsTo(
               \App\Models\Landlord\NpWard::class,
               'ward_id'
           )->setConnection('landlord');
       }
   }
   ```

3. Create validation service:
   ```php
   // app/Contexts/TenantAuth/Application/Services/GeographyValidationService.php

   class GeographyValidationService
   {
       public function validateHierarchy(
           ?int $provinceId,
           ?int $districtId,
           ?int $wardId
       ): void {
           // Ensure district belongs to province
           // Ensure ward belongs to district
           // All IDs exist in Landlord DB
       }
   }
   ```

4. Update registration/profile forms to include geography selects

**Deliverables:**
- ✅ Migration to add geography columns
- ✅ Extended TenantUser model
- ✅ Validation service
- ✅ Updated forms with geography selects
- ✅ Tests for geography validation

**Acceptance Criteria:**
```bash
# Create user with geography
$user = TenantUser::create([
    'province_id' => 1,  // Koshi
    'district_id' => 10, // Dhankuta (in Koshi)
    'ward_id' => 123,    // Ward in Dhankuta
]);

# Validation works
$user->province->name_en; // "Koshi Province"
$user->district->name_en; // "Dhankuta"
$user->ward->name_en;     // "Dhankuta Ward 1"
```

---

### **WEEK 3: Add Geography Scoping to Forums**

**Objective:** Enable geographic filtering of forum posts

**Tasks:**
1. Extend forum_posts table:
   ```php
   // Add to tenant database template
   Schema::table('forum_posts', function (Blueprint $table) {
       $table->json('geography_scope')->nullable()->after('content');
       // Structure: {"type": "ward", "id": 123} or {"type": "national"}

       $table->index(['geography_scope']);
   });
   ```

2. Create query scopes:
   ```php
   // app/Models/ForumPost.php (or wherever forums are)

   public function scopeInWard($query, int $wardId)
   {
       return $query->where('geography_scope->type', 'ward')
                    ->where('geography_scope->id', $wardId);
   }

   public function scopeInDistrict($query, int $districtId)
   {
       return $query->where('geography_scope->type', 'district')
                    ->where('geography_scope->id', $districtId);
   }

   public function scopeNational($query)
   {
       return $query->where('geography_scope->type', 'national')
                    ->orWhereNull('geography_scope');
   }

   public function scopeVisibleToUser($query, TenantUser $user)
   {
       return $query->where(function($q) use ($user) {
           $q->national()
             ->orWhere(fn($q2) => $q2->inWard($user->ward_id))
             ->orWhere(fn($q2) => $q2->inDistrict($user->district_id))
             ->orWhere(fn($q2) => $q2->inProvince($user->province_id));
       });
   }
   ```

3. Update forum UI:
   - Geography badge on posts
   - Filter dropdown (My Ward / My District / My Province / National)
   - Default view: My Ward + National posts

**Deliverables:**
- ✅ Migration to add geography_scope
- ✅ Query scopes for filtering
- ✅ Updated forum controllers
- ✅ UI components for geography badges/filters
- ✅ Tests for geographic filtering

**Acceptance Criteria:**
```php
// Create ward-specific post
ForumPost::create([
    'title' => 'Ward Meeting Tomorrow',
    'geography_scope' => ['type' => 'ward', 'id' => 123],
]);

// Query posts visible to user
$userPosts = ForumPost::visibleToUser($currentUser)->get();
```

---

### **WEEK 4: Gamification System**

**Objective:** Add points/leaderboards to engage members

**Tasks:**
1. Create gamification tables:
   ```sql
   CREATE TABLE member_points (
       user_id BIGINT UNSIGNED PRIMARY KEY,
       total_points INT UNSIGNED DEFAULT 0,
       current_month_points INT UNSIGNED DEFAULT 0,
       rank_ward SMALLINT UNSIGNED,
       rank_district SMALLINT UNSIGNED,
       rank_province SMALLINT UNSIGNED,
       rank_national SMALLINT UNSIGNED,
       updated_at TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES tenant_users(id) ON DELETE CASCADE
   );

   CREATE TABLE member_activities (
       id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
       user_id BIGINT UNSIGNED NOT NULL,
       activity_type VARCHAR(50) NOT NULL,
       points_earned SMALLINT NOT NULL,
       metadata JSON,
       created_at TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES tenant_users(id) ON DELETE CASCADE,
       INDEX idx_user_activity (user_id, activity_type),
       INDEX idx_created_at (created_at)
   );
   ```

2. Implement point award service:
   ```php
   // app/Services/PointAwardService.php

   class PointAwardService
   {
       const ACTIVITIES = [
           'forum_post_create' => 10,
           'forum_post_comment' => 5,
           'event_attendance' => 20,
           'member_referral' => 50,
           'profile_complete' => 30,
       ];

       public function awardPoints(
           TenantUser $user,
           string $activityType,
           array $metadata = []
       ): void {
           $points = self::ACTIVITIES[$activityType] ?? 0;

           // Record activity
           MemberActivity::create([
               'user_id' => $user->id,
               'activity_type' => $activityType,
               'points_earned' => $points,
               'metadata' => $metadata,
           ]);

           // Update user points
           MemberPoint::updateOrCreate(
               ['user_id' => $user->id],
               [
                   'total_points' => DB::raw("total_points + {$points}"),
                   'current_month_points' => DB::raw("current_month_points + {$points}"),
               ]
           );

           // Recalculate ranks
           $this->updateRanks();
       }
   }
   ```

3. Create event listeners:
   ```php
   // Listen to existing events
   Event::listen(ForumPostCreated::class, function($event) {
       app(PointAwardService::class)->awardPoints(
           $event->user,
           'forum_post_create'
       );
   });
   ```

4. Build leaderboards:
   ```php
   // app/Services/LeaderboardService.php

   public function getWardLeaderboard(int $wardId, int $limit = 10)
   {
       return TenantUser::join('member_points', 'tenant_users.id', '=', 'member_points.user_id')
           ->where('ward_id', $wardId)
           ->orderBy('member_points.current_month_points', 'desc')
           ->limit($limit)
           ->get();
   }
   ```

**Deliverables:**
- ✅ Gamification tables
- ✅ Point award service with event listeners
- ✅ Leaderboard service (ward/district/province/national)
- ✅ UI components for leaderboards
- ✅ Tests for point calculations

---

### **WEEK 5: Admin Dashboard**

**Objective:** Geography-based analytics and management

**Tasks:**
1. Create dashboard with Vue 3 + Inertia.js:
   ```vue
   <template>
     <div class="dashboard">
       <!-- Geography Overview -->
       <GeographyStats
         :members-by-province="membersByProvince"
         :members-by-district="membersByDistrict"
       />

       <!-- Activity Heatmap -->
       <ActivityMap :data="activityByWard" />

       <!-- Leaderboards -->
       <LeaderboardWidget
         :scope="'province'"
         :province-id="selectedProvince"
       />

       <!-- Forum Activity -->
       <ForumActivityChart :data="forumActivityByGeography" />
     </div>
   </template>
   ```

2. Create analytics queries:
   ```php
   // app/Http/Controllers/DashboardController.php

   public function index(Request $request)
   {
       $membersByProvince = TenantUser::select('province_id', DB::raw('count(*) as total'))
           ->groupBy('province_id')
           ->get();

       $activityByWard = MemberActivity::select(
               'tenant_users.ward_id',
               DB::raw('count(*) as total_activities')
           )
           ->join('tenant_users', 'member_activities.user_id', '=', 'tenant_users.id')
           ->groupBy('tenant_users.ward_id')
           ->get();

       return Inertia::render('Dashboard', [
           'membersByProvince' => $membersByProvince,
           'activityByWard' => $activityByWard,
           // ...
       ]);
   }
   ```

3. Create map visualization (using Nepal GeoJSON)

**Deliverables:**
- ✅ Dashboard page with geography analytics
- ✅ Map visualization
- ✅ Leaderboard widgets
- ✅ Activity charts
- ✅ Export functionality (CSV/PDF)

---

### **WEEK 6: Testing, Optimization, Deployment**

**Objective:** Production-ready system

**Tasks:**
1. **Integration Tests:**
   ```php
   // tests/Feature/GeographyIntegrationTest.php

   public function test_user_can_register_with_geography()
   {
       $response = $this->post('/register', [
           'name' => 'Test User',
           'province_id' => 1,
           'district_id' => 10,
           'ward_id' => 123,
           // ...
       ]);

       $this->assertDatabaseHas('tenant_users', [
           'province_id' => 1,
           'district_id' => 10,
           'ward_id' => 123,
       ]);
   }
   ```

2. **Performance Optimization:**
   - Add Redis caching for geography data
   - Optimize leaderboard queries (denormalization)
   - Add database indexes
   - Implement query result caching

3. **Load Testing:**
   ```bash
   # Test with realistic data
   php artisan tinker

   // Create 100,000 test users across all wards
   factory(TenantUser::class, 100000)->create();

   // Run performance benchmarks
   ```

4. **Deployment:**
   - Deploy to staging environment
   - User acceptance testing
   - Fix any bugs
   - Deploy to production

**Deliverables:**
- ✅ 100+ integration tests
- ✅ Performance benchmarks
- ✅ Redis caching implemented
- ✅ Production deployment
- ✅ User documentation

---

## 📝 CLAUDE CLI PROMPT TEMPLATES (CORRECTED)

### **Prompt 1: Create Nepal Geography Tables**

```text
CREATE SIMPLE NEPAL GEOGRAPHY TABLES IN LANDLORD DATABASE

CONTEXT:
We have an EXISTING multi-tenant Laravel application with:
- Landlord database (connection: 'landlord')
- Spatie Multitenancy configured
- Existing TenantAuth context

GOAL:
Create 4 SIMPLE tables for Nepal geography (NO polymorphism, NO over-engineering).
We'll refactor to polymorphic when adding India later.

REQUIREMENTS:

1. CREATE 4 MIGRATIONS in database/landlord/migrations/:
   - 2025_01_01_000001_create_np_provinces_table.php
   - 2025_01_01_000002_create_np_districts_table.php
   - 2025_01_01_000003_create_np_local_levels_table.php
   - 2025_01_01_000004_create_np_wards_table.php

2. TABLE STRUCTURES (Simple, Nepal-specific):

A. np_provinces (7 provinces)
   - id TINYINT (1-7)
   - name_en VARCHAR(100) "Koshi Province"
   - name_np VARCHAR(100) "कोशी प्रदेश"
   - iso_code VARCHAR(10) "NP-P1"
   - capital_city_en VARCHAR(100) "Biratnagar"
   - capital_city_np VARCHAR(100) "विराटनगर"
   - is_active BOOLEAN

B. np_districts (77 districts)
   - id SMALLINT (1-77)
   - province_id TINYINT FK → np_provinces.id
   - name_en VARCHAR(100) "Dhankuta"
   - name_np VARCHAR(100) "धनकुटा"
   - cbs_code VARCHAR(5) "CBS code"
   - is_active BOOLEAN

C. np_local_levels (753 local levels)
   - id MEDIUMINT AUTO_INCREMENT
   - district_id SMALLINT FK → np_districts.id
   - name_en VARCHAR(100) "Dhankuta Municipality"
   - name_np VARCHAR(100) "धनकुटा नगरपालिका"
   - type ENUM('Metropolitan City', 'Sub-Metropolitan City', 'Municipality', 'Rural Municipality')
   - total_wards TINYINT
   - is_active BOOLEAN

D. np_wards (~6,743 wards)
   - id INT AUTO_INCREMENT
   - local_level_id MEDIUMINT FK → np_local_levels.id
   - ward_number TINYINT (1-32)
   - name_en VARCHAR(100) "Dhankuta Municipality Ward 1"
   - name_np VARCHAR(100) "धनकुटा नगरपालिका वडा १"
   - is_active BOOLEAN
   - UNIQUE (local_level_id, ward_number)

3. CREATE 4 ELOQUENT MODELS in app/Models/Landlord/:
   - NpProvince.php
   - NpDistrict.php
   - NpLocalLevel.php
   - NpWard.php

   Use $connection = 'landlord' in each model

4. CREATE SEEDER: database/landlord/seeders/NepalGeographySeeder.php
   - Seed all 7 provinces
   - Seed all 77 districts
   - Seed all 753 local levels
   - Seed all ~6,743 wards
   - Use real data from Nepal government sources

CONSTRAINTS:
- Keep it SIMPLE - no polymorphism, no JSON columns, no over-engineering
- Table names prefixed with 'np_' (Nepal-specific)
- Use connection 'landlord' for all models
- Include proper foreign keys and indexes
- All names bilingual (English + Nepali)

DELIVERABLES:
1. 4 migration files with proper foreign keys
2. 4 Eloquent models with $connection = 'landlord'
3. 1 seeder with complete Nepal geography data
4. Basic validation rules (district in province, ward in district)

ACCEPTANCE CRITERIA:
```bash
# Run migrations
php artisan migrate --database=landlord

# Run seeder
php artisan db:seed --database=landlord --class=NepalGeographySeeder

# Verify counts
php artisan tinker
DB::connection('landlord')->table('np_provinces')->count(); // 7
DB::connection('landlord')->table('np_districts')->count(); // 77
DB::connection('landlord')->table('np_local_levels')->count(); // 753
DB::connection('landlord')->table('np_wards')->count(); // ~6,743
```

DO NOT:
- Create polymorphic tables (save for India expansion)
- Create DDD folder structure (too complex for now)
- Use JSON columns (keep it simple)
- Create separate country table (Nepal only for now)

START WITH:
Create the 4 migration files first, then models, then seeder.
```

---

### **Prompt 2: Extend TenantAuth with Geography**

```text
EXTEND EXISTING TENANTAUTH WITH GEOGRAPHY REFERENCES

CONTEXT:
We have:
- Existing TenantAuth context: app/Contexts/TenantAuth/
- Existing TenantUser model: app/Contexts/TenantAuth/Domain/Models/TenantUser.php
- Landlord database with Nepal geography (np_provinces, np_districts, np_wards)

GOAL:
Add geography fields to existing TenantUser model (DO NOT create new membership system)

REQUIREMENTS:

1. CREATE MIGRATION in app/Contexts/TenantAuth/Infrastructure/Database/Migrations/
   File: 2025_12_18_000001_add_geography_to_tenant_users.php

   ```php
   public function up(): void
   {
       Schema::table('tenant_users', function (Blueprint $table) {
           $table->tinyInteger('province_id')->unsigned()->nullable();
           $table->smallInteger('district_id')->unsigned()->nullable();
           $table->integer('ward_id')->unsigned()->nullable();

           $table->index('province_id');
           $table->index('district_id');
           $table->index('ward_id');

           // NOTE: Cannot use foreign keys across databases
           // Validation happens in application layer
       });
   }
   ```

2. EXTEND TenantUser MODEL
   File: app/Contexts/TenantAuth/Domain/Models/TenantUser.php

   ADD to $fillable:
   - 'province_id', 'district_id', 'ward_id'

   ADD relationships:
   ```php
   public function province()
   {
       return $this->belongsTo(NpProvince::class, 'province_id')
                   ->setConnection('landlord');
   }

   public function district()
   {
       return $this->belongsTo(NpDistrict::class, 'district_id')
                   ->setConnection('landlord');
   }

   public function ward()
   {
       return $this->belongsTo(NpWard::class, 'ward_id')
                   ->setConnection('landlord');
   }
   ```

3. CREATE VALIDATION SERVICE
   File: app/Contexts/TenantAuth/Application/Services/GeographyValidationService.php

   ```php
   class GeographyValidationService
   {
       public function validateHierarchy(
           ?int $provinceId,
           ?int $districtId,
           ?int $wardId
       ): array {
           $errors = [];

           // Check province exists
           if ($provinceId && !NpProvince::find($provinceId)) {
               $errors['province_id'] = 'Invalid province';
           }

           // Check district belongs to province
           if ($districtId) {
               $district = NpDistrict::find($districtId);
               if (!$district) {
                   $errors['district_id'] = 'Invalid district';
               } elseif ($district->province_id != $provinceId) {
                   $errors['district_id'] = 'District does not belong to selected province';
               }
           }

           // Check ward belongs to district's local level
           if ($wardId) {
               $ward = NpWard::find($wardId);
               if (!$ward) {
                   $errors['ward_id'] = 'Invalid ward';
               } else {
                   $localLevel = $ward->localLevel;
                   if ($localLevel->district_id != $districtId) {
                       $errors['ward_id'] = 'Ward does not belong to selected district';
                   }
               }
           }

           return $errors;
       }
   }
   ```

4. UPDATE FORM VALIDATION
   Add to registration/profile update controllers:
   ```php
   $validated = $request->validate([
       // ... existing fields
       'province_id' => 'nullable|integer|exists:landlord.np_provinces,id',
       'district_id' => 'nullable|integer|exists:landlord.np_districts,id',
       'ward_id' => 'nullable|integer|exists:landlord.np_wards,id',
   ]);

   // Additional hierarchy validation
   $geoErrors = app(GeographyValidationService::class)
       ->validateHierarchy(
           $validated['province_id'],
           $validated['district_id'],
           $validated['ward_id']
       );

   if (!empty($geoErrors)) {
       return back()->withErrors($geoErrors);
   }
   ```

5. CREATE FORM COMPONENTS (Vue 3)
   - GeographySelect.vue (cascading dropdowns)
   - Shows: Province → District → Local Level → Ward

DELIVERABLES:
1. Migration to add geography columns to tenant_users
2. Extended TenantUser model with relationships
3. GeographyValidationService
4. Updated registration/profile forms
5. Vue components for geography selection
6. Tests for geography validation

ACCEPTANCE CRITERIA:
```php
// Create user with geography
$user = TenantUser::create([
    'name' => 'Test User',
    'province_id' => 1,  // Koshi
    'district_id' => 10, // Dhankuta
    'ward_id' => 123,
]);

// Verify relationships work (cross-database)
$user->province->name_en; // "Koshi Province"
$user->district->name_en; // "Dhankuta"
$user->ward->name_en;     // "Dhankuta Municipality Ward 1"

// Validation rejects invalid hierarchy
$errors = app(GeographyValidationService::class)->validateHierarchy(
    province_id: 1,  // Koshi
    district_id: 50, // Kathmandu (belongs to Bagmati, not Koshi)
    ward_id: 123
);
// Should return error: "District does not belong to selected province"
```

CONSTRAINTS:
- EXTEND existing TenantUser, DO NOT create new model
- Follow EXISTING TenantAuth migration patterns
- Keep it SIMPLE - no DDD complexity yet
- Work with EXISTING registration/profile controllers
```

---

## ⚠️ CRITICAL IMPLEMENTATION RULES

### **DO:**
✅ Extend existing TenantAuth/Domain/Models/TenantUser.php
✅ Use existing Platform/Domain/Models/Tenant.php for party instances
✅ Keep it SIMPLE - Nepal-only tables first
✅ Defer polymorphism until India expansion
✅ Work with existing forum system
✅ Follow existing migration patterns

### **DO NOT:**
❌ Create new PoliticalParty context
❌ Create new membership system
❌ Build polymorphic geography yet
❌ Create circular dependencies between contexts
❌ Over-engineer for "future" use cases
❌ Rebuild existing working systems

---

## ✅ IMMEDIATE NEXT ACTION

**Start with WEEK 1:**

```bash
# Option 1 (Recommended): Start with geography foundation
php artisan make:migration create_np_provinces_table --path=database/landlord/migrations
php artisan make:migration create_np_districts_table --path=database/landlord/migrations
php artisan make:migration create_np_local_levels_table --path=database/landlord/migrations
php artisan make:migration create_np_wards_table --path=database/landlord/migrations

# Then create models
php artisan make:model Models/Landlord/NpProvince
php artisan make:model Models/Landlord/NpDistrict
php artisan make:model Models/Landlord/NpLocalLevel
php artisan make:model Models/Landlord/NpWard

# Then create seeder
php artisan make:seeder NepalGeographySeeder --path=database/landlord/seeders
```

**Or use Claude CLI:**

```bash
claude "Create simple Nepal geography tables in Landlord database"
```

---

## 📋 SUCCESS METRICS

### **Week 1:**
- [ ] 4 Nepal geography tables in Landlord DB
- [ ] 7 provinces, 77 districts, 753 local levels, ~6,743 wards seeded
- [ ] Geography data queryable via Eloquent

### **Week 2:**
- [ ] TenantUser has province_id, district_id, ward_id
- [ ] Registration form includes geography selection
- [ ] Validation ensures correct hierarchy

### **Week 3:**
- [ ] Forum posts can be scoped to geography
- [ ] Users see ward-level + national posts by default
- [ ] Geographic filtering works

### **Week 4:**
- [ ] Gamification system tracking points
- [ ] Leaderboards by ward/district/province
- [ ] Activity log working

### **Week 5:**
- [ ] Admin dashboard showing geography analytics
- [ ] Map visualization of member distribution
- [ ] Export functionality

### **Week 6:**
- [ ] 100+ integration tests passing
- [ ] Performance optimized (Redis caching)
- [ ] Deployed to production

---

## 🎯 FUTURE PHASES (NOT NOW)

**Phase 2: India Expansion** (When Nepal is 100% working)
- Refactor np_* tables to geo_administrative_units (polymorphic)
- Add India geography (28 states, 766 districts, etc.)
- Update validation to be country-aware
- Migrate existing Nepal data to new structure

**Phase 3: Multi-Country Support**
- Add USA, Bangladesh, UK, etc.
- Configuration-driven geography
- Country-specific features

---

## 📝 DOCUMENT STATUS

**Status:** 🟢 **READY FOR IMPLEMENTATION**

**This plan is CORRECTED to:**
- ✅ Work with existing codebase
- ✅ Extend (not rebuild) existing systems
- ✅ Start simple (Nepal-only)
- ✅ Defer complexity (polymorphism later)
- ✅ Deliver working system incrementally

**USER ACTION REQUIRED:**
Approve this corrected approach and I'll start with Week 1 (Simple Nepal Geography).

---

**Last Updated:** 2025-12-17 19:15
**Document Version:** 3.0.0 (CORRECTED)
**Approach:** Pragmatic, Incremental, Existing-Codebase-Aware
