# **TENANT-SPECIFIC DIGITAL CARD DESIGN SYSTEM**

## **🏗️ ARCHITECTURAL APPROACH: TEMPLATE-ENGINE DESIGN**

```php
<?php
// app/Contexts/DigitalCard/Domain/ValueObjects/CardDesignTemplate.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

use App\Contexts\TenantBranding\Domain\ValueObjects\BrandIdentity;
use Illuminate\Contracts\Support\Arrayable;

/**
 * Tenant-Specific Card Design Template
 * 
 * Design Principles:
 * 1. Template inheritance (global → tenant → member-type)
 * 2. CSS-in-JS for dynamic styling
 * 3. SVG-based for high-quality rendering
 * 4. Accessibility-first design
 */
final class CardDesignTemplate implements Arrayable
{
    private function __construct(
        private TemplateId $templateId,
        private TenantId $tenantId,
        private string $name,
        private TemplateType $type,
        private BrandIdentity $brandIdentity,
        private CardLayout $layout,
        private array $styles,
        private array $sections,
        private array $dynamicFields,
        private bool $isActive = true,
        private ?\DateTimeImmutable $validFrom = null,
        private ?\DateTimeImmutable $validTo = null
    ) {
        $this->assertDesignConstraints();
    }
    
    public static function createForTenant(
        TenantId $tenantId,
        BrandIdentity $brandIdentity,
        CardLayout $layout
    ): self {
        return new self(
            templateId: TemplateId::generate(),
            tenantId: $tenantId,
            name: 'Default Design',
            type: TemplateType::STANDARD,
            brandIdentity: $brandIdentity,
            layout: $layout,
            styles: self::getDefaultStyles($brandIdentity),
            sections: self::getDefaultSections(),
            dynamicFields: self::getDefaultDynamicFields()
        );
    }
    
    /**
     * Apply template to card data to generate visual representation
     */
    public function applyToCard(CardData $cardData, ?MemberPhoto $photo = null): RenderedCard
    {
        // 1. Validate photo dimensions and format
        if ($photo) {
            $this->validatePhoto($photo);
        }
        
        // 2. Merge card data with template
        $mergedData = array_merge(
            $cardData->toArray(),
            [
                'design' => $this->toArray(),
                'photo' => $photo ? $this->processPhoto($photo) : null,
                'generated_at' => now()->toISOString()
            ]
        );
        
        // 3. Apply responsive design rules
        $responsiveStyles = $this->applyResponsiveRules($this->styles);
        
        // 4. Generate SVG/HTML output
        $renderedOutput = $this->renderTemplate($mergedData, $responsiveStyles);
        
        // 5. Generate QR code with design integration
        $qrCode = $this->generateStyledQRCode($cardData->qrCode());
        
        return new RenderedCard(
            templateId: $this->templateId,
            cardId: $cardData->id(),
            format: RenderFormat::SVG,
            content: $renderedOutput,
            qrCode: $qrCode,
            styles: $responsiveStyles,
            accessibilityData: $this->generateAccessibilityData($cardData, $photo)
        );
    }
    
    /**
     * Generate multiple formats (SVG, PNG, PDF)
     */
    public function generateMultiFormat(
        CardData $cardData,
        array $formats = [RenderFormat::SVG, RenderFormat::PNG]
    ): array {
        $outputs = [];
        
        foreach ($formats as $format) {
            $outputs[$format->value] = match($format) {
                RenderFormat::SVG => $this->generateSVG($cardData),
                RenderFormat::PNG => $this->generatePNG($cardData),
                RenderFormat::PDF => $this->generatePDF($cardData),
                RenderFormat::HTML => $this->generateHTML($cardData),
                default => throw new \InvalidArgumentException("Unsupported format: {$format->value}")
            };
        }
        
        return $outputs;
    }
    
    /**
     * Validate design constraints
     */
    private function assertDesignConstraints(): void
    {
        // 1. Color contrast for accessibility (WCAG AA)
        $this->validateColorContrast();
        
        // 2. Font size minimums
        $this->validateTypography();
        
        // 3. Required sections
        $this->validateRequiredSections();
        
        // 4. Brand consistency
        $this->validateBrandConsistency();
    }
    
    private function validateColorContrast(): void
    {
        $contrastChecker = new ColorContrastChecker();
        
        foreach ($this->styles['color_pairs'] as $pair) {
            if (!$contrastChecker->check($pair['foreground'], $pair['background'])) {
                throw new DesignValidationException(
                    "Insufficient color contrast between {$pair['foreground']} and {$pair['background']}"
                );
            }
        }
    }
    
    private function validatePhoto(MemberPhoto $photo): void
    {
        // Check dimensions
        if ($photo->width() < 300 || $photo->height() < 300) {
            throw new PhotoValidationException(
                "Photo must be at least 300x300 pixels"
            );
        }
        
        // Check file size
        if ($photo->size() > 5 * 1024 * 1024) { // 5MB
            throw new PhotoValidationException(
                "Photo must be less than 5MB"
            );
        }
        
        // Check format
        $allowedFormats = ['image/jpeg', 'image/png', 'image/webp'];
        if (!in_array($photo->mimeType(), $allowedFormats)) {
            throw new PhotoValidationException(
                "Photo must be JPEG, PNG, or WebP format"
            );
        }
    }
    
    private function processPhoto(MemberPhoto $photo): ProcessedPhoto
    {
        // 1. Crop to template-defined aspect ratio
        $cropped = $photo->cropToRatio($this->layout->photoAspectRatio());
        
        // 2. Resize to template dimensions
        $resized = $cropped->resize(
            $this->layout->photoWidth(),
            $this->layout->photoHeight()
        );
        
        // 3. Apply tenant-specific filters (e.g., grayscale for professional)
        if ($this->brandIdentity->photoTreatment()) {
            $processed = $resized->applyFilter($this->brandIdentity->photoTreatment());
        }
        
        // 4. Add border/styling from template
        $styled = $processed->applyStyle($this->styles['photo_style']);
        
        // 5. Optimize for web
        return $styled->optimize(quality: 85, stripMetadata: true);
    }
    
    private function generateStyledQRCode(QRCode $qrCode): StyledQRCode
    {
        return new StyledQRCode(
            data: $qrCode->toString(),
            size: $this->layout->qrCodeSize(),
            margin: $this->styles['qr_code_margin'],
            foregroundColor: $this->styles['qr_code_foreground'],
            backgroundColor: $this->brandIdentity->primaryColor(),
            logo: $this->brandIdentity->logo()->resize(30, 30),
            logoBackground: $this->styles['qr_code_logo_background']
        );
    }
    
    private function generateAccessibilityData(
        CardData $cardData,
        ?MemberPhoto $photo
    ): AccessibilityData {
        return new AccessibilityData(
            altText: $this->generateAltText($cardData, $photo),
            ariaLabel: "Digital membership card for " . $cardData->memberName(),
            contrastRatio: $this->calculateContrastRatio(),
            screenReaderSections: $this->extractScreenReaderContent($cardData),
            tabIndexOrder: $this->determineTabOrder()
        );
    }
    
    public function toArray(): array
    {
        return [
            'template_id' => $this->templateId->toString(),
            'tenant_id' => $this->tenantId->toString(),
            'name' => $this->name,
            'type' => $this->type->value,
            'brand' => $this->brandIdentity->toArray(),
            'layout' => $this->layout->toArray(),
            'styles' => $this->styles,
            'sections' => $this->sections,
            'dynamic_fields' => $this->dynamicFields,
            'is_active' => $this->isActive,
            'valid_from' => $this->validFrom?->format(\DateTimeInterface::ATOM),
            'valid_to' => $this->validTo?->format(\DateTimeInterface::ATOM)
        ];
    }
}
```

