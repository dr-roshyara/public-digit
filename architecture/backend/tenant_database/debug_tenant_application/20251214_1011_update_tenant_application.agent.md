You're absolutely right! For **Universal Core Schema compliance**, we should have **separate fields** for first name and last name in the application form. This ensures:

1. ✅ **Accurate data storage** - No guessing when splitting names
2. ✅ **Better UX** - Users enter their actual first/last names
3. ✅ **International support** - Some cultures have different name structures
4. ✅ **No data loss** - Splitting "John van der Berg" incorrectly

## Claude CLI Instructions:

### 1. **Update the Vue template (Apply.vue)** - Replace single `contact_name` with two fields:

```bash
# Create the updated contact information section
cat > /tmp/contact_fields.txt << 'EOF'
<!-- Replace the single contact_name field with two fields -->

<div class="grid md:grid-cols-2 gap-6">
  <div>
    <label for="first_name" class="block text-sm font-medium text-gray-700 mb-1">
      First Name *
    </label>
    <input
      id="first_name"
      v-model="form.first_name"
      type="text"
      required
      :class="[
        'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
        errors.first_name ? 'border-red-300' : ''
      ]"
      placeholder="John"
    />
    <div v-if="errors.first_name" class="mt-1 text-sm text-red-600">
      {{ errors.first_name }}
    </div>
  </div>

  <div>
    <label for="last_name" class="block text-sm font-medium text-gray-700 mb-1">
      Last Name *
    </label>
    <input
      id="last_name"
      v-model="form.last_name"
      type="text"
      required
      :class="[
        'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
        errors.last_name ? 'border-red-300' : ''
      ]"
      placeholder="Doe"
    />
    <div v-if="errors.last_name" class="mt-1 text-sm text-red-600">
      {{ errors.last_name }}
    </div>
  </div>
</div>
EOF
```

### 2. **Update the form data in Vue component:**

```javascript
// In the <script setup> section, update form data:
const form = useForm({
  organization_name: '',
  organization_type: '',
  first_name: '',        // Changed from contact_name
  last_name: '',         // New field
  contact_email: '',
  contact_phone: '',
  requested_slug: '',
  organization_description: '',
  expected_users_count: null,
  expected_elections_per_year: null,
  technical_contact_email: '',
  terms_accepted: false,
  privacy_policy_accepted: false
})
```

### 3. **Update the backend validation rules:**

```php
// In TenantApplicationController.php, update validation:
$validatedData = $request->validate([
    'organization_name' => 'required|string|min:2|max:100',
    'organization_type' => 'required|string|in:government,non_profit,corporate,academic,association,other',
    'first_name' => 'required|string|min:1|max:100',     // Changed from contact_name
    'last_name' => 'required|string|min:1|max:100',      // New field
    'contact_email' => 'required|email|max:255',
    'contact_phone' => 'nullable|string|max:20',
    'requested_slug' => 'required|string|min:2|max:63|regex:/^[a-z0-9-]+$/',
    'organization_description' => 'required|string|min:10|max:1000',
    'expected_users_count' => 'required|integer|min:1|max:10000',
    'expected_elections_per_year' => 'required|integer|min:1|max:100',
    'technical_contact_email' => 'nullable|email|max:255',
    'terms_accepted' => 'required|accepted',
    'privacy_policy_accepted' => 'required|accepted'
]);
```

### 4. **Update TenantApplicationService.php:**

```php
public function submitApplication(array $data): TenantApplication
{
    // Create Value Objects
    $applicationId = TenantApplicationId::generate();
    $contactEmail = new EmailAddress($data['contact_email']);
    $tenantSlug = new TenantSlug($data['requested_slug']);
    
    // Create Entity with first_name and last_name
    $application = TenantApplication::create([
        'id' => $applicationId,
        'organization_name' => $data['organization_name'],
        'organization_type' => $data['organization_type'],
        'organization_description' => $data['organization_description'],
        'first_name' => $data['first_name'],      // Changed
        'last_name' => $data['last_name'],        // Changed  
        'contact_email' => $contactEmail,
        'contact_phone' => $data['contact_phone'] ?? null,
        'technical_contact_email' => $data['technical_contact_email'] ?? null,
        'requested_slug' => $tenantSlug,
        'expected_users_count' => (int) $data['expected_users_count'],
        'expected_elections_per_year' => (int) $data['expected_elections_per_year'],
        'status' => ApplicationStatus::pending(),
        'submitted_at' => now(),
        'terms_accepted' => (bool) $data['terms_accepted'],
        'privacy_policy_accepted' => (bool) $data['privacy_policy_accepted']
    ]);
    
    // Save via Repository
    $this->applicationRepository->save($application);
    
    // Dispatch Domain Event
    event(new TenantApplicationSubmitted($application));
    
    return $application;
}
```

### 5. **Update TenantApplication entity:**

```php
// In TenantApplication.php, update properties:
private string $firstName;
private string $lastName;

// Update getters:
public function getFirstName(): string
{
    return $this->firstName;
}

public function getLastName(): string
{
    return $this->lastName;
}

// For backward compatibility, keep getContactName():
public function getContactName(): string
{
    return $this->firstName . ' ' . $this->lastName;
}
```

### 6. **Update provisioning service - remove name parsing**:

Since we now have separate fields, we don't need to parse:

```php
// In TenantProvisioningService::seedTenantData()
// Change from:
$nameParts = explode(' ', $adminName, 2);
$firstName = $nameParts[0];
$lastName = $nameParts[1] ?? '';

// To:
$firstName = $tenantData['first_name'];  // Direct from application
$lastName = $tenantData['last_name'];    // Direct from application
```

**Which update should I do first?** Start with the **Vue template** since that's what users see, then update backend validation to match.