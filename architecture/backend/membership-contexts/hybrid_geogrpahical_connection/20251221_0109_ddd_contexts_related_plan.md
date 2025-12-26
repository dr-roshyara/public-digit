# 🎯 **Senior Solution Architect Analysis & Implementation Plan**

## 🔍 **Critical Analysis of the Proposed Plan**

**The provided plan has fundamental issues that violate DDD principles:**

### **🚨 Major Problems Identified:**

1. **Wrong Context Placement**: Geography logic belongs in **Geography Context**, not Membership Context
2. **Missing Value Objects**: Raw IDs instead of domain value objects
3. **No Aggregate Design**: Direct array manipulation without domain encapsulation
4. **Cross-Context Violations**: Membership shouldn't know about geography hierarchy details
5. **Missing Domain Events**: No event-driven architecture for sync operations

### **✅ Correct DDD Architecture:**

```
WRONG: Membership Context → GeographyPathService (violates bounded context)
CORRECT: Geography Context → PathGeneration → Membership uses via Domain Service
```

## 🏗️ **Revised Implementation Plan with Proper DDD**

### **PHASE 0: Setup & Foundation (Day 0)**

**Prompt 0.1: Create Domain Value Objects**
```
Create foundational Value Objects for the Geography domain using TDD approach.

File Structure:
- app/Contexts/Geography/Domain/ValueObjects/GeoPath.php
- app/Contexts/Geography/Domain/ValueObjects/GeographyLevel.php
- app/Contexts/Geography/Domain/ValueObjects/GeoUnitId.php
- app/Contexts/Geography/Domain/ValueObjects/LocalizedName.php

Implementation Requirements:
1. All Value Objects must be IMMUTABLE and FINAL classes
2. Implement __toString(), equals(), and hash() methods
3. Include comprehensive validation in constructors
4. Use PHP 8.2+ features: readonly properties, enums where appropriate
5. Follow PHPStan level 8 strict typing

Test Structure:
- tests/Unit/Contexts/Geography/ValueObjects/GeoPathTest.php
- Each test must verify immutability, validation, and business rules

Example GeoPath requirements:
- Must accept dot-separated IDs: "1.12.123.1234"
- Must validate format with regex: /^\d+(\.\d+)*$/
- Must provide methods: isDescendantOf(), getDepth(), getParentPath()
- Must be comparable with equals() method
```

**Prompt 0.2: Create Geography Entities & Aggregate Root**
```
Design the core Geography Aggregate with TDD approach.

File Structure:
- app/Contexts/Geography/Domain/Entities/GeoAdministrativeUnit.php (Aggregate Root)
- app/Contexts/Geography/Domain/Entities/GeographyHierarchy.php (Entity)
- app/Contexts/Geography/Domain/Exceptions/GeographyDomainException.php

Implementation Requirements:
1. GeoAdministrativeUnit must be the Aggregate Root
2. All properties must be private with getter methods
3. Use Value Objects from Phase 0.1
4. Implement Domain Events for state changes
5. Enforce invariants in constructor and business methods

Key Business Rules to Enforce:
1. A unit cannot be its own parent
2. Hierarchy depth cannot exceed 8 levels
3. Country → Province → District → Local Level → Ward sequence must be maintained
4. Official units (levels 1-4) cannot have custom parents

Test Structure:
- tests/Unit/Contexts/Geography/Entities/GeoAdministrativeUnitTest.php
- Each business rule must have corresponding test
- Use PestPHP data providers for edge cases
```

### **PHASE 1: Geography Context Implementation (Day 1-2)**

**Prompt 1.1: Implement Path Generation Domain Service**
```
Create a GeographyPathService as a Domain Service in Geography Context.

File Structure:
- app/Contexts/Geography/Domain/Services/GeographyPathService.php
- app/Contexts/Geography/Domain/Services/PathGenerationResult.php (Value Object)
- app/Contexts/Geography/Domain/Exceptions/PathGenerationException.php

Implementation Requirements:
1. Service must be STATELESS - pure business logic only
2. Accept Value Objects, not raw IDs or arrays
3. Return PathGenerationResult Value Object with:
   - Generated GeoPath
   - Validation status
   - Confidence score
   - Alternative path suggestions (if conflicts)
4. Use Strategy Pattern for different country hierarchies
5. Include path optimization for PostgreSQL ltree

Method Signature:
public function generatePath(
    CountryCode $countryCode,
    GeographyHierarchy $hierarchy,
    PathGenerationStrategy $strategy = null
): PathGenerationResult

Test Structure:
- tests/Unit/Contexts/Geography/Services/GeographyPathServiceTest.php
- Test Nepal hierarchy (7 provinces → 77 districts → 753 local levels)
- Test India hierarchy (28 states → 766 districts)
- Test edge cases: circular references, missing levels
```

