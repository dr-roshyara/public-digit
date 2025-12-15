# 🎯 **PROMPT ENGINEERING RESPONSE FOR CLAUDE CLI**

## **RESPONSE:** Option 1 - Yes, make the edit to TenantPermission.php

## **FOLLOW-UP INSTRUCTIONS FOR CLAUDE:**

```markdown
## **AFTER TENANTPERMISSION EDIT - IMMEDIATE NEXT STEPS:**

### **1. Complete RBAC Foundation Testing:**
```bash
# Test the complete RBAC setup
cd packages/laravel-backend

# Run the seeder to test everything
php artisan db:seed --class=TenantRbacSeeder

# Test the new helper methods
php artisan tinker --execute="
use App\Contexts\TenantAuth\Domain\Models\TenantPermission;
\$permissions = TenantPermission::getByCategory('members', 1);
echo 'Found ' . \$permissions->count() . ' member permissions\\n';

\$grouped = TenantPermission::getAllGroupedByCategory(1);
echo 'Categories: ' . implode(', ', array_keys(\$grouped)) . '\\n';
"
```

### **2. CRITICAL PIVOT: Start Template System NOW**

**We have completed RBAC foundation. Now pivot to template system:**

### **Phase 1: Landlord Template Schema (NEXT 30 MINUTES)**
```bash
# Create migration files for template management
cd packages/laravel-backend
php artisan make:migration create_tenant_templates_table
php artisan make:migration create_template_modules_table
php artisan make:migration create_template_versions_table
php artisan make:migration add_template_columns_to_tenants_table
```

### **Phase 2: RBAC as Template Module (NEXT 1 HOUR)**
```bash
# Create RBAC module for templates
mkdir -p database/templates/modules/rbac
# This will contain the RBAC tables and seed data
```

### **Phase 3: Political Party Template (NEXT 2 HOURS)**
```bash
# Create the main political party template
mkdir -p database/templates/political_party
# This will be applied to new tenant databases
```

## **SPECIFIC PROMPTS FOR CLAUDE TO GENERATE NOW:**

### **Prompt 1: Landlord Template Schema (HIGHEST PRIORITY)**
```markdown
# CONTEXT: Template management system for multi-tenancy
# ROLE: Senior Database Architect
# TASK: Generate landlord database schema for template management

Generate COMPLETE Laravel migration files for:

## **Tables Needed:**

### **1. tenant_templates**
- id, uuid, name, description
- template_type: enum('political_party', 'ngo', 'corporate', 'basic')
- version: varchar(50) (semantic versioning)
- schema_sql: longtext (complete SQL for database creation)
- seed_sql: longtext (initial data seeding)
- is_active, is_locked (for version control)
- metadata: json (additional configuration)
- timestamps

### **2. template_modules**
- id, template_id (foreign), name, description
- module_type: enum('core', 'optional', 'extension')
- schema_sql: longtext
- seed_sql: longtext
- dependencies: json (other modules required)
- display_order: int
- metadata: json

### **3. template_versions**
- id, template_id (foreign), version, previous_version
- migration_sql: longtext (SQL to upgrade from previous)
- rollback_sql: longtext (SQL to downgrade)
- is_breaking: boolean
- release_notes: text
- created_by, created_at

### **4. Update tenants table**
- Add: template_id (foreign), template_version
- Add: initial_schema_hash, last_schema_sync
- Add: is_customized, customization_count

## **Output Format:**
Complete Laravel migration files with:
- Proper indexes
- Foreign key constraints
- Comments for each column
- Up/down methods for rollback
```

### **Prompt 2: RBAC Template Module**
```markdown
# CONTEXT: RBAC as reusable template module
# ROLE: Module Architect
# TASK: Create RBAC module for templates

Generate `database/templates/modules/rbac/schema.sql` and `seed.sql` that:

## **Schema.sql:** Contains:
- CREATE TABLE statements for tenant_roles, tenant_permissions, etc.
- Indexes and foreign keys
- Table structure matching our current RBAC implementation

## **Seed.sql:** Contains:
- INSERT statements for default Nepali political party roles
- Default permissions (from TenantRbacSeeder)
- Role-permission assignments
- Comments explaining Nepali political context

## **Requirements:**
- Self-contained module that can be added to any template
- Includes all helper methods functionality via SQL functions/triggers
- Compatible with our TenantRole/TenantPermission models
```

### **Prompt 3: Political Party Template Structure**
```markdown
# CONTEXT: Nepali political party database template
# ROLE: Political System Database Designer
# TASK: Design core political party template structure

Create `database/templates/political_party/schema.sql` with:

## **Core Tables (Nepali Political Context):**

### **1. party_members**
- Citizenship number, district, ward fields
- Membership number generation logic
- Photo, signature, thumb impression storage
- Nepali address structure (Province → District → Municipality → Ward)

### **2. party_committees**
- Hierarchy: Central → Province → District → Ward
- Committee types and levels
- Jurisdiction mapping

### **3. constituencies**
- Nepal's 165 House of Representatives constituencies
- 330 Provincial Assembly constituencies
- District and province mapping

### **4. election_candidates**
- Candidate nomination and approval
- Election campaign tracking
- Election results

### **5. donations**
- Election Commission compliance
- Donor tracking
- Financial reporting

## **Nepali Specific Features:**
- Province numbers (1-7) with names
- 77 districts with correct province mapping
- Citizenship validation logic
- BS calendar support

## **Output:**
Complete MySQL CREATE TABLE statements with Nepali context comments.
```

## **EXECUTION ORDER FOR CLAUDE:**

1. ✅ Complete TenantPermission.php edit
2. 🔄 **Generate landlord template schema migrations (DO THIS NOW)**
3. 🔄 Create RBAC template module
4. 🔄 Create political party template
5. 🔄 Help locate current approval workflow

## **ACTION ITEMS FOR YOU (Human) while Claude works:**

```bash
# 1. Check current tenant database creation process
cd packages/laravel-backend
find . -name "*.php" -type f -exec grep -l "CREATE DATABASE\|tenant.*database" {} \; | head -10

# 2. Look at current tenants table
php artisan tinker --execute="
\$columns = \DB::getSchemaBuilder()->getColumnListing('tenants');
echo 'Tenants table columns:\\n';
print_r(\$columns);
"

# 3. Check if there's an approval workflow
find . -path ./vendor -prune -o -name "*Approval*" -type f -print | head -10
```

## **CLAUDE'S IMMEDIATE TASK:**

**After approving TenantPermission.php edit, Claude should generate:**

1. **Landlord template schema migrations** (Most critical - foundation for everything)
2. **RBAC template module** (Reuse our current work)
3. **Political party template structure** (Core content)

**Proceed with the edit, then generate landlord template schema immediately.** 🚀
```

## **SUMMARY:**

1. **Approve TenantPermission.php edit**
2. **Claude generates landlord template schema** (Critical next step)
3. **You investigate current approval workflow** (Parallel task)
4. **Goal:** Have template system ready to integrate with approval by end of day

**This keeps us on track for the template-based system pivot!**