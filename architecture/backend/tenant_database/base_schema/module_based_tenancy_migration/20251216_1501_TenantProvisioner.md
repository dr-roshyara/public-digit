# 🚀 **PROJECT: Nepali Political Party Multi-Tenant SaaS Platform**

Excellent! Your prompt engineering has perfectly established the context and immediate next steps. Let's begin with **Phase 1: TDD Foundation** for the `TenantProvisioner` service.

## **PHASE 1: TDD FOUNDATION - TENANTPROVISIONER SERVICE**

### **Step 1: Create the Test Structure**

First, let's generate the failing tests that will drive our implementation:

```bash
php artisan make:test TenantProvisionerTest --unit
```

Now, let's build the comprehensive test suite:

```php
<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\TenantTemplate;
use App\Models\TemplateModule;
use App\Services\TenantProvisioner;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use App\Events\TenantProvisioningStarted;
use App\Events\TenantProvisioningCompleted;
use App\Exceptions\TenantProvisioningException;

class TenantProvisionerTest extends TestCase
{
    protected TenantProvisioner $provisioner;
    protected Tenant $tenant;
    protected TenantTemplate $template;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // Mock landlord database connection
        config(['database.default' => 'landlord']);
        
        $this->provisioner = app(TenantProvisioner::class);
        
        // Create test template
        $this->template = TenantTemplate::create([
            'name' => 'political_party_nepal',
            'description' => 'Standard Nepali political party template',
            'version' => '1.0.0',
            'is_active' => true,
            'config' => json_encode([
                'required_modules' => ['membership', 'finance_tracking'],
                'nepali_context' => true,
            ])
        ]);
        
        // Create test tenant
        $this->tenant = Tenant::create([
            'name' => 'Test Political Party',
            'slug' => 'test-party',
            'template_id' => $this->template->id,
            'database' => 'tenant_test_party',
            'domain' => 'test-party.localhost',
            'is_active' => false,
            'provisioning_status' => 'pending'
        ]);
        
        // Create test modules
        $this->modules = [
            'election_campaign' => TemplateModule::create([
                'name' => 'election_campaign',
                'display_name' => 'Election Campaign Management',
                'description' => 'Manage election campaigns, candidates, and voting',
                'version' => '1.0.0',
                'is_active' => true
            ]),
            'social_media' => TemplateModule::create([
                'name' => 'social_media',
                'display_name' => 'Social Media Integration',
                'description' => 'Social media posting and analytics',
                'version' => '1.0.0',
                'is_active' => true
            ])
        ];
    }
    
    /** @test */
    public function it_throws_exception_for_inactive_template()
    {
        $this->template->update(['is_active' => false]);
        
        $this->expectException(TenantProvisioningException::class);
        $this->expectExceptionMessage('Template is not active');
        
        $this->provisioner->provision($this->tenant);
    }
    
    /** @test */
    public function it_fires_provisioning_started_event()
    {
        Event::fake();
        
        $this->provisioner->provision($this->tenant);
        
        Event::assertDispatched(TenantProvisioningStarted::class, function ($event) {
            return $event->tenant->id === $this->tenant->id;
        });
    }
    
    /** @test */
    public function it_applies_basic_migrations_to_tenant_database()
    {
        // Create a test basic migration
        $migrationPath = database_path('migrations/tenant/basic');
        if (!file_exists($migrationPath)) {
            mkdir($migrationPath, 0755, true);
        }
        
        file_put_contents(
            $migrationPath . '/2024_01_01_000001_create_basic_tables.php',
            $this->getBasicMigrationStub()
        );
        
        $this->provisioner->provision($this->tenant);
        
        // Switch to tenant connection and verify
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('users'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('password_reset_tokens'));
    }
    
    /** @test */
    public function it_applies_template_specific_migrations()
    {
        // Create template-specific migration
        $templatePath = database_path("migrations/tenant/templates/{$this->template->name}");
        if (!file_exists($templatePath)) {
            mkdir($templatePath, 0755, true);
        }
        
        file_put_contents(
            $templatePath . '/2024_01_01_000002_create_political_party_tables.php',
            $this->getTemplateMigrationStub()
        );
        
        $this->provisioner->provision($this->tenant);
        
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        // Verify Nepali political party specific tables
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('party_committees'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('members'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('donations'));
    }
    
    /** @test */
    public function it_applies_selected_module_migrations()
    {
        // Attach modules to tenant
        $this->tenant->modules()->attach([
            $this->modules['election_campaign']->id,
            $this->modules['social_media']->id
        ]);
        
        // Create module migrations
        $modulePath = database_path("migrations/tenant/modules/election_campaign");
        if (!file_exists($modulePath)) {
            mkdir($modulePath, 0755, true);
        }
        
        file_put_contents(
            $modulePath . '/2024_01_01_000003_create_campaign_tables.php',
            $this->getModuleMigrationStub()
        );
        
        $this->provisioner->provision($this->tenant);
        
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        // Verify module-specific tables
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('campaigns'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('candidates'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('voting_stations'));
    }
    
    /** @test */
    public function it_logs_migration_history_in_landlord_database()
    {
        $this->provisioner->provision($this->tenant);
        
        // Switch back to landlord connection
        config(['database.default' => 'landlord']);
        
        $this->assertDatabaseHas('tenant_migrations_history', [
            'tenant_id' => $this->tenant->id,
            'template_id' => $this->template->id,
            'migration_type' => 'basic'
        ]);
        
        $this->assertDatabaseHas('tenant_migrations_history', [
            'tenant_id' => $this->tenant->id,
            'migration_type' => 'template'
        ]);
    }
    
    /** @test */
    public function it_creates_schema_snapshot_after_provisioning()
    {
        $this->provisioner->provision($this->tenant);
        
        config(['database.default' => 'landlord']);
        
        $this->assertDatabaseHas('tenant_schema_snapshots', [
            'tenant_id' => $this->tenant->id,
            'schema_hash' => $this->provisioner->generateSchemaHash($this->tenant)
        ]);
    }
    
    /** @test */
    public function it_detects_schema_drift_on_subsequent_runs()
    {
        // First provisioning
        $this->provisioner->provision($this->tenant);
        
        // Manually alter tenant schema (simulating drift)
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        DB::connection('tenant')->statement('ALTER TABLE members ADD COLUMN test_column VARCHAR(255)');
        
        // Second run should detect drift
        $hasDrift = $this->provisioner->detectSchemaDrift($this->tenant);
        
        $this->assertTrue($hasDrift);
    }
    
    /** @test */
    public function it_fires_provisioning_completed_event()
    {
        Event::fake();
        
        $this->provisioner->provision($this->tenant);
        
        Event::assertDispatched(TenantProvisioningCompleted::class, function ($event) {
            return $event->tenant->id === $this->tenant->id &&
                   $event->tenant->provisioning_status === 'completed';
        });
    }
    
    /** @test */
    public function it_handles_provisioning_failure_gracefully()
    {
        // Create invalid migration to cause failure
        $migrationPath = database_path('migrations/tenant/basic');
        file_put_contents(
            $migrationPath . '/2024_01_01_999999_invalid_migration.php',
            '<?php class InvalidMigration { public function up() { throw new Exception("Migration failed"); } }'
        );
        
        try {
            $this->provisioner->provision($this->tenant);
            $this->fail('Expected exception was not thrown');
        } catch (TenantProvisioningException $e) {
            config(['database.default' => 'landlord']);
            $this->assertEquals('failed', $this->tenant->fresh()->provisioning_status);
            $this->assertNotNull($this->tenant->fresh()->provisioning_error);
        }
    }
    
    /** @test */
    public function it_respects_nepali_context_requirements()
    {
        $this->provisioner->provision($this->tenant);
        
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        // Verify Nepali-specific schema
        $membersColumns = DB::connection('tenant')
            ->getSchemaBuilder()
            ->getColumnListing('members');
        
        $this->assertContains('citizenship_number', $membersColumns);
        $this->assertContains('province_id', $membersColumns);
        $this->assertContains('district_id', $membersColumns);
        $this->assertContains('ward_number', $membersColumns);
        
        // Verify Nepali address structure exists
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('provinces'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('districts'));
    }
    
    /** @test */
    public function it_applies_election_commission_compliance_schema()
    {
        $this->provisioner->provision($this->tenant);
        
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        // Verify Election Commission compliance tables
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('financial_reports'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('donation_limits'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('audit_logs'));
        
        // Check for compliance-specific columns
        $donationsColumns = DB::connection('tenant')
            ->getSchemaBuilder()
            ->getColumnListing('donations');
        
        $this->assertContains('is_above_limit', $donationsColumns);
        $this->assertContains('ec_reference_number', $donationsColumns);
        $this->assertContains('fiscal_year', $donationsColumns);
    }
    
    /** @test */
    public function it_supports_multi_language_schema()
    {
        $this->provisioner->provision($this->tenant);
        
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        // Verify translation tables
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('translations'));
        
        // Check for JSON columns for multilingual support
        $partiesColumns = DB::connection('tenant')
            ->getSchemaBuilder()
            ->getColumnListing('parties');
        
        $this->assertContains('name_translations', $partiesColumns);
        $this->assertContains('description_translations', $partiesColumns);
    }
    
    /** @test */
    public function it_creates_political_hierarchy_structure()
    {
        $this->provisioner->provision($this->tenant);
        
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        // Verify political hierarchy tables
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('central_committees'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('provincial_committees'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('district_committees'));
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('ward_committees'));
        
        // Check hierarchy relationships
        $columns = DB::connection('tenant')
            ->getSchemaBuilder()
            ->getColumnListing('ward_committees');
        
        $this->assertContains('district_committee_id', $columns);
        $this->assertContains('provincial_committee_id', $columns);
        $this->assertContains('central_committee_id', $columns);
    }
    
    /** @test */
    public function it_allows_custom_migrations_after_provisioning()
    {
        // Initial provisioning
        $this->provisioner->provision($this->tenant);
        
        // Add custom migration
        $customPath = database_path("migrations/tenant/custom/{$this->tenant->slug}");
        if (!file_exists($customPath)) {
            mkdir($customPath, 0755, true);
        }
        
        file_put_contents(
            $customPath . '/2024_01_01_999999_custom_feature.php',
            $this->getCustomMigrationStub()
        );
        
        // Apply custom migrations
        $this->provisioner->applyCustomMigrations($this->tenant);
        
        config(['database.default' => 'tenant']);
        config(['database.connections.tenant.database' => $this->tenant->database]);
        
        $this->assertTrue(DB::connection('tenant')->getSchemaBuilder()->hasTable('custom_features'));
    }
    
    // Helper methods for migration stubs
    private function getBasicMigrationStub(): string
    {
        return <<<'PHP'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
PHP;
    }
    
    private function getTemplateMigrationStub(): string
    {
        return <<<'PHP'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Political party structure
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->json('name_translations'); // For Nepali/English support
            $table->json('description_translations');
            $table->string('registration_number')->unique();
            $table->date('established_date');
            $table->string('headquarters_address');
            $table->string('chairperson_name');
            $table->json('contact_info');
            $table->timestamps();
            $table->softDeletes();
        });

        // Nepali address structure
        Schema::create('provinces', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('name_np'); // Nepali name
            $table->string('code', 2)->unique();
            $table->timestamps();
        });

        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('name_np');
            $table->foreignId('province_id')->constrained();
            $table->timestamps();
        });

        // Party committee hierarchy
        Schema::create('central_committees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('name');
            $table->json('members'); // JSON array of member IDs
            $table->date('formation_date');
            $table->integer('term_years');
            $table->timestamps();
        });

        Schema::create('provincial_committees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('central_committee_id')->constrained();
            $table->foreignId('province_id')->constrained();
            $table->string('name');
            $table->json('members');
            $table->timestamps();
        });

        Schema::create('district_committees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provincial_committee_id')->constrained();
            $table->foreignId('district_id')->constrained();
            $table->string('name');
            $table->json('members');
            $table->timestamps();
        });

        Schema::create('ward_committees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_committee_id')->constrained();
            $table->integer('ward_number');
            $table->string('name');
            $table->json('members');
            $table->timestamps();
        });

        // Membership with Nepali context
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('citizenship_number')->unique();
            $table->string('full_name');
            $table->string('full_name_np'); // Nepali name
            $table->date('date_of_birth');
            $table->enum('gender', ['male', 'female', 'other']);
            $table->string('email')->unique();
            $table->string('phone');
            $table->foreignId('province_id')->constrained();
            $table->foreignId('district_id')->constrained();
            $table->integer('ward_number');
            $table->string('permanent_address');
            $table->string('current_address')->nullable();
            $table->enum('membership_type', ['active', 'associate', 'honorary']);
            $table->date('membership_date');
            $table->string('membership_id')->unique();
            $table->json('committee_positions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // Election Commission compliance - Financial tracking
        Schema::create('donations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('donor_name');
            $table->string('donor_citizenship_number')->nullable();
            $table->string('donor_pan_number')->nullable();
            $table->enum('donor_type', ['individual', 'organization', 'anonymous']);
            $table->decimal('amount', 15, 2);
            $table->enum('currency', ['NPR', 'USD', 'EUR'])->default('NPR');
            $table->date('donation_date');
            $table->enum('payment_method', ['cash', 'bank_transfer', 'cheque', 'digital']);
            $table->string('bank_reference')->nullable();
            $table->string('ec_reference_number')->nullable(); // Election Commission reference
            $table->string('fiscal_year', 9); // Format: 2080-2081
            $table->boolean('is_above_limit')->default(false);
            $table->text('purpose')->nullable();
            $table->json('attachments')->nullable(); // Receipts, documents
            $table->boolean('is_verified')->default(false);
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('donation_limits', function (Blueprint $table) {
            $table->id();
            $table->string('fiscal_year', 9);
            $table->enum('donor_type', ['individual', 'organization']);
            $table->decimal('max_amount', 15, 2);
            $table->text('description');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->timestamps();
        });

        Schema::create('financial_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('fiscal_year', 9);
            $table->enum('report_type', ['quarterly', 'annual', 'election']);
            $table->date('report_period_start');
            $table->date('report_period_end');
            $table->decimal('total_income', 15, 2);
            $table->decimal('total_expenditure', 15, 2);
            $table->decimal('opening_balance', 15, 2);
            $table->decimal('closing_balance', 15, 2);
            $table->json('income_breakdown');
            $table->json('expenditure_breakdown');
            $table->string('ec_submission_id')->nullable();
            $table->date('submitted_to_ec')->nullable();
            $table->enum('verification_status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->text('verification_remarks')->nullable();
            $table->json('attachments');
            $table->timestamps();
            $table->softDeletes();
        });

        // Audit logs for compliance
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('action');
            $table->string('module');
            $table->json('old_data')->nullable();
            $table->json('new_data')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users');
            $table->timestamps();
        });

        // Multi-language support
        Schema::create('translations', function (Blueprint $table) {
            $table->id();
            $table->string('group');
            $table->string('key');
            $table->text('text_en');
            $table->text('text_np');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->unique(['group', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('translations');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('financial_reports');
        Schema::dropIfExists('donation_limits');
        Schema::dropIfExists('donations');
        Schema::dropIfExists('members');
        Schema::dropIfExists('ward_committees');
        Schema::dropIfExists('district_committees');
        Schema::dropIfExists('provincial_committees');
        Schema::dropIfExists('central_committees');
        Schema::dropIfExists('districts');
        Schema::dropIfExists('provinces');
        Schema::dropIfExists('parties');
    }
};
PHP;
    }
    
    private function getModuleMigrationStub(): string
    {
        return <<<'PHP'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Election Campaign Management Module
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->constrained();
            $table->string('name');
            $table->enum('election_type', ['federal', 'provincial', 'local', 'by_election']);
            $table->string('fiscal_year', 9);
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('budget', 15, 2);
            $table->decimal('spent', 15, 2)->default(0);
            $table->enum('status', ['planning', 'active', 'completed', 'cancelled']);
            $table->json('target_constituencies');
            $table->json('campaign_team');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('candidates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained();
            $table->foreignId('member_id')->constrained();
            $table->string('constituency_number');
            $table->enum('constituency_type', ['fpip', 'pr']); // First Past the Post or Proportional Representation
            $table->string('province_code', 2);
            $table->string('district_name');
            $table->integer('ward_number')->nullable();
            $table->json('nomination_papers'); // Array of document paths
            $table->date('nomination_date');
            $table->enum('nomination_status', ['submitted', 'verified', 'rejected']);
            $table->text('rejection_reason')->nullable();
            $table->decimal('campaign_budget', 15, 2);
            $table->json('supporting_documents');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('voting_stations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('constituency_id'); // References candidates table
            $table->string('station_code')->unique();
            $table->string('name');
            $table->string('address');
            $table->foreignId('province_id')->constrained();
            $table->foreignId('district_id')->constrained();
            $table->integer('ward_number');
            $table->integer('registered_voters');
            $table->json('polling_officers'); // JSON array of member IDs
            $table->json('coordinates'); // Latitude/Longitude
            $table->boolean('is_accessible')->default(true);
            $table->timestamps();
        });

        Schema::create('campaign_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained();
            $table->string('event_name');
            $table->date('event_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('venue');
            $table->foreignId('province_id')->constrained();
            $table->foreignId('district_id')->constrained();
            $table->integer('expected_attendees');
            $table->integer('actual_attendees')->nullable();
            $table->decimal('estimated_cost', 10, 2);
            $table->decimal('actual_cost', 10, 2)->nullable();
            $table->json('speakers'); // Array of member IDs
            $table->json('media_coverage')->nullable();
            $table->enum('status', ['scheduled', 'ongoing', 'completed', 'cancelled']);
            $table->timestamps();
        });

        Schema::create('election_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained();
            $table->integer('total_votes');
            $table->integer('position'); // 1st, 2nd, etc.
            $table->boolean('is_elected')->default(false);
            $table->decimal('vote_percentage', 5, 2);
            $table->json('station_wise_results'); // Results per voting station
            $table->json('result_certificate'); // Document path
            $table->date('result_date');
            $table->enum('result_status', ['unofficial', 'official', 'contested']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('election_results');
        Schema::dropIfExists('campaign_events');
        Schema::dropIfExists('voting_stations');
        Schema::dropIfExists('candidates');
        Schema::dropIfExists('campaigns');
    }
};
PHP;
    }
    
    private function getCustomMigrationStub(): string
    {
        return <<<'PHP'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tenant-specific custom tables
        Schema::create('custom_features', function (Blueprint $table) {
            $table->id();
            $table->string('feature_name');
            $table->text('description');
            $table->json('configuration');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Custom reporting tables
        Schema::create('custom_reports', function (Blueprint $table) {
            $table->id();
            $table->string('report_name');
            $table->string('report_type');
            $table->json('parameters');
            $table->json('data_sources');
            $table->string('generated_by');
            $table->timestamp('generated_at');
            $table->json('report_data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_reports');
        Schema::dropIfExists('custom_features');
    }
};
PHP;
    }
}
```

