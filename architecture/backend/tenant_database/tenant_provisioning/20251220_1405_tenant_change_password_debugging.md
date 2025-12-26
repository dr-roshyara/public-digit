# **Claude CLI Prompt Instructions: Fix PostgreSQL Multi-Tenant Password Setup Timeout**

## **Title:** PostgreSQL Database Provisioner Selection Bug - Still Using MySQL for PostgreSQL Tenants

## **Current Status Analysis:**
✅ **Interface compliance fixed** - Both `MySQLDatabaseProvisioner` and `PostgreSQLDatabaseProvisioner` implement all required methods  
✅ **CSRF tokens working** - Authentication passes (no 419 errors)  
❌ **STILL TIMING OUT** - 30-second execution limit exceeded in `Connector.php:66`  
❌ **Root cause persists** - System still using MySQL provisioner for PostgreSQL tenants

## **Critical Evidence from Logs:**
1. **Queries show PostgreSQL connection**: `pgsql select * from "tenants" where "domain" = 'localhost'...`
2. **Tenant ID**: `41c38d38-564a-4e50-8054-d687af20408a`
3. **Error location**: `Illuminate\Database\Connectors\Connector.php:66` - This is **connection establishment**
4. **Setup token validated**: Token exists and is being read from database

## **Problem Diagnosis:**
The system is **correctly reading the setup token and tenant data** but when it tries to:
1. Connect to the tenant's PostgreSQL database
2. Execute the password setup operations
3. **It's still attempting MySQL connection syntax/behavior**

The error in `Connector.php:66` indicates it's trying to establish a database connection with wrong parameters or driver.

## **Root Cause Hypothesis:**
The `DynamicDatabaseProvisioningService` or `SecureSetupTokenService` is **NOT** using the tenant-specific database driver from `tenant_databases` table. It's falling back to default or MySQL logic.

## **Required Investigation Steps:**

### **1. Check Tenant Database Configuration:**
```bash
php artisan tinker --execute="
\$tenantId = '41c38d38-564a-4e50-8054-d687af20408a';
echo 'Checking tenant database configuration for: ' . \$tenantId . PHP_EOL;

\$dbConfig = DB::table('tenant_databases')
    ->where('tenant_id', \$tenantId)
    ->first();

if (\$dbConfig) {
    echo 'Database Configuration:' . PHP_EOL;
    echo '  - Database Name: ' . \$dbConfig->database_name . PHP_EOL;
    echo '  - Database Driver: ' . (\$dbConfig->database_driver ?? 'NOT SET') . PHP_EOL;
    echo '  - Host: ' . (\$dbConfig->database_host ?? 'default') . PHP_EOL;
    echo '  - Port: ' . (\$dbConfig->database_port ?? 'default') . PHP_EOL;
    
    if (empty(\$dbConfig->database_driver) || \$dbConfig->database_driver !== 'pgsql') {
        echo '⚠️  WARNING: database_driver is not set to pgsql!' . PHP_EOL;
    }
} else {
    echo '❌ No database configuration found for this tenant!' . PHP_EOL;
}
"
```

### **2. Trace the Provisioner Selection in Real-Time:**
Add debug logging to `PlatformServiceProvider.php`:

```bash
# Edit the provisioner binding with detailed logging
cat > debug_provisioner_selection.php << 'EOF'
<?php
// Find and update the DatabaseProvisionerInterface binding in PlatformServiceProvider.php
$file = __DIR__.'/app/Contexts/Platform/Infrastructure/Providers/PlatformServiceProvider.php';
$content = file_get_contents($file);

// Replace the provisioner binding with debug version
$newBinding = <<<'EOD'
        // Database Provisioner - Following DDD: Domain interface, Infrastructure implementation
        $this->app->singleton(DatabaseProvisionerInterface::class, function ($app) {
            $driver = config('database.default');
            
            \Log::debug('[PROVISIONER_SELECTION] Selecting database provisioner', [
                'default_driver' => $driver,
                'database_connections' => config('database.connections'),
                'tenant_id_from_request' => request()->route('tenant') ?? 'not_in_route',
                'full_request_url' => request()->fullUrl(),
            ]);
            
            // DEBUG: Check if we're in a tenant context
            if (app()->bound('currentTenant')) {
                $tenant = app('currentTenant');
                \Log::debug('[PROVISIONER_SELECTION] Current tenant context', [
                    'tenant_id' => $tenant->id ?? 'none',
                    'tenant_slug' => $tenant->slug ?? 'none',
                ]);
            }
            
            if ($driver === 'pgsql') {
                \Log::debug('[PROVISIONER_SELECTION] Creating PostgreSQLDatabaseProvisioner');
                $provisioner = new \App\Contexts\Platform\Infrastructure\Database\PostgreSQLDatabaseProvisioner();
                \Log::debug('[PROVISIONER_SELECTION] Provisioner created', [
                    'class' => get_class($provisioner),
                    'driver_method_result' => $provisioner->getDriver(),
                ]);
                return $provisioner;
            } else {
                \Log::debug('[PROVISIONER_SELECTION] Creating MySQLDatabaseProvisioner');
                return new \App\Contexts\Platform\Infrastructure\Database\MySQLDatabaseProvisioner();
            }
        });
EOD;

// Replace the existing binding
$pattern = '/\$this->app->singleton\(DatabaseProvisionerInterface::class, function \(\$app\) \{[\s\S]*?\}\);?/';
$content = preg_replace($pattern, $newBinding, $content);

file_put_contents($file, $content);
echo "Updated PlatformServiceProvider with debug logging\n";
EOF

php debug_provisioner_selection.php
```

