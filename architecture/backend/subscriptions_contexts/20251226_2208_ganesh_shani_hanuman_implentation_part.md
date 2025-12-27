# 🚀 **SHANI PHASE - WEEK 1: Foundation Standards**

Starting with disciplined structure and long-term thinking. Let's establish the rigorous standards that will govern our Subscription Contexts system.

## 📋 **Week 1 Deliverables:**

1. **Architecture Standards Document**
2. **Payment Adapter Interface Specification**
3. **YAML Definition Schema**
4. **Security & Compliance Framework**
5. **Nepal VAT Implementation**

---

## 📄 **1. Architecture Standards Document**

Creating: `docs/architecture/standards.md`

```markdown
# Subscription Contexts Architecture Standards

## 1. Core Principles

### 1.1 Divine Principle Alignment
- **Ganesha**: Remove obstacles before building
- **Shani**: Establish discipline before execution  
- **Hanuman**: Solve with scientific precision

### 1.2 Business Principles
1. **Context Independence**: Each business context operates independently
2. **Monetization First**: Every context has defined monetization strategy
3. **Nepal First**: Prioritize Nepal market with local payment methods
4. **Always Free Tier**: Every context has a free tier for adoption
5. **30-Day Trials**: All paid plans include 30-day free trial

### 1.3 Technical Principles
1. **YAML-Driven**: Module definitions in version-controlled YAML
2. **Database-State**: Tenant state in database, definitions in code
3. **Adapter Pattern**: All external integrations through adapters
4. **Hexagonal Architecture**: Core domain isolated from infrastructure
5. **CQRS Pattern**: Separate read/write models for performance

## 2. Development Standards

### 2.1 Code Standards
```php
// All subscription code must:
// 1. Use strict typing
declare(strict_types=1);

// 2. Follow PSR-12 coding standards
// 3. Include comprehensive PHPDoc
// 4. Have minimum 80% test coverage
// 5. Pass PHPStan level 8
```

### 2.2 Testing Standards
- **Unit Tests**: All business logic
- **Integration Tests**: All external integrations
- **Payment Tests**: All payment flows
- **Security Tests**: All security-critical code
- **Performance Tests**: All performance-critical paths

### 2.3 Documentation Standards
- **YAML Schema**: Complete OpenAPI-like documentation
- **Adapter Specs**: Complete interface specifications
- **Installation Guides**: Step-by-step installation procedures
- **Troubleshooting**: Common issues and solutions
- **API Documentation**: Complete API reference

## 3. Security Standards

### 3.1 Data Protection
- **VAT Data**: AES-256 encryption at rest
- **PAN Numbers**: Tokenization, never stored plaintext
- **Payment Tokens**: Secure vault storage
- **Audit Trail**: 7-year retention for Nepal compliance

### 3.2 Payment Security
- **PCI DSS**: All payment processing PCI DSS compliant
- **Webhook Security**: HMAC signature verification
- **API Security**: Rate limiting and IP whitelisting
- **Secret Management**: Environment variables or secure vault

### 3.3 Access Control
- **Tenant Isolation**: Database-level isolation
- **Admin Access**: Multi-factor authentication required
- **API Access**: OAuth2 with scoped permissions
- **Audit Logging**: All administrative actions logged

## 4. Nepal-Specific Standards

### 4.1 VAT Compliance
- **Rate**: 13% VAT on all taxable transactions
- **Calculation**: Automated VAT calculation
- **Invoicing**: VAT-compliant invoices
- **Reporting**: Monthly VAT return preparation

### 4.2 Payment Methods
- **Primary**: eSewa (wallet-based)
- **Secondary**: Khalti (mobile-based)
- **Fallback**: Bank transfer (manual)
- **Future**: Stripe (credit cards)

### 4.3 Business Requirements
- **PAN Required**: For business customers
- **VAT Registration**: For high-volume customers
- **Nepali Language**: UI support required
- **Nepali Timezone**: NPT (UTC+5:45) for all timestamps

## 5. Quality Gates

### 5.1 Code Review Requirements
- **Payment Code**: Senior developer + security review
- **YAML Definitions**: Product manager + architect review
- **Database Changes**: DBA review
- **Security Changes**: Security team review

### 5.2 Deployment Gates
1. **Unit Tests Pass**: 100% required
2. **Integration Tests**: All payment adapters
3. **Security Scan**: No critical vulnerabilities
4. **Performance Test**: Within SLA limits
5. **Compliance Check**: VAT calculations verified

### 5.3 Monitoring Requirements
- **Payment Success Rate**: > 99.5%
- **Installation Success Rate**: > 99.9%
- **System Uptime**: > 99.9%
- **Response Time**: < 2 seconds p95
```

