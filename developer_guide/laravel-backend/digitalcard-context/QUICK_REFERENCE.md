# DigitalCard Phase 1 - Quick Reference Guide

**For**: Developers implementing card operations
**Phase**: 1 (Activation & Revocation)
**Test Coverage**: 100%

---

## TL;DR - Phase 1 Achievements

✅ Card activation workflow (ISSUED → ACTIVE)
✅ Card revocation workflow (ISSUED/ACTIVE → REVOKED)
✅ Multi-tenancy with tenant isolation
✅ Subscription checks (FeatureGateService)
✅ Complete audit trail (domain events)
✅ 27/27 tests passing

---

## Quick Start - Activate a Card

```php
// 1. Subscribe tenant
app(SubscriptionService::class)->subscribe($tenantId, 'digital_card', 'free');

// 2. Create activation command
$command = new ActivateCardCommand(
    tenantId: $tenantId,
    cardId: $cardId->toString()
);

// 3. Execute handler
app(ActivateCardHandler::class)->handle($command);

// 4. Card is now ACTIVE ✅
```

---

## Quick Start - Revoke a Card

```php
// 1. Subscribe tenant
app(SubscriptionService::class)->subscribe($tenantId, 'digital_card', 'free');

// 2. Create revocation command
$command = new RevokeCardCommand(
    tenantId: $tenantId,
    cardId: $cardId->toString(),
    reason: 'Member requested cancellation'  // MANDATORY
);

// 3. Execute handler
app(RevokeCardHandler::class)->handle($command);

// 4. Card is now REVOKED ✅
```

---

## MANDATORY Handler Pattern

**Every handler MUST follow this pattern**:

```php
final class YourCardHandler
{
    public function __construct(
        private readonly DigitalCardRepositoryInterface $cardRepository,
        private readonly FeatureGateService $featureGate,  // MANDATORY
    ) {}

    public function handle(YourCommand $command): void
    {
        // 1. CRITICAL: Check subscription FIRST
        if (!$this->featureGate->can($command->tenantId, 'digital_card', 'digital_cards')) {
            throw new \DomainException('Tenant not subscribed');
        }

        // 2. Get card with tenant isolation
        $card = $this->cardRepository->findForTenant(
            CardId::fromString($command->cardId),
            $command->tenantId
        );

        // 3. Execute domain logic
        $card->yourMethod(...);

        // 4. Persist changes
        $this->cardRepository->save($card);
    }
}
```

---

## Domain Entity Quick Reference

### DigitalCard Entity

```php
// Create new card
$card = DigitalCard::issue(
    cardId: CardId::generate(),
    memberId: MemberId::fromString($memberId),
    tenantId: $tenantId,                        // Phase 1: MANDATORY
    qrCode: QRCode::fromCardId($cardId),
    issuedAt: new DateTimeImmutable(),
    expiresAt: new DateTimeImmutable('+1 year')
);

// Activate card
$card->activate(new DateTimeImmutable());

// Revoke card
$card->revoke('Reason here', new DateTimeImmutable());

// Check status
$card->status();  // CardStatus enum

// Get events
$events = $card->releaseEvents();
```

### Business Rules

| Rule | Enforcement |
|------|-------------|
| Only ISSUED cards can be activated | Domain exception |
| Cannot activate expired cards | Domain exception |
| Only ISSUED/ACTIVE cards can be revoked | Domain exception |
| Cannot re-revoke cards | Domain exception |
| Revocation reason is mandatory | InvalidArgumentException |
| One active card per member per tenant | Database partial unique index |

---

## Repository Pattern

### ✅ CORRECT - Use in Handlers

```php
// Always use findForTenant() for tenant isolation
$card = $this->repository->findForTenant($cardId, $tenantId);
```

### ❌ WRONG - Security Vulnerability

```php
// NEVER use findById() in handlers - no tenant isolation!
$card = $this->repository->findById($cardId);
```

---

## Database Schema (Phase 1)

```sql
CREATE TABLE digital_cards (
    id UUID PRIMARY KEY,
    member_id UUID NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,      -- Phase 1
    status VARCHAR(20) NOT NULL DEFAULT 'issued',
    qrcode_hash VARCHAR(64) NOT NULL,
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    activated_at TIMESTAMP NULL,          -- Phase 1
    revoked_at TIMESTAMP NULL,            -- Phase 1
    revocation_reason TEXT NULL,          -- Phase 1
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);

-- Business rule: One active card per member per tenant
CREATE UNIQUE INDEX idx_digital_cards_one_active_per_member_tenant
ON digital_cards (member_id, tenant_id)
WHERE status = 'active';
```

---

## Test Patterns

### Domain Test (Pure PHP)

