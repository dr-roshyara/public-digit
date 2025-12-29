```
# 🏗️ **LARAVEL 12 DDD MULTI-TENANT TESTING GUIDE**
## *Using Dedicated Test Databases for Landlord & Tenant Contexts*

---

## 📋 **OVERVIEW: MULTI-TENANT TESTING ARCHITECTURE**

### **Production vs Testing Database Strategy**

| Environment | Landlord Database | Tenant Database |
|-------------|-------------------|-----------------|
| **Production** | `publicdigit` | `tenant_1`, `tenant_2`, etc. |
| **Testing** | `publicdigit_test` | `tenant_test` |

### **Why Separate Test Databases?**
1. **Isolation**: Tests don't affect production data
2. **Parallel Testing**: Multiple test suites can run simultaneously
3. **Clean State**: Each test starts with fresh database
4. **Performance**: Optimized indexes and structure for testing

---

## 🔧 **CONFIGURATION SETUP**

### **1. .env.testing Configuration**

```env
# ====================
# LANDLORD TEST DATABASE (Platform Catalog)
# ====================
DB_LANDLORD_CONNECTION=pgsql
DB_LANDLORD_DATABASE=publicdigit_test
DB_LANDLORD_HOST=127.0.0.1
DB_LANDLORD_PORT=5432
DB_LANDLORD_USERNAME=publicdigit_user
DB_LANDLORD_PASSWORD=Rudolfvogt%27%
DB_LANDLORD_SCHEMA=public
DB_LANDLORD_SSLMODE=prefer

# ====================
# TENANT TEST DATABASE (Tenant-specific Data)
# ====================
DB_TENANT_CONNECTION=pgsql
DB_TENANT_DATABASE=tenant_test
DB_TENANT_HOST=127.0.0.1
DB_TENANT_PORT=5432
DB_TENANT_USERNAME=publicdigit_user
DB_TENANT_PASSWORD=Rudolfvogt%27%
DB_TENANT_SCHEMA=public
DB_TENANT_SSLMODE=prefer

# ====================
# DEFAULT CONNECTION (Fallback)
# ====================
DB_CONNECTION=pgsql
DB_DATABASE=publicdigit_test
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=publicdigit_user
DB_PASSWORD=Rudolfvogt%27%
```

### **2. config/database.php Connections**

```php
'connections' => [
    // ========= LANDLORD CONNECTIONS =========
    
    // Landlord Test Connection (DDD Context Testing)
    'landlord_test' => [
        'driver' => env('DB_LANDLORD_CONNECTION', 'pgsql'),
        'host' => env('DB_LANDLORD_HOST', '127.0.0.1'),
        'port' => env('DB_LANDLORD_PORT', '5432'),
        'database' => env('DB_LANDLORD_DATABASE', 'publicdigit_test'),
        'username' => env('DB_LANDLORD_USERNAME', 'publicdigit_user'),
        'password' => env('DB_LANDLORD_PASSWORD', ''),
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => env('DB_LANDLORD_SCHEMA', 'public'),
        'sslmode' => env('DB_LANDLORD_SSLMODE', 'prefer'),
        'application_name' => env('APP_NAME', 'Laravel') . '_landlord_test',
    ],
    
    // ========= TENANT CONNECTIONS =========
    
    // Tenant Test Connection (Static tenant for testing)
    'tenant_test' => [
        'driver' => env('DB_TENANT_CONNECTION', 'pgsql'),
        'host' => env('DB_TENANT_HOST', '127.0.0.1'),
        'port' => env('DB_TENANT_PORT', '5432'),
        'database' => env('DB_TENANT_DATABASE', 'tenant_test'),
        'username' => env('DB_TENANT_USERNAME', 'publicdigit_user'),
        'password' => env('DB_TENANT_PASSWORD', ''),
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => env('DB_TENANT_SCHEMA', 'public'),
        'sslmode' => env('DB_TENANT_SSLMODE', 'prefer'),
        'application_name' => env('APP_NAME', 'Laravel') . '_tenant_test',
    ],
    
    // Dynamic Tenant Connection (Spatie Multi-tenancy)
    'tenant' => [
        'driver' => 'pgsql',
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '5432'),
        'database' => env('TENANT_PLACEHOLDER_DB', 'placeholder_tenant_db'),
        'username' => env('DB_USERNAME', 'postgres'),
        'password' => env('DB_PASSWORD', ''),
        'charset' => 'utf8',
        'prefix' => '',
        'prefix_indexes' => true,
        'search_path' => env('DB_SCHEMA', 'public'),
        'sslmode' => env('DB_SSLMODE', 'prefer'),
        'application_name' => env('APP_NAME', 'Laravel') . '_tenant',
    ],
];
```

---

## 🧪 **TESTING PATTERNS FOR DDD CONTEXTS**

### **Pattern 1: Landlord Context Testing (ModuleRegistry, Subscription)**

**Use Case**: Testing platform-level catalogs, shared data

```php
namespace Tests\Unit\Contexts\ModuleRegistry\Infrastructure\Persistence;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ModuleRepositoryTest extends TestCase
{
    use RefreshDatabase;
    
