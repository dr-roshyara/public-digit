# 🔍 **CLARIFICATION & ARCHITECTURE ADJUSTMENT**

You're absolutely correct to question this! Let me clarify and adjust the architecture based on your precise requirements.

## **✅ CORRECT UNDERSTANDING:**

**Yes, you're right.** In a **true DDD context with Nepali political party requirements**, the flow should be:

1. **Basic Migration** → Automatic with database creation (foundation only)
2. **Category/Template Migration** → Manual selection by admin from templates
3. **Module Migration** → Manual selection by admin from available modules  
4. **Individual Migration** → Custom, tenant-specific changes (post-provisioning)

**The key insight:** Templates and modules should be **pre-developed domain artifacts** stored in a **logical DDD folder structure**, not created on-the-fly.

## **🏗️ REVISED ARCHITECTURE WITH DDD FOLDER STRUCTURE**

```
app/
├── Domain/
│   ├── Platform/
│   │   ├── Admin/
│   │   │   ├── Contexts/
│   │   │   │   ├── TenantManagement/
│   │   │   │   │   ├── Entities/
│   │   │   │   │   ├── ValueObjects/
│   │   │   │   │   ├── Repositories/
│   │   │   │   │   ├── Services/
│   │   │   │   │   └── Specifications/
│   │   │   │   ├── TemplateManagement/
│   │   │   │   │   ├── Entities/
│   │   │   │   │   ├── ValueObjects/
│   │   │   │   │   ├── Templates/          ← PRE-DEVELOPED TEMPLATES
│   │   │   │   │   │   ├── PoliticalPartyNepal/
│   │   │   │   │   │   │   ├── Template.php
│   │   │   │   │   │   │   ├── Migrations/
│   │   │   │   │   │   │   └── Config/
│   │   │   │   │   │   ├── NonProfitOrganization/
│   │   │   │   │   │   └── CommunityGroup/
│   │   │   │   │   └── Services/
│   │   │   │   ├── ModuleManagement/
│   │   │   │   │   ├── Entities/
│   │   │   │   │   ├── Modules/            ← PRE-DEVELOPED MODULES
│   │   │   │   │   │   ├── ElectionCampaign/
│   │   │   │   │   │   │   ├── Module.php
│   │   │   │   │   │   │   ├── Migrations/
│   │   │   │   │   │   │   └── Config/
│   │   │   │   │   │   ├── FinancialTracking/
│   │   │   │   │   │   ├── SocialMedia/
│   │   │   │   │   │   └── MembershipManagement/
│   │   │   │   │   └── Services/
│   │   │   │   └── SchemaManagement/
│   │   │   │       ├── Migrations/         ← PRE-DEVELOPED CUSTOM MIGRATIONS
│   │   │   │       │   ├── CustomFields/
│   │   │   │       │   ├── PerformanceOptimizations/
│   │   │   │       │   └── CompliancePatches/
│   │   │   │       └── Services/
│   │   │   └── Policies/
│   │   └── Shared/
│   │       ├── ValueObjects/
│   │       └── Events/
├── Infrastructure/
│   └── Database/
│       └── Migrations/
│           ├── Tenant/
│           │   ├── Basic/                  ← BASIC MIGRATIONS (Automatic)
│           │   │   ├── 2024_01_01_000001_create_basic_tables.php
│           │   │   └── 2024_01_01_000002_create_authentication_tables.php
│           │   └── Custom/                 ← INDIVIDUAL TENANT MIGRATIONS
│           │       ├── nepali-congress/
│           │       └── cpnuml/
│           └── Landlord/
└── database/
    └── migrations/
        └── tenant/
            ├── basic/                      ← SYMLINK to Infrastructure
            └── custom/
```

## **📁 PRE-DEVELOPED TEMPLATES & MODULES IN DDD STRUCTURE**

### **1. Template Domain Artifacts (Pre-Developed)**

