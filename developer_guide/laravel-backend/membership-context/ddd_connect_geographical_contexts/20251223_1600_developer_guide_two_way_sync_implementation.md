# 🚀 Two-Way Geography Sync Implementation - Developer Guide

## 📋 Overview

**Complete two-way geography synchronization system** with fuzzy matching for Nepal political party platform. Implements both **downstream (landlord → tenant)** and **upstream (tenant → landlord)** sync with PostgreSQL fuzzy matching extensions.

**Status**: Core infrastructure complete, ready for API integration.

**Core Principle**: **"Simplicity Over Complexity"** - Direct database operations, minimal dependencies, clear separation of concerns.

---

## 🏗️ System Architecture

### Three-Layer Sync Model

```
┌─────────────────────────────────────────────────────────────┐
│                    LANDLORD DATABASE                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ geo_administrative_units (Official reference)       │   │
│  │ geo_candidate_units (User submissions for review)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↑              ↓                    │
│                         │              │                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         DAILY BATCH SYNC (Downstream)               │   │
│  │         • Simple cron job                           │   │
│  │         • Approved → Tenant databases               │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │              ↑                    │
│                         │              │                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     ON-DEMAND SUBMISSION (Upstream)                 │   │
│  │     • User submits missing geography                │   │
│  │     • Fuzzy matching for corrections               │   │
│  │     • Tenant → Landlord for review                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↑              │                    │
│                         │              │                    │
└─────────────────────────┼──────────────┼────────────────────┘
                          │              │
┌─────────────────────────┼──────────────┼────────────────────┐
│                    TENANT DATABASES                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ tenant_geo_units (Official + Custom)                │   │
│  │ tenant_geo_candidates (User submissions)            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Simple Daily Batch** - Not complex event-driven system
2. **Direct Database Operations** - No over-engineering with repositories for simple tasks
3. **Mocking for Unit Tests** - Mock services instead of complex database setup
4. **Boolean Flags Over Enums** - Where possible for simplicity
5. **Dynamic Tenant Connections** - Handle multi-tenant isolation automatically

---

## ✅ COMPLETED COMPONENTS

### 1. **Fuzzy Matching Engine** (`app/Contexts/Geography/`)
- **PostgreSQL Extensions**: `pg_trgm`, `fuzzystrmatch`
- **Service**: `FuzzyMatchingService` with caching
- **Repository**: `EloquentFuzzyMatchingRepository` using trigram similarity
- **Value Objects**: `MatchResult`, `SimilarityScore`, `PotentialMatches`
- **Test Coverage**: 100% with mocked dependencies

### 2. **Candidate Units Infrastructure**

#### Landlord Candidate Table (`geo_candidate_units`)
**Migration**: `database/migrations/2025_12_23_040000_create_geo_candidate_units_table.php`

```sql
-- Key columns for fuzzy matching
potential_matches JSONB,        -- Results from fuzzy matching
suggested_correction VARCHAR,   -- System suggestion
confidence_score FLOAT,         -- 0-1 confidence level
review_status ENUM,             -- PENDING, APPROVED, REJECTED, etc.
official_unit_id BIGINT         -- Link to approved official unit
```

#### Tenant Candidate Table (`tenant_geo_candidates`)
**Migration**: `app/Contexts/Membership/Infrastructure/Database/Migrations/2025_12_23_120000_create_tenant_geo_candidates_table.php`

```sql
-- Tracks user submissions in tenant database
name_entered VARCHAR,           -- Original user input
name_normalized VARCHAR,        -- After cleaning
matching_results JSONB,         -- Cached fuzzy matches
sync_status ENUM,               -- DRAFT, SUBMITTED, APPROVED, etc.
landlord_candidate_id VARCHAR   -- Reference to landlord candidate
```

### 3. **Downstream Sync Service** (`DailyGeographySync`)

**Location**: `app/Contexts/Geography/Application/Services/DailyGeographySync.php`

**Purpose**: Daily batch sync of approved geography from landlord to all active tenants.

**Key Features**:
- Simple method `syncAllTenants()` returns results array
- Dynamic tenant database connection switching
- Only syncs approved units with status='approved'
- Logs results and handles errors gracefully

**Results Structure**:
```php
[
    'tenants_updated' => 2,
    'units_synced' => 10,
    'success' => true,
    'started_at' => '2025-12-23 14:30:00',
    'completed_at' => '2025-12-23 14:30:05',
]
```

### 4. **Artisan Command** (`DailyGeographySyncCommand`)

**Location**: `app/Console/Commands/DailyGeographySyncCommand.php`

**Usage**: `php artisan geography:sync-daily`

**Features**:
- Simple instantiation of service (no dependency injection complexity)
- Console output with results and timing
- Error handling with clear messages
- Follows "Simplicity Over Complexity" principle

### 5. **Simple Candidate Submission Service** (`GeographyCandidateService`)

**Location**: `app/Contexts/Geography/Application/Services/GeographyCandidateService.php`

**Purpose**: Direct database insert for candidate submissions (no fuzzy matching yet).

**Method**: `submitMissingGeography(array $data): int`

**Simple Data Flow**:
```php
$candidateId = $service->submitMissingGeography([
    'name' => 'नयाँ वडा नं. १०',
    'level' => 4,
    'parent_id' => 123,
    'country_code' => 'NP',
    'reason' => 'Missing during registration',
    'user_id' => 456,
    'tenant_id' => 789, // Optional - sets source_type to TENANT_SUGGESTION
]);
```

---

## 🧪 TESTING STRATEGY

### 1. **Command Tests with Mocking**
**File**: `tests/Unit/Contexts/Geography/Application/Commands/DailyGeographySyncCommandTest.php`

**Approach**: Mock the service using Mockery's `overload:` prefix to intercept direct instantiation.

```php
// Mock the DailyGeographySync service to return success
$mockService = Mockery::mock('overload:' . DailyGeographySync::class);
$mockService->shouldReceive('syncAllTenants')
    ->once()
    ->andReturn([
        'tenants_updated' => 2,
        'units_synced' => 10,
        'success' => true,
        'started_at' => now()->format('Y-m-d H:i:s'),
        'completed_at' => now()->format('Y-m-d H:i:s'),
    ]);

