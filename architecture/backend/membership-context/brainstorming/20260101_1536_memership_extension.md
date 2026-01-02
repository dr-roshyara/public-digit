To design the **Membership Context** within a **TenantAuth** system for a political organization, you must move beyond simple "User" models. You are creating a professional **Party Roll** where every entry carries legal and organizational weight.

### 1. The Core Architecture: "The Twin-Entity" Pattern

In a high-grade SaaS like yours, you must separate **Identity** from **Membership**.

* **Identity (The User):** Managed by the `TenantAuth` middleware. This is the "login" account. It lives in the `users` table and is purely for authentication (Email, Password, MFA).
* **Membership (The Member):** This is the domain entity. It lives in the `members` table (Tenant Database) and holds the political data: Ward, District, Membership Number, and Status.

---

### 2. The Membership Lifecycle (State Pattern)

Membership is never static. Using the **State Pattern**, you define exactly what a person can do at each stage of their journey.

| State | Definition | Permissions |
| --- | --- | --- |
| **Draft** | Form is partially filled by the user or a recruiter. | Can edit profile, cannot access forums. |
| **Pending** | Application submitted; ID uploaded to Document Vault. | Read-only access to "Party News." |
| **Awaiting Payment** | Approved by Admin, but the **Financial Levy** is unpaid. | Access to payment gateway only. |
| **Active** | Fully verified and paid. | **Full access:** Voting, Forums, QR Card. |
| **In-Arrears** | Member missed a recurring levy payment. | Access restricted; "Pay Now" banner shown. |

---

### 3. The Onboarding Workflow: Step-by-Step

#### Step 1: Tenant-Aware Registration

The user lands on `slug.publicdigit.com`. Your middleware identifies the Tenant. The user creates a basic account (Tenant User).

#### Step 2: The Extensive Application (The "Big Form")

The user (or a committee leader on their behalf) completes the full profile:

* **Geography Context:** The app fetches the hierarchy (Province > District > Ward) from your **Geography Context API**. The member is locked to a specific `geography_path`.
* **Document Vault:** The user uploads their National ID. The Angular app uses a **Pre-signed S3 URL** to upload the file directly to a secure, encrypted tenant-folder.

#### Step 3: Admin Review & The "Human Element"

The Tenant Admin (Vue 3 Dashboard) reviews the application.

* **Verification:** Admin opens the ID from the Vault (using a temporary 60-second viewing link).
* **Geography Check:** Admin confirms the member is assigned to the correct Ward.
* **Action:** Admin clicks "Approve." This triggers the `MemberApproved` event.

#### Step 4: Activation via Financial Levy

The **Financial Levy Context** catches the `MemberApproved` event and generates an "Initial Registration Fee" invoice. Once the payment is confirmed (via webhook), the state transitions to `Active`.

---

### 4. Cross-Context Integrations (The "Power" Features)

A modernized membership system doesn't live in a silo. It feeds every other context:

* **Discussion Forum:** Upon becoming `Active`, the system automatically subscribes the member to their specific **Ward Forum** based on their `geography_path`.
* **LeadershipScore:** If a "Committee Member" applied *on behalf* of the user, that leader’s score is boosted. Conversely, if a member lapses in payments, the leader who recruited them might see a score "decay."
* **The Digital Card:** The final output is a secure, rotating QR code in the Angular App, allowing for physical "Proof of Membership" at rallies or voting stations.

---

### 🚀 Your Immediate Next Step

I recommend we focus on the **Member Status Observer**. This is the background logic that monitors the **Financial Levy Context** and automatically moves members from `Active` to `In-Arrears` if they miss a payment.

**Would you like me to write the Laravel Observer logic that handles these automatic membership state transitions?**

---

