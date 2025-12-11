# 🏗️ **UNIVERSAL TENANT_USERS TABLE FOR ALL ORGANIZATION TYPES**

## 📊 **TENANT_USERS TABLE SCHEMA**

```sql
-- ============================================
-- TENANT_USERS (Universal User Table for All Organizations)
-- ============================================
CREATE TABLE tenant_users (
    -- Primary Identification
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- ============================================
    -- SECTION 1: CORE IDENTITY (Universal)
    -- ============================================
    -- Name Fields (Supporting Global Formats)
    title VARCHAR(20) NULL COMMENT 'Mr, Mrs, Ms, Dr, Prof, etc.',
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    preferred_name VARCHAR(100) NULL,
    legal_name VARCHAR(300) NULL COMMENT 'Full legal name as per ID',
    
    -- Display & Sorting
    display_name VARCHAR(300) GENERATED ALWAYS AS (
        CASE 
            WHEN preferred_name IS NOT NULL THEN preferred_name
            WHEN title IS NOT NULL THEN CONCAT(title, ' ', first_name, ' ', last_name)
            ELSE CONCAT(first_name, ' ', last_name)
        END
    ) STORED,
    sort_name VARCHAR(300) GENERATED ALWAYS AS (CONCAT(last_name, ', ', first_name)) STORED,
    
    -- ============================================
    -- SECTION 2: IDENTIFICATION (Global Compliance)
    -- ============================================
    -- Universal ID Fields
    identification_type ENUM(
        'national_id',      -- National ID card
        'passport',         -- Passport
        'drivers_license',  -- Driver's license
        'tax_id',           -- Tax identification number
        'social_security',  -- Social security number
        'voter_id',         -- Voter ID card
        'company_reg',      -- Company registration number
        'other'             -- Other identification
    ) NULL,
    
    identification_number VARCHAR(50) UNIQUE NULL,
    identification_issued_by VARCHAR(100) NULL,
    identification_issued_date DATE NULL,
    identification_expiry_date DATE NULL,
    identification_country VARCHAR(2) NULL COMMENT 'ISO 3166-1 alpha-2',
    
    -- Secondary IDs (For Multiple Jurisdictions)
    secondary_id_type VARCHAR(50) NULL,
    secondary_id_number VARCHAR(50) NULL,
    
    -- ============================================
    -- SECTION 3: BIOGRAPHIC INFORMATION
    -- ============================================
    -- Personal Details
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say', 'not_specified') NULL,
    date_of_birth DATE NULL,
    place_of_birth VARCHAR(100) NULL,
    nationality VARCHAR(100) NULL,
    
    -- Marital & Family
    marital_status ENUM('single', 'married', 'divorced', 'widowed', 'separated', 'civil_union') NULL,
    dependents_count INT DEFAULT 0,
    
    -- Health & Safety (For Events/Meetings)
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown') NULL,
    medical_conditions TEXT NULL COMMENT 'For emergency purposes only',
    emergency_contact_name VARCHAR(200) NULL,
    emergency_contact_phone VARCHAR(20) NULL,
    emergency_contact_relation VARCHAR(50) NULL,
    
    -- ============================================
    -- SECTION 4: CONTACT INFORMATION (Global)
    -- ============================================
    -- Primary Contact
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified_at TIMESTAMP NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    phone_country_code VARCHAR(5) DEFAULT '+1',
    phone_verified_at TIMESTAMP NULL,
    
    -- Alternate Contacts
    alternate_email VARCHAR(255) NULL,
    alternate_phone VARCHAR(20) NULL,
    fax_number VARCHAR(20) NULL,
    
    -- Professional Contact
    work_phone VARCHAR(20) NULL,
    work_email VARCHAR(255) NULL,
    professional_title VARCHAR(100) NULL,
    
    -- ============================================
    -- SECTION 5: ADDRESS INFORMATION (Global Format)
    -- ============================================
    -- Primary Address
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255) NULL,
    address_line_3 VARCHAR(255) NULL,
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100) NULL,
    postal_code VARCHAR(20) NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'US',
    
    -- Address Type & Validation
    address_type ENUM('residential', 'business', 'mailing', 'permanent', 'temporary') DEFAULT 'residential',
    is_address_verified BOOLEAN DEFAULT FALSE,
    address_verified_at TIMESTAMP NULL,
    
    -- Additional Addresses (For Shareholders, International Members)
    alternate_address JSON NULL COMMENT 'Array of alternate addresses',
    
    -- ============================================
    -- SECTION 6: PROFESSIONAL & EDUCATIONAL BACKGROUND
    -- ============================================
    -- Education
    highest_education ENUM(
        'none',
        'primary',
        'secondary',
        'high_school',
        'associate',
        'bachelors',
        'masters',
        'doctorate',
        'professional',
        'other'
    ) NULL,
    
    education_details JSON NULL COMMENT 'Array of educational qualifications',
    
    -- Profession
    profession VARCHAR(100) NULL,
    industry VARCHAR(100) NULL,
    job_title VARCHAR(100) NULL,
    company_name VARCHAR(200) NULL,
    employment_status ENUM(
        'employed',
        'unemployed',
        'self_employed',
        'student',
        'retired',
        'homemaker',
        'disabled',
        'other'
    ) NULL,
    
    work_experience JSON NULL COMMENT 'Array of work experiences',
    
    -- ============================================
    -- SECTION 7: ORGANIZATION-SPECIFIC ROLES
    -- ============================================
    -- Shareholder Information (For Companies)
    shareholder_id VARCHAR(50) NULL UNIQUE,
    shares_owned DECIMAL(20, 4) NULL,
    share_percentage DECIMAL(5, 2) NULL,
    share_class VARCHAR(50) NULL,
    shareholder_since DATE NULL,
    
    -- NGO/Party Specific
    member_number VARCHAR(50) NULL UNIQUE,
    membership_category VARCHAR(50) NULL,
    volunteer_level ENUM('none', 'occasional', 'regular', 'core', 'lead') DEFAULT 'none',
    
    -- Political Party Specific
    party_position VARCHAR(100) NULL,
    constituency VARCHAR(100) NULL,
    election_district VARCHAR(100) NULL,
    
    -- ============================================
    -- SECTION 8: AUTHENTICATION & SECURITY
    -- ============================================
    password_hash VARCHAR(255) NULL,
    password_changed_at TIMESTAMP NULL,
    must_change_password BOOLEAN DEFAULT FALSE,
    
    -- Multi-Factor Authentication
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_method ENUM('none', 'sms', 'email', 'authenticator', 'biometric') DEFAULT 'none',
    mfa_secret VARCHAR(255) NULL,
    
    -- Security & Lockout
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    last_login_at TIMESTAMP NULL,
    last_login_ip VARCHAR(45) NULL,
    last_password_reset_at TIMESTAMP NULL,
    
    -- ============================================
    -- SECTION 9: COMMUNICATION PREFERENCES
    -- ============================================
    communication_preferences JSON NOT NULL DEFAULT '{
        "email": {"marketing": true, "notifications": true, "announcements": true},
        "sms": {"marketing": false, "notifications": true, "alerts": true},
        "push": {"notifications": true, "reminders": true},
        "postal": {"newsletters": false, "official": true}
    }',
    
    preferred_language VARCHAR(10) DEFAULT 'en',
    preferred_timezone VARCHAR(50) DEFAULT 'UTC',
    date_format VARCHAR(20) DEFAULT 'Y-m-d',
    time_format ENUM('12h', '24h') DEFAULT '24h',
    
    -- ============================================
    -- SECTION 10: STATUS & METADATA
    -- ============================================
    -- User Status
    status ENUM(
        'pending',      -- Registered but not verified
        'active',       -- Fully active user
        'inactive',     -- Temporarily inactive
        'suspended',    -- Suspended by admin
        'deactivated',  -- User deactivated account
        'archived',     -- Archived/removed
        'deceased'      -- For record keeping
    ) DEFAULT 'pending',
    
    status_reason TEXT NULL,
    status_changed_at TIMESTAMP NULL,
    status_changed_by_id BIGINT UNSIGNED NULL,
    
    -- Verification Status
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_identity_verified BOOLEAN DEFAULT FALSE,
    is_address_verified BOOLEAN DEFAULT FALSE,
    verification_level ENUM('none', 'basic', 'standard', 'enhanced', 'verified') DEFAULT 'none',
    
    -- Metadata
    metadata JSON NULL COMMENT 'Organization-specific custom fields',
    tenant_id BIGINT UNSIGNED NOT NULL,
    external_id VARCHAR(100) NULL COMMENT 'ID from external system',
    source_system VARCHAR(100) NULL COMMENT 'How user was added (import, api, manual, etc.)',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    archived_at TIMESTAMP NULL,
    
    -- ============================================
    -- SECTION 11: INDEXES (Performance Optimized)
    -- ============================================
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_status (status),
    INDEX idx_tenant (tenant_id),
    INDEX idx_identification (identification_number),
    INDEX idx_member_number (member_number),
    INDEX idx_shareholder_id (shareholder_id),
    INDEX idx_external_id (external_id),
    INDEX idx_created_at (created_at),
    INDEX idx_last_login (last_login_at),
    INDEX idx_date_of_birth (date_of_birth),
    INDEX idx_country (country),
    INDEX idx_city (city),
    INDEX idx_profession (profession),
    INDEX idx_company_name (company_name),
    INDEX idx_verification_level (verification_level),
    FULLTEXT idx_name_search (first_name, middle_name, last_name, preferred_name),
    FULLTEXT idx_professional_search (profession, company_name, job_title),
    
    -- ============================================
    -- SECTION 12: CONSTRAINTS (Data Integrity)
    -- ============================================
    CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE),
    CHECK (phone REGEXP '^\\+[0-9]{1,4}-[0-9]{6,15}$'),
    CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
    CHECK (identification_expiry_date IS NULL OR identification_expiry_date >= identification_issued_date),
    CHECK (shares_owned IS NULL OR shares_owned >= 0),
    CHECK (share_percentage IS NULL OR (share_percentage >= 0 AND share_percentage <= 100)),
    CHECK (failed_login_attempts >= 0),
    CHECK (dependents_count >= 0)
    
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC 
COMMENT='Universal user table for all organization types: Political Parties, NGOs, Companies, Shareholders, etc.';

-- ============================================
-- SUPPORTING TABLES
-- ============================================

-- Professional Qualifications Table
CREATE TABLE tenant_user_qualifications (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    qualification_type VARCHAR(100) NOT NULL,
    institution VARCHAR(200) NOT NULL,
    field_of_study VARCHAR(200) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    grade_result VARCHAR(50) NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_document_path VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_qualification_type (qualification_type),
    FOREIGN KEY (user_id) REFERENCES tenant_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Work Experience Table
CREATE TABLE tenant_user_experience (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    company VARCHAR(200) NOT NULL,
    position VARCHAR(200) NOT NULL,
    industry VARCHAR(100) NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    is_current BOOLEAN DEFAULT FALSE,
    description TEXT NULL,
    achievements JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_company (company),
    INDEX idx_position (position),
    FOREIGN KEY (user_id) REFERENCES tenant_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Skills & Expertise Table
CREATE TABLE tenant_user_skills (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    skill_category VARCHAR(100) NULL,
    proficiency_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
    years_experience INT NULL,
    is_certified BOOLEAN DEFAULT FALSE,
    certification_details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_user_skill (user_id, skill_name),
    INDEX idx_skill_category (skill_category),
    FOREIGN KEY (user_id) REFERENCES tenant_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- User Settings Table
CREATE TABLE tenant_user_settings (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NULL,
    setting_type ENUM('string', 'boolean', 'integer', 'float', 'json', 'array') DEFAULT 'string',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_user_setting (user_id, setting_key),
    FOREIGN KEY (user_id) REFERENCES tenant_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

## 🎯 **UNIVERSAL USE CASES SUPPORTED**

### **1. Political Parties:**
```sql
-- Example: Political Party Member
INSERT INTO tenant_users (
    first_name, last_name, email, phone,
    identification_type, identification_number,
    member_number, membership_category, constituency,
    status, tenant_id
) VALUES (
    'John', 'Doe', 'john@partyname.org', '+1-555-1234567',
    'national_id', '1234567890',
    'PARTY-2024-001234', 'regular_member', 'District 5',
    'active', 1
);
```

### **2. NGOs & Non-Profits:**
```sql
-- Example: NGO Volunteer
INSERT INTO tenant_users (
    first_name, last_name, email, phone,
    profession, volunteer_level,
    communication_preferences, status, tenant_id
) VALUES (
    'Jane', 'Smith', 'jane@ngo.org', '+1-555-9876543',
    'Teacher', 'regular',
    '{"email": {"marketing": true, "notifications": true}, "sms": {"alerts": true}}',
    'active', 2
);
```

### **3. Corporations (Shareholders):**
```sql
-- Example: Corporate Shareholder
INSERT INTO tenant_users (
    first_name, last_name, email, phone,
    shareholder_id, shares_owned, share_percentage,
    company_name, job_title,
    status, tenant_id
) VALUES (
    'Robert', 'Johnson', 'robert@shareholder.com', '+1-555-4567890',
    'SH-2024-5678', 10000.50, 2.75,
    'Tech Corporation Inc.', 'CEO',
    'active', 3
);
```

### **4. Professional Associations:**
```sql
-- Example: Association Member
INSERT INTO tenant_users (
    title, first_name, last_name, email, phone,
    professional_title, highest_education,
    member_number, status, tenant_id
) VALUES (
    'Dr.', 'Sarah', 'Williams', 'sarah@association.org', '+1-555-3456789',
    'Senior Engineer', 'doctorate',
    'ASSOC-2024-7890', 'active', 4
);
```

## 🔧 **CLAUDECLI INSTRUCTIONS FOR UPDATING TENANT_USERS**

### **Step 1: Create Migration Hook**

**File: `.claude/hooks/tenant_users_migration.ts`**
```typescript
import { PreToolUsePayload, HookResponse } from "./lib";