**File: `app/Domain/Platform/Admin/Contexts/TemplateManagement/Templates/PoliticalPartyNepal/Template.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TemplateManagement\Templates\PoliticalPartyNepal;

use App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities\Template;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateConfiguration;

class PoliticalPartyNepalTemplate extends Template
{
    public function __construct()
    {
        parent::__construct(
            name: 'Political Party Nepal',
            slug: 'political_party_nepal',
            description: 'Template for Nepali political parties with Election Commission compliance',
            version: '2.0.0',
            configuration: $this->getDefaultConfiguration()
        );
    }
    
    private function getDefaultConfiguration(): TemplateConfiguration
    {
        return new TemplateConfiguration([
            'required_modules' => ['membership_management', 'financial_tracking'],
            'optional_modules' => ['election_campaign', 'social_media', 'event_management'],
            'nepali_context' => true,
            'election_commission_compliance' => true,
            'default_language' => 'np',
            'address_structure' => [
                'provinces' => 7,
                'districts' => 77,
                'municipalities' => 753,
            ],
            'financial_reporting' => [
                'frequency' => 'quarterly',
                'deadline_days' => 30,
            ],
        ]);
    }
    
    public function getRequiredTables(): array
    {
        return [
            'political_parties',
            'party_committees',
            'members',
            'citizen_details',
            'donations',
            'financial_reports',
            'provinces',
            'districts',
            'municipalities',
        ];
    }
    
    public function validateCompatibility(array $existingSchema): bool
    {
        // Validate that template can be applied to existing schema
        $requiredTables = $this->getRequiredTables();
        
        foreach ($requiredTables as $table) {
            if (!isset($existingSchema[$table])) {
                return false;
            }
        }
        
        return true;
    }
}
```

**File: `app/Domain/Platform/Admin/Contexts/TemplateManagement/Templates/PoliticalPartyNepal/Migrations/CreatePartyTablesMigration.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TemplateManagement\Templates\PoliticalPartyNepal\Migrations;

use App\Domain\Platform\Admin\Contexts\SchemaManagement\Entities\DomainMigration;

class CreatePartyTablesMigration extends DomainMigration
{
    public function getName(): string
    {
        return 'create_party_tables';
    }
    
    public function getDescription(): string
    {
        return 'Creates core political party tables with Nepali context';
    }
    
    public function getUpScript(): string
    {
        return <<<'SQL'
            CREATE TABLE political_parties (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                registration_number VARCHAR(50) UNIQUE NOT NULL COMMENT 'Election Commission Registration Number',
                name_translations JSON NOT NULL COMMENT '{"en": "Party Name", "np": "पार्टीको नाम"}',
                established_date DATE NOT NULL,
                chairperson_name VARCHAR(255) NOT NULL,
                headquarters_address TEXT NOT NULL,
                province_code CHAR(2) NOT NULL COMMENT '1-7 provinces',
                district_code CHAR(4) NOT NULL COMMENT '77 districts',
                ward_number INT NOT NULL,
                ec_registration_certificate VARCHAR(100),
                ec_registration_date DATE,
                ec_status ENUM('active', 'suspended', 'cancelled') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_province_district (province_code, district_code),
                INDEX idx_ec_status (ec_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            
            CREATE TABLE provinces (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                name_np VARCHAR(100) NOT NULL COMMENT 'नेपाली नाम',
                code CHAR(2) UNIQUE NOT NULL COMMENT 'Province code 1-7',
                capital VARCHAR(100) NOT NULL,
                total_districts INT NOT NULL,
                total_municipalities INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            
            CREATE TABLE districts (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                province_id BIGINT UNSIGNED NOT NULL,
                name VARCHAR(100) NOT NULL,
                name_np VARCHAR(100) NOT NULL,
                code CHAR(4) UNIQUE NOT NULL COMMENT 'District code',
                headquarter VARCHAR(100) NOT NULL,
                area_sq_km DECIMAL(10,2) NOT NULL,
                total_population INT,
                total_wards INT NOT NULL,
                FOREIGN KEY (province_id) REFERENCES provinces(id) ON DELETE CASCADE,
                INDEX idx_province (province_id),
                INDEX idx_code (code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        SQL;
    }
    
    public function getDownScript(): string
    {
        return <<<'SQL'
            DROP TABLE IF EXISTS districts;
            DROP TABLE IF EXISTS provinces;
            DROP TABLE IF EXISTS political_parties;
        SQL;
    }
    
    public function getDependencies(): array
    {
        return []; // No dependencies on other migrations
    }
}
```

