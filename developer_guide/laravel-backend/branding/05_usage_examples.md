# Platform Branding - Usage Examples

**Document Version:** 1.0
**Last Updated:** 2026-01-06

---

## 📋 Overview

This guide provides practical code examples for common branding operations.

---

## 🚀 Basic Operations

### Example 1: Create Default Branding for New Tenant

```php
use App\Contexts\Platform\Domain\Entities\TenantBranding;
use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;
use App\Contexts\Platform\Infrastructure\Repositories\EloquentTenantBrandingRepository;
use App\Contexts\Platform\Infrastructure\Models\TenantBrandingModel;
use App\Contexts\Shared\Domain\ValueObjects\TenantId;

// Initialize repository
$repository = new EloquentTenantBrandingRepository(
    new TenantBrandingModel()
);

// Create tenant ID
$tenantId = TenantId::fromSlug('nrna');

// Create branding with defaults
$bundle = BrandingBundle::defaults();
$branding = TenantBranding::create($tenantId, $bundle);

// Save to database
$repository->saveForTenant($branding);
```

### Example 2: Retrieve Existing Branding

```php
$tenantId = TenantId::fromSlug('nrna');

// Find branding (returns null if not found)
$branding = $repository->findForTenant($tenantId);

if ($branding === null) {
    // Handle missing branding
    $branding = TenantBranding::create($tenantId, BrandingBundle::defaults());
    $repository->saveForTenant($branding);
}

// Access branding data
$bundle = $branding->getBranding();
$visuals = $bundle->getVisuals();
$primaryColor = $visuals->getPrimaryColor()->toString(); // "#1976D2"
```

### Example 3: Check if Branding Exists

```php
$tenantId = TenantId::fromSlug('munich');

if ($repository->existsForTenant($tenantId)) {
    echo "Branding already configured";
} else {
    echo "Need to create branding";
}
```

### Example 4: Delete Branding

```php
$tenantId = TenantId::fromSlug('old-tenant');

// Idempotent: safe to call even if branding doesn't exist
$repository->deleteForTenant($tenantId);
```

---

## 🎨 Customizing Visual Branding

### Example 5: Custom Brand Colors

```php
use App\Contexts\Platform\Domain\ValueObjects\BrandingColor;
use App\Contexts\Platform\Domain\ValueObjects\BrandingVisuals;

// Create custom colors
$primaryColor = BrandingColor::fromString('#E65100'); // Deep Orange
$secondaryColor = BrandingColor::fromString('#1976D2'); // Blue

// Create visual branding
$visuals = BrandingVisuals::create(
    primaryColor: $primaryColor,
    secondaryColor: $secondaryColor,
    logoUrl: 'https://cdn.example.com/nrna-logo.png',
    fontFamily: 'Roboto, sans-serif'
);

// Create complete branding bundle
$bundle = BrandingBundle::create(
    visuals: $visuals,
    content: BrandingContent::defaults(),
    identity: BrandingIdentity::defaults()
);

// Create and save
$branding = TenantBranding::create($tenantId, $bundle);
$repository->saveForTenant($branding);
```

### Example 6: Update Logo Only

```php
// Retrieve existing branding
$branding = $repository->findForTenant($tenantId);
$currentBundle = $branding->getBranding();

// Create new visuals with updated logo
$newVisuals = BrandingVisuals::create(
    primaryColor: $currentBundle->getVisuals()->getPrimaryColor(),
    secondaryColor: $currentBundle->getVisuals()->getSecondaryColor(),
    logoUrl: 'https://cdn.example.com/new-logo.png', // ✅ Updated
    fontFamily: $currentBundle->getVisuals()->getFontFamily()
);

// Update bundle immutably
$newBundle = $currentBundle->withVisuals($newVisuals);

// Update and save
$branding->updateBranding($newBundle);
$repository->saveForTenant($branding);
```

---

## 📝 Customizing Content

### Example 7: Custom Welcome Message and CTAs

```php
use App\Contexts\Platform\Domain\ValueObjects\BrandingContent;

$content = BrandingContent::create(
    welcomeMessage: 'Welcome to NRNA Elections 2026',
    heroTitle: 'Your Vote Shapes Our Future',
    heroSubtitle: 'Join thousands of members in democratic participation',
    ctaText: 'Vote Now'
);

$bundle = BrandingBundle::create(
    visuals: BrandingVisuals::defaults(),
    content: $content, // ✅ Custom content
    identity: BrandingIdentity::defaults()
);

$branding = TenantBranding::create($tenantId, $bundle);
$repository->saveForTenant($branding);
```

