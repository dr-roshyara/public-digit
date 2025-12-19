# 🌍 GLOBAL POLITICAL PARTY PLATFORM
## **Final Implementation Plan & Claude Prompts**
### **Senior Solution Architect + 15 Years Backend Development**

**Document Version:** 2.0.0
**Date:** 2025-12-17 18:00
**Status:** 🟡 READY FOR USER REVIEW
**Approach:** Nepal-First, World-Ready, Configuration-Driven

---

## 📊 EXECUTIVE SUMMARY

After analyzing 5 architectural documents, I've synthesized a **pragmatic, actionable implementation plan** that:

1. ✅ **Builds for Nepal TODAY** - Complete, working system
2. ✅ **Scales to World TOMORROW** - Via configuration, not rewriting
3. ✅ **Follows Strict DDD + TDD** - 80%+ coverage, domain-first
4. ✅ **Maximizes Solo Developer Leverage** - Smart architecture reduces future work
5. ✅ **Production-Ready from Day 1** - Security, performance, monitoring

**Core Philosophy:**
> "Nepal is a CONFIGURATION of a global system, not a HARDCODED special case. Every line of code must answer: 'Will this work for India without changes?'"

---

## 🎯 CRITICAL ARCHITECTURAL DECISIONS (FINALIZED)

| # | Decision Point | Choice | Rationale |
|---|----------------|--------|-----------|
| **1** | **Tenancy Model** | Party-Country Instance | `tenant_ncp_np`, `tenant_bjp_in` - most flexible |
| **2** | **Database Strategy** | 3-Tier (Landlord → Platform → Tenants) | Clean separation of concerns |
| **3** | **Geography Storage** | Polymorphic Table | Single `geo_administrative_units` for ALL countries |
| **4** | **Party History** | Event Sourcing | Immutable audit trail for mergers/splits |
| **5** | **Country-Specific Code** | Prefixed Classes | `NP_Province.php`, `IN_State.php` |
| **6** | **Validation** | Configuration + Taxonomy Tables | NO hardcoded ENUMs |
| **7** | **Multilingual** | JSON Columns | `name_local: {"en":"...", "np":"...", "hi":"..."}` |
| **8** | **Testing** | TDD-First | Write tests BEFORE implementation |

---

## 🗂️ 3-TIER DATABASE ARCHITECTURE (FINAL)

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: LANDLORD DATABASE (landlord_global_reference)          │
│ Purpose: Immutable global reference data                        │
├─────────────────────────────────────────────────────────────────┤
│ CONNECTION: 'landlord'                                          │
│                                                                  │
│ Tables:                                                          │
│ • countries (196 countries, ISO 3166-1)                         │
│ • country_geography_configs (hierarchy definitions per country) │
│ • geo_administrative_units (POLYMORPHIC - all countries)        │
│   ├─ NP: 7 provinces, 77 districts, 753 local levels, 6,743 wards│
│   ├─ IN: 28 states, 766 districts, etc. (FUTURE)               │
│   └─ US: 50 states, 3,143 counties, etc. (FUTURE)              │
│ • global_political_ideologies (taxonomy, not ENUM)              │
│ • global_electoral_systems (FPTP, PR, MMP, etc.)                │
│ • global_skills (legal, medical, technical, etc.)               │
│ • global_id_types (citizenship, passport, Aadhaar, SSN)         │
│ • global_skill_categories (replaces skill ENUM)                 │
│                                                                  │
│ Characteristics:                                                 │
│ - Read-heavy (99.9% reads)                                      │
│ - Small dataset (~500MB for all countries)                      │
│ - Cached in Redis (24h TTL)                                     │
│ - NO tenant-specific data                                       │
│ - Updated by platform admins only                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TIER 2: PLATFORM DATABASE (platform_operational)                │
│ Purpose: Cross-tenant operational data                          │
├─────────────────────────────────────────────────────────────────┤
│ CONNECTION: 'platform'                                           │
│                                                                  │
│ Tables:                                                          │
│ • political_parties (global party registry)                     │
│ • party_branches (party in specific country)                    │
│ • party_history_events (event sourcing - append only)           │
│ • party_coalitions (multi-party alliances)                      │
│ • tenants (party-country instances)                             │
│ • tenant_subscriptions (billing, quotas)                        │
│ • platform_users (cross-platform user accounts)                 │
│ • platform_admins (super administrators)                        │
│ • platform_audit_logs (IMMUTABLE audit trail)                   │
│ • platform_settings (global configuration)                      │
│ • platform_api_keys (integrations)                              │
│                                                                  │
│ Characteristics:                                                 │
│ - Moderate size (~10-50GB)                                      │
│ - Read replicas for reporting                                   │
│ - Event sourcing for party history                              │
│ - Shared by all tenants (no isolation needed)                   │
│ - Business logic in Application layer                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TIER 3: TENANT DATABASES (per party-country)                    │
│ Purpose: Party-specific operational data (100% isolated)        │
├─────────────────────────────────────────────────────────────────┤
│ CONNECTION: Dynamic (e.g., 'tenant_ncp_np')                     │
│                                                                  │
│ Example: tenant_ncp_np (Nepal Communist Party - Nepal)          │
│ Tables:                                                          │
│ • members (party members with eKYC)                             │
│ • committees (organizational structure)                         │
│ • committee_members (member assignments)                        │
│ • elections (internal party elections)                          │
│ • candidates (election candidates)                              │
│ • votes (election votes - one per member per election)          │
│ • forums (discussions)                                           │
│ • forum_posts, forum_replies                                     │
│ • events (rallies, meetings)                                     │
│ • event_attendees                                                │
│ • finance_donations, finance_expenses                            │
│ • membership_types (active, general, youth, etc.)               │
│ • roles, permissions, role_user                                  │
│                                                                  │
│ Geography References:                                            │
│ - members.province_id → landlord.geo_administrative_units.id    │
│ - members.district_id → landlord.geo_administrative_units.id    │
│ - members.ward_id → landlord.geo_administrative_units.id        │
│                                                                  │
│ Characteristics:                                                 │
│ - Fully isolated per tenant                                     │
│ - Can grow large (10M+ members for major parties)               │
│ - Sharded by country for performance                            │
│ - References landlord geography by ID                           │
│ - Spatie Multitenancy manages connections                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 DDD FOLDER STRUCTURE (FINAL)

