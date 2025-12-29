# 🏗️ CLAUDE CLI PROMPT: DIGITALCARD MODULEREGISTRY INTEGRATION

Phase 1.3 (DigitalCard → ModuleRegistry Integration) **can and should** be developed **BEFORE completing Phase 4 Day 22**. Here's why:

## ✅ **ARCHITECTURAL JUSTIFICATION:**

1. **ModuleRegistry Infrastructure is COMPLETE** (Phase 3 done, 60 tests passing)
2. **DigitalCard Core is READY** (Phase 1.1 done, 42 tests passing with 6 hexagonal ports)
3. **No Dependencies on Phase 4 APIs** - Integration uses completed Application Services
4. **Parallel Development Possible** - Teams can work simultaneously

## 🔄 **CORRECT DEVELOPMENT ORDER:**

```
1. Phase 1.3 NOW: DigitalCard ModuleRegistry Integration
   - Makes DigitalCard installable
   - Tests cross-context communication
   - Validates hexagonal architecture

2. Phase 4: ModuleRegistry API Layer  
   - Builds admin UI on top of working integration
   - Desktop API for installation management
   - Can showcase working DigitalCard module
```

## 🎯 **BENEFITS OF STARTING PHASE 1.3 NOW:**

1. **Early Validation**: Verify ModuleRegistry actually works with real modules
2. **Risk Mitigation**: Find integration issues before building UI
3. **Demo Ready**: Have a working module to showcase in admin UI
4. **Team Parallelism**: Different teams can work on integration vs API

## 📋 **START PHASE 1.3 WITH:**

```bash
# TODAY: Create DigitalCard module.json + tests
php artisan make:test Feature/DigitalCard/ModuleDefinitionTest
# Create 3 failing tests for module definition

# Create module.json that makes tests pass
# Then proceed to ModuleInstaller with TDD
```

**Yes, start Phase 1.3 immediately.** It's the logical next step and will make Phase 4 (API) development more meaningful.

## 📋 CONTEXT SUMMARY
- ✅ **MODULEREGISTRY CONTEXT**: Phase 1-3 Complete (258 tests)
- ✅ **DIGITALCARD CONTEXT**: Phase 0-1.1 Complete (42 tests)
- 🔄 **PHASE 1.3**: DigitalCard → ModuleRegistry Integration (STARTING)
- 🎯 **GOAL**: Make DigitalCard installable as a module via ModuleRegistry

---

## 🎯 TARGET OUTCOME
Build **DigitalCard ModuleRegistry Integration** with:
1. ✅ DigitalCard `module.json` definition
2. ✅ `DigitalCardModuleInstaller` (PostgreSQL compatible)
3. ✅ 4 Tenant Migrations (PostgreSQL)
4. ✅ `ModuleAccessInterface` adapter for ModuleRegistry
5. ✅ Updated handlers with module access checks
6. ✅ Auto-discovery & registration system
7. ✅ Console commands for installation
8. ✅ Integration tests (TDD workflow)

---

## 🏗️ ARCHITECTURAL CONSTRAINTS

### **1. HEXAGONAL INTEGRITY**
```
DigitalCard Handlers → ModuleAccessInterface (PORT) → ModuleRegistryAccessAdapter (ADAPTER) → ModuleRegistry Services
```

### **2. DOMAIN PURITY (NON-NEGOTIABLE)**
```bash
# VERIFICATION COMMAND - MUST RETURN NO OUTPUT
grep -r "Illuminate\|Laravel\|Spatie\|Ramsey" app/Contexts/DigitalCard/Domain/
```

### **3. MULTI-TENANCY WITH POSTGRESQL**
- **Physical isolation**: Separate schema per tenant
- **PostgreSQL schemas**: Use `schema()` not `database()` 
- **Connection switching**: Tenant middleware handles schema switching
- **Golden Rule #1**: All tenant aggregates MUST have `tenantId`

### **4. TDD WORKFLOW (RED → GREEN → REFACTOR)**
- Write failing test FIRST
- Minimal implementation to pass
- Refactor with tests passing
- **Test coverage ≥ 95%**