async function validateTenantUsersMigration(payload: PreToolUsePayload): Promise<HookResponse> {
    if (payload.tool_name === "SQL" || payload.tool_name === "Migration") {
        const sql = payload.tool_input.query || '';
        
        // Check if modifying tenant_users table
        if (sql.includes('tenant_users') && 
            (sql.includes('ALTER TABLE') || sql.includes('CREATE TABLE'))) {
            
            // ============================================
            // VALIDATION 1: Check for required universal columns
            // ============================================
            const requiredColumns = [
                'uuid',
                'first_name',
                'last_name', 
                'email',
                'phone',
                'status',
                'tenant_id',
                'created_at',
                'updated_at',
                'deleted_at'
            ];
            
            const missingColumns = requiredColumns.filter(col => 
                !sql.includes(col) && sql.includes('CREATE TABLE')
            );
            
            if (missingColumns.length > 0) {
                return {
                    action: "block",
                    feedback: `🚫 MISSING REQUIRED COLUMNS in tenant_users: ${missingColumns.join(', ')}. All tenant_users tables must include these universal columns.`
                };
            }
            
            // ============================================
            // VALIDATION 2: Check for organization-specific columns
            // ============================================
            const recommendedColumns = [
                'identification_type',
                'identification_number', 
                'address_line_1',
                'city',
                'country',
                'profession',
                'communication_preferences',
                'metadata'
            ];
            
            const missingRecommended = recommendedColumns.filter(col => 
                !sql.includes(col) && sql.includes('CREATE TABLE')
            );
            
            if (missingRecommended.length > 0) {
                return {
                    action: "feedback",
                    feedback: `ℹ️ RECOMMENDED COLUMNS missing: ${missingRecommended.join(', ')}. Consider adding these for better organization support.`
                };
            }
            
            // ============================================
            // VALIDATION 3: Check for proper indexes
            // ============================================
            if (sql.includes('CREATE TABLE') && !sql.includes('INDEX')) {
                return {
                    action: "modify",
                    feedback: "⚡ PERFORMANCE WARNING: Adding recommended indexes for tenant_users table...",
                    modifications: {
                        tool_input: {
                            query: sql.replace(/\);$/, `,\n    INDEX idx_email (email),\n    INDEX idx_phone (phone),\n    INDEX idx_status (status),\n    INDEX idx_tenant (tenant_id),\n    INDEX idx_created_at (created_at)\n);`)
                        }
                    }
                };
            }
            
            // ============================================
            // VALIDATION 4: Check for soft delete support
            // ============================================
            if (sql.includes('CREATE TABLE') && !sql.includes('deleted_at')) {
                return {
                    action: "modify",
                    feedback: "🔄 SOFT DELETE SUPPORT: Adding deleted_at column for soft delete functionality...",
                    modifications: {
                        tool_input: {
                            query: sql.replace(/\);$/, `,\n    deleted_at TIMESTAMP NULL\n);`)
                        }
                    }
                };
            }
            
            // ============================================
            // VALIDATION 5: Check for metadata column
            // ============================================
            if (sql.includes('CREATE TABLE') && !sql.includes('metadata') && !sql.includes('JSON')) {
                return {
                    action: "modify",
                    feedback: "🔧 FLEXIBILITY: Adding metadata JSON column for organization-specific fields...",
                    modifications: {
                        tool_input: {
                            query: sql.replace(/\);$/, `,\n    metadata JSON NULL\n);`)
                        }
                    }
                };
            }
        }
        
        // ============================================
        // VALIDATION 6: Check for dangerous operations
        // ============================================
        if (sql.includes('DROP COLUMN') && sql.includes('tenant_users')) {
            const dangerousColumns = ['uuid', 'email', 'tenant_id', 'created_at'];
            const isDangerous = dangerousColumns.some(col => 
                sql.includes(`DROP COLUMN ${col}`)
            );
            
            if (isDangerous) {
                return {
                    action: "block",
                    feedback: "🚫 DANGEROUS OPERATION: Cannot drop required columns from tenant_users table. These are required for system functionality."
                };
            }
        }
    }
    
    return { action: "continue" };
}

