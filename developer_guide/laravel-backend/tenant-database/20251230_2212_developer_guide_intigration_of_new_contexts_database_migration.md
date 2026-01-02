# 🏗️ **DEVELOPER GUIDE: Building New Contexts with Platform Migration System**

## 📋 **QUICK START - CREATE A NEW CONTEXT IN 5 MINUTES**

### **1. Create Your Context Structure**
```bash
# Create a new forum context with all necessary folders
php artisan make:context Forum --landlord --tenant --module

# Or create manually:
mkdir -p app/Contexts/Forum/{Application,Domain,Infrastructure}
mkdir -p app/Contexts/Forum/Infrastructure/Database/Migrations/{landlord,tenant}
```

### **2. Define Context Metadata (Optional)**
```php
// app/Contexts/Forum/Context.php
namespace App\Contexts\Forum;

class Context
{
    public static function getMetadata(): array
    {
        return [
            'displayName' => 'Discussion Forum',
            'description' => 'Community discussion boards with threads and comments',
            'version' => '1.0.0',
            'dependencies' => ['module_registry', 'user_management'],
            'requiresSubscription' => true,
            'defaultConfiguration' => [
                'max_categories' => 20,
                'allow_anonymous_posts' => false,
                'moderation_enabled' => true,
            ],
        ];
    }
}
```

### **3. Create Landlord Migrations (Global Tables)**
```bash
# Create global forum configuration table
php artisan make:migration create_forum_global_config \
  --path=app/Contexts/Forum/Infrastructure/Database/Migrations/Landlord
```

```php
// Generated file: .../Migrations/Landlord/2025_01_01_create_forum_global_config.php
Schema::connection('landlord')->create('forum_global_config', function (Blueprint $table) {
    $table->id();
    $table->string('key')->unique();
    $table->jsonb('value'); // Use jsonb for PostgreSQL optimization
    $table->timestampsTz(); // Always use timestampTz with timezone
});

// Add more landlord tables if needed
php artisan make:migration create_forum_categories \
  --path=app/Contexts/Forum/Infrastructure/Database/Migrations/Landlord
```

### **4. Create Tenant Migrations (Tenant-Specific Tables)**
```bash
# Create forum threads table (tenant-specific)
php artisan make:migration create_forum_threads \
  --path=app/Contexts/Forum/Infrastructure/Database/Migrations/Tenant

# Create forum posts table
php artisan make:migration create_forum_posts \
  --path=app/Contexts/Forum/Infrastructure/Database/Migrations/Tenant
```

```php
// Generated file: .../Migrations/Tenant/2025_01_01_create_forum_threads.php
Schema::create('forum_threads', function (Blueprint $table) {
    $table->id();
    
    // REQUIRED: Tenant isolation
    $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
    
    // Tenant-specific data
    $table->foreignId('category_id')->nullable()->constrained('forum_categories');
    $table->foreignId('user_id')->constrained();
    $table->string('title');
    $table->text('content');
    $table->boolean('is_pinned')->default(false);
    $table->boolean('is_locked')->default(false);
    
    // Use PostgreSQL optimizations
    $table->jsonb('metadata')->nullable(); // Not json, use jsonb
    $table->timestampTz('last_activity_at')->nullable(); // With timezone
    
    // Indexes for performance
    $table->index(['tenant_id', 'category_id']);
    $table->index(['tenant_id', 'created_at']);
    $table->index(['tenant_id', 'user_id']);
    
    $table->timestampsTz();
});
```

### **5. Test Your Context**
```bash
# Discover your new context
php artisan context:list
# Should show: Forum with landlord: 1, tenant: 2 migrations

# Preview installation (dry run)
php artisan context:install Forum --dry-run

# Install to landlord database
php artisan context:install Forum

# Install for a specific tenant
php artisan context:install Forum --tenant=acme-corp
```

---

## 🏗️ **COMPLETE EXAMPLE: FINANCE CONTEXT**

### **Step-by-Step Implementation**

#### **1. Create Finance Context**
```bash
php artisan make:context Finance \
  --landlord \           # Global financial settings
  --tenant \            # Tenant-specific transactions
  --module \            # Register in ModuleRegistry
  --force               # Overwrite if exists
```

#### **2. Design Your Database Schema**

