# Political Party Template - Complete Documentation

**Nepali Political Party Management System**

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Table Specifications](#table-specifications)
4. [Nepal-Specific Features](#nepal-specific-features)
5. [Election Commission Compliance](#election-commission-compliance)
6. [Usage Examples](#usage-examples)

---

## Overview

The **Political Party Template** is a comprehensive database schema designed for Nepali political party management. It provides complete functionality for member management, committee hierarchy, election tracking, financial transparency, and event management.

### Template Information

| Property | Value |
|----------|-------|
| **Name** | Nepali Political Party Template |
| **Slug** | `political_party` |
| **Type** | `political_party` |
| **Version** | 1.0.0 |
| **Tables** | 10 core tables |
| **Required Modules** | RBAC Module (5 tables) |
| **Total Tables** | 15 tables |

### Key Features

✅ **Bilingual Support**: English + Nepali (UTF-8)
✅ **Nepal Administrative Structure**: 7 provinces, 77 districts
✅ **Citizenship Validation**: Nepal citizenship number format
✅ **Committee Hierarchy**: Central → Province → District → Municipality → Ward
✅ **Election Commission Compliance**: Donation limits, reporting
✅ **Financial Tracking**: Donations + Expenditures with EC transparency
✅ **Event Management**: RSVP, attendance tracking, budgeting
✅ **Auto-generated Membership Numbers**: Party-specific format

---

## Database Schema

### Complete Table List

#### RBAC Module (5 tables)
1. `permissions` - Individual permissions
2. `roles` - Role definitions with hierarchy
3. `model_has_permissions` - Direct permission assignments
4. `model_has_roles` - Role assignments with organizational context
5. `role_has_permissions` - Permission-to-role mappings

#### Political Party Template (10 tables)
1. `party_members` - Member registration and profiles
2. `party_committees` - Committee hierarchy structure
3. `committee_members` - Member-to-committee assignments
4. `constituencies` - Nepal election constituencies
5. `election_candidates` - Candidate nominations and tracking
6. `donations` - Financial donations with EC compliance
7. `expenditures` - Party spending and transparency
8. `party_events` - Event management with RSVP
9. `event_attendances` - Member attendance tracking
10. `settings` - Party configuration (18 default settings)

### Entity Relationship Diagram

```
┌─────────────────┐
│ party_members   │ (Core entity)
└────────┬────────┘
         │
         ├─→ committee_members ─→ party_committees
         │
         ├─→ election_candidates ─→ constituencies
         │
         ├─→ model_has_roles ─→ roles
         │
         └─→ event_attendances ─→ party_events


┌─────────────────┐
│ party_committees│
└────────┬────────┘
         │
         ├─→ committee_members
         │
         ├─→ expenditures (optional FK)
         │
         └─→ party_events

┌─────────────────┐
│ donations       │
└─────────────────┘

┌─────────────────┐
│ expenditures    │
└─────────────────┘
```

---

## Table Specifications

### 1. party_members

**Purpose**: Core member registration with Nepali citizenship and geographical data

**Key Columns:**
- **Personal Info (Bilingual)**: `first_name_en/ne`, `last_name_en/ne`, `middle_name_en/ne`
- **Contact**: `email`, `phone_primary`, `phone_secondary`
- **Citizenship**: `citizenship_number`, `citizenship_issued_district`, `date_of_birth`, `gender`
- **Permanent Address**: `permanent_province`, `permanent_district`, `permanent_municipality`, `permanent_ward`, `permanent_tole_en/ne`
- **Membership**: `membership_number`, `membership_type`, `joined_date`, `status`
- **Documents**: `photo_url`, `signature_url`, `citizenship_front_url`, `citizenship_back_url`

**Membership Number Format:**
```
{PARTY_CODE}-{PROVINCE}-{DISTRICT}-{YY}-{NNNN}

Example: NC-3-01-25-0001
  NC = Nepali Congress
  3 = Province 3 (Bagmati)
  01 = Kathmandu district
  25 = Year 2025
  0001 = Sequential number
```

**Membership Types:**
- `general` - General member
- `active` - Active member (pays annual dues)
- `life` - Life member (one-time payment)
- `honorary` - Honorary member

**Statuses:**
- `pending` - Application submitted, awaiting approval
- `active` - Active membership
- `suspended` - Temporarily suspended
- `expired` - Membership expired
- `terminated` - Membership terminated

**Indexes:**
- `idx_membership_number` - Unique membership lookup
- `idx_citizenship` - Citizenship validation
- `idx_province_district` - Geographical queries
- `ft_names` - Full-text search on names

**Sample Query:**
```sql
-- Find all active members in Kathmandu district
SELECT
    CONCAT(first_name_en, ' ', last_name_en) as name,
    membership_number,
    joined_date
FROM party_members
WHERE permanent_district = 'Kathmandu'
  AND status = 'active'
ORDER BY joined_date DESC;
```

---

### 2. party_committees

**Purpose**: 5-level committee hierarchy from Central to Ward level

**Hierarchy Levels:**
1. `central` - Central Committee (nationwide)
2. `province` - Provincial Committee (7 provinces)
3. `district` - District Committee (77 districts)
4. `municipality` - Municipality/Rural Municipality Committee
5. `ward` - Ward Committee

**Key Columns:**
- **Identification**: `name_en/ne`, `code`
- **Hierarchy**: `level`, `parent_id` (self-referencing)
- **Jurisdiction**: `province`, `district`, `municipality`, `ward`
- **Committee Info**: `formation_date`, `term_end_date`, `status`
- **Contact**: `office_address`, `phone`, `email`
- **Meetings**: `regular_meeting_schedule`, `last_meeting_date`, `next_meeting_date`

**Sample Structure:**
```
Central Committee (ID: 1)
  └─ Province 3 Committee (ID: 10, parent_id: 1)
      └─ Kathmandu District Committee (ID: 101, parent_id: 10)
          └─ Kathmandu Municipality Committee (ID: 1001, parent_id: 101)
              └─ Ward 1 Committee (ID: 10001, parent_id: 1001)
```

**Sample Query:**
```sql
-- Get all sub-committees under a parent
SELECT
    name_en,
    level,
    province,
    district
FROM party_committees
WHERE parent_id = 10  -- Province 3
  AND status = 'active'
ORDER BY level, name_en;
```

---

### 3. committee_members

**Purpose**: Links party members to committees with specific roles

**Roles:**
- `president` - Committee President/Chairman
- `vice_president` - Vice President
- `general_secretary` - General Secretary
- `secretary` - Secretary
- `treasurer` - Treasurer
- `member` - Committee Member
- `advisor` - Advisor

**Key Columns:**
- **Relationships**: `committee_id`, `member_id`
- **Role**: `role`, `designation_en/ne` (custom designations)
- **Assignment**: `appointed_date`, `term_end_date`, `status`
- **Documentation**: `appointment_letter_url`, `appointment_by`

**Unique Constraint:**
One member cannot have multiple active roles in the same committee.

**Sample Query:**
```sql
-- Get all office bearers of a committee
SELECT
    pm.first_name_en,
    pm.last_name_en,
    cm.role,
    cm.designation_en,
    cm.appointed_date
FROM committee_members cm
JOIN party_members pm ON cm.member_id = pm.id
WHERE cm.committee_id = 101  -- Kathmandu District
  AND cm.status = 'active'
  AND cm.role IN ('president', 'vice_president', 'general_secretary', 'secretary', 'treasurer')
ORDER BY
    FIELD(cm.role, 'president', 'vice_president', 'general_secretary', 'secretary', 'treasurer');
```

---

### 4. constituencies

**Purpose**: Nepal's 165 HoR + 330 Provincial Assembly constituencies

**Constituency Types:**
- `house_of_representatives` - 165 constituencies
- `provincial_assembly` - 330 constituencies (2 per HoR constituency)

**Key Columns:**
- **Identification**: `constituency_number`, `name_en/ne`, `code`
- **Type**: `type`
- **Geography**: `province`, `districts` (JSON array), `municipalities` (JSON array)
- **Statistics**: `total_voters`, `total_polling_stations`
- **Current Rep**: `current_representative_name`, `current_party`, `election_year`

**Sample Record:**
```json
{
  "id": 1,
  "constituency_number": 1,
  "name_en": "Kathmandu Constituency 1",
  "name_ne": "काठमाडौं क्षेत्र नं १",
  "code": "KTM-HOR-001",
  "type": "house_of_representatives",
  "province": "3",
  "districts": ["Kathmandu"],
  "municipalities": ["Kathmandu Metropolitan City"],
  "total_voters": 320000,
  "total_polling_stations": 280
}
```

**Sample Query:**
```sql
-- Get all HoR constituencies in Province 3
SELECT
    constituency_number,
    name_en,
    total_voters
FROM constituencies
WHERE type = 'house_of_representatives'
  AND province = '3'
ORDER BY constituency_number;
```

---

### 5. election_candidates

**Purpose**: Candidate nomination and election tracking

**Key Columns:**
- **Relationships**: `member_id`, `constituency_id`
- **Candidacy**: `symbol_url`, `candidate_number`
- **Election**: `election_type`, `election_year`, `election_date`
- **Status**: `status` (nominated, approved, filed, withdrawn, disqualified, elected, defeated)
- **EC Filing**: `ec_filing_number`, `ec_filing_date`, `ec_approval_date`
- **Campaign**: `campaign_budget`, `campaign_manager_id`, `campaign_office_address`
- **Results**: `votes_received`, `vote_percentage`, `result`

**Candidate Statuses:**
1. `nominated` - Nominated by party
2. `approved` - Approved by party leadership
3. `filed` - Filed with Election Commission
4. `withdrawn` - Candidacy withdrawn
5. `disqualified` - Disqualified by EC
6. `elected` - Won election
7. `defeated` - Lost election

**Unique Constraint:**
One member cannot be nominated multiple times in same constituency for same election.

**Sample Query:**
```sql
-- Get all party candidates for 2079 general election
SELECT
    pm.first_name_en,
    pm.last_name_en,
    c.name_en as constituency,
    ec.status,
    ec.votes_received,
    ec.result
FROM election_candidates ec
JOIN party_members pm ON ec.member_id = pm.id
JOIN constituencies c ON ec.constituency_id = c.id
WHERE ec.election_type = 'general'
  AND ec.election_year = 2079
ORDER BY ec.votes_received DESC;
```

---

### 6. donations

**Purpose**: Election Commission compliant donation tracking

**Donor Types:**
- `individual` - Individual donors
- `corporate` - Corporate/organizational donors
- `foreign` - Foreign donations (restricted by law)
- `anonymous` - Anonymous donations (limit: NPR 10,000)

**Key Columns:**
- **Receipt**: `receipt_number`, `receipt_date`
- **Donor**: `donor_type`, `donor_name`, `donor_pan_number`, `donor_citizenship`, `donor_address`
- **Amount**: `amount`, `currency`, `amount_in_npr`, `exchange_rate`
- **Payment**: `payment_method`, `cheque_number`, `bank_name`, `account_number`, `transaction_id`
- **Purpose**: `donation_purpose`, `fiscal_year`, `category`
- **EC Compliance**: `ec_compliant`, `exceeds_limit`, `requires_declaration`
- **Signatures**: `donor_signature_url`, `party_chairman_signature_url`, `treasurer_signature_url`
- **EC Reporting**: `submitted_to_ec`, `ec_submission_date`, `ec_report_reference`

**Payment Methods:**
- `cash` - Cash payment
- `cheque` - Cheque payment
- `bank_transfer` - Direct bank transfer
- `online` - Online payment
- `in_kind` - In-kind donation (goods/services)

**EC Compliance Rules:**
1. Anonymous donations limited to NPR 10,000
2. Foreign donations require special approval
3. PAN/VAT number mandatory for donations > NPR 25,000
4. All donations must be receipted
5. Annual report to Election Commission

**Sample Query:**
```sql
-- Get total donations for fiscal year 2081/082
SELECT
    donor_type,
    COUNT(*) as donation_count,
    SUM(amount) as total_amount
FROM donations
WHERE fiscal_year = '2081/082'
  AND deleted_at IS NULL
GROUP BY donor_type
ORDER BY total_amount DESC;
```

---

### 7. expenditures

**Purpose**: Party spending tracking for transparency

**Expenditure Categories:**
- `salaries` - Staff salaries
- `office_rent` - Office rental costs
- `utilities` - Electricity, water, internet
- `campaign` - Election campaign expenses
- `event` - Event costs
- `travel` - Travel expenses
- `printing` - Printing and publication
- `advertising` - Advertising costs
- `donation_given` - Donations given by party
- `other` - Other expenses

**Key Columns:**
- **Voucher**: `voucher_number`, `expenditure_date`
- **Category**: `category`, `sub_category`, `description`
- **Amount**: `amount`, `payment_method`
- **Payee**: `payee_name`, `payee_pan_number`, `payee_phone`, `payee_address`
- **Payment**: `cheque_number`, `transaction_id`, `bank_name`
- **Budget**: `budget_allocation_id`, `approved_by`, `approval_date`
- **Linkage**: `committee_id`, `event_id`
- **EC Reporting**: `requires_ec_reporting`, `submitted_to_ec`, `ec_submission_date`

**Sample Query:**
```sql
-- Get monthly expenditure summary for fiscal year
SELECT
    DATE_FORMAT(expenditure_date, '%Y-%m') as month,
    category,
    SUM(amount) as total_amount
FROM expenditures
WHERE fiscal_year = '2081/082'
GROUP BY month, category
ORDER BY month, total_amount DESC;
```

---

### 8. party_events

**Purpose**: Full event management with RSVP and attendance tracking

**Event Types:**
- `meeting` - Committee meetings
- `rally` - Political rallies
- `protest` - Protest/demonstration
- `press_conference` - Press conferences
- `training` - Training sessions
- `celebration` - Celebrations
- `convention` - Party conventions
- `other` - Other events

**Event Statuses:**
- `planned` - Event planned
- `confirmed` - Event confirmed
- `ongoing` - Event in progress
- `completed` - Event completed
- `cancelled` - Event cancelled
- `postponed` - Event postponed

**Key Columns:**
- **Event Info**: `title_en/ne`, `event_code`, `type`
- **Schedule**: `start_datetime`, `end_datetime`, `duration_minutes`
- **Location**: `venue_name`, `venue_address`, `province`, `district`, `municipality`, `venue_capacity`
- **Organizer**: `organized_by_committee_id`, `organizer_contact_person`, `organizer_phone`
- **RSVP**: `rsvp_enabled`, `rsvp_deadline`, `rsvp_required`, `rsvp_limit`
- **Budget**: `budget_allocated`, `budget_spent`, `budget_source`
- **Status**: `status`, `cancellation_reason`, `postponed_to`
- **Media**: `poster_url`, `photos` (JSON), `videos` (JSON), `press_release_url`
- **Attendance**: `total_attended`, `attendance_tracking_enabled`

**Sample Query:**
```sql
-- Get upcoming events in next 30 days
SELECT
    title_en,
    type,
    start_datetime,
    venue_name,
    expected_attendees,
    status
FROM party_events
WHERE start_datetime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)
  AND status IN ('planned', 'confirmed')
  AND deleted_at IS NULL
ORDER BY start_datetime;
```

---

### 9. event_attendances

**Purpose**: Member attendance tracking for events

**RSVP Statuses:**
- `invited` - Member invited
- `confirmed` - Member confirmed attendance
- `declined` - Member declined
- `tentative` - Member tentatively confirmed
- `no_response` - No response from member

**Attendance Methods:**
- `in_person` - Physical attendance
- `virtual` - Online/virtual attendance
- `proxy` - Attended via proxy

**Roles in Event:**
- `attendee` - Regular attendee
- `speaker` - Speaker
- `organizer` - Event organizer
- `moderator` - Moderator
- `guest` - Guest

**Key Columns:**
- **Relationships**: `event_id`, `member_id`
- **RSVP**: `rsvp_status`, `rsvp_date`, `rsvp_notes`
- **Check-in**: `checked_in`, `check_in_time`, `checked_out`, `check_out_time`
- **Participation**: `attendance_method`, `proxy_member_id`, `participated_in_discussions`, `role_in_event`
- **Feedback**: `feedback_rating`, `feedback_comments`

**Sample Query:**
```sql
-- Get attendance report for an event
SELECT
    pm.first_name_en,
    pm.last_name_en,
    ea.rsvp_status,
    ea.checked_in,
    ea.role_in_event,
    ea.feedback_rating
FROM event_attendances ea
JOIN party_members pm ON ea.member_id = pm.id
WHERE ea.event_id = 1
ORDER BY ea.role_in_event, pm.last_name_en;
```

---

### 10. settings

**Purpose**: Party configuration and settings

**Setting Groups:**
- `general` - General party information
- `financial` - Financial settings
- `events` - Event management settings

**Default Settings (18 total):**

```sql
-- General Settings
party_full_name_en: "Nepal Political Party"
party_full_name_ne: "नेपाल राजनीतिक पार्टी"
party_short_code: "NPP"
party_established_date: "2025-01-01"
party_registration_number: "EC/REG/2025/001"
party_symbol_url: NULL
party_flag_url: NULL
party_headquarters_address: "Kathmandu, Nepal"
party_contact_phone: "+977-1-XXXXXXX"
party_contact_email: "info@party.org.np"

-- Financial Settings
membership_fee_general: 500 (NPR)
membership_fee_active: 1000 (NPR)
membership_fee_life: 10000 (NPR)
anonymous_donation_limit: 10000 (NPR, per EC rules)
fiscal_year_current: "2081/082"

-- Event Settings
enable_rsvp_system: true
enable_attendance_tracking: true
default_event_rsvp_deadline_hours: 24
```

**Sample Query:**
```sql
-- Get party information
SELECT
    setting_key,
    setting_value,
    description
FROM settings
WHERE setting_group = 'general'
  AND is_public = TRUE
ORDER BY setting_key;
```

---

## Nepal-Specific Features

### 1. Administrative Structure

**Provinces (7):**
```
1 - Province 1
2 - Madhesh Pradesh
3 - Bagmati Pradesh
4 - Gandaki Pradesh
5 - Lumbini Pradesh
6 - Karnali Pradesh
7 - Sudurpashchim Pradesh
```

**Districts (77):** Validated against official list

**Municipalities:** Metropolitan/Sub-metropolitan/Municipality/Rural Municipality

**Wards:** Smallest administrative unit

### 2. Citizenship Format

**Format:** `DD-DD-DDDDDD`

Example: `01-05-123456`
- First 2 digits: District code
- Next 2 digits: VDC/Municipality code
- Last 6 digits: Serial number

### 3. Nepali Calendar Support

**Fiscal Year Format:** `YYYY/YYY`

Example: `2081/082` (2081 BS to 2082 BS)

**Date Storage:**
- All dates stored in AD (MySQL DATE type)
- Conversion to BS handled in application layer
- `date_of_birth` uses AD for calculations

### 4. Language Support

**Bilingual Fields:**
- Member names: `first_name_en/ne`, `last_name_en/ne`
- Committee names: `name_en/ne`
- Event titles: `title_en/ne`
- Constituencies: `name_en/ne`
- Addresses: `permanent_tole_en/ne`

**Character Set:** UTF-8 (`utf8mb4_unicode_ci`)

---

## Election Commission Compliance

### Required Features

✅ **Donation Limits**
- Anonymous donations: NPR 10,000 maximum
- Tracked in `donations.exceeds_limit` column

✅ **Donor Verification**
- PAN number required for donations > NPR 25,000
- Stored in `donations.donor_pan_number`

✅ **Receipt Generation**
- Unique receipt numbers: `donations.receipt_number`
- Receipt documents: `donations.receipt_url`

✅ **Signature Requirements**
- Donor signature: `donations.donor_signature_url`
- Party chairman signature: `donations.party_chairman_signature_url`
- Treasurer signature: `donations.treasurer_signature_url`

✅ **Fiscal Year Reporting**
- All donations/expenditures tagged with fiscal year
- EC submission tracking: `submitted_to_ec`, `ec_submission_date`

✅ **Expenditure Transparency**
- All spending recorded in `expenditures` table
- Linked to budget allocations
- Approval workflow: `approved_by`, `approval_date`

✅ **Candidate Filing**
- EC filing tracking: `election_candidates.ec_filing_number`
- Affidavit storage: `election_candidates.affidavit_url`
- Criminal record declaration: `election_candidates.criminal_record_url`

### Compliance Reports

#### 1. Annual Donation Report

```sql
SELECT
    fiscal_year,
    donor_type,
    COUNT(*) as donation_count,
    SUM(amount) as total_amount
FROM donations
WHERE fiscal_year = '2081/082'
GROUP BY fiscal_year, donor_type;
```

#### 2. Expenditure Report

```sql
SELECT
    category,
    SUM(amount) as total_spent
FROM expenditures
WHERE fiscal_year = '2081/082'
GROUP BY category;
```

#### 3. Candidate List for EC

```sql
SELECT
    pm.first_name_en,
    pm.last_name_en,
    pm.citizenship_number,
    c.name_en as constituency,
    ec.ec_filing_number,
    ec.ec_approval_date
FROM election_candidates ec
JOIN party_members pm ON ec.member_id = pm.id
JOIN constituencies c ON ec.constituency_id = c.id
WHERE ec.election_year = 2079
  AND ec.status = 'filed';
```

---

## Usage Examples

### Example 1: Register New Member

```sql
INSERT INTO party_members (
    first_name_en, first_name_ne,
    last_name_en, last_name_ne,
    email, phone_primary,
    citizenship_number, citizenship_issued_district,
    date_of_birth, gender,
    permanent_province, permanent_district,
    permanent_municipality, permanent_ward,
    membership_number, membership_type, joined_date, status
) VALUES (
    'Ram Bahadur', 'राम बहादुर',
    'Thapa', 'थापा',
    'ram.thapa@example.com', '+977-9841234567',
    '01-05-123456', 'Kathmandu',
    '1990-05-15', 'male',
    '3', 'Kathmandu', 'Kathmandu Metropolitan City', 1,
    'NC-3-01-25-0001', 'general', '2025-01-15', 'pending'
);
```

### Example 2: Create District Committee

```sql
-- First, create province committee (parent_id = 1 for central)
INSERT INTO party_committees (name_en, name_ne, code, level, parent_id, province, formation_date, status)
VALUES ('Province 3 Committee', 'प्रदेश ३ समिति', 'PROV3', 'province', 1, '3', '2025-01-01', 'active');

-- Then create district committee
INSERT INTO party_committees (name_en, name_ne, code, level, parent_id, province, district, formation_date, status)
VALUES ('Kathmandu District Committee', 'काठमाडौं जिल्ला समिति', 'KTM-DIST', 'district', 10, '3', 'Kathmandu', '2025-01-01', 'active');
```

### Example 3: Assign Member to Committee

```sql
INSERT INTO committee_members (
    committee_id, member_id, role,
    designation_en, designation_ne,
    appointed_date, status
) VALUES (
    101,  -- Kathmandu District Committee
    1,    -- Member ID
    'president',
    'District President', 'जिल्ला अध्यक्ष',
    '2025-01-15', 'active'
);
```

### Example 4: Record Donation

```sql
INSERT INTO donations (
    receipt_number, receipt_date,
    donor_type, donor_name, donor_pan_number,
    amount, currency,
    payment_method, bank_name,
    fiscal_year, category,
    created_by
) VALUES (
    'NC/DON/2025/0001', '2025-01-20',
    'individual', 'Sita Sharma', '123456789',
    50000, 'NPR',
    'bank_transfer', 'Nepal Bank Limited',
    '2081/082', 'general',
    1  -- Admin user ID
);
```

### Example 5: Create Event

```sql
INSERT INTO party_events (
    title_en, title_ne, event_code, type,
    start_datetime, end_datetime,
    venue_name, venue_address,
    province, district,
    organized_by_committee_id,
    expected_attendees,
    rsvp_enabled, rsvp_deadline,
    status, created_by
) VALUES (
    'District Convention 2025', 'जिल्ला अधिवेशन २०२५',
    'KTM-CONV-2025', 'convention',
    '2025-02-15 10:00:00', '2025-02-15 18:00:00',
    'City Hall', 'Kathmandu City Hall, Bagmati Pradesh',
    '3', 'Kathmandu',
    101,  -- Kathmandu District Committee
    500,
    TRUE, '2025-02-13 23:59:59',
    'planned', 1
);
```

---

**Next:** [07 - Schema Drift Detection](07-schema-drift-detection.md)
