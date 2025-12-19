# 🏗️ **MIGRATION DIRECTORY STRUCTURE FOR MULTI-TENANT TEMPLATE SYSTEM**

Perfect! Let's create the comprehensive migration directory structure for our 4-layer architecture. Here's the complete implementation:

## **1. CREATE MIGRATION DIRECTORY STRUCTURE**

```bash
# Create the main tenant migrations directory structure
# app/Contexts/Platform/Infrastructure/Database/Migrations;
mkdir -p  app/Contexts/Platform/Infrastructure/Database/Migrations/database/migrations/tenant/{basic,templates,modules,custom}
mkdir -p app/Contexts/Platform/Infrastructure/Database/Migrations/database/migrations/tenant/templates/political_party_nepal
mkdir -p app/Contexts/Platform/Infrastructure/Database/Migrations/database/migrations/tenant/modules/election_campaign
mkdir -p app/Contexts/Platform/Infrastructure/Database/Migrations/database/migrations/tenant/modules/social_media
mkdir -p app/Contexts/Platform/Infrastructure/Database/Migrations/database/migrations/tenant/modules/finance_tracking
mkdir -p app/Contexts/Platform/Infrastructure/Database/Migrations/database/migrations/tenant/modules/membership_management

# Create template categories
mkdir -p app/Contexts/Platform/Infrastructure/Database/Migrations/database/migrations/tenant/templates/non_profit_organization
mkdir -p app/contexts/platform/infrastructure/database/migrations/tenant/templates/community_group
mkdir -p app/contexts/platform/infrastructure/database/migrations/tenant/templates/student_union
```

## **2. BASIC TENANT DATABASE MIGRATIONS**

**File: `app/contexts/platform/infrastructure/database/migrations/tenant/basic/2024_01_01_000001_create_basic_tenant_tables.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Users table with multi-tenant support
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('user_type', ['admin', 'member', 'staff', 'volunteer'])->default('member');
            $table->string('phone')->nullable();
            $table->string('avatar')->nullable();
            $table->json('settings')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['email', 'user_type']);
        });

        // Roles and permissions (Spatie compatible)
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('guard_name')->default('web');
            $table->json('description')->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('guard_name')->default('web');
            $table->json('description')->nullable();
            $table->timestamps();
        });

        Schema::create('model_has_permissions', function (Blueprint $table) {
            $table->morphs('model');
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->primary(['model_id', 'model_type', 'permission_id']);
        });

        Schema::create('model_has_roles', function (Blueprint $table) {
            $table->morphs('model');
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->primary(['model_id', 'model_type', 'role_id']);
        });

        Schema::create('role_has_permissions', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->primary(['role_id', 'permission_id']);
        });

        // Password resets
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        // Sessions
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        // Failed jobs queue
        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });

        // Activity logging for all tenants
        Schema::create('activity_log', function (Blueprint $table) {
            $table->id();
            $table->string('log_name')->nullable();
            $table->text('description');
            $table->nullableMorphs('subject', 'subject');
            $table->nullableMorphs('causer', 'causer');
            $table->json('properties')->nullable();
            $table->uuid('batch_uuid')->nullable();
            $table->string('event')->nullable();
            $table->timestamps();
            
            $table->index(['log_name', 'subject_id', 'subject_type']);
            $table->index('batch_uuid');
        });

        // Settings table for tenant configuration
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->string('group')->default('general');
            $table->string('type')->default('string');
            $table->text('description')->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamps();
        });

        // File storage management
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->morphs('model');
            $table->uuid('uuid')->nullable()->unique();
            $table->string('collection_name');
            $table->string('name');
            $table->string('file_name');
            $table->string('mime_type')->nullable();
            $table->string('disk');
            $table->string('conversions_disk')->nullable();
            $table->unsignedBigInteger('size');
            $table->json('manipulations');
            $table->json('custom_properties');
            $table->json('generated_conversions');
            $table->json('responsive_images');
            $table->unsignedInteger('order_column')->nullable()->index();
            $table->nullableTimestamps();
        });

        // Notifications
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->json('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            
            $table->index(['notifiable_id', 'notifiable_type']);
        });

        // Audit trail for compliance
        Schema::create('audit_trails', function (Blueprint $table) {
            $table->id();
            $table->string('action'); // CREATE, UPDATE, DELETE, LOGIN, etc.
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            
            $table->index(['model_type', 'model_id']);
            $table->index('action');
            $table->index('created_at');
        });

        // Multi-language support foundation
        Schema::create('languages', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique(); // en, np, etc.
            $table->string('name'); // English, Nepali
            $table->string('native_name'); // English, नेपाली
            $table->string('direction')->default('ltr'); // ltr, rtl
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('translations', function (Blueprint $table) {
            $table->id();
            $table->string('group');
            $table->string('key');
            $table->text('text');
            $table->foreignId('language_id')->constrained();
            $table->timestamps();
            
            $table->unique(['group', 'key', 'language_id']);
            $table->index(['group', 'key']);
        });

        // API tokens for mobile apps
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            
            $table->index(['tokenable_id', 'tokenable_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('translations');
        Schema::dropIfExists('languages');
        Schema::dropIfExists('audit_trails');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('media');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('activity_log');
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('role_has_permissions');
        Schema::dropIfExists('model_has_roles');
        Schema::dropIfExists('model_has_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('users');
    }
};
```

## **3. TENANT CATEGORY/TEMPLATE MIGRATIONS**

### **3.1 POLITICAL PARTY NEPAL TEMPLATE**

