# 🌍 **CLAUDE CLI PROMPT INSTRUCTIONS**
## **Global Political Party Digitalization Platform**
### **Senior Solution Architect Edition**

---

## 📋 **GLOBAL SYSTEM PROMPT** (Copy-Paste First)

```text
YOU ARE: Senior Laravel Solution Architect with 15+ years experience

CONTEXT: Building a GLOBAL political party digitalization platform

TECH STACK:
- Laravel 12 + DDD + CQRS + Event Sourcing
- Vue 3 + Inertia.js + TypeScript
- Spatie Multitenancy (Database-per-tenant)
- MySQL 8.0 with spatial extensions
- Redis for caching, Meilisearch for search

ARCHITECTURAL MANDATES:
1. 🌏 **COUNTRY-AGNOSTIC DESIGN**: Never hardcode country-specific logic
2. 🏛️ **3-TIER DATABASE ARCHITECTURE**:
   - Landlord DB: Global reference data (countries, geography templates, taxonomies)
   - Platform DB: Cross-tenant operational data (parties, users, subscriptions)
   - Tenant DB: Party-specific data (members, committees, elections) - ONE PER PARTY-COUNTRY
3. 🔄 **EVENT SOURCING FOR PARTY HISTORY**: All party changes are events
4. 📊 **POLYMORPHIC GEOGRAPHY**: Single table for all administrative units
5. ⚙️ **CONFIGURATION-DRIVEN VALIDATION**: No ENUMs, use taxonomy tables
6. 🧪 **TDD FIRST**: 80%+ test coverage required
7. 🚫 **NO LEGACY PATTERNS**: Follow fresh DDD architecture

EXISTING CODEBASE:
- We have legacy Laravel structure + some DDD contexts (Platform, Election, TenantAuth)
- New development MUST use DDD patterns from ground up
- Cannot break existing functionality

OUTPUT REQUIREMENTS:
1. 🗺️ Complete DDD structure (Domain → Application → Infrastructure → Tests)
2. 📝 Production-ready code with proper error handling
3. 🔒 Security-first implementation (SQL injection, XSS, CSRF protection)
4. 🐳 Docker-ready configuration
5. 📊 Database migration with partitioning for scale
6. 🧪 Complete test suite (Unit + Feature + Integration)

CRITICAL DECISIONS MADE:
✅ Tenant = Party-Country Instance (e.g., tenant_ncp_np, tenant_bjp_in)
✅ Database = 3-tier (Landlord + Platform + Tenants)
✅ Geography = Polymorphic table (geo_administrative_units)
✅ Party History = Event sourcing
✅ Language Support = Multi-lingual from day one

RULES:
- Every file MUST include proper PHPDoc
- Every class MUST have corresponding test
- Every migration MUST include rollback
- Every service MUST be dependency injected
- NO business logic in controllers
- NO raw SQL without parameter binding
- NO hardcoded country assumptions
```

---

## 📁 **ARCHITECTURE PROMPT** (Foundation)

