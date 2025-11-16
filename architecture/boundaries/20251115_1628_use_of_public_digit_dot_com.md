# 🎯 www.publicdigit.com - Strategic Decision

## 🔍 Analysis of www.publicdigit.com

### **Current Domain Allocation:**
- `admin.publicdigit.com` → Inertia/Vue3 (Landlord Admin)
- `*.publicdigit.com` → Angular (Tenant Members)  
- `app.publicdigit.com` → Angular Mobile PWA
- `api.publicdigit.com` → Platform APIs
- `www.publicdigit.com` → **UNDEFINED**

## 🚀 Recommended Strategy

### **Option 1: Marketing Site + Tenant Discovery** (RECOMMENDED)

```
www.publicdigit.com → Angular (Public-Facing)
```

**Purpose:** Public marketing site + tenant discovery portal

**Content:**
- Platform features & benefits
- Pricing information  
- Tenant directory/listings
- "Find Your Organization" search
- Public documentation
- Contact/sales information

**User Flow:**
```
User visits www.publicdigit.com
↓
Sees marketing content + tenant search
↓  
Finds their organization (e.g., "NRNA")
↓
Clicks → Redirects to nrna.publicdigit.com (Angular tenant app)
```

### **Option 2: Redirect Strategy**

```
www.publicdigit.com → 302 Redirect
```

**Option 2A:** Redirect to primary tenant
```
www.publicdigit.com → nrna.publicdigit.com
```

**Option 2B:** Redirect to admin portal  
```
www.publicdigit.com → admin.publicdigit.com
```

**Option 2C:** Redirect to app store
```
www.publicdigit.com → app.publicdigit.com
```

## 🏗️ Recommended Implementation

### **www.publicdigit.com → Angular (Public Site)**

**Frontend:** Angular (same codebase as tenant app, different routing)

**Routes:**
```typescript
// www.publicdigit.com routes
const routes = [
  { path: '', component: HomePageComponent },           // Marketing
  { path: 'pricing', component: PricingComponent },     // Pricing
  { path: 'tenants', component: TenantDirectoryComponent }, // Find your org
  { path: 'docs', component: DocumentationComponent },  // Public docs
  { path: 'contact', component: ContactComponent },     // Sales/contact
  
  // Special route - tenant discovery
  { path: 'go/:tenantSlug', component: TenantRedirectComponent },
];

// tenant1.publicdigit.com routes (existing)
const tenantRoutes = [
  { path: 'elections', component: ElectionListComponent },
  { path: 'profile', component: ProfileComponent },
  // ... tenant features
];
```

### **Configuration Update**

```php
// config/domains.php
return [
    'public' => [  // NEW
        'domains' => [
            'www.publicdigit.com',
            'publicdigit.com', // Root domain
        ],
        'frontend' => 'angular-public',
        'purpose' => 'public_marketing_tenant_discovery',
        'database' => 'none', // No database access
        'api_prefix' => '/api/public',
    ],
    
    'landlord' => [
        'domains' => ['admin.publicdigit.com'],
        // ... existing
    ],
    
    'tenant' => [
        'domains' => ['*.publicdigit.com', 'app.publicdigit.com'],
        // ... existing  
    ],
];
```

## 🎯 Contexts for www.publicdigit.com

### **Required Contexts:**

1. **Platform Context** (READ-ONLY)
   - Tenant directory/listings
   - Public tenant information
   - Platform statistics

2. **Marketing Context** (NEW)
   - Content management for marketing pages
   - Pricing information
   - Documentation

### **API Access:**
```php
// routes/platform-api.php
Route::prefix('api/public')->group(function () {
    // Public tenant directory
    Route::get('tenants', [PublicTenantController::class, 'index']);
    Route::get('tenants/{slug}', [PublicTenantController::class, 'show']);
    
    // Platform information
    Route::get('stats', [PublicStatsController::class, 'index']);
    Route::get('pricing', [PricingController::class, 'index']);
});
```

## 🔧 Implementation Example

