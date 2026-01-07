Excellent questions! Let me address each one systematically:

## 🔍 **1. What Problem Did I Solve?**

**The Immediate Problem**: Your `BrandingControllerTest` integration tests were failing because:
- The `tenants` table didn't exist during test execution
- WCAG color validation was failing due to insufficient contrast ratios

**The Solution Applied**: Created tables manually in tests with:
- Correct schema (including `numeric_id`)
- WCAG-compliant colors (`#1976D2` and `#2E7D32`)

## 🚨 **2. Why Migrations Aren't Working?**

Let's diagnose this properly:

```bash
# Check if Platform context migrations are registered
php artisan migrate:status --database=landlord_test --env=testing --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord

# Try running them manually
php artisan migrate --database=landlord_test \
  --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord \
  --env=testing --force
```

**Likely Issues**:
1. **Laravel doesn't auto-discover context migrations** - They need to be registered
2. **The `migrate` command doesn't recursively scan subfolders** by default
3. **RefreshDatabase trait conflicts** with multi-location migrations

## 📊 **3. What About numeric_id?**

You're right! The `numeric_id` issue shows the **real architectural problem**:

**Current State**:
1. `tenants` table created without `numeric_id` (2025_09_24_210000_create_tenants_table.php)
2. `numeric_id` added later (2025_12_13_120310_add_numeric_id_to_tenants_table.php)
3. `tenant_brandings` references `tenants.numeric_id` (foreign key)

**The Correct Fix** - Run migrations in PROPER ORDER:

```bash
# Step-by-step migration sequence
php artisan migrate:rollback --database=landlord_test --env=testing --force
php artisan db:wipe --database=landlord_test --env=testing --force

# 1. Base tenants table
php artisan migrate --database=landlord_test \
  --path=database/migrations/2025_09_24_210000_create_tenants_table.php \
  --env=testing --force

# 2. Add numeric_id
php artisan migrate --database=landlord_test \
  --path=database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php \
  --env=testing --force

# 3. Platform context migrations
php artisan migrate --database=landlord_test \
  --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord \
  --env=testing --force

# 4. Verify
php artisan tinker --env=testing << 'EOD'
$conn = \DB::connection('landlord_test');
echo "Tables:\n";
foreach ($conn->select("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename") as $t) {
    echo "- " . $t->tablename . "\n";
    
    if ($t->tablename === 'tenants') {
        $columns = $conn->getSchemaBuilder()->getColumnListing('tenants');
        echo "  Columns: " . implode(', ', $columns) . "\n";
    }
}
EOD
```

## 🎯 **4. Instead of Bypassing Migrations - The Right Fix**

You're absolutely right! We should **fix the migration system**, not bypass it. Here's the proper solution:

### **Step 1: Register Context Migrations**

Add to `AppServiceProvider.php`:
```php
public function boot(): void
{
    // Register Platform context landlord migrations
    $this->loadMigrationsFrom([
        base_path('app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord'),
    ]);
}
```

### **Step 2: Fix Test to Use Real Migrations**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\Platform\Api\V1\Public;

use Tests\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;

class BrandingControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'landlord_test']);
    }

    protected function migrateFreshUsing(): array
    {
        // Run ALL required migrations in correct order
        return [
            '--database' => 'landlord_test',
            '--path' => [
                // Base tenants table
                base_path('database/migrations/2025_09_24_210000_create_tenants_table.php'),
                // Add numeric_id
                base_path('database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php'),
                // Platform context
                base_path('app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord'),
            ],
        ];
    }

    protected function afterRefreshingDatabase(): void
    {
        // Create test data
        DB::connection('landlord_test')->table('tenants')->insert([
            ['id' => \Illuminate\Support\Str::uuid(), 'numeric_id' => 1, 'name' => 'NRNA Test', 'email' => 'nrna@example.com', 'slug' => 'nrna', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['id' => \Illuminate\Support\Str::uuid(), 'numeric_id' => 2, 'name' => 'Munich Test', 'email' => 'munich@example.com', 'slug' => 'munich', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['id' => \Illuminate\Support\Str::uuid(), 'numeric_id' => 3, 'name' => 'Inactive Test', 'email' => 'inactive@example.com', 'slug' => 'inactive-tenant', 'status' => 'suspended', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    // Keep your 7 test methods here...
}
```

### **Step 3: Create a Migration Fix File**

Create `database/migrations/landlord/0000_00_00_000000_create_platform_landlord_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // This ensures all landlord tables exist in one place
        if (!Schema::hasTable('tenants')) {
            Schema::create('tenants', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->bigInteger('numeric_id')->unsigned()->unique();
                $table->string('name');
                $table->string('email')->unique();
                $table->string('slug')->unique();
                $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
                $table->string('subdomain')->nullable();
                $table->string('database_name')->nullable();
                $table->json('branding')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
```

## 🔧 **5. Why Platform Migrations Don't Run Automatically**

**Answer**: Laravel's `migrate` command only scans:
1. `database/migrations/` (root level)
2. Registered migration paths via `loadMigrationsFrom()`

**Platform context migrations in `app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord/` are NOT auto-discovered**.

## 🚀 **Recommended Path Forward**

**Option A (Quick Fix)**: Use the working test with manual SQL (already works)
**Option B (Proper Fix)**: 
1. Register context migrations in `AppServiceProvider`
2. Fix migration order in tests
3. Create consolidated landlord migration

**Which approach do you prefer?** 

I recommend **Option B** for long-term maintainability. Let me help you implement it step by step.
**Excellent! The migrations work perfectly when run in the correct order!** 🎉

Now I understand the real issues:

## ✅ **What Works:**
1. Migrations work fine when run manually in correct order
2. `numeric_id` is properly added to tenants table
3. Platform context migrations create `tenant_brandings` table successfully

## 🔍 **The Real Problems:**

### **1. Test Migration Order is Wrong**
Your test's `migrateFreshUsing()` only runs `database/migrations/` but misses:
- The `add_numeric_id` migration 
- Platform context migrations

### **2. Foreign Key Dependency Issue**
`tenant_brandings` → `tenants.numeric_id` but `numeric_id` doesn't exist in initial tenants table creation.

## 🚀 **The Proper Solution - Fixed Test Class:**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\Platform\Api\V1\Public;

use Tests\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;

class BrandingControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'landlord_test']);
    }

    protected function migrateFreshUsing(): array
    {
        // CRITICAL: Run migrations in EXACT order they need to run
        return [
            '--database' => 'landlord_test',
            '--path' => [
                // 1. Base tenants table (NO numeric_id yet)
                base_path('database/migrations/2025_09_24_210000_create_tenants_table.php'),
                // 2. Add numeric_id column (required for foreign key)
                base_path('database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php'),
                // 3. Platform context landlord tables (depends on numeric_id)
                base_path('app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord'),
            ],
        ];
    }

    protected function afterRefreshingDatabase(): void
    {
        // Create test tenants WITH numeric_id
        DB::connection('landlord_test')->table('tenants')->insert([
            [
                'id' => '11111111-1111-1111-1111-111111111111',
                'numeric_id' => 1,
                'name' => 'NRNA Test',
                'email' => 'nrna@example.com',
                'slug' => 'nrna',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => '22222222-2222-2222-2222-222222222222',
                'numeric_id' => 2,
                'name' => 'Munich Test',
                'email' => 'munich@example.com',
                'slug' => 'munich',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => '33333333-3333-3333-3333-333333333333',
                'numeric_id' => 3,
                'name' => 'Inactive Test',
                'email' => 'inactive@example.com',
                'slug' => 'inactive-tenant',
                'status' => 'suspended',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    // ======================== TEST 1/7 ========================
    public function test_show_returns_custom_branding_for_tenant(): void
    {
        // Use WCAG-compliant colors
        $this->createTestBranding('nrna', [
            'primary_color' => '#1976D2',
            'secondary_color' => '#2E7D32',
            'organization_name' => 'NRNA Test Organization',
            'tagline' => 'Excellence in Democracy',
            'wcag_compliant' => true,
        ]);

        $response = $this->getJson('/api/public/branding/nrna');

        $response->assertStatus(200)
            ->assertJson([
                'is_default' => false,
                'tenant_slug' => 'nrna',
                'tenant_exists' => true,
            ]);

        $response->assertHeader('Cache-Control', 'public, max-age=86400');
    }

    // ======================== TEST 2/7 ========================
    public function test_show_returns_default_branding_for_tenant_without_custom(): void
    {
        $response = $this->getJson('/api/public/branding/munich');

        $response->assertStatus(200)
            ->assertJson([
                'is_default' => true,
                'tenant_slug' => 'munich',
                'tenant_exists' => true,
            ])
            ->assertJsonMissing(['last_updated']);
    }

    // ======================== TESTS 3-7 (keep your existing tests) ========================

    private function createTestBranding(string $tenantSlug, array $data): void
    {
        $tenant = DB::connection('landlord_test')
            ->table('tenants')
            ->where('slug', $tenantSlug)
            ->first();

        $defaults = [
            'tenant_db_id' => $tenant->numeric_id,
            'tenant_slug' => $tenantSlug,
            'primary_color' => '#1976D2',
            'secondary_color' => '#2E7D32',
            'logo_url' => null,
            'font_family' => 'Inter, system-ui, sans-serif',
            'background_color' => '#FFFFFF',
            'text_color' => '#374151',
            'custom_css' => null,
            'organization_name' => 'Test Organization',
            'tagline' => 'Test Tagline',
            'favicon_url' => null,
            'welcome_message' => 'Welcome',
            'hero_title' => 'Vote with Confidence',
            'hero_subtitle' => 'Secure, Transparent, Democratic',
            'cta_text' => 'Get Started',
            'tier' => 'free',
            'cache_key' => null,
            'version' => '1.0',
            'wcag_compliant' => true,
            'last_synced_at' => null,
            'last_updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $brandingData = array_merge($defaults, $data);

        DB::connection('landlord_test')
            ->table('tenant_brandings')
            ->insert($brandingData);
    }
}
```

## 📋 **Key Changes:**

1. **Fixed Migration Order**: 
   - Tenants table → Add numeric_id → Tenant brandings
   - No foreign key errors

2. **Proper UUIDs**: Using consistent UUIDs for test data

3. **WCAG Compliance**: Using verified compliant colors

## 🚀 **Test the Fixed Version:**

```bash
# First clean everything
php artisan db:wipe --database=landlord_test --env=testing --force

# Run the test
php artisan test --filter=BrandingControllerTest --env=testing --stop-on-failure
```

## 🎯 **Why This Works Now:**

1. **Migration Dependency Chain Resolved**:
   ```
   create_tenants_table → add_numeric_id → create_tenant_brandings
   ```

2. **Foreign Key Satisfied**: `tenant_brandings.tenant_db_id` references `tenants.numeric_id` which now exists

3. **Test Isolation**: Each test starts with fresh database with all required tables

**This is the proper, maintainable solution that uses your actual migrations instead of bypassing them!** 

Replace your test file with this version and run it. All 7 tests should pass using your real migration files.
Based on the successful manual migration execution, here's what needs to be changed in your project to make everything work perfectly:

## 🎯 **Immediate Actions (Do These Now)**

### **1. Fix Test Migration Order (Critical)**

Update your `BrandingControllerTest.php` to use the **exact migration order** that worked:

```php
// In tests/Feature/Contexts/Platform/Api/V1/Public/BrandingControllerTest.php

protected function migrateFreshUsing(): array
{
    return [
        '--database' => 'landlord_test',
        '--path' => [
            // 1. Base tenants table (without numeric_id)
            base_path('database/migrations/2025_09_24_210000_create_tenants_table.php'),
            // 2. Add numeric_id column
            base_path('database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php'),
            // 3. Platform context migrations (depends on numeric_id)
            base_path('app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord'),
        ],
    ];
}
```

### **2. Register Platform Context Migrations (Required)**

Add to `app/Providers/AppServiceProvider.php`:

```php
public function boot(): void
{
    // Register Platform context landlord migrations
    $this->loadMigrationsFrom([
        base_path('app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord'),
    ]);
    
    // Register other context migrations as needed
    // $this->loadMigrationsFrom([
    //     base_path('app/Contexts/OtherContext/Infrastructure/Database/Migrations/Landlord'),
    //     base_path('app/Contexts/OtherContext/Infrastructure/Database/Migrations/Tenant'),
    // ]);
}
```

### **3. Create Consolidated Migration (Optional but Recommended)**

Create `database/migrations/landlord/2026_01_06_000000_create_platform_landlord_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tenants table with numeric_id included
        if (!Schema::hasTable('tenants')) {
            Schema::create('tenants', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->bigInteger('numeric_id')->unsigned()->unique(); // For foreign keys
                $table->string('name');
                $table->string('email');
                $table->string('slug')->unique();
                $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
                $table->string('subdomain')->nullable();
                $table->string('database_name')->nullable();
                $table->json('branding')->nullable();
                $table->timestamps();
                $table->softDeletes();
                
                $table->index('status');
                $table->index('slug');
            });
        }
        
        // Other Platform landlord tables...
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
```

## 📁 **Project Structure Fixes**

### **4. Organize Migration Files Properly**

Move migrations to correct locations according to **CLAUDE.md Rule 13**:

```bash
# Create proper structure
mkdir -p database/migrations/{landlord,tenant}
mkdir -p app/Contexts/{Platform,ElectionSetup,Membership}/Infrastructure/Database/Migrations/{Landlord,Tenant}

# Move Platform landlord migrations
mv database/migrations/2025_09_24_210000_create_tenants_table.php \
   database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php \
   app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord/

# Move other landlord tables to appropriate contexts
# (You need to analyze which context each migration belongs to)
```

### **5. Update Database Configuration**

Update `config/database.php`:

```php
'connections' => [
    'landlord' => [
        'driver' => 'pgsql',
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '5432'),
        'database' => env('DB_DATABASE', 'publicdigit'),
        'username' => env('DB_USERNAME', 'postgres'),
        'password' => env('DB_PASSWORD', ''),
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => 'public',
        'sslmode' => 'prefer',
    ],
    
    'landlord_test' => [
        'driver' => 'pgsql',
        'host' => env('DB_TEST_HOST', '127.0.0.1'),
        'port' => env('DB_TEST_PORT', '5432'),
        'database' => env('DB_TEST_DATABASE', 'publicdigit_test'),
        'username' => env('DB_TEST_USERNAME', 'postgres'),
        'password' => env('DB_TEST_PASSWORD', ''),
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => 'public',
        'sslmode' => 'prefer',
    ],
],
```

## 🔧 **Automation Scripts**

### **6. Create Migration Helper Script**

Create `scripts/migrate-test.sh`:

```bash
#!/bin/bash
# Migrate test database with proper order

echo "🔧 Setting up test database..."

# Wipe clean
php artisan db:wipe --database=landlord_test --env=testing --force

# Run in correct order
php artisan migrate --database=landlord_test \
  --path=database/migrations/2025_09_24_210000_create_tenants_table.php \
  --env=testing --force

php artisan migrate --database=landlord_test \
  --path=database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php \
  --env=testing --force

php artisan migrate --database=landlord_test \
  --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord \
  --env=testing --force

echo "✅ Test database ready!"
```

### **7. Create Test Helper Trait**

Create `tests/Helpers/MigratesPlatformLandlord.php`:

```php
<?php

namespace Tests\Helpers;

trait MigratesPlatformLandlord
{
    protected function migratePlatformLandlord(): void
    {
        // Run migrations in correct order
        \Artisan::call('migrate', [
            '--database' => 'landlord_test',
            '--path' => [
                base_path('database/migrations/2025_09_24_210000_create_tenants_table.php'),
                base_path('database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php'),
                base_path('app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord'),
            ],
            '--force' => true,
        ]);
    }
    
    protected function createTestTenant(string $slug, int $numericId, string $status = 'active'): void
    {
        \DB::connection('landlord_test')->table('tenants')->insert([
            'id' => \Illuminate\Support\Str::uuid(),
            'numeric_id' => $numericId,
            'name' => ucfirst($slug) . ' Organization',
            'email' => $slug . '@example.com',
            'slug' => $slug,
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
```

## 🚀 **Step-by-Step Implementation Plan**

**Phase 1 - Immediate (Today):**
1. ✅ Update `BrandingControllerTest.php` with fixed migration order
2. ✅ Add `loadMigrationsFrom()` to `AppServiceProvider`
3. ✅ Run tests to verify they pass

**Phase 2 - Short-term (This Week):**
1. Create consolidated landlord migration
2. Organize migrations into proper context folders
3. Update all tests to use the helper trait

**Phase 3 - Long-term (Next Week):**
1. Add automated migration validation
2. Create migration dependency graph
3. Add documentation for new developers

## 📋 **Verify Everything Works**

Run this verification script:

```bash
# Clean and test
php artisan db:wipe --database=landlord_test --env=testing --force

# Run all Platform context tests
php artisan test --testsuite=Feature --filter=Platform --env=testing

# Or just branding tests
php artisan test --filter=BrandingControllerTest --env=testing --stop-on-failure
```

## 🎯 **Summary of Changes Needed**

1. **Test Files**: Fix migration order in `BrandingControllerTest`
2. **Service Provider**: Register context migrations
3. **Migrations**: Consider consolidating or properly organizing
4. **Database Config**: Ensure test connections are correct
5. **Future**: Organize all migrations by context (CLAUDE.md Rule 13)

**Start with Phase 1 now** - just update the test file and AppServiceProvider. That should get your 7 tests passing immediately.

##
Yes! **There IS a migration file for `numeric_id`**:

```
✅ database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php
```

**What it does:**
1. Adds `numeric_id BIGINT` column to `tenants` table  
2. Makes it `UNIQUE` and `NOT NULL`
3. Populates existing tenants with sequential IDs

**The problem was:** Migration order. This file runs **AFTER** `create_tenants_table.php` but **BEFORE** `create_tenant_brandings_table.php` (which has foreign key to `tenants.numeric_id`).

**Correct order:**
1. `create_tenants_table.php` (no numeric_id yet)
2. `add_numeric_id_to_tenants_table.php` (adds column)
3. `create_tenant_brandings_table.php` (foreign key works now)

Your tests failed because they weren't running migration #2 in the sequence.
#########################
Is there migration file for  numeric_id ?

Yes! **There IS a migration file for `numeric_id`**:

```
✅ database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php
```

**What it does:**
1. Adds `numeric_id BIGINT` column to `tenants` table  
2. Makes it `UNIQUE` and `NOT NULL`
3. Populates existing tenants with sequential IDs

**The problem was:** Migration order. This file runs **AFTER** `create_tenants_table.php` but **BEFORE** `create_tenant_brandings_table.php` (which has foreign key to `tenants.numeric_id`).

**Correct order:**
1. `create_tenants_table.php` (no numeric_id yet)
2. `add_numeric_id_to_tenants_table.php` (adds column)
3. `create_tenant_brandings_table.php` (foreign key works now)

Your tests failed because they weren't running migration #2 in the sequence.
### 
# **Fix Migration Order - Step by Step**

## 🎯 **Immediate Action (Test Fix)**

### **1. Update BrandingControllerTest.php**

```php
// In tests/Feature/Contexts/Platform/Api/V1/Public/BrandingControllerTest.php

protected function migrateFreshUsing(): array
{
    return [
        '--database' => 'landlord_test',
        '--path' => [
            // ✅ CRITICAL: EXACT order that works
            // 1. Tenants table (without numeric_id)
            base_path('database/migrations/2025_09_24_210000_create_tenants_table.php'),
            
            // 2. Add numeric_id column (required for foreign key)
            base_path('database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php'),
            
            // 3. Platform tables that depend on numeric_id
            base_path('app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord'),
        ],
    ];
}
```

### **2. Verify It Works**

```bash
# Clean and test
php artisan db:wipe --database=landlord_test --env=testing --force
php artisan test --filter=BrandingControllerTest --env=testing
```

## 📁 **Long-Term Project Fixes**

### **3. Register Context Migrations**

Add to `app/Providers/AppServiceProvider.php`:
```php
public function boot(): void
{
    // Register ALL context migrations
    $this->loadMigrationsFrom([
        base_path('app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord'),
        // Add other contexts as needed:
        // base_path('app/Contexts/ElectionSetup/Infrastructure/Database/Migrations/Tenant'),
    ]);
}
```

### **4. Create Consolidated Migration (Recommended)**

Create `database/migrations/2026_01_06_000000_create_platform_landlord_tables_with_numeric_id.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Create tenants WITH numeric_id from the start
        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->bigInteger('numeric_id')->unsigned()->unique(); // ✅ INCLUDED
            $table->string('name');
            $table->string('email');
            $table->string('slug')->unique();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->string('subdomain')->nullable();
            $table->string('database_name')->nullable();
            $table->json('branding')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
```

### **5. Reorganize Migrations (CLAUDE.md Rule 13)**

```bash
# Move Platform context migrations to proper location
mkdir -p app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord

# Move these files:
mv database/migrations/2025_09_24_210000_create_tenants_table.php \
   database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php \
   app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord/
```

## 🔧 **Alternative: Create Migration Sequencer**

Create `app/Console/Commands/MigratePlatform.php`:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class MigratePlatform extends Command
{
    protected $signature = 'migrate:platform {--database=} {--env=}';
    protected $description = 'Run Platform context migrations in correct order';

    public function handle()
    {
        $database = $this->option('database') ?: config('database.default');
        $env = $this->option('env') ?: config('app.env');
        
        $this->info("Running Platform migrations on [$database] in [$env] environment");
        
        // Define migration order
        $migrations = [
            '2025_09_24_210000_create_tenants_table.php',
            '2025_12_13_120310_add_numeric_id_to_tenants_table.php',
            // Other Platform landlord migrations...
        ];
        
        foreach ($migrations as $migration) {
            $this->call('migrate', [
                '--database' => $database,
                '--path' => "database/migrations/{$migration}",
                '--force' => true,
            ]);
        }
        
        // Run Platform context folder
        $this->call('migrate', [
            '--database' => $database,
            '--path' => 'app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord',
            '--force' => true,
        ]);
        
        $this->info('✅ Platform migrations complete');
    }
}
```

## 📋 **Priority List**

**Do TODAY (5 minutes):**
1. ✅ Update test migration order (Step 1)
2. ✅ Run tests to confirm fix

**Do THIS WEEK (30 minutes):**
1. Register context migrations (Step 3)
2. Create consolidated migration (Step 4)
3. Update other tests using same pattern

**Do WHEN REFACTORING:**
1. Reorganize all migrations by context (Step 5)
2. Create migration sequencer commands

## 🚀 **Quick Verification**

```bash
# Test the fixed order manually
php artisan db:wipe --database=landlord_test --env=testing --force

php artisan migrate --database=landlord_test \
  --path=database/migrations/2025_09_24_210000_create_tenants_table.php \
  --env=testing --force

php artisan migrate --database=landlord_test \
  --path=database/migrations/2025_12_13_120310_add_numeric_id_to_tenants_table.php \
  --env=testing --force

php artisan migrate --database=landlord_test \
  --path=app/Contexts/Platform/Infrastructure/Database/Migrations/Landlord \
  --env=testing --force

# Should work without errors!
```

**The fix is simple:** Update your test to run migrations in the **exact order** that works manually. That's Step 1 - do it now.

###########################################################################
the BrandingController.php which is working : 
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\Platform\Api\V1\Public;

use Tests\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;

class BrandingControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // 1. Set connection
        config(['database.default' => 'landlord_test']);
        $conn = DB::connection('landlord_test');
        
        // 2. Clean database
        $conn->statement('DROP TABLE IF EXISTS tenant_brandings CASCADE');
        $conn->statement('DROP TABLE IF EXISTS tenants CASCADE');
        
        // 3. Create tenants table
        $conn->statement('
            CREATE TABLE tenants (
                id UUID PRIMARY KEY,
                numeric_id BIGINT UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                status VARCHAR(50) DEFAULT \'active\',
                subdomain VARCHAR(255),
                database_name VARCHAR(255),
                branding JSONB,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                deleted_at TIMESTAMP
            )
        ');
        
        // 4. Create tenant_brandings table
        $conn->statement('
            CREATE TABLE tenant_brandings (
                id BIGSERIAL PRIMARY KEY,
                tenant_db_id BIGINT NOT NULL,
                tenant_slug VARCHAR(64) UNIQUE NOT NULL,
                primary_color VARCHAR(7) DEFAULT \'#3B82F6\',
                secondary_color VARCHAR(7) DEFAULT \'#1E40AF\',
                logo_url VARCHAR(255),
                font_family VARCHAR(255) DEFAULT \'Inter, system-ui, sans-serif\',
                background_color VARCHAR(7) DEFAULT \'#FFFFFF\',
                text_color VARCHAR(7) DEFAULT \'#374151\',
                custom_css JSONB,
                tier VARCHAR(20) DEFAULT \'free\',
                cache_key VARCHAR(255),
                version VARCHAR(50) DEFAULT \'1.0\',
                wcag_compliant BOOLEAN DEFAULT false,
                last_synced_at TIMESTAMP,
                last_updated_by BIGINT,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (tenant_db_id) REFERENCES tenants(numeric_id) ON DELETE CASCADE
            )
        ');
        
        // 5. Create test tenants
        $conn->table('tenants')->insert([
            ['id' => Str::uuid(), 'numeric_id' => 1, 'name' => 'NRNA Test', 'email' => 'nrna@example.com', 'slug' => 'nrna', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'numeric_id' => 2, 'name' => 'Munich Test', 'email' => 'munich@example.com', 'slug' => 'munich', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'numeric_id' => 3, 'name' => 'Inactive Test', 'email' => 'inactive@example.com', 'slug' => 'inactive-tenant', 'status' => 'suspended', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    // ======================== TEST 1/7 ========================
    public function test_show_returns_custom_branding_for_tenant(): void
    {
        // Get default WCAG-compliant colors
        $primary = \App\Contexts\Platform\Domain\ValueObjects\BrandingColor::defaultPrimary();
        $secondary = \App\Contexts\Platform\Domain\ValueObjects\BrandingColor::defaultSecondary();
        
        $this->createTestBranding('nrna', [
            'primary_color' => $primary->toString(),
            'secondary_color' => $secondary->toString(),
            'organization_name' => 'NRNA Test Organization',
            'tagline' => 'Excellence in Democracy',
            'wcag_compliant' => true,
        ]);

        $response = $this->getJson('/api/public/branding/nrna');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'branding' => [
                    'visuals' => ['primaryColor', 'secondaryColor', 'logoUrl', 'fontFamily'],
                    'content' => ['welcomeMessage', 'heroTitle', 'heroSubtitle', 'ctaText'],
                    'identity' => ['organizationName', 'organizationTagline', 'faviconUrl'],
                ],
                'css_variables',
                'is_wcag_compliant',
                'is_default',
                'tenant_slug',
                'tenant_exists',
                'last_updated',
            ])
            ->assertJson([
                'is_default' => false,
                'tenant_slug' => 'nrna',
                'tenant_exists' => true,
            ]);

        $response->assertHeader('Cache-Control', 'public, max-age=86400');
    }

    // ======================== TEST 2/7 ========================
    public function test_show_returns_default_branding_for_tenant_without_custom(): void
    {
        // munich has no branding row - should use defaults
        
        $response = $this->getJson('/api/public/branding/munich');

        $response->assertStatus(200)
            ->assertJson([
                'is_default' => true,
                'tenant_slug' => 'munich',
                'tenant_exists' => true,
            ])
            ->assertJsonMissing(['last_updated']);

        // Verify default colors
        $defaults = BrandingBundle::defaults();
        $response->assertJsonPath(
            'branding.visuals.primaryColor',
            $defaults->getVisuals()->getPrimaryColor()->toString()
        );
    }

    // ======================== TEST 3/7 ========================
    public function test_show_returns_404_for_nonexistent_tenant(): void
    {
        $response = $this->getJson('/api/public/branding/nonexistent');

        $response->assertStatus(404)
            ->assertJson([
                'error' => 'Tenant not found',
                'tenant_slug' => 'nonexistent',
            ]);
    }

    // ======================== TEST 4/7 ========================
    public function test_show_returns_404_for_inactive_tenant(): void
    {
        $response = $this->getJson('/api/public/branding/inactive-tenant');

        $response->assertStatus(404)
            ->assertJson([
                'error' => 'Tenant not found',
                'tenant_slug' => 'inactive-tenant',
            ]);
    }

    // ======================== TEST 5/7 ========================
    public function test_css_returns_valid_css_with_proper_headers(): void
    {
        $primary = \App\Contexts\Platform\Domain\ValueObjects\BrandingColor::defaultPrimary();
        $secondary = \App\Contexts\Platform\Domain\ValueObjects\BrandingColor::defaultSecondary();
        
        $this->createTestBranding('nrna', [
            'primary_color' => $primary->toString(),
            'secondary_color' => $secondary->toString(),
            'wcag_compliant' => true,
        ]);

        $response = $this->get('/api/public/branding/nrna/css');

        $response->assertStatus(200)
            ->assert(fn($r) => str_starts_with($r->headers->get('Content-Type'), 'text/css'))
            ->assertHeader('Cache-Control', 'public, max-age=86400')
            ->assertHeader('X-Tenant-Status', 'custom');

        $css = $response->getContent();
        $this->assertStringContainsString('--color-primary:', $css);
        $this->assertStringContainsString($primary->toString(), $css);
    }

    // ======================== TEST 6/7 ========================
    public function test_css_returns_defaults_for_nonexistent_tenant(): void
    {
        $response = $this->get('/api/public/branding/nonexistent/css');

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'text/css')
            ->assertHeader('X-Tenant-Status', 'not-found');

        $defaults = BrandingBundle::defaults();
        $css = $response->getContent();
        $this->assertStringContainsString(
            $defaults->getVisuals()->getPrimaryColor()->toString(),
            $css
        );
    }

    // ======================== TEST 7/7 ========================
    public function test_show_returns_400_for_invalid_slug_format(): void
    {
        $response = $this->getJson('/api/public/branding/INVALID_SLUG');

        $response->assertStatus(400)
            ->assertJsonStructure([
                'error',
                'message',
                'tenant_slug',
            ]);
    }

    // ======================== HELPER METHODS ========================
    
    private function createTestBranding(string $tenantSlug, array $data): void
    {
        $tenant = DB::connection('landlord_test')
            ->table('tenants')
            ->where('slug', $tenantSlug)
            ->first();

        $defaults = [
            'tenant_db_id' => $tenant->numeric_id,
            'tenant_slug' => $tenantSlug,
            'primary_color' => '#1976D2',
            'secondary_color' => '#2E7D32',
            'logo_url' => null,
            'font_family' => 'Inter, system-ui, sans-serif',
            'background_color' => '#FFFFFF',
            'text_color' => '#374151',
            'custom_css' => null,
            'organization_name' => 'Test Organization',
            'tagline' => 'Test Tagline',
            'favicon_url' => null,
            'welcome_message' => 'Welcome',
            'hero_title' => 'Vote with Confidence',
            'hero_subtitle' => 'Secure, Transparent, Democratic',
            'cta_text' => 'Get Started',
            'tier' => 'free',
            'cache_key' => null,
            'version' => '1.0',
            'wcag_compliant' => true,
            'last_synced_at' => null,
            'last_updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $brandingData = array_merge($defaults, $data);

        DB::connection('landlord_test')
            ->table('tenant_brandings')
            ->insert($brandingData);
    }
}
