# Database Architecture Blueprint: Landlord vs Tenant Schema Allocation

## **🎯 ARCHITECTURAL DECISION FRAMEWORK**

Based on 15+ years of enterprise SaaS experience, here's the definitive classification for your political party platform:

### **📊 CRITICAL ARCHITECTURAL RULES**

| **Rule** | **Landlord Database** | **Tenant Database** |
|----------|------------------------|----------------------|
| **Data Scope** | Cross-tenant, platform-wide | Single tenant, private data |
| **Who Updates** | Platform administrators only | Tenant administrators/members |
| **Example Data** | Nepal's 77 districts list | "John Doe's membership in Party X" |
| **Performance** | Read-heavy, rarely changes | Read/write heavy, frequent updates |
| **Backup Strategy** | Daily snapshots | Tenant-controlled frequency |

---

## **🏢 LANDLORD DATABASE SCHEMA**

### **Core Geographic Reference (Immutable)**
```sql
-- MASTER: Nepal's Administrative Structure (Never changes per tenant)
CREATE TABLE geo_provinces (
    id TINYINT UNSIGNED PRIMARY KEY, -- Static 1-7
    iso_code VARCHAR(10) UNIQUE NOT NULL, -- 'NP-P1' to 'NP-P7'
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    capital_city VARCHAR(100),
    total_districts TINYINT UNSIGNED,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_iso_code (iso_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB COMMENT='Master list of Nepal''s 7 provinces';

CREATE TABLE geo_districts (
    id SMALLINT UNSIGNED PRIMARY KEY, -- Static 1-77
    province_id TINYINT UNSIGNED NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    headquarter_en VARCHAR(100),
    headquarter_np VARCHAR(100),
    cbs_code VARCHAR(10) UNIQUE, -- Central Bureau of Statistics code
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (province_id) REFERENCES geo_provinces(id),
    INDEX idx_province (province_id),
    INDEX idx_cbs_code (cbs_code)
) ENGINE=InnoDB COMMENT='Master list of Nepal''s 77 districts';

CREATE TABLE geo_local_levels (
    id MEDIUMINT UNSIGNED PRIMARY KEY, -- Up to 753
    district_id SMALLINT UNSIGNED NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    type ENUM('Metropolitan City', 'Sub-Metropolitan City', 'Municipality', 'Rural Municipality') NOT NULL,
    grade ENUM('A', 'B', 'C', 'D'),
    total_wards TINYINT UNSIGNED DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (district_id) REFERENCES geo_districts(id),
    INDEX idx_district (district_id),
    INDEX idx_type (type)
) ENGINE=InnoDB COMMENT='Master list of all local levels (Palikas)';

CREATE TABLE geo_wards (
    id INT UNSIGNED PRIMARY KEY, -- Up to ~6,743
    local_level_id MEDIUMINT UNSIGNED NOT NULL,
    ward_number TINYINT UNSIGNED NOT NULL,
    name_en VARCHAR(100),
    name_np VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (local_level_id) REFERENCES geo_local_levels(id),
    UNIQUE KEY uk_local_level_ward (local_level_id, ward_number),
    INDEX idx_ward_number (ward_number)
) ENGINE=InnoDB COMMENT='Master list of all wards in Nepal';
```

### **Platform Management Tables**
```sql
-- MASTER: Tenant Registry & Billing
CREATE TABLE tenants (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    party_name VARCHAR(200) NOT NULL,
    party_acronym VARCHAR(50),
    party_logo_url VARCHAR(500),
    database_name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'tenant_ncp_001'
    status ENUM('pending', 'active', 'suspended', 'terminated') DEFAULT 'pending',
    subscription_plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'basic',
    billing_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_database_name (database_name),
    INDEX idx_uuid (uuid)
) ENGINE=InnoDB COMMENT='Registry of all political parties (tenants)';

-- MASTER: Global Skills Taxonomy (For volunteer mobilization)
CREATE TABLE global_skills (
    id MEDIUMINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    category ENUM('Legal', 'Medical', 'Technical', 'Creative', 'Administrative', 'Fieldwork', 'Education') NOT NULL,
    skill_name_en VARCHAR(100) UNIQUE NOT NULL,
    skill_name_np VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_order SMALLINT UNSIGNED DEFAULT 0,
    
    INDEX idx_category (category),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB COMMENT='Global skills taxonomy for all parties';

-- MASTER: Platform Audit & Security
CREATE TABLE platform_audit_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT UNSIGNED NULL,
    user_id BIGINT UNSIGNED NULL, -- If cross-tenant admin
    action_type VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tenant_action (tenant_id, action_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB COMMENT='Platform-wide security audit log';
```

