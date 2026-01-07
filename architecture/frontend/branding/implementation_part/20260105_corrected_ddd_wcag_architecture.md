# 🏛️ **CORRECTED IMPLEMENTATION: DDD ARCHITECTURE WITH WCAG COMPLIANCE**

## **🎯 CRITICAL ARCHITECTURAL IMPROVEMENTS**

### **1. WCAG 2.1 AA AS DOMAIN INVARIANT**

**Problem**: Original plan had basic color validation only. Election platforms require strict accessibility compliance.

**Solution**: WCAG compliance as domain business rule:

```php
// Platform/Domain/Services/BrandingAccessibilityService.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Domain\Services;

use App\Contexts\Platform\Domain\ValueObjects\BrandingColor;
use App\Contexts\Platform\Domain\ValueObjects\BrandingFontFamily;
use App\Contexts\Platform\Domain\Exceptions\WcagComplianceException;
use App\Contexts\Platform\Domain\ValueObjects\WcagComplianceReport;

final class BrandingAccessibilityService
{
    // WCAG 2.1 AA contrast ratios
    private const NORMAL_TEXT_MIN_RATIO = 4.5;  // 4.5:1 for normal text
    private const LARGE_TEXT_MIN_RATIO = 3.0;   // 3:1 for large text (18pt+)
    private const UI_COMPONENT_MIN_RATIO = 3.0; // 3:1 for UI components

    /**
     * Validate complete branding package for WCAG 2.1 AA compliance
     * Election platforms have legal accessibility requirements
     */
    public function validateCompliance(
        BrandingColor $primaryColor,
        BrandingColor $secondaryColor,
        BrandingColor $backgroundColor,
        BrandingColor $textColor,
        BrandingFontFamily $fontFamily,
        float $baseFontSize
    ): WcagComplianceReport {
        $violations = [];

        // 1. Color contrast validation (WCAG 1.4.3)
        $contrastChecks = [
            ['Text on Background', $textColor, $backgroundColor, self::NORMAL_TEXT_MIN_RATIO],
            ['Primary Button Text', $textColor, $primaryColor, self::UI_COMPONENT_MIN_RATIO],
            ['Secondary Button Text', $textColor, $secondaryColor, self::UI_COMPONENT_MIN_RATIO],
            ['Large Text on Background', $textColor, $backgroundColor, self::LARGE_TEXT_MIN_RATIO],
            ['Focus Indicator', $primaryColor, $backgroundColor, 3.0], // WCAG 2.4.7
        ];

        foreach ($contrastChecks as $check) {
            [$label, $foreground, $background, $minRatio] = $check;
            $ratio = $this->calculateContrastRatio($foreground, $background);

            if ($ratio < $minRatio) {
                $violations[] = [
                    'code' => 'WCAG_1_4_3',
                    'message' => "{$label} contrast ratio {$ratio}:1 below required {$minRatio}:1",
                    'severity' => 'critical',
                    'elements' => $this->getAffectedElements($label),
                    'fix_suggestion' => $this->getContrastFixSuggestion($foreground, $background, $minRatio),
                ];
            }
        }

        // 2. Font accessibility validation (WCAG 1.4.12)
        $fontViolations = $this->validateFontAccessibility($fontFamily, $baseFontSize);
        $violations = array_merge($violations, $fontViolations);

        // 3. Color independence validation (WCAG 1.4.1)
        if ($this->colorsAreTooSimilar($primaryColor, $secondaryColor)) {
            $violations[] = [
                'code' => 'WCAG_1_4_1',
                'message' => 'Primary and secondary colors too similar for color-blind users',
                'severity' => 'high',
                'elements' => ['buttons', 'alerts', 'badges'],
                'fix_suggestion' => 'Ensure colors differ by at least 3:1 contrast ratio',
            ];
        }

        // 4. Non-text contrast validation (WCAG 1.4.11)
        $nonTextViolations = $this->validateNonTextContrast($primaryColor, $secondaryColor, $backgroundColor);
        $violations = array_merge($violations, $nonTextViolations);

        return new WcagComplianceReport(
            hasViolations: !empty($violations),
            violations: $violations,
            overallScore: $this->calculateComplianceScore($violations),
            testedAt: new DateTimeImmutable(),
            complianceLevel: $this->determineComplianceLevel($violations)
        );
    }

    /**
     * Calculate contrast ratio using WCAG formula
     * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
     */
    private function calculateContrastRatio(BrandingColor $color1, BrandingColor $color2): float
    {
        $l1 = $this->calculateRelativeLuminance($color1);
        $l2 = $this->calculateRelativeLuminance($color2);

        $lighter = max($l1, $l2);
        $darker = min($l1, $l2);

        return ($lighter + 0.05) / ($darker + 0.05);
    }

    private function calculateRelativeLuminance(BrandingColor $color): float
    {
        $rgb = $color->toRgb();

        foreach ($rgb as $key => $value) {
            $value = $value / 255.0;
            if ($value <= 0.03928) {
                $rgb[$key] = $value / 12.92;
            } else {
                $rgb[$key] = pow(($value + 0.055) / 1.055, 2.4);
            }
        }

        return 0.2126 * $rgb['r'] + 0.7152 * $rgb['g'] + 0.0722 * $rgb['b'];
    }

    /**
     * Validate font meets WCAG text spacing requirements
     */
    private function validateFontAccessibility(BrandingFontFamily $fontFamily, float $baseFontSize): array
    {
        $violations = [];

        // WCAG 1.4.12: Text Spacing
        if ($baseFontSize < 16.0) { // 16px minimum for body text
            $violations[] = [
                'code' => 'WCAG_1_4_12',
                'message' => "Base font size {$baseFontSize}px below recommended 16px for readability",
                'severity' => 'medium',
                'elements' => ['body', 'paragraphs'],
                'fix_suggestion' => 'Increase base font size to at least 16px',
            ];
        }

        // Check for non-standard fonts that might not render accessibility features
        $systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace'];
        $fontString = $fontFamily->toString();

        if (!preg_match('/(' . implode('|', $systemFonts) . ')/', $fontString)) {
            $violations[] = [
                'code' => 'WCAG_1_4_12',
                'message' => 'Custom font may not support all accessibility features',
                'severity' => 'low',
                'elements' => ['all text elements'],
                'fix_suggestion' => 'Ensure font supports OpenType features and has good legibility',
            ];
        }

        return $violations;
    }

    /**
     * Validate colors are distinguishable for color-blind users
     */
    private function colorsAreTooSimilar(BrandingColor $color1, BrandingColor $color2): bool
    {
        // Convert to grayscale and compare
        $gray1 = $this->toGrayscale($color1);
        $gray2 = $this->toGrayscale($color2);

        return abs($gray1 - $gray2) < 0.1; // Less than 10% difference
    }

    /**
     * Validate non-text elements (icons, borders) have sufficient contrast
     */
    private function validateNonTextContrast(
        BrandingColor $primary,
        BrandingColor $secondary,
        BrandingColor $background
    ): array {
        $violations = [];

        // Check icon colors against background
        $iconContrast = $this->calculateContrastRatio($primary, $background);
        if ($iconContrast < 3.0) {
            $violations[] = [
                'code' => 'WCAG_1_4_11',
                'message' => "Icon contrast ratio {$iconContrast}:1 below required 3:1",
                'severity' => 'high',
                'elements' => ['icons', 'indicators'],
                'fix_suggestion' => 'Increase contrast between icon color and background',
            ];
        }

        // Check border colors
        $borderContrast = $this->calculateContrastRatio($secondary, $background);
        if ($borderContrast < 3.0) {
            $violations[] = [
                'code' => 'WCAG_1_4_11',
                'message' => "Border contrast ratio {$borderContrast}:1 below required 3:1",
                'severity' => 'medium',
                'elements' => ['borders', 'dividers'],
                'fix_suggestion' => 'Increase border contrast or use alternative visual cues',
            ];
        }

        return $violations;
    }

    /**
     * Provide actionable fix suggestions for contrast issues
     */
    private function getContrastFixSuggestion(
        BrandingColor $foreground,
        BrandingColor $background,
        float $minRatio
    ): string {
        $currentRatio = $this->calculateContrastRatio($foreground, $background);
        $difference = $minRatio - $currentRatio;

        if ($difference <= 0.5) {
            return 'Slightly darken text color or lighten background';
        } elseif ($difference <= 1.5) {
            return 'Choose a significantly darker/lighter color variant';
        } else {
            return 'Consider completely different color combination';
        }
    }
}
```

