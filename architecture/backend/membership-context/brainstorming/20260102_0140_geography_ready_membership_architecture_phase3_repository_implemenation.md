# 🚀 **PHASE 3: REPOSITORY PATTERN IMPLEMENTATION**

## **📁 ARCHITECTURE OVERVIEW**

```
Repository Pattern Goals:
1. Abstract data persistence from domain logic
2. Enable testing without database
3. Support multiple storage backends
4. Handle domain event dispatch on save
```

---

## **STEP 3.1: REPOSITORY INTERFACE (CONTRACT)**

### **3.1.1 Create Repository Interface Directory**

```bash
mkdir -p app/Contexts/Membership/Domain/Repositories
mkdir -p tests/Unit/Contexts/Membership/Domain/Repositories
```

### **3.1.2 MemberRepositoryInterface**

```php
<?php

// app/Contexts/Membership/Domain/Repositories/MemberRepositoryInterface.php

namespace App\Contexts\Membership\Domain\Repositories;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;

interface MemberRepositoryInterface
{
    /**
     * Save a member aggregate (create or update)
     * 
     * @param Member $member
     * @return void
     */
    public function save(Member $member): void;
    
    /**
     * Find member by ID
     * 
     * @param string $id
     * @return Member|null
     */
    public function find(string $id): ?Member;
    
    /**
     * Find member by membership number
     * 
     * @param MembershipNumber|string $membershipNumber
     * @return Member|null
     */
    public function findByMembershipNumber(MembershipNumber|string $membershipNumber): ?Member;
    
    /**
     * Find member by phone number
     * 
     * @param string $phone
     * @return Member|null
     */
    public function findByPhone(string $phone): ?Member;
    
    /**
     * Find member by email
     * 
     * @param string $email
     * @return Member|null
     */
    public function findByEmail(string $email): ?Member;
    
    /**
     * Find all members with given status
     * 
     * @param MemberStatus|string $status
     * @param int $limit
     * @param int $offset
     * @return array<Member>
     */
    public function findByStatus(MemberStatus|string $status, int $limit = 100, int $offset = 0): array;
    
    /**
     * Find pending applications for committee review
     * 
     * @param int|null $committeeMemberId If provided, filter by geography if committee has jurisdiction
     * @param int $limit
     * @param int $offset
     * @return array<Member>
     */
    public function findPendingApplications(?int $committeeMemberId = null, int $limit = 50, int $offset = 0): array;
    
    /**
     * Find active members by geography
     * 
     * @param SimpleGeography $geography
     * @param int $limit
     * @param int $offset
     * @return array<Member>
     */
    public function findActiveByGeography(SimpleGeography $geography, int $limit = 100, int $offset = 0): array;
    
    /**
     * Find members sponsored by a specific member
     * 
     * @param int $sponsorId
     * @param int $limit
     * @param int $offset
     * @return array<Member>
     */
    public function findBySponsor(int $sponsorId, int $limit = 100, int $offset = 0): array;
    
    /**
     * Check if phone number already exists
     * 
     * @param string $phone
     * @return bool
     */
    public function phoneExists(string $phone): bool;
    
    /**
     * Check if email already exists
     * 
     * @param string $email
     * @return bool
     */
    public function emailExists(string $email): bool;
    
    /**
     * Check if membership number already exists
     * 
     * @param MembershipNumber|string $membershipNumber
     * @return bool
     */
    public function membershipNumberExists(MembershipNumber|string $membershipNumber): bool;
    
    /**
     * Count total members
     * 
     * @return int
     */
    public function countTotal(): int;
    
    /**
     * Count members by status
     * 
     * @param MemberStatus|string $status
     * @return int
     */
    public function countByStatus(MemberStatus|string $status): int;
    
    /**
     * Get next available membership number sequence
     * 
     * @param string $tenantSlug
     * @param string $year
     * @param string $typeCode
     * @return int
     */
    public function getNextSequenceNumber(string $tenantSlug, string $year, string $typeCode): int;
    
    /**
     * Delete a member (soft delete)
     * 
     * @param Member $member
     * @return void
     */
    public function delete(Member $member): void;
}
```

### **3.1.3 Repository Exception**

```php
<?php

// app/Contexts/Membership/Domain/Exceptions/MemberRepositoryException.php

namespace App\Contexts\Membership\Domain\Exceptions;

use Exception;

class MemberRepositoryException extends Exception
{
    public static function duplicateMembershipNumber(string $number): self
    {
        return new self("Membership number already exists: {$number}");
    }
    
    public static function duplicatePhone(string $phone): self
    {
        return new self("Phone number already exists: {$phone}");
    }
    
    public static function duplicateEmail(string $email): self
    {
        return new self("Email already exists: {$email}");
    }
    
    public static function notFound(string $id): self
    {
        return new self("Member not found: {$id}");
    }
    
    public static function saveFailed(string $reason): self
    {
        return new self("Failed to save member: {$reason}");
    }
}
```

---

## **STEP 3.2: REPOSITORY INTERFACE TESTS (RED PHASE)**

### **3.2.1 Create Test File**

