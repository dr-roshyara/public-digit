
# **🎯 Professional Prompt Engineering Instructions**

## **For AI Code Generation in Public Digit Platform**

---

# **📱 MOBILE API CONTROLLER (Angular App)**

## **CONTEXT**
```prompt
You are developing a **Mobile API Controller** for the Angular mobile application in Public Digit Platform.

**System Context:**
- Platform: Public Digit - Multi-tenant digital democracy platform
- Client: Angular + Ionic mobile app (Member-facing)
- API Prefix: `/mapi/` (Mobile API)
- Architecture: DDD with Context separation
- Current Phase: 3 - Mobile API Implementation

**Reference Architecture:**
- Desktop API (Vue 3): `/api/` - Already implemented in Phase 2
- Mobile API (Angular): `/mapi/` - This is what we're building now

**Tenant Resolution:**
Angular Mobile → `/mapi/` (stateless, no tenant context)
              → `/{tenant}/mapi/` (tenant-specific APIs)
```

## **TECHNICAL CONSTRAINTS**
```prompt
**HARD REQUIREMENTS (Non-negotiable):**
1. **Route Pattern**: MUST use `/mapi/v1/` prefix for mobile APIs
2. **Authentication**: Laravel Sanctum (stateless tokens)
3. **CSRF**: Excluded (mobile API - no web security)
4. **Response Format**: Consistent JSON with `{data: ..., meta: ..., links: ...}` structure
5. **Error Handling**: Domain exceptions → 400/404/500 with proper messages
6. **Tenant Context**: Extract from URL: `/{tenant}/mapi/v1/...`
7. **Caching**: Mobile-optimized (shorter TTL, ETag support)

**DDD RULES (From CLAUDE.md):**
- Rule 3: Commands MUST have TenantId as first parameter
- Rule 5: Handlers MUST validate tenant ownership
- Rule 7: Extract TenantId from URL parameter
- Rule 11: Inject TenantConnectionManagerInterface
- Rule 12: Throw TenantAccessDeniedException for violations

**Mobile-Specific Constraints:**
- NO session-based authentication
- YES token-based (Sanctum)
- Optimized for mobile data (thin payloads)
- Offline-first considerations
- Push notification support hooks
```

## **EXAMPLE PROMPT STRUCTURE**
```prompt
Create a Mobile API Controller for `DigitalCard` feature with these specifications:

**Feature**: Digital Member Card
**Purpose**: Members view their digital membership card in mobile app
**Bounded Context**: Membership Context
**Tenant Scope**: Per-tenant (members belong to specific tenant)

**API Endpoints Required:**
1. `GET /{tenant}/mapi/v1/digital-cards/{memberId}` - Get digital card
2. `GET /{tenant}/mapi/v1/digital-cards/{memberId}/qr` - Get QR code
3. `POST /{tenant}/mapi/v1/digital-cards/{memberId}/refresh` - Refresh card

**Business Rules:**
- Member must be active in tenant
- Digital card expires annually
- QR code contains encrypted member data
- Refresh requires authentication

**DDD Components Needed:**
- DigitalCardController (Mobile API layer)
- GetDigitalCardQuery + Handler (Application layer)
- DigitalCard entity (Domain layer)
- DigitalCardRepositoryInterface (Domain contract)
- DigitalCardQRGenerator (Domain service)

**Mobile Optimization Requirements:**
- Response under 5KB
- Include cache headers (max-age=3600)
- Support ETag for conditional requests
- Include offline TTL in response meta
- Return member photo as Base64 (small size)

**Security Requirements:**
- Validate member belongs to requesting tenant
- Check digital card expiration
- Rate limit: 10 requests/minute per member
- Audit log all card accesses

**Example Response Structure:**
```json
{
  "data": {
    "id": "uuid",
    "member_name": "John Doe",
    "card_number": "MEM-2024-001",
    "expires_at": "2024-12-31",
    "photo_base64": "...",
    "qr_data": "encrypted:...",
    "status": "active"
  },
  "meta": {
    "offline_ttl": 86400,
    "last_updated": "2024-01-06T10:30:00Z",
    "version": "1.0"
  },
  "links": {
    "self": "/nrna/mapi/v1/digital-cards/uuid-123",
    "qr": "/nrna/mapi/v1/digital-cards/uuid-123/qr",
    "refresh": "/nrna/mapi/v1/digital-cards/uuid-123/refresh"
  }
}
```

**Testing Requirements:**
- 100% test coverage
- Test tenant isolation
- Test mobile network simulation
- Test offline scenarios
- Test rate limiting

**File Structure:**
```
app/Contexts/Membership/
├── UI/API/Mobile/
│   └── DigitalCardController.php      # <- Create this
├── Application/
│   ├── Queries/GetDigitalCardQuery.php
│   └── Handlers/GetDigitalCardHandler.php
├── Domain/
│   ├── Entities/DigitalCard.php
│   ├── Services/DigitalCardQRGenerator.php
│   └── Repositories/DigitalCardRepositoryInterface.php
└── Infrastructure/
    └── Repositories/EloquentDigitalCardRepository.php
