```
🎯 **FINAL CLAUDE PROMPT INSTRUCTIONS: FIX TEST DATABASE CONFIGURATION**

## **🔧 MISSION: Fix EloquentModuleRepositoryTest to use correct landlord_test connection**

### **Step 1: Update Test to Use landlord_test Connection**

```claude
Edit file packages/laravel-backend/tests/Unit/Contexts/ModuleRegistry/Infrastructure/Persistence/EloquentModuleRepositoryTest.php
```

**Replace entire file with this corrected version:**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Contexts\ModuleRegistry\Infrastructure\Persistence;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Repositories\EloquentModuleRepository;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel;
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleDependencyModel;
use App\Contexts\ModuleRegistry\Domain\Models\Module;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleVersion;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleConfiguration;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleStatus;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleDependency;

/**
 * EloquentModuleRepositoryTest - TDD Tests with Correct Test Database Connection
 * 
 * Uses: landlord_test connection → publicdigit_test database
 */
final class EloquentModuleRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private EloquentModuleRepository $repository;

    /**
     * Laravel 12 Hook: Configure BEFORE database refresh
     * CRITICAL: Use landlord_test connection (not regular landlord)
     */
    protected function beforeRefreshingDatabase(): void
    {
        // ✅ Set default connection to landlord_test
        config(['database.default' => 'landlord_test']);
    }

    /**
     * Override migrate:fresh options
     * CRITICAL: Use --database=landlord_test (connection name)
     */
    protected function migrateFreshUsing(): array
    {
        return [
            '--path' => 'app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations',
            '--database' => 'landlord_test',  // ✅ Connection name from config/database.php
            '--realpath' => true,
            '--seed' => false,
            '--drop-views' => $this->shouldDropViews(),
            '--drop-types' => $this->shouldDropTypes(),
        ];
    }

    protected function setUp(): void
    {
        parent::setUp(); // ✅ Runs migrate:fresh with our options
        
        // Verify connection before creating repository
        $this->verifyTestDatabaseConnection();
        
        $this->repository = new EloquentModuleRepository();
    }

    /**
     * Verify we're connected to correct test database
     */
    private function verifyTestDatabaseConnection(): void
    {
        $connection = \DB::connection()->getName();
        $database = \DB::connection()->getDatabaseName();
        
        // Should be landlord_test connection
        $this->assertEquals(
            'landlord_test', 
            $connection,
            "Test must use 'landlord_test' connection, but uses '{$connection}'"
        );
        
        // Should be publicdigit_test database
        $this->assertEquals(
            'publicdigit_test',
            $database,
            "Test must use 'publicdigit_test' database, but uses '{$database}'"
        );
        
        // Log for debugging
        if (app()->environment('testing')) {
            \Log::info("ModuleRegistry Test: Connected to {$database} via {$connection}");
        }
    }

    // ======================
    // KEEP ALL 15 ORIGINAL TESTS
    // ======================
    
    public function test_can_save_module(): void
    {
        // Arrange
        $module = $this->createModule();

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertDatabaseHas('modules', [
            'id' => $module->id()->toString(),
            'name' => 'test_module',
            'display_name' => 'Test Module',
            'version' => '1.0.0',
        ]);
    }

    public function test_can_find_module_by_id(): void
    {
        // Arrange
        $module = $this->createAndSaveModule();

        // Act
        $foundModule = $this->repository->findById($module->id());

        // Assert
        $this->assertInstanceOf(Module::class, $foundModule);
        $this->assertTrue($foundModule->id()->equals($module->id()));
        $this->assertEquals('test_module', $foundModule->name()->toString());
    }

    public function test_returns_null_when_module_not_found(): void
    {
        // Arrange
        $nonExistentId = ModuleId::generate();

        // Act
        $result = $this->repository->findById($nonExistentId);

        // Assert
        $this->assertNull($result);
    }

    public function test_can_save_module_with_dependencies(): void
    {
        // Arrange
        $module = $this->createModule();
        $module->addDependency(
            new ModuleDependency(
                ModuleName::fromString('core'),
                '^1.0.0'
            )
        );

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertDatabaseHas('module_dependencies', [
            'module_id' => $module->id()->toString(),
            'depends_on_module_name' => 'core',
            'version_constraint' => '^1.0.0',
        ]);
    }

    public function test_can_retrieve_module_with_dependencies(): void
    {
        // Arrange
        $module = $this->createModule();
        $module->addDependency(
            new ModuleDependency(ModuleName::fromString('core'), '^1.0.0')
        );
        $this->repository->save($module);

        // Act
        $retrieved = $this->repository->findById($module->id());

        // Assert
        $this->assertCount(1, $retrieved->dependencies());
        $this->assertEquals('core', $retrieved->dependencies()[0]->moduleName()->toString());
        $this->assertEquals('^1.0.0', $retrieved->dependencies()[0]->versionConstraint());
    }

    public function test_can_delete_module(): void
    {
        // Arrange
        $module = $this->createAndSaveModule();

        // Act
        $this->repository->delete($module->id());

        // Assert
        $this->assertDatabaseMissing('modules', [
            'id' => $module->id()->toString(),
        ]);
    }

    public function test_deleting_module_cascades_to_dependencies(): void
    {
        // Arrange
        $module = $this->createModule();
        $module->addDependency(
            new ModuleDependency(ModuleName::fromString('core'), '^1.0.0')
        );
        $this->repository->save($module);

        // Act
        $this->repository->delete($module->id());

        // Assert
        $this->assertDatabaseMissing('module_dependencies', [
            'module_id' => $module->id()->toString(),
        ]);
    }

    public function test_can_find_module_by_name(): void
    {
        // Arrange
        $module = $this->createAndSaveModule();

        // Act
        $foundModule = $this->repository->findByName(ModuleName::fromString('test_module'));

        // Assert
        $this->assertInstanceOf(Module::class, $foundModule);
        $this->assertTrue($foundModule->id()->equals($module->id()));
    }

    public function test_can_get_all_active_modules(): void
    {
        // Arrange
        $module1 = $this->createAndSaveModule();
        $module2 = $this->createModule(name: 'another_module');
        $this->repository->save($module2);

        // Act
        $activeModules = $this->repository->getAllActive();

        // Assert
        $this->assertCount(2, $activeModules);
        $this->assertContainsOnlyInstancesOf(Module::class, $activeModules);
    }

    public function test_can_update_existing_module(): void
    {
        // Arrange
        $module = $this->createAndSaveModule();

        // Update domain aggregate
        $newVersion = ModuleVersion::fromString('2.0.0');
        $module->updateVersion($newVersion);

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertDatabaseHas('modules', [
            'id' => $module->id()->toString(),
            'version' => '2.0.0',
        ]);
    }

    public function test_find_by_name_returns_null_when_not_found(): void
    {
        // Act
        $result = $this->repository->findByName(ModuleName::fromString('nonexistent'));

        // Assert
        $this->assertNull($result);
    }

    public function test_get_all_active_filters_deprecated_modules(): void
    {
        // Arrange
        $activeModule = $this->createAndSaveModule();

        // Create deprecated module manually in database
        ModuleModel::create([
            'id' => ModuleId::generate()->toString(),
            'name' => 'deprecated_module',
            'display_name' => 'Deprecated Module',
            'version' => '1.0.0',
            'description' => 'Deprecated module',
            'namespace' => 'App\\Modules\\Deprecated',
            'migrations_path' => 'database/migrations/deprecated',
            'status' => 'DEPRECATED',
            'requires_subscription' => false,
            'configuration' => null,
        ]);

        // Act
        $activeModules = $this->repository->getAllActive();

        // Assert
        $this->assertCount(1, $activeModules);
        $this->assertTrue($activeModules[0]->id()->equals($activeModule->id()));
    }

    public function test_save_updates_existing_module(): void
    {
        // Arrange
        $module = $this->createAndSaveModule();
        $originalId = $module->id()->toString();

        // Modify domain aggregate
        $newConfig = new ModuleConfiguration(['theme' => 'dark']);
        $module->updateConfiguration($newConfig);

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertEquals(1, ModuleModel::where('id', $originalId)->count());
        $this->assertDatabaseHas('modules', [
            'id' => $originalId,
        ]);
    }

    public function test_dependencies_are_recreated_on_save(): void
    {
        // Arrange
        $module = $this->createModule();
        $module->addDependency(new ModuleDependency(ModuleName::fromString('core'), '^1.0.0'));
        $this->repository->save($module);

        // Add new dependency
        $module->addDependency(new ModuleDependency(ModuleName::fromString('auth'), '^1.0.0'));

        // Act
        $this->repository->save($module);

        // Assert
        $this->assertEquals(
            2,
            ModuleDependencyModel::where('module_id', $module->id()->toString())->count()
        );
    }

    public function test_count_active_tenants_returns_zero_for_new_module(): void
    {
        // Arrange
        $module = $this->createAndSaveModule();

        // Act
        $count = $this->repository->countActiveTenants($module->id());

        // Assert
        $this->assertEquals(0, $count);
    }

    // ===== Helper Methods =====

    private function createModule(
        ?string $name = null,
        ?string $displayName = null,
        ?string $version = null
    ): Module {
        return new Module(
            ModuleId::generate(),
            ModuleName::fromString($name ?? 'test_module'),
            $displayName ?? 'Test Module',
            ModuleVersion::fromString($version ?? '1.0.0'),
            'Test module description',
            'App\\Modules\\Test',
            'database/migrations/modules/test',
            false,
            new ModuleConfiguration([])
        );
    }

    private function createAndSaveModule(): Module
    {
        $module = $this->createModule();
        $this->repository->save($module);
        return $module;
    }
}
```

