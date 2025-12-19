# 🌏 **SENIOR ARCHITECT'S GLOBAL IMPLEMENTATION INSTRUCTIONS**

## **🎯 FUNDAMENTAL PRINCIPLE FOR SOLO DEVELOPER**

> **"Build Nepal as a CONFIGURATION of a global system, not a HARDCODED implementation."**

As a solo developer, you need **maximum leverage**. Every line of Nepal-specific code should be **easily replacable** when adding India. Your Nepal implementation should be the **test case** that proves your global architecture works.

---

## **📁 CRITICAL FOLDER STRUCTURE FOR MULTI-COUNTRY**

```
app/Contexts/Platform/
├── Domain/
│   ├── ValueObjects/
│   │   ├── Geography/
│   │   │   ├── **CountryCode.php**          # 🇳🇵🇮🇳🇺🇸 Universal ISO codes
│   │   │   ├── GeographicHierarchyLevel.php # Level 1, 2, 3... not "Province", "State"
│   │   │   ├── AdminUnitId.php             # Generic ID that works for any country
│   │   │   └── AdminUnitType.php           # "province", "state", "district" - configurable
│   │   └── **AbstractGeography.php**       # Base classes for country-specific VOs
│   ├── Entities/
│   │   ├── Country.php                      # Aggregate Root - top level
│   │   ├── AdministrativeUnit.php           # Single entity for ALL geography
│   │   └── CountryGeographyConfig.php       # Defines Nepal's 4 levels, India's 6 levels
│   └── **CountrySpecific/**                 # 🇳🇵🇮🇳🇧🇩 Country implementations
│       ├── NP/
│       │   ├── NepaliProvince.php           # Extends AdminUnit
│       │   ├── NepaliDistrict.php
│       │   └── NepalGeographyConfig.php     # Defines Nepal's hierarchy
│       └── IN/                              # 🇮🇳 **EMPTY for now**
│           └── **TODO_INDIA.md**            # "Add Indian states here later"
├── Infrastructure/
│   └── Database/
│       └── Migrations/
│           ├── **create_geo_admin_units_table.php** # SINGLE table for ALL countries
│           └── **create_countries_table.php**       # Configures each country
└── **CountryConfiguration/**               # 🇳🇵🇮🇳🇺🇸 Pure config, no code
    ├── np.geography.json                  # Nepal's 7 provinces, 77 districts
    ├── in.geography.json                  # India's 28 states, 766 districts
    └── country_registry.json              # All country metadata
```

## **🗺️ DATABASE CRITICAL: SINGLE POLYMORPHIC TABLE**

```sql
-- ❌ DO NOT CREATE THIS (Nepal-specific, breaks global):
CREATE TABLE geo_provinces (...) -- ONLY works for Nepal

-- ✅ CREATE THIS (Works for Nepal, India, USA, ANY country):
CREATE TABLE geo_administrative_units (
    id BIGINT UNSIGNED PRIMARY KEY,
    **country_code CHAR(2) NOT NULL**,        -- 'NP', 'IN', 'US'
    **admin_level TINYINT NOT NULL**,         -- 1, 2, 3, 4 (NOT "province", "state")
    admin_type VARCHAR(50) NOT NULL,          -- 'province', 'state', 'district', 'ward'
    parent_id BIGINT UNSIGNED NULL,
    
    -- Names in ALL languages
    **name_en VARCHAR(200) NOT NULL**,
    **name_local JSON NOT NULL**,             -- {"np": "कोशी", "hi": "कोशी", "ne": "कोशी"}
    
    -- Nepal-specific data goes HERE, not in table structure
    **metadata JSON NULL**,                   -- {"np": {"total_wards": 14}, "in": {"parliament_seats": 80}}
    
    **PARTITION BY KEY(country_code)**        -- Critical for performance
) COMMENT='Works for Nepal TODAY, India TOMORROW';
```

---

## **🔧 SENIOR DEVELOPER'S CHECKLIST: NEPAL-ONLY BUT WORLD-READY**

### **✅ DO THESE (Nepal Implementation):**

1. **Always reference by `country_code` + `admin_level`:**
   ```php
   // ✅ GOOD - Country agnostic
   $unit = GeoUnit::where('country_code', 'NP')
                  ->where('admin_level', 1)  // Level 1 = provinces in Nepal
                  ->where('admin_type', 'province')
                  ->first();
   
   // ❌ BAD - Nepal specific
   $province = Province::find(1); // What about Indian states?
   ```

