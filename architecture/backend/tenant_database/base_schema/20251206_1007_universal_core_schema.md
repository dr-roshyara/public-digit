# 🏗️ **SENIOR ARCHITECT IMPLEMENTATION PLAN: UNIVERSAL CORE SCHEMA**

## 📋 **IMPLEMENTATION README FOR CLAUDE CLI**

**Copy and paste everything below this line into a new file and feed it to Claude CLI:**

---

# 🚀 **PROJECT: UNIVERSAL CORE SCHEMA IMPLEMENTATION**

## 🎯 **MISSION OVERVIEW**

You are a Senior Backend Architect implementing the **Universal Core Schema** for a multi-tenant SaaS platform. This schema will be deployed to EVERY tenant database (political parties, NGOs, corporations, churches, etc.).

## 📊 **ARCHITECTURAL PRINCIPLES**

### **Core Philosophy:**
1. **Universal First**: This schema works for ALL organization types
2. **Tenant Isolation**: Each tenant gets their own database with this schema
3. **Flexible Extension**: JSON fields allow organization-specific customization
4. **Performance Optimized**: Proper indexes, foreign keys, and constraints
5. **Audit Ready**: Complete audit trail and soft delete support

### **Schema Strategy:**
- **8 Universal Tables** deployed to every tenant
- **Zero theme-specific columns** in universal tables
- **JSON metadata fields** for future extension
- **Standardized naming conventions**
- **Comprehensive indexing strategy**

## 🗄️ **UNIVERSAL CORE SCHEMA - COMPLETE IMPLEMENTATION**

### **PHASE 1: DATABASE MIGRATION FILES**

Create these migration files in `database/migrations/universal/`:

**File 1: `2024_01_01_create_tenant_users_table.php`**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tenant_users', function (Blueprint $table) {
            // ============================================
            // PRIMARY IDENTIFICATION
            // ============================================
            $table->id();
            $table->uuid('uuid')->unique()->default(DB::raw('(UUID())'));
            
            // ============================================
            // CORE IDENTITY (Universal for all organizations)
            // ============================================
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email', 255)->unique();
            $table->string('phone', 20)->unique();
            $table->string('phone_country_code', 5)->default('+1');
            
            // ============================================
            // AUTHENTICATION & SECURITY
            // ============================================
            $table->string('password_hash', 255)->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('phone_verified_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            
            // Security features
            $table->unsignedInteger('failed_login_attempts')->default(0);
            $table->timestamp('locked_until')->nullable();
            $table->boolean('must_change_password')->default(false);
            
            // ============================================
            // STATUS & TENANT ISOLATION
            // ============================================
            $table->enum('status', [
                'pending',      // Registered but not verified
                'active',       // Fully active
                'inactive',     // Temporarily inactive
                'suspended',    // Suspended by admin
                'archived'      // Archived/removed
            ])->default('pending');
            
            // Tenant isolation - references landlord.tenants.id
            $table->unsignedBigInteger('tenant_id')->index();
            
            // ============================================
            // FLEXIBLE DATA STORAGE (JSON for extensibility)
            // ============================================
            $table->json('identity_data')->nullable()->comment('National ID, passport, etc.');
            $table->json('address_data')->nullable()->comment('Address information');
            $table->json('professional_data')->nullable()->comment('Profession, education, etc.');
            $table->json('communication_preferences')->nullable()->default('{"email": true, "sms": false, "push": true}');
            $table->json('metadata')->nullable()->comment('Organization-specific custom fields');
            
            // ============================================
            // AUDIT TRAIL
            // ============================================
            $table->unsignedBigInteger('created_by_id')->nullable()->comment('User who created this record');
            $table->unsignedBigInteger('updated_by_id')->nullable()->comment('User who last updated');
            
            // ============================================
            // TIMESTAMPS WITH SOFT DELETE
            // ============================================
            $table->timestamps();
            $table->softDeletes();
            
            // ============================================
            // INDEXES (Optimized for common queries)
            // ============================================
            $table->index('email');
            $table->index('phone');
            $table->index('status');
            $table->index('tenant_id');
            $table->index('created_at');
            $table->index(['last_name', 'first_name']);
            
            // Full-text search for names
            $table->fullText(['first_name', 'last_name']);
            
            // ============================================
            // COMMENTS FOR DOCUMENTATION
            // ============================================
            $table->comment('Universal user table for all tenant types: Political Parties, NGOs, Corporations, etc.');
        });
        
        // Add database-level constraints
        DB::statement('ALTER TABLE tenant_users ADD CONSTRAINT chk_tenant_users_email CHECK (email REGEXP "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$")');
        DB::statement('ALTER TABLE tenant_users ADD CONSTRAINT chk_tenant_users_phone CHECK (phone REGEXP "^\\\\+[0-9]{1,4}-[0-9]{6,15}$")');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenant_users');
    }
};
```

**File 2: `2024_01_02_create_organizational_units_table.php`**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('organizational_units', function (Blueprint $table) {
            // ============================================
            // PRIMARY IDENTIFICATION
            // ============================================
            $table->id();
            $table->uuid('uuid')->unique()->default(DB::raw('(UUID())'));
            
            // ============================================
            // HIERARCHY IMPLEMENTATION (Nested Set Pattern)
            // ============================================
            $table->unsignedBigInteger('parent_id')->nullable()->index();
            $table->integer('lft')->nullable()->index()->comment('Nested Set Left');
            $table->integer('rgt')->nullable()->index()->comment('Nested Set Right');
            $table->integer('depth')->default(0)->index()->comment('Depth in hierarchy');
            $table->string('materialized_path', 500)->nullable()->index()->comment('For fast hierarchical queries');
            
            // ============================================
            // UNIT IDENTIFICATION
            // ============================================
            $table->string('unit_type', 100)->index()->comment('branch, department, ward, cell, etc.');
            $table->string('code', 50)->comment('Unique identifier within parent');
            $table->string('name', 200);
            $table->text('description')->nullable();
            
            // ============================================
            // GEOGRAPHIC LOCATION (Flexible for all countries)
            // ============================================
            $table->json('location_data')->nullable()->comment('{"country": "Nepal", "province": "Bagmati", "district": "Kathmandu"}');
            
            // ============================================
            // LEADERSHIP (References tenant_users)
            // ============================================
            $table->unsignedBigInteger('leader_id')->nullable()->comment('References tenant_users.id');
            $table->string('leader_title', 100)->nullable();
            
            // ============================================
            // CONTACT INFORMATION
            // ============================================
            $table->json('contact_data')->nullable()->comment('{"email": "", "phone": "", "address": ""}');
            
            // ============================================
            // STATUS & TENANT ISOLATION
            // ============================================
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedBigInteger('tenant_id')->index();
            
            // ============================================
            // STATISTICS (Cached for performance)
            // ============================================
            $table->unsignedInteger('total_members')->default(0);
            $table->unsignedInteger('active_members')->default(0);
            
            // ============================================
            // METADATA & CONFIGURATION
            // ============================================
            $table->json('settings')->nullable()->comment('Unit-specific settings');
            $table->json('metadata')->nullable()->comment('Organization-specific data');
            
            // ============================================
            // AUDIT TRAIL
            // ============================================
            $table->unsignedBigInteger('created_by_id')->nullable();
            $table->unsignedBigInteger('updated_by_id')->nullable();
            
            // ============================================
            // TIMESTAMPS
            // ============================================
            $table->timestamps();
            $table->softDeletes();
            
            // ============================================
            // INDEXES (Optimized for hierarchical queries)
            // ============================================
            $table->index('parent_id');
            $table->index('lft');
            $table->index('rgt');
            $table->index('depth');
            $table->index('unit_type');
            $table->index('tenant_id');
            $table->index('is_active');
            $table->index('materialized_path');
            $table->unique(['parent_id', 'code']);
            
            // ============================================
            // FOREIGN KEYS
            // ============================================
            $table->foreign('parent_id')
                  ->references('id')
                  ->on('organizational_units')
                  ->onDelete('cascade');
                  
            $table->foreign('leader_id')
                  ->references('id')
                  ->on('tenant_users')
                  ->onDelete('set null');
            
            // ============================================
            // COMMENTS FOR DOCUMENTATION
            // ============================================
            $table->comment('Universal organizational hierarchy for all tenant types');
        });
        
        // Add trigger for materialized path (simplified version)
        DB::statement('
            CREATE TRIGGER organizational_units_path_trigger 
            BEFORE INSERT ON organizational_units 
            FOR EACH ROW 
            BEGIN
                IF NEW.parent_id IS NULL THEN
                    SET NEW.materialized_path = CONCAT("/", NEW.id);
                ELSE
                    SET NEW.materialized_path = CONCAT(
                        (SELECT materialized_path FROM organizational_units WHERE id = NEW.parent_id),
                        "/", NEW.id
                    );
                END IF;
            END
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS organizational_units_path_trigger');
        Schema::dropIfExists('organizational_units');
    }
};
```

**File 3: `2024_01_03_create_roles_table.php`**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            // ============================================
            // PRIMARY IDENTIFICATION
            // ============================================
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            
            // ============================================
            // ROLE PROPERTIES
            // ============================================
            $table->enum('scope_type', ['global', 'unit'])->default('unit')->index();
            $table->boolean('is_system_role')->default(false)->index();
            $table->unsignedInteger('hierarchy_level')->nullable()->comment('For ordering in UI');
            
            // ============================================
            // TENANT ISOLATION
            // ============================================
            $table->unsignedBigInteger('tenant_id')->index();
            
            // ============================================
            // DEFAULT PERMISSIONS TEMPLATE
            // ============================================
            $table->json('default_permissions')->nullable()->comment('Default permissions for this role');
            
            // ============================================
            // METADATA
            // ============================================
            $table->json('metadata')->nullable();
            
            // ============================================
            // TIMESTAMPS
            // ============================================
            $table->timestamps();
            $table->softDeletes();
            
            // ============================================
            // INDEXES
            // ============================================
            $table->index('code');
            $table->index('scope_type');
            $table->index('tenant_id');
            $table->index('is_system_role');
            $table->index(['tenant_id', 'code']);
            
            // ============================================
            // COMMENTS FOR DOCUMENTATION
            // ============================================
            $table->comment('Role definitions for RBAC system');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
