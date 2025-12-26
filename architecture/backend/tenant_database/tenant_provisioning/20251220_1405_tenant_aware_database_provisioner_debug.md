**Perfect!** The `TenantAwareDatabaseProvisioner.php` has been created. Now we need to:

## **Step 1: Update PlatformServiceProvider to use the new TenantAwareDatabaseProvisioner**

```bash
# Update the PlatformServiceProvider to use TenantAwareDatabaseProvisioner
cat > update_provider_for_tenantaware.php << 'EOF'
<?php

$file = __DIR__.'/app/Contexts/Platform/Infrastructure/Providers/PlatformServiceProvider.php';
$content = file_get_contents($file);

// Replace the DatabaseProvisionerInterface binding
$newBinding = <<<'EOD'
        // Database Provisioner - Tenant-aware selection
        $this->app->singleton(DatabaseProvisionerInterface::class, function ($app) {
            // Use tenant-aware provisioner that selects correct driver per tenant
            return new \App\Contexts\Platform\Infrastructure\Database\TenantAwareDatabaseProvisioner();
        });
EOD;

// Find and replace the binding
$pattern = '/\$this->app->singleton\(DatabaseProvisionerInterface::class, function \(\$app\) \{[\s\S]*?\}\);?/';
$content = preg_replace($pattern, $newBinding, $content, 1);

file_put_contents($file, $content);
echo "✅ Updated PlatformServiceProvider to use TenantAwareDatabaseProvisioner\n";

// Also check if we need to add any use statement
if (strpos($content, 'use App\Contexts\Platform\Infrastructure\Database\TenantAwareDatabaseProvisioner;') === false) {
    // Add the use statement after other use statements
    $lines = explode("\n", $content);
    $newLines = [];
    $added = false;
    
    foreach ($lines as $line) {
        $newLines[] = $line;
        
        // Add after the last use statement before class declaration
        if (!$added && trim($line) === 'use Illuminate\Support\ServiceProvider;') {
            $newLines[] = 'use App\Contexts\Platform\Infrastructure\Database\TenantAwareDatabaseProvisioner;';
            $added = true;
        }
    }
    
    file_put_contents($file, implode("\n", $newLines));
    echo "✅ Added use statement for TenantAwareDatabaseProvisioner\n";
}
EOF

php update_provider_for_tenantaware.php
```

## **Step 2: Add debug logging to see what's happening**

```bash
# Add more detailed logging to TenantAwareDatabaseProvisioner
cat > add_debug_logging.php << 'EOF'
<?php

$file = __DIR__.'/app/Contexts/Platform\Infrastructure\Database\TenantAwareDatabaseProvisioner.php';
$content = file_get_contents($file);

// Add additional debug logging in constructor
$newConstructor = <<<'EOD'
    public function __construct(?string $tenantId = null)
    {
        Log::debug('[TENANT_AWARE_PROVISIONER] Constructor called', [
            'requested_tenant_id' => $tenantId,
            'config_database_default' => config('database.default'),
            'has_app_bound_currentTenant' => app()->bound('currentTenant'),
        ]);
        
        // Try to get tenant ID from request if not provided
        if (!$tenantId && request()->route()) {
            $tenantId = $this->extractTenantIdFromRequest();
            Log::debug('[TENANT_AWARE_PROVISIONER] Extracted tenant ID from request', [
                'extracted_tenant_id' => $tenantId,
                'route_parameters' => request()->route()->parameters(),
            ]);
        }
        
        $driver = $this->determineDriverForTenant($tenantId);
        Log::debug('[TENANT_AWARE_PROVISIONER] Selected driver', [
            'tenant_id' => $tenantId,
            'driver' => $driver,
            'default_driver' => config('database.default'),
        ]);

        $this->provisioner = $this->createProvisionerForDriver($driver);
        
        Log::debug('[TENANT_AWARE_PROVISIONER] Provisioner created', [
            'provisioner_class' => get_class($this->provisioner),
            'provisioner_driver' => $this->provisioner->getDriver(),
        ]);
    }
    
    private function extractTenantIdFromRequest(): ?string
    {
        $route = request()->route();
        if (!$route) {
            return null;
        }
        
        // Check for tenant ID in route parameters
        $parameters = $route->parameters();
        
        // Common parameter names for tenant ID
        $possibleKeys = ['tenant', 'tenantId', 'tenant_id', 'id', 'tenantUuid', 'tenant_uuid'];
        
        foreach ($possibleKeys as $key) {
            if (isset($parameters[$key])) {
                return (string) $parameters[$key];
            }
        }
        
        return null;
    }
EOD;

// Replace the constructor
$pattern = '/public function __construct\(\?string \$tenantId = null\)\s*\{[\s\S]*?\}[\s\S]*?private function determineDriverForTenant/';
$content = preg_replace($pattern, $newConstructor . "\n\n    private function determineDriverForTenant", $content, 1);

file_put_contents($file, $content);
echo "✅ Added detailed debug logging to TenantAwareDatabaseProvisioner\n";
EOF

php add_debug_logging.php
```

