# 🚀 **PHASE 5: EVENT LISTENERS IMPLEMENTATION**

## **📁 ARCHITECTURE OVERVIEW**

```
Event-Driven Architecture Goals:
1. Decouple side effects from business logic
2. Handle asynchronous operations (emails, notifications, integrations)
3. Enable extensibility without modifying core logic
4. Support event sourcing if needed in future
```

---

## **STEP 5.1: EVENT LISTENER STRUCTURE**

### **5.1.1 Create Event Listener Directories**

```bash
mkdir -p app/Contexts/Membership/Infrastructure/EventListeners
mkdir -p tests/Unit/Contexts/Membership/Infrastructure/EventListeners
```

### **5.1.2 Event Listener Base Classes**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/BaseEventListener.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\DomainEvent;
use Illuminate\Contracts\Queue\ShouldQueue;

abstract class BaseEventListener
{
    /**
     * Determine if the listener should be queued
     */
    protected bool $shouldQueue = false;
    
    /**
     * Determine if the listener should handle the event
     */
    protected function shouldHandle(DomainEvent $event): bool
    {
        return true;
    }
    
    /**
     * Handle the event
     */
    abstract public function handle(DomainEvent $event): void;
    
    /**
     * Get the queue connection for the listener
     */
    public function viaConnection(): ?string
    {
        return $this->shouldQueue ? 'redis' : null;
    }
    
    /**
     * Get the queue name for the listener
     */
    public function viaQueue(): ?string
    {
        return $this->shouldQueue ? 'membership-events' : null;
    }
}
```

---

## **STEP 5.2: NOTIFICATION LISTENERS**

### **5.2.1 SendWelcomeEmailOnMemberActivated**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/SendWelcomeEmailOnMemberActivated.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Infrastructure\Services\EmailServiceInterface;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendWelcomeEmailOnMemberActivated extends BaseEventListener implements ShouldQueue
{
    protected bool $shouldQueue = true;
    
    public function __construct(
        private MemberRepositoryInterface $members,
        private EmailServiceInterface $emailService
    ) {}
    
    public function handle(MemberActivated $event): void
    {
        if (!$this->shouldHandle($event)) {
            return;
        }
        
        // Get member details
        $member = $this->members->find($event->memberId);
        
        if (!$member) {
            // Log warning but don't throw exception
            \Log::warning("Member not found for welcome email: {$event->memberId}");
            return;
        }
        
        // Send welcome email
        $this->emailService->sendWelcomeEmail(
            to: $member->personalInfo()->email(),
            name: $member->personalInfo()->fullName(),
            membershipNumber: (string) $member->membershipNumber(),
            geography: $member->geography(),
            activatedAt: $event->occurredAt()
        );
        
        \Log::info("Welcome email sent to member: {$event->memberId}");
    }
    
    protected function shouldHandle(MemberActivated $event): bool
    {
        // Don't send email for test payments
        if (str_starts_with($event->paymentId, 'test_')) {
            return false;
        }
        
        return true;
    }
}
```

### **5.2.2 SendApplicationSubmittedNotification**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/SendApplicationSubmittedNotification.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberApplicationSubmitted;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Infrastructure\Services\NotificationServiceInterface;

class SendApplicationSubmittedNotification extends BaseEventListener
{
    public function __construct(
        private MemberRepositoryInterface $members,
        private NotificationServiceInterface $notificationService
    ) {}
    
    public function handle(MemberApplicationSubmitted $event): void
    {
        // Get member details
        $member = $this->members->find($event->memberId);
        
        if (!$member) {
            \Log::warning("Member not found for application notification: {$event->memberId}");
            return;
        }
        
        // Notify committee members based on geography
        $committeeMembers = $this->getCommitteeMembersForGeography($member->geography());
        
        foreach ($committeeMembers as $committeeMember) {
            $this->notificationService->notifyCommitteeMember(
                committeeMemberId: $committeeMember['id'],
                title: 'New Membership Application',
                message: "New application from {$member->personalInfo()->fullName()} in {$member->geography()}",
                actionUrl: "/members/applications/{$member->id()}",
                priority: 'normal'
            );
        }
        
        // Send confirmation to applicant
        $this->notificationService->notifyMember(
            memberId: $member->id(),
            title: 'Application Submitted',
            message: 'Your membership application has been submitted for review.',
            type: 'application_status'
        );
        
        \Log::info("Application notifications sent for member: {$event->memberId}");
    }
    