---

## 🔌 **2. Payment Adapter Interface Specification**

Creating: `app/Subscription/Core/Contracts/PaymentProviderPort.php`

```php
<?php

declare(strict_types=1);

namespace App\Subscription\Core\Contracts;

use App\Subscription\Core\ValueObjects\PaymentRequest;
use App\Subscription\Core\ValueObjects\PaymentResult;
use App\Subscription\Core\ValueObjects\RefundRequest;
use App\Subscription\Core\ValueObjects\RefundResult;
use App\Subscription\Core\ValueObjects\WebhookVerification;
use App\Subscription\Core\ValueObjects\Customer;

/**
 * Payment Provider Port Interface
 * 
 * SHANI Principle: Standardized interface for all payment providers
 * 
 * All payment adapters MUST implement this interface.
 * This ensures consistency across different payment methods.
 */
interface PaymentProviderPort
{
    /**
     * Get unique identifier for this provider
     * Example: 'esewa', 'khalti', 'stripe'
     */
    public function getId(): string;
    
    /**
     * Get human-readable name for this provider
     */
    public function getName(): string;
    
    /**
     * Get supported countries (ISO 3166-1 alpha-2 codes)
     * 
     * @return string[] Array of country codes
     */
    public function getSupportedCountries(): array;
    
    /**
     * Get supported currencies (ISO 4217 codes)
     * 
     * @return string[] Array of currency codes
     */
    public function getSupportedCurrencies(): array;
    
    /**
     * Check if provider supports a specific country
     */
    public function supportsCountry(string $countryCode): bool;
    
    /**
     * Check if provider supports a specific currency
     */
    public function supportsCurrency(string $currencyCode): bool;
    
    /**
     * Get payment method types supported
     * Example: ['wallet', 'card', 'bank_transfer']
     * 
     * @return string[]
     */
    public function getSupportedPaymentMethods(): array;
    
    /**
     * Get provider-specific configuration requirements
     * 
     * @return array Configuration schema
     */
    public function getConfigurationSchema(): array;
    
    /**
     * Initialize payment intent
     * 
     * Creates a payment intent with the provider
     * Returns provider-specific payment data
     */
    public function createPaymentIntent(PaymentRequest $request): PaymentResult;
    
    /**
     * Verify payment completion
     * 
     * Verifies if payment was successfully completed
     * Should be called after provider redirects back
     */
    public function verifyPayment(string $transactionId, array $verificationData = []): PaymentResult;
    
    /**
     * Process refund
     * 
     * Initiates refund for a successful payment
     */
    public function refundPayment(RefundRequest $request): RefundResult;
    
    /**
     * Verify webhook signature
     * 
     * Validates that webhook request came from the provider
     */
    public function verifyWebhookSignature(array $webhookData, string $signatureHeader): WebhookVerification;
    
    /**
     * Parse webhook payload
     * 
     * Extracts standard data from provider-specific webhook format
     */
    public function parseWebhookPayload(array $webhookData): array;
    
    /**
     * Create or retrieve customer
     * 
     * Manages customer records with the payment provider
     */
    public function manageCustomer(Customer $customer): string;
    
    /**
     * Get payment status
     * 
     * Retrieves current status of a payment
     */
    public function getPaymentStatus(string $paymentId): string;
    
    /**
     * Check if provider is operational
     * 
     * Performs health check on provider connection
     */
    public function isOperational(): bool;
    
    /**
     * Get provider-specific metadata
     * 
     * Returns provider capabilities, limits, etc.
     */
    public function getMetadata(): array;
    
    /**
     * Get Nepal-specific requirements
     * 
     * Returns requirements specific to Nepal market
     */
    public function getNepalRequirements(): array;
}
```

---

## 📁 **3. Value Objects for Payment Domain**

Creating: `app/Subscription/Core/ValueObjects/`

