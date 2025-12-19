# Landlord Database Schema - Complete Implementation

## **🏢 LANDLORD DATABASE: `platform_landlord`**

### **1. Core Geographic Reference Tables**

```sql
-- ============================================
-- 1. MASTER GEOGRAPHY: NEPAL'S ADMINISTRATIVE STRUCTURE
-- ============================================

-- 1.1 Provinces (7 Fixed)
CREATE TABLE geo_provinces (
    id TINYINT UNSIGNED PRIMARY KEY, -- Static 1-7
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Official Names (Bilingual)
    name_en VARCHAR(100) NOT NULL,                    -- English name
    name_np VARCHAR(100) NOT NULL,                    -- Nepali name
    
    -- Standard Codes
    iso_code VARCHAR(10) UNIQUE NOT NULL,             -- ISO 3166-2:NP codes (NP-P1 to NP-P7)
    cbs_code VARCHAR(5) UNIQUE NOT NULL,              -- Central Bureau of Statistics code
    hdi_rank TINYINT UNSIGNED,                        -- Human Development Index rank
    
    -- Administrative Information
    capital_city_en VARCHAR(100) NOT NULL,
    capital_city_np VARCHAR(100) NOT NULL,
    total_districts TINYINT UNSIGNED NOT NULL,        -- Districts count
    total_area_sqkm DECIMAL(10,2) NOT NULL,           -- Area in square kilometers
    population_2021 BIGINT UNSIGNED,                  -- Latest census data
    
    -- Geographic Data (For Maps)
    centroid_lat DECIMAL(10,8),                       -- Latitude of centroid
    centroid_lng DECIMAL(11,8),                       -- Longitude of centroid
    bounding_box POLYGON,                             -- Spatial boundary
    
    -- Status & Metadata
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    established_date DATE,                            -- When province was formed
    official_website VARCHAR(255),
    
    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system',
    
    -- Indexes
    INDEX idx_iso_code (iso_code),
    INDEX idx_cbs_code (cbs_code),
    INDEX idx_is_active (is_active),
    INDEX idx_name_en (name_en),
    INDEX idx_name_np (name_np),
    SPATIAL INDEX idx_bounding_box (bounding_box)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Master list of Nepal''s 7 provinces - immutable reference';

-- 1.2 Districts (77 Fixed)
CREATE TABLE geo_districts (
    id SMALLINT UNSIGNED PRIMARY KEY,                 -- Static 1-77
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Hierarchy
    province_id TINYINT UNSIGNED NOT NULL,
    
    -- Official Names (Bilingual)
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    
    -- Standard Codes
    cbs_code VARCHAR(5) UNIQUE NOT NULL,              -- CBS district code
    old_code VARCHAR(10),                             -- Legacy codes if any
    
    -- Administrative Information
    headquarter_en VARCHAR(100) NOT NULL,             -- District headquarters
    headquarter_np VARCHAR(100) NOT NULL,
    total_municipalities TINYINT UNSIGNED NOT NULL,   -- Total palikas in district
    total_rural_municipalities TINYINT UNSIGNED NOT NULL,
    total_area_sqkm DECIMAL(10,2) NOT NULL,
    population_density DECIMAL(8,2),                  -- Persons per sq km
    elevation_min INT,                                -- Minimum elevation (meters)
    elevation_max INT,                                -- Maximum elevation (meters)
    
    -- Geographic Data
    centroid_lat DECIMAL(10,8),
    centroid_lng DECIMAL(11,8),
    bounding_box POLYGON,
    
    -- Economic Indicators
    literacy_rate DECIMAL(5,2),                       -- Literacy percentage
    poverty_rate DECIMAL(5,2),                        -- Poverty percentage
    main_economic_activity VARCHAR(100),              -- Agriculture, Tourism, etc.
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_remote BOOLEAN DEFAULT FALSE,                  -- Remote district flag
    is_border_district BOOLEAN DEFAULT FALSE,         -- International border district
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system',
    
    -- Indexes & Constraints
    UNIQUE KEY uk_district_province (province_id, name_en),
    INDEX idx_province (province_id),
    INDEX idx_cbs_code (cbs_code),
    INDEX idx_is_active (is_active),
    INDEX idx_name_en (name_en),
    INDEX idx_name_np (name_np),
    SPATIAL INDEX idx_bounding_box (bounding_box),
    
    FOREIGN KEY (province_id) 
        REFERENCES geo_provinces(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Master list of Nepal''s 77 districts - immutable reference';

-- 1.3 Local Levels (Municipalities & Rural Municipalities)
CREATE TABLE geo_local_levels (
    id MEDIUMINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, -- Up to 753
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Hierarchy
    district_id SMALLINT UNSIGNED NOT NULL,
    
    -- Official Names (Bilingual)
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    old_name_en VARCHAR(100),                         -- Previous name if changed
    old_name_np VARCHAR(100),
    
    -- Classification
    type ENUM(
        'Metropolitan City',          -- 6 total
        'Sub-Metropolitan City',      -- 11 total  
        'Municipality',               -- 276 total
        'Rural Municipality'          -- 460 total
    ) NOT NULL,
    
    -- Government Classification
    grade ENUM('A', 'B', 'C', 'D') NOT NULL,         -- A: Far Remote, D: Accessible
    classification_year YEAR,                         -- When classified
    
    -- Administrative Structure
    total_wards TINYINT UNSIGNED NOT NULL DEFAULT 0,
    total_wards_urban TINYINT UNSIGNED DEFAULT 0,     -- For municipalities
    total_wards_rural TINYINT UNSIGNED DEFAULT 0,     -- For rural municipalities
    
    -- Geographic Data
    area_sqkm DECIMAL(10,2),
    centroid_lat DECIMAL(10,8),
    centroid_lng DECIMAL(11,8),
    bounding_box POLYGON,
    altitude_avg INT,                                 -- Average altitude in meters
    
    -- Demographics
    total_households INT UNSIGNED,
    total_population INT UNSIGNED,
    male_population INT UNSIGNED,
    female_population INT UNSIGNED,
    
    -- Contact Information
    official_website VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    mayor_name VARCHAR(100),
    deputy_mayor_name VARCHAR(100),
    
    -- Infrastructure
    has_hospital BOOLEAN DEFAULT FALSE,
    has_college BOOLEAN DEFAULT FALSE,
    has_police_station BOOLEAN DEFAULT FALSE,
    internet_coverage ENUM('full', 'partial', 'none') DEFAULT 'partial',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    established_date DATE,
    last_election_date DATE,
    
    -- Temporal Support (for boundary changes)
    valid_from DATE DEFAULT '2015-09-20',            -- Constitution implementation
    valid_to DATE DEFAULT '9999-12-31',
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system',
    
    -- Indexes
    UNIQUE KEY uk_local_level_district (district_id, name_en, type),
    INDEX idx_district (district_id),
    INDEX idx_type (type),
    INDEX idx_grade (grade),
    INDEX idx_is_active (is_active),
    INDEX idx_name_en (name_en),
    INDEX idx_name_np (name_np),
    SPATIAL INDEX idx_bounding_box (bounding_box),
    INDEX idx_validity (valid_from, valid_to),
    
    FOREIGN KEY (district_id) 
        REFERENCES geo_districts(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Master list of all 753 local levels (Palikas) - supports temporal changes';

-- 1.4 Wards (6,743+)
CREATE TABLE geo_wards (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,       -- Up to ~6,743
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Hierarchy
    local_level_id MEDIUMINT UNSIGNED NOT NULL,
    
    -- Ward Identification
    ward_number TINYINT UNSIGNED NOT NULL,            -- 1-32 typically
    ward_code VARCHAR(20) UNIQUE NOT NULL,            -- Generated: DST-PAL-WARD
    
    -- Official Names (Bilingual)
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    traditional_name VARCHAR(100),                    -- Local traditional name
    
    -- Geographic Data
    area_sqkm DECIMAL(8,2),
    centroid_lat DECIMAL(10,8),
    centroid_lng DECIMAL(11,8),
    bounding_box POLYGON,
    altitude INT,                                     -- Average altitude
    
    -- Demographics
    total_households SMALLINT UNSIGNED,
    total_population SMALLINT UNSIGNED,
    voter_count INT UNSIGNED,                         -- Registered voters
    
    -- Infrastructure
    has_school BOOLEAN DEFAULT FALSE,
    has_health_post BOOLEAN DEFAULT FALSE,
    has_drinking_water BOOLEAN DEFAULT TRUE,
    road_access ENUM('all_weather', 'seasonal', 'foot_trail') DEFAULT 'seasonal',
    
    -- Administrative
    ward_chairperson VARCHAR(100),
    ward_office_address TEXT,
    contact_phone VARCHAR(20),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_urban_ward BOOLEAN DEFAULT FALSE,              -- Urban vs rural ward
    
    -- Temporal Support
    valid_from DATE DEFAULT '2017-01-01',             -- Local election year
    valid_to DATE DEFAULT '9999-12-31',
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system',
    
    -- Indexes
    UNIQUE KEY uk_ward_local_level (local_level_id, ward_number),
    UNIQUE KEY uk_ward_code (ward_code),
    INDEX idx_local_level (local_level_id),
    INDEX idx_ward_number (ward_number),
    INDEX idx_is_active (is_active),
    INDEX idx_name_en (name_en),
    INDEX idx_name_np (name_np),
    SPATIAL INDEX idx_bounding_box (bounding_box),
    INDEX idx_validity (valid_from, valid_to),
    
    FOREIGN KEY (local_level_id) 
        REFERENCES geo_local_levels(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Master list of all wards in Nepal - supports ward boundary changes';
```

