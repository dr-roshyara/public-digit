# 🏗️ **PHASE 4: TENANT BRANDING ADMIN DASHBOARD - ARCHITECTURAL BRIEF**

## **🎯 PHASE OVERVIEW**

**Objective**: Build a Vue 3 desktop admin interface for tenant branding management, enabling platform administrators to customize and manage tenant branding configurations through a modern, real-time UI.

**Timeline**: 14 days (2-week sprint)
**Team**: 1 Senior Full Stack Developer (Vue 3 + Laravel DDD expertise)

---

## **🏛️ ARCHITECTURAL PRINCIPLES**

### **DDD CONSTRAINTS (MUST FOLLOW):**
1. **Bounded Context**: `Platform::BrandingManagement` - Separate from `TenantAuth::Branding`
2. **Aggregate Root**: `TenantBranding` (already exists in landlord DB)
3. **Repository Pattern**: `TenantBrandingRepositoryInterface` with `save()`, `update()`, `delete()` methods
4. **Domain Events**: `BrandingUpdated`, `BrandingCreated`, `BrandingDeleted` for cross-context communication
5. **Value Objects**: Use existing `BrandingColor`, `BrandingVisuals`, `BrandingContent`

### **TDD APPROACH:**
1. **Test-First**: Write failing tests before implementation
2. **Red-Green-Refactor**: Standard TDD cycle
3. **Integration Tests**: Verify API ↔ Frontend integration
4. **E2E Tests**: Critical user flows (Cypress)

### **6-CASE ROUTING COMPLIANCE:**
```
CASE 5: /admin/* → Platform Desktop Pages (Vue 3 SPA)
CASE 3: /api/v1/admin/* → Platform Desktop API (Landlord DB)
```

---

## **📋 DELIVERABLES**

### **WEEK 1: BACKEND API & DOMAIN LAYER**

#### **Day 1-2: Domain Model Enhancement**
```bash
# 1. Extend TenantBranding aggregate
# Add: version tracking, last_updated_by, audit fields
touch app/Contexts/Platform/Domain/Models/TenantBranding.php

# 2. Create BrandingUpdateCommand & Handler
touch app/Contexts/Platform/Application/Commands/UpdateBrandingCommand.php
touch app/Contexts/Platform/Application/Handlers/UpdateBrandingHandler.php

# 3. Domain Events
touch app/Contexts/Platform/Domain/Events/BrandingUpdated.php
touch app/Contexts/Platform/Domain/Events/BrandingUpdateFailed.php
```

#### **Day 3-4: Admin API Controllers**
```bash
# 1. Admin Branding Controller (CASE 3)
touch app/Contexts/Platform/Infrastructure/Http/Controllers/Api/Admin/BrandingController.php

# 2. Admin Routes (CASE 3: /api/v1/admin/*)
mkdir -p routes/platform-api/admin
touch routes/platform-api/admin/branding.php

# 3. Request Validation DTOs
touch app/Contexts/Platform/Infrastructure/Http/Requests/Admin/UpdateBrandingRequest.php
```

#### **Day 5-7: Service Layer & Integration Tests**
```bash
# 1. BrandingManagementService
touch app/Contexts/Platform/Application/Services/BrandingManagementService.php

# 2. WCAG Compliance Service
touch app/Services/WcagComplianceService.php

# 3. Comprehensive API Tests
touch tests/Feature/Contexts/Platform/Api/V1/Admin/BrandingControllerTest.php
```

### **WEEK 2: VUE 3 FRONTEND**

#### **Day 8-9: Vue 3 Admin Layout & Routing**
```bash
# 1. Admin Layout Component
touch resources/js/Components/Admin/Layout/AdminLayout.vue

# 2. Vue Router Configuration
touch resources/js/router/admin.js

# 3. Admin Dashboard View
touch resources/js/Pages/Admin/Dashboard.vue
```