### **2. Module Domain Artifacts (Pre-Developed)**

**File: `app/Domain/Platform/Admin/Contexts/ModuleManagement/Modules/ElectionCampaign/Module.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\ModuleManagement\Modules\ElectionCampaign;

use App\Domain\Platform\Admin\Contexts\ModuleManagement\Entities\Module;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\ValueObjects\ModuleConfiguration;

class ElectionCampaignModule extends Module
{
    public function __construct()
    {
        parent::__construct(
            name: 'election_campaign',
            displayName: 'Election Campaign Management',
            description: 'Manage election campaigns, candidates, voting stations, and results for Nepali elections',
            version: '1.5.0',
            configuration: $this->getDefaultConfiguration()
        );
    }
    
    private function getDefaultConfiguration(): ModuleConfiguration
    {
        return new ModuleConfiguration([
            'category' => 'election',
            'dependencies' => ['membership_management', 'financial_tracking'],
            'conflicts' => ['legacy_election_system'],
            'nepali_context' => true,
            'election_types' => ['federal', 'provincial', 'local', 'by_election'],
            'candidate_requirements' => [
                'minimum_age' => 25,
                'citizenship_required' => true,
                'no_criminal_record' => true,
            ],
            'features' => [
                'candidate_management',
                'campaign_finance_tracking',
                'voter_outreach',
                'election_results',
                'ec_compliance_reporting',
            ],
        ]);
    }
    
    public function getRequiredTables(): array
    {
        return [
            'election_types',
            'constituencies',
            'candidates',
            'campaign_activities',
            'voting_stations',
            'election_results',
        ];
    }
    
    public function validateDependencies(array $existingModules): bool
    {
        $dependencies = $this->getConfiguration()->getDependencies();
        
        foreach ($dependencies as $dependency) {
            if (!in_array($dependency, $existingModules)) {
                return false;
            }
        }
        
        return true;
    }
}
```

