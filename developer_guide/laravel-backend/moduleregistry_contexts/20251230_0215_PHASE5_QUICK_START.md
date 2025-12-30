# ⚡ PHASE 5 QUICK START GUIDE

**Date:** 2025-12-30 02:15
**Goal:** Get started with Phase 5 implementation in < 30 minutes
**Status:** Ready to execute

---

## 🎯 WHAT YOU'RE BUILDING

**Phase 5 adds the missing middle layers:**

```
Current (Day 22):     Target (Phase 5):
API ────X───► Domain   API ──► Application ──► Domain ──► Infrastructure ──► Database
   (broken!)              (complete!)
```

---

## 📋 PRE-FLIGHT CHECKLIST

Before starting, verify:

```bash
# 1. You're on the main branch with latest code
git checkout main
git pull origin main

# 2. All Phase 4 Day 22 tests are passing
cd packages/laravel-backend
php artisan test --filter="ModuleCatalogApiTest"
# Expected: 10/10 tests passing

# 3. Domain layer is complete (from Phase 1)
php artisan test tests/Unit/Contexts/ModuleRegistry/Domain/
# Expected: 108 tests passing

# 4. Database is clean
php artisan migrate:status
```

**If all checks pass ✅ → Ready to start!**

---

## 🚀 START PHASE 5 - DAY 1 (Query Services & DTOs)

### **Step 1: Create Feature Branch (2 min)**

```bash
git checkout -b feature/moduleregistry-phase5-day1-queries

# Create directory structure
mkdir -p app/Contexts/ModuleRegistry/Application/Queries
mkdir -p app/Contexts/ModuleRegistry/Application/DTOs/Responses
mkdir -p tests/Unit/Contexts/ModuleRegistry/Application/Queries
mkdir -p tests/Unit/Contexts/ModuleRegistry/Application/DTOs
```

---

### **Step 2: Fix ModuleCatalogController (10 min)**

**Current Problem:** Controller directly imports Domain (WRONG!)

```php
// Current (WRONG):
use App\Contexts\ModuleRegistry\Domain\Models\Module; // Domain leak!

public function index()
{
    $modules = Module::all(); // Direct Domain access!
}
```

**Fix:** Use Query Service instead

```bash
# Open the controller
code app/Contexts/ModuleRegistry/Presentation/Http/Controllers/Desktop/ModuleCatalogController.php
```

**Update imports:**

```php
// Remove Domain imports:
// ❌ use App\Contexts\ModuleRegistry\Domain\Models\Module;

// Add Application imports:
use App\Contexts\ModuleRegistry\Application\Queries\GetAllModulesQuery;
use App\Contexts\ModuleRegistry\Application\Queries\GetModuleByIdQuery;
```

**Update constructor:**

```php
public function __construct(
    private GetAllModulesQuery $getAllModulesQuery,
    private GetModuleByIdQuery $getModuleByIdQuery
) {}
```

**Update methods:**

```php
public function index(Request $request): JsonResponse
{
    $result = $this->getAllModulesQuery->execute(
        page: (int) $request->input('page', 1),
        perPage: (int) $request->input('per_page', 15),
        status: $request->input('status', 'published'),
        search: $request->input('search')
    );

    return response()->json($result->jsonSerialize());
}

public function show(string $id): JsonResponse
{
    try {
        $module = $this->getModuleByIdQuery->execute($id);
        return response()->json(['data' => $module->toArray()]);
    } catch (ModuleNotFoundException $e) {
        return response()->json(['message' => $e->getMessage()], 404);
    } catch (\InvalidArgumentException $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

---

### **Step 3: Create GetAllModulesQuery (TDD - 15 min)**

#### **3.1: Write Test First (RED)** ⚠️

```bash
# Create test file
code tests/Unit/Contexts/ModuleRegistry/Application/Queries/GetAllModulesQueryTest.php
```

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Contexts\ModuleRegistry\Application\Queries;

use Tests\TestCase;
use App\Contexts\ModuleRegistry\Application\Queries\GetAllModulesQuery;
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Application\DTOs\Responses\ModuleCollectionResponseDTO;
use PHPUnit\Framework\MockObject\MockObject;

final class GetAllModulesQueryTest extends TestCase
{
    private MockObject $repository;
    private GetAllModulesQuery $query;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = $this->createMock(ModuleRepositoryInterface::class);
        $this->query = new GetAllModulesQuery($this->repository);
    }

    /** @test */
    public function it_returns_module_collection_dto(): void
    {
        // Arrange
        $this->repository->method('findAllPaginated')
            ->willReturn((object) [
                'items' => [],
                'currentPage' => 1,
                'perPage' => 15,
                'total' => 0,
                'lastPage' => 1,
            ]);

        // Act
        $result = $this->query->execute();

        // Assert
        $this->assertInstanceOf(ModuleCollectionResponseDTO::class, $result);
        $this->assertEquals(1, $result->currentPage);
        $this->assertEquals(15, $result->perPage);
        $this->assertEquals(0, $result->total);
    }

    /** @test */
    public function it_passes_pagination_parameters_to_repository(): void
    {
        // Arrange
        $this->repository->expects($this->once())
            ->method('findAllPaginated')
            ->with(2, 50, 'draft', 'search-term')
            ->willReturn((object) [
                'items' => [],
                'currentPage' => 2,
                'perPage' => 50,
                'total' => 0,
                'lastPage' => 1,
            ]);

        // Act
        $this->query->execute(
            page: 2,
            perPage: 50,
            status: 'draft',
            search: 'search-term'
        );

        // Assert: Verified by expects() above
    }
}
```

**Run test (should FAIL - RED):**

```bash
php artisan test --filter="GetAllModulesQueryTest"
# Expected: FAILS (Query class doesn't exist yet)
```

#### **3.2: Implement Query (GREEN)** ✅

```bash
# Create Query class
code app/Contexts/ModuleRegistry/Application/Queries/GetAllModulesQuery.php
```

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\Queries;

use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Application\DTOs\Responses\ModuleCollectionResponseDTO;
use App\Contexts\ModuleRegistry\Application\DTOs\Responses\ModuleResponseDTO;

final readonly class GetAllModulesQuery
{
    public function __construct(
        private ModuleRepositoryInterface $repository
    ) {}

    public function execute(
        int $page = 1,
        int $perPage = 15,
        string $status = 'published',
        ?string $search = null
    ): ModuleCollectionResponseDTO {
        $result = $this->repository->findAllPaginated(
            page: $page,
            perPage: $perPage,
            filters: [
                'status' => $status,
                'search' => $search,
            ]
        );

        $modules = array_map(
            fn($module) => ModuleResponseDTO::fromAggregate($module),
            $result->items
        );

        return new ModuleCollectionResponseDTO(
            modules: $modules,
            currentPage: $result->currentPage,
            perPage: $result->perPage,
            total: $result->total,
            lastPage: $result->lastPage
        );
    }
}
```

#### **3.3: Create DTOs**

```bash
# Create ModuleResponseDTO
code app/Contexts/ModuleRegistry/Application/DTOs/Responses/ModuleResponseDTO.php
```

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\DTOs\Responses;

use App\Contexts\ModuleRegistry\Domain\Models\Module;

final readonly class ModuleResponseDTO
{
    public function __construct(
        public string $id,
        public string $name,
        public string $displayName,
        public string $version,
        public string $description,
        public string $status,
        public bool $requiresSubscription,
        public ?string $publishedAt
    ) {}

    public static function fromAggregate(Module $module): self
    {
        return new self(
            id: $module->id()->toString(),
            name: $module->name()->toString(),
            displayName: $module->displayName(),
            version: $module->version()->toString(),
            description: $module->description(),
            status: $module->status()->value,
            requiresSubscription: $module->requiresSubscription(),
            publishedAt: $module->publishedAt()?->format('c')
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'display_name' => $this->displayName,
            'version' => $this->version,
            'description' => $this->description,
            'status' => $this->status,
            'requires_subscription' => $this->requiresSubscription,
            'published_at' => $this->publishedAt,
        ];
    }
}
```

```bash
# Create ModuleCollectionResponseDTO
code app/Contexts/ModuleRegistry/Application/DTOs/Responses/ModuleCollectionResponseDTO.php
```

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\DTOs\Responses;

final readonly class ModuleCollectionResponseDTO implements \JsonSerializable
{
    /**
     * @param ModuleResponseDTO[] $modules
     */
    public function __construct(
        public array $modules,
        public int $currentPage,
        public int $perPage,
        public int $total,
        public int $lastPage
    ) {}

    public function jsonSerialize(): array
    {
        return [
            'data' => array_map(fn($module) => $module->toArray(), $this->modules),
            'meta' => [
                'current_page' => $this->currentPage,
                'per_page' => $this->perPage,
                'total' => $this->total,
                'last_page' => $this->lastPage,
            ],
        ];
    }
}
```

**Run test again (should PASS - GREEN):**

```bash
php artisan test --filter="GetAllModulesQueryTest"
# Expected: ✅ 2/2 tests passing
```

---

### **Step 4: Create GetModuleByIdQuery (10 min)**

```bash
# Create test file
code tests/Unit/Contexts/ModuleRegistry/Application/Queries/GetModuleByIdQueryTest.php
```

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Contexts\ModuleRegistry\Application\Queries;

use Tests\TestCase;
use App\Contexts\ModuleRegistry\Application\Queries\GetModuleByIdQuery;
use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Application\DTOs\Responses\ModuleResponseDTO;
use App\Contexts\ModuleRegistry\Application\Exceptions\ModuleNotFoundException;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;
use PHPUnit\Framework\MockObject\MockObject;

final class GetModuleByIdQueryTest extends TestCase
{
    private MockObject $repository;
    private GetModuleByIdQuery $query;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = $this->createMock(ModuleRepositoryInterface::class);
        $this->query = new GetModuleByIdQuery($this->repository);
    }

    /** @test */
    public function it_returns_module_dto_when_found(): void
    {
        // Arrange
        $module = $this->createTestModule();

        $this->repository->method('findById')
            ->willReturn($module);

        // Act
        $result = $this->query->execute($module->id()->toString());

        // Assert
        $this->assertInstanceOf(ModuleResponseDTO::class, $result);
        $this->assertEquals($module->name()->toString(), $result->name);
    }

    /** @test */
    public function it_throws_exception_when_module_not_found(): void
    {
        // Arrange
        $this->repository->method('findById')
            ->willReturn(null);

        // Assert
        $this->expectException(ModuleNotFoundException::class);

        // Act
        $this->query->execute('550e8400-e29b-41d4-a716-446655440000');
    }

    private function createTestModule(): \App\Contexts\ModuleRegistry\Domain\Models\Module
    {
        return \App\Contexts\ModuleRegistry\Domain\Models\Module::create(
            name: \App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleName::fromString('test_module'),
            displayName: 'Test Module',
            version: \App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleVersion::fromString('1.0.0'),
            description: 'Test description',
            namespace: 'App\\Modules\\TestModule',
            migrationsPath: 'database/migrations/test',
            requiresSubscription: false
        );
    }
}
```

**Implement Query:**

```bash
code app/Contexts/ModuleRegistry/Application/Queries/GetModuleByIdQuery.php
```

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\Queries;

use App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface;
use App\Contexts\ModuleRegistry\Application\DTOs\Responses\ModuleResponseDTO;
use App\Contexts\ModuleRegistry\Application\Exceptions\ModuleNotFoundException;
use App\Contexts\ModuleRegistry\Domain\ValueObjects\ModuleId;

final readonly class GetModuleByIdQuery
{
    public function __construct(
        private ModuleRepositoryInterface $repository
    ) {}

    public function execute(string $id): ModuleResponseDTO
    {
        $module = $this->repository->findById(ModuleId::fromString($id));

        if (!$module) {
            throw new ModuleNotFoundException(
                "Module not found with ID: {$id}"
            );
        }

        return ModuleResponseDTO::fromAggregate($module);
    }
}
```

**Create Exception:**

```bash
code app/Contexts/ModuleRegistry/Application/Exceptions/ModuleNotFoundException.php
```

```php
<?php

declare(strict_types=1);

namespace App\Contexts\ModuleRegistry\Application\Exceptions;

final class ModuleNotFoundException extends \RuntimeException
{
}
```

**Run tests:**

```bash
php artisan test --filter="GetModuleByIdQueryTest"
# Expected: ✅ 2/2 tests passing
```

---

### **Step 5: Update ModuleCatalogApiTest (10 min)**

The existing API tests need to know about the Queries now:

```bash
code tests/Feature/Contexts/ModuleRegistry/Desktop/ModuleCatalogApiTest.php
```

**Update setupQueryInstances() method:**

```php
private function setupQueryInstances(): void
{
    // Mock ModuleRepositoryInterface (it's an interface, so mockable)
    $this->mockRepository = $this->createMock(
        \App\Contexts\ModuleRegistry\Domain\Ports\ModuleRepositoryInterface::class
    );

    // Create real Query instances with mocked repository
    $getAllModulesQuery = new \App\Contexts\ModuleRegistry\Application\Queries\GetAllModulesQuery(
        $this->mockRepository
    );
    $getModuleByIdQuery = new \App\Contexts\ModuleRegistry\Application\Queries\GetModuleByIdQuery(
        $this->mockRepository
    );

    // Bind instances to container (Laravel will inject these)
    $this->app->instance(
        \App\Contexts\ModuleRegistry\Application\Queries\GetAllModulesQuery::class,
        $getAllModulesQuery
    );
    $this->app->instance(
        \App\Contexts\ModuleRegistry\Application\Queries\GetModuleByIdQuery::class,
        $getModuleByIdQuery
    );
}
```

**Run API tests:**

```bash
php artisan test --filter="ModuleCatalogApiTest"
# Expected: ✅ 10/10 tests passing (now using Application layer!)
```

---

### **Step 6: Commit & Push (2 min)**

```bash
# Run all tests
php artisan test tests/Unit/Contexts/ModuleRegistry/Application/
php artisan test tests/Feature/Contexts/ModuleRegistry/Desktop/

# If all pass:
git add .
git commit -m "feat(moduleregistry): add Query services and DTOs (Day 1 complete)

- Add GetAllModulesQuery with pagination support
- Add GetModuleByIdQuery with error handling
- Add ModuleResponseDTO and ModuleCollectionResponseDTO
- Update ModuleCatalogController to use Application layer
- All tests passing (12 unit + 10 integration = 22 tests)"

git push origin feature/moduleregistry-phase5-day1-queries
```

---

## ✅ DAY 1 COMPLETE CHECKLIST

- [x] GetAllModulesQuery implemented & tested
- [x] GetModuleByIdQuery implemented & tested
- [x] ModuleResponseDTO created
- [x] ModuleCollectionResponseDTO created
- [x] ModuleNotFoundException created
- [x] ModuleCatalogController updated (no more Domain imports!)
- [x] ModuleCatalogApiTest still passing (10/10)
- [x] New unit tests passing (4 tests for Queries)
- [x] Code committed & pushed

**Total new tests:** 4 unit tests
**Total passing:** 14 tests (4 new + 10 existing API tests)

---

## 🎯 WHAT'S NEXT (DAY 2)

Tomorrow you'll build the **write side** (Commands):
1. InstallModuleCommand
2. UninstallModuleCommand
3. RegisterModuleCommand
4. PublishModuleCommand

**See full Day 2 guide in the main Phase 5 plan.**

---

## 💡 PRO TIPS

1. **Always run tests before committing:**
   ```bash
   php artisan test tests/Unit/Contexts/ModuleRegistry/
   php artisan test tests/Feature/Contexts/ModuleRegistry/
   ```

2. **Keep commits small and focused:**
   - One feature = One commit
   - Good: "feat: add GetAllModulesQuery"
   - Bad: "feat: add queries and commands and services"

3. **Follow TDD religiously:**
   - RED: Write failing test
   - GREEN: Make it pass
   - REFACTOR: Clean up code

4. **Update documentation as you go**

---

## 🆘 TROUBLESHOOTING

### **Problem: Tests can't find Query classes**

```
Class 'App\Contexts\ModuleRegistry\Application\Queries\GetAllModulesQuery' not found
```

**Solution:** Run composer autoload
```bash
composer dump-autoload
```

### **Problem: Repository interface not found**

**Solution:** Make sure Domain layer is complete (Phase 1)
```bash
php artisan test tests/Unit/Contexts/ModuleRegistry/Domain/
```

### **Problem: API tests failing after adding Queries**

**Solution:** Update Instance Binding in `setupQueryInstances()` method (see Step 5)

---

## 📞 NEED HELP?

If stuck:
1. Check the main Phase 5 plan (`20251230_0200_PHASE5_DEVELOPER_PLAN.md`)
2. Review Phase 1 Domain implementation
3. Check existing tests for examples
4. Ask for help with specific error messages

---

**Ready to start? Run Step 1!** 🚀

```bash
git checkout -b feature/moduleregistry-phase5-day1-queries
```
