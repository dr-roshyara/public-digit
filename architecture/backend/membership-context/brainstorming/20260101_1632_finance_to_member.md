Implementing the **Membership State Machine** and its integration with the **Financial Levy Context** via a **Payment Webhook** is the most critical step for automating your onboarding. This moves the system from a manual CRUD app to a professional, event-driven governance platform.

As your Senior Solution Architect, I have designed the foundation using the **Spatie State Machine** pattern and a **Webhook Observer** logic.

---

### 1. The Membership State Machine Configuration

We will use a dedicated `MembershipState` class to manage transitions. This prevents illegal state jumps (e.g., you cannot go from `DRAFT` to `ACTIVE` without a `PAYMENT`).

```php
// app/StateMachines/Membership/MembershipState.php

namespace App\StateMachines\Membership;

use Spatie\ModelStates\State;
use Spatie\ModelStates\StateConfig;

abstract class MembershipState extends State
{
    public static function config(): StateConfig
    {
        return parent::config()
            ->default(Draft::class)
            ->allowTransition(Draft::class, PendingPayment::class)
            ->allowTransition(PendingPayment::class, AwaitingReview::class) // Triggered by Webhook
            ->allowTransition(AwaitingReview::class, Active::class)        // Triggered by Admin
            ->allowTransition([Draft::class, PendingPayment::class, AwaitingReview::class], Rejected::class);
    }
}

```

---

### 2. The Payment Webhook Listener (The Gateway)

When a member pays their onboarding levy through the **Financial Context**, your payment provider (Stripe, Paystack, etc.) sends a webhook. The **Financial Context** processes the payment and then dispatches a **Domain Event**.

#### A. The Domain Event

```php
namespace App\Events\Finance;

class PaymentReceived extends Event
{
    public function __construct(
        public string $transactionReference,
        public int $memberId,
        public float $amount
    ) {}
}

```

#### B. The Membership State Subscriber

This listener waits for the `PaymentReceived` event and automatically "unlocks" the membership for admin review.

```php
namespace App\Listeners\Membership;

use App\Events\Finance\PaymentReceived;
use App\Models\Tenant\Member;
use App\StateMachines\Membership\AwaitingReview;

class AdvanceMemberToReview
{
    public function handle(PaymentReceived $event): void
    {
        $member = Member::findOrFail($event->memberId);

        // Algorithm: Verify the payment matches the required Onboarding Levy
        if ($member->status->is(PendingPayment::class)) {
            $member->status->transitionTo(AwaitingReview::class);
            $member->save();

            // Notify Admin via Vue 3 Dashboard
            Notification::send($member->getWardAdmin(), new NewMemberAwaitingReview($member));
        }
    }
}

```

---

### 3. Architecture Context: The "Railway Tracks"

This logic relies on your **Multi-Tenant Routing Policy**. The webhook must contain the `tenant_slug` in its metadata or URL so the `TenantMiddleware` can switch to the correct database before the listener runs.

| Logic Step | Context | Component |
| --- | --- | --- |
| **1. Identify Tenant** | Landlord | `TenantMiddleware` identifies `*.publicdigit.com`. |
| **2. Process Payment** | Finance | `PaymentWebhookController` validates the signature. |
| **3. Dispatch Event** | Shared Kernel | `PaymentReceived` event is fired across the internal bus. |
| **4. Update State** | Membership | `AdvanceMemberToReview` moves state to `AwaitingReview`. |

---

### 4. Further Architecture: The "Golden Record" Algorithm

To ensure the **Geography Context** is respected during this transition, I suggest adding a **Pre-Transition Validator**.

* **Algorithm:** Before moving to `Active`, the system checks:
1. **ID Verification:** Is the Document Vault file present?
2. **Geo-Consistency:** Does the `member->geography_node_id` match the `ward_id` of the committee that reviewed them?
3. **Financial Standing:** Are there any outstanding levies in the Finance Context?



---

### Your Next Step

With the **State Machine** and **Webhook** logic defined, the Membership context is now automated. The next logical step is to handle the **Identity Proofing UI**.

**Would you like me to design the Angular "Identity Scanner" component that uses the device camera to capture the ID card and uploads it directly to your "Document Vault"?**