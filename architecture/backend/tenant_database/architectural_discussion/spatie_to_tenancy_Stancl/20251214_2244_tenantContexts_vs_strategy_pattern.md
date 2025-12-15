# **TenantContext Service vs. Strategy Pattern: When & Why**

These are **complementary solutions** for different abstraction levels in your multi-tenant system. Let me explain when you need each and why:

## 📊 **Quick Comparison**

| **Aspect** | **TenantContext Service** | **Strategy Pattern (Database Switching)** |
|------------|---------------------------|------------------------------------------|
| **Purpose** | **"Who is the current tenant?"** - Tenant identification & context management | **"How do we switch databases?"** - Database connection mechanics |
| **Problem Solved** | Different packages have different ways to identify current tenant (`Tenant::current()` vs `tenancy()->getTenant()`) | Different packages have different database switching implementations |
| **Abstraction Level** | **Business/Application Layer** - Higher level | **Infrastructure/Technical Layer** - Lower level |
| **When You Need It** | When your code needs to know "which tenant are we dealing with?" | When you need to switch database connections for a specific tenant |
| **Complexity** | Simple service wrapper | More complex with multiple implementations |

## 🎯 **1. TenantContext Service: For Tenant Identification**

### **The Problem It Solves**
Different tenancy packages have **different APIs** for getting the current tenant:

```php
// Spatie Multitenancy (your current system)
$currentTenant = \App\Models\Tenant::current();

// Stancl/Tenancy (possible future system)  
$currentTenant = tenancy()->getTenant();

// Custom implementation (another possibility)
$currentTenant = CurrentTenantResolver::resolve();
```

### **When You Need TenantContext Service**

**Scenario 1: Authentication & Authorization**
```php
// ❌ WITHOUT TenantContext (package-dependent)
public function getCurrentUser()
{
    $tenant = Tenant::current(); // Spatie-specific
    return $tenant ? User::where('tenant_id', $tenant->id)->first() : null;
}

// ✅ WITH TenantContext (package-agnostic)
public function getCurrentUser()
{
    $tenant = app(TenantContext::class)->getCurrentTenant();
    return $tenant ? User::where('tenant_id', $tenant->getId())->first() : null;
}
```

**Scenario 2: Multi-tenant Dashboard/Admin Area**
```php
// In admin controllers, reports, analytics
$currentTenant = $this->tenantContext->getCurrentTenant();
$stats = $this->getStatsForTenant($currentTenant);
```

**Scenario 3: Background Jobs/Queues**
```php
// Job needs to know which tenant to process
class ProcessTenantData implements ShouldQueue
{
    public function __construct(
        private string $tenantId,
        private TenantContext $tenantContext
    ) {}
    
    public function handle()
    {
        $tenant = $this->tenantContext->getTenantById($this->tenantId);
        // Process tenant-specific data
    }
}
```

### **Simple Implementation**
```php
// app/Services/TenantContext.php
class TenantContext
{
    public function getCurrentTenant(): ?TenantInterface
    {
        // Try Spatie first, then Stancl, then custom
        if (class_exists(\App\Models\Tenant::class) && method_exists(\App\Models\Tenant::class, 'current')) {
            return \App\Models\Tenant::current();
        }
        
        if (function_exists('tenancy')) {
            return tenancy()->getTenant();
        }
        
        return null; // Or throw exception
    }
    
    public function getTenantById(string $id): ?TenantInterface
    {
        // Similar logic - try different implementations
    }
}
```

## 🎯 **2. Strategy Pattern: For Database Switching**

### **The Problem It Solves**
Different packages have **radically different ways** to switch database connections:

```php
// Your current Spatie-based SafeTenantDatabaseSelector
public function switchToTenant(string $slug): void
{
    // Manual config manipulation
    config(['database.connections.tenant.database' => "tenant_{$slug}"]);
    DB::purge('tenant');
    DB::reconnect('tenant');
}

// Stancl/Tenancy approach
public function switchToTenant(string $slug): void
{
    // Automatic via tenancy initialization
    $tenant = \App\Models\Tenant::where('slug', $slug)->first();
    tenancy()->initialize($tenant); // Handles everything
}

// Custom approach (e.g., for testing)
public function switchToTenant(string $slug): void
{
    // Mock database for tests
    $this->useInMemoryDatabase("test_tenant_{$slug}");
}
```

### **When You Need Strategy Pattern**

**Scenario 1: Supporting Multiple Tenancy Packages Simultaneously**
```php
// During migration period - run both Spatie and Stancl tenants
$spatieStrategy = new SpatieSwitchStrategy();
$stanclStrategy = new StanclSwitchStrategy();

// Old tenants use Spatie
$spatieStrategy->switchTo($oldTenant);

// New tenants use Stancl  
$stanclStrategy->switchTo($newTenant);
```

**Scenario 2: Environment-Specific Switching**
```php
// Different strategies for different environments
$strategy = match(app()->environment()) {
    'testing' => new InMemorySwitchStrategy(),
    'local' => new LocalDevelopmentStrategy(),
    'production' => new ProductionSafeStrategy(),
    default => new DefaultSwitchStrategy(),
};

$strategy->switchTo($tenant);
```