    private function getCommitteeMembersForGeography($geography): array
    {
        // This would query the Committee context
        // For now, return dummy data
        return [
            ['id' => 123, 'name' => 'Committee President'],
            ['id' => 456, 'name' => 'Ward Secretary'],
        ];
    }
}
```

### **5.2.3 SendApprovalNotification**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/SendApprovalNotification.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Infrastructure\Services\NotificationServiceInterface;

class SendApprovalNotification extends BaseEventListener
{
    public function __construct(
        private MemberRepositoryInterface $members,
        private NotificationServiceInterface $notificationService
    ) {}
    
    public function handle(MemberApproved $event): void
    {
        // Get member details
        $member = $this->members->find($event->memberId);
        
        if (!$member) {
            \Log::warning("Member not found for approval notification: {$event->memberId}");
            return;
        }
        
        // Notify the member
        $this->notificationService->notifyMember(
            memberId: $member->id(),
            title: 'Application Approved',
            message: 'Your membership application has been approved. Please complete payment to activate your membership.',
            type: 'application_status'
        );
        
        // Notify sponsor if exists
        if ($member->sponsorId()) {
            $this->notificationService->notifyMember(
                memberId: $member->sponsorId(),
                title: 'Member Approved',
                message: "Your sponsored member {$member->personalInfo()->fullName()} has been approved.",
                type: 'sponsorship'
            );
        }
        
        // Log approval for committee records
        $this->notificationService->logCommitteeAction(
            committeeMemberId: $event->committeeMemberId,
            action: 'member_approval',
            targetMemberId: $member->id(),
            details: [
                'membership_number' => (string) $member->membershipNumber(),
                'geography' => (string) $member->geography(),
            ]
        );
        
        \Log::info("Approval notifications sent for member: {$event->memberId}");
    }
}
```

---

## **STEP 5.3: INTEGRATION LISTENERS**

### **5.3.1 CreateInvoiceOnMemberApproved**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/CreateInvoiceOnMemberApproved.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Services\FinancialIntegrationServiceInterface;
use App\Contexts\Membership\Domain\Services\MembershipFeeCalculatorInterface;

class CreateInvoiceOnMemberApproved extends BaseEventListener
{
    public function __construct(
        private MemberRepositoryInterface $members,
        private FinancialIntegrationServiceInterface $financialService,
        private MembershipFeeCalculatorInterface $feeCalculator
    ) {}
    
    public function handle(MemberApproved $event): void
    {
        // Get member details
        $member = $this->members->find($event->memberId);
        
        if (!$member) {
            \Log::warning("Member not found for invoice creation: {$event->memberId}");
            return;
        }
        
        // Calculate membership fee based on type and geography
        $feeAmount = $this->feeCalculator->calculateFee(
            membershipType: $member->membershipNumber()->typeName(),
            geographyTier: $member->geography()->tier(),
            geographyIds: [
                'province_id' => $member->geography()->provinceId(),
                'district_id' => $member->geography()->districtId(),
                'ward_id' => $member->geography()->wardId(),
            ]
        );
        
        // Create invoice in financial system
        $invoiceId = $this->financialService->createInvoice(
            memberId: $member->id(),
            amount: $feeAmount,
            description: "Annual Membership Fee - {$member->membershipNumber()}"
        );
        
        // Store invoice reference with member (could be separate table)
        // For now, log it
        \Log::info("Invoice created for member", [
            'member_id' => $member->id(),
            'invoice_id' => $invoiceId,
            'amount' => $feeAmount,
            'committee_member_id' => $event->committeeMemberId,
        ]);
        
        // Send invoice notification
        $this->sendInvoiceNotification($member, $invoiceId, $feeAmount);
    }
    
