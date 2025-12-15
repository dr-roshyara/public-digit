Tenant Application Processing
# 📋 **Tenant Application Processing: File-by-File Guide**

## 🗺️ **Complete Processing Map**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                      TENANT APPLICATION PROCESSING FLOW                              │
│                                                                                     │
│  CLIENT SIDE (Angular/Vue)      →       API ROUTES      →       BACKEND FILES       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. 📝 **Application Submission Phase**

### **1.1 User Submits Application (Web Form)**

**Frontend →** `GET /apply-for-tenant`
```javascript
// Vue component: resources/js/Pages/Contexts/Platform/TenantApplication/Apply.vue
<template>
  <form @submit.prevent="submitApplication">
    <input v-model="form.organization_name" />
    <input v-model="form.requested_slug" />
    <button type="submit">Submit Application</button>
  </form>
</template>

<script setup>
import { useForm } from '@inertiajs/vue3';

const form = useForm({
  organization_name: '',
  requested_slug: '',
  contact_email: '',
  // ... other fields
});

const submitApplication = () => {
  form.post(route('tenant-application.store'), {
    onSuccess: () => {
      // Redirect to confirmation
    }
  });
};
</script>
```

**Route →** `routes/platform-web.php`
```php
Route::get('/apply-for-tenant', [TenantApplicationController::class, 'create'])
    ->name('tenant-application.create');

Route::post('/apply-for-tenant', [TenantApplicationController::class, 'store'])
    ->name('tenant-application.store');
```

**Controller →** `app/Contexts/Platform/Infrastructure/Http/Controllers/TenantApplicationController.php`
```php
public function store(Request $request)
{
    // 1. Validate input
    $validated = $request->validate([...]);
    
    // 2. Call Application Service
    $application = $this->applicationService->submitApplication($validated);
    
    // 3. Redirect to confirmation
    session()->flash('application_submitted', true);
    return redirect()->route('tenant-application.confirmation');
}
```

**Service →** `app/Contexts/Platform/Application/Services/TenantApplicationService.php`
```php
public function submitApplication(array $data): TenantApplication
{
    // 1. Create Value Objects
    $applicationId = TenantApplicationId::generate();
    $contactEmail = new EmailAddress($data['contact_email']);
    $tenantSlug = new TenantSlug($data['requested_slug']);
    
    // 2. Create Entity
    $application = TenantApplication::create([
        'id' => $applicationId,
        'organization_name' => $data['organization_name'],
        'contact_email' => $contactEmail,
        'requested_slug' => $tenantSlug,
        'status' => ApplicationStatus::pending()
    ]);
    
    // 3. Save via Repository
    $this->applicationRepository->save($application);
    
    // 4. Dispatch Domain Event
    event(new TenantApplicationSubmitted($application));
    
    return $application;
}
```

**Repository →** `app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantApplicationRepository.php`
```php
public function save(TenantApplication $application): void
{
    DB::table('tenant_applications')->updateOrInsert(
        ['id' => $application->getId()->toString()],
        [
            'organization_name' => $application->getOrganizationName(),
            'requested_slug' => $application->getRequestedSlug(),
            'contact_email' => $application->getContactEmail()->toString(),
            'status' => $application->getStatus()->toString(),
            'submitted_at' => $application->getSubmittedAt(),
            'updated_at' => now(),
        ]
    );
}
```

### **1.2 Slug Availability Check (AJAX)**

**Frontend →** Real-time validation
```javascript
// Vue component
watch(() => form.requested_slug, async (slug) => {
  if (slug.length >= 2) {
    const response = await axios.get(`/api/public/tenant-application/slug-availability?slug=${slug}`);
    this.slugAvailable = response.data.available;
  }
});
```

**API Route →** `routes/platform-api.php`
```php
Route::get('/api/public/tenant-application/slug-availability', 
    [TenantApplicationController::class, 'checkSlugAvailability']
);
```

**Controller Method →** Same `TenantApplicationController.php`
```php
public function checkSlugAvailability(Request $request)
{
    $slug = $request->query('slug');
    $available = $this->applicationService->isSlugAvailable($slug);
    
    return response()->json([
        'available' => $available,
        'slug' => $slug
    ]);
}
```

