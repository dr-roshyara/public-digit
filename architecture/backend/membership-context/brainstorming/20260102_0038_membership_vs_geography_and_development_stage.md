# 🧠 **SHORT ANSWERS**

## **1. Revenue & Geography Module**
**NO.** Geography should be **Shared Kernel**, not a monetized module.  
**Reason:** Geography is **infrastructure** (like roads), not a feature (like tolls).  
**Better:** Monetize **Geo-Analytics** module that provides insights on membership distribution, voter demographics, etc.

## **2. Living Address vs Committee Location**
**YES, use same Geography Context for BOTH** but with different semantics:
- **Living Address:** `geo_path` (where member lives) - for residency verification
- **Committee Assignment:** `committee_geo_path` (where member serves) - for organizational role
- **Business Rule:** Committee location should be descendant of living address (can't serve in different province)

## **3. Member-Location Storage**
**CURRENT APPROACH IS CORRECT** but needs enhancement:
```sql
members table:
- geo_path_residence        -- Living address (ltree)
- geo_path_committee        -- Committee assignment (ltree, nullable)
- admin_unit_level1_id      -- Province (for indexing)
- admin_unit_level2_id      -- District
- ...up to level8
```
**Why same table?** Because geography is **intrinsic to member identity** in politics.

## **4. Committee Relationship**
**ADD SEPARATE TABLE** for committee roles:
```sql
committee_memberships
- member_id
- committee_id  
- role (president, secretary, member)
- term_start
- term_end
- geo_path (redundant but for performance)
```

---

# 🚀 **DEVELOPMENT STEPS (Sequential)**

## **PHASE 1: GEOGRAPHY CONTEXT ENHANCEMENT (Week 1)**
1. **Geography Shared Kernel Implementation**
   - Landlord Geography Seeder (Nepal hierarchy)
   - Geography Node API (REST endpoints)
   - Anti-Corruption Layer for tenants

2. **Dual Geography Support in Member**
   - Add `geo_path_residence` and `geo_path_committee` columns
   - Migration with ltree triggers
   - Validation: Committee ⊆ Residence hierarchy

3. **Geography Validation Service**
   - Hierarchy validation (parent-child checks)
   - Boundary validation (ward within district)
   - Duplicate prevention

## **PHASE 2: MEMBER-GEOGRAPHY INTEGRATION (Week 2)**
4. **Enhanced Member Registration**
   - Two-step geography selection: Residence → Committee
   - API endpoint for geography lookup
   - Frontend components (Angular/Vue)

5. **Geography-Based Business Rules**
   - Voting eligibility by residence
   - Committee eligibility rules
   - Forum access by geography

6. **Geo-Queries Optimization**
   - Materialized views for statistics
   - Indexing strategy (GIN indexes for ltree)
   - Cached geography hierarchies

## **PHASE 3: COMMITTEE MANAGEMENT (Week 3)**
7. **Committee Context Foundation**
   - Committee aggregate root
   - CommitteeMember entity (many-to-many with role)
   - Term management (start/end dates)

8. **Committee-Member Integration**
   - Assign member to committee
   - Role-based permissions
   - Term limits and renewal

9. **Committee Geography Validation**
   - Verify committee matches member's committee_geo_path
   - Hierarchy validation (Ward Committee ⊆ District Committee)

## **PHASE 4: FINANCIAL CONTEXT (Week 4)**
10. **Levy Management System**
    - Geography-based fee structure (urban vs rural rates)
    - Levy types: Membership, Donation, Event
    - Payment tracking and reconciliation

11. **Revenue Analytics Module**
    - Geography-based revenue reports
    - Membership fee waiver rules (by geography)
    - Donation tracking by region

12. **Financial Integration**
    - Payment gateway integration
    - Receipt generation
    - Tax/VAT compliance

## **PHASE 5: ADVANCED FEATURES (Week 5-6)**
13. **Geo-Analytics Module (Premium)**
    - Heat maps of membership density
    - Recruitment potential by region
    - Demographic analysis

14. **Mobile Field App**
    - GPS-based member verification
    - Offline geography data
    - Field data collection

15. **Reporting & Dashboard**
    - Real-time geography-based dashboards
    - Committee performance metrics
    - Financial reports by region

---

# 📋 **DETAILED STEP-BY-STEP IMPLEMENTATION**

## **STEP 1: Geography Shared Kernel**

### **1.1 Landlord Geography Database**
```bash
# Migration
php artisan make:migration create_geography_nodes_table --context=Geography --landlord

# Seeder for Nepal
php artisan make:seeder NepalGeographySeeder --context=Geography

# API Controller
php artisan make:controller GeographyController --context=Geography --api
```

### **1.2 Tenant Geography Sync**
```bash
# Service for syncing geography to tenants
php artisan make:service GeographySyncService --context=Geography

# Event listener for tenant creation
php artisan make:listener SyncGeographyToNewTenant --context=Geography --event=TenantCreated
```

## **STEP 2: Enhanced Member Model**

### **2.1 Dual Geography Columns**
```bash
# Migration
php artisan make:migration add_dual_geography_to_members --context=Membership

# Update Member model
php artisan make:valueobject DualGeography --context=Membership

# Validation service
php artisan make:service GeographyValidator --context=Membership
```

### **2.2 Geography Business Rules**
```bash
# Specifications
php artisan make:specification ResidencyEligibilitySpec --context=Membership
php artisan make:specification CommitteeEligibilitySpec --context=Membership

# Domain service
php artisan make:service MemberGeographyService --context=Membership
```

## **STEP 3: Committee Context**

### **3.1 Committee Bounded Context**
```bash
# Create new context
php artisan make:context Committee

# Committee aggregate
php artisan make:model Committee --context=Committee --aggregate

# CommitteeMember pivot with roles
php artisan make:model CommitteeMember --context=Committee
```

### **3.2 Committee-Member Integration**
```bash
# Integration service
php artisan make:service CommitteeAssignmentService --context=Committee

# Events
php artisan make:event MemberAssignedToCommittee --context=Committee
php artisan make:event CommitteeRoleChanged --context=Committee
```

## **STEP 4: Financial Integration**

### **4.1 Financial Context**
```bash
# Create context
php artisan make:context Finance

# Levy aggregate
php artisan make:model Levy --context=Finance --aggregate

# Payment entity
php artisan make:model Payment --context=Finance
```

### **4.2 Geography-Based Pricing**
```bash
# Pricing strategy
php artisan make:service GeographyPricingService --context=Finance

# Rules engine
php artisan make:service FeeWaiverService --context=Finance
```

## **STEP 5: API & Frontend**

### **5.1 REST API Endpoints**
```bash
# Geography API
php artisan make:controller MemberGeographyController --context=Membership --api

# Committee API  
php artisan make:controller CommitteeController --context=Committee --api

# Financial API
php artisan make:controller LevyController --context=Finance --api
```

### **5.2 Frontend Components**
```bash
# Angular components
ng generate component geography-selector
ng generate component committee-assignment
ng generate component payment-form

# Vue admin components
vue create committee-management
vue create financial-reports
```

---

# 🔗 **INTEGRATION FLOW**

```
User Registration → Select Residence → Validate → Select Committee → Validate → Create Member
      ↓                    ↓                    ↓                    ↓
Geography API      Hierarchy Check     Committee API       Eligibility Check
      ↓                    ↓                    ↓                    ↓
[Shared Kernel]    [Business Rules]   [Committee Context]  [Domain Service]
```

---

# 🎯 **CRITICAL DECISIONS NEEDED**

## **Decision 1: Geography Storage Strategy**
**Option A:** Store only `geo_path` (ltree) - Lightweight, fast queries  
**Option B:** Store both `geo_path` and individual level columns - Redundant but optimized for reporting  
**Recommendation:** **Option B** - Political systems need both hierarchical queries AND level-specific reporting.

## **Decision 2: Committee Assignment Model**
**Option A:** Direct in member table - Simple but inflexible  
**Option B:** Separate committee_memberships table - Supports multiple roles, terms, history  
**Recommendation:** **Option B** - Political careers involve multiple committee roles over time.

## **Decision 3: Financial Geography Mapping**
**Option A:** Fixed rates by membership type only  
**Option B:** Geography-based pricing matrix  
**Recommendation:** **Option B** with fallback - Urban rates may differ from rural, but same for same geography level.

---

# 📊 **EXPECTED OUTCOMES**

## **After Week 1:**
- Geography hierarchy seeded (Nepal: 7 provinces → 77 districts → 753 local levels → 6,743 wards)
- Members can be created with residence geography
- Basic validation working

## **After Week 2:**
- Dual geography support (residence + committee)
- Committee assignment possible
- Geography-based business rules enforced

## **After Week 3:**
- Committee management complete
- Role-based permissions working
- Term management implemented

## **After Week 4:**
- Financial integration complete
- Geography-based pricing
- Payment processing working

## **After Week 6:**
- Full system operational
- Analytics dashboard
- Mobile field app MVP

---

# ⚠️ **RISKS & MITIGATIONS**

1. **Risk:** Geography data changes (government restructuring)  
   **Mitigation:** Version geography data, store historical paths

2. **Risk:** Performance with deep hierarchies  
   **Mitigation:** Materialized views, GIN indexes, caching

3. **Risk:** Complex business rules  
   **Mitigation:** Specification pattern, rules engine

4. **Risk:** Data inconsistency across contexts  
   **Mitigation:** Event-driven consistency, saga pattern

---

**Ready to start with Step 1.1?** I'll provide the complete code for the Geography Shared Kernel migration and seeder first.