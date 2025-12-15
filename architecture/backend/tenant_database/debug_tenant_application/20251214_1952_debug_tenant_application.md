Now I can see the complete picture! There's a **critical mismatch** between what the `ProvisionTenantJob` sends and what the `TenantProvisioningService` expects.

## **THE PROBLEM:**

Looking at the `ProvisionTenantJob`:
```php
// Job calls provisioningService with this structure:
$tenant = $provisioningService->provisionTenant([
    'organization_name' => $application->getOrganizationName(),
    'slug' => $application->getRequestedSlug(),
    'admin_email' => $application->getContactEmail()->toString(),
    'admin_name' => $application->getContactName(),
    'organization_type' => $application->getOrganizationType()->toString(),
    'provisioned_by' => $this->provisionerId
]);
```

But `TenantProvisioningService::createTenantEntity()` expects:
```php
private function createTenantEntity(array $data): Tenant
{
    return new Tenant(
        id: $tenantId,
        name: $data['name'],           // ← Expects 'name' not 'organization_name'
        email: EmailAddress::fromString($data['admin_email']), // ← Good!
        slug: TenantSlug::fromString($data['slug']),
        // ...
    );
}
```

And `TenantProvisioningService::validateProvisioningReadiness()` expects:
```php
public function validateProvisioningReadiness(array $tenantData): array
{
    $requiredFields = ['name', 'slug', 'admin_email']; // ← 'name' not 'organization_name'
    // ...
}
```

## **THE FIX:**

The job is passing `organization_name` but the service expects `name`. This causes validation to fail!

**Here's what you need to do:**

### **Option 1: Fix the Job (Recommended)**
Update `ProvisionTenantJob.php`:
```php
$tenant = $provisioningService->provisionTenant([
    'name' => $application->getOrganizationName(), // ← Change 'organization_name' to 'name'
    'slug' => $application->getRequestedSlug(),
    'admin_email' => $application->getContactEmail()->toString(),
    // 'admin_name' => $application->getContactName(), // Remove or keep as metadata
    'organization_type' => $application->getOrganizationType()->toString(),
    'provisioned_by' => $this->provisionerId
]);
```

### **Option 2: Fix the Service**
Update `TenantProvisioningService.php`:
```php
private function createTenantEntity(array $data): Tenant
{
    // Map organization_name to name if needed
    $name = $data['name'] ?? $data['organization_name'] ?? '';
    
    return new Tenant(
        id: $tenantId,
        name: $name,  // Use the mapped name
        email: EmailAddress::fromString($data['admin_email']),
        // ...
    );
}
```

### **Option 3: Add Debug Logging to See What's Happening**
Add this to `TenantProvisioningService::provisionTenant()`:
```php
public function provisionTenant(array $tenantData): Tenant
{
    \Log::info('=== PROVISIONING DEBUG ===', [
        'received_data' => $tenantData,
        'has_name' => isset($tenantData['name']),
        'has_organization_name' => isset($tenantData['organization_name']),
        'has_admin_email' => isset($tenantData['admin_email']),
    ]);
    
    // ... rest of code
}
```

## **Please also run these database queries to check the current state:**

```sql
USE election;

-- Check tenants table structure
DESCRIBE tenants;

-- Check for tenant_uml record
SELECT * FROM tenants WHERE slug = 'uml';

-- Check logs for provisioning errors
-- Run this in Laravel:
-- php artisan tinker
-- \Log::channel('daily')->getHandlers()[0]->getUrl()
-- Then check that log file
```

## **QUICK DIAGNOSTIC:**
Run this command to see if the job is failing:
```bash
php artisan queue:failed
```

And check the logs:
```bash
tail -n 100 storage/logs/laravel.log | grep -i "provision\|validation\|failed"
```

## **IMMEDIATE ACTION:**
1. **Apply Option 1** - Fix the parameter name in `ProvisionTenantJob.php`
2. **Add debug logging** to see what's happening
3. **Check the failed jobs queue**
4. **Share the database query results** for `tenants` table structure

**The issue is that `ProvisionTenantJob` passes `organization_name` but `TenantProvisioningService` expects `name`. This causes validation to fail, which likely rolls back the transaction and prevents admin user creation!**