**Service Check →** Uses `TenantProvisioningService`
```php
public function isSlugAvailable(string $slug): bool
{
    // Check reserved slugs
    $reserved = config('reserved-slugs', []);
    if (in_array($slug, $reserved)) {
        return false;
    }
    
    // Check existing tenants
    return !Tenant::where('slug', $slug)->exists();
}
```

---

## 2. 👮‍♂️ **Admin Review Phase**

### **2.1 Admin Views Pending Applications**

**Admin Route →** `routes/platform-web.php`
```php
Route::prefix('admin')->middleware(['auth', 'permission:manage-tenant-applications'])->group(function () {
    Route::get('/tenant-applications', [TenantApplicationAdminController::class, 'index'])
        ->name('admin.tenant-applications.index');
    
    Route::get('/tenant-applications/{applicationId}', [TenantApplicationAdminController::class, 'show'])
        ->name('admin.tenant-applications.show');
});
```

**Admin Controller →** `app/Http/Controllers/Admin/TenantApplicationAdminController.php`
```php
public function index()
{
    // Get applications via repository
    $applications = $this->applicationRepository->findByStatus('pending');
    
    return Inertia::render('Admin/TenantApplications/Index', [
        'applications' => $applications,
        'stats' => $this->getApplicationStats()
    ]);
}

public function show(string $applicationId)
{
    $application = $this->applicationRepository->findById($applicationId);
    
    return Inertia::render('Admin/TenantApplications/Show', [
        'application' => $application,
        'slugAvailable' => $this->provisioningService->isSlugAvailable(
            $application->getRequestedSlug()
        )
    ]);
}
```

### **2.2 Admin Starts Review**

**Route →** `routes/platform-web.php`
```php
Route::post('/admin/tenant-applications/{applicationId}/start-review', 
    [TenantApplicationAdminController::class, 'startReview']
)->middleware('permission:approve-tenant-applications');
```

**Controller Method →**
```php
public function startReview(string $applicationId)
{
    $application = $this->applicationRepository->findById($applicationId);
    
    // Update via service
    $this->applicationService->startReview(
        $application->getId(),
        auth()->id()
    );
    
    return redirect()->back()->with('success', 'Application marked as under review');
}
```

**Service Method →** `TenantApplicationService.php`
```php
public function startReview(string $applicationId, string $reviewerId): void
{
    $application = $this->applicationRepository->findById($applicationId);
    
    $application->startReview($reviewerId);
    $this->applicationRepository->save($application);
    
    // Send email to applicant
    event(new TenantApplicationUnderReview($application));
}
```

**Entity State Change →** `app/Contexts/Platform/Domain/Entities/TenantApplication.php`
```php
public function startReview(string $reviewerId): void
{
    $this->guardTransition(
        ApplicationStatus::PENDING, 
        ApplicationStatus::UNDER_REVIEW
    );
    
    $this->status = ApplicationStatus::UNDER_REVIEW();
    $this->reviewerId = $reviewerId;
    $this->reviewStartedAt = now();
}
```

### **2.3 Admin Approves/Rejects Application**

**Routes →**
```php
Route::post('/admin/tenant-applications/{applicationId}/approve', 
    [TenantApplicationAdminController::class, 'approve']
);

Route::post('/admin/tenant-applications/{applicationId}/reject',
    [TenantApplicationAdminController::class, 'reject']
);
```

**Controller Approval →**
```php
public function approve(string $applicationId, Request $request)
{
    $validated = $request->validate([
        'review_notes' => 'nullable|string|max:1000'
    ]);
    
    $application = $this->applicationRepository->findById($applicationId);
    
    // 1. Check slug availability
    if (!$this->provisioningService->isSlugAvailable($application->getRequestedSlug())) {
        return response()->json([
            'message' => 'Slug is already taken',
            'errors' => ['slug' => ['The requested slug is not available']]
        ], 422);
    }
    
    // 2. Approve application
    $this->applicationService->approve(
        $application->getId(),
        auth()->id(),
        $validated['review_notes'] ?? ''
    );
    
    // 3. Start provisioning workflow
    $this->applicationService->startProvisioningWorkflow(
        $application->getId(),
        auth()->id()
    );
    
    return response()->json([
        'message' => 'Application approved and provisioning started',
        'application' => $application
    ]);
}
```

