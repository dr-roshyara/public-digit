# 🔍 **ANALYSIS OF YOUR CURRENT ARCHITECTURE**

Looking at your Contexts, I can see you have a **well-developed DDD structure** already. Let me understand what's built:

## **📊 CURRENT CONTEXT STATUS**

### **✅ Well-Established Contexts:**
1. **PlatformContext** - Tenant creation, basic provisioning (looks comprehensive)
2. **TenantAuthContext** - Tenant authentication, user management (robust)
3. **ElectionContext** - Election management module (complete)
4. **ElectionSetupContext** - Election request workflows
5. **MobileDeviceContext** - Mobile app integration
6. **SharedContext** - Cross-cutting concerns

### **🔍 Key Observations:**
- You already have `Platform/Application/Services/TemplateProvisioningService.php`
- You have `TenantAuth/Application/Services/TenantProvisioningService.php` 
- Election module is already template-aware (good!)
- You have database migrations in each context
- Shared cryptography with Merkle trees (for election integrity)

## **🎯 WHAT'S MISSING & NEEDS DEVELOPMENT**

From our discussion, you need to implement the **4-layer migration strategy**:

1. **Category Templates** - Political Party Nepal specific schema
2. **Module Migrations** - Election module integration with templates  
3. **Custom Migrations** - Tenant-specific schema modifications
4. **Individual Migrations** - Ad-hoc schema changes

---

# 🚀 **FINAL CLAUDE CLI PROMPT INSTRUCTIONS**

```markdown
# 🎯 **TENANT SCHEMA EVOLUTION SYSTEM - SENIOR LARAVEL ARCHITECT**

## **PROJECT CONTEXT & CURRENT STATE**

You are implementing a **Template-Driven Database Evolution System** for a **Nepali Political Party SaaS Platform**.

### **✅ ALREADY BUILT:**
- **Laravel 12 + Spatie Multi-tenancy** with isolated tenant databases
- **DDD Architecture** with 6 established contexts (see Context.log)
- **Basic provisioning** works: PlatformContext creates tenant databases with basic migrations
- **Tenants can login** via subdomain (TenantAuthContext handles authentication)
- **Election module** exists as complete context with migrations
- **TemplateProvisioningService** skeleton exists in PlatformContext

### **🎯 BUSINESS REQUIREMENT:**
Extend the system to support **4-layer schema evolution** with **manual admin control**:
1. **Category Templates** - Pre-defined schemas for "Political Party Nepal" category
2. **Module Migrations** - Add modules like Election to tenant databases
3. **Custom Migrations** - Tenant-specific schema modifications
4. **Individual Migrations** - Ad-hoc changes with approval workflow

## **ARCHITECTURAL DECISIONS (FINAL)**

### **1. Context Responsibility:**
- **PlatformContext** → Tenant creation, basic migrations (ALREADY DONE)
- **TenantAuthContext** → **Template/Module provisioning** (EXTEND THIS)
- **ElectionContext** → Election module as a service (MAKE TEMPLATE-AWARE)
- **SharedContext** → Cross-cutting utilities (USE EXISTING)

### **2. Storage Strategy:**
```
storage/app/templates/                    # EXTERNAL TEMPLATE STORAGE
├── political_party_nepal/               # CATEGORY TEMPLATE
│   ├── template.json                    # Metadata
│   ├── migrations/                      # Laravel migrations
│   └── seeders/                         # Nepali data seeders
└── modules/                             # MODULE DEFINITIONS
    ├── election/                        # Election module
    │   ├── module.json
    │   └── migrations/
    └── financial_tracking/              # Future modules
```

### **3. Database Schema (Add to Landlord DB):**
```sql
-- Already have tenants table from PlatformContext
-- Need to add:
ALTER TABLE tenants ADD COLUMN template_slug VARCHAR(50) NULL;
ALTER TABLE tenants ADD COLUMN provisioning_status ENUM('basic', 'template_ready', 'module_ready', 'custom_ready');

