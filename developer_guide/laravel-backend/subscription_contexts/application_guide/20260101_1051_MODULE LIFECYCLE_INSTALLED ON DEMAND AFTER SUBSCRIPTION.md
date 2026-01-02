# 📊 **MODULE LIFECYCLE: "INSTALLED ON DEMAND AFTER SUBSCRIPTION"**

## 🎯 **BUSINESS CONTEXT**

**Scenario:** A tenant wants a premium feature (e.g., "Inventory Management") that costs $50/month. They:
1. **Subscribe** to the feature (payment processed)
2. **Install** the module (database tables created)
3. **Use** the feature
4. **Unsubscribe** (stop paying)
5. **Uninstall or Deactivate** (cleanup based on policy)

---

## 🔄 **COMPLETE LIFECYCLE FLOW**

```
┌─────────────────────────────────────────────────────────┐
│                     MODULE LIFECYCLE                    │
├─────────────────────────────────────────────────────────┤
│  Phase 1: Catalog Registration                          │
│  Phase 2: Tenant Subscription                           │
│  Phase 3: Installation & Activation                     │
│  Phase 4: Active Usage                                  │
│  Phase 5: Subscription Management                       │
│  Phase 6: Deactivation/Uninstallation                   │
│  Phase 7: Data Retention & Cleanup                      │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 **PHASE 1: CATALOG REGISTRATION (Platform-Wide)**

### **Status:** `REGISTERED`
**When:** Module developer creates and registers the module
**Who:** Platform administrator/developer

```php
// Module is added to ModuleRegistry catalog
{
  "id": "uuid-inventory-module",
  "name": "inventory",
  "display_name": "Inventory Management",
  "status": "PUBLISHED", // or "DRAFT", "BETA"
  "requires_subscription": true,
  "subscription_price": 50.00, // $/month
  "trial_period_days": 14,
  "configuration_schema": {...}
}
```

**Database State:** Module exists in `modules` table (landlord DB)

---

## 📋 **PHASE 2: TENANT SUBSCRIPTION (Per Tenant)**

### **Status:** `SUBSCRIBED`
**When:** Tenant admin subscribes to the module
**Who:** Tenant administrator

### **Subscription Flow:**
```bash
# 1. Tenant views available modules
GET /api/v1/modules/catalog
# Returns: [..., {name: "inventory", price: 50, trial: 14}, ...]

# 2. Tenant subscribes (payment processed)
POST /api/v1/subscriptions
{
  "module_name": "inventory",
  "plan": "monthly",
  "payment_token": "tok_visa_123"
}

# 3. Payment processor (Stripe) confirms
# 4. ModuleRegistry creates subscription record
```

**Database State:** 
- `subscriptions` table: Billing record created
- `tenant_modules` table: Status = `SUBSCRIBED`

---

## 📋 **PHASE 3: INSTALLATION & ACTIVATION (Per Tenant)**

### **Status:** `INSTALLING` → `ACTIVE`
**When:** Subscription confirmed, installation triggered
**Who:** Platform Context automated system

### **Installation Flow:**
```php
// 1. Subscription webhook triggers installation
class SubscriptionPaidWebhookHandler
{
    public function handle(PaymentSucceeded $event): void
    {
        // 2. Queue installation job
        ModuleInstallationJob::dispatch(
            moduleName: 'inventory',
            tenantSlug: $event->tenantSlug,
            userId: $event->adminUserId
        );
    }
}

// 3. Installation job runs
class ModuleInstallationJob
{
    public function handle(ContextInstaller $installer): void
    {
        // 4. Run migrations (landlord + tenant databases)
        $result = $installer->install('Inventory', $this->tenantSlug);
        
        // 5. Update tenant_module status
        $tenantModule = TenantModule::findForTenant($this->tenantSlug, 'inventory');
        $tenantModule->markAsInstalled(
            installedBy: $this->userId,
            installedAt: now()
        );
        
        // 6. Send notification to tenant admin
        Notification::send(...);
    }
}
```

**Database State:**
- ✅ Landlord tables created (if any)
- ✅ Tenant tables created (with `tenant_id` FK)
- ✅ `tenant_modules.status` = `ACTIVE`
- ✅ First bill generated

---

## 📋 **PHASE 4: ACTIVE USAGE (Ongoing)**

### **Status:** `ACTIVE`
**When:** Module installed and ready for use
**Who:** Tenant users

### **Access Control Flow:**
```php
// Every module request checks subscription
class InventoryController
{
    public function index(ModuleAccessInterface $moduleAccess)
    {
        // Verify tenant has active subscription
        if (!$moduleAccess->canAccessInventory($tenantId)) {
            throw new SubscriptionRequiredException('Inventory module');
        }
        
        // Module-specific business logic
        return $this->inventoryService->getItems($tenantId);
    }
}

