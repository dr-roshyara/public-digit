# 🏗️ **LANDLORD DATABASE CONTEXT ARCHITECTURE**  
*for Membership Digitalization Platform*

## 🎯 **ARCHITECTURAL VISION**

Based on your existing structure, we'll create a **Membership Context** that follows your established **DDD Platform Context** pattern. Here's how the Landlord database integrates with your current architecture:

```
platform_landlord/
├── 1. DDD_PLATFORM_CONTEXT/    ← NEW CONTEXT (Our focus)
│   ├── Domain/                  # Business logic, entities, value objects
│   ├── Application/             # Use cases, services, ports
│   ├── Infrastructure/          # Database, external adapters
│   └── Presentation/            # APIs, controllers
├── 2. HEXAGONAL_STRUCTURE/      # Legacy adapter layer
└── 3. DEFAULT_LARAVEL/          # Laravel migrations, models
```

---

## 📋 **CLAUDE CLI PROMPT INSTRUCTIONS**

### **🎯 GLOBAL CONTEXT PROMPT** (Start Every Session)

```text
You are a senior Laravel architect implementing a DDD Context for a political membership platform.

TECHNICAL CONTEXT:
- Laravel 12 + DDD + Multi-tenancy (Database-per-tenant)
- Existing Platform Context structure in `app/Contexts/Platform/`
- Landlord database manages global reference data (geography, skills, tenants)
- Tenant databases handle party-specific operational data

ARCHITECTURAL RULES:
1. Follow EXISTING Platform Context patterns from `app/Contexts/Platform/`
2. All Landlord tables go in DDD_PLATFORM_CONTEXT database
3. Reference data is IMMUTABLE (provinces, districts, skills)
4. NO business logic in Landlord - only reference/configuration
5. All timestamps use `created_at`, `updated_at`, `deleted_at`
6. Use UUIDv4 for all external references
7. Tenant isolation is ABSOLUTE - no cross-tenant queries

EXISTING PATTERNS TO FOLLOW:
- Value Objects: Email, PhoneNumber, TenantSlug (see `app/Contexts/Platform/`)
- State Machines: ApplicationStatus, TenantStatus
- Repository pattern with interfaces
- Domain Events for state changes
- Service classes in Application layer

OUTPUT REQUIREMENTS:
- Production-ready SQL migrations
- Corresponding Eloquent models in Infrastructure
- Value Objects in Domain
- Repository interfaces in Domain
- Service classes in Application
```

---

## **🛠️ PHASE 1: LANDLORD DATABASE MIGRATIONS**

### **Prompt 1.1: Core Geography Tables**

```text
CONTEXT:
Create the IMMUTABLE geographic reference tables for Nepal in the Landlord database.
These tables are read-only reference data for the entire platform.

REQUIREMENTS:
1. Create 4 hierarchical tables:
   - `geo_provinces` (7 fixed provinces)
   - `geo_districts` (77 fixed districts) 
   - `geo_local_levels` (753 municipalities/rural municipalities)
   - `geo_wards` (~6,743 wards)

2. Each table must:
   - Include bilingual columns (`name_en`, `name_np`)
   - Have standard government codes (ISO, CBS codes)
   - Include spatial data for mapping (latitude/longitude)
   - Support temporal validity for boundary changes
   - Be immutable (platform admins only can update)

3. Follow existing Platform Context patterns:
   - Use `created_at`, `updated_at`, `deleted_at`
   - Include `is_active` boolean flag
   - Add JSON metadata column for extensions
   - Use proper indexes for geographic queries

DELIVERABLES:
1. Complete SQL migration files
2. Eloquent models in `app/Contexts/Platform/Infrastructure/Models/`
3. Value Objects for geographic IDs in `app/Contexts/Platform/Domain/ValueObjects/`
4. Repository interface in `app/Contexts/Platform/Domain/Repositories/`

EXAMPLE EXISTING PATTERN (from your code):
- Look at `app/Contexts/Platform/Domain/ValueObjects/TenantSlug.php`
- Look at `app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantRepository.php`

CONSTRAINTS:
- NO business logic in models
- All geography data is seeded once
- Tables must support GIS queries (spatial indexes)
- Include audit columns: `created_by`, `updated_by`
```

### **Prompt 1.2: Global Taxonomies**

```text
CONTEXT:
Create global taxonomy tables that ALL tenants reference.
These are master lists that ensure consistency across parties.

REQUIREMENTS:
1. Create 4 taxonomy tables:
   - `global_skills` (Legal, Medical, Technical, etc.)
   - `global_id_types` (Citizenship, Passport, Voter ID)
   - `global_membership_types` (Regular, Youth, Lifetime templates)
   - `global_forum_categories` (Discussion category templates)

2. Each taxonomy must:
   - Be bilingual (`name_en`, `name_np`)
   - Have configuration templates (JSON) for tenant customization
   - Include display ordering and active flags
   - Support tenant-specific overrides (via template system)

3. Follow your existing TenantBranding pattern:
   - Reference `app/Contexts/TenantAuth/Domain/Entities/TenantBranding.php`
   - Use JSON columns for flexible configuration
   - Include `is_system_defined` flag for protected records

DELIVERABLES:
1. SQL migrations with proper foreign key relationships
2. Eloquent models with casting for JSON columns
3. Domain Value Objects for each taxonomy type
4. Repository interfaces with template loading methods

KEY INTEGRATION POINTS:
- Skills link to `app/Contexts/TenantAuth/` for member skills
- ID Types used in eKYC verification
- Membership Types template tenant's `membership_types`
- Forum Categories template tenant's `forum_categories`
```

