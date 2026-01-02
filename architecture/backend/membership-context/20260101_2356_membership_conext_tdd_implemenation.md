# 🚀 **COMPLETE TDD IMPLEMENTATION GUIDE**

## **PHASE 1: SETUP & FOUNDATION**

### **Step 1.1: Environment Setup & TDD Configuration**

```bash
# 1. Create test directory structure
mkdir -p tests/Unit/Contexts/Membership/Domain/{Models,ValueObjects,Services}
mkdir -p tests/Unit/Contexts/Membership/Application/{Commands,Services}
mkdir -p tests/Feature/Contexts/Membership

# 2. Configure PHPUnit for DDD
# phpunit.xml
<testsuites>
    <testsuite name="Unit">
        <directory suffix="Test.php">./tests/Unit</directory>
    </testsuite>
    <testsuite name="Feature">
        <directory suffix="Test.php">./tests/Feature</directory>
    </testsuite>
    <testsuite name="Membership">
        <directory suffix="Test.php">./tests/Unit/Contexts/Membership</directory>
        <directory suffix="Test.php">./tests/Feature/Contexts/Membership</directory>
    </testsuite>
</testsuites>
```

### **Step 1.2: Create Base Test Classes**

```php
// tests/TestCase.php
namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use App\Contexts\Membership\Infrastructure\Database\TenantDatabaseManager;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // Use test database for tenant
        config(['database.connections.tenant.database' => 'test_tenant']);
        
        // Run tenant migrations
        $this->artisan('migrate:fresh', [
            '--database' => 'tenant',
            '--path' => 'app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant'
        ]);
    }
}

// tests/Unit/Contexts/Membership/Domain/MemberTest.php
namespace Tests\Unit\Contexts\Membership\Domain;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Exceptions\InvalidMembershipException;

class MemberTest extends TestCase
{
    /** @test */
    public function it_can_be_instantiated_with_required_fields()
    {
        $member = Member::create([
            'full_name' => 'John Doe',
            'membership_number' => 'UML-2024-F-000001',
            'admin_unit_level1_id' => 1, // Province
            'admin_unit_level2_id' => 12, // District
            'tenant_user_id' => 1,
        ]);
        
        $this->assertInstanceOf(Member::class, $member);
        $this->assertEquals('John Doe', $member->full_name);
    }
    
    /** @test */
    public function it_requires_province_and_district()
    {
        $this->expectException(InvalidMembershipException::class);
        
        Member::create([
            'full_name' => 'John Doe',
            'membership_number' => 'UML-2024-F-000001',
            // Missing province and district - should fail
        ]);
    }
}
```

**Run test first (should fail):**
```bash
php artisan test --testsuite=Membership
```

---

## **PHASE 2: VALUE OBJECTS (TDD FIRST)**

### **Step 2.1: MembershipNumber Value Object**

```php
// tests/Unit/Contexts/Membership/Domain/ValueObjects/MembershipNumberTest.php
namespace Tests\Unit\Contexts\Membership\Domain\ValueObjects;

use Tests\TestCase;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\Exceptions\InvalidMembershipNumberException;

class MembershipNumberTest extends TestCase
{
    /** @test */
    public function it_creates_valid_membership_number()
    {
        $number = new MembershipNumber('UML', '2024', 'F', 123);
        
        $this->assertEquals('UML-2024-F-000123', (string) $number);
        $this->assertEquals('UML', $number->tenantSlug());
        $this->assertEquals(2024, $number->year());
        $this->assertEquals('F', $number->typeCode());
        $this->assertEquals(123, $number->sequence());
    }
    
    /** @test */
    public function it_rejects_invalid_format()
    {
        $this->expectException(InvalidMembershipNumberException::class);
        
        new MembershipNumber('UML', '2024', 'X', 123); // Invalid type code
    }
    
    /** @test */
    public function it_parses_from_string()
    {
        $number = MembershipNumber::fromString('UML-2024-F-000123');
        
        $this->assertEquals('UML', $number->tenantSlug());
        $this->assertEquals(2024, $number->year());
        $this->assertEquals('F', $number->typeCode());
        $this->assertEquals(123, $number->sequence());
    }
}
```

**Implement the Value Object:**

```php
// app/Contexts/Membership/Domain/ValueObjects/MembershipNumber.php
namespace App\Contexts\Membership\Domain\ValueObjects;

use App\Contexts\Membership\Domain\Exceptions\InvalidMembershipNumberException;

class MembershipNumber
{
    private const TYPE_CODES = ['F', 'Y', 'S', 'A']; // Full, Youth, Student, Associate
    private const FORMAT_REGEX = '/^([A-Z]{3})-(\d{4})-([A-Z])-(\d{6})$/';
    
    private string $tenantSlug;
    private int $year;
    private string $typeCode;
    private int $sequence;
    
    public function __construct(string $tenantSlug, string $year, string $typeCode, int $sequence)
    {
        $this->validateTenantSlug($tenantSlug);
        $this->validateYear($year);
        $this->validateTypeCode($typeCode);
        $this->validateSequence($sequence);
        
        $this->tenantSlug = strtoupper($tenantSlug);
        $this->year = (int) $year;
        $this->typeCode = $typeCode;
        $this->sequence = $sequence;
    }
    
    public static function fromString(string $number): self
    {
        if (!preg_match(self::FORMAT_REGEX, $number, $matches)) {
            throw new InvalidMembershipNumberException(
                "Invalid membership number format: $number"
            );
        }
        
        return new self($matches[1], $matches[2], $matches[3], (int) $matches[4]);
    }
    
    public function tenantSlug(): string
    {
        return $this->tenantSlug;
    }
    
    public function year(): int
    {
        return $this->year;
    }
    
    public function typeCode(): string
    {
        return $this->typeCode;
    }
    
    public function sequence(): int
    {
        return $this->sequence;
    }
    
    public function __toString(): string
    {
        return sprintf(
            '%s-%04d-%s-%06d',
            $this->tenantSlug,
            $this->year,
            $this->typeCode,
            $this->sequence
        );
    }
    
    private function validateTenantSlug(string $slug): void
    {
        if (strlen($slug) !== 3 || !ctype_upper($slug)) {
            throw new InvalidMembershipNumberException(
                "Tenant slug must be 3 uppercase letters"
            );
        }
    }
    
    private function validateYear(string $year): void
    {
        $yearInt = (int) $year;
        if ($yearInt < 2000 || $yearInt > 2100) {
            throw new InvalidMembershipNumberException(
                "Year must be between 2000 and 2100"
            );
        }
    }
    
    private function validateTypeCode(string $typeCode): void
    {
        if (!in_array($typeCode, self::TYPE_CODES)) {
            throw new InvalidMembershipNumberException(
                "Type code must be one of: " . implode(', ', self::TYPE_CODES)
            );
        }
    }
    
    private function validateSequence(int $sequence): void
    {
        if ($sequence < 1 || $sequence > 999999) {
            throw new InvalidMembershipNumberException(
                "Sequence must be between 1 and 999999"
            );
        }
    }
}
```