### **Step 2: Run the Test**

```claude
Bash(cd "packages/laravel-backend" && php artisan test --filter=EloquentModuleRepositoryTest --debug)
```

### **Step 3: Check Database Connection First (If Test Fails)**

```claude
Bash(cd "packages/laravel-backend" && php artisan tinker --execute="
    use Illuminate\Support\Facades\DB;
    use Illuminate\Support\Facades\Config;
    
    echo '=== Testing landlord_test Connection ===' . PHP_EOL;
    
    Config::set('database.default', 'landlord_test');
    
    try {
        \$pdo = DB::connection()->getPdo();
        echo '✅ Connected to: ' . DB::connection()->getDatabaseName() . PHP_EOL;
        echo '   Connection: ' . DB::connection()->getName() . PHP_EOL;
        echo '   Host: ' . Config::get('database.connections.landlord_test.host') . PHP_EOL;
        
        // Check if migrations table exists
        \$exists = DB::select(\"SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'migrations'
        ) AS exists\")[0]->exists;
        
        echo '   Migrations table exists: ' . (\$exists ? 'YES' : 'NO') . PHP_EOL;
        
    } catch (\Exception \$e) {
        echo '❌ Connection failed: ' . \$e->getMessage() . PHP_EOL;
        echo '   Config: ' . json_encode(Config::get('database.connections.landlord_test'), JSON_PRETTY_PRINT) . PHP_EOL;
    }
")
```

