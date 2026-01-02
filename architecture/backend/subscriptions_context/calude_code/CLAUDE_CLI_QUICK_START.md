# **DIGITALCARD CONTEXT - CLAUDE CLI QUICK START GUIDE**

## **Overview**

This guide explains how to use the professional DigitalCardContext prompt engineering document with Claude CLI for rapid, high-quality implementation.

---

## **PHASE 1: PREPARATION (30 minutes)**

### **1.1 Prerequisites**

```bash
# Verify your environment
php -v                              # PHP 8.3+
composer --version                  # Laravel 12.35.1+
npm -v                              # Frontend tooling
npm run dev                         # Verify frontend build

# Verify test environment
php artisan test --help             # PestPHP available
vendor/bin/phpstan --version       # PHPStan installed
vendor/bin/pint --version          # Code formatter installed

# Verify database
php artisan tinker
>>> DB::connection('tenant')->table('digital_cards')->count()  // Should be 0
>>> exit
```

### **1.2 Project Structure Check**

```bash
# Verify context folders exist
mkdir -p app/Contexts/DigitalCard/{Domain,Application,Infrastructure}
mkdir -p app/Contexts/DigitalCard/{Domain/Entities,Domain/ValueObjects,Domain/Services}
mkdir -p app/Contexts/DigitalCard/Application/{Commands,Handlers,DTOs}
mkdir -p app/Contexts/DigitalCard/Infrastructure/{Persistence,Http,Services}

mkdir -p tests/Contexts/DigitalCard/{Feature,Unit}
mkdir -p database/migrations/tenant
mkdir -p routes/tenant
```

### **1.3 Copy the Prompt Document**

```bash
# Download/copy the professional prompt
# File: DIGITALCARD_CONTEXT_PROMPT.md

# Verify it's readable
wc -l DIGITALCARD_CONTEXT_PROMPT.md  # Should be ~1000+ lines
grep "SECTION" DIGITALCARD_CONTEXT_PROMPT.md | head -15  # Verify structure
```

---

## **PHASE 2: CLAUDE CLI EXECUTION STRATEGY**

### **2.1 Full Prompt Approach (Recommended for Phase 0)**

**Use when:** Starting fresh architecture implementation

```bash
# Copy the entire Section 2 + 3 + 4 to Claude CLI
# This covers: Architecture + TDD + Phase 0 Walking Skeleton

claude-cli << 'EOF'
I am a Senior Laravel Developer implementing a DigitalCardContext.

[PASTE SECTIONS 2-4 FROM DIGITALCARD_CONTEXT_PROMPT.md HERE]

YOUR TASK:
Implement Phase 0: Walking Skeleton according to specification.

CONSTRAINTS:
1. Follow TDD workflow (RED → GREEN → REFACTOR)
2. All tests in tests/Contexts/DigitalCard/Feature/DigitalCardWalkingSkeletonTest.php
3. Domain entities in app/Contexts/DigitalCard/Domain/
4. Infrastructure in app/Contexts/DigitalCard/Infrastructure/
5. Achieve 90%+ test coverage
6. PHPStan Level 8 compliance
7. Verify tenant isolation in every test

DELIVERABLES:
- ✓ Failing integration test (RED phase)
- ✓ Minimum Domain layer (DigitalCard aggregate)
- ✓ Domain enums and value objects
- ✓ Infrastructure skeleton (Model, Repository, Controller)
- ✓ Case 4 route: /{tenant}/api/v1/cards
- ✓ Database migration (tenant DB only)
- ✓ All tests passing (GREEN phase)

START WITH: Walking skeleton test that demonstrates tenant isolation
EOF
```

### **2.2 Incremental Approach (Best for Complex Features)**

**Use when:** Implementing specific features iteratively

#### **Phase 0 - Walking Skeleton**