### Example 8: Update Only Hero Section

```php
$branding = $repository->findForTenant($tenantId);
$currentBundle = $branding->getBranding();

// Create new content with updated hero
$newContent = BrandingContent::create(
    welcomeMessage: $currentBundle->getContent()->getWelcomeMessage(),
    heroTitle: 'New Hero Title', // ✅ Updated
    heroSubtitle: 'New inspiring subtitle', // ✅ Updated
    ctaText: $currentBundle->getContent()->getCtaText()
);

// Update bundle
$newBundle = $currentBundle->withContent($newContent);
$branding->updateBranding($newBundle);
$repository->saveForTenant($branding);
```

---

## 🏢 Organizational Identity

### Example 9: Custom Organization Identity

```php
use App\Contexts\Platform\Domain\ValueObjects\BrandingIdentity;

$identity = BrandingIdentity::create(
    organizationName: 'National Election Commission',
    organizationTagline: 'Building Democracy Together',
    faviconUrl: 'https://cdn.example.com/favicon.ico'
);

$bundle = BrandingBundle::create(
    visuals: BrandingVisuals::defaults(),
    content: BrandingContent::defaults(),
    identity: $identity // ✅ Custom identity
);

$branding = TenantBranding::create($tenantId, $bundle);
$repository->saveForTenant($branding);
```

### Example 10: Update Organization Name Only

```php
$branding = $repository->findForTenant($tenantId);
$currentBundle = $branding->getBranding();

// Create new identity with updated name
$newIdentity = BrandingIdentity::create(
    organizationName: 'New Organization Name', // ✅ Updated
    organizationTagline: $currentBundle->getIdentity()->getOrganizationTagline(),
    faviconUrl: $currentBundle->getIdentity()->getFaviconUrl()
);

// Update bundle
$newBundle = $currentBundle->withIdentity($newIdentity);
$branding->updateBranding($newBundle);
$repository->saveForTenant($branding);
```

---

## 🎯 Complete Customization

### Example 11: Fully Custom Branding

```php
// Create custom visuals
$visuals = BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#D32F2F'), // Red
    secondaryColor: BrandingColor::fromString('#388E3C'), // Green
    logoUrl: 'https://cdn.example.com/custom-logo.png',
    fontFamily: 'Open Sans, sans-serif'
);

// Create custom content
$content = BrandingContent::create(
    welcomeMessage: 'Welcome to Our Democratic Platform',
    heroTitle: 'Every Voice Matters',
    heroSubtitle: 'Participate in shaping our community\'s future',
    ctaText: 'Get Started Today'
);

// Create custom identity
$identity = BrandingIdentity::create(
    organizationName: 'Community Election Board',
    organizationTagline: 'Democracy Through Participation',
    faviconUrl: 'https://cdn.example.com/favicon.png'
);

// Combine into bundle
$bundle = BrandingBundle::create($visuals, $content, $identity);

// Create and save
$tenantId = TenantId::fromSlug('community');
$branding = TenantBranding::create($tenantId, $bundle);
$repository->saveForTenant($branding);
```

---

## 🔄 Updating Existing Branding

### Example 12: Update Multiple Aspects at Once

```php
// Retrieve existing
$branding = $repository->findForTenant($tenantId);

// Create new visuals
$newVisuals = BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#1976D2'),
    secondaryColor: BrandingColor::fromString('#2E7D32'),
    logoUrl: 'https://cdn.example.com/updated-logo.png',
    fontFamily: 'Roboto, system-ui, sans-serif'
);

// Create new content
$newContent = BrandingContent::create(
    welcomeMessage: 'Updated Welcome Message',
    heroTitle: 'Updated Hero Title',
    heroSubtitle: 'Updated subtitle with new branding',
    ctaText: 'Join Us'
);

// Update bundle (chain withX methods)
$newBundle = $branding->getBranding()
    ->withVisuals($newVisuals)
    ->withContent($newContent);

// Update and save
$branding->updateBranding($newBundle);
$repository->saveForTenant($branding);
```

---

## ✅ Validation Examples

### Example 13: Handle Validation Errors

