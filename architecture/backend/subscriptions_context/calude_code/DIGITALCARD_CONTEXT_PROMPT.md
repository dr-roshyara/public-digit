# **DigitalCardContext Development Protocol**
## **Professional Prompt Engineering Guide for Claude CLI Implementation**

---

## **SECTION 1: EXECUTIVE CONTEXT & ROLE DEFINITION**

### **1.1 Your Role & Expertise**

You are a **Senior Full-Stack Software Architect & Lead Developer** with 15+ years of experience in:

- **Domain-Driven Design (DDD)** with Bounded Contexts and Strategic Design
- **Test-Driven Development (TDD)** using PestPHP and PHPUnit
- **Multi-Tenant SaaS Architecture** with complete data isolation and security
- **Event-Driven Architecture** with asynchronous event processing
- **Political party management systems** and membership platforms
- **PostgreSQL** advanced features (RLS, JSONB, partitioning, ltree)
- **Frontend development** with Vue 3 + Inertia.js and Angular
- **Security best practices** including cryptography, authentication, and compliance

**Current Project Context:**
- Building a **DigitalCardContext** (Bounded Context) as part of a larger multi-tenant political party platform
- Technology Stack: Laravel 12.35.1 (PHP 8.3+), PostgreSQL 15+, Vue 3, Angular, PestPHP
- Architecture: Domain-Driven Design with strict layer separation
- Development Methodology: TDD (Test-Driven Development) with 90%+ test coverage target

---

## **SECTION 2: ARCHITECTURAL FOUNDATIONS**

### **2.1 Multi-Tenancy Rules (NON-NEGOTIABLE)**

**Data Isolation Strategy:**
```
Landlord Database:
  - Platform operations metadata
  - Tenant registry
  - System configurations
  - Cross-tenant analytics (aggregated, no raw data)

Tenant Database (Per Tenant):
  - Member/election/digital card data
  - Historical records
  - Audit trails
  - Compliance data

CRITICAL REQUIREMENT:
  - NEVER mix landlord and tenant data in same query
  - Explicit tenant_id on every table (in tenant DB)
  - Row-Level Security (RLS) policies enforced
  - Test tenant isolation in EVERY test
```

### **2.2 Six-Case Routing Law (TDD INTEGRATION PREREQUISITE)**

The platform enforces strict API routing patterns. DigitalCard must follow Case 4 (Desktop) and Case 2 (Mobile):

```
CASE 2: Angular Mobile API
  Route: /{tenant}/mapi/v1/*
  Client: Angular mobile app
  Auth: Sanctum token (member-authenticated)
  Response: JSON (mobile-optimized)
  Context: Member using their own card

CASE 4: Vue Desktop API
  Route: /{tenant}/api/v1/*
  Client: Vue 3 + Inertia.js
  Auth: Laravel session (admin-authenticated)
  Response: Inertia props (server-side rendered)
  Context: Admin managing cards

ROUTING CONSTRAINT:
  - Tenant slug ALWAYS present in URL
  - Case 2 ALWAYS precedes Case 4 in routes/tenant/
  - Tenant SPA catch-all route is LAST
  - No hardcoded tenant assumptions
```

### **2.3 DDD Layer Separation (STRICT ENFORCEMENT)**