### **Tenant Redirect Component**
```typescript
// apps/mobile/src/app/features/public/tenant-redirect.component.ts
@Component({
  template: `<div>Redirecting to your organization...</div>`
})
export class TenantRedirectComponent implements OnInit {
  
  constructor(private route: ActivatedRoute) {}
  
  ngOnInit() {
    const tenantSlug = this.route.snapshot.paramMap.get('tenantSlug');
    
    // Validate tenant exists and is active
    this.platformService.getTenant(tenantSlug).subscribe(tenant => {
      if (tenant && tenant.active) {
        window.location.href = `https://${tenantSlug}.publicdigit.com`;
      } else {
        // Show error - tenant not found
        this.router.navigate(['/tenants'], { 
          queryParams: { error: 'tenant-not-found' }
        });
      }
    });
  }
}
```

### **Laravel Route for www**
```php
// routes/public.php
Route::domain('www.publicdigit.com')->group(function () {
    // Serve Angular public site
    Route::get('/{any?}', function () {
        return response()->file(public_path('angular-public/index.html'));
    })->where('any', '^(?!api).*$');
});

// Also handle root domain
Route::domain('publicdigit.com')->group(function () {
    Route::redirect('/', 'https://www.publicdigit.com');
});
```

## 🎯 Recommended Architecture

```
www.publicdigit.com → Angular Public Site
                    ↓
    [Marketing]   [Tenant Discovery]   [Documentation]
          ↓               ↓                   ↓
    Learn about    Find your org →    Read docs &
    platform       (Search/List)      get help
          ↓               ↓                   ↓
    Sign up for    Click to join →    Contact support
    demo           tenant app
```

## ✅ Benefits of This Approach

1. **Marketing Funnel** - Clear path from discovery to tenant app
2. **SEO Friendly** - Public content indexed by search engines  
3. **User Experience** - Easy tenant discovery process
4. **Brand Control** - Professional public-facing presence
5. **Unified Codebase** - Same Angular app, different routing

## 🚀 Quick Start Option

If you want something simple immediately:

```php
// Temporary redirect in Laravel
Route::domain('www.publicdigit.com')->get('/', function () {
    return redirect('https://admin.publicdigit.com'); // or first tenant
});