```
app/Contexts/
├── Geography/                                    # 🗺️ Bounded Context 1
│   ├── Domain/
│   │   ├── Aggregates/
│   │   │   ├── Country.php                      # Aggregate Root
│   │   │   └── AdministrativeUnit.php           # Entity (polymorphic)
│   │   ├── ValueObjects/
│   │   │   ├── CountryCode.php                  # ISO 3166-1 (NP, IN, US)
│   │   │   ├── GeographicCoordinate.php         # Lat/Long with validation
│   │   │   ├── AdministrativeLevel.php          # Level 1, 2, 3... (not "province")
│   │   │   ├── GeoCode.php                      # Country-specific codes
│   │   │   └── LocalizedName.php                # Multilingual names (JSON)
│   │   ├── Events/
│   │   │   ├── CountryAdded.php
│   │   │   ├── GeographyUpdated.php
│   │   │   └── AdministrativeUnitCreated.php
│   │   ├── Repositories/
│   │   │   ├── CountryRepositoryInterface.php
│   │   │   └── GeographyRepositoryInterface.php
│   │   ├── Specifications/
│   │   │   ├── ActiveCountrySpecification.php
│   │   │   └── SupportedCountrySpecification.php
│   │   ├── Services/
│   │   │   └── GeographyValidationService.php   # Domain service
│   │   └── Exceptions/
│   │       ├── InvalidCountryCodeException.php
│   │       ├── InvalidHierarchyException.php
│   │       └── GeographyNotFoundException.php
│   ├── Application/
│   │   ├── Commands/
│   │   │   ├── AddCountryCommand.php
│   │   │   ├── UpdateGeographyCommand.php
│   │   │   └── ImportGeographyDataCommand.php
│   │   ├── Handlers/
│   │   │   ├── AddCountryHandler.php
│   │   │   ├── UpdateGeographyHandler.php
│   │   │   └── ImportGeographyDataHandler.php
│   │   ├── Services/
│   │   │   ├── GeographyService.php             # Application service
│   │   │   ├── CountryManagementService.php
│   │   │   └── SpatialQueryService.php          # GIS queries
│   │   ├── Queries/
│   │   │   ├── GetCountryHierarchyQuery.php
│   │   │   ├── FindAdministrativeUnitsQuery.php
│   │   │   └── GetAncestorsQuery.php
│   │   └── DTOs/
│   │       ├── CountryData.php
│   │       └── GeographyHierarchyData.php
│   ├── Infrastructure/
│   │   ├── Database/
│   │   │   ├── Migrations/
│   │   │   │   ├── 2025_01_01_000001_create_countries_table.php
│   │   │   │   ├── 2025_01_01_000002_create_country_geography_configs_table.php
│   │   │   │   └── 2025_01_01_000003_create_geo_administrative_units_table.php
│   │   │   ├── Seeders/
│   │   │   │   ├── CountriesSeeder.php          # All 196 countries
│   │   │   │   ├── NepalGeographySeeder.php     # 7→77→753→6,743
│   │   │   │   └── IndiaGeographySeeder.php     # STUB for future
│   │   │   ├── Models/
│   │   │   │   ├── Country.php                  # Eloquent
│   │   │   │   ├── CountryGeographyConfig.php
│   │   │   │   └── GeoAdministrativeUnit.php
│   │   │   └── Factories/
│   │   │       ├── CountryFactory.php           # Test data
│   │   │       └── GeoAdministrativeUnitFactory.php
│   │   ├── Repositories/
│   │   │   ├── EloquentCountryRepository.php
│   │   │   └── CachedGeographyRepository.php    # Redis caching
│   │   ├── Cache/
│   │   │   └── GeographyCacheManager.php
│   │   └── Http/
│   │       └── Controllers/
│   │           ├── CountryController.php
│   │           └── GeographyController.php
│   └── Tests/
│       ├── Unit/
│       │   ├── Domain/
│       │   │   ├── Aggregates/
│       │   │   │   ├── CountryTest.php
│       │   │   │   └── AdministrativeUnitTest.php
│       │   │   └── ValueObjects/
│       │   │       ├── CountryCodeTest.php
│       │   │       ├── GeographicCoordinateTest.php
│       │   │       └── AdministrativeLevelTest.php
│       │   └── Application/
│       │       └── Services/
│       │           └── GeographyServiceTest.php
│       ├── Feature/
│       │   ├── CountryManagementTest.php
│       │   └── GeographyQueryTest.php
│       └── Integration/
│           ├── GeographyRepositoryTest.php
│           └── SpatialQueryTest.php

├── PoliticalParty/                               # 🏛️ Bounded Context 2
│   ├── Domain/
│   │   ├── Aggregates/
│   │   │   ├── PoliticalParty.php               # Aggregate Root (Event Sourced)
│   │   │   └── PartyBranch.php                  # Entity (party in country)
│   │   ├── ValueObjects/
│   │   │   ├── PartyIdentifier.php              # UUID
│   │   │   ├── PartyName.php                    # Multilingual
│   │   │   ├── Ideology.php                     # Reference to taxonomy
│   │   │   └── PartyCode.php                    # NCP, BJP, LABOUR_UK
│   │   ├── Events/                              # Event Sourcing
│   │   │   ├── PartyFoundedEvent.php
│   │   │   ├── PartyRegisteredEvent.php
│   │   │   ├── PartyRenamedEvent.php
│   │   │   ├── PartyMergedEvent.php             # Complex: CPN-UML + Maoist = NCP
│   │   │   ├── PartySplitEvent.php              # Complex: NCP → UML + Maoist
│   │   │   ├── BranchAddedEvent.php
│   │   │   └── BranchRegisteredEvent.php
│   │   ├── Repositories/
│   │   │   ├── PoliticalPartyRepositoryInterface.php
│   │   │   └── PartyEventStoreInterface.php
│   │   ├── Specifications/
│   │   │   ├── ActivePartySpecification.php
│   │   │   └── MergeablePartySpecification.php
│   │   ├── Services/
│   │   │   └── PartyHistoryService.php          # Domain service
│   │   └── Exceptions/
│   │       ├── PartyNotFoundException.php
│   │       ├── InvalidMergerException.php
│   │       └── InvalidSplitException.php
│   ├── Application/
│   │   ├── Commands/
│   │   │   ├── RegisterPartyCommand.php
│   │   │   ├── MergePartiesCommand.php
│   │   │   ├── SplitPartyCommand.php
│   │   │   ├── RenamePartyCommand.php
│   │   │   └── AddBranchCommand.php
│   │   ├── Handlers/
│   │   │   ├── RegisterPartyHandler.php
│   │   │   ├── MergePartiesHandler.php
│   │   │   ├── SplitPartyHandler.php
│   │   │   ├── RenamePartyHandler.php
│   │   │   └── AddBranchHandler.php
│   │   ├── Services/
│   │   │   ├── PartyManagementService.php
│   │   │   └── PartyQueryService.php
│   │   ├── Queries/
│   │   │   ├── GetPartyHistoryQuery.php
│   │   │   ├── GetPartyBranchesQuery.php
│   │   │   └── SearchPartiesQuery.php
│   │   └── DTOs/
│   │       ├── PartyData.php
│   │       └── BranchData.php
│   ├── Infrastructure/
│   │   ├── Database/
│   │   │   ├── Migrations/
│   │   │   │   ├── 2025_01_02_000001_create_political_parties_table.php
│   │   │   │   ├── 2025_01_02_000002_create_party_branches_table.php
│   │   │   │   ├── 2025_01_02_000003_create_party_history_events_table.php
│   │   │   │   └── 2025_01_02_000004_create_party_coalitions_table.php
│   │   │   ├── Seeders/
│   │   │   │   ├── PoliticalPartiesSeeder.php   # Nepal: NCP, UML, Congress
│   │   │   │   └── PartyHistorySeeder.php       # UML+Maoist=NCP→split
│   │   │   ├── Models/
│   │   │   │   ├── PoliticalParty.php           # Eloquent (projection)
│   │   │   │   ├── PartyBranch.php
│   │   │   │   └── PartyHistoryEvent.php        # Event store
│   │   │   └── EventStore/
│   │   │       ├── PartyEventStore.php          # Event sourcing implementation
│   │   │       └── PartyProjection.php          # Read model builder
│   │   ├── Repositories/
│   │   │   ├── EloquentPoliticalPartyRepository.php
│   │   │   └── EventSourcedPartyRepository.php
│   │   └── Http/
│   │       └── Controllers/
│   │           ├── PartyController.php
│   │           └── PartyHistoryController.php
│   └── Tests/
│       ├── Unit/
│       │   └── Domain/
│       │       ├── Aggregates/
│       │       │   ├── PoliticalPartyTest.php
│       │       │   └── PartyMergerTest.php      # Complex scenario
│       │       └── Events/
│       │           └── EventApplicationTest.php
│       ├── Feature/
│       │   ├── PartyRegistrationTest.php
│       │   ├── PartyMergerTest.php              # CPN-UML + Maoist = NCP
│       │   └── PartySplitTest.php               # NCP → UML + Maoist
│       └── Integration/
│           ├── PartyEventStoreTest.php
│           └── PartyRepositoryTest.php

├── Tenant/                                       # 🏢 Bounded Context 3
│   ├── Domain/
│   │   ├── Aggregates/
│   │   │   ├── Tenant.php                       # Aggregate Root
│   │   │   └── TenantSubscription.php           # Entity
│   │   ├── ValueObjects/
│   │   │   ├── TenantIdentifier.php
│   │   │   ├── TenantCode.php                   # tenant_ncp_np
│   │   │   ├── DatabaseCredentials.php
│   │   │   ├── SubscriptionPlan.php
│   │   │   └── TenantQuotas.php
│   │   ├── Events/
│   │   │   ├── TenantProvisionedEvent.php
│   │   │   ├── TenantActivatedEvent.php
│   │   │   ├── TenantSuspendedEvent.php
│   │   │   └── TenantUpgradedEvent.php
│   │   ├── Repositories/
│   │   │   └── TenantRepositoryInterface.php
│   │   ├── Services/
│   │   │   └── TenantValidationService.php
│   │   └── Exceptions/
│   │       ├── TenantNotFoundException.php
│   │       ├── ProvisioningFailedException.php
│   │       └── QuotaExceededException.php
│   ├── Application/
│   │   ├── Commands/
│   │   │   ├── ProvisionTenantCommand.php
│   │   │   ├── ActivateTenantCommand.php
│   │   │   ├── SuspendTenantCommand.php
│   │   │   └── UpgradeTenantCommand.php
│   │   ├── Handlers/
│   │   │   ├── ProvisionTenantHandler.php
│   │   │   ├── ActivateTenantHandler.php
│   │   │   ├── SuspendTenantHandler.php
│   │   │   └── UpgradeTenantHandler.php
│   │   ├── Services/
│   │   │   ├── TenantProvisioningService.php    # Core provisioning logic
│   │   │   ├── DatabaseManagementService.php    # DB creation/seeding
│   │   │   └── SubscriptionManagementService.php
│   │   ├── Queries/
│   │   │   ├── GetTenantStatusQuery.php
│   │   │   └── GetTenantUsageQuery.php
│   │   └── DTOs/
│   │       ├── TenantData.php
│   │       └── ProvisioningRequest.php
│   ├── Infrastructure/
│   │   ├── Database/
│   │   │   ├── Migrations/
│   │   │   │   ├── 2025_01_03_000001_create_tenants_table.php
│   │   │   │   └── 2025_01_03_000002_create_tenant_subscriptions_table.php
│   │   │   ├── Templates/
│   │   │   │   └── tenant_template.sql          # Base tenant schema
│   │   │   ├── Seeders/
│   │   │   │   └── TemplateDatabaseSeeder.php
│   │   │   ├── Models/
│   │   │   │   ├── Tenant.php
│   │   │   │   └── TenantSubscription.php
│   │   │   └── Managers/
│   │   │       ├── TenantDatabaseManager.php    # Multi-DB connections
│   │   │       ├── TenantConnectionFactory.php
│   │   │       └── TenantConnectionPool.php
│   │   ├── Repositories/
│   │   │   └── EloquentTenantRepository.php
│   │   └── Http/
│   │       └── Controllers/
│   │           ├── TenantController.php
│   │           └── TenantAdminController.php
│   └── Tests/
│       ├── Unit/
│       │   └── Domain/
│       │       ├── Aggregates/
│       │       │   └── TenantTest.php
│       │       └── ValueObjects/
│       │           ├── TenantCodeTest.php
│       │           └── DatabaseCredentialsTest.php
│       ├── Feature/
│       │   ├── TenantProvisioningTest.php       # End-to-end provisioning
│       │   └── TenantSubscriptionTest.php
│       └── Integration/
│           ├── TenantDatabaseTest.php           # Multi-DB connections
│           └── TenantIsolationTest.php          # Security tests

└── Shared/                                       # 🔧 Shared Kernel
    ├── Domain/
    │   ├── ValueObjects/
    │   │   ├── Uuid.php
    │   │   ├── Email.php
    │   │   ├── PhoneNumber.php
    │   │   └── Money.php
    │   └── Events/
    │       └── DomainEvent.php
    ├── Infrastructure/
    │   ├── EventBus/
    │   │   └── LaravelEventBus.php
    │   ├── Cache/
    │   │   └── RedisCacheManager.php
    │   └── Database/
    │       └── UuidGenerator.php
    └── Tests/
        └── Unit/
            └── ValueObjects/
                └── UuidTest.php

config/
├── geography.php                                 # 🗺️ Geography configuration
├── countries/
│   ├── np.php                                    # Nepal-specific config
│   ├── in.php                                    # India config (stub)
│   └── us.php                                    # USA config (stub)
├── platform.php                                  # Platform settings
├── database.php                                  # Multi-DB configuration
└── cache.php                                     # Redis configuration

database/
├── landlord/
│   ├── migrations/                               # Landlord DB migrations
│   └── seeders/                                  # Geography, taxonomies
├── platform/
│   ├── migrations/                               # Platform DB migrations
│   └── seeders/                                  # Parties, tenants
└── tenant_template/
    ├── migrations/                               # Tenant DB template
    └── seeders/                                  # Default data for tenants
```

