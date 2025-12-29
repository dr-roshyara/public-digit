Perfect! Let's implement **Export functionality** for digital cards. This will allow admins to export card data in various formats (CSV, Excel, PDF) for reporting and record-keeping.

## **Step 1: Design Export System Architecture**

We'll create a flexible export system that supports:
1. **CSV Export** - For data analysis and spreadsheets
2. **Excel Export** - For formatted reports
3. **PDF Export** - For printable reports and official documents
4. **JSON Export** - For data migration and APIs
5. **Custom Templates** - For specific report formats

## **Step 2: Create Export Domain Models**

```bash
php artisan make:class CardExport --path=app/Contexts/DigitalCard/Domain/Models
```

```php
<?php

namespace App\Contexts\DigitalCard\Domain\Models;

use App\Contexts\DigitalCard\Domain\ValueObjects\ExportId;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;
use App\Contexts\DigitalCard\Domain\ValueObjects\UserId;

class CardExport
{
    public function __construct(
        private ExportId $id,
        private TenantId $tenantId,
        private string $format, // 'csv', 'excel', 'pdf', 'json'
        private array $filters,
        private array $columns,
        private string $status, // 'pending', 'processing', 'completed', 'failed'
        private ?string $filePath = null,
        private ?int $fileSize = null,
        private ?string $errorMessage = null,
        private UserId $requestedBy,
        private ?\DateTimeImmutable $requestedAt = null,
        private ?\DateTimeImmutable $processedAt = null,
        private ?\DateTimeImmutable $expiresAt = null,
        private ?\DateTimeImmutable $downloadedAt = null,
        private int $downloadCount = 0,
        private ?string $template = null, // Optional template name
        private array $metadata = []
    ) {
        if ($this->requestedAt === null) {
            $this->requestedAt = new \DateTimeImmutable();
        }
        
        // Set default expiry (24 hours for exports)
        if ($this->expiresAt === null) {
            $this->expiresAt = (new \DateTimeImmutable())->modify('+24 hours');
        }
    }

    // Getters
    public function id(): ExportId { return $this->id; }
    public function tenantId(): TenantId { return $this->tenantId; }
    public function format(): string { return $this->format; }
    public function filters(): array { return $this->filters; }
    public function columns(): array { return $this->columns; }
    public function status(): string { return $this->status; }
    public function filePath(): ?string { return $this->filePath; }
    public function fileSize(): ?int { return $this->fileSize; }
    public function errorMessage(): ?string { return $this->errorMessage; }
    public function requestedBy(): UserId { return $this->requestedBy; }
    public function requestedAt(): ?\DateTimeImmutable { return $this->requestedAt; }
    public function processedAt(): ?\DateTimeImmutable { return $this->processedAt; }
    public function expiresAt(): ?\DateTimeImmutable { return $this->expiresAt; }
    public function downloadedAt(): ?\DateTimeImmutable { return $this->downloadedAt; }
    public function downloadCount(): int { return $this->downloadCount; }
    public function template(): ?string { return $this->template; }
    public function metadata(): array { return $this->metadata; }

    // Business logic methods
    public function startProcessing(): void
    {
        if ($this->status !== 'pending') {
            throw new \DomainException('Export can only be started from pending status.');
        }
        
        $this->status = 'processing';
    }

    public function complete(string $filePath, int $fileSize, array $metadata = []): void
    {
        if ($this->status !== 'processing') {
            throw new \DomainException('Export must be processing to complete.');
        }
        
        $this->status = 'completed';
        $this->filePath = $filePath;
        $this->fileSize = $fileSize;
        $this->processedAt = new \DateTimeImmutable();
        $this->metadata = array_merge($this->metadata, $metadata);
    }

    public function fail(string $errorMessage): void
    {
        $this->status = 'failed';
        $this->errorMessage = $errorMessage;
        $this->processedAt = new \DateTimeImmutable();
    }

    public function recordDownload(): void
    {
        $this->downloadCount++;
        $this->downloadedAt = new \DateTimeImmutable();
    }

    public function isExpired(): bool
    {
        return $this->expiresAt < new \DateTimeImmutable();
    }

    public function isDownloadable(): bool
    {
        return $this->status === 'completed' && 
               !$this->isExpired() && 
               $this->filePath !== null;
    }

    public function getFileExtension(): string
    {
        return match($this->format) {
            'csv' => 'csv',
            'excel' => 'xlsx',
            'pdf' => 'pdf',
            'json' => 'json',
            default => 'txt',
        };
    }

    public function getFileName(): string
    {
        $timestamp = $this->requestedAt->format('Y-m-d_H-i-s');
        $filterType = !empty($this->filters) ? 'filtered' : 'all';
        
        return "digital_cards_{$filterType}_{$timestamp}.{$this->getFileExtension()}";
    }

    public function getMimeType(): string
    {
        return match($this->format) {
            'csv' => 'text/csv',
            'excel' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf' => 'application/pdf',
            'json' => 'application/json',
            default => 'text/plain',
        };
    }

    // Factory methods
    public static function create(
        ExportId $id,
        TenantId $tenantId,
        string $format,
        array $filters,
        array $columns,
        UserId $requestedBy,
        ?string $template = null
    ): self {
        return new self(
            id: $id,
            tenantId: $tenantId,
            format: $format,
            filters: $filters,
            columns: $columns,
            status: 'pending',
            requestedBy: $requestedBy,
            template: $template
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id->toString(),
            'tenant_id' => $this->tenantId->toString(),
            'format' => $this->format,
            'filters' => $this->filters,
            'columns' => $this->columns,
            'status' => $this->status,
            'file_path' => $this->filePath,
            'file_size' => $this->fileSize,
            'error_message' => $this->errorMessage,
            'requested_by' => $this->requestedBy->toString(),
            'requested_at' => $this->requestedAt?->format(\DateTimeInterface::ATOM),
            'processed_at' => $this->processedAt?->format(\DateTimeInterface::ATOM),
            'expires_at' => $this->expiresAt?->format(\DateTimeInterface::ATOM),
            'downloaded_at' => $this->downloadedAt?->format(\DateTimeInterface::ATOM),
            'download_count' => $this->downloadCount,
            'template' => $this->template,
            'metadata' => $this->metadata,
            'is_expired' => $this->isExpired(),
            'is_downloadable' => $this->isDownloadable(),
            'file_name' => $this->getFileName(),
            'mime_type' => $this->getMimeType(),
        ];
    }
}
```

Create the ExportId value object:

```bash
php artisan make:class ExportId --path=app/Contexts/DigitalCard/Domain/ValueObjects
```

```php
<?php

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

use Ramsey\Uuid\Uuid;

class ExportId
{
    private string $value;

    public function __construct(string $value)
    {
        if (!Uuid::isValid($value)) {
            throw new \InvalidArgumentException("Invalid export ID: {$value}");
        }
        
        $this->value = $value;
    }

    public static function generate(): self
    {
        return new self(Uuid::uuid4()->toString());
    }

    public function toString(): string
    {
        return $this->value;
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }
}
```

## **Step 3: Create Export Repository**

```bash
php artisan make:interface ExportRepository --path=app/Contexts/DigitalCard/Domain/Contracts
```

```php
<?php

namespace App\Contexts\DigitalCard\Domain\Contracts;

use App\Contexts\DigitalCard\Domain\Models\CardExport;
use App\Contexts\DigitalCard\Domain\ValueObjects\ExportId;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;
use App\Contexts\DigitalCard\Domain\ValueObjects\UserId;

interface ExportRepository
{
    public function findById(ExportId $id): ?CardExport;
    
    public function save(CardExport $export): void;
    
    public function findByTenant(TenantId $tenantId, array $filters = [], int $perPage = 20): array;
    
    public function findRecentByUser(UserId $userId, int $limit = 10): array;
    
    public function deleteExpired(): int;
    
    public function delete(ExportId $id): bool;
}
```

Create Eloquent implementation:

```bash
php artisan make:class EloquentExportRepository --path=app/Contexts/DigitalCard/Infrastructure/Persistence/Eloquent
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent;

use App\Contexts\DigitalCard\Domain\Contracts\ExportRepository;
use App\Contexts\DigitalCard\Domain\Models\CardExport;
use App\Contexts\DigitalCard\Domain\ValueObjects\ExportId;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;
use App\Contexts\DigitalCard\Domain\ValueObjects\UserId;
use App\Models\Export as ExportModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class EloquentExportRepository implements ExportRepository
{
    public function findById(ExportId $id): ?CardExport
    {
        $model = ExportModel::find($id->toString());
        
        return $model ? $this->toEntity($model) : null;
    }
    
    public function save(CardExport $export): void
    {
        ExportModel::updateOrCreate(
            ['id' => $export->id()->toString()],
            [
                'tenant_id' => $export->tenantId()->toString(),
                'format' => $export->format(),
                'filters' => $export->filters(),
                'columns' => $export->columns(),
                'status' => $export->status(),
                'file_path' => $export->filePath(),
                'file_size' => $export->fileSize(),
                'error_message' => $export->errorMessage(),
                'requested_by' => $export->requestedBy()->toString(),
                'requested_at' => $export->requestedAt(),
                'processed_at' => $export->processedAt(),
                'expires_at' => $export->expiresAt(),
                'downloaded_at' => $export->downloadedAt(),
                'download_count' => $export->downloadCount(),
                'template' => $export->template(),
                'metadata' => $export->metadata(),
            ]
        );
    }
    
    public function findByTenant(TenantId $tenantId, array $filters = [], int $perPage = 20): array
    {
        $query = ExportModel::where('tenant_id', $tenantId->toString());
        
        // Apply filters
        if (isset($filters['format'])) {
            $query->where('format', $filters['format']);
        }
        
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        
        if (isset($filters['requested_by'])) {
            $query->where('requested_by', $filters['requested_by']);
        }
        
        if (isset($filters['date_from'])) {
            $query->whereDate('requested_at', '>=', $filters['date_from']);
        }
        
        if (isset($filters['date_to'])) {
            $query->whereDate('requested_at', '<=', $filters['date_to']);
        }
        
        if (isset($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('template', 'like', '%' . $filters['search'] . '%')
                  ->orWhere('error_message', 'like', '%' . $filters['search'] . '%');
            });
        }
        
        // Order by latest
        $query->orderBy('requested_at', 'desc');
        
        // Paginate
        $paginator = $query->paginate($perPage);
        
        return [
            'data' => $paginator->getCollection()->map(fn($model) => $this->toEntity($model))->all(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ]
        ];
    }
    
    public function findRecentByUser(UserId $userId, int $limit = 10): array
    {
        $models = ExportModel::where('requested_by', $userId->toString())
            ->orderBy('requested_at', 'desc')
            ->limit($limit)
            ->get();
        
        return $models->map(fn($model) => $this->toEntity($model))->all();
    }
    
    public function deleteExpired(): int
    {
        return ExportModel::where('expires_at', '<', now())
            ->delete();
    }
    
    public function delete(ExportId $id): bool
    {
        $model = ExportModel::find($id->toString());
        
        if (!$model) {
            return false;
        }
        
        // Delete the file if it exists
        if ($model->file_path && file_exists(storage_path('app/' . $model->file_path))) {
            unlink(storage_path('app/' . $model->file_path));
        }
        
        return $model->delete();
    }
    
    private function toEntity(ExportModel $model): CardExport
    {
        return new CardExport(
            id: new ExportId($model->id),
            tenantId: new TenantId($model->tenant_id),
            format: $model->format,
            filters: $model->filters ?? [],
            columns: $model->columns ?? [],
            status: $model->status,
            filePath: $model->file_path,
            fileSize: $model->file_size,
            errorMessage: $model->error_message,
            requestedBy: new UserId($model->requested_by),
            requestedAt: $model->requested_at ? new \DateTimeImmutable($model->requested_at) : null,
            processedAt: $model->processed_at ? new \DateTimeImmutable($model->processed_at) : null,
            expiresAt: $model->expires_at ? new \DateTimeImmutable($model->expires_at) : null,
            downloadedAt: $model->downloaded_at ? new \DateTimeImmutable($model->downloaded_at) : null,
            downloadCount: $model->download_count ?? 0,
            template: $model->template,
            metadata: $model->metadata ?? []
        );
    }
}
```

## **Step 4: Create Export Database Models**

Create migration:

```bash
php artisan make:migration create_exports_table
```

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('format'); // csv, excel, pdf, json
            $table->json('filters')->nullable();
            $table->json('columns')->nullable();
            $table->string('status')->default('pending'); // pending, processing, completed, failed
            $table->string('file_path')->nullable();
            $table->integer('file_size')->nullable();
            $table->text('error_message')->nullable();
            $table->uuid('requested_by');
            $table->timestamp('requested_at')->useCurrent();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('downloaded_at')->nullable();
            $table->integer('download_count')->default(0);
            $table->string('template')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'format', 'requested_at']);
            $table->index(['requested_by', 'requested_at']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exports');
    }
};
```

Run migration:

```bash
php artisan migrate
```

Create Eloquent model:

```bash
php artisan make:model Export
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Export extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'id',
        'tenant_id',
        'format',
        'filters',
        'columns',
        'status',
        'file_path',
        'file_size',
        'error_message',
        'requested_by',
        'requested_at',
        'processed_at',
        'expires_at',
        'downloaded_at',
        'download_count',
        'template',
        'metadata',
    ];

    protected $casts = [
        'filters' => 'array',
        'columns' => 'array',
        'metadata' => 'array',
        'requested_at' => 'datetime',
        'processed_at' => 'datetime',
        'expires_at' => 'datetime',
        'downloaded_at' => 'datetime',
    ];

    public function initiator()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function isDownloadable(): bool
    {
        return $this->status === 'completed' && 
               $this->expires_at > now() && 
               !empty($this->file_path);
    }

    public function isExpired(): bool
    {
        return $this->expires_at < now();
    }

    public function getFileExtension(): string
    {
        return match($this->format) {
            'csv' => 'csv',
            'excel' => 'xlsx',
            'pdf' => 'pdf',
            'json' => 'json',
            default => 'txt',
        };
    }

    public function getFileName(): string
    {
        $timestamp = $this->requested_at->format('Y-m-d_H-i-s');
        $filterType = !empty($this->filters) ? 'filtered' : 'all';
        
        return "digital_cards_{$filterType}_{$timestamp}.{$this->getFileExtension()}";
    }

    public function getMimeType(): string
    {
        return match($this->format) {
            'csv' => 'text/csv',
            'excel' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf' => 'application/pdf',
            'json' => 'application/json',
            default => 'text/plain',
        };
    }
}
```

## **Step 5: Install Required Packages**

We need packages for Excel and PDF generation:

```bash
composer require maatwebsite/excel
composer require barryvdh/laravel-dompdf
```

```bash
php artisan vendor:publish --provider="Maatwebsite\Excel\ExcelServiceProvider" --tag=config
```

```bash
php artisan vendor:publish --provider="Barryvdh\DomPDF\ServiceProvider"
```

## **Step 6: Create Export Service Classes**

Create a base export service:

```bash
php artisan make:class BaseExportService --path=app/Contexts/DigitalCard/Infrastructure/Services/Export
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Services\Export;

use App\Contexts\DigitalCard\Domain\Models\CardExport;
use App\Contexts\DigitalCard\Domain\Contracts\DigitalCardRepository;
use Illuminate\Support\Facades\Storage;

abstract class BaseExportService
{
    protected string $disk = 'exports';
    protected string $directory = 'digital-cards';

    public function __construct(
        protected DigitalCardRepository $cardRepository
    ) {}

    abstract public function generate(CardExport $export): string;

    protected function getFilePath(CardExport $export): string
    {
        $filename = $export->getFileName();
        return "{$this->directory}/{$filename}";
    }

    protected function saveFile(string $content, string $filePath): int
    {
        Storage::disk($this->disk)->put($filePath, $content);
        
        return Storage::disk($this->disk)->size($filePath);
    }

    protected function getCardsData(CardExport $export): array
    {
        $filters = $export->filters();
        $columns = $export->columns();
        
        // Get paginated cards based on filters
        // For exports, we want all cards, not paginated
        $perPage = 1000; // Process in chunks
        $page = 1;
        $allCards = [];
        
        do {
            $paginator = $this->cardRepository->paginate($perPage, $page, $filters);
            $cards = $paginator->items();
            
            foreach ($cards as $card) {
                $allCards[] = $this->formatCardData($card, $columns);
            }
            
            $page++;
        } while ($paginator->hasMorePages());
        
        return $allCards;
    }

    protected function formatCardData($card, array $columns): array
    {
        $formatted = [];
        
        $columnMap = [
            'id' => fn($c) => $c->id,
            'member_id' => fn($c) => $c->member_id,
            'member_name' => fn($c) => $c->member_name,
            'status' => fn($c) => $c->status,
            'issued_at' => fn($c) => $c->issued_at,
            'expiry_date' => fn($c) => $c->expiry_date,
            'activated_at' => fn($c) => $c->activated_at,
            'revoked_at' => fn($c) => $c->revoked_at,
            'revocation_reason' => fn($c) => $c->revocation_reason,
            'days_remaining' => function($c) {
                if (!$c->expiry_date || $c->status !== 'active') {
                    return null;
                }
                $expiry = new \DateTime($c->expiry_date);
                $now = new \DateTime();
                $interval = $now->diff($expiry);
                return $interval->days;
            },
            'is_expired' => function($c) {
                if (!$c->expiry_date) return false;
                $expiry = new \DateTime($c->expiry_date);
                return $expiry < new \DateTime();
            },
            'tenant_id' => fn($c) => $c->tenant_id ?? null,
        ];
        
        foreach ($columns as $column) {
            if (isset($columnMap[$column])) {
                $formatted[$column] = $columnMap[$column]($card);
            } else {
                $formatted[$column] = null;
            }
        }
        
        return $formatted;
    }

    protected function getHeaders(array $columns): array
    {
        $headerMap = [
            'id' => 'Card ID',
            'member_id' => 'Member ID',
            'member_name' => 'Member Name',
            'status' => 'Status',
            'issued_at' => 'Issued At',
            'expiry_date' => 'Expiry Date',
            'activated_at' => 'Activated At',
            'revoked_at' => 'Revoked At',
            'revocation_reason' => 'Revocation Reason',
            'days_remaining' => 'Days Remaining',
            'is_expired' => 'Is Expired',
            'tenant_id' => 'Tenant ID',
        ];
        
        $headers = [];
        foreach ($columns as $column) {
            $headers[] = $headerMap[$column] ?? ucfirst(str_replace('_', ' ', $column));
        }
        
        return $headers;
    }
}
```

Create CSV export service:

```bash
php artisan make:class CsvExportService --path=app/Contexts/DigitalCard/Infrastructure/Services/Export
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Services\Export;

use App\Contexts\DigitalCard\Domain\Models\CardExport;
use League\Csv\Writer;