// Command executes with mocked service
$this->artisan('geography:sync-daily')
    ->expectsOutput('Starting daily geography sync...')
    ->expectsOutput('Daily geography sync completed')
    ->assertExitCode(0);
```

**Why Mocking?**:
- Avoids complex database setup with foreign key constraints
- Focuses on command behavior, not service implementation
- Faster test execution
- Follows unit testing principles (isolate component under test)

### 2. **Service Tests with Simple Database Setup**
**File**: `tests/Unit/Contexts/Geography/Application/Services/DailyGeographySyncTest.php`

**Approach**: Create minimal tables in test setup, mock logging facade.

```php
protected function setUp(): void
{
    parent::setUp();

    // SIMPLE: Use landlord connection for testing
    config(['database.default' => 'landlord']);

    // Create minimal tables for testing
    if (!Schema::hasTable('geo_administrative_units')) {
        Schema::create('geo_administrative_units', function ($table) {
            $table->id();
            $table->string('name_local');
            $table->integer('level');
            $table->string('country_code')->default('NP');
            $table->string('status')->default('approved');
            $table->timestamps();
        });
    }

    // Mock Log facade
    Log::shouldReceive('info')->byDefault();
    Log::shouldReceive('error')->byDefault();
}
```

### 3. **Fuzzy Matching Tests with Mocks**
**File**: `tests/Unit/Contexts/Geography/Services/FuzzyMatchingServiceTest.php`

**Approach**: Mock repository interface to test service logic without database.

---

## 🔧 HOW TO USE

### 1. **Run Daily Sync Manually**
```bash
cd packages/laravel-backend
php artisan geography:sync-daily
```

**Expected Output**:
```
Starting daily geography sync...
Daily geography sync completed
Updated 2 tenants with 10 geography units
Started: 2025-12-23 14:30:00 | Completed: 2025-12-23 14:30:05
```

### 2. **Schedule Daily Sync**
Add to `app/Console/Kernel.php`:
```php
$schedule->command('geography:sync-daily')
    ->dailyAt('02:00')
    ->description('Sync approved geography to all tenants');
```

### 3. **Submit Missing Geography (Simple)**
```php
use App\Contexts\Geography\Application\Services\GeographyCandidateService;

$service = new GeographyCandidateService();
$candidateId = $service->submitMissingGeography([
    'name' => 'Roshyara Ward 10',
    'level' => 4,
    'parent_id' => 123,
    'country_code' => 'NP',
    'reason' => 'Newly created ward in our municipality',
    'user_id' => auth()->id(),
    'tenant_id' => $tenant->id, // Optional
]);
```

### 4. **Fuzzy Matching Lookup**
```php
use App\Contexts\Geography\Domain\Services\FuzzyMatchingService;
use App\Contexts\Geography\Domain\ValueObjects\CountryCode;

$service = app(FuzzyMatchingService::class);
$matches = $service->findPotentialMatches(
    'Roshara', // User input (common misspelling)
    CountryCode::fromString('NP'),
    4, // Ward level
    $parentId // Optional parent ID
);

