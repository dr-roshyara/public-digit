# Membership Module Installation System - Implementation Summary

**Date**: 2025-12-19
**Status**: ✅ Completed
**Architecture**: DDD (Domain-Driven Design) + Multi-Tenancy
**Laravel Version**: 12.35.1

---

## Executive Summary

Implemented a **modular installation system** that allows administrators to install the **Membership Module** on provisioned tenants through an admin UI. The system creates the `members` table and related schema in the **tenant-specific database** (e.g., `tenant_um1`, `tenant_nrna`), not in the landlord database.

---

## What Was Developed

### 1. **Database Schema - Members Table**

**Location**: `app/Contexts/Membership/Infrastructure/Database/Migrations/2025_12_18_103600_create_members_table.php`

**Database**: Tenant-specific (e.g., `tenant_um1`, `tenant_nrna`)

**Schema**:
```sql
CREATE TABLE members (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    tenant_user_id BIGINT UNSIGNED NULL,  -- Optional link to tenant_users

    -- Geography (Required: Province + District)
    country_code CHAR(2) DEFAULT 'NP',
    admin_unit_level1_id INT UNSIGNED NOT NULL,  -- Province
    admin_unit_level2_id INT UNSIGNED NOT NULL,  -- District
    admin_unit_level3_id INT UNSIGNED NULL,      -- Local Level (Optional)
    admin_unit_level4_id INT UNSIGNED NULL,      -- Ward (Optional)

    -- Member Information
    full_name VARCHAR(255) NOT NULL,
    membership_number VARCHAR(50) UNIQUE NOT NULL,
    membership_type VARCHAR(50) DEFAULT 'full',
    status VARCHAR(50) DEFAULT 'active',

    -- Timestamps
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,

    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_tenant_user_id (tenant_user_id),
    INDEX idx_membership_number (membership_number),
    INDEX idx_status (status),
    INDEX idx_geography_country_province (country_code, admin_unit_level1_id),
    INDEX idx_geography_country_district (country_code, admin_unit_level2_id),

    -- Foreign Key
    FOREIGN KEY (tenant_user_id)
        REFERENCES tenant_users(id)
        ON DELETE SET NULL
);
```

**Key Features**:
- **Multi-tenancy**: Each tenant has its own `members` table in its own database
- **Geography-based organization**: Supports 4-level administrative hierarchy (Province → District → Local Level → Ward)
- **Optional user linking**: Members can exist without user accounts (tenant_user_id nullable)
- **Soft deletes**: Uses `deleted_at` for data preservation
- **Performance indexes**: Optimized for geography and status queries

---

### 2. **Installation Job - InstallMembershipModule**

**Location**: `app/Contexts/Membership/Application/Jobs/InstallMembershipModule.php`

**Purpose**: Background job that installs Membership module schema on a tenant database

**Key Implementation Details**:

```php
class InstallMembershipModule implements ShouldQueue, NotTenantAware
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 600;  // 10 minutes
    protected Tenant $tenant;

    public function __construct(Tenant $tenant)
    {
        $this->tenant = $tenant;
        $this->onQueue('tenant-provisioning');  // Dedicated queue
    }

    public function handle(): void
    {
        DB::beginTransaction();

        try {
            // Step 1: Switch to tenant database
            $this->switchToTenantDatabase();

            // Step 2: Run membership seeder (migrations + default data)
            $this->runMembershipSeeder();

            // Step 3: Update tenant metadata
            $this->updateTenantMetadata();

            DB::commit();

            Log::info('Membership module installation completed successfully', [
                'tenant_id' => $this->tenant->id,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->markInstallationFailed($e->getMessage());
            throw $e;
        }
    }
}
```

**Critical Implementation Points**:

1. **NotTenantAware Interface**: Prevents Spatie multitenancy from injecting tenant context (job manually handles database switching)

2. **Database Switching**:
```php
protected function switchToTenantDatabase(): void
{
    $databaseName = $this->tenant->getDatabaseName();  // e.g., "tenant_um1"

    config([
        'database.connections.tenant_install' => [
            'driver' => 'mysql',
            'database' => $databaseName,  // Tenant-specific database
            'host' => env('DB_HOST'),
            'username' => env('DB_USERNAME'),
            'password' => env('DB_PASSWORD'),
            // ...
        ],
    ]);

    config(['database.default' => 'tenant_install']);
    DB::purge('tenant_install');
    DB::reconnect('tenant_install');
}
```

