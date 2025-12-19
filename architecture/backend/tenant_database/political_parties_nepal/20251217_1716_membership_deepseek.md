# 🎯 **Architect's Blueprint: Levy Collection Reporting System**

## 📊 **Strategic Assessment**

Your reporting architecture is **professionally sound**. You've correctly identified the **single source of truth** pattern (charges → payments) which is critical for financial systems. The module-by-module approach with tenant isolation is exactly right.

## 🔧 **Production-Grade Implementation Plan**

### **Phase 1: Foundation Layer**

```bash
# File Structure
app/
├── Reports/
│   ├── Services/
│   │   ├── BaseReportService.php
│   │   ├── MonthlyLevySummaryService.php
│   │   ├── LevyOutstandingService.php
│   │   ├── LevyCollectionByUnitService.php
│   │   └── MemberLevyLedgerService.php
│   ├── DTOs/
│   │   ├── LevyReportData.php
│   │   └── ReportFilters.php
│   └── FormRequests/
│       ├── MonthlyReportRequest.php
│       └── MemberLedgerRequest.php
├── Policies/
│   └── ReportPolicy.php
└── Http/
    ├── Controllers/
    │   └── Reports/
    │       └── LevyReportController.php
    └── Resources/
        └── ReportResource.php
```

### **Critical Database Optimization**

```sql
-- PART 1: Performance Indexes (MUST ADD)
CREATE INDEX idx_levy_charges_tenant_due_date 
ON membership_levy_charges (tenant_id, due_date DESC, status);

CREATE INDEX idx_levy_payments_tenant_created 
ON membership_levy_payments (tenant_id, created_at DESC);

-- PART 2: Materialized View for Daily Aggregations (PostgreSQL)
CREATE MATERIALIZED VIEW daily_levy_summary AS
SELECT 
    DATE(due_date) as report_date,
    tenant_id,
    SUM(amount_due) as total_charged,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
    COUNT(CASE WHEN status = 'waived' THEN 1 END) as waived_count
FROM membership_levy_charges
WHERE due_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(due_date), tenant_id;

-- Refresh hourly
CREATE UNIQUE INDEX idx_daily_summary ON daily_levy_summary (report_date, tenant_id);
```

### **Production Report Service Example**

```php
<?php

namespace App\Reports\Services;

use App\Reports\DTOs\LevyReportData;
use App\Reports\DTOs\ReportFilters;
use App\Tenant\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class MonthlyLevySummaryService extends BaseReportService
{
    public function generate(ReportFilters $filters): LevyReportData
    {
        // Always use database aggregation, never PHP loops
        $results = DB::connection('tenant')
            ->table('membership_levy_charges as mlc')
            ->join('organizational_units as ou', 'mlc.organizational_unit_id', '=', 'ou.id')
            ->select(
                DB::raw("DATE_FORMAT(mlc.due_date, '%Y-%m') as month"),
                DB::raw('SUM(mlc.amount_due) as total_charged'),
                DB::raw("SUM(CASE WHEN mlc.status = 'paid' THEN mlc.amount_due ELSE 0 END) as total_collected"),
                DB::raw("SUM(CASE WHEN mlc.status IN ('pending', 'overdue') THEN mlc.amount_due ELSE 0 END) as total_outstanding"),
                DB::raw("SUM(CASE WHEN mlc.status = 'waived' THEN mlc.amount_due ELSE 0 END) as total_waived"),
                DB::raw('COUNT(DISTINCT mlc.member_id) as member_count'),
                DB::raw('COUNT(DISTINCT ou.id) as unit_count')
            )
            ->where('mlc.tenant_id', $this->getCurrentTenantId())
            ->when($filters->startDate, fn($q, $date) => $q->where('mlc.due_date', '>=', $date))
            ->when($filters->endDate, fn($q, $date) => $q->where('mlc.due_date', '<=', $date))
            ->when($filters->unitId, fn($q, $unitId) => $q->where('mlc.organizational_unit_id', $unitId))
            ->groupBy(DB::raw("DATE_FORMAT(mlc.due_date, '%Y-%m')"))
            ->orderBy('month', 'desc')
            ->get();

        // Create immutable DTO
        return LevyReportData::fromArray([
            'filters' => $filters->toArray(),
            'generated_at' => now(),
            'generated_by' => auth()->id(),
            'data' => $results->map(function ($row) {
                return [
                    'month' => $row->month,
                    'total_charged' => (float) $row->total_charged,
                    'total_collected' => (float) $row->total_collected,
                    'total_outstanding' => (float) $row->total_outstanding,
                    'total_waived' => (float) $row->total_waived,
                    'collection_percentage' => $row->total_charged > 0 
                        ? round(($row->total_collected / $row->total_charged) * 100, 2)
                        : 0,
                    'member_count' => (int) $row->member_count,
                    'unit_count' => (int) $row->unit_count,
                ];
            })
        ]);
    }
}
```