### **3. Check What DynamicDatabaseProvisioningService is Actually Using:**
```bash
# Add debug to DynamicDatabaseProvisioningService
cat > find_actual_usage.php << 'EOF'
<?php
// We need to find where the provisioner is actually being used
echo "Searching for DatabaseProvisionerInterface usage...\n";

$files = [
    'app/Contexts/Platform/Application/Services/DynamicDatabaseProvisioningService.php',
    'app/Contexts/Platform/Application/Services/SecureSetupTokenService.php',
    'app/Contexts/Platform/Infrastructure/Http/Controllers/SecureSetupController.php',
];

foreach ($files as $file) {
    if (file_exists(__DIR__.'/'.$file)) {
        echo "\n=== $file ===\n";
        $content = file_get_contents(__DIR__.'/'.$file);
        
        // Look for provisioner usage
        if (strpos($content, 'DatabaseProvisionerInterface') !== false) {
            echo "✓ References DatabaseProvisionerInterface\n";
            
            // Extract relevant lines
            $lines = explode("\n", $content);
            foreach ($lines as $i => $line) {
                if (strpos($line, 'DatabaseProvisionerInterface') !== false || 
                    strpos($line, 'provisionDatabaseUser') !== false ||
                    strpos($line, 'createDatabase') !== false) {
                    echo "  Line " . ($i+1) . ": " . trim($line) . "\n";
                }
            }
        }
        
        // Look for database connection attempts
        if (strpos($content, 'config(') !== false && strpos($content, 'database') !== false) {
            preg_match_all('/config\([^)]*database[^)]*\)/', $content, $matches);
            if (!empty($matches[0])) {
                echo "Database config usages:\n";
                foreach ($matches[0] as $match) {
                    echo "  - " . $match . "\n";
                }
            }
        }
    }
}
EOF

php find_actual_usage.php
```

### **4. The REAL Issue - Tenant-Specific Driver Selection:**
The problem is likely that `PlatformServiceProvider` selects based on `config('database.default')` but **password setup needs tenant-specific driver**.

Create a **tenant-aware provisioner factory**:

