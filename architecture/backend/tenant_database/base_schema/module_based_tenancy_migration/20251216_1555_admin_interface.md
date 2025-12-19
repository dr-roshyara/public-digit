# 🏛️ **ADMIN INTERFACE COMPONENTS WITH DDD PRINCIPLES**

Let's create a comprehensive admin interface for the platform context following Domain-Driven Design principles.
 We'll structure this with clear bounded contexts and rich domain models.

## **1. DOMAIN STRUCTURE & BOUNDED CONTEXTS**

First, let's define our bounded contexts for the Platform Admin:

```
app/
├── Domain/ 
│   ├── Platform/ 
│   │   ├── Admin/
│   │   │   ├── Contexts/
│   │   │   │   ├── TenantManagement/
│   │   │   │   │   ├── Entities/
│   │   │   │   │   ├── ValueObjects/
│   │   │   │   │   ├── Repositories/
│   │   │   │   │   ├── Services/
│   │   │   │   │   └── Specifications/
│   │   │   │   ├── TemplateManagement/
│   │   │   │   │   ├── Entities/
│   │   │   │   │   ├── ValueObjects/
│   │   │   │   │   └── ...
│   │   │   │   └── SchemaManagement/
│   │   │   │       ├── Entities/
│   │   │   │       ├── ValueObjects/
│   │   │   │       └── ...
│   │   │   ├── Enums/
│   │   │   ├── Exceptions/
│   │   │   └── Policies/
│   │   └── Shared/
│   │       ├── ValueObjects/
│   │       └── Events/
```

## **2. DOMAIN ENTITIES & VALUE OBJECTS**

### **2.1 Tenant Management Context**

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/Entities/TenantAggregate.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\Entities;

use App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantStatus;
use App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\TenantConfiguration;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities\Template;
use App\Domain\Platform\Shared\ValueObjects\DomainName;
use App\Domain\Platform\Shared\ValueObjects\DatabaseName;
use Illuminate\Support\Collection;

class TenantAggregate
{
    private string $id;
    private string $name;
    private string $slug;
    private DomainName $domain;
    private DatabaseName $database;
    private TenantStatus $status;
    private TenantConfiguration $configuration;
    private ?Template $template = null;
    private Collection $modules;
    private Collection $provisioningHistory;
    private ?\DateTimeImmutable $createdAt;
    private ?\DateTimeImmutable $updatedAt;
    
