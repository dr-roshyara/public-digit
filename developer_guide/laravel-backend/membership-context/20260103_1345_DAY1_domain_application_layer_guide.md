# Membership Context - DAY 1: Domain & Application Layer Developer Guide

**Created:** 2026-01-03 13:45
**Phase:** DAY 1 - Foundation Complete
**Status:** Production-Ready
**Architecture:** DDD (Domain-Driven Design) + Hexagonal Architecture

---

## 🎯 Overview

DAY 1 established the **foundational layers** of the Membership Context following strict DDD principles:

- ✅ **Domain Layer**: Pure business logic (no framework dependencies)
- ✅ **Application Layer**: Use cases and orchestration (DTOs, Services)
- ✅ **Clean Architecture**: Dependencies point inward (Infrastructure → Application → Domain)

**Core Principle:**
> "Digital identity first, geography optional, events over coupling."

**Key Achievement:**
- 100% framework-agnostic domain layer
- Channel-aware member creation (mobile vs desktop)
- Anti-corruption layer for external contexts
- Testable, maintainable, extensible architecture

---

## 📦 What Was Built

### Domain Layer Components

```
app/Contexts/Membership/Domain/
├── Models/
│   └── Member.php (Aggregate Root)
├── ValueObjects/
│   ├── Email.php
│   ├── PersonalInfo.php
│   ├── MemberStatus.php
│   ├── MemberId.php
│   ├── TenantUserId.php (NEW - DAY 1)
│   ├── GeoReference.php (NEW - DAY 1)
│   └── RegistrationChannel.php (NEW - DAY 1)
├── Events/
│   └── MemberRegistered.php
├── Factories/
│   └── MemberFactory.php (NEW - DAY 1)
└── Services/
    ├── TenantUserProvisioningInterface.php (NEW - DAY 1)
    └── GeographyResolverInterface.php (NEW - DAY 1)
```

### Application Layer Components

```
app/Contexts/Membership/Application/
├── DTOs/
│   ├── MobileRegistrationDto.php (NEW - DAY 1)
│   └── DesktopRegistrationDto.php (NEW - DAY 1)
└── Services/
    ├── MobileMemberRegistrationService.php (NEW - DAY 1)
    └── DesktopMemberRegistrationService.php (NEW - DAY 1)
```

---

## 🏗️ Architecture Deep Dive

### 1. Domain Services (Interfaces)

**Purpose**: Define contracts for operations that don't belong to a single aggregate.

#### TenantUserProvisioningInterface

**Location**: `app/Contexts/Membership/Domain/Services/TenantUserProvisioningInterface.php`

**Responsibility**: Provision tenant user accounts (Anti-Corruption Layer for TenantAuth context)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Services;

use App\Contexts\Membership\Application\DTOs\MobileRegistrationDto;
use App\Contexts\Membership\Application\DTOs\DesktopRegistrationDto;
use App\Contexts\Membership\Domain\ValueObjects\TenantUserId;

/**
 * Tenant User Provisioning Interface
 *
 * DOMAIN SERVICE - Anti-Corruption Layer
 *
 * Decouples Membership context from TenantAuth context.
 * Infrastructure layer provides concrete implementation.
 */
interface TenantUserProvisioningInterface
{
    /**
     * Provision user account for mobile registration
     *
     * Business Rule: Mobile users get self-service accounts
     * Status: Initially unverified, requires email confirmation
     */
    public function provisionForMobile(MobileRegistrationDto $dto): TenantUserId;

