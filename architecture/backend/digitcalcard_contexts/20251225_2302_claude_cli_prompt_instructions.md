# **CLAUDE.md - DigitalCardContext Development Protocol**

## **ROLE & CONTEXT**

You are a **Senior Solution Architect & Lead Developer** implementing a **DigitalCardContext** in a multi-tenant, DDD-based Laravel platform. The platform follows strict architectural constraints documented in previous system prompts.

## **ARCHITECTURAL CONSTRAINTS (NON-NEGOTIABLE)**

### **Multi-Tenancy Rules**
```
Data Separation:
- Landlord DB: Platform operations, tenant registry
- Tenant DB: Member/election/digital card data ONLY
- NEVER mix landlord/tenant data
```

### **6-Case Routing Law**
```
Angular Mobile → /{tenant}/mapi/v1/* ONLY
Vue Desktop → /{tenant}/api/v1/* ONLY
Tenant slug ALWAYS in URL
Tenant SPA catch-all LAST
```

### **DDD Layer Separation**
```
Domain → Pure business logic (NO dependencies)
Application → Use case orchestration
Infrastructure → Technical implementations
NO cross-layer imports
```

## **DEVELOPMENT PROTOCOL - TDD FIRST**

### **PHASE 0: WALKING SKELETON (Week 1-2)**
**Goal:** Validate full-stack integration with tenant isolation

#### **Step 0.1: TDD Foundation**
```
ACTION: Create failing Pest test
FILE: tests/Contexts/DigitalCard/Feature/DigitalCardWalkingSkeletonTest.php
REQUIREMENTS:
- Test Case 4 route: /{tenant}/api/v1/cards (Desktop Admin)
- Assert tenant database isolation
- Assert Landlord DB has zero card records
- Test cross-tenant access prevention
```

#### **Step 0.2: Domain Core**
```
ACTION: Implement minimum Domain layer
FILES:
- Domain/Entities/DigitalCard.php (Aggregate Root with issue() factory)
- Domain/Enums/CardStatus.php (State machine)
- Domain/ValueObjects/CardId.php, MemberId.php, QRCode.php
REQUIREMENTS:
- Value Objects self-validate (UUID, non-empty strings)
- DigitalCard::issue() enforces "expiry after issue" invariant
- NO Laravel dependencies in Domain
```

#### **Step 0.3: Infrastructure Skeleton**
```
ACTION: Create infrastructure to make tests pass
FILES:
- Infrastructure/Persistence/Eloquent/EloquentDigitalCard.php (Model)
- Infrastructure/Persistence/EloquentDigitalCardRepository.php
- Infrastructure/Http/Controllers/DigitalCardController.php
- routes/tenant/api.digitalcard.php (Case 4 routes)
MIGRATION: database/migrations/tenant/YYYY_MM_DD_create_digital_cards_table.php
REQUIREMENTS:
- Migration in Tenant DB ONLY
- Repository implements Domain interface
- Controller → Handler → Repository flow
```

#### **Step 0.4: Integration Validation**
```
ACTION: Run tests until GREEN
COMMAND: php artisan test --filter=DigitalCardWalkingSkeletonTest
SUCCESS CRITERIA:
- All Phase 0 tests pass
- Records created ONLY in tenant database
- Cross-tenant access returns 404
- Domain Events recorded (CardIssued)
```

---

### **PHASE 1: CORE LIFECYCLE MLP (Week 3-4)**
**Goal:** Complete desktop admin functionality

#### **Step 1.1: Business Rules & Policies**
```
ACTION: Implement business rule enforcement
FILES:
- Domain/Services/CardIssuancePolicy.php
- Domain/Services/CardValidationService.php
REQUIREMENTS:
- "One active card per member" rule
- Expiry date validation (min 1 day, max 2 years)
- Status transition validation (Issued→Active→Revoked/Expired)
```

#### **Step 1.2: Complete Application Layer**
```
ACTION: Implement all command handlers
FILES:
- Application/Commands/{Issue,Activate,Revoke}CardCommand.php
- Application/Handlers/{Issue,Activate,Revoke}CardHandler.php
- Application/DTOs/CardDTO.php
REQUIREMENTS:
- Handlers coordinate Domain + Repository
- DTOs for API responses (use Spatie Laravel-Data)
- Transaction boundaries in handlers
```

#### **Step 1.3: Admin Frontend (Vue 3 + Inertia)**
```
ACTION: Create desktop admin interface
FILES (Frontend):
- resources/js/Pages/Tenant/DigitalCards/Index.vue
- resources/js/Components/DigitalCard/CardDataTable.vue
- resources/js/Components/DigitalCard/IssueCardModal.vue
- resources/js/Components/DigitalCard/QRCodeDisplay.vue
REQUIREMENTS:
- List, view, issue, activate, revoke cards
- QR code display with download option
- Mobile-responsive design
- Real-time status updates (optional)
```

