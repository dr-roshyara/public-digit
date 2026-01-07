# Membership Context - Developer Guide

**Date:** 2026-01-02
**Version:** 1.0
**Status:** Day 1 Implementation Complete

---

## 1. Architecture Overview

The Membership Context is a **DDD Bounded Context** responsible for managing political party/NGO members. It follows these core principles:

### Core Architectural Principles

1. **Digital Identity First**: Every member MUST have a `tenant_user_id` (1:1 relationship with TenantUser)
2. **Geography as String Reference**: No direct foreign keys to geography tables - only string references
3. **Event-Driven Integration**: Contexts communicate via domain events, never direct calls
4. **Value Objects for Business Concepts**: Type-safe, immutable, self-validating

### Architecture Commandment

> "Membership knows members, not geography. Geography knows places, not members. They meet at events."

---

## 2. Directory Structure

```
packages/laravel-backend/app/Contexts/Membership/
├── Domain/                           # Pure business logic
│   ├── Models/
│   │   ├── Member.php               # Aggregate Root
│   │   └── Member.legacy.php        # Archived old implementation
│   ├── ValueObjects/
│   │   ├── Email.php                # Email value object
│   │   ├── PersonalInfo.php         # Personal information aggregate
│   │   ├── MemberStatus.php         # Lifecycle status
│   │   └── MemberId.php             # Party-defined identifier
│   ├── Events/
│   │   └── MemberRegistered.php     # Domain event
│   └── Traits/
│       └── RecordsEvents.php        # Event recording trait
├── Infrastructure/                   # Technical implementation
│   └── Casts/
│       ├── PersonalInfoCast.php     # JSON ↔ PersonalInfo
│       ├── MemberStatusCast.php     # String ↔ MemberStatus
│       └── MemberIdCast.php         # String ↔ MemberId
└── Application/                      # Use cases (future)
    ├── Services/
    ├── DTOs/
    └── Commands/
```

---

## 3. Value Objects Deep Dive

### 3.1 Email Value Object

**Location:** `app/Contexts/Membership/Domain/ValueObjects/Email.php`

**Responsibilities:**
- Self-validating email format
- Immutable
- Auto-lowercase normalization
- Max 255 characters

**Usage:**
```php
use App\Contexts\Membership\Domain\ValueObjects\Email;

// Valid email
$email = new Email('john@example.com');
echo $email->value(); // "john@example.com"
echo $email; // "john@example.com" (uses __toString)

// Auto-lowercase
$email = new Email('JOHN@EXAMPLE.COM');
echo $email->value(); // "john@example.com"

// Invalid email - throws exception
try {
    $email = new Email('invalid-email');
} catch (InvalidArgumentException $e) {
    echo $e->getMessage(); // "Invalid email format: invalid-email"
}

// Equality check
$email1 = new Email('john@example.com');
$email2 = new Email('JOHN@EXAMPLE.COM');
$email1->equals($email2); // true (normalized)
```

**Validation Rules:**
- Cannot be empty
- Must pass PHP `FILTER_VALIDATE_EMAIL`
- Maximum 255 characters

---

### 3.2 PersonalInfo Value Object

**Location:** `app/Contexts/Membership/Domain/ValueObjects/PersonalInfo.php`

**Responsibilities:**
- Aggregates full name, email, and phone
- Self-validating
- Immutable
- Returns array for JSON storage

**Usage:**
```php
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;

// Create personal info
$info = new PersonalInfo(
    fullName: 'John Doe',
    email: new Email('john@example.com'),
    phone: '+1-234-567-8900' // optional
);

// Access properties
echo $info->fullName(); // "John Doe"
echo $info->email()->value(); // "john@example.com"
echo $info->phone(); // "+1-234-567-8900"

// Convert to array (for database storage)
$data = $info->toArray();
// [
//     'full_name' => 'John Doe',
//     'email' => 'john@example.com',
//     'phone' => '+1-234-567-8900'
// ]

// Equality check
$info1 = new PersonalInfo('John', new Email('john@example.com'));
$info2 = new PersonalInfo('John', new Email('john@example.com'));
$info1->equals($info2); // true
```

**Validation Rules:**
- **Full Name**:
  - Cannot be empty
  - Minimum 2 characters
  - Maximum 255 characters
- **Email**:
  - Validated by Email value object
- **Phone** (optional):
  - Maximum 20 characters
  - Allows digits, spaces, hyphens, plus, parentheses

---

### 3.3 MemberStatus Value Object

**Location:** `app/Contexts/Membership/Domain/ValueObjects/MemberStatus.php`

**Responsibilities:**
- Represents member lifecycle status
- Enforces state transition rules
- Business rule methods (voting, committee eligibility)
- Immutable

**Lifecycle States:**
```
draft → pending → approved → active
                              ↓
                          suspended
                              ↓
                          inactive
                              ↓
                          archived (terminal)
```