**Scenario 3: Your TemplateProvisioningService Operations**
```php
// When applying templates to tenant databases
class TemplateProvisioningService
{
    public function __construct(
        private DatabaseSwitchStrategy $switchStrategy
    ) {}
    
    public function applyTemplate(TenantInterface $tenant, Template $template)
    {
        // Switch using the appropriate strategy
        $this->switchStrategy->switchTo($tenant);
        
        // Now run SQL on the correctly switched database
        DB::connection('tenant')->unprepared($template->sql);
    }
}
```

### **Strategy Pattern Implementation**
```php
// 1. Interface
interface DatabaseSwitchStrategy
{
    public function switchTo(TenantInterface $tenant): void;
}

// 2. Spatie Implementation
class SpatieSwitchStrategy implements DatabaseSwitchStrategy
{
    public function switchTo(TenantInterface $tenant): void
    {
        config(['database.connections.tenant.database' => $tenant->getDatabaseName()]);
        DB::purge('tenant');
        DB::reconnect('tenant');
        DB::connection('tenant')->getPdo(); // Verify connection
    }
}

// 3. Stancl Implementation  
class StanclSwitchStrategy implements DatabaseSwitchStrategy
{
    public function switchTo(TenantInterface $tenant): void
    {
        // Stancl tenant must be their model type
        if ($tenant instanceof \Stancl\Tenancy\Contracts\Tenant) {
            tenancy()->initialize($tenant);
        }
    }
}

// 4. Usage
$strategy = app()->environment('production') 
    ? new SpatieSwitchStrategy() 
    : new StanclSwitchStrategy();
    
$strategy->switchTo($tenant);
```

## 🔄 **How They Work Together**

Here's how these patterns complement each other in a complete abstraction:

```php
// Complete package-agnostic tenant operation
class TenantDataService
{
    public function __construct(
        private TenantContext $tenantContext,
        private DatabaseSwitchStrategy $switchStrategy
    ) {}
    
    public function getTenantAnalytics(string $tenantId): array
    {
        // 1. Identify the tenant (TenantContext)
        $tenant = $this->tenantContext->getTenantById($tenantId);
        
        // 2. Switch to its database (Strategy Pattern)
        $this->switchStrategy->switchTo($tenant);
        
        // 3. Perform tenant-specific operations
        return DB::connection('tenant')
            ->table('analytics')
            ->where('tenant_id', $tenant->getId())
            ->get()
            ->toArray();
    }
}
```

## 📋 **Decision Guide: Do You Need These Now?**

### **✅ You NEED TenantContext Service NOW if:**
1. **Multiple entry points** - Web, API, CLI, Queues all need tenant context
2. **Shared middleware/guards** - Authentication that works across packages
3. **Monitoring/logging** - You want consistent tenant context in logs
4. **Feature flags** - Tenant-specific feature toggles

### **✅ You NEED Strategy Pattern NOW if:**
1. **Already planning migration** - Will migrate soon and need parallel operation
2. **Complex testing requirements** - Need different DB strategies for tests
3. **Multiple database types** - Some tenants on MySQL, some on PostgreSQL
4. **Your SafeTenantDatabaseSelector** is becoming complex with conditional logic

### **🔄 You can WAIT if:**
1. **Only using Spatie** - No immediate migration plans
2. **Simple use cases** - Your `Tenant::current()` calls are minimal
3. **Database switching** is only in a few well-contained services
4. **No testing complexity** - All tests use the same database approach

## 🛠️ **Implementation Priority**

Based on your current system:

### **High Priority (Do Now):**
1. **TenantContext Service** - Low effort, high reward for code clarity
2. **Update your SafeTenantDatabaseSelector to use Strategy Pattern** - It's already doing strategy-like work

### **Medium Priority (Plan for):**
1. **Strategy Pattern for testing** - Makes tests more flexible
2. **Package detection in TenantContext** - For future compatibility

### **Low Priority (Consider Later):**
1. **Full parallel package support** - Only if migrating soon
2. **Complex multi-strategy systems** - Over-engineering unless needed

## 🎯 **Recommended Next Step**

**Start with a simple TenantContext service** - it's the least disruptive and gives immediate benefits:

```php
// Simple version to get started
namespace App\Services;

use App\Contracts\TenantInterface;

class TenantContext
{
    public function getCurrent(): ?TenantInterface
    {
        // Your current Spatie implementation
        if ($tenant = \App\Models\Tenant::current()) {
            return $tenant; // Already implements TenantInterface
        }
        
        return null;
    }
    
    public function ensureTenantContext(): void
    {
        if (!$this->getCurrent()) {
            throw new \Exception('No tenant context available');
        }
    }
}

// Usage in controllers
public function dashboard()
{
    $tenant = app(TenantContext::class)->getCurrent();
    return view('dashboard', ['tenant' => $tenant]);
}
```

**The Strategy Pattern for database switching can wait** until you actually need to support multiple tenancy packages or significantly different switching logic.

Would you like me to help implement either of these patterns in your codebase?