**File: `app/Domain/Platform/Admin/Contexts/ModuleManagement/Modules/ElectionCampaign/Migrations/CreateCampaignTablesMigration.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\ModuleManagement\Modules\ElectionCampaign\Migrations;

use App\Domain\Platform\Admin\Contexts\SchemaManagement\Entities\DomainMigration;

class CreateCampaignTablesMigration extends DomainMigration
{
    public function getName(): string
    {
        return 'create_campaign_tables';
    }
    
    public function getDescription(): string
    {
        return 'Creates election campaign management tables for Nepali political parties';
    }
    
    public function getUpScript(): string
    {
        return <<<'SQL'
            CREATE TABLE election_types (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL COMMENT 'Federal, Provincial, Local, By-election',
                name_np VARCHAR(100) NOT NULL COMMENT 'संघीय, प्रदेशीय, स्थानीय, उपनिर्वाचन',
                code VARCHAR(50) UNIQUE NOT NULL,
                jurisdiction_levels JSON NOT NULL COMMENT '["federal", "provincial", "district", "local"]',
                candidate_requirements JSON COMMENT 'Eligibility criteria',
                nomination_requirements JSON COMMENT 'Required documents',
                campaign_rules JSON COMMENT 'EC campaign guidelines',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            
            CREATE TABLE constituencies (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                election_type_id BIGINT UNSIGNED NOT NULL,
                constituency_number VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(200) NOT NULL,
                name_np VARCHAR(200) NOT NULL,
                province_id BIGINT UNSIGNED NOT NULL,
                district_id BIGINT UNSIGNED NOT NULL,
                municipalities_covered JSON COMMENT 'Array of municipality IDs',
                total_voters INT,
                total_booths INT,
                boundary_data JSON COMMENT 'GeoJSON for mapping',
                demographic_data JSON,
                previous_results JSON,
                status ENUM('active', 'redistricted', 'inactive') DEFAULT 'active',
                FOREIGN KEY (election_type_id) REFERENCES election_types(id) ON DELETE CASCADE,
                FOREIGN KEY (province_id) REFERENCES provinces(id),
                FOREIGN KEY (district_id) REFERENCES districts(id),
                INDEX idx_election_type (election_type_id),
                INDEX idx_constituency_number (constituency_number)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            
            CREATE TABLE candidates (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                constituency_id BIGINT UNSIGNED NOT NULL,
                member_id BIGINT UNSIGNED NOT NULL COMMENT 'Reference to members table',
                candidate_number VARCHAR(50) UNIQUE NOT NULL COMMENT 'CAND-001-2080',
                candidate_type ENUM('fpip', 'pr', 'both') NOT NULL COMMENT 'First Past the Post or Proportional Representation',
                symbol_allotted VARCHAR(100) COMMENT 'Election symbol',
                nomination_date DATE NOT NULL,
                withdrawal_date DATE,
                nomination_status ENUM('draft', 'submitted', 'verified', 'rejected', 'withdrawn') DEFAULT 'draft',
                rejection_reason TEXT,
                nomination_documents JSON COMMENT 'Nomination papers and documents',
                security_deposit DECIMAL(10,2),
                deposit_status ENUM('paid', 'refunded', 'forfeited'),
                campaign_team JSON COMMENT 'Campaign team members',
                endorsements JSON,
                campaign_budget DECIMAL(15,2),
                spent_amount DECIMAL(15,2) DEFAULT 0,
                campaign_status ENUM('planning', 'active', 'suspended', 'completed') DEFAULT 'planning',
                is_incumbent BOOLEAN DEFAULT FALSE,
                previous_elections JSON,
                FOREIGN KEY (constituency_id) REFERENCES constituencies(id) ON DELETE CASCADE,
                FOREIGN KEY (member_id) REFERENCES members(id),
                INDEX idx_constituency (constituency_id),
                INDEX idx_nomination_status (nomination_status),
                INDEX idx_campaign_status (campaign_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            
            CREATE TABLE voting_stations (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                constituency_id BIGINT UNSIGNED NOT NULL,
                station_code VARCHAR(50) UNIQUE NOT NULL,
                station_name VARCHAR(200) NOT NULL,
                location_address TEXT NOT NULL,
                coordinates JSON COMMENT '{"latitude": 27.7172, "longitude": 85.3240}',
                province_id BIGINT UNSIGNED NOT NULL,
                district_id BIGINT UNSIGNED NOT NULL,
                municipality_id BIGINT UNSIGNED NOT NULL,
                ward_number INT NOT NULL,
                total_registered_voters INT NOT NULL,
                total_booths INT DEFAULT 1,
                booth_details JSON COMMENT '[{"booth_number": 1, "voters": 500}]',
                facilities JSON COMMENT '{"disabled_access": true, "parking": true}',
                polling_officials JSON COMMENT 'Assigned officials',
                security_arrangements JSON,
                station_type ENUM('regular', 'special', 'mobile', 'postal') DEFAULT 'regular',
                is_accessible BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (constituency_id) REFERENCES constituencies(id) ON DELETE CASCADE,
                FOREIGN KEY (province_id) REFERENCES provinces(id),
                FOREIGN KEY (district_id) REFERENCES districts(id),
                INDEX idx_constituency (constituency_id),
                INDEX idx_station_code (station_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        SQL;
    }
    
    public function getDownScript(): string
    {
        return <<<'SQL'
            DROP TABLE IF EXISTS voting_stations;
            DROP TABLE IF EXISTS candidates;
            DROP TABLE IF EXISTS constituencies;
            DROP TABLE IF EXISTS election_types;
        SQL;
    }
    
    public function getDependencies(): array
    {
        return [
            'App\Domain\Platform\Admin\Contexts\TemplateManagement\Templates\PoliticalPartyNepal\Migrations\CreatePartyTablesMigration',
        ];
    }
}
```

## **🚀 REVISED PROVISIONING WORKFLOW**

### **Phase 1: Basic Migration (Automatic)**