class CsvExportService extends BaseExportService
{
    public function generate(CardExport $export): string
    {
        $cards = $this->getCardsData($export);
        $headers = $this->getHeaders($export->columns());
        
        // Create CSV writer
        $csv = Writer::createFromString();
        $csv->setDelimiter(',');
        $csv->setEnclosure('"');
        $csv->setEscape('\\');
        
        // Add BOM for Excel compatibility
        $csv->setOutputBOM(Writer::BOM_UTF8);
        
        // Insert headers
        $csv->insertOne($headers);
        
        // Insert data
        foreach ($cards as $card) {
            $row = [];
            foreach ($export->columns() as $column) {
                $row[] = $this->formatValue($card[$column] ?? null);
            }
            $csv->insertOne($row);
        }
        
        $content = $csv->toString();
        $filePath = $this->getFilePath($export);
        $fileSize = $this->saveFile($content, $filePath);
        
        return $filePath;
    }

    private function formatValue($value): string
    {
        if ($value === null) {
            return '';
        }
        
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d H:i:s');
        }
        
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        
        // Escape CSV special characters
        $value = (string) $value;
        if (str_contains($value, ',') || str_contains($value, '"') || str_contains($value, "\n")) {
            $value = '"' . str_replace('"', '""', $value) . '"';
        }
        
        return $value;
    }
}
```

Create Excel export service:

```bash
php artisan make:class ExcelExportService --path=app/Contexts/DigitalCard/Infrastructure/Services/Export
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Services\Export;

use App\Contexts\DigitalCard\Domain\Models\CardExport;
use App\Exports\DigitalCardsExport;
use Maatwebsite\Excel\Facades\Excel;

class ExcelExportService extends BaseExportService
{
    public function generate(CardExport $export): string
    {
        $cards = $this->getCardsData($export);
        $headers = $this->getHeaders($export->columns());
        
        // Create Excel export using Laravel Excel package
        $exportObject = new DigitalCardsExport($cards, $headers, $export->filters());
        
        $filePath = $this->getFilePath($export);
        $fullPath = storage_path("app/{$this->disk}/{$filePath}");
        
        // Ensure directory exists
        $directory = dirname($fullPath);
        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }
        
        // Generate Excel file
        Excel::store($exportObject, $filePath, $this->disk, null, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
        
        return $filePath;
    }
}
```

Create the Excel export class:

```bash
php artisan make:export DigitalCardsExport --path=app/Exports
```

```php
<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class DigitalCardsExport implements FromCollection, WithHeadings, WithTitle, WithStyles, WithColumnWidths, WithEvents
{
    private $cards;
    private $headings;
    private $filters;

    public function __construct(array $cards, array $headings, array $filters = [])
    {
        $this->cards = $cards;
        $this->headings = $headings;
        $this->filters = $filters;
    }

    public function collection()
    {
        return collect($this->cards);
    }

    public function headings(): array
    {
        return $this->headings;
    }

    public function title(): string
    {
        return 'Digital Cards';
    }

    public function styles(Worksheet $sheet)
    {
        // Style the header row
        $sheet->getStyle('A1:' . $sheet->getHighestColumn() . '1')->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => '4F46E5'], // Indigo color
            ],
        ]);

        // Auto-size columns
        foreach (range('A', $sheet->getHighestColumn()) as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }

        // Add borders to all cells
        $lastRow = $sheet->getHighestRow();
        $lastColumn = $sheet->getHighestColumn();
        
        $sheet->getStyle('A1:' . $lastColumn . $lastRow)->applyFromArray([
            'borders' => [
                'allBorders' => [
                    'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN,
                    'color' => ['rgb' => 'DDDDDD'],
                ],
            ],
        ]);

        // Freeze the header row
        $sheet->freezePane('A2');

        return [];
    }

    public function columnWidths(): array
    {
        $widths = [];
        $defaultWidth = 15;
        
        foreach (range('A', chr(65 + count($this->headings) - 1)) as $column) {
            $widths[$column] = $defaultWidth;
        }
        
        // Adjust specific columns
        $widthMap = [
            'member_name' => 25,
            'revocation_reason' => 30,
            'issued_at' => 20,
            'expiry_date' => 20,
            'activated_at' => 20,
            'revoked_at' => 20,
        ];
        
        foreach ($this->headings as $index => $heading) {
            $column = chr(65 + $index);
            $key = array_search($heading, [
                'Member Name' => 'member_name',
                'Revocation Reason' => 'revocation_reason',
                'Issued At' => 'issued_at',
                'Expiry Date' => 'expiry_date',
                'Activated At' => 'activated_at',
                'Revoked At' => 'revoked_at',
            ]);
            
            if ($key && isset($widthMap[$key])) {
                $widths[$column] = $widthMap[$key];
            }
        }
        
        return $widths;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                // Add filter info as a note
                if (!empty($this->filters)) {
                    $filterText = $this->formatFiltersForExcel($this->filters);
                    
                    $event->sheet->getDelegate()->setCellValue(
                        'A' . ($event->sheet->getHighestRow() + 3),
                        'Export Filters:'
                    );
                    
                    $event->sheet->getDelegate()->setCellValue(
                        'A' . ($event->sheet->getHighestRow() + 1),
                        $filterText
                    );
                    
                    $event->sheet->getDelegate()->getStyle(
                        'A' . ($event->sheet->getHighestRow() - 1) . ':B' . $event->sheet->getHighestRow()
                    )->applyFromArray([
                        'font' => [
                            'italic' => true,
                            'color' => ['rgb' => '666666'],
                        ],
                    ]);
                }
                
                // Add export timestamp
                $event->sheet->getDelegate()->setCellValue(
                    'A' . ($event->sheet->getHighestRow() + 2),
                    'Exported on: ' . now()->format('Y-m-d H:i:s')
                );
            },
        ];
    }

    private function formatFiltersForExcel(array $filters): string
    {
        $filterText = [];
        
        if (isset($filters['status']) && $filters['status']) {
            $filterText[] = "Status: {$filters['status']}";
        }
        
        if (isset($filters['member_id']) && $filters['member_id']) {
            $filterText[] = "Member ID contains: {$filters['member_id']}";
        }
        
        if (isset($filters['member_name']) && $filters['member_name']) {
            $filterText[] = "Member Name contains: {$filters['member_name']}";
        }
        
        if (isset($filters['issued_from']) && $filters['issued_from']) {
            $filterText[] = "Issued from: {$filters['issued_from']}";
        }
        
        if (isset($filters['issued_to']) && $filters['issued_to']) {
            $filterText[] = "Issued to: {$filters['issued_to']}";
        }
        
        if (isset($filters['expires_from']) && $filters['expires_from']) {
            $filterText[] = "Expires from: {$filters['expires_from']}";
        }
        
        if (isset($filters['expires_to']) && $filters['expires_to']) {
            $filterText[] = "Expires to: {$filters['expires_to']}";
        }
        
        return implode(' | ', $filterText);
    }
}
```

Create PDF export service:

```bash
php artisan make:class PdfExportService --path=app/Contexts/DigitalCard/Infrastructure/Services/Export
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Services\Export;

use App\Contexts\DigitalCard\Domain\Models\CardExport;
use Barryvdh\DomPDF\Facade\Pdf;

class PdfExportService extends BaseExportService
{
    public function generate(CardExport $export): string
    {
        $cards = $this->getCardsData($export);
        $headers = $this->getHeaders($export->columns());
        $filters = $export->filters();
        
        $data = [
            'cards' => $cards,
            'headers' => $headers,
            'filters' => $filters,
            'export' => $export->toArray(),
            'total_cards' => count($cards),
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ];
        
        // Generate PDF
        $pdf = Pdf::loadView('exports.digital-cards.pdf', $data);
        
        // Set PDF options
        $pdf->setPaper('A4', 'landscape');
        $pdf->setOption('defaultFont', 'Arial');
        $pdf->setOption('isHtml5ParserEnabled', true);
        $pdf->setOption('isRemoteEnabled', true);
        
        $content = $pdf->output();
        $filePath = $this->getFilePath($export);
        $fileSize = $this->saveFile($content, $filePath);
        
        return $filePath;
    }
}
```

Create JSON export service:

```bash
php artisan make:class JsonExportService --path=app/Contexts/DigitalCard/Infrastructure/Services/Export
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Services\Export;

use App\Contexts\DigitalCard\Domain\Models\CardExport;