### **Prompt 1.1: Directory Structure Setup**
```text
SETUP THE DDD ARCHITECTURE FOUNDATION

CONTEXT: We need to create a clean DDD structure for the global platform.

REQUIREMENTS:

1. CREATE THIS EXACT STRUCTURE:
```
app/Contexts/
├── Geography/                          # Country, Admin Units, Maps
│   ├── Domain/
│   │   ├── Aggregates/
│   │   │   ├── Country.php            # Aggregate Root
│   │   │   └── AdministrativeUnit.php # Entity
│   │   ├── ValueObjects/
│   │   │   ├── CountryCode.php        # ISO 3166-1
│   │   │   ├── GeographicCoordinate.php
│   │   │   ├── AdministrativeLevel.php
│   │   │   └── GeoCode.php            # Country-specific codes
│   │   ├── Events/
│   │   │   ├── CountryAdded.php
│   │   │   └── GeographyUpdated.php
│   │   ├── Repositories/
│   │   │   └── CountryRepositoryInterface.php
│   │   ├── Specifications/
│   │   │   ├── ActiveCountrySpecification.php
│   │   │   └── SupportedCountrySpecification.php
│   │   └── Exceptions/
│   │       ├── InvalidCountryCodeException.php
│   │       └── GeographyValidationException.php
│   ├── Application/
│   │   ├── Commands/
│   │   │   └── AddCountryCommand.php
│   │   ├── Handlers/
│   │   │   └── AddCountryHandler.php
│   │   ├── Services/
│   │   │   └── GeographyService.php
│   │   └── Queries/
│   │       └── GetCountryHierarchyQuery.php
│   ├── Infrastructure/
│   │   ├── Database/
│   │   │   ├── Migrations/
│   │   │   │   ├── create_countries_table.php
│   │   │   │   ├── create_country_geography_configs_table.php
│   │   │   │   └── create_geo_administrative_units_table.php
│   │   │   ├── Seeders/
│   │   │   │   ├── CountriesSeeder.php
│   │   │   │   └── NepalGeographySeeder.php
│   │   │   └── Models/
│   │   │       ├── Country.php
│   │   │       ├── CountryGeographyConfig.php
│   │   │       └── GeoAdministrativeUnit.php
│   │   ├── Repositories/
│   │   │   └── EloquentCountryRepository.php
│   │   └── Http/
│   │       └── Controllers/
│   │           └── CountryController.php
│   └── Tests/
│       ├── Unit/
│       │   ├── Domain/
│       │   │   ├── Aggregates/
│       │   │   │   └── CountryTest.php
│       │   │   └── ValueObjects/
│       │   │       └── CountryCodeTest.php
│       │   └── Application/
│       │       └── Services/
│       │           └── GeographyServiceTest.php
│       ├── Feature/
│       │   └── CountryManagementTest.php
│       └── Integration/
│           └── GeographyRepositoryTest.php
├── PoliticalParty/                     # Parties, Branches, History
│   ├── Domain/
│   │   ├── Aggregates/
│   │   │   ├── PoliticalParty.php     # Aggregate Root (Event Sourced)
│   │   │   └── PartyBranch.php        # Entity (Party in specific country)
│   │   ├── ValueObjects/
│   │   │   ├── PartyIdentifier.php
│   │   │   ├── PartyName.php
│   │   │   └── Ideology.php
│   │   ├── Events/
│   │   │   ├── PartyFoundedEvent.php
│   │   │   ├── PartyRegisteredEvent.php
│   │   │   ├── PartyMergedEvent.php
│   │   │   ├── PartySplitEvent.php
│   │   │   └── PartyRenamedEvent.php
│   │   ├── Repositories/
│   │   │   └── PoliticalPartyRepositoryInterface.php
│   │   └── Exceptions/
│   │       ├── PartyNotFoundException.php
│   │       └── InvalidMergerException.php
│   ├── Application/
│   │   ├── Commands/
│   │   │   ├── RegisterPartyCommand.php
│   │   │   ├── MergePartiesCommand.php
│   │   │   └── RenamePartyCommand.php
│   │   ├── Handlers/
│   │   │   ├── RegisterPartyHandler.php
│   │   │   ├── MergePartiesHandler.php
│   │   │   └── RenamePartyHandler.php
│   │   ├── Services/
│   │   │   └── PartyManagementService.php
│   │   └── Queries/
│   │       └── GetPartyHistoryQuery.php
│   ├── Infrastructure/
│   │   ├── Database/
│   │   │   ├── Migrations/
│   │   │   │   ├── create_political_parties_table.php
│   │   │   │   ├── create_party_branches_table.php
│   │   │   │   └── create_party_history_events_table.php
│   │   │   ├── Models/
│   │   │   │   ├── PoliticalParty.php
│   │   │   │   ├── PartyBranch.php
│   │   │   │   └── PartyHistoryEvent.php
│   │   │   └── EventStore/
│   │   │       ├── PartyEventStore.php
│   │   │       └── PartyProjection.php
│   │   ├── Repositories/
│   │   │   └── EloquentPoliticalPartyRepository.php
│   │   └── Http/
│   │       └── Controllers/
│   │           └── PartyController.php
│   └── Tests/
│       ├── Unit/
│       │   └── Domain/
│       │       └── Aggregates/
│       │           └── PoliticalPartyTest.php
│       ├── Feature/
│       │   └── PartyLifecycleTest.php
│       └── Integration/
│           └── PartyRepositoryTest.php
└── Tenant/                            # Party-Country Instances
    ├── Domain/
    │   ├── Aggregates/
    │   │   ├── Tenant.php             # Aggregate Root
    │   │   └── TenantSubscription.php # Entity
    │   ├── ValueObjects/
    │   │   ├── TenantIdentifier.php
    │   │   ├── DatabaseCredentials.php
    │   │   └── SubscriptionPlan.php
    │   ├── Events/
    │   │   ├── TenantProvisionedEvent.php
    │   │   ├── TenantSuspendedEvent.php
    │   │   └── TenantUpgradedEvent.php
    │   ├── Repositories/
    │   │   └── TenantRepositoryInterface.php
    │   └── Exceptions/
    │       ├── TenantNotFoundException.php
    │       └── ProvisioningFailedException.php
    ├── Application/
    │   ├── Commands/
    │   │   ├── ProvisionTenantCommand.php
    │   │   ├── SuspendTenantCommand.php
    │   │   └── UpgradeTenantCommand.php
    │   ├── Handlers/
    │   │   ├── ProvisionTenantHandler.php
    │   │   ├── SuspendTenantHandler.php
    │   │   └── UpgradeTenantHandler.php
    │   ├── Services/
    │   │   ├── TenantProvisioningService.php
    │   │   └── DatabaseManagementService.php
    │   └── Queries/
    │       └── GetTenantStatusQuery.php
    ├── Infrastructure/
    │   ├── Database/
    │   │   ├── Migrations/
    │   │   │   ├── create_tenants_table.php
    │   │   │   └── create_tenant_subscriptions_table.php
    │   │   └── Models/
    │   │       ├── Tenant.php
    │   │       └── TenantSubscription.php
    │   ├── Database/
    │   │   ├── TenantDatabaseManager.php
    │   │   ├── TenantConnectionFactory.php
    │   │   └── TemplateDatabaseSeeder.php
    │   ├── Repositories/
    │   │   └── EloquentTenantRepository.php
    │   └── Http/
    │       └── Controllers/
    │           └── TenantController.php
    └── Tests/
        ├── Unit/
        │   └── Domain/
        │       └── Aggregates/
        │           └── TenantTest.php
        ├── Feature/
        │   └── TenantProvisioningTest.php
        └── Integration/
            └── TenantDatabaseTest.php
