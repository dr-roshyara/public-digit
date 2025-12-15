Read the folllowing , analyse critically and implement as senior laravel developer professionally. Ask if you have any confusion . 

# 🏗️ **COMPREHENSIVE BASE SCHEMA ARCHITECTURE FOR POLITICAL ORGANIZATIONS**  
**Senior Solution Architect Review & Final Specification**

## 🎯 **ARCHITECTURAL PHILOSOPHY**

### **Core Principles:**
1. **Membership-First, Identity-Foundational**: Every organization revolves around people, but not all people are formal members
2. **Hierarchical Realism**: Political organizations are inherently hierarchical (national → regional → local)
3. **Temporal Validity**: Everything has a lifecycle (membership, roles, assignments)
4. **Auditability & Compliance**: Complete traceability of all changes
5. **Modular Extensibility**: Clean separation between base schema and domain modules

## 📊 **ARCHITECTURE OVERVIEW**

```
┌─────────────────────────────────────────────────────────┐
│               THREE-TIER IDENTITY MODEL                │
├─────────────────────────────────────────────────────────┤
│ TIER 1: CORE IDENTITY (users)                         │
│   • Universal person registry                         │
│   • All human entities interacting with organization  │
│                                                       │
│ TIER 2: FORMAL STATUS (membership_records)            │
│   • Formal, rights-bearing relationships              │
│   • Time-bound, approval-based                        │
│                                                       │
│ TIER 3: INFORMAL ROLES (contact_assignments)          │
│   • Engagement-focused relationships                  │
│   • Donors, volunteers, supporters                    │
└─────────────────────────────────────────────────────────┘
```

## 🗄️ **COMPLETE BASE SCHEMA SPECIFICATION**

### **1. CORE IDENTITY: `tenant_users` Table**
**Purpose:** Single source of truth for all human identities in the tenant system

```sql
CREATE TABLE users (
    -- Primary Identification
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    external_id VARCHAR(100) NULL,          -- Government/partner system IDs
    national_id_type ENUM('passport', 'voter_id', 'driving_license', 'other') NULL,
    national_id_number VARCHAR(100) NULL,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NULL,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL,
    date_of_birth DATE NULL,
    
    -- Contact Information (Unique within tenant)
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NULL,
    phone_country_code VARCHAR(5) NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    
    -- Authentication & Security
    password_hash VARCHAR(255) NULL,        -- NULL for external auth systems
    must_change_password BOOLEAN DEFAULT FALSE,
    last_password_changed_at TIMESTAMP NULL,
    last_login_at TIMESTAMP NULL,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    
    -- Status Management
    status ENUM('active', 'inactive', 'archived') DEFAULT 'active',
    
    -- Cross-Reference & Metadata
    tenant_id BIGINT UNSIGNED NOT NULL,     -- Denormalized from landlord DB
    metadata JSON NULL,                     -- Address, photo_url, custom fields
    
    -- Timestamps & Soft Deletes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_status (status),
    INDEX idx_tenant (tenant_id),
    INDEX idx_external_id (external_id),
    FULLTEXT idx_name_search (first_name, middle_name, last_name),
    
    -- Constraints
    CHECK (email IS NOT NULL AND email != ''),
    CHECK (first_name IS NOT NULL AND first_name != ''),
    CHECK (last_name IS NOT NULL AND last_name != '')
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;
```

### **2. ORGANIZATIONAL HIERARCHY: `organizational_units`**
**Purpose:** Flexible hierarchical structure supporting multiple tree models

