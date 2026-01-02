# 📋 **TUTORIAL: BootstrapSeeder.php - Module Registration Guide**

## 🎯 **OVERVIEW**

This tutorial explains how to **register new contexts/modules** with the ModuleRegistry catalog using BootstrapSeeder.php files. This is **REQUIRED** before any context can be installed via our Platform Context installation system.

---

## ❓ **WHY IS REGISTRATION NECESSARY?**

### **The Business Logic:**
The **ModuleRegistry** is our **central module catalog** - think of it as the "App Store" for our multi-tenant platform. Just like you can't install an app from an App Store that doesn't list it, you can't install a context that isn't registered in ModuleRegistry.

### **Architectural Reason:**
1. **Discovery & Metadata** - ModuleRegistry needs to know about all available modules
2. **Installation Tracking** - Tracks which tenants have which modules installed  
3. **Dependency Management** - Knows module relationships and requirements
4. **Subscription Enforcement** - Manages paid vs free modules
5. **Version Control** - Tracks installed versions for upgrades

### **Real-World Analogy:**
- **ModuleRegistry** = Apple App Store catalog
- **BootstrapSeeder** = Developer submitting app to App Store review
- **context:install** = User downloading app from App Store
- **tenant_modules table** = User's "Purchased Apps" list

---

## 📋 **TUTORIAL: Creating a BootstrapSeeder**

### **Step 1: Identify If Your Context Needs Registration**

**YES, register if:**
- ✅ It's a **foundational context** (TenantAuth, Membership, Finance)
- ✅ It will be **installed/uninstalled** dynamically
- ✅ It has **dependencies** on other contexts  
- ✅ It requires **subscription/payment**
- ✅ Tenants should be able to **choose to install it**

**NO, skip registration if:**
- ❌ It's **internal infrastructure only** (Platform context itself)
- ❌ It's **always installed** for all tenants
- ❌ It has **no database tables** (pure service)

### **Step 2: Create the BootstrapSeeder File**

**File Location:** `database/seeders/{ContextName}BootstrapSeeder.php`

```php
<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * {ContextName}BootstrapSeeder
 *
 * PURPOSE: Register {ContextName} in ModuleRegistry catalog
 * 
 * BUSINESS REASON: {Brief business justification}
 * 
 * PREREQUISITES:
 * - ModuleRegistry context must be installed first
 * - modules table must exist in landlord database
 *
 * USAGE:
 *   php artisan db:seed --class={ContextName}BootstrapSeeder --database=landlord
 *
 * WHEN TO RUN:
 *   - After ModuleRegistry installation
 *   - Before first tenant installation of this context
 *   - ONCE per platform lifetime
 */
final class {ContextName}BootstrapSeeder extends Seeder
{
    /**
     * Register {ContextName} in ModuleRegistry catalog
     */
    public function run(): void
    {
        $this->command->info('🚀 Bootstrapping {ContextName} into ModuleRegistry catalog...');

        // Convert context name to module name format
        // Platform uses PascalCase, ModuleRegistry uses snake_case
        $moduleName = $this->toSnakeCase('{ContextName}'); // e.g., "Inventory" → "inventory"

        // Check if already registered (idempotent operation)
        $exists = DB::connection('landlord')
            ->table('modules')
            ->where('name', $moduleName)
            ->exists();

        if ($exists) {
            $this->command->warn('⚠️  {ContextName} already exists in catalog - skipping');
            return;
        }

        // Insert into ModuleRegistry catalog
        DB::connection('landlord')->table('modules')->insert([
            'id' => Str::uuid()->toString(),
            'name' => $moduleName, // REQUIRED: snake_case version
            'display_name' => '{Human Readable Name}', // e.g., "Inventory Management"
            'description' => '{Clear business description of what this context does}',
            'version' => '1.0.0', // Initial version
            'namespace' => 'App\\Contexts\\{ContextName}',
            'migrations_path' => 'app/Contexts/{ContextName}/Infrastructure/Database/Migrations',
            'status' => 'ACTIVE', // or 'DRAFT', 'DEPRECATED'
            'requires_subscription' => true, // or false for free modules
            'configuration' => json_encode([
                // Module-specific default configuration
                'key_feature_enabled' => true,
                'default_limits' => ['items' => 1000],
            ]),
            'published_at' => now(), // When module became available
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->command->info('✅ {ContextName} successfully registered in catalog!');
        
        // Optional: Register dependencies if this module depends on others
        $this->registerDependencies($moduleName);
    }

    /**
     * Convert PascalCase to snake_case for ModuleRegistry
     */
    private function toSnakeCase(string $input): string
    {
        return strtolower(preg_replace('/([a-z])([A-Z])/', '$1_$2', $input));
    }

    /**
     * Register module dependencies in module_dependencies table
     */
    private function registerDependencies(string $moduleName): void
    {
        $dependencies = [
            // Add dependent module names here
            // 'module_registry', // If depends on ModuleRegistry
            // 'tenant_auth',     // If depends on TenantAuth
        ];

        foreach ($dependencies as $dependency) {
            DB::connection('landlord')->table('module_dependencies')->insertOrIgnore([
                'module_name' => $moduleName,
                'dependency_name' => $dependency,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
```

