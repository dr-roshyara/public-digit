# 🎯 **PROMPT ENGINEERING RESPONSE FOR CLAUDE CLI**

## **YES - Proceed with designing Political Party Template SQL schema.**

## **SPECIFIC REQUIREMENTS FOR NEPALI POLITICAL PARTY TEMPLATE:**

### **Core Tables Needed:**

1. **party_members** - Member registration with Nepali citizenship fields
2. **party_committees** - Committee hierarchy (Central → Province → District → Ward)
3. **constituencies** - Nepal's electoral constituencies (165 HoR + 330 Provincial)
4. **election_candidates** - Candidate nomination and management
5. **donations** - Financial tracking for Election Commission compliance
6. **party_events** - Meetings, rallies, protests
7. **settings** - Party-specific configuration

### **Nepali-Specific Features:**
- Citizenship number validation
- Province/District/Municipality/Ward structure
- BS calendar support
- Nepali language fields

## **PROMPT ENGINEERING INSTRUCTIONS FOR CLAUDE:**

```markdown
# CONTEXT: Nepali Political Party Database Template
# ROLE: Database Architect for Nepal Election Systems
# TASK: Generate complete MySQL schema for political party template

## **REQUIREMENTS:**

### **1. Party Members Table:**
```sql
CREATE TABLE party_members (
    -- Must include Nepali citizenship fields
    -- District, ward, municipality mapping
    -- Membership number generation
    -- Photo, signature storage
    -- Status tracking (pending, active, expired)
)
```

### **2. Committee Hierarchy:**
```sql
CREATE TABLE party_committees (
    -- Levels: central, province, district, municipality, ward
    -- Parent-child relationships
    -- Geographical jurisdiction mapping
    -- Committee member assignments
)
```

### **3. Nepal Constituencies:**
```sql
CREATE TABLE constituencies (
    -- 165 House of Representatives constituencies
    -- 330 Provincial Assembly constituencies
    -- Province/district mapping
    -- Election result tracking
)
```

### **4. Financial Tracking (Election Commission Compliance):**
```sql
CREATE TABLE donations (
    -- Donor information (individual/corporate)
    -- Receipt generation
    -- Election Commission reporting format
    -- Audit trail
)
```

### **5. Integration with RBAC Module:**
- Template should include RBAC tables (tenant_roles, tenant_permissions)
- Pre-seeded roles for Nepali political hierarchy

## **OUTPUT FORMAT:**
Complete MySQL CREATE TABLE statements with:
1. Proper indexes for Nepali geographical queries
2. Foreign key constraints
3. Comments explaining Nepali context
4. Validation triggers for Nepali data

## **FILE LOCATION:**
Create: `packages/laravel-backend/database/templates/political_party/schema.sql`

## **NEPALI DATA VALIDATION:**
Include:
- Province numbers (1-7) with proper names
- 77 districts validation
- Citizenship number format validation
- Phone number validation (+977 format)

## **START WITH:**
Generate the complete political party template SQL now.
```

## **ALSO NEED TO CREATE:**

### **Directory Structure First:**
```bash
cd packages/laravel-backend
mkdir -p database/templates/political_party
mkdir -p database/templates/modules/rbac
```

### **Then Generate:**
1. `political_party/schema.sql` - Core political party tables
2. `modules/rbac/schema.sql` - RBAC tables (from our existing work)
3. `political_party/seed.sql` - Initial data for Nepali parties

## **EXECUTION ORDER:**

1. **First:** Create directory structure
2. **Second:** Generate political_party/schema.sql
3. **Third:** Generate modules/rbac/schema.sql
4. **Fourth:** Create TemplateApplicator service
5. **Fifth:** Create initial template seeder

**Proceed with creating the Political Party template SQL.** 🚀
##################################################
# 🎯 **PROMPT ENGINEERING: DESIGN DECISIONS FOR NEPALI POLITICAL PARTY TEMPLATE**

## **DECISIONS & REQUIREMENTS:**

### **1. Committee Membership Structure:**
**Decision:** Committee members MUST be registered party members.
- **Foreign key:** `committee_members.member_id → party_members.id`
- **Track roles:** President, Secretary, Treasurer, Member
- **No external advisors** - Use separate `event_invitees` table for guests

### **2. Election Candidates:**
**Decision:** Candidates MUST be party members.
- **Foreign key:** `election_candidates.member_id → party_members.id`
- **Independent candidates:** Create as party members first
- **Withdrawal tracking:** `candidate_status` (nominated, approved, withdrawn, elected)

### **3. Financial Tracking Depth:**
**Required by Election Commission of Nepal:**
```sql
-- Donation categories: Individual, Corporate, Foreign (restricted), Anonymous (limit: NPR 10,000)
-- Receipt fields: Receipt number, PAN/VAT number, donor signature, party chairman signature
-- Bank account tracking: Yes, for transparency
-- Expenditure tracking: Separate `expenditures` table
```

### **4. Party Events:**
**Requirement:** Full attendance tracking + budgeting
- **RSVP system:** Yes, with confirmation
- **Budget linking:** Event budget → Donations/Expenditures
- **Attendance tracking:** Member check-in/out