## **Step 3: Clear all caches and test**

```bash
# Clear all caches
php artisan optimize:clear
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear

# Test the new provisioner selection
php artisan tinker --execute="
try {
    echo 'Testing TenantAwareDatabaseProvisioner...' . PHP_EOL;
    
    // Get the provisioner
    \$provisioner = app()->make(App\Contexts\Platform\Domain\Repositories\DatabaseProvisionerInterface::class);
    
    echo 'Provisioner class: ' . get_class(\$provisioner) . PHP_EOL;
    echo 'Driver reported: ' . \$provisioner->getDriver() . PHP_EOL;
    
    // Test with specific tenant ID
    echo PHP_EOL . 'Testing with tenant ID: 41c38d38-564a-4e50-8054-d687af20408a' . PHP_EOL;
    
    \$tenantAware = new App\Contexts\Platform\Infrastructure\Database\TenantAwareDatabaseProvisioner('41c38d38-564a-4e50-8054-d687af20408a');
    echo 'Tenant-aware provisioner class: ' . get_class(\$tenantAware) . PHP_EOL;
    echo 'Tenant-aware driver: ' . \$tenantAware->getDriver() . PHP_EOL;
    
    echo PHP_EOL . '✓ Both provisioners instantiated successfully!' . PHP_EOL;
    
} catch (Exception \$e) {
    echo 'Error: ' . \$e->getMessage() . PHP_EOL;
    echo 'Trace: ' . PHP_EOL . \$e->getTraceAsString() . PHP_EOL;
}
"
```

## **Step 4: Test the password setup with detailed logging**

```bash
# Enable detailed logging
cat > enable_detailed_logging.php << 'EOF'
<?php

// Update .env to enable detailed logging
$envFile = __DIR__.'/.env';
if (file_exists($envFile)) {
    $envContent = file_get_contents($envFile);
    
    // Ensure debug logging is enabled
    if (strpos($envContent, 'LOG_LEVEL=debug') === false) {
        $envContent = preg_replace('/LOG_LEVEL=.*/', 'LOG_LEVEL=debug', $envContent);
        file_put_contents($envFile, $envContent);
        echo "✅ Set LOG_LEVEL=debug in .env\n";
    }
}

// Also update config/logging.php for detailed stack traces
$loggingConfig = __DIR__.'/config/logging.php';
if (file_exists($loggingConfig)) {
    $content = file_get_contents($loggingConfig);
    
    // Look for the stack channel
    if (strpos($content, "'channels' => [") !== false) {
        // Add a debug channel if it doesn't exist
        if (strpos($content, "'debug' => [") === false) {
            $content = str_replace(
                "'channels' => [",
                "'channels' => [
        'debug' => [
            'driver' => 'single',
            'path' => storage_path('logs/debug.log'),
            'level' => 'debug',
        ],",
                $content
            );
            echo "✅ Added debug logging channel\n";
        }
    }
    
    file_put_contents($loggingConfig, $content);
}
EOF

php enable_detailed_logging.php
```

## **Step 5: Test the password setup endpoint**

