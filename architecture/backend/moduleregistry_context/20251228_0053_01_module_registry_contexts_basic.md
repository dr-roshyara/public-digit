# **🔧 DigitalCard Module Installation & Migration System**

Now I understand! You need a **modular installation system** where after subscription, tenants can **install the DigitalCard module** into their tenant database. This is a **post-subscription module deployment** process.

## **🏗️ MODULE INSTALLATION ARCHITECTURE**

### **1. Module Registry System**
```
app/Contexts/ModuleRegistry/
├── Domain/
│   ├── Models/
│   │   ├── Module.php            # Module definition
│   │   ├── TenantModule.php      # Tenant's installed modules
│   │   └── ModuleInstallation.php # Installation tracking
│   └── Repositories/
│       └── ModuleRepositoryInterface.php
├── Application/
│   ├── Services/
│   │   ├── ModuleInstaller.php   # Installation orchestration
│   │   └── MigrationRunner.php   # Tenant-specific migrations
│   └── Commands/
│       ├── InstallModuleCommand.php
│       └── UninstallModuleCommand.php
└── Infrastructure/
    └── Database/
        └── Migrations/           # Module registry tables
```

### **2. Database Schema for Module Management**
```sql
-- 1. Platform Modules Catalog (landlord DB)
CREATE TABLE modules (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,      -- 'digital_card', 'elections', 'messaging'
    display_name VARCHAR(255) NOT NULL,     -- 'Digital Cards'
    version VARCHAR(20) NOT NULL,           -- '1.0.0'
    description TEXT,
    requires_subscription BOOLEAN DEFAULT true,
    installation_sql TEXT,                  -- Template SQL for tenant DB
    migrations_path VARCHAR(500),           -- Path to module migrations
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- 2. Tenant Installed Modules (landlord DB)
CREATE TABLE tenant_modules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    module_id UUID NOT NULL REFERENCES modules(id),
    version VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'installed', -- 'installed', 'pending', 'failed'
    installed_at TIMESTAMPTZ,
    installed_by UUID,                      -- Which admin installed it
    configuration JSONB DEFAULT '{}',       -- Tenant-specific config
    last_used_at TIMESTAMPTZ,
    UNIQUE(tenant_id, module_id)
);

-- 3. Tenant Module Migrations (tenant DB)
CREATE TABLE module_migrations (
    id UUID PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    migration VARCHAR(255) NOT NULL,
    batch INT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module, migration)
);
```

---

## **🚀 MODULE INSTALLATION PROCESS**

### **PHASE 1: MODULE CATALOG SETUP**

#### **1.1 Register DigitalCard Module**
```php
// app/Contexts/ModuleRegistry/Application/Services/ModuleRegistry.php

class ModuleRegistry
{
    private array $modules = [];
    
    public function __construct()
    {
        $this->registerCoreModules();
    }
    
    private function registerCoreModules(): void
    {
        $this->modules['digital_card'] = new Module(
            name: 'digital_card',
            displayName: 'Digital Cards',
            version: '1.0.0',
            description: 'Digital membership cards with QR codes and lifecycle management',
            requiresSubscription: true,
            migrationsPath: 'app/Contexts/DigitalCard/Infrastructure/Database/Migrations',
            installationSql: $this->getDigitalCardInstallationSql(),
            dependencies: [], // Could require other modules
            callbacks: [
                'post_install' => 'DigitalCard\\Installation\\PostInstall::run',
                'pre_uninstall' => 'DigitalCard\\Installation\\PreUninstall::run'
            ]
        );
    }
    
    private function getDigitalCardInstallationSql(): string
    {
        return <<<SQL
        -- DigitalCard Module Tables
        CREATE TABLE digital_cards (
            id UUID PRIMARY KEY,
            member_id UUID NOT NULL,
            tenant_id UUID NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'issued',
            qr_code TEXT,
            issued_at TIMESTAMPTZ NOT NULL,
            expires_at TIMESTAMPTZ,
            activated_at TIMESTAMPTZ,
            revoked_at TIMESTAMPTZ,
            revocation_reason TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE NULLS NOT DISTINCT (member_id, tenant_id) WHERE status = 'active'
        );
        
        CREATE INDEX idx_digital_cards_tenant ON digital_cards(tenant_id);
        CREATE INDEX idx_digital_cards_member ON digital_cards(member_id);
        CREATE INDEX idx_digital_cards_status ON digital_cards(status);
        
        -- Card Validations Audit Table
        CREATE TABLE card_validations (
            id UUID PRIMARY KEY,
            card_id UUID REFERENCES digital_cards(id),
            validated_at TIMESTAMPTZ NOT NULL,
            validation_type VARCHAR(50), -- 'online', 'offline', 'wallet'
            location JSONB,
            result VARCHAR(20), -- 'success', 'failure'
            details JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        SQL;
    }
}
```

