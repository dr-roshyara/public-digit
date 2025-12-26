# 🔄 **CONTROLLED SYNC ARCHITECTURE IMPLEMENTATION PLAN**

Perfect! You want **controlled synchronization** where:
1. ✅ **Automatic sync** to a **staging/temp table**
2. ✅ **Manual approval** required for production sync
3. ✅ **Review changes** before applying to production
4. ✅ **Rollback capability** if issues are detected

Here's the revised architecture:

---

## 🏗️ **ARCHITECTURE OVERVIEW**

```
┌─────────────────────────────────────────────────────────┐
│ LANDLORD DB (Source of Truth)                          │
│ • Canonical Geography (Official 1-4)                   │
│ • Change tracking table                                │
└──────────────┬──────────────────────────────────────────┘
               │ Daily Auto-Sync (Staging Only)
               ▼
┌─────────────────────────────────────────────────────────┐
│ TENANT STAGING TABLE (Auto-synced)                     │
│ • tenant_geo_units_staging                             │
│ • Contains all changes from landlord                   │
│ • Mirrors landlord exactly                             │
└──────────────┬──────────────────────────────────────────┘
               │ Manual Approval Required
               ▼
┌─────────────────────────────────────────────────────────┐
│ TENANT PRODUCTION TABLE (Controlled)                   │
│ • tenant_geo_units (Current "Pragmatic Graft")         │
│ • Only updated after manual approval                   │
│ • Custom units (Levels 5-8) preserved                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 **PHASE 1: STAGING TABLE ARCHITECTURE (Days 1-3)**

### **Step 1.1: Create Staging Table Schema**
```php
// database/migrations/tenant/2025_01_15_000001_create_tenant_geo_units_staging.php
Schema::create('tenant_geo_units_staging', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('type')->nullable();
    $table->integer('level'); // 1-4 (official only in staging)
    $table->foreignId('parent_id')->nullable()->constrained('tenant_geo_units_staging');
    $table->ltree('geo_path')->index();
    
    // Bridge to Landlord
    $table->unsignedBigInteger('external_geo_id')->unique()->index();
    $table->boolean('is_active')->default(true);
    
    // Sync metadata
    $table->timestamp('synced_at')->nullable();
    $table->string('sync_batch_id')->nullable()->index(); // For batch approval
    
    $table->timestamps();
    
    // Staging-only columns
    $table->enum('sync_action', ['CREATE', 'UPDATE', 'DELETE'])->default('UPDATE');
    $table->jsonb('change_details')->nullable(); // What changed
    $table->enum('sync_status', ['PENDING', 'APPROVED', 'REJECTED', 'APPLIED'])->default('PENDING');
    
    // Indexes for querying pending changes
    $table->index(['sync_status', 'level']);
    $table->index(['external_geo_id', 'sync_status']);
});
```

### **Step 1.2: Update Production Table for Controlled Sync**
```php
// Add these columns to your existing tenant_geo_units table
Schema::table('tenant_geo_units', function (Blueprint $table) {
    // Track last sync batch
    $table->string('last_applied_batch_id')->nullable()->index();
    $table->timestamp('last_applied_at')->nullable();
    
    // Sync approval metadata
    $table->foreignId('approved_by')->nullable()->constrained('users');
    $table->timestamp('approved_at')->nullable();
    
    // For rollback tracking
    $table->jsonb('sync_history')->nullable(); // JSON array of previous states
    
    // Index for efficient sync queries
    $table->index(['external_geo_id', 'is_official']);
});
```

### **Step 1.3: Sync Batch Management Table**
```php
// database/migrations/2025_01_15_000002_create_sync_batches_table.php
Schema::create('sync_batches', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignId('tenant_id')->constrained();
    
    // Batch metadata
    $table->string('name'); // e.g., "January 2024 Boundary Updates"
    $table->text('description')->nullable();
    $table->jsonb('change_summary'); // Stats: {created: 5, updated: 10, deleted: 2}
    
    // Status tracking
    $table->enum('status', [
        'CREATED',        // Batch created
        'STAGED',         // Changes loaded to staging
        'UNDER_REVIEW',   // Awaiting approval
        'APPROVED',       // Approved for application
        'APPLIED',        // Applied to production
        'REJECTED',       // Rejected
        'ROLLED_BACK'     // Rolled back after application
    ])->default('CREATED');
    
    // Approval workflow
    $table->foreignId('created_by')->constrained('users');
    $table->foreignId('approved_by')->nullable()->constrained('users');
    $table->timestamp('approved_at')->nullable();
    
    // Application tracking
    $table->timestamp('applied_at')->nullable();
    $table->integer('changes_applied')->default(0);
    $table->integer('changes_failed')->default(0);
    
    // Rollback capability
    $table->boolean('can_rollback')->default(false);
    $table->uuid('rolls_back_to')->nullable(); // Previous batch ID
    
    $table->timestamps();
    $table->softDeletes();
    
    $table->index(['tenant_id', 'status']);
    $table->index(['created_at', 'status']);
});
```

---

## 🔄 **PHASE 2: AUTOMATED STAGING SYNC (Days 4-6)**

### **Step 2.1: Auto-Sync Service (Staging Only)**
```php
// app/Contexts/Sync/Application/Services/AutoStagingSyncService.php
class AutoStagingSyncService
{
    public function syncToStaging(Tenant $tenant, ?string $batchId = null): SyncBatch
    {
        // 1. Create or get sync batch
        $batch = $batchId 
            ? SyncBatch::find($batchId)
            : $this->createSyncBatch($tenant, 'Auto-sync from landlord');
        
        // 2. Get changes from landlord (last 24 hours)
        $changes = $this->getLandlordChangesSince($tenant->last_staging_sync);
        
        if ($changes->isEmpty()) {
            $batch->markAsStaged([]);
            return $batch;
        }
        
        // 3. Apply changes to STAGING table only
        DB::connection($tenant->getDatabaseConnectionName())->transaction(function () use ($tenant, $changes, $batch) {
            foreach ($changes as $change) {
                $this->applyChangeToStaging($tenant, $change, $batch);
            }
            
            // Update tenant's last staging sync time
            $tenant->update(['last_staging_sync' => now()]);
        });
        
        // 4. Generate change summary
        $summary = $this->generateChangeSummary($changes);
        $batch->markAsStaged($summary);
        
        return $batch;
    }
    
