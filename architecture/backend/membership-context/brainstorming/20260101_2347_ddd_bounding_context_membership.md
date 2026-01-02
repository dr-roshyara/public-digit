# 🧠 **DDD BOUNDARIES & BUSINESS CASE STUDY**

## **🎯 BUSINESS REALITY: Political Party Membership**

### **Analogy: Army Ranks vs Soldier Types**
- **Rank** = Hierarchy (Private → Sergeant → Captain)
- **Type** = Specialization (Infantry, Artillery, Medic)
- **Status** = Active/Reserve/Retired

In Political Parties:
- **Rank** = Committee position (Member → Ward Secretary → District President)
- **Type** = Membership category (Full, Associate, Youth, Student)
- **Status** = Active/Suspended/Expired

---

## **🗺️ DDD CONTEXT BOUNDARIES**

### **1. Identity & Access Context**
**Responsibility:** Authentication, RBAC, User Profiles
```php
Bounded Context: TenantAuth
Domain: Who can access the system
Entities: TenantUser, Role, Permission
```

### **2. Membership Core Context**
**Responsibility:** Political identity, lifecycle, categorization
```php
Bounded Context: Membership
Domain: Who belongs to the party politically
Entities: Member, MembershipType, MembershipHistory
Aggregate Root: Member
```

### **3. Geography Context (Shared Kernel)**
**Responsibility:** Territorial organization hierarchy
```php
Bounded Context: Geography  
Domain: Where members belong geographically
Entities: Province, District, Ward, GeographyNode
```

### **4. Committee Context**
**Responsibility:** Organizational structure, leadership positions
```php
Bounded Context: Committee
Domain: Who holds what position
Entities: Committee, CommitteePosition, Term
```

### **5. Finance Context**
**Responsibility:** Membership fees, donations, expenses
```php
Bounded Context: Finance
Domain: Party funding and financial obligations
Entities: Levy, Payment, Donation
```

### **6. Communication Context**
**Responsibility:** Party discussions, announcements
```php
Bounded Context: Forum
Domain: Internal party communications
Entities: Forum, Post, Comment
```

---

## **📊 BUSINESS CASE STUDY: "Nepal Communist Party (UML)"**

### **Current Manual Process:**
1. **Applicant** → Fills paper form at Ward office
2. **Ward Secretary** → Verifies address, collects 2 photos, ₹100 fee
3. **District Committee** → Monthly meeting approves batch
4. **Central Office** → Issues membership card (3 months later)
5. **Problems:** Lost forms, fake members, no central database, slow process

### **Digital Transformation Goals:**
1. **Real-time membership registry**
2. **Digital verification** (QR code membership card)
3. **Automated fee collection**
4. **Hierarchical communication**
5. **Merit-based leadership tracking**

---

## **👥 MEMBERSHIP TYPES ANALYSIS**

### **Type A: Full Members**
```php
class FullMember extends MemberType {
    protected $name = 'full';
    protected $fee = 1000;
    protected $votingWeight = 1.0;
    protected $canHoldOffice = true;
    protected $minAge = 18;
    // Can vote, contest elections, hold committee positions
}
```

### **Type B: Associate Members**
```php
class AssociateMember extends MemberType {
    protected $name = 'associate';
    protected $fee = 500;
    protected $votingWeight = 0.5;
    protected $canHoldOffice = false;
    // Can participate, but limited voting rights
    // Example: Business supporters, diaspora
}
```

### **Type C: Youth Members**
```php
class YouthMember extends MemberType {
    protected $name = 'youth';
    protected $fee = 250;
    protected $votingWeight = 0.8;
    protected $canHoldOffice = true;
    protected $maxAge = 35;
    // Youth wing, special forums, leadership programs
}
```

### **Type D: Student Members**
```php
class StudentMember extends MemberType {
    protected $name = 'student';
    protected $fee = 100;
    protected $votingWeight = 0.3;
    protected $canHoldOffice = false;
    protected $requiresStudentId = true;
    // Campus politics, student union participation
}
```