### **2. Tenant Management & Platform Control**

```sql
-- ============================================
-- 2. TENANT REGISTRY & PLATFORM MANAGEMENT
-- ============================================

-- 2.1 Political Parties Registry (Tenants)
CREATE TABLE tenants (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Party Identity
    party_name_en VARCHAR(200) NOT NULL,              -- Official English name
    party_name_np VARCHAR(200) NOT NULL,              -- Official Nepali name
    party_acronym VARCHAR(50) NOT NULL,               -- Short form (NCP, UML, etc.)
    party_code VARCHAR(20) UNIQUE NOT NULL,           -- Internal code: PARTY-001
    
    -- Legal Registration
    registration_number VARCHAR(100) UNIQUE,          -- Election Commission registration
    registered_date DATE NOT NULL,
    registration_authority VARCHAR(100),              -- Election Commission Nepal
    legal_status ENUM('registered', 'active', 'suspended', 'dissolved') DEFAULT 'active',
    
    -- Contact Information
    headquarter_address TEXT,
    headquarter_province_id TINYINT UNSIGNED,
    headquarter_district_id SMALLINT UNSIGNED,
    official_phone VARCHAR(20),
    official_email VARCHAR(255),
    website_url VARCHAR(255),
    
    -- Branding
    logo_url VARCHAR(500),
    primary_color CHAR(7) DEFAULT '#000000',          -- Hex color for UI
    secondary_color CHAR(7) DEFAULT '#FFFFFF',
    slogan_en VARCHAR(500),
    slogan_np VARCHAR(500),
    
    -- Ideological Classification
    ideology ENUM(
        'communist', 'socialist', 'social_democrat', 
        'liberal', 'conservative', 'centrist', 
        'nationalist', 'regional', 'other'
    ) DEFAULT 'other',
    
    political_position ENUM('left', 'center_left', 'center', 'center_right', 'right') DEFAULT 'center',
    
    -- Database Configuration
    database_name VARCHAR(100) UNIQUE NOT NULL,       -- Physical DB name: tenant_ncp_001
    database_host VARCHAR(100) DEFAULT 'localhost',
    database_port SMALLINT UNSIGNED DEFAULT 3306,
    connection_string TEXT,                           -- Encrypted connection details
    
    -- Subscription & Billing
    subscription_plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'basic',
    subscription_status ENUM('trial', 'active', 'past_due', 'cancelled', 'expired') DEFAULT 'trial',
    billing_cycle ENUM('monthly', 'quarterly', 'yearly') DEFAULT 'yearly',
    
    -- Limits & Quotas
    max_members INT UNSIGNED DEFAULT 10000,
    max_admins INT UNSIGNED DEFAULT 10,
    max_storage_mb INT UNSIGNED DEFAULT 1024,         -- Storage in MB
    
    -- Payment Information
    billing_email VARCHAR(255),
    payment_gateway_customer_id VARCHAR(100),
    next_billing_date DATE,
    trial_ends_at DATE,
    
    -- Configuration
    default_language ENUM('en', 'np') DEFAULT 'np',
    timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
    date_format VARCHAR(20) DEFAULT 'Y-m-d',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,                -- Verified by platform admin
    verification_date DATE,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activated_at TIMESTAMP NULL,
    suspended_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_party_code (party_code),
    INDEX idx_registration_number (registration_number),
    INDEX idx_is_active (is_active),
    INDEX idx_subscription_status (subscription_status),
    INDEX idx_database_name (database_name),
    INDEX idx_headquarter_province (headquarter_province_id),
    INDEX idx_headquarter_district (headquarter_district_id),
    
    -- Foreign Keys to Geography
    FOREIGN KEY (headquarter_province_id) 
        REFERENCES geo_provinces(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
        
    FOREIGN KEY (headquarter_district_id) 
        REFERENCES geo_districts(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Registry of all political parties (tenants) using the platform';

-- 2.2 Tenant Administrators (Platform Access)
CREATE TABLE tenant_admins (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT UNSIGNED NOT NULL,
    
    -- User Information
    user_id BIGINT UNSIGNED NOT NULL,                -- References platform_users or external
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    
    -- Role & Permissions
    role ENUM('owner', 'admin', 'billing', 'support') DEFAULT 'admin',
    permissions JSON,                                 -- Custom permissions if needed
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_primary_contact BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP NULL,
    
    -- Security
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    login_attempts TINYINT UNSIGNED DEFAULT 0,
    locked_until TIMESTAMP NULL,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    invited_by_id BIGINT UNSIGNED NULL,
    
    -- Indexes
    UNIQUE KEY uk_tenant_email (tenant_id, email),
    UNIQUE KEY uk_tenant_user (tenant_id, user_id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_email (email),
    INDEX idx_is_active (is_active),
    
    FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
        
    FOREIGN KEY (invited_by_id) 
        REFERENCES tenant_admins(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Administrators for each tenant (political party)';

-- 2.3 Tenant Database Schema Versions
CREATE TABLE tenant_schema_versions (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT UNSIGNED NOT NULL,
    
    -- Schema Information
    schema_version VARCHAR(50) NOT NULL,              -- e.g., '1.0.0'
    migration_name VARCHAR(200) NOT NULL,
    checksum CHAR(64) NOT NULL,                       -- SHA256 of migration
    
    -- Execution Details
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INT UNSIGNED,
    executed_by VARCHAR(100) DEFAULT 'system',
    
    -- Status
    status ENUM('pending', 'success', 'failed', 'rolled_back') DEFAULT 'success',
    error_message TEXT,
    
    -- Indexes
    INDEX idx_tenant_version (tenant_id, schema_version),
    INDEX idx_executed_at (executed_at),
    INDEX idx_status (status),
    
    FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tracks schema migrations for each tenant database';
```