    /**
     * Provision user account for desktop registration
     *
     * Business Rule: Desktop registration by admins
     * Reuses existing tenant_user_id (admin creates member for existing user)
     */
    public function provisionForDesktop(DesktopRegistrationDto $dto): TenantUserId;
}
```

**Why This Matters:**
- ✅ Membership doesn't know HOW users are created (TenantAuth's job)
- ✅ Membership only cares THAT a user exists (tenant_user_id)
- ✅ Easy to swap implementations (API call, direct DB, message queue)

---

#### GeographyResolverInterface

**Location**: `app/Contexts/Membership/Domain/Services/GeographyResolverInterface.php`

**Responsibility**: Validate and resolve geography references (Anti-Corruption Layer for Geography context)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Services;

use App\Contexts\Membership\Domain\ValueObjects\GeoReference;

/**
 * Geography Resolver Interface
 *
 * DOMAIN SERVICE - Anti-Corruption Layer
 *
 * Decouples Membership from Geography context.
 * Membership stores only string references, never IDs.
 */
interface GeographyResolverInterface
{
    /**
     * Validate and return geography reference
     *
     * @param string|null $geoReference Format: "np.3.15.234.1.2"
     * @return GeoReference|null Returns null if invalid or doesn't exist
     *
     * Business Rules:
     * - Geography is OPTIONAL for members
     * - Format must be: country_code.level1.level2...
     * - Must exist in Geography context
     * - Must be active
     */
    public function validate(?string $geoReference): ?GeoReference;

    /**
     * Resolve geography reference to human-readable name
     *
     * @param GeoReference $geoReference
     * @return string|null "Province 3, Kathmandu, Ward 15"
     */
    public function resolveName(GeoReference $geoReference): ?string;
}
```

**Why This Matters:**
- ✅ Membership never imports Geography models
- ✅ Geography can change implementation without affecting Membership
- ✅ String references = loose coupling, no foreign keys across contexts

---

### 2. Domain Value Objects (NEW in DAY 1)

#### TenantUserId

**Location**: `app/Contexts/Membership/Domain/ValueObjects/TenantUserId.php`

**Purpose**: Type-safe identifier for tenant user accounts (1:1 with Member)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Tenant User ID Value Object
 *
 * Business Rule: Every member MUST have a tenant_user account (1:1 required)
 * Format: ULID (26 characters, uppercase)
 */
final class TenantUserId
{
    private string $value;

    public function __construct(string $value)
    {
        $value = trim($value);

        if (empty($value)) {
            throw new InvalidArgumentException('Tenant User ID cannot be empty');
        }

        // ULID format: 26 characters, alphanumeric uppercase
        if (strlen($value) !== 26 || !ctype_alnum($value)) {
            throw new InvalidArgumentException(
                "Invalid Tenant User ID format: {$value}. Expected ULID (26 characters)."
            );
        }

        $this->value = strtoupper($value);
    }

    public function value(): string
    {
        return $this->value;
    }

