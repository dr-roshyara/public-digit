# 🚀 **PHASE 5: CQRS READ MODELS FOR DASHBOARDS**

## **📁 ARCHITECTURE OVERVIEW**

```
CQRS Pattern Goals:
1. Separate read and write models
2. Optimize queries for dashboards
3. Create denormalized views for reporting
4. Handle eventual consistency
5. Support real-time analytics
```

---

## **STEP 5.1: READ MODEL ARCHITECTURE**

### **5.1.1 Create Read Model Directories**

```bash
mkdir -p app/Contexts/Membership/ReadModels
mkdir -p app/Contexts/Membership/Infrastructure/ReadModels
mkdir -p tests/Unit/Contexts/Membership/ReadModels
mkdir -p tests/Feature/Contexts/Membership/ReadModels
```

### **5.1.2 Read Model Interfaces**

```php
<?php

// app/Contexts/Membership/ReadModels/MemberReadModelInterface.php

namespace App\Contexts\Membership\ReadModels;

interface MemberReadModelInterface
{
    public function find(string $id): ?array;
    
    public function findByMembershipNumber(string $membershipNumber): ?array;
    
    public function search(array $filters, int $limit = 50, int $offset = 0): array;
    
    public function count(array $filters): int;
    
    public function getStatistics(array $filters): array;
    
    public function getGeographyDistribution(array $filters): array;
    
    public function getStatusSummary(array $filters): array;
    
    public function getGrowthTrend(string $period = 'monthly', int $months = 12): array;
    
    public function getCommitteeReport(int $committeeMemberId, array $filters = []): array;
}
```

```php
<?php

// app/Contexts/Membership/ReadModels/ProjectionInterface.php

namespace App\Contexts\Membership\ReadModels;

interface ProjectionInterface
{
    public function projectMemberCreated(array $eventData): void;
    
    public function projectMemberStatusChanged(array $eventData): void;
    
    public function projectMemberGeographyEnriched(array $eventData): void;
    
    public function rebuild(): void;
    
    public function getLastProcessedEventId(): ?string;
}
```

---

## **STEP 5.2: MEMBER SUMMARY PROJECTION**

### **5.2.1 MemberSummary Read Model**

```php
<?php

// app/Contexts/Membership/Infrastructure/ReadModels/EloquentMemberSummary.php

namespace App\Contexts\Membership\Infrastructure\ReadModels;

use App\Contexts\Membership\ReadModels\MemberReadModelInterface;
use App\Contexts\Membership\Infrastructure\Database\Models\MemberSummaryModel;
use Illuminate\Support\Facades\DB;

class EloquentMemberSummary implements MemberReadModelInterface
{
    public function find(string $id): ?array
    {
        $model = MemberSummaryModel::find($id);
        
        if (!$model) {
            return null;
        }
        
        return $this->formatResult($model);
    }
    
    public function findByMembershipNumber(string $membershipNumber): ?array
    {
        $model = MemberSummaryModel::where('membership_number', $membershipNumber)->first();
        
        if (!$model) {
            return null;
        }
        
        return $this->formatResult($model);
    }
    
    public function search(array $filters, int $limit = 50, int $offset = 0): array
    {
        $query = MemberSummaryModel::query();
        
        // Apply filters
        $this->applyFilters($query, $filters);
        
        // Apply sorting
        $sortBy = $filters['sort_by'] ?? 'created_at';
        $sortOrder = $filters['sort_order'] ?? 'desc';
        $query->orderBy($sortBy, $sortOrder);
        
        // Paginate
        $models = $query->limit($limit)->offset($offset)->get();
        
        return $models->map(function ($model) {
            return $this->formatResult($model);
        })->all();
    }
    
    public function count(array $filters): int
    {
        $query = MemberSummaryModel::query();
        $this->applyFilters($query, $filters);
        
        return $query->count();
    }
    
    public function getStatistics(array $filters): array
    {
        $query = MemberSummaryModel::query();
        $this->applyFilters($query, $filters);
        
        return [
            'total' => $query->count(),
            'active' => $query->where('status', 'active')->count(),
            'pending' => $query->where('status', 'pending')->count(),
            'approved' => $query->where('status', 'approved')->count(),
            'suspended' => $query->where('status', 'suspended')->count(),
            'by_type' => $query->groupBy('membership_type')
                ->select('membership_type', DB::raw('count(*) as count'))
                ->pluck('count', 'membership_type')
                ->toArray(),
            'by_geography_tier' => $query->groupBy('geography_tier')
                ->select('geography_tier', DB::raw('count(*) as count'))
                ->pluck('count', 'geography_tier')
                ->toArray(),
        ];
    }
    
    public function getGeographyDistribution(array $filters): array
    {
        $query = MemberSummaryModel::query();
        $this->applyFilters($query, $filters);
        
        $provinceDistribution = $query->whereNotNull('province_id')
            ->groupBy('province_id', 'province_name')
            ->select('province_id', 'province_name', DB::raw('count(*) as count'))
            ->orderBy('count', 'desc')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->province_id,
                    'name' => $item->province_name,
                    'count' => $item->count,
                ];
            })
            ->all();
        
        $districtDistribution = $query->whereNotNull('district_id')
            ->groupBy('district_id', 'district_name')
            ->select('district_id', 'district_name', DB::raw('count(*) as count'))
            ->orderBy('count', 'desc')
            ->limit(20)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->district_id,
                    'name' => $item->district_name,
                    'count' => $item->count,
                ];
            })
            ->all();
        
        return [
            'provinces' => $provinceDistribution,
            'districts' => $districtDistribution,
            'geography_coverage' => [
                'with_geography' => $query->where('geography_tier', '!=', 'none')->count(),
                'without_geography' => $query->where('geography_tier', 'none')->count(),
                'advanced_geography' => $query->where('geography_tier', 'advanced')->count(),
            ],
        ];
    }
    
    public function getStatusSummary(array $filters): array
    {
        $query = MemberSummaryModel::query();
        $this->applyFilters($query, $filters);
        
        $statusSummary = $query->groupBy('status')
            ->select('status', DB::raw('count(*) as count'))
            ->pluck('count', 'status')
            ->toArray();
        
        // Calculate percentages
        $total = array_sum($statusSummary);
        $percentages = [];
        
        foreach ($statusSummary as $status => $count) {
            $percentages[$status] = $total > 0 ? round(($count / $total) * 100, 2) : 0;
        }
        
        return [
            'counts' => $statusSummary,
            'percentages' => $percentages,
            'total' => $total,
        ];
    }
    
    public function getGrowthTrend(string $period = 'monthly', int $months = 12): array
    {
        $endDate = now();
        $startDate = now()->subMonths($months);
        
        if ($period === 'daily') {
            $format = 'YYYY-MM-DD';
            $interval = '1 day';
        } elseif ($period === 'weekly') {
            $format = 'IYYY-IW';
            $interval = '1 week';
        } else {
            $format = 'YYYY-MM';
            $interval = '1 month';
        }
        
        // Raw SQL for date grouping
        $trendData = DB::table('member_summaries')
            ->select(
                DB::raw("to_char(created_at, '{$format}') as period"),
                DB::raw('count(*) as new_members'),
                DB::raw("sum(case when status = 'active' then 1 else 0 end) as active_members")
            )
            ->where('created_at', '>=', $startDate)
            ->where('created_at', '<=', $endDate)
            ->groupBy('period')
            ->orderBy('period')
            ->get();
        
        return [
            'period' => $period,
            'data' => $trendData->map(function ($item) {
                return [
                    'period' => $item->period,
                    'new_members' => (int) $item->new_members,
                    'active_members' => (int) $item->active_members,
                ];
            })->all(),
            'total_new' => $trendData->sum('new_members'),
            'total_active' => $trendData->sum('active_members'),
        ];
    }
    
    public function getCommitteeReport(int $committeeMemberId, array $filters = []): array
    {
        // This would integrate with Committee context
        // For now, return sponsor-based report
        
        $query = MemberSummaryModel::where('sponsor_id', $committeeMemberId);
        $this->applyFilters($query, $filters);
        
        $sponsored = $query->get();
        
        return [
            'committee_member_id' => $committeeMemberId,
            'total_sponsored' => $sponsored->count(),
            'active_sponsored' => $sponsored->where('status', 'active')->count(),
            'sponsored_by_status' => $sponsored->groupBy('status')
                ->map(function ($group) {
                    return $group->count();
                })
                ->toArray(),
            'sponsored_by_geography' => $sponsored->where('geography_tier', '!=', 'none')
                ->groupBy('province_name')
                ->map(function ($group) {
                    return $group->count();
                })
                ->toArray(),
            'recent_sponsored' => $sponsored->sortByDesc('created_at')
                ->take(10)
                ->map(function ($model) {
                    return $this->formatResult($model);
                })
                ->values()
                ->all(),
        ];
    }
    
    private function applyFilters($query, array $filters): void
    {
        // Status filter
        if (!empty($filters['status'])) {
            $statuses = is_array($filters['status']) ? $filters['status'] : [$filters['status']];
            $query->whereIn('status', $statuses);
        }
        
        // Membership type filter
        if (!empty($filters['membership_type'])) {
            $types = is_array($filters['membership_type']) ? $filters['membership_type'] : [$filters['membership_type']];
            $query->whereIn('membership_type', $types);
        }
        
        // Geography filters
        if (!empty($filters['province_id'])) {
            $query->where('province_id', $filters['province_id']);
        }
        
        if (!empty($filters['district_id'])) {
            $query->where('district_id', $filters['district_id']);
        }
        
        if (!empty($filters['ward_id'])) {
            $query->where('ward_id', $filters['ward_id']);
        }
        
        // Geography tier filter
        if (!empty($filters['geography_tier'])) {
            $query->where('geography_tier', $filters['geography_tier']);
        }
        
        // Date range filters
        if (!empty($filters['created_from'])) {
            $query->where('created_at', '>=', $filters['created_from']);
        }
        
        if (!empty($filters['created_to'])) {
            $query->where('created_at', '<=', $filters['created_to']);
        }
        
        if (!empty($filters['activated_from'])) {
            $query->where('activated_at', '>=', $filters['activated_from']);
        }
        
        if (!empty($filters['activated_to'])) {
            $query->where('activated_at', '<=', $filters['activated_to']);
        }
        
        // Search text
        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'ilike', "%{$search}%")
                  ->orWhere('membership_number', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%")
                  ->orWhere('phone', 'ilike', "%{$search}%");
            });
        }
        
        // Sponsor filter
        if (!empty($filters['sponsor_id'])) {
            $query->where('sponsor_id', $filters['sponsor_id']);
        }
    }
    
    private function formatResult(MemberSummaryModel $model): array
    {
        return [
            'id' => $model->id,
            'full_name' => $model->full_name,
            'email' => $model->email,
            'phone' => $model->phone,
            'membership_number' => $model->membership_number,
            'membership_type' => $model->membership_type,
            'membership_type_display' => $this->getMembershipTypeDisplay($model->membership_type),
            'status' => $model->status,
            'status_display' => $this->getStatusDisplay($model->status),
            'geography' => [
                'tier' => $model->geography_tier,
                'province_id' => $model->province_id,
                'province_name' => $model->province_name,
                'district_id' => $model->district_id,
                'district_name' => $model->district_name,
                'ward_id' => $model->ward_id,
                'ward_name' => $model->ward_name,
                'display' => $this->formatGeographyDisplay($model),
            ],
            'sponsor_id' => $model->sponsor_id,
            'approved_by' => $model->approved_by,
            'approved_at' => $model->approved_at?->toIso8601String(),
            'payment_id' => $model->payment_id,
            'activated_at' => $model->activated_at?->toIso8601String(),
            'geography_enriched_at' => $model->geography_enriched_at?->toIso8601String(),
            'created_at' => $model->created_at->toIso8601String(),
            'updated_at' => $model->updated_at->toIso8601String(),
        ];
    }
    
    private function getMembershipTypeDisplay(string $type): string
    {
        $displayMap = [
            'full' => 'Full Member',
            'youth' => 'Youth Member',
            'student' => 'Student Member',
            'associate' => 'Associate Member',
        ];
        
        return $displayMap[$type] ?? ucfirst($type);
    }
    
    private function getStatusDisplay(string $status): string
    {
        $displayMap = [
            'draft' => 'Draft',
            'pending' => 'Pending',
            'approved' => 'Approved',
            'active' => 'Active',
            'suspended' => 'Suspended',
            'expired' => 'Expired',
            'terminated' => 'Terminated',
        ];
        
        return $displayMap[$status] ?? ucfirst($status);
    }
    
    private function formatGeographyDisplay(MemberSummaryModel $model): string
    {
        $parts = [];
        
        if ($model->province_name) {
            $parts[] = $model->province_name;
        }
        
        if ($model->district_name) {
            $parts[] = $model->district_name;
        }
        
        if ($model->ward_name) {
            $parts[] = $model->ward_name;
        }
        
        return $parts ? implode(' → ', $parts) : 'No Geography';
    }
}
```

### **5.2.2 MemberSummary Projection**