### **3. Platform-Wide Taxonomies & Reference Data**

```sql
-- ============================================
-- 3. GLOBAL TAXONOMIES & REFERENCE DATA
-- ============================================

-- 3.1 Global Skills Taxonomy
CREATE TABLE global_skills (
    id MEDIUMINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Skill Classification
    category ENUM(
        'Legal', 'Medical', 'Technical', 'Creative', 
        'Administrative', 'Fieldwork', 'Education', 
        'Finance', 'Engineering', 'Agriculture',
        'Communication', 'Leadership', 'Other'
    ) NOT NULL DEFAULT 'Other',
    
    subcategory VARCHAR(100),                         -- e.g., 'Medical' -> 'Doctor', 'Nurse'
    
    -- Skill Names (Bilingual)
    skill_name_en VARCHAR(100) NOT NULL,
    skill_name_np VARCHAR(100) NOT NULL,
    
    -- Description
    description_en TEXT,
    description_np TEXT,
    
    -- Skill Metadata
    proficiency_levels JSON DEFAULT '["Beginner", "Intermediate", "Expert"]',
    is_certification_required BOOLEAN DEFAULT FALSE,
    avg_training_hours SMALLINT UNSIGNED,             -- Average training hours needed
    
    -- For Political Context
    is_politically_relevant BOOLEAN DEFAULT TRUE,     -- Relevant for political work
    election_cycle_importance ENUM('high', 'medium', 'low') DEFAULT 'medium',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_system_skill BOOLEAN DEFAULT FALSE,            -- System-defined, cannot delete
    display_order SMALLINT UNSIGNED DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    
    -- Indexes
    UNIQUE KEY uk_skill_name_en (skill_name_en),
    INDEX idx_category (category),
    INDEX idx_subcategory (subcategory),
    INDEX idx_is_active (is_active),
    INDEX idx_display_order (display_order),
    FULLTEXT idx_skill_search (skill_name_en, skill_name_np, description_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Global skills taxonomy - referenced by all tenants';

-- 3.2 ID Document Types
CREATE TABLE global_id_types (
    id TINYINT UNSIGNED PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Document Information
    name_en VARCHAR(100) NOT NULL,                    -- e.g., 'Citizenship Certificate'
    name_np VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,                 -- e.g., 'CITIZENSHIP'
    
    -- Validation Rules
    validation_regex VARCHAR(200),                    -- Regex for number validation
    min_length TINYINT UNSIGNED,
    max_length TINYINT UNSIGNED,
    country_scope VARCHAR(50) DEFAULT 'NP',           -- Which countries use this
    
    -- Legal Status
    is_government_issued BOOLEAN DEFAULT TRUE,
    is_required_for_membership BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    display_order TINYINT UNSIGNED DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_code (code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Global ID document types - referenced by all tenants';

-- 3.3 Membership Types Template
CREATE TABLE global_membership_types (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Type Information
    code VARCHAR(50) UNIQUE NOT NULL,                 -- e.g., 'REGULAR', 'YOUTH', 'LIFETIME'
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    description_en TEXT,
    description_np TEXT,
    
    -- Configuration Template
    config_template JSON NOT NULL,                    -- Template for tenant customization
    
    -- Default Values (Tenants can override)
    default_fee_amount DECIMAL(10,2) DEFAULT 0.00,
    default_duration_months INT,                      -- NULL for lifetime
    default_can_vote BOOLEAN DEFAULT TRUE,
    default_can_hold_office BOOLEAN DEFAULT FALSE,
    default_min_age TINYINT UNSIGNED DEFAULT 16,
    default_max_age TINYINT UNSIGNED,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_system_type BOOLEAN DEFAULT FALSE,             -- Required types
    display_order SMALLINT UNSIGNED DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_code (code),
    INDEX idx_is_active (is_active),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Global membership types template - tenants can customize';

-- 3.4 Forum Categories Template
CREATE TABLE global_forum_categories (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Category Information
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    description_en TEXT,
    description_np TEXT,
    icon VARCHAR(50),                                 -- FontAwesome icon class
    
    -- Configuration Template
    config_template JSON NOT NULL,                    -- Template for tenant customization
    
    -- Default Permissions
    default_min_tier ENUM('general', 'active', 'cadre') DEFAULT 'general',
    default_can_post ENUM('all', 'verified', 'active_only') DEFAULT 'verified',
    default_can_view ENUM('all', 'members', 'verified') DEFAULT 'members',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_system_category BOOLEAN DEFAULT FALSE,
    display_order SMALLINT UNSIGNED DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_name_en (name_en),
    INDEX idx_is_active (is_active),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Global forum categories template - tenants can customize';
```