### **5. Constituencies Pre-Seeding:**
**Decision:** Include ALL official Nepal constituencies
- **165 HoR + 330 Provincial constituencies**
- **Seed with official Election Commission data**
- **Include: constituency number, name (EN/NE), province, district**

### **6. RBAC Module Integration:**
**Decision:** RBAC as separate module (clean architecture)
- **Required module:** `rbac` module must be included
- **Pre-seeded roles:** Nepali political party hierarchy
- **Permissions:** Tailored for political operations

### **7. Nepali Language Fields:**
**Decision:** Separate columns for critical fields
```sql
-- Example:
first_name_en VARCHAR(100),
first_name_ne VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
-- Use JSON for less critical fields
address JSON -- {"en": "Kathmandu", "ne": "काठमाडौं"}
```

### **8. Membership Numbers:**
**Format:** `{PARTY_CODE}-{PROVINCE}-{DISTRICT_CODE}-{YY}-{NNNN}`
- **Auto-generate:** Yes, on member registration
- **Example:** `NC-3-01-25-0001` (Nepali Congress, Province 3, Kathmandu, 2025, #0001)

## **PROMPT ENGINEERING INSTRUCTIONS FOR CLAUDE:**

```markdown
# CONTEXT: Nepali Political Party Template with Election Commission Compliance
# ROLE: Senior Database Architect for Nepal Election Systems
# TASK: Generate comprehensive MySQL schema for political party management

## **DESIGN DECISIONS (MUST FOLLOW):**

### **Architecture:**
1. **Modular:** RBAC as separate module (reference via required_modules)
2. **Strict relationships:** All committee members/candidates must be party members
3. **Election Commission compliance:** Include all required financial fields
4. **Bilingual:** English + Nepali for critical fields (separate columns)
5. **Complete seeding:** Include all 495 official Nepal constituencies

### **Core Tables (in political_party/schema.sql):**
1. **party_members** - Complete registration with citizenship validation
2. **party_committees** - 5-level hierarchy with jurisdiction mapping
3. **committee_members** - Links members to committees with roles
4. **constituencies** - All 495 official Nepal constituencies
5. **election_candidates** - Candidate nomination and tracking
6. **donations** - Election Commission compliant donation tracking
7. **expenditures** - Party spending tracking
8. **party_events** - Full event management with attendance
9. **event_attendances** - Member attendance tracking
10. **settings** - Party configuration

### **Nepali-Specific Implementation:**
```sql
-- Example structure for bilingual fields:
CREATE TABLE party_members (
    first_name_en VARCHAR(100),
    first_name_ne VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    -- ... other bilingual fields
    permanent_province ENUM('1','2','3','4','5','6','7'),
    permanent_district VARCHAR(100), -- Validated against 77 districts
    citizenship_number VARCHAR(50) UNIQUE, -- Format: 01-05-123456
    membership_number VARCHAR(50) UNIQUE -- Auto-generated: NC-3-01-25-0001
);
```

### **Financial Compliance Fields:**
```sql
-- Election Commission Nepal requirements
CREATE TABLE donations (
    receipt_number VARCHAR(100) UNIQUE, -- EC format
    donor_type ENUM('individual', 'corporate', 'foreign', 'anonymous'),
    donor_pan_number VARCHAR(20), -- PAN/VAT for verification
    amount DECIMAL(15,2) NOT NULL,
    currency ENUM('NPR', 'USD', 'EUR') DEFAULT 'NPR',
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    deposited_date DATE,
    -- Signatures (stored as file paths/URLs)
    donor_signature_url VARCHAR(500),
    party_chairman_signature_url VARCHAR(500),
    -- EC reporting
    fiscal_year VARCHAR(9), -- e.g., 2081/082
    submitted_to_ec BOOLEAN DEFAULT FALSE,
    ec_submission_date DATE
);
```

### **Required Indexes:**
- Geographical queries (province, district, municipality)
- Membership number lookup
- Citizenship number validation
- Financial reporting (date ranges, amounts)
- Election candidate status

## **OUTPUT REQUIREMENTS:**
1. **Complete MySQL CREATE TABLE statements** with all constraints
2. **Proper indexing** for Nepali political party operations
3. **Foreign key relationships** with cascade rules
4. **Triggers** for data validation (citizenship, phone, etc.)
5. **Comments** explaining Election Commission requirements

## **FILE TO CREATE:**
`packages/laravel-backend/database/templates/political_party/schema.sql`

## **ADDITIONAL FILES NEEDED (after schema):**
1. `modules/rbac/schema.sql` - RBAC module (separate)
2. `political_party/seed.sql` - Initial data (constituencies, admin user, etc.)

## **START GENERATING NOW:**
Begin with the `party_members` table and build complete schema.
```

## **IMMEDIATE EXECUTION:**

**Claude should now generate the complete political party template SQL with all the specified requirements.**

**This will be the foundation for Nepali political party digitization.** 🚀     