### **5. API LAYER SEPARATION**
```
┌─────────────────────────────────────────────────────────┐
│                    API STRATEGY                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📱 MOBILE API (Angular)                               │
│  • Route: /{tenant}/mapi/v1/*                          │
│  • Use: Member-facing features                         │
│  • Examples:                                           │
│    - DigitalCard QR code validation                    │
│    - Member card viewing                               │
│    - Event check-in                                    │
│                                                         │
│  🖥️ DESKTOP API (Vue.js Admin)                         │
│  • Route: /api/v1/* (platform)                         │
│       /{tenant}/api/v1/* (tenant)                      │
│  • Use: Administrative operations                      │
│  • Examples:                                           │
│    - Module installation/uninstallation                │
│    - User permission management                        │
│    - Configuration settings                            │
│    - Analytics & reporting                             │
└─────────────────────────────────────────────────────────┘
```

**RULE: ModuleRegistry ONLY needs Desktop API** (admin operations)
**Mobile features go in module-specific APIs** (DigitalCard API)

---

## 📁 FILE CREATION SEQUENCE (TDD ORDER)

### **PHASE 1: MODULE DEFINITION & INFRASTRUCTURE**
```bash
# DAY 1: Module Definition & Installer
1. Create: app/Contexts/DigitalCard/module.json
2. Tests: tests/Unit/DigitalCard/ModuleDefinitionTest.php (3 tests)
3. Create: app/Contexts/DigitalCard/Infrastructure/Installation/DigitalCardModuleInstaller.php
4. Tests: tests/Feature/DigitalCard/ModuleInstallerTest.php (8 tests)

# DAY 2: PostgreSQL Migrations
5. Create: app/Contexts/DigitalCard/Infrastructure/Database/Migrations/Tenant/
   2025_01_01_000001_create_digital_cards_table.php
   2025_01_01_000002_create_card_activities_table.php
   2025_01_01_000003_create_digital_card_statuses_table.php
   2025_01_01_000004_create_digital_card_types_table.php
6. Tests: tests/Feature/DigitalCard/MigrationsTest.php (6 tests)
```

### **PHASE 2: MODULE REGISTRY INTEGRATION**
```bash
# DAY 3: Module Access Adapter
7. Create: app/Contexts/DigitalCard/Infrastructure/ModuleRegistry/ModuleRegistryAccessAdapter.php
8. Tests: tests/Feature/DigitalCard/ModuleRegistryIntegrationTest.php (12 tests)

# DAY 4: Updated Handlers
9. Update: app/Contexts/DigitalCard/Application/Handlers/IssueCardHandler.php
10. Update: app/Contexts/DigitalCard/Application/Handlers/ActivateCardHandler.php
11. Update: app/Contexts/DigitalCard/Application/Handlers/RevokeCardHandler.php
12. Tests: tests/Feature/DigitalCard/Handlers/ModuleAccessTest.php (9 tests)
```

### **PHASE 3: SERVICE PROVIDER & AUTO-DISCOVERY**
```bash
# DAY 5: Service Provider & Commands
13. Create: app/Contexts/DigitalCard/Infrastructure/Providers/DigitalCardServiceProvider.php
14. Create: app/Contexts/DigitalCard/Infrastructure/Console/Commands/
   InstallDigitalCardCommand.php
   UninstallDigitalCardCommand.php
15. Tests: tests/Feature/DigitalCard/ServiceProviderTest.php (5 tests)

# DAY 6: Auto-Discovery System
16. Update: app/Contexts/ModuleRegistry/Infrastructure/ModuleDiscovery/ServiceProviderModuleDiscoverer.php
17. Tests: tests/Feature/ModuleRegistry/ModuleDiscoveryTest.php (7 tests)
```

