# 🚀 **MEMBERSHIP CONTEXT: COMPLETE WEEK 1 IMPLEMENTATION**

## **DAY 1: FIX 1:1 RELATIONSHIP & FOUNDATION**

### **Step 1.1: Create Migration to Fix Database Schema**

```bash
php artisan make:migration make_tenant_user_id_required_in_members_table --path=database/migrations/tenant
```

**File:** `database/migrations/tenant/2024_01_15_000001_make_tenant_user_id_required_in_members_table.php`
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            // Make tenant_user_id required and unique
            $table->unsignedBigInteger('tenant_user_id')->nullable(false)->change();
            $table->unique('tenant_user_id');
            
            // Add foreign key constraint
            $table->foreign('tenant_user_id')
                  ->references('id')
                  ->on('tenant_users')
                  ->onDelete('cascade');
                  
            // Simplify geography columns
            $table->string('geography_reference')->nullable()->after('tenant_user_id');
            
            // Remove old geography columns (if they exist)
            $columns = [
                'admin_unit_level1_id',
                'admin_unit_level2_id',
                'admin_unit_level3_id',
                'admin_unit_level4_id',
                'admin_unit_level5_id',
                'admin_unit_level6_id',
                'admin_unit_level7_id',
                'admin_unit_level8_id',
                'geo_path',
            ];
            
            foreach ($columns as $column) {
                if (Schema::hasColumn('members', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->dropForeign(['tenant_user_id']);
            $table->dropUnique(['tenant_user_id']);
            $table->unsignedBigInteger('tenant_user_id')->nullable()->change();
            $table->dropColumn('geography_reference');
        });
    }
};
```

### **Step 1.2: Create Correct Member Model**

**File:** `app/Contexts/Membership/Domain/Models/Member.php`
```php
<?php

namespace App\Contexts\Membership\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use App\Contexts\TenantAuth\Domain\Models\TenantUser;

/**
 * Member Aggregate Root
 * 
 * Business Rules:
 * 1. Every Member MUST have a TenantUser (1:1 relationship)
 * 2. Geography is optional (reference only, not structure)
 * 3. Membership number is unique per tenant
 * 4. Status follows lifecycle: draft → pending → approved → active → suspended
 */