```sql
CREATE TABLE organizational_units (
    -- Primary Identification
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Hierarchy Implementation (Dual Model)
    parent_id BIGINT UNSIGNED NULL,                -- Adjacency List (simple CRUD)
    lft INT NULL,                                  -- Nested Set Left (performant reads)
    rgt INT NULL,                                  -- Nested Set Right
    depth INT DEFAULT 0,                           -- Cached depth for quick filtering
    
    -- Type & Classification
    unit_type_id BIGINT UNSIGNED NOT NULL,         -- FK to unit_types
    code VARCHAR(50) NOT NULL,                     -- W-001, B-042 (unique within parent)
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    
    -- Leadership & Contact
    leader_id BIGINT UNSIGNED NULL,                -- FK to users (current leader)
    email VARCHAR(255) NULL,
    phone VARCHAR(20) NULL,
    address TEXT NULL,
    location_id BIGINT UNSIGNED NULL,              -- For future geospatial module
    
    -- Status & Metadata
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSON NULL,                            -- Meeting times, facilities, etc.
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_parent_id (parent_id),
    INDEX idx_lft_rgt (lft, rgt),
    INDEX idx_depth (depth),
    INDEX idx_unit_type (unit_type_id),
    INDEX idx_leader (leader_id),
    UNIQUE INDEX idx_parent_code (parent_id, code),
    
    -- Foreign Keys
    FOREIGN KEY (parent_id) REFERENCES organizational_units(id) ON DELETE SET NULL,
    FOREIGN KEY (unit_type_id) REFERENCES unit_types(id),
    FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

-- Supporting Table for Unit Types
CREATE TABLE unit_types (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,                    -- national, regional, district, ward
    hierarchy_level INT NOT NULL,                  -- 0=root, 1=top, etc.
    can_have_members BOOLEAN DEFAULT FALSE,
    can_conduct_elections BOOLEAN DEFAULT FALSE,
    can_manage_finances BOOLEAN DEFAULT FALSE,
    is_system_type BOOLEAN DEFAULT FALSE,          -- Non-deletable
    display_order INT DEFAULT 0,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_name (name),
    INDEX idx_hierarchy (hierarchy_level)
) ENGINE=InnoDB;
```

### **3. FORMAL MEMBERSHIP: `membership_records`**
**Purpose:** Time-bound, approval-based formal membership with state machine

```sql
CREATE TABLE membership_records (
    -- Primary Identification
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Core Relationships
    user_id BIGINT UNSIGNED NOT NULL,
    membership_type_id BIGINT UNSIGNED NOT NULL,
    organizational_unit_id BIGINT UNSIGNED NOT NULL,
    
    -- Identification & Application
    membership_number VARCHAR(100) UNIQUE NULL,    -- Org-specific ID
    application_date DATE NOT NULL,
    approval_date DATE NULL,
    approved_by_id BIGINT UNSIGNED NULL,           -- FK to users (who approved)
    
    -- State Machine
    status ENUM(
        'prospect',     -- Inquiry made
        'applied',      -- Application submitted
        'approved',     -- Approved, payment pending
        'active',       -- Fully active
        'suspended',    -- Temporarily inactive
        'expired',      -- Membership lapsed
        'revoked',      -- Membership terminated
        'transferred'   -- Moved to another unit
    ) DEFAULT 'applied',
    
    -- Temporal Validity
    valid_from DATE NOT NULL,
    valid_until DATE NULL,                         -- NULL for lifetime membership
    renewal_due_date DATE NULL,
    renewal_reminder_sent_at TIMESTAMP NULL,
    
    -- Financial Status (Decoupled from Finance Module)
    payment_status ENUM('pending', 'paid', 'waived', 'refunded') NULL,
    payment_reference_type VARCHAR(100) NULL,      -- Polymorphic: 'transaction', 'donation', etc.
    payment_reference_id BIGINT UNSIGNED NULL,     -- Polymorphic ID
    
    -- Audit & Notes
    reason_for_status_change TEXT NULL,
    metadata JSON NULL,                            -- Custom requirements, documents
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes (Critical for Performance)
    INDEX idx_user_id (user_id),
    INDEX idx_unit_id (organizational_unit_id),
    INDEX idx_status_validity (status, valid_until),
    INDEX idx_membership_type (membership_type_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_renewal_due (renewal_due_date),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (membership_type_id) REFERENCES membership_types(id),
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id),
    FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CHECK (valid_from <= COALESCE(valid_until, '9999-12-31')),
    CHECK (application_date <= COALESCE(approval_date, '9999-12-31'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

-- Supporting Table for Membership Types
CREATE TABLE membership_types (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,                    -- regular, lifetime, student
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NULL,
    duration_months INT NULL,                      -- NULL for lifetime
    fee_amount DECIMAL(10,2) NULL,
    fee_currency VARCHAR(3) DEFAULT 'USD',
    benefits_description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT FALSE,
    max_renewals INT NULL,                         -- NULL for unlimited
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

### **4. INFORMAL RELATIONSHIPS: `contact_assignments`**
**Purpose:** Flexible categorization of non-member relationships

```sql
CREATE TABLE contact_assignments (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Core Relationships
    user_id BIGINT UNSIGNED NOT NULL,
    contact_type_id BIGINT UNSIGNED NOT NULL,
    organizational_unit_id BIGINT UNSIGNED NULL,   -- NULL for global assignments
    
    -- Assignment Details
    status ENUM('active', 'inactive') DEFAULT 'active',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by_id BIGINT UNSIGNED NULL,           -- FK to users
    
    -- Metadata
    notes TEXT NULL,
    metadata JSON NULL,                            -- Engagement preferences, interests
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,                     -- Soft delete for assignment history
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_contact_type (contact_type_id),
    INDEX idx_unit_id (organizational_unit_id),
    INDEX idx_status (status),
    UNIQUE INDEX idx_unique_assignment (user_id, contact_type_id, organizational_unit_id),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_type_id) REFERENCES contact_types(id),
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