### **4. Platform Administration & Security**

```sql
-- ============================================
-- 4. PLATFORM ADMINISTRATION & SECURITY
-- ============================================

-- 4.1 Platform Administrators
CREATE TABLE platform_admins (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- User Information
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    
    -- Authentication
    password_hash VARCHAR(255) NOT NULL,
    password_changed_at TIMESTAMP NULL,
    remember_token VARCHAR(100),
    
    -- Role & Permissions
    role ENUM('super_admin', 'admin', 'support', 'auditor') DEFAULT 'admin',
    permissions JSON,                                 -- Custom permissions
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP NULL,
    phone_verified_at TIMESTAMP NULL,
    
    -- Security
    two_factor_secret VARCHAR(255),
    two_factor_recovery_codes TEXT,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    failed_login_attempts TINYINT UNSIGNED DEFAULT 0,
    locked_until TIMESTAMP NULL,
    must_change_password BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP NULL,
    last_login_ip VARCHAR(45),
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_id BIGINT UNSIGNED NULL,
    
    -- Indexes
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_is_active (is_active),
    INDEX idx_role (role),
    
    FOREIGN KEY (created_by_id) 
        REFERENCES platform_admins(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Platform administrators (super users)';

-- 4.2 Platform Audit Logs
CREATE TABLE platform_audit_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Actor Information
    actor_type ENUM('platform_admin', 'tenant_admin', 'system', 'api') NOT NULL,
    actor_id BIGINT UNSIGNED NULL,                    -- ID of the actor
    actor_name VARCHAR(200),                          -- Cached name for performance
    
    -- Target Information
    tenant_id BIGINT UNSIGNED NULL,                   -- Which tenant was affected
    target_type VARCHAR(100),                         -- e.g., 'Tenant', 'GeoProvince'
    target_id BIGINT UNSIGNED NULL,
    target_name VARCHAR(200),
    
    -- Action Details
    event_type VARCHAR(100) NOT NULL,                 -- e.g., 'tenant.created', 'geo.updated'
    event_subtype VARCHAR(100),
    description TEXT NOT NULL,
    
    -- Change Data
    old_values JSON,                                  -- Before change (for updates)
    new_values JSON,                                  -- After change (for updates)
    changed_fields JSON,                              -- Which fields changed
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),                          -- For correlating logs
    correlation_id VARCHAR(100),
    
    -- Location
    country_code CHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    
    -- Severity
    severity ENUM('debug', 'info', 'warning', 'error', 'critical') DEFAULT 'info',
    
    -- Metadata
    tags JSON,                                        -- Custom tags for filtering
    metadata JSON,
    
    -- Timestamp with Partitioning Support
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes (Optimized for common queries)
    INDEX idx_actor (actor_type, actor_id),
    INDEX idx_target (target_type, target_id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    INDEX idx_severity (severity),
    INDEX idx_request_id (request_id),
    INDEX idx_correlation_id (correlation_id),
    
    FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION p_future VALUES LESS THAN MAXVALUE
) COMMENT='Platform-wide audit log - immutable record of all changes';

-- 4.3 Platform Settings
CREATE TABLE platform_settings (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    
    -- Setting Identification
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_group VARCHAR(100) DEFAULT 'general',
    setting_category VARCHAR(50),
    
    -- Value
    setting_value TEXT,
    setting_type ENUM('string', 'boolean', 'integer', 'float', 'json', 'array', 'datetime') DEFAULT 'string',
    
    -- Access Control
    is_public BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    access_level ENUM('public', 'tenant', 'admin', 'system') DEFAULT 'admin',
    
    -- Validation
    validation_rules JSON,
    default_value TEXT,
    allowed_values JSON,
    
    -- Metadata
    description TEXT,
    help_text TEXT,
    display_order INT DEFAULT 0,
    is_readonly BOOLEAN DEFAULT FALSE,                -- Cannot be changed via UI
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system',
    
    -- Indexes
    INDEX idx_setting_key (setting_key),
    INDEX idx_setting_group (setting_group),
    INDEX idx_access_level (access_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Platform-wide configuration settings';

-- 4.4 API Keys & Integrations
CREATE TABLE platform_api_keys (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Key Information
    name VARCHAR(200) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,              -- Generated API key
    api_secret_hash VARCHAR(255) NOT NULL,            -- Hashed secret
    tenant_id BIGINT UNSIGNED NULL,                   -- If scoped to tenant
    
    -- Permissions
    permissions JSON NOT NULL,
    allowed_ips JSON,                                 -- IP whitelist
    rate_limit_per_minute INT UNSIGNED DEFAULT 60,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_used_at TIMESTAMP NULL,
    total_requests BIGINT UNSIGNED DEFAULT 0,
    
    -- Validity Period
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_api_key (api_key),
    INDEX idx_tenant (tenant_id),
    INDEX idx_is_active (is_active),
    INDEX idx_expires_at (expires_at),
    
    FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Platform API keys for integrations';
```

