# 🏗️ **UNIVERSAL POLITICAL PARTY DATABASE SCHEMA**

## 📊 **COMPLETE UNIVERSAL TENANT SCHEMA**

### **1. CORE IDENTITY & AUTHENTICATION**

```sql
-- ============================================
-- 1. USERS (Universal Identity)
-- ============================================
CREATE TABLE users (
    -- Primary Identification
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(300) GENERATED ALWAYS AS (
        CONCAT(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name)
    ) STORED,
    
    -- Identity Documents (Universal)
    national_id_type ENUM('citizenship', 'passport', 'driving_license', 'voter_id', 'other') NULL,
    national_id_number VARCHAR(50) NULL UNIQUE,
    national_id_issued_date DATE NULL,
    national_id_issued_location VARCHAR(100) NULL,
    
    -- Biographic Information
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL,
    date_of_birth DATE NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown') NULL,
    marital_status ENUM('single', 'married', 'divorced', 'widowed', 'separated') NULL,
    
    -- Contact Information
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    phone_country_code VARCHAR(5) DEFAULT '+977',
    alternate_phone VARCHAR(20) NULL,
    
    -- Address Information (Universal Structure)
    temporary_address TEXT NULL,
    permanent_address TEXT NULL,
    city_municipality VARCHAR(100) NULL,
    district VARCHAR(100) NOT NULL,
    province ENUM(
        'Province 1', 
        'Province 2', 
        'Bagmati', 
        'Gandaki', 
        'Lumbini', 
        'Karnali', 
        'Sudurpashchim'
    ) NOT NULL,
    country VARCHAR(50) DEFAULT 'Nepal',
    postal_code VARCHAR(20) NULL,
    
    -- Education & Profession
    education_level ENUM(
        'illiterate',
        'primary', 
        'secondary', 
        'higher_secondary',
        'bachelors', 
        'masters', 
        'phd', 
        'other'
    ) NULL,
    profession VARCHAR(100) NULL,
    employment_status ENUM('employed', 'unemployed', 'student', 'self_employed', 'retired') NULL,
    
    -- Authentication & Security
    password_hash VARCHAR(255) NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP NULL,
    phone_verified_at TIMESTAMP NULL,
    
    -- Security & Lockout
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    must_change_password BOOLEAN DEFAULT FALSE,
    last_password_changed_at TIMESTAMP NULL,
    last_login_at TIMESTAMP NULL,
    
    -- Status Management
    status ENUM('active', 'inactive', 'suspended', 'archived') DEFAULT 'active',
    
    -- Documents & Media
    profile_photo_path VARCHAR(500) NULL,
    id_document_front_path VARCHAR(500) NULL,
    id_document_back_path VARCHAR(500) NULL,
    
    -- Metadata & Audit
    metadata JSON NULL COMMENT 'Party-specific custom fields',
    tenant_id BIGINT UNSIGNED NOT NULL COMMENT 'Denormalized from landlord',
    created_by_id BIGINT UNSIGNED NULL,
    updated_by_id BIGINT UNSIGNED NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_status (status),
    INDEX idx_district (district),
    INDEX idx_province (province),
    INDEX idx_national_id (national_id_number),
    INDEX idx_tenant (tenant_id),
    INDEX idx_full_name (full_name),
    FULLTEXT idx_name_search (first_name, middle_name, last_name),
    
    -- Constraints
    CHECK (date_of_birth <= CURRENT_DATE),
    CHECK (phone REGEXP '^\\+[0-9]{1,4}-[0-9]{6,15}$'),
    CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC 
COMMENT='Core identity table for all users (members, staff, supporters)';

-- ============================================
-- 2. PASSWORD_RESETS
-- ============================================
CREATE TABLE password_resets (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- ============================================
-- 3. AUTHENTICATION_TOKENS
-- ============================================
CREATE TABLE authentication_tokens (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    abilities TEXT NULL,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    device_info JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_tokenable (tokenable_type, tokenable_id),
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;
```

### **2. ORGANIZATIONAL STRUCTURE (Universal)**