-- New tables needed:
CREATE TABLE tenant_templates (...) -- Template definitions
CREATE TABLE tenant_modules (...)   -- Module definitions  
CREATE TABLE tenant_migration_history (...) -- Audit trail
CREATE TABLE tenant_custom_migrations (...) -- Custom migration requests
```

## **IMPLEMENTATION PRIORITIES**

### **PHASE 1: POLITICAL PARTY NEPAL TEMPLATE (Week 1)**
**Goal:** Admin can apply "Political Party Nepal" template to tenant

1. **Extend TenantAuthContext Domain:**
```bash
# Add template entities to existing TenantAuthContext
php artisan make:entity Template --context=TenantAuth
php artisan make:entity Module --context=TenantAuth
php artisan make:entity MigrationHistory --context=TenantAuth
```

2. **Create Political Party Nepal Template:**
```bash
mkdir -p storage/app/templates/political_party_nepal
# Create: template.json + 4-5 migration files
```

3. **Implement Template Application Service:**
```php
// Extend existing TenantProvisioningService in TenantAuthContext
class TemplateProvisioningService {
    public function applyTemplate(Tenant $tenant, string $templateSlug, User $admin): void
    {
        // 1. Validate admin belongs to tenant
        // 2. Load template definition
        // 3. Check compatibility
        // 4. Apply migrations in order
        // 5. Update tenant.template_slug
        // 6. Log to migration_history
    }
}
```

4. **Admin Interface (Inertia/Vue3):**
```php
// Add routes to existing TenantAuth routes
Route::tenantAdmin()->group(function () {
    Route::get('/templates', [TenantTemplateController::class, 'index']);
    Route::post('/templates/{template}/apply', [TenantTemplateController::class, 'apply']);
});
```

### **PHASE 2: ELECTION MODULE INTEGRATION (Week 2)**
**Goal:** Admin can add Election module to templated tenant

1. **Make Election Module Template-Aware:**
```php
// app/Contexts/Election/Domain/Services/ElectionModuleService.php
class ElectionModuleService {
    public function isCompatibleWith(string $templateSlug): bool {
        return in_array($templateSlug, ['political_party_nepal', 'ngo']);
    }
    
    public function getRequiredDependencies(): array {
        return ['membership_management']; // Example dependency
    }
}
```

2. **Module Application Service:**
```php
// In TenantAuthContext
class ModuleIntegrationService {
    public function addModule(Tenant $tenant, string $moduleSlug, User $admin): void {
        // 1. Check tenant has template applied
        // 2. Check module-template compatibility
        // 3. Resolve dependencies (simple topological sort)
        // 4. Apply module migrations
        // 5. Log to migration_history
    }
}
```

3. **Module Admin Interface:**
```vue
<!-- Module selection component -->
<template>
  <div v-if="tenant.template_applied">
    <h3>Available Modules</h3>
    <div v-for="module in compatibleModules">
      {{ module.name }}
      <button @click="addModule(module.slug)">Add Module</button>
    </div>
  </div>
</template>
```

### **PHASE 3: CUSTOM MIGRATIONS (Week 3)**
**Goal:** Tenant admins can request custom schema changes

1. **Custom Migration Request System:**
```php
// app/Contexts/TenantAuth/Domain/Entities/CustomMigrationRequest.php
class CustomMigrationRequest {
    private string $sql;
    private string $description;
    private User $requestedBy;
    private ?User $approvedBy;
    private DateTime $requestedAt;
    private MigrationStatus $status;
}
```

2. **Approval Workflow:**
```php
class CustomMigrationWorkflow {
    public function requestMigration(Tenant $tenant, string $sql, string $description, User $requester): void {
        // 1. Validate SQL syntax
        // 2. Check for destructive operations
        // 3. Create pending request
        // 4. Notify platform admins
    }
    