### **5. Initial Data Seeding Scripts**

```sql
-- ============================================
-- 5. INITIAL DATA SEEDING
-- ============================================

-- 5.1 Insert Provinces (7 Provinces of Nepal)
INSERT INTO geo_provinces 
(id, iso_code, cbs_code, name_en, name_np, capital_city_en, capital_city_np, total_districts, total_area_sqkm, population_2021, is_active) 
VALUES
(1, 'NP-P1', 'P1', 'Koshi Province', 'कोशी प्रदेश', 'Biratnagar', 'विराटनगर', 14, 25905, 4961434, TRUE),
(2, 'NP-P2', 'P2', 'Madhesh Province', 'मधेश प्रदेश', 'Janakpur', 'जनकपुर', 8, 9661, 6141485, TRUE),
(3, 'NP-P3', 'P3', 'Bagmati Province', 'बागमती प्रदेश', 'Hetauda', 'हेटौडा', 13, 20300, 6141485, TRUE),
(4, 'NP-P4', 'P4', 'Gandaki Province', 'गण्डकी प्रदेश', 'Pokhara', 'पोखरा', 11, 21504, 2466574, TRUE),
(5, 'NP-P5', 'P5', 'Lumbini Province', 'लुम्बिनी प्रदेश', 'Deukhuri', 'देउखुरी', 12, 22288, 5122257, TRUE),
(6, 'NP-P6', 'P6', 'Karnali Province', 'कर्णाली प्रदेश', 'Birendranagar', 'वीरेन्द्रनगर', 10, 27984, 1672460, TRUE),
(7, 'NP-P7', 'P7', 'Sudurpashchim Province', 'सुदूरपश्चिम प्रदेश', 'Godawari', 'गोदावरी', 9, 19915, 2694733, TRUE);

-- 5.2 Insert ID Types
INSERT INTO global_id_types 
(id, code, name_en, name_np, validation_regex, min_length, max_length, is_required_for_membership) 
VALUES
(1, 'CITIZENSHIP', 'Citizenship Certificate', 'नागरिकता प्रमाणपत्र', '^[0-9]{1,2}-[0-9]{2}-[0-9]{6}$', 10, 15, TRUE),
(2, 'PASSPORT', 'Passport', 'राहदानी', '^[A-Z][0-9]{7}$', 8, 9, FALSE),
(3, 'DRIVING_LICENSE', 'Driving License', 'चालक अनुमतिपत्र', '^[0-9]{9}$', 9, 10, FALSE),
(4, 'VOTER_ID', 'Voter ID', 'मतदाता परिचयपत्र', '^[0-9]{10}$', 10, 12, FALSE);

-- 5.3 Insert Global Skills
INSERT INTO global_skills 
(category, skill_name_en, skill_name_np, description_en, is_politically_relevant) 
VALUES
('Legal', 'Constitutional Law', 'संवैधानिक कानून', 'Expertise in constitutional matters', TRUE),
('Medical', 'General Medicine', 'सामान्य चिकित्सा', 'General medical knowledge', TRUE),
('Technical', 'Software Development', 'सफ्टवेयर विकास', 'Programming and software skills', TRUE),
('Communication', 'Public Speaking', 'सार्वजनिक बोलचाल', 'Effective public speaking', TRUE),
('Leadership', 'Team Management', 'टोली व्यवस्थापन', 'Managing teams effectively', TRUE),
('Fieldwork', 'Community Mobilization', 'समुदाय संचालन', 'Mobilizing community members', TRUE);

-- 5.4 Insert Platform Settings
INSERT INTO platform_settings 
(setting_key, setting_value, setting_group, description, access_level) 
VALUES
-- General Platform
('platform_name', 'Political Party Digitalization Platform', 'general', 'Platform display name', 'public'),
('platform_version', '1.0.0', 'general', 'Current platform version', 'public'),
('support_email', 'support@partyplatform.gov.np', 'general', 'Platform support email', 'public'),

-- Tenant Configuration
('tenant_default_plan', 'basic', 'tenants', 'Default subscription plan for new tenants', 'admin'),
('tenant_trial_days', '30', 'tenants', 'Default trial period in days', 'admin'),
('max_tenants_per_host', '100', 'tenants', 'Maximum tenants per database host', 'system'),

-- Geography
('country_name', 'Nepal', 'geography', 'Primary country name', 'public'),
('default_timezone', 'Asia/Kathmandu', 'geography', 'Default timezone', 'public'),

-- Security
('password_min_length', '8', 'security', 'Minimum password length', 'public'),
('max_login_attempts', '5', 'security', 'Maximum failed login attempts', 'admin'),
('session_timeout_minutes', '30', 'security', 'Session timeout in minutes', 'admin'),

-- Features
('enable_forum', 'true', 'features', 'Enable forum module', 'admin'),
('enable_election_module', 'false', 'features', 'Enable election module', 'admin'),
('enable_payment_gateway', 'true', 'features', 'Enable payment processing', 'admin');

-- 5.5 Create Super Admin (Change password after first login)
INSERT INTO platform_admins 
(username, email, full_name, password_hash, role, is_super_admin, email_verified_at) 
VALUES
('superadmin', 'admin@partyplatform.gov.np', 'Super Administrator', 
 '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password
 'super_admin', TRUE, NOW());
```