---

## 🚀 IMPLEMENTATION PHASES (12 WEEKS)

### **PHASE 0: Foundation & Setup** (Week 1)

**Objective:** Set up DDD structure, TDD environment, Docker, multi-database connections

**Deliverables:**
1. ✅ Complete DDD folder structure (empty files with namespaces)
2. ✅ PHPUnit configuration with coverage requirement (80%+)
3. ✅ Docker Compose with 3 MySQL instances + Redis + Meilisearch
4. ✅ Multi-database configuration in Laravel
5. ✅ Service provider structure
6. ✅ Base test classes and factories

**Acceptance Criteria:**
- [ ] Directory structure created
- [ ] Docker containers running
- [ ] Can connect to all 3 databases
- [ ] PHPUnit runs with coverage report
- [ ] Base test passes

---

### **PHASE 1: Geography Context** (Week 2-3)

**Objective:** Implement country-agnostic geography system with Nepal data

**Week 2: Domain + Infrastructure**
- TDD: Country aggregate, value objects
- Polymorphic geography table migration
- Repository with caching

**Week 3: Data + Services**
- Seed all 196 countries
- Seed Nepal geography (7→77→753→6,743)
- Spatial query service
- Integration tests

**Deliverables:**
1. ✅ Country aggregate with full DDD layers
2. ✅ Polymorphic `geo_administrative_units` table
3. ✅ Nepal geography seeded
4. ✅ Empty stubs for India (`IN/` folder with TODO)
5. ✅ Configuration file: `config/countries/np.php`
6. ✅ 80+ unit tests for geography domain
7. ✅ Spatial query service (GIS)