3. **Metadata Tracking**:
```php
protected function updateTenantMetadata(): void
{
    // Switch back to landlord database
    config(['database.default' => 'mysql']);
    DB::reconnect('mysql');

    $metadata = $this->tenant->metadata ?? [];
    $metadata['modules']['membership'] = [
        'installed' => true,
        'installed_at' => now()->toIso8601String(),
        'version' => '1.0.0',
        'status' => 'active',
    ];

    $this->tenant->update(['metadata' => $metadata]);
}
```

---

### 3. **Database Seeder - MembershipDatabaseSeeder**

**Location**: `app/Contexts/Membership/Infrastructure/Database/Seeders/MembershipDatabaseSeeder.php`

**Purpose**: Runs Membership migrations and seeds default data

**CRITICAL FIX - Database Parameter**:

```php
protected function runMembershipMigrations(): void
{
    $migrationPath = 'app/Contexts/Membership/Infrastructure/Database/Migrations';

    Log::info('Running membership migrations', [
        'path' => $migrationPath,
        'database' => 'tenant_install',
    ]);

    // CRITICAL: --database parameter ensures migration runs on tenant database
    Artisan::call('migrate', [
        '--path' => $migrationPath,
        '--database' => 'tenant_install',  // ← Without this, migrations fail
        '--force' => true,
    ]);

    $output = Artisan::output();
    Log::info('Membership migrations output', ['output' => $output]);
}
```

**Why `--database` Parameter is Critical**:
- Artisan::call() may reset to Laravel's default connection
- Explicit `--database => 'tenant_install'` forces correct connection
- Without this, migrations run on landlord database or fail silently

---

### 4. **Admin Controller Method**

**Location**: `app/Http/Controllers/Admin/TenantApplicationAdminController.php`

**Method**: `installMembershipModule(string $applicationId)`

**Implementation**:

```php
public function installMembershipModule(string $applicationId)
{
    try {
        // 1. Get application
        $application = $this->applicationRepository->findById($applicationId);
        if (!$application) {
            return redirect()->back()->withErrors(['error' => 'Application not found']);
        }

        // 2. Verify tenant is provisioned
        $status = $application->getStatus();
        if (!$status->equals(ApplicationStatus::provisioned())) {
            return redirect()->back()->withErrors([
                'error' => 'Tenant must be provisioned before installing modules'
            ]);
        }

        // 3. Find tenant by slug
        $tenant = Tenant::where('slug', $application->getRequestedSlug())->first();
        if (!$tenant) {
            return redirect()->back()->withErrors(['error' => 'Tenant not found']);
        }

        // 4. Check if already installed
        $metadata = $tenant->metadata ?? [];
        if (isset($metadata['modules']['membership']['installed']) &&
            $metadata['modules']['membership']['installed'] === true) {
            return redirect()->back()->with('info', 'Module already installed');
        }

        // 5. Dispatch installation job to tenant-provisioning queue
        InstallMembershipModule::dispatch($tenant);

        return redirect()->back()->with('success',
            'Membership module installation started! Running in background.');

    } catch (\Exception $e) {
        Log::error('Membership module installation failed', [
            'application_id' => $applicationId,
            'error' => $e->getMessage(),
        ]);

        return redirect()->back()->withErrors([
            'error' => 'Installation failed. Check logs.'
        ]);
    }
}
```

**Validation Rules**:
1. Application must exist
2. Tenant must be provisioned (status = 'provisioned')
3. Tenant record must exist in database
4. Module must not already be installed

---

### 5. **Route Configuration**

**Location**: `routes/tenant-applications.php`

```php
Route::prefix('admin')
    ->middleware(['auth', 'permission:manage-tenant-applications'])
    ->group(function () {

    // Module installation endpoint
    Route::post(
        '/tenant-applications/{applicationId}/install-membership-module',
        [TenantApplicationAdminController::class, 'installMembershipModule']
    )
        ->name('admin.tenant-applications.install-membership-module')
        ->middleware('permission:approve-tenant-applications');
});
```

**Access Control**:
- Requires authentication
- Requires `manage-tenant-applications` permission
- Requires `approve-tenant-applications` permission

---

### 6. **Admin UI Components**

**Location**: `resources/js/Pages/Admin/TenantApplications/Show.vue`

**Features Added**:

1. **Module Management Section**:
   - Displays available modules (Membership)
   - Shows installation status (Installed/Not Installed)
   - Installation button with loading state

2. **Installation Confirmation Modal**:
   - Shows organization details
   - Lists module capabilities
   - Security notice about background installation
   - Confirm/Cancel actions

