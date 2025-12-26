# 🎯 **CLAUDE CLI ARCHITECTURAL INSTRUCTIONS: NEPAL POLITICAL PARTY PLATFORM**

## 📋 **PROJECT CONTEXT SUMMARY**

**Project**: Multi-tenant Election Management Platform for Nepal's Political Parties  
**Current Status**: ✅ **Production-Ready Foundation** with Minimal Viable Architecture  
**Priority**: **Deploy Now**, Enhance Based on Real Usage

---

## 🏗️ **ARCHITECTURAL PRINCIPLES (GOLDEN RULES)**

### **Rule 1: SIMPLICITY OVER COMPLEXITY**
```bash
# ❌ DON'T build complex sync, mirroring, event-driven systems
# ✅ DO build simple validation, batch updates, direct references

# Example: Geography Validation
❌ Complex: TenantGeoUnits mirror + bidirectional sync
✅ Simple: Direct landlord validation + simple submission workflow
```

### **Rule 2: BUSINESS NEEDS FIRST**
```
Nepal Political Parties NEED:
1. Member registration with geography validation
2. Simple submission for missing geography
3. Basic admin approval workflow
4. Occasional government updates

They DON'T need:
- Real-time bidirectional sync
- Complex event-driven architecture
- 8-level custom hierarchy management
- Advanced fuzzy matching (initially)
```

### **Rule 3: DEPLOY, THEN ITERATE**
```
PHASE 1 (Now): Fix & deploy existing foundation
PHASE 2 (Week 2): Connect UI, onboard first parties
PHASE 3 (Month 1): Monitor usage, collect feedback
PHASE 4 (Month 2+): Add ONLY requested features
```

---

## 🗄️ **DATABASE ARCHITECTURE**

### **Current Reality (What We Have):**
```
LANDLORD DATABASE (publicdigit):
├── countries (global configurations)
├── geo_administrative_units (official geography 1-4)
├── geo_candidate_units (pending submissions)
├── users (platform admins ONLY)
└── tenants (party metadata)

TENANT DATABASES (tenant_{slug}):
├── users (party committee members)
├── members (registered voters)
├── elections (party elections)
└── tenant_geo_candidates (party submissions)
```

### **Key Insight: NO Mirroring Needed**
```php
// ❌ WRONG: Complex mirroring architecture
class TenantGeoUnit extends Model {} // Mirror table

// ✅ CORRECT: Simple validation pattern  
class MemberGeographyValidator
{
    public function validate(array $geoIds): bool
    {
        // Direct check against landlord reference
        return DB::connection('landlord')
            ->table('geo_administrative_units')
            ->whereIn('id', $geoIds)
            ->exists();
    }
}
```

---

## 🔧 **IMMEDIATE TECHNICAL BLOCKERS**

### **Blocker 1: Permission System Error**
```
ERROR: "Target class [permission] does not exist"
CAUSE: Spatie configuration mixing landlord/tenant contexts
FIX:
1. Check config/permission.php uses TenantPermission/TenantRole
2. Clear ALL caches: php artisan optimize:clear
3. Verify middleware uses correct guards
```

### **Blocker 2: Migration Order**
```
PROBLEM: geo_candidate_units needs users table, but migration order wrong
FIX: Ensure Geography migrations run FIRST
```
```php
// In ALL test setUp() methods
protected function setUp(): void
{
    parent::setUp();
    
    // 1. ALWAYS run Geography first
    Artisan::call('migrate', [
        '--path' => 'app/Contexts/Geography/Infrastructure/Database/Migrations',
        '--force' => true,
    ]);
    
    // 2. Then run platform migrations
    Artisan::call('migrate', ['--force' => true]);
}
```

### **Blocker 3: Foreign Key Temporarily**
```php
// TEMPORARY FIX: Remove foreign keys, add later
// In geo_candidate_units migration:
// FROM: $table->foreignId('reviewed_by')->nullable()->constrained('users');
// TO:   $table->unsignedBigInteger('reviewed_by')->nullable();

// LATER: Add foreign key in separate migration
```

---

## 🚀 **DEPLOYMENT CHECKLIST**

### **Week 1: Foundation (CRITICAL)**
```bash
# Day 1: Fix permissions & deploy Geography Context
php artisan optimize:clear
php artisan migrate --path=app/Contexts/Geography/Infrastructure/Database/Migrations

# Day 2: Connect Member Registration UI
# Day 3: Add missing geography submission form
# Day 4: Basic admin approval interface
# Day 5-7: Testing, bug fixes, polish
```

