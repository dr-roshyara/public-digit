# Debugging Guide - DigitalCard Context

**Version:** Phase 1.3
**Target Audience:** Developers, DevOps, QA Engineers

---

## Quick Debugging Checklist

When encountering issues with the DigitalCard Context, check these in order:

1. ✅ **ServiceProvider registered?** → Check `config/app.php`
2. ✅ **ModuleRegistry URL configured?** → Check `.env` and `config/services.php`
3. ✅ **Tenant context active?** → Check middleware stack
4. ✅ **Subscription active?** → Check ModuleRegistry response
5. ✅ **Port bindings correct?** → Check `DigitalCardServiceProvider`
6. ✅ **Domain exceptions handled?** → Check try-catch blocks
7. ✅ **Events publishing?** → Check event listeners registered

---

## Common Issues & Solutions

### Issue 1: "Tenant context required"

**Symptom:**
```
DomainException: Tenant context required
```

**Cause:**
The `TenantContextInterface` returned `null` for `currentTenantId()`.

**Root Causes:**

1. **Missing tenant middleware**
   ```php
   // ❌ BAD
   Route::post('/digital-cards', [DigitalCardController::class, 'issue']);

   // ✅ GOOD
   Route::middleware(['web', 'identify.tenant'])->group(function () {
       Route::post('/digital-cards', [DigitalCardController::class, 'issue']);
   });
   ```

2. **Called from platform route instead of tenant route**
   ```
   ❌ POST /api/digital-cards        (platform route)
   ✅ POST /nrna/api/digital-cards   (tenant route)
   ```

3. **Spatie tenant not initialized**
   ```php
   // In tinker or tests
   $tenant = Tenant::find(1);
   $tenant->makeCurrent(); // Must call this first
   ```

**Solution:**

```php
// 1. Check middleware stack
Route::getRoutes()->getByName('digital-cards.issue')->middleware();

// 2. Check current tenant
dd(Tenant::current()); // Should not be null

// 3. Manually set tenant (testing only)
$tenant = Tenant::find(1);
$tenant->makeCurrent();
```

**Prevention:**

Always use tenant routes with middleware:
```php
Route::middleware(['web', 'identify.tenant'])->group(function () {
    // All tenant routes here
});
```

---

### Issue 2: "Subscription required"

**Symptom:**
```
SubscriptionRequiredException: No active subscription for digital_card module
```

**Cause:**
ModuleRegistry returned non-200 response when checking subscription.

**Debug Steps:**

1. **Check ModuleRegistry is accessible**
   ```bash
   curl http://module-registry.test/health
   ```

2. **Check tenant subscription**
   ```bash
   curl -X POST http://module-registry.test/api/check-access \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "tenant-123",
       "action": "cards.create",
       "module": "digital_card"
     }'
   ```

3. **Check ModuleRegistry URL in config**
   ```php
   // In tinker
   config('services.module_registry.url')
   ```

4. **Enable HTTP logging**
   ```php
   // Temporarily in ModuleRegistryAdapter
   use Illuminate\Support\Facades\Http;

   Http::withOptions(['debug' => true])
       ->post($url, $data);
   ```

**Solutions:**

**A. ModuleRegistry not running**
```bash
# Start ModuleRegistry service
cd /path/to/module-registry
php artisan serve --port=8001
```

**B. Wrong URL configured**
```env
# .env
MODULE_REGISTRY_URL=http://localhost:8001  # Fix URL
```

**C. Tenant lacks subscription (expected behavior)**
```php
// Add subscription via ModuleRegistry admin panel
// OR bypass for development:

// In tests - use FakeModuleAccess
$moduleAccess = new FakeModuleAccess();
$moduleAccess->setHasSubscription(true);
```

**D. Network issues**
```bash
# Check connectivity
ping module-registry.test
nc -zv module-registry.test 80
```

---

### Issue 3: "Quota exceeded"

**Symptom:**
```
QuotaExceededException: Card limit reached (100/100)
```

**Cause:**
Tenant has reached their card issuance quota.

**Debug Steps:**

1. **Check current quota**
   ```php
   // In tinker
   $moduleAccess = app(\App\Contexts\DigitalCard\Domain\Ports\ModuleAccessInterface::class);
   $quota = $moduleAccess->getQuota('tenant-123');
   dd($quota);
   ```

2. **Query ModuleRegistry directly**
   ```bash
   curl http://module-registry.test/api/quota?tenant_id=tenant-123
   ```

**Solutions:**

