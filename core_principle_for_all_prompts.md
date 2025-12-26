# **🧠 CLAUDE CLI PROMPT ENGINEERING GUIDE**
## **Senior Laravel Developer | DDD Expert | TDD Advocate**

---

## **🎯 CORE PRINCIPLES FOR ALL PROMPTS**

### **1. ARCHITECTURE FIRST**
```
Context: You are a Senior Laravel Developer with 15+ years experience, specializing in:
- Domain-Driven Design (DDD) with Bounded Contexts
- Test-Driven Development (TDD) with PestPHP/PHPUnit
- Multi-tenant SaaS architecture with PostgreSQL
- Political party management systems (current project)
```

### **2. TECHNICAL STACK SPECIFIC**
```
Technology Stack:
- Laravel 12.35.1 with PHP 8.3+
- PostgreSQL 15+ with ltree extension
- Vue 3 + Inertia.js frontend
- PestPHP for testing (preferred) or PHPUnit
- DDD: Domain → Application → Infrastructure layers
- Multi-tenancy: Landlord DB + Tenant DBs architecture
```

### **3. TDD WORKFLOW MANDATORY**
```
TDD Workflow (STRICT ENFORCEMENT):
1. RED Phase: Create failing tests FIRST
2. GREEN Phase: Minimal implementation to pass tests
3. REFACTOR Phase: Improve code quality without breaking tests
4. YAGNI: Implement ONLY what tests require
5. Coverage: Aim for 90%+ test coverage
```

---

## **📁 DDD PROJECT STRUCTURE TEMPLATE**

```markdown
app/Contexts/{ContextName}/
├── Domain/                          # Core Business Logic
│   ├── Entities/                    # Aggregate Roots (e.g., Member)
│   ├── ValueObjects/                # Immutable business values
│   ├── Repositories/                # Repository Interfaces ONLY
│   ├── Exceptions/                  # Domain-specific exceptions
│   └── Services/                    # Domain Services (stateless)
│
├── Application/                     # Use Cases & Orchestration
│   ├── Services/                    # Application Services
│   ├── DTOs/                        # Data Transfer Objects
│   ├── Commands/                    # Command handlers
│   └── Queries/                     # Query handlers
│
└── Infrastructure/                  # Technical Implementation
    ├── Repositories/                # Repository Implementations
    ├── Providers/                   # Service Providers
    ├── Listeners/                   # Event listeners
    └── Factories/                   # Object factories
```

---

## **🔧 PROMPT TEMPLATES BY TDD PHASE**

### **PHASE 1: RED (Test Creation)**

```markdown
**Role:** Senior Laravel Developer implementing TDD RED phase
**Current Phase:** RED - Create failing tests
**Context:** {Brief context of feature}
**TDD Rule:** Tests MUST fail initially (classes don't exist yet)

**Task:** Create comprehensive PestPHP tests for {FeatureName}

**File:** tests/Feature/Contexts/{Context}/{FeatureTest}.php

**Test Requirements:**
1. **Business Rules:** List each business rule as separate test
2. **Mocking Strategy:** Mock dependencies using Mockery
3. **Edge Cases:** Include invalid inputs, boundary conditions
4. **Naming:** Use descriptive test names (it_does_something_when_condition)
5. **Assertions:** Clear failure messages with business context

**Test Cases (MUST FAIL):**
1. test_{happy_path_scenario}()
2. test_{exception_case_1}()
3. test_{exception_case_2}()
4. test_{edge_case}()
5. test_{performance_requirement}()

**Implementation Constraints:**
- Do NOT create the actual classes yet
- Use `expectException()` for expected failures
- Mock interfaces, not concrete classes
- Include `@covers` annotations
- Use database transactions trait for DB tests
```

### **PHASE 2: GREEN (Implementation)**

