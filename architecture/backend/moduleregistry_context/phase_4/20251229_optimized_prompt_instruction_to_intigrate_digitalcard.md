# 🚀 OPTIMIZED DIGITALCARD → MODULEREGISTRY INTEGRATION PROTOCOL

## 🎯 SENIOR ARCHITECT'S EXECUTIVE SUMMARY

**Current Status:** DigitalCard Context has hexagonal foundation but needs ModuleRegistry integration
**Strategic Goal:** Transform DigitalCard into installable SaaS module with subscription enforcement
**Architectural Impact:** Minimal changes to existing DDD structure, maximum integration benefit

**Key Insight:** This is NOT rebuilding DigitalCard - it's ADDING module wrapper around existing functionality

---

## 🏗️ OPTIMIZED ARCHITECTURE DECISIONS

### **1. Zero Domain Changes**
```php
// DigitalCard Domain Layer REMAINS PURE
// NO changes to aggregates, value objects, domain services
// ONLY Infrastructure/Application layer additions
```

### **2. Dual-Layer Subscription Check**
```php
// Layer 1: ModuleRegistry Port (Already implemented)
$moduleAccess = app(ModuleAccessInterface::class);
$moduleAccess->canAccessModule($tenantId, 'digital_card');

// Layer 2: DigitalCard SubscriptionClient (NEW)
// Adds quota checking and action-specific permissions
```

### **3. Plugin Architecture Pattern**
```
DigitalCard Context (Existing DDD)
    │
    ├─── Module Wrapper (NEW)
    │     ├── module.json          → Metadata
    │     ├── ModuleInstaller      → Tenant setup
    │     └── SubscriptionClient   → Enhanced checks
    │
    └─── ModuleRegistry Context (Completed)
          ├── Install/Uninstall    → Lifecycle management  
          └── Subscription Check   → Core validation
```

### **4. Implementation Priority (4 days, not 5)**
```
DAY 1: Module Definition & Auto-discovery (Foundation)
DAY 2: Installation Logic (Tenant setup)
DAY 3: Enhanced Subscription Integration (Action-level checks)
DAY 4: Integration Testing & Production Readiness
```

---

## 📋 OPTIMIZED FILE STRUCTURE & PRIORITY

### **CRITICAL FILES (4 files total)**
```
app/Contexts/DigitalCard/
├── module.json                              # DAY 1 (Metadata)
├── Infrastructure/
│   ├── ModuleRegistry/
│   │   ├── DigitalCardModuleRegistration.php # DAY 1 (Auto-discovery)
│   │   └── EnhancedSubscriptionClient.php    # DAY 3 (Action-level checks)
│   └── Installation/
│       └── TenantModuleInstaller.php         # DAY 2 (Tenant setup)
```

### **OPTIONAL FILES (Add if needed)**
```
├── Infrastructure/
│   └── Routes/
│       └── tenant-routes.php                # Only if route changes needed
└── Providers/
    └── DigitalCardModuleServiceProvider.php # Only if DI changes needed
```

---

## 🔧 OPTIMIZED IMPLEMENTATION SEQUENCE

### **DAY 1: MODULE DEFINITION & AUTO-DISCOVERY**
**Target:** 2 files, 8 tests

**File 1: `module.json` (Simplified, Production-Focused)**
```json
{
  "name": "digital_card",
  "version": "1.0.0",
  "display_name": "Digital Business Cards",
  "description": "QR-enabled digital membership cards with validation",
  
  "integration": {
    "context_namespace": "DigitalCard",
    "depends_on": [],
    "conflicts_with": [],
    "minimum_platform_version": "1.0.0"
  },
  
  "subscription": {
    "required": true,
    "feature_name": "digital_cards",
    "quota_features": ["max_active_cards", "validations_per_month"]
  },
  
  "installation": {
    "migrations_path": "Infrastructure/Installation/Migrations/Tenant/",
    "seeder_class": "DigitalCard\\Infrastructure\\Installation\\DigitalCardSeeder"
  },
  
  "api": {
    "base_path": "/{tenant}/api/v1/cards",
    "mobile_path": "/{tenant}/mapi/v1/cards",
    "rate_limit": "100/hour",
    "requires_auth": true
  },
  
  "business_rules": {
    "max_cards_per_member": 1,
    "qr_code_ttl_hours": 24,
    "default_expiry_months": 12
  }
}
```