### **6. Database Views & Helper Functions**

```sql
-- ============================================
-- 6. DATABASE VIEWS & HELPER FUNCTIONS
-- ============================================

-- 6.1 Geographic Hierarchy View
CREATE VIEW vw_geographic_hierarchy AS
SELECT 
    p.id AS province_id,
    p.name_en AS province_name_en,
    p.name_np AS province_name_np,
    d.id AS district_id,
    d.name_en AS district_name_en,
    d.name_np AS district_name_np,
    ll.id AS local_level_id,
    ll.name_en AS local_level_name_en,
    ll.name_np AS local_level_name_np,
    ll.type AS local_level_type,
    w.id AS ward_id,
    w.ward_number,
    w.name_en AS ward_name_en,
    w.name_np AS ward_name_np,
    
    -- Generated Codes
    CONCAT(p.iso_code, '-', d.cbs_code) AS province_district_code,
    CONCAT(p.iso_code, '-', d.cbs_code, '-', ll.id) AS full_geo_code
    
FROM geo_provinces p
JOIN geo_districts d ON d.province_id = p.id
JOIN geo_local_levels ll ON ll.district_id = d.id
JOIN geo_wards w ON w.local_level_id = ll.id
WHERE p.is_active = TRUE 
    AND d.is_active = TRUE 
    AND ll.is_active = TRUE 
    AND w.is_active = TRUE;

-- 6.2 Tenant Summary View
CREATE VIEW vw_tenant_summary AS
SELECT 
    t.id,
    t.party_name_en,
    t.party_name_np,
    t.party_acronym,
    t.subscription_plan,
    t.subscription_status,
    t.max_members,
    t.database_name,
    t.is_active,
    t.created_at,
    t.activated_at,
    
    -- Counts (if we add tenant_stats table later)
    0 AS total_members,
    0 AS active_members,
    
    -- Geography
    p.name_en AS headquarter_province,
    d.name_en AS headquarter_district
    
FROM tenants t
LEFT JOIN geo_provinces p ON t.headquarter_province_id = p.id
LEFT JOIN geo_districts d ON t.headquarter_district_id = d.id;

-- 6.3 Function: Generate Ward Code
DELIMITER //

CREATE FUNCTION fn_generate_ward_code(
    p_province_iso VARCHAR(10),
    p_district_cbs VARCHAR(5),
    p_local_level_id MEDIUMINT UNSIGNED,
    p_ward_number TINYINT UNSIGNED
) RETURNS VARCHAR(20) DETERMINISTIC
BEGIN
    RETURN CONCAT(p_province_iso, '-', p_district_cbs, '-', 
                  LPAD(p_local_level_id, 4, '0'), '-W', 
                  LPAD(p_ward_number, 2, '0'));
END //

DELIMITER ;

-- 6.4 Function: Validate Citizenship Number
DELIMITER //

CREATE FUNCTION fn_validate_citizenship(
    p_citizenship_number VARCHAR(20)
) RETURNS BOOLEAN DETERMINISTIC
BEGIN
    -- Nepal citizenship number format: XX-XX-XXXXXX
    -- Where first XX is district code (01-77)
    -- Second XX is registration office code
    -- Last XXXXXX is serial number
    
    DECLARE v_is_valid BOOLEAN DEFAULT FALSE;
    
    IF p_citizenship_number REGEXP '^[0-9]{1,2}-[0-9]{2}-[0-9]{6}$' THEN
        SET v_is_valid = TRUE;
    END IF;
    
    RETURN v_is_valid;
END //

DELIMITER ;

-- 6.5 Procedure: Get Geographic Ancestors
DELIMITER //

CREATE PROCEDURE sp_get_geographic_ancestors(
    IN p_ward_id INT UNSIGNED
)
BEGIN
    SELECT 
        'ward' AS level,
        w.id AS entity_id,
        w.name_en,
        w.name_np,
        w.ward_number
    FROM geo_wards w
    WHERE w.id = p_ward_id
    
    UNION ALL
    
    SELECT 
        'local_level' AS level,
        ll.id AS entity_id,
        ll.name_en,
        ll.name_np,
        NULL AS ward_number
    FROM geo_wards w
    JOIN geo_local_levels ll ON w.local_level_id = ll.id
    WHERE w.id = p_ward_id
    
    UNION ALL
    
    SELECT 
        'district' AS level,
        d.id AS entity_id,
        d.name_en,
        d.name_np,
        NULL AS ward_number
    FROM geo_wards w
    JOIN geo_local_levels ll ON w.local_level_id = ll.id
    JOIN geo_districts d ON ll.district_id = d.id
    WHERE w.id = p_ward_id
    
    UNION ALL
    
    SELECT 
        'province' AS level,
        p.id AS entity_id,
        p.name_en,
        p.name_np,
        NULL AS ward_number
    FROM geo_wards w
    JOIN geo_local_levels ll ON w.local_level_id = ll.id
    JOIN geo_districts d ON ll.district_id = d.id
    JOIN geo_provinces p ON d.province_id = p.id
    WHERE w.id = p_ward_id;
END //

DELIMITER ;
```