### **2. BRANDING ENTITY WITH WCAG ENFORCEMENT**

```php
// Platform/Domain/Entities/TenantBranding.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Domain\Entities;

use App\Contexts\Platform\Domain\ValueObjects\TenantDbId;
use App\Contexts\Platform\Domain\ValueObjects\BrandingColor;
use App\Contexts\Platform\Domain\ValueObjects\BrandingFontFamily;
use App\Contexts\Platform\Domain\ValueObjects\BrandingContent;
use App\Contexts\Platform\Domain\ValueObjects\BrandingLogo;
use App\Contexts\Platform\Domain\ValueObjects\WcagComplianceReport;
use App\Contexts\Platform\Domain\Services\BrandingAccessibilityService;
use App\Contexts\Platform\Domain\Exceptions\WcagComplianceException;
use DateTimeImmutable;

final class TenantBranding
{
    private TenantDbId $tenantDbId;
    private BrandingColor $primaryColor;
    private BrandingColor $secondaryColor;
    private BrandingColor $backgroundColor;
    private BrandingColor $textColor;
    private BrandingFontFamily $fontFamily;
    private float $baseFontSize;
    private ?BrandingLogo $logo;
    private BrandingContent $welcomeMessage;
    private BrandingContent $heroTitle;
    private BrandingContent $heroSubtitle;
    private BrandingContent $ctaText;
    private string $tier;
    private string $version;
    private DateTimeImmutable $updatedAt;
    private WcagComplianceReport $complianceReport;
    private bool $complianceOverride;

    private function __construct(
        TenantDbId $tenantDbId,
        BrandingColor $primaryColor,
        BrandingColor $secondaryColor,
        BrandingColor $backgroundColor,
        BrandingColor $textColor,
        BrandingFontFamily $fontFamily,
        float $baseFontSize,
        ?BrandingLogo $logo,
        BrandingContent $welcomeMessage,
        BrandingContent $heroTitle,
        BrandingContent $heroSubtitle,
        BrandingContent $ctaText,
        string $tier,
        string $version,
        DateTimeImmutable $updatedAt
    ) {
        $this->tenantDbId = $tenantDbId;
        $this->primaryColor = $primaryColor;
        $this->secondaryColor = $secondaryColor;
        $this->backgroundColor = $backgroundColor;
        $this->textColor = $textColor;
        $this->fontFamily = $fontFamily;
        $this->baseFontSize = $baseFontSize;
        $this->logo = $logo;
        $this->welcomeMessage = $welcomeMessage;
        $this->heroTitle = $heroTitle;
        $this->heroSubtitle = $heroSubtitle;
        $this->ctaText = $ctaText;
        $this->tier = $tier;
        $this->version = $version;
        $this->updatedAt = $updatedAt;
        $this->complianceOverride = false;

        // Validate WCAG compliance on creation
        $this->validateCompliance();
    }

    /**
     * Factory method with WCAG validation
     */
    public static function create(
        TenantDbId $tenantDbId,
        BrandingColor $primaryColor,
        BrandingColor $secondaryColor,
        BrandingColor $backgroundColor,
        BrandingColor $textColor,
        BrandingFontFamily $fontFamily,
        float $baseFontSize,
        ?BrandingLogo $logo,
        BrandingContent $welcomeMessage,
        BrandingContent $heroTitle,
        BrandingContent $heroSubtitle,
        BrandingContent $ctaText,
        BrandingAccessibilityService $accessibilityService
    ): self {
        $instance = new self(
            $tenantDbId,
            $primaryColor,
            $secondaryColor,
            $backgroundColor,
            $textColor,
            $fontFamily,
            $baseFontSize,
            $logo,
            $welcomeMessage,
            $heroTitle,
            $heroSubtitle,
            $ctaText,
            'free', // Default tier
            '1.0.0', // Semantic versioning
            new DateTimeImmutable()
        );

        // Run WCAG compliance check
        $instance->complianceReport = $accessibilityService->validateCompliance(
            $primaryColor,
            $secondaryColor,
            $backgroundColor,
            $textColor,
            $fontFamily,
            $baseFontSize
        );

        // Throw exception for critical violations unless overridden
        if ($instance->complianceReport->hasCriticalViolations() && !$instance->complianceOverride) {
            throw WcagComplianceException::fromReport($instance->complianceReport);
        }

        return $instance;
    }

    /**
     * Update primary color with WCAG validation
     */
    public function updatePrimaryColor(
        BrandingColor $newColor,
        BrandingAccessibilityService $accessibilityService
    ): void {
        $oldColor = $this->primaryColor;
        $this->primaryColor = $newColor;

        // Revalidate compliance with new color
        $this->revalidateCompliance($accessibilityService, 'primary_color', $oldColor, $newColor);
    }

    /**
     * Update secondary color with WCAG validation
     */
    public function updateSecondaryColor(
        BrandingColor $newColor,
        BrandingAccessibilityService $accessibilityService
    ): void {
        $oldColor = $this->secondaryColor;
        $this->secondaryColor = $newColor;

        $this->revalidateCompliance($accessibilityService, 'secondary_color', $oldColor, $newColor);
    }

    /**
     * Update background color with WCAG validation
     */
    public function updateBackgroundColor(
        BrandingColor $newColor,
        BrandingAccessibilityService $accessibilityService
    ): void {
        $oldColor = $this->backgroundColor;
        $this->backgroundColor = $newColor;

        $this->revalidateCompliance($accessibilityService, 'background_color', $oldColor, $newColor);
    }

    /**
     * Update text color with WCAG validation
     */
    public function updateTextColor(
        BrandingColor $newColor,
        BrandingAccessibilityService $accessibilityService
    ): void {
        $oldColor = $this->textColor;
        $this->textColor = $newColor;

        $this->revalidateCompliance($accessibilityService, 'text_color', $oldColor, $newColor);
    }

    /**
     * Administrative override for compliance violations
     * Requires audit logging and justification
     */
    public function overrideCompliance(
        string $justification,
        UserId $overriddenBy
    ): void {
        if (!$this->complianceReport->hasViolations()) {
            throw new \LogicException('Cannot override when no violations exist');
        }

        $this->complianceOverride = true;

        // Log the override for audit purposes
        $this->recordComplianceOverride($justification, $overriddenBy);
    }

    /**
     * Generate CSS variables with accessibility considerations
     */
    public function generateCssVariables(): array
    {
        $variables = [
            '--color-primary' => $this->primaryColor->toHex(),
            '--color-secondary' => $this->secondaryColor->toHex(),
            '--color-background' => $this->backgroundColor->toHex(),
            '--color-text' => $this->textColor->toHex(),
            '--font-family' => $this->fontFamily->toString(),
            '--font-size-base' => "{$this->baseFontSize}px",

            // Accessibility-focused variables
            '--focus-outline-color' => $this->calculateFocusColor(),
            '--focus-outline-width' => '3px',
            '--focus-outline-style' => 'solid',
            '--link-underline' => $this->shouldUnderlineLinks() ? 'underline' : 'none',
            '--button-min-height' => '44px', // WCAG touch target size
            '--button-min-width' => '44px',
        ];

        // Add high contrast mode variables if applicable
        if ($this->complianceReport->hasLowContrastIssues()) {
            $variables['--hc-primary'] = $this->getHighContrastVariant($this->primaryColor);
            $variables['--hc-secondary'] = $this->getHighContrastVariant($this->secondaryColor);
        }

        return $variables;
    }

    /**
     * Calculate focus color that meets WCAG 2.4.7 requirements
     */
    private function calculateFocusColor(): string
    {
        // Focus indicator must have 3:1 contrast with adjacent colors
        $candidates = [
            $this->primaryColor->darken(0.3),
            $this->secondaryColor->darken(0.3),
            BrandingColor::fromHex('#005A9C'), // Standard focus blue
        ];

        foreach ($candidates as $candidate) {
            $contrastWithPrimary = $this->calculateContrastRatio($candidate, $this->primaryColor);
            $contrastWithBackground = $this->calculateContrastRatio($candidate, $this->backgroundColor);

            if ($contrastWithPrimary >= 3.0 && $contrastWithBackground >= 3.0) {
                return $candidate->toHex();
            }
        }

        // Fallback to high contrast color
        return '#000000';
    }

    /**
     * Revalidate compliance after color change
     */
    private function revalidateCompliance(
        BrandingAccessibilityService $service,
        string $changedField,
        BrandingColor $oldValue,
        BrandingColor $newValue
    ): void {
        $newReport = $service->validateCompliance(
            $this->primaryColor,
            $this->secondaryColor,
            $this->backgroundColor,
            $this->textColor,
            $this->fontFamily,
            $this->baseFontSize
        );

        // Check if compliance got worse
        if ($newReport->getScore() < $this->complianceReport->getScore()) {
            // Log compliance degradation
            $this->logComplianceChange($changedField, $oldValue, $newValue, $newReport);
        }

        $this->complianceReport = $newReport;

        // Throw if new critical violations (unless overridden)
        if ($newReport->hasCriticalViolations() && !$this->complianceOverride) {
            // Revert the change
            $this->{$changedField} = $oldValue;
            throw WcagComplianceException::fromReport($newReport);
        }
    }

    // ... additional methods for getters, equals, etc.
}
```

