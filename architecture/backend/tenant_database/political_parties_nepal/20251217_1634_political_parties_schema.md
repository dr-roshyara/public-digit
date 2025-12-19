CREATE TABLE provinces (
    id SERIAL PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL UNIQUE,    -- e.g., 'Koshi Province'
    name_np VARCHAR(100) NOT NULL,           -- e.g., 'कोशी प्रदेश'
    iso_code CHAR(5) NOT NULL UNIQUE,        -- Standard ISO codes (NP-P1 to NP-P7)
    headquarter_en VARCHAR(100),             -- e.g., 'Biratnagar'
    headquarter_np VARCHAR(100),             -- e.g., 'विराटनगर'
    total_districts INT                      -- Useful for quick dashboard stats
);
ID,Name (English),Name (Nepali),ISO Code,Headquarter
1,Koshi Province,कोशी प्रदेश,NP-P1,Biratnagar
2,Madhesh Province,मधेश प्रदेश,NP-P2,Janakpur
3,Bagmati Province,बागमती प्रदेश,NP-P3,Hetauda
4,Gandaki Province,गण्डकी प्रदेश,NP-P4,Pokhara
5,Lumbini Province,लुम्बिनी प्रदेश,NP-P5,Deukhuri (Dang)
6,Karnali Province,कर्णाली प्रदेश,NP-P6,Birendranagar
7,Sudurpashchim Province,सुदूरपश्चिम प्रदेश,NP-P7,Godawari (Kailali)