### **7. Database Security & Maintenance**

```sql
-- ============================================
-- 7. SECURITY & MAINTENANCE
-- ============================================

-- 7.1 Create Database Users (Execute separately)
/*
-- Platform Admin User (Full access to landlord DB)
CREATE USER 'platform_admin'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON platform_landlord.* TO 'platform_admin'@'localhost';
GRANT CREATE USER ON *.* TO 'platform_admin'@'localhost';

-- Application User (Limited access)
CREATE USER 'platform_app'@'localhost' IDENTIFIED BY 'AppPassword456!';
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_landlord.* TO 'platform_app'@'localhost';
GRANT EXECUTE ON PROCEDURE platform_landlord.* TO 'platform_app'@'localhost';

-- Read-only User for Reporting
CREATE USER 'platform_report'@'localhost' IDENTIFIED BY 'ReportPassword789!';
GRANT SELECT ON platform_landlord.* TO 'platform_report'@'localhost';

-- Tenant Database User Template
CREATE USER 'tenant_template'@'localhost' IDENTIFIED BY 'TenantTemplatePassword!';
-- Will be granted permissions when tenant DB is created
*/

-- 7.2 Event: Cleanup Old Audit Logs
DELIMITER //

CREATE EVENT evt_cleanup_audit_logs
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP + INTERVAL 1 MONTH
DO
BEGIN
    -- Archive logs older than 2 years
    CREATE TABLE IF NOT EXISTS platform_audit_logs_archive LIKE platform_audit_logs;
    
    INSERT INTO platform_audit_logs_archive
    SELECT * FROM platform_audit_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR);
    
    DELETE FROM platform_audit_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR);
    
    -- Log the cleanup
    INSERT INTO platform_audit_logs 
    (actor_type, actor_name, event_type, description, severity)
    VALUES ('system', 'cleanup_job', 'audit.cleanup', 
            'Cleaned up audit logs older than 2 years', 'info');
END //

DELIMITER ;

-- 7.3 Event: Update Tenant Statistics
DELIMITER //

CREATE EVENT evt_update_tenant_stats
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
DO
BEGIN
    -- This would update tenant statistics from their databases
    -- For now, just log that it ran
    INSERT INTO platform_audit_logs 
    (actor_type, actor_name, event_type, description, severity)
    VALUES ('system', 'stats_job', 'stats.update', 
            'Daily tenant statistics update job ran', 'info');
END //

DELIMITER ;
```