### **PHASE 2: INSTALLATION SERVICE**

#### **2.1 ModuleInstaller Service**
```php
// app/Contexts/ModuleRegistry/Application/Services/ModuleInstaller.php

class ModuleInstaller
{
    public function __construct(
        private ConnectionInterface $landlordConnection,
        private ModuleRegistry $moduleRegistry,
        private MigrationRunner $migrationRunner,
        private EventDispatcherInterface $events
    ) {}
    
    /**
     * Install module for a specific tenant
     */
    public function install(string $tenantId, string $moduleName, string $installedBy = null): TenantModule
    {
        // 1. Validate module exists
        $module = $this->moduleRegistry->get($moduleName);
        
        // 2. Check if tenant has subscription for this module
        $this->ensureTenantCanInstall($tenantId, $module);
        
        // 3. Create installation record in landlord DB
        $tenantModule = $this->createInstallationRecord(
            tenantId: $tenantId,
            module: $module,
            installedBy: $installedBy
        );
        
        try {
            // 4. Connect to tenant database
            $tenantConnection = $this->getTenantConnection($tenantId);
            
            // 5. Run module-specific SQL
            if ($module->getInstallationSql()) {
                $tenantConnection->statement($module->getInstallationSql());
            }
            
            // 6. Run module migrations in tenant DB
            $this->migrationRunner->runForModule(
                connection: $tenantConnection,
                module: $module,
                tenantId: $tenantId
            );
            
            // 7. Run post-install hooks
            $this->runPostInstallHooks($module, $tenantId, $tenantConnection);
            
            // 8. Update installation status
            $tenantModule->markAsInstalled();
            $this->saveTenantModule($tenantModule);
            
            // 9. Dispatch event
            $this->events->dispatch(new ModuleInstalled(
                tenantId: $tenantId,
                module: $moduleName,
                version: $module->getVersion()
            ));
            
            return $tenantModule;
            
        } catch (\Exception $e) {
            // Mark as failed
            $tenantModule->markAsFailed($e->getMessage());
            $this->saveTenantModule($tenantModule);
            
            throw new ModuleInstallationException(
                "Failed to install module {$moduleName}: " . $e->getMessage(),
                0,
                $e
            );
        }
    }
    
    private function ensureTenantCanInstall(string $tenantId, Module $module): void
    {
        if ($module->requiresSubscription()) {
            // Check subscription via FeatureGateService
            if (!$this->featureGate->can($tenantId, $module->getName(), 'access')) {
                throw new SubscriptionRequiredException(
                    "Module {$module->getName()} requires subscription"
                );
            }
        }
        
        // Check if already installed
        if ($this->isModuleInstalled($tenantId, $module->getName())) {
            throw new ModuleAlreadyInstalledException(
                "Module {$module->getName()} is already installed"
            );
        }
    }
}
```

#### **2.2 Tenant-Specific Migration Runner**
```php
// app/Contexts/ModuleRegistry/Application/Services/MigrationRunner.php

class MigrationRunner
{
    public function runForModule(
        ConnectionInterface $connection,
        Module $module,
        string $tenantId
    ): void
    {
        $migrationsPath = $module->getMigrationsPath();
        
        if (!$migrationsPath || !file_exists($migrationsPath)) {
            return; // No migrations for this module
        }
        
        // Create module_migrations table if not exists
        $this->ensureMigrationTableExists($connection);
        
        // Get all migration files
        $migrationFiles = $this->getMigrationFiles($migrationsPath);
        $appliedMigrations = $this->getAppliedMigrations($connection, $module->getName());
        
        // Run new migrations
        foreach ($migrationFiles as $migrationFile) {
            $migrationName = $this->getMigrationName($migrationFile);
            
            if (!in_array($migrationName, $appliedMigrations)) {
                $this->runMigration($connection, $migrationFile, $module->getName());
                $this->recordMigration($connection, $module->getName(), $migrationName);
            }
        }
    }
    
    private function runMigration(ConnectionInterface $connection, string $file, string $module): void
    {
        // Load and run migration
        require_once $file;
        
        $className = $this->getMigrationClassName($file);
        $migration = new $className();
        
        $connection->transaction(function () use ($migration, $connection) {
            $migration->up($connection);
        });
    }
}
```

### **PHASE 3: TENANT MODULE MANAGEMENT API**