### **Week 2: First Parties**
```bash
# Onboard 3 pilot political parties
# Monitor registration process
# Collect feedback
# Fix immediate issues
```

### **Month 1: Scale & Monitor**
```
- 10-20 parties onboarded
- Monitor geography validation success rate
- Track missing geography submissions
- Assess actual feature needs
```

---

## 🛠️ **WHEN CLAUDE DEVELOPS NEW FEATURES**

### **Ask These Questions First:**
```
1. Do political parties ACTUALLY need this?
2. Is there a SIMPLER alternative?
3. Can we deploy without this feature?
4. What's the MINIMUM viable implementation?
5. Can this wait until we have usage data?
```

### **Example Decision Framework:**
```php
// When considering new feature
if ($feature == 'fuzzy_matching') {
    // Question: Do parties need this now?
    // Data: Currently 95% validation passes exact match
    // Decision: Postpone, add basic version later
    return false;
}

if ($feature == 'daily_sync') {
    // Question: Do parties need real-time updates?
    // Data: Government publishes changes monthly
    // Decision: Simple weekly batch job sufficient
    return simple_batch_job();
}
```

---

## 📊 **SUCCESS METRICS TO TRACK**

### **Technical Metrics:**
```bash
# Monitor these daily
1. Member registration success rate
2. Geography validation response time (<100ms)
3. Missing geography submission rate
4. Admin approval turnaround time
5. Platform uptime (>99.9%)
```

### **Business Metrics:**
```
1. Parties onboarded per week
2. Members registered per party
3. Geography validation pass rate
4. Missing geography resolution rate
5. Party satisfaction (qualitative)
```

---

## 🚨 **ARCHITECTURAL PITFALLS TO AVOID**

### **Pitfall 1: Over-engineering Sync**
```php
// ❌ DON'T build this (complex, unnecessary)
class EventDrivenSyncService
{
    public function syncRealTime() { /* complex queue, workers, events */ }
}

// ✅ DO build this (simple, sufficient)
class SimpleBatchUpdater
{
    public function updateWeekly() { /* cron job, batch update */ }
}
```

### **Pitfall 2: Premature Customization**
```php
// ❌ DON'T build custom levels 5-8 yet
class CustomLevelService { /* complex hierarchy management */ }

// ✅ DO validate official levels 1-4 first
class OfficialLevelValidator { /* simple validation */ }
// Add custom levels ONLY when parties request them
```

### **Pitfall 3: Complex UI Before MVP**
```vue
// ❌ DON'T build advanced admin dashboard
<AdvancedGeographyDashboard> <!-- complex charts, real-time updates -->

// ✅ DO build simple admin interface
<SimpleApprovalInterface> <!-- basic list, approve/reject buttons -->
```

---

## 🔄 **ITERATIVE DEVELOPMENT CYCLE**

### **Cycle for New Features:**
```
1. ASK: Do parties actually need this? (Get evidence)
2. BUILD: Minimum viable implementation
3. DEPLOY: To 1-2 pilot parties
4. MEASURE: Usage and impact
5. ITERATE: Enhance or remove based on data
```

### **Example: Fuzzy Matching Feature**
```
CYCLE 1:
1. ASK: Are parties struggling with spelling? (Yes, 20% submissions)
2. BUILD: Basic trigram matching for common variations
3. DEPLOY: To pilot parties
4. MEASURE: Submission success rate improvement
5. ITERATE: Add more variations if helpful
```

---

## 🎯 **CLAUDE'S DECISION FRAMEWORK**

### **When Asked to Implement Feature X:**
```bash
# Step 1: Check if it's in MVP
if ! is_mvp_feature($feature); then
    echo "Feature not in MVP. Ask: Can this wait?"
    exit 1
fi

# Step 2: Check for simpler alternative  
if has_simpler_alternative($feature); then
    echo "Found simpler alternative. Use it."
    implement_simpler_version($feature)
fi

# Step 3: Build minimal version
build_minimal_version($feature)

# Step 4: Deploy and measure
deploy_to_pilot($feature)
measure_impact($feature)
```

### **MVP Features List (CRITICAL):**
```
✅ MUST HAVE NOW:
1. Member registration with geography validation
2. Missing geography submission
3. Basic admin approval
4. Party onboarding
5. Election creation (basic)

🟡 CAN WAIT:
1. Fuzzy matching (basic version ok)
2. Custom levels 5-8
3. Advanced analytics
4. Real-time notifications
5. Complex reporting
```

