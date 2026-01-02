## **🎯 COMPLETE DEVELOPER GUIDE: CONTEXT REGISTRATION**

# **📚 Module Registry & Context Registration Guide**

## **🏗️ ARCHITECTURE OVERVIEW**

```
Platform Context System
├── ModuleRegistry (Catalog)
│   ├── modules (landlord table, UUID primary key)
│   └── tenant_modules (tracks installed modules per tenant)
│
├── Context Discovery
│   ├── Scans: app/Contexts/{Name}/...
│   ├── Detects: Infrastructure/Database/Migrations/
│   └── Registers: In ModuleRegistry catalog
│
└── Context Installation
    ├── Landlord Migrations (shared)
    ├── Tenant Migrations (per-tenant)
    └── Service Providers (optional)
```

## **🔧 STEP 1: UNDERSTANDING MODULE REGISTRY**

### **Database Schema:**
```sql
-- Landlord database table
CREATE TABLE modules (
    id UUID PRIMARY KEY,                    -- NOT auto-increment!
    name VARCHAR(50) NOT NULL UNIQUE,      -- Context name (geography, membership)
    display_name VARCHAR(100) NOT NULL,    -- Human-readable name
    version VARCHAR(20) NOT NULL,          -- Semantic versioning
    description TEXT NOT NULL,             -- What this module does
    namespace VARCHAR(100) NOT NULL,       -- PHP namespace
    migrations_path VARCHAR(255),          -- Path to migrations
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    requires_subscription BOOLEAN NOT NULL DEFAULT FALSE,
    configuration JSONB,                    -- Module configuration
    published_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### **🎯 WHY UUID, NOT AUTO-INCREMENT?**

#### **Reason 1: Distributed Systems Ready**
```php
// UUID can be generated anywhere, anytime
$uuid = Str::uuid()->toString();  // 8df141ac-c391-4f60-a428-cf36f7e0b77a

// Auto-increment requires database round-trip
$id = DB::table('modules')->insertGetId([...]);  // Needs DB connection
```

#### **Reason 2: No ID Conflicts**
- Multiple developers can seed locally
- Staging/production can have same IDs
- Database merges are safe

#### **Reason 3: Security**
- UUIDs don't reveal sequence (user 1, user 2, etc.)
- Harder to guess/scan
- Better for public APIs

#### **Reason 4: Future Scalability**
- Ready for database sharding
- Works with microservices
- Consistent across distributed databases

## **🚀 STEP 2: CREATING A CONTEXT BOOTSTRAP SEEDER**

### **Template: `{Context}BootstrapSeeder.php`**
```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * {Context} Module Bootstrap Seeder
 * 
 * PURPOSE: Register {Context} in ModuleRegistry catalog
 * LOCATION: database/seeders/{Context}BootstrapSeeder.php
 * RUN: php artisan db:seed --class={Context}BootstrapSeeder --database=landlord
 * 
 * WHY NEEDED: Platform Context system discovers contexts but needs
 *             them registered in catalog for installation.
 * 
 * @package Database\Seeders
 */