**Run tests:**
```bash
php artisan test tests/Unit/Contexts/Membership/Domain/ValueObjects/MembershipNumberTest.php
```

---

### **Step 2.2: GeographyPath Value Object**

```php
// tests/Unit/Contexts/Membership/Domain/ValueObjects/GeographyPathTest.php
namespace Tests\Unit\Contexts\Membership\Domain\ValueObjects;

use Tests\TestCase;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;
use App\Contexts\Membership\Domain\Exceptions\InvalidGeographyPathException;

class GeographyPathTest extends TestCase
{
    /** @test */
    public function it_creates_valid_geography_path()
    {
        $path = new GeographyPath([1, 12, 123, 1234]);
        
        $this->assertEquals('1.12.123.1234', (string) $path);
        $this->assertEquals([1, 12, 123, 1234], $path->toArray());
        $this->assertEquals(4, $path->depth());
        $this->assertEquals(1234, $path->getLeafId());
    }
    
    /** @test */
    public function it_can_be_created_from_string()
    {
        $path = GeographyPath::fromString('1.12.123.1234');
        
        $this->assertEquals([1, 12, 123, 1234], $path->toArray());
    }
    
    /** @test */
    public function it_validates_path_depth()
    {
        $this->expectException(InvalidGeographyPathException::class);
        
        // More than 8 levels not allowed
        new GeographyPath([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
    
    /** @test */
    public function it_can_check_if_is_descendant()
    {
        $childPath = new GeographyPath([1, 12, 123, 1234]);
        $parentPath = new GeographyPath([1, 12]);
        
        $this->assertTrue($childPath->isDescendantOf($parentPath));
        $this->assertFalse($parentPath->isDescendantOf($childPath));
    }
}
```

**Implement GeographyPath:**

```php
// app/Contexts/Membership/Domain/ValueObjects/GeographyPath.php
namespace App\Contexts\Membership\Domain\ValueObjects;

use App\Contexts\Membership\Domain\Exceptions\InvalidGeographyPathException;

class GeographyPath
{
    private const MAX_DEPTH = 8;
    private array $nodes;
    
    public function __construct(array $nodes)
    {
        $this->validateNodes($nodes);
        $this->nodes = $nodes;
    }
    
    public static function fromString(string $path): self
    {
        $nodes = array_filter(explode('.', $path), 'strlen');
        
        if (empty($nodes)) {
            throw new InvalidGeographyPathException("Empty geography path");
        }
        
        return new self(array_map('intval', $nodes));
    }
    
    public function toArray(): array
    {
        return $this->nodes;
    }
    
    public function depth(): int
    {
        return count($this->nodes);
    }
    
    public function getLeafId(): int
    {
        return end($this->nodes);
    }
    
    public function getParent(): ?self
    {
        if ($this->depth() <= 1) {
            return null;
        }
        
        $parentNodes = array_slice($this->nodes, 0, -1);
        return new self($parentNodes);
    }
    
    public function isDescendantOf(self $ancestor): bool
    {
        if ($this->depth() <= $ancestor->depth()) {
            return false;
        }
        
        $ancestorNodes = $ancestor->toArray();
        $thisNodes = $this->toArray();
        
        for ($i = 0; $i < count($ancestorNodes); $i++) {
            if ($ancestorNodes[$i] !== $thisNodes[$i]) {
                return false;
            }
        }
        
        return true;
    }
    
    public function __toString(): string
    {
        return implode('.', $this->nodes);
    }
    
    private function validateNodes(array $nodes): void
    {
        if (empty($nodes)) {
            throw new InvalidGeographyPathException("Geography path cannot be empty");
        }
        
        if (count($nodes) > self::MAX_DEPTH) {
            throw new InvalidGeographyPathException(
                "Geography path cannot exceed " . self::MAX_DEPTH . " levels"
            );
        }
        
        foreach ($nodes as $node) {
            if (!is_numeric($node) || $node <= 0) {
                throw new InvalidGeographyPathException(
                    "Geography node must be positive integer"
                );
            }
        }
    }
}
```

---

## **PHASE 3: DOMAIN MODEL (AGGREGATE ROOT)**

### **Step 3.1: Member Aggregate Root with State Pattern**

**First, test the State Pattern:**