    public function __construct(
        string $id,
        string $name,
        string $slug,
        DomainName $domain,
        DatabaseName $database,
        TenantStatus $status,
        TenantConfiguration $configuration
    ) {
        $this->id = $id;
        $this->name = $name;
        $this->slug = $slug;
        $this->domain = $domain;
        $this->database = $database;
        $this->status = $status;
        $this->configuration = $configuration;
        $this->modules = new Collection();
        $this->provisioningHistory = new Collection();
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    public function getId(): string
    {
        return $this->id;
    }
    
    public function getName(): string
    {
        return $this->name;
    }
    
    public function getSlug(): string
    {
        return $this->slug;
    }
    
    public function getDomain(): DomainName
    {
        return $this->domain;
    }
    
    public function getDatabase(): DatabaseName
    {
        return $this->database;
    }
    
    public function getStatus(): TenantStatus
    {
        return $this->status;
    }
    
    public function getConfiguration(): TenantConfiguration
    {
        return $this->configuration;
    }
    
    public function getTemplate(): ?Template
    {
        return $this->template;
    }
    
    public function setTemplate(Template $template): void
    {
        $this->template = $template;
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    public function getModules(): Collection
    {
        return $this->modules;
    }
    
    public function addModule(Module $module): void
    {
        if (!$this->modules->contains($module)) {
            $this->modules->add($module);
            $this->updatedAt = new \DateTimeImmutable();
        }
    }
    
    public function removeModule(Module $module): void
    {
        if ($this->modules->contains($module)) {
            $this->modules = $this->modules->reject(fn($m) => $m->getId() === $module->getId());
            $this->updatedAt = new \DateTimeImmutable();
        }
    }
    
    public function canBeProvisioned(): bool
    {
        return $this->status->canTransitionTo(TenantStatus::PROVISIONING) 
            && $this->template !== null
            && $this->validateTemplateCompatibility();
    }
    
    public function startProvisioning(): void
    {
        if (!$this->canBeProvisioned()) {
            throw new \DomainException('Tenant cannot be provisioned in current state');
        }
        
        $this->status = TenantStatus::PROVISIONING();
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    public function completeProvisioning(): void
    {
        $this->status = TenantStatus::ACTIVE();
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    public function failProvisioning(string $error): void
    {
        $this->status = TenantStatus::FAILED();
        $this->configuration = $this->configuration->withProvisioningError($error);
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    private function validateTemplateCompatibility(): bool
    {
        if (!$this->template) {
            return false;
        }
        
        // Check required modules are selected
        $requiredModules = $this->template->getRequiredModules();
        $selectedModules = $this->modules->map(fn($m) => $m->getName())->toArray();
        
        foreach ($requiredModules as $required) {
            if (!in_array($required, $selectedModules)) {
                return false;
            }
        }
        
        return true;
    }
}
```

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/ValueObjects/TenantStatus.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects;

enum TenantStatus: string
{
    case DRAFT = 'draft';
    case PENDING = 'pending';
    case PROVISIONING = 'provisioning';
    case ACTIVE = 'active';
    case SUSPENDED = 'suspended';
    case FAILED = 'failed';
    case ARCHIVED = 'archived';
    
    public function getLabel(): string
    {
        return match($this) {
            self::DRAFT => 'Draft',
            self::PENDING => 'Pending Review',
            self::PROVISIONING => 'Provisioning',
            self::ACTIVE => 'Active',
            self::SUSPENDED => 'Suspended',
            self::FAILED => 'Failed',
            self::ARCHIVED => 'Archived',
        };
    }
    
    public function getColor(): string
    {
        return match($this) {
            self::DRAFT => 'gray',
            self::PENDING => 'yellow',
            self::PROVISIONING => 'blue',
            self::ACTIVE => 'green',
            self::SUSPENDED => 'orange',
            self::FAILED => 'red',
            self::ARCHIVED => 'gray',
        };
    }
    
    public function canTransitionTo(TenantStatus $target): bool
    {
        $transitions = [
            self::DRAFT->value => [self::PENDING, self::ARCHIVED],
            self::PENDING->value => [self::PROVISIONING, self::ARCHIVED],
            self::PROVISIONING->value => [self::ACTIVE, self::FAILED],
            self::ACTIVE->value => [self::SUSPENDED, self::ARCHIVED],
            self::SUSPENDED->value => [self::ACTIVE, self::ARCHIVED],
            self::FAILED->value => [self::PENDING, self::ARCHIVED],
            self::ARCHIVED->value => [],
        ];
        
        return in_array($target, $transitions[$this->value] ?? []);
    }
}
```

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/ValueObjects/TenantConfiguration.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects;

use Illuminate\Support\Collection;

class TenantConfiguration
{
    private array $settings;
    private ?string $provisioningError;
    private ?\DateTimeImmutable $provisionedAt;
    private ?string $schemaHash;
    private Collection $customConfigurations;
    
    public function __construct(
        array $settings = [],
        ?string $provisioningError = null,
        ?\DateTimeImmutable $provisionedAt = null,
        ?string $schemaHash = null
    ) {
        $this->settings = $settings;
        $this->provisioningError = $provisioningError;
        $this->provisionedAt = $provisionedAt;
        $this->schemaHash = $schemaHash;
        $this->customConfigurations = new Collection();
    }
    
    public function getSettings(): array
    {
        return $this->settings;
    }
    
    public function getSetting(string $key, $default = null)
    {
        return $this->settings[$key] ?? $default;
    }
    
    public function setSetting(string $key, $value): self
    {
        $clone = clone $this;
        $clone->settings[$key] = $value;
        return $clone;
    }
    
    public function getProvisioningError(): ?string
    {
        return $this->provisioningError;
    }
    
    public function withProvisioningError(string $error): self
    {
        $clone = clone $this;
        $clone->provisioningError = $error;
        return $clone;
    }
    
    public function getProvisionedAt(): ?\DateTimeImmutable
    {
        return $this->provisionedAt;
    }
    
    public function withProvisionedAt(\DateTimeImmutable $date): self
    {
        $clone = clone $this;
        $clone->provisionedAt = $date;
        return $clone;
    }
    
    public function getSchemaHash(): ?string
    {
        return $this->schemaHash;
    }
    
    public function withSchemaHash(string $hash): self
    {
        $clone = clone $this;
        $clone->schemaHash = $hash;
        return $clone;
    }
    
    public function getCustomConfigurations(): Collection
    {
        return $this->customConfigurations;
    }
    
    public function addCustomConfiguration(CustomConfig $config): self
    {
        $clone = clone $this;
        $clone->customConfigurations->add($config);
        return $clone;
    }
    
    public function isProvisioned(): bool
    {
        return $this->provisionedAt !== null;
    }
    
    public function hasDrift(): bool
    {
        // Logic to check if current schema matches expected
        return false;
    }
}
```

### **2.2 Template Management Context**

**File: `app/Domain/Platform/Admin/Contexts/TemplateManagement/Entities/Template.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities;

use App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateVersion;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\ValueObjects\TemplateConfiguration;
use App\Domain\Platform\Shared\ValueObjects\SemanticVersion;
use Illuminate\Support\Collection;

class Template
{
    private string $id;
    private string $name;
    private string $slug;
    private string $description;
    private TemplateVersion $version;
    private TemplateConfiguration $configuration;
    private Collection $modules;
    private Collection $dependencies;
    private bool $isActive;
    private bool $isSystem;
    private ?\DateTimeImmutable $createdAt;
    private ?\DateTimeImmutable $updatedAt;
    
    public function __construct(
        string $id,
        string $name,
        string $slug,
        string $description,
        TemplateVersion $version,
        TemplateConfiguration $configuration
    ) {
        $this->id = $id;
        $this->name = $name;
        $this->slug = $slug;
        $this->description = $description;
        $this->version = $version;
        $this->configuration = $configuration;
        $this->modules = new Collection();
        $this->dependencies = new Collection();
        $this->isActive = true;
        $this->isSystem = false;
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    public function getId(): string
    {
        return $this->id;
    }
    
    public function getName(): string
    {
        return $this->name;
    }
    
    public function getSlug(): string
    {
        return $this->slug;
    }
    
    public function getDescription(): string
    {
        return $this->description;
    }
    
    public function getVersion(): TemplateVersion
    {
        return $this->version;
    }
    
    public function getConfiguration(): TemplateConfiguration
    {
        return $this->configuration;
    }
    
    public function getRequiredModules(): array
    {
        return $this->configuration->getRequiredModules();
    }
    
    public function getOptionalModules(): array
    {
        return $this->configuration->getOptionalModules();
    }
    
    public function getModules(): Collection
    {
        return $this->modules;
    }
    
    public function addModule(Module $module, bool $isRequired = false): void
    {
        if (!$this->modules->contains($module)) {
            $this->modules->add($module);
            
            if ($isRequired) {
                $this->configuration = $this->configuration->addRequiredModule($module->getName());
            } else {
                $this->configuration = $this->configuration->addOptionalModule($module->getName());
            }
            
            $this->updatedAt = new \DateTimeImmutable();
        }
    }
    
    public function isCompatibleWithModule(Module $module): bool
    {
        // Check module dependencies and conflicts
        $moduleDeps = $module->getDependencies();
        $currentModules = $this->modules->map(fn($m) => $m->getName())->toArray();
        
        foreach ($moduleDeps as $dep) {
            if (!in_array($dep, $currentModules)) {
                return false;
            }
        }
        
        // Check conflicts
        $conflicts = $module->getConflicts();
        foreach ($conflicts as $conflict) {
            if (in_array($conflict, $currentModules)) {
                return false;
            }
        }
        
        return true;
    }
    
    public function activate(): void
    {
        $this->isActive = true;
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    public function deactivate(): void
    {
        $this->isActive = false;
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    public function isActive(): bool
    {
        return $this->isActive;
    }
    
    public function isSystem(): bool
    {
        return $this->isSystem;
    }
    
    public function markAsSystem(): void
    {
        $this->isSystem = true;
        $this->updatedAt = new \DateTimeImmutable();
    }
    
    public function canBeDeleted(): bool
    {
        return !$this->isSystem && $this->dependencies->isEmpty();
    }
}
```

### **2.3 Shared Value Objects**

**File: `app/Domain/Platform/Shared/ValueObjects/DomainName.php`**

```php
<?php

namespace App\Domain\Platform\Shared\ValueObjects;

class DomainName
{
    private string $value;
    
    public function __construct(string $domain)
    {
        if (!filter_var($domain, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)) {
            throw new \InvalidArgumentException('Invalid domain name');
        }
        
        $this->value = strtolower($domain);
    }
    
    public function getValue(): string
    {
        return $this->value;
    }
    
    public function getSubdomain(): ?string
    {
        $parts = explode('.', $this->value);
        
        if (count($parts) > 2) {
            return $parts[0];
        }
        
        return null;
    }
    
    public function getBaseDomain(): string
    {
        $parts = explode('.', $this->value);
        
        if (count($parts) > 2) {
            array_shift($parts);
        }
        
        return implode('.', $parts);
    }
    
    public function equals(DomainName $other): bool
    {
        return $this->value === $other->getValue();
    }
    
    public function __toString(): string
    {
        return $this->value;
    }
}
```

## **3. APPLICATION LAYER - FILAMENT ADMIN RESOURCES**

### **3.1 Tenant Management Resource**

**File: `app/Filament/Resources/Platform/TenantResource.php`**

```php
<?php

namespace App\Filament\Resources\Platform;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Services\TenantProvisioningService;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Specifications\TenantCanBeProvisionedSpecification;
use App\Filament\Resources\Platform\TenantResource\Pages;
use App\Filament\Resources\Platform\TenantResource\RelationManagers;
use App\Models\Tenant;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class TenantResource extends Resource
{
    protected static ?string $model = Tenant::class;
    protected static ?string $navigationIcon = 'heroicon-o-building-office';
    protected static ?string $navigationGroup = 'Platform Administration';
    protected static ?int $navigationSort = 1;
    
    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Basic Information')
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->required()
                            ->maxLength(255)
                            ->label('Organization Name'),
                        
                        Forms\Components\TextInput::make('slug')
                            ->required()
                            ->maxLength(50)
                            ->unique(ignoreRecord: true)
                            ->label('URL Slug')
                            ->helperText('Used in URLs and database names'),
                        
                        Forms\Components\TextInput::make('domain')
                            ->required()
                            ->maxLength(255)
                            ->unique(ignoreRecord: true)
                            ->label('Primary Domain')
                            ->helperText('e.g., party-name.platform.com'),
                    ])
                    ->columns(2),
                
                Forms\Components\Section::make('Template & Configuration')
                    ->schema([
                        Forms\Components\Select::make('template_id')
                            ->relationship('template', 'name')
                            ->required()
                            ->label('Template')
                            ->reactive()
                            ->afterStateUpdated(function ($state, callable $set) {
                                // Load template configuration when template changes
                                $set('selected_modules', []);
                            }),
                        
                        Forms\Components\Select::make('modules')
                            ->relationship('modules', 'name')
                            ->multiple()
                            ->preload()
                            ->label('Optional Modules')
                            ->helperText('Select additional features for this tenant')
                            ->searchable()
                            ->options(function (callable $get) {
                                $templateId = $get('template_id');
                                if (!$templateId) {
                                    return [];
                                }
                                
                                // Load template-specific modules
                                return \App\Models\TemplateModule::whereHas('templates', function ($query) use ($templateId) {
                                    $query->where('id', $templateId);
                                })
                                ->orWhere('is_global', true)
                                ->pluck('name', 'id');
                            }),
                        
                        Forms\Components\Toggle::make('is_active')
                            ->label('Active')
                            ->default(true)
                            ->helperText('Inactive tenants cannot be accessed'),
                    ]),
                
                Forms\Components\Section::make('Administrative Settings')
                    ->schema([
                        Forms\Components\TextInput::make('contact_email')
                            ->email()
                            ->maxLength(255)
                            ->label('Contact Email'),
                        
                        Forms\Components\TextInput::make('contact_phone')
                            ->tel()
                            ->maxLength(20)
                            ->label('Contact Phone'),
                        
                        Forms\Components\Textarea::make('notes')
                            ->rows(3)
                            ->label('Administrative Notes')
                            ->helperText('Internal notes about this tenant'),
                    ])
                    ->collapsible(),
                
                Forms\Components\Section::make('Provisioning Configuration')
                    ->schema([
                        Forms\Components\TextInput::make('database')
                            ->required()
                            ->maxLength(64)
                            ->label('Database Name')
                            ->default(fn() => 'tenant_' . uniqid())
                            ->helperText('Automatically generated database name'),
                        
                        Forms\Components\Toggle::make('auto_provision')
                            ->label('Auto-provision on save')
                            ->default(false)
                            ->helperText('Automatically provision database when saving'),
                        
                        Forms\Components\Select::make('provisioning_strategy')
                            ->options([
                                'standard' => 'Standard (Full provisioning)',
                                'minimal' => 'Minimal (Basic schema only)',
                                'custom' => 'Custom (Manual selection)',
                            ])
                            ->default('standard')
                            ->label('Provisioning Strategy'),
                    ])
                    ->collapsible()
                    ->visible(fn($record) => !$record || !$record->is_provisioned),
            ]);
    }
    
    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->label('Organization'),
                
                Tables\Columns\TextColumn::make('slug')
                    ->searchable()
                    ->sortable()
                    ->label('Slug'),
                
                Tables\Columns\TextColumn::make('domain')
                    ->searchable()
                    ->sortable()
                    ->label('Domain'),
                
                Tables\Columns\BadgeColumn::make('provisioning_status')
                    ->colors([
                        'gray' => 'draft',
                        'warning' => 'pending',
                        'primary' => 'provisioning',
                        'success' => 'completed',
                        'danger' => 'failed',
                    ])
                    ->label('Status'),
                
                Tables\Columns\TextColumn::make('template.name')
                    ->label('Template')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('database_created_at')
                    ->dateTime()
                    ->sortable()
                    ->label('Provisioned At')
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('template')
                    ->relationship('template', 'name'),
                
                Tables\Filters\SelectFilter::make('provisioning_status')
                    ->options([
                        'draft' => 'Draft',
                        'pending' => 'Pending',
                        'provisioning' => 'Provisioning',
                        'completed' => 'Completed',
                        'failed' => 'Failed',
                    ]),
                
                Tables\Filters\TernaryFilter::make('is_active'),
                
                Tables\Filters\Filter::make('has_drift')
                    ->label('Has Schema Drift')
                    ->query(fn(Builder $query) => $query->whereNotNull('schema_drift_detected_at')),
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\EditAction::make(),
                    
                    // Provisioning Actions
                    Tables\Actions\Action::make('provision')
                        ->icon('heroicon-o-play')
                        ->color('success')
                        ->action(function (Tenant $record) {
                            $specification = new TenantCanBeProvisionedSpecification();
                            
                            if (!$specification->isSatisfiedBy($record)) {
                                throw new \Exception('Tenant cannot be provisioned in current state');
                            }
                            
                            $service = app(TenantProvisioningService::class);
                            $service->provision($record);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Provisioning Started')
                                ->body('Tenant provisioning has been queued.')
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation()
                        ->modalHeading('Provision Tenant')
                        ->modalSubheading('This will create the tenant database and apply all migrations.')
                        ->modalButton('Start Provisioning')
                        ->visible(fn(Tenant $record) => $record->provisioning_status === 'pending'),
                    
                    Tables\Actions\Action::make('sync')
                        ->icon('heroicon-o-arrow-path')
                        ->color('warning')
                        ->action(function (Tenant $record) {
                            $service = app(TenantProvisioningService::class);
                            $service->sync($record);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Schema Sync Started')
                                ->body('Tenant schema synchronization has been queued.')
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation()
                        ->visible(fn(Tenant $record) => $record->is_provisioned),
                    
                    Tables\Actions\Action::make('detect_drift')
                        ->icon('heroicon-o-magnifying-glass')
                        ->color('info')
                        ->action(function (Tenant $record) {
                            $service = app(TenantProvisioningService::class);
                            $result = $service->detectSchemaDrift($record);
                            
                            if ($result['has_drift']) {
                                \Filament\Notifications\Notification::make()
                                    ->title('Schema Drift Detected')
                                    ->body('Schema drift has been detected. Review the drift details.')
                                    ->warning()
                                    ->send();
                            } else {
                                \Filament\Notifications\Notification::make()
                                    ->title('No Schema Drift')
                                    ->body('Schema matches expected state.')
                                    ->success()
                                    ->send();
                            }
                        })
                        ->visible(fn(Tenant $record) => $record->is_provisioned),
                    
                    Tables\Actions\Action::make('suspend')
                        ->icon('heroicon-o-pause')
                        ->color('warning')
                        ->action(function (Tenant $record) {
                            $record->update(['is_active' => false]);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Tenant Suspended')
                                ->body('Tenant has been suspended and cannot be accessed.')
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation()
                        ->visible(fn(Tenant $record) => $record->is_active),
                    
                    Tables\Actions\Action::make('activate')
                        ->icon('heroicon-o-play')
                        ->color('success')
                        ->action(function (Tenant $record) {
                            $record->update(['is_active' => true]);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Tenant Activated')
                                ->body('Tenant has been activated and can now be accessed.')
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation()
                        ->visible(fn(Tenant $record) => !$record->is_active),
                    
                    Tables\Actions\DeleteAction::make(),
                ]),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    
                    Tables\Actions\BulkAction::make('provision_selected')
                        ->icon('heroicon-o-play')
                        ->color('success')
                        ->action(function (\Illuminate\Database\Eloquent\Collection $records) {
                            $service = app(TenantProvisioningService::class);
                            
                            foreach ($records as $record) {
                                if ($record->canBeProvisioned()) {
                                    $service->provision($record);
                                }
                            }
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Bulk Provisioning Started')
                                ->body("{$records->count()} tenants queued for provisioning.")
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation()
                        ->deselectRecordsAfterCompletion(),
                    
                    Tables\Actions\BulkAction::make('suspend_selected')
                        ->icon('heroicon-o-pause')
                        ->color('warning')
                        ->action(function (\Illuminate\Database\Eloquent\Collection $records) {
                            $records->each->update(['is_active' => false]);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Tenants Suspended')
                                ->body("{$records->count()} tenants have been suspended.")
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation(),
                ]),
            ])
            ->emptyStateActions([
                Tables\Actions\CreateAction::make(),
            ]);
    }
    
    public static function getRelations(): array
    {
        return [
            RelationManagers\ProvisioningHistoryRelationManager::class,
            RelationManagers\SchemaSnapshotsRelationManager::class,
            RelationManagers\CustomMigrationsRelationManager::class,
        ];
    }
    
    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTenants::route('/'),
            'create' => Pages\CreateTenant::route('/create'),
            'view' => Pages\ViewTenant::route('/{record}'),
            'edit' => Pages\EditTenant::route('/{record}/edit'),
        ];
    }
    
    public static function getNavigationBadge(): ?string
    {
        return static::getModel()::where('provisioning_status', '!=', 'completed')->count();
    }
    
    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }
}
```

### **3.2 Template Management Resource**

**File: `app/Filament/Resources/Platform/TemplateResource.php`**

```php
<?php

namespace App\Filament\Resources\Platform;

use App\Domain\Platform\Admin\Contexts\TemplateManagement\Entities\Template;
use App\Domain\Platform\Admin\Contexts\TemplateManagement\Services\TemplateVersioningService;
use App\Filament\Resources\Platform\TemplateResource\Pages;
use App\Filament\Resources\Platform\TemplateResource\RelationManagers;
use App\Models\TenantTemplate;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class TemplateResource extends Resource
{
    protected static ?string $model = TenantTemplate::class;
    protected static ?string $navigationIcon = 'heroicon-o-document-duplicate';
    protected static ?string $navigationGroup = 'Platform Administration';
    protected static ?int $navigationSort = 2;
    
    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Template Information')
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->required()
                            ->maxLength(255)
                            ->label('Template Name')
                            ->unique(ignoreRecord: true),
                        
                        Forms\Components\TextInput::make('slug')
                            ->required()
                            ->maxLength(50)
                            ->unique(ignoreRecord: true)
                            ->label('Template Slug')
                            ->helperText('Used in migration directory names'),
                        
                        Forms\Components\Textarea::make('description')
                            ->rows(3)
                            ->required()
                            ->label('Description')
                            ->helperText('Describe the purpose and features of this template'),
                        
                        Forms\Components\TextInput::make('version')
                            ->required()
                            ->default('1.0.0')
                            ->label('Version')
                            ->helperText('Semantic version (e.g., 1.0.0)'),
                    ])
                    ->columns(2),
                
                Forms\Components\Section::make('Configuration')
                    ->schema([
                        Forms\Components\KeyValue::make('config')
                            ->keyLabel('Key')
                            ->valueLabel('Value')
                            ->label('Configuration')
                            ->helperText('Template-specific configuration in JSON format'),
                        
                        Forms\Components\Select::make('modules')
                            ->relationship('modules', 'name')
                            ->multiple()
                            ->preload()
                            ->label('Available Modules')
                            ->helperText('Modules that can be selected with this template')
                            ->searchable(),
                        
                        Forms\Components\Select::make('required_modules')
                            ->relationship('modules', 'name')
                            ->multiple()
                            ->preload()
                            ->label('Required Modules')
                            ->helperText('Modules that are automatically included')
                            ->searchable()
                            ->createOptionForm([
                                Forms\Components\TextInput::make('name')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('display_name')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\Textarea::make('description')
                                    ->rows(2),
                            ]),
                        
                        Forms\Components\Toggle::make('is_active')
                            ->label('Active')
                            ->default(true)
                            ->helperText('Inactive templates cannot be selected'),
                        
                        Forms\Components\Toggle::make('is_system')
                            ->label('System Template')
                            ->default(false)
                            ->helperText('System templates cannot be deleted'),
                    ]),
                
                Forms\Components\Section::make('Migration Settings')
                    ->schema([
                        Forms\Components\TextInput::make('migration_path')
                            ->label('Migration Directory')
                            ->default(fn($record) => $record ? "templates/{$record->slug}" : 'templates/')
                            ->disabled()
                            ->helperText('Path to template-specific migrations'),
                        
                        Forms\Components\FileUpload::make('migration_files')
                            ->multiple()
                            ->directory(fn($record) => "migrations/templates/{$record->slug}")
                            ->label('Upload Migrations')
                            ->helperText('Upload additional migration files for this template')
                            ->acceptedFileTypes(['application/php'])
                            ->storeFileNamesIn('original_file_names'),
                    ])
                    ->collapsible(),
                
                Forms\Components\Section::make('Nepali Context Settings')
                    ->schema([
                        Forms\Components\Toggle::make('config.nepali_context')
                            ->label('Enable Nepali Context')
                            ->default(true),
                        
                        Forms\Components\Toggle::make('config.election_commission_compliance')
                            ->label('Election Commission Compliance')
                            ->default(true),
                        
                        Forms\Components\Toggle::make('config.multi_language')
                            ->label('Multi-language Support')
                            ->default(true),
                        
                        Forms\Components\Select::make('config.default_language')
                            ->options([
                                'en' => 'English',
                                'np' => 'Nepali',
                            ])
                            ->default('np')
                            ->label('Default Language'),
                        
                        Forms\Components\Toggle::make('config.citizenship_validation')
                            ->label('Citizenship Number Validation')
                            ->default(true),
                    ])
                    ->columns(2)
                    ->collapsible(),
            ]);
    }
    
    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->label('Template Name'),
                