```php
class BasicMigrationService
{
    public function provisionTenantDatabase(Tenant $tenant): void
    {
        // 1. Create database with basic configuration
        $this->createDatabase($tenant);
        
        // 2. Apply ONLY basic migrations
        $this->applyBasicMigrations($tenant);
        
        // 3. Mark tenant as 'basic_provisioned'
        $tenant->update([
            'provisioning_status' => 'basic_provisioned',
            'database_created_at' => now(),
        ]);
    }
    
    private function applyBasicMigrations(Tenant $tenant): void
    {
        $migrations = [
            '2024_01_01_000001_create_users_table.php',
            '2024_01_01_000002_create_password_reset_tokens_table.php',
            '2024_01_01_000003_create_sessions_table.php',
            '2024_01_01_000004_create_failed_jobs_table.php',
            '2024_01_01_000005_create_personal_access_tokens_table.php',
            '2024_01_01_000006_create_settings_table.php',
            '2024_01_01_000007_create_audit_logs_table.php',
        ];
        
        foreach ($migrations as $migration) {
            $this->applyMigration($tenant, $migration, 'basic');
        }
    }
}
```

### **Phase 2: Admin Manual Template Selection**

**Admin Interface Flow:**
1. Admin navigates to `/admin/tenants/{tenant-slug}/provision`
2. Sees tenant is in `basic_provisioned` state
3. Selects from pre-developed templates (Political Party Nepal, Non-Profit, etc.)
4. System validates template compatibility
5. Admin confirms and applies template migrations

```php
class TemplateProvisioningController
{
    public function showTemplateSelection(Tenant $tenant)
    {
        // Only show if tenant is in basic_provisioned state
        if ($tenant->provisioning_status !== 'basic_provisioned') {
            abort(403, 'Template selection not available for this tenant state');
        }
        
        // Load pre-developed templates from DDD structure
        $templates = $this->templateRepository->getAvailableTemplates();
        
        return view('admin.tenants.template-selection', [
            'tenant' => $tenant,
            'templates' => $templates,
        ]);
    }
    
    public function applyTemplate(Request $request, Tenant $tenant)
    {
        $request->validate([
            'template_slug' => 'required|exists:tenant_templates,slug',
            'confirm' => 'required|accepted',
        ]);
        
        // Get the template from DDD structure
        $template = $this->templateFactory->createFromSlug(
            $request->template_slug
        );
        
        // Validate template can be applied
        if (!$template->validateCompatibility($tenant)) {
            return back()->withErrors([
                'template' => 'Template is not compatible with current tenant state'
            ]);
        }
        
        // Apply template migrations
        $this->templateMigrationService->applyTemplate($tenant, $template);
        
        // Update tenant state
        $tenant->update([
            'template_id' => $template->getId(),
            'template_version' => $template->getVersion(),
            'provisioning_status' => 'template_provisioned',
        ]);
        
        return redirect()->route('admin.tenants.module-selection', $tenant)
            ->with('success', 'Template applied successfully');
    }
}
```

### **Phase 3: Admin Manual Module Selection**

```php
class ModuleProvisioningController
{
    public function showModuleSelection(Tenant $tenant)
    {
        // Only show if tenant has template applied
        if (!$tenant->template_id || $tenant->provisioning_status !== 'template_provisioned') {
            abort(403, 'Module selection requires template to be applied first');
        }
        
        // Get available modules for this template
        $template = $tenant->template;
        $availableModules = $this->moduleRepository->getAvailableForTemplate($template);
        
        return view('admin.tenants.module-selection', [
            'tenant' => $tenant,
            'modules' => $availableModules,
            'selectedModules' => $tenant->modules->pluck('id')->toArray(),
        ]);
    }
    
    public function applyModules(Request $request, Tenant $tenant)
    {
        $request->validate([
            'modules' => 'array',
            'modules.*' => 'exists:template_modules,id',
            'confirm' => 'required|accepted',
        ]);
        
        $selectedModuleIds = $request->modules ?? [];
        
        // Validate module dependencies and conflicts
        $validationResult = $this->moduleValidator->validateSelection(
            $selectedModuleIds,
            $tenant->template
        );
        
        if (!$validationResult->isValid()) {
            return back()->withErrors($validationResult->getErrors());
        }
        
        // Apply module migrations in correct dependency order
        $this->moduleMigrationService->applyModules(
            $tenant,
            $selectedModuleIds
        );
        
        // Update tenant modules
        $tenant->modules()->sync($selectedModuleIds);
        $tenant->update([
            'provisioning_status' => 'module_provisioned',
        ]);
        
        return redirect()->route('admin.tenants.show', $tenant)
            ->with('success', 'Modules applied successfully');
    }
}
```