    public function approveMigration(CustomMigrationRequest $request, User $approver): void {
        // 1. Check approver permissions
        // 2. Execute SQL in tenant database
        // 3. Update request status
        // 4. Log to migration_history
    }
}
```

### **PHASE 4: NEPALI CONTEXT & POLISH (Week 4)**
**Goal:** Complete Nepali political party requirements

1. **Nepali Administrative Data:**
```php
// storage/app/templates/political_party_nepal/seeders/nepali_provinces_districts.php
class NepaliProvincesDistrictsSeeder {
    public function run(): void {
        DB::table('provinces')->insert([
            ['id' => 1, 'name' => 'कोशी प्रदेश', 'name_en' => 'Koshi Province'],
            // ... 7 provinces
        ]);
        
        DB::table('districts')->insert([
            ['id' => 1, 'province_id' => 1, 'name' => 'भोजपुर', 'name_en' => 'Bhojpur'],
            // ... 77 districts
        ]);
    }
}
```

2. **Election Commission Compliance:**
```php
// Financial tracking tables with NPR limits
Schema::create('donations', function (Blueprint $table) {
    $table->id();
    $table->decimal('amount_npr', 15, 2); // Nepali Rupees
    $table->string('donor_citizenship_number'); // Nepali format
    $table->enum('donation_type', ['cash', 'kind', 'service']);
    $table->date('reporting_quarter'); // Quarterly EC reporting
    $table->timestamps();
});
```

## **INTEGRATION WITH EXISTING CODEBASE**

### **1. Leverage Existing PlatformContext:**
```php
// Use existing Tenant model from PlatformContext
// Extend it with template relationship
class Tenant extends Model {
    public function template() {
        return $this->belongsTo(TenantTemplate::class, 'template_slug', 'slug');
    }
    
    public function appliedModules() {
        return $this->hasMany(TenantModule::class);
    }
}
```

### **2. Use Existing TenantAuthContext Infrastructure:**
```php
// Extend TenantAuthContext's existing services
// Already have: TenantAuthService, TenantUserManager, etc.
// Add template provisioning to existing TenantProvisioningService
```

### **3. Integrate with ElectionContext:**
```php
// ElectionContext already has migrations
// Need to make them conditionally applicable
// Use feature flags or template checks
```

## **IMPLEMENTATION DETAILS**

### **Simple Dependency Resolver (No SAT Solver):**
```php
class SimpleDependencyResolver {
    public function resolve(array $items): array {
        // Kahn's topological sort - O(V+E)
        $graph = $this->buildGraph($items);
        $inDegree = $this->calculateInDegree($graph);
        $queue = array_keys(array_filter($inDegree, fn($d) => $d === 0));
        $sorted = [];
        
        while (!empty($queue)) {
            $node = array_shift($queue);
            $sorted[] = $node;
            
            foreach ($graph[$node] ?? [] as $neighbor) {
                if (--$inDegree[$neighbor] === 0) {
                    $queue[] = $neighbor;
                }
            }
        }
        
        if (count($sorted) !== count($items)) {
            throw new CircularDependencyException();
        }
        
        return $sorted;
    }
}
```

### **Template Definition Format:**
```json
{
  "slug": "political_party_nepal",
  "name": "Political Party Nepal",
  "version": "1.0.0",
  "category": "political_party",
  "organization_types": ["political_party"],
  "nepali_context": {
    "required": true,
    "features": ["provinces", "districts", "citizenship_validation"]
  },
  "required_tables": [
    "political_parties",
    "party_committees",
    "committee_members",
    "provinces",
    "districts",
    "financial_reports"
  ],
  "migration_files": [
    "001_create_party_structure.php",
    "002_create_nepali_admin_hierarchy.php",
    "003_create_financial_compliance.php"
  ],
  "compatible_modules": ["election", "financial_tracking", "event_management"]
}
```

## **TESTING STRATEGY (TDD)**

### **Test Structure:**
```bash
# Unit Tests
tests/Unit/TenantAuth/TemplateProvisioningTest.php
tests/Unit/TenantAuth/ModuleIntegrationTest.php
tests/Unit/TenantAuth/DependencyResolverTest.php

# Feature Tests
tests/Feature/TenantAuth/TemplateApplicationTest.php
tests/Feature/TenantAuth/CustomMigrationTest.php

