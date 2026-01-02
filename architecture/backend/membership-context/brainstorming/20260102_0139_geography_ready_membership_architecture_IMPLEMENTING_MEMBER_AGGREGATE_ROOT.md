# 🚀 **GREEN PHASE: IMPLEMENTING MEMBER AGGREGATE ROOT**

## **📁 IMPLEMENTATION ORDER (DDD PRINCIPLES)**

1. **Domain Events** (First - they define what happens)
2. **Member Aggregate** (Core business logic)
3. **Value Object Enhancements** (If needed)

---

## **1️⃣ DOMAIN EVENTS IMPLEMENTATION**

### **1.1 Base Domain Event**

```php
<?php

// app/Contexts/Membership/Domain/Events/DomainEvent.php

namespace App\Contexts\Membership\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use DateTimeImmutable;

abstract class DomainEvent
{
    use Dispatchable, SerializesModels;
    
    protected DateTimeImmutable $occurredAt;
    protected string $eventType;
    
    public function __construct()
    {
        $this->occurredAt = new DateTimeImmutable();
        $this->eventType = class_basename($this);
    }
    
    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }
    
    public function eventType(): string
    {
        return $this->eventType;
    }
    
    abstract public function toArray(): array;
    
    protected function baseArray(): array
    {
        return [
            'event_type' => $this->eventType,
            'occurred_at' => $this->occurredAt->format('c'),
            'timestamp' => $this->occurredAt->getTimestamp(),
        ];
    }
}
```

### **1.2 MemberCreated Event**

```php
<?php

// app/Contexts/Membership/Domain/Events/MemberCreated.php

namespace App\Contexts\Membership\Domain\Events;

final class MemberCreated extends DomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $membershipNumber,
        public readonly string $fullName,
        public readonly string $geographyTier
    ) {
        parent::__construct();
    }
    
    public function toArray(): array
    {
        return array_merge($this->baseArray(), [
            'member_id' => $this->memberId,
            'membership_number' => $this->membershipNumber,
            'full_name' => $this->fullName,
            'geography_tier' => $this->geographyTier,
        ]);
    }
}
```

### **1.3 MemberApplicationSubmitted Event**

```php
<?php

// app/Contexts/Membership/Domain/Events/MemberApplicationSubmitted.php

namespace App\Contexts\Membership\Domain\Events;

final class MemberApplicationSubmitted extends DomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $geographyTier
    ) {
        parent::__construct();
    }
    
    public function toArray(): array
    {
        return array_merge($this->baseArray(), [
            'member_id' => $this->memberId,
            'geography_tier' => $this->geographyTier,
        ]);
    }
}
```

### **1.4 MemberApproved Event**

```php
<?php

// app/Contexts/Membership/Domain/Events/MemberApproved.php

namespace App\Contexts\Membership\Domain\Events;

final class MemberApproved extends DomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly int $committeeMemberId,
        public readonly string $geographyTier
    ) {
        parent::__construct();
    }
    
    public function toArray(): array
    {
        return array_merge($this->baseArray(), [
            'member_id' => $this->memberId,
            'committee_member_id' => $this->committeeMemberId,
            'geography_tier' => $this->geographyTier,
        ]);
    }
}
```

### **1.5 MemberActivated Event**

```php
<?php

// app/Contexts/Membership/Domain/Events/MemberActivated.php

namespace App\Contexts\Membership\Domain\Events;

final class MemberActivated extends DomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $paymentId,
        public readonly string $geographyTier
    ) {
        parent::__construct();
    }
    
    public function toArray(): array
    {
        return array_merge($this->baseArray(), [
            'member_id' => $this->memberId,
            'payment_id' => $this->paymentId,
            'geography_tier' => $this->geographyTier,
        ]);
    }
}
```

### **1.6 MemberSuspended Event**

```php
<?php

// app/Contexts/Membership/Domain/Events/MemberSuspended.php

namespace App\Contexts\Membership\Domain\Events;

final class MemberSuspended extends DomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $reason,
        public readonly string $geographyTier
    ) {
        parent::__construct();
    }
    
    public function toArray(): array
    {
        return array_merge($this->baseArray(), [
            'member_id' => $this->memberId,
            'reason' => $this->reason,
            'geography_tier' => $this->geographyTier,
        ]);
    }
}
```

### **1.7 MemberGeographyEnriched Event**