                Tables\Columns\TextColumn::make('slug')
                    ->searchable()
                    ->sortable()
                    ->label('Slug'),
                
                Tables\Columns\TextColumn::make('version')
                    ->sortable()
                    ->label('Version'),
                
                Tables\Columns\BadgeColumn::make('is_active')
                    ->label('Status')
                    ->colors([
                        'success' => true,
                        'danger' => false,
                    ])
                    ->formatStateUsing(fn($state) => $state ? 'Active' : 'Inactive'),
                
                Tables\Columns\TextColumn::make('tenants_count')
                    ->counts('tenants')
                    ->label('Tenants')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active'),
                Tables\Filters\TernaryFilter::make('is_system'),
                Tables\Filters\Filter::make('has_nepali_context')
                    ->query(fn(Builder $query) => $query->where('config->nepali_context', true)),
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\EditAction::make(),
                    
                    Tables\Actions\Action::make('create_version')
                        ->icon('heroicon-o-tag')
                        ->color('info')
                        ->action(function (TenantTemplate $record, TemplateVersioningService $service) {
                            $newVersion = $service->createNewVersion($record);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('New Version Created')
                                ->body("Template version {$newVersion->getVersion()} created successfully.")
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation()
                        ->modalHeading('Create New Version')
                        ->modalSubheading('This will create a copy of the template with a new version number.')
                        ->modalButton('Create Version'),
                    
                    Tables\Actions\Action::make('export')
                        ->icon('heroicon-o-arrow-down-tray')
                        ->action(function (TenantTemplate $record) {
                            return response()->streamDownload(function () use ($record) {
                                echo json_encode([
                                    'template' => $record->toArray(),
                                    'migrations' => $record->getMigrationFiles(),
                                    'config' => $record->config,
                                ], JSON_PRETTY_PRINT);
                            }, "template-{$record->slug}-{$record->version}.json");
                        }),
                    
                    Tables\Actions\Action::make('duplicate')
                        ->icon('heroicon-o-document-duplicate')
                        ->color('warning')
                        ->action(function (TenantTemplate $record) {
                            $duplicate = $record->replicate();
                            $duplicate->name = $record->name . ' (Copy)';
                            $duplicate->slug = $record->slug . '-copy';
                            $duplicate->version = '1.0.0';
                            $duplicate->save();
                            
                            // Duplicate relationships
                            $record->modules->each(fn($module) => $duplicate->modules()->attach($module));
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Template Duplicated')
                                ->body('Template has been duplicated successfully.')
                                ->success()
                                ->send();
                            
                            return redirect()->route('filament.admin.resources.platform.templates.edit', $duplicate);
                        }),
                    
                    Tables\Actions\DeleteAction::make()
                        ->visible(fn(TenantTemplate $record) => !$record->is_system),
                ]),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make()
                        ->visible(fn($records) => $records->where('is_system', false)->count() > 0),
                    
