# **🛠️ TenantContext Service - Developer Guide**

## **📋 Table of Contents**
1. [Overview & Architecture](#overview--architecture)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Usage Examples](#usage-examples)
5. [Detection Methods](#detection-methods)
6. [Safety Guards Integration](#safety-guards-integration)
7. [Backward Compatibility](#backward-compatibility)
8. [Testing & Debugging](#testing--debugging)
9. [Troubleshooting](#troubleshooting)
10. [Extending & Customization](#extending--customization)

---

## **🏗️ Overview & Architecture**

### **What We Built**
A **package-agnostic tenant context service** that provides a unified interface for tenant identification and context management, working with ANY tenancy package (Spatie, Stancl, custom).

### **Why We Built It**
- **Decouple** from specific tenancy packages
- **Standardize** tenant context operations across the codebase
- **Enable future migrations** between tenancy solutions
- **Centralize safety guard** integration
- **Improve testability** with clean interfaces

### **Architecture Diagram**
```
┌─────────────────────────────────────────────────┐
│               Application Layer                  │
│  Controllers, Services, Middleware              │
└───────────────────┬─────────────────────────────┘
                    │ Uses TenantContextInterface
┌───────────────────▼─────────────────────────────┐
│          TenantContextService                    │
│  • Package detection & switching                │
│  • Safety guard integration                     │
│  • Context state management                     │
└─────────────┬───────────────────────────────────┘
              │ Implements
┌─────────────▼───────────────────────────────────┐
│        TenantContextInterface                   │
│  Contract defining tenant operations            │
└─────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│     Package-Specific Implementations            │
│  • SpatieTenantAdapter                          │
│  • StanclTenantAdapter (future)                 │
│  • Custom adapters                              │
└─────────────────────────────────────────────────┘
```

---

## **🚀 Quick Start**

### **Installation**
The service is automatically registered via `TenantContextServiceProvider`. No manual installation needed.

### **Basic Usage**
```php
// In any service, controller, or middleware
use App\Contracts\TenantContextInterface;

class SomeService
{
    public function __construct(
        private TenantContextInterface $tenantContext
    ) {}
    
    public function doSomething()
    {
        // Get current tenant
        $tenant = $this->tenantContext->getCurrentTenant();
        
        if ($tenant) {
            echo "Current tenant: " . $tenant->getName();
        }
    }
}
```

### **Service Container Aliases**
```php
// All work identically:
app(TenantContextInterface::class);
app('tenant.context');  // Legacy alias
app(\App\Services\TenantContextService::class);
```

---

## **⚙️ Configuration**

### **Configuration File**
`config/tenant-context.php`
```php
return [
    'tenant_model' => env('TENANT_CONTEXT_MODEL', App\Models\Tenant::class),
    
    'detection_methods' => [
        'spatie',    // Try Spatie package first
        'request',   // Then request-based detection
        'session',   // Then session/state
        'header',    // Then HTTP headers
    ],
    
    'enable_safety_guards' => true,  // Integrate with TenantProvisioningGuard
    
    'logging' => [
        'enabled' => true,
        'level' => 'debug',
    ],
    
    'cache' => [
        'enabled' => true,
        'ttl' => 300,  // 5 minutes
    ],
];
```

### **Environment Variables**
```env
TENANT_CONTEXT_MODEL=App\Models\Tenant
TENANT_CONTEXT_ENABLE_SAFETY_GUARDS=true
TENANT_CONTEXT_LOGGING_ENABLED=true
TENANT_CONTEXT_CACHE_ENABLED=true
```

### **Publishing Configuration**
```bash
php artisan vendor:publish --tag=tenant-context-config
```

---

## **📝 Usage Examples**

### **1. Getting Tenant Information**
```php
$context = app(TenantContextInterface::class);

// Basic tenant info
$tenant = $context->getCurrentTenant();
$tenantId = $context->getTenantId();
$tenantSlug = $context->getCurrentTenantSlug();  // Returns string
$tenantSlugObj = $context->getTenantSlug();      // Returns TenantSlug Value Object

// Context checking
if ($context->isTenantContextSet()) {
    // We're in tenant context
}

if ($context->isLandlordContext()) {
    // We're in landlord/central context
}
```

### **2. Context Switching**
```php
// Switch to tenant context (for background jobs, CLI commands)
$context->setCurrentTenant($tenant);
$context->switchToTenantContext();

// Switch back to landlord context
$context->switchToLandlordContext();

// Clear context (testing cleanup)
$context->clearTenantContext();
```

### **3. Safe Tenant Operations**
```php
// Execute code safely within tenant context
try {
    $context->ensureTenantContext();  // Throws if no tenant
    
    $tenant = $context->requireTenant();  // Guaranteed TenantInterface
    
    // All operations here are tenant-scoped
    $users = User::all();  // Automatically scoped to tenant
    
} catch (\App\Exceptions\TenantContextException $e) {
    // Handle missing tenant context
}
```

### **4. Finding Tenants**
```php
// Find tenant by ID (with safety guard validation)
$tenant = $context->getTenantById('tenant-uuid-123');

if ($tenant) {
    // Tenant found and validated by safety guards
}
```

---

## **🔍 Detection Methods**

### **Detection Order**
The service tries methods in configured order until a tenant is found:

### **1. Spatie Package Detection**
```php
// Tries: Spatie\Multitenancy\Models\Tenant::current()
// Falls back if: Package not installed or no current tenant
```

### **2. Request-Based Detection**
Extracts tenant from:
- **Subdomain**: `tenant.example.com`
- **URL Path**: `/tenant/dashboard`
- **Query Parameter**: `?tenant=slug`
- **HTTP Header**: `X-Tenant: slug`

### **3. Session/State Detection**
```php
// From session: session('tenant_id')
// From state: session('tenant_context.tenant_id')
```

### **4. Custom Detection**
Add your own detection method:
```php
// In TenantContextService:
private function detectFromCustomSource(): ?TenantInterface
{
    // Your custom logic
    return $this->getTenantById($customId);
}

// Update config:
'detection_methods' => ['spatie', 'custom', 'request']
```

---

## **🛡️ Safety Guards Integration**

### **What Are Safety Guards?**
System components that ensure tenant operations are safe:
- **`TenantProvisioningGuard`** - Validates tenant provisioning data
- **`SafeTenantDatabaseSelector`** - Safely switches database connections

### **Automatic Integration**
When `enable_safety_guards` is true:
```php
// getCurrentTenant() automatically:
1. Detects tenant using configured methods
2. Validates with TenantProvisioningGuard
3. Returns validated tenant or null

// getTenantById() automatically:
1. Finds tenant by ID
2. Validates with TenantProvisioningGuard  
3. Returns validated tenant or null

// switchToTenantContext() automatically:
1. Switches context flag
2. Calls SafeTenantDatabaseSelector to switch DB
```

### **Manual Safety Validation**
```php
// Validate a specific tenant
$isValid = $context->validateTenantWithSafetyGuards($tenant);
```

---

## **🔙 Backward Compatibility**

### **Legacy Method Support**
All original `TenantContext` methods are supported:

| Legacy Method | New Method | Notes |
|--------------|------------|-------|
| `getTenant()` | `getCurrentTenant()` | Alias |
| `setTenant($tenant)` | `setCurrentTenant($tenant)` | Alias |
| `isInTenantContext()` | `isTenantContextSet()` | Alias |
| `getTenantSlug()` | `getCurrentTenantSlug()` | Returns TenantSlug object |
| `clear()` | `clearTenantContext()` | Alias |

### **Migration Path**
```php
// Old code (still works):
$tenant = app('tenant.context')->getTenant();

// New code (recommended):
$tenant = app(TenantContextInterface::class)->getCurrentTenant();
```

---

## **🧪 Testing & Debugging**

### **Unit Testing**
```php
// tests/Unit/TenantContextServiceTest.php
class TenantContextServiceTest extends TestCase
{
    public function test_gets_current_tenant()
    {
        $mockTenant = Mockery::mock(TenantInterface::class);
        $service = new TenantContextService();
        
        $service->setCurrentTenant($mockTenant);
        
        $this->assertSame($mockTenant, $service->getCurrentTenant());
    }
}
```

### **Mocking for Tests**
```php
// Mock the interface
$mockContext = $this->mock(TenantContextInterface::class);
$mockContext->shouldReceive('getCurrentTenant')
    ->andReturn($mockTenant);

app()->instance(TenantContextInterface::class, $mockContext);
```

### **Integration Testing**
```php
// tests/Feature/TenantContextIntegrationTest.php
public function test_provisioning_with_tenant_context()
{
    // Set tenant context
    $context = app(TenantContextInterface::class);
    $context->setCurrentTenant($tenant);
    
    // Run provisioning job
    $job = new ProvisionTenantJob($tenant->id);
    $job->handle();
    
    // Assert tenant database created
    $this->assertDatabaseHas('tenants', [
        'id' => $tenant->id,
        'status' => 'provisioned'
    ]);
}
```

### **Debugging Commands**
```bash
# Check current tenant context
php artisan tinker
>>> app('tenant.context')->getCurrentTenant();

# List all detection methods
php artisan tinker  
>>> config('tenant-context.detection_methods');

# Test specific detection method
php artisan tinker
>>> $context = app('tenant.context');
>>> $context->detectSpatieTenant();

# Check safety guard integration
php artisan tinker
>>> $guard = app(TenantProvisioningGuard::class);
>>> $guard::validateProvisioningFlow();
```

---

## **🐛 Troubleshooting**

### **Common Issues & Solutions**

#### **1. "Class contains abstract method" Error**
**Problem**: Missing interface method implementation
**Solution**: 
```bash
# Check missing methods
php -r "
require 'vendor/autoload.php';
\$class = new ReflectionClass('App\Services\TenantContextService');
\$interface = new ReflectionClass('App\Contracts\TenantContextInterface');

foreach (\$interface->getMethods() as \$method) {
    if (!\$class->hasMethod(\$method->getName())) {
        echo 'Missing: ' . \$method->getName() . PHP_EOL;
    }
}
"
```

#### **2. Provisioning Fails After TenantContext Implementation**
**Problem**: Database connection conflicts
**Solution**:
```php
// Check validateProvisioningFlow() database check
php artisan tinker
>>> TenantProvisioningGuard::validateProvisioningFlow();

// Ensure provisioning runs in landlord context
// Add to ProvisionTenantJob:
protected function beforeHandle()
{
    app('tenant.context')->switchToLandlordContext();
}
```

#### **3. Wrong Tenant Slug Returned**
**Problem**: `getTenantSlug()` returns string instead of TenantSlug object
**Solution**:
```php
// Check TenantSlug::fromString() exists
php artisan tinker
>>> TenantSlug::fromString('test');

// Ensure method signature matches:
public function getTenantSlug(): ?\App\Contexts\TenantAuth\Domain\ValueObjects\TenantSlug
```

#### **4. Detection Methods Not Working**
**Debug steps**:
```bash
# Enable debug logging
TENANT_CONTEXT_LOGGING_ENABLED=true
TENANT_CONTEXT_LOGGING_LEVEL=debug

# Check logs
tail -f storage/logs/laravel.log | grep -i "tenant.*detect\|tenant.*context"

# Test each detection method
php artisan tinker
>>> $context = app('tenant.context');
>>> $context->detectSpatieTenant();      // Method 1
>>> $context->detectFromRequest();       // Method 2
>>> $context->detectFromSession();       // Method 3
```

#### **5. Safety Guard Validation Fails**
```bash
# Test guard validation directly
php artisan tinker
>>> $data = [
    'first_name' => 'Test',
    'last_name' => 'User',
    'admin_email' => 'test@example.com',
    'name' => 'Test Org',  # Note: accepts 'name' OR 'organization_name'
    'slug' => 'test-org'
];
>>> TenantProvisioningGuard::validateProvisioningData($data);

# Check guard method names
php artisan tinker
>>> $guard = new TenantProvisioningGuard();
>>> get_class_methods($guard);
```

### **Debugging Scripts**

#### **Comprehensive Health Check**
```bash
#!/bin/bash
# tenant-context-debug.sh

echo "=== TenantContext Health Check ==="

# 1. Service instantiation
echo "1. Testing service instantiation..."
php artisan tinker << 'EOF'
try {
    $context = app('tenant.context');
    echo "✅ Service: " . get_class($context) . PHP_EOL;
    
    if ($context instanceof App\Contracts\TenantContextInterface) {
        echo "✅ Implements TenantContextInterface" . PHP_EOL;
    }
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . PHP_EOL;
}
EOF

# 2. Interface compliance
echo -e "\n2. Checking interface compliance..."
php artisan tinker << 'EOF'
$missing = [];
$class = new ReflectionClass('App\Services\TenantContextService');
$interface = new ReflectionClass('App\Contracts\TenantContextInterface');

foreach ($interface->getMethods() as $method) {
    if (!$class->hasMethod($method->getName())) {
        $missing[] = $method->getName();
    }
}

if (empty($missing)) {
    echo "✅ All interface methods implemented" . PHP_EOL;
} else {
    echo "❌ Missing methods: " . implode(', ', $missing) . PHP_EOL;
}
EOF

# 3. Configuration check
echo -e "\n3. Checking configuration..."
php artisan tinker << 'EOF'
echo "Detection methods: " . implode(', ', config('tenant-context.detection_methods', [])) . PHP_EOL;
echo "Safety guards enabled: " . (config('tenant-context.enable_safety_guards') ? '✅ Yes' : '❌ No') . PHP_EOL;
echo "Logging enabled: " . (config('tenant-context.logging.enabled') ? '✅ Yes' : '❌ No') . PHP_EOL;
EOF

# 4. Tenant detection test
echo -e "\n4. Testing tenant detection..."
php artisan tinker << 'EOF'
$context = app('tenant.context');

// Test Spatie detection
if (class_exists('Spatie\Multitenancy\Models\Tenant')) {
    $spatieTenant = $context->detectSpatieTenant();
    echo "Spatie detection: " . ($spatieTenant ? "✅ Found" : "❌ Not found") . PHP_EOL;
} else {
    echo "Spatie package: ❌ Not installed" . PHP_EOL;
}

// Test getting current tenant
$current = $context->getCurrentTenant();
echo "Current tenant: " . ($current ? "✅ " . $current->getName() : "❌ None") . PHP_EOL;
EOF

echo -e "\n=== Health Check Complete ==="
```

#### **Provisioning Debug Script**
```bash
#!/bin/bash
# provisioning-debug.sh

TENANT_ID="c34003ce-b6fb-4646-a0cf-ad365253458a"

echo "=== Provisioning Debug ==="

# 1. Check tenant exists
echo "1. Checking tenant in landlord database..."
php artisan tinker << EOF
use App\Models\Tenant;
\$tenant = Tenant::find('$TENANT_ID');
if (\$tenant) {
    echo "✅ Tenant found: " . \$tenant->organization_name . PHP_EOL;
    echo "   Slug: " . \$tenant->slug . PHP_EOL;
    echo "   Database: " . (\$tenant->database ? \$tenant->database->getName() : 'null') . PHP_EOL;
} else {
    echo "❌ Tenant not found in landlord DB" . PHP_EOL;
}
EOF

# 2. Test safety guard validation
echo -e "\n2. Testing safety guard validation..."
php artisan tinker << 'EOF'
use App\Models\TenantApplication;
$app = TenantApplication::find('$TENANT_ID');

if ($app) {
    $data = [
        'first_name' => $app->contact_first_name,
        'last_name' => $app->contact_last_name,
        'admin_email' => $app->contact_email,
        'name' => $app->organization_name,
        'slug' => 'test-slug'  // Will be replaced in actual provisioning
    ];
    
    try {
        TenantProvisioningGuard::validateProvisioningData($data);
        echo "✅ Guard validation passes" . PHP_EOL;
    } catch (Exception $e) {
        echo "❌ Guard validation fails: " . $e->getMessage() . PHP_EOL;
    }
}
EOF

# 3. Test tenant context
echo -e "\n3. Testing tenant context..."
php artisan tinker << 'EOF'
$context = app('tenant.context');
echo "Current context: " . ($context->isTenantContextSet() ? "✅ Tenant" : "✅ Landlord") . PHP_EOL;

// Try to get tenant slug
$slug = $context->getTenantSlug();
if ($slug) {
    echo "TenantSlug object: ✅ " . get_class($slug) . PHP_EOL;
} else {
    echo "TenantSlug: ❌ null (no tenant context)" . PHP_EOL;
}
EOF

echo -e "\n=== Debug Complete ==="
```

---

## **🔧 Extending & Customization**

### **Adding New Detection Methods**
1. **Add method to `TenantContextService`:**
```php
private function detectFromCustomSource(): ?TenantInterface
{
    // Your detection logic
    $identifier = // get from somewhere
    return $this->getTenantById($identifier);
}
```

2. **Update configuration:**
```php
// config/tenant-context.php
'detection_methods' => ['spatie', 'custom', 'request']
```

### **Creating Package Adapters**
```php
namespace App\Adapters;

use App\Contracts\TenantInterface;

class StanclTenantAdapter implements TenantInterface
{
    public function __construct(private $stanclTenant) {}
    
    public function getId(): string
    {
        return (string) $this->stanclTenant->id;
    }
    
    public function getName(): string
    {
        return $this->stanclTenant->name;
    }
    
    // ... implement all TenantInterface methods
}
```

### **Customizing Safety Integration**
```php
// Extend TenantContextService
class CustomTenantContextService extends TenantContextService
{
    protected function validateWithTenantProvisioningGuard(TenantInterface $tenant): void
    {
        // Custom validation logic
        $this->customValidator->validate($tenant);
        
        // Call parent for default validation
        parent::validateWithTenantProvisioningGuard($tenant);
    }
}
```

### **Adding Caching Layer**
```php
// In TenantContextService:
private function getCachedTenant(string $id): ?TenantInterface
{
    if (!$this->cacheEnabled) {
        return null;
    }
    
    $key = $this->getCacheKey("tenant.{$id}");
    return Cache::get($key);
}

private function cacheTenant(string $id, TenantInterface $tenant): void
{
    if (!$this->cacheEnabled) {
        return;
    }
    
    $key = $this->getCacheKey("tenant.{$id}");
    Cache::put($key, $tenant, $this->cacheTtl);
}
```

---

## **📊 Monitoring & Metrics**

### **Key Metrics to Track**
```php
// In TenantContextService methods:
$this->logMetrics('tenant_context_switch', [
    'from' => $previousState,
    'to' => $this->getContextState(),
    'method' => __METHOD__
]);

// Track detection method hits
$this->logMetrics('detection_method_hit', [
    'method' => $detectionMethod,
    'success' => $tenantFound,
    'duration_ms' => $duration
]);
```

### **Logging Configuration**
```php
'logging' => [
    'enabled' => true,
    'level' => env('TENANT_CONTEXT_LOG_LEVEL', 'debug'),
    'channel' => env('TENANT_CONTEXT_LOG_CHANNEL', 'stack'),
    
    // Custom log context
    'include_context' => true,
    'include_caller' => true,
    'include_trace' => env('APP_DEBUG', false),
],
```

---

## **🎯 Best Practices**

### **Do's:**
✅ **Use the interface** (`TenantContextInterface`) in type hints
✅ **Check for null** when getting current tenant
✅ **Use `ensureTenantContext()`** for operations requiring tenant
✅ **Clear context** in tests with `clearTenantContext()`
✅ **Monitor detection method** performance in production

### **Don'ts:**
❌ **Don't assume** tenant context is always set
❌ **Don't hardcode** package-specific logic outside adapters
❌ **Don't bypass** safety guards in production
❌ **Don't cache** sensitive tenant data without TTL
❌ **Don't forget** to handle `TenantContextException`

### **Performance Tips:**
- **Enable caching** for frequently accessed tenants
- **Order detection methods** by likely success rate
- **Use `getTenantById()`** when ID is known (bypasses detection)
- **Batch operations** when switching contexts frequently

---

## **🔮 Future Enhancements**

### **Planned Features:**
1. **Multi-tenant operations** - Execute across multiple tenants
2. **Tenant context pooling** - Manage multiple concurrent contexts
3. **Advanced caching** - Redis clustering for high availability
4. **Health checks** - Automatic detection method validation
5. **Migration tools** - Package-to-package migration assistance

### **Integration Points:**
- **Observability** - OpenTelemetry integration
- **Queue systems** - Enhanced tenant context propagation
- **Event sourcing** - Tenant context in event metadata
- **API Gateway** - Header-based tenant routing

---

## **📞 Support & Resources**

### **Getting Help**
1. **Check logs**: `storage/logs/laravel.log` (filter: "tenant.context")
2. **Run debug script**: `./tenant-context-debug.sh`
3. **Review config**: `config/tenant-context.php`
4. **Check interface**: `app/Contracts/TenantContextInterface.php`

### **Common Gotchas**
- **Windows paths**: Check backslashes in config/logging
- **Cache issues**: Run `php artisan optimize:clear`
- **Queue workers**: Restart after configuration changes
- **Testing**: Always `clearTenantContext()` between tests

### **Documentation Updates**
When modifying the system:
1. Update this guide
2. Update inline PHPDoc comments
3. Update test cases
4. Update configuration examples

---

**Maintained by**: Platform Team  
**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: ✅ Production Ready