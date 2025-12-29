# Phase 3 Infrastructure - Quick Reference Guide
## ModuleRegistry Context

**Version**: 1.0 | **Date**: 2025-12-29

---

## 🚀 Quick Start

### Run All Tests
```bash
cd packages/laravel-backend
php artisan test --filter=ModuleRegistry
# Expected: 258 passed (671 assertions)
```

### Run Specific Component Tests
```bash
# Repositories
php artisan test tests/Unit/Contexts/ModuleRegistry/Infrastructure/Persistence/

# Adapters
php artisan test tests/Unit/Contexts/ModuleRegistry/Infrastructure/Adapters/

# Landlord DB tests only
php artisan test --filter=EloquentModuleRepositoryTest

# Tenant DB tests only
php artisan test --filter=EloquentTenantModuleRepositoryTest
php artisan test --filter=EloquentInstallationJobRepositoryTest
```

---

## 📁 File Structure

```
app/Contexts/ModuleRegistry/Infrastructure/
├── Persistence/
│   ├── Eloquent/                    # ORM Models
│   │   ├── ModuleModel.php                      # Landlord DB
│   │   ├── ModuleDependencyModel.php            # Landlord DB
│   │   ├── TenantModuleModel.php                # Tenant DB
│   │   ├── ModuleInstallationJobModel.php       # Tenant DB
│   │   └── InstallationStepModel.php            # Tenant DB
│   └── Repositories/                # Repository Implementations
│       ├── EloquentModuleRepository.php         # 15 tests
│       ├── EloquentTenantModuleRepository.php   # 14 tests
│       └── EloquentInstallationJobRepository.php # 16 tests
├── Adapters/                        # Service Adapters
│   ├── LaravelEventPublisher.php                # 4 tests
│   └── LaravelSubscriptionService.php           # 11 tests
├── Database/
│   └── Migrations/                  # Database Schema
│       ├── 2025_01_15_100000_create_modules_table.php          # Landlord
│       ├── 2025_01_15_100001_create_module_dependencies.php    # Landlord
│       ├── 2025_01_17_100000_create_tenant_modules_table.php   # Tenant
│       ├── 2025_01_17_100001_create_installation_jobs.php      # Tenant
│       └── 2025_01_17_100002_create_installation_steps.php     # Tenant
└── Providers/
    └── ModuleRegistryServiceProvider.php        # DI Bindings

tests/Unit/Contexts/ModuleRegistry/Infrastructure/
├── Persistence/
│   ├── EloquentModuleRepositoryTest.php         # 15 tests
│   ├── EloquentTenantModuleRepositoryTest.php   # 14 tests
│   └── EloquentInstallationJobRepositoryTest.php # 16 tests
└── Adapters/
    ├── LaravelEventPublisherTest.php            # 4 tests
    └── LaravelSubscriptionServiceTest.php       # 11 tests
```

---

## 🗄️ Database Commands

### Landlord Migrations
```bash
# Run landlord migrations
php artisan migrate --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations

# Check status
php artisan migrate:status

# Rollback last migration
php artisan migrate:rollback --step=1
```

### Tenant Migrations
```bash
# Run for all tenants
php artisan tenantauth:migrate --all

# Run for specific tenant
php artisan tenantauth:migrate nrna

# Check status for tenant
php artisan tenant:migrate:status nrna
```

### Database Inspection
```bash
# Laravel Tinker
php artisan tinker

# Check modules in landlord
>>> App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel::all()

# Check tenant modules (switch to tenant DB first)
>>> config(['database.default' => 'tenant']);
>>> App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\TenantModuleModel::all()

# Raw query
>>> DB::table('modules')->get()
>>> DB::connection('tenant')->table('tenant_modules')->get()
```

---

## 🔧 Common Tasks

### Adding a New Field to Module

**Step 1: Create Migration**
```bash
php artisan make:migration add_author_to_modules_table --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations
```

**Step 2: Write Migration**
```php
public function up(): void
{
    Schema::table('modules', function (Blueprint $table) {
        $table->string('author', 100)->after('description');
    });
}

public function down(): void
{
    Schema::table('modules', function (Blueprint $table) {
        $table->dropColumn('author');
    });
}
```

**Step 3: Update Eloquent Model**
```php
// ModuleModel.php
protected $fillable = [
    'id',
    'name',
    // ...
    'author',  // ADD THIS
];
```

**Step 4: Update Repository**
```php
// EloquentModuleRepository.php

public function save(Module $module): void
{
    ModuleModel::query()->updateOrCreate(
        ['id' => $module->id()->toString()],
        [
            // ... existing fields
            'author' => $module->author(),  // ADD THIS
        ]
    );
}

private function toDomainModel(ModuleModel $model): Module
{
    return new Module(
        ModuleId::fromString($model->id),
        // ... existing params
        $model->author  // ADD THIS
    );
}
```

**Step 5: Update Tests**
```php
public function test_save_preserves_author(): void
{
    $module = $this->createModule(['author' => 'John Doe']);
    $this->repository->save($module);
    $loaded = $this->repository->findById($module->id());

    $this->assertEquals('John Doe', $loaded->author());
}
```

**Step 6: Run**
```bash
php artisan migrate
php artisan test --filter=EloquentModuleRepositoryTest
```

### Adding a New Repository Method

**TDD Process**:

1. **Write Test FIRST** (RED)
```php
public function test_find_by_author(): void
{
    $module1 = $this->createModule(['author' => 'Alice']);
    $module2 = $this->createModule(['author' => 'Alice']);
    $module3 = $this->createModule(['author' => 'Bob']);

    $this->repository->save($module1);
    $this->repository->save($module2);
    $this->repository->save($module3);

    $results = $this->repository->findByAuthor('Alice');

    $this->assertCount(2, $results);
}
```

2. **Add to Interface** (Domain)
```php
// Domain/Ports/ModuleRepositoryInterface.php
public function findByAuthor(string $author): array;
```

3. **Implement** (GREEN)
```php
// EloquentModuleRepository.php
public function findByAuthor(string $author): array
{
    $models = ModuleModel::query()
        ->where('author', $author)
        ->get();

    return $models->map(fn($model) => $this->toDomainModel($model))->all();
}
```

4. **Refactor**
```php
public function findByAuthor(string $author): array
{
    $models = ModuleModel::query()
        ->where('author', $author)
        ->with('dependencies')  // Eager load
        ->orderBy('name')
        ->get();

    return $models->map(fn($model) => $this->toDomainModel($model))->all();
}
```

5. **Run Tests**
```bash
php artisan test --filter=test_find_by_author
```

---

## 🐛 Debugging Cheat Sheet

### Test Failures

**Symptom**: "Expected null, got Module"
```php
// Add debug output
dump($loaded);
dump($module->id()->toString());

// Check database
$dbRecord = DB::table('modules')->where('id', $module->id()->toString())->first();
dump($dbRecord);
```

**Symptom**: "Class not found"
```bash
# Clear autoload cache
composer dump-autoload

# Run tests again
php artisan test --filter=TestName
```

**Symptom**: "Tests pass individually, fail together"
```php
// Add to test class
use Illuminate\Foundation\Testing\DatabaseTransactions;
```

### Event Not Dispatched

**Check 1: Event::fake() timing**
```php
protected function setUp(): void
{
    parent::setUp();
    Event::fake();  // BEFORE creating service
    $this->service = new Service();  // AFTER fake
}
```

**Check 2: Verify binding**
```bash
php artisan tinker
>>> app(App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface::class)
# Should return LaravelEventPublisher instance
```

**Check 3: Event properties**
```php
Event::assertDispatched(ModuleRegistered::class, function ($event) {
    dump($event);  // Inspect structure
    return true;
});
```

### Cross-Database Issues

**Check connection**
```bash
php artisan tinker
>>> DB::connection('landlord')->table('modules')->count()
>>> DB::connection('tenant')->table('tenant_modules')->count()
```

**Switch database in test**
```php
// In test
config(['database.default' => 'landlord']);
// Do landlord stuff

config(['database.default' => 'tenant']);
// Do tenant stuff
```

### N+1 Query Problem

**Detect**
```php
DB::enableQueryLog();
$modules = $repo->findAll();
dd(DB::getQueryLog());  // Check query count
```

**Fix**
```php
// Add eager loading
$models = ModuleModel::query()
    ->with('dependencies')  // Prevent N+1
    ->get();
```

---

## 📊 Test Coverage Targets

| Component | Tests | Coverage |
|-----------|-------|----------|
| **EloquentModuleRepository** | 15 | 100% |
| **EloquentTenantModuleRepository** | 14 | 100% |
| **EloquentInstallationJobRepository** | 16 | 100% |
| **LaravelEventPublisher** | 4 | 100% |
| **LaravelSubscriptionService** | 11 | 100% |
| **TOTAL** | **60** | **100%** |

```bash
# Run coverage report
php artisan test --coverage --min=80
```

---

## 🔑 Key Patterns

### Repository Save Pattern
```php
public function save(Module $module): void
{
    ModuleModel::query()->updateOrCreate(
        ['id' => $module->id()->toString()],  // Find by ID
        [/* all fields */]                    // Update these
    );
}
```

### Repository Find Pattern
```php
public function findById(ModuleId $id): ?Module
{
    $model = ModuleModel::query()
        ->with('dependencies')  // Eager load
        ->find($id->toString());

    return $model ? $this->toDomainModel($model) : null;
}
```

### Model to Domain Mapping
```php
private function toDomainModel(ModuleModel $model): Module
{
    $module = new Module(
        ModuleId::fromString($model->id),
        ModuleName::fromString($model->name),
        // ... map all value objects
    );

    // Restore state
    if ($model->is_published) {
        $module->publish();
    }

    return $module;
}
```

### Cross-Database Reference
```php
// TenantModuleRepository
private function toDomainModel(TenantModuleModel $model): TenantModule
{
    // Fetch from landlord
    $module = $this->moduleRepository->findById(
        ModuleId::fromString($model->module_id)
    );

    if ($module === null) {
        throw new \RuntimeException("Module not found in catalog");
    }

    // Use landlord data
    return new TenantModule(
        TenantModuleId::fromString($model->id),
        TenantId::fromString($model->tenant_id),
        $module->id(),
        $module->version(),      // From landlord
        $module->configuration() // From landlord
    );
}
```

---

## ⚠️ Critical Rules

### ❌ NEVER Do This

```php
// ❌ Framework in domain
namespace App\Contexts\ModuleRegistry\Domain\Services;
use Illuminate\Support\Facades\DB;  // WRONG!

// ❌ Eloquent model in domain
use App\Contexts\ModuleRegistry\Infrastructure\Persistence\Eloquent\ModuleModel;  // WRONG!

// ❌ Cross-database foreign key
$table->foreign('module_id')->references('id')->on('publicdigit.modules');  // WRONG!

// ❌ Mutable value object
class ModuleId {
    public function setValue(string $value): void { }  // WRONG!
}

// ❌ Skip migrations
Schema::create('modules', function ($table) {
    DB::statement('CREATE TABLE IF NOT EXISTS...');  // WRONG!
});
```

### ✅ ALWAYS Do This

```php
// ✅ Domain depends on interfaces
namespace App\Contexts\ModuleRegistry\Domain\Services;
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;  // CORRECT!

// ✅ Infrastructure implements interfaces
class EloquentModuleRepository implements ModuleRepositoryInterface { }  // CORRECT!

// ✅ Application-level cross-database validation
$module = $this->moduleRepository->findById($model->module_id);  // CORRECT!

// ✅ Immutable value objects
final readonly class ModuleId { }  // CORRECT!

// ✅ Use Schema builder
Schema::create('modules', function (Blueprint $table) { });  // CORRECT!
```

---

## 🎯 Service Provider Quick Check