**Acceptance Criteria:**
- [ ] Can query Nepal's full hierarchy (province → ward)
- [ ] Geography queries cached in Redis
- [ ] Tests pass: `php artisan test --testsuite=Geography`
- [ ] Code coverage >= 80%
- [ ] Config-driven validation works

---

### **PHASE 2: Taxonomy System** (Week 4)

**Objective:** Replace all ENUMs with taxonomy tables

**Deliverables:**
1. ✅ `global_political_ideologies` table
2. ✅ `global_electoral_systems` table
3. ✅ `global_skills` + `global_skill_categories` tables
4. ✅ `global_id_types` table (country-aware)
5. ✅ Seed data for common taxonomies
6. ✅ Validation service using taxonomies
7. ✅ Empty India-specific taxonomies (Aadhaar, Hindutva ideology)

**Acceptance Criteria:**
- [ ] NO ENUMs in schema
- [ ] All taxonomies support country scope
- [ ] Multilingual names via JSON
- [ ] Validation works for Nepal
- [ ] Ready to add India taxonomies without schema changes

---

### **PHASE 3: Political Party Context** (Week 5-6)

**Objective:** Event-sourced party aggregate with Nepal party history

**Week 5: Event Sourcing**
- Party aggregate with event sourcing
- Event store implementation
- Complex business rules (merge, split)

**Week 6: Data + History**
- Seed Nepal parties (NCP, UML, Congress, Maoist)
- Seed party history events (UML+Maoist=NCP→split)
- Party query service