**File: `app/contexts/platform/infrastructure/database/migrations/tenant/templates/political_party_nepal/2024_01_01_000002_create_political_party_foundation.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Core party information
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->json('name_translations'); // {"en": "Party Name", "np": "पार्टीको नाम"}
            $table->json('description_translations')->nullable();
            $table->string('short_name', 50);
            $table->string('registration_number')->unique(); // Election Commission registration
            $table->date('registration_date');
            $table->string('headquarters_address');
            $table->json('contact_information'); // {phone: [], email: [], website: ''}
            $table->string('logo_path')->nullable();
            $table->string('symbol_path')->nullable(); // Election symbol
            $table->string('founding_chairperson')->nullable();
            $table->date('establishment_date');
            $table->json('ideology_tags')->nullable(); // [democratic, socialist, etc.]
            $table->enum('status', ['active', 'suspended', 'dissolved'])->default('active');
            $table->timestamps();
            $table->softDeletes();
        });

        // Nepali administrative divisions (77 districts structure)
        Schema::create('provinces', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('name_np');
            $table->string('code', 2)->unique(); // 1, 2, 3...7
            $table->json('boundaries')->nullable(); // GeoJSON for mapping
            $table->string('capital');
            $table->integer('total_districts');
            $table->integer('total_municipalities');
            $table->integer('total_rural_municipalities');
            $table->timestamps();
        });

        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('name_np');
            $table->string('code', 4)->unique(); // District code
            $table->foreignId('province_id')->constrained();
            $table->json('boundaries')->nullable();
            $table->string('headquarter');
            $table->decimal('area_sq_km', 10, 2);
            $table->integer('total_population')->nullable();
            $table->integer('total_wards');
            $table->integer('total_municipalities');
            $table->integer('total_rural_municipalities');
            $table->timestamps();
            
            $table->index(['province_id', 'name']);
        });

        Schema::create('municipalities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_id')->constrained();
            $table->string('name');
            $table->string('name_np');
            $table->enum('type', ['metropolitan', 'sub-metropolitan', 'municipality', 'rural_municipality']);
            $table->string('code', 10)->unique(); // Municipal code
            $table->integer('total_wards');
            $table->json('ward_details'); // {ward_number: name, population, etc.}
            $table->decimal('area_sq_km', 10, 2);
            $table->integer('population')->nullable();
            $table->json('contact_info')->nullable();
            $table->timestamps();
        });

        // Political hierarchy structure
        Schema::create('committee_types', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Central, Provincial, District, Ward, Special, etc.
            $table->string('slug')->unique();
            $table->json('hierarchy_level'); // Defines parent-child relationships
            $table->json('mandate')->nullable();
            $table->integer('term_years')->default(5);
            $table->integer('max_members')->nullable();
            $table->json('required_positions'); // [chairperson, secretary, treasurer]
            $table->timestamps();
        });

        Schema::create('committees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('committee_type_id')->constrained();
            $table->foreignId('parent_committee_id')->nullable()->constrained('committees');
            $table->string('name');
            $table->json('jurisdiction')->nullable(); // Geographic jurisdiction
            $table->foreignId('province_id')->nullable()->constrained();
            $table->foreignId('district_id')->nullable()->constrained();
            $table->foreignId('municipality_id')->nullable()->constrained();
            $table->integer('ward_number')->nullable();
            $table->date('formation_date');
            $table->date('term_start');
            $table->date('term_end');
            $table->enum('status', ['active', 'inactive', 'dissolved'])->default('active');
            $table->json('meeting_schedule')->nullable();
            $table->json('contact_info')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['party_id', 'committee_type_id', 'province_id', 'district_id']);
        });

        Schema::create('committee_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('committee_id')->constrained();
            $table->foreignId('user_id')->constrained();
            $table->string('position'); // Chairperson, Secretary, Treasurer, Member, etc.
            $table->json('position_translations')->nullable();
            $table->date('appointment_date');
            $table->date('term_start');
            $table->date('term_end');
            $table->enum('appointment_type', ['elected', 'nominated', 'ex_officio']);
            $table->boolean('is_active')->default(true);
            $table->json('responsibilities')->nullable();
            $table->json('privileges')->nullable();
            $table->timestamps();
            
            $table->unique(['committee_id', 'user_id', 'position']);
            $table->index(['committee_id', 'is_active']);
        });

        // Membership management (Nepali context)
        Schema::create('member_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('name');
            $table->string('name_np');
            $table->string('code', 20)->unique();
            $table->decimal('membership_fee', 10, 2)->nullable();
            $table->integer('minimum_age')->nullable();
            $table->integer('maximum_age')->nullable();
            $table->json('eligibility_criteria')->nullable();
            $table->json('privileges')->nullable();
            $table->integer('term_years')->default(5);
            $table->boolean('requires_approval')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('member_category_id')->constrained();
            $table->string('membership_id')->unique();
            $table->date('membership_date');
            $table->date('renewal_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->enum('membership_status', ['active', 'pending', 'suspended', 'expired', 'terminated'])->default('pending');
            $table->enum('membership_type', ['lifetime', 'annual', 'temporary'])->default('annual');
            $table->decimal('paid_amount', 10, 2)->nullable();
            $table->string('payment_receipt')->nullable();
            $table->json('payment_details')->nullable();
            $table->json('additional_info')->nullable(); // Custom fields
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['party_id', 'membership_status', 'membership_date']);
            $table->index('membership_id');
        });

        // Nepali citizen information
        Schema::create('citizen_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained();
            $table->string('citizenship_number')->unique();
            $table->date('citizenship_issue_date');
            $table->string('citizenship_issue_district');
            $table->string('full_name_np'); // Nepali full name
            $table->string('full_name_en'); // English full name
            $table->date('date_of_birth');
            $table->enum('gender', ['male', 'female', 'other']);
            $table->enum('marital_status', ['single', 'married', 'divorced', 'widowed'])->nullable();
            $table->string('father_name');
            $table->string('mother_name');
            $table->string('grandfather_name');
            $table->string('spouse_name')->nullable();
            $table->string('permanent_address');
            $table->string('permanent_province');
            $table->string('permanent_district');
            $table->string('permanent_municipality');
            $table->integer('permanent_ward');
            $table->string('current_address')->nullable();
            $table->string('current_province')->nullable();
            $table->string('current_district')->nullable();
            $table->string('current_municipality')->nullable();
            $table->integer('current_ward')->nullable();
            $table->string('profession')->nullable();
            $table->string('education_level')->nullable();
            $table->json('identification_documents')->nullable(); // Passport, driving license, etc.
            $table->string('photo_path')->nullable();
            $table->string('citizenship_front_path')->nullable();
            $table->string('citizenship_back_path')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->foreignId('verified_by')->nullable()->constrained('users');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            
            $table->index(['citizenship_number', 'is_verified']);
            $table->index(['permanent_district', 'permanent_municipality']);
        });

        // Election Commission compliance foundation
        Schema::create('election_cycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('name'); // e.g., "2079 Local Election", "2080 Federal Election"
            $table->string('election_type'); // federal, provincial, local, by-election
            $table->date('announcement_date');
            $table->date('nomination_start_date');
            $table->date('nomination_end_date');
            $table->date('election_date');
            $table->date('results_date')->nullable();
            $table->enum('status', ['upcoming', 'nomination', 'campaign', 'voting', 'completed', 'cancelled']);
            $table->json('jurisdiction'); // Affected areas
            $table->json('ec_guidelines')->nullable(); // Election Commission directives
            $table->timestamps();
            
            $table->index(['party_id', 'election_type', 'status']);
        });

        Schema::create('compliance_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('document_type'); // financial_report, membership_list, committee_details, etc.
            $table->string('fiscal_year', 9); // Format: 2080-2081
            $table->string('period'); // quarterly, annual, election
            $table->date('submission_deadline');
            $table->date('submitted_date')->nullable();
            $table->enum('submission_status', ['pending', 'submitted', 'verified', 'rejected', 'late']);
            $table->string('ec_reference_number')->nullable();
            $table->json('document_attachments')->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users');
            $table->timestamps();
            
            $table->unique(['party_id', 'document_type', 'fiscal_year', 'period']);
            $table->index(['submission_deadline', 'submission_status']);
        });

        // Party assets and properties
        Schema::create('party_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('asset_type'); // office_building, vehicle, furniture, equipment
            $table->string('name');
            $table->json('description')->nullable();
            $table->string('registration_number')->nullable(); // Vehicle number, land registration
            $table->decimal('purchase_value', 15, 2)->nullable();
            $table->date('purchase_date')->nullable();
            $table->decimal('current_value', 15, 2)->nullable();
            $table->string('location')->nullable();
            $table->json('custodian')->nullable(); // Who's responsible
            $table->enum('condition', ['excellent', 'good', 'fair', 'poor', 'disposed'])->default('good');
            $table->json('documents')->nullable(); // Purchase documents, registration papers
            $table->json('maintenance_records')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // Party events and meetings
        Schema::create('party_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('event_type'); // general_assembly, central_meeting, training, rally
            $table->string('title');
            $table->json('title_translations')->nullable();
            $table->text('description')->nullable();
            $table->date('event_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('venue');
            $table->foreignId('province_id')->nullable()->constrained();
            $table->foreignId('district_id')->nullable()->constrained();
            $table->foreignId('municipality_id')->nullable()->constrained();
            $table->json('attendees')->nullable(); // Expected/actual attendees
            $table->decimal('budget', 15, 2)->nullable();
            $table->json('agenda_items')->nullable();
            $table->json('documents')->nullable(); // Agenda, minutes, photos
            $table->enum('status', ['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed']);
            $table->json('organizing_committee')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'event_date', 'event_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_events');
        Schema::dropIfExists('party_assets');
        Schema::dropIfExists('compliance_documents');
        Schema::dropIfExists('election_cycles');
        Schema::dropIfExists('citizen_details');
        Schema::dropIfExists('members');
        Schema::dropIfExists('member_categories');
        Schema::dropIfExists('committee_members');
        Schema::dropIfExists('committees');
        Schema::dropIfExists('committee_types');
        Schema::dropIfExists('municipalities');
        Schema::dropIfExists('districts');
        Schema::dropIfExists('provinces');
        Schema::dropIfExists('parties');
    }
};
```

### **3.2 FINANCIAL COMPLIANCE MODULE (Election Commission Requirements)**