```bash
# STEP 1: Create failing test
claude-cli << 'EOF'
[PASTE SECTION 3: TDD Protocol]
[PASTE SECTION 4.0: Phase 0 - Walking Skeleton]

TASK: Create a failing integration test that:
1. Attempts to issue a digital card for a member
2. Verifies the card is created in tenant DB only
3. Verifies Landlord DB has zero cards
4. Verifies cross-tenant access returns 404

FILE: tests/Contexts/DigitalCard/Feature/DigitalCardWalkingSkeletonTest.php

Use PestPHP syntax shown in Section 3.2
EOF
```

```bash
# STEP 2: Implement Domain layer
claude-cli << 'EOF'
[PASTE SECTION 2.3: DDD Layer Separation]
[PASTE SECTION 4.0 Deliverables: Domain files]

TASK: Implement minimum Domain layer to support failing test:

FILES TO CREATE:
1. app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php
   - Aggregate Root with issue() factory
   - Self-validates invariants

2. app/Contexts/DigitalCard/Domain/Enums/CardStatus.php
   - Values: issued, active, revoked, expired

3. app/Contexts/DigitalCard/Domain/ValueObjects/CardId.php
   - Validates UUID format
   - Self-documents intent

4. app/Contexts/DigitalCard/Domain/ValueObjects/MemberId.php
5. app/Contexts/DigitalCard/Domain/Exceptions/CardException.php

CONSTRAINTS:
- Zero Laravel dependencies in Domain
- Strict types enabled (declare(strict_types=1))
- Final classes and readonly properties
- Type hints on all parameters/returns
- PHPStan Level 8 compliant

Run: vendor/bin/phpstan analyse --level=8 app/Contexts/DigitalCard/Domain
EOF
```

```bash
# STEP 3: Implement Infrastructure skeleton
claude-cli << 'EOF'
[PASTE SECTION 2.3: DDD Layer Separation - Infrastructure]
[PASTE SECTION 2.4: Database Schema]
[PASTE SECTION 4.0 Deliverables]

TASK: Create Infrastructure layer to make tests pass (GREEN phase):

FILES:
1. database/migrations/tenant/YYYY_MM_DD_create_digital_cards_table.php
   - Use schema provided in Section 2.4
   - Constraints for one active per member
   - Indexes for performance

2. app/Contexts/DigitalCard/Infrastructure/Persistence/Eloquent/EloquentDigitalCard.php
   - Eloquent Model
   - Uses fillable = ['member_id', 'status', 'expires_at']
   - Casts for UUID, DateTimeImmutable

3. app/Contexts/DigitalCard/Infrastructure/Persistence/Repositories/EloquentDigitalCardRepository.php
   - Implements Domain RepositoryInterface
   - save() method persists aggregate
   - Must be tenant-aware

4. app/Contexts/DigitalCard/Infrastructure/Http/Controllers/DigitalCardController.php
   - POST /api/v1/cards - Issue card
   - Coordinates Application Handler
   - Returns resource

5. routes/tenant/api.digitalcard.php
   - Case 4 routes (Desktop API)
   - Route: /{tenant}/api/v1/cards

CONSTRAINTS:
- Migration in TENANT database ONLY
- Repository implements Domain interface
- Controller → Handler → Repository flow
- Input validation at boundary (Form Request)
EOF
```

#### **Phase 1 - Core Lifecycle**