```

**File 4: `2024_01_04_create_permissions_table.php`**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            // ============================================
            // PRIMARY IDENTIFICATION
            // ============================================
            $table->id();
            $table->string('code', 100)->unique();
            $table->string('name', 200);
            $table->text('description')->nullable();
            
            // ============================================
            // PERMISSION PROPERTIES
            // ============================================
            $table->string('module', 50)->index()->comment('membership, finance, communication, etc.');
            $table->string('submodule', 50)->nullable()->index();
            $table->string('action', 50)->index()->comment('create, read, update, delete, manage, approve');
            $table->string('resource', 50)->nullable()->index()->comment('user, unit, document, etc.');
            
            $table->enum('scope_type', ['global', 'unit', 'self'])->default('unit')->index();
            $table->boolean('is_system_permission')->default(false)->index();
            $table->boolean('is_critical')->default(false)->comment('Critical security permissions');
            
            // ============================================
            // TENANT ISOLATION
            // ============================================
            $table->unsignedBigInteger('tenant_id')->index();
            
            // ============================================
            // METADATA
            // ============================================
            $table->json('metadata')->nullable();
            
            // ============================================
            // TIMESTAMPS
            // ============================================
            $table->timestamps();
            $table->softDeletes();
            
            // ============================================
            // INDEXES (Optimized for permission checks)
            // ============================================
            $table->index('code');
            $table->index('module');
            $table->index('action');
            $table->index('scope_type');
            $table->index('tenant_id');
            $table->index(['module', 'action', 'resource']);
            $table->index(['tenant_id', 'module', 'action']);
            $table->unique(['code', 'tenant_id']);
            
            // ============================================
            // COMMENTS FOR DOCUMENTATION
            // ============================================
            $table->comment('Permission definitions for RBAC system');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('permissions');
    }
};
```

**File 5: `2024_01_05_create_role_permissions_table.php`**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('role_permissions', function (Blueprint $table) {
            // ============================================
            // COMPOSITE PRIMARY KEY
            // ============================================
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('permission_id');
            
            // ============================================
            // PERMISSION GRANT PROPERTIES
            // ============================================
            $table->enum('grant_type', ['allow', 'deny', 'conditional'])->default('allow');
            $table->json('conditions')->nullable()->comment('Additional conditions for conditional grants');
            
            // ============================================
            // AUDIT TRAIL
            // ============================================
            $table->unsignedBigInteger('granted_by_id')->nullable();
            $table->timestamp('granted_at')->useCurrent();
            
            // ============================================
            // TIMESTAMPS
            // ============================================
            $table->timestamps();
            
            // ============================================
            // PRIMARY KEY & INDEXES
            // ============================================
            $table->primary(['role_id', 'permission_id']);
            $table->index('role_id');
            $table->index('permission_id');
            $table->index('grant_type');
            
            // ============================================
            // FOREIGN KEYS (CASCADE on delete)
            // ============================================
            $table->foreign('role_id')
                  ->references('id')
                  ->on('roles')
                  ->onDelete('cascade');
                  
            $table->foreign('permission_id')
                  ->references('id')
                  ->on('permissions')
                  ->onDelete('cascade');
                  
            $table->foreign('granted_by_id')
                  ->references('id')
                  ->on('tenant_users')
                  ->onDelete('set null');
            
            // ============================================
            // COMMENTS FOR DOCUMENTATION
            // ============================================
            $table->comment('Role-Permission mapping for RBAC system');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
    }
};
```

**File 6: `2024_01_06_create_role_assignments_table.php`**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('role_assignments', function (Blueprint $table) {
            // ============================================
            // PRIMARY IDENTIFICATION
            // ============================================
            $table->id();
            $table->uuid('uuid')->unique()->default(DB::raw('(UUID())'));
            
            // ============================================
            // ASSIGNMENT CORE
            // ============================================
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('organizational_unit_id')->nullable()->comment('NULL for global roles');
            
            // ============================================
            // CONTEXT & SCOPE
            // ============================================
            $table->string('context_type', 50)->nullable()->default('unit')->comment('unit, project, committee, etc.');
            $table->unsignedBigInteger('context_id')->nullable();
            
            // ============================================
            // TERM & VALIDITY
            // ============================================
            $table->date('term_start_date')->nullable();
            $table->date('term_end_date')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_acting')->default(false)->comment('Acting position');
            $table->boolean('is_primary')->default(true)->comment('Primary vs additional role');
            
            // ============================================
            // ASSIGNMENT DETAILS
            // ============================================
            $table->unsignedBigInteger('assigned_by_id')->nullable()->comment('Who assigned this role');
            $table->timestamp('assigned_at')->useCurrent();
            
            $table->enum('assignment_method', [
                'election', 
                'appointment', 
                'nomination', 
                'default', 
                'inherited'
            ])->default('appointment');
            
            $table->string('assignment_reference', 100)->nullable()->comment('Election ID, appointment letter #');
            
            // ============================================
            // TENANT ISOLATION
            // ============================================
            $table->unsignedBigInteger('tenant_id')->index();
            
            // ============================================
            // NOTES & AUDIT
            // ============================================
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by_id')->nullable();
            
            // ============================================
            // REVOCATION TRACKING
            // ============================================
            $table->timestamp('revoked_at')->nullable()->index();
            $table->unsignedBigInteger('revoked_by_id')->nullable();
            $table->text('revocation_reason')->nullable();
            
            // ============================================
            // TIMESTAMPS
            // ============================================
            $table->timestamps();
            
            // ============================================
            // INDEXES (Optimized for permission checks)
            // ============================================
            $table->index('user_id');
            $table->index('role_id');
            $table->index('organizational_unit_id');
            $table->index('is_active');
            $table->index('tenant_id');
            $table->index(['user_id', 'organizational_unit_id']);
            $table->index(['role_id', 'is_active']);
            $table->index(['user_id', 'role_id', 'organizational_unit_id', 'is_active']);
            
            // Unique constraint for active assignments
            $table->unique(['user_id', 'role_id', 'organizational_unit_id'], 
                'unique_active_assignment')
                ->where('revoked_at IS NULL AND is_active = 1');
            
            // ============================================
            // FOREIGN KEYS
            // ============================================
            $table->foreign('user_id')
                  ->references('id')
                  ->on('tenant_users')
                  ->onDelete('cascade');
                  
            $table->foreign('role_id')
                  ->references('id')
                  ->on('roles')
                  ->onDelete('cascade');
                  
            $table->foreign('organizational_unit_id')
                  ->references('id')
                  ->on('organizational_units')
                  ->onDelete('cascade');
                  
            $table->foreign('assigned_by_id')
                  ->references('id')
                  ->on('tenant_users')
                  ->onDelete('set null');
                  
            $table->foreign('revoked_by_id')
                  ->references('id')
                  ->on('tenant_users')
                  ->onDelete('set null');
            
            // ============================================
            // CONSTRAINTS
            // ============================================
            $table->check('term_start_date <= COALESCE(term_end_date, "9999-12-31")');
            
            // ============================================
            // COMMENTS FOR DOCUMENTATION
            // ============================================
            $table->comment('User-Role assignments with hierarchical context support');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_assignments');
    }
};
```

