# 🎯 **PROMPT ENGINEERING RESPONSE FOR CLAUDE CLI**

## **RESPONSE:** Option 1 - Yes, make the edit to TenantRole.php

## **FOLLOW-UP INSTRUCTIONS FOR CLAUDE:**

```markdown
## **NEXT STEPS AFTER TENANTROLE EDIT:**

### **1. Complete the RBAC Foundation:**
After editing TenantRole.php, we need to:

**A. Update TenantPermission model similarly:**
```bash
# Check if TenantPermission needs similar helper methods
# Look for methods like:
- assignPartyPermission()
- getPermissionsByCategory()
- syncPartyPermissions()
```

**B. Create RBAC helper trait for TenantUser:**
```php
// Generate trait: TenantUserRbacTrait.php
trait TenantUserRbacTrait {
    public function assignPartyRole($roleCode, $committeeId = null) {}
    public function hasPartyPermission($permission, $committeeContext = null) {}
    public function getCommitteeRoles($committeeId) {}
    public function isCommitteeChair($committeeId) {}
}
```

### **2. Test RBAC Setup:**
```bash
# After editing TenantRole.php, run:
cd packages/laravel-backend

# Test the seeder
php artisan db:seed --class=TenantRbacSeeder

# Verify the new helper methods work
php artisan tinker --execute="
use App\Contexts\TenantAuth\Domain\Models\TenantRole;
\$role = TenantRole::where('code', 'district_coordinator')->first();
dd(\$role->canBeAssignedToCommitteeLevel('district'));
"
```

### **3. Transition to Template System:**
**Critical: We need to integrate RBAC into template system**

**A. Create RBAC as Template Module:**
```bash
# Create RBAC module in templates
mkdir -p database/templates/modules/rbac
touch database/templates/modules/rbac/schema.sql
touch database/templates/modules/rbac/seed.sql
```

**B. Add RBAC to Political Party Template:**
```sql
-- In political_party template, include:
-- 1. RBAC tables (tenant_roles, tenant_permissions, etc.)
-- 2. Seed data from TenantRbacSeeder
-- 3. Helper methods we just created
```

### **4. Immediate Template System Tasks:**

**Priority 1: Landlord Template Schema**
```bash
# Generate landlord database tables for template management
php artisan make:migration create_tenant_templates_table
php artisan make:migration create_template_modules_table
php artisan make:migration create_template_versions_table
```

**Priority 2: Political Party Template SQL**
```bash
# Create the actual template that will be applied to tenant databases
touch database/templates/political_party/schema.sql
# This should include RBAC tables + Nepali political party tables
```

**Priority 3: Integration with Approval Process**
```bash
# Find where tenant approval happens
grep -r "approve" packages/laravel-backend/app/ --include="*.php"
grep -r "tenant.*create" packages/laravel-backend/app/ --include="*.php"
```

## **SPECIFIC PROMPTS FOR CLAUDE TO GENERATE NEXT:**

### **Prompt 1: Landlord Template Schema**
"Generate complete Laravel migration files for landlord template management system. Include tables: tenant_templates (id, name, type, version, description, schema_sql, seed_sql, is_active, metadata), template_modules (id, template_id, name, module_type, schema_sql, seed_sql, dependencies, display_order), and template_versions (id, template_id, version, migration_sql, rollback_sql, created_at). Include proper indexes and foreign keys."

### **Prompt 2: RBAC Template Module**
"Generate database/templates/modules/rbac/schema.sql and seed.sql that encapsulate the RBAC system we just built. Include: tenant_roles, tenant_permissions tables, their relationships, and seed data for Nepali political party roles/permissions."

### **Prompt 3: Political Party Core Tables**
"Generate database/templates/political_party/schema.sql with core Nepali political party tables: party_members (with citizenship, district, ward fields), party_committees (hierarchy structure), constituencies (Nepal's electoral constituencies), and basic settings table."

### **Prompt 4: Template Applicator Service**
"Generate a TemplateApplicator service that can: 1) Take a template ID and tenant slug, 2) Create a new database, 3) Apply template SQL, 4) Seed initial data, 5) Handle errors and rollback."

## **EXECUTION ORDER:**

1. ✅ Complete TenantRole.php edit
2. ✅ Test RBAC seeder  
3. 🔄 Generate landlord template schema (NEXT)
4. 🔄 Create RBAC as template module
5. 🔄 Build political party template
6. 🔄 Integrate with approval process

## **ACTION ITEMS FOR YOU (Human):**

After Claude completes the TenantRole.php edit:

```bash
# 1. Check current tenant approval workflow
cd packages/laravel-backend
find . -name "*Tenant*Controller.php" -type f | head -5
find . -name "*Application*Controller.php" -type f | head -5

# 2. Look for database creation logic
grep -r "CREATE DATABASE" packages/laravel-backend/ --include="*.php"

# 3. Check current tenant table structure
php artisan tinker --execute="dd(\DB::getSchemaBuilder()->getColumnListing('tenants'));"
```

## **CLAUDE'S NEXT TASKS AFTER EDIT:**

1. **First:** Generate landlord template schema migrations
2. **Second:** Create RBAC as template module
3. **Third:** Help locate current approval workflow

**Proceed with the TenantRole.php edit now, then move to landlord schema generation.** 🚀
```

## **SUMMARY INSTRUCTIONS:**

1. **Approve the TenantRole.php edit** (Option 1)
2. **Then ask Claude to:** Generate landlord template schema
3. **While generating:** You can search for current approval workflow
4. **Goal:** Have template system ready to integrate by tomorrow

**This keeps us moving toward the template-based system while completing the RBAC foundation.**