### **3. THREE-TIER API ARCHITECTURE**

```php
// Platform/Infrastructure/Http/Controllers/
├── TenantBrandingAdminController.php     # Full admin API (Vue Desktop)
├── TenantBrandingMobileController.php    # Mobile-optimized API (Angular)
└── TenantBrandingPublicController.php    # Public read-only API
```

**Admin Controller (Full functionality)**:
```php
// Platform/Infrastructure/Http/Controllers/TenantBrandingAdminController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

use App\Contexts\Platform\Application\Commands\UpdateTenantBrandingCommand;
use App\Contexts\Platform\Application\Queries\GetTenantBrandingQuery;
use App\Contexts\Platform\Infrastructure\Http\Requests\BrandingUpdateRequest;
use App\Contexts\Platform\Infrastructure\Http\Requests\BrandingComplianceOverrideRequest;

class TenantBrandingAdminController extends Controller
{
    /**
     * GET /api/platform/branding/{tenantSlug}/admin
     * Full branding configuration for admin UI
     */
    public function show(string $tenantSlug): JsonResponse
    {
        $query = new GetTenantBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            includeComplianceReport: true,
            includeAuditHistory: true,
            includeVersionHistory: true
        );

        $result = $this->queryBus->handle($query);

        return response()->json([
            'branding' => $result->branding,
            'compliance' => $result->complianceReport,
            'versions' => $result->versionHistory,
            'audit_log' => $result->auditHistory,
            'available_tiers' => $result->availableTiers,
            'limitations' => $result->tierLimitations,
        ]);
    }

    /**
     * PUT /api/platform/branding/{tenantSlug}/admin
     * Full update with WCAG validation
     */
    public function update(BrandingUpdateRequest $request, string $tenantSlug): JsonResponse
    {
        $command = $request->toCommand();

        try {
            $result = $this->commandBus->handle($command);

            return response()->json([
                'success' => true,
                'branding' => $result->branding,
                'compliance_check' => $result->complianceReport,
                'warnings' => $result->warnings,
                'version' => $result->newVersion,
            ]);
        } catch (WcagComplianceException $e) {
            return response()->json([
                'success' => false,
                'error' => 'WCAG compliance violation',
                'violations' => $e->getViolations(),
                'fix_suggestions' => $e->getFixSuggestions(),
            ], 422);
        }
    }

    /**
     * POST /api/platform/branding/{tenantSlug}/admin/compliance-override
     * Administrative override for compliance violations
     */
    public function overrideCompliance(
        BrandingComplianceOverrideRequest $request,
        string $tenantSlug
    ): JsonResponse {
        // Requires special permissions
        $this->authorize('override-branding-compliance');

        $command = new OverrideComplianceCommand(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            justification: $request->validated('justification'),
            overriddenBy: UserId::fromString($request->user()->id)
        );

        $result = $this->commandBus->handle($command);

        return response()->json([
            'success' => true,
            'override_id' => $result->overrideId,
            'valid_until' => $result->validUntil,
            'audit_log_id' => $result->auditLogId,
        ]);
    }
}
```

