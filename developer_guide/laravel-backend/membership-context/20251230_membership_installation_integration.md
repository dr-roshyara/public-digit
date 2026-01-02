# Membership Installation Integration Guide

**Date**: 2025-12-30
**Context**: Integrating Membership with ModuleRegistry + Subscription + Platform Context
**Status**: Implementation Guide

---

## Overview

This guide shows how to integrate your existing Membership installation workflow with the new Platform Context infrastructure while maintaining:

✅ **Admin button UI** - Keep existing user experience
✅ **Subscription checks** - Verify tenant has access
✅ **ModuleRegistry tracking** - Record installations
✅ **Platform Context** - Standardized installation engine

---

## Architecture: Three-Layer Integration

```
┌──────────────────────────────────────────────────────────┐
│  ADMIN BUTTON (Inertia Vue Component)                   │
│  - "Install Membership" button                           │
│  - Shows if module available for tenant                  │
└──────────────────────────────────────────────────────────┘
                         ↓ POST request
┌──────────────────────────────────────────────────────────┐
│  CONTROLLER (TenantModuleController)                     │
│  1. Check Subscription: Has access to Membership?        │
│  2. Check ModuleRegistry: Already installed?             │
│  3. Dispatch Job: InstallMembershipModule::dispatch()    │
└──────────────────────────────────────────────────────────┘
                         ↓ Queue job
┌──────────────────────────────────────────────────────────┐
│  JOB (InstallMembershipModule - REFACTORED)              │
│  1. Call Platform Context Installer                      │
│  2. Update ModuleRegistry (tenant_modules table)         │
│  3. Update tenant metadata                               │
└──────────────────────────────────────────────────────────┘
                         ↓ Delegates to
┌──────────────────────────────────────────────────────────┐
│  PLATFORM CONTEXT (ContextInstaller)                     │
│  - Runs migrations from Tenant/ folder                   │
│  - Handles dependencies                                  │
│  - Tracks installation in ModuleRegistry                 │
└──────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Controller

Create `TenantModuleController.php` to handle admin button clicks:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Contexts\Membership\Application\Jobs\InstallMembershipModule;
use App\Contexts\ModuleRegistry\Application\Services\ModuleAccessService;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TenantModuleController extends Controller
{
    /**
     * Install Membership module for current tenant
     */
    public function installMembership(Request $request): RedirectResponse
    {
        $tenant = Tenant::current();

        if (!$tenant) {
            return back()->with('error', 'No tenant context found');
        }

        // Step 1: Check if module exists in catalog
        $module = DB::connection('landlord')
            ->table('modules')
            ->where('name', 'membership')
            ->first();

        if (!$module) {
            return back()->with('error', 'Membership module not found in catalog');
        }

        // Step 2: Check subscription access (if applicable)
        if ($module->requires_subscription) {
            $hasAccess = $this->checkSubscriptionAccess($tenant, 'membership');

            if (!$hasAccess) {
                return back()->with('error', 'Your subscription does not include the Membership module');
            }
        }

        // Step 3: Check if already installed
        $alreadyInstalled = DB::connection('landlord')
            ->table('tenant_modules')
            ->where('tenant_id', $tenant->numeric_id)
            ->where('module_id', $module->id)
            ->exists();

        if ($alreadyInstalled) {
            return back()->with('warning', 'Membership module is already installed');
        }

        // Step 4: Dispatch installation job
        InstallMembershipModule::dispatch($tenant);

        return back()->with('success', 'Membership module installation started. You will be notified when complete.');
    }

    /**
     * Check if tenant has subscription access to a module
     */
    protected function checkSubscriptionAccess(Tenant $tenant, string $moduleName): bool
    {
        // TODO: Implement based on your Subscription Context
        // Example:
        // return $tenant->subscription?->hasAccessTo($moduleName) ?? false;

        // For now, allow all (implement when Subscription Context is ready)
        return true;
    }
}
```

---

## Step 2: Refactor Installation Job

Update `InstallMembershipModule.php` to use Platform Context:

```php
<?php

namespace App\Contexts\Membership\Application\Jobs;

use App\Contexts\Platform\Application\Services\ContextInstaller;
use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Spatie\Multitenancy\Jobs\NotTenantAware;

/**
 * Install Membership Module for Tenant Job
 *
 * REFACTORED: Now delegates to Platform Context for standardized installation
 */
class InstallMembershipModule implements ShouldQueue, NotTenantAware
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 600;

    protected Tenant $tenant;

    public function __construct(Tenant $tenant)
    {
        $this->tenant = $tenant;
        $this->onQueue('tenant-provisioning');
    }

    /**
     * Execute the job using Platform Context installer
     */
    public function handle(ContextInstaller $installer): void
    {
        Log::info('Starting Membership module installation via Platform Context', [
            'tenant_id' => $this->tenant->id,
            'tenant_slug' => $this->tenant->slug,
        ]);

        try {
            // Delegate to Platform Context installer
            $result = $installer->install(
                contextName: 'Membership',
                tenantSlug: $this->tenant->slug
            );

            if ($result->isSuccessful()) {
                Log::info('Membership module installation completed successfully', [
                    'tenant_id' => $this->tenant->id,
                    'landlord_status' => $result->landlord['status'] ?? 'unknown',
                    'tenant_tables' => count($result->tenant ?? []),
                ]);

                // Update tenant metadata (optional - ModuleRegistry already tracks it)
                $this->updateTenantMetadata('installed');

            } else {
                $failures = implode('; ', $result->getFailures());
                throw new \RuntimeException("Installation failed: {$failures}");
            }

        } catch (\Exception $e) {
            Log::error('Membership module installation failed', [
                'tenant_id' => $this->tenant->id,
                'error' => $e->getMessage(),
            ]);

            $this->markInstallationFailed($e->getMessage());
            throw $e;
        }
    }

    /**
     * Update tenant metadata (backward compatibility)
     */
    protected function updateTenantMetadata(string $status): void
    {
        $metadata = $this->tenant->metadata ?? [];
        $metadata['modules'] = $metadata['modules'] ?? [];

        $metadata['modules']['membership'] = [
            'installed' => $status === 'installed',
            'installed_at' => now()->toIso8601String(),
            'version' => '1.0.0',
            'status' => $status,
            'installed_via' => 'platform_context',
        ];

        $this->tenant->update(['metadata' => $metadata]);
    }

    /**
     * Mark installation as failed
     */
    protected function markInstallationFailed(string $errorMessage): void
    {
        try {
            $metadata = $this->tenant->metadata ?? [];
            $metadata['modules'] = $metadata['modules'] ?? [];

            $metadata['modules']['membership'] = [
                'installed' => false,
                'last_install_attempt' => now()->toIso8601String(),
                'status' => 'failed',
                'error' => $errorMessage,
                'retry_count' => ($metadata['modules']['membership']['retry_count'] ?? 0) + 1,
            ];

            $this->tenant->update(['metadata' => $metadata]);

        } catch (\Exception $e) {
            Log::error('Failed to mark installation as failed', [
                'tenant_id' => $this->tenant->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Membership installation job failed after all retries', [
            'tenant_id' => $this->tenant->id,
            'exception' => $exception->getMessage(),
        ]);

        $this->markInstallationFailed(
            sprintf('Job failed after %d attempts: %s', $this->attempts(), $exception->getMessage())
        );
    }
}
```

---

## Step 3: Add Route

Add route for the install button:

```php
// routes/tenant.php (or wherever your tenant routes are)

use App\Http\Controllers\Admin\TenantModuleController;

Route::middleware(['auth:tenant', 'tenant'])->group(function () {
    // Membership module installation
    Route::post('/admin/modules/membership/install', [TenantModuleController::class, 'installMembership'])
        ->name('admin.modules.membership.install');
});
```

---

## Step 4: Update Admin UI (Inertia Vue Component)

Example admin panel component showing module installation:

```vue
<template>
  <div class="module-card">
    <h3>Membership Module</h3>
    <p>Manage members with 8-level geography integration</p>

    <div v-if="module.installed" class="installed-badge">
      ✓ Installed
    </div>

    <button
      v-else
      @click="installModule"
      :disabled="installing"
      class="install-button"
    >
      {{ installing ? 'Installing...' : 'Install Module' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { router } from '@inertiajs/vue3';

const props = defineProps({
  module: Object,
  requiresSubscription: Boolean,
  hasAccess: Boolean,
});

const installing = ref(false);

const installModule = () => {
  if (!props.hasAccess && props.requiresSubscription) {
    alert('Please upgrade your subscription to access this module');
    return;
  }

  if (confirm('Install Membership module? This will add member management to your tenant.')) {
    installing.value = true;

    router.post('/admin/modules/membership/install', {}, {
      onSuccess: () => {
        // Installation started
      },
      onError: (errors) => {
        alert(errors.message || 'Installation failed');
      },
      onFinish: () => {
        installing.value = false;
      }
    });
  }
};
</script>
```

---

## Step 5: Bootstrap Membership in Catalog

Run the bootstrap seeder:

```bash
php artisan db:seed --class=MembershipBootstrapSeeder
```

This registers Membership in ModuleRegistry so Platform Context can discover it.

---

## Benefits of This Approach

### 1. **Subscription Integration** ✅
- Check if tenant has paid for module
- Gate installation behind subscription check
- Upgrade prompts for unpaid modules

### 2. **ModuleRegistry Tracking** ✅
- `tenant_modules` table tracks installations
- Version management
- Installation history
- Dependency tracking

### 3. **Platform Context Benefits** ✅
- Standardized migration execution
- Automatic dependency resolution
- Rollback support
- Installation verification

### 4. **User Experience** ✅
- Keep familiar admin button UI
- Clear feedback (installing vs installed)
- Background job processing
- Notification when complete

---

## Migration Path

### Existing Installations (Already Deployed)

For tenants that already have Membership installed via old method:

```php
// One-time migration script
php artisan tinker

use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

Tenant::whereNotNull('metadata->modules->membership->installed')->each(function ($tenant) {
    // Find membership module
    $module = DB::connection('landlord')
        ->table('modules')
        ->where('name', 'membership')
        ->first();

    if (!$module) {
        echo "Warning: Membership module not in catalog\n";
        return;
    }

    // Record in tenant_modules (ModuleRegistry tracking)
    DB::connection('landlord')->table('tenant_modules')->insert([
        'id' => \Str::uuid(),
        'tenant_id' => $tenant->numeric_id,
        'module_id' => $module->id,
        'installed_version' => '1.0.0',
        'status' => 'installed',
        'installed_at' => $tenant->metadata['modules']['membership']['installed_at'] ?? now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    echo "Migrated: {$tenant->slug}\n";
});
```

---

## Testing Checklist

- [ ] Run Membership bootstrap seeder
- [ ] Verify module appears in ModuleRegistry catalog
- [ ] Test subscription check (if applicable)
- [ ] Click "Install Membership" button in admin panel
- [ ] Verify job dispatched to queue
- [ ] Check tenant database for Membership tables (members, tenant_geo_candidates)
- [ ] Verify `tenant_modules` record created in landlord DB
- [ ] Test "already installed" check
- [ ] Test installation failure handling

---

## Summary

**Before:**
```
Admin Button → Custom Job → Direct Database Seeding
```

**After:**
```
Admin Button → Controller (checks subscription)
  → Job → Platform Context Installer
  → ModuleRegistry Tracking
```

**Benefits:**
- ✅ Subscription integration ready
- ✅ ModuleRegistry tracking automatic
- ✅ Standardized installation process
- ✅ Better error handling and rollback
- ✅ Admin UI stays the same (no breaking changes)

