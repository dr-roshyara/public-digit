Perfect! Now I understand the complete picture. You've already implemented all the necessary backend changes for splitting `contact_name` into `first_name` and `last_name`. Now I need to update the **frontend Vue template** to match.

## Current State:
✅ **Backend already updated**: 
- Database migration created
- Validation rules updated  
- Entity split into `first_name`/`last_name`
- Service methods updated
- Repository updated

❌ **Frontend needs updating**:
Vue template still has single `contact_name` field

## Claude CLI Instructions:

### 1. **First, let me update the Vue template to match the backend:**

```bash
# Create the updated contact information section for Apply.vue
cat > /tmp/updated_contact_section.txt << 'EOF'
<!-- Contact Information -->
<div class="border-b border-gray-200 pb-8">
  <h3 class="text-lg font-medium text-gray-900 mb-6">Contact Information</h3>

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

    <div>
      <label for="contact_email" class="block text-sm font-medium text-gray-700 mb-1">
        Contact Email *
      </label>
      <input
        id="contact_email"
        v-model="form.contact_email"
        type="email"
        required
        :class="[
          'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
          errors.contact_email ? 'border-red-300' : ''
        ]"
        placeholder="primary@organization.com"
      />
      <div v-if="errors.contact_email" class="mt-1 text-sm text-red-600">
        {{ errors.contact_email }}
      </div>
    </div>

    <div>
      <label for="contact_phone" class="block text-sm font-medium text-gray-700 mb-1">
        Contact Phone
      </label>
      <input
        id="contact_phone"
        v-model="form.contact_phone"
        type="tel"
        :class="[
          'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
          errors.contact_phone ? 'border-red-300' : ''
        ]"
        placeholder="+1-555-0123"
      />
      <div v-if="errors.contact_phone" class="mt-1 text-sm text-red-600">
        {{ errors.contact_phone }}
      </div>
    </div>

    <div>
      <label for="technical_contact_email" class="block text-sm font-medium text-gray-700 mb-1">
        Technical Contact Email
      </label>
      <input
        id="technical_contact_email"
        v-model="form.technical_contact_email"
        type="email"
        :class="[
          'block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
          errors.technical_contact_email ? 'border-red-300' : ''
        ]"
        placeholder="tech@organization.com"
      />
      <div v-if="errors.technical_contact_email" class="mt-1 text-sm text-red-600">
        {{ errors.technical_contact_email }}
      </div>
    </div>
  </div>
</div>
EOF
```

### 2. **Update the form data initialization in Vue:**

```javascript
// In the <script setup> section, replace:
const form = useForm({
  organization_name: '',
  organization_type: '',
  contact_name: '',  // OLD - remove this
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

// With:
const form = useForm({
  organization_name: '',
  organization_type: '',
  first_name: '',     // NEW - split into two fields
  last_name: '',      // NEW - split into two fields
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

### 3. **Update the `isFormValid` computed property:**

```javascript
const isFormValid = computed(() => {
  return form.organization_name &&
         form.organization_type &&
         form.first_name &&      // Changed from contact_name
         form.last_name &&       // New requirement
         form.contact_email &&
         form.requested_slug &&
         form.organization_description &&
         form.expected_users_count &&
         form.expected_elections_per_year &&
         form.terms_accepted &&
         form.privacy_policy_accepted &&
         slugValidation.value.available === true &&
         !processing.value
})
```

### 4. **Update validation rules passed from backend:**

The backend controller's `create()` method already returns correct validation rules. Let me verify:

```bash
# Check what validation rules are being passed to Vue
cat packages/laravel-backend/app/Contexts/Platform/Infrastructure/Http/Controllers/TenantApplicationController.php | grep -A 15 "'validationRules'"
```

Should show:
```php
'validationRules' => [
    'organization_name' => 'required|string|min:2|max:100',
    'organization_type' => 'required|string|in:government,non_profit,corporate,academic,association,other',
    'first_name' => 'required|string|min:1|max:100',     // Correct
    'last_name' => 'required|string|min:1|max:100',      // Correct
    'contact_email' => 'required|email|max:255',
    // ... rest
]
```

### 5. **Run a quick test to verify:**

```bash
# Check if the form loads correctly
cd packages/laravel-backend && php artisan route:list --path=apply-for-tenant

# Test the validation by submitting empty form
curl -X POST http://localhost:8000/apply-for-tenant -H "Content-Type: application/json" -d '{}' 2>/dev/null | python3 -m json.tool
```

**Should I:**
1. First update the Vue template with the new fields?
2. Test the backend validation first?
3. Check if any other frontend components need updating?