**Mobile Controller (Optimized payload)**:
```php
// Platform/Infrastructure/Http/Controllers/TenantBrandingMobileController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

class TenantBrandingMobileController extends Controller
{
    /**
     * GET /api/platform/branding/{tenantSlug}/mobile
     * Mobile-optimized payload (smaller, touch-focused)
     */
    public function show(string $tenantSlug): JsonResponse
    {
        $query = new GetMobileBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug),
            platform: 'ios', // or 'android'
            devicePixelRatio: $this->getDevicePixelRatio(),
            connectionType: $this->getConnectionType()
        );

        $result = $this->queryBus->handle($query);

        // Mobile-optimized response
        return response()->json([
            'colors' => [
                'primary' => $result->primaryColor,
                'secondary' => $result->secondaryColor,
                'background' => $result->backgroundColor,
            ],
            'typography' => [
                'font_family' => $result->fontFamily,
                'font_size' => $result->fontSize,
                'line_height' => $result->lineHeight,
            ],
            'assets' => [
                'logo_url' => $result->optimizedLogoUrl,
                'logo_size' => $result->logoSize, // Pre-calculated for mobile
            ],
            'touch_targets' => [
                'button_height' => '44dp',
                'button_min_width' => '44dp',
            ],
            'cache_key' => $result->cacheKey,
            'cache_ttl' => 3600, // 1 hour for mobile
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/mobile/css
     * Mobile-optimized CSS with touch considerations
     */
    public function css(string $tenantSlug): Response
    {
        $query = new GetMobileCssQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug)
        );

        $css = $this->queryBus->handle($query);

        return response($css, 200, [
            'Content-Type' => 'text/css',
            'Cache-Control' => 'public, max-age=86400',
            'Content-Length' => strlen($css),
        ]);
    }
}
```