**File 7: `2024_01_07_create_tenant_settings_table.php`**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tenant_settings', function (Blueprint $table) {
            // ============================================
            // PRIMARY IDENTIFICATION
            // ============================================
            $table->id();
            $table->string('setting_key', 255);
            $table->text('setting_value')->nullable();
            
            // ============================================
            // SETTING PROPERTIES
            // ============================================
            $table->enum('setting_type', [
                'string', 
                'boolean', 
                'integer', 
                'float', 
                'json', 
                'array', 
                'datetime'
            ])->default('string');
            
            $table->string('setting_group', 100)->default('general')->index();
            $table->string('setting_category', 50)->nullable()->index()->comment('UI category for grouping');
            
            // ============================================
            // ACCESS CONTROL
            // ============================================
            $table->boolean('is_public')->default(false)->index();
            $table->boolean('is_encrypted')->default(false);
            
            $table->enum('access_level', [
                'public', 
                'member', 
                'officer', 
                'admin', 
                'system'
            ])->default('admin')->index();
            
            // ============================================
            // VALIDATION & CONSTRAINTS
            // ============================================
            $table->json('validation_rules')->nullable();
            $table->text('default_value')->nullable();
            $table->json('allowed_values')->nullable();
            
            // ============================================
            // METADATA & HELP
            // ============================================
            $table->text('description')->nullable();
            $table->text('help_text')->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->json('metadata')->nullable();
            
            // ============================================
            // TENANT ISOLATION
            // ============================================
            $table->unsignedBigInteger('tenant_id')->index();
            
            // ============================================
            // TIMESTAMPS
            // ============================================
            $table->timestamps();
            $table->softDeletes();
            
            // ============================================
            // INDEXES
            // ============================================
            $table->unique(['setting_key', 'setting_group', 'tenant_id']);
            $table->index('setting_group');
            $table->index('setting_category');
            $table->index('access_level');
            $table->index('is_public');
            $table->index('display_order');
            $table->index(['tenant_id', 'setting_group']);
            
            // ============================================
            // COMMENTS FOR DOCUMENTATION
            // ============================================
            $table->comment('Tenant-specific configuration settings');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenant_settings');
    }
};
```

**File 8: `2024_01_08_create_audit_logs_table.php`**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            // ============================================
            // PRIMARY IDENTIFICATION
            // ============================================
            $table->id();
            $table->uuid('uuid')->unique()->default(DB::raw('(UUID())'));
            
            // ============================================
            // ACTOR INFORMATION
            // ============================================
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('user_type', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('session_id', 100)->nullable()->index();
            
            // ============================================
            // ACTION DETAILS
            // ============================================
            $table->string('event_type', 255)->index();
            $table->string('event_subtype', 100)->nullable()->index();
            
            $table->string('auditable_type', 255)->index();
            $table->unsignedBigInteger('auditable_id')->index();
            
            // ============================================
            // CHANGE TRACKING
            // ============================================
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->json('changed_fields')->nullable();
            
            // ============================================
            // CONTEXT
            // ============================================
            $table->text('url')->nullable();
            $table->string('http_method', 10)->nullable();
            $table->string('request_id', 100)->nullable()->index();
            $table->string('correlation_id', 100)->nullable()->index();
            
            // ============================================
            // ADDITIONAL INFORMATION
            // ============================================
            $table->enum('severity', [
                'info', 
                'warning', 
                'error', 
                'critical'
            ])->default('info')->index();
            
            $table->json('tags')->nullable();
            $table->json('metadata')->nullable();
            
            // ============================================
            // TENANT ISOLATION
            // ============================================
            $table->unsignedBigInteger('tenant_id')->index();
            
            // ============================================
            // TIMESTAMP
            // ============================================
            $table->timestamp('created_at')->useCurrent();
            
            // ============================================
            // INDEXES (Optimized for compliance queries)
            // ============================================
            $table->index('user_id');
            $table->index(['auditable_type', 'auditable_id']);
            $table->index('event_type');
            $table->index('created_at');
            $table->index('request_id');
            $table->index('severity');
            $table->index('correlation_id');
            $table->index(['tenant_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
            
            // ============================================
            // FOREIGN KEY
            // ============================================
            $table->foreign('user_id')
                  ->references('id')
                  ->on('tenant_users')
                  ->onDelete('set null');
            
            // ============================================
            // COMMENTS FOR DOCUMENTATION
            // ============================================
            $table->comment('Immutable audit trail for all tenant activities');
        });
        
        // Create yearly partitions for scalability
        DB::statement("
            ALTER TABLE audit_logs 
            PARTITION BY RANGE (YEAR(created_at)) (
                PARTITION p2023 VALUES LESS THAN (2024),
                PARTITION p2024 VALUES LESS THAN (2025),
                PARTITION p2025 VALUES LESS THAN (2026),
                PARTITION p_future VALUES LESS THAN MAXVALUE
            )
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
```

