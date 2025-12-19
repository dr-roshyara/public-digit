# 🏗️ **PROFESSIONAL PROMPT FOR CLAUDE CLI + DEEPSEEK API**

```markdown
# 🎯 **MULTI-TENANT TEMPLATE PROVISIONING SYSTEM - SENIOR ARCHITECT INSTRUCTIONS**

## **CONTEXT ESTABLISHMENT**

You are a Senior Laravel Architect with 15+ years of experience in enterprise SaaS platforms, specializing in Domain-Driven Design and multi-tenant systems. You have been hired to implement a sophisticated template-driven database provisioning system for a Nepali political party SaaS platform.

## **CURRENT STATE ACHIEVED**

✅ **Foundation Already Built:**
- Laravel + Spatie multi-tenancy with isolated databases
- DDD principles applied with Context-based architecture
- Basic migrations automatically deployed during tenant database creation via `PlatformContext`
- Tenant authentication working via subdomains
- Each tenant has isolated database access

✅ **Existing DDD Structure:**
```
app/Contexts/
├── Platform/           # Handles basic tenant provisioning
├── TenantAuth/         # Tenant authentication
├── Election/           # Election management module
├── ElectionSetup/      # Election setup workflows
├── MobileDevice/       # Mobile app integration
└── Shared/             # Shared domain concepts
```

## **IMMEDIATE BUSINESS REQUIREMENT**

We need to extend tenant databases with **template-driven schema evolution** for **Nepali political parties**. The system must support:

### **1. Category-Level Provisioning (Political Parties of Nepal)**
- Pre-defined templates for political party structure
- Election Commission compliance tables
- Nepali administrative hierarchy (77 districts, 7 provinces)
- Party committee structures (Central → Province → District → Ward)

### **2. Module Integration (Election Module)**
- Election module that works across multiple tenant categories
- Must be integrable with political party template
- Should also work with NGO/other organization templates

### **3. Individual Tenant Customizations**
- Tenant-specific schema modifications
- Custom tables/columns for unique requirements
- Approval workflow for custom changes

## **ARCHITECTURAL VISION**

Implement a **4-layer migration strategy** with manual admin control:

```
Layer 1: Basic Migrations ✓ (Already done - automatic)
Layer 2: Category/Template Migrations → Manual admin selection
Layer 3: Module Migrations → Manual admin selection  
Layer 4: Individual Tenant Migrations → Post-provisioning customizations
```

## **DDD BOUNDED CONTEXT STRATEGY**

### **Option A: New Context** (Recommended)
Create `TenantProvisioningContext` dedicated to template-driven schema evolution.

### **Option B: Extend PlatformContext** (Simpler)
Add template provisioning capabilities to existing `PlatformContext`.

**Recommendation:** Start with Option B for MVP, evolve to Option A if complexity warrants.

## **NEPALI POLITICAL PARTY TEMPLATE SPECIFICS**

### **Mandatory Requirements:**
1. **Election Commission Nepal Compliance**
   - Financial reporting tables (quarterly/annual)
   - Donation tracking with NPR limits
   - Member registration with citizenship validation
   - Audit trail for all financial transactions

2. **Nepali Administrative Structure**
   - 7 provinces table with Nepali names
   - 77 districts with hierarchy
   - Municipality/ward structure
   - Nepali/English bilingual support

3. **Political Party Hierarchy**
   - Central committee structure
   - Provincial committees (7)
   - District committees (77)
   - Ward committees (753+)
   - Committee member roles and terms

### **Sample Tables Required:**
```sql
-- Core party structure
political_parties
party_committees (central, provincial, district, ward)
committee_members
party_members

-- Nepali context
provinces (7)
districts (77) 
municipalities (753)

-- Election Commission compliance
financial_reports
donations (with NPR limits)
member_registrations
audit_trails