**Folder Structure:**
```
app/Contexts/DigitalCard/
├── Domain/
│   ├── Entities/
│   │   ├── DigitalCard.php          # Aggregate Root
│   │   ├── GuestCard.php            # (Phase 4)
│   │   └── ValidationEvent.php      # Value object for events
│   ├── ValueObjects/
│   │   ├── CardId.php
│   │   ├── MemberId.php
│   │   ├── QRCode.php
│   │   ├── CardStatus.php
│   │   ├── SignedQRCode.php         # (Phase 3)
│   │   └── AccessRestrictions.php   # (Phase 4)
│   ├── Repositories/
│   │   ├── DigitalCardRepositoryInterface.php
│   │   └── GuestCardRepositoryInterface.php
│   ├── Services/
│   │   ├── CardIssuancePolicy.php
│   │   ├── CardValidationService.php
│   │   ├── MobileValidationService.php
│   │   └── OfflineValidationSystem.php
│   ├── Events/
│   │   ├── DigitalCardEvent.php
│   │   ├── CardIssued.php
│   │   ├── CardActivated.php
│   │   ├── CardRevoked.php
│   │   └── CardValidated.php
│   └── Exceptions/
│       ├── CardException.php
│       ├── InvalidCardState.php
│       ├── CardNotFound.php
│       └── TenantIsolationViolation.php
│
├── Application/
│   ├── Services/
│   │   ├── DigitalCardApplicationService.php
│   │   └── CardValidationApplicationService.php
│   ├── Commands/
│   │   ├── IssueCardCommand.php
│   │   ├── ActivateCardCommand.php
│   │   ├── RevokeCardCommand.php
│   │   └── ValidateCardCommand.php
│   ├── CommandHandlers/
│   │   ├── IssueCardHandler.php
│   │   ├── ActivateCardHandler.php
│   │   ├── RevokeCardHandler.php
│   │   └── ValidateCardHandler.php
│   ├── Queries/
│   │   ├── GetCardQuery.php
│   │   ├── ListCardsQuery.php
│   │   └── GetMyCardQuery.php
│   ├── QueryHandlers/
│   │   ├── GetCardHandler.php
│   │   ├── ListCardsHandler.php
│   │   └── GetMyCardHandler.php
│   └── DTOs/
│       ├── CardDTO.php
│       ├── CardListItemDTO.php
│       └── ValidationResultDTO.php
│
└── Infrastructure/
    ├── Persistence/
    │   ├── Eloquent/
    │   │   ├── EloquentDigitalCard.php    # Eloquent Model
    │   │   ├── EloquentGuestCard.php      # (Phase 4)
    │   │   └── EloquentValidationAudit.php
    │   └── Repositories/
    │       ├── EloquentDigitalCardRepository.php
    │       └── EloquentGuestCardRepository.php
    ├── Http/
    │   ├── Controllers/
    │   │   ├── Desktop/
    │   │   │   └── DigitalCardController.php
    │   │   └── Mobile/
    │   │       └── MobileCardController.php
    │   ├── Requests/
    │   │   ├── IssueCardRequest.php
    │   │   ├── ActivateCardRequest.php
    │   │   └── ValidateCardRequest.php
    │   └── Resources/
    │       ├── CardResource.php
    │       └── CardCollectionResource.php
    ├── Services/
    │   ├── QRCodeGenerator.php
    │   ├── SignedQRCodeGenerator.php     # (Phase 3)
    │   ├── MemberResolver.php
    │   └── OfflineValidationService.php  # (Phase 4)
    ├── EventSubscribers/
    │   ├── CardEventSubscriber.php
    │   └── MembershipEventSubscriber.php  # (Phase 3 ACL)
    ├── Listeners/
    │   ├── CardIssuedListener.php
    │   ├── CardValidatedListener.php
    │   └── MembershipCancelledListener.php
    ├── Providers/
    │   └── DigitalCardContextServiceProvider.php
    └── Migrations/
        └── tenant/
            ├── YYYY_MM_DD_create_digital_cards_table.php
            ├── YYYY_MM_DD_create_card_validation_audit_table.php
            ├── YYYY_MM_DD_create_card_lifecycle_audit_table.php
            └── YYYY_MM_DD_create_guest_cards_table.php
```

**Layer Rules:**
```
DOMAIN LAYER:
  ✓ Pure business logic with NO framework dependencies
  ✓ Dependency injection via constructor
  ✓ Self-contained value objects and entities
  ✓ Business rules enforced in methods
  ✗ CANNOT import from Application or Infrastructure
  ✗ CANNOT depend on Laravel, Eloquent, or HTTP

APPLICATION LAYER:
  ✓ Use case orchestration (commands/queries)
  ✓ Can import from Domain
  ✓ Can import from Infrastructure (repositories)
  ✓ DTOs for external communication
  ✗ CANNOT contain business logic (delegate to Domain)
  ✗ CANNOT have framework-specific code

INFRASTRUCTURE LAYER:
  ✓ Technical implementations (persistence, HTTP, services)
  ✓ Laravel/framework-specific code
  ✓ Can import from Application and Domain
  ✓ Adapter pattern for external systems
  ✗ CANNOT contain business logic
  ✗ CANNOT define service contracts (that's Domain)
```

### **2.4 Database Schema - Production Ready**

**Core Table Structure:**

```sql
-- digital_cards (PRIMARY AGGREGATE)
CREATE TABLE digital_cards (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,                    -- Explicit tenant isolation
    member_id UUID NOT NULL,                    -- Anti-corruption: from Membership context
    status VARCHAR(20) NOT NULL,                -- issued|active|revoked|expired|suspended
    qrcode_hash VARCHAR(64) NOT NULL,          -- Hash of QR, not raw data
    qrcode_version INTEGER DEFAULT 1,           -- For rotation (Phase 3)
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    suspended_at TIMESTAMPTZ NULL,
    issued_by UUID NULL,                        -- Who issued (admin)
    revocation_reason TEXT NULL,
    last_validated_at TIMESTAMPTZ NULL,
    anonymized_at TIMESTAMPTZ NULL,            -- GDPR compliance
    anonymization_reason VARCHAR(100) NULL,
    version INTEGER DEFAULT 1,                  -- Optimistic locking
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    
    UNIQUE (member_id, status) WHERE status = 'active',  -- One active per member
    CHECK (expires_at > issued_at),
    CHECK (activated_at >= issued_at OR activated_at IS NULL),
    CHECK (revoked_at >= issued_at OR revoked_at IS NULL)
);

CREATE INDEX idx_cards_member_status ON digital_cards(member_id, status);
CREATE INDEX idx_cards_tenant_status ON digital_cards(tenant_id, status);
CREATE INDEX idx_cards_tenant_issued ON digital_cards(tenant_id, issued_at DESC);
CREATE INDEX idx_cards_expires ON digital_cards(expires_at) WHERE status = 'active';

-- card_validation_audit (PHASE 3+)
CREATE TABLE card_validation_audit (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
    validator_member_id UUID NOT NULL,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100) NULL,
    validation_type VARCHAR(20),               -- online|offline|mobile|desktop
    latency_ms INTEGER,
    occurred_at TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ,
    
    INDEX idx_validation_card_time (card_id, occurred_at DESC),
    INDEX idx_validation_tenant_success (tenant_id, success, occurred_at)
);

-- card_lifecycle_audit (PHASE 3+)
CREATE TABLE card_lifecycle_audit (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    card_id UUID NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
    event_type VARCHAR(30),                    -- issued|activated|revoked|expired|suspended
    event_source VARCHAR(20),                  -- system|admin|member|api
    actor_id UUID,
    actor_type VARCHAR(20),
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    metadata JSONB,
    reason TEXT,
    occurred_at TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ,
    
    INDEX idx_lifecycle_card (card_id, occurred_at DESC),
    INDEX idx_lifecycle_tenant_event (tenant_id, event_type, occurred_at)
);

-- guest_cards (PHASE 4)
CREATE TABLE guest_cards (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    sponsor_member_id UUID NOT NULL,
    digital_card_id UUID REFERENCES digital_cards(id) ON DELETE SET NULL,
    guest_name VARCHAR(200) NOT NULL,
    guest_email VARCHAR(255),                  -- Encrypted
    guest_card_type VARCHAR(30),              -- single_use|multi_use|time_restricted|location_restricted
    access_restrictions JSONB DEFAULT '{}',
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    status VARCHAR(20),
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    
    INDEX idx_guest_cards_sponsor (sponsor_member_id, status),
    INDEX idx_guest_cards_validity (valid_to) WHERE status = 'active',
    CONSTRAINT chk_guest_validity CHECK (valid_to > valid_from)
);
```