---

## **🔐 TENANT DATABASE SCHEMA (Per Political Party)**

### **Organizational Hierarchy (Party-Specific)**
```sql
-- TENANT: Party's Internal Structure (Nested Sets + Materialized Path)
CREATE TABLE organizational_units (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Hierarchy Implementation (Hybrid Model)
    parent_id BIGINT UNSIGNED NULL,
    lft INT UNSIGNED NOT NULL,
    rgt INT UNSIGNED NOT NULL,
    depth TINYINT UNSIGNED NOT NULL DEFAULT 0,
    materialized_path VARCHAR(500) NULL, -- e.g., "1/3/15/"
    
    -- Core Identity
    unit_type ENUM('HEADQUARTERS', 'PROVINCE', 'DISTRICT', 'PALIKA', 'WARD', 'CELL') NOT NULL,
    code VARCHAR(50) NOT NULL, -- e.g., 'KTM-WARD-32'
    name VARCHAR(200) NOT NULL, -- e.g., 'Kathmandu Ward 32 Committee'
    description TEXT,
    
    -- Landlord Reference (No Foreign Key - Logical Only)
    landlord_province_id TINYINT UNSIGNED NULL,
    landlord_district_id SMALLINT UNSIGNED NULL,
    landlord_local_level_id MEDIUMINT UNSIGNED NULL,
    landlord_ward_id INT UNSIGNED NULL,
    
    -- Leadership
    leader_id BIGINT UNSIGNED NULL, -- References users.id
    leader_title VARCHAR(100) DEFAULT 'President',
    
    -- Contact Information (JSON for flexibility)
    contact_data JSON, -- {phone: '', email: '', address: ''}
    
    -- Statistics (Denormalized - Updated via Triggers)
    total_members INT UNSIGNED DEFAULT 0,
    active_members INT UNSIGNED DEFAULT 0,
    pending_members INT UNSIGNED DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    established_date DATE NULL,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- CRITICAL INDEXES
    INDEX idx_hierarchy (lft, rgt),
    INDEX idx_parent (parent_id),
    INDEX idx_path (materialized_path(100)),
    INDEX idx_unit_type (unit_type),
    INDEX idx_landlord_refs (landlord_province_id, landlord_district_id, landlord_local_level_id),
    INDEX idx_leader (leader_id),
    UNIQUE KEY uk_code_parent (parent_id, code)
) ENGINE=InnoDB COMMENT='Party''s internal organizational structure';

-- TENANT: Database Triggers for Real-time Counts
DELIMITER //

CREATE TRIGGER after_membership_insert
AFTER INSERT ON memberships
FOR EACH ROW
BEGIN
    UPDATE organizational_units
    SET total_members = total_members + 1,
        pending_members = pending_members + IF(NEW.status = 'pending', 1, 0)
    WHERE id = NEW.organizational_unit_id;
    
    -- Update all ancestors (using Nested Sets)
    UPDATE organizational_units ou
    JOIN organizational_units child ON child.id = NEW.organizational_unit_id
    SET ou.total_members = ou.total_members + 1,
        ou.pending_members = ou.pending_members + IF(NEW.status = 'pending', 1, 0)
    WHERE ou.lft <= child.lft AND ou.rgt >= child.rgt;
END //

CREATE TRIGGER after_membership_status_update
AFTER UPDATE ON memberships
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        IF NEW.status = 'active' AND OLD.status = 'pending' THEN
            UPDATE organizational_units
            SET active_members = active_members + 1,
                pending_members = pending_members - 1
            WHERE id = NEW.organizational_unit_id;
            
            UPDATE organizational_units ou
            JOIN organizational_units child ON child.id = NEW.organizational_unit_id
            SET ou.active_members = ou.active_members + 1,
                ou.pending_members = ou.pending_members - 1
            WHERE ou.lft <= child.lft AND ou.rgt >= child.rgt;
        END IF;
    END IF;
END //

DELIMITER ;
```

