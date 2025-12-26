# 🚀 **Professional Implementation Plan: Geo-Organizational Units**

## 📋 **EXECUTIVE SUMMARY**

**Project**: Implement Geo-Organizational Units for Political Party Management Platform  
**Architecture**: Domain-Driven Design (DDD) with Multi-Context Integration  
**Approach**: Test-Driven Development (TDD) with Phased Delivery  
**Contexts**: Geography (Ready) → Membership (Exists) → Platform/Landlord (Exists)

---

## 🎯 **PHASE 0: PROJECT SETUP & ANALYSIS (Day 1)**

### **Step 0.1: Context Analysis & Domain Mapping**
```bash
# Analyze existing contexts and domain boundaries
php artisan domain:analyze --context=Geography
php artisan domain:analyze --context=Membership
php artisan domain:analyze --context=Platform

# Generate domain map visualization
php artisan domain:map --output=docs/domain-map-v1.0.md
```

### **Step 0.2: Define Ubiquitous Language**
Create `/docs/ubiquitous-language.md`:
```
# GEO-ORGANIZATIONAL UNITS DOMAIN LANGUAGE

## CORE CONCEPTS
- **TenantGeoUnit**: Party-specific geographical unit (levels 1-8)
- **CanonicalGeoUnit**: Verified, cross-party geographical reference
- **GeographyLevel**: Administrative level (0=Country, 1=Province, ..., 8=Household)
- **SyncOperation**: Process of syncing tenant → canonical data
- **ConfidenceScore**: 0.0-1.0 measure of data reliability

## BUSINESS RULES
1. Level 1-2 (Province-District) are REQUIRED for member registration
2. Levels 5-8 are tenant-customizable organizational units
3. Sync threshold: 70% similarity for automatic matching
4. High confidence: ≥80% tenant consensus on unit naming
```

### **Step 0.3: Initialize TDD Workspace**
```bash
# Create test directory structure
mkdir -p tests/Unit/Domain/{ValueObjects,Aggregates,Services}
mkdir -p tests/Feature/Contexts/{Membership,Geography,Platform}

# Install testing tools
composer require --dev pestphp/pest pestphp/pest-plugin-laravel
composer require --dev mockery/mockery

# Configure Pest
php artisan pest:install
```

---

## 🏗️ **PHASE 1: DOMAIN MODEL FOUNDATION (Days 2-4)**

### **Week 1: Value Objects & Entities (TDD Focus)**

#### **Day 1-2: Implement Value Objects**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: Senior DDD Developer implementing Value Objects with TDD
**CONTEXT**: Building geography domain model for political party system
**TASK**: Create immutable Value Objects for geography domain
**TDD RULE**: RED → GREEN → REFACTOR for each VO

**IMPLEMENTATION ORDER**:
1. GeoPath (hierarchy path: "1.23.456.7890")
2. LocalizedName (multi-language: {'en': 'Kathmandu', 'np': 'काठमाडौं'})
3. UnitCode (tenant-specific: "UML-PR-ABC123")
4. OfficialCode (government: "NP-P3")
5. ConfidenceScore (0.0-1.0 with validation)
6. SyncStatus (enum: DRAFT, PENDING_SYNC, SYNCED, REJECTED)

**FILE STRUCTURE**:
app/Domain/Shared/ValueObjects/
├── GeoPath.php
├── LocalizedName.php
├── Geography/
│   ├── UnitCode.php
│   ├── OfficialCode.php
│   └── ConfidenceScore.php
└── Sync/
    ├── SyncStatus.php
    └── SyncVersion.php

**TEST REQUIREMENTS**:
- All VOs must be immutable (no setters)
- Validation in constructor
- equals() method for comparison
- toString() method for serialization
- 100% test coverage
- Business rule validation tests