```sql
-- ============================================
-- 4. ORGANIZATIONAL_UNIT_TYPES
-- ============================================
CREATE TABLE organizational_unit_types (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    
    -- Hierarchical Properties
    hierarchy_level INT NOT NULL COMMENT '0=root, 1=top level, etc.',
    can_have_members BOOLEAN DEFAULT FALSE,
    can_conduct_elections BOOLEAN DEFAULT FALSE,
    can_manage_finances BOOLEAN DEFAULT FALSE,
    can_form_committees BOOLEAN DEFAULT FALSE,
    
    -- Universal Political Structures
    is_political_unit BOOLEAN DEFAULT TRUE,
    is_administrative_unit BOOLEAN DEFAULT FALSE,
    is_functional_unit BOOLEAN DEFAULT FALSE,
    
    -- Configuration
    max_members INT NULL,
    min_members INT NULL,
    default_roles JSON NULL COMMENT 'Default roles for this unit type',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_system_type BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    
    -- Metadata
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_hierarchy (hierarchy_level),
    INDEX idx_code (code),
    INDEX idx_is_political (is_political_unit)
) ENGINE=InnoDB;

-- Universal Political Unit Types
INSERT INTO organizational_unit_types (code, name, hierarchy_level, can_have_members, is_system_type) VALUES
-- National Level
('national_committee', 'National Committee', 0, FALSE, TRUE),
('central_committee', 'Central Committee', 0, FALSE, TRUE),
('presidium', 'Presidium', 0, FALSE, TRUE),

-- Regional Level
('provincial_committee', 'Provincial Committee', 1, FALSE, TRUE),
('state_committee', 'State Committee', 1, FALSE, TRUE),

-- District Level
('district_committee', 'District Committee', 2, TRUE, TRUE),
('regional_committee', 'Regional Committee', 2, TRUE, FALSE),

-- Local Level
('municipality_committee', 'Municipality Committee', 3, TRUE, TRUE),
('metropolitan_committee', 'Metropolitan Committee', 3, TRUE, FALSE),
('rural_municipality_committee', 'Rural Municipality Committee', 3, TRUE, TRUE),

-- Constituency Level
('constituency_committee', 'Constituency Committee', 4, TRUE, TRUE),
('electoral_area_committee', 'Electoral Area Committee', 4, TRUE, FALSE),

-- Ward Level
('ward_committee', 'Ward Committee', 5, TRUE, TRUE),
('local_committee', 'Local Committee', 5, TRUE, FALSE),

-- Cell/Unit Level
('cell_committee', 'Cell Committee', 6, TRUE, TRUE),
('unit_committee', 'Unit Committee', 6, TRUE, FALSE),
('tole_committee', 'Tole Committee', 6, TRUE, FALSE),

-- Functional Wings
('youth_wing', 'Youth Wing', 1, TRUE, TRUE),
('student_wing', 'Student Wing', 1, TRUE, TRUE),
('women_wing', 'Women Wing', 1, TRUE, TRUE),
('labor_wing', 'Labor Wing', 1, TRUE, FALSE),
('farmers_wing', 'Farmers Wing', 1, TRUE, FALSE),

-- Departments
('organization_department', 'Organization Department', 2, FALSE, FALSE),
('publicity_department', 'Publicity Department', 2, FALSE, FALSE),
('finance_department', 'Finance Department', 2, FALSE, FALSE),
('international_department', 'International Department', 2, FALSE, FALSE);

-- ============================================
-- 5. ORGANIZATIONAL_UNITS
-- ============================================
CREATE TABLE organizational_units (
    -- Primary Identification
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Hierarchy Implementation (Dual Model)
    parent_id BIGINT UNSIGNED NULL,
    lft INT NULL,
    rgt INT NULL,
    depth INT DEFAULT 0,
    materialized_path VARCHAR(500) NULL COMMENT 'For fast hierarchical queries',
    
    -- Type & Identification
    unit_type_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(50) NOT NULL COMMENT 'Unique identifier within parent',
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(50) NULL,
    description TEXT NULL,
    
    -- Geographic Location
    province ENUM(
        'Province 1', 
        'Province 2', 
        'Bagmati', 
        'Gandaki', 
        'Lumbini', 
        'Karnali', 
        'Sudurpashchim'
    ) NOT NULL,
    district VARCHAR(100) NOT NULL,
    municipality VARCHAR(100) NULL,
    ward_number INT NULL,
    constituency_number VARCHAR(20) NULL,
    geo_coordinates POINT NULL COMMENT 'Latitude/Longitude for maps',
    
    -- Leadership (Multiple leaders supported)
    president_id BIGINT UNSIGNED NULL,
    vice_president_id BIGINT UNSIGNED NULL,
    general_secretary_id BIGINT UNSIGNED NULL,
    secretary_id BIGINT UNSIGNED NULL,
    treasurer_id BIGINT UNSIGNED NULL,
    
    -- Contact Information
    office_address TEXT NULL,
    office_phone VARCHAR(20) NULL,
    office_email VARCHAR(255) NULL,
    website_url VARCHAR(500) NULL,
    
    -- Statistics (Cached)
    total_members INT DEFAULT 0,
    active_members INT DEFAULT 0,
    male_members INT DEFAULT 0,
    female_members INT DEFAULT 0,
    youth_members INT DEFAULT 0,
    
    -- Configuration
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT TRUE,
    formation_date DATE NULL,
    dissolution_date DATE NULL,
    
    -- Meeting Information
    meeting_schedule JSON NULL COMMENT 'Regular meeting days/times',
    meeting_location VARCHAR(500) NULL,
    
    -- Metadata
    metadata JSON NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    created_by_id BIGINT UNSIGNED NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activated_at TIMESTAMP NULL,
    
    -- Indexes (Critical for Performance)
    INDEX idx_parent_id (parent_id),
    INDEX idx_lft_rgt (lft, rgt),
    INDEX idx_depth (depth),
    INDEX idx_unit_type (unit_type_id),
    INDEX idx_province (province),
    INDEX idx_district (district),
    INDEX idx_municipality (municipality),
    INDEX idx_path (materialized_path(100)),
    INDEX idx_is_active (is_active),
    UNIQUE INDEX idx_parent_code (parent_id, code),
    
    -- Foreign Keys
    FOREIGN KEY (parent_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_type_id) REFERENCES organizational_unit_types(id),
    FOREIGN KEY (president_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (vice_president_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (general_secretary_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (secretary_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (treasurer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC 
COMMENT='Universal political party organizational structure';

-- ============================================
-- 6. UNIT_CONTACTS (Additional Contact Persons)
-- ============================================
CREATE TABLE unit_contacts (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    unit_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    contact_type ENUM(
        'information_officer',
        'media_coordinator', 
        'training_coordinator',
        'event_coordinator',
        'membership_coordinator',
        'finance_coordinator',
        'legal_advisor',
        'general'
    ) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_unit_user_type (unit_id, user_id, contact_type),
    INDEX idx_unit_id (unit_id),
    INDEX idx_user_id (user_id),
    
    FOREIGN KEY (unit_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 7. UNIT_HIERARCHY_MAPPINGS (For Flexible Structures)
-- ============================================
CREATE TABLE unit_hierarchy_mappings (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    parent_unit_id BIGINT UNSIGNED NOT NULL,
    child_unit_id BIGINT UNSIGNED NOT NULL,
    relationship_type ENUM(
        'administrative', 
        'geographic', 
        'functional', 
        'reporting',
        'coordination'
    ) DEFAULT 'administrative',
    hierarchy_weight INT DEFAULT 0 COMMENT 'For ordering multiple parents',
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_parent_child_type (parent_unit_id, child_unit_id, relationship_type),
    INDEX idx_parent_unit (parent_unit_id),
    INDEX idx_child_unit (child_unit_id),
    INDEX idx_effective_dates (effective_from, effective_to),
    
    FOREIGN KEY (parent_unit_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
    FOREIGN KEY (child_unit_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
    
    CHECK (effective_from <= COALESCE(effective_to, '9999-12-31'))
) ENGINE=InnoDB;
```