### **Security Layer Implementation**

```php
<?php

namespace App\Policies;

use App\Tenant\Models\User;
use App\Tenant\Models\OrganizationalUnit;

class ReportPolicy
{
    public function viewMonthlySummary(User $user): bool
    {
        // Financial officers at any level
        if ($user->hasRole('finance_officer') || 
            $user->hasRole('treasurer') || 
            $user->hasRole('general_secretary')) {
            return true;
        }

        // Unit leaders can see their unit reports
        return $user->hasRole('president') || $user->hasRole('vice_president');
    }

    public function viewMemberLedger(User $user, User $targetUser): bool
    {
        // Users can only see their own ledger
        if ($user->id === $targetUser->id) {
            return true;
        }

        // Finance officers can see members in their unit
        if ($user->hasRole('finance_officer')) {
            return OrganizationalUnit::where('id', $user->organizational_unit_id)
                ->whereHas('members', fn($q) => $q->where('user_id', $targetUser->id))
                ->exists();
        }

        return false;
    }

    public function exportReports(User $user): bool
    {
        // Only specific roles can export financial data
        return $user->hasAnyRole(['treasurer', 'general_secretary', 'admin']);
    }
}
```

### **Vue 3 Report Component (Production Grade)**

```vue
<template>
  <DashboardLayout title="Monthly Levy Summary">
    <!-- Filter Bar -->
    <ReportFilterBar
      v-model:filters="filters"
      @filter="loadReport"
      :loading="loading"
    />
    
    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <SummaryCard
        title="Total Charged"
        :value="formatCurrency(totals.total_charged)"
        icon="currency-dollar"
        :trend="trends.charged"
      />
      <SummaryCard
        title="Collected"
        :value="formatCurrency(totals.total_collected)"
        icon="check-circle"
        :percentage="totals.collection_percentage"
      />
      <SummaryCard
        title="Outstanding"
        :value="formatCurrency(totals.total_outstanding)"
        icon="clock"
        :trend="trends.outstanding"
      />
      <SummaryCard
        title="Waived"
        :value="formatCurrency(totals.total_waived)"
        icon="hand-raised"
        variant="warning"
      />
    </div>

    <!-- Data Table -->
    <DataTable
      :data="reportData"
      :columns="columns"
      :loading="loading"
      @row-click="handleRowClick"
    >
      <template #actions>
        <ExportButton
          :loading="exporting"
          @click="exportReport"
          :allowed="canExport"
        />
        <PrintButton @click="printReport" />
      </template>
    </DataTable>

    <!-- Drill-down Modal -->
    <ReportDrillDownModal
      v-if="selectedMonth"
      :month="selectedMonth"
      :unit-id="filters.unit_id"
      @close="selectedMonth = null"
    />
  </DashboardLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePage } from '@inertiajs/inertia-vue3'
import DashboardLayout from '@/Layouts/DashboardLayout.vue'
import ReportFilterBar from '@/Components/Reports/ReportFilterBar.vue'
import SummaryCard from '@/Components/Reports/SummaryCard.vue'
import DataTable from '@/Components/DataTable.vue'
import ExportButton from '@/Components/ExportButton.vue'
import PrintButton from '@/Components/PrintButton.vue'
import ReportDrillDownModal from '@/Components/Reports/ReportDrillDownModal.vue'
import { formatCurrency, formatPercentage } from '@/Utils/formatters'

const props = defineProps({
  initialData: Object,
  filters: Object
})

const loading = ref(false)
const exporting = ref(false)
const selectedMonth = ref(null)
const reportData = ref(props.initialData?.data || [])
const filters = ref({
  start_date: props.filters?.start_date || dayjs().subtract(6, 'months').format('YYYY-MM-DD'),
  end_date: props.filters?.end_date || dayjs().format('YYYY-MM-DD'),
  unit_id: props.filters?.unit_id || null,
  membership_type: props.filters?.membership_type || null
})

// Computed totals
const totals = computed(() => {
  if (!reportData.value.length) return {}
  
  return reportData.value.reduce((acc, row) => ({
    total_charged: acc.total_charged + row.total_charged,
    total_collected: acc.total_collected + row.total_collected,
    total_outstanding: acc.total_outstanding + row.total_outstanding,
    total_waived: acc.total_waived + row.total_waived,
    collection_percentage: ((acc.total_collected + row.total_collected) / 
                          (acc.total_charged + row.total_charged)) * 100
  }), {
    total_charged: 0,
    total_collected: 0,
    total_outstanding: 0,
    total_waived: 0,
    collection_percentage: 0
  })
})

// Permissions
const { auth } = usePage().props
const canExport = computed(() => 
  auth.user.roles.some(r => ['treasurer', 'general_secretary', 'admin'].includes(r.code))
)

// Table columns
const columns = [
  { key: 'month', label: 'Month', sortable: true },
  { 
    key: 'total_charged', 
    label: 'Charged', 
    sortable: true,
    format: formatCurrency 
  },
  { 
    key: 'total_collected', 
    label: 'Collected', 
    sortable: true,
    format: formatCurrency 
  },
  { 
    key: 'collection_percentage', 
    label: 'Collection %', 
    sortable: true,
    format: (val) => formatPercentage(val, 1)
  },
  { 
    key: 'total_outstanding', 
    label: 'Outstanding', 
    sortable: true,
    format: formatCurrency 
  },
  { 
    key: 'total_waived', 
    label: 'Waived', 
    sortable: true,
    format: formatCurrency 
  },
  { key: 'member_count', label: 'Members', sortable: true },
  { key: 'unit_count', label: 'Units', sortable: true }
]

// Methods
const loadReport = async () => {
  loading.value = true
  try {
    const { data } = await axios.get('/reports/levy/monthly', {
      params: filters.value
    })
    reportData.value = data.data
  } catch (error) {
    console.error('Failed to load report:', error)
  } finally {
    loading.value = false
  }
}

const exportReport = async () => {
  exporting.value = true
  try {
    const response = await axios.get('/reports/levy/monthly/export', {
      params: filters.value,
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `levy-report-${dayjs().format('YYYY-MM-DD')}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    console.error('Export failed:', error)
  } finally {
    exporting.value = false
  }
}