export { validateTenantUsersMigration };
```

### **Step 2: Create Template for Tenant_Users Migrations**

**File: `.claude/templates/tenant_users_migration.sql`**
```sql
-- Template for tenant_users table migrations
-- Use this template for ALL organization types

-- ============================================
-- MIGRATION: {{migration_name}}
-- ORGANIZATION TYPE: {{organization_type}}
-- DESCRIPTION: {{description}}
-- ============================================

-- Always start with checking if table exists
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
                     WHERE table_schema = DATABASE() 
                     AND table_name = 'tenant_users');

SET @migration_action = IF(@table_exists = 0, 'CREATE', 'ALTER');

-- ============================================
-- CREATE/ALTER TENANT_USERS TABLE
-- ============================================
{{#if_eq migration_action "CREATE"}}
CREATE TABLE tenant_users (
    -- PRIMARY IDENTIFICATION (Required)
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- CORE IDENTITY (Required)
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    
    -- ORGANIZATION-SPECIFIC FIELDS
    {{organization_specific_fields}}
    
    -- STATUS & AUDIT (Required)
    status ENUM('pending', 'active', 'inactive', 'suspended', 'archived') DEFAULT 'pending',
    tenant_id BIGINT UNSIGNED NOT NULL,
    
    -- METADATA & EXTENSIBILITY (Recommended)
    metadata JSON NULL,
    
    -- TIMESTAMPS (Required)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- INDEXES (Recommended for Performance)
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_status (status),
    INDEX idx_tenant (tenant_id),
    INDEX idx_created_at (created_at),
    FULLTEXT idx_name_search (first_name, last_name)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;
{{/if_eq}}

{{#if_eq migration_action "ALTER"}}
-- Add organization-specific columns
ALTER TABLE tenant_users
{{#each columns_to_add}}
ADD COLUMN {{this.name}} {{this.type}} {{#if this.default}}DEFAULT {{this.default}}{{/if}} {{#if this.nullable}}NULL{{else}}NOT NULL{{/if}} {{#if this.comment}}COMMENT '{{this.comment}}'{{/if}}{{#unless @last}},{{/unless}}
{{/each}};

-- Add organization-specific indexes
{{#each indexes_to_add}}
CREATE INDEX {{this.name}} ON tenant_users({{this.columns}});
{{/each}}
{{/if_eq}}

-- ============================================
-- DATA MIGRATION (If Needed)
-- ============================================
{{#if data_migration_sql}}
{{data_migration_sql}}
{{/if}}

-- ============================================
-- VERIFICATION
-- ============================================
-- Verify required columns exist
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM information_schema.columns 
WHERE table_schema = DATABASE() 
AND table_name = 'tenant_users'
AND COLUMN_NAME IN ('uuid', 'email', 'phone', 'tenant_id', 'status')
ORDER BY ORDINAL_POSITION;
```

### **Step 3: Create Organization-Specific Column Templates**

**File: `.claude/templates/organization_columns.json`**
```json
{
  "political_party": {
    "required_columns": [
      {"name": "member_number", "type": "VARCHAR(50)", "nullable": true, "comment": "Party membership number"},
      {"name": "membership_category", "type": "VARCHAR(50)", "nullable": true, "comment": "Regular, Lifetime, Youth, etc."},
      {"name": "constituency", "type": "VARCHAR(100)", "nullable": true, "comment": "Political constituency"}
    ],
    "optional_columns": [
      {"name": "party_position", "type": "VARCHAR(100)", "nullable": true},
      {"name": "election_district", "type": "VARCHAR(100)", "nullable": true},
      {"name": "volunteer_level", "type": "ENUM('none', 'occasional', 'regular', 'core', 'lead')", "nullable": true, "default": "'none'"}
    ]
  },
  
  "ngo_nonprofit": {
    "required_columns": [
      {"name": "member_number", "type": "VARCHAR(50)", "nullable": true, "comment": "NGO membership number"},
      {"name": "membership_type", "type": "VARCHAR(50)", "nullable": true, "comment": "Donor, Volunteer, Board, etc."}
    ],
    "optional_columns": [
      {"name": "volunteer_level", "type": "ENUM('none', 'occasional', 'regular', 'core', 'lead')", "nullable": true, "default": "'none'"},
      {"name": "donation_tier", "type": "VARCHAR(50)", "nullable": true},
      {"name": "areas_of_interest", "type": "JSON", "nullable": true}
    ]
  },
  
  "corporation_shareholders": {
    "required_columns": [
      {"name": "shareholder_id", "type": "VARCHAR(50)", "nullable": true, "comment": "Shareholder identification number"},
      {"name": "shares_owned", "type": "DECIMAL(20,4)", "nullable": true},
      {"name": "share_percentage", "type": "DECIMAL(5,2)", "nullable": true}
    ],
    "optional_columns": [
      {"name": "share_class", "type": "VARCHAR(50)", "nullable": true},
      {"name": "shareholder_since", "type": "DATE", "nullable": true},
      {"name": "voting_rights", "type": "BOOLEAN", "nullable": true, "default": "true"}
    ]
  },
  
  "professional_association": {
    "required_columns": [
      {"name": "member_number", "type": "VARCHAR(50)", "nullable": true},
      {"name": "membership_grade", "type": "VARCHAR(50)", "nullable": true, "comment": "Fellow, Member, Associate, Student"}
    ],
    "optional_columns": [
      {"name": "certification_number", "type": "VARCHAR(50)", "nullable": true},
      {"name": "certification_date", "type": "DATE", "nullable": true},
      {"name": "specializations", "type": "JSON", "nullable": true}
    ]
  },
  
  "educational_institution": {
    "required_columns": [
      {"name": "student_faculty_id", "type": "VARCHAR(50)", "nullable": true},
      {"name": "role_type", "type": "ENUM('student', 'faculty', 'staff', 'alumni', 'parent')", "nullable": true}
    ],
    "optional_columns": [
      {"name": "department", "type": "VARCHAR(100)", "nullable": true},
      {"name": "enrollment_year", "type": "YEAR", "nullable": true},
      {"name": "graduation_year", "type": "YEAR", "nullable": true}
    ]
  }
}
```

### **Step 4: Claude CLI Command Templates**

**Template 1: Create Tenant_Users for Specific Organization**
```
CREATE TENANT_USERS TABLE for: [Organization Type]

ORGANIZATION TYPE: [political_party | ngo_nonprofit | corporation_shareholders | professional_association | educational_institution]

SPECIAL REQUIREMENTS:
- [List any specific requirements]

IMPLEMENTATION STEPS:
1. Load organization column template
2. Generate CREATE TABLE with required columns
3. Add organization-specific columns from template
4. Add recommended indexes
5. Add data validation constraints
6. Generate verification SQL

EXPECTED OUTPUT:
- Complete CREATE TABLE statement
- Organization-specific columns
- Proper indexes
- Data validation
- Verification queries

HOOK VALIDATION REQUIRED:
✓ Required universal columns present
✓ Organization-specific columns added
✓ Proper indexes created
✓ Soft delete supported
✓ Metadata column included
```

**Template 2: Add Organization-Specific Columns**
```
ADD ORGANIZATION COLUMNS to tenant_users for: [Organization Type]

EXISTING TABLE STATUS:
- Table exists: Yes/No
- Current columns: [List if known]

NEW COLUMNS TO ADD:
- [Column 1]: [Type, Purpose]
- [Column 2]: [Type, Purpose]
- [Column 3]: [Type, Purpose]

DATA MIGRATION:
- [Data transformation needed?]
- [Default values?]
- [Data validation?]

SAFETY CHECKS:
- Check column doesn't already exist
- Use IF NOT EXISTS
- Add appropriate indexes
- Update existing data if needed

OUTPUT FORMAT:
- ALTER TABLE statements
- Data migration SQL
- Verification queries
```

### **Step 5: Migration Workflow with Claude**

**Workflow Commands:**
```bash
# 1. Check current tenant_users structure
claude "Show me the current structure of tenant_users table"

# 2. Create migration for political party columns
claude "Create migration to add political party specific columns to tenant_users table"

# 3. Verify migration with hooks
claude "Verify the migration SQL against universal tenant_users standards"

# 4. Test with sample data
claude "Generate sample INSERT statements for political party members"

# 5. Create indexes for performance
claude "Add optimal indexes for political party queries on tenant_users"
```

### **Step 6: Update Hook Configuration**

**Update `.claude/settings.json`:**
```json
{
  "hooks": {
    "validateTenantUsersMigration": {
      "command": "bun run .claude/hooks/tenant_users_migration.ts",
      "args": ["validateTenantUsersMigration"],
      "triggers": ["preToolUse", "preCodeGeneration"]
    }
  },
  
  "tenant_users": {
    "universal_requirements": {
      "required_columns": [
        "uuid", "first_name", "last_name", "email", "phone",
        "status", "tenant_id", "created_at", "updated_at", "deleted_at"
      ],
      "required_indexes": [
        "idx_email", "idx_phone", "idx_status", "idx_tenant"
      ],
      "soft_delete": true,
      "metadata_support": true
    },
    
    "organization_templates": [
      "political_party",
      "ngo_nonprofit", 
      "corporation_shareholders",
      "professional_association",
      "educational_institution"
    ],
    
    "validation_rules": {
      "email_format": "RFC 5322",
      "phone_format": "E.164 compatible",
      "uuid_version": "UUIDv4",
      "status_values": ["pending", "active", "inactive", "suspended", "archived"]
    }
  }
}
```

## ✅ **VERIFICATION CHECKLIST**

**Before Any tenant_users Migration:**
- [ ] Universal required columns present
- [ ] Proper indexes defined
- [ ] Soft delete supported (`deleted_at`)
- [ ] Metadata column for extensibility
- [ ] Tenant isolation (`tenant_id`)
- [ ] UUID for global uniqueness
- [ ] Proper data types for international support
- [ ] Communication preferences column
- [ ] Status management column

**Organization-Specific Validation:**
- [ ] Appropriate organization columns added
- [ ] Proper constraints for business rules
- [ ] Indexes for organization-specific queries
- [ ] Data validation rules
- [ ] Migration path for existing data
- [ ] Backward compatibility maintained

This setup ensures Claude CLI:
1. **Maintains universal standards** across all tenants
2. **Adds organization-specific features** appropriately
3. **Prevents breaking changes** to core structure
4. **Optimizes for performance** with proper indexes
5. **Ensures data integrity** with validation
6. **Supports all organization types** flexibly