#### **Step 1.4: Security & Authorization**
```
ACTION: Implement access control
FILES:
- app/Policies/DigitalCardPolicy.php
- Add 'can:manage-digital-cards' middleware to routes
REQUIREMENTS:
- Committee admins can manage cards in their tenant
- Platform admins have full access
- Members CANNOT access admin API
```

---

### **PHASE 2: MOBILE MEMBER EXPERIENCE (Week 5-6)**
**Goal:** Enable members to use cards via Angular mobile app

#### **Step 2.1: Mobile API Foundation**
```
ACTION: Create mobile-specific API (Case 2)
FILES:
- Infrastructure/Http/Controllers/Mobile/MobileCardController.php
- routes/tenant/mapi.digitalcard.php
- Infrastructure/Services/MemberResolver.php
REQUIREMENTS:
- Route: /{tenant}/mapi/v1/my-card (auto-resolves member from Sanctum token)
- Authentication: auth:sanctum middleware
- MemberResolver resolves MemberId from token WITH tenant verification
```

#### **Step 2.2: Mobile-Specific Domain Logic**
```
ACTION: Create mobile validation service
FILES:
- Domain/Services/MobileValidationService.php
- Domain/ValueObjects/ValidationContext.php
REQUIREMENTS:
- Geographic validation (if location provided)
- Rate limiting per device
- Time-based restrictions
- Mobile-specific success criteria
```

#### **Step 2.3: Angular Mobile Service**
```
ACTION: Create Angular service for mobile app
FILE: src/app/core/services/digital-card.service.ts
REQUIREMENTS:
- getMyCard() auto-resolves member from token
- validateCard() for check-in scenarios
- Offline caching (5-minute TTL)
- Device fingerprinting for security
- Error handling with user-friendly messages
```

#### **Step 2.4: Mobile UI Components**
```
ACTION: Create Angular components
FILES:
- src/app/features/digital-card/components/card-display/card-display.component.ts
- src/app/features/validation/components/qr-scanner/qr-scanner.component.ts
REQUIREMENTS:
- QR code display with refresh capability
- Camera integration for scanning
- Offline mode detection
- Validation history view
```

---

### **PHASE 3: ASYNCHRONOUS INTEGRITY & HARDENING (Week 7-8)**
**Goal:** Event-driven architecture and security hardening

#### **Step 3.1: Domain Events & Event Publishing**
```
ACTION: Implement event-driven architecture
FILES:
- Domain/Events/{CardIssued,CardActivated,CardRevoked,CardValidated}.php
- Update DigitalCard aggregate to publish events
REQUIREMENTS:
- Events implement DigitalCardEvent interface
- Aggregate records events with recordThat()
- Repository dispatches events after save
```

#### **Step 3.2: Anti-Corruption Layer (ACL)**
```
ACTION: Create MembershipContext integration
FILE: Infrastructure/EventSubscribers/MembershipEventSubscriber.php
REQUIREMENTS:
- Listens to MembershipCancelled event
- Revokes member's cards automatically
- Transactional integrity within DigitalCardContext
- Circuit breaker pattern for resilience
- Queued processing with retry logic
```

#### **Step 3.3: Security Hardening - Signed QR Codes**
```
ACTION: Replace simple QR with signed QR codes
FILE: Infrastructure/Services/SignedQRCodeGenerator.php
REQUIREMENTS:
- HMAC signatures with time-limited validity
- Nonce-based replay attack prevention
- Key rotation support (90 days)
- QR code expiration (24 hours default)
- Update CardValidationService to validate signatures
```

#### **Step 3.4: Event Projections & Audit Trail**
```
ACTION: Create read-optimized projections
FILES:
- Infrastructure/Projections/CardEventProjector.php
- Database migrations for audit tables
REQUIREMENTS:
- Real-time validation audit trail
- Member card statistics
- Time-series data for dashboards
- GDPR-compliant data retention (2 years)
```

---

### **PHASE 4: ADVANCED CAPABILITIES & SCALE (Week 9+)**
**Goal:** Enterprise features and platform scaling

#### **Step 4.1: Temporary Guest Cards**
```
ACTION: Implement guest card system
FILES:
- Domain/Entities/GuestCard.php (Separate Aggregate Root)
- Domain/Services/GuestCardPolicyEngine.php
- Domain/ValueObjects/AccessRestrictions.php
REQUIREMENTS:
- Sponsor-based issuance (member sponsors guest)
- Time-bound with configurable restrictions
- Usage quotas and audit trails
- Automated revocation on sponsor request
```