#### **Day 10-11: Branding Management UI**
```bash
# 1. Branding List Component
touch resources/js/Components/Admin/Branding/BrandingList.vue

# 2. Branding Editor Component
touch resources/js/Components/Admin/Branding/BrandingEditor.vue

# 3. Real-time Preview Component
touch resources/js/Components/Admin/Branding/BrandingPreview.vue
```

#### **Day 12-13: Advanced Features & State Management**
```bash
# 1. Pinia Store for Branding
touch resources/js/Stores/brandingStore.js

# 2. WCAG Validation Component
touch resources/js/Components/Admin/Branding/WcagValidator.vue

# 3. Audit Log Component
touch resources/js/Components/Admin/Branding/AuditLog.vue
```

#### **Day 14: E2E Testing & Documentation**
```bash
# 1. Cypress E2E Tests
touch cypress/e2e/admin-branding.cy.js

# 2. Admin User Documentation
touch docs/admin-branding-guide.md

# 3. API Documentation (OpenAPI)
touch docs/api/admin-branding-api.yaml
```

---

## **🔧 TECHNICAL SPECIFICATIONS**

### **API ENDPOINTS (CASE 3):**

#### **Branding Management API:**
```
GET    /api/v1/admin/branding                     # List all tenant branding
GET    /api/v1/admin/branding/{tenantId}          # Get specific tenant branding  
PUT    /api/v1/admin/branding/{tenantId}          # Update tenant branding
POST   /api/v1/admin/branding/{tenantId}/preview  # Preview changes
POST   /api/v1/admin/branding/{tenantId}/reset    # Reset to defaults
GET    /api/v1/admin/branding/{tenantId}/audit    # Get audit log
```

#### **Tenant Selection API:**
```
GET    /api/v1/admin/tenants                     # List tenants with branding status
GET    /api/v1/admin/tenants/search?q={query}    # Search tenants
GET    /api/v1/admin/tenants/{tenantId}/status   # Get tenant + branding status
```

### **VUE 3 COMPONENT ARCHITECTURE:**

```vue
<!-- Example: BrandingEditor.vue -->
<script setup>
// Composition API with TypeScript
import { useBrandingStore } from '@/Stores/brandingStore';
import { ref, computed, watch } from 'vue';
import WcagValidator from './WcagValidator.vue';
import ColorPicker from './ColorPicker.vue';

// Reactive form state
const form = ref({
  primaryColor: '#1976D2',
  secondaryColor: '#2E7D32',
  heroTitle: '',
  heroSubtitle: '',
  ctaText: '',
  logoFile: null
});

// Real-time WCAG validation
const wcagCompliance = computed(() => {
  return validateColorContrast(form.value.primaryColor, form.value.secondaryColor);
});

// Auto-save with debounce
const { saveBranding, isSaving } = useAutoSave(form, 1000);
</script>

<template>
  <div class="branding-editor">
    <div class="editor-preview-split">
      <BrandingForm :model="form" @update:model="form = $event" />
      <BrandingPreview :config="form" />
    </div>
    <WcagValidator :compliance="wcagCompliance" />
    <AuditLog :tenantId="tenantId" />
  </div>
</template>
```

### **STATE MANAGEMENT (PINIA):**

```typescript
// resources/js/Stores/brandingStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { BrandingConfig, TenantBranding } from '@/Types/branding';

export const useBrandingStore = defineStore('branding', () => {
  // State
  const brandings = ref<Map<string, TenantBranding>>(new Map());
  const currentEditing = ref<BrandingConfig | null>(null);
  const isLoading = ref(false);
  const lastError = ref<string | null>(null);

  // Getters
  const sortedBrandings = computed(() => 
    Array.from(brandings.value.values())
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName))
  );

  const tenantsWithoutBranding = computed(() => 
    // Logic to find tenants without custom branding
  );

  // Actions
  async function fetchAllBrandings() {
    isLoading.value = true;
    try {
      const response = await axios.get('/api/v1/admin/branding');
      brandings.value = new Map(response.data.map(b => [b.tenantId, b]));
    } catch (error) {
      lastError.value = error.message;
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateBranding(tenantId: string, config: BrandingConfig) {
    try {
      const response = await axios.put(`/api/v1/admin/branding/${tenantId}`, config);
      
      // Update local state
      brandings.value.set(tenantId, response.data);
      
      // Emit domain event via WebSocket
      emitBrandingUpdated(tenantId, config);
      
      return response.data;
    } catch (error) {
      lastError.value = error.message;
      throw error;
    }
  }

  return {
    // State
    brandings,
    currentEditing,
    isLoading,
    lastError,
    
    // Getters
    sortedBrandings,
    tenantsWithoutBranding,
    
    // Actions
    fetchAllBrandings,
    updateBranding,
    // ... other actions
  };
});
```