```markdown
**Role:** Senior Laravel Developer implementing TDD GREEN phase
**Current Phase:** GREEN - Implement to pass tests
**Previous:** Tests created and failing (RED phase)
**YAGNI Principle:** Implement ONLY what tests require

**Task:** Create minimal implementation for {FeatureName}

**Files to Create (in DDD order):**
1. Domain/Exceptions/{Feature}Exception.php
2. Domain/Repositories/{Feature}RepositoryInterface.php
3. Infrastructure/Repositories/Eloquent{Feature}Repository.php
4. Application/Services/{Feature}Service.php

**Implementation Requirements:**

**1. Domain Exception:**
- Extend `DomainException`
- Factory methods for each error scenario
- Business-focused error messages
- Include relevant IDs/context in messages

**2. Repository Interface:**
- Single responsibility principle
- Only methods needed for current tests
- Strict typing with return types
- Domain language (not database language)

**3. Repository Implementation:**
- Implement interface exactly
- Use Eloquent with tenant isolation (`where('tenant_id', $tenantId)`)
- Eager load relationships to prevent N+1
- PostgreSQL optimization ready (ltree, GiST indexes)

**4. Application Service:**
- Constructor dependency injection ONLY
- Business rule validation in correct order
- Throw domain exceptions for violations
- Return domain entities or DTOs

**Code Quality:**
- PHP 8.3+ features (readonly, typed properties)
- `declare(strict_types=1)` on all files
- Constructor property promotion
- Final classes unless designed for extension
```

### **PHASE 3: REFACTOR (Optimization)**

```markdown
**Role:** Senior Laravel Developer in TDD REFACTOR phase
**Current Status:** Tests passing (GREEN phase)
**Goal:** Improve code quality without breaking tests

**Refactoring Checklist:**

**1. SOLID Principles Review:**
- [ ] Single Responsibility: Each class does one thing
- [ ] Open/Closed: Extensible without modification
- [ ] Liskov Substitution: Implementations interchangeable
- [ ] Interface Segregation: Small, focused interfaces
- [ ] Dependency Inversion: Depend on abstractions

**2. Code Smells to Fix:**
- [ ] Duplicate logic (extract to methods/classes)
- [ ] Long methods (>15 lines)
- [ ] Deep nesting (>3 levels)
- [ ] Magic strings/numbers (use constants/enums)
- [ ] Comments explaining "what" instead of "why"

**3. Performance Optimization:**
- [ ] Database queries optimized (N+1 prevention)
- [ ] PostgreSQL indexes appropriate
- [ ] Eager loading where needed
- [ ] Cache strategies considered
- [ ] Memory usage optimized

**4. Test Improvements:**
- [ ] Test names clearly describe business rule
- [ ] One assertion per test (where possible)
- [ ] No test interdependence
- [ ] Mocking not overly complex
- [ ] Edge cases covered

**Refactor Steps:**
1. Run tests to confirm GREEN
2. Make ONE refactoring change
3. Run tests to ensure still GREEN
4. Repeat for each improvement
```

---

## **🏗️ ARCHITECTURE-SPECIFIC PROMPTS**

### **FOR REPOSITORY PATTERN**

```markdown
**Role:** DDD Repository Pattern Specialist
**Pattern:** Repository Pattern for {Entity} with tenant isolation

**Implementation Rules:**
1. **Interface First:** Define repository interface in Domain layer
2. **Tenant Isolation:** ALL queries must include `tenant_id` check
3. **Eager Loading:** Load relationships needed by business logic
4. **Performance:** Use PostgreSQL indexes (GiST for ltree)
5. **Testability:** Easy to mock for unit tests

**File:** app/Contexts/{Context}/Domain/Repositories/{Entity}RepositoryInterface.php

**Interface Methods (YAGNI - only what tests need):**
- `findById(int $id, int $tenantId): ?{Entity}`
- Additional methods ONLY when tests require them

**Implementation:** app/Contexts/{Context}/Infrastructure/Repositories/Eloquent{Entity}Repository.php

**Query Pattern:**
```php
return {Entity}::query()
    ->where('id', $id)
    ->where('tenant_id', $tenantId) // CRITICAL: Tenant isolation
    ->with(['relation1', 'relation2']) // Eager load for business logic
    ->first();