    private function sendInvoiceNotification($member, string $invoiceId, float $amount): void
    {
        // This would use the notification service
        // For now, just log
        \Log::info("Invoice notification prepared", [
            'member_id' => $member->id(),
            'invoice_id' => $invoiceId,
            'amount' => $amount,
            'email' => $member->personalInfo()->email(),
        ]);
    }
}
```

### **5.3.2 UpdateSponsorshipScoreOnMemberActivated**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/UpdateSponsorshipScoreOnMemberActivated.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Services\LeadershipScoreServiceInterface;

class UpdateSponsorshipScoreOnMemberActivated extends BaseEventListener implements ShouldQueue
{
    protected bool $shouldQueue = true;
    
    public function __construct(
        private MemberRepositoryInterface $members,
        private LeadershipScoreServiceInterface $scoreService
    ) {}
    
    public function handle(MemberActivated $event): void
    {
        // Get member details
        $member = $this->members->find($event->memberId);
        
        if (!$member || !$member->sponsorId()) {
            return; // No sponsor to update
        }
        
        // Update sponsor's leadership score
        $this->scoreService->addSponsorshipPoints(
            sponsorId: $member->sponsorId(),
            sponsoredMemberId: $member->id(),
            points: $this->calculateSponsorshipPoints($member),
            reason: "Sponsored member activated: {$member->membershipNumber()}"
        );
        
        \Log::info("Sponsorship score updated", [
            'sponsor_id' => $member->sponsorId(),
            'sponsored_member_id' => $member->id(),
            'points_awarded' => $this->calculateSponsorshipPoints($member),
        ]);
    }
    
    private function calculateSponsorshipPoints($member): int
    {
        // Calculate points based on member type and geography
        $basePoints = 10;
        
        // Bonus points for full members
        if ($member->membershipNumber()->typeName() === 'full') {
            $basePoints += 5;
        }
        
        // Bonus points if geography is enriched
        if ($member->geography()->tier() === 'advanced') {
            $basePoints += 3;
        }
        
        return $basePoints;
    }
}
```

### **5.3.3 SyncForumAccessOnMemberStatusChange**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/SyncForumAccessOnMemberStatusChange.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\Events\MemberSuspended;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Domain\Services\ForumIntegrationServiceInterface;

class SyncForumAccessOnMemberStatusChange extends BaseEventListener
{
    public function __construct(
        private MemberRepositoryInterface $members,
        private ForumIntegrationServiceInterface $forumService
    ) {}
    
    public function handleMemberActivated(MemberActivated $event): void
    {
        $member = $this->members->find($event->memberId);
        
        if (!$member) {
            return;
        }
        
        // Grant full forum access
        $this->forumService->grantForumAccess(
            memberId: $member->id(),
            accessLevel: 'full',
            geographyPath: $this->getGeographyPath($member),
            membershipType: $member->membershipNumber()->typeName()
        );
        
        \Log::info("Forum access granted for member: {$member->id()}");
    }
    
    public function handleMemberSuspended(MemberSuspended $event): void
    {
        $member = $this->members->find($event->memberId);
        
        if (!$member) {
            return;
        }
        
        // Revoke forum access
        $this->forumService->revokeForumAccess(
            memberId: $member->id(),
            reason: $event->reason
        );
        
        \Log::info("Forum access revoked for member: {$member->id()}");
    }
    
