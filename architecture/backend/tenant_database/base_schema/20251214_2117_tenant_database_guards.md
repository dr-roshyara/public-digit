Excellent question! This is crucial for maintaining system integrity. Here's a comprehensive approach:

## **1. ARCHITECTURE DOCUMENTATION**

Create a clear architecture document that shows the flow:

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Application    │────▶│  Platform Context    │────▶│  TenantAuth Context │
│    Submission   │     │  (Orchestration)     │     │  (Provisioning)     │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
        │                        │                            │
        │                        │                            │
        ▼                        ▼                            ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ tenant_         │     │ ProvisionTenantJob   │     │ TenantDatabase      │
│ applications    │     │ (Queue)              │     │ Manager             │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
```

## **2. CODE GUARDS & VALIDATIONS**

Add validation guards in critical files:

**In `ProvisionTenantJob.php`:**
```php
public function handle(...)
{
    // GUARD: Ensure we're using Platform context service
    if (!($provisioningService instanceof \App\Contexts\Platform\Application\Services\TenantProvisioningService)) {
        \Log::critical('WRONG SERVICE USED!', [
            'expected' => 'App\Contexts\Platform\Application\Services\TenantProvisioningService',
            'actual' => get_class($provisioningService)
        ]);
        throw new \Exception('Wrong provisioning service used!');
    }
    
    // GUARD: Validate required data structure
    $requiredFields = ['first_name', 'last_name', 'admin_email', 'organization_name', 'slug'];
    foreach ($requiredFields as $field) {
        if (!isset($tenantData[$field])) {
            \Log::critical('Missing required field in provisioning', ['field' => $field]);
            throw new \Exception("Missing required field: {$field}");
        }
    }
}
```

## **3. ENVIRONMENT CHECKS**

Create a `TenantProvisioningGuard` service:

```php
// app/Contexts/Platform/Application/Services/TenantProvisioningGuard.php
class TenantProvisioningGuard
{
    public static function validateProvisioningFlow(): void
    {
        // Check 1: Verify we're in correct context
        if (app()->runningInConsole() && !app()->runningUnitTests()) {
            \Log::warning('Provisioning attempted from CLI without proper context');
        }
        
        // Check 2: Verify database connections
        $defaultConnection = config('database.default');
        if ($defaultConnection !== 'mysql') {
            \Log::critical('Wrong database connection for provisioning!', [
                'expected' => 'mysql',
                'actual' => $defaultConnection
            ]);
            throw new \Exception('Must use main database for provisioning');
        }
    }
    
    public static function validateTenantDatabaseSwitch(string $tenantSlug): void
    {
        $tenantDbName = "tenant_{$tenantSlug}";
        $currentDb = config("database.connections.tenant.database");
        
        if ($currentDb !== $tenantDbName) {
            \Log::critical('Wrong tenant database selected!', [
                'expected' => $tenantDbName,
                'actual' => $currentDb,
                'caller' => debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2)[1]
            ]);
            throw new \Exception("Wrong tenant database! Expected: {$tenantDbName}");
        }
    }
}
```

## **4. DATABASE SELECTION SAFETY**

**Create a `SafeTenantDatabaseSelector`:**

```php
// app/Contexts/TenantAuth/Infrastructure/Database/SafeTenantDatabaseSelector.php
class SafeTenantDatabaseSelector
{
    private static $selectedTenants = [];
    