```

2. CREATE CONFIGURATION FILES:
   - `config/geography.php` - Country and geography settings
   - `config/platform.php` - Platform-wide settings
   - `config/database.php` - Multi-database configuration
   - `config/cache.php` - Redis configuration for geography data

3. CREATE SERVICE PROVIDERS:
   - `app/Providers/GeographyServiceProvider.php`
   - `app/Providers/PoliticalPartyServiceProvider.php`
   - `app/Providers/TenantServiceProvider.php`

4. CREATE DOCKER COMPOSE for development:
   - MySQL for Landlord DB
   - MySQL for Platform DB
   - Redis for caching
   - Meilisearch for search
   - PHP 8.2 + Nginx

DELIVERABLES:
1. Complete directory structure (create empty files)
2. Service provider registrations
3. Configuration files with sensible defaults
4. Docker setup for local development
5. PHPUnit configuration for DDD testing

CONSTRAINTS:
- MUST NOT break existing `app/Contexts/Platform/` code
- MUST work with existing Spatie Multitenancy package
- MUST include proper namespaces
- MUST include .env.example with all required variables
```

---

## 🗺️ **PHASE 1: GEOGRAPHY CONTEXT**

### **Prompt 1.2: Country Aggregate & Value Objects**
```text
IMPLEMENT THE COUNTRY AGGREGATE (TDD FIRST)

CONTEXT: Country is the foundation of our global platform.

REQUIREMENTS (TDD APPROACH):

1. FIRST, CREATE TESTS:
```bash
# Create test for Country aggregate
php artisan make:test Geography/Domain/Aggregates/CountryTest --unit