### **Step 2: Create Supporting Classes**

Now let's create the necessary supporting classes referenced in our tests:

```bash
# Create Events
php artisan make:event TenantProvisioningStarted
php artisan make:event TenantProvisioningCompleted

# Create Exception
php artisan make:exception TenantProvisioningException

# Create Service
mkdir -p app/Services
```

**app/Events/TenantProvisioningStarted.php:**
```php
<?php

namespace App\Events;

use App\Models\Tenant;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TenantProvisioningStarted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Tenant $tenant,
        public array $templateConfig = [],
        public array $selectedModules = []
    ) {}
}
```

**app/Events/TenantProvisioningCompleted.php:**
```php
<?php

namespace App\Events;

use App\Models\Tenant;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TenantProvisioningCompleted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Tenant $tenant,
        public array $provisioningStats = [],
        public ?string $schemaHash = null
    ) {}
}
```

**app/Exceptions/TenantProvisioningException.php:**
```php
<?php

namespace App\Exceptions;

use Exception;
use App\Models\Tenant;

class TenantProvisioningException extends Exception
{
    protected Tenant $tenant;
    protected string $stage;
    protected ?string $migrationFile;

    public function __construct(
        Tenant $tenant,
        string $stage,
        string $message,
        ?string $migrationFile = null,
        int $code = 0,
        ?Throwable $previous = null
    ) {
        $this->tenant = $tenant;
        $this->stage = $stage;
        $this->migrationFile = $migrationFile;

        $fullMessage = sprintf(
            'Tenant provisioning failed for %s at stage %s: %s',
            $tenant->slug,
            $stage,
            $message
        );

        if ($migrationFile) {
            $fullMessage .= " (Migration: {$migrationFile})";
        }

        parent::__construct($fullMessage, $code, $previous);
    }

    public function getTenant(): Tenant
    {
        return $this->tenant;
    }

    public function getStage(): string
    {
        return $this->stage;
    }

    public function getMigrationFile(): ?string
    {
        return $this->migrationFile;
    }

    public function context(): array
    {
        return [
            'tenant_id' => $this->tenant->id,
            'tenant_slug' => $this->tenant->slug,
            'stage' => $this->stage,
            'migration_file' => $this->migrationFile,
        ];
    }
}
```