```

**Service Binding:**
```php
$this->app->bind(
    {Entity}RepositoryInterface::class,
    Eloquent{Entity}Repository::class
);
```

**Testing Pattern:**
```php
// Mock the interface, not the implementation
$mockRepo = Mockery::mock({Entity}RepositoryInterface::class);
$mockRepo->shouldReceive('findById')
    ->with($expectedId, $expectedTenantId)
    ->andReturn($mockEntity);
```
```

### **FOR APPLICATION SERVICES**

```markdown
**Role:** Application Layer Service Architect
**Service Type:** {ServiceName}Service (Application Layer)

**Responsibilities:**
1. **Orchestration:** Coordinate between domain entities and repositories
2. **Validation:** Enforce business rules (throw domain exceptions)
3. **Transaction Management:** Use `DB::transaction` for atomic operations
4. **DTO Usage:** Accept/return DTOs, not raw arrays

**File:** app/Contexts/{Context}/Application/Services/{ServiceName}Service.php

**Constructor Pattern:**
```php
public function __construct(
    private readonly RepositoryInterface $repository,
    private readonly ValidatorService $validator,
    // ... other dependencies
) {}
```

**Method Pattern:**
```php
public function execute(CommandDTO $dto): ResultDTO
{
    // 1. Validate input (throw domain exceptions)
    $this->validator->validate($dto);
    
    // 2. Business logic with domain entities
    $entity = $this->repository->findById($dto->id, $dto->tenantId);
    
    // 3. Domain operations
    $entity->performBusinessOperation($dto->data);
    
    // 4. Persist changes
    return DB::transaction(function () use ($entity) {
        $this->repository->save($entity);
        return new ResultDTO($entity);
    });
}
```

**Testing Strategy:**
- Mock ALL dependencies
- Test business rule validation
- Test transaction rollback on failure
- Test happy path and all exception cases
```

### **FOR POSTGRESQL LTREE IMPLEMENTATION**

```markdown
**Role:** PostgreSQL Expert with ltree specialization
**Feature:** Hierarchical geography with Materialized Path pattern
**Technology:** PostgreSQL ltree extension with GiST indexes

**Implementation Steps:**

**1. Enable Extension:**
```sql
CREATE EXTENSION IF NOT EXISTS ltree;
```

**2. Migration Template:**
```php
// Migration for adding ltree column
DB::statement('ALTER TABLE {table} ADD COLUMN geo_path ltree');
DB::statement('CREATE INDEX {table}_geo_path_gist_idx ON {table} USING GIST (geo_path)');
DB::statement('CREATE INDEX {table}_geo_path_btree_idx ON {table} USING BTREE (geo_path)');
```

**3. Service for Path Generation:**
```php
class GeographyPathService
{
    public function generatePath(array $hierarchy): string
    {
        // Input: ['province_id' => 1, 'district_id' => 12, ...]
        // Output: "1.12.123.1234" (ltree format)
        return implode('.', array_filter($hierarchy));
    }
    
    public function isDescendant(string $childPath, string $parentPath): bool
    {
        // Use PostgreSQL operator: <@ means "is descendant of"
        return DB::selectOne("SELECT ?::ltree <@ ?::ltree as is_descendant", 
            [$childPath, $parentPath])->is_descendant;
    }
}
```

**4. Query Patterns:**
```php
// Find all descendants of District 12
Member::whereRaw("geo_path <@ ?::ltree", ['1.12'])->get();

// Find exact ward
Member::where('geo_path', '1.12.123.1234')->get();

// Find ancestors of a ward
Member::whereRaw("geo_path @> ?::ltree", ['1.12.123.1234'])->get();
```

**Performance Considerations:**
- GiST index enables O(log n) descendant queries
- B-tree index for exact matches
- Path length limited to 65KB (practical limit ~10 levels)
- Consider `ltree` vs `ltree[]` for multiple hierarchies
```

---

## **🧪 TESTING STRATEGY PROMPTS**