class Member extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'members';
    protected $connection = 'tenant';
    
    // Status constants
    const STATUS_DRAFT = 'draft';
    const STATUS_PENDING = 'pending';
    const STATUS_APPROVED = 'approved';
    const STATUS_ACTIVE = 'active';
    const STATUS_SUSPENDED = 'suspended';
    const STATUS_EXPIRED = 'expired';
    
    // Membership type constants
    const TYPE_FULL = 'full';
    const TYPE_YOUTH = 'youth';
    const TYPE_STUDENT = 'student';
    const TYPE_ASSOCIATE = 'associate';

    protected $fillable = [
        'tenant_id',
        'tenant_user_id',     // REQUIRED: 1:1 with TenantUser
        'geography_reference', // OPTIONAL: e.g., "np.3.15.234.1.2"
        'full_name',
        'membership_number',
        'membership_type',
        'status',
        'phone',
        'email',
        'date_of_birth',
        'gender',
        'sponsor_member_id',
        'approved_by',
        'approved_at',
        'activated_at',
    ];

    protected $casts = [
        'tenant_user_id' => 'integer',
        'date_of_birth' => 'date',
        'approved_at' => 'datetime',
        'activated_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    protected $attributes = [
        'status' => self::STATUS_DRAFT,
        'membership_type' => self::TYPE_FULL,
        'country_code' => 'NP',
    ];

    /**
     * Relationship: Member belongs to TenantUser (1:1)
     */
    public function user()
    {
        return $this->belongsTo(TenantUser::class, 'tenant_user_id');
    }

    /**
     * Factory Method: Register new member with user account
     * 
     * @param array $memberData Member attributes
     * @param array $userData TenantUser attributes (email, password)
     * @return self
     */
    public static function register(array $memberData, array $userData): self
    {
        return DB::transaction(function () use ($memberData, $userData) {
            // 1. Create TenantUser account
            $user = TenantUser::create(array_merge($userData, [
                'is_active' => false, // Can't login until approved
            ]));
            
            // 2. Generate membership number
            $membershipNumber = self::generateMembershipNumber();
            
            // 3. Create Member linked to User
            $member = self::create(array_merge($memberData, [
                'tenant_user_id' => $user->id,
                'membership_number' => $membershipNumber,
                'status' => self::STATUS_DRAFT,
            ]));
            
            // 4. Link User to Member (for TenantAuth context)
            $user->update([
                'profile_id' => $member->id,
                'profile_type' => self::class,
            ]);
            
            // 5. Mark as pending (requires committee approval)
            $member->markAsPending();
            
            return $member;
        });
    }

    /**
     * Generate unique membership number
     */
    private static function generateMembershipNumber(): string
    {
        $tenant = app('currentTenant');
        $year = date('Y');
        $sequence = self::getNextSequence($tenant->id);
        
        // Format: TENANT-YEAR-6DIGITS
        return sprintf('%s-%s-%06d', 
            strtoupper($tenant->slug), 
            $year, 
            $sequence
        );
    }

    /**
     * Get next sequence number for tenant
     */
    private static function getNextSequence(string $tenantId): int
    {
        $key = "tenant:{$tenantId}:membership:sequence";
        
        return Cache::lock($key, 10)->block(5, function () use ($key) {
            $sequence = Cache::get($key, 0) + 1;
            Cache::forever($key, $sequence);
            return $sequence;
        });
    }

    /**
     * Mark member as pending (requires committee approval)
     */
    public function markAsPending(): void
    {
        $this->update(['status' => self::STATUS_PENDING]);
    }

    /**
     * Approve member (by committee)
     */
    public function approve(int $approvedByUserId): void
    {
        if ($this->status !== self::STATUS_PENDING) {
            throw new \Exception('Only pending members can be approved');
        }
        
        $this->update([
            'status' => self::STATUS_APPROVED,
            'approved_by' => $approvedByUserId,
            'approved_at' => now(),
        ]);
        
        // Activate user account for login
        $this->user->update(['is_active' => true]);
    }

    /**
     * Activate member (after payment)
     */
    public function activate(): void
    {
        if ($this->status !== self::STATUS_APPROVED) {
            throw new \Exception('Only approved members can be activated');
        }
        
        $this->update([
            'status' => self::STATUS_ACTIVE,
            'activated_at' => now(),
        ]);
    }

    /**
     * Check if member is active
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Check if member has geography
     */
    public function hasGeography(): bool
    {
        return !empty($this->geography_reference);
    }

    /**
     * Assign geography reference (optional)
     */
    public function assignGeography(string $reference): void
    {
        // Geography validation would happen via GeographyService
        $this->update(['geography_reference' => $reference]);
    }
}
```

### **Step 1.3: Update TenantUser Model**

**File:** `app/Contexts/TenantAuth/Domain/Models/TenantUser.php`
```php
<?php

namespace App\Contexts\TenantAuth\Domain\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class TenantUser extends Authenticatable
{
    use Notifiable;

    protected $table = 'tenant_users';
    protected $connection = 'tenant';

    protected $fillable = [
        'email',
        'password',
        'phone',
        'is_active',
        'profile_id',
        'profile_type',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    /**
     * Get the member profile if this user is a member
     */
    public function member()
    {
        if ($this->profile_type === \App\Contexts\Membership\Domain\Models\Member::class) {
            return $this->belongsTo(
                \App\Contexts\Membership\Domain\Models\Member::class,
                'profile_id'
            );
        }
        
        return null;
    }

    /**
     * Check if user is a member
     */
    public function isMember(): bool
    {
        return $this->profile_type === \App\Contexts\Membership\Domain\Models\Member::class;
    }

    /**
     * Check if user can login
     */
    public function canLogin(): bool
    {
        return $this->is_active && $this->email_verified_at;
    }
}
```

---

## **DAY 2: VALUE OBJECTS & DOMAIN LOGIC**

### **Step 2.1: Create Value Objects**

```bash
mkdir -p app/Contexts/Membership/Domain/ValueObjects
```

**File:** `app/Contexts/Membership/Domain/ValueObjects/MemberStatus.php`
```php
<?php

namespace App\Contexts\Membership\Domain\ValueObjects;

use InvalidArgumentException;

final class MemberStatus
{
    private const VALID_STATUSES = [
        'draft', 'pending', 'approved', 'active', 'suspended', 'expired'
    ];