    private function getGeographyPath($member): ?string
    {
        if ($member->geography()->tier() === 'advanced') {
            return implode('.', array_filter([
                $member->geography()->provinceId(),
                $member->geography()->districtId(),
                $member->geography()->wardId(),
            ]));
        }
        
        return null;
    }
}
```

---

## **STEP 5.4: AUDIT LOGGING LISTENERS**

### **5.4.1 LogMemberLifecycleEvents**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/LogMemberLifecycleEvents.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberCreated;
use App\Contexts\Membership\Domain\Events\MemberApplicationSubmitted;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\Events\MemberSuspended;
use App\Contexts\Membership\Domain\Events\MemberGeographyEnriched;
use App\Contexts\Membership\Domain\Repositories\MemberAuditLogRepositoryInterface;

class LogMemberLifecycleEvents extends BaseEventListener
{
    public function __construct(
        private MemberAuditLogRepositoryInterface $auditLogRepository
    ) {}
    
    public function handleMemberCreated(MemberCreated $event): void
    {
        $this->auditLogRepository->log(
            memberId: $event->memberId,
            action: 'member_created',
            details: [
                'membership_number' => $event->membershipNumber,
                'full_name' => $event->fullName,
                'geography_tier' => $event->geographyTier,
            ],
            performedBy: 'system',
            ipAddress: request()->ip() ?? 'CLI'
        );
    }
    
    public function handleMemberApplicationSubmitted(MemberApplicationSubmitted $event): void
    {
        $this->auditLogRepository->log(
            memberId: $event->memberId,
            action: 'application_submitted',
            details: [
                'geography_tier' => $event->geographyTier,
                'submitted_at' => $event->occurredAt()->format('c'),
            ],
            performedBy: 'system',
            ipAddress: request()->ip() ?? 'CLI'
        );
    }
    
    public function handleMemberApproved(MemberApproved $event): void
    {
        $this->auditLogRepository->log(
            memberId: $event->memberId,
            action: 'member_approved',
            details: [
                'committee_member_id' => $event->committeeMemberId,
                'geography_tier' => $event->geographyTier,
                'approved_at' => $event->occurredAt()->format('c'),
            ],
            performedBy: $event->committeeMemberId,
            ipAddress: request()->ip() ?? 'CLI'
        );
    }
    
    public function handleMemberActivated(MemberActivated $event): void
    {
        $this->auditLogRepository->log(
            memberId: $event->memberId,
            action: 'member_activated',
            details: [
                'payment_id' => $event->paymentId,
                'geography_tier' => $event->geographyTier,
                'activated_at' => $event->occurredAt()->format('c'),
            ],
            performedBy: 'system',
            ipAddress: request()->ip() ?? 'CLI'
        );
    }
    
    public function handleMemberSuspended(MemberSuspended $event): void
    {
        $this->auditLogRepository->log(
            memberId: $event->memberId,
            action: 'member_suspended',
            details: [
                'reason' => $event->reason,
                'geography_tier' => $event->geographyTier,
                'suspended_at' => $event->occurredAt()->format('c'),
            ],
            performedBy: 'system',
            ipAddress: request()->ip() ?? 'CLI'
        );
    }
    
    public function handleMemberGeographyEnriched(MemberGeographyEnriched $event): void
    {
        $this->auditLogRepository->log(
            memberId: $event->memberId,
            action: 'geography_enriched',
            details: [
                'from_tier' => $event->fromTier,
                'to_tier' => $event->toTier,
                'enriched_at' => $event->occurredAt()->format('c'),
            ],
            performedBy: 'system',
            ipAddress: request()->ip() ?? 'CLI'
        );
    }
}
```

### **5.4.2 MemberAuditLogRepository Interface and Implementation**