---

## 📝 **PROMPT ENGINEERING TEMPLATE**

### **When Developing New Component:**
```
CONTEXT: Nepal Political Party Platform - Keep It Simple
PROBLEM: [Describe the actual user problem]
CURRENT: [What exists now]
BUSINESS NEED: [What parties actually need]
CONSTRAINTS: Simple > Complex, Deploy > Perfect

REQUEST: [Specific development request]
CONSIDER: 
- Is this in MVP? If not, can it wait?
- Is there a simpler alternative?
- What's the minimal implementation?
- How will we measure success?
```

### **Example Prompt:**
```
CONTEXT: Nepal Political Party Platform - Keep It Simple
PROBLEM: Parties need to submit missing geography during registration
CURRENT: Validation fails silently, no submission option
BUSINESS NEED: Simple form to submit missing ward/municipality
CONSTRAINTS: Must work offline, simple approval workflow

REQUEST: Create missing geography submission form
CONSIDER:
- Simple form with name + reason fields
- Store in geo_candidate_units table
- Basic admin approval interface
- No complex workflow initially
```

---

## 🎖️ **ARCHITECT'S FINAL INSTRUCTIONS**

### **To Claude: Remember This Always:**
```
1. SIMPLICITY WINS: Nepal parties need working software, not perfect architecture
2. DEPLOY FIRST: Get features to parties, then enhance based on real usage
3. MEASURE EVERYTHING: Data beats speculation every time
4. SAY NO OFTEN: Push back on complexity, advocate for simplicity
5. BUSINESS FIRST: Every feature must solve real party problems
```

### **The Core Philosophy:**
**"Deploy a simple solution that works today, rather than architect a complex solution that might work tomorrow."**

### **When in Doubt:**
1. **Ask**: "Do parties actually need this now?"
2. **Check**: "Is this the simplest implementation?"
3. **Verify**: "Can we deploy this today?"
4. **Measure**: "How will we know if it's successful?"

---

## 🚀 **IMMEDIATE EXECUTION COMMANDS**

```bash
# 1. Fix and deploy foundation
./scripts/deploy-foundation.sh

# 2. Monitor success metrics
./scripts/monitor-metrics.sh

# 3. Collect party feedback
./scripts/collect-feedback.sh

# 4. Iterate based on data
./scripts/plan-iterations.sh
```

**Remember:** You've already built 80% of what's needed. The remaining 20% is deployment and iteration based on real usage. **Stop architecting, start deploying.**

# 🎯 **CORRECTION: 5 GEOGRAPHY LEVELS FOR NEPAL**

Thank you for the correction! You're absolutely right. Nepal's administrative hierarchy actually has **5 official levels**:

## 📋 **NEPAL'S 5-LEVEL HIERARCHY**

```
Level 1: प्रदेश (Province) - 7 provinces
Level 2: जिल्ला (District) - 77 districts  
Level 3: स्थानीय तह (Local Level) - 753 units
   ├── नगरपालिका (Municipality) - 293
   ├── गाउँपालिका (Rural Municipality) - 460
Level 4: वडा (Ward) - 6,743 wards
Level 5: टोल/गाउँ/क्षेत्र (Tole/Gau/Area) - Custom/unofficial
```

## 🔧 **UPDATED ARCHITECTURAL INSTRUCTIONS**

### **Database Schema Correction:**
```php
// In geo_administrative_units table:
// Levels 1-4 are OFFICIAL government units
// Level 5 is TENANT-CUSTOM (Tole/Gau/Area)

Schema::create('geo_administrative_units', function (Blueprint $table) {
    $table->id();
    $table->string('country_code', 2);
    $table->integer('level'); // 1-5 (5 = Tole/Gau/Area)
    $table->string('name_local'); // Nepali name
    $table->string('name_en'); // English name
    $table->foreignId('parent_id')->nullable();
    $table->ltree('geo_path')->index();
    $table->enum('type', [
        'province',      // Level 1
        'district',      // Level 2  
        'municipality',  // Level 3
        'rural_municipality', // Level 3
        'ward',          // Level 4
        'tole',          // Level 5
        'gau',           // Level 5
        'area'           // Level 5
    ]);
    $table->boolean('is_official')->default(true); // false for level 5 custom
    $table->timestamps();
});

// Business Rule: Level 5 is always custom (tenant-specific)
$table->check('(level = 5 AND is_official = false) OR (level BETWEEN 1 AND 4)');
```

