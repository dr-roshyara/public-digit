# Multi-Tenancy Template System - Developer Guide

**Version:** 1.0.0
**Last Updated:** December 12, 2025
**Author:** Platform Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Documentation Index](#documentation-index)
5. [Getting Help](#getting-help)

---

## Overview

This guide documents the complete **Template-Based Multi-Tenancy System** for the Public Digit Platform. This system enables automated provisioning of tenant databases using pre-configured templates with modular architecture.

### What This System Does

- ✅ **Template-Based Provisioning**: Apply database templates to new tenants automatically
- ✅ **Modular Architecture**: Install required and optional modules (RBAC, Elections, Finance)
- ✅ **Schema Drift Detection**: Track customizations and deviations from templates
- ✅ **Version Management**: Update tenants to new template versions
- ✅ **Audit Trail**: Complete history of all provisioning actions
- ✅ **Nepali Political Party Support**: Pre-built template for Nepali political organizations

### Current Implementation Status

| Component | Status | Description |
|-----------|--------|-------------|
| **Template Management** | ✅ Complete | Landlord database schema for templates |
| **RBAC Module** | ✅ Complete | Role-based access control with tenant isolation |
| **Political Party Template** | ✅ Complete | 10 tables for Nepali political party management |
| **Provisioning Service** | ✅ Complete | Automated template application service |
| **Models & Relationships** | ✅ Complete | Eloquent models with full relationships |
| **Template Seeder** | ✅ Complete | Seeds templates into landlord database |
| **Testing** | ✅ Verified | Template applied successfully to test tenant |
| **Artisan Commands** | 🔄 Pending | CLI commands for template management |
| **Admin UI** | 🔄 Pending | Web interface for template selection |
| **Constituencies Data** | 🔄 Pending | Nepal's 495 constituencies seed data |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LANDLORD DATABASE                            │
├─────────────────────────────────────────────────────────────────┤
│  Templates:                                                      │
│  ├─ tenant_templates          (Template definitions)            │
│  ├─ template_modules          (Modular components)              │
│  ├─ template_versions         (Version tracking)                │
│  ├─ tenant_template_history   (Provisioning audit trail)        │
│  └─ tenants                   (Template metadata per tenant)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Template Application
┌─────────────────────────────────────────────────────────────────┐
│                TENANT DATABASES (tenant_xxx)                     │
├─────────────────────────────────────────────────────────────────┤
│  RBAC Module (5 tables):                                         │
│  ├─ permissions, roles, model_has_permissions                   │
│  ├─ model_has_roles, role_has_permissions                       │
│                                                                  │
│  Political Party Template (10 tables):                          │
│  ├─ party_members, party_committees, committee_members          │
│  ├─ constituencies, election_candidates                         │
│  ├─ donations, expenditures                                     │
│  ├─ party_events, event_attendances, settings                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

#### 1. Templates
A **template** is a pre-configured database schema with seed data. Templates define the core structure for a specific use case (e.g., Political Party, NGO, Business).

#### 2. Modules
**Modules** are reusable components that can be included in templates. Example: RBAC module provides role-based access control and can be used across all template types.

#### 3. Versions
**Versions** track template evolution. When a template is updated, a new version is created with migration SQL to upgrade existing tenants.

#### 4. Schema Drift
The system calculates a **schema hash** when provisioning. Later comparisons detect if tenants have made custom changes.

---

## Quick Start

### 1. Run Template Seeder

Load templates into the landlord database:

```bash
cd packages/laravel-backend
php artisan db:seed --class=TemplateSeeder
```

**Output:**
```
✅ RBAC Module created (ID: 1)
✅ Political Party Template created (ID: 1)
✅ Template Version 1.0.0 created (ID: 1)
```

### 2. Create a Test Tenant

```bash
php artisan tinker
```

```php
use App\Models\Tenant;
use Illuminate\Support\Str;

$tenant = Tenant::create([
    'id' => (string) Str::uuid(),
    'name' => 'Nepal Congress',
    'email' => 'admin@nc.org.np',
    'slug' => 'nepal-congress',
    'status' => 'active',
    'database_name' => 'tenant_nepal_congress',
]);

// Create tenant database
DB::statement('CREATE DATABASE tenant_nepal_congress CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
```

### 3. Apply Template

```php
use App\Contexts\Platform\Application\Services\TemplateProvisioningService;
use App\Models\TenantTemplate;

$service = new TemplateProvisioningService();
$template = TenantTemplate::where('slug', 'political_party')->first();

// Apply template
$history = $service->applyTemplate($tenant, $template);

echo "Status: {$history->status}\n";
echo "Duration: {$history->getDuration()} seconds\n";
```

**Result:**
```
Status: completed
Duration: 3 seconds

15 tables created:
  - 5 RBAC tables
  - 10 Political Party tables

18 settings configured
18 roles created
38 permissions created
```

### 4. Verify Template Application

```php
$tenant->refresh();

echo "Template: {$tenant->template->name}\n";
echo "Version: {$tenant->template_version}\n";
echo "Schema Status: {$tenant->schema_status}\n";
echo "Modules: " . count($tenant->selected_modules ?? []) . "\n";
```

---

## Documentation Index

### Core Documentation

1. **[01 - Architecture Overview](01-architecture-overview.md)**
   - System design and components
   - Database architecture
   - Template vs Module distinction
   - Decision trees

2. **[02 - Template System](02-template-system.md)**
   - Template structure and format
   - Creating custom templates
   - Template versioning
   - SQL file organization

3. **[03 - RBAC Module](03-rbac-module.md)**
   - Role-based access control implementation
   - Nepali political party roles
   - Permission system
   - Multi-tenant isolation

4. **[04 - Provisioning Service](04-provisioning-service.md)**
   - TemplateProvisioningService API
   - Template application workflow
   - Module installation
   - Version updates

5. **[05 - Models & Relationships](05-models-relationships.md)**
   - TenantTemplate model
   - TemplateModule model
   - TemplateVersion model
   - TenantTemplateHistory model
   - Tenant model extensions

6. **[06 - Political Party Template](06-political-party-template.md)**
   - 10 core tables documentation
   - Nepal-specific features
   - Election Commission compliance
   - Bilingual support

7. **[07 - Schema Drift Detection](07-schema-drift-detection.md)**
   - Hash calculation
   - Drift detection algorithms
   - Customization tracking
   - Sync management

8. **[08 - Testing Guide](08-testing-guide.md)**
   - TDD approach
   - Test coverage requirements
   - Sample tests
   - CI/CD integration

9. **[09 - API Reference](09-api-reference.md)**
   - Complete service API
   - Method signatures
   - Return types
   - Error handling

10. **[10 - Troubleshooting](10-troubleshooting.md)**
    - Common errors
    - Debugging techniques
    - Performance optimization
    - FAQ

### Additional Resources

- **[Examples](examples/)** - Working code examples
- **[Migration Guides](migration-guides/)** - Upgrading between versions
- **[Best Practices](best-practices.md)** - Development guidelines
- **[Changelog](CHANGELOG.md)** - Version history

---

## Project Structure

```
packages/laravel-backend/
├── app/
│   ├── Contexts/
│   │   └── Platform/
│   │       └── Application/
│   │           └── Services/
│   │               ├── TemplateProvisioningService.php
│   │               └── README_TEMPLATE_PROVISIONING.md
│   └── Models/
│       ├── Tenant.php
│       ├── TenantTemplate.php
│       ├── TemplateModule.php
│       ├── TemplateVersion.php
│       └── TenantTemplateHistory.php
│
├── database/
│   ├── migrations/
│   │   ├── 2025_12_11_000001_create_tenant_templates_table.php
│   │   ├── 2025_12_11_000002_create_template_modules_table.php
│   │   ├── 2025_12_11_000003_create_template_versions_table.php
│   │   ├── 2025_12_11_000004_add_template_columns_to_tenants_table.php
│   │   └── 2025_12_11_000005_create_tenant_template_history_table.php
│   │
│   ├── seeders/
│   │   └── TemplateSeeder.php
│   │
│   └── templates/
│       ├── political_party/
│       │   └── schema.sql
│       └── modules/
│           └── rbac/
│               ├── schema.sql
│               └── seed.sql
│
└── developer_guide/
    └── laravel-backend/
        └── multi-tenancy/
            └── [This documentation]
```

---

## Getting Help

### Documentation

- Read the relevant section in this guide
- Check the troubleshooting guide
- Review working examples

### Code References

- Service: `app/Contexts/Platform/Application/Services/TemplateProvisioningService.php`
- Models: `app/Models/TenantTemplate.php` and related
- Templates: `database/templates/`

### Testing

Run the test suite:

```bash
php artisan test --filter Template
php artisan test --filter Tenant
```

### Logging

Check logs for detailed provisioning information:

```bash
tail -f storage/logs/laravel.log | grep "template provisioning"
tail -f storage/logs/laravel.log | grep "SQL execution"
```

---

## Contributing

When adding new features to the multi-tenancy system:

1. ✅ Write tests first (TDD approach)
2. ✅ Update documentation
3. ✅ Follow DDD principles
4. ✅ Maintain 80%+ test coverage
5. ✅ Update CHANGELOG.md

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-12 | Initial release with Political Party template and RBAC module |

---

**Next:** [01 - Architecture Overview](01-architecture-overview.md)
