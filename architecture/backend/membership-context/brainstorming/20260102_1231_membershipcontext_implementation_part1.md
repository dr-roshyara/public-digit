# 🎯 **START WITH MEMBER MODEL REFACTORING - TDD FIRST**

## **📋 CORRECT APPROACH: TDD → Model → Migration**

### **Reasoning:**
1. **TDD defines business rules** before database structure
2. **Model reflects domain** before persistence concerns  
3. **Migration implements** what the model needs
4. **Prevents schema-first thinking** (common DDD mistake)

---

## **🚀 STEP 1: WRITE FAILING TESTS FOR BUSINESS RULES**

### **Create Test Structure:**
```bash
# Create tests for Membership context
mkdir -p tests/Unit/Contexts/Membership/Domain/Models
mkdir -p tests/Feature/Contexts/Membership
```

### **Test 1: Member Requires TenantUser (Business Rule)**

**File:** `tests/Unit/Contexts/Membership/Domain/Models/MemberTest.php`
```php
<?php

namespace Tests\Unit\Contexts\Membership\Domain\Models;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

class MemberTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function member_cannot_exist_without_tenant_user()
    {
        // This test SHOULD FAIL initially
        // We're testing the business rule
        
        $this->expectException(\Illuminate\Database\QueryException::class);
        
        // Attempt to create member without tenant_user_id
        DB::table('members')->insert([
            'full_name' => 'Test Member',
            'membership_number' => 'TEST-2024-000001',
            'status' => 'draft',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** @test */
    public function member_has_one_to_one_relationship_with_tenant_user()
    {
        // This test defines our 1:1 relationship expectation
        
        $tenantUser = \App\Contexts\TenantAuth\Domain\Models\TenantUser::factory()->create();
        
        $member = Member::create([
            'tenant_user_id' => $tenantUser->id,
            'full_name' => 'John Doe',
            'membership_number' => 'TEST-2024-000001',
            'status' => 'draft',
        ]);
        
        // Assert relationships
        $this->assertInstanceOf(
            \App\Contexts\TenantAuth\Domain\Models\TenantUser::class,
            $member->user
        );
        $this->assertEquals($tenantUser->id, $member->user->id);
        
        // Assert TenantUser has Member
        $this->assertInstanceOf(Member::class, $tenantUser->member);
        $this->assertEquals($member->id, $tenantUser->member->id);
    }

    /** @test */
    public function member_must_have_unique_membership_number()
    {
        $user1 = \App\Contexts\TenantAuth\Domain\Models\TenantUser::factory()->create();
        $user2 = \App\Contexts\TenantAuth\Domain\Models\TenantUser::factory()->create();
        
        Member::create([
            'tenant_user_id' => $user1->id,
            'full_name' => 'John Doe',
            'membership_number' => 'TEST-2024-000001',
            'status' => 'draft',
        ]);
        
        $this->expectException(\Illuminate\Database\QueryException::class);
        
        Member::create([
            'tenant_user_id' => $user2->id,
            'full_name' => 'Jane Doe',
            'membership_number' => 'TEST-2024-000001', // Same number
            'status' => 'draft',
        ]);
    }

    /** @test */
    public function member_can_be_registered_with_factory_method()
    {
        // Test our business-friendly factory method
        $member = Member::register(
            memberData: [
                'full_name' => 'John Doe',
                'phone' => '+9779800000000',
                'email' => 'john@example.com',
            ],
            userData: [
                'email' => 'john@example.com',
                'password' => 'password123',
            ]
        );
        
        $this->assertInstanceOf(Member::class, $member);
        $this->assertNotNull($member->tenant_user_id);
        $this->assertNotNull($member->membership_number);
        $this->assertEquals('pending', $member->status);
        $this->assertTrue($member->user->isMember());
    }

    /** @test */
    public function member_lifecycle_follows_business_rules()
    {
        $member = Member::register(
            ['full_name' => 'John Doe', 'phone' => '+9779800000000'],
            ['email' => 'john@example.com', 'password' => 'password']
        );
        
        // Initial state
        $this->assertEquals('pending', $member->status);
        
        // Can be approved
        $member->approve(1); // Approved by user ID 1
        $this->assertEquals('approved', $member->status);
        $this->assertNotNull($member->approved_at);
        $this->assertTrue($member->user->is_active);
        
        // Can be activated
        $member->activate();
        $this->assertEquals('active', $member->status);
        $this->assertNotNull($member->activated_at);
        
        // Cannot approve non-pending member
        $this->expectException(\Exception::class);
        $member->approve(1);
    }

    /** @test */
    public function geography_is_optional_for_members()
    {
        $member = Member::register(
            ['full_name' => 'John Doe', 'phone' => '+9779800000000'],
            ['email' => 'john@example.com', 'password' => 'password']
        );
        
        // Member can exist without geography
        $this->assertFalse($member->hasGeography());
        
        // Can add geography later
        $member->assignGeography('np.3.15.234.1.2');
        $this->assertTrue($member->hasGeography());
        $this->assertEquals('np.3.15.234.1.2', $member->geography_reference);
    }
}
```