```

**Additional Notes:**
- Follow existing BrandingController pattern from Phase 2
- Use same exception handling middleware
- Include OpenAPI/Swagger annotations
- Add to API documentation in `/docs/mapi/v1/`
```

---

# **🖥️ ADMIN API CONTROLLER (Vue 3 Desktop)**

## **CONTEXT**
```prompt
You are developing an **Admin API Controller** for the Vue 3 desktop admin interface in Public Digit Platform.

**System Context:**
- Platform: Public Digit - Multi-tenant digital democracy platform  
- Client: Vue 3 + Inertia.js desktop admin (Staff-facing)
- API Prefix: `/api/admin/` (Admin API)
- Architecture: DDD with Context separation
- Current Phase: 4 - Admin Interface Implementation

**Reference Architecture:**
- Public API: `/api/public/` - Phase 2 completed
- Mobile API: `/mapi/` - Phase 3 in progress
- Admin API: `/api/admin/` - This is what we're building

**Admin vs Public Distinction:**
- Public APIs: Read-only, tenant-specific, cached
- Admin APIs: Read-write, platform-wide, authenticated
```

## **TECHNICAL CONSTRAINTS**
```prompt
**HARD REQUIREMENTS (Non-negotiable):**
1. **Route Pattern**: MUST use `/api/admin/v1/` prefix for admin APIs
2. **Authentication**: Laravel Sanctum (session-based for web)
3. **CSRF**: REQUIRED (web admin interface)
4. **Authorization**: Role-Based Access Control (RBAC) per tenant
5. **Response Format**: Consistent JSON with pagination support
6. **Validation**: FormRequest validation with detailed errors
7. **Audit Logging**: All admin actions must be logged

**DDD RULES (From CLAUDE.md):**
- Rule 2: Repository methods MUST use "ForTenant" naming
- Rule 4: Domain layer pure (no framework dependencies)
- Rule 6: Infrastructure abstracts tenancy packages
- Rule 9: Tests MUST verify tenant isolation
- Rule 14: ALL queries MUST include tenant scope

**Admin-Specific Constraints:**
- Bulk operations support
- Export functionality (CSV, PDF)
- Soft deletes with restore
- Activity logging
- Approval workflows
- Dashboard analytics endpoints
```