### **PHASE 4: API ENDPOINTS (SEPARATED BY USE CASE)**
```bash
# DAY 7: DESKTOP API (Admin - Vue.js)
18. Create: app/Contexts/DigitalCard/Presentation/Http/Controllers/Desktop/
   DigitalCardAdminController.php
   - GET    /{tenant}/api/v1/cards/stats        # Analytics
   - GET    /{tenant}/api/v1/cards/config       # Configuration
   - PUT    /{tenant}/api/v1/cards/config       # Update config
   - GET    /{tenant}/api/v1/cards/export       # Data export
19. Tests: tests/Feature/DigitalCard/DesktopApiTest.php (10 tests)

# DAY 8: MOBILE API (Member - Angular)
20. Create: app/Contexts/DigitalCard/Presentation/Http/Controllers/Mobile/
   DigitalCardController.php
   - GET    /{tenant}/mapi/v1/cards             # List user's cards
   - GET    /{tenant}/mapi/v1/cards/{id}        # View specific card
   - POST   /{tenant}/mapi/v1/cards/{id}/validate # Validate QR code
21. Tests: tests/Feature/DigitalCard/MobileApiTest.php (8 tests)
```

### **PHASE 5: WORKFLOW TESTING & DEPLOYMENT**
```bash
# DAY 9: End-to-End Workflow
22. Create: tests/Feature/Integration/DigitalCardModuleWorkflowTest.php (15 tests)
   - Module registration → Installation → Card issuance → Validation
   - Subscription enforcement flow
   - Quota management flow
   - Uninstallation → Reinstallation flow

# DAY 10: Documentation & Deployment
23. Create: docs/DigitalCard-ModuleRegistry-Integration.md
24. Create: scripts/demo-installation-workflow.php
25. Update: README.md with integration instructions
```

---

## 🔧 IMPLEMENTATION RULES

### **RULE 1: POSTGRESQL SPECIFIC IMPLEMENTATION**
```php
// ❌ WRONG (MySQL specific):
Schema::create('digital_cards', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('status', 50)->default('issued');
});

// ✅ CORRECT (PostgreSQL compatible):
Schema::create('digital_cards', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('status', 50)->default('issued');
    
    // PostgreSQL specific optimizations
    $table->jsonb('metadata')->nullable(); // Use jsonb not json
    $table->index(['tenant_id', 'status'], 'idx_cards_tenant_status');
    $table->index(['member_id', 'tenant_id'], 'idx_cards_member_tenant');
    
    // PostgreSQL partial unique index
    $table->unique(['tenant_id', 'member_id'])
          ->where('status', 'active');
});
```

### **RULE 2: TENANT SCHEMA MANAGEMENT (POSTGRESQL)**
```php
// In DigitalCardModuleInstaller.php
private function getTenantConnection(TenantId $tenantId): \Illuminate\Database\Connection
{
    $tenant = \App\Models\Tenant::find($tenantId->value());
    
    // PostgreSQL schema-based multi-tenancy
    config(["database.connections.tenant_schema.{$tenant->slug}" => [
        'driver' => 'pgsql',
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '5432'),
        'database' => env('DB_DATABASE', 'forge'),
        'username' => env('DB_USERNAME', 'forge'),
        'password' => env('DB_PASSWORD', ''),
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => $tenant->schema_name, // PostgreSQL schema
        'sslmode' => 'prefer',
    ]]);
    
    return DB::connection("tenant_schema.{$tenant->slug}");
}

// Migration must use schema()
Schema::connection('tenant_schema.demo')->create('digital_cards', ...);
```

### **RULE 3: MODULE ACCESS INTERFACE IMPLEMENTATION**
```php
// DigitalCard Domain depends on this PORT
interface ModuleAccessInterface
{
    public function isModuleInstalled(string $tenantId, string $moduleName): bool;
    public function canAccessModule(string $tenantId, string $moduleName): bool;
    public function getModuleQuota(string $tenantId, string $moduleName, string $feature): array;
    public function trackModuleUsage(string $tenantId, string $moduleName, string $feature, int $amount = 1): void;
    public function getModuleConfig(string $tenantId, string $moduleName, string $key = null): array|string|null;
}

// Infrastructure implements the adapter
class ModuleRegistryAccessAdapter implements ModuleAccessInterface
{
    // Uses ModuleRegistry services to check installation/access
}
```