**File: `app/contexts/platform/infrastructure/database/migrations/tenant/templates/political_party_nepal/2024_01_01_000003_create_financial_compliance_tables.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Election Commission financial reporting structure
        Schema::create('fiscal_years', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('year_code', 9)->unique(); // 2080-2081
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('status', ['upcoming', 'current', 'closed', 'audited']);
            $table->boolean('is_election_year')->default(false);
            $table->json('ec_reporting_deadlines')->nullable();
            $table->timestamps();
        });

        // Income categories as per Election Commission
        Schema::create('income_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('category_code', 20)->unique(); // EC-INC-001
            $table->string('name');
            $table->string('name_np');
            $table->text('description')->nullable();
            $table->enum('category_type', ['membership_fee', 'donation', 'grant', 'investment', 'other']);
            $table->json('ec_reporting_requirements')->nullable();
            $table->boolean('requires_donor_details')->default(false);
            $table->boolean('has_limit')->default(false);
            $table->decimal('limit_amount', 15, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Expense categories as per Election Commission
        Schema::create('expense_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('category_code', 20)->unique(); // EC-EXP-001
            $table->string('name');
            $table->string('name_np');
            $table->text('description')->nullable();
            $table->enum('category_type', ['administration', 'campaign', 'event', 'salary', 'asset', 'other']);
            $table->json('ec_reporting_requirements')->nullable();
            $table->boolean('requires_approval')->default(false);
            $table->boolean('requires_receipt')->default(true);
            $table->decimal('budget_limit', 15, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Donor management with EC compliance
        Schema::create('donors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->enum('donor_type', ['individual', 'organization', 'anonymous']);
            $table->string('donor_id')->unique(); // DNR-001
            $table->string('name');
            $table->string('name_np')->nullable();
            $table->string('citizenship_number')->nullable();
            $table->string('pan_number')->nullable();
            $table->string('registration_number')->nullable(); // For organizations
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->foreignId('province_id')->nullable()->constrained();
            $table->foreignId('district_id')->nullable()->constrained();
            $table->enum('donor_category', ['regular', 'major', 'political', 'corporate', 'foreign'])->default('regular');
            $table->boolean('is_blacklisted')->default(false);
            $table->text('blacklist_reason')->nullable();
            $table->json('verification_documents')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['party_id', 'donor_type', 'is_verified']);
        });

        // Donation tracking with EC limits
        Schema::create('donations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('donor_id')->nullable()->constrained();
            $table->foreignId('income_category_id')->constrained('income_categories');
            $table->foreignId('fiscal_year_id')->constrained('fiscal_years');
            $table->string('donation_number')->unique(); // DON-001-2080
            $table->date('donation_date');
            $table->decimal('amount', 15, 2);
            $table->enum('currency', ['NPR', 'USD', 'EUR', 'INR'])->default('NPR');
            $table->decimal('exchange_rate', 10, 4)->nullable();
            $table->decimal('amount_npr', 15, 2); // Always store in NPR for EC reporting
            $table->enum('payment_method', ['cash', 'bank_transfer', 'cheque', 'digital_wallet', 'other']);
            $table->string('bank_name')->nullable();
            $table->string('bank_branch')->nullable();
            $table->string('transaction_id')->nullable();
            $table->string('cheque_number')->nullable();
            $table->string('digital_wallet')->nullable();
            $table->text('purpose')->nullable();
            $table->boolean('is_anonymous')->default(false);
            $table->boolean('is_above_limit')->default(false);
            $table->boolean('requires_ec_approval')->default(false);
            $table->string('ec_approval_number')->nullable();
            $table->date('ec_approval_date')->nullable();
            $table->json('attachments')->nullable(); // Receipts, bank statements
            $table->enum('status', ['pending', 'received', 'verified', 'rejected', 'refunded']);
            $table->foreignId('verified_by')->nullable()->constrained('users');
            $table->timestamp('verified_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'donation_date', 'status']);
            $table->index(['fiscal_year_id', 'donor_id']);
        });

        // Expense tracking with approval workflow
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('expense_category_id')->constrained('expense_categories');
            $table->foreignId('fiscal_year_id')->constrained('fiscal_years');
            $table->foreignId('committee_id')->nullable()->constrained(); // Which committee spent
            $table->string('expense_number')->unique(); // EXP-001-2080
            $table->date('expense_date');
            $table->string('description');
            $table->decimal('amount', 15, 2);
            $table->enum('payment_method', ['cash', 'bank_transfer', 'cheque', 'digital_wallet']);
            $table->string('payee_name');
            $table->string('payee_details')->nullable();
            $table->json('attachments')->nullable(); // Bills, receipts, approvals
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users');
            $table->timestamp('paid_at')->nullable();
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected', 'paid']);
            $table->text('rejection_reason')->nullable();
            $table->json('approval_workflow')->nullable();
            $table->boolean('is_audited')->default(false);
            $table->timestamps();
            
            $table->index(['party_id', 'expense_date', 'status']);
            $table->index(['fiscal_year_id', 'expense_category_id']);
        });

        // EC Financial Reports submission tracking
        Schema::create('financial_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('fiscal_year_id')->constrained('fiscal_years');
            $table->string('report_number')->unique(); // FR-001-2080
            $table->enum('report_type', ['quarterly', 'annual', 'election', 'special']);
            $table->string('period'); // Q1, Q2, Q3, Q4, Annual
            $table->date('period_start');
            $table->date('period_end');
            $table->date('ec_submission_deadline');
            $table->date('submitted_date')->nullable();
            $table->enum('submission_status', ['draft', 'prepared', 'submitted', 'verified', 'rejected', 'late']);
            $table->string('ec_reference_number')->nullable();
            $table->json('income_summary');
            $table->json('expense_summary');
            $table->json('balance_sheet');
            $table->json('donation_details')->nullable();
            $table->json('expense_details')->nullable();
            $table->decimal('opening_balance', 15, 2);
            $table->decimal('closing_balance', 15, 2);
            $table->json('attachments')->nullable(); // PDF reports, supporting docs
            $table->text('ec_remarks')->nullable();
            $table->foreignId('prepared_by')->constrained('users');
            $table->foreignId('submitted_by')->nullable()->constrained('users');
            $table->timestamps();
            
            $table->unique(['party_id', 'fiscal_year_id', 'report_type', 'period']);
            $table->index(['ec_submission_deadline', 'submission_status']);
        });

        // Donation limits as per Election Commission rules
        Schema::create('donation_limits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('limit_type'); // individual_donation, corporate_donation, total_limit
            $table->string('applicable_year', 9); // 2080-2081
            $table->enum('donor_category', ['individual', 'organization', 'political', 'foreign'])->nullable();
            $table->decimal('limit_amount', 15, 2);
            $table->string('ec_directive_number')->nullable();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->text('description')->nullable();
            $table->text('penalties')->nullable(); // Penalties for exceeding limit
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index(['party_id', 'limit_type', 'applicable_year']);
        });

        // Audit trails for financial transactions
        Schema::create('financial_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('audit_type'); // internal, external, ec_audit
            $table->foreignId('fiscal_year_id')->nullable()->constrained('fiscal_years');
            $table->date('audit_date');
            $table->string('auditor_name');
            $table->string('auditor_license')->nullable();
            $table->json('scope'); // What was audited
            $table->json('findings')->nullable();
            $table->json('recommendations')->nullable();
            $table->enum('audit_status', ['scheduled', 'in_progress', 'completed', 'cancelled']);
            $table->json('audit_report')->nullable(); // PDF/document
            $table->date('ec_submission_date')->nullable();
            $table->text('ec_response')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'audit_date', 'audit_type']);
        });

        // Bank account management for EC reporting
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('account_name');
            $table->string('bank_name');
            $table->string('branch_name');
            $table->string('account_number');
            $table->string('account_type'); // current, savings, fixed_deposit
            $table->enum('currency', ['NPR', 'USD', 'EUR', 'INR'])->default('NPR');
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->decimal('current_balance', 15, 2)->default(0);
            $table->date('opening_date');
            $table->date('closing_date')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('authorized_signatories')->nullable();
            $table->json('ec_declaration')->nullable(); // Declaration to EC
            $table->timestamps();
            $table->softDeletes();
            
            $table->unique(['party_id', 'account_number']);
            $table->index(['party_id', 'is_active', 'is_primary']);
        });

        // Budget planning and monitoring
        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('fiscal_year_id')->constrained('fiscal_years');
            $table->string('budget_name');
            $table->enum('budget_type', ['operational', 'campaign', 'event', 'capital', 'emergency']);
            $table->foreignId('committee_id')->nullable()->constrained(); // Which committee's budget
            $table->json('income_budget'); // Planned income by category
            $table->json('expense_budget'); // Planned expenses by category
            $table->decimal('total_income_budget', 15, 2);
            $table->decimal('total_expense_budget', 15, 2);
            $table->decimal('surplus_deficit', 15, 2); // Income - Expense
            $table->enum('status', ['draft', 'proposed', 'approved', 'rejected', 'active', 'closed']);
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->date('effective_from');
            $table->date('effective_to');
            $table->json('performance_metrics')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'fiscal_year_id', 'budget_type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budgets');
        Schema::dropIfExists('bank_accounts');
        Schema::dropIfExists('financial_audits');
        Schema::dropIfExists('donation_limits');
        Schema::dropIfExists('financial_reports');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('donations');
        Schema::dropIfExists('donors');
        Schema::dropIfExists('expense_categories');
        Schema::dropIfExists('income_categories');
        Schema::dropIfExists('fiscal_years');
    }
};
```

