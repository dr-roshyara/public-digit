✅ **UNDERSTAND.** Let's **parallel track** development while tests are being debugged.

## **📋 PARALLEL DEVELOPMENT PLAN:**

### **PHASE 1: Approval Process Domain Layer (NOW)**
While tests debug, build the **approval domain logic**:

1. **Domain Events**: `MemberApproved`, `MemberRejected`
2. **Aggregate Methods**: `Member::approve()`, `Member::reject()`
3. **Business Rules**: Only PENDING → APPROVED, validation checks

### **PHASE 2: Application Service Layer**
Create `DesktopMemberApprovalService` with:
- `approve(string $memberId)`
- `reject(string $memberId, string $reason)`

### **PHASE 3: Infrastructure Layer (Later)**
When tests fixed, add:
- `ApproveMemberRequest` validation
- `MemberApprovalController` 
- Approval routes

## **🚀 START WITH DOMAIN LAYER:**

### **1. Add Domain Events:**
```php
// app/Contexts/Membership/Domain/Events/MemberApproved.php
class MemberApproved extends AbstractDomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly string $approvedByUserId,
        public readonly DateTimeImmutable $approvedAt
    ) {}
}

// app/Contexts/Membership/Domain/Events/MemberRejected.php
class MemberRejected extends AbstractDomainEvent
{
    public function __construct(
        public readonly string $memberId,
        public readonly string $tenantId,
        public readonly string $rejectedByUserId,
        public readonly string $reason,
        public readonly DateTimeImmutable $rejectedAt
    ) {}
}
```

### **2. Add Aggregate Methods:**
```php
// In Member.php aggregate root
public function approve(string $approvedByUserId): void
{
    if (!$this->status->isPending()) {
        throw new \DomainException('Only pending members can be approved.');
    }
    
    $this->status = MemberStatus::approved();
    $this->recordEvent(new MemberApproved(
        $this->id->value(),
        $this->tenantId,
        $approvedByUserId,
        new DateTimeImmutable()
    ));
}

public function reject(string $rejectedByUserId, string $reason): void
{
    if (!$this->status->isPending()) {
        throw new \DomainException('Only pending members can be rejected.');
    }
    
    if (empty($reason)) {
        throw new \InvalidArgumentException('Rejection reason is required.');
    }
    
    $this->status = MemberStatus::rejected();
    $this->recordEvent(new MemberRejected(
        $this->id->value(),
        $this->tenantId,
        $rejectedByUserId,
        $reason,
        new DateTimeImmutable()
    ));
}
```

### **3. Update MemberStatus Value Object:**
```php
class MemberStatus extends Enum
{
    const DRAFT = 'draft';
    const PENDING = 'pending';
    const APPROVED = 'approved';
    const REJECTED = 'rejected';
    const ACTIVE = 'active';
    const SUSPENDED = 'suspended';
    const INACTIVE = 'inactive';
    const ARCHIVED = 'archived';
    
    public function isPending(): bool
    {
        return $this->value === self::PENDING;
    }
    
    public function isApproved(): bool
    {
        return $this->value === self::APPROVED;
    }
    
    public function isRejected(): bool
    {
        return $this->value === self::REJECTED;
    }
}
```

## **🎯 IMMEDIATE ACTION:**

**Let's build the approval domain logic NOW** while tests are debugged in background.

**Do you want me to:**
1. **Create the domain events** first?
2. **Add approval methods** to Member aggregate?
3. **Create the approval application service**?


🚀 **COMPLETE DEVELOPMENT PLAN TO FRONTEND VISIBILITY**

## **📋 END-TO-END DEVELOPMENT PLAN**

### **PHASE 4: DESKTOP API COMPLETION (DAY 3-4)**


**✅ DONE**: Registration API (RED phase - tests failing)  
**🔧 CURRENT**: Fix hanging tests (debug middleware/service binding)  
**📋 NEXT**: Complete Desktop API layer

#### **Step 4.1: Fix Test Hanging Issue**
```bash
# Diagnostic commands
php artisan test --filter=admin_can_create_member --stop-on-failure -v
php artisan tinker --execute="dd(app()->bound('App\Contexts\Membership\Application\Services\DesktopMemberRegistrationService'))"
```