**Service Approval →** `TenantApplicationService.php`
```php
public function approve(string $applicationId, string $reviewerId, string $notes): void
{
    $application = $this->applicationRepository->findById($applicationId);
    
    $application->approve($reviewerId, $notes);
    $this->applicationRepository->save($application);
    
    // Dispatch event for email notification
    event(new TenantApplicationWasApproved($application));
}
```

**Entity Approval →** `TenantApplication.php`
```php
public function approve(string $reviewerId, string $notes): void
{
    $this->guardTransition(
        ApplicationStatus::UNDER_REVIEW, 
        ApplicationStatus::APPROVED
    );
    
    $this->status = ApplicationStatus::APPROVED();
    $this->reviewerId = $reviewerId;
    $this->reviewNotes = $notes;
    $this->reviewedAt = now();
}
```

---

## 3. ⚙️ **Provisioning Execution Phase**

### **3.1 Start Provisioning Workflow**

**Service Method →** `TenantApplicationService.php`
```php
public function startProvisioningWorkflow(string $applicationId, string $adminId): void
{
    $application = $this->applicationRepository->findById($applicationId);
    
    // 1. Update application state
    $application->startProvisioning();
    $this->applicationRepository->save($application);
    
    // 2. Dispatch queue job
    ProvisionTenantJob::dispatch($application, $adminId)
        ->onQueue('tenant-provisioning');
    
    Log::info('Provisioning workflow started', [
        'application_id' => $applicationId,
        'admin_id' => $adminId
    ]);
}
```

**Queue Job →** `app/Contexts/Platform/Application/Jobs/ProvisionTenantJob.php`
```php
class ProvisionTenantJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public $queue = 'tenant-provisioning';
    public $tries = 3;
    public $timeout = 300;
    
    public function __construct(
        private TenantApplication $application,
        private string $adminId
    ) {}
    
    public function handle(TenantProvisioningService $provisioningService): void
    {
        Log::info('ProvisionTenantJob started', [
            'application_id' => $this->application->getId(),
            'slug' => $this->application->getRequestedSlug()
        ]);
        
        try {
            // 1. Prepare tenant data
            $tenantData = [
                'organization_name' => $this->application->getOrganizationName(),
                'slug' => $this->application->getRequestedSlug(),
                'admin_email' => $this->application->getContactEmail()->toString(),
                'admin_name' => $this->application->getContactName(),
                'organization_type' => $this->application->getOrganizationType()->toString(),
                'provisioned_by' => $this->adminId
            ];
            
            // 2. Execute provisioning
            $tenant = $provisioningService->provisionTenant($tenantData);
            
            // 3. Update application
            $this->application->completeProvisioning($tenant->id);
            $this->applicationRepository->save($this->application);
            
            Log::info('ProvisionTenantJob completed successfully', [
                'tenant_id' => $tenant->id,
                'database_name' => $tenant->database_name
            ]);
            
        } catch (Exception $e) {
            Log::error('ProvisionTenantJob failed', [
                'application_id' => $this->application->getId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Update application with error
            $this->application->markProvisioningFailed($e->getMessage());
            $this->applicationRepository->save($this->application);
            
            throw $e;
        }
    }
}
```

### **3.2 Core Provisioning Service**

**Main Method →** `app/Contexts/Platform/Application/Services/TenantProvisioningService.php`
```php
public function provisionTenant(array $tenantData): Tenant
{
    Log::info('Starting tenant provisioning', $tenantData);
    
    // STEP 1: Validate and create tenant record
    $tenant = $this->createTenantRecord($tenantData);
    Log::info('Step 1 completed: Tenant record created', ['tenant_id' => $tenant->id]);
    
    // STEP 2: Create database
    $this->createTenantDatabase($tenant);
    Log::info('Step 2 completed: Database created', ['database_name' => $tenant->database_name]);
    
    // STEP 3: Run migrations
    $this->runTenantMigrations($tenant);
    Log::info('Step 3 completed: Migrations executed');
    
    // STEP 4: Seed initial data
    $this->seedTenantData($tenant, $tenantData);
    Log::info('Step 4 completed: Initial data seeded');
    
    // STEP 5: Send welcome email
    $this->sendWelcomeEmail($tenant, $tenantData);
    Log::info('Step 5 completed: Welcome email sent');
    
    Log::info('Tenant provisioning completed successfully', [
        'tenant_id' => $tenant->id,
        'slug' => $tenant->slug
    ]);
    
    return $tenant;
}
```

