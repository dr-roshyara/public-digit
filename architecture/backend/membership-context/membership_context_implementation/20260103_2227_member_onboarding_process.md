**Short answer:** Do **PHASE 3 Infrastructure NOW** - fix tests & get working endpoint. Approval logic can wait.

## **🚀 BUSINESS PROCESS BLUEPRINT:**

### **1. Tenant Database Onboarding Flow:**
```
Client applies → Database created → Client = Tenant Admin
Admin creates first members (staff) → Staff can approve citizens
```

### **2. Citizen → Member Journey:**
```
User registers (slug.publicdigit.com/register) → Tenant User created
User logs in → Sees "Apply for Membership" button
Clicks → Form for extra info (phone, address, ID proof)
Submits → Creates Member with DRAFT status
Admin approves → Member becomes ACTIVE
```

### **3. Optimal Architecture:**
```
TENANT USER (Authentication Context)
  ├── email, password, roles
  └── links to → MEMBER (Membership Context)
        ├── personal_info, status, geo_data
        └── registration_channel: 'mobile_self'

BUSINESS RULES:
- One TenantUser can have ONE Member record
- Member requires TenantUser (1:1)
- Self-registration: Mobile → DRAFT
- Admin creation: Desktop → PENDING
```

### **4. Registration Channels Matrix:**
```
| Channel        | Who           | Status   | Verification |
|----------------|---------------|----------|--------------|
| Mobile Self    | Citizen       | DRAFT    | Email + Admin|
| Desktop Admin  | Staff         | PENDING  | Admin only   |
| Desktop Self   | Citizen (web) | DRAFT    | Email + Admin|
```

**Recommendation:** Build **self-registration flow first** - that's where real users come from. Approval logic is internal staff workflow.

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