**Usage:**
```php
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;

// Factory methods
$status = MemberStatus::draft();
$status = MemberStatus::pending();
$status = MemberStatus::approved();
$status = MemberStatus::active();
$status = MemberStatus::suspended();
$status = MemberStatus::inactive();
$status = MemberStatus::archived();

// From string
$status = MemberStatus::fromString('active');

// Status checks
$status->isDraft(); // true/false
$status->isActive(); // true/false
$status->canVote(); // true only if active
$status->canHoldCommitteeRole(); // true if approved or active

// State transitions
$status = MemberStatus::pending();
$status->canTransitionTo(MemberStatus::approved()); // true
$status->canTransitionTo(MemberStatus::active()); // false (must go through approved first)

// Validated transitions (throws exception if invalid)
$status = MemberStatus::pending();
$newStatus = $status->approve(); // Returns MemberStatus::approved()

$status = MemberStatus::draft();
try {
    $status->approve(); // Throws exception (can't approve draft)
} catch (InvalidArgumentException $e) {
    echo $e->getMessage();
}
```

**State Transition Matrix:**
| From State | To States                                    |
|------------|----------------------------------------------|
| draft      | pending, archived                            |
| pending    | approved, archived                           |
| approved   | active, archived                             |
| active     | suspended, inactive, archived                |
| suspended  | active, inactive, archived                   |
| inactive   | active, archived                             |
| archived   | (terminal state - no transitions)            |

**Business Rule Methods:**
```php
$status = MemberStatus::active();

// Can this member vote?
$status->canVote(); // true (only active members)

// Can this member hold committee role?
$status->canHoldCommitteeRole(); // true (approved or active)

// Can receive digital card?
$status->canReceiveDigitalCard(); // true (only active)

// Can participate in forums?
$status->canParticipateInForums(); // true (approved or active)
```

---

### 3.4 MemberId Value Object

**Location:** `app/Contexts/Membership/Domain/ValueObjects/MemberId.php`

**Responsibilities:**
- Party-defined member identifier
- Self-validating
- Auto-uppercase
- Immutable

**Usage:**
```php
use App\Contexts\Membership\Domain\ValueObjects\MemberId;

// Create member ID
$memberId = new MemberId('UML-2024-0001');
$memberId = new MemberId('nc-p3-00123'); // Auto-uppercase: "NC-P3-00123"

// Access value
echo $memberId->value(); // "UML-2024-0001"
echo $memberId; // "UML-2024-0001" (uses __toString)

// Pattern matching (for party-specific validation)
$memberId->matchesPattern('/^UML-\d{4}-\d{4}$/'); // true

// Invalid ID - throws exception
try {
    $memberId = new MemberId('AB'); // Too short
} catch (InvalidArgumentException $e) {
    echo $e->getMessage();
}
```

**Validation Rules:**
- Cannot be empty
- Minimum 3 characters
- Maximum 50 characters
- Alphanumeric + hyphens + underscores only
- Auto-converted to uppercase

---

## 4. Member Aggregate Root

**Location:** `app/Contexts/Membership/Domain/Models/Member.php`

### 4.1 Key Principles

1. **Digital Identity First**: Every member MUST have `tenant_user_id`
2. **Tenant Association**: Every member belongs to a `tenant_id`
3. **Geography Decoupling**: Only string reference `residence_geo_reference`, no FKs
4. **Event Recording**: Records `MemberRegistered` domain event on creation

### 4.2 Database Configuration

```php
protected $table = 'members';
protected $connection = 'tenant'; // Tenant database
protected $keyType = 'string'; // ULID
public $incrementing = false;
```

### 4.3 Properties

| Property                   | Type           | Required | Description                                      |
|----------------------------|----------------|----------|--------------------------------------------------|
| `id`                       | string (ULID)  | Yes      | System-generated unique identifier               |
| `member_id`                | MemberId       | No       | Party-defined identifier (e.g., "UML-2024-0001") |
| `tenant_user_id`           | string         | **Yes**  | Digital identity (1:1 with TenantUser)           |
| `tenant_id`                | string         | **Yes**  | Party/organization identifier                    |
| `personal_info`            | PersonalInfo   | Yes      | Name, email, phone                               |
| `status`                   | MemberStatus   | Yes      | Lifecycle status                                 |
| `residence_geo_reference`  | string         | No       | Geography reference (e.g., "np.3.15.234")        |
| `membership_type`          | string         | Yes      | Type (regular, honorary, etc.)                   |
| `metadata`                 | array (JSON)   | No       | Extensibility point                              |

### 4.4 Factory Method Pattern

**DO NOT** use `new Member()` directly. Use the factory method:

```php
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Domain\ValueObjects\MemberId;

$member = Member::register(
    tenantUserId: 'user_01JKABCD1234567890ABCDEFGH',
    tenantId: 'uml',
    personalInfo: new PersonalInfo(
        fullName: 'Ram Kumar Shrestha',
        email: new Email('ram.shrestha@example.com'),
        phone: '+977-9841234567'
    ),
    memberId: new MemberId('UML-2024-0001'), // optional
    geoReference: 'np.3.15.234.1.2' // optional
);

// IMPORTANT: Must save to dispatch events
$member->save();
```

### 4.5 Business Rules Enforced

```php
// ❌ Empty tenant_user_id
Member::register(tenantUserId: '', ...);
// Throws: "tenant_user_id cannot be empty. Digital identity is mandatory."

// ❌ Empty tenant_id
Member::register(tenant_id: '', ...);
// Throws: "tenant_id cannot be empty."

// ❌ Duplicate member_id per tenant
Member::register(memberId: 'UML-2024-0001', ...); // Already exists
// Throws: "Member ID 'UML-2024-0001' already exists for tenant 'uml'"
```

### 4.6 State Transition Methods

```php
$member = Member::find('01JKABCD1234567890ABCDEFGH');

// Approve member (pending → approved)
$member->approve();
$member->save();

// Activate member (approved → active)
$member->activate();
$member->save();

// Suspend member (active → suspended)
$member->suspend();
$member->save();

// Check permissions
if ($member->canVote()) {
    // Allow voting
}

if ($member->canHoldCommitteeRole()) {
    // Allow committee assignment
}
```

---

## 5. Custom Casts

### 5.1 Why Custom Casts?

Custom casts enable **seamless conversion** between:
- Database format (JSON string, VARCHAR)
- Application format (Value Objects)

**Benefits:**
- Type safety throughout application
- DDD principles in Laravel ORM
- Automatic validation on hydration
- Clean code (no manual JSON encoding/decoding)

### 5.2 PersonalInfoCast

**Location:** `app/Contexts/Membership/Infrastructure/Casts/PersonalInfoCast.php`

**Flow:**
```
Database (JSON):          Application:
{"full_name": "John",     PersonalInfo {
 "email": "john@..."}  →    fullName: "John",
                           email: Email("john@...")
                         }
```

**Error Handling:**
- Invalid JSON → Logs error, returns `null`
- Missing required fields → Logs warning, returns `null`
- Invalid Email → Logs error, returns `null`

### 5.3 MemberStatusCast

**Location:** `app/Contexts/Membership/Infrastructure/Casts/MemberStatusCast.php`

**Flow:**
```
Database (string):    Application:
"active"           →  MemberStatus::active()
```

**Error Handling:**
- Invalid status string → Logs error, returns `null`

### 5.4 MemberIdCast

**Location:** `app/Contexts/Membership/Infrastructure/Casts/MemberIdCast.php`

**Flow:**
```
Database (string):     Application:
"UML-2024-0001"     →  MemberId("UML-2024-0001")
```

---

## 6. Domain Events

### 6.1 MemberRegistered Event

**Location:** `app/Contexts/Membership/Domain/Events/MemberRegistered.php`

**When Fired:** After `Member::register()` is called and `save()` is executed

**Payload:**
```php
class MemberRegistered
{
    public readonly string $memberId;        // System ULID
    public readonly string $tenantUserId;
    public readonly string $tenantId;
    public readonly MemberStatus $status;
    public readonly array $personalInfo;
}
```

**Usage:**
```php
// In Member::register()
$this->recordThat(new MemberRegistered(
    memberId: $this->id,
    tenantUserId: $this->tenant_user_id,
    tenantId: $this->tenant_id,
    status: $this->status,
    personalInfo: $personalInfo->toArray()
));
```

### 6.2 Event Recording Pattern

**How it works:**

1. **Recording**: `Member::register()` calls `recordThat($event)`
2. **Storage**: Event stored in `$recordedEvents` array
3. **Dispatch**: On `$member->save()`, `booted()` hook calls `dispatchRecordedEvents()`
4. **Listeners**: Laravel event system notifies all listeners

**Trait:** `RecordsEvents`

```php
trait RecordsEvents
{
    protected array $recordedEvents = [];

    protected function recordThat(object $event): void
    {
        $this->recordedEvents[] = $event;
    }

    public function dispatchRecordedEvents(): void
    {
        foreach ($this->recordedEvents as $event) {
            event($event); // Laravel event dispatcher
        }
        $this->recordedEvents = [];
    }
}
```

**Auto-dispatch on save:**
```php
// In Member.php
protected static function booted(): void
{
    static::saved(function ($model) {
        if (method_exists($model, 'dispatchRecordedEvents')) {
            $model->dispatchRecordedEvents();
        }
    });
}
```

### 6.3 Future Listeners

**Committee Context:**
```php
// Auto-assign new member to "General Members" committee
Event::listen(MemberRegistered::class, AssignToDefaultCommittee::class);
```