### **Run Tests (Should Fail):**
```bash
php artisan test tests/Unit/Contexts/Membership/Domain/Models/MemberTest.php
```
**Expected:** All tests fail because model doesn't implement business rules yet.

---

## **🔧 STEP 2: REFACTOR MEMBER MODEL**

### **Replace Current Member Model:**

**File:** `app/Contexts/Membership/Domain/Models/Member.php`
```php
<?php

namespace App\Contexts\Membership\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Contexts\TenantAuth\Domain\Models\TenantUser;

/**
 * Member Aggregate Root
 * 
 * Business Rules:
 * 1. Every Member MUST have a TenantUser (1:1 relationship)
 * 2. Geography is optional (reference only, not structure)
 * 3. Membership number is unique per tenant
 * 4. Status follows lifecycle: draft → pending → approved → active → suspended
 * 5. Tenant isolation enforced via tenant_id
 */
class Member extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'members';
    protected $connection = 'tenant';
    
    // Status Lifecycle
    const STATUS_DRAFT = 'draft';
    const STATUS_PENDING = 'pending';
    const STATUS_APPROVED = 'approved';
    const STATUS_ACTIVE = 'active';
    const STATUS_SUSPENDED = 'suspended';
    const STATUS_EXPIRED = 'expired';
    
    // Membership Types
    const TYPE_FULL = 'full';
    const TYPE_YOUTH = 'youth';
    const TYPE_STUDENT = 'student';
    const TYPE_ASSOCIATE = 'associate';

    /**
     * Attributes that are mass assignable
     * NOTE: tenant_user_id is NOT mass assignable - use register() method
     */
    protected $fillable = [
        'tenant_id',
        'geography_reference', // OPTIONAL: Opaque reference like "np.3.15.234.1.2"
        'full_name',
        'membership_number',
        'membership_type',
        'status',
        'phone',
        'email',
        'date_of_birth',
        'gender',
        'sponsor_member_id',
        'approved_by',
        'approved_at',
        'activated_at',
        'suspended_at',
    ];

    protected $casts = [
        'tenant_user_id' => 'integer',
        'date_of_birth' => 'date',
        'approved_at' => 'datetime',
        'activated_at' => 'datetime',
        'suspended_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    protected $attributes = [
        'status' => self::STATUS_DRAFT,
        'membership_type' => self::TYPE_FULL,
        'country_code' => 'NP', // Default, can be changed
    ];

    /**
     * ============================================
     * RELATIONSHIPS
     * ============================================
     */
    
    /**
     * 1:1 Relationship with TenantUser (REQUIRED)
     */
    public function user()
    {
        return $this->belongsTo(TenantUser::class, 'tenant_user_id');
    }
    
    /**
     * Sponsor relationship (optional)
     */
    public function sponsor()
    {
        return $this->belongsTo(self::class, 'sponsor_member_id');
    }
    
    /**
     * Members sponsored by this member
     */
    public function sponsoredMembers()
    {
        return $this->hasMany(self::class, 'sponsor_member_id');
    }

    /**
     * ============================================
     * BUSINESS METHODS (Domain Logic)
     * ============================================
     */
    
    /**
     * Factory Method: Register new member with user account
     * This is the CORRECT way to create a member
     * 
     * @param array $memberData Member attributes
     * @param array $userData TenantUser attributes
     * @return self
     * @throws \Exception
     */
    public static function register(array $memberData, array $userData): self
    {
        return DB::transaction(function () use ($memberData, $userData) {
            // 1. Validate required fields
            if (empty($memberData['full_name'])) {
                throw new \InvalidArgumentException('Full name is required');
            }
            
            if (empty($memberData['phone'])) {
                throw new \InvalidArgumentException('Phone number is required');
            }
            
            // 2. Create TenantUser account
            $user = TenantUser::create(array_merge($userData, [
                'is_active' => false, // Can't login until approved
                'email_verified_at' => null,
            ]));
            
            // 3. Generate unique membership number
            $membershipNumber = self::generateMembershipNumber();
            
            // 4. Create Member linked to User
            $member = self::create(array_merge($memberData, [
                'tenant_id' => app('currentTenant')->id,
                'tenant_user_id' => $user->id, // REQUIRED 1:1 link
                'membership_number' => $membershipNumber,
                'status' => self::STATUS_DRAFT,
            ]));
            
            // 5. Link User to Member (for TenantAuth context)
            $user->update([
                'profile_id' => $member->id,
                'profile_type' => self::class,
            ]);
            
            // 6. Mark as pending (requires committee approval)
            $member->markAsPending();
            
            return $member;
        });
    }
    
    /**
     * Generate unique membership number per tenant
     */
    private static function generateMembershipNumber(): string
    {
        $tenant = app('currentTenant');
        $year = date('Y');
        
        // Get or create sequence for this tenant/year
        $sequence = self::getNextSequence($tenant->id, $year);
        
        // Format: TENANT-YEAR-6DIGITS
        return sprintf('%s-%s-%06d', 
            strtoupper($tenant->slug), 
            $year, 
            $sequence
        );
    }
    
    /**
     * Thread-safe sequence generation
     */
    private static function getNextSequence(string $tenantId, string $year): int
    {
        $key = "membership:sequence:{$tenantId}:{$year}";
        
        // Use atomic lock to prevent race conditions
        return Cache::lock($key, 10)->block(5, function () use ($key) {
            $sequence = Cache::get($key, 0) + 1;
            Cache::put($key, $sequence, now()->addYear());
            return $sequence;
        });
    }
    
    /**
     * Mark member as pending (requires committee approval)
     */
    public function markAsPending(): void
    {
        $this->update(['status' => self::STATUS_PENDING]);
    }
    
    /**
     * Approve member (by committee member)
     * 
     * @param int $approvedByUserId ID of approving committee member
     * @throws \Exception
     */
    public function approve(int $approvedByUserId): void
    {
        if ($this->status !== self::STATUS_PENDING) {
            throw new \Exception(
                "Cannot approve member with status: {$this->status}. Must be 'pending'."
            );
        }
        
        $this->update([
            'status' => self::STATUS_APPROVED,
            'approved_by' => $approvedByUserId,
            'approved_at' => now(),
        ]);
        
        // Activate user account for login
        $this->user->update([
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
    }
    
    /**
     * Activate member (after payment)
     * 
     * @throws \Exception
     */
    public function activate(): void
    {
        if ($this->status !== self::STATUS_APPROVED) {
            throw new \Exception(
                "Cannot activate member with status: {$this->status}. Must be 'approved'."
            );
        }
        
        $this->update([
            'status' => self::STATUS_ACTIVE,
            'activated_at' => now(),
        ]);
    }
    
    /**
     * Suspend member
     */
    public function suspend(string $reason = null): void
    {
        $this->update([
            'status' => self::STATUS_SUSPENDED,
            'suspended_at' => now(),
            'suspension_reason' => $reason,
        ]);
        
        // Deactivate user account
        $this->user->update(['is_active' => false]);
    }
    
    /**
     * Reinstate suspended member
     */
    public function reinstate(): void
    {
        if ($this->status !== self::STATUS_SUSPENDED) {
            throw new \Exception('Only suspended members can be reinstated');
        }
        
        $this->update([
            'status' => self::STATUS_ACTIVE,
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);
        
        // Reactivate user account
        $this->user->update(['is_active' => true]);
    }
    
    /**
     * Assign geography reference (optional)
     * 
     * @param string $reference Opaque geography reference
     */
    public function assignGeography(string $reference): void
    {
        // Geography validation would happen via GeographyService interface
        // For now, just store the reference
        $this->update(['geography_reference' => $reference]);
    }
    
    /**
     * Remove geography reference
     */
    public function removeGeography(): void
    {
        $this->update(['geography_reference' => null]);
    }
    
    /**
     * ============================================
     * QUERY SCOPES
     * ============================================
     */
    
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }
    
    public function scopeApproved($query)
    {
        return $query->where('status', self::STATUS_APPROVED);
    }
    
    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }
    
    public function scopeWithGeography($query)
    {
        return $query->whereNotNull('geography_reference');
    }
    
    public function scopeWithoutGeography($query)
    {
        return $query->whereNull('geography_reference');
    }
    
    /**
     * ============================================
     * ACCESSORS & MUTATORS
     * ============================================
     */
    
    /**
     * Check if member is active
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
    
    /**
     * Check if member is pending approval
     */
    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }
    
    /**
     * Check if member is approved
     */
    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }
    
    /**
     * Check if member is suspended
     */
    public function isSuspended(): bool
    {
        return $this->status === self::STATUS_SUSPENDED;
    }
    
    /**
     * Check if member has geography
     */
    public function hasGeography(): bool
    {
        return !empty($this->geography_reference);
    }
    
    /**
     * Get member's display name
     */
    public function getDisplayNameAttribute(): string
    {
        return $this->full_name . ' (' . $this->membership_number . ')';
    }
    
    /**
     * Get member's status with color for UI
     */
    public function getStatusColorAttribute(): string
    {
        return match($this->status) {
            self::STATUS_ACTIVE => 'green',
            self::STATUS_PENDING => 'yellow',
            self::STATUS_APPROVED => 'blue',
            self::STATUS_SUSPENDED => 'red',
            self::STATUS_EXPIRED => 'gray',
            default => 'gray',
        };
    }
    
    /**
     * ============================================
     * EVENT HANDLERS
     * ============================================
     */
    
    /**
     * Boot the model
     */
    protected static function booted()
    {
        // Ensure tenant_user_id is never null when creating
        static::creating(function ($member) {
            if (empty($member->tenant_user_id)) {
                throw new \InvalidArgumentException(
                    'Member must have a tenant_user_id (1:1 with TenantUser)'
                );
            }
        });
        
        // When member is deleted, also delete the user (cascade)
        static::deleting(function ($member) {
            if ($member->forceDeleting) {
                $member->user()->delete();
            }
        });
    }
}
```