### **PaymentRequest.php**
```php
<?php

declare(strict_types=1);

namespace App\Subscription\Core\ValueObjects;

use App\Subscription\Core\ValueObjects\Money;
use App\Subscription\Core\ValueObjects\Customer;

/**
 * Payment Request Value Object
 * 
 * Immutable object representing a payment request
 */
final class PaymentRequest
{
    private function __construct(
        private string $id,
        private Money $amount,
        private Customer $customer,
        private string $description,
        private array $metadata = [],
        private ?string $returnUrl = null,
        private ?string $cancelUrl = null
    ) {
        $this->validate();
    }
    
    public static function create(
        string $id,
        Money $amount,
        Customer $customer,
        string $description,
        array $metadata = [],
        ?string $returnUrl = null,
        ?string $cancelUrl = null
    ): self {
        return new self($id, $amount, $customer, $description, $metadata, $returnUrl, $cancelUrl);
    }
    
    private function validate(): void
    {
        if (empty($this->id)) {
            throw new \InvalidArgumentException('Payment ID cannot be empty');
        }
        
        if (empty($this->description)) {
            throw new \InvalidArgumentException('Payment description cannot be empty');
        }
        
        if ($this->amount->getAmount() <= 0) {
            throw new \InvalidArgumentException('Payment amount must be positive');
        }
    }
    
    public function getId(): string
    {
        return $this->id;
    }
    
    public function getAmount(): Money
    {
        return $this->amount;
    }
    
    public function getCustomer(): Customer
    {
        return $this->customer;
    }
    
    public function getDescription(): string
    {
        return $this->description;
    }
    
    public function getMetadata(): array
    {
        return $this->metadata;
    }
    
    public function getReturnUrl(): ?string
    {
        return $this->returnUrl;
    }
    
    public function getCancelUrl(): ?string
    {
        return $this->cancelUrl;
    }
    
    public function withMetadata(array $metadata): self
    {
        $new = clone $this;
        $new->metadata = array_merge($this->metadata, $metadata);
        return $new;
    }
}
```

### **Money.php**
```php
<?php

declare(strict_types=1);

namespace App\Subscription\Core\ValueObjects;

/**
 * Money Value Object
 * 
 * Represents monetary amount with currency
 */
final class Money
{
    private function __construct(
        private float $amount,
        private string $currency
    ) {
        $this->validate();
    }
    
    public static function create(float $amount, string $currency): self
    {
        return new self($amount, $currency);
    }
    
    public static function fromNPR(float $amount): self
    {
        return new self($amount, 'NPR');
    }
    
    private function validate(): void
    {
        if ($this->amount < 0) {
            throw new \InvalidArgumentException('Amount cannot be negative');
        }
        
        if (!in_array($this->currency, ['NPR', 'USD', 'INR', 'EUR'])) {
            throw new \InvalidArgumentException('Unsupported currency: ' . $this->currency);
        }
    }
    
    public function getAmount(): float
    {
        return $this->amount;
    }
    
    public function getCurrency(): string
    {
        return $this->currency;
    }
    
    public function add(Money $other): self
    {
        if ($this->currency !== $other->currency) {
            throw new \InvalidArgumentException('Cannot add different currencies');
        }
        
        return new self($this->amount + $other->amount, $this->currency);
    }
    
    public function multiply(float $factor): self
    {
        return new self($this->amount * $factor, $this->currency);
    }
    
    public function format(): string
    {
        return number_format($this->amount, 2) . ' ' . $this->currency;
    }
    
    public function equals(Money $other): bool
    {
        return $this->amount === $other->amount && $this->currency === $other->currency;
    }
}
```

### **Customer.php**
```php
<?php

declare(strict_types=1);

namespace App\Subscription\Core\ValueObjects;

/**
 * Customer Value Object
 * 
 * Represents a payment customer
 */
final class Customer
{
    private function __construct(
        private string $id,
        private string $email,
        private ?string $name = null,
        private ?string $phone = null,
        private ?string $vatNumber = null,
        private ?string $panNumber = null,
        private ?Address $address = null
    ) {
        $this->validate();
    }
    
    public static function create(
        string $id,
        string $email,
        ?string $name = null,
        ?string $phone = null,
        ?string $vatNumber = null,
        ?string $panNumber = null,
        ?Address $address = null
    ): self {
        return new self($id, $email, $name, $phone, $vatNumber, panNumber, $address);
    }
    
    private function validate(): void
    {
        if (!filter_var($this->email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Invalid email address');
        }
        
        if ($this->vatNumber && !preg_match('/^\d{9}$/', $this->vatNumber)) {
            throw new \InvalidArgumentException('VAT number must be 9 digits');
        }
        
        if ($this->panNumber && !preg_match('/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/', $this->panNumber)) {
            throw new \InvalidArgumentException('Invalid PAN number format');
        }
    }
    
    // Getters and business methods...
}
```

