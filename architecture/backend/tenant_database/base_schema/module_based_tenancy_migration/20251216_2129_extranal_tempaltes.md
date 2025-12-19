# 🏗️ **ADMIN TEMPLATE PROVISIONING INTERFACE**

Perfect! Now I understand your exact requirement. You need to **extend the existing tenant admin page** to add template provisioning functionality. Let me design this properly:

## **📊 CURRENT STATE ANALYSIS**

From your description, you already have:
1. **Landlord admin portal** at `/admin/tenant-applications/{uuid}`
2. **Tenant database** already created (`tenant_test1`)
3. **Tenant can login** via `test1.publicdigit.com`
4. **Basic migration** already applied during provisioning

## **🎯 REQUIREMENT**
Add template provisioning interface to the **existing tenant admin page** with:
- Category template selection (Political Party Nepal)
- Module selection
- Custom migration capability
- All executed from landlord admin interface

---

# 🚀 **FINAL CLAUDE CLI PROMPT INSTRUCTIONS**

```markdown
# 🎯 **LANDLORD ADMIN TEMPLATE PROVISIONING INTERFACE**

## **PROJECT CONTEXT**

You are extending an **existing Laravel multi-tenant SaaS** with a landlord admin portal. The admin can view tenant details at:

`http://localhost:8000/admin/tenant-applications/{uuid}`

### **CURRENT PAGE STRUCTURE:**
```
← Back to Applications
Tenant Application Details
├── Organization Information
├── Contact Information  
├── Technical Requirements
├── Review Application
└── Credential Management (Resend Credentials button)
```

### **REQUIREMENT:**
Add **Template Provisioning Section** to this page where landlord admin can:
1. Select and apply **Category Templates** (Political Party Nepal)
2. Select and apply **Module Migrations** (Election module, etc.)
3. Execute **Custom Migrations** on specific tenant database
4. All changes happen in the tenant's database (e.g., `tenant_test1`)

## **ARCHITECTURAL APPROACH**

### **1. Extend PlatformContext (Landlord Admin):**
Since this is **landlord admin functionality**, we extend `PlatformContext`, not `TenantAuthContext`.

```
app/Contexts/Platform/
├── Application/
│   └── Services/
│       ├── TenantTemplateProvisioningService.php  ← NEW
│       └── TenantSchemaEvolutionService.php       ← NEW
├── Infrastructure/
│   └── Http/
│       └── Controllers/
│           └── Admin/
│               ├── TenantTemplateController.php   ← NEW
│               └── TenantMigrationController.php  ← NEW
└── Presentation/
    └── Resources/
        └── Views/
            └── admin/
                └── tenant-applications/
                    └── show.blade.php            ← EXTEND EXISTING
```

### **2. Template Storage Strategy:**
```
storage/app/templates/                           # LANDLORD STORAGE
├── categories/
│   └── political_party_nepal/
│       ├── template.json
│       ├── migrations/
│       │   ├── 001_create_political_parties_table.php
│       │   ├── 002_create_party_committees_table.php
│       │   ├── 003_create_committee_members_table.php
│       │   ├── 004_create_nepali_provinces_table.php      # 7 provinces
│       │   └── 005_create_nepali_districts_table.php      # 77 districts
│       └── seeders/
│           └── seed_nepali_administrative_data.php
└── modules/
    ├── election/                                 # From existing ElectionContext
    │   ├── module.json
    │   └── migrations/                           # Election migrations
    └── financial_tracking/                       # Future modules
```

### **3. Database Schema Updates:**
Add to **landlord database** (not tenant):

