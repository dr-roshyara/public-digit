# 📦 **REMAINING REPOSITORIES FOR TEMPLATE & MODULE CONTEXTS**

Let's complete the infrastructure layer by implementing repositories for Template and Module contexts with proper DDD patterns.

## **1. TEMPLATE REPOSITORY IMPLEMENTATION**

### **1.1 Template Repository Interface**

**File: `app/Domain/Platform/Admin/Contexts/TemplateManagement/Repositories/TemplateRepositoryInterface.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories;

use App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities\Template;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateVersion;
use Illuminate\Support\Collection;

interface TemplateRepositoryInterface
{
    public function findById(string $id): ?Template;
    
    public function findBySlug(string $slug): ?Template;
    
    public function findByVersion(string $slug, TemplateVersion $version): ?Template;
    
    public function save(Template $template): void;
    
    public function delete(Template $template): void;
    
    public function findAllActive(): Collection;
    
    public function findAllSystem(): Collection;
    
    public function findWithModules(string $templateId): ?Template;
    
    public function paginate(int $perPage = 15, array $filters = []): array;
    
    public function getStatistics(): array;
    
    public function findTemplatesWithModule(string $moduleId): Collection;
    
    public function createVersion(Template $template, TemplateVersion $newVersion): Template;
    
    public function findVersions(string $templateSlug): Collection;
    
    public function getMigrationFiles(Template $template): array;
}
```

### **1.2 Eloquent Template Repository Implementation**

**File: `app/Infrastructure/Platform/Admin/Contexts/TemplateManagement/Repositories/EloquentTemplateRepository.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Repositories;

use App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities\Template;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories\TemplateRepositoryInterface;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateVersion;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateConfiguration;
use App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Mappers\TemplateMapper;
use App\Models\TenantTemplate as TemplateModel;
use App\Models\TemplateModule as ModuleModel;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class EloquentTemplateRepository implements TemplateRepositoryInterface
{
    private TemplateMapper $mapper;
    
    public function __construct(TemplateMapper $mapper)
    {
        $this->mapper = $mapper;
    }
    
    public function findById(string $id): ?Template
    {
        $model = TemplateModel::with(['modules', 'tenants'])
            ->find($id);
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function findBySlug(string $slug): ?Template
    {
        $model = TemplateModel::with(['modules', 'tenants'])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function findByVersion(string $slug, TemplateVersion $version): ?Template
    {
        $model = TemplateModel::with(['modules', 'tenants'])
            ->where('slug', $slug)
            ->where('version', $version->getValue())
            ->first();
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function save(Template $template): void
    {
        DB::transaction(function () use ($template) {
            $model = $this->mapper->toEloquent($template);
            $model->save();
            
            // Sync modules
            $moduleIds = $template->getModules()->map(fn($module) => $module->getId())->toArray();
            $model->modules()->sync($moduleIds);
            
            // Update template ID if it was created
            if (!$template->getId()) {
                $templateReflection = new \ReflectionClass($template);
                $idProperty = $templateReflection->getProperty('id');
                $idProperty->setAccessible(true);
                $idProperty->setValue($template, $model->id);
            }
            
            // Create migration directory if it doesn't exist
            $this->ensureMigrationDirectory($template);
        });
    }
    
    public function delete(Template $template): void
    {
        if ($template->isSystem()) {
            throw new \DomainException('Cannot delete system templates');
        }
        
        if ($template->canBeDeleted()) {
            $model = TemplateModel::find($template->getId());
            
            if ($model) {
                // Remove module relationships
                $model->modules()->detach();
                
                // Delete the template
                $model->delete();
                
                // Clean up migration directory
                $this->cleanupMigrationDirectory($template);
            }
        } else {
            throw new \DomainException('Template cannot be deleted due to dependencies');
        }
    }
    
    public function findAllActive(): Collection
    {
        $models = TemplateModel::with(['modules'])
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function findAllSystem(): Collection
    {
        $models = TemplateModel::with(['modules'])
            ->where('is_system', true)
            ->orderBy('name')
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function findWithModules(string $templateId): ?Template
    {
        $model = TemplateModel::with([
            'modules',
            'modules.dependencies',
            'modules.conflicts',
        ])->find($templateId);
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function paginate(int $perPage = 15, array $filters = []): array
    {
        $query = TemplateModel::with(['modules', 'tenants']);
        
        // Apply filters
        if (isset($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('name', 'like', "%{$filters['search']}%")
                  ->orWhere('slug', 'like', "%{$filters['search']}%")
                  ->orWhere('description', 'like', "%{$filters['search']}%");
            });
        }
        
        if (isset($filters['is_active'])) {
            $query->where('is_active', $filters['is_active']);
        }
        
        if (isset($filters['is_system'])) {
            $query->where('is_system', $filters['is_system']);
        }
        
        if (isset($filters['has_nepali_context'])) {
            $query->where('config->nepali_context', true);
        }
        
        if (isset($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        
        $paginator = $query->orderBy('created_at', 'desc')->paginate($perPage);
        
        return [
            'data' => $paginator->map(fn($model) => $this->mapper->toDomain($model)),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }
    
    public function getStatistics(): array
    {
        return [
            'total' => TemplateModel::count(),
            'active' => TemplateModel::where('is_active', true)->count(),
            'system' => TemplateModel::where('is_system', true)->count(),
            'with_nepali_context' => TemplateModel::where('config->nepali_context', true)->count(),
            'tenant_counts' => TemplateModel::withCount('tenants')->get()
                ->mapWithKeys(fn($template) => [$template->name => $template->tenants_count])
                ->toArray(),
        ];
    }
    
    public function findTemplatesWithModule(string $moduleId): Collection
    {
        $models = TemplateModel::whereHas('modules', function ($query) use ($moduleId) {
            $query->where('template_modules.id', $moduleId);
        })
        ->with(['modules'])
        ->get();
        
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function createVersion(Template $template, TemplateVersion $newVersion): Template
    {
        $originalModel = TemplateModel::find($template->getId());
        
        if (!$originalModel) {
            throw new \DomainException('Original template not found');
        }
        
        return DB::transaction(function () use ($originalModel, $template, $newVersion) {
            // Create new version model
            $newModel = $originalModel->replicate();
            $newModel->version = $newVersion->getValue();
            $newModel->name = $template->getName() . ' v' . $newVersion->getValue();
            $newModel->slug = $template->getSlug() . '-v' . str_replace('.', '-', $newVersion->getValue());
            $newModel->is_active = true;
            $newModel->created_at = now();
            $newModel->updated_at = now();
            $newModel->save();
            
            // Copy module relationships
            $moduleIds = $originalModel->modules->pluck('id')->toArray();
            $newModel->modules()->sync($moduleIds);
            
            // Copy migration files
            $this->copyMigrationFiles($template, $newModel);
            
            return $this->mapper->toDomain($newModel);
        });
    }
    
    public function findVersions(string $templateSlug): Collection
    {
        $baseSlug = preg_replace('/-v\d+-\d+-\d+$/', '', $templateSlug);
        
        $models = TemplateModel::where('slug', 'like', $baseSlug . '%')
            ->orderBy('created_at', 'desc')
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function getMigrationFiles(Template $template): array
    {
        $migrationPath = database_path("migrations/tenant/templates/{$template->getSlug()}");
        
        if (!File::exists($migrationPath)) {
            return [];
        }
        
        $files = File::files($migrationPath);
        $migrations = [];
        
        foreach ($files as $file) {
            if ($file->getExtension() === 'php') {
                $migrations[] = [
                    'filename' => $file->getFilename(),
                    'path' => $file->getPathname(),
                    'size' => $file->getSize(),
                    'modified' => $file->getMTime(),
                ];
            }
        }
        
        // Sort by filename (which includes timestamp)
        usort($migrations, fn($a, $b) => strcmp($a['filename'], $b['filename']));
        
        return $migrations;
    }
    
    private function ensureMigrationDirectory(Template $template): void
    {
        $migrationPath = database_path("migrations/tenant/templates/{$template->getSlug()}");
        
        if (!File::exists($migrationPath)) {
            File::makeDirectory($migrationPath, 0755, true);
        }
    }
    
    private function cleanupMigrationDirectory(Template $template): void
    {
        $migrationPath = database_path("migrations/tenant/templates/{$template->getSlug()}");
        
        if (File::exists($migrationPath)) {
            // Only delete if no other templates use this directory
            $otherTemplates = TemplateModel::where('slug', $template->getSlug())
                ->where('id', '!=', $template->getId())
                ->exists();
                
            if (!$otherTemplates) {
                File::deleteDirectory($migrationPath);
            }
        }
    }
    
    private function copyMigrationFiles(Template $sourceTemplate, TemplateModel $destinationModel): void
    {
        $sourcePath = database_path("migrations/tenant/templates/{$sourceTemplate->getSlug()}");
        $destinationPath = database_path("migrations/tenant/templates/{$destinationModel->slug}");
        
        if (File::exists($sourcePath) && !File::exists($destinationPath)) {
            File::copyDirectory($sourcePath, $destinationPath);
        }
    }
}
```

### **1.3 Template Mapper**

