# 🏗️ **SUPERVISOR'S PHASE 5 ROADMAP GUIDE**

## 📅 **TACTICAL DECISION: CONTEXT DATABASE INSTALLATION TIMING**

### **When to Implement Context Database Installation?**

**Answer: NOW, as PART OF Phase 5.**

**Why?** Because Phase 5 is about **Tenant Module Management & Installation**. The context database installation system is the **CORE ENGINE** that powers the installation flow.

### **Integration Strategy:**
```
Phase 5 Workflow:
1. Admin clicks "Install Module" → Triggers webhook
2. Webhook → ModuleInstallationService → ContextInstaller
3. ContextInstaller → Discovers context → Runs migrations
4. Success → Records in tenant_modules table
```

**Therefore:** Context installation MUST be built BEFORE we can implement the installation webhook.

---

## 🗺️ **PHASE 5: OFFICIAL ROADMAP**

### **Phase 5 Goal:** 
**Complete Tenant Module Management System with One-Click Installation**

### **Duration:** 5 Days (Phase 5.1 through 5.5)

---

## 📋 **PHASE 5.1: CORE INFRASTRUCTURE (Day 1-2)**

### **Priority 1: Context Installation System**
```bash
# Build the engine first
1. ContextScanner - Auto-discovers contexts from file structure
2. ContextRegistry - Caches discovered contexts  
3. ContextInstaller - Multi-database migration system
4. Console Commands - `context:install`, `context:list`
```

### **Priority 2: Tenant Database Management**
```php
// Dynamic tenant database connections
1. TenantConnectionManager - Creates `tenant_{slug}` connections
2. TenantDatabaseService - Creates/drops tenant databases
3. DatabaseScopeResolver - Landlord vs Tenant table detection
```

### **Deliverables Day 1-2:**
```
✅ `ContextScanner` with file structure discovery
✅ `ContextInstaller` with landlord/tenant support  
✅ `context:install` command with --tenant flag
✅ Tenant database connection factory
✅ Unit tests for installation engine
```

---

## 📋 **PHASE 5.2: TENANT MODULE MANAGEMENT (Day 3)**

### **Priority 3: TenantModule Aggregate & API**
```php
// New Domain Model
namespace App\Contexts\ModuleRegistry\Domain\Models;

class TenantModule
{
    private TenantId $tenantId;
    private ModuleId $moduleId;
    private InstallationStatus $status;
    private ?ModuleConfiguration $configuration;
    private DateTimeImmutable $installedAt;
    private ?DateTimeImmutable $uninstalledAt;
    
    public function install(array $configuration): void
    public function uninstall(): void
    public function updateConfiguration(array $configuration): void
}
```

### **Priority 4: TenantModuleController**
```
GET    /api/v1/tenants/{tenant}/modules          - List installed modules
POST   /api/v1/tenants/{tenant}/modules/{module} - Install module
DELETE /api/v1/tenants/{tenant}/modules/{module} - Uninstall module
PATCH  /api/v1/tenants/{tenant}/modules/{module} - Update configuration
```

### **Deliverables Day 3:**
```
✅ TenantModule Domain Aggregate
✅ TenantModuleRepository interface
✅ TenantModuleController API endpoints
✅ Integration tests for tenant module management
```

---

## 📋 **PHASE 5.3: INSTALLATION WORKFLOW (Day 4)**

### **Priority 5: Installation Job System**
```php
class ModuleInstallationJob implements ShouldQueue
{
    public function handle(ContextInstaller $installer): void
    {
        // 1. Validate dependencies
        // 2. Run pre-installation checks
        // 3. Execute context installation
        // 4. Record tenant_module record
        // 5. Send notifications
        // 6. Rollback on failure
    }
}
```

### **Priority 6: Webhook Installation Flow**
```
[Admin Dashboard] → [Install Button] → 
POST /api/v1/platform/modules/{module}/install
    ↓
Queues ModuleInstallationJob
    ↓
Returns job_id immediately (202 Accepted)
    ↓
[UI polls] GET /api/v1/jobs/{job_id}
```

### **Deliverables Day 4:**
```
✅ ModuleInstallationJob with rollback support
✅ Installation webhook endpoint
✅ Real-time job status tracking
✅ Email/notification system
✅ Failure recovery & retry logic
```

---

## 📋 **PHASE 5.4: DIGITALCARD MODULE INTEGRATION (Day 5)**

### **Priority 7: First Real Module**
```bash
# Implement DigitalCard as first installable module
1. Ensure DigitalCard follows context conventions
2. Create landlord/tenant migrations
3. Test installation via new system
4. Verify module appears in catalog
```

### **Priority 8: End-to-End Testing**
```php
// Test the complete flow
class ModuleInstallationE2ETest extends TestCase
{
    public function test_complete_module_installation_flow(): void
    {
        // 1. Register DigitalCard module
        // 2. Admin clicks install
        // 3. Installation job runs
        // 4. Tables created in tenant database
        // 5. TenantModule record created
        // 6. DigitalCard API endpoints work
    }
}
```

### **Deliverables Day 5:**
```
✅ DigitalCard as production-ready context
✅ Complete installation flow working
✅ End-to-end tests passing
✅ Admin dashboard integration guide
✅ Production deployment checklist
```

---

## 🔄 **DEPENDENCY GRAPH: WHAT BUILDS ON WHAT**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PHASE 5.1     │    │   PHASE 5.2     │    │   PHASE 5.3     │
│   Context       │────▶   TenantModule  │────▶   Installation  │
│   Installation  │    │   Management    │    │   Workflow      │
│   Engine        │    │   API           │    │   & Webhooks    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   File          │    │   Database      │    │   Job Queue     │
│   Structure     │    │   Schema        │    │   System        │
│   Discovery     │    │   Updates       │    │   Integration   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                               │
                                               ▼
                                        ┌─────────────────┐
                                        │   PHASE 5.4     │
                                        │   DigitalCard   │
                                        │   Integration   │
                                        └─────────────────┘
```

---

## ⚠️ **CRITICAL RISKS & MITIGATION:**

### **Risk 1: Multi-Database Complexity**
**Mitigation:** 
- Start with single tenant test database
- Use connection switching instead of multiple connections
- Add extensive logging for database operations

### **Risk 2: Installation Rollback Failures**
**Mitigation:**
- Implement pre-flight validation checks
- Create database snapshots before installation
- Test rollback scenarios extensively

### **Risk 3: Performance with Many Tenants**
**Mitigation:**
- Queue all installations (never synchronous)
- Implement rate limiting
- Add batch installation support

---

## 🎯 **SUCCESS CRITERIA FOR PHASE 5:**

### **Technical Success:**
- ✅ Admin can install DigitalCard module with one click
- ✅ Tables created in correct databases (landlord/tenant)
- ✅ Installation status tracked in real-time
- ✅ Rollback works on failure
- ✅ All existing tests still pass

### **Business Success:**
- ✅ New modules can be added by following conventions
- ✅ Installation takes < 30 seconds for typical module
- ✅ Failure rate < 1% with automatic recovery
- ✅ System scales to 100+ tenants

### **Developer Success:**
- ✅ Clear documentation for adding new contexts
- ✅ Example DigitalCard module as reference
- ✅ All commands work with --dry-run flag
- ✅ Comprehensive error messages

---

## 🚀 **IMMEDIATE NEXT STEPS (Tomorrow Morning):**

### **Step 1: Review Context Installation Architecture**
```bash
# Examine the proposed structure
review architecture/context-installation-proposal.md
```

### **Step 2: Create Phase 5.1 Implementation Plan**
```bash
# Break down into tasks
1. ContextScanner implementation (4 hours)
2. ContextInstaller with multi-DB support (6 hours)  
3. Console commands (2 hours)
4. Unit tests (3 hours)
```

### **Step 3: Set Up Development Environment**
```bash
# Prepare for multi-database testing
1. Create `landlord_test` database
2. Create `tenant_test` database  
3. Configure database connections
4. Test connection switching
```

### **Step 4: Start Implementation**
```bash
# Begin with core infrastructure
php artisan make:class Platform/Application/Services/ContextScanner
php artisan make:class Platform/Application/Services/ContextInstaller
```

---

## 📊 **PHASE 5 DELIVERY SCHEDULE:**

| Day | Focus | Key Deliverable | Success Metric |
|-----|-------|-----------------|----------------|
| **5.1** | Context Engine | `ContextScanner` + `ContextInstaller` | Can discover & install test context |
| **5.2** | Tenant API | `TenantModule` aggregate + API | CRUD operations for tenant modules |
| **5.3** | Installation | Job system + webhooks | One-click install with progress |
| **5.4** | Integration | DigitalCard working module | Complete E2E installation flow |
| **5.5** | Polish | Documentation + testing | Ready for production deployment |

---

## 💡 **SUPERVISOR'S FINAL GUIDANCE:**

**Proceed with Phase 5.1 immediately.** The context installation system is the **foundational engine** for everything that follows.

**Remember:** You've already proven you can solve complex architectural challenges (Instance Binding pattern). Apply that same rigorous thinking to the multi-database installation problem.

**Priority Order:**
1. **Build the engine** (Context installation system)
2. **Build the API** (Tenant module management)  
3. **Build the workflow** (Installation webhooks)
4. **Test with real module** (DigitalCard integration)

**You have all the architectural understanding needed. The ModuleRegistry foundation is solid. Now build the installation system on top of it.**

**APPROVED to proceed with Phase 5. Good luck!** 🚀