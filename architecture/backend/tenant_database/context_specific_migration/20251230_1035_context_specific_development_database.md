# 📋 **CONTEXT DEVELOPER PROMPT INSTRUCTIONS**

## 🚀 **FOR DEVELOPERS CREATING NEW CONTEXTS**

### **Quick Start:**
```bash
# 1. Create new context with proper structure
php artisan make:context {YourContext} --landlord --tenant --module

# 2. Navigate to context directory
cd app/Contexts/{YourContext}/

# 3. Create migrations in correct locations
php artisan make:migration create_{table}_table --path=Infrastructure/Database/Migrations/Tenant
php artisan make:migration create_global_config --path=Infrastructure/Database/Migrations/Landlord

# 4. Test installation
php artisan context:install {your_context} --dry-run
php artisan context:install {your_context} --tenant=test-tenant

# 5. Register as installable module (optional)
php artisan module:register {your_context}
```

---

## 📁 **CONTEXT STRUCTURE CONVENTIONS:**

### **File Structure (Auto-discovered):**
```
app/Contexts/{YourContext}/
├── Context.php                        ← OPTIONAL: Metadata class
├── Application/
│   ├── Services/                      ← Application services
│   ├── Commands/                      ← CQRS commands
│   └── Queries/                       ← CQRS queries
├── Domain/
│   ├── Models/                        ← Aggregates & entities
│   ├── ValueObjects/                  ← Value objects
│   ├── Events/                        ← Domain events
│   └── Ports/                         ← Interfaces (repositories, etc.)
└── Infrastructure/
    ├── Database/
    │   ├── Migrations/
    │   │   ├── landlord/              ← Landlord DB tables (global config)
    │   │   └── tenant/                ← Tenant DB tables (tenant data)
    │   └── Seeders/                   ← Optional data seeders
    ├── Routes/
    │   ├── api.php                    ← API routes
    │   └── web.php                    ← Web routes
    └── ServiceProviders/
        └── {YourContext}ServiceProvider.php
```

---

## 🎯 **DECISION GUIDE: WHERE TO PUT TABLES?**

### **Put in `landlord/` migrations when:**
```php
// ✅ Global configuration (all tenants share)
Schema::connection('landlord')->create('your_context_global_config', ...);

// ✅ Cross-tenant analytics/aggregates
Schema::connection('landlord')->create('your_context_usage_stats', ...);

// ✅ Module registry/metadata
Schema::connection('landlord')->create('your_context_licenses', ...);
```

### **Put in `tenant/` migrations when:**
```php
// ✅ Tenant-specific data
Schema::create('your_context_items', function ($table) {
    $table->foreignId('tenant_id')->constrained(); // REQUIRED
    // ... tenant-specific columns
});

// ✅ User-generated content
Schema::create('your_context_posts', function ($table) {
    $table->foreignId('tenant_id')->constrained();
    $table->foreignId('user_id')->constrained();
    // ... user data
});
```

---

## 📝 **OPTIONAL CONTEXT METADATA CLASS:**

```php
// app/Contexts/{YourContext}/Context.php
namespace App\Contexts\{YourContext};

class Context
{
    public static function getMetadata(): array
    {
        return [
            'displayName' => 'Your Display Name',
            'description' => 'Description of what this context does',
            'version' => '1.0.0',
            'requiresSubscription' => true, // or false
            'dependencies' => [
                'module_registry', // Other contexts needed
                'user_management',
            ],
            'defaultConfiguration' => [
                'max_items' => 100,
                'feature_enabled' => true,
            ],
        ];
    }
}
```

---

## 🔧 **DEVELOPMENT WORKFLOW:**

### **Phase 1: Scaffolding**
```bash
# Create context with everything needed
php artisan make:context Inventory \
  --landlord \           # Add landlord migration template
  --tenant \             # Add tenant migration template  
  --module               # Mark as installable module

# Output: Creates complete structure with examples
```

### **Phase 2: Database Design**
```bash
# Add landlord table (global config)
php artisan make:migration create_inventory_global_config \
  --path=app/Contexts/Inventory/Infrastructure/Database/Migrations/Landlord

# Add tenant tables (tenant data)
php artisan make:migration create_inventory_items \
  --path=app/Contexts/Inventory/Infrastructure/Database/Migrations/Tenant

php artisan make:migration create_inventory_categories \
  --path=app/Contexts/Inventory/Infrastructure/Database/Migrations/Tenant
```

### **Phase 3: Test Installation**
```bash
# Dry run - see what will be installed
php artisan context:install inventory --dry-run

# Test landlord installation
php artisan context:install inventory

# Test tenant installation  
php artisan context:install inventory --tenant=test-tenant

# Test with seeders
php artisan context:install inventory --tenant=test-tenant --seed
```

### **Phase 4: Register as Module (Optional)**
```bash
# Make available in module catalog
php artisan module:register inventory

# Install via ModuleRegistry API
curl -X POST /api/v1/platform/modules/inventory/install \
  -H "Authorization: Bearer {token}" \
  -d '{"tenant_id": "acme-corp"}'
```

