# 🎯 **TENANT TEMPLATE PROVISIONING SYSTEM - TODO PLAN**

**Created:** 2025-12-16
**Based on:** Analysis of 5 architecture documents (see folder)
**Approach:** TDD First, DDD Principles, 80%+ Test Coverage
**Context:** PlatformContext (Landlord Admin Operations)
**Primary Template:** Political Party Nepal
**Phases:** 8 phases with incremental delivery

---

## **📋 OVERVIEW**

### **Business Requirement**
Extend the existing multi-tenant SaaS platform to support **template-driven schema evolution** with **manual landlord admin control**. The system must support 4-layer migration strategy:

1. **Category Templates** - Pre-defined schemas (Political Party Nepal)
2. **Module Migrations** - Add modules like Election to tenant databases
3. **Custom Migrations** - Tenant-specific schema modifications
4. **Individual Migrations** - Ad-hoc changes with approval workflow

### **Architectural Decision**
- **PlatformContext** (Landlord operations) - Correct context for landlord admin template provisioning
- **TenantAuthContext** (Tenant operations) - Not used for template provisioning (tenant users shouldn't provision templates)
- **Template Storage:** `storage/app/templates/` (landlord storage)
- **Admin Interface:** Extend existing `/admin/tenant-applications/{uuid}` page

### **Development Methodology**
- **TDD First:** Write failing tests before implementation
- **DDD Principles:** Use existing bounded contexts, extend don't rewrite
- **Tenant Isolation:** Maintain 100% tenant data isolation
- **Security:** Prevent SQL injection, validate admin permissions
- **Performance:** Template application under 30 seconds

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
- [ ] **0.3** Examine existing `ElectionContext`
  - Understand how election module migrations work
  - Identify how to make it template-aware
- [ ] **0.4** Set up test database for tenant operations
  - Configure separate test tenant database
  - Ensure tenant isolation can be tested
- [ ] **0.5** Create baseline test suite structure
  - `tests/Feature/Platform/TemplateProvisioning/`
  - `tests/Unit/Platform/Domain/`
  - Configure PHPUnit for tenant database switching

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
- [ ] **1.2** Create landlord database migrations
  ```sql
  -- tenant_applied_templates (track which templates applied to each tenant)
  -- tenant_applied_modules (track which modules applied)
  -- tenant_migration_history (audit trail for all migrations)
  -- tenant_custom_migrations (custom migration requests)
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
  │       │   ├── 001_create_political_parties_table.php
  │       │   ├── 002_create_party_committees_table.php
  │       │   ├── 003_create_committee_members_table.php
  │       │   ├── 004_create_nepali_provinces_table.php
  │       │   └── 005_create_nepali_districts_table.php
  │       └── seeders/
  │           └── seed_nepali_administrative_data.php
  └── modules/
      └── election/
          ├── module.json
          └── migrations/
  ```
- [ ] **2.3** Create `template.json` for Political Party Nepal
  - Include metadata: slug, name, version, description
  - Specify Nepali context requirements
  - List migration files in correct order
  - List compatible modules
- [ ] **2.4** Create migration files for political party schema
  - `political_parties` table (core party info)
  - `party_committees` table (central, provincial, district, ward)
  - `committee_members` table (roles, terms)
  - `provinces` table (7 provinces with Nepali/English names)
  - `districts` table (77 districts with hierarchy)
  - `financial_reports` table (Election Commission compliance)
  - `donation_records` table (NPR limits, citizenship validation)
- [ ] **2.5** Create Nepali administrative data seeders
  - Seed 7 provinces with correct Nepali names
  - Seed 77 districts with province relationships
  - Use authentic Nepali data

### **Deliverables**
- Complete Political Party Nepal template with migrations
- Template definition format
- Nepali administrative data seeders
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
- [ ] **3.3** Implement migration execution logic
  - Load migration files from template storage
  - Execute raw SQL or Laravel migration classes
  - Track execution time
  - Validate SQL safety for custom migrations
- [ ] **3.4** Implement migration history logging
  - Log each migration attempt (success/failure)
  - Store who applied it, when, execution time
  - Store migration hash for integrity verification
- [ ] **3.5** Implement template compatibility validation
  - Check tenant status (must have basic migrations)
  - Check if template already applied
  - Validate admin permissions

### **Deliverables**
- Fully functional `TemplateProvisioningService`
- Migration execution with transaction safety
- Complete audit trail
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
- [ ] **5.2** Make Election module template-aware
  - Add `isCompatibleWith(string $templateSlug): bool` method
  - Add `getRequiredDependencies(): array` method
  - Update ElectionContext service to check compatibility
- [ ] **5.3** Implement module dependency resolution
  - Simple topological sort (Kahn's algorithm)
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
  - Block dangerous operations: `DROP DATABASE`, `TRUNCATE`
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
- [ ] **7.4** Add Election Commission compliance features
  - Quarterly reporting tables
  - Donation limits enforcement (NPR 1,000,000 per person)
  - Audit trail for all financial transactions
  - Export functionality for EC reports
- [ ] **7.5** Performance optimization
  - Template application under 30 seconds
  - Batch migration execution
  - Index optimization for large tables
  - Caching for template definitions

### **Deliverables**
- Complete Nepali political party template
- Election Commission compliance
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
- [ ] **8.4** Performance testing
  - Load testing with multiple tenants
  - Migration execution time benchmarks
  - Database connection pool optimization
- [ ] **8.5** Deployment preparation
  - Database migration scripts
  - Template storage deployment strategy
  - Rollback procedures
  - Monitoring and alerting setup

### **Deliverables**
- 80%+ test coverage report
- Security audit report
- Complete documentation
- Performance benchmarks
- Deployment checklist

---

## **📅 IMPLEMENTATION PRIORITIES**

### **Week 1-2: Foundation (Phases 0-3)**
- Understand codebase, create domain models, implement Political Party Nepal template, create provisioning service

### **Week 3-4: UI & Modules (Phases 4-5)**
- Extend admin interface, make Election module template-aware, implement module provisioning

### **Week 5-6: Customizations & Nepali Context (Phases 6-7)**
- Implement custom migrations, add Nepali compliance features, bilingual support

### **Week 7-8: Polish & Deployment (Phase 8)**
- Complete testing, security audit, documentation, performance optimization

---

## **🔧 TECHNICAL CONSTRAINTS**

### **Must Preserve**
1. **Existing tenant authentication** - Don't break tenant login
2. **Database isolation** - 100% tenant data segregation
3. **DDD context boundaries** - Use existing patterns
4. **Admin manual control** - Business requirement
5. **Laravel 12 compatibility** - No Doctrine DBAL

### **Must Avoid**
1. **Over-engineering** - Simple algorithms over SAT solvers
2. **Breaking changes** - Extend, don't rewrite existing functionality
3. **Cross-tenant contamination** - Strict tenant isolation
4. **Security vulnerabilities** - Validate all inputs, prevent SQL injection

---

## **✅ SUCCESS CRITERIA**

1. **Business:** Landlord admin can apply "Political Party Nepal" template to tenant via admin interface
2. **Technical:** Template application creates all political party tables in tenant database
3. **Integration:** Election module can be added to templated tenant
4. **Customization:** Custom SQL migrations can be executed on specific tenants
5. **Audit:** All migrations logged with who/when/what
6. **Performance:** Template application completes under 30 seconds
7. **Quality:** 80%+ test coverage, no critical security issues
8. **Documentation:** Complete admin and developer guides

---

## **🚀 STARTING POINT**

**Immediate next tasks (Phase 0):**

1. **Examine existing PlatformContext structure**
   ```bash
   # Locate existing files
   find app/Contexts/Platform -name "*.php" | grep -i "template\|provision"
   ```

2. **Set up test environment**
   ```bash
   # Create test tenant database
   php artisan tenants:artisan "migrate:fresh --seed" --tenant=test_template
   ```

3. **Write first failing test**
   ```php
   // tests/Feature/Platform/TemplateProvisioning/TemplateApplicationTest.php
   public function test_landlord_admin_can_apply_template_to_tenant(): void
   {
       // Given: landlord admin, tenant, template
       // When: POST to apply-template endpoint
       // Then: tenant.template_slug is set
       // Then: migration history recorded
       // Then: political_parties table exists in tenant DB
   }
   ```

---

## **📝 DECISION LOG**

### **Key Decisions**
1. **Context:** PlatformContext (landlord admin operations), not TenantAuthContext
2. **Storage:** `storage/app/templates/` external template storage
3. **Algorithms:** Simple topological sort for dependencies, no SAT/ML over-engineering
4. **Safety:** SQL validation for custom migrations, approval workflow for dangerous operations
5. **Performance:** Target 30 seconds for template application

### **Open Questions**
1. How to handle template versioning and updates?
2. How to handle conflicts when applying modules with overlapping migrations?
3. How to provide preview of schema changes before application?
4. How to handle rollback of template applications?

---

## **🔗 REFERENCES**

1. `20251216_2129_extranal_tempaltes.md` - Detailed implementation plan
2. `20251216_2129_which_context_platform_vs_teanantauth.md` - Context boundary analysis
3. `20251216_2128_analysis_of_current_architecture.md` - Current DDD structure
4. `20251216_2126_claude_cli_instructions_check.md` - Business requirements
5. `20251216_1823_algorthms_architecture_for_migration.md` - Algorithm options

---

**Next Step:** User review and approval of this plan before implementation begins.