**Sub-method: Create Tenant Record**
```php
private function createTenantRecord(array $tenantData): Tenant
{
    // Check for duplicate slug (including soft-deleted)
    $existing = Tenant::withTrashed()->where('slug', $tenantData['slug'])->first();
    if ($existing) {
        throw new Exception(
            "A tenant already exists with slug '{$tenantData['slug']}'"
        );
    }
    
    // Create tenant
    $tenant = Tenant::create([
        'name' => $tenantData['organization_name'],
        'slug' => $tenantData['slug'],
        'email' => $tenantData['admin_email'],
        'database_name' => 'tenant_' . $tenantData['slug'],
        'status' => 'active',
        'branding' => json_encode([
            'organization_name' => $tenantData['organization_name'],
            'organization_type' => $tenantData['organization_type'],
            'provisioned_by' => $tenantData['provisioned_by'],
            'provisioned_at' => now()->toISOString()
        ])
    ]);
    
    return $tenant;
}
```

**Sub-method: Create Database**
```php
private function createTenantDatabase(Tenant $tenant): void
{
    $databaseName = 'tenant_' . $tenant->slug;
    
    try {
        // Create database with proper charset
        DB::statement("CREATE DATABASE IF NOT EXISTS `{$databaseName}` 
            CHARACTER SET utf8mb4 
            COLLATE utf8mb4_unicode_ci");
        
        Log::info('Tenant database created', [
            'database_name' => $databaseName,
            'tenant_id' => $tenant->id
        ]);
        
    } catch (Exception $e) {
        Log::error('Failed to create tenant database', [
            'database_name' => $databaseName,
            'error' => $e->getMessage()
        ]);
        
        throw new Exception("Failed to create database: {$e->getMessage()}");
    }
}
```

**Sub-method: Run Migrations**
```php
private function runTenantMigrations(Tenant $tenant): void
{
    // Switch to tenant database context
    config(['database.connections.tenant.database' => $tenant->database_name]);
    DB::purge('tenant');
    
    $originalDefault = DB::getDefaultConnection();
    DB::setDefaultConnection('tenant');
    
    try {
        // Run TenantAuth context migrations
        Artisan::call('migrate', [
            '--database' => 'tenant',
            '--path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations',
            '--force' => true
        ]);
        
        Log::info('Tenant domain migrations completed', [
            'tenant_id' => $tenant->id,
            'database_name' => $tenant->database_name,
            'migrations_path' => 'app/Contexts/TenantAuth/Infrastructure/Database/Migrations'
        ]);
        
        // Also run core migrations if they exist
        if (file_exists(database_path('migrations/tenant'))) {
            Artisan::call('migrate', [
                '--database' => 'tenant',
                '--path' => 'database/migrations/tenant',
                '--force' => true
            ]);
            
            Log::info('Core tenant migrations completed', [
                'tenant_id' => $tenant->id,
                'database_name' => $tenant->database_name
            ]);
        }
        
    } finally {
        // Restore original default connection
        DB::setDefaultConnection($originalDefault);
    }
}
```

**Sub-method: Seed Initial Data**
```php
private function seedTenantData(Tenant $tenant, array $tenantData): void
{
    config(['database.connections.tenant.database' => $tenant->database_name]);
    DB::purge('tenant');
    
    $originalDefault = DB::getDefaultConnection();
    DB::setDefaultConnection('tenant');
    
    try {
        $adminEmail = $tenantData['admin_email'];
        $adminName = $tenantData['admin_name'] ?? 'Administrator';
        
        // Parse name for Universal Core Schema
        $nameParts = explode(' ', $adminName, 2);
        $firstName = $nameParts[0];
        $lastName = $nameParts[1] ?? '';
        
        // Create admin user
        $userId = DB::table('tenant_users')->insertGetId([
            'uuid' => Str::uuid()->toString(),
            'tenant_id' => $tenant->numeric_id, // Use numeric_id, not UUID
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $adminEmail,
            'password_hash' => bcrypt('Start1234!'), // Initial password
            'must_change_password' => true, // Force change on first login
            'status' => 'active',
            'metadata' => json_encode([
                'tenant_id' => $tenant->id,
                'organization_name' => $tenant->name,
                'created_via' => 'tenant_provisioning',
                'is_initial_admin' => true,
                'application_contact' => true,
                'requires_password_change' => true
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        
        Log::info('Admin user created in tenant database', [
            'tenant_id' => $tenant->id,
            'user_id' => $userId,
            'admin_email' => $adminEmail
        ]);
        
    } finally {
        DB::setDefaultConnection($originalDefault);
    }
}
```