### **Step 3: Fill in the Template**

**For an "Inventory" context example:**

```php
// In InventoryBootstrapSeeder.php:

// Module metadata
'name' => 'inventory', // snake_case
'display_name' => 'Inventory Management',
'description' => 'Track products, stock levels, warehouses, and inventory movements across all tenant locations. Supports barcode scanning, stock alerts, and inventory audits.',
'requires_subscription' => true, // Paid feature
'configuration' => json_encode([
    'enable_barcode' => true,
    'default_warehouse_count' => 3,
    'low_stock_threshold' => 10,
]),

// Dependencies
private function registerDependencies(string $moduleName): void
{
    $dependencies = [
        'module_registry', // All modules depend on ModuleRegistry
        'tenant_auth',     // Needs authentication for user tracking
    ];
    // ...
}
```

### **Step 4: Run the Bootstrap Seeder**

```bash
# 1. Ensure ModuleRegistry is installed
php artisan context:install ModuleRegistry

# 2. Run your bootstrap seeder
php artisan db:seed --class=InventoryBootstrapSeeder --database=landlord

# Output should show:
# 🚀 Bootstrapping Inventory into ModuleRegistry catalog...
# ✅ Inventory successfully registered in catalog!
```

### **Step 5: Verify Registration**

```bash
# Check if module appears in catalog
php artisan tinker

>>> DB::connection('landlord')->table('modules')
>>>     ->where('name', 'inventory')
>>>     ->select('name', 'display_name', 'version', 'requires_subscription')
>>>     ->first();

# Should return:
# {
#   "name": "inventory",
#   "display_name": "Inventory Management", 
#   "version": "1.0.0",
#   "requires_subscription": true
# }
```

### **Step 6: Install the Context**

```bash
# Now installation will work!
php artisan context:install Inventory --tenant=acme-corp

# Output:
# 🚀 Installing Context: Inventory
# 📍 Target: Tenant 'acme-corp'
# ✅ Installation successful!
```

---

## 🏢 **BUSINESS CASE EXAMPLES**

### **Example 1: Inventory Management Module**
```php
// Business Justification:
"Tenants in manufacturing and retail need to track physical inventory.
This is a PREMIUM feature that generates $50/month per tenant.
Registration enables: 
- Discovery in module marketplace
- Subscription enforcement  
- Installation tracking
- Version management for updates"
```

### **Example 2: Calendar Module**
```php
// Business Justification:  
"All organizations need scheduling. This is a CORE feature included
in all plans. Registration enables:
- Automatic installation for new tenants
- Dependency management (needs TenantAuth for user calendars)
- Configuration defaults (working hours, timezones)"
```

### **Example 3: Analytics Dashboard**
```php
// Business Justification:
"Enterprise tenants need business intelligence. This is an ADD-ON
feature at $100/month. Registration enables:
- Upsell opportunity in admin panel
- Trial period management (14-day free trial)
- Usage tracking for billing"
```

---

## 📊 **REGISTRATION DECISION FLOWCHART**

```
┌─────────────────────────────────────┐
│    New Context Developed            │
└──────────────────┬──────────────────┘
                   │
          ┌────────▼─────────┐
          │ Will tenants     │
          │ install/uninstall│
          │ it dynamically?  │
          └────────┬─────────┘
                   │
        ┌──────────▼──────────┐
        │        YES          │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ Create              │
        │ BootstrapSeeder.php │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ Run seeder to       │
        │ register in catalog │
        └─────────────────────┘
```

---

## 🔧 **ADVANCED REGISTRATION SCENARIOS**

### **Scenario 1: Private/Internal Modules**
```php
// For modules only available to specific tenants
'status' => 'PRIVATE',
'allowed_tenants' => json_encode(['enterprise-client-1', 'partner-org']),
```

### **Scenario 2: Module with Multiple Editions**
```php
// Different configurations for different plans
'editions' => json_encode([
    'basic' => [
        'max_items' => 100,
        'reports' => false,
    ],
    'pro' => [
        'max_items' => 10000,
        'reports' => true,
    ],
]),
```

