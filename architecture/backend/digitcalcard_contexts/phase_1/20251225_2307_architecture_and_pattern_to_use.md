# **PRACTICAL ARCHITECTURE FOR DIGITALCARDCONTEXT**

## **🎯 ARCHITECTURAL PRINCIPLES: "SIMPLE OVER CLEVER"**

As a Senior Architect, I advocate for **practicality over perfection**. Let's implement what we actually need, not what's theoretically ideal.

---

## **🏗️ CORE ARCHITECTURE PATTERNS**

### **1. STRATEGIC DDD PATTERNS (Keep it Simple)**

```php
// SIMPLE BOUNDED CONTEXT - Not over-engineered
class DigitalCardContext {
    // 1. ONE Aggregate Root per major concept
    - DigitalCard (main member cards)
    - GuestCard (temporary cards - SEPARATE aggregate)
    
    // 2. Value Objects for type safety ONLY where it matters
    - CardId, MemberId, QRCode (these matter)
    - Don't overdo: Simple strings for "reason", "notes" are OK
    
    // 3. Domain Services for logic that doesn't fit in aggregates
    - CardIssuanceService (orchestrates issuance rules)
    - CardValidationService (pure validation logic)
```

**Why this works**: Clear boundaries without drowning in Value Objects. Each aggregate handles its own consistency.

---

## **2. EFFICIENT ALGORITHMS FOR SCALE**

### **A. QR Code Validation Algorithm (Fast Path)**

```php
// OPTIMIZED VALIDATION FLOW - Avoid premature optimization
class OptimizedCardValidator {
    
    public function validate(CardId $cardId, string $qrCode): ValidationResult {
        // 1. CACHE CHECK FIRST (90% hit rate expected)
        $cacheKey = "validation:{$cardId}:{$this->hashQr($qrCode)}";
        $cached = Cache::get($cacheKey);
        
        if ($cached !== null) {
            return ValidationResult::fromCache($cached);
        }
        
        // 2. SINGLE DATABASE QUERY with all needed data
        $cardData = DB::table('digital_cards')
            ->select('status', 'expires_at', 'revoked_at', 'member_id')
            ->where('id', $cardId)
            ->first();
            
        if (!$cardData) {
            return ValidationResult::invalid('card_not_found');
        }
        
        // 3. IN-MEMORY BUSINESS LOGIC (fast)
        $result = $this->applyBusinessRules($cardData, $qrCode);
        
        // 4. CACHE POSITIVE RESULTS (negative results expire faster)
        $ttl = $result->isValid() ? 300 : 60; // 5min vs 1min
        Cache::put($cacheKey, $result->toCache(), $ttl);
        
        return $result;
    }
    
    private function applyBusinessRules($cardData, $qrCode): ValidationResult {
        // SIMPLE, FAST CHECKS IN ORDER
        if ($cardData->status === 'revoked') return ValidationResult::invalid('revoked');
        if ($cardData->expires_at < now()) return ValidationResult::invalid('expired');
        if (!$this->verifyQrSignature($qrCode, $cardData->id)) {
            return ValidationResult::invalid('invalid_qr');
        }
        
        return ValidationResult::valid($cardData->id, $cardData->member_id);
    }
}
```

**Algorithm Efficiency**: O(1) for cache hits, single DB query for misses. QR verification is the bottleneck, so we optimize it last.

---

### **B. Bloom Filter for Offline Validation (Memory Efficient)**