**Landlord Tables (Global):**
```php
// app/Contexts/Finance/Infrastructure/Database/Migrations/Landlord/2025_01_01_create_finance_currencies.php
Schema::connection('landlord')->create('finance_currencies', function (Blueprint $table) {
    $table->id();
    $table->string('code', 3)->unique(); // USD, EUR, GBP
    $table->string('name'); // US Dollar
    $table->string('symbol'); // $
    $table->integer('decimal_places')->default(2);
    $table->boolean('is_active')->default(true);
    $table->timestampsTz();
});

// app/Contexts/Finance/Infrastructure/Database/Migrations/Landlord/2025_01_02_create_finance_tax_rates.php
Schema::connection('landlord')->create('finance_tax_rates', function (Blueprint $table) {
    $table->id();
    $table->string('country_code', 2);
    $table->string('region')->nullable();
    $table->decimal('rate', 5, 2); // 19.00 for 19%
    $table->string('name'); // VAT, GST, Sales Tax
    $table->timestampsTz();
    $table->unique(['country_code', 'region']);
});
```

**Tenant Tables (Per-tenant):**
```php
// app/Contexts/Finance/Infrastructure/Database/Migrations/Tenant/2025_01_01_create_finance_accounts.php
Schema::create('finance_accounts', function (Blueprint $table) {
    $table->uuid('id')->primary(); // Use UUID for distributed systems
    
    $table->foreignId('tenant_id')->constrained()->onDelete('cascade'); // REQUIRED
    
    // Account details
    $table->string('name');
    $table->string('type'); // asset, liability, equity, revenue, expense
    $table->string('currency_code', 3);
    $table->decimal('opening_balance', 15, 2)->default(0);
    $table->decimal('current_balance', 15, 2)->default(0);
    $table->boolean('is_active')->default(true);
    
    // Indexes
    $table->index(['tenant_id', 'type']);
    $table->index(['tenant_id', 'currency_code']);
    
    $table->timestampsTz();
});

// app/Contexts/Finance/Infrastructure/Database/Migrations/Tenant/2025_01_02_create_finance_transactions.php
Schema::create('finance_transactions', function (Blueprint $table) {
    $table->uuid('id')->primary();
    
    $table->foreignId('tenant_id')->constrained()->onDelete('cascade'); // REQUIRED
    
    // Transaction details
    $table->date('transaction_date');
    $table->string('reference_number')->nullable();
    $table->text('description');
    $table->decimal('amount', 15, 2);
    $table->string('currency_code', 3);
    
    // Relationships
    $table->foreignUuid('from_account_id')->nullable()->constrained('finance_accounts');
    $table->foreignUuid('to_account_id')->nullable()->constrained('finance_accounts');
    
    // Metadata
    $table->jsonb('metadata')->nullable(); // Invoice ID, payment method, etc.
    $table->string('status')->default('pending'); // pending, posted, voided
    
    // Audit trail
    $table->foreignId('created_by')->nullable()->constrained('users');
    $table->foreignId('approved_by')->nullable()->constrained('users');
    
    // Indexes for querying
    $table->index(['tenant_id', 'transaction_date']);
    $table->index(['tenant_id', 'from_account_id']);
    $table->index(['tenant_id', 'to_account_id']);
    $table->index(['tenant_id', 'status']);
    
    $table->timestampsTz();
});
```

#### **3. Create Domain Models**
```php
// app/Contexts/Finance/Domain/Models/Transaction.php
declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Models;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\TransactionId;
use App\Contexts\Finance\Domain\ValueObjects\AccountId;

final class Transaction
{
    private function __construct(
        private TransactionId $id,
        private AccountId $fromAccountId,
        private AccountId $toAccountId,
        private Money $amount,
        private \DateTimeImmutable $transactionDate,
        private string $description,
        private string $status = 'pending'
    ) {}
    
    public static function create(
        AccountId $fromAccountId,
        AccountId $toAccountId,
        Money $amount,
        string $description
    ): self {
        return new self(
            id: TransactionId::generate(),
            fromAccountId: $fromAccountId,
            toAccountId: $toAccountId,
            amount: $amount,
            transactionDate: new \DateTimeImmutable(),
            description: $description
        );
    }
    
    public function post(): void
    {
        if ($this->status !== 'pending') {
            throw new \DomainException('Transaction already processed');
        }
        
        $this->status = 'posted';
        $this->recordEvent(new TransactionPosted($this->id));
    }
    
    // ... other business methods
}
```

