# 🏗️ **Architecture Overview: Geography Context Integration**

## 📊 **Abstract Architecture: Complete Relationship Map**

```mermaid
flowchart TB
    %% Style Definitions
    classDef landlord fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef tenant fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef membership fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef service fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef shared fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    %% Context Boundaries
    subgraph C1[Geography Context]
        direction TB
        A1[Country Model]
        A2[GeoAdministrativeUnit Model]
        A3[Geography Service]
        
        A1 -->|has many| A2
        A3 -->|queries| A1
        A3 -->|queries| A2
    end

    subgraph C2[Membership Context]
        direction TB
        B1[TenantGeoUnit Model]
        B2[Member Model]
        B3[Tenant Model]
        
        B1 -->|1-8 levels| B2
        B3 -->|owns| B1
        B3 -->|owns| B2
    end

    subgraph C3[Shared Layer]
        C[GeographyMirrorService]
        D[TenantObserver]
        
        C -->|triggers| D
    end

    %% Cross-Context Relationships
    A2 -.->|external_geo_id<br/>Cross-DB Reference| B1
    A3 -.->|validates hierarchy| C
    B2 -.->|geo_path queries| B1
    
    %% Database Connections
    subgraph DB1[Landlord Database]
        DB1A[countries table]
        DB1B[geo_administrative_units table]
        
        DB1A -->|1:N| DB1B
    end

    subgraph DB2[Tenant Database<br/>tenant_uml]
        DB2A[geo_administrative_units table<br/>tenant-specific]
        DB2B[members table]
        
        DB2A -->|1:8 foreign keys| DB2B
    end

    %% Application Flow
    Start[Tenant Created] --> D
    D --> C
    C -->|1. Fetch from| DB1B
    C -->|2. Mirror to| DB2A
    C -->|3. Map IDs| B1
    
    %% Usage Flow
    UserAction[Admin Adds Member] --> B2
    B2 -->|needs geography| B1
    B1 -->|official units reference| A2
    B1 -->|custom units local| DB2A

    %% Styling
    class A1,A2,A3 landlord
    class B1,B2,B3 tenant
    class C,D shared
    class DB1A,DB1B landlord
    class DB2A,DB2B tenant
```

## 🔄 **Detailed Interaction Sequence**

```mermaid
sequenceDiagram
    participant Admin as Party Admin
    participant MS as Membership Service
    participant GS as Geography Service
    participant MR as Member Repository
    participant GU as GeoAdministrativeUnit
    participant TGU as TenantGeoUnit
    participant M as Member

    %% 1. Member Registration with Geography
    Admin->>MS: Register Member with Geography IDs
    MS->>GS: Validate Hierarchy (Country, Levels 1-4)
    GS->>GU: Check parent-child relationships
    GU-->>GS: Hierarchy Valid
    GS-->>MS: Validation Passed
    
    MS->>TGU: Resolve Tenant Units<br/>(external_geo_id → tenant_id)
    TGU-->>MS: Tenant Unit IDs
    
    MS->>MR: Create Member with<br/>8-level FK references
    MR->>M: Save with geo_path
    
    M-->>Admin: Member Created Successfully
    
    %% 2. Geography Mirroring Process
    Note over Admin,TGU: When New Tenant Created
    MS->>TGU: Trigger Mirroring via Observer
    TGU->>GU: Fetch all units for country
    GU-->>TGU: Landlord units with hierarchy
    
    loop For Each Landlord Unit
        TGU->>TGU: Create mirrored copy<br/>with external_geo_id
        TGU->>TGU: Build ID mapping<br/>(landlord_id → tenant_id)
    end
    
    TGU-->>MS: Mirroring Complete<br/>X units copied
    
    %% 3. Custom Unit Creation
    Admin->>TGU: Create Custom Unit (Level 5-8)
    TGU->>TGU: Validate parent exists<br/>and can have children
    TGU->>TGU: Generate unique code
    TGU->>TGU: Update materialized path
    TGU-->>Admin: Custom Unit Created
```

## 🎯 **Context Responsibilities & Boundaries**

### **Geography Context (Landlord)**
```
RESPONSIBILITIES:
├── Global Reference Data
│   ├── Country configurations (NP, IN, DE, etc.)
│   ├── Official administrative hierarchies (levels 1-4)
│   └── Multilingual names and codes
├── Validation Logic
│   ├── Hierarchy validation (parent-child rules)
│   ├── Country-specific level definitions
│   └── Boundary change management
└── Read-Optimized API
    ├── Fast country/level queries
    ├── Cached hierarchy responses
    └── Spatial queries (future)

DATA MODEL:
GeoAdministrativeUnit {
  id: 12345
  country_code: "NP"
  admin_level: 2
  admin_type: "district"
  code: "NP-D25"
  name_local: {"en": "Kathmandu", "np": "काठमाडौं"}
  parent_id: 12344
  path: "1.23.456"
}
```

### **Membership Context (Tenant)**
```
RESPONSIBILITIES:
├── Tenant-Specific Geography
│   ├── Mirrored official units (levels 1-4)
│   ├── Custom party units (levels 5-8)
│   └── Tenant isolation enforcement
├── Member-Geography Relationship
│   ├── 8-level foreign key storage
│   ├── Materialized paths for queries
│   └── Geography assignment/validation
└── Tenant Operations
    ├── Custom unit management
    ├── Member density reporting
    └── Geography-based permissions

DATA MODEL:
TenantGeoUnit {
  id: 98765 (tenant-specific)
  tenant_id: 777
  external_geo_id: 12345 (references landlord)
  unit_type: "official" | "custom"
  admin_level: 2
  code: "OFFICIAL-NP-NP-D25"
  parent_id: 98764
  geo_path: "98764.98765"
}

Member {
  admin_unit_level1_id: 98764
  admin_unit_level2_id: 98765
  ...
  admin_unit_level8_id: null
  geo_path: "98764.98765"
}
```

## 🔗 **Critical Integration Points**

### **1. ID Mapping Layer**
```php
// The crucial bridge between contexts
class GeographyIdMapper
{
    private static $cache = [];
    
    public static function landlordToTenant(
        int $landlordId, 
        int $tenantId
    ): ?int {
        $key = "map:{$tenantId}:{$landlordId}";
        
        return Cache::remember($key, 3600, function () use ($landlordId, $tenantId) {
            return TenantGeoUnit::where('tenant_id', $tenantId)
                ->where('external_geo_id', $landlordId)
                ->value('id');
        });
    }
    
    public static function tenantToLandlord(int $tenantUnitId): ?int
    {
        return TenantGeoUnit::find($tenantUnitId)->external_geo_id;
    }
}
```

### **2. Cross-Context Service Contracts**
```php
// Geography Context provides these to Membership Context
interface GeographyValidationContract
{
    public function validateHierarchy(string $countryCode, array $landlordIds): bool;
    public function getCountryConfig(string $countryCode): array;
    public function getUnitWithAncestors(int $landlordId): array;
}

// Membership Context provides these to Geography Context
interface GeographyUsageContract  
{
    public function getTenantsUsingCountry(string $countryCode): Collection;
    public function getGeographyUsageStats(int $landlordUnitId): array;
}
```

## 📈 **Data Flow in Production**

### **Scenario: UML Party adds member in Kathmandu**
```
1. FRONTEND → MEMBERSHIP CONTEXT:
   POST /members
   {
     "name": "Ram Bahadur",
     "geography": {
       "country": "NP",
       "units": [1, 25, 456, 7890] // Landlord IDs for Province→District→Local→Ward
     }
   }

2. MEMBERSHIP CONTEXT VALIDATION:
   - Calls GeographyContext::validateHierarchy('NP', [1, 25, 456, 7890])
   - GeographyContext checks parent-child relationships
   - Returns: true/false with validation errors

3. ID RESOLUTION:
   - For each landlord ID, lookup tenant-specific ID:
     1 (landlord) → 1001 (tenant_uml)
     25 → 1002
     456 → 1003  
     7890 → 1004

4. MEMBER CREATION:
   Member::create([
     'admin_unit_level1_id': 1001,
     'admin_unit_level2_id': 1002,
     'admin_unit_level3_id': 1003,
     'admin_unit_level4_id': 1004,
     'geo_path': '1001.1002.1003.1004'
   ])

5. CUSTOM GEOGRAPHY (Optional):
   - Admin later creates Tole (level 5) under ward 1004
   - New member assigned to tole: geo_path becomes '1001.1002.1003.1004.1005'
```

## 🛡️ **Architecture Guard Rails**

### **Rule 1: Never Join Across Contexts**
```sql
-- FORBIDDEN: Cross-database join
SELECT * FROM landlord.geo_units
JOIN tenant_uml.members ON geo_units.id = members.province_id;

-- REQUIRED: Mirror then query locally
-- 1. Mirror landlord units → tenant_uml.geo_units
-- 2. Query: SELECT * FROM tenant_uml.members 
--           JOIN tenant_uml.geo_units ON members.province_id = geo_units.id
```

### **Rule 2: Contexts Communicate via Contracts**
```php
// WRONG: Direct model usage across contexts
$landlordUnit = Landlord\GeoUnit::find(123); // In Membership Context

// CORRECT: Use service contracts
$isValid = $this->geographyValidator->validateHierarchy('NP', [1, 25, 456]);
```

### **Rule 3: Tenant Data Never References Landlord Directly**
```php
// Store reference, not dependency
class TenantGeoUnit {
  protected $fillable = [
    'external_geo_id', // OK: Reference ID
    // 'landlord_unit'  // BAD: Direct relationship
  ];
  
  // Access via cached service call
  public function getLandlordData(): array
  {
      return $this->geographyService->getUnit($this->external_geo_id);
  }
}
```

## 🎯 **Why This Architecture Works**

### **Separation of Concerns**
- **Geography Context** = "What exists in the world"
- **Membership Context** = "How our party organizes in that world"

### **Scalability**
- Geography changes infrequently → Heavily cached
- Membership operations frequent → Tenant-optimized
- New countries added without touching membership code

### **Maintainability**
- Teams can work independently
- Geography team updates boundaries
- Membership team builds party features
- Integration via clear contracts

## 🔮 **Evolution Path**

```mermaid
timeline
    title Architecture Evolution
    section Phase 1 : Now
        Single-table landlord<br>Basic mirroring
    section Phase 2 : 6 Months
        Event-driven sync<br>Multi-country support
    section Phase 3 : 1 Year
        Spatial queries<br>Advanced analytics
    section Phase 4 : 2 Years
        Global search<br>Real-time boundaries
```

## 📋 **Implementation Checklist**

- [ ] **Geography Context**: Complete, tested, deployed
- [ ] **Landlord Database**: Contains Nepal, India, Germany data  
- [ ] **Membership Context**: Tenant models defined
- [ ] **Tenant Databases**: Migration ready for geo_administrative_units
- [ ] **Mirroring Service**: Copies landlord → tenant with ID mapping
- [ ] **Integration Tests**: Validate cross-context communication
- [ ] **API Layer**: REST endpoints for geography assignment
- [ ] **Monitoring**: Track mirroring success/failure rates

**Key Insight**: The Geography Context provides the **universal truth** of administrative boundaries. The Membership Context creates **tenant-specific instances** of that truth, extended with party-specific organization. They collaborate through well-defined contracts, never direct dependencies.

**Next Architecture Decision**: Should we implement an event-driven sync for landlord changes, or rely on periodic manual updates?