                    Tables\Actions\BulkAction::make('activate')
                        ->icon('heroicon-o-check')
                        ->color('success')
                        ->action(function (\Illuminate\Database\Eloquent\Collection $records) {
                            $records->each->update(['is_active' => true]);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Templates Activated')
                                ->body("{$records->count()} templates have been activated.")
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\BulkAction::make('deactivate')
                        ->icon('heroicon-o-x-mark')
                        ->color('danger')
                        ->action(function (\Illuminate\Database\Eloquent\Collection $records) {
                            $records->each->update(['is_active' => false]);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Templates Deactivated')
                                ->body("{$records->count()} templates have been deactivated.")
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation(),
                ]),
            ]);
    }
    
    public static function getRelations(): array
    {
        return [
            RelationManagers\ModulesRelationManager::class,
            RelationManagers\MigrationsRelationManager::class,
            RelationManagers\TenantsRelationManager::class,
        ];
    }
    
    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTemplates::route('/'),
            'create' => Pages\CreateTemplate::route('/create'),
            'view' => Pages\ViewTemplate::route('/{record}'),
            'edit' => Pages\EditTemplate::route('/{record}/edit'),
        ];
    }
}
```

### **3.3 Module Management Resource**

**File: `app/Filament/Resources/Platform/ModuleResource.php`**

```php
<?php

namespace App\Filament\Resources\Platform;

use App\Domain\Platform\Admin\Contexts\ModuleManagement\Entities\Module;
use App\Domain\Platform\Admin\Contexts\ModuleManagement\Services\ModuleDependencyResolver;
use App\Filament\Resources\Platform\ModuleResource\Pages;
use App\Filament\Resources\Platform\ModuleResource\RelationManagers;
use App\Models\TemplateModule;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class ModuleResource extends Resource
{
    protected static ?string $model = TemplateModule::class;
    protected static ?string $navigationIcon = 'heroicon-o-puzzle-piece';
    protected static ?string $navigationGroup = 'Platform Administration';
    protected static ?int $navigationSort = 3;
    
    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Module Information')
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->required()
                            ->maxLength(50)
                            ->unique(ignoreRecord: true)
                            ->label('Module Name')
                            ->helperText('Technical name (e.g., election_campaign)'),
                        
                        Forms\Components\TextInput::make('display_name')
                            ->required()
                            ->maxLength(255)
                            ->label('Display Name')
                            ->helperText('User-friendly name'),
                        
                        Forms\Components\Textarea::make('description')
                            ->rows(3)
                            ->required()
                            ->label('Description')
                            ->helperText('Describe what this module does'),
                        
                        Forms\Components\TextInput::make('version')
                            ->required()
                            ->default('1.0.0')
                            ->label('Version'),
                    ])
                    ->columns(2),
                
                Forms\Components\Section::make('Dependencies & Configuration')
                    ->schema([
                        Forms\Components\Select::make('dependencies')
                            ->relationship('dependencies', 'display_name')
                            ->multiple()
                            ->preload()
                            ->label('Dependencies')
                            ->helperText('Modules required by this module')
                            ->searchable(),
                        
                        Forms\Components\Select::make('conflicts')
                            ->relationship('conflicts', 'display_name')
                            ->multiple()
                            ->preload()
                            ->label('Conflicts')
                            ->helperText('Modules that cannot be used with this module')
                            ->searchable(),
                        
                        Forms\Components\KeyValue::make('config')
                            ->keyLabel('Key')
                            ->valueLabel('Value')
                            ->label('Module Configuration'),
                        
                        Forms\Components\TextInput::make('migration_path')
                            ->label('Migration Directory')
                            ->default(fn($record) => $record ? "modules/{$record->name}" : 'modules/')
                            ->disabled()
                            ->helperText('Path to module-specific migrations'),
                    ])
                    ->columns(2),
                
                Forms\Components\Section::make('Module Settings')
                    ->schema([
                        Forms\Components\Toggle::make('is_active')
                            ->label('Active')
                            ->default(true)
                            ->helperText('Inactive modules cannot be selected'),
                        
                        Forms\Components\Toggle::make('is_global')
                            ->label('Global Module')
                            ->default(false)
                            ->helperText('Available to all templates'),
                        
                        Forms\Components\Toggle::make('is_core')
                            ->label('Core Module')
                            ->default(false)
                            ->helperText('Core modules cannot be disabled'),
                        
                        Forms\Components\TextInput::make('category')
                            ->label('Category')
                            ->helperText('e.g., Finance, Communication, Management'),
                        
                        Forms\Components\TextInput::make('icon')
                            ->label('Icon')
                            ->helperText('Heroicon name (e.g., banknotes, megaphone)'),
                        
                        Forms\Components\TextInput::make('order')
                            ->numeric()
                            ->default(0)
                            ->label('Display Order'),
                    ])
                    ->columns(3),
                
                Forms\Components\Section::make('Nepali Context Features')
                    ->schema([
                        Forms\Components\Toggle::make('supports_nepali_context')
                            ->label('Supports Nepali Context')
                            ->default(false)
                            ->helperText('Module supports Nepali language and localization'),
                        
                        Forms\Components\Toggle::make('requires_citizenship_validation')
                            ->label('Requires Citizenship Validation')
                            ->default(false)
                            ->helperText('Module requires Nepali citizenship validation'),
                        
                        Forms\Components\Toggle::make('ec_compliance')
                            ->label('Election Commission Compliance')
                            ->default(false)
                            ->helperText('Module includes EC compliance features'),
                        
                        Forms\Components\Textarea::make('nepali_requirements')
                            ->rows(2)
                            ->label('Nepali Requirements')
                            ->helperText('Specific requirements for Nepali context'),
                    ])
                    ->collapsible(),
            ]);
    }
    
    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('display_name')
                    ->searchable()
                    ->sortable()
                    ->label('Module Name'),
                
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->label('Technical Name'),
                
                Tables\Columns\TextColumn::make('category')
                    ->sortable()
                    ->label('Category'),
                
                Tables\Columns\BadgeColumn::make('version')
                    ->label('Version')
                    ->color('primary'),
                
                Tables\Columns\IconColumn::make('is_active')
                    ->boolean()
                    ->label('Active')
                    ->sortable(),
                
                Tables\Columns\IconColumn::make('is_global')
                    ->boolean()
                    ->label('Global')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('templates_count')
                    ->counts('templates')
                    ->label('Templates')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active'),
                Tables\Filters\TernaryFilter::make('is_global'),
                Tables\Filters\TernaryFilter::make('is_core'),
                Tables\Filters\SelectFilter::make('category')
                    ->options(fn() => TemplateModule::distinct()->pluck('category', 'category')),
                Tables\Filters\Filter::make('supports_nepali_context')
                    ->query(fn(Builder $query) => $query->where('supports_nepali_context', true)),
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\EditAction::make(),
                    
                    Tables\Actions\Action::make('check_dependencies')
                        ->icon('heroicon-o-link')
                        ->color('info')
                        ->action(function (TemplateModule $record, ModuleDependencyResolver $resolver) {
                            $issues = $resolver->validateDependencies($record);
                            
                            if (empty($issues)) {
                                \Filament\Notifications\Notification::make()
                                    ->title('No Dependency Issues')
                                    ->body('All dependencies are properly configured.')
                                    ->success()
                                    ->send();
                            } else {
                                \Filament\Notifications\Notification::make()
                                    ->title('Dependency Issues Found')
                                    ->body(implode("\n", $issues))
                                    ->warning()
                                    ->send();
                            }
                        }),
                    
                    Tables\Actions\Action::make('export')
                        ->icon('heroicon-o-arrow-down-tray')
                        ->action(function (TemplateModule $record) {
                            return response()->streamDownload(function () use ($record) {
                                echo json_encode([
                                    'module' => $record->toArray(),
                                    'migrations' => $record->getMigrationFiles(),
                                    'dependencies' => $record->dependencies->pluck('name'),
                                ], JSON_PRETTY_PRINT);
                            }, "module-{$record->name}-{$record->version}.json");
                        }),
                    
                    Tables\Actions\DeleteAction::make()
                        ->visible(fn(TemplateModule $record) => !$record->is_core),
                ]),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make()
                        ->visible(fn($records) => $records->where('is_core', false)->count() > 0),
                    
                    Tables\Actions\BulkAction::make('activate')
                        ->icon('heroicon-o-check')
                        ->color('success')
                        ->action(function (\Illuminate\Database\Eloquent\Collection $records) {
                            $records->each->update(['is_active' => true]);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Modules Activated')
                                ->body("{$records->count()} modules have been activated.")
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\BulkAction::make('deactivate')
                        ->icon('heroicon-o-x-mark')
                        ->color('danger')
                        ->action(function (\Illuminate\Database\Eloquent\Collection $records) {
                            $records->each->update(['is_active' => false]);
                            
                            \Filament\Notifications\Notification::make()
                                ->title('Modules Deactivated')
                                ->body("{$records->count()} modules have been deactivated.")
                                ->success()
                                ->send();
                        })
                        ->requiresConfirmation(),
                ]),
            ]);
    }
    
    public static function getRelations(): array
    {
        return [
            RelationManagers\DependenciesRelationManager::class,
            RelationManagers\TemplatesRelationManager::class,
            RelationManagers\MigrationsRelationManager::class,
        ];
    }
    
    public static function getPages(): array
    {
        return [
            'index' => Pages\ListModules::route('/'),
            'create' => Pages\CreateModule::route('/create'),
            'view' => Pages\ViewModule::route('/{record}'),
            'edit' => Pages\EditModule::route('/{record}/edit'),
        ];
    }
}
```

## **4. CUSTOM FILAMENT COMPONENTS WITH DDD**

### **4.1 Tenant Provisioning Wizard Component**

**File: `app/Filament/Components/TenantProvisioningWizard.php`**

```php
<?php

