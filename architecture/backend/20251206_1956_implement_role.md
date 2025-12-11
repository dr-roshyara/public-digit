You're absolutely right! Since this is tenant-specific RBAC logic, it should be in the **TenantAuth Context**, not in the global migrations folder. This maintains clean DDD separation.

## 🎯 **Claude CLI Instructions for TenantAuth Context Migration**

### **Step 1: Create the Migration in TenantAuth Context**

```bash
# Navigate to your context migrations directory
cd packages/laravel-backend/app/Contexts/TenantAuth/Infrastructure/Database

# Create the migrations directory if it doesn't exist
mkdir -p Migrations

# Create the migration file
cat > Migrations/2025_12_07_000000_add_tenant_columns_to_spatie_tables.php << 'EOF'
<?php

namespace App\Contexts\TenantAuth\Infrastructure\Database\Migrations;

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
        // ============================================
        // ADD CUSTOM COLUMNS TO ROLES TABLE
        // ============================================
        if (Schema::hasTable('roles')) {
            Schema::table('roles', function (Blueprint $table) {
                // Add tenant_id for multi-tenant isolation
                if (!Schema::hasColumn('roles', 'tenant_id')) {
                    $table->unsignedBigInteger('tenant_id')->nullable()->after('id');
                    $table->index('tenant_id', 'roles_tenant_id_index');
                }

                // Add custom role code (unique identifier)
                if (!Schema::hasColumn('roles', 'code')) {
                    $table->string('code', 50)->nullable()->after('name');
                    $table->index('code', 'roles_code_index');
                }

                // Add scope type (global vs unit-level)
                if (!Schema::hasColumn('roles', 'scope_type')) {
                    $table->enum('scope_type', ['global', 'unit'])
                          ->default('unit')
                          ->after('code');
                    $table->index('scope_type', 'roles_scope_type_index');
                }

                // Add system role flag
                if (!Schema::hasColumn('roles', 'is_system_role')) {
                    $table->boolean('is_system_role')->default(false)->after('scope_type');
                }

                // Add hierarchy level for UI ordering
                if (!Schema::hasColumn('roles', 'hierarchy_level')) {
                    $table->unsignedInteger('hierarchy_level')->nullable()->after('is_system_role');
                    $table->index('hierarchy_level', 'roles_hierarchy_level_index');
                }

                // Add default permissions JSON
                if (!Schema::hasColumn('roles', 'default_permissions')) {
                    $table->json('default_permissions')->nullable()->after('tenant_id')
                          ->comment('Default permissions template for this role');
                }

                // Add metadata JSON
                if (!Schema::hasColumn('roles', 'metadata')) {
                    $table->json('metadata')->nullable()->after('default_permissions');
                }

                // Ensure soft deletes are present
                if (!Schema::hasColumn('roles', 'deleted_at')) {
                    $table->softDeletes();
                }

                // Add composite unique constraint for tenant_id + code
                $sm = Schema::getConnection()->getDoctrineSchemaManager();
                $indexes = $sm->listTableIndexes('roles');
                
                if (!array_key_exists('roles_tenant_id_code_unique', $indexes)) {
                    $table->unique(['tenant_id', 'code'], 'roles_tenant_id_code_unique');
                }
            });
        }

        // ============================================
        // ADD CUSTOM COLUMNS TO PERMISSIONS TABLE
        // ============================================
        if (Schema::hasTable('permissions')) {
            Schema::table('permissions', function (Blueprint $table) {
                // Add tenant_id for multi-tenant isolation
                if (!Schema::hasColumn('permissions', 'tenant_id')) {
                    $table->unsignedBigInteger('tenant_id')->nullable()->after('id');
                    $table->index('tenant_id', 'permissions_tenant_id_index');
                }

                // Add global permission flag
                if (!Schema::hasColumn('permissions', 'is_global')) {
                    $table->boolean('is_global')->default(false)->after('tenant_id');
                    $table->index('is_global', 'permissions_is_global_index');
                }

                // Add category for grouping
                if (!Schema::hasColumn('permissions', 'category')) {
                    $table->string('category', 50)->nullable()->after('name');
                    $table->index('category', 'permissions_category_index');
                }

                // Add metadata JSON
                if (!Schema::hasColumn('permissions', 'metadata')) {
                    $table->json('metadata')->nullable()->after('guard_name');
                }
            });
        }

        // ============================================
        // ENHANCE MODEL_HAS_ROLES FOR TENANT CONTEXT
        // ============================================
        if (Schema::hasTable('model_has_roles')) {
            Schema::table('model_has_roles', function (Blueprint $table) {
                // Add organizational unit context for unit-scoped roles
                if (!Schema::hasColumn('model_has_roles', 'organizational_unit_id')) {
                    $table->unsignedBigInteger('organizational_unit_id')
                          ->nullable()
                          ->after('model_id')
                          ->comment('For unit-scoped roles, specifies which org unit');
                }

                // Add assignment tracking
                if (!Schema::hasColumn('model_has_roles', 'assigned_by')) {
                    $table->unsignedBigInteger('assigned_by')
                          ->nullable()
                          ->after('organizational_unit_id');
                }

                if (!Schema::hasColumn('model_has_roles', 'assigned_at')) {
                    $table->timestamp('assigned_at')
                          ->nullable()
                          ->after('assigned_by')
                          ->useCurrent();
                }

                // Add index for organizational unit queries
                $sm = Schema::getConnection()->getDoctrineSchemaManager();
                $indexes = $sm->listTableIndexes('model_has_roles');
                
                if (!array_key_exists('model_has_roles_org_unit_index', $indexes)) {
                    $table->index('organizational_unit_id', 'model_has_roles_org_unit_index');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove custom columns from roles
        if (Schema::hasTable('roles')) {
            Schema::table('roles', function (Blueprint $table) {
                $customColumns = [
                    'tenant_id', 'code', 'scope_type', 'is_system_role',
                    'hierarchy_level', 'default_permissions', 'metadata'
                ];

                foreach ($customColumns as $column) {
                    if (Schema::hasColumn('roles', $column)) {
                        $table->dropColumn($column);
                    }
                }

                // Remove soft deletes if we added them
                if (Schema::hasColumn('roles', 'deleted_at')) {
                    $table->dropColumn('deleted_at');
                }

                // Remove custom indexes
                $sm = Schema::getConnection()->getDoctrineSchemaManager();
                $indexes = $sm->listTableIndexes('roles');

                $indexesToRemove = [
                    'roles_tenant_id_index',
                    'roles_code_index',
                    'roles_scope_type_index',
                    'roles_hierarchy_level_index',
                    'roles_tenant_id_code_unique',
                ];

                foreach ($indexesToRemove as $index) {
                    if (array_key_exists($index, $indexes)) {
                        $table->dropIndex($index);
                    }
                }
            });
        }

        // Remove custom columns from permissions
        if (Schema::hasTable('permissions')) {
            Schema::table('permissions', function (Blueprint $table) {
                $customColumns = ['tenant_id', 'is_global', 'category', 'metadata'];

                foreach ($customColumns as $column) {
                    if (Schema::hasColumn('permissions', $column)) {
                        $table->dropColumn($column);
                    }
                }

                // Remove custom indexes
                $sm = Schema::getConnection()->getDoctrineSchemaManager();
                $indexes = $sm->listTableIndexes('permissions');

                $indexesToRemove = [
                    'permissions_tenant_id_index',
                    'permissions_is_global_index',
                    'permissions_category_index',
                ];

                foreach ($indexesToRemove as $index) {
                    if (array_key_exists($index, $indexes)) {
                        $table->dropIndex($index);
                    }
                }
            });
        }

        // Remove enhancements from model_has_roles
        if (Schema::hasTable('model_has_roles')) {
            Schema::table('model_has_roles', function (Blueprint $table) {
                $customColumns = ['organizational_unit_id', 'assigned_by', 'assigned_at'];

                foreach ($customColumns as $column) {
                    if (Schema::hasColumn('model_has_roles', $column)) {
                        $table->dropColumn($column);
                    }
                }

                // Remove custom index
                $sm = Schema::getConnection()->getDoctrineSchemaManager();
                $indexes = $sm->listTableIndexes('model_has_roles');

                if (array_key_exists('model_has_roles_org_unit_index', $indexes)) {
                    $table->dropIndex('model_has_roles_org_unit_index');
                }
            });
        }
    }
};
EOF
```

