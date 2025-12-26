# 📋 **REMAINING TODOS: GEOGRAPHY SYNC SYSTEM - PHASE 2**

## 🎯 **CURRENT STATUS (2025-12-23)**

**Platform**: Multi-tenant Laravel DDD application for Nepal political parties
**Current Phase**: Test Database Migration Fix 🔄 IN PROGRESS, Bidirectional Sync ⏳ PENDING
**Database**: PostgreSQL with ltree extension, Database-per-tenant isolation
**Test Coverage**: Fuzzy matching engine 100% ✅, Candidate tables schema tests ❌ (blocked)

**IMMEDIATE BLOCKER**: `Target class [config] does not exist` error in `GeoCandidateUnitsTableTest`.

---

## 📋 **PRIORITIZED ACTION PLAN**

### **1. FIX TEST CONFIGURATION ERROR** (IMMEDIATE)
**Status**: In Progress
**Issue**: `config()` helper failing in test `setUp()` method
**Root Cause**: Container not fully bootstrapped when setting config before `parent::setUp()`
**Solution**:
```php
// Move config setting AFTER parent::setUp()
protected function setUp(): void
{
    parent::setUp();

    // Set landlord connection after parent setup
    config(['database.default' => 'landlord']);

    // Run migrations...
}
```

**Tasks**:
- [ ] Update `GeoCandidateUnitsTableTest.php` `setUp()` method order
- [ ] Run test to verify table creation works
- [ ] Ensure all 9 test assertions pass

### **2. CREATE MISSING MIGRATIONS** (DAY 1)
**Status**: Pending
**Description**: Create remaining database tables for bidirectional sync

**2.1 Tenant Database Migration**: `create_tenant_geo_candidates_table.php`
- **Location**: `app/Contexts/Geography/Infrastructure/Database/Migrations/` (tenant-specific)
- **Schema**: Matches `tenant_geo_candidates` from architecture document
- **Columns**: `sync_status`, `landlord_candidate_id`, `submission_context`, `name_normalized`
- **Indexes**: `level`, `sync_status`, `name_normalized`
- **TDD**: Write failing test first (`TenantGeoCandidatesTableTest`)

**2.2 Landlord Database Migration**: `create_geo_change_proposals_table.php`
- **Location**: `database/landlord/migrations/`
- **Schema**: UUID primary key, `proposal_type` enum, `proposal_data` jsonb
- **Columns**: Impact analysis, voting/approval workflow
- **Indexes**: `review_status`, `source_tenant_id`
- **TDD**: Write failing test first (`GeoChangeProposalsTableTest`)

### **3. IMPLEMENT SYNC DOMAIN SERVICES** (DAY 2-3)
**Status**: Pending
**Follow TDD approach**: Write failing tests first, then implement services

**3.1 UpstreamSyncService** (`app/Contexts/Sync/Domain/Services/`)
- **Method**: `submitCandidateToLandlord(Tenant $tenant, array $candidateData)`
- **Uses**: `FuzzyMatchingService` to find potential matches
- **Determines**: Correction vs new unit
- **Creates**: `geo_candidate_units` record with fuzzy match results
- **Returns**: Array with success status and suggested action

**3.2 DownstreamSyncService** (same namespace)
- **Method**: `syncApprovedCandidatesToTenants(GeoCandidateUnit $candidate)`
- **Applies**: Approved changes to ALL relevant tenant databases
- **Handles**: Both new units and corrections
- **Updates**: `tenant_geo_units` table (official levels 1-4 only)
- **Preserves**: Custom units (levels 5-8)

**3.3 Test Files**:
- `Tests/Unit/Contexts/Sync/Domain/Services/UpstreamSyncServiceTest.php`
- `Tests/Unit/Contexts/Sync/Domain/Services/DownstreamSyncServiceTest.php`
- Mock dependencies, test both happy paths and error scenarios

### **4. IMPLEMENT APPROVAL WORKFLOW** (DAY 4)
**Status**: Pending

**4.1 SyncApprovalService**
- `approveChanges(Tenant $tenant, array $changeIds, User $approver): SyncBatch`
- `rejectChanges(Tenant $tenant, array $changeIds, User $rejecter, string $reason): void`
- `applyApprovedChanges(Tenant $tenant, string $batchId, User $applier): SyncBatch`

**4.2 RollbackService** (emergency recovery)
- `rollbackBatch(Tenant $tenant, string $batchId, User $roller): void`
- `previewRollback(Tenant $tenant, string $batchId): array`
- Uses `geo_unit_backups` table for state restoration

**4.3 Value Objects** (follow existing DDD patterns)
- `SyncBatch`, `SyncStatus`, `ChangeBatch`, `SyncError`

