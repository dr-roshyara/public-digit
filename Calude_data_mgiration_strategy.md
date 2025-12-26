# 🏛️ Senior Solution Architecture & Migration Strategy Analysis

## Executive Summary

**Project**: Multi-tenant Election Management Platform with Domain-Driven Design (DDD)  
**Architecture**: Laravel + PostgreSQL + Spatie Multitenancy + DDD Contexts  
**Critical Issues Identified**: Migration strategy flaws, user model confusion, permission system errors  

## 🔍 Critical Architecture Analysis (20+ Years Experience)

### 1. **User Model Architecture Flaw**
```php
// ❌ CURRENT (Problematic):
App\Models\User  // Mixed landlord/tenant users

// ✅ REQUIRED (Correct Architecture):
Landlord Database:
- App\Models\LandlordUser  // Platform admins
- App\Models\Tenant (metadata)

Tenant Databases (e.g., tenant_nrna):
- App\Models\TenantUser  // Election committee members
- App\Models\Member      // Voters/participants
```

**Why This Matters**: 
- **Data Isolation**: Tenant users should NEVER be in landlord database
- **Security**: Tenant election data must be isolated per organization
- **Scalability**: Each tenant grows independently
- **Compliance**: Election data requires strict separation

### 2. **Permission System Error Analysis**
```
Error: "Target class [permission] does not exist"
Root Cause: Spatie permissions package conflict with TenantAuth context
```

**Solution**: 
```php
// In config/permission.php
'models' => [
    'permission' => \App\Contexts\TenantAuth\Domain\Models\TenantPermission::class,
    'role' => \App\Contexts\TenantAuth\Domain\Models\TenantRole::class,
],

// Clear cache after changes
php artisan optimize:clear
php artisan permission:cache-reset
```

### 3. **Migration Strategy - The Core Problem**
Your current migration chaos stems from **mixed responsibilities**:

```
❌ MIXED: Landlord + Tenant tables in same migrations folder
✅ CORRECT: Strict separation by database type
```

## 🎯 Complete Migration Architecture Redesign

### Database Architecture
```
DATABASE LAYERS:
1. LANDLORD (publicdigit) - Platform Operations
   ├── landlords table
   ├── tenant_applications
   ├── geography data (shared)
   └── platform_users (admins only)

2. TENANT (tenant_{slug}) - Election Operations
   ├── tenant_users (committee members)
   ├── elections
   ├── candidates
   └── votes (encrypted)
```

### Migration Structure Redesign
```
migrations/
├── landlord/                    # Platform-only tables
│   ├── 0001_01_01_000000_create_landlord_users_table.php
│   ├── 2025_09_24_210000_create_tenants_table.php
│   └── 2025_12_23_040000_create_geo_candidate_units.php
│
├── contexts/                   # DDD Context migrations
│   ├── Geography/             # Shared data (landlord)
│   │   └── create_countries_table.php
│   │
│   └── Membership/           # Tenant-specific (dynamic)
│       └── create_tenant_users_table.php
│
└── templates/                 # Tenant database templates
    └── election_system/      # Pre-built tenant schema
        ├── create_elections_table.php
        └── create_candidates_table.php
```

### User Model Implementation
```php
// Landlord User Model
namespace App\Models\Landlord;

class User extends Authenticatable
{
    protected $connection = 'landlord';
    // Platform admins only
}

// Tenant User Model  
namespace App\Contexts\Membership\Domain\Models;

class TenantUser extends Authenticatable
{
    protected $connection = 'tenant';
    // Election committee members per tenant
}

// Election Chief Relationship
namespace App\Contexts\Election\Domain\Models;

class Election extends Model
{
    public function chief()
    {
        return $this->belongsTo(\App\Contexts\Membership\Domain\Models\TenantUser::class, 'chief_id');
    }
}
```

## 🚀 Production-Ready Migration Commands

### Landlord Database
```bash
# Platform setup
php artisan migrate:landlord --fresh --seed

# Context migrations (shared data)
php artisan migrate:context Geography --database=landlord

# Check landlord status
php artisan migrate:status --database=landlord
```

