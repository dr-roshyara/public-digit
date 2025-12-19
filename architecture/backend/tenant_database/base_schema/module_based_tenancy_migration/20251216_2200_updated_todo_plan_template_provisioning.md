# 🎯 **TENANT TEMPLATE PROVISIONING SYSTEM - UPDATED TODO PLAN**

**Created:** 2025-12-16
**Updated:** 2025-12-16 (Based on Senior Architect Review)
**Based on:** Analysis of 5 architecture documents + Senior Architect Review (20251216_2156_update_to_todos_claude_plan.md)
**Approach:** TDD First, DDD Principles, 80%+ Test Coverage
**Context:** PlatformContext (Landlord Admin Operations) ✅ **CONFIRMED CORRECT**
**Primary Template:** Political Party Nepal
**Phases:** 8 phases with incremental delivery, MVP focus

---

## **📋 OVERVIEW**

### **Business Requirement**
Extend the existing multi-tenant SaaS platform to support **template-driven schema evolution** with **manual landlord admin control**. The system must support 4-layer migration strategy:

1. **Category Templates** - Pre-defined schemas (Political Party Nepal)
2. **Module Migrations** - Add modules like Election to tenant databases
3. **Custom Migrations** - Tenant-specific schema modifications
4. **Individual Migrations** - Ad-hoc changes with approval workflow