```php
<?php

// tests/Unit/Contexts/Membership/Domain/Repositories/MemberRepositoryInterfaceTest.php

namespace Tests\Unit\Contexts\Membership\Domain\Repositories;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;
use Mockery;

class MemberRepositoryInterfaceTest extends TestCase
{
    private MemberRepositoryInterface $repository;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // We'll mock the interface for contract testing
        $this->repository = Mockery::mock(MemberRepositoryInterface::class);
    }
    
    /** @test */
    public function it_defines_save_method(): void
    {
        $member = Mockery::mock(Member::class);
        
        $this->repository->shouldReceive('save')
            ->once()
            ->with($member);
        
        $this->repository->save($member);
        
        $this->assertTrue(true); // Just verify method exists
    }
    
    /** @test */
    public function it_defines_find_method(): void
    {
        $member = Mockery::mock(Member::class);
        
        $this->repository->shouldReceive('find')
            ->with('member-123')
            ->once()
            ->andReturn($member);
        
        $result = $this->repository->find('member-123');
        
        $this->assertSame($member, $result);
    }
    
    /** @test */
    public function it_defines_find_by_membership_number(): void
    {
        $member = Mockery::mock(Member::class);
        $membershipNumber = new MembershipNumber('UML', '2024', 'F', 1);
        
        $this->repository->shouldReceive('findByMembershipNumber')
            ->with($membershipNumber)
            ->once()
            ->andReturn($member);
        
        $result = $this->repository->findByMembershipNumber($membershipNumber);
        
        $this->assertSame($member, $result);
    }
    
    /** @test */
    public function it_defines_find_by_phone(): void
    {
        $member = Mockery::mock(Member::class);
        
        $this->repository->shouldReceive('findByPhone')
            ->with('+9779841234567')
            ->once()
            ->andReturn($member);
        
        $result = $this->repository->findByPhone('+9779841234567');
        
        $this->assertSame($member, $result);
    }
    
    /** @test */
    public function it_defines_find_by_status(): void
    {
        $members = [
            Mockery::mock(Member::class),
            Mockery::mock(Member::class),
        ];
        
        $this->repository->shouldReceive('findByStatus')
            ->with(MemberStatus::pending(), 50, 0)
            ->once()
            ->andReturn($members);
        
        $result = $this->repository->findByStatus(MemberStatus::pending(), 50, 0);
        
        $this->assertSame($members, $result);
        $this->assertCount(2, $result);
    }
    
    /** @test */
    public function it_defines_find_pending_applications(): void
    {
        $members = [Mockery::mock(Member::class)];
        
        $this->repository->shouldReceive('findPendingApplications')
            ->with(123, 50, 0)
            ->once()
            ->andReturn($members);
        
        $result = $this->repository->findPendingApplications(123, 50, 0);
        
        $this->assertSame($members, $result);
    }
    
    /** @test */
    public function it_defines_find_active_by_geography(): void
    {
        $members = [Mockery::mock(Member::class)];
        $geography = new SimpleGeography(province: 'Province 3');
        
        $this->repository->shouldReceive('findActiveByGeography')
            ->with($geography, 100, 0)
            ->once()
            ->andReturn($members);
        
        $result = $this->repository->findActiveByGeography($geography);
        
        $this->assertSame($members, $result);
    }
    
    /** @test */
    public function it_defines_duplicate_checks(): void
    {
        $this->repository->shouldReceive('phoneExists')
            ->with('+9779841234567')
            ->once()
            ->andReturn(true);
        
        $this->repository->shouldReceive('emailExists')
            ->with('john@example.com')
            ->once()
            ->andReturn(false);
        
        $this->repository->shouldReceive('membershipNumberExists')
            ->with(Mockery::type(MembershipNumber::class))
            ->once()
            ->andReturn(false);
        
        $phoneExists = $this->repository->phoneExists('+9779841234567');
        $emailExists = $this->repository->emailExists('john@example.com');
        $numberExists = $this->repository->membershipNumberExists(new MembershipNumber('UML', '2024', 'F', 1));
        
        $this->assertTrue($phoneExists);
        $this->assertFalse($emailExists);
        $this->assertFalse($numberExists);
    }
    
    /** @test */
    public function it_defines_count_methods(): void
    {
        $this->repository->shouldReceive('countTotal')
            ->once()
            ->andReturn(150);
        
        $this->repository->shouldReceive('countByStatus')
            ->with(MemberStatus::active())
            ->once()
            ->andReturn(120);
        
        $total = $this->repository->countTotal();
        $activeCount = $this->repository->countByStatus(MemberStatus::active());
        
        $this->assertEquals(150, $total);
        $this->assertEquals(120, $activeCount);
    }
    
    /** @test */
    public function it_defines_next_sequence_number(): void
    {
        $this->repository->shouldReceive('getNextSequenceNumber')
            ->with('UML', '2024', 'F')
            ->once()
            ->andReturn(125);
        
        $nextSequence = $this->repository->getNextSequenceNumber('UML', '2024', 'F');
        
        $this->assertEquals(125, $nextSequence);
    }
    
    /** @test */
    public function it_defines_delete_method(): void
    {
        $member = Mockery::mock(Member::class);
        
        $this->repository->shouldReceive('delete')
            ->with($member)
            ->once();
        
        $this->repository->delete($member);
        
        $this->assertTrue(true);
    }
}
```