```bash
# STEP 4: Complete Phase 1 after Phase 0 passes
claude-cli << 'EOF'
[PASTE SECTION 4.1: Phase 1 - Core Lifecycle MLP]

TASK: Implement Phase 1 business rules

BUSINESS RULES to enforce:
1. One active card per member (already constraint)
2. Expiry must be 1-2 years in future
3. Status transitions: issued → active → revoked/expired
4. Only admins can manage cards

DELIVERABLES:
1. Domain/Services/CardIssuancePolicy.php
   - issuanceAllowed(member, expiresAt)
   - Enforces business rules
   - Throws meaningful exceptions

2. Application/Commands/{Issue,Activate,Revoke}CardCommand.php
3. Application/Handlers/{Issue,Activate,Revoke}CardHandler.php
4. Application/DTOs/CardDTO.php (Spatie Laravel-Data)

5. Infrastructure/Http/Requests/IssueCardRequest.php
   - Validates: member_id (UUID, exists)
   - Validates: expires_at (date, 1-2 years future)

6. Infrastructure/Http/Controllers/DigitalCardController.php
   - Complete CRUD endpoints
   - Authorization: can:manage-digital-cards

7. app/Policies/DigitalCardPolicy.php
   - manage() method for authorization

8. Frontend: resources/js/Pages/Tenant/DigitalCards/Index.vue
   - List, view, issue, activate, revoke
   - QR code display

TESTS REQUIRED:
- All business rules in isolated tests
- Tenant isolation verified
- Authorization enforcement
- 90%+ coverage
EOF
```

### **2.3 Section-by-Section Approach**

**Use for:** Deep architectural questions or specific sections

```bash
# Extract a specific section and ask for clarification
sed -n '/^### 2.1 Multi-Tenancy Rules/,/^### 2.2/p' DIGITALCARD_CONTEXT_PROMPT.md | \
  claude-cli "Explain how this multi-tenancy rule applies to digital card queries"

# Get specific phase details
sed -n '/^### PHASE 0/,/^### PHASE 1/p' DIGITALCARD_CONTEXT_PROMPT.md | \
  claude-cli "Walk me through Phase 0 implementation step-by-step"
```

---

## **PHASE 3: DAILY WORKFLOW**

### **3.1 Morning Standup (15 minutes)**

```bash
# Check progress format
cat << 'EOF'
DATE: 2025-12-26
PHASE: 0 (Walking Skeleton)

COMPLETED:
  ✓ Domain entity (DigitalCard)
  ✓ Value objects (CardId, MemberId)
  ✓ Database migration
  ✓ Eloquent model

IN PROGRESS (ETA):
  ⏳ Repository implementation (today EOD)
  ⏳ Controller endpoints (tomorrow)

BLOCKERS:
  None

NEXT:
  → Complete repository
  → Start integration tests

METRICS:
  Coverage: 0% (Phase 0 not complete)
  Tests: 6 written, 6 failing (RED phase)
  LOC: 340
EOF
```

### **3.2 Development Loop**

```bash
# 1. Write failing test
php artisan test tests/Contexts/DigitalCard/Feature/DigitalCardWalkingSkeletonTest.php
# Expected: 6 failures (RED phase)

# 2. Implement minimum code
vim app/Contexts/DigitalCard/Infrastructure/Persistence/Repositories/...

# 3. Run tests
php artisan test tests/Contexts/DigitalCard/

# 4. Check coverage
php artisan test --coverage-html=coverage tests/Contexts/DigitalCard/

# 5. Check code quality
vendor/bin/phpstan analyse --level=8 app/Contexts/DigitalCard/
vendor/bin/pint app/Contexts/DigitalCard/ --test

# 6. Refactor with all tests green
vim app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php
php artisan test  # Verify still passing
```

### **3.3 End of Day Checklist**

```bash
# All tests pass
php artisan test --filter=DigitalCard

# Coverage >= 90%
php artisan test --coverage-text | grep -i "overall"

# Static analysis clean
vendor/bin/phpstan analyse --level=8 app/Contexts/DigitalCard/

# Code style fixed
vendor/bin/pint app/Contexts/DigitalCard/

# Git commit
git add app/Contexts/DigitalCard/ database/migrations/ routes/ tests/
git commit -m "Phase 0: Walking skeleton - digital card context
- Implement DigitalCard aggregate root
- Create CardId, MemberId value objects
- Database migration with constraints
- Eloquent model and repository
- Controller skeleton
- All tests passing (6/6)
- Coverage: 92%
- PHPStan: Level 8 clean"
```

---

## **PHASE 4: HANDLING COMMON SCENARIOS**

### **4.1 When Tests Fail Unexpectedly**