**EXAMPLE TEST (GeoPath)**:
```php
// tests/Unit/Domain/ValueObjects/GeoPathTest.php
it('creates_valid_geopath', function () {
    $path = GeoPath::fromString('1.23.456');
    expect($path->toString())->toBe('1.23.456');
});

it('rejects_invalid_geopath', function () {
    $this->expectException(InvalidGeoPathException::class);
    GeoPath::fromString('1.23.abc');
});

it('detects_descendant_relationship', function () {
    $parent = GeoPath::fromString('1.23');
    $child = GeoPath::fromString('1.23.456');
    expect($child->isDescendantOf($parent))->toBeTrue();
});
```

**DEPENDENCY INJECTION**: Use constructor injection only
**IMMUTABILITY**: All properties private, no mutation methods
**ERROR HANDLING**: Domain-specific exceptions for validation failures
"""
```

#### **Day 3-4: Implement Entities & Aggregates**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: Senior DDD Developer implementing Aggregates with TDD
**CONTEXT**: Geography domain with tenant → landlord sync
**TASK**: Create TenantGeoUnit Aggregate Root with business invariants
**TDD FOCUS**: Business rule validation in tests

**AGGREGATE ROOT**: TenantGeoUnit
**ENTITIES IN AGGREGATE**: None (simple aggregate)
**VALUE OBJECTS USED**: UnitCode, LocalizedName, SyncStatus, GeoPath

**INVARIANTS TO PROTECT**:
1. Parent must be exactly one level higher (if exists)
2. Cannot create beyond level 8
3. Cannot sync already-synced units
4. Official code must match government pattern (if provided)

**FILE STRUCTURE**:
app/Contexts/Membership/Domain/
├── Entities/
│   ├── TenantGeoUnit.php (Aggregate Root)
│   └── TenantGeoUnitId.php (Entity ID)
├── ValueObjects/ (already created)
└── Exceptions/
    ├── InvalidHierarchyException.php
    ├── MaximumLevelException.php
    └── AlreadySyncedException.php

**TEST REQUIREMENTS**:
- Test all invariants fail appropriately
- Test domain events are raised
- Test value object composition
- Test factory methods
- Test business operations (createChild, markForSync, linkToCanonical)

**EXAMPLE BUSINESS RULE TEST**:
```php
// tests/Unit/Domain/Aggregates/TenantGeoUnitTest.php
it('prevents_creating_beyond_level_8', function () {
    $unit = TenantGeoUnitFactory::createAtLevel(8);
    
    $this->expectException(MaximumLevelException::class);
    $unit->createChild('Household', GeographyLevel::fromNumber(9));
});

it('requires_parent_to_be_one_level_higher', function () {
    $province = TenantGeoUnitFactory::createAtLevel(1);
    
    $this->expectException(InvalidHierarchyException::class);
    $province->createChild('Ward', GeographyLevel::fromNumber(4)); // Skip 2,3
});

it('raises_event_when_marked_for_sync', function () {
    $unit = TenantGeoUnitFactory::createDraftUnit();
    
    $unit->markForSync();
    
    expect($unit->releaseEvents())
        ->toContainInstanceOf(TenantGeoUnitReadyForSync::class);
});
```

**DOMAIN EVENTS TO IMPLEMENT**:
1. TenantGeoUnitCreated
2. TenantGeoUnitReadyForSync
3. TenantGeoUnitSynced
4. TenantGeoUnitRejected

**PERSISTENCE IGNORANCE**: No database code in domain layer
"""
```

---

## 🔧 **PHASE 2: DOMAIN SERVICES & REPOSITORIES (Days 5-7)**

### **Week 2: Business Logic & Persistence**

#### **Day 5: GeographySyncService**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: DDD Service Layer Specialist
**TASK**: Implement GeographySyncService with matching algorithms
**PATTERN**: Domain Service (stateless business logic)
**DEPENDENCIES**: Repositories, Similarity Calculator

**SERVICE RESPONSIBILITIES**:
1. Find canonical matches for tenant units
2. Calculate similarity scores
3. Create/update canonical units
4. Handle conflict detection
5. Return sync results

**ALGORITHMS NEEDED**:
- Name similarity (Levenshtein, Jaro-Winkler)
- Hierarchy validation
- Confidence scoring
- Conflict detection logic

**FILE STRUCTURE**:
app/Contexts/Geography/Domain/Services/
├── GeographySyncService.php (main service)
├── NameSimilarityCalculator.php (strategy pattern)
└── ConfidenceScoreCalculator.php

**INTERFACE DESIGN**:
```php
interface GeographySyncServiceInterface
{
    public function sync(TenantGeoUnitId $tenantUnitId): SyncResult;
    public function batchSync(array $tenantUnitIds): BatchSyncResult;
    public function findConflicts(CanonicalGeoUnitId $canonicalId): array;
}
```

**TEST STRATEGY**:
- Mock all repository dependencies
- Test similarity algorithms with edge cases
- Test conflict detection scenarios
- Test batch operations with partial failures

**EXAMPLE SERVICE TEST**:
```php
// tests/Unit/Domain/Services/GeographySyncServiceTest.php
it('creates_new_canonical_when_no_match_found', function () {
    $tenantUnit = TenantGeoUnitFactory::create();
    $repo = mock(CanonicalGeoUnitRepository::class);
    $repo->shouldReceive('findSimilar')->andReturn([]);
    
    $service = new GeographySyncService($repo);
    $result = $service->sync($tenantUnit->id());
    
    expect($result->operation())->toBe(SyncOperation::CREATED);
    expect($result->confidenceScore())->toBeLessThan(0.3);
});

