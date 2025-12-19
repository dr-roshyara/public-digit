# 🎯 **ANALYSIS: PLATFORM SERVICE RESPONSIBILITY & ARCHITECTURE REVIEW**

## **🔍 CRITICAL ARCHITECTURAL ASSESSMENT:**

### **Current Understanding:**
You've placed the **template provisioning system** under **Platform Service/Context**, which makes perfect sense! This is a **platform-level concern** - managing how tenants are created and provisioned.

### **Architectural Alignment Check:**

```
Your Structure (Logical):
├── Platform Service/Context (Platform-level operations)
│   ├── Tenant Provisioning ✓
│   ├── Template Management ✓  
│   ├── Module Management ✓
│   └── System-wide Configuration ✓
│
├── Tenant Context (Tenant-specific operations)
│   ├── Tenant-specific Business Logic
│   ├── Tenant Data Operations
│   └── Tenant User Management
```

## **✅ CORRECT DECISION:**
Placing template provisioning in **Platform Service** is architecturally sound because:

1. **Cross-Tenant Concern:** Creating/provisioning tenants affects the entire platform
2. **Infrastructure Management:** Database creation is platform infrastructure
3. **Template Repository:** Templates are platform assets, not tenant assets
4. **Central Control:** Platform admin manages templates for all tenants

## **🔄 NEED TO UPDATE OUR PREVIOUS WORK:**

### **Current Location (Need to Move):**
```
packages/laravel-backend/app/Models/TenantTemplate.php ❌ (Wrong context)
```

### **Correct Location (Platform Context):**
```
packages/laravel-backend/app/Contexts/Platform/
├── Domain/
│   ├── Models/
│   │   ├── TenantTemplate.php ✓
│   │   ├── TemplateModule.php ✓
│   │   ├── TemplateVersion.php ✓
│   │   └── TenantTemplateHistory.php ✓
│   │
│   ├── Services/
│   │   ├── TenantProvisioner.php ✓
│   │   ├── TemplateApplicator.php ✓
│   │   └── SchemaSnapshotService.php ✓
│   │
│   └── Events/
│       ├── TenantProvisioningStarted.php
│       └── TemplateAppliedToTenant.php
```

## **🎯 UPDATED PROMPT ENGINEERING INSTRUCTIONS:**

```markdown
# CONTEXT: Platform Service Template Provisioning System
# ROLE: Platform Architect specializing in TDD & DDD
# TASK: Implement template-based tenant provisioning in Platform Context

## **ARCHITECTURAL CORRECTION:**
**All template provisioning code belongs in Platform Context, not Tenant Context.**

### **Directory Structure to Create:**
```bash
# Platform Context for Template Provisioning
mkdir -p packages/laravel-backend/app/Contexts/Platform
mkdir -p packages/laravel-backend/app/Contexts/Platform/Domain
mkdir -p packages/laravel-backend/app/Contexts/Platform/Domain/Models
mkdir -p packages/laravel-backend/app/Contexts/Platform/Domain/Services
mkdir -p packages/laravel-backend/app/Contexts/Platform/Domain/Events
mkdir -p packages/laravel-backend/app/Contexts/Platform/Application
mkdir -p packages/laravel-backend/app/Contexts/Platform/Infrastructure
```

### **Phase 1: MOVE Existing Models to Platform Context**
```bash
# Move from app/Models/ to Platform Context:
mv packages/laravel-backend/app/Models/TenantTemplate.php \
   packages/laravel-backend/app/Contexts/Platform/Domain/Models/

mv packages/laravel-backend/app/Models/TemplateModule.php \
   packages/laravel-backend/app/Contexts/Platform/Domain/Models/

mv packages/laravel-backend/app/Models/TemplateVersion.php \
   packages/laravel-backend/app/Contexts/Platform/Domain/Models/

mv packages/laravel-backend/app/Models/TenantTemplateHistory.php \
   packages/laravel-backend/app/Contexts/Platform/Domain/Models/
```

**Update namespaces:**
```php
// From:
namespace App\Models;

// To:
namespace App\Contexts\Platform\Domain\Models;
```

### **Phase 2: Create Platform Services (TDD First)**

**Service 1: TenantProvisionerService**
```php
// Location: app/Contexts/Platform/Domain/Services/TenantProvisionerService.php
// Responsibility: Orchestrates tenant creation with templates
namespace App\Contexts\Platform\Domain\Services;