class JsonExportService extends BaseExportService
{
    public function generate(CardExport $export): string
    {
        $cards = $this->getCardsData($export);
        $filters = $export->filters();
        
        $data = [
            'export' => [
                'id' => $export->id()->toString(),
                'format' => $export->format(),
                'requested_at' => $export->requestedAt()->format(\DateTimeInterface::ATOM),
                'filters' => $filters,
                'columns' => $export->columns(),
            ],
            'metadata' => [
                'total_cards' => count($cards),
                'generated_at' => now()->format(\DateTimeInterface::ATOM),
            ],
            'cards' => $cards,
        ];
        
        $content = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $filePath = $this->getFilePath($export);
        $fileSize = $this->saveFile($content, $filePath);
        
        return $filePath;
    }
}
```

## **Step 7: Create PDF View Template**

Create the PDF view:

```bash
mkdir -p resources/views/exports/digital-cards
```

```blade
<!-- resources/views/exports/digital-cards/pdf.blade.php -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Digital Cards Export - {{ $export['requested_at'] }}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            font-size: 10px;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #4F46E5;
            padding-bottom: 15px;
        }
        
        .header h1 {
            color: #4F46E5;
            margin: 0 0 5px 0;
            font-size: 18px;
        }
        
        .header .subtitle {
            color: #666;
            font-size: 12px;
        }
        
        .filters {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 9px;
        }
        
        .filters h3 {
            color: #4F46E5;
            margin: 0 0 10px 0;
            font-size: 11px;
        }
        
        .filter-item {
            display: inline-block;
            background-color: #e0e7ff;
            color: #3730a3;
            padding: 3px 8px;
            border-radius: 12px;
            margin-right: 8px;
            margin-bottom: 5px;
            font-size: 8px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 9px;
        }
        
        th {
            background-color: #4F46E5;
            color: white;
            font-weight: bold;
            text-align: left;
            padding: 8px;
            border: 1px solid #3730a3;
        }
        
        td {
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
        }
        
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        
        .status-active {
            color: #059669;
            font-weight: bold;
        }
        
        .status-issued {
            color: #D97706;
            font-weight: bold;
        }
        
        .status-revoked {
            color: #DC2626;
            font-weight: bold;
        }
        
        .status-expired {
            color: #6B7280;
            font-weight: bold;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            font-size: 8px;
            color: #666;
            text-align: center;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .summary {
            margin-bottom: 20px;
            font-size: 9px;
        }
        
        .summary-item {
            display: inline-block;
            margin-right: 20px;
        }
        
        .summary-label {
            color: #666;
        }
        
        .summary-value {
            font-weight: bold;
            color: #4F46E5;
        }
        
        .text-right {
            text-align: right;
        }
        
        .text-center {
            text-align: center;
        }
        
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 8px;
            font-weight: bold;
        }
        
        .badge-active {
            background-color: #D1FAE5;
            color: #065F46;
        }
        
        .badge-issued {
            background-color: #FEF3C7;
            color: #92400E;
        }
        
        .badge-revoked {
            background-color: #FEE2E2;
            color: #991B1B;
        }
        
        .badge-expired {
            background-color: #F3F4F6;
            color: #374151;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <h1>Digital Cards Export</h1>
        <div class="subtitle">
            Generated on {{ $generated_at }} | Total Cards: {{ $total_cards }}
        </div>
    </div>
    
    <!-- Filters -->
    @if(!empty($filters))
    <div class="filters">
        <h3>Applied Filters</h3>
        @if(isset($filters['status']) && $filters['status'])
            <span class="filter-item">Status: {{ ucfirst($filters['status']) }}</span>
        @endif
        
        @if(isset($filters['member_id']) && $filters['member_id'])
            <span class="filter-item">Member ID: {{ $filters['member_id'] }}</span>
        @endif
        
        @if(isset($filters['member_name']) && $filters['member_name'])
            <span class="filter-item">Member Name: {{ $filters['member_name'] }}</span>
        @endif
        
        @if(isset($filters['issued_from']) && $filters['issued_from'])
            <span class="filter-item">Issued From: {{ $filters['issued_from'] }}</span>
        @endif
        
        @if(isset($filters['issued_to']) && $filters['issued_to'])
            <span class="filter-item">Issued To: {{ $filters['issued_to'] }}</span>
        @endif
    </div>
    @endif
    
    <!-- Summary Stats -->
    @php
        $statusCounts = [];
        foreach ($cards as $card) {
            $status = $card['status'] ?? 'unknown';
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
        }
        
        $activeCount = $statusCounts['active'] ?? 0;
        $issuedCount = $statusCounts['issued'] ?? 0;
        $revokedCount = $statusCounts['revoked'] ?? 0;
        $expiredCount = $statusCounts['expired'] ?? 0;
    @endphp
    
    <div class="summary">
        <div class="summary-item">
            <span class="summary-label">Active:</span>
            <span class="summary-value">{{ $activeCount }}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Issued:</span>
            <span class="summary-value">{{ $issuedCount }}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Revoked:</span>
            <span class="summary-value">{{ $revokedCount }}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Expired:</span>
            <span class="summary-value">{{ $expiredCount }}</span>
        </div>
    </div>
    
    <!-- Cards Table -->
    <table>
        <thead>
            <tr>
                @foreach($headers as $header)
                    <th>{{ $header }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach($cards as $card)
                <tr>
                    @foreach($export['columns'] as $column)
                        @php
                            $value = $card[$column] ?? null;
                            $formattedValue = $this->formatValue($value, $column);
                        @endphp
                        <td>{!! $formattedValue !!}</td>
                    @endforeach
                </tr>
            @endforeach
        </tbody>
    </table>
    
    <!-- Footer -->
    <div class="footer">
        <div>Digital Cards Management System</div>
        <div>Export ID: {{ $export['id'] }} | Generated on: {{ $generated_at }}</div>
        <div>This is an automatically generated report. Data is current as of generation time.</div>
    </div>
</body>
</html>

@php
    function formatValue($value, $column) {
        if ($value === null) {
            return '<span style="color: #999;">—</span>';
        }
        
        // Format based on column type
        switch ($column) {
            case 'status':
                $badgeClass = match($value) {
                    'active' => 'badge-active',
                    'issued' => 'badge-issued',
                    'revoked' => 'badge-revoked',
                    'expired' => 'badge-expired',
                    default => ''
                };
                return '<span class="badge ' . $badgeClass . '">' . ucfirst($value) . '</span>';
            
            case 'issued_at':
            case 'expiry_date':
            case 'activated_at':
            case 'revoked_at':
                try {
                    $date = new DateTime($value);
                    return $date->format('Y-m-d H:i');
                } catch (Exception $e) {
                    return $value;
                }
            
            case 'days_remaining':
                if ($value === null) return '—';
                return '<span style="color: ' . ($value < 30 ? '#DC2626' : '#059669') . '; font-weight: bold;">' . $value . '</span>';
            
            case 'is_expired':
                return $value ? 'Yes' : 'No';
            
            case 'revocation_reason':
                return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
            
            default:
                return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
        }
    }
@endphp
```

## **Step 8: Create Export Command and Handler**

```bash
php artisan make:command GenerateCardExport --path=app/Contexts/DigitalCard/Application/Commands
```

```php
<?php

namespace App\Contexts\DigitalCard\Application\Commands;

use App\Contexts\DigitalCard\Domain\ValueObjects\ExportId;

class GenerateCardExport
{
    public function __construct(
        private ExportId $exportId
    ) {}

    public function exportId(): ExportId
    {
        return $this->exportId;
    }
}
```

```bash
php artisan make:handler GenerateCardExportHandler --path=app/Contexts/DigitalCard/Application/Handlers
```

```php
<?php

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\GenerateCardExport;
use App\Contexts\DigitalCard\Domain\Models\CardExport;
use App\Contexts\DigitalCard\Domain\Contracts\ExportRepository;
use App\Contexts\DigitalCard\Infrastructure\Services\Export\CsvExportService;
use App\Contexts\DigitalCard\Infrastructure\Services\Export\ExcelExportService;
use App\Contexts\DigitalCard\Infrastructure\Services\Export\PdfExportService;
use App\Contexts\DigitalCard\Infrastructure\Services\Export\JsonExportService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

class GenerateCardExportHandler implements ShouldQueue
{
    public $queue = 'exports';
    public $tries = 3;
    public $timeout = 300; // 5 minutes

    public function __construct(
        private ExportRepository $exportRepository,
        private CsvExportService $csvService,
        private ExcelExportService $excelService,
        private PdfExportService $pdfService,
        private JsonExportService $jsonService
    ) {}

    public function handle(GenerateCardExport $command): void
    {
        $export = $this->exportRepository->findById($command->exportId());
        
        if (!$export) {
            Log::error('Export not found', ['export_id' => $command->exportId()->toString()]);
            return;
        }

        try {
            // Start processing
            $export->startProcessing();
            $this->exportRepository->save($export);
            
            // Generate file based on format
            $filePath = match($export->format()) {
                'csv' => $this->csvService->generate($export),
                'excel' => $this->excelService->generate($export),
                'pdf' => $this->pdfService->generate($export),
                'json' => $this->jsonService->generate($export),
                default => throw new \RuntimeException("Unsupported export format: {$export->format()}")
            };
            
            // Get file size
            $fileSize = filesize(storage_path("app/exports/{$filePath}"));
            
            // Complete the export
            $export->complete($filePath, $fileSize, [
                'row_count' => count($this->getExportService($export)->getCardsData($export)),
                'generated_at' => now()->toISOString(),
            ]);
            
            $this->exportRepository->save($export);
            
            Log::info('Export generated successfully', [
                'export_id' => $export->id()->toString(),
                'format' => $export->format(),
                'file_size' => $fileSize,
            ]);
            
        } catch (\Exception $e) {
            Log::error('Export generation failed', [
                'export_id' => $export->id()->toString(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            $export->fail($e->getMessage());
            $this->exportRepository->save($export);
            
            throw $e;
        }
    }

    public function failed(GenerateCardExport $command, \Throwable $exception): void
    {
        $export = $this->exportRepository->findById($command->exportId());
        
        if ($export) {
            $export->fail("Export failed: " . $exception->getMessage());
            $this->exportRepository->save($export);
        }
        
        Log::error('Export job failed', [
            'export_id' => $command->exportId()->toString(),
            'error' => $exception->getMessage(),
        ]);
    }

    private function getExportService(CardExport $export)
    {
        return match($export->format()) {
            'csv' => $this->csvService,
            'excel' => $this->excelService,
            'pdf' => $this->pdfService,
            'json' => $this->jsonService,
            default => throw new \RuntimeException("Unsupported export format")
        };
    }
}
```

## **Step 9: Create Export Form Request**

```bash
php artisan make:request ExportCardsRequest --path=app/Contexts/DigitalCard/Infrastructure/Http/Requests
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExportCardsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('export', \App\Contexts\DigitalCard\Domain\Entities\DigitalCard::class);
    }

    public function rules(): array
    {
        return [
            'format' => ['required', 'string', 'in:csv,excel,pdf,json'],
            'columns' => ['required', 'array', 'min:1'],
            'columns.*' => ['string', 'in:id,member_id,member_name,status,issued_at,expiry_date,activated_at,revoked_at,revocation_reason,days_remaining,is_expired,tenant_id'],
            'filters' => ['nullable', 'array'],
            'filters.status' => ['nullable', 'string', 'in:issued,active,revoked,expired'],
            'filters.member_id' => ['nullable', 'string', 'max:50'],
            'filters.member_name' => ['nullable', 'string', 'max:100'],
            'filters.issued_from' => ['nullable', 'date_format:Y-m-d'],
            'filters.issued_to' => ['nullable', 'date_format:Y-m-d'],
            'filters.expires_from' => ['nullable', 'date_format:Y-m-d'],
            'filters.expires_to' => ['nullable', 'date_format:Y-m-d'],
            'template' => ['nullable', 'string', 'max:50'],
            'include_filters' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'format.in' => 'Format must be one of: csv, excel, pdf, json.',
            'columns.min' => 'At least one column must be selected.',
            'columns.*.in' => 'Invalid column selected.',
        ];
    }

    public function validated($key = null, $default = null)
    {
        $validated = parent::validated($key, $default);
        
        // Ensure filters array exists
        if (!isset($validated['filters'])) {
            $validated['filters'] = [];
        }
        
        // Remove empty filter values
        $validated['filters'] = array_filter($validated['filters'], fn($value) => !empty($value));
        
        return $validated;
    }
}
```

## **Step 10: Update Controller with Export Methods**

Update the DigitalCardController:

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Http\Controllers;

// ... existing imports ...
use App\Contexts\DigitalCard\Application\Commands\GenerateCardExport;
use App\Contexts\DigitalCard\Infrastructure\Http\Requests\ExportCardsRequest;
use App\Contexts\DigitalCard\Domain\Models\CardExport;
use App\Contexts\DigitalCard\Domain\ValueObjects\ExportId;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;
use App\Contexts\DigitalCard\Domain\ValueObjects\UserId;
use App\Events\ExportStarted;
use App\Events\ExportCompleted;
use Illuminate\Support\Facades\Storage;

class DigitalCardController extends Controller
{
    // ... existing methods ...

    /**
     * Export cards
     */
    public function export(ExportCardsRequest $request)
    {
        try {
            $exportId = ExportId::generate();
            
            // Create export record
            $export = CardExport::create(
                id: $exportId,
                tenantId: new TenantId(tenancy()->getCurrentTenant()->id),
                format: $request->input('format'),
                filters: $request->input('filters', []),
                columns: $request->input('columns'),
                requestedBy: new UserId($request->user()->id),
                template: $request->input('template')
            );
            
            // Save export record
            $exportRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\ExportRepository::class);
            $exportRepository->save($export);
            
            // Dispatch export job
            $command = new GenerateCardExport($exportId);
            $this->commandBus->dispatch($command);
            
            // Dispatch WebSocket event
            event(new ExportStarted($export->toArray()));
            
            if ($request->wantsJson()) {
                return response()->json([
                    'message' => 'Export started successfully.',
                    'export_id' => $exportId->toString(),
                    'status' => 'pending',
                    'estimated_time' => $this->getEstimatedTime($export),
                ], 202);
            }
            
            return redirect()
                ->route('tenant.digital-cards.exports.show', $exportId->toString())
                ->with('success', 'Export started successfully.');
                
        } catch (\Exception $e) {
            \Log::error('Export failed:', ['error' => $e->getMessage()]);
            
            if ($request->wantsJson()) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
            
            return redirect()
                ->back()
                ->withErrors(['error' => $e->getMessage()])
                ->withInput();
        }
    }

    /**
     * Get export status
     */
    public function getExportStatus(string $tenant, string $exportId)
    {
        try {
            $exportRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\ExportRepository::class);
            $export = $exportRepository->findById(new ExportId($exportId));
            
            if (!$export) {
                return response()->json(['message' => 'Export not found.'], 404);
            }
            
            // Check authorization
            if ($export->requestedBy()->toString() !== auth()->id() && !auth()->user()->isPlatformAdmin()) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
            
            return response()->json($export->toArray());
            
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Download export file
     */
    public function downloadExport(string $tenant, string $exportId)
    {
        try {
            $exportRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\ExportRepository::class);
            $export = $exportRepository->findById(new ExportId($exportId));
            
            if (!$export) {
                abort(404, 'Export not found.');
            }
            
            // Check authorization
            if ($export->requestedBy()->toString() !== auth()->id() && !auth()->user()->isPlatformAdmin()) {
                abort(403, 'Unauthorized.');
            }
            
            if (!$export->isDownloadable()) {
                abort(404, 'Export file is not available or has expired.');
            }
            
            // Record download
            $export->recordDownload();
            $exportRepository->save($export);
            
            // Get file path
            $filePath = $export->filePath();
            $fileName = $export->getFileName();
            $mimeType = $export->getMimeType();
            
            // Return file download
            return Storage::disk('exports')->download($filePath, $fileName, [
                'Content-Type' => $mimeType,
                'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Export download failed:', ['error' => $e->getMessage()]);
            abort(500, 'Failed to download export.');
        }
    }

    /**
     * List exports
     */
    public function listExports(Request $request)
    {
        $this->authorize('export', \App\Contexts\DigitalCard\Domain\Entities\DigitalCard::class);
        
        try {
            $exportRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\ExportRepository::class);
            
            $filters = $request->only(['format', 'status', 'date_from', 'date_to', 'search']);
            $perPage = $request->input('per_page', 20);
            
            $exports = $exportRepository->findByTenant(
                new TenantId(tenancy()->getCurrentTenant()->id),
                $filters,
                $perPage
            );
            
            if ($request->wantsJson()) {
                return response()->json($exports);
            }
            
            return Inertia::render('Tenant/DigitalCards/Exports/Index', [
                'exports' => $exports['data'],
                'filters' => $filters,
                'meta' => $exports['meta'],
            ]);
            
        } catch (\Exception $e) {
            \Log::error('List exports failed:', ['error' => $e->getMessage()]);
            
            if ($request->wantsJson()) {
                return response()->json(['message' => $e->getMessage()], 500);
            }
            
            return redirect()
                ->back()
                ->withErrors(['error' => $e->getMessage()]);
        }
    }

    /**
     * Show export details
     */
    public function showExport(string $tenant, string $exportId)
    {
        try {
            $exportRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\ExportRepository::class);
            $export = $exportRepository->findById(new ExportId($exportId));
            
            if (!$export) {
                abort(404);
            }
            
            // Check authorization
            if ($export->requestedBy()->toString() !== auth()->id() && !auth()->user()->isPlatformAdmin()) {
                abort(403);
            }
            
            return Inertia::render('Tenant/DigitalCards/Exports/Show', [
                'export' => $export->toArray(),
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Show export failed:', ['error' => $e->getMessage()]);
            abort(500);
        }
    }

    /**
     * Delete export
     */
    public function deleteExport(string $tenant, string $exportId)
    {
        try {
            $exportRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\ExportRepository::class);
            $export = $exportRepository->findById(new ExportId($exportId));
            
            if (!$export) {
                return response()->json(['message' => 'Export not found.'], 404);
            }
            
            // Check authorization
            if ($export->requestedBy()->toString() !== auth()->id() && !auth()->user()->isPlatformAdmin()) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
            
            $deleted = $exportRepository->delete(new ExportId($exportId));
            
            if (!$deleted) {
                return response()->json(['message' => 'Failed to delete export.'], 500);
            }
            
            return response()->json(['message' => 'Export deleted successfully.']);
            
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get available columns for export
     */
    public function getExportColumns()
    {
        $columns = [
            ['value' => 'id', 'label' => 'Card ID', 'category' => 'Identification'],
            ['value' => 'member_id', 'label' => 'Member ID', 'category' => 'Identification'],
            ['value' => 'member_name', 'label' => 'Member Name', 'category' => 'Identification'],
            ['value' => 'status', 'label' => 'Status', 'category' => 'Status'],
            ['value' => 'issued_at', 'label' => 'Issued At', 'category' => 'Dates'],
            ['value' => 'expiry_date', 'label' => 'Expiry Date', 'category' => 'Dates'],
            ['value' => 'activated_at', 'label' => 'Activated At', 'category' => 'Dates'],
            ['value' => 'revoked_at', 'label' => 'Revoked At', 'category' => 'Dates'],
            ['value' => 'revocation_reason', 'label' => 'Revocation Reason', 'category' => 'Status'],
            ['value' => 'days_remaining', 'label' => 'Days Remaining', 'category' => 'Status'],
            ['value' => 'is_expired', 'label' => 'Is Expired', 'category' => 'Status'],
            ['value' => 'tenant_id', 'label' => 'Tenant ID', 'category' => 'System'],
        ];
        
        return response()->json($columns);
    }

    /**
     * Get export templates
     */
    public function getExportTemplates()
    {
        $templates = [
            [
                'id' => 'basic',
                'name' => 'Basic Report',
                'description' => 'Essential card information',
                'columns' => ['member_id', 'member_name', 'status', 'issued_at', 'expiry_date'],
                'format' => 'excel',
            ],
            [
                'id' => 'detailed',
                'name' => 'Detailed Report',
                'description' => 'Complete card information',
                'columns' => ['member_id', 'member_name', 'status', 'issued_at', 'expiry_date', 'activated_at', 'revoked_at', 'revocation_reason', 'days_remaining'],
                'format' => 'excel',
            ],
            [
                'id' => 'audit',
                'name' => 'Audit Report',
                'description' => 'For compliance and auditing',
                'columns' => ['id', 'member_id', 'member_name', 'status', 'issued_at', 'expiry_date', 'activated_at', 'revoked_at', 'revocation_reason'],
                'format' => 'pdf',
            ],
            [
                'id' => 'active_cards',
                'name' => 'Active Cards Report',
                'description' => 'Currently active cards only',
                'columns' => ['member_id', 'member_name', 'issued_at', 'expiry_date', 'days_remaining'],
                'filters' => ['status' => 'active'],
                'format' => 'csv',
            ],
            [
                'id' => 'data_migration',
                'name' => 'Data Migration',
                'description' => 'Complete dataset for migration',
                'columns' => ['id', 'member_id', 'member_name', 'status', 'issued_at', 'expiry_date', 'activated_at', 'revoked_at', 'revocation_reason', 'tenant_id'],
                'format' => 'json',
            ],
        ];
        
        return response()->json($templates);
    }

    /**
     * Quick export (single endpoint for common exports)
     */
    public function quickExport(Request $request)
    {
        $this->authorize('export', \App\Contexts\DigitalCard\Domain\Entities\DigitalCard::class);
        
        $validated = $request->validate([
            'type' => ['required', 'string', 'in:active_cards,expiring_soon,recent_activity'],
            'format' => ['required', 'string', 'in:csv,excel,pdf'],
        ]);
        
        try {
            // Determine filters and columns based on type
            $config = $this->getQuickExportConfig($validated['type']);
            
            $exportId = ExportId::generate();
            
            $export = CardExport::create(
                id: $exportId,
                tenantId: new TenantId(tenancy()->getCurrentTenant()->id),
                format: $validated['format'],
                filters: $config['filters'],
                columns: $config['columns'],
                requestedBy: new UserId($request->user()->id),
                template: "quick_{$validated['type']}"
            );
            
            $exportRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\ExportRepository::class);
            $exportRepository->save($export);
            
            // Dispatch job
            $command = new GenerateCardExport($exportId);
            $this->commandBus->dispatch($command);
            
            return response()->json([
                'message' => 'Quick export started successfully.',
                'export_id' => $exportId->toString(),
                'type' => $validated['type'],
                'format' => $validated['format'],
            ], 202);
            
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    private function getQuickExportConfig(string $type): array
    {
        return match($type) {
            'active_cards' => [
                'filters' => ['status' => 'active'],
                'columns' => ['member_id', 'member_name', 'issued_at', 'expiry_date', 'days_remaining'],
            ],
            'expiring_soon' => [
                'filters' => [
                    'status' => 'active',
                    'expires_to' => now()->addDays(30)->format('Y-m-d'),
                ],
                'columns' => ['member_id', 'member_name', 'expiry_date', 'days_remaining'],
            ],
            'recent_activity' => [
                'filters' => [
                    'issued_from' => now()->subDays(7)->format('Y-m-d'),
                ],
                'columns' => ['member_id', 'member_name', 'status', 'issued_at', 'activated_at', 'revoked_at'],
            ],
            default => [
                'filters' => [],
                'columns' => ['member_id', 'member_name', 'status', 'issued_at', 'expiry_date'],
            ],
        };
    }

    private function getEstimatedTime(CardExport $export): string
    {
        // Simple estimation based on format
        return match($export->format()) {
            'csv', 'json' => '1-2 minutes',
            'excel' => '2-3 minutes',
            'pdf' => '3-5 minutes',
            default => '2-3 minutes',
        };
    }
}
```

## **Step 11: Create WebSocket Events for Exports**

```bash
php artisan make:event ExportStarted --event
php artisan make:event ExportCompleted --event
```

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ExportStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $export;

    public function __construct($export)
    {
        $this->export = $export;
    }

    public function broadcastOn()
    {
        return new PrivateChannel("user.{$this->export['requested_by']}.exports");
    }

    public function broadcastAs()
    {
        return 'export.started';
    }

    public function broadcastWith()
    {
        return [
            'export' => $this->export,
            'timestamp' => now()->toISOString(),
            'message' => "Export started: {$this->export['format']} format",
        ];
    }
}
```

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ExportCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $export;

    public function __construct($export)
    {
        $this->export = $export;
    }

    public function broadcastOn()
    {
        return new PrivateChannel("user.{$this->export['requested_by']}.exports");
    }

    public function broadcastAs()
    {
        return 'export.completed';
    }

    public function broadcastWith()
    {
        return [
            'export' => $this->export,
            'timestamp' => now()->toISOString(),
            'message' => "Export completed: {$this->export['file_name']}",
        ];
    }
}
```

Update the GenerateCardExportHandler to dispatch the completed event:

```php
// In GenerateCardExportHandler::handle() after export->complete()
event(new ExportCompleted($export->toArray()));
```

## **Step 12: Create Export Vue Components**

### **12.1 Create ExportModal component**

```vue
<!-- resources/js/Pages/Tenant/DigitalCards/Components/ExportModal.vue -->
<template>
  <Modal :show="show" max-width="4xl" @close="$emit('close')">
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-medium text-gray-900">
            Export Digital Cards
          </h3>
          <p class="text-sm text-gray-500">
            Export card data in various formats for reporting and analysis
          </p>
        </div>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon class="w-6 h-6" />
        </button>
      </div>
      
      <div class="space-y-8">
        <!-- Step 1: Format Selection -->
        <div>
          <h4 class="text-sm font-medium text-gray-900 mb-4">1. Select Export Format</h4>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              v-for="format in formats"
              :key="format.value"
              @click="selectFormat(format.value)"
              :class="[
                'border-2 rounded-lg p-4 text-left transition-colors hover:shadow-md',
                selectedFormat === format.value ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
              ]"
            >
              <div class="flex items-center justify-between mb-3">
                <component :is="format.icon" class="w-6 h-6 text-gray-400" />
                <RadioGroupOption
                  :value="format.value"
                  v-slot="{ checked }"
                  as="template"
                >
                  <div
                    :class="[
                      checked ? 'bg-blue-600 border-transparent' : 'bg-white border-gray-300',
                      'relative flex h-4 w-4 items-center justify-center rounded-full border',
                    ]"
                  >
                    <span class="sr-only">{{ format.name }}</span>
                    <span
                      v-if="checked"
                      class="h-1.5 w-1.5 rounded-full bg-white"
                    />
                  </div>
                </RadioGroupOption>
              </div>
              <h5 class="font-medium text-gray-900">{{ format.name }}</h5>
              <p class="text-xs text-gray-600 mt-1">{{ format.description }}</p>
              <div class="mt-2 text-xs text-gray-500">
                Best for: {{ format.bestFor }}
              </div>
            </button>
          </div>
        </div>
        
        <!-- Step 2: Template Selection (Optional) -->
        <div v-if="selectedFormat">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-medium text-gray-900">2. Choose Template (Optional)</h4>
            <button
              @click="showTemplates = !showTemplates"
              class="text-sm text-blue-600 hover:text-blue-800"
            >
              {{ showTemplates ? 'Hide' : 'Show' }} Templates
            </button>
          </div>
          
          <div v-if="showTemplates" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                v-for="template in filteredTemplates"
                :key="template.id"
                @click="selectTemplate(template)"
                :class="[
                  'border rounded-lg p-4 text-left transition-colors',
                  selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
                ]"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <h5 class="font-medium text-gray-900">{{ template.name }}</h5>
                    <p class="text-xs text-gray-600 mt-1">{{ template.description }}</p>
                    <div class="mt-2">
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                        {{ template.format }}
                      </span>
                      <span class="text-xs text-gray-500 ml-2">
                        {{ template.columns.length }} columns
                      </span>
                    </div>
                  </div>
                  <CheckIcon
                    v-if="selectedTemplate?.id === template.id"
                    class="w-5 h-5 text-blue-600"
                  />
                </div>
              </button>
            </div>
            
            <div v-if="selectedTemplate" class="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div class="flex">
                <InformationCircleIcon class="w-5 h-5 text-blue-400 mr-2" />
                <div>
                  <p class="text-sm font-medium text-blue-800">Template Selected</p>
                  <p class="text-sm text-blue-700 mt-1">
                    Using "{{ selectedTemplate.name }}" template with {{ selectedTemplate.columns.length }} columns.
                    {{ selectedTemplate.filters ? 'Filters will be applied.' : '' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Step 3: Column Selection -->
        <div v-if="selectedFormat">
          <h4 class="text-sm font-medium text-gray-900 mb-4">3. Select Columns to Export</h4>
          
          <!-- Column Categories -->
          <div class="space-y-4">
            <div
              v-for="category in columnCategories"
              :key="category.name"
              class="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                @click="toggleCategory(category.name)"
                class="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
              >
                <div class="flex items-center">
                  <ChevronRightIcon
                    class="w-4 h-4 mr-2 transition-transform"
                    :class="{ 'rotate-90': expandedCategories.includes(category.name) }"
                  />
                  <span class="font-medium text-gray-900">{{ category.name }}</span>
                  <span class="ml-2 text-xs text-gray-500">
                    ({{ getSelectedCountInCategory(category.name) }} selected)
                  </span>
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    @click.stop="selectAllInCategory(category.name)"
                    class="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    @click.stop="deselectAllInCategory(category.name)"
                    class="text-xs text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                </div>
              </button>
              
              <div
                v-if="expandedCategories.includes(category.name)"
                class="p-4 border-t border-gray-200"
              >
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div
                    v-for="column in category.columns"
                    :key="column.value"
                    class="flex items-center space-x-3"
                  >
                    <input
                      :id="`column-${column.value}`"
                      v-model="selectedColumns"
                      type="checkbox"
                      :value="column.value"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label
                      :for="`column-${column.value}`"
                      class="text-sm text-gray-700"
                    >
                      {{ column.label }}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Select All / Deselect All -->
          <div class="flex items-center justify-between mt-4 p-3 bg-gray-50 rounded-md">
            <div class="text-sm text-gray-700">
              {{ selectedColumns.length }} of {{ allColumns.length }} columns selected
            </div>
            <div class="flex space-x-3">
              <button
                type="button"
                @click="selectAllColumns"
                class="text-sm text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <button
                type="button"
                @click="deselectAllColumns"
                class="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
        
        <!-- Step 4: Filters (Optional) -->
        <div v-if="selectedFormat && !selectedTemplate?.filters">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-medium text-gray-900">4. Apply Filters (Optional)</h4>
            <button
              @click="showFilters = !showFilters"
              class="text-sm text-blue-600 hover:text-blue-800"
            >
              {{ showFilters ? 'Hide' : 'Show' }} Filters
            </button>
          </div>
          
          <div v-if="showFilters" class="space-y-4">
            <!-- Use current table filters -->
            <div class="flex items-center space-x-3">
              <input
                v-model="useCurrentFilters"
                type="checkbox"
                id="useCurrentFilters"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label for="useCurrentFilters" class="text-sm text-gray-700">
                Use current table filters
                <span class="text-xs text-gray-500 block">
                  Apply the same filters currently active in the cards table
                </span>
              </label>
            </div>
            
            <!-- Custom filters -->
            <div class="border border-gray-200 rounded-lg p-4">
              <h5 class="text-sm font-medium text-gray-900 mb-3">Custom Filters</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    v-model="customFilters.status"
                    class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="issued">Issued</option>
                    <option value="active">Active</option>
                    <option value="revoked">Revoked</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Date Range
                  </label>
                  <div class="flex gap-2">
                    <input
                      v-model="customFilters.issued_from"
                      type="date"
                      placeholder="From"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <input
                      v-model="customFilters.issued_to"
                      type="date"
                      placeholder="To"
                      class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Current filters preview -->
            <div v-if="useCurrentFilters && Object.keys(currentTableFilters).length > 0" class="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div class="flex">
                <InformationCircleIcon class="w-5 h-5 text-blue-400 mr-2" />
                <div>
                  <p class="text-sm font-medium text-blue-800">Current Table Filters</p>
                  <div class="mt-1 flex flex-wrap gap-2">
                    <span
                      v-for="(value, key) in currentTableFilters"
                      :key="key"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                    >
                      {{ key }}: {{ value }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Step 5: Export Options -->
        <div v-if="selectedFormat">
          <h4 class="text-sm font-medium text-gray-900 mb-4">5. Export Options</h4>
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <input
                v-model="includeFiltersInExport"
                type="checkbox"
                id="includeFilters"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label for="includeFilters" class="text-sm text-gray-700">
                Include filter information in export
                <span class="text-xs text-gray-500 block">
                  Adds a section describing the filters used
                </span>
              </label>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                v-model="notes"
                rows="2"
                placeholder="Add any notes about this export..."
                class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        <!-- Summary -->
        <div v-if="selectedFormat" class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Export Summary</h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p class="text-gray-600">Format:</p>
              <p class="font-medium text-gray-900">{{ selectedFormatLabel }}</p>
            </div>
            <div>
              <p class="text-gray-600">Columns:</p>
              <p class="font-medium text-gray-900">{{ selectedColumns.length }}</p>
            </div>
            <div>
              <p class="text-gray-600">Template:</p>
              <p class="font-medium text-gray-900">{{ selectedTemplate?.name || 'Custom' }}</p>
            </div>
            <div>
              <p class="text-gray-600">Estimated Time:</p>
              <p class="font-medium text-gray-900">{{ estimatedTime }}</p>
            </div>
          </div>
        </div>
        
        <!-- Error Message -->
        <div v-if="errorMessage" class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex">
            <ExclamationTriangleIcon class="w-5 h-5 text-red-400 mr-2" />
            <p class="text-sm text-red-700">{{ errorMessage }}</p>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-between pt-6 border-t border-gray-200">
          <SecondaryButton
            @click="$emit('close')"
            :disabled="loading"
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            @click="submitExport"
            :disabled="!canSubmit || loading"
            class="flex items-center"
          >
            <ArrowPathIcon v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
            <ArrowDownTrayIcon v-else class="w-4 h-4 mr-2" />
            {{ loading ? 'Preparing...' : 'Generate Export' }}
          </PrimaryButton>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import { RadioGroup, RadioGroupOption } from '@headlessui/vue'
import Modal from '@/Components/Modal.vue'
import PrimaryButton from '@/Components/PrimaryButton.vue'
import SecondaryButton from '@/Components/SecondaryButton.vue'
import {
  XMarkIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  TableCellsIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  currentFilters: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'started'])

// Get page props
const page = usePage()

// Formats
const formats = [
  {
    value: 'csv',
    name: 'CSV',
    description: 'Comma-separated values',
    bestFor: 'Data analysis, spreadsheets',
    icon: TableCellsIcon,
  },
  {
    value: 'excel',
    name: 'Excel',
    description: 'Microsoft Excel format',
    bestFor: 'Reports, formatted data',
    icon: DocumentTextIcon,
  },
  {
    value: 'pdf',
    name: 'PDF',
    description: 'Portable Document Format',
    bestFor: 'Printing, sharing, archiving',
    icon: DocumentArrowDownIcon,
  },
  {
    value: 'json',
    name: 'JSON',
    description: 'JavaScript Object Notation',
    bestFor: 'Data migration, APIs',
    icon: ChartBarIcon,
  },
]

// State
const selectedFormat = ref('excel')
const showTemplates = ref(true)
const showFilters = ref(false)
const selectedTemplate = ref(null)
const selectedColumns = ref([])
const expandedCategories = ref([])
const useCurrentFilters = ref(true)
const customFilters = ref({
  status: '',
  issued_from: '',
  issued_to: '',
})
const includeFiltersInExport = ref(true)
const notes = ref('')

// Templates (will be loaded from API)
const templates = ref([])

// Columns (will be loaded from API)
const availableColumns = ref([])

// Loading state
const loading = ref(false)
const errorMessage = ref('')

// Computed
const selectedFormatLabel = computed(() => {
  const format = formats.find(f => f.value === selectedFormat.value)
  return format ? format.name : ''
})

const filteredTemplates = computed(() => {
  return templates.value.filter(template => 
    template.format === selectedFormat.value || template.format === 'any'
  )
})

const columnCategories = computed(() => {
  const categories = {}
  
  availableColumns.value.forEach(column => {
    const category = column.category || 'Other'
    if (!categories[category]) {
          categories[category] = {
            name: category,
            columns: []
          }
        }
        
        categories[category].columns.push(column)
      })
      
      // Convert to array and sort
      return Object.values(categories).sort((a, b) => a.name.localeCompare(b.name))
    })

const allColumns = computed(() => {
  return availableColumns.value.map(col => col.value)
})

const currentTableFilters = computed(() => {
  // Remove pagination/sort fields
  const { page, per_page, sort, direction, ...filters } = props.currentFilters
  return filters
})

const canSubmit = computed(() => {
  return selectedFormat.value && selectedColumns.value.length > 0
})

const estimatedTime = computed(() => {
  switch (selectedFormat.value) {
    case 'csv':
    case 'json':
      return '1-2 minutes'
    case 'excel':
      return '2-3 minutes'
    case 'pdf':
      return '3-5 minutes'
    default:
      return '2-3 minutes'
  }
})

// Methods
const selectFormat = (format) => {
  selectedFormat.value = format
  
  // If template doesn't match new format, clear it
  if (selectedTemplate.value && selectedTemplate.value.format !== format && selectedTemplate.value.format !== 'any') {
    selectedTemplate.value = null
  }
}

const selectTemplate = (template) => {
  selectedTemplate.value = template
  
  // Apply template columns
  selectedColumns.value = [...template.columns]
  
  // Expand template column categories
  if (template.columns && template.columns.length > 0) {
    const categories = new Set()
    template.columns.forEach(colName => {
      const column = availableColumns.value.find(c => c.value === colName)
      if (column && column.category) {
        categories.add(column.category)
      }
    })
    expandedCategories.value = Array.from(categories)
  }
}

const toggleCategory = (categoryName) => {
  const index = expandedCategories.value.indexOf(categoryName)
  if (index === -1) {
    expandedCategories.value.push(categoryName)
  } else {
    expandedCategories.value.splice(index, 1)
  }
}

const getSelectedCountInCategory = (categoryName) => {
  const category = columnCategories.value.find(c => c.name === categoryName)
  if (!category) return 0
  
  return category.columns.filter(col => 
    selectedColumns.value.includes(col.value)
  ).length
}

const selectAllInCategory = (categoryName) => {
  const category = columnCategories.value.find(c => c.name === categoryName)
  if (!category) return
  
  category.columns.forEach(col => {
    if (!selectedColumns.value.includes(col.value)) {
      selectedColumns.value.push(col.value)
    }
  })
  
  if (!expandedCategories.value.includes(categoryName)) {
    expandedCategories.value.push(categoryName)
  }
}

const deselectAllInCategory = (categoryName) => {
  const category = columnCategories.value.find(c => c.name === categoryName)
  if (!category) return
  
  selectedColumns.value = selectedColumns.value.filter(colValue => 
    !category.columns.some(col => col.value === colValue)
  )
}

const selectAllColumns = () => {
  selectedColumns.value = [...allColumns.value]
  expandedCategories.value = columnCategories.value.map(c => c.name)
}

const deselectAllColumns = () => {
  selectedColumns.value = []
  expandedCategories.value = []
}

const loadTemplates = async () => {
  try {
    const response = await router.get(route('tenant.digital-cards.exports.templates'), {}, {
      preserveState: true,
      onSuccess: (page) => {
        templates.value = page.props.templates || []
      }
    })
  } catch (error) {
    console.error('Failed to load templates:', error)
  }
}

const loadColumns = async () => {
  try {
    const response = await router.get(route('tenant.digital-cards.exports.columns'), {}, {
      preserveState: true,
      onSuccess: (page) => {
        availableColumns.value = page.props.columns || []
        
        // Set default columns
        if (selectedColumns.value.length === 0) {
          selectedColumns.value = ['member_id', 'member_name', 'status', 'issued_at', 'expiry_date']
        }
      }
    })
  } catch (error) {
    console.error('Failed to load columns:', error)
  }
}

const submitExport = async () => {
  if (!canSubmit.value || loading.value) return
  
  loading.value = true
  errorMessage.value = ''
  
  try {
    // Prepare payload
    const payload = {
      format: selectedFormat.value,
      columns: selectedColumns.value,
      include_filters: includeFiltersInExport.value,
      notes: notes.value.trim(),
    }
    
    // Add filters
    if (useCurrentFilters.value && Object.keys(currentTableFilters.value).length > 0) {
      payload.filters = currentTableFilters.value
    } else if (Object.keys(customFilters.value).some(key => customFilters.value[key])) {
      payload.filters = Object.fromEntries(
        Object.entries(customFilters.value).filter(([_, value]) => value)
      )
    }
    
    // Add template if selected
    if (selectedTemplate.value) {
      payload.template = selectedTemplate.value.id
    }
    
    const response = await router.post(route('tenant.digital-cards.exports.create'), payload, {
      preserveScroll: true,
      onSuccess: (page) => {
        emit('started', page.props.export || {})
        resetForm()
      },
      onError: (errors) => {
        errorMessage.value = errors.message || 'Failed to create export.'
      },
      onFinish: () => {
        loading.value = false
      }
    })
    
  } catch (error) {
    errorMessage.value = 'An unexpected error occurred.'
    loading.value = false
    console.error('Export failed:', error)
  }
}

const resetForm = () => {
  selectedFormat.value = 'excel'
  selectedTemplate.value = null
  selectedColumns.value = ['member_id', 'member_name', 'status', 'issued_at', 'expiry_date']
  expandedCategories.value = []
  useCurrentFilters.value = true
  customFilters.value = {
    status: '',
    issued_from: '',
    issued_to: '',
  }
  includeFiltersInExport.value = true
  notes.value = ''
  errorMessage.value = ''
}

// Lifecycle
onMounted(() => {
  loadTemplates()
  loadColumns()
})

// Watch for modal close
watch(() => props.show, (show) => {
  if (!show) {
    resetForm()
  }
}, { immediate: true })
</script>
```

### **12.2 Create QuickExportMenu component**

```vue
<!-- resources/js/Components/DigitalCard/QuickExportMenu.vue -->
<template>
  <Menu as="div" class="relative">
    <MenuButton as="button">
      <slot>
        <SecondaryButton class="flex items-center gap-2">
          <ArrowDownTrayIcon class="w-4 h-4" />
          Quick Export
          <ChevronDownIcon class="w-4 h-4" />
        </SecondaryButton>
      </slot>
    </MenuButton>
    
    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <MenuItems class="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
        <div class="py-1">
          <!-- Quick Export Options -->
          <div class="px-4 py-2">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quick Reports
            </h3>
          </div>
          
          <MenuItem v-slot="{ active }">
            <button
              @click="startQuickExport('active_cards', 'excel')"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <CheckCircleIcon class="w-4 h-4 mr-3 text-green-500" />
              Active Cards (Excel)
            </button>
          </MenuItem>
          
          <MenuItem v-slot="{ active }">
            <button
              @click="startQuickExport('expiring_soon', 'csv')"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <ClockIcon class="w-4 h-4 mr-3 text-yellow-500" />
              Expiring Soon (CSV)
            </button>
          </MenuItem>
          
          <MenuItem v-slot="{ active }">
            <button
              @click="startQuickExport('recent_activity', 'pdf')"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <CalendarIcon class="w-4 h-4 mr-3 text-blue-500" />
              Recent Activity (PDF)
            </button>
          </MenuItem>
          
          <div class="border-t border-gray-100"></div>
          
          <!-- Format Specific -->
          <div class="px-4 py-2">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Export As
            </h3>
          </div>
          
          <MenuItem v-slot="{ active }">
            <button
              @click="openExportModal('csv')"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <TableCellsIcon class="w-4 h-4 mr-3 text-gray-400" />
              CSV Export
            </button>
          </MenuItem>
          
          <MenuItem v-slot="{ active }">
            <button
              @click="openExportModal('excel')"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <DocumentTextIcon class="w-4 h-4 mr-3 text-gray-400" />
              Excel Export
            </button>
          </MenuItem>
          
          <MenuItem v-slot="{ active }">
            <button
              @click="openExportModal('pdf')"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <DocumentArrowDownIcon class="w-4 h-4 mr-3 text-gray-400" />
              PDF Report
            </button>
          </MenuItem>
          
          <MenuItem v-slot="{ active }">
            <button
              @click="openExportModal('json')"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <ChartBarIcon class="w-4 h-4 mr-3 text-gray-400" />
              JSON Data
            </button>
          </MenuItem>
          
          <div class="border-t border-gray-100"></div>
          
          <!-- Other Actions -->
          <MenuItem v-slot="{ active }">
            <button
              @click="viewExports"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <CogIcon class="w-4 h-4 mr-3 text-gray-400" />
              View My Exports
            </button>
          </MenuItem>
        </div>
      </MenuItems>
    </transition>
  </Menu>
  
  <!-- Loading Overlay -->
  <div
    v-if="loading"
    class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded-lg p-6 text-center">
      <ArrowPathIcon class="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
      <p class="text-gray-700">Preparing export...</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import SecondaryButton from '@/Components/SecondaryButton.vue'
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarIcon,
  TableCellsIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  CogIcon,
  ArrowPathIcon,
} from '@heroicons/vue/24/outline'

const emit = defineEmits(['open-export-modal'])

const loading = ref(false)

const startQuickExport = async (type, format) => {
  loading.value = true
  
  try {
    const response = await router.post(route('tenant.digital-cards.exports.quick'), {
      type,
      format,
    }, {
      preserveScroll: true,
      onSuccess: (page) => {
        // Show success message
        alert(`Quick export started! You'll be notified when it's ready. Export ID: ${page.props.export_id}`)
      },
      onError: (errors) => {
        alert(`Failed to start export: ${errors.message || 'Unknown error'}`)
      },
      onFinish: () => {
        loading.value = false
      }
    })
  } catch (error) {
    alert('Failed to start export')
    loading.value = false
    console.error('Quick export failed:', error)
  }
}

const openExportModal = (format) => {
  emit('open-export-modal', format)
}

const viewExports = () => {
  router.get(route('tenant.digital-cards.exports.index'))
}
</script>
```

## **Step 13: Update Main Index.vue to Include Export**

Update the main Digital Cards Index.vue:

```vue
<!-- In resources/js/Pages/Tenant/DigitalCards/Index.vue -->

<!-- Add to the header buttons section -->
<QuickExportMenu @open-export-modal="openExportModal" />

<!-- Add ExportModal component -->
<ExportModal
  :show="showExportModal"
  :current-filters="filters"
  @close="showExportModal = false"
  @started="handleExportStarted"
/>

<!-- Add to script section -->
import QuickExportMenu from '@/Components/DigitalCard/QuickExportMenu.vue'
import ExportModal from './Components/ExportModal.vue'

// Add state
const showExportModal = ref(false)
const exportFormat = ref('excel')

// Add method
const openExportModal = (format = 'excel') => {
  exportFormat.value = format
  showExportModal.value = true
}

const handleExportStarted = (exportData) => {
  showExportModal.value = false
  alert(`Export started! You'll be notified when it's ready. Export ID: ${exportData.export_id}`)
}
```

## **Step 14: Add Routes for Exports**

Update the routes file:

```php
<?php

// Add export routes
Route::middleware(['web', 'auth', 'tenant'])
    ->prefix('{tenant}/admin/digital-cards/exports')
    ->name('tenant.digital-cards.exports.')
    ->group(function () {
        Route::get('/', [DigitalCardController::class, 'listExports'])->name('index');
        Route::get('/columns', [DigitalCardController::class, 'getExportColumns'])->name('columns');
        Route::get('/templates', [DigitalCardController::class, 'getExportTemplates'])->name('templates');
        Route::post('/create', [DigitalCardController::class, 'export'])->name('create');
        Route::post('/quick', [DigitalCardController::class, 'quickExport'])->name('quick');
        Route::get('/{export}', [DigitalCardController::class, 'showExport'])->name('show');
        Route::get('/{export}/download', [DigitalCardController::class, 'downloadExport'])->name('download');
        Route::delete('/{export}', [DigitalCardController::class, 'deleteExport'])->name('delete');
    });

// Add API routes for exports
Route::middleware(['api', 'auth:api', 'tenant'])
    ->prefix('/{tenant}/api/v1')
    ->group(function () {
        Route::post('/cards/export', [DigitalCardController::class, 'export']);
        Route::get('/exports/{export}/status', [DigitalCardController