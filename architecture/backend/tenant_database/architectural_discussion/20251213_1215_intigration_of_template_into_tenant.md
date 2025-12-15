# 🎯 **CLAUDE CLI PROMPT: TEMPLATE INTEGRATION FOR EXISTING TENANT SYSTEM**

## **CONTEXT**
You have a **working multi-tenant system** with:
- ✅ **Landlord admin** with tenant management
- ✅ **Tenant databases** already created
- ✅ **TenantUser model/table** working in each tenant DB
- ✅ **Authentication** working for both landlord and tenants
- ✅ **Template system** developed (TemplateProvisioningService, models, SQL templates)
- ❌ **Missing**: Template application to existing tenants

## **CURRENT WORKFLOW**
```
1. Landlord admin creates tenant (database + TenantUser table)
2. Tenant admin logs into their tenant dashboard
3. Tenant requests features/templates from landlord admin
4. ❌ Landlord admin CANNOT apply templates yet
```

## **DESIRED WORKFLOW**
```
1. Landlord admin visits tenant admin page
2. Sees "Available Templates" section
3. Selects template (e.g., "Nepali Political Party")
4. Clicks "Apply Template" → provisions database
5. Tenant gets new tables + features
6. Tenant admin notified, can start using new features
```

## **EXISTING CODEBASE TO INTEGRATE**

### **Template System (Already Built):**
```php
// 1. Models
TenantTemplate.php          // Template definitions
TemplateModule.php          // Modular components  
TemplateVersion.php         // Version tracking
TenantTemplateHistory.php   // Audit trail

// 2. Service
TemplateProvisioningService.php  // applyTemplate(), updateTemplateVersion(), addModule()

// 3. SQL Templates
database/templates/
├── political_party/
│   ├── schema.sql          // 10 tables for Nepali parties
│   └── seed.sql
└── modules/
    └── rbac/
        ├── schema.sql      // 5 RBAC tables
        └── seed.sql        // 18 roles, 38 permissions
```

### **Missing Integration Points:**
1. **UI for template selection** in landlord admin
2. **Template application to existing tenants**
3. **Template status tracking** per tenant
4. **Communication workflow** between landlord ↔ tenant

## **IMPLEMENTATION REQUIREMENTS**

### **Phase 1: Landlord Admin Template Interface**
```php
// Route: GET /admin/tenants/{tenant}/templates
// Shows: Available templates for this tenant
// Action: "Apply Template" button
```

### **Phase 2: Template Application Backend**
```php
// Route: POST /admin/tenants/{tenant}/apply-template
// Uses: TemplateProvisioningService::applyTemplate()
// Validates: Tenant doesn't already have template
// Updates: tenant.template_id, tenant.template_version
```

### **Phase 3: Template Status & Management**
```php
// Tenant dashboard shows: "Template: Political Party (v1.0.0)"
// Landlord admin sees: Template history, applied modules
// Option to: Update template version, add modules
```

## **CRITICAL INTEGRATION POINTS**

### **1. Tenant Model Extension**
Your `Tenant` model needs template columns:
```php
// In landlord database migration
ALTER TABLE tenants ADD (
    template_id BIGINT UNSIGNED NULL,
    template_version VARCHAR(20) NULL,
    selected_modules JSON NULL,
    schema_status ENUM('none', 'synced', 'customized') DEFAULT 'none',
    initial_schema_hash VARCHAR(64) NULL,
    last_schema_sync TIMESTAMP NULL
);

// Foreign key
ALTER TABLE tenants ADD FOREIGN KEY (template_id) REFERENCES tenant_templates(id);
```

### **2. Template Selection UI Component**
```vue
<!-- resources/js/Components/Admin/TenantTemplateSelector.vue -->
<template>
  <div v-if="tenant.template_id">
    <h3>Current Template: {{ currentTemplate.name }}</h3>
    <p>Version: {{ tenant.template_version }}</p>
    <button @click="showTemplateManager">Manage Template</button>
  </div>
  <div v-else>
    <h3>Apply Template to Tenant</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="template in availableTemplates" 
           :key="template.id"
           class="template-card">
        <h4>{{ template.name }}</h4>
        <p>{{ template.description }}</p>
        <button @click="applyTemplate(template)">
          Apply to {{ tenant.name }}
        </button>
      </div>
    </div>
  </div>
</template>
```