**Deliverables:**
1. ✅ Event-sourced `PoliticalParty` aggregate
2. ✅ `PartyBranch` entity (party in country)
3. ✅ Event store with append-only history
4. ✅ Party history seeder (Nepal's mergers/splits)
5. ✅ Tests for complex scenarios (merger, split)
6. ✅ 60+ tests for party lifecycle

**Acceptance Criteria:**
- [ ] Can recreate party state from events
- [ ] UML+Maoist merger correctly recorded
- [ ] NCP split correctly recorded
- [ ] Event sourcing tests pass
- [ ] Ready for Indian parties without changes

---

### **PHASE 4: Tenant Context** (Week 7-8)

**Objective:** Automated tenant provisioning with isolated databases

**Week 7: Tenant Domain + Infrastructure**
- Tenant aggregate
- Multi-database connection management
- Database template system

**Week 8: Provisioning Service**
- Automated DB creation
- Geography reference seeding
- Tenant provisioning tests

**Deliverables:**
1. ✅ Tenant aggregate with provisioning logic
2. ✅ `TenantDatabaseManager` for multi-DB
3. ✅ Tenant database template SQL
4. ✅ Automated provisioning service
5. ✅ Geography seeding for tenants
6. ✅ 40+ tests for provisioning flow

**Acceptance Criteria:**
- [ ] Can provision tenant for NCP Nepal
- [ ] Tenant DB isolated from other tenants
- [ ] Geography references work
- [ ] Provisioning is transactional (rollback on failure)
- [ ] Tests verify isolation

---

### **PHASE 5: Admin Dashboard** (Week 9)

**Objective:** Platform admin UI (Vue 3 + Inertia.js)

**Deliverables:**
1. ✅ Country management UI
2. ✅ Party registry UI
3. ✅ Tenant provisioning UI
4. ✅ Audit log viewer
5. ✅ Geography browser

---

### **PHASE 6: API Layer** (Week 10)

**Objective:** RESTful APIs for mobile/external access

**Deliverables:**
1. ✅ Geography API endpoints
2. ✅ Party API endpoints
3. ✅ Tenant API endpoints
4. ✅ OpenAPI (Swagger) documentation
5. ✅ Rate limiting and authentication

---

### **PHASE 7: Performance & Caching** (Week 11)

**Objective:** Optimize for production scale

**Deliverables:**
1. ✅ Redis caching for geography (24h TTL)
2. ✅ Query optimization (indexes, partitioning)
3. ✅ Database read replicas
4. ✅ CDN for GeoJSON boundaries
5. ✅ Performance tests (1M+ members)

---

### **PHASE 8: Security Hardening** (Week 12)

**Objective:** Production security audit

**Deliverables:**
1. ✅ SQL injection prevention audit
2. ✅ XSS/CSRF protection audit
3. ✅ Tenant isolation verification tests
4. ✅ Encryption at rest and in transit
5. ✅ Security headers and CSP
6. ✅ Penetration testing

---

## 📝 CLAUDE CLI PROMPT TEMPLATES

### **🔧 SETUP PROMPT (Phase 0)**

```text
SETUP DDD ARCHITECTURE FOUNDATION FOR GLOBAL POLITICAL PARTY PLATFORM

CONTEXT:
I'm building a global political party digitalization platform using:
- Laravel 12 + DDD + TDD + Event Sourcing
- 3-tier database architecture (Landlord → Platform → Tenants)
- Starting with Nepal, expanding to India and 100+ countries
- Must be configuration-driven, NOT hardcoded

CRITICAL REQUIREMENTS:
1. Create complete DDD folder structure (see "DDD FOLDER STRUCTURE" section)
2. Configure 3 separate MySQL databases:
   - landlord_global_reference (geography, taxonomies)
   - platform_operational (parties, tenants, users)
   - tenant_{code}_{country} (party-specific data - dynamic)
3. Setup PHPUnit with 80% coverage requirement
4. Create Docker Compose for local development
5. Setup service providers for each bounded context

DELIVERABLES:
1. app/Contexts/ directory structure with namespaces
2. docker-compose.yml with 3 MySQL instances + Redis + Meilisearch
3. config/database.php with multi-database configuration
4. phpunit.xml with coverage settings
5. Service providers: GeographyServiceProvider, PoliticalPartyServiceProvider, TenantServiceProvider
6. .env.example with all required variables

CONSTRAINTS:
- MUST NOT break existing app/Contexts/Platform/ code
- MUST work with Spatie Multitenancy package
- MUST use PHP 8.2+ features (readonly properties, enums where appropriate)
- MUST include proper PSR-4 namespacing

ACCEPTANCE CRITERIA:
1. ✅ Directory structure matches plan exactly
2. ✅ Docker containers start: docker-compose up -d
3. ✅ All 3 databases accessible
4. ✅ PHPUnit runs: php artisan test
5. ✅ Coverage report generates: php artisan test --coverage

START WITH:
1. Create the DDD folder structure
2. Create docker-compose.yml
3. Update config/database.php
4. Create service providers
5. Update composer.json autoload if needed

OUTPUT:
Provide complete file contents for docker-compose.yml, config/database.php,
and service provider files. Create empty placeholder files for all DDD classes.
```

---

### **🗺️ GEOGRAPHY PROMPT (Phase 1, Week 2)**

```text
IMPLEMENT GEOGRAPHY CONTEXT - DOMAIN LAYER (TDD FIRST)

CONTEXT:
Building a country-agnostic geography system. Starting with Nepal but MUST work
for India and all countries via configuration.

CRITICAL DESIGN PRINCIPLE:
"Nepal is a CONFIGURATION of a global system, not a HARDCODED special case."

REQUIREMENTS (TDD APPROACH):

STEP 1: WRITE TESTS FIRST
Create these test files with FAILING tests:
1. tests/Unit/Geography/Domain/ValueObjects/CountryCodeTest.php
   - Test valid ISO codes: NP, IN, US, GB
   - Test invalid codes: XX, Nepal, 123
   - Test case sensitivity: np → NP
   - Test equality comparison

2. tests/Unit/Geography/Domain/ValueObjects/GeographicCoordinateTest.php
   - Test valid coordinates: Kathmandu (27.7172, 85.3240)
   - Test invalid: latitude > 90, longitude > 180
   - Test boundary values: -90, 90, -180, 180

3. tests/Unit/Geography/Domain/ValueObjects/AdministrativeLevelTest.php
   - Test levels 1-6 (Nepal: 1-4, India: 1-6)
   - Test invalid levels: 0, negative, > 10
   - Test level names from configuration

4. tests/Unit/Geography/Domain/Aggregates/CountryTest.php
   - Test country creation with valid data
   - Test country code immutability (can't change after creation)
   - Test name updates
   - Test activate/deactivate
   - Test geography config updates

STEP 2: IMPLEMENT VALUE OBJECTS

A. CountryCode (app/Contexts/Geography/Domain/ValueObjects/CountryCode.php)
```php
<?php

namespace App\Contexts\Geography\Domain\ValueObjects;

use App\Contexts\Geography\Domain\Exceptions\InvalidCountryCodeException;

final readonly class CountryCode
{
    private string $value;

    private function __construct(string $value)
    {
        $this->value = $value;
    }

    public static function fromString(string $code): self
    {
        $code = strtoupper(trim($code));

        if (!preg_match('/^[A-Z]{2}$/', $code)) {
            throw new InvalidCountryCodeException(
                "Invalid country code: {$code}. Must be 2 uppercase letters (ISO 3166-1)."
            );
        }

        // Validate against ISO 3166-1 alpha-2 list
        $validCodes = self::getValidIsoCodes();
        if (!in_array($code, $validCodes)) {
            throw new InvalidCountryCodeException(
                "Unknown country code: {$code}. Not in ISO 3166-1 alpha-2 standard."
            );
        }

        return new self($code);
    }

    public function value(): string
    {
        return $this->value;
    }

    public function equals(CountryCode $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }

    private static function getValidIsoCodes(): array
    {
        return [
            'NP', 'IN', 'US', 'GB', 'CN', 'JP', 'BD', 'PK', 'LK', 'BT',
            // ... all 196 ISO codes
            // Load from config or database in production
        ];
    }
}
```

B. GeographicCoordinate
```php
<?php

namespace App\Contexts\Geography\Domain\ValueObjects;

use App\Contexts\Geography\Domain\Exceptions\InvalidCoordinateException;

final readonly class GeographicCoordinate
{
    private float $latitude;
    private float $longitude;

    private function __construct(float $latitude, float $longitude)
    {
        $this->latitude = $latitude;
        $this->longitude = $longitude;
    }

    public static function fromLatLng(float $latitude, float $longitude): self
    {
        if ($latitude < -90 || $latitude > 90) {
            throw new InvalidCoordinateException(
                "Invalid latitude: {$latitude}. Must be between -90 and 90."
            );
        }

        if ($longitude < -180 || $longitude > 180) {
            throw new InvalidCoordinateException(
                "Invalid longitude: {$longitude}. Must be between -180 and 180."
            );
        }

        return new self($latitude, $longitude);
    }

    public function latitude(): float
    {
        return $this->latitude;
    }

    public function longitude(): float
    {
        return $this->longitude;
    }

    public function distanceTo(GeographicCoordinate $other): float
    {
        // Haversine formula for distance calculation
        // Returns distance in kilometers
        // Implementation here...
    }

    public function toArray(): array
    {
        return [
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
        ];
    }
}
```

C. AdministrativeLevel
```php
<?php

namespace App\Contexts\Geography\Domain\ValueObjects;

final readonly class AdministrativeLevel
{
    private int $level;
    private string $countryCode;

    private function __construct(int $level, string $countryCode)
    {
        $this->level = $level;
        $this->countryCode = $countryCode;
    }

    public static function fromInt(int $level, string $countryCode): self
    {
        if ($level < 1 || $level > 10) {
            throw new \InvalidArgumentException(
                "Administrative level must be between 1 and 10, got: {$level}"
            );
        }

        return new self($level, $countryCode);
    }

    public function level(): int
    {
        return $this->level;
    }

    public function name(): string
    {
        // Load from config: countries.{$countryCode}.admin_levels.{$this->level}.name
        $config = config("countries.{$this->countryCode}.admin_levels");
        return $config[$this->level]['name'] ?? "Level {$this->level}";
    }

    public function parentLevel(): ?self
    {
        if ($this->level === 1) {
            return null; // Top level has no parent
        }

        return new self($this->level - 1, $this->countryCode);
    }
}
```

STEP 3: IMPLEMENT COUNTRY AGGREGATE

app/Contexts/Geography/Domain/Aggregates/Country.php
```php
<?php

namespace App\Contexts\Geography\Domain\Aggregates;

use App\Contexts\Geography\Domain\ValueObjects\CountryCode;
use App\Contexts\Geography\Domain\Events\CountryAdded;

final class Country
{
    private CountryCode $code;
    private string $nameEn;
    private array $nameLocal;
    private array $geoConfig;
    private bool $isActive;
    private array $recordedEvents = [];

    private function __construct(
        CountryCode $code,
        string $nameEn,
        array $nameLocal,
        array $geoConfig
    ) {
        $this->code = $code;
        $this->nameEn = $nameEn;
        $this->nameLocal = $nameLocal;
        $this->geoConfig = $geoConfig;
        $this->isActive = true;

        $this->recordEvent(new CountryAdded($code, $nameEn));
    }

    public static function create(
        CountryCode $code,
        string $nameEn,
        array $nameLocal,
        array $geoConfig
    ): self {
        return new self($code, $nameEn, $nameLocal, $geoConfig);
    }

    public function updateNames(string $nameEn, array $nameLocal): void
    {
        $this->nameEn = $nameEn;
        $this->nameLocal = $nameLocal;
    }

    public function updateGeographyConfig(array $geoConfig): void
    {
        $this->geoConfig = $geoConfig;
    }

    public function activate(): void
    {
        $this->isActive = true;
    }

    public function deactivate(): void
    {
        $this->isActive = false;
    }

    // Getters
    public function code(): CountryCode { return $this->code; }
    public function nameEn(): string { return $this->nameEn; }
    public function nameLocal(): array { return $this->nameLocal; }
    public function isActive(): bool { return $this->isActive; }

    private function recordEvent(object $event): void
    {
        $this->recordedEvents[] = $event;
    }

    public function releaseEvents(): array
    {
        $events = $this->recordedEvents;
        $this->recordedEvents = [];
        return $events;
    }
}
```

STEP 4: RUN TESTS & ITERATE

```bash
# Run tests
php artisan test tests/Unit/Geography/Domain/

# Should see RED (failing tests)
# Implement code until GREEN
# Refactor and repeat
```

DELIVERABLES:
1. ✅ CountryCode value object with validation
2. ✅ GeographicCoordinate value object
3. ✅ AdministrativeLevel value object
4. ✅ Country aggregate with business rules
5. ✅ 100% test coverage for Domain layer
6. ✅ Exception classes for all validation errors

ACCEPTANCE CRITERIA:
1. ✅ All tests pass (RED → GREEN)
2. ✅ Code coverage >= 80%
3. ✅ NO database access in Domain layer
4. ✅ All methods have return types
5. ✅ Country code is IMMUTABLE after creation

NEXT STEPS:
After completing this, we'll create the database migrations for the polymorphic
geography table and implement the repository pattern.
```

---

### **🗄️ DATABASE MIGRATION PROMPT (Phase 1, Week 2)**

```text
CREATE LANDLORD DATABASE MIGRATIONS - POLYMORPHIC GEOGRAPHY

CONTEXT:
Create database schema in Landlord DB for country-agnostic geography.

CRITICAL REQUIREMENT:
SINGLE polymorphic table that works for ALL countries (Nepal, India, USA, etc.)

STEP 1: CREATE MIGRATIONS

```bash
php artisan make:migration create_countries_table --path=database/landlord/migrations
php artisan make:migration create_country_geography_configs_table --path=database/landlord/migrations
php artisan make:migration create_geo_administrative_units_table --path=database/landlord/migrations
```

STEP 2: IMPLEMENT MIGRATION - COUNTRIES TABLE

database/landlord/migrations/2025_01_01_000001_create_countries_table.php

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('landlord')->create('countries', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            // ISO Standards
            $table->char('country_code', 2)->unique()->comment('ISO 3166-1 alpha-2: NP, IN, US');
            $table->char('country_code_alpha3', 3)->unique()->comment('ISO 3166-1 alpha-3: NPL, IND, USA');
            $table->char('country_numeric_code', 3)->unique()->comment('ISO 3166-1 numeric: 524, 356, 840');

            // Names (English + Multilingual JSON)
            $table->string('name_en', 200)->index();
            $table->string('name_official_en', 300)->nullable();
            $table->json('name_local')->comment('{"np": "नेपाल", "hi": "भारत"}');

            // Geographic Classification
            $table->string('capital_city_en', 200)->nullable();
            $table->json('capital_city_local')->nullable();
            $table->string('region', 100)->nullable()->comment('Asia, Europe, Americas');
            $table->string('subregion', 100)->nullable()->comment('Southern Asia, Western Europe');
            $table->enum('continent', ['AF', 'AS', 'EU', 'NA', 'SA', 'OC', 'AN']);

            // Political System
            $table->enum('government_type', [
                'parliamentary_democracy',
                'presidential_democracy',
                'semi_presidential',
                'constitutional_monarchy',
                'absolute_monarchy',
                'one_party_state',
                'other'
            ])->default('parliamentary_democracy');

            // Administrative Hierarchy Configuration
            $table->tinyInteger('admin_levels_count')->default(4)->comment('Nepal: 4, India: 6, USA: 4');
            $table->json('admin_level_names')->comment('{"en": ["Province", "District", ...], "np": ["प्रदेश", ...]}');

            // Demographics
            $table->bigInteger('population')->unsigned()->nullable();
            $table->decimal('total_area_sqkm', 15, 2)->nullable();
            $table->json('official_languages')->comment('["np", "en"] or ["hi", "en", "ta", ...]');
            $table->char('currency_code', 3)->nullable()->comment('ISO 4217: NPR, INR, USD');

            // Validation Rules (Country-Specific)
            $table->json('id_validation_rules')->nullable();
            $table->string('phone_country_code', 5)->nullable()->comment('+977, +91, +1');
            $table->string('phone_validation_regex', 200)->nullable();
            $table->string('postal_code_format', 50)->nullable();

            // Platform Configuration
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_supported')->default(false)->index()->comment('Platform supports this country');
            $table->date('supported_since')->nullable();
            $table->string('timezone_default', 50)->nullable()->comment('Asia/Kathmandu, Asia/Kolkata');

            // Localization
            $table->string('date_format_default', 20)->nullable()->comment('Y-m-d, d/m/Y');
            $table->json('number_format')->nullable()->comment('{"decimal": ".", "thousand": ","}');

            // Metadata (Flexible)
            $table->json('metadata')->nullable();

            // Audit
            $table->timestamps();

            // Indexes
            $table->index('country_code');
            $table->index('is_supported');
            $table->index('region');
        });
    }

    public function down(): void
    {
        Schema::connection('landlord')->dropIfExists('countries');
    }
};
```

STEP 3: COUNTRY GEOGRAPHY CONFIGS

database/landlord/migrations/2025_01_01_000002_create_country_geography_configs_table.php

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('landlord')->create('country_geography_configs', function (Blueprint $table) {
            $table->id();
            $table->char('country_code', 2);

            // Administrative Level Definition
            $table->tinyInteger('level_number')->comment('1, 2, 3, 4, 5, 6');
            $table->string('level_name_en', 100)->comment('Province, State, District, etc.');
            $table->json('level_name_local')->comment('{"np": "प्रदेश", "hi": "राज्य"}');
            $table->string('level_type', 50)->comment('province, state, district, ward');

            // Hierarchy Rules
            $table->tinyInteger('parent_level')->nullable()->comment('NULL for level 1');
            $table->integer('typical_count')->unsigned()->nullable()->comment('Expected count: 7 provinces, 50 states');

            // Naming Convention
            $table->string('code_format', 100)->nullable()->comment('NP-P{number}, IN-{state_code}');
            $table->string('code_example', 50)->nullable()->comment('NP-P1, IN-UP');

            // Validation
            $table->integer('min_count')->unsigned()->nullable();
            $table->integer('max_count')->unsigned()->nullable();
            $table->boolean('is_required')->default(true);

            // Display
            $table->tinyInteger('display_order')->default(0);
            $table->boolean('is_active')->default(true);

            // Metadata
            $table->json('metadata')->nullable();

            // Audit
            $table->timestamps();

            // Constraints
            $table->unique(['country_code', 'level_number']);
            $table->foreign('country_code')
                  ->references('country_code')
                  ->on('countries')
                  ->onDelete('cascade')
                  ->onUpdate('cascade');

            // Indexes
            $table->index('country_code');
            $table->index('level_number');
        });
    }

    public function down(): void
    {
        Schema::connection('landlord')->dropIfExists('country_geography_configs');
    }
};
```

STEP 4: POLYMORPHIC ADMIN UNITS (CRITICAL)

database/landlord/migrations/2025_01_01_000003_create_geo_administrative_units_table.php

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('landlord')->create('geo_administrative_units', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            // Country & Hierarchy
            $table->char('country_code', 2)->index()->comment('NP, IN, US, etc.');
            $table->tinyInteger('admin_level')->index()->comment('1=top (province/state), 2=district, etc.');
            $table->string('admin_type', 50)->index()->comment('province, state, district, ward');

            // Hierarchical Structure
            $table->foreignId('parent_id')->nullable()->index();
            $table->string('path', 500)->nullable()->index()->comment('Materialized path: /1/23/456/');
            $table->tinyInteger('depth')->nullable()->comment('Depth in tree (0=top level)');

            // Standard Codes
            $table->string('unit_code', 50)->index()->comment('Country-specific code');
            $table->string('iso_code', 20)->nullable()->index()->comment('ISO code: NP-P1, IN-UP');
            $table->string('government_code', 50)->nullable()->comment('Official government code');

            // Names (Multilingual)
            $table->string('name_en', 200)->index();
            $table->json('name_local')->comment('{"np": "कोशी प्रदेश", "hi": "उत्तर प्रदेश"}');
            $table->json('name_alt')->nullable()->comment('Alternative/former names');

            // Geographic Data
            $table->decimal('centroid_lat', 10, 8)->nullable();
            $table->decimal('centroid_lng', 11, 8)->nullable();
            $table->polygon('bounding_box')->nullable();
            $table->string('geojson_url', 500)->nullable()->comment('CDN URL for full GeoJSON');
            $table->decimal('area_sqkm', 15, 2)->nullable();

            // Demographics
            $table->bigInteger('population')->unsigned()->nullable();
            $table->integer('household_count')->unsigned()->nullable();
            $table->integer('voter_count')->unsigned()->nullable();
            $table->decimal('density_per_sqkm', 10, 2)->nullable();

            // Child Counts (Denormalized for Performance)
            $table->integer('total_children')->unsigned()->default(0);
            $table->integer('direct_children')->unsigned()->default(0);

            // Classification
            $table->string('classification', 50)->nullable()->comment('Urban, Rural, Metropolitan');
            $table->string('grade', 10)->nullable()->comment('A, B, C (for Nepal local levels)');

            // Status & Validity (Temporal Support)
            $table->boolean('is_active')->default(true)->index();
            $table->date('established_date')->nullable();
            $table->date('valid_from')->index()->comment('Temporal support: from date');
            $table->date('valid_to')->default('9999-12-31')->index()->comment('Temporal support: to date');

            // Metadata (Country-Specific Flexible Data)
            $table->json('metadata')->nullable()->comment('Any country-specific attributes');

            // Audit
            $table->timestamps();
            $table->string('created_by', 100)->default('system');

            // Constraints
            $table->unique(['country_code', 'unit_code', 'valid_from'], 'uk_country_code_unit');

            // Foreign Keys
            $table->foreign('country_code')
                  ->references('country_code')
                  ->on('countries')
                  ->onDelete('restrict')
                  ->onUpdate('cascade');

            $table->foreign('parent_id')
                  ->references('id')
                  ->on('geo_administrative_units')
                  ->onDelete('restrict')
                  ->onUpdate('cascade');

            // Spatial Index (if MySQL supports it)
            // $table->spatialIndex('bounding_box');

            // Full-Text Search
            // DB::statement('ALTER TABLE geo_administrative_units ADD FULLTEXT INDEX idx_search (name_en, name_local)');
        });

        // Partition by country_code for performance
        // Note: This requires manual SQL after migration
        DB::connection('landlord')->statement('
            ALTER TABLE geo_administrative_units
            PARTITION BY KEY(country_code)
            PARTITIONS 16
        ');
    }

    public function down(): void
    {
        Schema::connection('landlord')->dropIfExists('geo_administrative_units');
    }
};
```

