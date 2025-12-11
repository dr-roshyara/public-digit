# 🏛️ **POLITICAL PARTIES OF NEPAL - TENANT TEMPLATE SYSTEM**

I'll create a comprehensive template system specifically for Nepali political parties with digitized membership management.

## 📋 **TEMPLATE STRUCTURE FOR NEPALI POLITICAL PARTIES**

### **Folder Structure:**
```
database/templates/
├── basic/                    # Core schema for ALL tenants
│   ├── schema.sql
│   ├── seed.sql
│   └── modules/
│       ├── 001_core_tables.sql
│       └── 002_audit_system.sql
├── political_party/          # Template for Nepali political parties
│   ├── schema.sql
│   ├── seed.sql
│   └── modules/
│       ├── 001_membership_management.sql
│       ├── 002_constituency_structure.sql
│       ├── 003_election_management.sql
│       ├── 004_funding_donations.sql
│       └── 005_meeting_events.sql
└── migrations/
    └── political_party/
        ├── 2025_01_01_add_voter_verification.sql
        └── 2025_01_02_add_committee_hierarchy.sql
```

## 🏗️ **1. BASIC TEMPLATE (For ALL Tenants)**

### **Core Schema (`database/templates/basic/schema.sql`)**
```sql
-- ============================================
-- CORE TABLES FOR ALL TENANTS
-- ============================================

-- USERS & AUTHENTICATION
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    phone_country_code VARCHAR(5) DEFAULT '+977',
    email_verified_at TIMESTAMP NULL,
    phone_verified_at TIMESTAMP NULL,
    password_hash VARCHAR(255) NOT NULL,
    failed_login_attempts INT UNSIGNED DEFAULT 0,
    locked_until TIMESTAMP NULL,
    must_change_password BOOLEAN DEFAULT FALSE,
    status ENUM('pending', 'active', 'inactive', 'suspended') DEFAULT 'pending',
    last_login_at TIMESTAMP NULL,
    profile_image_url VARCHAR(500),
    metadata JSON,
    identity_data JSON COMMENT 'Personal identification data',
    address_data JSON COMMENT 'Permanent & temporary addresses',
    professional_data JSON COMMENT 'Occupation, education',
    communication_preferences JSON COMMENT 'Email/SMS preferences',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_id BIGINT UNSIGNED NULL,
    updated_by_id BIGINT UNSIGNED NULL,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_status (status),
    INDEX idx_last_login (last_login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ROLES & PERMISSIONS (Spatie Compatible)
CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    guard_name VARCHAR(255) DEFAULT 'web',
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_guard_name (guard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    guard_name VARCHAR(255) DEFAULT 'web',
    description TEXT,
    module VARCHAR(100) COMMENT 'Module/category of permission',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    
    PRIMARY KEY (permission_id, role_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE model_has_roles (
    role_id BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(255) NOT NULL,
    model_id BIGINT UNSIGNED NOT NULL,
    
    PRIMARY KEY (role_id, model_id, model_type),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    INDEX idx_model (model_type, model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE model_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(255) NOT NULL,
    model_id BIGINT UNSIGNED NOT NULL,
    
    PRIMARY KEY (permission_id, model_id, model_type),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    INDEX idx_model (model_type, model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AUDIT LOGS
CREATE TABLE audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    event VARCHAR(255) NOT NULL,
    auditable_type VARCHAR(255),
    auditable_id BIGINT UNSIGNED,
    old_values JSON,
    new_values JSON,
    url VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent TEXT,
    tags JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_event_user (event, user_id),
    INDEX idx_auditable (auditable_type, auditable_id),
    INDEX idx_created_at (created_at),
    INDEX idx_ip (ip_address),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SETTINGS & CONFIGURATION
CREATE TABLE settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(255) NOT NULL UNIQUE,
    `value` TEXT,
    `type` ENUM('string', 'integer', 'boolean', 'json', 'array', 'float') DEFAULT 'string',
    `group` VARCHAR(100) DEFAULT 'general',
    is_public BOOLEAN DEFAULT FALSE,
    description TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_key_group (`key`, `group`),
    INDEX idx_is_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOTIFICATIONS
CREATE TABLE notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    notifiable_type VARCHAR(255) NOT NULL,
    notifiable_id BIGINT UNSIGNED NOT NULL,
    type VARCHAR(255) NOT NULL,
    data JSON NOT NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_notifiable (notifiable_type, notifiable_id),
    INDEX idx_read (read_at),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FILES & DOCUMENTS
CREATE TABLE media_files (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    original_name VARCHAR(255) NOT NULL,
    storage_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT UNSIGNED,
    disk VARCHAR(50) DEFAULT 'local',
    path VARCHAR(500),
    collection_name VARCHAR(100) DEFAULT 'default',
    metadata JSON,
    uploaded_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_collection (collection_name),
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_created (created_at),
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **Basic Seed Data (`database/templates/basic/seed.sql`)**
```sql
-- ============================================
-- DEFAULT DATA FOR ALL TENANTS
-- ============================================

-- Default Super Admin User (password: "password123" - MUST CHANGE ON FIRST LOGIN)
INSERT INTO users (
    uuid, first_name, last_name, email, phone, phone_country_code, 
    password_hash, status, email_verified_at, must_change_password
) VALUES (
    UUID(),
    'System',
    'Administrator',
    'admin@{{TENANT_SLUG}}.com',
    '9800000000',
    '+977',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password123
    'active',
    NOW(),
    TRUE
);

-- Default Roles
INSERT INTO roles (name, guard_name, description, is_system_role) VALUES
('super_admin', 'web', 'Full system access with all permissions', TRUE),
('admin', 'web', 'Administrator with limited system access', FALSE),
('committee_member', 'web', 'Party committee member', FALSE),
('district_coordinator', 'web', 'District level coordinator', FALSE),
('ward_coordinator', 'web', 'Ward level coordinator', FALSE),
('member', 'web', 'Regular party member', FALSE),
('volunteer', 'web', 'Party volunteer', FALSE);

-- Default Permissions (Organized by Module)
INSERT INTO permissions (name, guard_name, description, module) VALUES
-- User Management
('view.users', 'web', 'View users', 'users'),
('create.users', 'web', 'Create new users', 'users'),
('edit.users', 'web', 'Edit existing users', 'users'),
('delete.users', 'web', 'Delete users', 'users'),
('suspend.users', 'web', 'Suspend user accounts', 'users'),

-- Role Management
('view.roles', 'web', 'View roles', 'roles'),
('create.roles', 'web', 'Create new roles', 'roles'),
('edit.roles', 'web', 'Edit existing roles', 'roles'),
('delete.roles', 'web', 'Delete roles', 'roles'),
('assign.roles', 'web', 'Assign roles to users', 'roles'),