```php
<?php

// app/Contexts/Membership/Domain/Events/MemberGeographyEnriched.php

namespace App\Contexts\Membership\Domain\Events;

final class MemberGeographyEnriched extends DomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $fromTier,
        public readonly string $toTier
    ) {
        parent::__construct();
    }
    
    public function toArray(): array
    {
        return array_merge($this->baseArray(), [
            'member_id' => $this->memberId,
            'from_tier' => $this->fromTier,
            'to_tier' => $this->toTier,
        ]);
    }
}
```

**Run events tests:**
```bash
php artisan test tests/Unit/Contexts/Membership/Domain/Events/MemberEventsTest.php
```
✅ **Should pass now**

---

## **2️⃣ MEMBER AGGREGATE ROOT IMPLEMENTATION**

### **2.1 Aggregate Root Trait**

First, let's create an AggregateRoot trait for event recording:

```php
<?php

// app/Contexts/Membership/Domain/Models/Concerns/AggregateRoot.php

namespace App\Contexts\Membership\Domain\Models\Concerns;

trait AggregateRoot
{
    private array $recordedEvents = [];
    
    protected function recordThat(object $event): void
    {
        $this->recordedEvents[] = $event;
    }
    
    public function releaseEvents(): array
    {
        $events = $this->recordedEvents;
        $this->recordedEvents = [];
        return $events;
    }
    
    public function hasRecordedEvents(): bool
    {
        return !empty($this->recordedEvents);
    }
    
    public function clearRecordedEvents(): void
    {
        $this->recordedEvents = [];
    }
}
```

### **2.2 Member Aggregate Root Implementation**