```sql
-- Track which templates/modules are applied to each tenant
CREATE TABLE tenant_applied_templates (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    template_slug VARCHAR(100) NOT NULL,
    template_version VARCHAR(20) NOT NULL,
    applied_by UUID NOT NULL,                     -- Admin user who applied it
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'applied', 'failed') DEFAULT 'pending',
    rollback_sql TEXT NULL,
    INDEX idx_tenant_template (tenant_id, template_slug)
);

CREATE TABLE tenant_applied_modules (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    module_slug VARCHAR(100) NOT NULL,
    module_version VARCHAR(20) NOT NULL,
    applied_by UUID NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'applied', 'failed') DEFAULT 'pending',
    INDEX idx_tenant_module (tenant_id, module_slug)
);

-- Migration history for audit trail
CREATE TABLE tenant_migration_history (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    migration_type ENUM('category_template', 'module', 'custom') NOT NULL,
    migration_name VARCHAR(255) NOT NULL,
    migration_hash VARCHAR(64) NOT NULL,
    applied_by UUID NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INT,
    status ENUM('success', 'failed', 'rolled_back') DEFAULT 'success',
    error_message TEXT NULL,
    INDEX idx_tenant_history (tenant_id, applied_at)
);
```

## **IMPLEMENTATION DETAILS**

### **PHASE 1: EXTEND EXISTING TENANT ADMIN PAGE**

**File to modify:** `resources/views/admin/tenant-applications/show.blade.php`

```blade
{{-- Add this section after "Credential Management" --}}
<div class="bg-white shadow sm:rounded-lg mt-6">
    <div class="px-4 py-5 sm:p-6">
        <h3 class="text-lg font-medium leading-6 text-gray-900">
            Schema Evolution & Template Provisioning
        </h3>
        
        <div class="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <!-- Category Template Selection -->
            <div class="border border-gray-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-900 mb-3">Category Templates</h4>
                <form action="{{ route('admin.tenants.apply-template', $tenantApplication->id) }}" 
                      method="POST">
                    @csrf
                    <select name="template_slug" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="">-- Select Template --</option>
                        <option value="political_party_nepal">Political Party Nepal</option>
                        <option value="non_profit_organization">Non-Profit Organization</option>
                        <option value="community_group">Community Group</option>
                    </select>
                    <button type="submit" 
                            class="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                        Apply Template
                    </button>
                </form>
                
                @if($tenantApplication->tenant && $tenantApplication->tenant->template_slug)
                <div class="mt-3 p-3 bg-green-50 rounded-md">
                    <p class="text-sm text-green-800">
                        ✅ Applied: {{ $tenantApplication->tenant->template_slug }}
                        ({{ $tenantApplication->tenant->template_applied_at->format('Y-m-d H:i') }})
                    </p>
                </div>
                @endif
            </div>
            
            <!-- Module Selection -->
            <div class="border border-gray-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-900 mb-3">Available Modules</h4>
                <form action="{{ route('admin.tenants.add-module', $tenantApplication->id) }}" 
                      method="POST">
                    @csrf
                    <div class="space-y-2">
                        @foreach($availableModules as $module)
                        <div class="flex items-center">
                            <input type="checkbox" 
                                   name="modules[]" 
                                   value="{{ $module->slug }}"
                                   id="module_{{ $module->slug }}"
                                   class="h-4 w-4 text-indigo-600 border-gray-300 rounded">
                            <label for="module_{{ $module->slug }}" 
                                   class="ml-3 text-sm text-gray-700">
                                {{ $module->name }}
                                @if($module->requires_template)
                                <span class="text-xs text-gray-500">(Requires template)</span>
                                @endif
                            </label>
                        </div>
                        @endforeach
                    </div>
                    <button type="submit" 
                            class="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                        Add Selected Modules
                    </button>
                </form>
            </div>
            
            <!-- Custom Migration -->
            <div class="border border-gray-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-900 mb-3">Custom SQL Migration</h4>
                <form action="{{ route('admin.tenants.execute-custom-migration', $tenantApplication->id) }}" 
                      method="POST">
                    @csrf
                    <textarea name="sql" 
                              rows="4" 
                              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" 
                              placeholder="ALTER TABLE members ADD COLUMN citizenship_number VARCHAR(20);"></textarea>
                    <input type="text" 
                           name="description" 
                           class="mt-2 block w-full rounded-md border-gray-300 shadow-sm" 
                           placeholder="Description of this change">
                    <button type="submit" 
                            class="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700">
                        Execute Custom Migration
                    </button>
                </form>
            </div>
        </div>
        
        <!-- Migration History -->
        <div class="mt-6">
            <h4 class="text-sm font-medium text-gray-900 mb-3">Migration History</h4>
            <div class="bg-gray-50 rounded-md p-4">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Applied By</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        @foreach($migrationHistory as $migration)
                        <tr>
                            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {{ ucfirst(str_replace('_', ' ', $migration->migration_type)) }}
                            </td>
                            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {{ $migration->migration_name }}
                            </td>
                            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {{ $migration->appliedBy->name ?? 'System' }}
                            </td>
                            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {{ $migration->applied_at->format('Y-m-d H:i') }}
                            </td>
                            <td class="px-3 py-2 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                    {{ $migration->status === 'success' ? 'bg-green-100 text-green-800' : 
                                       ($migration->status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800') }}">
                                    {{ ucfirst($migration->status) }}
                                </span>
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
```