-- Settings
('view.settings', 'web', 'View system settings', 'settings'),
('edit.settings', 'web', 'Edit system settings', 'settings'),

-- Audit Logs
('view.audit_logs', 'web', 'View audit logs', 'audit'),

-- Membership Module (Political Party Specific)
('view.members', 'web', 'View party members', 'membership'),
('create.members', 'web', 'Register new members', 'membership'),
('verify.members', 'web', 'Verify member applications', 'membership'),
('renew.membership', 'web', 'Renew membership', 'membership'),
('export.members', 'web', 'Export member data', 'membership'),

-- Committee Management
('view.committees', 'web', 'View committees', 'committee'),
('manage.committees', 'web', 'Manage committees', 'committee'),

-- Election Management
('view.elections', 'web', 'View elections', 'election'),
('manage.elections', 'web', 'Manage elections', 'election'),

-- Financial Management
('view.finances', 'web', 'View financial records', 'finance'),
('manage.finances', 'web', 'Manage finances', 'finance'),

-- Reports
('view.reports', 'web', 'View reports', 'reports'),
('generate.reports', 'web', 'Generate reports', 'reports');

-- Assign Permissions to Super Admin Role
INSERT INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id 
FROM permissions p, roles r 
WHERE r.name = 'super_admin';

-- Assign Super Admin role to default user
INSERT INTO model_has_roles (role_id, model_type, model_id)
SELECT r.id, 'App\\Models\\User', u.id
FROM roles r, users u 
WHERE r.name = 'super_admin' AND u.email = 'admin@{{TENANT_SLUG}}.com';

-- Default Settings for Nepali Political Parties
INSERT INTO settings (`key`, `value`, `type`, `group`, description) VALUES
-- General Settings
('party.name', '{{TENANT_SLUG}}', 'string', 'general', 'Official party name'),
('party.abbreviation', '{{TENANT_SLUG_ABBR}}', 'string', 'general', 'Party abbreviation'),
('party.logo_url', '', 'string', 'general', 'URL to party logo'),
('party.website', '', 'string', 'general', 'Party official website'),
('party.established_year', '', 'integer', 'general', 'Year party was established'),

-- Location Settings
('country', 'Nepal', 'string', 'location', 'Country'),
('timezone', 'Asia/Kathmandu', 'string', 'location', 'Default timezone'),
('language', 'ne', 'string', 'location', 'Default language (Nepali)'),
('date_format', 'Y-m-d', 'string', 'location', 'Date format'),
('currency', 'NPR', 'string', 'location', 'Default currency'),

-- Membership Settings
('membership.fee', '0', 'float', 'membership', 'Annual membership fee'),
('membership.fee_currency', 'NPR', 'string', 'membership', 'Membership fee currency'),
('membership.validity_months', '12', 'integer', 'membership', 'Membership validity in months'),
('membership.auto_renewal', 'false', 'boolean', 'membership', 'Enable auto-renewal'),
('membership.requires_approval', 'true', 'boolean', 'membership', 'Require approval for new members'),
('membership.minimum_age', '18', 'integer', 'membership', 'Minimum age for membership'),

-- Email Settings
('email.from_address', 'noreply@{{TENANT_SLUG}}.com', 'string', 'email', 'Default sender email'),
('email.from_name', '{{TENANT_SLUG}} Party', 'string', 'email', 'Default sender name'),
('email.support_address', 'support@{{TENANT_SLUG}}.com', 'string', 'email', 'Support email address'),

-- SMS Settings (Nepal specific)
('sms.provider', 'sparrow', 'string', 'sms', 'SMS provider (sparrow/daraz/etc)'),
('sms.sender_id', '{{TENANT_SLUG_ABBR}}', 'string', 'sms', 'SMS sender ID'),
('sms.enabled', 'true', 'boolean', 'sms', 'Enable SMS notifications'),

-- Security Settings
('security.two_factor', 'false', 'boolean', 'security', 'Enable two-factor authentication'),
('security.max_login_attempts', '5', 'integer', 'security', 'Max failed login attempts'),
('security.session_timeout', '120', 'integer', 'security', 'Session timeout in minutes'),

-- Features
('features.membership_portal', 'true', 'boolean', 'features', 'Enable membership portal'),
('features.online_payment', 'false', 'boolean', 'features', 'Enable online payment'),
('features.mobile_app', 'false', 'boolean', 'features', 'Enable mobile app'),
('features.voter_verification', 'false', 'boolean', 'features', 'Enable voter verification');
```

## 🏛️ **2. POLITICAL PARTY TEMPLATE (Nepal Specific)**

### **Core Political Party Schema (`database/templates/political_party/schema.sql`)**
```sql
-- ============================================
-- POLITICAL PARTY SPECIFIC TABLES
-- ============================================