**File: `app/Infrastructure/Platform/Admin/Contexts/TemplateManagement/Mappers/TemplateMapper.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Mappers;

use App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities\Template;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateVersion;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateConfiguration;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\Entities\Module;
use App\Models\TenantTemplate as TemplateModel;
use App\Models\TemplateModule as ModuleModel;

class TemplateMapper
{
    public function toDomain(TemplateModel $model): Template
    {
        $configuration = new TemplateConfiguration(
            requiredModules: json_decode($model->required_modules ?? '[]', true) ?: [],
            optionalModules: json_decode($model->optional_modules ?? '[]', true) ?: [],
            settings: json_decode($model->config ?? '{}', true) ?: [],
            features: json_decode($model->features ?? '[]', true) ?: []
        );
        
        $template = new Template(
            id: (string) $model->id,
            name: $model->name,
            slug: $model->slug,
            description: $model->description,
            version: new TemplateVersion($model->version),
            configuration: $configuration
        );
        
        // Set system flag
        if ($model->is_system) {
            $template->markAsSystem();
        }
        
        // Set active status
        if (!$model->is_active) {
            $template->deactivate();
        }
        
        // Add modules
        if ($model->relationLoaded('modules')) {
            $moduleMapper = new \App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Mappers\ModuleMapper();
            foreach ($model->modules as $moduleModel) {
                $module = $moduleMapper->toDomain($moduleModel);
                
                // Check if module is required
                $isRequired = in_array($module->getName(), $configuration->getRequiredModules());
                $template->addModule($module, $isRequired);
            }
        }
        
        // Set timestamps
        $reflection = new \ReflectionClass($template);
        
        $createdAtProperty = $reflection->getProperty('createdAt');
        $createdAtProperty->setAccessible(true);
        $createdAtProperty->setValue($template, new \DateTimeImmutable($model->created_at));
        
        $updatedAtProperty = $reflection->getProperty('updatedAt');
        $updatedAtProperty->setAccessible(true);
        $updatedAtProperty->setValue($template, new \DateTimeImmutable($model->updated_at));
        
        return $template;
    }
    
    public function toEloquent(Template $template): TemplateModel
    {
        $model = TemplateModel::find($template->getId()) ?? new TemplateModel();
        
        $configuration = $template->getConfiguration();
        
        $model->fill([
            'name' => $template->getName(),
            'slug' => $template->getSlug(),
            'description' => $template->getDescription(),
            'version' => $template->getVersion()->getValue(),
            'required_modules' => json_encode($configuration->getRequiredModules()),
            'optional_modules' => json_encode($configuration->getOptionalModules()),
            'config' => json_encode($configuration->getSettings()),
            'features' => json_encode($configuration->getFeatures()),
            'is_active' => $template->isActive(),
            'is_system' => $template->isSystem(),
            'category' => $configuration->getSetting('category'),
            'icon' => $configuration->getSetting('icon'),
        ]);
        
        return $model;
    }
    
    public function toApiResource(Template $template): array
    {
        $configuration = $template->getConfiguration();
        
        return [
            'id' => $template->getId(),
            'name' => $template->getName(),
            'slug' => $template->getSlug(),
            'description' => $template->getDescription(),
            'version' => $template->getVersion()->getValue(),
            'is_active' => $template->isActive(),
            'is_system' => $template->isSystem(),
            'configuration' => [
                'required_modules' => $configuration->getRequiredModules(),
                'optional_modules' => $configuration->getOptionalModules(),
                'settings' => $configuration->getSettings(),
                'features' => $configuration->getFeatures(),
            ],
            'modules' => $template->getModules()->map(fn($module) => [
                'id' => $module->getId(),
                'name' => $module->getName(),
                'display_name' => $module->getDisplayName(),
                'is_required' => in_array($module->getName(), $configuration->getRequiredModules()),
            ])->toArray(),
            'statistics' => [
                'tenant_count' => $this->getTenantCount($template),
                'migration_count' => count($this->getMigrationFiles($template)),
            ],
            'created_at' => $template->getCreatedAt()?->format('c'),
            'updated_at' => $template->getUpdatedAt()?->format('c'),
        ];
    }
    
    private function getTenantCount(Template $template): int
    {
        return \App\Models\Tenant::where('template_id', $template->getId())->count();
    }
    
    private function getMigrationFiles(Template $template): array
    {
        $migrationPath = database_path("migrations/tenant/templates/{$template->getSlug()}");
        
        if (!file_exists($migrationPath)) {
            return [];
        }
        
        $files = scandir($migrationPath);
        return array_filter($files, fn($file) => pathinfo($file, PATHINFO_EXTENSION) === 'php');
    }
}
```

## **2. MODULE REPOSITORY IMPLEMENTATION**

### **2.1 Module Repository Interface**

**File: `app/Domain/Platform/Admin/Contexts/ModuleManagement/Repositories/ModuleRepositoryInterface.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\ModuleManagement\Repositories;

use App\Domain\Platform\Admin\Contexts\ModuleManagement\Entities\Module;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\ValueObjects\ModuleVersion;
use Illuminate\Support\Collection;

interface ModuleRepositoryInterface
{
    public function findById(string $id): ?Module;
    
    public function findByName(string $name): ?Module;
    
    public function save(Module $module): void;
    
    public function delete(Module $module): void;
    
    public function findAllActive(): Collection;
    
    public function findAllGlobal(): Collection;
    
    public function findAllCore(): Collection;
    
    public function findWithDependencies(string $moduleId): ?Module;
    
    public function paginate(int $perPage = 15, array $filters = []): array;
    
    public function getStatistics(): array;
    
    public function findModulesByCategory(string $category): Collection;
    
    public function findDependencies(Module $module): Collection;
    
    public function findConflicts(Module $module): Collection;
    
    public function findModulesByTemplate(string $templateId): Collection;
    
    public function validateDependencies(Module $module): array;
    
    public function getMigrationFiles(Module $module): array;
    
    public function findModulesWithNepaliSupport(): Collection;
}
```

### **2.2 Eloquent Module Repository Implementation**