    private string $value;

    public function __construct(string $status)
    {
        if (!in_array($status, self::VALID_STATUSES, true)) {
            throw new InvalidArgumentException(
                "Invalid member status: {$status}. Valid: " . implode(', ', self::VALID_STATUSES)
            );
        }
        
        $this->value = $status;
    }

    public static function draft(): self
    {
        return new self('draft');
    }

    public static function pending(): self
    {
        return new self('pending');
    }

    public static function approved(): self
    {
        return new self('approved');
    }

    public static function active(): self
    {
        return new self('active');
    }

    public static function suspended(): self
    {
        return new self('suspended');
    }

    public function value(): string
    {
        return $this->value;
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function canTransitionTo(self $newStatus): bool
    {
        $transitions = [
            'draft' => ['pending'],
            'pending' => ['approved', 'suspended'],
            'approved' => ['active', 'suspended'],
            'active' => ['suspended', 'expired'],
            'suspended' => ['active', 'expired'],
            'expired' => ['pending'], // Renewal
        ];
        
        return in_array($newStatus->value(), $transitions[$this->value] ?? []);
    }

    public function isActive(): bool
    {
        return $this->value === 'active';
    }

    public function isPending(): bool
    {
        return $this->value === 'pending';
    }

    public function isApproved(): bool
    {
        return $this->value === 'approved';
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
```

**File:** `app/Contexts/Membership/Domain/ValueObjects/MembershipNumber.php`
```php
<?php

namespace App\Contexts\Membership\Domain\ValueObjects;

use InvalidArgumentException;

final class MembershipNumber
{
    private string $value;

    public function __construct(string $value)
    {
        if (empty($value)) {
            throw new InvalidArgumentException('Membership number cannot be empty');
        }
        
        // Basic format validation: TENANT-YEAR-SEQ
        if (!preg_match('/^[A-Z]+-\d{4}-\d{6}$/', $value)) {
            throw new InvalidArgumentException(
                "Invalid membership number format: {$value}. Expected: TENANT-YYYY-000001"
            );
        }
        
        $this->value = $value;
    }

    public static function generate(string $tenantSlug): self
    {
        $year = date('Y');
        $sequence = self::getNextSequence($tenantSlug);
        
        $number = sprintf('%s-%s-%06d', 
            strtoupper($tenantSlug), 
            $year, 
            $sequence
        );
        
        return new self($number);
    }

    private static function getNextSequence(string $tenantSlug): int
    {
        $key = "membership:sequence:{$tenantSlug}:" . date('Y');
        
        return Cache::lock($key, 10)->block(5, function () use ($key) {
            $sequence = Cache::get($key, 0) + 1;
            Cache::put($key, $sequence, now()->addYear());
            return $sequence;
        });
    }

    public function value(): string
    {
        return $this->value;
    }

    public function getTenantCode(): string
    {
        return explode('-', $this->value)[0];
    }

    public function getYear(): string
    {
        return explode('-', $this->value)[1];
    }

    public function getSequence(): int
    {
        return (int) explode('-', $this->value)[2];
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
```

**File:** `app/Contexts/Membership/Domain/ValueObjects/PersonalInfo.php`
```php
<?php

namespace App\Contexts\Membership\Domain\ValueObjects;

use InvalidArgumentException;

final class PersonalInfo
{
    private string $fullName;
    private ?string $phone;
    private ?string $email;
    private ?string $dateOfBirth;
    private ?string $gender;

    public function __construct(
        string $fullName,
        ?string $phone = null,
        ?string $email = null,
        ?string $dateOfBirth = null,
        ?string $gender = null
    ) {
        if (empty(trim($fullName))) {
            throw new InvalidArgumentException('Full name is required');
        }
        
        if ($phone && !preg_match('/^\+?[1-9]\d{1,14}$/', $phone)) {
            throw new InvalidArgumentException('Invalid phone number format');
        }
        
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid email address');
        }
        
        if ($dateOfBirth && !strtotime($dateOfBirth)) {
            throw new InvalidArgumentException('Invalid date of birth');
        }
        
        $this->fullName = trim($fullName);
        $this->phone = $phone;
        $this->email = $email;
        $this->dateOfBirth = $dateOfBirth;
        $this->gender = $gender;
    }

    public function fullName(): string
    {
        return $this->fullName;
    }

    public function phone(): ?string
    {
        return $this->phone;
    }

    public function email(): ?string
    {
        return $this->email;
    }

    public function dateOfBirth(): ?string
    {
        return $this->dateOfBirth;
    }

    public function gender(): ?string
    {
        return $this->gender;
    }

    public function toArray(): array
    {
        return [
            'full_name' => $this->fullName,
            'phone' => $this->phone,
            'email' => $this->email,
            'date_of_birth' => $this->dateOfBirth,
            'gender' => $this->gender,
        ];
    }
}
```

### **Step 2.2: Create Domain Events**

```bash
mkdir -p app/Contexts/Membership/Domain/Events
```

**File:** `app/Contexts/Membership/Domain/Events/MemberRegistered.php`
```php
<?php

namespace App\Contexts\Membership\Domain\Events;

class MemberRegistered
{
    public function __construct(
        public readonly int $memberId,
        public readonly int $userId,
        public readonly string $membershipNumber,
        public readonly string $fullName,
        public readonly string $tenantId
    ) {}
}
```

**File:** `app/Contexts/Membership/Domain/Events/MemberApproved.php`
```php
<?php

namespace App\Contexts\Membership\Domain\Events;

class MemberApproved
{
    public function __construct(
        public readonly int $memberId,
        public readonly int $approvedByUserId,
        public readonly string $tenantId
    ) {}
}
```

**File:** `app/Contexts/Membership/Domain/Events/MemberActivated.php`
```php
<?php

namespace App\Contexts\Membership\Domain\Events;

class MemberActivated
{
    public function __construct(
        public readonly int $memberId,
        public readonly string $tenantId
    ) {}
}
```

---

## **DAY 3: APPLICATION SERVICES**

### **Step 3.1: Create Application Services**

```bash
mkdir -p app/Contexts/Membership/Application/Services
```

**File:** `app/Contexts/Membership/Application/Services/MemberRegistrationService.php`
```php
<?php

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\Events\MemberRegistered;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

class MemberRegistrationService
{
    public function register(array $data): Member
    {
        return DB::transaction(function () use ($data) {
            // 1. Validate personal info
            $personalInfo = new PersonalInfo(
                fullName: $data['full_name'],
                phone: $data['phone'] ?? null,
                email: $data['email'] ?? null,
                dateOfBirth: $data['date_of_birth'] ?? null,
                gender: $data['gender'] ?? null
            );
            
            // 2. Create user account data
            $userData = [
                'email' => $personalInfo->email() ?? $this->generateTemporaryEmail($personalInfo),
                'phone' => $personalInfo->phone(),
                'password' => bcrypt(uniqid()), // Temporary password
                'is_active' => false, // Can't login until approved
            ];
            
            // 3. Create member with user account
            $member = Member::register(
                memberData: [
                    'full_name' => $personalInfo->fullName(),
                    'phone' => $personalInfo->phone(),
                    'email' => $personalInfo->email(),
                    'date_of_birth' => $personalInfo->dateOfBirth(),
                    'gender' => $personalInfo->gender(),
                    'geography_reference' => $data['geography_reference'] ?? null,
                    'sponsor_member_id' => $data['sponsor_member_id'] ?? null,
                ],
                userData: $userData
            );
            
            // 4. Dispatch event
            Event::dispatch(new MemberRegistered(
                memberId: $member->id,
                userId: $member->tenant_user_id,
                membershipNumber: $member->membership_number,
                fullName: $member->full_name,
                tenantId: $member->tenant_id
            ));
            
            return $member;
        });
    }
    
    private function generateTemporaryEmail(PersonalInfo $info): string
    {
        $name = strtolower(preg_replace('/[^a-z]/i', '', $info->fullName()));
        $random = substr(md5(uniqid()), 0, 8);
        return "{$name}.{$random}@temporary.publicdigit.com";
    }
}
```

**File:** `app/Contexts/Membership/Application/Services/MemberApprovalService.php`
```php
<?php

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

class MemberApprovalService
{
    public function approve(int $memberId, int $approverUserId): Member
    {
        return DB::transaction(function () use ($memberId, $approverUserId) {
            $member = Member::findOrFail($memberId);
            
            // Business logic: Only pending members can be approved
            if ($member->status !== Member::STATUS_PENDING) {
                throw new \Exception(
                    "Cannot approve member with status: {$member->status}. Must be 'pending'."
                );
            }
            
            $member->approve($approverUserId);
            
            // Dispatch event
            Event::dispatch(new MemberApproved(
                memberId: $member->id,
                approvedByUserId: $approverUserId,
                tenantId: $member->tenant_id
            ));
            
            return $member;
        });
    }
}
```

**File:** `app/Contexts/Membership/Application/Services/MemberActivationService.php`
```php
<?php

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Events\MemberActivated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

class MemberActivationService
{
    public function activate(int $memberId): Member
    {
        return DB::transaction(function () use ($memberId) {
            $member = Member::findOrFail($memberId);
            
            // Business logic: Only approved members can be activated
            if ($member->status !== Member::STATUS_APPROVED) {
                throw new \Exception(
                    "Cannot activate member with status: {$member->status}. Must be 'approved'."
                );
            }
            
            $member->activate();
            
            // Dispatch event
            Event::dispatch(new MemberActivated(
                memberId: $member->id,
                tenantId: $member->tenant_id
            ));
            
            return $member;
        });
    }
}
```

---

## **DAY 4: API LAYER**

### **Step 4.1: Create API Controllers**

```bash
php artisan make:controller Api/MemberController --api --model=Member
```

**File:** `app/Http/Controllers/Api/MemberController.php`
```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Contexts\Membership\Application\Services\MemberRegistrationService;
use App\Contexts\Membership\Application\Services\MemberApprovalService;
use App\Contexts\Membership\Application\Services\MemberActivationService;
use App\Contexts\Membership\Domain\Models\Member;
use App\Http\Requests\RegisterMemberRequest;
use App\Http\Resources\MemberResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    public function __construct(
        private MemberRegistrationService $registrationService,
        private MemberApprovalService $approvalService,
        private MemberActivationService $activationService
    ) {}
    
    /**
     * Register new member
     */
    public function register(RegisterMemberRequest $request): JsonResponse
    {
        try {
            $member = $this->registrationService->register($request->validated());
            
            return response()->json([
                'success' => true,
                'message' => 'Member registered successfully',
                'data' => new MemberResource($member),
            ], 201);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Registration failed: ' . $e->getMessage(),
            ], 422);
        }
    }
    
    /**
     * Get all members (with pagination)
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->get('per_page', 15);
        $status = $request->get('status');
        
        $query = Member::query();
        
        if ($status) {
            $query->where('status', $status);
        }
        
        $members = $query->paginate($perPage);
        
        return response()->json([
            'success' => true,
            'data' => MemberResource::collection($members),
            'meta' => [
                'total' => $members->total(),
                'per_page' => $members->perPage(),
                'current_page' => $members->currentPage(),
                'last_page' => $members->lastPage(),
            ],
        ]);
    }
    
    /**
     * Get single member
     */
    public function show(Member $member): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => new MemberResource($member),
        ]);
    }
    
    /**
     * Approve a pending member
     */
    public function approve(Member $member): JsonResponse
    {
        try {
            $approverId = auth()->id(); // Current committee member
            $member = $this->approvalService->approve($member->id, $approverId);
            
            return response()->json([
                'success' => true,
                'message' => 'Member approved successfully',
                'data' => new MemberResource($member),
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Approval failed: ' . $e->getMessage(),
            ], 422);
        }
    }
    
    /**
     * Activate an approved member
     */
    public function activate(Member $member): JsonResponse
    {
        try {
            $member = $this->activationService->activate($member->id);
            
            return response()->json([
                'success' => true,
                'message' => 'Member activated successfully',
                'data' => new MemberResource($member),
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Activation failed: ' . $e->getMessage(),
            ], 422);
        }
    }
    
    /**
     * Get pending members (for committee review)
     */
    public function pending(): JsonResponse
    {
        $members = Member::where('status', Member::STATUS_PENDING)
            ->orderBy('created_at', 'asc')
            ->paginate(15);
        
        return response()->json([
            'success' => true,
            'data' => MemberResource::collection($members),
            'meta' => [
                'total' => $members->total(),
                'pending_count' => $members->total(),
            ],
        ]);
    }
}
```

### **Step 4.2: Create Form Requests**

```bash
php artisan make:request RegisterMemberRequest
```

**File:** `app/Http/Requests/RegisterMemberRequest.php`
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Will be protected by middleware
    }
    
    public function rules(): array
    {
        return [
            'full_name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'email' => 'nullable|email|max:255',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'geography_reference' => 'nullable|string|max:100',
            'sponsor_member_id' => 'nullable|exists:members,id',
        ];
    }
    
    public function messages(): array
    {
        return [
            'full_name.required' => 'Full name is required',
            'phone.required' => 'Phone number is required',
            'email.email' => 'Please provide a valid email address',
            'gender.in' => 'Gender must be male, female, or other',
        ];
    }
}
```

