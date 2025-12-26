# 🌐 Geography Sync System - Developer Guide

## 📋 Overview

**Two-way geography synchronization system** for Nepal political party platform that handles spelling variations (Rosyara/Roshara) using fuzzy matching and DDD architecture.

**Purpose**: Allow users to submit missing geography during member registration, with admin approval workflow and bidirectional sync between tenant databases and landlord geography reference data.

---

## 🏗️ Architecture

### DDD Bounded Contexts

#### 1. **Geography Context** (`app/Contexts/Geography/`)
- **Purpose**: Shared geography reference data (countries, administrative units)
- **Database**: Landlord database (default connection)
- **Migrations**: `app/Contexts/Geography/Infrastructure/Database/Migrations/`
  - `2025_01_01_000001_create_countries_table.php`
  - `2025_01_01_000002_create_geo_administrative_units_table.php`

#### 2. **Sync Context** (In Development)
- **Purpose**: Bidirectional sync between tenant and landlord geography data
- **Components**: UpstreamSyncService, DownstreamSyncService, SyncApprovalService

#### 3. **Membership Context** (`app/Contexts/Membership/`)
- **Purpose**: Tenant-specific member data with geography fields
- **Database**: Tenant databases (isolated per tenant)

### Database Strategy

| Type | Database | Purpose | Connection |
|------|----------|---------|------------|
| **Landlord** | `publicdigit` | Shared geography, users, tenants | Default connection |
| **Tenant** | `tenant_{slug}` | Tenant-specific members, elections | Tenant connection |

**Important**: Landlord database is now the **default connection**, no need for `->connection('landlord')` in migrations.

---

## 🧩 Core Components

### 1. **Fuzzy Matching Engine** ✅ COMPLETE
**Location**: `app/Contexts/Geography/`

#### PostgreSQL Functions:
- **Migration**: `2025_12_22_033000_create_fuzzy_matching_functions.php`
- **Extensions**: `pg_trgm`, `fuzzystrmatch` (trigram, Levenshtein, Soundex)
- **Function**: `geography_name_similarity(name1 TEXT, name2 TEXT)`
- **Features**:
  - Exact match detection
  - Trigram similarity (0-1 scale)
  - Levenshtein distance weighted
  - Soundex phonetic matching
  - Nepal-specific variations (Rosyara/Roshara)

#### Services:
- `FuzzyMatchingService` (`Domain/Services/`) - Business logic
- `EloquentFuzzyMatchingRepository` (`Infrastructure/Persistence/`) - Data access
- `MatchResult` Value Object - Similarity scores and suggestions

#### Test Coverage: 100% ✅
- `FuzzyMatchingServiceTest.php`
- `EloquentFuzzyMatchingRepositoryTest.php`

### 2. **Candidate Units Table** 🔄 IN PROGRESS
**Location**: `database/migrations/2025_12_23_040000_create_geo_candidate_units_table.php`

#### Purpose:
Store user-submitted geography candidates with fuzzy match results for admin review.

#### Schema:
```sql
geo_candidate_units (
  id
  name_proposed, name_original
  country_code, admin_level (1-4)
  source_type (USER_SUBMISSION, TENANT_SUGGESTION, SYSTEM_DETECTED)
  potential_matches (jsonb), suggested_correction, confidence_score
  review_status (PENDING, UNDER_REVIEW, APPROVED, REJECTED, MERGED, DUPLICATE)
  reviewed_by (foreign key → users.id), reviewed_at, review_notes
  official_unit_id (foreign key → geo_administrative_units.id)
  usage_count, tenant_usage (jsonb)
  timestamps, soft deletes
)
```

#### Foreign Keys:
- `reviewed_by` → `users.id` (landlord users table)
- `official_unit_id` → `geo_administrative_units.id` (Geography context)

#### Indexes:
- `(country_code, admin_level, review_status)`
- `(name_proposed, country_code)`
- `(source_tenant_id, created_at)`

#### Test Status: 🔄 FIXING
- `GeoCandidateUnitsTableTest.php` - Table structure validation
- **Current Issue**: Migration order - Geography context must run first