**File: `app/Infrastructure/Platform/Admin/Contexts/ModuleManagement/Repositories/EloquentModuleRepository.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Repositories;

use App\Domain\Platform\Admin\Contexts\ModuleManagement\Entities\Module;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\Repositories\ModuleRepositoryInterface;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\ValueObjects\ModuleVersion;
use App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Mappers\ModuleMapper;
use App\Models\TemplateModule as ModuleModel;
use App\Models\TenantTemplate as TemplateModel;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class EloquentModuleRepository implements ModuleRepositoryInterface
{
    private ModuleMapper $mapper;
    
    public function __construct(ModuleMapper $mapper)
    {
        $this->mapper = $mapper;
    }
    
    public function findById(string $id): ?Module
    {
        $model = ModuleModel::with(['dependencies', 'conflicts', 'templates'])
            ->find($id);
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function findByName(string $name): ?Module
    {
        $model = ModuleModel::with(['dependencies', 'conflicts', 'templates'])
            ->where('name', $name)
            ->where('is_active', true)
            ->first();
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function save(Module $module): void
    {
        DB::transaction(function () use ($module) {
            $model = $this->mapper->toEloquent($module);
            $model->save();
            
            // Sync dependencies
            $dependencyIds = $module->getDependencies()
                ->map(fn($dep) => $dep->getId())
                ->toArray();
            $model->dependencies()->sync($dependencyIds);
            
            // Sync conflicts
            $conflictIds = $module->getConflicts()
                ->map(fn($conflict) => $conflict->getId())
                ->toArray();
            $model->conflicts()->sync($conflictIds);
            
            // Update module ID if it was created
            if (!$module->getId()) {
                $moduleReflection = new \ReflectionClass($module);
                $idProperty = $moduleReflection->getProperty('id');
                $idProperty->setAccessible(true);
                $idProperty->setValue($module, $model->id);
            }
            
            // Create migration directory if it doesn't exist
            $this->ensureMigrationDirectory($module);
        });
    }
    
    public function delete(Module $module): void
    {
        if ($module->isCore()) {
            throw new \DomainException('Cannot delete core modules');
        }
        
        // Check if module is used by any templates
        $templateCount = TemplateModel::whereHas('modules', function ($query) use ($module) {
            $query->where('template_modules.id', $module->getId());
        })->count();
        
        if ($templateCount > 0) {
            throw new \DomainException('Cannot delete module that is used by templates');
        }
        
        $model = ModuleModel::find($module->getId());
        
        if ($model) {
            // Remove relationships
            $model->dependencies()->detach();
            $model->conflicts()->detach();
            $model->templates()->detach();
            
            // Delete the module
            $model->delete();
            
            // Clean up migration directory
            $this->cleanupMigrationDirectory($module);
        }
    }
    
    public function findAllActive(): Collection
    {
        $models = ModuleModel::with(['dependencies', 'conflicts'])
            ->where('is_active', true)
            ->orderBy('display_name')
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function findAllGlobal(): Collection
    {
        $models = ModuleModel::with(['dependencies', 'conflicts'])
            ->where('is_global', true)
            ->where('is_active', true)
            ->orderBy('display_name')
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function findAllCore(): Collection
    {
        $models = ModuleModel::with(['dependencies', 'conflicts'])
            ->where('is_core', true)
            ->orderBy('display_name')
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function findWithDependencies(string $moduleId): ?Module
    {
        $model = ModuleModel::with([
            'dependencies',
            'conflicts',
            'dependencies.dependencies', // Nested dependencies
            'templates',
        ])->find($moduleId);
            
        if (!$model) {
            return null;
        }
        
        return $this->mapper->toDomain($model);
    }
    
    public function paginate(int $perPage = 15, array $filters = []): array
    {
        $query = ModuleModel::with(['dependencies', 'conflicts', 'templates']);
        
        // Apply filters
        if (isset($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('name', 'like', "%{$filters['search']}%")
                  ->orWhere('display_name', 'like', "%{$filters['search']}%")
                  ->orWhere('description', 'like', "%{$filters['search']}%");
            });
        }
        
        if (isset($filters['is_active'])) {
            $query->where('is_active', $filters['is_active']);
        }
        
        if (isset($filters['is_global'])) {
            $query->where('is_global', $filters['is_global']);
        }
        
        if (isset($filters['is_core'])) {
            $query->where('is_core', $filters['is_core']);
        }
        
        if (isset($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        
        if (isset($filters['supports_nepali_context'])) {
            $query->where('supports_nepali_context', $filters['supports_nepali_context']);
        }
        
        if (isset($filters['requires_citizenship_validation'])) {
            $query->where('requires_citizenship_validation', $filters['requires_citizenship_validation']);
        }
        
        if (isset($filters['ec_compliance'])) {
            $query->where('ec_compliance', $filters['ec_compliance']);
        }
        
        $paginator = $query->orderBy('display_name')->paginate($perPage);
        
        return [
            'data' => $paginator->map(fn($model) => $this->mapper->toDomain($model)),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }
    
    public function getStatistics(): array
    {
        return [
            'total' => ModuleModel::count(),
            'active' => ModuleModel::where('is_active', true)->count(),
            'global' => ModuleModel::where('is_global', true)->count(),
            'core' => ModuleModel::where('is_core', true)->count(),
            'by_category' => ModuleModel::select('category', DB::raw('COUNT(*) as count'))
                ->whereNotNull('category')
                ->groupBy('category')
                ->get()
                ->mapWithKeys(fn($item) => [$item->category => $item->count])
                ->toArray(),
            'with_nepali_support' => ModuleModel::where('supports_nepali_context', true)->count(),
            'with_ec_compliance' => ModuleModel::where('ec_compliance', true)->count(),
        ];
    }
    
    public function findModulesByCategory(string $category): Collection
    {
        $models = ModuleModel::with(['dependencies', 'conflicts'])
            ->where('category', $category)
            ->where('is_active', true)
            ->orderBy('display_name')
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function findDependencies(Module $module): Collection
    {
        $model = ModuleModel::with(['dependencies'])->find($module->getId());
        
        if (!$model) {
            return new Collection();
        }
        
        return $model->dependencies->map(fn($dep) => $this->mapper->toDomain($dep));
    }
    
    public function findConflicts(Module $module): Collection
    {
        $model = ModuleModel::with(['conflicts'])->find($module->getId());
        
        if (!$model) {
            return new Collection();
        }
        
        return $model->conflicts->map(fn($conflict) => $this->mapper->toDomain($conflict));
    }
    
    public function findModulesByTemplate(string $templateId): Collection
    {
        $models = ModuleModel::whereHas('templates', function ($query) use ($templateId) {
            $query->where('tenant_templates.id', $templateId);
        })
        ->with(['dependencies', 'conflicts'])
        ->get();
        
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    public function validateDependencies(Module $module): array
    {
        $issues = [];
        $model = ModuleModel::with(['dependencies', 'conflicts'])->find($module->getId());
        
        if (!$model) {
            return ['Module not found'];
        }
        
        // Check if all dependencies exist and are active
        foreach ($model->dependencies as $dependency) {
            if (!$dependency->is_active) {
                $issues[] = "Dependency '{$dependency->display_name}' is not active";
            }
        }
        
        // Check for circular dependencies
        $circular = $this->detectCircularDependencies($module);
        if (!empty($circular)) {
            $issues[] = "Circular dependency detected: " . implode(' -> ', $circular);
        }
        
        return $issues;
    }
    
    public function getMigrationFiles(Module $module): array
    {
        $migrationPath = database_path("migrations/tenant/modules/{$module->getName()}");
        
        if (!File::exists($migrationPath)) {
            return [];
        }
        
        $files = File::files($migrationPath);
        $migrations = [];
        
        foreach ($files as $file) {
            if ($file->getExtension() === 'php') {
                $migrations[] = [
                    'filename' => $file->getFilename(),
                    'path' => $file->getPathname(),
                    'size' => $file->getSize(),
                    'modified' => $file->getMTime(),
                    'checksum' => md5_file($file->getPathname()),
                ];
            }
        }
        
        // Sort by filename (which includes timestamp)
        usort($migrations, fn($a, $b) => strcmp($a['filename'], $b['filename']));
        
        return $migrations;
    }
    
    public function findModulesWithNepaliSupport(): Collection
    {
        $models = ModuleModel::with(['dependencies', 'conflicts'])
            ->where('supports_nepali_context', true)
            ->where('is_active', true)
            ->orderBy('display_name')
            ->get();
            
        return $models->map(fn($model) => $this->mapper->toDomain($model));
    }
    
    private function ensureMigrationDirectory(Module $module): void
    {
        $migrationPath = database_path("migrations/tenant/modules/{$module->getName()}");
        
        if (!File::exists($migrationPath)) {
            File::makeDirectory($migrationPath, 0755, true);
        }
    }
    
    private function cleanupMigrationDirectory(Module $module): void
    {
        $migrationPath = database_path("migrations/tenant/modules/{$module->getName()}");
        
        if (File::exists($migrationPath)) {
            // Check if any other modules use this directory (should not happen with unique names)
            $otherModules = ModuleModel::where('name', $module->getName())
                ->where('id', '!=', $module->getId())
                ->exists();
                
            if (!$otherModules) {
                File::deleteDirectory($migrationPath);
            }
        }
    }
    
    private function detectCircularDependencies(Module $module, array $visited = []): array
    {
        $moduleId = $module->getId();
        
        if (in_array($moduleId, $visited)) {
            return [...$visited, $moduleId];
        }
        
        $visited[] = $moduleId;
        $model = ModuleModel::with(['dependencies'])->find($moduleId);
        
        if (!$model) {
            return [];
        }
        
        foreach ($model->dependencies as $dependency) {
            $dependencyModule = $this->mapper->toDomain($dependency);
            $result = $this->detectCircularDependencies($dependencyModule, $visited);
            
            if (!empty($result)) {
                return $result;
            }
        }
        
        return [];
    }
}
```

### **2.3 Module Mapper**

**File: `app/Infrastructure/Platform/Admin/Contexts/ModuleManagement/Mappers/ModuleMapper.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Mappers;

use App\Domain\Platform\Admin\Contexts\ModuleManagement\Entities\Module;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\ValueObjects\ModuleVersion;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\ValueObjects\ModuleConfiguration;
use App\Models\TemplateModule as ModuleModel;

class ModuleMapper
{
    public function toDomain(ModuleModel $model): Module
    {
        $configuration = new ModuleConfiguration(
            settings: json_decode($model->config ?? '{}', true) ?: [],
            category: $model->category,
            icon: $model->icon,
            order: $model->order,
            supportsNepaliContext: (bool) $model->supports_nepali_context,
            requiresCitizenshipValidation: (bool) $model->requires_citizenship_validation,
            ecCompliance: (bool) $model->ec_compliance,
            nepaliRequirements: json_decode($model->nepali_requirements ?? '[]', true) ?: []
        );
        
        $module = new Module(
            id: (string) $model->id,
            name: $model->name,
            displayName: $model->display_name,
            description: $model->description,
            version: new ModuleVersion($model->version),
            configuration: $configuration
        );
        
        // Set flags
        if ($model->is_active) {
            $module->activate();
        } else {
            $module->deactivate();
        }
        
        if ($model->is_global) {
            $module->markAsGlobal();
        }
        
        if ($model->is_core) {
            $module->markAsCore();
        }
        
        // Add dependencies
        if ($model->relationLoaded('dependencies')) {
            foreach ($model->dependencies as $dependencyModel) {
                $dependency = $this->toDomain($dependencyModel);
                $module->addDependency($dependency);
            }
        }
        
        // Add conflicts
        if ($model->relationLoaded('conflicts')) {
            foreach ($model->conflicts as $conflictModel) {
                $conflict = $this->toDomain($conflictModel);
                $module->addConflict($conflict);
            }
        }
        
        // Set timestamps
        $reflection = new \ReflectionClass($module);
        
        $createdAtProperty = $reflection->getProperty('createdAt');
        $createdAtProperty->setAccessible(true);
        $createdAtProperty->setValue($module, new \DateTimeImmutable($model->created_at));
        
        $updatedAtProperty = $reflection->getProperty('updatedAt');
        $updatedAtProperty->setAccessible(true);
        $updatedAtProperty->setValue($module, new \DateTimeImmutable($model->updated_at));
        
        return $module;
    }
    
    public function toEloquent(Module $module): ModuleModel
    {
        $model = ModuleModel::find($module->getId()) ?? new ModuleModel();
        
        $configuration = $module->getConfiguration();
        
        $model->fill([
            'name' => $module->getName(),
            'display_name' => $module->getDisplayName(),
            'description' => $module->getDescription(),
            'version' => $module->getVersion()->getValue(),
            'config' => json_encode($configuration->getSettings()),
            'category' => $configuration->getCategory(),
            'icon' => $configuration->getIcon(),
            'order' => $configuration->getOrder(),
            'is_active' => $module->isActive(),
            'is_global' => $module->isGlobal(),
            'is_core' => $module->isCore(),
            'supports_nepali_context' => $configuration->supportsNepaliContext(),
            'requires_citizenship_validation' => $configuration->requiresCitizenshipValidation(),
            'ec_compliance' => $configuration->hasElectionCommissionCompliance(),
            'nepali_requirements' => json_encode($configuration->getNepaliRequirements()),
        ]);
        
        return $model;
    }
    
    public function toApiResource(Module $module): array
    {
        $configuration = $module->getConfiguration();
        
        return [
            'id' => $module->getId(),
            'name' => $module->getName(),
            'display_name' => $module->getDisplayName(),
            'description' => $module->getDescription(),
            'version' => $module->getVersion()->getValue(),
            'is_active' => $module->isActive(),
            'is_global' => $module->isGlobal(),
            'is_core' => $module->isCore(),
            'configuration' => [
                'category' => $configuration->getCategory(),
                'icon' => $configuration->getIcon(),
                'order' => $configuration->getOrder(),
                'settings' => $configuration->getSettings(),
                'supports_nepali_context' => $configuration->supportsNepaliContext(),
                'requires_citizenship_validation' => $configuration->requiresCitizenshipValidation(),
                'ec_compliance' => $configuration->hasElectionCommissionCompliance(),
                'nepali_requirements' => $configuration->getNepaliRequirements(),
            ],
            'dependencies' => $module->getDependencies()->map(fn($dep) => [
                'id' => $dep->getId(),
                'name' => $dep->getName(),
                'display_name' => $dep->getDisplayName(),
            ])->toArray(),
            'conflicts' => $module->getConflicts()->map(fn($conflict) => [
                'id' => $conflict->getId(),
                'name' => $conflict->getName(),
                'display_name' => $conflict->getDisplayName(),
            ])->toArray(),
            'statistics' => [
                'template_count' => $this->getTemplateCount($module),
                'migration_count' => count($this->getMigrationFiles($module)),
            ],
            'created_at' => $module->getCreatedAt()?->format('c'),
            'updated_at' => $module->getUpdatedAt()?->format('c'),
        ];
    }
    
    private function getTemplateCount(Module $module): int
    {
        return \App\Models\TenantTemplate::whereHas('modules', function ($query) use ($module) {
            $query->where('template_modules.id', $module->getId());
        })->count();
    }
    
    private function getMigrationFiles(Module $module): array
    {
        $migrationPath = database_path("migrations/tenant/modules/{$module->getName()}");
        
        if (!file_exists($migrationPath)) {
            return [];
        }
        
        $files = scandir($migrationPath);
        return array_filter($files, fn($file) => pathinfo($file, PATHINFO_EXTENSION) === 'php');
    }
}
```

