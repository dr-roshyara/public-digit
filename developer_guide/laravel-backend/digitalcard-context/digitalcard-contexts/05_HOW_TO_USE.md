# How to Use - DigitalCard Context

**Version:** Phase 1.3
**Target Audience:** Backend Developers
**Prerequisites:** Understanding of Hexagonal Architecture

---

## Quick Start

The DigitalCard Context provides **3 core operations**:

1. **Issue Card** - Create a new digital card for a member
2. **Activate Card** - Mark a card as active
3. **Revoke Card** - Revoke a card with a reason

---

## Setup & Configuration

### 1. Verify ServiceProvider Registration

Check that `DigitalCardServiceProvider` is registered in `config/app.php`:

```php
'providers' => ServiceProvider::defaultProviders()->merge([
    // ... other providers

    App\Providers\DigitalCardServiceProvider::class,

])->toArray(),
```

### 2. Configure ModuleRegistry URL

Set the ModuleRegistry URL in `.env`:

```env
MODULE_REGISTRY_URL=http://module-registry.test
```

Or override in `config/services.php`:

```php
'module_registry' => [
    'url' => env('MODULE_REGISTRY_URL', 'http://module-registry.test'),
],
```

### 3. Verify Tenant Context

Ensure Spatie multi-tenancy is configured and middleware is applied:

```php
// routes/tenant.php or routes/web.php
Route::middleware(['web', 'identify.tenant'])->group(function () {
    // Your routes here
});
```

---

## Operation 1: Issuing Digital Cards

### Use Case

Create a new digital card for a member. This generates:
- Unique card ID
- QR code for the card
- Issued timestamp
- Card metadata

### Requirements

1. **Tenant context must be active**
2. **Tenant must have subscription** (Phase 1.3)
3. **Tenant must be within quota** (Phase 1.3)

### Handler Invocation

**From a Controller:**

```php
<?php

namespace App\Http\Controllers\Tenant;

use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;
use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use Illuminate\Http\JsonResponse;

class DigitalCardController extends Controller
{
    public function __construct(
        private readonly IssueCardHandler $handler
    ) {}

    public function issue(Request $request): JsonResponse
    {
        // 1. Validate input
        $validated = $request->validate([
            'member_id' => 'required|string',
            'full_name' => 'required|string|max:255',
            'photo_url' => 'nullable|url',
        ]);

        // 2. Create command
        $command = new IssueCardCommand(
            memberId: $validated['member_id'],
            fullName: $validated['full_name'],
            email: $request->input('email'),
            phone: $request->input('phone'),
            photoUrl: $validated['photo_url'] ?? null,
        );

        // 3. Handle command
        try {
            $cardDTO = $this->handler->handle($command);

            return response()->json([
                'success' => true,
                'data' => [
                    'card_id' => $cardDTO->cardId,
                    'member_id' => $cardDTO->memberId,
                    'qr_code' => $cardDTO->qrCode,
                    'status' => $cardDTO->status,
                    'issued_at' => $cardDTO->issuedAt->format('Y-m-d H:i:s'),
                ],
            ], 201);

        } catch (\App\Contexts\DigitalCard\Domain\Exceptions\SubscriptionRequiredException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Subscription required: ' . $e->getMessage(),
            ], 403);

        } catch (\App\Contexts\DigitalCard\Domain\Exceptions\QuotaExceededException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Quota exceeded: ' . $e->getMessage(),
            ], 429);
        }
    }
}
```

### Command Parameters

```php
new IssueCardCommand(
    memberId: string,      // Required: Member identifier
    fullName: string,      // Required: Member full name
    email: ?string,        // Optional: Email address
    phone: ?string,        // Optional: Phone number
    photoUrl: ?string,     // Optional: Profile photo URL
    cardId: ?string,       // Optional: Custom card ID (usually null)
);
```

**Important:**
- Leave `cardId` null to auto-generate UUID
- `memberId` should be unique per member
- `photoUrl` is optional but recommended

### Response (CardDTO)