---

## **🔄 STEP 3: UPDATE TENANTUSER MODEL FOR 1:1 RELATIONSHIP**

**File:** `app/Contexts/TenantAuth/Domain/Models/TenantUser.php` (Add these methods):
```php
<?php

namespace App\Contexts\TenantAuth\Domain\Models;

// ... existing code ...

class TenantUser extends Authenticatable
{
    // ... existing properties and methods ...
    
    /**
     * Get the member profile (1:1 relationship)
     */
    public function member()
    {
        return $this->hasOne(
            \App\Contexts\Membership\Domain\Models\Member::class,
            'tenant_user_id'
        );
    }
    
    /**
     * Check if user is a member
     */
    public function isMember(): bool
    {
        return $this->member()->exists();
    }
    
    /**
     * Get member if user is a member
     */
    public function getMemberAttribute(): ?\App\Contexts\Membership\Domain\Models\Member
    {
        return $this->member;
    }
    
    /**
     * Factory: Create user with member profile
     */
    public static function createWithMember(array $userData, array $memberData): self
    {
        return \App\Contexts\Membership\Domain\Models\Member::register(
            $memberData,
            $userData
        )->user;
    }
}
```

---

## **📦 STEP 4: CREATE FACTORY FOR TESTING**

**File:** `database/factories/MemberFactory.php`
```php
<?php

namespace Database\Factories;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\TenantAuth\Domain\Models\TenantUser;
use Illuminate\Database\Eloquent\Factories\Factory;

class MemberFactory extends Factory
{
    protected $model = Member::class;
    
    public function definition(): array
    {
        $tenantId = app('currentTenant')->id ?? 'test-tenant';
        $year = date('Y');
        $sequence = $this->faker->unique()->numberBetween(1, 999999);
        
        return [
            'tenant_id' => $tenantId,
            'full_name' => $this->faker->name(),
            'phone' => '+97798' . $this->faker->numerify('########'),
            'email' => $this->faker->unique()->safeEmail(),
            'membership_number' => 'TEST-' . $year . '-' . str_pad($sequence, 6, '0', STR_PAD_LEFT),
            'membership_type' => $this->faker->randomElement([
                Member::TYPE_FULL,
                Member::TYPE_YOUTH,
                Member::TYPE_STUDENT,
            ]),
            'status' => $this->faker->randomElement([
                Member::STATUS_PENDING,
                Member::STATUS_APPROVED,
                Member::STATUS_ACTIVE,
            ]),
            'date_of_birth' => $this->faker->date(),
            'gender' => $this->faker->randomElement(['male', 'female', 'other']),
            'country_code' => 'NP',
        ];
    }
    
    /**
     * Configure to automatically create TenantUser
     */
    public function configure()
    {
        return $this->afterCreating(function (Member $member) {
            // Only create user if not already linked
            if (!$member->tenant_user_id) {
                $user = TenantUser::factory()->create([
                    'profile_id' => $member->id,
                    'profile_type' => Member::class,
                ]);
                
                $member->update(['tenant_user_id' => $user->id]);
            }
        });
    }
    
    /**
     * State: Pending approval
     */
    public function pending(): self
    {
        return $this->state(['status' => Member::STATUS_PENDING]);
    }
    
    /**
     * State: Approved but not activated
     */
    public function approved(): self
    {
        return $this->state([
            'status' => Member::STATUS_APPROVED,
            'approved_by' => 1,
            'approved_at' => now(),
        ]);
    }
    
    /**
     * State: Active member
     */
    public function active(): self
    {
        return $this->state([
            'status' => Member::STATUS_ACTIVE,
            'approved_by' => 1,
            'approved_at' => now()->subDays(7),
            'activated_at' => now()->subDays(5),
        ]);
    }
    
    /**
     * State: With geography
     */
    public function withGeography(string $reference = 'np.3.15.234.1.2'): self
    {
        return $this->state(['geography_reference' => $reference]);
    }
    
    /**
     * State: Without geography
     */
    public function withoutGeography(): self
    {
        return $this->state(['geography_reference' => null]);
    }
}
```