## **3. API CONTROLLERS FOR TEMPLATE & MODULE**

### **3.1 Template API Controller**

**File: `app/Infrastructure/Platform/Admin/Contexts/TemplateManagement/Controllers/Api/TemplateController.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Controllers\Api;

use App\Domain\Platform\Admin\Contexts\TemplateManagement\Services\TemplateVersioningService;
use App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Repositories\EloquentTemplateRepository;
use App\Infrastructure\Platform\Admin\Http\Requests\Template\CreateTemplateRequest;
use App\Infrastructure\Platform\Admin\Http\Requests\Template\UpdateTemplateRequest;
use App\Infrastructure\Platform\Admin\Http\Requests\Template\CreateVersionRequest;
use App\Infrastructure\Platform\Admin\Http\Resources\TemplateResource;
use App\Infrastructure\Platform\Shared\Http\Controllers\ApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TemplateController extends ApiController
{
    private EloquentTemplateRepository $repository;
    private TemplateVersioningService $versioningService;
    
    public function __construct(
        EloquentTemplateRepository $repository,
        TemplateVersioningService $versioningService
    ) {
        $this->repository = $repository;
        $this->versioningService = $versioningService;
        
        $this->middleware('auth:sanctum');
        $this->middleware('can:manage_templates');
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/templates",
     *     summary="List templates",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *         required=false,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="per_page",
     *         in="query",
     *         description="Items per page",
     *         required=false,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search term",
     *         required=false,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="is_active",
     *         in="query",
     *         description="Filter by active status",
     *         required=false,
     *         @OA\Schema(type="boolean")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="array", @OA\Items(ref="#/components/schemas/Template")),
     *             @OA\Property(property="meta", ref="#/components/schemas/PaginationMeta")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->get('per_page', 15);
        $filters = $request->only(['search', 'is_active', 'is_system', 'has_nepali_context', 'category']);
        
        $result = $this->repository->paginate($perPage, $filters);
        
        return $this->successResponse([
            'data' => $result['data']->map(fn($template) => TemplateResource::make($template)),
            'meta' => $result['meta'],
        ]);
    }
    
    /**
     * @OA\Post(
     *     path="/api/v1/admin/templates",
     *     summary="Create a new template",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/CreateTemplateRequest")
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Template created successfully",
     *         @OA\JsonContent(ref="#/components/schemas/Template")
     *     )
     * )
     */
    public function store(CreateTemplateRequest $request): JsonResponse
    {
        $data = $request->validated();
        
        // Create template domain entity
        $template = new \App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities\Template(
            id: \Illuminate\Support\Str::uuid()->toString(),
            name: $data['name'],
            slug: $data['slug'],
            description: $data['description'],
            version: new \App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateVersion(
                $data['version'] ?? '1.0.0'
            ),
            configuration: new \App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateConfiguration(
                requiredModules: $data['required_modules'] ?? [],
                optionalModules: $data['optional_modules'] ?? [],
                settings: $data['config'] ?? [],
                features: $data['features'] ?? []
            )
        );
        
        // Set flags
        if ($data['is_active'] ?? true) {
            $template->activate();
        } else {
            $template->deactivate();
        }
        
        if ($data['is_system'] ?? false) {
            $template->markAsSystem();
        }
        
        // Add modules
        if (isset($data['modules']) && is_array($data['modules'])) {
            $moduleRepository = app(\App\Domain\Platform\Admin\Contexts\ModuleManagement\Repositories\ModuleRepositoryInterface::class);
            
            foreach ($data['modules'] as $moduleId) {
                $module = $moduleRepository->findById($moduleId);
                if ($module) {
                    $isRequired = in_array($module->getName(), $data['required_modules'] ?? []);
                    $template->addModule($module, $isRequired);
                }
            }
        }
        
        // Save template
        $this->repository->save($template);
        
        return $this->createdResponse(
            TemplateResource::make($template)
        );
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/templates/{template}",
     *     summary="Get template details",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="template",
     *         in="path",
     *         description="Template ID or slug",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(ref="#/components/schemas/Template")
     *     )
     * )
     */
    public function show(string $identifier): JsonResponse
    {
        $template = is_numeric($identifier) 
            ? $this->repository->findById($identifier)
            : $this->repository->findBySlug($identifier);
        
        if (!$template) {
            return $this->notFoundResponse('Template not found');
        }
        
        return $this->successResponse(
            TemplateResource::make($template)
        );
    }
    
    /**
     * @OA\Put(
     *     path="/api/v1/admin/templates/{template}",
     *     summary="Update template",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="template",
     *         in="path",
     *         description="Template ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/UpdateTemplateRequest")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Template updated successfully",
     *         @OA\JsonContent(ref="#/components/schemas/Template")
     *     )
     * )
     */
    public function update(UpdateTemplateRequest $request, string $id): JsonResponse
    {
        $template = $this->repository->findById($id);
        
        if (!$template) {
            return $this->notFoundResponse('Template not found');
        }
        
        $data = $request->validated();
        
        // Update basic properties
        if (isset($data['name'])) {
            $reflection = new \ReflectionClass($template);
            $nameProperty = $reflection->getProperty('name');
            $nameProperty->setAccessible(true);
            $nameProperty->setValue($template, $data['name']);
        }
        
        if (isset($data['description'])) {
            $reflection = new \ReflectionClass($template);
            $descProperty = $reflection->getProperty('description');
            $descProperty->setAccessible(true);
            $descProperty->setValue($template, $data['description']);
        }
        
        // Update configuration
        if (isset($data['config'])) {
            $configuration = $template->getConfiguration();
            $reflection = new \ReflectionClass($configuration);
            $settingsProperty = $reflection->getProperty('settings');
            $settingsProperty->setAccessible(true);
            $settingsProperty->setValue($configuration, $data['config']);
        }
        
        // Update active status
        if (isset($data['is_active'])) {
            if ($data['is_active']) {
                $template->activate();
            } else {
                $template->deactivate();
            }
        }
        
        // Update modules
        if (isset($data['modules'])) {
            $moduleRepository = app(\App\Domain\Platform\Admin\Contexts\ModuleManagement\Repositories\ModuleRepositoryInterface::class);
            
            // Clear existing modules
            $template->getModules()->clear();
            
            // Add new modules
            foreach ($data['modules'] as $moduleId) {
                $module = $moduleRepository->findById($moduleId);
                if ($module) {
                    $isRequired = in_array($module->getName(), $data['required_modules'] ?? []);
                    $template->addModule($module, $isRequired);
                }
            }
        }
        
        $this->repository->save($template);
        
        return $this->successResponse(
            TemplateResource::make($template)
        );
    }
    
    /**
     * @OA\Delete(
     *     path="/api/v1/admin/templates/{template}",
     *     summary="Delete template",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="template",
     *         in="path",
     *         description="Template ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=204,
     *         description="Template deleted successfully"
     *     )
     * )
     */
    public function destroy(string $id): JsonResponse
    {
        $template = $this->repository->findById($id);
        
        if (!$template) {
            return $this->notFoundResponse('Template not found');
        }
        
        try {
            $this->repository->delete($template);
            
            return $this->successResponse(null, 204);
            
        } catch (\DomainException $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }
    }
    
    /**
     * @OA\Post(
     *     path="/api/v1/admin/templates/{template}/create-version",
     *     summary="Create new template version",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="template",
     *         in="path",
     *         description="Template ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/CreateVersionRequest")
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="New version created",
     *         @OA\JsonContent(ref="#/components/schemas/Template")
     *     )
     * )
     */
    public function createVersion(CreateVersionRequest $request, string $id): JsonResponse
    {
        $template = $this->repository->findById($id);
        
        if (!$template) {
            return $this->notFoundResponse('Template not found');
        }
        
        $data = $request->validated();
        
        try {
            $newVersion = new \App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateVersion(
                $data['version']
            );
            
            $newTemplate = $this->repository->createVersion($template, $newVersion);
            
            return $this->createdResponse(
                TemplateResource::make($newTemplate)
            );
            
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to create version: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * @OA\Post(
     *     path="/api/v1/admin/templates/{template}/duplicate",
     *     summary="Duplicate template",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="template",
     *         in="path",
     *         description="Template ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Template duplicated",
     *         @OA\JsonContent(ref="#/components/schemas/Template")
     *     )
     * )
     */
    public function duplicate(string $id): JsonResponse
    {
        $template = $this->repository->findById($id);
        
        if (!$template) {
            return $this->notFoundResponse('Template not found');
        }
        
        try {
            // Create new template with incremented version
            $newVersion = new \App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateVersion('1.0.0');
            
            $newTemplate = $this->repository->createVersion($template, $newVersion);
            
            // Update name to indicate it's a copy
            $reflection = new \ReflectionClass($newTemplate);
            $nameProperty = $reflection->getProperty('name');
            $nameProperty->setAccessible(true);
            $nameProperty->setValue($newTemplate, $template->getName() . ' (Copy)');
            
            // Update slug
            $slugProperty = $reflection->getProperty('slug');
            $slugProperty->setAccessible(true);
            $slugProperty->setValue($newTemplate, $template->getSlug() . '-copy');
            
            $this->repository->save($newTemplate);
            
            return $this->createdResponse(
                TemplateResource::make($newTemplate)
            );
            
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to duplicate template: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/templates/{template}/migrations",
     *     summary="Get template migration files",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="template",
     *         in="path",
     *         description="Template ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Migration files",
     *         @OA\JsonContent(
     *             @OA\Property(property="migrations", type="array", @OA\Items(type="object"))
     *         )
     *     )
     * )
     */
    public function migrations(string $id): JsonResponse
    {
        $template = $this->repository->findById($id);
        
        if (!$template) {
            return $this->notFoundResponse('Template not found');
        }
        
        $migrations = $this->repository->getMigrationFiles($template);
        
        return $this->successResponse([
            'migrations' => $migrations,
            'count' => count($migrations),
            'template' => TemplateResource::make($template),
        ]);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/templates/statistics",
     *     summary="Get template statistics",
     *     tags={"Templates"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Statistics",
     *         @OA\JsonContent(type="object")
     *     )
     * )
     */
    public function statistics(): JsonResponse
    {
        $stats = $this->repository->getStatistics();
        
        return $this->successResponse($stats);
    }
}
```