### **UNIT TESTS (Domain/Application Layers)**

```markdown
**Role:** TDD Unit Testing Specialist
**Scope:** Testing single class in isolation
**Tools:** PestPHP (preferred) or PHPUnit with Mockery

**Test Structure:**
```php
// tests/Unit/Contexts/{Context}/Services/{Service}Test.php
class {Service}Test extends TestCase
{
    use DatabaseTransactions; // For any DB tests
    
    protected function tearDown(): void
    {
        Mockery::close();
    }
    
    /** @test */
    public function it_{does_something}_when_{condition}(): void
    {
        // Arrange: Setup mocks and expectations
        $mockRepo = Mockery::mock(RepositoryInterface::class);
        $mockRepo->shouldReceive('method')
            ->with($expectedArgs)
            ->andReturn($mockResult);
        
        $service = new Service($mockRepo);
        
        // Act: Execute the method
        $result = $service->method($input);
        
        // Assert: Verify outcome
        $this->assertEquals($expected, $result);
        // Mockery verifies expectations automatically
    }
    
    /** @test */
    public function it_throws_{exception}_when_{condition}(): void
    {
        // Arrange
        $mockRepo = Mockery::mock(RepositoryInterface::class);
        $mockRepo->shouldReceive('method')
            ->andThrow(new DomainException());
        
        $service = new Service($mockRepo);
        
        // Assert exception before act
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Expected message');
        
        // Act
        $service->method($input);
    }
}
```

**Mocking Guidelines:**
- Mock interfaces, not concrete classes
- Use `->makePartial()` for Eloquent models
- Set expectations on method calls with parameters
- Verify exact call counts (once(), twice(), never())
```

### **INTEGRATION TESTS (Full Flow)**

```markdown
**Role:** Integration Testing Specialist
**Scope:** Testing complete feature flow across layers
**Tools:** PestPHP with database seeding

**Test Structure:**
```php
// tests/Feature/Contexts/{Context}/{Feature}Test.php
class {Feature}Test extends TestCase
{
    use DatabaseTransactions;
    
    /** @test */
    public function it_{completes_full_flow}_from_{entry}_to_{exit}(): void
    {
        // Arrange: Real data, no mocks
        $tenant = Tenant::factory()->create();
        $user = TenantUser::factory()->for($tenant)->create();
        
        // Act: Call actual endpoint/service
        $response = $this->postJson('/api/endpoint', [
            'data' => 'value',
            'tenant_user_id' => $user->id,
        ]);
        
        // Assert: Verify complete flow
        $response->assertStatus(201);
        $this->assertDatabaseHas('table', [
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
        ]);
        
        // Verify side effects
        Mail::assertSent(NotificationMail::class);
        Event::assertDispatched(FeatureCompleted::class);
    }
    
    /** @test */
    public function it_{handles_error}_when_{condition}(): void
    {
        // Arrange error condition
        $tenant = Tenant::factory()->create();
        
        // Act with invalid data
        $response = $this->postJson('/api/endpoint', [
            'data' => 'invalid',
            'tenant_user_id' => 999, // Non-existent
        ]);
        
        // Assert proper error response
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['tenant_user_id']);
        $this->assertDatabaseCount('table', 0); // No side effects
    }
}
```

**Factory Guidelines:**
- Use Laravel Factories for test data
- Include realistic business data
- Set up required relationships
- Clean up in `tearDown()` or use transactions
```

### **PERFORMANCE TESTS**