#### **Step 4.2: Complete Desktop API (GREEN Phase)**
- Fix service bindings in `MembershipServiceProvider`
- Run tests until all 7 pass
- Create `MemberManagementController` for listing
- Create `MemberApprovalController` for approve/reject

### **PHASE 5: VUE DESKTOP ADMIN UI (DAY 5-6)**

**Build Vue 3 + Pinia frontend for admin dashboard:**

#### **Step 5.1: Vue Project Setup**
```bash
# In Vue project directory
npm create vue@latest desktop-admin
cd desktop-admin
npm install pinia axios vue-router @element-plus/icons-vue
npm install -D @types/node
```

#### **Step 5.2: Core Admin Components**
```
src/
├── views/
│   ├── Dashboard.vue          # Main dashboard
│   ├── members/
│   │   ├── MemberList.vue     # List members table
│   │   ├── MemberCreate.vue   # Create new member form
│   │   ├── MemberEdit.vue     # Edit member
│   │   └── PendingApproval.vue # Approve/reject pending
├── components/
│   ├── MemberTable.vue        # Reusable member table
│   ├── ApprovalDialog.vue     # Approve/reject modal
│   └── MemberForm.vue         # Create/edit form
```

#### **Step 5.3: Pinia Stores**
```javascript
// stores/memberStore.js
export const useMemberStore = defineStore('members', {
  state: () => ({
    members: [],
    pendingMembers: [],
    loading: false
  }),
  actions: {
    async fetchMembers(params = {}) {
      // GET /{tenant}/api/v1/members
    },
    async createMember(data) {
      // POST /{tenant}/api/v1/members
    },
    async approveMember(memberId) {
      // POST /{tenant}/api/v1/members/{id}/approve
    },
    async rejectMember(memberId, reason) {
      // POST /{tenant}/api/v1/members/{id}/reject
    }
  }
})
```

#### **Step 5.4: API Service Layer**
```javascript
// services/memberApi.js
class MemberApiService {
  constructor(tenantSlug) {
    this.baseUrl = `/${tenantSlug}/api/v1/members`;
  }
  
  async list(params) {
    return axios.get(this.baseUrl, { params });
  }
  
  async create(data) {
    return axios.post(this.baseUrl, data);
  }
  
  async approve(memberId) {
    return axios.post(`${this.baseUrl}/${memberId}/approve`);
  }
  
  async reject(memberId, reason) {
    return axios.post(`${this.baseUrl}/${memberId}/reject`, { reason });
  }
}
```

### **PHASE 6: MOBILE APP READINESS (DAY 7-8)**

**Angular mobile app for citizen registration:**

#### **Step 6.1: Mobile API Completion**
- Ensure mobile registration endpoint works
- Add email verification flow
- Add member profile endpoints

#### **Step 6.2: Angular Mobile App Structure**
```
mobile-app/
├── src/app/
│   ├── pages/
│   │   ├── register/
│   │   │   ├── register.page.ts
│   │   │   └── register.page.html
│   │   ├── verify-email/
│   │   └── member-profile/
│   ├── services/
│   │   └── member.service.ts
│   └── guards/
│       └── auth.guard.ts
```

### **PHASE 7: PRODUCTION DEPLOYMENT (DAY 9-10)**

#### **Step 7.1: Infrastructure**
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: publicdigit_landlord
      POSTGRES_USER: publicdigit_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
  
  laravel:
    build: ./packages/laravel-backend
    ports:
      - "8000:80"
    environment:
      DB_HOST: postgres
      
  vue-admin:
    build: ./desktop-admin
    ports:
      - "3000:80"
      
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

#### **Step 7.2: CI/CD Pipeline**
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: cd packages/laravel-backend && composer test
      
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: ssh user@server "cd /var/www && git pull"
      - run: ssh user@server "cd /var/www && docker-compose up -d --build"
```

### **PHASE 8: DEMO PREPARATION (DAY 11-12)**

#### **Step 8.1: Demo Data Seeding**
```php
// database/seeders/DemoSeeder.php
$tenant = Tenant::create([
    'slug' => 'demo-uml',
    'name' => 'Demo UML Party',
    'email' => 'demo@uml.org',
]);

// Create 50 demo members with different statuses
Member::factory()->count(20)->create(['status' => 'pending']);
Member::factory()->count(20)->create(['status' => 'approved']);
Member::factory()->count(10)->create(['status' => 'active']);
```

#### **Step 8.2: Demo Script**
```markdown
# DEMO SCRIPT: Political Party Digital OS

