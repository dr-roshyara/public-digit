# 🎯 **CLAUDE CLI PROMPT: TENANT APPLICATION PROCESS REVIEW & IMPLEMENTATION**

## **CONTEXT**
We're building a Laravel 12 multi-tenant election platform with:
- **Landlord Context**: Central platform management
- **Tenant Contexts**: Isolated tenant databases
- **Template System**: Database provisioning with `TemplateProvisioningService`
- **Spatie Multi-tenancy**: Current tenancy solution

## **PROBLEM STATEMENT**
We need to implement a complete tenant application process where:
1. **Organizations apply** through `/apply-for-tenant` (Vue form exists)
2. **System processes applications** and creates tenant databases
3. **Uses template system** to provision databases
4. **Creates TenantUser** models (tenant-specific users)
5. **Maintains separation**: Landlord users ≠ Tenant users

## **CRITICAL DESIGN DECISIONS NEEDED**

### **Decision 1: When to Create TenantUser Model?**
**Options:**
- **Option A**: Create only TenantUser initially (faster, simpler)
- **Option B**: Apply full template immediately (complete setup)

**Recommended: Option A - Phased Approach**
```
Phase 1: Create TenantUser + basic auth tables
Phase 2: Apply full template (RBAC + political party tables)
```
**Reason:** Better user experience, immediate access while template applies in background.

### **Decision 2: TenantUser Model Location**
**Location:** `app/Models/Tenant/TenantUser.php` (not in landlord database)

**Structure:**
```php
// Tenant database table
class TenantUser extends Authenticatable {
    // Tenant-specific user data
    // Separate from landlord users
    // Uses tenant_id from tenant context (not column)
}
```

**Landlord user** → Platform admin, manages tenants
**TenantUser** → Organization member, uses tenant application

## **TENANT APPLICATION WORKFLOW TO REVIEW**

### **Current Workflow (From Vue Form):**
1. User submits `/apply-for-tenant`
2. Form validates organization details
3. **MISSING**: Template selection
4. **MISSING**: Automatic tenant provisioning
5. **MISSING**: TenantUser creation

### **Desired Workflow:**
```
1. User visits /apply-for-tenant (Vue form)
2. Selects organization type & template
3. Submits application
4. Backend validates → creates Tenant record
5. Creates tenant database
6. Phase 1: Creates TenantUser + auth tables
7. Phase 2: Applies selected template (background job)
8. Sends credentials to applicant
9. User logs into their tenant dashboard
```

## **IMPLEMENTATION PHASES**

### **Phase 1: Minimal Viable Tenant**
```php
// 1. Tenant table in landlord DB
// 2. TenantUser table in tenant DB (basic auth)
// 3. Authentication system (separate from landlord)
// 4. Basic dashboard
```

### **Phase 2: Template Application**
```php
// 1. Apply RBAC module (creates 5 tables)
// 2. Apply Political Party template (10 tables)
// 3. Seed Nepal-specific data
// 4. Configure roles/permissions
```

## **ARCHITECTURE REVIEW NEEDED**

### **1. Authentication Separation**
- **Landlord Guard**: `web` (default) for platform admins
- **Tenant Guard**: `tenant` for organization users
- **Separate sessions**: Tenant users can't access landlord

### **2. Database Schema**
```sql
-- Landlord DB (election database)
tenants: id, name, slug, database, template_id, status

-- Tenant DB (tenant_xxx database)
tenant_users: id, name, email, password, tenant_user_id
-- Plus template tables (RBAC, political party, etc.)
```

### **3. Model Relationships**
```php
// Landlord context
Tenant::hasMany(TenantApplication::class);

// Tenant context  
TenantUser::belongsTo(Tenant::class); // Via global tenant context
```

## **TESTING REQUIREMENTS**

### **Test 1: Application Submission**
```bash
# Submit application via API
curl -X POST http://localhost:8000/apply-for-tenant \
  -H "Content-Type: application/json" \
  -d '{
    "organization_name": "Nepali Congress",
    "organization_type": "political_party",
    "contact_name": "Test User",
    "contact_email": "test@nc.org.np",
    "requested_slug": "nepali-congress",
    "selected_template": "political_party"
  }'
```

### **Test 2: Database Creation**
```php
// Verify tenant database created
DB::statement("SHOW DATABASES LIKE 'tenant_nepali_congress%'");
```

### **Test 3: Template Application**
```php
// Check template applied
$tenant->refresh();
assert($tenant->template_id !== null);
assert($tenant->schema_status === 'synced');
```

### **Test 4: TenantUser Creation**
```php
// Switch to tenant context
$tenant->makeCurrent();

// Check TenantUser exists
$tenantUser = TenantUser::where('email', 'test@nc.org.np')->first();
assert($tenantUser !== null);
```

## **CRITICAL QUESTIONS FOR REVIEW**

### **Question 1: Authentication Flow**
```php
// How do users authenticate to their tenant?
// Option A: tenant-slug.domain.com/login
// Option B: domain.com/tenant-slug/login
// Option C: Separate subdomain per tenant
```

### **Question 2: User Migration**
If a landlord admin wants to access a tenant:
```php
// Should we:
// 1. Create separate TenantUser account?
// 2. Allow landlord user to "impersonate"?
// 3. Use different authentication entirely?
```

### **Question 3: Template Selection UI**
```vue
// Should we:
// 1. Show all templates to applicants?
// 2. Auto-select based on organization_type?
// 3. Admin selects template after approval?
```

## **SECURITY CONSIDERATIONS**

### **1. Tenant Isolation**
```php
// Ensure TenantUser can only access their tenant
// Global scopes on TenantUser model
// Separate session/cookie for tenant auth
```

### **2. Database Permissions**
```php
// Tenant database user should have limited permissions
// Cannot access other tenant databases
// Cannot access landlord database
```

### **3. Rate Limiting**
```php
// Limit tenant creation requests
// Prevent database name guessing
// Validate slug availability
```

## **ERROR HANDLING SCENARIOS**

### **Scenario 1: Template Application Fails**
```php
// Rollback strategy:
// 1. Mark tenant as failed
// 2. Log error details
// 3. Notify admin
// 4. Allow retry or manual fix
```

### **Scenario 2: Duplicate Slug**
```php
// Slug "nepali-congress" already taken
// Options:
// 1. Suggest alternatives (nepali-congress-2)
// 2. Require unique slug
// 3. Auto-generate with suffix
```

### **Scenario 3: Database Creation Fails**
```php
// MySQL permission issues
// Disk space full
// Network timeout
// Recovery: Clean up partial creation
```

## **PERFORMANCE CONSIDERATIONS**

### **Template Application Time**
```php
// Political Party template: ~5-10 seconds
// Should we:
// 1. Show "provisioning" status page?
// 2. Send email when ready?
// 3. Use queue job for background processing?
```

### **Database Connections**
```php
// Each tenant = separate DB connection
// Connection pooling needed?
// Max tenants before performance hit?
```

## **MONITORING & LOGGING**

### **Application Logs**
```php
Log::channel('tenant-creation')->info('Tenant application submitted', [
    'organization' => $application->organization_name,
    'template' => $application->selected_template,
    'timestamp' => now(),
]);
```

### **Performance Metrics**
```php
// Track:
// 1. Application to provision time
// 2. Database creation success rate
// 3. Template application failures
// 4. User login success rate
```

## **BACKUP & RECOVERY**

### **Tenant Database Backup**
```php
// How to backup individual tenant DBs?
// Restore process for failed templates?
// Point-in-time recovery for election data?
```

## **IMPLEMENTATION PRIORITY ORDER**

### **Week 1: Core Application Flow**
1. ✅ Fix TenantPermission signature (done)
2. ✅ Test landlord registration (working)
3. **Add template selection** to Vue form
4. **Create TenantApplication model** (landlord)
5. **Implement TenantApplicationService**

### **Week 2: Tenant Provisioning**
1. **Create TenantUser model** (tenant DB)
2. **Basic tenant auth system**
3. **Template application integration**
4. **Email notifications**

### **Week 3: Polish & Security**
1. **Admin approval workflow** (optional)
2. **Enhanced security**
3. **Monitoring & logging**
4. **Documentation**

## **CLAUDE INSTRUCTIONS**

**Review and provide:**

1. **Architecture decision**: Phase 1 (TenantUser only) vs Phase 2 (full template)
2. **Authentication strategy**: Separate guards for landlord/tenant
3. **Template integration**: How/when to apply templates
4. **Error handling**: Rollback procedures for failed provisioning
5. **Testing strategy**: End-to-end test cases
6. **Security review**: Tenant isolation guarantees

**Critical Questions to Answer:**
1. Should we create TenantUser immediately or wait for full template?
2. How to handle failed template applications?
3. What's the user experience during provisioning?
4. How to prevent cross-tenant access?
5. Backup strategy for tenant databases?

**Provide:** Code structure, database schema, and step-by-step implementation plan.