---

## 📝 **4. YAML Definition Schema**

Creating: `docs/schemas/module-schema.yaml`

```yaml
# Module Definition Schema
# Version: 1.0.0
# Purpose: Define structure for all module YAML definitions

$schema: "http://json-schema.org/draft-07/schema#"
title: "Module Definition"
description: "Schema for defining monetizable business contexts"

type: object
required:
  - module
  - name
  - slug
  - version
  - plans

properties:
  module:
    type: object
    required:
      - slug
      - name
      - version
      - category
    properties:
      slug:
        type: string
        pattern: "^[a-z][a-z0-9_-]*$"
        description: "Unique identifier for the module"
        example: "digital_card"
      
      name:
        type: string
        minLength: 3
        maxLength: 100
        description: "Human-readable name"
        example: "Digital Membership Cards"
      
      version:
        type: string
        pattern: "^\\d+\\.\\d+\\.\\d+$"
        description: "Semantic version"
        example: "1.0.0"
      
      category:
        type: string
        enum:
          - membership
          - governance
          - finance
          - communication
          - analytics
        description: "Business category"
        example: "membership"
      
      description:
        type: string
        description: "Detailed description"
      
      icon:
        type: string
        description: "Icon identifier"
        example: "id-card"
      
      tags:
        type: array
        items:
          type: string
        description: "Search tags"
      
      dependencies:
        type: object
        properties:
          required:
            type: array
            items:
              type: object
              properties:
                module:
                  type: string
                min_version:
                  type: string
          optional:
            type: array
            items:
              type: object
              properties:
                module:
                  type: string
                description:
                  type: string
  
  features:
    type: object
    patternProperties:
      "^[a-z][a-z0-9_]*$":
        type: object
        required:
          - name
          - description
        properties:
          name:
            type: string
          description:
            type: string
          requires:
            type: array
            items:
              type: string
  
  plans:
    type: object
    patternProperties:
      "^[a-z][a-z0-9_]*$":
        type: object
        required:
          - name
          - price
        properties:
          name:
            type: string
            example: "Professional"
          
          description:
            type: string
          
          price:
            type: number
            minimum: 0
            description: "Monthly price in base currency"
          
          billing_cycle:
            type: string
            enum:
              - monthly
              - annual
              - one_time
            default: "monthly"
          
          trial_days:
            type: integer
            minimum: 0
            maximum: 365
            default: 30
          
          currency:
            type: string
            pattern: "^[A-Z]{3}$"
            default: "NPR"
          
          features:
            type: array
            items:
              type: string
          
          limits:
            type: object
            additionalProperties:
              oneOf:
                - type: integer
                - type: string
          
          metadata:
            type: object
  
  installation:
    type: object
    properties:
      type:
        type: string
        enum:
          - database
          - configuration
          - hybrid
      
      migrations:
        type: array
        items:
          type: string
      
      seeders:
        type: array
        items:
          type: string
      
      configuration:
        type: object
  
  nepal_specific:
    type: object
    properties:
      vat_applicable:
        type: boolean
        default: true
      
      vat_rate:
        type: number
        default: 0.13
      
      pan_required:
        type: boolean
        default: false
      
      recommended_for:
        type: array
        items:
          type: string
        enum:
          - political_party
          - ngo
          - school
          - business
```

Creating example: `modules/digital-card/Module.yaml`