namespace App\Filament\Components;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Services\TenantProvisioningService;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Specifications\TenantCanBeProvisionedSpecification;
use Closure;
use Filament\Forms\Components\Wizard;
use Filament\Forms\Components\Wizard\Step;
use Filament\Notifications\Notification;

class TenantProvisioningWizard extends Wizard
{
    protected TenantProvisioningService $provisioningService;
    protected TenantCanBeProvisionedSpecification $provisioningSpecification;
    
    public function __construct(
        TenantProvisioningService $provisioningService,
        TenantCanBeProvisionedSpecification $provisioningSpecification
    ) {
        $this->provisioningService = $provisioningService;
        $this->provisioningSpecification = $provisioningSpecification;
    }
    
    public static function make(string $name): static
    {
        $instance = app(static::class);
        $instance->name($name);
        
        return $instance->steps([
            $instance->makeTemplateSelectionStep(),
            $instance->makeModuleSelectionStep(),
            $instance->makeConfigurationStep(),
            $instance->makeReviewStep(),
        ]);
    }
    
    protected function makeTemplateSelectionStep(): Step
    {
        return Step::make('template')
            ->label('Template Selection')
            ->icon('heroicon-o-document-duplicate')
            ->schema([
                \Filament\Forms\Components\Select::make('template_id')
                    ->label('Select Template')
                    ->options(
                        \App\Models\TenantTemplate::active()
                            ->get()
                            ->mapWithKeys(fn($template) => [
                                $template->id => "{$template->name} (v{$template->version})"
                            ])
                    )
                    ->required()
                    ->reactive()
                    ->searchable()
                    ->afterStateUpdated(function ($state, callable $set, callable $get) {
                        $template = \App\Models\TenantTemplate::find($state);
                        
                        if ($template) {
                            $set('template_name', $template->name);
                            $set('template_description', $template->description);
                            $set('required_modules', $template->required_modules ?? []);
                            
                            // Pre-select required modules
                            $currentModules = $get('modules') ?? [];
                            $requiredModules = $template->required_modules ?? [];
                            $set('modules', array_unique(array_merge($currentModules, $requiredModules)));
                        }
                    }),
                
                \Filament\Forms\Components\Placeholder::make('template_info')
                    ->label('Template Information')
                    ->content(function (callable $get) {
                        $templateId = $get('template_id');
                        
                        if (!$templateId) {
                            return 'Select a template to see details';
                        }
                        
                        $template = \App\Models\TenantTemplate::find($templateId);
                        
                        return view('filament.components.template-info', [
                            'template' => $template,
                        ])->render();
                    })
                    ->visible(fn(callable $get) => !empty($get('template_id'))),
            ]);
    }
    
    protected function makeModuleSelectionStep(): Step
    {
        return Step::make('modules')
            ->label('Module Selection')
            ->icon('heroicon-o-puzzle-piece')
            ->schema([
                \Filament\Forms\Components\Placeholder::make('module_info')
                    ->label('Selected Template Modules')
                    ->content(function (callable $get) {
                        $templateId = $get('template_id');
                        
                        if (!$templateId) {
                            return 'Select a template first';
                        }
                        
                        $template = \App\Models\TenantTemplate::with('modules')->find($templateId);
                        
                        return view('filament.components.template-modules-info', [
                            'template' => $template,
                        ])->render();
                    }),
                
                \Filament\Forms\Components\CheckboxList::make('modules')
                    ->label('Select Additional Modules')
                    ->options(function (callable $get) {
                        $templateId = $get('template_id');
                        
                        if (!$templateId) {
                            return [];
                        }
                        
                        $template = \App\Models\TenantTemplate::with('modules')->find($templateId);
                        $templateModuleIds = $template->modules->pluck('id')->toArray();
                        
                        return \App\Models\TemplateModule::whereNotIn('id', $templateModuleIds)
                            ->where('is_active', true)
                            ->get()
                            ->mapWithKeys(fn($module) => [
                                $module->id => "{$module->display_name} - {$module->description}"
                            ]);
                    })
                    ->columns(2)
                    ->gridDirection('row')
                    ->visible(fn(callable $get) => !empty($get('template_id'))),
                
                \Filament\Forms\Components\Placeholder::make('module_dependencies')
                    ->label('Module Dependencies')
                    ->content(function (callable $get) {
                        $selectedModules = $get('modules') ?? [];
                        
                        if (empty($selectedModules)) {
                            return 'No modules selected';
                        }
                        
                        $modules = \App\Models\TemplateModule::with('dependencies')->find($selectedModules);
                        $dependencyGraph = $this->buildDependencyGraph($modules);
                        
                        return view('filament.components.module-dependencies', [
                            'dependencyGraph' => $dependencyGraph,
                        ])->render();
                    })
                    ->visible(fn(callable $get) => !empty($get('modules'))),
            ]);
    }
    
    protected function makeConfigurationStep(): Step
    {
        return Step::make('configuration')
            ->label('Configuration')
            ->icon('heroicon-o-cog')
            ->schema([
                \Filament\Forms\Components\Section::make('Tenant Configuration')
                    ->schema([
                        \Filament\Forms\Components\TextInput::make('name')
                            ->required()
                            ->label('Organization Name')
                            ->maxLength(255),
                        
                        \Filament\Forms\Components\TextInput::make('slug')
                            ->required()
                            ->label('URL Slug')
                            ->unique('tenants', 'slug')
                            ->maxLength(50)
                            ->helperText('Used in URLs and database names'),
                        
                        \Filament\Forms\Components\TextInput::make('domain')
                            ->required()
                            ->label('Domain')
                            ->unique('tenants', 'domain')
                            ->helperText('e.g., party-name.platform.com'),
                        
                        \Filament\Forms\Components\TextInput::make('database')
                            ->required()
                            ->label('Database Name')
                            ->default(fn() => 'tenant_' . uniqid())
                            ->helperText('Automatically generated'),
                    ])
                    ->columns(2),
                
                \Filament\Forms\Components\Section::make('Nepali Context Settings')
                    ->schema([
                        \Filament\Forms\Components\Toggle::make('enable_nepali_context')
                            ->label('Enable Nepali Context')
                            ->default(true),
                        
                        \Filament\Forms\Components\Select::make('default_language')
                            ->options([
                                'en' => 'English',
                                'np' => 'Nepali',
                            ])
                            ->default('np')
                            ->label('Default Language'),
                        
                        \Filament\Forms\Components\Toggle::make('enable_ec_compliance')
                            ->label('Election Commission Compliance')
                            ->default(true),
                        
                        \Filament\Forms\Components\Toggle::make('enable_citizenship_validation')
                            ->label('Citizenship Validation')
                            ->default(true),
                    ])
                    ->columns(2)
                    ->collapsible(),
                
                \Filament\Forms\Components\Section::make('Provisioning Options')
                    ->schema([
                        \Filament\Forms\Components\Select::make('provisioning_strategy')
                            ->options([
                                'standard' => 'Standard (Recommended)',
                                'minimal' => 'Minimal Schema',
                                'custom' => 'Custom Configuration',
                            ])
                            ->default('standard')
                            ->label('Provisioning Strategy'),
                        
                        \Filament\Forms\Components\Toggle::make('enable_backups')
                            ->label('Enable Automatic Backups')
                            ->default(true),
                        
                        \Filament\Forms\Components\Toggle::make('enable_monitoring')
                            ->label('Enable Health Monitoring')
                            ->default(true),
                        
                        \Filament\Forms\Components\Toggle::make('queue_provisioning')
                            ->label('Queue Provisioning')
                            ->default(true)
                            ->helperText('Run provisioning in background'),
                    ])
                    ->columns(2)
                    ->collapsible(),
            ]);
    }
    
    protected function makeReviewStep(): Step
    {
        return Step::make('review')
            ->label('Review & Confirm')
            ->icon('heroicon-o-clipboard-document-check')
            ->schema([
                \Filament\Forms\Components\Placeholder::make('summary')
                    ->label('Provisioning Summary')
                    ->content(function (callable $get) {
                        $data = $get();
                        
                        return view('filament.components.provisioning-summary', [
                            'data' => $data,
                            'template' => \App\Models\TenantTemplate::with('modules')->find($data['template_id'] ?? null),
                            'modules' => \App\Models\TemplateModule::find($data['modules'] ?? []),
                        ])->render();
                    }),
                
                \Filament\Forms\Components\Checkbox::make('confirm_provisioning')
                    ->label('I confirm that I want to provision this tenant with the selected configuration.')
                    ->required()
                    ->accepted(),
                
                \Filament\Forms\Components\Checkbox::make('accept_terms')
                    ->label('I accept the terms and conditions for tenant provisioning.')
                    ->required()
                    ->accepted(),
            ]);
    }
    
    protected function buildDependencyGraph($modules): array
    {
        $graph = [];
        
        foreach ($modules as $module) {
            $graph[$module->name] = [
                'module' => $module,
                'dependencies' => $module->dependencies->pluck('name')->toArray(),
                'conflicts' => $module->conflicts->pluck('name')->toArray(),
            ];
        }
        
        return $graph;
    }
    
    public function provision(array $data): array
    {
        // Validate using specification
        $tenant = new \App\Models\Tenant($data);
        
        if (!$this->provisioningSpecification->isSatisfiedBy($tenant)) {
            throw new \DomainException('Tenant cannot be provisioned with current configuration');
        }
        
        // Create tenant
        $tenant = \App\Models\Tenant::create($data);
        
        // Attach modules
        if (!empty($data['modules'])) {
            $tenant->modules()->attach($data['modules']);
        }
        
        // Start provisioning
        $result = $this->provisioningService->provision($tenant, [
            'strategy' => $data['provisioning_strategy'] ?? 'standard',
            'queue' => $data['queue_provisioning'] ?? true,
        ]);
        
        return [
            'success' => true,
            'tenant' => $tenant,
            'provisioning_result' => $result,
        ];
    }
}
```

### **4.2 Schema Drift Detection Component**

**File: `app/Filament/Components/SchemaDriftDetector.php`**

```php
<?php

namespace App\Filament\Components;

use App\Domain\Platform\Admin\Contexts\SchemaManagement\Services\SchemaComparisonService;
use App\Domain\Platform\Admin\Contexts\SchemaManagement\ValueObjects\SchemaDiff;
use App\Models\Tenant;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Actions\Action;
use Filament\Support\Colors\Color;