**File 2: `DigitalCardModuleRegistration.php`**
```php
namespace DigitalCard\Infrastructure\ModuleRegistry;

use DigitalCard\Infrastructure\Installation\TenantModuleInstaller;

class DigitalCardModuleRegistration
{
    public static function getMetadata(): array
    {
        return json_decode(
            file_get_contents(__DIR__ . '/../../../module.json'),
            true
        );
    }
    
    public static function getInstaller(): string
    {
        return TenantModuleInstaller::class;
    }
    
    // ModuleRegistry will call this during auto-discovery
    public static function registerWithModuleRegistry(): void
    {
        $registry = app('module-registry');
        $registry->registerModule(
            name: 'digital_card',
            version: '1.0.0',
            installer: self::getInstaller(),
            metadata: self::getMetadata()
        );
    }
}
```

### **DAY 2: INSTALLATION LOGIC (MINIMAL VIABLE)**
**Target:** 1 file, 6 tests

**File 3: `TenantModuleInstaller.php`**
```php
namespace DigitalCard\Infrastructure\Installation;

use DigitalCard\Infrastructure\ModuleRegistry\Contracts\TenantModuleInstallerInterface;

class TenantModuleInstaller implements TenantModuleInstallerInterface
{
    public function __construct(
        private string $tenantId
    ) {}
    
    public function install(): array
    {
        // 1. Run DigitalCard migrations (if any new tables needed)
        $this->runMigrations();
        
        // 2. Seed initial data (statuses, etc.)
        $this->seedInitialData();
        
        // 3. Register tenant event listeners
        $this->registerEventListeners();
        
        return [
            'success' => true,
            'tables_created' => [],
            'data_seeded' => true,
            'events_registered' => true
        ];
    }
    
    public function uninstall(bool $preserveData = false): array
    {
        if (!$preserveData) {
            $this->cleanupModuleData();
        }
        
        return ['success' => true];
    }
    
    private function runMigrations(): void
    {
        // Check if migrations already exist in DigitalCard context
        // If DigitalCard already has all tables via previous migrations,
        // this can be empty or run specific tenant customizations
    }
    
    private function seedInitialData(): void
    {
        // Seed card statuses, default configurations
        // This is tenant-specific configuration
    }
}
```

### **DAY 3: ENHANCED SUBSCRIPTION INTEGRATION**
**Target:** 1 file, update 3 existing handlers, 10 tests

**File 4: `EnhancedSubscriptionClient.php`**
```php
namespace DigitalCard\Infrastructure\ModuleRegistry;

use DigitalCard\Application\Ports\ModuleAccessInterface;
use DigitalCard\Domain\Exceptions\SubscriptionRequiredException;
use DigitalCard\Domain\Exceptions\QuotaExceededException;

class EnhancedSubscriptionClient implements ModuleAccessInterface
{
    public function __construct(
        private ModuleAccessInterface $baseModuleAccess // Already exists!
    ) {}
    
    public function canAccessModule(string $tenantId, string $moduleName): bool
    {
        // Delegate to existing ModuleRegistry check
        return $this->baseModuleAccess->canAccessModule($tenantId, $moduleName);
    }
    
    /**
     * NEW: Action-specific subscription check with quota
     */
    public function ensureTenantCan(string $tenantId, string $action, ?int $quantity = 1): void
    {
        // Check basic module access
        if (!$this->canAccessModule($tenantId, 'digital_card')) {
            throw new SubscriptionRequiredException('DigitalCard module not accessible');
        }
        
        // Check action-specific permissions
        $allowedActions = $this->getAllowedActions($tenantId);
        if (!in_array($action, $allowedActions)) {
            throw new SubscriptionRequiredException("Action '{$action}' not permitted");
        }
        
        // Check quota if applicable
        if ($this->isQuotaAction($action)) {
            $this->checkQuota($tenantId, $action, $quantity);
        }
    }
    
    private function getAllowedActions(string $tenantId): array
    {
        // Query ModuleRegistry for tenant's specific permissions
        // Based on subscription tier
        return ['issue', 'activate', 'revoke', 'validate']; // Example
    }
    
    private function checkQuota(string $tenantId, string $action, int $quantity): void
    {
        $usage = $this->getCurrentUsage($tenantId, $action);
        $limit = $this->getQuotaLimit($tenantId, $action);
        
        if (($usage + $quantity) > $limit) {
            throw new QuotaExceededException(
                "Quota exceeded for {$action}. Used: {$usage}/{$limit}"
            );
        }
    }
}
```