```php
test('[DOMAIN] activates issued card successfully', function () {
    $card = DigitalCard::issue(...);
    $card->activate(new DateTimeImmutable());

    expect($card->status())->toBe(CardStatus::ACTIVE);
});
```

### Handler Test (Full Stack)

```php
test('[HANDLER] allows activation when tenant has valid subscription', function () {
    // 1. Subscribe tenant
    app(SubscriptionService::class)->subscribe($this->tenantId, 'digital_card', 'free');

    // 2. Create card in database
    $card = DigitalCard::issue(...);
    $repository->save($card);

    // 3. Execute handler
    $command = new ActivateCardCommand($this->tenantId, $cardId->toString());
    $handler->handle($command);

    // 4. Verify database
    $activatedCard = $repository->findForTenant($cardId, $this->tenantId);
    expect($activatedCard->status())->toBe(CardStatus::ACTIVE);
});
```

### Command Test (Immutability)

```php
test('[COMMAND] is immutable value object', function () {
    $command = new ActivateCardCommand($tenantId, $cardId);

    $reflection = new ReflectionClass($command);
    expect($reflection->getProperty('tenantId')->isReadOnly())->toBeTrue();
});
```

---

## Common Errors & Solutions

### Error: "Tenant not subscribed"

```php
// ❌ Problem
$handler->handle($command);
// DomainException: Tenant X is not subscribed

// ✅ Solution
app(SubscriptionService::class)->subscribe($tenantId, 'digital_card', 'free');
$handler->handle($command);
```

### Error: "Card not found"

```php
// ❌ Problem - Card doesn't exist in database
$command = new ActivateCardCommand($tenantId, $nonExistentCardId);
$handler->handle($command);
// DomainException: Card not found or does not belong to tenant

// ✅ Solution - Create card first
$card = DigitalCard::issue(...);
$repository->save($card);  // Persist to database
$command = new ActivateCardCommand($tenantId, $card->id()->toString());
$handler->handle($command);
```

### Error: "Cannot activate card with status: active"

```php
// ❌ Problem - Card already activated
$card->activate(new DateTimeImmutable());
$card->activate(new DateTimeImmutable());  // FAILS
// DomainException: Cannot activate card with status: active

// ✅ Solution - Check status first
if ($card->status() === CardStatus::ISSUED) {
    $card->activate(new DateTimeImmutable());
}
```

---

## Running Tests

```bash
# All DigitalCard tests
vendor/bin/pest tests/Feature/Contexts/DigitalCard/

# Specific workflow
vendor/bin/pest tests/Feature/Contexts/DigitalCard/ActivateCardTest.php
vendor/bin/pest tests/Feature/Contexts/DigitalCard/RevokeCardTest.php

# Phase 0 compatibility
vendor/bin/pest tests/Feature/Contexts/DigitalCard/DigitalCardWalkingSkeletonTest.php

# Expected: Tests: 27 passed (87 assertions)
```

---

## File Locations

### Domain Layer (Pure PHP)
- Entity: `app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php`
- Events: `app/Contexts/DigitalCard/Domain/Events/Card*.php`
- Enums: `app/Contexts/DigitalCard/Domain/Enums/CardStatus.php`

### Application Layer
- Commands: `app/Contexts/DigitalCard/Application/Commands/*Command.php`
- Handlers: `app/Contexts/DigitalCard/Application/Handlers/*Handler.php`

### Infrastructure Layer
- Repository: `app/Contexts/DigitalCard/Infrastructure/Repositories/EloquentDigitalCardRepository.php`
- Model: `app/Contexts/DigitalCard/Infrastructure/Models/DigitalCardModel.php`
- Migrations: `app/Contexts/DigitalCard/Infrastructure/Database/Migrations/*.php`

### Tests
- `tests/Feature/Contexts/DigitalCard/ActivateCardTest.php` (10 tests)
- `tests/Feature/Contexts/DigitalCard/RevokeCardTest.php` (12 tests)
- `tests/Feature/Contexts/DigitalCard/DigitalCardWalkingSkeletonTest.php` (5 tests)

---

## Key Architectural Decisions

1. **Domain events don't include memberId** - State change events vs creation events
2. **FeatureGateService is MANDATORY** - Every handler checks subscription first
3. **`findForTenant()` enforces isolation** - Never use `findById()` in handlers
4. **Commands are immutable** - All properties readonly
5. **Tenant ID in all entities** - Required for multi-tenancy

---

## Phase 2 Preview

**Coming Soon**:
- Quota enforcement (reject if limit exceeded)
- Card expiry processing (background jobs)
- Card templates (customizable designs)
- Bulk operations (CSV import, batch activate/revoke)

---

**For Full Documentation**: See `20251227_phase1_developer_guide.md`
**Questions?**: Review test files for usage examples
**Version**: 1.0 (2025-12-27)