```php
<?php

// app/Contexts/Membership/Domain/Models/Member.php

namespace App\Contexts\Membership\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use App\Contexts\Membership\Domain\Models\Concerns\AggregateRoot;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use App\Contexts\Membership\Domain\Events\MemberCreated;
use App\Contexts\Membership\Domain\Events\MemberApplicationSubmitted;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\Events\MemberSuspended;
use App\Contexts\Membership\Domain\Events\MemberGeographyEnriched;
use App\Contexts\Membership\Domain\Exceptions\InvalidMemberException;
use App\Contexts\Membership\Domain\Exceptions\InvalidStatusTransitionException;
use Illuminate\Support\Str;
use Carbon\Carbon;

class Member extends Model
{
    use AggregateRoot;
    
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
        'personal_info' => PersonalInfo::class,
        'membership_number' => MembershipNumber::class,
        'geography' => SimpleGeography::class,
        'status' => MemberStatus::class,
        'approved_at' => 'datetime',
        'activated_at' => 'datetime',
        'geography_enriched_at' => 'datetime',
    ];
    
    protected $attributes = [
        'status' => 'draft',
    ];
    
    public static function create(
        PersonalInfo $personalInfo,
        MembershipNumber $membershipNumber,
        SimpleGeography $geography
    ): self {
        // Validate inputs
        if (!$personalInfo) {
            throw InvalidMemberException::missingPersonalInfo();
        }
        
        if (!$membershipNumber) {
            throw InvalidMemberException::missingMembershipNumber();
        }
        
        if (!$geography) {
            throw InvalidMemberException::missingGeography();
        }
        
        $member = new self([
            'id' => (string) Str::uuid(),
            'personal_info' => $personalInfo,
            'membership_number' => $membershipNumber,
            'geography' => $geography,
            'status' => MemberStatus::draft(),
        ]);
        
        // Record domain event
        $member->recordThat(new MemberCreated(
            memberId: $member->id,
            membershipNumber: (string) $membershipNumber,
            fullName: $personalInfo->fullName(),
            geographyTier: $geography->tier()
        ));
        
        return $member;
    }
    
    public function id(): string
    {
        return $this->id;
    }
    
    public function personalInfo(): PersonalInfo
    {
        return $this->personal_info;
    }
    
    public function membershipNumber(): MembershipNumber
    {
        return $this->membership_number;
    }
    
    public function geography(): SimpleGeography
    {
        return $this->geography;
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
    
    public function approvedAt(): ?Carbon
    {
        return $this->approved_at;
    }
    
    public function paymentId(): ?string
    {
        return $this->payment_id;
    }
    
    public function activatedAt(): ?Carbon
    {
        return $this->activated_at;
    }
    
    public function suspensionReason(): ?string
    {
        return $this->suspension_reason;
    }
    
    public function terminationReason(): ?string
    {
        return $this->termination_reason;
    }
    
    public function geographyEnrichedAt(): ?Carbon
    {
        return $this->geography_enriched_at;
    }
    
    public function submitApplication(): void
    {
        $this->validateForSubmission();
        
        $this->status = $this->status->transitionTo('pending');
        
        $this->recordThat(new MemberApplicationSubmitted(
            memberId: $this->id,
            geographyTier: $this->geography->tier()
        ));
    }
    
    public function approve(int $committeeMemberId): void
    {
        $this->validateForApproval();
        
        $this->status = $this->status->transitionTo('approved');
        $this->approved_by = $committeeMemberId;
        $this->approved_at = Carbon::now();
        
        $this->recordThat(new MemberApproved(
            memberId: $this->id,
            committeeMemberId: $committeeMemberId,
            geographyTier: $this->geography->tier()
        ));
    }
    
    public function activate(string $paymentId): void
    {
        $this->validateForActivation();
        
        $this->status = $this->status->transitionTo('active');
        $this->payment_id = $paymentId;
        $this->activated_at = Carbon::now();
        
        $this->recordThat(new MemberActivated(
            memberId: $this->id,
            paymentId: $paymentId,
            geographyTier: $this->geography->tier()
        ));
    }
    
    public function suspend(string $reason): void
    {
        if (!$this->status->canTransitionTo('suspended')) {
            throw InvalidStatusTransitionException::create(
                $this->status->value(),
                'suspended',
                $this->status->allowedTransitions()
            );
        }
        
        $this->status = $this->status->transitionTo('suspended');
        $this->suspension_reason = $reason;
        
        $this->recordThat(new MemberSuspended(
            memberId: $this->id,
            reason: $reason,
            geographyTier: $this->geography->tier()
        ));
    }
    
    public function reactivate(): void
    {
        if (!$this->status->canTransitionTo('active')) {
            throw InvalidStatusTransitionException::create(
                $this->status->value(),
                'active',
                $this->status->allowedTransitions()
            );
        }
        
        $this->status = $this->status->transitionTo('active');
        $this->suspension_reason = null;
    }
    
    public function terminate(string $reason): void
    {
        if (!$this->status->canTransitionTo('terminated')) {
            throw InvalidStatusTransitionException::create(
                $this->status->value(),
                'terminated',
                $this->status->allowedTransitions()
            );
        }
        
        $this->status = $this->status->transitionTo('terminated');
        $this->termination_reason = $reason;
    }
    
    public function enrichGeography(SimpleGeography $newGeography): void
    {
        if (!$this->canEnrichGeography()) {
            throw InvalidMemberException::geographyAlreadyAdvanced();
        }
        
        $fromTier = $this->geography->tier();
        $this->geography = $this->geography->merge($newGeography);
        $toTier = $this->geography->tier();
        $this->geography_enriched_at = Carbon::now();
        
        if ($fromTier !== $toTier) {
            $this->recordThat(new MemberGeographyEnriched(
                memberId: $this->id,
                fromTier: $fromTier,
                toTier: $toTier
            ));
        }
    }
    
    public function addSponsorship(int $sponsorId): void
    {
        // Only set sponsor if not already set (first sponsor wins)
        if (!$this->sponsor_id) {
            $this->sponsor_id = $sponsorId;
        }
    }
    
    public function validateForSubmission(): void
    {
        if (!$this->personal_info) {
            throw InvalidMemberException::missingPersonalInfo();
        }
        
        if (!$this->membership_number) {
            throw InvalidMemberException::missingMembershipNumber();
        }
        
        if (!$this->geography) {
            throw InvalidMemberException::missingGeography();
        }
        
        if (!$this->status->isDraft()) {
            throw InvalidMemberException::invalidStatusForSubmission($this->status->value());
        }
    }
    
    public function validateForApproval(): void
    {
        if (!$this->status->isPending()) {
            throw InvalidMemberException::invalidStatusForApproval($this->status->value());
        }
    }
    
    public function validateForActivation(): void
    {
        if (!$this->status->isApproved()) {
            throw InvalidMemberException::invalidStatusForActivation($this->status->value());
        }
    }
    
    public function canEnrichGeography(): bool
    {
        return $this->geography->tier() !== 'advanced';
    }
    
    public function canSponsorOthers(): bool
    {
        return $this->status->isActive();
    }
    
    public function canVote(): bool
    {
        return $this->status->canVote();
    }
    
    public function canAccessForum(): bool
    {
        return $this->status->canAccessForum();
    }
    
    public function canHoldOffice(): bool
    {
        return $this->status->canHoldOffice();
    }
    
    public function summary(): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->personal_info->fullName(),
            'email' => $this->personal_info->email(),
            'phone' => $this->personal_info->phone(),
            'membership_number' => (string) $this->membership_number,
            'geography_display' => (string) $this->geography,
            'geography_tier' => $this->geography->tier(),
            'status' => $this->status->value(),
            'status_display' => $this->status->displayName(),
            'can_vote' => $this->canVote(),
            'can_access_forum' => $this->canAccessForum(),
            'can_hold_office' => $this->canHoldOffice(),
        ];
    }
    
    public function toArray(): array
    {
        return array_merge(parent::toArray(), [
            'id' => $this->id,
            'personal_info' => $this->personal_info->toArray(),
            'membership_number' => (string) $this->membership_number,
            'geography' => $this->geography->toArray(),
            'status' => $this->status->toArray(),
            'sponsor_id' => $this->sponsor_id,
            'approved_by' => $this->approved_by,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'payment_id' => $this->payment_id,
            'activated_at' => $this->activated_at?->toIso8601String(),
            'suspension_reason' => $this->suspension_reason,
            'termination_reason' => $this->termination_reason,
            'geography_enriched_at' => $this->geography_enriched_at?->toIso8601String(),
        ]);
    }
}
```

