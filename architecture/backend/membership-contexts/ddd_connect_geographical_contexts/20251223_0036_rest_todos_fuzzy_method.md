# 📋 **PROFESSIONAL PROMPT INSTRUCTIONS: NEPAL POLITICAL PARTY PLATFORM - GEOGRAPHY SYNC SYSTEM**

## 🎯 **PROJECT CONTEXT & CURRENT STATUS**

**Platform**: Multi-tenant Laravel DDD application for Nepal political parties  
**Current Phase**: Geography Fuzzy Matching ✅ COMPLETE, Bidirectional Sync 🔄 IN PROGRESS  
**Database**: PostgreSQL with ltree extension, Database-per-tenant isolation  
**Status**: Fuzzy matching engine (100% tested), Candidate tables schema designed  

**IMMEDIATE BLOCKER**: Test database migration failure for `geo_candidate_units` table.

---

## 📋 **IMMEDIATE ACTION REQUIRED (TODAY)**

### **1. FIX TEST DATABASE MIGRATION**
```bash
# Current error: "Table doesn't exist in test database"
# Required action: Run migrations on test environment
```

**PROMPT:**
```
Create a test database setup script that:
1. Ensures landlord test database exists with proper permissions
2. Runs ALL landlord migrations on test database
3. Creates necessary PostgreSQL extensions (pg_trgm, fuzzystrmatch, ltree)
4. Updates GeoCandidateUnitsTableTest to properly handle test database setup
5. Fixes the getTableIndexes() method to use PostgreSQL's pg_indexes instead of information_schema.statistics
```

### **2. COMPLETE BIDIRECTIONAL SYNC TABLES**
```sql
-- Landlord: ✅ geo_candidate_units (migration exists, needs test fix)
-- Tenant:   ⏳ tenant_geo_candidates (migration needed)
-- Landlord: ⏳ geo_change_proposals (migration needed)
```

**PROMPT:**
```
Create the remaining database migrations for bidirectional sync:

1. Tenant database migration: create_tenant_geo_candidates_table.php
   - Should match tenant_geo_candidates schema from architecture document
   - Include sync_status, landlord_candidate_id, submission_context columns
   - Add indexes for performance (level, sync_status, name_normalized)

2. Landlord database migration: create_geo_change_proposals_table.php
   - UUID primary key, proposal_type enum, proposal_data jsonb
   - Impact analysis columns, voting/approval workflow
   - Indexes for review_status and source_tenant_id

3. Update existing geo_candidate_units migration if any columns missing
   - Verify all columns from GeoCandidateUnitsTableTest exist
   - Add any missing indexes for performance
```

---

## 🔧 **PHASE 2: BIDIRECTIONAL SYNC SERVICES**

### **3. IMPLEMENT SYNC DOMAIN SERVICES**
```php
// Services needed:
// 1. UpstreamSyncService (Tenant → Landlord)
// 2. DownstreamSyncService (Landlord → Tenant)  
// 3. SyncApprovalService (Review workflow)
// 4. RollbackService (Emergency recovery)
```

**PROMPT:**
```
Implement the sync domain services as per architecture document:

1. Create UpstreamSyncService in app/Contexts/Sync/Domain/Services/
   - Method: submitCandidateToLandlord(Tenant $tenant, array $candidateData)
   - Uses FuzzyMatchingService to find potential matches
   - Determines if correction vs new unit
   - Creates geo_candidate_units record with fuzzy match results
   - Returns array with success status and suggested action

2. Create DownstreamSyncService in same namespace
   - Method: syncApprovedCandidatesToTenants(GeoCandidateUnit $candidate)
   - Applies approved changes to ALL relevant tenant databases
   - Handles both new units and corrections
   - Updates tenant_geo_units table (official levels 1-4 only)
   - Preserves custom units (levels 5-8)

3. Create corresponding interfaces and test files
   - Follow existing DDD patterns from FuzzyMatchingService
   - Include comprehensive unit tests with mocks
   - Test both happy paths and error scenarios
```

### **4. CREATE APPROVAL WORKFLOW**
```php
// Approval states: PENDING → UNDER_REVIEW → APPROVED/REJECTED
// Manual approval required before downstream sync
```

**PROMPT:**
```
Implement the approval workflow services:

1. Create SyncApprovalService with methods:
   - approveChanges(Tenant $tenant, array $changeIds, User $approver): SyncBatch
   - rejectChanges(Tenant $tenant, array $changeIds, User $rejecter, string $reason): void
   - applyApprovedChanges(Tenant $tenant, string $batchId, User $applier): SyncBatch

2. Create RollbackService for emergency recovery:
   - rollbackBatch(Tenant $tenant, string $batchId, User $roller): void
   - previewRollback(Tenant $tenant, string $batchId): array
   - Uses geo_unit_backups table for state restoration

3. Create corresponding Value Objects:
   - SyncBatch, SyncStatus, ChangeBatch, SyncError
   - Follow existing patterns from Geography context
```