```php
// tests/Unit/Contexts/Membership/Domain/Models/States/MemberStatusTest.php
namespace Tests\Unit\Contexts\Membership\Domain\Models\States;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\States\DraftStatus;
use App\Contexts\Membership\Domain\Models\States\PendingStatus;
use App\Contexts\Membership\Domain\Models\States\ActiveStatus;
use App\Contexts\Membership\Domain\Models\States\SuspendedStatus;

class MemberStatusTest extends TestCase
{
    /** @test */
    public function draft_status_can_transition_to_pending()
    {
        $status = new DraftStatus();
        
        $this->assertTrue($status->canTransitionTo(PendingStatus::class));
        $this->assertFalse($status->canVote());
        $this->assertFalse($status->canAccessForum());
    }
    
    /** @test */
    public function active_status_has_full_privileges()
    {
        $status = new ActiveStatus();
        
        $this->assertTrue($status->canVote());
        $this->assertTrue($status->canAccessForum());
        $this->assertTrue($status->canHoldOffice());
    }
    
    /** @test */
    public function suspended_status_has_no_privileges()
    {
        $status = new SuspendedStatus();
        
        $this->assertFalse($status->canVote());
        $this->assertFalse($status->canAccessForum());
        $this->assertFalse($status->canHoldOffice());
    }
    
    /** @test */
    public function invalid_transitions_are_rejected()
    {
        $status = new DraftStatus();
        
        $this->assertFalse($status->canTransitionTo(ActiveStatus::class));
    }
}
```

**Implement State Pattern:**

```php
// app/Contexts/Membership/Domain/Models/States/MemberStatus.php
namespace App\Contexts\Membership\Domain\Models\States;

abstract class MemberStatus
{
    const DRAFT = 'draft';
    const PENDING = 'pending';
    const UNDER_REVIEW = 'under_review';
    const APPROVED = 'approved';
    const AWAITING_PAYMENT = 'awaiting_payment';
    const ACTIVE = 'active';
    const SUSPENDED = 'suspended';
    const EXPIRED = 'expired';
    const TERMINATED = 'terminated';
    
    protected string $value;
    
    public function __construct(string $value)
    {
        $this->value = $value;
    }
    
    abstract public function canVote(): bool;
    abstract public function canAccessForum(): bool;
    abstract public function canHoldOffice(): bool;
    
    public function value(): string
    {
        return $this->value;
    }
    
    public function canTransitionTo(string $newStatus): bool
    {
        $transitions = $this->getAllowedTransitions();
        return in_array($newStatus, $transitions);
    }
    
    protected function getAllowedTransitions(): array
    {
        return [
            self::DRAFT => [self::PENDING],
            self::PENDING => [self::UNDER_REVIEW, self::TERMINATED],
            self::UNDER_REVIEW => [self::APPROVED, self::TERMINATED],
            self::APPROVED => [self::AWAITING_PAYMENT],
            self::AWAITING_PAYMENT => [self::ACTIVE, self::SUSPENDED],
            self::ACTIVE => [self::SUSPENDED, self::EXPIRED],
            self::SUSPENDED => [self::ACTIVE, self::TERMINATED],
            self::EXPIRED => [self::ACTIVE, self::TERMINATED],
            self::TERMINATED => [],
        ][$this->value] ?? [];
    }
}

// app/Contexts/Membership/Domain/Models/States/DraftStatus.php
class DraftStatus extends MemberStatus
{
    public function __construct()
    {
        parent::__construct(self::DRAFT);
    }
    
    public function canVote(): bool { return false; }
    public function canAccessForum(): bool { return false; }
    public function canHoldOffice(): bool { return false; }
}

// app/Contexts/Membership/Domain/Models/States/ActiveStatus.php
class ActiveStatus extends MemberStatus
{
    public function __construct()
    {
        parent::__construct(self::ACTIVE);
    }
    
    public function canVote(): bool { return true; }
    public function canAccessForum(): bool { return true; }
    public function canHoldOffice(): bool { return true; }
}
// ... Implement other status classes similarly
```

### **Step 3.2: Member Aggregate Root Tests**

```php
// tests/Unit/Contexts/Membership/Domain/Models/MemberTest.php
namespace Tests\Unit\Contexts\Membership\Domain\Models;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Models\States\DraftStatus;
use App\Contexts\Membership\Domain\Models\States\PendingStatus;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;
use App\Contexts\Membership\Domain\Exceptions\InvalidMembershipException;

class MemberTest extends TestCase
{
    private function createMember(array $overrides = []): Member
    {
        $defaults = [
            'full_name' => 'John Doe',
            'membership_number' => MembershipNumber::fromString('UML-2024-F-000001'),
            'geography_path' => new GeographyPath([1, 12]),
            'status' => new DraftStatus(),
            'tenant_user_id' => 1,
        ];
        
        return new Member(array_merge($defaults, $overrides));
    }
    
    /** @test */
    public function it_submits_application_and_transitions_to_pending()
    {
        $member = $this->createMember();
        
        $member->submitApplication();
        
        $this->assertInstanceOf(PendingStatus::class, $member->status());
        $this->assertCount(1, $member->releaseEvents());
    }
    
    /** @test */
    public function it_cannot_submit_without_required_fields()
    {
        $member = new Member([
            'full_name' => 'John Doe',
            // Missing required fields
        ]);
        
        $this->expectException(InvalidMembershipException::class);
        $member->submitApplication();
    }
    
    /** @test */
    public function it_can_be_approved_by_committee()
    {
        $member = $this->createMember(['status' => new PendingStatus()]);
        
        $member->approve(123); // committee member ID
        
        $this->assertEquals('approved', $member->status()->value());
        $this->assertEquals(123, $member->approvedBy());
    }
    
    /** @test */
    public function it_records_sponsorship()
    {
        $member = $this->createMember();
        $sponsorId = 456;
        
        $member->recordSponsorship($sponsorId);
        
        $this->assertEquals($sponsorId, $member->sponsorId());
    }
}
```

### **Step 3.3: Implement Member Aggregate Root**