class {Context}BootstrapSeeder extends Seeder
{
    /**
     * Bootstrap {Context} module in ModuleRegistry.
     *
     * @return void
     */
    public function run(): void
    {
        Log::info('🔧 Bootstrapping {Context} module in ModuleRegistry');
        
        // 1. Check if already exists (idempotent)
        $exists = DB::connection('landlord')
            ->table('modules')
            ->where('name', '{context}')  // lowercase
            ->exists();
        
        if ($exists) {
            Log::info('✅ {Context} module already registered');
            echo "✅ {Context} module already registered\n";
            return;
        }
        
        // 2. Generate UUID (CRITICAL: id is UUID, not auto-increment)
        $moduleId = Str::uuid()->toString();
        
        // 3. Prepare insert data with ALL required NOT NULL columns
        $insertData = [
            // REQUIRED: UUID for primary key
            'id' => $moduleId,
            
            // REQUIRED NOT NULL columns:
            'name' => '{context}',                    // lowercase
            'display_name' => '{Context} Module',     // Human readable
            'version' => '1.0.0',                     // Semantic version
            'description' => 'Brief description of what this module does',
            'namespace' => 'App\\Contexts\\{Context}', // PHP namespace
            
            // REQUIRED NOT NULL with defaults:
            'status' => 'ACTIVE',                     // ACTIVE, INACTIVE, DEPRECATED
            'requires_subscription' => false,         // true for premium modules
            
            // OPTIONAL columns:
            'migrations_path' => 'Infrastructure/Database/Migrations/Tenant/',
            'configuration' => json_encode([
                'some_setting' => 'default_value',
            ]),
            
            // Timestamps (auto-managed but good to include)
            'created_at' => now(),
            'updated_at' => now(),
        ];
        
        // 4. Insert into ModuleRegistry
        DB::connection('landlord')
            ->table('modules')
            ->insert($insertData);
        
        // 5. Log and output success
        Log::info('✅ {Context} module registered', [
            'module_id' => $moduleId,
            'name' => '{context}',
            'status' => 'active',
        ]);
        
        echo "✅ {Context} module registered in ModuleRegistry\n";
        echo "   ID: {$moduleId}\n";
        echo "   Name: {context}\n";
        echo "   Namespace: App\\Contexts\\{Context}\n";
        echo "   Status: ACTIVE\n\n";
        
        echo "🎯 Next Steps:\n";
        echo "   1. Verify: php artisan context:list\n";
        echo "   2. Install: php artisan context:install {Context} --tenant=<slug>\n";
        echo "   3. Test: Verify migrations run correctly\n";
    }
}
```

## **📝 STEP 3: REAL-WORLD EXAMPLES**

### **Example 1: Membership Module (Core)**
```php
// database/seeders/MembershipBootstrapSeeder.php
public function run(): void
{
    // Check exists...
    
    $moduleId = Str::uuid()->toString();
    
    DB::connection('landlord')->table('modules')->insert([
        'id' => $moduleId,
        'name' => 'membership',
        'display_name' => 'Membership Module',
        'version' => '1.0.0',
        'description' => 'Member management for political parties',
        'namespace' => 'App\\Contexts\\Membership',
        'status' => 'ACTIVE',
        'requires_subscription' => false,
        'migrations_path' => 'Infrastructure/Database/Migrations/Tenant/',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    
    // ... success output
}
```

### **Example 2: Geography Module (Optional)**
```php
// database/seeders/GeographyBootstrapSeeder.php (what we just created)
public function run(): void
{
    // Check exists...
    
    $moduleId = Str::uuid()->toString();
    
    DB::connection('landlord')->table('modules')->insert([
        'id' => $moduleId,
        'name' => 'geography',
        'display_name' => 'Geography Module',
        'version' => '1.0.0',
        'description' => 'Geographic hierarchy with Nepal units + custom party units',
        'namespace' => 'App\\Contexts\\Geography',
        'status' => 'ACTIVE',
        'requires_subscription' => false,  // Can be true for premium features
        'migrations_path' => 'Infrastructure/Database/Migrations/Tenant/',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    
    // ... success output
}
```

### **Example 3: Election Module (Premium)**
```php
// database/seeders/ElectionBootstrapSeeder.php
public function run(): void
{
    // Check exists...
    
    $moduleId = Str::uuid()->toString();
    
    DB::connection('landlord')->table('modules')->insert([
        'id' => $moduleId,
        'name' => 'election',
        'display_name' => 'Election Module',
        'version' => '1.0.0',
        'description' => 'Election management with candidate tracking',
        'namespace' => 'App\\Contexts\\Election',
        'status' => 'ACTIVE',
        'requires_subscription' => true,  // PREMIUM feature!
        'migrations_path' => 'Infrastructure/Database/Migrations/Tenant/',
        'configuration' => json_encode([
            'max_candidates' => 100,
            'voting_methods' => ['first_past_post', 'ranked_choice'],
        ]),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    
    // ... success output
}
```

## **🔍 STEP 4: VERIFICATION WORKFLOW**

### **Check Registration:**
```bash
# 1. Run the seeder
php artisan db:seed --class=YourContextBootstrapSeeder --database=landlord

# 2. Verify in catalog
php artisan context:list
php artisan context:list YourContext --detailed

# 3. Check database directly
php artisan tinker << 'EOF'
$module = DB::connection('landlord')
    ->table('modules')
    ->where('name', 'yourcontext')
    ->first();
    
if ($module) {
    echo "✅ Registered:\n";
    echo "ID: {$module->id}\n";
    echo "Name: {$module->name}\n";
    echo "Namespace: {$module->namespace}\n";
    echo "Status: {$module->status}\n";
}
EOF
```

### **Test Installation:**
```bash
# 1. Dry-run (see what would happen)
php artisan context:install YourContext --tenant=test-tenant --dry-run

# 2. Actual installation
php artisan context:install YourContext --tenant=test-tenant

# 3. Verify installation
php artisan tinker << 'EOF'
$installed = DB::connection('landlord')
    ->table('tenant_modules')
    ->join('modules', 'tenant_modules.module_id', '=', 'modules.id')
    ->where('modules.name', 'yourcontext')
    ->where('tenant_modules.tenant_slug', 'test-tenant')
    ->exists();
    
echo $installed ? '✅ Installed' : '❌ Not installed';
EOF
```

## **🚨 COMMON PITFALLS & SOLUTIONS**

### **Pitfall 1: Missing UUID**
```php
// WRONG: No ID provided
DB::table('modules')->insert([
    'name' => 'geography',  // ❌ ERROR: id is NOT NULL
]);

// RIGHT: Generate UUID
DB::table('modules')->insert([
    'id' => Str::uuid()->toString(),  // ✅
    'name' => 'geography',
]);
```

### **Pitfall 2: Missing Required Columns**
```php
// WRONG: Missing NOT NULL columns
DB::table('modules')->insert([
    'id' => $uuid,
    'name' => 'geography',
    // ❌ Missing: display_name, version, description, namespace
]);

// RIGHT: All NOT NULL columns included
DB::table('modules')->insert([
    'id' => $uuid,
    'name' => 'geography',
    'display_name' => 'Geography Module',  // ✅
    'version' => '1.0.0',                  // ✅
    'description' => '...',                // ✅
    'namespace' => 'App\\Contexts\\Geography', // ✅
    'status' => 'ACTIVE',                  // ✅
    'requires_subscription' => false,      // ✅
]);
```

### **Pitfall 3: Wrong Namespace Case**
```php
// WRONG: Wrong case
'namespace' => 'app\contexts\geography',  // ❌ Lowercase

// RIGHT: Proper namespace case
'namespace' => 'App\\Contexts\\Geography',  // ✅
```

### **Pitfall 4: Forgetting to Run Seeder**
```bash
# WRONG: Context exists but not registered
php artisan context:install Geography --tenant=test
# ❌ ERROR: Module not found in catalog

# RIGHT: Run seeder first
php artisan db:seed --class=GeographyBootstrapSeeder --database=landlord
php artisan context:install Geography --tenant=test
# ✅ SUCCESS
```

## **🎯 STEP 5: BEST PRACTICES**

### **1. Always Make Seeders Idempotent**
```php
// Always check if exists first
if (DB::table('modules')->where('name', 'yourcontext')->exists()) {
    return;  // Skip if already registered
}
```

### **2. Use Proper Logging**
```php
Log::info('Bootstrapping module', ['module' => 'yourcontext']);
// Helps debugging in production
```

### **3. Include Helpful Output**
```php
echo "✅ Module registered\n";
echo "🎯 Next steps: php artisan context:list\n";
// Guides next developer
```

### **4. Version Your Modules**
```php
'version' => '1.0.0',  // Semantic versioning
// Allows upgrades/migrations later
```

### **5. Set Proper Subscription Flags**
```php
'requires_subscription' => false,  // Free module
'requires_subscription' => true,   // Premium module
// Enables monetization
```

## **📊 MODULE CATALOG MANAGEMENT**

### **List All Modules:**
```bash
# CLI
php artisan context:list
php artisan context:list --detailed

# Programmatic
php artisan tinker << 'EOF'
$modules = DB::connection('landlord')
    ->table('modules')
    ->orderBy('name')
    ->get();
    
foreach ($modules as $module) {
    echo "{$module->name}: {$module->display_name}\n";
    echo "  Status: {$module->status}\n";
    echo "  Premium: " . ($module->requires_subscription ? 'Yes' : 'No') . "\n";
}
EOF
```

### **Update Module Status:**
```php
// Deactivate a module
DB::connection('landlord')
    ->table('modules')
    ->where('name', 'oldmodule')
    ->update(['status' => 'DEPRECATED']);

// Mark as premium
DB::connection('landlord')
    ->table('modules')
    ->where('name', 'premiumfeature')
    ->update(['requires_subscription' => true]);
```

## **🏁 SUMMARY**

### **Registration Flow:**
```
1. Create Context (app/Contexts/{Name}/)
2. Create Migrations (Tenant/ and/or Landlord/)
3. Create {Context}BootstrapSeeder.php
4. Run: php artisan db:seed --class={Context}BootstrapSeeder
5. Verify: php artisan context:list
6. Install: php artisan context:install {Context} --tenant=<slug>
```

### **Key Takeaways:**
1. **UUID, not auto-increment** - Distributed systems ready
2. **All NOT NULL columns required** - Check table schema
3. **Idempotent seeders** - Safe to run multiple times
4. **Proper namespaces** - Match Context folder structure
5. **Helpful logging** - For debugging and monitoring

### **Production Checklist:**
- [ ] Seeder is idempotent
- [ ] UUID generated for ID
- [ ] All NOT NULL columns included
- [ ] Proper namespace (App\\Contexts\\{Context})
- [ ] Status set (ACTIVE, INACTIVE)
- [ ] Subscription flag set correctly
- [ ] Version specified (semantic)
- [ ] Migration path correct
- [ ] Success output with next steps

---

**Now any developer can:**  
1. Create a new Context  
2. Register it in ModuleRegistry  
3. Install it on tenants  
4. Manage it throughout its lifecycle  

**The system is fully modular and ready for expansion!** 🚀