```php
<?php

// app/Contexts/Membership/Domain/Repositories/MemberAuditLogRepositoryInterface.php

namespace App\Contexts\Membership\Domain\Repositories;

interface MemberAuditLogRepositoryInterface
{
    public function log(
        string $memberId,
        string $action,
        array $details = [],
        $performedBy = null,
        ?string $ipAddress = null
    ): void;
    
    public function getLogsForMember(string $memberId, int $limit = 100): array;
    
    public function searchLogs(array $criteria, int $limit = 100): array;
}
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Repositories/EloquentMemberAuditLogRepository.php

namespace App\Contexts\Membership\Infrastructure\Repositories;

use App\Contexts\Membership\Domain\Repositories\MemberAuditLogRepositoryInterface;
use App\Contexts\Membership\Infrastructure\Database\Models\MemberAuditLogModel;
use Illuminate\Support\Facades\DB;

class EloquentMemberAuditLogRepository implements MemberAuditLogRepositoryInterface
{
    public function log(
        string $memberId,
        string $action,
        array $details = [],
        $performedBy = null,
        ?string $ipAddress = null
    ): void {
        MemberAuditLogModel::create([
            'member_id' => $memberId,
            'action' => $action,
            'details' => json_encode($details),
            'performed_by' => $performedBy,
            'ip_address' => $ipAddress,
            'created_at' => now(),
        ]);
    }
    
    public function getLogsForMember(string $memberId, int $limit = 100): array
    {
        return MemberAuditLogModel::where('member_id', $memberId)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'details' => json_decode($log->details, true),
                    'performed_by' => $log->performed_by,
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at->toIso8601String(),
                ];
            })
            ->all();
    }
    
    public function searchLogs(array $criteria, int $limit = 100): array
    {
        $query = MemberAuditLogModel::query();
        
        if (isset($criteria['member_id'])) {
            $query->where('member_id', $criteria['member_id']);
        }
        
        if (isset($criteria['action'])) {
            $query->where('action', $criteria['action']);
        }
        
        if (isset($criteria['performed_by'])) {
            $query->where('performed_by', $criteria['performed_by']);
        }
        
        if (isset($criteria['start_date'])) {
            $query->where('created_at', '>=', $criteria['start_date']);
        }
        
        if (isset($criteria['end_date'])) {
            $query->where('created_at', '<=', $criteria['end_date']);
        }
        
        return $query->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'member_id' => $log->member_id,
                    'action' => $log->action,
                    'details' => json_decode($log->details, true),
                    'performed_by' => $log->performed_by,
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at->toIso8601String(),
                ];
            })
            ->all();
    }
}
```

### **5.4.3 MemberAuditLogModel and Migration**

```bash
php artisan make:model MemberAuditLogModel --context=Membership --tenant
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Database/Models/MemberAuditLogModel.php

namespace App\Contexts\Membership\Infrastructure\Database\Models;

use Illuminate\Database\Eloquent\Model;

class MemberAuditLogModel extends Model
{
    protected $table = 'member_audit_logs';
    
    protected $fillable = [
        'member_id',
        'action',
        'details',
        'performed_by',
        'ip_address',
    ];
    
    protected $casts = [
        'details' => 'array',
    ];
}
```

```php
<?php

// Migration: create_member_audit_logs_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('member_id');
            $table->string('action');
            $table->json('details')->nullable();
            $table->string('performed_by')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index(['member_id', 'created_at']);
            $table->index(['action', 'created_at']);
            $table->index('performed_by');
        });
    }
    
    public function down(): void
    {
        Schema::dropIfExists('member_audit_logs');
    }
};
```

---

## **STEP 5.5: INFRASTRUCTURE SERVICES**

### **5.5.1 Service Interfaces**

```php
<?php

// app/Contexts/Membership/Infrastructure/Services/EmailServiceInterface.php

namespace App\Contexts\Membership\Infrastructure\Services;

use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use DateTimeImmutable;

interface EmailServiceInterface
{
    public function sendWelcomeEmail(
        string $to,
        string $name,
        string $membershipNumber,
        SimpleGeography $geography,
        DateTimeImmutable $activatedAt
    ): void;
    
    public function sendApplicationConfirmation(
        string $to,
        string $name,
        string $applicationId
    ): void;
    
    public function sendApprovalNotification(
        string $to,
        string $name,
        string $membershipNumber,
        float $feeAmount
    ): void;
    
    public function sendPaymentReminder(
        string $to,
        string $name,
        string $membershipNumber,
        DateTimeImmutable $dueDate
    ): void;
}
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Services/NotificationServiceInterface.php

namespace App\Contexts\Membership\Infrastructure\Services;

interface NotificationServiceInterface
{
    public function notifyMember(
        string $memberId,
        string $title,
        string $message,
        string $type = 'info',
        ?string $actionUrl = null
    ): void;
    
    public function notifyCommitteeMember(
        int $committeeMemberId,
        string $title,
        string $message,
        ?string $actionUrl = null,
        string $priority = 'normal'
    ): void;
    
    public function logCommitteeAction(
        int $committeeMemberId,
        string $action,
        string $targetMemberId,
        array $details = []
    ): void;
}
```

