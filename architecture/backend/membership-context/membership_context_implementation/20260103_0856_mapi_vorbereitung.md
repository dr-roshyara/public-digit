**YES!** Let's proceed with **DAY 2: Mobile API Implementation (CASE 2 - /mapi routes)**.

## 🎯 **DAY 2 TASKS:**

### **1. Mobile Controller (THIN)**
- Thin controller that delegates to `MobileMemberRegistrationService`
- Error handling and HTTP response mapping
- Located in `app/Contexts/Membership/Infrastructure/Http/Controllers/Mobile/`

### **2. Mobile Validation Request**
- FormRequest for `/mapi/v1/members/register` endpoint
- Validation rules for mobile registration
- Located in `app/Contexts/Membership/Infrastructure/Http/Requests/Mobile/`

### **3. Mobile Resource**
- JSON:API format response for mobile clients
- Mobile-specific links and metadata
- Located in `app/Contexts/Membership/Infrastructure/Http/Resources/Mobile/`

### **4. Mobile Routes**
- `/{tenant}/mapi/v1/members/register` (public endpoint)
- Add to `routes/tenant-mapi/membership.php`
- Middleware: `api`, `identify.tenant` (no auth for registration)

### **5. Feature Tests (TDD)**
- End-to-end tests for mobile registration API
- Test validation, success, and error cases
- Located in `tests/Feature/Contexts/Membership/Mobile/`

## 🚀 **I'll start with TDD - create the failing feature tests first:**

Create file packages\laravel-backend\tests\Feature\Contexts\Membership\Mobile\MemberRegistrationApiTest.php
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Contexts\Membership\Mobile;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Mobile Member Registration API Tests
 *
 * Tests the mobile API endpoint: POST /{tenant}/mapi/v1/members/register
 *
 * CASE 2: Tenant Mobile API
 * - Route: /{tenant}/mapi/v1/members/register
 * - Middleware: api, identify.tenant
 * - Public endpoint (no authentication required for registration)
 * - Mobile-specific fields: device_id, app_version, platform
 *
 * TDD Workflow:
 * 1. RED: Write failing tests (this file)
 * 2. GREEN: Implement mobile API layer
 * 3. REFACTOR: Clean up and optimize
 */
class MemberRegistrationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Set up tenant database
        config(['database.default' => 'tenant']);
        
        // Mock the domain service interfaces
        $this->setupDomainServiceMocks();
        
        // Fake queue for email verification
        Queue::fake();
    }

    private function setupDomainServiceMocks(): void
    {
        // These mocks will be implemented when we create the infrastructure adapters
        // For now, tests will fail (RED phase) which is correct TDD
    }

    /** @test */
    public function mobile_user_can_register_via_api(): void
    {
        // Arrange
        $payload = [
            'full_name' => 'John Citizen',
            'email' => 'john.citizen@example.com',
            'phone' => '+977-9841234567',
            'device_id' => 'device-123',
            'app_version' => '1.0.0',
            'platform' => 'android',
        ];

        // Act: POST to mobile registration endpoint
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert: Success response
        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'type',
                    'attributes' => [
                        'member_id',
                        'tenant_user_id',
                        'tenant_id',
                        'personal_info',
                        'status',
                        'residence_geo_reference',
                        'membership_type',
                        'registration_channel',
                    ],
                    'links' => ['self'],
                ],
                'message',
                'meta' => ['verification_required'],
            ])
            ->assertJson([
                'data' => [
                    'type' => 'member',
                    'attributes' => [
                        'tenant_id' => 'uml',
                        'status' => 'draft',
                        'registration_channel' => 'mobile',
                    ],
                ],
                'message' => 'Registration successful. Please check your email for verification.',
            ]);
    }

    /** @test */
    public function registration_requires_full_name(): void
    {
        // Arrange
        $payload = [
            'email' => 'test@example.com',
            // Missing full_name
        ];

        // Act
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert: Validation error
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['full_name']);
    }

    /** @test */
    public function registration_requires_valid_email(): void
    {
        // Arrange
        $payload = [
            'full_name' => 'Test User',
            'email' => 'not-an-email',
        ];

        // Act
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function registration_accepts_optional_fields(): void
    {
        // Arrange
        $payload = [
            'full_name' => 'Jane Citizen',
            'email' => 'jane@example.com',
            'phone' => '+977-9841111111',
            'member_id' => 'UML-2025-001',
            'geo_reference' => 'np.3.15.234',
            'device_id' => 'ios-device-456',
            'app_version' => '2.0.0',
            'platform' => 'ios',
        ];

        // Act
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert: All optional fields accepted
        $response->assertStatus(201);
    }

    /** @test */
    public function registration_validates_geography_reference_format(): void
    {
        // Arrange
        $payload = [
            'full_name' => 'Test User',
            'email' => 'test@example.com',
            'geo_reference' => 'invalid-geo-format', // Invalid format
        ];

        // Act
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert: Should validate via GeographyResolverInterface
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['geo_reference']);
    }

    /** @test */
    public function registration_requires_unique_email_per_tenant(): void
    {
        // Arrange: Create existing member with email
        // This will be implemented when we have test factories
        
        $payload = [
            'full_name' => 'Duplicate User',
            'email' => 'duplicate@example.com',
        ];

        // First registration succeeds
        $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Second registration with same email should fail
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert: Business rule violation
        $response->assertStatus(422)
            ->assertJson([
                'message' => 'A member with this email already exists.',
            ]);
    }

    /** @test */
    public function registration_with_member_id_must_be_unique(): void
    {
        // Arrange: Create existing member with member_id
        // This will be implemented when we have test factories
        
        $payload = [
            'full_name' => 'Test User',
            'email' => 'test1@example.com',
            'member_id' => 'UML-UNIQUE-001',
        ];

        // First registration succeeds
        $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Second registration with same member_id should fail
        $payload['email'] = 'test2@example.com'; // Different email
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert: Business rule violation
        $response->assertStatus(422)
            ->assertJson([
                'message' => "Member ID 'UML-UNIQUE-001' already exists for tenant 'uml'",
            ]);
    }

    /** @test */
    public function registration_creates_member_with_draft_status(): void
    {
        // Arrange
        $payload = [
            'full_name' => 'Draft User',
            'email' => 'draft@example.com',
        ];

        // Act
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert: Mobile registration creates DRAFT status
        $response->assertStatus(201)
            ->assertJson([
                'data' => [
                    'attributes' => [
                        'status' => 'draft',
                        'registration_channel' => 'mobile',
                    ],
                ],
            ]);
    }

    /** @test */
    public function registration_dispatches_email_verification_job(): void
    {
        // Arrange
        $payload = [
            'full_name' => 'Verify User',
            'email' => 'verify@example.com',
        ];

        // Act
        $response = $this->postJson('/uml/mapi/v1/members/register', $payload);

        // Assert: Email verification job dispatched
        $response->assertStatus(201);
        
        // This will be implemented when we add email verification
        // Queue::assertPushed(SendMemberVerificationEmail::class);
    }
}
```