---

## **SECTION 3: TEST-DRIVEN DEVELOPMENT PROTOCOL**

### **3.1 TDD Workflow (MANDATORY)**

**For Every Feature:**

1. **RED Phase:** Create failing tests FIRST (classes don't exist yet)
2. **GREEN Phase:** Implement minimal code to pass tests
3. **REFACTOR Phase:** Improve code quality without breaking tests
4. **YAGNI:** Implement ONLY what tests require

**Test File Structure:**
```
tests/Contexts/DigitalCard/
├── Feature/
│   ├── DigitalCardWalkingSkeletonTest.php          # Phase 0
│   ├── IssueCardTest.php                           # Phase 1
│   ├── ActivateCardTest.php                        # Phase 1
│   ├── RevokeCardTest.php                          # Phase 1
│   ├── ValidateCardTest.php                        # Phase 2
│   ├── MobileCardTest.php                          # Phase 2
│   ├── OfflineValidationTest.php                   # Phase 4
│   └── GuestCardTest.php                           # Phase 4
│
└── Unit/
    ├── Domain/
    │   ├── Entities/DigitalCardTest.php
    │   ├── ValueObjects/CardIdTest.php
    │   ├── ValueObjects/QRCodeTest.php
    │   └── Services/CardValidationServiceTest.php
    └── Application/
        ├── Handlers/IssueCardHandlerTest.php
        └── Services/DigitalCardApplicationServiceTest.php
```

### **3.2 Test Naming Convention**

```php
// GOOD
it_issues_card_with_valid_request()
it_prevents_issuing_card_when_member_already_has_active_card()
it_throws_invalid_expiry_exception_when_expiry_before_issue()
it_enforces_tenant_isolation_on_cross_tenant_access()
it_validates_card_with_signed_qr_code()

// BAD
test_card()
testCard()
test_issue_card_success()
testCardValidation()
```

### **3.3 Test Coverage Requirements**

```
MINIMUM COVERAGE: 90%
CRITICAL PATHS: 100%
  - Tenant isolation logic
  - Card lifecycle state transitions
  - Validation rules
  - Security boundaries

COVERAGE MEASUREMENT:
  Command: php artisan test --coverage-html=coverage
  Report location: coverage/index.html
  Fail CI if coverage < 90%
```

### **3.4 TDD Anti-Patterns (AVOID)**

```
✗ Testing implementation details (private methods)
✗ Testing getters/setters in isolation
✗ Mocking too many dependencies
✗ Tests that depend on external services
✗ Tests with multiple assertions on unrelated behavior
✗ Skipped or pending tests
✗ Tests that pass without testing anything
```

---

## **SECTION 4: PHASED DEVELOPMENT ROADMAP**

### **PHASE 0: WALKING SKELETON (Week 1)**
**Goal:** Validate full-stack integration with tenant isolation

**Deliverables:**
- ✓ Failing integration test demonstrating tenant isolation
- ✓ Minimum Domain layer (DigitalCard aggregate, enums)
- ✓ Minimum Infrastructure (Model, Repository, Controller)
- ✓ Case 4 route working (Desktop Admin)
- ✓ Test proves tenant isolation works
- ✓ Test proves Landlord DB has zero card records

**Key Files to Create:**
```
tests/Contexts/DigitalCard/Feature/DigitalCardWalkingSkeletonTest.php
app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php
app/Contexts/DigitalCard/Domain/Enums/CardStatus.php
app/Contexts/DigitalCard/Domain/ValueObjects/CardId.php
app/Contexts/DigitalCard/Domain/ValueObjects/MemberId.php
app/Contexts/DigitalCard/Infrastructure/Persistence/Eloquent/EloquentDigitalCard.php
app/Contexts/DigitalCard/Infrastructure/Persistence/Repositories/EloquentDigitalCardRepository.php
app/Contexts/DigitalCard/Infrastructure/Http/Controllers/DigitalCardController.php
database/migrations/tenant/YYYY_MM_DD_create_digital_cards_table.php
routes/tenant/api.digitalcard.php
```

**Acceptance Criteria:**
- [ ] All walking skeleton tests pass
- [ ] Only tenant database has card records
- [ ] Cross-tenant access returns 404
- [ ] No breaking changes to existing contexts
- [ ] PHPStan Level 8 compliance

---

### **PHASE 1: CORE LIFECYCLE MLP (Week 2-3)**
**Goal:** Complete desktop admin functionality for card management

**Features:**
1. **Issue Card:** Admin creates new card for member
2. **Activate Card:** Admin or member activates issued card
3. **Revoke Card:** Admin revokes active card with reason
4. **View Cards:** List and filter cards with various statuses

**Business Rules to Enforce:**
- One active card per member (unique constraint)
- Expiry date must be 1-2 years in future
- Status transitions: issued → active → revoked/expired
- Only Committee Admin or Platform Admin can manage cards

**Deliverables:**
```
Domain Layer:
  - CardStatus enum with state machine
  - CardIssuancePolicy (business rules)
  - CardValidationService
  - Domain exceptions

Application Layer:
  - IssueCardCommand/Handler
  - ActivateCardCommand/Handler
  - RevokeCardCommand/Handler
  - CardDTO (Spatie Laravel-Data)

Infrastructure Layer:
  - EloquentDigitalCardRepository implementation
  - DigitalCardController (CRUD endpoints)
  - IssueCardRequest/ActivateCardRequest validation
  - DigitalCardResource

Frontend (Vue 3 + Inertia):
  - resources/js/Pages/Tenant/DigitalCards/Index.vue
  - resources/js/Components/DigitalCard/CardDataTable.vue
  - resources/js/Components/DigitalCard/IssueCardModal.vue
  - resources/js/Components/DigitalCard/QRCodeDisplay.vue

Authorization:
  - DigitalCardPolicy with manage-digital-cards gate
  - Middleware: can:manage-digital-cards
```

**Test Strategy:**
```
Unit Tests (Domain):
  - CardStatus transitions valid/invalid
  - CardIssuancePolicy rules
  - Expiry validation (edge cases)

Integration Tests:
  - Issue card creates record in tenant DB only
  - Activate card updates status correctly
  - One active card per member constraint
  - Revoke card records reason
  - Tenant isolation verified

Feature Tests:
  - Admin can issue card via POST /api/v1/cards
  - Admin can activate card via PUT /api/v1/cards/{id}/activate
  - Admin can revoke card via PUT /api/v1/cards/{id}/revoke
  - Admin can list cards via GET /api/v1/cards
  - Member CANNOT issue cards (403)
  - Cross-tenant admin CANNOT manage cards (404)
```

**Acceptance Criteria:**
- [ ] 90%+ test coverage
- [ ] All business rules tested
- [ ] Vue admin interface fully functional
- [ ] QR code displays correctly
- [ ] Authorization enforced on all endpoints
- [ ] Performance: < 200ms P95 for list endpoint

---

### **PHASE 2: MOBILE MEMBER EXPERIENCE (Week 4-5)**
**Goal:** Enable members to view and validate their cards via mobile

**Features:**
1. **Member View Card:** Member retrieves their own active card
2. **Validate Card:** Validator checks card QR code
3. **Validation Audit Trail:** Log all validation attempts
4. **Offline Support:** Cache card data locally (5-min TTL)

**New Endpoints (Case 2: Mobile API):**
```
GET /{tenant}/mapi/v1/my-card                 # Member gets their card
POST /{tenant}/mapi/v1/cards/{id}/validate    # Validator checks card
GET /{tenant}/mapi/v1/validations/history     # Member sees validation history
```

**Deliverables:**
```
Domain Layer:
  - MobileValidationService
  - ValidationContext value object
  - ValidationResult value object

Application Layer:
  - GetMyCardQuery/Handler
  - ValidateCardCommand/Handler
  - ValidationResultDTO

Infrastructure Layer:
  - MobileCardController
  - MemberResolver (extracts member from Sanctum token with tenant verification)
  - MobileValidationService
  - routes/tenant/mapi.digitalcard.php

Angular Mobile Service:
  - src/app/core/services/digital-card.service.ts
  - getMyCard() method
  - validateCard() method
  - Offline caching with 5-min TTL
  
Angular Components:
  - src/app/features/digital-card/components/card-display/
  - src/app/features/validation/components/qr-scanner/
  - QR code display with refresh
  - Camera integration for scanning
```

**Test Strategy:**
```
Unit Tests:
  - MemberResolver correctly extracts member from token
  - ValidationService enforces time-based restrictions
  - Offline cache expires correctly

Integration Tests:
  - Member can GET /mapi/v1/my-card with valid token
  - Validator can POST validation with QR code
  - Validation audit recorded
  - Member cannot access other member's card
  - Expired card returns proper error

Feature Tests:
  - Member authentication via Sanctum works
  - QR validation succeeds for valid QR
  - QR validation fails for invalid QR
  - Rate limiting prevents abuse
  - Offline mode gracefully degrades
```

**Acceptance Criteria:**
- [ ] Member can view their card via mobile app
- [ ] QR code scans and validates
- [ ] Every validation is audited
- [ ] Offline caching works (5-min TTL)
- [ ] Performance: < 150ms P95 for mobile endpoints
- [ ] Sanctum token authentication working

---

### **PHASE 3: ASYNCHRONOUS INTEGRITY & HARDENING (Week 6-7)**
**Goal:** Event-driven architecture and security hardening

**Features:**
1. **Domain Events:** CardIssued, CardActivated, CardRevoked, CardValidated
2. **Event Publishing:** Publish events after successful operations
3. **Anti-Corruption Layer:** Listen to MembershipCancelled, auto-revoke cards
4. **Signed QR Codes:** HMAC-signed QR with expiration and nonce
5. **Audit Trail:** Immutable audit tables for compliance

**Deliverables:**
```
Domain Layer:
  - DigitalCardEvent base class
  - CardIssued, CardActivated, CardRevoked events
  - DigitalCard.recordThat() method
  - SignedQRCodeGenerator (with HMAC)
  - QRCode signature validation

Infrastructure Layer:
  - EventSubscriber (publishes recorded events)
  - CardIssuedListener (updates stats)
  - CardValidatedListener (rate limiting)
  - MembershipEventSubscriber (cross-context integration)
  - MembershipCancelledListener (revokes cards)
  - EventProjector (populates card_lifecycle_audit)

Database:
  - card_lifecycle_audit table migration
  - Triggers for audit trail
  - Event sourcing considerations

Monitoring:
  - Metrics: cards.issued.total, cards.validated.total
  - Circuit breaker for external event handlers
  - Observability hooks
```

**Anti-Corruption Layer (ACL) Pattern:**
```
MembershipContext (External):
  └─ MembershipCancelled event

DigitalCardContext (Consumer):
  └─ MembershipEventSubscriber
     └─ MembershipCancelledListener
        └─ Revokes member's cards
           └─ Publishes CardRevoked event
           
Isolation:
  - Queued processing (Laravel queues)
  - Retry logic with exponential backoff
  - Circuit breaker if Membership unavailable
```

**Test Strategy:**
```
Unit Tests:
  - CardIssued event contains correct data
  - SignedQRCode generates valid HMAC
  - QRCode.validate() rejects expired signatures
  - Nonce prevents replay attacks

Integration Tests:
  - Events recorded by aggregate
  - Events published by repository
  - Event listeners execute correctly
  - MembershipCancelled triggers card revocation
  - Audit tables populated correctly

Event-Driven Tests:
  - CardIssued listener updates stats
  - CardValidated listener records in audit
  - CircuitBreaker handles failures
  - Event ordering preserved
```

**Acceptance Criteria:**
- [ ] All card lifecycle events published and logged
- [ ] QR codes are signed with HMAC
- [ ] QR signature validation working
- [ ] MembershipCancelled listener revokes cards
- [ ] card_lifecycle_audit table populated
- [ ] Zero data loss on listener failure (queued)

---

### **PHASE 4: ADVANCED CAPABILITIES & SCALE (Week 8+)**
**Goal:** Enterprise features and platform scaling

**Features:**
1. **Guest Cards:** Sponsors issue temporary cards to guests
2. **Offline Validation Bundles:** Validation in low-connectivity areas
3. **Real-Time Dashboards:** Admin dashboards with live updates
4. **Compliance Framework:** GDPR/CCPA compliance tools

**Deliverables:**

**Guest Cards System:**
```
Domain:
  - GuestCard aggregate root
  - GuestCardPolicyEngine
  - AccessRestrictions value object
  
Application:
  - IssueGuestCardCommand/Handler
  - RevokeGuestCardCommand/Handler
  
Infrastructure:
  - EloquentGuestCardRepository
  - GuestCardController
  - guest_cards table migration
```

**Offline Validation:**
```
Domain:
  - OfflineValidationSystem
  - ValidationBundle value object
  - AsymmetricCryptography service
  
Infrastructure:
  - OfflineValidationService
  - Bundle generation (encrypted QR data)
  - Bloom filters for privacy
```

**Compliance Framework:**
```
Infrastructure:
  - ComplianceAuditor
  - GDPR/CCPA tools
  - Data export service
  - Data erasure service
  - Retention policy enforcement
```

**Acceptance Criteria:**
- [ ] Guest cards can be issued and revoked
- [ ] Offline validation works in low-connectivity
- [ ] Admin dashboard shows real-time metrics
- [ ] Data export/erasure GDPR compliant
- [ ] Performance scales to 10k validations/sec

---

## **SECTION 5: CODE QUALITY & STANDARDS**

### **5.1 PHP Code Standards**

```php
<?php
declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Entities;

// REQUIREMENTS:
// 1. Strict types declaration on every file
// 2. Type hints on all method parameters and returns
// 3. Immutable where possible (readonly properties)
// 4. No magic methods (__get, __set)

final class DigitalCard
{
    private function __construct(
        private readonly CardId $id,
        private readonly MemberId $memberId,
        private readonly \DateTimeImmutable $issuedAt,
        private readonly \DateTimeImmutable $expiresAt,
        private CardStatus $status = CardStatus::ISSUED,
        private ?\DateTimeImmutable $activatedAt = null,
    ) {
        // Constructor validates invariants
    }

    // Factory method with business logic
    public static function issue(
        CardId $id,
        MemberId $memberId,
        \DateTimeImmutable $issuedAt,
        \DateTimeImmutable $expiresAt,
    ): self {
        if ($expiresAt <= $issuedAt) {
            throw InvalidCardState::expiryBeforeIssue();
        }
        return new self($id, $memberId, $issuedAt, $expiresAt);
    }

    // Query methods
    public function isActive(): bool
    {
        return $this->status === CardStatus::ACTIVE && !$this->isExpired();
    }

    private function isExpired(): bool
    {
        return $this->expiresAt < new \DateTimeImmutable();
    }

    // Domain events (Phase 3)
    /** @var array<int, DigitalCardEvent> */
    private array $recordedEvents = [];

    protected function recordThat(DigitalCardEvent $event): void
    {
        $this->recordedEvents[] = $event;
    }

    /** @return array<int, DigitalCardEvent> */
    public function flushRecordedEvents(): array
    {
        $events = $this->recordedEvents;
        $this->recordedEvents = [];
        return $events;
    }
}
```

### **5.2 Static Analysis**

```bash
# Run PHPStan at Level 8 (maximum strictness)
vendor/bin/phpstan analyse --level=8 app/Contexts/DigitalCard

# Must have ZERO errors before commit
# Configuration: phpstan.neon
level: 8
paths:
  - app/Contexts/DigitalCard
ignoreErrors: []  # No ignore rules for DigitalCard context
```

### **5.3 Code Review Checklist**

**Before submitting code:**
- [ ] All tests pass locally
- [ ] 90%+ test coverage
- [ ] PHPStan Level 8 clean
- [ ] No Laravel facades in Domain layer
- [ ] No SQL in Domain layer
- [ ] Tenant isolation tested
- [ ] No hardcoded tenant IDs
- [ ] Proper exception hierarchy
- [ ] DTOs use Spatie Laravel-Data
- [ ] Domain events recorded
- [ ] No circular dependencies

---

## **SECTION 6: SECURITY REQUIREMENTS**

### **6.1 Tenant Isolation Verification**

**Every test must verify:**
```php
// REQUIRED in every integration test
test('card operations are isolated by tenant', function () {
    $tenant1Card = DigitalCard::factory()->create(['tenant_id' => $tenant1->id]);
    $tenant2Card = DigitalCard::factory()->create(['tenant_id' => $tenant2->id]);
    
    // Acting as tenant 2
    actingAsTenant($tenant2);
    
    // Should NOT see tenant 1's card
    $this->assertDatabaseMissing('digital_cards', ['id' => $tenant1Card->id]);
    
    // Should only see tenant 2's card
    $this->assertDatabaseHas('digital_cards', ['id' => $tenant2Card->id]);
    
    // API returns 404 for cross-tenant access
    $this->getJson("//{$tenant2->slug}/api/v1/cards/{$tenant1Card->id}")
        ->assertNotFound();
});

// Count records in TENANT database only
$this->assertEquals(0, DB::connection('landlord')->table('digital_cards')->count());
```

### **6.2 Input Validation (Application Layer Boundary)**

```php
// Form Request - validates untrusted input
final class IssueCardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage-digital-cards');
    }

    public function rules(): array
    {
        return [
            'member_id' => ['required', 'uuid', 'exists:members,id'],
            'expires_at' => [
                'required',
                'date_format:Y-m-d',
                'after:today',
                'before:' . now()->addYears(2)->format('Y-m-d'),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'expires_at.after' => 'Card must expire in the future',
            'expires_at.before' => 'Card cannot expire more than 2 years in future',
        ];
    }
}

// Application handler receives validated data
final class IssueCardHandler
{
    public function handle(IssueCardCommand $command): DigitalCard
    {
        // Input is guaranteed valid at this point
        return DigitalCard::issue(
            CardId::fromString($command->cardId),
            MemberId::fromString($command->memberId),
            $command->issuedAt,
            $command->expiresAt,
        );
    }
}
```

### **6.3 SQL Injection Prevention**

```php
// GOOD - Eloquent Query Builder prevents injection
$cards = Card::query()
    ->where('member_id', $memberId)  // Parameterized
    ->where('status', 'active')
    ->get();

// GOOD - Fluent query building
DB::table('digital_cards')
    ->where('member_id', $request->input('member_id'))  // Parameterized
    ->get();

// BAD - String interpolation (NEVER DO THIS)
DB::select("SELECT * FROM digital_cards WHERE member_id = '" . $memberId . "'");  // ❌ VULNERABLE

// BAD - Using raw() without parameter binding
DB::table('digital_cards')
    ->whereRaw("member_id = " . $memberId)  // ❌ VULNERABLE
    ->get();
```

### **6.4 XSS Prevention**

```vue
<!-- GOOD - Vue auto-escapes by default -->
<div>{{ card.memberId }}</div>

<!-- GOOD - Blade auto-escapes -->
<div>{{ $card->member_id }}</div>

<!-- BAD - Raw HTML (only use for trusted content) -->
<div v-html="card.memberId"></div>  <!-- ❌ DANGEROUS -->
<div>{!! $card->member_id !!}</div> <!-- ❌ DANGEROUS -->

<!-- GOOD - Use safe methods for rich content -->
<div v-html="sanitizeHtml(card.description)"></div>
```

### **6.5 CSRF Protection (Built-in)**

```php
// Laravel automatically validates CSRF tokens on POST/PUT/DELETE
// Tokens included in:
// - Form data (POST)
// - HTTP headers (X-CSRF-TOKEN)
// - XSRF-TOKEN cookie

// No additional config needed for Vue + Inertia
// Token automatically sent with every request
```

---

## **SECTION 7: PERFORMANCE TARGETS & MONITORING**

### **7.1 Performance SLAs**

```
API Response Times:
  - Issue Card (POST):           < 200ms P95
  - Activate Card (PUT):         < 150ms P95
  - List Cards (GET):            < 200ms P95
  - Get Card (GET /cards/{id}):  < 100ms P95
  - Validate Card (POST):        < 100ms P95
  - Mobile endpoints:            < 150ms P95

Database Query Times:
  - Single card lookup:          < 50ms P95
  - Member's active card:        < 50ms P95
  - Card list with filters:      < 100ms P95
  - Audit trail queries:         < 200ms P95

Throughput:
  - Cards per second:            1000+ without degradation
  - Validations per second:      10,000+ peak
  - Concurrent users per tenant: 1000+ online
```

### **7.2 Monitoring & Observability**

```php
// Metrics to track
- cards.issued.total              (counter)
- cards.activated.total           (counter)
- cards.revoked.total            (counter)
- cards.validated.total          (counter)
- api.request.duration           (histogram, by endpoint)
- database.query.duration        (histogram)
- tenant.isolation.violations    (counter, alert if > 0)
- event.processing.duration      (histogram)
- circuit.breaker.state          (gauge)

// Logging
Log all:
  - Card lifecycle changes
  - Authorization failures
  - Validation failures
  - Tenant isolation checks
  - External API calls (MembershipContext)

// Alerts
Alert when:
  - Tenant isolation violation
  - Event processing fails
  - Circuit breaker opens
  - Database performance degrades
  - QR code generation fails
```

---

## **SECTION 8: DEPLOYMENT & OPERATIONS**

### **8.1 Pre-Deployment Validation Checklist**

```bash
# 1. Run all tests with coverage
php artisan test --coverage-html=coverage
# Coverage must be >= 90%

# 2. Static analysis
vendor/bin/phpstan analyse --level=8 app/Contexts/DigitalCard
# Must have 0 errors

# 3. Code style
vendor/bin/pint --test app/Contexts/DigitalCard
# Auto-fix with: vendor/bin/pint app/Contexts/DigitalCard

# 4. Security audit
composer audit
# No vulnerable dependencies

# 5. Database migration validation
php artisan tenants:migrate:status --context=DigitalCard
# All pending migrations identified

# 6. Environment configuration
vendor/bin/phpenv variable:audit
# All required env variables present

# 7. Load test (optional but recommended)
vendor/bin/php-load-test --endpoint=/api/v1/cards --duration=10s --concurrency=100
# Response times meet SLA
```

### **8.2 Database Migration Rollback Procedure**

```bash
# Rollback in reverse order (newest first)
php artisan tenants:migrate:rollback --context=DigitalCard --step=1

# Check migration status
php artisan tenants:migrate:status --context=DigitalCard

# If critical failure, restore from backup
# 1. Restore database backup
# 2. Verify data integrity
# 3. Re-run pending migrations
# 4. Run tests
```

### **8.3 Feature Flags for Gradual Rollout**

```php
// Gate-based feature control
Gate::define('feature.digital-cards-v2', function ($user) {
    return config('features.digital_cards_v2') && $user->can('beta-tester');
});

// Usage in controller
if ($this->user()->can('feature.digital-cards-v2')) {
    // New implementation
} else {
    // Fallback to old implementation
}

// Gradual rollout: Start at 5%, increase to 10%, 25%, 50%, 100%
FEATURE_DIGITAL_CARDS_V2_ROLLOUT_PERCENTAGE=5
```

---

## **SECTION 9: DECISION LOG FRAMEWORK**

**Document every significant architectural decision:**

```markdown
### Decision: Use Value Objects for Card IDs

**Context:**
UUIDs in domain model could be passed as wrong type or in wrong format

**Options Considered:**
1. Use raw UUID strings
2. Use Laravel UUID class
3. Create custom CardId value object

**Decision:** Option 3 - Custom CardId value object

**Rationale:**
- Prevents bugs from mixing CardId with MemberId
- Self-validates UUID format in constructor
- Domain layer independence
- Backward compatible with string representation

**Consequences:**
- Slight performance overhead from object creation
- Must cast in Eloquent models
- Mapping required in DTOs

**Status:** Approved & Implemented

**Date:** 2025-12-25
**Decision Maker:** Senior Architect
**Stakeholders:** Backend team, Architects
```

---

## **SECTION 10: COMMUNICATION & PROGRESS TRACKING**

### **10.1 Daily Progress Report Format**

```
DATE: YYYY-MM-DD
PHASE: X (Walking Skeleton/Core Lifecycle/Mobile/etc)

COMPLETED:
  ✓ Created DigitalCard domain entity with state machine
  ✓ Implemented CardIssuancePolicy with 5 business rules
  ✓ Green phase: all 12 tests passing
  ✓ Achieved 92% test coverage
  ✓ PHPStan Level 8 compliance

IN PROGRESS (ETA):
  ⏳ IssueCardHandler implementation (EOD)
  ⏳ Desktop controller endpoints (tomorrow)
  ⏳ Vue admin interface (tomorrow + 1)

BLOCKERS / RISKS:
  🔴 None currently
  🟡 Pending design review on QR code signing approach (Phase 3)

NEXT:
  → Complete controller endpoints
  → Implement Vue admin components
  → Begin integration testing

METRICS:
  Test Count: 42 (38 passing, 4 failing - by design)
  Coverage: 88% (target 90%)
  Lines of Code: 1,240
  Cyclomatic Complexity: Avg 2.1 (max 5)
```

### **10.2 When to Ask for Clarification**

**Stop and ask immediately when:**

1. Tenant isolation requirement is ambiguous
2. Routing case unclear (which API Case applies)
3. Cross-context dependency needed (beyond anti-corruption layer)
4. Security implication uncertain
5. Performance target seems unachievable
6. Business rule interpretation conflicts with schema
7. Test approach questions arise
8. Design contradicts DDD principles

---

## **SECTION 11: FINAL DIRECTIVES**

### **11.1 Non-Negotiable Constraints**

These MUST be enforced on every commit:

1. **Tenant Isolation**
   - Explicit tenant_id on all queries
   - Row-Level Security tested
   - Cross-tenant tests verify 404 responses
   - Zero tolerance for leaks

2. **DDD Layer Separation**
   - Zero imports of Laravel in Domain layer
   - Application layer orchestrates only
   - Infrastructure provides technical implementation
   - Strict dependency direction: Infrastructure → Application → Domain

3. **TDD Workflow**
   - RED phase (failing tests) comes first
   - GREEN phase (minimal implementation) follows
   - REFACTOR phase maintains all tests passing
   - 90%+ coverage non-negotiable

4. **Security Boundaries**
   - Input validation at Application layer boundary
   - Authorization checks before business logic
   - All user input treated as untrusted
   - SQL injection/XSS prevention automatic

5. **Six-Case Routing**
   - Case 2 (Mobile) routes: /{tenant}/mapi/v1/*
   - Case 4 (Desktop) routes: /{tenant}/api/v1/*
   - Tenant slug always present
   - Tenant SPA catch-all route last

### **11.2 Code Quality Enforcement**

**EVERY push to main branch requires:**

```bash
✓ php artisan test              # All tests pass
✓ Coverage >= 90%               # Full coverage report
✓ PHPStan Level 8 clean         # Zero static errors
✓ vendor/bin/pint               # Code style compliant
✓ composer audit                # No vulnerable deps
```

### **11.3 Escalation Path**

**If you encounter issues:**

1. **Code-level problems:** Fix locally, test thoroughly, push
2. **Design ambiguities:** Ask clarifying questions immediately
3. **Architectural conflicts:** Escalate with decision log
4. **Performance concerns:** Benchmark before optimization
5. **Security questions:** Consult with security architect
6. **Cross-context dependencies:** Evaluate anti-corruption layer

---

## **APPENDIX: QUICK REFERENCE**

### **TDD Cheat Sheet**

```php
// Test Structure
<?php
describe('Feature: Issue Digital Card', function () {
    beforeEach(function () {
        $this->tenant = Tenant::factory()->create();
        $this->member = Member::factory()->for($this->tenant)->create();
        actingAsTenant($this->tenant);
    });

    it('issues card with valid data', function () {
        // Arrange
        $command = new IssueCardCommand(
            cardId: (string) Str::uuid(),
            memberId: (string) $this->member->id,
            expiresAt: now()->addYear(),
        );

        // Act
        $handler = app(IssueCardHandler::class);
        $card = $handler->handle($command);

        // Assert
        expect($card->isActive())->toBeFalse();  // Starts as issued
        $this->assertDatabaseHas('digital_cards', [
            'id' => $card->id->value(),
            'status' => 'issued',
        ]);
    });

    it('prevents duplicate active cards per member', function () {
        // Arrange
        Card::factory()
            ->for($this->member)
            ->active()
            ->create();

        // Act & Assert
        $this->expectException(OneActiveCardPerMember::class);
        issueCard($this->member);
    });
});
```

### **Useful Commands**

```bash
# Run tests
php artisan test                           # All tests
php artisan test --filter=DigitalCard      # Specific context
php artisan test --coverage                # With coverage
php artisan test --parallel                # Parallel execution

# Code quality
vendor/bin/phpstan analyse --level=8 app/Contexts/DigitalCard
vendor/bin/pint app/Contexts/DigitalCard --test
composer audit

# Database
php artisan tenants:migrate --context=DigitalCard
php artisan tenants:seed --context=DigitalCard
php artisan tenants:migrate:rollback --context=DigitalCard

# Debugging
php artisan tinker
php artisan migrate:fresh --seed
DB::enableQueryLog(); // In tinker
dd(DB::getQueryLog());
```

---

## **DOCUMENT CONTROL**

**Version:** 1.0
**Last Updated:** 2025-12-25
**Status:** Production Ready
**Owner:** Senior Full-Stack Architect
**Next Review:** Upon Phase completion

**Change Log:**
- v1.0: Initial comprehensive protocol document

---

**This document is the source of truth for DigitalCardContext development. All implementation must comply with these specifications. Questions or ambiguities should be raised immediately.**