Route::domain('publicdigit.com')->get('/', function () {
    return redirect('https://www.publicdigit.com');
});
```

**Recommendation:** Go with Option 1 (Angular Public Site) for long-term strategy.

# 🎯 www.publicdigit.com - Architecture Decision

## 🔍 Critical Analysis

**Problem:** `www.publicdigit.com` doesn't fit cleanly into either frontend because:

- **Marketing content** → Better in Angular (SEO, static content)
- **Tenant discovery** → Needs access to Platform Context (Landlord DB)
- **Admin features** → Could include admin signup/login

## 🏗️ Recommended Architecture

### **Option A: Angular Public Site** (RECOMMENDED)

```
www.publicdigit.com → Angular (Public Site)
```

**Contexts Required:**
1. **Platform Context** (READ-ONLY) - Tenant directory, platform stats
2. **TenantAuth Context** (Limited) - Public registration, contact forms

**Implementation:**
```typescript
// Angular app with public routes
const routes = [
  // Public marketing pages
  { path: '', component: HomePageComponent },           // SEO landing
  { path: 'pricing', component: PricingComponent },     // Pricing pages
  { path: 'tenants', component: TenantDirectoryComponent }, // Find org
  
  // Mixed auth - public + admin features
  { path: 'contact', component: ContactComponent },     // Public contact
  { path: 'admin-signup', component: AdminSignupComponent }, // Landlord reg
  { path: 'tenant-apply', component: TenantApplyComponent }, // Tenant app
  
  // Tenant discovery
  { path: 'go/:tenantSlug', component: TenantRedirectComponent },
];
```

### **Option B: Inertia/Vue3 Public Admin** (ALTERNATIVE)

```
www.publicdigit.com → Inertia/Vue3 (Public Admin Portal)
```

**Contexts Required:**
1. **Platform Context** - Full access for admin features
2. **TenantAuth Context** - Admin authentication

**Implementation:**
```php
// Inertia routes for public admin features
Route::domain('www.publicdigit.com')->group(function () {
    // Public admin pages
    Route::get('/', function () {
        return inertia('Public/Home'); // Marketing + admin login
    });
    
    Route::get('/pricing', function () {
        return inertia('Public/Pricing');
    });
    
    // Admin registration/signup
    Route::get('/get-started', function () {
        return inertia('Public/GetStarted');
    });
});
```

## 🎯 RECOMMENDATION: **Angular Public Site**

### **Why Angular?**

1. **SEO Advantage** - Static marketing pages perform better
2. **Mobile-First** - Better PWA capabilities for marketing
3. **Consistent UX** - Same design system as tenant app
4. **Scalability** - CDN-friendly static content

### **Context Access Strategy:**

```php
// Special API routes for public site
Route::prefix('api/public')->group(function () {
    // READ-ONLY Platform Context
    Route::get('tenants', [PublicTenantController::class, 'index']);
    Route::get('platform-stats', [PublicStatsController::class, 'index']);
    
    // LIMITED TenantAuth Context  
    Route::post('contact', [PublicContactController::class, 'store']);
    Route::post('admin-signup', [PublicRegistrationController::class, 'admin']);
    Route::post('tenant-apply', [PublicRegistrationController::class, 'tenant']);
});
```

## 🔧 Implementation Plan

### **Step 1: Update Domain Configuration**

```php
// config/domains.php
return [
    'public' => [
        'domains' => [
            'www.publicdigit.com',
            'publicdigit.com', // Root domain
        ],
        'frontend' => 'angular-public',
        'purpose' => 'public_marketing_and_discovery',
        'database' => 'landlord', // READ-ONLY access
        'api_prefix' => '/api/public',
        'allowed_contexts' => ['Platform', 'TenantAuth'], // Limited access
    ],
    // ... existing configs
];
```

### **Step 2: Create Public API Routes**

```php
// routes/public-api.php
Route::prefix('api/public')->middleware('throttle:60,1')->group(function () {
    // Platform Context (READ-ONLY)
    Route::get('tenants', [PublicTenantController::class, 'index']);
    Route::get('tenants/{slug}', [PublicTenantController::class, 'show']);
    Route::get('stats/platform', [PublicStatsController::class, 'index']);
    
    // TenantAuth Context (LIMITED WRITE)
    Route::post('contact', [PublicContactController::class, 'store']);
    Route::post('admin-signup', [PublicRegistrationController::class, 'storeAdmin']);
    Route::post('tenant-apply', [PublicRegistrationController::class, 'storeTenantApplication']);
});
```

### **Step 3: Angular Public Feature Module**

```bash
# Generate public feature module in Angular
nx generate @nx/angular:library features/public --prefix=public
nx generate @nx/angular:component features/public/home --project=public
nx generate @nx/angular:component features/public/pricing --project=public
nx generate @nx/angular:component features/public/tenant-directory --project=public
```

### **Step 4: Route Configuration**

```typescript
// apps/mobile/src/app/features/public/public.routes.ts
export const publicRoutes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', component: HomePageComponent },
      { path: 'pricing', component: PricingComponent },
      { path: 'tenants', component: TenantDirectoryComponent },
      { path: 'contact', component: ContactComponent },
      { path: 'get-started', component: GetStartedComponent },
      { path: 'go/:tenantSlug', component: TenantRedirectComponent },
    ]
  }
];
```

## 🎯 Context Boundaries for www

### **Allowed Contexts:**
- ✅ **Platform Context** (READ-ONLY)
  - Tenant listings (name, slug, description)
  - Platform statistics (counts, metrics)
  - Public configuration

- ✅ **TenantAuth Context** (LIMITED)
  - Contact form submissions
  - Admin registration requests
  - Tenant application submissions

### **Prohibited Contexts:**
- ❌ **Membership Context** (Tenant DB access)
- ❌ **Election Context** (Tenant-specific data)
- ❌ **Finance Context** (Payment data)
- ❌ **Communication Context** (Forum data)

## 🔒 Security Considerations

### **Public API Middleware**
```php
// app/Http/Middleware/PublicApiAccess.php
public function handle($request, Closure $next)
{
    // Only allow from public domains
    $allowedDomains = config('domains.public.domains');
    if (!in_array($request->getHost(), $allowedDomains)) {
        abort(403, 'Public API access denied');
    }
    
    // Rate limiting already applied
    return $next($request);
}
```

### **Database Access Control**
```php
// Public controllers use READ-ONLY methods
class PublicTenantController extends Controller
{
    public function index()
    {
        // Only public fields, no sensitive data
        return Tenant::where('status', 'active')
            ->select(['id', 'slug', 'name', 'description', 'logo_url'])
            ->get();
    }
}
```

## 🚀 Final Recommendation

**Go with Angular Public Site because:**

1. **Marketing Focus** - Better for SEO and user acquisition
2. **Technical Consistency** - Same Angular skillset as tenant app
3. **Progressive Enhancement** - Can add admin features later
4. **Deployment Simplicity** - Same build process as tenant app

**Implementation Priority:**
1. Basic marketing pages (Home, Pricing, Contact)
2. Tenant directory and discovery
3. Admin/Tenant application forms
4. Public API with proper security

**This gives you a professional public presence while maintaining clean architecture boundaries.**
