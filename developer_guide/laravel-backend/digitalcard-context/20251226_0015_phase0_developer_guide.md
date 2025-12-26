# **DigitalCard Context - Phase 0 Developer Guide**

**Date:** 2025-12-26
**Phase:** 0 (Walking Skeleton)
**Status:** Implementation Complete (Tests Pending)
**Author:** Claude Code (Senior Full-Stack Developer)

---

## **Table of Contents**

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Domain Layer](#domain-layer)
4. [Application Layer](#application-layer)
5. [Infrastructure Layer](#infrastructure-layer)
6. [API Endpoints](#api-endpoints)
7. [Database Schema](#database-schema)
8. [Testing Strategy](#testing-strategy)
9. [Usage Examples](#usage-examples)
10. [Troubleshooting](#troubleshooting)

---

## **Overview**

The **DigitalCard Context** is a bounded context responsible for managing digital membership cards within the Public Digit Platform. This Phase 0 implementation provides the minimal viable functionality to validate the full-stack architecture.

### **Phase 0 Scope**

**Goal:** Validate full-stack integration with tenant isolation

**Capabilities:**
- ✅ Issue a new digital card for a member
- ✅ Retrieve a digital card by ID
- ✅ Store QR code hash (security best practice)
- ✅ Enforce tenant database isolation
- ✅ Publish domain events

**Non-Goals (Future Phases):**
- ❌ Card activation/revocation (Phase 1)
- ❌ QR code signing/encryption (Phase 3)
- ❌ Mobile API endpoints (Phase 2)
- ❌ Card templates/customization (Phase 4)

---

## **Architecture**

### **DDD Layering**

```
┌─────────────────────────────────────────────────────────┐
│                     Presentation                         │
│  (HTTP Requests/Responses via DigitalCardController)    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                     Application                          │
│  Commands, Handlers, DTOs (Use Case Orchestration)      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                       Domain                             │
│  Entities, Value Objects, Events, Repository Interface   │
│  ⚠️ ZERO Framework Dependencies                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Infrastructure                         │
│  Eloquent Models, Concrete Repositories, Controllers     │
└─────────────────────────────────────────────────────────┘
```

### **File Structure**

```
app/Contexts/DigitalCard/
├── Domain/
│   ├── Entities/
│   │   └── DigitalCard.php              # Aggregate Root
│   ├── Enums/
│   │   └── CardStatus.php               # State machine
│   ├── ValueObjects/
│   │   ├── CardId.php                   # UUID wrapper
│   │   ├── MemberId.php                 # Anti-Corruption Layer
│   │   └── QRCode.php                   # QR code abstraction
│   ├── Events/
│   │   └── CardIssued.php               # Domain event (pure PHP)
│   └── Repositories/
│       └── DigitalCardRepositoryInterface.php
│
├── Application/
│   ├── Commands/
│   │   └── IssueCardCommand.php         # Immutable DTO
│   ├── Handlers/
│   │   └── IssueCardHandler.php         # Use case logic
│   └── DTOs/
│       └── CardDTO.php                  # Presentation DTO
│
└── Infrastructure/
    ├── Database/Migrations/
    │   └── 2025_12_26_001300_create_digital_cards_table.php
    ├── Models/
    │   └── DigitalCardModel.php         # Eloquent model
    ├── Repositories/
    │   └── EloquentDigitalCardRepository.php
    ├── Http/Controllers/
    │   └── DigitalCardController.php    # HTTP endpoint
    └── Providers/
        └── DigitalCardServiceProvider.php

routes/tenant-api/
└── digitalcard-api.php                  # Context-specific routes

tests/Feature/Contexts/DigitalCard/
└── DigitalCardWalkingSkeletonTest.php   # Integration tests
```

---

## **Domain Layer**

### **1. DigitalCard Aggregate Root**

**Location:** `app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php`

**Responsibilities:**
- Enforce business invariants (e.g., expiry after issue date)
- Encapsulate card lifecycle logic
- Publish domain events
- Prevent invalid state transitions

**Key Methods:**

```php
// Factory method - ONLY way to create a card
DigitalCard::issue(
    CardId $cardId,
    MemberId $memberId,
    QRCode $qrCode,
    DateTimeImmutable $issuedAt,
    DateTimeImmutable $expiresAt
): self

// Getters (read-only access)
$card->id(): CardId
$card->memberId(): MemberId
$card->status(): CardStatus
$card->qrCode(): QRCode
$card->issuedAt(): DateTimeImmutable
$card->expiresAt(): DateTimeImmutable

// Event sourcing
$card->releaseEvents(): array  // Get and clear domain events
```

**Business Rules Enforced:**
1. ✅ Expiry date MUST be after issue date
2. ✅ Card starts in `ISSUED` status
3. ✅ Only valid transitions allowed (via CardStatus enum)

**Example Usage:**

```php
use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;
use App\Contexts\DigitalCard\Domain\ValueObjects\{CardId, MemberId, QRCode};

// Create new card
$card = DigitalCard::issue(
    cardId: CardId::generate(),
    memberId: MemberId::fromString('550e8400-e29b-41d4-a716-446655440000'),
    qrCode: QRCode::fromCardId($cardId),
    issuedAt: new DateTimeImmutable(),
    expiresAt: new DateTimeImmutable('+1 year')
);

// Access properties
$status = $card->status(); // CardStatus::ISSUED
$expiresAt = $card->expiresAt(); // DateTimeImmutable

// Get domain events
$events = $card->releaseEvents(); // [CardIssued]
```

---

### **2. Value Objects**

#### **CardId**

**Purpose:** Type-safe UUID wrapper for card identifiers

```php
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

// Generate new ID
$cardId = CardId::generate();

// From existing UUID string
$cardId = CardId::fromString('550e8400-e29b-41d4-a716-446655440000');

// Convert to string
$uuid = $cardId->toString(); // "550e8400..."

// Compare
$isEqual = $cardId->equals($otherCardId); // bool
```

**Why?** Prevents primitive obsession, ensures UUID validity at compile time.

---

#### **MemberId**

**Purpose:** Anti-Corruption Layer for Membership Context

```php
use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

$memberId = MemberId::fromString('member-uuid-here');

// This ensures DigitalCard context doesn't depend on Membership models
```

---

#### **QRCode**

**Purpose:** QR code data abstraction with security

```php
use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

// Phase 0: Simple QR from card ID
$qrCode = QRCode::fromCardId($cardId);

// Get raw QR code data
$data = $qrCode->toString(); // "card:550e8400-..."

// Get hash for database storage (security)
$hash = $qrCode->toHash(); // SHA256 hash
```

**Security Note:** Database stores `qrcode_hash`, NOT raw QR code.

---

### **3. CardStatus Enum**

**Purpose:** Type-safe status with state machine logic

```php
use App\Contexts\DigitalCard\Domain\Enums\CardStatus;

// Available statuses (Phase 0: only ISSUED)
CardStatus::ISSUED     // Card created, not yet active
CardStatus::ACTIVE     // Phase 1+
CardStatus::REVOKED    // Phase 1+
CardStatus::EXPIRED    // Phase 1+
CardStatus::SUSPENDED  // Phase 1+

// State machine
$status = CardStatus::ISSUED;
$allowed = $status->allowedTransitions(); // [CardStatus::ACTIVE, CardStatus::REVOKED]
$canActivate = $status->canTransitionTo(CardStatus::ACTIVE); // true

// Checks
$isValid = $status->isValid(); // false (only ACTIVE is valid)
$isTerminal = $status->isTerminal(); // false (only REVOKED/EXPIRED)
```

---

### **4. CardIssued Event**

**Purpose:** Domain event published when card is created

**CRITICAL:** Pure PHP - NO Laravel dependencies!

```php
use App\Contexts\DigitalCard\Domain\Events\CardIssued;

// Event structure
new CardIssued(
    cardId: '550e8400-...',
    memberId: 'member-uuid',
    issuedAt: new DateTimeImmutable(),
    expiresAt: new DateTimeImmutable('+1 year'),
    qrCodeHash: 'sha256-hash-here'  // ⚠️ Hash, not raw QR!
);

// Convert to array (for logging)
$event->toArray();
```

**Event Flow:**
1. `DigitalCard::issue()` creates card
2. Card records `CardIssued` event internally
3. Repository calls `$card->releaseEvents()`
4. Repository dispatches to Laravel Event system
5. Listeners in Infrastructure layer can react

---

## **Application Layer**

### **IssueCardCommand**

**Purpose:** Immutable DTO representing user intent

```php
use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;

// Create from HTTP request
$command = IssueCardCommand::fromArray([
    'member_id' => '550e8400-e29b-41d4-a716-446655440000',
    'expires_at' => '2026-12-26T00:00:00+00:00',
]);

// Or construct directly
$command = new IssueCardCommand(
    memberId: '550e8400-...',
    expiresAt: new DateTimeImmutable('+1 year')
);
```

---

### **IssueCardHandler**

**Purpose:** Orchestrate the "Issue Card" use case

```php
use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;

// Dependency injection
$handler = app(IssueCardHandler::class);

// Execute use case
$cardDTO = $handler->handle($command);

// Returns CardDTO for presentation
```

**Flow:**
1. Generate `CardId` (or use provided)
2. Create `QRCode` from card ID
3. Call `DigitalCard::issue()` (domain logic)
4. Save via repository (events dispatched automatically)
5. Return `CardDTO` for HTTP response

---

### **CardDTO**

**Purpose:** Transfer data to presentation layer (JSON responses)

```php
use App\Contexts\DigitalCard\Application\DTOs\CardDTO;

// Create from domain entity
$dto = CardDTO::fromDomainEntity($card);

// Convert to array for JSON
$array = $dto->toArray();
// [
//     'id' => '550e8400-...',
//     'member_id' => 'member-uuid',
//     'status' => 'issued',
//     'qrcode' => 'card:550e8400-...',  // ⚠️ Raw QR for API only
//     'issued_at' => '2025-12-26T00:15:00+00:00',
//     'expires_at' => '2026-12-26T00:00:00+00:00',
//     ...
// ]
```

---

## **Infrastructure Layer**

### **Database Migration**

**Location:** `app/Contexts/DigitalCard/Infrastructure/Database/Migrations/2025_12_26_001300_create_digital_cards_table.php`

**Schema:**

```sql
CREATE TABLE digital_cards (
    id UUID PRIMARY KEY,
    member_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'issued',
    qrcode_hash VARCHAR(64) NOT NULL,  -- SHA256 hash
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX idx_digital_cards_member_id ON digital_cards(member_id);
CREATE INDEX idx_digital_cards_status ON digital_cards(status);
CREATE INDEX idx_digital_cards_member_status ON digital_cards(member_id, status);
CREATE INDEX idx_digital_cards_expires_at ON digital_cards(expires_at);
```

**Connection:** `'tenant'` - Runs on tenant databases ONLY

**Run Migration:**

```bash
# Specific tenant
php artisan migrate \
    --path=app/Contexts/DigitalCard/Infrastructure/Database/Migrations \
    --database=tenant

# Or using tenantauth:migrate (all tenants)
php artisan tenantauth:migrate --all
```

---

### **EloquentDigitalCardRepository**

**Purpose:** Bridge between Domain and Eloquent ORM

**Key Methods:**

```php
// Save (insert or update)
$repository->save($card);  // Dispatches events automatically

// Find by ID
$card = $repository->findById($cardId); // Returns DigitalCard|null

// Find active card for member
$card = $repository->findActiveCardByMember($memberId);

// Check existence
$exists = $repository->exists($cardId); // bool

// Generate new ID
$newId = $repository->nextIdentity(); // CardId
```

**Conversion Logic:**

```php
// Entity → Model (for persistence)
private function toModel(DigitalCard $card): DigitalCardModel

// Model → Entity (reconstitution)
private function toDomainEntity(DigitalCardModel $model): DigitalCard
```

---

## **API Endpoints**

### **Route Configuration**

**File:** `routes/tenant-api/digitalcard-api.php`

**Pattern:** CASE 4 (Desktop API with Tenant Context)

**Middleware:** `['web', 'identify.tenant', 'auth:sanctum']`

---

### **POST /{tenant}/api/v1/cards**

**Purpose:** Issue a new digital card

**Request:**

```http
POST /nrna/api/v1/cards HTTP/1.1
Content-Type: application/json
Authorization: Bearer {token}

{
  "member_id": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2026-12-26T00:00:00+00:00"
}
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "member_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "issued",
    "qrcode": "card:f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "issued_at": "2025-12-26T00:15:00+00:00",
    "expires_at": "2026-12-26T00:00:00+00:00",
    "activated_at": null,
    "revoked_at": null,
    "revocation_reason": null
  }
}
```

**Validation Errors (422):**

```json
{
  "message": "Validation failed",
  "errors": {
    "member_id": ["The member id field is required."],
    "expires_at": ["The expires at must be a date after now."]
  }
}
```

---

### **GET /{tenant}/api/v1/cards/{id}**

**Purpose:** Retrieve a digital card

**Request:**

```http
GET /nrna/api/v1/cards/f47ac10b-58cc-4372-a567-0e02b2c3d479 HTTP/1.1
Authorization: Bearer {token}
```

**Response (200 OK):**

```json
{
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "member_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "issued",
    "qrcode": "card:f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "issued_at": "2025-12-26T00:15:00+00:00",
    "expires_at": "2026-12-26T00:00:00+00:00",
    "activated_at": null,
    "revoked_at": null,
    "revocation_reason": null
  }
}
```

**Not Found (404):**

```json
{
  "message": "Card not found"
}
```

---

## **Database Schema**

### **Tenant Database: digital_cards**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Card identifier |
| `member_id` | UUID | NOT NULL, INDEXED | Member reference (ACL) |
| `status` | VARCHAR(20) | DEFAULT 'issued', INDEXED | Card state |
| `qrcode_hash` | VARCHAR(64) | NOT NULL | SHA256 of QR code |
| `issued_at` | TIMESTAMPTZ | NOT NULL | Issue timestamp |
| `expires_at` | TIMESTAMPTZ | NOT NULL, INDEXED | Expiry timestamp |
| `created_at` | TIMESTAMPTZ | NOT NULL | Laravel timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Laravel timestamp |

**Indexes:**
- `idx_digital_cards_member_id` - Fast member lookups
- `idx_digital_cards_status` - Filter by status
- `idx_digital_cards_member_status` - Composite (common query)
- `idx_digital_cards_expires_at` - Expiry checks

---

## **Testing Strategy**

### **Test File**

**Location:** `tests/Feature/Contexts/DigitalCard/DigitalCardWalkingSkeletonTest.php`

### **Test Cases (5)**

#### **1. it_creates_digital_card_record_via_desktop_api()**

**Purpose:** Validate entire stack works

**Validates:**
- ✅ HTTP 201 response
- ✅ JSON structure matches contract
- ✅ Database record created in tenant DB
- ✅ Domain event dispatched
- ✅ Response data correctness

#### **2. it_prevents_cross_tenant_card_access()**

**Purpose:** CRITICAL tenant isolation test

**Validates:**
- ✅ Create card in Tenant A
- ✅ Attempt access from Tenant B
- ✅ Returns 404 (not 403, to prevent info leak)
- ✅ Tenant B's database has no record

#### **3. it_rejects_invalid_expiry_date()**

**Purpose:** Business rule enforcement

**Validates:**
- ✅ Expiry in past → 422 validation error
- ✅ Correct error structure

#### **4. it_requires_member_id()**

**Purpose:** Required field validation

**Validates:**
- ✅ Missing member_id → 422 error
- ✅ Validation error for 'member_id' field

#### **5. it_rejects_invalid_member_id_format()**

**Purpose:** UUID format validation

**Validates:**
- ✅ Invalid UUID string → 422 error
- ✅ Validation error for 'member_id' field

---

### **Running Tests**

```bash
# Run all DigitalCard tests
php artisan test --filter=DigitalCardWalkingSkeletonTest

# Run with coverage
php artisan test --filter=DigitalCardWalkingSkeletonTest --coverage

# Specific test
php artisan test --filter=it_creates_digital_card_record_via_desktop_api
```

---

## **Usage Examples**

### **Example 1: Issue Card via HTTP (cURL)**

```bash
curl -X POST http://localhost:8000/nrna/api/v1/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "member_id": "550e8400-e29b-41d4-a716-446655440000",
    "expires_at": "2026-12-26T00:00:00+00:00"
  }'
```

---

### **Example 2: Issue Card Programmatically**

```php
use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;
use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;

// Create command
$command = new IssueCardCommand(
    memberId: '550e8400-e29b-41d4-a716-446655440000',
    expiresAt: new DateTimeImmutable('+1 year')
);

// Execute
$handler = app(IssueCardHandler::class);
$cardDTO = $handler->handle($command);

// Access result
echo "Card ID: " . $cardDTO->id;
echo "QR Code: " . $cardDTO->qrcode;
```

---

### **Example 3: Find Card by ID**

```php
use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepositoryInterface;
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

$repository = app(DigitalCardRepositoryInterface::class);

$card = $repository->findById(
    CardId::fromString('f47ac10b-58cc-4372-a567-0e02b2c3d479')
);

if ($card) {
    echo "Status: " . $card->status()->value;
    echo "Expires: " . $card->expiresAt()->format('Y-m-d');
}
```

---

### **Example 4: Listen to CardIssued Event**

```php
// In EventServiceProvider or listener class
use App\Contexts\DigitalCard\Domain\Events\CardIssued;
use Illuminate\Support\Facades\Log;

Event::listen(CardIssued::class, function (CardIssued $event) {
    Log::info('Card issued', [
        'card_id' => $event->cardId,
        'member_id' => $event->memberId,
    ]);

    // Send notification, update analytics, etc.
});
```

---

## **Troubleshooting**

### **Issue: "Class DigitalCardRepositoryInterface not found"**

**Cause:** Service provider not registered

**Fix:**

```bash
# Check bootstrap/providers.php includes:
App\Contexts\DigitalCard\Infrastructure\Providers\DigitalCardServiceProvider::class

# Clear config cache
php artisan config:clear
```

---

### **Issue: "Table digital_cards doesn't exist"**

**Cause:** Migration not run on tenant database

**Fix:**

```bash
php artisan migrate \
    --path=app/Contexts/DigitalCard/Infrastructure/Database/Migrations \
    --database=tenant
```

---

### **Issue: "Route not found: /{tenant}/api/v1/cards"**

**Cause:** Route not loaded or middleware issue

**Fix:**

```bash
# Check route is registered
php artisan route:list | grep cards

# Expected output:
# POST   {tenant}/api/v1/cards .... desktop.api.v1.cards.store
# GET    {tenant}/api/v1/cards/{id} ... desktop.api.v1.cards.show
```

---

### **Issue: "Cross-tenant data leak in tests"**

**Cause:** Tenant context not switched correctly

**Check:**
1. Migration uses `'tenant'` connection? ✓
2. Model has `protected $connection = 'tenant'`? ✓
3. Test switches tenant context before queries? ✓

---

### **Issue: "Domain event not dispatched"**

**Cause:** Events not released from aggregate

**Debug:**

```php
// After saving card
$events = $card->releaseEvents();
dd($events); // Should contain CardIssued

// Repository should dispatch these
// Check EloquentDigitalCardRepository::dispatchDomainEvents()
```

---

## **Next Steps (Phase 1)**

After Phase 0 is GREEN:

1. **Card Activation**
   - Add `activate()` method to aggregate
   - Create `ActivateCardCommand` and handler
   - Add `POST /{tenant}/api/v1/cards/{id}/activate` endpoint

2. **Card Revocation**
   - Add `revoke()` method with reason
   - Create `RevokeCardCommand` and handler
   - Add audit trail

3. **Card Listing**
   - Add pagination to repository
   - Create `ListCardsQuery` and handler
   - Add `GET /{tenant}/api/v1/cards` endpoint with filters

4. **Soft Deletes**
   - Add `deleted_at` column
   - Update repository to respect soft deletes
   - Add restore capability

---

## **Architectural Decisions**

### **Why QR Hash Instead of Raw QR?**

**Security:** Database exfiltration doesn't expose QR codes

**Decision:** Store SHA256 hash in `qrcode_hash` column

**Trade-off:** Cannot reconstruct QR from DB (must regenerate)

---

### **Why Separate Routes File?**

**Maintainability:** Each bounded context isolated

**Scalability:** Easy to add/remove contexts

**Testing:** Can test context routes independently

---

### **Why No Laravel in Domain?**

**Portability:** Domain logic can move to microservices

**Testability:** Unit tests don't need Laravel bootstrap

**Purity:** Business logic has zero technical dependencies

---

## **Summary**

Phase 0 provides:
- ✅ Full DDD/TDD implementation
- ✅ Tenant-isolated database
- ✅ Event-driven architecture foundation
- ✅ Security best practices (QR hashing)
- ✅ Comprehensive tests
- ✅ Production-ready code structure

**Ready for:** Migration → Tests → Phase 1

---

**Questions?** Check:
- [Phase 0 Completion Report](./20251226_0015_phase0_completion_report.md)
- [Architecture Documents](../../architecture/backend/digitalcard_contexts/)
- Tests: `tests/Feature/Contexts/DigitalCard/`