**A. Increase quota (Production)**
- Contact ModuleRegistry admin
- Upgrade tenant plan
- Purchase additional quota

**B. Clean up old cards (if applicable)**
```php
// Revoke unused cards to free quota
$handler = app(RevokeCardHandler::class);
$handler->handle(new RevokeCardCommand(
    cardId: 'old-card-id',
    tenantId: 'tenant-123',
    reason: 'Cleanup',
));
```

**C. Bypass for development**
```php
// In tests
$moduleAccess = new FakeModuleAccess();
$moduleAccess->setWithinQuota(true);
```

---

### Issue 4: Card Not Found

**Symptom:**
```
CardNotFoundException: Card not found for ID: abc123
```

**Cause:**
Repository could not find card with given ID in tenant database.

**Debug Steps:**

1. **Verify card exists**
   ```php
   // In tinker (with tenant context)
   $tenant = Tenant::find(1);
   $tenant->makeCurrent();

   \App\Contexts\DigitalCard\Models\DigitalCard::where('card_id', 'abc123')->first();
   ```

2. **Check tenant isolation**
   ```php
   // Card might belong to different tenant
   \App\Contexts\DigitalCard\Models\DigitalCard::withoutGlobalScopes()
       ->where('card_id', 'abc123')
       ->get(); // Check tenant_id column
   ```

3. **Verify database connection**
   ```php
   // Check current database
   DB::connection()->getDatabaseName();
   ```

**Common Causes:**

**A. Wrong tenant context**
```php
// User on tenant 'nrna' trying to access card from 'uml'
// Solution: Ensure user is on correct tenant
```

**B. Card ID typo**
```php
// Verify exact card ID (case-sensitive UUID)
$cardId = 'a3f2e7d8-9c4b-4d5f-8e6a-1b2c3d4e5f6g'; // Check carefully
```

**C. Card not yet persisted**
```php
// Check repository save() was called
$repository->save($card);
```

---

### Issue 5: ServiceProvider Not Loading

**Symptom:**
```
BindingResolutionException: Target class [ClockInterface] does not exist.
```

**Cause:**
ServiceProvider not registered or ports not bound.

**Debug Steps:**

1. **Check ServiceProvider registered**
   ```php
   // In tinker
   $providers = app()->getLoadedProviders();
   dd(isset($providers[\App\Providers\DigitalCardServiceProvider::class]));
   ```

2. **Check bindings exist**
   ```php
   // In tinker
   dd(app()->bound(\App\Contexts\DigitalCard\Domain\Ports\ClockInterface::class));
   ```

3. **Verify ServiceProvider class exists**
   ```bash
   ls app/Providers/DigitalCardServiceProvider.php
   ```

**Solutions:**

**A. ServiceProvider not registered**
```php
// config/app.php
'providers' => ServiceProvider::defaultProviders()->merge([
    // ADD THIS:
    App\Providers\DigitalCardServiceProvider::class,
])->toArray(),
```

**B. Clear config cache**
```bash
php artisan config:clear
php artisan cache:clear
```

**C. Autoload dump**
```bash
composer dump-autoload
```

---

### Issue 6: QR Code Generation Fails

**Symptom:**
```
RuntimeException: Failed to generate QR code
```

**Cause:**
BaconQrCode library issue or invalid data.

**Debug Steps:**

1. **Check BaconQrCode installed**
   ```bash
   composer show bacon/bacon-qr-code
   ```

2. **Test QR generation manually**
   ```php
   // In tinker
   $generator = app(\App\Contexts\DigitalCard\Domain\Ports\QRCodeGeneratorInterface::class);
   $qr = $generator->generate('test-data');
   dd($qr);
   ```

3. **Check card data length**
   ```php
   // QR codes have size limits
   $cardId = 'very-long-card-id-that-exceeds-qr-capacity...'; // Too long?
   ```

**Solutions:**

**A. Install BaconQrCode**
```bash
composer require bacon/bacon-qr-code
```

**B. Reduce QR data size**
```php
// Use shorter card IDs or URLs
$qrData = "https://short.url/{$cardId}";
```

**C. Use fake for testing**
```php
// In tests
$qrGenerator = new FakeQRCodeGenerator();
```

---

### Issue 7: Events Not Publishing

**Symptom:**
Event listeners not triggered after card operations.

**Cause:**
- Event listeners not registered
- Events not published
- Event queue not running

**Debug Steps:**

1. **Check event was published**
   ```php
   // Use FakeEventPublisher in test
   $eventPublisher = new FakeEventPublisher();
   // ... execute handler ...
   dd($eventPublisher->getPublishedEvents());
   ```