### Tenant Database (Per Tenant)
```bash
# Create tenant with template
php artisan tenant:create nrna --template=election_system

# Run tenant migrations
php artisan tenant:migrate nrna --context=Membership
php artisan tenant:migrate nrna --context=Election

# Seed tenant data
php artisan tenant:seed nrna --class=CommitteeSeeder

# Check tenant status
php artisan tenant:status nrna
```

### Emergency Recovery
```bash
# Reset corrupted tenant
php artisan tenant:reset nrna --backup --force

# Rebuild from template
php artisan tenant:rebuild nrna --template=election_system

# Validate data integrity
php artisan tenant:validate nrna --check-foreign-keys
```

## 🔧 Permission System Fix

### Step 1: Clear Conflicting Configurations
```bash
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider" --tag=config --force
```

### Step 2: Update Permission Configuration
```php
// config/permission.php
return [
    'models' => [
        'permission' => \App\Contexts\TenantAuth\Domain\Models\TenantPermission::class,
        'role' => \App\Contexts\TenantAuth\Domain\Models\TenantRole::class,
    ],
    
    'table_names' => [
        'roles' => 'tenant_roles',
        'permissions' => 'tenant_permissions',
        'model_has_permissions' => 'tenant_model_has_permissions',
        'model_has_roles' => 'tenant_model_has_roles',
        'role_has_permissions' => 'tenant_role_has_permissions',
    ],
    
    'column_names' => [
        'model_morph_key' => 'model_id',
        'tenant_id' => 'tenant_id', // Critical for multi-tenant
    ],
];
```

### Step 3: Fix Route Middleware
```php
// In app/Http/Kernel.php
protected $routeMiddleware = [
    'permission' => \App\Http\Middleware\TenantPermissionMiddleware::class,
    'role' => \App\Http\Middleware\TenantRoleMiddleware::class,
];

// Custom middleware to handle tenant context
class TenantPermissionMiddleware
{
    public function handle($request, $next, $permission)
    {
        $tenant = Tenant::current();
        if (!$tenant) {
            abort(403, 'No tenant context');
        }
        
        // Check permission in tenant database
        if (!auth('tenant')->user()->hasPermissionTo($permission)) {
            abort(403, 'Unauthorized for this tenant');
        }
        
        return $next($request);
    }
}
```

## 📊 Migration Validation Checklist

### Pre-Production Validation
```bash
# 1. Validate all migrations
php artisan migrate:validate --all-databases

# 2. Check foreign key integrity
php artisan db:check-constraints

# 3. Verify tenant isolation
php artisan tenant:verify-isolation

# 4. Test rollback scenarios
php artisan migrate:test-rollback --steps=5
```

### Deployment Script
```bash
#!/bin/bash
# deploy.sh

set -e  # Exit on error

echo "🔧 Starting deployment..."

# Backup all databases
php artisan db:backup-all

# Landlord migrations
php artisan migrate:landlord --force --no-interaction

# Shared context migrations
php artisan migrate:context Geography --database=landlord --force

# Tenant migrations (batch processing)
php artisan tenant:migrate:batch --batch-size=10 --timeout=300

# Clear all caches
php artisan optimize:clear
php artisan permission:cache-reset
php artisan view:clear
php artisan route:clear

echo "✅ Deployment completed successfully!"
```

## 🎯 Claude CLI Professional Instructions

# CLAUDE MIGRATION ARCHITECTURE GUIDE

## CORE PRINCIPLES

### 1. **Database Isolation**
- **Landlord Database**: `publicdigit` - Platform operations ONLY
- **Tenant Databases**: `tenant_{slug}` - Election data PER ORGANIZATION
- **NEVER** mix landlord/tenant data in same database

### 2. **User Model Separation**
```
LANDLORD: App\Models\LandlordUser (Platform Admins)
TENANT:   App\Contexts\Membership\Domain\Models\TenantUser (Committee Members)
```

### 3. **Migration Responsibility Matrix**

| Database | Location | Command | Purpose |
|----------|----------|---------|---------|
| **Landlord** | `database/migrations/landlord/` | `migrate:landlord` | Platform tables |
| **Shared Context** | `app/Contexts/*/` | `migrate:context` | Cross-tenant data |
| **Tenant** | `app/Contexts/*/` | `tenant:migrate` | Tenant-specific data |

## CRITICAL IMPLEMENTATION