#### **4. Create Application Services**
```php
// app/Contexts/Finance/Application/Services/CreateTransactionHandler.php
declare(strict_types=1);

namespace App\Contexts\Finance\Application\Services;

use App\Contexts\Finance\Domain\Ports\TransactionRepositoryInterface;
use App\Contexts\Finance\Domain\Ports\AccountRepositoryInterface;
use App\Contexts\Finance\Application\Commands\CreateTransactionCommand;

final class CreateTransactionHandler
{
    public function __construct(
        private TransactionRepositoryInterface $transactionRepository,
        private AccountRepositoryInterface $accountRepository
    ) {}
    
    public function handle(CreateTransactionCommand $command): void
    {
        // 1. Validate accounts exist and have sufficient balance
        $fromAccount = $this->accountRepository->findById($command->fromAccountId);
        $toAccount = $this->accountRepository->findById($command->toAccountId);
        
        if (!$fromAccount || !$toAccount) {
            throw new \DomainException('One or both accounts not found');
        }
        
        if (!$fromAccount->canWithdraw($command->amount)) {
            throw new \DomainException('Insufficient funds');
        }
        
        // 2. Create domain entity
        $transaction = Transaction::create(
            fromAccountId: $command->fromAccountId,
            toAccountId: $command->toAccountId,
            amount: $command->amount,
            description: $command->description
        );
        
        // 3. Apply business rules
        $transaction->post();
        
        // 4. Save to repositories
        $this->transactionRepository->save($transaction);
        
        // 5. Update account balances
        $fromAccount->withdraw($command->amount);
        $toAccount->deposit($command->amount);
        
        $this->accountRepository->save($fromAccount);
        $this->accountRepository->save($toAccount);
    }
}
```

#### **5. Create Infrastructure Adapters**
```php
// app/Contexts/Finance/Infrastructure/Adapters/EloquentTransactionRepository.php
declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Adapters;

use App\Contexts\Finance\Domain\Ports\TransactionRepositoryInterface;
use App\Contexts\Finance\Domain\Models\Transaction;
use App\Models\FinanceTransaction as TransactionModel;
use Illuminate\Support\Facades\DB;

final class EloquentTransactionRepository implements TransactionRepositoryInterface
{
    public function save(Transaction $transaction): void
    {
        DB::transaction(function () use ($transaction) {
            TransactionModel::updateOrCreate(
                ['id' => $transaction->id()->toString()],
                [
                    'from_account_id' => $transaction->fromAccountId()->toString(),
                    'to_account_id' => $transaction->toAccountId()->toString(),
                    'amount' => $transaction->amount()->amount(),
                    'currency_code' => $transaction->amount()->currency(),
                    'description' => $transaction->description(),
                    'status' => $transaction->status(),
                    'metadata' => $transaction->metadata(),
                ]
            );
        });
    }
    
    // ... other repository methods
}
```

#### **6. Create Service Provider**
```php
// app/Contexts/Finance/Infrastructure/Providers/FinanceServiceProvider.php
declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use App\Contexts\Finance\Domain\Ports\TransactionRepositoryInterface;
use App\Contexts\Finance\Domain\Ports\AccountRepositoryInterface;
use App\Contexts\Finance\Infrastructure\Adapters\EloquentTransactionRepository;
use App\Contexts\Finance\Infrastructure\Adapters\EloquentAccountRepository;

final class FinanceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind domain ports to infrastructure adapters
        $this->app->bind(TransactionRepositoryInterface::class, EloquentTransactionRepository::class);
        $this->app->bind(AccountRepositoryInterface::class, EloquentAccountRepository::class);
        
        // Register application services
        $this->app->singleton(\App\Contexts\Finance\Application\Services\CreateTransactionHandler::class);
        $this->app->singleton(\App\Contexts\Finance\Application\Services\AccountBalanceService::class);
    }
    
    public function boot(): void
    {
        // Register routes
        $this->loadRoutesFrom(__DIR__ . '/../Routes/api.php');
        
        // Register migrations
        $this->loadMigrationsFrom([
            __DIR__ . '/../Database/Migrations/Landlord',
            __DIR__ . '/../Database/Migrations/Tenant',
        ]);
    }
}
```