---

## ⚠️ **IMPORTANT RULES:**

### **1. Tenant Isolation Rule:**
```php
// ALWAYS add tenant_id to tenant tables
Schema::create('your_table', function ($table) {
    $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
    // ... other columns
});
```

### **2. Landlord Naming Convention:**
```php
// Use {context_name}_{purpose} pattern
Schema::connection('landlord')->create('inventory_global_config', ...);
Schema::connection('landlord')->create('inventory_licenses', ...);
```

### **3. No Cross-Context Imports:**
```php
// ❌ DON'T import from other contexts directly
use App\Contexts\OtherContext\Models\OtherModel;

// ✅ DO define interfaces in Domain/Ports/
interface ExternalServiceInterface {
    public function getData(): array;
}

// ✅ Implementation in Infrastructure uses other contexts
```

---

## 🧪 **TESTING YOUR CONTEXT:**

### **Unit Tests:**
```php
// tests/Unit/Contexts/Inventory/Domain/Models/InventoryItemTest.php
class InventoryItemTest extends TestCase
{
    public function test_can_create_inventory_item(): void
    {
        $item = InventoryItem::create(...);
        $this->assertInstanceOf(InventoryItem::class, $item);
    }
}
```

### **Integration Tests:**
```php
// tests/Feature/Contexts/Inventory/InventoryApiTest.php
class InventoryApiTest extends TestCase
{
    public function test_tenant_can_view_inventory(): void
    {
        $this->actingAs($user)
            ->getJson('/api/v1/inventory/items')
            ->assertOk();
    }
}
```

### **Installation Tests:**
```php
// tests/Feature/Contexts/Platform/ContextInstallationTest.php
class ContextInstallationTest extends TestCase
{
    public function test_can_install_inventory_context(): void
    {
        $result = $this->artisan('context:install', ['context' => 'inventory']);
        $result->assertExitCode(0);
    }
}
```

---

## 🚨 **COMMON PITFALLS TO AVOID:**

### **❌ DON'T: Mix landlord/tenant logic**
```php
// ❌ Wrong
class InventoryService {
    public function getGlobalConfig() { /* landlord */ }
    public function getTenantItems() { /* tenant */ }
}

// ✅ Right  
class InventoryGlobalService { /* landlord only */ }
class InventoryTenantService { /* tenant only */ }
```

### **❌ DON'T: Hardcode database connections**
```php
// ❌ Wrong
DB::connection('landlord')->table('inventory_config')...

// ✅ Right - Use config or context
$connection = $this->isLandlordContext() ? 'landlord' : 'tenant';
```

### **❌ DON'T: Create circular dependencies**
```php
// If Inventory needs UserManagement:
// Inventory Context.php:
'dependencies' => ['user_management']

// UserManagement should NOT depend on Inventory
```

---

## 📚 **TEMPLATE EXAMPLES:**

### **Minimal Context (No Database):**
```bash
php artisan make:context Analytics --module
# No --landlord/--tenant flags = no database tables
```

### **Landlord-Only Context (Global Service):**
```bash
php artisan make:context LicenseManager --landlord --module
# Only landlord tables (global license management)
```

### **Tenant-Only Context (User-Facing):**
```bash
php artisan make:context Blog --tenant --module  
# Only tenant tables (blogs per tenant)
```

### **Full Context (Both Databases):**
```bash
php artisan make:context Ecommerce --landlord --tenant --module
# Global config + tenant-specific data
```

---

## 🔍 **VALIDATION COMMANDS:**

```bash
# Check context structure
php artisan context:validate {your_context}

# List all discovered contexts
php artisan context:list

# Show installation plan
php artisan context:plan {your_context} --tenant=example

# Check dependencies
php artisan context:dependencies {your_context}
```

---

## 🎯 **READY FOR PRODUCTION CHECKLIST:**

- [ ] ✅ All tenant tables have `tenant_id` foreign key
- [ ] ✅ Landlord tables use `{context}_{purpose}` naming
- [ ] ✅ No hardcoded database connections
- [ ] ✅ Context.php metadata complete (if needed)
- [ ] ✅ Dependencies declared in metadata
- [ ] ✅ Tested with `context:install --dry-run`
- [ ] ✅ Tested with actual tenant installation
- [ ] ✅ Registered as module (if needed)
- [ ] ✅ Documentation in README.md (optional)

---

## 💡 **PRO TIPS:**

1. **Start simple** - Create minimal context first, add features later
2. **Use dry-run** - Always check installation plan before running
3. **Test with real tenant** - Use `--tenant=test-tenant` during development
4. **Document decisions** - Add comments why tables go to landlord/tenant
5. **Follow hexagonal** - Keep domain pure, infrastructure separate

---

**Now build your context! The system will auto-discover and install it correctly.** 🚀