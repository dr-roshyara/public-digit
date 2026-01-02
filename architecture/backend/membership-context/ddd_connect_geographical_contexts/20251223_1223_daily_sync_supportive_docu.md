# 🎯 **PERFECT! NOW I UNDERSTAND COMPLETELY**

**Yes, create this migration!** This is the **correct architecture** now that I understand your requirements:

## 🏗️ **THE ARCHITECTURE YOU'RE BUILDING:**

```
┌─────────────────────────────────────────────────────────┐
│ LANDLORD DATABASE (publicdigit)                         │
│ • Single Source of Truth                                │
│ • Levels 1-5: OFFICIAL geography (7→77→753→6,743→??? )  │
│ • Approved via admin review                             │
│ • Shared across ALL tenants                             │
└──────────────┬──────────────────────────────────────────┘
               │
               │ Tenant submits missing/custom geography
               ▼
┌─────────────────────────────────────────────────────────┐
│ TENANT DATABASE (tenant_{id})                           │
│ • tenant_geo_candidates ← THIS MIGRATION                │
│ • Levels 6-8: CUSTOM geography (party-specific)         │
│ • Tenant autonomy: Can define own structure             │
│ • Sync status to landlord                               │
└──────────────────────────────────────────────────────────┘
```

## ✅ **THIS MIGRATION IS CORRECT FOR:**

### **1. Tenant Autonomy**
Each political party can:
- Define custom organizational units (levels 6-8)
- Submit corrections to official geography (levels 1-5)
- Maintain their own submission queue

### **2. Bidirectional Sync**
- **Tenant → Landlord**: Submit new/corrected geography
- **Landlord → Tenant**: Official updates, approval notifications

### **3. Nepal Political Party Reality**
```
Level 1-5: OFFICIAL (same for all parties)
Level 6-8: CUSTOM (different per party)
Example:
- Level 6: Party Cell
- Level 7: Sub-cell  
- Level 8: Member Group
```

## 🗄️ **MIGRATION DATABASE: Tenant Databases**

**This migration runs on:** `tenant_nrna`, `tenant_uml`, `tenant_ncp`, etc.

**Each tenant database gets its own:** `tenant_geo_candidates` table

## 📝 **ENHANCE THE MIGRATION:**

Add these fields to better support your architecture:

```php
Schema::create('tenant_geo_candidates', function (Blueprint $table) {
    $table->id();
    
    // What the user entered
    $table->string('name_entered');
    $table->string('name_normalized');
    $table->integer('level'); // 1-8
    
    // Distinguish: Official correction vs Custom unit
    $table->enum('candidate_type', [
        'OFFICIAL_CORRECTION', // Levels 1-5
        'CUSTOM_UNIT',         // Levels 6-8
        'NAME_UPDATE',         // Spelling correction
        'HIERARCHY_CHANGE'     // Parent/child relationship
    ])->default('OFFICIAL_CORRECTION');
    
    $table->unsignedBigInteger('parent_id')->nullable();
    $table->string('parent_name')->nullable();
    
    // User context
    $table->unsignedBigInteger('submitted_by')->nullable();
    $table->unsignedBigInteger('reviewed_by')->nullable(); // Tenant admin
    $table->timestamp('tenant_reviewed_at')->nullable();
    
    // Tenant approval before landlord submission
    $table->enum('tenant_review_status', [
        'DRAFT',
        'PENDING_TENANT_REVIEW',
        'TENANT_APPROVED',
        'TENANT_REJECTED'
    ])->default('DRAFT');
    
    // Fuzzy matching results
    $table->json('matching_results')->nullable();
    $table->string('suggested_correction')->nullable();
    $table->boolean('user_accepted_correction')->default(false);
    
    // Sync status with landlord
    $table->enum('sync_status', [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'MERGED',
        'IMPLEMENTED'
    ])->default('DRAFT');
    
    $table->unsignedBigInteger('landlord_candidate_id')->nullable();
    $table->unsignedBigInteger('landlord_official_id')->nullable();
    
    // Tenant decision
    $table->boolean('tenant_wants_addition')->default(true);
    $table->text('tenant_notes')->nullable();
    
    // For custom units (levels 6-8) - tenant-specific metadata
    $table->json('custom_unit_metadata')->nullable();
    $table->string('custom_unit_code')->nullable(); // Party-specific code
    
    $table->timestamps();
    $table->softDeletes(); // Soft delete for audit trail
    
    // Indexes
    $table->index(['level', 'sync_status']);
    $table->index(['candidate_type', 'sync_status']);
    $table->index(['name_normalized', 'level']);
    $table->index(['submitted_by', 'created_at']);
    $table->index(['tenant_review_status', 'sync_status']);
});
```

## 🔄 **WORKFLOW EXAMPLE:**

### **For Official Correction (Levels 1-5):**
```
1. Tenant user submits: "Roshara Municipality" → Level 3
2. Saved in tenant_geo_candidates (DRAFT)
3. Tenant admin reviews → TENANT_APPROVED
4. Auto-submit to landlord → UNDER_REVIEW
5. Landlord admin reviews → APPROVED
6. Added to landlord official geography
7. Sync to all tenants
```

### **For Custom Unit (Levels 6-8):**
```
1. Tenant admin creates: "Youth Wing Committee" → Level 6
2. Saved in tenant_geo_candidates (CUSTOM_UNIT)
3. Tenant admin approves → TENANT_APPROVED
4. Immediately available in tenant (no landlord sync needed)
5. Optionally share with landlord for cross-party analytics
```

## 🎖️ **ARCHITECT'S FINAL APPROVAL:**

**YES, create this migration.** It's the right architecture for:

1. **Tenant Autonomy**: Each party controls their submissions
2. **Official vs Custom**: Clear separation (levels 1-5 vs 6-8)
3. **Two-step Review**: Tenant admin → Landlord admin
4. **Nepal Context**: Parties need custom organizational units

**Select Option 1: Yes** - Create this migration in `Membership` context for tenant databases.

This enables the exact workflow Nepal's political parties need!