```php
// app/Contexts/Membership/Domain/Models/Member.php
namespace App\Contexts\Membership\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use App\Contexts\Membership\Domain\Models\States\MemberStatus;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;
use App\Contexts\Membership\Domain\Events\MemberApplicationSubmitted;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\Exceptions\InvalidMembershipException;

class Member extends Model
{
    private array $domainEvents = [];
    
    protected $fillable = [
        'full_name',
        'membership_number',
        'geography_path',
        'status',
        'tenant_user_id',
        'sponsor_id',
        'approved_by',
        'approved_at',
        'activated_at',
        'membership_type',
    ];
    
    protected $casts = [
        'membership_number' => MembershipNumber::class,
        'geography_path' => GeographyPath::class,
        'status' => MemberStatus::class,
        'approved_at' => 'datetime',
        'activated_at' => 'datetime',
    ];
    
    public function submitApplication(): void
    {
        $this->validateForSubmission();
        
        $this->status = $this->status->transitionTo('pending');
        
        $this->recordThat(new MemberApplicationSubmitted(
            $this->id,
            $this->geography_path,
            $this->membership_type,
            now()
        ));
    }
    
    public function approve(int $committeeMemberId): void
    {
        if (!$this->status->canTransitionTo('approved')) {
            throw new InvalidMembershipException(
                "Cannot approve member in {$this->status->value()} status"
            );
        }
        
        $this->status = $this->status->transitionTo('approved');
        $this->approved_by = $committeeMemberId;
        $this->approved_at = now();
        
        $this->recordThat(new MemberApproved(
            $this->id,
            $this->geography_path,
            $committeeMemberId,
            now()
        ));
    }
    
    public function activate(int $paymentId): void
    {
        if (!$this->status->canTransitionTo('active')) {
            throw new InvalidMembershipException(
                "Cannot activate member in {$this->status->value()} status"
            );
        }
        
        $this->status = $this->status->transitionTo('active');
        $this->activated_at = now();
        
        $this->recordThat(new MemberActivated(
            $this->id,
            $paymentId,
            now()
        ));
    }
    
    public function recordSponsorship(int $sponsorId): void
    {
        $this->sponsor_id = $sponsorId;
    }
    
    public function status(): MemberStatus
    {
        return $this->status;
    }
    
    public function sponsorId(): ?int
    {
        return $this->sponsor_id;
    }
    
    public function approvedBy(): ?int
    {
        return $this->approved_by;
    }
    
    protected function validateForSubmission(): void
    {
        if (empty($this->full_name)) {
            throw new InvalidMembershipException("Full name is required");
        }
        
        if (!$this->geography_path || $this->geography_path->depth() < 2) {
            throw new InvalidMembershipException("At least province and district are required");
        }
        
        if (!$this->membership_number) {
            throw new InvalidMembershipException("Membership number is required");
        }
    }
    
    protected function recordThat($event): void
    {
        $this->domainEvents[] = $event;
    }
    
    public function releaseEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];
        return $events;
    }
}
```

---

## **PHASE 4: REPOSITORY PATTERN**

### **Step 4.1: Repository Interface & Tests**

```php
// app/Contexts/Membership/Domain/Repositories/MemberRepositoryInterface.php
namespace App\Contexts\Membership\Domain\Repositories;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;

interface MemberRepositoryInterface
{
    public function save(Member $member): void;
    public function find(int $id): ?Member;
    public function findByMembershipNumber(string $number): ?Member;
    public function findByTenantUserId(int $userId): ?Member;
    public function findActiveByGeography(GeographyPath $path): array;
    public function countActiveMembers(): int;
}

// tests/Unit/Contexts/Membership/Infrastructure/Repositories/MemberRepositoryTest.php
namespace Tests\Unit\Contexts\Membership\Infrastructure\Repositories;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;

class MemberRepositoryTest extends TestCase
{
    private MemberRepositoryInterface $repository;
    
    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = app(MemberRepositoryInterface::class);
    }
    
    /** @test */
    public function it_saves_and_retrieves_member()
    {
        $member = Member::create([
            'full_name' => 'John Doe',
            'membership_number' => MembershipNumber::fromString('UML-2024-F-000001'),
            'geography_path' => new GeographyPath([1, 12]),
            'tenant_user_id' => 1,
        ]);
        
        $this->repository->save($member);
        
        $retrieved = $this->repository->find($member->id);
        
        $this->assertNotNull($retrieved);
        $this->assertEquals('John Doe', $retrieved->full_name);
        $this->assertEquals('UML-2024-F-000001', (string) $retrieved->membership_number);
    }
    
    /** @test */
    public function it_finds_member_by_membership_number()
    {
        $member = Member::create([
            'full_name' => 'Jane Doe',
            'membership_number' => MembershipNumber::fromString('UML-2024-F-000002'),
            'geography_path' => new GeographyPath([1, 12]),
            'tenant_user_id' => 2,
        ]);
        
        $this->repository->save($member);
        
        $found = $this->repository->findByMembershipNumber('UML-2024-F-000002');
        
        $this->assertNotNull($found);
        $this->assertEquals('Jane Doe', $found->full_name);
    }
}
```

### **Step 4.2: Implement Eloquent Repository**

```php
// app/Contexts/Membership/Infrastructure/Repositories/EloquentMemberRepository.php
namespace App\Contexts\Membership\Infrastructure\Repositories;

use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;
use Illuminate\Support\Facades\DB;

class EloquentMemberRepository implements MemberRepositoryInterface
{
    public function save(Member $member): void
    {
        DB::transaction(function () use ($member) {
            $member->save();
            
            // Dispatch domain events
            foreach ($member->releaseEvents() as $event) {
                event($event);
            }
        });
    }
    
    public function find(int $id): ?Member
    {
        return Member::find($id);
    }
    
    public function findByMembershipNumber(string $number): ?Member
    {
        return Member::where('membership_number', $number)->first();
    }
    
    public function findByTenantUserId(int $userId): ?Member
    {
        return Member::where('tenant_user_id', $userId)->first();
    }
    
    public function findActiveByGeography(GeographyPath $path): array
    {
        return Member::where('geography_path', 'like', $path . '%')
            ->where('status', 'active')
            ->get()
            ->all();
    }
    
    public function countActiveMembers(): int
    {
        return Member::where('status', 'active')->count();
    }
}
```

