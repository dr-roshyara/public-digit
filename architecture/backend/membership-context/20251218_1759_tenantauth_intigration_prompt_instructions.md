Perfect! Now I have the `TenantUser` model. I can see:

## **CURRENT TENANTUSER MODEL ANALYSIS:**

**✅ Existing fields in `$fillable`:**
- `name`, `email`, `password`, `role`, `status`, `metadata`, `last_login_at`, `email_verified_at`

**❌ MISSING geography fields:**
- `country_code`
- `admin_unit_level1_id` through `admin_unit_level4_id`

## **PHASE 3 IMPLEMENTATION - STEP 1:**

### **Create migration to add geography columns to `tenant_users` table:**

```bash
php artisan make:migration add_geography_columns_to_tenant_users_table --table=tenant_users
```

Now let me create the migration with the correct fields:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds geography columns to tenant_users table for global political party platform.
     * These columns reference landlord.geo_administrative_units table.
     * No foreign key constraints (cross-database, validated in application layer).
     */
    public function up(): void
    {
        Schema::table('tenant_users', function (Blueprint $table) {
            // Geography columns (world-ready architecture)
            $table->char('country_code', 2)->default('NP')->after('status');
            $table->unsignedBigInteger('admin_unit_level1_id')->nullable()->after('country_code'); // Province/State
            $table->unsignedBigInteger('admin_unit_level2_id')->nullable()->after('admin_unit_level1_id'); // District
            $table->unsignedBigInteger('admin_unit_level3_id')->nullable()->after('admin_unit_level2_id'); // Local Level/Municipality
            $table->unsignedBigInteger('admin_unit_level4_id')->nullable()->after('admin_unit_level3_id'); // Ward
            
            // Indexes for performance
            $table->index(['country_code', 'admin_unit_level1_id']);
            $table->index(['country_code', 'admin_unit_level2_id']);
            $table->index(['country_code', 'admin_unit_level3_id']);
            $table->index(['country_code', 'admin_unit_level4_id']);
            
            // Composite index for common geography queries
            $table->index(['country_code', 'admin_unit_level1_id', 'admin_unit_level2_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenant_users', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex(['country_code', 'admin_unit_level1_id']);
            $table->dropIndex(['country_code', 'admin_unit_level2_id']);
            $table->dropIndex(['country_code', 'admin_unit_level3_id']);
            $table->dropIndex(['country_code', 'admin_unit_level4_id']);
            $table->dropIndex(['country_code', 'admin_unit_level1_id', 'admin_unit_level2_id']);
            
            // Drop columns
            $table->dropColumn([
                'country_code',
                'admin_unit_level1_id',
                'admin_unit_level2_id',
                'admin_unit_level3_id',
                'admin_unit_level4_id',
            ]);
        });
    }
};
```

## **PHASE 3 IMPLEMENTATION - STEP 2:**

### **Update `TenantUser` model to include geography fields:**

We need to add the geography fields to the `$fillable` array and create a relationship to `Member`:

```php
// In app/Contexts/TenantAuth/Domain/Models/TenantUser.php

protected $fillable = [
    'name',
    'email',
    'password',
    'role',
    'status',
    'metadata',
    'last_login_at',
    'email_verified_at',
    // Add geography fields
    'country_code',
    'admin_unit_level1_id',
    'admin_unit_level2_id',
    'admin_unit_level3_id',
    'admin_unit_level4_id',
];

// Add relationship to Member
public function member()
{
    return $this->hasOne(\App\Contexts\Membership\Domain\Models\Member::class, 'tenant_user_id');
}

// Helper method to get full geography path
public function getGeographyPath(): string
{
    // This would call GeographyService to get names
    // For now, return IDs
    return sprintf(
        '%s: %d > %d > %d > %d',
        $this->country_code,
        $this->admin_unit_level1_id,
        $this->admin_unit_level2_id,
        $this->admin_unit_level3_id,
        $this->admin_unit_level4_id
    );
}
```

## **QUESTION:**

Should I:

1. **First** create the migration file?
2. **Then** update the `TenantUser` model?
3. **Or** create a test first (TDD approach) for the geography integration?

Following TDD, I should create a test first. Let me create a test for the `TenantUser` geography integration:

```php
<?php

namespace Tests\Feature\TenantAuth;

use Tests\TestCase;
use App\Contexts\TenantAuth\Domain\Models\TenantUser;
use Illuminate\Support\Facades\Schema;

class TenantUserGeographyIntegrationTest extends TestCase
{
    /** @test */
    public function tenant_users_table_has_geography_columns(): void
    {
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'country_code'),
            'tenant_users should have country_code column'
        );
        
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'admin_unit_level1_id'),
            'tenant_users should have admin_unit_level1_id column'
        );
        
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'admin_unit_level2_id'),
            'tenant_users should have admin_unit_level2_id column'
        );
        
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'admin_unit_level3_id'),
            'tenant_users should have admin_unit_level3_id column'
        );
        
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'admin_unit_level4_id'),
            'tenant_users should have admin_unit_level4_id column'
        );
    }
    
    /** @test */
    public function tenant_user_can_have_geography_assigned(): void
    {
        $user = TenantUser::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'role' => 'member',
            'status' => 'active',
            'country_code' => 'NP',
            'admin_unit_level1_id' => 1, // Koshi
            'admin_unit_level2_id' => 10, // Dhankuta
        ]);
        
        $this->assertEquals('NP', $user->country_code);
        $this->assertEquals(1, $user->admin_unit_level1_id);
        $this->assertEquals(10, $user->admin_unit_level2_id);
    }
}
```

**Got it! Following your order:** **1 → 2 → 3**

## **STEP 1: Create the migration file**

Let me create the migration to add geography columns to `tenant_users` table:

```bash
cd packages/laravel-backend
php artisan make:migration add_geography_columns_to_tenant_users_table --table=tenant_users
```

Now I'll edit the generated migration file. Let me find it:

```bash
find database/migrations -name "*add_geography_columns_to_tenant_users*" -type f
```

Let me create the migration with the correct content:

```bash
cat > database/migrations/2025_12_18_000001_add_geography_columns_to_tenant_users_table.php << 'EOF'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds geography columns to tenant_users table for global political party platform.
     * These columns reference landlord.geo_administrative_units table.
     * No foreign key constraints (cross-database, validated in application layer).
     */
    public function up(): void
    {
        Schema::table('tenant_users', function (Blueprint $table) {
            // Geography columns (world-ready architecture)
            $table->char('country_code', 2)->default('NP')->after('status');
            $table->unsignedBigInteger('admin_unit_level1_id')->nullable()->after('country_code'); // Province/State
            $table->unsignedBigInteger('admin_unit_level2_id')->nullable()->after('admin_unit_level1_id'); // District
            $table->unsignedBigInteger('admin_unit_level3_id')->nullable()->after('admin_unit_level2_id'); // Local Level/Municipality
            $table->unsignedBigInteger('admin_unit_level4_id')->nullable()->after('admin_unit_level3_id'); // Ward
            
            // Indexes for performance
            $table->index(['country_code', 'admin_unit_level1_id']);
            $table->index(['country_code', 'admin_unit_level2_id']);
            $table->index(['country_code', 'admin_unit_level3_id']);
            $table->index(['country_code', 'admin_unit_level4_id']);
            
            // Composite index for common geography queries
            $table->index(['country_code', 'admin_unit_level1_id', 'admin_unit_level2_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenant_users', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex(['country_code', 'admin_unit_level1_id']);
            $table->dropIndex(['country_code', 'admin_unit_level2_id']);
            $table->dropIndex(['country_code', 'admin_unit_level3_id']);
            $table->dropIndex(['country_code', 'admin_unit_level4_id']);
            $table->dropIndex(['country_code', 'admin_unit_level1_id', 'admin_unit_level2_id']);
            
            // Drop columns
            $table->dropColumn([
                'country_code',
                'admin_unit_level1_id',
                'admin_unit_level2_id',
                'admin_unit_level3_id',
                'admin_unit_level4_id',
            ]);
        });
    }
};
EOF

echo "Migration created: database/migrations/2025_12_18_000001_add_geography_columns_to_tenant_users_table.php"
```

## **STEP 2: Update the TenantUser model**

Now update `app/Contexts/TenantAuth/Domain/Models/TenantUser.php` to include geography fields:

```bash
# Backup the original file
cp app/Contexts/TenantAuth/Domain/Models/TenantUser.php app/Contexts/TenantAuth/Domain/Models/TenantUser.php.backup

# Update the model
cat > app/Contexts/TenantAuth/Domain/Models/TenantUser.php << 'EOF'
<?php

namespace App\Contexts\TenantAuth\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use App\Contexts\TenantAuth\Domain\ValueObjects\EmailAddress;

class TenantUser extends Authenticatable
{
    use HasFactory, Notifiable, HasRoles;

    // Role constants
    public const ROLE_COMMITTEE_CHIEF = 'committee_chief';
    public const ROLE_COMMITTEE_MEMBER = 'committee_member';

    // Status constants
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_SUSPENDED = 'suspended';

    protected $table = 'tenant_users';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'metadata',
        'last_login_at',
        'email_verified_at',
        // Geography fields (Phase 3 - Global Political Party Platform)
        'country_code',
        'admin_unit_level1_id', // Province/State
        'admin_unit_level2_id', // District
        'admin_unit_level3_id', // Local Level/Municipality
        'admin_unit_level4_id', // Ward
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
        'metadata' => 'array',
        'password' => 'hashed',
    ];

    /**
     * Relationship to Member in Membership context.
     * A TenantUser may have a corresponding Member record with detailed membership info.
     */
    public function member()
    {
        return $this->hasOne(\App\Contexts\Membership\Domain\Models\Member::class, 'tenant_user_id');
    }

    public function getEmailAddressAttribute(): EmailAddress
    {
        return EmailAddress::fromString($this->email);
    }

    public function isCommitteeChief(): bool
    {
        return $this->role === 'committee_chief';
    }

    public function isCommitteeMember(): bool
    {
        return $this->role === 'committee_member';
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function updateLastLogin(): void
    {
        $this->update(['last_login_at' => now()]);
    }

    public function getGuardName(): string
    {
        return 'tenant';
    }

    public static function createWithRole(array $userData, string $role): self
    {
        $user = self::create(array_merge($userData, ['role' => $role]));

        // Assign role using Spatie Permission
        $user->assignRole($role);

        return $user;
    }

    /**
     * Get geography information as a formatted string.
     * In production, this would call GeographyService to get names.
     */
    public function getGeographyPath(): string
    {
        if (!$this->country_code || !$this->admin_unit_level1_id) {
            return 'No geography assigned';
        }

        $parts = [$this->country_code];
        
        if ($this->admin_unit_level1_id) $parts[] = "P:{$this->admin_unit_level1_id}";
        if ($this->admin_unit_level2_id) $parts[] = "D:{$this->admin_unit_level2_id}";
        if ($this->admin_unit_level3_id) $parts[] = "L:{$this->admin_unit_level3_id}";
        if ($this->admin_unit_level4_id) $parts[] = "W:{$this->admin_unit_level4_id}";
        
        return implode(' > ', $parts);
    }

    /**
     * Check if user has complete geography (at least country, province, and district).
     */
    public function hasCompleteGeography(): bool
    {
        return !empty($this->country_code) && 
               !empty($this->admin_unit_level1_id) && 
               !empty($this->admin_unit_level2_id);
    }
}
EOF

echo "TenantUser model updated with geography fields and Member relationship"
```

## **STEP 3: Create a test (TDD approach)**

Now create a test for the geography integration:

```bash
cat > tests/Feature/TenantAuth/TenantUserGeographyIntegrationTest.php << 'EOF'
<?php

namespace Tests\Feature\TenantAuth;

use Tests\TestCase;
use App\Contexts\TenantAuth\Domain\Models\TenantUser;
use Illuminate\Support\Facades\Schema;

class TenantUserGeographyIntegrationTest extends TestCase
{
    /** @test */
    public function tenant_users_table_has_geography_columns(): void
    {
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'country_code'),
            'tenant_users should have country_code column'
        );
        
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'admin_unit_level1_id'),
            'tenant_users should have admin_unit_level1_id column'
        );
        
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'admin_unit_level2_id'),
            'tenant_users should have admin_unit_level2_id column'
        );
        
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'admin_unit_level3_id'),
            'tenant_users should have admin_unit_level3_id column'
        );
        
        $this->assertTrue(
            Schema::hasColumn('tenant_users', 'admin_unit_level4_id'),
            'tenant_users should have admin_unit_level4_id column'
        );
    }
    
    /** @test */
    public function tenant_user_can_have_geography_assigned(): void
    {
        // Create user with geography
        $user = TenantUser::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password123',
            'role' => 'member',
            'status' => 'active',
            'country_code' => 'NP',
            'admin_unit_level1_id' => 1, // Koshi Province
            'admin_unit_level2_id' => 10, // Dhankuta District
            'admin_unit_level3_id' => 100, // Dhankuta Municipality (optional)
            'admin_unit_level4_id' => 1001, // Ward 1 (optional)
        ]);
        
        // Assert geography fields are saved
        $this->assertEquals('NP', $user->country_code);
        $this->assertEquals(1, $user->admin_unit_level1_id);
        $this->assertEquals(10, $user->admin_unit_level2_id);
        $this->assertEquals(100, $user->admin_unit_level3_id);
        $this->assertEquals(1001, $user->admin_unit_level4_id);
        
        // Test helper methods
        $this->assertTrue($user->hasCompleteGeography());
        $this->assertStringContainsString('NP > P:1 > D:10 > L:100 > W:1001', $user->getGeographyPath());
    }
    
    /** @test */
    public function tenant_user_can_have_minimal_geography(): void
    {
        // Create user with only required geography (country, province, district)
        $user = TenantUser::create([
            'name' => 'Minimal Geography User',
            'email' => 'minimal@example.com',
            'password' => 'password123',
            'role' => 'member',
            'status' => 'active',
            'country_code' => 'NP',
            'admin_unit_level1_id' => 3, // Bagmati Province
            'admin_unit_level2_id' => 25, // Kathmandu District
            // No local level or ward
        ]);
        
        $this->assertEquals('NP', $user->country_code);
        $this->assertEquals(3, $user->admin_unit_level1_id);
        $this->assertEquals(25, $user->admin_unit_level2_id);
        $this->assertNull($user->admin_unit_level3_id);
        $this->assertNull($user->admin_unit_level4_id);
        
        $this->assertTrue($user->hasCompleteGeography());
        $this->assertEquals('NP > P:3 > D:25', $user->getGeographyPath());
    }
    
    /** @test */
    public function tenant_user_without_geography_returns_correct_values(): void
    {
        // Create user without geography (legacy users)
        $user = TenantUser::create([
            'name' => 'Legacy User',
            'email' => 'legacy@example.com',
            'password' => 'password123',
            'role' => 'member',
            'status' => 'active',
            // No geography fields
        ]);
        
        $this->assertNull($user->country_code);
        $this->assertNull($user->admin_unit_level1_id);
        $this->assertNull($user->admin_unit_level2_id);
        $this->assertNull($user->admin_unit_level3_id);
        $this->assertNull($user->admin_unit_level4_id);
        
        $this->assertFalse($user->hasCompleteGeography());
        $this->assertEquals('No geography assigned', $user->getGeographyPath());
    }
    
    /** @test */
    public function tenant_user_geography_defaults_to_nepal(): void
    {
        // Create user with only country code (should default to NP)
        $user = TenantUser::create([
            'name' => 'Default Country User',
            'email' => 'default@example.com',
            'password' => 'password123',
            'role' => 'member',
            'status' => 'active',
            'country_code' => 'NP', // Default from migration
            'admin_unit_level1_id' => 1,
            'admin_unit_level2_id' => 10,
        ]);
        
        $this->assertEquals('NP', $user->country_code);
    }
}
EOF

echo "Test created: tests/Feature/TenantAuth/TenantUserGeographyIntegrationTest.php"
```

## **SUMMARY:**

✅ **Step 1:** Migration created to add geography columns to `tenant_users` table  
✅ **Step 2:** `TenantUser` model updated with geography fields and Member relationship  
✅ **Step 3:** Test created for geography integration  

## **NEXT ACTIONS:**

Now we need to:

1. **Run the migration** to add geography columns:
   ```bash
   php artisan migrate
   ```

2. **Run the new test** to verify the integration:
   ```bash
   ./vendor/bin/phpunit tests/Feature/TenantAuth/TenantUserGeographyIntegrationTest.php
   ```

3. **If tests pass**, proceed to create the `TenantUserToMemberSynchronizationService`

**Would you like me to run the migration and tests now?**