2. **Check listener registered**
   ```php
   // app/Providers/EventServiceProvider.php
   protected $listen = [
       \App\Contexts\DigitalCard\Domain\Events\CardIssued::class => [
           \App\Listeners\SendCardNotification::class,
       ],
   ];
   ```

3. **Check queue running (if queued listeners)**
   ```bash
   php artisan queue:work
   ```

**Solutions:**

**A. Register listener**
```php
// EventServiceProvider.php
use App\Contexts\DigitalCard\Domain\Events\CardIssued;

protected $listen = [
    CardIssued::class => [
        YourListener::class,
    ],
];
```

**B. Clear event cache**
```bash
php artisan event:clear
php artisan optimize:clear
```

**C. Test event manually**
```php
// In tinker
event(new \App\Contexts\DigitalCard\Domain\Events\CardIssued(
    cardId: 'test',
    memberId: 'M123',
    tenantId: 'T123',
    issuedAt: new DateTimeImmutable(),
));
```

---

## Debugging with Logging

### Enable Detailed Logging

**1. Add logging to handlers (temporarily)**

```php
// In IssueCardHandler
public function handle(IssueCardCommand $command): CardDTO
{
    \Log::debug('IssueCardHandler: Starting', [
        'member_id' => $command->memberId,
        'full_name' => $command->fullName,
    ]);

    $tenantId = $this->tenantContext->currentTenantId();
    \Log::debug('IssueCardHandler: Got tenant', ['tenant_id' => $tenantId]);

    $this->moduleAccess->ensureCanPerform($tenantId, 'cards.create');
    \Log::debug('IssueCardHandler: Subscription check passed');

    // ... rest of handler
}
```

**2. Watch logs**

```bash
tail -f storage/logs/laravel.log
```

**3. Use structured logging**

```php
\Log::channel('digitalcard')->info('Card issued', [
    'card_id' => $cardDTO->cardId,
    'tenant_id' => $tenantId,
    'timestamp' => now(),
]);
```

---

## Debugging Port Implementations

### Test Each Port Individually

```php
// In tinker

// 1. ClockInterface
$clock = app(\App\Contexts\DigitalCard\Domain\Ports\ClockInterface::class);
dd($clock->now());

// 2. IdGeneratorInterface
$idGen = app(\App\Contexts\DigitalCard\Domain\Ports\IdGeneratorInterface::class);
dd($idGen->generate());

// 3. QRCodeGeneratorInterface
$qr = app(\App\Contexts\DigitalCard\Domain\Ports\QRCodeGeneratorInterface::class);
dd($qr->generate('test-data'));

// 4. ModuleAccessInterface
$module = app(\App\Contexts\DigitalCard\Domain\Ports\ModuleAccessInterface::class);
dd($module->getQuota('tenant-123'));

// 5. TenantContextInterface
$tenant = app(\App\Contexts\DigitalCard\Domain\Ports\TenantContextInterface::class);
dd($tenant->currentTenantId());

// 6. EventPublisherInterface
$events = app(\App\Contexts\DigitalCard\Domain\Ports\EventPublisherInterface::class);
$events->publish(new \stdClass());
```

---

## Testing Strategies for Debugging

### 1. Use Fakes for Isolation

```php
// Isolate the problem by replacing ports with fakes
public function test_debug_issue()
{
    $clock = new FakeClock();
    $idGenerator = new FakeIdGenerator();
    $qrGenerator = new FakeQRCodeGenerator();
    $moduleAccess = new FakeModuleAccess();
    $tenantContext = new FakeTenantContext();
    $eventPublisher = new FakeEventPublisher();

    // Set known state
    $tenantContext->setTenantId('tenant-123');
    $moduleAccess->setHasSubscription(true);
    $moduleAccess->setWithinQuota(true);

    // Now test - if it works, problem is in one of the real adapters
    $handler = new IssueCardHandler(
        $repository,
        $clock,
        $idGenerator,
        $qrGenerator,
        $moduleAccess,
        $tenantContext,
        $eventPublisher,
    );

    $cardDTO = $handler->handle($command);
    // If this works, issue is in adapter implementation
}
```

### 2. Swap One Adapter at a Time