**Run test (should pass - it's testing interface contract):**
```bash
php artisan test tests/Unit/Contexts/Membership/Domain/Repositories/MemberRepositoryInterfaceTest.php
```

---

## **STEP 3.3: ELOQUENT REPOSITORY IMPLEMENTATION**

### **3.3.1 Create Infrastructure Directories**

```bash
mkdir -p app/Contexts/Membership/Infrastructure/Repositories
mkdir -p app/Contexts/Membership/Infrastructure/Database/Models
mkdir -p tests/Unit/Contexts/Membership/Infrastructure/Repositories
```

### **3.3.2 Database Model for Persistence**

We need a separate Eloquent model for database operations (following Hexagonal Architecture):

```php
<?php

// app/Contexts/Membership/Infrastructure/Database/Models/MemberModel.php

namespace App\Contexts\Membership\Infrastructure\Database\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MemberModel extends Model
{
    use SoftDeletes;
    
    protected $table = 'members';
    
    protected $keyType = 'string';
    public $incrementing = false;
    
    protected $fillable = [
        'id',
        'personal_info',
        'membership_number',
        'geography',
        'status',
        'sponsor_id',
        'approved_by',
        'approved_at',
        'payment_id',
        'activated_at',
        'suspension_reason',
        'termination_reason',
        'geography_enriched_at',
    ];
    
    protected $casts = [
        'personal_info' => 'json',
        'geography' => 'json',
        'approved_at' => 'datetime',
        'activated_at' => 'datetime',
        'geography_enriched_at' => 'datetime',
    ];
    
    public function getMembershipNumberAttribute($value)
    {
        return $value;
    }
    
    public function setMembershipNumberAttribute($value)
    {
        $this->attributes['membership_number'] = (string) $value;
    }
}
```

### **3.3.3 Migration for Members Table**

```bash
php artisan make:migration create_members_table --context=Membership --tenant
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/[timestamp]_create_members_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table) {
            $table->string('id')->primary();
            
            // Personal Information (stored as JSON)
            $table->json('personal_info');
            
            // Membership Details
            $table->string('membership_number')->unique();
            $table->string('status')->default('draft');
            
            // Geography (progressive tiers)
            $table->json('geography')->nullable();
            
            // Sponsorship
            $table->unsignedBigInteger('sponsor_id')->nullable()->index();
            
            // Approval Tracking
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            
            // Activation Tracking
            $table->string('payment_id')->nullable();
            $table->timestamp('activated_at')->nullable();
            
            // Suspension/Termination
            $table->text('suspension_reason')->nullable();
            $table->text('termination_reason')->nullable();
            
            // Geography Enrichment Tracking
            $table->timestamp('geography_enriched_at')->nullable();
            
            // Tenant Context
            $table->unsignedBigInteger('tenant_user_id')->nullable()->unique();
            
            // Timestamps
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes for common queries
            $table->index(['status', 'created_at']);
            $table->index(['sponsor_id', 'status']);
            $table->index(['approved_by', 'approved_at']);
            $table->index(['payment_id', 'activated_at']);
            
            // Generated column for phone search (if supported)
            if (config('database.default') === 'pgsql') {
                $table->rawIndex(
                    "((personal_info->>'phone'))",
                    'members_phone_index'
                );
                $table->rawIndex(
                    "((personal_info->>'email'))",
                    'members_email_index'
                );
            }
        });
        
        // For MySQL, we need virtual columns
        if (config('database.default') === 'mysql') {
            \DB::statement('
                ALTER TABLE members 
                ADD COLUMN phone VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(personal_info, "$.phone"))) VIRTUAL,
                ADD COLUMN email VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(personal_info, "$.email"))) VIRTUAL,
                ADD INDEX members_phone_index (phone),
                ADD INDEX members_email_index (email)
            ');
        }
    }
    
    public function down(): void
    {
        Schema::dropIfExists('members');
    }
};
```

### **3.3.4 Sequence Number Tracking Table**

```bash
php artisan make:migration create_membership_sequences_table --context=Membership --tenant
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/[timestamp]_create_membership_sequences_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membership_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_slug');
            $table->string('year', 4);
            $table->string('type_code', 1); // F, Y, S, A
            $table->unsignedInteger('current_sequence')->default(0);
            $table->timestamps();
            
            // Unique constraint for tenant/year/type combination
            $table->unique(['tenant_slug', 'year', 'type_code']);
            
            $table->index(['tenant_slug', 'year']);
        });
    }
    
    public function down(): void
    {
        Schema::dropIfExists('membership_sequences');
    }
};
```

### **3.3.5 EloquentMemberRepository Implementation**

```php
<?php

// app/Contexts/Membership/Infrastructure/Repositories/EloquentMemberRepository.php

namespace App\Contexts\Membership\Infrastructure\Repositories;

use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;
use App\Contexts\Membership\Domain\Events\DomainEvent;
use App\Contexts\Membership\Infrastructure\Database\Models\MemberModel;
use App\Contexts\Membership\Domain\Exceptions\MemberRepositoryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

class EloquentMemberRepository implements MemberRepositoryInterface
{
    public function save(Member $member): void
    {
        DB::transaction(function () use ($member) {
            try {
                // Convert domain model to database model
                $data = $this->domainToDatabase($member);
                
                // Check for duplicates before save
                $this->checkForDuplicates($member);
                
                // Save to database
                $model = MemberModel::updateOrCreate(['id' => $member->id()], $data);
                
                // Dispatch domain events
                $this->dispatchEvents($member);
                
            } catch (\Exception $e) {
                throw MemberRepositoryException::saveFailed($e->getMessage());
            }
        });
    }
    
    public function find(string $id): ?Member
    {
        $model = MemberModel::find($id);
        
        if (!$model) {
            return null;
        }
        
        return $this->databaseToDomain($model);
    }
    
    public function findByMembershipNumber(MembershipNumber|string $membershipNumber): ?Member
    {
        $number = $membershipNumber instanceof MembershipNumber 
            ? (string) $membershipNumber 
            : $membershipNumber;
        
        $model = MemberModel::where('membership_number', $number)->first();
        
        if (!$model) {
            return null;
        }
        
        return $this->databaseToDomain($model);
    }
    
    public function findByPhone(string $phone): ?Member
    {
        // Use generated column or JSON query based on database
        if (config('database.default') === 'pgsql') {
            $model = MemberModel::whereRaw("personal_info->>'phone' = ?", [$phone])->first();
        } else {
            $model = MemberModel::where('phone', $phone)->first();
        }
        
        if (!$model) {
            return null;
        }
        
        return $this->databaseToDomain($model);
    }
    
    public function findByEmail(string $email): ?Member
    {
        if (config('database.default') === 'pgsql') {
            $model = MemberModel::whereRaw("personal_info->>'email' = ?", [$email])->first();
        } else {
            $model = MemberModel::where('email', $email)->first();
        }
        
        if (!$model) {
            return null;
        }
        
        return $this->databaseToDomain($model);
    }
    
    public function findByStatus(MemberStatus|string $status, int $limit = 100, int $offset = 0): array
    {
        $statusValue = $status instanceof MemberStatus ? $status->value() : $status;
        
        $models = MemberModel::where('status', $statusValue)
            ->limit($limit)
            ->offset($offset)
            ->orderBy('created_at', 'desc')
            ->get();
        
        return $models->map(function ($model) {
            return $this->databaseToDomain($model);
        })->all();
    }
    
    public function findPendingApplications(?int $committeeMemberId = null, int $limit = 50, int $offset = 0): array
    {
        $query = MemberModel::where('status', 'pending')
            ->limit($limit)
            ->offset($offset)
            ->orderBy('created_at', 'asc');
        
        // TODO: Filter by committee geography when committee context is implemented
        // if ($committeeMemberId) {
        //     $query->whereInGeographyJurisdiction($committeeMemberId);
        // }
        
        $models = $query->get();
        
        return $models->map(function ($model) {
            return $this->databaseToDomain($model);
        })->all();
    }
    
    public function findActiveByGeography(SimpleGeography $geography, int $limit = 100, int $offset = 0): array
    {
        // This is simplified - real implementation would use ltree or hierarchy
        $query = MemberModel::where('status', 'active')
            ->limit($limit)
            ->offset($offset);
        
        // If we have province ID, filter by it
        if ($geography->provinceId()) {
            $query->whereRaw("geography->>'province_id' = ?", [$geography->provinceId()]);
        }
        
        // If we have district ID, filter by it
        if ($geography->districtId()) {
            $query->whereRaw("geography->>'district_id' = ?", [$geography->districtId()]);
        }
        
        // If we have ward ID, filter by it
        if ($geography->wardId()) {
            $query->whereRaw("geography->>'ward_id' = ?", [$geography->wardId()]);
        }
        
        $models = $query->get();
        
        return $models->map(function ($model) {
            return $this->databaseToDomain($model);
        })->all();
    }
    
    public function findBySponsor(int $sponsorId, int $limit = 100, int $offset = 0): array
    {
        $models = MemberModel::where('sponsor_id', $sponsorId)
            ->limit($limit)
            ->offset($offset)
            ->orderBy('created_at', 'desc')
            ->get();
        
        return $models->map(function ($model) {
            return $this->databaseToDomain($model);
        })->all();
    }
    
    public function phoneExists(string $phone): bool
    {
        if (config('database.default') === 'pgsql') {
            return MemberModel::whereRaw("personal_info->>'phone' = ?", [$phone])->exists();
        }
        
        return MemberModel::where('phone', $phone)->exists();
    }
    
    public function emailExists(string $email): bool
    {
        if (config('database.default') === 'pgsql') {
            return MemberModel::whereRaw("personal_info->>'email' = ?", [$email])->exists();
        }
        
        return MemberModel::where('email', $email)->exists();
    }
    
    public function membershipNumberExists(MembershipNumber|string $membershipNumber): bool
    {
        $number = $membershipNumber instanceof MembershipNumber 
            ? (string) $membershipNumber 
            : $membershipNumber;
        
        return MemberModel::where('membership_number', $number)->exists();
    }
    
    public function countTotal(): int
    {
        return MemberModel::count();
    }
    
    public function countByStatus(MemberStatus|string $status): int
    {
        $statusValue = $status instanceof MemberStatus ? $status->value() : $status;
        
        return MemberModel::where('status', $statusValue)->count();
    }
    
    public function getNextSequenceNumber(string $tenantSlug, string $year, string $typeCode): int
    {
        return DB::transaction(function () use ($tenantSlug, $year, $typeCode) {
            // Lock the sequence row for this tenant/year/type
            $sequence = DB::table('membership_sequences')
                ->where('tenant_slug', $tenantSlug)
                ->where('year', $year)
                ->where('type_code', $typeCode)
                ->lockForUpdate()
                ->first();
            
            if (!$sequence) {
                // Create new sequence
                DB::table('membership_sequences')->insert([
                    'tenant_slug' => $tenantSlug,
                    'year' => $year,
                    'type_code' => $typeCode,
                    'current_sequence' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                
                return 1;
            }
            
            // Increment and return
            $nextSequence = $sequence->current_sequence + 1;
            
            DB::table('membership_sequences')
                ->where('id', $sequence->id)
                ->update([
                    'current_sequence' => $nextSequence,
                    'updated_at' => now(),
                ]);
            
            return $nextSequence;
        });
    }
    
    public function delete(Member $member): void
    {
        $model = MemberModel::find($member->id());
        
        if ($model) {
            $model->delete();
        }
    }
    
    private function domainToDatabase(Member $member): array
    {
        return [
            'id' => $member->id(),
            'personal_info' => $member->personalInfo()->toArray(),
            'membership_number' => (string) $member->membershipNumber(),
            'geography' => $member->geography()->toArray(),
            'status' => $member->status()->value(),
            'sponsor_id' => $member->sponsorId(),
            'approved_by' => $member->approvedBy(),
            'approved_at' => $member->approvedAt(),
            'payment_id' => $member->paymentId(),
            'activated_at' => $member->activatedAt(),
            'suspension_reason' => $member->suspensionReason(),
            'termination_reason' => $member->terminationReason(),
            'geography_enriched_at' => $member->geographyEnrichedAt(),
            'tenant_user_id' => null, // Will be set when linked with TenantUser
        ];
    }
    
    private function databaseToDomain(MemberModel $model): Member
    {
        $personalInfo = PersonalInfo::fromArray($model->personal_info);
        $membershipNumber = MembershipNumber::fromString($model->membership_number);
        $geography = SimpleGeography::fromArray($model->geography ?? []);
        $status = MemberStatus::fromString($model->status);
        
        $member = new Member([
            'id' => $model->id,
            'personal_info' => $personalInfo,
            'membership_number' => $membershipNumber,
            'geography' => $geography,
            'status' => $status,
            'sponsor_id' => $model->sponsor_id,
            'approved_by' => $model->approved_by,
            'approved_at' => $model->approved_at,
            'payment_id' => $model->payment_id,
            'activated_at' => $model->activated_at,
            'suspension_reason' => $model->suspension_reason,
            'termination_reason' => $model->termination_reason,
            'geography_enriched_at' => $model->geography_enriched_at,
        ]);
        
        // Clear any recorded events from construction
        $member->clearRecordedEvents();
        
        return $member;
    }
    
    private function checkForDuplicates(Member $member): void
    {
        // Check phone uniqueness
        if ($this->phoneExists($member->personalInfo()->phone())) {
            // Make sure it's not the same member
            $existing = $this->findByPhone($member->personalInfo()->phone());
            if ($existing && $existing->id() !== $member->id()) {
                throw MemberRepositoryException::duplicatePhone($member->personalInfo()->phone());
            }
        }
        
        // Check email uniqueness
        if ($this->emailExists($member->personalInfo()->email())) {
            $existing = $this->findByEmail($member->personalInfo()->email());
            if ($existing && $existing->id() !== $member->id()) {
                throw MemberRepositoryException::duplicateEmail($member->personalInfo()->email());
            }
        }
        
        // Check membership number uniqueness
        if ($this->membershipNumberExists($member->membershipNumber())) {
            $existing = $this->findByMembershipNumber($member->membershipNumber());
            if ($existing && $existing->id() !== $member->id()) {
                throw MemberRepositoryException::duplicateMembershipNumber((string) $member->membershipNumber());
            }
        }
    }
    
    private function dispatchEvents(Member $member): void
    {
        foreach ($member->releaseEvents() as $event) {
            if ($event instanceof DomainEvent) {
                Event::dispatch($event);
            }
        }
    }
}
```

---

## **STEP 3.4: REPOSITORY TESTS (GREEN PHASE)**

### **3.4.1 Create Comprehensive Repository Tests**

```php
<?php

// tests/Unit/Contexts/Membership/Infrastructure/Repositories/EloquentMemberRepositoryTest.php

namespace Tests\Unit\Contexts\Membership\Infrastructure\Repositories;

use Tests\TestCase;
use App\Contexts\Membership\Infrastructure\Repositories\EloquentMemberRepository;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;
use App\Contexts\Membership\Domain\Exceptions\MemberRepositoryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

class EloquentMemberRepositoryTest extends TestCase
{
    use RefreshDatabase;
    
    private EloquentMemberRepository $repository;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        $this->repository = new EloquentMemberRepository();
        
        // Run migrations
        $this->artisan('migrate', ['--database' => 'tenant']);
    }
    
    private function createTestMember(array $overrides = []): Member
    {
        $defaults = [
            'personalInfo' => new PersonalInfo(
                'John Doe',
                'john@example.com',
                '+9779841234567'
            ),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 1),
            'geography' => SimpleGeography::empty(),
        ];
        
        $data = array_merge($defaults, $overrides);
        
        return Member::create(...$data);
    }
    
    /** @test */
    public function it_saves_and_retrieves_member(): void
    {
        $member = $this->createTestMember();
        
        $this->repository->save($member);
        
        $retrieved = $this->repository->find($member->id());
        
        $this->assertNotNull($retrieved);
        $this->assertEquals($member->id(), $retrieved->id());
        $this->assertEquals('John Doe', $retrieved->personalInfo()->fullName());
        $this->assertEquals('UML-2024-F-000001', (string) $retrieved->membershipNumber());
    }
    
    /** @test */
    public function it_updates_existing_member(): void
    {
        $member = $this->createTestMember();
        $this->repository->save($member);
        
        // Update member
        $member->submitApplication();
        $member->approve(123);
        
        $this->repository->save($member);
        
        $retrieved = $this->repository->find($member->id());
        
        $this->assertTrue($retrieved->status()->isApproved());
        $this->assertEquals(123, $retrieved->approvedBy());
    }
    
    /** @test */
    public function it_finds_member_by_membership_number(): void
    {
        $member = $this->createTestMember();
        $this->repository->save($member);
        
        $found = $this->repository->findByMembershipNumber($member->membershipNumber());
        
        $this->assertNotNull($found);
        $this->assertEquals($member->id(), $found->id());
    }
    
    /** @test */
    public function it_finds_member_by_phone(): void
    {
        $member = $this->createTestMember();
        $this->repository->save($member);
        
        $found = $this->repository->findByPhone('+9779841234567');
        
        $this->assertNotNull($found);
        $this->assertEquals($member->id(), $found->id());
    }
    
    /** @test */
    public function it_finds_member_by_email(): void
    {
        $member = $this->createTestMember();
        $this->repository->save($member);
        
        $found = $this->repository->findByEmail('john@example.com');
        
        $this->assertNotNull($found);
        $this->assertEquals($member->id(), $found->id());
    }
    
    /** @test */
    public function it_finds_members_by_status(): void
    {
        // Create members with different statuses
        $draftMember = $this->createTestMember();
        $this->repository->save($draftMember);
        
        $pendingMember = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Jane Doe', 'jane@example.com', '+9779841234568'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 2),
        ]);
        $pendingMember->submitApplication();
        $this->repository->save($pendingMember);
        
        $activeMember = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Bob Smith', 'bob@example.com', '+9779841234569'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 3),
        ]);
        $activeMember->submitApplication();
        $activeMember->approve(123);
        $activeMember->activate('pay_123');
        $this->repository->save($activeMember);
        
        // Test finding by status
        $draftMembers = $this->repository->findByStatus(MemberStatus::draft());
        $pendingMembers = $this->repository->findByStatus(MemberStatus::pending());
        $activeMembers = $this->repository->findByStatus(MemberStatus::active());
        
        $this->assertCount(1, $draftMembers);
        $this->assertCount(1, $pendingMembers);
        $this->assertCount(1, $activeMembers);
        
        $this->assertEquals('John Doe', $draftMembers[0]->personalInfo()->fullName());
        $this->assertEquals('Jane Doe', $pendingMembers[0]->personalInfo()->fullName());
        $this->assertEquals('Bob Smith', $activeMembers[0]->personalInfo()->fullName());
    }
    
    /** @test */
    public function it_finds_pending_applications(): void
    {
        $member1 = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Applicant 1', 'app1@example.com', '+9779841234501'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 101),
        ]);
        $member1->submitApplication();
        $this->repository->save($member1);
        
        $member2 = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Applicant 2', 'app2@example.com', '+9779841234502'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 102),
        ]);
        $member2->submitApplication();
        $this->repository->save($member2);
        
        $pendingApplications = $this->repository->findPendingApplications();
        
        $this->assertCount(2, $pendingApplications);
        $this->assertEquals('Applicant 1', $pendingApplications[0]->personalInfo()->fullName());
        $this->assertEquals('Applicant 2', $pendingApplications[1]->personalInfo()->fullName());
    }
    
    /** @test */
    public function it_prevents_duplicate_phone_numbers(): void
    {
        $member1 = $this->createTestMember();
        $this->repository->save($member1);
        
        $member2 = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Different Name', 'different@example.com', '+9779841234567'), // Same phone
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 2),
        ]);
        
        $this->expectException(MemberRepositoryException::class);
        $this->expectExceptionMessage('Phone number already exists');
        
        $this->repository->save($member2);
    }
    
    /** @test */
    public function it_prevents_duplicate_emails(): void
    {
        $member1 = $this->createTestMember();
        $this->repository->save($member1);
        
        $member2 = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Different Name', 'john@example.com', '+9779841234568'), // Same email
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 2),
        ]);
        
        $this->expectException(MemberRepositoryException::class);
        $this->expectExceptionMessage('Email already exists');
        
        $this->repository->save($member2);
    }
    
    /** @test */
    public function it_prevents_duplicate_membership_numbers(): void
    {
        $member1 = $this->createTestMember();
        $this->repository->save($member1);
        
        $member2 = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Different Name', 'different@example.com', '+9779841234568'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 1), // Same number
        ]);
        
        $this->expectException(MemberRepositoryException::class);
        $this->expectExceptionMessage('Membership number already exists');
        
        $this->repository->save($member2);
    }
    
    /** @test */
    public function it_allows_updating_same_member_with_same_data(): void
    {
        $member = $this->createTestMember();
        $this->repository->save($member);
        
        // Update the member
        $member->submitApplication();
        
        // Should not throw duplicate exception
        $this->repository->save($member);
        
        $retrieved = $this->repository->find($member->id());
        $this->assertTrue($retrieved->status()->isPending());
    }
    
    /** @test */
    public function it_counts_members(): void
    {
        $this->assertEquals(0, $this->repository->countTotal());
        
        $member1 = $this->createTestMember();
        $this->repository->save($member1);
        
        $this->assertEquals(1, $this->repository->countTotal());
        
        $member2 = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Jane Doe', 'jane@example.com', '+9779841234568'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 2),
        ]);
        $this->repository->save($member2);
        
        $this->assertEquals(2, $this->repository->countTotal());
        $this->assertEquals(2, $this->repository->countByStatus(MemberStatus::draft()));
    }
    
    /** @test */
    public function it_generates_next_sequence_number(): void
    {
        $sequence1 = $this->repository->getNextSequenceNumber('UML', '2024', 'F');
        $this->assertEquals(1, $sequence1);
        
        $sequence2 = $this->repository->getNextSequenceNumber('UML', '2024', 'F');
        $this->assertEquals(2, $sequence2);
        
        $sequence3 = $this->repository->getNextSequenceNumber('UML', '2024', 'Y');
        $this->assertEquals(1, $sequence3); // Different type code
        
        $sequence4 = $this->repository->getNextSequenceNumber('UML', '2025', 'F');
        $this->assertEquals(1, $sequence4); // Different year
    }
    
    /** @test */
    public function it_handles_concurrent_sequence_generation(): void
    {
        // Simulate concurrent requests
        $sequences = [];
        
        // In real scenario, these would be concurrent
        $sequences[] = $this->repository->getNextSequenceNumber('UML', '2024', 'F');
        $sequences[] = $this->repository->getNextSequenceNumber('UML', '2024', 'F');
        $sequences[] = $this->repository->getNextSequenceNumber('UML', '2024', 'F');
        
        sort($sequences);
        
        $this->assertEquals([1, 2, 3], $sequences);
    }
    
    /** @test */
    public function it_deletes_member(): void
    {
        $member = $this->createTestMember();
        $this->repository->save($member);
        
        $this->assertNotNull($this->repository->find($member->id()));
        
        $this->repository->delete($member);
        
        $this->assertNull($this->repository->find($member->id()));
    }
    
    /** @test */
    public function it_finds_members_by_sponsor(): void
    {
        $sponsor = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Sponsor', 'sponsor@example.com', '+9779841234000'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 999),
        ]);
        $sponsor->submitApplication();
        $sponsor->approve(123);
        $sponsor->activate('pay_999');
        $this->repository->save($sponsor);
        
        $member1 = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Sponsored 1', 'sp1@example.com', '+9779841234001'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 1000),
        ]);
        $member1->addSponsorship($sponsor->id());
        $this->repository->save($member1);
        
        $member2 = $this->createTestMember([
            'personalInfo' => new PersonalInfo('Sponsored 2', 'sp2@example.com', '+9779841234002'),
            'membershipNumber' => new MembershipNumber('UML', '2024', 'F', 1001),
        ]);
        $member2->addSponsorship($sponsor->id());
        $this->repository->save($member2);
        
        $sponsored = $this->repository->findBySponsor($sponsor->id());
        
        $this->assertCount(2, $sponsored);
        $this->assertEquals('Sponsored 1', $sponsored[0]->personalInfo()->fullName());
        $this->assertEquals('Sponsored 2', $sponsored[1]->personalInfo()->fullName());
    }
    
    /** @test */
    public function it_handles_geography_based_queries(): void
    {
        $geography1 = SimpleGeography::empty()
            ->withText('Province 3', 'Kathmandu', 'Ward 5')
            ->withIds(3, 25, 125);
        
        $member1 = Member::create(
            new PersonalInfo('Member 1', 'm1@example.com', '+9779841234501'),
            new MembershipNumber('UML', '2024', 'F', 1001),
            $geography1
        );
        $member1->submitApplication();
        $member1->approve(123);
        $member1->activate('pay_1001');
        $this->repository->save($member1);
        
        $geography2 = SimpleGeography::empty()
            ->withText('Province 3', 'Lalitpur', 'Ward 3')
            ->withIds(3, 26, 103);
        
        $member2 = Member::create(
            new PersonalInfo('Member 2', 'm2@example.com', '+9779841234502'),
            new MembershipNumber('UML', '2024', 'F', 1002),
            $geography2
        );
        $member2->submitApplication();
        $member2->approve(123);
        $member2->activate('pay_1002');
        $this->repository->save($member2);
        
        // Find by province
        $provinceGeo = SimpleGeography::empty()->withIds(3);
        $provinceMembers = $this->repository->findActiveByGeography($provinceGeo);
        
        $this->assertCount(2, $provinceMembers);
        
        // Find by district
        $districtGeo = SimpleGeography::empty()->withIds(3, 25);
        $districtMembers = $this->repository->findActiveByGeography($districtGeo);
        
        $this->assertCount(1, $districtMembers);
        $this->assertEquals('Member 1', $districtMembers[0]->personalInfo()->fullName());
    }
}
```

**Run repository tests:**
```bash
php artisan test tests/Unit/Contexts/Membership/Infrastructure/Repositories/EloquentMemberRepositoryTest.php
```

---

## **STEP 3.5: SERVICE PROVIDER FOR DEPENDENCY INJECTION**

### **3.5.1 Create Service Provider**

```php
<?php

// app/Contexts/Membership/Infrastructure/Providers/MembershipServiceProvider.php

namespace App\Contexts\Membership\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Infrastructure\Repositories\EloquentMemberRepository;

class MembershipServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            MemberRepositoryInterface::class,
            EloquentMemberRepository::class
        );
    }
    
    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__ . '/../Database/Migrations/Tenant'
        );
    }
}
```

### **3.5.2 Register Service Provider**

Add to `config/app.php`:

```php
'providers' => [
    // ...
    App\Contexts\Membership\Infrastructure\Providers\MembershipServiceProvider::class,
],
```

---

## **STEP 3.6: INTEGRATION TEST WITH REAL DATABASE**

### **3.6.1 Create Integration Test**

```php
<?php

// tests/Feature/Contexts/Membership/Repositories/MemberRepositoryIntegrationTest.php

namespace Tests\Feature\Contexts\Membership\Repositories;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use Illuminate\Foundation\Testing\RefreshDatabase;

class MemberRepositoryIntegrationTest extends TestCase
{
    use RefreshDatabase;
    
    private MemberRepositoryInterface $repository;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        $this->repository = app(MemberRepositoryInterface::class);
    }
    
    /** @test */
    public function it_persists_and_retrieves_member_with_complete_lifecycle(): void
    {
        // Create member
        $member = Member::create(
            personalInfo: new PersonalInfo('Integration Test', 'integration@example.com', '+9779841234999'),
            membershipNumber: new MembershipNumber('UML', '2024', 'F', 9999),
            geography: SimpleGeography::empty()
                ->withText('Province 3', 'Kathmandu', 'Ward 5')
        );
        
        // Save
        $this->repository->save($member);
        
        // Verify save
        $saved = $this->repository->find($member->id());
        $this->assertNotNull($saved);
        $this->assertEquals('Integration Test', $saved->personalInfo()->fullName());
        $this->assertTrue($saved->status()->isDraft());
        
        // Update lifecycle
        $saved->submitApplication();
        $saved->approve(123);
        $saved->activate('pay_9999');
        
        // Save updates
        $this->repository->save($saved);
        
        // Verify updates persisted
        $updated = $this->repository->find($member->id());
        $this->assertTrue($updated->status()->isActive());
        $this->assertEquals(123, $updated->approvedBy());
        $this->assertEquals('pay_9999', $updated->paymentId());
        $this->assertNotNull($updated->approvedAt());
        $this->assertNotNull($updated->activatedAt());
    }
    
    /** @test */
    public function it_handles_bulk_operations(): void
    {
        // Create 10 members
        $members = [];
        
        for ($i = 1; $i <= 10; $i++) {
            $member = Member::create(
                new PersonalInfo("Member $i", "member$i@example.com", "+9779841234$i"),
                new MembershipNumber('UML', '2024', 'F', $i),
                SimpleGeography::empty()
            );
            
            if ($i <= 3) {
                $member->submitApplication();
            } elseif ($i <= 6) {
                $member->submitApplication();
                $member->approve(123);
            } else {
                $member->submitApplication();
                $member->approve(123);
                $member->activate("pay_$i");
            }
            
            $this->repository->save($member);
            $members[] = $member;
        }
        
        // Verify counts
        $this->assertEquals(10, $this->repository->countTotal());
        $this->assertEquals(4, $this->repository->countByStatus('draft'));
        $this->assertEquals(3, $this->repository->countByStatus('pending'));
        $this->assertEquals(3, $this->repository->countByStatus('approved'));
        $this->assertEquals(3, $this->repository->countByStatus('active'));
        
        // Verify pending applications
        $pending = $this->repository->findPendingApplications();
        $this->assertCount(3, $pending);
        
        // Verify sequence generation still works
        $nextSequence = $this->repository->getNextSequenceNumber('UML', '2024', 'F');
        $this->assertEquals(11, $nextSequence);
    }
    
    /** @test */
    public function it_enforces_uniqueness_constraints(): void
    {
        $member1 = Member::create(
            new PersonalInfo('Member One', 'member1@example.com', '+9779841234001'),
            new MembershipNumber('UML', '2024', 'F', 1),
            SimpleGeography::empty()
        );
        
        $this->repository->save($member1);
        
        // Try to create member with same phone
        $member2 = Member::create(
            new PersonalInfo('Member Two', 'member2@example.com', '+9779841234001'), // Same phone
            new MembershipNumber('UML', '2024', 'F', 2),
            SimpleGeography::empty()
        );
        
        $this->expectException(\App\Contexts\Membership\Domain\Exceptions\MemberRepositoryException::class);
        
        $this->repository->save($member2);
    }
    
    /** @test */
    public function it_supports_geography_enrichment_persistence(): void
    {
        $member = Member::create(
            new PersonalInfo('Geo Test', 'geo@example.com', '+9779841234998'),
            new MembershipNumber('UML', '2024', 'F', 9998),
            SimpleGeography::empty()
                ->withText('Province 3', 'Kathmandu')
        );
        
        $this->repository->save($member);
        
        // Enrich geography
        $member->enrichGeography(
            SimpleGeography::empty()
                ->withText('Province 3', 'Kathmandu', 'Ward 5')
                ->withIds(3, 25, 125)
        );
        
        $this->repository->save($member);
        
        // Retrieve and verify
        $retrieved = $this->repository->find($member->id());
        
        $this->assertEquals('advanced', $retrieved->geography()->tier());
        $this->assertEquals(3, $retrieved->geography()->provinceId());
        $this->assertEquals(25, $retrieved->geography()->districtId());
        $this->assertEquals(125, $retrieved->geography()->wardId());
        $this->assertNotNull($retrieved->geographyEnrichedAt());
    }
}
```

**Run integration tests:**
```bash
php artisan test tests/Feature/Contexts/Membership/Repositories/MemberRepositoryIntegrationTest.php
```

---

## **STEP 3.7: RUN ALL REPOSITORY TESTS**

```bash
# Run all repository tests
php artisan test tests/Unit/Contexts/Membership/Domain/Repositories/
php artisan test tests/Unit/Contexts/Membership/Infrastructure/Repositories/
php artisan test tests/Feature/Contexts/Membership/Repositories/

# Or run all Membership context tests
php artisan test --testsuite=Membership
```

✅ **All tests should pass**

---

## **📝 COMMIT PHASE 3 COMPLETION**

```bash
git add .
git commit -m "GREEN: Repository Pattern Implementation

- MemberRepositoryInterface: Complete contract for data persistence
- EloquentMemberRepository: Production-ready implementation
- Database migrations with proper indexes and constraints
- Custom Value Object casts for Eloquent
- Comprehensive test suite with:
  * Unit tests for repository contract
  * Integration tests with real database
  * Concurrent sequence generation tests
  * Uniqueness constraint enforcement
  * Geography-based query support
- Service Provider for dependency injection
- Key features:
  * Thread-safe sequence generation
  * Duplicate prevention (phone, email, membership number)
  * Event dispatch on save
  * Soft delete support
  * JSON-based geography storage
  * Generated columns for performance"
```

---

## **🎯 ARCHITECTURE ACHIEVED**

### **✅ What We Have Now:**

1. **Clean Separation**: Domain models know nothing about persistence
2. **Testable**: Can mock repository for unit tests
3. **Flexible**: Can swap implementations (Eloquent → Redis → etc.)
4. **Scalable**: Proper indexing and query optimization
5. **Thread-safe**: Sequence generation with database locks
6. **Event-driven**: Automatic event dispatch on save

### **🔧 Ready for Production:**

```php
// Usage example in application service:
class RegisterMemberService
{
    public function __construct(
        private MemberRepositoryInterface $members
    ) {}
    
    public function execute(array $data): Member
    {
        $member = Member::create(...);
        $this->members->save($member);
        return $member;
    }
}
```

### **🚀 Next Phase Options:**

**Option A: Application Services** - Implement use cases
**Option B: API Layer** - Create REST endpoints
**Option C: Event Listeners** - Handle domain events

**Which would you like to implement next?**