```bash
# Scenario: Test fails but logic seems correct
claude-cli << 'EOF'
[PASTE your test code]
[PASTE your implementation code]

TEST ERROR: [Copy the full error message]

CONTEXT:
- This is Phase 0: Walking Skeleton
- TDD RED phase
- Testing tenant isolation

HELP: Why is this test failing? What's the issue?
EOF
```

### **4.2 When Design Decision Needed**

```bash
# Use Decision Log Format (Section 9)
claude-cli << 'EOF'
[PASTE relevant section of DIGITALCARD_CONTEXT_PROMPT.md]

I need to decide on implementation approach for:
[Describe the decision point]

OPTIONS:
1. [Option A with pros/cons]
2. [Option B with pros/cons]
3. [Option C with pros/cons]

CONSTRAINTS:
- DDD strict layer separation
- TDD workflow
- Performance target: < 200ms P95

HELP: Which option best fits the specification?
EOF
```

### **4.3 When Performance Issue Arises**

```bash
# Check performance targets
grep -A 20 "## 7.1 Performance SLAs" DIGITALCARD_CONTEXT_PROMPT.md

# Ask Claude for optimization
claude-cli << 'EOF'
[PASTE your query code]

PERFORMANCE ISSUE:
- Expected: < 100ms P95
- Actual: 350ms P95
- Query: [Your slow query]

CONTEXT:
- Phase 1: Core Lifecycle
- Mobile endpoint GET /mapi/v1/my-card
- Member with 15 cards, querying by member_id

HELP: How to optimize this query to meet SLA?
EOF
```

### **4.4 When Security Question Arises**

```bash
# Reference security section
grep -n "SECTION 6:" DIGITALCARD_CONTEXT_PROMPT.md

# Ask for security review
claude-cli << 'EOF'
[PASTE SECTION 6 from prompt]

SECURITY QUESTION: How do I ensure my implementation of [feature]
meets all security requirements for [scenario]?

CONTEXT:
- Feature: ValidateCardCommand
- Scenario: Member validating their own card via mobile

HELP: Security checklist for this scenario?
EOF
```

---

## **PHASE 5: ESCALATION & HANDOFF**

### **5.1 Escalation Decision Tree**

```
Issue encountered?
│
├─ Code-level problem (syntax, logic)
│  └─ FIX LOCALLY → TEST → PUSH
│
├─ Design ambiguity (unclear requirement)
│  └─ ASK IMMEDIATELY using Section 9 Decision Log
│
├─ Architectural conflict (violates DDD/TDD)
│  └─ ESCALATE with decision log to team lead
│
├─ Performance concern (< SLA)
│  └─ BENCHMARK first → optimize with Claude → verify improvement
│
├─ Security question (crypto, validation, isolation)
│  └─ CONSULT Section 6 → ask security architect
│
└─ Cross-context dependency (needs MembershipContext)
   └─ EVALUATE Anti-Corruption Layer → ask architect
```

### **5.2 Handoff Between Team Members**

**When passing to next developer:**

```bash
# Create handoff document
cat > HANDOFF.md << 'EOF'
# Digital Card Context - Phase 1 Handoff

## Completed
- Phase 0: Walking Skeleton (✓ All tests passing)
  - Domain: DigitalCard aggregate, value objects
  - Infrastructure: Model, Repository, Controller
  - Tests: 12 passing, 92% coverage

## In Progress
- Phase 1: Core Lifecycle (50% complete)
  - [ ] CardIssuancePolicy.php
  - [ ] IssueCardHandler.php
  - [ ] ActivateCardHandler.php
  - [ ] RevokeCardHandler.php

## Known Issues
- None blocking

## Performance Baseline
- POST /api/v1/cards:  85ms P95 ✓
- GET /api/v1/cards:   120ms P95 ✓

## Next Steps
1. Complete remaining handlers (2 hours)
2. Implement Vue admin interface (4 hours)
3. Authorization policy (1 hour)
4. Vue components (3 hours)

## Notes
- Follow DIGITALCARD_CONTEXT_PROMPT.md Section 4.1 exactly
- All tests must pass before handoff
- Remember: TDD RED → GREEN → REFACTOR

## Questions?
See DIGITALCARD_CONTEXT_PROMPT.md Section 10.2: When to Ask
EOF

git add HANDOFF.md
git commit -m "Phase 1: Handoff - ready for next developer"
```