**Geography Context:**
```php
// Enrich member with full geography data
Event::listen(MemberRegistered::class, EnrichMemberGeography::class);
```

**DigitalCard Context:**
```php
// Generate digital membership card
Event::listen(MemberRegistered::class, GenerateDigitalCard::class);
```

---

## 7. How to Debug

### 7.1 Debug Value Object Validation

```php
// Test Email validation
use App\Contexts\Membership\Domain\ValueObjects\Email;

try {
    $email = new Email('invalid-email');
} catch (InvalidArgumentException $e) {
    dd($e->getMessage());
    // Output: "Invalid email format: invalid-email"
}

// Test MemberStatus transitions
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;

$status = MemberStatus::draft();
dd($status->canTransitionTo(MemberStatus::active()));
// Output: false (must go through pending → approved first)

$status = MemberStatus::pending();
dd($status->canTransitionTo(MemberStatus::approved()));
// Output: true
```

### 7.2 Debug Member Creation

```php
use Illuminate\Support\Facades\DB;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;

// Enable query logging
DB::enableQueryLog();

// Create member
$member = Member::register(
    tenantUserId: 'user_123',
    tenantId: 'uml',
    personalInfo: new PersonalInfo('John Doe', new Email('john@example.com'))
);

// Check recorded events BEFORE save
dd($member->getRecordedEvents());
// Output: [MemberRegistered { memberId: '...', tenantUserId: '...', ... }]

// Save (this dispatches events)
$member->save();

// Check SQL queries
dd(DB::getQueryLog());
// Output: [
//     ["query" => "INSERT INTO members ...", "bindings" => [...], "time" => 12.45]
// ]
```

### 7.3 Debug Custom Casts

```php
use App\Contexts\Membership\Domain\Models\Member;

$member = Member::find('01JKABCD1234567890ABCDEFGH');

// Get value object
$personalInfo = $member->personal_info; // PersonalInfo instance
dd($personalInfo->fullName()); // "John Doe"
dd($personalInfo->email()->value()); // "john@example.com"

// Check raw database value
dd($member->getAttributes()['personal_info']);
// Output: '{"full_name":"John Doe","email":"john@example.com","phone":null}'

// Check status cast
$status = $member->status; // MemberStatus instance
dd($status->value()); // "draft"
dd($status->canVote()); // false

dd($member->getAttributes()['status']);
// Output: "draft"
```

### 7.4 Debug Domain Events

```php
use Illuminate\Support\Facades\Event;
use App\Contexts\Membership\Domain\Events\MemberRegistered;

// Listen to events in tinker or controller
Event::listen(MemberRegistered::class, function ($event) {
    dump('🔥 MemberRegistered fired!');
    dump($event->toArray());
});

// Create member
$member = Member::register(...);
$member->save(); // Event fires here

// Output:
// 🔥 MemberRegistered fired!
// [
//     "member_id" => "01JKABCD...",
//     "tenant_user_id" => "user_123",
//     "tenant_id" => "uml",
//     "status" => "draft",
//     "personal_info" => [...]
// ]
```

### 7.5 Common Debugging Tools

**Laravel Tinker:**
```bash
php artisan tinker

>>> use App\Contexts\Membership\Domain\Models\Member;
>>> $member = Member::first()
>>> $member->status->value()
=> "draft"
>>> $member->status->canVote()
=> false
>>> $member->personal_info->fullName()
=> "John Doe"
```

**Ray Debug Tool** (if installed):
```php
ray($member->personal_info);
ray($member->getRecordedEvents());
ray($member->status->value());
```

**Laravel Log:**
```php
\Log::debug('Member created', [
    'id' => $member->id,
    'status' => $member->status->value(),
    'events' => count($member->getRecordedEvents())
]);

// Check: storage/logs/laravel.log
```

---

## 8. How to Edit

### 8.1 Adding New Member Status

**File:** `app/Contexts/Membership/Domain/ValueObjects/MemberStatus.php`

**Steps:**

1. Add new status constant:
```php
private const SUSPENDED_PAYMENT = 'suspended_payment';
```

2. Add to valid statuses:
```php
private const VALID_STATUSES = [
    self::DRAFT,
    self::PENDING,
    self::APPROVED,
    self::ACTIVE,
    self::SUSPENDED,
    self::SUSPENDED_PAYMENT, // NEW
    self::INACTIVE,
    self::ARCHIVED,
];
```

3. Add factory method:
```php
public static function suspendedPayment(): self
{
    return new self(self::SUSPENDED_PAYMENT);
}
```

4. Add check method:
```php
public function isSuspendedPayment(): bool
{
    return $this->value === self::SUSPENDED_PAYMENT;
}
```