```php
class CardDTO
{
    public string $cardId;
    public string $memberId;
    public string $tenantId;
    public string $fullName;
    public ?string $email;
    public ?string $phone;
    public ?string $photoUrl;
    public string $qrCode;           // Base64 PNG data
    public string $status;           // 'issued', 'active', 'revoked'
    public DateTimeImmutable $issuedAt;
    public ?DateTimeImmutable $activatedAt;
    public ?DateTimeImmutable $revokedAt;
}
```

### Example Request/Response

**Request:**
```json
POST /api/digital-cards
{
  "member_id": "M12345",
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "photo_url": "https://example.com/photos/john.jpg"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "card_id": "a3f2e7d8-9c4b-4d5f-8e6a-1b2c3d4e5f6g",
    "member_id": "M12345",
    "qr_code": "iVBORw0KGgoAAAANSUhEUg...",
    "status": "issued",
    "issued_at": "2025-12-27 10:30:00"
  }
}
```

**Response (No Subscription):**
```json
{
  "success": false,
  "error": "Subscription required: No active subscription for digital_card module"
}
```

**Response (Quota Exceeded):**
```json
{
  "success": false,
  "error": "Quota exceeded: Card limit reached (100/100)"
}
```

---

## Operation 2: Activating Digital Cards

### Use Case

Mark a card as "active". Typically done after:
- Card is issued
- Member verification complete
- Payment processed (if applicable)

### Requirements

1. **Card must exist**
2. **Card must be in 'issued' status**
3. **Tenant must have subscription**
4. **Caller must have tenant access**

### Handler Invocation

**From a Controller:**

```php
<?php

namespace App\Http\Controllers\Tenant;

use App\Contexts\DigitalCard\Application\Handlers\ActivateCardHandler;
use App\Contexts\DigitalCard\Application\Commands\ActivateCardCommand;
use Illuminate\Http\JsonResponse;

class DigitalCardController extends Controller
{
    public function activate(string $cardId, ActivateCardHandler $handler): JsonResponse
    {
        // 1. Get tenant ID from context
        $tenantId = tenant()->id; // Spatie helper

        // 2. Create command
        $command = new ActivateCardCommand(
            cardId: $cardId,
            tenantId: $tenantId,
        );

        // 3. Handle command
        try {
            $handler->handle($command);

            return response()->json([
                'success' => true,
                'message' => 'Card activated successfully',
            ]);

        } catch (\App\Contexts\DigitalCard\Domain\Exceptions\CardNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Card not found',
            ], 404);

        } catch (\App\Contexts\DigitalCard\Domain\Exceptions\CardAlreadyActivatedException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Card already activated',
            ], 400);

        } catch (\App\Contexts\DigitalCard\Domain\Exceptions\CardRevokedException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Cannot activate revoked card',
            ], 400);
        }
    }
}
```

### Command Parameters

```php
new ActivateCardCommand(
    cardId: string,    // Required: Card identifier
    tenantId: string,  // Required: Tenant identifier (for isolation)
);
```

### Example Request/Response

**Request:**
```json
POST /api/digital-cards/a3f2e7d8-9c4b-4d5f-8e6a-1b2c3d4e5f6g/activate
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Card activated successfully"
}
```

**Response (Already Active):**
```json
{
  "success": false,
  "error": "Card already activated"
}
```

---

## Operation 3: Revoking Digital Cards

### Use Case

Revoke a card with a specific reason. Common reasons:
- Member left organization
- Card lost or stolen
- Policy violation
- Membership expired

### Requirements

1. **Card must exist**
2. **Card must not already be revoked**
3. **Tenant must have subscription**
4. **Caller must have tenant access**

### Handler Invocation

**From a Controller:**

```php
<?php

namespace App\Http\Controllers\Tenant;

use App\Contexts\DigitalCard\Application\Handlers\RevokeCardHandler;
use App\Contexts\DigitalCard\Application\Commands\RevokeCardCommand;
use Illuminate\Http\JsonResponse;

class DigitalCardController extends Controller
{
    public function revoke(string $cardId, Request $request, RevokeCardHandler $handler): JsonResponse
    {
        // 1. Validate reason
        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        // 2. Get tenant ID from context
        $tenantId = tenant()->id;

        // 3. Create command
        $command = new RevokeCardCommand(
            cardId: $cardId,
            tenantId: $tenantId,
            reason: $validated['reason'],
        );

        // 4. Handle command
        try {
            $handler->handle($command);

            return response()->json([
                'success' => true,
                'message' => 'Card revoked successfully',
            ]);

        } catch (\App\Contexts\DigitalCard\Domain\Exceptions\CardNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Card not found',
            ], 404);

        } catch (\App\Contexts\DigitalCard\Domain\Exceptions\CardAlreadyRevokedException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Card already revoked',
            ], 400);
        }
    }
}
```

