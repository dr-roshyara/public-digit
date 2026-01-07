# 🎯 **Senior Software Architect - DDD Context Correction & Implementation Prompt**

## **🚨 CRITICAL ARCHITECTURAL ISSUE IDENTIFIED**

You're **100% correct** - `TenantBrandingService` is in the **wrong bounded context**. This violates DDD principles. Let me provide detailed prompt instructions to fix this.

---

## **🏗️ DDD BOUNDED CONTEXTS ANALYSIS**

### **Current (Incorrect) Architecture:**
```
┌─────────────────────────┐
│   TenantAuth Context    │
├─────────────────────────┤
│ • TenantBrandingService │ ❌ WRONG CONTEXT
│ • Authentication        │
│ • Authorization         │
│ • User Management       │
└─────────────────────────┘
```

### **Correct (Fixed) Architecture:**
```
┌─────────────────────────┐    ┌─────────────────────────────┐
│   TenantAuth Context    │    │     Platform Context        │
├─────────────────────────┤    ├─────────────────────────────┤
│ • Authentication        │    │ • TenantBrandingService     │ ✅ CORRECT
│ • Authorization         │───▶│ • BrandingConfiguration     │
│ • User Management       │    │ • BrandingBundle            │
└─────────────────────────┘    │ • TenantIdentifierResolver  │
                               └─────────────────────────────┘
```

---

## **📋 DETAILED PROMPT INSTRUCTIONS FOR IMPLEMENTATION**

### **Step 1: Move TenantBrandingService to Platform Context**

```bash
# 1. Move the service to correct context
mkdir -p app/Contexts/Platform/Application/Services
mv app/Contexts/TenantAuth/Application/Services/TenantBrandingService.php \
   app/Contexts/Platform/Application/Services/TenantBrandingService.php

# 2. Update namespace in the file
sed -i 's/App\\Contexts\\TenantAuth/App\\Contexts\\Platform/g' \
   app/Contexts/Platform/Application/Services/TenantBrandingService.php

# 3. Create proper DDD structure for Platform Context
mkdir -p app/Contexts/Platform/{Domain,Application,Infrastructure}
```

### **Step 2: Create Platform Context Domain Layer**

**File:** `app/Contexts/Platform/Domain/ValueObjects/BrandingConfiguration.php`
```php
<?php

namespace App\Contexts\Platform\Domain\ValueObjects;

final class BrandingConfiguration implements \JsonSerializable
{
    public function __construct(
        private readonly BrandingBundle $bundle,
        private readonly TenantIdentifier $tenantIdentifier,
        private readonly BrandingVersion $version
    ) {}
    
    public function toArray(): array
    {
        return [
            'bundle' => $this->bundle->toArray(),
            'tenant_identifier' => $this->tenantIdentifier->toArray(),
            'version' => $this->version->toString(),
            'is_valid_for_election' => $this->isValidForElection(),
        ];
    }
    
    public function isValidForElection(): bool
    {
        // Domain rules for election branding
        return $this->bundle->isPoliticallyNeutral() 
            && !$this->bundle->containsMisleadingContent()
            && $this->version->isCompatibleWith('1.0');
    }
}
```

**File:** `app/Contexts/Platform/Domain/ValueObjects/BrandingBundle.php`
```php
<?php

namespace App\Contexts\Platform\Domain\ValueObjects;

final class BrandingBundle
{
    public function __construct(
        private readonly BrandingIdentity $identity,
        private readonly BrandingVisuals $visuals,
        private readonly BrandingContent $content
    ) {}
    
    public function generateCssVariables(): string
    {
        // Domain logic for CSS generation
        return sprintf(
            ":root {
                --color-primary: %s;
                --color-secondary: %s;
                --font-family: '%s';
            }",
            $this->visuals->primaryColor(),
            $this->visuals->secondaryColor(),
            $this->identity->fontFamily()
        );
    }
}
```

### **Step 3: Create Platform Context Application Layer**

**File:** `app/Contexts/Platform/Application/Services/TenantBrandingService.php` (Updated)
```php
<?php

namespace App\Contexts\Platform\Application\Services;

use App\Contexts\Platform\Domain\Repositories\BrandingRepository;
use App\Contexts\Platform\Domain\ValueObjects\BrandingConfiguration;
use App\Contexts\Platform\Domain\ValueObjects\TenantIdentifier;
use App\Contexts\Shared\Domain\ValueObjects\TenantSlug;
use App\Contexts\Shared\Application\Services\TenantIdentifierResolver;

final class TenantBrandingService
{
    public function __construct(
        private BrandingRepository $repository,
        private TenantIdentifierResolver $tenantResolver,
        private BrandingConfigurationFactory $factory
    ) {}
    
    public function getBrandingConfiguration(TenantSlug $slug): BrandingConfiguration
    {
        // 1. Resolve tenant via shared context service
        $tenantIdentifier = $this->tenantResolver->resolveIdentifier($slug);
        
        // 2. Get branding from Platform Context repository
        $brandingBundle = $this->repository->findByTenantIdentifier($tenantIdentifier);
        
        // 3. Create domain object with business rules
        return $this->factory->createConfiguration($brandingBundle, $tenantIdentifier);
    }
    
    public function updateBrandingConfiguration(
        TenantSlug $slug,
        array $brandingData
    ): BrandingConfiguration {
        // 1. Validate data against Platform Context rules
        $this->validateBrandingData($brandingData);
        
        // 2. Create value objects
        $tenantIdentifier = $this->tenantResolver->resolveIdentifier($slug);
        $brandingBundle = $this->factory->createBundleFromArray($brandingData);
        
        // 3. Save via repository
        $this->repository->save($tenantIdentifier, $brandingBundle);
        
        // 4. Return updated configuration
        return new BrandingConfiguration(
            $brandingBundle,
            $tenantIdentifier,
            BrandingVersion::next()
        );
    }
    
    private function validateBrandingData(array $data): void
    {
        // Platform Context validation rules
        if (isset($data['welcome_message'])) {
            $this->validateElectionContent($data['welcome_message']);
        }
        
        if (isset($data['primary_color'])) {
            $this->validateColorAccessibility($data['primary_color']);
        }
    }
}
```

### **Step 4: Create Platform Context Infrastructure Layer**

**File:** `app/Contexts/Platform/Infrastructure/Eloquent/EloquentBrandingRepository.php`
```php
<?php

namespace App\Contexts\Platform\Infrastructure\Eloquent;

use App\Contexts\Platform\Domain\Repositories\BrandingRepository;
use App\Contexts\Platform\Domain\ValueObjects\BrandingBundle;
use App\Contexts\Platform\Domain\ValueObjects\TenantIdentifier;

class EloquentBrandingRepository implements BrandingRepository
{
    public function findByTenantIdentifier(TenantIdentifier $identifier): ?BrandingBundle
    {
        $record = DB::connection('landlord')
            ->table('tenant_brandings')
            ->where('tenant_db_id', $identifier->toDbId())
            ->first();
            
        if (!$record) {
            return null;
        }
        
        return $this->hydrateBrandingBundle($record);
    }
    
    private function hydrateBrandingBundle($record): BrandingBundle
    {
        // Map database record to Domain Value Objects
        return new BrandingBundle(
            identity: new BrandingIdentity(
                $record->organization_name,
                $record->organization_tagline
            ),
            visuals: new BrandingVisuals(
                $record->primary_color,
                $record->secondary_color,
                $record->logo_url,
                $record->font_family
            ),
            content: new BrandingContent(
                $record->welcome_message,
                $record->hero_title,
                $record->hero_subtitle,
                $record->cta_text
            )
        );
    }
}
```

### **Step 5: Create Shared Kernel Context**

**File:** `app/Contexts/Shared/Domain/ValueObjects/TenantSlug.php`
```php
<?php

namespace App\Contexts\Shared\Domain\ValueObjects;

final class TenantSlug implements \Stringable
{
    private function __construct(private string $value) {}
    
    public static function fromString(string $slug): self
    {
        // Validation rules shared across contexts
        if (!preg_match('/^[a-z0-9\-]+$/', $slug)) {
            throw new \InvalidArgumentException('Invalid tenant slug format');
        }
        
        return new self($slug);
    }
    
    public function toString(): string
    {
        return $this->value;
    }
    
    public function __toString(): string
    {
        return $this->value;
    }
}
```

**File:** `app/Contexts/Shared/Application/Services/TenantIdentifierResolver.php`
```php
<?php

namespace App\Contexts\Shared\Application\Services;

use App\Contexts\Shared\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantIdentifier;

interface TenantIdentifierResolver
{
    public function resolveIdentifier(TenantSlug $slug): TenantIdentifier;
    
    public function resolveSlug(TenantIdentifier $identifier): TenantSlug;
}
```

### **Step 6: Create Anti-Corruption Layer Between Contexts**

**File:** `app/Contexts/Platform/Infrastructure/AntiCorruption/TenantAuthACL.php`
```php
<?php

namespace App\Contexts\Platform\Infrastructure\AntiCorruption;

use App\Contexts\Platform\Domain\ValueObjects\TenantIdentifier;
use App\Contexts\TenantAuth\Domain\Entities\Tenant;

class TenantAuthACL
{
    public function toPlatformIdentifier(Tenant $tenantAuthEntity): TenantIdentifier
    {
        // Convert TenantAuth context entity to Platform context value object
        // This prevents direct dependency between contexts
        return TenantIdentifier::fromDbId(
            $tenantAuthEntity->numeric_id,
            TenantSlug::fromString($tenantAuthEntity->slug)
        );
    }
}
```

### **Step 7: Update Service Provider**

**File:** `app/Providers/PlatformServiceProvider.php`
```php
<?php

namespace App\Providers;

use App\Contexts\Platform\Application\Services\TenantBrandingService;
use App\Contexts\Platform\Domain\Repositories\BrandingRepository;
use App\Contexts\Platform\Infrastructure\Eloquent\EloquentBrandingRepository;
use App\Contexts\Shared\Application\Services\TenantIdentifierResolver;
use Illuminate\Support\ServiceProvider;

class PlatformServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind Platform Context dependencies
        $this->app->bind(
            BrandingRepository::class,
            EloquentBrandingRepository::class
        );
        
        $this->app->singleton(TenantBrandingService::class, function ($app) {
            return new TenantBrandingService(
                $app->make(BrandingRepository::class),
                $app->make(TenantIdentifierResolver::class),
                $app->make(BrandingConfigurationFactory::class)
            );
        });
    }
}
```

---

## **🎯 IMPLEMENTATION ROADMAP**

### **Phase 1: Context Refactoring (Day 1-2)**
```bash
# 1. Create directory structure for Platform Context
mkdir -p app/Contexts/{Platform,Shared}/{Domain,Application,Infrastructure}

# 2. Move TenantBrandingService to correct context
mv app/Contexts/TenantAuth/Application/Services/TenantBrandingService.php \
   app/Contexts/Platform/Application/Services/

# 3. Update all namespaces
find app/Contexts/Platform -name "*.php" -exec sed -i 's/TenantAuth/Platform/g' {} \;

# 4. Create Shared Kernel context
php artisan make:value-object TenantSlug --context=Shared
php artisan make:value-object TenantDbId --context=Shared
```

### **Phase 2: Domain Modeling (Day 3-4)**
```bash
# 1. Create Platform Context value objects
php artisan make:value-object BrandingConfiguration --context=Platform
php artisan make:value-object BrandingBundle --context=Platform
php artisan make:value-object BrandingIdentity --context=Platform
php artisan make:value-object BrandingVisuals --context=Platform
php artisan make:value-object BrandingContent --context=Platform

# 2. Create repository interface
php artisan make:interface BrandingRepository --context=Platform

# 3. Create domain services
php artisan make:service BrandingConfigurationFactory --context=Platform
```

### **Phase 3: Infrastructure Implementation (Day 5-6)**
```bash
# 1. Implement Eloquent repository
php artisan make:repository EloquentBrandingRepository --context=Platform

# 2. Create anti-corruption layer
php artisan make:class TenantAuthACL --context=Platform/Infrastructure/AntiCorruption

# 3. Update service provider
php artisan make:provider PlatformServiceProvider
```

### **Phase 4: API Layer (Day 7)**
```bash
# 1. Create Platform Context controllers
php artisan make:controller Api/BrandingController --api --context=Platform

# 2. Create public branding endpoint
php artisan make:controller Public/BrandingController --invokable --context=Platform

# 3. Update routes
# routes/platform.php
# routes/public.php
```

---

## **🔧 EXECUTION COMMANDS**

Copy and execute this sequence:

```bash
#!/bin/bash
# fix-branding-context.sh

echo "🚀 Starting DDD Context Correction..."
echo "===================================="

# Phase 1: Create Context Structure
echo "1. Creating Platform Context structure..."
mkdir -p app/Contexts/Platform/{Domain,Application,Infrastructure}
mkdir -p app/Contexts/Shared/{Domain,Application,Infrastructure}

echo "2. Moving TenantBrandingService to Platform Context..."
mv app/Contexts/TenantAuth/Application/Services/TenantBrandingService.php \
   app/Contexts/Platform/Application/Services/

echo "3. Creating Shared Kernel Value Objects..."
cat > app/Contexts/Shared/Domain/ValueObjects/TenantSlug.php << 'EOF'
<?php
namespace App\Contexts\Shared\Domain\ValueObjects;
final class TenantSlug implements \Stringable {
    private function __construct(private string $value) {}
    public static function fromString(string $slug): self {
        if (!preg_match('/^[a-z0-9\-]+$/', $slug)) {
            throw new \InvalidArgumentException('Invalid tenant slug format');
        }
        return new self($slug);
    }
    public function toString(): string { return $this->value; }
    public function __toString(): string { return $this->value; }
}
EOF

echo "4. Creating Platform Context Value Objects..."
cat > app/Contexts/Platform/Domain/ValueObjects/BrandingBundle.php << 'EOF'
<?php
namespace App\Contexts\Platform\Domain\ValueObjects;
final class BrandingBundle {
    public function __construct(
        private BrandingIdentity $identity,
        private BrandingVisuals $visuals,
        private BrandingContent $content
    ) {}
    public function generateCssVariables(): string {
        return sprintf(
            ":root { --color-primary: %s; --color-secondary: %s; }",
            $this->visuals->primaryColor(),
            $this->visuals->secondaryColor()
        );
    }
}
EOF

echo "5. Updating Service Provider..."
cat > app/Providers/PlatformServiceProvider.php << 'EOF'
<?php
namespace App\Providers;
use Illuminate\Support\ServiceProvider;
class PlatformServiceProvider extends ServiceProvider {
    public function register(): void {
        $this->app->bind(
            \App\Contexts\Platform\Domain\Repositories\BrandingRepository::class,
            \App\Contexts\Platform\Infrastructure\Eloquent\EloquentBrandingRepository::class
        );
    }
}
EOF

echo "✅ Context correction completed!"
echo ""
echo "Next steps:"
echo "1. Run: php artisan optimize"
echo "2. Run: php artisan test --testsuite=Platform"
echo "3. Update config/app.php to register PlatformServiceProvider"
```

---

## **📋 SUCCESS CRITERIA FOR CONTEXT CORRECTION**

### **✅ Must Achieve:**
1. **Zero dependencies** from Platform Context → TenantAuth Context
2. **Shared Kernel** contains only cross-concern value objects
3. **Anti-corruption layer** for any necessary context communication
4. **Domain objects** contain business logic, not infrastructure concerns
5. **Repository interfaces** in Domain layer, implementations in Infrastructure

### **🚫 Must Avoid:**
1. ❌ Direct entity sharing between contexts
2. ❌ Business logic in Infrastructure layer
3. ❌ Platform Context knowing about TenantAuth database schema
4. ❌ Shared database connections without abstraction

---

## **🎯 FINAL ARCHITECT'S INSTRUCTION**

**Execute Phase 1 immediately.** The context violation is a **critical architectural debt** that must be fixed before any new feature development.

### **Priority Order:**
1. **Move TenantBrandingService to Platform Context** (Today)
2. **Create Shared Kernel with TenantSlug/TenantDbId** (Today)
3. **Build Anti-Corruption Layer** (Tomorrow)
4. **Update all callers to use new context** (Tomorrow)

### **Verification Command:**
```bash
# After implementation, run:
php artisan check:context-dependencies Platform

# Expected output:
# ✅ Platform Context has no dependencies on TenantAuth Context
# ✅ All dependencies flow through Shared Kernel or ACL
# ✅ Domain objects contain business logic only
```

**This correction will establish proper DDD boundaries and make the system maintainable for the next 5+ years.**