### **3. MEMBERSHIP MANAGEMENT (Universal)**

```sql
-- ============================================
-- 8. MEMBERSHIP_TYPES
-- ============================================
CREATE TABLE membership_types (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    
    -- Duration & Fees
    duration_months INT NULL COMMENT 'NULL for lifetime membership',
    fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    fee_currency VARCHAR(3) DEFAULT 'NPR',
    renewal_fee_amount DECIMAL(10,2) NULL,
    prorated_fees BOOLEAN DEFAULT FALSE,
    
    -- Eligibility Criteria
    min_age INT NULL,
    max_age INT NULL,
    gender_restriction ENUM('any', 'male_only', 'female_only') DEFAULT 'any',
    education_requirement ENUM('any', 'literate', 'primary', 'secondary', 'higher') NULL,
    residency_requirement BOOLEAN DEFAULT FALSE,
    
    -- Approval Process
    requires_approval BOOLEAN DEFAULT TRUE,
    approval_level ENUM('unit', 'district', 'provincial', 'national') DEFAULT 'district',
    auto_approve_days INT NULL COMMENT 'Auto-approve after X days if no action',
    
    -- Rights & Privileges
    can_vote BOOLEAN DEFAULT TRUE,
    can_hold_office BOOLEAN DEFAULT TRUE,
    can_attend_meetings BOOLEAN DEFAULT TRUE,
    can_access_forums BOOLEAN DEFAULT TRUE,
    can_receive_communications BOOLEAN DEFAULT TRUE,
    
    -- Term Limits
    max_consecutive_terms INT NULL,
    term_years INT NULL COMMENT 'For elected positions',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    color_code VARCHAR(7) NULL COMMENT 'Hex color for UI',
    
    -- Metadata
    metadata JSON NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Universal Membership Types
INSERT INTO membership_types (code, name, fee_amount, duration_months, can_vote, can_hold_office) VALUES
('regular', 'Regular Member', 500.00, 12, TRUE, TRUE),
('lifetime', 'Lifetime Member', 5000.00, NULL, TRUE, TRUE),
('youth', 'Youth Member', 250.00, 12, TRUE, TRUE),
('student', 'Student Member', 100.00, 12, TRUE, FALSE),
('associate', 'Associate Member', 1000.00, 12, FALSE, FALSE),
('honorary', 'Honorary Member', 0.00, NULL, FALSE, FALSE),
('founder', 'Founder Member', 0.00, NULL, TRUE, TRUE),
('online', 'Online Supporter', 50.00, 12, FALSE, FALSE);

-- ============================================
-- 9. MEMBERSHIP_RECORDS
-- ============================================
CREATE TABLE membership_records (
    -- Primary Identification
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    membership_number VARCHAR(100) UNIQUE NOT NULL,
    
    -- Core Relationships
    user_id BIGINT UNSIGNED NOT NULL,
    membership_type_id BIGINT UNSIGNED NOT NULL,
    organizational_unit_id BIGINT UNSIGNED NOT NULL,
    
    -- Application Details
    application_date DATE NOT NULL,
    applied_through ENUM('online', 'offline', 'mobile', 'unit_office', 'campaign') DEFAULT 'online',
    application_source VARCHAR(100) NULL COMMENT 'Campaign name, event, etc.',
    application_notes TEXT NULL,
    referral_member_id BIGINT UNSIGNED NULL,
    
    -- Approval Workflow
    status ENUM(
        'draft',           -- Application in progress
        'submitted',       -- Submitted for review
        'under_review',    -- Being reviewed
        'approved',        -- Approved
        'active',          -- Currently active
        'suspended',       -- Temporarily inactive
        'expired',         -- Membership expired
        'rejected',        -- Application rejected
        'transferred',     -- Transferred to another unit
        'resigned',        -- Voluntarily resigned
        'terminated'       -- Terminated by party
    ) DEFAULT 'draft',
    
    -- Verification
    verified_by_id BIGINT UNSIGNED NULL,
    verified_at TIMESTAMP NULL,
    verification_method ENUM('document', 'interview', 'reference', 'auto') NULL,
    verification_notes TEXT NULL,
    
    -- Approval
    approved_by_id BIGINT UNSIGNED NULL,
    approved_at TIMESTAMP NULL,
    approval_level ENUM('unit', 'district', 'provincial', 'national') NULL,
    approval_notes TEXT NULL,
    
    -- Membership Period
    membership_year YEAR NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NULL COMMENT 'NULL for lifetime membership',
    renewal_due_date DATE NULL,
    renewal_reminder_sent_at TIMESTAMP NULL,
    
    -- Payment Information
    payment_status ENUM('pending', 'paid', 'partial', 'waived', 'exempted', 'refunded') DEFAULT 'pending',
    payment_amount DECIMAL(10,2) NULL,
    payment_date DATE NULL,
    payment_method ENUM('cash', 'bank_transfer', 'mobile_banking', 'online', 'cheque') NULL,
    payment_reference VARCHAR(100) NULL,
    receipt_number VARCHAR(50) NULL,
    
    -- Documents
    recommendation_path VARCHAR(500) NULL,
    application_form_path VARCHAR(500) NULL,
    id_verification_path VARCHAR(500) NULL,
    
    -- Audit Trail
    status_changed_by_id BIGINT UNSIGNED NULL,
    status_changed_at TIMESTAMP NULL,
    status_change_reason TEXT NULL,
    last_status_update TIMESTAMP NULL,
    
    -- Statistics
    attendance_rate DECIMAL(5,2) NULL COMMENT 'Meeting attendance percentage',
    participation_score INT NULL COMMENT 'Overall participation score',
    
    -- Metadata
    metadata JSON NULL COMMENT 'Party-specific fields',
    tenant_id BIGINT UNSIGNED NOT NULL,
    created_by_id BIGINT UNSIGNED NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes (Critical for Performance)
    INDEX idx_user_id (user_id),
    INDEX idx_unit_id (organizational_unit_id),
    INDEX idx_status (status),
    INDEX idx_membership_type (membership_type_id),
    INDEX idx_membership_number (membership_number),
    INDEX idx_valid_until (valid_until),
    INDEX idx_membership_year (membership_year),
    INDEX idx_payment_status (payment_status),
    INDEX idx_application_date (application_date),
    UNIQUE INDEX idx_user_unit_active (user_id, organizational_unit_id) 
        WHERE status = 'active',
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (membership_type_id) REFERENCES membership_types(id),
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id),
    FOREIGN KEY (verified_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (referral_member_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (status_changed_by_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CHECK (valid_from <= COALESCE(valid_until, '9999-12-31')),
    CHECK (application_date <= COALESCE(approved_at, '9999-12-31')),
    CHECK (membership_year BETWEEN 2000 AND 2100)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC 
COMMENT='Universal membership management with flexible workflow';

-- ============================================
-- 10. MEMBERSHIP_HISTORY (Audit Trail)
-- ============================================
CREATE TABLE membership_history (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    membership_record_id BIGINT UNSIGNED NOT NULL,
    
    -- Change Details
    old_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    change_type ENUM('status_change', 'unit_transfer', 'type_change', 'renewal', 'other') NOT NULL,
    
    -- Change Context
    changed_by_id BIGINT UNSIGNED NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT NULL,
    
    -- Data Snapshot
    data_snapshot JSON NULL COMMENT 'Complete record snapshot',
    notes TEXT NULL,
    
    -- Metadata
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    
    INDEX idx_membership_record (membership_record_id),
    INDEX idx_changed_at (changed_at),
    INDEX idx_change_type (change_type),
    
    FOREIGN KEY (membership_record_id) REFERENCES membership_records(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================
-- 11. MEMBERSHIP_TRANSFERS
-- ============================================
CREATE TABLE membership_transfers (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    membership_record_id BIGINT UNSIGNED NOT NULL,
    from_unit_id BIGINT UNSIGNED NOT NULL,
    to_unit_id BIGINT UNSIGNED NOT NULL,
    
    -- Transfer Details
    transfer_reason ENUM(
        'relocation',
        'promotion',
        'disciplinary',
        'request',
        'restructuring',
        'merger',
        'other'
    ) NOT NULL,
    
    reason_details TEXT NULL,
    requested_by_id BIGINT UNSIGNED NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Approval
    approved_by_id BIGINT UNSIGNED NULL,
    approved_at TIMESTAMP NULL,
    approval_notes TEXT NULL,
    approval_level ENUM('unit', 'district', 'provincial', 'national') NULL,
    
    -- Status
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    effective_date DATE NOT NULL,
    completed_at TIMESTAMP NULL,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_membership_record (membership_record_id),
    INDEX idx_from_unit (from_unit_id),
    INDEX idx_to_unit (to_unit_id),
    INDEX idx_status (status),
    INDEX idx_effective_date (effective_date),
    
    FOREIGN KEY (membership_record_id) REFERENCES membership_records(id) ON DELETE CASCADE,
    FOREIGN KEY (from_unit_id) REFERENCES organizational_units(id),
    FOREIGN KEY (to_unit_id) REFERENCES organizational_units(id),
    FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
```