```php
// PRACTICAL BLOOM FILTER - Not theoretical perfection
class PracticalBloomFilter {
    private $bitArray;
    private $size;
    private $hashFunctions = 3; // Good balance for our use case
    
    public function __construct(int $expectedItems, float $falsePositiveRate = 0.01) {
        // Calculate optimal size: m = -n * ln(p) / (ln(2)^2)
        $this->size = (int) ceil(
            -$expectedItems * log($falsePositiveRate) / pow(log(2), 2)
        );
        
        // Round to nearest multiple of 8 for byte alignment
        $this->size = ceil($this->size / 8) * 8;
        $this->bitArray = array_fill(0, $this->size / 8, 0);
    }
    
    public function add(string $item): void {
        for ($i = 0; $i < $this->hashFunctions; $i++) {
            $hash = $this->hash($item, $i);
            $byteIndex = (int) ($hash / 8);
            $bitIndex = $hash % 8;
            $this->bitArray[$byteIndex] |= (1 << $bitIndex);
        }
    }
    
    public function mightContain(string $item): bool {
        for ($i = 0; $i < $this->hashFunctions; $i++) {
            $hash = $this->hash($item, $i);
            $byteIndex = (int) ($hash / 8);
            $bitIndex = $hash % 8;
            
            if (($this->bitArray[$byteIndex] & (1 << $bitIndex)) === 0) {
                return false; // Definitely not in set
            }
        }
        return true; // Probably in set (with false positive chance)
    }
    
    private function hash(string $item, int $seed): int {
        // Simple, fast hash - MurmurHash would be better in production
        return crc32($item . $seed) % $this->size;
    }
}

// Usage in offline bundle generation
$filter = new PracticalBloomFilter(expectedItems: 10000, falsePositiveRate: 0.01);

foreach ($activeCards as $card) {
    $filter->add($card->id); // Add card IDs
}

// Bundle size: ~12KB for 10,000 cards (vs 400KB for full list)
```

**Why Bloom Filter?**: 90% size reduction for offline bundles. Acceptable 1% false positive rate is fine for our use case.

---

## **3. DESIGN PATTERNS THAT ACTUALLY HELP**

### **A. CQRS-Lite (Not Full CQRS)**

```php
// CQRS-LITE: Separate read models ONLY where needed
class CardReadModel {
    // DENORMALIZED VIEW FOR DASHBOARDS ONLY
    // Don't overdo - only for complex queries
    
    public function getDashboardMetrics(string $tenantId): array {
        // Materialized view refreshed every 5 minutes
        return Cache::remember("dashboard:{$tenantId}", 300, function() use ($tenantId) {
            return [
                'total_cards' => DB::table('digital_cards')
                    ->where('tenant_id', $tenantId)
                    ->count(),
                'active_cards' => DB::table('digital_cards')
                    ->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->count(),
                // Simple aggregates - no complex joins
            ];
        });
    }
}

// REGULAR READS STILL USE REPOSITORY
class CardRepository {
    public function find(CardId $id): ?DigitalCard {
        // Standard repository pattern for most reads
        // No need for separate query handlers unless proven necessary
    }
}
```

**Practical CQRS**: Only implement separate read models for dashboards/analytics. Keep CRUD simple for normal operations.

---

### **B. Circuit Breaker Pattern (Essential for Resilience)**

```php
// SIMPLE CIRCUIT BREAKER - Not framework-dependent
class MembershipIntegrationCircuitBreaker {
    private $failureCount = 0;
    private $lastFailureTime = null;
    private $state = 'CLOSED';
    
    public function call(callable $operation) {
        if ($this->state === 'OPEN') {
            // Check if timeout has passed
            if (time() - $this->lastFailureTime > 60) {
                $this->state = 'HALF_OPEN';
            } else {
                throw new CircuitBreakerOpenException();
            }
        }
        
        try {
            $result = $operation();
            
            if ($this->state === 'HALF_OPEN') {
                $this->state = 'CLOSED';
                $this->failureCount = 0;
            }
            
            return $result;
            
        } catch (Exception $e) {
            $this->failureCount++;
            $this->lastFailureTime = time();
            
            if ($this->failureCount >= 5) {
                $this->state = 'OPEN';
            }
            
            // Return fallback instead of throwing
            return $this->fallback();
        }
    }
    
    private function fallback() {
        // SIMPLE FALLBACK: Assume member exists
        // Better than crashing entire card operations
        return new MemberStatus(isActive: true, isFallback: true);
    }
}

// Usage
$circuitBreaker = new MembershipIntegrationCircuitBreaker();

$memberStatus = $circuitBreaker->call(function() use ($memberId) {
    return $this->membershipClient->getStatus($memberId);
});
```