---

## **🧪 STEP 5: RUN TESTS AGAIN**

```bash
# Run the tests - some may pass, some fail due to missing DB constraints
php artisan test tests/Unit/Contexts/Membership/Domain/Models/MemberTest.php

# Expected:
# - Test about 1:1 relationship should pass
# - Test about unique membership number may fail (no DB constraint)
# - Test about required tenant_user_id may fail (no DB constraint)
```

---

## **🗄️ STEP 6: CREATE DATABASE MIGRATION**

Now that our model defines the business rules, create migration:

```bash
php artisan make:migration enforce_member_tenant_user_1to1_relationship --path=database/migrations/tenant
```

**File:** `database/migrations/tenant/2024_01_15_000001_enforce_member_tenant_user_1to1_relationship.php`
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            // 1. Make tenant_user_id required (NOT NULL)
            $table->unsignedBigInteger('tenant_user_id')->nullable(false)->change();
            
            // 2. Enforce 1:1 relationship (UNIQUE constraint)
            $table->unique('tenant_user_id');
            
            // 3. Add foreign key with cascade delete
            $table->foreign('tenant_user_id')
                  ->references('id')
                  ->on('tenant_users')
                  ->onDelete('cascade');
            
            // 4. Ensure membership_number is unique
            $table->unique('membership_number');
            
            // 5. Add index for common queries
            $table->index(['status', 'created_at']);
            $table->index('geography_reference');
            $table->index('tenant_id');
            
            // 6. Remove old geography columns if they exist
            $columnsToCheck = [
                'admin_unit_level1_id',
                'admin_unit_level2_id',
                'admin_unit_level3_id',
                'admin_unit_level4_id',
                'admin_unit_level5_id',
                'admin_unit_level6_id',
                'admin_unit_level7_id',
                'admin_unit_level8_id',
                'geo_path',
            ];
            
            foreach ($columnsToCheck as $column) {
                if (Schema::hasColumn('members', $column)) {
                    $table->dropColumn($column);
                }
            }
            
            // 7. Add new geography_reference column if not exists
            if (!Schema::hasColumn('members', 'geography_reference')) {
                $table->string('geography_reference')->nullable()->after('tenant_user_id');
            }
        });
        
        // Update existing members that have null tenant_user_id
        // (Only if you have existing data)
        DB::table('members')
            ->whereNull('tenant_user_id')
            ->update(['tenant_user_id' => 0]); // Temporary, will fail constraint
        
        // Note: You'll need to fix existing data before running migration
    }

    public function down(): void
    {
        Schema::table('members', function (Blueprint $table) {
            // Remove foreign key and unique constraint
            $table->dropForeign(['tenant_user_id']);
            $table->dropUnique(['tenant_user_id']);
            $table->dropUnique(['membership_number']);
            
            // Drop indexes
            $table->dropIndex(['status', 'created_at']);
            $table->dropIndex(['geography_reference']);
            $table->dropIndex(['tenant_id']);
            
            // Make tenant_user_id nullable again
            $table->unsignedBigInteger('tenant_user_id')->nullable()->change();
            
            // Keep geography_reference column (don't drop in rollback)
        });
    }
};
```

---

## **⚠️ IMPORTANT: DATA MIGRATION SCRIPT**

If you have existing members without `tenant_user_id`, create this script:

**File:** `database/scripts/fix_missing_tenant_users.php`
```php
<?php