# Create test for CountryCode value object
php artisan make:test Geography/Domain/ValueObjects/CountryCodeTest --unit
```

2. THEN IMPLEMENT DOMAIN LAYER:

A. VALUE OBJECTS:
   - `CountryCode.php` (ISO 3166-1 alpha-2)
     - Must validate: 2 uppercase letters
     - Must be valid ISO code
     - Methods: fromString(), value(), equals()
   - `GeographicCoordinate.php` (latitude/longitude)
     - Validate: -90 ≤ lat ≤ 90, -180 ≤ lng ≤ 180
   - `AdministrativeLevel.php`
     - 1 = top (province/state), 2 = district, etc.
     - Methods: level(), name(), parentLevel()

B. AGGREGATE: `Country.php`
   - Properties:
     - CountryCode $code
     - string $nameEn
     - array $nameLocal (JSON)
     - GeographyConfiguration $geoConfig
     - array $metadata
   - Rules:
     - Can't change country code after creation
     - Can update names and configuration
     - Can activate/deactivate
   - Methods:
     - create(): Factory method
     - updateNames(string $nameEn, array $nameLocal)
     - updateGeographyConfig(array $config)
     - activate() / deactivate()

C. ENTITY: `AdministrativeUnit.php`
   - Properties:
     - AdministrativeUnitId $id
     - AdministrativeLevel $level
     - string $nameEn
     - array $nameLocal
     - ?AdministrativeUnitId $parentId
     - GeographicCoordinate $centroid
   - Rules:
     - Must belong to a Country aggregate
     - Parent must exist in same country
     - Can't be its own parent

3. WRITE COMPREHENSIVE TESTS:
   - Test valid and invalid country codes
   - Test coordinate validation
   - Test country lifecycle (create, update, deactivate)
   - Test administrative unit hierarchy

DELIVERABLES:
1. Complete Domain layer with Value Objects, Aggregate, Entity
2. 100% test coverage for Domain layer
3. Validation logic for all business rules
4. Exception classes for invalid operations

CONSTRAINTS:
- NO database access in Domain layer
- Use PHP 8.2 features (readonly properties, enums)
- All methods must have return type declarations
- All exceptions must extend DomainException
```

### **Prompt 1.3: Geography Database Migrations**
```text
CREATE LANDLORD DATABASE MIGRATIONS

CONTEXT: Implement the polymorphic geography schema in Landlord DB.

REQUIREMENTS:

1. CREATE 3 MIGRATIONS:

A. `create_countries_table.php`
   - Following SQL schema from analysis document
   - MUST include:
     - ISO codes (alpha-2, alpha-3, numeric)
     - Multilingual names (JSON column)
     - Political system classification
     - Administrative hierarchy configuration
     - Validation rules (ID formats, phone regex)
   - Partitioning: Not needed (only ~196 rows)

B. `create_country_geography_configs_table.php`
   - Defines administrative levels for each country
   - Example: Nepal: [1:province, 2:district, 3:local_level, 4:ward]
   - Example: India: [1:state, 2:district, 3:subdistrict, 4:block, 5:panchayat]
   - Each level: name, code format, validation rules

C. `create_geo_administrative_units_table.php` (POLYMORPHIC)
   - Single table for ALL countries' admin units
   - MUST include:
     - country_code + admin_level + parent_id hierarchy
     - Materialized path for fast queries
     - Spatial columns (centroid, bounding_box)
     - JSON for multilingual names
     - System-versioned temporal support (valid_from, valid_to)
   - PARTITIONING: PARTITION BY KEY(country_code)
   - INDEXES: All critical indexes from analysis

2. IMPLEMENT TEMPORAL SUPPORT:
   - Use MySQL 8.0 system-versioned tables
   - Track boundary changes over time
   - Query history: "What were Nepal's districts in 2015?"

3. ADD SPATIAL SUPPORT:
   - Use MySQL spatial extensions
   - Store centroids and bounding boxes
   - Create spatial indexes
   - Support GIS queries: "Find all wards within 10km of point"

4. CREATE SEEDERS:
   - `CountriesSeeder.php`: Seed all 196 countries (ISO data)
   - `NepalGeographySeeder.php`: Seed Nepal's geography
     - 7 provinces with correct ISO codes (NP-P1 to NP-P7)
     - 77 districts with CBS codes
     - 753 local levels with types (metropolitan, municipality, rural)
     - ~6,743 wards

DELIVERABLES:
1. Complete SQL migrations with proper constraints
2. Seeders with real data for Nepal
3. Migration rollback scripts
4. Database indexes for performance
5. Spatial index configuration

CONSTRAINTS:
- MUST use InnoDB engine
- MUST include foreign key constraints
- MUST include proper collation (utf8mb4_unicode_ci)
- MUST include table comments
- MUST test with `php artisan migrate:fresh --database=landlord`
```