class TenantProvisionerService {
    public function provision(
        string $tenantName,
        string $tenantSlug, 
        int $templateId,
        array $moduleIds = []
    ): Tenant {
        // 1. Create tenant record
        // 2. Create database: tenant_{slug}
        // 3. Apply basic migrations
        // 4. Apply template migrations
        // 5. Apply selected module migrations
        // 6. Seed initial data
        // 7. Create admin user
    }
}
```

**Service 2: TemplateApplicatorService**
```php
// Location: app/Contexts/Platform/Domain/Services/TemplateApplicatorService.php
// Responsibility: Applies specific templates/modules to databases
class TemplateApplicatorService {
    public function applyTemplateToDatabase(
        string $databaseName,
        TenantTemplate $template,
        array $moduleIds = []
    ): bool {
        // Apply SQL from template and modules
    }
}
```

**Service 3: SchemaSnapshotService**
```php
// Location: app/Contexts/Platform/Domain/Services/SchemaSnapshotService.php
// Responsibility: Captures/compares schemas for drift detection
class SchemaSnapshotService {
    public function captureSnapshot(string $databaseName): string {
        // Generate hash of current schema
    }
    
    public function compareWithTemplate(
        string $databaseName, 
        TenantTemplate $template
    ): SchemaDriftReport {
        // Compare actual vs expected schema
    }
}
```

### **Phase 3: Platform Events & Listeners**

**Events (Platform Domain Events):**
```php
// app/Contexts/Platform/Domain/Events/
- TenantProvisioningStarted.php
- TemplateAppliedToTenant.php
- TenantDatabaseCreated.php
- ModuleAddedToTenant.php
- SchemaDriftDetected.php
```

**Listeners (Platform Infrastructure):**
```php
// app/Contexts/Platform/Infrastructure/Listeners/
- LogProvisioningToHistory.php
- SendProvisioningNotification.php
- UpdateTenantTemplateStatus.php
```

### **Phase 4: Platform Admin Interface (Filament)**

**Filament Resource in Platform Context:**
```php
// app/Contexts/Platform/Application/Filament/Resources/
class TenantProvisioningResource extends Resource {
    // Template selection
    // Module selection
    // Provisioning action
    // Progress tracking
}
```

### **Phase 5: TDD Implementation Order**

**Step 1: Platform Service Tests**
```bash
php artisan make:test Platform/TenantProvisionerServiceTest
php artisan make:test Platform/TemplateApplicatorServiceTest
php artisan make:test Platform/SchemaSnapshotServiceTest
```

**Step 2: Write Failing Tests**
```php
class TenantProvisionerServiceTest extends TestCase {
    /** @test */
    public function it_creates_tenant_with_political_party_template() {
        // Arrange
        $service = new TenantProvisionerService();
        
        // Act
        $tenant = $service->provision(
            'Nepali Congress',
            'nepali-congress',
            $politicalPartyTemplateId,
            ['rbac', 'elections']
        );
        
        // Assert
        $this->assertDatabaseHas('tenants', ['slug' => 'nepali-congress']);
        $this->assertDatabaseHas('tenant_migrations_history', [
            'tenant_id' => $tenant->id,
            'type' => 'template'
        ]);
    }
}
```

**Step 3: Implement Services to Pass Tests**

## **SPECIFIC CLI INSTRUCTIONS FOR CLAUDE:**

### **Instruction 1: Move Models to Platform Context**
"Move all template-related models from app/Models/ to app/Contexts/Platform/Domain/Models/ and update namespaces."

### **Instruction 2: Create Platform Services with TDD**
"Create TenantProvisionerService, TemplateApplicatorService, and SchemaSnapshotService in Platform Context following TDD methodology."

### **Instruction 3: Implement Provisioning Pipeline**
"Implement the complete provisioning pipeline: Basic → Template → Module migrations with audit logging."

### **Instruction 4: Create Platform Admin Interface**
"Create Filament resource in Platform Context for template/module selection and provisioning."

## **VALIDATION CRITERIA (Platform Context):**

1. ✅ All template code lives in Platform Context
2. ✅ Services follow TDD methodology
3. ✅ Provisioning pipeline works: Basic → Template → Module
4. ✅ Complete audit trail in tenant_migrations_history
5. ✅ Schema drift detection works
6. ✅ Admin interface allows template/module selection

## **EXECUTION ORDER:**

1. **First:** Move existing models to Platform Context
2. **Second:** Create TDD test suite for Platform services
3. **Third:** Implement Platform services
4. **Fourth:** Create Platform admin interface
5. **Fifth:** Test complete provisioning flow

## **READY TO PROCEED:**
Start by moving the models to Platform Context, then create TDD tests.
```