```php
<?php

// app/Contexts/Membership/Domain/Services/MembershipFeeCalculatorInterface.php

namespace App\Contexts\Membership\Domain\Services;

interface MembershipFeeCalculatorInterface
{
    public function calculateFee(
        string $membershipType,
        string $geographyTier,
        array $geographyIds = []
    ): float;
}
```

```php
<?php

// app/Contexts/Membership/Domain/Services/LeadershipScoreServiceInterface.php

namespace App\Contexts\Membership\Domain\Services;

interface LeadershipScoreServiceInterface
{
    public function addSponsorshipPoints(
        int $sponsorId,
        string $sponsoredMemberId,
        int $points,
        string $reason
    ): void;
    
    public function addParticipationPoints(
        int $memberId,
        string $eventType,
        int $points,
        string $reason
    ): void;
    
    public function getScore(int $memberId): int;
    
    public function getRank(int $memberId, ?string $geographyScope = null): int;
}
```

```php
<?php

// app/Contexts/Membership/Domain/Services/ForumIntegrationServiceInterface.php

namespace App\Contexts\Membership\Domain\Services;

interface ForumIntegrationServiceInterface
{
    public function grantForumAccess(
        string $memberId,
        string $accessLevel,
        ?string $geographyPath = null,
        string $membershipType = 'full'
    ): void;
    
    public function revokeForumAccess(
        string $memberId,
        string $reason
    ): void;
    
    public function updateForumAccess(
        string $memberId,
        string $newAccessLevel
    ): void;
}
```

### **5.5.2 Null Implementations (For Development)**