## **EXAMPLE PROMPT STRUCTURE**
```prompt
Create an Admin API Controller for `TenantManagement` with these specifications:

**Feature**: Tenant Administration
**Purpose**: Platform admins manage tenants (create, update, suspend)
**Bounded Context**: Platform Context
**Tenant Scope**: Platform-wide (admin sees all tenants)

**API Endpoints Required:**
1. `GET /api/admin/v1/tenants` - List tenants (paginated, filtered)
2. `POST /api/admin/v1/tenants` - Create new tenant
3. `GET /api/admin/v1/tenants/{tenantId}` - Get tenant details
4. `PUT /api/admin/v1/tenants/{tenantId}` - Update tenant
5. `DELETE /api/admin/v1/tenants/{tenantId}` - Soft delete tenant
6. `POST /api/admin/v1/tenants/{tenantId}/suspend` - Suspend tenant
7. `POST /api/admin/v1/tenants/{tenantId}/restore` - Restore tenant
8. `GET /api/admin/v1/tenants/{tenantId}/metrics` - Get tenant metrics

**Business Rules:**
- Only platform admins (role: platform-admin) can access
- Tenant creation triggers database provisioning
- Suspension prevents new member signups
- Soft delete retains data for 30 days
- Metrics include member count, election stats, storage usage

**DDD Components Needed:**
- AdminTenantController (Admin API layer)
- CreateTenantCommand + Handler (Application layer)
- Tenant entity (Domain layer - extends existing)
- TenantRepositoryInterface (extend with admin methods)
- TenantProvisioningService (Domain service)
- TenantMetricsCalculator (Domain service)

**Admin Interface Requirements:**
- Full CRUD with validation
- Bulk operations (suspend multiple tenants)
- Export to CSV functionality
- Advanced filtering (status, date range, size)
- Dashboard summary endpoint
- Activity timeline per tenant

**Security Requirements:**
- RBAC: platform-admin role required
- Audit log all admin actions
- Rate limit: 100 requests/minute per admin
- IP whitelisting for sensitive operations
- Two-factor for tenant deletion

**Example Response Structure (List):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "NRNA",
      "slug": "nrna",
      "status": "active",
      "member_count": 1250,
      "created_at": "2024-01-01T00:00:00Z",
      "links": {
        "self": "/api/admin/v1/tenants/uuid-123",
        "metrics": "/api/admin/v1/tenants/uuid-123/metrics"
      }
    }
  ],
  "meta": {
    "total": 45,
    "per_page": 20,
    "current_page": 1,
    "last_page": 3,
    "filters": {
      "status": "active",
      "sort_by": "member_count"
    }
  },
  "links": {
    "first": "/api/admin/v1/tenants?page=1",
    "last": "/api/admin/v1/tenants?page=3",
    "prev": null,
    "next": "/api/admin/v1/tenants?page=2"
  }
}
```

**Testing Requirements:**
- Test RBAC permissions
- Test tenant isolation breaches
- Test audit logging
- Test bulk operations
- Test export functionality
- Test provisioning workflows

**File Structure:**
```
app/Contexts/Platform/
├── UI/API/Admin/
│   └── TenantController.php           # <- Create this
├── Application/
│   ├── Commands/CreateTenantCommand.php
│   ├── Commands/SuspendTenantCommand.php
│   └── Handlers/CreateTenantHandler.php
├── Domain/
│   ├── Services/TenantProvisioningService.php
│   ├── Services/TenantMetricsCalculator.php
│   └── Repositories/TenantRepositoryInterface.php
└── Infrastructure/
    ├── Repositories/EloquentTenantRepository.php
    └── Listeners/TenantEventAuditLogger.php
```

**Additional Notes:**
- Extend existing Tenant entity from Platform context
- Use same validation patterns as BrandingController
- Include comprehensive OpenAPI documentation
- Add to admin API documentation in `/docs/admin/v1/`
- Follow existing audit logging patterns from ElectionSetup context
```

---

# **🔄 COMPARISON MATRIX**

| **Aspect** | **Mobile API (Angular)** | **Admin API (Vue 3)** |
|------------|--------------------------|------------------------|
| **Route Prefix** | `/mapi/v1/` | `/api/admin/v1/` |
| **Authentication** | Sanctum tokens (stateless) | Sanctum sessions (web) |
| **CSRF Protection** | ❌ Excluded | ✅ Required |
| **Tenant Context** | URL: `/{tenant}/mapi/` | Platform-wide |
| **Caching Strategy** | Shorter TTL (3600s), ETag | Varies, less caching |
| **Payload Size** | Optimized (<5KB) | Full data with relationships |
| **Error Responses** | Mobile-optimized messages | Detailed admin messages |
| **Rate Limiting** | Strict (10/min per user) | Higher (100/min per admin) |
| **Offline Support** | ✅ TTL in meta | ❌ Not needed |
| **Bulk Operations** | Limited | ✅ Comprehensive |
| **Export Features** | Basic | ✅ CSV, PDF, Excel |
| **Audit Logging** | Essential actions | ✅ All actions |

---

# **🎯 PROMPT ENGINEERING TIPS**

## **1. Start with Context Declaration**
```prompt
CONTEXT: You are developing a [Mobile/Admin] API Controller for [Feature] in Public Digit Platform...
```

## **2. Specify Technical Constraints**
```prompt
HARD REQUIREMENTS:
1. Route MUST follow /mapi/v1/ or /api/admin/v1/ pattern
2. Authentication MUST use [Sanctum tokens/sessions]
3. DDD Rules 3,5,7,11,12 MUST be followed
...
```

## **3. Provide Concrete Examples**
```prompt
EXAMPLE RESPONSE STRUCTURE:
{
  "data": {...},
  "meta": {...},
  "links": {...}
}
```

## **4. Define File Structure**
```prompt
FILE STRUCTURE:
app/Contexts/[Context]/UI/API/[Mobile|Admin]/Controller.php
app/Contexts/[Context]/Application/Commands/...
app/Contexts/[Context]/Domain/...
```

## **5. Include Testing Requirements**
```prompt
TESTING REQUIREMENTS:
- 100% test coverage
- Tenant isolation tests
- Authentication tests
- Error case tests
```

## **6. Reference Existing Patterns**
```prompt
FOLLOW EXISTING PATTERNS:
- Exception handling like BrandingController
- Repository pattern like TenantRepository
- Validation like [ExistingController]
```

---

# **📋 TEMPLATE FOR NEW CONTROLLERS**

```prompt
Create a [Mobile/Admin] API Controller for [Feature Name] with these specifications:

## CONTEXT
[Describe feature, bounded context, purpose]

## API ENDPOINTS REQUIRED
[List endpoints with HTTP methods]

## BUSINESS RULES
[List domain business rules]

## DDD COMPONENTS NEEDED
[List Domain, Application, Infrastructure components]

## [MOBILE/ADMIN] SPECIFIC REQUIREMENTS
[List client-specific constraints]

## SECURITY REQUIREMENTS
[List authentication, authorization, rate limiting]

## EXAMPLE RESPONSE STRUCTURE
[Show JSON example]

## TESTING REQUIREMENTS
[List test scenarios]

## FILE STRUCTURE
[Show expected file locations]

## ADDITIONAL NOTES
[Reference existing patterns, documentation needs]
```

---

**Use these prompts with Claude Code, GitHub Copilot, or any AI coding assistant to generate consistent, architecturally-sound API controllers for the Public Digit Platform.**

##############################
Update to above insturctionns: 
# **🔍 CRITICAL ARCHITECTURE REVIEW**

## **🚨 SERIOUS ARCHITECTURAL FLAWS IDENTIFIED**

### **1. **FATAL FLAW: Mobile API Tenant Resolution is WRONG**

```diff
- WRONG: Angular Mobile → `/mapi/` (stateless, no tenant context)
- WRONG: Angular Mobile → `/{tenant}/mapi/` (tenant-specific APIs)