**Why this pattern matters**: Prevents MembershipContext outages from taking down DigitalCardContext. Simple implementation, huge reliability gain.

---

## **4. EFFICIENT DATA STRUCTURES & STORAGE**

### **A. Time-Series Data Storage (For Validations)**

```sql
-- PRACTICAL TIME-SERIES TABLE - Not complex partitioning
CREATE TABLE card_validations (
    id BIGINT AUTO_INCREMENT,
    card_id UUID NOT NULL,
    validated_at TIMESTAMP(6) NOT NULL, -- Microsecond precision
    success BOOLEAN NOT NULL,
    validator_id UUID NULL,
    location POINT SRID 4326 SPATIAL, -- For geographic queries
    device_id VARCHAR(100),
    
    -- COMPOSITE INDEX FOR MOST COMMON QUERIES
    PRIMARY KEY (id),
    INDEX idx_card_validated (card_id, validated_at DESC),
    INDEX idx_validator_day (validator_id, DATE(validated_at)),
    SPATIAL INDEX idx_location (location)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(validated_at)) (
    PARTITION p2024_q1 VALUES LESS THAN (TO_DAYS('2024-04-01')),
    PARTITION p2024_q2 VALUES LESS THAN (TO_DAYS('2024-07-01')),
    PARTITION p2024_q3 VALUES LESS THAN (TO_DAYS('2024-10-01')),
    PARTITION p2024_q4 VALUES LESS THAN (TO_DAYS('2025-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- MONTHLY ROLLUP FOR ANALYTICS (simple, effective)
CREATE TABLE validation_rollups_daily (
    date DATE PRIMARY KEY,
    total_validations INT,
    successful_validations INT,
    unique_cards INT,
    avg_latency_ms DECIMAL(8,2)
);
-- Update via daily cron job, not real-time
```

**Storage Strategy**: Partition by time for easy purging. Daily rollups for analytics. Keep it simple.

---

### **B. QR Code Storage Optimization**

```php
// QR CODE STORAGE - Balance security and performance
class QrCodeStorage {
    // DON'T store full signed QR codes in DB
    // Store only the signature components
    
    private function generateAndStore(CardId $cardId): string {
        // 1. Generate minimal payload
        $payload = [
            'c' => $cardId->toString(), // card_id
            't' => time(),               // timestamp
            'v' => '2'                   // version
        ];
        
        // 2. Sign payload (not stored in DB)
        $signature = hash_hmac('sha256', json_encode($payload), $secretKey);
        $fullQr = base64_encode(json_encode($payload)) . '.' . $signature;
        
        // 3. Store ONLY what's needed for validation
        DB::table('digital_cards')->where('id', $cardId)->update([
            'qr_generated_at' => now(),
            'qr_version' => '2',
            // NOT storing: payload, signature, full QR
        ]);
        
        return $fullQr;
    }
    
    public function validate(string $qrCode, CardId $cardId): bool {
        // 1. Parse and verify signature
        [$encodedPayload, $signature] = explode('.', $qrCode);
        $payload = json_decode(base64_decode($encodedPayload), true);
        
        // 2. Check against stored metadata
        $stored = DB::table('digital_cards')
            ->where('id', $cardId)
            ->first(['qr_version', 'qr_generated_at']);
            
        if ($stored->qr_version !== $payload['v']) {
            return false; // Version mismatch
        }
        
        // 3. Verify signature (recompute)
        $expectedSignature = hash_hmac('sha256', $encodedPayload, $secretKey);
        return hash_equals($expectedSignature, $signature);
    }
}
```