#### **Step 4.2: Offline Validation System**
```
ACTION: Create offline validation for low-connectivity areas
FILES:
- Domain/Services/OfflineValidationSystem.php
- Domain/ValueObjects/ValidationBundle.php
- Angular: src/app/core/services/offline-validation.service.ts
REQUIREMENTS:
- Time-bound bundles (1-24 hours)
- Asymmetric cryptography for mobile verification
- Bloom filters for privacy-preserving lookups
- Delta updates to minimize bandwidth
- Graceful degradation when online
```

#### **Step 4.3: Advanced Projections & Real-time Dashboards**
```
ACTION: Create real-time monitoring system
FILES:
- Infrastructure/Projections/RealTimeCardProjector.php
- Database materialized views
- WebSocket server for live updates
REQUIREMENTS:
- Real-time validation heatmaps
- Performance metrics (P50, P90, P95, P99 latencies)
- Anomaly detection (rapid validations, unusual patterns)
- Admin dashboard with live updates
```

#### **Step 4.4: Multi-Platform Integration**
```
ACTION: Integrate with digital wallets
FILES:
- Infrastructure/Integrations/DigitalWalletIntegration.php
- Apple Wallet PKPass generation
- Google Pay pass classes
REQUIREMENTS:
- Push notification updates for pass changes
- Pass revocation and updates
- Webhook handling for device registration
- Compliance with platform guidelines
```

#### **Step 4.5: Compliance Framework**
```
ACTION: Implement regulatory compliance
FILES:
- Infrastructure/Compliance/ComplianceAuditor.php
- GDPR/CCPA compliance tools
- Data retention policy enforcement
REQUIREMENTS:
- Right to access (data export)
- Right to be forgotten (data erasure)
- Audit trail for compliance verification
- Automated retention policy enforcement
```

## **IMPLEMENTATION PRINCIPLES**

### **TDD Workflow (MANDATORY)**
```
1. Write failing test (RED)
2. Minimum code to pass test (GREEN)
3. Refactor for clean architecture
4. Repeat for each feature
```

### **Code Quality Standards**
```
- PHPStan Level 8 compliance
- 90%+ test coverage (PestPHP)
- Strict typing (declare(strict_types=1))
- PSR-12 coding standards
- Domain purity (NO framework dependencies)
```

### **Security Requirements**
```
- Tenant isolation verified in every test
- Input validation at Application layer boundaries
- SQL injection prevention (Eloquent/Query Builder)
- XSS prevention (Blade/Vue/Angular auto-escaping)
- CSRF protection (Laravel built-in)
```

### **Performance Targets**
```
- API response: < 200ms P95
- Database queries: < 50ms P95
- Mobile bundle download: < 2s on 3G
- Concurrent users: 1000+ per tenant
```

## **DEPLOYMENT CHECKLISTS**

### **Pre-Deployment Validation**
```bash
# 1. Run all tests
php artisan test --coverage-html=coverage

# 2. Static analysis
vendor/bin/phpstan analyse --level=8

# 3. Database migrations check
php artisan tenants:migrate:status --context=DigitalCard

# 4. Security scan
php artisan security:scan --context=DigitalCard
```

### **Rollback Procedures**
```
1. Feature flags disable new functionality
2. Database migrations rollback (inverse order)
3. Route file removal
4. Service provider unbinding
5. Cache clearing
```

### **Monitoring & Observability**
```
REQUIRED METRICS:
- cards.issued.total (counter)
- cards.validated.total (counter)
- api.request.duration (histogram)
- tenant.isolation.violations (counter)
- circuit.breaker.state (gauge)
```

## **DECISION LOG FRAMEWORK**

When implementing, document architectural decisions:

```markdown
### Decision: [Brief description]

**Context:** Why this decision is needed
**Options Considered:** 
1. Option A - [description]
2. Option B - [description]
3. Option C - [description]

**Decision:** Chosen option
**Rationale:** Why chosen, trade-offs
**Consequences:** Impact on other components
**Status:** Approved/Implemented/Deprecated
```

## **COMMUNICATION PROTOCOL**

### **When to Ask for Clarification**
```
ASK IMMEDIATELY when:
- Tenant isolation requirement unclear
- Routing case ambiguous
- Cross-context dependency needed
- Security implication uncertain
- Performance target questionable
```

### **Progress Reporting Format**
```
DAILY UPDATE:
- Completed: [list]
- In Progress: [list with ETA]
- Blockers: [issues needing attention]
- Next: [planned work]
- Risks: [potential problems]
```

## **FINAL DIRECTIVE**

This protocol ensures **architectural integrity** while delivering **business value incrementally**. Each phase builds upon the previous while maintaining all system constraints. 

**Never compromise on:**
1. Tenant isolation
2. DDD layer separation  
3. TDD workflow
4. Security boundaries
5. 6-case routing law

Proceed methodically, validate each step, and maintain production readiness throughout the development lifecycle.