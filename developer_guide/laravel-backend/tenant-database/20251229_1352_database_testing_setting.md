# 🗄️ **DEVELOPER GUIDE: DATABASE CONNECTIONS IN DDD MULTI-TENANT ENVIRONMENT**

## 🎯 **ARCHITECTURE OVERVIEW**

### **Database Strategy by Context Layer**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            DATABASE STRATEGY                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │   DOMAIN    │     │ APPLICATION │     │ INFRASTRUCT │              │
│  │    LAYER    │     │    LAYER    │     │    LAYER    │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│         │                    │                    │                    │
│  Zero framework      Framework aware     All framework                │
│  Zero Laravel       Business logic      implementations              │
│  Pure business      Transaction mgmt    Database connections         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                              CONNECTION TYPES                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  • platform    ──╮  (Landlord: platform-wide data)                     │
│  • landlord    ──╯  (Geography: shared geography data)                 │
│  • tenant      ──── (Tenant-specific: members, elections, cards)       │
│  • testing     ──── (Test databases)                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔧 **SETUP INSTRUCTIONS**

### **Step 1: Configure Environment Files**

```bash
# .env (Production)
DB_CONNECTION=pgsql
DB_DATABASE=publicdigit_landlord
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=publicdigit_user
DB_PASSWORD=your_password

# Tenant connection (dynamic)
TENANT_PLACEHOLDER_DB=placeholder_tenant_db

# .env.testing (Testing)
DB_LANDLORD_DATABASE=publicdigit_test
DB_TENANT_DATABASE=tenant_test_1
DB_TENANT_CONNECTION=pgsql
```

### **Step 2: Configure Database Connections (config/database.php)**

```php
return [
    'default' => env('DB_CONNECTION', 'pgsql'),
    
    'connections' => [
        // ========== PRODUCTION CONNECTIONS ==========
        
        // 1. PLATFORM CONNECTION (Landlord - Platform admin data)
        'platform' => [
            'driver' => 'pgsql',
            'database' => env('DB_DATABASE', 'publicdigit'),
            // ... other config
        ],
        
        // 2. LANDLORD CONNECTION (Geography context - shared data)
        'landlord' => [
            'driver' => 'pgsql',
            'database' => env('DB_DATABASE', 'publicdigit'),
            // ... other config
        ],
        
        // 3. TENANT CONNECTION (Dynamic - Spatie multi-tenancy)
        'tenant' => [
            'driver' => 'pgsql',
            'database' => env('TENANT_PLACEHOLDER_DB', 'placeholder_tenant_db'),
            // ... other config
            // NOTE: Spatie switches database name at runtime
        ],
        
        // ========== TESTING CONNECTIONS ==========
        
        // 4. LANDLORD TEST CONNECTION
        'landlord_test' => [
            'driver' => env('DB_LANDLORD_CONNECTION', 'pgsql'),
            'database' => env('DB_LANDLORD_DATABASE', 'publicdigit_test'),
            // ... other config
        ],
        
        // 5. TENANT TEST CONNECTION
        'tenant_test' => [
            'driver' => env('DB_TENANT_CONNECTION', 'pgsql'),
            'database' => env('DB_TENANT_DATABASE', 'tenant_test_1'),
            // ... other config
        ],
    ],
];
```

### **Step 3: Create PostgreSQL Test Databases**

```bash
# Create landlord test database
sudo -u postgres psql -c "CREATE DATABASE publicdigit_test OWNER publicdigit_user;"

# Create tenant test database  
sudo -u postgres psql -c "CREATE DATABASE tenant_test_1 OWNER publicdigit_user;"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE publicdigit_test TO publicdigit_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tenant_test_1 TO publicdigit_user;"
```

## 🏗️ **CONTEXT-SPECIFIC IMPLEMENTATION**

### **Pattern 1: Landlord Context (ModuleRegistry, Geography)**

**Use Case:** Platform-wide data, shared across all tenants

```php
// app/Contexts/ModuleRegistry/Infrastructure/Persistence/EloquentModuleRepository.php

namespace App\Contexts\ModuleRegistry\Infrastructure\Persistence;

use Illuminate\Support\Facades\DB;

class EloquentModuleRepository implements ModuleRepositoryInterface
{
    private function getConnection(): \Illuminate\Database\Connection
    {
        // Always use landlord/landlord_test connection
        $connectionName = app()->environment('testing') ? 'landlord_test' : 'landlord';
        return DB::connection($connectionName);
    }
    
    public function save(Module $module): void
    {
        $connection = $this->getConnection();
        $connection->transaction(function () use ($connection, $module) {
            // Save to modules table in landlord database
        });
    }
}
```

