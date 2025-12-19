# 🌍 CRITICAL ANALYSIS & GLOBAL IMPLEMENTATION PLAN
## Political Party Digitalization Platform - World-Ready Architecture

**Document Version:** 1.0.0
**Date:** 2025-12-17
**Architect:** Senior Solution Architect (15 years experience)
**Status:** 🔴 AWAITING REVIEW - DO NOT IMPLEMENT YET

---

## 📊 EXECUTIVE SUMMARY

After critically analyzing the three architectural documents, I've identified **fundamental design flaws** that would prevent global scalability. This document provides:

1. **Critical Analysis** of existing proposals
2. **Architectural Gaps** that must be addressed
3. **Revised Global Architecture** for all countries
4. **Phased Implementation Plan** (12 phases)
5. **Risk Mitigation Strategy**

**KEY FINDING:** The current design conflates "Nepal-specific implementation" with "global architecture", creating technical debt that will require complete refactoring when expanding to other countries.

---

## 🔴 CRITICAL ISSUES ANALYSIS

### **Issue #1: Architectural Inconsistency**

**Problem:**
- Document `20251217_1815` proposes country-agnostic architecture
- Document `20251217_1755` implements Nepal-specific hardcoded schema
- **These contradict each other fundamentally**

**Evidence:**
```sql
-- Document 3 (Landlord DB) - HARDCODED for Nepal
CREATE TABLE geo_provinces (
    id TINYINT UNSIGNED PRIMARY KEY, -- Static 1-7 (Nepal only!)
    name_en VARCHAR(100) NOT NULL,
    iso_code VARCHAR(10) UNIQUE NOT NULL, -- NP-P1 to NP-P7
    ...
);

-- What about India's 28 states? USA's 50 states? Germany's 16 länder?
```

**Impact:** 🔴 **BLOCKER** - Cannot expand to other countries without complete database redesign.

---

### **Issue #2: Confusing Multi-Tenancy Model**

**Problem:**
The architecture doesn't clearly define what a "tenant" is in a global context.

**Three Possible Models:**

```
MODEL A: Tenant = Political Party (Current assumption)
├── Landlord DB: Global reference data (geography, taxonomies)
├── Tenant 1 DB: Nepal Communist Party
├── Tenant 2 DB: Nepali Congress
└── Tenant 3 DB: ... (all Nepal-based parties)
❌ DOESN'T SCALE: What about Indian parties? Separate platform instance?

MODEL B: Tenant = Country
├── Landlord DB: Global reference data
├── Tenant_Nepal DB: All Nepali parties
├── Tenant_India DB: All Indian parties
└── Tenant_USA DB: All American parties
⚠️ BETTER: But multi-country parties become complex

MODEL C: Tenant = Party Instance in Country (Recommended)
├── Landlord DB: Countries, Global Geography Templates, Taxonomies
├── Platform DB: Cross-country party registry, user accounts
├── Tenant_NCP_Nepal DB: Nepal Communist Party (Nepal branch)
├── Tenant_NCP_India DB: Nepal Communist Party (India diaspora branch)
├── Tenant_BJP_India DB: Bharatiya Janata Party (India)
└── Tenant_Labour_UK DB: Labour Party (UK)
✅ SCALABLE: Each party-country combination is a tenant
```

**Current Design:** Uses Model A without acknowledging limitation.

**Recommendation:** Implement **Model C** with clear separation of:
- **Landlord DB**: Universal reference data (countries, geography templates, skills)
- **Platform DB**: Cross-tenant operational data (users, party registry, subscriptions)
- **Tenant DB**: Party-specific data scoped to one country

---

### **Issue #3: Geography Model is Not Polymorphic**

**Problem:**
Administrative hierarchies vary drastically across countries.

**Examples:**

| Country | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 | Level 6 |
|---------|---------|---------|---------|---------|---------|---------|
| **Nepal** | Province (7) | District (77) | Local Level (753) | Ward (~6,743) | - | - |
| **India** | State (28) | District (766) | Sub-district | Block | Gram Panchayat | Village |
| **USA** | State (50) | County (3,143) | City/Township | Ward | Precinct | - |
| **UK** | Region (9) | County (48) | District (317) | Ward | - | - |
| **Germany** | Länder (16) | Regierungsbezirk | Kreis | Gemeinde | - | - |
| **Bangladesh** | Division (8) | District (64) | Upazila (492) | Union (4,571) | Village | - |

**Current Schema:**
```sql
-- Hardcoded table names
CREATE TABLE geo_provinces (...);  -- Only works for Nepal
CREATE TABLE geo_districts (...);  -- Only works for Nepal

-- Should be:
CREATE TABLE geo_administrative_units (...);  -- Universal!
```

**Recommendation:** Single polymorphic table with country-specific metadata.

---

### **Issue #4: Missing Core Domain Entities**

**Critical Missing Tables:**

1. **`countries`** - No country registry!
   - How do we store country-specific configurations?
   - No ISO 3166-1 alpha-2 codes
   - No political system metadata (parliamentary, presidential, etc.)

2. **`country_geography_configs`** - No hierarchy definitions!
   - How many administrative levels does each country have?
   - What are they called in each language?
   - What are the validation rules?

3. **`political_systems`** - No system classification!
   - Electoral systems (FPTP, proportional, mixed)
   - Government types (parliamentary, presidential, hybrid)
   - Party registration requirements

4. **`party_types`** - No party classification!
   - National vs Regional vs Local parties
   - Single-country vs Multi-country parties
   - Coalition structures

5. **`party_history_events`** - No event sourcing!
   - Party mergers, splits, name changes
   - How to track CPN-UML + CPN (Maoist Centre) = NCP → split back?

---

### **Issue #5: DDD Violations in Implementation**

**Problem:**
Document 3 provides raw SQL schema without DDD layers.

**Missing DDD Components:**