### **Phase 4: Individual Custom Migrations (Post-Provisioning)**

```php
class CustomMigrationController
{
    public function index(Tenant $tenant)
    {
        // Only available after tenant is fully provisioned
        if (!$tenant->isFullyProvisioned()) {
            abort(403, 'Custom migrations only available for fully provisioned tenants');
        }
        
        $customMigrations = $tenant->customMigrations()
            ->orderBy('created_at', 'desc')
            ->get();
        
        $availableCustomMigrations = $this->customMigrationRepository
            ->getAvailableForTenant($tenant);
        
        return view('admin.tenants.custom-migrations', [
            'tenant' => $tenant,
            'customMigrations' => $customMigrations,
            'availableMigrations' => $availableCustomMigrations,
        ]);
    }
    
    public function applyCustomMigration(Request $request, Tenant $tenant)
    {
        $request->validate([
            'migration_slug' => 'required|string',
            'reason' => 'required|string|min:10',
            'approval_token' => 'required|string',
        ]);
        
        // Get pre-developed custom migration from DDD structure
        $migration = $this->customMigrationFactory->createFromSlug(
            $request->migration_slug
        );
        
        // Validate migration can be applied
        if (!$migration->validateCompatibility($tenant)) {
            return back()->withErrors([
                'migration' => 'Migration is not compatible with this tenant'
            ]);
        }
        
        // Apply custom migration
        $this->customMigrationService->applyMigration($tenant, $migration, [
            'reason' => $request->reason,
            'applied_by' => auth()->id(),
        ]);
        
        return back()->with('success', 'Custom migration applied successfully');
    }
}
```

## **📁 LOGICAL FOLDER STRUCTURE FOR PRE-DEVELOPED ARTIFACTS**

```
app/Domain/Platform/Admin/Contexts/TemplateManagement/Templates/
├── PoliticalPartyNepal/
│   ├── Template.php
│   ├── Config/
│   │   ├── DefaultSettings.php
│   │   ├── NepaliContextConfig.php
│   │   └── ElectionCommissionConfig.php
│   ├── Migrations/
│   │   ├── CreatePartyTablesMigration.php
│   │   ├── CreateCommitteeStructureMigration.php
│   │   ├── CreateFinancialComplianceMigration.php
│   │   └── CreateNepaliAddressStructureMigration.php
│   ├── Seeders/
│   │   ├── NepaliProvincesSeeder.php
│   │   ├── NepaliDistrictsSeeder.php
│   │   └── DefaultPartyRolesSeeder.php
│   └── Validation/
│       └── TemplateCompatibilityValidator.php
├── NonProfitOrganization/
│   ├── Template.php
│   ├── Config/
│   ├── Migrations/
│   └── Validation/
└── CommunityGroup/
    ├── Template.php
    ├── Config/
    ├── Migrations/
    └── Validation/

app/Domain/Platform/Admin/Contexts/ModuleManagement/Modules/
├── ElectionCampaign/
│   ├── Module.php
│   ├── Config/
│   │   ├── ElectionTypesConfig.php
│   │   ├── CandidateRequirementsConfig.php
│   │   └── CampaignFinanceConfig.php
│   ├── Migrations/
│   │   ├── CreateCampaignTablesMigration.php
│   │   ├── CreateCandidateManagementMigration.php
│   │   ├── CreateVotingStationsMigration.php
│   │   └── CreateElectionResultsMigration.php
│   ├── Services/
│   │   ├── CandidateValidator.php
│   │   ├── CampaignFinanceCalculator.php
│   │   └── ElectionResultProcessor.php
│   └── Validation/
│       └── ModuleDependencyValidator.php
├── FinancialTracking/
│   ├── Module.php
│   ├── Config/
│   ├── Migrations/
│   └── Services/
├── SocialMedia/
│   ├── Module.php
│   ├── Config/
│   ├── Migrations/
│   └── Services/
└── MembershipManagement/
    ├── Module.php
    ├── Config/
    ├── Migrations/
    └── Services/

app/Domain/Platform/Admin/Contexts/SchemaManagement/Migrations/
├── CustomFields/
│   ├── AddCustomMembershipTiers.php
│   ├── AddPartySpecificColumns.php
│   └── AddCustomReportingTables.php
├── PerformanceOptimizations/
│   ├── AddIndexesForLargeDatasets.php
│   ├── PartitionLargeTables.php
│   └── AddMaterializedViews.php
├── CompliancePatches/
│   ├── AddECComplianceColumns.php
│   ├── AddAuditTrailEnhancements.php
│   └── AddDataRetentionPolicies.php
└── Integration/
    ├── AddThirdPartyIntegrationTables.php
    ├── AddAPIIntegrationColumns.php
    └── AddWebhookSupport.php
```