---

## 🌐 **PHASE 3: API & FRONTEND INTEGRATION**

### **5. BUILD REST API ENDPOINTS**
```php
// API routes needed for:
// 1. Fuzzy matching suggestions (immediate user feedback)
// 2. Candidate submission (user → landlord)
// 3. Admin review (landlord dashboard)
// 4. Sync operations (admin controls)
```

**PROMPT:**
```
Create API controllers and routes for geography sync system:

1. GeographyFuzzyMatchController (public API):
   - POST /api/geography/fuzzy-match - Find similar names
   - POST /api/geography/candidates - Submit new geography candidate
   - Returns MatchResult/PotentialMatches JSON with similarity scores

2. TenantGeographySyncController (tenant-admin):
   - GET  /api/tenants/{tenant}/geography-sync/pending - Pending changes
   - POST /api/tenants/{tenant}/geography-sync/approve - Approve changes
   - POST /api/tenants/{tenant}/geography-sync/apply - Apply to production

3. AdminGeographySyncController (platform-admin):
   - GET  /api/admin/geography-candidates - All pending candidates
   - GET  /api/admin/geography-candidates/{id} - Candidate details
   - POST /api/admin/geography-candidates/{id}/review - Admin review

4. Include proper validation, authorization, and error handling
   - Use Laravel Form Requests for validation
   - Implement policy-based authorization
   - Return standardized JSON responses
```

### **6. VUE.JS ADMIN DASHBOARD**
```vue
// Components needed:
// 1. GeographySuggestionForm (user-facing)
// 2. SyncReviewDashboard (admin-facing)  
// 3. SyncHistoryTable (audit trail)
// 4. ImpactAnalysisModal (before approval)
```

**PROMPT:**
```
Create Vue 3 components for geography sync interface:

1. GeographySuggestionForm.vue (for member registration):
   - Shows when geography not found during selection
   - Displays fuzzy match suggestions with confidence scores
   - Allows user to submit new candidate with reason
   - Shows submission status and reference ID

2. SyncReviewDashboard.vue (admin panel):
   - Lists pending candidates with filter/sort options
   - Shows match confidence and potential impact
   - Batch approval/rejection actions
   - Real-time status updates

3. SyncHistoryTable.vue (audit trail):
   - Shows applied sync batches with rollback capability
   - Displays sync statistics (success rate, duration)
   - Export functionality for reports

4. Include comprehensive TypeScript types, Tailwind CSS styling, and axios integration
```

---

## 🧪 **PHASE 4: TESTING & DEPLOYMENT**

### **7. COMPREHENSIVE TEST SUITE**
```bash
# Test coverage needed:
# ✅ Unit tests: Fuzzy matching (COMPLETE)
# 🔄 Integration tests: Sync services (IN PROGRESS)
# ⏳ Feature tests: API endpoints (NEEDED)
# ⏳ E2E tests: User workflow (NEEDED)
```

**PROMPT:**
```
Create comprehensive test suite for sync system:

1. Integration tests for sync services:
   - Tests/Feature/Sync/BidirectionalGeographySyncTest.php
   - Tests actual database operations with transactions
   - Tests cross-database sync scenarios
   - Tests error handling and rollback

2. API tests for endpoints:
   - Tests/Feature/Api/GeographyFuzzyMatchApiTest.php
   - Tests JSON responses and error formats
   - Tests authentication/authorization
   - Tests rate limiting if implemented

3. Database test helpers:
   - Factories for GeoCandidateUnit, SyncBatch
   - Seeders with realistic Nepal geography data
   - Test traits for multi-tenant database setup

4. Performance tests:
   - Tests/Performance/GeographySyncPerformanceTest.php
   - Tests sync duration with 1000+ candidates
   - Tests cache effectiveness
   - Tests concurrent sync operations
```

### **8. DEPLOYMENT & MONITORING**
```yaml
# Deployment checklist:
# 1. Database migrations (production-safe)
# 2. Queue workers configuration  
# 3. Monitoring setup
# 4. Rollback procedures
```

