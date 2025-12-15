# 🔄 **Migration from Spatie Multi-tenancy to Stancl/Tenancy: Comprehensive Analysis**

## **📊 Quick Comparison Table**

| Aspect | Spatie Multi-tenancy | Stancl/Tenancy |
|--------|-------------------|----------------|
| **Architecture** | Multi-database focused | Multi-database + Single-database |
| **Bootstrapping** | Manual tenant initialization | Automatic, event-driven |
| **Database** | Separate connections per tenant | Tenant-aware query scoping |
| **Storage** | Separate storage paths | Tenant-aware storage |
| **Cache** | Manual tenant scoping | Automatic cache isolation |
| **Learning Curve** | Steeper | More intuitive |
| **Community** | Smaller, established | Growing, active |
| **Job Tenancy** | Manual handling | Automatic |

## **✅ ADVANTAGES of Switching to Stancl/Tenancy**

### **1. Automatic Tenancy (BIGGEST WIN)**
```php
// With Stancl: Automatic tenant awareness
tenancy()->initialize($tenant); // Everything after this is tenant-scoped

// Jobs, commands, queues automatically tenant-aware
Artisan::call('some:command'); // Runs in current tenant context
```

### **2. Better Database Architecture**
```php
// Single database with automatic scoping
// No need for separate connections
$users = User::all(); // Automatically scoped to current tenant

// OR multi-database if you prefer
'central' => [/* landlord DB */],
'tenant' => [/* tenant DBs */]
```

### **3. Built-in Tenant Resources**
```php
// Automatic asset/storage isolation
Storage::disk('tenant')->put('file.txt', 'content');
// Saves to: storage/tenants/tenant-id/file.txt

// Cache isolation out of the box
Cache::put('key', 'value'); // Automatically tenant-scoped
```

### **4. Job and Queue Tenancy**
```php
// Jobs automatically run in tenant context
class ProcessElectionData implements ShouldQueue {
    use TenancyAware;
    
    public function handle() {
        // Automatically knows which tenant
        $tenant = Tenant::current();
    }
}
```

### **5. Seamless Development Experience**
```php
// Easy switching in development
tenancy()->initialize($tenant1);
// Do stuff for tenant1

tenancy()->initialize($tenant2); 
// Now working for tenant2
```

## **❌ DISADVANTAGES & Migration Challenges**

### **1. Migration Effort**
```php
// Your current Spatie setup:
$tenant = Tenant::current(); // Spatie's way
$tenant->run(function () {
    // Tenant code
});

// Stancl way:
tenancy()->initialize($tenant);
// Everything after is tenant-scoped automatically
```

**Migration tasks:**
1. Database structure changes
2. Tenant model refactoring
3. Job/queue updates
4. Storage path updates
5. Cache implementation changes

### **2. Different Paradigm**
```php
// Spatie: Explicit tenant execution
$tenant->run(function () {
    User::create([...]);
});

// Stancl: Implicit tenant context
tenancy()->initialize($tenant);
User::create([...]); // Automatically gets tenant_id
```

### **3. Cache and Session Handling**
- Stancl has different cache isolation
- Session handling differs
- May require frontend adjustments

### **4. Package Dependencies**
- Different set of dependencies
- Potential conflicts with existing packages
- Need to update all tenant-related code

## **🔄 Migration Strategy**

### **Phase 1: Assessment**
```php
// Analyze current Spatie usage:
1. Database: Multi-db or single-db?
2. Jobs: How are jobs made tenant-aware?
3. Storage: How is tenant storage handled?
4. Cache: Current tenant cache implementation
5. Middleware: Current tenant identification
```

### **Phase 2: Parallel Run (Recommended)**
```env
# .env
TENANCY_PACKAGE=spatie # or 'stancl'
```

```php
// TenantService abstraction
interface TenantService {
    public function initialize($tenant);
    public function current();
    public function run($tenant, callable $callback);
}

// Implement both
class SpatieTenantService implements TenantService { ... }
class StanclTenantService implements TenantService { ... }
```

### **Phase 3: Database Migration**
```php
// Stancl prefers:
// Option A: Single database with tenant_id on all tables
// Option B: Multi-database with separate connections

// Your RBAC system (tenant_id on roles/permissions) 
// works perfectly with Stancl's single-database approach
```

### **Phase 4: Critical Component Migration**

#### **RBAC System Migration:**
```php
// Your current Spatie-based RBAC:
class TenantRole extends SpatieRole {
    protected static function booted() {
        static::addGlobalScope('tenant', function ($builder) {
            $tenant = Tenant::current(); // Spatie
            // ... scope logic
        });
    }
}

// Stancl migration:
class TenantRole extends SpatieRole {
    protected static function booted() {
        static::addGlobalScope('tenant', function ($builder) {
            $tenant = \Stancl\Tenancy\Facades\Tenancy::current(); // Stancl
            // Same logic, different facade
        });
    }
}
```