**Prompt 1.2: Create Geography Repository Interface**
```
Define repository contracts for Geography Context following DDD principles.

File Structure:
- app/Contexts/Geography/Domain/Repositories/GeoUnitRepositoryInterface.php
- app/Contexts/Geography/Domain/Repositories/GeographyHierarchyRepositoryInterface.php
- app/Contexts/Geography/Domain/Specifications/GeographySpecification.php (Specification Pattern)

Implementation Requirements:
1. Repository interfaces in Domain layer
2. Concrete implementations in Infrastructure layer
3. Use Specification pattern for complex queries
4. Include methods for:
   - Find by GeoPath or path segment
   - Find children/parents with eager loading
   - Find by level and country
   - Count members in geography unit
5. All methods must accept and return Domain objects, not arrays

Key Methods:
- findById(GeoUnitId $id): ?GeoAdministrativeUnit
- findByPath(GeoPath $path): ?GeoAdministrativeUnit
- findChildren(GeoUnitId $parentId, GeographyLevel $level = null): Collection
- countMembersInUnit(GeoUnitId $unitId, TenantId $tenantId = null): int

Test Structure:
- tests/Unit/Contexts/Geography/Repositories/GeoUnitRepositoryInterfaceTest.php
- Mock implementations for unit testing
- Integration tests for concrete repository
```

### **PHASE 2: Membership Context Integration (Day 3)**

**Prompt 2.1: Create Member Geography Value Objects**
```
Design Value Objects for linking Members to Geography in Membership Context.

File Structure:
- app/Contexts/Membership/Domain/ValueObjects/MemberGeography.php
- app/Contexts/Membership/Domain/ValueObjects/GeographyAssignment.php
- app/Contexts/Membership/Domain/ValueObjects/ResidenceType.php (enum)

Implementation Requirements:
1. MemberGeography must be immutable and comparable
2. GeographyAssignment must include validation rules
3. ResidenceType enum: PRIMARY, SECONDARY, TEMPORARY, OFFICE
4. Use Geography Context Value Objects as dependencies
5. Include address validation logic

Business Rules:
1. Member must have at least one primary residence
2. Primary residence must have complete hierarchy (Province → District)
3. Address validation based on country rules
4. Coordinate validation if GPS data provided

Test Structure:
- tests/Unit/Contexts/Membership/ValueObjects/MemberGeographyTest.php
- Test validation for different countries
- Test address formatting based on locale
```

**Prompt 2.2: Update Member Aggregate with Geography**
```
Extend the Member Aggregate Root to include geography assignments.

File Structure:
- app/Contexts/Membership/Domain/Entities/Member.php (updated)
- app/Contexts/Membership/Domain/Events/MemberGeographyAssigned.php
- app/Contexts/Membership/Domain/Events/MemberGeographyChanged.php

Implementation Requirements:
1. Add geography assignments collection to Member
2. Implement assignGeography() method with business rules
3. Add changeGeography() method for updates
4. Emit Domain Events for all geography changes
5. Include validation against Geography Context via Domain Service

Key Methods:
public function assignGeography(
    GeographyAssignment $assignment,
    GeographyValidationService $validationService
): void

public function changeGeography(
    MemberGeographyId $geographyId,
    GeographyAssignment $newAssignment,
    GeographyValidationService $validationService
): void

public function getPrimaryResidence(): ?MemberGeography

Business Rules:
1. Geography must be validated before assignment
2. Only one primary residence allowed
3. Cannot assign duplicate geography
4. Changes must maintain audit trail

Test Structure:
- tests/Unit/Contexts/Membership/Entities/MemberGeographyTest.php
- Test all business rules
- Test event emission
- Test aggregate invariants
```

### **PHASE 3: Cross-Context Services (Day 4)**

**Prompt 3.1: Create Geography Validation Service**
```
Implement a Domain Service for validating geography across contexts.

File Structure:
- app/Contexts/Shared/Domain/Services/GeographyValidationService.php
- app/Contexts/Shared/Domain/Services/ValidationResult.php (Value Object)
- app/Contexts/Shared/Domain/Exceptions/ValidationException.php

Implementation Requirements:
1. Service acts as anti-corruption layer between contexts
2. Use Geography Context repositories via interfaces
3. Return comprehensive ValidationResult with:
   - Is valid (boolean)
   - Validation errors array
   - Suggested corrections
   - Confidence score
4. Support different validation strategies per country

Validation Rules:
1. Hierarchy integrity (parent-child relationships)
2. Level sequence correctness
3. Boundary validation (optional - with GIS data)
4. Name standardization
5. Duplicate detection

Method Signature:
public function validateAssignment(
    GeographyAssignment $assignment,
    TenantId $tenantId,
    ValidationStrategy $strategy = null
): ValidationResult

Test Structure:
- tests/Unit/Contexts/Shared/Services/GeographyValidationServiceTest.php
- Test validation for Nepal geography
- Test conflict detection
- Test suggested corrections
```