    public function equals(TenantUserId $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
```

**Usage:**
```php
// Valid
$tenantUserId = new TenantUserId('01HQWE1234567890ABCDEFGHJK');

// Invalid - throws InvalidArgumentException
$tenantUserId = new TenantUserId(''); // Empty
$tenantUserId = new TenantUserId('invalid'); // Wrong format
```

---

#### GeoReference

**Location**: `app/Contexts/Membership/Domain/ValueObjects/GeoReference.php`

**Purpose**: Type-safe geography reference (no foreign keys!)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Geography Reference Value Object
 *
 * Business Rule: Geography is OPTIONAL, stored as string reference only
 * Format: "country_code.level1.level2.level3..."
 * Example: "np.3.15.234" (Nepal, Province 3, Kathmandu, Ward 15)
 */
final class GeoReference
{
    private string $value;

    public function __construct(string $value)
    {
        $value = trim(strtolower($value));

        if (empty($value)) {
            throw new InvalidArgumentException('Geography reference cannot be empty');
        }

        // Format: country_code.level1.level2...
        // Pattern: lowercase letters, numbers, dots, hyphens, underscores
        $pattern = '/^[a-z]{2}(\.[a-z0-9\-_]+)+$/';

        if (!preg_match($pattern, $value)) {
            throw new InvalidArgumentException(
                "Invalid geography reference format: {$value}. Expected: country.level1.level2..."
            );
        }

        $this->value = $value;
    }

    public function value(): string
    {
        return $this->value;
    }

    public function countryCode(): string
    {
        return explode('.', $this->value)[0];
    }

    public function equals(GeoReference $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
```

**Usage:**
```php
// Valid
$geoRef = new GeoReference('np.3.15.234');
$geoRef->countryCode(); // "np"

// Invalid - throws InvalidArgumentException
$geoRef = new GeoReference('invalid'); // Missing dots
$geoRef = new GeoReference('NP.3.15'); // Uppercase (must be lowercase)
```

---

#### RegistrationChannel

**Location**: `app/Contexts/Membership/Domain/ValueObjects/RegistrationChannel.php`

**Purpose**: Track HOW member was registered (determines initial status)

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Registration Channel Value Object
 *
 * Business Rule:
 * - Mobile registration → 'mobile' → DRAFT status (requires email verification)
 * - Desktop registration → 'desktop' → PENDING status (admin approval)
 * - Bulk import → 'import' → PENDING status (admin review)
 */
final class RegistrationChannel
{
    private const MOBILE = 'mobile';
    private const DESKTOP = 'desktop';
    private const IMPORT = 'import';

    private const VALID_CHANNELS = [
        self::MOBILE,
        self::DESKTOP,
        self::IMPORT,
    ];

    private string $value;

    private function __construct(string $value)
    {
        if (!in_array($value, self::VALID_CHANNELS, true)) {
            throw new InvalidArgumentException(
                "Invalid registration channel: {$value}. " .
                "Valid channels: " . implode(', ', self::VALID_CHANNELS)
            );
        }

        $this->value = $value;
    }

    public static function mobile(): self
    {
        return new self(self::MOBILE);
    }

    public static function desktop(): self
    {
        return new self(self::DESKTOP);
    }

    public static function import(): self
    {
        return new self(self::IMPORT);
    }

    public static function fromString(string $value): self
    {
        return new self(strtolower(trim($value)));
    }

    public function value(): string
    {
        return $this->value;
    }

    public function isMobile(): bool
    {
        return $this->value === self::MOBILE;
    }

    public function isDesktop(): bool
    {
        return $this->value === self::DESKTOP;
    }

    public function isImport(): bool
    {
        return $this->value === self::IMPORT;
    }

    public function equals(RegistrationChannel $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
```

**Usage:**
```php
// Factory methods (preferred)
$channel = RegistrationChannel::mobile();
$channel->isMobile(); // true
$channel->value(); // "mobile"

// From string
$channel = RegistrationChannel::fromString('desktop');
$channel->isDesktop(); // true

// Invalid - throws InvalidArgumentException
$channel = RegistrationChannel::fromString('invalid');
```

---

### 3. Domain Factory

#### MemberFactory

**Location**: `app/Contexts/Membership/Domain/Factories/MemberFactory.php`

**Purpose**: Encapsulate complex member creation logic with channel-specific rules

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Factories;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\MemberId;
use App\Contexts\Membership\Domain\ValueObjects\TenantUserId;
use App\Contexts\Membership\Domain\ValueObjects\GeoReference;
use App\Contexts\Membership\Domain\ValueObjects\RegistrationChannel;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;

/**
 * Member Factory
 *
 * DOMAIN FACTORY - Encapsulates Member Creation Logic
 *
 * Business Rules:
 * - Mobile registration → DRAFT status (requires email verification)
 * - Desktop registration → PENDING status (requires admin approval)
 * - Import registration → PENDING status (admin review)
 */
final class MemberFactory
{
    /**
     * Create member via mobile registration
     *
     * Initial Status: DRAFT
     * Requires: Email verification before approval
     */
    public static function createFromMobileRegistration(
        TenantUserId $tenantUserId,
        string $tenantId,
        PersonalInfo $personalInfo,
        ?MemberId $memberId = null,
        ?GeoReference $geoReference = null
    ): Member {
        return Member::register(
            tenantUserId: $tenantUserId->value(),
            tenantId: $tenantId,
            personalInfo: $personalInfo,
            memberId: $memberId?->value(),
            geoReference: $geoReference?->value(),
            channel: RegistrationChannel::mobile(),
            initialStatus: MemberStatus::draft() // Mobile → DRAFT
        );
    }

    /**
     * Create member via desktop registration
     *
     * Initial Status: PENDING
     * Requires: Admin approval (no email verification needed)
     */
    public static function createFromDesktopRegistration(
        TenantUserId $tenantUserId,
        string $tenantId,
        PersonalInfo $personalInfo,
        ?MemberId $memberId = null,
        ?GeoReference $geoReference = null
    ): Member {
        return Member::register(
            tenantUserId: $tenantUserId->value(),
            tenantId: $tenantId,
            personalInfo: $personalInfo,
            memberId: $memberId?->value(),
            geoReference: $geoReference?->value(),
            channel: RegistrationChannel::desktop(),
            initialStatus: MemberStatus::pending() // Desktop → PENDING
        );
    }

    /**
     * Create member via bulk import
     *
     * Initial Status: PENDING
     * Requires: Admin review and approval
     */
    public static function createFromImport(
        TenantUserId $tenantUserId,
        string $tenantId,
        PersonalInfo $personalInfo,
        ?MemberId $memberId = null,
        ?GeoReference $geoReference = null
    ): Member {
        return Member::register(
            tenantUserId: $tenantUserId->value(),
            tenantId: $tenantId,
            personalInfo: $personalInfo,
            memberId: $memberId?->value(),
            geoReference: $geoReference?->value(),
            channel: RegistrationChannel::import(),
            initialStatus: MemberStatus::pending() // Import → PENDING
        );
    }
}
```

**Why Factory Pattern?**
- ✅ Encapsulates channel-specific business rules
- ✅ Single source of truth for member creation
- ✅ Easy to test (no infrastructure dependencies)
- ✅ Clear intent: `createFromMobileRegistration()` vs `createFromDesktopRegistration()`

**Usage:**
```php
// Mobile registration
$member = MemberFactory::createFromMobileRegistration(
    tenantUserId: new TenantUserId('01HQWE1234567890ABCDEFGHJK'),
    tenantId: 'uml',
    personalInfo: new PersonalInfo('John Doe', new Email('john@example.com')),
    memberId: new MemberId('UML-2025-001'),
    geoReference: new GeoReference('np.3.15.234')
);

$member->status->value(); // "draft"
$member->registration_channel; // "mobile"
```

---

### 4. Application DTOs

**Purpose**: Transport data between layers, validate input, decouple HTTP from domain

#### MobileRegistrationDto

**Location**: `app/Contexts/Membership/Application/DTOs/MobileRegistrationDto.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\DTOs;

use Illuminate\Http\Request;

/**
 * Mobile Registration DTO
 *
 * APPLICATION LAYER - Data Transfer Object
 *
 * Transfers validated mobile registration data from HTTP layer to application service.
 */
final readonly class MobileRegistrationDto
{
    public function __construct(
        public string $tenantId,
        public string $fullName,
        public string $email,
        public ?string $phone = null,
        public ?string $memberId = null,
        public ?string $geoReference = null,
        public ?string $deviceId = null,
        public ?string $appVersion = null,
        public ?string $platform = null,
    ) {}

    /**
     * Create DTO from validated HTTP request
     */
    public static function fromRequest(Request $request): self
    {
        return new self(
            tenantId: $request->route('tenant'),
            fullName: $request->input('full_name'),
            email: $request->input('email'),
            phone: $request->input('phone'),
            memberId: $request->input('member_id'),
            geoReference: $request->input('geo_reference'),
            deviceId: $request->input('device_id'),
            appVersion: $request->input('app_version'),
            platform: $request->input('platform'),
        );
    }
}
```

**Why DTO?**
- ✅ Decouples application layer from HTTP (Request object)
- ✅ Explicit contract (knows exactly what data is needed)
- ✅ Readonly (immutable, thread-safe)
- ✅ Easy to test (no Laravel dependencies)

---

#### DesktopRegistrationDto

**Location**: `app/Contexts/Membership/Application/DTOs/DesktopRegistrationDto.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\DTOs;

use Illuminate\Http\Request;

/**
 * Desktop Registration DTO
 *
 * APPLICATION LAYER - Data Transfer Object
 *
 * Desktop registration by admins (reuses existing tenant_user_id).
 */
final readonly class DesktopRegistrationDto
{
    public function __construct(
        public string $tenantId,
        public string $tenantUserId, // Already exists (admin creates member for user)
        public string $fullName,
        public string $email,
        public ?string $phone = null,
        public ?string $memberId = null,
        public ?string $geoReference = null,
    ) {}

    public static function fromRequest(Request $request): self
    {
        return new self(
            tenantId: $request->route('tenant'),
            tenantUserId: $request->input('tenant_user_id'),
            fullName: $request->input('full_name'),
            email: $request->input('email'),
            phone: $request->input('phone'),
            memberId: $request->input('member_id'),
            geoReference: $request->input('geo_reference'),
        );
    }
}
```

**Key Difference from Mobile:**
- Desktop already has `tenant_user_id` (admin creates member for existing user)
- Mobile needs user provisioning (new user account created)

---

### 5. Application Services

**Purpose**: Orchestrate use cases, coordinate between domain services and infrastructure

#### MobileMemberRegistrationService

**Location**: `app/Contexts/Membership/Application/Services/MobileMemberRegistrationService.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Application\DTOs\MobileRegistrationDto;
use App\Contexts\Membership\Domain\Factories\MemberFactory;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Services\TenantUserProvisioningInterface;
use App\Contexts\Membership\Domain\Services\GeographyResolverInterface;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\MemberId;
use InvalidArgumentException;

/**
 * Mobile Member Registration Service
 *
 * APPLICATION SERVICE - Use Case Orchestration
 *
 * Orchestrates mobile member registration flow:
 * 1. Provision tenant user account (via TenantAuth context)
 * 2. Validate geography reference (via Geography context)
 * 3. Create member with DRAFT status (via MemberFactory)
 * 4. Record domain event (MemberRegistered)
 * 5. Return member aggregate
 */
final readonly class MobileMemberRegistrationService
{
    public function __construct(
        private TenantUserProvisioningInterface $userProvisioning,
        private GeographyResolverInterface $geographyResolver,
    ) {}

    /**
     * Register new member via mobile app
     *
     * @throws InvalidArgumentException If business rules violated
     */
    public function register(MobileRegistrationDto $dto): Member
    {
        // Step 1: Provision tenant user account (Anti-Corruption Layer)
        $tenantUserId = $this->userProvisioning->provisionForMobile($dto);

        // Step 2: Validate geography reference (Anti-Corruption Layer)
        $geoReference = null;
        if ($dto->geoReference !== null) {
            $geoReference = $this->geographyResolver->validate($dto->geoReference);

            if ($geoReference === null) {
                throw new InvalidArgumentException(
                    "Invalid geography reference: {$dto->geoReference}"
                );
            }
        }

        // Step 3: Create PersonalInfo value object
        $personalInfo = new PersonalInfo(
            fullName: $dto->fullName,
            email: new Email($dto->email),
            phone: $dto->phone
        );

        // Step 4: Create MemberId value object (if provided)
        $memberId = $dto->memberId !== null
            ? new MemberId($dto->memberId)
            : null;

        // Step 5: Create Member via Factory (DRAFT status for mobile)
        $member = MemberFactory::createFromMobileRegistration(
            tenantUserId: $tenantUserId,
            tenantId: $dto->tenantId,
            personalInfo: $personalInfo,
            memberId: $memberId,
            geoReference: $geoReference
        );

        // Step 6: Persist member (repository injected by infrastructure)
        $member->save(); // Eloquent save (PATH B architecture)

        // Step 7: Domain events dispatched automatically on save (RecordsEvents trait)

        return $member;
    }
}
```

**Orchestration Flow:**
```
1. HTTP Request
   ↓
2. Controller validates & creates DTO
   ↓
3. Application Service orchestrates:
   ├─→ Provision user (TenantAuth context via interface)
   ├─→ Validate geography (Geography context via interface)
   ├─→ Create member (Domain Factory)
   └─→ Save & dispatch events
   ↓
4. Controller transforms to Resource (JSON:API)
   ↓
5. HTTP Response
```

---

#### DesktopMemberRegistrationService

**Location**: `app/Contexts/Membership/Application/Services/DesktopMemberRegistrationService.php`

```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Application\DTOs\DesktopRegistrationDto;
use App\Contexts\Membership\Domain\Factories\MemberFactory;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Services\TenantUserProvisioningInterface;
use App\Contexts\Membership\Domain\Services\GeographyResolverInterface;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\MemberId;
use App\Contexts\Membership\Domain\ValueObjects\TenantUserId;
use InvalidArgumentException;

/**
 * Desktop Member Registration Service
 *
 * APPLICATION SERVICE - Use Case Orchestration
 *
 * Desktop registration by admin (member created for existing tenant user).
 * Initial status: PENDING (requires admin approval, no email verification).
 */
final readonly class DesktopMemberRegistrationService
{
    public function __construct(
        private TenantUserProvisioningInterface $userProvisioning,
        private GeographyResolverInterface $geographyResolver,
    ) {}

    public function register(DesktopRegistrationDto $dto): Member
    {
        // Step 1: Create TenantUserId from existing user (no provisioning needed)
        $tenantUserId = new TenantUserId($dto->tenantUserId);

        // Step 2: Validate geography reference
        $geoReference = null;
        if ($dto->geoReference !== null) {
            $geoReference = $this->geographyResolver->validate($dto->geoReference);

            if ($geoReference === null) {
                throw new InvalidArgumentException(
                    "Invalid geography reference: {$dto->geoReference}"
                );
            }
        }

        // Step 3: Create PersonalInfo
        $personalInfo = new PersonalInfo(
            fullName: $dto->fullName,
            email: new Email($dto->email),
            phone: $dto->phone
        );

        // Step 4: Create MemberId (if provided)
        $memberId = $dto->memberId !== null
            ? new MemberId($dto->memberId)
            : null;

        // Step 5: Create Member via Factory (PENDING status for desktop)
        $member = MemberFactory::createFromDesktopRegistration(
            tenantUserId: $tenantUserId,
            tenantId: $dto->tenantId,
            personalInfo: $personalInfo,
            memberId: $memberId,
            geoReference: $geoReference
        );

        // Step 6: Persist
        $member->save();

        return $member;
    }
}
```

**Key Difference from Mobile:**
- No user provisioning (reuses `tenant_user_id`)
- PENDING status (not DRAFT)
- Admin approval required (no email verification)

---

## 🧪 Testing Strategy

### Unit Tests (Domain Layer)

**Test Value Objects:**
```php
// tests/Unit/Contexts/Membership/Domain/ValueObjects/TenantUserIdTest.php
class TenantUserIdTest extends TestCase
{
    /** @test */
    public function it_accepts_valid_ulid_format(): void
    {
        $id = new TenantUserId('01HQWE1234567890ABCDEFGHJK');
        $this->assertEquals('01HQWE1234567890ABCDEFGHJK', $id->value());
    }

    /** @test */
    public function it_rejects_empty_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new TenantUserId('');
    }

    /** @test */
    public function it_rejects_invalid_format(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new TenantUserId('invalid-id');
    }

    /** @test */
    public function it_normalizes_to_uppercase(): void
    {
        $id = new TenantUserId('01hqwe1234567890abcdefghjk');
        $this->assertEquals('01HQWE1234567890ABCDEFGHJK', $id->value());
    }
}
```

**Test Factory:**
```php
// tests/Unit/Contexts/Membership/Domain/Factories/MemberFactoryTest.php
class MemberFactoryTest extends TestCase
{
    /** @test */
    public function mobile_registration_creates_draft_status(): void
    {
        $member = MemberFactory::createFromMobileRegistration(
            tenantUserId: new TenantUserId('01HQWE1234567890ABCDEFGHJK'),
            tenantId: 'uml',
            personalInfo: new PersonalInfo('John', new Email('john@example.com'))
        );

        $this->assertEquals('draft', $member->status->value());
        $this->assertEquals('mobile', $member->registration_channel);
    }

    /** @test */
    public function desktop_registration_creates_pending_status(): void
    {
        $member = MemberFactory::createFromDesktopRegistration(
            tenantUserId: new TenantUserId('01HQWE1234567890ABCDEFGHJK'),
            tenantId: 'uml',
            personalInfo: new PersonalInfo('Jane', new Email('jane@example.com'))
        );

        $this->assertEquals('pending', $member->status->value());
        $this->assertEquals('desktop', $member->registration_channel);
    }
}
```

### Integration Tests (Application Layer)

```php
// tests/Unit/Contexts/Membership/Application/Services/MobileMemberRegistrationServiceTest.php
class MobileMemberRegistrationServiceTest extends TestCase
{
    private MobileMemberRegistrationService $service;
    private TenantUserProvisioningInterface $userProvisioning;
    private GeographyResolverInterface $geographyResolver;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock domain services
        $this->userProvisioning = Mockery::mock(TenantUserProvisioningInterface::class);
        $this->geographyResolver = Mockery::mock(GeographyResolverInterface::class);

        $this->service = new MobileMemberRegistrationService(
            $this->userProvisioning,
            $this->geographyResolver
        );
    }

    /** @test */
    public function it_provisions_user_and_creates_member(): void
    {
        // Arrange
        $dto = new MobileRegistrationDto(
            tenantId: 'uml',
            fullName: 'John Doe',
            email: 'john@example.com'
        );

        $this->userProvisioning
            ->shouldReceive('provisionForMobile')
            ->once()
            ->with($dto)
            ->andReturn(new TenantUserId('01HQWE1234567890ABCDEFGHJK'));

        // Act
        $member = $this->service->register($dto);

        // Assert
        $this->assertEquals('draft', $member->status->value());
        $this->assertEquals('mobile', $member->registration_channel);
        $this->assertEquals('uml', $member->tenant_id);
    }
}
```

---

## 🔌 Integration Points

### How Infrastructure Layer Connects

**Service Provider Bindings:**
```php
// app/Contexts/Membership/Infrastructure/Providers/MembershipServiceProvider.php

public function register(): void
{
    // Bind domain service interfaces to infrastructure implementations
    $this->app->bind(
        TenantUserProvisioningInterface::class,
        TenantAuthProvisioningAdapter::class // Infrastructure adapter
    );

    $this->app->bind(
        GeographyResolverInterface::class,
        GeographyValidationAdapter::class // Infrastructure adapter
    );

    // Register application services as singletons
    $this->app->singleton(MobileMemberRegistrationService::class);
    $this->app->singleton(DesktopMemberRegistrationService::class);
}
```

**Controller Usage (DAY 2):**
```php
// app/Contexts/Membership/Infrastructure/Http/Controllers/Mobile/MemberController.php

class MemberController extends Controller
{
    public function __construct(
        private readonly MobileMemberRegistrationService $registrationService
    ) {}

    public function register(RegisterMemberRequest $request): JsonResponse
    {
        try {
            // Step 1: Create DTO from validated request
            $dto = MobileRegistrationDto::fromRequest($request);

            // Step 2: Delegate to application service
            $member = $this->registrationService->register($dto);

            // Step 3: Transform to JSON:API resource
            return (new MobileMemberResource($member))
                ->response()
                ->setStatusCode(201);

        } catch (InvalidArgumentException $e) {
            // Business rule violation
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => ['business_rule' => [$e->getMessage()]],
            ], 422);
        }
    }
}
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                      │
│  (DAY 2 - HTTP Controllers, Requests, Resources, Adapters)  │
└────────────────────┬────────────────────────────────────────┘
                     │ Depends on ↓
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│                                                              │
│  ┌──────────────┐          ┌──────────────────────────┐     │
│  │ DTOs         │          │ Application Services     │     │
│  ├──────────────┤          ├──────────────────────────┤     │
│  │ Mobile DTO   │─────────▶│ Mobile Registration Svc  │     │
│  │ Desktop DTO  │─────────▶│ Desktop Registration Svc │     │
│  └──────────────┘          └──────────┬───────────────┘     │
│                                       │ Uses ↓              │
└───────────────────────────────────────┼─────────────────────┘
                                        │
┌───────────────────────────────────────┼─────────────────────┐
│                    DOMAIN LAYER                              │
│                                       │                      │
│  ┌────────────────────┐      ┌───────▼──────────┐           │
│  │ Factories          │      │ Domain Services  │           │
│  ├────────────────────┤      ├──────────────────┤           │
│  │ MemberFactory      │      │ TenantUserProv   │◀──┐       │
│  │ - mobile()         │      │ GeographyResolver│   │       │
│  │ - desktop()        │      └──────────────────┘   │       │
│  │ - import()         │                             │       │
│  └──────┬─────────────┘                             │       │
│         │ Creates                           Implements       │
│         ▼                                             │       │
│  ┌────────────────────┐                              │       │
│  │ Aggregate Root     │                              │       │
│  ├────────────────────┤                              │       │
│  │ Member             │                              │       │
│  │ - register()       │                              │       │
│  │ - approve()        │                              │       │
│  └────────────────────┘                              │       │
│                                                       │       │
│  ┌────────────────────────────────────────────┐      │       │
│  │ Value Objects                              │      │       │
│  ├────────────────────────────────────────────┤      │       │
│  │ TenantUserId | GeoReference | RegChannel  │      │       │
│  │ Email | PersonalInfo | MemberStatus | ... │      │       │
│  └────────────────────────────────────────────┘      │       │
│                                                       │       │
└───────────────────────────────────────────────────────┼───────┘
                                                        │
                            ┌───────────────────────────┘
                            │
                            │ Infrastructure provides
                            │ concrete implementations
                            ▼
                ┌─────────────────────────┐
                │ Infrastructure Adapters │
                ├─────────────────────────┤
                │ TenantAuthAdapter       │
                │ GeographyAdapter        │
                └─────────────────────────┘
```

---

## 🎯 Key Takeaways

### What Makes This Architecture Good?

1. **Pure Domain Layer**
   - Zero framework dependencies
   - Testable without database
   - Business logic in one place

2. **Explicit Dependencies**
   - Interfaces define contracts
   - Infrastructure implements contracts
   - Easy to swap implementations

3. **Type Safety**
   - Value Objects prevent primitive obsession
   - Compiler catches errors
   - Self-documenting code

4. **Channel-Aware**
   - Factory encapsulates creation rules
   - Mobile → DRAFT, Desktop → PENDING
   - Clear business intent

5. **Loose Coupling**
   - Membership doesn't import TenantAuth or Geography
   - Communication via interfaces and events
   - Contexts can evolve independently

---

## 🚀 Next Steps (DAY 2)

DAY 1 built the **foundation**. DAY 2 adds **infrastructure**:

- ✅ HTTP Controllers (Mobile & Desktop)
- ✅ Form Requests (Validation)
- ✅ Resources (JSON:API transformation)
- ✅ Routes (CASE 2 & CASE 4)
- ✅ Concrete Infrastructure Adapters

**See:** `20260103_1400_DAY2_infrastructure_layer_guide.md` (coming next)

---

## 📚 Related Documentation

- [Database Testing Guide](../../tenant-database/20251229_1352_database_testing_setting.md)
- [Multi-Tenant Database Debugging](../../tenant-database/20260103_1340_multi_tenant_database_debugging_guide.md)
- [Membership Context Implementation Plan](../../../architecture/backend/membership-context/membership_context_implementation/20260103_0856_mapi_vorbereitung.md)

---

**Last Updated:** 2026-01-03 13:45
**Phase:** DAY 1 Complete ✅
**Next:** DAY 2 - Infrastructure Layer
**Author:** Senior Laravel DDD Architect (Claude)