---

## **3️⃣ VALUE OBJECT CAST IMPROVEMENTS**

### **3.1 Create Custom Casts for Value Objects**

We need custom cast classes for Eloquent to handle our Value Objects:

```php
<?php

// app/Contexts/Membership/Domain/Casts/PersonalInfoCast.php

namespace App\Contexts\Membership\Domain\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;

class PersonalInfoCast implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes)
    {
        if (!$value) {
            return null;
        }
        
        $data = json_decode($value, true);
        
        return new PersonalInfo(
            $data['full_name'] ?? '',
            $data['email'] ?? '',
            $data['phone'] ?? ''
        );
    }
    
    public function set($model, string $key, $value, array $attributes)
    {
        if ($value instanceof PersonalInfo) {
            return json_encode($value->toArray());
        }
        
        if (is_array($value)) {
            return json_encode($value);
        }
        
        return $value;
    }
}
```

```php
<?php

// app/Contexts/Membership/Domain/Casts/SimpleGeographyCast.php

namespace App\Contexts\Membership\Domain\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;

class SimpleGeographyCast implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes)
    {
        if (!$value) {
            return SimpleGeography::empty();
        }
        
        $data = json_decode($value, true);
        
        return new SimpleGeography(
            province: $data['province'] ?? null,
            district: $data['district'] ?? null,
            ward: $data['ward'] ?? null,
            provinceId: $data['province_id'] ?? null,
            districtId: $data['district_id'] ?? null,
            wardId: $data['ward_id'] ?? null
        );
    }
    
    public function set($model, string $key, $value, array $attributes)
    {
        if ($value instanceof SimpleGeography) {
            return json_encode($value->toArray());
        }
        
        if (is_array($value)) {
            return json_encode($value);
        }
        
        return json_encode(SimpleGeography::empty()->toArray());
    }
}
```

```php
<?php

// app/Contexts/Membership/Domain/Casts/MembershipNumberCast.php

namespace App\Contexts\Membership\Domain\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;

class MembershipNumberCast implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes)
    {
        if (!$value) {
            return null;
        }
        
        return MembershipNumber::fromString($value);
    }
    
    public function set($model, string $key, $value, array $attributes)
    {
        if ($value instanceof MembershipNumber) {
            return (string) $value;
        }
        
        return $value;
    }
}
```

```php
<?php

// app/Contexts/Membership/Domain/Casts/MemberStatusCast.php

namespace App\Contexts\Membership\Domain\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;

class MemberStatusCast implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes)
    {
        return MemberStatus::fromString($value);
    }
    
    public function set($model, string $key, $value, array $attributes)
    {
        if ($value instanceof MemberStatus) {
            return $value->value();
        }
        
        return $value;
    }
}
```