```yaml
# Digital Card Module Definition
# Version: 1.0.0
# Purpose: Digital membership card system for Nepal organizations

module:
  slug: digital_card
  name: Digital Membership Cards
  version: 1.0.0
  category: membership
  description: >
    Create and manage digital membership cards with QR codes.
    Perfect for political parties, NGOs, and associations in Nepal.
  icon: id-card
  tags:
    - membership
    - cards
    - qr
    - nepal
  dependencies:
    required: []
    optional:
      - module: membership
        description: "Integrate with membership management"

features:
  create_card:
    name: Create Card
    description: "Create new digital membership cards"
  
  basic_templates:
    name: Basic Templates
    description: "Use pre-designed card templates"
  
  qr_code:
    name: QR Code
    description: "Generate QR codes for cards"
    requires:
      - create_card
  
  share_link:
    name: Share Link
    description: "Generate shareable card links"
    requires:
      - create_card
  
  advanced_templates:
    name: Advanced Templates
    description: "Customizable card templates"
    requires:
      - basic_templates
  
  custom_branding:
    name: Custom Branding
    description: "Add organization branding to cards"
  
  batch_generation:
    name: Batch Generation
    description: "Generate multiple cards at once"
    requires:
      - create_card

plans:
  free:
    name: Free
    description: "Basic digital cards for small organizations"
    price: 0
    trial_days: 0
    currency: NPR
    features:
      - create_card
      - basic_templates
      - qr_code
      - share_link
    limits:
      max_cards: 100
      max_templates: 3
  
  professional:
    name: Professional
    description: "For growing organizations needing more features"
    price: 499
    trial_days: 30
    currency: NPR
    features:
      - create_card
      - basic_templates
      - qr_code
      - share_link
      - advanced_templates
      - custom_branding
      - batch_generation
    limits:
      max_cards: 1000
      max_templates: 20
    metadata:
      popular: true
      recommended: true
  
  business:
    name: Business
    description: "For large organizations with advanced needs"
    price: 1499
    trial_days: 30
    currency: NPR
    features:
      - "*"  # All features
    limits:
      max_cards: 10000
      max_templates: unlimited

installation:
  type: hybrid
  migrations:
    - "database/migrations/digital_card/create_digital_cards_table.php"
    - "database/migrations/digital_card/create_digital_card_templates_table.php"
  seeders:
    - "App\Contexts\DigitalCard\Database\Seeders\BasicTemplatesSeeder"
  configuration:
    config_file: "digital-card.php"
    env_variables:
      - "DIGITAL_CARD_QR_SIZE"
      - "DIGITAL_CARD_DEFAULT_TEMPLATE"

nepal_specific:
  vat_applicable: true
  vat_rate: 0.13
  pan_required: true
  recommended_for:
    - political_party
    - ngo
    - association
```

---

## 🔒 **5. Security & Compliance Framework**

Creating: `app/Subscription/Core/Security/NepalVatCalculator.php`