namespace Database\Scripts;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class FixMissingTenantUsers
{
    public function run(): void
    {
        if (!Schema::hasTable('members') || !Schema::hasTable('tenant_users')) {
            return;
        }
        
        DB::transaction(function () {
            // Get all members without tenant_user_id
            $members = DB::table('members')
                ->whereNull('tenant_user_id')
                ->get();
            
            foreach ($members as $member) {
                // Generate unique email if missing
                $email = $member->email ?? strtolower(Str::slug($member->full_name)) . '@migration.publicdigit.com';
                
                // Create tenant user
                $userId = DB::table('tenant_users')->insertGetId([
                    'email' => $email,
                    'password' => bcrypt(Str::random(32)),
                    'is_active' => $member->status === 'active',
                    'profile_id' => $member->id,
                    'profile_type' => 'App\\Contexts\\Membership\\Domain\\Models\\Member',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                
                // Link member to user
                DB::table('members')
                    ->where('id', $member->id)
                    ->update(['tenant_user_id' => $userId]);
            }
            
            echo "Fixed " . count($members) . " members\n";
        });
    }
}
```

Run it:
```bash
php artisan tinker
>>> (new Database\Scripts\FixMissingTenantUsers())->run();
```

---

## **🎯 STEP 7: RUN FINAL TESTS**

```bash
# 1. Run migration
php artisan migrate --path=database/migrations/tenant

# 2. Run all tests
php artisan test tests/Unit/Contexts/Membership/Domain/Models/MemberTest.php

# 3. Expected: All tests pass!
```

---

## **📋 SUMMARY OF WHAT WE ACCOMPLISHED**

### **✅ DONE:**
1. **Business Rule Tests** - TDD first approach
2. **Refactored Member Model** - 1:1 relationship enforced in code
3. **Domain Logic** - Registration, approval, activation workflows
4. **Geography Optional** - Opaque reference, not structure
5. **Factory Methods** - Correct way to create members

### **✅ DATABASE CONSTRAINTS:**
1. `tenant_user_id` - NOT NULL, UNIQUE, FOREIGN KEY
2. `membership_number` - UNIQUE per tenant
3. Proper indexes for performance
4. Clean geography column (no hardcoded levels)

### **✅ NEXT STEPS:**
1. **Create Value Objects** (MemberStatus, MembershipNumber, PersonalInfo)
2. **Implement Geography Service Interface** (Null and Nepal implementations)
3. **Build API Endpoints** for member management
4. **Create Committee Context** (separate bounded context)

---

## **🔍 YOUR TASKS NOW:**

### **Task 1: Create Value Objects**
```bash
php artisan make:valueobject MemberStatus --context=Membership
php artisan make:valueobject MembershipNumber --context=Membership  
php artisan make:valueobject PersonalInfo --context=Membership
```

### **Task 2: Update Model to Use Value Objects**
Refactor Member model to use these VOs instead of strings.

### **Task 3: Write More Comprehensive Tests**
Add tests for edge cases and error scenarios.

---

**Would you like me to:**
1. **Provide the Value Object implementations?**
2. **Help refactor Member to use Value Objects?**
3. **Create the Geography Service interface?**
4. **Something else?**

**What's your next priority?**j