```php
use App\Contexts\Platform\Domain\Exceptions\InvalidBrandingException;

try {
    // Attempt to create with invalid data
    $color = BrandingColor::fromString('not-a-color');
} catch (InvalidBrandingException $e) {
    // Handle validation error
    echo "Invalid color: " . $e->getMessage();
    // "Invalid color format: 'not-a-color'. Expected hex format like #1976D2"
}

try {
    $identity = BrandingIdentity::create(
        organizationName: str_repeat('a', 101), // Too long
        organizationTagline: 'Valid'
    );
} catch (InvalidBrandingException $e) {
    echo "Validation failed: " . $e->getMessage();
    // "Organization Name exceeds maximum length of 100 characters (actual: 101)"
}
```

### Example 14: WCAG Compliance Check

```php
$visuals = BrandingVisuals::create(
    primaryColor: BrandingColor::fromString('#FFEB3B'), // Light yellow
    secondaryColor: BrandingColor::fromString('#FFF176')  // Light yellow
);

$bundle = BrandingBundle::create(
    $visuals,
    BrandingContent::defaults(),
    BrandingIdentity::defaults()
);

if (!$bundle->isWcagCompliant()) {
    echo "Warning: Color combination may not meet WCAG AA standards";
    echo "Consider using colors with better contrast";
}
```

---

## 🔍 Querying Branding Data

### Example 15: Extract Specific Values

```php
$branding = $repository->findForTenant($tenantId);

if ($branding) {
    $bundle = $branding->getBranding();

    // Extract visuals
    $primaryColor = $bundle->getVisuals()->getPrimaryColor()->toString();
    $secondaryColor = $bundle->getVisuals()->getSecondaryColor()->toString();
    $logoUrl = $bundle->getVisuals()->getLogoUrl();
    $fontFamily = $bundle->getVisuals()->getFontFamily();

    // Extract content
    $welcomeMessage = $bundle->getContent()->getWelcomeMessage();
    $heroTitle = $bundle->getContent()->getHeroTitle();
    $heroSubtitle = $bundle->getContent()->getHeroSubtitle();
    $ctaText = $bundle->getContent()->getCtaText();

    // Extract identity
    $orgName = $bundle->getIdentity()->getOrganizationName();
    $tagline = $bundle->getIdentity()->getOrganizationTagline();
    $faviconUrl = $bundle->getIdentity()->getFaviconUrl();

    // Use in template/API response
    return [
        'colors' => [
            'primary' => $primaryColor,
            'secondary' => $secondaryColor,
        ],
        'logo' => $logoUrl,
        'font' => $fontFamily,
        'content' => [
            'welcome' => $welcomeMessage,
            'hero' => [
                'title' => $heroTitle,
                'subtitle' => $heroSubtitle,
            ],
            'cta' => $ctaText,
        ],
        'identity' => [
            'name' => $orgName,
            'tagline' => $tagline,
            'favicon' => $faviconUrl,
        ],
    ];
}
```

### Example 16: Convert to Array for API

```php
$branding = $repository->findForTenant($tenantId);

if ($branding) {
    $array = $branding->getBranding()->toArray();
    // Returns:
    // [
    //     'visuals' => [
    //         'primary_color' => '#1976D2',
    //         'secondary_color' => '#2E7D32',
    //         'logo_url' => '...',
    //         'font_family' => '...',
    //     ],
    //     'content' => [
    //         'welcome_message' => '...',
    //         'hero_title' => '...',
    //         'hero_subtitle' => '...',
    //         'cta_text' => '...',
    //     ],
    //     'identity' => [
    //         'organization_name' => '...',
    //         'organization_tagline' => '...', // ✅ Domain naming
    //         'favicon_url' => '...',
    //     ],
    // ]

    return response()->json($array);
}
```

---

## 🔐 Tenant Isolation Examples

### Example 17: Ensure Tenant Context

```php
// ✅ CORRECT: Explicit tenant context
$tenantId = TenantId::fromSlug('nrna');
$branding = $repository->findForTenant($tenantId);

// Access only NRNA's branding, no risk of cross-tenant data access
```

### Example 18: Handle Multi-Tenant Scenarios

```php
$tenants = ['nrna', 'munich', 'london'];
$brandingData = [];

foreach ($tenants as $slug) {
    $tenantId = TenantId::fromSlug($slug);
    $branding = $repository->findForTenant($tenantId);

    if ($branding) {
        $brandingData[$slug] = $branding->getBranding()->toArray();
    }
}

// Each tenant's branding properly isolated
```