## **4. MODULE TYPE MIGRATIONS**

### **4.1 ELECTION CAMPAIGN MODULE**

**File: `app/contexts/platform/infrastructure/database/migrations/tenant/modules/election_campaign/2024_01_01_000004_create_election_campaign_tables.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Election types and details
        Schema::create('election_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('type_name'); // Federal, Provincial, Local, By-election
            $table->string('type_name_np');
            $table->string('election_code')->unique();
            $table->json('jurisdiction_levels'); // [federal, provincial, district, local]
            $table->json('candidate_requirements')->nullable(); // Eligibility criteria
            $table->json('nomination_requirements')->nullable(); // Documents needed
            $table->json('campaign_rules')->nullable(); // EC campaign guidelines
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Constituencies
        Schema::create('constituencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('election_type_id')->constrained();
            $table->string('constituency_number')->unique();
            $table->string('name');
            $table->string('name_np');
            $table->foreignId('province_id')->constrained();
            $table->foreignId('district_id')->constrained();
            $table->json('municipalities_covered'); // Array of municipality IDs
            $table->json('ward_details')->nullable();
            $table->integer('total_voters')->nullable();
            $table->integer('total_booths')->nullable();
            $table->json('boundary_data')->nullable(); // GeoJSON for mapping
            $table->json('demographic_data')->nullable();
            $table->json('previous_results')->nullable();
            $table->enum('status', ['active', 'redistricted', 'inactive']);
            $table->timestamps();
            
            $table->index(['party_id', 'election_type_id', 'province_id']);
        });

        // Candidates management
        Schema::create('candidates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('constituency_id')->constrained();
            $table->foreignId('member_id')->constrained();
            $table->string('candidate_number')->unique(); // CAND-001-2080
            $table->enum('candidate_type', ['fpip', 'pr', 'both']); // First Past the Post or Proportional Representation
            $table->string('symbol_allotted')->nullable(); // Election symbol
            $table->date('nomination_date');
            $table->date('withdrawal_date')->nullable();
            $table->enum('nomination_status', ['draft', 'submitted', 'verified', 'rejected', 'withdrawn']);
            $table->text('rejection_reason')->nullable();
            $table->json('nomination_documents')->nullable();
            $table->decimal('security_deposit', 10, 2)->nullable();
            $table->enum('deposit_status', ['paid', 'refunded', 'forfeited'])->nullable();
            $table->json('campaign_team')->nullable();
            $table->json('endorsements')->nullable();
            $table->decimal('campaign_budget', 15, 2)->nullable();
            $table->decimal('spent_amount', 15, 2)->default(0);
            $table->enum('campaign_status', ['planning', 'active', 'suspended', 'completed']);
            $table->json('contact_details_public')->nullable();
            $table->boolean('is_incumbent')->default(false);
            $table->json('previous_elections')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->unique(['constituency_id', 'member_id', 'candidate_type']);
            $table->index(['party_id', 'nomination_status', 'campaign_status']);
        });

        // Campaign activities and events
        Schema::create('campaign_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('candidate_id')->nullable()->constrained();
            $table->foreignId('constituency_id')->nullable()->constrained();
            $table->string('activity_type'); // rally, door_to_door, social_media, press_conference
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('activity_date');
            $table->time('start_time');
            $table->time('end_time')->nullable();
            $table->string('venue');
            $table->json('location_details')->nullable(); // {latitude, longitude, address}
            $table->json('target_audience')->nullable();
            $table->integer('expected_participants')->nullable();
            $table->integer('actual_participants')->nullable();
            $table->decimal('estimated_cost', 10, 2)->nullable();
            $table->decimal('actual_cost', 10, 2)->nullable();
            $table->json('speakers')->nullable(); // Array of member IDs
            $table->json('media_coverage')->nullable(); // News links, photos
            $table->json('materials_used')->nullable(); // Posters, banners, etc.
            $table->enum('status', ['planned', 'ongoing', 'completed', 'cancelled', 'postponed']);
            $table->text('outcome_notes')->nullable();
            $table->json('feedback')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'activity_date', 'activity_type']);
            $table->index(['candidate_id', 'status']);
        });

        // Voting stations/booths
        Schema::create('voting_stations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('constituency_id')->constrained();
            $table->string('station_code')->unique();
            $table->string('station_name');
            $table->string('location_address');
            $table->json('coordinates')->nullable(); // {latitude, longitude}
            $table->foreignId('province_id')->constrained();
            $table->foreignId('district_id')->constrained();
            $table->foreignId('municipality_id')->constrained();
            $table->integer('ward_number');
            $table->integer('total_registered_voters');
            $table->integer('total_booths')->default(1);
            $table->json('booth_details')->nullable(); // [{booth_number: 1, voters: 500}]
            $table->json('facilities')->nullable(); // {disabled_access: true, parking: true}
            $table->json('polling_officials')->nullable(); // Assigned officials
            $table->json('security_arrangements')->nullable();
            $table->enum('station_type', ['regular', 'special', 'mobile', 'postal']);
            $table->boolean('is_accessible')->default(true);
            $table->timestamps();
            
            $table->index(['constituency_id', 'station_code']);
            $table->index(['province_id', 'district_id', 'municipality_id']);
        });

        // Polling agents management
        Schema::create('polling_agents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('candidate_id')->nullable()->constrained();
            $table->foreignId('voting_station_id')->constrained();
            $table->foreignId('member_id')->constrained();
            $table->string('agent_code')->unique();
            $table->enum('agent_type', ['presiding', 'polling', 'counting', 'roving']);
            $table->integer('assigned_booth')->nullable();
            $table->date('appointment_date');
            $table->json('appointment_documents')->nullable(); // Appointment letter
            $table->json('training_details')->nullable();
            $table->json('duties')->nullable();
            $table->string('contact_number');
            $table->string('alternate_contact')->nullable();
            $table->enum('status', ['appointed', 'trained', 'active', 'replaced', 'withdrawn']);
            $table->json('reports_submitted')->nullable();
            $table->text('performance_notes')->nullable();
            $table->timestamps();
            
            $table->unique(['voting_station_id', 'member_id']);
            $table->index(['candidate_id', 'agent_type', 'status']);
        });

        // Election results tracking
        Schema::create('election_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('constituency_id')->constrained();
            $table->foreignId('candidate_id')->constrained();
            $table->foreignId('voting_station_id')->nullable()->constrained();
            $table->string('result_type'); // preliminary, official, final
            $table->integer('total_votes');
            $table->integer('position'); // 1st, 2nd, 3rd, etc.
            $table->decimal('vote_percentage', 5, 2);
            $table->boolean('is_elected')->default(false);
            $table->json('station_wise_results')->nullable();
            $table->json('round_wise_results')->nullable(); // For PR system
            $table->json('result_documents')->nullable(); // Result sheets, certificates
            $table->enum('result_status', ['unofficial', 'official', 'contested', 'recount', 'final']);
            $table->date('result_date');
            $table->date('certificate_date')->nullable();
            $table->text('remarks')->nullable();
            $table->json('challenges')->nullable(); // Election petitions
            $table->timestamps();
            
            $table->unique(['constituency_id', 'candidate_id', 'result_type']);
            $table->index(['party_id', 'result_date', 'result_status']);
        });

        // Voter outreach and feedback
        Schema::create('voter_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('candidate_id')->nullable()->constrained();
            $table->foreignId('constituency_id')->nullable()->constrained();
            $table->string('voter_name');
            $table->string('contact_number');
            $table->string('address')->nullable();
            $table->integer('ward_number')->nullable();
            $table->enum('contact_type', ['phone', 'door_to_door', 'event', 'social_media']);
            $table->date('contact_date');
            $table->enum('voter_sentiment', ['supportive', 'neutral', 'opposed', 'undecided']);
            $table->json('issues_raised')->nullable();
            $table->json('promises_made')->nullable();
            $table->boolean('requires_followup')->default(false);
            $table->date('followup_date')->nullable();
            $table->text('followup_notes')->nullable();
            $table->enum('followup_status', ['pending', 'completed', 'cancelled'])->default('pending');
            $table->json('agent_details')->nullable(); // Who made the contact
            $table->timestamps();
            
            $table->index(['constituency_id', 'contact_date', 'voter_sentiment']);
            $table->index(['candidate_id', 'requires_followup', 'followup_status']);
        });

        // Campaign finance tracking (separate from main finance)
        Schema::create('campaign_finances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('candidate_id')->nullable()->constrained();
            $table->foreignId('constituency_id')->nullable()->constrained();
            $table->string('transaction_id')->unique();
            $table->enum('transaction_type', ['income', 'expense']);
            $table->string('category'); // donation, event, advertising, travel
            $table->decimal('amount', 15, 2);
            $table->date('transaction_date');
            $table->string('description');
            $table->json('details')->nullable();
            $table->json('attachments')->nullable();
            $table->enum('payment_method', ['cash', 'bank', 'cheque', 'digital']);
            $table->string('reference_number')->nullable();
            $table->enum('status', ['pending', 'verified', 'rejected']);
            $table->foreignId('verified_by')->nullable()->constrained('users');
            $table->timestamp('verified_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            
            $table->index(['candidate_id', 'transaction_type', 'transaction_date']);
            $table->index(['constituency_id', 'category', 'status']);
        });

        // Campaign material inventory
        Schema::create('campaign_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('candidate_id')->nullable()->constrained();
            $table->string('material_type'); // poster, banner, pamphlet, flag, tshirt
            $table->string('item_name');
            $table->text('description')->nullable();
            $table->string('design_reference')->nullable();
            $table->integer('quantity_ordered');
            $table->integer('quantity_received')->nullable();
            $table->integer('quantity_distributed')->default(0);
            $table->integer('quantity_in_stock')->virtualAs('quantity_received - quantity_distributed');
            $table->decimal('unit_cost', 10, 2);
            $table->decimal('total_cost', 10, 2);
            $table->json('distribution_records')->nullable();
            $table->json('storage_location')->nullable();
            $table->enum('status', ['ordered', 'received', 'distributing', 'completed']);
            $table->date('order_date');
            $table->date('delivery_date')->nullable();
            $table->timestamps();
            
            $table->index(['candidate_id', 'material_type', 'status']);
        });

        // Social media campaign tracking
        Schema::create('social_media_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('candidate_id')->nullable()->constrained();
            $table->string('platform'); // facebook, twitter, tiktok, youtube
            $table->string('campaign_name');
            $table->string('campaign_url')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('budget', 10, 2)->nullable();
            $table->string('target_audience')->nullable();
            $table->json('content_calendar')->nullable();
            $table->json('key_messages')->nullable();
            $table->json('performance_metrics')->nullable(); // {reach: x, engagement: y}
            $table->integer('total_posts')->default(0);
            $table->integer('total_engagement')->default(0);
            $table->integer('total_reach')->default(0);
            $table->json('top_posts')->nullable();
            $table->enum('status', ['planned', 'active', 'paused', 'completed']);
            $table->json('analytics_report')->nullable();
            $table->timestamps();
            
            $table->index(['candidate_id', 'platform', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_media_campaigns');
        Schema::dropIfExists('campaign_materials');
        Schema::dropIfExists('campaign_finances');
        Schema::dropIfExists('voter_contacts');
        Schema::dropIfExists('election_results');
        Schema::dropIfExists('polling_agents');
        Schema::dropIfExists('voting_stations');
        Schema::dropIfExists('campaign_activities');
        Schema::dropIfExists('candidates');
        Schema::dropIfExists('constituencies');
        Schema::dropIfExists('election_types');
    }
};
```