it('updates_existing_when_high_similarity', function () {
    $tenantUnit = TenantGeoUnitFactory::createWithName('Kathmandu');
    $canonical = CanonicalGeoUnitFactory::createWithName('Katmandu');
    $repo = mock(CanonicalGeoUnitRepository::class);
    $repo->shouldReceive('findSimilar')->andReturn([$canonical]);
    
    $service = new GeographySyncService($repo);
    $result = $service->sync($tenantUnit->id());
    
    expect($result->operation())->toBe(SyncOperation::UPDATED);
    expect($result->confidenceScore())->toBeGreaterThan(0.8);
});
```

**PERFORMANCE CONSIDERATIONS**:
- Batch database operations
- Cache similarity calculations
- Implement circuit breaker for external API calls
"""
```

#### **Day 6: Repository Interfaces & Implementations**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: DDD Repository Pattern Expert
**TASK**: Implement repository interfaces and Eloquent implementations
**PRINCIPLE**: Persistence Ignorance in Domain, Implementation in Infrastructure

**REPOSITORIES NEEDED**:
1. TenantGeoUnitRepositoryInterface (Membership Context)
2. CanonicalGeoUnitRepositoryInterface (Geography Context)
3. GeographyLevelRepositoryInterface (Shared)

**FILE STRUCTURE**:
app/Contexts/Membership/
├── Domain/Repositories/
│   └── TenantGeoUnitRepositoryInterface.php
└── Infrastructure/Repositories/
    └── EloquentTenantGeoUnitRepository.php

app/Contexts/Geography/
├── Domain/Repositories/
│   └── CanonicalGeoUnitRepositoryInterface.php
└── Infrastructure/Repositories/
    └── EloquentCanonicalGeoUnitRepository.php

**INTERFACE DESIGN**:
```php
interface TenantGeoUnitRepositoryInterface
{
    public function nextIdentity(): TenantGeoUnitId;
    public function find(TenantGeoUnitId $id): ?TenantGeoUnit;
    public function findByCriteria(GeoUnitCriteria $criteria): Collection;
    public function findPendingSync(TenantId $tenantId): Collection;
    public function save(TenantGeoUnit $unit): void;
    public function remove(TenantGeoUnit $unit): void;
}
```

**IMPLEMENTATION REQUIREMENTS**:
- Use Eloquent for persistence
- Implement Criteria pattern for complex queries
- Handle tenant database switching
- Implement unit of work pattern
- Add query performance optimization

**TEST STRATEGY**:
- Integration tests with real database
- Test transaction boundaries
- Test concurrent access scenarios
- Test tenant isolation

**EXAMPLE REPOSITORY TEST**:
```php
// tests/Feature/Infrastructure/Repositories/EloquentTenantGeoUnitRepositoryTest.php
it('saves_and_retrieves_tenant_geo_unit', function () {
    $unit = TenantGeoUnitFactory::create();
    $repository = app(TenantGeoUnitRepositoryInterface::class);
    
    $repository->save($unit);
    $retrieved = $repository->find($unit->id());
    
    expect($retrieved)->not->toBeNull();
    expect($retrieved->id()->equals($unit->id()))->toBeTrue();
    expect($retrieved->name()->equals($unit->name()))->toBeTrue();
});

it('finds_pending_sync_units', function () {
    $tenant = TenantFactory::create();
    $syncedUnit = TenantGeoUnitFactory::createSynced($tenant);
    $pendingUnit = TenantGeoUnitFactory::createPendingSync($tenant);
    
    $repository = app(TenantGeoUnitRepositoryInterface::class);
    $pending = $repository->findPendingSync($tenant->id());
    
    expect($pending)->toHaveCount(1);
    expect($pending->first()->id()->equals($pendingUnit->id()))->toBeTrue();
});
```

**PERFORMANCE OPTIMIZATIONS**:
- Add database indexes on query patterns
- Implement read-through caching
- Use database-specific optimizations (PostgreSQL ltree)
"""
```

#### **Day 7: Factory Pattern Implementation**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: DDD Factory Pattern Specialist
**TASK**: Implement factories for complex aggregate creation
**USE CASES**: Form data → TenantGeoUnit, TenantGeoUnit → CanonicalGeoUnit

**FACTORIES NEEDED**:
1. TenantGeoUnitFactory (create from form data)
2. CanonicalGeoUnitFactory (create from tenant unit)
3. GeographyLevelFactory (create level configuration)

**FILE STRUCTURE**:
app/Contexts/Membership/Domain/Factories/
├── TenantGeoUnitFactory.php
└── GeographyLevelFactory.php

app/Contexts/Geography/Domain/Factories/
└── CanonicalGeoUnitFactory.php

**FACTORY DESIGN**:
```php
class TenantGeoUnitFactory
{
    public static function createFromForm(
        FormData $formData,
        TenantId $tenantId,
        UserId $createdBy
    ): TenantGeoUnit {
        // Extract and validate hierarchy
        // Create chain of units
        // Apply business rules
        // Return leaf unit
    }
    
    public static function createHierarchy(
        array $hierarchyData,
        TenantId $tenantId
    ): Collection {
        // Create complete hierarchy
        // Validate parent-child relationships
        // Return all created units
    }
}
```

**VALIDATION RULES IN FACTORIES**:
1. Required levels present (Country, Province, District)
2. Hierarchy continuity (no gaps)
3. Name validation (length, characters)
4. Level-specific business rules

**TEST REQUIREMENTS**:
- Test all validation rules
- Test hierarchy creation
- Test edge cases (missing optional levels)
- Test error recovery

**EXAMPLE FACTORY TEST**:
```php
// tests/Unit/Domain/Factories/TenantGeoUnitFactoryTest.php
it('creates_hierarchy_from_form_data', function () {
    $formData = [
        'country' => 'Nepal',
        'province' => 'Bagmati',
        'district' => 'Kathmandu',
        'ward' => '32',
        'street' => 'Bhanimandal Road'
    ];
    
    $unit = TenantGeoUnitFactory::createFromForm(
        FormData::fromArray($formData),
        TenantId::fromString('uml'),
        UserId::fromString('user-123')
    );
    
    expect($unit->level()->value())->toBe(5); // Street is level 5
    expect($unit->name()->value())->toBe('Bhanimandal Road');
    
    // Verify parent chain
    $current = $unit;
    $names = [];
    while ($current->parentId()) {
        $current = $current->parent();
        $names[] = $current->name()->value();
    }
    
    expect($names)->toContain('Kathmandu', 'Bagmati', 'Nepal');
});

it('rejects_incomplete_required_hierarchy', function () {
    $formData = [
        'country' => 'Nepal',
        // Missing province (required level 1)
        'district' => 'Kathmandu'
    ];
    
    $this->expectException(IncompleteHierarchyException::class);
    
    TenantGeoUnitFactory::createFromForm(
        FormData::fromArray($formData),
        TenantId::fromString('uml'),
        UserId::fromString('user-123')
    );
});
```

**ERROR HANDLING**:
- Domain-specific exceptions
- Detailed error messages
- Recovery suggestions
"""
```

---

## 🔗 **PHASE 3: CONTEXT INTEGRATION (Days 8-10)**

### **Week 3: Cross-Context Communication & API**

#### **Day 8: Application Services & DTOs**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: DDD Application Layer Architect
**TASK**: Implement application services with CQRS pattern
**RESPONSIBILITIES**: Use case orchestration, transaction management, DTO conversion

**APPLICATION SERVICES**:
1. SyncGeographyApplicationService (orchestrates sync flow)
2. ManageGeoUnitsApplicationService (CRUD operations)
3. GeographyReportApplicationService (queries and reports)

**COMMANDS & QUERIES**:
```php
// Commands (write operations)
class SyncTenantGeoUnitCommand
{
    public function __construct(
        public readonly TenantGeoUnitId $tenantUnitId,
        public readonly UserId $initiatedBy
    ) {}
}

// Queries (read operations)
class GetGeographyHierarchyQuery
{
    public function __construct(
        public readonly TenantId $tenantId,
        public readonly ?GeographyLevel $fromLevel = null
    ) {}
}
```

**FILE STRUCTURE**:
app/Contexts/Membership/Application/
├── Services/
│   ├── SyncGeographyApplicationService.php
│   └── ManageGeoUnitsApplicationService.php
├── Commands/
├── Queries/
└── DTOs/
    ├── TenantGeoUnitDTO.php
    └── SyncResultDTO.php

**SERVICE IMPLEMENTATION**:
```php
class SyncGeographyApplicationService
{
    public function __construct(
        private GeographySyncService $syncService,
        private TenantGeoUnitRepositoryInterface $tenantRepository,
        private EventDispatcher $dispatcher
    ) {}
    
    public function syncUnit(SyncTenantGeoUnitCommand $command): SyncResultDTO
    {
        return DB::transaction(function () use ($command) {
            $unit = $this->tenantRepository->find($command->tenantUnitId);
            
            $result = $this->syncService->sync($unit);
            
            $unit->linkToCanonical(
                $result->canonicalId(),
                $result->syncVersion()
            );
            
            $this->tenantRepository->save($unit);
            
            $this->dispatcher->dispatchAll($unit->releaseEvents());
            
            return SyncResultDTO::fromDomain($result);
        });
    }
}
```

**TEST REQUIREMENTS**:
- Test transaction boundaries
- Test error rollback
- Test event dispatching
- Test DTO conversion
"""
```

#### **Day 9: API Layer & Controllers**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: API Design Specialist
**TASK**: Implement RESTful API endpoints with proper HTTP semantics
**STANDARDS**: JSON:API specification, proper HTTP status codes

**ENDPOINTS NEEDED**:
```
GET    /api/geography/units           # List tenant geography units
GET    /api/geography/units/{id}      # Get specific unit
POST   /api/geography/units           # Create unit from form
POST   /api/geography/units/{id}/sync # Trigger sync
GET    /api/geography/hierarchy       # Get complete hierarchy
GET    /api/geography/reports/coverage # Get geographical coverage report
```

**FILE STRUCTURE**:
app/Http/Controllers/Api/Tenant/
├── GeographyUnitsController.php
├── GeographySyncController.php
└── GeographyReportsController.php

routes/tenant-api.php

**CONTROLLER DESIGN**:
```php
class GeographyUnitsController extends Controller
{
    public function store(CreateGeographyUnitRequest $request)
    {
        $command = new CreateTenantGeoUnitCommand(
            formData: $request->validated(),
            tenantId: $request->user()->tenant_id,
            createdBy: $request->user()->id
        );
        
        $result = $this->commandBus->dispatch($command);
        
        return GeographyUnitResource::make($result)
            ->response()
            ->setStatusCode(201);
    }
    
    public function sync(SyncGeographyUnitRequest $request, string $unitId)
    {
        $command = new SyncTenantGeoUnitCommand(
            tenantUnitId: TenantGeoUnitId::fromString($unitId),
            initiatedBy: $request->user()->id
        );
        
        $result = $this->commandBus->dispatch($command);
        
        return SyncResultResource::make($result);
    }
}
```

**TEST REQUIREMENTS**:
- HTTP status code tests
- Request validation tests
- Authentication/authorization tests
- Error response format tests
"""
```

#### **Day 10: Event Handlers & Background Jobs**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: Event-Driven Architecture Specialist
**TASK**: Implement domain event handlers and background processing
**TECHNOLOGY**: Laravel Events, Queues, Redis

**EVENT HANDLERS NEEDED**:
1. TenantGeoUnitCreatedHandler (log audit, send notifications)
2. TenantGeoUnitSyncedHandler (update reports, clear cache)
3. SyncConflictDetectedHandler (notify admins, create ticket)

**BACKGROUND JOBS**:
1. BatchSyncGeographyJob (process multiple units)
2. CalculateGeographyCoverageJob (nightly reporting)
3. CleanupOrphanedGeoUnitsJob (maintenance)

**FILE STRUCTURE**:
app/Contexts/Membership/Infrastructure/Listeners/
├── TenantGeoUnitCreatedHandler.php
└── TenantGeoUnitSyncedHandler.php

app/Jobs/
├── Geography/
│   ├── BatchSyncGeographyJob.php
│   └── CalculateGeographyCoverageJob.php

**EVENT HANDLER IMPLEMENTATION**:
```php
class TenantGeoUnitSyncedHandler
{
    public function handle(TenantGeoUnitSynced $event): void
    {
        // 1. Update cache
        Cache::tags(["tenant_{$event->tenantId()}_geography"])
            ->flush();
        
        // 2. Update real-time statistics
        Redis::hincrby(
            "geography:sync:stats:{$event->tenantId()}",
            $event->syncOperation(),
            1
        );
        
        // 3. Log to activity feed
        ActivityLog::create([
            'tenant_id' => $event->tenantId(),
            'user_id' => $event->initiatedBy(),
            'action' => 'geography.synced',
            'data' => [
                'unit_id' => $event->tenantUnitId(),
                'canonical_id' => $event->canonicalId(),
                'operation' => $event->syncOperation()
            ]
        ]);
        
        // 4. Queue coverage recalculation
        CalculateGeographyCoverageJob::dispatch($event->tenantId())
            ->delay(now()->addMinutes(5));
    }
}
```

**TEST REQUIREMENTS**:
- Test event handling logic
- Test queue job execution
- Test error handling in background jobs
- Test idempotency of handlers
"""
```

---

## 📊 **PHASE 4: TESTING & DEPLOYMENT (Days 11-14)**

### **Week 4: Comprehensive Testing & Production Readiness**

#### **Day 11-12: Integration & End-to-End Tests**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: Quality Assurance & Testing Architect
**TASK**: Create comprehensive test suite with different testing levels
**COVERAGE TARGET**: 90%+ code coverage, 100% business logic coverage

**TEST PYRAMID STRUCTURE**:
```
Unit Tests (70%) - Value Objects, Entities, Domain Services
Integration Tests (20%) - Repositories, Event Handlers
Feature Tests (10%) - API Endpoints, User Workflows
```

**TEST SUITE ORGANIZATION**:
tests/
├── Unit/
│   ├── Domain/
│   │   ├── ValueObjects/ (all VOs)
│   │   ├── Entities/ (all entities)
│   │   ├── Aggregates/ (aggregate roots)
│   │   └── Services/ (domain services)
│   └── Application/ (application services)
├── Feature/
│   ├── Contexts/
│   │   ├── Membership/Geography/ (API tests)
│   │   └── Geography/Sync/ (sync flow tests)
│   └── Integration/ (cross-context tests)
└── Browser/ (optional UI tests)

**KEY INTEGRATION TESTS**:
1. Tenant → Landlord sync flow
2. Conflict detection and resolution
3. Hierarchical data integrity
4. Multi-tenant isolation
5. Performance under load

**EXAMPLE E2E TEST**:
```php
// tests/Feature/GeographySyncFlowTest.php
it('completes_full_sync_flow_from_form_to_canonical', function () {
    // 1. User submits form
    $response = $this->postJson('/api/geography/units', [
        'country' => 'Nepal',
        'province' => 'Bagmati',
        'district' => 'Kathmandu',
        'ward' => '32'
    ]);
    
    $response->assertStatus(201);
    $unitId = $response->json('data.id');
    
    // 2. Trigger sync
    $syncResponse = $this->postJson("/api/geography/units/{$unitId}/sync");
    $syncResponse->assertStatus(202);
    
    // 3. Verify sync completed
    $this->runWorker(); // Process queued job
    
    // 4. Check canonical database
    tenancy()->central(function () use ($unitId) {
        $syncLog = TenantSyncLog::where('tenant_unit_id', $unitId)->first();
        expect($syncLog)->not->toBeNull();
        expect($syncLog->status)->toBe('completed');
        
        $canonical = CanonicalGeoUnit::find($syncLog->canonical_unit_id);
        expect($canonical->canonical_name)->toBe('Kathmandu');
    });
    
    // 5. Verify tenant unit is updated
    $unitResponse = $this->getJson("/api/geography/units/{$unitId}");
    $unitResponse->assertJsonPath('data.attributes.sync_status', 'synced');
});
```

**PERFORMANCE TESTING**:
- Test with 10,000+ geography units
- Measure sync operation latency
- Test concurrent user access
- Monitor memory usage
"""
```

