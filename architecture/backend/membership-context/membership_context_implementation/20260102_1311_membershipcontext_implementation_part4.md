# 🚀 **OPTION 1: API LAYER - COMPLETE THE STACK**

## **✅ PERFECT CHOICE - COMPLETE PRODUCTION-READY ENDPOINT**

Political parties need **HTTP API endpoints** to integrate with their systems. Let's build the complete stack:

**HTTP Request → Controller → Handler → Repository → Database**

---

## **📋 PHASE 3: API LAYER IMPLEMENTATION PLAN**

### **Week 3: Complete HTTP Layer (2-3 Days)**

#### **Day 1: Controller & Request Validation**
```bash
# 1. API Controller (Single Action - Invokable)
php artisan make:controller Http/Controllers/MemberRegistrationController --api --invokable

# 2. FormRequest Validation
php artisan make:request Http/Requests/RegisterMemberRequest --context=Membership

# 3. API Resource (Response Format)
php artisan make:resource Http/Resources/MemberResource --context=Membership
```

#### **Day 2: Routes & Integration Testing**
```bash
# 1. API Routes
touch routes/membership.php

# 2. API Integration Test
php artisan make:test Feature/MemberRegistrationApiTest

# 3. Error Handling
php artisan make:exception Http/Exceptions/MemberRegistrationException --context=Membership
```

#### **Day 3: OpenAPI Documentation & Deployment**
```bash
# 1. OpenAPI Specification
mkdir -p api-docs/membership/v1
touch api-docs/membership/v1/openapi.yaml

# 2. README Documentation
touch docs/api/membership-registration.md

# 3. Postman Collection
# Generate from OpenAPI spec
```

---

## **📁 FILE 1: MEMBER REGISTRATION CONTROLLER**

### **Command:** `php artisan make:controller Http/Controllers/MemberRegistrationController --api --invokable`

**File:** `app/Contexts/Membership/Http/Controllers/MemberRegistrationController.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Http\Controllers;

use App\Contexts\Membership\Application\Commands\RegisterMemberCommand;
use App\Contexts\Membership\Application\Handlers\RegisterMemberHandler;
use App\Contexts\Membership\Domain\ValueObjects\Email;
use App\Contexts\Membership\Http\Requests\RegisterMemberRequest;
use App\Contexts\Membership\Http\Resources\MemberResource;
use Illuminate\Http\JsonResponse;

/**
 * Member Registration Controller
 *
 * Single-action controller for member registration.
 *
 * Flow:
 * 1. Request validation → RegisterMemberRequest
 * 2. Command creation → RegisterMemberCommand
 * 3. Business orchestration → RegisterMemberHandler
 * 4. Response formatting → MemberResource
 *
 * Status Codes:
 * - 201 Created: Member registered successfully
 * - 422 Unprocessable Entity: Validation errors
 * - 400 Bad Request: Business rule violations
 * - 401 Unauthorized: Missing/invalid authentication
 */
class MemberRegistrationController
{
    public function __construct(
        private readonly RegisterMemberHandler $handler
    ) {}

    public function __invoke(RegisterMemberRequest $request): JsonResponse
    {
        // Create command from validated request
        $command = new RegisterMemberCommand(
            tenantUserId: $request->validated('tenant_user_id'),
            tenantId: $request->validated('tenant_id'),
            fullName: $request->validated('full_name'),
            email: new Email($request->validated('email')),
            phone: $request->validated('phone'),
            memberId: $request->validated('member_id'),
            geoReference: $request->validated('geo_reference')
        );

        // Execute business logic
        $member = $this->handler->handle($command);

        // Return formatted response
        return response()->json([
            'data' => new MemberResource($member),
            'message' => 'Member registered successfully. Status: ' . $member->status->value(),
            'links' => [
                'self' => route('members.show', $member->id),
                'approval' => $member->status->isPending() 
                    ? route('members.approve', $member->id) 
                    : null,
            ]
        ], 201);
    }
}
```

---

## **📁 FILE 2: REGISTER MEMBER REQUEST VALIDATION**

### **Command:** `php artisan make:request Http/Requests/RegisterMemberRequest --context=Membership`

