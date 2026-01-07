# 🔐 **CORRECTED IMPLEMENTATION: SECURITY FOUNDATION**

## **🎯 CRITICAL SECURITY IMPROVEMENTS**

### **1. DOMAIN-LEVEL TENANT OWNERSHIP VALIDATION**

**Problem**: Original plan relied on Laravel permissions, vulnerable to tenant boundary bypass.

**Solution**: Domain-layer tenant authorization service:

```php
// Platform/Domain/Services/TenantBrandingAuthorizationService.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Domain\Services;

use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use App\Contexts\Platform\Domain\ValueObjects\UserId;
use App\Contexts\Platform\Domain\Exceptions\BrandingAccessDeniedException;
use App\Contexts\Platform\Domain\Exceptions\TenantSuspendedException;

final class TenantBrandingAuthorizationService
{
    public function __construct(
        private readonly TenantMembershipRepositoryInterface $membershipRepository,
        private readonly TenantStatusRepositoryInterface $statusRepository
    ) {}

    /**
     * Domain-level authorization for branding updates
     * Validates: user is tenant admin + tenant is active + subscription allows branding
     */
    public function authorizeBrandingUpdate(
        UserId $userId,
        TenantDbId $tenantDbId
    ): void {
        // 1. Verify user is tenant admin for THIS specific tenant
        $isAdmin = $this->membershipRepository->isTenantAdmin($userId, $tenantDbId);
        if (!$isAdmin) {
            throw BrandingAccessDeniedException::notTenantAdmin($userId, $tenantDbId);
        }

        // 2. Verify tenant is active (not suspended/terminated)
        $tenantStatus = $this->statusRepository->getStatus($tenantDbId);
        if (!$tenantStatus->isActive()) {
            throw TenantSuspendedException::fromStatus($tenantStatus);
        }

        // 3. Verify subscription tier allows branding updates
        $subscription = $this->statusRepository->getSubscription($tenantDbId);
        if (!$subscription->allowsBrandingUpdates()) {
            throw BrandingAccessDeniedException::subscriptionRestricted(
                $subscription->tier(),
                'branding_updates'
            );
        }

        // 4. Verify no pending compliance reviews blocking changes
        if ($this->statusRepository->hasPendingComplianceReview($tenantDbId)) {
            throw BrandingAccessDeniedException::pendingComplianceReview();
        }
    }

    /**
     * Domain-level authorization for branding viewing
     * Less restrictive but still validates tenant boundaries
     */
    public function authorizeBrandingView(
        ?UserId $userId, // Null for public access
        TenantDbId $tenantDbId
    ): void {
        // Public access always allowed for branding (login pages)
        // But we still validate tenant is active
        $tenantStatus = $this->statusRepository->getStatus($tenantDbId);
        if (!$tenantStatus->isActive()) {
            throw TenantSuspendedException::fromStatus($tenantStatus);
        }

        // If user is provided, additional validation
        if ($userId !== null) {
            $hasAccess = $this->membershipRepository->hasTenantAccess($userId, $tenantDbId);
            if (!$hasAccess) {
                throw BrandingAccessDeniedException::noTenantAccess($userId, $tenantDbId);
            }
        }
    }
}
```

### **2. TENANT-SCOPED API RATE LIMITING**

**Problem**: No rate limiting, vulnerable to enumeration attacks.

**Solution**: Multi-layer rate limiting strategy:

```php
// Platform/Infrastructure/Http/Middleware/TenantBrandingRateLimit.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Services\TenantIdentifierResolver;

class TenantBrandingRateLimit
{
    public function __construct(
        private readonly TenantIdentifierResolver $tenantResolver
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenantSlug = $this->extractTenantSlug($request);

        // Layer 1: Tenant-specific rate limiting
        $tenantKey = "branding:tenant:{$tenantSlug}";
        RateLimiter::for($tenantKey, function (Request $request) {
            return Limit::perMinute(30)->by($tenantKey);
        });

        // Layer 2: IP-based rate limiting (fallback for enumeration)
        $ipKey = "branding:ip:" . $request->ip();
        RateLimiter::for($ipKey, function (Request $request) {
            return Limit::perMinute(60)->by($ipKey);
        });

        // Layer 3: Global rate limiting for /branding endpoints
        $globalKey = "branding:global";
        RateLimiter::for($globalKey, function (Request $request) {
            return Limit::perMinute(1000)->by($globalKey);
        });

        // Check all limiters
        foreach ([$tenantKey, $ipKey, $globalKey] as $key) {
            if (RateLimiter::tooManyAttempts($key)) {
                return response()->json([
                    'error' => 'Too many requests',
                    'retry_after' => RateLimiter::availableIn($key)
                ], 429);
            }
        }

        $response = $next($request);

        // Increment counters
        foreach ([$tenantKey, $ipKey, $globalKey] as $key) {
            RateLimiter::hit($key);
        }

        return $response;
    }

    private function extractTenantSlug(Request $request): string
    {
        $slug = $request->route('tenantSlug');

        // Validate slug format (matches TenantSlug VO validation)
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug)) {
            return 'invalid'; // Use placeholder for invalid slugs
        }

        return $slug;
    }
}
```