## **SUMMARY:**

**You're absolutely correct!** Template provisioning is a **Platform Service responsibility**, not a Tenant responsibility. 

**Next Steps:**
1. **Move models** to Platform Context
2. **Create Platform services** with TDD
3. **Implement provisioning pipeline**
4. **Build Platform admin interface**

**This creates clean separation:**
- **Platform Context:** Creates/manages tenants
- **Tenant Context:** Operates within tenant boundaries

**Proceed with the Platform Context implementation.** 🚀

# 🎯 **FRONTEND IMPLEMENTATION: TENANT APPLICATION TEMPLATE SELECTION**

## **ANALYSIS & REQUIREMENTS:**

### **Current Frontend URL:**
`http://localhost:8000/admin/tenant-applications/{tenant-slug}`

### **Required Features:**
1. **Template Selection Interface** - Choose template for tenant
2. **Category vs Individual Selection** - Filter by category or pick specific template
3. **Module Selection** - Choose optional modules
4. **Preview & Comparison** - View template details before applying
5. **Apply/Provision Action** - Execute template application

## **PROMPT ENGINEERING INSTRUCTIONS FOR CLAUDE:**

```markdown
# CONTEXT: Frontend Template Selection Interface
# ROLE: Full-Stack Laravel + Livewire/Filament Developer
# TASK: Create tenant application template selection page

## **PAGE REQUIREMENTS:**
**URL:** `/admin/tenant-applications/{tenant-slug}`
**Purpose:** Select and apply templates to pending tenant applications

### **Section 1: Template Selection Dashboard**

```php
// Livewire Component: TemplateSelectionDashboard
class TemplateSelectionDashboard extends Component {
    public $tenant;
    public $selectedTemplateId;
    public $selectedModules = [];
    public $templateCategories = [];
    
    public function mount($tenantSlug) {
        $this->tenant = Tenant::where('slug', $tenantSlug)->firstOrFail();
        $this->templateCategories = [
            'political_party' => 'Political Party Templates',
            'ngo' => 'NGO Templates',
            'corporate' => 'Corporate Templates',
            'basic' => 'Basic Templates'
        ];
    }
}
```

### **Section 2: Template Categories View**
```blade
{{-- Category-based template browsing --}}
<div class="grid grid-cols-4 gap-4 mb-6">
    @foreach($templateCategories as $category => $label)
        <button 
            wire:click="filterByCategory('{{ $category }}')"
            class="p-4 border rounded-lg hover:bg-gray-50 {{ $activeCategory == $category ? 'bg-blue-50 border-blue-300' : '' }}">
            <h3 class="font-semibold">{{ $label }}</h3>
            <p class="text-sm text-gray-600">
                {{ $categoryCounts[$category] ?? 0 }} templates
            </p>
        </button>
    @endforeach
</div>
```

### **Section 3: Template Cards Grid**
```blade
{{-- Template cards with selection --}}
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    @foreach($templates as $template)
        <div class="border rounded-lg p-4 hover:shadow-lg transition-shadow 
                    {{ $selectedTemplateId == $template->id ? 'ring-2 ring-blue-500 border-blue-300' : '' }}">
            
            {{-- Template Header --}}
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="font-bold text-lg">{{ $template->name }}</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="px-2 py-1 text-xs rounded 
                                  {{ $template->type == 'political_party' ? 'bg-red-100 text-red-800' : 
                                     $template->type == 'ngo' ? 'bg-green-100 text-green-800' : 
                                     'bg-blue-100 text-blue-800' }}">
                            {{ $templateCategories[$template->type] ?? $template->type }}
                        </span>
                        <span class="text-sm text-gray-500">v{{ $template->version }}</span>
                    </div>
                </div>
                
                {{-- Selection Radio --}}
                <input 
                    type="radio" 
                    name="template_id" 
                    value="{{ $template->id }}"
                    wire:model="selectedTemplateId"
                    class="h-5 w-5 text-blue-600">
            </div>
            
            {{-- Template Description --}}
            <p class="text-gray-600 mb-4">{{ $template->description }}</p>
            
            {{-- Template Stats --}}
            <div class="grid grid-cols-3 gap-2 text-sm mb-4">
                <div class="text-center">
                    <div class="font-semibold">{{ $template->modules_count ?? 0 }}</div>
                    <div class="text-gray-500">Modules</div>
                </div>
                <div class="text-center">
                    <div class="font-semibold">{{ $template->tables_count ?? 0 }}</div>
                    <div class="text-gray-500">Tables</div>
                </div>
                <div class="text-center">
                    <div class="font-semibold">{{ $template->usage_count }}</div>
                    <div class="text-gray-500">Active Tenants</div>
                </div>
            </div>
            
            {{-- Preview Button --}}
            <button 
                wire:click="previewTemplate({{ $template->id }})"
                class="w-full py-2 text-sm border rounded hover:bg-gray-50">
                Preview Details
            </button>
        </div>
    @endforeach