## districts.sql
CREATE TABLE districts (
    id SERIAL PRIMARY KEY,
    province_id INT NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
    name_en VARCHAR(100) NOT NULL UNIQUE,      -- e.g., 'Jhapa', 'Kathmandu'
    name_np VARCHAR(100) NOT NULL,             -- e.g., 'झापा', 'काठमाडौँ'
    headquarter_en VARCHAR(100),               -- e.g., 'Bhadrapur'
    headquarter_np VARCHAR(100),               -- e.g., 'भद्रपुर'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
e.g. 
CREATE TABLE districts (
    id SERIAL PRIMARY KEY,
    province_id INT NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
    name_en VARCHAR(100) NOT NULL UNIQUE,      -- e.g., 'Jhapa', 'Kathmandu'
    name_np VARCHAR(100) NOT NULL,             -- e.g., 'झापा', 'काठमाडौँ'
    headquarter_en VARCHAR(100),               -- e.g., 'Bhadrapur'
    headquarter_np VARCHAR(100),               -- e.g., 'भद्रपुर'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
#local levels 
CREATE TABLE local_levels (
    id SERIAL PRIMARY KEY,
    district_id INT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    name_en VARCHAR(100) NOT NULL,
    name_np VARCHAR(100) NOT NULL,
    
    -- Administrative Type
    type ENUM(
        'Metropolitan City',      -- Mahanagarpalika (6)
        'Sub-Metropolitan City',  -- Upmahanagarpalika (11)
        'Municipality',           -- Nagarpalika (276)
        'Rural Municipality'      -- Gaunpalika (460)
    ) NOT NULL,

    -- Accessibility Grade (Government Classification)
    grade ENUM('A', 'B', 'C', 'D'), -- A: Far Remote, D: Accessible
    
    total_wards INT DEFAULT 0,
    website_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
# wards 
CREATE TABLE wards (
    id SERIAL PRIMARY KEY,
    palika_id INT NOT NULL REFERENCES local_levels(id) ON DELETE CASCADE,
    ward_number INT NOT NULL, -- e.g., 1, 2, 3...
    ward_address_en VARCHAR(255), -- e.g., 'Kapan', 'Baneshwor'
    ward_address_np VARCHAR(255), -- e.g., 'कपन्', 'बानेश्वर'
    
    -- Political Metadata
    total_voters_estimate INT, 
    ward_president_id INT REFERENCES users(id), -- Link to the user who is the Party's Ward President
    
    UNIQUE(palika_id, ward_number) -- Prevents duplicate Ward 1 in the same Palika
);
#
-- 1. Definition of all possible roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name_en VARCHAR(100) UNIQUE, -- e.g., 'Ward President', 'Central Secretary'
    role_name_np VARCHAR(100),        -- e.g., 'वडा अध्यक्ष', 'केन्द्रीय सचिव'
    hierarchy_level ENUM('Central', 'Province', 'District', 'Palika', 'Ward', 'General') NOT NULL,
    can_verify_members BOOLEAN DEFAULT FALSE,
    can_moderate_forum BOOLEAN DEFAULT FALSE,
    can_access_finance BOOLEAN DEFAULT FALSE
);

-- 2. Assignment of roles to specific members
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role_id INT REFERENCES roles(id),
    
    -- Scope: Which specific geography does this role apply to?
    province_id INT REFERENCES provinces(id),
    district_id INT REFERENCES districts(id),
    palika_id INT REFERENCES local_levels(id),
    ward_id INT REFERENCES wards(id),
    
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
e.g. 
Role Name (English),Role Name (Nepali),Level,Permissions in Your System
Chairman / President,अध्यक्ष,All Levels,Full view of all members in their jurisdiction.
Secretary,सचिव,All Levels,Can verify new membership applications and moderate forums.
Treasurer,कोषाध्यक्ष,All Levels,Access to payments and donations tables for auditing.
Spokesperson,प्रवक्ता,Central/Dist,"Permission to post ""Official Announcements"" (pinned posts)."
Active Member,क्रियाशील सदस्य,Ward/General,Can vote in internal polls and post in forums.
General Member,साधारण सदस्य,General,Read-only access to forums; can pay fees.

#membership 
CREATE TABLE memberships (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id),
    membership_number VARCHAR(50) UNIQUE, -- Auto-generated (e.g., PARTY-2025-001)
    
    -- Status and Tier
    tier ENUM('General', 'Active', 'Cadre', 'Life_Member') DEFAULT 'General',
    status ENUM('Pending', 'Verified', 'Rejected', 'Suspended') DEFAULT 'Pending',
    
    -- Identification for e-KYC
    citizenship_number VARCHAR(50),
    voter_id_number VARCHAR(50),
    document_photo_url VARCHAR(255), -- Link to citizenship/NID photo
    
    -- Membership period
    joined_date DATE,
    expiry_date DATE,
    
    -- Reference for internal tracking
    referred_by_user_id INT REFERENCES users(id)
);
#
-- For high-level topics (e.g., Agriculture, Education, Local Infrastructure)
CREATE TABLE forum_categories (
    id SERIAL PRIMARY KEY,
    name_en VARCHAR(100),
    name_np VARCHAR(100),
    is_restricted BOOLEAN DEFAULT FALSE -- TRUE if only Active Members can view
);

-- The actual posts
CREATE TABLE forum_posts (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES forum_categories(id),
    author_id INT REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    
    -- Geographic tagging (so posts can be shown only to specific areas)
    province_id INT REFERENCES provinces(id),
    district_id INT REFERENCES districts(id),
    palika_id INT REFERENCES local_levels(id),
    ward_id INT REFERENCES wards(id),
    
    status ENUM('Published', 'Hidden', 'Flagged') DEFAULT 'Published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
#
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_purpose ENUM('Membership_Fee', 'Monthly_Levy', 'Donation'),
    payment_method ENUM('eSewa', 'Khalti', 'ConnectIPS', 'Bank_Transfer'),
    transaction_id VARCHAR(100) UNIQUE,
    payment_status ENUM('Success', 'Pending', 'Failed'),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

# organizational units 
mysql> describe organizational_units;
+-------------------+-----------------+------+-----+---------+-------------------+
| Field             | Type            | Null | Key | Default | Extra             |
+-------------------+-----------------+------+-----+---------+-------------------+
| id                | bigint unsigned | NO   | PRI | NULL    | auto_increment    |
| uuid              | char(36)        | NO   | UNI | uuid()  | DEFAULT_GENERATED |
| parent_id         | bigint unsigned | YES  | MUL | NULL    |                   |
| lft               | int             | YES  | MUL | NULL    |                   |
| rgt               | int             | YES  | MUL | NULL    |                   |
| depth             | int             | NO   | MUL | 0       |                   |
| materialized_path | varchar(500)    | YES  | MUL | NULL    |                   |
| unit_type         | varchar(100)    | NO   | MUL | NULL    |                   |
| code              | varchar(50)     | NO   |     | NULL    |                   |
| name              | varchar(200)    | NO   |     | NULL    |                   |
| description       | text            | YES  |     | NULL    |                   |
| location_data     | json            | YES  |     | NULL    |                   |
| leader_id         | bigint unsigned | YES  | MUL | NULL    |                   |
| leader_title      | varchar(100)    | YES  |     | NULL    |                   |
| contact_data      | json            | YES  |     | NULL    |                   |
| is_active         | tinyint(1)      | NO   | MUL | 1       |                   |
| tenant_id         | bigint unsigned | NO   | MUL | NULL    |                   |
| total_members     | int unsigned    | NO   |     | 0       |                   |
| active_members    | int unsigned    | NO   |     | 0       |                   |
| settings          | json            | YES  |     | NULL    |                   |
| metadata          | json            | YES  |     | NULL    |                   |
| created_by_id     | bigint unsigned | YES  |     | NULL    |                   |
| updated_by_id     | bigint unsigned | YES  |     | NULL    |                   |
| created_at        | timestamp       | YES  |     | NULL    |                   |
| updated_at        | timestamp       | YES  |     | NULL    |                   |
| deleted_at        | timestamp       | YES  |     | NULL    |                   |
+-------------------+-----------------+------+-----+---------+-------------------+
26 rows in set (0.03 sec)
CREATE TABLE organizational_units (
    -- Primary Keys & Identifiers
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    tenant_id BIGINT UNSIGNED NOT NULL, -- Supports multi-party or multi-wing setups
    
    -- Hierarchical Structure (Hybrid Model)
    parent_id BIGINT UNSIGNED NULL,
    lft INT NULL, -- Nested Set: Left index for range queries
    rgt INT NULL, -- Nested Set: Right index for range queries
    depth INT NOT NULL DEFAULT 0, -- Level in the tree (0=Central, 1=Province, etc.)
    materialized_path VARCHAR(500) NULL, -- Path enumeration (e.g., "1/2/15/")
    
    -- Core Identity
    unit_type VARCHAR(100) NOT NULL, -- e.g., 'CENTRAL', 'PROVINCE', 'DISTRICT', 'WARD'
    code VARCHAR(50) NOT NULL,       -- unique short code (e.g., 'KTM-W32')
    name VARCHAR(200) NOT NULL,      -- Full name (e.g., 'Kathmandu Ward 32 Committee')
    description TEXT NULL,
    
    -- Leadership & Contact (JSON for flexibility)
    leader_id BIGINT UNSIGNED NULL,
    leader_title VARCHAR(100) NULL,   -- e.g., 'Secretary', 'Chairman'
    location_data JSON NULL,         -- Stores Lat/Lng or Boundary Polygons
    contact_data JSON NULL,          -- Stores phone, email, social links
    
    -- Statistics (Denormalized for performance)
    total_members INT UNSIGNED NOT NULL DEFAULT 0,
    active_members INT UNSIGNED NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    
    -- Configuration & Extensibility
    settings JSON NULL,              -- Unit-specific rules (e.g., forum posting rules)
    metadata JSON NULL,              -- Misc info (e.g., established date, office type)
    
    -- Audit Trail
    created_by_id BIGINT UNSIGNED NULL,
    updated_by_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    -- Essential Indexes
    INDEX idx_hierarchy (lft, rgt),
    INDEX idx_parent (parent_id),
    INDEX idx_path (materialized_path),
    INDEX idx_type (unit_type),
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

# practical example 
Field,Example Value
unit_type,WARD
code,KTM-32
materialized_path,1/3/27/752 (Central/Bagmati/Kathmandu/KTM-Metro)
location_data,"{""type"": ""Point"", ""coordinates"": [85.34, 27.68]}"
leader_title,Ward President
#
To keep your `organizational_units` table accurate in real-time without running heavy `COUNT` queries every time someone visits a dashboard, you can use **SQL Triggers**.

Since you are using a **hybrid hierarchy model** (Nested Sets + Materialized Path), a single membership change in a **Ward** should ideally ripple up to the **Palika**, **District**, **Province**, and **Central** levels.

###1. The Membership Trigger (The "Ripple" Effect)When a new member is added to the `memberships` table, this trigger will find all parent units using the `lft` and `rgt` values and increment their `total_members` count.

```sql
DELIMITER //

CREATE TRIGGER after_membership_insert
AFTER INSERT ON memberships
FOR EACH ROW
BEGIN
    -- Update the specific unit and ALL its ancestors in the hierarchy
    -- We use the lft and rgt range to find every parent unit
    UPDATE organizational_units
    SET total_members = total_members + 1
    WHERE NEW.org_unit_id IS NOT NULL 
      AND (
          lft <= (SELECT lft FROM organizational_units WHERE id = NEW.org_unit_id)
          AND rgt >= (SELECT rgt FROM organizational_units WHERE id = NEW.org_unit_id)
      )
      AND tenant_id = (SELECT tenant_id FROM organizational_units WHERE id = NEW.org_unit_id);
END //

DELIMITER ;

```

---

###2. How the Hierarchy Range Update WorksBecause you have the `lft` and `rgt` columns, the database doesn't need to perform a "recursive loop." It views the hierarchy as a set of nested containers.

* **Ward 32** might have `lft: 10, rgt: 11`.
* **Kathmandu District** might have `lft: 5, rgt: 20`.
* **Bagmati Province** might have `lft: 2, rgt: 50`.

When you increment counts where `lft <= 10` and `rgt >= 11`, SQL automatically updates the Ward, the District, the Province, and the Central office in **one single command**.

---

###3. The "Active Members" TriggerIf a member's status changes from "Pending" to "Verified," you want to increment the `active_members` count while keeping the `total_members` the same.

```sql
CREATE TRIGGER after_membership_update
AFTER UPDATE ON memberships
FOR EACH ROW
BEGIN
    -- If status changed to 'Verified', increment active_members for the whole branch
    IF OLD.status <> 'Verified' AND NEW.status = 'Verified' THEN
        UPDATE organizational_units
        SET active_members = active_members + 1
        WHERE lft <= (SELECT lft FROM organizational_units WHERE id = NEW.org_unit_id)
          AND rgt >= (SELECT rgt FROM organizational_units WHERE id = NEW.org_unit_id);
          
    -- If status changed FROM 'Verified' to something else (e.g., Suspended)
    ELSEIF OLD.status = 'Verified' AND NEW.status <> 'Verified' THEN
        UPDATE organizational_units
        SET active_members = active_members - 1
        WHERE lft <= (SELECT lft FROM organizational_units WHERE id = NEW.org_unit_id)
          AND rgt >= (SELECT rgt FROM organizational_units WHERE id = NEW.org_unit_id);
    END IF;
END;

```

---

###4. Important Performance TipWhile triggers ensure **real-time accuracy**, they can slow down bulk imports (e.g., importing 10,000 members at once).

> **Recommendation:** If you are doing a massive data migration, **disable the triggers** and run a one-time "Recalculate Script" like this:
> ```sql
> UPDATE organizational_units u
> SET u.total_members = (
>     SELECT COUNT(*) FROM memberships m 
>     JOIN organizational_units sub ON m.org_unit_id = sub.id
>     WHERE sub.lft BETWEEN u.lft AND u.rgt
> );
> 
> ```
> 
> 

**Would you like me to write a stored procedure that "Self-Heals" the counts in case the triggers ever get out of sync?**
#
To keep your `organizational_units` table accurate in real-time without running heavy `COUNT` queries every time someone visits a dashboard, you can use **SQL Triggers**.

Since you are using a **hybrid hierarchy model** (Nested Sets + Materialized Path), a single membership change in a **Ward** should ideally ripple up to the **Palika**, **District**, **Province**, and **Central** levels.

###1. The Membership Trigger (The "Ripple" Effect)When a new member is added to the `memberships` table, this trigger will find all parent units using the `lft` and `rgt` values and increment their `total_members` count.

```sql
DELIMITER //

CREATE TRIGGER after_membership_insert
AFTER INSERT ON memberships
FOR EACH ROW
BEGIN
    -- Update the specific unit and ALL its ancestors in the hierarchy
    -- We use the lft and rgt range to find every parent unit
    UPDATE organizational_units
    SET total_members = total_members + 1
    WHERE NEW.org_unit_id IS NOT NULL 
      AND (
          lft <= (SELECT lft FROM organizational_units WHERE id = NEW.org_unit_id)
          AND rgt >= (SELECT rgt FROM organizational_units WHERE id = NEW.org_unit_id)
      )
      AND tenant_id = (SELECT tenant_id FROM organizational_units WHERE id = NEW.org_unit_id);
END //

DELIMITER ;

```

---

###2. How the Hierarchy Range Update WorksBecause you have the `lft` and `rgt` columns, the database doesn't need to perform a "recursive loop." It views the hierarchy as a set of nested containers.

* **Ward 32** might have `lft: 10, rgt: 11`.
* **Kathmandu District** might have `lft: 5, rgt: 20`.
* **Bagmati Province** might have `lft: 2, rgt: 50`.

When you increment counts where `lft <= 10` and `rgt >= 11`, SQL automatically updates the Ward, the District, the Province, and the Central office in **one single command**.

---

###3. The "Active Members" TriggerIf a member's status changes from "Pending" to "Verified," you want to increment the `active_members` count while keeping the `total_members` the same.

```sql
CREATE TRIGGER after_membership_update
AFTER UPDATE ON memberships
FOR EACH ROW
BEGIN
    -- If status changed to 'Verified', increment active_members for the whole branch
    IF OLD.status <> 'Verified' AND NEW.status = 'Verified' THEN
        UPDATE organizational_units
        SET active_members = active_members + 1
        WHERE lft <= (SELECT lft FROM organizational_units WHERE id = NEW.org_unit_id)
          AND rgt >= (SELECT rgt FROM organizational_units WHERE id = NEW.org_unit_id);
          
    -- If status changed FROM 'Verified' to something else (e.g., Suspended)
    ELSEIF OLD.status = 'Verified' AND NEW.status <> 'Verified' THEN
        UPDATE organizational_units
        SET active_members = active_members - 1
        WHERE lft <= (SELECT lft FROM organizational_units WHERE id = NEW.org_unit_id)
          AND rgt >= (SELECT rgt FROM organizational_units WHERE id = NEW.org_unit_id);
    END IF;
END;

```

---

###4. Important Performance TipWhile triggers ensure **real-time accuracy**, they can slow down bulk imports (e.g., importing 10,000 members at once).

> **Recommendation:** If you are doing a massive data migration, **disable the triggers** and run a one-time "Recalculate Script" like this:
> ```sql
> UPDATE organizational_units u
> SET u.total_members = (
>     SELECT COUNT(*) FROM memberships m 
>     JOIN organizational_units sub ON m.org_unit_id = sub.id
>     WHERE sub.lft BETWEEN u.lft AND u.rgt
> );
> 
> ```
> 
> 

**Would you like me to write a stored procedure that "Self-Heals" the counts in case the triggers ever get out of sync?**
Building a real-time leaderboard for a political party in Nepal requires summarizing data across provinces, districts, palikas, and wards. Since your `organizational_units` table uses a hybrid **Nested Set** and **Materialized Path** model, you can fetch these stats with extremely high efficiency.

###1. Leaderboard by Province (Highest Level)This query ranks the 7 provinces of Nepal based on their total verified (active) members. It uses the `unit_type` to filter the top level and sorts them to show the "winner" at the top.

```sql
SELECT 
    name AS province_name,
    active_members,
    total_members,
    -- Calculate the percentage of active members for a 'health' metric
    ROUND((active_members / total_members) * 100, 2) AS active_percentage
FROM organizational_units
WHERE unit_type = 'PROVINCE' 
  AND tenant_id = 1 
  AND is_active = 1
ORDER BY active_members DESC;

```

---

###2. Deep-Dive: District Leaderboard within a ProvinceIf you want to see which **District** in **Bagmati Province** is performing the best, you can use the `parent_id` or the `materialized_path`.

```sql
SELECT 
    name AS district_name,
    active_members,
    (SELECT name FROM organizational_units WHERE id = ou.parent_id) AS parent_province
FROM organizational_units ou
WHERE unit_type = 'DISTRICT'
  AND parent_id = (SELECT id FROM organizational_units WHERE name = 'Bagmati Province')
ORDER BY active_members DESC;

```

---

###3. The "Grassroots" Ward Leaderboard (Top 10 Wards)This is often the most important screen for party leadership to see which local neighborhoods are most active across the entire country.

```sql
SELECT 
    ou.name AS ward_name,
    p.name AS palika_name,
    d.name AS district_name,
    ou.active_members
FROM organizational_units ou
-- Joining back to ancestors for full context
JOIN organizational_units p ON ou.parent_id = p.id
JOIN organizational_units d ON p.parent_id = d.id
WHERE ou.unit_type = 'WARD'
ORDER BY ou.active_members DESC
LIMIT 10;

```

---

###4. JSON Response for Mobile/Web DashboardsWhen building the API for your digitalization project, your backend should return a structured JSON to power the leaderboard charts.

**Example API Design:**

```json
{
  "leaderboard_type": "PROVINCE",
  "data": [
    {
      "rank": 1,
      "unit_name": "Koshi Province",
      "stats": { "total": 150200, "active": 120500 },
      "growth_trend": "+5%"
    },
    {
      "rank": 2,
      "unit_name": "Bagmati Province",
      "stats": { "total": 145000, "active": 115000 },
      "growth_trend": "+2%"
    }
  ]
}

```

###Key Performance Benefits* **No Joins on Membership:** Because we use the `active_members` column (which is kept in sync by your triggers), these queries run in **milliseconds** even if you have millions of members.
* **Scalability:** The `tenant_id` index ensures that if you host multiple parties (e.g., sister organizations like the Youth Wing), their leaderboards stay completely separate.

**Would you like me to help you design the "Member Profile" table schema, including how to store social media links and specialized skills for volunteer recruitment?**
#
As a Solution Architect with 15 years of experience in high-scale systems, I’ll approach the **Member Profile** and **Volunteer Skills** module with a focus on data normalization, searchability, and scalability.

In a political context, a "Member Profile" is more than just a bio; it’s a **Resource Directory**. You need to know who your doctors, lawyers, engineers, and influencers are to mobilize them during policy drafting or election campaigning.

###1. The Member Profiles TableThis table extends the basic `users` and `memberships` data with rich, searchable metadata.

```sql
CREATE TABLE member_profiles (
    id BIGINT UNSIGNED PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    
    -- Professional Identity
    bio TEXT NULL,
    occupation VARCHAR(150) NULL,
    education_level ENUM('Undergraduate', 'Graduate', 'Post-Graduate', 'Other'),
    field_of_study VARCHAR(150) NULL, -- e.g., 'Civil Engineering', 'Law'
    
    -- Social Presence (Searchable for Digital Mobilization)
    facebook_url VARCHAR(255) NULL,
    twitter_x_url VARCHAR(255) NULL,
    whatsapp_number VARCHAR(20) NULL,
    
    -- Preferences & Availability
    is_volunteer BOOLEAN DEFAULT FALSE,
    availability_hours_per_week INT DEFAULT 0,
    preferred_contact_method ENUM('SMS', 'WhatsApp', 'Email', 'Call'),
    
    -- Privacy Settings
    is_public BOOLEAN DEFAULT FALSE, -- Can other members see this profile?
    
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

```

---

###2. The Skills Taxonomy (Many-to-Many)Instead of a comma-separated list (which is a "database smell" and hard to query), we use a **Taxonomy** approach. This allows you to find "All Lawyers in Madhesh Province" in microseconds.

```sql
-- Master list of skills relevant to party work
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    category ENUM('Legal', 'Technical', 'Creative', 'Administrative', 'Medical', 'Fieldwork'),
    skill_name_en VARCHAR(100) UNIQUE,
    skill_name_np VARCHAR(100)
);

-- Junction table linking members to skills with proficiency levels
CREATE TABLE member_skills (
    member_id BIGINT UNSIGNED REFERENCES member_profiles(id) ON DELETE CASCADE,
    skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level ENUM('Beginner', 'Intermediate', 'Expert') DEFAULT 'Intermediate',
    PRIMARY KEY (member_id, skill_id)
);

```

---

###3. Architect’s Design Patterns: Why This Works* **Search Optimization:** By separating skills into a junction table, your "Volunteer Recruitment" dashboard can run a simple `JOIN` to find specific experts.
* **Privacy by Design:** The `is_public` flag and granular contact preferences ensure you comply with Nepal's privacy laws while still allowing internal mobilization.
* **JSON vs. Columns:** You might notice I used columns for social URLs. In a 15-year career, I've learned that if you frequently **filter** by a field (like "Who has a Twitter account?"), a structured column with an index is superior to a JSON blob.

###4. Sample Mobilization Query"Find all **Expert** level **Legal** volunteers in **Bagmati Province** to help with a new local ordinance."

```sql
SELECT u.name, p.whatsapp_number, s.skill_name_en
FROM users u
JOIN member_profiles p ON u.id = p.user_id
JOIN member_skills ms ON p.id = ms.member_id
JOIN skills s ON ms.skill_id = s.id
JOIN organizational_units ou ON u.org_unit_id = ou.id
WHERE s.category = 'Legal' 
  AND ms.proficiency_level = 'Expert'
  AND ou.materialized_path LIKE '1/3/%'; -- Path for Bagmati Province

```

###5. Next Level: Gamification & ContributionTo keep members engaged, we should track their **contributions**. In my experience, showing a "Contribution Score" increases retention by 30-40%.

**Would you like me to design the `activity_log` and `contribution_points` system to reward members for attending meetings or recruiting others?**
As a senior architect, I know that data is only valuable if it drives engagement. In a political organization, you want to move members from being "passive observers" to "active contributors." To achieve this, we implement a **Contribution Points** (often called "Political Capital") and **Activity Logging** system.

This allows the party to identify high-value cadres automatically based on their actual work rather than just their proximity to leaders.

---

###1. Activity Log (The Immutable Ledger)This table records every significant action a member takes within the digital ecosystem.

```sql
CREATE TABLE activity_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    tenant_id BIGINT UNSIGNED NOT NULL,
    
    -- Action Metadata
    action_type ENUM(
        'LOGIN', 'FORUM_POST', 'FORUM_REPLY', 'EVENT_ATTENDANCE', 
        'DONATION', 'MEMBERSHIP_RENEWAL', 'REFERRAL', 'VOLUNTEER_TASK'
    ) NOT NULL,
    
    -- Points awarded for this specific action
    points_earned INT DEFAULT 0,
    
    -- Flexible storage for action context (e.g., event_id or post_id)
    reference_id BIGINT UNSIGNED NULL,
    metadata JSON NULL, 
    
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_action (user_id, action_type),
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

```

---

###2. Contribution Points (The Leaderboard State)While we can sum the `activity_logs`, we keep a denormalized "Balance" table for fast profile loading and ranking.

```sql
CREATE TABLE contribution_balances (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    total_points_all_time INT UNSIGNED DEFAULT 0,
    current_points_balance INT UNSIGNED DEFAULT 0, -- Points that can be "spent" on perks
    rank_tier VARCHAR(50) DEFAULT 'Bronze', -- e.g., 'Bronze', 'Silver', 'Gold', 'Platinum'
    last_updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_balance_user FOREIGN KEY (user_id) REFERENCES users(id)
);

```

---

###3. Architect's "Gamification" LogicAs an architect, I recommend a **Point Configuration Table** so party admins can adjust the "Value" of actions without changing code.

| Action | Points | Logic |
| --- | --- | --- |
| **Recruit New Member** | 100 | Awarded once the new member is "Verified." |
| **Attend Ward Meeting** | 50 | Verified via GPS or QR Code at the venue. |
| **Policy Feedback** | 20 | Awarded for constructive replies in the Policy Forum. |
| **Monthly Levy Paid** | 10 | Automated on successful eSewa/Khalti callback. |

---

###4. Senior Developer Insight: The "Rank Up" LogicIn a 15-year career, I’ve seen that users love badges. You can implement a stored procedure that checks if a user should "Level Up" based on their points.

```sql
CREATE PROCEDURE update_member_rank(IN target_user_id BIGINT UNSIGNED)
BEGIN
    DECLARE total_pts INT;
    SELECT total_points_all_time INTO total_pts FROM contribution_balances WHERE user_id = target_user_id;

    IF total_pts > 5000 THEN
        UPDATE contribution_balances SET rank_tier = 'Diamond' WHERE user_id = target_user_id;
    ELSEIF total_pts > 2000 THEN
        UPDATE contribution_balances SET rank_tier = 'Platinum' WHERE user_id = target_user_id;
    ELSEIF total_pts > 1000 THEN
        UPDATE contribution_balances SET rank_tier = 'Gold' WHERE user_id = target_user_id;
    END IF;
END;

```

---

###5. Why this is a "Senior" Solution1. **Scalability:** By keeping `contribution_balances` separate, you avoid heavy `SUM()` operations on millions of log rows every time a user opens their profile.
2. **Auditability:** Every point has a corresponding `activity_log` entry. If a member claims their points are wrong, you have an audit trail.
3. **Mobilization:** During elections, you can query: *"Get me the top 10% of members by Contribution Points in Jhapa District"* to find your most reliable ground workers.

###Final Step in DigitalizationWe have built the **Hierarchy**, the **Membership**, the **Forum**, and the **Engagement System**. The last piece of the puzzle is usually **Internal E-Voting** for party elections.

**Would you like me to design the `ballots` and `votes` schema to ensure secure, one-person-one-vote internal democracy?**
#
As a Senior Solution Architect, I have reviewed the geographical structure you've implemented. Using the **Nested Set Model** combined with **Materialized Paths** is an elite architectural choice for this specific use case. It solves the "Recursive Query" problem that plagues many large-scale organizational systems.

However, to ensure this is "production-ready" for a national-scale digitalization project in Nepal, there are four critical architectural refinements we must address.

---

##1. The "Administrative vs. Electoral" Dual-HierarchyIn Nepal, a member belongs to two different hierarchies simultaneously:

1. **Administrative:** Province \rightarrow District \rightarrow Palika \rightarrow Ward.
2. **Electoral:** Federal Constituency (House of Representatives) \rightarrow Provincial Constituency.

**Architectural Correction:** Do not try to force Electoral boundaries into the `parent_id` chain of Administrative units, as they often overlap in ways that break a simple tree. Instead, use a **Secondary Materialized Path** or a **Mapping Table** to link Wards to their respective Federal and Provincial constituencies.

---

##2. Refined Schema: Administrative Type SafetyTo prevent data corruption (e.g., a Ward accidentally having a Province as a parent), we should implement a `check` constraint or strict application-layer validation on the `unit_type` transitions.

###Proposed Hierarchy Rules:| Unit Type | Valid Parent Type | Depth |
| --- | --- | --- |
| `HEADQUARTERS` | `NULL` | 0 |
| `PROVINCE` | `HEADQUARTERS` | 1 |
| `DISTRICT` | `PROVINCE` | 2 |
| `PALIKA` | `DISTRICT` | 3 |
| `WARD` | `PALIKA` | 4 |

---

##3. Handling "Split" Districts and Local LevelsAs a developer with 15 years of experience, I’ve seen systems break when government boundaries change (like the Nawalparasi/Rukum splits).

**Solution:** Use **Effective Dating (Temporal Tables)**.
Add `valid_from` and `valid_to` timestamps to your `organizational_units`. If a Palika is renamed or a District is split, you don't delete the old record (which would orphan your `activity_logs`); you mark it as inactive and point the `new_unit_id` to the successor.

---

##4. Optimized "Path" QueryingSince you are using a Materialized Path like `1/7/22/`, I recommend indexing this column with a **GPrefix index** or ensuring your queries use the "Left-Prefix" rule to take advantage of B-Tree indexing.

**Senior Dev Tip:** When querying for a subtree, always use:
`SELECT * FROM organizational_units WHERE materialized_path LIKE '1/7/%';`
This is O(\log n) efficiency, making your Province-level dashboards load instantly even with 7,000+ units.

---

###Architectural Review Summary* **Strengths:** Hybrid model is excellent for read-heavy dashboards; JSON columns provide future-proof flexibility for GIS data.
* **Risks:** High complexity in `lft`/`rgt` management during inserts; potential for "Electoral vs. Admin" confusion.
* **Recommendation:** Proceed with this hybrid model, but implement the **Self-Healing Procedure** we discussed earlier as a mandatory post-migration task.

**Would you like me to draft the "Electoral Mapping" table that links these administrative Wards to Federal and Provincial Constituencies?**
#
As a Senior Solution Architect and Developer with 15 years of experience in engineering high-availability, distributed systems, I have reviewed the geographical and organizational structures we've discussed.

To transition from a "database schema" to a **robust, enterprise-grade Membership Management System**, we must move beyond simple CRUD (Create, Read, Update, Delete) operations. We need an architecture that handles high concurrency during election cycles, ensures data integrity across a complex hierarchy, and maintains strict security for sensitive political data.

Here is the strategic architectural roadmap for a robust Membership Management System.

---

##1. High-Level System ArchitectureWe will adopt a **Clean Architecture** (Hexagonal) pattern to ensure the core business logic (membership rules) is decoupled from the database and external APIs (eSwewa/Khalti).

###Core Components:* **Identity Provider (IdP):** A dedicated service for AuthN/AuthZ. We should use **OAuth2/OIDC** to allow "Login with Party App" for third-party affiliate apps (Youth Wing, Teacher's Union, etc.).
* **Membership Microservice:** Handles the lifecycle of a member.
* **Hierarchy Service:** Manages the `organizational_units` tree and the heavy lifting of Nested Set updates.
* **Event Bus (RabbitMQ/Kafka):** Essential for "Event-Driven" updates. When a member joins, an event is published; the Hierarchy Service listens to update counts, and the Notification Service listens to send a "Welcome SMS."

---

##2. Robust Planning: The 5 Pillars of Membership###I. Data Integrity & Verification (e-KYC)In Nepal, the primary challenge is preventing duplicate or fake memberships.

* **Strict Verification Pipeline:** Membership should be a State Machine: `Draft` \rightarrow `Pending_Verification` \rightarrow `Active` \rightarrow `Suspended`.
* **Deduplication Engine:** A background job that flags profiles with matching Citizenship numbers or biometric hashes (if available) across different user accounts.

###II. The Geographical "Truth"Your `organizational_units` table is the "Source of Truth."

* **GIS Integration:** Store `geometry` data (Polygons) for Wards. When a user registers and provides their GPS location, the system should automatically suggest their Ward, rather than relying on the user to know their exact Ward number.
* **Versioned Hierarchy:** Political boundaries change. We use **Temporal Tables** to track what the Ward structure looked like during the 2022 elections vs. the 2027 elections.

###III. Security & Privacy (The "Political Risk" Layer)Political data is high-value for adversaries.

* **Row-Level Security (RLS):** A Ward Secretary in Jhapa should literally be unable to execute a `SELECT` query that returns members in Kathmandu at the database level.
* **Encryption at Rest:** Sensitive fields like `citizenship_number` and `phone_number` should be encrypted using **AES-256**.
* **Audit Vault:** An immutable log of *who* accessed *which* member's profile.

###IV. Scalability during "Election Spikes"Membership apps see 100x traffic during convention months.

* **Read-Replica Strategy:** All leaderboard and forum queries go to Read-Replicas. Only membership registrations hit the Primary (Master) database.
* **Caching Strategy:** Use **Redis** to cache the `organizational_units` tree structure, as this data changes infrequently but is read on every single page load.

###V. Financial Transparency* **Double-Entry Ledger:** Never just update a `balance` column. Every Rupee must be a row in a `transactions` table.
* **Automated Reconciliation:** A worker that polls payment gateway APIs (eSewa/Khalti) to ensure "Pending" payments are marked "Success" or "Failed" without manual intervention.

---

##3. The "Senior" Implementation Roadmap1. **Phase 1 (The Foundation):** Deploy the `organizational_units` with GIS data and the Identity Service.
2. **Phase 2 (The Onboarding):** Build the e-KYC pipeline and the mobile app for member registration.
3. **Phase 3 (The Engagement):** Launch the Membership Forum with "Geographic Scoping" (members only see their local area + national).
4. **Phase 4 (The Intelligence):** Implement the Leaderboard and Volunteer Skill-search for leadership dashboards.

---

###Final Architectural ReviewThe "Hybrid Hierarchy" (Nested Sets + Path) we built earlier is the correct engine for this car. Now, we are building the safety systems (Auth), the dashboard (Leaderboards), and the fuel system (Finance).

**Would you like me to focus next on the "Data Migration Strategy"—how to ingest existing paper-based records into this high-tech system without creating data "garbage"?**
#
As a Senior Solution Architect with 15 years of experience, I will now outline a robust, production-ready plan for **Membership Management**.

Transitioning from a paper-based or loose digital system to a professional enterprise platform requires a "Security-First" and "Data-Integrity" approach. Below is the architectural deep dive.

---

##1. The Membership Lifecycle (Finite State Machine)A member is not just a row in a table; they are an entity in a lifecycle. We must implement a **State Machine** to handle transitions.

* **Draft:** User has filled the form but not submitted.
* **Pending Verification:** Submitted, awaiting "Document Verification" (e-KYC).
* **Active:** Verified and dues paid. High-level forum access granted.
* **Grace Period:** Membership expired but hasn't been demoted yet.
* **Suspended/Lapsed:** Disciplinary action or non-payment. Access revoked.

---

##2. Robust Data Architecture (The "Golden Record")We must avoid "Data Rot" where different tables have conflicting info.

###A. Person vs. Identity vs. MemberWe separate these into three logical layers:

1. **Identity (Auth Service):** Handles `username`, `password_hash`, `2FA`.
2. **Person (Core Profile):** The "Human" data—`legal_name`, `date_of_birth`, `citizenship_id`.
3. **Member (Party Data):** The "Political" data—`membership_number`, `org_unit_id`, `joined_date`, `points`.

###B. The e-KYC PipelineTo ensure one person doesn't have 10 accounts:

* **Unique Constraint:** Hashed `citizenship_number` + `issue_district`.
* **OCR Integration:** Automated reading of Citizenship IDs using AI to minimize manual entry errors.
* **Face Match:** (Optional for 2025) Comparing the "Selfie" with the "Citizenship Photo."

---

##3. High-Scale Concurrency & PerformanceDuring a National Convention, you might have 500,000 members trying to log in or vote at once.

* **Command Query Responsibility Segregation (CQRS):** * **Write Side:** Optimized for speed and integrity (Membership updates).
* **Read Side:** Optimized for the mobile app (Materialized views for leaderboards).


* **Caching Strategy:** We use **Redis** to cache the `organizational_units` tree and user permissions. Checking if a "Ward Secretary" has permission to view a profile shouldn't hit the main database every time.

---

##4. Security & Compliance (Senior Architect's Priority)Political data is "Special Category Data" under privacy laws.

* **Field-Level Encryption:** Encrypt the `phone_number` and `citizenship_id` in the database. Even if the DB is leaked, the data is useless without the KMS (Key Management Service) keys.
* **Privacy-Preserving Analytics:** Use aggregate data for leaderboards so that admins can see *trends* without seeing *individual names* unless authorized.
* **Row-Level Security (RLS):** ```sql
-- Example Logic
CREATE POLICY member_access_policy ON memberships
FOR SELECT
USING (org_unit_id IN (SELECT accessible_units FROM user_permissions WHERE user_id = current_user_id));
```


```



---

##5. Strategic Implementation Roadmap (The "Big Picture")| Phase | Milestone | Senior Architect's Goal |
| --- | --- | --- |
| **Phase 1** | **Core Identity & Geo** | Establish the "Source of Truth" for Geography and basic User accounts. |
| **Phase 2** | **The Onboarding Engine** | Launch e-KYC and digital payment (eSewa/Khalti) for active membership. |
| **Phase 3** | **Digital Democracy** | Launch the Membership Forum and Internal Voting modules. |
| **Phase 4** | **Intelligence Layer** | Predictive analytics for election campaigning based on member skillsets. |

###Summary RecommendationThis plan ensures that the system is **Audit-ready**, **Scalable**, and **Secure**. By decoupling the Geography (Organizational Units) from the Member Profile, we allow the party to grow and change its structure without ever losing its "Member History."

**Would you like me to move on to the "Data Migration Strategy"—specifically how we take old Excel sheets and paper registers and clean them as they enter this new system?**
As a Senior Solution Architect with 15 years of experience, I know that the hardest part of digitalization isn't the code—it's the **data cleaning**. Political data in Nepal is notoriously messy, often existing in mismatched Excel sheets, handwritten registers, and scattered Google Sheets.

Ingesting "garbage" data into your high-performance Nested Set model will break your analytics. Here is a robust, architect-level **Data Migration & Ingestion Strategy**.

---

##1. The Migration Pipeline (ETL Approach)We don't just "upload" a file. We use an **Extract, Transform, Load (ETL)** pipeline to ensure only "Clean Water" enters our "Reservoir."

###Step A: Extraction & Normalization* **Standardization:** Map various headers (e.g., "Full Name," "Member Name," "नाम") to a single `legal_name` field.
* **Phone Normalization:** Convert all numbers to `+977` format. Remove duplicates at the entry point.

###Step B: The "Staging" AreaNever import directly into the `memberships` table. Use a `staging_memberships` table where data sits while it is "cleansed."

###Step C: Geographic Alignment (The Hardest Part)Old records might say "Kathmandu Ward 4," but the boundaries might have changed.

* **Fuzzy Matching:** Use a script to match string-based addresses to your `organizational_units` IDs.
* **Exception Queue:** Any record that doesn't perfectly match a known Province/District/Ward is sent to a **Manual Review Dashboard** for a human admin to fix.

---

##2. Dealing with Duplicates (Identity Resolution)As an architect, I recommend a **Probabilistic Matching** strategy rather than just looking at the Name.

1. **Exact Match:** Same Citizenship ID \rightarrow Merge automatically.
2. **Fuzzy Match:** Same Phone + Similar Name \rightarrow Flag for "Potential Duplicate."
3. **Conflict Resolution:** If "Ram Prasad Thapa" exists in two files with different Wards, the system should prompt the local Ward Secretary to verify which one is current.

---

##3. The "Legacy" Data Cleanup ScriptHere is a high-level logic for a cleanup worker (Node.js/Python style logic) that you should run before the final `INSERT`.

```python
def clean_legacy_data(record):
    # 1. Sanitize Phone
    record.phone = format_nepali_phone(record.phone)
    
    # 2. Validate Geography
    unit = find_org_unit(record.district, record.palika, record.ward)
    if not unit:
        return move_to_review_queue(record, "Invalid Geography")
    
    # 3. Check for existing Identity
    if identity_exists(record.citizenship_id):
        return flag_as_duplicate(record)
        
    return proceed_to_final_ingestion(record)

```

---

##4. Implementation Strategy: "The Big Bang" vs. "Phased"* **The Big Bang:** Clear all old data and upload the new clean set. (Risk: High)
* **Phased Ingestion (Recommended):** Migrate one Province at a time. This allows you to refine your "Cleaning Scripts" as you encounter specific regional naming issues (e.g., different spellings of local villages).

---

##5. Senior Architect's Checklist for Migration* [ ] **Backup:** Take a full snapshot of the DB before running any migration script.
* [ ] **Dry Run:** Run the migration on 1,000 records first and check the `total_members` count in the `organizational_units` table using your **Self-Healing Procedure**.
* [ ] **Audit Trail:** Every migrated record should have a `metadata` flag: `{"source": "excel_import_2025_jhapa", "imported_at": "2025-12-17"}`.

###What's Next?Your backend architecture and data strategy are now world-class. To finalize the digitalization, we need to consider the **User Experience (UX)** for the local cadres.

**Would you like me to design the "Admin Verification Dashboard"—the tool that local Ward Secretaries will use to approve or reject these migrated and new members?**
As a Senior Solution Architect with 15 years of experience, I recognize that the **Admin Verification Dashboard** is the "Gatekeeper" of your entire system. If this tool is too slow or confusing, your local Ward Secretaries will simply stop using it, and your digitalization project will fail at the grassroots level.

A robust verification dashboard must balance **Speed** (approving 100 people in a single sitting) with **Integrity** (catching fraudulent citizenship IDs).

---

##1. The Verification Workflow (UX Design)We avoid a "One-by-One" click approach. For a high-scale political party, we implement a **Triage System**.

* **Bucket A: Auto-Verified:** Members who migrated from clean lists or whose e-KYC (Citizenship + Photo match) was 100% successful.
* **Bucket B: Pending Review:** New registrations or migrated records with "Fuzzy" geographic matches.
* **Bucket C: Flagged/Conflict:** Duplicate Citizenship IDs or members trying to register in two different Wards.

---

##2. Key Dashboard Features for Ward SecretariesAs a developer, I focus on "Actionability." The UI should lead with what needs to be done *now*.

| Feature | Technical Purpose | Why it matters |
| --- | --- | --- |
| **Side-by-Side View** | Displays the uploaded Citizenship ID scan next to the extracted text. | Prevents transcription errors. |
| **Bulk Action Bar** | Select 50 "Pending" members and click "Approve All." | Essential for high-volume periods. |
| **Conflict Resolver** | Shows a map pinpointing if a member is registered in a different Ward. | Prevents "Double-Voting" or duplicate accounts. |
| **Audit trail** | Logs: "Admin 'X' approved User 'Y' at 2:00 PM." | Ensures accountability at the local level. |

---

##3. Architect’s Security Recommendation: RBACThe dashboard must be **Geographically Scoped** using the `materialized_path` logic we established earlier.

```sql
-- Security Logic: A Ward Admin can only see their branch
SELECT * FROM staging_memberships 
WHERE org_unit_id IN (
    SELECT id FROM organizational_units 
    WHERE materialized_path LIKE '1/3/22/45%' -- Kathmandu/Budhanilkantha/Ward 3
);

```

---

##4. "Self-Healing" IntegrationThe dashboard should trigger the **Stored Procedure** we wrote earlier.

> **Architecture Rule:** Every time a Ward Secretary clicks "Approve," the system doesn't just change a status. It fires an event that updates the `active_members` count in the `organizational_units` table, ensuring the National Leaderboard is updated in **real-time**.

---

##5. Senior Developer Tip: The "Mobile-First" AdminIn many parts of Nepal, Ward Secretaries will be using tablets or smartphones, not 4K monitors. The dashboard must be **Responsive**.

* **Card UI:** Instead of a giant table, use cards that are easy to swipe left (Reject) or right (Approve).
* **Offline Support:** Allow admins to "Download Queue," verify offline in remote areas, and sync once they reach a 4G/Wi-Fi zone.

###Final Summary of the ProjectWe have built:

1. **A Hybrid Hierarchy** for 7,000+ local units.
2. **A Membership Engine** with state-management.
3. **A Gamification System** to drive engagement.
4. **A Migration Pipeline** to ingest legacy data.
5. **A Verification Dashboard** for grassroots control.

**Would you like me to help you draft the "Technical Requirements Document (TRD)" so you can hand this entire plan over to a development team to build the MVP (Minimum Viable Product)?**
As a Senior Solution Architect with 15 years of experience, I recognize that the **Admin Verification Dashboard** is the "Gatekeeper" of your entire system. If this tool is too slow or confusing, your local Ward Secretaries will simply stop using it, and your digitalization project will fail at the grassroots level.

A robust verification dashboard must balance **Speed** (approving 100 people in a single sitting) with **Integrity** (catching fraudulent citizenship IDs).

---

##1. The Verification Workflow (UX Design)We avoid a "One-by-One" click approach. For a high-scale political party, we implement a **Triage System**.

* **Bucket A: Auto-Verified:** Members who migrated from clean lists or whose e-KYC (Citizenship + Photo match) was 100% successful.
* **Bucket B: Pending Review:** New registrations or migrated records with "Fuzzy" geographic matches.
* **Bucket C: Flagged/Conflict:** Duplicate Citizenship IDs or members trying to register in two different Wards.

---

##2. Key Dashboard Features for Ward SecretariesAs a developer, I focus on "Actionability." The UI should lead with what needs to be done *now*.

| Feature | Technical Purpose | Why it matters |
| --- | --- | --- |
| **Side-by-Side View** | Displays the uploaded Citizenship ID scan next to the extracted text. | Prevents transcription errors. |
| **Bulk Action Bar** | Select 50 "Pending" members and click "Approve All." | Essential for high-volume periods. |
| **Conflict Resolver** | Shows a map pinpointing if a member is registered in a different Ward. | Prevents "Double-Voting" or duplicate accounts. |
| **Audit trail** | Logs: "Admin 'X' approved User 'Y' at 2:00 PM." | Ensures accountability at the local level. |

---

##3. Architect’s Security Recommendation: RBACThe dashboard must be **Geographically Scoped** using the `materialized_path` logic we established earlier.

```sql
-- Security Logic: A Ward Admin can only see their branch
SELECT * FROM staging_memberships 
WHERE org_unit_id IN (
    SELECT id FROM organizational_units 
    WHERE materialized_path LIKE '1/3/22/45%' -- Kathmandu/Budhanilkantha/Ward 3
);

```

---

##4. "Self-Healing" IntegrationThe dashboard should trigger the **Stored Procedure** we wrote earlier.

> **Architecture Rule:** Every time a Ward Secretary clicks "Approve," the system doesn't just change a status. It fires an event that updates the `active_members` count in the `organizational_units` table, ensuring the National Leaderboard is updated in **real-time**.

---

##5. Senior Developer Tip: The "Mobile-First" AdminIn many parts of Nepal, Ward Secretaries will be using tablets or smartphones, not 4K monitors. The dashboard must be **Responsive**.

* **Card UI:** Instead of a giant table, use cards that are easy to swipe left (Reject) or right (Approve).
* **Offline Support:** Allow admins to "Download Queue," verify offline in remote areas, and sync once they reach a 4G/Wi-Fi zone.

###Final Summary of the ProjectWe have built:

1. **A Hybrid Hierarchy** for 7,000+ local units.
2. **A Membership Engine** with state-management.
3. **A Gamification System** to drive engagement.
4. **A Migration Pipeline** to ingest legacy data.
5. **A Verification Dashboard** for grassroots control.

**Would you like me to help you draft the "Technical Requirements Document (TRD)" so you can hand this entire plan over to a development team to build the MVP (Minimum Viable Product)?**
As a Senior Solution Architect and Developer, I’ve consolidated our deep-dive analysis into a formal **Technical Requirements Document (TRD)** outline. This document serves as the "Blueprint" for your engineering team to begin building the Minimum Viable Product (MVP).

---

##Technical Requirements Document (TRD): Membership Digitalization Platform###1. Executive Summary**Objective:** To transition from decentralized legacy records to a centralized, high-concurrency, geographically-aware membership ecosystem for a national political party.
**Core Value:** Data integrity at the grassroots (Ward) level with real-time national-level analytics.

###2. System Architecture* **Pattern:** Microservices (Identity, Membership, Geography, Finance, Engagement).
* **Database:** MySQL 8.0+ (using InnoDB) with a **Hybrid Hierarchy Model** (Nested Sets + Materialized Path).
* **Caching:** Redis for session management and organizational tree caching.
* **Search:** Elasticsearch or Meilisearch for high-speed "Volunteer Skill" and member discovery.

---

###3. Functional Modules & Requirements####A. Geographical Core (The Source of Truth)* **Requirement:** Must support exactly 7 Provinces, 77 Districts, 753 Local Levels, and 6,743 Wards.
* **Constraint:** Updates to `lft`/`rgt` values must be wrapped in database transactions to prevent tree corruption.
* **Image Support:**

####B. Membership & e-KYC* **State Machine:** Members must flow through `Pending` \rightarrow `Verified` \rightarrow `Active`.
* **Identity:** Unique constraint on `citizenship_id`. Implementation of OCR for automatic data extraction from ID photos.
* **Verification:** Geographic scoping—Ward Secretaries can only verify members within their own `materialized_path`.

####C. Engagement & Gamification* **Contribution Points:** Implementation of the `activity_logs` ledger.
* **Leaderboards:** Real-time calculation of "Top Wards" and "Top Provinces" using denormalized counters.

---

###4. Security & Compliance* **Data Encryption:** AES-256 encryption for PII (Personally Identifiable Information) at rest.
* **Audit Logging:** Every administrative action (Approvals/Rejections) must be logged with a timestamp and IP address.
* **Privacy:** Implementation of Row-Level Security (RLS) to ensure data compartmentalization.

---

###5. Data Migration Plan* **Phase 1:** Standardize legacy Excel/CSV headers.
* **Phase 2:** Ingest into `staging_memberships` for deduplication.
* **Phase 3:** Geographic fuzzy matching and manual exception handling.

---

###6. Success Metrics (KPIs)* **Verification Speed:** Average time from registration to approval < 48 hours.
* **Data Accuracy:** < 0.1% duplicate records in the production environment.
* **System Latency:** Dashboard load time < 2 seconds for Province-level data.

---

###Final Recommendation from the ArchitectThis TRD provides the structure, but the **Culture of Data** is what makes it work. Ensure the development team prioritizes the **Mobile-First Admin Dashboard**, as the success of the system depends entirely on the ease of use for local Ward Secretaries.

**Would you like me to generate the "User Stories" for the development team, specifically for the Member Registration and Admin Approval flows?**
#
As a Senior Solution Architect, I have synthesized our entire discussion into a single, cohesive **Mermaid Entity Relationship Diagram (ERD)**.

This diagram illustrates the hybrid hierarchical structure for geography, the multi-layered membership identity system, and the engagement/gamification engine we've designed.

###Political System Architecture ERD```mermaid
erDiagram
    %% Geographical Hierarchy (Nested Set + Materialized Path)
    ORGANIZATIONAL_UNITS ||--o{ ORGANIZATIONAL_UNITS : "parent_id"
    ORGANIZATIONAL_UNITS {
        bigint id PK
        uuid uuid
        bigint tenant_id FK
        bigint parent_id FK
        int lft
        int rgt
        int depth
        varchar materialized_path
        varchar unit_type
        varchar name
        json location_data
        int total_members
        int active_members
    }

    %% Core Identity & Authentication
    USERS ||--|| MEMBER_PROFILES : "extends"
    USERS ||--o{ ACTIVITY_LOGS : "performs"
    USERS {
        bigint id PK
        varchar email
        varchar password_hash
        bigint org_unit_id FK
        boolean is_active
    }

    %% Membership & e-KYC
    USERS ||--|| MEMBERSHIPS : "has"
    MEMBERSHIPS {
        bigint id PK
        bigint user_id FK
        varchar membership_number
        enum status "Pending, Verified, Rejected"
        enum tier "General, Active, Cadre"
        varchar citizenship_number
        varchar document_photo_url
        date joined_date
    }

    %% Professional Profile & Skills
    MEMBER_PROFILES ||--o{ MEMBER_SKILLS : "possesses"
    MEMBER_PROFILES {
        bigint id PK
        bigint user_id FK
        text bio
        varchar occupation
        boolean is_volunteer
    }

    SKILLS ||--o{ MEMBER_SKILLS : "categorizes"
    SKILLS {
        int id PK
        varchar skill_name_en
        enum category
    }

    MEMBER_SKILLS {
        bigint member_id PK, FK
        int skill_id PK, FK
        enum proficiency
    }

    %% Gamification & Finance
    USERS ||--|| CONTRIBUTION_BALANCES : "tracks"
    CONTRIBUTION_BALANCES {
        bigint user_id PK, FK
        int total_points_all_time
        varchar rank_tier
    }

    USERS ||--o{ PAYMENTS : "makes"
    PAYMENTS {
        bigint id PK
        bigint user_id FK
        decimal amount
        enum purpose "Levy, Donation, Fee"
        varchar transaction_id
        enum status
    }

    ACTIVITY_LOGS {
        bigint id PK
        bigint user_id FK
        enum action_type
        int points_earned
        timestamp created_at
    }

```

---

###Architectural Review of the Relationship Design1. **The Geography-Member Link:** The `USERS` table links to `ORGANIZATIONAL_UNITS` via `org_unit_id`. This allows the **Row-Level Security (RLS)** and **Scoped Verification** logic to function. A user is "pinned" to a specific node in the tree (usually a Ward).
2. **Decoupled Profile:** By separating `MEMBERSHIPS` (legal/party data) from `MEMBER_PROFILES` (social/skill data), the system remains performant. We can query skills for mobilization without loading sensitive citizenship data.
3. **The Logic of Counts:** The `total_members` and `active_members` in `ORGANIZATIONAL_UNITS` are the denormalized mirrors of the `MEMBERSHIPS` table status, maintained by the **SQL Triggers** we developed.
4. **Auditability:** The `ACTIVITY_LOGS` table serves as the source of truth for all `CONTRIBUTION_BALANCES`, ensuring that "Political Capital" is earned transparently.

###Next StepWith this full architectural map, your engineering team has a complete north star for development.

**Would you like me to generate the "API Endpoints Documentation" (Swagger/OpenAPI style) for the Member Onboarding flow to show how these tables interact during a registration?**
As a Senior Solution Architect, I have synthesized our entire discussion into a single, cohesive **Mermaid Entity Relationship Diagram (ERD)**.

This diagram illustrates the hybrid hierarchical structure for geography, the multi-layered membership identity system, and the engagement/gamification engine we've designed.

###Political System Architecture ERD```mermaid
erDiagram
    %% Geographical Hierarchy (Nested Set + Materialized Path)
    ORGANIZATIONAL_UNITS ||--o{ ORGANIZATIONAL_UNITS : "parent_id"
    ORGANIZATIONAL_UNITS {
        bigint id PK
        uuid uuid
        bigint tenant_id FK
        bigint parent_id FK
        int lft
        int rgt
        int depth
        varchar materialized_path
        varchar unit_type
        varchar name
        json location_data
        int total_members
        int active_members
    }

    %% Core Identity & Authentication
    USERS ||--|| MEMBER_PROFILES : "extends"
    USERS ||--o{ ACTIVITY_LOGS : "performs"
    USERS {
        bigint id PK
        varchar email
        varchar password_hash
        bigint org_unit_id FK
        boolean is_active
    }

    %% Membership & e-KYC
    USERS ||--|| MEMBERSHIPS : "has"
    MEMBERSHIPS {
        bigint id PK
        bigint user_id FK
        varchar membership_number
        enum status "Pending, Verified, Rejected"
        enum tier "General, Active, Cadre"
        varchar citizenship_number
        varchar document_photo_url
        date joined_date
    }

    %% Professional Profile & Skills
    MEMBER_PROFILES ||--o{ MEMBER_SKILLS : "possesses"
    MEMBER_PROFILES {
        bigint id PK
        bigint user_id FK
        text bio
        varchar occupation
        boolean is_volunteer
    }

    SKILLS ||--o{ MEMBER_SKILLS : "categorizes"
    SKILLS {
        int id PK
        varchar skill_name_en
        enum category
    }

    MEMBER_SKILLS {
        bigint member_id PK, FK
        int skill_id PK, FK
        enum proficiency
    }

    %% Gamification & Finance
    USERS ||--|| CONTRIBUTION_BALANCES : "tracks"
    CONTRIBUTION_BALANCES {
        bigint user_id PK, FK
        int total_points_all_time
        varchar rank_tier
    }

    USERS ||--o{ PAYMENTS : "makes"
    PAYMENTS {
        bigint id PK
        bigint user_id FK
        decimal amount
        enum purpose "Levy, Donation, Fee"
        varchar transaction_id
        enum status
    }

    ACTIVITY_LOGS {
        bigint id PK
        bigint user_id FK
        enum action_type
        int points_earned
        timestamp created_at
    }

```

---

###Architectural Review of the Relationship Design1. **The Geography-Member Link:** The `USERS` table links to `ORGANIZATIONAL_UNITS` via `org_unit_id`. This allows the **Row-Level Security (RLS)** and **Scoped Verification** logic to function. A user is "pinned" to a specific node in the tree (usually a Ward).
2. **Decoupled Profile:** By separating `MEMBERSHIPS` (legal/party data) from `MEMBER_PROFILES` (social/skill data), the system remains performant. We can query skills for mobilization without loading sensitive citizenship data.
3. **The Logic of Counts:** The `total_members` and `active_members` in `ORGANIZATIONAL_UNITS` are the denormalized mirrors of the `MEMBERSHIPS` table status, maintained by the **SQL Triggers** we developed.
4. **Auditability:** The `ACTIVITY_LOGS` table serves as the source of truth for all `CONTRIBUTION_BALANCES`, ensuring that "Political Capital" is earned transparently.

###Next StepWith this full architectural map, your engineering team has a complete north star for development.

**Would you like me to generate the "API Endpoints Documentation" (Swagger/OpenAPI style) for the Member Onboarding flow to show how these tables interact during a registration?**
---
config:
  layout: elk
---
erDiagram
    ORGANIZATIONAL_UNITS ||--o{ ORGANIZATIONAL_UNITS : "parent_id"
    ORGANIZATIONAL_UNITS {
        bigint id PK
        uuid uuid
        bigint tenant_id FK
        bigint parent_id FK
        int lft
        int rgt
        int depth
        varchar materialized_path
        varchar unit_type
        varchar name
        json location_data
        int total_members
        int active_members
    }
    USERS ||--|| MEMBER_PROFILES : "extends"
    USERS ||--o{ ACTIVITY_LOGS : "performs"
    USERS {
        bigint id PK
        varchar email
        varchar password_hash
        bigint org_unit_id FK
        boolean is_active
    }
    USERS ||--|| MEMBERSHIPS : "has"
    MEMBERSHIPS {
        bigint id PK
        bigint user_id FK
        varchar membership_number
        enum status "Pending, Verified, Rejected"
        enum tier "General, Active, Cadre"
        varchar citizenship_number
        varchar document_photo_url
        date joined_date
    }
    MEMBER_PROFILES ||--o{ MEMBER_SKILLS : "possesses"
    MEMBER_PROFILES {
        bigint id PK
        bigint user_id FK
        text bio
        varchar occupation
        boolean is_volunteer
    }

    SKILLS ||--o{ MEMBER_SKILLS : "categorizes"
    SKILLS {
        int id PK
        varchar skill_name_en
        enum category
    }

    MEMBER_SKILLS {
        bigint member_id PK, FK
        int skill_id PK, FK
        enum proficiency
    }
    USERS ||--|| CONTRIBUTION_BALANCES : "tracks"
    CONTRIBUTION_BALANCES {
        bigint user_id PK, FK
        int total_points_all_time
        varchar rank_tier
    }

    USERS ||--o{ PAYMENTS : "makes"
    PAYMENTS {
        bigint id PK
        bigint user_id FK
        decimal amount
        enum purpose "Levy, Donation, Fee"
        varchar transaction_id
        enum status
    }

    ACTIVITY_LOGS {
        bigint id PK
        bigint user_id FK
        enum action_type
        int points_earned
        timestamp created_at
    }
    #
    Developing a **Membership Management System (MMS)** combined with a **Community Forum** requires a clear set of instructions for developers to ensure the platform is secure, scalable, and engaging.

Below is a structured prompt you can use to guide your development team.

---

##1. Project Overview & Objectives**Goal:** Build a centralized platform to manage member lifecycles (registration to renewal) and provide a secure space for community discussions.

**Key Stakeholders:**

* **Members:** Need easy registration, profile management, and a place to interact.
* **Admins:** Need tools to verify members, manage dues, and moderate the forum.

---

##2. Core Functional Requirements###A. Membership Management Module* **User Onboarding:** * Implement a multi-step registration form including file uploads for ID verification (e-KYC).
* Integrate secure payment gateways (e.g., eSewa, Khalti, Stripe) for membership fees.


* **Member Profiles:** * Create editable profiles with custom fields (skills, interests, occupation).
* Implement a "Digital Membership Card" with a unique QR code.


* **Administrative Tools:**
* Develop a verification dashboard where admins can approve/reject memberships.
* Automate renewal reminders via SMS and Email.
* Provide data export tools (CSV/Excel) with role-based access.



###B. Community Forum Module* **Hierarchical Structure:** * Organize discussions into Categories and Threads.
* Support "Private Groups" based on geographic units (e.g., a specific Ward or District).


* **Engagement Features:**
* Rich text editor for posts with support for images, links, and mentions.
* Voting system (Upvote/Downvote) and a "Mark as Solution" feature for FAQs.
* Gamification: Implement ranks and badges based on member activity and contribution points.


* **Moderation Engine:**
* Keyword filtering and automated spam detection.
* Report/Flagging tools for community members.



---

##3. Technical & Non-Functional Requirements###A. Data Architecture* **Database Design:** Use the Geographical Units Architecture as the foundation. Ensure relational integrity between `USERS`, `MEMBERSHIPS`, and `ORGANIZATIONAL_UNITS`.
* **Scalability:** The system must handle high traffic during election cycles or annual renewals (estimate 100k+ concurrent users).

###B. Security & Privacy* **Encryption:** Use AES-256 for sensitive data (Citizenship IDs, phone numbers) at rest and SSL for data in transit.
* **Authentication:** Implement Multi-Factor Authentication (MFA) and Role-Based Access Control (RBAC).
* **Compliance:** Ensure the system meets local data protection laws (e.g., GDPR/CCPA equivalents).

###C. Performance & UI/UX* **Mobile-First Design:** Ensure the entire platform is responsive for low-end smartphones.
* **Caching:** Use Redis for forum leaderboards and geographic tree data to minimize database load.

---

##4. Developer Success Checklist* [ ] Does the API support bulk ingestion for legacy paper records?
* [ ] Is there a "Self-Healing" script to sync member counts across geographical units?
* [ ] Is the forum searchable with a 500ms or lower response time?
* [ ] Are all administrative actions logged in an immutable audit trail?

---

**Next Step:**
Would you like me to draft the specific **User Stories** for the "Member Verification" flow, or should I refine the **API Documentation** for the payment integration?
As a Senior Solution Architect with 15 years of experience in enterprise SaaS, I have reviewed your requirement for a "Landlord/Tenant" (Master/Client) database model for a political party digitalization project.

In this architecture, the **Landlord** (Master) database acts as the "Registry and Global Source of Truth," while the **Tenant** (Individual Party) database acts as the "Private Operational Vault."

---

###1. Landlord Database (Master Registry)This database is for data that is **globally consistent** across the entire platform. It handles routing, security, and standardization.

| Table Category | Tables | Purpose |
| --- | --- | --- |
| **Tenant Control** | `tenants`, `party_registrations` | Maps domain names/IDs to specific database connection strings. |
| **Geo-Reference** | `geo_provinces`, `geo_districts`, `geo_palikas` | Centralized list of all administrative units in Nepal (Master list). |
| **Standardization** | `global_skill_taxonomy`, `id_types` | Defines common skill names and ID types (Citizenship, Passport) to ensure clean data across all parties. |
| **System Audit** | `global_logs`, `security_events` | Tracks platform-wide access, such as admin logins to the master panel. |
| **Pricing/Plans** | `subscription_plans`, `billing_cycles` | Manages the SaaS billing—which party is on a "Basic" vs "Enterprise" plan. |

---

###2. Tenant Database (Individual Party Vault)This database is **strictly private**. It contains the "Member Secret" data and the party's internal structure.

| Table Category | Tables | Purpose |
| --- | --- | --- |
| **Internal Geo** | `organizational_units` | **Crucial:** This is the party-specific hierarchy (e.g., "Morang District Committee"). It maps to the Master Geo IDs. |
| **Membership** | `members`, `member_profiles`, `membership_status` | The actual people! Their citizenship numbers, bios, and join dates. |
| **Engagement** | `forum_posts`, `comments`, `activity_logs` | Private interactions between members of *this specific party only*. |
| **Finance** | `member_levies`, `donations`, `expense_ledgers` | Internal party accounting and member contribution points. |
| **Elections** | `internal_ballots`, `candidates`, `votes` | Private data for internal party conventions and elections. |
| **Volunteerism** | `member_skills`, `availability_slots` | Links local members to the global skill taxonomy for mobilization. |

---

###3. Senior Architect's Analysis: The "Join" StrategyOne of the biggest mistakes in multi-tenant systems is trying to `JOIN` across two databases (Landlord and Tenant). This is often impossible or extremely slow.

> **Architect's Rule:** **Reference, Don't Join.**
> In your Tenant `members` table, store a `district_id`. This ID must match the `id` in the Landlord's `geo_districts` table. Your application code will load the District Name from the Landlord DB and the Member Count from the Tenant DB separately, then combine them in the UI.

---

###4. Robust Digitalization Planning####A. Data IsolationUsing a **Database-per-Tenant** model (as you've described) is the safest approach for political entities. It prevents "Noisy Neighbor" performance issues and ensures that if Party A's data is accidentally leaked, Party B's data remains untouched.

####B. Schema SynchronizationAs a senior developer, I recommend using a tool like **Liquibase** or **Flyway**. When you update the "Forum" feature, you need a script that automatically applies that SQL update to *all* 20+ tenant databases at the same time to prevent version drift.

####C. Cross-Tenant AnalyticsIf you need a "National Dashboard" (e.g., total members across all parties), you should build a **Data Warehouse (ETL)**. Do not query all tenant databases in real-time. Instead, have a background job that pushes anonymized stats into a central "Analytics DB."

---

###Next StepWould you like me to write the **SQL Connection Logic** or a **Middleware Script** (in Node.js or Python) that automatically detects which tenant is logged in and switches the database connection accordingly?

[Database-per-Tenant Architecture Pattern](https://www.google.com/search?q=database+per+tenant+architecture+diagram)
This search shows how the application layer sits between the central Landlord registry and the individual private databases.

# where should be district table : 
As a Senior Solution Architect with 15 years of experience, I recommend a **Hybrid Reference Model** for your district table. In a multi-tenant "Landlord/Tenant" architecture, the **District Table** should technically exist in **both** databases, but they serve two completely different architectural purposes.

Here is the deep-dive analysis of how to manage administrative information across the two layers.

---

###1. Landlord Database: The "Master District" TableThe Landlord database should hold the **Static Master List** of all 77 districts in Nepal. This is your "System of Record" that ensures every political party is using the same standardized codes and names.

**Management Logic:**

* **Immutable:** Political parties (Tenants) cannot add, delete, or rename districts here.
* **Standardization:** This table contains the official government codes (e.g., `CBS_CODE`, `ISO_CODE`) used for data integration with national systems.
* **Global Search:** When a user is registering and hasn't selected a party yet, the system pulls the list from here.

---

###2. Tenant Database: The "Organizational Unit" TableThe Tenant database should have its own table (often called `organizational_units` or `party_districts`) that **references** the Landlord's district ID.

**Management Logic:**

* **Customization:** One party might call it the "Kathmandu District Committee," while another calls it the "Kathmandu Branch."
* **Hierarchy:** This is where you store the **Nested Set** (`lft`, `rgt`) or **Materialized Path** specific to *that* party's internal structure.
* **Aggregated Data:** This table holds the `total_members` and `active_members` specific to that party in that district.

---

###3. Architect's View: The Relationship MappingAs a senior developer, I suggest the following schema relationship to bridge the two databases without a hard SQL JOIN:

| Feature | Landlord `geo_districts` | Tenant `org_units` |
| --- | --- | --- |
| **Data Scope** | All 77 Districts of Nepal | Party-specific committees |
| **Key Columns** | `id`, `name_en`, `name_np`, `code` | `id`, `landlord_district_id`, `lft`, `rgt` |
| **Updates** | Only by System Admin | By Party Admin |
| **Analytics** | National demographics | Party member leaderboards |

---

###4. Implementation Strategy: The "Ref-ID" PatternSince you cannot perform a `JOIN` across physical databases in most environments (like separate RDS instances), use the **Reference-ID Pattern**:

1. **On Tenant Creation:** Your "Onboarding Script" should populate the Tenant's `org_units` table with 77 rows, each having a `landlord_district_id` pointing to the Landlord's master list.
2. **On Data Fetch:** Your application code fetches the member count from the **Tenant DB** and "Hydrates" the district name from a **Redis Cache** that holds the Landlord's master list.

**Why this is robust:**
If the government renames a district (e.g., from "Nawalparasi" to "Nawalpur"), you only update it **once** in the Landlord DB. Every party's dashboard will automatically reflect the new name because they reference the same ID.

**Would you like me to write the "Onboarding Script" that seeds these district references into a new party's database automatically?**
As a Senior Solution Architect, I will define the exact schema for these two tables. The **Landlord** table acts as the "Standard Definition," and the **Tenant** table acts as the "Operational Instance."

---

###1. Landlord Database: `geo_provinces`This table is static and managed by the platform. It provides the "Universal ID" that allows cross-party analytics.

```sql
CREATE TABLE geo_provinces (
    id TINYINT UNSIGNED PRIMARY KEY, -- Static ID (1-7 for Nepal)
    iso_code VARCHAR(10) UNIQUE,     -- e.g., 'NP-P1'
    name_en VARCHAR(100) NOT NULL,   -- e.g., 'Koshi Province'
    name_np VARCHAR(100) NOT NULL,   -- e.g., 'कोशी प्रदेश'
    capital_city VARCHAR(100),       -- e.g., 'Biratnagar'
    total_districts TINYINT,         -- Metadata for UI
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Example Data
INSERT INTO geo_provinces (id, iso_code, name_en, name_np) 
VALUES (3, 'NP-P3', 'Bagmati Province', 'बागमती प्रदेश');

```

---

###2. Tenant Database: `organizational_units` (Province Entry)Within the Tenant (Party) database, we don't replicate the name/ISO code. Instead, we reference the Landlord ID and add party-specific leadership and statistics.

```sql
CREATE TABLE organizational_units (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    -- Foreign Reference to Landlord Database (Logic only, no physical FK)
    landlord_province_id TINYINT UNSIGNED NULL, 
    
    unit_type ENUM('HEADQUARTERS', 'PROVINCE', 'DISTRICT', 'PALIKA', 'WARD') NOT NULL,
    
    -- Hierarchy (Nested Set Model)
    lft INT NOT NULL,
    rgt INT NOT NULL,
    depth INT DEFAULT 1,
    
    -- Party-Specific Information
    leader_id BIGINT UNSIGNED NULL, -- References tenant.members
    leader_title VARCHAR(100) DEFAULT 'Provincial President',
    
    -- Denormalized Stats for Performance
    total_members INT UNSIGNED DEFAULT 0,
    active_members INT UNSIGNED DEFAULT 0,
    
    is_active TINYINT(1) DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_province_ref (landlord_province_id),
    INDEX idx_hierarchy (lft, rgt)
) ENGINE=InnoDB;

```

---

###3. Key Differences in Data Management| Management Aspect | Landlord `geo_provinces` | Tenant `organizational_units` |
| --- | --- | --- |
| **Data Integrity** | Governed by Nepal's Constitution. | Governed by the Party's Constitution. |
| **Record Count** | Fixed (7 rows). | Dynamic (1 row per Province the party exists in). |
| **Primary Key** | Static/Hardcoded (e.g., Bagmati is always `3`). | Auto-incrementing internal ID. |
| **Logic** | "What is a Province?" | "Who is our leader in this Province?" |

###Senior Architect's Pro-TipWhen a new party (Tenant) is created, your **Onboarding Script** should automatically run 7 `INSERT` statements into the Tenant's `organizational_units` table. This ensures that the moment a Party Admin logs in, they see all 7 provinces ready for member assignment, pre-linked to the correct global IDs.

**Would you like me to write the "Onboarding SQL Script" that initializes these 7 provinces in a new tenant database?**
As a Senior Solution Architect, I will now demonstrate how to operationalize the relationship between your **Landlord** and **Tenant** databases using an **Automated Onboarding Script**.

This script solves the "Zero-Day" problem: ensuring that the moment a new political party is registered, their private database is not just an empty shell, but a fully structured environment pre-populated with the 7 Provinces of Nepal.

###1. The Onboarding Workflow (Logic)When a new party signs up, your backend (Node.js/Python) performs these three steps in a transaction:

1. **Landlord DB:** Create a record in the `tenants` table.
2. **Infrastructure:** Provision a new physical database (e.g., `tenant_db_party_abc`).
3. **Hydration:** Run the "Seeding Script" to populate the `organizational_units` table with the 7 Master Provinces.

---

###2. The SQL Seeding Script (Tenant Side)This script runs inside the **New Tenant's Database**. It pulls the "Universal ID" from your application logic and maps it to the party's local hierarchy.

```sql
-- STEP 1: Insert the National Headquarters (Root of the Tree)
INSERT INTO organizational_units (unit_type, lft, rgt, depth, leader_title)
VALUES ('HEADQUARTERS', 1, 16, 0, 'Party Chairperson');

-- STEP 2: Seed the 7 Provinces
-- Note: 'landlord_province_id' matches the ID in your Landlord DB geo_provinces table.
INSERT INTO organizational_units (landlord_province_id, unit_type, lft, rgt, depth, leader_title)
VALUES 
(1, 'PROVINCE', 2, 3, 1, 'Koshi Provincial President'),
(2, 'PROVINCE', 4, 5, 1, 'Madhesh Provincial President'),
(3, 'PROVINCE', 6, 7, 1, 'Bagmati Provincial President'),
(4, 'PROVINCE', 8, 9, 1, 'Gandaki Provincial President'),
(5, 'PROVINCE', 10, 11, 1, 'Lumbini Provincial President'),
(6, 'PROVINCE', 12, 13, 1, 'Karnali Provincial President'),
(7, 'PROVINCE', 14, 15, 1, 'Sudurpashchim Provincial President');

```

---

###3. Senior Developer Insight: Why use `landlord_province_id`?By storing the **Landlord's ID** inside the **Tenant's Table**, we achieve **Cross-Tenant Compatibility** without data leakage:

* **Standardized Reporting:** Your master dashboard can run a query: *"Show me total members in Province 3 (Bagmati) across all 5 registered parties."* It simply sums the `total_members` column where `landlord_province_id = 3` across all databases.
* **Zero Redundancy:** You don't store the name "Bagmati" in the tenant DB. If the government renames it, you change it once in the Landlord DB, and the Tenant's UI (which "Hydrates" from the Landlord) updates instantly.

###4. Robust Metadata ManagementIn your **Landlord Database**, the `tenants` table should look like this to manage the connection:

| tenant_id | party_name | db_connection_string | status |
| --- | --- | --- | --- |
| `101` | "Social Democracy Party" | `db_user:pass@10.0.0.5/tenant_101` | `ACTIVE` |

---

###Next Step in DigitalizationNow that the geography is "Seeded," the party is ready to accept members. **Would you like me to design the "Member Migration Script" that takes a legacy CSV file and intelligently maps members to these newly seeded Province IDs?**

You can learn more about [Multi-tenant Database Strategies](https://www.youtube.com/watch?v=7xgYH1xHsk4) to understand the security and performance trade-offs of this architecture.

This video is relevant because it provides a deep dive into the different database models for SaaS applications, helping you choose the best isolation strategy for your political party platform.