### **Step 4: Create Migrations Table If Missing**

```claude
Bash(cd "packages/laravel-backend" && php artisan tinker --execute="
    use Illuminate\Support\Facades\DB;
    use Illuminate\Support\Facades\Schema;
    
    Config::set('database.default', 'landlord_test');
    
    if (!Schema::hasTable('migrations')) {
        echo 'Creating migrations table...' . PHP_EOL;
        
        Schema::create('migrations', function (\$table) {
            \$table->id();
            \$table->string('migration');
            \$table->integer('batch');
        });
        
        echo '✅ Created migrations table' . PHP_EOL;
    }
    
    // List current migrations
    \$count = DB::table('migrations')->count();
    echo 'Migrations registered: ' . \$count . PHP_EOL;
")
```

## **🎯 EXPECTED RESULTS:**

**If Successful:**
```
✅ Uses landlord_test connection
✅ Connects to publicdigit_test database  
✅ Runs ModuleRegistry migrations only
✅ Shows DOMAIN/REPOSITORY MISMATCH errors (the real issue we need to fix)
```

**If Still Fails:**
We'll see clear error messages about:
1. Connection issues (wrong credentials, missing migrations table)
2. Domain method missing errors (`description()`, `displayName()`, etc.)

## **⚠️ NEXT PROBLEM TO SOLVE:**

Once database connection works, we'll see **domain/repository mismatch** errors:
1. Module domain missing `description()`, `displayName()` methods
2. Constructor signature mismatch
3. Missing domain methods (`publish()`, `deprecate()`, etc.)

But first, let's fix the database connection.

**Execute Step 1 now.**