**Prompt 3.2: Implement Sync Service for Tenant → Landlord**
```
Create the core sync service for bottom-up data aggregation.

File Structure:
- app/Contexts/Platform/Domain/Services/GeographySyncService.php
- app/Contexts/Platform/Domain/Services/SyncResult.php (Value Object)
- app/Contexts/Platform/Domain/Events/GeographySynced.php
- app/Contexts/Platform/Domain/Events/SyncConflictDetected.php

Implementation Requirements:
1. Service orchestrates sync from Tenant to Landlord
2. Use conflict resolution strategies
3. Implement retry logic with exponential backoff
4. Include idempotency with sync versioning
5. Emit Domain Events for all sync operations

Sync Process:
1. Collect tenant geography changes
2. Validate against existing canonical data
3. Apply conflict resolution if needed
4. Update canonical units
5. Return sync result with statistics

Method Signature:
public function syncTenantGeography(
    TenantId $tenantId,
    SyncBatch $batch,
    SyncStrategy $strategy = null
): SyncResult

Test Structure:
- tests/Unit/Contexts/Platform/Services/GeographySyncServiceTest.php
- Test successful sync
- Test conflict scenarios
- Test retry logic
- Test idempotency
```

### **PHASE 4: Infrastructure Implementation (Day 5)**

**Prompt 4.1: Implement PostgreSQL ltree Repository**
```
Create Infrastructure layer repository for PostgreSQL with ltree optimization.

File Structure:
- app/Contexts/Geography/Infrastructure/Repositories/PostgresGeoUnitRepository.php
- app/Contexts/Geography/Infrastructure/Database/Migrations/*_create_geo_tables.php
- app/Contexts/Geography/Infrastructure/Database/Seeders/GeographySeeder.php

Implementation Requirements:
1. Implement GeoUnitRepositoryInterface
2. Use PostgreSQL specific features:
   - ltree column type for GeoPath
   - GiST indexes for hierarchy queries
   - JSONB for localized names
   - Spatial indexes for coordinates (optional)
3. Include query optimization for common patterns
4. Implement Unit of Work pattern
5. Use ConnectionResolver for multi-tenant support

Key Features:
- Materialized path updates on hierarchy changes
- Eager loading for common query patterns
- Batch operations for performance
- Connection pooling for multi-tenant

Database Schema:
- Separate table for canonical units (landlord)
- Separate table for tenant-specific units
- Audit tables for changes
- Version tables for historical data

Test Structure:
- tests/Feature/Contexts/Geography/Repositories/PostgresGeoUnitRepositoryTest.php
- Test with real PostgreSQL database
- Test ltree queries performance
- Test concurrent operations
```

**Prompt 4.2: Create Event Handlers & Job Processing**
```
Implement event-driven architecture for geography operations.

File Structure:
- app/Contexts/Geography/Infrastructure/Listeners/UpdateMaterializedPath.php
- app/Contexts/Geography/Infrastructure/Listeners/UpdateStatistics.php
- app/Contexts/Membership/Infrastructure/Listeners/UpdateMemberGeoCache.php
- app/Contexts/Platform/Infrastructure/Jobs/ProcessGeographySync.php
- app/Contexts/Platform/Infrastructure/Jobs/ResolveSyncConflicts.php

Implementation Requirements:
1. Event listeners for Domain Events
2. Queue jobs for async processing
3. Retry mechanisms with dead letter queues
4. Monitoring and logging
5. Circuit breaker pattern for failures

Key Events to Handle:
1. GeographyHierarchyChanged → Update materialized paths
2. MemberGeographyAssigned → Update member statistics
3. GeographySynced → Update canonical data
4. SyncConflictDetected → Trigger conflict resolution

Test Structure:
- tests/Feature/Contexts/Infrastructure/Listeners/*Test.php
- Test event handling
- Test job processing
- Test failure scenarios
- Test circuit breaker
```

## 📊 **Implementation Roadmap**