```php
// Domain Layer - NOT DEFINED
app/Contexts/MembershipPlatform/Domain/
├── Aggregates/
│   ├── Country/
│   │   ├── Country.php              // Aggregate root
│   │   ├── AdministrativeUnit.php   // Entity
│   │   └── GeographicHierarchy.php  // Entity
│   ├── PoliticalParty/
│   │   ├── Party.php                // Aggregate root
│   │   ├── PartyBranch.php          // Entity (party in specific country)
│   │   ├── PartyHistory.php         // Event sourcing
│   │   └── PartyCoalition.php       // Entity
│   └── Tenant/
│       ├── Tenant.php               // Aggregate root (party-country instance)
│       ├── TenantSubscription.php   // Entity
│       └── TenantQuotas.php         // Value Object
├── ValueObjects/
│   ├── CountryCode.php              // ISO 3166-1
│   ├── GeographicCoordinate.php     // Lat/Long
│   ├── AdministrativeLevel.php      // Level 1, Level 2, etc.
│   ├── PartyIdentifier.php          // Unique party ID
│   └── ElectoralSystem.php          // FPTP, Proportional, etc.
├── Repositories/
│   ├── CountryRepositoryInterface.php
│   ├── PartyRepositoryInterface.php
│   └── TenantRepositoryInterface.php
├── Events/
│   ├── PartyRegistered.php
│   ├── PartyMerged.php
│   ├── PartySplit.php
│   ├── CountryAdded.php
│   └── TenantProvisioned.php
└── Services/
    ├── GeographyService.php         // Handle country-specific geo logic
    ├── PartyManagementService.php   // Handle party lifecycle
    └── TenantProvisioningService.php
```

**Current Approach:** Jumping straight to SQL violates DDD layering.

---

### **Issue #6: Hardcoded Enumerations**

**Problem:**
Using MySQL ENUMs for data that varies by country/culture.

**Examples:**

```sql
-- Document 3 - WRONG
ideology ENUM(
    'communist', 'socialist', 'social_democrat',
    'liberal', 'conservative', 'centrist',
    'nationalist', 'regional', 'other'
) DEFAULT 'other',

-- What about:
-- 'theocratic' (Middle East)
-- 'monarchist' (Thailand, Jordan)
-- 'green/environmental' (Europe)
-- 'populist' (Latin America)
-- 'technocratic' (Singapore-style)
```

**Recommendation:** Replace ENUMs with taxonomy tables:
```sql
CREATE TABLE global_political_ideologies (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_local JSON NOT NULL,  -- {"np": "साम्यवादी", "hi": "कम्युनिस्ट"}
    description JSON,
    country_scope JSON,  -- ["NP", "IN", "CN"] or NULL for universal
    is_active BOOLEAN DEFAULT TRUE
);
```

---

### **Issue #7: No Historical Tracking**

**Problem:**
No support for temporal data (administrative boundary changes, party history).

**Real-World Examples:**

1. **Nepal Province Name Changes:**
   - Province 1 → Koshi (2018)
   - Province 2 → Madhesh (2018)
   - Need to track: What was the name on 2017-05-01 vs 2024-01-01?

2. **Party Mergers/Splits:**
   - CPN-UML + CPN (Maoist Centre) = NCP (2018-05-17)
   - NCP → split back to UML + Maoist (2021-03-07)
   - Need to track: Which party existed when?

3. **District Reorganization:**
   - India reorganizes districts frequently
   - USA census changes boundaries
   - Need: Valid_from, Valid_to for all geo entities

**Current Schema:**
```sql
-- Document 3 - PARTIAL SOLUTION
valid_from DATE DEFAULT '2015-09-20',
valid_to DATE DEFAULT '9999-12-31',
-- Only on local_levels and wards, NOT on provinces/districts!
```

**Recommendation:** Implement **Temporal Tables** (SQL:2011 standard):
```sql
CREATE TABLE geo_administrative_units (
    id BIGINT UNSIGNED PRIMARY KEY,
    country_code CHAR(2) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    -- System-versioned columns
    valid_from DATETIME(6) GENERATED ALWAYS AS ROW START,
    valid_to DATETIME(6) GENERATED ALWAYS AS ROW END,
    PERIOD FOR SYSTEM_TIME(valid_from, valid_to)
) WITH SYSTEM VERSIONING;
```

---

### **Issue #8: Scalability Concerns**

**Performance Issues:**

1. **No Partitioning Strategy:**
   - `geo_wards` table: 6,743 rows for Nepal
   - For India: ~250,000 gram panchayats
   - For USA: ~85,000 local governments
   - **Global total: Millions of rows** - needs partitioning by country

2. **No Caching Strategy:**
   - Geography data is read-heavy (99.9% reads)
   - Should use Redis/Memcached
   - No mention in architecture

3. **No CDN Strategy:**
   - GeoJSON boundaries, maps
   - Should be served from CDN
   - No mention

4. **No Sharding Strategy:**
   - If tenant DB grows (10M+ members in Indian parties)
   - Need horizontal sharding
   - No mention

---

## ✅ REVISED GLOBAL ARCHITECTURE

### **Architecture Principles**

1. **Country-First Design:** Country is the top-level aggregate
2. **Polymorphic Geography:** Single table for all administrative units
3. **Event-Sourced Party History:** All party changes are events
4. **Configuration-Driven Validation:** No hardcoded rules
5. **Strict DDD Layering:** Domain → Application → Infrastructure
6. **Multi-Database Strategy:** Landlord + Platform + Tenants (3-tier)
7. **TDD First:** Tests before implementation (80%+ coverage)

---

### **Database Architecture (3-Tier)**

```
┌─────────────────────────────────────────────────────────────────┐
│ LANDLORD DATABASE: landlord_global_reference                    │
│ Purpose: Immutable global reference data (geography, taxonomies)│
├─────────────────────────────────────────────────────────────────┤
│ • countries                          (196 countries)            │
│ • country_geography_configs          (hierarchy definitions)    │
│ • geo_administrative_units           (polymorphic, millions)    │
│ • global_skills                      (universal skills)         │
│ • global_political_ideologies        (ideologies)               │
│ • global_electoral_systems           (FPTP, PR, etc.)           │
│ • global_id_types                    (citizenship, passport)    │
│ • global_membership_type_templates   (templates)                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PLATFORM DATABASE: platform_operational                         │
│ Purpose: Cross-tenant operational data, party registry          │
├─────────────────────────────────────────────────────────────────┤
│ • political_parties                  (party registry)           │
│ • party_branches                     (party in each country)    │
│ • party_history_events               (mergers, splits)          │
│ • tenants                            (party-country instances)  │
│ • tenant_subscriptions               (billing)                  │
│ • platform_users                     (cross-platform users)     │
│ • platform_admins                    (super admins)             │
│ • platform_audit_logs                (global audit trail)       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TENANT DATABASE: tenant_{party_code}_{country_code}             │
│ Purpose: Party-specific operational data for ONE country        │
├─────────────────────────────────────────────────────────────────┤
│ Example: tenant_ncp_np (Nepal Communist Party in Nepal)         │
│ • members                            (party members)            │
│ • committees                         (party committees)         │
│ • elections                          (internal elections)       │
│ • forums                             (discussions)              │
│ • events                             (rallies, meetings)        │
│ • finance                            (donations, expenses)      │
│ • membership_types                   (active, general, etc.)    │
│                                                                  │
│ Note: Each tenant DB references landlord geo by ID              │
└─────────────────────────────────────────────────────────────────┘
```