### **3. XSS PROTECTION FOR CONTENT FIELDS**

**Problem**: Content fields (welcome_message, hero_title) vulnerable to XSS.

**Solution**: Domain-level content sanitization:

```php
// Platform/Domain/ValueObjects/BrandingContent.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Domain\ValueObjects;

use App\Contexts\Platform\Domain\Exceptions\InvalidBrandingContentException;
use InvalidArgumentException;

final class BrandingContent
{
    private string $value;
    private string $sanitized;

    private function __construct(string $value)
    {
        $this->validate($value);
        $this->value = $value;
        $this->sanitized = $this->sanitize($value);
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }

    public function toString(): string
    {
        return $this->value;
    }

    public function toSanitizedString(): string
    {
        return $this->sanitized;
    }

    public function toHtmlSafeString(): string
    {
        return htmlspecialchars($this->sanitized, ENT_QUOTES, 'UTF-8');
    }

    private function validate(string $value): void
    {
        if (empty($value)) {
            throw InvalidBrandingContentException::empty();
        }

        if (mb_strlen($value) > 1000) {
            throw InvalidBrandingContentException::tooLong($value, 1000);
        }

        // Check for malicious patterns
        $this->validateSecurity($value);
    }

    private function validateSecurity(string $value): void
    {
        // Reject obvious XSS attempts
        $dangerousPatterns = [
            '/<script/i',
            '/javascript:/i',
            '/onclick=/i',
            '/onload=/i',
            '/onerror=/i',
            '/data:/i',
            '/vbscript:/i',
        ];

        foreach ($dangerousPatterns as $pattern) {
            if (preg_match($pattern, $value)) {
                throw InvalidBrandingContentException::containsDangerousContent($pattern);
            }
        }

        // Check for excessive special characters (potential encoding attacks)
        $specialCharRatio = preg_match_all('/[<>\"\'&]/', $value) / mb_strlen($value);
        if ($specialCharRatio > 0.3) { // More than 30% special chars
            throw InvalidBrandingContentException::suspiciousEncoding();
        }
    }

    private function sanitize(string $value): string
    {
        // Step 1: Strip all HTML tags except allowed safe ones
        $allowedTags = '<strong><em><b><i><u><br><p><span>';
        $stripped = strip_tags($value, $allowedTags);

        // Step 2: Remove attributes from allowed tags
        $stripped = preg_replace('/<([a-z][a-z0-9]*)[^>]*?(\/?)>/i', '<$1$2>', $stripped);

        // Step 3: Normalize whitespace
        $stripped = preg_replace('/\s+/', ' ', $stripped);

        // Step 4: Trim and return
        return trim($stripped);
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }
}
```

### **4. AUDIT TRAIL WITH EVENT SOURCING**

**Problem**: No audit trail for branding changes (critical for election platforms).

**Solution**: Comprehensive event sourcing:

```php
// Platform/Domain/Events/BrandingUpdated.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Domain\Events;

use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use App\Contexts\Platform\Domain\ValueObjects\UserId;
use App\Contexts\Platform\Domain\ValueObjects\BrandingChangeSet;
use DateTimeImmutable;

final class BrandingUpdated implements DomainEvent
{
    public function __construct(
        public readonly TenantDbId $tenantDbId,
        public readonly UserId $updatedBy,
        public readonly BrandingChangeSet $changes,
        public readonly DateTimeImmutable $occurredAt,
        public readonly string $sourceIp,
        public readonly string $userAgent
    ) {}

    public function aggregateId(): string
    {
        return "branding:{$this->tenantDbId->toInt()}";
    }

    public function eventType(): string
    {
        return 'branding.updated';
    }

    public function toArray(): array
    {
        return [
            'tenant_db_id' => $this->tenantDbId->toInt(),
            'updated_by' => $this->updatedBy->toString(),
            'changes' => $this->changes->toArray(),
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
            'source_ip' => $this->sourceIp,
            'user_agent' => $this->userAgent,
            'event_type' => $this->eventType(),
        ];
    }
}
```