### Command Parameters

```php
new RevokeCardCommand(
    cardId: string,    // Required: Card identifier
    tenantId: string,  // Required: Tenant identifier (for isolation)
    reason: string,    // Required: Revocation reason
);
```

### Example Request/Response

**Request:**
```json
POST /api/digital-cards/a3f2e7d8-9c4b-4d5f-8e6a-1b2c3d4e5f6g/revoke
{
  "reason": "Member left organization"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Card revoked successfully"
}
```

**Response (Already Revoked):**
```json
{
  "success": false,
  "error": "Card already revoked"
}
```

---

## Event Handling

All operations publish domain events that you can listen to.

### Listening to CardIssued Event

```php
<?php

namespace App\Listeners;

use App\Contexts\DigitalCard\Domain\Events\CardIssued;
use Illuminate\Support\Facades\Log;

class SendCardIssuedNotification
{
    public function handle(CardIssued $event): void
    {
        Log::info('Card issued', [
            'card_id' => $event->cardId,
            'member_id' => $event->memberId,
            'tenant_id' => $event->tenantId,
        ]);

        // Send email notification
        // Send SMS notification
        // Update analytics
    }
}
```

**Register in EventServiceProvider:**

```php
use App\Contexts\DigitalCard\Domain\Events\CardIssued;
use App\Listeners\SendCardIssuedNotification;

protected $listen = [
    CardIssued::class => [
        SendCardIssuedNotification::class,
    ],
];
```

### Available Events

1. **CardIssued** - Published after card issuance
   ```php
   $event->cardId
   $event->memberId
   $event->tenantId
   $event->issuedAt
   ```

2. **CardActivated** - Published after card activation
   ```php
   $event->cardId
   $event->tenantId
   $event->activatedAt
   ```

3. **CardRevoked** - Published after card revocation
   ```php
   $event->cardId
   $event->tenantId
   $event->reason
   $event->revokedAt
   ```

---

## Complete Controller Example

```php
<?php

namespace App\Http\Controllers\Tenant;

use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;
use App\Contexts\DigitalCard\Application\Handlers\ActivateCardHandler;
use App\Contexts\DigitalCard\Application\Handlers\RevokeCardHandler;
use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use App\Contexts\DigitalCard\Application\Commands\ActivateCardCommand;
use App\Contexts\DigitalCard\Application\Commands\RevokeCardCommand;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DigitalCardController extends Controller
{
    public function __construct(
        private readonly IssueCardHandler $issueHandler,
        private readonly ActivateCardHandler $activateHandler,
        private readonly RevokeCardHandler $revokeHandler,
    ) {}

    /**
     * Issue a new digital card
     */
    public function issue(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'member_id' => 'required|string',
            'full_name' => 'required|string|max:255',
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'photo_url' => 'nullable|url',
        ]);

        $command = new IssueCardCommand(
            memberId: $validated['member_id'],
            fullName: $validated['full_name'],
            email: $validated['email'] ?? null,
            phone: $validated['phone'] ?? null,
            photoUrl: $validated['photo_url'] ?? null,
        );

        try {
            $cardDTO = $this->issueHandler->handle($command);

            return response()->json([
                'success' => true,
                'data' => $cardDTO,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], $this->getStatusCode($e));
        }
    }

    /**
     * Activate a digital card
     */
    public function activate(string $cardId): JsonResponse
    {
        $command = new ActivateCardCommand(
            cardId: $cardId,
            tenantId: tenant()->id,
        );

        try {
            $this->activateHandler->handle($command);

            return response()->json([
                'success' => true,
                'message' => 'Card activated',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], $this->getStatusCode($e));
        }
    }

    /**
     * Revoke a digital card
     */
    public function revoke(string $cardId, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $command = new RevokeCardCommand(
            cardId: $cardId,
            tenantId: tenant()->id,
            reason: $validated['reason'],
        );

        try {
            $this->revokeHandler->handle($command);

            return response()->json([
                'success' => true,
                'message' => 'Card revoked',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], $this->getStatusCode($e));
        }
    }

    /**
     * Map exceptions to HTTP status codes
     */
    private function getStatusCode(\Exception $e): int
    {
        return match (true) {
            $e instanceof \App\Contexts\DigitalCard\Domain\Exceptions\CardNotFoundException => 404,
            $e instanceof \App\Contexts\DigitalCard\Domain\Exceptions\SubscriptionRequiredException => 403,
            $e instanceof \App\Contexts\DigitalCard\Domain\Exceptions\QuotaExceededException => 429,
            default => 400,
        };
    }
}
```