### **PHASE 2: ELOQUENT MODELS**

Create these models in `app/Models/Universal/`:

**File 1: `app/Models/Universal/TenantUser.php`**
```php
<?php

namespace App\Models\Universal;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class TenantUser extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'tenant_users';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The "type" of the primary key ID.
     *
     * @var string
     */
    protected $keyType = 'int';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = true;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'phone_country_code',
        'password_hash',
        'status',
        'tenant_id',
        'identity_data',
        'address_data',
        'professional_data',
        'communication_preferences',
        'metadata',
        'created_by_id',
        'updated_by_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password_hash',
        'metadata',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'phone_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
        'locked_until' => 'datetime',
        'failed_login_attempts' => 'integer',
        'must_change_password' => 'boolean',
        'identity_data' => 'array',
        'address_data' => 'array',
        'professional_data' => 'array',
        'communication_preferences' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get the name of the unique identifier for the user.
     *
     * @return string
     */
    public function getAuthIdentifierName()
    {
        return 'id';
    }

    /**
     * Get the unique identifier for the user.
     *
     * @return mixed
     */
    public function getAuthIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Get the password for the user.
     *
     * @return string
     */
    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    /**
     * Get the token value for the "remember me" session.
     *
     * @return string|null
     */
    public function getRememberToken()
    {
        return null; // Not using remember token
    }

    /**
     * Set the token value for the "remember me" session.
     *
     * @param  string  $value
     * @return void
     */
    public function setRememberToken($value)
    {
        // Not using remember token
    }

    /**
     * Get the column name for the "remember me" token.
     *
     * @return string
     */
    public function getRememberTokenName()
    {
        return '';
    }

    /**
     * Get the user's full name.
     *
     * @return string
     */
    public function getFullNameAttribute()
    {
        return "{$this->first_name} {$this->last_name}";
    }

    /**
     * Scope a query to only include active users.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope a query to only include users of a specific tenant.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $tenantId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Check if the user is active.
     *
     * @return bool
     */
    public function isActive()
    {
        return $this->status === 'active';
    }

    /**
     * Check if the user's email is verified.
     *
     * @return bool
     */
    public function hasVerifiedEmail()
    {
        return !is_null($this->email_verified_at);
    }

    /**
     * Check if the user's phone is verified.
     *
     * @return bool
     */
    public function hasVerifiedPhone()
    {
        return !is_null($this->phone_verified_at);
    }

    /**
     * Get the organizational units where this user has roles.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function organizationalUnits()
    {
        return $this->belongsToMany(
            OrganizationalUnit::class,
            'role_assignments',
            'user_id',
            'organizational_unit_id'
        )->withPivot('role_id', 'is_active')
         ->withTimestamps();
    }

    /**
     * Get the roles assigned to this user.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function roles()
    {
        return $this->belongsToMany(
            Role::class,
            'role_assignments',
            'user_id',
            'role_id'
        )->withPivot('organizational_unit_id', 'is_active', 'term_start_date', 'term_end_date')
         ->withTimestamps();
    }

    /**
     * Get the user who created this record.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function creator()
    {
        return $this->belongsTo(TenantUser::class, 'created_by_id');
    }

    /**
     * Get the user who last updated this record.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function updater()
    {
        return $this->belongsTo(TenantUser::class, 'updated_by_id');
    }

    /**
     * Get the audit logs for this user.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }
}
```