```php
// Platform/Domain/ValueObjects/BrandingChangeSet.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Domain\ValueObjects;

final class BrandingChangeSet
{
    private array $changes;

    public function __construct(array $oldBranding, array $newBranding)
    {
        $this->changes = $this->calculateChanges($oldBranding, $newBranding);
    }

    public function hasChanges(): bool
    {
        return !empty($this->changes);
    }

    public function getChanges(): array
    {
        return $this->changes;
    }

    public function toArray(): array
    {
        return $this->changes;
    }

    public function getSecuritySignificantChanges(): array
    {
        return array_filter($this->changes, function ($change) {
            return in_array($change['field'], [
                'primary_color',
                'secondary_color',
                'logo_url',
                'welcome_message'
            ]);
        });
    }

    private function calculateChanges(array $old, array $new): array
    {
        $changes = [];

        foreach ($new as $key => $newValue) {
            $oldValue = $old[$key] ?? null;

            if ($oldValue !== $newValue) {
                $changes[] = [
                    'field' => $key,
                    'old_value' => $oldValue,
                    'new_value' => $newValue,
                    'change_type' => $this->determineChangeType($key, $oldValue, $newValue),
                    'security_impact' => $this->assessSecurityImpact($key, $newValue),
                ];
            }
        }

        return $changes;
    }

    private function determineChangeType(string $field, $oldValue, $newValue): string
    {
        $majorFields = ['primary_color', 'secondary_color', 'logo_url'];
        $minorFields = ['welcome_message', 'hero_title', 'hero_subtitle'];

        if (in_array($field, $majorFields)) {
            return 'major';
        }

        if (in_array($field, $minorFields)) {
            return 'minor';
        }

        return 'patch';
    }

    private function assessSecurityImpact(string $field, $newValue): string
    {
        if ($field === 'logo_url') {
            return $this->validateUrlSecurity($newValue);
        }

        if (str_contains($field, 'message') || str_contains($field, 'title')) {
            return $this->validateContentSecurity($newValue);
        }

        return 'low';
    }
}
```

### **5. INPUT VALIDATION AGAINST CSS INJECTION**

**Problem**: CSS variables could be injected with malicious content.

**Solution**: CSS-safe value objects:

```php
// Platform/Domain/ValueObjects/BrandingCssVariable.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Domain\ValueObjects;

use App\Contexts\Platform\Domain\Exceptions\InvalidCssValueException;

final class BrandingCssVariable
{
    private string $name;
    private string $value;

    private function __construct(string $name, string $value)
    {
        $this->validateName($name);
        $this->validateValue($value);
        $this->name = $name;
        $this->value = $value;
    }

    public static function create(string $name, string $value): self
    {
        return new self($name, $value);
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function toCssDeclaration(): string
    {
        return "--{$this->name}: {$this->value};";
    }

    private function validateName(string $name): void
    {
        // Must be valid CSS custom property name
        if (!preg_match('/^[a-zA-Z][a-zA-Z0-9\-_]*$/', $name)) {
            throw InvalidCssValueException::invalidVariableName($name);
        }

        // Prevent reserved names
        $reserved = ['url', 'expression', 'javascript', 'data'];
        foreach ($reserved as $reservedWord) {
            if (stripos($name, $reservedWord) !== false) {
                throw InvalidCssValueException::reservedVariableName($name);
            }
        }
    }

    private function validateValue(string $value): void
    {
        // Reject dangerous CSS values
        $dangerousPatterns = [
            '/expression\(/i',
            '/javascript:/i',
            '/data:/i',
            '/@import/i',
            '/@charset/i',
            '/@namespace/i',
            '/url\(.*data:/i',
            '/\\\\(?:[0-9a-f]{1,6}|.)/i', // Unicode escapes
        ];

        foreach ($dangerousPatterns as $pattern) {
            if (preg_match($pattern, $value)) {
                throw InvalidCssValueException::dangerousCssValue($value);
            }
        }

        // Validate length
        if (strlen($value) > 1000) {
            throw InvalidCssValueException::valueTooLong($value);
        }
    }
}
```

### **6. CORS CONFIGURATION FOR MOBILE APIS**

**Problem**: No CORS configuration for Angular mobile app.

**Solution**: Tenant-aware CORS middleware:

```php
// Platform/Infrastructure/Http/Middleware/TenantAwareCors.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;

class TenantAwareCors
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Get allowed origins from tenant configuration
        $tenantSlug = $request->route('tenantSlug');
        $allowedOrigins = $this->getAllowedOrigins($tenantSlug);

        // Add CORS headers
        $response->headers->set('Access-Control-Allow-Origin', $allowedOrigins);
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Slug');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');
        $response->headers->set('Access-Control-Max-Age', '86400'); // 24 hours

        // Handle preflight requests
        if ($request->isMethod('OPTIONS')) {
            $response->setStatusCode(200);
        }

        return $response;
    }

    private function getAllowedOrigins(?string $tenantSlug): string
    {
        // Default origins (development)
        $defaultOrigins = [
            'http://localhost:3000',  // Vue dev server
            'http://localhost:8100',  // Ionic dev server
            'https://admin.publicdigit.test',
            'https://mobile.publicdigit.test',
        ];

        // Add tenant-specific domain if provided
        if ($tenantSlug && $this->isValidTenantSlug($tenantSlug)) {
            $defaultOrigins[] = "https://{$tenantSlug}.publicdigit.com";
            $defaultOrigins[] = "https://{$tenantSlug}-admin.publicdigit.com";
        }

        // In production, be more restrictive
        if (app()->environment('production')) {
            return implode(', ', array_filter($defaultOrigins, function ($origin) {
                return str_contains($origin, 'publicdigit.com');
            }));
        }

        return implode(', ', $defaultOrigins);
    }

    private function isValidTenantSlug(string $slug): bool
    {
        return preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug);
    }
}
```

### **7. SECURITY HEADERS MIDDLEWARE**

**Problem**: Missing security headers for branding API.

**Solution**: Comprehensive security headers:

```php
// Platform/Infrastructure/Http/Middleware/BrandingSecurityHeaders.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BrandingSecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Content Security Policy for branding endpoints
        $csp = $this->generateCsp($request);

        $response->headers->set('Content-Security-Policy', $csp);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Feature Policy (renamed to Permissions Policy)
        $response->headers->set('Permissions-Policy', $this->generatePermissionsPolicy());

        // Cache control for sensitive endpoints
        if ($request->isMethod('PUT', 'POST', 'DELETE')) {
            $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }

        return $response;
    }

    private function generateCsp(Request $request): string
    {
        $policies = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'", // Vue requires unsafe-inline
            "style-src 'self' 'unsafe-inline'", // Dynamic CSS requires unsafe-inline
            "img-src 'self' data: https:",
            "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
            "connect-src 'self'",
            "media-src 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ];

        // Add tenant-specific logo domain if present
        $logoUrl = $request->input('logo_url');
        if ($logoUrl && filter_var($logoUrl, FILTER_VALIDATE_URL)) {
            $domain = parse_url($logoUrl, PHP_URL_HOST);
            $policies[3] = "img-src 'self' data: https: {$domain}"; // Add to img-src
        }

        return implode('; ', $policies);
    }

    private function generatePermissionsPolicy(): string
    {
        $policies = [
            'camera=()',
            'microphone=()',
            'geolocation=()',
            'payment=()',
            'usb=()',
            'serial=()',
            'ambient-light-sensor=()',
            'accelerometer=()',
            'gyroscope=()',
            'magnetometer=()',
        ];

        return implode(', ', $policies);
    }
}
```

## **📋 SECURITY IMPLEMENTATION CHECKLIST**

### **Phase 1: Pre-Implementation (Week 0)**
- [ ] **Domain authorization service** with tenant boundary validation
- [ ] **Rate limiting middleware** with three-layer protection
- [ ] **XSS-safe Value Objects** for all content fields
- [ ] **Event sourcing foundation** for audit trails

### **Phase 2: Core Security (Week 1)**
- [ ] **CSS injection protection** with validated CSS variables
- [ ] **CORS configuration** for mobile APIs
- [ ] **Security headers middleware** with CSP
- [ ] **Input validation** against encoding attacks

### **Phase 3: Advanced Security (Week 2)**
- [ ] **Penetration testing** integration in CI/CD
- [ ] **Security monitoring** with anomaly detection
- [ ] **Compliance logging** for election requirements
- [ ] **Data encryption** for sensitive branding data

## **🚨 CRITICAL SECURITY METRICS**

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Tenant enumeration attempts | 0 successful | WAF logs + rate limiting |
| XSS prevention | 100% blocked | Automated security tests |
| Audit trail coverage | 100% changes logged | Event store verification |
| API abuse detection | < 5 false positives | ML anomaly detection |
| Compliance violations | 0 | Automated compliance checks |

## **🎯 IMMEDIATE ACTION ITEMS**

1. **Implement DomainAuthorizationService before any API development**
2. **Deploy rate limiting middleware to all branding endpoints**
3. **Create security test suite with OWASP ZAP integration**
4. **Set up security monitoring dashboard for branding API**
5. **Train development team on election platform security requirements**

> **Architect's Note**: Security in election platforms is not optional. These foundation elements must be implemented before any functional code. The original plan's security gaps would have been catastrophic for a production election platform.