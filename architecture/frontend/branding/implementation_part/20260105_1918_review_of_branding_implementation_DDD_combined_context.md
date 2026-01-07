
● 🏗️ COMPREHENSIVE BRANDING IMPLEMENTATION PLAN

  Senior Solution Architect & Software Engineer

  ---
  📊 EXECUTIVE SUMMARY

  Current State Analysis

  | Component            | Status        | Assessment                                                                       |
  |----------------------|---------------|----------------------------------------------------------------------------------|
  | Backend Architecture | ✅ Complete   | TenantBrandingService using landlord DB, TenantIdentifierResolver, Value Objects |
  | Database Schema      | ✅ Complete   | tenant_brandings table in landlord DB with proper indexes                        |
  | API Layer            | ❌ Missing    | No controllers, routes, or request validation                                    |
  | Frontend Components  | ❌ Missing    | No Vue components for branding management                                        |
  | CSS Injection        | ⚠️ Needs Work | Middleware concept exists but not optimized                                      |
  | Testing              | ⚠️ Partial    | Unit tests for resolver, missing API/E2E tests                                   |

  Architecture Decision Alignment

  ✅ ADR-004 Compliance: MVP scope with ≤15 fields
  ✅ DDD Principles: Value Objects, Repository pattern, Domain isolation
  ✅ Multi-Tenant Rules: Landlord DB for public data, tenant enumeration protection
  ✅ TDD Approach: Tests before implementation

  ---
  🎯 IMPLEMENTATION STRATEGY

  Phase Breakdown

  Phase 1 (Complete): Backend Foundation ✅
  Phase 2 (3 days): API Layer & Validation
  Phase 3 (4 days): Frontend Components with Accessibility
  Phase 4 (2 days): Integration & Testing
  Phase 5 (1 day): Deployment & Monitoring

  Total Timeline: 10 working days

  ---
  📅 PHASE 2: API LAYER & VALIDATION (Days 2-4)

  Day 2: API Controllers & Routes

  2.1 Request Validation Classes

  File: packages/laravel-backend/app/Http/Requests/UpdateTenantBrandingRequest.php

  <?php

  namespace App\Http\Requests;

  use Illuminate\Foundation\Http\FormRequest;

  class UpdateTenantBrandingRequest extends FormRequest
  {
      public function authorize(): bool
      {
          // Ensure user has permission to update tenant branding
          return $this->user()->can('update-branding', $this->route('tenant'));
      }

      public function rules(): array
      {
          return [
              // Visual Identity (3 fields)
              'primary_color' => ['required', 'regex:/^#[0-9A-F]{6}$/i'],
              'secondary_color' => ['required', 'regex:/^#[0-9A-F]{6}$/i'],
              'logo_url' => ['nullable', 'url', 'max:255'],

              // Organization Identity (2 fields)
              'company_name' => ['required', 'string', 'max:255'],
              'company_tagline' => ['nullable', 'string', 'max:255'],

              // Landing Content (4 fields)
              'welcome_message' => ['nullable', 'string', 'max:500'],
              'hero_title' => ['nullable', 'string', 'max:255'],
              'hero_subtitle' => ['nullable', 'string', 'max:1000'],
              'cta_text' => ['nullable', 'string', 'max:100'],

              // Typography (1 field - locked to Inter for MVP)
              'font_family' => ['nullable', 'in:Inter\, system-ui\, sans-serif'],
          ];
      }

      public function messages(): array
      {
          return [
              'primary_color.regex' => 'Primary color must be a valid hex code (e.g., #3B82F6)',
              'secondary_color.regex' => 'Secondary color must be a valid hex code (e.g., #1E40AF)',
              'welcome_message.max' => 'Welcome message cannot exceed 500 characters for election integrity',
              'company_name.required' => 'Organization name is required for tenant identification',
          ];
      }
  }

  2.2 API Controller (Tenant-Scoped)

  File: packages/laravel-backend/app/Http/Controllers/Api/TenantBrandingController.php

  <?php

  namespace App\Http\Controllers\Api;

  use App\Http\Controllers\Controller;
  use App\Http\Requests\UpdateTenantBrandingRequest;
  use App\Contexts\TenantAuth\Application\Services\TenantBrandingService;
  use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
  use App\Landlord\Domain\Entities\Tenant;
  use Illuminate\Http\JsonResponse;
  use Illuminate\Http\Request;

  class TenantBrandingController extends Controller
  {
      public function __construct(
          private TenantBrandingService $brandingService
      ) {}

      /**
       * Get branding for current tenant
       *
       * @param Request $request
       * @return JsonResponse
       */
      public function show(Request $request): JsonResponse
      {
          $tenant = $request->route('tenant'); // From route parameter

          if (!$tenant instanceof Tenant) {
              $tenant = Tenant::where('slug', $tenant)->firstOrFail();
          }

          $branding = $this->brandingService->getBrandingForTenant($tenant);

          return response()->json([
              'data' => $branding,
              'css_variables' => $this->brandingService->generateCssVariables($tenant),
          ]);
      }

      /**
       * Update tenant branding
       *
       * @param UpdateTenantBrandingRequest $request
       * @return JsonResponse
       */
      public function update(UpdateTenantBrandingRequest $request): JsonResponse
      {
          $tenant = $request->route('tenant');

          if (!$tenant instanceof Tenant) {
              $tenant = Tenant::where('slug', $tenant)->firstOrFail();
          }

          try {
              $this->brandingService->updateBrandingForTenant($tenant, $request->validated());

              return response()->json([
                  'message' => 'Branding updated successfully',
                  'data' => $this->brandingService->getBrandingForTenant($tenant),
              ]);

          } catch (\Exception $e) {
              return response()->json([
                  'message' => 'Failed to update branding',
                  'error' => $e->getMessage(),
              ], 500);
          }
      }

      /**
       * Reset tenant branding to defaults
       *
       * @param Request $request
       * @return JsonResponse
       */
      public function reset(Request $request): JsonResponse
      {
          $tenant = $request->route('tenant');

          if (!$tenant instanceof Tenant) {
              $tenant = Tenant->where('slug', $tenant)->firstOrFail();
          }

          $defaults = [
              'primary_color' => '#3B82F6',
              'secondary_color' => '#1E40AF',
              'logo_url' => null,
              'company_name' => $tenant->name ?? 'Organization',
              'company_tagline' => null,
              'welcome_message' => 'Welcome to our election platform',
              'hero_title' => 'Secure Online Voting',
              'hero_subtitle' => 'Participate in democratic elections from anywhere',
              'cta_text' => 'View Current Elections',
              'font_family' => 'Inter, system-ui, sans-serif',
          ];

          $this->brandingService->updateBrandingForTenant($tenant, $defaults);

          return response()->json([
              'message' => 'Branding reset to defaults',
              'data' => $defaults,
          ]);
      }
  }

  2.3 Routes Definition

  File: packages/laravel-backend/routes/tenant.php

  <?php

  use App\Http\Controllers\Api\TenantBrandingController;
  use Illuminate\Support\Facades\Route;

  // Tenant Branding API (Authenticated)
  Route::middleware(['auth:sanctum', 'tenant.context'])->prefix('api/v1')->group(function () {
      Route::get('/branding', [TenantBrandingController::class, 'show'])
          ->name('tenant.api.branding.show');

      Route::put('/branding', [TenantBrandingController::class, 'update'])
          ->name('tenant.api.branding.update');

      Route::post('/branding/reset', [TenantBrandingController::class, 'reset'])
          ->name('tenant.api.branding.reset');
  });

  // Tenant Branding Web UI (Inertia)
  Route::middleware(['auth:tenant', 'tenant.context'])->prefix('admin')->group(function () {
      Route::get('/branding', function () {
          $tenant = request()->route('tenant');
          $brandingService = app(\App\Contexts\TenantAuth\Application\Services\TenantBrandingService::class);

          return inertia('Tenant/Admin/Branding', [
              'branding' => $brandingService->getBrandingForTenant($tenant),
          ]);
      })->name('tenant.admin.branding.edit');
  });

  Day 3: Backend Testing (TDD)

  3.1 API Feature Tests

  File: packages/laravel-backend/tests/Feature/TenantBrandingApiTest.php

  <?php

  namespace Tests\Feature;

  use App\Landlord\Domain\Entities\Tenant;
  use Illuminate\Foundation\Testing\RefreshDatabase;
  use Tests\TestCase;

  class TenantBrandingApiTest extends TestCase
  {
      use RefreshDatabase;

      protected Tenant $tenant;

      protected function setUp(): void
      {
          parent::setUp();

          // Create test tenant
          $this->tenant = Tenant::factory()->create([
              'slug' => 'test-org',
              'name' => 'Test Organization',
          ]);
      }

      /** @test */
      public function it_can_get_tenant_branding()
      {
          $response = $this->actingAs($this->createTenantAdmin())
              ->getJson("/test-org/api/v1/branding");

          $response->assertOk()
              ->assertJsonStructure([
                  'data' => [
                      'primary_color',
                      'secondary_color',
                      'company_name',
                  ],
                  'css_variables',
              ]);
      }

      /** @test */
      public function it_can_update_tenant_branding()
      {
          $brandingData = [
              'primary_color' => '#FF0000',
              'secondary_color' => '#00FF00',
              'company_name' => 'Updated Organization',
              'welcome_message' => 'Welcome to our updated platform',
          ];

          $response = $this->actingAs($this->createTenantAdmin())
              ->putJson("/test-org/api/v1/branding", $brandingData);

          $response->assertOk()
              ->assertJson([
                  'message' => 'Branding updated successfully',
                  'data' => $brandingData,
              ]);
      }

      /** @test */
      public function it_validates_color_format()
      {
          $response = $this->actingAs($this->createTenantAdmin())
              ->putJson("/test-org/api/v1/branding", [
                  'primary_color' => 'invalid-color',
                  'company_name' => 'Test',
              ]);

          $response->assertStatus(422)
              ->assertJsonValidationErrors(['primary_color']);
      }

      /** @test */
      public function it_enforces_welcome_message_character_limit()
      {
          $response = $this->actingAs($this->createTenantAdmin())
              ->putJson("/test-org/api/v1/branding", [
                  'welcome_message' => str_repeat('A', 501),
                  'company_name' => 'Test',
              ]);

          $response->assertStatus(422)
              ->assertJsonValidationErrors(['welcome_message']);
      }

      private function createTenantAdmin()
      {
          // Create and return authenticated tenant admin user
          // Implementation depends on your auth system
      }
  }

  ---
  📅 PHASE 3: FRONTEND COMPONENTS (Days 5-8)

  Day 5: Core Vue Components with Composition API

  5.1 Main Branding Page

  File: resources/js/Pages/Tenant/Admin/Branding.vue

  <script setup>
  import { ref, computed } from 'vue'
  import { useForm } from '@inertiajs/vue3'
  import TenantLayout from '@/Layouts/TenantLayout.vue'
  import BrandingTabs from '@/Components/Branding/BrandingTabs.vue'
  import IdentityTab from '@/Components/Branding/IdentityTab.vue'
  import ColorsTab from '@/Components/Branding/ColorsTab.vue'
  import ContentTab from '@/Components/Branding/ContentTab.vue'
  import PreviewTab from '@/Components/Branding/PreviewTab.vue'

  const props = defineProps({
    branding: {
      type: Object,
      required: true,
    },
  })

  const activeTab = ref('identity')

  const form = useForm({
    // Visual Identity
    primary_color: props.branding.primary_color || '#3B82F6',
    secondary_color: props.branding.secondary_color || '#1E40AF',
    logo_url: props.branding.logo_url || null,

    // Organization Identity
    company_name: props.branding.company_name || '',
    company_tagline: props.branding.company_tagline || '',

    // Landing Content
    welcome_message: props.branding.welcome_message || 'Welcome to our election platform',
    hero_title: props.branding.hero_title || 'Secure Online Voting',
    hero_subtitle: props.branding.hero_subtitle || 'Participate in democratic elections from anywhere',
    cta_text: props.branding.cta_text || 'View Current Elections',

    // Typography (locked for MVP)
    font_family: 'Inter, system-ui, sans-serif',
  })

  const tabs = [
    { id: 'identity', label: 'Identity', icon: 'BuildingOfficeIcon' },
    { id: 'colors', label: 'Colors & Logo', icon: 'SwatchIcon' },
    { id: 'content', label: 'Welcome & Landing', icon: 'DocumentTextIcon' },
    { id: 'preview', label: 'Preview', icon: 'EyeIcon' },
  ]

  const hasUnsavedChanges = computed(() => form.isDirty)

  function save() {
    form.put(route('tenant.admin.branding.update'), {
      preserveScroll: true,
      onSuccess: () => {
        // Show success toast notification
        console.log('Branding saved successfully')
      },
    })
  }

  function reset() {
    if (confirm('Are you sure you want to reset branding to defaults? This cannot be undone.')) {
      form.post(route('tenant.admin.branding.reset'), {
        preserveScroll: true,
      })
    }
  }

  const tabClass = (tabId) => {
    return activeTab.value === tabId
      ? 'border-b-2 border-blue-600 text-blue-600 font-medium pb-3'
      : 'text-gray-500 hover:text-gray-700 pb-3'
  }
  </script>

  <template>
    <TenantLayout title="Branding & Welcome Settings">
      <div class="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            Branding & Welcome
          </h1>
          <p class="mt-2 text-gray-600">
            Configure how your public landing pages appear to voters.
            Changes apply to login pages and election information pages.
          </p>
        </div>

        <!-- Unsaved Changes Warning -->
        <div
          v-if="hasUnsavedChanges"
          class="mb-6 rounded-md bg-yellow-50 p-4"
          role="alert"
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">
                You have unsaved changes
              </h3>
              <div class="mt-2 text-sm text-yellow-700">
                <p>Your branding changes will be lost if you navigate away without saving.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <BrandingTabs
          v-model:activeTab="activeTab"
          :tabs="tabs"
          :errors="form.errors"
        />

        <!-- Tab Content -->
        <div class="mt-6 bg-white shadow sm:rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <IdentityTab
              v-if="activeTab === 'identity'"
              v-model:companyName="form.company_name"
              v-model:companyTagline="form.company_tagline"
              :errors="form.errors"
            />

            <ColorsTab
              v-else-if="activeTab === 'colors'"
              v-model:primaryColor="form.primary_color"
              v-model:secondaryColor="form.secondary_color"
              v-model:logoUrl="form.logo_url"
              :errors="form.errors"
            />

            <ContentTab
              v-else-if="activeTab === 'content'"
              v-model:welcomeMessage="form.welcome_message"
              v-model:heroTitle="form.hero_title"
              v-model:heroSubtitle="form.hero_subtitle"
              v-model:ctaText="form.cta_text"
              :errors="form.errors"
            />

            <PreviewTab
              v-else-if="activeTab === 'preview'"
              :branding="form.data()"
            />
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="mt-6 flex items-center justify-between">
          <button
            type="button"
            @click="reset"
            class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Reset to Defaults
          </button>

          <div class="flex items-center space-x-4">
            <span
              v-if="form.recentlySuccessful"
              class="text-sm text-green-600"
            >
              ✓ Saved successfully
            </span>

            <button
              type="button"
              @click="save"
              :disabled="form.processing || !form.isDirty"
              class="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="form.processing">Saving...</span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </TenantLayout>
  </template>

  Day 6: Accessible Tab Components

  6.1 Accessible Tabs Component

  File: resources/js/Components/Branding/BrandingTabs.vue

  <script setup>
  import { computed } from 'vue'
  import {
    BuildingOfficeIcon,
    SwatchIcon,
    DocumentTextIcon,
    EyeIcon,
  } from '@heroicons/vue/24/outline'

  const props = defineProps({
    activeTab: {
      type: String,
      required: true,
    },
    tabs: {
      type: Array,
      required: true,
    },
    errors: {
      type: Object,
      default: () => ({}),
    },
  })

  const emit = defineEmits(['update:activeTab'])

  const iconComponents = {
    BuildingOfficeIcon,
    SwatchIcon,
    DocumentTextIcon,
    EyeIcon,
  }

  const tabHasErrors = (tabId) => {
    const tabFieldMap = {
      identity: ['company_name', 'company_tagline'],
      colors: ['primary_color', 'secondary_color', 'logo_url'],
      content: ['welcome_message', 'hero_title', 'hero_subtitle', 'cta_text'],
    }

    const fields = tabFieldMap[tabId] || []
    return fields.some(field => props.errors[field])
  }

  function activateTab(tabId) {
    emit('update:activeTab', tabId)
  }

  function handleKeydown(event, index) {
    let newIndex = index

    if (event.key === 'ArrowRight') {
      newIndex = (index + 1) % props.tabs.length
    } else if (event.key === 'ArrowLeft') {
      newIndex = (index - 1 + props.tabs.length) % props.tabs.length
    } else if (event.key === 'Home') {
      newIndex = 0
    } else if (event.key === 'End') {
      newIndex = props.tabs.length - 1
    } else {
      return
    }

    event.preventDefault()
    emit('update:activeTab', props.tabs[newIndex].id)
  }
  </script>

  <template>
    <div
      role="tablist"
      aria-label="Branding settings tabs"
      class="border-b border-gray-200"
    >
      <nav class="-mb-px flex space-x-8 overflow-x-auto pb-2" aria-label="Tabs">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.id"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`tabpanel-${tab.id}`"
          :tabindex="activeTab === tab.id ? 0 : -1"
          @click="activateTab(tab.id)"
          @keydown="handleKeydown($event, index)"
          :class="[
            activeTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-t-md'
          ]"
        >
          <component
            :is="iconComponents[tab.icon]"
            :class="[
              activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
              '-ml-0.5 mr-2 h-5 w-5'
            ]"
            aria-hidden="true"
          />
          <span>{{ tab.label }}</span>

          <!-- Error indicator -->
          <span
            v-if="tabHasErrors(tab.id)"
            class="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full"
            aria-label="Has validation errors"
          >
            !
          </span>
        </button>
      </nav>
    </div>
  </template>

  6.2 Colors Tab with Contrast Validation

  File: resources/js/Components/Branding/ColorsTab.vue

  <script setup>
  import { computed } from 'vue'

  const props = defineProps({
    primaryColor: String,
    secondaryColor: String,
    logoUrl: String,
    errors: Object,
  })

  const emit = defineEmits([
    'update:primaryColor',
    'update:secondaryColor',
    'update:logoUrl',
  ])

  // WCAG contrast validation
  const getContrastRatio = (hex1, hex2) => {
    const getRGB = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255
      return [r, g, b].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    }

    const getLuminance = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

    const lum1 = getLuminance(getRGB(hex1))
    const lum2 = getLuminance(getRGB(hex2))

    const brightest = Math.max(lum1, lum2)
    const darkest = Math.min(lum1, lum2)

    return (brightest + 0.05) / (darkest + 0.05)
  }

  const primaryContrastRatio = computed(() => getContrastRatio(props.primaryColor, '#FFFFFF'))
  const primaryWcagCompliant = computed(() => primaryContrastRatio.value >= 4.5)

  const secondaryContrastRatio = computed(() => getContrastRatio(props.secondaryColor, '#FFFFFF'))
  const secondaryWcagCompliant = computed(() => secondaryContrastRatio.value >= 4.5)
  </script>

  <template>
    <div
      role="tabpanel"
      id="tabpanel-colors"
      aria-labelledby="tab-colors"
      class="space-y-6"
    >
      <div>
        <h3 class="text-lg font-medium text-gray-900">Colors & Logo</h3>
        <p class="mt-1 text-sm text-gray-500">
          Choose colors that represent your organization while maintaining accessibility standards.
        </p>
      </div>

      <!-- Primary Color -->
      <div>
        <label for="primary-color" class="block text-sm font-medium text-gray-700">
          Primary Color
          <span class="text-red-500">*</span>
        </label>
        <div class="mt-2 flex items-center space-x-4">
          <input
            id="primary-color"
            type="color"
            :value="primaryColor"
            @input="emit('update:primaryColor', $event.target.value)"
            class="h-12 w-20 rounded border-gray-300 cursor-pointer"
            aria-describedby="primary-color-description"
          />
          <input
            type="text"
            :value="primaryColor"
            @input="emit('update:primaryColor', $event.target.value)"
            pattern="^#[0-9A-F]{6}$"
            placeholder="#3B82F6"
            class="font-mono text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />

          <!-- Contrast indicator -->
          <div class="flex items-center text-sm">
            <div
              :class="[
                primaryWcagCompliant ? 'text-green-600' : 'text-yellow-600',
                'flex items-center'
              ]"
            >
              <svg
                :class="[primaryWcagCompliant ? 'text-green-500' : 'text-yellow-500']"
                class="h-5 w-5 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  v-if="primaryWcagCompliant"
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
                <path
                  v-else
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>
                {{ primaryWcagCompliant ? 'Good contrast' : 'Low contrast' }}
                ({{ primaryContrastRatio.toFixed(2) }}:1)
              </span>
            </div>
          </div>
        </div>
        <p id="primary-color-description" class="mt-2 text-sm text-gray-500">
          Used for buttons, links, and primary UI elements
        </p>
        <p v-if="errors.primary_color" class="mt-2 text-sm text-red-600">
          {{ errors.primary_color }}
        </p>
      </div>

      <!-- Secondary Color -->
      <div>
        <label for="secondary-color" class="block text-sm font-medium text-gray-700">
          Secondary Color
          <span class="text-red-500">*</span>
        </label>
        <div class="mt-2 flex items-center space-x-4">
          <input
            id="secondary-color"
            type="color"
            :value="secondaryColor"
            @input="emit('update:secondaryColor', $event.target.value)"
            class="h-12 w-20 rounded border-gray-300 cursor-pointer"
            aria-describedby="secondary-color-description"
          />
          <input
            type="text"
            :value="secondaryColor"
            @input="emit('update:secondaryColor', $event.target.value)"
            pattern="^#[0-9A-F]{6}$"
            placeholder="#1E40AF"
            class="font-mono text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />

          <!-- Contrast indicator -->
          <div class="flex items-center text-sm">
            <div
              :class="[
                secondaryWcagCompliant ? 'text-green-600' : 'text-yellow-600',
                'flex items-center'
              ]"
            >
              <svg
                :class="[secondaryWcagCompliant ? 'text-green-500' : 'text-yellow-500']"
                class="h-5 w-5 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  v-if="secondaryWcagCompliant"
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
                <path
                  v-else
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>
                {{ secondaryWcagCompliant ? 'Good contrast' : 'Low contrast' }}
                ({{ secondaryContrastRatio.toFixed(2) }}:1)
              </span>
            </div>
          </div>
        </div>
        <p id="secondary-color-description" class="mt-2 text-sm text-gray-500">
          Used for accents, secondary actions, and highlights
        </p>
        <p v-if="errors.secondary_color" class="mt-2 text-sm text-red-600">
          {{ errors.secondary_color }}
        </p>
      </div>

      <!-- Logo URL -->
      <div>
        <label for="logo-url" class="block text-sm font-medium text-gray-700">
          Logo URL
        </label>
        <div class="mt-2">
          <input
            id="logo-url"
            type="url"
            :value="logoUrl"
            @input="emit('update:logoUrl', $event.target.value)"
            placeholder="https://example.com/logo.png"
            class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            aria-describedby="logo-url-description"
          />
        </div>
        <p id="logo-url-description" class="mt-2 text-sm text-gray-500">
          Displayed in header and login pages. Recommended size: 256x256px or SVG.
        </p>
        <p v-if="errors.logo_url" class="mt-2 text-sm text-red-600">
          {{ errors.logo_url }}
        </p>

        <!-- Logo preview -->
        <div v-if="logoUrl" class="mt-4">
          <p class="text-sm font-medium text-gray-700 mb-2">Preview:</p>
          <div class="flex items-center justify-center h-32 bg-gray-100 rounded border border-gray-300">
            <img :src="logoUrl" alt="Logo preview" class="max-h-24 max-w-full object-contain" />
          </div>
        </div>
      </div>

      <!-- WCAG Guidelines Info -->
      <div class="rounded-md bg-blue-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-blue-800">
              Accessibility Guidelines
            </h3>
            <div class="mt-2 text-sm text-blue-700">
              <p>
                For election platform compliance, we require a minimum contrast ratio of 4.5:1 (WCAG AA)
                between text and background colors. This ensures readability for all voters.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>

  ---
  Would you like me to continue with:
  1. Content Tab component (welcome message, hero content with character counters)
  2. Preview Tab component (real-time preview with responsive modes)
  3. Phase 4: CSS Injection & Integration
  4. Phase 5: Testing & Deployment scripts

  Or would you prefer to start implementing the parts I've provided first?
  