### **4.2 SOCIAL MEDIA MODULE**

**File: `app/contexts/platform/infrastructure/database/migrations/tenant/modules/social_media/2024_01_01_000005_create_social_media_tables.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Social media platform configurations
        Schema::create('social_platforms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('platform_name'); // Facebook, Twitter, Instagram, TikTok, YouTube
            $table->string('platform_icon')->nullable();
            $table->string('page_name')->nullable();
            $table->string('page_url')->nullable();
            $table->string('page_id')->nullable(); // Platform-specific ID
            $table->json('api_credentials')->nullable(); // Encrypted API keys
            $table->json('page_metrics')->nullable(); // Followers, likes, etc.
            $table->boolean('is_connected')->default(false);
            $table->timestamp('last_synced_at')->nullable();
            $table->enum('connection_status', ['connected', 'disconnected', 'expired', 'error']);
            $table->text('connection_error')->nullable();
            $table->json('posting_schedule')->nullable(); // Auto-posting schedule
            $table->boolean('auto_posting_enabled')->default(false);
            $table->boolean('analytics_enabled')->default(false);
            $table->timestamps();
            
            $table->unique(['party_id', 'platform_name']);
            $table->index(['is_connected', 'connection_status']);
        });

        // Social media content calendar
        Schema::create('social_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('platform_id')->constrained('social_platforms');
            $table->foreignId('campaign_id')->nullable()->constrained('campaigns')->onDelete('set null');
            $table->string('post_type'); // text, image, video, link, carousel
            $table->text('content')->nullable(); // Main post text
            $table->json('content_translations')->nullable(); // For multi-language
            $table->json('media_attachments')->nullable(); // Images, videos
            $table->json('links')->nullable();
            $table->json('hashtags')->nullable();
            $table->json('mentions')->nullable();
            $table->json('targeting')->nullable(); // Audience targeting
            $table->timestamp('scheduled_for')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->string('platform_post_id')->nullable(); // ID from social platform
            $table->json('platform_response')->nullable(); // Response from platform API
            $table->enum('post_status', ['draft', 'scheduled', 'posting', 'posted', 'failed', 'cancelled']);
            $table->text('failure_reason')->nullable();
            $table->json('performance_metrics')->nullable(); // Likes, shares, comments
            $table->decimal('engagement_rate', 5, 2)->nullable();
            $table->integer('total_reach')->nullable();
            $table->integer('total_engagement')->nullable();
            $table->json('audience_insights')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['party_id', 'platform_id', 'post_status']);
            $table->index(['scheduled_for', 'posted_at']);
        });

        // Social media comments and engagement tracking
        Schema::create('social_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('post_id')->constrained('social_posts');
            $table->string('platform_comment_id')->nullable();
            $table->text('comment_text');
            $table->string('commenter_name');
            $table->string('commenter_id')->nullable();
            $table->string('commenter_profile_url')->nullable();
            $table->timestamp('commented_at');
            $table->json('comment_metadata')->nullable();
            $table->integer('like_count')->default(0);
            $table->integer('reply_count')->default(0);
            $table->boolean('is_hidden')->default(false);
            $table->boolean('is_reported')->default(false);
            $table->enum('sentiment', ['positive', 'neutral', 'negative', 'mixed'])->nullable();
            $table->text('sentiment_analysis')->nullable();
            $table->boolean('requires_response')->default(false);
            $table->enum('response_status', ['pending', 'responded', 'ignored', 'escalated']);
            $table->text('response_text')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->foreignId('responded_by')->nullable()->constrained('users');
            $table->timestamps();
            
            $table->index(['post_id', 'commented_at', 'sentiment']);
            $table->index(['requires_response', 'response_status']);
        });

        // Social media influencers/ambassadors
        Schema::create('social_influencers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('influencer_name');
            $table->string('influencer_type'); // celebrity, expert, activist, local_leader
            $table->json('social_profiles')->nullable(); // Their social media profiles
            $table->json('platform_stats')->nullable(); // Follower counts per platform
            $table->string('primary_platform')->nullable();
            $table->string('category')->nullable(); // politics, entertainment, sports
            $table->json('demographics')->nullable(); // Audience demographics
            $table->decimal('engagement_rate', 5, 2)->nullable();
            $table->enum('affiliation_status', ['supporter', 'neutral', 'critic', 'partner']);
            $table->json('contact_details')->nullable();
            $table->json('previous_collaborations')->nullable();
            $table->decimal('collaboration_cost', 10, 2)->nullable();
            $table->json('collaboration_terms')->nullable();
            $table->enum('relationship_status', ['potential', 'contacted', 'negotiating', 'contracted', 'active', 'ended']);
            $table->date('contract_start')->nullable();
            $table->date('contract_end')->nullable();
            $table->json('performance_metrics')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'influencer_type', 'relationship_status']);
            $table->index(['affiliation_status', 'engagement_rate']);
        });

        // Social media advertising campaigns
        Schema::create('social_ads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->foreignId('platform_id')->constrained('social_platforms');
            $table->string('ad_campaign_name');
            $table->string('ad_campaign_id')->nullable(); // Platform campaign ID
            $table->string('ad_set_id')->nullable(); // Platform ad set ID
            $table->string('ad_id')->nullable(); // Platform ad ID
            $table->enum('ad_objective', ['awareness', 'engagement', 'traffic', 'conversions', 'messages']);
            $table->json('targeting_criteria')->nullable();
            $table->json('ad_creatives')->nullable();
            $table->decimal('daily_budget', 10, 2)->nullable();
            $table->decimal('total_budget', 10, 2)->nullable();
            $table->decimal('amount_spent', 10, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->enum('ad_status', ['draft', 'pending_review', 'active', 'paused', 'completed', 'rejected']);
            $table->json('performance_metrics')->nullable();
            $table->json('audience_insights')->nullable();
            $table->decimal('cost_per_result', 10, 2)->nullable();
            $table->json('platform_insights')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'platform_id', 'ad_status']);
            $table->index(['start_date', 'end_date']);
        });

        // Hashtag tracking and trends
        Schema::create('social_hashtags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('hashtag');
            $table->string('category')->nullable();
            $table->json('related_hashtags')->nullable();
            $table->integer('total_posts')->default(0);
            $table->integer('total_engagement')->default(0);
            $table->decimal('engagement_rate', 5, 2)->nullable();
            $table->json('top_posts')->nullable();
            $table->json('top_influencers')->nullable();
            $table->json('sentiment_analysis')->nullable();
            $table->date('trending_date')->nullable();
            $table->integer('trending_rank')->nullable();
            $table->json('geographic_distribution')->nullable();
            $table->json('demographic_insights')->nullable();
            $table->boolean('is_tracking')->default(true);
            $table->timestamp('last_tracked_at')->nullable();
            $table->timestamps();
            
            $table->unique(['party_id', 'hashtag']);
            $table->index(['category', 'total_engagement']);
        });

        // Competitor social media tracking
        Schema::create('social_competitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('competitor_name');
            $table->enum('competitor_type', ['political_party', 'candidate', 'organization', 'media']);
            $table->json('social_profiles')->nullable();
            $table->json('follower_stats')->nullable();
            $table->json('engagement_stats')->nullable();
            $table->json('content_strategy')->nullable();
            $table->decimal('sentiment_score', 5, 2)->nullable();
            $table->json('top_content')->nullable();
            $table->json('audience_overlap')->nullable();
            $table->json('strengths_weaknesses')->nullable();
            $table->integer('mentions_count')->default(0);
            $table->json('mention_sentiment')->nullable();
            $table->boolean('is_monitoring')->default(true);
            $table->timestamp('last_analyzed_at')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'competitor_type', 'is_monitoring']);
        });

        // Social media crisis management
        Schema::create('social_crises', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('crisis_title');
            $table->enum('crisis_type', ['negative_viral', 'misinformation', 'hacking', 'boycott', 'controversy']);
            $table->enum('severity_level', ['low', 'medium', 'high', 'critical']);
            $table->json('trigger_content')->nullable();
            $table->json('affected_platforms')->nullable();
            $table->integer('mention_count')->default(0);
            $table->decimal('sentiment_score', 5, 2)->nullable();
            $table->json('key_contributors')->nullable(); // Main accounts spreading
            $table->json('timeline')->nullable();
            $table->json('impact_assessment')->nullable();
            $table->json('response_strategy')->nullable();
            $table->json('response_messages')->nullable();
            $table->json('response_channels')->nullable();
            $table->enum('status', ['detected', 'assessing', 'responding', 'contained', 'resolved']);
            $table->foreignId('assigned_to')->nullable()->constrained('users');
            $table->timestamp('detected_at');
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();
            
            $table->index(['party_id', 'status', 'severity_level']);
            $table->index(['detected_at', 'resolved_at']);
        });

        // Social media analytics reports
        Schema::create('social_analytics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('report_name');
            $table->enum('report_type', ['daily', 'weekly', 'monthly', 'campaign', 'ad_hoc']);
            $table->date('report_date');
            $table->json('platform_metrics'); // Per platform stats
            $table->json('content_performance'); // Top performing content
            $table->json('audience_insights'); // Demographic data
            $table->json('engagement_analysis');
            $table->json('growth_metrics');
            $table->json('competitive_analysis')->nullable();
            $table->json('recommendations');
            $table->json('visualizations')->nullable(); // Charts, graphs
            $table->boolean('is_automated')->default(false);
            $table->foreignId('generated_by')->nullable()->constrained('users');
            $table->timestamps();
            
            $table->unique(['party_id', 'report_type', 'report_date']);
            $table->index(['report_date', 'report_type']);
        });

        // Social listening keywords
        Schema::create('social_keywords', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('keyword');
            $table->enum('keyword_type', ['brand', 'competitor', 'issue', 'person', 'hashtag']);
            $table->json('variations')->nullable(); // Similar keywords
            $table->json('exclusions')->nullable(); // Terms to exclude
            $table->json('platforms')->nullable(); // Where to monitor
            $table->json('sentiment_rules')->nullable(); // Custom sentiment rules
            $table->boolean('is_active')->default(true);
            $table->integer('alert_threshold')->nullable(); // Mentions per hour
            $table->json('alert_recipients')->nullable();
            $table->timestamp('last_matched_at')->nullable();
            $table->integer('total_matches')->default(0);
            $table->timestamps();
            
            $table->unique(['party_id', 'keyword']);
            $table->index(['keyword_type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_keywords');
        Schema::dropIfExists('social_analytics');
        Schema::dropIfExists('social_crises');
        Schema::dropIfExists('social_competitors');
        Schema::dropIfExists('social_hashtags');
        Schema::dropIfExists('social_ads');
        Schema::dropIfExists('social_influencers');
        Schema::dropIfExists('social_comments');
        Schema::dropIfExists('social_posts');
        Schema::dropIfExists('social_platforms');
    }
};
```