**Register Repository in Service Provider:**

```php
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
            __DIR__ . '/../Database/Migrations'
        );
    }
}
```

---

## **PHASE 5: APPLICATION SERVICES (COMMAND PATTERN)**

### **Step 5.1: Submit Membership Application Command**

```php
// tests/Unit/Contexts/Membership/Application/Commands/SubmitMembershipApplicationCommandTest.php
namespace Tests\Unit\Contexts\Membership\Application\Commands;

use Tests\TestCase;
use App\Contexts\Membership\Application\Commands\SubmitMembershipApplicationCommand;
use App\Contexts\Membership\Application\Commands\SubmitMembershipApplicationHandler;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Services\GeographyValidationServiceInterface;
use Mockery;

class SubmitMembershipApplicationCommandTest extends TestCase
{
    private $repository;
    private $geographyService;
    private $handler;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        $this->repository = Mockery::mock(MemberRepositoryInterface::class);
        $this->geographyService = Mockery::mock(GeographyValidationServiceInterface::class);
        
        $this->handler = new SubmitMembershipApplicationHandler(
            $this->repository,
            $this->geographyService
        );
    }
    
    /** @test */
    public function it_handles_submit_membership_application_command()
    {
        $command = new SubmitMembershipApplicationCommand(
            fullName: 'John Doe',
            email: 'john@example.com',
            provinceId: 1,
            districtId: 12,
            wardId: 123,
            membershipType: 'full',
            sponsorId: 456
        );
        
        // Mock geography validation
        $this->geographyService->shouldReceive('validateHierarchy')
            ->with([1, 12, 123])
            ->andReturn(true);
        
        // Mock repository save
        $this->repository->shouldReceive('save')
            ->once()
            ->with(Mockery::type(Member::class));
        
        $member = $this->handler->handle($command);
        
        $this->assertInstanceOf(Member::class, $member);
        $this->assertEquals('John Doe', $member->full_name);
        $this->assertEquals('full', $member->membership_type);
    }
}
```

### **Step 5.2: Implement Application Service**

```php
// app/Contexts/Membership/Application/Commands/SubmitMembershipApplicationCommand.php
namespace App\Contexts\Membership\Application\Commands;

class SubmitMembershipApplicationCommand
{
    public function __construct(
        public readonly string $fullName,
        public readonly string $email,
        public readonly int $provinceId,
        public readonly int $districtId,
        public readonly ?int $wardId = null,
        public readonly ?int $localLevelId = null,
        public readonly string $membershipType = 'full',
        public readonly ?int $sponsorId = null,
        public readonly array $documents = []
    ) {}
}

// app/Contexts/Membership/Application/Commands/SubmitMembershipApplicationHandler.php
namespace App\Contexts\Membership\Application\Commands;

use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Services\GeographyValidationServiceInterface;
use App\Contexts\Membership\Domain\Services\MembershipNumberGeneratorInterface;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\TenantAuth\Application\Services\TenantUserCreatorInterface;
use Illuminate\Support\Facades\DB;

class SubmitMembershipApplicationHandler
{
    public function __construct(
        private MemberRepositoryInterface $memberRepository,
        private GeographyValidationServiceInterface $geographyService,
        private MembershipNumberGeneratorInterface $numberGenerator,
        private TenantUserCreatorInterface $userCreator
    ) {}
    
    public function handle(SubmitMembershipApplicationCommand $command): Member
    {
        return DB::transaction(function () use ($command) {
            // 1. Validate geography hierarchy
            $geographyIds = array_filter([
                $command->provinceId,
                $command->districtId,
                $command->localLevelId,
                $command->wardId,
            ]);
            
            $this->geographyService->validateHierarchy($geographyIds);
            
            // 2. Generate membership number
            $membershipNumber = $this->numberGenerator->generate(
                tenantSlug: config('tenancy.current_tenant_slug'),
                membershipType: $command->membershipType
            );
            
            // 3. Create geography path
            $geographyPath = new GeographyPath($geographyIds);
            
            // 4. Create TenantUser for login
            $tenantUser = $this->userCreator->create([
                'email' => $command->email,
                'full_name' => $command->fullName,
                'is_active' => false, // Inactive until approved
            ]);
            
            // 5. Create Member aggregate
            $member = new Member([
                'full_name' => $command->fullName,
                'membership_number' => $membershipNumber,
                'geography_path' => $geographyPath,
                'membership_type' => $command->membershipType,
                'tenant_user_id' => $tenantUser->id,
                'sponsor_id' => $command->sponsorId,
            ]);
            
            // 6. Submit application (triggers domain events)
            $member->submitApplication();
            
            // 7. Save member (repository dispatches events)
            $this->memberRepository->save($member);
            
            return $member;
        });
    }
}
```

---

## **PHASE 6: DOMAIN EVENTS & INTEGRATION**

### **Step 6.1: Domain Events**

```php
// app/Contexts/Membership/Domain/Events/MemberApplicationSubmitted.php
namespace App\Contexts\Membership\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;

class MemberApplicationSubmitted
{
    use Dispatchable, SerializesModels;
    
    public function __construct(
        public readonly int $memberId,
        public readonly GeographyPath $geographyPath,
        public readonly string $membershipType,
        public readonly \DateTimeImmutable $submittedAt
    ) {}
}

// app/Contexts/Membership/Domain/Events/MemberApproved.php
namespace App\Contexts\Membership\Domain\Events;

class MemberApproved
{
    use Dispatchable, SerializesModels;
    
    public function __construct(
        public readonly int $memberId,
        public readonly GeographyPath $geographyPath,
        public readonly int $approvedBy,
        public readonly \DateTimeImmutable $approvedAt
    ) {}
}
```