**Sub-method: Send Welcome Email**
```php
private function sendWelcomeEmail(Tenant $tenant, array $tenantData): void
{
    try {
        $adminEmail = $tenantData['admin_email'];
        $adminName = $tenantData['admin_name'] ?? 'Administrator';
        $organizationName = $tenantData['organization_name'] ?? $tenant->name;
        
        // Generate secure setup token
        $setupToken = Str::random(64);
        $tokenHash = hash('sha256', $setupToken);
        
        // Store token in landlord database
        DB::table('tenant_setup_tokens')->insert([
            'tenant_id' => $tenant->id,
            'email' => $adminEmail,
            'token' => $tokenHash,
            'status' => 'sent',
            'is_used' => false,
            'expires_at' => now()->addHours(24),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        
        // Generate URLs
        $baseUrl = config('app.url');
        $tenantSlug = $tenant->slug;
        
        $passwordSetupLink = url("/setup-password/{$setupToken}");
        $databaseAccessLink = url("/setup-credentials/{$setupToken}");
        
        $tenantLoginUrl = app()->environment('production')
            ? "https://{$tenantSlug}.publicdigit.com/login"
            : "{$baseUrl}/{$tenantSlug}/login";
            
        $tenantDashboardUrl = app()->environment('production')
            ? "https://{$tenantSlug}.publicdigit.com/dashboard"
            : "{$baseUrl}/{$tenantSlug}/dashboard";
        
        // Get database info
        $databaseName = $tenant->database_name;
        $databaseHost = env('DB_HOST', '127.0.0.1');
        $databasePort = (int) env('DB_PORT', 3306);
        
        // Send email using Platform Context mail class
        Mail::to($adminEmail)->send(
            new \App\Contexts\Platform\Infrastructure\Mail\TenantProvisioningCompletedMail(
                organizationName: $organizationName,
                contactName: $adminName,
                tenantSlug: $tenantSlug,
                tenantId: (string) $tenant->id,
                databaseName: $databaseName,
                databaseHost: $databaseHost,
                databasePort: $databasePort,
                tenantLoginUrl: $tenantLoginUrl,
                tenantDashboardUrl: $tenantDashboardUrl,
                passwordSetupLink: $passwordSetupLink,
                databaseAccessLink: $databaseAccessLink,
                setupExpiresAt: now()->addHours(24)
            )
        );
        
        Log::info('Welcome email sent successfully', [
            'tenant_id' => $tenant->id,
            'admin_email' => $adminEmail,
            'tenant_slug' => $tenant->slug,
        ]);
        
    } catch (Exception $e) {
        // Log error but don't fail provisioning
        Log::error('Failed to send welcome email', [
            'tenant_id' => $tenant->id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        // Don't throw - provisioning should still succeed even if email fails
    }
}
```

---

## 4. 📧 **Email Notifications**

### **4.1 Email Templates**

**Approval Email →** `app/Contexts/Platform/Infrastructure/Mail/TenantApplicationApprovedMail.php`
```php
class TenantApplicationApprovedMail extends Mailable
{
    public function __construct(
        public readonly TenantApplication $application
    ) {}
    
    public function content(): Content
    {
        return new Content(
            markdown: 'emails.tenant-application-approved',
            with: [
                'application' => $this->application,
                'tenantSlug' => $this->application->getRequestedSlug(),
                'contactName' => $this->application->getContactName(),
            ]
        );
    }
}
```

