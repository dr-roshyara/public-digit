# Claude CLI Implementation Guide: Multi-Tenant Election Platform

## 🎯 Implementation Protocol & Guardrails

### **CRITICAL: Architecture Preservation Rules**
```
NEVER MODIFY THESE CORE FILES:
- architecture/architectural-manifest.json
- architecture/claude-guardrails.js  
- architecture/architecture-validator.php
- bootstrap/providers.php (without validation)
- config/tenant.php reserved_routes
```

## Phase 1: Project Structure & DDD Foundation

### **1.1 Validate Existing Structure**
```bash
# Run architecture validation first
cd packages/laravel-backend
php artisan architecture:validate

# Check for violations
php artisan architecture:violations --report
```

### **1.2 Create DDD Context Scaffolding**
```bash
# Create bounded contexts with strict DDD structure
php artisan make:context Platform --domain
php artisan make:context TenantAuth --domain  
php artisan make:context Membership --domain
php artisan make:context Election --domain
php artisan make:context Finance --domain
php artisan make:context Communication --domain
```

**Expected Structure:**
```
app/Contexts/
├── Platform/
│   ├── Domain/
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Services/
│   │   └── Events/
│   ├── Application/
│   │   ├── Commands/
│   │   ├── Queries/
│   │   └── Services/
│   └── Infrastructure/
├── TenantAuth/
├── Membership/
├── Election/
├── Finance/
└── Communication/
```

### **1.3 Register Context Service Providers**
```php
// bootstrap/providers.php - ADD THESE PROVIDERS
return [
    App\Providers\AppServiceProvider::class,
    App\Providers\EventServiceProvider::class,
    
    // DDD Context Providers
    App\Contexts\Platform\Infrastructure\Providers\PlatformServiceProvider::class,
    App\Contexts\TenantAuth\Infrastructure\Providers\TenantAuthServiceProvider::class,
    App\Contexts\Membership\Infrastructure\Providers\MembershipServiceProvider::class,
    App\Contexts\Election\Infrastructure\Providers\ElectionServiceProvider::class,
    App\Contexts\Finance\Infrastructure\Providers\FinanceServiceProvider::class,
    App\Contexts\Communication\Infrastructure\Providers\CommunicationServiceProvider::class,
    
    // Infrastructure Providers
    App\Providers\MobileApiServiceProvider::class,
];
```

## Phase 2: TDD Implementation - Platform Context

### **2.1 Platform Context TDD Implementation**

**START WITH TESTS:**
```bash
# Create test for Tenant Entity
php artisan make:test Platform/Domain/Entities/TenantTest --unit

# Create test for TenantSlug Value Object  
php artisan make:test Platform/Domain/ValueObjects/TenantSlugTest --unit

# Create feature test for Tenant Management
php artisan make:test Platform/Application/TenantManagementTest --feature
```

**Implement Tenant Entity with TDD:**
```php
<?php
// tests/Unit/Platform/Domain/Entities/TenantTest.php
namespace Tests\Unit\Platform\Domain\Entities;

use Tests\TestCase;
use App\Contexts\Platform\Domain\Entities\Tenant;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantStatus;
use App\Contexts\Platform\Domain\Exceptions\InvalidTenantException;

class TenantTest extends TestCase
{
    /** @test */
    public function it_can_create_valid_tenant(): void
    {
        $slug = TenantSlug::fromString('nrna');
        $status = TenantStatus::active();
        
        $tenant = new Tenant($slug, 'NRNA Organization', $status);
        
        $this->assertEquals('nrna', $tenant->getSlug()->toString());
        $this->assertEquals('NRNA Organization', $tenant->getName());
        $this->assertTrue($tenant->getStatus()->isActive());
    }
    
    /** @test */
    public function it_throws_exception_for_reserved_slug(): void
    {
        $this->expectException(InvalidTenantException::class);
        
        TenantSlug::fromString('admin'); // Reserved slug
    }
}
```

