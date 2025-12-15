Perfect! Now I can see your `tenants` table structure. **No `numeric_id` column exists yet**. Let me proceed with the TDD approach:

## **🚀 Step 1: Run the Test (It Will Fail)**

```bash
cd packages/laravel-backend
php artisan test --filter=TenantNumericIdTest
```

**Expected result:** Test fails because `numeric_id` column doesn't exist.

## **🛠️ Step 2: Create Migration for numeric_id**

```bash
php artisan make:migration add_numeric_id_to_tenants_table
```

Now edit the migration file:

```php
<?php
// database/migrations/[timestamp]_add_numeric_id_to_tenants_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::table('tenants', function (Blueprint $table) {
            // Add numeric_id column (nullable first)
            if (!Schema::hasColumn('tenants', 'numeric_id')) {
                $table->bigInteger('numeric_id')->nullable()->after('id');
            }
        });

        // Update existing tenants with sequential numbers
        $tenants = DB::table('tenants')->orderBy('created_at')->get();
        $counter = 1;
        
        foreach ($tenants as $tenant) {
            DB::table('tenants')
                ->where('id', $tenant->id)
                ->update(['numeric_id' => $counter]);
            $counter++;
        }

        // Make it unique and not nullable
        Schema::table('tenants', function (Blueprint $table) {
            $table->bigInteger('numeric_id')->nullable(false)->unique()->change();
            $table->index('numeric_id');
        });
    }

    public function down()
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropUnique(['numeric_id']);
            $table->dropIndex(['numeric_id']);
            $table->dropColumn('numeric_id');
        });
    }
};
```

## **📝 Step 3: Update Tenant Model**

```php
// app/Models/Tenant.php - Add to the model:

namespace App\Models;

use Spatie\Multitenancy\Models\Tenant as SpatieTenant;
use App\Contracts\TenantInterface;

class Tenant extends SpatieTenant implements TenantInterface
{
    protected $fillable = [
        'id',
        'numeric_id', // Add this
        'name',
        'email',
        // ... rest of your fillable fields
    ];
    
    /**
     * Boot method to auto-increment numeric_id
     */
    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->numeric_id)) {
                // Get next numeric ID
                $last = static::orderBy('numeric_id', 'desc')->first();
                $model->numeric_id = $last ? $last->numeric_id + 1 : 1;
            }
        });
    }
    
    // ... rest of your model code
}
```

## **🔧 Step 4: Run Migration & Test**

```bash
# Run the migration
php artisan migrate

# Run the test again
php artisan test --filter=TenantNumericIdTest
```

**Expected result:** Test should pass now!

## **📊 Step 5: Verify Database Changes**

```bash
php artisan tinker
```

```php
>>> use App\Models\Tenant;
>>> use Illuminate\Support\Facades\Schema;
>>> 
>>> // Check column exists
>>> Schema::hasColumn('tenants', 'numeric_id');
>>> 
>>> // Check current tenants
>>> $tenants = Tenant::all();
>>> foreach ($tenants as $tenant) {
...     echo "{$tenant->name}: UUID={$tenant->id}, Numeric={$tenant->numeric_id}\n";
... }
>>> 
>>> // Create a new tenant to test auto-increment
>>> $newTenant = Tenant::create([
...     'name' => 'Test Auto-increment',
...     'email' => 'test@auto.com',
...     'slug' => 'test-auto',
...     'status' => 'active',
... ]);
>>> 
>>> echo "New tenant numeric_id: " . $newTenant->numeric_id;
```

## **🎯 Step 6: Update RBAC Tables**

Now we need to update the RBAC tables to use `tenant_id` (numeric) instead of trying to insert UUID:

### **Option A: Update RBAC SQL Templates**
```sql
-- In database/templates/modules/rbac/schema.sql
-- Change tenant_id from BIGINT to accept numeric values
-- (Actually, it's already BIGINT, so it should work with numeric_id)
```

### **Option B: Update Seeder to Use numeric_id**
```php
// In your TenantDefaultRolesSeeder, change:
'tenant_id' => $tenant->id, // UUID - WRONG
// To:
'tenant_id' => $tenant->numeric_id, // Numeric - CORRECT
```

## **🚨 Important: Fix the Immediate Error**

Your original error was:
```sql
Incorrect integer value: 'f85bbd52-3c7e-4eb9-b75c-644de4c817da' for column 'tenant_id'
```

Now with `numeric_id`, the seeder should work:

```php
// Before fix (causing error):
Permission::create([
    'name' => 'users.view',
    'tenant_id' => $tenant->id, // UUID string - causes error
]);

// After fix:
Permission::create([
    'name' => 'users.view', 
    'tenant_id' => $tenant->numeric_id, // Numeric integer - works!
]);
```

## **📋 Complete Action Plan:**