---

### **Core Domain Model (DDD)**

```
┌─────────────────────────────────────────────────────────────────┐
│ BOUNDED CONTEXT 1: Geography Context                            │
├─────────────────────────────────────────────────────────────────┤
│ Aggregates:                                                      │
│  • Country (Aggregate Root)                                      │
│    - CountryCode (VO)                                            │
│    - CountryName (VO)                                            │
│    - GeographyConfiguration (Entity)                             │
│    - AdministrativeUnits (Collection of Entities)                │
│                                                                  │
│ Key Rules:                                                       │
│  - Country defines its own hierarchy levels                      │
│  - Administrative units are immutable within validity period     │
│  - Changes create new versions, don't update                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ BOUNDED CONTEXT 2: Political Party Context                      │
├─────────────────────────────────────────────────────────────────┤
│ Aggregates:                                                      │
│  • PoliticalParty (Aggregate Root)                               │
│    - PartyIdentifier (VO)                                        │
│    - PartyName (VO)                                              │
│    - PartyIdeology (VO)                                          │
│    - PartyBranches (Collection of Entities)                      │
│    - PartyHistory (Event Sourcing)                               │
│                                                                  │
│  • PartyBranch (Entity)                                          │
│    - CountryCode (VO)                                            │
│    - RegistrationDetails (VO)                                    │
│    - LocalLeadership (Entity)                                    │
│                                                                  │
│ Key Rules:                                                       │
│  - Party can operate in multiple countries                       │
│  - Each branch follows host country's regulations                │
│  - Party history is append-only (event sourcing)                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ BOUNDED CONTEXT 3: Tenant Context                               │
├─────────────────────────────────────────────────────────────────┤
│ Aggregates:                                                      │
│  • Tenant (Aggregate Root)                                       │
│    - TenantIdentifier (VO)                                       │
│    - PartyBranchReference (VO)                                   │
│    - DatabaseConfiguration (VO)                                  │
│    - Subscription (Entity)                                       │
│    - Quotas (VO)                                                 │
│                                                                  │
│ Key Rules:                                                       │
│  - One tenant = One party branch in one country                  │
│  - Each tenant has isolated database                             │
│  - Subscription determines features and limits                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ REVISED LANDLORD DATABASE SCHEMA

### **1. Country & Geography Configuration**

```sql
-- ============================================
-- 1.1 COUNTRIES (Master List)
-- ============================================
CREATE TABLE countries (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- ISO Standards
    country_code CHAR(2) UNIQUE NOT NULL,           -- ISO 3166-1 alpha-2: NP, IN, US, etc.
    country_code_alpha3 CHAR(3) UNIQUE NOT NULL,    -- ISO 3166-1 alpha-3: NPL, IND, USA
    country_numeric_code CHAR(3) UNIQUE NOT NULL,   -- ISO 3166-1 numeric: 524, 356, 840

    -- Names (Multilingual)
    name_en VARCHAR(200) NOT NULL,
    name_official_en VARCHAR(300),
    name_local JSON NOT NULL,                       -- {"np": "नेपाल", "hi": "भारत"}

    -- Geographic Data
    capital_city_en VARCHAR(200),
    capital_city_local JSON,
    region VARCHAR(100),                            -- Asia, Europe, Americas, etc.
    subregion VARCHAR(100),                         -- Southern Asia, Western Europe, etc.
    continent ENUM('AF', 'AS', 'EU', 'NA', 'SA', 'OC', 'AN') NOT NULL,

    -- Political System
    government_type ENUM(
        'parliamentary_democracy',
        'presidential_democracy',
        'semi_presidential',
        'constitutional_monarchy',
        'absolute_monarchy',
        'one_party_state',
        'other'
    ) NOT NULL,

    electoral_system_id SMALLINT UNSIGNED,          -- FK to global_electoral_systems

    -- Demographics
    population BIGINT UNSIGNED,
    total_area_sqkm DECIMAL(15,2),
    official_languages JSON NOT NULL,               -- ["np", "en"] or ["hi", "en", "ta", ...]
    currency_code CHAR(3),                          -- ISO 4217: NPR, INR, USD

    -- Administrative Hierarchy Configuration
    admin_levels_count TINYINT UNSIGNED NOT NULL DEFAULT 4,
    admin_level_names JSON NOT NULL,                -- {"en": ["Province", "District", ...], "np": ["प्रदेश", "जिल्ला", ...]}

    -- Validation Rules
    id_validation_rules JSON,                       -- Country-specific ID formats
    phone_country_code VARCHAR(5),                  -- +977, +91, +1
    phone_validation_regex VARCHAR(200),
    postal_code_format VARCHAR(50),

    -- Platform Configuration
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_supported BOOLEAN DEFAULT FALSE,             -- Platform supports this country
    supported_since DATE,
    timezone_default VARCHAR(50),                   -- Asia/Kathmandu, Asia/Kolkata

    -- Localization
    date_format_default VARCHAR(20),                -- Y-m-d, d/m/Y, etc.
    number_format JSON,                             -- {"decimal": ".", "thousand": ","}

    -- Metadata
    metadata JSON,                                  -- Flexible for country-specific data

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_country_code (country_code),
    INDEX idx_is_supported (is_supported),
    INDEX idx_region (region),

    FOREIGN KEY (electoral_system_id)
        REFERENCES global_electoral_systems(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Master list of all countries (ISO 3166-1)';

-- ============================================
-- 1.2 COUNTRY GEOGRAPHY CONFIGURATIONS
-- ============================================
CREATE TABLE country_geography_configs (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    country_code CHAR(2) NOT NULL,

    -- Administrative Level Definition
    level_number TINYINT UNSIGNED NOT NULL,         -- 1, 2, 3, 4, 5, 6
    level_name_en VARCHAR(100) NOT NULL,            -- "Province", "State", "Region"
    level_name_local JSON NOT NULL,                 -- {"np": "प्रदेश", "hi": "राज्य"}
    level_type VARCHAR(50) NOT NULL,                -- province, state, district, ward, etc.

    -- Hierarchy Rules
    parent_level TINYINT UNSIGNED,                  -- NULL for level 1
    typical_count INT UNSIGNED,                     -- Expected count (7 provinces, 50 states)

    -- Naming Convention
    code_format VARCHAR(100),                       -- "NP-P{number}", "IN-{state_code}"
    code_example VARCHAR(50),                       -- "NP-P1", "IN-UP"

    -- Validation Rules
    min_count INT UNSIGNED,                         -- Minimum entities at this level
    max_count INT UNSIGNED,                         -- Maximum entities at this level
    is_required BOOLEAN DEFAULT TRUE,               -- Is this level mandatory?

    -- Display Configuration
    display_order TINYINT UNSIGNED DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    metadata JSON,                                  -- Level-specific configurations

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE KEY uk_country_level (country_code, level_number),
    INDEX idx_country_code (country_code),
    INDEX idx_level_number (level_number),

    FOREIGN KEY (country_code)
        REFERENCES countries(country_code)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Defines administrative hierarchy for each country';

-- ============================================
-- 1.3 POLYMORPHIC ADMINISTRATIVE UNITS (Universal Geography)
-- ============================================
CREATE TABLE geo_administrative_units (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- Country & Hierarchy
    country_code CHAR(2) NOT NULL,
    admin_level TINYINT UNSIGNED NOT NULL,          -- 1=top (province/state), 2=district, etc.
    admin_type VARCHAR(50) NOT NULL,                -- 'province', 'state', 'district', 'ward'

    -- Hierarchical Structure
    parent_id BIGINT UNSIGNED,                      -- NULL for top-level (provinces/states)
    path VARCHAR(500),                              -- Materialized path: /1/23/456/
    depth TINYINT UNSIGNED,                         -- Depth in tree (0=top level)

    -- Standard Codes
    unit_code VARCHAR(50) NOT NULL,                 -- Country-specific code
    iso_code VARCHAR(20),                           -- ISO code if applicable (NP-P1, IN-UP)
    government_code VARCHAR(50),                    -- Official government code

    -- Names (Multilingual)
    name_en VARCHAR(200) NOT NULL,
    name_local JSON NOT NULL,                       -- {"np": "कोशी प्रदेश", "hi": "उत्तर प्रदेश"}
    name_alt JSON,                                  -- Alternative names, former names

    -- Geographic Data
    centroid_lat DECIMAL(10,8),
    centroid_lng DECIMAL(11,8),
    bounding_box POLYGON,
    geojson_url VARCHAR(500),                       -- CDN URL for full GeoJSON
    area_sqkm DECIMAL(15,2),

    -- Demographics
    population BIGINT UNSIGNED,
    household_count INT UNSIGNED,
    voter_count INT UNSIGNED,
    density_per_sqkm DECIMAL(10,2),

    -- Child Counts (Denormalized for Performance)
    total_children INT UNSIGNED DEFAULT 0,
    direct_children INT UNSIGNED DEFAULT 0,

    -- Classification
    classification VARCHAR(50),                     -- Urban, Rural, Metropolitan, etc.
    grade VARCHAR(10),                              -- A, B, C (for Nepal local levels)

    -- Status & Validity (Temporal Support)
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    established_date DATE,
    valid_from DATE NOT NULL,
    valid_to DATE DEFAULT '9999-12-31',

    -- Metadata (Country-Specific Flexible Data)
    metadata JSON,                                  -- Any country-specific attributes

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',

    -- Indexes (Performance Critical)
    UNIQUE KEY uk_country_code_unit (country_code, unit_code, valid_from),
    INDEX idx_country_code (country_code),
    INDEX idx_admin_level (admin_level),
    INDEX idx_parent_id (parent_id),
    INDEX idx_path (path),
    INDEX idx_is_active (is_active),
    INDEX idx_validity (valid_from, valid_to),
    INDEX idx_name_en (name_en),
    SPATIAL INDEX idx_centroid (bounding_box),
    FULLTEXT idx_search (name_en, name_local),

    FOREIGN KEY (country_code)
        REFERENCES countries(country_code)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (parent_id)
        REFERENCES geo_administrative_units(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY KEY(country_code) PARTITIONS 16
COMMENT='Universal administrative units for all countries - polymorphic design';
```

### **2. Global Taxonomies (Configuration-Driven)**

```sql
-- ============================================
-- 2.1 POLITICAL IDEOLOGIES (Replaces ENUM)
-- ============================================
CREATE TABLE global_political_ideologies (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- Identification
    code VARCHAR(50) UNIQUE NOT NULL,               -- COMMUNISM, SOCIALISM, LIBERALISM
    name_en VARCHAR(100) NOT NULL,
    name_local JSON NOT NULL,                       -- {"np": "साम्यवाद", "hi": "कम्युनिज़्म"}

    -- Description
    description_en TEXT,
    description_local JSON,

    -- Classification
    political_spectrum ENUM('far_left', 'left', 'center_left', 'center',
                            'center_right', 'right', 'far_right', 'other') DEFAULT 'center',
    category VARCHAR(50),                           -- Economic, Social, Nationalist, etc.

    -- Scope (NULL = Universal, or specific countries)
    country_scope JSON,                             -- ["NP", "IN"] or NULL for all
    region_scope VARCHAR(100),                      -- "South Asia", "Europe", NULL for all

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_system_defined BOOLEAN DEFAULT FALSE,
    display_order SMALLINT UNSIGNED DEFAULT 0,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_code (code),
    INDEX idx_political_spectrum (political_spectrum),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Global political ideologies - replaces hardcoded ENUM';

-- ============================================
-- 2.2 ELECTORAL SYSTEMS
-- ============================================
CREATE TABLE global_electoral_systems (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

    -- System Identification
    code VARCHAR(50) UNIQUE NOT NULL,               -- FPTP, PR, MMP, STV, etc.
    name_en VARCHAR(100) NOT NULL,
    name_local JSON,

    -- System Type
    system_type ENUM('majoritarian', 'proportional', 'mixed', 'other') NOT NULL,

    -- Description
    description_en TEXT,
    description_local JSON,
    formula VARCHAR(100),                           -- D'Hondt, Sainte-Laguë, Hare, etc.

    -- Characteristics
    allows_coalitions BOOLEAN DEFAULT TRUE,
    requires_threshold BOOLEAN DEFAULT FALSE,
    default_threshold_percent DECIMAL(5,2),         -- 5.00 for many PR systems

    -- Examples
    used_in_countries JSON,                         -- ["NP", "IN", "GB"]

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    INDEX idx_code (code),
    INDEX idx_system_type (system_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Electoral system types used worldwide';

-- ============================================
-- 2.3 GLOBAL SKILLS (Enhanced)
-- ============================================
CREATE TABLE global_skills (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- Identification
    skill_code VARCHAR(100) UNIQUE NOT NULL,        -- LEGAL_CONSTITUTIONAL, MEDICAL_GENERAL
    name_en VARCHAR(200) NOT NULL,
    name_local JSON NOT NULL,

    -- Classification (NO ENUM - Use Category System)
    category_id SMALLINT UNSIGNED,                  -- FK to skill_categories
    subcategory VARCHAR(100),

    -- Description
    description_en TEXT,
    description_local JSON,

    -- Skill Metadata
    proficiency_levels JSON DEFAULT '["Beginner", "Intermediate", "Advanced", "Expert"]',
    is_certification_available BOOLEAN DEFAULT FALSE,
    typical_training_hours SMALLINT UNSIGNED,

    -- Relevance
    is_politically_relevant BOOLEAN DEFAULT TRUE,
    political_relevance_score TINYINT UNSIGNED DEFAULT 50,  -- 0-100

    -- Scope
    country_scope JSON,                             -- NULL = universal, or ["NP", "IN"]

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_system_skill BOOLEAN DEFAULT FALSE,
    display_order INT UNSIGNED DEFAULT 0,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_skill_code (skill_code),
    INDEX idx_category_id (category_id),
    INDEX idx_is_active (is_active),
    FULLTEXT idx_search (name_en, description_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Global skills taxonomy - universal and country-specific';

-- ============================================
-- 2.4 SKILL CATEGORIES (Replaces ENUM)
-- ============================================
CREATE TABLE global_skill_categories (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

    code VARCHAR(50) UNIQUE NOT NULL,               -- LEGAL, MEDICAL, TECHNICAL
    name_en VARCHAR(100) NOT NULL,
    name_local JSON NOT NULL,
    description_en TEXT,
    icon VARCHAR(50),                               -- FontAwesome icon class
    display_order SMALLINT UNSIGNED DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,

    INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2.5 ID DOCUMENT TYPES (Country-Aware)
-- ============================================
CREATE TABLE global_id_types (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- Identification
    code VARCHAR(50) UNIQUE NOT NULL,               -- CITIZENSHIP, PASSPORT, AADHAAR, SSN
    name_en VARCHAR(100) NOT NULL,
    name_local JSON NOT NULL,

    -- Country Configuration
    country_code CHAR(2),                           -- NULL = universal, or specific country
    issuing_authority_en VARCHAR(200),
    issuing_authority_local JSON,

    -- Validation Rules
    validation_regex VARCHAR(300),
    validation_example VARCHAR(100),                -- "01-01-123456" for Nepal citizenship
    min_length TINYINT UNSIGNED,
    max_length TINYINT UNSIGNED,
    format_description TEXT,

    -- Document Characteristics
    is_government_issued BOOLEAN DEFAULT TRUE,
    is_photo_id BOOLEAN DEFAULT FALSE,
    is_proof_of_citizenship BOOLEAN DEFAULT FALSE,
    is_proof_of_address BOOLEAN DEFAULT FALSE,
    typical_validity_years TINYINT UNSIGNED,        -- NULL for lifetime documents

    -- Platform Requirements
    is_required_for_membership BOOLEAN DEFAULT FALSE,
    is_required_for_verification BOOLEAN DEFAULT FALSE,
    verification_priority TINYINT UNSIGNED DEFAULT 50,  -- 1-100

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    display_order SMALLINT UNSIGNED DEFAULT 0,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_code (code),
    INDEX idx_country_code (country_code),
    INDEX idx_is_active (is_active),

    FOREIGN KEY (country_code)
        REFERENCES countries(country_code)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ID document types per country';
```

### **3. Platform & Party Management**

```sql
-- ============================================
-- 3.1 POLITICAL PARTIES (Global Registry)
-- ============================================
CREATE TABLE political_parties (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- Party Identification
    party_code VARCHAR(50) UNIQUE NOT NULL,         -- NCP, BJP, LABOUR_UK
    founding_country_code CHAR(2) NOT NULL,         -- Where party was founded

    -- Official Names
    name_en VARCHAR(300) NOT NULL,
    name_official JSON NOT NULL,                    -- Official name in each language
    acronym VARCHAR(50),
    former_names JSON,                              -- Historical names

    -- Classification
    ideology_id SMALLINT UNSIGNED,                  -- FK to global_political_ideologies
    secondary_ideologies JSON,                      -- Array of ideology IDs
    political_position VARCHAR(50),                 -- left, center, right

    -- Foundation Information
    founded_date DATE,
    founder_names JSON,                             -- Array of founder names
    founding_manifesto_url VARCHAR(500),

    -- Organizational Structure
    party_type ENUM('national', 'regional', 'local', 'international') DEFAULT 'national',
    organizational_model ENUM('centralized', 'federal', 'confederal', 'decentralized') DEFAULT 'centralized',

    -- Branding
    logo_url VARCHAR(500),
    symbol_url VARCHAR(500),                        -- Election symbol
    primary_color CHAR(7),                          -- Hex color
    secondary_color CHAR(7),
    flag_url VARCHAR(500),

    -- Media & Communication
    official_website VARCHAR(255),
    social_media JSON,                              -- {"twitter": "@handle", "facebook": "page"}

    -- Legal Status (Global)
    is_active BOOLEAN DEFAULT TRUE,
    dissolution_date DATE,
    dissolution_reason TEXT,

    -- Metadata
    metadata JSON,                                  -- Flexible additional data

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_id BIGINT UNSIGNED,

    -- Indexes
    INDEX idx_party_code (party_code),
    INDEX idx_founding_country (founding_country_code),
    INDEX idx_ideology (ideology_id),
    INDEX idx_is_active (is_active),
    FULLTEXT idx_search (name_en, acronym),

    FOREIGN KEY (founding_country_code)
        REFERENCES countries(country_code)
        ON DELETE RESTRICT,
    FOREIGN KEY (ideology_id)
        REFERENCES global_political_ideologies(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Global registry of all political parties';

-- ============================================
-- 3.2 PARTY BRANCHES (Party in Specific Country)
-- ============================================
CREATE TABLE party_branches (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- Party & Country
    party_id BIGINT UNSIGNED NOT NULL,
    country_code CHAR(2) NOT NULL,

    -- Branch Identification
    branch_code VARCHAR(100) UNIQUE NOT NULL,       -- NCP_NP, NCP_IN (diaspora)
    branch_name_local JSON,                         -- Local name if different

    -- Legal Registration
    registration_number VARCHAR(200),
    registration_authority VARCHAR(300),
    registered_date DATE,
    registration_status ENUM('registered', 'provisional', 'suspended', 'deregistered') DEFAULT 'registered',

    -- Leadership
    current_leader_name VARCHAR(200),
    current_leader_title VARCHAR(100),              -- "Chairperson", "President", etc.
    leadership_elected_date DATE,

    -- Administrative HQ
    headquarters_address TEXT,
    headquarters_unit_id BIGINT UNSIGNED,           -- FK to geo_administrative_units
    headquarters_lat DECIMAL(10,8),
    headquarters_lng DECIMAL(11,8),

    -- Contact
    official_phone VARCHAR(50),
    official_email VARCHAR(255),
    branch_website VARCHAR(255),

    -- Electoral Participation
    participates_in_elections BOOLEAN DEFAULT TRUE,
    first_election_year YEAR,
    last_election_year YEAR,
    current_seats INT UNSIGNED DEFAULT 0,           -- Current parliamentary seats

    -- Membership Statistics
    total_members INT UNSIGNED DEFAULT 0,
    active_members INT UNSIGNED DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    established_date DATE,
    dissolved_date DATE,

    -- Metadata
    metadata JSON,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints & Indexes
    UNIQUE KEY uk_party_country (party_id, country_code),
    INDEX idx_party_id (party_id),
    INDEX idx_country_code (country_code),
    INDEX idx_branch_code (branch_code),
    INDEX idx_registration_status (registration_status),
    INDEX idx_is_active (is_active),

    FOREIGN KEY (party_id)
        REFERENCES political_parties(id)
        ON DELETE CASCADE,
    FOREIGN KEY (country_code)
        REFERENCES countries(country_code)
        ON DELETE CASCADE,
    FOREIGN KEY (headquarters_unit_id)
        REFERENCES geo_administrative_units(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Party branches - instances of parties in specific countries';

-- ============================================
-- 3.3 PARTY HISTORY EVENTS (Event Sourcing)
-- ============================================
CREATE TABLE party_history_events (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- Event Identification
    event_type ENUM(
        'founded', 'registered', 'renamed',
        'merged', 'split', 'coalition_formed', 'coalition_dissolved',
        'ideology_changed', 'leadership_changed',
        'suspended', 'reinstated', 'dissolved'
    ) NOT NULL,

    -- Primary Party
    party_id BIGINT UNSIGNED NOT NULL,
    branch_id BIGINT UNSIGNED,                      -- NULL if global event

    -- Event Details
    event_date DATE NOT NULL,
    event_description TEXT NOT NULL,

    -- Related Parties (for mergers, splits, coalitions)
    related_party_ids JSON,                         -- Array of party IDs involved

    -- Before & After State
    state_before JSON,                              -- Party state before event
    state_after JSON,                               -- Party state after event

    -- Supporting Documents
    official_document_url VARCHAR(500),
    news_sources JSON,                              -- Array of news URLs

    -- Metadata
    metadata JSON,

    -- Immutable Event Record
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id BIGINT UNSIGNED,

    -- Indexes
    INDEX idx_party_id (party_id),
    INDEX idx_branch_id (branch_id),
    INDEX idx_event_type (event_type),
    INDEX idx_event_date (event_date),

    FOREIGN KEY (party_id)
        REFERENCES political_parties(id)
        ON DELETE CASCADE,
    FOREIGN KEY (branch_id)
        REFERENCES party_branches(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Event sourcing for party history - append-only immutable log';

-- ============================================
-- 3.4 TENANTS (Party-Country Instance)
-- ============================================
CREATE TABLE tenants (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),

    -- Tenant Identification
    tenant_code VARCHAR(100) UNIQUE NOT NULL,       -- tenant_ncp_np, tenant_bjp_in
    party_branch_id BIGINT UNSIGNED NOT NULL,       -- FK to party_branches

    -- Display Names (for UI)
    display_name_en VARCHAR(300) NOT NULL,
    display_name_local JSON NOT NULL,

    -- Database Configuration
    database_name VARCHAR(100) UNIQUE NOT NULL,     -- Physical DB: tenant_ncp_np
    database_host VARCHAR(100) DEFAULT 'localhost',
    database_port SMALLINT UNSIGNED DEFAULT 3306,
    connection_string_encrypted TEXT,               -- Encrypted connection details

    -- Subscription & Billing
    subscription_plan ENUM('free', 'basic', 'professional', 'enterprise', 'custom') DEFAULT 'basic',
    subscription_status ENUM('trial', 'active', 'past_due', 'suspended', 'cancelled') DEFAULT 'trial',
    billing_cycle ENUM('monthly', 'quarterly', 'yearly', 'lifetime') DEFAULT 'yearly',

    -- Quotas & Limits
    max_members INT UNSIGNED DEFAULT 10000,
    max_admins SMALLINT UNSIGNED DEFAULT 10,
    max_storage_gb SMALLINT UNSIGNED DEFAULT 5,
    max_api_calls_per_day INT UNSIGNED DEFAULT 10000,

    -- Features Configuration
    enabled_features JSON NOT NULL,                 -- ["forums", "elections", "events", "finance"]
    feature_flags JSON,                             -- Beta features, A/B tests

    -- Customization
    primary_color CHAR(7),
    secondary_color CHAR(7),
    logo_url VARCHAR(500),
    custom_domain VARCHAR(255),                     -- ncp.org.np

    -- Localization
    default_language CHAR(2) NOT NULL,              -- Primary language
    supported_languages JSON NOT NULL,              -- ["np", "en"]
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

    -- Status & Lifecycle
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    trial_ends_at TIMESTAMP,
    activated_at TIMESTAMP,
    suspended_at TIMESTAMP,
    suspended_reason TEXT,

    -- Billing Information
    billing_email VARCHAR(255),
    billing_contact_name VARCHAR(200),
    payment_gateway_customer_id VARCHAR(100),
    next_billing_date DATE,
    last_payment_date DATE,

    -- Usage Statistics (Denormalized)
    current_member_count INT UNSIGNED DEFAULT 0,
    current_admin_count SMALLINT UNSIGNED DEFAULT 0,
    current_storage_used_mb INT UNSIGNED DEFAULT 0,
    last_stats_updated_at TIMESTAMP,

    -- Metadata
    metadata JSON,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_id BIGINT UNSIGNED,

    -- Indexes
    INDEX idx_tenant_code (tenant_code),
    INDEX idx_party_branch (party_branch_id),
    INDEX idx_subscription_status (subscription_status),
    INDEX idx_is_active (is_active),
    INDEX idx_database_name (database_name),

    FOREIGN KEY (party_branch_id)
        REFERENCES party_branches(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tenants - party-country instances with isolated databases';
```

---

## 🚀 PHASED IMPLEMENTATION PLAN

### **Phase 0: Foundation & Setup (Week 1-2)**

**Objectives:**
- Set up TDD environment
- Create DDD folder structure
- Configure multi-database connections
- Write architectural tests

**Deliverables:**
1. ✅ PHPUnit configured with 80%+ coverage requirement
2. ✅ DDD folder structure:
   ```
   app/Contexts/
   ├── Geography/
   │   ├── Domain/
   │   ├── Application/
   │   ├── Infrastructure/
   │   └── Tests/
   ├── PoliticalParty/
   │   ├── Domain/
   │   ├── Application/
   │   ├── Infrastructure/
   │   └── Tests/
   └── Tenant/
       ├── Domain/
       ├── Application/
       ├── Infrastructure/
       └── Tests/
   ```
3. ✅ Database connections configured:
   - `landlord_global_reference`
   - `platform_operational`
   - Dynamic tenant connections
4. ✅ Architectural Decision Records (ADRs) documented

**Acceptance Criteria:**
- All tests pass
- Code coverage >= 80%
- DDD structure validated against existing Platform Context
- Database connections tested

---

### **Phase 1: Country & Geography Foundation (Week 3-4)**

**Objectives:**
- Implement Country aggregate
- Create polymorphic geography tables
- Seed Nepal data
- Write comprehensive tests

**Tasks:**

**1.1 Domain Layer (TDD First!)**
```bash
# Write tests first
php artisan make:test Geography/CountryTest --unit
php artisan make:test Geography/AdministrativeUnitTest --unit

# Then implement
- ValueObjects: CountryCode, GeographicCoordinate, AdministrativeLevel
- Entities: Country, GeographyConfiguration, AdministrativeUnit
- Aggregates: Country (aggregate root)
- Specifications: ActiveCountrySpecification, SupportedCountrySpecification
- Events: CountryAdded, GeographyUpdated
- Repositories: CountryRepositoryInterface
```

**1.2 Infrastructure Layer**
```bash
# Migrations
php artisan make:migration create_countries_table
php artisan make:migration create_country_geography_configs_table
php artisan make:migration create_geo_administrative_units_table

# Eloquent Models
- Infrastructure/Models/Country.php
- Infrastructure/Models/CountryGeographyConfig.php
- Infrastructure/Models/GeoAdministrativeUnit.php

# Repositories
- Infrastructure/Repositories/EloquentCountryRepository.php
```

**1.3 Application Layer**
```bash
# Services
- Application/Services/GeographyService.php
- Application/Services/CountryManagementService.php

# Commands & Handlers
- Application/Commands/AddCountryCommand.php
- Application/Handlers/AddCountryHandler.php
```

**1.4 Seeders**
```bash
# Seed Nepal data
php artisan make:seeder NepalGeographySeeder
# 7 provinces, 77 districts, 753 local levels, ~6,743 wards
```

**Deliverables:**
- ✅ Country aggregate with full DDD layers
- ✅ Polymorphic geography table with Nepal data
- ✅ 100+ unit tests (80%+ coverage)
- ✅ Integration tests for geography queries
- ✅ Repository pattern tests

**Acceptance Criteria:**
- Can create/query countries
- Can retrieve Nepal's full geography hierarchy
- Tests pass: `php artisan test --testsuite=Geography`
- Code coverage: `php artisan test --coverage --min=80`

---

### **Phase 2: Global Taxonomies (Week 5-6)**

**Objectives:**
- Replace all ENUMs with taxonomy tables
- Create configuration-driven validation
- Implement skill categories, ideologies, electoral systems

**Tasks:**

**2.1 Taxonomy Aggregates (TDD First)**
```bash
# Domain Layer
- PoliticalIdeology (aggregate)
- ElectoralSystem (aggregate)
- SkillTaxonomy (aggregate)
- IDDocumentType (aggregate)

# Tests
php artisan make:test Taxonomy/PoliticalIdeologyTest
php artisan make:test Taxonomy/ElectoralSystemTest
```

**2.2 Infrastructure**
```bash
# Migrations
php artisan make:migration create_global_political_ideologies_table
php artisan make:migration create_global_electoral_systems_table
php artisan make:migration create_global_skill_categories_table
php artisan make:migration create_global_skills_table
php artisan make:migration create_global_id_types_table

# Seeders
php artisan make:seeder GlobalTaxonomiesSeeder
# Seed: 20+ ideologies, 10+ electoral systems, 100+ skills
```

**Deliverables:**
- ✅ Taxonomy tables replacing ENUMs
- ✅ Seed data for common taxonomies
- ✅ Validation service using taxonomy rules
- ✅ 50+ unit tests

---

### **Phase 3: Political Party Domain (Week 7-8)**

**Objectives:**
- Implement Party aggregate with event sourcing
- Create party branches
- Implement party history tracking

**Tasks:**

**3.1 Domain Layer (TDD First)**
```bash
# Aggregates
- PoliticalParty (aggregate root)
- PartyBranch (entity within Party aggregate)

# Events (Event Sourcing)
- PartyFoundedEvent
- PartyRegisteredEvent
- PartyRenamedEvent
- PartyMergedEvent
- PartySplitEvent
- PartyDissolvedEvent

# Tests
php artisan make:test PoliticalParty/PartyLifecycleTest
php artisan make:test PoliticalParty/PartyHistoryTest
```

**3.2 Event Sourcing Infrastructure**
```bash
# Migrations
php artisan make:migration create_political_parties_table
php artisan make:migration create_party_branches_table
php artisan make:migration create_party_history_events_table

# Event Store
- Infrastructure/EventStore/PartyEventStore.php
- Infrastructure/Projections/PartyProjection.php
```

**3.3 Application Services**
```bash
- Application/Services/PartyManagementService.php
- Application/Services/PartyHistoryService.php
- Application/Commands/RegisterPartyCommand.php
- Application/Commands/MergePartiesCommand.php
- Application/Handlers/RegisterPartyHandler.php
```

**Deliverables:**
- ✅ Party aggregate with event sourcing
- ✅ Party history tracking (mergers, splits)
- ✅ Tests for complex scenarios (CPN-UML + Maoist = NCP → split)
- ✅ 60+ unit tests

---

### **Phase 4: Tenant Management (Week 9-10)**

**Objectives:**
- Implement Tenant aggregate
- Create tenant provisioning service
- Implement database-per-tenant isolation

**Tasks:**

**4.1 Tenant Domain (TDD First)**
```bash
# Aggregates
- Tenant (aggregate root)
- TenantSubscription (entity)
- TenantQuotas (value object)

# Tests
php artisan make:test Tenant/TenantProvisioningTest
php artisan make:test Tenant/TenantIsolationTest
```

**4.2 Multi-Database Infrastructure**
```bash
# Migrations
php artisan make:migration create_tenants_table
php artisan make:migration create_tenant_subscriptions_table

# Dynamic Connection Manager
- Infrastructure/Database/TenantDatabaseManager.php
- Infrastructure/Database/TenantConnectionFactory.php
```

**4.3 Provisioning Service**
```bash
- Application/Services/TenantProvisioningService.php
  - createTenantDatabase()
  - seedTenantWithGeographyReferences()
  - applyTaxonomyTemplates()
  - setupInitialAdministrators()
```

**Deliverables:**
- ✅ Tenant aggregate with full lifecycle
- ✅ Automated tenant database creation
- ✅ Geography reference seeding for tenants
- ✅ 40+ integration tests

---

### **Phase 5-12: Summary (Weeks 11-24)**

**Phase 5:** Platform Administration & Security (Week 11-12)
**Phase 6:** Audit Logging & Compliance (Week 13-14)
**Phase 7:** API Layer & Documentation (Week 15-16)
**Phase 8:** Caching & Performance Optimization (Week 17-18)
**Phase 9:** Migration Tools (Legacy → New Schema) (Week 19-20)
**Phase 10:** Admin Dashboard (Week 21-22)
**Phase 11:** Integration Testing & QA (Week 23)
**Phase 12:** Production Deployment & Monitoring (Week 24)

---

## ⚠️ RISK MITIGATION

### **Risk #1: Data Migration Complexity**
**Mitigation:**
- Build migration tools in Phase 9
- Test with Nepal data first
- Gradual rollout (Nepal → Bangladesh → India)

### **Risk #2: Performance at Scale**
**Mitigation:**
- Partition geography table by country (PARTITION BY KEY)
- Implement Redis caching in Phase 8
- Use read replicas for geography queries

### **Risk #3: Backward Compatibility**
**Mitigation:**
- Maintain parallel routes during migration
- Feature flags for gradual rollout
- Comprehensive integration tests

---

## 📋 CRITICAL DECISIONS NEEDED

### **Decision #1: Tenancy Model**
**Options:**
- A) Tenant = Party (current, not scalable)
- B) Tenant = Country (better, but complex for multi-country parties)
- **C) Tenant = Party-Country Instance (RECOMMENDED)**

**Question for User:** Which model should we implement?

### **Decision #2: Database Strategy**
**Options:**
- A) 2-tier (Landlord + Tenants)
- **B) 3-tier (Landlord + Platform + Tenants) (RECOMMENDED)**

**Question for User:** Approve 3-tier approach?

### **Decision #3: Geography Storage**
**Options:**
- A) Country-specific tables (geo_provinces, geo_states)
- **B) Polymorphic table (geo_administrative_units) (RECOMMENDED)**
- C) Hybrid (universal + country-specific)

**Question for User:** Approve polymorphic approach?

### **Decision #4: Event Sourcing**
**Options:**
- A) Full event sourcing for all aggregates (complex)
- **B) Event sourcing for Party only (RECOMMENDED)**
- C) No event sourcing (loses history)

**Question for User:** Approve event sourcing for parties?

---

## 🎯 NEXT STEPS

**IMMEDIATE ACTION:**
1. **Review this document** - Identify any concerns or questions
2. **Make Critical Decisions** - Answer the 4 decision points above
3. **Approve Phase 0-1** - Once approved, I'll begin implementation
4. **Setup TDD Environment** - Configure PHPUnit, coverage tools

**DO NOT PROCEED WITH IMPLEMENTATION UNTIL:**
- ✅ User has reviewed this entire document
- ✅ Critical decisions are made
- ✅ Phase 0-1 implementation plan is approved
- ✅ User confirms understanding of 3-tier architecture

---

## 📝 DOCUMENT CHANGELOG

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-12-17 | Initial critical analysis and global plan | Senior Architect |

---

**STATUS: 🔴 AWAITING USER REVIEW & APPROVAL**

**Questions or concerns?** Please review carefully and provide feedback on:
1. Architectural approach (3-tier, polymorphic geography)
2. Phasing strategy (24 weeks)
3. Critical decisions (tenancy model, event sourcing)
4. Any missing requirements or considerations