DELIVERABLES:
1. ✅ Three migration files
2. ✅ Proper foreign keys and constraints
3. ✅ Partitioning for performance
4. ✅ Indexes for all query patterns
5. ✅ Rollback support

ACCEPTANCE CRITERIA:
1. ✅ Migrations run: php artisan migrate --database=landlord
2. ✅ Tables created in landlord database
3. ✅ Foreign keys work
4. ✅ Partitioning applied
5. ✅ Can rollback: php artisan migrate:rollback --database=landlord

NEXT STEP:
Create seeders for countries and Nepal geography.
```

---

## ⚠️ CRITICAL IMPLEMENTATION RULES

### **🚨 RED FLAGS - STOP IF YOU SEE THESE**

1. **Hardcoded Country Values**
   ```php
   // ❌ WRONG
   if ($provinceId > 7) // Hardcoded for Nepal

   // ✅ RIGHT
   $maxProvinces = config("countries.{$countryCode}.admin_levels.1.max_count");
   if ($level1Count > $maxProvinces)
   ```

2. **Country-Specific Table Names**
   ```sql
   -- ❌ WRONG
   CREATE TABLE provinces (...);
   CREATE TABLE states (...);

   -- ✅ RIGHT
   CREATE TABLE geo_administrative_units (...);
   ```

3. **Separate Language Columns**
   ```php
   // ❌ WRONG
   $table->string('name_en');
   $table->string('name_np');
   $table->string('name_hi'); // Adding more languages?

   // ✅ RIGHT
   $table->json('name_local'); // {"en": "...", "np": "...", "hi": "..."}
   ```

4. **Missing Country Code in Queries**
   ```php
   // ❌ WRONG
   $provinces = Province::all(); // Which country??

   // ✅ RIGHT
   $provinces = GeoAdministrativeUnit::where('country_code', 'NP')
                                      ->where('admin_level', 1)
                                      ->get();
   ```

5. **Using ENUMs for Country-Specific Data**
   ```sql
   -- ❌ WRONG
   ideology ENUM('communist', 'socialist', 'liberal'); -- What about Hindutva?

   -- ✅ RIGHT
   CREATE TABLE global_political_ideologies (...);
   ```

---

## ✅ DAILY WORKFLOW CHECKLIST

**Morning (TDD):**
1. [ ] Write failing test for Nepal feature
2. [ ] Implement minimal code to pass test
3. [ ] Verify test works for Nepal
4. [ ] Ask: "Would this break for India?"
5. [ ] If yes, refactor to be country-agnostic

**Afternoon (Global Verification):**
1. [ ] Run all tests: `php artisan test`
2. [ ] Check coverage: `php artisan test --coverage`
3. [ ] Question: "Can I add India without changing this code?"
4. [ ] Create empty stub for India (e.g., `IN/` folder with TODO)
5. [ ] Update configuration files

**Evening (Config Review):**
1. [ ] Move any hardcoded value to `config/countries/np.php`
2. [ ] Ensure all names use JSON, not separate columns
3. [ ] Verify all queries use `country_code` + `admin_level`
4. [ ] Update documentation
5. [ ] Commit with proper message: `feat: Add X (NP+IN ready)`

---

## 📋 ACCEPTANCE CRITERIA (FINAL)

| Phase | Criteria | Verification Command |
|-------|----------|---------------------|
| **Phase 0** | Docker containers running | `docker-compose ps` |
| | All 3 databases accessible | `php artisan tinker` → test connections |
| | PHPUnit configured | `php artisan test` |
| **Phase 1** | Nepal geography seeded | `DB::connection('landlord')->table('geo_administrative_units')->where('country_code', 'NP')->count()` should be ~6,800+ |
| | Geography cached | Redis contains `geography:NP:*` keys |
| | Tests pass | `php artisan test --testsuite=Geography` |
| | Coverage >= 80% | `php artisan test --coverage --min=80` |
| **Phase 2** | No ENUMs in schema | Search codebase for `ENUM` - should only be in specific places |
| | Taxonomies multilingual | Check `name_local` is JSON |
| **Phase 3** | Party events recorded | `party_history_events` table has UML+Maoist merger |
| | Event sourcing works | Can reconstruct party state from events |
| **Phase 4** | Tenant provisioned | Create tenant → database created |
| | Tenant isolated | Cross-tenant query fails |
| | Geography refs work | Tenant member has valid `province_id` |

---

## 🎯 NEXT STEPS

**USER ACTIONS REQUIRED:**

1. ✅ **Review this document** - Confirm you understand the 3-tier architecture
2. ✅ **Approve Phase 0 start** - Explicitly approve DDD structure setup
3. ✅ **Confirm Nepal-first approach** - Build Nepal as configuration, not hardcode
4. ✅ **Review prompt templates** - Are these detailed enough for implementation?

**ONCE APPROVED, I WILL:**

1. Execute **Phase 0 Setup** (Week 1)
   - Create complete DDD folder structure
   - Setup Docker Compose with 3 databases
   - Configure PHPUnit with coverage
   - Create service providers

2. Begin **Phase 1 Geography Context** (Week 2)
   - Write failing tests for Country aggregate
   - Implement value objects (CountryCode, etc.)
   - Create polymorphic geography table migration
   - Seed Nepal data (7→77→753→6,743)

---

## 📝 DOCUMENT STATUS

**Status:** 🟡 **AWAITING USER REVIEW**

**Questions?**
- Unclear about any architectural decision?
- Want to modify the phasing?
- Need clarification on TDD approach?
- Concerns about timeline (12 weeks)?

**I will NOT start coding until you:**
1. Confirm you've read this entire document
2. Approve the 3-tier database architecture
3. Approve the Nepal-first, configuration-driven approach
4. Give explicit green light to start Phase 0

---

**Last Updated:** 2025-12-17 18:00
**Document Version:** 2.0.0
**Author:** Senior Solution Architect + Backend Developer (15 years exp)