+ CORRECT: Angular Mobile → `/mapi/v1/auth/login` (platform login)
+ CORRECT: Angular Mobile → `/{tenant}/mapi/v1/*` (ALL tenant APIs)
```

**Why This Matters**: According to your **CLAUDE.md ROUTING LAW - 6-CASE SYSTEM**:

```
CASE 1: /mapi/*           → Platform Mobile API (Landlord DB)    # ONLY for login/auth
CASE 2: /{tenant}/mapi/*  → Tenant Mobile API (Tenant DB)        # ALL other mobile APIs
```

**The Critical Error**: Your prompt says mobile APIs can be tenant-agnostic (`/mapi/`). This violates the **entire multi-tenant architecture**. 

**Consequences**:
- ❌ Tenant data isolation breached
- ❌ Cross-tenant queries possible
- ❌ Security nightmare
- ❌ Violates CLAUDE.md routing law

### **2. **Incorrect Authentication Strategy**

```diff
- MOBILE: "Sanctum tokens (stateless)" 
+ MOBILE: "Sanctum tokens (stateless) + Tenant selection flow"

- ADMIN: "Sanctum sessions (web)"
+ ADMIN: "Session-based + platform-admin RBAC"
```

**Missing Mobile Auth Flow**:
```javascript
// Current Angular mobile flow (from CLAUDE.md):
1. POST /mapi/v1/auth/login           // Platform login
2. Receive token + tenant list
3. User selects tenant
4. ALL further calls: /{tenant}/mapi/v1/*
```

Your prompt **omits this critical flow**, which means:
- ❌ No tenant selection mechanism
- ❌ Wrong token scope assumptions
- ❌ Missing `/mapi/v1/auth/tenants` endpoint

### **3. **DDD Rule Violations in Prompts**

**From CLAUDE.md RULE 3**:
```
❌ WRONG: "CreateTenantCommand + Handler (Application layer)"
✅ CORRECT: "CreateTenantCommand(TenantId $tenantId, ...) + Handler"
```

**Missing in your prompts**:
- No `TenantId` as first parameter in commands
- No tenant ownership validation in handlers
- No "ForTenant" repository method naming enforcement

### **4. **Database Connection Management Missing**

**From CLAUDE.md RULE 6**:
```
❌ MISSING: "TenantConnectionManagerInterface injection"
❌ MISSING: "Connection switching logic encapsulation"
```

Your prompts assume correct database connections magically happen. They won't.

### **5. **Security Model Incomplete**

**Missing Critical Elements**:
- ❌ No mention of `identify.tenant` middleware
- ❌ No tenant slug validation against reserved words
- ❌ No cross-tenant access prevention in admin APIs
- ❌ No mention of OWASP Top-10 protections

---

## **📊 ARCHITECTURAL MISMATCH ANALYSIS**

### **Mobile API Reality Check**
```php
// Your prompt assumes:
Route::get('/mapi/v1/digital-cards/{memberId}', ...);

// Reality must be:
Route::get('/{tenant}/mapi/v1/digital-cards/{memberId}', ...)
    ->middleware(['api', 'identify.tenant']);  // <-- CRITICAL
```

### **Admin API Platform Scope Issue**
```php
// Your prompt: Platform-wide admin APIs
// Problem: Violates "Database Isolation" rule

// From CLAUDE.md:
"Landlord DB → tenants, users, permissions
Tenant DB   → members, elections, votes
Cross-tenant queries are FORBIDDEN."

// But your admin APIs would need cross-tenant queries!
```

---

## **🛠️ CRITICAL UPDATES REQUIRED**

### **UPDATE 1: Fix Mobile API Prompt**
```prompt
**CORRECT MOBILE API CONSTRAINTS:**

1. **Authentication Flow** (MANDATORY):
   - Step 1: POST /mapi/v1/auth/login (platform credentials)
   - Step 2: Returns token + available tenants
   - Step 3: User selects tenant
   - Step 4: ALL subsequent calls: /{tenant}/mapi/v1/*

2. **Route Pattern**: 
   - Auth: /mapi/v1/*
   - Tenant APIs: /{tenant}/mapi/v1/*

3. **Middleware**: 
   - /mapi/* → ['api']
   - /{tenant}/mapi/* → ['api', 'identify.tenant']

4. **Tenant Validation**:
   - MUST validate tenant slug exists
   - MUST check tenant is active
   - MUST use identify.tenant middleware
```

### **UPDATE 2: Fix DDD Compliance in Prompts**
```prompt
**DDD ENFORCEMENT IN PROMPTS:**

// COMMANDS MUST follow Rule 3:
class CreateDigitalCardCommand
{
    public function __construct(
        public readonly TenantId $tenantId,  // FIRST parameter
        public readonly MemberId $memberId,
        // ...
    ) {}
}

// HANDLERS MUST follow Rule 5:
class CreateDigitalCardHandler
{
    public function handle(CreateDigitalCardCommand $command): void
    {
        // MUST validate tenant ownership
        if (!$member->belongsToTenant($command->tenantId)) {
            throw new TenantAccessDeniedException();
        }
    }
}

// REPOSITORIES MUST follow Rule 2:
interface DigitalCardRepositoryInterface
{
    public function findForTenant(DigitalCardId $id, TenantId $tenantId): ?DigitalCard;
    public function saveForTenant(DigitalCard $card): void;
}
```

### **UPDATE 3: Add Database Connection Management**
```prompt
**DATABASE CONNECTION REQUIREMENTS:**

// Infrastructure layer MUST abstract connections:
class EloquentDigitalCardRepository implements DigitalCardRepositoryInterface
{
    public function __construct(
        private TenantConnectionManagerInterface $connectionManager
    ) {}
    
    public function findForTenant(DigitalCardId $id, TenantId $tenantId): ?DigitalCard
    {
        $connection = $this->connectionManager->connectionFor($tenantId);
        // Use $connection, not DB::...
    }
}
```

### **UPDATE 4: Fix Admin API Scope Issues**
```prompt
**ADMIN API CONSTRAINTS UPDATE:**

1. **Scope Limitation**:
   - Admin APIs can ONLY access landlord database
   - Cannot query across tenant databases
   - Must use aggregated metrics instead of raw queries

2. **Data Access Pattern**:
   // WRONG: Query all tenant databases directly
   // CORRECT: Use pre-aggregated metrics table
   
   class TenantMetricsController
   {
       // Can access: landlord.tenant_metrics (pre-aggregated)
       // Cannot access: tenant_{slug}.members (forbidden)
   }
```

---

## **🎯 CORRECTED PROMPT TEMPLATES**

### **Mobile API Prompt (Corrected)**
```prompt
**CRITICAL CONTEXT UPDATE:**
- Mobile APIs are ALWAYS tenant-scoped after login
- Authentication: /mapi/v1/auth/login (platform level)
- All features: /{tenant}/mapi/v1/* (tenant level)
- MUST include 'identify.tenant' middleware

**ROUTING LAW COMPLIANCE:**
Following CLAUDE.md 6-CASE SYSTEM:
CASE 1: /mapi/v1/auth/*     → Platform Mobile API (Landlord DB)
CASE 2: /{tenant}/mapi/v1/* → Tenant Mobile API (Tenant DB)

**IMPLEMENTATION REQUIREMENTS:**
1. Create DigitalCardController in app/Contexts/Membership/UI/API/Mobile/
2. Route: GET /{tenant}/mapi/v1/digital-cards/{memberId}
3. Middleware: ['api', 'identify.tenant']
4. Extract TenantId from route: new TenantId($request->route('tenant'))
5. Validate member belongs to tenant
```

### **Admin API Prompt (Corrected)**
```prompt
**CRITICAL SCOPE LIMITATION:**
- Admin APIs operate ONLY on landlord database
- Cannot perform cross-tenant queries
- Must use aggregated/denormalized data

**IMPLEMENTATION REQUIREMENTS:**
1. Create AdminTenantController in app/Contexts/Platform/UI/API/Admin/
2. Route: GET /api/admin/v1/tenants
3. Database: ONLY landlord.tenants table
4. For metrics: Use landlord.tenant_metrics (pre-aggregated)
5. NEVER query tenant_{slug}.* databases directly

**SECURITY ENHANCEMENTS:**
- Middleware: ['web', 'auth', 'role:platform-admin']
- Audit log EVERY action
- Validate admin has platform-admin role
- IP restriction for sensitive operations
```

---

## **📈 RISK ASSESSMENT**

### **High Risk Issues**
1. **Mobile API without tenant context** → **CRITICAL** (Data leakage)
2. **Missing identify.tenant middleware** → **HIGH** (Security breach)
3. **Admin APIs querying tenant databases** → **HIGH** (Architecture violation)
4. **DDD rule violations in commands** → **MEDIUM** (Maintenance debt)

### **Mitigation Required**
1. **Immediate**: Fix mobile API tenant resolution in all prompts
2. **Immediate**: Add identify.tenant middleware requirement
3. **High Priority**: Clarify admin API scope limitations
4. **High Priority**: Enforce DDD rules in generated code

---

## **🎯 FINAL RECOMMENDATIONS**

### **Action 1: Update All Prompts Immediately**
- Fix mobile API tenant resolution
- Add middleware requirements
- Enforce DDD rules explicitly

### **Action 2: Create Validation Checklist**
Add this to every prompt:
```prompt
**ARCHITECTURE VALIDATION CHECKLIST:**
[ ] Route follows 6-CASE SYSTEM correctly
[ ] TenantId is first command parameter (Rule 3)
[ ] Handler validates tenant ownership (Rule 5)
[ ] Repository uses "ForTenant" methods (Rule 2)
[ ] No cross-tenant queries in admin APIs
[ ] identify.tenant middleware included
[ ] Database connection properly abstracted
```

### **Action 3: Add Architecture Guardrails**
Create a linter/validator that checks:
- Route patterns match 6-CASE SYSTEM
- Commands have TenantId first
- No DB:: queries without tenant scope
- No cross-database joins

---

## **🔚 CONCLUSION**

Your prompts have **fundamental architectural errors** that would lead to:
1. **Security vulnerabilities** (tenant data leakage)
2. **Architecture violations** (cross-tenant queries)
3. **DDD non-compliance** (missing tenant context)
4. **Routing law breaches** (wrong API prefixes)

**Critical fix required before any code generation.** The updated prompts above address all architectural concerns and ensure compliance with CLAUDE.md rules.

**Do not proceed with code generation until these fixes are implemented.** 
