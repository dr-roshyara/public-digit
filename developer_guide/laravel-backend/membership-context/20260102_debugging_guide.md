# Membership Context - Debugging Guide

**Date:** 2026-01-02
**Version:** 1.0
**For:** Troubleshooting production issues and development debugging

---

## Table of Contents

1. [Quick Debugging Checklist](#1-quick-debugging-checklist)
2. [Common Error Messages](#2-common-error-messages)
3. [Debugging Value Objects](#3-debugging-value-objects)
4. [Debugging Member Creation](#4-debugging-member-creation)
5. [Debugging Custom Casts](#5-debugging-custom-casts)
6. [Debugging Domain Events](#6-debugging-domain-events)
7. [Database Debugging](#7-database-debugging)
8. [Performance Debugging](#8-performance-debugging)
9. [Production Debugging](#9-production-debugging)

---

## 1. Quick Debugging Checklist

When something goes wrong, check these in order:

```bash
# 1. Check Laravel logs
tail -f storage/logs/laravel.log

# 2. Check if member exists
php artisan tinker
>>> Member::where('id', '01JKABCD...')->exists()

# 3. Check member status
>>> Member::find('01JKABCD...')->status->value()

# 4. Check recorded events
>>> Member::find('01JKABCD...')->getRecordedEvents()

# 5. Enable query log
>>> DB::enableQueryLog()
>>> Member::first()
>>> DD::getQueryLog()

# 6. Check database connection
>>> DB::connection('tenant')->getPdo()
```

---

## 2. Common Error Messages

### Error 1: "tenant_user_id cannot be empty"

**Full Error:**
```
InvalidArgumentException: Member registration requires a tenant user account.
tenant_user_id cannot be empty. Digital identity is mandatory for all members.
```

**Cause:** Trying to create member without tenant_user_id

**Solution:**
```php
// ❌ WRONG
Member::register(tenantUserId: '', ...);

// ✅ CORRECT
Member::register(tenantUserId: auth()->id(), ...);
```

---

### Error 2: "Member ID already exists for tenant"

**Full Error:**
```
InvalidArgumentException: Member ID 'UML-2024-0001' already exists for tenant 'uml'
```

**Cause:** Duplicate member_id within same tenant

**Debug:**
```php
// Check if member_id exists
$exists = Member::where('tenant_id', 'uml')
    ->where('member_id', 'UML-2024-0001')
    ->exists();

dd($exists); // true
```

**Solution:**
```php
// Use unique member_id or don't specify (auto-generate)
$member = Member::register(
    tenantUserId: 'user_123',
    tenantId: 'uml',
    personalInfo: $info,
    memberId: null // Let application generate unique ID
);
```

---

### Error 3: "Invalid email format"

**Full Error:**
```
InvalidArgumentException: Invalid email format: john.example.com
```

**Cause:** Email doesn't pass validation

**Debug:**
```php
// Test email validation
try {
    $email = new Email('john.example.com'); // Missing @
} catch (InvalidArgumentException $e) {
    dd($e->getMessage());
}
```

**Solution:**
```php
// Validate email before creating value object
$validated = $request->validate([
    'email' => 'required|email',
]);

$email = new Email($validated['email']);
```

---

### Error 4: "Cannot approve a member with status: draft"

**Full Error:**
```
InvalidArgumentException: Cannot approve a member with status: draft.
Only 'pending' members can be approved.
```

**Cause:** Trying to approve a member in wrong status

**Debug:**
```php
$member = Member::find('01JKABCD...');
dd($member->status->value()); // "draft"

// Check transition rules
dd($member->status->canTransitionTo(MemberStatus::approved())); // false
```

**Solution:**
```php
// Follow correct status flow
$member->status = MemberStatus::pending();
$member->save();

// Now can approve
$member->approve();
$member->save();
```

---

### Error 5: "Class 'PersonalInfo' not found"

**Full Error:**
```
Error: Class 'PersonalInfo' not found
```

**Cause:** Missing `use` statement

**Solution:**
```php
// Add missing use statements
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;

$info = new PersonalInfo('John', new Email('john@example.com'));
```

---

### Error 6: "Failed to decode PersonalInfo JSON"

**Full Error (in logs):**
```
Failed to decode PersonalInfo JSON
{
    "key": "personal_info",
    "value": "{invalid json}",
    "error": "Syntax error"
}
```

**Cause:** Corrupted JSON in database

**Debug:**
```php
$member = Member::find('01JKABCD...');

// Check raw database value
dd($member->getAttributes()['personal_info']);
// Output: "{invalid json}" (corrupted)

// Check cast result
dd($member->personal_info); // null (cast failed)
```

**Solution:**
```sql
-- Fix in database
UPDATE members
SET personal_info = '{"full_name":"John Doe","email":"john@example.com","phone":null}'
WHERE id = '01JKABCD...';
```

---

## 3. Debugging Value Objects

### Debug Email Validation

```php
use App\Contexts\Membership\Domain\ValueObjects\Email;

// Test valid email
try {
    $email = new Email('john@example.com');
    dump('✓ Valid email: ' . $email->value());
} catch (InvalidArgumentException $e) {
    dump('✗ Error: ' . $e->getMessage());
}

// Test invalid emails
$invalid = [
    '',
    'plaintext',
    '@example.com',
    'john@',
    'john..doe@example.com',
];

foreach ($invalid as $test) {
    try {
        new Email($test);
        dump("✗ Should have failed: $test");
    } catch (InvalidArgumentException $e) {
        dump("✓ Correctly rejected: $test");
    }
}
```

---

### Debug MemberStatus Transitions

```php
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;

// Test transition matrix
$transitions = [
    ['from' => 'draft', 'to' => 'pending', 'valid' => true],
    ['from' => 'draft', 'to' => 'active', 'valid' => false],
    ['from' => 'pending', 'to' => 'approved', 'valid' => true],
    ['from' => 'approved', 'to' => 'active', 'valid' => true],
    ['from' => 'active', 'to' => 'draft', 'valid' => false],
];

foreach ($transitions as $test) {
    $from = MemberStatus::fromString($test['from']);
    $to = MemberStatus::fromString($test['to']);
    $canTransition = $from->canTransitionTo($to);

    $result = $canTransition === $test['valid'] ? '✓' : '✗';
    dump("$result {$test['from']} → {$test['to']}: " . ($canTransition ? 'YES' : 'NO'));
}
```

---

### Debug PersonalInfo Creation

```php
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\Email;

// Test with logging
try {
    $info = new PersonalInfo(
        fullName: 'A', // Too short (< 2 chars)
        email: new Email('john@example.com')
    );
} catch (InvalidArgumentException $e) {
    \Log::debug('PersonalInfo validation failed', [
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
    ]);
    dump($e->getMessage());
}
```

---

## 4. Debugging Member Creation

### Enable Query Logging

```php
use Illuminate\Support\Facades\DB;
use App\Contexts\Membership\Domain\Models\Member;

// Enable query log
DB::enableQueryLog();

// Create member
$member = Member::register(
    tenantUserId: 'user_123',
    tenantId: 'uml',
    personalInfo: new PersonalInfo('John Doe', new Email('john@example.com'))
);

// Check events BEFORE save
dump('Events before save:', $member->getRecordedEvents());

// Save
$member->save();

// Check queries
dump('SQL Queries:', DB::getQueryLog());

// Check events AFTER save
dump('Events after save:', $member->getRecordedEvents()); // Should be empty (dispatched)
```

**Expected Output:**
```php
"Events before save:" => [
    MemberRegistered {
        memberId: "01JKABCD1234567890ABCDEFGH",
        tenantUserId: "user_123",
        ...
    }
]

"SQL Queries:" => [
    [
        "query" => "INSERT INTO members (id, tenant_user_id, ...) VALUES (?, ?, ...)",
        "bindings" => ["01JKABCD...", "user_123", ...],
        "time" => 12.45
    ]
]

"Events after save:" => [] // Dispatched
```

---

### Debug Member ID Generation

```php
// Test ULID generation
$member1 = Member::register(...);
$member2 = Member::register(...);

dump('Member 1 ID:', $member1->id);
dump('Member 2 ID:', $member2->id);

// Check uniqueness
dump('IDs are unique:', $member1->id !== $member2->id);

// Check ULID format (26 characters, uppercase alphanumeric)
dump('Valid ULID format:', preg_match('/^[0-9A-Z]{26}$/', $member1->id));
```

---

### Debug Event Recording

```php
// Create member but don't save
$member = Member::register(...);

// Check recorded events
$events = $member->getRecordedEvents();
dump('Event count:', count($events)); // 1
dump('Event type:', get_class($events[0])); // MemberRegistered

// Manually dispatch events (for testing)
$member->dispatchRecordedEvents();

// Events should be cleared
dump('Events after dispatch:', $member->getRecordedEvents()); // []
```

---

## 5. Debugging Custom Casts

### Debug PersonalInfoCast

```php
use App\Contexts\Membership\Infrastructure\Casts\PersonalInfoCast;

// Simulate database → application
$cast = new PersonalInfoCast();
$json = '{"full_name":"John Doe","email":"john@example.com","phone":"+123"}';

$result = $cast->get(new \stdClass(), 'personal_info', $json, []);

dump('Type:', get_class($result)); // PersonalInfo
dump('Full name:', $result->fullName());
dump('Email:', $result->email()->value());

// Simulate application → database
$personalInfo = new PersonalInfo('John', new Email('john@example.com'));
$jsonResult = $cast->set(new \stdClass(), 'personal_info', $personalInfo, []);

dump('JSON output:', $jsonResult);
dump('Valid JSON:', json_decode($jsonResult) !== null);
```

---

### Debug MemberStatusCast

```php
use App\Contexts\Membership\Infrastructure\Casts\MemberStatusCast;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;

$cast = new MemberStatusCast();

// Database → Application
$result = $cast->get(new \stdClass(), 'status', 'active', []);
dump('Type:', get_class($result)); // MemberStatus
dump('Value:', $result->value()); // "active"

// Application → Database
$status = MemberStatus::active();
$dbValue = $cast->set(new \stdClass(), 'status', $status, []);
dump('Database value:', $dbValue); // "active"
```

---

### Debug Cast Errors

```php
// Test invalid JSON
$cast = new PersonalInfoCast();
$invalidJson = '{invalid json}';

// Enable logging
\Log::listen(function ($message) {
    dump('Log:', $message);
});

$result = $cast->get(new \stdClass(), 'personal_info', $invalidJson, []);
dump('Result:', $result); // null

// Check logs
// Log: "Failed to decode PersonalInfo JSON"
```

---

## 6. Debugging Domain Events

### Listen to Events in Real-Time

```php
use Illuminate\Support\Facades\Event;
use App\Contexts\Membership\Domain\Events\MemberRegistered;

// In AppServiceProvider or test
Event::listen(MemberRegistered::class, function ($event) {
    \Log::debug('🔥 MemberRegistered Event Fired', [
        'member_id' => $event->memberId,
        'tenant_id' => $event->tenantId,
        'status' => $event->status->value(),
        'timestamp' => now(),
    ]);
});

// Create member
$member = Member::register(...);
$member->save(); // Event fires here

// Check logs: storage/logs/laravel.log
```

---

### Debug Event Listeners

```php
// Check which listeners are registered
dump('MemberRegistered listeners:', Event::getListeners(MemberRegistered::class));

// Fake events for testing
Event::fake([MemberRegistered::class]);

// Create member
$member = Member::register(...);
$member->save();

// Assert event was dispatched
Event::assertDispatched(MemberRegistered::class, function ($event) use ($member) {
    return $event->memberId === $member->id;
});
```

---

### Debug Event Not Firing

**Checklist:**

1. **Is save() called?**
```php
$member = Member::register(...);
// ❌ Event not dispatched - forgot save()

$member->save(); // ✓ Now events dispatch
```

2. **Is booted() method present?**
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

3. **Check event queue:**
```bash
# If events are queued
php artisan queue:work

# Check failed jobs
php artisan queue:failed
```

---

## 7. Database Debugging

### Check Member Table Structure

```php
// In Tinker
Schema::connection('tenant')->getColumnListing('members');

// Output:
// ["id", "member_id", "tenant_user_id", "tenant_id", "personal_info", "status", ...]
```

---

### Check Raw Database Values

```php
$member = Member::find('01JKABCD...');

// Get raw attributes (before casts)
dd($member->getAttributes());

// Output:
// [
//     "id" => "01JKABCD1234567890ABCDEFGH",
//     "personal_info" => '{"full_name":"John Doe",...}',
//     "status" => "active",
//     ...
// ]

// Get casted attributes
dd($member->personal_info); // PersonalInfo object
dd($member->status); // MemberStatus object
```

---

### Debug Tenant Database Connection

```php
// Check current connection
dd(DB::connection()->getDatabaseName()); // "tenant_uml"

// Check all connections
dd(DB::connection('tenant')->getPdo());
dd(DB::connection('landlord')->getPdo());

// Test query
$result = DB::connection('tenant')
    ->table('members')
    ->where('status', 'active')
    ->count();

dd($result);
```

---

## 8. Performance Debugging

### Detect N+1 Queries

```php
use Illuminate\Support\Facades\DB;

DB::enableQueryLog();

$members = Member::all();

foreach ($members as $member) {
    // This doesn't cause N+1 (status is column, not relation)
    echo $member->status->value();
}

$queries = DB::getQueryLog();
dump('Query count:', count($queries)); // Should be 1 (only SELECT FROM members)
```

---

### Profile Member Creation

```php
use Illuminate\Support\Benchmark;

$result = Benchmark::measure([
    'register_member' => fn() => Member::register(...),
    'save_member' => function () {
        $member = Member::register(...);
        $member->save();
    },
], iterations: 100);

dump($result);
// Output:
// [
//     "register_member" => 0.0012s,
//     "save_member" => 0.0145s,
// ]
```

---

### Memory Usage

```php
$before = memory_get_usage();

$members = Member::take(1000)->get();

$after = memory_get_usage();

dump('Memory used:', ($after - $before) / 1024 / 1024, 'MB');
```

---

## 9. Production Debugging

### Enable Production Logging

```php
// In Member::register()
\Log::info('Member registration attempt', [
    'tenant_id' => $tenantId,
    'tenant_user_id' => $tenantUserId,
    'has_member_id' => $memberId !== null,
]);

try {
    $member = Member::register(...);
    $member->save();

    \Log::info('Member registered successfully', [
        'member_id' => $member->id,
        'status' => $member->status->value(),
    ]);
} catch (\Exception $e) {
    \Log::error('Member registration failed', [
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
    ]);
    throw $e;
}
```

---

### Production Stack Trace Analysis

**Error in logs:**
```
[2026-01-02 14:30:15] production.ERROR: Invalid email format: john.example.com
/var/www/app/Contexts/Membership/Domain/ValueObjects/Email.php(28)
/var/www/app/Contexts/Membership/Domain/ValueObjects/PersonalInfo.php(15)
/var/www/app/Contexts/Membership/Domain/Models/Member.php(102)
/var/www/app/Contexts/Membership/Infrastructure/Http/Controllers/MemberController.php(25)
```

**Reading the trace:**
1. Error occurred in `Email.php` line 28 (validation)
2. Called by `PersonalInfo.php` line 15 (constructor)
3. Called by `Member.php` line 102 (register method)
4. Called by `MemberController.php` line 25 (store method)

**Root cause:** Invalid email passed from API request

**Fix:** Add validation in controller before creating value object

---

### Debugging in Production (Safely)

```php
// DON'T use dd() or dump() in production
// ❌ dd($member); // Stops execution

// Instead, use logging
\Log::debug('Member data', [
    'member' => $member->toArray(),
    'status' => $member->status->value(),
]);

// Or use Ray (if installed)
ray($member)->green();
```

---

## 10. Debugging Tools

### Laravel Tinker

```bash
php artisan tinker

# Load member
>>> $member = Member::first()

# Check status
>>> $member->status->value()
=> "draft"

# Test transitions
>>> $member->status->canTransitionTo(MemberStatus::active())
=> false

# Check events
>>> $member->getRecordedEvents()
=> []
```

---

### Laravel Telescope

```php
// Install Telescope (development only)
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate

// Access at: http://localhost:8000/telescope

// View:
// - All database queries
// - Event dispatches
// - Logs
// - Exceptions
```

---

### Ray Debug Tool

```php
// Install Ray
composer require spatie/laravel-ray

// Use in code
use Spatie\LaravelRay\Ray;

ray($member)->green();
ray($member->status->value())->orange();
ray($member->getRecordedEvents())->purple();

// Conditional debugging
ray()->if($member->status->isDraft(), $member);
```

---

## 11. Debugging Checklist

When debugging issues:

- [ ] Check Laravel logs: `storage/logs/laravel.log`
- [ ] Enable query log: `DB::enableQueryLog()`
- [ ] Check member exists: `Member::find('...')`
- [ ] Check member status: `$member->status->value()`
- [ ] Check recorded events: `$member->getRecordedEvents()`
- [ ] Check raw attributes: `$member->getAttributes()`
- [ ] Check database connection: `DB::connection()->getDatabaseName()`
- [ ] Listen to events: `Event::listen(...)`
- [ ] Check validation errors
- [ ] Review stack trace
- [ ] Test value object creation in isolation

---

**Last Updated:** 2026-01-02
**Version:** 1.0