### **Step 6.2: Event Listeners (Anti-Corruption Layer)**

```php
// app/Contexts/Membership/Infrastructure/EventListeners/CreateFinancialLevyOnMemberApproval.php
namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Infrastructure\Adapters\FinanceServiceAdapter;

class CreateFinancialLevyOnMemberApproval
{
    public function __construct(
        private FinanceServiceAdapter $financeAdapter
    ) {}
    
    public function handle(MemberApproved $event): void
    {
        // Call finance context via adapter
        $this->financeAdapter->createMembershipFee(
            memberId: $event->memberId,
            geographyPath: $event->geographyPath,
            approvedAt: $event->approvedAt
        );
    }
}

// app/Contexts/Membership/Infrastructure/EventListeners/GrantForumAccessOnMemberActivated.php
namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Infrastructure\Adapters\ForumServiceAdapter;

class GrantForumAccessOnMemberActivated
{
    public function __construct(
        private ForumServiceAdapter $forumAdapter
    ) {}
    
    public function handle(MemberActivated $event): void
    {
        $this->forumAdapter->grantFullAccess($event->memberId);
    }
}
```

**Register Event Listeners:**

```php
// app/Contexts/Membership/Infrastructure/Providers/EventServiceProvider.php
namespace App\Contexts\Membership\Infrastructure\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Infrastructure\EventListeners\CreateFinancialLevyOnMemberApproval;
use App\Contexts\Membership\Infrastructure\EventListeners\GrantForumAccessOnMemberActivated;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        MemberApproved::class => [
            CreateFinancialLevyOnMemberApproval::class,
        ],
        MemberActivated::class => [
            GrantForumAccessOnMemberActivated::class,
        ],
    ];
}
```

---

## **PHASE 7: DATABASE MIGRATIONS**

### **Step 7.1: Create Optimized Database Schema**

```php
// app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/2025_01_01_000001_create_members_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            
            // Tenant identification
            $table->uuid('tenant_id');
            $table->foreignId('tenant_user_id')
                ->unique()
                ->constrained('tenant_users')
                ->onDelete('cascade');
            
            // Geography (PostgreSQL ltree optimized)
            $table->string('geo_path')->nullable()->index(); // ltree path
            $table->integer('admin_unit_level1_id')->index(); // Province
            $table->integer('admin_unit_level2_id')->index(); // District
            $table->integer('admin_unit_level3_id')->nullable()->index(); // Local Level
            $table->integer('admin_unit_level4_id')->nullable()->index(); // Ward
            $table->integer('admin_unit_level5_id')->nullable()->index(); // Neighborhood
            $table->integer('admin_unit_level6_id')->nullable()->index(); // Street
            $table->integer('admin_unit_level7_id')->nullable()->index(); // House
            $table->integer('admin_unit_level8_id')->nullable()->index(); // Household
            
            // Member information
            $table->string('full_name');
            $table->string('membership_number')->unique();
            $table->enum('membership_type', ['full', 'youth', 'student', 'associate']);
            $table->enum('status', [
                'draft', 'pending', 'under_review', 'approved',
                'awaiting_payment', 'active', 'suspended', 'expired', 'terminated'
            ])->default('draft');
            
            // Sponsorship
            $table->foreignId('sponsor_id')->nullable()->constrained('members');
            
            // Approval tracking
            $table->foreignId('approved_by')->nullable()->constrained('tenant_users');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            
            // Timestamps
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes for common queries
            $table->index(['status', 'membership_type']);
            $table->index(['geo_path', 'status']);
            $table->index(['sponsor_id', 'status']);
        });
        
        // Add ltree extension for PostgreSQL
        DB::statement('CREATE EXTENSION IF NOT EXISTS ltree');
        
        // Create function to update geo_path from level IDs
        DB::statement('
            CREATE OR REPLACE FUNCTION update_member_geo_path()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.geo_path := COALESCE(
                    CASE 
                        WHEN NEW.admin_unit_level8_id IS NOT NULL THEN
                            NEW.admin_unit_level1_id || \'.\' || 
                            NEW.admin_unit_level2_id || \'.\' || 
                            NEW.admin_unit_level3_id || \'.\' || 
                            NEW.admin_unit_level4_id || \'.\' || 
                            NEW.admin_unit_level5_id || \'.\' || 
                            NEW.admin_unit_level6_id || \'.\' || 
                            NEW.admin_unit_level7_id || \'.\' || 
                            NEW.admin_unit_level8_id
                        WHEN NEW.admin_unit_level7_id IS NOT NULL THEN
                            NEW.admin_unit_level1_id || \'.\' || 
                            NEW.admin_unit_level2_id || \'.\' || 
                            NEW.admin_unit_level3_id || \'.\' || 
                            NEW.admin_unit_level4_id || \'.\' || 
                            NEW.admin_unit_level5_id || \'.\' || 
                            NEW.admin_unit_level6_id || \'.\' || 
                            NEW.admin_unit_level7_id
                        WHEN NEW.admin_unit_level6_id IS NOT NULL THEN
                            NEW.admin_unit_level1_id || \'.\' || 
                            NEW.admin_unit_level2_id || \'.\' || 
                            NEW.admin_unit_level3_id || \'.\' || 
                            NEW.admin_unit_level4_id || \'.\' || 
                            NEW.admin_unit_level5_id || \'.\' || 
                            NEW.admin_unit_level6_id
                        WHEN NEW.admin_unit_level5_id IS NOT NULL THEN
                            NEW.admin_unit_level1_id || \'.\' || 
                            NEW.admin_unit_level2_id || \'.\' || 
                            NEW.admin_unit_level3_id || \'.\' || 
                            NEW.admin_unit_level4_id || \'.\' || 
                            NEW.admin_unit_level5_id
                        WHEN NEW.admin_unit_level4_id IS NOT NULL THEN
                            NEW.admin_unit_level1_id || \'.\' || 
                            NEW.admin_unit_level2_id || \'.\' || 
                            NEW.admin_unit_level3_id || \'.\' || 
                            NEW.admin_unit_level4_id
                        WHEN NEW.admin_unit_level3_id IS NOT NULL THEN
                            NEW.admin_unit_level1_id || \'.\' || 
                            NEW.admin_unit_level2_id || \'.\' || 
                            NEW.admin_unit_level3_id
                        ELSE
                            NEW.admin_unit_level1_id || \'.\' || 
                            NEW.admin_unit_level2_id
                    END,
                    NULL
                );
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        ');
        
        // Create trigger to auto-update geo_path
        DB::statement('
            CREATE TRIGGER update_member_geo_path_trigger
            BEFORE INSERT OR UPDATE ON members
            FOR EACH ROW
            EXECUTE FUNCTION update_member_geo_path();
        ');
    }
    
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_member_geo_path_trigger ON members');
        DB::statement('DROP FUNCTION IF EXISTS update_member_geo_path()');
        Schema::dropIfExists('members');
    }
};
```