    /**
     * Use landlord_test connection for platform data
     */
    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'landlord_test']);
    }
    
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

### **Pattern 2: Tenant Context Testing (DigitalCard, Elections)**

**Use Case**: Testing tenant-specific data, member data

```php
namespace Tests\Unit\Contexts\DigitalCard\Infrastructure\Persistence;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class DigitalCardRepositoryTest extends TestCase
{
    use RefreshDatabase;
    
    /**
     * Use tenant_test connection for tenant-specific data
     */
    protected function beforeRefreshingDatabase(): void
    {
        config(['database.default' => 'tenant_test']);
    }
    
    protected function migrateFreshUsing(): array
    {
        return [
            '--path' => 'app/Contexts/DigitalCard/Infrastructure/Database/Migrations',
            '--database' => 'tenant_test',
            '--realpath' => true,
        ];
    }
}
```

### **Pattern 3: Multi-Context Integration Testing**

**Use Case**: Testing flows between landlord and tenant contexts

```php
namespace Tests\Feature\Contexts\ModuleRegistry;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ModuleInstallationTest extends TestCase
{
    use RefreshDatabase;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // Setup landlord connection for module catalog
        config(['database.default' => 'landlord_test']);
        $this->artisan('migrate', [
            '--path' => 'app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations',
            '--database' => 'landlord_test',
            '--realpath' => true,
        ]);
        
        // Setup tenant connection for installation
        config(['database.default' => 'tenant_test']);
        $this->artisan('migrate', [
            '--path' => 'app/Contexts/DigitalCard/Infrastructure/Database/Migrations',
            '--database' => 'tenant_test',
            '--realpath' => true,
        ]);
    }
}
```

---

## 🛠️ **CREATING TEST DATABASES**

### **1. PostgreSQL Commands to Create Test Databases**

```bash
# Connect to PostgreSQL
psql -U postgres

# Create landlord test database
CREATE DATABASE publicdigit_test 
    WITH 
    OWNER = publicdigit_user
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

# Create tenant test database  
CREATE DATABASE tenant_test
    WITH 
    OWNER = publicdigit_user
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE publicdigit_test TO publicdigit_user;
GRANT ALL PRIVILEGES ON DATABASE tenant_test TO publicdigit_user;

# Create test database from production template (optional)
CREATE DATABASE publicdigit_test TEMPLATE publicdigit;
CREATE DATABASE tenant_test TEMPLATE tenant_1;
```

### **2. Automated Setup Script**

```bash
#!/bin/bash
# setup-test-databases.sh

echo "Setting up test databases..."

# Drop existing test databases
psql -U postgres -c "DROP DATABASE IF EXISTS publicdigit_test;"
psql -U postgres -c "DROP DATABASE IF EXISTS tenant_test;"

# Create fresh test databases
psql -U postgres -c "CREATE DATABASE publicdigit_test WITH OWNER publicdigit_user ENCODING 'UTF8' TEMPLATE template0;"
psql -U postgres -c "CREATE DATABASE tenant_test WITH OWNER publicdigit_user ENCODING 'UTF8' TEMPLATE template0;"

# Run migrations on test databases
php artisan migrate --database=landlord_test --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations
php artisan migrate --database=tenant_test --path=app/Contexts/DigitalCard/Infrastructure/Database/Migrations

echo "Test databases ready!"
```

---

## 🔍 **VERIFICATION AND DEBUGGING**

### **1. Connection Verification Script**

```php
// tests/Console/Commands/VerifyTestConnections.php

namespace Tests\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;

class VerifyTestConnections extends Command
{
    protected $signature = 'test:verify-connections';
    
    public function handle()
    {
        $this->info('Verifying test database connections...');
        
        // Test landlord_test
        Config::set('database.default', 'landlord_test');
        try {
            DB::connection()->getPdo();
            $this->info('✅ landlord_test: Connected to ' . DB::connection()->getDatabaseName());
        } catch (\Exception $e) {
            $this->error('❌ landlord_test: ' . $e->getMessage());
        }
        
        // Test tenant_test
        Config::set('database.default', 'tenant_test');
        try {
            DB::connection()->getPdo();
            $this->info('✅ tenant_test: Connected to ' . DB::connection()->getDatabaseName());
        } catch (\Exception $e) {
            $this->error('❌ tenant_test: ' . $e->getMessage());
        }
    }
}
```

### **2. Database State Inspection**