-- PARTY STRUCTURE & HIERARCHY
CREATE TABLE party_committees (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL COMMENT 'e.g., Central Committee, District Committee',
    committee_type ENUM('central', 'provincial', 'district', 'municipal', 'ward', 'special') DEFAULT 'central',
    parent_committee_id BIGINT UNSIGNED NULL COMMENT 'Hierarchical parent',
    level INT DEFAULT 1 COMMENT 'Hierarchy level (1=central, 2=province, etc)',
    jurisdiction JSON COMMENT 'Geographical jurisdiction',
    description TEXT,
    formation_date DATE,
    dissolution_date DATE NULL,
    status ENUM('active', 'inactive', 'dissolved') DEFAULT 'active',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL,
    
    INDEX idx_committee_type (committee_type),
    INDEX idx_parent (parent_committee_id),
    INDEX idx_status (status),
    FOREIGN KEY (parent_committee_id) REFERENCES party_committees(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- COMMITTEE MEMBERS
CREATE TABLE committee_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    committee_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    position VARCHAR(100) NOT NULL COMMENT 'e.g., Chairman, Secretary, Treasurer',
    position_level ENUM('chairman', 'vice_chairman', 'secretary', 'joint_secretary', 'treasurer', 'member') DEFAULT 'member',
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    appointment_letter_url VARCHAR(500),
    responsibilities TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_committee_user_active (committee_id, user_id, position) WHERE (is_active = TRUE),
    INDEX idx_committee (committee_id),
    INDEX idx_user (user_id),
    INDEX idx_position (position_level),
    INDEX idx_active (is_active),
    FOREIGN KEY (committee_id) REFERENCES party_committees(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **Module 1: Membership Management (`database/templates/political_party/modules/001_membership_management.sql`)**
```sql
-- ============================================
-- MEMBERSHIP DIGITALIZATION MODULE
-- ============================================

-- CORE MEMBER REGISTRATION
CREATE TABLE party_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    user_id BIGINT UNSIGNED NULL COMMENT 'Link to user account if exists',
    membership_number VARCHAR(100) UNIQUE COMMENT 'Auto-generated: PARTY-YEAR-000001',
    registration_date DATE NOT NULL,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(300) GENERATED ALWAYS AS (CONCAT(first_name, ' ', IFNULL(middle_name, ''), ' ', last_name)) STORED,
    
    -- Contact Information
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) NOT NULL,
    phone_country_code VARCHAR(5) DEFAULT '+977',
    alternate_phone VARCHAR(20),
    
    -- Demographic Information
    date_of_birth DATE NOT NULL,
    age INT GENERATED ALWAYS AS (TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())) STORED,
    gender ENUM('male', 'female', 'other') NOT NULL,
    marital_status ENUM('single', 'married', 'divorced', 'widowed'),
    
    -- Citizenship Information (Nepal Specific)
    citizenship_number VARCHAR(50) UNIQUE,
    citizenship_issued_date DATE,
    citizenship_issued_district VARCHAR(100),
    citizenship_front_image_url VARCHAR(500),
    citizenship_back_image_url VARCHAR(500),
    
    -- Permanent Address (Nepal Specific)
    permanent_province ENUM('1', '2', '3', '4', '5', '6', '7') COMMENT 'Province number',
    permanent_district VARCHAR(100) NOT NULL,
    permanent_municipality VARCHAR(100),
    permanent_ward_number INT,
    permanent_tole VARCHAR(100),
    permanent_house_number VARCHAR(50),
    
    -- Temporary Address (if different)
    temporary_province ENUM('1', '2', '3', '4', '5', '6', '7'),
    temporary_district VARCHAR(100),
    temporary_municipality VARCHAR(100),
    temporary_ward_number INT,
    temporary_tole VARCHAR(100),
    
    -- Professional Information
    occupation VARCHAR(100),
    education_level ENUM('illiterate', 'primary', 'secondary', 'higher_secondary', 'bachelor', 'master', 'phd'),
    profession VARCHAR(100),
    employer VARCHAR(255),
    
    -- Political Information
    membership_type ENUM('ordinary', 'life', 'honorary', 'student', 'volunteer') DEFAULT 'ordinary',
    membership_status ENUM('pending', 'active', 'suspended', 'expired', 'terminated') DEFAULT 'pending',
    membership_approval_date DATE NULL,
    membership_approved_by BIGINT UNSIGNED NULL,
    
    -- Ward/Area Information (For Local Organization)
    ward_member_id BIGINT UNSIGNED NULL COMMENT 'Linked to committee member for this ward',
    is_ward_coordinator BOOLEAN DEFAULT FALSE,
    is_active_volunteer BOOLEAN DEFAULT FALSE,
    
    -- Photo & Documents
    profile_photo_url VARCHAR(500),
    signature_image_url VARCHAR(500),
    thumb_impression_image_url VARCHAR(500),
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(100),
    
    -- Membership Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP NULL,
    verified_by BIGINT UNSIGNED NULL,
    verification_notes TEXT,
    
    -- Metadata
    metadata JSON,
    tags JSON COMMENT 'For categorization: ["youth", "women", "farmer", "student"]',
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL,
    updated_by BIGINT UNSIGNED NULL,
    deleted_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_membership_number (membership_number),
    INDEX idx_citizenship (citizenship_number),
    INDEX idx_phone (phone),
    INDEX idx_email (email),
    INDEX idx_permanent_district (permanent_district),
    INDEX idx_membership_status (membership_status),
    INDEX idx_registration_date (registration_date),
    INDEX idx_ward_member (ward_member_id),
    INDEX idx_created_at (created_at),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (membership_approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (ward_member_id) REFERENCES committee_members(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MEMBERSHIP PAYMENTS & RENEWALS
CREATE TABLE membership_payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NPR',
    payment_type ENUM('membership_fee', 'renewal', 'donation', 'penalty') DEFAULT 'membership_fee',
    payment_method ENUM('cash', 'bank_transfer', 'mobile_banking', 'cheque', 'online') DEFAULT 'cash',
    payment_reference VARCHAR(255) COMMENT 'Transaction ID/Cheque Number',
    payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'completed',
    receipt_number VARCHAR(100) UNIQUE,
    membership_period_start DATE NOT NULL,
    membership_period_end DATE NOT NULL,
    collected_by BIGINT UNSIGNED NULL,
    verified_by BIGINT UNSIGNED NULL,
    notes TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_member_payment (member_id, payment_date),
    INDEX idx_payment_status (payment_status),
    INDEX idx_receipt_number (receipt_number),
    INDEX idx_membership_period (membership_period_start, membership_period_end),
    FOREIGN KEY (member_id) REFERENCES party_members(id) ON DELETE CASCADE,
    FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MEMBERSHIP RENEWAL REMINDERS
CREATE TABLE membership_renewals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    renewal_year YEAR NOT NULL,
    status ENUM('pending', 'paid', 'overdue', 'exempted') DEFAULT 'pending',
    due_date DATE NOT NULL,
    paid_date DATE NULL,
    amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    reminder_sent_count INT DEFAULT 0,
    last_reminder_sent_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_member_renewal (member_id, renewal_year),
    INDEX idx_status_due (status, due_date),
    INDEX idx_renewal_year (renewal_year),
    FOREIGN KEY (member_id) REFERENCES party_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MEMBER ACTIVITIES & PARTICIPATION
CREATE TABLE member_activities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    activity_type ENUM('meeting', 'rally', 'training', 'volunteer', 'donation', 'event', 'other') NOT NULL,
    activity_date DATE NOT NULL,
    activity_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    hours_spent DECIMAL(4,2) DEFAULT 0,
    description TEXT,
    verified_by BIGINT UNSIGNED NULL,
    verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    points_awarded INT DEFAULT 0 COMMENT 'For gamification/rewards',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_member_activity (member_id, activity_date),
    INDEX idx_activity_type (activity_type),
    INDEX idx_verification_status (verification_status),
    FOREIGN KEY (member_id) REFERENCES party_members(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MEMBER SKILLS & INTERESTS (For volunteer matching)
CREATE TABLE member_skills (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    skill_category ENUM('technical', 'organizational', 'communication', 'leadership', 'creative', 'logistical') NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    proficiency_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
    years_experience INT DEFAULT 0,
    is_certified BOOLEAN DEFAULT FALSE,
    certification_details TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_member_skill (member_id, skill_name),
    INDEX idx_skill_category (skill_category),
    INDEX idx_proficiency (proficiency_level),
    FOREIGN KEY (member_id) REFERENCES party_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **Module 2: Constituency Structure (`database/templates/political_party/modules/002_constituency_structure.sql`)**
```sql
-- ============================================
-- CONSTITUENCY & ELECTORAL STRUCTURE
-- ============================================

-- NEPAL CONSTITUENCIES (Fixed reference data)
CREATE TABLE constituencies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    constituency_code VARCHAR(20) UNIQUE NOT NULL,
    constituency_number INT NOT NULL,
    constituency_name_en VARCHAR(255) NOT NULL,
    constituency_name_ne VARCHAR(255) NOT NULL,
    province ENUM('1', '2', '3', '4', '5', '6', '7') NOT NULL,
    district VARCHAR(100) NOT NULL,
    type ENUM('house_of_representatives', 'provincial_assembly') NOT NULL,
    total_voters BIGINT DEFAULT 0,
    area_sq_km DECIMAL(10,2),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_constituency_code (constituency_code),
    INDEX idx_province_district (province, district),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PARTY REPRESENTATION IN CONSTITUENCIES
CREATE TABLE constituency_representatives (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    constituency_id BIGINT UNSIGNED NOT NULL,
    committee_member_id BIGINT UNSIGNED NOT NULL COMMENT 'Party representative for this constituency',
    representative_role ENUM('candidate', 'coordinator', 'observer', 'agent') NOT NULL,
    election_year YEAR NOT NULL,
    status ENUM('active', 'former', 'proposed') DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    performance_rating INT COMMENT '1-5 rating',
    notes TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_constituency_rep (constituency_id, committee_member_id, election_year),
    INDEX idx_election_year (election_year),
    INDEX idx_status (status),
    FOREIGN KEY (constituency_id) REFERENCES constituencies(id) ON DELETE CASCADE,
    FOREIGN KEY (committee_member_id) REFERENCES committee_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VOTER DATABASE (Party's internal tracking)
CREATE TABLE party_voters (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    voter_id_number VARCHAR(100) COMMENT 'Government voter ID',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    permanent_address_district VARCHAR(100),
    permanent_address_municipality VARCHAR(100),
    permanent_address_ward INT,
    temporary_address_district VARCHAR(100),
    temporary_address_municipality VARCHAR(100),
    temporary_address_ward INT,
    phone VARCHAR(20),
    email VARCHAR(255),
    constituency_id BIGINT UNSIGNED NULL,
    polling_station VARCHAR(255),
    voter_support_level ENUM('strong', 'moderate', 'lean', 'opposed', 'unknown') DEFAULT 'unknown',
    last_contact_date DATE,
    last_contact_method ENUM('phone', 'visit', 'meeting', 'sms', 'other'),
    notes TEXT,
    assigned_to_member_id BIGINT UNSIGNED NULL COMMENT 'Party member responsible for this voter',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL,
    
    INDEX idx_voter_id (voter_id_number),
    INDEX idx_constituency (constituency_id),
    INDEX idx_support_level (voter_support_level),
    INDEX idx_assigned_to (assigned_to_member_id),
    INDEX idx_district (permanent_address_district),
    FOREIGN KEY (constituency_id) REFERENCES constituencies(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to_member_id) REFERENCES party_members(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VOTER CONTACT HISTORY
CREATE TABLE voter_contacts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    voter_id BIGINT UNSIGNED NOT NULL,
    contacted_by_member_id BIGINT UNSIGNED NOT NULL,
    contact_date DATE NOT NULL,
    contact_method ENUM('phone_call', 'home_visit', 'meeting', 'sms', 'email', 'social_media', 'rally') NOT NULL,
    contact_purpose ENUM('followup', 'invitation', 'support_check', 'complaint', 'information') NOT NULL,
    duration_minutes INT,
    key_issues_discussed JSON,
    support_level_after ENUM('increased', 'same', 'decreased', 'unknown'),
    followup_required BOOLEAN DEFAULT FALSE,
    followup_date DATE NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_voter_contact (voter_id, contact_date),
    INDEX idx_contact_method (contact_method),
    INDEX idx_followup (followup_required, followup_date),
    FOREIGN KEY (voter_id) REFERENCES party_voters(id) ON DELETE CASCADE,
    FOREIGN KEY (contacted_by_member_id) REFERENCES party_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **Module 3: Election Management (`database/templates/political_party/modules/003_election_management.sql`)**
```sql
-- ============================================
-- ELECTION CAMPAIGN MANAGEMENT
-- ============================================

-- ELECTION CAMPAIGNS
CREATE TABLE election_campaigns (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    election_name VARCHAR(255) NOT NULL COMMENT 'e.g., "Local Election 2023", "Federal Election 2022"',
    election_type ENUM('federal', 'provincial', 'local', 'internal', 'by_election') NOT NULL,
    election_date DATE NOT NULL,
    nomination_start_date DATE,
    nomination_end_date DATE,
    campaign_start_date DATE,
    campaign_end_date DATE,
    status ENUM('upcoming', 'active', 'completed', 'cancelled') DEFAULT 'upcoming',
    description TEXT,
    budget_amount DECIMAL(15,2),
    budget_currency VARCHAR(3) DEFAULT 'NPR',
    total_voters BIGINT DEFAULT 0,
    total_candidates INT DEFAULT 0,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL,
    
    INDEX idx_election_type_date (election_type, election_date),
    INDEX idx_status (status),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ELECTION CANDIDATES
CREATE TABLE election_candidates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    election_campaign_id BIGINT UNSIGNED NOT NULL,
    candidate_member_id BIGINT UNSIGNED NOT NULL,
    constituency_id BIGINT UNSIGNED NOT NULL,
    candidate_position ENUM('member_of_parliament', 'provincial_assembly_member', 'mayor', 'deputy_mayor', 'ward_chairperson', 'party_leader') NOT NULL,
    candidate_number VARCHAR(50) COMMENT 'Official candidate number',
    nomination_status ENUM('proposed', 'approved', 'rejected', 'withdrawn') DEFAULT 'proposed',
    nomination_submitted_date DATE,
    nomination_approved_date DATE,
    campaign_manager_member_id BIGINT UNSIGNED NULL,
    campaign_office_address TEXT,
    campaign_phone VARCHAR(20),
    campaign_email VARCHAR(255),
    election_symbol VARCHAR(100),
    election_result ENUM('won', 'lost', 'tbd') DEFAULT 'tbd',
    votes_received BIGINT DEFAULT 0,
    vote_percentage DECIMAL(5,2) DEFAULT 0,
    margin_votes BIGINT DEFAULT 0,
    notes TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_campaign_candidate (election_campaign_id, candidate_member_id, constituency_id),
    INDEX idx_election_campaign (election_campaign_id),
    INDEX idx_candidate_position (candidate_position),
    INDEX idx_nomination_status (nomination_status),
    FOREIGN KEY (election_campaign_id) REFERENCES election_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_member_id) REFERENCES party_members(id) ON DELETE CASCADE,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_manager_member_id) REFERENCES party_members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CAMPAIGN ACTIVITIES & EVENTS
CREATE TABLE campaign_activities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    election_campaign_id BIGINT UNSIGNED NOT NULL,
    candidate_id BIGINT UNSIGNED NULL,
    activity_type ENUM('rally', 'meeting', 'door_to_door', 'media_event', 'debate', 'fundraiser', 'volunteer_training') NOT NULL,
    activity_date DATE NOT NULL,
    activity_time TIME,
    activity_name VARCHAR(255) NOT NULL,
    location VARCHAR(500) NOT NULL,
    estimated_attendance INT,
    actual_attendance INT,
    budget_amount DECIMAL(10,2),
    organizer_member_id BIGINT UNSIGNED NULL,
    description TEXT,
    outcome_notes TEXT,
    photos_urls JSON,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_campaign_activity (election_campaign_id, activity_date),
    INDEX idx_activity_type (activity_type),
    INDEX idx_candidate (candidate_id),
    FOREIGN KEY (election_campaign_id) REFERENCES election_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES election_candidates(id) ON DELETE SET NULL,
    FOREIGN KEY (organizer_member_id) REFERENCES party_members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VOLUNTEER ASSIGNMENTS FOR CAMPAIGNS
CREATE TABLE campaign_volunteers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    election_campaign_id BIGINT UNSIGNED NOT NULL,
    volunteer_member_id BIGINT UNSIGNED NOT NULL,
    assigned_role ENUM('canvasser', 'phone_banker', 'event_staff', 'driver', 'social_media', 'data_entry', 'coordinator') NOT NULL,
    assigned_constituency_id BIGINT UNSIGNED NULL,
    assigned_ward INT,
    start_date DATE,
    end_date DATE,
    status ENUM('active', 'completed', 'withdrawn') DEFAULT 'active',
    total_hours_served DECIMAL(6,2) DEFAULT 0,
    performance_rating INT COMMENT '1-5 rating',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_campaign_volunteer (election_campaign_id, volunteer_member_id),
    INDEX idx_campaign_role (election_campaign_id, assigned_role),
    INDEX idx_volunteer_status (volunteer_member_id, status),
    FOREIGN KEY (election_campaign_id) REFERENCES election_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (volunteer_member_id) REFERENCES party_members(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_constituency_id) REFERENCES constituencies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **Module 4: Funding & Donations (`database/templates/political_party/modules/004_funding_donations.sql`)**
```sql
-- ============================================
-- PARTY FUNDING & FINANCIAL MANAGEMENT
-- ============================================

-- DONORS DATABASE
CREATE TABLE donors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    donor_type ENUM('individual', 'corporate', 'organization', 'anonymous') NOT NULL,
    individual_member_id BIGINT UNSIGNED NULL COMMENT 'If donor is a party member',
    organization_name VARCHAR(255) COMMENT 'For corporate/organization donors',
    contact_person_name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    tax_identification_number VARCHAR(100),
    donor_category ENUM('regular', 'major', 'life_time', 'foreign') DEFAULT 'regular',
    total_donations_amount DECIMAL(15,2) DEFAULT 0,
    last_donation_date DATE,
    notes TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_donor_type (donor_type),
    INDEX idx_member_donor (individual_member_id),
    INDEX idx_organization (organization_name),
    FOREIGN KEY (individual_member_id) REFERENCES party_members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DONATIONS RECORDS
CREATE TABLE donations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    donor_id BIGINT UNSIGNED NOT NULL,
    donation_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NPR',
    donation_type ENUM('cash', 'cheque', 'bank_transfer', 'online', 'in_kind') DEFAULT 'cash',
    donation_purpose ENUM('membership_fee', 'election_fund', 'general_fund', 'event_sponsorship', 'infrastructure', 'relief_fund') DEFAULT 'general_fund',
    reference_number VARCHAR(255) COMMENT 'Cheque/Transaction number',
    received_by_member_id BIGINT UNSIGNED NOT NULL,
    deposited_date DATE,
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    receipt_issued BOOLEAN DEFAULT FALSE,
    receipt_number VARCHAR(100) UNIQUE,
    receipt_issued_date DATE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    notes TEXT,
    attachment_urls JSON COMMENT 'Scanned receipts/documents',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_donation_date (donation_date),
    INDEX idx_donor (donor_id),
    INDEX idx_donation_type (donation_type),
    INDEX idx_receipt (receipt_number),
    INDEX idx_received_by (received_by_member_id),
    FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by_member_id) REFERENCES party_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PARTY EXPENDITURES
CREATE TABLE expenditures (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    expenditure_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NPR',
    expenditure_category ENUM('administration', 'campaign', 'events', 'travel', 'office', 'salary', 'printing', 'advertising', 'other') NOT NULL,
    description VARCHAR(500) NOT NULL,
    paid_to VARCHAR(255),
    payment_method ENUM('cash', 'cheque', 'bank_transfer', 'online') DEFAULT 'cash',
    reference_number VARCHAR(255),
    approved_by_member_id BIGINT UNSIGNED NOT NULL,
    paid_by_member_id BIGINT UNSIGNED NOT NULL,
    receipt_attached BOOLEAN DEFAULT FALSE,
    receipt_url VARCHAR(500),
    notes TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_expenditure_date (expenditure_date),
    INDEX idx_category (expenditure_category),
    INDEX idx_approved_by (approved_by_member_id),
    FOREIGN KEY (approved_by_member_id) REFERENCES party_members(id) ON DELETE CASCADE,
    FOREIGN KEY (paid_by_member_id) REFERENCES party_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BUDGET ALLOCATIONS
CREATE TABLE budget_allocations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    budget_year YEAR NOT NULL,
    committee_id BIGINT UNSIGNED NULL COMMENT 'If budget is for specific committee',
    allocation_category ENUM('administration', 'membership', 'events', 'campaign', 'training', 'infrastructure', 'contingency') NOT NULL,
    allocated_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NPR',
    spent_amount DECIMAL(15,2) DEFAULT 0,
    balance_amount DECIMAL(15,2) GENERATED ALWAYS AS (allocated_amount - spent_amount) STORED,
    description TEXT,
    approved_by_member_id BIGINT UNSIGNED NOT NULL,
    approval_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_budget_allocation (budget_year, committee_id, allocation_category),
    INDEX idx_budget_year (budget_year),
    INDEX idx_committee (committee_id),
    FOREIGN KEY (committee_id) REFERENCES party_committees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_member_id) REFERENCES party_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### **Module 5: Meeting & Events (`database/templates/political_party/modules/005_meeting_events.sql`)**
```sql
-- ============================================
-- MEETINGS & EVENTS MANAGEMENT
-- ============================================

-- PARTY MEETINGS
CREATE TABLE party_meetings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    meeting_type ENUM('general_assembly', 'central_committee', 'district_committee', 'ward_committee', 'executive', 'special', 'training') NOT NULL,
    meeting_title VARCHAR(255) NOT NULL,
    meeting_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    location VARCHAR(500) NOT NULL,
    location_coordinates POINT NULL COMMENT 'GPS coordinates for map',
    organizer_committee_id BIGINT UNSIGNED NULL,
    chairperson_member_id BIGINT UNSIGNED NULL,
    secretary_member_id BIGINT UNSIGNED NULL,
    expected_participants INT,
    actual_participants INT,
    meeting_agenda TEXT,
    meeting_minutes TEXT,
    decisions_taken JSON,
    action_items JSON,
    attachment_urls JSON,
    status ENUM('scheduled', 'ongoing', 'completed', 'cancelled', 'postponed') DEFAULT 'scheduled',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL,
    
    INDEX idx_meeting_type_date (meeting_type, meeting_date),
    INDEX idx_organizer (organizer_committee_id),
    INDEX idx_status (status),
    FOREIGN KEY (organizer_committee_id) REFERENCES party_committees(id) ON DELETE SET NULL,
    FOREIGN KEY (chairperson_member_id) REFERENCES party_members(id) ON DELETE SET NULL,
    FOREIGN KEY (secretary_member_id) REFERENCES party_members(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MEETING PARTICIPANTS
CREATE TABLE meeting_participants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    meeting_id BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NOT NULL,
    participation_role ENUM('chairperson', 'secretary', 'presenter', 'participant', 'observer', 'guest') DEFAULT 'participant',
    attendance_status ENUM('invited', 'confirmed', 'attended', 'absent', 'excused') DEFAULT 'invited',
    check_in_time TIMESTAMP NULL,
    check_out_time TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_meeting_participant (meeting_id, member_id),
    INDEX idx_meeting_attendance (meeting_id, attendance_status),
    INDEX idx_member_meetings (member_id, meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES party_meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES party_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PARTY EVENTS
CREATE TABLE party_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    event_type ENUM('rally', 'protest', 'celebration', 'cultural', 'fundraiser', 'training', 'conference', 'seminar') NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    location VARCHAR(500) NOT NULL,
    expected_attendance INT,
    actual_attendance INT,
    organizer_committee_id BIGINT UNSIGNED NULL,
    event_budget DECIMAL(15,2),
    event_description TEXT,
    featured_speakers JSON COMMENT 'List of speaker member IDs',
    program_schedule JSON,
    media_coverage JSON COMMENT 'Links to news articles/videos',
    photos_urls JSON,
    status ENUM('planned', 'confirmed', 'ongoing', 'completed', 'cancelled') DEFAULT 'planned',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by BIGINT UNSIGNED NULL,
    
    INDEX idx_event_type_date (event_type, event_date),
    INDEX idx_organizer_committee (organizer_committee_id),
    INDEX idx_status (status),
    FOREIGN KEY (organizer_committee_id) REFERENCES party_committees(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- EVENT VOLUNTEERS
CREATE TABLE event_volunteers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT UNSIGNED NOT NULL,
    volunteer_member_id BIGINT UNSIGNED NOT NULL,
    assigned_role VARCHAR(100) NOT NULL,
    assigned_tasks TEXT,
    shift_start_time TIME,
    shift_end_time TIME,
    status ENUM('assigned', 'confirmed', 'attended', 'absent') DEFAULT 'assigned',
    performance_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_event_volunteer (event_id, volunteer_member_id),
    INDEX idx_event_roles (event_id, assigned_role),
    INDEX idx_volunteer_status (volunteer_member_id, status),
    FOREIGN KEY (event_id) REFERENCES party_events(id) ON DELETE CASCADE,
    FOREIGN KEY (volunteer_member_id) REFERENCES party_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 📦 **3. TEMPLATE SEED DATA FOR POLITICAL PARTIES**

### **Political Party Seed Data (`database/templates/political_party/seed.sql`)**
```sql
-- ============================================
-- DEFAULT DATA FOR NEPALI POLITICAL PARTIES
-- ============================================

-- Pre-populate Nepali constituencies (Example data for Province 3)
INSERT INTO constituencies (constituency_code, constituency_number, constituency_name_en, constituency_name_ne, province, district, type) VALUES
-- Federal Parliament Constituencies (Province 3 - Example)
('FP-3-1', 1, 'Kathmandu 1', 'काठमाडौं १', '3', 'Kathmandu', 'house_of_representatives'),
('FP-3-2', 2, 'Kathmandu 2', 'काठमाडौं २', '3', 'Kathmandu', 'house_of_representatives'),
('FP-3-3', 3, 'Kathmandu 3', 'काठमाडौं ३', '3', 'Kathmandu', 'house_of_representatives'),
('FP-3-4', 4, 'Kathmandu 4', 'काठमाडौं ४', '3', 'Kathmandu', 'house_of_representatives'),
('FP-3-5', 5, 'Kathmandu 5', 'काठमाडौं ५', '3', 'Kathmandu', 'house_of_representatives'),
('FP-3-6', 6, 'Lalitpur 1', 'ललितपुर १', '3', 'Lalitpur', 'house_of_representatives'),
('FP-3-7', 7, 'Lalitpur 2', 'ललितपुर २', '3', 'Lalitpur', 'house_of_representatives'),
('FP-3-8', 8, 'Bhaktapur 1', 'भक्तपुर १', '3', 'Bhaktapur', 'house_of_representatives'),
('FP-3-9', 9, 'Bhaktapur 2', 'भक्तपुर २', '3', 'Bhaktapur', 'house_of_representatives'),
('FP-3-10', 10, 'Kavrepalanchok 1', 'काभ्रेपलाञ्चोक १', '3', 'Kavrepalanchok', 'house_of_representatives'),

-- Provincial Assembly Constituencies (Province 3 - Example)
('PA-3-1-A', 1, 'Kathmandu 1(A)', 'काठमाडौं १(क)', '3', 'Kathmandu', 'provincial_assembly'),
('PA-3-1-B', 1, 'Kathmandu 1(B)', 'काठमाडौं १(ख)', '3', 'Kathmandu', 'provincial_assembly'),
('PA-3-2-A', 2, 'Kathmandu 2(A)', 'काठमाडौं २(क)', '3', 'Kathmandu', 'provincial_assembly'),
('PA-3-2-B', 2, 'Kathmandu 2(B)', 'काठमाडौं २(ख)', '3', 'Kathmandu', 'provincial_assembly'),
('PA-3-3-A', 3, 'Kathmandu 3(A)', 'काठमाडौं ३(क)', '3', 'Kathmandu', 'provincial_assembly'),
('PA-3-3-B', 3, 'Kathmandu 3(B)', 'काठमाडौं ३(ख)', '3', 'Kathmandu', 'provincial_assembly');

-- Create default Central Committee structure
INSERT INTO party_committees (uuid, name, committee_type, level, description, status) VALUES
(UUID(), 'Central Working Committee', 'central', 1, 'Highest decision-making body of the party', 'active'),
(UUID(), 'Province 3 Committee', 'provincial', 2, 'Provincial level committee for Province 3', 'active'),
(UUID(), 'Kathmandu District Committee', 'district', 3, 'District committee for Kathmandu', 'active'),
(UUID(), 'Lalitpur District Committee', 'district', 3, 'District committee for Lalitpur', 'active'),
(UUID(), 'Bhaktapur District Committee', 'district', 3, 'District committee for Bhaktapur', 'active');

-- Add committee hierarchy
UPDATE party_committees SET parent_committee_id = 1 WHERE id IN (2,3,4,5);
UPDATE party_committees SET parent_committee_id = 2 WHERE id IN (3,4,5);

-- Add default committee members (linking to the super admin user)
INSERT INTO committee_members (committee_id, user_id, position, position_level, is_active, start_date) 
SELECT 
    c.id,
    u.id,
    CASE 
        WHEN c.committee_type = 'central' THEN 'General Secretary'
        WHEN c.committee_type = 'provincial' THEN 'Provincial Secretary'
        ELSE 'District Coordinator'
    END,
    CASE 
        WHEN c.committee_type = 'central' THEN 'secretary'
        WHEN c.committee_type = 'provincial' THEN 'secretary'
        ELSE 'member'
    END,
    TRUE,
    CURDATE()
FROM party_committees c
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@{{TENANT_SLUG}}.com' LIMIT 1) u
WHERE c.id IN (1, 2, 3, 4, 5);

-- Add default party settings specific to political parties
INSERT INTO settings (`key`, `value`, `type`, `group`, description) VALUES
-- Party Identity
('party.ideology', 'social_democracy', 'string', 'identity', 'Political ideology'),
('party.founding_date', '1990-01-01', 'string', 'identity', 'Date party was founded'),
('party.headquarters_address', '', 'string', 'identity', 'Central office address'),
('party.registration_number', '', 'string', 'identity', 'Election Commission registration number'),

-- Membership Settings (Political Party Specific)
('membership.generate_membership_number', 'true', 'boolean', 'membership', 'Auto-generate membership numbers'),
('membership.number_prefix', '{{TENANT_SLUG_ABBR}}', 'string', 'membership', 'Prefix for membership numbers'),
('membership.number_format', 'YY-#####', 'string', 'membership', 'Membership number format'),
('membership.requires_citizenship', 'true', 'boolean', 'membership', 'Require citizenship number'),
('membership.requires_photo', 'true', 'boolean', 'membership', 'Require profile photo'),
('membership.requires_signature', 'false', 'boolean', 'membership', 'Require digital signature'),

-- Election Settings
('election.upcoming_election_date', '2027-11-01', 'string', 'election', 'Next election date'),
('election.candidate_nomination_start', '2027-08-01', 'string', 'election', 'Candidate nomination start'),
('election.candidate_nomination_end', '2027-08-31', 'string', 'election', 'Candidate nomination end'),

-- Financial Settings
('finance.fiscal_year_start', '2025-07-16', 'string', 'finance', 'Fiscal year start (Shrawan 1)'),
('finance.fiscal_year_end', '2026-07-15', 'string', 'finance', 'Fiscal year end (Ashad 31)'),
('finance.default_bank_account', '', 'string', 'finance', 'Default bank account number'),
('finance.treasurer_member_id', '1', 'string', 'finance', 'Default treasurer member ID'),

-- Communication Settings
('communication.welcome_message', 'Welcome to {{TENANT_SLUG}} party membership portal!', 'string', 'communication', 'Welcome message for new members'),
('communication.sms_reminder_days', '7,30,60', 'string', 'communication', 'Days before expiry to send SMS reminders'),
('communication.auto_welcome_email', 'true', 'boolean', 'communication', 'Send welcome email to new members'),

-- Reporting Settings
('reports.membership_summary_frequency', 'monthly', 'string', 'reports', 'Membership summary report frequency'),
('reports.financial_summary_frequency', 'quarterly', 'string', 'reports', 'Financial summary report frequency'),
('reports.automatic_report_recipients', '[]', 'json', 'reports', 'Email addresses for automatic reports');
```

## 🚀 **IMPLEMENTATION STEPS FOR NEPALI PARTIES**

### **Step 1: Create Template in Landlord Database**
```php
// Run this in tinker or a seeder
$politicalTemplate = \App\Models\TenantTemplate::create([
    'name' => 'Nepali Political Party',
    'description' => 'Complete digital platform for Nepali political parties with membership management, election campaigns, and constituency tracking',
    'template_type' => 'political_party',
    'version' => '1.0.0',
    'schema_snapshot' => json_encode([
        'tables' => 45,
        'modules' => ['membership', 'constituency', 'election', 'finance', 'events'],
        'features' => ['citizenship_verification', 'ward_coordination', 'election_campaigns']
    ]),
    'is_active' => true,
    'is_locked' => false,
]);

// Create modules for the template
$modules = [
    ['name' => 'membership_management', 'module_type' => 'core', 'display_order' => 1],
    ['name' => 'constituency_structure', 'module_type' => 'core', 'display_order' => 2],
    ['name' => 'election_management', 'module_type' => 'core', 'display_order' => 3],
    ['name' => 'funding_donations', 'module_type' => 'core', 'display_order' => 4],
    ['name' => 'meeting_events', 'module_type' => 'core', 'display_order' => 5],
];

foreach ($modules as $module) {
    $sqlFile = database_path("templates/political_party/modules/00{$module['display_order']}_{$module['name']}.sql");
    $schemaSql = file_exists($sqlFile) ? file_get_contents($sqlFile) : '';
    
    \App\Models\TemplateModule::create([
        'template_id' => $politicalTemplate->id,
        'module_name' => $module['name'],
        'module_type' => $module['module_type'],
        'display_order' => $module['display_order'],
        'schema_sql' => $schemaSql,
    ]);
}
```

### **Step 2: Create Nepali Political Party Tenants**
```php
// Example: Create tenants for major Nepali parties
$parties = [
    [
        'name' => 'Nepali Congress',
        'email' => 'digital@nepalicongress.org',
        'slug' => 'nepali-congress',
        'abbreviation' => 'NC'
    ],
    [
        'name' => 'Communist Party of Nepal (UML)',
        'email' => 'digital@cpnuml.org',
        'slug' => 'cpn-uml', 
        'abbreviation' => 'UML'
    ],
    [
        'name' => 'Communist Party of Nepal (Maoist Centre)',
        'email' => 'digital@maoistcentre.org',
        'slug' => 'cpn-maoist-centre',
        'abbreviation' => 'MC'
    ],
    [
        'name' => 'Rastriya Swatantra Party',
        'email' => 'digital@rsp.org.np',
        'slug' => 'rastriya-swatantra-party',
        'abbreviation' => 'RSP'
    ],
    [
        'name' => 'Rastriya Prajatantra Party',
        'email' => 'digital@rpp.org.np',
        'slug' => 'rastriya-prajatantra-party',
        'abbreviation' => 'RPP'
    ]
];

foreach ($parties as $party) {
    $tenant = \App\Models\Tenant::create([
        'name' => $party['name'],
        'email' => $party['email'],
        'slug' => $party['slug'],
        'subdomain' => $party['slug'],
        'template_id' => $politicalTemplate->id,
        'template_version' => $politicalTemplate->version,
        'status' => 'active',
    ]);
    
    // Dispatch job to create database
    \App\Jobs\CreateTenantDatabaseJob::dispatch($tenant, $politicalTemplate);
    
    // Party-specific branding
    \App\Models\TenantBranding::create([
        'tenant_id' => $tenant->id,
        'primary_color' => $this->getPartyColor($party['abbreviation']),
        'logo_url' => $this->getPartyLogo($party['abbreviation']),
        'favicon_url' => '',
        'theme' => 'default',
    ]);
}
```

### **Step 3: Custom Membership Number Generator (Nepali Context)**
```php
// Add this to your Member model
class PartyMember extends Model
{
    protected static function booted()
    {
        static::creating(function ($member) {
            if (empty($member->membership_number)) {
                $member->membership_number = self::generateMembershipNumber();
            }
        });
    }
    
    public static function generateMembershipNumber(): string
    {
        $tenant = Tenant::current();
        $prefix = strtoupper($tenant->slug);
        $year = date('y');
        $sequence = self::whereYear('created_at', date('Y'))->count() + 1;
        
        return sprintf('%s-%s-%06d', $prefix, $year, $sequence);
    }
    
    // Get Nepali province name
    public function getProvinceNameAttribute(): string
    {
        $provinceNames = [
            '1' => 'Province 1',
            '2' => 'Madhesh Province',
            '3' => 'Bagmati Province',
            '4' => 'Gandaki Province',
            '5' => 'Lumbini Province',
            '6' => 'Karnali Province',
            '7' => 'Sudurpashchim Province',
        ];
        
        return $provinceNames[$this->permanent_province] ?? 'Unknown Province';
    }
    
    // Age calculation in Nepali years
    public function getAgeInNepaliYearsAttribute(): int
    {
        // Convert Gregorian to Nepali date for accurate age
        $nepaliDate = $this->convertToNepaliDate($this->date_of_birth);
        $currentNepaliDate = $this->getCurrentNepaliDate();
        
        // Simplified calculation
        return $currentNepaliDate['year'] - $nepaliDate['year'];
    }
}
```

## 📊 **REPORTING & ANALYTICS FOR POLITICAL PARTIES**

```sql
-- Create useful views for political party analytics
CREATE VIEW vw_member_demographics AS
SELECT 
    permanent_province as province,
    permanent_district as district,
    gender,
    COUNT(*) as total_members,
    AVG(TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())) as avg_age,
    SUM(CASE WHEN membership_status = 'active' THEN 1 ELSE 0 END) as active_members,
    SUM(CASE WHEN membership_status = 'pending' THEN 1 ELSE 0 END) as pending_members
FROM party_members
GROUP BY permanent_province, permanent_district, gender
ORDER BY province, district;

CREATE VIEW vw_membership_renewals_due AS
SELECT 
    pm.membership_number,
    CONCAT(pm.first_name, ' ', pm.last_name) as member_name,
    pm.phone,
    pm.permanent_district,
    mr.renewal_year,
    mr.due_date,
    mr.amount_due,
    mr.reminder_sent_count,
    DATEDIFF(mr.due_date, CURDATE()) as days_until_due
FROM membership_renewals mr
JOIN party_members pm ON mr.member_id = pm.id
WHERE mr.status = 'pending'
AND mr.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
ORDER BY mr.due_date;

CREATE VIEW vw_election_campaign_summary AS
SELECT 
    ec.election_name,
    ec.election_date,
    ec.status,
    COUNT(DISTINCT ecc.candidate_member_id) as total_candidates,
    COUNT(DISTINCT cr.constituency_id) as constituencies_contested,
    SUM(CASE WHEN ecc.election_result = 'won' THEN 1 ELSE 0 END) as seats_won,
    SUM(ecc.votes_received) as total_votes_received
FROM election_campaigns ec
LEFT JOIN election_candidates ecc ON ec.id = ecc.election_campaign_id
LEFT JOIN constituency_representatives cr ON ecc.constituency_id = cr.constituency_id 
    AND ecc.candidate_member_id = cr.committee_member_id
GROUP BY ec.id, ec.election_name, ec.election_date, ec.status;
```

## 🎯 **NEXT STEPS FOR IMPLEMENTATION** 

1. **Week 1:** Implement basic template with membership tables
2. **Week 2:** Add constituency and voter management
3. **Week 3:** Implement election campaign tracking
4. **Week 4:** Add financial management and reporting
5. **Week 5:** Create admin dashboard for party administrators
6. **Week 6:** Implement mobile app APIs for field workers

This template system is **specifically designed for Nepali political parties** with:
- 🇳🇵 **Nepali context** (provinces, districts, citizenship tracking)
- 🗳️ **Election-ready** (constituency management, campaign tracking)
- 👥 **Mass membership** (digital registration, renewal system)
- 📊 **Real-time analytics** (demographics, performance metrics)
- 🔒 **Secure & compliant** (citizenship verification, audit trails)

**Ready to create your first Nepali political party tenant?** You now have everything needed to onboard parties like Nepali Congress, UML, Maoist Centre, RSP, RPP, and others with their own fully isolated databases!