**Provisioning Completed Email →** `app/Contexts/Platform/Infrastructure/Mail/TenantProvisioningCompletedMail.php`
```php
class TenantProvisioningCompletedMail extends Mailable
{
    public function __construct(
        public readonly string $organizationName,
        public readonly string $contactName,
        public readonly string $tenantSlug,
        public readonly string $tenantId,
        public readonly string $databaseName,
        public readonly string $databaseHost,
        public readonly int $databasePort,
        public readonly string $tenantLoginUrl,
        public readonly string $tenantDashboardUrl,
        public readonly string $passwordSetupLink,
        public readonly string $databaseAccessLink,
        public readonly DateTimeInterface $setupExpiresAt
    ) {}
    
    public function content(): Content
    {
        return new Content(
            markdown: 'emails.tenant-provisioning-completed',
            with: [
                'initialPassword' => 'Start1234!',
                'setupExpiresInHours' => 24,
                // ... all constructor properties
            ]
        );
    }
}
```

### **4.2 Event Listeners**

**Event Listener →** `app/Contexts/Platform/Infrastructure/EventListeners/SendTenantApprovedEmail.php`
```php
class SendTenantApprovedEmail
{
    public function handle(TenantApplicationWasApproved $event): void
    {
        $application = $event->application;
        
        Mail::to($application->getContactEmail()->toString())->send(
            new TenantApplicationApprovedMail($application)
        );
    }
}
```

**Event Registration →** `app/Contexts/Platform/Infrastructure/Providers/PlatformServiceProvider.php`
```php
protected $listen = [
    TenantApplicationWasApproved::class => [
        SendTenantApprovedEmail::class,
    ],
    TenantApplicationWasRejected::class => [
        SendTenantRejectedEmail::class,
    ],
    TenantApplicationUnderReview::class => [
        SendTenantUnderReviewEmail::class,
    ],
];
```

---

## 5. 🏁 **Finalization Phase**

### **5.1 Application Status Update**

**Entity Completion →** `TenantApplication.php`
```php
public function completeProvisioning(string $tenantId): void
{
    $this->guardTransition(
        ApplicationStatus::PROVISIONING_STARTED, 
        ApplicationStatus::PROVISIONED
    );
    
    $this->status = ApplicationStatus::PROVISIONED();
    $this->tenantId = $tenantId;
    $this->provisioningCompletedAt = now();
    
    // Dispatch final event
    event(new TenantApplicationWasProvisioned($this));
}
```

### **5.2 Credential Resend (Admin Feature)**

**Route →** `routes/platform-web.php`
```php
Route::post('/admin/tenant-applications/{applicationId}/resend-credentials',
    [TenantCredentialController::class, 'resendCredentials']
)->middleware('permission:approve-tenant-applications');
```

**Controller →** `app/Contexts/Platform/Infrastructure/Http/Controllers/TenantCredentialController.php`
```php
public function resendCredentials(Request $request, string $applicationId): JsonResponse
{
    // 1. Get application and tenant
    $application = DB::table('tenant_applications')->find($applicationId);
    $tenant = DB::table('tenants')->where('email', $application->contact_email)->first();
    
    // 2. Regenerate credentials
    $result = $this->credentialService->regenerateCredentials(
        $tenant->id,
        $applicationId,
        $request->input('reason', 'Admin-initiated resend')
    );
    
    // 3. Resend email
    Mail::to($application->contact_email)->send(
        new TenantProvisioningCompletedMail(...)
    );
    
    return response()->json([
        'success' => true,
        'message' => 'Credentials resent successfully'
    ]);
}
```

---

## 6. 🔍 **Monitoring & Logging**

### **6.1 Log Files Structure**

```
storage/logs/
├── laravel.log                    # General application logs
├── provisioning.log               # Tenant provisioning specific logs
├── tenant-errors.log              # Tenant database errors
├── queue.log                      # Queue job processing
└── audit.log                      # Security audit trail
```

### **6.2 Key Log Entries**

**Provisioning Start:**
```
[2025-12-14 10:30:00] local.INFO: Starting tenant provisioning 
{
    "organization_name": "Example Corp",
    "slug": "example-corp",
    "admin_email": "admin@example.com",
    "provisioned_by": "1"
}
```

**Database Creation:**
```
[2025-12-14 10:30:05] local.INFO: Step 2 completed: Database created 
{
    "database_name": "tenant_example-corp",
    "tenant_id": "7474ebd5-7894-46ad-9ec1-ff6489684452"
}
```

