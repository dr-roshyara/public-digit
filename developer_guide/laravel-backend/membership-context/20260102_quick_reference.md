# Membership Context - Quick Reference

**Date:** 2026-01-02
**Version:** 1.0
**For:** Quick lookup of common operations

---

## Cheat Sheet

### Create Member
```php
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\{PersonalInfo, Email, MemberId};

$member = Member::register(
    tenantUserId: auth()->id(),
    tenantId: tenant('id'),
    personalInfo: new PersonalInfo(
        fullName: 'Ram Kumar Shrestha',
        email: new Email('ram@example.com'),
        phone: '+977-9841234567'
    ),
    memberId: new MemberId('UML-2024-0001'),
    geoReference: 'np.3.15.234.1.2'
);
$member->save();
```

### Change Status
```php
// pending → approved
$member->approve();
$member->save();

// approved → active
$member->activate();
$member->save();

// active → suspended
$member->suspend();
$member->save();
```

### Check Permissions
```php
$member->canVote(); // true if active
$member->canHoldCommitteeRole(); // true if approved or active
$member->status->canReceiveDigitalCard(); // true if active
```

---

## Value Object Quick Reference

### Email
```php
$email = new Email('john@example.com');
$email->value(); // "john@example.com"
$email->equals(new Email('JOHN@example.com')); // true (normalized)
```

### PersonalInfo
```php
$info = new PersonalInfo('John Doe', new Email('john@example.com'), '+123');
$info->fullName(); // "John Doe"
$info->email(); // Email object
$info->phone(); // "+123"
$info->toArray(); // ['full_name' => 'John Doe', 'email' => 'john@example.com', ...]
```

### MemberStatus
```php
// Factory methods
MemberStatus::draft();
MemberStatus::pending();
MemberStatus::approved();
MemberStatus::active();

// From string
MemberStatus::fromString('active');

// Checks
$status->isDraft();
$status->canVote();
$status->canTransitionTo(MemberStatus::active());

// Transitions
$status->approve(); // pending → approved
$status->activate(); // approved → active
$status->suspend(); // active → suspended
```

### MemberId
```php
$memberId = new MemberId('UML-2024-0001');
$memberId->value(); // "UML-2024-0001"
$memberId->matchesPattern('/^UML-\d{4}-\d{4}$/'); // true
```

---

## State Transition Matrix

| From       | To                                    |
|------------|---------------------------------------|
| draft      | → pending, archived                   |
| pending    | → approved, archived                  |
| approved   | → active, archived                    |
| active     | → suspended, inactive, archived       |
| suspended  | → active, inactive, archived          |
| inactive   | → active, archived                    |
| archived   | (terminal)                            |

---

## Domain Events

### MemberRegistered
```php
// Automatically fired when member is saved
$member = Member::register(...);
$member->save(); // Fires MemberRegistered event

// Event payload
[
    'member_id' => '01JKABCD...',
    'tenant_user_id' => 'user_123',
    'tenant_id' => 'uml',
    'status' => 'draft',
    'personal_info' => [...]
]
```

### Listen to Events
```php
// In EventServiceProvider
Event::listen(MemberRegistered::class, AssignToDefaultCommittee::class);
```

---

## Database Schema

```sql
CREATE TABLE members (
    id VARCHAR(26) PRIMARY KEY,              -- ULID
    member_id VARCHAR(50) NULLABLE,          -- Party-defined ID
    tenant_user_id VARCHAR(26) NOT NULL,     -- Required (1:1)
    tenant_id VARCHAR(50) NOT NULL,
    personal_info JSONB NOT NULL,            -- {full_name, email, phone}
    status VARCHAR(50) NOT NULL,             -- draft, pending, approved, active...
    residence_geo_reference VARCHAR(255),    -- Optional geography string
    membership_type VARCHAR(50) NOT NULL,    -- regular, honorary, etc.
    metadata JSONB,                          -- Extensibility
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(tenant_id, member_id),
    UNIQUE(tenant_id, tenant_user_id)
);
```

---

## API Examples