// ModuleAccessInterface implementation
class ModuleRegistryAccessAdapter implements ModuleAccessInterface
{
    public function canAccessInventory(TenantId $tenantId): bool
    {
        $tenantModule = $this->repository->findForTenant($tenantId, 'inventory');
        
        return $tenantModule 
            && $tenantModule->isActive()
            && !$tenantModule->isTrialExpired()
            && !$tenantModule->isPaymentOverdue();
    }
}
```

**Database State:**
- ✅ Regular usage tracking
- ✅ Feature access logs
- ✅ Monthly billing cycles

---

## 📋 **PHASE 5: SUBSCRIPTION MANAGEMENT**

### **Status Changes:** `ACTIVE` ↔ `PAUSED` ↔ `CANCELLED`
**When:** Tenant modifies subscription
**Who:** Tenant administrator

### **Common Scenarios:**

#### **Scenario A: Upgrade/Downgrade**
```php
// Tenant upgrades from Basic to Pro
POST /api/v1/subscriptions/inventory/upgrade
{
  "new_plan": "pro",
  "prorated_charge": 25.00
}

// Effect: Module remains ACTIVE with new features
```

#### **Scenario B: Pause Subscription**
```php
// Tenant pauses for 3 months (seasonal business)
POST /api/v1/subscriptions/inventory/pause
{
  "pause_months": 3,
  "reason": "seasonal_closure"
}

// Effect: Status changes to PAUSED
// Module access disabled but data preserved
```

#### **Scenario C: Payment Failed**
```php
// Automatic payment retry system
class PaymentRetryHandler
{
    public function handle(PaymentFailed $event): void
    {
        $tenantModule = TenantModule::find(...);
        
        // 1. Grace period (7 days)
        $tenantModule->enterGracePeriod();
        
        // 2. Notify tenant admin
        $this->notifyPaymentFailed($tenantModule);
        
        // 3. After grace period → SUSPENDED
        if ($tenantModule->gracePeriodExpired()) {
            $tenantModule->suspendForNonPayment();
        }
    }
}
```

**Database State:** Status transitions in `tenant_modules` table

---

## 📋 **PHASE 6: DEACTIVATION/UNINSTALLATION**

### **Status:** `DEACTIVATING` → `UNINSTALLED`
**When:** Subscription cancelled and uninstall triggered
**Who:** Platform Context automated system

### **Uninstallation Policies:**

#### **Policy 1: Immediate Uninstall (Data Lost)**
```php
// For low-value data or legal requirements
class ImmediateUninstallPolicy implements UninstallPolicyInterface
{
    public function execute(string $moduleName, string $tenantSlug): void
    {
        // 1. Run down migrations (drop tables)
        $installer->uninstall($moduleName, $tenantSlug);
        
        // 2. Delete tenant_module record
        TenantModule::deleteForTenant($tenantSlug, $moduleName);
        
        // 3. Data permanently deleted
    }
}
```

#### **Policy 2: Grace Period Uninstall (30-day data retention)**
```php
// Most common - preserves data if tenant resubscribes
class GracePeriodUninstallPolicy implements UninstallPolicyInterface
{
    public function execute(string $moduleName, string $tenantSlug): void
    {
        // 1. Deactivate but keep data
        $tenantModule = TenantModule::findForTenant($tenantSlug, $moduleName);
        $tenantModule->deactivate();
        
        // 2. Schedule cleanup in 30 days
        DataCleanupJob::dispatch($moduleName, $tenantSlug)
            ->delay(now()->addDays(30));
    }
}
```

#### **Policy 3: Archive & Uninstall (Export data)**
```php
// For compliance or high-value data
class ArchiveUninstallPolicy implements UninstallPolicyInterface
{
    public function execute(string $moduleName, string $tenantSlug): void
    {
        // 1. Export data to S3/Blob storage
        $archiveUrl = $this->exporter->exportModuleData($moduleName, $tenantSlug);
        
        // 2. Store archive metadata
        ModuleArchive::create([
            'module_name' => $moduleName,
            'tenant_slug' => $tenantSlug,
            'archive_url' => $archiveUrl,
            'exported_at' => now(),
        ]);
        
        // 3. Uninstall module
        $installer->uninstall($moduleName, $tenantSlug);
    }
}
```

### **Uninstallation Flow:**
```bash
# 1. Tenant cancels subscription
POST /api/v1/subscriptions/inventory/cancel
{
  "effective_date": "2025-01-31",
  "cancellation_reason": "no_longer_needed"
}

# 2. Platform schedules uninstallation
# 3. At effective_date, uninstall job runs
# 4. Module removed from tenant's database
```

**Database State:** 
- Option A: Tables dropped, data deleted
- Option B: Tables kept, status = `DEACTIVATED`
- Option C: Data archived, tables dropped

---

## 📋 **PHASE 7: DATA RETENTION & CLEANUP**

### **Status:** `ARCHIVED` → `PURGED`
**When:** After uninstallation, based on retention policy
**Who:** Automated cleanup jobs

### **Retention Policies:**

```php
// Defined per module in catalog registration
{
  "data_retention_policy": {
    "active_subscription": "keep_forever",
    "cancelled_trial": "delete_immediately", 
    "paid_subscription_ended": "keep_90_days",
    "legal_hold": "keep_7_years"
  }
}
```

### **Cleanup Job:**
```php
class ModuleDataCleanupJob
{
    public function handle(): void
    {
        // Find deactivated modules past retention period
        $expiredModules = TenantModule::where('status', 'DEACTIVATED')
            ->where('deactivated_at', '<', now()->subDays(90))
            ->get();
            
        foreach ($expiredModules as $tenantModule) {
            // 1. Verify no legal hold
            if ($this->legalHoldService->hasHold($tenantModule)) {
                continue;
            }
            
            // 2. Execute module-specific cleanup
            $this->cleanupModuleData($tenantModule);
            
            // 3. Update status to PURGED
            $tenantModule->markAsPurged();
            
            // 4. Audit log
            AuditLog::moduleDataPurged($tenantModule);
        }
    }
}
```

**Database State:** 
- Final status: `PURGED`
- Data: Removed per policy
- Metadata: Audit trail preserved

---

## 🕒 **LIFECYCLE TIMELINE EXAMPLE**

```
Timeline for "Inventory" module for Tenant "Acme Corp":

Day 0:  Module REGISTERED in catalog by developer
Day 30: Tenant SUBSCRIBES ($50/month, 14-day trial)
Day 30: Module INSTALLED (tables created, status ACTIVE)
Day 44: Trial ends → billing starts (status remains ACTIVE)
Day 180: Payment fails → 7-day grace period (status GRACE_PERIOD)
Day 187: Payment still failed → status SUSPENDED (access blocked)
Day 190: Payment made → status ACTIVE again
Day 365: Tenant cancels subscription (effective in 30 days)
Day 395: Subscription ends → status DEACTIVATED (data retained)
Day 485: 90-day retention ends → data PURGED
```

---

## ⚙️ **TECHNICAL IMPLEMENTATION COMPONENTS**

### **1. Subscription Service**
```php
interface SubscriptionServiceInterface
{
    public function subscribe(string $tenantSlug, string $moduleName): Subscription;
    public function cancel(string $tenantSlug, string $moduleName, \DateTime $effectiveDate): void;
    public function isActive(string $tenantSlug, string $moduleName): bool;
}
```

### **2. Installation Orchestrator**
```php
class ModuleLifecycleOrchestrator
{
    public function installOnSubscription(Subscription $subscription): void
    {
        // 1. Check prerequisites
        $this->validatePrerequisites($subscription);
        
        // 2. Install module
        $result = $this->contextInstaller->install(
            $subscription->moduleName,
            $subscription->tenantSlug
        );
        
        // 3. Activate
        $this->moduleActivator->activate($subscription);
        
        // 4. Send welcome
        $this->notifier->moduleInstalled($subscription);
    }
}
```

### **3. Access Control Middleware**
```php
class ModuleSubscriptionMiddleware
{
    public function handle($request, Closure $next, string $moduleName)
    {
        $tenantId = $request->tenant()->id();
        
        if (!$this->subscriptionService->isActive($tenantId, $moduleName)) {
            if ($this->subscriptionService->isTrial($tenantId, $moduleName)) {
                return redirect()->route('module.trial_expired', $moduleName);
            }
            
            throw new SubscriptionRequiredException($moduleName);
        }
        
        return $next($request);
    }
}

// Usage in routes:
Route::middleware(['tenant', 'module:inventory'])
    ->prefix('/inventory')
    ->group(function () {
        // All inventory routes require active subscription
    });
```

---

## 🎯 **BUSINESS RULES MATRIX**

| Module Type | Trial | Auto-Install | Retention | Uninstall Policy |
|-------------|-------|--------------|-----------|------------------|
| **Core** (Free) | No | Yes | Keep forever | Never uninstall |
| **Premium** ($) | 14 days | On payment | 90 days | Grace period |
| **Enterprise** ($$$) | Custom | Manual | 7 years | Archive & keep |
| **Trial-only** | 30 days | Yes | 7 days | Delete immediately |
| **Add-on** | No | With parent | Same as parent | With parent |

---

## 🚨 **EDGE CASES & EXCEPTIONS**

### **1. Tenant Migration Between Plans**
```php
// Tenant moves from Basic to Pro while active
// Solution: Hot-swap configuration, keep data
```

### **2. Module Version Upgrade During Subscription**
```php
// New version released while tenant subscribed
// Solution: Auto-upgrade with rollback capability
```

### **3. Tenant Requests Data Export Before Uninstall**
```php
// GDPR/legal right to data portability
// Solution: Provide data export API before uninstall
```

### **4. Payment Dispute After Uninstall**
```php
// Customer disputes charge after data deleted
// Solution: Archive data for 180 days post-uninstall
```

---

## 📊 **MONITORING & METRICS**

### **Key Metrics to Track:**
```php
$metrics = [
    'subscription_conversion_rate' => 'Trials → Paid',
    'average_revenue_per_user' => 'ARPU per module',
    'churn_rate' => 'Cancellations per month',
    'module_usage_rate' => 'Active users / Subscribers',
    'installation_success_rate' => 'Successful installs',
    'uninstall_recovery_rate' => 'Resubscriptions after uninstall',
];
```

### **Health Dashboard:**
```php
class ModuleLifecycleDashboard
{
    public function getHealth(string $moduleName): array
    {
        return [
            'total_subscribers' => $this->countSubscribers($moduleName),
            'active_installations' => $this->countActiveInstallations($moduleName),
            'trial_conversions' => $this->countTrialConversions($moduleName),
            'revenue_last_30_days' => $this->calculateRevenue($moduleName),
            'common_cancellation_reasons' => $this->getCancellationReasons($moduleName),
        ];
    }
}
```

---

## 🏁 **SUMMARY: THE COMPLETE JOURNEY**

### **From Module Developer Perspective:**
1. **Build** module following hexagonal architecture
2. **Register** with BootstrapSeeder.php
3. **Define** subscription pricing and policies
4. **Monitor** adoption and revenue

### **From Tenant Administrator Perspective:**
1. **Browse** module catalog
2. **Subscribe** (trial or paid)
3. **Use** feature (automatically installed)
4. **Manage** subscription (upgrade/downgrade/pause)
5. **Cancel** when no longer needed
6. **Data** handled per retention policy

### **From Platform Operator Perspective:**
1. **Review** module submissions
2. **Approve** for catalog
3. **Monitor** billing and usage
4. **Handle** support requests
5. **Enforce** policies and compliance

---

## 🔑 **KEY TAKEAWAYS**

1. **Lifecycle is State-Based** - Clear status transitions drive behavior
2. **Automation is Critical** - Manual steps don't scale
3. **Policy-Driven** - Different modules need different rules
4. **Data Sensitivity** - Retention policies must match data value
5. **Revenue-Aligned** - Lifecycle directly impacts MRR (Monthly Recurring Revenue)

**Ultimate Goal:** Create a **self-service, automated system** where:
- Tenants can subscribe/unsubscribe easily
- Developers can monetize their modules
- Platform scales without manual intervention
- Everyone's data and revenue are protected

---

## 📚 **IMPLEMENTATION CHECKLIST**

- [ ] Module registered in catalog with pricing
- [ ] Subscription service integrated with payment processor
- [ ] Automated installation on subscription confirmation
- [ ] Access control middleware for all module routes
- [ ] Grace period and retry logic for failed payments
- [ ] Uninstall policies defined per module type
- [ ] Data retention and cleanup jobs scheduled
- [ ] Monitoring dashboard for lifecycle metrics
- [ ] Tenant notification system for status changes
- [ ] Support for trials, upgrades, pauses, and cancellations

**Success:** When a tenant can go from "never heard of module" to "actively using" to "cancelled and cleaned up" **without any manual intervention from your team.** 🚀