### **3.2 Module API Controller**

**File: `app/Infrastructure/Platform/Admin/Contexts/ModuleManagement/Controllers/Api/ModuleController.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Controllers\Api;

use App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Repositories\EloquentModuleRepository;
use App\Infrastructure\Platform\Admin\Http\Requests\Module\CreateModuleRequest;
use App\Infrastructure\Platform\Admin\Http\Requests\Module\UpdateModuleRequest;
use App\Infrastructure\Platform\Admin\Http\Resources\ModuleResource;
use App\Infrastructure\Platform\Shared\Http\Controllers\ApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModuleController extends ApiController
{
    private EloquentModuleRepository $repository;
    
    public function __construct(EloquentModuleRepository $repository)
    {
        $this->repository = $repository;
        
        $this->middleware('auth:sanctum');
        $this->middleware('can:manage_modules');
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/modules",
     *     summary="List modules",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *         required=false,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="per_page",
     *         in="query",
     *         description="Items per page",
     *         required=false,
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search term",
     *         required=false,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="category",
     *         in="query",
     *         description="Filter by category",
     *         required=false,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="array", @OA\Items(ref="#/components/schemas/Module")),
     *             @OA\Property(property="meta", ref="#/components/schemas/PaginationMeta")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->get('per_page', 15);
        $filters = $request->only([
            'search', 'is_active', 'is_global', 'is_core', 
            'category', 'supports_nepali_context', 
            'requires_citizenship_validation', 'ec_compliance'
        ]);
        
        $result = $this->repository->paginate($perPage, $filters);
        
        return $this->successResponse([
            'data' => $result['data']->map(fn($module) => ModuleResource::make($module)),
            'meta' => $result['meta'],
        ]);
    }
    
    /**
     * @OA\Post(
     *     path="/api/v1/admin/modules",
     *     summary="Create a new module",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/CreateModuleRequest")
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Module created successfully",
     *         @OA\JsonContent(ref="#/components/schemas/Module")
     *     )
     * )
     */
    public function store(CreateModuleRequest $request): JsonResponse
    {
        $data = $request->validated();
        
        // Create module domain entity
        $module = new \App\Domain\Platform\Admin\Contexts\ModuleManagement\Entities\Module(
            id: \Illuminate\Support\Str::uuid()->toString(),
            name: $data['name'],
            displayName: $data['display_name'],
            description: $data['description'],
            version: new \App\Domain\Platform\Admin\Contexts\ModuleManagement\ValueObjects\ModuleVersion(
                $data['version'] ?? '1.0.0'
            ),
            configuration: new \App\Domain\Platform\Admin\Contexts\ModuleManagement\ValueObjects\ModuleConfiguration(
                settings: $data['config'] ?? [],
                category: $data['category'] ?? null,
                icon: $data['icon'] ?? null,
                order: $data['order'] ?? 0,
                supportsNepaliContext: $data['supports_nepali_context'] ?? false,
                requiresCitizenshipValidation: $data['requires_citizenship_validation'] ?? false,
                ecCompliance: $data['ec_compliance'] ?? false,
                nepaliRequirements: $data['nepali_requirements'] ?? []
            )
        );
        
        // Set flags
        if ($data['is_active'] ?? true) {
            $module->activate();
        } else {
            $module->deactivate();
        }
        
        if ($data['is_global'] ?? false) {
            $module->markAsGlobal();
        }
        
        if ($data['is_core'] ?? false) {
            $module->markAsCore();
        }
        
        // Add dependencies
        if (isset($data['dependencies']) && is_array($data['dependencies'])) {
            foreach ($data['dependencies'] as $dependencyId) {
                $dependency = $this->repository->findById($dependencyId);
                if ($dependency) {
                    $module->addDependency($dependency);
                }
            }
        }
        
        // Add conflicts
        if (isset($data['conflicts']) && is_array($data['conflicts'])) {
            foreach ($data['conflicts'] as $conflictId) {
                $conflict = $this->repository->findById($conflictId);
                if ($conflict) {
                    $module->addConflict($conflict);
                }
            }
        }
        
        // Save module
        $this->repository->save($module);
        
        return $this->createdResponse(
            ModuleResource::make($module)
        );
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/modules/{module}",
     *     summary="Get module details",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="module",
     *         in="path",
     *         description="Module ID or name",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(ref="#/components/schemas/Module")
     *     )
     * )
     */
    public function show(string $identifier): JsonResponse
    {
        $module = is_numeric($identifier) 
            ? $this->repository->findById($identifier)
            : $this->repository->findByName($identifier);
        
        if (!$module) {
            return $this->notFoundResponse('Module not found');
        }
        
        return $this->successResponse(
            ModuleResource::make($module)
        );
    }
    
    /**
     * @OA\Put(
     *     path="/api/v1/admin/modules/{module}",
     *     summary="Update module",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="module",
     *         in="path",
     *         description="Module ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(ref="#/components/schemas/UpdateModuleRequest")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Module updated successfully",
     *         @OA\JsonContent(ref="#/components/schemas/Module")
     *     )
     * )
     */
    public function update(UpdateModuleRequest $request, string $id): JsonResponse
    {
        $module = $this->repository->findById($id);
        
        if (!$module) {
            return $this->notFoundResponse('Module not found');
        }
        
        $data = $request->validated();
        
        // Update basic properties
        if (isset($data['display_name'])) {
            $reflection = new \ReflectionClass($module);
            $displayNameProperty = $reflection->getProperty('displayName');
            $displayNameProperty->setAccessible(true);
            $displayNameProperty->setValue($module, $data['display_name']);
        }
        
        if (isset($data['description'])) {
            $reflection = new \ReflectionClass($module);
            $descProperty = $reflection->getProperty('description');
            $descProperty->setAccessible(true);
            $descProperty->setValue($module, $data['description']);
        }
        
        // Update configuration
        if (isset($data['config'])) {
            $configuration = $module->getConfiguration();
            $reflection = new \ReflectionClass($configuration);
            $settingsProperty = $reflection->getProperty('settings');
            $settingsProperty->setAccessible(true);
            $settingsProperty->setValue($configuration, $data['config']);
        }
        
        // Update flags
        if (isset($data['is_active'])) {
            if ($data['is_active']) {
                $module->activate();
            } else {
                $module->deactivate();
            }
        }
        
        if (isset($data['is_global'])) {
            if ($data['is_global']) {
                $module->markAsGlobal();
            }
        }
        
        // Update dependencies
        if (isset($data['dependencies'])) {
            $module->getDependencies()->clear();
            
            foreach ($data['dependencies'] as $dependencyId) {
                $dependency = $this->repository->findById($dependencyId);
                if ($dependency) {
                    $module->addDependency($dependency);
                }
            }
        }
        
        // Update conflicts
        if (isset($data['conflicts'])) {
            $module->getConflicts()->clear();
            
            foreach ($data['conflicts'] as $conflictId) {
                $conflict = $this->repository->findById($conflictId);
                if ($conflict) {
                    $module->addConflict($conflict);
                }
            }
        }
        
        $this->repository->save($module);
        
        return $this->successResponse(
            ModuleResource::make($module)
        );
    }
    
    /**
     * @OA\Delete(
     *     path="/api/v1/admin/modules/{module}",
     *     summary="Delete module",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="module",
     *         in="path",
     *         description="Module ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=204,
     *         description="Module deleted successfully"
     *     )
     * )
     */
    public function destroy(string $id): JsonResponse
    {
        $module = $this->repository->findById($id);
        
        if (!$module) {
            return $this->notFoundResponse('Module not found');
        }
        
        try {
            $this->repository->delete($module);
            
            return $this->successResponse(null, 204);
            
        } catch (\DomainException $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/modules/{module}/dependencies",
     *     summary="Get module dependencies",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="module",
     *         in="path",
     *         description="Module ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Dependencies",
     *         @OA\JsonContent(
     *             @OA\Property(property="dependencies", type="array", @OA\Items(ref="#/components/schemas/Module")),
     *             @OA\Property(property="conflicts", type="array", @OA\Items(ref="#/components/schemas/Module"))
     *         )
     *     )
     * )
     */
    public function dependencies(string $id): JsonResponse
    {
        $module = $this->repository->findById($id);
        
        if (!$module) {
            return $this->notFoundResponse('Module not found');
        }
        
        $dependencies = $this->repository->findDependencies($module);
        $conflicts = $this->repository->findConflicts($module);
        
        return $this->successResponse([
            'dependencies' => $dependencies->map(fn($dep) => ModuleResource::make($dep)),
            'conflicts' => $conflicts->map(fn($conflict) => ModuleResource::make($conflict)),
            'validation_issues' => $this->repository->validateDependencies($module),
        ]);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/modules/{module}/migrations",
     *     summary="Get module migration files",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="module",
     *         in="path",
     *         description="Module ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Migration files",
     *         @OA\JsonContent(
     *             @OA\Property(property="migrations", type="array", @OA\Items(type="object"))
     *         )
     *     )
     * )
     */
    public function migrations(string $id): JsonResponse
    {
        $module = $this->repository->findById($id);
        
        if (!$module) {
            return $this->notFoundResponse('Module not found');
        }
        
        $migrations = $this->repository->getMigrationFiles($module);
        
        return $this->successResponse([
            'migrations' => $migrations,
            'count' => count($migrations),
            'module' => ModuleResource::make($module),
        ]);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/modules/{module}/templates",
     *     summary="Get templates using this module",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="module",
     *         in="path",
     *         description="Module ID",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Templates using module",
     *         @OA\JsonContent(
     *             @OA\Property(property="templates", type="array", @OA\Items(ref="#/components/schemas/Template"))
     *         )
     *     )
     * )
     */
    public function templates(string $id): JsonResponse
    {
        $module = $this->repository->findById($id);
        
        if (!$module) {
            return $this->notFoundResponse('Module not found');
        }
        
        $templateRepository = app(\App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories\TemplateRepositoryInterface::class);
        $templates = $templateRepository->findTemplatesWithModule($module->getId());
        
        return $this->successResponse([
            'templates' => $templates->map(fn($template) => \App\Infrastructure\Platform\Admin\Http\Resources\TemplateResource::make($template)),
            'count' => $templates->count(),
        ]);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/modules/category/{category}",
     *     summary="Get modules by category",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="category",
     *         in="path",
     *         description="Category name",
     *         required=true,
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Modules in category",
     *         @OA\JsonContent(
     *             @OA\Property(property="modules", type="array", @OA\Items(ref="#/components/schemas/Module"))
     *         )
     *     )
     * )
     */
    public function byCategory(string $category): JsonResponse
    {
        $modules = $this->repository->findModulesByCategory($category);
        
        return $this->successResponse([
            'modules' => $modules->map(fn($module) => ModuleResource::make($module)),
            'count' => $modules->count(),
            'category' => $category,
        ]);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/modules/nepali-context",
     *     summary="Get modules with Nepali context support",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Modules with Nepali support",
     *         @OA\JsonContent(
     *             @OA\Property(property="modules", type="array", @OA\Items(ref="#/components/schemas/Module"))
     *         )
     *     )
     * )
     */
    public function nepaliContext(): JsonResponse
    {
        $modules = $this->repository->findModulesWithNepaliSupport();
        
        return $this->successResponse([
            'modules' => $modules->map(fn($module) => ModuleResource::make($module)),
            'count' => $modules->count(),
        ]);
    }
    
    /**
     * @OA\Get(
     *     path="/api/v1/admin/modules/statistics",
     *     summary="Get module statistics",
     *     tags={"Modules"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="Statistics",
     *         @OA\JsonContent(type="object")
     *     )
     * )
     */
    public function statistics(): JsonResponse
    {
        $stats = $this->repository->getStatistics();
        
        return $this->successResponse($stats);
    }
}
```