#### **7. Test the Complete Flow**
```bash
# 1. List contexts
php artisan context:list --detailed
# Should show Finance with correct migration counts

# 2. Install Finance context
php artisan context:install Finance --dry-run
php artisan context:install Finance --tenant=test-company

# 3. Verify installation
php artisan context:list
# Finance should show as installed for test-company

# 4. Create a test transaction via API
curl -X POST http://localhost/api/v1/finance/transactions \
  -H "Content-Type: application/json" \
  -H "X-Tenant: test-company" \
  -d '{
    "from_account_id": "acc_123",
    "to_account_id": "acc_456", 
    "amount": 100.50,
    "currency": "USD",
    "description": "Monthly subscription payment"
  }'
```

---

## 🔧 **BEST PRACTICES FOR CONTEXT DEVELOPMENT**

### **1. Database Design Rules**
```php
// ✅ DO: Always add tenant_id for tenant tables
$table->foreignId('tenant_id')->constrained()->onDelete('cascade');

// ✅ DO: Use appropriate data types
$table->uuid('id')->primary();          // UUIDs for distributed systems
$table->jsonb('metadata');              // Not json, use jsonb for PostgreSQL
$table->timestampTz('created_at');      // With timezone
$table->decimal('amount', 15, 2);       // Financial amounts

// ✅ DO: Add indexes for common queries
$table->index(['tenant_id', 'status', 'created_at']);
$table->unique(['tenant_id', 'email']); // Tenant-scoped uniqueness

// ❌ DON'T: Hardcode connection names
// Wrong: DB::connection('landlord')->table('your_table')...
// Right: Let Platform system handle connection switching
```

### **2. Domain Layer Purity**
```php
// ✅ Domain Model (Pure Business Logic)
class Invoice
{
    public function applyPayment(Money $payment): void
    {
        if ($this->isPaid()) {
            throw new \DomainException('Invoice already paid');
        }
        
        $this->amountPaid = $this->amountPaid->add($payment);
        
        if ($this->amountPaid->equals($this->totalAmount)) {
            $this->markAsPaid();
        }
    }
}

// ❌ Infrastructure concerns in Domain layer
// Wrong: Using Illuminate\Support\Facades\DB in Domain
// Wrong: Using Eloquent models in Domain
// Wrong: Framework-specific exceptions in Domain
```

### **3. Migration Organization**
```
app/Contexts/{YourContext}/Infrastructure/Database/Migrations/
├── landlord/
│   ├── 2025_01_01_create_global_config.php     # Global settings
│   ├── 2025_01_02_create_lookup_tables.php     # Reference data
│   └── 2025_01_03_create_audit_log.php         # Cross-tenant logs
└── tenant/
    ├── 2025_01_01_create_main_table.php        # Core tenant data
    ├── 2025_01_02_create_related_tables.php    # Related tenant data
    ├── 2025_01_03_create_indexes.php           # Performance indexes
    └── 2025_01_04_add_constraints.php          # Foreign keys
```

### **4. Testing Strategy**
```php
// Unit Tests (Domain Layer)
class InvoiceTest extends TestCase
{
    public function test_cannot_apply_payment_to_paid_invoice(): void
    {
        $invoice = Invoice::create(/* ... */);
        $invoice->markAsPaid();
        
        $this->expectException(\DomainException::class);
        $invoice->applyPayment(Money::USD(100));
    }
}

// Integration Tests (Installation)
class FinanceContextInstallationTest extends TestCase
{
    public function test_can_install_finance_context(): void
    {
        $this->artisan('context:install', ['context' => 'Finance'])
            ->assertExitCode(0);
            
        $this->assertDatabaseHasTable('finance_currencies', 'landlord');
        $this->assertDatabaseHasTable('finance_accounts', 'tenant_test');
    }
}
```

### **5. API Design**
```php
// app/Contexts/Finance/Infrastructure/Routes/api.php
Route::prefix('api/v1/finance')->group(function () {
    // Mobile API (Angular frontend)
    Route::prefix('mapi')->group(function () {
        Route::get('/accounts', [FinanceMobileController::class, 'listAccounts']);
        Route::post('/transactions', [FinanceMobileController::class, 'createTransaction']);
    });
    
    // Desktop API (Vue.js admin)
    Route::prefix('admin')->middleware(['auth', 'admin'])->group(function () {
        Route::get('/reports', [FinanceAdminController::class, 'financialReports']);
        Route::post('/bulk-import', [FinanceAdminController::class, 'bulkImport']);
    });
});
```