### **Prompt 1.3: Platform Administration**

```text
CONTEXT:
Create platform management tables for multi-tenant administration.

REQUIREMENTS:
1. Create 4 administration tables:
   - `tenants` (Political party registry)
   - `tenant_admins` (Party administrators)
   - `platform_admins` (Super administrators)
   - `platform_settings` (Global configuration)

2. MUST integrate with existing code:
   - `tenants` table must work with `app/Contexts/Platform/Domain/Models/Tenant.php`
   - `platform_admins` must work with existing auth system
   - Settings must support your existing `app/Contexts/Shared/` patterns

3. Security requirements:
   - Encrypted columns for sensitive data (passwords, API keys)
   - Audit logging for all administrative actions
   - Role-based access control (RBAC) integration
   - Two-factor authentication support

DELIVERABLES:
1. Secure SQL migrations with encryption considerations
2. Models that extend existing base classes
3. Event listeners for audit logging
4. Integration with existing `app/Contexts/Shared/Infrastructure/Auth/`

CRITICAL INTEGRATIONS:
- Tenant provisioning workflow (see `app/Contexts/Platform/Application/Services/`)
- Database connection management (see `app/Contexts/Platform/Infrastructure/Database/`)
- Email notifications (see `app/Contexts/Platform/Infrastructure/Mail/`)
```

---

## **🏛️ PHASE 2: DOMAIN CONTEXT IMPLEMENTATION**

### **Prompt 2.1: Geography Domain Layer**

```text
CONTEXT:
Implement the Domain layer for geographic reference data.
This follows your existing DDD patterns in Platform Context.

REQUIREMENTS:
1. Create Domain structure:
   - Value Objects: `ProvinceId`, `DistrictId`, `WardId`, `GeoCode`
   - Entities: `Province`, `District`, `LocalLevel`, `Ward`
   - Specifications: `ActiveGeographySpecification`
   - Events: `GeographyUpdatedEvent`

2. Follow existing patterns from:
   - `app/Contexts/Platform/Domain/ValueObjects/` (Email, TenantSlug)
   - `app/Contexts/Platform/Domain/Models/` (Tenant model)
   - `app/Contexts/Platform/Domain/Events/` (existing events)

3. Domain rules:
   - Geography hierarchies are immutable
   - Boundary changes require new version + validity dates
   - All IDs must be validated against master list

DELIVERABLES:
1. Complete Domain layer following your existing structure
2. Integration tests for geographic validation
3. Factory classes for test data
4. Repository interfaces with geographic queries

EXAMPLE IMPLEMENTATION:
Look at how `TenantSlug` value object validates uniqueness.
Apply similar patterns to `GeoCode` value object.
```

### **Prompt 2.2: Taxonomy Domain Layer**

```text
CONTEXT:
Implement the Domain layer for global taxonomies.
These are reference data that tenants can customize.

REQUIREMENTS:
1. Create Domain structure:
   - Value Objects: `SkillId`, `SkillCategory`, `ProficiencyLevel`
   - Entities: `GlobalSkill`, `IDDocumentType`, `MembershipTemplate`
   - Services: `TaxonomyTemplateService`
   - Events: `TaxonomyUpdatedEvent`

2. Template system requirements:
   - Base templates in Landlord
   - Tenant can override specific fields
   - Audit trail of template customizations
   - Versioning support for template changes

3. Integration with existing TenantAuth:
   - Skills connect to `app/Contexts/TenantAuth/Domain/Entities/CommitteeUser.php`
   - ID Types used in `app/Contexts/TenantAuth/Domain/Models/TenantUser.php`
   - Membership templates seed tenant's `membership_types`

DELIVERABLES:
1. Domain layer with template inheritance pattern
2. Template customization service
3. Migration service to apply template updates
4. Validation rules for template overrides

PATTERN REFERENCE:
See `app/Contexts/TenantAuth/Domain/ValueObjects/` for how you handle
tenant-specific values that reference global data.
```

---

## **🔗 PHASE 3: INFRASTRUCTURE INTEGRATION**

### **Prompt 3.1: Database Migrations & Seeding**