### **Membership Management (Tenant-Specific)**
```sql
-- TENANT: Core Identity (Extends Landlord's authentication if needed)
CREATE TABLE users (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Authentication (Could be separate service)
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(300) GENERATED ALWAYS AS (CONCAT(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name)) STORED,
    date_of_birth DATE NOT NULL,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    
    -- Geographic Assignment (Linked to organizational_units)
    organizational_unit_id BIGINT UNSIGNED NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    email_verified_at TIMESTAMP NULL,
    phone_verified_at TIMESTAMP NULL,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_org_unit (organizational_unit_id),
    INDEX idx_full_name (full_name),
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id)
) ENGINE=InnoDB COMMENT='Party members and users';

-- TENANT: Membership Records (eKYC focused)
CREATE TABLE memberships (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Relationships
    user_id BIGINT UNSIGNED UNIQUE NOT NULL,
    organizational_unit_id BIGINT UNSIGNED NOT NULL,
    membership_type_id BIGINT UNSIGNED NOT NULL,
    
    -- Core Membership Data
    membership_number VARCHAR(50) UNIQUE NOT NULL, -- Generated: PARTY-2025-001
    tier ENUM('general', 'active', 'cadre', 'life_member') DEFAULT 'general',
    status ENUM('draft', 'pending', 'verified', 'active', 'suspended', 'expired', 'rejected') DEFAULT 'draft',
    
    -- eKYC Documents
    citizenship_number VARCHAR(50) UNIQUE,
    citizenship_issue_date DATE,
    citizenship_issue_district VARCHAR(100),
    document_photo_url VARCHAR(500), -- Citizenship scan
    profile_photo_url VARCHAR(500),
    
    -- Membership Period
    joined_date DATE NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NULL, -- NULL for lifetime
    renewal_due_date DATE,
    
    -- Payment
    payment_status ENUM('pending', 'paid', 'partial', 'waived') DEFAULT 'pending',
    payment_amount DECIMAL(10,2) DEFAULT 0.00,
    payment_date DATE NULL,
    
    -- Verification Workflow
    verified_by_id BIGINT UNSIGNED NULL,
    verified_at TIMESTAMP NULL,
    verification_notes TEXT,
    
    -- Referral System
    referred_by_user_id BIGINT UNSIGNED NULL,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_membership_number (membership_number),
    INDEX idx_status (status),
    INDEX idx_citizenship (citizenship_number),
    INDEX idx_payment_status (payment_status),
    INDEX idx_org_unit_status (organizational_unit_id, status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id),
    FOREIGN KEY (verified_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Membership records with eKYC';

-- TENANT: Membership Types Configuration
CREATE TABLE membership_types (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL, -- 'regular', 'student', 'life'
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100),
    description TEXT,
    fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    duration_months INT NULL, -- NULL = lifetime
    can_vote BOOLEAN DEFAULT FALSE,
    can_hold_office BOOLEAN DEFAULT FALSE,
    min_age TINYINT UNSIGNED NULL,
    max_age TINYINT UNSIGNED NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_code (code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB COMMENT='Configurable membership types';
```

### **Forum System (Tenant-Specific)**
```sql
-- TENANT: Forum Categories (Party-specific discussion areas)
CREATE TABLE forum_categories (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100),
    description TEXT,
    parent_id BIGINT UNSIGNED NULL,
    display_order INT DEFAULT 0,
    
    -- Geographic Scope
    geographic_scope ENUM('national', 'province', 'district', 'palika', 'ward', 'unit') DEFAULT 'national',
    organizational_unit_id BIGINT UNSIGNED NULL, -- If scoped to specific unit
    
    -- Permissions
    min_membership_tier ENUM('general', 'active', 'cadre') DEFAULT 'general',
    can_post ENUM('all', 'verified', 'active_only', 'moderators') DEFAULT 'verified',
    can_view ENUM('all', 'members', 'verified') DEFAULT 'members',
    
    -- Statistics (Denormalized)
    total_posts INT UNSIGNED DEFAULT 0,
    total_comments INT UNSIGNED DEFAULT 0,
    last_post_at TIMESTAMP NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (parent_id) REFERENCES forum_categories(id),
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id),
    INDEX idx_scope (geographic_scope, organizational_unit_id),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB COMMENT='Discussion categories with geographic scoping';

-- TENANT: Forum Posts
CREATE TABLE forum_posts (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    
    -- Content
    category_id BIGINT UNSIGNED NOT NULL,
    author_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    
    -- Geographic Tagging
    organizational_unit_id BIGINT UNSIGNED NOT NULL, -- Where posted from
    
    -- Moderation
    status ENUM('draft', 'published', 'hidden', 'flagged', 'archived') DEFAULT 'draft',
    moderated_by_id BIGINT UNSIGNED NULL,
    moderated_at TIMESTAMP NULL,
    moderation_notes TEXT,
    
    -- Engagement
    view_count INT UNSIGNED DEFAULT 0,
    upvote_count INT UNSIGNED DEFAULT 0,
    downvote_count INT UNSIGNED DEFAULT 0,
    comment_count INT UNSIGNED DEFAULT 0,
    
    -- Pinning
    is_pinned BOOLEAN DEFAULT FALSE,
    pinned_until TIMESTAMP NULL,
    
    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL,
    
    -- Indexes
    FULLTEXT idx_content_search (title, content),
    INDEX idx_category_status (category_id, status),
    INDEX idx_author (author_id),
    INDEX idx_org_unit (organizational_unit_id),
    INDEX idx_published (published_at),
    INDEX idx_pinned (is_pinned, pinned_until),
    FOREIGN KEY (category_id) REFERENCES forum_categories(id),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id),
    FOREIGN KEY (moderated_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Forum posts with geographic context';

-- TENANT: Forum Comments (Threaded)
CREATE TABLE forum_comments (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT UNSIGNED NOT NULL,
    author_id BIGINT UNSIGNED NOT NULL,
    parent_id BIGINT UNSIGNED NULL, -- For threaded replies
    content TEXT NOT NULL,
    
    -- Moderation
    status ENUM('published', 'hidden', 'flagged') DEFAULT 'published',
    
    -- Engagement
    upvote_count INT UNSIGNED DEFAULT 0,
    downvote_count INT UNSIGNED DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_post (post_id),
    INDEX idx_author (author_id),
    INDEX idx_parent (parent_id),
    INDEX idx_status (status),
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES forum_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Threaded comments on forum posts';
```