---

## **🎨 TEMPLATE ENGINE & DESIGN SYSTEM**

```php
<?php
// app/Contexts/DigitalCard/Infrastructure/Services/TemplateEngine.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Services;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardDesignTemplate;
use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;
use Illuminate\Support\Facades\Cache;
use Intervention\Image\ImageManager;

/**
 * Advanced Template Engine with Caching
 * 
 * Features:
 * 1. Server-side rendering for consistency
 * 2. Client-side hydration for interactivity
 * 3. Cache layers (Redis, CDN, browser)
 * 4. Fallback designs for missing templates
 */
final class TemplateEngine
{
    private const CACHE_TTL = 3600; // 1 hour
    private const CDN_PREFIX = 'https://cdn.yourplatform.com/cards/';
    
    private ImageManager $imageManager;
    private array $globalTemplates;
    
    public function __construct()
    {
        $this->imageManager = new ImageManager(['driver' => 'imagick']);
        $this->globalTemplates = config('digitalcard.templates.global');
    }
    
    /**
     * Render card with tenant-specific design
     */
    public function renderCard(
        DigitalCard $card,
        ?CardDesignTemplate $template = null
    ): RenderedCard {
        // 1. Get or create template
        $template = $template ?? $this->getTemplateForCard($card);
        
        // 2. Check cache first
        $cacheKey = $this->generateCacheKey($card, $template);
        
        if ($cached = Cache::get($cacheKey)) {
            return RenderedCard::fromCache($cached);
        }
        
        // 3. Get member photo (if enabled)
        $photo = $this->getMemberPhoto($card->memberId());
        
        // 4. Apply template
        $renderedCard = $template->applyToCard(
            $this->extractCardData($card),
            $photo
        );
        
        // 5. Cache result
        Cache::put($cacheKey, $renderedCard->toCache(), self::CACHE_TTL);
        
        // 6. Generate CDN version if needed
        if ($this->shouldUploadToCDN($template)) {
            $this->uploadToCDN($renderedCard);
        }
        
        return $renderedCard;
    }
    
    /**
     * Generate responsive card previews (multiple sizes)
     */
    public function generatePreviews(
        CardDesignTemplate $template,
        array $breakpoints = ['mobile', 'tablet', 'desktop']
    ): array {
        $previews = [];
        
        foreach ($breakpoints as $breakpoint) {
            $config = $this->getBreakpointConfig($breakpoint);
            
            $previews[$breakpoint] = [
                'svg' => $this->renderTemplateForBreakpoint($template, $config),
                'png' => $this->convertToPNG($template, $config),
                'dimensions' => $config['dimensions'],
                'dpi' => $config['dpi']
            ];
        }
        
        return $previews;
    }
    
    /**
     * Apply design template to QR code
     */
    public function styleQRCode(
        string $qrData,
        CardDesignTemplate $template
    ): StyledQRCode {
        $qrCode = new QRCode($qrData);
        
        return $template->generateStyledQRCode($qrCode);
    }
    
    /**
     * Batch render cards for export/print
     */
    public function batchRender(
        array $cards,
        CardDesignTemplate $template,
        string $outputFormat = 'pdf'
    ): BatchRenderResult {
        $results = [];
        $startTime = microtime(true);
        
        foreach (array_chunk($cards, 50) as $chunk) {
            foreach ($chunk as $card) {
                $results[] = $this->renderCard($card, $template);
            }
            
            // Prevent memory exhaustion
            if (memory_get_usage(true) > 100 * 1024 * 1024) { // 100MB
                gc_collect_cycles();
            }
        }
        
        // Combine based on output format
        $combinedOutput = match($outputFormat) {
            'pdf' => $this->combinePDFs($results),
            'zip' => $this->createZipArchive($results),
            'print_sheet' => $this->generatePrintSheet($results),
            default => throw new \InvalidArgumentException("Unsupported output format: {$outputFormat}")
        };
        
        return new BatchRenderResult(
            totalCards: count($results),
            outputFormat: $outputFormat,
            output: $combinedOutput,
            processingTime: microtime(true) - $startTime,
            averageTimePerCard: (microtime(true) - $startTime) / count($results)
        );
    }
    
    /**
     * Validate design template
     */
    public function validateTemplate(CardDesignTemplate $template): ValidationResult
    {
        $errors = [];
        
        // 1. Check required fields
        $requiredFields = ['primary_color', 'font_family', 'logo_url'];
        foreach ($requiredFields as $field) {
            if (empty($template->styles[$field])) {
                $errors[] = "Missing required field: {$field}";
            }
        }
        
        // 2. Check color accessibility
        if (!$this->checkColorAccessibility($template)) {
            $errors[] = 'Color contrast does not meet WCAG AA standards';
        }
        
        // 3. Check image dimensions
        if (!$this->checkImageDimensions($template)) {
            $errors[] = 'Logo dimensions must be at least 200x200 pixels';
        }
        
        // 4. Check font licenses
        if (!$this->checkFontLicense($template->styles['font_family'])) {
            $errors[] = 'Font not licensed for commercial use';
        }
        
        return new ValidationResult(
            isValid: empty($errors),
            errors: $errors,
            warnings: $this->generateWarnings($template)
        );
    }
    
    private function getTemplateForCard(DigitalCard $card): CardDesignTemplate
    {
        // Hierarchy: Member-specific → Member-type → Tenant → Global
        
        // 1. Check member-specific template
        if ($memberTemplate = $this->getMemberTemplate($card->memberId())) {
            return $memberTemplate;
        }
        
        // 2. Check member-type template
        $memberType = $this->getMemberType($card->memberId());
        if ($typeTemplate = $this->getTypeTemplate($memberType)) {
            return $typeTemplate;
        }
        
        // 3. Get tenant default template
        $tenantId = app('currentTenant')->id;
        if ($tenantTemplate = $this->getTenantTemplate($tenantId)) {
            return $tenantTemplate;
        }
        
        // 4. Fallback to global template
        return $this->getGlobalTemplate();
    }
    
    private function getMemberPhoto(MemberId $memberId): ?MemberPhoto
    {
        // Get from MembershipContext via ACL
        try {
            $photoClient = app(MembershipPhotoClient::class);
            return $photoClient->getMemberPhoto($memberId);
        } catch (\Exception $e) {
            // Return default avatar based on member type
            return $this->generateDefaultAvatar($memberId);
        }
    }
    
    private function generateDefaultAvatar(MemberId $memberId): MemberPhoto
    {
        $memberType = $this->getMemberType($memberId);
        $initials = $this->getMemberInitials($memberId);
        
        // Generate SVG avatar with initials
        $svg = $this->generateAvatarSVG($initials, $memberType);
        
        return new MemberPhoto(
            content: $svg,
            mimeType: 'image/svg+xml',
            width: 300,
            height: 300,
            isDefault: true
        );
    }
    
    private function shouldUploadToCDN(CardDesignTemplate $template): bool
    {
        // Upload if template is marked as public or has high usage
        return $template->isPublic() || 
               $this->getTemplateUsage($template->id()) > 100;
    }
    
    private function uploadToCDN(RenderedCard $card): void
    {
        $cdnPath = $this->generateCDNPath($card);
        
        // Upload to S3/CloudFront
        Storage::disk('cdn')->put(
            $cdnPath,
            $card->content(),
            [
                'ContentType' => $card->format()->mimeType(),
                'CacheControl' => 'public, max-age=31536000', // 1 year
                'ACL' => 'public-read'
            ]
        );
        
        // Invalidate CDN cache if needed
        if ($card->shouldInvalidateCache()) {
            $this->invalidateCDNCache([$cdnPath]);
        }
    }
}
```