**Implement Domain Code:**
```php
<?php
// app/Contexts/Platform/Domain/Entities/Tenant.php
namespace App\Contexts\Platform\Domain\Entities;

use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\ValueObjects\TenantStatus;

class Tenant
{
    public function __construct(
        private TenantSlug $slug,
        private string $name,
        private TenantStatus $status
    ) {
        $this->validate();
    }
    
    private function validate(): void
    {
        if (empty($this->name)) {
            throw new \InvalidArgumentException('Tenant name cannot be empty');
        }
    }
    
    public function getSlug(): TenantSlug
    {
        return $this->slug;
    }
    
    public function getName(): string
    {
        return $this->name;
    }
    
    public function getStatus(): TenantStatus
    {
        return $this->status;
    }
    
    public function activate(): void
    {
        $this->status = TenantStatus::active();
    }
    
    public function deactivate(): void
    {
        $this->status = TenantStatus::inactive();
    }
}
```

### **2.2 Implement Value Objects with TDD**

```php
<?php
// tests/Unit/Platform/Domain/ValueObjects/TenantSlugTest.php
namespace Tests\Unit\Platform\Domain\ValueObjects;

use Tests\TestCase;
use App\Contexts\Platform\Domain\ValueObjects\TenantSlug;
use App\Contexts\Platform\Domain\Exceptions\InvalidTenantSlugException;

class TenantSlugTest extends TestCase
{
    private array $reservedSlugs = ['admin', 'api', 'app', 'www'];
    
    /** @test */
    public function it_creates_valid_slug(): void
    {
        $slug = TenantSlug::fromString('valid-tenant');
        
        $this->assertEquals('valid-tenant', $slug->toString());
    }
    
    /** @test */
    public function it_normalizes_slug(): void
    {
        $slug = TenantSlug::fromString('  My Tenant  ');
        
        $this->assertEquals('my-tenant', $slug->toString());
    }
    
    /** @test */
    public function it_rejects_reserved_slugs(): void
    {
        foreach ($this->reservedSlugs as $reservedSlug) {
            try {
                TenantSlug::fromString($reservedSlug);
                $this->fail("Should have thrown exception for reserved slug: {$reservedSlug}");
            } catch (InvalidTenantSlugException $e) {
                $this->assertStringContainsString('reserved', $e->getMessage());
            }
        }
    }
}
```

## Phase 3: Multi-Tenancy Infrastructure

### **3.1 Implement Tenant Identification**

```bash
# Test tenant identification first
php artisan make:test Platform/Infrastructure/TenantIdentificationTest --feature
```

```php
<?php
// tests/Feature/Platform/Infrastructure/TenantIdentificationTest.php
namespace Tests\Feature\Platform\Infrastructure;

use Tests\TestCase;
use App\Models\Tenant;
use Illuminate\Http\Request;

class TenantIdentificationTest extends TestCase
{
    /** @test */
    public function it_identifies_tenant_from_subdomain(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'nrna']);
        
        $request = Request::create('https://nrna.publicdigit.com/api/v1/elections');
        
        $identifier = app(\App\Contexts\Platform\Infrastructure\Http\Middleware\IdentifyTenantFromRequest::class);
        $identifiedTenant = $identifier->extractTenantFromRequest($request);
        
        $this->assertEquals($tenant->id, $identifiedTenant->id);
    }
    
    /** @test */
    public function it_skips_tenant_identification_for_admin_domain(): void
    {
        $request = Request::create('https://admin.publicdigit.com/api/admin/tenants');
        
        $identifier = app(\App\Contexts\Platform\Infrastructure\Http\Middleware\IdentifyTenantFromRequest::class);
        $isCentralRoute = $identifier->isCentralRoute($request);
        
        $this->assertTrue($isCentralRoute);
    }
}
```

### **3.2 Implement Database Switching**