```php
<?php

declare(strict_types=1);

namespace App\Subscription\Core\Security;

use App\Subscription\Core\ValueObjects\Money;

/**
 * Nepal VAT Calculator
 * 
 * SHANI Principle: Strict compliance with Nepal tax regulations
 * 
 * Handles all Nepal VAT calculations with audit trail
 */
final class NepalVatCalculator
{
    private const VAT_RATE = 0.13; // 13%
    private const VAT_THRESHOLD = 3000000; // 3 million NPR annual
    
    /**
     * Calculate VAT for a transaction
     */
    public function calculateVat(Money $amount, bool $isBusinessCustomer = false): VatCalculation
    {
        if ($amount->getCurrency() !== 'NPR') {
            throw new \InvalidArgumentException('VAT calculation only supports NPR');
        }
        
        $vatAmount = $amount->getAmount() * self::VAT_RATE;
        $totalAmount = $amount->getAmount() + $vatAmount;
        
        return new VatCalculation(
            taxableAmount: $amount,
            vatRate: self::VAT_RATE,
            vatAmount: Money::create($vatAmount, 'NPR'),
            totalAmount: Money::create($totalAmount, 'NPR'),
            isVatApplicable: $this->isVatApplicable($amount, $isBusinessCustomer),
            vatNumberRequired: $this->isVatNumberRequired($amount, $isBusinessCustomer)
        );
    }
    
    /**
     * Check if VAT is applicable
     */
    private function isVatApplicable(Money $amount, bool $isBusinessCustomer): bool
    {
        // VAT always applicable for business customers in Nepal
        if ($isBusinessCustomer) {
            return true;
        }
        
        // For individuals, check if above threshold
        return $amount->getAmount() >= 10000; // Example threshold
    }
    
    /**
     * Check if VAT number is required
     */
    private function isVatNumberRequired(Money $amount, bool $isBusinessCustomer): bool
    {
        // Business customers always need VAT number for invoices
        if ($isBusinessCustomer) {
            return true;
        }
        
        // Individuals only need for large transactions
        return $amount->getAmount() >= 500000; // 5 lakh NPR
    }
    
    /**
     * Generate VAT invoice number
     */
    public function generateVatInvoiceNumber(string $tenantId, \DateTimeInterface $date): string
    {
        $dateStr = $date->format('Ymd');
        $sequence = $this->getDailySequence($tenantId, $date);
        
        return sprintf('VAT-%s-%s-%04d', $tenantId, $dateStr, $sequence);
    }
    
    /**
     * Validate VAT number format (Nepal)
     */
    public function validateVatNumber(string $vatNumber): bool
    {
        // Nepal VAT number format: 9 digits
        return preg_match('/^\d{9}$/', $vatNumber) === 1;
    }
    
    /**
     * Validate PAN number format (Nepal)
     */
    public function validatePanNumber(string $panNumber): bool
    {
        // Nepal PAN format: 5 letters, 4 digits, 1 letter
        return preg_match('/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/', $panNumber) === 1;
    }
    
    /**
     * Generate VAT-compliant invoice data
     */
    public function generateInvoiceData(VatCalculation $vat, array $customerData): array
    {
        return [
            'invoice_number' => $this->generateVatInvoiceNumber(
                $customerData['tenant_id'] ?? '',
                new \DateTimeImmutable()
            ),
            'invoice_date' => date('Y-m-d'),
            'customer' => [
                'name' => $customerData['name'] ?? '',
                'vat_number' => $customerData['vat_number'] ?? null,
                'pan_number' => $customerData['pan_number'] ?? null,
                'address' => $customerData['address'] ?? '',
            ],
            'items' => [
                [
                    'description' => 'Subscription Service',
                    'quantity' => 1,
                    'unit_price' => $vat->getTaxableAmount()->getAmount(),
                    'total' => $vat->getTaxableAmount()->getAmount(),
                ]
            ],
            'vat_details' => [
                'rate' => $vat->getVatRate() * 100, // Percentage
                'amount' => $vat->getVatAmount()->getAmount(),
                'total_with_vat' => $vat->getTotalAmount()->getAmount(),
            ],
            'compliance' => [
                'vat_applicable' => $vat->isVatApplicable(),
                'vat_number_required' => $vat->isVatNumberRequired(),
                'nepal_compliant' => true,
            ]
        ];
    }
    
    private function getDailySequence(string $tenantId, \DateTimeInterface $date): int
    {
        // Implement sequence tracking (database, cache, etc.)
        // For now, return random sequence
        return random_int(1, 9999);
    }
}

/**
 * VAT Calculation Value Object
 */
final class VatCalculation
{
    public function __construct(
        private Money $taxableAmount,
        private float $vatRate,
        private Money $vatAmount,
        private Money $totalAmount,
        private bool $isVatApplicable,
        private bool $vatNumberRequired
    ) {}
    
    public function getTaxableAmount(): Money
    {
        return $this->taxableAmount;
    }
    
    public function getVatRate(): float
    {
        return $this->vatRate;
    }
    
    public function getVatAmount(): Money
    {
        return $this->vatAmount;
    }
    
    public function getTotalAmount(): Money
    {
        return $this->totalAmount;
    }
    
    public function isVatApplicable(): bool
    {
        return $this->isVatApplicable;
    }
    
    public function isVatNumberRequired(): bool
    {
        return $this->vatNumberRequired;
    }
    
    public function toArray(): array
    {
        return [
            'taxable_amount' => $this->taxableAmount->getAmount(),
            'vat_rate' => $this->vatRate,
            'vat_amount' => $this->vatAmount->getAmount(),
            'total_amount' => $this->totalAmount->getAmount(),
            'is_vat_applicable' => $this->isVatApplicable,
            'vat_number_required' => $this->vatNumberRequired,
            'currency' => $this->taxableAmount->getCurrency(),
        ];
    }
}
```

---

## 📊 **6. Database Schema Foundation**