```bash
cat > create_tenant_provisioner_factory.php << 'EOF'
<?php
// Create a factory that selects provisioner based on tenant's database driver
$factoryFile = __DIR__.'/app/Contexts/Platform/Infrastructure/Database/TenantAwareDatabaseProvisioner.php';

$factoryContent = <<<'EOD'
<?php

declare(strict_types=1);

namespace App\Contexts\Platform\Infrastructure\Database;

use App\Contexts\Platform\Domain\Repositories\DatabaseProvisionerInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\App;

/**
 * Tenant-Aware Database Provisioner
 * 
 * Selects the correct provisioner (MySQL or PostgreSQL) based on the tenant's
 * actual database driver configuration, not the application default.
 */
class TenantAwareDatabaseProvisioner implements DatabaseProvisionerInterface
{
    private DatabaseProvisionerInterface $provisioner;
    
    public function __construct(?string $tenantId = null)
    {
        $driver = $this->determineDriverForTenant($tenantId);
        Log::debug('[TENANT_AWARE_PROVISIONER] Selected driver', [
            'tenant_id' => $tenantId,
            'driver' => $driver,
            'default_driver' => config('database.default'),
        ]);
        
        $this->provisioner = $this->createProvisionerForDriver($driver);
    }
    
    private function determineDriverForTenant(?string $tenantId): string
    {
        // If no tenant ID provided, use default
        if (!$tenantId) {
            return config('database.default');
        }
        
        // Try to get tenant's database driver from database
        try {
            $dbConfig = DB::table('tenant_databases')
                ->where('tenant_id', $tenantId)
                ->first();
                
            if ($dbConfig && !empty($dbConfig->database_driver)) {
                Log::debug('[TENANT_AWARE_PROVISIONER] Found tenant database driver', [
                    'tenant_id' => $tenantId,
                    'driver' => $dbConfig->database_driver,
                ]);
                return $dbConfig->database_driver;
            }
        } catch (\Exception $e) {
            Log::warning('[TENANT_AWARE_PROVISIONER] Could not fetch tenant database config', [
                'tenant_id' => $tenantId,
                'error' => $e->getMessage(),
            ]);
        }
        
        // Fallback to default
        Log::debug('[TENANT_AWARE_PROVISIONER] Using default driver for tenant', [
            'tenant_id' => $tenantId,
            'default_driver' => config('database.default'),
        ]);
        return config('database.default');
    }
    
    private function createProvisionerForDriver(string $driver): DatabaseProvisionerInterface
    {
        return match (strtolower($driver)) {
            'pgsql', 'postgresql' => App::make(PostgreSQLDatabaseProvisioner::class),
            'mysql', 'mariadb' => App::make(MySQLDatabaseProvisioner::class),
            default => throw new \RuntimeException("Unsupported database driver: {$driver}"),
        };
    }
    
    // Delegate all interface methods to the actual provisioner
    public function provisionDatabaseUser($credentials): bool
    {
        return $this->provisioner->provisionDatabaseUser($credentials);
    }
    
    public function userExists(string $username, string $host = '%'): bool
    {
        return $this->provisioner->userExists($username, $host);
    }
    
    public function dropDatabaseUser(string $username, string $host = '%'): bool
    {
        return $this->provisioner->dropDatabaseUser($username, $host);
    }
    
    public function testConnection($credentials): bool
    {
        return $this->provisioner->testConnection($credentials);
    }
    
    public function createDatabase(string $databaseName): bool
    {
        return $this->provisioner->createDatabase($databaseName);
    }
    
    public function databaseExists(string $databaseName): bool
    {
        return $this->provisioner->databaseExists($databaseName);
    }
    
    public function getDriver(): string
    {
        return $this->provisioner->getDriver();
    }
    
    /**
     * Factory method to create provisioner for a specific tenant
     */
    public static function forTenant(string $tenantId): DatabaseProvisionerInterface
    {
        return new self($tenantId);
    }
    
    /**
     * Factory method to create provisioner for current context
     */
    public static function forCurrentContext(): DatabaseProvisionerInterface
    {
        $tenantId = null;
        
        // Try to get tenant ID from various sources
        if (app()->bound('currentTenant')) {
            $tenant = app('currentTenant');
            $tenantId = $tenant->id ?? null;
        }
        
        // Check request route parameters
        if (!$tenantId && request()->route()) {
            $tenantId = request()->route()->parameter('tenant') ?? 
                       request()->route()->parameter('tenantId') ??
                       request()->route()->parameter('id');
        }
        
        return new self($tenantId);
    }
}
EOD;

file_put_contents($factoryFile, $factoryContent);
echo "Created TenantAwareDatabaseProvisioner at: $factoryFile\n";

// Now update PlatformServiceProvider to use this
$providerFile = __DIR__.'/app/Contexts/Platform/Infrastructure/Providers/PlatformServiceProvider.php';
$providerContent = file_get_contents($providerFile);

// Replace the singleton binding
$newBinding = <<<'EOD'
        // Database Provisioner - Tenant-aware selection
        $this->app->singleton(DatabaseProvisionerInterface::class, function ($app) {
            // Use tenant-aware provisioner that selects correct driver per tenant
            return new \App\Contexts\Platform\Infrastructure\Database\TenantAwareDatabaseProvisioner();
        });
EOD;

$pattern = '/\$this->app->singleton\(DatabaseProvisionerInterface::class, function \(\$app\) \{[\s\S]*?\}\);?/';
$providerContent = preg_replace($pattern, $newBinding, $providerContent, 1);

file_put_contents($providerFile, $providerContent);
echo "Updated PlatformServiceProvider to use TenantAwareDatabaseProvisioner\n";
EOF

php create_tenant_provisioner_factory.php
```