### **Prompt 1.4: Geography Repository & Services**
```text
IMPLEMENT GEOGRAPHY INFRASTRUCTURE LAYER

CONTEXT: Create the Infrastructure layer to persist and query geography data.

REQUIREMENTS:

1. ELOQUENT MODELS:
   - `Country.php` (extends Model)
     - Table: countries
     - Casts: names JSON, metadata JSON
     - Relationships: hasMany AdministrativeUnits
     - Scopes: active(), supported()
   - `CountryGeographyConfig.php`
     - Defines hierarchy levels per country
   - `GeoAdministrativeUnit.php`
     - Polymorphic model for all admin units
     - Casts: centroid as array, names as JSON
     - Methods: parent(), children(), ancestors(), descendants()
     - Scopes: byCountry(), byLevel(), active()

2. REPOSITORY: `EloquentCountryRepository.php`
   - Implements CountryRepositoryInterface
   - Methods:
     - findById(CountryId $id): ?Country
     - findByCode(CountryCode $code): ?Country
     - save(Country $country): void
     - delete(Country $country): void
     - findAllActive(): Collection
   - MUST use Query Builder for complex geography queries
   - MUST cache frequently accessed data (Redis)

3. GEOGRAPHY SERVICE: `GeographyService.php`
   - Application service for geography operations
   - Methods:
     - addCountry(AddCountryCommand $command): CountryId
     - updateCountryGeography(string $countryCode, array $geoData): void
     - getCountryHierarchy(string $countryCode): array
     - findAdministrativeUnit(string $countryCode, int $level, string $code): ?AdministrativeUnit
     - getAncestors(AdministrativeUnitId $unitId): Collection
     - getDescendants(AdministrativeUnitId $unitId, ?int $depth = null): Collection

4. CACHING STRATEGY:
   - Redis cache for:
     - Country list (24h TTL)
     - Country hierarchy (12h TTL)
     - Administrative unit lookups (1h TTL)
   - Cache invalidation on updates
   - Cache tags for country-specific data

5. SPATIAL QUERIES:
   - Implement spatial query methods:
     - findUnitsWithinRadius(float $lat, float $lng, float $radiusKm)
     - findUnitsContainingPoint(float $lat, float $lng)
     - findUnitsIntersectingPolygon(array $polygon)

DELIVERABLES:
1. Complete Infrastructure layer
2. Repository with caching
3. Geography service with spatial queries
4. Integration tests for all queries
5. Redis configuration and cache implementation

CONSTRAINTS:
- Repository MUST return Domain entities, not Eloquent models
- MUST handle database transactions
- MUST implement proper error handling
- MUST include query logging for performance monitoring
```

---

## 🏛️ **PHASE 2: POLITICAL PARTY CONTEXT**