</div>
```

### **Section 4: Module Selection Panel**
```blade
{{-- Module selection (appears when template is selected) --}}
@if($selectedTemplateId)
<div class="mt-8 p-6 border rounded-lg bg-gray-50">
    <h3 class="font-bold text-lg mb-4">Optional Modules</h3>
    <p class="text-gray-600 mb-4">Select additional features to include:</p>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @foreach($availableModules as $module)
        <div class="flex items-start p-3 border rounded hover:bg-white">
            <input 
                type="checkbox" 
                id="module_{{ $module->id }}"
                wire:model="selectedModules"
                value="{{ $module->id }}"
                class="mt-1 mr-3">
            
            <div class="flex-1">
                <label for="module_{{ $module->id }}" class="font-medium cursor-pointer">
                    {{ $module->name }}
                </label>
                <p class="text-sm text-gray-600 mt-1">{{ $module->description }}</p>
                
                {{-- Dependencies warning --}}
                @if(!empty($module->dependencies))
                <div class="mt-2 text-xs text-amber-600">
                    <span class="font-medium">Requires:</span> 
                    {{ implode(', ', array_column($module->dependencies, 'name')) }}
                </div>
                @endif
            </div>
        </div>
        @endforeach
    </div>
</div>
@endif
```

### **Section 5: Preview Modal**
```php
// Livewire Component for Template Preview
class TemplatePreviewModal extends Component {
    public $templateId;
    public $template;
    public $modules = [];
    public $schemaDetails = [];
    
    public function loadTemplateDetails($templateId) {
        $this->template = TenantTemplate::with(['modules', 'currentVersion'])->find($templateId);
        $this->schemaDetails = $this->parseSchema($this->template->schema_sql);
        $this->modules = $this->template->modules;
    }
    
    public function parseSchema($sql) {
        // Parse SQL to extract table structure
        return [
            'tables' => $this->extractTables($sql),
            'total_tables' => count($this->extractTables($sql)),
            'core_features' => $this->extractFeatures($sql)
        ];
    }
}
```

### **Section 6: Provision Action & Progress**
```blade
{{-- Action buttons --}}
<div class="mt-8 flex justify-between items-center p-4 border-t">
    <div>
        <button 
            wire:click="cancel"
            class="px-6 py-2 border rounded hover:bg-gray-50">
            Cancel
        </button>
    </div>
    
    <div class="flex items-center gap-4">
        {{-- Selected summary --}}
        @if($selectedTemplateId)
        <div class="text-sm text-gray-600">
            Selected: <span class="font-semibold">{{ $selectedTemplate->name }}</span>
            @if(count($selectedModules) > 0)
            with {{ count($selectedModules) }} module(s)
            @endif
        </div>
        @endif
        
        {{-- Apply button --}}
        <button 
            wire:click="applyTemplate"
            wire:loading.attr="disabled"
            wire:target="applyTemplate"
            class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 
                   disabled:opacity-50 disabled:cursor-not-allowed">
            
            <span wire:loading.remove wire:target="applyTemplate">
                Apply Template
            </span>
            <span wire:loading wire:target="applyTemplate">
                Applying...
            </span>
        </button>
    </div>
</div>