#### **Day 13: Deployment Configuration & Monitoring**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: DevOps & Infrastructure Specialist
**TASK**: Create production deployment configuration and monitoring
**ENVIRONMENT**: Laravel Forge/Vapor, Redis, PostgreSQL, Queue Workers

**DEPLOYMENT FILES**:
1. `.env.production` template
2. `docker-compose.prod.yml` (if using Docker)
3. `deploy.php` (Deployer configuration)
4. `supervisor.conf` (worker configuration)

**MONITORING SETUP**:
1. Laravel Telescope configuration
2. Logging channels (Stackdriver, Papertrail)
3. Health check endpoints
4. Performance metrics collection

**HEALTH CHECKS**:
```php
// routes/health.php
Route::get('/health/geography', function () {
    return [
        'status' => 'healthy',
        'timestamp' => now()->toISOString(),
        'metrics' => [
            'pending_sync_count' => TenantGeoUnit::pendingSync()->count(),
            'sync_success_rate' => Cache::get('geography:sync:success_rate', 100),
            'average_sync_time' => Cache::get('geography:sync:avg_time', 0),
            'conflict_count' => ConflictResolution::pending()->count()
        ]
    ];
});
```

**ALERTING RULES**:
1. Sync failure rate > 5%
2. Average sync time > 30 seconds
3. Pending sync queue > 1000 items
4. Database connection errors

**DEPLOYMENT CHECKLIST**:
- [ ] Database migrations tested
- [ ] Queue workers configured
- [ ] Cache configuration verified
- [ ] Monitoring alerts set up
- [ ] Rollback plan documented
- [ ] Performance baseline established
"""
```

#### **Day 14: Documentation & Knowledge Transfer**
```bash
# Prompt for Claude CLI:
"""
**ROLE**: Technical Documentation Specialist
**TASK**: Create comprehensive documentation for the geo-organizational units feature
**AUDIENCES**: Developers, System Administrators, End Users