-- Supporting Table for Contact Types
CREATE TABLE contact_types (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,                    -- donor, volunteer, media_contact
    description TEXT NULL,
    can_login BOOLEAN DEFAULT FALSE,               -- Gets portal access
    default_role_id BIGINT UNSIGNED NULL,          -- Auto-assigned role if can_login
    is_system_type BOOLEAN DEFAULT FALSE,          -- Non-deletable
    display_order INT DEFAULT 0,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_name (name),
    FOREIGN KEY (default_role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB;
```

### **5. ROLE-BASED ACCESS CONTROL (RBAC)**
**Purpose:** Granular, context-aware permission system

```sql
-- Core RBAC Tables
CREATE TABLE roles (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,                    -- admin, treasurer, organizer
    description TEXT NULL,
    is_system_role BOOLEAN DEFAULT FALSE,          -- Non-deletable (e.g., Super Admin)
    scope_type ENUM('global', 'unit', 'self') DEFAULT 'global',
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_name (name)
) ENGINE=InnoDB;

CREATE TABLE permissions (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,                    -- election.vote, finance.approve
    description TEXT NULL,
    module VARCHAR(50) NOT NULL,                   -- election, finance, members
    scope_type ENUM('global', 'unit', 'self') DEFAULT 'global',
    is_system BOOLEAN DEFAULT FALSE,               -- Non-editable
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_name (name),
    INDEX idx_module (module)
) ENGINE=InnoDB;

CREATE TABLE permission_role (
    permission_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (permission_id, role_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Context-Aware Role Assignments
CREATE TABLE role_assignments (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Assignment
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    
    -- Context (HRBAC - Hierarchical RBAC)
    context_type ENUM('global', 'unit', 'project') DEFAULT 'global',
    context_id BIGINT UNSIGNED NULL,               -- organizational_unit_id for unit context
    
    -- Assignment Details
    assigned_by_id BIGINT UNSIGNED NULL,           -- Who granted this role
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP NULL,                    -- Temporary roles
    
    -- Audit
    notes TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,                     -- Soft revocation
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id),
    INDEX idx_context (context_type, context_id),
    INDEX idx_validity (valid_until),
    UNIQUE INDEX idx_unique_assignment (user_id, role_id, context_type, context_id),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (context_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
    
    -- Constraints
    CHECK (valid_from <= COALESCE(valid_until, '9999-12-31 23:59:59'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;
```

### **6. AUTHENTICATION & SECURITY**
**Purpose:** Secure authentication and session management

```sql
-- API/Mobile Authentication Tokens
CREATE TABLE authentication_tokens (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tokenable_type VARCHAR(255) NOT NULL,          -- 'App\Models\User'
    tokenable_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,                    -- 'mobile-app', 'api-access'
    token VARCHAR(64) UNIQUE NOT NULL,
    abilities TEXT NULL,                           -- JSON array of permissions
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_tokenable (tokenable_type, tokenable_id),
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- Password Reset Tokens
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
```

### **7. AUDIT & COMPLIANCE**
**Purpose:** Immutable audit trail for all critical operations

```sql
CREATE TABLE audit_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    
    -- Actor Information
    user_id BIGINT UNSIGNED NULL,                  -- Who performed the action
    user_type VARCHAR(255) NULL,                   -- 'App\Models\User'
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    
    -- Action Details
    event VARCHAR(255) NOT NULL,                   -- 'created', 'updated', 'deleted'
    auditable_type VARCHAR(255) NOT NULL,          -- Model class
    auditable_id BIGINT UNSIGNED NOT NULL,         -- Model ID
    
    -- Change Tracking
    old_values JSON NULL,                          -- Before change (JSON diff)
    new_values JSON NULL,                          -- After change
    url TEXT NULL,
    
    -- Additional Context
    tags JSON NULL,                                -- Custom categorization
    metadata JSON NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes (Critical for Compliance Queries)
    INDEX idx_user (user_id, user_type),
    INDEX idx_auditable (auditable_type, auditable_id),
    INDEX idx_event (event),
    INDEX idx_created_at (created_at),
    INDEX idx_tags ((CAST(tags AS CHAR(100)))),
    
    -- Foreign Key (Optional, for user reference)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;
```

### **8. TENANT CONFIGURATION**
**Purpose:** Tenant-specific settings and customization

```sql
CREATE TABLE tenant_settings (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(255) NOT NULL,             -- 'org_name', 'logo_url', 'theme'
    setting_value TEXT NULL,
    setting_type ENUM('string', 'boolean', 'integer', 'float', 'json', 'array') DEFAULT 'string',
    setting_group VARCHAR(100) DEFAULT 'general',  -- general, appearance, security
    is_public BOOLEAN DEFAULT FALSE,               -- Visible to authenticated users
    is_encrypted BOOLEAN DEFAULT FALSE,            -- Encrypted at rest
    description TEXT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_key_group (setting_key, setting_group),
    INDEX idx_group (setting_group),
    INDEX idx_public (is_public)
) ENGINE=InnoDB;
```

## 🔗 **RELATIONSHIP ARCHITECTURE**

### **Core Relationship Diagram:**
```
                        ┌─────────────────┐
                        │     users       │
                        │  (Identity)    │
                        └────────┬────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼────────┐      ┌────────▼────────┐      ┌────────▼────────┐
│ membership_    │      │ role_           │      │ contact_        │
│ records        │      │ assignments     │      │ assignments     │
│ (Formal)       │      │ (Authority)     │      │ (Informal)      │
└───────┬────────┘      └────────┬────────┘      └─────────────────┘
        │                        │
┌───────▼────────┐      ┌────────▼────────┐
│ organizational │      │ roles           │
│ units          │      │ (Templates)     │
└───────┬────────┘      └────────┬────────┘
        │                        │
        │                 ┌──────▼────────┐
        │                 │ permissions   │
        │                 │ (Capabilities)│
        │                 └───────────────┘
        │
┌───────▼────────┐
│ unit_types     │
│ (Classification)│
└─────────────────┘
```

## 🎯 **HIERARCHICAL FORUM ARCHITECTURE INTEGRATION**

### **Forum Scope Implementation:**
```sql
-- Forum Scope Types (as enum in application logic)
ENUM('direct', 'hierarchical', 'custom')

-- Direct Scope: membership_records.organizational_unit_id = target_unit_id
-- Hierarchical Scope: membership_records.organizational_unit_id IN (target + descendants)
-- Custom Scope: Manual user selection (stored in forum_participants table)
```

### **Nested Set Query for Hierarchical Forums:**
```sql
-- Get all descendant unit IDs for hierarchical forum
WITH RECURSIVE unit_tree AS (
    SELECT id, lft, rgt
    FROM organizational_units
    WHERE id = :target_unit_id  -- e.g., Zone ID
    
    UNION ALL
    
    SELECT ou.id, ou.lft, ou.rgt
    FROM organizational_units ou
    INNER JOIN unit_tree ut ON ou.parent_id = ut.id
)
SELECT id FROM unit_tree;

-- Alternative: Using Nested Set for performance
SELECT descendant.id
FROM organizational_units target
JOIN organizational_units descendant 
    ON descendant.lft BETWEEN target.lft AND target.rgt
WHERE target.id = :target_unit_id;
```

## 🔧 **IMPLEMENTATION STRATEGY**

### **Phase 1: Core Identity & Authentication (Week 1-2)**
```
Priority 1: users, authentication_tokens, password_resets
• Basic user registration/login
• Mobile API authentication
• Email/phone verification
```

### **Phase 2: Organizational Structure (Week 3-4)**
```
Priority 2: organizational_units, unit_types
• Create hierarchy management UI
• Implement nested set maintenance (using kalnoy/nestedset)
• Unit leader assignments
```

### **Phase 3: Membership Management (Week 5-6)**
```
Priority 3: membership_records, membership_types, contact_assignments
• Membership application workflow
• State machine implementation
• Contact categorization
```

### **Phase 4: Authorization & Compliance (Week 7-8)**
```
Priority 4: RBAC tables, audit_logs, tenant_settings
• Granular permission system
• Context-aware role assignments
• Comprehensive audit logging
```

## 📊 **PERFORMANCE OPTIMIZATIONS**

### **Critical Indexes:**
```sql
-- Composite indexes for common queries
CREATE INDEX idx_membership_active 
ON membership_records(status, valid_until) 
WHERE status = 'active';

CREATE INDEX idx_role_context_valid 
ON role_assignments(user_id, context_type, context_id, valid_until);

-- Partitioning strategy for large tenants
ALTER TABLE audit_logs 
PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026)
);
```

### **Caching Strategy:**
```
• Organizational hierarchy: Cache nested set paths
• User permissions: Cache computed permission sets
• Tenant settings: Cache with versioning
• Forum participant lists: Cache with invalidation on membership changes
```

## 🔒 **SECURITY CONSIDERATIONS**

### **Data Protection:**
```
1. National ID: Encrypted at rest (AES-256)
2. Password hashes: bcrypt with high cost factor
3. Audit logs: Immutable, append-only
4. API tokens: Hashed storage, short-lived by default
5. Metadata JSON: Sanitized input, validated output
```

### **Access Control Matrix:**
```
Feature                     | Required Checks
----------------------------|----------------------------------------
View member directory       | membership_records.active OR role assignment
Post in forum               | membership_records.active + unit membership
Approve membership          | role with 'members.approve' + unit scope
View audit logs             | role with 'audit.view' + appropriate scope
Manage organizational units | role with 'units.manage' + parent unit context
```

## 📈 **SCALABILITY METRICS**

### **Performance Targets:**
```
• User authentication: < 100ms 95th percentile
• Permission checks: < 10ms
• Hierarchical member queries: < 50ms for 10k members
• Audit log writes: < 5ms
• Nested set updates: < 100ms for 1k unit hierarchy
```

### **Capacity Planning:**
```
• Users table: 1M+ rows per tenant
• Membership records: 2M+ with proper archiving
• Organizational units: 10k+ with efficient indexing
• Audit logs: Time-based partitioning, 100M+ rows
```

## 🚀 **DEPLOYMENT RECOMMENDATIONS**

### **Database Configuration:**
```ini
[mysqld]
# For nested set performance
innodb_buffer_pool_size = 70% of RAM
innodb_log_file_size = 1G
innodb_flush_log_at_trx_commit = 2

# For JSON performance
max_allowed_packet = 256M
```

### **Laravel Package Recommendations:**
```
1. spatie/laravel-multitenancy: Tenant isolation
2. kalnoy/nestedset: Hierarchical data management
3. spatie/laravel-permission: RBAC foundation
4. owen-it/laravel-auditing: Audit trail
5. laravel/sanctum: API authentication
```

## ✅ **VALIDATION SCENARIOS**

### **Political Party Use Case:**
```
✓ Member joins at ward level (organizational_unit)
✓ Membership requires approval (state machine)
✓ Role: Ward Treasurer (scoped to specific ward)
✓ Voting rights: Active membership + unit location
✓ Forum access: Hierarchical (ward + all sub-units)
```

### **NGO Use Case:**
```
✓ Multiple membership types (regular, student, lifetime)
✓ Volunteers as contact_assignments
✓ Project-based organizational units
✓ Donor management via contact types
✓ Compliance reporting via audit_logs
```

This comprehensive base schema provides:
- **Universal identity management** with flexible authentication
- **Formal/informal relationship tracking** with clear separation
- **Hierarchical organizational structure** with multiple implementation strategies
- **Granular, context-aware permissions** supporting complex political structures
- **Complete audit trail** for compliance and transparency
- **Performance-optimized design** for large-scale deployment

**The architecture is production-ready, scalable to millions of users, and provides clean integration points for specialized modules (Elections, Finance, Communications).**