### **3.2 Update Member Model to Use Custom Casts**

Update the Member model's `$casts` property:

```php
// In app/Contexts/Membership/Domain/Models/Member.php
protected $casts = [
    'personal_info' => \App\Contexts\Membership\Domain\Casts\PersonalInfoCast::class,
    'membership_number' => \App\Contexts\Membership\Domain\Casts\MembershipNumberCast::class,
    'geography' => \App\Contexts\Membership\Domain\Casts\SimpleGeographyCast::class,
    'status' => \App\Contexts\Membership\Domain\Casts\MemberStatusCast::class,
    'approved_at' => 'datetime',
    'activated_at' => 'datetime',
    'geography_enriched_at' => 'datetime',
];
```

---

## **4️⃣ ENHANCE VALUE OBJECTS FOR SERIALIZATION**

We need to add a `fromArray` method to our Value Objects for proper casting:

### **4.1 Update PersonalInfo VO**

```php
// Add this method to PersonalInfo class:
public static function fromArray(array $data): self
{
    return new self(
        $data['full_name'] ?? '',
        $data['email'] ?? '',
        $data['phone'] ?? ''
    );
}

// Update the cast getter to use fromArray:
public function get($model, string $key, $value, array $attributes)
{
    if (!$value) {
        return null;
    }
    
    $data = json_decode($value, true);
    return PersonalInfo::fromArray($data);
}
```

### **4.2 Update SimpleGeography VO**

```php
// Add this method to SimpleGeography class:
public static function fromArray(array $data): self
{
    return new self(
        province: $data['province'] ?? null,
        district: $data['district'] ?? null,
        ward: $data['ward'] ?? null,
        provinceId: $data['province_id'] ?? null,
        districtId: $data['district_id'] ?? null,
        wardId: $data['ward_id'] ?? null
    );
}
```

---

## **5️⃣ RUN ALL TESTS (GREEN PHASE)**

```bash
# Run all Member tests
php artisan test tests/Unit/Contexts/Membership/Domain/Models/

# Run all Value Object tests
php artisan test tests/Unit/Contexts/Membership/Domain/ValueObjects/

# Run all Event tests
php artisan test tests/Unit/Contexts/Membership/Domain/Events/
```

**Expected output:** ✅ **All tests should pass now**

---

## **6️⃣ ADDITIONAL INTEGRATION TESTS**

Let's create one more comprehensive test to ensure everything works together:

```php
<?php

// tests/Unit/Contexts/Membership/Domain/Models/MemberIntegrationTest.php

namespace Tests\Unit\Contexts\Membership\Domain\Models;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;

class MemberIntegrationTest extends TestCase
{
    /** @test */
    public function complete_member_lifecycle_with_geography_enrichment(): void
    {
        // 1. Create member with basic geography
        $member = Member::create(
            personalInfo: new PersonalInfo('Ram Bahadur', 'ram@example.com', '+9779841234567'),
            membershipNumber: new MembershipNumber('UML', '2024', 'F', 100),
            geography: new SimpleGeography(
                province: 'Province 3',
                district: 'Kathmandu',
                ward: 'Ward 5'
            )
        );
        
        $this->assertEquals('basic', $member->geography()->tier());
        $this->assertTrue($member->status()->isDraft());
        
        // 2. Submit application
        $member->submitApplication();
        $this->assertTrue($member->status()->isPending());
        
        // 3. Approve
        $member->approve(committeeMemberId: 123);
        $this->assertTrue($member->status()->isApproved());
        $this->assertEquals(123, $member->approvedBy());
        $this->assertNotNull($member->approvedAt());
        
        // 4. Enrich geography before activation
        $enrichedGeo = SimpleGeography::empty()
            ->withText('Province 3', 'Kathmandu', 'Ward 5')
            ->withIds(3, 25, 125);
        
        $member->enrichGeography($enrichedGeo);
        $this->assertEquals('advanced', $member->geography()->tier());
        $this->assertEquals(3, $member->geography()->provinceId());
        $this->assertNotNull($member->geographyEnrichedAt());
        
        // 5. Activate with payment
        $member->activate(paymentId: 'pay_12345');
        $this->assertTrue($member->status()->isActive());
        $this->assertEquals('pay_12345', $member->paymentId());
        $this->assertNotNull($member->activatedAt());
        
        // 6. Add sponsorship
        $member->addSponsorship(456);
        $this->assertEquals(456, $member->sponsorId());
        
        // 7. Verify privileges
        $this->assertTrue($member->canVote());
        $this->assertTrue($member->canAccessForum());
        $this->assertTrue($member->canHoldOffice());
        $this->assertTrue($member->canSponsorOthers());
        
        // 8. Check summary
        $summary = $member->summary();
        $this->assertEquals('Ram Bahadur', $summary['full_name']);
        $this->assertEquals('UML-2024-F-000100', $summary['membership_number']);
        $this->assertEquals('Province 3 → Kathmandu → Ward 5', $summary['geography_display']);
        $this->assertEquals('Active', $summary['status_display']);
        
        // 9. Verify all events recorded
        $events = $member->releaseEvents();
        $this->assertCount(6, $events); // Created, Submitted, Approved, GeographyEnriched, Activated
        
        $eventTypes = array_map(fn($e) => $e->eventType(), $events);
        $this->assertEquals([
            'MemberCreated',
            'MemberApplicationSubmitted',
            'MemberApproved',
            'MemberGeographyEnriched',
            'MemberActivated',
        ], array_slice($eventTypes, 0, 5));
    }
    
    /** @test */
    public function member_can_be_serialized_and_deserialized(): void
    {
        $member = Member::create(
            personalInfo: new PersonalInfo('John Doe', 'john@example.com', '+9779841234567'),
            membershipNumber: new MembershipNumber('UML', '2024', 'F', 200),
            geography: SimpleGeography::empty()
        );
        
        $member->submitApplication();
        $member->approve(123);
        
        // Serialize to array
        $data = $member->toArray();
        
        // Create new member from array data
        $newMember = new Member($data);
        
        // Verify data preserved
        $this->assertEquals($member->id(), $newMember->id());
        $this->assertEquals($member->personalInfo()->fullName(), $newMember->personalInfo()->fullName());
        $this->assertEquals((string) $member->membershipNumber(), (string) $newMember->membershipNumber());
        $this->assertEquals($member->status()->value(), $newMember->status()->value());
        $this->assertEquals($member->approvedBy(), $newMember->approvedBy());
    }
}
```

**Run integration test:**
```bash
php artisan test tests/Unit/Contexts/Membership/Domain/Models/MemberIntegrationTest.php
```
✅ **Should pass**

---

## **7️⃣ FIX ANY REMAINING TEST ISSUES**

If any tests are still failing, check for:

1. **Namespace issues** - Make sure all classes are in correct namespaces
2. **Method signatures** - Ensure all method signatures match tests
3. **Exception messages** - Test exceptions should match exactly

### **Common fixes:**

```bash
# Check for syntax errors
php -l app/Contexts/Membership/Domain/Models/Member.php

# Clear Laravel cache
php artisan cache:clear
php artisan config:clear

# Dump autoload
composer dump-autoload
```

---

## **✅ FINAL TEST RUN**

```bash
# Run complete test suite for Membership context
php artisan test --testsuite=Membership

# Or run all tests
php artisan test tests/Unit/Contexts/Membership/
```

**Expected:** All tests pass ✅

---

## **📝 COMMIT GREEN PHASE**

```bash
git add .
git commit -m "GREEN: Implemented Member Aggregate Root

- Domain Events: MemberCreated, MemberApproved, MemberActivated, etc.
- Member Aggregate with complete lifecycle management
- Custom Eloquent casts for Value Objects
- TDD approach: All tests passing
- Key features:
  * Geography-ready architecture (none → basic → advanced tiers)
  * State Pattern for status transitions
  * Event-driven architecture
  * Sponsor tracking
  * Progressive geography enrichment
  * Full business rule validation"
```

---

## **🎯 NEXT STEPS**

Now that we have a solid Member Aggregate Root, we can proceed to:

### **Phase 3: Repository Pattern**
1. **MemberRepositoryInterface** - Define contract
2. **EloquentMemberRepository** - Implementation
3. **Repository tests** - Data persistence tests

### **Or Phase 4: Application Services**
1. **RegisterMemberCommand/Handler** - Use case implementation
2. **MemberApprovalService** - Business workflow
3. **GeographyEnrichmentService** - Geography upgrade logic

**Which would you prefer to implement next?** The Repository pattern will give us data persistence, while Application Services will give us the use cases.