**DOCUMENTATION STRUCTURE**:
docs/
├── architecture/
│   ├── domain-model.md (DDD concepts)
│   ├── data-flow.md (sequence diagrams)
│   └── context-boundaries.md
├── api/
│   ├── geography-api.md (OpenAPI/Swagger)
│   └── webhooks.md (event notifications)
├── development/
│   ├── getting-started.md
│   ├── testing-guide.md
│   └── deployment-guide.md
└── operations/
    ├── monitoring.md
    ├── troubleshooting.md
    └── scaling-guide.md

**API DOCUMENTATION EXAMPLE**:
```markdown
# Geography Units API

## Create Geography Unit
`POST /api/geography/units`

Creates a new geography unit from form data.

**Request Body**:
```json
{
  "data": {
    "type": "geography-units",
    "attributes": {
      "country": "Nepal",
      "province": "Bagmati",
      "district": "Kathmandu",
      "ward": "32",
      "street": "Bhanimandal Road",
      "house_number": "25A"
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "id": "geo_123",
    "type": "geography-units",
    "attributes": {
      "name": "25A",
      "level": 6,
      "sync_status": "draft",
      "created_at": "2024-01-15T10:30:00Z"
    },
    "relationships": {
      "parent": {
        "data": { "id": "geo_122", "type": "geography-units" }
      }
    }
  }
}
```

**Business Rules**:
1. Country, province, and district are required
2. Maximum hierarchy depth is 8 levels
3. Names must be unique within same level and parent
```

**KNOWLEDGE TRANSFER**:
1. Conduct code walkthrough sessions
2. Create troubleshooting runbook
3. Record architecture decision records (ADRs)
4. Set up continuous improvement process
"""
```

---

## 📈 **SUCCESS METRICS & ACCEPTANCE CRITERIA**

### **Technical Success Criteria**
- [ ] 90%+ test coverage across all layers
- [ ] All business rules implemented and tested
- [ ] Sync operations complete within 30 seconds (95th percentile)
- [ ] API response times < 200ms for read operations
- [ ] No data loss during sync operations
- [ ] Proper error handling and user feedback

### **Business Success Criteria**
- [ ] Users can create geography units through forms
- [ ] Automatic sync to canonical database works
- [ ] Conflict detection and resolution available
- [ ] Geographical reports and analytics accessible
- [ ] Multi-tenant isolation maintained
- [ ] System scales to 100,000+ geography units

### **Quality Gates**
```bash
# Pre-deployment checks
php artisan test --coverage --min=90
php artisan insights --min-quality=90
php artisan dusk (if applicable)
php artisan queue:restart (test workers)
```

---

## 🚨 **RISK MITIGATION STRATEGY**

| **Risk** | **Impact** | **Mitigation** |
|----------|------------|----------------|
| Data loss during sync | High | Implement transactional sync with rollback |
| Performance degradation | Medium | Add caching, implement batch processing |
| Conflict resolution complexity | High | Gradual rollout, admin dashboard |
| Multi-tenant data leakage | Critical | Extensive isolation testing, security review |
| Schema migration issues | Medium | Zero-downtime migrations, rollback tested |

---

## 📅 **DELIVERY TIMELINE SUMMARY**

- **Week 1**: Domain Model Foundation (Value Objects, Entities)
- **Week 2**: Business Logic & Persistence (Services, Repositories)
- **Week 3**: Integration & API Layer (Application Services, Controllers)
- **Week 4**: Testing & Production Readiness

**Total Estimated Effort**: 14 developer-days
**Go-Live Target**: End of Week 4

---

This implementation plan provides a comprehensive, step-by-step guide for building the geo-organizational units system using DDD and TDD principles. Each phase builds upon the previous one, ensuring a solid foundation and maintainable codebase.

**Ready to begin Phase 1? Start with the Value Objects implementation using the TDD approach outlined above.**