### Verify Bindings Work
```bash
php artisan tinker
```

```php
// Check each binding
app(App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface::class);
// Should return: EloquentModuleRepository

app(App\Contexts\ModuleRegistry\Domain\Ports\TenantModuleRepositoryInterface::class);
// Should return: EloquentTenantModuleRepository

app(App\Contexts\ModuleRegistry\Domain\Ports\InstallationJobRepositoryInterface::class);
// Should return: EloquentInstallationJobRepository

app(App\Contexts\ModuleRegistry\Domain\Ports\EventPublisherInterface::class);
// Should return: LaravelEventPublisher

app(App\Contexts\ModuleRegistry\Domain\Ports\SubscriptionServiceInterface::class);
// Should return: LaravelSubscriptionService
```

### If Binding Fails
```
BindingResolutionException: Target [...Interface] is not instantiable
```

**Fix**:
1. Check `bootstrap/providers.php` has `ModuleRegistryServiceProvider`
2. Clear config cache: `php artisan config:clear`
3. Dump autoload: `composer dump-autoload`
4. Restart server: `php artisan serve` (stop/start)

---

## 📝 TDD Workflow

```
1. Write Test (RED)
   ↓
2. Run Test (❌ Fails)
   ↓
3. Write Code (GREEN)
   ↓
4. Run Test (✅ Passes)
   ↓
5. Refactor (REFACTOR)
   ↓
6. Run Test (✅ Still Passes)
```

**Example**:
```bash
# 1. Write test
vim tests/.../EloquentModuleRepositoryTest.php

# 2. Run test (should fail)
php artisan test --filter=test_new_feature
# ❌ FAILED

# 3. Write implementation
vim app/.../EloquentModuleRepository.php

# 4. Run test (should pass)
php artisan test --filter=test_new_feature
# ✅ PASSED

# 5. Refactor code

# 6. Run all tests (ensure no regression)
php artisan test --filter=EloquentModuleRepositoryTest
# ✅ All 15 tests pass
```

---

## 🚦 Production Deployment Checklist

### Pre-Deploy
- [ ] All 258 tests passing
- [ ] Migration `down()` methods tested
- [ ] Service provider registered
- [ ] Database indexes created
- [ ] No N+1 queries
- [ ] Test coverage ≥80%

### Deploy
```bash
# 1. Backup database
pg_dump publicdigit > backup_$(date +%Y%m%d).sql

# 2. Run landlord migrations
php artisan migrate --path=app/Contexts/ModuleRegistry/Infrastructure/Database/Migrations

# 3. Run tenant migrations
php artisan tenantauth:migrate --all

# 4. Verify bindings
php artisan tinker --execute="app(App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface::class)"

# 5. Run smoke tests
php artisan test --filter=ModuleRegistry
```

### Post-Deploy
- [ ] Check logs for errors
- [ ] Verify database schema matches migrations
- [ ] Test one module installation end-to-end
- [ ] Monitor query performance

---

## 📚 Related Documentation

- **Full Developer Guide**: `20251229_2100_phase3_infrastructure_developer_guide.md`
- **Domain Layer (Phase 1)**: See `Domain/` directory
- **Application Layer (Phase 2)**: See `Application/` directory
- **Multi-Tenancy Guide**: See `developer_guide/laravel-backend/multi-tenancy/`

---

## 🆘 Getting Help

**Test Failures**:
1. Read error message carefully
2. Add `dump()` to inspect values
3. Run with `--debug` flag
4. Check database state in tinker

**Architecture Questions**:
1. Review domain layer (Phase 1)
2. Check hexagonal architecture diagram
3. Verify dependency flow (domain ← infrastructure)

**Performance Issues**:
1. Enable query log: `DB::enableQueryLog()`
2. Check for N+1 queries
3. Add eager loading: `->with('relation')`
4. Add database indexes

---

**Quick Reference Version**: 1.0
**Last Updated**: 2025-12-29
**For Detailed Guide**: See `20251229_2100_phase3_infrastructure_developer_guide.md`