### **Scenario 3: Module with External Dependencies**
```php
// If module requires external services
'external_dependencies' => json_encode([
    'required_apis' => ['stripe_payments', 'shipping_calculator'],
    'required_permissions' => ['access_location', 'camera_access'],
]),
```

---

## 🚨 **COMMON MISTAKES TO AVOID**

### **Mistake 1: Wrong Naming Convention**
```php
// ❌ WRONG - Uses PascalCase
'name' => 'InventoryManagement',

// ✅ CORRECT - Uses snake_case  
'name' => 'inventory_management',
```

### **Mistake 2: Missing Dependencies**
```php
// ❌ WRONG - Forgets TenantAuth dependency
// Installation will fail when Inventory tries to access user data

// ✅ CORRECT - Declares all dependencies
$dependencies = ['module_registry', 'tenant_auth'];
```

### **Mistake 3: Incorrect Path**
```php
// ❌ WRONG - Wrong migrations path
'migrations_path' => 'database/migrations/inventory',

// ✅ CORRECT - Follows convention
'migrations_path' => 'app/Contexts/Inventory/Infrastructure/Database/Migrations',
```

### **Mistake 4: Running Multiple Times**
```php
// ✅ SOLUTION: Always check if exists first
if ($exists) {
    $this->command->warn('⚠️  Already exists - skipping');
    return; // Idempotent operation
}
```

---

## 📈 **BUSINESS VALUE SUMMARY**

### **For Platform Owners:**
1. **Revenue Control** - Manage paid vs free modules
2. **Feature Management** - Roll out features selectively
3. **Usage Analytics** - Track which modules are popular
4. **Update Management** - Push updates to specific modules

### **For Tenants:**
1. **Self-Service** - Choose and install needed features
2. **Cost Control** - Pay only for what they use
3. **Flexibility** - Add/remove features as business changes
4. **Transparency** - See all available options in catalog

### **For Developers:**
1. **Clear Integration** - Well-defined registration process
2. **Dependency Management** - Automatic handling of requirements
3. **Version Safety** - Prevent incompatible installations
4. **Discovery** - Modules automatically appear in marketplace

---

## 🏁 **QUICK REFERENCE CHECKLIST**

**Before creating BootstrapSeeder:**
- [ ] Module has `landlord/` and/or `tenant/` migration folders
- [ ] Module follows hexagonal architecture patterns
- [ ] Module has been tested independently

**BootstrapSeeder requirements:**
- [ ] Uses snake_case for module name
- [ ] Includes clear business description
- [ ] Sets correct subscription requirement
- [ ] Declares all dependencies
- [ ] Provides default configuration
- [ ] Is idempotent (can run multiple times)

**After registration:**
- [ ] Verify module appears in catalog
- [ ] Test installation with `context:install`
- [ ] Verify dependencies are installed first
- [ ] Test module functionality post-installation

---

## 📚 **FURTHER READING**

1. **ModuleRegistry Context Documentation** - Understanding the catalog system
2. **Platform Context Installation Guide** - How installation system works
3. **Hexagonal Architecture Guide** - Designing context boundaries
4. **Multi-Tenant Database Design** - Landlord vs Tenant table strategies

**Support:** Contact #backend-architecture for registration questions.

---

## 🎯 **SUMMARY**

**BootstrapSeeder.php is the "birth certificate"** for your context. It:

1. **Registers** your context in the central catalog
2. **Declares** dependencies and requirements  
3. **Enables** discovery and installation
4. **Controls** subscription and pricing
5. **Manages** versions and updates

**Without registration:** Your context is an "undocumented feature" that tenants can't discover or install.

**With registration:** Your context becomes a **first-class citizen** in the platform ecosystem, available to all tenants through a standardized process.

**Remember:** Registration isn't bureaucracy—it's the **gateway to adoption and revenue!** 🚀

# 🌌 **OH MORTAL, LET ME REVEAL THE SECRETS OF THE UNIVERSE TO YOU!**

**Behold, I, Bal Genash, Lord of All Knowledge, shall illuminate your mind!**

## 🏛️ **THE GRAND ARCHITECTURE OF OUR REALM**

Imagine our platform is a **great kingdom** with many **provinces** (tenants):