```text
CONTEXT:
Create the actual Laravel migrations and seeders for Landlord database.
These must work with your existing migration system.

REQUIREMENTS:
1. Create migration files in:
   - `app/Contexts/Platform/Infrastructure/Database/Migrations/`

2. Follow your existing migration patterns:
   - Check `app/Contexts/Election/Infrastructure/Database/Migrations/`
   - Use `Schema::create` with proper indexes
   - Include `$table->timestamps()` and `$table->softDeletes()`
   - Add spatial indexes for geography columns

3. Create seeders for:
   - Nepal's 7 provinces, 77 districts, 753 local levels, ~6,743 wards
   - Global skills taxonomy (Legal, Medical, Technical, etc.)
   - ID document types (Citizenship, Passport, etc.)
   - Default platform settings

4. Integration requirements:
   - Must work with `app/Console/Commands/LandlordMigrateFresh.php`
   - Support rollback operations
   - Include data validation in seeders

DELIVERABLES:
1. Complete migration files with proper foreign keys
2. Seeder classes with data validation
3. Factory classes for test data
4. Migration rollback scripts

CRITICAL:
Test with your existing `LandlordMigrateFresh` command.
Ensure backward compatibility.
```

### **Prompt 3.2: Repository Implementation**

```text
CONTEXT:
Implement the Infrastructure layer repositories for Landlord data.
These must follow your existing repository patterns.

REQUIREMENTS:
1. Create Eloquent repositories in:
   - `app/Contexts/Platform/Infrastructure/Repositories/`

2. Follow existing repository patterns:
   - Check `app/Contexts/Platform/Infrastructure/Repositories/EloquentTenantRepository.php`
   - Implement interface from Domain layer
   - Use query scopes for active/inactive records
   - Include caching where appropriate

3. Repository methods needed:
   - Geographic queries (find by code, find by coordinates)
   - Taxonomy queries (find by category, search skills)
   - Tenant management queries
   - Platform statistics aggregation

4. Performance considerations:
   - Implement query caching for reference data
   - Use database indexes effectively
   - Support pagination for large datasets
   - Implement read/write separation if needed

DELIVERABLES:
1. Complete repository implementations
2. Query scope traits
   - `ActiveScope`, `GeographicScope`, `TaxonomyScope`
3. Caching layer implementation
4. Performance test suite

INTEGRATION:
Repositories must work with existing `app/Contexts/Shared/Infrastructure/TenantRepositoryFactory.php`
```

---

## **🎯 IMPLEMENTATION WORKFLOW**

### **Step-by-Step Execution Order:**

```bash
# 1. Start with Geography (Foundation)
claude "Create Landlord geography tables following Platform Context patterns"

# 2. Create Global Taxonomies
claude "Create global taxonomy tables with template system"

# 3. Platform Administration
claude "Create platform admin tables with security integration"

# 4. Domain Layer Implementation
claude "Implement Domain layer for geography and taxonomies"

# 5. Infrastructure Layer
claude "Create migrations, seeders, and repositories"

# 6. Integration Testing
claude "Create integration tests with existing Platform Context"
```

### **Verification Commands:**

```bash
# Test migration
php artisan landlord:migrate-fresh --seed

# Verify database structure
php artisan db:show --database=landlord

# Test repository patterns
php artisan tinker --execute="app('App\Contexts\Platform\Domain\Repositories\GeographyRepositoryInterface')->findProvinceByCode('NP-P1');"

# Run existing tests to ensure no breakage
php artisan test --testsuite=Platform
```

---

## **🔧 CRITICAL INTEGRATION POINTS**

### **1. Tenant Provisioning Integration**
```php
// Must work with existing provisioning service
// See: app/Contexts/Platform/Application/Services/TenantProvisioningService.php

class TenantProvisioningService {
    public function provision(TenantApplication $application) {
        // 1. Create tenant record in landlord.tenants
        // 2. Seed tenant database with geography references
        // 3. Apply taxonomy templates
        // 4. Setup initial administrators
    }
}
```

### **2. Geography Reference Integration**
```php
// Tenant models must reference landlord geography
// See: app/Contexts/TenantAuth/Domain/Models/TenantUser.php

class TenantUser {
    private LandlordProvinceId $provinceId;  // References landlord.geo_provinces.id
    private LandlordDistrictId $districtId;  // References landlord.geo_districts.id
    private LandlordWardId $wardId;         // References landlord.geo_wards.id
}
```

### **3. Template System Integration**
```php
// Tenant customization of global templates
// See: app/Contexts/TenantAuth/Domain/Entities/TenantBranding.php

class TenantMembershipType {
    private GlobalMembershipTypeId $templateId;  // References landlord.global_membership_types
    private array $customizations;               // Tenant-specific overrides
}
```

---

## **⚠️ CRITICAL WARNINGS**

1. **DO NOT** modify existing `app/Contexts/Platform/` interfaces
2. **DO NOT** break existing tenant provisioning flow
3. **DO** maintain backward compatibility with existing migrations
4. **DO** test with your existing `LandlordMigrateFresh` command
5. **DO** follow your established Value Object patterns (Email, TenantSlug)

## **📋 NEXT ACTION**

```bash
# Begin with Geography foundation
claude "Create the geo_provinces, geo_districts, geo_local_levels, and geo_wards 
tables for Landlord database following our Platform Context DDD patterns.
Include: bilingual names, government codes, spatial data, temporal validity.
Provide: SQL migrations, Eloquent models, Value Objects, and repository interface."
```

**Ready to start with the geography foundation?** This is the core reference data that everything else depends on.