### 3. **Geography Context Tables** ✅ COMPLETE

#### Countries Table:
- ISO country codes (NP, IN, US)
- Multilingual names (`name_local` JSON: `{"en": "Nepal", "np": "नेपाल"}`)
- Administrative hierarchy configuration (`admin_levels` JSON)

#### Geo Administrative Units Table:
- Polymorphic design for all countries' administrative divisions
- Hierarchical structure with `parent_id` and `path` (ltree)
- JSON `name_local` field for multilingual names
- Country-specific metadata in `metadata` JSON field

---

## 🚀 Current Status

### ✅ COMPLETED
1. **Fuzzy Matching Foundation**
   - PostgreSQL functions (trigram, Levenshtein, Soundex)
   - Domain services and repositories
   - 100% test coverage

2. **Geography Context Tables**
   - `countries` and `geo_administrative_units` tables
   - DDD migration structure

3. **Candidate Units Schema**
   - Migration file created
   - Test file structure defined

### 🔄 IN PROGRESS
1. **Test Database Migration Fix**
   - Issue: Foreign key dependency order
   - Solution: Run Geography context migrations before platform migrations
   - Status: Test `setUp()` updated, migration connection fixed

2. **Bidirectional Sync Services** (Pending)
   - UpstreamSyncService (Tenant → Landlord)
   - DownstreamSyncService (Landlord → Tenant)
   - SyncApprovalService (Review workflow)

### ⏳ PENDING
1. **Missing Migrations**
   - `tenant_geo_candidates` table (tenant databases)
   - `geo_change_proposals` table (landlord database)

2. **API Endpoints**
   - Fuzzy matching suggestions API
   - Candidate submission API
   - Admin review API

---

## 🔧 How to Use

### 1. **Fuzzy Matching**
```php
use App\Contexts\Geography\Domain\Services\FuzzyMatchingService;

$service = app(FuzzyMatchingService::class);
$matches = $service->findSimilarNames('Rosyara', 'NP', 3); // level 3 = local level

// Returns MatchResult with similarity scores
foreach ($matches as $match) {
    echo $match->getName() . ': ' . $match->getSimilarityScore();
}
```

### 2. **Submit Candidate** (Future)
```php
// User submits missing geography during member registration
$candidateData = [
    'name' => 'Roshyara Municipality',
    'country_code' => 'NP',
    'admin_level' => 3,
    'parent_id' => 123, // District ID
    'source_type' => 'USER_SUBMISSION'
];

// UpstreamSyncService will:
// 1. Find fuzzy matches
// 2. Create geo_candidate_units record
// 3. Return suggested action (correction/new unit)
```

### 3. **Admin Review** (Future)
```php
// Admin reviews pending candidates
$pending = GeoCandidateUnit::where('review_status', 'PENDING')->get();

// Approve candidate → creates official unit
// Reject candidate → marks as rejected with reason
// Merge candidate → links to existing unit
```

---

## 🧪 Testing

### Running Tests
```bash
# Fuzzy matching tests (100% passing)
cd packages/laravel-backend
php artisan test --filter FuzzyMatching

# Candidate units table test (fixing)
php artisan test --filter GeoCandidateUnitsTableTest

# All geography tests
php artisan test tests/Feature/Geography/
```

### Test Database Setup
**Landlord database is default connection** in testing environment:
```php
// .env.testing
DB_CONNECTION=pgsql
DB_DATABASE=publicdigit_test  # Landlord test database
```

**Test `setUp()` handles migration order**:
```php
protected function setUp(): void
{
    parent::setUp();

    // Run Geography context migrations first
    if (!Schema::hasTable('countries')) {
        $this->artisan('migrate', [
            '--path' => 'app/Contexts/Geography/Infrastructure/Database/Migrations',
            '--force' => true,
        ]);
    }

    // Run platform migrations second
    $this->artisan('migrate', ['--force' => true]);
}
```

---

## 🗺️ Migration Strategy