```php
<?php
// app/Contexts/Platform/Infrastructure/Http/Middleware/IdentifyTenantFromRequest.php
namespace App\Contexts\Platform\Infrastructure\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Contexts\Platform\Domain\Services\TenantFinder;
use App\Contexts\Platform\Domain\Exceptions\TenantNotFoundException;
use Symfony\Component\HttpFoundation\Response;

class IdentifyTenantFromRequest
{
    public function __construct(private TenantFinder $tenantFinder) {}
    
    public function handle(Request $request, Closure $next): Response
    {
        // Skip for central routes
        if ($this->isCentralRoute($request)) {
            return $next($request);
        }
        
        try {
            $tenant = $this->tenantFinder->findFromRequest($request);
            
            // Set tenant context
            app()->instance('currentTenant', $tenant);
            
            // Switch database connection
            $this->switchDatabaseConnection($tenant);
            
        } catch (TenantNotFoundException $e) {
            abort(404, 'Tenant not found');
        }
        
        return $next($request);
    }
    
    private function isCentralRoute(Request $request): bool
    {
        $centralDomains = ['admin.publicdigit.com', 'api.publicdigit.com'];
        $centralPaths = ['/api/admin/', '/api/v1/auth/', '/health'];
        
        return in_array($request->getHost(), $centralDomains) ||
               str_starts_with($request->path(), $centralPaths);
    }
    
    private function switchDatabaseConnection($tenant): void
    {
        config([
            'database.connections.tenant.database' => "tenant_{$tenant->getSlug()}",
        ]);
        
        app('db')->setDefaultConnection('tenant');
    }
}
```

## Phase 4: API Gateway & Routing

### **4.1 Implement Strict Route Separation**

```bash
# Create route tests
php artisan make:test Platform/Infrastructure/RoutingTest --feature
```

```php
<?php
// routes/platform.php - LANDLORD ONLY ROUTES
<?php

use Illuminate\Support\Facades\Route;
use App\Contexts\Platform\Infrastructure\Http\Controllers\TenantController;

Route::domain('admin.publicdigit.com')->group(function () {
    // Landlord administration APIs
    Route::prefix('api/admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::apiResource('tenants', TenantController::class);
        Route::post('tenants/{tenant}/activate', [TenantController::class, 'activate']);
        Route::post('tenants/{tenant}/deactivate', [TenantController::class, 'deactivate']);
    });
    
    // Inertia admin routes
    Route::middleware(['web', 'auth:sanctum', 'admin'])->group(function () {
        Route::get('/admin/{any?}', function () {
            return inertia('Admin/Dashboard');
        })->where('any', '.*');
    });
});

// Platform APIs (no tenant context)
Route::domain('api.publicdigit.com')->prefix('api/v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::get('health', [HealthController::class, 'check']);
});
```

```php
<?php
// routes/tenant.php - TENANT ONLY ROUTES  
<?php

use Illuminate\Support\Facades\Route;
use App\Contexts\Election\Infrastructure\Http\Controllers\ElectionController;

Route::domain('{tenant}.publicdigit.com')->group(function () {
    // Tenant member APIs
    Route::prefix('api/v1')->middleware(['identify.tenant', 'auth:sanctum'])->group(function () {
        // Membership context
        Route::apiResource('profile', ProfileController::class)->only(['show', 'update']);
        
        // Election context  
        Route::apiResource('elections', ElectionController::class)->only(['index', 'show']);
        Route::post('elections/{election}/vote', [ElectionController::class, 'vote']);
        
        // Finance context
        Route::apiResource('invoices', InvoiceController::class)->only(['index', 'show', 'pay']);
        
        // Communication context
        Route::apiResource('forum/posts', ForumPostController::class);
    });
});
```

## Phase 5: Frontend Separation Implementation

### **5.1 Angular App Structure (Tenant Member Experience)**

```bash
# Create Angular app with Nx
npx create-nx-workspace@latest publicdigit-platform --preset=angular-monorepo
cd publicdigit-platform

# Generate tenant member application
nx generate @nx/angular:application tenant-member --routing --style=scss --prefix=tenant

# Generate shared libraries
nx generate @nx/angular:library shared/auth --prefix=tenant
nx generate @nx/angular:library shared/tenant --prefix=tenant
nx generate @nx/angular:library features/elections --prefix=tenant
nx generate @nx/angular:library features/profile --prefix=tenant
```