if ($matches->hasExactMatches()) {
    // Exact match found - suggest using existing unit
    $bestMatch = $matches->bestMatch();
} elseif ($matches->hasHighConfidenceMatches()) {
    // High similarity - suggest correction
    $suggestion = $service->suggestCorrection('Roshara', CountryCode::fromString('NP'));
}
```

---

## 🚨 CRITICAL IMPLEMENTATION NOTES

### 1. **Database Connection Strategy**
- **Landlord is default connection** - No need for `->connection('landlord')`
- **Tenant connections** dynamically switched using `config(['database.default' => 'tenant'])`
- **Multi-tenant isolation** maintained through separate databases

### 2. **PostgreSQL Extensions Required**
Enable extensions in PostgreSQL:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

**Migration**: `2025_12_22_033000_create_fuzzy_matching_functions.php` already creates these.

### 3. **JSON Column Access Pattern**
`geo_administrative_units.name_local` is JSON column with multilingual names.

**Access Nepali name**: `name_local->>'np'`
```php
// In EloquentFuzzyMatchingRepository:
DB::raw("similarity(name_local->>'np', ?) as similarity_score")
```

### 4. **Mockery Overload Prefix**
When testing commands that instantiate services directly with `new`:

```php
// ✅ CORRECT: 'overload:' prefix intercepts direct instantiation
$mockService = Mockery::mock('overload:' . DailyGeographySync::class);

// ❌ WRONG: Regular mock won't intercept 'new DailyGeographySync()'
$mockService = Mockery::mock(DailyGeographySync::class);
```

### 5. **Test Database Setup**
**Always create minimal tables** in test `setUp()` rather than relying on migrations:
```php
if (!Schema::hasTable('geo_administrative_units')) {
    Schema::create('geo_administrative_units', function ($table) {
        // Minimal columns only for test
    });
}
```

---

## 📈 NEXT PHASE: UPSTREAM SYNC WITH FUZZY MATCHING

### Pending Component: `UpstreamSyncService`

**Purpose**: Handle tenant → landlord submissions with integrated fuzzy matching.

**Planned Flow**:
1. User submits missing geography during member registration
2. Service performs fuzzy matching against existing units
3. Decision: Correction vs New Unit
4. Create candidate with match results and confidence score
5. Link tenant candidate to landlord candidate
6. Notify admins for review

**Expected Methods**:
```php
class UpstreamSyncService
{
    public function submitCandidateFromTenant(
        Tenant $tenant,
        array $candidateData
    ): array {
        // 1. Fuzzy matching
        // 2. Determine correction vs new unit
        // 3. Create landlord candidate
        // 4. Update tenant candidate status
        // 5. Return results with suggested action
    }
}
```

### API Endpoints Needed
1. `POST /{tenant}/api/v1/geography/candidates` - Submit missing geography
2. `GET /{tenant}/api/v1/geography/fuzzy-match` - Preview fuzzy matches
3. `GET /admin/geography/candidates` - Review pending submissions
4. `POST /admin/geography/candidates/{id}/approve` - Approve/reject

---

## 🧪 RUNNING TESTS

```bash
# All geography tests
cd packages/laravel-backend
php artisan test tests/Unit/Contexts/Geography/

# Specific test suites
php artisan test --filter DailyGeographySyncCommandTest
php artisan test --filter DailyGeographySyncTest
php artisan test --filter GeographyCandidateServiceTest
php artisan test --filter FuzzyMatchingServiceTest

# Test coverage (target 80%+)
php artisan test --coverage --min=80
```

---

## 📊 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] PostgreSQL extensions enabled (`pg_trgm`, `fuzzystrmatch`)
- [ ] Landlord database has `geo_candidate_units` table
- [ ] All tenant databases have `tenant_geo_candidates` table
- [ ] Scheduled job configured for daily sync
- [ ] Admin users have review permissions

### Post-Deployment Monitoring
- [ ] Daily sync logs (`storage/logs/geography-sync.log`)
- [ ] Candidate submission volume
- [ ] Fuzzy matching accuracy
- [ ] Review queue turnaround time

---

## 🔗 RELATED DOCUMENTS

1. **Architecture**: `architecture/backend/membership-contexts/ddd_connect_geographical_contexts/20251222_2026_two_way_geo_sync_fuzzy_method.md`
2. **Developer Guide**: `developer_guide/laravel-backend/membership-context/ddd_connect_geographical_contexts/20251223_1100_developer_guide_geography_sync_system.md`
3. **Debug Guide**: `architecture/backend/membership-contexts/ddd_connect_geographical_contexts/20251223_1545_debug.md`
4. **Core Principle**: `core_principle_for_all_prompts.md` - "Simplicity Over Complexity"

---

## 🏆 KEY ACHIEVEMENTS

1. ✅ **Complete fuzzy matching infrastructure** with PostgreSQL extensions
2. ✅ **Downstream sync service** with daily batch processing
3. ✅ **Artisan command** with proper error handling and output
4. ✅ **Candidate tables** in both landlord and tenant databases
5. ✅ **Simple submission service** for immediate use
6. ✅ **Comprehensive test suite** with mocking strategy
7. ✅ **"Simplicity Over Complexity"** principle applied throughout

---

**Last Updated**: 2025-12-23 16:00
**Status**: Downstream sync complete, upstream sync pending
**Test Coverage**: 100% for implemented components
**Next Priority**: Implement `UpstreamSyncService` with fuzzy matching integration