## **5. INDIVIDUAL TENANT-SPECIFIC MIGRATIONS**

### **5.1 CUSTOM MIGRATION STRUCTURE**

**Directory Structure for Custom Migrations:**
```bash
# Each tenant gets their own custom migration directory
app/contexts/platform/infrastructure/database/migrations/tenant/custom/{tenant-slug}/
```

**Example: Custom migration for a specific political party**

**File: `app/contexts/platform/infrastructure/database/migrations/tenant/custom/nepali-congress/2024_01_01_999999_create_custom_membership_tiers.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Custom membership tiers for Nepali Congress party
        Schema::create('custom_membership_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('tier_name');
            $table->string('tier_name_np'); // नेपाली नाम
            $table->string('tier_code')->unique();
            $table->decimal('membership_fee', 10, 2);
            $table->integer('validity_years');
            $table->json('privileges'); // Custom privileges for this party
            $table->json('eligibility_criteria'); // Party-specific criteria
            $table->boolean('requires_sponsor')->default(false);
            $table->integer('sponsor_min_years')->nullable();
            $table->json('documents_required'); // Party-specific documents
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        // Custom committee structure for this party
        Schema::create('custom_committee_positions', function (Blueprint $table) {
            $table->id();
            $table->string('position_name');
            $table->string('position_name_np');
            $table->string('position_code')->unique();
            $table->json('responsibilities');
            $table->json('qualifications_required');
            $table->integer('term_years');
            $table->integer('max_consecutive_terms');
            $table->json('voting_rights');
            $table->json('reporting_structure');
            $table->boolean('is_elected')->default(true);
            $table->boolean('requires_approval')->default(true);
            $table->json('approval_process');
            $table->timestamps();
        });

        // Party-specific training modules
        Schema::create('custom_training_modules', function (Blueprint $table) {
            $table->id();
            $table->string('module_name');
            $table->string('module_name_np');
            $table->text('description');
            $table->enum('audience', ['new_members', 'committee_members', 'candidates', 'all']);
            $table->json('curriculum');
            $table->integer('duration_hours');
            $table->json('training_materials');
            $table->boolean('is_mandatory')->default(false);
            $table->boolean('has_certification')->default(false);
            $table->json('certification_requirements');
            $table->timestamps();
        });

        // Custom reporting requirements for this party
        Schema::create('custom_reports', function (Blueprint $table) {
            $table->id();
            $table->string('report_name');
            $table->string('report_name_np');
            $table->enum('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'annual']);
            $table->json('data_sources');
            $table->json('required_fields');
            $table->json('format_specifications');
            $table->json('approval_workflow');
            $table->json('distribution_list');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Party-specific event types
        Schema::create('custom_event_types', function (Blueprint $table) {
            $table->id();
            $table->string('event_type');
            $table->string('event_type_np');
            $table->json('standard_agenda');
            $table->json('required_attendees');
            $table->json('documentation_requirements');
            $table->json('budget_guidelines');
            $table->integer('notice_period_days');
            $table->json('followup_actions');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_event_types');
        Schema::dropIfExists('custom_reports');
        Schema::dropIfExists('custom_training_modules');
        Schema::dropIfExists('custom_committee_positions');
        Schema::dropIfExists('custom_membership_tiers');
    }
};
```

