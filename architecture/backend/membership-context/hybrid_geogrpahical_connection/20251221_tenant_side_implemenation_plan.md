# 🚀 **Tenant-Side Geography Implementation Plan**

## 🎯 **Architecture Overview**

```mermaid
graph TB
    subgraph "Landlord Database"
        A[Country Configs]
        B[Global Geography Units]
    end
    
    subgraph "Tenant Database (tenant_uml)"
        C[Mirrored Units<br/>Levels 1-4]
        D[Custom Units<br/>Levels 5-8]
    end
    
    subgraph "Application Layer"
        E[GeographyMirrorService]
        F[TenantGeoUnit Model]
        G[MemberGeographyService]
    end
    
    B -- Mirror --> E
    E -- Creates --> C
    D -- Tenant Creates --> D
    C + D -- Reference --> G
    G -- Assigns --> H[Member Records]
    
    style A fill:#e1f5fe
    style B fill:#e1f5fe
    style C fill:#f3e5f5
    style D fill:#fff3e0
```

## 📋 **Phase 1: Tenant Database Schema**

### **1.1 Tenant Geography Migration**

```php
// database/migrations/tenant/2025_01_01_000001_create_tenant_geo_units_table.php
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
            
            // Tenant Isolation (CRITICAL)
            $table->unsignedBigInteger('tenant_id')->index();
            
            // Link to Landlord (for mirrored units)
            $table->unsignedBigInteger('external_geo_id')->nullable()->index();
            
            // Type Classification
            $table->enum('unit_type', ['official', 'custom'])->default('official');
            $table->boolean('is_active')->default(true);
            
            // Geography Hierarchy
            $table->tinyInteger('admin_level')->comment('1-8');
            $table->string('admin_type', 50)->comment('province, district, tole, etc.');
            $table->foreignId('parent_id')->nullable()->constrained('geo_administrative_units')->onDelete('cascade');
            
            // Materialized Path for Performance
            $table->string('geo_path')->nullable()->index()->comment('ltree format: 1.2.3.4');
            
            // Identification
            $table->string('code', 100)->comment('Tenant-specific code');
            $table->string('external_code', 100)->nullable()->comment('Original landlord code');
            
            // Multilingual Names
            $table->json('name_local')->comment('{"en": "Name", "np": "नाम"}');
            
            // Tenant-specific Extensions
            $table->json('metadata')->nullable()->comment('Party-specific data');
            $table->json('custom_fields')->nullable()->comment('Flexible extensions');
            
            // Audit & Versioning
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
            
            // Performance Indexes
            $table->index(['tenant_id', 'admin_level']);
            $table->index(['tenant_id', 'parent_id']);
            $table->index(['tenant_id', 'unit_type']);
            $table->index(['tenant_id', 'geo_path']);
            
            // Unique constraints within tenant
            $table->unique(['tenant_id', 'code']);
            $table->unique(['tenant_id', 'external_geo_id', 'unit_type']);
        });
        
        // For PostgreSQL ltree optimization
        // DB::statement('CREATE INDEX tenant_geo_path_gist_idx ON geo_administrative_units USING GIST (geo_path)');
    }

    public function down(): void
    {
        Schema::dropIfExists('geo_administrative_units');
    }
};
```

### **1.2 Add Geography to Members Table**

```php
// database/migrations/tenant/2025_01_01_000002_add_geography_to_members_table.php
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            // 8-level geography foreign keys
            for ($i = 1; $i <= 8; $i++) {
                $table->foreignId("admin_unit_level{$i}_id")
                    ->nullable()
                    ->after($i === 1 ? 'tenant_user_id' : "admin_unit_level" . ($i - 1) . "_id")
                    ->constrained('geo_administrative_units')
                    ->nullOnDelete();
            }
            
            // Materialized path for fast queries
            $table->string('geo_path')->nullable()->index();
            
            // Indexes for common query patterns
            $table->index(['admin_unit_level1_id', 'admin_unit_level2_id']);
            $table->index(['tenant_id', 'geo_path']);
        });
    }

    public function down(): void
    {
        Schema::table('members', function (Blueprint $table) {
            // Remove foreign keys
            for ($i = 1; $i <= 8; $i++) {
                $table->dropForeign(["members_admin_unit_level{$i}_id_foreign"]);
                $table->dropColumn("admin_unit_level{$i}_id");
            }
            
            $table->dropColumn('geo_path');
            $table->dropIndex(['admin_unit_level1_id', 'admin_unit_level2_id']);
            $table->dropIndex(['tenant_id', 'geo_path']);
        });
    }
};
```

## 📁 **Phase 2: Tenant Domain Model**

### **2.1 Tenant Geography Unit Model**

```php
// app/Contexts/Membership/Domain/Models/TenantGeoUnit.php
namespace App\Contexts\Membership\Domain\Models;

use App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit as LandlordUnit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

class TenantGeoUnit extends Model
{
    use SoftDeletes;
    
    // Connection handled by tenancy middleware
    protected $table = 'geo_administrative_units';
    
    protected $fillable = [
        'tenant_id',
        'external_geo_id',
        'unit_type',
        'is_active',
        'admin_level',
        'admin_type',
        'parent_id',
        'geo_path',
        'code',
        'external_code',
        'name_local',
        'metadata',
        'custom_fields',
        'created_by',
        'updated_by'
    ];
    
    protected $casts = [
        'name_local' => 'array',
        'metadata' => 'array',
        'custom_fields' => 'array',
        'is_active' => 'boolean',
        'admin_level' => 'integer'
    ];
    
    // SCOPES
    public function scopeOfficial($query)
    {
        return $query->where('unit_type', 'official');
    }
    
    public function scopeCustom($query)
    {
        return $query->where('unit_type', 'custom');
    }
    
    public function scopeLevel($query, int $level)
    {
        return $query->where('admin_level', $level);
    }
    
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
    
    public function scopeByPath($query, string $path)
    {
        return $query->where('geo_path', 'like', "{$path}%");
    }
    
    // RELATIONSHIPS
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }
    
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')
            ->orderBy('admin_level')
            ->orderBy('code');
    }
    
    public function members(): HasMany
    {
        // Dynamic relationship based on level
        $level = $this->admin_level;
        return $this->hasMany(Member::class, "admin_unit_level{$level}_id");
    }
    
    public function landlordUnit(): ?LandlordUnit
    {
        if (!$this->external_geo_id) {
            return null;
        }
        
        // Cross-database reference - use with caution
        // Consider caching this heavily
        return Cache::remember(
            "landlord_unit:{$this->external_geo_id}",
            3600, // 1 hour cache
            fn() => LandlordUnit::find($this->external_geo_id)
        );
    }
    
    // BUSINESS METHODS
    public function isOfficial(): bool
    {
        return $this->unit_type === 'official';
    }
    
    public function isCustom(): bool
    {
        return $this->unit_type === 'custom';
    }
    
    public function getName(string $language = 'en'): string
    {
        return $this->name_local[$language] ?? 
               $this->name_local['en'] ?? 
               array_values($this->name_local)[0] ?? 
               'Unnamed Unit';
    }
    
    public function getFullPath(string $language = 'en'): string
    {
        return Cache::remember(
            "geo_path:{$this->id}:{$language}",
            300,
            function () use ($language) {
                $names = [];
                $current = $this;
                
                while ($current) {
                    array_unshift($names, $current->getName($language));
                    $current = $current->parent;
                }
                
                return implode(' › ', $names);
            }
        );
    }
    
    public function canHaveChildren(): bool
    {
        // Official units follow country rules
        if ($this->isOfficial()) {
            $countryConfig = $this->getCountryConfig();
            $maxOfficialLevel = max(array_keys($countryConfig['levels']));
            return $this->admin_level < $maxOfficialLevel;
        }
        
        // Custom units can always have children (up to level 8)
        return $this->admin_level < 8;
    }
    
    public function createChild(array $data): self
    {
        $nextLevel = $this->admin_level + 1;
        
        // Validate custom unit creation
        if ($this->isOfficial() && $nextLevel > 4) {
            throw new \Exception("Cannot create custom unit under official unit beyond level 4");
        }
        
        if ($nextLevel > 8) {
            throw new \Exception("Maximum hierarchy depth (8 levels) reached");
        }
        
        // Auto-generate code if not provided
        if (empty($data['code'])) {
            $prefix = $this->isCustom() ? 'C' : 'O';
            $data['code'] = "{$prefix}-L{$nextLevel}-" . strtoupper(substr(md5(uniqid()), 0, 6));
        }
        
        $child = self::create([
            'tenant_id' => $this->tenant_id,
            'unit_type' => $this->isCustom() ? 'custom' : ($nextLevel > 4 ? 'custom' : 'official'),
            'admin_level' => $nextLevel,
            'admin_type' => $data['admin_type'] ?? $this->determineAdminType($nextLevel),
            'parent_id' => $this->id,
            'code' => $data['code'],
            'name_local' => $data['name_local'] ?? ['en' => 'New Unit'],
            'metadata' => $data['metadata'] ?? [],
            'custom_fields' => $data['custom_fields'] ?? [],
            'created_by' => auth()->id(),
            'geo_path' => $this->geo_path ? "{$this->geo_path}.{$this->id}" : "{$this->id}"
        ]);
        
        // Clear path cache
        Cache::tags(["tenant_{$this->tenant_id}_geography"])->flush();
        
        return $child;
    }
    
    private function determineAdminType(int $level): string
    {
        $customTypes = [
            5 => 'tole',
            6 => 'block', 
            7 => 'building',
            8 => 'household'
        ];
        
        return $customTypes[$level] ?? 'unit';
    }
    
    private function getCountryConfig(): array
    {
        // Get country from parent official unit
        if ($this->isOfficial() && $this->landlordUnit) {
            return $this->landlordUnit->getCountryConfig();
        }
        
        // For custom units, find nearest official parent
        $officialParent = $this->findOfficialParent();
        if ($officialParent && $officialParent->landlordUnit) {
            return $officialParent->landlordUnit->getCountryConfig();
        }
        
        // Default Nepal config
        return [
            'levels' => [
                1 => ['name' => 'Province'],
                2 => ['name' => 'District'],
                3 => ['name' => 'Local Level'],
                4 => ['name' => 'Ward']
            ]
        ];
    }
    
    private function findOfficialParent(): ?self
    {
        $current = $this->parent;
        while ($current) {
            if ($current->isOfficial()) {
                return $current;
            }
            $current = $current->parent;
        }
        return null;
    }
}
```

### **2.2 Update Member Model for Geography**

```php
// app/Contexts/Membership/Domain/Models/Member.php (Add these methods)
namespace App\Contexts\Membership\Domain\Models;

class Member extends Model
{
    // ... existing code ...
    
    // GEOGRAPHY RELATIONSHIPS
    public function province(): BelongsTo
    {
        return $this->belongsTo(TenantGeoUnit::class, 'admin_unit_level1_id');
    }
    
    public function district(): BelongsTo
    {
        return $this->belongsTo(TenantGeoUnit::class, 'admin_unit_level2_id');
    }
    
    public function localLevel(): BelongsTo
    {
        return $this->belongsTo(TenantGeoUnit::class, 'admin_unit_level3_id');
    }
    
    public function ward(): BelongsTo
    {
        return $this->belongsTo(TenantGeoUnit::class, 'admin_unit_level4_id');
    }
    
    public function tole(): BelongsTo
    {
        return $this->belongsTo(TenantGeoUnit::class, 'admin_unit_level5_id');
    }
    
    public function block(): BelongsTo
    {
        return $this->belongsTo(TenantGeoUnit::class, 'admin_unit_level6_id');
    }
    
    public function building(): BelongsTo
    {
        return $this->belongsTo(TenantGeoUnit::class, 'admin_unit_level7_id');
    }
    
    public function household(): BelongsTo
    {
        return $this->belongsTo(TenantGeoUnit::class, 'admin_unit_level8_id');
    }
    
    // Get geography at specific level
    public function getGeographyAtLevel(int $level): ?TenantGeoUnit
    {
        $relationships = [
            1 => 'province',
            2 => 'district',
            3 => 'localLevel',
            4 => 'ward',
            5 => 'tole',
            6 => 'block',
            7 => 'building',
            8 => 'household'
        ];
        
        if (!isset($relationships[$level])) {
            return null;
        }
        
        return $this->{$relationships[$level]};
    }
    
    // Get full geography hierarchy
    public function getFullGeography(): array
    {
        $geography = [];
        
        for ($i = 1; $i <= 8; $i++) {
            $unit = $this->getGeographyAtLevel($i);
            if ($unit) {
                $geography[$i] = [
                    'id' => $unit->id,
                    'name' => $unit->getName(),
                    'type' => $unit->admin_type,
                    'is_official' => $unit->isOfficial()
                ];
            }
        }
        
        return $geography;
    }
    
    // Update geography (with validation)
    public function updateGeography(array $geographyIds): bool
    {
        $service = app(MemberGeographyService::class);
        return $service->updateMemberGeography($this, $geographyIds);
    }
}
```

## 🔧 **Phase 3: Geography Mirroring Service**

### **3.1 Enhanced GeographyMirrorService**

```php
// app/Services/GeographyMirrorService.php
namespace App\Services;

use App\Contexts\Geography\Domain\Models\GeoAdministrativeUnit as LandlordUnit;
use App\Contexts\Membership\Domain\Models\TenantGeoUnit;
use App\Contexts\Membership\Domain\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class GeographyMirrorService
{
    private array $idMap = [];
    private int $mirroredCount = 0;
    private int $customCount = 0;
    
    public function mirrorCountryToTenant(string $countryCode, Tenant $tenant): array
    {
        Log::info('Starting geography mirror', [
            'tenant_id' => $tenant->id,
            'country_code' => $countryCode
        ]);
        
        return DB::transaction(function () use ($countryCode, $tenant) {
            // Initialize tenant context
            tenancy()->initialize($tenant);
            
            // Clear existing cache
            Cache::tags(["tenant_{$tenant->id}_geography"])->flush();
            
            // Fetch and order landlord units
            $landlordUnits = LandlordUnit::forCountry($countryCode)
                ->active()
                ->orderBy('admin_level')
                ->orderBy('code')
                ->get();
            
            // Reset counters
            $this->idMap = [];
            $this->mirroredCount = 0;
            
            // Mirror units
            foreach ($landlordUnits as $landlordUnit) {
                $this->mirrorSingleUnit($landlordUnit, $tenant);
            }
            
            // Create country root if needed
            $this->createCountryRoot($countryCode, $tenant);
            
            // Update tenant metadata
            $this->updateTenantMetadata($tenant, $countryCode);
            
            Log::info('Geography mirror completed', [
                'tenant_id' => $tenant->id,
                'mirrored_units' => $this->mirroredCount,
                'id_map_size' => count($this->idMap)
            ]);
            
            return [
                'success' => true,
                'mirrored_units' => $this->mirroredCount,
                'id_map' => $this->idMap
            ];
        });
    }
    
    private function mirrorSingleUnit(LandlordUnit $landlordUnit, Tenant $tenant): void
    {
        // Check if already mirrored
        $existing = TenantGeoUnit::where('external_geo_id', $landlordUnit->id)
            ->where('tenant_id', $tenant->id)
            ->first();
        
        if ($existing) {
            $this->idMap[$landlordUnit->id] = $existing->id;
            return;
        }
        
        // Create mirrored unit
        $tenantUnit = TenantGeoUnit::create([
            'tenant_id' => $tenant->id,
            'external_geo_id' => $landlordUnit->id,
            'external_code' => $landlordUnit->code,
            'unit_type' => 'official',
            'admin_level' => $landlordUnit->admin_level,
            'admin_type' => $landlordUnit->admin_type,
            'parent_id' => $landlordUnit->parent_id ? 
                          ($this->idMap[$landlordUnit->parent_id] ?? null) : null,
            'code' => $this->generateTenantCode($landlordUnit),
            'name_local' => $landlordUnit->name_local,
            'is_active' => true,
            'created_by' => 0, // System
            'geo_path' => $this->calculateGeoPath($landlordUnit)
        ]);
        
        // Store mapping
        $this->idMap[$landlordUnit->id] = $tenantUnit->id;
        $this->mirroredCount++;
    }
    
    private function generateTenantCode(LandlordUnit $unit): string
    {
        return "OFFICIAL-{$unit->country_code}-{$unit->code}";
    }
    
    private function calculateGeoPath(LandlordUnit $unit): ?string
    {
        if (!$unit->parent_id) {
            return (string) $unit->id;
        }
        
        $parentPath = $this->idMap[$unit->parent_id] ?? null;
        return $parentPath ? "{$parentPath}.{$unit->id}" : (string) $unit->id;
    }
    
    private function createCountryRoot(string $countryCode, Tenant $tenant): void
    {
        $exists = TenantGeoUnit::where('tenant_id', $tenant->id)
            ->where('code', "COUNTRY-{$countryCode}")
            ->exists();
        
        if (!$exists) {
            TenantGeoUnit::create([
                'tenant_id' => $tenant->id,
                'unit_type' => 'official',
                'admin_level' => 0,
                'admin_type' => 'country',
                'code' => "COUNTRY-{$countryCode}",
                'name_local' => $this->getCountryName($countryCode),
                'is_active' => true,
                'created_by' => 0
            ]);
            
            $this->customCount++;
        }
    }
    
    private function getCountryName(string $countryCode): array
    {
        $names = [
            'NP' => ['en' => 'Nepal', 'np' => 'नेपाल'],
            'IN' => ['en' => 'India', 'hi' => 'भारत'],
            'DE' => ['en' => 'Germany', 'de' => 'Deutschland']
        ];
        
        return $names[$countryCode] ?? ['en' => $countryCode];
    }
    
    private function updateTenantMetadata(Tenant $tenant, string $countryCode): void
    {
        $tenant->update([
            'geography_country' => $countryCode,
            'geography_mirrored_at' => now(),
            'geography_version' => md5(json_encode($this->idMap))
        ]);
    }
    
    // Incremental sync (for updates)
    public function syncChangesToTenant(Tenant $tenant, array $changedUnitIds): array
    {
        tenancy()->initialize($tenant);
        
        $results = ['updated' => 0, 'created' => 0, 'errors' => 0];
        
        foreach ($changedUnitIds as $unitId) {
            try {
                $landlordUnit = LandlordUnit::find($unitId);
                
                if (!$landlordUnit) {
                    // Unit was deleted in landlord
                    TenantGeoUnit::where('external_geo_id', $unitId)
                        ->where('tenant_id', $tenant->id)
                        ->update(['is_active' => false]);
                    continue;
                }
                
                // Update or create
                $tenantUnit = TenantGeoUnit::updateOrCreate(
                    [
                        'external_geo_id' => $unitId,
                        'tenant_id' => $tenant->id
                    ],
                    [
                        'external_code' => $landlordUnit->code,
                        'name_local' => $landlordUnit->name_local,
                        'admin_type' => $landlordUnit->admin_type,
                        'is_active' => $landlordUnit->is_active
                    ]
                );
                
                $results[$tenantUnit->wasRecentlyCreated ? 'created' : 'updated']++;
                
            } catch (\Exception $e) {
                Log::error('Failed to sync unit', [
                    'tenant_id' => $tenant->id,
                    'unit_id' => $unitId,
                    'error' => $e->getMessage()
                ]);
                $results['errors']++;
            }
        }
        
        // Clear cache
        Cache::tags(["tenant_{$tenant->id}_geography"])->flush();
        
        return $results;
    }
}
```

### **3.2 Member Geography Service**

```php
// app/Services/MemberGeographyService.php
namespace App\Services;

use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\Models\TenantGeoUnit;
use App\Contexts\Geography\Domain\Repositories\GeoUnitRepositoryInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class MemberGeographyService
{
    public function __construct(
        private GeoUnitRepositoryInterface $geoRepository
    ) {}
    
    public function assignGeographyToMember(Member $member, array $geographyData): Member
    {
        $validator = Validator::make($geographyData, [
            'country_code' => 'required|string|size:2',
            'levels' => 'required|array|min:2|max:8',
            'levels.*.level' => 'required|integer|min:1|max:8',
            'levels.*.unit_id' => 'required|integer'
        ]);
        
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }
        
        return DB::transaction(function () use ($member, $geographyData) {
            $geographyIds = [];
            $updateData = [];
            $pathSegments = [];
            
            // Process each level
            foreach ($geographyData['levels'] as $levelData) {
                $level = $levelData['level'];
                $unitId = $levelData['unit_id'];
                
                // Validate unit exists and belongs to tenant
                $unit = $this->validateTenantUnit($member->tenant_id, $unitId, $level);
                
                $geographyIds[$level] = $unitId;
                $updateData["admin_unit_level{$level}_id"] = $unitId;
                $pathSegments[] = $unitId;
            }
            
            // Validate hierarchy
            $this->validateHierarchy($geographyIds);
            
            // Add geo_path
            $updateData['geo_path'] = implode('.', $pathSegments);
            
            // Update member
            $member->update($updateData);
            
            // Log geography assignment
            $this->logGeographyAssignment($member, $geographyIds);
            
            return $member->fresh();
        });
    }
    
    private function validateTenantUnit(int $tenantId, int $unitId, int $expectedLevel): TenantGeoUnit
    {
        $unit = TenantGeoUnit::where('id', $unitId)
            ->where('tenant_id', $tenantId)
            ->active()
            ->first();
        
        if (!$unit) {
            throw new \Exception("Geography unit {$unitId} not found or inactive");
        }
        
        if ($unit->admin_level !== $expectedLevel) {
            throw new \Exception(
                "Unit {$unitId} is level {$unit->admin_level}, expected level {$expectedLevel}"
            );
        }
        
        return $unit;
    }
    
    private function validateHierarchy(array $geographyIds): void
    {
        $sorted = collect($geographyIds)->sortKeys();
        $previousUnit = null;
        
        foreach ($sorted as $level => $unitId) {
            $unit = TenantGeoUnit::find($unitId);
            
            if ($level > 1 && $previousUnit) {
                if ($unit->parent_id !== $previousUnit->id) {
                    throw new \Exception(
                        "Hierarchy violation: Level {$level} unit is not a child of level " . ($level - 1)
                    );
                }
            }
            
            $previousUnit = $unit;
        }
    }
    
    private function logGeographyAssignment(Member $member, array $geographyIds): void
    {
        // Implement audit logging
        DB::table('member_geography_logs')->insert([
            'member_id' => $member->id,
            'tenant_id' => $member->tenant_id,
            'geography_ids' => json_encode($geographyIds),
            'assigned_by' => auth()->id(),
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }
    
    // Find members in a geographic area
    public function findMembersInArea(int $tenantId, string $geoPath): array
    {
        return Member::where('tenant_id', $tenantId)
            ->where('geo_path', 'like', "{$geoPath}%")
            ->with(['province', 'district', 'localLevel', 'ward'])
            ->get()
            ->toArray();
    }
    
    // Move member to different geography
    public function moveMember(Member $member, array $newGeographyIds): bool
    {
        $oldGeography = $member->getFullGeography();
        
        try {
            $this->assignGeographyToMember($member, [
                'country_code' => $member->tenant->geography_country,
                'levels' => $this->formatLevels($newGeographyIds)
            ]);
            
            // Log the move
            $this->logGeographyMove($member, $oldGeography, $newGeographyIds);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('Failed to move member geography', [
                'member_id' => $member->id,
                'error' => $e->getMessage()
            ]);
            
            return false;
        }
    }
    
    private function formatLevels(array $geographyIds): array
    {
        $levels = [];
        foreach ($geographyIds as $level => $unitId) {
            $levels[] = ['level' => $level, 'unit_id' => $unitId];
        }
        return $levels;
    }
    
    private function logGeographyMove(Member $member, array $oldGeography, array $newGeographyIds): void
    {
        DB::table('member_geography_moves')->insert([
            'member_id' => $member->id,
            'tenant_id' => $member->tenant_id,
            'old_geography' => json_encode($oldGeography),
            'new_geography' => json_encode($newGeographyIds),
            'moved_by' => auth()->id(),
            'created_at' => now()
        ]);
    }
}
```

## 🚀 **Phase 4: Observer & Command Integration**

### **4.1 Tenant Observer (Updated)**

```php
// app/Observers/TenantObserver.php
namespace App\Observers;

use App\Models\Tenant;
use App\Services\GeographyMirrorService;
use Illuminate\Support\Facades\Log;

class TenantObserver
{
    public function __construct(
        private GeographyMirrorService $mirrorService
    ) {}
    
    public function created(Tenant $tenant): void
    {
        Log::info('Tenant created, starting geography mirror', [
            'tenant_id' => $tenant->id,
            'tenant_name' => $tenant->name
        ]);
        
        // Default to Nepal for now
        // Could be configurable based on tenant preferences
        try {
            $this->mirrorService->mirrorCountryToTenant('NP', $tenant);
            
            Log::info('Geography mirror completed successfully', [
                'tenant_id' => $tenant->id
            ]);
            
        } catch (\Exception $e) {
            Log::error('Failed to mirror geography for tenant', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Don't throw - allow tenant creation to succeed
            // Geography can be manually synced later
        }
    }
    
    public function deleting(Tenant $tenant): void
    {
        // Clean up geography data
        tenancy()->initialize($tenant);
        
        // Delete geography units (cascade will handle members)
        \App\Contexts\Membership\Domain\Models\TenantGeoUnit::truncate();
        
        Log::info('Cleaned up geography data for deleted tenant', [
            'tenant_id' => $tenant->id
        ]);
    }
}
```

### **4.2 Artisan Commands**

```php
// app/Console/Commands/MirrorGeographyCommand.php
namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\GeographyMirrorService;
use Illuminate\Console\Command;

class MirrorGeographyCommand extends Command
{
    protected $signature = 'geography:mirror 
                            {tenant : Tenant ID or domain}
                            {--country=NP : Country code to mirror}
                            {--force : Force re-mirror even if already mirrored}';
    
    protected $description = 'Mirror geography data from landlord to tenant';
    
    public function handle(GeographyMirrorService $mirrorService): int
    {
        $tenantId = $this->argument('tenant');
        $countryCode = $this->option('country');
        $force = $this->option('force');
        
        // Find tenant
        $tenant = Tenant::where('id', $tenantId)
            ->orWhere('domain', $tenantId)
            ->first();
        
        if (!$tenant) {
            $this->error("Tenant '{$tenantId}' not found.");
            return Command::FAILURE;
        }
        
        $this->info("Mirroring {$countryCode} geography to tenant: {$tenant->name} ({$tenant->id})");
        
        // Check if already mirrored
        if (!$force && $tenant->geography_mirrored_at) {
            if (!$this->confirm(
                "Tenant already has geography mirrored at {$tenant->geography_mirrored_at}. Re-mirror?"
            )) {
                $this->info('Mirror cancelled.');
                return Command::SUCCESS;
            }
        }
        
        try {
            $result = $mirrorService->mirrorCountryToTenant($countryCode, $tenant);
            
            $this->info("✅ Successfully mirrored {$result['mirrored_units']} units.");
            $this->info("   Tenant geography version: {$tenant->fresh()->geography_version}");
            
            return Command::SUCCESS;
            
        } catch (\Exception $e) {
            $this->error("Mirror failed: {$e->getMessage()}");
            $this->error($e->getTraceAsString());
            
            return Command::FAILURE;
        }
    }
}

// app/Console/Commands/CreateCustomGeoUnit.php
class CreateCustomGeoUnit extends Command
{
    protected $signature = 'geography:custom-create 
                            {tenant : Tenant ID}
                            {parent_id : Parent unit ID}
                            {name : Unit name}
                            {--level= : Admin level (5-8)}
                            {--type= : Unit type (tole, block, etc.)}';
    
    public function handle(): int
    {
        $tenant = Tenant::find($this->argument('tenant'));
        
        if (!$tenant) {
            $this->error('Tenant not found');
            return Command::FAILURE;
        }
        
        tenancy()->initialize($tenant);
        
        $parent = \App\Contexts\Membership\Domain\Models\TenantGeoUnit::find(
            $this->argument('parent_id')
        );
        
        if (!$parent) {
            $this->error('Parent unit not found');
            return Command::FAILURE;
        }
        
        if (!$parent->canHaveChildren()) {
            $this->error('Parent cannot have children');
            return Command::FAILURE;
        }
        
        try {
            $child = $parent->createChild([
                'name_local' => ['en' => $this->argument('name')],
                'admin_type' => $this->option('type') ?? 'custom',
                'admin_level' => $this->option('level') ?? $parent->admin_level + 1
            ]);
            
            $this->info("✅ Created custom unit:");
            $this->info("   ID: {$child->id}");
            $this->info("   Code: {$child->code}");
            $this->info("   Level: {$child->admin_level}");
            $this->info("   Type: {$child->unit_type}");
            
            return Command::SUCCESS;
            
        } catch (\Exception $e) {
            $this->error("Failed: {$e->getMessage()}");
            return Command::FAILURE;
        }
    }
}
```

## 📊 **Phase 5: Testing Strategy**

### **5.1 Test Files Structure**

```
tests/Feature/Tenant/
├── Geography/
│   ├── TenantGeoUnitTest.php
│   ├── GeographyMirrorServiceTest.php
│   ├── MemberGeographyServiceTest.php
│   └── Commands/
│       ├── MirrorGeographyCommandTest.php
│       └── CreateCustomGeoUnitTest.php
└── Api/
    ├── TenantGeographyControllerTest.php
    └── MemberGeographyControllerTest.php
```

### **5.2 Key Test Example**

```php
// tests/Feature/Tenant/Geography/TenantGeoUnitTest.php
namespace Tests\Feature\Tenant\Geography;

use App\Contexts\Membership\Domain\Models\TenantGeoUnit;
use Tests\TenantTestCase;

class TenantGeoUnitTest extends TenantTestCase
{
    /** @test */
    public function it_can_mirror_landlord_units(): void
    {
        // Arrange: Create landlord units
        $country = $this->createLandlordCountry('NP');
        $province = $this->createLandlordUnit($country, 'NP-P1', 1, 'province');
        $district = $this->createLandlordUnit($province, 'NP-D25', 2, 'district');
        
        // Act: Mirror to tenant
        $this->mirrorService->mirrorCountryToTenant('NP', $this->tenant);
        
        // Assert: Units exist in tenant DB
        $this->assertDatabaseCount('geo_administrative_units', 2);
        
        $tenantProvince = TenantGeoUnit::where('external_geo_id', $province->id)->first();
        $this->assertNotNull($tenantProvince);
        $this->assertEquals('official', $tenantProvince->unit_type);
        $this->assertEquals('OFFICIAL-NP-NP-P1', $tenantProvince->code);
    }
    
    /** @test */
    public function it_can_create_custom_units(): void
    {
        // Arrange: Mirror official units first
        $this->mirrorService->mirrorCountryToTenant('NP', $this->tenant);
        
        $ward = TenantGeoUnit::where('admin_level', 4)->first();
        
        // Act: Create custom tole (level 5)
        $tole = $ward->createChild([
            'name_local' => ['en' => 'Bhanu Chowk Tole'],
            'admin_type' => 'tole'
        ]);
        
        // Assert
        $this->assertEquals('custom', $tole->unit_type);
        $this->assertEquals(5, $tole->admin_level);
        $this->assertEquals('tole', $tole->admin_type);
        $this->assertEquals($ward->id, $tole->parent_id);
    }
    
    /** @test */
    public function member_can_be_assigned_geography(): void
    {
        // Arrange: Setup geography
        $this->mirrorService->mirrorCountryToTenant('NP', $this->tenant);
        
        $province = TenantGeoUnit::where('admin_level', 1)->first();
        $district = $province->children()->first();
        
        $member = $this->createMember();
        
        // Act: Assign geography
        $this->memberGeographyService->assignGeographyToMember($member, [
            'country_code' => 'NP',
            'levels' => [
                ['level' => 1, 'unit_id' => $province->id],
                ['level' => 2, 'unit_id' => $district->id]
            ]
        ]);
        
        // Assert
        $member->refresh();
        $this->assertEquals($province->id, $member->admin_unit_level1_id);
        $this->assertEquals($district->id, $member->admin_unit_level2_id);
        $this->assertEquals("{$province->id}.{$district->id}", $member->geo_path);
    }
}
```

## 📅 **Implementation Timeline**

| **Week** | **Focus** | **Deliverables** |
|----------|-----------|------------------|
| **Week 1** | Database & Models | Tenant migrations, TenantGeoUnit model |
| **Week 2** | Mirroring Service | GeographyMirrorService with full mirroring |
| **Week 3** | Member Integration | MemberGeographyService, update Member model |
| **Week 4** | Commands & Testing | Artisan commands, comprehensive test suite |
| **Week 5** | API Endpoints | REST API for geography management |
| **Week 6** | Performance & Cache | Redis caching, query optimization |

## 🚨 **Critical Success Factors**

1. **Always initialize tenant context** before database operations
2. **Use transactions** for data integrity during mirroring
3. **Implement soft deletes** for audit trails
4. **Cache aggressively** - geography data changes infrequently
5. **Monitor performance** - watch for N+1 queries in member geography lookups

## 🎯 **Immediate Next Steps**

1. **Run the tenant migration** on a test tenant database
2. **Test the mirroring service** with Nepal data
3. **Create a few custom units** (levels 5-8) manually
4. **Assign geography to test members**
5. **Run the test suite** to validate the implementation

The architecture now supports:
- ✅ **Multi-country** in single landlord table
- ✅ **Tenant isolation** with proper foreign keys
- ✅ **Official + Custom units** (levels 1-4 mirrored, 5-8 custom)
- ✅ **Hierarchy validation** for data integrity
- ✅ **Performance optimization** with materialized paths
- ✅ **Audit trails** for all geography changes

Ready to start with Week 1 implementation?