**Implement Tenant Service with TDD:**
```typescript
// apps/tenant-member/src/app/core/services/tenant-api.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TenantApiService } from './tenant-api.service';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

describe('TenantApiService', () => {
  let service: TenantApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TenantApiService,
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(TenantApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set tenant and update base URL', () => {
    const tenant = { id: 1, slug: 'nrna', name: 'NRNA' };
    
    service.setTenant(tenant);
    
    // Assuming baseUrl is public or we have a getter for testing
    expect(service['currentTenant']).toEqual(tenant);
  });

  it('should get elections for current tenant', () => {
    const tenant = { id: 1, slug: 'nrna', name: 'NRNA' };
    const mockElections = [{ id: 1, title: 'Board Election' }];
    
    service.setTenant(tenant);
    service.getElections().subscribe(elections => {
      expect(elections).toEqual(mockElections);
    });

    const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/elections');
    expect(req.request.method).toBe('GET');
    req.flush(mockElections);
  });
});
```

### **5.2 Inertia/Vue3 App (Landlord Admin Only)**

```bash
# Create admin components with TDD approach
php artisan make:inertia Admin/Dashboard --test
php artisan make:inertia Admin/Tenants/Index --test
```

```vue
<!-- resources/js/Pages/Admin/Dashboard.vue -->
<template>
  <AdminLayout title="Dashboard">
    <div class="py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 class="text-2xl font-semibold text-gray-900">Platform Dashboard</h1>
        
        <!-- Landlord admin stats -->
        <div class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard 
            title="Total Tenants" 
            :value="stats.total_tenants" 
            icon="users"
          />
          <StatCard 
            title="Active Elections" 
            :value="stats.active_elections" 
            icon="vote"
          />
          <StatCard 
            title="Platform Revenue" 
            :value="stats.revenue" 
            icon="currency-dollar"
          />
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue'
import StatCard from '@/Components/Admin/StatCard.vue'

defineProps({
  stats: Object
})
</script>
```

## Phase 6: Security & Tenant Isolation

### **6.1 Implement Tenant Scoping**

```php
<?php
// tests/Unit/Election/Domain/Services/VoteValidationServiceTest.php
namespace Tests\Unit\Election\Domain\Services;

use Tests\TestCase;
use App\Contexts\Election\Domain\Services\VoteValidationService;
use App\Contexts\Election\Domain\Exceptions\DuplicateVoteException;

class VoteValidationServiceTest extends TestCase
{
    /** @test */
    public function it_prevents_duplicate_voting(): void
    {
        $service = new VoteValidationService();
        $electionId = 1;
        $voterSlug = 'unique-voter-123';
        
        // First vote should pass
        $this->assertTrue($service->canVote($electionId, $voterSlug));
        
        // Simulate first vote
        $service->recordVote($electionId, $voterSlug);
        
        // Second vote should fail
        $this->assertFalse($service->canVote($electionId, $voterSlug));
    }
    
    /** @test */
    public function it_validates_voting_period(): void
    {
        $service = new VoteValidationService();
        $election = $this->createElectionWithPeriod(
            now()->subDay(), // started yesterday
            now()->addDay()  // ends tomorrow
        );
        
        $this->assertTrue($service->isWithinVotingPeriod($election));
    }
}
```

### **6.2 Repository Pattern with Tenant Scope**