---

## 📊 Domain Events

### Example 19: Capture Domain Events

```php
// Create new branding
$branding = TenantBranding::create($tenantId, $bundle);

// Check domain events
$events = $branding->getDomainEvents();
// [TenantBrandingCreated]

// Update branding
$branding->updateBranding($newBundle);

// Check events again
$events = $branding->getDomainEvents();
// [TenantBrandingCreated, TenantBrandingUpdated]

// Clear events after processing
$branding->clearDomainEvents();
```

### Example 20: Process Events (Future Application Layer)

```php
// This will be implemented in Application Layer
class UpdateTenantBrandingHandler
{
    public function handle(UpdateTenantBrandingCommand $command): void
    {
        // Load aggregate
        $branding = $this->repository->findForTenant($command->tenantId);

        // Execute business operation
        $branding->updateBranding($command->newBranding);

        // Persist
        $this->repository->saveForTenant($branding);

        // Dispatch events
        foreach ($branding->getDomainEvents() as $event) {
            $this->eventDispatcher->dispatch($event);
        }

        $branding->clearDomainEvents();
    }
}
```

---

## 🚨 Error Handling

### Example 21: Comprehensive Error Handling

```php
use App\Contexts\Platform\Domain\Exceptions\InvalidBrandingException;

function updateTenantBranding(string $slug, array $data): array
{
    try {
        // Parse tenant ID
        $tenantId = TenantId::fromSlug($slug);

        // Find existing branding
        $branding = $repository->findForTenant($tenantId);

        if (!$branding) {
            return [
                'success' => false,
                'error' => 'Branding not found for tenant: ' . $slug,
            ];
        }

        // Create new visuals (may throw InvalidBrandingException)
        $newVisuals = BrandingVisuals::create(
            primaryColor: BrandingColor::fromString($data['primary_color']),
            secondaryColor: BrandingColor::fromString($data['secondary_color']),
            logoUrl: $data['logo_url'] ?? null
        );

        // Update bundle
        $newBundle = $branding->getBranding()->withVisuals($newVisuals);

        // Update and save
        $branding->updateBranding($newBundle);
        $repository->saveForTenant($branding);

        return [
            'success' => true,
            'message' => 'Branding updated successfully',
        ];

    } catch (InvalidBrandingException $e) {
        return [
            'success' => false,
            'error' => 'Validation error: ' . $e->getMessage(),
        ];

    } catch (\RuntimeException $e) {
        return [
            'success' => false,
            'error' => 'Tenant not found: ' . $e->getMessage(),
        ];

    } catch (\Exception $e) {
        return [
            'success' => false,
            'error' => 'Unexpected error: ' . $e->getMessage(),
        ];
    }
}
```

---

## 🎯 Best Practices Summary

### DO ✅

1. **Always use ForTenant methods**
   ```php
   $repository->findForTenant($tenantId);
   ```

2. **Handle null returns**
   ```php
   $branding = $repository->findForTenant($tenantId);
   if ($branding === null) { /* handle */ }
   ```

3. **Use immutable updates**
   ```php
   $newBundle = $bundle->withVisuals($newVisuals);
   ```

4. **Validate before saving**
   ```php
   if ($bundle->isWcagCompliant()) {
       $repository->saveForTenant($branding);
   }
   ```

5. **Use Value Objects**
   ```php
   $color = BrandingColor::fromString('#1976D2');
   ```

### DON'T ❌

1. **Don't bypass validation**
   ```php
   // ❌ No direct property access
   $branding->primaryColor = '#invalid';
   ```

2. **Don't ignore null checks**
   ```php
   // ❌ May throw error
   $color = $repository->findForTenant($tenantId)->getBranding()->getVisuals()->getPrimaryColor();
   ```

3. **Don't use raw strings**
   ```php
   // ❌ No type safety
   function setColor(string $color) { }

   // ✅ Type safety
   function setColor(BrandingColor $color) { }
   ```

4. **Don't mutate Value Objects**
   ```php
   // ❌ Properties are readonly
   $visuals->primaryColor = $newColor;
   ```

---

**Next:** [README](./README.md) for complete guide overview

---

**Last Updated:** 2026-01-06
**Status:** ✅ Production Ready