---

## **PHASE 8: API CONTROLLERS (HEXAGONAL ARCHITECTURE)**

### **Step 8.1: REST API with DTOs**

```php
// app/Contexts/Membership/Application/DTOs/SubmitMembershipApplicationDTO.php
namespace App\Contexts\Membership\Application\DTOs;

use Illuminate\Http\Request;

class SubmitMembershipApplicationDTO
{
    public function __construct(
        public readonly string $fullName,
        public readonly string $email,
        public readonly int $provinceId,
        public readonly int $districtId,
        public readonly ?int $wardId = null,
        public readonly ?int $localLevelId = null,
        public readonly string $membershipType = 'full',
        public readonly ?int $sponsorId = null
    ) {}
    
    public static function fromRequest(Request $request): self
    {
        return new self(
            fullName: $request->input('full_name'),
            email: $request->input('email'),
            provinceId: $request->input('province_id'),
            districtId: $request->input('district_id'),
            wardId: $request->input('ward_id'),
            localLevelId: $request->input('local_level_id'),
            membershipType: $request->input('membership_type', 'full'),
            sponsorId: $request->input('sponsor_id')
        );
    }
}

// app/Contexts/Membership/Interfaces/API/Controllers/MembershipApplicationController.php
namespace App\Contexts\Membership\Interfaces\API\Controllers;

use App\Http\Controllers\Controller;
use App\Contexts\Membership\Application\DTOs\SubmitMembershipApplicationDTO;
use App\Contexts\Membership\Application\Commands\SubmitMembershipApplicationCommand;
use App\Contexts\Membership\Application\Commands\SubmitMembershipApplicationHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MembershipApplicationController extends Controller
{
    public function __construct(
        private SubmitMembershipApplicationHandler $handler
    ) {}
    
    public function store(Request $request): JsonResponse
    {
        $dto = SubmitMembershipApplicationDTO::fromRequest($request);
        
        $command = new SubmitMembershipApplicationCommand(
            fullName: $dto->fullName,
            email: $dto->email,
            provinceId: $dto->provinceId,
            districtId: $dto->districtId,
            wardId: $dto->wardId,
            localLevelId: $dto->localLevelId,
            membershipType: $dto->membershipType,
            sponsorId: $dto->sponsorId
        );
        
        $member = $this->handler->handle($command);
        
        return response()->json([
            'success' => true,
            'message' => 'Membership application submitted successfully',
            'data' => [
                'member_id' => $member->id,
                'membership_number' => (string) $member->membership_number,
                'status' => $member->status->value(),
            ]
        ], 201);
    }
}
```

### **Step 8.2: API Routes**

```php
// routes/api/membership.php
use App\Contexts\Membership\Interfaces\API\Controllers\MembershipApplicationController;

Route::middleware(['auth:tenant', 'tenant.identified'])->group(function () {
    // Member applications
    Route::post('/applications', [MembershipApplicationController::class, 'store']);
    
    // Member management (admin only)
    Route::middleware(['can:manage_members'])->group(function () {
        Route::get('/applications/pending', [MembershipApplicationController::class, 'pending']);
        Route::put('/applications/{id}/approve', [MembershipApplicationController::class, 'approve']);
        Route::put('/applications/{id}/reject', [MembershipApplicationController::class, 'reject']);
    });
    
    // Member self-service
    Route::get('/profile', [MemberProfileController::class, 'show']);
    Route::put('/profile', [MemberProfileController::class, 'update']);
});
```

---

## **PHASE 9: TESTING STRATEGY**

### **Step 9.1: Comprehensive Test Suite**

```php
// tests/Feature/Contexts/Membership/SubmitMembershipApplicationTest.php
namespace Tests\Feature\Contexts\Membership;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;

class SubmitMembershipApplicationTest extends TestCase
{
    use RefreshDatabase;
    
    /** @test */
    public function user_can_submit_membership_application()
    {
        $response = $this->postJson('/api/membership/applications', [
            'full_name' => 'John Doe',
            'email' => 'john@example.com',
            'province_id' => 1,
            'district_id' => 12,
            'ward_id' => 123,
            'membership_type' => 'full',
        ]);
        
        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Membership application submitted successfully',
            ]);
        
        $this->assertDatabaseHas('members', [
            'full_name' => 'John Doe',
            'status' => 'pending',
        ]);
    }
    
    /** @test */
    public function it_requires_province_and_district()
    {
        $response = $this->postJson('/api/membership/applications', [
            'full_name' => 'John Doe',
            'email' => 'john@example.com',
            // Missing province and district
        ]);
        
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['province_id', 'district_id']);
    }
    
    /** @test */
    public function committee_member_can_approve_application()
    {
        $member = Member::factory()->create(['status' => 'pending']);
        
        $committeeMember = User::factory()->create();
        $committeeMember->assignRole('committee_member');
        
        $response = $this->actingAs($committeeMember)
            ->putJson("/api/membership/applications/{$member->id}/approve");
        
        $response->assertStatus(200);
        
        $this->assertDatabaseHas('members', [
            'id' => $member->id,
            'status' => 'approved',
            'approved_by' => $committeeMember->id,
        ]);
    }
}
```