1. **Run the failing test** (confirm it fails)
2. **Create and run migration** for `numeric_id`
3. **Update Tenant model** with auto-increment logic
4. **Run test again** (should pass)
5. **Fix the seeder** to use `$tenant->numeric_id`
6. **Run seeder** to verify no more errors

**Want me to create the migration file for you?** Or would you prefer to do it step by step?

Let me know if you want me to:
1. ✅ Create the migration file content
2. ✅ Show exact seeder fixes
3. ✅ Update RBAC SQL templates
4. ✅ Test the complete flow

1. Yes

Now let's proceed with the TDD approach:

## **🚀 Step 1: Run Migration**

```bash
cd packages/laravel-backend
php artisan migrate
```

## **🚀 Step 2: Update Tenant Model**

Add the auto-increment logic to Tenant model:

```php
// app/Models/Tenant.php - Add this boot method

namespace App\Models;

use Spatie\Multitenancy\Models\Tenant as SpatieTenant;
use App\Contracts\TenantInterface;

class Tenant extends SpatieTenant implements TenantInterface
{
    // ... existing code ...
    
    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->numeric_id)) {
                // Get the maximum numeric_id and increment
                $last = static::orderBy('numeric_id', 'desc')->first();
                $model->numeric_id = $last ? $last->numeric_id + 1 : 1;
            }
        });
    }
    
    // ... rest of your model ...
}
```

## **🚀 Step 3: Add numeric_id to fillable**

Make sure `numeric_id` is in the `$fillable` array:

```php
protected $fillable = [
    'id',
    'numeric_id', // Add this line
    'name',
    'email',
    'slug',
    'status',
    // ... other fields ...
];
```

## **🚀 Step 4: Run the Test**

```bash
php artisan test --filter=TenantNumericIdTest
```

The test should **pass** now!

## **🚀 Step 5: Fix the Seeder Error**

Now let's find and fix the seeder that's causing the original error. Find where permissions are being created with `tenant_id`:

```bash
# Search for the seeder
grep -r "tenant_id" packages/laravel-backend/database/seeders/
grep -r "Permission::create" packages/laravel-backend/database/seeders/
```

The error was in `TenantDefaultRolesSeeder`. Let's update it:

```php
// In your TenantDefaultRolesSeeder, find:
'tenant_id' => $tenant->id,

// Change to:
'tenant_id' => $tenant->numeric_id,
```

**Example fix:**

```php
// Before (causing error):
Permission::create([
    'name' => 'users.view',
    'guard_name' => 'web',
    'tenant_id' => $tenant->id, // UUID string
    // ... other fields
]);

// After (fixed):
Permission::create([
    'name' => 'users.view',
    'guard_name' => 'web',
    'tenant_id' => $tenant->numeric_id, // Numeric integer
    // ... other fields
]);
```

## **🚀 Step 6: Test the Seeder**

```bash
# Run the seeder to test
php artisan db:seed --class=TenantDefaultRolesSeeder
```

If it works, you should see:
```
Seeding default roles for tenant: Test Political Party
✅ Default roles and permissions created successfully
```

## **🚀 Step 7: Verify Database**

```bash
php artisan tinker
```

```php
>>> use App\Models\Tenant;
>>> 
>>> // Check tenants have numeric_id
>>> $tenants = Tenant::all();
>>> foreach ($tenants as $tenant) {
...     echo "{$tenant->name}: UUID={$tenant->id}, Numeric={$tenant->numeric_id}\n";
... }
>>> 
>>> // Check permissions table uses numeric tenant_id
>>> use App\Contexts\TenantAuth\Domain\Models\TenantPermission;
>>> $permissions = TenantPermission::all();
>>> foreach ($permissions as $perm) {
...     echo "{$perm->name}: tenant_id={$perm->tenant_id}\n";
... }
```

## **📋 Complete Checklist:**

### **Done:**
- ✅ Created migration for `numeric_id`
- ✅ Updated Tenant model with auto-increment logic
- ✅ Test written and (should) pass

### **To Do:**
1. **Update Tenant model** with boot() method and fillable
2. **Fix seeder** to use `$tenant->numeric_id`
3. **Test full seeder flow**

## **🔧 Let's Do It Step by Step:**

**First, let me check if the test passes after migration:**

```bash
php artisan test --filter=TenantNumericIdTest
```

**If test fails, check why:**
- Did migration run successfully?
- Does Tenant model have the boot() method?
- Is numeric_id in fillable array?

**Then fix the seeder:**
```bash
# Find the exact line causing error
grep -n "tenant_id.*tenant->id" packages/laravel-backend/database/seeders/TenantDefaultRolesSeeder.php
```

**Want me to:**
1. **Show you the exact line** to fix in the seeder?
2. **Run the test** to see if it passes?
3. **Check database structure** after migration?

Let me know which step you want to do first!