### **4. ROLE-BASED ACCESS CONTROL (Universal)**

```sql
-- ============================================
-- 12. ROLES
-- ============================================
CREATE TABLE roles (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    
    -- Role Properties
    role_type ENUM(
        'leadership',      -- President, Secretary, etc.
        'committee',       -- Committee member
        'administrative',  -- Admin staff
        'functional',      -- Department head
        'volunteer',       -- Volunteer roles
        'member'          -- Regular member
    ) NOT NULL,
    
    scope_type ENUM('global', 'unit', 'system') DEFAULT 'unit',
    hierarchy_level INT NULL COMMENT 'For ordering in hierarchy (1=highest)',
    is_elected BOOLEAN DEFAULT FALSE,
    is_appointed BOOLEAN DEFAULT FALSE,
    is_voluntary BOOLEAN DEFAULT FALSE,
    
    -- Term & Succession
    term_years INT NULL COMMENT 'Term duration for elected/appointed roles',
    max_consecutive_terms INT NULL,
    succession_rules TEXT NULL,
    
    -- Permissions Template
    default_permissions JSON NULL,
    required_permissions JSON NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_system_role BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    
    -- Metadata
    metadata JSON NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_code (code),
    INDEX idx_role_type (role_type),
    INDEX idx_scope_type (scope_type),
    INDEX idx_hierarchy (hierarchy_level)
) ENGINE=InnoDB;

-- Universal Political Party Roles
INSERT INTO roles (code, name, role_type, scope_type, hierarchy_level, is_elected, term_years) VALUES
-- Leadership Roles
('president', 'President', 'leadership', 'unit', 1, TRUE, 5),
('vice_president', 'Vice President', 'leadership', 'unit', 2, TRUE, 5),
('general_secretary', 'General Secretary', 'leadership', 'unit', 3, TRUE, 5),
('secretary', 'Secretary', 'leadership', 'unit', 4, TRUE, 5),
('treasurer', 'Treasurer', 'leadership', 'unit', 5, TRUE, 5),
('joint_secretary', 'Joint Secretary', 'leadership', 'unit', 6, TRUE, 5),

-- Committee Roles
('committee_member', 'Committee Member', 'committee', 'unit', 10, TRUE, 3),
('committee_chair', 'Committee Chairperson', 'committee', 'unit', 7, TRUE, 3),

-- Administrative Roles
('admin_officer', 'Administrative Officer', 'administrative', 'unit', 20, FALSE, NULL),
('it_officer', 'IT Officer', 'administrative', 'unit', 21, FALSE, NULL),
('membership_officer', 'Membership Officer', 'administrative', 'unit', 22, FALSE, NULL),

-- Functional Roles
('media_coordinator', 'Media Coordinator', 'functional', 'unit', 30, FALSE, NULL),
('event_coordinator', 'Event Coordinator', 'functional', 'unit', 31, FALSE, NULL),
('training_coordinator', 'Training Coordinator', 'functional', 'unit', 32, FALSE, NULL),

-- Volunteer Roles
('volunteer_coordinator', 'Volunteer Coordinator', 'volunteer', 'unit', 40, FALSE, NULL),
('field_volunteer', 'Field Volunteer', 'volunteer', 'unit', 41, FALSE, NULL),

-- Member Roles
('active_member', 'Active Member', 'member', 'unit', 100, FALSE, NULL),
('general_member', 'General Member', 'member', 'unit', 101, FALSE, NULL);

-- ============================================
-- 13. PERMISSIONS
-- ============================================
CREATE TABLE permissions (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    
    -- Permission Properties
    module VARCHAR(50) NOT NULL COMMENT 'membership, finance, communication, etc.',
    submodule VARCHAR(50) NULL,
    action VARCHAR(50) NOT NULL COMMENT 'create, read, update, delete, approve, manage',
    resource VARCHAR(50) NULL COMMENT 'member, unit, document, etc.',
    
    scope_type ENUM('global', 'unit', 'self') DEFAULT 'unit',
    is_critical BOOLEAN DEFAULT FALSE COMMENT 'Critical security permissions',
    is_administrative BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    is_system_permission BOOLEAN DEFAULT FALSE,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_code (code),
    INDEX idx_module (module),
    INDEX idx_action (action),
    INDEX idx_scope (scope_type),
    INDEX idx_module_action (module, action),
    UNIQUE INDEX idx_module_action_resource (module, action, resource, scope_type)
) ENGINE=InnoDB;

-- ============================================
-- 14. ROLE_PERMISSIONS
-- ============================================
CREATE TABLE role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    grant_type ENUM('allow', 'deny', 'conditional') DEFAULT 'allow',
    conditions JSON NULL COMMENT 'Additional conditions for conditional grants',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (role_id, permission_id),
    INDEX idx_grant_type (grant_type),
    
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 15. ROLE_ASSIGNMENTS (HRBAC)
-- ============================================
CREATE TABLE role_assignments (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Assignment
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    
    -- Context (Hierarchical RBAC)
    organizational_unit_id BIGINT UNSIGNED NULL COMMENT 'NULL for global/system roles',
    department_id BIGINT UNSIGNED NULL,
    committee_id BIGINT UNSIGNED NULL,
    
    -- Term & Validity
    term_start_date DATE NULL,
    term_end_date DATE NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_acting BOOLEAN DEFAULT FALSE COMMENT 'Acting position',
    is_primary_role BOOLEAN DEFAULT TRUE COMMENT 'Primary vs additional role',
    
    -- Assignment Details
    assigned_by_id BIGINT UNSIGNED NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assignment_method ENUM('election', 'appointment', 'nomination', 'default', 'inherited') DEFAULT 'appointment',
    assignment_reference VARCHAR(100) NULL COMMENT 'Election ID, appointment letter #, etc.',
    assignment_document_path VARCHAR(500) NULL,
    
    -- Performance & Review
    performance_rating DECIMAL(3,2) NULL,
    last_review_date DATE NULL,
    next_review_date DATE NULL,
    
    -- Notes & Audit
    notes TEXT NULL,
    created_by_id BIGINT UNSIGNED NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    deactivated_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id),
    INDEX idx_unit_id (organizational_unit_id),
    INDEX idx_is_active (is_active),
    INDEX idx_term_dates (term_start_date, term_end_date),
    INDEX idx_assignment_method (assignment_method),
    UNIQUE INDEX idx_user_role_unit_active (user_id, role_id, organizational_unit_id) 
        WHERE revoked_at IS NULL AND is_active = TRUE,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES organizational_units(id) ON DELETE SET NULL,
    FOREIGN KEY (committee_id) REFERENCES organizational_units(id) ON DELETE SET NULL,
    
    -- Constraints
    CHECK (term_start_date <= COALESCE(term_end_date, '9999-12-31'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

-- ============================================
-- 16. USER_PERMISSIONS_CACHE (Performance Optimization)
-- ============================================
CREATE TABLE user_permissions_cache (
    user_id BIGINT UNSIGNED NOT NULL,
    organizational_unit_id BIGINT UNSIGNED NOT NULL,
    permission_code VARCHAR(100) NOT NULL,
    granted_via_role_id BIGINT UNSIGNED NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL COMMENT 'For temporary permissions',
    
    PRIMARY KEY (user_id, organizational_unit_id, permission_code),
    INDEX idx_user_unit (user_id, organizational_unit_id),
    INDEX idx_permission_code (permission_code),
    INDEX idx_expires (expires_at),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_via_role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB;
```