### Register Member
```http
POST /api/members
Content-Type: application/json

{
    "full_name": "Ram Kumar Shrestha",
    "email": "ram@example.com",
    "phone": "+977-9841234567",
    "member_id": "UML-2024-0001",
    "geo_reference": "np.3.15.234.1.2"
}
```

### Response
```json
{
    "id": "01JKABCD1234567890ABCDEFGH",
    "member_id": "UML-2024-0001",
    "status": "draft",
    "message": "Member registered successfully"
}
```

### Approve Member
```http
POST /api/members/{id}/approve
```

### Activate Member
```http
POST /api/members/{id}/activate
```

---

## Testing Quick Reference

### Unit Test Value Object
```php
/** @test */
public function it_validates_email_format()
{
    $this->expectException(InvalidArgumentException::class);
    new Email('invalid-email');
}
```

### Unit Test Member
```php
/** @test */
public function it_enforces_digital_identity_requirement()
{
    $this->expectException(InvalidArgumentException::class);

    Member::register(
        tenantUserId: '',
        tenantId: 'uml',
        personalInfo: new PersonalInfo('John', new Email('john@example.com'))
    );
}
```

### Feature Test API
```php
/** @test */
public function it_creates_member_via_api()
{
    $response = $this->postJson('/api/members', [
        'full_name' => 'John Doe',
        'email' => 'john@example.com',
    ]);

    $response->assertStatus(201);
    $response->assertJsonStructure(['id', 'status']);
}
```

---

## Debugging Quick Commands

```bash
# Laravel Tinker
php artisan tinker
>>> Member::first()
>>> $member->status->value()
>>> $member->getRecordedEvents()

# Enable query log
>>> DB::enableQueryLog()
>>> Member::all()
>>> DB::getQueryLog()

# Run tests
php artisan test --filter=Membership

# Check logs
tail -f storage/logs/laravel.log

# Clear cache
php artisan cache:clear
```

---

## Common Patterns

### Controller Pattern
```php
public function store(Request $request)
{
    $validated = $request->validate([...]);

    $member = Member::register(...);
    $member->save();

    return response()->json([...], 201);
}
```

### Service Pattern
```php
class MemberRegistrationService
{
    public function register(array $data): Member
    {
        $member = Member::register(...);
        $member->save();

        return $member;
    }
}
```

### Event Listener Pattern
```php
class AssignToDefaultCommittee
{
    public function handle(MemberRegistered $event): void
    {
        // Auto-assign logic
    }
}
```

---

## Architecture Principles

1. **Digital Identity First**: Every member MUST have `tenant_user_id`
2. **Geography Decoupling**: Only string references, no FKs
3. **Event-Driven**: Contexts communicate via events
4. **Value Objects**: Type-safe, immutable, self-validating
5. **Factory Method**: Use `Member::register()`, not `new Member()`

---

## File Locations

```
app/Contexts/Membership/
├── Domain/
│   ├── Models/Member.php
│   ├── ValueObjects/
│   │   ├── Email.php
│   │   ├── PersonalInfo.php
│   │   ├── MemberStatus.php
│   │   └── MemberId.php
│   ├── Events/MemberRegistered.php
│   └── Traits/RecordsEvents.php
└── Infrastructure/
    └── Casts/
        ├── PersonalInfoCast.php
        ├── MemberStatusCast.php
        └── MemberIdCast.php

tests/Unit/Contexts/Membership/
└── Domain/
    ├── Member/
    └── ValueObjects/
```

---

## Next Steps

After implementing Day 1 (Value Objects + Member Aggregate):

1. **Database Migration**: Create `members` table
2. **Application Services**: MemberRegistrationService, MemberApprovalService
3. **API Endpoints**: REST API for member CRUD
4. **Additional Tests**: Integration tests, feature tests
5. **Event Listeners**: Committee assignment, digital card generation

---

**Last Updated:** 2026-01-02
**Version:** 1.0
**See Also:**
- Main Developer Guide (`20260102_membership_developer_guide.md`)
- Debugging Guide (`20260102_debugging_guide.md`)