### **5. CREATE API ENDPOINTS** (DAY 5)
**Status**: Pending

**5.1 GeographyFuzzyMatchController** (public API)
- `POST /api/geography/fuzzy-match` - Find similar names
- `POST /api/geography/candidates` - Submit new geography candidate
- Returns `MatchResult`/`PotentialMatches` JSON with similarity scores

**5.2 TenantGeographySyncController** (tenant-admin)
- `GET /api/tenants/{tenant}/geography-sync/pending` - Pending changes
- `POST /api/tenants/{tenant}/geography-sync/approve` - Approve changes
- `POST /api/tenants/{tenant}/geography-sync/apply` - Apply to production

**5.3 AdminGeographySyncController** (platform-admin)
- `GET /api/admin/geography-candidates` - All pending candidates
- `GET /api/admin/geography-candidates/{id}` - Candidate details
- `POST /api/admin/geography-candidates/{id}/review` - Admin review

**5.4 Follow 6-Case Routing Architecture**:
- Mobile API routes: `/mapi/*` or `/{tenant}/mapi/*`
- Desktop API routes: `/api/*` or `/{tenant}/api/*`
- Proper middleware: `['api']` for mobile, `['web']` for desktop
- Tenant middleware: `'identify.tenant'` for tenant-specific routes

---

## 🚨 **CRITICAL CONSTRAINTS & REQUIREMENTS**

### **MUST MAINTAIN**:
1. **Database-per-tenant isolation** - No cross-tenant data leakage
2. **Backward compatibility** - Existing member registrations must work
3. **DDD architecture patterns** - Follow existing Value Objects, Repositories
4. **Test coverage** - Minimum 80% coverage for new code
5. **Performance** - Sub-100ms for fuzzy matching, <5min for daily sync

### **MUST HANDLE**:
1. **Nepal-specific variations** - Rosyara/Roshara, municipality suffixes
2. **JSON name_local field** - Extract 'np' key for Nepali names
3. **PostgreSQL features** - ltree, trigram, proper indexing
4. **Multi-language support** - Future English/other language names
5. **Government boundary updates** - Annual administrative changes

### **MUST AVOID**:
1. **Automatic production sync** - All syncs require manual approval
2. **Data loss** - Full rollback capability required
3. **Service disruption** - Zero downtime during sync operations
4. **Complex event sourcing** - Keep simple for now (copy-on-setup + daily sync)
5. **External dependencies** - No Elasticsearch/Solr for v1

---

## ✅ **ACCEPTANCE CRITERIA - PHASE 2**

### **MINIMUM VIABLE PRODUCT (MVP)**:
- [ ] Users can submit missing geography during member registration
- [ ] Admins can review and approve/reject submissions
- [ ] Approved changes sync to all relevant tenant databases
- [ ] Full rollback capability for applied changes
- [ ] 100% test coverage for critical paths
- [ ] Sub-5 second response for fuzzy matching API
- [ ] Zero data loss guarantee

### **SUCCESS METRICS**:
- **User satisfaction**: >90% of missing geography handled automatically
- **Admin efficiency**: <2 minute review per candidate on average
- **System performance**: <100ms fuzzy matching, <5min daily sync
- **Data quality**: <1% error rate in applied geography changes
- **Adoption rate**: >80% of tenants using the system within 30 days

---

## 🔧 **TDD WORKFLOW FOR EACH TASK**

1. **Write failing test** (RED)
   - Create test file with descriptive test names
   - Test should fail with clear error message
   - Verify test actually fails before implementation

2. **Implement minimum code to pass test** (GREEN)
   - Write only code needed to make test pass
   - No extra features or optimizations
   - Follow DDD patterns (Value Objects, Services, Repositories)

3. **Refactor** (REFACTOR)
   - Improve code structure while keeping tests green
   - Apply SOLID principles
   - Ensure 80%+ test coverage

4. **Repeat** for each feature

---

## 📞 **ESCALATION PATHS**

### **TECHNICAL BLOCKERS**:
1. **Database migration issues** → Senior Database Architect
2. **Performance bottlenecks** → DevOps/Infrastructure team
3. **DDD architecture questions** → Lead Backend Developer
4. **Frontend integration issues** → Frontend Team Lead

### **BUSINESS DECISIONS NEEDED**:
1. **Approval workflow complexity** → Product Manager
2. **Pilot tenant selection** → Customer Success team
3. **Communication templates** → Marketing/Comms team
4. **SLAs for sync operations** → Operations Manager

---

**🎯 READY FOR EXECUTION: Immediate focus on fixing test configuration error, then proceed through prioritized action plan with TDD approach.**