    private function applyChangeToStaging(Tenant $tenant, array $change, SyncBatch $batch): void
    {
        switch ($change['type']) {
            case 'CREATE':
                DB::connection($tenant->getDatabaseConnectionName())
                    ->table('tenant_geo_units_staging')
                    ->insert([
                        'name' => $change['name'],
                        'level' => $change['level'],
                        'geo_path' => $change['path'],
                        'external_geo_id' => $change['id'],
                        'parent_id' => $this->resolveStagingParentId($tenant, $change['parent_id']),
                        'sync_action' => 'CREATE',
                        'sync_status' => 'PENDING',
                        'sync_batch_id' => $batch->id,
                        'change_details' => json_encode(['new' => $change]),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                break;
                
            case 'UPDATE':
                DB::connection($tenant->getDatabaseConnectionName())
                    ->table('tenant_geo_units_staging')
                    ->where('external_geo_id', $change['id'])
                    ->update([
                        'name' => $change['name'],
                        'geo_path' => $change['path'],
                        'parent_id' => $this->resolveStagingParentId($tenant, $change['parent_id']),
                        'sync_action' => 'UPDATE',
                        'sync_status' => 'PENDING',
                        'sync_batch_id' => $batch->id,
                        'change_details' => json_encode([
                            'old' => $this->getStagingCurrentState($tenant, $change['id']),
                            'new' => $change
                        ]),
                        'updated_at' => now(),
                    ]);
                break;
                
            case 'DELETE':
                DB::connection($tenant->getDatabaseConnectionName())
                    ->table('tenant_geo_units_staging')
                    ->where('external_geo_id', $change['id'])
                    ->update([
                        'is_active' => false,
                        'sync_action' => 'DELETE',
                        'sync_status' => 'PENDING',
                        'sync_batch_id' => $batch->id,
                        'change_details' => json_encode([
                            'old' => $this->getStagingCurrentState($tenant, $change['id'])
                        ]),
                        'updated_at' => now(),
                    ]);
                break;
        }
    }
}
```

### **Step 2.2: Scheduled Staging Sync Command**
```php
// app/Console/Commands/SyncGeographyToStaging.php
class SyncGeographyToStaging extends Command
{
    protected $signature = 'geography:sync-staging 
                            {--tenant= : Sync specific tenant}
                            {--all : Sync all tenants}
                            {--force : Force sync even if no changes}';
    
    public function handle()
    {
        if ($this->option('tenant')) {
            $tenants = Tenant::where('id', $this->option('tenant'))->get();
        } elseif ($this->option('all')) {
            $tenants = Tenant::where('geography_sync_enabled', true)->get();
        } else {
            // Default: tenants with staging sync enabled
            $tenants = Tenant::where('staging_sync_enabled', true)->get();
        }
        
        foreach ($tenants as $tenant) {
            $this->info("Syncing staging for tenant: {$tenant->name}");
            
            $batch = $this->autoSyncService->syncToStaging($tenant);
            
            if ($batch->change_summary['total'] > 0) {
                $this->info("  ↳ Staged {$batch->change_summary['total']} changes (Batch: {$batch->id})");
                
                // Notify admins that changes are ready for review
                $this->notifyAdmins($tenant, $batch);
            } else {
                $this->info("  ↳ No changes to sync");
            }
        }
    }
    
    private function notifyAdmins(Tenant $tenant, SyncBatch $batch): void
    {
        Notification::send(
            User::where('can_approve_geography_sync', true)->get(),
            new GeographyChangesReadyForReview($tenant, $batch)
        );
    }
}
```

### **Step 2.3: Schedule Automatic Staging Sync**
```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    // Daily staging sync at 2 AM (low traffic)
    $schedule->command('geography:sync-staging --all')
        ->dailyAt('02:00')
        ->runInBackground()
        ->appendOutputTo(storage_path('logs/geography-staging-sync.log'));
    
    // Optional: More frequent for active tenants
    $schedule->command('geography:sync-staging --tenant=active')
        ->hourly()
        ->runInBackground()
        ->when(fn() => $this->shouldSyncActiveTenants());
}
```

---

## 👁️ **PHASE 3: REVIEW & APPROVAL INTERFACE (Days 7-10)**

### **Step 3.1: Review Dashboard Controller**
```php
// app/Http/Controllers/Tenant/GeographySyncController.php
class GeographySyncController extends Controller
{
    public function reviewDashboard(Tenant $tenant)
    {
        // Get pending changes from staging
        $pendingChanges = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units_staging')
            ->where('sync_status', 'PENDING')
            ->orderBy('level')
            ->orderBy('external_geo_id')
            ->paginate(50);
        
        // Group by batch for batch approval
        $pendingBatches = SyncBatch::where('tenant_id', $tenant->id)
            ->where('status', 'STAGED')
            ->withCount(['stagingChanges as pending_changes_count'])
            ->orderBy('created_at', 'desc')
            ->get();
        
        // Preview of what will change
        $changePreview = $this->generateChangePreview($tenant);
        
        return view('tenant.geography-sync.review', [
            'tenant' => $tenant,
            'pendingChanges' => $pendingChanges,
            'pendingBatches' => $pendingBatches,
            'changePreview' => $changePreview,
            'productionStats' => $this->getProductionStats($tenant),
        ]);
    }
    