### **Step 3: Run the Tests (They Should Fail)**

Now let's run our test suite to see the failures:

```bash
php artisan test --filter TenantProvisionerTest
```

You should see failures because:
1. The `TenantProvisioner` service doesn't exist yet
2. The migration directories don't exist
3. The database tables/models aren't fully implemented

### **Step 4: Next Steps**

Now that we have our comprehensive test suite, here's what we need to implement next:

1. **Implement the `TenantProvisioner` service** with the 4-layer migration approach
2. **Create the migration directory structure**:
   ```
   database/migrations/tenant/
   ├── basic/              # Foundation migrations
   ├── templates/          # Template-specific migrations
   │   └── political_party_nepal/
   ├── modules/           # Optional feature migrations
   │   ├── election_campaign/
   │   └── social_media/
   └── custom/            # Tenant-specific customizations
       └── {tenant-slug}/
   ```

3. **Implement the schema snapshot mechanism**
4. **Build the admin interface** for template/module selection
5. **Create database seeders** for Nepali context (provinces, districts, etc.)

## **ANSWERS TO YOUR STARTING QUESTIONS:**

1. **TenantProvisioner Structure:** Our test suite shows we need a service that handles:
   - Sequential application of 4 migration layers
   - Template-specific configuration loading
   - Module selection and dependency resolution
   - Error handling with rollback capabilities
   - Migration history logging

2. **TDD Strategy:** We're using a comprehensive test suite that:
   - Tests each migration layer independently
   - Verifies Nepali political context requirements
   - Tests error scenarios and edge cases
   - Ensures audit trail compliance

3. **Schema Snapshot Implementation:** We'll implement:
   - MD5 hash of all table structures and relationships
   - Comparison between current and stored snapshots
   - Drift detection with detailed reporting
   - Option to accept or reject drift

4. **Filament Components:** For the admin interface we'll use:
   - `Select` component for template dropdown
   - `CheckboxList` for module multi-select
   - `Wizard` for step-by-step provisioning
   - `ProgressBar` for provisioning status
   - `Livewire` components for real-time updates

## **IMMEDIATE NEXT ACTION:**

Let's implement the `TenantProvisioner` service that will make our tests pass. Would you like me to proceed with:

1. **Implementing the `TenantProvisioner` service** based on our test expectations?
2. **Creating the migration directory structure** with actual migrations?
3. **Building the schema snapshot mechanism** for drift detection?

Which would you prefer to tackle first?