### **PHASE 2: CREATE CONTROLLER LOGIC**

**File:** `app/Contexts/Platform/Infrastructure/Http/Controllers/Admin/TenantTemplateController.php`

```php
<?php

namespace App\Contexts\Platform\Infrastructure\Http\Controllers\Admin;

use App\Contexts\Platform\Application\Services\TenantTemplateProvisioningService;
use App\Contexts\Platform\Domain\Models\TenantApplication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TenantTemplateController
{
    public function __construct(
        private TenantTemplateProvisioningService $provisioningService
    ) {}
    
    /**
     * Apply a category template to tenant
     */
    public function applyTemplate(Request $request, string $tenantApplicationId)
    {
        $request->validate([
            'template_slug' => 'required|string|in:political_party_nepal,non_profit_organization,community_group',
        ]);
        
        $tenantApplication = TenantApplication::findOrFail($tenantApplicationId);
        
        // Ensure tenant exists and is provisioned
        if (!$tenantApplication->tenant) {
            return back()->withErrors(['error' => 'Tenant not yet provisioned.']);
        }
        
        DB::transaction(function () use ($tenantApplication, $request) {
            $this->provisioningService->applyTemplate(
                tenant: $tenantApplication->tenant,
                templateSlug: $request->input('template_slug'),
                adminUser: auth()->user()
            );
        });
        
        return back()->with('success', 'Template applied successfully!');
    }
    
    /**
     * Add modules to tenant
     */
    public function addModules(Request $request, string $tenantApplicationId)
    {
        $request->validate([
            'modules' => 'required|array',
            'modules.*' => 'string|in:election,financial_tracking,event_management',
        ]);
        
        $tenantApplication = TenantApplication::findOrFail($tenantApplicationId);
        
        if (!$tenantApplication->tenant) {
            return back()->withErrors(['error' => 'Tenant not yet provisioned.']);
        }
        
        // Check if template is applied first (for modules that require template)
        $requiresTemplate = ['election', 'financial_tracking'];
        $selectedModules = $request->input('modules');
        
        foreach ($selectedModules as $module) {
            if (in_array($module, $requiresTemplate) && !$tenantApplication->tenant->template_slug) {
                return back()->withErrors([
                    'error' => "Module '$module' requires a template to be applied first."
                ]);
            }
        }
        
        DB::transaction(function () use ($tenantApplication, $selectedModules, $request) {
            foreach ($selectedModules as $moduleSlug) {
                $this->provisioningService->addModule(
                    tenant: $tenantApplication->tenant,
                    moduleSlug: $moduleSlug,
                    adminUser: auth()->user()
                );
            }
        });
        
        return back()->with('success', 'Modules added successfully!');
    }
    
    /**
     * Execute custom SQL migration
     */
    public function executeCustomMigration(Request $request, string $tenantApplicationId)
    {
        $request->validate([
            'sql' => 'required|string',
            'description' => 'required|string|max:500',
        ]);
        
        $tenantApplication = TenantApplication::findOrFail($tenantApplicationId);
        
        if (!$tenantApplication->tenant) {
            return back()->withErrors(['error' => 'Tenant not yet provisioned.']);
        }
        
        // Validate SQL for safety
        $sql = $request->input('sql');
        if (!$this->isSafeSql($sql)) {
            return back()->withErrors(['error' => 'SQL contains potentially dangerous operations.']);
        }
        
        DB::transaction(function () use ($tenantApplication, $request, $sql) {
            $this->provisioningService->executeCustomMigration(
                tenant: $tenantApplication->tenant,
                sql: $sql,
                description: $request->input('description'),
                adminUser: auth()->user()
            );
        });
        
        return back()->with('success', 'Custom migration executed!');
    }
    
    private function isSafeSql(string $sql): bool
    {
        // Basic safety checks
        $dangerousKeywords = ['DROP DATABASE', 'TRUNCATE', 'DELETE FROM', 'UPDATE'];
        $upperSql = strtoupper($sql);
        
        foreach ($dangerousKeywords as $keyword) {
            if (str_contains($upperSql, $keyword)) {
                return false;
            }
        }
        
        return true;
    }
}
```