5. Update transition rules:
```php
public function canTransitionTo(MemberStatus $newStatus): bool
{
    $transitions = [
        // ... existing
        self::ACTIVE => [
            self::SUSPENDED,
            self::SUSPENDED_PAYMENT, // NEW
            self::INACTIVE,
            self::ARCHIVED
        ],
        self::SUSPENDED_PAYMENT => [self::ACTIVE, self::ARCHIVED], // NEW
    ];
    // ...
}
```

6. Add transition method (optional):
```php
public function suspendForPayment(): self
{
    if (!$this->isActive()) {
        throw new InvalidArgumentException(
            "Cannot suspend for payment a member with status: {$this->value}"
        );
    }
    return self::suspendedPayment();
}
```

**Write Test:**
```php
// tests/Unit/Contexts/Membership/Domain/ValueObjects/MemberStatusTest.php

/** @test */
public function it_can_suspend_active_member_for_payment()
{
    $status = MemberStatus::active();
    $newStatus = $status->suspendForPayment();

    $this->assertTrue($newStatus->isSuspendedPayment());
}

/** @test */
public function it_cannot_suspend_inactive_member_for_payment()
{
    $this->expectException(InvalidArgumentException::class);

    $status = MemberStatus::inactive();
    $status->suspendForPayment();
}
```

---

### 8.2 Adding New Field to PersonalInfo

**Example:** Add `dateOfBirth` field

**File:** `app/Contexts/Membership/Domain/ValueObjects/PersonalInfo.php`

**Steps:**

1. Add property:
```php
private ?string $dateOfBirth;
```

2. Update constructor:
```php
public function __construct(
    string $fullName,
    Email $email,
    ?string $phone = null,
    ?string $dateOfBirth = null // NEW
) {
    $this->validateFullName($fullName);
    $this->fullName = trim($fullName);
    $this->email = $email;
    $this->phone = $phone ? trim($phone) : null;
    $this->dateOfBirth = $dateOfBirth; // NEW

    if ($this->dateOfBirth !== null) {
        $this->validateDateOfBirth($this->dateOfBirth); // NEW
    }
}
```

3. Add validation:
```php
private function validateDateOfBirth(string $dob): void
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) {
        throw new InvalidArgumentException(
            'Date of birth must be in YYYY-MM-DD format'
        );
    }

    $date = \DateTime::createFromFormat('Y-m-d', $dob);
    if (!$date || $date->format('Y-m-d') !== $dob) {
        throw new InvalidArgumentException(
            'Invalid date of birth'
        );
    }

    if ($date > new \DateTime()) {
        throw new InvalidArgumentException(
            'Date of birth cannot be in the future'
        );
    }
}
```

4. Add getter:
```php
public function dateOfBirth(): ?string
{
    return $this->dateOfBirth;
}
```

5. Update `toArray()`:
```php
public function toArray(): array
{
    return [
        'full_name' => $this->fullName,
        'email' => $this->email->value(),
        'phone' => $this->phone,
        'date_of_birth' => $this->dateOfBirth, // NEW
    ];
}
```

**Update Cast:**

File: `app/Contexts/Membership/Infrastructure/Casts/PersonalInfoCast.php`

```php
public function get(Model $model, string $key, mixed $value, array $attributes): ?PersonalInfo
{
    // ... existing code ...

    return new PersonalInfo(
        fullName: $data['full_name'],
        email: new Email($data['email']),
        phone: $data['phone'] ?? null,
        dateOfBirth: $data['date_of_birth'] ?? null // NEW
    );
}
```

**Write Test:**
```php
/** @test */
public function it_accepts_valid_date_of_birth()
{
    $info = new PersonalInfo(
        'John Doe',
        new Email('john@example.com'),
        null,
        '1990-05-15'
    );

    $this->assertEquals('1990-05-15', $info->dateOfBirth());
}

/** @test */
public function it_rejects_future_date_of_birth()
{
    $this->expectException(InvalidArgumentException::class);

    new PersonalInfo(
        'John Doe',
        new Email('john@example.com'),
        null,
        '2030-01-01'
    );
}
```

---

### 8.3 Adding New Business Rule Method to Member

**Example:** Check if member can receive financial assistance

**File:** `app/Contexts/Membership/Domain/Models/Member.php`

```php
/**
 * Check if member can receive financial assistance
 *
 * Business rule: Only active members with complete profile
 */
public function canReceiveFinancialAssistance(): bool
{
    return $this->status->isActive()
        && $this->personal_info !== null
        && $this->personal_info->phone() !== null
        && $this->residence_geo_reference !== null;
}
```

**Usage:**
```php
$member = Member::find('01JKABCD...');

if ($member->canReceiveFinancialAssistance()) {
    // Process financial assistance request
}
```