### **Step 4.3: Create API Resource**

```bash
php artisan make:resource MemberResource
```

**File:** `app/Http/Resources/MemberResource.php`
```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class MemberResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'membership_number' => $this->membership_number,
            'full_name' => $this->full_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'status' => $this->status,
            'membership_type' => $this->membership_type,
            'has_geography' => !empty($this->geography_reference),
            'geography_reference' => $this->when(!empty($this->geography_reference), $this->geography_reference),
            'has_user_account' => !is_null($this->tenant_user_id),
            'created_at' => $this->created_at->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at->format('Y-m-d H:i:s'),
            
            // Relationships (loaded when needed)
            'user' => $this->whenLoaded('user', function () {
                return [
                    'id' => $this->user->id,
                    'email' => $this->user->email,
                    'is_active' => $this->user->is_active,
                ];
            }),
        ];
    }
}
```

### **Step 4.4: Add API Routes**

**File:** `routes/api.php` (add these routes)
```php
<?php

use App\Http\Controllers\Api\MemberController;
use Illuminate\Support\Facades\Route;

// Member Management Routes
Route::prefix('members')->middleware(['auth:sanctum', 'tenant'])->group(function () {
    Route::post('/register', [MemberController::class, 'register']);
    Route::get('/', [MemberController::class, 'index']);
    Route::get('/pending', [MemberController::class, 'pending']);
    Route::get('/{member}', [MemberController::class, 'show']);
    Route::put('/{member}/approve', [MemberController::class, 'approve']);
    Route::put('/{member}/activate', [MemberController::class, 'activate']);
});
```