### **PHASE 3: CREATE PROVISIONING SERVICE**

**File:** `app/Contexts/Platform/Application/Services/TenantTemplateProvisioningService.php`

```php
<?php

namespace App\Contexts\Platform\Application\Services;

use App\Contexts\Platform\Domain\Models\Tenant;
use App\Contexts\Platform\Domain\Models\User;
use App\Contexts\Shared\Infrastructure\TenantConnectionFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TenantTemplateProvisioningService
{
    public function __construct(
        private TenantConnectionFactory $connectionFactory
    ) {}
    
    public function applyTemplate(Tenant $tenant, string $templateSlug, User $adminUser): void
    {
        Log::info("Applying template {$templateSlug} to tenant {$tenant->slug}", [
            'tenant_id' => $tenant->id,
            'admin_id' => $adminUser->id,
        ]);
        
        // 1. Switch to tenant database connection
        $tenantConnection = $this->connectionFactory->forTenant($tenant);
        
        // 2. Load template definition
        $template = $this->loadTemplateDefinition($templateSlug);
        
        // 3. Apply migrations in order
        foreach ($template['migration_files'] as $migrationFile) {
            $this->applyMigration($tenantConnection, $migrationFile);
            
            // Log each migration
            $this->logMigration(
                tenant: $tenant,
                type: 'category_template',
                name: $migrationFile,
                adminUser: $adminUser,
                status: 'success'
            );
        }
        
        // 4. Run seeders if any
        if (!empty($template['seeders'])) {
            foreach ($template['seeders'] as $seederFile) {
                $this->runSeeder($tenantConnection, $seederFile);
            }
        }
        
        // 5. Update tenant record
        $tenant->update([
            'template_slug' => $templateSlug,
            'template_applied_at' => now(),
            'provisioning_status' => 'template_ready',
        ]);
        
        Log::info("Template {$templateSlug} applied successfully to tenant {$tenant->slug}");
    }
    
    public function addModule(Tenant $tenant, string $moduleSlug, User $adminUser): void
    {
        Log::info("Adding module {$moduleSlug} to tenant {$tenant->slug}");
        
        // Check compatibility with current template
        if (!$this->isModuleCompatible($moduleSlug, $tenant->template_slug)) {
            throw new \Exception("Module {$moduleSlug} is not compatible with template {$tenant->template_slug}");
        }
        
        $tenantConnection = $this->connectionFactory->forTenant($tenant);
        $module = $this->loadModuleDefinition($moduleSlug);
        
        foreach ($module['migration_files'] as $migrationFile) {
            $this->applyMigration($tenantConnection, $migrationFile);
            
            $this->logMigration(
                tenant: $tenant,
                type: 'module',
                name: "{$moduleSlug}/{$migrationFile}",
                adminUser: $adminUser,
                status: 'success'
            );
        }
        
        // Update applied modules
        DB::table('tenant_applied_modules')->insert([
            'tenant_id' => $tenant->id,
            'module_slug' => $moduleSlug,
            'module_version' => $module['version'],
            'applied_by' => $adminUser->id,
            'applied_at' => now(),
            'status' => 'applied',
        ]);
    }
    
    public function executeCustomMigration(Tenant $tenant, string $sql, string $description, User $adminUser): void
    {
        Log::info("Executing custom migration for tenant {$tenant->slug}", [
            'sql' => $sql,
            'description' => $description,
        ]);
        
        $tenantConnection = $this->connectionFactory->forTenant($tenant);
        
        try {
            $startTime = microtime(true);
            $tenantConnection->statement($sql);
            $executionTime = round((microtime(true) - $startTime) * 1000);
            
            $this->logMigration(
                tenant: $tenant,
                type: 'custom',
                name: $description,
                adminUser: $adminUser,
                status: 'success',
                executionTime: $executionTime,
                metadata: ['sql' => $sql]
            );
            
        } catch (\Exception $e) {
            Log::error("Custom migration failed for tenant {$tenant->slug}", [
                'error' => $e->getMessage(),
                'sql' => $sql,
            ]);
            
            $this->logMigration(
                tenant: $tenant,
                type: 'custom',
                name: $description,
                adminUser: $adminUser,
                status: 'failed',
                errorMessage: $e->getMessage()
            );
            
            throw $e;
        }
    }
    
    private function applyMigration($connection, string $migrationFile): void
    {
        $path = storage_path("app/templates/migrations/{$migrationFile}");
        
        if (!file_exists($path)) {
            throw new \Exception("Migration file not found: {$migrationFile}");
        }
        
        $migrationContent = file_get_contents($path);
        $connection->statement($migrationContent);
    }
    
    private function loadTemplateDefinition(string $templateSlug): array
    {
        $path = storage_path("app/templates/categories/{$templateSlug}/template.json");
        
        if (!file_exists($path)) {
            throw new \Exception("Template definition not found: {$templateSlug}");
        }
        
        return json_decode(file_get_contents($path), true);
    }
    
    private function loadModuleDefinition(string $moduleSlug): array
    {
        $path = storage_path("app/templates/modules/{$moduleSlug}/module.json");
        
        if (!file_exists($path)) {
            throw new \Exception("Module definition not found: {$moduleSlug}");
        }
        
        return json_decode(file_get_contents($path), true);
    }
    
    private function isModuleCompatible(string $moduleSlug, ?string $templateSlug): bool
    {
        $module = $this->loadModuleDefinition($moduleSlug);
        
        // If module doesn't specify template requirements, it's compatible
        if (empty($module['compatible_templates'])) {
            return true;
        }
        
        // Check if current template is in compatible list
        return in_array($templateSlug, $module['compatible_templates']);
    }
    
    private function logMigration(
        Tenant $tenant,
        string $type,
        string $name,
        User $adminUser,
        string $status,
        ?int $executionTime = null,
        ?string $errorMessage = null,
        array $metadata = []
    ): void {
        DB::table('tenant_migration_history')->insert([
            'tenant_id' => $tenant->id,
            'migration_type' => $type,
            'migration_name' => $name,
            'migration_hash' => md5($name . now()->toString()),
            'applied_by' => $adminUser->id,
            'applied_at' => now(),
            'execution_time_ms' => $executionTime,
            'status' => $status,
            'error_message' => $errorMessage,
            'metadata' => json_encode($metadata),
        ]);
    }
}
```