    public function changeDetail(Tenant $tenant, int $externalGeoId)
    {
        $stagingRecord = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units_staging')
            ->where('external_geo_id', $externalGeoId)
            ->where('sync_status', 'PENDING')
            ->first();
        
        $productionRecord = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->where('external_geo_id', $externalGeoId)
            ->where('is_official', true)
            ->first();
        
        // Check for impact analysis
        $impact = $this->analyzeImpact($tenant, $externalGeoId);
        
        return view('tenant.geography-sync.change-detail', [
            'staging' => $stagingRecord,
            'production' => $productionRecord,
            'impact' => $impact,
            'tenant' => $tenant,
        ]);
    }
    
    private function analyzeImpact(Tenant $tenant, int $externalGeoId): array
    {
        return [
            'affected_members' => DB::connection($tenant->getDatabaseConnectionName())
                ->table('members')
                ->where(function ($query) use ($externalGeoId) {
                    for ($i = 1; $i <= 8; $i++) {
                        $query->orWhere("admin_unit_level{$i}_id", $externalGeoId);
                    }
                })
                ->count(),
            
            'custom_units_attached' => DB::connection($tenant->getDatabaseConnectionName())
                ->table('tenant_geo_units')
                ->where('is_custom', true)
                ->where('parent_id', function ($query) use ($tenant, $externalGeoId) {
                    $query->select('id')
                        ->from('tenant_geo_units')
                        ->where('external_geo_id', $externalGeoId)
                        ->where('is_official', true);
                })
                ->count(),
            
            'hierarchy_children' => DB::connection($tenant->getDatabaseConnectionName())
                ->table('tenant_geo_units')
                ->where('geo_path', '~', $this->getPathPattern($externalGeoId))
                ->count(),
        ];
    }
}
```

### **Step 3.2: Approval Workflow Service**
```php
// app/Contexts/Sync/Application/Services/SyncApprovalService.php
class SyncApprovalService
{
    public function approveChanges(Tenant $tenant, array $changeIds, User $approver): SyncBatch
    {
        return DB::transaction(function () use ($tenant, $changeIds, $approver) {
            // 1. Create approval batch
            $batch = SyncBatch::create([
                'tenant_id' => $tenant->id,
                'name' => "Approval Batch - " . now()->format('Y-m-d H:i'),
                'description' => "Manually approved by {$approver->name}",
                'status' => 'UNDER_REVIEW',
                'created_by' => $approver->id,
            ]);
            
            // 2. Mark staging records as APPROVED
            DB::connection($tenant->getDatabaseConnectionName())
                ->table('tenant_geo_units_staging')
                ->whereIn('id', $changeIds)
                ->update([
                    'sync_status' => 'APPROVED',
                    'sync_batch_id' => $batch->id,
                    'updated_at' => now(),
                ]);
            
            // 3. Update batch with change summary
            $summary = $this->generateApprovalSummary($tenant, $changeIds);
            $batch->update([
                'change_summary' => $summary,
                'status' => 'APPROVED',
                'approved_by' => $approver->id,
                'approved_at' => now(),
            ]);
            
            // 4. Log approval
            event(new GeographyChangesApproved($tenant, $batch, $approver));
            
            return $batch;
        });
    }
    
    public function rejectChanges(Tenant $tenant, array $changeIds, User $rejecter, string $reason): void
    {
        DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units_staging')
            ->whereIn('id', $changeIds)
            ->update([
                'sync_status' => 'REJECTED',
                'change_details' => DB::raw("COALESCE(change_details, '{}') || '{\"rejection\": {\"by\": " . $rejecter->id . ", \"reason\": \"" . $reason . "\", \"at\": \"" . now() . "\"}}'::jsonb"),
                'updated_at' => now(),
            ]);
        
        event(new GeographyChangesRejected($tenant, $changeIds, $rejecter, $reason));
    }
    
