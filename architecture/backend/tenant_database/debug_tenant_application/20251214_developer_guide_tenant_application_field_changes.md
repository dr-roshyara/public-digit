# Developer Guide: Adding or Changing Fields in Tenant Application

**Date**: 2025-12-14
**Author**: Claude Code Assistant
**Based on**: Splitting `contact_name` into `first_name` and `last_name` implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
4. [File Locations & Responsibilities](#file-locations--responsibilities)
5. [Common Scenarios & Examples](#common-scenarios--examples)
6. [Testing Checklist](#testing-checklist)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

The tenant application system follows **Domain-Driven Design (DDD)** principles with a **6-case routing architecture**. When adding or modifying fields in the application form, you must update multiple layers of the application to maintain consistency and data integrity.

### Key Principles:
- **TDD First**: Write failing tests before implementation
- **DDD Compliance**: Respect bounded context boundaries
- **Universal Core Schema**: Use separate fields for first/last names, proper data types
- **Backward Compatibility**: When changing existing fields, maintain compatibility where possible

---

## Architecture Summary

### 6-Case Routing Architecture
```
CASE 1: /mapi/*           → Platform Angular Mobile API (Landlord DB)
CASE 2: /{tenant}/mapi/*  → Tenant Angular Mobile API (Tenant DB)
CASE 3: /api/*            → Platform Vue Desktop API (Landlord DB)
CASE 4: /{tenant}/api/*   → Tenant Vue Desktop API (Tenant DB)
CASE 5: /*                → Platform Vue Desktop Pages (Landlord DB)
CASE 6: /{tenant}/*       → Tenant Vue Desktop Pages (Tenant DB)
```

**Tenant Application Routes**: Use **CASE 5** (`/*`) since it's a platform-level public form.

### DDD Bounded Contexts
- **Platform Context**: Tenant applications (landlord database)
- **TenantAuth Context**: Tenant provisioning (tenant databases)
- **Election Context**: Election requests (separate domain)

---

## Step-by-Step Implementation Guide

### Phase 1: Planning & Analysis

#### 1.1 Determine Field Requirements
- **New field** or **modify existing field**?
- **Data type**: string, integer, boolean, enum, date?
- **Validation rules**: required, min/max length, regex pattern, unique?
- **Database constraints**: nullable, default value, index?

#### 1.2 Impact Analysis Checklist
- [ ] Frontend Vue template
- [ ] Backend validation rules
- [ ] Domain entity (TenantApplication)
- [ ] Application service (TenantApplicationService)
- [ ] Repository (EloquentTenantApplicationRepository)
- [ ] Database migration
- [ ] Provisioning service (if field affects tenant setup)
- [ ] Email templates (if displayed in notifications)
- [ ] Tests (unit, integration, feature)

### Phase 2: Implementation Steps

#### Step 1: Create Database Migration (If New/Modified Field)

**File**: `database/migrations/YYYY_MM_DD_HHMMSS_description.php`

```php
<?php
// Example: Adding a new field
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenant_applications', function (Blueprint $table) {
            // For new field
            $table->string('new_field')->nullable()->after('existing_field');

            // For modifying existing field
            $table->string('existing_field')->nullable()->change();

            // For removing field
            // $table->dropColumn('field_to_remove');
        });

        // Data migration if needed
        \DB::statement("UPDATE tenant_applications SET new_field = 'default' WHERE new_field IS NULL");

        // Make required after data migration
        Schema::table('tenant_applications', function (Blueprint $table) {
            $table->string('new_field')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('tenant_applications', function (Blueprint $table) {
            $table->dropColumn('new_field');
            // Or restore original state
        });
    }
};
```

#### Step 2: Update Vue Template (Apply.vue)

**File**: `resources/js/pages/Contexts/Platform/TenantApplication/Apply.vue`

##### 2.1 Add/Modify Form Field in Template
```vue
<!-- In the appropriate section (Organization, Contact, System Configuration, Terms) -->
<div>
  <label for="field_name" class="block text-sm font-medium text-gray-700 mb-1">
    Field Label *
  </label>
  <input
    id="field_name"
    v-model="form.field_name"
    type="text" <!-- or number, email, tel, etc. -->
    :required="true"
    :class="[
      'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
      errors.field_name ? 'border-red-300' : ''
    ]"
    placeholder="Placeholder text"
  />
  <div v-if="errors.field_name" class="mt-1 text-sm text-red-600">
    {{ errors.field_name }}
  </div>
</div>
```

##### 2.2 Update Form Data in Script
```javascript
// In the form definition
const form = useForm({
  organization_name: '',
  organization_type: '',
  first_name: '',
  last_name: '',
  field_name: '', // Add new field here
  // ... existing fields
});
```

##### 2.3 Update Form Validation (isFormValid)
```javascript
const isFormValid = computed(() => {
  return form.organization_name &&
         form.organization_type &&
         form.first_name &&
         form.last_name &&
         form.field_name && // Add new field check
         // ... existing checks
});
```

#### Step 3: Update Backend Validation Rules

**File**: `app/Contexts/Platform/Infrastructure/Http/Controllers/TenantApplicationController.php`

##### 3.1 Update Validation Rules Array (for Vue)
```php
'validationRules' => [
    'organization_name' => 'required|string|min:2|max:100',
    // ... existing rules
    'field_name' => 'required|string|min:1|max:255', // Add new rule
],
```

##### 3.2 Update Store Method Validation
```php
$validatedData = $request->validate([
    'organization_name' => 'required|string|min:2|max:100',
    // ... existing rules
    'field_name' => 'required|string|min:1|max:255', // Add new rule
]);
```

#### Step 4: Update TenantApplicationService

**File**: `app/Contexts/Platform/Application/Services/TenantApplicationService.php`

##### 4.1 Update validateApplicationData() Method
```php
private function validateApplicationData(array $data): void
{
    $requiredFields = [
        'organization_name',
        'organization_type',
        'first_name',
        'last_name',
        'field_name', // Add new field
        // ... existing fields
    ];

    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            throw new InvalidArgumentException("Field '{$field}' is required");
        }
    }

    // Add field-specific validation if needed
    if (strlen($data['field_name']) > 255) {
        throw new InvalidArgumentException("Field name cannot exceed 255 characters");
    }
}
```

#### Step 5: Update TenantApplication Entity

**File**: `app/Contexts/Platform/Domain/Entities/TenantApplication.php`

##### 5.1 Add/Update Property in Constructor
```php
private function __construct(
    // ... existing parameters
    private readonly string $fieldName, // Add new property
    // ... rest of constructor
) {
    $this->validateInvariants();
}
```

##### 5.2 Update create() Factory Method
```php
public static function create(array $applicationData): self
{
    return new self(
        // ... existing parameters
        fieldName: trim($applicationData['field_name']), // Add new field
        // ... rest of parameters
    );
}
```

##### 5.3 Update reconstitute() Method
```php
public static function reconstitute(array $data): self
{
    return new self(
        // ... existing parameters
        fieldName: $data['field_name'], // Add new field
        // ... rest of parameters
    );
}
```

##### 5.4 Add Getter Method
```php
public function getFieldName(): string
{
    return $this->fieldName;
}
```

##### 5.5 Update toArray() Method
```php
public function toArray(): array
{
    return [
        // ... existing fields
        'field_name' => $this->fieldName, // Add new field
        // ... rest of array
    ];
}
```

##### 5.6 Update validateInvariants() if needed
```php
private function validateInvariants(): void
{
    $violations = [];

    // ... existing validations

    if (empty(trim($this->fieldName))) {
        $violations[] = 'Field name cannot be empty';
    }

    // ... rest of method
}
```

#### Step 6: Update Repository

**File**: `app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantApplicationRepository.php`

##### 6.1 Update save() Method Data Array
```php
$data = [
    // ... existing fields
    'field_name' => $application->getFieldName(), // Add new field
    // ... rest of data
];
```

##### 6.2 Update Data Preparation for Updates
```php
$data = [
    // ... existing fields
    'field_name' => $application->getFieldName(), // Add new field
    // ... rest of data
];
```

#### Step 7: Update Provisioning Service (If Field Affects Tenant Setup)

**File**: `app/Contexts/Platform/Application/Services/TenantProvisioningService.php`

If the field is used during tenant provisioning (e.g., contact information for admin user):

```php
// In seedTenantData() or similar method
$fieldValue = $tenantData['field_name']; // Access from application data
// Use in tenant setup logic
```

#### Step 8: Update Tests

##### 8.1 Create/Update Migration Test
```php
// tests/Feature/TenantApplication/FieldNameMigrationTest.php
public function test_field_name_column_exists(): void
{
    $this->assertTrue(Schema::hasTable('tenant_applications'));
    $this->assertTrue(Schema::hasColumn('tenant_applications', 'field_name'));
    $this->assertFalse(Schema::hasColumn('tenant_applications', 'old_field_name')); // If removed
}
```

##### 8.2 Update Entity Test
```php
// tests/Unit/Platform/Domain/Entities/TenantApplicationTest.php
public function test_entity_has_field_name(): void
{
    $application = TenantApplication::create([
        // ... test data
        'field_name' => 'Test Value',
    ]);

    $this->assertEquals('Test Value', $application->getFieldName());
}
```

##### 8.3 Update Validation Test
```php
// tests/Feature/Platform/TenantApplicationValidationTest.php
public function test_field_name_is_required(): void
{
    $response = $this->post('/apply-for-tenant', [
        // ... other required fields
        'field_name' => '', // Empty should fail
    ]);

    $response->assertSessionHasErrors(['field_name']);
}
```

### Phase 3: Testing & Deployment

#### 3.1 Run Migration
```bash
cd packages/laravel-backend
php artisan migrate
```

#### 3.2 Run Tests
```bash
# Run all tenant application tests
php artisan test --filter=TenantApplication

# Run specific test file
php artisan test tests/Feature/Platform/TenantApplicationTest.php
```

#### 3.3 Manual Testing Checklist
- [ ] Form renders correctly with new field
- [ ] Validation works (required, min/max, format)
- [ ] Form submission succeeds with valid data
- [ ] Data is saved to database correctly
- [ ] Entity reconstitution works
- [ ] Provisioning uses field correctly (if applicable)
- [ ] Email notifications display field correctly (if applicable)

---

## File Locations & Responsibilities

| File | Purpose | Context |
|------|---------|---------|
| `resources/js/pages/Contexts/Platform/TenantApplication/Apply.vue` | Vue frontend form | Platform |
| `app/Contexts/Platform/Infrastructure/Http/Controllers/TenantApplicationController.php` | HTTP controller, validation | Platform |
| `app/Contexts/Platform/Application/Services/TenantApplicationService.php` | Business logic, validation | Platform |
| `app/Contexts/Platform/Domain/Entities/TenantApplication.php` | Domain entity, business rules | Platform |
| `app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantApplicationRepository.php` | Data persistence | Platform |
| `app/Contexts/Platform/Application/Services/TenantProvisioningService.php` | Tenant setup logic | Platform |
| `database/migrations/*_tenant_applications_*.php` | Database schema | Platform |
| `tests/Feature/Platform/TenantApplication*Test.php` | Feature tests | Platform |
| `tests/Unit/Platform/Domain/Entities/TenantApplicationTest.php` | Unit tests | Platform |

---

## Common Scenarios & Examples

### Scenario 1: Adding a New Optional Field

#### Example: Adding `website_url` (optional)

**Migration**:
```php
$table->string('website_url')->nullable()->after('organization_description');
```

**Vue Template**:
```vue
<div>
  <label for="website_url" class="block text-sm font-medium text-gray-700 mb-1">
    Organization Website
  </label>
  <input
    id="website_url"
    v-model="form.website_url"
    type="url"
    :class="['block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500']"
    placeholder="https://example.com"
  />
</div>
```

**Validation** (Controller):
```php
'website_url' => 'nullable|url|max:255',
```

**Entity** (nullable property):
```php
private readonly ?string $websiteUrl,
```

### Scenario 2: Changing Data Type

#### Example: Changing `expected_users_count` from integer to string with range

**Migration**:
```php
// No migration needed if same database type
// Just update validation
```

**Validation**:
```php
'expected_users_count' => 'required|string|in:1-50,51-200,201-1000,1001+',
```

**Entity**:
```php
private readonly string $expectedUsersCountRange,
```

### Scenario 3: Removing a Field

#### Example: Removing `technical_contact_email`

**Migration**:
```php
$table->dropColumn('technical_contact_email');
```

**Vue Template**: Remove the input field

**Entity**: Remove property, getter, and references

**Repository**: Remove from data arrays

**Important**: Consider data migration strategy for existing records

---

## Testing Checklist

### Pre-Implementation
- [ ] Write failing tests for new functionality
- [ ] Document data migration strategy for existing records
- [ ] Review impact on related systems (provisioning, notifications)

### During Implementation
- [ ] Database migration runs without errors
- [ ] Form renders correctly
- [ ] Validation rules work as expected
- [ ] Data persists correctly
- [ ] Entity methods work (getters, toArray, etc.)
- [ ] Backward compatibility maintained (if changing existing field)

### Post-Implementation
- [ ] All tests pass
- [ ] Form submission works end-to-end
- [ ] Data displays correctly in admin views
- [ ] Notifications include new field (if applicable)
- [ ] Provisioning uses field correctly (if applicable)

---

## Troubleshooting

### Common Issues

#### 1. "Column not found" Error
**Cause**: Migration not run or column name mismatch
**Solution**:
```bash
php artisan migrate:status # Check migration status
php artisan migrate # Run migrations
php artisan migrate:rollback # Rollback if needed
```

#### 2. Validation Errors Not Showing
**Cause**: Validation rule not added to controller
**Solution**: Check both validation arrays in `TenantApplicationController.php`

#### 3. Data Not Saving
**Cause**: Field not included in repository save() method
**Solution**: Add field to data array in `EloquentTenantApplicationRepository.php`

#### 4. Entity Reconstitution Fails
**Cause**: Field missing in toArray() or reconstitute() method
**Solution**: Ensure field is included in both methods

#### 5. Form Submission Redirect Loop
**Cause**: Validation failing silently
**Solution**: Check browser console for errors, verify all required fields in form

### Debugging Steps

1. **Check Laravel Logs**:
```bash
tail -f storage/logs/laravel.log
```

2. **Debug Form Submission**:
```javascript
// In Apply.vue, add debug logging
console.log('Form data:', form.data());
console.log('Validation errors:', errors);
```

3. **Test Validation Directly**:
```php
// In tinker
php artisan tinker
>>> $request = new Illuminate\Http\Request(['field_name' => 'test']);
>>> $validator = Validator::make($request->all(), ['field_name' => 'required|min:2']);
>>> $validator->fails();
```

---

## Best Practices

### 1. Follow TDD Workflow
1. Write failing test
2. Implement minimum code to pass test
3. Refactor while keeping tests green
4. Repeat

### 2. Maintain DDD Boundaries
- Keep Platform context logic in Platform files
- Don't mix tenant-specific logic in platform code
- Use value objects for complex data types

### 3. Data Migration Strategy
- Always provide `down()` method in migrations
- Test migration rollback
- Handle existing data gracefully
- Consider data loss implications

### 4. Backward Compatibility
- When changing existing fields, provide migration path
- Keep deprecated methods with `@deprecated` tags
- Update all references to avoid broken functionality

### 5. Security Considerations
- Validate all user input
- Use appropriate data types in database
- Sanitize output in emails/notifications
- Follow OWASP guidelines

### 6. Documentation
- Update this guide with new patterns
- Document field purposes in code comments
- Update API documentation if applicable
- Notify team of changes

### 7. Code Review Checklist
- [ ] All file locations updated
- [ ] Validation rules appropriate
- [ ] Database constraints correct
- [ ] Tests cover all scenarios
- [ ] No breaking changes without migration
- [ ] Security considerations addressed

---

## Example: Complete Field Addition Workflow

### Task: Add "Organization Size" dropdown

#### 1. Planning
- Field: `organization_size`
- Type: enum (small, medium, large, enterprise)
- Required: Yes
- Default: None
- Affects provisioning: No

#### 2. Implementation Order
1. Create migration
2. Update Vue template
3. Update controller validation
4. Update entity
5. Update repository
6. Write/update tests
7. Test manually
8. Deploy

#### 3. Estimated Files Changed: 7
- Migration file (new)
- Apply.vue
- TenantApplicationController.php
- TenantApplicationService.php
- TenantApplication.php
- EloquentTenantApplicationRepository.php
- Test files (2-3)

#### 4. Time Estimate: 2-4 hours
- Development: 1-2 hours
- Testing: 1 hour
- Code review: 30 minutes
- Deployment: 30 minutes

---

## Conclusion

Adding or changing fields in the tenant application requires coordinated updates across multiple layers of the application. By following this guide and the established DDD patterns, you can ensure consistent, maintainable, and testable changes.

**Remember**: Always start with tests, maintain backward compatibility where possible, and validate all changes through the complete workflow (form → validation → entity → database → provisioning).

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-14 | 1.0 | Initial guide based on contact_name → first_name/last_name implementation |
| 2025-12-14 | 1.1 | Added troubleshooting, best practices, examples |

---

**Maintainer**: Platform Context Team
**Review Cycle**: Quarterly review and update
**Related Documents**: CLAUDE.md, 6-case routing architecture, DDD guidelines