2. **Store ALL local names in JSON:**
   ```php
   // ✅ GOOD
   $names = [
       'en' => 'Koshi Province',
       'np' => 'कोशी प्रदेश',
       'hi' => 'कोशी प्रदेश', // For Nepali diaspora in India
       'ne' => 'कोशी प्रदेश'
   ];
   
   // ❌ BAD
   $name_en = 'Koshi';
   $name_np = 'कोशी';
   // What about Hindi? Tamil? Bengali?
   ```

3. **Use configuration files, not hardcoded values:**
   ```php
   // ✅ GOOD
   $nepalConfig = config('countries.NP');
   $nepalLevels = $nepalConfig['admin_levels']; // ["province", "district", ...]
   $provinceCount = $nepalConfig['expected_counts']['province']; // 7
   
   // ❌ BAD
   if ($provinceId > 7) { // Hardcoded for Nepal
       throw new Exception('Invalid province');
   }
   ```

4. **Prefix ALL Nepal-specific classes with NP_:**
   ```php
   // ✅ GOOD
   class NP_Province extends BaseAdminUnit {}
   class NP_District extends BaseAdminUnit {}
   
   // ❌ BAD  
   class Province {} // What about IndianState?
   ```

5. **Implement a CountryFactory:**
   ```php
   class CountryFactory {
       public static function createGeographyService(string $countryCode) {
           return match($countryCode) {
               'NP' => new NepalGeographyService(),
               'IN' => new IndiaGeographyService(), // Empty stub for now
               'US' => new USGeographyService(),   // Empty stub for now
               default => throw new UnsupportedCountryException($countryCode)
           };
       }
   }
   ```

### **❌ DO NOT DO THESE:**

1. **Never hardcode "7 provinces" anywhere:**
   ```php
   // ❌ WRONG - Will break for India
   const MAX_PROVINCES = 7;
   
   // ✅ RIGHT
   const MAX_ADMIN_LEVEL_1 = [
       'NP' => 7,   // Nepal provinces
       'IN' => 28,  // Indian states
       'US' => 50,  // US states
   ];
   ```

2. **Never assume "province" is the top level:**
   ```sql
   -- ❌ WRONG
   SELECT * FROM provinces WHERE country_id = 1;
   
   -- ✅ RIGHT  
   SELECT * FROM geo_administrative_units 
   WHERE country_code = 'NP' 
   AND admin_level = 1; -- Level 1 = provinces in Nepal
   ```

3. **Never use MySQL ENUM for country-specific values:**
   ```sql
   -- ❌ WRONG
   ideology ENUM('communist', 'socialist', 'liberal');
   
   -- ✅ RIGHT
   CREATE TABLE political_ideologies (
       id INT PRIMARY KEY,
       country_code CHAR(2) NULL, -- NULL = universal
       name JSON -- {"en": "communist", "np": "साम्यवादी", "hi": "कम्युनिस्ट"}
   );
   ```

---

## **🚀 REVISED CLAUDE PROMPT INSTRUCTIONS**

### **PHASE 1 PROMPT: GLOBAL FOUNDATION (Week 1-2)**

```text
CONTEXT:
I'm a solo developer building a political party platform starting with Nepal, 
but MUST support India and other countries later.

CRITICAL REQUIREMENTS:
1. Build a SINGLE polymorphic geography table that works for ALL countries
2. Every Nepal-specific value must be configurable (not hardcoded)
3. All classes must be country-agnostic or explicitly prefixed with NP_
4. Use JSON for multilingual names (not separate columns)

ARCHITECTURAL CONSTRAINTS:
1. Database: SINGLE table `geo_administrative_units` with:
   - `country_code CHAR(2)` 
   - `admin_level TINYINT` (1, 2, 3... NOT "province", "state")
   - `admin_type VARCHAR(50)` ("province" for Nepal, "state" for India)
   - `name_local JSON` (NOT name_en, name_np columns)
   - `metadata JSON` for country-specific data
   - Partition by `country_code`

2. Domain Layer Structure:
   - Base classes in `app/Contexts/Platform/Domain/`
   - Nepal-specific in `app/Contexts/Platform/Domain/CountrySpecific/NP/`
   - Empty folder `app/Contexts/Platform/Domain/CountrySpecific/IN/` for future

3. Configuration-Driven:
   - Nepal's 7 provinces = config value, NOT hardcoded
   - Store in `config/countries/np.php` or JSON

DELIVERABLES FOR NEPAL:
1. Database migration for SINGLE `geo_administrative_units` table
2. Base Domain classes (Country, AdminUnit, etc.)
3. Nepal-specific extensions (NP_Province, NP_District)
4. Seeder with Nepal's 7 provinces, 77 districts, 753 local levels
5. CountryFactory that can create Nepal service (and stubs for India/US)

EXAMPLE PATTERN TO FOLLOW:
// Base class - works for any country
class AdministrativeUnit {
    protected CountryCode $countryCode;
    protected int $adminLevel; // 1, 2, 3...
    protected string $adminType; // "province", "state", "district"
    protected LocalizedName $name; // JSON-based multilingual
}

// Nepal-specific
class NP_Province extends AdministrativeUnit {
    // Nepal-specific logic ONLY
    public function getTotalWards(): int {
        return $this->metadata['np']['total_wards'] ?? 0;
    }
}

// Config file
// config/countries/np.php
return [
    'name' => 'Nepal',
    'admin_levels' => [
        1 => ['type' => 'province', 'count' => 7],
        2 => ['type' => 'district', 'count' => 77],
        // ...
    ]
];
```