Now test the password setup. The logs will show us:
1. Which provisioner is being selected
2. What driver it's using
3. Whether it's correctly detecting the PostgreSQL tenant

```bash
# Tail the logs while testing
tail -f storage/logs/laravel.log &

# Make a test request
curl -X POST http://localhost:8000/setup/password/TTSZtnpkOkVlaoTvosiddstlURDhbNOKE8ODb0i2HgD2LKpbUilPlLBmhpvtA15F \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "X-XSRF-TOKEN: $(grep -oP 'XSRF-TOKEN=\K[^;]+' cookies.txt 2>/dev/null || echo '')" \
  -d '{"password": "Ab123456", "password_confirmation": "Ab123456", "app_locale": "en"}' \
  -v
```

## **Step 6: If still timing out - emergency fix**

If we still get the 30-second timeout, we need to directly fix the `SecureSetupTokenService`:

```bash
# Create an emergency fix for SecureSetupTokenService
cat > emergency_fix_securesetup.php << 'EOF'
<?php

$file = __DIR__.'/app/Contexts/Platform/Application/Services/SecureSetupTokenService.php';

if (!file_exists($file)) {
    die("File not found: $file\n");
}

$content = file_get_contents($file);

// Look for where DatabaseProvisionerInterface is used
if (strpos($content, 'DatabaseProvisionerInterface') !== false) {
    echo "Found DatabaseProvisionerInterface usage in SecureSetupTokenService\n";
    
    // Add a direct fix - force PostgreSQL for this tenant
    $tenantId = '41c38d38-564a-4e50-8054-d687af20408a';
    
    // Add debug and fix at the beginning of submitPassword method
    $pattern = '/(public function submitPassword.*?\{)/s';
    $replacement = <<<EOD
$1
        // DEBUG: Force PostgreSQL for tenant {$tenantId}
        \\Log::debug('[SECURE_SETUP_EMERGENCY_FIX] Checking tenant database driver', [
            'tenant_id' => '{$tenantId}',
            'token' => \$token,
        ]);
        
        // Get tenant database config
        \$dbConfig = \\DB::table('tenant_databases')
            ->where('tenant_id', '{$tenantId}')
            ->first();
            
        if (\$dbConfig && (\$dbConfig->database_driver ?? '') === 'pgsql') {
            \\Log::debug('[SECURE_SETUP_EMERGENCY_FIX] Using PostgreSQL provisioner for tenant', [
                'tenant_id' => '{$tenantId}',
                'database' => \$dbConfig->database_name,
            ]);
            
            // Directly use PostgreSQL provisioner
            \$provisioner = app()->make(\\App\\Contexts\\Platform\\Infrastructure\\Database\\PostgreSQLDatabaseProvisioner::class);
        } else {
            \\Log::debug('[SECURE_SETUP_EMERGENCY_FIX] Using default provisioner selection');
            \$provisioner = app()->make(\\App\\Contexts\\Platform\\Domain\\Repositories\\DatabaseProvisionerInterface::class);
        }
EOD;
    
    $content = preg_replace($pattern, $replacement, $content, 1);
    file_put_contents($file, $content);
    echo "✅ Added emergency fix to SecureSetupTokenService\n";
} else {
    echo "Could not find DatabaseProvisionerInterface usage in SecureSetupTokenService\n";
    
    // Try to find the actual method that uses provisioner
    $lines = explode("\n", $content);
    foreach ($lines as $i => $line) {
        if (strpos($line, 'provision') !== false || strpos($line, 'database') !== false) {
            echo "Line " . ($i+1) . ": " . trim($line) . "\n";
        }
    }
}
EOF

php emergency_fix_securesetup.php
```

## **Step 7: Final verification**