---

## Routing Example

```php
<?php

// routes/tenant.php (or routes/web.php with tenant middleware)

use App\Http\Controllers\Tenant\DigitalCardController;

Route::middleware(['web', 'identify.tenant', 'auth'])->group(function () {

    Route::prefix('digital-cards')->name('digital-cards.')->group(function () {

        // Issue card
        Route::post('/', [DigitalCardController::class, 'issue'])
            ->name('issue');

        // Activate card
        Route::post('/{cardId}/activate', [DigitalCardController::class, 'activate'])
            ->name('activate');

        // Revoke card
        Route::post('/{cardId}/revoke', [DigitalCardController::class, 'revoke'])
            ->name('revoke');
    });

});
```

---

## Testing Your Integration

### Using Fakes (Recommended)

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;
use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use App\Contexts\DigitalCard\Infrastructure\Testing\FakeClock;
use App\Contexts\DigitalCard\Infrastructure\Testing\FakeIdGenerator;
use App\Contexts\DigitalCard\Infrastructure\Testing\FakeQRCodeGenerator;
use App\Contexts\DigitalCard\Infrastructure\Testing\FakeModuleAccess;
use App\Contexts\DigitalCard\Infrastructure\Testing\FakeTenantContext;
use App\Contexts\DigitalCard\Infrastructure\Testing\FakeEventPublisher;

class DigitalCardIntegrationTest extends TestCase
{
    public function test_issue_card_integration(): void
    {
        // 1. Setup fakes
        $clock = new FakeClock();
        $idGenerator = new FakeIdGenerator();
        $qrGenerator = new FakeQRCodeGenerator();
        $moduleAccess = new FakeModuleAccess();
        $tenantContext = new FakeTenantContext();
        $eventPublisher = new FakeEventPublisher();

        // 2. Configure fakes
        $tenantContext->setTenantId('tenant-123');
        $moduleAccess->setHasSubscription(true);
        $moduleAccess->setWithinQuota(true);

        // 3. Create handler with fakes
        $repository = $this->createRepository(); // Your test repository
        $handler = new IssueCardHandler(
            $repository,
            $clock,
            $idGenerator,
            $qrGenerator,
            $moduleAccess,
            $tenantContext,
            $eventPublisher,
        );

        // 4. Execute
        $command = new IssueCardCommand(
            memberId: 'M12345',
            fullName: 'John Doe',
        );

        $cardDTO = $handler->handle($command);

        // 5. Assert
        $this->assertEquals('test-uuid', $cardDTO->cardId);
        $this->assertEquals('M12345', $cardDTO->memberId);
        $this->assertTrue($eventPublisher->wasPublished(CardIssued::class));
    }
}
```

---

## Common Issues & Solutions

See [Debugging Guide](08_DEBUGGING_GUIDE.md) for detailed troubleshooting.

**Quick Fixes:**

1. **"Tenant context required"** → Ensure `identify.tenant` middleware is applied
2. **"Subscription required"** → Check ModuleRegistry is accessible and tenant has subscription
3. **"Quota exceeded"** → Increase tenant quota or clean up old cards
4. **Card not found** → Verify card ID and tenant isolation

---

## Next Steps

- Read [Testing Guide](07_TESTING_GUIDE.md) for test strategies
- Read [Debugging Guide](08_DEBUGGING_GUIDE.md) for troubleshooting
- Read [API Reference](10_API_REFERENCE.md) for complete method signatures