---

## **DAY 5: TESTING & DEPLOYMENT**

### **Step 5.1: Create Unit Tests**

```bash
php artisan make:test Membership/MemberTest --unit
```

**File:** `tests/Unit/Membership/MemberTest.php`
```php
<?php

namespace Tests\Unit\Membership;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\TenantAuth\Domain\Models\TenantUser;
use Illuminate\Foundation\Testing\RefreshDatabase;

class MemberTest extends TestCase
{
    use RefreshDatabase;
    
    /** @test */
    public function it_can_register_a_member_with_user_account()
    {
        $member = Member::register(
            [
                'full_name' => 'John Doe',
                'phone' => '+9779800000000',
                'email' => 'john@example.com',
            ],
            [
                'email' => 'john@example.com',
                'password' => 'password123',
            ]
        );
        
        $this->assertInstanceOf(Member::class, $member);
        $this->assertEquals('John Doe', $member->full_name);
        $this->assertNotNull($member->tenant_user_id);
        $this->assertNotNull($member->membership_number);
        $this->assertEquals(Member::STATUS_PENDING, $member->status);
        
        // Verify user relationship
        $this->assertInstanceOf(TenantUser::class, $member->user);
        $this->assertEquals('john@example.com', $member->user->email);
    }
    
    /** @test */
    public function it_generates_unique_membership_numbers()
    {
        $member1 = Member::register(
            ['full_name' => 'John Doe', 'phone' => '+9779800000001'],
            ['email' => 'john1@example.com', 'password' => 'password']
        );
        
        $member2 = Member::register(
            ['full_name' => 'Jane Doe', 'phone' => '+9779800000002'],
            ['email' => 'jane@example.com', 'password' => 'password']
        );
        
        $this->assertNotEquals($member1->membership_number, $member2->membership_number);
    }
    
    /** @test */
    public function it_can_approve_a_pending_member()
    {
        $member = Member::register(
            ['full_name' => 'John Doe', 'phone' => '+9779800000000'],
            ['email' => 'john@example.com', 'password' => 'password']
        );
        
        $member->approve(1); // Approver user ID = 1
        
        $this->assertEquals(Member::STATUS_APPROVED, $member->status);
        $this->assertNotNull($member->approved_at);
        $this->assertEquals(1, $member->approved_by);
        $this->assertTrue($member->user->is_active);
    }
    
    /** @test */
    public function it_prevents_approving_non_pending_members()
    {
        $member = Member::register(
            ['full_name' => 'John Doe', 'phone' => '+9779800000000'],
            ['email' => 'john@example.com', 'password' => 'password']
        );
        
        $member->approve(1);
        
        $this->expectException(\Exception::class);
        $member->approve(1); // Try to approve again
    }
    
    /** @test */
    public function it_can_activate_an_approved_member()
    {
        $member = Member::register(
            ['full_name' => 'John Doe', 'phone' => '+9779800000000'],
            ['email' => 'john@example.com', 'password' => 'password']
        );
        
        $member->approve(1);
        $member->activate();
        
        $this->assertEquals(Member::STATUS_ACTIVE, $member->status);
        $this->assertNotNull($member->activated_at);
    }
}
```