# Contract Tests
tests/Contract/TemplateCompatibilityTest.php
```

### **Sample Test:**
```php
class TemplateApplicationTest extends TestCase {
    public function test_admin_can_apply_political_party_template(): void {
        // Given
        $tenant = Tenant::factory()->create();
        $admin = User::factory()->for($tenant)->admin()->create();
        
        // When
        $response = $this->actingAs($admin)
            ->post("/tenant-admin/templates/political_party_nepal/apply");
        
        // Then
        $response->assertRedirect();
        $this->assertDatabaseHas('tenants', [
            'id' => $tenant->id,
            'template_slug' => 'political_party_nepal'
        ]);
        $this->assertDatabaseHas('migration_history', [
            'tenant_id' => $tenant->id,
            'migration_type' => 'template'
        ]);
    }
}
```

## **DELIVERABLES & TIMELINE**

### **Week 1 Deliverable:**
- [ ] Political Party Nepal template with migrations
- [ ] Template application service
- [ ] Admin UI for template selection
- [ ] Migration history logging
- [ ] Basic test suite

### **Week 2 Deliverable:**
- [ ] Election module template compatibility
- [ ] Module application service with dependency resolution
- [ ] Admin UI for module management
- [ ] Integration tests

### **Week 3 Deliverable:**
- [ ] Custom migration request system
- [ ] Approval workflow
- [ ] Safe SQL execution with rollback
- [ ] Audit trail for all changes

### **Week 4 Deliverable:**
- [ ] Nepali administrative data seeders
- [ ] Election Commission compliance features
- [ ] Performance optimization
- [ ] Complete documentation

## **STARTING POINT**

**Begin with:** Creating the Political Party Nepal template structure:

1. **First:** Create `storage/app/templates/political_party_nepal/template.json`
2. **Then:** Create 3-4 migration files for party structure
3. **Then:** Extend `TenantAuthContext` with Template entity
4. **Then:** Implement `TemplateProvisioningService::applyTemplate()`
5. **Then:** Create admin UI component

## **CONSTRAINTS TO PRESERVE**

1. **Don't break existing functionality** - Tenants can already login
2. **Use existing DDD structure** - Extend, don't rewrite
3. **Maintain database isolation** - Each tenant's schema stays separate
4. **Keep admin manual control** - Business requirement
5. **Focus on Nepali political parties** - Primary use case

## **READY TO START?**

Begin by examining the existing `TenantAuthContext` structure and creating the Political Party Nepal template definition. Focus on delivering business value for Nepali political parties while maintaining clean, maintainable code.

**First task:** Create the template definition and basic migration files for political party structure.
```

## **📋 ALTERNATIVE: CONCISE VERSION**

If Claude CLI needs a more concise version:

```markdown
# 🏗️ TENANT TEMPLATE PROVISIONING SYSTEM

## CONTEXT
- Laravel 12 + Spatie multi-tenancy with DDD
- 6 contexts already built (Platform, TenantAuth, Election, etc.)
- Basic tenant provisioning works
- Need 4-layer migration: Category → Module → Custom → Individual

## IMMEDIATE TASK
Extend TenantAuthContext to support template-driven schema evolution for Nepali political parties.

## START WITH:
1. Create Political Party Nepal template in `storage/app/templates/`
2. Extend TenantAuthContext with Template/Module entities
3. Implement TemplateProvisioningService
4. Build admin UI for template selection

## KEY PRINCIPLES:
- Manual admin control required
- Simple algorithms (no SAT/ML over-engineering)
- Focus on Nepali political party requirements
- Integrate with existing Election module
```

## **🔍 WHAT TO PROVIDE TO CLAUDE CLI**

If Claude needs more context, provide these key files:

1. **Existing TemplateProvisioningService** (`Platform/Application/Services/TemplateProvisioningService.php`)
2. **Tenant model** from PlatformContext
3. **TenantAuthContext service structure**
4. **ElectionContext module structure**

This prompt gives Claude CLI clear direction while leveraging your existing robust DDD architecture. The focus is on **extending what you have** rather than rebuilding from scratch.