### **Prompt 2.1: Party Aggregate with Event Sourcing**
```text
IMPLEMENT EVENT-SOURCED POLITICAL PARTY AGGREGATE

CONTEXT: Political parties have complex histories (mergers, splits, name changes).

REQUIREMENTS (EVENT SOURCING APPROACH):

1. EVENT STORE DESIGN:
   ```
   party_events table:
   - aggregate_id (PartyId)
   - event_type (string)
   - event_data (JSON)
   - version (int)
   - occurred_at (timestamp)
   - metadata (JSON)
   ```

2. PARTY AGGREGATE: `PoliticalParty.php`
   - Properties (current state):
     - PartyId $id
     - PartyName $name
     - ?Ideology $ideology
     - array $branches (PartyBranch entities)
     - int $version
   - Methods (command handlers):
     - register(RegisterPartyCommand $command): self
     - rename(RenamePartyCommand $command): void
     - mergeWith(PoliticalParty $otherParty, MergeDetails $details): void
     - split(array $splitDetails): array [returns new parties]
     - addBranch(CountryCode $country, BranchDetails $details): PartyBranchId
   - Event application methods (reconstitution):
     - applyPartyRegisteredEvent(PartyRegisteredEvent $event): void
     - applyPartyRenamedEvent(PartyRenamedEvent $event): void
     - applyPartyMergedEvent(PartyMergedEvent $event): void

3. EVENTS (all immutable):
   - `PartyRegisteredEvent`
     - party_id, name, founding_country, ideology, founders
   - `PartyRenamedEvent`
     - party_id, old_name, new_name, effective_date, reason
   - `PartyMergedEvent`
     - party_id, merged_party_id, new_party_id, merger_date, terms
   - `PartySplitEvent`
     - original_party_id, new_parties_data, split_date, reason
   - `BranchAddedEvent`
     - party_id, branch_id, country_code, registration_details

4. EVENT STORE IMPLEMENTATION:
   - `PartyEventStore.php`
     - saveEvents(string $aggregateId, array $events, int $expectedVersion): void
     - loadEvents(string $aggregateId): array
     - getAggregateVersion(string $aggregateId): int
   - `PartyProjection.php`
     - Rebuild read models from events
     - Current state projection for queries

5. COMPLEX BUSINESS RULES:
   - Party can't merge with itself
   - Party can only split if it has no pending legal cases
   - Branch can't be added in unsupported country
   - Name change requires 2/3 leadership approval (simulated)

DELIVERABLES:
1. Complete event-sourced aggregate
2. Event store implementation
3. Event application logic
4. Complex business rule validation
5. Unit tests for all event scenarios

CONSTRAINTS:
- Aggregate MUST be reconstitutable from events only
- Events MUST be immutable
- Event store MUST be transactional
- MUST support optimistic concurrency control
```

### **Prompt 2.2: Party Database Schema**
```text
CREATE PLATFORM DATABASE SCHEMA FOR POLITICAL PARTIES

CONTEXT: Store parties, branches, and event history in Platform DB.

REQUIREMENTS:

1. THREE CORE TABLES:

A. `political_parties` (Current State Projection)
   - Optimized for queries, denormalized from events
   - Columns: id, uuid, code, name_en, ideology_id, founding_country_code, status
   - JSON columns: name_official, former_names, social_media, metadata
   - Indexes for search: name, code, country

B. `party_branches` (Party in specific country)
   - Links party to country with registration details
   - Columns: party_id, country_code, registration_number, status
   - Geographic: headquarters_unit_id (FK to landlord.geo_administrative_units)
   - Statistics: total_members, active_members, current_seats
   - UNIQUE: (party_id, country_code) - one branch per country

C. `party_history_events` (Event Store)
   - Append-only log of all party changes
   - Columns: event_id, aggregate_id (party_id), event_type, event_data (JSON)
   - Metadata: version, occurred_at, user_id, ip_address
   - Indexes: aggregate_id + version (for reconstitution)
   - Partition by aggregate_id for performance

2. SUPPORTING TABLES:

D. `party_coalitions`
   - Tracks coalitions between parties
   - Columns: coalition_id, name, start_date, end_date
   - Junction: `party_coalition_members` (party_id, coalition_id, joined_date, left_date)

E. `party_election_results`
   - Historical election performance
   - Columns: party_branch_id, election_date, seats_won, votes_count, percentage
   - Index: party_branch_id + election_date

3. SEEDERS:
   - `PoliticalPartiesSeeder.php`: Seed major parties
     - Nepal: NCP, UML, Maoist Centre, Nepali Congress, RSP
     - India: BJP, Congress, AAP, etc.
     - With realistic ideology assignments
   - `PartyHistorySeeder.php`: Seed historical events
     - CPN-UML + Maoist Centre = NCP (2018)
     - NCP split back to UML + Maoist (2021)

4. DATABASE CONSTRAINTS:
   - Foreign keys to landlord.countries
   - CHECK constraints for valid dates
   - Triggers for denormalized field updates
   - Full-text indexes for party name search

DELIVERABLES:
1. Complete Platform DB migrations
2. Event store table with partitioning
3. Seeders with realistic data
4. Database constraints and indexes
5. Migration rollback scripts

CONSTRAINTS:
- Platform DB is separate from Landlord DB
- MUST handle event sourcing correctly
- MUST support temporal queries
- MUST include proper audit logging
```