### **Additional Dimensions:**
- **Time Commitment:** Full-time vs Part-time activists
- **Tenure:** New member (<1 year) vs Veteran (>10 years)
- **Activity Level:** Active vs Passive members

---

## **🔗 CONTEXT MAPPING RELATIONSHIPS**

```
[Identity Context]          [Geography Context]
       |                            |
       └────────────┬───────────────┘
                    ▼
           [Membership Context] ←─── [Committee Context]
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
[Finance]      [Forum]      [Scoring]
Context        Context      Context
```

### **Integration Patterns:**
- **Membership → Geography:** *Shared Kernel* (same geography model)
- **Membership → Finance:** *Customer/Supplier* (membership creates financial obligations)
- **Membership → Forum:** *Conformist* (forum access follows membership type)
- **Membership → Scoring:** *Anti-Corruption Layer* (scoring reads membership but doesn't modify)

---

## **🏛️ POLITICAL REALITY: Member Lifecycle**

### **Phase 1: Recruitment**
```php
// Local committee recruits in their ward
$recruiter = Member::find(123); // Ward Secretary
$applicant = $recruiter->recruitMember([
    'name' => 'Ram Bahadur',
    'ward_id' => 1756,
    'type' => MemberType::FULL,
    'sponsor_id' => $recruiter->id,
]);
```

### **Phase 2: Verification**
```php
// Committee verifies locally
$verificationResult = $committee->verifyMember($applicant, [
    'address_proof' => $document,
    'citizenship_verified' => true,
    'local_recommendation' => true,
]);
```

### **Phase 3: Activation**
```php
// System activates after approval
$member = $applicant->activate([
    'activated_by' => $committeePresident->id,
    'membership_number' => $this->generateMembershipNumber(),
    'start_date' => now(),
    'expiry_date' => now()->addYear(),
]);
```

### **Phase 4: Participation**
```php
// Member participates in party activities
$member->recordParticipation([
    'event' => 'Ward Meeting',
    'points' => 10,
]);

$member->makeDonation([
    'amount' => 500,
    'purpose' => 'Election Fund',
]);
```

---

## **💰 FINANCIAL MODEL: Party Economics**

### **Revenue Streams:**
1. **Membership Fees** (annual, varies by type)
2. **Donations** (from members, businesses)
3. **Event Fees** (conference, training)
4. **Merchandise** (party flags, badges)

### **Membership Fee Matrix:**
```
Full Member:    ₹1000/year
Associate:      ₹500/year  
Youth:          ₹250/year
Student:        ₹100/year
Life Member:    ₹10,000 (one-time)
```

### **Waiver Rules:**
- **Below Poverty Line:** 100% waiver
- **Senior Citizens (>60):** 50% waiver  
- **Martyr's Family:** 100% waiver
- **Disability:** 75% waiver

---

## **📱 DIGITAL TRANSFORMATION IMPACT**

### **Before Digital:**
- **Membership data:** Paper files in district offices
- **Communication:** Notice boards, phone trees
- **Payments:** Cash to ward secretary
- **Verification:** Physical card (easily forged)
- **Leadership tracking:** Word of mouth

### **After Digital:**
- **Real-time dashboard** for central committee
- **Mobile app** for members (events, discussions, dues)
- **Digital ID card** with QR code verification
- **Automated reminders** for renewals
- **Analytics** on membership growth, demographics

---

## **🎯 CRITICAL BUSINESS RULES**

### **Rule 1: One Member Per Geography**
```php
// Cannot have multiple active members at same address
if (Member::where('geo_path', $geoPath)
    ->where('household_id', $householdId)
    ->where('status', 'active')
    ->exists()) {
    throw new DuplicateMemberException('Only one active member per household');
}
```

### **Rule 2: Sponsorship Chain**
```php
// Who sponsored whom tracking
class SponsorshipChain {
    public function getSponsorTree(Member $member): array {
        // Ram → sponsored by Shyam → sponsored by Hari
        return [
            'member' => $member,
            'sponsor' => $member->sponsor,
            'sponsor_of_sponsor' => $member->sponsor->sponsor,
        ];
    }
}
```

### **Rule 3: Voting Eligibility**
```php
class VotingEligibilitySpecification {
    public function isSatisfiedBy(Member $member): bool {
        return $member->isActive()
            && $member->hasPaidCurrentFees()
            && $member->hasMinimumTenure(6) // 6 months
            && !$member->hasDisciplinaryActions();
    }
}
```

---

## **🚀 DIGITAL MEMBERSHIP CARD**

```php
class DigitalMembershipCard {
    private $member;
    private $qrCode;
    
    public function generate(): string {
        $data = [
            'member_id' => $this->member->id,
            'membership_number' => $this->member->membership_number,
            'name' => $this->member->full_name,
            'ward' => $this->member->ward->name,
            'expiry' => $this->member->expiry_date,
            'type' => $this->member->type,
            'signature' => $this->generateSignature(),
        ];
        
        $this->qrCode = QRCode::generate(json_encode($data));
        return $this->qrCode;
    }
    
    public function verify(string $scannedCode): bool {
        $data = json_decode($scannedCode, true);
        return $this->validateSignature($data['signature'])
            && $this->member->isActive()
            && !$this->member->isExpired();
    }
}
```

---

## **📈 LEADERSHIP SCORING ALGORITHM**

```php
class LeadershipScoreCalculator {
    public function calculate(Member $member): Score {
        $score = new Score();
        
        // 1. Tenure points (max 100)
        $score->add('tenure', min($member->years_active * 10, 100));
        
        // 2. Recruitment points (max 150)
        $score->add('recruitment', min($member->members_sponsored * 5, 150));
        
        // 3. Participation points (max 100)
        $score->add('participation', min($member->events_attended * 2, 100));
        
        // 4. Financial contribution (max 50)
        $score->add('financial', min($member->total_contributions / 1000, 50));
        
        // 5. Committee service (max 100)
        $score->add('committee', $member->committee_positions->count() * 20);
        
        // Total: 0-500 points
        return $score;
    }
}
```

---

## **🔐 SECURITY & COMPLIANCE**

### **Data Privacy:**
- **Membership data** = Political sensitive data
- **GDPR/Privacy Law compliance** required
- **Right to be forgotten** (but party may need to keep some records)

### **Audit Trail:**
```php
class MembershipAuditLog {
    public function log(Member $member, string $action, array $changes): void {
        AuditLog::create([
            'member_id' => $member->id,
            'action' => $action, // 'status_change', 'type_change', 'fee_waiver'
            'old_values' => json_encode($changes['old']),
            'new_values' => json_encode($changes['new']),
            'changed_by' => auth()->id(),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
```

---

## **🎯 IMMEDIATE IMPLEMENTATION PRIORITY**

### **Phase 1: Core Membership (Month 1)**
1. **Member entity** with proper 1:1 TenantUser link
2. **Membership types** (Full, Youth, Student, Associate)
3. **Geography integration** (ward/district assignment)
4. **Basic CRUD** with approval workflow

### **Phase 2: Financial Integration (Month 2)**
1. **Membership fee structure**
2. **Payment integration**
3. **Renewal reminders**
4. **Waiver management**

### **Phase 3: Digital Experience (Month 3)**
1. **Mobile app for members**
2. **Digital membership card**
3. **Forum/communication**
4. **Event management**

### **Phase 4: Analytics & Leadership (Month 4)**
1. **Dashboard for committees**
2. **Leadership scoring**
3. **Recruitment analytics**
4. **Financial reporting**

---

## **💡 KEY INSIGHT: This is NOT a CRM**

You're **not** building Salesforce for politicians. You're building **digital infrastructure for political organizations** that must:

1. **Mirror real-world party structures**
2. **Handle politically sensitive data**
3. **Support hierarchical decision-making**
4. **Manage financial transparency**
5. **Enable grassroots participation**

**The database schema should reflect political reality, not software convenience.**

---

**Do you want me to:**
1. **Design the complete Member aggregate with all types and states?**
2. **Create the committee approval workflow?**
3. **Build the financial integration model?**
4. **Design the scoring algorithm?**

Tell me which aspect you want to deep-dive into first.