### **Pattern 2: Tenant Context (DigitalCard, Elections, Members)**

**Use Case:** Tenant-specific data, isolated per tenant

```php
// app/Contexts/DigitalCard/Infrastructure/Persistence/EloquentDigitalCardRepository.php

namespace App\Contexts\DigitalCard\Infrastructure\Persistence;

use Illuminate\Support\Facades\DB;

class EloquentDigitalCardRepository implements DigitalCardRepositoryInterface
{
    private function getConnection(): \Illuminate\Database\Connection
    {
        // Use tenant/tenant_test connection
        $connectionName = app()->environment('testing') ? 'tenant_test' : 'tenant';
        return DB::connection($connectionName);
    }
    
    public function findByMember(string $memberId): array
    {
        $connection = $this->getConnection();
        // Query tenant-specific digital_cards table
        return $connection->table('digital_cards')
            ->where('member_id', $memberId)
            ->where('tenant_id', $this->getCurrentTenantId())
            ->get();
    }
}
```

### **Pattern 3: Module Installation Context**

**Special Case:** Creating tenant schemas/tables during installation

```php
// app/Contexts/DigitalCard/Infrastructure/Installation/DigitalCardModuleInstaller.php

class DigitalCardModuleInstaller implements ModuleInstallerInterface
{
    public function install(TenantId $tenantId): void
    {
        $connection = $this->getTenantConnection($tenantId);
        
        // Create tenant-specific tables
        $connection->getSchemaBuilder()->create('digital_cards', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id'); // REQUIRED: Golden Rule #1
            // ... other columns
        });
    }
    
    private function getTenantConnection(TenantId $tenantId): \Illuminate\Database\Connection
    {
        // Testing: tenant_test (static test database)
        // Production: tenant (Spatie will switch database)
        $connectionName = app()->environment('testing') ? 'tenant_test' : 'tenant';
        return DB::connection($connectionName);
    }
}
```

## 🧪 **TESTING PATTERNS**

### **Test Setup for Landlord Contexts**

```php
// tests/Feature/Contexts/ModuleRegistry/ModuleInstallerTest.php

namespace Tests\Feature\Contexts\ModuleRegistry;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ModuleInstallerTest extends TestCase
{
    use RefreshDatabase;
    
    /**
     * CRITICAL: Configure connection BEFORE database refresh
     */
    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'landlord_test']);
    }
    
    /**
     * Specify which migrations to run
     */
    protected function migrateFreshUsing(): array
    {
        return [
            '--path' => 'app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations',
            '--database' => 'landlord_test',
            '--realpath' => true,
        ];
    }
}
```

### **Test Setup for Tenant Contexts**

```php
// tests/Feature/Contexts/DigitalCard/DigitalCardTest.php

namespace Tests\Feature\Contexts\DigitalCard;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class DigitalCardTest extends TestCase
{
    use RefreshDatabase;
    
    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'tenant_test']);
    }
    
    protected function migrateFreshUsing(): array
    {
        return [
            // NO migrations path - installer creates tables programmatically
            '--database' => 'tenant_test',
            '--realpath' => true,
        ];
    }
}
```

## 🔍 **VERIFICATION COMMANDS**

### **Connection Verification**

```bash
# Verify landlord_test connection
php artisan tinker --execute="
    config(['database.default' => 'landlord_test']);
    echo 'Landlord Test DB: ' . \DB::connection()->getDatabaseName();
"

# Verify tenant_test connection
php artisan tinker --execute="
    config(['database.default' => 'tenant_test']);
    echo 'Tenant Test DB: ' . \DB::connection()->getDatabaseName();
"
```

### **Database Inspection**

```bash
# Check tables in landlord_test
psql -U publicdigit_user -d publicdigit_test -c "\dt"

# Check tables in tenant_test_1
psql -U publicdigit_user -d tenant_test_1 -c "\dt"

# Check migrations tracking
psql -U publicdigit_user -d publicdigit_test -c "SELECT * FROM migrations;"
```

## 🚨 **COMMON ERRORS & SOLUTIONS**

### **Error 1: "Undefined table" in tests**
**Cause:** Wrong database connection or missing migrations
**Fix:** Verify `beforeRefreshingDatabase()` sets correct connection

```php
// WRONG: Forgot to set connection
protected function setUp(): void
{
    parent::setUp(); // Uses default connection, not test connection
}

// CORRECT: Set connection before refresh
protected function beforeRefreshingDatabase(): void
{
    config(['database.default' => 'tenant_test']); // ✅ Set first
}
```