**Why this works**: No sensitive data in DB. Regenerate signature on validation. Smaller DB, same security.

---

## **5. CACHING STRATEGY (PRAGMATIC, NOT PERFECT)**

```php
// LAYERED CACHING - Simple but effective
class LayeredCacheStrategy {
    private $layers = [
        'memory' => 1,    // 1 second - request lifetime
        'redis' => 300,   // 5 minutes - shared cache
        'database' => -1, // permanent - source of truth
    ];
    
    public function getWithLayers(string $key, callable $loader) {
        // 1. IN-MEMORY (request cache)
        static $memoryCache = [];
        if (isset($memoryCache[$key])) {
            return $memoryCache[$key];
        }
        
        // 2. REDIS (shared cache)
        $redisKey = "card:{$key}";
        $cached = Redis::get($redisKey);
        if ($cached !== null) {
            $memoryCache[$key] = unserialize($cached);
            return $memoryCache[$key];
        }
        
        // 3. DATABASE (source)
        $data = $loader();
        
        // 4. POPULATE CACHES
        $memoryCache[$key] = $data;
        Redis::setex($redisKey, 300, serialize($data));
        
        return $data;
    }
    
    // ASYNC CACHE WARMING FOR COMMON PATHS
    public function warmCommonPaths(): void {
        $commonCards = DB::table('digital_cards')
            ->where('status', 'active')
            ->orderBy('last_accessed', 'desc')
            ->limit(100) // Top 100 most used cards
            ->pluck('id');
            
        foreach ($commonCards as $cardId) {
            // Queue cache warming (low priority)
            dispatch(new WarmCardCache($cardId))->onQueue('low');
        }
    }
}

// CACHE INVALIDATION - Simple pattern
class CacheInvalidator {
    public function onCardChanged(CardId $cardId): void {
        // 1. Invalidate specific card
        Redis::del("card:{$cardId}");
        
        // 2. Invalidate aggregates containing this card
        Redis::del("member_cards:{$card->member_id}");
        
        // 3. BROADCAST to other instances (if clustered)
        event(new CardCacheInvalidated($cardId));
    }
}
```

**Caching Philosophy**: Simple layered approach. Async warming for hot paths. Smart invalidation, not blanket clearing.

---

## **6. EVENT-DRIVEN ARCHITECTURE (MINIMAL VIABLE)**

```php
// MINIMAL EVENT SYSTEM - Don't over-engineer
class SimpleEventBus {
    private $listeners = [];
    
    public function subscribe(string $eventClass, callable $handler): void {
        $this->listeners[$eventClass][] = $handler;
    }
    
    public function publish(object $event): void {
        $eventClass = get_class($event);
        
        if (!isset($this->listeners[$eventClass])) {
            return;
        }
        
        foreach ($this->listeners[$eventClass] as $handler) {
            // ASYNC FOR NON-CRITICAL, SYNC FOR CRITICAL
            if ($this->shouldBeAsync($event)) {
                dispatch(new HandleEventJob($event, $handler))
                    ->onQueue('events');
            } else {
                $handler($event);
            }
        }
    }
    
    private function shouldBeAsync(object $event): bool {
        // Critical events: sync (e.g., CardRevoked)
        // Non-critical: async (e.g., CardValidated for analytics)
        $asyncEvents = [
            CardValidated::class,
            CardViewed::class,
            // Analytics events
        ];
        
        return in_array(get_class($event), $asyncEvents);
    }
}

// SIMPLE EVENT STORAGE (if needed for debugging)
class EventStore {
    public function append(object $event): void {
        // Store in JSON for easy debugging
        DB::table('event_store')->insert([
            'event_type' => get_class($event),
            'aggregate_id' => $event->aggregateId ?? null,
            'payload' => json_encode($event),
            'occurred_at' => now(),
            'metadata' => json_encode([
                'user_id' => Auth::id(),
                'tenant_id' => app('currentTenant')->id,
                'trace_id' => request()->header('X-Trace-ID')
            ])
        ]);
        
        // AUTO-CLEAN OLD EVENTS (keep 30 days)
        DB::table('event_store')
            ->where('occurred_at', '<', now()->subDays(30))
            ->delete();
    }
}
```