### **Gamification & Skills (Tenant-Specific)**
```sql
-- TENANT: Member Profiles & Skills
CREATE TABLE member_profiles (
    id BIGINT UNSIGNED PRIMARY KEY,
    user_id BIGINT UNSIGNED UNIQUE NOT NULL,
    
    -- Professional Info
    bio TEXT,
    occupation VARCHAR(150),
    education_level ENUM('below_secondary', 'secondary', 'bachelor', 'master', 'phd', 'other'),
    field_of_study VARCHAR(150),
    
    -- Social Links
    facebook_url VARCHAR(255),
    twitter_url VARCHAR(255),
    linkedin_url VARCHAR(255),
    
    -- Volunteer Preferences
    is_volunteer BOOLEAN DEFAULT FALSE,
    availability_hours_per_week TINYINT UNSIGNED DEFAULT 0,
    preferred_contact_method ENUM('sms', 'whatsapp', 'email', 'call') DEFAULT 'whatsapp',
    
    -- Privacy
    profile_visibility ENUM('public', 'members', 'unit_only', 'private') DEFAULT 'members',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_is_volunteer (is_volunteer),
    INDEX idx_visibility (profile_visibility)
) ENGINE=InnoDB COMMENT='Extended member profiles';

-- TENANT: Member Skills (References global_skills IDs)
CREATE TABLE member_skills (
    member_id BIGINT UNSIGNED NOT NULL,
    skill_id MEDIUMINT UNSIGNED NOT NULL, -- References landlord.global_skills.id (logically)
    proficiency ENUM('beginner', 'intermediate', 'expert') DEFAULT 'intermediate',
    verified_by_id BIGINT UNSIGNED NULL,
    verified_at TIMESTAMP NULL,
    
    PRIMARY KEY (member_id, skill_id),
    INDEX idx_skill_proficiency (skill_id, proficiency),
    FOREIGN KEY (member_id) REFERENCES member_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Member skills referencing global taxonomy';

-- TENANT: Activity Log & Gamification
CREATE TABLE activity_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    
    -- Action Details
    activity_type ENUM(
        'forum_post', 'forum_comment', 'forum_upvote',
        'member_referral', 'payment_made', 'event_attendance',
        'document_upload', 'profile_completion', 'volunteer_hours'
    ) NOT NULL,
    
    -- Points
    points_awarded INT NOT NULL DEFAULT 0,
    
    -- Reference
    reference_type VARCHAR(50), -- e.g., 'ForumPost', 'Payment'
    reference_id BIGINT UNSIGNED NULL,
    
    -- Context
    metadata JSON,
    ip_address VARCHAR(45),
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_activity (user_id, activity_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB COMMENT='Member activity log for gamification';

-- TENANT: Contribution Points Summary
CREATE TABLE contribution_points (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    total_points_all_time INT UNSIGNED DEFAULT 0,
    current_points_balance INT UNSIGNED DEFAULT 0,
    rank_tier ENUM('bronze', 'silver', 'gold', 'platinum', 'diamond') DEFAULT 'bronze',
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_rank_tier (rank_tier)
) ENGINE=InnoDB COMMENT='Denormalized points summary for performance';
```

---

## **🎯 CRITICAL DECISION MATRIX**

### **Where does each table belong?**