#### **3.1 Module Installation API**
```php
// app/Http/Controllers/Tenant/ModuleController.php

class ModuleController extends Controller
{
    public function __construct(
        private ModuleInstaller $moduleInstaller,
        private FeatureGateService $featureGate
    ) {}
    
    /**
     * Install a module for current tenant
     * POST /{tenant}/api/v1/modules/{module}/install
     */
    public function install(string $tenant, string $module): JsonResponse
    {
        // 1. Authorization check (tenant admin only)
        $this->authorize('install-modules', $tenant);
        
        // 2. Check subscription first
        $this->featureGate->ensureCan($tenant, $module, 'access');
        
        // 3. Install module
        $tenantModule = $this->moduleInstaller->install(
            tenantId: $tenant,
            moduleName: $module,
            installedBy: auth()->id()
        );
        
        return response()->json([
            'success' => true,
            'message' => "Module {$module} installed successfully",
            'module' => $tenantModule->toArray()
        ], 201);
    }
    
    /**
     * List available modules for tenant
     * GET /{tenant}/api/v1/modules
     */
    public function index(string $tenant): JsonResponse
    {
        $modules = $this->moduleInstaller->getAvailableModules($tenant);
        $installed = $this->moduleInstaller->getInstalledModules($tenant);
        
        return response()->json([
            'available' => $modules,
            'installed' => $installed
        ]);
    }
}
```

#### **3.2 Routes for Module Management**
```php
// routes/tenant-api.php

Route::prefix('{tenant}/api/v1')->middleware(['tenant', 'auth:api'])->group(function () {
    // Module Management
    Route::prefix('modules')->group(function () {
        Route::get('/', [ModuleController::class, 'index']);
        Route::post('/{module}/install', [ModuleController::class, 'install']);
        Route::post('/{module}/uninstall', [ModuleController::class, 'uninstall']);
        Route::get('/{module}/status', [ModuleController::class, 'status']);
        Route::post('/{module}/migrate', [ModuleController::class, 'migrate']);
    });
});
```

### **PHASE 4: MODULE INSTALLATION UI**

#### **4.1 Vue.js Module Marketplace Component**
```vue
<!-- resources/js/Pages/Tenant/Modules/Marketplace.vue -->
<template>
  <div class="module-marketplace">
    <h2>Available Modules</h2>
    
    <div class="modules-grid">
      <div v-for="module in availableModules" :key="module.name" class="module-card">
        <div class="module-header">
          <h3>{{ module.display_name }}</h3>
          <span class="version">v{{ module.version }}</span>
        </div>
        
        <p class="description">{{ module.description }}</p>
        
        <div class="module-features">
          <ul>
            <li v-for="feature in module.features" :key="feature">{{ feature }}</li>
          </ul>
        </div>
        
        <div class="module-actions">
          <div v-if="isInstalled(module.name)" class="installed-badge">
            ✅ Installed
          </div>
          <div v-else>
            <button 
              @click="installModule(module.name)"
              :disabled="!canInstall(module)"
              :class="{'requires-subscription': module.requires_subscription && !hasSubscription(module)}"
            >
              {{ module.requires_subscription ? 'Install (Requires Subscription)' : 'Install Free' }}
            </button>
            
            <div v-if="module.requires_subscription && !hasSubscription(module)" class="subscription-required">
              <a :href="route('subscription.upgrade', {tenant: tenant, module: module.name})">
                Upgrade Subscription
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/inertia-vue3'

const props = defineProps({
  tenant: String,
  availableModules: Array,
  installedModules: Array,
  tenantSubscription: Object
})

const isInstalled = (moduleName) => {
  return props.installedModules.some(m => m.name === moduleName)
}

const hasSubscription = (module) => {
  if (!module.requires_subscription) return true
  // Check if tenant has subscription for this module
  return props.tenantSubscription?.modules?.includes(module.name)
}

const canInstall = (module) => {
  return !isInstalled(module.name) && hasSubscription(module)
}

const installModule = async (moduleName) => {
  if (!confirm(`Install ${moduleName} module?`)) return
  
  try {
    const response = await axios.post(
      route('tenant.modules.install', { tenant: props.tenant, module: moduleName })
    )
    
    if (response.data.success) {
      window.location.reload()
    }
  } catch (error) {
    alert(error.response?.data?.message || 'Installation failed')
  }
}
</script>
```

---

## **🔐 SECURITY & VALIDATION**