**Event Strategy**: Sync for critical consistency, async for everything else. Simple storage for debugging only.

---

## **7. API DESIGN PATTERNS**

### **A. Versioning Strategy**

```php
// PRACTICAL VERSIONING - Not overcomplicated
class ApiVersionHandler {
    public function handle(Request $request, Closure $next) {
        // 1. Extract version from header
        $version = $request->header('X-API-Version', '1.0');
        
        // 2. Route to appropriate controller
        if ($version === '2.0') {
            // Use V2 controllers
            $controller = "App\\Http\\Controllers\\V2\\CardController";
        } else {
            // Default to V1
            $controller = "App\\Http\\Controllers\\V1\\CardController";
        }
        
        // 3. Add version to response headers
        $response = $next($request);
        $response->header('X-API-Version', $version);
        
        // 4. Add deprecation warning for old versions
        if ($version === '1.0') {
            $response->header('Warning', 
                '299 - "API v1.0 deprecated. Migrate to v2.0 by 2025-01-01."'
            );
        }
        
        return $response;
    }
}
```

### **B. Rate Limiting Algorithm (Token Bucket)**

```php
// SIMPLE TOKEN BUCKET - Fair rate limiting
class TokenBucketRateLimiter {
    private $capacity;
    private $tokens;
    private $lastRefill;
    private $refillRate; // tokens per second
    
    public function __construct(int $capacity, float $refillRate) {
        $this->capacity = $capacity;
        $this->tokens = $capacity;
        $this->lastRefill = microtime(true);
        $this->refillRate = $refillRate;
    }
    
    public function consume(int $tokens = 1): bool {
        $this->refill();
        
        if ($this->tokens >= $tokens) {
            $this->tokens -= $tokens;
            return true;
        }
        
        return false;
    }
    
    private function refill(): void {
        $now = microtime(true);
        $timePassed = $now - $this->lastRefill;
        $tokensToAdd = $timePassed * $this->refillRate;
        
        $this->tokens = min($this->capacity, $this->tokens + $tokensToAdd);
        $this->lastRefill = $now;
    }
}

// Usage per user/IP
$limiter = new TokenBucketRateLimiter(
    capacity: 60,      // 60 requests
    refillRate: 1      // 1 token per second (60/minute)
);

if (!$limiter->consume()) {
    abort(429, 'Rate limit exceeded');
}
```

---

## **8. DEPLOYMENT & SCALING STRATEGY**

### **Simple Horizontal Scaling**

```yaml
# docker-compose.scale.yml
services:
  digitalcard-api:
    image: our-app:latest
    scale: 3  # 3 instances for API
    
  queue-worker:
    image: our-app:latest
    command: php artisan queue:work
    scale: 2  # 2 workers
    
  # SHARED SERVICES (single instance)
  redis:
    image: redis:alpine
    
  # DATABASE (read replicas for scale)
  db-primary:
    image: postgres:15
    
  db-replica:
    image: postgres:15
    command: postgres -c hot_standby=on
```

### **Database Scaling Strategy**

```sql
-- READ REPLICAS FOR HEAVY READS
-- Primary: All writes + critical reads
-- Replica 1: Dashboard queries
-- Replica 2: Mobile API reads

-- CONNECTION CONFIGURATION
'digitalcard' => [
    'write' => [
        'host' => 'db-primary',
        'read' => false,
        'write' => true,
    ],
    'read' => [
        'host' => 'db-replica-1',
        'read' => true,
        'write' => false,
    ],
],

-- APPLICATION CODE
DB::connection('digitalcard.write')->transaction(function() {
    // Write operations
});

DB::connection('digitalcard.read')->table('cards')->get();
// Read operations
```