**File:** `app/Contexts/Membership/Http/Requests/RegisterMemberRequest.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Register Member Request
 *
 * HTTP request validation for member registration.
 * Focuses on INPUT validation, not business rules.
 *
 * Business rules are enforced in:
 * - RegisterMemberHandler (application layer)
 * - Member aggregate (domain layer)
 */
class RegisterMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Tenant validation: Request must come from authenticated tenant
        // In production, this would validate tenant_id matches authenticated tenant
        return true; // Simplified for now
    }

    public function rules(): array
    {
        return [
            'tenant_user_id' => [
                'required',
                'string',
                'max:36', // ULID length
                'regex:/^[0-9A-Z]{26}$/', // ULID format
            ],
            
            'tenant_id' => [
                'required',
                'string',
                'max:50',
                'exists:landlord.tenants,id', // Validate tenant exists
            ],
            
            'full_name' => [
                'required',
                'string',
                'min:2',
                'max:255',
            ],
            
            'email' => [
                'required',
                'email:rfc,dns',
                'max:255',
            ],
            
            'phone' => [
                'nullable',
                'string',
                'max:20',
                'regex:/^[0-9\s\-\+\(\)]+$/',
            ],
            
            'member_id' => [
                'nullable',
                'string',
                'max:50',
                'regex:/^[A-Z0-9\-_]+$/i', // Alphanumeric, hyphens, underscores
            ],
            
            'geo_reference' => [
                'nullable',
                'string',
                'max:255',
                'regex:/^[a-z]{2}(\.[0-9]+)+$/', // Format: np.3.15.234.1.2
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'tenant_user_id.regex' => 'Tenant user ID must be a valid ULID format',
            'tenant_id.exists' => 'The specified tenant does not exist',
            'member_id.regex' => 'Member ID can only contain letters, numbers, hyphens, and underscores',
            'geo_reference.regex' => 'Geography reference must be in format: country.level1.level2...',
        ];
    }

    public function attributes(): array
    {
        return [
            'tenant_user_id' => 'tenant user ID',
            'tenant_id' => 'tenant ID',
            'full_name' => 'full name',
            'member_id' => 'member ID',
            'geo_reference' => 'geography reference',
        ];
    }
}
```

---

## **📁 FILE 3: MEMBER API RESOURCE**

### **Command:** `php artisan make:resource Http/Resources/MemberResource --context=Membership`

**File:** `app/Contexts/Membership/Http/Resources/MemberResource.php`
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Member Resource
 *
 * API response formatting for Member aggregate.
 * Controls what data is exposed via API.
 *
 * Follows JSON:API-like structure:
 * - Data object with attributes
 * - Links for HATEOAS
 * - Metadata for additional context
 */
class MemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'type' => 'members',
            'id' => $this->id,
            
            'attributes' => [
                'member_id' => $this->member_id?->value() ?? null,
                'tenant_user_id' => $this->tenant_user_id,
                'tenant_id' => $this->tenant_id,
                'status' => $this->status->value(),
                'membership_type' => $this->membership_type,
                'personal_info' => $this->personal_info->toArray(),
                'residence_geo_reference' => $this->residence_geo_reference,
                'created_at' => $this->created_at->toIso8601String(),
                'updated_at' => $this->updated_at->toIso8601String(),
            ],
            
            'links' => [
                'self' => route('members.show', $this->id),
                'approve' => $this->status->canBeApproved() 
                    ? route('members.approve', $this->id) 
                    : null,
                'activate' => $this->status->canBeActivated()
                    ? route('members.activate', $this->id)
                    : null,
            ],
            
            'meta' => [
                'can_vote' => $this->canVote(),
                'can_hold_committee_role' => $this->canHoldCommitteeRole(),
                'lifecycle_stage' => $this->getLifecycleStage(),
            ],
        ];
    }

    /**
     * Get additional data for the response
     */
    public function with(Request $request): array
    {
        return [
            'meta' => [
                'api_version' => '1.0.0',
                'context' => 'membership',
                'copyright' => '© ' . date('Y') . ' Political Party OS',
            ],
        ];
    }
}
```

---

## **🎯 READY TO IMPLEMENT:**

**Start with Day 1 files:**

1. **Controller** - HTTP endpoint orchestration
2. **FormRequest** - Input validation
3. **Resource** - Response formatting

**Then create API routes and integration tests.**

**Proceed with creating the Controller first?**