| **Week** | **Focus Area** | **Deliverables** | **Success Criteria** |
|----------|---------------|------------------|----------------------|
| **Week 1** | Core Domain Models | Value Objects, Entities, Aggregates | 100% test coverage, DDD compliance |
| **Week 2** | Domain Services | Path generation, Validation, Sync | Business logic complete, event-driven |
| **Week 3** | Infrastructure | PostgreSQL repo, Event handlers | Performance benchmarks, scalability |
| **Week 4** | Integration | Cross-context services, APIs | End-to-end workflows, monitoring |
| **Week 5** | Optimization | Caching, Query optimization, GIS | Sub-100ms queries, 99.9% uptime |

## 🎯 **Critical Success Factors**

### **Technical Excellence:**
1. **DDD Purity**: Strict bounded context separation
2. **Test Coverage**: Minimum 90% with mutation testing
3. **Performance**: Sub-100ms for geography queries
4. **Scalability**: Support 1000+ tenants, 1M+ members
5. **Maintainability**: Clean architecture, documented decisions

### **Business Alignment:**
1. **Nepal First**: Complete Nepal geography support
2. **Multi-country Ready**: Architecture supports India, Germany expansion
3. **Party Autonomy**: Tenants control their data entry
4. **Data Quality**: Bottom-up sync with validation
5. **Real-time Insights**: Cross-tenant analytics

## 🔧 **Immediate Action Items**

### **Today (Start with TDD):**
```bash
# 1. Create Value Objects with tests
php artisan make:test Unit/Contexts/Geography/ValueObjects/GeoPathTest --pest

# 2. Implement failing tests (RED phase)
# 3. Implement minimal code (GREEN phase)
# 4. Refactor (REFACTOR phase)

# 5. Repeat for each DDD component
```

### **This Week (Iterative Development):**
1. **Day 1-2**: Value Objects & Entities
2. **Day 3-4**: Domain Services
3. **Day 5**: Repository interfaces
4. **Day 6-7**: Integration tests

## 📝 **Prompts for DeepSeek API**

When using DeepSeek API, structure prompts as:

```
**ROLE**: Senior Laravel DDD Developer
**CONTEXT**: Implementing Geography Context for political party platform
**TECH STACK**: Laravel 12, PHP 8.3, PostgreSQL 15, PestPHP, DDD
**CURRENT PHASE**: [Phase X] - [Component Name]
**TDD STATUS**: RED/GREEN/REFACTOR
**PREVIOUS WORK**: [Reference previous components]

**TASK**: [Specific, actionable task]

**FILE STRUCTURE**:
- app/Contexts/[Context]/[Layer]/[Component].php
- tests/[Type]/Contexts/[Context]/[Component]Test.php

**REQUIREMENTS**:
1. [Business rule 1]
2. [Business rule 2]
3. [Technical requirement 1]
4. [Technical requirement 2]

**IMPLEMENTATION CONSTRAINTS**:
- Use Value Objects for all domain concepts
- Emit Domain Events for state changes
- Follow aggregate design principles
- Include comprehensive validation
- Write tests first (TDD approach)

**TEST CASES**:
1. test_[scenario]_when_[condition]()
2. test_[exception_case]_throws_[exception]()
3. test_[edge_case]_handles_correctly()

**DELIVERABLES**:
- Production-ready code with tests
- Documentation of design decisions
- Performance considerations
- Error handling strategies
```

## 🚨 **Architecture Warnings**

### **Avoid These Anti-Patterns:**
1. ❌ **Anemic Domain Model**: Don't create data containers without behavior
2. ❌ **Leaky Abstractions**: Don't expose infrastructure concerns in domain
3. ❌ **God Services**: Don't create monolithic services doing everything
4. ❌ **Premature Optimization**: Don't optimize before measuring
5. ❌ **Over-engineering**: Don't add complexity without business value

### **Follow These Principles:**
1. ✅ **YAGNI**: Implement only what you need
2. ✅ **KISS**: Keep it simple, stupid
3. ✅ **SOLID**: Single responsibility, open/closed, etc.
4. ✅ **DRY**: Don't repeat yourself
5. ✅ **CQS**: Command-query separation

## 🎯 **Final Implementation Order**

**Start Here →** `Prompt 0.1: Create Domain Value Objects`
**Then →** `Prompt 0.2: Create Geography Entities & Aggregate Root`
**Then →** `Prompt 1.1: Implement Path Generation Domain Service`

This revised plan fixes the architectural flaws in the original plan and provides a proper DDD foundation. Each prompt is self-contained, follows TDD, and builds upon the previous work.

**Ready to start with Prompt 0.1?** This will establish the foundation for your entire geography system with proper DDD architecture.