**File 2: `app/Models/Universal/OrganizationalUnit.php`**
```php
<?php

namespace App\Models\Universal;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Kalnoy\Nestedset\NodeTrait;

class OrganizationalUnit extends Model
{
    use HasFactory, SoftDeletes, NodeTrait;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'organizational_units';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'parent_id',
        'unit_type',
        'code',
        'name',
        'description',
        'location_data',
        'leader_id',
        'leader_title',
        'contact_data',
        'is_active',
        'tenant_id',
        'settings',
        'metadata',
        'created_by_id',
        'updated_by_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_active' => 'boolean',
        'location_data' => 'array',
        'contact_data' => 'array',
        'settings' => 'array',
        'metadata' => 'array',
        'total_members' => 'integer',
        'active_members' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get the nested set configuration.
     *
     * @return array
     */
    public function getNestedSetConfig()
    {
        return [
            'left' => 'lft',
            'right' => 'rgt',
            'depth' => 'depth',
            'parent' => 'parent_id',
        ];
    }

    /**
     * Scope a query to only include active units.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to only include units of a specific type.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $type
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('unit_type', $type);
    }

    /**
     * Scope a query to only include units of a specific tenant.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $tenantId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Get the parent unit.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function parent()
    {
        return $this->belongsTo(OrganizationalUnit::class, 'parent_id');
    }

    /**
     * Get the child units.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function children()
    {
        return $this->hasMany(OrganizationalUnit::class, 'parent_id')
                    ->orderBy('code');
    }

    /**
     * Get all descendant units.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function descendants()
    {
        return $this->hasMany(OrganizationalUnit::class, 'parent_id')
                    ->with('descendants')
                    ->orderBy('lft');
    }

    /**
     * Get the leader of this unit.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function leader()
    {
        return $this->belongsTo(TenantUser::class, 'leader_id');
    }

    /**
     * Get the users who have roles in this unit.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function users()
    {
        return $this->belongsToMany(
            TenantUser::class,
            'role_assignments',
            'organizational_unit_id',
            'user_id'
        )->withPivot('role_id', 'is_active')
         ->withTimestamps();
    }

    /**
     * Get the roles assigned in this unit.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function roleAssignments()
    {
        return $this->hasMany(RoleAssignment::class, 'organizational_unit_id');
    }

    /**
     * Get the user who created this unit.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function creator()
    {
        return $this->belongsTo(TenantUser::class, 'created_by_id');
    }

    /**
     * Get the user who last updated this unit.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function updater()
    {
        return $this->belongsTo(TenantUser::class, 'updated_by_id');
    }

    /**
     * Get the complete path of this unit (e.g., "Country > State > City").
     *
     * @return string
     */
    public function getFullPathAttribute()
    {
        if ($this->parent) {
            return $this->parent->full_path . ' > ' . $this->name;
        }
        
        return $this->name;
    }

    /**
     * Check if this unit is a leaf (has no children).
     *
     * @return bool
     */
    public function isLeaf()
    {
        return $this->children()->count() === 0;
    }

    /**
     * Check if this unit is a root (has no parent).
     *
     * @return bool
     */
    public function isRoot()
    {
        return is_null($this->parent_id);
    }

    /**
     * Update the member counts for this unit.
     *
     * @return void
     */
    public function updateMemberCounts()
    {
        // This would be implemented based on your business logic
        // For example, count active members in this unit and all children
    }
}
```

**File 3: `app/Models/Universal/Role.php`**
```php
<?php

namespace App\Models\Universal;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Role extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'roles';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'code',
        'name',
        'description',
        'scope_type',
        'is_system_role',
        'hierarchy_level',
        'tenant_id',
        'default_permissions',
        'metadata',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_system_role' => 'boolean',
        'hierarchy_level' => 'integer',
        'default_permissions' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Scope a query to only include system roles.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeSystem($query)
    {
        return $query->where('is_system_role', true);
    }

    /**
     * Scope a query to only include global roles.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeGlobal($query)
    {
        return $query->where('scope_type', 'global');
    }

    /**
     * Scope a query to only include unit roles.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeUnit($query)
    {
        return $query->where('scope_type', 'unit');
    }

    /**
     * Scope a query to only include roles of a specific tenant.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $tenantId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Get the permissions assigned to this role.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function permissions()
    {
        return $this->belongsToMany(
            Permission::class,
            'role_permissions',
            'role_id',
            'permission_id'
        )->withPivot('grant_type', 'conditions')
         ->withTimestamps();
    }

    /**
     * Get the users who have this role.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function users()
    {
        return $this->belongsToMany(
            TenantUser::class,
            'role_assignments',
            'role_id',
            'user_id'
        )->withPivot('organizational_unit_id', 'is_active', 'term_start_date', 'term_end_date')
         ->withTimestamps();
    }

    /**
     * Get the organizational units where this role is assigned.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function organizationalUnits()
    {
        return $this->belongsToMany(
            OrganizationalUnit::class,
            'role_assignments',
            'role_id',
            'organizational_unit_id'
        )->withPivot('user_id', 'is_active')
         ->withTimestamps();
    }

    /**
     * Get the role assignments for this role.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function roleAssignments()
    {
        return $this->hasMany(RoleAssignment::class, 'role_id');
    }

    /**
     * Check if this role has a specific permission.
     *
     * @param  string  $permissionCode
     * @return bool
     */
    public function hasPermission($permissionCode)
    {
        return $this->permissions()
                    ->where('code', $permissionCode)
                    ->wherePivot('grant_type', 'allow')
                    ->exists();
    }

    /**
     * Check if this role is a system role.
     *
     * @return bool
     */
    public function isSystemRole()
    {
        return $this->is_system_role;
    }

    /**
     * Check if this role is a global role.
     *
     * @return bool
     */
    public function isGlobal()
    {
        return $this->scope_type === 'global';
    }

    /**
     * Check if this role is a unit role.
     *
     * @return bool
     */
    public function isUnit()
    {
        return $this->scope_type === 'unit';
    }
}
```