---

## **📱 FRONTEND TEMPLATE COMPONENTS (ANGULAR)**

```typescript
// src/app/features/digital-card/components/card-renderer/card-renderer.component.ts

import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DigitalCardService, DigitalCard } from '../../../core/services/digital-card.service';
import { TemplateService, CardTemplate, RenderOptions } from '../../../core/services/template.service';
import { DeviceService } from '../../../core/services/device.service';
import { Subscription, Observable, from } from 'rxjs';

@Component({
  selector: 'app-card-renderer',
  templateUrl: './card-renderer.component.html',
  styleUrls: ['./card-renderer.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class CardRendererComponent implements OnInit, OnDestroy {
  @Input() cardId?: string;
  @Input() templateId?: string;
  @Input() showActions = true;
  @Input() interactive = false;
  @Input() size: 'small' | 'medium' | 'large' | 'full' = 'medium';
  
  @ViewChild('cardCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cardContainer', { static: false }) containerRef!: ElementRef<HTMLElement>;
  
  card: DigitalCard | null = null;
  template: CardTemplate | null = null;
  renderedCard: string | null = null;
  isLoading = true;
  error: string | null = null;
  
  // Responsive breakpoints
  breakpoints = {
    mobile: { width: 375, height: 600 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1200, height: 800 }
  };
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private cardService: DigitalCardService,
    private templateService: TemplateService,
    private deviceService: DeviceService
  ) {}
  
  ngOnInit(): void {
    this.loadCard();
    this.setupResponsiveBehavior();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadCard(): void {
    if (this.cardId) {
      this.loadSpecificCard(this.cardId);
    } else {
      this.loadCurrentMemberCard();
    }
  }
  
  private loadSpecificCard(cardId: string): void {
    this.isLoading = true;
    
    this.cardService.getCard(cardId).subscribe({
      next: (card) => {
        this.card = card;
        this.loadTemplate();
      },
      error: (err) => {
        this.error = 'Failed to load card';
        this.isLoading = false;
        console.error('Card load error:', err);
      }
    });
  }
  
  private loadCurrentMemberCard(): void {
    this.cardService.getMyCard().subscribe({
      next: (card) => {
        this.card = card;
        this.loadTemplate();
      },
      error: (err) => {
        this.error = 'Failed to load your card';
        this.isLoading = false;
      }
    });
  }
  
  private loadTemplate(): void {
    if (!this.card) return;
    
    const templateId = this.templateId || this.card.template_id;
    
    if (templateId) {
      this.templateService.getTemplate(templateId).subscribe({
        next: (template) => {
          this.template = template;
          this.renderCard();
        },
        error: () => {
          // Fallback to default template
          this.loadDefaultTemplate();
        }
      });
    } else {
      this.loadDefaultTemplate();
    }
  }
  
  private loadDefaultTemplate(): void {
    this.templateService.getDefaultTemplate().subscribe({
      next: (template) => {
        this.template = template;
        this.renderCard();
      },
      error: (err) => {
        this.error = 'Failed to load template';
        this.isLoading = false;
        console.error('Template load error:', err);
      }
    });
  }
  
  private renderCard(): void {
    if (!this.card || !this.template) return;
    
    const options: RenderOptions = {
      format: 'svg',
      includePhoto: true,
      interactive: this.interactive,
      devicePixelRatio: window.devicePixelRatio || 1,
      locale: navigator.language
    };
    
    this.templateService.renderCard(this.card, this.template, options).subscribe({
      next: (rendered) => {
        this.renderedCard = rendered.svg;
        this.isLoading = false;
        
        // If canvas rendering is needed
        if (this.canvasRef && rendered.canvasData) {
          this.renderToCanvas(rendered.canvasData);
        }
        
        // Add interactivity if enabled
        if (this.interactive) {
          this.addInteractivity();
        }
      },
      error: (err) => {
        this.error = 'Failed to render card';
        this.isLoading = false;
        console.error('Render error:', err);
      }
    });
  }
  
  private renderToCanvas(canvasData: any): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Set canvas dimensions
    canvas.width = this.template!.dimensions.width;
    canvas.height = this.template!.dimensions.height;
    
    // Draw background
    this.drawBackground(ctx, canvas);
    
    // Draw card elements
    this.drawCardElements(ctx, canvasData);
    
    // Draw QR code if separate
    if (canvasData.qrCode) {
      this.drawQRCode(ctx, canvasData.qrCode);
    }
  }
  
  private drawBackground(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    // Draw gradient background from template
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    
    if (this.template?.background.gradient) {
      this.template.background.gradient.forEach((stop, index) => {
        gradient.addColorStop(index / (this.template!.background.gradient.length - 1), stop);
      });
    } else {
      gradient.addColorStop(0, this.template?.background.primary || '#ffffff');
      gradient.addColorStop(1, this.template?.background.secondary || '#f0f0f0');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add texture if specified
    if (this.template?.background.texture) {
      this.drawTexture(ctx, canvas, this.template.background.texture);
    }
  }
  
  private setupResponsiveBehavior(): void {
    // Watch for screen size changes
    this.subscriptions.push(
      this.deviceService.screenSize$.subscribe(size => {
        this.adjustForScreenSize(size);
      })
    );
    
    // Watch for theme changes (dark/light mode)
    this.subscriptions.push(
      this.deviceService.colorScheme$.subscribe(scheme => {
        this.adjustForColorScheme(scheme);
      })
    );
  }
  
  private adjustForScreenSize(size: { width: number; height: number }): void {
    const container = this.containerRef?.nativeElement;
    if (!container || !this.template) return;
    
    // Determine which breakpoint to use
    let breakpoint: keyof typeof this.breakpoints = 'desktop';
    
    if (size.width <= this.breakpoints.mobile.width) {
      breakpoint = 'mobile';
    } else if (size.width <= this.breakpoints.tablet.width) {
      breakpoint = 'tablet';
    }
    
    // Apply responsive styles
    container.style.width = `${this.breakpoints[breakpoint].width}px`;
    container.style.height = `${this.breakpoints[breakpoint].height}px`;
    
    // Re-render if needed with responsive adjustments
    if (this.template.responsive) {
      this.renderCard();
    }
  }
  
  private adjustForColorScheme(scheme: 'light' | 'dark'): void {
    // Adjust template colors for dark mode
    if (this.template?.darkMode) {
      this.renderCard();
    }
  }
  
  addInteractivity(): void {
    // Add hover effects
    this.containerRef.nativeElement.addEventListener('mouseenter', () => {
      this.containerRef.nativeElement.classList.add('card-hover');
    });
    
    this.containerRef.nativeElement.addEventListener('mouseleave', () => {
      this.containerRef.nativeElement.classList.remove('card-hover');
    });
    
    // Add click to flip (if enabled in template)
    if (this.template?.features.flip) {
      this.containerRef.nativeElement.addEventListener('click', () => {
        this.flipCard();
      });
    }
    
    // Add QR code scan trigger
    const qrElement = this.containerRef.nativeElement.querySelector('.qr-code');
    if (qrElement) {
      qrElement.addEventListener('click', () => {
        this.triggerQRScan();
      });
    }
  }
  
  flipCard(): void {
    this.containerRef.nativeElement.classList.toggle('flipped');
  }
  
  triggerQRScan(): void {
    // Emit event for parent component
    this.cardService.scanQRCode(this.card!.id).subscribe();
  }
  
  downloadCard(format: 'png' | 'pdf' | 'svg' = 'png'): void {
    if (!this.card) return;
    
    this.templateService.downloadCard(this.card, format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `card-${this.card!.id.slice(0, 8)}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Download failed:', err);
      }
    });
  }
  
  shareCard(): void {
    if (!this.card || !navigator.share) return;
    
    this.templateService.getShareableImage(this.card).subscribe({
      next: (image) => {
        navigator.share({
          title: 'My Digital Membership Card',
          text: `Check out my digital membership card for ${this.card!.member_name}`,
          files: [new File([image], `card-${this.card!.id}.png`, { type: 'image/png' })]
        });
      }
    });
  }
  
  printCard(): void {
    window.print();
  }
}
```

```html
<!-- card-renderer.component.html -->
<div #cardContainer class="card-container" [class.loading]="isLoading" [class.interactive]="interactive">
  
  <!-- Loading State -->
  <div *ngIf="isLoading" class="loading-state">
    <div class="loading-spinner"></div>
    <p>Loading your digital card...</p>
  </div>
  
  <!-- Error State -->
  <div *ngIf="error && !isLoading" class="error-state">
    <div class="error-icon">⚠️</div>
    <h3>Unable to Display Card</h3>
    <p>{{ error }}</p>
    <button (click)="loadCard()">Try Again</button>
  </div>
  
  <!-- Card Display -->
  <div *ngIf="renderedCard && !isLoading" class="card-display">
    
    <!-- Front of Card -->
    <div class="card-front">
      <!-- Dynamic SVG from template -->
      <div class="card-svg" [innerHTML]="renderedCard | safeHtml"></div>
      
      <!-- Canvas fallback for advanced effects -->
      <canvas #cardCanvas class="card-canvas" *ngIf="template?.useCanvas"></canvas>
      
      <!-- Accessibility enhancements -->
      <div class="sr-only" [attr.aria-label]="getAccessibilityLabel()">
        Digital membership card for {{ card?.member_name }}
      </div>
    </div>
    
    <!-- Back of Card (if flip enabled) -->
    <div class="card-back" *ngIf="template?.features.flip">
      <div class="card-back-content">
        <h3>Membership Details</h3>
        <div class="details-list">
          <div class="detail-item">
            <span class="label">Member ID:</span>
            <span class="value">{{ card?.member_id }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Card ID:</span>
            <span class="value">{{ card?.id }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Issued:</span>
            <span class="value">{{ card?.issued_at | date:'mediumDate' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Expires:</span>
            <span class="value">{{ card?.expires_at | date:'mediumDate' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Terms & Conditions:</span>
            <span class="value">
              <a [href]="template?.terms_url" target="_blank">View Terms</a>
            </span>
          </div>
        </div>
        
        <!-- Back side QR code -->
        <div class="back-qr" *ngIf="template?.features.backQR">
          <qr-code [value]="card?.id" [size]="120"></qr-code>
          <p class="qr-label">Card Verification</p>
        </div>
      </div>
    </div>
    
    <!-- Card Actions -->
    <div class="card-actions" *ngIf="showActions">
      <button (click)="downloadCard('png')" class="action-btn" title="Download as PNG">
        <i class="icon-download"></i>
        <span class="action-label">Download</span>
      </button>
      
      <button (click)="shareCard()" class="action-btn" *ngIf="navigator.share" title="Share Card">
        <i class="icon-share"></i>
        <span class="action-label">Share</span>
      </button>
      
      <button (click)="printCard()" class="action-btn" title="Print Card">
        <i class="icon-print"></i>
        <span class="action-label">Print</span>
      </button>
      
      <button (click)="flipCard()" class="action-btn" *ngIf="template?.features.flip" title="Flip Card">
        <i class="icon-flip"></i>
        <span class="action-label">Flip</span>
      </button>
    </div>
  </div>
  
  <!-- Template Info (debug mode) -->
  <div class="template-info" *ngIf="template && interactive">
    <small>Template: {{ template.name }} v{{ template.version }}</small>
  </div>
</div>
```

```scss
// card-renderer.component.scss
.card-container {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  perspective: 1000px;
  transition: all 0.3s ease;
  
  &.loading {
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  &.interactive {
    cursor: pointer;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
    }
  }
  
  &.flipped .card-display {
    transform: rotateY(180deg);
  }
}

.card-display {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: inherit;
}

.card-front {
  background: white;
}

.card-back {
  background: #f8f9fa;
  transform: rotateY(180deg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-svg {
  width: 100%;
  height: 100%;
  
  // Template styles can override these
  ::ng-deep {
    .member-photo {
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    .qr-code {
      transition: transform 0.3s ease;
      
      &:hover {
        transform: scale(1.05);
      }
    }
    
    .card-text {
      font-family: inherit;
      fill: currentColor;
    }
  }
}

.card-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

// Responsive adjustments
@media (max-width: 768px) {
  .card-container {
    max-width: 100%;
    
    &.interactive:hover {
      transform: none;
    }
  }
  
  .card-actions {
    flex-wrap: wrap;
    
    .action-btn {
      flex: 1 0 45%;
      margin: 4px;
    }
  }
}

// Print styles
@media print {
  .card-container {
    box-shadow: none !important;
    page-break-inside: avoid;
  }
  
  .card-actions {
    display: none;
  }
}

// Dark mode support
@media (prefers-color-scheme: dark) {
  .card-front {
    background: #1a1a1a;
  }
  
  .card-back {
    background: #2d2d2d;
    color: #ffffff;
  }
}

// Accessibility
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// Animations
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.card-display {
  animation: fadeIn 0.5s ease-out;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear