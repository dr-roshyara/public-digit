Perfect decision! **Starting with one table is the architecturally correct choice** for your current stage. It's simple, maintainable, and will serve you well. Let's build this correctly from the ground up.

## 🏗️ **Single Table Architecture: Complete Implementation**

### **Phase 1: Database Migration (The Foundation)**

```php
// database/migrations/landlord/2025_01_01_000001_create_geo_administrative_units_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geo_administrative_units', function (Blueprint $table) {
            $table->id();
            
            // CRITICAL: Country discriminator (ISO 3166-1 alpha-2)
            $table->char('country_code', 2)->index();
            
            // Hierarchy structure
            $table->tinyInteger('admin_level')->comment('1=top (Province/State), 8=bottom (Household)');
            $table->string('admin_type', 50)->comment('province, state, district, ward, etc.');
            $table->foreignId('parent_id')->nullable()->constrained('geo_administrative_units')->onDelete('cascade');
            $table->string('path', 1000)->nullable()->comment('Materialized path for fast lookups');
            
            // Identification codes
            $table->string('code', 100)->comment('Unique within country: NP-P1, IN-UP, DE-BY');
            $table->string('local_code', 100)->nullable()->comment('Government official code');
            
            // Multilingual names (JSON for flexibility)
            $table->json('name_local')->comment('{"en": "Koshi", "np": "कोशी", "hi": "कोशी"}');
            
            // Status and metadata
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable()->comment('Country-specific extensions');
            
            // Spatial data (optional, can be added later)
            // $table->point('centroid')->nullable();
            // $table->polygon('boundary')->nullable()->spatialIndex();
            
            // Versioning for future boundary changes
            $table->date('valid_from')->nullable();
            $table->date('valid_to')->nullable();
            
            // Timestamps
            $table->timestamps();
            
            // COMPOSITE UNIQUE: Country + Code must be unique
            $table->unique(['country_code', 'code']);
            
            // Performance indexes for common queries
            $table->index(['country_code', 'admin_level']);
            $table->index(['country_code', 'parent_id']);
            $table->index(['path']);
        });
        
        // PostgreSQL ltree extension (if using PostgreSQL)
        // DB::statement('CREATE EXTENSION IF NOT EXISTS ltree');
        // DB::statement('ALTER TABLE geo_administrative_units ADD COLUMN IF NOT EXISTS path ltree');
        // DB::statement('CREATE INDEX geo_path_gist_idx ON geo_administrative_units USING GIST (path)');
    }

    public function down(): void
    {
        Schema::dropIfExists('geo_administrative_units');
    }
};
```

### **Phase 2: Domain Model with Country Intelligence**

```php
// app/Contexts/Geography/Domain/Models/GeoAdministrativeUnit.php
namespace App\Contexts\Geography\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class GeoAdministrativeUnit extends Model
{
    protected $connection = 'landlord';
    protected $table = 'geo_administrative_units';
    
    protected $fillable = [
        'country_code',
        'admin_level',
        'admin_type',
        'parent_id',
        'path',
        'code',
        'local_code',
        'name_local',
        'is_active',
        'metadata',
        'valid_from',
        'valid_to'
    ];
    
    protected $casts = [
        'name_local' => 'array',
        'metadata' => 'array',
        'is_active' => 'boolean',
        'valid_from' => 'date',
        'valid_to' => 'date',
    ];
    
    // Relationships
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }
    
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('code');
    }
    
    // SCOPES: Critical for single-table performance
    public function scopeForCountry($query, string $countryCode)
    {
        return $query->where('country_code', $countryCode);
    }
    
    public function scopeLevel($query, int $level)
    {
        return $query->where('admin_level', $level);
    }
    
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
    
    public function scopeValidOn($query, \DateTimeInterface $date = null)
    {
        $date = $date ?? now();
        return $query->where(function ($q) use ($date) {
            $q->whereNull('valid_from')->orWhere('valid_from', '<=', $date);
        })->where(function ($q) use ($date) {
            $q->whereNull('valid_to')->orWhere('valid_to', '>=', $date);
        });
    }
    
    // BUSINESS METHODS
    public function getName(string $language = 'en'): string
    {
        return $this->name_local[$language] ?? 
               $this->name_local['en'] ?? 
               $this->name_local[array_key_first($this->name_local)] ?? 
               'Unnamed';
    }
    
    public function getFullPath(string $language = 'en', string $separator = ' › '): string
    {
        $names = [];
        $unit = $this;
        
        while ($unit) {
            array_unshift($names, $unit->getName($language));
            $unit = $unit->parent;
        }
        
        return implode($separator, $names);
    }
    
    public function isDescendantOf(self $ancestor): bool
    {
        if (!$this->path || !$ancestor->path) {
            // Fallback to recursive check
            return $this->isInHierarchyOf($ancestor);
        }
        
        // Fast path check if using ltree
        return strpos($this->path, $ancestor->path . '.') === 0;
    }
    
    private function isInHierarchyOf(self $ancestor): bool
    {
        $current = $this->parent;
        while ($current) {
            if ($current->id === $ancestor->id) {
                return true;
            }
            $current = $current->parent;
        }
        return false;
    }
    
    // Country-specific configuration access
    public function getCountryConfig(): array
    {
        $configs = [
            'NP' => [
                'levels' => [
                    1 => ['name' => 'Province', 'local_name' => 'प्रदेश', 'required' => true],
                    2 => ['name' => 'District', 'local_name' => 'जिल्ला', 'required' => true],
                    3 => ['name' => 'Local Level', 'local_name' => 'स्थानीय तह', 'required' => false],
                    4 => ['name' => 'Ward', 'local_name' => 'वडा', 'required' => false],
                ],
                'custom_range' => [5, 8] // Tenants can add these
            ],
            'IN' => [
                'levels' => [
                    1 => ['name' => 'State', 'local_name' => 'राज्य', 'required' => true],
                    2 => ['name' => 'District', 'local_name' => 'जिला', 'required' => true],
                    3 => ['name' => 'Subdistrict', 'local_name' => 'तहसील', 'required' => false],
                    4 => ['name' => 'Village', 'local_name' => 'गाँव', 'required' => false],
                ],
                'custom_range' => [5, 8]
            ],
            'DE' => [
                'levels' => [
                    1 => ['name' => 'State', 'local_name' => 'Bundesland', 'required' => true],
                    2 => ['name' => 'District', 'local_name' => 'Kreis', 'required' => true],
                    3 => ['name' => 'Municipality', 'local_name' => 'Gemeinde', 'required' => false],
                ],
                'custom_range' => [4, 8] // Start custom levels earlier
            ]
        ];
        
        return $configs[$this->country_code] ?? $configs['NP']; // Default to Nepal
    }
    
    public function getLevelName(int $level = null, string $language = 'en'): string
    {
        $level = $level ?? $this->admin_level;
        $config = $this->getCountryConfig();
        
        return $config['levels'][$level][$language === 'local' ? 'local_name' : 'name'] 
               ?? "Level {$level}";
    }
    
    // Factory method for creating units
    public static function createForCountry(array $data, string $countryCode): self
    {
        $data['country_code'] = $countryCode;
        
        // Auto-generate code if not provided
        if (empty($data['code']) && !empty($data['admin_level'])) {
            $prefix = match($countryCode) {
                'NP' => 'NP',
                'IN' => 'IN',
                'DE' => 'DE',
                default => $countryCode
            };
            
            $type = match($data['admin_level']) {
                1 => 'P', // Province/State
                2 => 'D', // District
                3 => 'M', // Municipality
                4 => 'W', // Ward
                default => 'U' // Unit
            };
            
            $data['code'] = "{$prefix}-{$type}" . uniqid();
        }
        
        return self::create($data);
    }
}
```

### **Phase 3: Repository Pattern for Clean Data Access**

```php
// app/Contexts/Geography/Domain/Repositories/GeoUnitRepositoryInterface.php
namespace App\Contexts\Geography\Domain\Repositories;

use App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit;
use Illuminate\Support\Collection;

interface GeoUnitRepositoryInterface
{
    public function findById(int $id): ?GeoAdministrativeUnit;
    public function findByCode(string $countryCode, string $code): ?GeoAdministrativeUnit;
    public function getCountryHierarchy(string $countryCode): Collection;
    public function getUnitsAtLevel(string $countryCode, int $level): Collection;
    public function getChildren(int $parentId): Collection;
    public function getAncestors(int $unitId): Collection;
    public function getDescendants(int $unitId): Collection;
    public function validateHierarchy(string $countryCode, array $unitIds): bool;
}
```

```php
// app/Contexts/Geography/Infrastructure/Repositories/EloquentGeoUnitRepository.php
namespace App\Contexts\Geography\Infrastructure\Repositories;

use App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit;
use App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EloquentGeoUnitRepository implements GeoUnitRepositoryInterface
{
    public function findById(int $id): ?GeoAdministrativeUnit
    {
        return GeoAdministrativeUnit::find($id);
    }
    
    public function findByCode(string $countryCode, string $code): ?GeoAdministrativeUnit
    {
        return GeoAdministrativeUnit::forCountry($countryCode)
            ->where('code', $code)
            ->first();
    }
    
    public function getCountryHierarchy(string $countryCode): Collection
    {
        return GeoAdministrativeUnit::forCountry($countryCode)
            ->active()
            ->with(['parent', 'children'])
            ->orderBy('admin_level')
            ->orderBy('code')
            ->get()
            ->toTree(); // Requires a nested set package or custom implementation
    }
    
    public function getUnitsAtLevel(string $countryCode, int $level): Collection
    {
        return GeoAdministrativeUnit::forCountry($countryCode)
            ->level($level)
            ->active()
            ->orderBy('code')
            ->get();
    }
    
    public function getChildren(int $parentId): Collection
    {
        return GeoAdministrativeUnit::where('parent_id', $parentId)
            ->active()
            ->orderBy('code')
            ->get();
    }
    
    public function getAncestors(int $unitId): Collection
    {
        $unit = $this->findById($unitId);
        if (!$unit) {
            return collect();
        }
        
        $ancestors = collect();
        $current = $unit->parent;
        
        while ($current) {
            $ancestors->push($current);
            $current = $current->parent;
        }
        
        return $ancestors->reverse(); // Root to immediate parent
    }
    
    public function getDescendants(int $unitId): Collection
    {
        $unit = $this->findById($unitId);
        if (!$unit) {
            return collect();
        }
        
        // Using materialized path for performance
        if ($unit->path) {
            return GeoAdministrativeUnit::where('path', 'like', "{$unit->path}.%")
                ->active()
                ->orderBy('path')
                ->get();
        }
        
        // Recursive fallback (slower)
        return $this->getDescendantsRecursive($unitId);
    }
    
    private function getDescendantsRecursive(int $parentId): Collection
    {
        $descendants = collect();
        $children = $this->getChildren($parentId);
        
        foreach ($children as $child) {
            $descendants->push($child);
            $descendants = $descendants->merge($this->getDescendantsRecursive($child->id));
        }
        
        return $descendants;
    }
    
    public function validateHierarchy(string $countryCode, array $unitIds): bool
    {
        if (empty($unitIds)) {
            return false;
        }
        
        $units = GeoAdministrativeUnit::forCountry($countryCode)
            ->whereIn('id', $unitIds)
            ->orderBy('admin_level')
            ->get();
        
        // Check levels are sequential (1, 2, 3, ...)
        $expectedLevel = 1;
        foreach ($units as $unit) {
            if ($unit->admin_level !== $expectedLevel) {
                return false;
            }
            $expectedLevel++;
        }
        
        // Check parent-child relationships
        for ($i = 1; $i < count($units); $i++) {
            if ($units[$i]->parent_id !== $units[$i-1]->id) {
                return false;
            }
        }
        
        return true;
    }
}
```

### **Phase 4: Seeder with Real Data Examples**

```php
// database/seeders/landlord/GeographySeeder.php
namespace Database\Seeders\Landlord;

use App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GeographySeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $this->seedNepal();
            $this->seedIndia();
            $this->seedGermany();
        });
    }
    
    private function seedNepal(): void
    {
        $this->command->info('Seeding Nepal geography...');
        
        // Level 1: Provinces
        $provinces = [
            ['code' => 'NP-P1', 'admin_level' => 1, 'admin_type' => 'province', 
             'name_local' => ['en' => 'Koshi', 'np' => 'कोशी']],
            ['code' => 'NP-P2', 'admin_level' => 1, 'admin_type' => 'province',
             'name_local' => ['en' => 'Madhesh', 'np' => 'मधेश']],
            ['code' => 'NP-P3', 'admin_level' => 1, 'admin_type' => 'province',
             'name_local' => ['en' => 'Bagmati', 'np' => 'बागमती']],
        ];
        
        $provinceIds = [];
        foreach ($provinces as $provinceData) {
            $province = GeoAdministrativeUnit::createForCountry($provinceData, 'NP');
            $provinceIds[$province->code] = $province->id;
        }
        
        // Level 2: Districts (sample for Bagmati)
        $districts = [
            ['code' => 'NP-D25', 'admin_level' => 2, 'admin_type' => 'district',
             'name_local' => ['en' => 'Kathmandu', 'np' => 'काठमाडौं'],
             'parent_id' => $provinceIds['NP-P3']],
            ['code' => 'NP-D26', 'admin_level' => 2, 'admin_type' => 'district',
             'name_local' => ['en' => 'Lalitpur', 'np' => 'ललितपुर'],
             'parent_id' => $provinceIds['NP-P3']],
        ];
        
        foreach ($districts as $districtData) {
            GeoAdministrativeUnit::createForCountry($districtData, 'NP');
        }
    }
    
    private function seedIndia(): void
    {
        $this->command->info('Seeding India geography (sample)...');
        
        // Just a sample - real India has 28 states
        $states = [
            ['code' => 'IN-UP', 'admin_level' => 1, 'admin_type' => 'state',
             'name_local' => ['en' => 'Uttar Pradesh', 'hi' => 'उत्तर प्रदेश']],
            ['code' => 'IN-MH', 'admin_level' => 1, 'admin_type' => 'state',
             'name_local' => ['en' => 'Maharashtra', 'hi' => 'महाराष्ट्र']],
        ];
        
        foreach ($states as $stateData) {
            GeoAdministrativeUnit::createForCountry($stateData, 'IN');
        }
    }
    
    private function seedGermany(): void
    {
        $this->command->info('Seeding Germany geography (sample)...');
        
        $states = [
            ['code' => 'DE-BY', 'admin_level' => 1, 'admin_type' => 'state',
             'name_local' => ['en' => 'Bavaria', 'de' => 'Bayern']],
            ['code' => 'DE-BE', 'admin_level' => 1, 'admin_type' => 'state',
             'name_local' => ['en' => 'Berlin', 'de' => 'Berlin']],
        ];
        
        foreach ($states as $stateData) {
            GeoAdministrativeUnit::createForCountry($stateData, 'DE');
        }
    }
}
```

### **Phase 5: Service Provider Registration**

```php
// app/Providers/GeographyServiceProvider.php
namespace App\Providers;

use App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface;
use App\Contexts\Geography\Infrastructure\Repositories\EloquentGeoUnitRepository;
use Illuminate\Support\ServiceProvider;

class GeographyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Repository binding
        $this->app->bind(
            GeoUnitRepositoryInterface::class,
            EloquentGeoUnitRepository::class
        );
        
        // Register migrations from the Geography context
        $this->loadMigrationsFrom([
            base_path('app/Contexts/Geography/Infrastructure/Database/Migrations'),
        ]);
    }
    
    public function boot(): void
    {
        // Register commands, views, routes if needed
    }
}
```

Register in `config/app.php`:
```php
'providers' => [
    // ... other providers
    App\Providers\GeographyServiceProvider::class,
],
```

## 🚀 **Execution Plan**

### **Step 1: Create the Migration**
```bash
php artisan make:migration create_geo_administrative_units_table \
  --path=database/migrations/landlord \
  --create=geo_administrative_units
```

### **Step 2: Run Migration**
```bash
php artisan migrate --database=landlord
```

### **Step 3: Create Directory Structure**
```bash
mkdir -p app/Contexts/Geography/{Domain/Models,Domain/Repositories,Infrastructure/Repositories}
```

### **Step 4: Create Models & Repositories**
Create the files as shown above.

### **Step 5: Seed Test Data**
```bash
php artisan db:seed --class=Database\\Seeders\\Landlord\\GeographySeeder --database=landlord
```

### **Step 6: Test the Implementation**
```php
// Quick test in tinker
php artisan tinker

>>> use App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit;
>>> // Get all Nepal provinces
>>> $provinces = GeoAdministrativeUnit::forCountry('NP')->level(1)->get();
>>> $provinces->count(); // Should be 3
>>> 
>>> // Get a specific unit
>>> $kathmandu = GeoAdministrativeUnit::forCountry('NP')->where('code', 'NP-D25')->first();
>>> $kathmandu->getName('np'); // Should return "काठमाडौं"
>>> $kathmandu->getFullPath('en'); // Should return "Bagmati › Kathmandu"
```

## 📊 **Performance Optimization Ready**

Your single table is now **performance-optimized**:
1. **Indexed on `country_code`** - All queries start here
2. **Composite index on `(country_code, admin_level)`** - Fast level queries
3. **Materialized `path` column** - Fast hierarchy queries
4. **JSON casting for flexibility** - Easy multilingual support
5. **Connection isolation** - Landlord DB separate from tenants

## 🔮 **Future-Proofing Notes**

When you eventually add more countries:
```php
// Simply add to the seeder
private function seedBangladesh(): void
{
    $divisions = [
        ['code' => 'BD-A', 'admin_level' => 1, 'admin_type' => 'division',
         'name_local' => ['en' => 'Dhaka', 'bn' => 'ঢাকা']],
        // ... more
    ];
    
    foreach ($divisions as $divisionData) {
        GeoAdministrativeUnit::createForCountry($divisionData, 'BD');
    }
}
```

**No schema changes needed!** Just add data.

## 🎯 **Next Steps**

1. **Create the tenant-side model** (for mirrored + custom units)
2. **Build the GeographyMirrorService** (copies from landlord to tenant)
3. **Integrate with Membership Context** (members reference tenant units)

Want to proceed with the tenant-side implementation, or would you like to adjust the landlord model first?