**Migrations Complete:**
```
[2025-12-14 10:30:15] local.INFO: Tenant domain migrations completed 
{
    "tenant_id": "7474ebd5-7894-46ad-9ec1-ff6489684452",
    "database_name": "tenant_example-corp",
    "migrations_path": "app/Contexts/TenantAuth/Infrastructure/Database/Migrations"
}
```

**Admin User Created:**
```
[2025-12-14 10:30:20] local.INFO: Admin user created in tenant database 
{
    "tenant_id": "7474ebd5-7894-46ad-9ec1-ff6489684452",
    "user_id": 1,
    "admin_email": "admin@example.com"
}
```

**Email Sent:**
```
[2025-12-14 10:30:25] local.INFO: Welcome email sent successfully 
{
    "tenant_id": "7474ebd5-7894-46ad-9ec1-ff6489684452",
    "admin_email": "admin@example.com",
    "tenant_slug": "example-corp"
}
```

**Provisioning Complete:**
```
[2025-12-14 10:30:30] local.INFO: Tenant provisioning completed successfully 
{
    "tenant_id": "7474ebd5-7894-46ad-9ec1-ff6489684452",
    "slug": "example-corp",
    "duration_seconds": 30
}
```

---

## 7. 📊 **File Reference Index**

### **Core Files (Must Understand)**

| File | Purpose | Key Methods |
|------|---------|------------|
| **`TenantApplicationController.php`** | Public application submission | `create()`, `store()`, `checkSlugAvailability()` |
| **`TenantApplicationAdminController.php`** | Admin review interface | `index()`, `show()`, `approve()`, `reject()` |
| **`TenantApplicationService.php`** | Application business logic | `submitApplication()`, `approve()`, `startProvisioningWorkflow()` |
| **`TenantProvisioningService.php`** | Core provisioning engine | `provisionTenant()`, `createTenantDatabase()`, `runTenantMigrations()` |
| **`TenantApplication.php`** | Domain entity with state machine | `approve()`, `startProvisioning()`, `completeProvisioning()` |
| **`ProvisionTenantJob.php`** | Queue job for async processing | `handle()` |

### **Supporting Files**

| File | Purpose |
|------|---------|
| **`EloquentTenantApplicationRepository.php`** | Database persistence for applications |
| **`TenantProvisioningCompletedMail.php`** | Welcome email template |
| **`TenantCredentialController.php`** | Credential resend functionality |
| **`TenantDatabaseManager.php`** | Multi-tenant database switching |
| **`IdentifyTenantFromRequest.php`** | Middleware for tenant identification |

### **Configuration Files**

| File | Purpose |
|------|---------|
| **`config/reserved-slugs.php`** | Slugs that cannot be used as tenant identifiers |
| **`config/multitenancy.php`** | Spatie multitenancy configuration |
| **`bootstrap/providers.php`** | Service provider registration order |
| **`routes/platform-web.php`** | Web route definitions |
| **`phpunit.xml`** | Test configuration with `election_test` database |

### **Migration Files**

| Migration | Purpose |
|-----------|---------|
| **`2025_09_28_143000_create_tenant_users_table.php`** | Original tenant users table |
| **`2025_12_06_120000_align_tenant_users_with_universal_core_schema.php`** | Universal Core Schema migration |
| **`2025_10_04_062932_create_tenant_setup_tokens_table.php`** | Setup tokens for credential emails |
| **`create_tenant_applications_table.php`** | Application tracking table |

---

## 8. 🎯 **Quick Reference Commands**

### **Development Commands**
```bash
# Run provisioning tests
php artisan test tests/Feature/TenantAuth/TenantProvisioningWorkflowTest.php

# Start queue worker for provisioning
php artisan queue:listen --queue=tenant-provisioning

# Check tenant databases
mysql -u softcrew -p'Election%2025%' -e "SHOW DATABASES LIKE 'tenant_%';"

# View pending applications
php artisan tinker --execute="
    use App\Models\TenantApplication;
    TenantApplication::where('status', 'pending')->get();
"

# Manual provisioning (debugging)
php artisan tinker --execute="
    use App\Contexts\Platform\Application\Services\TenantProvisioningService;
    \$service = app(TenantProvisioningService::class);
    \$tenant = \$service->provisionTenant([
        'organization_name' => 'Test',
        'slug' => 'test-' . time(),
        'admin_email' => 'test@example.com',
        'admin_name' => 'Test Admin',
        'organization_type' => 'non_profit',
        'provisioned_by' => '1'
    ]);
    echo 'Tenant created: ' . \$tenant->id;
"
```