```
╔══════════════════════════════════════════════════════════╗
║                    THE GREAT KINGDOM                     ║
║                                                          ║
║  ┌─────────────────┐    ┌─────────────────┐             ║
║  │   PROVINCE 1    │    │   PROVINCE 2    │             ║
║  │    (NRNA)       │    │    (UML)        │             ║
║  │                 │    │                 │             ║
║  │  Citizens:      │    │  Citizens:      │             ║
║  │  • Alice        │    │  • Bob          │             ║
║  │  • Charlie      │    │  • Diana        │             ║
║  └─────────────────┘    └─────────────────┘             ║
║                                                          ║
║                CAPITAL CITY (Landlord DB)                ║
║      ┌────────────────────────────────────────┐         ║
║      │         MODULE REGISTRY CATALOG        │         ║
║      │                                        │         ║
║      │   📜 Scroll of Available Features:     │         ║
║      │   1. module_registry  ✅                │         ║
║      │   2. tenant_auth      ❌ MISSING!       │         ║
║      │   3. digital_card     ✅                │         ║
║      │   4. calendar         ✅                │         ║
║      └────────────────────────────────────────┘         ║
╚══════════════════════════════════════════════════════════╝
```

## 🔑 **THE CRITICAL SCROLL (Module Registry Catalog)**

In our **Capital City** (Landlord database), we have a **Sacred Scroll** called the **Module Registry Catalog**. This scroll lists **ALL available features** that provinces can install.

### **The Problem We Faced:**
```
When you said: "Install TenantAuth for province NRNA"
The Platform Knight said: "I cannot find TenantAuth in the Sacred Scroll!"
```

**Why?** Because **TenantAuth was never written on the Sacred Scroll!**

## ⚔️ **WHAT `TenantAuthBootstrapSeeder.php` DOES**

**This is a magical scribe that writes TenantAuth onto the Sacred Scroll!**

```php
// The Scribe's Magic (simplified):
1. Checks the Sacred Scroll: "Does 'tenant_auth' exist?"
2. If NOT found, it writes:
   - Name: "tenant_auth"
   - Display Name: "Tenant Auth" 
   - Description: "Authentication system for provinces"
   - Version: "1.0.0"
3. Now the Sacred Scroll contains TenantAuth!
```

## 🛡️ **WHAT IS A "FOUNDATIONAL CONTEXT"?**

**Foundational Contexts** are **essential building blocks** of our kingdom:

1. **ModuleRegistry** - The **Scroll Keeper** (manages the catalog itself)
2. **TenantAuth** - The **Gatekeeper** (controls who enters each province)
3. **Platform** - The **Royal Architect** (builds everything)

**Paradox:** The **Gatekeeper (TenantAuth)** needs to be in the **Scroll Keeper's list (ModuleRegistry)** before it can be installed... but it's not on the list yet!

**Chicken-Egg Problem:** 
- Gatekeeper needs to be listed to be installed
- But Gatekeeper can't be listed until... it exists somehow!

## ✨ **THE BOOTSTRAP MAGIC**

```
BEFORE: 
Sacred Scroll: [module_registry, digital_card, calendar]
Command: "Install tenant_auth" → ❌ FAILS! Not on scroll!

AFTER Bootstrap Scribe:
Sacred Scroll: [module_registry, tenant_auth, digital_card, calendar]  
Command: "Install tenant_auth" → ✅ SUCCESS! Found on scroll!
```

## 🧙 **HOW TO WIELD THIS POWER:**

```bash
# 1. Summon the Bootstrap Scribe
php artisan db:seed --class=TenantAuthBootstrapSeeder --database=landlord

# The Scribe whispers: "✅ TenantAuth successfully bootstrapped!"

# 2. Now command the Platform Knight
php artisan context:install TenantAuth --tenant=nrna

# The Knight reads the Sacred Scroll, finds TenantAuth, and installs it!
```

## 📜 **THE FULL RITUAL FOR OUR KINGDOM:**

```bash
# Step 1: Create the Sacred Scroll (modules table)
php artisan migrate --database=landlord

# Step 2: Write ModuleRegistry onto the Scroll
php artisan db:seed --class=ModuleRegistryBootstrapSeeder --database=landlord

# Step 3: Write TenantAuth onto the Scroll  
php artisan db:seed --class=TenantAuthBootstrapSeeder --database=landlord

# Step 4: Install foundational contexts
php artisan context:install ModuleRegistry --all-tenants
php artisan context:install TenantAuth --tenant=nrna
php artisan context:install TenantAuth --tenant=uml
```

## 🎯 **THE WISDOM OF BAL GENASH:**

**Remember, mortal:** Every foundational feature must be:
1. **Written on the Sacred Scroll** (ModuleRegistry catalog)
2. **Before it can be installed** by the Platform Knight
3. **Using a Bootstrap Scribe** for each missing feature

**The pattern:** `BootstrapSeeder.php` → writes to catalog → `context:install` works!

**Now go forth and bootstrap your kingdom!** 🏰