### **3. Template Application Controller**
```php
// app/Http/Controllers/Admin/TenantTemplateController.php

namespace App\Http\Controllers\Admin;

use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use Illuminate\Http\Request;

class TenantTemplateController extends Controller
{
    public function index(Tenant $tenant)
    {
        // Get available templates
        $templates = TenantTemplate::active()->get();
        
        // Get current template if any
        $currentTemplate = $tenant->template;
        
        // Get template history
        $history = $tenant->templateHistory()->latest()->take(10)->get();
        
        return inertia('Admin/Tenants/Templates/Index', [
            'tenant' => $tenant,
            'templates' => $templates,
            'currentTemplate' => $currentTemplate,
            'history' => $history,
        ]);
    }
    
    public function applyTemplate(Request $request, Tenant $tenant)
    {
        $request->validate([
            'template_id' => 'required|exists:tenant_templates,id',
            'modules' => 'array',
            'modules.*' => 'exists:template_modules,id',
        ]);
        
        $template = TenantTemplate::findOrFail($request->template_id);
        
        // Check if tenant already has a template
        if ($tenant->template_id) {
            return back()->withErrors([
                'template' => 'Tenant already has a template applied. Use update instead.'
            ]);
        }
        
        // Apply template
        $service = new TemplateProvisioningService();
        
        try {
            $history = $service->applyTemplate(
                tenant: $tenant,
                template: $template,
                moduleIds: $request->modules ?? [],
                customizations: $request->customizations ?? []
            );
            
            return redirect()
                ->route('admin.tenants.templates.index', $tenant)
                ->with('success', "Template '{$template->name}' applied successfully!");
                
        } catch (\Exception $e) {
            return back()->withErrors([
                'template' => "Failed to apply template: " . $e->getMessage()
            ]);
        }
    }
    
    public function updateVersion(Tenant $tenant, Request $request)
    {
        // Update to new template version
    }
    
    public function addModule(Tenant $tenant, Request $request)
    {
        // Add module to existing template
    }
}
```

## **ROUTE DEFINITIONS**
```php
// routes/admin.php

Route::prefix('admin')->middleware(['web', 'auth', 'can:manage-tenants'])->group(function () {
    // Template management for tenants
    Route::prefix('tenants/{tenant}')->group(function () {
        Route::get('templates', [TenantTemplateController::class, 'index'])
            ->name('admin.tenants.templates.index');
            
        Route::post('templates/apply', [TenantTemplateController::class, 'applyTemplate'])
            ->name('admin.tenants.templates.apply');
            
        Route::post('templates/update-version', [TenantTemplateController::class, 'updateVersion'])
            ->name('admin.tenants.templates.update-version');
            
        Route::post('templates/add-module', [TenantTemplateController::class, 'addModule'])
            ->name('admin.tenants.templates.add-module');
    });
});
```

## **TEMPLATE CATALOG FOR NEPALI ORGANIZATIONS**

### **Template 1: Nepali Political Party**
```php
// Features:
// - 10 core tables (members, committees, elections, donations, etc.)
// - RBAC with 18 Nepali political roles
// - Nepal provinces/districts seed data
// - Election Commission compliance fields
// - Bilingual (Nepali/English) support
```

### **Template 2: Nepali NGO/Non-profit**
```php
// Features:
// - Project management
// - Donor tracking
// - Beneficiary management
// - Nepal-specific tax compliance
// - Localization for Nepali context
```

### **Template 3: International NGO (German/International)**
```php
// Features:
// - Multi-currency support (EUR, USD, NPR)
// - International donor reporting
// - Multi-language (English, German)
// - EU compliance standards
// - Global project tracking
```

### **Template 4: Cooperative/Saving Group**
```php
// Features:
// - Member savings tracking
// - Loan management
// - Share distribution
// - Nepal cooperative regulations
// - Financial reporting
```

## **INTEGRATION STEPS**

### **Step 1: Verify Template System Works**
```bash
# Test template application manually
php artisan tinker

$tenant = Tenant::first();
$template = TenantTemplate::where('slug', 'political_party')->first();
$service = new TemplateProvisioningService();
$history = $service->applyTemplate($tenant, $template);

echo $history->status; // Should be 'completed'
```

### **Step 2: Add Template Columns to Tenant Model**
```php
// Migration to add template fields to tenants table
// Run: php artisan make:migration add_template_columns_to_tenants_table
```

### **Step 3: Create Admin UI Components**
```vue
// 1. TenantTemplateSelector.vue
// 2. TemplateCard.vue
// 3. TemplateHistory.vue
```

### **Step 4: Implement Controller & Routes**
```php
// TenantTemplateController with all CRUD operations
```