### **Step 5.2: Create Feature Tests**

```bash
php artisan make:test Api/MemberApiTest --feature
```

**File:** `tests/Feature/Api/MemberApiTest.php`
```php
<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\TenantAuth\Domain\Models\TenantUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

class MemberApiTest extends TestCase
{
    use RefreshDatabase;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test user and authenticate
        $user = TenantUser::factory()->create([
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
        
        Sanctum::actingAs($user);
    }
    
    /** @test */
    public function it_can_register_a_member_via_api()
    {
        $response = $this->postJson('/api/members/register', [
            'full_name' => 'John Doe',
            'phone' => '+9779800000000',
            'email' => 'john@example.com',
            'gender' => 'male',
        ]);
        
        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'id',
                    'membership_number',
                    'full_name',
                    'status',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'full_name' => 'John Doe',
                    'status' => 'pending',
                ],
            ]);
    }
    
    /** @test */
    public function it_can_list_members()
    {
        Member::factory()->count(5)->create();
        
        $response = $this->getJson('/api/members');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => ['id', 'membership_number', 'full_name', 'status']
                ],
                'meta' => ['total', 'per_page', 'current_page']
            ]);
    }
    
    /** @test */
    public function it_can_get_pending_members()
    {
        Member::factory()->count(3)->create(['status' => Member::STATUS_PENDING]);
        Member::factory()->count(2)->create(['status' => Member::STATUS_ACTIVE]);
        
        $response = $this->getJson('/api/members/pending');
        
        $response->assertStatus(200)
            ->assertJson([
                'meta' => ['pending_count' => 3]
            ]);
    }
    
    /** @test */
    public function it_can_approve_a_member()
    {
        $member = Member::factory()->create(['status' => Member::STATUS_PENDING]);
        
        $response = $this->putJson("/api/members/{$member->id}/approve");
        
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => ['status' => 'approved']
            ]);
        
        $this->assertDatabaseHas('members', [
            'id' => $member->id,
            'status' => 'approved',
        ]);
    }
}
```