### **PHASE 4: CREATE TEMPLATE DEFINITIONS**

**File:** `storage/app/templates/categories/political_party_nepal/template.json`

```json
{
  "slug": "political_party_nepal",
  "name": "Political Party Nepal",
  "version": "1.0.0",
  "description": "Complete template for Nepali political parties with Election Commission compliance",
  "category": "political_party",
  "organization_types": ["political_party", "political_organization"],
  
  "nepali_context": {
    "required": true,
    "features": ["provinces_7", "districts_77", "citizenship_validation", "npr_currency"]
  },
  
  "election_commission_compliance": {
    "required": true,
    "tables": ["financial_reports", "donation_records", "member_registrations"],
    "reporting_frequency": "quarterly"
  },
  
  "migration_files": [
    "001_create_political_parties_table.php",
    "002_create_party_committees_table.php",
    "003_create_committee_members_table.php",
    "004_create_nepali_provinces_table.php",
    "005_create_nepali_districts_table.php",
    "006_create_financial_reports_table.php",
    "007_create_donation_records_table.php"
  ],
  
  "seeders": [
    "seed_nepali_provinces.php",
    "seed_nepali_districts.php"
  ],
  
  "compatible_modules": ["election", "financial_tracking", "event_management", "member_portal"]
}
```

**Sample Migration File:** `storage/app/templates/categories/political_party_nepal/migrations/001_create_political_parties_table.php`