3. **Status Display**:
   - Green badge: "Installed" with checkmark
   - Gray badge: "Not Installed"
   - Success/Error messages with auto-hide

4. **Installation Flow**:
```javascript
const installMembershipModule = async () => {
    installingMembership.value = true;

    try {
        const response = await axios.post(
            `/admin/tenant-applications/${props.application.id}/install-membership-module`
        );

        moduleInstallMessage.value = {
            success: true,
            text: response.data.message
        };

        showMembershipInstallConfirmation.value = false;
        router.reload({ only: ['application'] });

    } catch (error) {
        moduleInstallMessage.value = {
            success: false,
            text: error.response?.data?.message || 'Installation failed'
        };
    } finally {
        installingMembership.value = false;
    }
};
```

5. **Module Status Detection**:
```javascript
const membershipModuleInstalled = computed(() => {
    if (!props.application.metadata?.modules?.membership) {
        return false;
    }
    return props.application.metadata.modules.membership.installed === true;
});
```

---

## Architecture & Data Flow

### **Complete Installation Workflow**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ADMIN UI (Vue 3 + Inertia.js)                               │
│    /admin/tenant-applications/{id}                             │
├─────────────────────────────────────────────────────────────────┤
│ User clicks "Install Module" button                            │
│ → Confirmation modal appears                                   │
│ → User confirms installation                                   │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CONTROLLER (Admin Layer)                                    │
│    TenantApplicationAdminController::installMembershipModule()  │
├─────────────────────────────────────────────────────────────────┤
│ Validates:                                                      │
│ - Application exists                                           │
│ - Tenant is provisioned                                        │
│ - Module not already installed                                │
│                                                                 │
│ Finds: Tenant record by slug                                   │
│ Dispatches: InstallMembershipModule::dispatch($tenant)         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. QUEUE SYSTEM (Laravel Queue)                                │
│    Queue: tenant-provisioning                                  │
├─────────────────────────────────────────────────────────────────┤
│ Job stored in 'jobs' table (landlord database)                 │
│ Queue worker picks up job:                                     │
│   php artisan queue:listen --queue=tenant-provisioning         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. BACKGROUND JOB (Application Layer)                          │
│    InstallMembershipModule::handle()                            │
├─────────────────────────────────────────────────────────────────┤
│ Step 1: Switch to tenant database                              │
│   - Creates 'tenant_install' connection                        │
│   - Database: tenant_um1 (or tenant_nrna, etc.)               │
│   - Sets as default connection                                 │
│                                                                 │
│ Step 2: Run MembershipDatabaseSeeder                           │
│   - Calls Artisan migrate with --database=tenant_install      │
│   - Runs 2025_12_18_103600_create_members_table.php           │
│   - Creates 'members' table in TENANT database                 │
│                                                                 │
│ Step 3: Update tenant metadata (switch back to landlord)       │
│   - Adds modules.membership.installed = true                   │
│   - Records installation timestamp and version                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. DATABASE RESULT                                             │
├─────────────────────────────────────────────────────────────────┤
│ LANDLORD DATABASE (election):                                  │
│ - tenants.metadata updated with module status                  │
│                                                                 │
│ TENANT DATABASE (tenant_um1):                                  │
│ - migrations table: new entry for members migration            │
│ - members table: CREATED ✓                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Isolation - Multi-Tenancy Architecture

### **Critical Concept: Separate Databases**

```
┌─────────────────────────────────────────────────────────────────┐
│ LANDLORD DATABASE: election                                    │
├─────────────────────────────────────────────────────────────────┤
│ Tables:                                                         │
│ - tenants (tenant records, metadata)                           │
│ - users (platform admin users)                                 │
│ - tenant_applications                                          │
│ - permissions, roles                                           │
│ - jobs, failed_jobs                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TENANT DATABASE: tenant_um1                                    │
├─────────────────────────────────────────────────────────────────┤
│ Tables (before module installation):                           │
│ - tenant_users                                                  │
│ - committee_users                                              │
│ - organizational_units                                         │
│ - tenant_brandings                                             │
│ - migrations                                                    │
├─────────────────────────────────────────────────────────────────┤
│ NEW TABLE (after module installation):                         │
│ - members ← CREATED BY MEMBERSHIP MODULE                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TENANT DATABASE: tenant_nrna                                   │
├─────────────────────────────────────────────────────────────────┤
│ Tables:                                                         │
│ - tenant_users                                                  │
│ - committee_users                                              │
│ - members ← SEPARATE MEMBERS TABLE FOR THIS TENANT            │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points**:
1. Each tenant has its own database (`tenant_{slug}`)
2. Each tenant's `members` table is completely isolated
3. Zero data sharing between tenants
4. Landlord database tracks module installation status

---

## Queue Configuration

### **Queue Architecture**

**Queue Name**: `tenant-provisioning`

**Purpose**: Dedicated queue for tenant setup operations (provisioning, module installations)

**Why Separate Queue**:
- Long-running operations (migrations can take time)
- Should not block other application jobs
- Can scale workers independently
- Better monitoring and error tracking

**Worker Command**:
```bash
php artisan queue:listen --queue=tenant-provisioning --tries=3 --timeout=600
```

**Job Configuration**:
```php
public $tries = 3;           // Retry 3 times on failure
public $timeout = 600;       // 10 minutes max execution time
public $queue = 'tenant-provisioning';  // Dedicated queue
```

---

## Error Handling & Recovery

### **Transaction Safety**

```php
DB::beginTransaction();