### **5.2 ANOTHER EXAMPLE: Custom migration for a different party**

**File: `app/contexts/platform/infrastructure/database/migrations/tenant/custom/cpnuml/2024_01_01_999999_create_marxist_study_circles.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Marxist study circles specific to CPN UML
        Schema::create('marxist_study_circles', function (Blueprint $table) {
            $table->id();
            $table->string('circle_name');
            $table->string('circle_name_np');
            $table->foreignId('committee_id')->constrained();
            $table->string('study_topic');
            $table->json('study_materials'); // Marxist literature
            $table->date('formation_date');
            $table->json('members'); // Study circle members
            $table->json('schedule'); // Regular meeting schedule
            $table->json('discussion_topics');
            $table->json('outcomes');
            $table->enum('status', ['active', 'completed', 'suspended']);
            $table->timestamps();
        });

        // Party cell structure (specific to communist parties)
        Schema::create('party_cells', function (Blueprint $table) {
            $table->id();
            $table->string('cell_name');
            $table->foreignId('ward_committee_id')->constrained('committees');
            $table->json('cell_members');
            $table->string('cell_secretary');
            $table->json('cell_activities');
            $table->json('ideological_studies');
            $table->json('mass_contact_programs');
            $table->enum('cell_type', ['workplace', 'educational', 'community', 'special']);
            $table->integer('total_members');
            $table->integer('active_members');
            $table->json('performance_metrics');
            $table->timestamps();
        });

        // Revolutionary fund collection
        Schema::create('revolutionary_funds', function (Blueprint $table) {
            $table->id();
            $table->string('fund_name');
            $table->text('purpose');
            $table->decimal('target_amount', 15, 2);
            $table->decimal('collected_amount', 15, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->json('collection_methods');
            $table->json('collectors');
            $table->json('utilization_plan');
            $table->enum('fund_status', ['active', 'completed', 'suspended']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revolutionary_funds');
        Schema::dropIfExists('party_cells');
        Schema::dropIfExists('marxist_study_circles');
    }
};
```

## **6. MIGRATION REGISTRY AND VERSION CONTROL**

**File: `app/contexts/platform/infrastructure/database/migrations/tenant/registry/2024_01_01_000000_create_migration_registry.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Registry to track all tenant migrations
        Schema::create('tenant_migration_registry', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->enum('migration_layer', ['basic', 'template', 'module', 'custom']);
            $table->string('migration_type')->nullable(); // template_name or module_name
            $table->string('migration_name');
            $table->string('migration_path');
            $table->string('migration_hash'); // MD5 of migration file
            $table->string('batch_id'); // Provisioning batch
            $table->timestamp('applied_at');
            $table->json('applied_by')->nullable(); // System or user
            $table->enum('status', ['pending', 'applied', 'failed', 'rolled_back']);
            $table->text('error_message')->nullable();
            $table->json('execution_time')->nullable();
            $table->timestamps();
            
            $table->unique(['tenant_id', 'migration_hash']);
            $table->index(['tenant_id', 'migration_layer', 'status']);
            $table->index('batch_id');
        });

        // Schema snapshots for drift detection
        Schema::create('tenant_schema_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->string('snapshot_name');
            $table->string('snapshot_hash'); // MD5 of schema
            $table->json('schema_structure'); // Complete schema JSON
            $table->json('table_definitions');
            $table->json('index_definitions');
            $table->json('foreign_key_definitions');
            $table->json('trigger_definitions');
            $table->timestamp('snapshot_taken_at');
            $table->string('provisioning_version');
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->index(['tenant_id', 'snapshot_hash']);
            $table->index('snapshot_taken_at');
        });

        // Template and module dependencies
        Schema::create('template_module_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('tenant_templates');
            $table->foreignId('module_id')->constrained('template_modules');
            $table->enum('dependency_type', ['required', 'recommended', 'optional', 'conflicting']);
            $table->integer('order')->default(0);
            $table->json('conditions')->nullable(); // Conditional dependencies
            $table->timestamps();
            
            $table->unique(['template_id', 'module_id']);
            $table->index('dependency_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('template_module_dependencies');
        Schema::dropIfExists('tenant_schema_snapshots');
        Schema::dropIfExists('tenant_migration_registry');
    }
};
```

## **7. MIGRATION CONFIGURATION FILE**

**File: `config/tenant-migrations.php`**

```php
<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Tenant Migration Structure
    |--------------------------------------------------------------------------
    |
    | This configuration defines the structure for tenant migrations
    | across different layers: basic, template, module, and custom.
    |
    */
    
    'layers' => [
        'basic' => [
            'path' => database_path('migrations/tenant/basic'),
            'order' => 1,
            'description' => 'Foundation migrations for all tenants',
        ],
        
        'template' => [
            'path' => database_path('migrations/tenant/templates'),
            'order' => 2,
            'description' => 'Template-specific migrations',
        ],
        
        'module' => [
            'path' => database_path('migrations/tenant/modules'),
            'order' => 3,
            'description' => 'Optional module migrations',
        ],
        
        'custom' => [
            'path' => database_path('migrations/tenant/custom'),
            'order' => 4,
            'description' => 'Tenant-specific custom migrations',
        ],
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Migration Processing
    |--------------------------------------------------------------------------
    */
    
    'processing' => [
        'batch_size' => 100,
        'timeout' => 300, // seconds
        'memory_limit' => '256M',
        'disable_foreign_keys' => false,
        'skip_on_error' => false,
        'rollback_on_error' => true,
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Schema Management
    |--------------------------------------------------------------------------
    */
    
    'schema' => [
        'snapshot_enabled' => true,
        'drift_detection_enabled' => true,
        'auto_fix_drift' => false,
        'backup_before_changes' => true,
        'max_schema_history' => 10, // Keep last 10 schema snapshots
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Nepali Context Specific Configurations
    |--------------------------------------------------------------------------
    */
    
    'nepali_context' => [
        'provinces' => 7,
        'districts' => 77,
        'languages' => ['en', 'np'],
        'default_currency' => 'NPR',
        'date_format' => 'BS', // Bikram Sambat
        'address_structure' => [
            'levels' => ['province', 'district', 'municipality', 'ward'],
            'required' => ['province', 'district', 'municipality', 'ward'],
        ],
        'citizenship' => [
            'required' => true,
            'validation_rules' => 'regex:/^[0-9]{1,2}-[0-9]{2}-[0-9]{2}-[0-9]{5}$/',
        ],
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Election Commission Compliance
    |--------------------------------------------------------------------------
    */
    
    'election_commission' => [
        'financial_reporting' => [
            'frequency' => 'quarterly',
            'deadline_days' => 30,
            'required_documents' => [
                'income_statement',
                'balance_sheet',
                'donation_details',
                'expense_details',
            ],
        ],
        'donation_limits' => [
            'individual' => 1000000, // 10 lakh NPR
            'organization' => 5000000, // 50 lakh NPR
            'foreign' => 0, // Not allowed
        ],
        'reporting_years' => 'fiscal_year', // Shrawan 1 to Ashad 31
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Template Definitions
    |--------------------------------------------------------------------------
    */
    
    'templates' => [
        'political_party_nepal' => [
            'name' => 'Nepali Political Party',
            'required_modules' => ['membership', 'finance_tracking'],
            'optional_modules' => ['election_campaign', 'social_media'],
            'features' => [
                'committee_hierarchy',
                'election_commission_compliance',
                'nepali_citizen_validation',
                'multi_language_support',
            ],
        ],
        'non_profit_organization' => [
            'name' => 'Non-Profit Organization',
            'required_modules' => ['donor_management', 'project_tracking'],
            'features' => [
                'volunteer_management',
                'grant_tracking',
                'impact_reporting',
            ],
        ],
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Module Definitions
    |--------------------------------------------------------------------------
    */
    
    'modules' => [
        'election_campaign' => [
            'name' => 'Election Campaign Management',
            'dependencies' => ['membership'],
            'tables' => [
                'election_types',
                'constituencies',
                'candidates',
                'campaign_activities',
                'voting_stations',
                'election_results',
            ],
        ],
        'social_media' => [
            'name' => 'Social Media Management',
            'dependencies' => [],
            'tables' => [
                'social_platforms',
                'social_posts',
                'social_comments',
                'social_influencers',
            ],
        ],
        'finance_tracking' => [
            'name' => 'Financial Tracking & Compliance',
            'dependencies' => [],
            'tables' => [
                'fiscal_years',
                'donors',
                'donations',
                'expenses',
                'financial_reports',
            ],
        ],
    ],
];
```

