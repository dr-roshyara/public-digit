# Claude CLI Professional Prompt: DDD Context Migrations with Foreign Keys

## Problem Context:
**Multi-tenant Laravel application with Domain-Driven Design (DDD) architecture:**
- **Landlord Database**: Shared platform data (users, tenants, geography)
- **DDD Contexts**: Separate bounded contexts with their own migrations
- **Cross-Context Dependencies**: Platform migrations depend on context tables

## Migration Architecture Rules:

### 1. **Database Connection Strategy:**
```php
// ✅ Platform tables use default/landlord connection
Schema::create('table_name', ...);

// ❌ Don't specify connection unless absolutely necessary
Schema::connection('landlord')->create(...);
```

### 2. **DDD Context Migration Location:**
```
app/
└── Contexts/
    └── {ContextName}/
        └── Infrastructure/
            └── Database/
                └── Migrations/
                    ├── 2025_01_01_000001_create_context_table.php
                    └── 2025_01_01_000002_create_another_table.php
```

### 3. **Platform Migration Location:**
```
database/
└── migrations/
    ├── 0001_01_01_000000_create_users_table.php
    ├── 2025_09_24_210000_create_tenants_table.php
    └── 2025_12_23_040000_create_geo_candidate_units.php
```

## Migration Creation Guidelines:

### For DDD Context Migrations:
```bash
# Navigate to context directory first
cd app/Contexts/Geography/Infrastructure/Database

# Create migration with proper timestamp
php artisan make:migration create_countries_table --path=Migrations

# Ensure timestamp EARLIER than dependent platform migrations
# Example: 2025_01_01_000001_ (January 1st) for contexts
```

### For Platform Migrations:
```bash
# Standard location
php artisan make:migration create_geo_candidate_units_table

# Ensure timestamp LATER than context migrations
# Example: 2025_12_23_040000_ (December 23rd) for platform
```

## Migration Order Execution:

### Correct Sequence:
```bash
# 1. Run DDD Context migrations FIRST (they're dependencies)
php artisan migrate \
    --path=app/Contexts/Geography/Infrastructure/Database/Migrations \
    --database=landlord \
    --force

# 2. Run Platform migrations SECOND (they depend on contexts)
php artisan migrate \
    --database=landlord \
    --force
```

### Testing Environment:
```bash
# Reset and migrate in correct order
php artisan migrate:fresh \
    --path=app/Contexts/Geography/Infrastructure/Database/Migrations \
    --database=landlord \
    --env=testing \
    --force

php artisan migrate \
    --database=landlord \
    --env=testing \
    --force
```

## Foreign Key Handling in DDD:

### Rule: Context tables → Platform tables = ✅
### Rule: Platform tables → Context tables = ✅ (with proper migration order)
### Rule: Cross-database foreign keys = ❌ (Not supported in PostgreSQL)

### Example: Platform migration depending on Context table:
```php
// ✅ CORRECT - After context migration runs first
public function up(): void
{
    Schema::create('geo_candidate_units', function (Blueprint $table) {
        // This works because geo_administrative_units exists from Geography context
        $table->foreign('official_unit_id')
              ->references('id')
              ->on('geo_administrative_units');
    });
}
```

### Safe Migration Template with Dependency Check:
```php
public function up(): void
{
    Schema::create('dependent_table', function (Blueprint $table) {
        // Create column without foreign key first
        $table->unsignedBigInteger('context_table_id')->nullable();
        
        // ... other columns
    });
    
    // Add foreign key separately if table exists
    if (Schema::hasTable('context_table_name')) {
        Schema::table('dependent_table', function (Blueprint $table) {
            $table->foreign('context_table_id')
                  ->references('id')
                  ->on('context_table_name')
                  ->nullOnDelete();
        });
    }
}
```

## Testing Setup for DDD Migrations:

```php
protected function setUp(): void
{
    parent::setUp();
    
    // Set to landlord database
    config(['database.default' => 'landlord']);
    
    // 1. Run DDD Context migrations FIRST
    $this->artisan('migrate', [
        '--path' => 'app/Contexts/Geography/Infrastructure/Database/Migrations',
        '--database' => 'landlord',
        '--force' => true,
    ]);
    
    // 2. Run Platform migrations SECOND
    $this->artisan('migrate', [
        '--database' => 'landlord',
        '--force' => true,
    ]);
}
```

## Common Error Patterns & Solutions:

### Error: "Relation [table_name] does not exist"
**Cause**: Migration order wrong or table in different database
**Solution**:
```bash
# Check migration order
php artisan migrate:status --database=landlord

# Verify table exists
php artisan tinker
>>> DB::connection('landlord')->select("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'missing_table')");
```

### Error: "Cross-database foreign key references are not supported"
**Cause**: Trying to reference table in different database
**Solution**: All referenced tables must be in same (landlord) database

## Migration Audit Commands:

```bash
# List all migrations and their order
php artisan migrate:status --database=landlord

# Check which tables exist in landlord DB
php artisan tinker --execute="print_r(DB::connection('landlord')->select('SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name', ['public']))"

# Reset everything and start fresh
php artisan migrate:fresh --database=landlord --force \
    && php artisan migrate --path=app/Contexts/*/Infrastructure/Database/Migrations --database=landlord --force
```

## Production Deployment Script:

```bash
#!/bin/bash
# deploy-migrations.sh

set -e  # Exit on error

echo "Starting migration deployment..."

# Run DDD Context migrations (alphabetical order if multiple contexts)
for context in Geography Membership Billing; do
    if [ -d "app/Contexts/$context/Infrastructure/Database/Migrations" ]; then
        echo "Running $context context migrations..."
        php artisan migrate \
            --path="app/Contexts/$context/Infrastructure/Database/Migrations" \
            --database=landlord \
            --force
    fi
done

# Run Platform migrations
echo "Running platform migrations..."
php artisan migrate --database=landlord --force

echo "Migration deployment completed successfully!"
```

## Claude Response Template:

When asked about migration issues in DDD context:

```
**Analysis**: Cross-context dependency issue between [ContextName] and platform migrations.

**Solution Steps**:
1. ✅ Verify [ContextName] migrations exist in `app/Contexts/[ContextName]/Infrastructure/Database/Migrations/`
2. ✅ Check migration timestamps: Context migrations should be EARLIER than dependent platform migrations
3. ✅ Run migrations in correct order:
   ```bash
   # Context first
   php artisan migrate --path=app/Contexts/[ContextName]/Infrastructure/Database/Migrations --database=landlord --force
   
   # Platform second
   php artisan migrate --database=landlord --force
   ```
4. ✅ For testing: Update test `setUp()` to run context migrations before platform migrations

**Prevention**: Use migration order script or custom Artisan command to ensure correct execution sequence.
```

## Key Principles for Claude to Remember:

1. **DDD Contexts = Independent Domains** with their own migrations
2. **Migration Order = Timestamp-based** - Contexts before Platform
3. **Foreign Keys = Same Database Only** - No cross-database references
4. **Testing = Sequential Migration Execution** - Context → Platform order
5. **Connection = Default/Landlord** for all shared tables

This ensures Claude properly handles the DDD migration architecture with cross-context dependencies.
Perfect! Now the Geography context tables (`countries` and `geo_administrative_units`) are created. Now you can run your main migrations:

## Step 1: First, rollback the failed `geo_candidate_units` migration:
```bash
php artisan migrate:rollback --database=landlord --step=1 --env=testing
```

## Step 2: Update your `geo_candidate_units` migration:
Since the referenced tables now exist, you can **add the foreign keys back**:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('geo_candidate_units', function (Blueprint $table) {
            $table->id();

            // Candidate information
            $table->string('name_proposed');
            $table->string('name_original')->nullable();
            $table->string('country_code', 2);
            $table->integer('admin_level'); // 1-4
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('parent_path')->nullable(); // ltree path of parent

            // Source information
            $table->enum('source_type', ['USER_SUBMISSION', 'TENANT_SUGGESTION', 'SYSTEM_DETECTED']);
            $table->unsignedBigInteger('source_tenant_id')->nullable();
            $table->unsignedBigInteger('source_user_id')->nullable();
            $table->text('source_description')->nullable();

            // Fuzzy matching results
            $table->jsonb('potential_matches')->nullable();
            $table->string('suggested_correction')->nullable();
            $table->float('confidence_score')->default(0); // 0-1 confidence

            // Review workflow
            $table->enum('review_status', [
                'PENDING',
                'UNDER_REVIEW',
                'APPROVED',
                'REJECTED',
                'MERGED',
                'DUPLICATE'
            ])->default('PENDING');

            // ✅ Now these foreign keys will work because tables exist
            $table->foreignId('reviewed_by')->nullable()->constrained('users');
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();

            // ✅ Now this foreign key will work because geo_administrative_units exists
            $table->unsignedBigInteger('official_unit_id')->nullable();
            $table->foreign('official_unit_id')->references('id')->on('geo_administrative_units');

            // Statistics
            $table->integer('usage_count')->default(0);
            $table->jsonb('tenant_usage')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index(['country_code', 'admin_level', 'review_status']);
            $table->index(['name_proposed', 'country_code']);
            $table->index(['source_tenant_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('geo_candidate_units');
    }
};
```

## Step 3: Run all main migrations:
```bash
php artisan migrate --database=landlord --env=testing --force
```

## Step 4: Verify everything worked:
```bash
php artisan tinker --env=testing
```

```php
// Check all tables exist
DB::connection('landlord')->select("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");

// Check foreign keys
DB::select("
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    ORDER BY tc.table_name;
");
```

## For Future Testing/Development:
Create a migration script that ensures proper order:

```bash
#!/bin/bash
# migrate-all.sh

# 1. Run Geography context migrations first
php artisan migrate --path=app/Contexts/Geography/Infrastructure/Database/Migrations --database=landlord --force

# 2. Run all other migrations
php artisan migrate --database=landlord --force

echo "All migrations completed successfully!"
```

## Summary of What We Learned:

1. **DDD Contexts have separate migrations** - Geography context lives in `app/Contexts/Geography/`
2. **Migration order matters** - Dependent tables must exist first
3. **Foreign keys need referenced tables** - Can't reference non-existent tables
4. **Run migrations in sequence** - Geography first, then platform migrations

**Now run your migration and it should work!** The foreign keys will succeed because:
- ✅ `users` table exists (from your earlier migration)
- ✅ `geo_administrative_units` table exists (from Geography context)
- ✅ All in same database (`publicdigit`/landlord)