```php
// Start with all real adapters
$handler = new IssueCardHandler(
    app(DigitalCardRepositoryInterface::class),
    app(ClockInterface::class),              // Real
    app(IdGeneratorInterface::class),        // Real
    app(QRCodeGeneratorInterface::class),    // Real
    app(ModuleAccessInterface::class),       // Real
    app(TenantContextInterface::class),      // Real
    app(EventPublisherInterface::class),     // Real
);

// Now replace one at a time
$handler = new IssueCardHandler(
    app(DigitalCardRepositoryInterface::class),
    new FakeClock(),                         // ← Changed
    app(IdGeneratorInterface::class),
    app(QRCodeGeneratorInterface::class),
    app(ModuleAccessInterface::class),
    app(TenantContextInterface::class),
    app(EventPublisherInterface::class),
);
// Test - still failing? Not the Clock.
// Keep swapping until you find the culprit.
```

---

## Database Debugging

### Check Tenant Database Connection

```php
// In tinker
$tenant = Tenant::find(1);
$tenant->makeCurrent();

// Check database name
dd(DB::connection()->getDatabaseName()); // Should be tenant_nrna or similar

// Check table exists
dd(Schema::hasTable('digital_cards'));

// Check cards count
dd(\App\Contexts\DigitalCard\Models\DigitalCard::count());
```

### Inspect Database Queries

```php
// Enable query log
DB::enableQueryLog();

// Execute operation
$handler->handle($command);

// See all queries
dd(DB::getQueryLog());
```

---

## Performance Debugging

### Identify Slow Operations

```php
// In handler (temporarily)
$start = microtime(true);

$this->moduleAccess->ensureCanPerform($tenantId, 'cards.create');

$duration = microtime(true) - $start;
\Log::debug('ModuleAccess check took ' . ($duration * 1000) . 'ms');
```

### Common Performance Issues

1. **ModuleRegistry HTTP calls** - Cache subscription status
2. **QR code generation** - Generate asynchronously
3. **Event listeners** - Queue heavy listeners
4. **Database queries** - N+1 queries in repository

---

## Production Debugging Checklist

When debugging in production:

1. ✅ **Check logs first** - `storage/logs/laravel.log`
2. ✅ **Verify configuration** - `.env` settings
3. ✅ **Check external services** - ModuleRegistry health
4. ✅ **Verify database** - Connection, migrations
5. ✅ **Check queue** - Workers running?
6. ✅ **Review recent changes** - Git history
7. ✅ **Monitor performance** - APM tools
8. ❌ **DO NOT** use `dd()` or `dump()` in production
9. ❌ **DO NOT** enable debug mode in `.env`
10. ✅ **Use proper logging** instead

---

## Emergency Recovery

### If Everything is Broken

```bash
# 1. Clear all caches
php artisan optimize:clear
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear

# 2. Rebuild autoload
composer dump-autoload

# 3. Re-run migrations (with caution)
php artisan migrate --force

# 4. Restart queue workers
php artisan queue:restart

# 5. Restart web server
# (depends on your setup)
```

### Rollback Strategy

```bash
# 1. Identify last working commit
git log --oneline

# 2. Create backup branch
git branch backup/before-rollback

# 3. Rollback
git reset --hard <commit-hash>

# 4. Deploy
# (your deployment process)
```

---

## Getting Help

If you're still stuck:

1. **Check test suite** - `php artisan test`
2. **Review architecture** - Read [Architecture Overview](01_ARCHITECTURE_OVERVIEW.md)
3. **Consult API reference** - Read [API Reference](10_API_REFERENCE.md)
4. **Contact team** - Senior development team

---

## Debug Tools Reference

### Useful Artisan Commands

```bash
# Check route list
php artisan route:list --name=digital-cards

# Check bindings
php artisan tinker --execute="dd(app()->getBindings())"

# Check config
php artisan config:show services

# Check migrations
php artisan migrate:status

# Check events
php artisan event:list
```

### Useful Tinker Commands

```php
// Get tenant
$tenant = Tenant::find(1);
$tenant->makeCurrent();

// Test handler
$handler = app(\App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler::class);
$command = new \App\Contexts\DigitalCard\Application\Commands\IssueCardCommand(
    memberId: 'M123',
    fullName: 'Test User',
);
$result = $handler->handle($command);

// Check port bindings
app(\App\Contexts\DigitalCard\Domain\Ports\ClockInterface::class);
```

---

## Next Steps

- Read [Testing Guide](07_TESTING_GUIDE.md) to write tests that prevent bugs
- Read [Production Deployment](09_PRODUCTION_DEPLOYMENT.md) for production setup
- Review [How to Use](05_HOW_TO_USE.md) for correct usage patterns