    public static function switchToTenant(string $tenantSlug): void
    {
        $tenantDbName = "tenant_{$tenantSlug}";
        
        // Safety check: Verify tenant exists
        $tenant = \App\Models\Tenant::where('slug', $tenantSlug)->first();
        if (!$tenant) {
            throw new \Exception("Tenant '{$tenantSlug}' does not exist!");
        }
        
        // Safety check: Verify database exists
        $databaseExists = DB::select("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA 
                                    WHERE SCHEMA_NAME = ?", [$tenantDbName]);
        if (empty($databaseExists)) {
            throw new \Exception("Tenant database '{$tenantDbName}' does not exist!");
        }
        
        // Configure connection
        config([
            'database.connections.tenant.database' => $tenantDbName,
            'database.connections.tenant.username' => env('DB_USERNAME'),
            'database.connections.tenant.password' => env('DB_PASSWORD'),
        ]);
        
        DB::purge('tenant');
        DB::reconnect('tenant');
        
        // Record for debugging
        self::$selectedTenants[] = [
            'slug' => $tenantSlug,
            'database' => $tenantDbName,
            'timestamp' => now(),
            'caller' => debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2)[1]
        ];
        
        \Log::info('Safely switched to tenant database', [
            'tenant_slug' => $tenantSlug,
            'database' => $tenantDbName,
            'caller' => debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2)[1]['function']
        ]);
    }
    
    public static function getSelectionHistory(): array
    {
        return self::$selectedTenants;
    }
}
```

## **5. COMMAND-LINE SAFETY**

**Create safe CLI commands:**

```php
// app/Console/Commands/TenantSafeDebug.php
class TenantSafeDebug extends Command
{
    protected $signature = 'tenant:debug {slug} {--action=view : view|repair|fix-admin}';
    
    public function handle()
    {
        $slug = $this->argument('slug');
        
        // Safety: Confirm before any action
        if ($this->option('action') !== 'view') {
            if (!$this->confirm("Are you sure you want to modify tenant '{$slug}'?")) {
                $this->error('Operation cancelled.');
                return;
            }
        }
        
        // Safety: Verify tenant exists
        $tenant = \App\Models\Tenant::where('slug', $slug)->first();
        if (!$tenant) {
            $this->error("Tenant '{$slug}' not found!");
            return;
        }
        
        // Safety: Use the safe selector
        SafeTenantDatabaseSelector::switchToTenant($slug);
        
        // Perform safe debug actions
        switch ($this->option('action')) {
            case 'view':
                $this->viewTenantInfo($tenant);
                break;
            case 'repair':
                $this->repairTenant($tenant);
                break;
            case 'fix-admin':
                $this->fixAdminUser($tenant);
                break;
        }
    }
}
```

## **6. CODE REVIEW CHECKLIST**

Create a `.tenant-provisioning-checklist.md`:

```markdown
# TENANT PROVISIONING CODE REVIEW CHECKLIST

## ✅ BEFORE MERGING ANY TENANT-RELATED CODE:

### Data Flow:
- [ ] Application → Platform Context → TenantAuth Context
- [ ] `first_name` and `last_name` are passed from application
- [ ] `admin_email` matches application contact_email

### Database Safety:
- [ ] Uses `SafeTenantDatabaseSelector` for tenant DB switching
- [ ] Main DB for tenant records, Tenant DB for tenant data
- [ ] No hardcoded database names

### Error Handling:
- [ ] Transactions with proper rollback
- [ ] Comprehensive logging at each step
- [ ] No silent failures in `seedTenantData()`