**File 4: `app/Models/Universal/Permission.php`**
```php
<?php

namespace App\Models\Universal;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Permission extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'permissions';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'code',
        'name',
        'description',
        'module',
        'submodule',
        'action',
        'resource',
        'scope_type',
        'is_system_permission',
        'is_critical',
        'tenant_id',
        'metadata',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_system_permission' => 'boolean',
        'is_critical' => 'boolean',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Scope a query to only include system permissions.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeSystem($query)
    {
        return $query->where('is_system_permission', true);
    }

    /**
     * Scope a query to only include critical permissions.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeCritical($query)
    {
        return $query->where('is_critical', true);
    }

    /**
     * Scope a query to only include permissions of a specific module.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $module
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfModule($query, $module)
    {
        return $query->where('module', $module);
    }

    /**
     * Scope a query to only include permissions of a specific action.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $action
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfAction($query, $action)
    {
        return $query->where('action', $action);
    }

    /**
     * Scope a query to only include permissions of a specific tenant.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $tenantId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Get the roles that have this permission.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function roles()
    {
        return $this->belongsToMany(
            Role::class,
            'role_permissions',
            'permission_id',
            'role_id'
        )->withPivot('grant_type', 'conditions')
         ->withTimestamps();
    }

    /**
     * Get the permission's full code (module.action.resource).
     *
     * @return string
     */
    public function getFullCodeAttribute()
    {
        $parts = [$this->module, $this->action];
        
        if ($this->resource) {
            $parts[] = $this->resource;
        }
        
        return implode('.', $parts);
    }

    /**
     * Check if this permission is a system permission.
     *
     * @return bool
     */
    public function isSystemPermission()
    {
        return $this->is_system_permission;
    }

    /**
     * Check if this permission is critical.
     *
     * @return bool
     */
    public function isCritical()
    {
        return $this->is_critical;
    }

    /**
     * Check if this permission is global in scope.
     *
     * @return bool
     */
    public function isGlobal()
    {
        return $this->scope_type === 'global';
    }

    /**
     * Check if this permission is unit-scoped.
     *
     * @return bool
     */
    public function isUnit()
    {
        return $this->scope_type === 'unit';
    }

    /**
     * Check if this permission is self-scoped.
     *
     * @return bool
     */
    public function isSelf()
    {
        return $this->scope_type === 'self';
    }
}
```

**File 5: `app/Models/Universal/RoleAssignment.php`**
```php
<?php

namespace App\Models\Universal;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RoleAssignment extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'role_assignments';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = true;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'role_id',
        'organizational_unit_id',
        'context_type',
        'context_id',
        'term_start_date',
        'term_end_date',
        'is_active',
        'is_acting',
        'is_primary',
        'assigned_by_id',
        'assignment_method',
        'assignment_reference',
        'tenant_id',
        'notes',
        'created_by_id',
        'revoked_at',
        'revoked_by_id',
        'revocation_reason',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_active' => 'boolean',
        'is_acting' => 'boolean',
        'is_primary' => 'boolean',
        'term_start_date' => 'date',
        'term_end_date' => 'date',
        'assigned_at' => 'datetime',
        'revoked_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Scope a query to only include active assignments.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)
                     ->whereNull('revoked_at');
    }

    /**
     * Scope a query to only include assignments of a specific user.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $userId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope a query to only include assignments of a specific role.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $roleId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfRole($query, $roleId)
    {
        return $query->where('role_id', $roleId);
    }

    /**
     * Scope a query to only include assignments in a specific unit.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $unitId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeInUnit($query, $unitId)
    {
        return $query->where('organizational_unit_id', $unitId);
    }

    /**
     * Scope a query to only include global assignments.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeGlobal($query)
    {
        return $query->whereNull('organizational_unit_id');
    }

    /**
     * Scope a query to only include assignments of a specific tenant.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $tenantId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Get the user for this assignment.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function user()
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    /**
     * Get the role for this assignment.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function role()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    /**
     * Get the organizational unit for this assignment.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function organizationalUnit()
    {
        return $this->belongsTo(OrganizationalUnit::class, 'organizational_unit_id');
    }

    /**
     * Get the user who assigned this role.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function assigner()
    {
        return $this->belongsTo(TenantUser::class, 'assigned_by_id');
    }

    /**
     * Get the user who revoked this assignment.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function revoker()
    {
        return $this->belongsTo(TenantUser::class, 'revoked_by_id');
    }

    /**
     * Get the user who created this assignment.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function creator()
    {
        return $this->belongsTo(TenantUser::class, 'created_by_id');
    }

    /**
     * Check if this assignment is active.
     *
     * @return bool
     */
    public function isActive()
    {
        return $this->is_active && is_null($this->revoked_at);
    }

    /**
     * Check if this assignment is revoked.
     *
     * @return bool
     */
    public function isRevoked()
    {
        return !is_null($this->revoked_at);
    }

    /**
     * Check if this assignment is expired.
     *
     * @return bool
     */
    public function isExpired()
    {
        if (is_null($this->term_end_date)) {
            return false;
        }
        
        return now()->greaterThan($this->term_end_date);
    }

    /**
     * Check if this assignment is currently valid.
     *
     * @return bool
     */
    public function isValid()
    {
        return $this->isActive() && !$this->isExpired();
    }

    /**
     * Check if this is an acting assignment.
     *
     * @return bool
     */
    public function isActing()
    {
        return $this->is_acting;
    }

    /**
     * Check if this is a primary assignment.
     *
     * @return bool
     */
    public function isPrimary()
    {
        return $this->is_primary;
    }

    /**
     * Check if this is a global assignment.
     *
     * @return bool
     */
    public function isGlobal()
    {
        return is_null($this->organizational_unit_id);
    }

    /**
     * Get the permissions granted through this role assignment.
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getPermissionsAttribute()
    {
        return $this->role->permissions;
    }
}
```