### **REAL-TIME FEATURES:**

#### **1. Live Preview:**
- Instant CSS variable generation
- Mobile/Desktop preview toggle
- WCAG compliance indicators

#### **2. Collaborative Editing:**
- WebSocket notifications when branding is being edited
- Lock mechanism to prevent concurrent edits
- Change history with diffs

#### **3. Audit Trail:**
- Who changed what and when
- Change justification notes
- Rollback capability

---

## **🎨 UI/UX REQUIREMENTS**

### **Design System:**
- **Framework**: Tailwind CSS 3.0
- **Icons**: Heroicons v2
- **Charts**: Chart.js for analytics
- **Animations**: Vue Transitions + Framer Motion principles

### **Pages & Components:**

#### **1. Admin Dashboard (`/admin/dashboard`):**
- Tenant statistics (with/without branding)
- Recent branding changes
- WCAG compliance dashboard
- Quick search tenants

#### **2. Branding Management (`/admin/branding`):**
- **List View**: Table with search, filter, sort
- **Card View**: Visual preview cards
- **Bulk Actions**: Apply templates, reset multiple

#### **3. Branding Editor (`/admin/branding/{tenantId}/edit`):**
- **Form Section**: Color pickers, text inputs, file upload
- **Preview Section**: Real-time mobile/desktop preview
- **Validation Section**: WCAG compliance checker
- **History Section**: Audit log and version compare

#### **4. Template Library (`/admin/branding/templates`):**
- Pre-designed branding templates
- Industry-specific themes (political, NGO, corporate)
- Save custom templates

### **Accessibility Requirements:**
- WCAG 2.1 AA compliance for admin UI
- Keyboard navigation support
- Screen reader compatibility
- Color contrast validation

---

## **🔐 SECURITY & PERMISSIONS**

### **Authentication & Authorization:**
```php
// Middleware: Admin only
Route::middleware(['auth:sanctum', 'can:manage-branding'])->group(...);

// Policies
php artisan make:policy BrandingPolicy --model=TenantBranding

// Role-based access
- Platform Admin: Full access
- Branding Manager: Can edit but not delete
- Viewer: Read-only access
```

### **Rate Limiting:**
```php
// Different limits for admin vs public
'throttle' => [
    'admin' => '60,1',    // 60 requests/minute
    'public' => '100,1',  // 100 requests/minute
]
```

### **Audit Logging:**
```php
// All changes logged
DB::table('branding_audit_log')->insert([
    'tenant_id' => $tenantId,
    'user_id' => auth()->id(),
    'action' => 'update',
    'changes' => json_encode($changes),
    'ip_address' => request()->ip(),
    'user_agent' => request()->userAgent(),
    'created_at' => now(),
]);
```

---

## **🧪 TESTING STRATEGY**

### **1. Domain Layer Tests (PHPUnit):**
```php
// Tests/Unit/Contexts/Platform/Domain/BrandingUpdateTest.php
public function test_cannot_update_with_invalid_wcag_colors(): void
{
    $command = new UpdateBrandingCommand(
        tenantId: TenantId::fromString('nrna'),
        primaryColor: '#000000',
        secondaryColor: '#010101' // Insufficient contrast
    );
    
    $this->expectException(InvalidBrandingException::class);
    $this->expectExceptionMessage('WCAG AA contrast ratio not met');
    
    $handler = new UpdateBrandingHandler($this->repository, $this->wcagValidator);
    $handler->handle($command);
}
```