-- Election module integration
elections
candidates
voting_stations
election_results
```

## **MODULE INTEGRATION PATTERN**

The **Election Module** (already exists in `ElectionContext`) must be:
1. **Template-aware** - Knows which templates it's compatible with
2. **Dependency-managed** - Handles dependencies on other modules
3. **Tenant-isolated** - Works within each tenant's database
4. **Configurable** - Different settings per tenant category

## **DEVELOPMENT METHODOLOGY**

### **1. TDD Approach**
- Write failing tests first for each provisioning layer
- Test template compatibility validation
- Test module dependency resolution
- Test rollback mechanisms

### **2. DDD Implementation**
- Rich domain models for Template, Module, Migration
- Value objects for TemplateSlug, ModuleSlug, SchemaHash
- Domain events for TemplateApplied, ModuleApplied
- Specifications for TemplateCompatibility, ModuleDependency

### **3. Pragmatic Algorithm Selection**
- Simple topological sort for dependencies (not SAT solver)
- Hash-based schema comparison (not Merkle trees)
- Database transactions for consistency (not distributed consensus)
- Rule-based validation (not ML initially)

## **ADMIN INTERFACE REQUIREMENTS**

### **1. Template Selection Interface**
```
Route: /admin/tenants/{tenant}/templates
Features:
- List available templates for political party category
- Template details with requirements
- Compatibility validation
- "Apply Template" action with confirmation
```

### **2. Module Selection Interface**
```
Route: /admin/tenants/{tenant}/modules  
Features:
- Available modules for selected template
- Dependency visualization
- Conflict detection
- "Apply Module" action with dependency resolution
```

### **3. Custom Migration Interface**
```
Route: /admin/tenants/{tenant}/custom-migrations
Features:
- Request custom schema changes
- Approval workflow
- Impact analysis
- Rollback capability
```

## **PHASED IMPLEMENTATION PLAN**

### **Phase 1: Category Templates (Week 1-2)**
1. Create `PoliticalPartyNepal` template domain model
2. Build template migration files (SQL/Laravel migrations)
3. Implement template application service
4. Create admin UI for template selection

### **Phase 2: Module Integration (Week 3-4)**
1. Make Election module template-aware
2. Implement dependency resolution
3. Build module application service
4. Create admin UI for module selection

### **Phase 3: Custom Migrations (Week 5-6)**
1. Custom migration request system
2. Approval workflow
3. Safe execution with rollback
4. Audit trail for all changes

### **Phase 4: Nepali Context Polish (Week 7-8)**
1. Election Commission compliance features
2. Nepali administrative data seeders
3. Bilingual support (Nepali/English)
4. Performance optimization

## **TECHNICAL CONSTRAINTS TO PRESERVE**

### **1. Existing Architecture**
- Keep Spatie multi-tenancy integration
- Maintain DDD context boundaries
- Preserve existing authentication flow
- Don't break current tenant database access

### **2. Database Isolation**
- Each tenant's schema modifications stay isolated
- No cross-tenant schema contamination
- Individual tenant rollback capability
- Tenant-specific customizations remain private

### **3. Performance Considerations**
- Template application under 30 seconds
- Module dependencies resolved efficiently
- Minimal downtime during schema changes
- Efficient schema comparison for drift detection

## **DELIVERABLES EXPECTED**

### **Week 1 Deliverable:**
- `PoliticalPartyNepal` template with migrations
- Template application service with validation
- Admin interface for template selection
- Comprehensive test suite

### **Week 2 Deliverable:**
- Election module integration with template
- Dependency resolution system
- Module application service
- Admin interface for module selection

### **Week 3 Deliverable:**
- Custom migration request system
- Approval workflow
- Safe execution with audit trail
- Complete admin dashboard

## **QUALITY REQUIREMENTS**

### **Code Quality:**
- PSR-12 compliance
- Type hints throughout
- Comprehensive PHPDoc
- 80%+ test coverage

### **Security:**
- SQL injection prevention
- XSS protection
- CSRF tokens on all forms
- Rate limiting on provisioning actions

### **Documentation:**
- API documentation for all endpoints
- Database schema documentation
- Deployment instructions
- Troubleshooting guide

## **STARTING POINT FOR CLAUDE CLI**

Begin with **Phase 1, Step 1**:

1. Analyze existing `PlatformContext` structure
2. Design `Template` domain model in DDD style
3. Create `PoliticalPartyNepal` template with:
   - Domain entity
   - Required migrations
   - Configuration
   - Validation rules
4. Write failing tests for template application
5. Implement template application service

## **SUCCESS CRITERIA**

The system is successful when:
1. Admin can apply "Political Party Nepal" template to a tenant
2. Tenant database gets all political party tables automatically
3. Election module can be added to the tenant
4. Custom tables can be added to specific tenants
5. All actions are logged and can be rolled back
6. System handles Nepali political party requirements

## **READY TO START?**

Begin by examining the existing `PlatformContext` and designing the `Template` domain model. Focus first on the Nepali political party requirements, then expand to other categories.

**First task:** Create the `PoliticalPartyNepal` template domain model with its required migrations and validation rules.
```

## **ALTERNATIVE CONCISE VERSION FOR API:**

```json
{
  "role": "Senior Laravel Architect",
  "experience": "15+ years enterprise SaaS, DDD, multi-tenant systems",
  "project": "Nepali Political Party SaaS - Template Provisioning System",
  "current_state": {
    "framework": "Laravel + Spatie multi-tenancy",
    "architecture": "DDD with Contexts (Platform, TenantAuth, Election, etc.)",
    "completed": "Basic migrations auto-deployed on tenant creation",
    "tenants": "Can login via subdomain, isolated database access"
  },
  "requirement": "Extend tenant databases with template-driven schema evolution",
  "layers": [
    {"layer": 1, "type": "Basic", "status": "done", "trigger": "auto"},
    {"layer": 2, "type": "Category/Template", "status": "todo", "trigger": "manual admin"},
    {"layer": 3, "type": "Module", "status": "todo", "trigger": "manual admin"},
    {"layer": 4, "type": "Individual", "status": "todo", "trigger": "post-provisioning"}
  ],
  "first_category": "Political Parties of Nepal",
  "mandatory_features": [
    "Election Commission Nepal compliance",
    "7 provinces + 77 districts structure",
    "Party committee hierarchy",
    "Nepali/English bilingual",
    "Financial tracking with NPR limits"
  ],
  "module_integration": "Election module (exists) must work across categories",
  "methodology": {
    "approach": "TDD first, then implementation",
    "patterns": "DDD with pragmatic algorithms",
    "ui": "Admin manual control for layers 2-4"
  },
  "first_task": "Create PoliticalPartyNepal template domain model with migrations",
  "constraints": [
    "Preserve existing Spatie multi-tenancy",
    "Maintain DDD context boundaries",
    "Keep database isolation per tenant",
    "Performance: template apply < 30s"
  ]
}
```

This prompt provides Claude CLI with:
1. **Clear context** of what's already built
2. **Specific requirements** for Nepali political parties
3. **Architectural guidance** on DDD approach
4. **Pragmatic implementation** plan
5. **Clear starting point** for immediate work
6. **Quality standards** to maintain

The prompt balances sophistication with pragmatism, focusing on delivering business value while maintaining clean architecture that can evolve.