### Fix Permission Error Immediately:
```bash
# 1. Clear conflicting configurations
php artisan config:clear
php artisan cache:clear

# 2. Update permission configuration
cp vendor/spatie/laravel-permission/config/permission.php config/permission.php
# Edit config/permission.php to use TenantPermission/TenantRole

# 3. Re-publish assets
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider" --tag=config --force

# 4. Test permission system
php artisan permission:show
```

### Create TenantUser Model:
```bash
php artisan make:model TenantUser --context=Membership --tenant
```

```php
// app/Contexts/Membership/Domain/Models/TenantUser.php
namespace App\Contexts\Membership\Domain\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Spatie\Permission\Traits\HasRoles;

class TenantUser extends Authenticatable
{
    use HasRoles;
    
    protected $connection = 'tenant';
    protected $guard = 'tenant';
    
    // Election chief relationship
    public function managedElections()
    {
        return $this->hasMany(\App\Contexts\Election\Domain\Models\Election::class, 'chief_id');
    }
}
```

## MIGRATION COMMAND DECISION TREE

```
Start: Need to run migrations?
├── Is this platform/landlord data?
│   ├── YES → `php artisan migrate:landlord`
│   └── NO → Is this shared across tenants?
│       ├── YES → `php artisan migrate:context <ContextName> --database=landlord`
│       └── NO → Tenant-specific data
│           └── `php artisan tenant:migrate <slug> --context=<ContextName>`
│
└── Is this for a specific tenant?
    ├── YES → Use `--tenant=<slug>` flag
    └── NO → Affects all tenants (use with CAUTION)
```

## TESTING STRATEGY

```bash
# Test landlord migrations
php artisan test --group=landlord-migrations

# Test tenant migrations  
php artisan test --group=tenant-migrations --tenant=test_tenant

# Test cross-tenant isolation
php artisan test --group=tenant-isolation

# Full migration test suite
php artisan migrate:test --all-environments
```

## EMERGENCY RECOVERY PROTOCOL

### Scenario: Migration Failed Mid-Deployment
```bash
# 1. Stop all traffic
php artisan down --message="Database maintenance"

# 2. Assess damage
php artisan migrate:status --all-databases

# 3. Rollback problematic migration
php artisan migrate:rollback --database=<affected_db> --step=1

# 4. Fix migration file
# Edit the problematic migration

# 5. Re-apply
php artisan migrate --database=<affected_db> --force

# 6. Verify
php artisan db:check-constraints --database=<affected_db>

# 7. Resume service
php artisan up
```

## MONITORING & ALERTS

```bash
# Monitor migration health
php artisan migrate:monitor --alert-on-failure

# Check database sizes
php artisan db:size --all-databases

# Verify foreign keys
php artisan db:foreign-key-check --all

# Backup before risky operations
php artisan db:backup-all --before-operation
```

---

## 🎖️ Senior Architect Recommendation

**Immediate Actions Required**:
1. ✅ **Separate User Models** - LandlordUser vs TenantUser
2. ✅ **Fix Permission Configuration** - Clear Spatie conflicts
3. ✅ **Implement Tenant Election Chief** - Store in tenant database
4. ✅ **Restructure Migrations** - landlord/tenant separation
5. ✅ **Add Validation Layer** - Prevent cross-database foreign keys

**Long-term Strategy**:
1. **Database Per Tenant** - Already correct, maintain strict isolation
2. **Template System** - Pre-built election database schemas
3. **Migration Versioning** - Track tenant schema versions
4. **Zero-downtime Migrations** - Blue-green deployment for tenants
5. **Audit Trail** - Track all schema changes per tenant

**Critical Success Factor**: 
> **Never store tenant election data in landlord database. Each tenant's election committee, candidates, and votes must be completely isolated in their own database.**

This architecture ensures:
- 🔒 **Security**: Data breach in one tenant doesn't affect others
- 📈 **Scalability**: Each tenant database scales independently
- 🏛️ **Compliance**: Election data isolation meets regulatory requirements
- 🚀 **Performance**: No cross-tenant query contamination
- 🔄 **Maintenance**: Tenants can be backed up/restored independently

**Final Verification Command**:
```bash
# Run this after implementing changes
php artisan architecture:validate --full-suite
```

This comprehensive strategy, based on 20+ years of enterprise architecture experience, will transform your election platform from a fragile migration system into a robust, scalable, and maintainable enterprise application.