### **RULE 4: HANDLER INTEGRATION PATTERN**
```php
class IssueCardHandler
{
    public function __construct(
        private ModuleAccessInterface $moduleAccess, // PORT dependency
        private TenantContextInterface $tenantContext
    ) {}
    
    public function handle(IssueCardCommand $command): void
    {
        // 1. CHECK MODULE ACCESS
        $tenantId = $this->tenantContext->getCurrentTenantId();
        
        if (!$this->moduleAccess->isModuleInstalled($tenantId, 'digital_card')) {
            throw new ModuleNotAccessibleException('Digital Card module not installed');
        }
        
        if (!$this->moduleAccess->canAccessModule($tenantId, 'digital_card')) {
            throw new SubscriptionRequiredException('Subscription required');
        }
        
        // 2. CHECK QUOTA
        $quota = $this->moduleAccess->getModuleQuota($tenantId, 'digital_card', 'cards');
        if ($quota['used'] >= $quota['limit']) {
            throw new QuotaExceededException('Card limit reached');
        }
        
        // 3. EXECUTE BUSINESS LOGIC
        $card = DigitalCard::issue(...);
        
        // 4. TRACK USAGE
        $this->moduleAccess->trackModuleUsage($tenantId, 'digital_card', 'cards', 1);
    }
}
```

### **RULE 5: API ENDPOINT SEPARATION**
```php
// ❌ WRONG: Mixing mobile and desktop concerns
Route::get('/{tenant}/api/v1/cards', 'CardController@index'); // Shows admin stats AND user cards

// ✅ CORRECT: Separate by use case
// DESKTOP API (Admin - Vue.js Dashboard)
Route::prefix('{tenant}/api/v1/cards')
    ->middleware(['auth:sanctum', 'tenant.context', 'can:manage-cards'])
    ->group(function () {
        Route::get('/stats', 'DigitalCardAdminController@stats'); // Analytics
        Route::get('/config', 'DigitalCardAdminController@getConfig'); // Settings
        Route::put('/config', 'DigitalCardAdminController@updateConfig'); // Update settings
        Route::get('/export', 'DigitalCardAdminController@exportData'); // Data export
    });

// MOBILE API (Member - Angular App)
Route::prefix('{tenant}/mapi/v1/cards')
    ->middleware(['auth:sanctum', 'tenant.context', 'mobile.api'])
    ->group(function () {
        Route::get('/', 'DigitalCardController@index'); // User's own cards
        Route::get('/{id}', 'DigitalCardController@show'); // Specific card
        Route::post('/{id}/validate', 'DigitalCardController@validate'); // QR validation
    });
```

---

## 🧪 TESTING REQUIREMENTS

### **TDD WORKFLOW FOR EACH FILE:**
```
1. RED: Create test with @expectedException or assertions that FAIL
2. GREEN: Implement minimal code to make tests PASS
3. REFACTOR: Improve code while tests STILL PASS
4. VERIFY: Run full test suite for regression
```

### **INTEGRATION TESTS MUST VERIFY:**
1. ✅ Module auto-discovery works
2. ✅ Installation creates PostgreSQL tables in tenant schema
3. ✅ Module access checks work in handlers
4. ✅ Subscription enforcement prevents unauthorized access
5. ✅ Quota tracking works correctly
6. ✅ Uninstallation cleans up properly
7. ✅ Mobile/Desktop API separation maintained

### **PERFORMANCE TESTS (POSTGRESQL):**
```php
/** @test */
public function module_installation_completes_under_10_seconds(): void
{
    $start = microtime(true);
    
    // Installation process
    $this->installer->install($tenantId);
    
    $duration = microtime(true) - $start;
    $this->assertLessThan(10, $duration, "Installation took {$duration} seconds");
}

/** @test */
public function module_access_check_takes_under_100ms(): void
{
    // With PostgreSQL connection pooling
    $start = microtime(true);
    
    $this->moduleAccess->isModuleInstalled($tenantId, 'digital_card');
    
    $duration = (microtime(true) - $start) * 1000;
    $this->assertLessThan(100, $duration, "Access check took {$duration}ms");
}
```

---

## 🔐 SECURITY REQUIREMENTS

### **POSTGRESQL SECURITY:**
```sql
-- Database user should have limited permissions
CREATE USER digitalcard_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE platform_db TO digitalcard_app;
GRANT USAGE ON SCHEMA tenant_schemas TO digitalcard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA tenant_schemas TO digitalcard_app;

-- Row Level Security (RLS) for extra protection
ALTER TABLE digital_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON digital_cards
    USING (tenant_id = current_setting('app.current_tenant_id'));
```