**Write Test:**
```php
/** @test */
public function active_member_with_complete_profile_can_receive_financial_assistance()
{
    $member = Member::register(...);
    $member->status = MemberStatus::active();
    $member->residence_geo_reference = 'np.3.15.234';

    $this->assertTrue($member->canReceiveFinancialAssistance());
}

/** @test */
public function inactive_member_cannot_receive_financial_assistance()
{
    $member = Member::register(...);
    $member->status = MemberStatus::inactive();

    $this->assertFalse($member->canReceiveFinancialAssistance());
}
```

---

### 8.4 Adding New Domain Event

**Example:** `MemberActivated` event

**File:** `app/Contexts/Membership/Domain/Events/MemberActivated.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MemberActivated
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly \DateTimeImmutable $activatedAt
    ) {}

    public function toArray(): array
    {
        return [
            'member_id' => $this->memberId,
            'tenant_id' => $this->tenantId,
            'activated_at' => $this->activatedAt->format('Y-m-d H:i:s'),
        ];
    }
}
```

**Record in Member:**

File: `app/Contexts/Membership/Domain/Models/Member.php`

```php
public function activate(): void
{
    $this->status = $this->status->activate();

    // Record event
    $this->recordThat(new MemberActivated(
        memberId: $this->id,
        tenantId: $this->tenant_id,
        activatedAt: new \DateTimeImmutable()
    ));
}
```

**Create Listener:**

```php
// app/Contexts/DigitalCard/Application/Listeners/GenerateCardOnMemberActivation.php

class GenerateCardOnMemberActivation
{
    public function handle(MemberActivated $event): void
    {
        // Generate digital membership card
        DigitalCard::create([
            'member_id' => $event->memberId,
            'tenant_id' => $event->tenantId,
            'issued_at' => $event->activatedAt,
        ]);
    }
}
```

**Register Listener:**

```php
// app/Providers/EventServiceProvider.php

protected $listen = [
    MemberActivated::class => [
        GenerateCardOnMemberActivation::class,
    ],
];
```

---

## 9. Testing Guidelines

### 9.1 Test Value Objects

**Location:** `tests/Unit/Contexts/Membership/Domain/ValueObjects/`

**Email Test Example:**
```php
<?php

namespace Tests\Unit\Contexts\Membership\Domain\ValueObjects;

use App\Contexts\Membership\Domain\ValueObjects\Email;
use InvalidArgumentException;
use Tests\TestCase;

class EmailTest extends TestCase
{
    /** @test */
    public function it_validates_email_format()
    {
        $this->expectException(InvalidArgumentException::class);
        new Email('invalid-email');
    }

    /** @test */
    public function it_normalizes_email_to_lowercase()
    {
        $email = new Email('JOHN@EXAMPLE.COM');
        $this->assertEquals('john@example.com', $email->value());
    }

    /** @test */
    public function it_trims_whitespace()
    {
        $email = new Email('  john@example.com  ');
        $this->assertEquals('john@example.com', $email->value());
    }

    /** @test */
    public function it_rejects_empty_email()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Email cannot be empty');

        new Email('');
    }

    /** @test */
    public function it_checks_equality()
    {
        $email1 = new Email('john@example.com');
        $email2 = new Email('JOHN@EXAMPLE.COM');

        $this->assertTrue($email1->equals($email2));
    }
}
```

### 9.2 Test Member Aggregate

**Location:** `tests/Unit/Contexts/Membership/Domain/Member/`

```php
<?php

namespace Tests\Unit\Contexts\Membership\Domain\Member;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Events\MemberRegistered;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use Tests\TestCase;

class MemberTest extends TestCase
{
    /** @test */
    public function it_records_member_registered_event()
    {
        $member = Member::register(
            tenantUserId: 'user_123',
            tenantId: 'uml',
            personalInfo: new PersonalInfo('John', new Email('john@example.com'))
        );

        $events = $member->getRecordedEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(MemberRegistered::class, $events[0]);
        $this->assertEquals($member->id, $events[0]->memberId);
    }

    /** @test */
    public function it_enforces_digital_identity_requirement()
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('tenant_user_id cannot be empty');

        Member::register(
            tenantUserId: '',
            tenantId: 'uml',
            personalInfo: new PersonalInfo('John', new Email('john@example.com'))
        );
    }

    /** @test */
    public function it_generates_ulid_on_registration()
    {
        $member = Member::register(
            tenantUserId: 'user_123',
            tenantId: 'uml',
            personalInfo: new PersonalInfo('John', new Email('john@example.com'))
        );

        $this->assertNotEmpty($member->id);
        $this->assertMatchesRegularExpression('/^[0-9A-Z]{26}$/', $member->id);
    }
}
```

### 9.3 Test Custom Casts