### **Step 2: Verify the Models are Correct**

```bash
# Check TenantRole model extends SpatieRole correctly
cat > app/Contexts/TenantAuth/Domain/Models/TenantRole.php << 'EOF'
<?php

namespace App\Contexts\TenantAuth\Domain\Models;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Permission\Models\Role as SpatieRole;

class TenantRole extends SpatieRole
{
    protected $fillable = [
        'name',
        'guard_name',       // Required by Spatie
        'is_default',       // From Spatie's schema
        'description',      // From Spatie's schema
        'category',         // From Spatie's schema
        'code',             // Your custom: unique role identifier
        'scope_type',       // Your custom: 'global' or 'unit'
        'is_system_role',   // Your custom: system-defined role
        'hierarchy_level',  // Your custom: UI ordering
        'tenant_id',        // Your custom: tenant isolation
        'default_permissions', // Your custom: permission template
        'metadata',         // Your custom: additional data
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_system_role' => 'boolean',
        'hierarchy_level' => 'integer',
        'default_permissions' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get the tenant that owns the role.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Scope a query to only include roles for a specific tenant.
     */
    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Scope a query to only include global roles.
     */
    public function scopeGlobal($query)
    {
        return $query->where('scope_type', 'global');
    }

    /**
     * Scope a query to only include unit-scoped roles.
     */
    public function scopeUnitScoped($query)
    {
        return $query->where('scope_type', 'unit');
    }

    /**
     * Find a role by its code for a specific tenant.
     */
    public static function findByCode(string $code, $tenantId = null): ?self
    {
        $query = static::where('code', $code);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->first();
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            // Auto-generate code from name if not provided
            if (empty($model->code) && !empty($model->name)) {
                $model->code = strtolower(str_replace(' ', '_', $model->name));
            }

            // Ensure guard_name is set (Spatie requires this)
            if (empty($model->guard_name)) {
                $model->guard_name = 'web';
            }
        });
    }
}
EOF
```