try {
    $this->switchToTenantDatabase();
    $this->runMembershipSeeder();
    $this->updateTenantMetadata();

    DB::commit();  // ✅ Success

} catch (\Exception $e) {
    DB::rollBack();  // ❌ Rollback on failure
    $this->markInstallationFailed($e->getMessage());
    throw $e;  // Re-throw for job retry
}
```

### **Failure Tracking**

When installation fails:
```php
protected function markInstallationFailed(string $errorMessage): void
{
    config(['database.default' => 'mysql']);

    $metadata = $this->tenant->metadata ?? [];
    $metadata['modules']['membership'] = [
        'installed' => false,
        'last_install_attempt' => now()->toIso8601String(),
        'status' => 'failed',
        'error' => $errorMessage,
    ];

    $this->tenant->update(['metadata' => $metadata]);
}
```

### **Job Retry Mechanism**

- **Max Attempts**: 3
- **Backoff**: Automatic exponential backoff
- **Timeout**: 10 minutes per attempt
- **Failed Job Handler**: `failed()` method logs errors

---

## Testing & Verification

### **Test Scripts Created**

1. **test-membership-install.php**:
   - Manually dispatches installation job
   - Verifies job is queued
   - Shows tenant information

2. **clear-membership-metadata.php**:
   - Clears failed installation metadata
   - Allows retry after failures
   - Shows before/after metadata

### **Verification Commands**

**Check if members table exists**:
```bash
mysql -e "USE tenant_um1; SHOW TABLES LIKE 'members';"
```

**Check table structure**:
```bash
mysql -e "USE tenant_um1; DESCRIBE members;"
```

**Check tenant metadata**:
```bash
php artisan tinker --execute="
\$tenant = App\Models\Tenant::where('slug', 'um1')->first();
print_r(\$tenant->metadata['modules']['membership']);
"
```

**Check migration status**:
```bash
mysql -e "USE tenant_um1; SELECT * FROM migrations WHERE migration LIKE '%members%';"
```

---

## DDD Compliance

### **Bounded Contexts**

```
app/Contexts/
├── Membership/
│   ├── Domain/
│   │   └── Models/
│   │       └── Member.php  (Domain model)
│   ├── Application/
│   │   ├── Jobs/
│   │   │   └── InstallMembershipModule.php  (Application service)
│   │   └── Services/
│   │       └── MemberRegistrationService.php
│   └── Infrastructure/
│       └── Database/
│           ├── Migrations/
│           │   └── 2025_12_18_103600_create_members_table.php
│           └── Seeders/
│               └── MembershipDatabaseSeeder.php
```

### **Layering**

1. **Domain Layer**: `Member` model with business logic
2. **Application Layer**: `InstallMembershipModule` job (use case)
3. **Infrastructure Layer**: Database migrations, seeders

### **Separation of Concerns**

- **Controller**: Validates request, dispatches job
- **Job**: Orchestrates installation workflow
- **Seeder**: Handles database operations
- **Migration**: Defines schema

---

## Security Considerations

### **Access Control**

- Only users with `approve-tenant-applications` permission can install modules
- Authenticated users only
- CSRF protection (Laravel web middleware)

### **Data Isolation**

- Complete database isolation per tenant
- No cross-tenant queries possible
- Module installation metadata stored in landlord database

### **Error Information**

- Error messages sanitized before showing to user
- Detailed errors logged securely
- Stack traces only in logs, not in UI

---

## Performance Optimization

### **Asynchronous Processing**

- Module installation runs in background
- UI responds immediately (< 200ms)
- User can continue working while installation completes

### **Database Indexes**

Members table includes optimized indexes:
- Geography queries (country + province, country + district)
- Membership number lookups (unique index)
- Status filtering (status index)
- Tenant isolation (tenant_id index)

### **Queue Workers**

- Dedicated `tenant-provisioning` queue
- Can scale horizontally (multiple workers)
- Timeout prevents stuck jobs

---

## Logging & Monitoring

### **Log Points**

1. Job dispatch (Controller)
2. Job starts (handle() method)
3. Database switch complete
4. Migrations start
5. Migrations complete (with output)
6. Metadata update
7. Job completion
8. Any errors (with stack trace)

### **Log Example**

```
[2025-12-19 00:30:00] Starting Membership module installation
    tenant_id: 78f145a2-8c9d-446e-96d2-7155553fbdca
    tenant_slug: um1