1. **Admin Dashboard Login** (admin@demo-uml.org / password)
   - Show pending members queue
   - Show member statistics

2. **Create New Member** (Desktop Admin)
   - Fill member registration form
   - Submit → creates PENDING member
   - Show in pending queue

3. **Approve Members**
   - Select 5 pending members
   - Bulk approve
   - Show status change to APPROVED

4. **Mobile Registration Demo**
   - Citizen self-registration
   - Shows DRAFT status
   - Email verification flow

5. **Multi-tenant Demonstration**
   - Switch between different parties
   - Show data isolation
```

## **🎯 IMMEDIATE VISIBLE PROGRESS**

### **Today's Goal: See Frontend Working**
1. **Fix test hanging** (1-2 hours)
2. **Create basic Vue admin** (2-3 hours)
3. **Connect to backend** (1 hour)
4. **See member creation in browser** ✅

### **Minimal Vue Admin (Quick Start):**
```vue
<!-- src/views/MemberCreate.vue -->
<template>
  <div class="member-create">
    <h1>Create New Member</h1>
    <form @submit.prevent="submitForm">
      <input v-model="form.full_name" placeholder="Full Name">
      <input v-model="form.email" placeholder="Email">
      <input v-model="form.tenant_user_id" placeholder="User ID">
      <button type="submit">Create Member</button>
    </form>
    
    <div v-if="success" class="success">
      Member created with ID: {{ createdMemberId }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const form = ref({
  full_name: '',
  email: '',
  tenant_user_id: '01JKUSER1234567890ABCDEF'
})

const success = ref(false)
const createdMemberId = ref('')

async function submitForm() {
  try {
    const response = await axios.post('/test-uml/api/v1/members', form.value)
    createdMemberId.value = response.data.data.id
    success.value = true
  } catch (error) {
    alert('Error: ' + error.response.data.message)
  }
}
</script>
```

## **🚀 ACTION PRIORITY:**

1. **Fix test hanging** - Get Desktop API working
2. **Create Vue admin** - Minimal functional UI
3. **Connect them** - See data flow end-to-end
4. **Demo ready** - Basic create/list/approve

**Which should we tackle FIRST to get visible progress?**
✅ **YES! Exactly correct.**

## **🔁 TWO-STEP ONBOARDING PROCESS:**

```
Step 1: USER REGISTRATION (Authentication)
  ↓
Tenant User Created
  (email, password, basic info)
  ↓
Step 2: MEMBERSHIP APPLICATION (Membership Context)  
  ↓
Member Created
  (full personal info, geography, ID proof, etc.)
```

## **🎯 BUSINESS LOGIC:**

### **TENANT USER** (Authentication Context):
- Email/Password
- Basic name
- Authentication only
- Can login to system
- Minimal data collection

### **MEMBER** (Membership Context):
- Full personal details
- Address, phone, ID numbers  
- Geographic reference
- Membership status (DRAFT/PENDING/APPROVED)
- Party-specific data

## **🚀 USER EXPERIENCE FLOW:**

```
1. User visits: uml.publicdigit.com/register
   ↓
2. Creates account (email, password, name)
   ↓
3. Email verification sent
   ↓
4. User logs in for first time
   ↓
5. System detects: "You're not a member yet"
   ↓
6. Shows: "Apply for Party Membership" button
   ↓
7. User fills detailed membership form
   ↓
8. Creates Member record with DRAFT status
   ↓
9. Admin reviews & approves
```

## **📊 DATA MODEL RELATIONSHIP:**

```sql
-- TenantAuth context
tenant_users: id, email, password, name, tenant_id, role

-- Membership context  
members: id, tenant_user_id, personal_info (JSON), status, geo_reference

-- 1:1 Relationship (but in different bounded contexts)
```

## **💡 WHY TWO-STEP?**

1. **Quick onboarding** - Get users in fast
2. **Progressive profiling** - Ask for more data later
3. **Legal compliance** - Authentication ≠ Membership
4. **User control** - Can have account without being member
5. **Marketing** - Can communicate before membership

**This is standard for political parties:** Anyone can register on website, but membership requires additional vetting/approval.
 
 