### **5. AUDIT, CONFIGURATION & SUPPORT**

```sql
-- ============================================
-- 17. AUDIT_LOGS
-- ============================================
CREATE TABLE audit_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Actor Information
    user_id BIGINT UNSIGNED NULL,
    user_type VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    session_id VARCHAR(100) NULL,
    
    -- Action Details
    event_type VARCHAR(255) NOT NULL,
    event_subtype VARCHAR(100) NULL,
    auditable_type VARCHAR(255) NOT NULL,
    auditable_id BIGINT UNSIGNED NOT NULL,
    
    -- Change Tracking
    old_values JSON NULL,
    new_values JSON NULL,
    changed_fields JSON NULL,
    
    -- Context
    url TEXT NULL,
    http_method VARCHAR(10) NULL,
    request_id VARCHAR(100) NULL,
    correlation_id VARCHAR(100) NULL,
    
    -- Additional Information
    severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
    tags JSON NULL,
    metadata JSON NULL,
    
    -- Timestamp with timezone support
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for compliance queries
    INDEX idx_user (user_id, user_type),
    INDEX idx_auditable (auditable_type, auditable_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    INDEX idx_request_id (request_id),
    INDEX idx_severity (severity),
    INDEX idx_correlation (correlation_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC 
PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- ============================================
-- 18. TENANT_SETTINGS
-- ============================================
CREATE TABLE tenant_settings (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(255) NOT NULL,
    setting_value TEXT NULL,
    setting_type ENUM('string', 'boolean', 'integer', 'float', 'json', 'array', 'datetime') DEFAULT 'string',
    setting_group VARCHAR(100) DEFAULT 'general',
    setting_category VARCHAR(50) NULL COMMENT 'UI category for grouping',
    
    -- Access Control
    is_public BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    access_level ENUM('public', 'member', 'officer', 'admin', 'system') DEFAULT 'admin',
    
    -- Validation & Constraints
    validation_rules JSON NULL,
    default_value TEXT NULL,
    allowed_values JSON NULL,
    
    -- Metadata
    description TEXT NULL,
    help_text TEXT NULL,
    display_order INT DEFAULT 0,
    metadata JSON NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE INDEX idx_key_group (setting_key, setting_group),
    INDEX idx_group (setting_group),
    INDEX idx_category (setting_category),
    INDEX idx_access_level (access_level),
    INDEX idx_is_public (is_public)
) ENGINE=InnoDB;

-- Universal Party Settings
INSERT INTO tenant_settings (setting_key, setting_value, setting_group, description, access_level) VALUES
('party_name', '', 'general', 'Official party name', 'public'),
('party_acronym', '', 'general', 'Party acronym/short name', 'public'),
('party_logo_url', '', 'appearance', 'URL to party logo', 'public'),
('party_website', '', 'contact', 'Official party website', 'public'),
('party_established_date', '', 'general', 'Date party was established', 'public'),

('membership_year_start', '2024-04-14', 'membership', 'Start of membership year', 'member'),
('membership_fee_currency', 'NPR', 'finance', 'Default currency for membership fees', 'member'),
('approval_required_level', 'district', 'membership', 'Default approval level for memberships', 'officer'),
('auto_approve_days', '7', 'membership', 'Auto-approve after X days if no action', 'admin'),

('default_language', 'en', 'localization', 'Default system language', 'member'),
('date_format', 'Y-m-d', 'localization', 'Default date format', 'member'),
('timezone', 'Asia/Kathmandu', 'localization', 'System timezone', 'admin'),

('max_login_attempts', '5', 'security', 'Maximum failed login attempts before lockout', 'admin'),
('session_timeout_minutes', '30', 'security', 'Session timeout in minutes', 'admin'),
('password_min_length', '8', 'security', 'Minimum password length', 'member'),
('password_require_special', '1', 'security', 'Require special characters in password', 'member'),

('smtp_enabled', '0', 'email', 'Enable email notifications', 'admin'),
('sms_enabled', '0', 'sms', 'Enable SMS notifications', 'admin'),
('push_enabled', '0', 'notifications', 'Enable push notifications', 'admin');

-- ============================================
-- 19. NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Recipient
    notifiable_type VARCHAR(255) NOT NULL,
    notifiable_id BIGINT UNSIGNED NOT NULL,
    
    -- Notification Content
    type VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    action_url VARCHAR(500) NULL,
    action_text VARCHAR(100) NULL,
    data JSON NULL,
    
    -- Delivery Configuration
    channels JSON NOT NULL COMMENT '["database", "email", "sms", "push"]',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    schedule_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    
    -- Delivery Status
    sent_via JSON NULL,
    read_at TIMESTAMP NULL,
    clicked_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    failed_at TIMESTAMP NULL,
    failure_reason TEXT NULL,
    
    -- Metadata
    metadata JSON NULL,
    created_by_id BIGINT UNSIGNED NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_notifiable (notifiable_type, notifiable_id),
    INDEX idx_type (type),
    INDEX idx_read_at (read_at),
    INDEX idx_created_at (created_at),
    INDEX idx_schedule_at (schedule_at),
    INDEX idx_priority (priority)
) ENGINE=InnoDB;

-- ============================================
-- 20. DOCUMENTS
-- ============================================
CREATE TABLE documents (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Document Properties
    documentable_type VARCHAR(255) NOT NULL,
    documentable_id BIGINT UNSIGNED NOT NULL,
    document_type ENUM(
        'id_proof',
        'application_form',
        'recommendation_letter',
        'certificate',
        'minutes',
        'resolution',
        'report',
        'policy',
        'other'
    ) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    
    -- File Information
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    file_extension VARCHAR(20) NOT NULL,
    
    -- Access Control
    visibility ENUM('private', 'internal', 'public') DEFAULT 'private',
    access_level ENUM('any', 'member', 'officer', 'admin') DEFAULT 'member',
    
    -- Status
    status ENUM('pending', 'verified', 'rejected', 'archived') DEFAULT 'pending',
    verified_by_id BIGINT UNSIGNED NULL,
    verified_at TIMESTAMP NULL,
    
    -- Metadata
    metadata JSON NULL,
    uploaded_by_id BIGINT UNSIGNED NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_documentable (documentable_type, documentable_id),
    INDEX idx_document_type (document_type),
    INDEX idx_uploaded_by (uploaded_by_id),
    INDEX idx_file_hash (file_hash),
    INDEX idx_status (status),
    INDEX idx_visibility (visibility)
) ENGINE=InnoDB;

-- ============================================
-- 21. SYSTEM_JOBS (Background Jobs Queue)
-- ============================================
CREATE TABLE system_jobs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Job Definition
    job_type VARCHAR(100) NOT NULL,
    job_name VARCHAR(200) NOT NULL,
    job_data JSON NULL,
    
    -- Scheduling
    scheduled_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    failed_at TIMESTAMP NULL,
    
    -- Status & Progress
    status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    progress_percent INT DEFAULT 0,
    progress_message TEXT NULL,
    
    -- Results & Errors
    result_data JSON NULL,
    error_message TEXT NULL,
    error_stack TEXT NULL,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    
    -- Metadata
    metadata JSON NULL,
    created_by_id BIGINT UNSIGNED NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_job_type (job_type),
    INDEX idx_status (status),
    INDEX idx_scheduled_at (scheduled_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;
```