---

## 🚀 **COMMON PATTERNS & TEMPLATES**

### **Template 1: E-commerce Context**
```bash
# Create e-commerce module
php artisan make:context Ecommerce --landlord --tenant --module

# Typical tables:
# Landlord: product_catalog, global_tax_rates, shipping_zones
# Tenant: orders, order_items, customer_profiles, inventory
```

### **Template 2: CRM Context**
```bash
# Create CRM module  
php artisan make:context CRM --landlord --tenant --module

# Typical tables:
# Landlord: industry_types, lead_sources, activity_templates
# Tenant: contacts, companies, deals, activities, notes
```

### **Template 3: Analytics Context**
```bash
# Create Analytics module
php artisan make:context Analytics --landlord --tenant --module

# Typical tables:
# Landlord: report_templates, dashboard_layouts
# Tenant: events, page_views, user_sessions, metrics
```

---

## 🔍 **TROUBLESHOOTING COMMON ISSUES**

### **Issue 1: Context Not Discovered**
```bash
# Check folder structure
ls -la app/Contexts/YourContext/Infrastructure/Database/Migrations/
# Should have: landlord/ and tenant/ folders

# Check migration files
ls -la app/Contexts/YourContext/Infrastructure/Database/Migrations/landlord/
# Should have .php files with Schema::create() or Schema::connection('landlord')->create()
```

### **Issue 2: Installation Fails**
```bash
# Enable verbose logging
php artisan context:install YourContext --tenant=test -vvv

# Check ModuleRegistry catalog
php artisan tinker
>>> DB::connection('landlord')->table('modules')->where('name', 'your_context')->first();

# Verify tenant exists
>>> \App\Models\Tenant::where('slug', 'test')->exists();
```

### **Issue 3: Circular Dependencies**
```php
// In your Context.php, check dependencies:
public static function getMetadata(): array
{
    return [
        'dependencies' => ['module_registry'], // Only essential dependencies
        // Avoid: 'dependencies' => ['finance', 'inventory', 'crm'] // Too many!
    ];
}
```

---

## 📊 **PRODUCTION DEPLOYMENT CHECKLIST**

### **Before Deploying a New Context:**

- [ ] **Migrations Tested**
  - [ ] Install/uninstall works multiple times (idempotent)
  - [ ] Tenant isolation verified (no data leakage)
  - [ ] Rollback tested (if something goes wrong)

- [ ] **Performance**
  - [ ] Indexes added for common queries
  - [ ] No N+1 query problems
  - [ ] Large dataset handling tested

- [ ] **Security**
  - [ ] Tenant isolation working correctly
  - [ ] Authorization checks on all endpoints
  - [ ] Input validation and sanitization

- [ ] **Monitoring**
  - [ ] Error logging configured
  - [ ] Performance metrics tracked
  - [ ] Health checks implemented

---

## 🎯 **QUICK REFERENCE COMMANDS**

```bash
# Create new context
php artisan make:context {Name} --landlord --tenant --module

# Discover contexts
php artisan context:list
php artisan context:list --detailed

# Install context
php artisan context:install {Context} --dry-run
php artisan context:install {Context} --tenant={slug}
php artisan context:install {Context} --all-tenants

# Check installation status
php artisan tinker
>>> $installer = app('platform.context.installer');
>>> $installer->isInstalled('Forum', 'test-tenant');

# Create migrations
php artisan make:migration create_{table}_table \
  --path=app/Contexts/{Context}/Infrastructure/Database/Migrations/Landlord

php artisan make:migration create_{table}_table \
  --path=app/Contexts/{Context}/Infrastructure/Database/Migrations/Tenant
```

---

## 📚 **NEXT STEPS AFTER CONTEXT CREATION**

1. **Register in ModuleRegistry** (if `--module` flag was used)
2. **Add to Tenant Dashboard** so admins can enable it
3. **Create API Documentation** with OpenAPI/Swagger
4. **Add to CI/CD Pipeline** for automated testing
5. **Monitor Usage** in production

---

**Remember:** The Platform Context system handles the heavy lifting of multi-tenancy, migrations, and discovery. Focus on your business logic!

**Need Help?** Check existing contexts (ModuleRegistry, DigitalCard) for reference implementations, or consult the Platform Infrastructure team.