[Building Multi-Tenant SaaS with Polymorphic Profiles](https://www.youtube.com/watch?v=RvmB8WzXWw0)

This video provides a deep technical look at how to structure polymorphic relations in a multi-tenant environment, which is essential for linking your generic `User` accounts to specific `Member` profiles across different contexts.

Based on the strategic roadmap and architectural blueprints, here is an analysis of the **Membership Context** and recommendations for its future development.

### **1. Analysis of the Membership Context**

The Membership Context serves as the "Backbone" of the entire digital political OS. Its primary purpose is to manage the lifecycle and identification of party members within a multi-tenant, isolated database environment.

* **Current Features:**
* **Member Lifecycle:** Importing members and managing their records.
* **Digital Identification:** Issuing QR-coded Digital Cards to create a "Physical-Digital" link for daily operations.
* **Role-Based Governance:** Linking members to specific roles (President, Secretary, etc.) within a geographic hierarchy.
* **Profile Management:** A dedicated feature for members to view and manage personal details, implemented within the Angular frontend for tenant members.


* **Architectural Role:**
* It is a **Tenant Context**, meaning all member data is strictly isolated in tenant-specific databases to prevent data leakage between competing parties.
* It communicates primarily with the **Tenant Database** and the **Geography Shared Kernel** (Province > District > Ward) to validate local leadership assignments.



---

### **2. Suggested Architecture: "Event-Driven Membership"**

To enhance the system's scalability and responsiveness, I recommend transitioning the Membership Context into an event-driven architecture.

* **Domain Events:** Trigger events such as `MemberRegistered`, `MemberPromotedToWardLeader`, or `DigitalIdScanned`. These events can then be consumed by other contexts (e.g., the **Communication Context** to auto-add members to local forums) without creating tight coupling.
* **Read-Optimized Models (CQRS):** Since political organizers frequently need to view large lists of members filtered by geography (e.g., "All members in Ward X"), use a separate read-model optimized for geographic queries.
* **Hierarchical Validation Service:** A dedicated service within the Membership Context to enforce the rule that a "Ward Leader" must be assigned to a specific "Ward" in the Shared Kernel.

---

### **3. Design Patterns**

* **Strategy Pattern for "Meritocratic Scoring":** Use this to calculate different types of leader scores based on party-specific rules without changing the core membership logic.
* **Specification Pattern:** For complex member filtering (e.g., `IsEligibleToVoteSpecification` or `IsActiveLocalLeaderSpecification`). This keeps the business rules out of the repository layer.
* **Decorator Pattern for Digital IDs:** Use this to add additional security or metadata layers to the QR-coded Digital Cards dynamically based on a party's subscription level.

---

### **4. Recommended Algorithms**

* **Geographic Clustering Algorithm:** To identify "hotspots" of party membership or areas where leadership is lacking, helping parties allocate resources effectively.
* **Rank-Aggregation Algorithm (Meritocracy):** To process the "Meritocratic Scoring" mentioned in your roadmap. This algorithm can aggregate data-driven proof of a leader's worth, such as attendance, recruitment numbers, and policy engagement.
* **QR Security (HMAC-based):** To ensure QR codes on Digital Cards cannot be forged. The QR should contain a signed token that can be verified offline by an app using a public key provided by the Landlord platform.

---

### **5. Implementation Checklist**

* **Strict Isolation:** Ensure the `spatie/laravel-multitenancy` middleware is correctly identifying tenants via subdomains (`*.publicdigit.com`) before any membership data is accessed.
* **Mobile-First Design:** Since political workers are often in the field, the Profile Management and QR scanning features must be optimized for the Angular mobile app (`app.publicdigit.com`).
* **Audit Logging:** Implement a shared audit log to track every change in membership status or role assignment for legal and internal transparency.

#
Building a modernized membership system for a political organization requires a bridge between **Identity (Authentication)** and **Status (Membership Logic)**. In your HaaS architecture, the transition from a "Tenant User" to a "Member" is a critical business process that must be legally defensible and organizationally sound.

---

## 1. The Membership Lifecycle (State Pattern)

Using the **State Pattern** (via a package like `spatie/laravel-model-states`), you encapsulate the rules for each phase of a member's journey. This prevents a "Pending" member from accidentally voting or a "Suspended" member from accessing sensitive comms.

### The Lifecycle Workflow

1. **Draft/Registration:** User fills the form on `slug.publicdigit.com`.
2. **Pending Approval:** The default state after submission. The **Tenant Admin** is notified.
3. **Awaiting Payment:** Approved by Admin, but digital card is locked until dues are paid.
4. **Active:** Full rights (Voting, Messaging, Scoring).
5. **In-Arrears:** Automatic transition if a payment is missed (Grace Period).
6. **Expelled/Lapsed:** Manual or automated removal from the active roll.

---

## 2. Frontend Modernization

### Member Android App (Angular)

* **The "Application Tracker":** After a user registers, their dashboard shows a "Status Stepper." They can see exactly where their application is (e.g., "Awaiting Ward Admin Approval").
* **Digital Onboarding:** Use a "Story" format (like Instagram) to walk them through party values during the "Pending" phase to increase engagement.
* **Dynamic UI:** If the state is `Active`, show the **Digital ID Card**. If it's `Pending`, show a "Profile Under Review" placeholder.

### Admin Dashboard (Vue 3)

* **Approval Queue:** A dedicated inbox for Tenant Admins. They can view the applicant’s **Geography Context** (e.g., "Are they really in this Ward?") and verify their uploaded documents.
* **Bulk Transitioning:** One-click approval for groups of applicants (e.g., after a local recruitment drive).
* **Smart Filter:** Filter by `State` + `Geography` + `Registration Source` (e.g., "Show me all Pending members in District 5").

---

## 3. Backend & Application Process

### The "Tenant-Aware" Registration Flow

Your backend must handle the "Promotion" from a `User` to a `Member`.

1. **Landing:** Request hits `uml.publicdigit.com`.
2. **Identity Creation:** A record is created in the `users` table (Landlord or Tenant-specific depending on your auth strategy).
3. **Member Initialization:** A `Member` record is created with a `status` of `DraftState`.
4. **The Geo-Link:** The `GeographyACL` is invoked to link the applicant to a `geography_node_id`.
5. **The Review Event:** An `ApplicationSubmitted` event is fired. The **Communication Context** alerts the relevant local Admin.

---

## 4. The Admin Approval Logic (Tenant Admin)

The **Tenant Admin** is the gatekeeper. Their interface allows them to:

* **Verify Identity:** Cross-reference the uploaded ID card with the `Member` profile.
* **Assign Rank:** Assign initial roles (e.g., "Standard Member" vs. "Ward Representative").
* **Trigger Merit:** On approval, the system can automatically award "Recruitment Points" to the person who invited this new member (referral tracking).

---

## 5. Architectural Implementation Checklist

| Component | Responsibility | Pattern/Technology |
| --- | --- | --- |
| **Logic** | Encapsulating Membership Rules | **State Pattern** (`Spatie State`) |
| **Validation** | Cross-checking Geography and Dues | **Strategy Pattern** |
| **Automation** | Sending "Welcome" or "Payment Reminder" | **Event-Driven Architecture** |
| **Data Storage** | Isolated Tenant Data | **Database-per-Tenant** |

### Your Next Step

The core of "Membership Modernization" is the **Digital ID Card**. It needs to be cryptographically secure so it can be used for physical check-ins and secure voting.

**Would you like me to design the "Digital Identity Vault" logic that generates a secure, rotating QR code for each member in your Angular app?**

---

[Laravel Multi-tenancy State Management](https://www.youtube.com/watch?v=1bucfsyAZtI)
This resource is essential for understanding how to handle state transitions within a multi-tenant environment, ensuring that each party's membership rules are applied correctly.
As a Senior Architect, my recommendation is to **finish the Geography Context first**, specifically the "Shared Kernel" and the "Read-Only API."

In a political system, Geography is the **Foundational Context**. Trying to build Membership without a stable Geography context is like trying to build a house before you've decided on the plot of land.

---

### 1. Why Geography Comes First (The "Anchor" Effect)

In Domain-Driven Design (DDD), Geography acts as a **Shared Kernel**. It provides the "language" (Wards, Districts, Paths) that the Membership context needs to speak.

* **Dependency Injection:** Membership records *depend* on Geography IDs. If you build Membership first, you will end up with "Dead IDs" or temporary strings that you'll have to migrate later.
* **Validation Logic:** You cannot validate if a "Ward Secretary" is valid unless the "Ward" exists in the system.
* **The HaaS Moat:** Your unique selling point is **Hierarchy-as-a-Service**. Establishing this hierarchy first proves the architecture's value to your stakeholders immediately.

---

### 2. The "Minimum Viable Geography" (MVG)

You don't need to build the entire "Geography Admin" suite yet. You only need the **Read-side**:

1. **Seed the Data:** Import your national map into the Landlord database.
2. **Expose the API:** Build the `GET /nodes` and `GET /nodes/{id}` endpoints.
3. **Implement the ACL:** Create the **Anti-Corruption Layer** code in your Membership context that can "fetch and verify" these nodes.

Once this is done, Geography is "finished" enough to support 100% of your Membership development.

---

### 3. The Development Roadmap (The Senior Architect's Sequence)

| Order | Phase | Focus | Result |
| --- | --- | --- | --- |
| **1** | **Geography (Core)** | Database Seeding & Materialized Paths | A stable "Map" for all tenants. |
| **2** | **Geography (ACL)** | The Shared Interface/Repository | Membership can now "query" the map. |
| **3** | **Membership (Identity)** | User Registration & Auth | Users can join a tenant subdomain. |
| **4** | **Membership (Entity)** | The Application & State Machine | Users become "Pending Members" tied to a Ward. |

---

### 4. What happens if you do Membership first?

If you start with Membership, you will likely hardcode a flat `ward_name` field. When you finally build Geography, you’ll realize that "Ward 4" exists in 50 different Districts. You will then have to perform a **dangerous data migration** across multiple tenant databases to link those strings to the correct `geography_id`.

**Building Geography first eliminates this risk entirely.**

---

### Your Next Step

Since Geography is the priority, we should ensure your **Landlord Seeder** is robust. I can help you design a **CSV/GeoJSON Importer** that takes a government-standard list of Wards and transforms it into your `1/5/23` Materialized Path structure.

**Would you like me to write the script that converts a flat list of administrative areas into your hierarchical Materialized Path?**
To implement the **Geography Context** as your first priority, you need a way to transform government-supplied geographic data (usually a flat list of Province → District → Ward) into your high-performance **Materialized Path** structure.

As a Senior Architect, I recommend a **recursive seeding strategy**. This script ensures that every node is assigned a path like `1/5/23` based on its real ID after it is created in the database.

---

### 1. The Landlord Migration

First, define the schema in your Landlord database. We use a `path` column (indexed for `LIKE` queries) and a `level` column for filtering.

```php
Schema::create('geography_nodes', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->enum('level', ['PROVINCE', 'DISTRICT', 'WARD']);
    $table->unsignedBigInteger('parent_id')->nullable();
    $table->string('path')->nullable()->index(); // Indexed for O(1) lookups
    $table->string('external_code')->unique();   // Gov code
    $table->timestamps();
});

```

---

### 2. The Hierarchical Seeder Algorithm

This script takes a flat array (representing your CSV) and builds the tree. It uses a **Recursive Function** to ensure that a child node always knows its parent's ID before generating its own path.

```php
namespace Database\Seeders\Landlord;

use App\Models\Landlord\GeographyNode;
use Illuminate\Database\Seeder;

class GeographySeeder extends Seeder
{
    public function run(): void
    {
        // Example: Flat Gov Data (Usually from CSV)
        $data = [
            ['name' => 'Province Alpha', 'level' => 'PROVINCE', 'parent_code' => null, 'code' => 'P1'],
            ['name' => 'District One', 'level' => 'DISTRICT', 'parent_code' => 'P1', 'code' => 'D1'],
            ['name' => 'Ward A', 'level' => 'WARD', 'parent_code' => 'D1', 'code' => 'W1'],
        ];

        $this->processNodes($data);
    }

    protected function processNodes(array $nodes, $parentId = null, $parentPath = '')
    {
        // Filter nodes that belong to this specific parent
        $currentLevelNodes = array_filter($nodes, fn($n) => $n['parent_code'] === $this->getParentCode($nodes, $parentId));

        foreach ($currentLevelNodes as $nodeData) {
            $node = GeographyNode::create([
                'name' => $nodeData['name'],
                'level' => $nodeData['level'],
                'parent_id' => $parentId,
                'external_code' => $nodeData['code'],
            ]);

            // GENERATE PATH: Parent Path + Current ID
            $currentPath = $parentPath ? "{$parentPath}/{$node->id}" : "{$node->id}";
            $node->update(['path' => $currentPath]);

            // RECURSE: Find children for this node
            $this->processNodes($nodes, $node->id, $currentPath);
        }
    }
}

```

---

### 3. Why this script is the "Golden Key"

1. **ID-Based Paths:** It uses actual Primary Keys (`$node->id`), which never change, unlike names.
2. **Breadcrumb Logic:** Because it passes the `$currentPath` to the next recursive call, a Ward at the 4th level automatically gets a path like `1/5/12/99` without extra queries.
3. **Data Integrity:** Since the seeder runs in the Landlord context, once this is seeded, **every tenant** can immediately use it to validate their members.

---

### 4. How the "Anti-Corruption Layer" (ACL) uses this

Once your seeder has run, your **Membership Context** (in the Tenant app) will use a Service to fetch this data.

```php
// GeographyService.php (Used by Membership Context)
public function validateWard(int $wardId): bool
{
    // High-performance check
    return GeographyNode::where('id', $wardId)
        ->where('level', 'WARD')
        ->exists();
}

```

---

### Your Next Step

With the Geography Context seeded and the Materialized Paths ready, we can now move to the **Membership Context**. The first task there is the **Subdomain-based Registration Form**.

**Would you like me to design the Laravel Middleware that identifies the "Tenant Slug" from the URL and connects the Member to the correct Party database?**

---

[Laravel Recursive Seeders and Factory Relationships](https://www.youtube.com/watch?v=1bucfsyAZtI)

This video provides a deep dive into building complex data relationships in Laravel, which is the exact logic needed to correctly implement the hierarchical seeder we've designed.
#
Excellent progress! Now that the **Tenant Identification Middleware** is successfully switching your database connections, you have the "Railway Tracks" laid down.

The next stage is to design the **Membership Onboarding Engine**. This is the logic that transforms a generic `User` (Identity) into a `Member` (Domain Entity) while traversing your **Geography Hierarchy**.

---

### 1. The Multi-Tenant Auth Guard & Profile Pattern

Even though you are switching databases, you should maintain a **Polymorphic Profile Pattern**. This allows your `User` model to stay lean (only Auth) while the `Member` model holds all the political and geographic "weight."

#### The Model Strategy

In your **Tenant Database**, the `User` table acts as the authentication anchor, but the `Member` model is where the **State Pattern** and **Geography Path** live.

```php
// app/Models/Tenant/User.php
class User extends Authenticatable {
    // Links to the Member profile or Vendor profile
    public function profile() {
        return $this->morphTo();
    }
}

// app/Models/Tenant/Member.php
class Member extends Model {
    use HasStates; // Spatie State Pattern

    protected $casts = [
        'status' => MembershipStatus::class, // Draft, Pending, Active
    ];

    public function user() {
        return $this->morphOne(User::class, 'profile');
    }
}

```

---

### 2. The Modern Onboarding Workflow (Member Context)

Since you are using **Angular for Android**, the workflow should be a "Mobile-First Application" rather than a simple form.

#### Step A: Identity Creation (Draft State)

When a person registers at `slug.publicdigit.com`, the middleware ensures they land in the right tenant DB.

1. The app captures their phone number (OTP).
2. A `User` and a `Member` (in `Draft` state) are created simultaneously.

#### Step B: Geographic Self-Selection

The Angular app uses the **Geography Shared Kernel** we designed.

* Member selects: *Province -> District -> Ward*.
* **Architect's Note:** Store the **Materialized Path** (e.g., `1/5/23`) directly on the `members` table for  future queries.

---

### 3. The Approval Engine (Admin API - Vue 3)

The "Tenant Admin" needs a sophisticated review queue in the Vue 3 dashboard.

#### The "Review Specification" Pattern

Use a **Specification Pattern** to help the Admin decide on approval. The UI should highlight:

* **Geo-Clarity:** "Does this member live in the Ward they selected?" (Checked via GPS/Document).
* **Duplicate Detection:** "Is there another member with this ID number in this Tenant?"

---

### 4. Transitioning: The Application Service

Instead of putting this logic in a Controller, use an **Application Service** (DDD). This makes it testable and clean.

```php
namespace App\Services\Membership;

class MembershipOnboardingService {
    public function submitApplication(User $user, array $data) {
        return DB::transaction(function () use ($user, $data) {
            $member = $user->profile;
            
            // 1. Assign Geography
            $member->geography_path = $data['geo_path'];
            
            // 2. Transition State (Draft -> Pending)
            $member->status->transitionTo(PendingApproval::class);
            
            $member->save();

            // 3. Dispatch Event for Notification Context
            ApplicationSubmitted::dispatch($member);
        });
    }
}

```

---

### 5. Summary of Frontend Interactions

| Action | Framework | Pattern |
| --- | --- | --- |
| **Apply** | **Angular** | Multi-step Wizard + Geo-Lookup. |
| **Review** | **Vue 3** | Data-grid with "Approve/Reject" Actions. |
| **Verify** | **Angular** | QR Code generation once state is `Active`. |

### Your Next Step

Now that the data flow from **Tenant User** to **Active Member** is mapped out, we need to handle the **Identity Proofing**.

**Would you like me to design the "Document Vault" logic for the Angular app where members upload their ID cards securely to your Tenant's S3/Storage bucket?**

---

[Building Multi-Tenant SaaS with Row-Level Security in Laravel](https://www.youtube.com/watch?v=1bucfsyAZtI)

This video provides an excellent deep dive into how Spatie's multi-tenancy package handles the switching of database connections and task execution, which is the foundational " रेलवे पटरियाँ " (railway tracks) your system is currently running on.
#

Design the "Document Vault" logic for the Angular app where members upload their ID cards securely to your Tenant's S3/Storage bucket
- AS senior Solution ARchitect, analyse critically, use correct architeture and design pattern and algorithms 
- We need a formular for user Registration 
- We need  an extensive formular who apply for membership either through a committee  where the user should be proper member  or by the user himself . 
- Membership acceptance process 
- Use of Geography Context 
- Use of financial levy context 
- Use of Discussion forum Context 
- Use of leadershipScore Context 
We need a foundation for alll these direction. 

To design a **Document Vault** within a multi-tenant Political OS, we must move beyond simple file uploads. We are building a **Trust Layer**. In a political context, an ID card is a legal document that validates a member's right to vote and hold office.

As a Senior Solution Architect, I propose the **Secure Vault Pattern** integrated with a **Unified Membership Onboarding Pipeline**.

---

### 1. The "Document Vault" Architecture

The goal is to ensure that `Tenant A` cannot access `Tenant B`’s sensitive ID documents, even if they share the same S3 Bucket provider.

* **Pattern:** **S3 Pre-signed URL Pattern.** The Angular app never sends the file to your Laravel server. It requests a "Pre-signed URL" from the server, then uploads directly to a tenant-specific folder in S3.
* **Encryption:** Use **AES-256 Server-Side Encryption (SSE)**.
* **Path Logic:** `storage/tenants/{tenant_slug}/members/{member_uuid}/identity_docs/`.

---

### 2. The Unified Membership Pipeline

We must distinguish between a **Tenant User** (Identity) and a **Member** (Status).

#### A. Phase 1: Identity Registration (The User Form)

* **Goal:** Create an auth account.
* **Fields:** Phone (OTP verified), Password, Email.
* **State:** `USER_REGISTERED`.

#### B. Phase 2: The Extensive Membership Application

This is where the user "Applies for Status." There are two entry strategies:

1. **Self-Applied Strategy:** User fills the form independently.
2. **Committee-Sponsored Strategy:** A current "Committee Leader" initiates the application (Proposer/Seconder model).

**Form Schema Requirements:**

* **Personal Data:** Full legal name, DOB, Occupation.
* **Geography Context:** Selection of Province -> District -> Ward (linked via `geography_node_id`).
* **Document Vault:** Upload of National ID/Passport (using the Pre-signed URL logic).

---

### 3. Cross-Context Foundation

A modern membership is the "Nexus" of all your contexts. We use the **Event-Driven Architecture** to link them.

| Context | Role in Membership | Logic/Algorithm |
| --- | --- | --- |
| **Geography** | **Validation** | The  (e.g., `1/5/23`) ensures the member is placed in a real ward. |
| **Financial Levy** | **Activation** | Application remains `PENDING_PAYMENT` until the "Membership Levy" is detected. |
| **Discussion Forum** | **Authorization** | Upon `ACTIVE` status, the user is automatically added to the "Ward 23 Discussion Room." |
| **Leadership Score** | **Incentive** | If a Leader "Sponsors" this member, the Leader's  increases by . |

---

### 4. The Membership Acceptance Process (State Pattern)

Using the **State Pattern**, we define a strict workflow for the Tenant Admin.

1. **Draft:** User is filling the form.
2. **Submitted:** Vault documents are uploaded.
3. **Verification (Admin Action):** Admin reviews the ID in the Vue 3 Dashboard.
* *Algorithm:* **Fuzzy Name Matching** between the User's input name and the AI-OCR scanned name from the ID card (optional enhancement).


4. **Levy Clearance:** System waits for the `PaymentReceived` event.
5. **Active:** Member receives their **Digital Card** in Angular.

---

### 5. Implementation Strategy: The "Membership Command"

In your Laravel backend, use the **Command Pattern** to handle this complex multi-context logic.

```php
class CompleteMembershipApplicationCommand {
    public function execute(Member $member) {
        return DB::transaction(function() use ($member) {
            // 1. Geography: Lock the member to the Ward path
            $member->assignToWard($member->requested_ward_id);

            // 2. Finance: Create a pending 'Onboarding Levy' record
            LevyService::createInitialFee($member);

            // 3. Discussion: Prepare 'Read-Only' access to Ward Forum
            ForumService::preEnroll($member);

            // 4. Update State
            $member->status = MembershipStatus::AWAITING_PAYMENT;
            $member->save();
        });
    }
}

```

---

### 6. UI/UX: Angular Member App

* **The "Progressive Disclosure" Form:** Use a multi-step wizard.
* *Step 1:* Personal Info.
* *Step 2:* Geo-Location (GPS Suggestion).
* *Step 3:* Document Upload (The Vault).


* **The Status Tracker:** A real-time timeline showing "Admin Review" -> "Payment" -> "Active."

### Your Next Step

To make the **Document Vault** secure, we need to handle the **Admin Review Interface** in Vue 3. The admin needs to view these sensitive IDs without them being "publicly accessible" via a URL.

**Would you like me to design the "Secure Document Viewer" component for your Vue 3 Admin API that uses temporary S3 streams for viewing ID cards?**