```php
<?php

// app/Contexts/Membership/Infrastructure/Services/NullEmailService.php

namespace App\Contexts\Membership\Infrastructure\Services;

use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use DateTimeImmutable;

class NullEmailService implements EmailServiceInterface
{
    public function sendWelcomeEmail(
        string $to,
        string $name,
        string $membershipNumber,
        SimpleGeography $geography,
        DateTimeImmutable $activatedAt
    ): void {
        \Log::info('Welcome email would be sent', [
            'to' => $to,
            'name' => $name,
            'membership_number' => $membershipNumber,
            'geography' => (string) $geography,
        ]);
    }
    
    public function sendApplicationConfirmation(
        string $to,
        string $name,
        string $applicationId
    ): void {
        \Log::info('Application confirmation email would be sent', [
            'to' => $to,
            'name' => $name,
            'application_id' => $applicationId,
        ]);
    }
    
    public function sendApprovalNotification(
        string $to,
        string $name,
        string $membershipNumber,
        float $feeAmount
    ): void {
        \Log::info('Approval notification email would be sent', [
            'to' => $to,
            'name' => $name,
            'membership_number' => $membershipNumber,
            'fee_amount' => $feeAmount,
        ]);
    }
    
    public function sendPaymentReminder(
        string $to,
        string $name,
        string $membershipNumber,
        DateTimeImmutable $dueDate
    ): void {
        \Log::info('Payment reminder email would be sent', [
            'to' => $to,
            'name' => $name,
            'membership_number' => $membershipNumber,
            'due_date' => $dueDate->format('Y-m-d'),
        ]);
    }
}
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Services/NullNotificationService.php

namespace App\Contexts\Membership\Infrastructure\Services;

class NullNotificationService implements NotificationServiceInterface
{
    public function notifyMember(
        string $memberId,
        string $title,
        string $message,
        string $type = 'info',
        ?string $actionUrl = null
    ): void {
        \Log::info('Member notification', [
            'member_id' => $memberId,
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'action_url' => $actionUrl,
        ]);
    }
    
    public function notifyCommitteeMember(
        int $committeeMemberId,
        string $title,
        string $message,
        ?string $actionUrl = null,
        string $priority = 'normal'
    ): void {
        \Log::info('Committee member notification', [
            'committee_member_id' => $committeeMemberId,
            'title' => $title,
            'message' => $message,
            'priority' => $priority,
            'action_url' => $actionUrl,
        ]);
    }
    
    public function logCommitteeAction(
        int $committeeMemberId,
        string $action,
        string $targetMemberId,
        array $details = []
    ): void {
        \Log::info('Committee action logged', [
            'committee_member_id' => $committeeMemberId,
            'action' => $action,
            'target_member_id' => $targetMemberId,
            'details' => $details,
        ]);
    }
}
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Services/BasicMembershipFeeCalculator.php

namespace App\Contexts\Membership\Infrastructure\Services;

use App\Contexts\Membership\Domain\Services\MembershipFeeCalculatorInterface;

class BasicMembershipFeeCalculator implements MembershipFeeCalculatorInterface
{
    private const FEES = [
        'full' => 1000,
        'youth' => 500,
        'student' => 250,
        'associate' => 750,
    ];
    
    private const GEOGRAPHY_BONUS = [
        'none' => 0,
        'basic' => 0,
        'advanced' => 100, // Advanced geography might have higher fees
    ];
    
    public function calculateFee(
        string $membershipType,
        string $geographyTier,
        array $geographyIds = []
    ): float {
        $baseFee = self::FEES[$membershipType] ?? 1000;
        $geographyBonus = self::GEOGRAPHY_BONUS[$geographyTier] ?? 0;
        
        return $baseFee + $geographyBonus;
    }
}
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Services/NullLeadershipScoreService.php

namespace App\Contexts\Membership\Infrastructure\Services;

use App\Contexts\Membership\Domain\Services\LeadershipScoreServiceInterface;

class NullLeadershipScoreService implements LeadershipScoreServiceInterface
{
    public function addSponsorshipPoints(
        int $sponsorId,
        string $sponsoredMemberId,
        int $points,
        string $reason
    ): void {
        \Log::info('Sponsorship points would be added', [
            'sponsor_id' => $sponsorId,
            'sponsored_member_id' => $sponsoredMemberId,
            'points' => $points,
            'reason' => $reason,
        ]);
    }
    
    public function addParticipationPoints(
        int $memberId,
        string $eventType,
        int $points,
        string $reason
    ): void {
        \Log::info('Participation points would be added', [
            'member_id' => $memberId,
            'event_type' => $eventType,
            'points' => $points,
            'reason' => $reason,
        ]);
    }
    
    public function getScore(int $memberId): int
    {
        return 0;
    }
    
    public function getRank(int $memberId, ?string $geographyScope = null): int
    {
        return 999;
    }
}
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Services/NullForumIntegrationService.php

namespace App\Contexts\Membership\Infrastructure\Services;

use App\Contexts\Membership\Domain\Services\ForumIntegrationServiceInterface;

class NullForumIntegrationService implements ForumIntegrationServiceInterface
{
    public function grantForumAccess(
        string $memberId,
        string $accessLevel,
        ?string $geographyPath = null,
        string $membershipType = 'full'
    ): void {
        \Log::info('Forum access would be granted', [
            'member_id' => $memberId,
            'access_level' => $accessLevel,
            'geography_path' => $geographyPath,
            'membership_type' => $membershipType,
        ]);
    }
    
    public function revokeForumAccess(
        string $memberId,
        string $reason
    ): void {
        \Log::info('Forum access would be revoked', [
            'member_id' => $memberId,
            'reason' => $reason,
        ]);
    }
    
    public function updateForumAccess(
        string $memberId,
        string $newAccessLevel
    ): void {
        \Log::info('Forum access would be updated', [
            'member_id' => $memberId,
            'new_access_level' => $newAccessLevel,
        ]);
    }
}
```

---

## **STEP 5.6: EVENT SERVICE PROVIDER**

### **5.6.1 Create EventServiceProvider**

```php
<?php

// app/Contexts/Membership/Infrastructure/Providers/EventServiceProvider.php

namespace App\Contexts