const handleRowClick = (row) => {
  selectedMonth.value = row.month
}

// Initial load
onMounted(() => {
  if (!props.initialData) {
    loadReport()
  }
})
</script>
```

### **Batch Export Service (CSV/Excel)**

```php
<?php

namespace App\Reports\Services;

use App\Reports\DTOs\LevyReportData;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LevyExportService implements FromCollection, WithHeadings, WithTitle
{
    private LevyReportData $reportData;
    
    public function __construct(LevyReportData $reportData)
    {
        $this->reportData = $reportData;
    }
    
    public function collection()
    {
        return collect($this->reportData->getData())->map(function ($row) {
            return [
                $row['month'],
                $row['total_charged'],
                $row['total_collected'],
                $row['collection_percentage'] . '%',
                $row['total_outstanding'],
                $row['total_waived'],
                $row['member_count'],
                $row['unit_count']
            ];
        });
    }
    
    public function headings(): array
    {
        return [
            'Month',
            'Total Charged',
            'Total Collected',
            'Collection %',
            'Outstanding',
            'Waived',
            'Members',
            'Units'
        ];
    }
    
    public function title(): string
    {
        return 'Monthly Levy Summary';
    }
    
    public function exportToExcel(): BinaryFileResponse
    {
        $fileName = sprintf(
            'levy-report-%s-%s.xlsx',
            now()->format('Y-m-d'),
            strtolower($this->reportData->getFilters()->getStartDate()->format('Y-m'))
        );
        
        return Excel::download($this, $fileName);
    }
}
```

## 🚀 **Implementation Priority (Do This First)**

### **Week 1: Core Reporting Engine**
1. ✅ Install and configure `maatwebsite/excel` for exports
2. ✅ Create Report DTOs and Form Requests
3. ✅ Implement BaseReportService with tenant scope
4. ✅ Create MonthlyLevySummaryService (most critical)
5. ✅ Add database indexes (immediate performance impact)

### **Week 2: Frontend + Security**
1. ✅ Build Vue report components with proper loading states
2. ✅ Implement ReportPolicy with role-based access
3. ✅ Create audit logging for all report access
4. ✅ Add CSV/Excel export functionality
5. ✅ Implement server-side pagination and filtering

### **Week 3: Advanced Features**
1. ✅ Create materialized views for performance
2. ✅ Implement report scheduling (daily/weekly emails)
3. ✅ Add data validation and reconciliation checks
4. ✅ Create unit tests for financial calculations
5. ✅ Implement caching strategy for frequent reports

## 🎯 **Critical Success Factors**

### **1. Financial Integrity**
- **Never cache totals** - always calculate from source
- **Use database transactions** for all updates
- **Implement reconciliation** procedures
- **Store audit trails** for every calculation

### **2. Performance at Scale**
```php
// Use query hints for large datasets
DB::connection('tenant')
    ->table('membership_levy_charges')
    ->selectRaw('...')
    ->useIndex('idx_levy_charges_tenant_due_date') // MySQL hint
    ->where(...);