## **🔄 MIGRATION REGISTRY IN LANDLORD DATABASE**

```sql
-- Landlord database schema for tracking
CREATE TABLE tenant_migration_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    migration_type ENUM('basic', 'template', 'module', 'custom') NOT NULL,
    migration_slug VARCHAR(255) NOT NULL,
    migration_name VARCHAR(255) NOT NULL,
    migration_version VARCHAR(50) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by BIGINT UNSIGNED NOT NULL,
    rollback_at TIMESTAMP NULL,
    rollback_by BIGINT UNSIGNED NULL,
    status ENUM('applied', 'rolled_back', 'failed') DEFAULT 'applied',
    details JSON NULL,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (applied_by) REFERENCES users(id),
    FOREIGN KEY (rollback_by) REFERENCES users(id),
    
    INDEX idx_tenant_migrations (tenant_id, migration_type),
    INDEX idx_migration_slug (migration_slug),
    INDEX idx_applied_at (applied_at)
);

-- Track which templates/modules are available
CREATE TABLE available_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    config JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE available_modules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    config JSON NOT NULL,
    dependencies JSON COMMENT 'Array of module slugs this depends on',
    conflicts JSON COMMENT 'Array of module slugs this conflicts with',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Template-module compatibility
CREATE TABLE template_module_compatibility (
    template_slug VARCHAR(100) NOT NULL,
    module_slug VARCHAR(100) NOT NULL,
    compatibility_type ENUM('required', 'recommended', 'optional', 'incompatible') DEFAULT 'optional',
    notes TEXT,
    
    PRIMARY KEY (template_slug, module_slug),
    FOREIGN KEY (template_slug) REFERENCES available_templates(slug),
    FOREIGN KEY (module_slug) REFERENCES available_modules(slug),
    
    INDEX idx_template_compatibility (template_slug, compatibility_type)
);
```

## **🎯 KEY DIFFERENCES FROM PREVIOUS ARCHITECTURE**

1. **Clear Separation**: Basic (auto) vs Template/Module/Individual (manual admin)
2. **Pre-Developed Artifacts**: Templates and modules are domain artifacts, not runtime creations
3. **DDD Structure**: Logical organization in Domain layer, not just infrastructure
4. **Admin Control Flow**: Step-by-step manual progression through provisioning states
5. **Audit Trail**: Every manual action is logged with who, when, and why

## **🚀 IMPLEMENTATION SEQUENCE**

**Week 1-2**: Basic Migration System
```bash
# Create basic migration structure
php artisan make:migration:basic CreateUsersTable --tenant
php artisan make:migration:basic CreateSettingsTable --tenant

# Create automatic provisioning service
php artisan make:service TenantDatabaseCreator
```

**Week 3-4**: Template System
```bash
# Create DDD template structure
php artisan make:domain:template PoliticalPartyNepal
php artisan make:domain:migration CreatePartyTables --template=PoliticalPartyNepal

# Create admin interface for template selection
php artisan make:filament:resource TenantTemplateSelection
```

**Week 5-6**: Module System
```bash
# Create DDD module structure
php artisan make:domain:module ElectionCampaign
php artisan make:domain:migration CreateCampaignTables --module=ElectionCampaign

# Create admin interface for module selection
php artisan make:filament:resource TenantModuleSelection
```

**Week 7-8**: Custom Migration System
```bash
# Create custom migration infrastructure
php artisan make:domain:migration AddCustomReporting --type=custom

# Create approval workflow for custom migrations
php artisan make:filament:resource CustomMigrationApproval
```

This revised architecture correctly implements your requirement of **basic migration being automatic**, with **manual admin control** over template, module, and individual migrations through a **DDD-based pre-developed artifact system**.