### **1. Installation Validation Service**
```php
// app/Contexts/ModuleRegistry/Application/Services/InstallationValidator.php

class InstallationValidator
{
    public function validate(Module $module, string $tenantId): ValidationResult
    {
        $errors = [];
        
        // 1. Check disk space
        if (!$this->hasSufficientDiskSpace($tenantId)) {
            $errors[] = 'Insufficient disk space';
        }
        
        // 2. Check database compatibility
        if (!$this->checkDatabaseCompatibility($module)) {
            $errors[] = 'Database version incompatible';
        }
        
        // 3. Check dependencies
        $missingDeps = $this->checkDependencies($module, $tenantId);
        if (!empty($missingDeps)) {
            $errors[] = 'Missing dependencies: ' . implode(', ', $missingDeps);
        }
        
        // 4. Check tenant limits (max modules per tenant)
        if ($this->exceedsModuleLimit($tenantId)) {
            $errors[] = 'Module limit reached';
        }
        
        return new ValidationResult(
            isValid: empty($errors),
            errors: $errors,
            warnings: $this->getWarnings($module, $tenantId)
        );
    }
}
```

### **2. Module Uninstallation with Data Preservation**
```php
class ModuleUninstaller
{
    public function uninstall(string $tenantId, string $moduleName, bool $keepData = false): void
    {
        $module = $this->moduleRegistry->get($moduleName);
        $tenantModule = $this->getTenantModule($tenantId, $moduleName);
        
        // Run pre-uninstall hooks
        $this->runPreUninstallHooks($module, $tenantId);
        
        if (!$keepData) {
            // Drop module tables
            $this->dropModuleTables($tenantId, $module);
        } else {
            // Archive data before uninstallation
            $this->archiveModuleData($tenantId, $module);
        }
        
        // Remove installation record
        $this->removeInstallationRecord($tenantId, $moduleName);
        
        // Dispatch event
        $this->events->dispatch(new ModuleUninstalled(
            tenantId: $tenantId,
            module: $moduleName,
            keptData: $keepData
        ));
    }
}
```

---

## **🚀 QUICK START IMPLEMENTATION**

### **Step 1: Create Module Registry Tables**
```bash
php artisan make:migration create_module_registry_tables --context=ModuleRegistry
```

### **Step 2: Register DigitalCard Module**
```php
// In a service provider or module bootstrap
ModuleRegistry::register(new DigitalCardModule());
```

### **Step 3: Create Module Installation Command**
```bash
php artisan make:command InstallModule --context=ModuleRegistry
```

### **Step 4: Test Installation Flow**
```php
// tests/Feature/ModuleInstallationTest.php

public function test_tenant_can_install_digital_card_module()
{
    // Given: Tenant with subscription
    $tenant = Tenant::factory()->withSubscription('digital_card')->create();
    
    // When: Install module
    $response = $this->actingAs($tenant->admin())
        ->postJson("/{$tenant->id}/api/v1/modules/digital_card/install");
    
    // Then: Module should be installed
    $response->assertCreated();
    
    // Verify tables created in tenant DB
    $this->assertTenantHasTable($tenant, 'digital_cards');
    $this->assertTenantHasTable($tenant, 'card_validations');
    
    // Verify installation record
    $this->assertDatabaseHas('tenant_modules', [
        'tenant_id' => $tenant->id,
        'module' => 'digital_card',
        'status' => 'installed'
    ]);
}
```

### **Step 5: Create Module Migration Template**
```php
// app/Contexts/DigitalCard/Infrastructure/Database/Migrations/Tenant/
// 2024_01_01_000001_create_digital_card_tables.php

class CreateDigitalCardTables extends TenantMigration
{
    public function up()
    {
        Schema::create('digital_cards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('member_id');
            $table->uuid('tenant_id');
            $table->string('status', 50)->default('issued');
            // ... rest of schema
        });
    }
}
```

---

## **🎯 KEY FEATURES OF THIS APPROACH**

1. **Modular Architecture** - Each module is self-contained
2. **Tenant Isolation** - Modules installed per-tenant with separate migrations
3. **Subscription Gated** - Check subscription before installation
4. **Versioned Installations** - Track which version each tenant has
5. **Safe Uninstallation** - Option to keep or remove data
6. **Dependency Management** - Modules can require other modules
7. **Rollback Capability** - Uninstall if issues arise

## **📊 INSTALLATION WORKFLOW**

```
1. Tenant subscribes to DigitalCard module
2. Tenant admin visits Module Marketplace
3. Clicks "Install DigitalCard"
4. System validates subscription
5. Creates installation record
6. Connects to tenant database
7. Runs DigitalCard migrations
8. Creates required tables
9. Runs post-install hooks
10. Marks as installed
11. Tenant can now use DigitalCard API
```

This approach gives you **true SaaS modularity** where tenants can selectively install modules they've subscribed to, with each module maintaining its own database schema within the tenant's isolated database.