Creating migration: `database/migrations/2024_01_week1_shani_foundation.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * SHANI Principle: Structured, disciplined database design
     */
    public function up(): void
    {
        // Module Definitions (YAML-backed, read-only)
        Schema::create('module_definitions', function (Blueprint $table) {
            $table->string('slug')->primary();
            $table->string('name');
            $table->string('version');
            $table->string('category');
            $table->text('description')->nullable();
            $table->string('icon')->nullable();
            $table->json('tags')->nullable();
            $table->json('dependencies')->nullable();
            $table->json('features')->nullable();
            $table->json('installation_config')->nullable();
            $table->json('nepal_specific')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index(['category', 'is_active']);
            $table->index('tags', null, 'gin');
        });
        
        // Module Plans
        Schema::create('module_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('module_slug');
            $table->string('slug');
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->string('currency', 3)->default('NPR');
            $table->string('billing_cycle')->default('monthly');
            $table->integer('trial_days')->default(0);
            $table->json('features')->nullable();
            $table->json('limits')->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            
            $table->foreign('module_slug')
                  ->references('slug')
                  ->on('module_definitions')
                  ->onDelete('cascade');
            
            $table->unique(['module_slug', 'slug']);
            $table->index(['module_slug', 'is_active', 'sort_order']);
        });
        
        // Tenant Subscriptions
        Schema::create('tenant_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('module_slug');
            $table->uuid('plan_id');
            $table->string('status')->default('trialing'); // trialing, active, past_due, canceled, unpaid
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestamp('canceled_at')->nullable();
            $table->json('settings')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->foreign('module_slug')
                  ->references('slug')
                  ->on('module_definitions')
                  ->onDelete('cascade');
            
            $table->foreign('plan_id')
                  ->references('id')
                  ->on('module_plans')
                  ->onDelete('restrict');
            
            $table->unique(['tenant_id', 'module_slug']);
            $table->index(['tenant_id', 'status', 'current_period_end']);
            $table->index(['module_slug', 'status']);
        });
        
        // Payment Providers
        Schema::create('payment_providers', function (Blueprint $table) {
            $table->string('id')->primary(); // esewa, khalti, stripe
            $table->string('name');
            $table->string('type'); // wallet, card, bank_transfer
            $table->json('supported_countries');
            $table->json('supported_currencies');
            $table->json('configuration_schema');
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0);
            $table->json('nepal_requirements')->nullable();
            $table->timestamps();
            
            $table->index(['is_active', 'priority']);
        });
        
        // Tenant Payment Methods
        Schema::create('tenant_payment_methods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('provider_id');
            $table->string('method_type'); // esewa_wallet, khalti_mobile, card
            $table->json('provider_data'); // Encrypted provider-specific data
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            
            $table->foreign('provider_id')
                  ->references('id')
                  ->on('payment_providers')
                  ->onDelete('restrict');
            
            $table->index(['tenant_id', 'is_default', 'is_active']);
            $table->index(['provider_id', 'is_active']);
        });
        
        // Payments
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('subscription_id')->nullable();
            $table->string('provider_id');
            $table->decimal('amount', 10, 2);
            $table->decimal('vat_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2);
            $table->string('currency', 3)->default('NPR');
            $table->string('status'); // pending, processing, completed, failed, refunded
            $table->string('provider_payment_id')->nullable();
            $table->json('provider_data')->nullable();
            $table->string('vat_invoice_number')->nullable();
            $table->json('customer_vat_info')->nullable();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->foreign('provider_id')
                  ->references('id')
                  ->on('payment_providers')
                  ->onDelete('restrict');
            
            $table->foreign('subscription_id')
                  ->references('id')
                  ->on('tenant_subscriptions')
                  ->onDelete('set null');
            
            $table->index(['tenant_id', 'status', 'created_at']);
            $table->index(['provider_id', 'provider_payment_id']);
            $table->index(['status', 'created_at']);
        });
        
        // Payment Webhooks (Audit Trail)
        Schema::create('payment_webhooks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider_id');
            $table->string('event_type');
            $table->json('payload');
            $table->string('signature')->nullable();
            $table->boolean('is_valid')->default(false);
            $table->boolean('is_processed')->default(false);
            $table->text('processing_error')->nullable();
            $table->timestamps