## 🎯 **KEY UNIVERSAL FEATURES**

### **Flexibility for All Parties:**
1. **Multi-level hierarchy** (National → Province → District → Municipality → Ward → Cell)
2. **Flexible unit types** (Committee, Wing, Department, Cell, etc.)
3. **Configurable membership types** (Regular, Lifetime, Youth, Student, etc.)
4. **Universal role system** (Leadership, Committee, Administrative, Volunteer)
5. **Multi-lingual ready** (Nepali/English field structure)

### **Political-Specific Features:**
1. **Election/term management** for elected positions
2. **Committee structure** support
3. **Wing/organization support** (Youth, Student, Women wings)
4. **Geographic hierarchy** with Nepali administrative divisions
5. **Campaign/source tracking** for member acquisition

### **Scalability Features:**
1. **Nested set hierarchy** for fast queries
2. **Materialized paths** for quick ancestry lookups
3. **Permission caching** for performance
4. **Audit partitioning** for large datasets
5. **Background job queue** for async operations

This schema supports **any political party** in Nepal by providing:
- **Universal structure** that all parties can adapt
- **Configurable settings** for party-specific needs
- **Multi-level approval workflows**
- **Flexible organizational models**
- **Comprehensive audit trails**
- **Performance optimizations** for scale

The design allows each party to:
1. Define their own hierarchy levels
2. Configure their membership types
3. Set up their approval workflows
4. Customize roles and permissions
5. Adapt to their specific organizational structure