### Execution Order (CRITICAL)
```bash
# 1. DDD Context migrations FIRST (earlier timestamps)
php artisan migrate \
    --path=app/Contexts/Geography/Infrastructure/Database/Migrations \
    --force

# 2. Platform migrations SECOND (later timestamps)
php artisan migrate --force
```

### Migration File Placement
| Table Type | Location | Example |
|------------|----------|---------|
| **Shared geography** | `app/Contexts/Geography/Infrastructure/Database/Migrations/` | `countries`, `geo_administrative_units` |
| **Platform tables** | `database/migrations/` | `users`, `tenants`, `geo_candidate_units` |
| **Tenant tables** | `app/Contexts/Membership/Infrastructure/Database/Migrations/` | `members`, `elections` |

### Foreign Key Rules
- ✅ **Same database**: Landlord → Landlord, Tenant → Tenant
- ❌ **Cross-database**: Not supported in PostgreSQL
- **Workaround**: Store IDs without foreign keys, validate in application logic

---

## 🚨 Known Issues & Solutions

### 1. **Migration Order Failure**
**Error**: `Relation "geo_administrative_units" does not exist`
**Cause**: Platform migration runs before Geography context migration
**Solution**: Ensure Geography context migrations run first (earlier timestamps)

### 2. **Foreign Key to Context Tables**
**Rule**: Platform tables can reference DDD context tables if:
- Context migration runs first (earlier timestamp)
- Both tables in same database (landlord)
- Foreign key added after table creation

### 3. **Test Database Connection**
**Change**: Landlord database is now default connection
**Impact**: Remove `Schema::connection('landlord')` from tests and migrations
**Use**: Simple `Schema::` methods instead

---

## 📈 Next Steps

### Phase 1: Foundation (Current)
- [x] Fuzzy matching engine
- [x] Geography context tables
- [ ] Fix candidate units migration ✅ (in progress)
- [ ] Create missing sync tables

### Phase 2: Sync Services
- [ ] UpstreamSyncService (Tenant → Landlord)
- [ ] DownstreamSyncService (Landlord → Tenant)
- [ ] SyncApprovalService (Review workflow)

### Phase 3: API Integration
- [ ] Fuzzy matching API endpoints
- [ ] Candidate submission API
- [ ] Admin review API

### Phase 4: Frontend Integration
- [ ] Vue.js suggestion form component
- [ ] Admin review dashboard
- [ ] Sync history audit trail

---

## 🔗 Related Documentation

1. **Architecture Documents**:
   - `architecture/backend/membership-contexts/ddd_connect_geographical_contexts/`
   - `20251222_2026_two_way_geo_sync_fuzzy_method.md`

2. **Developer Guides**:
   - `developer_guide/laravel-backend/geography-context/`
   - `20251223_0030_implementation_of_fuzzy_method.md`

3. **Todos & Planning**:
   - `20251223_0036_rest_todos_fuzzy_method.md`
   - `20251223_0040_rest_todos_fuzzy_method_phase2.md`

---

## 🛠️ Technical Stack

- **Laravel 12.35.1** with DDD architecture
- **PostgreSQL 13+** with extensions:
  - `pg_trgm` - Trigram similarity
  - `fuzzystrmatch` - Levenshtein, Soundex
  - `ltree` - Hierarchical data (planned)
- **Test-Driven Development (TDD)** - 80%+ coverage requirement
- **Multi-tenancy** - Database-per-tenant isolation
- **JSON fields** - Multilingual names (`name_local->>'np'`)

---

## 📞 Support & Escalation

### Technical Blockers
1. **Database migration issues** → Senior Database Architect
2. **Performance bottlenecks** → DevOps/Infrastructure team
3. **DDD architecture questions** → Lead Backend Developer
4. **Frontend integration** → Frontend Team Lead

### Business Decisions Needed
1. **Approval workflow complexity** → Product Manager
2. **Pilot tenant selection** → Customer Success team
3. **Communication templates** → Marketing/Comms team

---

**Last Updated**: 2025-12-23
**Status**: Foundation complete, sync services pending
**Test Coverage**: Fuzzy matching 100%, candidate tables fixing
**Next Priority**: Fix migration order, implement UpstreamSyncService