---

## **📦 COMPLETE IMPLEMENTATION SCRIPT**

Save this as `landlord_schema.sql`:

```sql
-- Landlord Database Schema v1.0.0
-- Platform: Political Party Digitalization System
-- Author: System Architect
-- Created: 2024

-- WARNING: Execute in order
-- 1. Create database
-- 2. Create tables (1-4)
-- 3. Insert seed data (5)
-- 4. Create views & functions (6)
-- 5. Setup security & events (7)

-- ============================================
-- STEP 0: CREATE DATABASE
-- ============================================
CREATE DATABASE IF NOT EXISTS platform_landlord 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE platform_landlord;

-- ============================================
-- STEP 1: CREATE ALL TABLES (Sections 1-4 above)
-- ============================================
-- Copy all CREATE TABLE statements from sections 1-4 here

-- ============================================
-- STEP 2: INSERT SEED DATA (Section 5 above)
-- ============================================
-- Copy all INSERT statements from section 5 here

-- ============================================
-- STEP 3: CREATE VIEWS & FUNCTIONS (Section 6)
-- ============================================
-- Copy all CREATE VIEW and CREATE FUNCTION statements

-- ============================================
-- STEP 4: SETUP SECURITY & MAINTENANCE
-- ============================================
-- Copy events and security setup

-- ============================================
-- STEP 5: VERIFICATION QUERIES
-- ============================================
SELECT 'Database created successfully' AS message;

-- Verify counts
SELECT 
    (SELECT COUNT(*) FROM geo_provinces) AS province_count,
    (SELECT COUNT(*) FROM geo_districts) AS district_count,
    (SELECT COUNT(*) FROM geo_local_levels) AS local_level_count,
    (SELECT COUNT(*) FROM geo_wards) AS ward_count,
    (SELECT COUNT(*) FROM global_skills) AS skill_count,
    (SELECT COUNT(*) FROM platform_settings) AS setting_count;

-- Test function
SELECT fn_validate_citizenship('01-01-123456') AS valid_citizenship;
```

---

## **🔧 POST-INSTALLATION CHECKLIST**

```bash
# After running the SQL script:
1. ✅ Verify database was created: `SHOW DATABASES LIKE 'platform_landlord';`
2. ✅ Verify tables exist: `SHOW TABLES FROM platform_landlord;`
3. ✅ Verify province data: `SELECT * FROM geo_provinces ORDER BY id;`
4. ✅ Verify platform admin can login: `SELECT username FROM platform_admins;`
5. ✅ Test geographic view: `SELECT * FROM vw_geographic_hierarchy LIMIT 5;`
6. ✅ Backup the schema: `mysqldump -d platform_landlord > landlord_schema_backup.sql`
7. ✅ Create database users (see section 7.1)
8. ✅ Enable event scheduler: `SET GLOBAL event_scheduler = ON;`
```

## **🎯 NEXT STEPS**

Now that the Landlord database is complete:

1. **Create Tenant Database Template** - The empty schema that will be cloned for each party
2. **Build Tenant Onboarding System** - Automated database creation and seeding
3. **Implement Laravel Multi-tenancy** - Configure Spatie package with our schema
4. **Build Platform Admin Dashboard** - To manage tenants and view platform analytics

**Ready for the Tenant Database Template?** I can provide the complete schema for tenant databases that references this landlord data.