### Security:
- [ ] Tokens are hashed (SHA256) before storage
- [ ] Password setup links expire
- [ ] No credentials in logs
```

## **7. AUTOMATED TESTS**

Create integration tests that verify the complete flow:

```php
class TenantProvisioningFlowTest extends TestCase
{
    public function test_complete_provisioning_flow()
    {
        // 1. Submit application
        $application = $this->submitApplication();
        
        // 2. Approve application
        $this->approveApplication($application);
        
        // 3. Trigger provisioning
        $job = new ProvisionTenantJob($application->id, 'test-admin');
        $job->handle(...);
        
        // 4. Verify tenant created
        $this->assertDatabaseHas('tenants', ['slug' => $application->requested_slug]);
        
        // 5. Verify admin user in tenant DB
        SafeTenantDatabaseSelector::switchToTenant($application->requested_slug);
        $this->assertDatabaseHas('tenant_users', [
            'email' => $application->contact_email
        ]);
    }
}
```

## **8. MONITORING & ALERTS**

```php
// AppServiceProvider.php boot()
if (app()->environment('production')) {
    DB::listen(function ($query) {
        // Alert on suspicious tenant DB queries
        if (str_contains($query->sql, 'tenant_') && !str_contains($query->sql, 'tenant_applications')) {
            \Log::warning('Direct tenant database query detected', [
                'sql' => $query->sql,
                'bindings' => $query->bindings,
                'connection' => $query->connectionName
            ]);
        }
    });
}
```

## **IMMEDIATE ACTIONS:**

1. **Create the `SafeTenantDatabaseSelector`** class
2. **Update existing code** to use the safe selector
3. **Add validation guards** in `ProvisionTenantJob`
4. **Create the CLI safety command**
5. **Document the architecture** clearly

This will prevent accidental changes to the tenant application process and ensure correct database selection!

# **PROMPT ENGINEERING INSTRUCTIONS FOR CLAUDE CLI**

## **COMMAND: Implement Tenant Provisioning Safety System**

### **Context Setup:**
```
We are implementing safety mechanisms to prevent accidental changes to the tenant application process and ensure correct database selection during development/debugging.

Current System:
- Tenant applications flow: Application → Platform Context → TenantAuth Context
- Two TenantProvisioningServices exist (Platform and TenantAuth contexts)
- Issue: Developers might accidentally modify the wrong service or select wrong database