    public function applyApprovedChanges(Tenant $tenant, string $batchId, User $applier): SyncBatch
    {
        $batch = SyncBatch::findOrFail($batchId);
        
        if ($batch->status !== 'APPROVED') {
            throw new InvalidBatchStateException("Batch must be APPROVED before application");
        }
        
        return DB::transaction(function () use ($tenant, $batch, $applier) {
            // 1. Apply each approved change to production
            $approvedChanges = DB::connection($tenant->getDatabaseConnectionName())
                ->table('tenant_geo_units_staging')
                ->where('sync_status', 'APPROVED')
                ->where('sync_batch_id', $batch->id)
                ->get();
            
            $applied = 0;
            $failed = 0;
            
            foreach ($approvedChanges as $change) {
                try {
                    $this->applyToProduction($tenant, $change);
                    $applied++;
                } catch (\Exception $e) {
                    $failed++;
                    $this->logFailure($batch, $change, $e);
                }
            }
            
            // 2. Update batch status
            $batch->update([
                'status' => 'APPLIED',
                'applied_at' => now(),
                'changes_applied' => $applied,
                'changes_failed' => $failed,
                'can_rollback' => true, // Enable rollback since applied
            ]);
            
            // 3. Update staging records
            DB::connection($tenant->getDatabaseConnectionName())
                ->table('tenant_geo_units_staging')
                ->where('sync_status', 'APPROVED')
                ->where('sync_batch_id', $batch->id)
                ->update(['sync_status' => 'APPLIED']);
            
            // 4. Log application
            event(new GeographyChangesApplied($tenant, $batch, $applier, $applied, $failed));
            
            return $batch;
        });
    }
    