class SchemaDriftDetector extends Component
{
    protected string $view = 'filament.components.schema-drift-detector';
    
    protected SchemaComparisonService $comparisonService;
    protected ?Tenant $tenant = null;
    protected ?SchemaDiff $diff = null;
    
    public function __construct(SchemaComparisonService $comparisonService)
    {
        $this->comparisonService = $comparisonService;
    }
    
    public static function make(string $name): static
    {
        return app(static::class)->name($name);
    }
    
    public function tenant(Tenant $tenant): static
    {
        $this->tenant = $tenant;
        return $this;
    }
    
    public function detect(): void
    {
        if (!$this->tenant) {
            throw new \RuntimeException('Tenant must be set before detection');
        }
        
        $this->diff = $this->comparisonService->compareWithExpected($this->tenant);
    }
    
    public function hasDrift(): bool
    {
        return $this->diff?->hasChanges() ?? false;
    }
    
    public function getDiff(): ?SchemaDiff
    {
        return $this->diff;
    }
    
    public function getActions(): array
    {
        return [
            Action::make('detect_drift')
                ->label('Detect Schema Drift')
                ->icon('heroicon-o-magnifying-glass')
                ->color('primary')
                ->action(function () {
                    $this->detect();
                    
                    if ($this->hasDrift()) {
                        \Filament\Notifications\Notification::make()
                            ->title('Schema Drift Detected')
                            ->body('Schema differences found between expected and actual.')
                            ->warning()
                            ->send();
                    } else {
                        \Filament\Notifications\Notification::make()
                            ->title('No Schema Drift')
                            ->body('Schema matches expected state.')
                            ->success()
                            ->send();
                    }
                }),
            
            Action::make('view_diff')
                ->label('View Differences')
                ->icon('heroicon-o-eye')
                ->color('info')
                ->modalHeading('Schema Differences')
                ->modalContent(fn() => view('filament.components.schema-diff-viewer', [
                    'diff' => $this->diff,
                ]))
                ->modalSubmitAction(false)
                ->modalCancelActionLabel('Close')
                ->visible(fn() => $this->hasDrift()),
            
            Action::make('repair_drift')
                ->label('Repair Drift')
                ->icon('heroicon-o-wrench')
                ->color('danger')
                ->requiresConfirmation()
                ->modalHeading('Repair Schema Drift')
                ->modalSubheading('This will modify the tenant schema to match expected state.')
                ->modalButton('Repair Schema')
                ->action(function () {
                    if (!$this->tenant || !$this->diff) {
                        return;
                    }
                    
                    $repairService = app(\App\Domain\Platform\Admin\Contexts\SchemaManagement\Services\SchemaRepairService::class);
                    $result = $repairService->repair($this->tenant, $this->diff);
                    
                    \Filament\Notifications\Notification::make()
                        ->title('Schema Repair Completed')
                        ->body($result->getMessage())
                        ->success()
                        ->send();
                })
                ->visible(fn() => $this->hasDrift()),
        ];
    }
    
    public function getSchemaHealthStatus(): array
    {
        if (!$this->tenant) {
            return [
                'status' => 'unknown',
                'color' => Color::Gray,
                'message' => 'No tenant selected',
            ];
        }
        
        if (!$this->diff) {
            return [
                'status' => 'not_checked',
                'color' => Color::Blue,
                'message' => 'Schema drift not checked yet',
            ];
        }
        
        if (!$this->hasDrift()) {
            return [
                'status' => 'healthy',
                'color' => Color::Green,
                'message' => 'Schema matches expected state',
            ];
        }
        
        $severity = $this->diff->getSeverity();
        
        return match($severity) {
            'low' => [
                'status' => 'minor_drift',
                'color' => Color::Yellow,
                'message' => 'Minor schema differences detected',
            ],
            'medium' => [
                'status' => 'moderate_drift',
                'color' => Color::Orange,
                'message' => 'Moderate schema differences detected',
            ],
            'high' => [
                'status' => 'severe_drift',
                'color' => Color::Red,
                'message' => 'Severe schema differences detected',
            ],
            default => [
                'status' => 'unknown',
                'color' => Color::Gray,
                'message' => 'Unknown schema state',
            ],
        };
    }
}
```

## **5. CUSTOM FILAMENT PAGES**

### **5.1 Tenant Dashboard Page**

**File: `app/Filament/Pages/Platform/TenantDashboard.php`**

```php
<?php

namespace App\Filament\Pages\Platform;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Services\TenantMetricsService;
use App\Filament\Components\SchemaDriftDetector;
use App\Models\Tenant;
use Filament\Pages\Page;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class TenantDashboard extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-chart-bar';
    protected static ?string $navigationGroup = 'Platform Administration';
    protected static ?string $title = 'Tenant Dashboard';
    protected static string $view = 'filament.pages.platform.tenant-dashboard';
    
    protected TenantMetricsService $metricsService;
    
    public function __construct()
    {
        $this->metricsService = app(TenantMetricsService::class);
    }
    
    protected function getHeaderWidgets(): array
    {
        return [
            StatsOverviewWidget::make([
                Stat::make('Total Tenants', Tenant::count())
                    ->description('All registered tenants')
                    ->descriptionIcon('heroicon-o-building-office')
                    ->color('primary'),
                
                Stat::make('Active Tenants', Tenant::where('is_active', true)->count())
                    ->description('Currently active tenants')
                    ->descriptionIcon('heroicon-o-check-circle')
                    ->color('success'),
                
                Stat::make('Provisioning', Tenant::where('provisioning_status', 'provisioning')->count())
                    ->description('Tenants being provisioned')
                    ->descriptionIcon('heroicon-o-play')
                    ->color('warning'),
                
                Stat::make('With Drift', Tenant::whereNotNull('schema_drift_detected_at')->count())
                    ->description('Tenants with schema drift')
                    ->descriptionIcon('heroicon-o-exclamation-triangle')
                    ->color('danger'),
            ]),
        ];
    }
    
    protected function getFooterWidgets(): array
    {
        return [
            \App\Filament\Widgets\TenantProvisioningChart::class,
            \App\Filament\Widgets\TemplateUsageWidget::class,
            \App\Filament\Widgets\SchemaHealthWidget::class,
        ];
    }
    
    public function getMetrics(): array
    {
        return $this->metricsService->getPlatformMetrics();
    }
    
    public function getRecentActivity(): array
    {
        return [
            'recent_provisioning' => $this->metricsService->getRecentProvisioningActivity(10),
            'recent_drift_detection' => $this->metricsService->getRecentDriftDetection(10),
            'system_alerts' => $this->metricsService->getSystemAlerts(),
        ];
    }
}
```

### **5.2 Tenant Provisioning Queue Page**

**File: `app/Filament/Pages/Platform/ProvisioningQueue.php`**

```php
<?php

namespace App\Filament\Pages\Platform;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Services\ProvisioningQueueService;
use App\Domain\Platform\Admin\Contexts\TenantManagement\ValueObjects\ProvisioningJobStatus;
use Filament\Pages\Page;
use Filament\Tables;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Illuminate\Database\Eloquent\Builder;

class ProvisioningQueue extends Page implements HasTable
{
    use InteractsWithTable;
    
    protected static ?string $navigationIcon = 'heroicon-o-queue-list';
    protected static ?string $navigationGroup = 'Platform Administration';
    protected static ?string $title = 'Provisioning Queue';
    protected static string $view = 'filament.pages.platform.provisioning-queue';
    
    protected ProvisioningQueueService $queueService;
    
    public function __construct()
    {
        $this->queueService = app(ProvisioningQueueService::class);
    }
    
    protected function getTableQuery(): Builder
    {
        return $this->queueService->getJobsQuery();
    }
    
    protected function getTableColumns(): array
    {
        return [
            Tables\Columns\TextColumn::make('tenant.name')
                ->label('Tenant')
                ->searchable()
                ->sortable(),
            
            Tables\Columns\TextColumn::make('job_type')
                ->label('Job Type')
                ->badge()
                ->color(fn($state) => match($state) {
                    'provision' => 'primary',
                    'sync' => 'warning',
                    'repair' => 'danger',
                    default => 'gray',
                }),
            
            Tables\Columns\BadgeColumn::make('status')
                ->label('Status')
                ->colors([
                    'gray' => ProvisioningJobStatus::PENDING->value,
                    'primary' => ProvisioningJobStatus::PROCESSING->value,
                    'success' => ProvisioningJobStatus::COMPLETED->value,
                    'warning' => ProvisioningJobStatus::FAILED->value,
                    'danger' => ProvisioningJobStatus::CANCELLED->value,
                ]),
            
            Tables\Columns\TextColumn::make('progress')
                ->label('Progress')
                ->formatStateUsing(fn($state) => $state ? "{$state}%" : '0%')
                ->color(fn($state) => match(true) {
                    $state >= 100 => 'success',
                    $state >= 50 => 'warning',
                    default => 'danger',
                }),
            
            Tables\Columns\TextColumn::make('created_at')
                ->label('Queued At')
                ->dateTime()
                ->sortable(),
            
            Tables\Columns\TextColumn::make('started_at')
                ->label('Started At')
                ->dateTime()
                ->sortable()
                ->toggleable(isToggledHiddenByDefault: true),
            
            Tables\Columns\TextColumn::make('completed_at')
                ->label('Completed At')
                ->dateTime()
                ->sortable()
                ->toggleable(isToggledHiddenByDefault: true),
            
            Tables\Columns\TextColumn::make('error_message')
                ->label('Error')
                ->limit(50)
                ->toggleable(isToggledHiddenByDefault: true),
        ];
    }
    
    protected function getTableActions(): array
    {
        return [
            Tables\Actions\Action::make('view_logs')
                ->icon('heroicon-o-document-text')
                ->modalHeading('Job Logs')
                ->modalContent(fn($record) => view('filament.components.job-logs', [
                    'logs' => $record->logs,
                ])),
            
            Tables\Actions\Action::make('retry')
                ->icon('heroicon-o-arrow-path')
                ->color('warning')
                ->action(fn($record) => $this->queueService->retryJob($record))
                ->visible(fn($record) => $record->status === ProvisioningJobStatus::FAILED->value),
            
            Tables\Actions\Action::make('cancel')
                ->icon('heroicon-o-x-mark')
                ->color('danger')
                ->requiresConfirmation()
                ->action(fn($record) => $this->queueService->cancelJob($record))
                ->visible(fn($record) => in_array($record->status, [
                    ProvisioningJobStatus::PENDING->value,
                    ProvisioningJobStatus::PROCESSING->value,
                ])),
        ];
    }
    