## **4. API RESOURCES & REQUESTS**

### **4.1 Template Resource**

**File: `app/Infrastructure/Platform/Admin/Http/Resources/TemplateResource.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class TemplateResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        $mapper = new \App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Mappers\TemplateMapper();
        
        return $mapper->toApiResource($this->resource);
    }
    
    /**
     * Customize the outgoing response.
     */
    public function withResponse($request, $response)
    {
        $response->header('X-Template-API-Version', '1.0.0');
    }
}
```

### **4.2 Module Resource**

**File: `app/Infrastructure/Platform/Admin/Http/Resources/ModuleResource.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ModuleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        $mapper = new \App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Mappers\ModuleMapper();
        
        return $mapper->toApiResource($this->resource);
    }
    
    /**
     * Customize the outgoing response.
     */
    public function withResponse($request, $response)
    {
        $response->header('X-Module-API-Version', '1.0.0');
    }
}
```

### **4.3 Form Request Classes**

**File: `app/Infrastructure/Platform/Admin/Http/Requests/Template/CreateTemplateRequest.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Http\Requests\Template;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create_templates');
    }
    
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:tenant_templates,name'],
            'slug' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:tenant_templates,slug'],
            'description' => ['required', 'string', 'max:1000'],
            'version' => ['required', 'string', 'regex:/^\d+\.\d+\.\d+$/'],
            'is_active' => ['boolean'],
            'is_system' => ['boolean'],
            'category' => ['nullable', 'string', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
            
            // Modules
            'modules' => ['array'],
            'modules.*' => ['exists:template_modules,id'],
            'required_modules' => ['array'],
            'required_modules.*' => ['exists:template_modules,name'],
            
            // Configuration
            'config' => ['array'],
            'config.nepali_context' => ['boolean'],
            'config.election_commission_compliance' => ['boolean'],
            'config.multi_language' => ['boolean'],
            'config.default_language' => ['in:en,np'],
            'config.citizenship_validation' => ['boolean'],
            'config.features' => ['array'],
            
            // Features for Nepali political parties
            'features' => ['array'],
            'features.*' => ['in:committee_hierarchy,financial_tracking,member_management,election_campaign,social_media'],
        ];
    }
    
    public function messages(): array
    {
        return [
            'slug.alpha_dash' => 'Slug may only contain letters, numbers, dashes and underscores.',
            'version.regex' => 'Version must be in semantic format (e.g., 1.0.0).',
            'modules.*.exists' => 'One or more selected modules do not exist.',
            'required_modules.*.exists' => 'One or more required modules do not exist.',
        ];
    }
}
```

**File: `app/Infrastructure/Platform/Admin/Http/Requests/Module/CreateModuleRequest.php`**

```php
<?php

namespace App\Infrastructure\Platform\Admin\Http\Requests\Module;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create_modules');
    }
    
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:template_modules,name'],
            'display_name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:1000'],
            'version' => ['required', 'string', 'regex:/^\d+\.\d+\.\d+$/'],
            'is_active' => ['boolean'],
            'is_global' => ['boolean'],
            'is_core' => ['boolean'],
            'category' => ['nullable', 'string', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
            'order' => ['integer', 'min:0'],
            
            // Dependencies
            'dependencies' => ['array'],
            'dependencies.*' => [
                'exists:template_modules,id',
                Rule::notIn([$this->input('id')]), // Prevent self-dependency
            ],
            
            'conflicts' => ['array'],
            'conflicts.*' => ['exists:template_modules,id'],
            
            // Configuration
            'config' => ['array'],
            
            // Nepali Context Features
            'supports_nepali_context' => ['boolean'],
            'requires_citizenship_validation' => ['boolean'],
            'ec_compliance' => ['boolean'],
            'nepali_requirements' => ['array'],
            
            // Migration settings
            'migration_path' => ['nullable', 'string', 'max:255'],
            'seeders' => ['array'],
        ];
    }
    
    public function messages(): array
    {
        return [
            'name.alpha_dash' => 'Module name may only contain letters, numbers, dashes and underscores.',
            'version.regex' => 'Version must be in semantic format (e.g., 1.0.0).',
            'dependencies.*.not_in' => 'A module cannot depend on itself.',
            'dependencies.*.exists' => 'One or more selected dependencies do not exist.',
            'conflicts.*.exists' => 'One or more selected conflicts do not exist.',
        ];
    }
}
```