```

### **3. Tenant Isolation**
```php
// Always scope by tenant
protected function scopeTenant(Builder $query): void
{
    $query->where('tenant_id', $this->getCurrentTenantId());
}

// Use middleware to enforce
Route::middleware(['tenant', 'auth', 'can:viewReports'])
    ->prefix('reports')
    ->group(...);
```

## 📊 **Monitoring & Alerting**

```php
// Report health monitoring
class ReportHealthCheck
{
    public function checkReconciliation(): bool
    {
        // Verify: Sum(charges) = Sum(payments + outstanding + waived)
        $charges = DB::table('membership_levy_charges')->sum('amount_due');
        $payments = DB::table('membership_levy_payments')->sum('amount_paid');
        $outstanding = DB::table('membership_levy_charges')
            ->whereIn('status', ['pending', 'overdue'])
            ->sum('amount_due');
        $waived = DB::table('membership_levy_charges')
            ->where('status', 'waived')
            ->sum('amount_due');
            
        $difference = abs($charges - ($payments + $outstanding + $waived));
        
        if ($difference > 0.01) { // Allow for rounding errors
            Log::critical('Levy reconciliation failure', [
                'difference' => $difference,
                'tenant_id' => tenant()->id
            ]);
            return false;
        }
        
        return true;
    }
}
```

## ✅ **Ready for Production Checklist**

- [ ] **Database indexes** optimized for reporting queries
- [ ] **Tenant isolation** verified on all queries
- [ ] **Financial reconciliation** implemented
- [ ] **Audit logging** for all report access
- [ ] **Export functionality** with proper permissions
- [ ] **Performance testing** with production-like data
- [ ] **Backup strategy** for report configurations
- [ ] **Monitoring alerts** for data inconsistencies

## 🎯 **Architect's Final Recommendation**

**Start with the Monthly Summary Report**. It's the most valuable, easiest to implement, and provides immediate value. The pattern you establish here will propagate to all other reports.

**Critical**: Implement the **reconciliation check** from day one. Financial systems live or die by data integrity.

Your architecture is **enterprise-ready**. Move to implementation with confidence.

---