---

## **9. MONITORING & OBSERVABILITY (PRACTICAL)**

```php
// MINIMAL METRICS THAT MATTER
class EssentialMetrics {
    public static function record(string $metric, float $value = 1): void {
        // SIMPLE STATSD PROTOCOL
        $socket = fsockopen('udp://localhost', 8125);
        fwrite($socket, "digitalcard.{$metric}:{$value}|c");
        fclose($socket);
    }
    
    public static function getEssentialDashboard(): array {
        return [
            // BUSINESS METRICS
            'cards.active' => DigitalCard::where('status', 'active')->count(),
            'validations.last_hour' => DB::table('validations')
                ->where('created_at', '>', now()->subHour())
                ->count(),
            'success_rate' => $this->calculateSuccessRate(),
            
            // SYSTEM METRICS
            'response_time_p95' => Cache::get('metrics:response_p95', 0),
            'error_rate' => Cache::get('metrics:error_rate', 0),
            'queue_size' => Redis::llen('queues:default'),
            
            // SIMPLE HEALTH CHECK
            'database_connected' => (bool) DB::connection()->getPdo(),
            'redis_connected' => (bool) Redis::ping(),
        ];
    }
}

// USAGE AT CRITICAL POINTS
EssentialMetrics::record('card.validation.success');
EssentialMetrics::record('card.validation.duration', $durationMs);
```

---

## **📊 ARCHITECTURE DECISION RECORD (ADR)**

### **ADR-001: Keep It Simple**

**Context**: DigitalCardContext needs to handle 10K-100K cards with high reliability.

**Decision**: 
- Use **simple DDD** with clear aggregates
- **No event sourcing** (overkill for our needs)
- **Simple caching** with Redis + memory layers
- **Minimal Value Objects** (only where type safety matters)

**Consequences**:
- ✅ Faster development
- ✅ Easier debugging  
- ✅ Lower cognitive load
- ❌ Less "theoretically pure"
- ❌ May need refactoring if requirements explode

---

## **🎯 IMPLEMENTATION PRIORITY**

1. **Core Patterns** (Week 1-2):
   - Simple DDD aggregates
   - Circuit breaker for Membership integration
   - Layered caching

2. **Algorithms** (Week 3-4):
   - Optimized validation flow
   - Bloom filter for offline bundles
   - Token bucket rate limiting

3. **Infrastructure** (Week 5-6):
   - Read replicas for database
   - Simple event system
   - Essential metrics

**Avoid until proven needed**:
- Full CQRS
- Event sourcing
- Microservices split
- Complex message brokers
- Over-abstracted patterns

---

## **🔧 SIMPLE RULE OF THUMB**

> **Implement patterns when you feel the pain, not in anticipation of it.**

**Signs you need a pattern**:
- Code duplication → Strategy pattern
- Complex conditional logic → State pattern  
- External service failures → Circuit breaker
- Performance bottlenecks → Caching strategy
- Testing difficulties → Dependency injection

**Don't implement patterns just because**:
- "It's best practice"
- "We might need it later"
- "Other companies do it"
- "The book says so"

---

## **✅ FINAL ARCHITECTURE CHECKLIST**

- [ ] **Domain Model**: Clear aggregates, minimal VOs
- [ ] **Database**: Proper indexes, sane partitioning
- [ ] **Caching**: Layered (memory → Redis → DB)
- [ ] **Resilience**: Circuit breakers for external services
- [ ] **Performance**: Optimized hot paths only
- [ ] **Monitoring**: Business + system metrics
- [ ] **Scalability**: Read replicas, horizontal API scaling
- [ ] **Simplicity**: Can a new developer understand it in a week?

**This architecture will handle 100K cards, 1M validations/month, and 99.9% uptime with a team of 2-3 developers.** It's practical, maintainable, and scales to enterprise needs without over-engineering.