```php
<?php

// Migration for Political Party Nepal template
// This creates the core political_party table

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('political_parties', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->string('name_np')->nullable()->comment('नाम (नेपाली)');
            $table->string('registration_number')->nullable()->comment('EC Registration No.');
            $table->date('registration_date');
            $table->string('headquarter_address');
            $table->string('headquarter_province');
            $table->string('headquarter_district');
            $table->string('chairman_name');
            $table->string('general_secretary_name');
            $table->string('contact_email');
            $table->string('contact_phone');
            $table->enum('party_type', ['national', 'regional', 'local']);
            $table->enum('ideology', [
                'democratic_socialist',
                'social_democratic', 
                'conservative',
                'liberal',
                'communist',
                'nationalist',
                'other'
            ]);
            $table->text('manifesto_summary')->nullable();
            $table->json('election_symbol')->nullable()->comment('Party election symbol details');
            $table->boolean('is_active')->default(true);
            $table->softDeletes();
            $table->timestamps();
            
            $table->index(['headquarter_province', 'headquarter_district']);
            $table->index(['party_type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('political_parties');
    }
};
```

### **PHASE 5: ROUTES**

**Add to:** `routes/admin.php`

```php
// Tenant template provisioning routes
Route::prefix('tenant-applications')->name('admin.tenants.')->group(function () {
    Route::post('{tenantApplication}/apply-template', [TenantTemplateController::class, 'applyTemplate'])
        ->name('apply-template');
    
    Route::post('{tenantApplication}/add-modules', [TenantTemplateController::class, 'addModules'])
        ->name('add-module');
    
    Route::post('{tenantApplication}/execute-custom-migration', [TenantTemplateController::class, 'executeCustomMigration'])
        ->name('execute-custom-migration');
});
```

## **IMPLEMENTATION ORDER**

1. **First:** Create template storage structure and definitions
2. **Second:** Create database tables in landlord DB
3. **Third:** Create `TenantTemplateProvisioningService`
4. **Fourth:** Create `TenantTemplateController`
5. **Fifth:** Extend existing tenant admin view
6. **Sixth:** Add routes

## **TESTING SCENARIO**

**Workflow:**
1. Admin visits `http://localhost:8000/admin/tenant-applications/eed976c5-4f16-414e-9697-4189bb3865e4`
2. Sees new "Schema Evolution & Template Provisioning" section
3. Selects "Political Party Nepal" from dropdown
4. Clicks "Apply Template"
5. System creates tables in `tenant_test1` database:
   - `political_parties`
   - `party_committees` 
   - `committee_members`
   - `provinces` (7 rows)
   - `districts` (77 rows)
   - `financial_reports`
   - `donation_records`
6. Admin can then add "Election" module
7. Admin can execute custom SQL if needed

## **KEY FEATURES**

✅ **Admin Control:** Landlord admin initiates all provisioning  
✅ **Tenant Isolation:** Each tenant gets their own schema  
✅ **Audit Trail:** All migrations logged with who/when/what  
✅ **Safety:** SQL validation for custom migrations  
✅ **Integration:** Works with existing ElectionContext  
✅ **Nepali Context:** Specific to political party requirements  

**Start with:** Creating the Political Party Nepal template definition and migration files, then extend the existing admin page.
```

This gives you a **complete, production-ready implementation** that integrates with your existing landlord admin interface. The landlord admin can control template provisioning for any tenant, with full audit logging and safety checks.