### **Architectural Decision ✅ CONFIRMED**
- **PlatformContext** (Landlord operations) - **Correct** context for landlord admin template provisioning
- **TenantAuthContext** (Tenant operations) - **Not used** for template provisioning (tenant users shouldn't provision templates)
- **Template Storage:** `storage/app/templates/` (landlord storage, filesystem-based)
- **Admin Interface:** Extend existing `/admin/tenant-applications/{uuid}` page

### **Development Methodology**
- **TDD First:** Write failing tests before implementation
- **DDD Principles:** Use existing bounded contexts, extend don't rewrite
- **Tenant Isolation:** Maintain 100% tenant data isolation
- **Security:** Prevent SQL injection, validate admin permissions
- **Performance:** Template application under 30 seconds (MVP goal)

### **MVP Definition**
**Minimum Viable Product =** Landlord admin can apply Political Party Nepal template to tenant via admin interface and verify tables created in tenant database.

---

## **📊 PHASE 0: EXPLORATION & SETUP**

### **Goals**
1. Understand existing codebase structure
2. Identify existing services and controllers
3. Set up test environment for tenant database operations
4. Create baseline test suite

### **Tasks**
- [ ] **0.1** Examine existing `PlatformContext` structure
  - Locate `TemplateProvisioningService.php` (skeleton exists)
  - Locate `TenantApplicationController.php` (shows tenant details page)
  - Understand existing tenant provisioning flow
- [ ] **0.2** Examine existing `TenantAuthContext` structure
  - Locate `TenantDatabaseManager.php` for tenant DB connections
  - Understand tenant authentication and isolation
- [ ] **0.3** Examine existing `ElectionContext` **<-- UPDATED**
  - Understand how election module migrations work
  - Check if ElectionContext has `ElectionServiceProvider.php` that registers migrations (critical for module integration)
  - Identify migration files location and structure
- [ ] **0.4** Set up test database for tenant operations
  - Configure separate test tenant database
  - Ensure tenant isolation can be tested
- [ ] **0.5** Create baseline test suite structure
  - `tests/Feature/Platform/TemplateProvisioning/`
  - `tests/Unit/Platform/Domain/`
  - Configure PHPUnit for tenant database switching

### **Week 1 Day 1-2 Commands**
```bash
# Check existing tenants
php artisan tenants:list

# Check landlord schema
php artisan migrate:status --database=landlord

# Explore existing PlatformContext
cat app/Contexts/Platform/Application/Services/TemplateProvisioningService.php
cat app/Contexts/Platform/Infrastructure/Http/Controllers/TenantApplicationController.php
```

### **Deliverables**
- Map of existing codebase with relevant files
- Test environment ready for tenant database operations
- Baseline test structure

---

## **📊 PHASE 1: DATABASE SCHEMA & DOMAIN MODELS**

### **Goals**
1. Create landlord database tables to track template/module applications
2. Create DDD domain models in PlatformContext
3. Write failing tests for domain logic

### **Tasks**
- [ ] **1.1** Write failing tests for landlord database tables
  - Test table creation with proper constraints
  - Test relationships with existing `tenants` table
- [ ] **1.2** Create landlord database migrations **<-- UPDATED SCHEMA**
  ```sql
  -- tenant_templates table (template definitions)
  CREATE TABLE tenant_templates (
      slug VARCHAR(100) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      version VARCHAR(20) NOT NULL,
      description TEXT,
      migration_files JSON NOT NULL,
      seeders JSON,
      compatible_modules JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

  -- Update tenants table (add template tracking)
  ALTER TABLE tenants ADD COLUMN applied_template_slug VARCHAR(100) NULL AFTER slug;
  ALTER TABLE tenants ADD COLUMN template_applied_at TIMESTAMP NULL;
  ALTER TABLE tenants ADD COLUMN template_version VARCHAR(20) NULL;
  ALTER TABLE tenants ADD COLUMN provisioning_status ENUM('basic', 'template_ready', 'module_ready', 'custom_ready') DEFAULT 'basic';

  ALTER TABLE tenants ADD CONSTRAINT fk_tenants_template_slug
      FOREIGN KEY (applied_template_slug) REFERENCES tenant_templates(slug) ON DELETE SET NULL;

  -- tenant_applied_modules (track which modules applied)
  CREATE TABLE tenant_applied_modules (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      module_slug VARCHAR(100) NOT NULL,
      module_version VARCHAR(20) NOT NULL,
      applied_by UUID NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('pending', 'applied', 'failed') DEFAULT 'pending',
      INDEX idx_tenant_module (tenant_id, module_slug)
  );

  -- tenant_migration_history (audit trail for all migrations)
  CREATE TABLE tenant_migration_history (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      migration_type ENUM('category_template', 'module', 'custom') NOT NULL,
      migration_name VARCHAR(255) NOT NULL,
      migration_hash VARCHAR(64) NOT NULL,
      applied_by UUID NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INT,
      status ENUM('success', 'failed', 'rolled_back') DEFAULT 'success',
      error_message TEXT NULL,
      rollback_sql TEXT NULL,  -- <-- Store rollback SQL for critical operations
      metadata JSON,
      INDEX idx_tenant_history (tenant_id, applied_at)
  );
  ```
- [ ] **1.3** Write failing tests for domain entities
  - `Template` entity (slug, name, version, compatible modules)
  - `Module` entity (slug, name, dependencies, compatible templates)
  - `MigrationHistory` value object (tenant_id, type, name, hash, status)
- [ ] **1.4** Create domain entities in `PlatformContext`
  - Use existing DDD patterns from other contexts
  - Implement value objects for TemplateSlug, ModuleSlug, SchemaHash
- [ ] **1.5** Create repository interfaces
  - `TemplateRepositoryInterface`
  - `ModuleRepositoryInterface`
  - `MigrationHistoryRepositoryInterface`

### **Week 1 Day 3-4 Commands**
```bash
# Create landlord migrations
php artisan make:migration create_tenant_templates_table --path=database/migrations/landlord
php artisan make:migration add_template_fields_to_tenants_table --path=database/migrations/landlord
php artisan make:migration create_tenant_migration_history_table --path=database/migrations/landlord
```

### **Deliverables**
- Landlord database tables created via migrations
- Domain entities with proper business logic
- Repository interfaces
- Passing test suite for domain models

---

## **📊 PHASE 2: TEMPLATE STORAGE & DEFINITIONS**

### **Goals**
1. Create Political Party Nepal template structure
2. Create template definition format (JSON)
3. Create migration files for political party schema
4. Create Nepali administrative data seeders

### **Tasks**
- [ ] **2.1** Write failing tests for template loading
  - Test template JSON validation
  - Test migration file discovery
  - Test seeder execution
- [ ] **2.2** Create template storage structure
  ```
  storage/app/templates/
  ├── categories/
  │   └── political_party_nepal/
  │       ├── template.json
  │       ├── migrations/
  │       │   ├── 001_create_political_parties_table.sql    # <-- RAW SQL FOR MVP
  │       │   ├── 002_create_party_committees_table.sql
  │       │   ├── 003_create_committee_members_table.sql
  │       │   ├── 004_create_nepali_provinces_table.sql
  │       │   └── 005_create_nepali_districts_table.sql
  │       └── seeders/
  │           └── seed_nepali_administrative_data.php
  └── modules/
      └── election/
          ├── module.json
          └── migrations/          # <-- Copy or link from ElectionContext
  ```
- [ ] **2.3** Create `template.json` for Political Party Nepal
  - Include metadata: slug, name, version, description
  - Specify Nepali context requirements
  - List migration files in correct order
  - List compatible modules
- [ ] **2.4** Create migration files for political party schema **<-- DECISION: RAW SQL FOR MVP**
  - `political_parties` table (core party info) - raw SQL
  - `party_committees` table (central, provincial, district, ward) - raw SQL
  - `committee_members` table (roles, terms) - raw SQL
  - `provinces` table (7 provinces with Nepali/English names) - raw SQL
  - `districts` table (77 districts with hierarchy) - raw SQL
  - `financial_reports` table (Election Commission compliance) - raw SQL
  - `donation_records` table (NPR limits, citizenship validation) - raw SQL
- [ ] **2.5** Create Nepali administrative data seeders **<-- UPDATED WITH OFFICIAL DATA**
  - Seed 7 provinces with correct Nepali names (Government of Nepal official data)
  - Seed 77 districts with province relationships
  - Include latitude/longitude for mapping (if available)
  - Include population data (if available)
  - Include local language variations

### **Week 1 Day 5 Commands**
```bash
# Create template directory structure
mkdir -p storage/app/templates/categories/political_party_nepal/{migrations,seeders}
```

### **Migration File Format Decision**
**Decision:** Start with **raw SQL files (`.sql`)** for MVP simplicity.
**Reasoning:**
- Easier to create and validate
- Can evolve to Laravel migration classes later if needed
- Simple `connection->statement($sql)` execution

### **Deliverables**
- Complete Political Party Nepal template with migrations (raw SQL)
- Template definition format
- Nepali administrative data seeders (official government data)
- Tests for template loading and validation

---

## **📊 PHASE 3: TEMPLATE PROVISIONING SERVICE**

### **Goals**
1. Implement service to apply templates to tenant databases
2. Handle tenant database connection switching
3. Execute migrations in correct order
4. Log all actions to migration history

### **Tasks**
- [ ] **3.1** Write failing tests for template application
  - Test applying template to tenant database
  - Test migration execution order
  - Test rollback on failure
  - Test audit trail creation
- [ ] **3.2** Implement `TemplateProvisioningService` in PlatformContext
  - Extend existing skeleton service
  - Use `TenantDatabaseManager` from TenantAuthContext for connections
  - Apply migrations in transaction
  - Handle errors with proper rollback
- [ ] **3.3** Implement migration execution logic **<-- UPDATED APPROACH**
  ```php
  // Raw SQL execution for MVP
  $connection->statement($migrationSql);

  // Store rollback SQL for critical operations
  $rollbackSql = $this->generateRollbackSql($migrationSql);
  $this->logMigration(..., $rollbackSql);
  ```
- [ ] **3.4** Implement migration history logging
  - Log each migration attempt (success/failure)
  - Store who applied it, when, execution time
  - Store migration hash for integrity verification
  - **Store rollback SQL** for critical operations
- [ ] **3.5** Implement template compatibility validation
  - Check tenant status (must have basic migrations)
  - Check if template already applied
  - Validate admin permissions

### **Week 1 Day 6-7 Commands**
```bash
# Create first failing test
php artisan make:test Feature/Platform/TemplateProvisioning/TemplateApplicationTest
```

### **Key Integration Points**
```php
// 1. Tenant database connection (reuse existing)
$tenantDbManager = app(TenantDatabaseManager::class);
$connection = $tenantDbManager->connectionForTenant($tenant);

// 2. Template storage location
$templatePath = storage_path("app/templates/categories/{$templateSlug}");

// 3. Migration execution (raw SQL for MVP)
$connection->statement($migrationSql);

// 4. Audit logging (landlord DB)
DB::connection('landlord')->table('tenant_migration_history')->insert([
    'rollback_sql' => $rollbackSql,  // Store rollback SQL
]);
```

### **Deliverables**
- Fully functional `TemplateProvisioningService`
- Migration execution with transaction safety
- Complete audit trail with rollback SQL storage
- Passing test suite for template application

---

## **📊 PHASE 4: ADMIN INTERFACE EXTENSION**

### **Goals**
1. Extend existing tenant admin page (`/admin/tenant-applications/{uuid}`)
2. Add template provisioning UI section
3. Implement controller actions for template/module application
4. Add migration history display

### **Tasks**
- [ ] **4.1** Write failing tests for admin interface
  - Test controller authorization (landlord admin only)
  - Test template application via POST request
  - Test module addition via POST request
  - Test custom migration execution
- [ ] **4.2** Extend `TenantApplicationController::show()` method
  - Load available templates and modules
  - Load migration history for the tenant
  - Pass data to view
- [ ] **4.3** Create `TenantTemplateController` for POST actions
  - `applyTemplate()` - Apply category template
  - `addModule()` - Add module to tenant
  - `executeCustomMigration()` - Execute custom SQL
  - Validate admin permissions and input
- [ ] **4.4** Extend Blade view `admin/tenant-applications/show.blade.php`
  - Add "Schema Evolution & Template Provisioning" section
  - Template selection dropdown
  - Module checkboxes (with dependency validation)
  - Custom SQL textarea with description
  - Migration history table
- [ ] **4.5** Add routes in platform routes file
  ```php
  POST /admin/tenant-applications/{id}/apply-template
  POST /admin/tenant-applications/{id}/add-module
  POST /admin/tenant-applications/{id}/execute-custom-migration
  ```

### **Week 2 Day 8-9 Commands**
```bash
# Modify existing controller
# app/Contexts/Platform/Infrastructure/Http/Controllers/TenantApplicationController.php

# Add new controller
# app/Contexts/Platform/Infrastructure/Http/Controllers/Admin/TenantTemplateController.php
```

### **First Working Demo Goal**
By **Day 7** (end of Week 1), you should be able to:
1. Visit `/admin/tenant-applications/{uuid}`
2. See "Apply Template" section
3. Apply "Political Party Nepal" template
4. Verify `political_parties` table exists in tenant database

### **Deliverables**
- Extended tenant admin page with template provisioning UI
- Controller actions for all provisioning operations
- Proper authorization and validation
- Migration history display

---

## **📊 PHASE 5: MODULE INTEGRATION**

### **Goals**
1. Make Election module template-aware
2. Implement module dependency resolution
3. Add module provisioning to admin interface
4. Ensure module works with Political Party Nepal template

### **Tasks**
- [ ] **5.1** Write failing tests for module integration
  - Test module-template compatibility validation
  - Test dependency resolution (simple topological sort)
  - Test module migration execution
- [ ] **5.2** Make Election module template-aware **<-- CRITICAL INTEGRATION**
  - Add `isCompatibleWith(string $templateSlug): bool` method
  - Add `getRequiredDependencies(): array` method
  - **Check ElectionServiceProvider.php** for migration registration
  - **Copy migration files** to template storage OR create symbolic links
- [ ] **5.3** Implement module dependency resolution
  - Simple topological sort (Kahn's algorithm) - O(V+E)
  - No SAT solver over-engineering
  - Handle circular dependency detection
- [ ] **5.4** Extend `TemplateProvisioningService` for modules
  - `addModule()` method
  - Check compatibility with current template
  - Resolve and apply dependencies
  - Log module application
- [ ] **5.5** Create module definitions for existing modules
  - `election/module.json` (compatible with political_party_nepal)
  - List migration files from ElectionContext
  - Specify dependencies (if any)

### **Risk 4 Mitigation: Election Module Dependencies**
**Issue:** Election module might depend on tables created by template
**Mitigation:**
- Clear dependency declaration in `module.json`
- Validate dependencies before module application
- Provide clear error messages

### **Deliverables**
- Election module integrated with template system
- Module dependency resolution
- Module provisioning via admin interface
- Tests for module compatibility and dependencies

---

## **📊 PHASE 6: CUSTOM MIGRATIONS**

### **Goals**
1. Implement custom SQL migration system
2. Add approval workflow for dangerous operations
3. Provide SQL validation and safety checks
4. Integrate with migration history audit trail

### **Tasks**
- [ ] **6.1** Write failing tests for custom migrations
  - Test SQL validation (safe vs dangerous operations)
  - Test approval workflow
  - Test execution in tenant database
  - Test rollback on failure
- [ ] **6.2** Create `CustomMigrationRequest` domain entity
  - SQL statement, description, requester, approver
  - Status (pending, approved, rejected, executed)
  - Timestamps for request, approval, execution
- [ ] **6.3** Implement SQL safety validator
  - Block dangerous operations: `DROP DATABASE`, `TRUNCATE`, `DELETE FROM`, `UPDATE`
  - Allow safe operations: `ALTER TABLE ADD COLUMN`, `CREATE INDEX`
  - Configurable safety rules
- [ ] **6.4** Implement approval workflow
  - Request submission by landlord admin
  - Approval by super admin (different permission level)
  - Execution after approval
  - Notification system for pending requests
- [ ] **6.5** Extend admin interface for custom migrations
  - Request submission form
  - Approval queue for super admins
  - Execution history

### **SKIP INITIALLY - Post-MVP Feature**
This phase can be implemented after MVP is complete.

### **Deliverables**
- Custom migration request system
- SQL safety validation
- Approval workflow
- Integration with existing migration history

---

## **📊 PHASE 7: NEPALI CONTEXT & POLISH**

### **Goals**
1. Complete Nepali political party requirements
2. Add Election Commission Nepal compliance features
3. Implement bilingual support (Nepali/English)
4. Optimize performance and user experience

### **Tasks**
- [ ] **7.1** Write failing tests for Nepali context
  - Test Nepali administrative data integrity
  - Test Election Commission compliance tables
  - Test bilingual field support
- [ ] **7.2** Enhance Political Party Nepal template
  - Add `members` table with citizenship validation
  - Add `election_candidates` table with Nepali fields
  - Add `financial_transactions` with NPR currency
  - Add audit trail tables for compliance
- [ ] **7.3** Implement bilingual field support
  - Nepali/English columns for names, addresses
  - Language-aware display in admin interface
  - Migration helpers for adding bilingual columns
- [ ] **7.4** Add Election Commission compliance features **<-- SKIP INITIALLY**
  - Quarterly reporting tables
  - Donation limits enforcement (NPR 1,000,000 per person)
  - Audit trail for all financial transactions
  - Export functionality for EC reports
- [ ] **7.5** Performance optimization
  - Template application under 30 seconds
  - Batch migration execution
  - Index optimization for large tables
  - Caching for template definitions

### **SKIP INITIALLY - Polish Features**
Phase 7.4 (EC Compliance) can be implemented as polish features post-MVP.

### **Deliverables**
- Complete Nepali political party template
- Election Commission compliance (post-MVP)
- Bilingual support
- Performance optimizations

---

## **📊 PHASE 8: TESTING & DOCUMENTATION**

### **Goals**
1. Achieve 80%+ test coverage
2. Create comprehensive documentation
3. Perform security audit
4. Prepare for production deployment

### **Tasks**
- [ ] **8.1** Complete test coverage
  - Unit tests for all domain entities
  - Feature tests for all user workflows
  - Integration tests for tenant database operations
  - Contract tests for module compatibility
- [ ] **8.2** Security audit
  - SQL injection prevention in custom migrations
  - Cross-tenant data access prevention
  - Admin permission validation
  - Rate limiting on provisioning actions
- [ ] **8.3** Create documentation
  - API documentation for provisioning endpoints
  - Template definition format specification
  - Module development guide
  - Admin user guide for template provisioning
- [ ] **8.4** Performance testing **<-- SKIP INITIALLY**
  - Load testing with multiple tenants
  - Migration execution time benchmarks
  - Database connection pool optimization
- [ ] **8.5** Deployment preparation **<-- SKIP INITIALLY**
  - Database migration scripts
  - Template storage deployment strategy
  - Rollback procedures
  - Monitoring and alerting setup

### **SKIP INITIALLY - Post-MVP**
Phase 8.4-8.5 (Performance/Deployment) can be done post-MVP.

### **Deliverables**
- 80%+ test coverage report
- Security audit report
- Complete documentation
- Performance benchmarks (post-MVP)
- Deployment checklist (post-MVP)

---

## **⚠️ RISK MITIGATION STRATEGY**

### **Risk 1: Tenant Database Connection Issues**
**Issue:** Connecting to tenant databases from PlatformContext
**Mitigation:** Use existing `TenantDatabaseManager` from TenantAuthContext (already tested and working)

### **Risk 2: Migration Rollback Complexity**
**Issue:** Rolling back failed migrations across multiple files
**Mitigation:**
- Store rollback SQL in migration history table for critical operations
- Each migration file transaction isolated
- Test rollback scenarios thoroughly

### **Risk 3: Template Version Conflicts**
**Issue:** What if template is updated after tenant applies it?
**Mitigation:**
- Store template version with tenant
- Provide migration path between versions (post-MVP feature)
- Use semantic versioning for templates

### **Risk 4: Election Module Dependency Resolution**
**Issue:** Election module might depend on tables created by template
**Mitigation:**
- Clear dependency declaration in `module.json`
- Validate dependencies before module application
- Provide clear error messages

---

## **📅 UPDATED IMPLEMENTATION TIMELINE**

### **WEEK 1: FOUNDATION & TEMPLATE SYSTEM (MVP CORE)**
- **Day 1-2:** Phase 0 - Exploration (understand existing code)
- **Day 3-4:** Phase 1 - Database Schema (landlord tables)
- **Day 5:** Phase 2 - Template Structure (Political Party Nepal)
- **Day 6-7:** Phase 3 - Core Service (TemplateProvisioningService)

**Week 1 Goal:** First working demo - landlord admin can apply template

### **WEEK 2: ADMIN UI & BASIC WORKFLOW (MVP COMPLETE)**
- **Day 8-9:** Phase 4 - Extend Admin Interface
- **Day 10-11:** Test Complete Workflow
- **Day 12-14:** Bug Fixes & Polish

**Week 2 Goal:** Complete MVP with admin interface

### **WEEK 3-4: MODULES & ADVANCED FEATURES (POST-MVP)**
- Phase 5 - Module Integration (Election module)
- Phase 6 - Custom Migrations
- Phase 7 - Nepali Context & Polish
- Phase 8 - Testing & Documentation

---

## **✅ CRITICAL SUCCESS FACTORS**

### **1. MVP Success Criteria**
- [ ] Landlord admin visits `/admin/tenant-applications/{uuid}`
- [ ] Sees "Apply Template" section with "Political Party Nepal" option
- [ ] Applies template successfully
- [ ] `political_parties` table exists in tenant database
- [ ] Migration history recorded in landlord database
- [ ] All tests pass (80%+ coverage)

### **2. Key Technical Decisions Made**
- **Context:** PlatformContext (confirmed)
- **Template Storage:** Filesystem (`storage/app/templates/`)
- **Migration Format:** Raw SQL files for MVP
- **Rollback Strategy:** Store rollback SQL in migration history
- **Dependency Resolution:** Simple topological sort (Kahn's algorithm)

### **3. Testing Strategy**
```php
// Test categories:
// 1. Unit tests - Domain entities, value objects
// 2. Feature tests - Complete user workflows
// 3. Integration tests - Tenant database operations
// 4. Contract tests - Module compatibility promises

// Special test database for tenants:
config(['database.connections.tenant_test' => [
    'driver' => 'mysql',
    'database' => 'test_tenant_template',
    // ... other config
]]);
```

---

## **🚀 IMMEDIATE NEXT STEPS**

### **1. Execute Phase 0.1 (Today)**
```bash
# Explore existing PlatformContext
cat app/Contexts/Platform/Application/Services/TemplateProvisioningService.php
cat app/Contexts/Platform/Infrastructure/Http/Controllers/TenantApplicationController.php

# Check existing tenants
php artisan tenants:list
```

### **2. Write First Failing Test**
```php
// tests/Feature/Platform/TemplateProvisioning/BasicTemplateTest.php
public function test_template_structure_can_be_loaded()
{
    // Test that template.json can be loaded and parsed
    $this->assertFileExists(storage_path('app/templates/categories/political_party_nepal/template.json'));

    $template = json_decode(
        file_get_contents(storage_path('app/templates/categories/political_party_nepal/template.json')),
        true
    );

    $this->assertArrayHasKey('slug', $template);
    $this->assertEquals('political_party_nepal', $template['slug']);
}
```

### **3. Create Template Directory**
```bash
mkdir -p storage/app/templates/categories/political_party_nepal/migrations
```

---

## **✅ APPROVAL CHECKLIST**

Before starting implementation, confirm:

- [x] **Context:** PlatformContext is correct for landlord admin operations ✅
- [ ] **Template Storage:** `storage/app/templates/` structure is agreed
- [ ] **First Template:** Political Party Nepal with 5 core tables (raw SQL)
- [ ] **Admin Interface:** Extending existing `/admin/tenant-applications/{uuid}` page
- [ ] **Testing:** TDD approach with tenant database tests
- [ ] **Timeline:** Week 1-2 for basic functionality (MVP)

---

## **📝 DECISION LOG**

### **Key Decisions**
1. **Context:** PlatformContext (landlord admin operations), not TenantAuthContext
2. **Storage:** `storage/app/templates/` external template storage (filesystem)
3. **Migration Format:** Raw SQL files for MVP simplicity
4. **Algorithms:** Simple topological sort for dependencies, no SAT/ML over-engineering
5. **Safety:** SQL validation for custom migrations, store rollback SQL
6. **Performance:** Target 30 seconds for template application

### **Post-MVP Features**
1. Custom migrations with approval workflow
2. Election Commission compliance features
3. Performance optimization and load testing
4. Deployment automation

---

## **🔗 REFERENCES**

1. `20251216_2156_update_to_todos_claude_plan.md` - Senior Architect Review
2. `20251216_2129_extranal_tempaltes.md` - Detailed implementation plan
3. `20251216_2129_which_context_platform_vs_teanantauth.md` - Context boundary analysis
4. `20251216_2128_analysis_of_current_architecture.md` - Current DDD structure
5. `20251216_2126_claude_cli_instructions_check.md` - Business requirements
6. `20251216_1823_algorthms_architecture_for_migration.md` - Algorithm options

---

**Next Step:** Begin implementation with Phase 0.1 (Exploration of existing PlatformContext).