### **PHASE 2 PROMPT: TAXONOMY SYSTEM (Week 3-4)**

```text
CONTEXT:
Create global taxonomy system that works for all countries.
NO ENUMs - everything must be configurable.

REQUIREMENTS:
1. Replace ALL ENUMs with taxonomy tables:
   - Political ideologies (communist, socialist, etc.)
   - Electoral systems (FPTP, proportional, etc.)
   - Skills (legal, medical, etc.)
   - ID types (citizenship, passport, Aadhaar for India)

2. EVERY taxonomy must:
   - Support country-specific values (Aadhaar only in India)
   - Use JSON for multilingual names
   - Have `country_scope` field (NULL = universal, ["IN"] = India only)

3. Nepal-first implementation:
   - Seed with Nepal's ideologies (communist, democratic socialist)
   - Seed with Nepal's ID types (citizenship, passport)
   - But table structure MUST support India's Aadhaar, USA's SSN

DELIVERABLES:
1. Taxonomy table migrations (NO ENUMs)
2. Base Taxonomy classes
3. Nepal seed data
4. Empty seeders for India (commented out)
5. Validation service that checks country scope

EXAMPLE:
CREATE TABLE political_ideologies (
    id INT PRIMARY KEY,
    code VARCHAR(50) UNIQUE, -- 'COMMUNISM', 'SOCIALISM'
    name_local JSON NOT NULL, -- {"en": "Communism", "np": "साम्यवाद", "hi": "कम्युनिज़्म"}
    country_scope JSON NULL, -- NULL = universal, ["IN", "NP"] = specific countries
    is_active BOOLEAN DEFAULT TRUE
);

-- Seed data
INSERT INTO political_ideologies (code, name_local, country_scope) VALUES
('COMMUNISM', '{"en": "Communism", "np": "साम्यवाद", "hi": "कम्युनिज़्म"}', NULL),
('SOCIALISM', '{"en": "Socialism", "np": "समाजवाद", "hi": "समाजवाद"}', NULL),
-- Nepal-specific (if any)
('NEPALI_DEMOCRATIC_SOCIALISM', '{"en": "Democratic Socialism", "np": "लोकतान्त्रिक समाजवाद"}', '["NP"]'),
-- India-specific (for future)
('HINDUTVA', '{"en": "Hindutva", "hi": "हिन्दुत्व"}', '["IN"]'); -- COMMENTED OUT FOR NOW
```

### **PHASE 3 PROMPT: PARTY SYSTEM (Week 5-6)**

```text
CONTEXT:
Political party system that supports:
1. Parties operating in multiple countries (NCP in Nepal and India diaspora)
2. Party history (mergers, splits - CPN-UML + Maoist = NCP → split back)
3. Event sourcing for immutable history

GLOBAL REQUIREMENTS:
1. Party can have multiple branches (country-specific)
2. Each branch follows local country regulations
3. Event sourcing for ALL party changes (mergers, splits, name changes)

NEPAL-FIRST IMPLEMENTATION:
1. Implement for Nepal parties (NCP, UML, Congress)
2. Event sourcing for Nepal's complex party history
3. But data structure MUST support Indian parties (BJP, Congress) later

DELIVERABLES:
1. Party aggregate with event sourcing
2. PartyBranch entity (party in specific country)
3. Event store for party history
4. Nepal party seed data
5. Stub classes for Indian parties

CRITICAL DESIGN:
// Party operates globally
class PoliticalParty {
    private PartyId $id;
    private array $branches; // PartyBranch for each country
    private PartyHistory $history; // Event sourced
}

// Party in specific country
class PartyBranch {
    private CountryCode $countryCode;
    private LocalRegistration $registration; // Country-specific rules
    private LocalLeadership $leadership;
}

// Event sourcing
class PartyMergedEvent {
    private DateTime $occurredOn;
    private PartyId $primaryParty;
    private array $mergedParties; // Array of PartyId
    private array $metadata; // {"effective_date": "2018-05-17"}
}

// Nepal-specific seed
$ncp = PoliticalParty::create(
    name: 'Nepal Communist Party',
    branches: [
        new PartyBranch(countryCode: 'NP', registrationNumber: 'NCP-NP-001'),
        new PartyBranch(countryCode: 'IN', registrationNumber: 'NCP-IN-001'), // Diaspora
    ]
);

// Indian parties (stubs for future)
$bjp = PoliticalParty::create(
    name: 'Bharatiya Janata Party',
    branches: [
        new PartyBranch(countryCode: 'IN', registrationNumber: 'BJP-IN-001'),
        // Could have US diaspora branch later
    ]
);
```