```php
<?php

// app/Contexts/Membership/Infrastructure/ReadModels/MemberSummaryProjection.php

namespace App\Contexts\Membership\Infrastructure\ReadModels;

use App\Contexts\Membership\ReadModels\ProjectionInterface;
use App\Contexts\Membership\Infrastructure\Database\Models\MemberSummaryModel;
use App\Contexts\Membership\Infrastructure\Database\Models\MemberModel;
use Illuminate\Support\Facades\DB;

class MemberSummaryProjection implements ProjectionInterface
{
    private const PROJECTION_VERSION = '1.0';
    
    public function projectMemberCreated(array $eventData): void
    {
        $member = MemberModel::find($eventData['member_id']);
        
        if (!$member) {
            return;
        }
        
        MemberSummaryModel::updateOrCreate(
            ['id' => $member->id],
            $this->extractSummaryData($member)
        );
    }
    
    public function projectMemberStatusChanged(array $eventData): void
    {
        $summary = MemberSummaryModel::find($eventData['member_id']);
        
        if ($summary) {
            $summary->status = $eventData['new_status'];
            $summary->save();
        }
    }
    
    public function projectMemberGeographyEnriched(array $eventData): void
    {
        $member = MemberModel::find($eventData['member_id']);
        
        if (!$member) {
            return;
        }
        
        MemberSummaryModel::updateOrCreate(
            ['id' => $member->id],
            $this->extractSummaryData($member)
        );
    }
    
    public function rebuild(): void
    {
        // Clear existing projection
        MemberSummaryModel::truncate();
        
        // Process all members in batches
        MemberModel::chunk(100, function ($members) {
            $summaries = [];
            
            foreach ($members as $member) {
                $summaries[] = $this->extractSummaryData($member);
            }
            
            // Bulk insert for performance
            MemberSummaryModel::insert($summaries);
        });
    }
    
    public function getLastProcessedEventId(): ?string
    {
        // In a real implementation, this would track event sourcing
        return null;
    }
    
    private function extractSummaryData(MemberModel $member): array
    {
        $personalInfo = $member->personal_info ?? [];
        $geography = $member->geography ?? [];
        
        return [
            'id' => $member->id,
            'full_name' => $personalInfo['full_name'] ?? '',
            'email' => $personalInfo['email'] ?? '',
            'phone' => $personalInfo['phone'] ?? '',
            'membership_number' => $member->membership_number,
            'membership_type' => $this->determineMembershipType($member->membership_number),
            'status' => $member->status,
            'geography_tier' => $geography['tier'] ?? 'none',
            'province_id' => $geography['province_id'] ?? null,
            'province_name' => $geography['province'] ?? null,
            'district_id' => $geography['district_id'] ?? null,
            'district_name' => $geography['district'] ?? null,
            'ward_id' => $geography['ward_id'] ?? null,
            'ward_name' => $geography['ward'] ?? null,
            'sponsor_id' => $member->sponsor_id,
            'approved_by' => $member->approved_by,
            'approved_at' => $member->approved_at,
            'payment_id' => $member->payment_id,
            'activated_at' => $member->activated_at,
            'geography_enriched_at' => $member->geography_enriched_at,
            'created_at' => $member->created_at,
            'updated_at' => $member->updated_at,
            'projection_version' => self::PROJECTION_VERSION,
        ];
    }
    
    private function determineMembershipType(string $membershipNumber): string
    {
        // Extract type code from membership number (format: XXX-YYYY-T-NNNNNN)
        $parts = explode('-', $membershipNumber);
        
        if (count($parts) >= 3) {
            $typeCode = $parts[2];
            
            $typeMap = [
                'F' => 'full',
                'Y' => 'youth',
                'S' => 'student',
                'A' => 'associate',
            ];
            
            return $typeMap[$typeCode] ?? 'full';
        }
        
        return 'full';
    }
}
```

### **5.2.3 MemberSummary Database Model**

```php
<?php

// app/Contexts/Membership/Infrastructure/Database/Models/MemberSummaryModel.php

namespace App\Contexts\Membership\Infrastructure\Database\Models;

use Illuminate\Database\Eloquent\Model;

class MemberSummaryModel extends Model
{
    protected $table = 'member_summaries';
    
    protected $keyType = 'string';
    public $incrementing = false;
    
    protected $fillable = [
        'id',
        'full_name',
        'email',
        'phone',
        'membership_number',
        'membership_type',
        'status',
        'geography_tier',
        'province_id',
        'province_name',
        'district_id',
        'district_name',
        'ward_id',
        'ward_name',
        'sponsor_id',
        'approved_by',
        'approved_at',
        'payment_id',
        'activated_at',
        'geography_enriched_at',
        'projection_version',
    ];
    
    protected $casts = [
        'province_id' => 'integer',
        'district_id' => 'integer',
        'ward_id' => 'integer',
        'sponsor_id' => 'integer',
        'approved_by' => 'integer',
        'approved_at' => 'datetime',
        'activated_at' => 'datetime',
        'geography_enriched_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
```

### **5.2.4 MemberSummary Migration**

```bash
php artisan make:migration create_member_summaries_table --context=Membership --tenant
```

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_summaries', function (Blueprint $table) {
            $table->string('id')->primary();
            
            // Basic Information
            $table->string('full_name');
            $table->string('email');
            $table->string('phone');
            $table->string('membership_number')->unique();
            $table->string('membership_type')->default('full');
            $table->string('status')->default('draft');
            
            // Geography (Denormalized for queries)
            $table->string('geography_tier')->default('none')->index();
            $table->integer('province_id')->nullable()->index();
            $table->string('province_name')->nullable();
            $table->integer('district_id')->nullable()->index();
            $table->string('district_name')->nullable();
            $table->integer('ward_id')->nullable()->index();
            $table->string('ward_name')->nullable();
            
            // Relationships
            $table->unsignedBigInteger('sponsor_id')->nullable()->index();
            $table->unsignedBigInteger('approved_by')->nullable()->index();
            
            // Timeline
            $table->timestamp('approved_at')->nullable()->index();
            $table->string('payment_id')->nullable();
            $table->timestamp('activated_at')->nullable()->index();
            $table->timestamp('geography_enriched_at')->nullable()->index();
            
            // Metadata
            $table->string('projection_version')->default('1.0');
            $table->timestamps();
            
            // Optimized indexes for common queries
            $table->index(['status', 'membership_type']);
            $table->index(['geography_tier', 'status']);
            $table->index(['sponsor_id', 'status']);
            $table->index(['created_at', 'status']);
            $table->index(['activated_at', 'status']);
            
            // Full-text search (PostgreSQL)
            if (config('database.default') === 'pgsql') {
                $table->rawIndex(
                    "to_tsvector('english', full_name || ' ' || membership_number || ' ' || email)",
                    'member_summaries_search_idx'
                );
            }
        });
        
        // Add generated columns for MySQL
        if (config('database.default') === 'mysql') {
            DB::statement('
                ALTER TABLE member_summaries
                ADD FULLTEXT INDEX member_summaries_search_idx (full_name, membership_number, email)
            ');
        }
    }
    
    public function down(): void
    {
        Schema::dropIfExists('member_summaries');
    }
};
```

---

## **STEP 5.3: EVENT LISTENERS FOR PROJECTIONS**

### **5.3.1 Create Event Listeners**

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/UpdateMemberSummaryOnMemberCreated.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberCreated;
use App\Contexts\Membership\Infrastructure\ReadModels\MemberSummaryProjection;

class UpdateMemberSummaryOnMemberCreated
{
    public function __construct(
        private MemberSummaryProjection $projection
    ) {}
    
    public function handle(MemberCreated $event): void
    {
        $this->projection->projectMemberCreated($event->toArray());
    }
}
```

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/UpdateMemberSummaryOnStatusChanged.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\Events\MemberSuspended;
use App\Contexts\Membership\Infrastructure\ReadModels\MemberSummaryProjection;

class UpdateMemberSummaryOnStatusChanged
{
    public function __construct(
        private MemberSummaryProjection $projection
    ) {}
    
    public function handleMemberApproved(MemberApproved $event): void
    {
        $this->projection->projectMemberStatusChanged([
            'member_id' => $event->memberId,
            'new_status' => 'approved',
        ]);
    }
    
    public function handleMemberActivated(MemberActivated $event): void
    {
        $this->projection->projectMemberStatusChanged([
            'member_id' => $event->memberId,
            'new_status' => 'active',
        ]);
    }
    
    public function handleMemberSuspended(MemberSuspended $event): void
    {
        $this->projection->projectMemberStatusChanged([
            'member_id' => $event->memberId,
            'new_status' => 'suspended',
        ]);
    }
}
```

```php
<?php

// app/Contexts/Membership/Infrastructure/EventListeners/UpdateMemberSummaryOnGeographyEnriched.php

namespace App\Contexts\Membership\Infrastructure\EventListeners;

use App\Contexts\Membership\Domain\Events\MemberGeographyEnriched;
use App\Contexts\Membership\Infrastructure\ReadModels\MemberSummaryProjection;

class UpdateMemberSummaryOnGeographyEnriched
{
    public function __construct(
        private MemberSummaryProjection $projection
    ) {}
    
    public function handle(MemberGeographyEnriched $event): void
    {
        $this->projection->projectMemberGeographyEnriched($event->toArray());
    }
}
```

### **5.3.2 Register Event Listeners**

Update the `MembershipServiceProvider`:

```php
// In MembershipServiceProvider.php boot method:
public function boot(): void
{
    $this->loadMigrationsFrom(
        __DIR__ . '/../Database/Migrations/Tenant'
    );
    
    $this->registerEventListeners();
}

private function registerEventListeners(): void
{
    $projection = $this->app->make(MemberSummaryProjection::class);
    
    // Register listeners for projections
    Event::listen(
        MemberCreated::class,
        [UpdateMemberSummaryOnMemberCreated::class, 'handle']
    );
    
    Event::listen(
        MemberApproved::class,
        [UpdateMemberSummaryOnStatusChanged::class, 'handleMemberApproved']
    );
    
    Event::listen(
        MemberActivated::class,
        [UpdateMemberSummaryOnStatusChanged::class, 'handleMemberActivated']
    );
    
    Event::listen(
        MemberSuspended::class,
        [UpdateMemberSummaryOnStatusChanged::class, 'handleMemberSuspended']
    );
    
    Event::listen(
        MemberGeographyEnriched::class,
        [UpdateMemberSummaryOnGeographyEnriched::class, 'handle']
    );
}
```

---

## **STEP 5.4: QUERY SERVICES FOR DASHBOARDS**

### **5.4.1 Dashboard Query Service**

```php
<?php

// app/Contexts/Membership/Application/Services/DashboardQueryService.php

namespace App\Contexts\Membership\Application\Services;

use App\Contexts\Membership\ReadModels\MemberReadModelInterface;

class DashboardQueryService
{
    public function __construct(
        private MemberReadModelInterface $memberReadModel
    ) {}
    
    public function getDashboardOverview(array $filters = []): array
    {
        $statistics = $this->memberReadModel->getStatistics($filters);
        $statusSummary = $this->memberReadModel->getStatusSummary($filters);
        $growthTrend = $this->memberReadModel->getGrowthTrend('monthly', 6);
        
        return [
            'statistics' => $statistics,
            'status_summary' => $statusSummary,
            'growth_trend' => $growthTrend,
            'geography_coverage' => $this->getGeographyCoverage($filters),
            'recent_activity' => $this->getRecentActivity($filters),
        ];
    }
    
    public function getGeographyDashboard(array $filters = []): array
    {
        $distribution = $this->memberReadModel->getGeographyDistribution($filters);
        $statistics = $this->memberReadModel->getStatistics($filters);
        
        return [
            'distribution' => $distribution,
            'coverage_metrics' => [
                'total_with_geography' => $distribution['geography_coverage']['with_geography'],
                'total_without_geography' => $distribution['geography_coverage']['without_geography'],
                'coverage_percentage' => $statistics['total'] > 0 
                    ? round(($distribution['geography_coverage']['with_geography'] / $statistics['total']) * 100, 2)
                    : 0,
                'advanced_geography_percentage' => $distribution['geography_coverage']['with_geography'] > 0
                    ? round(($distribution['geography_coverage']['advanced_geography'] / $distribution['geography_coverage']['with_geography']) * 100, 2)
                    : 0,
            ],
            'top_provinces' => array_slice($distribution['provinces'], 0, 5),
            'top_districts' => array_slice($distribution['districts'], 0, 10),
        ];
    }
    
    public function getMembershipTypesDashboard(array $filters = []): array
    {
        $statistics = $this->memberReadModel->getStatistics($filters);
        $typeDistribution = $statistics['by_type'] ?? [];
        
        $total = array_sum($typeDistribution);
        $typeDetails = [];
        
        foreach ($typeDistribution as $type => $count) {
            $typeDetails[$type] = [
                'count' => $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0,
                'display_name' => $this->getMembershipTypeDisplay($type),
            ];
        }
        
        return [
            'type_distribution' => $typeDetails,
            'total' => $total,
            'most_common_type' => $typeDistribution ? array_keys($typeDistribution, max($typeDistribution))[0] : null,
        ];
    }
    
    public function getCommitteeDashboard(int $committeeMemberId, array $filters = []): array
    {
        $committeeReport = $this->memberReadModel->getCommitteeReport($committeeMemberId, $filters);
        
        return [
            'committee_report' => $committeeReport,
            'performance_metrics' => [
                'conversion_rate' => $committeeReport['total_sponsored'] > 0
                    ? round(($committeeReport['active_sponsored'] / $committeeReport['total_sponsored']) * 100, 2)
                    : 0,
                'average_per_month' => $this->calculateAveragePerMonth($committeeMemberId, $filters),
                'retention_rate' => $this->calculateRetentionRate($committeeMemberId, $filters),
            ],
        ];
    }
    
    public function searchMembers(array $criteria): array
    {
        $results = $this->memberReadModel->search($criteria);
        $total = $this->memberReadModel->count($criteria);
        
        return [
            'results' => $results,
            'pagination' => [
                'total' => $total,
                'per_page' => $criteria['limit'] ?? 50,
                'current_page' => floor(($criteria['offset'] ?? 0) / ($criteria['limit'] ?? 50)) + 1,
                'total_pages' => ceil($total / ($criteria['limit'] ?? 50)),
            ],
        ];
    }
    
    private function getGeographyCoverage(array $filters): array
    {
        $distribution = $this->memberReadModel->getGeographyDistribution($filters);
        
        return [
            'with_geography' => $distribution['geography_coverage']['with_geography'],
            'without_geography' => $distribution['geography_coverage']['without_geography'],
            'advanced_geography' => $distribution['geography_coverage']['advanced_geography'],
            'basic_geography' => $distribution['geography_coverage']['with_geography'] - $distribution['geography_coverage']['advanced_geography'],
        ];
    }
    
    private function getRecentActivity(array $filters): array
    {
        $filters['limit'] = 10;
        $filters['sort_by'] = 'created_at';
        $filters['sort_order'] = 'desc';
        
        return $this->memberReadModel->search($filters);
    }
    
    private function getMembershipTypeDisplay(string $type): string
    {
        $displayMap = [
            'full' => 'Full Member',
            'youth' => 'Youth Member',
            'student' => 'Student Member',
            'associate' => 'Associate Member',
        ];
        
        return $displayMap[$type] ?? ucfirst($type);
    }
    
    private function calculateAveragePerMonth(int $committeeMemberId, array $filters): float
    {
        // Simplified calculation - in real app, would query database
        $committeeReport = $this->memberReadModel->getCommitteeReport($committeeMemberId, $filters);
        
        if ($committeeReport['total_sponsored'] === 0) {
            return 0.0;
        }
        
        // Assume average over 12 months for now
        return round($committeeReport['total_sponsored'] / 12, 2);
    }
    
    private function calculateRetentionRate(int $committeeMemberId, array $filters): float
    {
        $committeeReport = $this->memberReadModel->getCommitteeReport($committeeMemberId, $filters);
        
        if ($committeeReport['total_sponsored'] === 0) {

# 🚀 **PHASE 5.4: QUERY SERVICES FOR DASHBOARDS (CQRS READ MODELS)**

## **📁 ARCHITECTURE OVERVIEW**

```
CQRS Read Models Goals:
1. Optimized queries for dashboards (separate from write model)
2. Denormalized data for fast reads
3. Event-driven projection updates
4. Support for complex analytics
```

---

## **STEP 5.4.1: READ MODEL STRUCTURE**

### **5.4.1.1 Create Query Layer Directories**

```bash
mkdir -p app/Contexts/Membership/Application/Queries
mkdir -p app/Contexts/Membership/Application/ReadModels
mkdir -p app/Contexts/Membership/Infrastructure/Projectors
mkdir -p app/Contexts/Membership/Infrastructure/QueryModels
mkdir -p tests/Unit/Contexts/Membership/Application/Queries
```

### **5.4.1.2 Query Interface**

```php
<?php

// app/Contexts/Membership/Application/Queries/Query.php

namespace App\Contexts\Membership\Application\Queries;

interface Query
{
    // Marker interface for all queries
}
```

```php
<?php

// app/Contexts/Membership/Application/Queries/QueryHandler.php

namespace App\Contexts\Membership\Application\Queries;

interface QueryHandler
{
    // Marker interface for all query handlers
}
```

---

## **STEP 5.4.2: DASHBOARD STATISTICS QUERY**

### **5.4.2.1 DashboardStatistics Query and Result DTO**

```php
<?php

// app/Contexts/Membership/Application/Queries/DashboardStatisticsQuery.php

namespace App\Contexts\Membership\Application\Queries;

final class DashboardStatisticsQuery implements Query
{
    public function __construct(
        public readonly ?int $committeeMemberId = null,
        public readonly ?string $geographyFilter = null, // 'province', 'district', 'ward'
        public readonly ?int $geographyId = null,
        public readonly ?string $dateRange = '30d', // 7d, 30d, 90d, ytd, all
        public readonly bool $includeTrends = true
    ) {}
}
```

```php
<?php

// app/Contexts/Membership/Application/ReadModels/DashboardStatistics.php

namespace App\Contexts\Membership\Application\ReadModels;

final class DashboardStatistics
{
    public function __construct(
        public readonly array $counts,
        public readonly array $growth,
        public readonly array $geographyDistribution,
        public readonly array $statusDistribution,
        public readonly array $typeDistribution,
        public readonly array $recentActivity,
        public readonly array $committeePerformance,
        public readonly \DateTimeImmutable $generatedAt
    ) {}
    
    public function toArray(): array
    {
        return [
            'counts' => $this->counts,
            'growth' => $this->growth,
            'geography_distribution' => $this->geographyDistribution,
            'status_distribution' => $this->statusDistribution,
            'type_distribution' => $this->typeDistribution,
            'recent_activity' => $this->recentActivity,
            'committee_performance' => $this->committeePerformance,
            'generated_at' => $this->generatedAt->format('c'),
        ];
    }
}
```

### **5.4.2.2 DashboardStatistics Query Handler**

```php
<?php

// app/Contexts/Membership/Application/Queries/DashboardStatisticsHandler.php

namespace App\Contexts\Membership\Application\Queries;

use App\Contexts\Membership\Application\ReadModels\DashboardStatistics;
use App\Contexts\Membership\Domain\Repositories\MemberRepositoryInterface;
use App\Contexts\Membership\Infrastructure\QueryModels\MemberStatisticsRepositoryInterface;

class DashboardStatisticsHandler implements QueryHandler
{
    public function __construct(
        private MemberRepositoryInterface $memberRepository,
        private MemberStatisticsRepositoryInterface $statisticsRepository
    ) {}
    
    public function handle(DashboardStatisticsQuery $query): DashboardStatistics
    {
        $now = new \DateTimeImmutable();
        
        // Get basic counts
        $totalCount = $this->memberRepository->countTotal();
        $activeCount = $this->memberRepository->countByStatus('active');
        $pendingCount = $this->memberRepository->countByStatus('pending');
        $approvedCount = $this->memberRepository->countByStatus('approved');
        
        // Get growth data
        $growth = $this->getGrowthData($query->dateRange);
        
        // Get distributions
        $geographyDistribution = $this->getGeographyDistribution($query);
        $statusDistribution = $this->getStatusDistribution();
        $typeDistribution = $this->getTypeDistribution();
        
        // Get recent activity
        $recentActivity = $this->getRecentActivity($query->dateRange);
        
        // Get committee performance (if committee member)
        $committeePerformance = $query->committeeMemberId 
            ? $this->getCommitteePerformance($query->committeeMemberId, $query->dateRange)
            : [];
        
        return new DashboardStatistics(
            counts: [
                'total' => $totalCount,
                'active' => $activeCount,
                'pending' => $pendingCount,
                'approved' => $approvedCount,
                'suspended' => $this->memberRepository->countByStatus('suspended'),
                'terminated' => $this->memberRepository->countByStatus('terminated'),
            ],
            growth: $growth,
            geographyDistribution: $geographyDistribution,
            statusDistribution: $statusDistribution,
            typeDistribution: $typeDistribution,
            recentActivity: $recentActivity,
            committeePerformance: $committeePerformance,
            generatedAt: $now
        );
    }
    
    private function getGrowthData(string $dateRange): array
    {
        $endDate = new \DateTimeImmutable();
        $startDate = $this->calculateStartDate($dateRange, $endDate);
        
        return $this->statisticsRepository->getGrowthData($startDate, $endDate);
    }
    
    private function getGeographyDistribution(DashboardStatisticsQuery $query): array
    {
        if ($query->geographyFilter && $query->geographyId) {
            return $this->statisticsRepository->getFilteredGeographyDistribution(
                $query->geographyFilter,
                $query->geographyId
            );
        }
        
        return $this->statisticsRepository->getGeographyDistribution();
    }
    
    private function getStatusDistribution(): array
    {
        $statuses = ['active', 'pending', 'approved', 'suspended', 'terminated'];
        $distribution = [];
        
        foreach ($statuses as $status) {
            $count = $this->memberRepository->countByStatus($status);
            if ($count > 0) {
                $distribution[$status] = $count;
            }
        }
        
        return $distribution;
    }
    
    private function getTypeDistribution(): array
    {
        return $this->statisticsRepository->getTypeDistribution();
    }
    
    private function getRecentActivity(string $dateRange): array
    {
        $endDate = new \DateTimeImmutable();
        $startDate = $this->calculateStartDate($dateRange, $endDate);
        
        return $this->statisticsRepository->getRecentActivity($startDate, $endDate);
    }
    
    private function getCommitteePerformance(int $committeeMemberId, string $dateRange): array
    {
        $endDate = new \DateTimeImmutable();
        $startDate = $this->calculateStartDate($dateRange, $endDate);
        
        return $this->statisticsRepository->getCommitteePerformance(
            $committeeMemberId,
            $startDate,
            $endDate
        );
    }
    
    private function calculateStartDate(string $dateRange, \DateTimeImmutable $endDate): \DateTimeImmutable
    {
        return match ($dateRange) {
            '7d' => $endDate->modify('-7 days'),
            '30d' => $endDate->modify('-30 days'),
            '90d' => $endDate->modify('-90 days'),
            'ytd' => new \DateTimeImmutable(date('Y-01-01')),
            default => $endDate->modify('-365 days'), // 1 year default
        };
    }
}
```

### **5.4.2.3 MemberStatistics Repository Interface**

```php
<?php

// app/Contexts/Membership/Infrastructure/QueryModels/MemberStatisticsRepositoryInterface.php

namespace App\Contexts\Membership\Infrastructure\QueryModels;

interface MemberStatisticsRepositoryInterface
{
    public function getGrowthData(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array;
    
    public function getGeographyDistribution(): array;
    
    public function getFilteredGeographyDistribution(string $filterType, int $filterId): array;
    
    public function getTypeDistribution(): array;
    
    public function getRecentActivity(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array;
    
    public function getCommitteePerformance(int $committeeMemberId, \DateTimeInterface $startDate, \DateTimeInterface $endDate): array;
    
    public function getMemberCountByDateRange(\DateTimeInterface $startDate, \DateTimeInterface $endDate): int;
    
    public function getApprovalRate(\DateTimeInterface $startDate, \DateTimeInterface $endDate): float;
    
    public function getActivationRate(\DateTimeInterface $startDate, \DateTimeInterface $endDate): float;
}
```

---

## **STEP 5.4.3: MATERIALIZED VIEW FOR STATISTICS**

### **5.4.3.1 Create Materialized View Migration**

```bash
php artisan make:migration create_member_statistics_materialized_view --context=Membership --tenant
```

```php
<?php

// app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/[timestamp]_create_member_statistics_materialized_view.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Create materialized view for member statistics
        // This is PostgreSQL-specific syntax
        if (config('database.default') === 'pgsql') {
            DB::statement('
                CREATE MATERIALIZED VIEW IF NOT EXISTS member_statistics_mv AS
                SELECT 
                    -- Date bucket for time series
                    DATE_TRUNC(\'day\', m.created_at) AS date_day,
                    DATE_TRUNC(\'week\', m.created_at) AS date_week,
                    DATE_TRUNC(\'month\', m.created_at) AS date_month,
                    
                    -- Geography dimensions
                    (m.geography->>\'province_id\')::integer AS province_id,
                    (m.geography->>\'province\')::text AS province_name,
                    (m.geography->>\'district_id\')::integer AS district_id,
                    (m.geography->>\'district\')::text AS district_name,
                    (m.geography->>\'ward_id\')::integer AS ward_id,
                    (m.geography->>\'ward\')::text AS ward_name,
                    
                    -- Member attributes
                    m.status,
                    LEFT(m.membership_number, 1) AS membership_type_code,
                    m.sponsor_id,
                    m.approved_by,
                    
                    -- Timestamps for lifecycle analysis
                    m.created_at,
                    m.approved_at,
                    m.activated_at,
                    m.geography_enriched_at,
                    
                    -- Count columns
                    1 AS member_count,
                    CASE WHEN m.status = \'active\' THEN 1 ELSE 0 END AS active_count,
                    CASE WHEN m.status = \'pending\' THEN 1 ELSE 0 END AS pending_count,
                    CASE WHEN m.status = \'approved\' THEN 1 ELSE 0 END AS approved_count,
                    CASE WHEN m.status = \'suspended\' THEN 1 ELSE 0 END AS suspended_count,
                    CASE WHEN m.status = \'terminated\' THEN 1 ELSE 0 END AS terminated_count,
                    
                    -- Geography tier tracking
                    CASE 
                        WHEN (m.geography->>\'province_id\') IS NOT NULL THEN \'advanced\'
                        WHEN (m.geography->>\'province\') IS NOT NULL THEN \'basic\'
                        ELSE \'none\'
                    END AS geography_tier
                    
                FROM members m
                WHERE m.deleted_at IS NULL
            ');
            
            // Create indexes for fast querying
            DB::statement('
                CREATE INDEX idx_member_stats_date ON member_statistics_mv (date_day DESC);
                CREATE INDEX idx_member_stats_status ON member_statistics_mv (status);
                CREATE INDEX idx_member_stats_geography ON member_statistics_mv (province_id, district_id, ward_id);
                CREATE INDEX idx_member_stats_approved_by ON member_statistics_mv (approved_by);
                CREATE INDEX idx_member_stats_sponsor ON member_statistics_mv (sponsor_id);
            ');
            
            // Create refresh function
            DB::statement('
                CREATE OR REPLACE FUNCTION refresh_member_statistics_mv()
                RETURNS void AS $$
                BEGIN
                    REFRESH MATERIALIZED VIEW CONCURRENTLY member_statistics_mv;
                END;
                $$ LANGUAGE plpgsql;
            ');
        }
        
        // For MySQL, create a regular view (no materialized views in standard MySQL)
        if (config('database.default') === 'mysql') {
            DB::statement('
                CREATE OR REPLACE VIEW member_statistics_vw AS
                SELECT 
                    DATE(m.created_at) AS date_day,
                    YEARWEEK(m.created_at) AS date_week,
                    DATE_FORMAT(m.created_at, \'%Y-%m-01\') AS date_month,
                    
                    JSON_UNQUOTE(JSON_EXTRACT(m.geography, "$.province_id")) AS province_id,
                    JSON_UNQUOTE(JSON_EXTRACT(m.geography, "$.province")) AS province_name,
                    JSON_UNQUOTE(JSON_EXTRACT(m.geography, "$.district_id")) AS district_id,
                    JSON_UNQUOTE(JSON_EXTRACT(m.geography, "$.district")) AS district_name,
                    JSON_UNQUOTE(JSON_EXTRACT(m.geography, "$.ward_id")) AS ward_id,
                    JSON_UNQUOTE(JSON_EXTRACT(m.geography, "$.ward")) AS ward_name,
                    
                    m.status,
                    LEFT(m.membership_number, 1) AS membership_type_code,
                    m.sponsor_id,
                    m.approved_by,
                    
                    m.created_at,
                    m.approved_at,
                    m.activated_at,
                    m.geography_enriched_at,
                    
                    1 AS member_count,
                    IF(m.status = \'active\', 1, 0) AS active_count,
                    IF(m.status = \'pending\', 1, 0) AS pending_count,
                    IF(m.status = \'approved\', 1, 0) AS approved_count,
                    IF(m.status = \'suspended\', 1, 0) AS suspended_count,
                    IF(m.status = \'terminated\', 1, 0) AS terminated_count,
                    
                    CASE 
                        WHEN JSON_UNQUOTE(JSON_EXTRACT(m.geography, "$.province_id")) IS NOT NULL THEN \'advanced\'
                        WHEN JSON_UNQUOTE(JSON_EXTRACT(m.geography, "$.province")) IS NOT NULL THEN \'basic\'
                        ELSE \'none\'
                    END AS geography_tier
                    
                FROM members m
                WHERE m.deleted_at IS NULL
            ');
        }
    }
    
    public function down(): void
    {
        if (config('database.default') === 'pgsql') {
            DB::statement('DROP MATERIALIZED VIEW IF EXISTS member_statistics_mv CASCADE');
            DB::statement('DROP FUNCTION IF EXISTS refresh_member_statistics_mv()');
        }
        
        if (config('database.default') === 'mysql') {
            DB::statement('DROP VIEW IF EXISTS member_statistics_vw');
        }
    }
};
```

### **5.4.3.2 Eloquent Statistics Repository Implementation**

```php
<?php

// app/Contexts/Membership/Infrastructure/QueryModels/EloquentMemberStatisticsRepository.php

namespace App\Contexts\Membership\Infrastructure\QueryModels;

use Illuminate\Support\Facades\DB;

class EloquentMemberStatisticsRepository implements MemberStatisticsRepositoryInterface
{
    public function getGrowthData(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        $results = DB::table($tableName)
            ->select(
                DB::raw('DATE(date_day) as date'),
                DB::raw('COUNT(*) as total_members'),
                DB::raw('SUM(active_count) as active_members'),
                DB::raw('SUM(pending_count) as pending_members'),
                DB::raw('SUM(approved_count) as approved_members')
            )
            ->whereBetween('date_day', [$startDate, $endDate])
            ->groupBy('date_day')
            ->orderBy('date_day')
            ->get();
        
        $growthData = [
            'total' => 0,
            'active' => 0,
            'pending' => 0,
            'approved' => 0,
            'daily' => []
        ];
        
        foreach ($results as $row) {
            $growthData['total'] += $row->total_members;
            $growthData['active'] += $row->active_members;
            $growthData['pending'] += $row->pending_members;
            $growthData['approved'] += $row->approved_members;
            
            $growthData['daily'][] = [
                'date' => $row->date,
                'total' => $row->total_members,
                'active' => $row->active_members,
                'pending' => $row->pending_members,
                'approved' => $row->approved_members,
            ];
        }
        
        return $growthData;
    }
    
    public function getGeographyDistribution(): array
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        // Get province distribution
        $provinces = DB::table($tableName)
            ->select(
                'province_id',
                'province_name',
                DB::raw('COUNT(*) as member_count'),
                DB::raw('SUM(active_count) as active_count')
            )
            ->whereNotNull('province_name')
            ->groupBy('province_id', 'province_name')
            ->orderByDesc('member_count')
            ->get()
            ->map(function ($row) {
                return [
                    'id' => $row->province_id,
                    'name' => $row->province_name,
                    'total' => $row->member_count,
                    'active' => $row->active_count,
                ];
            })
            ->toArray();
        
        // Get district distribution for top 5 provinces
        $topProvinceIds = collect($provinces)->take(5)->pluck('id')->filter()->toArray();
        
        $districts = [];
        if (!empty($topProvinceIds)) {
            $districts = DB::table($tableName)
                ->select(
                    'district_id',
                    'district_name',
                    DB::raw('COUNT(*) as member_count'),
                    DB::raw('SUM(active_count) as active_count')
                )
                ->whereIn('province_id', $topProvinceIds)
                ->whereNotNull('district_name')
                ->groupBy('district_id', 'district_name', 'province_id')
                ->orderByDesc('member_count')
                ->get()
                ->map(function ($row) {
                    return [
                        'id' => $row->district_id,
                        'name' => $row->district_name,
                        'total' => $row->member_count,
                        'active' => $row->active_count,
                    ];
                })
                ->toArray();
        }
        
        // Get geography tiers
        $tiers = DB::table($tableName)
            ->select(
                'geography_tier',
                DB::raw('COUNT(*) as member_count')
            )
            ->groupBy('geography_tier')
            ->get()
            ->pluck('member_count', 'geography_tier')
            ->toArray();
        
        return [
            'provinces' => $provinces,
            'districts' => $districts,
            'tiers' => $tiers,
        ];
    }
    
    public function getFilteredGeographyDistribution(string $filterType, int $filterId): array
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        $query = DB::table($tableName);
        
        switch ($filterType) {
            case 'province':
                $query->where('province_id', $filterId);
                $groupBy = ['district_id', 'district_name'];
                $nameField = 'district_name';
                break;
                
            case 'district':
                $query->where('district_id', $filterId);
                $groupBy = ['ward_id', 'ward_name'];
                $nameField = 'ward_name';
                break;
                
            default:
                return [];
        }
        
        $distribution = $query
            ->select(
                ...$groupBy,
                DB::raw('COUNT(*) as member_count'),
                DB::raw('SUM(active_count) as active_count'),
                DB::raw('SUM(pending_count) as pending_count')
            )
            ->whereNotNull($nameField)
            ->groupBy(...$groupBy)
            ->orderByDesc('member_count')
            ->get()
            ->map(function ($row) use ($nameField) {
                return [
                    'id' => $row->{str_replace('_name', '_id', $nameField)},
                    'name' => $row->{$nameField},
                    'total' => $row->member_count,
                    'active' => $row->active_count,
                    'pending' => $row->pending_count,
                ];
            })
            ->toArray();
        
        // Get status distribution for this geography
        $statusDistribution = $query
            ->clone()
            ->select(
                'status',
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status')
            ->toArray();
        
        // Get type distribution for this geography
        $typeDistribution = $query
            ->clone()
            ->select(
                'membership_type_code',
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('membership_type_code')
            ->get()
            ->mapWithKeys(function ($row) {
                $typeName = $this->mapTypeCodeToName($row->membership_type_code);
                return [$typeName => $row->count];
            })
            ->toArray();
        
        return [
            'distribution' => $distribution,
            'status_distribution' => $statusDistribution,
            'type_distribution' => $typeDistribution,
        ];
    }
    
    public function getTypeDistribution(): array
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        $distribution = DB::table($tableName)
            ->select(
                'membership_type_code',
                DB::raw('COUNT(*) as total'),
                DB::raw('SUM(active_count) as active')
            )
            ->groupBy('membership_type_code')
            ->get()
            ->mapWithKeys(function ($row) {
                $typeName = $this->mapTypeCodeToName($row->membership_type_code);
                return [
                    $typeName => [
                        'total' => $row->total,
                        'active' => $row->active,
                    ]
                ];
            })
            ->toArray();
        
        return $distribution;
    }
    
    public function getRecentActivity(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        // Recent registrations
        $recentRegistrations = DB::table($tableName)
            ->select(
                'date_day',
                DB::raw('COUNT(*) as registrations')
            )
            ->whereBetween('date_day', [$startDate, $endDate])
            ->groupBy('date_day')
            ->orderByDesc('date_day')
            ->limit(14)
            ->get()
            ->map(function ($row) {
                return [
                    'date' => $row->date_day,
                    'registrations' => $row->registrations,
                ];
            })
            ->toArray();
        
        // Recent approvals
        $recentApprovals = DB::table($tableName)
            ->select(
                DB::raw('DATE(approved_at) as approval_date'),
                DB::raw('COUNT(*) as approvals'),
                DB::raw('COUNT(DISTINCT approved_by) as approvers')
            )
            ->whereBetween('approved_at', [$startDate, $endDate])
            ->whereNotNull('approved_at')
            ->groupBy('approval_date')
            ->orderByDesc('approval_date')
            ->limit(14)
            ->get()
            ->map(function ($row) {
                return [
                    'date' => $row->approval_date,
                    'approvals' => $row->approvals,
                    'approvers' => $row->approvers,
                ];
            })
            ->toArray();
        
        // Recent activations
        $recentActivations = DB::table($tableName)
            ->select(
                DB::raw('DATE(activated_at) as activation_date'),
                DB::raw('COUNT(*) as activations')
            )
            ->whereBetween('activated_at', [$startDate, $endDate])
            ->whereNotNull('activated_at')
            ->groupBy('activation_date')
            ->orderByDesc('activation_date')
            ->limit(14)
            ->get()
            ->map(function ($row) {
                return [
                    'date' => $row->activation_date,
                    'activations' => $row->activations,
                ];
            })
            ->toArray();
        
        return [
            'registrations' => $recentRegistrations,
            'approvals' => $recentApprovals,
            'activations' => $recentActivations,
        ];
    }
    
    public function getCommitteePerformance(int $committeeMemberId, \DateTimeInterface $startDate, \DateTimeInterface $endDate): array
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        // Members approved by this committee member
        $approvedMembers = DB::table($tableName)
            ->select(
                DB::raw('DATE(approved_at) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->where('approved_by', $committeeMemberId)
            ->whereBetween('approved_at', [$startDate, $endDate])
            ->groupBy('date')
            ->orderByDesc('date')
            ->get();
        
        // Geography distribution of approved members
        $geographyDistribution = DB::table($tableName)
            ->select(
                'province_name',
                'district_name',
                DB::raw('COUNT(*) as count')
            )
            ->where('approved_by', $committeeMemberId)
            ->whereBetween('approved_at', [$startDate, $endDate])
            ->whereNotNull('province_name')
            ->groupBy('province_name', 'district_name')
            ->orderByDesc('count')
            ->limit(10)
            ->get();
        
        // Approval rate over time
        $totalApproved = $approvedMembers->sum('count');
        $totalPending = DB::table($tableName)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'pending')
            ->count();
        
        $approvalRate = $totalPending > 0 
            ? ($totalApproved / $totalPending) * 100 
            : 0;
        
        // Average time to approval
        $avgApprovalTime = DB::table($tableName)
            ->select(DB::raw('AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400) as avg_days'))
            ->where('approved_by', $committeeMemberId)
            ->whereBetween('approved_at', [$startDate, $endDate])
            ->whereNotNull('approved_at')
            ->first();
        
        return [
            'total_approved' => $totalApproved,
            'approval_rate' => round($approvalRate, 2),
            'avg_approval_time_days' => round($avgApprovalTime->avg_days ?? 0, 1),
            'daily_approvals' => $approvedMembers->toArray(),
            'geography_distribution' => $geographyDistribution->toArray(),
        ];
    }
    
    public function getMemberCountByDateRange(\DateTimeInterface $startDate, \DateTimeInterface $endDate): int
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        return DB::table($tableName)
            ->whereBetween('date_day', [$startDate, $endDate])
            ->count();
    }
    
    public function getApprovalRate(\DateTimeInterface $startDate, \DateTimeInterface $endDate): float
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        $totalMembers = DB::table($tableName)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();
        
        $approvedMembers = DB::table($tableName)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->whereNotNull('approved_at')
            ->count();
        
        return $totalMembers > 0 ? ($approvedMembers / $totalMembers) * 100 : 0;
    }
    
    public function getActivationRate(\DateTimeInterface $startDate, \DateTimeInterface $endDate): float
    {
        $tableName = config('database.default') === 'pgsql' 
            ? 'member_statistics_mv' 
            : 'member_statistics_vw';
        
        $approvedMembers = DB::table($tableName)
            ->whereBetween('approved_at', [$startDate, $endDate])
            ->whereNotNull('approved_at')
            ->count();
        
        $activatedMembers = DB::table($tableName)
            ->whereBetween('approved_at', [$startDate, $endDate])
            ->whereNotNull('activated_at')
            ->count();
        
        return $approvedMembers > 0 ? ($activatedMembers / $approvedMembers) * 100 : 0;
    }
    
    private function mapTypeCodeToName(string $typeCode): string
    {
        return match ($typeCode) {
            'F' => 'full',
            'Y' => 'youth',
            'S' => 'student',
            'A' => 'associate',
            default => 'unknown',
        };
    }
}
```

### **5.4.3.3 Projector for Materialized View Updates**

```php
<?php

// app/Contexts/Membership/Infrastructure/Projectors/MemberStatisticsProjector.php

namespace App\Contexts\Membership\Infrastructure\Projectors;

use App\Contexts\Membership\Domain\Events\MemberCreated;
use App\Contexts\Membership\Domain\Events\MemberApproved;
use App\Contexts\Membership\Domain\Events\MemberActivated;
use App\Contexts\Membership\Domain\Events\MemberGeographyEnriched;
use Illuminate\Support\Facades\DB;

class MemberStatisticsProjector
{
    public function onMemberCreated(MemberCreated $event): void
    {
        // Queue materialized view refresh
        $this->scheduleRefresh();
    }
    
    public function onMemberApproved(MemberApproved $event): void
    {
        $this->scheduleRefresh();
    }
    
    public function onMemberActivated(MemberActivated $event): void
    {
        $this->scheduleRefresh();
    }
    
    public function onMemberGeographyEnriched(MemberGeographyEnriched $event): void
    {
        $this->scheduleRefresh();
    }
    
    private function scheduleRefresh(): void
    {
        // For PostgreSQL, refresh materialized view
        if (config('database.default') === 'pgsql') {
            // Queue the refresh to avoid blocking
            DB::statement('SELECT refresh_member_statistics_mv()');
        }
        
        // For MySQL, nothing to do (regular view auto-updates)
    }
}
```

---

## **STEP 5.4.4: MEMBER SEARCH QUERY**

### **5.4.4.1 SearchMembers Query and Handler**

```php
<?php

// app/Contexts/Membership/Application/Queries/SearchMembersQuery.php

namespace App\Contexts\Membership\Application\Queries;

final class SearchMembersQuery implements Query
{
    public function __construct(
        public readonly ?string $searchTerm = null,
        public readonly ?string $status = null,
        public readonly ?string $membershipType = null,
        public readonly ?int $provinceId = null,
        public readonly ?int $districtId = null,
        public readonly ?int $wardId = null,
        public readonly ?string $geographyTier = null,
        public readonly ?int $sponsorId = null,
        public readonly ?int $approvedBy = null,
        public readonly ?string $dateFrom = null,
        public readonly ?string $dateTo = null,
        public readonly string $sortBy = 'created_at',
        public readonly string $sortDirection = 'desc',
        public readonly int $page = 1,
        public readonly int $perPage = 20
    ) {}
}
```

```php
<?php

// app/Contexts/Membership/Application/ReadModels/MemberSearchResult.php

namespace App\Contexts\Membership\Application\ReadModels;

final class MemberSearchResult
{
    public function __construct(
        public readonly array $members,
        public readonly int $total,
        public readonly int $page,
        public readonly int $perPage,
        public readonly int $lastPage,
        public readonly array $filters
    ) {}
    
    public function toArray(): array
    {
        return [
            'data' => $this->members,
            'meta' => [
                'total' => $this->total,
                'page' => $this->page,
                'per_page' => $this->perPage,
                'last_page' => $this->lastPage,
            ],
            'filters' => $this->filters,
        ];
    }
}
```

```php
<?php

// app/Contexts/Membership/Application/Queries/SearchMembersHandler.php

namespace App\Contexts\Membership\Application\Queries;

use App\Contexts\Membership\Application\ReadModels\MemberSearchResult;
use App\Contexts\Membership\Infrastructure\QueryModels\MemberSearchRepositoryInterface;

class SearchMembersHandler implements QueryHandler
{
    public function __construct(
        private MemberSearchRepositoryInterface $searchRepository
    ) {}
    
    public function handle(SearchMembersQuery $query): MemberSearchResult
    {
        // Build search parameters
        $params = [
            'search_term' => $query->searchTerm,
            'status' => $query->status,
            'membership_type' => $query->membershipType,
            'province_id' => $query->provinceId,
            'district_id' => $query->districtId,
            'ward_id' => $query->wardId,
            'geography_tier' => $query->geographyTier,
            'sponsor_id' => $query->sponsorId,
            'approved_by' => $query->approvedBy,
            'date_from' => $query->dateFrom,
            'date_to' => $query->dateTo,
            'sort_by' => $query->sortBy,
            'sort_direction' => $query->sortDirection,
        ];
        
        // Execute search
        $results = $this->searchRepository->search(
            params: $params,
            page: $query->page,
            perPage: $query->perPage
        );
        
        // Apply any additional business logic/transformations
        $members = array_map(function ($member) {
            return $this->transformMemberResult($member);
        }, $results['data']);
        
        return new MemberSearchResult(
            members: $members,
            total: $results['total'],
            page: $query->page,
            perPage: $query->perPage,
            lastPage: $results['last_page'],
            filters: $
# 🚀 **PHASE 5: CQRS QUERY LAYER (Starting from STEP 5.4.4: MEMBER SEARCH QUERY)**

## **📁 ARCHITECTURE OVERVIEW**

```
CQRS Query Layer Goals:
1. Separate read models from write models
2. Optimize queries for dashboards and reporting
3. Support complex filtering and pagination
4. Cache frequently accessed data
5. Provide real-time statistics
```

---

## **STEP 5.4.4: MEMBER SEARCH QUERY IMPLEMENTATION**

### **5.4.4.1 Create Query Directories**

```bash
mkdir -p app/Contexts/Membership/Application/Queries
mkdir -p app/Contexts/Membership/Application/Queries/DTOs
mkdir -p app/Contexts/Membership/Application/Queries/Results
mkdir -p app/Contexts/Membership/Infrastructure/Queries
mkdir -p tests/Unit/Contexts/Membership/Application/Queries
```

### **5.4.4.2 Search Criteria DTO**

```php
<?php

// app/Contexts/Membership/Application/Queries/DTOs/MemberSearchCriteria.php

namespace App\Contexts\Membership\Application\Queries\DTOs;

final class MemberSearchCriteria
{
    public function __construct(
        public readonly ?string $query = null,
        public readonly ?string $status = null,
        public readonly ?string $membershipType = null,
        public readonly ?int $provinceId = null,
        public readonly ?int $districtId = null,
        public readonly ?int $wardId = null,
        public readonly ?int $sponsorId = null,
        public readonly ?\DateTimeInterface $registeredFrom = null,
        public readonly ?\DateTimeInterface $registeredTo = null,
        public readonly ?\DateTimeInterface $activatedFrom = null,
        public readonly ?\DateTimeInterface $activatedTo = null,
        public readonly ?string $geographyTier = null,
        public readonly ?string $sortBy = 'created_at',
        public readonly ?string $sortDirection = 'desc',
        public readonly int $page = 1,
        public readonly int $perPage = 20
    ) {}
    
    public static function fromArray(array $data): self
    {
        return new self(
            query: $data['query'] ?? null,
            status: $data['status'] ?? null,
            membershipType: $data['membership_type'] ?? null,
            provinceId: $data['province_id'] ?? null ? (int) $data['province_id'] : null,
            districtId: $data['district_id'] ?? null ? (int) $data['district_id'] : null,
            wardId: $data['ward_id'] ?? null ? (int) $data['ward_id'] : null,
            sponsorId: $data['sponsor_id'] ?? null ? (int) $data['sponsor_id'] : null,
            registeredFrom: isset($data['registered_from']) ? new \DateTime($data['registered_from']) : null,
            registeredTo: isset($data['registered_to']) ? new \DateTime($data['registered_to']) : null,
            activatedFrom: isset($data['activated_from']) ? new \DateTime($data['activated_from']) : null,
            activatedTo: isset($data['activated_to']) ? new \DateTime($data['activated_to']) : null,
            geographyTier: $data['geography_tier'] ?? null,
            sortBy: $data['sort_by'] ?? 'created_at',
            sortDirection: $data['sort_direction'] ?? 'desc',
            page: $data['page'] ?? 1,
            perPage: $data['per_page'] ?? 20
        );
    }
    
    public function toArray(): array
    {
        return [
            'query' => $this->query,
            'status' => $this->status,
            'membership_type' => $this->membershipType,
            'province_id' => $this->provinceId,
            'district_id' => $this->districtId,
            'ward_id' => $this->wardId,
            'sponsor_id' => $this->sponsorId,
            'registered_from' => $this->registeredFrom?->format('Y-m-d'),
            'registered_to' => $this->registeredTo?->format('Y-m-d'),
            'activated_from' => $this->activatedFrom?->format('Y-m-d'),
            'activated_to' => $this->activatedTo?->format('Y-m-d'),
            'geography_tier' => $this->geographyTier,
            'sort_by' => $this->sortBy,
            'sort_direction' => $this->sortDirection,
            'page' => $this->page,
            'per_page' => $this->perPage,
        ];
    }
    
    public function getOffset(): int
    {
        return ($this->page - 1) * $this->perPage;
    }
    
    public function hasGeographyFilter(): bool
    {
        return $this->provinceId !== null 
            || $this->districtId !== null 
            || $this->wardId !== null;
    }
    
    public function hasDateFilter(): bool
    {
        return $this->registeredFrom !== null 
            || $this->registeredTo !== null 
            || $this->activatedFrom !== null 
            || $this->activatedTo !== null;
    }
}
```

### **5.4.4.3 Search Result DTO**

```php
<?php

// app/Contexts/Membership/Application/Queries/Results/MemberSearchResult.php

namespace App\Contexts\Membership\Application\Queries\Results;

final class MemberSearchResult
{
    public function __construct(
        public readonly string $id,
        public readonly string $membershipNumber,
        public readonly string $fullName,
        public readonly string $email,
        public readonly string $phone,
        public readonly string $status,
        public readonly string $statusDisplay,
        public readonly string $membershipType,
        public readonly ?string $provinceName,
        public readonly ?string $districtName,
        public readonly ?string $wardName,
        public readonly ?int $provinceId,
        public readonly ?int $districtId,
        public readonly ?int $wardId,
        public readonly string $geographyTier,
        public readonly ?int $sponsorId,
        public readonly ?string $sponsorName,
        public readonly ?\DateTimeInterface $approvedAt,
        public readonly ?int $approvedBy,
        public readonly ?string $approvedByName,
        public readonly ?\DateTimeInterface $activatedAt,
        public readonly ?string $paymentId,
        public readonly ?\DateTimeInterface $geographyEnrichedAt,
        public readonly \DateTimeInterface $createdAt,
        public readonly \DateTimeInterface $updatedAt,
        public readonly array $privileges = []
    ) {}
    
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'membership_number' => $this->membershipNumber,
            'full_name' => $this->fullName,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'status_display' => $this->statusDisplay,
            'membership_type' => $this->membershipType,
            'province_name' => $this->provinceName,
            'district_name' => $this->districtName,
            'ward_name' => $this->wardName,
            'province_id' => $this->provinceId,
            'district_id' => $this->districtId,
            'ward_id' => $this->wardId,
            'geography_tier' => $this->geographyTier,
            'sponsor_id' => $this->sponsorId,
            'sponsor_name' => $this->sponsorName,
            'approved_at' => $this->approvedAt?->format('Y-m-d H:i:s'),
            'approved_by' => $this->approvedBy,
            'approved_by_name' => $this->approvedByName,
            'activated_at' => $this->activatedAt?->format('Y-m-d H:i:s'),
            'payment_id' => $this->paymentId,
            'geography_enriched_at' => $this->geographyEnrichedAt?->format('Y-m-d H:i:s'),
            'created_at' => $this->createdAt->format('Y-m-d H:i:s'),
            'updated_at' => $this->updatedAt->format('Y-m-d H:i:s'),
            'privileges' => $this->privileges,
            'can_vote' => $this->privileges['vote'] ?? false,
            'can_access_forum' => $this->privileges['forum'] ?? false,
            'can_hold_office' => $this->privileges['office'] ?? false,
        ];
    }
}
```

### **5.4.4.4 Search Query Interface**

```php
<?php

// app/Contexts/Membership/Application/Queries/MemberSearchQueryInterface.php

namespace App\Contexts\Membership\Application\Queries;

use App\Contexts\Membership\Application\Queries\DTOs\MemberSearchCriteria;
use App\Contexts\Membership\Application\Queries\Results\MemberSearchResult;

interface MemberSearchQueryInterface
{
    /**
     * Search members with pagination
     */
    public function search(MemberSearchCriteria $criteria): array;
    
    /**
     * Count total results for search criteria
     */
    public function count(MemberSearchCriteria $criteria): int;
    
    /**
     * Get paginated search results with metadata
     */
    public function paginate(MemberSearchCriteria $criteria): array;
    
    /**
     * Find member by ID for read model
     */
    public function find(string $id): ?MemberSearchResult;
    
    /**
     * Find member by membership number
     */
    public function findByMembershipNumber(string $membershipNumber): ?MemberSearchResult;
    
    /**
     * Get statistics for search criteria
     */
    public function getStatistics(MemberSearchCriteria $criteria): array;
}
```

### **5.4.4.5 Eloquent Member Search Query Implementation**

```php
<?php

// app/Contexts/Membership/Infrastructure/Queries/EloquentMemberSearchQuery.php

namespace App\Contexts\Membership\Infrastructure\Queries;

use App\Contexts\Membership\Application\Queries\MemberSearchQueryInterface;
use App\Contexts\Membership\Application\Queries\DTOs\MemberSearchCriteria;
use App\Contexts\Membership\Application\Queries\Results\MemberSearchResult;
use App\Contexts\Membership\Infrastructure\Database\Models\MemberModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class EloquentMemberSearchQuery implements MemberSearchQueryInterface
{
    private const CACHE_TTL = 300; // 5 minutes
    private const CACHE_PREFIX = 'member_search:';
    
    public function search(MemberSearchCriteria $criteria): array
    {
        $query = $this->buildBaseQuery($criteria);
        
        // Apply sorting
        $this->applySorting($query, $criteria);
        
        // Apply pagination
        $query->skip($criteria->getOffset())
              ->limit($criteria->perPage);
        
        $models = $query->get();
        
        return $models->map(function ($model) {
            return $this->mapToResult($model);
        })->all();
    }
    
    public function count(MemberSearchCriteria $criteria): int
    {
        $cacheKey = $this->buildCacheKey('count', $criteria);
        
        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($criteria) {
            $query = $this->buildBaseQuery($criteria);
            return $query->count();
        });
    }
    
    public function paginate(MemberSearchCriteria $criteria): array
    {
        $results = $this->search($criteria);
        $total = $this->count($criteria);
        
        return [
            'data' => array_map(fn($r) => $r->toArray(), $results),
            'meta' => [
                'total' => $total,
                'per_page' => $criteria->perPage,
                'current_page' => $criteria->page,
                'last_page' => ceil($total / $criteria->perPage),
                'from' => $criteria->getOffset() + 1,
                'to' => min($criteria->getOffset() + $criteria->perPage, $total),
            ],
            'criteria' => $criteria->toArray(),
        ];
    }
    
    public function find(string $id): ?MemberSearchResult
    {
        $cacheKey = $this->buildCacheKey('find', $id);
        
        $model = Cache::remember($cacheKey, self::CACHE_TTL, function () use ($id) {
            return MemberModel::find($id);
        });
        
        if (!$model) {
            return null;
        }
        
        return $this->mapToResult($model);
    }
    
    public function findByMembershipNumber(string $membershipNumber): ?MemberSearchResult
    {
        $cacheKey = $this->buildCacheKey('find_by_number', $membershipNumber);
        
        $model = Cache::remember($cacheKey, self::CACHE_TTL, function () use ($membershipNumber) {
            return MemberModel::where('membership_number', $membershipNumber)->first();
        });
        
        if (!$model) {
            return null;
        }
        
        return $this->mapToResult($model);
    }
    
    public function getStatistics(MemberSearchCriteria $criteria): array
    {
        $cacheKey = $this->buildCacheKey('stats', $criteria);
        
        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($criteria) {
            $baseQuery = $this->buildBaseQuery($criteria);
            
            // Get counts by status
            $statusCounts = (clone $baseQuery)
                ->select('status', DB::raw('COUNT(*) as count'))
                ->groupBy('status')
                ->pluck('count', 'status')
                ->all();
            
            // Get counts by membership type
            $typeCounts = (clone $baseQuery)
                ->selectRaw("JSON_UNQUOTE(JSON_EXTRACT(personal_info, '$.membership_type')) as membership_type")
                ->selectRaw('COUNT(*) as count')
                ->groupBy('membership_type')
                ->pluck('count', 'membership_type')
                ->all();
            
            // Get counts by geography tier
            $tierCounts = (clone $baseQuery)
                ->selectRaw("CASE 
                    WHEN geography->>'province_id' IS NOT NULL THEN 'advanced'
                    WHEN geography->>'province' IS NOT NULL THEN 'basic'
                    ELSE 'none'
                END as geography_tier")
                ->selectRaw('COUNT(*) as count')
                ->groupBy('geography_tier')
                ->pluck('count', 'geography_tier')
                ->all();
            
            // Get registration trend (last 30 days)
            $registrationTrend = (clone $baseQuery)
                ->where('created_at', '>=', now()->subDays(30))
                ->selectRaw('DATE(created_at) as date')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('date')
                ->orderBy('date')
                ->get()
                ->mapWithKeys(fn($item) => [$item->date => $item->count])
                ->all();
            
            // Get top sponsors
            $topSponsors = (clone $baseQuery)
                ->whereNotNull('sponsor_id')
                ->select('sponsor_id', DB::raw('COUNT(*) as count'))
                ->groupBy('sponsor_id')
                ->orderByDesc('count')
                ->limit(10)
                ->get()
                ->map(fn($item) => [
                    'sponsor_id' => $item->sponsor_id,
                    'count' => $item->count,
                ])
                ->all();
            
            return [
                'total' => $baseQuery->count(),
                'by_status' => $statusCounts,
                'by_membership_type' => $typeCounts,
                'by_geography_tier' => $tierCounts,
                'registration_trend' => $registrationTrend,
                'top_sponsors' => $topSponsors,
                'average_age_days' => $this->calculateAverageAge($baseQuery),
                'activation_rate' => $this->calculateActivationRate($baseQuery),
            ];
        });
    }
    
    private function buildBaseQuery(MemberSearchCriteria $criteria)
    {
        $query = MemberModel::query();
        
        // Apply text search
        if ($criteria->query) {
            $query->where(function ($q) use ($criteria) {
                $q->where('membership_number', 'LIKE', "%{$criteria->query}%")
                  ->orWhereRaw("personal_info->>'full_name' LIKE ?", ["%{$criteria->query}%"])
                  ->orWhereRaw("personal_info->>'email' LIKE ?", ["%{$criteria->query}%"])
                  ->orWhereRaw("personal_info->>'phone' LIKE ?", ["%{$criteria->query}%"]);
            });
        }
        
        // Apply status filter
        if ($criteria->status) {
            $query->where('status', $criteria->status);
        }
        
        // Apply membership type filter
        if ($criteria->membershipType) {
            $query->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(personal_info, '$.membership_type')) = ?", [$criteria->membershipType]);
        }
        
        // Apply geography filters
        if ($criteria->provinceId) {
            $query->whereRaw("geography->>'province_id' = ?", [$criteria->provinceId]);
        }
        
        if ($criteria->districtId) {
            $query->whereRaw("geography->>'district_id' = ?", [$criteria->districtId]);
        }
        
        if ($criteria->wardId) {
            $query->whereRaw("geography->>'ward_id' = ?", [$criteria->wardId]);
        }
        
        // Apply sponsor filter
        if ($criteria->sponsorId) {
            $query->where('sponsor_id', $criteria->sponsorId);
        }
        
        // Apply date filters
        if ($criteria->registeredFrom) {
            $query->where('created_at', '>=', $criteria->registeredFrom);
        }
        
        if ($criteria->registeredTo) {
            $query->where('created_at', '<=', $criteria->registeredTo);
        }
        
        if ($criteria->activatedFrom) {
            $query->where('activated_at', '>=', $criteria->activatedFrom);
        }
        
        if ($criteria->activatedTo) {
            $query->where('activated_at', '<=', $criteria->activatedTo);
        }
        
        // Apply geography tier filter
        if ($criteria->geographyTier) {
            $query->where(function ($q) use ($criteria) {
                switch ($criteria->geographyTier) {
                    case 'advanced':
                        $q->whereNotNull(DB::raw("geography->>'province_id'"));
                        break;
                    case 'basic':
                        $q->whereNotNull(DB::raw("geography->>'province'"))
                          ->whereNull(DB::raw("geography->>'province_id'"));
                        break;
                    case 'none':
                        $q->whereNull(DB::raw("geography->>'province'"));
                        break;
                }
            });
        }
        
        return $query;
    }
    
    private function applySorting($query, MemberSearchCriteria $criteria): void
    {
        $sortField = $this->mapSortField($criteria->sortBy);
        $sortDirection = strtolower($criteria->sortDirection) === 'asc' ? 'asc' : 'desc';
        
        switch ($sortField) {
            case 'full_name':
                $query->orderByRaw("personal_info->>'full_name' {$sortDirection}");
                break;
            case 'email':
                $query->orderByRaw("personal_info->>'email' {$sortDirection}");
                break;
            case 'membership_type':
                $query->orderByRaw("JSON_UNQUOTE(JSON_EXTRACT(personal_info, '$.membership_type')) {$sortDirection}");
                break;
            default:
                $query->orderBy($sortField, $sortDirection);
        }
    }
    
    private function mapSortField(string $field): string
    {
        $mapping = [
            'name' => 'full_name',
            'email' => 'email',
            'phone' => 'phone',
            'membership_number' => 'membership_number',
            'status' => 'status',
            'membership_type' => 'membership_type',
            'created_at' => 'created_at',
            'activated_at' => 'activated_at',
            'approved_at' => 'approved_at',
        ];
        
        return $mapping[$field] ?? $field;
    }
    
    private function mapToResult(MemberModel $model): MemberSearchResult
    {
        $personalInfo = json_decode($model->personal_info, true);
        $geography = json_decode($model->geography ?? '{}', true);
        
        // Determine privileges based on status
        $privileges = $this->calculatePrivileges($model->status);
        
        // Get sponsor name if available (would come from a join or separate query)
        $sponsorName = null;
        if ($model->sponsor_id) {
            // This would ideally come from a joined query or cached lookup
            $sponsorName = $this->getSponsorName($model->sponsor_id);
        }
        
        // Get approver name if available
        $approvedByName = null;
        if ($model->approved_by) {
            $approvedByName = $this->getUserName($model->approved_by);
        }
        
        return new MemberSearchResult(
            id: $model->id,
            membershipNumber: $model->membership_number,
            fullName: $personalInfo['full_name'] ?? '',
            email: $personalInfo['email'] ?? '',
            phone: $personalInfo['phone'] ?? '',
            status: $model->status,
            statusDisplay: $this->getStatusDisplayName($model->status),
            membershipType: $personalInfo['membership_type'] ?? 'full',
            provinceName: $geography['province'] ?? null,
            districtName: $geography['district'] ?? null,
            wardName: $geography['ward'] ?? null,
            provinceId: $geography['province_id'] ?? null,
            districtId: $geography['district_id'] ?? null,
            wardId: $geography['ward_id'] ?? null,
            geographyTier: $this->determineGeographyTier($geography),
            sponsorId: $model->sponsor_id,
            sponsorName: $sponsorName,
            approvedAt: $model->approved_at,
            approvedBy: $model->approved_by,
            approvedByName: $approvedByName,
            activatedAt: $model->activated_at,
            paymentId: $model->payment_id,
            geographyEnrichedAt: $model->geography_enriched_at,
            createdAt: $model->created_at,
            updatedAt: $model->updated_at,
            privileges: $privileges
        );
    }
    
    private function calculatePrivileges(string $status): array
    {
        // This should match the privileges in MemberStatus value object
        $privileges = [
            'draft' => ['vote' => false, 'forum' => false, 'office' => false],
            'pending' => ['vote' => false, 'forum' => false, 'office' => false],
            'under_review' => ['vote' => false, 'forum' => false, 'office' => false],
            'approved' => ['vote' => false, 'forum' => true, 'office' => false],
            'awaiting_payment' => ['vote' => false, 'forum' => true, 'office' => false],
            'active' => ['vote' => true, 'forum' => true, 'office' => true],
            'suspended' => ['vote' => false, 'forum' => false, 'office' => false],
            'expired' => ['vote' => false, 'forum' => false, 'office' => false],
            'terminated' => ['vote' => false, 'forum' => false, 'office' => false],
        ];
        
        return $privileges[$status] ?? ['vote' => false, 'forum' => false, 'office' => false];
    }
    
    private function getStatusDisplayName(string $status): string
    {
        $displayNames = [
            'draft' => 'Draft',
            'pending' => 'Pending',
            'under_review' => 'Under Review',
            'approved' => 'Approved',
            'awaiting_payment' => 'Awaiting Payment',
            'active' => 'Active',
            'suspended' => 'Suspended',
            'expired' => 'Expired',
            'terminated' => 'Terminated',
        ];
        
        return $displayNames[$status] ?? ucfirst($status);
    }
    
    private function determineGeographyTier(array $geography): string
    {
        if (!empty($geography['province_id'])) {
            return 'advanced';
        }
        
        if (!empty($geography['province'])) {
            return 'basic';
        }
        
        return 'none';
    }
    
    private function getSponsorName(int $sponsorId): ?string
    {
        // This would typically come from a cached lookup or joined query
        // For now, return null - in production, this would be implemented
        return null;
    }
    
    private function getUserName(int $userId): ?string
    {
        // This would typically come from a cached lookup or joined query
        // For now, return null - in production, this would be implemented
        return null;
    }
    
    private function calculateAverageAge($query): ?float
    {
        $average = $query->selectRaw('AVG(DATEDIFF(NOW(), created_at)) as avg_age')
                        ->value('avg_age');
        
        return $average ? round((float) $average, 2) : null;
    }
    
    private function calculateActivationRate($query): ?float
    {
        $total = $query->count();
        $active = (clone $query)->where('status', 'active')->count();
        
        if ($total === 0) {
            return null;
        }
        
        return round(($active / $total) * 100, 2);
    }
    
    private function buildCacheKey(string $type, mixed $criteria): string
    {
        if ($criteria instanceof MemberSearchCriteria) {
            $key = md5(serialize($criteria->toArray()));
        } else {
            $key = (string) $criteria;
        }
        
        return self::CACHE_PREFIX . $type . ':' . $key;
    }
    
    public function clearCache(string $memberId = null): void
    {
        if ($memberId) {
            // Clear specific member cache
            Cache::forget($this->buildCacheKey('find', $memberId));
            
            // Also clear by membership number if we have it
            $member = MemberModel::find($memberId);
            if ($member) {
                Cache::forget($this->buildCacheKey('find_by_number', $member->membership_number));
            }
        }
        
        // Clear all search caches (be careful in production - might want more targeted clearing)
        // Cache::tags(['member_search'])->flush();
    }
}
```

### **5.4.4.6 Query Service Provider**

```php
<?php

// app/Contexts/Membership/Infrastructure/Providers/QueryServiceProvider.php

namespace App\Contexts\Membership\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use App\Contexts\Membership\Application\Queries\MemberSearchQueryInterface;
use App\Contexts\Membership\Infrastructure\Queries\EloquentMemberSearchQuery;

class QueryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            MemberSearchQueryInterface::class,
            EloquentMemberSearchQuery::class
        );
        
        // Register other query interfaces here as we create them
        // $this->app->bind(MemberStatisticsQueryInterface::class, ...);
        // $this->app->bind(GeographyReportQueryInterface::class, ...);
    }
    
    public function boot(): void
    {
        //
    }
}
```

**Register in config/app.php:**
```php
'providers' => [
    // ...
    App\Contexts\Membership\Infrastructure\Providers\QueryServiceProvider::class,
],
```

### **5.4.4.7 Tests for Member Search Query**

```php
<?php

// tests/Unit/Contexts/Membership/Infrastructure/Queries/EloquentMemberSearchQueryTest.php

namespace Tests\Unit\Contexts\Membership\Infrastructure\Queries;

use Tests\TestCase;
use App\Contexts\Membership\Application\Queries\MemberSearchQueryInterface;
use App\Contexts\Membership\Application\Queries\DTOs\MemberSearchCriteria;
use App\Contexts\Membership\Infrastructure\Database\Models\MemberModel;
use App\Contexts\Membership\Domain\Models\Member;
use App\Contexts\Membership\Domain\ValueObjects\PersonalInfo;
use App\Contexts\Membership\Domain\ValueObjects\SimpleGeography;
use App\Contexts\Membership\Domain\ValueObjects\MembershipNumber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

class EloquentMemberSearchQueryTest extends TestCase
{
    use RefreshDatabase;
    
    private MemberSearchQueryInterface $query;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        $this->query = app(MemberSearchQueryInterface::class);
        