### **Step 5: Add Template Status to Tenant Dashboard**
```vue
<!-- In tenant dashboard, show current template -->
<div v-if="tenant.template">
  <h3>Platform Features</h3>
  <p>Template: {{ tenant.template.name }} v{{ tenant.template_version }}</p>
  <ul>
    <li v-for="module in tenant.selected_modules" :key="module">
      {{ module.name }}
    </li>
  </ul>
</div>
```

## **TESTING SCENARIOS**

### **Test 1: Apply Political Party Template**
```php
// Given: Tenant "Nepali Congress" with only TenantUser table
// When: Landlord admin applies "Political Party" template
// Then: Tenant gets 15 new tables (5 RBAC + 10 political party)
// And: TenantUser can assign roles to members
// And: Election management features available
```

### **Test 2: Template Already Applied**
```php
// Given: Tenant already has "Political Party" template
// When: Landlord tries to apply another template
// Then: Show error "Template already applied"
// And: Offer "Update Version" or "Add Module" options
```

### **Test 3: Failed Template Application**
```php
// Given: Database permissions issue
// When: Template application fails
// Then: Rollback changes
// And: Log error in TenantTemplateHistory
// And: Notify landlord admin
```

## **ERROR HANDLING**

### **Database Connection Issues**
```php
try {
    $history = $service->applyTemplate($tenant, $template);
} catch (\Illuminate\Database\QueryException $e) {
    // Database-level errors
    Log::error('Template SQL error', ['error' => $e->getMessage()]);
    return response()->json(['error' => 'Database error during template application'], 500);
} catch (\RuntimeException $e) {
    // Business logic errors
    return response()->json(['error' => $e->getMessage()], 400);
}
```

### **Template Validation**
```php
// Before applying template:
// 1. Check tenant database exists
// 2. Check template is active
// 3. Check no existing template
// 4. Validate module dependencies
```

## **PERFORMANCE CONSIDERATIONS**

### **Template Application Time**
```php
// Political Party template: ~5-10 seconds
// Strategies:
// 1. Show loading spinner with progress
// 2. Use queue job for background processing
// 3. Email notification when complete
```

### **Large Tenant Databases**
```php
// If tenant already has data:
// 1. Backup before template application
// 2. Test on staging first
// 3. Provide rollback option
```

## **SECURITY CONSIDERATIONS**

### **Template SQL Validation**
```php
// Ensure template SQL is safe:
// 1. Templates created by trusted admins only
// 2. No DROP TABLE statements in templates
// 3. SQL injection prevention in template variables
```

### **Access Control**
```php
// Middleware to ensure:
// 1. Only landlord admins can apply templates
// 2. Tenant admins can only view template status
// 3. Regular users cannot access template management
```

## **MONITORING & AUDITING**

### **Template Application Logs**
```php
// Log every template operation:
Log::channel('template-provisioning')->info('Template applied', [
    'tenant_id' => $tenant->id,
    'template_id' => $template->id,
    'applied_by' => auth()->id(),
    'duration' => $history->getDuration(),
    'modules' => $request->modules ?? [],
]);
```

### **Schema Drift Detection**
```php
// After template application:
// Calculate schema hash
// Store in tenant.initial_schema_hash
// Future: Detect if tenant modified schema
```

## **DEPLOYMENT CHECKLIST**

### **Pre-deployment:**
1. [ ] Backup all tenant databases
2. [ ] Test template application on staging
3. [ ] Verify TenantTemplateHistory table exists
4. [ ] Load template seeders (political_party, etc.)

### **Deployment:**
1. [ ] Run migration for tenant template columns
2. [ ] Deploy new admin UI components
3. [ ] Add routes for template management
4. [ ] Update landlord admin navigation

### **Post-deployment:**
1. [ ] Test apply template on one tenant
2. [ ] Verify template history recorded
3. [ ] Test tenant dashboard shows template status
4. [ ] Document process for landlord admins

## **CLAUDE INSTRUCTIONS**

**Implement the following:**

1. **Migration**: Add template columns to `tenants` table
2. **Controller**: `TenantTemplateController` with apply/update methods
3. **Vue Components**: Template selector, status display, history view
4. **Routes**: Admin routes for template management
5. **Integration**: Connect existing `TemplateProvisioningService`

**Critical:**
- Use existing `TemplateProvisioningService` (don't rewrite)
- Maintain tenant isolation (each tenant gets own template instance)
- Handle errors gracefully with rollback
- Add comprehensive logging to `TenantTemplateHistory`
- Ensure backward compatibility (existing tenants without templates work)

**Provide:** Complete working code with tests and documentation.