    private function applyToProduction(Tenant $tenant, $change): void
    {
        // Backup current state for rollback
        $this->backupCurrentState($tenant, $change->external_geo_id);
        
        switch ($change->sync_action) {
            case 'CREATE':
                // Insert into production
                DB::connection($tenant->getDatabaseConnectionName())
                    ->table('tenant_geo_units')
                    ->insert([
                        'name' => $change->name,
                        'level' => $change->level,
                        'geo_path' => $change->geo_path,
                        'external_geo_id' => $change->external_geo_id,
                        'parent_id' => $this->resolveProductionParentId($tenant, $change->parent_id),
                        'is_official' => true,
                        'is_custom' => false,
                        'last_applied_batch_id' => $change->sync_batch_id,
                        'last_applied_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                break;
                
            case 'UPDATE':
                // Update existing production record
                DB::connection($tenant->getDatabaseConnectionName())
                    ->table('tenant_geo_units')
                    ->where('external_geo_id', $change->external_geo_id)
                    ->where('is_official', true)
                    ->update([
                        'name' => $change->name,
                        'geo_path' => $change->geo_path,
                        'parent_id' => $this->resolveProductionParentId($tenant, $change->parent_id),
                        'last_applied_batch_id' => $change->sync_batch_id,
                        'last_applied_at' => now(),
                        'updated_at' => now(),
                    ]);
                break;
                
            case 'DELETE':
                // Soft delete in production
                DB::connection($tenant->getDatabaseConnectionName())
                    ->table('tenant_geo_units')
                    ->where('external_geo_id', $change->external_geo_id)
                    ->where('is_official', true)
                    ->update([
                        'is_active' => false,
                        'last_applied_batch_id' => $change->sync_batch_id,
                        'last_applied_at' => now(),
                        'updated_at' => now(),
                    ]);
                break;
        }
    }
}
```

---

## 🔙 **PHASE 4: ROLLBACK CAPABILITY (Days 11-13)**

### **Step 4.1: Rollback Table for Backup**
```php
// database/migrations/tenant/2025_01_15_000003_create_geo_unit_backups_table.php
Schema::create('geo_unit_backups', function (Blueprint $table) {
    $table->id();
    $table->foreignId('geo_unit_id')->constrained('tenant_geo_units');
    $table->uuid('batch_id')->index(); // Which sync batch caused this backup
    $table->string('backup_reason'); // 'PRE_UPDATE', 'PRE_DELETE', 'MANUAL'
    
    // Full backup of the record
    $table->jsonb('backup_data'); // Complete row data
    $table->jsonb('relationships')->nullable(); // Related custom units, members
    
    // Rollback metadata
    $table->boolean('is_rolled_back')->default(false);
    $table->timestamp('rolled_back_at')->nullable();
    $table->foreignId('rolled_back_by')->nullable()->constrained('users');
    
    $table->timestamps();
    
    $table->index(['batch_id', 'is_rolled_back']);
    $table->index(['geo_unit_id', 'created_at']);
});
```

### **Step 4.2: Rollback Service**
```php
// app/Contexts/Sync/Application/Services/RollbackService.php
class RollbackService
{
    public function rollbackBatch(Tenant $tenant, string $batchId, User $roller): void
    {
        $batch = SyncBatch::findOrFail($batchId);
        
        if (!$batch->can_rollback) {
            throw new CannotRollbackException("This batch cannot be rolled back");
        }
        
        DB::transaction(function () use ($tenant, $batch, $roller) {
            // 1. Get all backups for this batch
            $backups = DB::connection($tenant->getDatabaseConnectionName())
                ->table('geo_unit_backups')
                ->where('batch_id', $batchId)
                ->where('is_rolled_back', false)
                ->get();
            
            // 2. Restore each backup
            foreach ($backups as $backup) {
                $this->restoreBackup($tenant, $backup);
            }
            
            // 3. Update batch status
            $batch->update([
                'status' => 'ROLLED_BACK',
                'can_rollback' => false,
            ]);
            
            // 4. Mark backups as rolled back
            DB::connection($tenant->getDatabaseConnectionName())
                ->table('geo_unit_backups')
                ->where('batch_id', $batchId)
                ->update([
                    'is_rolled_back' => true,
                    'rolled_back_at' => now(),
                    'rolled_back_by' => $roller->id,
                ]);
            
            // 5. Log rollback
            event(new GeographySyncRolledBack($tenant, $batch, $roller, $backups->count()));
        });
    }
    
    private function restoreBackup(Tenant $tenant, $backup): void
    {
        $data = json_decode($backup->backup_data, true);
        
        // Check if record still exists
        $exists = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->where('id', $backup->geo_unit_id)
            ->exists();
        
        if ($exists) {
            // Update existing
            DB::connection($tenant->getDatabaseConnectionName())
                ->table('tenant_geo_units')
                ->where('id', $backup->geo_unit_id)
                ->update($data);
        } else {
            // Re-create deleted record
            $data['id'] = $backup->geo_unit_id; // Preserve original ID
            DB::connection($tenant->getDatabaseConnectionName())
                ->table('tenant_geo_units')
                ->insert($data);
        }
    }
    
    public function previewRollback(Tenant $tenant, string $batchId): array
    {
        $backups = DB::connection($tenant->getDatabaseConnectionName())
            ->table('geo_unit_backups')
            ->where('batch_id', $batchId)
            ->where('is_rolled_back', false)
            ->get();
        
        return [
            'affected_records' => $backups->count(),
            'changes' => $backups->map(function ($backup) use ($tenant) {
                return [
                    'geo_unit_id' => $backup->geo_unit_id,
                    'current_state' => $this->getCurrentState($tenant, $backup->geo_unit_id),
                    'backup_state' => json_decode($backup->backup_data, true),
                    'impact' => $this->analyzeRollbackImpact($tenant, $backup),
                ];
            }),
            'batch' => SyncBatch::find($batchId),
        ];
    }
}
```

---

## 🌐 **PHASE 5: ADMIN INTERFACE (Days 14-17)**

### **Step 5.1: Vue.js Sync Management Dashboard**
```vue
<!-- resources/js/Components/Tenant/GeographySyncDashboard.vue -->
<template>
  <div class="sync-dashboard">
    <!-- Sync Status Overview -->
    <div class="sync-status-cards">
      <div class="card" :class="`status-${overallStatus}`">
        <h3>Sync Status</h3>
        <div class="stats">
          <div class="stat">
            <span class="label">Pending Changes</span>
            <span class="value">{{ pendingCount }}</span>
          </div>
          <div class="stat">
            <span class="label">Last Staging Sync</span>
            <span class="value">{{ formatDate(lastStagingSync) }}</span>
          </div>
          <div class="stat">
            <span class="label">Last Production Sync</span>
            <span class="value">{{ formatDate(lastProductionSync) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="action-buttons">
      <button @click="syncStaging" :disabled="isSyncingStaging" class="btn btn-primary">
        {{ isSyncingStaging ? 'Syncing...' : 'Sync to Staging' }}
      </button>
      <button @click="showReviewModal = true" :disabled="pendingCount === 0" class="btn btn-secondary">
        Review Changes ({{ pendingCount }})
      </button>
      <button @click="showBatchModal = true" class="btn btn-outline">
        View Sync History
      </button>
    </div>
    
    <!-- Change Preview Table -->
    <div v-if="pendingChanges.length > 0" class="preview-table">
      <h4>Pending Changes Preview</h4>
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" v-model="selectAll" @change="toggleAll"></th>
            <th>Action</th>
            <th>Name</th>
            <th>Level</th>
            <th>Changes</th>
            <th>Impact</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="change in pendingChanges" :key="change.id">
            <td><input type="checkbox" v-model="selectedChanges" :value="change.id"></td>
            <td><span :class="`badge badge-${change.sync_action.toLowerCase()}`">{{ change.sync_action }}</span></td>
            <td>{{ change.name }}</td>
            <td>Level {{ change.level }}</td>
            <td><button @click="viewChangeDetails(change)" class="btn btn-sm btn-link">View Details</button></td>
            <td><button @click="viewImpact(change)" class="btn btn-sm btn-warning">Analyze Impact</button></td>
            <td>
              <button @click="approveChange(change.id)" class="btn btn-sm btn-success">Approve</button>
              <button @click="rejectChange(change.id)" class="btn btn-sm btn-danger">Reject</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Modals -->
    <ReviewModal v-if="showReviewModal" @close="showReviewModal = false" :changes="selectedChanges" />
    <BatchModal v-if="showBatchModal" @close="showBatchModal = false" :tenantId="tenantId" />
    <ImpactModal v-if="showImpactModal" @close="showImpactModal = false" :change="selectedChange" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps(['tenantId'])

const pendingChanges = ref([])
const selectedChanges = ref([])
const isSyncingStaging = ref(false)
const showReviewModal = ref(false)
const showBatchModal = ref(false)
const showImpactModal = ref(false)
const selectedChange = ref(null)

const pendingCount = computed(() => pendingChanges.value.length)
const selectAll = computed({
  get: () => selectedChanges.value.length === pendingChanges.value.length,
  set: (value) => {
    selectedChanges.value = value ? pendingChanges.value.map(c => c.id) : []
  }
})

const fetchPendingChanges = async () => {
  const response = await axios.get(`/api/tenants/${props.tenantId}/geography-sync/pending`)
  pendingChanges.value = response.data
}

const syncStaging = async () => {
  isSyncingStaging.value = true
  try {
    await axios.post(`/api/tenants/${props.tenantId}/geography-sync/staging`)
    await fetchPendingChanges()
  } finally {
    isSyncingStaging.value = false
  }
}

const approveChange = async (changeId) => {
  await axios.post(`/api/tenants/${props.tenantId}/geography-sync/approve`, {
    change_ids: [changeId]
  })
  await fetchPendingChanges()
}

const viewImpact = async (change) => {
  selectedChange.value = change
  showImpactModal.value = true
}

onMounted(fetchPendingChanges)
</script>
```

### **Step 5.2: API Routes for Sync Management**
```php
// routes/api.php
Route::prefix('tenants/{tenant}/geography-sync')->group(function () {
    // Staging operations
    Route::post('/staging', [GeographySyncController::class, 'syncToStaging']);
    Route::get('/staging-status', [GeographySyncController::class, 'getStagingStatus']);
    Route::get('/pending', [GeographySyncController::class, 'getPendingChanges']);
    
    // Review and approval
    Route::get('/change/{externalId}', [GeographySyncController::class, 'getChangeDetail']);
    Route::post('/approve', [GeographySyncController::class, 'approveChanges']);
    Route::post('/reject', [GeographySyncController::class, 'rejectChanges']);
    Route::post('/apply-batch/{batch}', [GeographySyncController::class, 'applyBatch']);
    
    // Rollback
    Route::get('/rollback-preview/{batch}', [GeographySyncController::class, 'previewRollback']);
    Route::post('/rollback/{batch}', [GeographySyncController::class, 'rollbackBatch']);
    
    // History and reporting
    Route::get('/history', [GeographySyncController::class, 'getSyncHistory']);
    Route::get('/batch/{batch}', [GeographySyncController::class, 'getBatchDetail']);
    Route::get('/impact/{externalId}', [GeographySyncController::class, 'getImpactAnalysis']);
});
```

---

## 🔧 **PHASE 6: INTEGRATION WITH EXISTING DDD (Days 18-20)**

### **Step 6.1: Update MemberGeographyValidator for Dual Mode**
```php
// app/Contexts/Membership/Application/Services/MemberGeographyValidator.php
class MemberGeographyValidator
{
    public function validate(array $geoIds, string $tenantConnection): GeoPath
    {
        // Check if we should use staging or production
        $useStaging = $this->shouldUseStaging($tenantConnection);
        
        if ($useStaging && $this->hasPendingChanges($tenantConnection, $geoIds)) {
            throw new GeographyInTransitionException(
                "Geographic units are being updated. Please try again later or contact administrator."
            );
        }
        
        // Determine which table to query
        $table = $useStaging ? 'tenant_geo_units_staging' : 'tenant_geo_units';
        
        $units = DB::connection($tenantConnection)
            ->table($table)
            ->whereIn('id', $geoIds)
            ->where('is_active', true)
            ->get();
        
        if ($units->count() !== count($geoIds)) {
            throw new InvalidHierarchyException(
                "One or more geographic units are missing in your party's database."
            );
        }
        
        return GeoPath::fromIds($geoIds);
    }
    
    private function shouldUseStaging(string $connection): bool
    {
        // Check tenant configuration
        $tenant = $this->getTenantFromConnection($connection);
        
        // Use staging only if:
        // 1. Tenant has staging enabled
        // 2. There are no pending changes that affect validation
        // 3. Staging is considered "stable"
        return $tenant->use_staging_for_validation && 
               !$this->hasUnstableStagingChanges($connection);
    }
}
```

### **Step 6.2: Update GeographyAntiCorruptionLayer**
```php
// app/Contexts/Geography/Application/Services/GeographyAntiCorruptionLayer.php
class GeographyAntiCorruptionLayer implements GeographyService
{
    public function getGeoUnit(int $externalId, string $tenantConnection): ?array
    {
        // Try production first
        $production = DB::connection($tenantConnection)
            ->table('tenant_geo_units')
            ->where('external_geo_id', $externalId)
            ->where('is_official', true)
            ->where('is_active', true)
            ->first();
        
        if ($production) {
            return $this->formatGeoUnit($production);
        }
        
        // If not in production, check staging
        $staging = DB::connection($tenantConnection)
            ->table('tenant_geo_units_staging')
            ->where('external_geo_id', $externalId)
            ->where('is_active', true)
            ->where('sync_status', '!=', 'REJECTED')
            ->first();
        
        if ($staging) {
            // Add warning that this is from staging
            $formatted = $this->formatGeoUnit($staging);
            $formatted['source'] = 'staging';
            $formatted['sync_status'] = $staging->sync_status;
            return $formatted;
        }
        
        // Fallback to landlord (should be rare with proper sync)
        return $this->getFromLandlord($externalId);
    }
}
```

---

## 🧪 **PHASE 7: TESTING STRATEGY (Days 21-23)**

### **Step 7.1: Test Data Factory**
```php
// tests/Factories/SyncBatchFactory.php
class SyncBatchFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'tenant_id' => Tenant::factory(),
            'name' => $this->faker->sentence,
            'description' => $this->faker->paragraph,
            'change_summary' => [
                'created' => $this->faker->numberBetween(0, 5),
                'updated' => $this->faker->numberBetween(0, 10),
                'deleted' => $this->faker->numberBetween(0, 2),
                'total' => $this->faker->numberBetween(1, 17),
            ],
            'status' => $this->faker->randomElement(['CREATED', 'STAGED', 'UNDER_REVIEW', 'APPROVED']),
            'created_by' => User::factory(),
            'approved_by' => $this->faker->boolean(70) ? User::factory() : null,
            'approved_at' => $this->faker->optional()->dateTime(),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
    
    public function withStagingChanges($count = 5): self
    {
        return $this->afterCreating(function (SyncBatch $batch) use ($count) {
            $tenant = $batch->tenant;
            
            for ($i = 0; $i < $count; $i++) {
                DB::connection($tenant->getDatabaseConnectionName())
                    ->table('tenant_geo_units_staging')
                    ->insert([
                        'name' => $this->faker->city,
                        'level' => $this->faker->numberBetween(1, 4),
                        'external_geo_id' => $this->faker->unique()->numberBetween(1000, 9999),
                        'sync_action' => $this->faker->randomElement(['CREATE', 'UPDATE', 'DELETE']),
                        'sync_status' => 'PENDING',
                        'sync_batch_id' => $batch->id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
            }
        });
    }
}
```

### **Step 7.2: Comprehensive Test Suite**
```php
// tests/Feature/Tenant/ControlledGeographySyncTest.php
class ControlledGeographySyncTest extends TestCase
{
    use RefreshDatabase;
    
    /** @test */
    public function it_syncs_changes_to_staging_only()
    {
        $tenant = Tenant::factory()->create();
        
        // Mock landlord changes
        $this->mockLandlordChanges(5);
        
        // Trigger staging sync
        $response = $this->actingAs($this->adminUser())
            ->postJson("/api/tenants/{$tenant->id}/geography-sync/staging");
        
        $response->assertOk();
        
        // Assert changes in staging table
        $stagingCount = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units_staging')
            ->where('sync_status', 'PENDING')
            ->count();
        
        $this->assertEquals(5, $stagingCount);
        
        // Assert NO changes in production table
        $productionCount = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->where('is_official', true)
            ->count();
        
        $this->assertEquals(0, $productionCount, 'Production table should not be modified by staging sync');
    }
    
    /** @test */
    public function it_requires_approval_before_applying_to_production()
    {
        $tenant = Tenant::factory()->create();
        $batch = SyncBatch::factory()->for($tenant)->withStagingChanges(3)->create();
        
        // Try to apply without approval
        $response = $this->actingAs($this->adminUser())
            ->postJson("/api/tenants/{$tenant->id}/geography-sync/apply-batch/{$batch->id}");
        
        $response->assertStatus(422);
        $response->assertJson(['message' => 'Batch must be APPROVED before application']);
        
        // Approve first
        $this->approveBatch($batch);
        
        // Now apply should work
        $response = $this->actingAs($this->adminUser())
            ->postJson("/api/tenants/{$tenant->id}/geography-sync/apply-batch/{$batch->id}");
        
        $response->assertOk();
        
        // Verify changes in production
        $productionCount = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->where('is_official', true)
            ->count();
        
        $this->assertGreaterThan(0, $productionCount);
    }
    
    /** @test */
    public function it_allows_rollback_of_applied_changes()
    {
        $tenant = Tenant::factory()->create();
        $batch = SyncBatch::factory()->for($tenant)->withStagingChanges(2)->create();
        
        // Approve and apply
        $this->approveBatch($batch);
        $this->applyBatch($batch);
        
        // Verify applied
        $batch->refresh();
        $this->assertEquals('APPLIED', $batch->status);
        $this->assertTrue($batch->can_rollback);
        
        // Rollback
        $response = $this->actingAs($this->adminUser())
            ->postJson("/api/tenants/{$tenant->id}/geography-sync/rollback/{$batch->id}");
        
        $response->assertOk();
        
        // Verify rollback
        $batch->refresh();
        $this->assertEquals('ROLLED_BACK', $batch->status);
        $this->assertFalse($batch->can_rollback);
        
        // Verify production table reverted
        $productionCount = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->where('is_official', true)
            ->count();
        
        $this->assertEquals(0, $productionCount, 'Rollback should remove applied changes');
    }
    
    /** @test */
    public function it_preserves_custom_units_during_sync()
    {
        $tenant = Tenant::factory()->create();
        
        // Create custom unit (Level 5) attached to an official unit
        $officialUnit = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->insertGetId([
                'name' => 'Test Ward',
                'level' => 4,
                'external_geo_id' => 999,
                'is_official' => true,
                'is_custom' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        
        $customUnit = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->insertGetId([
                'name' => 'Youth Committee',
                'level' => 5,
                'parent_id' => $officialUnit,
                'is_official' => false,
                'is_custom' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        
        // Sync changes that update the parent official unit
        $this->mockLandlordChanges([[
            'id' => 999,
            'type' => 'UPDATE',
            'name' => 'Updated Ward Name',
            'level' => 4,
        ]]);
        
        $this->triggerStagingSync($tenant);
        $this->approveAndApplyChanges($tenant);
        
        // Verify custom unit still exists and is attached to updated parent
        $customUnitExists = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->where('id', $customUnit)
            ->where('is_custom', true)
            ->exists();
        
        $this->assertTrue($customUnitExists, 'Custom unit should be preserved during sync');
        
        // Verify parent was updated
        $parentName = DB::connection($tenant->getDatabaseConnectionName())
            ->table('tenant_geo_units')
            ->where('id', $officialUnit)
            ->value('name');
        
        $this->assertEquals('Updated Ward Name', $parentName);
    }
}
```

---

## 🚀 **DEPLOYMENT CHECKLIST**

### **Phase 1: Foundation (Week 1)**
- [ ] Create staging table migration
- [ ] Create sync batch management tables
- [ ] Add columns to production table
- [ ] Set up test data factories

### **Phase 2: Core Services (Week 2)**
- [ ] Implement AutoStagingSyncService
- [ ] Create SyncApprovalService
- [ ] Implement RollbackService
- [ ] Set up scheduled staging sync

### **Phase 3: Admin Interface (Week 3)**
- [ ] Build Vue.js sync dashboard
- [ ] Create API endpoints
- [ ] Implement review/approval workflow
- [ ] Add impact analysis features

### **Phase 4: Integration & Testing (Week 4)**
- [ ] Update MemberGeographyValidator for dual mode
- [ ] Update GeographyAntiCorruptionLayer
- [ ] Write comprehensive test suite
- [ ] Perform integration testing

### **Phase 5: Pilot Rollout (Week 5)**
- [ ] Enable for 1-2 pilot tenants
- [ ] Monitor for 7 days
- [ ] Gather feedback
- [ ] Fix any issues

### **Phase 6: Full Rollout (Week 6)**
- [ ] Enable for all tenants
- [ ] Provide training to admins
- [ ] Set up monitoring and alerts
- [ ] Document procedures

---

## 🎯 **STARTING POINT: TODAY'S TASKS**

### **Task 1: Create Staging Table (1-2 hours)**
```bash
# 1. Create migration
php artisan make:migration create_tenant_geo_units_staging_table --path=database/migrations/tenant

# 2. Run on test database
php setup_test_db.php --fresh

# 3. Verify table structure
php artisan tinker
>>> DB::connection('tenant_test_1')->select('DESCRIBE tenant_geo_units_staging')
```

### **Task 2: Basic Staging Sync Service (2-3 hours)**
```php
// Create the minimal service to test the concept
class SimpleStagingSyncService
{
    public function testSync(Tenant $tenant): void
    {
        // Copy 1-2 records from landlord to staging
        $landlordUnits = DB::connection('landlord')
            ->table('geo_administrative_units')
            ->where('country_code', 'NP')
            ->limit(2)
            ->get();
        
        foreach ($landlordUnits as $unit) {
            DB::connection($tenant->getDatabaseConnectionName())
                ->table('tenant_geo_units_staging')
                ->insert([
                    'name' => $unit->name_local,
                    'level' => $unit->admin_level,
                    'geo_path' => $unit->path,
                    'external_geo_id' => $unit->id,
                    'sync_action' => 'CREATE',
                    'sync_status' => 'PENDING',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
        }
        
        echo "Test sync complete. Check staging table.";
    }
}
```

### **Task 3: Test in Tinker (30 minutes)**
```bash
php artisan tinker

>>> $tenant = Tenant::first();
>>> $service = new SimpleStagingSyncService();
>>> $service->testSync($tenant);
>>> DB::connection($tenant->getDatabaseConnectionName())
>>>   ->table('tenant_geo_units_staging')
>>>   ->count();
```

---

## 🔧 **KEY DECISIONS & CUSTOMIZATION POINTS**

1. **Approval Workflow**: Single approver vs multi-level approval
2. **Notification System**: Email, Slack, or in-app notifications
3. **Staging Cleanup**: How long to keep staging data
4. **Sync Frequency**: Hourly, daily, or real-time staging sync
5. **Impact Analysis**: Simple vs comprehensive impact checking
6. **Rollback Window**: How long after application can rollback occur
7. **Tenant Control**: Which tenants can self-manage vs admin-only

---

## ✅ **BENEFITS OF THIS APPROACH**

1. **Safety**: Changes never automatically applied to production
2. **Control**: Manual approval for every sync batch
3. **Visibility**: Clear preview of changes before application
4. **Rollback**: Full rollback capability if issues arise
5. **Auditability**: Complete audit trail of all sync activities
6. **Minimal Risk**: Can test with staging without affecting production
7. **Flexibility**: Different approval workflows per tenant

This gives you the **best of both worlds**: automated collection of changes from landlord with **full manual control** over what gets applied to production.