```php
<?php
// app/Contexts/Election/Infrastructure/Persistence/EloquentElectionRepository.php
namespace App\Contexts\Election\Infrastructure\Persistence;

use App\Contexts\Election\Domain\Repositories\ElectionRepository;
use App\Contexts\Election\Domain\Entities\Election;
use App\Contexts\Election\Domain\ValueObjects\ElectionId;
use App\Contexts\Shared\Domain\Exceptions\TenantContextException;

class EloquentElectionRepository implements ElectionRepository
{
    public function findById(ElectionId $electionId): ?Election
    {
        // Tenant context is automatically applied via middleware
        $model = \App\Models\Election::find($electionId->value());
        
        if (!$model) {
            return null;
        }
        
        return $this->toEntity($model);
    }
    
    public function save(Election $election): void
    {
        $tenant = app('currentTenant');
        
        if (!$tenant) {
            throw new TenantContextException('No tenant context for election save');
        }
        
        \App\Models\Election::updateOrCreate(
            ['id' => $election->getId()->value()],
            $this->toArray($election)
        );
    }
    
    private function toEntity($model): Election
    {
        return new Election(
            ElectionId::fromString($model->id),
            // ... map other properties
        );
    }
}
```

## Phase 7: Deployment & Validation

### **7.1 Final Architecture Validation**

```bash
# Run comprehensive validation suite
php artisan architecture:validate --strict

# Run all tests
php artisan test --parallel

# Check for tenant isolation violations  
php artisan tenant:check-isolation

# Validate frontend separation
npm run architecture:check
```

### **7.2 Deployment Configuration**

```nginx
# nginx.conf - STRICT DOMAIN SEPARATION
server {
    listen 443 ssl;
    server_name admin.publicdigit.com;
    
    # Landlord admin only - Inertia/Vue3
    root /var/www/laravel-backend/public;
    
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location /admin {
        # Only allow admin access
        allow 192.168.1.0/24;
        deny all;
        
        try_files $uri $uri/ /index.php?$query_string;
    }
}

server {
    listen 443 ssl;
    server_name ~^(?<tenant_slug>.+)\.publicdigit\.com$;
    
    # Tenant member experience - Angular
    root /var/www/angular-tenant-member/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/v1 {
        proxy_pass http://laravel-backend;
        proxy_set_header X-Tenant $tenant_slug;
    }
}

server {
    listen 443 ssl;
    server_name app.publicdigit.com;
    
    # Mobile PWA - Angular
    root /var/www/angular-tenant-member/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
        add_header Service-Worker-Allowed /;
    }
}
```

## 🎯 Claude CLI Implementation Commands

### **CRITICAL: Always Follow This Order**
```bash
# 1. VALIDATE ARCHITECTURE FIRST
php artisan architecture:validate

# 2. WRITE TESTS FIRST (TDD)
php artisan make:test {Context}/{Layer}/{FeatureTest} --{unit|feature}

# 3. IMPLEMENT MINIMAL CODE TO PASS TESTS
# 4. RUN ALL TESTS
php artisan test

# 5. VALIDATE ARCHITECTURE AGAIN
php artisan architecture:validate

# 6. COMMIT WITH ARCHITECTURE CHECK
git add .
php artisan architecture:pre-commit
git commit -m "feat: {context} - {feature}"
```

### **Safe Code Generation Patterns**
```bash
# DDD Context Generation
php artisan make:context {ContextName} --domain

# Value Objects (Test First)
php artisan make:test {Context}/Domain/ValueObjects/{ValueObject}Test --unit

# Entities (Test First)  
php artisan make:test {Context}/Domain/Entities/{Entity}Test --unit

# Application Services (Test First)
php artisan make:test {Context}/Application/Services/{Service}Test --unit

# Infrastructure Components
php artisan make:test {Context}/Infrastructure/{Component}Test --feature
```

## 🔒 Security & Validation Commands

```bash
# Daily validation
php artisan architecture:health-check

# Tenant isolation audit
php artisan tenant:audit-isolation

# Frontend boundary check
npm run boundaries:validate

# Security scan
php artisan security:scan-architecture
```

This implementation guide ensures strict adherence to DDD principles, TDD methodology, and maintains architectural integrity throughout development. The comprehensive validation system prevents Claude CLI from making destructive changes while enabling productive development.