**File 6: `app/Models/Universal/TenantSetting.php`**
```php
<?php

namespace App\Models\Universal;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TenantSetting extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'tenant_settings';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'setting_key',
        'setting_value',
        'setting_type',
        'setting_group',
        'setting_category',
        'is_public',
        'is_encrypted',
        'access_level',
        'validation_rules',
        'default_value',
        'allowed_values',
        'description',
        'help_text',
        'display_order',
        'metadata',
        'tenant_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_public' => 'boolean',
        'is_encrypted' => 'boolean',
        'display_order' => 'integer',
        'validation_rules' => 'array',
        'allowed_values' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Scope a query to only include public settings.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopePublic($query)
    {
        return $query->where('is_public', true);
    }

    /**
     * Scope a query to only include settings of a specific group.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $group
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfGroup($query, $group)
    {
        return $query->where('setting_group', $group);
    }

    /**
     * Scope a query to only include settings of a specific category.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $category
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfCategory($query, $category)
    {
        return $query->where('setting_category', $category);
    }

    /**
     * Scope a query to only include settings of a specific access level.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $accessLevel
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfAccessLevel($query, $accessLevel)
    {
        return $query->where('access_level', $accessLevel);
    }

    /**
     * Scope a query to only include settings of a specific tenant.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $tenantId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Get the casted value based on setting type.
     *
     * @return mixed
     */
    public function getCastedValueAttribute()
    {
        $value = $this->setting_value;
        
        if ($this->is_encrypted && !empty($value)) {
            $value = decrypt($value);
        }
        
        switch ($this->setting_type) {
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN);
            case 'integer':
                return intval($value);
            case 'float':
                return floatval($value);
            case 'json':
                return json_decode($value, true);
            case 'array':
                return is_array($value) ? $value : explode(',', $value);
            case 'datetime':
                return new \DateTime($value);
            default:
                return $value;
        }
    }

    /**
     * Set the value with proper encoding based on type.
     *
     * @param  mixed  $value
     * @return void
     */
    public function setCastedValueAttribute($value)
    {
        switch ($this->setting_type) {
            case 'boolean':
                $value = $value ? '1' : '0';
                break;
            case 'integer':
                $value = strval(intval($value));
                break;
            case 'float':
                $value = strval(floatval($value));
                break;
            case 'json':
                $value = json_encode($value);
                break;
            case 'array':
                $value = is_array($value) ? implode(',', $value) : $value;
                break;
            case 'datetime':
                $value = $value instanceof \DateTime ? $value->format('Y-m-d H:i:s') : $value;
                break;
        }
        
        if ($this->is_encrypted && !empty($value)) {
            $value = encrypt($value);
        }
        
        $this->setting_value = $value;
    }

    /**
     * Check if this setting is encrypted.
     *
     * @return bool
     */
    public function isEncrypted()
    {
        return $this->is_encrypted;
    }

    /**
     * Check if this setting is public.
     *
     * @return bool
     */
    public function isPublic()
    {
        return $this->is_public;
    }

    /**
     * Check if the setting value is valid based on validation rules.
     *
     * @return bool
     */
    public function isValid()
    {
        if (empty($this->validation_rules)) {
            return true;
        }
        
        // Implement validation logic based on validation_rules
        // This would use Laravel's Validator or custom validation
        
        return true;
    }
}
```

**File 7: `app/Models/Universal/AuditLog.php`**
```php
<?php

namespace App\Models\Universal;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'audit_logs';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'user_type',
        'ip_address',
        'user_agent',
        'session_id',
        'event_type',
        'event_subtype',
        'auditable_type',
        'auditable_id',
        'old_values',
        'new_values',
        'changed_fields',
        'url',
        'http_method',
        'request_id',
        'correlation_id',
        'severity',
        'tags',
        'metadata',
        'tenant_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'changed_fields' => 'array',
        'tags' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Scope a query to only include logs of a specific user.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $userId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope a query to only include logs of a specific event type.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $eventType
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfEventType($query, $eventType)
    {
        return $query->where('event_type', $eventType);
    }

    /**
     * Scope a query to only include logs for a specific auditable.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $auditableType
     * @param  int  $auditableId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForAuditable($query, $auditableType, $auditableId)
    {
        return $query->where('auditable_type', $auditableType)
                     ->where('auditable_id', $auditableId);
    }

    /**
     * Scope a query to only include logs of a specific severity.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $severity
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfSeverity($query, $severity)
    {
        return $query->where('severity', $severity);
    }

    /**
     * Scope a query to only include logs within a date range.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $from
     * @param  string  $to
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeBetweenDates($query, $from, $to)
    {
        return $query->whereBetween('created_at', [$from, $to]);
    }

    /**
     * Scope a query to only include logs of a specific tenant.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $tenantId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Get the user who performed the action.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function user()
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    /**