**Public Controller (Read-only, highly cached)**:
```php
// Platform/Infrastructure/Http/Controllers/TenantBrandingPublicController.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Http\Controllers;

class TenantBrandingPublicController extends Controller
{
    /**
     * GET /api/platform/branding/{tenantSlug}/public
     * Public API for login pages (no authentication required)
     */
    public function show(string $tenantSlug): JsonResponse
    {
        $query = new GetPublicBrandingQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug)
        );

        $result = $this->queryBus->handle($query);

        // Public response (limited information)
        return response()->json([
            'organization_name' => $result->organizationName,
            'primary_color' => $result->primaryColor,
            'logo_url' => $result->logoUrl,
            'welcome_message' => $result->welcomeMessage,
            'accessibility_statement' => $result->accessibilityStatement,
            'last_updated' => $result->updatedAt,
        ]);
    }

    /**
     * GET /api/platform/branding/{tenantSlug}/public/css
     * Public CSS with aggressive caching
     */
    public function css(string $tenantSlug): Response
    {
        $query = new GetPublicCssQuery(
            tenantSlug: TenantSlug::fromString($tenantSlug)
        );

        $css = $this->queryBus->handle($query);

        return response($css, 200, [
            'Content-Type' => 'text/css',
            'Cache-Control' => 'public, max-age=604800', // 7 days
            'CDN-Cache-Control' => 'public, max-age=31536000', // 1 year
            'Vary' => 'Accept-Encoding',
        ]);
    }
}
```