### **2. API Integration Tests:**
```php
// Tests/Feature/Contexts/Platform/Api/V1/Admin/BrandingControllerTest.php
public function test_admin_can_update_tenant_branding(): void
{
    $admin = User::factory()->admin()->create();
    $tenant = Tenant::factory()->create(['slug' => 'nrna']);
    
    $response = $this->actingAs($admin)
        ->putJson("/api/v1/admin/branding/{$tenant->id}", [
            'primary_color' => '#1976D2',
            'hero_title' => 'Updated Organization',
        ]);
    
    $response->assertStatus(200)
        ->assertJsonStructure(['data' => ['id', 'version', 'last_updated']]);
    
    $this->assertDatabaseHas('tenant_brandings', [
        'tenant_id' => $tenant->id,
        'primary_color' => '#1976D2',
    ]);
}
```

### **3. Vue Component Tests (Vitest):**
```javascript
// tests/unit/BrandingEditor.spec.js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BrandingEditor from '@/Components/Admin/Branding/BrandingEditor.vue';

describe('BrandingEditor', () => {
  it('validates color contrast on input', async () => {
    const wrapper = mount(BrandingEditor, {
      props: { tenantId: 'nrna' }
    });
    
    await wrapper.find('[name="primary_color"]').setValue('#000000');
    await wrapper.find('[name="secondary_color"]').setValue('#010101');
    
    expect(wrapper.find('.wcag-warning').exists()).toBe(true);
    expect(wrapper.find('.wcag-warning').text()).toContain('WCAG AA');
  });
});
```

### **4. E2E Tests (Cypress):**
```javascript
// cypress/e2e/admin-branding.cy.js
describe('Branding Management', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.visit('/admin/branding');
  });

  it('can create and preview branding', () => {
    cy.get('[data-test="tenant-search"]').type('nrna');
    cy.get('[data-test="tenant-card"]').first().click();
    
    cy.get('[data-test="color-picker-primary"]').click();
    cy.get('[data-test="color-hex-input"]').type('#1976D2{enter}');
    
    cy.get('[data-test="preview-mobile"]').should('be.visible');
    cy.get('[data-test="wcag-compliant"]').should('contain.text', 'AA');
    
    cy.get('[data-test="save-button"]').click();
    cy.get('[data-test="success-message"]').should('be.visible');
  });
});
```

---

## **📊 PERFORMANCE REQUIREMENTS**

### **Backend Metrics:**
- **API Response Time**: <100ms p95 for all endpoints
- **Database Queries**: <5 queries per request
- **Cache Hit Rate**: >90% for branding data
- **Concurrent Users**: Support 50+ admin users simultaneously

### **Frontend Metrics:**
- **First Contentful Paint**: <1.5s
- **Time to Interactive**: <3s
- **Bundle Size**: <500KB gzipped
- **Lighthouse Score**: >90 on all categories

### **Optimization Strategies:**
1. **Lazy Loading**: Split admin routes from main app
2. **Virtual Scrolling**: For tenant lists (1000+ tenants)
3. **Optimistic Updates**: UI updates before API response
4. **CDN for Assets**: Logo images served via CDN

---

## **🔧 DEPLOYMENT & MONITORING**

### **Deployment Checklist:**
```bash
# 1. Database migrations
php artisan migrate --database=landlord

# 2. Frontend build
npm run build

# 3. Cache warming
php artisan branding:cache-warm

# 4. Feature flag enable
php artisan feature:enable branding-admin-v1
```

### **Monitoring Dashboard:**
```yaml
# Grafana Dashboard - Branding Admin
metrics:
  - api_response_time_admin_branding
  - branding_updates_per_hour
  - wcag_compliance_rate
  - user_engagement_admin
  - error_rate_4xx_5xx
```