### **Error 2: "Table already exists"**
**Cause:** Installer trying to create tables that migrations already created
**Fix:** Either use migrations OR programmatic creation, not both

```php
// Choose ONE approach:

// APPROACH A: Use migrations (for static schemas)
protected function migrateFreshUsing(): array
{
    return [
        '--path' => 'app/Contexts/DigitalCard/Infrastructure/Database/Migrations',
        '--database' => 'tenant_test',
    ];
}

// APPROACH B: Programmatic creation (for dynamic module installation)
// Don't specify --path, installer creates tables
```

### **Error 3: Foreign key violations**
**Cause:** Tenant data referencing landlord data that doesn't exist
**Fix:** Seed landlord data first

```php
// In Integration Tests:
protected function setUp(): void
{
    parent::setUp();
    
    // 1. Setup landlord data first
    config(['database.default' => 'landlord_test']);
    $this->seedLandlordData();
    
    // 2. Setup tenant data
    config(['database.default' => 'tenant_test']);
    $this->seedTenantData();
}
```

## 📁 **FILE STRUCTURE BY CONTEXT**

```
app/
├── Contexts/
│   ├── ModuleRegistry/           # LANDLORD CONTEXT
│   │   ├── Domain/               # Zero framework dependencies
│   │   ├── Application/          # Framework aware
│   │   └── Infrastructure/
│   │       ├── Database/
│   │       │   └── Migrations/   # Landlord migrations
│   │       └── Persistence/      # Uses landlord connection
│   │
│   ├── DigitalCard/              # TENANT CONTEXT  
│   │   ├── Domain/               # Zero framework dependencies
│   │   ├── Application/          # Framework aware
│   │   └── Infrastructure/
│   │       ├── Database/
│   │       │   └── Migrations/
│   │       │       └── Tenant/   # Tenant-specific migrations
│   │       ├── Installation/     # Creates tenant tables
│   │       └── Persistence/      # Uses tenant connection
│   │
│   └── Geography/                # LANDLORD CONTEXT
│       └── Infrastructure/
│           ├── Database/
│           │   └── Migrations/   # Landlord migrations
│           └── Persistence/      # Uses landlord connection
```

## 🏁 **QUICK START CHECKLIST**

### **For New Landlord Context:**
- [ ] Add migration path to `app/Contexts/{Context}/Infrastructure/Database/Migrations/`
- [ ] Use `landlord` connection in repositories
- [ ] Configure tests to use `landlord_test` connection
- [ ] Seed landlord data in test setup

### **For New Tenant Context:**
- [ ] Add migration path to `app/Contexts/{Context}/Infrastructure/Database/Migrations/Tenant/`
- [ ] Use `tenant` connection in repositories  
- [ ] Configure tests to use `tenant_test` connection
- [ ] Ensure all aggregates have `tenantId` (Golden Rule #1)
- [ ] Create `ModuleInstallerInterface` implementation for module installation

### **For Module Installation:**
- [ ] Implement `ModuleInstallerInterface`
- [ ] Create `module.json` definition
- [ ] Implement `install()` and `uninstall()` methods
- [ ] Handle PostgreSQL schema switching in `getTenantConnection()`
- [ ] Create integration tests

## 📚 **GOLDEN RULES**

1. **Domain Layer Purity:** Zero Laravel/framework dependencies
2. **Tenant Isolation:** All tenant aggregates MUST have `tenantId`
3. **Connection Strategy:** 
   - Landlord contexts → `landlord`/`landlord_test`
   - Tenant contexts → `tenant`/`tenant_test`
4. **Testing Isolation:** Separate test databases for landlord/tenant
5. **Migration Separation:** Landlord vs tenant migrations in different paths
6. **Spatie Integration:** `tenant` connection uses placeholder, switched at runtime

## 🔄 **WORKFLOW EXAMPLE: Adding DigitalCard Module**

```bash
# 1. Create module definition
touch app/Contexts/DigitalCard/module.json

# 2. Create installer implementing ModuleInstallerInterface
php artisan make:class DigitalCardModuleInstaller

# 3. Create tenant migrations  
mkdir -p app/Contexts/DigitalCard/Infrastructure/Database/Migrations/Tenant/
# Create migration files

# 4. Create repository using tenant connection
php artisan make:class EloquentDigitalCardRepository

# 5. Create tests with tenant_test connection
php artisan make:test Feature/Contexts/DigitalCard/DigitalCardTest

# 6. Run tests
php artisan test tests/Feature/Contexts/DigitalCard/
```

---

**Remember:** This architecture enables true SaaS multi-tenancy where each module can be installed/uninstalled per tenant while maintaining data isolation and testability.