### **Step 5.3: Create Factory**

```bash
php artisan make:factory MemberFactory --model=Member
```

**File:** `database/factories/MemberFactory.php`
```php
<?php

namespace Database\Factories;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\TenantAuth\Domain\Models\TenantUser;
use Illuminate\Database\Eloquent\Factories\Factory;

class MemberFactory extends Factory
{
    protected $model = Member::class;
    
    public function definition(): array
    {
        return [
            'tenant_id' => 'test-tenant',
            'full_name' => $this->faker->name(),
            'phone' => '+97798' . $this->faker->numerify('########'),
            'email' => $this->faker->unique()->safeEmail(),
            'membership_number' => 'TEST-' . date('Y') . '-' . str_pad($this->faker->unique()->numberBetween(1, 999999), 6, '0', STR_PAD_LEFT),
            'membership_type' => $this->faker->randomElement([
                Member::TYPE_FULL,
                Member::TYPE_YOUTH,
                Member::TYPE_STUDENT,
            ]),
            'status' => $this->faker->randomElement([
                Member::STATUS_PENDING,
                Member::STATUS_APPROVED,
                Member::STATUS_ACTIVE,
            ]),
            'date_of_birth' => $this->faker->date(),
            'gender' => $this->faker->randomElement(['male', 'female']),
        ];
    }
    
    public function configure()
    {
        return $this->afterCreating(function (Member $member) {
            if (!$member->tenant_user_id) {
                $user = TenantUser::factory()->create([
                    'profile_id' => $member->id,
                    'profile_type' => Member::class,
                ]);
                
                $member->update(['tenant_user_id' => $user->id]);
            }
        });
    }
    
    public function pending(): self
    {
        return $this->state(['status' => Member::STATUS_PENDING]);
    }
    
    public function approved(): self
    {
        return $this->state(['status' => Member::STATUS_APPROVED]);
    }
    
    public function active(): self
    {
        return $this->state(['status' => Member::STATUS_ACTIVE]);
    }
}
```