#### **Permission Cache Fix (Already Identified):**
```php
// This fix works for BOTH packages
app(PermissionRegistrar::class)->setCacheKey(
    'spatie.permission.cache.tenant.' . (tenant()?->id ?? 'global')
);
// Just need to update the `tenant()` helper
```

## **📈 Stancl/Tenancy Features Beneficial for Nepali Political Parties**

### **1. Tenant-specific Configurations**
```php
// Each party can have different configurations
tenancy()->initialize($nepaliCongress);
config(['election.rules' => $nepaliCongress->election_rules]);

tenancy()->initialize($cpnUml);
config(['election.rules' => $cpnUml->election_rules]);
```

### **2. Built-in Domains/Subdomains**
```php
// Perfect for party-specific domains
'main_domains' => ['politicalapp.gov.np'],
'central_domains' => ['admin.politicalapp.gov.np'],

// Each party gets:
'nepalicongress.politicalapp.gov.np'
'cpnuml.politicalapp.gov.np'
```

### **3. Automatic Tenant Identification**
```php
// Based on domain, subdomain, path, or header
'tenant' => NepaliCongress::where('domain', $request->host())->first();
// Automatic for web and API
```

### **4. Better Testing Support**
```php
// Easy tenant-scoped testing
tenancy()->initialize($testParty);
$this->post('/api/members', $data); // Automatically in tenant context
```

## **🛑 Considerations Before Switching**

### **1. Is Your Current Setup Working?**
- If Spatie multi-tenancy is working well
- No major pain points
- Team is comfortable with current implementation

**Then:** Consider sticking with Spatie and just fix the permission cache issue.

### **2. Project Timeline**
- Migration will take 2-4 weeks for medium app
- Requires thorough testing
- May need to pause feature development

### **3. Team Familiarity**
- Does team know Stancl/Tenancy?
- Learning curve for new paradigm
- Documentation and community support

## **🎯 RECOMMENDATION**

### **For Your Nepali Political Party System:**

```markdown
## **SHORT-TERM (Next 2 weeks):**
1. ✅ **FIX PERMISSION CACHE** in current Spatie setup (CRITICAL)
2. ✅ Implement global scopes for RBAC models
3. ✅ Create Nepali-specific policies
4. ✅ Enhance template system with tenant-aware seeding

## **MEDIUM-TERM (Next 1-2 months):**
1. 🟡 **Create abstraction layer** for tenancy
2. 🟡 Run Stancl in parallel for testing
3. 🟡 Migrate one module at a time
4. 🟡 Conduct performance comparison

## **LONG-TERM (If needed):**
1. 🔴 Full migration to Stancl if benefits outweigh costs
2. 🔴 Only if current setup has limitations for future features
```

## **🚨 IMMEDIATE ACTION vs MIGRATION**

### **Fix Current Spatie Issues FIRST:**
```php
// Do this NOW (from your analysis):
1. Add global scopes to TenantRole/TenantPermission ✓
2. Implement tenant-aware permission cache ✓
3. Create Nepali-specific policies ✓
4. Fix template seeding ✓

// This solves 90% of your immediate needs
// Without migration overhead
```

### **Migration Decision Matrix:**
```
YES, migrate to Stancl if:
- You need better domain/subdomain handling
- Automatic job tenancy is critical
- You're experiencing Spatie limitations
- Starting new major version anyway

NO, stay with Spatie if:
- Current setup works with fixes
- Timeline is tight
- Team knows Spatie well
- Stability is priority
```

## **🔧 Hybrid Approach (Recommended)**

```php
// Implement the BEST of both:
1. Keep Spatie as base
2. Adopt Stancl patterns where helpful
3. Create unified TenantService

class UnifiedTenantService {
    private $package; // 'spatie' or 'stancl'
    
    public function initialize($tenant) {
        if ($this->package === 'spatie') {
            Tenant::current() = $tenant;
            $tenant->run(function () use ($tenant) {
                // Spatie way
            });
        } else {
            tenancy()->initialize($tenant);
            // Stancl way
        }
    }
    
    public function switchToStancl() {
        // Gradual migration
        $this->package = 'stancl';
    }
}
```

## **💡 Final Verdict**

**Based on your context (Nepali political parties with template-based RBAC):**

1. **Immediately:** Fix the permission cache and global scope issues in your current Spatie setup
2. **Medium-term:** Create abstraction layer to reduce vendor lock-in
3. **Evaluate:** Try Stancl for a small, non-critical module
4. **Decide:** Only migrate fully if Stancl provides clear benefits for YOUR specific use case

**Your RBAC architecture (tenant_id on roles/permissions) works with BOTH packages.** The critical fixes identified in your analysis should be implemented FIRST, regardless of which package you use.

Would you like me to help you implement the permission cache fix and global scopes in your current Spatie setup first? That's the most urgent need.