```php
<?php

namespace Tests\Unit\Contexts\Membership\Infrastructure\Casts;

use App\Contexts\Membership\Infrastructure\Casts\PersonalInfoCast;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use Tests\TestCase;

class PersonalInfoCastTest extends TestCase
{
    /** @test */
    public function it_casts_json_to_personal_info_object()
    {
        $cast = new PersonalInfoCast();
        $json = '{"full_name":"John Doe","email":"john@example.com","phone":null}';

        $result = $cast->get(new \stdClass(), 'personal_info', $json, []);

        $this->assertInstanceOf(PersonalInfo::class, $result);
        $this->assertEquals('John Doe', $result->fullName());
        $this->assertEquals('john@example.com', $result->email()->value());
    }

    /** @test */
    public function it_casts_personal_info_to_json()
    {
        $cast = new PersonalInfoCast();
        $personalInfo = new PersonalInfo('John Doe', new Email('john@example.com'));

        $result = $cast->set(new \stdClass(), 'personal_info', $personalInfo, []);

        $this->assertJson($result);
        $data = json_decode($result, true);
        $this->assertEquals('John Doe', $data['full_name']);
    }
}
```

---

## 10. Common Pitfalls & Solutions

### Pitfall 1: Forgetting to Save Member After Register

**❌ WRONG:**
```php
$member = Member::register(...);
// Events stuck in $recordedEvents array, never dispatched
```

**✅ CORRECT:**
```php
$member = Member::register(...);
$member->save(); // RecordsEvents trait auto-dispatches events
```

---

### Pitfall 2: Direct Property Assignment

**❌ WRONG:**
```php
$member->status = 'invalid_status'; // No validation
```

**✅ CORRECT:**
```php
$member->status = MemberStatus::fromString('invalid_status'); // Throws exception
```

---

### Pitfall 3: Modifying Value Objects

**❌ WRONG:**
```php
$personalInfo = $member->personal_info;
$personalInfo->fullName = 'New Name'; // Error: no setter exists (immutable)
```

**✅ CORRECT:**
```php
$member->personal_info = new PersonalInfo(
    'New Name',
    $personalInfo->email(),
    $personalInfo->phone()
);
$member->save();
```

---

### Pitfall 4: Not Checking State Transitions

**❌ WRONG:**
```php
$member->status = MemberStatus::active(); // Might be invalid transition
$member->save();
```

**✅ CORRECT:**
```php
$member->approve(); // Validates pending → approved
$member->save();

$member->activate(); // Validates approved → active
$member->save();
```

---

### Pitfall 5: Using Member Constructor Instead of Factory

**❌ WRONG:**
```php
$member = new Member();
$member->tenant_user_id = 'user_123';
// No validation, no events, no business rules
```

**✅ CORRECT:**
```php
$member = Member::register(
    tenantUserId: 'user_123',
    tenantId: 'uml',
    personalInfo: new PersonalInfo(...)
);
// Full validation, events recorded, business rules enforced
```

---

## 11. Integration Examples

### 11.1 Create Member from API Request

**File:** `app/Contexts/Membership/Infrastructure/Http/Controllers/MemberController.php`

```php
<?php

namespace App\Contexts\Membership\Infrastructure\Http\Controllers;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Domain\ValueObjects\MemberId;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class MemberController
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => 'required|string|min:2|max:255',
            'email' => 'required|email|unique:members,personal_info->email',
            'phone' => 'nullable|string|max:20',
            'member_id' => 'nullable|string|min:3|max:50',
            'geo_reference' => 'nullable|string',
        ]);

        $member = Member::register(
            tenantUserId: auth()->id(),
            tenantId: tenant('id'),
            personalInfo: new PersonalInfo(
                fullName: $validated['full_name'],
                email: new Email($validated['email']),
                phone: $validated['phone'] ?? null
            ),
            memberId: isset($validated['member_id'])
                ? new MemberId($validated['member_id'])
                : null,
            geoReference: $validated['geo_reference'] ?? null
        );

        $member->save();

        return response()->json([
            'id' => $member->id,
            'member_id' => $member->member_id?->value(),
            'status' => $member->status->value(),
            'message' => 'Member registered successfully',
        ], 201);
    }
}
```

### 11.2 Listen to MemberRegistered Event

**File:** `app/Contexts/Committee/Application/Listeners/AssignToDefaultCommittee.php`

```php
<?php

namespace App\Contexts\Committee\Application\Listeners;

use App\Contexts\Membership\Domain\Events\MemberRegistered;
use App\Models\Committee;
use App\Models\CommitteeMember;

class AssignToDefaultCommittee
{
    public function handle(MemberRegistered $event): void
    {
        // Find default committee for this tenant
        $defaultCommittee = Committee::where('tenant_id', $event->tenantId)
            ->where('is_default', true)
            ->first();

        if ($defaultCommittee) {
            CommitteeMember::create([
                'committee_id' => $defaultCommittee->id,
                'member_id' => $event->memberId,
                'role' => 'member',
                'joined_at' => now(),
            ]);

            \Log::info('Member auto-assigned to default committee', [
                'member_id' => $event->memberId,
                'committee_id' => $defaultCommittee->id,
            ]);
        }
    }
}
```