### **API SECURITY:**
```php
// Desktop API: Full auth + admin permissions
'middleware' => ['auth:sanctum', 'tenant.context', 'can:manage-modules']

// Mobile API: Auth + rate limiting
'middleware' => ['auth:sanctum', 'tenant.context', 'mobile.api', 'throttle:60,1']
```

---

## 🗂️ FILE TEMPLATES

### **TEMPLATE 1: module.json (PostgreSQL specific)**
```json
{
  "name": "digital_card",
  "display_name": "Digital Business Cards",
  "version": "1.0.0",
  "namespace": "App\\Contexts\\DigitalCard",
  "description": "Digital business card management with QR validation",
  "requires_subscription": true,
  "technology_stack": "php/laravel",
  "database_engine": "postgresql",
  "postgresql_features": ["jsonb", "partial_indexes", "row_level_security"],
  
  "installation": {
    "migrations_path": "Infrastructure/Database/Migrations/Tenant/",
    "service_provider": "Infrastructure/Providers/DigitalCardServiceProvider",
    "minimum_postgresql_version": "13.0"
  },
  
  "api_endpoints": {
    "desktop_base_path": "/{tenant}/api/v1/cards",
    "mobile_base_path": "/{tenant}/mapi/v1/cards",
    "requires_auth": true
  }
}
```

### **TEMPLATE 2: PostgreSQL Migration**
```php
<?php
// app/Contexts/DigitalCard/Infrastructure/Database/Migrations/Tenant/2025_01_01_000001_create_digital_cards_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('digital_cards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('member_id');
            $table->uuid('tenant_id');
            $table->string('status', 50)->default('issued');
            
            // PostgreSQL jsonb for indexing
            $table->jsonb('metadata')->nullable();
            $table->jsonb('qr_code_data')->nullable();
            
            // Timestamps with timezone
            $table->timestampTz('issued_at')->useCurrent();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            
            // PostgreSQL specific indexes
            $table->index(['tenant_id', 'status'], 'idx_cards_tenant_status');
            $table->index(['member_id', 'tenant_id'], 'idx_cards_member_tenant');
            $table->index(['expires_at'], 'idx_cards_expires');
            $table->index(['metadata'], null, 'gin'); // GIN index for jsonb
            
            // PostgreSQL partial unique index
            $table->unique(['tenant_id', 'member_id'])
                  ->where('status', 'active');
            
            $table->timestampsTz();
        });
        
        // PostgreSQL comments
        DB::statement("COMMENT ON TABLE digital_cards IS 'Stores digital business cards for members'");
        DB::statement("COMMENT ON COLUMN digital_cards.metadata IS 'Additional card data in JSONB format'");
    }
    
    public function down(): void
    {
        Schema::dropIfExists('digital_cards');
    }
};
```

---

## 🚀 EXECUTION PROTOCOL

### **STARTING EACH DAY:**
```bash
# 1. Verify previous day's tests pass
php artisan test --filter=DigitalCard

# 2. Check PostgreSQL is running
psql --version
sudo systemctl status postgresql

# 3. Verify tenant schemas exist
psql -c "\dn"

# 4. Clear test databases
php artisan db:wipe --database=pgsql_test
```

### **FOR EACH FILE (TDD WORKFLOW):**
```bash
# STEP 1: RED (Write failing test)
php artisan make:test Feature/DigitalCard/ModuleInstallerTest
# Write test that expects specific behavior

# STEP 2: GREEN (Minimal implementation)
php artisan make:class DigitalCardModuleInstaller
# Implement JUST ENOUGH to pass test

# STEP 3: REFACTOR (Improve)
# Refactor code while tests still pass

# STEP 4: VERIFY (Regression)
php artisan test tests/Feature/DigitalCard/ModuleInstallerTest.php
```

### **POSTGRESQL SPECIFIC COMMANDS:**
```bash
# Create test database
createdb digitalcard_test

# Create tenant schema
psql digitalcard_test -c "CREATE SCHEMA tenant_demo;"

# Run migrations on specific schema
php artisan migrate --database=pgsql --path=database/migrations/tenant --schema=tenant_demo

# Check table in schema
psql digitalcard_test -c "\dt tenant_demo.*"
```