**Update Existing Handlers (3 handlers):**
```php
// In IssueCardHandler, ActivateCardHandler, RevokeCardHandler
public function __construct(
    private EnhancedSubscriptionClient $subscriptionClient,
    // ... other dependencies
) {}

public function handle($command): void
{
    // Add subscription check at start
    $this->subscriptionClient->ensureTenantCan(
        $command->tenantId,
        'issue', // or 'activate', 'revoke'
        1 // quantity
    );
    
    // Existing business logic continues unchanged
}
```

### **DAY 4: INTEGRATION TESTING**
**Target:** 8 integration tests, production validation

**Test Scenarios:**
1. Module discovery by ModuleRegistry
2. Tenant installation flow
3. Subscription enforcement in each handler
4. Quota checking and limits
5. Graceful degradation when module not installed
6. Error handling for subscription failures
7. Multi-tenant isolation verification
8. Production deployment validation

---

## 🎯 OPTIMIZED INTEGRATION STRATEGY

### **Strategy 1: Decorator Pattern for Subscription**
```php
// Use existing ModuleAccessInterface as base
// Enhance with DigitalCard-specific logic
$subscription = new EnhancedSubscriptionClient(
    app(ModuleAccessInterface::class) // Already implemented
);

// Handler uses enhanced version
// Zero changes to ModuleRegistry needed
```

### **Strategy 2: Minimal Installation Overhead**
```php
// If DigitalCard tables already exist via global migrations:
class TenantModuleInstaller
{
    public function install(): array
    {
        // Only tenant-specific configuration
        $this->configureTenantSettings($tenantId);
        $this->seedTenantData($tenantId);
        
        return ['success' => true];
    }
}
```

### **Strategy 3: Progressive Enhancement**
```
PHASE A: Basic Integration (Days 1-2)
  - Module discovery ✅
  - Tenant installation tracking ✅
  - Basic subscription check (via existing ModuleAccessInterface) ✅

PHASE B: Enhanced Features (Days 3-4)  
  - Action-level permission checking
  - Quota enforcement
  - Usage reporting
  - Tier-based feature access
```

---

## 🔐 SECURITY & PRODUCTION READINESS

### **From Day 1:**
- All subscription checks use existing ModuleRegistry security
- No new authentication mechanisms needed
- Leverage existing tenant isolation

### **Production Considerations:**
```php
// In EnhancedSubscriptionClient
public function ensureTenantCan(string $tenantId, string $action): void
{
    try {
        // Primary check via ModuleRegistry
        $this->baseModuleAccess->canAccessModule($tenantId, 'digital_card');
    } catch (ServiceUnavailableException $e) {
        // Graceful degradation: log and allow if in maintenance mode
        if (config('app.maintenance_mode')) {
            \Log::warning('ModuleRegistry unavailable, allowing access in maintenance mode');
            return;
        }
        throw $e;
    }
}
```

---

## 📊 SUCCESS METRICS

### **Completion Criteria:**
- [ ] Module discovered by ModuleRegistry (auto-registration)
- [ ] Tenant installation records created
- [ ] Existing handlers enhanced with subscription checks
- [ ] Quota enforcement working
- [ ] All existing DigitalCard tests still passing
- [ ] Integration tests with ModuleRegistry passing

### **Quality Gates:**
- Zero breaking changes to existing DigitalCard API
- All subscription failures provide clear error messages
- Tenant data isolation maintained
- Performance impact <5% on existing operations

---

## 🚀 CLAUDE CLI OPTIMIZED PROMPT

```
# 🚀 DIGITALCARD → MODULEREGISTRY INTEGRATION PROTOCOL

## 📋 CONTEXT SUMMARY
- **DigitalCard Context**: DDD foundation complete with hexagonal ports
- **ModuleRegistry Context**: Infrastructure layer 100% complete  
- **Integration Goal**: Make DigitalCard installable module with subscription enforcement
- **Critical Constraint**: ZERO changes to DigitalCard domain layer

## 🎯 4-DAY IMPLEMENTATION PLAN

### DAY 1: MODULE DEFINITION & AUTO-DISCOVERY (2 files)
```
TARGET: module.json + DigitalCardModuleRegistration.php
TESTS: 8 integration tests
PRIORITY: HIGH - Foundation for everything else