### **4. GEOGRAPHIC BRANDING VARIANTS**

**Requirement**: Different countries have different election branding requirements.

```php
// Platform/Domain/Entities/GeographicBrandingVariant.php
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Domain\Entities;

use App\Contexts\Platform\Domain\ValueObjects\CountryCode;
use App\Contexts\Platform\Domain\ValueObjects\LegalRequirement;

final class GeographicBrandingVariant
{
    private CountryCode $country;
    private TenantBranding $baseBranding;
    private array $legalOverrides;
    private array $culturalAdaptations;

    public function __construct(
        CountryCode $country,
        TenantBranding $baseBranding,
        array $legalRequirements = []
    ) {
        $this->country = $country;
        $this->baseBranding = $baseBranding;
        $this->legalOverrides = $this->extractLegalOverrides($legalRequirements);
        $this->culturalAdaptations = $this->calculateCulturalAdaptations($country);
    }

    /**
     * Get branding adapted for specific country
     */
    public function getAdaptedBranding(): TenantBranding
    {
        $adapted = clone $this->baseBranding;

        // Apply legal overrides (mandatory)
        foreach ($this->legalOverrides as $override) {
            $adapted = $override->applyTo($adapted);
        }

        // Apply cultural adaptations (optional optimizations)
        foreach ($this->culturalAdaptations as $adaptation) {
            $adapted = $adaptation->applyTo($adapted);
        }

        return $adapted;
    }

    /**
     * Extract legal requirements for specific country
     */
    private function extractLegalOverrides(array $requirements): array
    {
        $overrides = [];

        // Example: Germany requires specific contrast ratios for election materials
        if ($this->country->equals(CountryCode::fromString('DE'))) {
            $overrides[] = new LegalRequirement(
                code: 'DE_ELECTION_2024',
                description: 'German election material contrast requirements',
                apply: function (TenantBranding $branding) {
                    // German election law requires 7:1 contrast for important text
                    return $branding->withMinimumContrast(7.0);
                }
            );
        }

        // Example: USA requires specific disclaimer text
        if ($this->country->equals(CountryCode::fromString('US'))) {
            $overrides[] = new LegalRequirement(
                code: 'US_FEC_REG',
                description: 'Federal Election Commission disclaimer',
                apply: function (TenantBranding $branding) {
                    return $branding->withLegalDisclaimer(
                        'Paid for by the committee. Not authorized by any candidate.'
                    );
                }
            );
        }

        // Example: Nepal requires native language support
        if ($this->country->equals(CountryCode::fromString('NP'))) {
            $overrides[] = new LegalRequirement(
                code: 'NP_ELECTION_LAW',
                description: 'Nepali language requirement for election materials',
                apply: function (TenantBranding $branding) {
                    return $branding->withLanguageSupport(['ne', 'en']);
                }
            );
        }

        return $overrides;
    }

    /**
     * Calculate cultural adaptations for better UX
     */
    private function calculateCulturalAdaptations(CountryCode $country): array
    {
        $adaptations = [];

        // Color symbolism varies by culture
        $colorAdaptations = $this->getColorAdaptations($country);
        $adaptations = array_merge($adaptations, $colorAdaptations);

        // Typography preferences by region
        $fontAdaptations = $this->getFontAdaptations($country);
        $adaptations = array_merge($adaptations, $fontAdaptations);

        // Layout preferences (RTL/LTR)
        $layoutAdaptations = $this->getLayoutAdaptations($country);
        $adaptations = array_merge($adaptations, $layoutAdaptations);

        return $adaptations;
    }
}
```