**PROMPT:**
```
Create deployment and monitoring assets:

1. Deployment script (scripts/deploy-geography-sync.sh):
   - Runs migrations in correct order (landlord first, then tenants)
   - Sets up supervisor config for sync queue workers
   - Enables PostgreSQL extensions on all tenant databases
   - Sets feature flags for gradual rollout

2. Monitoring dashboard (app/Http/Controllers/Admin/GeographyAnalyticsController.php):
   - Sync success rate and duration metrics
   - Candidate submission statistics by tenant
   - Common misspellings and correction effectiveness
   - Queue backlog and worker health

3. Alerting configuration:
   - Failed sync batch alerts (Slack/Email)
   - High pending candidate backlog
   - Low fuzzy match success rate
   - Geographic data drift detection

4. Rollback procedures documentation:
   - Step-by-step rollback guide
   - Data integrity verification scripts
   - Communication templates for downtime
```

---

## 🚀 **PRIORITIZED EXECUTION ORDER**

### **WEEK 1: FOUNDATION** (CRITICAL PATH)
```
DAY 1: Fix test database setup ✅
DAY 2: Complete database migrations ✅  
DAY 3: Implement UpstreamSyncService
DAY 4: Implement DownstreamSyncService
DAY 5: Basic API endpoints
DAY 6: Integration tests
DAY 7: Code review & fix issues
```

### **WEEK 2: WORKFLOW**
```
DAY 8: Approval workflow services
DAY 9: Vue.js suggestion form component
DAY 10: Admin review dashboard
DAY 11: Impact analysis features
DAY 12: Comprehensive testing
DAY 13: Performance optimization
DAY 14: Documentation
```

### **WEEK 3: DEPLOYMENT**
```
DAY 15: Staging deployment
DAY 16: Pilot tenant rollout (2-3 parties)
DAY 17: Monitor & fix issues
DAY 18: Full rollout preparation
DAY 19: Production deployment
DAY 20: Post-deployment monitoring
DAY 21: Optimization & tuning
```

---

## ⚠️ **CRITICAL CONSTRAINTS & REQUIREMENTS**

### **MUST MAINTAIN:**
1. **Database-per-tenant isolation** - No cross-tenant data leakage
2. **Backward compatibility** - Existing member registrations must work
3. **DDD architecture patterns** - Follow existing Value Objects, Repositories
4. **Test coverage** - Minimum 80% coverage for new code
5. **Performance** - Sub-100ms for fuzzy matching, <5min for daily sync

### **MUST HANDLE:**
1. **Nepal-specific variations** - Rosyara/Roshara, municipality suffixes
2. **JSON name_local field** - Extract 'np' key for Nepali names
3. **PostgreSQL features** - ltree, trigram, proper indexing
4. **Multi-language support** - Future English/other language names
5. **Government boundary updates** - Annual administrative changes

### **MUST AVOID:**
1. **Automatic production sync** - All syncs require manual approval
2. **Data loss** - Full rollback capability required
3. **Service disruption** - Zero downtime during sync operations
4. **Complex event sourcing** - Keep simple for now (copy-on-setup + daily sync)
5. **External dependencies** - No Elasticsearch/Solr for v1

---

## 📞 **ESCALATION PATHS**

### **TECHNICAL BLOCKERS:**
1. **Database migration issues** → Senior Database Architect
2. **Performance bottlenecks** → DevOps/Infrastructure team  
3. **DDD architecture questions** → Lead Backend Developer
4. **Frontend integration issues** → Frontend Team Lead

### **BUSINESS DECISIONS NEEDED:**
1. **Approval workflow complexity** → Product Manager
2. **Pilot tenant selection** → Customer Success team
3. **Communication templates** → Marketing/Comms team
4. **SLAs for sync operations** → Operations Manager

### **URGENT SUPPORT REQUIRED:**
1. **Production database access** → DevOps team
2. **Monitoring setup** → Infrastructure team
3. **Security review** → Security team
4. **Load testing** → Performance engineering

---

## ✅ **ACCEPTANCE CRITERIA**

### **MINIMUM VIABLE PRODUCT (MVP):**
- [ ] Users can submit missing geography during member registration
- [ ] Admins can review and approve/reject submissions  
- [ ] Approved changes sync to all relevant tenant databases
- [ ] Full rollback capability for applied changes
- [ ] 100% test coverage for critical paths
- [ ] Sub-5 second response for fuzzy matching API
- [ ] Zero data loss guarantee

### **SUCCESS METRICS:**
- **User satisfaction**: >90% of missing geography handled automatically
- **Admin efficiency**: <2 minute review per candidate on average
- **System performance**: <100ms fuzzy matching, <5min daily sync
- **Data quality**: <1% error rate in applied geography changes
- **Adoption rate**: >80% of tenants using the system within 30 days

---

**🎯 READY FOR EXECUTION: All requirements documented, architecture validated, priorities set. Begin with fixing test database migration, then proceed through prioritized execution order.**