### **Step 9.2: Factory for Testing**

```php
// database/factories/MemberFactory.php
namespace Database\Factories;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\ValueObjects\GeographyPath;
use Illuminate\Database\Eloquent\Factories\Factory;

class MemberFactory extends Factory
{
    protected $model = Member::class;
    
    public function definition(): array
    {
        return [
            'full_name' => $this->faker->name(),
            'membership_number' => MembershipNumber::fromString(
                'UML-2024-F-' . str_pad($this->faker->unique()->numberBetween(1, 999999), 6, '0', STR_PAD_LEFT)
            ),
            'geography_path' => new GeographyPath([1, 12, 123]),
            'tenant_user_id' => fn() => \App\Contexts\TenantAuth\Domain\Models\TenantUser::factory()->create()->id,
            'membership_type' => 'full',
            'status' => 'draft',
        ];
    }
    
    public function pending(): self
    {
        return $this->state(['status' => 'pending']);
    }
    
    public function approved(): self
    {
        return $this->state(['status' => 'approved']);
    }
    
    public function active(): self
    {
        return $this->state(['status' => 'active']);
    }
    
    public function withSponsor(int $sponsorId): self
    {
        return $this->state(['sponsor_id' => $sponsorId]);
    }
}
```

---

## **PHASE 10: DEPLOYMENT & OPTIMIZATION**

### **Step 10.1: Database Indexing Strategy**

```sql
-- Optimized indexes for political queries
CREATE INDEX idx_members_geo_status ON members(geo_path, status) WHERE status = 'active';
CREATE INDEX idx_members_sponsor_status ON members(sponsor_id, status);
CREATE INDEX idx_members_type_created ON members(membership_type, created_at);

-- Materialized view for committee dashboards
CREATE MATERIALIZED VIEW mv_committee_statistics AS
SELECT 
    geo_path,
    COUNT(*) as total_members,
    COUNT(*) FILTER (WHERE status = 'active') as active_members,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_applications,
    COUNT(*) FILTER (WHERE membership_type = 'youth') as youth_members,
    MAX(created_at) as last_updated
FROM members
GROUP BY geo_path;
```

### **Step 10.2: Caching Strategy**

```php
// app/Contexts/Membership/Infrastructure/Services/CachedMemberRepository.php
namespace App\Contexts\Membership\Infrastructure\Services;

use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use Illuminate\Support\Facades\Cache;

class CachedMemberRepository implements MemberRepositoryInterface
{
    private const CACHE_TTL = 3600; // 1 hour
    private const CACHE_PREFIX = 'member:';
    
    public function __construct(
        private MemberRepositoryInterface $decorated
    ) {}
    
    public function find(int $id): ?Member
    {
        $cacheKey = self::CACHE_PREFIX . $id;
        
        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($id) {
            return $this->decorated->find($id);
        });
    }
    
    public function countActiveMembers(): int
    {
        $cacheKey = 'members:active:count';
        
        return Cache::remember($cacheKey, 300, function () { // 5 minutes
            return $this->decorated->countActiveMembers();
        });
    }
    
    // Other methods delegate to decorated repository
    public function save(Member $member): void
    {
        $this->decorated->save($member);
        
        // Invalidate cache
        Cache::forget(self::CACHE_PREFIX . $member->id);
        Cache::forget('members:active:count');
    }
}
```

---

## **🎯 COMPLETE IMPLEMENTATION CHECKLIST**

### **Week 1: Foundation (Complete)**
- [ ] Value Objects (MembershipNumber, GeographyPath)
- [ ] Domain Events
- [ ] Member Aggregate Root with State Pattern
- [ ] Repository Interface

### **Week 2: Core Business Logic**
- [ ] Application Services (Commands/Handlers)
- [ ] Eligibility Specifications
- [ ] Membership Number Generator
- [ ] Geography Validation Service

### **Week 3: Integration Layer**
- [ ] Event Listeners
- [ ] Anti-Corruption Layer Adapters
- [ ] TenantUser Integration
- [ ] Database Migrations

### **Week 4: API & Testing**
- [ ] REST API Controllers
- [ ] DTOs & Request Validation
- [ ] Comprehensive Test Suite
- [ ] Factories & Seeding

### **Week 5: Optimization**
- [ ] Database Indexing
- [ ] Caching Strategy
- [ ] Materialized Views
- [ ] Performance Monitoring

---

## **🚀 RUNNING THE TESTS**

```bash
# Run all tests
php artisan test

# Run only Membership context tests
php artisan test --testsuite=Membership

# Run specific test file
php artisan test tests/Unit/Contexts/Membership/Domain/Models/MemberTest.php

# Run with coverage
php artisan test --coverage --min=80

# Run in TDD mode (watch for changes)
php artisan test --watch
```

---

## **📊 ARCHITECTURE VALIDATION METRICS**

1. **Test Coverage:** >80% for Domain Layer
2. **Code Quality:** PHPStan Level 8, no errors
3. **Performance:** API response <200ms
4. **Database:** All queries use indexes
5. **Integration:** All cross-context communication via events

---

This is a **production-ready, scalable architecture** for your Political Party Membership System. Each component follows **SOLID principles**, uses **appropriate design patterns**, and is **fully testable**.

**Start with Week 1, write tests first, then implement.** The TDD approach ensures you build a robust foundation that can scale to handle millions of members across multiple political parties.

**Do you want me to provide implementation code for any specific component first?**