    protected function getTableBulkActions(): array
    {
        return [
            Tables\Actions\BulkAction::make('retry_failed')
                ->icon('heroicon-o-arrow-path')
                ->color('warning')
                ->action(fn($records) => $records->each(fn($record) => 
                    $this->queueService->retryJob($record)
                ))
                ->deselectRecordsAfterCompletion(),
            
            Tables\Actions\BulkAction::make('cancel_selected')
                ->icon('heroicon-o-x-mark')
                ->color('danger')
                ->requiresConfirmation()
                ->action(fn($records) => $records->each(fn($record) => 
                    $this->queueService->cancelJob($record)
                ))
                ->deselectRecordsAfterCompletion(),
        ];
    }
    
    protected function getTableFilters(): array
    {
        return [
            Tables\Filters\SelectFilter::make('status')
                ->options(collect(ProvisioningJobStatus::cases())->mapWithKeys(
                    fn($status) => [$status->value => $status->name]
                )),
            
            Tables\Filters\SelectFilter::make('job_type')
                ->options([
                    'provision' => 'Provisioning',
                    'sync' => 'Schema Sync',
                    'repair' => 'Schema Repair',
                ]),
            
            Tables\Filters\Filter::make('failed_jobs')
                ->label('Failed Jobs')
                ->query(fn(Builder $query) => $query->where('status', ProvisioningJobStatus::FAILED->value)),
            
            Tables\Filters\Filter::make('recent_jobs')
                ->label('Last 24 Hours')
                ->query(fn(Builder $query) => $query->where('created_at', '>=', now()->subDay())),
        ];
    }
    
    public function getQueueStats(): array
    {
        return $this->queueService->getQueueStatistics();
    }
}
```

## **6. DOMAIN SERVICES**

### **6.1 Tenant Provisioning Service**

**File: `app/Domain/Platform/Admin/Contexts/TenantManagement/Services/TenantProvisioningService.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\TenantManagement\Services;

use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningStarted;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningCompleted;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Events\TenantProvisioningFailed;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Repositories\TenantRepositoryInterface;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Specifications\TenantCanBeProvisionedSpecification;
use App\Domain\Platform\Shared\Events\DomainEventDispatcher;

class TenantProvisioningService
{
    private TenantRepositoryInterface $tenantRepository;
    private TenantCanBeProvisionedSpecification $provisioningSpecification;
    private DomainEventDispatcher $eventDispatcher;
    
    public function __construct(
        TenantRepositoryInterface $tenantRepository,
        TenantCanBeProvisionedSpecification $provisioningSpecification,
        DomainEventDispatcher $eventDispatcher
    ) {
        $this->tenantRepository = $tenantRepository;
        $this->provisioningSpecification = $provisioningSpecification;
        $this->eventDispatcher = $eventDispatcher;
    }
    
    public function provision(TenantAggregate $tenant, array $options = []): array
    {
        // Validate tenant can be provisioned
        if (!$this->provisioningSpecification->isSatisfiedBy($tenant)) {
            throw new \DomainException('Tenant cannot be provisioned in current state');
        }
        
        try {
            // Dispatch provisioning started event
            $this->eventDispatcher->dispatch(new TenantProvisioningStarted($tenant));
            
            // Update tenant status
            $tenant->startProvisioning();
            $this->tenantRepository->save($tenant);
            
            // Execute provisioning logic (would call infrastructure layer)
            $result = $this->executeProvisioning($tenant, $options);
            
            // Update tenant status
            $tenant->completeProvisioning();
            $tenant->getConfiguration()->withSchemaHash($result['schema_hash']);
            $this->tenantRepository->save($tenant);
            
            // Dispatch completion event
            $this->eventDispatcher->dispatch(new TenantProvisioningCompleted($tenant, $result));
            
            return $result;
            
        } catch (\Exception $e) {
            // Handle failure
            $tenant->failProvisioning($e->getMessage());
            $this->tenantRepository->save($tenant);
            
            // Dispatch failure event
            $this->eventDispatcher->dispatch(new TenantProvisioningFailed($tenant, $e));
            
            throw $e;
        }
    }
    
    private function executeProvisioning(TenantAggregate $tenant, array $options): array
    {
        // This would delegate to the infrastructure layer (TenantProvisioner service)
        // For DDD purity, we would inject an interface here
        $provisioner = app(\App\Contracts\TenantProvisionerInterface::class);
        
        return $provisioner->provision(
            $this->convertToEloquentModel($tenant),
            $options
        );
    }
    
    private function convertToEloquentModel(TenantAggregate $tenantAggregate): \App\Models\Tenant
    {
        // Convert domain entity to Eloquent model for infrastructure layer
        // In a pure DDD implementation, you'd have a proper mapper
        return \App\Models\Tenant::find($tenantAggregate->getId());
    }
}
```

### **6.2 Schema Comparison Service**

**File: `app/Domain/Platform/Admin/Contexts/SchemaManagement/Services/SchemaComparisonService.php`**

```php
<?php

namespace App\Domain\Platform\Admin\Contexts\SchemaManagement\Services;

use App\Domain\Platform\Admin\Contexts\SchemaManagement\Entities\SchemaSnapshot;
use App\Domain\Platform\Admin\Contexts\SchemaManagement\Repositories\SchemaSnapshotRepositoryInterface;
use App\Domain\Platform\Admin\Contexts\SchemaManagement\ValueObjects\SchemaDiff;
use App\Domain\Platform\Admin\Contexts\TenantManagement\Entities\TenantAggregate;

class SchemaComparisonService
{
    private SchemaSnapshotRepositoryInterface $snapshotRepository;
    
    public function __construct(SchemaSnapshotRepositoryInterface $snapshotRepository)
    {
        $this->snapshotRepository = $snapshotRepository;
    }
    
    public function compareWithExpected(TenantAggregate $tenant): SchemaDiff
    {
        // Get expected schema from template
        $expectedSchema = $this->getExpectedSchema($tenant);
        
        // Get actual schema from tenant database
        $actualSchema = $this->captureActualSchema($tenant);
        
        // Compare schemas
        return $this->compareSchemas($expectedSchema, $actualSchema);
    }
    
    public function compareSnapshots(SchemaSnapshot $snapshot1, SchemaSnapshot $snapshot2): SchemaDiff
    {
        return new SchemaDiff(
            $this->compareStructures($snapshot1->getStructure(), $snapshot2->getStructure())
        );
    }
    
    private function getExpectedSchema(TenantAggregate $tenant): array
    {
        // Get the latest approved schema snapshot for this template
        $template = $tenant->getTemplate();
        
        if (!$template) {
            throw new \DomainException('Tenant has no template assigned');
        }
        
        $snapshot = $this->snapshotRepository->findLatestByTemplate($template);
        
        if (!$snapshot) {
            throw new \DomainException('No expected schema found for template');
        }
        
        return $snapshot->getStructure();
    }
    
    private function captureActualSchema(TenantAggregate $tenant): array
    {
        // Delegate to infrastructure layer for actual schema capture
        $schemaCapturer = app(\App\Services\SchemaCapturer::class);
        
        return $schemaCapturer->capture($tenant->getDatabase()->getValue());
    }
    
    private function compareSchemas(array $expected, array $actual): SchemaDiff
    {
        $diff = [
            'tables' => $this->compareTables($expected['tables'] ?? [], $actual['tables'] ?? []),
            'columns' => $this->compareColumns($expected, $actual),
            'indexes' => $this->compareIndexes($expected, $actual),
            'foreign_keys' => $this->compareForeignKeys($expected, $actual),
        ];
        
        return new SchemaDiff($diff);
    }
    
    private function compareTables(array $expected, array $actual): array
    {
        $expectedTables = array_keys($expected);
        $actualTables = array_keys($actual);
        
        return [
            'added' => array_diff($actualTables, $expectedTables),
            'removed' => array_diff($expectedTables, $actualTables),
            'modified' => $this->findModifiedTables($expected, $actual),
        ];
    }
    
    private function findModifiedTables(array $expected, array $actual): array
    {
        $modified = [];
        $commonTables = array_intersect(array_keys($expected), array_keys($actual));
        
        foreach ($commonTables as $table) {
            if ($expected[$table] != $actual[$table]) {
                $modified[] = $table;
            }
        }
        
        return $modified;
    }
    
    // ... additional comparison methods
}
```

## **7. VIEW COMPONENTS**

### **7.1 Blade Views for Components**

**File: `resources/views/filament/components/template-info.blade.php`**

```blade
<div class="p-4 bg-gray-50 rounded-lg">
    <div class="flex items-start space-x-4">
        @if($template->icon)
            <div class="flex-shrink-0">
                <x-heroicon-o-document-duplicate class="h-8 w-8 text-primary-500" />
            </div>
        @endif
        
        <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900">{{ $template->name }}</h3>
            <p class="mt-1 text-sm text-gray-600">{{ $template->description }}</p>
            
            <div class="mt-3 grid grid-cols-2 gap-4">
                <div>
                    <span class="text-xs font-medium text-gray-500">Version</span>
                    <p class="text-sm font-semibold">{{ $template->version }}</p>
                </div>
                <div>
                    <span class="text-xs font-medium text-gray-500">Status</span>
                    <p class="text-sm">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {{ $template->is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }}">
                            {{ $template->is_active ? 'Active' : 'Inactive' }}
                        </span>
                    </p>
                </div>
            </div>
            
            @if($template->config && is_array($template->config))
                <div class="mt-4">
                    <h4 class="text-sm font-medium text-gray-700">Configuration:</h4>
                    <ul class="mt-1 space-y-1">
                        @foreach($template->config as $key => $value)
                            @if(is_bool($value))
                                <li class="text-xs text-gray-600">
                                    <span class="font-medium">{{ $key }}:</span> 
                                    {{ $value ? 'Yes' : 'No' }}
                                </li>
                            @else
                                <li class="text-xs text-gray-600">
                                    <span class="font-medium">{{ $key }}:</span> {{ $value }}
                                </li>
                            @endif
                        @endforeach
                    </ul>
                </div>
            @endif
        </div>
    </div>