```bash
# Check landlord_test tables
psql -U publicdigit_user -d publicdigit_test -c "\dt"

# Check tenant_test tables  
psql -U publicdigit_user -d tenant_test -c "\dt"

# Check migration tracking
psql -U publicdigit_user -d publicdigit_test -c "SELECT * FROM migrations;"
psql -U publicdigit_user -d tenant_test -c "SELECT * FROM migrations;"
```

---

## 🚀 **TEST EXECUTION WORKFLOWS**

### **Workflow 1: Run All Tests (Parallel)**
```bash
# Run all tests with parallel processing
php artisan test --parallel --recreate-databases

# Run specific context tests
php artisan test --testsuite=ModuleRegistry --parallel
php artisan test --testsuite=DigitalCard --parallel
```

### **Workflow 2: Isolated Context Testing**
```bash
# Test only landlord contexts
php artisan test --filter="ModuleRegistry" --database=landlord_test

# Test only tenant contexts  
php artisan test --filter="DigitalCard" --database=tenant_test
```

### **Workflow 3: Continuous Integration**
```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          
      - name: Create Test Databases
        run: |
          psql -U postgres -c "CREATE DATABASE publicdigit_test;"
          psql -U postgres -c "CREATE DATABASE tenant_test;"
          
      - name: Run Tests
        env:
          DB_LANDLORD_DATABASE: publicdigit_test
          DB_TENANT_DATABASE: tenant_test
        run: |
          php artisan test --parallel
```

---

## 📊 **DATABASE SEEDING FOR TESTS**

### **Landlord Test Seeder**
```php
// database/seeders/LandlordTestSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel;

class LandlordTestSeeder extends Seeder
{
    public function run(): void
    {
        // Seed platform modules
        ModuleModel::create([
            'id' => '00000000-0000-0000-0000-000000000001',
            'name' => 'digital_card',
            'display_name' => 'Digital Card',
            'version' => '1.0.0',
            'description' => 'Digital membership cards',
            'namespace' => 'App\\Contexts\\DigitalCard',
            'status' => 'ACTIVE',
            'requires_subscription' => true,
        ]);
        
        // Add more test data...
    }
}
```

### **Tenant Test Seeder**
```php
// database/seeders/TenantTestSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent\DigitalCardModel;

class TenantTestSeeder extends Seeder
{
    public function run(): void
    {
        // Seed tenant-specific data
        DigitalCardModel::create([
            'id' => '00000000-0000-0000-0000-000000000001',
            'tenant_id' => 'test_tenant_1',
            'member_id' => 'member_001',
            'status' => 'ACTIVE',
        ]);
    }
}
```

---

## ⚠️ **COMMON PITFALLS AND SOLUTIONS**

### **Pitfall 1: Wrong Database Connection**
**Symptom**: `SQLSTATE[42P01]: Undefined table`
**Solution**: Verify `beforeRefreshingDatabase()` sets correct connection

### **Pitfall 2: Migration Table Missing**
**Symptom**: `Table 'publicdigit_test.migrations' doesn't exist`
**Solution**: Create migrations table first:
```bash
php artisan migrate:install --database=landlord_test
php artisan migrate:install --database=tenant_test
```

### **Pitfall 3: Foreign Key Constraints Fail**
**Symptom**: `SQLSTATE[23503]: Foreign key violation`
**Solution**: Seed data in correct order (landlord first, then tenant)

### **Pitfall 4: Parallel Test Collisions**
**Symptom**: Random test failures
**Solution**: Use Laravel's parallel testing with unique database suffixes:
```bash
php artisan test --parallel --recreate-databases
```

---

## 🎯 **BEST PRACTICES SUMMARY**

1. **Always use test databases**: Never test on production data
2. **Context isolation**: Landlord vs tenant connections must be separate
3. **Clean state**: Use `RefreshDatabase` trait for transaction-based cleanup
4. **Parallel ready**: Design tests to run in parallel without collisions
5. **Connection verification**: Verify connections before running test suites
6. **Migration tracking**: Each database needs its own migrations table
7. **Golden Rule #1**: Tenant-specific aggregates MUST have `tenant_id`

---

## 🔗 **USEFUL COMMANDS**

```bash
# Create test databases
php artisan db:create-test --landlord --tenant

# Run migrations on test databases
php artisan migrate --database=landlord_test
php artisan migrate --database=tenant_test

# Run specific context tests
php artisan test --filter="ModuleRegistry"
php artisan test --filter="DigitalCard"

# Clear test databases
php artisan db:wipe --database=landlord_test
php artisan db:wipe --database=tenant_test

# Verify connections
php artisan test:verify-connections
```

---

**This guide provides a complete framework for DDD multi-tenant testing in Laravel 12. The key insight is treating landlord and tenant databases as separate concerns with dedicated test instances.**