---

## **QUICK REFERENCE: SECTION MAPPING**

**For specific tasks, use these sections:**

| **Task** | **Section** | **Command** |
|---|---|---|
| Architecture review | 2 | `grep -n "SECTION 2" DIGITALCARD_CONTEXT_PROMPT.md` |
| TDD setup | 3 | `grep -n "SECTION 3" DIGITALCARD_CONTEXT_PROMPT.md` |
| Phase 0 | 4.0 | `sed -n '/^### PHASE 0/,/^### PHASE 1/p'` |
| Phase 1 | 4.1 | `sed -n '/^### PHASE 1/,/^### PHASE 2/p'` |
| Code quality | 5 | `grep -n "SECTION 5" DIGITALCARD_CONTEXT_PROMPT.md` |
| Security | 6 | `grep -n "SECTION 6" DIGITALCARD_CONTEXT_PROMPT.md` |
| Performance | 7 | `grep -n "SECTION 7" DIGITALCARD_CONTEXT_PROMPT.md` |
| Deployment | 8 | `grep -n "SECTION 8" DIGITALCARD_CONTEXT_PROMPT.md` |
| Progress template | 10.2 | `grep -n "10.2 Daily" DIGITALCARD_CONTEXT_PROMPT.md` |

---

## **SUCCESS METRICS**

### **Phase 0 Success**

- ✓ All tests passing (12/12)
- ✓ Coverage 90%+ (achieved 92%)
- ✓ PHPStan Level 8 clean
- ✓ Zero tenant isolation leaks
- ✓ Code review approved
- ✓ No manual testing needed
- **Duration:** ~8 hours actual coding

### **Phase 1 Success**

- ✓ All lifecycle operations working
- ✓ Business rules enforced
- ✓ Vue admin interface complete
- ✓ Authorization working
- ✓ Coverage 90%+
- **Duration:** ~16 hours actual coding

### **Phase 2 Success**

- ✓ Mobile API functional
- ✓ Member can view card
- ✓ QR validation working
- ✓ Offline caching (5-min TTL)
- ✓ Sanctum authentication
- **Duration:** ~12 hours actual coding

---

## **FINAL REMINDERS**

```
1. ALWAYS READ THE ERROR MESSAGE FIRST
   - Errors tell you what's wrong
   - 90% of issues are obvious from error text

2. FOLLOW TDD STRICTLY
   - Tests first, implementation second
   - Don't skip REFACTOR phase
   - Coverage isn't optional

3. ASK WHEN UNCERTAIN
   - Better to ask than implement wrong
   - This is a complex domain
   - Use Section 10.2 decision framework

4. COMMIT FREQUENTLY
   - At least once per completed task
   - Use meaningful commit messages
   - Include test counts in commits

5. CHECK CONSTRAINTS CONTINUOUSLY
   - PHPStan after every file
   - Coverage after every test
   - Tenant isolation in every test

6. REFERENCE THE PROMPT
   - It has answers to most questions
   - Sections are cross-referenced
   - Appendix has quick lookup
```

---

**YOU ARE READY TO START IMPLEMENTATION** 

Begin with:
1. Read SECTION 2 of DIGITALCARD_CONTEXT_PROMPT.md (Architecture)
2. Read SECTION 3 of DIGITALCARD_CONTEXT_PROMPT.md (TDD)  
3. Read SECTION 4.0 of DIGITALCARD_CONTEXT_PROMPT.md (Phase 0)
4. Run the Phase 0 prompt in Claude CLI

**Expected outcome:** Walking skeleton working with 90%+ coverage in ~8 hours