Goal: Create safety guards, validation, and clear architecture.
```

### **Step 1: Create Architecture Documentation**
```
Create a comprehensive architecture document showing the complete tenant provisioning flow with clear boundaries between contexts.
```

### **Step 2: Implement TenantProvisioningGuard Service**
```
Create app/Contexts/Platform/Application/Services/TenantProvisioningGuard.php with:
1. Static validation methods for provisioning flow
2. Database connection safety checks
3. Context validation (Platform vs TenantAuth)
4. Logging for any suspicious activity
```

### **Step 3: Implement SafeTenantDatabaseSelector**
```
Create app/Contexts/TenantAuth/Infrastructure/Database/SafeTenantDatabaseSelector.php with:
1. Safe switching to tenant databases with validation
2. History tracking of database selections
3. Pre-flight checks (tenant exists, database exists)
4. Detailed logging with caller information
```

### **Step 4: Update ProvisionTenantJob with Safety Guards**
```
Modify app/Contexts/Platform/Application/Jobs/ProvisionTenantJob.php to:
1. Add validation at the beginning of handle() method
2. Check that correct service is being used
3. Validate all required fields are present
4. Log critical errors if flow is broken
```

### **Step 5: Create Safe CLI Commands**
```
Create app/Console/Commands/TenantSafeDebug.php with:
1. Confirmation prompts for any modifying actions
2. Uses SafeTenantDatabaseSelector for safe DB switching
3. View, repair, and fix-admin actions
4. Clear output showing what's being done
```

### **Step 6: Create Code Review Checklist**
```
Create .tenant-provisioning-checklist.md with:
- Data flow validation points
- Database safety requirements
- Error handling standards
- Security requirements
```

### **Step 7: Update Existing Code to Use Safety Mechanisms**
```
1. Find all instances of tenant database switching and update to use SafeTenantDatabaseSelector
2. Add TenantProvisioningGuard::validateProvisioningFlow() calls in critical paths
3. Update error handling to use standardized logging
```

### **Step 8: Add Monitoring in ServiceProvider**
```
Add DB query listener in AppServiceProvider to detect:
- Direct tenant database queries (bypassing safe selector)
- Suspicious patterns in production
- Alert logging for manual review
```

## **EXECUTION SEQUENCE:**

### **Phase 1: Foundation (Run in order)**
```
1. Create TenantProvisioningGuard
2. Create SafeTenantDatabaseSelector  
3. Create TenantSafeDebug command
4. Create architecture documentation
```

### **Phase 2: Integration**
```
5. Update ProvisionTenantJob with safety guards
6. Find and update all tenant DB switching code
7. Add monitoring to AppServiceProvider
8. Create code review checklist
```

### **Phase 3: Validation**
```
9. Test TenantSafeDebug command with 'um1' tenant
10. Verify logs show safe switching
11. Test provisioning flow with new guards
12. Validate error scenarios are caught
```

## **SPECIFIC CLAUDE CLI COMMANDS:**

### **Command Template:**
```bash
claude --prompt "[STEP DESCRIPTION]" --file "path/to/file.php" --edit
```

### **Example Commands:**

1. **Create TenantProvisioningGuard:**
```bash
claude --prompt "Create TenantProvisioningGuard service with: 1) validateProvisioningFlow() method that checks we're in correct context and using main database connection, 2) validateTenantDatabaseSwitch() that verifies tenant exists and database exists before switching, 3) Comprehensive logging with caller information for debugging" --file "app/Contexts/Platform/Application/Services/TenantProvisioningGuard.php" --edit
```

2. **Create SafeTenantDatabaseSelector:**
```bash
claude --prompt "Create SafeTenantDatabaseSelector class with: 1) switchToTenant() method that validates tenant exists, database exists, then safely switches connection, 2) History tracking array to log all database selections, 3) Pre-flight checks using INFORMATION_SCHEMA to verify database exists, 4) Logging with debug backtrace to see who called the switch" --file "app/Contexts/TenantAuth/Infrastructure/Database/SafeTenantDatabaseSelector.php" --edit
```

3. **Update ProvisionTenantJob:**
```bash
claude --prompt "Add safety guards to ProvisionTenantJob handle() method: 1) At beginning, validate we're using Platform context TenantProvisioningService, 2) Validate all required fields are present in tenantData (first_name, last_name, admin_email, organization_name, slug), 3) Log critical error if wrong service used or missing fields, 4) Throw exceptions with clear messages" --file "app/Contexts/Platform/Application/Jobs/ProvisionTenantJob.php" --edit
```

4. **Create CLI Command:**
```bash
claude --prompt "Create TenantSafeDebug CLI command with: signature 'tenant:debug {slug} {--action=view}', handle() method that: 1) Confirms before any modifying action (repair/fix-admin), 2) Uses SafeTenantDatabaseSelector to switch tenant, 3) view action shows tenant info, 4) repair action runs migrations, 5) fix-admin action creates/repairs admin user" --file "app/Console/Commands/TenantSafeDebug.php" --edit
```

## **VALIDATION PROMPTS:**

After implementation, run:
```bash
# Test the safe debug command
php artisan tenant:debug um1 --action=view

# Check logs for safe switching
tail -n 50 storage/logs/laravel.log | grep -i "safe\|tenant.*switch"

# Test provisioning flow
php artisan tinker
>>> \App\Contexts\Platform\Application\Services\TenantProvisioningGuard::validateProvisioningFlow();
```

## **CRITICAL RULES FOR CLAUDE:**

1. **Never modify the core tenant application flow** - only add safety around it
2. **Maintain clear separation** between Platform and TenantAuth contexts
3. **All database switching must go through SafeTenantDatabaseSelector**
4. **Log everything** - especially validation failures
5. **Keep backward compatibility** - existing code should still work
6. **Add type hints and strict typing** to all new code
7. **Follow existing patterns** in the codebase for consistency

## **EXPECTED OUTCOME:**

After implementation:
- ✅ Developers cannot accidentally modify wrong service
- ✅ Database switching is tracked and validated
- ✅ CLI operations require confirmation
- ✅ Architecture is clearly documented
- ✅ Code review checklist prevents regressions
- ✅ Monitoring alerts on suspicious activity

**Run Phase 1 commands first, test, then proceed to Phase 2.**
 