---

## 🏢 **PHASE 3: TENANT CONTEXT**

### **Prompt 3.1: Tenant Provisioning Service**
```text
IMPLEMENT TENANT PROVISIONING SERVICE

CONTEXT: Automatically create isolated databases for party-country instances.

REQUIREMENTS:

1. TENANT AGGREGATE: `Tenant.php`
   - Properties:
     - TenantId $id
     - PartyBranchId $partyBranchId
     - DatabaseCredentials $dbCredentials
     - Subscription $subscription
     - Quotas $quotas
     - TenantStatus $status
   - Commands:
     - provision(ProvisioningDetails $details): void
     - upgradeSubscription(SubscriptionPlan $newPlan): void
     - suspend(SuspensionReason $reason): void
     - reactivate(): void
   - Rules:
     - Can only provision if party branch is active
     - Subscription determines feature availability
     - Suspended tenants can't be accessed

2. PROVISIONING SERVICE: `TenantProvisioningService.php`
   - Steps (transactional):
     1. Validate party branch exists and is active
     2. Generate unique database name: `tenant_{party_code}_{country_code}_{random}`
     3. Create database user with random password
     4. Execute database schema from template
     5. Seed with:
        - Geography references (from landlord)
        - Taxonomy templates (from landlord)
        - Default roles and permissions
        - Party-specific configuration
     6. Record tenant in Platform DB
     7. Send credentials to party administrators

3. DATABASE TEMPLATE SYSTEM:
   - `database/templates/tenant_template.sql`
     - Base schema for all tenant databases
     - Includes: users, members, committees, forums, elections tables
     - With proper indexes and constraints
   - `TemplateDatabaseSeeder.php`
     - Seeds geography references using landlord IDs
     - Applies taxonomy templates with customization
     - Sets up default admin user

4. MULTI-DATABASE CONNECTION MANAGEMENT:
   - `TenantDatabaseManager.php`
     - Manages dynamic database connections
     - Connection pooling for performance
     - Health checks and automatic recovery
   - `TenantConnectionFactory.php`
     - Creates PDO connections on-demand
     - Caches connections for performance
     - Handles connection failures

5. SECURITY REQUIREMENTS:
   - Database user per tenant (no shared credentials)
   - Password rotation every 90 days
   - Connection encryption (TLS)
   - Audit logging of all provisioning actions
   - Rate limiting to prevent abuse

DELIVERABLES:
1. Complete Tenant aggregate with provisioning logic
2. Database template system
3. Multi-database connection management
4. Security implementation
5. Integration tests for full provisioning flow

CONSTRAINTS:
- MUST be fully transactional (rollback on any failure)
- MUST handle concurrent provisioning
- MUST be secure (no credentials in logs)
- MUST work with existing Spatie Multitenancy
```

---

## 🧪 **TESTING STRATEGY PROMPT**