---

## **📋 SOLO DEVELOPER WORKFLOW**

### **Daily Checklist:**

```bash
# Morning: TDD
1. Write test for Nepal feature
2. Implement to pass test
3. Verify test works for Nepal
4. Ask: "Would this break for India?"
5. If yes, refactor to be country-agnostic

# Afternoon: Global Verification
1. Run all tests
2. Check: "Can I add India without changing this code?"
3. Add stub for India in appropriate folder
4. Update documentation

# Evening: Configuration Review
1. Move any hardcoded value to config
2. Ensure all names use JSON, not separate columns
3. Verify all queries use country_code + admin_level
```

### **File Naming Convention:**

```
# Country-agnostic
AdminUnit.php
Country.php
PoliticalParty.php

# Nepal-specific (explicit prefix)
NP_Province.php
NP_District.php
NP_PartyHistoryService.php

# India-specific (empty for now, but folder exists)
IN/State.php           # Empty file with TODO comment
IN/Constituency.php    # Empty file with TODO comment

# Configuration files
config/countries/np.php
config/countries/in.php   # Empty config for now
```

### **Git Commit Messages:**

```
# Good commit messages
feat: Add polymorphic geography table (NP+IN ready)
feat: Implement Nepal provinces via config
refactor: Move hardcoded "7" to config for India support
chore: Add empty IN/ folder for future India implementation

# Bad commit messages
feat: Add provinces table          # Too Nepal-specific
feat: Add Nepal districts          # Not global thinking
```

---

## **⚠️ RED FLAGS - STOP AND REFACTOR IF YOU SEE:**

1. **Hardcoded numbers:**
   ```php
   // 🚨 RED FLAG
   if ($level == 1 && $count > 7) // 7 provinces for Nepal
   
   // ✅ FIX
   $maxLevel1 = config("countries.{$countryCode}.admin_levels.1.max_count");
   if ($level == 1 && $count > $maxLevel1)
   ```

2. **Country-specific table names:**
   ```php
   // 🚨 RED FLAG
   DB::table('provinces')->where('country_id', $nepalId)
   
   // ✅ FIX
   DB::table('geo_administrative_units')
     ->where('country_code', 'NP')
     ->where('admin_level', 1)
   ```

3. **Separate language columns:**
   ```sql
   -- 🚨 RED FLAG
   name_en VARCHAR,
   name_np VARCHAR,
   name_hi VARCHAR -- Adding Hindi? Tamil? Bengali?
   
   -- ✅ FIX
   name_local JSON -- {"en": "...", "np": "...", "hi": "...", "ta": "..."}
   ```

4. **Missing country_code in queries:**
   ```php
   // 🚨 RED FLAG
   Province::all() // Which country??
   
   // ✅ FIX
   AdminUnit::where('country_code', 'NP')
            ->where('admin_level', 1)
            ->get()
   ```

---

## **🎯 FINAL INSTRUCTION TO CLAUDE:**

When implementing ANY feature, ALWAYS ask:
1. "Does this work for Nepal today?"
2. "Will this require changes for India tomorrow?"
3. "Can I make it country-agnostic NOW?"

**Your Nepal implementation should be the PROOF that your global architecture works, not a special case that needs rewriting.**

---

## **🚀 IMMEDIATE NEXT STEPS:**

1. **Create the SINGLE polymorphic geography table** (not Nepal-specific tables)
2. **Implement Base Domain classes** that work for any country
3. **Create NP_ prefixed classes** for Nepal-specific logic
4. **Add empty IN/ folder** with TODO comments
5. **Store ALL Nepal data in config files**, not code

**Ready to implement Phase 1 with the corrected global-first approach?**