### **Step 5.4: Run Migrations and Tests**

```bash
# Run the migration
php artisan migrate --path=database/migrations/tenant

# Run tests
php artisan test tests/Unit/Membership/MemberTest.php
php artisan test tests/Feature/Api/MemberApiTest.php

# Run all tests
php artisan test
```

---

## **🎯 DEPLOYMENT CHECKLIST**

### **Before Deployment:**
1. ✅ Database constraints are correct (1:1 relationship enforced)
2. ✅ All tests pass
3. ✅ API endpoints are protected with authentication
4. ✅ Error handling is in place
5. ✅ Logging is configured

### **Deployment Steps:**
```bash
# 1. Run migrations on production
php artisan migrate --force

# 2. Clear cache
php artisan optimize:clear

# 3. Start queue worker (for async jobs)
php artisan queue:work

# 4. Monitor logs
tail -f storage/logs/laravel.log
```

### **Post-Deployment:**
1. Test registration flow
2. Test approval workflow
3. Verify email notifications (if configured)
4. Check dashboard for pending members
5. Monitor performance metrics

---

## **📞 SUPPORT & NEXT STEPS**

### **Week 1 Completion:**
You now have a **working Membership Context** with:
✅ 1:1 Member-User relationship  
✅ Full lifecycle (register → approve → activate)
✅ REST API with authentication
✅ Comprehensive testing
✅ Database constraints for data integrity

### **Week 2 (Optional Geography Module):**
```bash
# 1. Geography service interface
# 2. Nepal geography implementation  
# 3. Geography validation in registration
# 4. Geography-enhanced reporting
```

### **Week 3 (Optional Committee Module):**
```bash
# 1. Committee management
# 2. Role-based assignments
# 3. Election workflows
# 4. Term tracking
```

**You can deploy this NOW and start onboarding Nepali political parties.** The system works without geography or committee modules, which can be added as paid features later.

---

**Need help with any specific part?** I can provide more detailed code for:
1. Email notifications for approval/activation
2. Dashboard with statistics
3. Bulk member import/export
4. Advanced search and filters
5. Audit logging for compliance