**Register Listener:**
```php
// app/Providers/EventServiceProvider.php

protected $listen = [
    MemberRegistered::class => [
        AssignToDefaultCommittee::class,
        EnrichMemberGeography::class,
        GenerateDigitalCard::class,
    ],
];
```

---

## 12. Performance Considerations

### 12.1 Eager Loading

**❌ N+1 Query Problem:**
```php
$members = Member::all();
foreach ($members as $member) {
    echo $member->status->value(); // Works (cast handles it)
    // But no N+1 problem here since status is a column, not relation
}
```

**✅ Batch Operations:**
```php
// Group members by status
$members = Member::whereIn('status', ['active', 'pending'])
    ->get()
    ->groupBy(fn($m) => $m->status->value());

// Count by status
$statusCounts = Member::where('tenant_id', 'uml')
    ->select('status', DB::raw('count(*) as count'))
    ->groupBy('status')
    ->get();
```

### 12.2 Caching

**Cache member count by status:**
```php
use Illuminate\Support\Facades\Cache;

$tenantId = 'uml';

$activeCount = Cache::remember(
    "tenant:{$tenantId}:members:active:count",
    now()->addHours(1),
    fn() => Member::where('tenant_id', $tenantId)
        ->where('status', 'active')
        ->count()
);
```

**Invalidate cache on member status change:**
```php
// In Member.php
protected static function booted(): void
{
    static::updated(function ($member) {
        if ($member->isDirty('status')) {
            Cache::forget("tenant:{$member->tenant_id}:members:active:count");
        }
    });
}
```

---

## 13. Future Enhancements

### Planned Features

1. **Member Approval Workflow**: Multi-step approval with committee votes
2. **Membership Renewal**: Expiration dates and renewal logic
3. **Member Permissions**: Fine-grained RBAC within membership
4. **Member Search**: Elasticsearch integration for full-text search
5. **Member Import**: Bulk CSV import with validation
6. **Member Export**: PDF/Excel export with formatting
7. **Member Notifications**: Email/SMS notifications for status changes
8. **Member Audit Trail**: Complete history of status changes and edits

### Extensibility Points

**Metadata Field:**
```php
$member->metadata = [
    'membership_tier' => 'premium',
    'referral_code' => 'REF-2024-001',
    'notes' => 'Founding member',
    'custom_fields' => [
        'occupation' => 'Software Engineer',
        'education' => 'Bachelor',
    ]
];
$member->save();
```

**Custom Member Types:**
```php
// Enum for membership_type
enum MembershipType: string
{
    case REGULAR = 'regular';
    case HONORARY = 'honorary';
    case ASSOCIATE = 'associate';
    case LIFETIME = 'lifetime';
}
```

---

## 14. Quick Reference

### Member Lifecycle Flowchart

```
┌──────────────────────────────────────────────────────────────┐
│                   Member Registration                          │
│                                                                │
│  POST /api/members                                             │
│    → Member::register()                                        │
│    → Status: DRAFT                                             │
│    → Event: MemberRegistered                                   │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   Submit for Approval                          │
│                                                                │
│  PATCH /api/members/{id}/submit                                │
│    → $member->status = MemberStatus::pending()                 │
│    → Event: MemberSubmittedForApproval                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   Committee Approval                           │
│                                                                │
│  POST /api/members/{id}/approve                                │
│    → $member->approve()                                        │
│    → Status: APPROVED                                          │
│    → Event: MemberApproved                                     │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   Payment & Activation                         │
│                                                                │
│  POST /api/members/{id}/activate                               │
│    → $member->activate()                                       │
│    → Status: ACTIVE                                            │
│    → Event: MemberActivated                                    │
│    → Listener: Generate Digital Card                           │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   Active Member                                │
│                                                                │
│  Can vote: ✓                                                   │
│  Can hold committee role: ✓                                    │
│  Can receive digital card: ✓                                   │
│  Can participate in forums: ✓                                  │
└──────────────────────────────────────────────────────────────┘
```

### Common Commands

```bash
# Create member in Tinker
php artisan tinker
>>> use App\Contexts\Membership\Domain\Models\Member;
>>> use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
>>> use App\Contexts\Membership\Domain\ValueObjects\Email;
>>> $member = Member::register('user_123', 'uml', new PersonalInfo('John', new Email('john@example.com')));
>>> $member->save();

# Run Membership tests
php artisan test --filter=Membership

# Check member status distribution
php artisan tinker
>>> Member::groupBy('status')->selectRaw('status, count(*) as count')->get();
```

---

**Last Updated:** 2026-01-02
**Version:** 1.0
**Status:** Day 1 Implementation Complete
**Next:** Database migration, Application services, API endpoints