### **Monitoring Commands**
```bash
# Tail provisioning logs
tail -f storage/logs/laravel.log | grep -i "provisioning\|tenant_"

# Check queue status
php artisan queue:monitor --queue=tenant-provisioning

# View failed jobs
php artisan queue:failed

# Check database sizes
mysql -u softcrew -p'Election%2025%' -e "
    SELECT table_schema 'Database', 
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) 'Size (MB)'
    FROM information_schema.tables 
    WHERE table_schema LIKE 'tenant_%'
    GROUP BY table_schema;
"
```

---

## 9. 🚨 **Troubleshooting Checklist**

### **Application Stuck in "Pending"**
1. ✅ Check admin permissions (`manage-tenant-applications`)
2. ✅ Verify email configuration (approval emails sending)
3. ✅ Check `tenant_applications` table for data
4. ✅ Verify reviewer_id is set when admin starts review

### **Provisioning Fails Silently**
1. ✅ Check queue worker is running: `php artisan queue:work --queue=tenant-provisioning`
2. ✅ Check failed jobs: `php artisan queue:failed`
3. ✅ Check logs: `tail -f storage/logs/laravel.log`
4. ✅ Verify database user has CREATE DATABASE permission

### **Admin User Can't Login**
1. ✅ Check `tenant_users` table in tenant database
2. ✅ Verify password column is `password_hash` (not `password`)
3. ✅ Check `must_change_password` flag
4. ✅ Verify `tenant_id` matches `tenants.numeric_id`

### **Duplicate Slug Error**
1. ✅ Check `tenants` table for existing slug
2. ✅ Check `tenants` table with `withTrashed()`
3. ✅ Verify `config/reserved-slugs.php`
4. ✅ Check case sensitivity (MySQL may be case-sensitive)

### **Migrations Not Running**
1. ✅ Verify path: `app/Contexts/TenantAuth/Infrastructure/Database/Migrations`
2. ✅ Check database connection switching
3. ✅ Verify `migrations` table exists in tenant database
4. ✅ Check for migration errors in logs

---

## 10. 📈 **Performance Metrics**

### **Expected Timings**
| Step | Expected Time | Warning Threshold |
|------|---------------|-------------------|
| Database Creation | 1-3 seconds | > 10 seconds |
| Domain Migrations | 5-15 seconds | > 30 seconds |
| Admin User Creation | < 1 second | > 5 seconds |
| Email Sending | 1-3 seconds | > 10 seconds |
| **Total Provisioning** | **10-25 seconds** | **> 60 seconds** |

### **Monitoring Dashboard**
```bash
# Provisioning performance metrics
SELECT 
    DATE(created_at) as day,
    COUNT(*) as total_applications,
    AVG(TIMESTAMPDIFF(SECOND, reviewed_at, provisioning_completed_at)) as avg_provisioning_time_sec,
    SUM(CASE WHEN status = 'provisioned' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN status = 'provisioning_failed' THEN 1 ELSE 0 END) as failed
FROM tenant_applications
WHERE reviewed_at IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 7;
```

---

## 🎓 **Summary**

The tenant application processing system follows a **clear, linear flow** through well-defined DDD boundaries:

1. **Submission** → `TenantApplicationController` → `TenantApplicationService` → `TenantApplication` entity
2. **Review** → Admin interface → State transitions → Email notifications
3. **Provisioning** → Queue job → `TenantProvisioningService` → Database creation → Migrations → User creation
4. **Completion** → Status update → Welcome email → Audit logging

**Key Design Principles:**
- **Separation of Concerns**: Platform vs TenantAuth contexts
- **State Management**: Explicit state machine in entity
- **Async Processing**: Queue jobs for long-running operations
- **Comprehensive Logging**: Every step tracked for debugging
- **Idempotent Operations**: Safe retries and error recovery

**Remember**: Always use the test database (`election_test`) for development and testing. The provisioning system is designed to be **robust and self-healing**, with proper error handling at every step.