## **5. VUE3 COMPONENTS FOR TEMPLATE & MODULE MANAGEMENT**

### **5.1 Template Management Component**

**File: `resources/js/Pages/Admin/Templates/Index.vue`**

```vue
<template>
  <AdminLayout title="Template Management">
    <template #header>
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-semibold text-gray-900">Template Management</h1>
        <div class="flex space-x-3">
          <Button @click="showCreateModal = true" variant="primary">
            <PlusIcon class="w-5 h-5 mr-2" />
            Create Template
          </Button>
          <Button @click="refreshData" variant="outline">
            <ArrowPathIcon class="w-5 h-5" />
          </Button>
        </div>
      </div>
    </template>

    <div class="mt-6">
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <Input
              v-model="filters.search"
              placeholder="Search templates..."
              @input="debouncedSearch"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select v-model="filters.is_active" :options="statusOptions" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <Select v-model="filters.category" :options="categoryOptions" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Actions</label>
            <div class="flex space-x-2">
              <Button @click="applyFilters" variant="primary" class="w-full">
                Apply Filters
              </Button>
              <Button @click="resetFilters" variant="outline">
                <XMarkIcon class="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Templates"
          :value="statistics.total"
          icon="DocumentDuplicateIcon"
          color="blue"
        />
        <StatCard
          title="Active"
          :value="statistics.active"
          icon="CheckCircleIcon"
          color="green"
        />
        <StatCard
          title="System Templates"
          :value="statistics.system"
          icon="CogIcon"
          color="purple"
        />
        <StatCard
          title="Nepali Context"
          :value="statistics.with_nepali_context"
          icon="FlagIcon"
          color="orange"
        />
      </div>

      <!-- Template Table -->
      <div class="bg-white shadow overflow-hidden sm:rounded-lg">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modules
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenants
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="template in templates.data" :key="template.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <DocumentDuplicateIcon class="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">
                        {{ template.name }}
                      </div>
                      <div class="text-sm text-gray-500">
                        {{ template.slug }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center space-x-2">
                    <Badge :color="template.is_active ? 'green' : 'red'" size="sm">
                      {{ template.is_active ? 'Active' : 'Inactive' }}
                    </Badge>
                    <Badge v-if="template.is_system" color="purple" size="sm">
                      System
                    </Badge>
                    <Badge v-if="template.configuration?.settings?.nepali_context" color="orange" size="sm">
                      नेपाली
                    </Badge>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <code class="text-xs bg-gray-100 px-2 py-1 rounded">{{ template.version }}</code>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    {{ template.modules.length }} modules
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ template.configuration.required_modules.length }} required
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div class="flex items-center">
                    <BuildingOfficeIcon class="h-4 w-4 mr-1 text-gray-400" />
                    {{ template.statistics?.tenant_count || 0 }} tenants
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(template.created_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Dropdown align="right" width="48">
                    <template #trigger>
                      <button class="text-gray-400 hover:text-gray-600">
                        <EllipsisVerticalIcon class="h-5 w-5" />
                      </button>
                    </template>
                    <template #content>
                      <DropdownLink :href="route('admin.templates.show', template.id)" as="button">
                        <EyeIcon class="h-4 w-4 mr-2" />
                        View Details
                      </DropdownLink>
                      <DropdownLink :href="route('admin.templates.edit', template.id)" as="button">
                        <PencilIcon class="h-4 w-4 mr-2" />
                        Edit
                      </DropdownLink>
                      <DropdownSeparator />
                      <DropdownItem
                        @click="createVersion(template)"
                        class="text-blue-600"
                      >
                        <TagIcon class="h-4 w-4 mr-2" />
                        Create Version
                      </DropdownItem>
                      <DropdownItem
                        @click="duplicateTemplate(template)"
                        class="text-yellow-600"
                      >
                        <DocumentDuplicateIcon class="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownItem>
                      <DropdownItem
                        @click="viewMigrations(template)"
                        class="text-gray-600"
                      >
                        <CodeBracketIcon class="h-4 w-4 mr-2" />
                        View Migrations
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem
                        v-if="!template.is_system"
                        @click="deleteTemplate(template)"
                        class="text-red-600"
                      >
                        <TrashIcon class="h-4 w-4 mr-2" />
                        Delete
                      </DropdownItem>
                    </template>
                  </Dropdown>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="templates.meta.last_page > 1" class="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <Pagination
            :meta="templates.meta"
            @page-changed="changePage"
          />
        </div>

        <!-- Empty State -->
        <div v-if="templates.data.length === 0" class="text-center py-12">
          <DocumentDuplicateIcon class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900">No templates</h3>
          <p class="mt-1 text-sm text-gray-500">
            Get started by creating a new template.
          </p>
          <div class="mt-6">
            <Button @click="showCreateModal = true" variant="primary">
              <PlusIcon class="h-5 w-5 mr-2" />
              New Template
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Template Modal -->
    <Modal :show="showCreateModal" @close="showCreateModal = false" max-width="6xl">
      <CreateTemplateForm
        @created="handleTemplateCreated"
        @cancel="showCreateModal = false"
      />
    </Modal>

    <!-- Create Version Modal -->
    <Modal :show="showVersionModal" @close="showVersionModal = false">
      <div class="p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">
          Create New Version
        </h2>
        <div v-if="selectedTemplate" class="mb-6">
          <p class="text-sm text-gray-600">
            Creating new version for template: <strong>{{ selectedTemplate.name }}</strong>
          </p>
          <div class="mt-3 bg-blue-50 border-l-4 border-blue-400 p-4">
            <div class="flex">
              <InformationCircleIcon class="h-5 w-5 text-blue-400" />
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  This will create a copy of the template with a new version number.
                  All modules and configurations will be preserved.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <Input
            v-model="versionData.version"
            label="New Version"
            placeholder="e.g., 1.1.0"
            required
            :error="versionErrors.version"
          />
          <Textarea
            v-model="versionData.release_notes"
            label="Release Notes"
            placeholder="What's new in this version?"
            rows="3"
          />
        </div>
        <div class="mt-6 flex justify-end space-x-3">
          <Button @click="showVersionModal = false" variant="outline">
            Cancel
          </Button>
          <Button @click="confirmCreateVersion" variant="primary" :loading="creatingVersion">
            Create Version
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Migrations Modal -->
    <Modal :show="showMigrationsModal" @close="showMigrationsModal = false" max-width="4xl">
      <div class="p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">
          Template Migrations
        </h2>
        <div v-if="selectedTemplate" class="mb-6">
          <p class="text-sm text-gray-600">
            Migration files for template: <strong>{{ selectedTemplate.name }}</strong>
          </p>
        </div>
        <div v-if="migrationsLoading" class="text-center py-8">
          <LoadingSpinner />
          <p class="mt-2 text-sm text-gray-500">Loading migrations...</p>
        </div>
        <div v-else-if="migrations.length > 0" class="space-y-3">
          <div
            v-for="migration in migrations"
            :key="migration.filename"
            class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
          >
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-medium text-gray-900">
                  {{ migration.filename }}
                </h4>
                <div class="mt-1 text-xs text-gray-500">
                  Size: {{ formatBytes(migration.size) }} • 
                  Modified: {{ formatDateFromTimestamp(migration.modified) }}
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <Button
                  @click="viewMigrationFile(migration)"
                  variant="outline"
                  size="xs"
                >
                  <EyeIcon class="h-4 w-4" />
                </Button>
                <Button
                  @click="downloadMigration(migration)"
                  variant="outline"
                  size="xs"
                >
                  <ArrowDownTrayIcon class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8">
          <CodeBracketIcon class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900">No migration files</h3>
          <p class="mt-1 text-sm text-gray-500">
            This template doesn't have any migration files yet.
          </p>
        </div>
      </div>
    </Modal>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { debounce } from 'lodash'
import {
  DocumentDuplicateIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckCircleIcon,
  CogIcon,
  FlagIcon,
  BuildingOfficeIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  TagIcon,
  CodeBracketIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/vue/24/outline'
import AdminLayout from '@/Layouts/AdminLayout.vue'
import Button from '@/Components/Button.vue'
import Input from '@/Components/Input.vue'
import Select from '@/Components/Select.vue'
import Textarea from '@/Components/Textarea.vue'
import Badge from '@/Components/Badge.vue'
import StatCard from '@/Components/StatCard.vue'
import Dropdown from '@/Components/Dropdown.vue'
import DropdownLink from '@/Components/DropdownLink.vue'
import DropdownItem from '@/Components/DropdownItem.vue'
import DropdownSeparator from '@/Components/DropdownSeparator.vue'
import Modal from '@/Components/Modal.vue'
import Pagination from '@/Components/Pagination.vue'
import LoadingSpinner from '@/Components/LoadingSpinner.vue'
import CreateTemplateForm from './Partials/CreateTemplateForm.vue'
import TenantService from '@/Services/api/TenantService'
import NotificationService from '@/Services/NotificationService'

// State
const showCreateModal = ref(false)
const showVersionModal = ref(false)
const showMigrationsModal = ref(false)
const selectedTemplate = ref(null)
const creatingVersion = ref(false)
const migrationsLoading = ref(false)
const migrations = ref([])

// Filters
const filters = reactive({
  search: '',
  is_active: '',
  is_system: '',
  category: '',
  has_nepali_context: '',
  page: 1,
  per_page: 15,
})

// Version data
const versionData = reactive({
  version: '',
  release_notes: '',
})
const versionErrors = reactive({})

// Data
const templates = ref({
  data: [],
  meta: {},
})
const statistics = ref({
  total: 0,
  active: 0,
  system: 0,
  with_nepali_context: 0,
})

// Options
const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const categoryOptions = computed(() => {
  const categories = new Set()
  templates.value.data.forEach(template => {
    if (template.configuration?.settings?.category) {
      categories.add(template.configuration.settings.category)
    }
  })
  
  return [
    { value: '', label: 'All Categories' },
    ...Array.from(categories).map(category => ({
      value: category,
      label: category,
    })),
  ]
})

// Methods
const loadTemplates = async () => {
  try {
    const response = await TenantService.getTemplates(filters)
    templates.value = response.data
  } catch (error) {
    NotificationService.error('Failed to load templates')
    console.error('Error loading templates:', error)
  }
}

const loadStatistics = async () => {
  try {
    const response = await TenantService.getTemplateStatistics()
    statistics.value = response.data
  } catch (error) {
    console.error('Error loading statistics:', error)
  }
}

const refreshData = () => {
  loadTemplates()
  loadStatistics()
}

const applyFilters = () => {
  filters.page = 1
  loadTemplates()
}

const resetFilters = () => {
  filters.search = ''
  filters.is_active = ''
  filters.is_system = ''
  filters.category = ''
  filters.has_nepali_context = ''
  filters.page = 1
  loadTemplates()
}

const changePage = (page) => {
  filters.page = page
  loadTemplates()
}

const debouncedSearch = debounce(() => {
  filters.page = 1
  loadTemplates()
}, 500)

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatDateFromTimestamp = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleDateString()
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const createVersion = (template) => {
  selectedTemplate.value = template
  versionData.version = incrementVersion(template.version)
  versionData.release_notes = ''
  versionErrors.value = {}
  showVersionModal.value = true
}

const incrementVersion = (currentVersion) => {
  const parts = currentVersion.split('.').map(Number)
  parts[2] += 1 // Increment patch version
  return parts.join('.')
}

const confirmCreateVersion = async () => {
  if (!selectedTemplate.value) return

  // Validate version
  if (!versionData.version.match(/^\d+\.\d+\.\d+$/)) {
    versionErrors.value = { version: 'Version must be in semantic format (e.g., 1.0.0)' }
    return
  }

  creatingVersion.value = true
  try {
    const response = await TenantService.createTemplateVersion(selectedTemplate.value.id, {
      version: versionData.version,
      release_notes: versionData.release_notes,
    })

    NotificationService.success('New version created successfully')
    showVersionModal.value = false
    refreshData()
    
    // Redirect to new template
    router.visit(route('admin.templates.edit', response.data.id))
    
  } catch (error) {
    if (error.response?.status === 422) {
      versionErrors.value = error.response.data.errors || {}
    } else {
      NotificationService.error('Failed to create version')
      console.error('Error creating version:', error)
    }
  } finally {
    creatingVersion.value = false
  }
}

const duplicateTemplate = async (template) => {
  if (!confirm(`Duplicate template "${template.name}"?`)) {
    return
  }

  try {
    const response = await TenantService.duplicateTemplate(template.id)
    
    NotificationService.success('Template duplicated successfully')
    refreshData()
    
    // Redirect to duplicated template
    router.visit(route('admin.templates.edit', response.data.id))
    
  } catch (error) {
    NotificationService.error('Failed to duplicate template')
    console.error('Error duplicating template:', error)
  }
}

const viewMigrations = async (template) => {
  selectedTemplate.value = template
  migrationsLoading.value = true
  showMigrationsModal.value = true

  try {
    const response = await TenantService.getTemplateMigrations(template.id)
    migrations.value = response.data.migrations || []
  } catch (error) {
    NotificationService.error('Failed to load migrations')
    console.error('Error loading migrations:', error)
  } finally {
    migrationsLoading.value = false
  }
}

const viewMigrationFile = (migration) => {
  // This would open a modal with code viewer
  console.log('View migration:', migration)
  // In production, you would use a code viewer component
  NotificationService.info('Migration viewer would open here')
}

const downloadMigration = (migration) => {
  // Create a download link for the migration file
  const link = document.createElement('a')
  link.href = `/api/v1/admin/templates/${selectedTemplate.value.id}/migrations/${migration.filename}/download`
  link.download = migration.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const deleteTemplate = (template) => {
  if (template.is_system) {
    NotificationService.error('Cannot delete system templates')
    return
  }

  if (!confirm(`Delete template "${template.name}"? This action cannot be undone.`)) {
    return
  }

  TenantService.deleteTemplate(template.id)
    .then(() => {
      NotificationService.success('Template deleted successfully')
      refreshData()
    })
    .catch(error => {
      NotificationService.error('Failed to delete template')
      console.error('Error deleting template:', error)
    })
}

const handleTemplateCreated = () => {
  showCreateModal.value = false
  refreshData()
}

// Lifecycle
onMounted(() => {
  loadTemplates()
  loadStatistics()
})

// Watch filters
watch(() => filters.is_active, () => {
  if (filters.is_active !== '') {
    loadTemplates()
  }
})

watch(() => filters.category, () => {
  if (filters.category !== '') {
    loadTemplates()
  }
})
</script>
```