FILE 1: module.json (Simplified)
- Location: app/Contexts/DigitalCard/module.json
- Content: Module metadata, subscription requirements, dependencies
- Purpose: ModuleRegistry discovers and understands DigitalCard

FILE 2: DigitalCardModuleRegistration.php  
- Location: app/Contexts/DigitalCard/Infrastructure/ModuleRegistry/DigitalCardModuleRegistration.php
- Content: Auto-discovery class that registers with ModuleRegistry
- Purpose: ModuleRegistry calls this during module discovery
```

### DAY 2: TENANT INSTALLATION LOGIC (1 file)  
```
TARGET: TenantModuleInstaller.php
TESTS: 6 installation tests
PRIORITY: MEDIUM - Enables per-tenant installation

FILE 3: TenantModuleInstaller.php
- Location: app/Contexts/DigitalCard/Infrastructure/Installation/TenantModuleInstaller.php  
- Content: Implements ModuleRegistry's TenantModuleInstallerInterface
- Purpose: Runs when tenant installs DigitalCard module
- Key: Can be minimal if DigitalCard tables already exist
```

### DAY 3: ENHANCED SUBSCRIPTION INTEGRATION (1 file + handler updates)
```
TARGET: EnhancedSubscriptionClient.php + update 3 handlers
TESTS: 10 subscription/quota tests  
PRIORITY: HIGH - Core business value

FILE 4: EnhancedSubscriptionClient.php
- Location: app/Contexts/DigitalCard/Infrastructure/ModuleRegistry/EnhancedSubscriptionClient.php
- Content: Decorator around existing ModuleAccessInterface
- Purpose: Adds action-level checks and quota enforcement

HANDLER UPDATES (3 files):
- IssueCardHandler: Add subscription check at start
- ActivateCardHandler: Add subscription check at start  
- RevokeCardHandler: Add subscription check at start
- Pattern: Inject EnhancedSubscriptionClient, call ensureTenantCan()
```

### DAY 4: INTEGRATION TESTING & VALIDATION
```
TARGET: 8 comprehensive integration tests
PRIORITY: HIGH - Production readiness

TEST SCENARIOS:
1. Module auto-discovery by ModuleRegistry
2. Tenant installation workflow  
3. Subscription enforcement in all handlers
4. Quota checking and limits
5. Graceful degradation
6. Error handling
7. Multi-tenant isolation
8. Production deployment validation
```

## 🏗️ ARCHITECTURAL CONSTRAINTS

### RULE 1: DOMAIN LAYER PURITY
- ❌ NO changes to Domain/ aggregates, value objects, or domain services
- ✅ ONLY Infrastructure and Application layer modifications
- ✅ Use existing hexagonal ports (ModuleAccessInterface)

### RULE 2: DECORATOR PATTERN FOR SUBSCRIPTION
```php
// Build on existing ModuleRegistry implementation
class EnhancedSubscriptionClient implements ModuleAccessInterface
{
    public function __construct(
        private ModuleAccessInterface $baseModuleAccess // ALREADY EXISTS
    ) {}
    
    // Enhance with DigitalCard-specific logic
    public function ensureTenantCan(string $tenantId, string $action): void
    {
        // 1. Use base check (already works)
        // 2. Add action-level permissions  
        // 3. Add quota checking
    }
}
```

### RULE 3: MINIMAL INSTALLATION OVERHEAD
- If DigitalCard tables already exist: installer only configures tenant settings
- If new tables needed: add to Infrastructure/Installation/Migrations/Tenant/
- NEVER duplicate existing migrations

### RULE 4: PROGRESSIVE ENHANCEMENT
```
PHASE A (Days 1-2): Basic Integration
  - Module discovery ✅
  - Installation tracking ✅
  - Basic subscription checks ✅

PHASE B (Days 3-4): Enhanced Features
  - Action-level permissions
  - Quota enforcement  
  - Usage reporting