## **8. SEEDERS FOR NEPALI CONTEXT**

**File: `database/seeders/NepaliContextSeeder.php`**

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class NepaliContextSeeder extends Seeder
{
    /**
     * Seed the Nepali administrative divisions
     */
    public function run(): void
    {
        // Seed provinces (7 provinces of Nepal)
        $provinces = [
            ['name' => 'Province 1', 'name_np' => 'प्रदेश १', 'code' => '1', 'capital' => 'Biratnagar', 'total_districts' => 14],
            ['name' => 'Province 2', 'name_np' => 'प्रदेश २', 'code' => '2', 'capital' => 'Janakpur', 'total_districts' => 8],
            ['name' => 'Bagmati Province', 'name_np' => 'बाग्मती प्रदेश', 'code' => '3', 'capital' => 'Hetauda', 'total_districts' => 13],
            ['name' => 'Gandaki Province', 'name_np' => 'गण्डकी प्रदेश', 'code' => '4', 'capital' => 'Pokhara', 'total_districts' => 11],
            ['name' => 'Lumbini Province', 'name_np' => 'लुम्बिनी प्रदेश', 'code' => '5', 'capital' => 'Butwal', 'total_districts' => 12],
            ['name' => 'Karnali Province', 'name_np' => 'कर्णाली प्रदेश', 'code' => '6', 'capital' => 'Birendranagar', 'total_districts' => 10],
            ['name' => 'Sudurpashchim Province', 'name_np' => 'सुदूरपश्चिम प्रदेश', 'code' => '7', 'capital' => 'Dhangadhi', 'total_districts' => 9],
        ];

        foreach ($provinces as $province) {
            DB::table('provinces')->insert($province);
        }

        // Seed districts (77 districts of Nepal - sample data)
        $districts = [
            // Province 1 districts
            ['name' => 'Jhapa', 'name_np' => 'झापा', 'code' => '0101', 'province_id' => 1, 'headquarter' => 'Bhadrapur', 'area_sq_km' => 1606],
            ['name' => 'Morang', 'name_np' => 'मोरंग', 'code' => '0102', 'province_id' => 1, 'headquarter' => 'Biratnagar', 'area_sq_km' => 1855],
            ['name' => 'Sunsari', 'name_np' => 'सुनसरी', 'code' => '0103', 'province_id' => 1, 'headquarter' => 'Inaruwa', 'area_sq_km' => 1257],
            
            // Province 2 districts
            ['name' => 'Saptari', 'name_np' => 'सप्तरी', 'code' => '0201', 'province_id' => 2, 'headquarter' => 'Rajbiraj', 'area_sq_km' => 1363],
            ['name' => 'Siraha', 'name_np' => 'सिराहा', 'code' => '0202', 'province_id' => 2, 'headquarter' => 'Siraha', 'area_sq_km' => 1188],
            
            // Continue for all 77 districts...
        ];

        foreach ($districts as $district) {
            DB::table('districts')->insert($district);
        }

        // Seed languages
        DB::table('languages')->insert([
            ['code' => 'en', 'name' => 'English', 'native_name' => 'English', 'direction' => 'ltr', 'is_active' => true, 'is_default' => true],
            ['code' => 'np', 'name' => 'Nepali', 'native_name' => 'नेपाली', 'direction' => 'ltr', 'is_active' => true, 'is_default' => false],
        ]);

        // Seed committee types
        $committeeTypes = [
            ['name' => 'Central Committee', 'slug' => 'central', 'hierarchy_level' => '1', 'term_years' => 5, 'required_positions' => ['Chairperson', 'Vice-chairperson', 'General Secretary', 'Secretary', 'Treasurer']],
            ['name' => 'Provincial Committee', 'slug' => 'provincial', 'hierarchy_level' => '2', 'term_years' => 5, 'required_positions' => ['Chairperson', 'Secretary', 'Treasurer']],
            ['name' => 'District Committee', 'slug' => 'district', 'hierarchy_level' => '3', 'term_years' => 5, 'required_positions' => ['Chairperson', 'Secretary', 'Treasurer']],
            ['name' => 'Ward Committee', 'slug' => 'ward', 'hierarchy_level' => '4', 'term_years' => 5, 'required_positions' => ['Chairperson', 'Secretary']],
            ['name' => 'Disciplinary Committee', 'slug' => 'disciplinary', 'hierarchy_level' => 'special', 'term_years' => 3, 'required_positions' => ['Chairperson', 'Member Secretary']],
            ['name' => 'Financial Committee', 'slug' => 'financial', 'hierarchy_level' => 'special', 'term_years' => 2, 'required_positions' => ['Chairperson', 'Treasurer']],
        ];

        foreach ($committeeTypes as $type) {
            DB::table('committee_types')->insert($type);
        }
    }
}
```

## **9. COMPLETE DIRECTORY STRUCTURE SUMMARY**

Here's the complete directory structure we've created:

```
database/
├── migrations/
│   ├── tenant/
│   │   ├── basic/
│   │   │   └── 2024_01_01_000001_create_basic_tenant_tables.php
│   │   ├── templates/
│   │   │   ├── political_party_nepal/
│   │   │   │   ├── 2024_01_01_000002_create_political_party_foundation.php
│   │   │   │   └── 2024_01_01_000003_create_financial_compliance_tables.php
│   │   │   ├── non_profit_organization/
│   │   │   ├── community_group/
│   │   │   └── student_union/
│   │   ├── modules/
│   │   │   ├── election_campaign/
│   │   │   │   └── 2024_01_01_000004_create_election_campaign_tables.php
│   │   │   ├── social_media/
│   │   │   │   └── 2024_01_01_000005_create_social_media_tables.php
│   │   │   ├── finance_tracking/
│   │   │   └── membership_management/
│   │   ├── custom/
│   │   │   ├── nepali-congress/
│   │   │   │   └── 2024_01_01_999999_create_custom_membership_tiers.php
│   │   │   ├── cpnuml/
│   │   │   │   └── 2024_01_01_999999_create_marxist_study_circles.php
│   │   │   └── {other-tenant-slugs}/
│   │   └── registry/
│   │       └── 2024_01_01_000000_create_migration_registry.php
│   └── 2014_10_12_000000_create_users_table.php
│   └── 2014_10_12_100000_create_password_reset_tokens_table.php
│   └── ... (other landlord migrations)
├── seeders/
│   ├── DatabaseSeeder.php
│   └── NepaliContextSeeder.php
└── factories/
```

## **10. NEXT STEPS IMPLEMENTATION PLAN**

Now that we have the migration directory structure, here's what we should implement next:

### **Immediate Next Steps:**

1. **Create the `TenantProvisioner` Service Class:**
   ```php
   // app/Services/TenantProvisioner.php
   // This will handle the 4-layer migration processing
   ```

2. **Implement Migration Loader:**
   ```php
   // app/Services/TenantMigrationLoader.php
   // Will discover and load migrations from appropriate directories
   ```

3. **Create Schema Snapshot Service:**
   ```php
   // app/Services/SchemaSnapshotService.php
   // For drift detection and schema comparison
   ```

4. **Build Admin Interface Components:**
   - Template selection dropdown
   - Module multi-select with dependencies
   - Provisioning progress tracker
   - Schema drift detection UI

5. **Implement Queue Jobs for Provisioning:**
   ```php
   // app/Jobs/ProvisionTenantDatabase.php
   // Handle provisioning in background jobs
   ```

### **Would you like me to:**
1. **Implement the `TenantProvisioner` service class next?**
2. **Create the admin interface components in Filament?**
3. **Build the schema snapshot and drift detection system?**
4. **Create the queue jobs for background provisioning?**

Let me know which component you'd like to tackle first!