| **Table** | **Database** | **Reason** | **Example Data** |
|-----------|--------------|------------|------------------|
| `geo_provinces` | Landlord | Nationwide, never changes | Nepal's 7 provinces |
| `geo_districts` | Landlord | Central reference | 77 districts of Nepal |
| `tenants` | Landlord | Platform management | Party registry |
| `global_skills` | Landlord | Standard taxonomy | "Legal", "Medical" skills |
| `organizational_units` | Tenant | Party-specific hierarchy | "Kathmandu Ward 32 Committee" |
| `memberships` | Tenant | Private member data | "John Doe's membership" |
| `forum_posts` | Tenant | Internal discussions | Party policy discussions |
| `member_skills` | Tenant | Links to global skills | "John has Legal skill at expert level" |

### **Reference Strategy Between Databases**
```sql
-- TENANT TABLE EXAMPLE: How to reference landlord data
CREATE TABLE tenant_table (
    id BIGINT UNSIGNED PRIMARY KEY,
    
    -- Store landlord IDs (NO FOREIGN KEY)
    landlord_province_id TINYINT UNSIGNED, -- References landlord.geo_provinces.id
    landlord_district_id SMALLINT UNSIGNED, -- References landlord.geo_districts.id
    landlord_skill_id MEDIUMINT UNSIGNED, -- References landlord.global_skills.id
    
    -- Application logic validates these exist
    CHECK (landlord_province_id BETWEEN 1 AND 7)
);
```

### **Cross-Database Query Pattern**
```php
// In your application code (NOT SQL joins):
class MemberService
{
    public function getMemberWithGeography(Member $member)
    {
        // 1. Get tenant data
        $memberData = $member->load('profile', 'skills');
        
        // 2. Get landlord geography data
        $geography = LandlordDatabase::connection()
            ->table('geo_provinces')
            ->join('geo_districts', ...)
            ->where('geo_districts.id', $member->landlord_district_id)
            ->first();
        
        // 3. Merge in application layer
        return [
            'member' => $memberData,
            'geography' => $geography,
            'skills' => $this->resolveSkillNames($member->skills)
        ];
    }
    
    private function resolveSkillNames($skills)
    {
        // Resolve skill IDs to names from landlord
        $skillIds = $skills->pluck('skill_id');
        return LandlordDatabase::connection()
            ->table('global_skills')
            ->whereIn('id', $skillIds)
            ->get();
    }
}
```

---

## **🚀 IMPLEMENTATION ROADMAP**

### **Phase 1: Foundation (Week 1)**
1. **Create Landlord Database** with `geo_*` tables
2. **Seed with Nepal's administrative data** (7 provinces, 77 districts, 753 palikas, ~6,743 wards)
3. **Create Tenant Database Template** with empty schema
4. **Build Tenant Onboarding Script** that creates new database with seeded `organizational_units`

### **Phase 2: Core Membership (Week 2-3)**
1. **Implement User/Membership tables** in tenant schema
2. **Build eKYC pipeline** with document upload
3. **Create verification workflow** with geographic permissions
4. **Implement database triggers** for real-time counts

### **Phase 3: Forum System (Week 4)**
1. **Build forum tables** with geographic scoping
2. **Implement permission system** based on membership tier
3. **Add gamification tables** and triggers
4. **Create search indexes** for forum content

### **Phase 4: Integration (Week 5)**
1. **Build dashboard queries** that combine landlord/tenant data
2. **Implement export functionality** with proper data merging
3. **Add audit logging** for cross-tenant operations
4. **Performance optimization** with caching layer

---

## **⚠️ CRITICAL WARNINGS**

1. **NEVER JOIN** across landlord and tenant databases in SQL
2. **ALWAYS VALIDATE** landlord references exist in application code
3. **IMPLEMENT CACHING** for landlord data (changes rarely)
4. **BACKUP STRATEGY**: Landlord daily, Tenant per party policy
5. **MIGRATION STRATEGY**: Separate migrations for landlord vs tenant schemas

## **📋 NEXT ACTION**

```bash
# 1. Create landlord database
claude "Create the complete landlord SQL schema with:
- geo_provinces, geo_districts, geo_local_levels, geo_wards
- tenants table for party registry
- global_skills taxonomy
- platform_audit_logs
Include proper indexes and constraints."

# 2. Create tenant database template
claude "Create the tenant database template SQL with:
- organizational_units (nested sets implementation)
- users and memberships (eKYC focused)
- forum tables with geographic scoping
- gamification tables
- ALL necessary triggers for real-time counts
Include comprehensive indexes and foreign keys."
```

**Which should we create first: Landlord schema or Tenant template?** I recommend starting with the Landlord database since it's the foundation all tenants reference.