```

## 🔧 IMPLEMENTATION RULES

### FOR EACH HANDLER UPDATE:
1. **Inject** EnhancedSubscriptionClient (decorator)
2. **Add check** at handler start: `$subscription->ensureTenantCan($tenantId, $action)`
3. **Preserve** all existing business logic unchanged
4. **Add tests** for subscription failure scenarios

### FOR INSTALLATION LOGIC:
1. **Check first**: Do DigitalCard tables already exist via previous migrations?
2. **If yes**: Installer only seeds tenant-specific data
3. **If no**: Create minimal tenant migrations
4. **Always**: Return success/failure status to ModuleRegistry

### FOR ERROR HANDLING:
```php
// Consistent exception hierarchy
throw new SubscriptionRequiredException(
    message: "DigitalCard module requires active subscription",
    tenantId: $tenantId,
    module: 'digital_card',
    requiredAction: $action
);

// With clear recovery instructions in message
```

## 🧪 TESTING REQUIREMENTS

### AUTODISCOVERY TESTS (Day 1):
- ✅ ModuleRegistry discovers DigitalCard module
- ✅ Metadata (module.json) correctly parsed  
- ✅ Installer class correctly identified
- ✅ Registration doesn't break existing functionality

### INSTALLATION TESTS (Day 2):
- ✅ Tenant installation creates correct records
- ✅ Installation idempotent (can run twice safely)
- ✅ Uninstallation cleans up appropriately
- ✅ Data preservation option works

### SUBSCRIPTION TESTS (Day 3):
- ✅ Each handler enforces subscription
- ✅ Action-level permissions work
- ✅ Quota enforcement functional
- ✅ Clear error messages on failure

### INTEGRATION TESTS (Day 4):
- ✅ Full workflow: Discover → Install → Use → Uninstall
- ✅ Multi-tenant isolation maintained
- ✅ Performance impact <5%
- ✅ Graceful degradation when ModuleRegistry unavailable

## 🚀 PRODUCTION READINESS CHECKLIST

### DAY 4 COMPLETION CRITERIA:
- [ ] Module auto-registers with ModuleRegistry
- [ ] Tenants can install/uninstall DigitalCard
- [ ] All DigitalCard operations check subscription
- [ ] Quota limits enforced per subscription tier
- [ ] All existing DigitalCard tests still pass
- [ ] Integration tests with ModuleRegistry pass
- [ ] Error handling provides clear user messages
- [ ] Performance benchmarks within acceptable range
- [ ] Deployment documentation updated

### SECURITY VERIFICATION:
- [ ] Tenant isolation maintained
- [ ] Subscription checks cannot be bypassed
- [ ] Quota enforcement tamper-proof
- [ ] Error messages don't leak sensitive data
- [ ] All API endpoints still properly authenticated

## 🏁 STARTING POINT

**Begin with:** `module.json` (Day 1, File 1)

**Key Insight:** You're NOT rebuilding DigitalCard. You're ADDING a module wrapper that:
1. Lets ModuleRegistry discover and manage DigitalCard
2. Adds enhanced subscription checks to existing handlers
3. Enables per-tenant installation tracking

**All DigitalCard business logic remains unchanged.** Only Infrastructure/Application layers get minor additions.

**Ready to begin Day 1 implementation?**
```

---

## 🎯 EXECUTION PROTOCOL FOR CLAUDE

**For each day, confirm:**
```
✅ PREVIOUS DAY COMPLETE: Tests passing, files created
✅ DEPENDENCIES READY: ModuleRegistry infrastructure available
✅ ARCHITECTURE CLEAR: Decorator pattern for subscription enhancement
✅ TEST STRATEGY: TDD with integration focus
```

**Daily workflow:**
1. **Morning:** Review day's target (2-3 files max)
2. **Implementation:** Create files with TDD (test first)
3. **Integration:** Test with ModuleRegistry context
4. **Validation:** Ensure existing DigitalCard tests still pass
5. **Documentation:** Update integration docs

**Blockers to flag immediately:**
- ModuleRegistry API changes needed
- DigitalCard domain modifications required (should be ZERO)
- Performance degradation beyond 5%
- Security concerns in integration points

**Success measurement:**
- All existing DigitalCard functionality preserved
- ModuleRegistry integration working end-to-end
- Subscription enforcement effective
- Production deployment ready by Day 4

---

**Optimized DigitalCard → ModuleRegistry Integration Protocol Ready.**  
**4-Day Implementation Plan Defined.**  
**Begin Implementation: Day 1 - Module Definition & Auto-discovery.** 🚀