        // Seed test data
        $this->seedTestMembers();
    }
    
    private function seedTestMembers(): void
    {
        // Create members with different characteristics
        $members = [
            // Active member with advanced geography
            [
                'personal_info' => json_encode([
                    'full_name' => 'Ram Bahadur',
                    'email' => 'ram@example.com',
                    'phone' => '+9779841234001',
                    'membership_type' => 'full',
                ]),
                'membership_number' => 'UML-2024-F-0001',
                'geography' => json_encode([
                    'province' => 'Province 3',
                    'district' => 'Kathmandu',
                    'ward' => 'Ward 5',
                    'province_id' => 3,
                    'district_id' => 25,
                    'ward_id' => 125,
                ]),
                'status' => 'active',
                'sponsor_id' => null,
                'approved_at' => now()->subDays(10),
                'activated_at' => now()->subDays(5),
                'payment_id' => 'pay_001',
                'created_at' => now()->subDays(30),
            ],
            
            // Pending member with basic geography
            [
                'personal_info' => json_encode([
                    'full_name' => 'Sita Devi',
                    'email' => 'sita@example.com',
                    'phone' => '+9779841234002',
                    'membership_type' => 'youth',
                ]),
                'membership_number' => 'UML-2024-Y-0001',
                'geography' => json_encode([
                    'province' => 'Province 3',
                    'district' => 'Lalitpur',
                    'ward' => 'Ward 3',
                ]),
                'status' => 'pending',
                'sponsor_id' => 1, // Sponsored by Ram
                'created_at' => now()->subDays(5),
            ],
            
            // Draft member without geography
            [
                'personal_info' => json_encode([
                    'full_name' => 'Hari Prasad',
                    'email' => 'hari@example.com',
                    'phone' => '+9779841234003',
                    'membership_type' => 'student',
                ]),
                'membership_number' => 'UML-2024-S-0001',
                'geography' => json_encode([]),
                'status' => 'draft',
                'created_at' => now()->subDays(2),
            ],
            
            // Active member in different province
            [
                'personal_info' => json_encode([
                    'full_name' => 'Gopal Sharma',
                    'email' => 'gopal@example.com',
                    'phone' => '+9779841234004',
                    'membership_type' => 'full',
                ]),
                'membership_number' => 'UML-2024-F-0002',
                'geography' => json_encode([
                    'province' => 'Province 1',
                    'district' => 'Biratnagar',
                    'ward' => 'Ward 1',
                    'province_id' => 1,
                    'district_id' => 10,
                    'ward_id' => 101,
                ]),
                'status' => 'active',
                'activated_at' => now()->subDays(15),
                'created_at' => now()->subDays(45),
            ],
        ];
        
        foreach ($members as $memberData) {
            MemberModel::create(array_merge([
                'id' => (string) \Illuminate\Support\Str::uuid(),
            ], $memberData));
        }
    }
    
    /** @test */
    public function it_searches_members_without_criteria(): void
    {
        $criteria = new MemberSearchCriteria();
        
        $results = $this->query->search($criteria);
        $total = $this->query->count($criteria);
        
        $this->assertCount(4, $results);
        $this->assertEquals(4, $total);
        
        // Verify first result structure
        $firstResult = $results[0];
        $this->assertInstanceOf(\App\Contexts\Membership\Application\Queries\Results\MemberSearchResult::class, $firstResult);
        $this->assertNotEmpty($firstResult->id);
        $this->assertNotEmpty($firstResult->fullName);
        $this->assertNotEmpty($firstResult->membershipNumber);
    }
    
    /** @test */
    public function it_searches_members_by_text_query(): void
    {
        $criteria = new MemberSearchCriteria(query: 'Ram');
        
        $results = $this->query->search($criteria);
        $total = $this->query->count($criteria);
        
        $this->assertCount(1, $results);
        $this->assertEquals(1, $total);
        $this->assertEquals('Ram Bahadur', $results[0]->fullName);
    }
    
    /** @test */
    public function it_searches_members_by_status(): void
    {
        $criteria = new MemberSearchCriteria(status: 'active');
        
        $results = $this->query->search($criteria);
        $total = $this->query->count($criteria);
        
        $this->assertCount(2, $results);
        $this->assertEquals(2, $total);
        
        foreach ($results as $result) {
            $this->assertEquals('active', $result->status);
        }
    }
    
    /** @test */
    public function it_searches_members_by_membership_type(): void
    {
        $criteria = new MemberSearchCriteria(membershipType: 'youth');
        
        $results = $this->query->search($criteria);
        
        $this->assertCount(1, $results);
        $this->assertEquals('Sita Devi', $results[0]->fullName);
        $this->assertEquals('youth', $results[0]->membershipType);
    }
    
    /** @test */
    public function it_searches_members_by_geography_tier(): void
    {
        // Search for advanced geography
        $criteria = new MemberSearchCriteria(geographyTier: 'advanced');
        
        $results = $this->query->search($criteria);
        
        $this->assertCount(2, $results);
        foreach ($results as $result) {
            $this->assertEquals('advanced', $result->geographyTier);
        }
        
        // Search for basic geography
        $criteria = new MemberSearchCriteria(geographyTier: 'basic');
        
        $results = $this->query->search($crit

# 🚀 **PHASE 5: CQRS QUERY LAYER & READ MODELS**

## **📁 ARCHITECTURE OVERVIEW**

```
CQRS Pattern Goals:
1. Separate read/write models for scalability
2. Optimized queries for dashboards
3. Materialized views for complex aggregations
4. Event-driven view updates
```

---

## **STEP 5.1: QUERY MODELS & PROJECTIONS**

### **5.1.1 Create Query Layer Directories**

```bash
mkdir -p app/Contexts/Membership/Application/{Queries,Projections}
mkdir -p app/Contexts/Membership/Infrastructure/ReadModels
mkdir -p tests/Unit/Contexts/Membership/Application/Queries
```

### **5.1.2 Base Query Interface**

```php
<?php

// app/Contexts/Membership/Application/Queries/Query.php

namespace App\Contexts\Membership\Application\Queries;

interface Query
{
    // Marker interface for all queries
}
```

### **5.1.3 Query Handler Interface**

```php
<?php

// app/Contexts/Membership/Application/Queries/QueryHandler.php

namespace App\Contexts\Membership\Application\Queries;

interface QueryHandler
{
    /**
     * Handle the query and return results
     */
    public function handle(Query $query): mixed;
}
```

### **5.1.4 Read Model Interfaces**

```php
<?php

// app/Contexts/Membership/Application/Queries/MemberReadModelInterface.php

namespace App\Contexts\Membership\Application\Queries;

interface MemberReadModelInterface
{
    public function findMemberSummary(string $memberId): ?array;
    
    public function findMemberDetails(string $memberId): ?array;
    
    public function findPendingApplications(
        ?int $committeeMemberId = null,
        int $page = 1,
        int $perPage = 20
    ): array;
    
    public function findActiveMembersByGeography(
        ?int $provinceId = null,
        ?int $districtId = null,
        ?int $wardId = null,
        int $page = 1,
        int $perPage = 50
    ): array;
    
    public function countMembersByStatus(string $status): int;
    
    public function countMembersByGeographyTier(string $tier): int;
    
    public function getMemberStatistics(): array;
    
    public function getGeographyStatistics(): array;
    
    public function getSponsorshipStatistics(int $sponsorId): array;
    
    public function searchMembers(
        string $searchTerm,
        array $filters = [],
        int $page = 1,
        int $perPage = 20
    ): array;
}
```

### **5.1.5 Member Summary Read Model**

```php
<?php

// app/Contexts/Membership/Infrastructure/ReadModels/MemberSummaryReadModel.php

namespace App\Contexts\Membership\Infrastructure\ReadModels;

use App\Contexts\Membership\Application\Queries\MemberReadModelInterface;
use Illuminate\Support\Facades\DB;

class MemberSummaryReadModel implements MemberReadModelInterface
{
    public function findMemberSummary(string $memberId): ?array
    {
        $member = DB::table('members')
            ->select([
                'id',
                'membership_number',
                DB::raw("personal_info->>'full_name' as full_name"),
                DB::raw("personal_info->>'email' as email"),
                DB::raw("personal_info->>'phone' as phone"),
                'status',
                'geography',
                'sponsor_id',
                'approved_by',
                'approved_at',
                'payment_id',
                'activated_at',
                'suspension_reason',
                'geography_enriched_at',
                'created_at',
                'updated_at',
            ])
            ->where('id', $memberId)
            ->first();
        
        if (!$member) {
            return null;
        }
        
        return $this->formatMemberSummary($member);
    }
    
    public function findMemberDetails(string $memberId): ?array
    {
        $member = DB::table('members')
            ->select('*')
            ->where('id', $memberId)
            ->first();
        
        if (!$member) {
            return null;
        }
        
        return $this->formatMemberDetails($member);
    }
    
    public function findPendingApplications(
        ?int $committeeMemberId = null,
        int $page = 1,
        int $perPage = 20
    ): array {
        $query = DB::table('members')
            ->select([
                'id',
                'membership_number',
                DB::raw("personal_info->>'full_name' as full_name"),
                DB::raw("personal_info->>'email' as email"),
                DB::raw("personal_info->>'phone' as phone"),
                'geography',
                'created_at',
            ])
            ->where('status', 'pending')
            ->orderBy('created_at', 'asc');
        
        // TODO: Filter by committee geography when available
        // if ($committeeMemberId) {
        //     $query->whereInGeographyJurisdiction($committeeMemberId);
        // }
        
        $total = $query->count();
        $applications = $query
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(function ($application) {
                return $this->formatPendingApplication($application);
            })
            ->all();
        
        return [
            'data' => $applications,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => ceil($total / $perPage),
            ],
        ];
    }
    
    public function findActiveMembersByGeography(
        ?int $provinceId = null,
        ?int $districtId = null,
        ?int $wardId = null,
        int $page = 1,
        int $perPage = 50
    ): array {
        $query = DB::table('members')
            ->select([
                'id',
                'membership_number',
                DB::raw("personal_info->>'full_name' as full_name"),
                DB::raw("personal_info->>'phone' as phone"),
                'geography',
                'activated_at',
            ])
            ->where('status', 'active');
        
        // Filter by geography if provided
        if ($provinceId) {
            $query->whereRaw("geography->>'province_id' = ?", [$provinceId]);
        }
        
        if ($districtId) {
            $query->whereRaw("geography->>'district_id' = ?", [$districtId]);
        }
        
        if ($wardId) {
            $query->whereRaw("geography->>'ward_id' = ?", [$wardId]);
        }
        
        $total = $query->count();
        $members = $query
            ->orderBy('activated_at', 'desc')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(function ($member) {
                return $this->formatActiveMember($member);
            })
            ->all();
        
        return [
            'data' => $members,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => ceil($total / $perPage),
            ],
        ];
    }
    
    public function countMembersByStatus(string $status): int
    {
        return DB::table('members')
            ->where('status', $status)
            ->count();
    }
    
    public function countMembersByGeographyTier(string $tier): int
    {
        return DB::table('members')
            ->whereRaw("geography->>'tier' = ?", [$tier])
            ->count();
    }
    
    public function getMemberStatistics(): array
    {
        $stats = DB::table('members')
            ->selectRaw("
                COUNT(*) as total_members,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_members,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_applications,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_pending_activation,
                COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_members,
                COUNT(CASE WHEN sponsor_id IS NOT NULL THEN 1 END) as sponsored_members,
                COUNT(DISTINCT sponsor_id) as unique_sponsors,
                AVG(EXTRACT(EPOCH FROM (activated_at - created_at))/86400) as avg_activation_days
            ")
            ->first();
        
        $growth = DB::table('members')
            ->selectRaw("
                DATE(created_at) as date,
                COUNT(*) as count
            ")
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get();
        
        return [
            'totals' => (array) $stats,
            'growth' => $growth->pluck('count', 'date')->toArray(),
            'geography_tiers' => [
                'none' => $this->countMembersByGeographyTier('none'),
                'basic' => $this->countMembersByGeographyTier('basic'),
                'advanced' => $this->countMembersByGeographyTier('advanced'),
            ],
        ];
    }
    
    public function getGeographyStatistics(): array
    {
        // For basic tier (text geography)
        $basicGeography = DB::table('members')
            ->selectRaw("
                geography->>'province' as province,
                COUNT(*) as count
            ")
            ->whereRaw("geography->>'tier' = 'basic'")
            ->whereNotNull("geography->>'province'")
            ->groupBy(DB::raw("geography->>'province'"))
            ->orderByDesc('count')
            ->limit(10)
            ->get()
            ->toArray();
        
        // For advanced tier (ID geography)
        $advancedGeography = DB::table('members')
            ->selectRaw("
                geography->>'province_id' as province_id,
                geography->>'province' as province_name,
                COUNT(*) as count
            ")
            ->whereRaw("geography->>'tier' = 'advanced'")
            ->whereNotNull("geography->>'province_id'")
            ->groupBy(DB::raw("geography->>'province_id', geography->>'province'"))
            ->orderByDesc('count')
            ->limit(10)
            ->get()
            ->toArray();
        
        return [
            'basic_geography' => $basicGeography,
            'advanced_geography' => $advancedGeography,
            'tier_distribution' => [
                'none' => $this->countMembersByGeographyTier('none'),
                'basic' => $this->countMembersByGeographyTier('basic'),
                'advanced' => $this->countMembersByGeographyTier('advanced'),
            ],
        ];
    }
    
    public function getSponsorshipStatistics(int $sponsorId): array
    {
        $stats = DB::table('members')
            ->selectRaw("
                COUNT(*) as total_sponsored,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sponsored,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_sponsored,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_sponsored
            ")
            ->where('sponsor_id', $sponsorId)
            ->first();
        
        $recentSponsored = DB::table('members')
            ->select([
                'id',
                'membership_number',
                DB::raw("personal_info->>'full_name' as full_name"),
                'status',
                'created_at',
            ])
            ->where('sponsor_id', $sponsorId)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();
        
        return [
            'summary' => (array) $stats,
            'recent_sponsored' => $recentSponsored,
        ];
    }
    
    public function searchMembers(
        string $searchTerm,
        array $filters = [],
        int $page = 1,
        int $perPage = 20
    ): array {
        $query = DB::table('members')
            ->select([
                'id',
                'membership_number',
                DB::raw("personal_info->>'full_name' as full_name"),
                DB::raw("personal_info->>'email' as email"),
                DB::raw("personal_info->>'phone' as phone"),
                'status',
                'geography',
                'created_at',
            ]);
        
        // Search by name, email, phone, or membership number
        $query->where(function ($q) use ($searchTerm) {
            $q->whereRaw("personal_info->>'full_name' ILIKE ?", ["%{$searchTerm}%"])
              ->orWhereRaw("personal_info->>'email' ILIKE ?", ["%{$searchTerm}%"])
              ->orWhereRaw("personal_info->>'phone' ILIKE ?", ["%{$searchTerm}%"])
              ->orWhere('membership_number', 'ILIKE', "%{$searchTerm}%");
        });
        
        // Apply filters
        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        
        if (!empty($filters['geography_tier'])) {
            $query->whereRaw("geography->>'tier' = ?", [$filters['geography_tier']]);
        }
        
        if (!empty($filters['sponsor_id'])) {
            $query->where('sponsor_id', $filters['sponsor_id']);
        }
        
        $total = $query->count();
        $members = $query
            ->orderBy('created_at', 'desc')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(function ($member) {
                return $this->formatSearchResult($member);
            })
            ->all();
        
        return [
            'data' => $members,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => ceil($total / $perPage),
            ],
        ];
    }
    
    private function formatMemberSummary($member): array
    {
        $geography = json_decode($member->geography, true) ?? [];
        
        return [
            'id' => $member->id,
            'membership_number' => $member->membership_number,
            'full_name' => $member->full_name,
            'email' => $member->email,
            'phone' => $member->phone,
            'status' => $member->status,
            'geography' => [
                'display' => $this->formatGeographyDisplay($geography),
                'tier' => $geography['tier'] ?? 'none',
                'province_id' => $geography['province_id'] ?? null,
                'district_id' => $geography['district_id'] ?? null,
                'ward_id' => $geography['ward_id'] ?? null,
            ],
            'sponsor_id' => $member->sponsor_id,
            'approved_by' => $member->approved_by,
            'approved_at' => $member->approved_at,
            'payment_id' => $member->payment_id,
            'activated_at' => $member->activated_at,
            'geography_enriched_at' => $member->geography_enriched_at,
            'created_at' => $member->created_at,
            'updated_at' => $member->updated_at,
        ];
    }
    
    private function formatMemberDetails($member): array
    {
        $summary = $this->formatMemberSummary($member);
        $personalInfo = json_decode($member->personal_info, true) ?? [];
        
        $summary['personal_info'] = [
            'full_name' => $personalInfo['full_name'] ?? '',
            'email' => $personalInfo['email'] ?? '',
            'phone' => $personalInfo['phone'] ?? '',
            'first_name' => $personalInfo['first_name'] ?? '',
            'last_name' => $personalInfo['last_name'] ?? '',
        ];
        
        return $summary;
    }
    
    private function formatPendingApplication($application): array
    {
        $geography = json_decode($application->geography, true) ?? [];
        
        return [
            'id' => $application->id,
            'membership_number' => $application->membership_number,
            'full_name' => $application->full_name,
            'email' => $application->email,
            'phone' => $application->phone,
            'geography' => $this->formatGeographyDisplay($geography),
            'geography_tier' => $geography['tier'] ?? 'none',
            'created_at' => $application->created_at,
            'days_pending' => now()->diffInDays($application->created_at),
        ];
    }
    
    private function formatActiveMember($member): array
    {
        $geography = json_decode($member->geography, true) ?? [];
        
        return [
            'id' => $member->id,
            'membership_number' => $member->membership_number,
            'full_name' => $member->full_name,
            'phone' => $member->phone,
            'geography' => $this->formatGeographyDisplay($geography),
            'geography_tier' => $geography['tier'] ?? 'none',
            'activated_at' => $member->activated_at,
            'membership_duration_days' => now()->diffInDays($member->activated_at),
        ];
    }
    
    private function formatSearchResult($member): array
    {
        $geography = json_decode($member->geography, true) ?? [];
        
        return [
            'id' => $member->id,
            'membership_number' => $member->membership_number,
            'full_name' => $member->full_name,
            'email' => $member->email,
            'phone' => $member->phone,
            'status' => $member->status,
            'geography' => $this->formatGeographyDisplay($geography),
            'geography_tier' => $geography['tier'] ?? 'none',
            'created_at' => $member->created_at,
        ];
    }
    
    private function formatGeographyDisplay(array $geography): string
    {
        $parts = [];
        
        if (!empty($geography['province'])) {
            $parts[] = $geography['province'];
        }
        
        if (!empty($geography['district'])) {
            $parts[] = $geography['district'];
        }
        
        if (!empty($geography['ward'])) {
            $parts[] = $geography['ward'];
        }
        
        return $parts ? implode(' → ', $parts) : 'No geography';
    }
}
```

---

## **STEP 5.2: MATERIALIZED VIEWS FOR DASHBOARDS**

### **5.2.1 Create Materialized View Migration**

```php
<?php

// app/Contexts/Membership/Infrastructure/Database/Migrations/Tenant/[timestamp]_create_member_statistics_materialized_view.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Create materialized view for dashboard statistics
        DB::statement('
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_member_statistics AS
            SELECT 
                -- Daily aggregates
                DATE(created_at) as date,
                
                -- Registration counts
                COUNT(*) as total_registrations,
                COUNT(CASE WHEN status = \'active\' THEN 1 END) as active_registrations,
                COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_registrations,
                
                -- Geography tiers
                COUNT(CASE WHEN (geography->>\'tier\') = \'none\' THEN 1 END) as no_geography,
                COUNT(CASE WHEN (geography->>\'tier\') = \'basic\' THEN 1 END) as basic_geography,
                COUNT(CASE WHEN (geography->>\'tier\') = \'advanced\' THEN 1 END) as advanced_geography,
                
                -- Sponsorship
                COUNT(CASE WHEN sponsor_id IS NOT NULL THEN 1 END) as sponsored_registrations,
                
                -- Committee performance (when available)
                COUNT(CASE WHEN approved_by IS NOT NULL THEN 1 END) as committee_approved
                
            FROM members
            WHERE created_at >= CURRENT_DATE - INTERVAL \'90 days\'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        ');
        
        // Create index on materialized view
        DB::statement('
            CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_member_statistics_date 
            ON mv_member_statistics (date)
        ');
        
        // Create view for geography distribution
        DB::statement('
            CREATE VIEW vw_geography_distribution AS
            SELECT 
                geography->>\'tier\' as geography_tier,
                COUNT(*) as member_count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM members), 2) as percentage
            FROM members
            GROUP BY geography->>\'tier\'
            ORDER BY member_count DESC
        ');
        
        // Create view for status distribution
        DB::statement('
            CREATE VIEW vw_status_distribution AS
            SELECT 
                status,
                COUNT(*) as member_count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM members), 2) as percentage
            FROM members
            GROUP BY status
            ORDER BY member_count DESC
        ');
        
        // Create view for top sponsors
        DB::statement('
            CREATE VIEW vw_top_sponsors AS
            SELECT 
                sponsor_id,
                COUNT(*) as sponsored_count,
                COUNT(CASE WHEN status = \'active\' THEN 1 END) as active_sponsored,
                COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_sponsored
            FROM members
            WHERE sponsor_id IS NOT NULL
            GROUP BY sponsor_id
            ORDER BY sponsored_count DESC
            LIMIT 20
        ');
    }
    
    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS vw_top_sponsors');
        DB::statement('DROP VIEW IF EXISTS vw_status_distribution');
        DB::statement('DROP VIEW IF EXISTS vw_geography_distribution');
        DB::statement('DROP MATERIALIZED VIEW IF EXISTS mv_member_statistics');
    }
};
```

### **5.2.2 Materialized View Service**

```php
<?php

// app/Contexts/Membership/Infrastructure/Services/MaterializedViewService.php

namespace App\Contexts\Membership\Infrastructure\Services;

use Illuminate\Support\Facades\DB;

class MaterializedViewService
{
    /**
     * Refresh materialized views
     */
    public function refreshViews(): void
    {
        DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_member_statistics');
    }
    
    /**
     * Get dashboard statistics from materialized view
     */
    public function getDashboardStatistics(int $days = 30): array
    {
        $stats = DB::table('mv_member_statistics')
            ->selectRaw("
                SUM(total_registrations) as total_registrations,
                SUM(active_registrations) as active_registrations,
                SUM(pending_registrations) as pending_registrations,
                SUM(no_geography) as no_geography,
                SUM(basic_geography) as basic_geography,
                SUM(advanced_geography) as advanced_geography,
                SUM(sponsored_registrations) as sponsored_registrations,
                SUM(committee_approved) as committee_approved
            ")
            ->where('date', '>=', now()->subDays($days))
            ->first();
        
        $dailyTrend = DB::table('mv_member_statistics')
            ->select([
                'date',
                'total_registrations',
                'active_registrations',
            ])
            ->where('date', '>=', now()->subDays($days))
            ->orderBy('date')
            ->get()
            ->map(function ($row) {
                return [
                    'date' => $row->date,
                    'total' => (int) $row->total_registrations,
                    'active' => (int) $row->active_registrations,
                ];
            })
            ->all();
        
        return [
            'summary' => (array) $stats,
            'daily_trend' => $dailyTrend,
            'geography_distribution' => $this->getGeographyDistribution(),
            'status_distribution' => $this->getStatusDistribution(),
            'top_sponsors' => $this->getTopSponsors(),
        ];
    }
    
    /**
     * Get geography distribution from view
     */
    public function getGeographyDistribution(): array
    {
        return DB::table('vw_geography_distribution')
            ->get()
            ->map(function ($row) {
                return [
                    'tier' => $row->geography_tier ?: 'none',
                    'count' => (int) $row->member_count,
                    'percentage' => (float) $row->percentage,
                ];
            })
            ->all();
    }
    
    /**
     * Get status distribution from view
     */
    public function getStatusDistribution(): array
    {
        return DB::table('vw_status_distribution')
            ->get()
            ->map(function ($row) {
                return [
                    'status' => $row->status,
                    'count' => (int) $row->member_count,
                    'percentage' => (float) $row->percentage,
                ];
            })
            ->all();
    }
    
    /**
     * Get top sponsors from view
     */
    public function getTopSponsors(): array
    {
        return DB::table('vw_top_sponsors')
            ->get()
            ->map(function ($row) {
                return [
                    'sponsor_id' => (int) $row->sponsor_id,
                    'total_sponsored' => (int) $row->sponsored_count,
                    'active_sponsored' => (int) $row->active_sponsored,
                    'pending_sponsored' => (int) $row->pending_sponsored,
                    'conversion_rate' => $row->sponsored_count > 0 
                        ? round(($row->active_sponsored / $row->sponsored_count) * 100, 2)
                        : 0,
                ];
            })
            ->all();
    }
    
    /**
     * Get committee performance metrics
     */
    public function getCommitteePerformance(int $days = 30): array
    {
        $performance = DB::table('members')
            ->select([
                'approved_by as committee_member_id',
                DB::raw('COUNT(*) as total_approved'),
                DB::raw('AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/86400) as avg_approval_days'),
                DB::raw('MIN(approved_at) as first_approval'),
                DB::raw('MAX(approved_at) as last_approval'),
            ])
            ->whereNotNull('approved_by')
            ->where('approved_at', '>=', now()->subDays($days))
            ->groupBy('approved_by')
            ->orderByDesc('total_approved')
            ->get()
            ->map(function ($row) {
                return [
                    'committee_member_id' => (int) $row->committee_member_id,
                    'total_approved' => (int) $row->total_approved,
                    'avg_approval_days' => round((float) $row->avg_approval_days, 2),
                    'first_approval' => $row->first_approval,
                    'last_approval' => $row->last_approval,
                ];
            })
            ->all();
        
        return [
            'period_days' => $days,
            'total_approvals' => array_sum(array_column($performance, 'total_approved')),
            'committee_members' => $performance,
            'average_approval_time_days' => $this->calculateAverageApprovalTime($days),
        ];
    }
    
    private function calculateAverageApprovalTime(int $days): float
    {
        $avg = DB::table('members')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/86400) as avg_days')
            ->whereNotNull('approved_at')
            ->where('approved_at', '>=', now()->subDays($days))
            ->value('avg_days');
        
        return round($avg ?: 0, 2);
    }
}
```

---

## **STEP 5.3: QUERY HANDLERS**

### **5.3.1 GetMemberStatistics Query**

```php
<?php

// app/Contexts/Membership/Application/Queries/GetMemberStatisticsQuery.php

namespace App\Contexts\Membership\Application\Queries;

final class GetMemberStatisticsQuery implements Query
{
    public function __construct(
        public readonly ?int $days = 30,
        public readonly ?bool $includeTrends = true,
        public readonly ?bool $includeCommitteePerformance = false
    ) {}
}
```

```php
<?php

// app/Contexts/Membership/Application/Queries/GetMemberStatisticsHandler.php

namespace App\Contexts\Membership\Application\Queries;

use App\Contexts\Membership\Infrastructure\Services\MaterializedViewService;
use App\Contexts\Membership\Application\Queries\MemberReadModelInterface;

class GetMemberStatisticsHandler implements QueryHandler
{
    public function __construct(
        private MaterializedViewService $viewService,
        private MemberReadModelInterface $readModel
    ) {}
    
    public function handle(Query $query): array
    {
        if (!$query instanceof GetMemberStatisticsQuery) {
            throw new \InvalidArgumentException('Invalid query type');
        }
        
        $result = [
            'period_days' => $query->days,
            'timestamp' => now()->toIso8601String(),
        ];
        
        // Get basic statistics from read model
        $result['basic_statistics'] = $this->readModel->getMemberStatistics();
        
        // Get geography statistics
        $result['geography_statistics'] = $this->readModel->getGeographyStatistics();
        
        // Get dashboard statistics from materialized view
        $result['dashboard_statistics'] = $this->viewService->getDashboardStatistics($query->days);
        
        // Include committee performance if requested
        if ($query->includeCommitteePerformance) {
            $result['committee_performance'] = $this->viewService->getCommitteePerformance($query->days);
        }
        
        return $result;
    }
}
```

### **5.3.2 SearchMembers Query**

```php
<?php

// app/Contexts/Membership/Application/Queries/SearchMembersQuery.php

namespace App\Contexts\Membership\Application\Queries;

final class SearchMembersQuery implements Query
{
    public function __construct(
        public readonly string $searchTerm,
        public readonly ?array $filters = [],
        public readonly int $page = 1,
        public readonly int $perPage = 20
    ) {}
}
```

```php
<?php

// app/Contexts/Membership/Application/Queries/SearchMembersHandler.php

namespace App\Contexts\Membership\Application\Queries;

use App\Contexts\Membership\Application\Queries\MemberReadModelInterface;

class SearchMembersHandler implements QueryHandler
{
    public function __construct(
        private MemberReadModelInterface $readModel
    ) {}
    
    public function handle(Query $query): array
    {
        if (!$query instanceof SearchMembersQuery) {
            throw new \InvalidArgumentException('Invalid query type');
        }
        
        return $this->readModel->searchMembers(
            searchTerm: $query->searchTerm,
            filters: $query->filters,
            page: $query->page,
            perPage: $query->perPage
        );
    }
}
```

### **5.3.3 GetPendingApplications Query**

```php
<?php

// app/Contexts/Membership/Application/Queries/GetPendingApplicationsQuery.php

namespace App\Contexts\Membership\Application\Queries;

final class GetPendingApplicationsQuery implements Query
{
    public function __construct(
        public readonly ?int $committeeMemberId = null,
        public readonly int $page = 1,
        public readonly int $perPage = 20
    ) {}
}
```

```php
<?php

// app/Contexts/Membership/Application/Queries/GetPendingApplicationsHandler.php

namespace App\Contexts\Membership\Application\Queries;

use App\Contexts\Membership\Application\Queries\MemberReadModelInterface;

class GetPendingApplicationsHandler implements QueryHandler
{
    public function __construct(
        private MemberReadModelInterface $readModel
    ) {}
    
    public function handle(Query $query): array
    {
        if (!$query instanceof GetPendingApplicationsQuery) {
            throw new \InvalidArgumentException('Invalid query type');
        }
        
        return $this->readModel->findPendingApplications(
            committeeMemberId: $query->committeeMemberId,
            page: $query->page,
            perPage: $query->perPage
        );
    }
}
```

### **5.3.4 GetMemberDetails Query**

```php
<?php

// app/Contexts/Membership/Application/Queries/GetMemberDetailsQuery.php

namespace App\Contexts\Membership\Application\Queries;

final class GetMemberDetailsQuery implements Query
{
    public function __construct(
        public readonly string $memberId,
        public readonly bool $includeSponsorshipStats = false
    ) {}
}
```

```php
<?php

// app/Contexts/Membership/Application/Queries/GetMemberDetailsHandler.php

namespace App\Contexts\Membership\Application\Queries;

use App\Contexts\Membership\Application\Queries\MemberReadModelInterface;

class GetMemberDetailsHandler implements QueryHandler
{
    public function __construct(
        private MemberReadModelInterface $readModel
    ) {}
    
    public function handle(Query $query): array
    {
        if (!$query instanceof GetMemberDetailsQuery) {
            throw new \InvalidArgumentException('Invalid query type');
        }
        
        $member = $this->readModel->findMemberDetails($query->memberId);
        
        if (!$member) {
            return ['error' => 'Member not found'];
        }
        
        $result = ['member' => $member];
        
        // Include sponsorship statistics if requested and member is a sponsor
        if ($query->includeSponsorshipStats && isset($member['sponsor_id'])) {
            $result['sponsorship_statistics'] = $this->readModel->getSponsorshipStatistics(
                $member['sponsor_id']
            );
        }
        
        return $result;
    }
}
```

---

## **STEP 5.4: QUERY SERVICE PROVIDER**

### **5.4.1 Create QueryServiceProvider**

```php
<?php

// app/Contexts/Membership/Infrastructure/Providers/QueryServiceProvider.php

namespace App\Contexts\Membership\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use App\Contexts\Membership\Application\Queries\MemberReadModelInterface;
use App\Contexts\Membership\Infrastructure\ReadModels\MemberSummaryReadModel;
use App\Contexts\Membership\Infrastructure\Services\MaterializedViewService;
use App\Contexts\Membership\Application\Queries\GetMemberStatisticsHandler;
use App\Contexts\Membership\Application\Queries\SearchMembersHandler;
use App\Contexts\Membership\Application\Queries\GetPendingApplicationsHandler;
use App\Contexts\Membership\Application\Queries\GetMemberDetailsHandler;

class QueryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Read Models
        $this->app->bind(
            MemberReadModelInterface::class,
            MemberSummaryReadModel::class
        );
        
        // Services
        $this->app->singleton(MaterializedViewService::class, function ($app) {
            return new MaterializedViewService();
        });
        
        // Query Handlers
        $this->app->bind(GetMemberStatisticsHandler::class, function ($app) {
            return new GetMemberStatisticsHandler(
                $app->make(MaterializedViewService::class),
                $app->make(MemberReadModelInterface::class)
            );
        });
        
        $this->app->bind(SearchMembersHandler::class, function ($app) {
            return new SearchMembersHandler(
                $app->make(MemberReadModelInterface::class