## **📋 WCAG COMPLIANCE IMPLEMENTATION CHECKLIST**

### **Phase 1: Domain Foundation**
- [ ] **BrandingAccessibilityService** with WCAG 2.1 AA validation
- [ ] **TenantBranding entity** with compliance enforcement
- [ ] **Color contrast calculation** using WCAG formula
- [ ] **Font accessibility validation** for text spacing

### **Phase 2: API Integration**
- [ ] **Three-tier API architecture** (Admin/Mobile/Public)
- [ ] **Compliance reports** in admin responses
- [ ] **Mobile-optimized payloads** with touch targets
- [ ] **Public APIs** with accessibility statements

### **Phase 3: Geographic Support**
- [ ] **Country-specific legal requirements** extraction
- [ ] **Cultural adaptation service** for regional preferences
- [ ] **Multi-language support** for election materials
- [ ] **RTL/LTR layout adaptation**

### **Phase 4: Compliance Monitoring**
- [ ] **Automated WCAG testing** in CI/CD pipeline
- [ ] **Compliance dashboard** with violation tracking
- [ ] **Audit logging** for all compliance decisions
- [ ] **Legal requirement updates** subscription service

## **🎯 CRITICAL SUCCESS FACTORS**

### **1. Legal Compliance**
- WCAG 2.1 AA as domain invariant, not optional
- Country-specific election law integration
- Accessibility statement generation
- Compliance audit trail maintenance

### **2. User Experience**
- Mobile-first CSS generation
- Touch target size enforcement
- High contrast mode support
- Reduced motion preferences

### **3. Performance**
- Geographic variant caching
- Mobile payload optimization
- CDN integration for assets
- Cache hierarchy management

### **4. Maintainability**
- Clear separation between legal requirements and preferences
- Extensible country rule system
- Semantic versioning for branding changes
- Comprehensive test coverage for accessibility

> **Architect's Note**: WCAG compliance is not a feature—it's a requirement for election platforms. This architecture enforces accessibility at the domain level, ensuring violations cannot reach production. The three-tier API structure optimizes delivery for different clients while maintaining compliance across all interfaces.