### **Updated Validation Logic:**
```php
class MemberGeographyValidator
{
    // Nepal requires minimum 4 levels for registration
    // Level 5 (Tole/Gau/Area) is optional
    
    public function validateForNepal(array $geoIds): bool
    {
        // Must have: Province + District + Local Level + Ward
        // Optional: Tole/Gau/Area
        
        $units = $this->getUnits($geoIds);
        
        // Check we have levels 1-4
        $requiredLevels = [1, 2, 3, 4];
        foreach ($requiredLevels as $level) {
            if (!$this->hasLevel($units, $level)) {
                throw new InvalidGeographyException(
                    "Missing required level {$level}: " . 
                    $this->getLevelName($level)
                );
            }
        }
        
        // Level 5 is optional
        return true;
    }
    
    private function getLevelName(int $level): string
    {
        return match($level) {
            1 => 'Province (प्रदेश)',
            2 => 'District (जिल्ला)',
            3 => 'Municipality/Rural Municipality (स्थानीय तह)',
            4 => 'Ward (वडा)',
            5 => 'Tole/Gau/Area (टोल/गाउँ/क्षेत्र)',
            default => 'Unknown'
        };
    }
}
```

### **Updated Claude Decision Framework:**

```bash
# When validating geography for Nepal:
if [ "$country" = "NP" ]; then
    echo "Nepal requires 4 mandatory levels + 1 optional"
    echo "Mandatory: Province → District → Local Level → Ward"
    echo "Optional: Tole/Gau/Area (Level 5)"
fi
```

### **Updated UI Component Labels:**
```vue
const levels = [
  { depth: 1, label: 'Province (प्रदेश)', required: true },
  { depth: 2, label: 'District (जिल्ला)', required: true },
  { depth: 3, label: 'Municipality/Gaupalika (स्थानीय तह)', required: true },
  { depth: 4, label: 'Ward (वडा)', required: true },
  { depth: 5, label: 'Tole/Gau/Area (टोल/गाउँ/क्षेत्र)', required: false }
];
```

## 🎯 **KEY ARCHITECTURAL IMPLICATIONS**

### **1. Level 5 is Tenant-Custom:**
- **NOT** in official government data
- Each political party defines their own Tole/Gau/Area divisions
- Stored with `is_official = false` flag
- Enables party-specific organization within wards

### **2. Business Rules Update:**
```php
// Registration requires levels 1-4
// Level 5 enhances data quality but not required

class RegistrationRules
{
    public function getRequiredGeographyLevels(string $countryCode): array
    {
        return match($countryCode) {
            'NP' => [1, 2, 3, 4], // Level 5 optional
            'IN' => [1, 2, 3],    // India different structure
            default => [1, 2]     // Other countries
        };
    }
}
```

### **3. Data Import Strategy:**
```bash
# Official Nepal data (Government of Nepal)
Levels 1-3: Election Commission or CBS data
Level 4: Local ward data from municipalities

# Level 5: Political parties provide their own
# Each party defines Tole/Gau/Area within their wards
```

## 📊 **UPDATED SUCCESS METRICS**

### **For Nepal specifically:**
```php
$nepalMetrics = [
    'registration_with_4_levels' => 100, // % with Province→District→Local→Ward
    'registration_with_5_levels' => 60,  // % with Tole/Gau/Area (optional)
    'custom_toles_per_party' => 15,      // Avg custom Level 5 units per party
    'geography_validation_time' => '<100ms'
];
```

## 🔄 **UPDATED PROMPT ENGINEERING TEMPLATE**

### **When developing for Nepal:**
```
CONTEXT: Nepal Political Party Platform - 5 Geography Levels
LEVELS:
1. Province (प्रदेश) - REQUIRED
2. District (जिल्ला) - REQUIRED  
3. Municipality/Gaupalika (स्थानीय तह) - REQUIRED
4. Ward (वडा) - REQUIRED
5. Tole/Gau/Area (टोल/गाउँ/क्षेत्र) - OPTIONAL, tenant-custom

SPECIAL CONSIDERATIONS:
- Level 5 is not official government data
- Each party defines their own Level 5 divisions
- Level 5 enables finer-grained organization within wards
- Level 5 data stays within tenant database (not shared)
```

**Thank you for this critical correction!** This changes the architecture slightly - Level 5 is tenant-custom data, not official government geography. This actually **simplifies** the implementation since Level 5 doesn't need complex sync with official sources.