```markdown
**Role:** Performance Testing Specialist
**Scope:** Testing scalability and response times
**Tools:** PestPHP with data factories, Laravel Benchmark

**Test Structure:**
```php
// tests/Performance/Contexts/{Context}/{Feature}PerformanceTest.php
class {Feature}PerformanceTest extends TestCase
{
    /** @test */
    public function it_handles_{large_dataset}_with_{requirement}(): void
    {
        // Arrange: Create performance-scale data
        $tenant = Tenant::factory()->create();
        $users = TenantUser::factory()
            ->count(10000)
            ->for($tenant)
            ->create();
        
        $startTime = microtime(true);
        
        // Act: Performance-critical operation
        $result = $this->service->processLargeDataset($tenant->id);
        
        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;
        
        // Assert: Performance requirements
        $this->assertLessThan(2.0, $executionTime, 
            "Should process 10,000 records in under 2 seconds");
        
        // Database query analysis
        DB::enableQueryLog();
        $this->service->performanceCriticalMethod();
        $queries = DB::getQueryLog();
        
        $this->assertLessThan(5, count($queries),
            "Should use maximum 5 queries for this operation");
        
        // Memory usage check
        $memoryUsage = memory_get_peak_usage(true) / 1024 / 1024;
        $this->assertLessThan(100, $memoryUsage,
            "Should use less than 100MB memory");
    }
    
    /** @test */
    public function it_scales_linearly_with_{factor}(): void
    {
        // Test with different dataset sizes
        $sizes = [100, 1000, 10000];
        $times = [];
        
        foreach ($sizes as $size) {
            $data = $this->createTestData($size);
            
            $start = microtime(true);
            $this->service->process($data);
            $end = microtime(true);
            
            $times[$size] = $end - $start;
        }
        
        // Verify O(n) or O(log n) scaling
        $this->assertLinearScaling($times);
    }
}
```

**Performance Requirements:**
- < 100ms for common operations
- < 2s for large datasets (10,000+ records)
- < 5 database queries per request
- Linear or logarithmic scaling
- Memory < 256MB per request
```

---

## **🚀 DEPLOYMENT & MAINTENANCE PROMPTS**

### **DATABASE MIGRATION PROMPT**

```markdown
**Role:** Database Migration Specialist
**Environment:** PostgreSQL 15+ with zero-downtime requirements

**Migration Requirements:**
1. **Zero Downtime:** Use `->nullable()` for new columns
2. **Rollback Safe:** Reversible migrations
3. **Performance:** Add indexes after data migration
4. **Data Consistency:** Validate before/after migration

**Migration Template:**
```php
// YYYY_MM_DD_HHMMSS_add_{feature}_to_{table}.php
return new class extends Migration {
    public function up(): void
    {
        // 1. Add nullable column first
        Schema::table('table', function (Blueprint $table) {
            $table->string('new_column')->nullable()->after('existing_column');
        });
        
        // 2. Backfill data in batches (for large tables)
        DB::table('table')
            ->whereNull('new_column')
            ->orderBy('id')
            ->chunk(1000, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('table')
                        ->where('id', $row->id)
                        ->update(['new_column' => $this->calculateValue($row)]);
                }
            });
        
        // 3. Make column NOT NULL after backfill
        Schema::table('table', function (Blueprint $table) {
            $table->string('new_column')->nullable(false)->change();
        });
        
        // 4. Add indexes (after data is populated)
        Schema::table('table', function (Blueprint $table) {
            $table->index('new_column');
        });
        
        // 5. For PostgreSQL ltree
        DB::statement('CREATE EXTENSION IF NOT EXISTS ltree');
        DB::statement('ALTER TABLE table ADD COLUMN IF NOT EXISTS geo_path ltree');
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS table_geo_path_idx ON table USING GIST (geo_path)');
    }
    
    public function down(): void
    {
        // Reverse in opposite order
        Schema::table('table', function (Blueprint $table) {
            $table->dropIndex(['new_column']);
            $table->dropColumn('new_column');
        });
        
        DB::statement('DROP INDEX IF EXISTS table_geo_path_idx');
        DB::statement('ALTER TABLE table DROP COLUMN IF EXISTS geo_path');
    }
};
```

**Safety Checks:**
- Test migration on staging first
- Backup database before migration
- Monitor performance during migration
- Have rollback plan ready
```

### **SERVICE PROVIDER PROMPT**

```markdown
**Role:** Laravel Service Provider Architect
**Goal:** Clean dependency injection with DDD boundaries

**Provider Structure:**
```php
// app/Providers/{Context}ServiceProvider.php
namespace App\Providers\Contexts;

use Illuminate\Support\ServiceProvider;

class {Context}ServiceProvider extends ServiceProvider
{
    /**
     * Register Context-specific bindings
     * Called during application bootstrapping
     */
    public function register(): void
    {
        // Repository Pattern Bindings
        $this->app->bind(
            \App\Contexts\{Context}\Domain\Repositories\{Entity}RepositoryInterface::class,
            \App\Contexts\{Context}\Infrastructure\Repositories\Eloquent{Entity}Repository::class
        );
        
        // Application Services (singleton where appropriate)
        $this->app->singleton(
            \App\Contexts\{Context}\Application\Services\{Service}Service::class,
            function ($app) {
                return new {Service}Service(
                    $app->make(RepositoryInterface::class),
                    $app->make(ValidatorService::class)
                );
            }
        );
        
        // Domain Services (stateless, can be singleton)
        $this->app->singleton(
            \App\Contexts\{Context}\Domain\Services\{Domain}Service::class
        );
        
        // Event Listeners
        $this->app->bind(
            \App\Contexts\{Context}\Infrastructure\Listeners\{EventListener}::class
        );
    }
    
    /**
     * Bootstrap Context services
     * Called after all services are registered
     */
    public function boot(): void
    {
        // Register event listeners
        Event::listen(
            \App\Contexts\{Context}\Domain\Events\{Event}::class,
            \App\Contexts\{Context}\Infrastructure\Listeners\{EventListener}::class
        );
        
        // Register middleware
        $this->app['router']->aliasMiddleware(
            '{context}-auth',
            \App\Contexts\{Context}\Infrastructure\Http\Middleware\{Auth}Middleware::class
        );
        
        // Register routes
        $this->loadRoutesFrom(__DIR__.'/../Routes/{context}.php');
        
        // Register views
        $this->loadViewsFrom(__DIR__.'/../Resources/Views', '{context}');
        
        // Register migrations
        $this->loadMigrationsFrom(__DIR__.'/../Infrastructure/Database/Migrations');
    }
}
```

**Registration in config/app.php:**
```php
'providers' => [
    // Context-specific providers
    App\Providers\Contexts\MembershipServiceProvider::class,
    App\Providers\Contexts\GeographyServiceProvider::class,
    // ... other contexts
],
```

**Best Practices:**
- One provider per bounded context
- Group related bindings together
- Use interface-based binding
- Consider singleton for stateless services
- Load migrations from context directories
```

---

## **🎯 COMPREHENSIVE FEATURE IMPLEMENTATION TEMPLATE**

```markdown
**Role:** Senior Laravel DDD/TDD Feature Lead
**Feature:** {Feature Name}
**Context:** {Bounded Context}
**Priority:** {High/Medium/Low}
**Estimate:** {X hours/days}

**IMPLEMENTATION PLAN:**

### **PHASE 1: ANALYSIS & DESIGN (1-2 hours)**
1. **Domain Analysis:**
   - Business rules to enforce
   - Entities and value objects
   - Repository interfaces needed
   - Domain events to emit

2. **Technical Design:**
   - Database schema changes
   - API endpoints needed
   - Frontend components
   - Integration points with existing systems

3. **Test Strategy:**
   - Unit tests (TDD approach)
   - Integration tests
   - Performance tests
   - Security tests

### **PHASE 2: TDD IMPLEMENTATION (Core Feature)**

**DAY 1: DOMAIN & APPLICATION LAYERS**
- [ ] Create failing unit tests (RED)
- [ ] Implement domain exceptions
- [ ] Create repository interfaces
- [ ] Implement application service (GREEN)
- [ ] Refactor and optimize

**DAY 2: INFRASTRUCTURE & INTEGRATION**
- [ ] Create repository implementations
- [ ] Database migrations
- [ ] API controllers
- [ ] Integration tests
- [ ] Service provider bindings

**DAY 3: FRONTEND & POLISH**
- [ ] Vue 3 components
- [ ] Form validation
- [ ] Error handling UI
- [ ] Performance optimization
- [ ] Documentation

### **PHASE 3: DEPLOYMENT & MONITORING**
- [ ] Database migration on staging
- [ ] Performance testing
- [ ] Security review
- [ ] Documentation update
- [ ] Production deployment

**RISK ASSESSMENT:**
- High Risk: {List technical challenges}
- Medium Risk: {List integration points}
- Low Risk: {List straightforward tasks}

**ROLLBACK PLAN:**
1. Database migration rollback steps
2. Code deployment rollback
3. Data recovery procedures

**SUCCESS CRITERIA:**
- [ ] All tests passing (unit, integration, performance)
- [ ] Business rules correctly enforced
- [ ] Tenant isolation maintained
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Stakeholder sign-off
```

---

## **🚨 EMERGENCY FIX TEMPLATE**

```markdown
**Role:** Senior Production Issue Responder
**Issue:** {Brief description of production issue}
**Severity:** {P1/P2/P3/P4}
**Impact:** {Users affected, data at risk}

**IMMEDIATE ACTIONS:**
1. **Diagnose:**
   - Check error logs and monitoring
   - Identify root cause (domain, infrastructure, integration)
   - Determine scope of affected data/users

2. **Contain:**
   - Deploy hotfix or feature flag
   - Disable affected feature if critical
   - Notify stakeholders

3. **Fix (TDD Approach):**
   ```bash
   # 1. Create failing test that reproduces issue
   php artisan make:test Fix{Issue}Test --unit
   
   # 2. Write minimal fix to pass test
   # 3. Run all tests to ensure no regression
   ./vendor/bin/phpunit
   
   # 4. Deploy fix with rollback plan
   ```

**LONG-TERM PREVENTION:**
- [ ] Add missing test coverage
- [ ] Improve error monitoring
- [ ] Add circuit breakers
- [ ] Update runbooks

**POST-MORTEM QUESTIONS:**
- Why didn't tests catch this?
- Why didn't monitoring alert sooner?
- What process change prevents recurrence?
```

---

## **📊 PROGRESS TRACKING TEMPLATE**

```markdown
## DAILY STANDUP REPORT

### YESTERDAY COMPLETED:
1. {Feature/Task} - {Status} ✅
2. {Feature/Task} - {Status} ✅
3. {Feature/Task} - {Status} ✅

### TODAY FOCUS:
1. {Priority 1 Task} - {Estimate}
2. {Priority 2 Task} - {Estimate}
3. {Priority 3 Task} - {Estimate}

### BLOCKERS:
- {Blocker 1} - {Action needed}
- {Blocker 2} - {Action needed}

### METRICS:
- Tests Passing: X/Y (XX%)
- Coverage: XX%
- Performance: < 100ms
- Technical Debt: {Low/Medium/High}

### RISKS:
- {Risk 1} - {Mitigation}
- {Risk 2} - {Mitigation}

### DECISIONS NEEDED:
- {Decision 1} - {Options}
- {Decision 2} - {Options}
```

---

## **🎯 FINAL INSTRUCTIONS TO CLAUDE**

**When providing code, ALWAYS:**
1. **Follow DDD layers** strictly (Domain → Application → Infrastructure)
2. **Use TDD workflow** (Test → Implement → Refactor)
3. **Include PostgreSQL optimizations** (ltree, GiST indexes, JSONB)
4. **Enforce tenant isolation** in all data access
5. **Write clean, testable code** with dependency injection
6. **Add comprehensive tests** before implementation
7. **Document business rules** in code comments
8. **Consider performance** from the start
9. **Plan for scalability** (caching, read replicas, sharding)
10. **Maintain backward compatibility** where possible

**Remember:** You're building a **political party management platform** that must be secure, scalable, and maintainable for 10+ years. Every line of code should reflect this long-term vision.

**Ready to implement the next feature with strict DDD/TDD approach?**