</div>
```

**File: `resources/views/filament/components/schema-diff-viewer.blade.php`**

```blade
<div class="space-y-6">
    @if($diff->hasChanges())
        <div class="bg-white shadow rounded-lg overflow-hidden">
            <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 class="text-lg font-medium text-gray-900">Schema Differences</h3>
                <p class="mt-1 text-sm text-gray-600">
                    Found {{ $diff->getTotalChanges() }} changes between expected and actual schema
                </p>
            </div>
            
            <div class="px-4 py-5 sm:p-6">
                <!-- Tables Section -->
                @if($diff->hasTableChanges())
                    <div class="mb-6">
                        <h4 class="text-sm font-medium text-gray-900 mb-3">Table Changes</h4>
                        
                        @if(count($diff->getAddedTables()) > 0)
                            <div class="mb-4">
                                <h5 class="text-xs font-medium text-green-700 mb-2">Added Tables</h5>
                                <div class="space-y-1">
                                    @foreach($diff->getAddedTables() as $table)
                                        <div class="flex items-center text-sm">
                                            <x-heroicon-o-plus class="h-4 w-4 text-green-500 mr-2" />
                                            <code class="bg-green-50 text-green-700 px-2 py-1 rounded">{{ $table }}</code>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        @endif
                        
                        @if(count($diff->getRemovedTables()) > 0)
                            <div class="mb-4">
                                <h5 class="text-xs font-medium text-red-700 mb-2">Removed Tables</h5>
                                <div class="space-y-1">
                                    @foreach($diff->getRemovedTables() as $table)
                                        <div class="flex items-center text-sm">
                                            <x-heroicon-o-minus class="h-4 w-4 text-red-500 mr-2" />
                                            <code class="bg-red-50 text-red-700 px-2 py-1 rounded">{{ $table }}</code>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        @endif
                    </div>
                @endif
                
                <!-- Columns Section -->
                @if($diff->hasColumnChanges())
                    <div class="mb-6">
                        <h4 class="text-sm font-medium text-gray-900 mb-3">Column Changes</h4>
                        
                        @foreach($diff->getColumnChanges() as $table => $changes)
                            <div class="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                                <div class="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                    <h5 class="text-xs font-medium text-gray-700">Table: <code>{{ $table }}</code></h5>
                                </div>
                                <div class="px-4 py-3">
                                    @if(isset($changes['added']) && count($changes['added']) > 0)
                                        <div class="mb-3">
                                            <h6 class="text-xs font-medium text-green-700 mb-1">Added Columns</h6>
                                            <div class="space-y-1">
                                                @foreach($changes['added'] as $column)
                                                    <div class="flex items-center text-sm">
                                                        <x-heroicon-o-plus class="h-3 w-3 text-green-500 mr-2" />
                                                        <code class="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">{{ $column }}</code>
                                                    </div>
                                                @endforeach
                                            </div>
                                        </div>
                                    @endif
                                    
                                    @if(isset($changes['modified']) && count($changes['modified']) > 0)
                                        <div>
                                            <h6 class="text-xs font-medium text-yellow-700 mb-1">Modified Columns</h6>
                                            <div class="space-y-2">
                                                @foreach($changes['modified'] as $column => $modification)
                                                    <div class="text-sm">
                                                        <div class="flex items-center mb-1">
                                                            <x-heroicon-o-exclamation-triangle class="h-3 w-3 text-yellow-500 mr-2" />
                                                            <code class="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-xs">{{ $column }}</code>
                                                        </div>
                                                        <div class="ml-5 text-xs text-gray-600 space-y-1">
                                                            @foreach($modification as $property => $values)
                                                                <div>
                                                                    <span class="font-medium">{{ $property }}:</span>
                                                                    <span class="line-through text-red-500 mx-1">{{ $values['expected'] }}</span>
                                                                    →
                                                                    <span class="text-green-500 mx-1">{{ $values['actual'] }}</span>
                                                                </div>
                                                            @endforeach
                                                        </div>
                                                    </div>
                                                @endforeach
                                            </div>
                                        </div>
                                    @endif
                                </div>
                            </div>
                        @endforeach
                    </div>
                @endif
                
                <!-- Summary -->
                <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-900 mb-2">Summary</h4>
                    <div class="grid grid-cols-2 gap-4 text-xs">
                        <div>
                            <span class="text-gray-600">Total Changes:</span>
                            <span class="font-medium ml-2">{{ $diff->getTotalChanges() }}</span>
                        </div>
                        <div>
                            <span class="text-gray-600">Severity:</span>
                            <span class="font-medium ml-2 {{ $diff->getSeverity() === 'high' ? 'text-red-600' : ($diff->getSeverity() === 'medium' ? 'text-yellow-600' : 'text-green-600') }}">
                                {{ ucfirst($diff->getSeverity()) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @else
        <div class="text-center py-12">
            <x-heroicon-o-check-circle class="mx-auto h-12 w-12 text-green-500" />
            <h3 class="mt-4 text-lg font-medium text-gray-900">No Schema Differences</h3>
            <p class="mt-2 text-sm text-gray-600">
                The tenant schema matches the expected template schema.
            </p>
        </div>
    @endif
</div>
```

## **8. SERVICE PROVIDER CONFIGURATION**

**File: `app/Providers/FilamentServiceProvider.php`**

```php
<?php

namespace App\Providers;

use App\Filament\Pages\Platform\TenantDashboard;
use App\Filament\Pages\Platform\ProvisioningQueue;
use App\Filament\Resources\Platform\TenantResource;
use App\Filament\Resources\Platform\TemplateResource;
use App\Filament\Resources\Platform\ModuleResource;
use Filament\Facades\Filament;
use Filament\Navigation\NavigationGroup;
use Illuminate\Support\ServiceProvider;

class FilamentServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Filament::serving(function () {
            // Register navigation groups
            Filament::registerNavigationGroups([
                NavigationGroup::make()
                    ->label('Platform Administration')
                    ->icon('heroicon-o-cog')
                    ->collapsed(false),
                
                NavigationGroup::make()
                    ->label('Tenant Management')
                    ->icon('heroicon-o-building-office')
                    ->collapsed(false),
            ]);
            
            // Register navigation items
            Filament::registerNavigationItems([
                \Filament\Navigation\NavigationItem::make('Tenant Dashboard')
                    ->url(fn(): string => TenantDashboard::getUrl())
                    ->icon('heroicon-o-chart-bar')
                    ->group('Platform Administration')
                    ->sort(1),
                
                \Filament\Navigation\NavigationItem::make('Provisioning Queue')
                    ->url(fn(): string => ProvisioningQueue::getUrl())
                    ->icon('heroicon-o-queue-list')
                    ->group('Platform Administration')
                    ->sort(2)
                    ->badge(fn(): string => \App\Models\ProvisioningJob::where('status', 'processing')->count(), 
                        color: 'warning'),
            ]);
            
            // Register widgets
            Filament::registerWidgets([
                \App\Filament\Widgets\PlatformStatsOverview::class,
                \App\Filament\Widgets\RecentProvisioningActivity::class,
                \App\Filament\Widgets\SchemaHealthOverview::class,
            ]);
            
            // Register theme
            Filament::registerTheme(
                app(\Filament\View\LegacyComponents\Context::class)->themeUrl,
            );
        });
    }
    
    public function register(): void
    {
        // Register domain services
        $this->app->bind(
            \App\Domain\Platform\Admin\Contexts\TenantManagement\Repositories\TenantRepositoryInterface::class,
            \App\Infrastructure\Platform\Admin\Contexts\TenantManagement\Repositories\EloquentTenantRepository::class
        );
        
        $this->app->bind(
            \App\Domain\Platform\Admin\Contexts\TemplateManagement\Repositories\TemplateRepositoryInterface::class,
            \App\Infrastructure\Platform\Admin\Contexts\TemplateManagement\Repositories\EloquentTemplateRepository::class
        );
        
        // Register domain event dispatcher
        $this->app->singleton(
            \App\Domain\Platform\Shared\Events\DomainEventDispatcher::class,
            \App\Infrastructure\Platform\Shared\Events\LaravelEventDispatcher::class
        );
    }
}
```

## **9. KEY DDD PRINCIPLES IMPLEMENTED**

### **9.1 Bounded Contexts Established:**
1. **Tenant Management Context** - Managing tenant lifecycle and provisioning
2. **Template Management Context** - Template definitions and versions
3. **Module Management Context** - Feature modules and dependencies
4. **Schema Management Context** - Schema comparison and drift detection

### **9.2 Domain Entities with Rich Behavior:**
- `TenantAggregate` with provisioning state transitions
- `Template` with module compatibility validation
- `Module` with dependency resolution
- Value objects like `TenantStatus`, `DomainName`, `DatabaseName`

### **9.3 Domain Services:**
- `TenantProvisioningService` orchestrates the provisioning process
- `SchemaComparisonService` handles schema analysis
- `ProvisioningQueueService` manages background jobs

### **9.4 Specifications:**
- `TenantCanBeProvisionedSpecification` validates provisioning readiness
- `TemplateCompatibilitySpecification` validates module compatibility

### **9.5 Repository Pattern:**
- Interface-based repositories for data access
- Separation of domain logic from persistence concerns

### **9.6 Event-Driven Architecture:**
- Domain events for important state changes
- Event handlers for side effects (notifications, logging)

### **9.7 Anti-Corruption Layer:**
- Clear separation between domain layer and infrastructure
- Converters/adapters between domain entities and Eloquent models

## **10. NEXT STEPS**

This implementation provides a solid DDD-based admin interface. Next, we should:

1. **Implement the Infrastructure Layer** with concrete repositories
2. **Add Domain Event Handlers** for notifications and logging
3. **Create Integration Tests** for domain services
4. **Implement CQRS** for complex queries
5. **Add Value Object Validation** with custom rules
6. **Create Domain-Specific Language** for provisioning configurations

Would you like me to proceed with **implementing the infrastructure layer** or **adding domain event handlers** next?