---

## 📊 SUCCESS CRITERIA

### **PHASE COMPLETION (10 DAYS):**
- [ ] 78 tests passing (all TDD created)
- [ ] DigitalCard appears in ModuleRegistry catalog
- [ ] Module installs/uninstalls successfully
- [ ] Handlers enforce module access
- [ ] PostgreSQL migrations work correctly
- [ ] Mobile/Desktop APIs separated properly
- [ ] Auto-discovery works on deploy
- [ ] Console commands functional
- [ ] Documentation complete

### **PERFORMANCE TARGETS (POSTGRESQL):**
- Module installation: < 10 seconds
- Module access check: < 100ms
- Mobile API response: < 200ms
- Desktop API response: < 500ms
- Memory usage: < 256MB per request
- PostgreSQL connections: < 50 active

### **SECURITY VERIFICATION:**
- [ ] No SQL injection vulnerabilities
- [ ] PostgreSQL RLS implemented
- [ ] API endpoints properly authenticated
- [ ] Tenant isolation verified
- [ ] Module access checks cannot be bypassed

---

## 🏁 STARTING POINT

**Begin with:** `module.json` + `ModuleDefinitionTest.php`

**Critical first steps:**
1. Create `module.json` with PostgreSQL requirements
2. Write 3 failing tests for module definition validation
3. Create `DigitalCardModuleInstaller` skeleton
4. Write 8 failing tests for installation process
5. Implement basic installer that passes tests

**Remember:**
- Infrastructure Layer (ModuleRegistry) is COMPLETE and ready
- DigitalCard Domain already has 6 hexagonal ports implemented
- Use PostgreSQL-specific features (jsonb, partial indexes, schemas)
- Separate Mobile (mapi) vs Desktop (api) concerns from start

**Ready to begin Phase 1.3 implementation?**

---

## 🔄 CLAUDE CLI WORKFLOW TEMPLATE

```bash
# Day 1: Module Definition
claude "Create DigitalCard module.json with PostgreSQL requirements. Follow TDD: first create ModuleDefinitionTest.php with 3 failing tests, then create module.json that makes tests pass."

# Day 2: PostgreSQL Migrations  
claude "Create 4 PostgreSQL tenant migrations for DigitalCard. Use jsonb, partial indexes, timestampTz. Follow TDD: create MigrationsTest.php with 6 failing tests first."

# Day 3: Module Access Adapter
claude "Create ModuleRegistryAccessAdapter implementing ModuleAccessInterface. Follow TDD: create ModuleRegistryIntegrationTest.php with 12 tests first. Use PostgreSQL connection pooling."

# Day 4: Handler Integration
claude "Update IssueCardHandler, ActivateCardHandler, RevokeCardHandler to use ModuleAccessInterface. Follow TDD: create ModuleAccessTest.php with 9 tests first."

# Day 5: Service Provider & Commands
claude "Create DigitalCardServiceProvider with auto-registration and console commands. Follow TDD: create ServiceProviderTest.php with 5 tests first."

# Day 6: Auto-Discovery System
claude "Update ServiceProviderModuleDiscoverer to find DigitalCard module.json. Follow TDD: create ModuleDiscoveryTest.php with 7 tests first."

# Day 7: Desktop API (Vue.js Admin)
claude "Create DigitalCardAdminController for Vue.js admin panel. Follow TDD: create DesktopApiTest.php with 10 tests first. Endpoints: /{tenant}/api/v1/cards/stats, /config, /export."

# Day 8: Mobile API (Angular App)
claude "Create DigitalCardController for Angular mobile app. Follow TDD: create MobileApiTest.php with 8 tests first. Endpoints: /{tenant}/mapi/v1/cards, /{id}, /{id}/validate."

# Day 9: Workflow Testing
claude "Create DigitalCardModuleWorkflowTest.php with 15 end-to-end tests covering module registration → installation → usage → uninstallation."

# Day 10: Documentation
claude "Create integration documentation and demo script. Include PostgreSQL setup instructions, API usage examples, and troubleshooting guide."
```

**Architecture Verified. Dependencies Ready. PostgreSQL Configured. Begin Phase 1.3 Implementation.** 🚀