### **Step 3: Create TenantPermission Model**

```bash
cat > app/Contexts/TenantAuth/Domain/Models/TenantPermission.php << 'EOF'
<?php

namespace App\Contexts\TenantAuth\Domain\Models;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Permission\Models\Permission as SpatiePermission;

class TenantPermission extends SpatiePermission
{
    protected $fillable = [
        'name',
        'guard_name',       // Required by Spatie
        'tenant_id',        // Your custom: tenant isolation
        'is_global',        // Your custom: global vs tenant-specific
        'category',         // Your custom: permission grouping
        'metadata',         // Your custom: additional data
    ];

    protected $casts = [
        'is_global' => 'boolean',
        'metadata' => 'array',
    ];

    /**
     * Get the tenant that owns the permission.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Scope a query to only include permissions for a specific tenant.
     */
    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Scope a query to only include global permissions.
     */
    public function scopeGlobal($query)
    {
        return $query->where('is_global', true);
    }

    /**
     * Scope a query to only include tenant-specific permissions.
     */
    public function scopeTenantSpecific($query)
    {
        return $query->where('is_global', false);
    }

    /**
     * Find a permission by name for a specific tenant.
     */
    public static function findByNameForTenant(string $name, $tenantId, $guardName = null): ?self
    {
        $query = static::where('name', $name)
            ->where('tenant_id', $tenantId);

        if ($guardName) {
            $query->where('guard_name', $guardName);
        }

        return $query->first();
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            // Ensure guard_name is set
            if (empty($model->guard_name)) {
                $model->guard_name = 'web';
            }
        });
    }
}
EOF
```

### **Step 4: Mark Problematic Migrations as Completed**