### **Prompt 4.1: TDD Implementation Strategy**
```text
IMPLEMENT TEST-DRIVEN DEVELOPMENT WORKFLOW

CONTEXT: All development must follow TDD with 80%+ coverage.

REQUIREMENTS:

1. TEST PYRAMID STRUCTURE:
   ```
   Tests/
   ├── Unit/                    (70% of tests)
   │   ├── Domain/             # Pure PHP, no dependencies
   │   │   ├── Aggregates/
   │   │   ├── ValueObjects/
   │   │   └── Services/
   │   └── Application/        # Application services
   ├── Feature/                (20% of tests)
   │   ├── Geography/
   │   ├── PoliticalParty/
   │   └── Tenant/
   └── Integration/            (10% of tests)
       ├── Database/
       ├── ExternalServices/
       └── EndToEnd/
   ```

2. TDD WORKFLOW FOR EACH FEATURE:
   ```bash
   # Step 1: Write failing test
   php artisan make:test Geography/Domain/ValueObjects/CountryCodeTest --unit
   
   # Step 2: Write minimal code to pass test
   
   # Step 3: Refactor and add more tests
   
   # Step 4: Repeat until feature complete
   ```

3. TEST DATA FACTORIES:
   - `GeographyFactory.php`: Create Country, AdministrativeUnit for tests
   - `PoliticalPartyFactory.php`: Create Party, Branch, Events
   - `TenantFactory.php`: Create Tenant with subscriptions
   - All factories must create valid entities

4. DATABASE TESTING STRATEGY:
   - Unit tests: No database access
   - Feature tests: Use DatabaseTransactions trait
   - Integration tests: Separate test database
   - Performance tests: Large dataset simulations

5. COVERAGE REQUIREMENTS:
   - 80% minimum line coverage
   - 90% branch coverage for critical paths
   - Mutation testing with Infection PHP
   - Continuous integration with coverage reports

6. TEST SCENARIOS (CRITICAL PATH):
   - Nepal geography hierarchy (7→77→753→6743)
   - Party merger: CPN-UML + Maoist = NCP
   - Party split: NCP → UML + Maoist
   - Tenant provisioning: NCP Nepal branch
   - Multi-country party: NCP Nepal + NCP India diaspora

DELIVERABLES:
1. Complete test suite structure
2. Test data factories
3. PHPUnit configuration with coverage
4. CI/CD pipeline configuration
5. Performance test scenarios

CONSTRAINTS:
- NO production data in tests
- Tests must be independent and repeatable
- Must run in <5 minutes locally
- Must support parallel test execution
```

---

## 🚀 **DEPLOYMENT & SCALING PROMPT**

### **Prompt 5.1: Production Deployment Strategy**
```text
IMPLEMENT PRODUCTION-READY DEPLOYMENT

CONTEXT: Platform must scale to support 100+ countries, 10,000+ tenants.

REQUIREMENTS:

1. DOCKER COMPOSE FOR PRODUCTION:
   ```yaml
   version: '3.8'
   services:
     # Database Tier
     db-landlord:
       image: mysql:8.0
       command: --default-authentication-plugin=mysql_native_password
       environment:
         MYSQL_DATABASE: landlord_global_reference
         MYSQL_ROOT_PASSWORD: ${DB_LANDLORD_ROOT_PASSWORD}
       volumes:
         - landlord-data:/var/lib/mysql
         - ./database/landlord/init:/docker-entrypoint-initdb.d
       networks:
         - internal
       
     db-platform:
       image: mysql:8.0
       environment:
         MYSQL_DATABASE: platform_operational
       volumes:
         - platform-data:/var/lib/mysql
       networks:
         - internal
       
     # Tenant Databases (Managed by orchestration)
     db-tenant-pool:
       image: mysql:8.0
       deploy:
         replicas: 3
       volumes:
         - tenant-data:/var/lib/mysql
       networks:
         - internal
       
     # Application Tier
     app:
       build: .
       environment:
         APP_ENV: production
         DB_CONNECTION_LANDLORD: landlord
         DB_CONNECTION_PLATFORM: platform
       depends_on:
         - db-landlord
         - db-platform
         - redis
         - meilisearch
       networks:
         - internal
         - web
       
     # Caching & Search Tier
     redis:
       image: redis:7-alpine
       command: redis-server --requirepass ${REDIS_PASSWORD}
       volumes:
         - redis-data:/data
       networks:
         - internal
       
     meilisearch:
       image: getmeili/meilisearch:v1.5
       environment:
         MEILI_MASTER_KEY: ${MEILISEARCH_MASTER_KEY}
       volumes:
         - meilisearch-data:/meili_data
       networks:
         - internal
   ```

2. DATABASE SHARDING STRATEGY:
   - Landlord DB: Single instance (small, read-heavy)
   - Platform DB: Read replicas for reporting
   - Tenant DBs: Sharded by country code
     - Shard 1: NP, IN, BD (South Asia)
     - Shard 2: US, CA, MX (North America)
     - Shard 3: DE, FR, GB (Europe)
   - Connection routing via middleware

3. CACHING STRATEGY:
   - Redis for:
     - Geography data (24h TTL)
     - Party information (12h TTL)
     - Tenant connection pooling
     - Session storage
   - CDN for:
     - GeoJSON boundaries