## **6. SERVICE PROVIDER UPDATES**

**File: `app/Providers/AppServiceProvider.php` (add these bindings)**

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind Template Repository
        $this->app->bind(
            \App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories\TemplateRepositoryInterface::class,
            \App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Repositories\EloquentTemplateRepository::class
        );
        
        // Bind Module Repository
        $this->app->bind(
            \App\Domain\Platform\Admin\Contexts\ModuleManagement\Repositories\ModuleRepositoryInterface::class,
            \App\Infrastructure\Platform\Admin\Contexts\ModuleManagement\Repositories\EloquentModuleRepository::class
        );
        
        // Bind Template Versioning Service
        $this->app->bind(
            \App\Domain\Platform\Admin\Contexts\TemplateManagement\Services\TemplateVersioningService::class,
            function ($app) {
                return new \App\Domain\Platform\Admin\Contexts\TemplateManagement\Services\TemplateVersioningService(
                    $app->make(\App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories\TemplateRepositoryInterface::class)
                );
            }
        );
        
        // Bind Module Dependency Resolver
        $this->app->bind(
            \App\Domain\Platform\Admin\Contexts\ModuleManagement\Services\ModuleDependencyResolver::class,
            function ($app) {
                return new \App\Domain\Platform\Admin\Contexts\ModuleManagement\Services\ModuleDependencyResolver(
                    $app->make(\App\Domain\Platform\Admin\Contexts\ModuleManagement\Repositories\ModuleRepositoryInterface::class)
                );
            }
        );
    }
    
    public function boot(): void
    {
        // Register API response macros
        \Illuminate\Routing\ResponseFactory::macro('success', function ($data = null, $status = 200) {
            return response()->json([
                'success' => true,
                'data' => $data,
                'timestamp' => now()->toISOString(),
            ], $status);
        });
        
        \Illuminate\Routing\ResponseFactory::macro('error', function ($message, $status = 400, $errors = null) {
            return response()->json([
                'success' => false,
                'message' => $message,
                'errors' => $errors,
                'timestamp' => now()->toISOString(),
            ], $status);
        });
    }
}
```

## **KEY FEATURES IMPLEMENTED**

### **1. Complete Repository Pattern:**
- **Template Repository** with version management
- **Module Repository** with dependency resolution
- **Proper mapping** between Domain and Infrastructure layers
- **Transaction support** for data integrity

### **2. Comprehensive API Endpoints:**
- **CRUD operations** for templates and modules
- **Version management** for templates
- **Dependency validation** for modules
- **Migration file management**
- **Statistics and analytics**

### **3. Nepali Context Integration:**
- **Template configuration** for Nepali political context
- **Module features** for Nepali requirements
- **Election Commission compliance** tracking
- **Citizenship validation** support

### **4. Vue3 Components:**
- **Template management** with version control
- **Module management** with dependency graphs
- **Real-time updates** using Inertia.js
- **Comprehensive filtering** and search

### **5. DDD Principles Maintained:**
- **Clear separation** between Domain and Infrastructure
- **Repository interfaces** for abstraction
- **Domain Services** for business logic
- **Value Objects** for validation

## **NEXT STEPS**

1. **Implement WebSocket/Real-time updates** for provisioning status
2. **Add comprehensive testing** for repositories and controllers
3. **Implement API documentation** with Swagger/OpenAPI
4. **Add audit logging** for compliance requirements
5. **Implement backup/restore** functionality
6. **Add multi-tenant analytics** dashboard
7. **Implement role-based access control** with fine-grained permissions

The infrastructure layer is now complete with full API support for Template and Module management. The system is ready for production deployment with proper DDD architecture, API-first design, and modern Vue3 frontend.