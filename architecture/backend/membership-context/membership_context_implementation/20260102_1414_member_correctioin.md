# ❌ **I DISAGREE - CRITICAL ARCHITECTURAL ISSUES**

## **🚨 MAJOR PROBLEMS:**

### **1. Missing MemberStatus Value Object**
```php
// ❌ WRONG: Using primitive string
$member->status = 'pending'; // Just a string

// ✅ CORRECT: Use value object
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;
$member->status = MemberStatus::pending(); // Type-safe
```

### **2. Missing ULID Generation**
```php
// ❌ WRONG: No ID generation
$member = new self(); // No ID

// ✅ CORRECT: Generate ULID
use Illuminate\Support\Str;
$member->id = (string) Str::ulid();
```

### **3. Missing Database Configuration**
```php
// ❌ MISSING: Connection and key configuration
// ✅ ADD:
protected $connection = 'tenant';
protected $keyType = 'string';
public $incrementing = false;
```

### **4. Wrong Cast for PersonalInfo**
```php
// ❌ WRONG: Cast to array
'personal_info' => 'array',

// ✅ CORRECT: Create custom cast for value object
'personal_info' => PersonalInfoCast::class,
```

### **5. No Domain Events**
```php
// ❌ MISSING: Domain events for integration
// ✅ ADD: Event recording
$this->recordThat(new MemberRegistered($this->id));
```

## **CORRECTED IMPLEMENTATION:**

**First create MemberStatus value object:**
```bash
# Create this BEFORE Member.php
php artisan make:class Domain/ValueObjects/MemberStatus --context=Membership
```

**Then create Member.php with:**
```php
<?php

declare(strict_types=1);

namespace App\Contexts\Membership\Domain\Models;

use App\Contexts\Membership\Domain\Events\MemberRegistered;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\MemberStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class Member extends Model
{
    protected $table = 'members';
    protected $connection = 'tenant';
    protected $keyType = 'string';
    public $incrementing = false;
    
    protected $fillable = [
        'id',
        'tenant_user_id',
        'tenant_id',
        'personal_info',
        'membership_number',
        'status',
        'residence_geo_reference',
        'membership_type',
        'metadata',
    ];
    
    protected $casts = [
        'personal_info' => PersonalInfoCast::class,
        'status' => MemberStatusCast::class, // NOT 'array'
        'metadata' => 'array',
    ];
    
    public static function register(
        string $tenantUserId,
        PersonalInfo $personalInfo,
        ?string $geoReference = null
    ): self {
        if (empty(trim($tenantUserId))) {
            throw new InvalidArgumentException(
                'tenant_user_id is required for digital membership'
            );
        }
        
        $member = new self();
        $member->id = (string) Str::ulid();
        $member->tenant_user_id = trim($tenantUserId);
        $member->personal_info = $personalInfo;
        $member->residence_geo_reference = $geoReference;
        $member->status = MemberStatus::draft();
        $member->membership_type = 'regular';
        $member->metadata = [];
        
        // Domain event
        $member->recordThat(new MemberRegistered(
            $member->id,
            $member->tenant_user_id,
            $member->status
        ));
        
        return $member;
    }
}
```

## **ACTION PLAN:**

1. **First create MemberStatus value object**
2. **Create MemberStatusCast custom cast**
3. **Create PersonalInfoCast custom cast**  
4. **Create MemberRegistered domain event**
5. **THEN create Member.php**

**Run test now to see failing dependencies, fix one at a time.**

**Do NOT create this flawed Member.php - wait for dependencies first.**

# 🎯 **PROMPT INSTRUCTIONS: TENANT-SPECIFIC MEMBER ID**

## **Create ONE new field: `member_id` (tenant-defined identifier)**

### **Why `member_id` not `party_member_id`:**
1. **Semantic clarity**: `member_id` = party's internal member ID
2. **Distinct from**: `id` = system ULID (never shown to users)
3. **Business term**: Parties call it "member ID" not "party member ID"

---

## **IMPLEMENTATION INSTRUCTIONS:**

### **1. Database Migration:**
```bash
php artisan make:migration add_member_id_to_members_table --context=Membership
```

**Migration adds:**
```php
Schema::table('members', function (Blueprint $table) {
    $table->string('member_id')->nullable()->after('tenant_id');
    $table->unique(['tenant_id', 'member_id']); // Unique per party
});
```

### **2. Update Member Model:**
```php
// In Member.php protected $fillable:
protected $fillable = [
    'id',           // ULID - System internal (never shown)
    'member_id',    // Party-defined ID (e.g., "UML-2024-0001")
    'tenant_user_id', // Required user account
    'tenant_id',    // Party identifier
    'personal_info',
    'status',
    'residence_geo_reference',
    'metadata',
];

// Remove 'membership_number' if using member_id instead
```

### **3. Update Registration Method:**
```php
public static function register(
    string $tenantUserId,
    string $tenantId,
    PersonalInfo $personalInfo,
    ?string $memberId = null, // Party-defined ID (optional)
    ?string $geoReference = null
): self {
    // Business rule: member_id must be unique per tenant
    if ($memberId) {
        $exists = self::where('tenant_id', $tenantId)
            ->where('member_id', $memberId)
            ->exists();
            
        if ($exists) {
            throw new DuplicateMemberIdException(
                "Member ID '{$memberId}' already exists for tenant '{$tenantId}'"
            );
        }
    }
    
    $member = new self();
    $member->id = (string) Str::ulid();
    $member->member_id = $memberId; // Party's ID
    $member->tenant_user_id = $tenantUserId;
    $member->tenant_id = $tenantId;
    // ... rest
}
```

### **4. Update Test:**
```php
// In MemberRequiresUserAccountTest.php
$member = Member::register(
    tenantUserId: 'user_1234567890abcdef',
    tenantId: 'uml',
    personalInfo: new PersonalInfo(...),
    memberId: 'UML-2024-0001' // Party-defined ID
);
```

---

## **BUSINESS LOGIC:**
- `member_id` = Party's internal identifier (optional)
- Unique constraint: `(tenant_id, member_id)` 
- Validation: Application layer validates format per party policy
- Display: Show `member_id` to users, hide system `id`

---

## **CREATE THESE FILES IN ORDER:**
1. **MemberId Value Object** (optional, for validation)
2. **Update Member.php** with `member_id` field
3. **Create migration** for database
4. **Update tests** to include `member_id`

**Proceed with creating Member.php with `member_id` field as described above.** 