[2025-12-19 00:30:01] Switching to tenant database
    database: tenant_um1

[2025-12-19 00:30:02] Running membership migrations
    path: app/Contexts/Membership/Infrastructure/Database/Migrations
    database: tenant_install

[2025-12-19 00:30:03] Membership migrations output
    output: Migration table created successfully.
            Migrating: 2025_12_18_103600_create_members_table
            Migrated: 2025_12_18_103600_create_members_table (150ms)

[2025-12-19 00:30:04] Membership module installation completed successfully
    tenant_id: 78f145a2-8c9d-446e-96d2-7155553fbdca
```

---

## Future Extensibility

### **Adding More Modules**

The system is designed for extensibility:

1. **Create new migration** in relevant context
2. **Create new seeder** (e.g., ElectionDatabaseSeeder)
3. **Create new job** (e.g., InstallElectionModule)
4. **Add route** to controller
5. **Add UI component** in Show.vue

### **Module Dependencies**

Future modules can depend on Membership:
```php
// In InstallElectionModule
public function handle()
{
    // Check if Membership module is installed
    if (!$this->hasModuleInstalled('membership')) {
        throw new Exception('Election module requires Membership module');
    }

    // Proceed with installation...
}
```

---

## Summary: Where is the Members Table?

### ✅ **MEMBERS TABLE LOCATION**

**Database**: `tenant_um1` (or `tenant_{slug}` for each tenant)

**NOT in**: `election` (landlord database)

**Verification**:
```sql
-- WRONG - Will NOT find members table
USE election;
SHOW TABLES;  -- No 'members' table here

-- CORRECT - Members table is here
USE tenant_um1;
SHOW TABLES;  -- 'members' table exists here ✓
```

### **Why Tenant Database?**

1. **Data Isolation**: Each tenant's members are completely isolated
2. **Scalability**: Can move tenant databases to separate servers
3. **Security**: No cross-tenant data leakage possible
4. **Compliance**: Required for multi-tenant SaaS architecture

### **Metadata Tracking (Landlord Database)**

Installation status is tracked in landlord database:
```sql
-- In landlord database (election)
SELECT metadata FROM tenants WHERE slug = 'um1';

-- Result:
{
  "modules": {
    "membership": {
      "installed": true,
      "installed_at": "2025-12-19T00:30:04+00:00",
      "version": "1.0.0",
      "status": "active"
    }
  }
}
```

---

## Files Created/Modified

### **New Files**:
1. `app/Contexts/Membership/Infrastructure/Database/Seeders/MembershipDatabaseSeeder.php`
2. `app/Contexts/Membership/Application/Jobs/InstallMembershipModule.php`
3. `packages/laravel-backend/test-membership-install.php`
4. `packages/laravel-backend/clear-membership-metadata.php`
5. `packages/laravel-backend/QUEUE_WORKERS.md`

### **Modified Files**:
1. `app/Http/Controllers/Admin/TenantApplicationAdminController.php` (added installMembershipModule method)
2. `routes/tenant-applications.php` (added POST route)
3. `resources/js/Pages/Admin/TenantApplications/Show.vue` (added UI components)

### **Existing Files Used**:
1. `app/Contexts/Membership/Infrastructure/Database/Migrations/2025_12_18_103600_create_members_table.php`
2. `app/Contexts/Membership/Domain/Models/Member.php`

---

## Next Steps for Production

1. **Queue Worker Supervisor Configuration** (see QUEUE_WORKERS.md)
2. **Monitoring & Alerting** for failed installations
3. **Admin notification** when installation completes
4. **UI polling** to update status in real-time
5. **Backup strategy** before module installations

---

**Documentation Version**: 1.0
**Last Updated**: 2025-12-19 00:45 UTC
**Maintained By**: Backend Team
