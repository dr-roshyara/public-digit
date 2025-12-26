# **DigitalCard Context - Phase 0 Developer Guide**

## **Table of Contents**
1. [Architecture Overview](#architecture-overview)
2. [Domain Layer Guide](#domain-layer-guide)
3. [Application Layer Guide](#application-layer-guide)
4. [Infrastructure Layer Guide](#infrastructure-layer-guide)
5. [Testing Guide](#testing-guide)
6. [Debugging Guide](#debugging-guide)
7. [Deployment Guide](#deployment-guide)
8. [Common Scenarios & Solutions](#common-scenarios--solutions)

---

## **1. Architecture Overview**

### **1.1 Bounded Context Position**
DigitalCard is an **autonomous bounded context** within the Public Digit platform:
- **Peer to**: MembershipContext, ElectionContext, TenantAuthContext
- **Communicates via**: Anti-Corruption Layer (Phase 3) and Domain Events
- **Database**: Tenant databases ONLY (never landlord)

### **1.2 6-Case Routing Compliance**
```
CASE 4: Desktop Admin API
Route: /{tenant}/api/v1/cards
Client: Vue Desktop (Inertia.js)
Auth: Session-based (web middleware)
Response: JSON for Vue components
```

### **1.3 Physical Database Separation**
```
Landlord Database (publicdigit):
  - tenants table (metadata only)
  - NO digital card data

Tenant Database (tenant_{slug}):
  - digital_cards table
  - All card-related data
  - Physical isolation guaranteed
```

### **1.4 DDD Layer Structure**
```
app/Contexts/DigitalCard/
├── Domain/                    # Pure business logic
│   ├── Entities/             # DigitalCard aggregate
│   ├── ValueObjects/         # CardId, MemberId, QRCode
│   ├── Enums/               # CardStatus
│   ├── Events/              # CardIssued
│   ├── Repositories/        # Interface only
│   └── Exceptions/          # Business exceptions
│
├── Application/              # Use case orchestration
│   ├── Commands/            # IssueCardCommand
│   ├── Handlers/            # IssueCardHandler
│   └── DTOs/                # CardDTO
│
└── Infrastructure/          # Framework implementations
    ├── Models/              # DigitalCardModel
    ├── Repositories/        # EloquentDigitalCardRepository
    ├── Http/                # Controllers, Routes
    ├── Database/            # Migrations
    └── Providers/           # ServiceProvider
```

---

## **2. Domain Layer Guide**

### **2.1 Core Aggregate: DigitalCard**
```php
// Creation (only valid way)
$card = DigitalCard::issue(
    CardId::generate(),
    MemberId::fromString($memberId),
    QRCode::fromCardId($cardId),
    new DateTimeImmutable(),
    $expiresAt
);

// Business methods
$card->activate($activatedAt);
$card->revoke($reason, $revokedAt);
$card->isValidAt($checkTime);

// Reconstitution (repository only)
$card = DigitalCard::reconstitute(...);
```

### **2.2 Value Objects (Immutable)**
```php
// CardId - Self-validating UUID
$cardId = CardId::generate();
$cardId = CardId::fromString('uuid-string');

// MemberId - Anti-Corruption Layer
$memberId = MemberId::fromString($membershipContextId);

// QRCode - Security consideration
$qrCode = QRCode::fromCardId($cardId);
$hash = $qrCode->toHash(); // For database storage
```

### **2.3 Domain Events**
```php
// Event published automatically
$card = DigitalCard::issue(...);
$events = $card->releaseEvents(); // Contains CardIssued

// Event properties
class CardIssued {
    public readonly string $cardId;
    public readonly string $memberId;
    public readonly DateTimeImmutable $issuedAt;
    public readonly DateTimeImmutable $expiresAt;
    public readonly string $qrCodeHash; // Security: hash only
}
```

### **2.4 Domain Rules (NON-NEGOTIABLE)**
1. **No Laravel/framework dependencies** in Domain
2. **No primitive obsession** - use Value Objects
3. **No public setters** - mutate via business methods only
4. **Self-validation** in constructors
5. **Invariant protection** - business rules enforced internally

---

## **3. Application Layer Guide**

### **3.1 Command Pattern**
```php
// Create from HTTP request
$command = IssueCardCommand::fromArray($request->validated());

// Handler orchestration
class IssueCardHandler {
    public function handle(IssueCardCommand $command): CardDTO
    {
        // 1. Generate IDs
        $cardId = $this->repository->nextIdentity();
        
        // 2. Create domain objects
        $qrCode = QRCode::fromCardId($cardId);
        
        // 3. Execute business logic (delegated to Domain)
        $card = DigitalCard::issue(...);
        
        // 4. Persist (events dispatched in repository)
        $this->repository->save($card);
        
        // 5. Return DTO for presentation
        return CardDTO::fromDomainEntity($card);
    }
}
```

### **3.2 DTO Pattern**
```php
// Conversion from Domain to Presentation
$dto = CardDTO::fromDomainEntity($card);

// Properties
class CardDTO {
    public string $id;
    public string $memberId;
    public string $status;
    public string $qrcode;      // Raw QR for display
    public string $issuedAt;    // ISO 8601
    public string $expiresAt;   // ISO 8601
}

// Serialization
return response()->json(['data' => $dto->toArray()], 201);
```

---

## **4. Infrastructure Layer Guide**

### **4.1 Repository Implementation**
```php
class EloquentDigitalCardRepository implements DigitalCardRepositoryInterface
{
    public function save(DigitalCard $card): void
    {
        // Model ↔ Entity conversion
        $model = DigitalCardModel::findOrNew($card->id()->toString());
        $model->id = $card->id()->toString();
        $model->member_id = $card->memberId()->toString();
        $model->status = $card->status()->value;
        $model->qrcode = $card->qrCode()->toString(); // Phase 0: raw QR
        $model->issued_at = $card->issuedAt();
        $model->expires_at = $card->expiresAt();
        
        $model->save();
        
        // Dispatch domain events to Laravel event system
        $this->dispatchDomainEvents($card);
    }
    
    private function toDomainEntity(DigitalCardModel $model): DigitalCard
    {
        return DigitalCard::reconstitute(
            cardId: CardId::fromString($model->id),
            memberId: MemberId::fromString($model->member_id),
            qrCode: QRCode::fromCardId(CardId::fromString($model->id)),
            issuedAt: new DateTimeImmutable($model->issued_at->toISOString()),
            expiresAt: new DateTimeImmutable($model->expires_at->toISOString()),
            status: CardStatus::from($model->status)
        );
    }
}
```

### **4.2 Database Migration (Tenant DB ONLY)**
```php
// Location: app/Contexts/DigitalCard/Infrastructure/Database/Migrations/
Schema::create('digital_cards', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->uuid('member_id');          // ACL to MembershipContext
    $table->string('status', 20)->default('issued');
    $table->text('qrcode');             // Phase 0: raw, Phase 3: hash only
    $table->timestampTz('issued_at')->useCurrent();
    $table->timestampTz('expires_at');
    $table->timestampsTz();
    
    $table->index('member_id');
    $table->index('status');
});
```

### **4.3 Controller Implementation**
```php
class DigitalCardController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // 1. Validate at HTTP boundary
        $validator = Validator::make($request->all(), [
            'member_id' => ['required', 'uuid'],
            'expires_at' => ['required', 'date', 'after:now'],
        ]);
        
        // 2. Create command from validated data
        $command = IssueCardCommand::fromArray($validator->validated());
        
        // 3. Execute use case
        $cardDTO = $this->issueCardHandler->handle($command);
        
        // 4. Return response
        return response()->json(['data' => $cardDTO->toArray()], 201);
    }
}
```

### **4.4 Service Provider Registration**
```php
// app/Contexts/DigitalCard/Infrastructure/Providers/DigitalCardServiceProvider.php
public function register(): void
{
    // Interface → Implementation binding
    $this->app->bind(
        DigitalCardRepositoryInterface::class,
        EloquentDigitalCardRepository::class
    );
    
    // Singleton handlers for performance
    $this->app->singleton(IssueCardHandler::class, function ($app) {
        return new IssueCardHandler(
            $app->make(DigitalCardRepositoryInterface::class)
        );
    });
}

public function boot(): void
{
    // Load context migrations
    $this->loadMigrationsFrom(__DIR__ . '/../Database/Migrations');
}

// Register in config/app.php
'providers' => [
    App\Contexts\DigitalCard\Infrastructure\Providers\DigitalCardServiceProvider::class,
],
```

---

## **5. Testing Guide**

### **5.1 Test Structure**
```
tests/Feature/Contexts/DigitalCard/
└── DigitalCardWalkingSkeletonTest.php
    ├── it_creates_digital_card_record_via_desktop_api()
    ├── it_prevents_cross_tenant_card_access()
    ├── it_rejects_invalid_expiry_date()
    ├── it_requires_member_id()
    └── it_rejects_invalid_member_id_format()
```

### **5.2 Test Setup (Critical)**
```php
protected function setUp(): void
{
    parent::setUp();
    
    // 1. Disable auth middleware for Phase 0
    $this->withoutMiddleware([\Illuminate\Auth\Middleware\Authenticate::class]);
    
    // 2. Create/get test tenant in TEST landlord database
    $this->tenant = Tenant::firstOrCreate(
        ['slug' => 'digitalcard-test'],
        [
            'id' => Str::uuid()->toString(),
            'name' => 'DigitalCard Test Tenant',
            'database_name' => 'tenant_digitalcard-test',
            'email' => 'test@digitalcard.local',
            'status' => 'active',
        ]
    );
    
    // 3. Configure tenant database connection dynamically
    config(['database.connections.tenant.database' => $this->tenant->database_name]);
    DB::purge('tenant');
    
    // 4. Make tenant current (Spatie multitenancy)
    $this->tenant->makeCurrent();
}
```

### **5.3 Running Tests**
```bash
# Clear caches first
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Run DigitalCard tests
php artisan test tests/Feature/Contexts/DigitalCard/

# Run specific test
php artisan test --filter="it_creates_digital_card_record_via_desktop_api"

# With coverage
php artisan test --coverage --filter=DigitalCard
```

### **5.4 Test Tenant Management**
```bash
# Create test tenant manually
php artisan tinker
>>> \App\Models\Tenant::create([
...     'slug' => 'digitalcard-test',
...     'name' => 'DigitalCard Test Tenant',
...     'database_name' => 'tenant_digitalcard-test',
...     'email' => 'test@digitalcard.local',
...     'status' => 'active',
... ]);

# Create tenant database (PostgreSQL)
psql -U postgres -c "CREATE DATABASE \"tenant_digitalcard-test\";"

# Run DigitalCard migration on tenant
php artisan tenants:migrate --tenant=digitalcard-test
```

---

## **6. Debugging Guide**

### **6.1 Common Errors & Solutions**

#### **Error: "Relation tenants does not exist"**
```bash
# Problem: Landlord database missing tenants table
# Solution: Run landlord migrations
php artisan migrate --database=pgsql --force
```

#### **Error: "digital_cards table does not exist"**
```bash
# Problem: Migration not run on tenant database
# Solution: Run DigitalCard migration
php artisan tenants:migrate --tenant=digitalcard-test

# OR manually:
php artisan migrate \
    --path=app/Contexts/DigitalCard/Infrastructure/Database/Migrations \
    --database=tenant_digitalcard-test \
    --force
```

#### **Error: "404 Not Found"**
```php
// Problem: Routes not registered
// Debug: List registered routes
php artisan route:list | grep cards

// Check route file is loaded
// routes/tenant-api.php should include:
require_once __DIR__ . '/tenant-api/digitalcard-api.php';
```

#### **Error: "401 Unauthorized"**
```php
// Problem: Authentication middleware blocking
// Phase 0 fix: Disable in test
$this->withoutMiddleware([\Illuminate\Auth\Middleware\Authenticate::class]);

// Phase 1+: Use proper authentication
$user = \App\Models\User::factory()->create();
$this->actingAs($user, 'sanctum');
```

#### **Error: "Target class does not exist"**
```bash
# Problem: Service Provider not registered
# Solution: Check config/app.php
grep -n "DigitalCardServiceProvider" config/app.php

# Or register via bootstrap
# bootstrap/providers.php add:
\App\Contexts\DigitalCard\Infrastructure\Providers\DigitalCardServiceProvider::class,
```

### **6.2 Debugging Database Connections**
```php
// Check current database connection
\Log::info('Current DB: ' . \DB::connection()->getDatabaseName());

// Check tenant connection
try {
    $pdo = \DB::connection('tenant')->getPdo();
    \Log::info('Tenant DB connected: ' . \DB::connection('tenant')->getDatabaseName());
} catch (\Exception $e) {
    \Log::error('Tenant DB connection failed: ' . $e->getMessage());
}

// List all connections
foreach (config('database.connections') as $name => $config) {
    \Log::info("Connection {$name}: {$config['database']}");
}
```

### **6.3 Debugging Tenant Context**
```php
// Check current tenant
$tenant = app('currentTenant');
\Log::info('Current tenant: ' . ($tenant ? $tenant->slug : 'none'));

// Force tenant context in tests
$this->tenant->makeCurrent();

// Verify tenant database is being used
\DB::connection('tenant')->table('digital_cards')->count();
```

### **6.4 Debugging Domain Events**
```php
// Check if events are being dispatched
\Event::fake(); // In tests
\Event::assertDispatched(CardIssued::class);

// Listen to all events in development
// In AppServiceProvider:
public function boot(): void
{
    \Event::listen('*', function ($eventName, array $data) {
        \Log::debug("Event: {$eventName}", $data);
    });
}
```

---

## **7. Deployment Guide**

### **7.1 Pre-Deployment Checklist**
```bash
# 1. Run all tests
php artisan test --filter=DigitalCard

# 2. Static analysis
vendor/bin/phpstan analyse --level=8 app/Contexts/DigitalCard/

# 3. Code style
vendor/bin/pint app/Contexts/DigitalCard/ --test

# 4. Security audit
composer audit

# 5. Migration status
php artisan tenants:migrate:status --context=DigitalCard
```

### **7.2 Deployment Steps**
```bash
# 1. Deploy code
git pull origin main
composer install --no-dev

# 2. Run landlord migrations (if any)
php artisan migrate --database=pgsql --force

# 3. For each tenant (or use queue)
php artisan tenants:migrate --tenant=tenant-slug --context=DigitalCard

# 4. Clear caches
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### **7.3 Rollback Procedure**
```bash
# Rollback DigitalCard migration for specific tenant
php artisan tenants:migrate:rollback --tenant=tenant-slug --context=DigitalCard --step=1

# Rollback for all tenants
php artisan tenants:migrate:rollback --all --context=DigitalCard --step=1
```

---

## **8. Common Scenarios & Solutions**

### **8.1 Adding New Tenant**
```php
// When new tenant signs up:
$tenant = Tenant::create([...]);

// Create tenant database
DB::connection('pgsql')->statement(
    "CREATE DATABASE \"{$tenant->database_name}\""
);

// Run DigitalCard migration on new tenant
Artisan::call('migrate', [
    '--path' => 'app/Contexts/DigitalCard/Infrastructure/Database/Migrations',
    '--database' => $tenant->database_name,
    '--force' => true,
]);
```

### **8.2 Integrating with Membership Context**
```php
// Phase 0: Accept MemberId as UUID (Anti-Corruption Layer)
// Phase 3: Listen to MembershipCancelled event

class MembershipEventSubscriber
{
    public function handleMembershipCancelled(MembershipCancelled $event): void
    {
        $memberId = MemberId::fromString($event->memberId);
        $cards = $this->repository->findActiveCardsByMember($memberId);
        
        foreach ($cards as $card) {
            $card->revoke('Membership cancelled', new DateTimeImmutable());
            $this->repository->save($card);
        }
    }
}
```

### **8.3 QR Code Security (Phase 3)**
```php
// Upgrade from Phase 0 (raw QR) to Phase 3 (signed)
class SignedQRCode extends QRCode
{
    public function __construct(
        private string $payload,
        private string $signature,
        private DateTimeImmutable $expiresAt
    ) {
        $this->validateSignature();
        $this->validateExpiry();
    }
    
    public static function fromCard(CardId $cardId): self
    {
        $payload = json_encode([
            'card_id' => $cardId->toString(),
            'nonce' => bin2hex(random_bytes(16)),
            'expires' => now()->addHour()->getTimestamp(),
        ]);
        
        $signature = hash_hmac('sha256', $payload, config('app.key'));
        
        return new self($payload, $signature, now()->addHour());
    }
}
```

### **8.4 Performance Monitoring**
```php
// Add to DigitalCardController
public function store(Request $request): JsonResponse
{
    $start = microtime(true);
    
    // ... existing logic ...
    
    $duration = (microtime(true) - $start) * 1000;
    
    // Log performance
    \Log::info('IssueCard duration', [
        'duration_ms' => $duration,
        'member_id' => $request->input('member_id'),
        'tenant' => $request->get('tenant')?->slug,
    ]);
    
    // Alert if slow
    if ($duration > 200) {
        \Log::warning('IssueCard slow performance', ['duration_ms' => $duration]);
    }
    
    return response()->json(...);
}
```

---

## **9. Phase 0 → Phase 1 Transition**

### **9.1 What's Done (Phase 0)**
- ✅ Walking skeleton with tenant isolation
- ✅ Basic card issuance
- ✅ Domain layer foundation
- ✅ Infrastructure skeleton
- ✅ 5 passing integration tests

### **9.2 What's Next (Phase 1)**
1. **Complete lifecycle**: Activate, revoke, suspend cards
2. **Business rules**: One active card per member enforcement
3. **Vue.js admin interface**: List, filter, manage cards
4. **Authentication**: Proper Sanctum token auth
5. **Authorization**: Role-based permissions
6. **Enhanced testing**: Unit tests for Domain layer

### **9.3 Immediate Next Steps**
```bash
# 1. Fix PHPUnit warnings (convert docblock metadata to attributes)
# 2. Add test coverage report
# 3. Document architectural decisions
# 4. Code review
# 5. Deploy to development environment
```

---

## **10. Support & Escalation**

### **When to Ask for Help:**
1. **Tenant isolation uncertainty** → Ask immediately
2. **Cross-context dependencies** → Use Anti-Corruption Layer pattern
3. **Performance concerns** (> 200ms P95) → Benchmark first
4. **Security questions** → Consult security architect
5. **Architectural conflicts** → Use decision log (Section 9)

### **Reference Documents:**
- `DIGITALCARD_CONTEXT_PROMPT.md` - Complete specification
- `CLAUDE_CLI_QUICK_START.md` - Daily workflow guide
- `REWRITE_ANALYSIS.md` - Architectural improvements
- `00_EXECUTIVE_SUMMARY.md` - High-level overview

---

**Congratulations!** You've successfully implemented Phase 0 of the DigitalCard Context. The foundation is solid, tested, and ready for Phase 1 development.

**Remember:** 
- **Architecture is law**
- **Tests are mandatory**  
- **Tenant boundaries are sacred**
- **Domain layer purity is non-negotiable**

Happy coding! 🚀