```bash
# Create a CLI command to fix migrations
cat > tools/fix-tenant-migrations.sh << 'EOF'
#!/bin/bash

echo "🔧 Fixing Tenant Migrations"
echo "==========================="

# List of problematic migrations to mark as completed
MIGRATIONS=(
    "2025_12_06_170000_create_roles_table"
    "2025_12_06_180000_create_permissions_table"
    "2025_12_06_190000_create_role_permission_table"
)

TENANT_SLUG="test_tenant"

echo "Processing tenant: $TENANT_SLUG"
echo ""

for MIGRATION in "${MIGRATIONS[@]}"; do
    echo "Checking: $MIGRATION"
    
    php -r "
    // Find tenant
    \$tenant = \App\Models\Tenant::where('slug', '$TENANT_SLUG')->first();
    
    if (!\$tenant) {
        echo '  ❌ Tenant not found\n';
        exit(1);
    }
    
    // Switch to tenant context
    \$tenant->makeCurrent();
    
    // Check if migration already recorded
    \$exists = \Illuminate\Support\Facades\DB::connection('tenant')
        ->table('migrations')
        ->where('migration', '$MIGRATION')
        ->exists();
    
    if (!\$exists) {
        // Get next batch number
        \$batch = \Illuminate\Support\Facades\DB::connection('tenant')
            ->table('migrations')
            ->max('batch') ?? 0;
        
        // Mark as completed
        \Illuminate\Support\Facades\DB::connection('tenant')
            ->table('migrations')
            ->insert([
                'migration' => '$MIGRATION',
                'batch' => \$batch + 1,
            ]);
        
        echo '  ✅ Marked as completed\n';
    } else {
        echo '  ℹ️  Already recorded\n';
    }
    "
done

echo ""
echo "✅ Migration fixes applied!"
EOF

chmod +x tools/fix-tenant-migrations.sh
```

### **Step 5: Run the Fix & Migration**

```bash
# 1. First mark problematic migrations as completed
./tools/fix-tenant-migrations.sh

# 2. Run your new TenantAuth context migration
php artisan tenants:artisan "migrate --database=tenant --path=app/Contexts/TenantAuth/Infrastructure/Database/Migrations" --tenant=test_tenant

# 3. Verify the migration worked
php artisan tinker

>>> $tenant = \App\Models\Tenant::where('slug', 'test_tenant')->first();
>>> $tenant->makeCurrent();
>>> 
>>> // Check if custom columns were added
>>> $columns = \Illuminate\Support\Facades\DB::connection('tenant')->select("DESCRIBE roles");
>>> $customColumns = ['tenant_id', 'code', 'scope_type', 'is_system_role', 'hierarchy_level', 'default_permissions', 'metadata'];
>>> 
>>> echo "Custom columns in roles table:\n";
>>> foreach ($customColumns as $col) {
...     $exists = collect($columns)->contains(function($item) use ($col) {
...         return $item->Field === $col;
...     });
...     echo "  $col: " . ($exists ? '✅' : '❌') . "\n";
... }
>>> exit
```

### **Step 6: Update Config/Verify**

```bash
# Check your config/permission.php points to correct models
cat config/permission.php | grep -A2 "models.*=>"

# Should show:
# 'permission' => App\Contexts\TenantAuth\Domain\Models\TenantPermission::class,
# 'role' => App\Contexts\TenantAuth\Domain\Models\TenantRole::class,

# Clear cache
php artisan config:clear
php artisan cache:clear
```

## 🎯 **Summary CLI Commands:**

```bash
# 1. Create migration in TenantAuth context
mkdir -p app/Contexts/TenantAuth/Infrastructure/Database/Migrations
# [Copy migration content from Step 1]

# 2. Ensure models are correct
# [Copy model content from Steps 2 & 3]

# 3. Mark old migrations as completed
./tools/fix-tenant-migrations.sh

# 4. Run the new migration
php artisan tenants:artisan "migrate --database=tenant --path=app/Contexts/TenantAuth/Infrastructure/Database/Migrations" --tenant=test_tenant

# 5. Verify
php artisan tinker
# [Run verification code]
```

This keeps your DDD structure clean with tenant-specific RBAC logic in the TenantAuth context where it belongs!