### **Alerting Rules:**
- **P1**: Branding API >500ms p95 for 5 minutes
- **P2**: WCAG validation failures >10% of updates
- **P3**: Admin UI bundle size >500KB

---

## **📝 DOCUMENTATION REQUIREMENTS**

### **Technical Documentation:**
1. **API Reference**: OpenAPI 3.0 specification
2. **Component Library**: Storybook for Vue components
3. **Architecture Decision Records**: ADRs for key decisions
4. **Deployment Guide**: Step-by-step production deployment

### **User Documentation:**
1. **Admin User Guide**: Step-by-step branding management
2. **WCAG Compliance Guide**: How to create accessible branding
3. **Troubleshooting Guide**: Common issues and solutions
4. **Training Materials**: Screencasts and tutorials

---

## **🎯 SUCCESS CRITERIA**

### **Technical Success:**
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance metrics met
- [ ] Zero security vulnerabilities
- [ ] 100% WCAG AA compliance in admin UI
- [ ] Comprehensive monitoring in place

### **Business Success:**
- [ ] 80% tenant adoption of custom branding
- [ ] <5 support tickets/month for branding issues
- [ ] 30% reduction in manual branding requests
- [ ] Positive user feedback from admins

### **Code Quality:**
- [ ] 90%+ test coverage
- [ ] <5% code duplication
- [ ] All TypeScript strict mode compliant
- [ ] No anti-patterns in DDD implementation

---

## **🚨 RISK MITIGATION**

### **Technical Risks:**
1. **Performance with 1000+ tenants**
   - Mitigation: Virtual scrolling, pagination, server-side search

2. **Concurrent editing conflicts**
   - Mitigation: Optimistic locking, WebSocket notifications

3. **WCAG compliance complexity**
   - Mitigation: Automated validation, pre-approved templates

### **Business Risks:**
1. **Admin adoption rate**
   - Mitigation: Intuitive UI, training, gradual rollout

2. **Brand consistency across tenants**
   - Mitigation: Template library, approval workflows

3. **Support load increase**
   - Mitigation: Comprehensive documentation, self-service features

---

## **🤝 STAKEHOLDER ALIGNMENT**

### **Weekly Checkpoints:**
- **Monday**: Architecture review & API design
- **Wednesday**: UI/UX review & component library
- **Friday**: Demo & feedback session

### **Key Decisions Requiring Approval:**
1. Database schema changes (if extending domain model)
2. Breaking API changes
3. Third-party library additions
4. Performance optimization strategies

### **Communication Channels:**
- **Daily Standup**: Progress & blockers
- **Slack Channel**: `#phase4-branding-admin`
- **JIRA Board**: All tasks tracked
- **Figma**: UI design collaboration

---

## **🎖️ ARCHITECT'S FINAL NOTES**

### **Critical Non-Negotiables:**
1. **DDD Purity**: No framework dependencies in Domain layer
2. **TDD Discipline**: Write tests first, always
3. **6-Case Routing**: Maintain architectural consistency
4. **Accessibility**: WCAG 2.1 AA compliance mandatory

### **Quality Gates:**
```bash
# Before merging any PR:
1. php artisan test --coverage --min=90
2. npm run type-check
3. npm run lint
4. npm run build
5. cypress run --headless
```

### **Architecture Review Points:**
- Are we maintaining bounded context separation?
- Are domain events being properly emitted/handled?
- Is the repository pattern correctly implemented?
- Are we avoiding anemic domain models?
- Is the frontend properly layered (components, stores, services)?

---

**READY TO IMPLEMENT**: This plan provides a comprehensive, professional approach to Phase 4 that respects our established architecture while delivering a modern, usable admin interface. The TDD approach ensures quality, and the DDD principles maintain our architectural integrity.

**First Task**: Begin with Day 1-2 - extending the domain model and writing failing tests. This sets the foundation for everything that follows.