```bash
# Run a direct test without HTTP to isolate the issue
cat > direct_provisioner_test.php << 'EOF'
<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';

$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $tenantId = '41c38d38-564a-4e50-8054-d687af20408a';
    
    echo "=== DIRECT PROVISIONER TEST ===\n\n";
    
    // 1. Get tenant database info
    $dbConfig = DB::table('tenant_databases')
        ->where('tenant_id', $tenantId)
        ->first();
    
    if (!$dbConfig) {
        die("❌ No database config found for tenant: $tenantId\n");
    }
    
    echo "Tenant Database Info:\n";
    echo "  - Name: " . $dbConfig->database_name . "\n";
    echo "  - Driver: " . ($dbConfig->database_driver ?? 'NOT SET') . "\n\n";
    
    // 2. Test TenantAwareDatabaseProvisioner
    echo "Testing TenantAwareDatabaseProvisioner:\n";
    $tenantAware = new App\Contexts\Platform\Infrastructure\Database\TenantAwareDatabaseProvisioner($tenantId);
    echo "  - Class: " . get_class($tenantAware) . "\n";
    echo "  - Driver: " . $tenantAware->getDriver() . "\n";
    echo "  - Actual provisioner class: " . get_class($tenantAware->getProvisioner()) . "\n\n";
    
    // 3. Test default provisioner (what the app uses)
    echo "Testing default provisioner from container:\n";
    $defaultProvisioner = app()->make(App\Contexts\Platform\Domain\Repositories\DatabaseProvisionerInterface::class);
    echo "  - Class: " . get_class($defaultProvisioner) . "\n";
    echo "  - Driver: " . $defaultProvisioner->getDriver() . "\n\n";
    
    // 4. Test database connection
    echo "Testing database connection:\n";
    $credentialsClass = 'App\Contexts\Platform\Domain\ValueObjects\DatabaseCredentials';
    
    if (class_exists($credentialsClass)) {
        $credentials = new $credentialsClass(
            $dbConfig->database_host ?? '127.0.0.1',
            $dbConfig->database_port ?? 5432,
            $dbConfig->database_name,
            'test_user',
            'test_password'
        );
        
        echo "  - Testing connection with " . get_class($tenantAware) . "...\n";
        $start = microtime(true);
        try {
            $result = $tenantAware->testConnection($credentials);
            $time = microtime(true) - $start;
            echo "  - Result: " . ($result ? '✓ SUCCESS' : '✗ FAILED') . "\n";
            echo "  - Time taken: " . number_format($time, 2) . " seconds\n";
            
            if ($time > 5) {
                echo "  ⚠️  WARNING: Connection test took too long!\n";
            }
        } catch (Exception $e) {
            echo "  - Exception: " . $e->getMessage() . "\n";
        }
    } else {
        echo "  ℹ️  DatabaseCredentials class not found\n";
    }
    
    echo "\n=== TEST COMPLETE ===\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
}
EOF

php direct_provisioner_test.php
```

## **Expected Results:**

1. **TenantAwareDatabaseProvisioner should detect** that tenant `41c38d38-564a-4e50-8054-d687af20408a` uses PostgreSQL
2. **It should create a PostgreSQLDatabaseProvisioner** instance
3. **The password setup should no longer timeout** because it will use correct PostgreSQL connection parameters

## **If Still Failing:**

Check the database driver field is correctly set:

```bash
php artisan tinker --execute="
\$tenantId = '41c38d38-564a-4e50-8054-d687af20408a';
\$db = DB::table('tenant_databases')->where('tenant_id', \$tenantId)->first();

if (\$db) {
    echo 'Current database_driver value: ' . (\$db->database_driver ?? 'NULL') . PHP_EOL;
    
    // If not set or wrong, fix it
    if (empty(\$db->database_driver) || \$db->database_driver !== 'pgsql') {
        echo 'Fixing database_driver to pgsql...' . PHP_EOL;
        DB::table('tenant_databases')
            ->where('tenant_id', \$tenantId)
            ->update(['database_driver' => 'pgsql', 'updated_at' => now()]);
        echo 'Fixed!' . PHP_EOL;
    }
} else {
    echo 'No database config found for tenant!' . PHP_EOL;
}
"
```

**The TenantAwareDatabaseProvisioner is now in place and should solve the timeout issue by correctly selecting PostgreSQL provisioner for PostgreSQL tenants!**