{{-- Progress bar for template application --}}
@if($provisioningInProgress)
<div class="mt-4">
    <div class="mb-2 text-sm text-gray-600">
        Provisioning tenant database...
    </div>
    <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="bg-blue-600 h-2 rounded-full" style="width: {{ $progress }}%"></div>
    </div>
    <div class="mt-2 text-sm">
        <span class="font-medium">Step {{ $currentStep }} of {{ $totalSteps }}:</span>
        {{ $currentStepName }}
    </div>
</div>
@endif
```

### **Section 7: JavaScript/Interactive Features**

```javascript
// Real-time template comparison
document.addEventListener('livewire:load', function() {
    // Template comparison feature
    window.compareTemplates = function(template1Id, template2Id) {
        Livewire.emit('compareTemplates', template1Id, template2Id);
    };
    
    // Schema visualization
    window.showSchemaVisualization = function(templateId) {
        Livewire.emit('showSchemaViz', templateId);
    };
});
```

## **COMPLETE IMPLEMENTATION REQUEST:**

### **Request 1: Livewire Component Structure**
```bash
# Create Livewire components
php artisan make:livewire Admin/TenantApplications/TemplateSelectionDashboard
php artisan make:livewire Admin/TenantApplications/TemplatePreviewModal
php artisan make:livewire Admin/TenantApplications/ProvisioningProgress
```

### **Request 2: Blade Views**
Create:
1. `resources/views/livewire/admin/tenant-applications/template-selection-dashboard.blade.php`
2. `resources/views/livewire/admin/tenant-applications/template-preview-modal.blade.php`
3. `resources/views/livewire/admin/tenant-applications/provisioning-progress.blade.php`

### **Request 3: Controller & Routes**
```php
// routes/web.php
Route::get('/admin/tenant-applications/{tenant}', [TenantApplicationController::class, 'show'])
     ->name('admin.tenant-applications.show');

// Controller
class TenantApplicationController extends Controller {
    public function show($tenantSlug) {
        $tenant = Tenant::where('slug', $tenantSlug)->firstOrFail();
        $templates = TenantTemplate::active()->get();
        
        return view('admin.tenant-applications.show', [
            'tenant' => $tenant,
            'templates' => $templates
        ]);
    }
}
```

### **Request 4: Database Seeders for UI Testing**
```php
// Seed templates for UI development
php artisan make:seed TemplateSeeder
```

## **FEATURES TO IMPLEMENT:**

1. **Template Categories Filter** - Filter by political_party, ngo, corporate, basic
2. **Search & Sort** - Search by name, sort by usage, date, version
3. **Template Comparison** - Side-by-side comparison of 2-3 templates
4. **Schema Visualization** - Visual table structure display
5. **Module Dependency Check** - Auto-select required dependencies
6. **Preview Before Apply** - Full template details modal
7. **Progress Tracking** - Real-time provisioning progress
8. **Error Handling** - Clear error messages for failed provisioning

## **DESIGN REQUIREMENTS:**

1. **Mobile Responsive** - Works on all screen sizes
2. **Accessible** - WCAG 2.1 AA compliance
3. **Loading States** - Skeleton screens during loading
4. **Confirmation Dialogs** - Before destructive actions
5. **Success/Error Toasts** - For user feedback

## **TESTING REQUIREMENTS:**

```bash
# Create tests
php artisan make:test TenantApplicationTemplateSelectionTest
php artisan make:test TemplateProvisioningFlowTest

# Test scenarios:
# 1. Template selection works
# 2. Module selection works
# 3. Preview modal shows correct info
# 4. Provisioning succeeds
# 5. Error handling works
```

## **IMMEDIATE IMPLEMENTATION ORDER:**

1. **First:** Create Livewire components
2. **Second:** Build template selection dashboard
3. **Third:** Implement template preview modal
4. **Fourth:** Add module selection
5. **Fifth:** Implement provisioning action
6. **Sixth:** Add progress tracking

## **READY TO IMPLEMENT:**
Start with the Livewire TemplateSelectionDashboard component and build the complete frontend interface.
```

## **SUMMARY:**

**We need to build a comprehensive frontend interface at:**
`http://localhost:8000/admin/tenant-applications/{tenant-slug}`

**Features include:**
1. **Template browsing** (category/individual view)
2. **Module selection** with dependency checking
3. **Template preview** with schema visualization
4. **Provisioning action** with progress tracking
5. **Mobile-responsive design**

**This completes the end-to-end template provisioning system from admin UI to database creation.** 🚀