### **5. Immediate Test - Direct Debug:**
```bash
cat > direct_debug_test.php << 'EOF'
<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';

$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $token = 'TTSZtnpkOkVlaoTvosiddstlURDhbNOKE8ODb0i2HgD2LKpbUilPlLBmhpvtA15F';
    $hashedToken = hash('sha256', $token);
    
    echo "=== DIRECT DEBUG TEST ===\n\n";
    
    // 1. Verify token exists
    echo "1. Checking setup token...\n";
    $setupToken = DB::table('tenant_setup_tokens')
        ->where('token', $hashedToken)
        ->first();
    
    if (!$setupToken) {
        die("❌ Token not found!\n");
    }
    
    echo "   ✓ Token found for tenant: {$setupToken->tenant_id}\n";
    
    // 2. Get tenant database config
    echo "\n2. Getting tenant database configuration...\n";
    $dbConfig = DB::table('tenant_databases')
        ->where('tenant_id', $setupToken->tenant_id)
        ->first();
    
    if (!$dbConfig) {
        die("❌ No database config for tenant!\n");
    }
    
    echo "   ✓ Database: {$dbConfig->database_name}\n";
    echo "   ✓ Driver: " . ($dbConfig->database_driver ?? 'NOT SET') . "\n";
    
    // 3. Test provisioner selection
    echo "\n3. Testing provisioner selection...\n";
    $provisioner = app()->make(\App\Contexts\Platform\Domain\Repositories\DatabaseProvisionerInterface::class);
    echo "   ✓ Provisioner class: " . get_class($provisioner) . "\n";
    echo "   ✓ Provisioner driver: " . $provisioner->getDriver() . "\n";
    
    // 4. Test if we can connect to the tenant database
    echo "\n4. Testing database connection...\n";
    
    // Create test credentials
    $credentialsClass = 'App\Contexts\Platform\Domain\ValueObjects\DatabaseCredentials';
    if (class_exists($credentialsClass)) {
        $credentials = new $credentialsClass(
            $dbConfig->database_host ?? config('database.connections.pgsql.host'),
            $dbConfig->database_port ?? config('database.connections.pgsql.port'),
            $dbConfig->database_name,
            'test_user', // placeholder
            'test_password' // placeholder
        );
        
        echo "   Testing connection with credentials...\n";
        $canConnect = $provisioner->testConnection($credentials);
        echo "   Connection test: " . ($canConnect ? '✓ SUCCESS' : '✗ FAILED') . "\n";
    } else {
        echo "   ℹ️  DatabaseCredentials class not found\n";
    }
    
    echo "\n=== TEST COMPLETE ===\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
    
    // Check if it's the timeout
    if (strpos($e->getMessage(), 'Maximum execution time') !== false) {
        echo "\n⚠️  TIMEOUT STILL OCCURRING!\n";
        echo "The provisioner is likely trying wrong connection parameters.\n";
    }
}
EOF

php direct_debug_test.php
```

## **Expected Outcome After Fix:**
1. **Tenant-aware provisioner selection** based on `tenant_databases.database_driver`
2. **PostgreSQL tenants use PostgreSQL provisioner**, MySQL tenants use MySQL provisioner
3. **No more 30-second timeout** because correct connection parameters are used
4. **Password setup completes successfully**

## **Verification Steps After Implementation:**
1. Clear all caches: `php artisan optimize:clear`
2. Check logs for `[TENANT_AWARE_PROVISIONER]` debug messages
3. Test password setup endpoint
4. Verify tenant database connection uses correct PostgreSQL syntax

## **Fallback If Factory Approach Fails:**
If the factory approach is too complex, implement a simpler fix in `SecureSetupTokenService`:

```php
// In submitPassword method, before using provisioner:
$tenantDbConfig = DB::table('tenant_databases')
    ->where('tenant_id', $setupToken->tenant_id)
    ->first();

if ($tenantDbConfig && $tenantDbConfig->database_driver === 'pgsql') {
    $provisioner = app()->make(\App\Contexts\Platform\Infrastructure\Database\PostgreSQLDatabaseProvisioner::class);
} else {
    $provisioner = app()->make(\App\Contexts\Platform\Infrastructure\Database\MySQLDatabaseProvisioner::class);
}
```

**The core issue is that the system needs to be tenant-database-driver aware, not just using the application's default database driver.**