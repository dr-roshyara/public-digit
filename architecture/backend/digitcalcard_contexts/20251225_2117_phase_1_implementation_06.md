Perfect! Let's implement **Bulk Operations** for digital cards. This will allow admins to issue and revoke multiple cards at once, which is a critical feature for efficient management.

## **Step 1: Design Bulk Operations Schema**

First, let's create migrations for bulk operations tracking:

```bash
php artisan make:migration create_bulk_operations_table
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
        Schema::create('bulk_operations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('type'); // 'issue' or 'revoke'
            $table->json('parameters'); // Operation-specific parameters
            $table->string('status'); // 'pending', 'processing', 'completed', 'failed'
            $table->integer('total_items')->default(0);
            $table->integer('processed_items')->default(0);
            $table->integer('successful_items')->default(0);
            $table->integer('failed_items')->default(0);
            $table->json('results')->nullable(); // Detailed results
            $table->text('error_message')->nullable();
            $table->uuid('initiated_by');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'type', 'created_at']);
            $table->index('initiated_by');
        });

        Schema::create('bulk_operation_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('bulk_operation_id');
            $table->uuid('tenant_id');
            $table->integer('item_index');
            $table->json('input_data');
            $table->string('status'); // 'pending', 'success', 'failed'
            $table->json('output_data')->nullable(); // Result data (e.g., card_id)
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index(['bulk_operation_id', 'status']);
            $table->index(['tenant_id', 'created_at']);
            $table->foreign('bulk_operation_id')->references('id')->on('bulk_operations')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bulk_operation_items');
        Schema::dropIfExists('bulk_operations');
    }
};
```

Run the migration:

```bash
php artisan migrate
```

## **Step 2: Create Domain Models for Bulk Operations**

```bash
php artisan make:class BulkOperation --path=app/Contexts/DigitalCard/Domain/Models
```

```php
<?php

namespace App\Contexts\DigitalCard\Domain\Models;

use App\Contexts\DigitalCard\Domain\ValueObjects\BulkOperationId;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;
use App\Contexts\DigitalCard\Domain\ValueObjects\UserId;

class BulkOperation
{
    public function __construct(
        private BulkOperationId $id,
        private TenantId $tenantId,
        private string $type, // 'issue' or 'revoke'
        private array $parameters,
        private string $status,
        private int $totalItems,
        private int $processedItems = 0,
        private int $successfulItems = 0,
        private int $failedItems = 0,
        private ?array $results = null,
        private ?string $errorMessage = null,
        private UserId $initiatedBy,
        private ?\DateTimeImmutable $startedAt = null,
        private ?\DateTimeImmutable $completedAt = null,
        private ?\DateTimeImmutable $createdAt = null,
        private ?\DateTimeImmutable $updatedAt = null
    ) {}

    // Getters
    public function id(): BulkOperationId { return $this->id; }
    public function tenantId(): TenantId { return $this->tenantId; }
    public function type(): string { return $this->type; }
    public function parameters(): array { return $this->parameters; }
    public function status(): string { return $this->status; }
    public function totalItems(): int { return $this->totalItems; }
    public function processedItems(): int { return $this->processedItems; }
    public function successfulItems(): int { return $this->successfulItems; }
    public function failedItems(): int { return $this->failedItems; }
    public function results(): ?array { return $this->results; }
    public function errorMessage(): ?string { return $this->errorMessage; }
    public function initiatedBy(): UserId { return $this->initiatedBy; }
    public function startedAt(): ?\DateTimeImmutable { return $this->startedAt; }
    public function completedAt(): ?\DateTimeImmutable { return $this->completedAt; }
    public function createdAt(): ?\DateTimeImmutable { return $this->createdAt; }
    public function updatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }

    // Business logic methods
    public function startProcessing(): void
    {
        if ($this->status !== 'pending') {
            throw new \DomainException('Bulk operation can only be started from pending status.');
        }
        
        $this->status = 'processing';
        $this->startedAt = new \DateTimeImmutable();
    }

    public function markItemProcessed(bool $success, ?array $outputData = null, ?string $error = null): void
    {
        if ($this->status !== 'processing') {
            throw new \DomainException('Bulk operation must be processing to mark items.');
        }
        
        $this->processedItems++;
        
        if ($success) {
            $this->successfulItems++;
        } else {
            $this->failedItems++;
        }
        
        // Update progress in results
        $this->results['progress'] = [
            'processed' => $this->processedItems,
            'total' => $this->totalItems,
            'percentage' => $this->totalItems > 0 ? round(($this->processedItems / $this->totalItems) * 100, 2) : 0,
        ];
    }

    public function complete(array $finalResults = []): void
    {
        if ($this->status !== 'processing') {
            throw new \DomainException('Bulk operation must be processing to complete.');
        }
        
        $this->status = 'completed';
        $this->completedAt = new \DateTimeImmutable();
        $this->results = array_merge($this->results ?? [], $finalResults);
    }

    public function fail(string $errorMessage): void
    {
        $this->status = 'failed';
        $this->errorMessage = $errorMessage;
        $this->completedAt = new \DateTimeImmutable();
    }

    public function progressPercentage(): float
    {
        if ($this->totalItems === 0) {
            return 0;
        }
        
        return ($this->processedItems / $this->totalItems) * 100;
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function isProcessing(): bool
    {
        return $this->status === 'processing';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    // Factory methods
    public static function createIssueOperation(
        BulkOperationId $id,
        TenantId $tenantId,
        array $members, // Array of member data
        ?\DateTimeImmutable $expiryDate = null,
        UserId $initiatedBy
    ): self {
        return new self(
            id: $id,
            tenantId: $tenantId,
            type: 'issue',
            parameters: [
                'members' => $members,
                'expiry_date' => $expiryDate?->format('Y-m-d'),
                'default_expiry' => $expiryDate === null,
            ],
            status: 'pending',
            totalItems: count($members),
            initiatedBy: $initiatedBy,
            createdAt: new \DateTimeImmutable(),
        );
    }

    public static function createRevokeOperation(
        BulkOperationId $id,
        TenantId $tenantId,
        array $cardIds,
        string $reason,
        UserId $initiatedBy
    ): self {
        return new self(
            id: $id,
            tenantId: $tenantId,
            type: 'revoke',
            parameters: [
                'card_ids' => $cardIds,
                'reason' => $reason,
            ],
            status: 'pending',
            totalItems: count($cardIds),
            initiatedBy: $initiatedBy,
            createdAt: new \DateTimeImmutable(),
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id->toString(),
            'tenant_id' => $this->tenantId->toString(),
            'type' => $this->type,
            'parameters' => $this->parameters,
            'status' => $this->status,
            'total_items' => $this->totalItems,
            'processed_items' => $this->processedItems,
            'successful_items' => $this->successfulItems,
            'failed_items' => $this->failedItems,
            'results' => $this->results,
            'error_message' => $this->errorMessage,
            'initiated_by' => $this->initiatedBy->toString(),
            'started_at' => $this->startedAt?->format(\DateTimeInterface::ATOM),
            'completed_at' => $this->completedAt?->format(\DateTimeInterface::ATOM),
            'created_at' => $this->createdAt?->format(\DateTimeInterface::ATOM),
            'updated_at' => $this->updatedAt?->format(\DateTimeInterface::ATOM),
            'progress_percentage' => $this->progressPercentage(),
        ];
    }
}
```

Create the value objects:

```bash
php artisan make:class BulkOperationId --path=app/Contexts/DigitalCard/Domain/ValueObjects
```

```php
<?php

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

use Ramsey\Uuid\Uuid;

class BulkOperationId
{
    private string $value;

    public function __construct(string $value)
    {
        if (!Uuid::isValid($value)) {
            throw new \InvalidArgumentException("Invalid bulk operation ID: {$value}");
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

## **Step 3: Create Commands and Handlers for Bulk Operations**

```bash
php artisan make:command BulkIssueCards --path=app/Contexts/DigitalCard/Application/Commands
```

```php
<?php

namespace App\Contexts\DigitalCard\Application\Commands;

use App\Contexts\DigitalCard\Domain\ValueObjects\BulkOperationId;

class BulkIssueCards
{
    public function __construct(
        private BulkOperationId $operationId,
        private array $members, // Each member: ['member_id', 'member_name', 'expiry_date' (optional)]
        private ?\DateTimeImmutable $expiryDate = null,
        private string $initiatedBy
    ) {}

    public function operationId(): BulkOperationId
    {
        return $this->operationId;
    }

    public function members(): array
    {
        return $this->members;
    }

    public function expiryDate(): ?\DateTimeImmutable
    {
        return $this->expiryDate;
    }

    public function initiatedBy(): string
    {
        return $this->initiatedBy;
    }
}
```

```bash
php artisan make:handler BulkIssueCardsHandler --path=app/Contexts/DigitalCard/Application/Handlers
```

```php
<?php

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\BulkIssueCards;
use App\Contexts\DigitalCard\Domain\Models\BulkOperation;
use App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository;
use App\Contexts\DigitalCard\Domain\Contracts\DigitalCardRepository;
use App\Contexts\DigitalCard\Domain\Services\CardIssuancePolicy;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;
use App\Contexts\DigitalCard\Domain\ValueObjects\UserId;
use Illuminate\Contracts\Queue\ShouldQueue;

class BulkIssueCardsHandler implements ShouldQueue
{
    public $queue = 'bulk_operations';
    public $tries = 3;
    public $maxExceptions = 1;
    public $timeout = 300; // 5 minutes

    public function __construct(
        private BulkOperationRepository $bulkOperationRepository,
        private DigitalCardRepository $cardRepository,
        private CardIssuancePolicy $issuancePolicy
    ) {}

    public function handle(BulkIssueCards $command): void
    {
        // Get the bulk operation
        $operation = $this->bulkOperationRepository->findById($command->operationId());
        
        if (!$operation) {
            throw new \RuntimeException("Bulk operation not found: {$command->operationId()->toString()}");
        }

        // Start processing
        $operation->startProcessing();
        $this->bulkOperationRepository->save($operation);

        $results = [
            'successful_cards' => [],
            'failed_cards' => [],
            'errors' => [],
        ];

        // Process each member
        foreach ($command->members() as $index => $memberData) {
            try {
                // Validate member data
                $this->validateMemberData($memberData);
                
                // Create and issue card
                $card = $this->issueCardForMember($memberData, $command->expiryDate());
                
                // Update operation progress
                $operation->markItemProcessed(
                    success: true,
                    outputData: [
                        'card_id' => $card->id()->toString(),
                        'member_id' => $card->memberId()->toString(),
                    ]
                );
                
                $results['successful_cards'][] = [
                    'index' => $index,
                    'member_id' => $memberData['member_id'],
                    'card_id' => $card->id()->toString(),
                ];
                
            } catch (\Exception $e) {
                // Record failure
                $operation->markItemProcessed(
                    success: false,
                    error: $e->getMessage()
                );
                
                $results['failed_cards'][] = [
                    'index' => $index,
                    'member_id' => $memberData['member_id'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ];
                
                $results['errors'][] = [
                    'member' => $memberData['member_id'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ];
                
                // Continue with next member (don't fail entire batch)
                continue;
            }
            
            // Save progress periodically (every 10 items)
            if ($index % 10 === 0) {
                $this->bulkOperationRepository->save($operation);
            }
        }

        // Complete the operation
        $operation->complete($results);
        $this->bulkOperationRepository->save($operation);
    }

    private function validateMemberData(array $memberData): void
    {
        $requiredFields = ['member_id', 'member_name'];
        
        foreach ($requiredFields as $field) {
            if (empty($memberData[$field] ?? '')) {
                throw new \InvalidArgumentException("Missing required field: {$field}");
            }
        }
        
        // Validate member ID format
        if (!preg_match('/^MEM-[A-Z0-9]+$/i', $memberData['member_id'])) {
            throw new \InvalidArgumentException("Invalid member ID format: {$memberData['member_id']}");
        }
        
        // Validate expiry date if provided
        if (isset($memberData['expiry_date'])) {
            $expiryDate = \DateTimeImmutable::createFromFormat('Y-m-d', $memberData['expiry_date']);
            if (!$expiryDate) {
                throw new \InvalidArgumentException("Invalid expiry date format: {$memberData['expiry_date']}");
            }
            
            $minExpiry = (new \DateTimeImmutable())->modify('+1 day');
            $maxExpiry = (new \DateTimeImmutable())->modify('+2 years');
            
            if ($expiryDate < $minExpiry) {
                throw new \InvalidArgumentException("Expiry date must be at least 1 day in the future");
            }
            
            if ($expiryDate > $maxExpiry) {
                throw new \InvalidArgumentException("Expiry date cannot be more than 2 years in the future");
            }
        }
    }

    private function issueCardForMember(array $memberData, ?\DateTimeImmutable $defaultExpiryDate = null)
    {
        // Check if member already has an active card
        $memberId = new \App\Contexts\DigitalCard\Domain\ValueObjects\MemberId($memberData['member_id']);
        $this->issuancePolicy->assertSingleActiveCardPerMember($memberId);
        
        // Determine expiry date
        $expiryDate = isset($memberData['expiry_date'])
            ? new \DateTimeImmutable($memberData['expiry_date'])
            : ($defaultExpiryDate ?? $this->issuancePolicy->calculateDefaultExpiry(new \DateTimeImmutable()));
        
        // Validate expiry date
        $this->issuancePolicy->validateExpiryDate(new \DateTimeImmutable(), $expiryDate);
        
        // Create card (simplified - in real app, use proper card creation service)
        $cardId = \App\Contexts\DigitalCard\Domain\ValueObjects\CardId::generate();
        
        $card = \App\Contexts\DigitalCard\Domain\Entities\DigitalCard::issue(
            cardId: $cardId,
            memberId: $memberId,
            memberName: $memberData['member_name'],
            issuedAt: new \DateTimeImmutable(),
            expiryDate: $expiryDate,
            qrCodeData: "qr-{$cardId->toString()}" // Simplified for example
        );
        
        // Save the card
        $this->cardRepository->save($card);
        
        return $card;
    }

    public function failed(BulkIssueCards $command, \Throwable $exception): void
    {
        // Get the operation
        $operation = $this->bulkOperationRepository->findById($command->operationId());
        
        if ($operation) {
            $operation->fail("Bulk operation failed: " . $exception->getMessage());
            $this->bulkOperationRepository->save($operation);
        }
        
        // Log the failure
        \Log::error('Bulk issue cards failed', [
            'operation_id' => $command->operationId()->toString(),
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
```

Create the BulkRevokeCards command and handler:

```bash
php artisan make:command BulkRevokeCards --path=app/Contexts/DigitalCard/Application/Commands
```

```php
<?php

namespace App\Contexts\DigitalCard\Application\Commands;

use App\Contexts\DigitalCard\Domain\ValueObjects\BulkOperationId;

class BulkRevokeCards
{
    public function __construct(
        private BulkOperationId $operationId,
        private array $cardIds,
        private string $reason,
        private string $initiatedBy
    ) {}

    public function operationId(): BulkOperationId
    {
        return $this->operationId;
    }

    public function cardIds(): array
    {
        return $this->cardIds;
    }

    public function reason(): string
    {
        return $this->reason;
    }

    public function initiatedBy(): string
    {
        return $this->initiatedBy;
    }
}
```

```bash
php artisan make:handler BulkRevokeCardsHandler --path=app/Contexts/DigitalCard/Application/Handlers
```

```php
<?php

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\BulkRevokeCards;
use App\Contexts\DigitalCard\Domain\Models\BulkOperation;
use App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository;
use App\Contexts\DigitalCard\Domain\Contracts\DigitalCardRepository;
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;
use Illuminate\Contracts\Queue\ShouldQueue;

class BulkRevokeCardsHandler implements ShouldQueue
{
    public $queue = 'bulk_operations';
    public $tries = 3;
    public $maxExceptions = 1;
    public $timeout = 300;

    public function __construct(
        private BulkOperationRepository $bulkOperationRepository,
        private DigitalCardRepository $cardRepository
    ) {}

    public function handle(BulkRevokeCards $command): void
    {
        $operation = $this->bulkOperationRepository->findById($command->operationId());
        
        if (!$operation) {
            throw new \RuntimeException("Bulk operation not found: {$command->operationId()->toString()}");
        }

        $operation->startProcessing();
        $this->bulkOperationRepository->save($operation);

        $results = [
            'successful_revocations' => [],
            'failed_revocations' => [],
            'errors' => [],
        ];

        foreach ($command->cardIds() as $index => $cardIdString) {
            try {
                $cardId = new CardId($cardIdString);
                $card = $this->cardRepository->findById($cardId);
                
                if (!$card) {
                    throw new \RuntimeException("Card not found: {$cardIdString}");
                }

                // Revoke the card
                $card->revoke($command->reason(), new \DateTimeImmutable());
                $this->cardRepository->save($card);
                
                $operation->markItemProcessed(
                    success: true,
                    outputData: ['card_id' => $cardIdString]
                );
                
                $results['successful_revocations'][] = [
                    'index' => $index,
                    'card_id' => $cardIdString,
                ];
                
            } catch (\Exception $e) {
                $operation->markItemProcessed(
                    success: false,
                    error: $e->getMessage()
                );
                
                $results['failed_revocations'][] = [
                    'index' => $index,
                    'card_id' => $cardIdString,
                    'error' => $e->getMessage(),
                ];
                
                $results['errors'][] = [
                    'card_id' => $cardIdString,
                    'error' => $e->getMessage(),
                ];
                
                continue;
            }
            
            // Save progress periodically
            if ($index % 10 === 0) {
                $this->bulkOperationRepository->save($operation);
            }
        }

        $operation->complete($results);
        $this->bulkOperationRepository->save($operation);
    }

    public function failed(BulkRevokeCards $command, \Throwable $exception): void
    {
        $operation = $this->bulkOperationRepository->findById($command->operationId());
        
        if ($operation) {
            $operation->fail("Bulk revocation failed: " . $exception->getMessage());
            $this->bulkOperationRepository->save($operation);
        }
        
        \Log::error('Bulk revoke cards failed', [
            'operation_id' => $command->operationId()->toString(),
            'error' => $exception->getMessage(),
        ]);
    }
}
```

## **Step 4: Create Repository Interface and Implementation**

```bash
php artisan make:interface BulkOperationRepository --path=app/Contexts/DigitalCard/Domain/Contracts
```

```php
<?php

namespace App\Contexts\DigitalCard\Domain\Contracts;

use App\Contexts\DigitalCard\Domain\Models\BulkOperation;
use App\Contexts\DigitalCard\Domain\ValueObjects\BulkOperationId;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;

interface BulkOperationRepository
{
    public function findById(BulkOperationId $id): ?BulkOperation;
    
    public function save(BulkOperation $operation): void;
    
    public function findByTenant(TenantId $tenantId, array $filters = [], int $perPage = 20): array;
    
    public function findRecentByTenant(TenantId $tenantId, int $limit = 10): array;
}
```

Create Eloquent implementation:

```bash
php artisan make:class EloquentBulkOperationRepository --path=app/Contexts/DigitalCard/Infrastructure/Persistence/Eloquent
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent;

use App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository;
use App\Contexts\DigitalCard\Domain\Models\BulkOperation;
use App\Contexts\DigitalCard\Domain\ValueObjects\BulkOperationId;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;
use App\Contexts\DigitalCard\Domain\ValueObjects\UserId;
use App\Models\BulkOperation as BulkOperationModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class EloquentBulkOperationRepository implements BulkOperationRepository
{
    public function findById(BulkOperationId $id): ?BulkOperation
    {
        $model = BulkOperationModel::find($id->toString());
        
        if (!$model) {
            return null;
        }
        
        return $this->toEntity($model);
    }
    
    public function save(BulkOperation $operation): void
    {
        BulkOperationModel::updateOrCreate(
            ['id' => $operation->id()->toString()],
            [
                'tenant_id' => $operation->tenantId()->toString(),
                'type' => $operation->type(),
                'parameters' => $operation->parameters(),
                'status' => $operation->status(),
                'total_items' => $operation->totalItems(),
                'processed_items' => $operation->processedItems(),
                'successful_items' => $operation->successfulItems(),
                'failed_items' => $operation->failedItems(),
                'results' => $operation->results(),
                'error_message' => $operation->errorMessage(),
                'initiated_by' => $operation->initiatedBy()->toString(),
                'started_at' => $operation->startedAt(),
                'completed_at' => $operation->completedAt(),
                'created_at' => $operation->createdAt(),
                'updated_at' => $operation->updatedAt(),
            ]
        );
    }
    
    public function findByTenant(TenantId $tenantId, array $filters = [], int $perPage = 20): array
    {
        $query = BulkOperationModel::where('tenant_id', $tenantId->toString());
        
        // Apply filters
        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        
        if (isset($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('parameters', 'like', '%' . $filters['search'] . '%')
                  ->orWhere('error_message', 'like', '%' . $filters['search'] . '%');
            });
        }
        
        // Order by latest
        $query->orderBy('created_at', 'desc');
        
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
    
    public function findRecentByTenant(TenantId $tenantId, int $limit = 10): array
    {
        $models = BulkOperationModel::where('tenant_id', $tenantId->toString())
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
        
        return $models->map(fn($model) => $this->toEntity($model))->all();
    }
    
    private function toEntity(BulkOperationModel $model): BulkOperation
    {
        return new BulkOperation(
            id: new BulkOperationId($model->id),
            tenantId: new TenantId($model->tenant_id),
            type: $model->type,
            parameters: $model->parameters,
            status: $model->status,
            totalItems: $model->total_items,
            processedItems: $model->processed_items,
            successfulItems: $model->successful_items,
            failedItems: $model->failed_items,
            results: $model->results,
            errorMessage: $model->error_message,
            initiatedBy: new UserId($model->initiated_by),
            startedAt: $model->started_at ? new \DateTimeImmutable($model->started_at) : null,
            completedAt: $model->completed_at ? new \DateTimeImmutable($model->completed_at) : null,
            createdAt: $model->created_at ? new \DateTimeImmutable($model->created_at) : null,
            updatedAt: $model->updated_at ? new \DateTimeImmutable($model->updated_at) : null
        );
    }
}
```

Create the Eloquent models:

```bash
php artisan make:model BulkOperation
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BulkOperation extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'id',
        'tenant_id',
        'type',
        'parameters',
        'status',
        'total_items',
        'processed_items',
        'successful_items',
        'failed_items',
        'results',
        'error_message',
        'initiated_by',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'parameters' => 'array',
        'results' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(BulkOperationItem::class);
    }

    public function initiator()
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }
}
```

```bash
php artisan make:model BulkOperationItem
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BulkOperationItem extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'id',
        'bulk_operation_id',
        'tenant_id',
        'item_index',
        'input_data',
        'status',
        'output_data',
        'error_message',
        'metadata',
    ];

    protected $casts = [
        'input_data' => 'array',
        'output_data' => 'array',
        'metadata' => 'array',
    ];

    public function operation()
    {
        return $this->belongsTo(BulkOperation::class);
    }
}
```

## **Step 5: Create Form Requests for Bulk Operations**

```bash
php artisan make:request BulkIssueCardsRequest --path=app/Contexts/DigitalCard/Infrastructure/Http/Requests
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BulkIssueCardsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('bulkIssue', \App\Contexts\DigitalCard\Domain\Entities\DigitalCard::class);
    }

    public function rules(): array
    {
        return [
            'members' => ['required', 'array', 'min:1', 'max:1000'], // Limit batch size
            'members.*.member_id' => ['required', 'string', 'max:50', 'regex:/^MEM-[A-Z0-9]+$/i'],
            'members.*.member_name' => ['required', 'string', 'max:100'],
            'members.*.expiry_date' => ['nullable', 'date', 'after:today', 'before_or_equal:' . now()->addYears(2)->format('Y-m-d')],
            'default_expiry_date' => ['nullable', 'date', 'after:today', 'before_or_equal:' . now()->addYears(2)->format('Y-m-d')],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'members.required' => 'At least one member is required for bulk issuance.',
            'members.max' => 'Cannot issue more than 1000 cards at once.',
            'members.*.member_id.regex' => 'Member ID must be in format: MEM-XXXX',
            'members.*.expiry_date.after' => 'Expiry date must be in the future.',
            'members.*.expiry_date.before_or_equal' => 'Expiry date cannot be more than 2 years in the future.',
        ];
    }
}
```

```bash
php artisan make:request BulkRevokeCardsRequest --path=app/Contexts/DigitalCard/Infrastructure/Http/Requests
```

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BulkRevokeCardsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', \App\Contexts\DigitalCard\Domain\Entities\DigitalCard::class);
    }

    public function rules(): array
    {
        return [
            'card_ids' => ['required', 'array', 'min:1', 'max:1000'],
            'card_ids.*' => ['required', 'string', 'uuid'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'card_ids.required' => 'At least one card ID is required for bulk revocation.',
            'card_ids.max' => 'Cannot revoke more than 1000 cards at once.',
            'card_ids.*.uuid' => 'Invalid card ID format.',
            'reason.min' => 'Revocation reason must be at least 5 characters.',
        ];
    }
}
```

## **Step 6: Update Controller with Bulk Operations Methods**

Update the DigitalCardController:

```php
<?php

namespace App\Contexts\DigitalCard\Infrastructure\Http\Controllers;

// ... existing imports ...
use App\Contexts\DigitalCard\Application\Commands\BulkIssueCards;
use App\Contexts\DigitalCard\Application\Commands\BulkRevokeCards;
use App\Contexts\DigitalCard\Infrastructure\Http\Requests\BulkIssueCardsRequest;
use App\Contexts\DigitalCard\Infrastructure\Http\Requests\BulkRevokeCardsRequest;
use App\Contexts\DigitalCard\Domain\ValueObjects\BulkOperationId;
use App\Contexts\DigitalCard\Domain\ValueObjects\TenantId;
use App\Contexts\DigitalCard\Domain\ValueObjects\UserId;
use App\Events\BulkOperationStarted;
use App\Events\BulkOperationCompleted;

class DigitalCardController extends Controller
{
    // ... existing methods ...

    /**
     * Start bulk card issuance
     */
    public function bulkIssue(BulkIssueCardsRequest $request)
    {
        try {
            // Create bulk operation ID
            $operationId = BulkOperationId::generate();
            
            // Prepare expiry date
            $expiryDate = $request->input('default_expiry_date')
                ? new \DateTimeImmutable($request->input('default_expiry_date'))
                : null;
            
            // Create command
            $command = new BulkIssueCards(
                operationId: $operationId,
                members: $request->input('members'),
                expiryDate: $expiryDate,
                initiatedBy: $request->user()->id
            );
            
            // Dispatch to queue
            $this->commandBus->dispatch($command);
            
            // Create bulk operation record
            $operation = \App\Contexts\DigitalCard\Domain\Models\BulkOperation::createIssueOperation(
                id: $operationId,
                tenantId: new TenantId(tenancy()->getCurrentTenant()->id),
                members: $request->input('members'),
                expiryDate: $expiryDate,
                initiatedBy: new UserId($request->user()->id)
            );
            
            // Save operation
            $bulkOperationRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository::class);
            $bulkOperationRepository->save($operation);
            
            // Dispatch WebSocket event
            event(new BulkOperationStarted($operation->toArray()));
            
            if ($request->wantsJson()) {
                return response()->json([
                    'message' => 'Bulk card issuance started successfully.',
                    'operation_id' => $operationId->toString(),
                    'status' => 'pending',
                    'total_items' => count($request->input('members')),
                ], 202);
            }
            
            return redirect()
                ->route('tenant.digital-cards.bulk-operations.show', $operationId->toString())
                ->with('success', 'Bulk card issuance started successfully.');
                
        } catch (\Exception $e) {
            \Log::error('Bulk issue failed:', ['error' => $e->getMessage()]);
            
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
     * Start bulk card revocation
     */
    public function bulkRevoke(BulkRevokeCardsRequest $request)
    {
        try {
            $operationId = BulkOperationId::generate();
            
            $command = new BulkRevokeCards(
                operationId: $operationId,
                cardIds: $request->input('card_ids'),
                reason: $request->input('reason'),
                initiatedBy: $request->user()->id
            );
            
            // Dispatch to queue
            $this->commandBus->dispatch($command);
            
            // Create bulk operation record
            $operation = \App\Contexts\DigitalCard\Domain\Models\BulkOperation::createRevokeOperation(
                id: $operationId,
                tenantId: new TenantId(tenancy()->getCurrentTenant()->id),
                cardIds: $request->input('card_ids'),
                reason: $request->input('reason'),
                initiatedBy: new UserId($request->user()->id)
            );
            
            // Save operation
            $bulkOperationRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository::class);
            $bulkOperationRepository->save($operation);
            
            // Dispatch WebSocket event
            event(new BulkOperationStarted($operation->toArray()));
            
            if ($request->wantsJson()) {
                return response()->json([
                    'message' => 'Bulk card revocation started successfully.',
                    'operation_id' => $operationId->toString(),
                    'status' => 'pending',
                    'total_items' => count($request->input('card_ids')),
                ], 202);
            }
            
            return redirect()
                ->route('tenant.digital-cards.bulk-operations.show', $operationId->toString())
                ->with('success', 'Bulk card revocation started successfully.');
                
        } catch (\Exception $e) {
            \Log::error('Bulk revoke failed:', ['error' => $e->getMessage()]);
            
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
     * Get bulk operation status
     */
    public function getBulkOperationStatus(string $tenant, string $operationId)
    {
        try {
            $bulkOperationRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository::class);
            $operation = $bulkOperationRepository->findById(new BulkOperationId($operationId));
            
            if (!$operation) {
                return response()->json(['message' => 'Bulk operation not found.'], 404);
            }
            
            // Check authorization (user must be initiator or platform admin)
            if ($operation->initiatedBy()->toString() !== auth()->id() && !auth()->user()->isPlatformAdmin()) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
            
            return response()->json($operation->toArray());
            
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * List bulk operations
     */
    public function listBulkOperations(Request $request)
    {
        $this->authorize('viewAny', \App\Contexts\DigitalCard\Domain\Entities\DigitalCard::class);
        
        try {
            $bulkOperationRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository::class);
            
            $filters = $request->only(['type', 'status', 'search']);
            $perPage = $request->input('per_page', 20);
            
            $operations = $bulkOperationRepository->findByTenant(
                new TenantId(tenancy()->getCurrentTenant()->id),
                $filters,
                $perPage
            );
            
            if ($request->wantsJson()) {
                return response()->json($operations);
            }
            
            return Inertia::render('Tenant/DigitalCards/BulkOperations/Index', [
                'operations' => $operations['data'],
                'filters' => $filters,
                'meta' => $operations['meta'],
            ]);
            
        } catch (\Exception $e) {
            \Log::error('List bulk operations failed:', ['error' => $e->getMessage()]);
            
            if ($request->wantsJson()) {
                return response()->json(['message' => $e->getMessage()], 500);
            }
            
            return redirect()
                ->back()
                ->withErrors(['error' => $e->getMessage()]);
        }
    }

    /**
     * Show bulk operation details
     */
    public function showBulkOperation(string $tenant, string $operationId)
    {
        try {
            $bulkOperationRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository::class);
            $operation = $bulkOperationRepository->findById(new BulkOperationId($operationId));
            
            if (!$operation) {
                abort(404);
            }
            
            // Check authorization
            if ($operation->initiatedBy()->toString() !== auth()->id() && !auth()->user()->isPlatformAdmin()) {
                abort(403);
            }
            
            // Get operation items
            $items = \App\Models\BulkOperationItem::where('bulk_operation_id', $operationId)
                ->orderBy('item_index')
                ->get();
            
            return Inertia::render('Tenant/DigitalCards/BulkOperations/Show', [
                'operation' => $operation->toArray(),
                'items' => $items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'item_index' => $item->item_index,
                        'input_data' => $item->input_data,
                        'status' => $item->status,
                        'output_data' => $item->output_data,
                        'error_message' => $item->error_message,
                        'created_at' => $item->created_at->toISOString(),
                    ];
                }),
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Show bulk operation failed:', ['error' => $e->getMessage()]);
            abort(500);
        }
    }

    /**
     * Cancel bulk operation
     */
    public function cancelBulkOperation(string $tenant, string $operationId)
    {
        try {
            $bulkOperationRepository = app(\App\Contexts\DigitalCard\Domain\Contracts\BulkOperationRepository::class);
            $operation = $bulkOperationRepository->findById(new BulkOperationId($operationId));
            
            if (!$operation) {
                return response()->json(['message' => 'Bulk operation not found.'], 404);
            }
            
            // Check authorization
            if ($operation->initiatedBy()->toString() !== auth()->id() && !auth()->user()->isPlatformAdmin()) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
            
            // Can only cancel pending operations
            if (!$operation->isPending()) {
                return response()->json(['message' => 'Only pending operations can be cancelled.'], 422);
            }
            
            // Mark as cancelled
            $operation->fail('Operation cancelled by user.');
            $bulkOperationRepository->save($operation);
            
            // TODO: Actually cancel the queued job
            
            return response()->json([
                'message' => 'Bulk operation cancelled successfully.',
                'operation' => $operation->toArray(),
            ]);
            
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }
}
```

## **Step 7: Create WebSocket Events for Bulk Operations**

```bash
php artisan make:event BulkOperationStarted --event
php artisan make:event BulkOperationProgressUpdated --event
php artisan make:event BulkOperationCompleted --event
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

class BulkOperationStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $operation;

    public function __construct($operation)
    {
        $this->operation = $operation;
    }

    public function broadcastOn()
    {
        // Broadcast to user-specific channel and tenant channel
        return [
            new PrivateChannel("user.{$this->operation['initiated_by']}.bulk-operations"),
            new PrivateChannel("tenant.{$this->operation['tenant_id']}.digital-cards"),
        ];
    }

    public function broadcastAs()
    {
        return 'bulk.operation.started';
    }

    public function broadcastWith()
    {
        return [
            'operation' => $this->operation,
            'timestamp' => now()->toISOString(),
            'message' => "Bulk {$this->operation['type']} operation started for {$this->operation['total_items']} items",
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

class BulkOperationProgressUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $operationId;
    public $progress;
    public $userId;
    public $tenantId;

    public function __construct($operationId, $progress, $userId, $tenantId)
    {
        $this->operationId = $operationId;
        $this->progress = $progress;
        $this->userId = $userId;
        $this->tenantId = $tenantId;
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel("user.{$this->userId}.bulk-operations"),
            new PrivateChannel("tenant.{$this->tenantId}.digital-cards"),
        ];
    }

    public function broadcastAs()
    {
        return 'bulk.operation.progress';
    }

    public function broadcastWith()
    {
        return [
            'operation_id' => $this->operationId,
            'progress' => $this->progress,
            'timestamp' => now()->toISOString(),
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

class BulkOperationCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $operation;

    public function __construct($operation)
    {
        $this->operation = $operation;
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel("user.{$this->operation['initiated_by']}.bulk-operations"),
            new PrivateChannel("tenant.{$this->operation['tenant_id']}.digital-cards"),
        ];
    }

    public function broadcastAs()
    {
        return 'bulk.operation.completed';
    }

    public function broadcastWith()
    {
        return [
            'operation' => $this->operation,
            'timestamp' => now()->toISOString(),
            'message' => "Bulk {$this->operation['type']} operation completed: {$this->operation['successful_items']} successful, {$this->operation['failed_items']} failed",
        ];
    }
}
```

Update the handlers to dispatch progress events:

```php
<?php
// In BulkIssueCardsHandler and BulkRevokeCardsHandler

// Add after processing each batch (every 10 items)
if ($index % 10 === 0) {
    $this->bulkOperationRepository->save($operation);
    
    // Dispatch progress update
    event(new BulkOperationProgressUpdated(
        operationId: $operation->id()->toString(),
        progress: $operation->progressPercentage(),
        userId: $operation->initiatedBy()->toString(),
        tenantId: $operation->tenantId()->toString()
    ));
}
```

## **Step 8: Create Vue Components for Bulk Operations**

### **8.1 Create BulkIssueModal component**

```vue
<!-- resources/js/Pages/Tenant/DigitalCards/Components/BulkIssueModal.vue -->
<template>
  <Modal :show="show" max-width="4xl" @close="$emit('close')">
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-medium text-gray-900">
            Bulk Issue Digital Cards
          </h3>
          <p class="text-sm text-gray-500">
            Issue multiple cards at once by uploading a CSV or entering data manually
          </p>
        </div>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon class="w-6 h-6" />
        </button>
      </div>
      
      <!-- Steps -->
      <div class="mb-8">
        <nav class="flex items-center justify-center" aria-label="Progress">
          <ol class="flex items-center space-x-8">
            <li v-for="(step, index) in steps" :key="step.name">
              <div class="flex items-center">
                <!-- Step circle -->
                <span
                  :class="[
                    'flex items-center justify-center w-8 h-8 border-2 rounded-full',
                    step.status === 'current' ? 'border-blue-600' : '',
                    step.status === 'completed' ? 'border-green-600 bg-green-600' : '',
                    step.status === 'upcoming' ? 'border-gray-300' : '',
                  ]"
                >
                  <span
                    v-if="step.status === 'completed'"
                    class="text-white"
                  >
                    <CheckIcon class="w-5 h-5" />
                  </span>
                  <span
                    v-else
                    :class="[
                      step.status === 'current' ? 'text-blue-600' : 'text-gray-500',
                    ]"
                  >
                    {{ index + 1 }}
                  </span>
                </span>
                
                <!-- Step name -->
                <span
                  :class="[
                    'ml-3 text-sm font-medium',
                    step.status === 'current' ? 'text-blue-600' : '',
                    step.status === 'completed' ? 'text-green-600' : '',
                    step.status === 'upcoming' ? 'text-gray-500' : '',
                  ]"
                >
                  {{ step.name }}
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>
      
      <!-- Step 1: Upload/Input Method -->
      <div v-if="currentStep === 1" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- CSV Upload -->
          <div
            @click="selectMethod('csv')"
            :class="[
              'border-2 rounded-lg p-6 cursor-pointer transition-colors',
              inputMethod === 'csv' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
            ]"
          >
            <div class="flex items-center justify-between mb-4">
              <DocumentArrowUpIcon class="w-8 h-8 text-gray-400" />
              <RadioGroupOption
                :value="'csv'"
                v-slot="{ checked }"
                as="template"
              >
                <div
                  :class="[
                    checked ? 'bg-blue-600 border-transparent' : 'bg-white border-gray-300',
                    'relative flex h-4 w-4 items-center justify-center rounded-full border',
                  ]"
                >
                  <span class="sr-only">CSV Upload</span>
                  <span
                    v-if="checked"
                    class="h-1.5 w-1.5 rounded-full bg-white"
                  />
                </div>
              </RadioGroupOption>
            </div>
            <h4 class="text-lg font-medium text-gray-900 mb-2">Upload CSV</h4>
            <p class="text-sm text-gray-600">
              Upload a CSV file with member details. Download template for correct format.
            </p>
            <div class="mt-4">
              <button
                @click="downloadTemplate"
                class="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Download CSV Template
              </button>
            </div>
          </div>
          
          <!-- Manual Input -->
          <div
            @click="selectMethod('manual')"
            :class="[
              'border-2 rounded-lg p-6 cursor-pointer transition-colors',
              inputMethod === 'manual' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
            ]"
          >
            <div class="flex items-center justify-between mb-4">
              <PencilIcon class="w-8 h-8 text-gray-400" />
              <RadioGroupOption
                :value="'manual'"
                v-slot="{ checked }"
                as="template"
              >
                <div
                  :class="[
                    checked ? 'bg-blue-600 border-transparent' : 'bg-white border-gray-300',
                    'relative flex h-4 w-4 items-center justify-center rounded-full border',
                  ]"
                >
                  <span class="sr-only">Manual Input</span>
                  <span
                    v-if="checked"
                    class="h-1.5 w-1.5 rounded-full bg-white"
                  />
                </div>
              </RadioGroupOption>
            </div>
            <h4 class="text-lg font-medium text-gray-900 mb-2">Manual Entry</h4>
            <p class="text-sm text-gray-600">
              Enter member details manually or paste from spreadsheet.
            </p>
          </div>
        </div>
        
        <!-- CSV Upload Section -->
        <div v-if="inputMethod === 'csv'" class="mt-6">
          <div
            @dragover.prevent="dragover = true"
            @dragleave.prevent="dragover = false"
            @drop.prevent="handleFileDrop"
            :class="[
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragover ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
              fileError ? 'border-red-300 bg-red-50' : '',
            ]"
          >
            <input
              type="file"
              ref="fileInput"
              @change="handleFileSelect"
              accept=".csv,.txt"
              class="hidden"
            />
            
            <DocumentArrowUpIcon class="w-12 h-12 mx-auto text-gray-400 mb-4" />
            
            <p class="text-sm text-gray-600 mb-2">
              <button
                @click="openFilePicker"
                class="font-medium text-blue-600 hover:text-blue-800"
              >
                Click to upload
              </button>
              or drag and drop
            </p>
            <p class="text-xs text-gray-500">
              CSV files only (max 10MB)
            </p>
            
            <!-- Selected File -->
            <div v-if="selectedFile" class="mt-4 p-3 bg-gray-50 rounded-md">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <DocumentIcon class="w-5 h-5 text-gray-400 mr-2" />
                  <div>
                    <p class="text-sm font-medium text-gray-900">{{ selectedFile.name }}</p>
                    <p class="text-xs text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
                  </div>
                </div>
                <button
                  @click="removeFile"
                  class="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon class="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <!-- File Error -->
            <div v-if="fileError" class="mt-4 p-3 bg-red-100 border border-red-200 rounded-md">
              <div class="flex">
                <ExclamationTriangleIcon class="w-5 h-5 text-red-400 mr-2" />
                <p class="text-sm text-red-700">{{ fileError }}</p>
              </div>
            </div>
          </div>
          
          <!-- CSV Preview -->
          <div v-if="csvPreview.length > 0" class="mt-6">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Preview (first 5 rows)</h4>
            <div class="overflow-x-auto border border-gray-200 rounded-lg">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th
                      v-for="header in csvHeaders"
                      :key="header"
                      class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {{ header }}
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr
                    v-for="(row, index) in csvPreview"
                    :key="index"
                  >
                    <td
                      v-for="header in csvHeaders"
                      :key="header"
                      class="px-3 py-2 text-sm text-gray-900"
                    >
                      {{ row[header] || '' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-2 text-xs text-gray-500">
              Total rows: {{ csvData.length }}
            </p>
          </div>
        </div>
        
        <!-- Manual Input Section -->
        <div v-if="inputMethod === 'manual'" class="mt-6">
          <div class="space-y-4">
            <!-- Instructions -->
            <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div class="flex">
                <InformationCircleIcon class="w-5 h-5 text-blue-400 mr-2" />
                <div class="text-sm text-blue-800">
                  <p class="font-medium">Format Instructions:</p>
                  <p class="mt-1">Enter one member per line in format: <code class="bg-white px-1 rounded">member_id,member_name,expiry_date(optional)</code></p>
                  <p class="mt-1">Example: <code class="bg-white px-1 rounded">MEM-001,John Doe,2025-12-31</code></p>
                </div>
              </div>
            </div>
            
            <!-- Text Area -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Member Data
              </label>
              <textarea
                v-model="manualInput"
                rows="10"
                placeholder="MEM-001,John Doe,2025-12-31&#10;MEM-002,Jane Smith&#10;MEM-003,Bob Wilson,2026-06-30"
                class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                @input="parseManualInput"
              ></textarea>
              <p class="mt-1 text-xs text-gray-500">
                {{ manualInputLines }} lines, {{ parsedMembers.length }} valid members parsed
              </p>
            </div>
            
            <!-- Preview -->
            <div v-if="parsedMembers.length > 0">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Preview</h4>
              <div class="overflow-x-auto border border-gray-200 rounded-lg">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Member ID
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expiry Date
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr
                      v-for="(member, index) in parsedMembers.slice(0, 5)"
                      :key="index"
                    >
                      <td class="px-3 py-2 text-sm text-gray-900">{{ member.member_id }}</td>
                      <td class="px-3 py-2 text-sm text-gray-900">{{ member.member_name }}</td>
                      <td class="px-3 py-2 text-sm text-gray-900">{{ member.expiry_date || 'Default' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="parsedMembers.length > 5" class="mt-2 text-xs text-gray-500">
                Showing first 5 of {{ parsedMembers.length }} members
              </p>
            </div>
            
            <!-- Parse Errors -->
            <div v-if="parseErrors.length > 0" class="bg-red-50 border border-red-200 rounded-md p-4">
              <div class="flex">
                <ExclamationTriangleIcon class="w-5 h-5 text-red-400 mr-2" />
                <div>
                  <p class="text-sm font-medium text-red-800">Parse Errors ({{ parseErrors.length }})</p>
                  <ul class="mt-1 text-xs text-red-700 list-disc list-inside">
                    <li v-for="(error, index) in parseErrors.slice(0, 5)" :key="index">
                      Line {{ error.line }}: {{ error.error }}
                    </li>
                  </ul>
                  <p v-if="parseErrors.length > 5" class="mt-1 text-xs text-red-700">
                    ... and {{ parseErrors.length - 5 }} more errors
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="mt-8 flex justify-between">
          <SecondaryButton @click="$emit('close')">
            Cancel
          </SecondaryButton>
          <PrimaryButton
            @click="nextStep"
            :disabled="!canProceed"
          >
            Next: Configure Settings
            <ArrowRightIcon class="w-4 h-4 ml-2" />
          </PrimaryButton>
        </div>
      </div>
      
      <!-- Step 2: Configuration -->
      <div v-if="currentStep === 2" class="space-y-6">
        <!-- Expiry Date Configuration -->
        <div>
          <h4 class="text-sm font-medium text-gray-900 mb-4">Expiry Date Settings</h4>
          <div class="space-y-4">
            <!-- Default Expiry -->
            <div class="flex items-center space-x-3">
              <input
                v-model="expiryOption"
                type="radio"
                id="defaultExpiry"
                value="default"
                class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <div>
                <label for="defaultExpiry" class="text-sm font-medium text-gray-700">
                  Use default expiry (1 year from today)
                </label>
                <p class="text-xs text-gray-500">
                  All cards will expire on {{ defaultExpiryDate }}
                </p>
              </div>
            </div>
            
            <!-- Custom Expiry -->
            <div class="flex items-center space-x-3">
              <input
                v-model="expiryOption"
                type="radio"
                id="customExpiry"
                value="custom"
                class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <div>
                <label for="customExpiry" class="text-sm font-medium text-gray-700">
                  Set custom expiry date for all cards
                </label>
                <div class="mt-2">
                  <input
                    v-model="customExpiryDate"
                    type="date"
                    :min="minExpiryDate"
                    :max="maxExpiryDate"
                    :disabled="expiryOption !== 'custom'"
                    class="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p class="mt-1 text-xs text-gray-500">
                    Must be between {{ minExpiryDate }} and {{ maxExpiryDate }}
                  </p>
                </div>
              </div>
            </div>
            
            <!-- Keep CSV Expiry -->
            <div v-if="hasExpiryDatesInData" class="flex items-center space-x-3">
              <input
                v-model="expiryOption"
                type="radio"
                id="keepExpiry"
                value="keep"
                class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <div>
                <label for="keepExpiry" class="text-sm font-medium text-gray-700">
                  Use expiry dates from data (if provided)
                </label>
                <p class="text-xs text-gray-500">
                  Members with expiry dates in data will use those, others get default
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Summary -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Operation Summary</h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-600">Total Members:</p>
              <p class="font-medium text-gray-900">{{ members.length }}</p>
            </div>
            <div>
              <p class="text-gray-600">Expiry Setting:</p>
              <p class="font-medium text-gray-900">{{ expiryOptionLabel }}</p>
            </div>
            <div>
              <p class="text-gray-600">With Expiry Dates:</p>
              <p class="font-medium text-gray-900">{{ membersWithExpiryDates }}</p>
            </div>
            <div>
              <p class="text-gray-600">Estimated Time:</p>
              <p class="font-medium text-gray-900">{{ estimatedTime }}</p>
            </div>
          </div>
        </div>
        
        <!-- Notes -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            v-model="notes"
            rows="3"
            placeholder="Add any notes about this bulk operation..."
            class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <!-- Action Buttons -->
        <div class="mt-8 flex justify-between">
          <SecondaryButton @click="prevStep">
            <ArrowLeftIcon class="w-4 h-4 mr-2" />
            Back
          </SecondaryButton>
          <PrimaryButton
            @click="submitBulkIssue"
            :disabled="!canSubmit || loading"
            class="flex items-center"
          >
            <ArrowPathIcon v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
            <CheckIcon v-else class="w-4 h-4 mr-2" />
            {{ loading ? 'Starting...' : 'Start Bulk Issuance' }}
          </PrimaryButton>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { RadioGroup, RadioGroupOption } from '@headlessui/vue'
import Modal from '@/Components/Modal.vue'
import PrimaryButton from '@/Components/PrimaryButton.vue'
import SecondaryButton from '@/Components/SecondaryButton.vue'
import {
  XMarkIcon,
  CheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  PencilIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/vue/24/outline'
import Papa from 'papaparse'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'started'])

// Step management
const currentStep = ref(1)
const steps = computed(() => [
  { name: 'Upload Data', status: currentStep.value === 1 ? 'current' : (currentStep.value > 1 ? 'completed' : 'upcoming') },
  { name: 'Configure', status: currentStep.value === 2 ? 'current' : (currentStep.value > 2 ? 'completed' : 'upcoming') },
])

// Input method
const inputMethod = ref('csv') // 'csv' or 'manual'

// CSV upload state
const dragover = ref(false)
const selectedFile = ref(null)
const fileError = ref('')
const csvData = ref([])
const csvHeaders = ref([])
const csvPreview = computed(() => csvData.value.slice(0, 5))

// Manual input state
const manualInput = ref('')
const manualInputLines = computed(() => manualInput.value.split('\n').length)
const parsedMembers = ref([])
const parseErrors = ref([])

// Configuration
const expiryOption = ref('default') // 'default', 'custom', 'keep'
const customExpiryDate = ref('')
const notes = ref('')

// Members data (final processed list)
const members = ref([])

// Loading state
const loading = ref(false)

// Computed
const canProceed = computed(() => {
  if (currentStep.value === 1) {
    if (inputMethod.value === 'csv') {
      return csvData.value.length > 0
    } else if (inputMethod.value === 'manual') {
      return parsedMembers.value.length > 0
    }
  }
  return false
})

const canSubmit = computed(() => {
  return members.value.length > 0 && members.value.length <= 1000
})

const defaultExpiryDate = computed(() => {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  return date.toISOString().split('T')[0]
})

const minExpiryDate = computed(() => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().split('T')[0]
})

const maxExpiryDate = computed(() => {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 2)
  return date.toISOString().split('T')[0]
})

const hasExpiryDatesInData = computed(() => {
  return members.value.some(member => member.expiry_date)
})

const membersWithExpiryDates = computed(() => {
  return members.value.filter(member => member.expiry_date).length
})

const expiryOptionLabel = computed(() => {
  switch (expiryOption.value) {
    case 'default':
      return 'Default (1 year)'
    case 'custom':
      return `Custom: ${customExpiryDate.value}`
    case 'keep':
      return 'From data'
    default:
      return 'Default'
  }
})

const estimatedTime = computed(() => {
  const count = members.value.length
  if (count <= 10) return '< 1 minute'
  if (count <= 100) return '1-2 minutes'
  if (count <= 500) return '2-5 minutes'
  if (count <= 1000) return '5-10 minutes'
  return '10+ minutes'
})

// Methods
const selectMethod = (method) => {
  inputMethod.value = method
  if (method === 'manual') {
    // Clear CSV data
    csvData.value = []
    selectedFile.value = null
  } else {
    // Clear manual data
    manualInput.value = ''
    parsedMembers.value = []
  }
}

const openFilePicker = () => {
  document.getElementById('fileInput')?.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    processFile(file)
  }
}

const handleFileDrop = (event) => {
  dragover.value = false
  const file = event.dataTransfer.files[0]
  if (file) {
    processFile(file)
  }
}

const processFile = (file) => {
  // Validate file
  if (!file.name.toLowerCase().endsWith('.csv')) {
    fileError.value = 'Please upload a CSV file'
    return
  }
  
  if (file.size > 10 * 1024 * 1024) { // 10MB
    fileError.value = 'File size must be less than 10MB'
    return
  }
  
  selectedFile.value = file
  fileError.value = ''
  
  // Parse CSV
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.errors.length > 0) {
        fileError.value = 'Error parsing CSV: ' + results.errors[0].message
        return
      }
      
      if (results.data.length === 0) {
        fileError.value = 'CSV file is empty'
        return
      }
      
      // Validate required columns
      const headers = results.meta.fields || []
      const required = ['member_id', 'member_name']
      const missing = required.filter(field => !headers.includes(field))
      
      if (missing.length > 0) {
        fileError.value = `Missing required columns: ${missing.join(', ')}`
        return
      }
      
      // Process data
      const processedData = results.data.map((row, index) => {
        const member = {
          member_id: String(row.member_id || '').trim(),
          member_name: String(row.member_name || '').trim(),
        }
        
        // Optional expiry date
        if (row.expiry_date) {
          const date = new Date(String(row.expiry_date).trim())
          if (!isNaN(date.getTime())) {
            member.expiry_date = date.toISOString().split('T')[0]
          }
        }
        
        return member
      }).filter(member => member.member_id && member.member_name)
      
      if (processedData.length === 0) {
        fileError.value = 'No valid member data found in CSV'
        return
      }
      
      csvData.value = processedData
      csvHeaders.value = headers
      
      // Prepare members for next step
      members.value = processedData
    },
    error: (error) => {
      fileError.value = 'Error reading file: ' + error.message
    }
  })
}

const removeFile = () => {
  selectedFile.value = null
  csvData.value = []
  fileError.value = ''
}

const downloadTemplate = () => {
  const template = `member_id,member_name,expiry_date
MEM-001,John Doe,2025-12-31
MEM-002,Jane Smith,
MEM-003,Bob Wilson,2026-06-30`

  const blob = new Blob([template], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'digital-cards-bulk-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const parseManualInput = () => {
  const lines = manualInput.value.split('\n').filter(line => line.trim())
  parsedMembers.value = []
  parseErrors.value = []
  
  lines.forEach((line, index) => {
    const parts = line.split(',').map(part => part.trim())
    
    if (parts.length < 2) {
      parseErrors.value.push({
        line: index + 1,
        error: 'Line must have at least member_id and member_name'
      })
      return
    }
    
    const member = {
      member_id: parts[0],
      member_name: parts[1],
    }
    
    // Optional expiry date
    if (parts.length >= 3 && parts[2]) {
      const date = new Date(parts[2])
      if (!isNaN(date.getTime())) {
        member.expiry_date = date.toISOString().split('T')[0]
      } else {
        parseErrors.value.push({
          line: index + 1,
          error: 'Invalid date format (use YYYY-MM-DD)'
        })
      }
    }
    
    // Validate member ID format
    if (!/^MEM-[A-Z0-9]+$/i.test(member.member_id)) {
      parseErrors.value.push({
        line: index + 1,
        error: 'Member ID must be in format: MEM-XXXX'
      })
      return
    }
    
    parsedMembers.value.push(member)
  })
  
  // Prepare members for next step
  members.value = parsedMembers.value
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const nextStep = () => {
  if (currentStep.value === 1 && canProceed.value) {
    currentStep.value = 2
    
    // Apply expiry option
    if (expiryOption.value === 'default') {
      members.value = members.value.map(member => ({
        ...member,
        expiry_date: defaultExpiryDate.value
      }))
    } else if (expiryOption.value === 'custom' && customExpiryDate.value) {
      members.value = members.value.map(member => ({
        ...member,
        expiry_date: customExpiryDate.value
      }))
    }
    // If 'keep', keep existing expiry dates
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const submitBulkIssue = async () => {
  if (!canSubmit.value || loading.value) return
  
  loading.value = true
  
  try {
    const payload = {
      members: members.value,
      notes: notes.value,
    }
    
    // Add default expiry date if using that option
    if (expiryOption.value === 'default') {
      payload.default_expiry_date = defaultExpiryDate.value
    } else if (expiryOption.value === 'custom' && customExpiryDate.value) {
      payload.default_expiry_date = customExpiryDate.value
    }
    
    const response = await router.post(route('tenant.digital-cards.bulk-issue'), payload, {
      preserveScroll: true,
      onSuccess: (page) => {
        emit('started', page.props.operation || {})
        resetForm()
      },
      onError: (errors) => {
        console.error('Bulk issue failed:', errors)
      },
      onFinish: () => {
        loading.value = false
      }
    })
    
  } catch (error) {
    console.error('Bulk issue failed:', error)
    loading.value = false
  }
}

const resetForm = () => {
  currentStep.value = 1
  inputMethod.value = 'csv'
  selectedFile.value = null
  fileError.value = ''
  csvData.value = []
  manualInput.value = ''
  parsedMembers.value = []
  parseErrors.value = []
  expiryOption.value = 'default'
  customExpiryDate.value = ''
  notes.value = ''
  members.value = []
}

// Watch for modal close
watch(() => props.show, (show) => {
  if (!show) {
    resetForm()
  }
}, { immediate: true })
</script>
```

### **8.2 Create BulkRevokeModal component**

```vue
<!-- resources/js/Pages/Tenant/DigitalCards/Components/BulkRevokeModal.vue -->
<template>
  <Modal :show="show" max-width="2xl" @close="$emit('close')">
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-medium text-gray-900">
            Bulk Revoke Digital Cards
          </h3>
          <p class="text-sm text-gray-500">
            Revoke multiple cards at once
          </p>
        </div>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon class="w-6 h-6" />
        </button>
      </div>
      
      <form @submit.prevent="submitBulkRevoke" class="space-y-6">
        <!-- Card Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Select Cards to Revoke
          </label>
          
          <!-- Selection Methods -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <button
              type="button"
              @click="selectionMethod = 'current'"
              :class="[
                'border-2 rounded-lg p-4 text-left transition-colors',
                selectionMethod === 'current' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
              ]"
            >
              <div class="flex items-center mb-2">
                <CheckCircleIcon class="w-5 h-5 text-gray-400 mr-2" />
                <span class="text-sm font-medium text-gray-900">Current Selection</span>
              </div>
              <p class="text-xs text-gray-600">
                Use {{ selectedCardsCount }} cards currently selected in the table
              </p>
            </button>
            
            <button
              type="button"
              @click="selectionMethod = 'manual'"
              :class="[
                'border-2 rounded-lg p-4 text-left transition-colors',
                selectionMethod === 'manual' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
              ]"
            >
              <div class="flex items-center mb-2">
                <PencilIcon class="w-5 h-5 text-gray-400 mr-2" />
                <span class="text-sm font-medium text-gray-900">Manual Entry</span>
              </div>
              <p class="text-xs text-gray-600">
                Enter or paste card IDs manually
              </p>
            </button>
          </div>
          
          <!-- Current Selection Info -->
          <div v-if="selectionMethod === 'current' && selectedCardsCount > 0" class="bg-gray-50 border border-gray-200 rounded-md p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-900">{{ selectedCardsCount }} cards selected</p>
                <p class="text-xs text-gray-600 mt-1">
                  {{ activeCardsCount }} active, {{ issuedCardsCount }} issued
                </p>
              </div>
              <button
                type="button"
                @click="viewSelectedCards"
                class="text-sm text-blue-600 hover:text-blue-800"
              >
                View List
              </button>
            </div>
          </div>
          
          <!-- Manual Input -->
          <div v-if="selectionMethod === 'manual'">
            <textarea
              v-model="manualCardIds"
              rows="6"
              placeholder="Enter card IDs, one per line&#10;Example:&#10;550e8400-e29b-41d4-a716-446655440000&#10;6ba7b810-9dad-11d1-80b4-00c04fd430c8"
              class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
              @input="parseManualCardIds"
            ></textarea>
            <p class="mt-1 text-xs text-gray-500">
              {{ manualCardIdsLines }} lines, {{ parsedCardIds.length }} valid card IDs
            </p>
            
            <!-- Parse Errors -->
            <div v-if="manualParseErrors.length > 0" class="mt-2 bg-red-50 border border-red-200 rounded-md p-3">
              <div class="flex">
                <ExclamationTriangleIcon class="w-4 h-4 text-red-400 mr-2" />
                <div>
                  <p class="text-xs font-medium text-red-800">Invalid Card IDs ({{ manualParseErrors.length }})</p>
                  <p class="text-xs text-red-700 mt-1">
                    {{ manualParseErrors.slice(0, 3).join(', ') }}
                    <span v-if="manualParseErrors.length > 3">... and {{ manualParseErrors.length - 3 }} more</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- No Selection Warning -->
          <div v-if="totalCardsCount === 0" class="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div class="flex">
              <ExclamationTriangleIcon class="w-5 h-5 text-yellow-400 mr-2" />
              <div>
                <p class="text-sm font-medium text-yellow-800">No cards selected</p>
                <p class="text-sm text-yellow-700 mt-1">
                  Select cards from the table or enter card IDs manually
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Revocation Reason -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Revocation Reason *
          </label>
          <textarea
            v-model="reason"
            rows="4"
            placeholder="Enter the reason for revoking these cards (minimum 5 characters)..."
            :class="[
              'w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500',
              reasonError ? 'border-red-300' : 'border-gray-300',
            ]"
            @input="validateReason"
          ></textarea>
          <div class="flex justify-between mt-1">
            <p v-if="reasonError" class="text-sm text-red-600">{{ reasonError }}</p>
            <p v-else class="text-sm text-gray-500">
              {{ reason.length }} characters (minimum 5)
            </p>
          </div>
        </div>
        
        <!-- Notes -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            v-model="notes"
            rows="3"
            placeholder="Add any additional notes about this bulk revocation..."
            class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <!-- Summary -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Operation Summary</h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-600">Total Cards:</p>
              <p class="font-medium text-gray-900">{{ totalCardsCount }}</p>
            </div>
            <div>
              <p class="text-gray-600">Operation Type:</p>
              <p class="font-medium text-gray-900">Bulk Revocation</p>
            </div>
            <div>
              <p class="text-gray-600">Estimated Time:</p>
              <p class="font-medium text-gray-900">{{ estimatedTime }}</p>
            </div>
            <div>
              <p class="text-gray-600">Initiator:</p>
              <p class="font-medium text-gray-900">{{ user.name }}</p>
            </div>
          </div>
        </div>
        
        <!-- Warning -->
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex">
            <ExclamationTriangleIcon class="w-5 h-5 text-red-400 mr-2" />
            <div>
              <p class="text-sm font-medium text-red-800">Important Warning</p>
              <ul class="mt-1 text-sm text-red-700 list-disc list-inside space-y-1">
                <li>This action cannot be undone</li>
                <li>Revoked cards cannot be reactivated</li>
                <li>Members will need new cards issued if needed</li>
                <li>Revocation will be logged for audit purposes</li>
              </ul>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3">
          <SecondaryButton
            type="button"
            @click="$emit('close')"
            :disabled="loading"
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            type="submit"
            :disabled="!canSubmit || loading"
            class="flex items-center"
          >
            <ArrowPathIcon v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
            <XCircleIcon v-else class="w-4 h-4 mr-2" />
            {{ loading ? 'Starting...' : `Revoke ${totalCardsCount} Cards` }}
          </PrimaryButton>
        </div>
      </form>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import Modal from '@/Components/Modal.vue'
import PrimaryButton from '@/Components/PrimaryButton.vue'
import SecondaryButton from '@/Components/SecondaryButton.vue'
import {
  XMarkIcon,
  CheckCircleIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  selectedCards: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'started'])

// User info
const { user } = usePage().props

// Selection method
const selectionMethod = ref('current') // 'current' or 'manual'

// Manual input
const manualCardIds = ref('')
const manualCardIdsLines = computed(() => manualCardIds.value.split('\n').length)
const parsedCardIds = ref([])
const manualParseErrors = ref([])

// Revocation details
const reason = ref('')
const reasonError = ref('')
const notes = ref('')

// Loading state
const loading = ref(false)

// Computed
const selectedCardsCount = computed(() => props.selectedCards.length)

const activeCardsCount = computed(() => {
  return props.selectedCards.filter(card => card.status === 'active').length
})

const issuedCardsCount = computed(() => {
  return props.selectedCards.filter(card => card.status === 'issued').length
})

const totalCardsCount = computed(() => {
  if (selectionMethod.value === 'current') {
    return selectedCardsCount.value
  } else {
    return parsedCardIds.value.length
  }
})

const canSubmit = computed(() => {
  return totalCardsCount.value > 0 && 
         totalCardsCount.value <= 1000 &&
         reason.value.trim().length >= 5 &&
         !reasonError.value
})

const estimatedTime = computed(() => {
  const count = totalCardsCount.value
  if (count <= 10) return '< 30 seconds'
  if (count <= 100) return '1-2 minutes'
  if (count <= 500) return '2-5 minutes'
  if (count <= 1000) return '5-10 minutes'
  return '10+ minutes'
})

// Methods
const parseManualCardIds = () => {
  const lines = manualCardIds.value.split('\n').map(line => line.trim()).filter(line => line)
  parsedCardIds.value = []
  manualParseErrors.value = []
  
  lines.forEach((line, index) => {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(line)) {
      parsedCardIds.value.push(line)
    } else {
      manualParseErrors.value.push(`Line ${index + 1}: Invalid UUID format`)
    }
  })
}

const validateReason = () => {
  if (reason.value.trim().length < 5) {
    reasonError.value = 'Reason must be at least 5 characters'
  } else {
    reasonError.value = ''
  }
}

const viewSelectedCards = () => {
  // In a real app, this might open a modal with the selected cards list
  alert(`Selected ${selectedCardsCount.value} cards:\n` + 
        props.selectedCards.map(card => `${card.member_name} (${card.member_id})`).join('\n'))
}

const submitBulkRevoke = async () => {
  if (!canSubmit.value || loading.value) return
  
  loading.value = true
  
  try {
    // Prepare card IDs based on selection method
    let cardIds = []
    if (selectionMethod.value === 'current') {
      cardIds = props.selectedCards.map(card => card.id)
    } else {
      cardIds = parsedCardIds.value
    }
    
    const payload = {
      card_ids: cardIds,
      reason: reason.value.trim(),
      notes: notes.value.trim(),
    }
    
    const response = await router.post(route('tenant.digital-cards.bulk-revoke'), payload, {
      preserveScroll: true,
      onSuccess: (page) => {
        emit('started', page.props.operation || {})
        resetForm()
      },
      onError: (errors) => {
        console.error('Bulk revoke failed:', errors)
      },
      onFinish: () => {
        loading.value = false
      }
    })
    
  } catch (error) {
    console.error('Bulk revoke failed:', error)
    loading.value = false
  }
}

const resetForm = () => {
  selectionMethod.value = 'current'
  manualCardIds.value = ''
  parsedCardIds.value = []
  manualParseErrors.value = []
  reason.value = ''
  reasonError.value = ''
  notes.value = ''
}
</script>
```

### **8.3 Create BulkOperations components**

Create a directory for bulk operations:

```bash
mkdir -p resources/js/Pages/Tenant/DigitalCards/BulkOperations
```

```vue
<!-- resources/js/Pages/Tenant/DigitalCards/BulkOperations/Index.vue -->
<template>
  <TenantLayout title="Bulk Operations">
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold leading-tight text-gray-800">
            Bulk Operations
          </h2>
          <p class="mt-1 text-sm text-gray-600">
            Monitor and manage bulk card issuance and revocation operations
          </p>
        </div>
        
        <div class="flex gap-3">
          <PrimaryButton
            @click="showBulkIssueModal = true"
            class="flex items-center gap-2"
          >
            <DocumentPlusIcon class="w-5 h-5" />
            Bulk Issue
          </PrimaryButton>
          <SecondaryButton
            @click="refreshData"
            :disabled="loading"
            class="flex items-center gap-2"
          >
            <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': loading }" />
            Refresh
          </SecondaryButton>
        </div>
      </div>
    </template>

    <div class="py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Operations"
            :value="stats.total_operations || 0"
            icon="CogIcon"
            color="blue"
          />
          <StatCard
            title="Processing"
            :value="stats.processing_operations || 0"
            icon="ArrowPathIcon"
            color="yellow"
          />
          <StatCard
            title="Successful"
            :value="stats.successful_operations || 0"
            icon="CheckCircleIcon"
            color="green"
          />
          <StatCard
            title="Failed"
            :value="stats.failed_operations || 0"
            icon="XCircleIcon"
            color="red"
          />
        </div>
        
        <!-- Filters -->
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6">
          <div class="flex flex-col md:flex-row md:items-center gap-4">
            <!-- Type Filter -->
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Operation Type
              </label>
              <select
                v-model="filters.type"
                @change="applyFilters"
                class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                :disabled="loading"
              >
                <option value="">All Types</option>
                <option value="issue">Issuance</option>
                <option value="revoke">Revocation</option>
              </select>
            </div>
            
            <!-- Status Filter -->
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                v-model="filters.status"
                @change="applyFilters"
                class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                :disabled="loading"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            <!-- Date Filter -->
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div class="flex gap-2">
                <input
                  v-model="filters.date_from"
                  type="date"
                  @change="applyFilters"
                  class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  :disabled="loading"
                />
                <input
                  v-model="filters.date_to"
                  type="date"
                  @change="applyFilters"
                  class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  :disabled="loading"
                />
              </div>
            </div>
            
            <!-- Search -->
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div class="relative">
                <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  v-model="filters.search"
                  @input="debouncedApplyFilters"
                  type="text"
                  placeholder="Search operations..."
                  class="w-full pl-10 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  :disabled="loading"
                />
              </div>
            </div>
          </div>
        </div>
        
        <!-- Operations Table -->
        <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg border border-gray-200">
          <div class="p-4 border-b border-gray-200 bg-gray-50">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-800">
                Operations
                <span class="text-sm font-normal text-gray-500">
                  ({{ operations.meta?.total || 0 }} total)
                </span>
              </h3>
              
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600">Show:</span>
                <select
                  v-model="perPage"
                  @change="updatePerPage"
                  class="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  :disabled="loading"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Loading State -->
          <div v-if="loading" class="p-8 text-center">
            <div class="inline-flex items-center justify-center gap-3">
              <ArrowPathIcon class="w-6 h-6 animate-spin text-blue-500" />
              <span class="text-gray-600">Loading operations...</span>
            </div>
          </div>
          
          <!-- Empty State -->
          <div v-else-if="operations.data.length === 0" class="p-8 text-center">
            <CogIcon class="w-12 h-12 mx-auto text-gray-400" />
            <h3 class="mt-2 text-sm font-medium text-gray-900">No operations found</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ hasFilters ? 'Try changing your filters' : 'Get started with a bulk operation' }}
            </p>
            <div class="mt-6">
              <PrimaryButton
                v-if="!hasFilters"
                @click="showBulkIssueModal = true"
              >
                <DocumentPlusIcon class="w-4 h-4 mr-2" />
                Start Bulk Operation
              </PrimaryButton>
              <SecondaryButton
                v-if="hasFilters"
                @click="resetFilters"
              >
                Clear Filters
              </SecondaryButton>
            </div>
          </div>
          
          <!-- Operations List -->
          <div v-else>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operation
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr
                    v-for="operation in operations.data"
                    :key="operation.id"
                    class="hover:bg-gray-50"
                  >
                    <!-- Operation Info -->
                    <td class="px-6 py-4">
                      <div>
                        <div class="text-sm font-medium text-gray-900">
                          {{ operationTypeLabel(operation.type) }}
                        </div>
                        <div class="text-xs text-gray-500">
                          ID: {{ truncateId(operation.id) }}
                        </div>
                        <div class="text-xs text-gray-500">
                          {{ formatDate(operation.created_at, 'relative') }}
                        </div>
                      </div>
                    </td>
                    
                    <!-- Status -->
                    <td class="px-6 py-4">
                      <StatusBadge :status="operation.status" />
                      <div v-if="operation.error_message" class="text-xs text-gray-500 mt-1 truncate max-w-xs">
                        {{ operation.error_message }}
                      </div>
                    </td>
                    
                    <!-- Progress -->
                    <td class="px-6 py-4">
                      <div class="w-full">
                        <!-- Progress Bar -->
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div
                            :class="progressBarClass(operation.status)"
                            :style="{ width: `${operation.progress_percentage}%` }"
                            class="h-2 rounded-full transition-all duration-300"
                          ></div>
                        </div>
                        
                        <!-- Progress Text -->
                        <div class="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{{ operation.processed_items }} / {{ operation.total_items }}</span>
                          <span>{{ Math.round(operation.progress_percentage) }}%</span>
                        </div>
                        
                        <!-- Results -->
                        <div v-if="operation.status === 'completed'" class="text-xs mt-1">
                          <span class="text-green-600 font-medium">{{ operation.successful_items }} ✓</span>
                          <span class="text-red-600 font-medium ml-2">{{ operation.failed_items }} ✗</span>
                        </div>
                      </div>
                    </td>
                    
                    <!-- Details -->
                    <td class="px-6 py-4">
                      <div class="text-sm text-gray-900">
                        <div class="flex items-center gap-1">
                          <UserIcon class="w-4 h-4 text-gray-400" />
                          {{ operation.initiated_by }}
                        </div>
                        <div v-if="operation.parameters" class="text-xs text-gray-500 mt-1">
                          {{ operationDetails(operation) }}
                        </div>
                      </div>
                    </td>
                    
                    <!-- Actions -->
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div class="flex items-center gap-2">
                        <!-- View Details -->
                        <IconButton
                          @click="viewOperation(operation)"
                          title="View Details"
                          class="text-blue-600 hover:text-blue-900"
                        >
                          <EyeIcon class="w-4 h-4" />
                        </IconButton>
                        
                        <!-- Download Results -->
                        <IconButton
                          v-if="operation.status === 'completed'"
                          @click="downloadResults(operation)"
                          title="Download Results"
                          class="text-green-600 hover:text-green-900"
                        >
                          <ArrowDownTrayIcon class="w-4 h-4" />
                        </IconButton>
                        
                        <!-- Cancel -->
                        <IconButton
                          v-if="operation.status === 'pending' || operation.status === 'processing'"
                          @click="cancelOperation(operation)"
                          title="Cancel Operation"
                          class="text-red-600 hover:text-red-900"
                        >
                          <XCircleIcon class="w-4 h-4" />
                        </IconButton>
                        
                        <!-- Retry -->
                        <IconButton
                          v-if="operation.status === 'failed'"
                          @click="retryOperation(operation)"
                          title="Retry Operation"
                          class="text-yellow-600 hover:text-yellow-900"
                        >
                          <ArrowPathIcon class="w-4 h-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Pagination -->
            <div class="px-4 py-3 border-t border-gray-200">
              <Pagination :meta="operations.meta" @page-change="goToPage" />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Modals -->
    <BulkIssueModal
      :show="showBulkIssueModal"
      @close="showBulkIssueModal = false"
      @started="handleBulkOperationStarted"
    />
    
    <BulkRevokeModal
      :show="showBulkRevokeModal"
      :selected-cards="selectedCards"
      @close="showBulkRevokeModal = false"
      @started="handleBulkOperationStarted"
    />
    
    <!-- Notifications -->
    <Notification
      v-if="successMessage"
      type="success"
      :message="successMessage"
      @close="successMessage = ''"
    />
    
    <Notification
      v-if="errorMessage"
      type="error"
      :message="errorMessage"
      @close="errorMessage = ''"
    />
  </TenantLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import { debounce } from 'lodash'
import TenantLayout from '@/Layouts/TenantLayout.vue'
import StatCard from '@/Components/StatCard.vue'
import BulkIssueModal from '../Components/BulkIssueModal.vue'
import BulkRevokeModal from '../Components/BulkRevokeModal.vue'
import Pagination from '@/Components/Pagination.vue'
import StatusBadge from '../Components/StatusBadge.vue'
import IconButton from '@/Components/IconButton.vue'
import Notification from '@/Components/Notification.vue'
import PrimaryButton from '@/Components/PrimaryButton.vue'
import SecondaryButton from '@/Components/SecondaryButton.vue'
import {
  DocumentPlusIcon,
  ArrowPathIcon,
  CogIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  UserIcon,
} from '@heroicons/vue/24/outline'

// Props
const props = defineProps({
  operations: {
    type: Object,
    default: () => ({ data: [], meta: {} })
  },
  filters: {
    type: Object,
    default: () => ({})
  },
  stats: {
    type: Object,
    default: () => ({})
  },
  selectedCards: {
    type: Array,
    default: () => []
  }
})

// State
const loading = ref(false)
const showBulkIssueModal = ref(false)
const showBulkRevokeModal = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const perPage = ref(props.filters.per_page || 20)

// Computed
const hasFilters = computed(() => {
  const { page, per_page, ...filterFields } = props.filters
  return Object.values(filterFields).some(value => value !== null && value !== '')
})

// Methods
const refreshData = () => {
  loading.value = true
  router.reload({
    only: ['operations', 'stats'],
    preserveState: true,
    preserveScroll: true,
    onFinish: () => loading.value = false
  })
}

const applyFilters = () => {
  loading.value = true
  router.get(route('tenant.digital-cards.bulk-operations.index'), {
    ...props.filters,
    page: 1, // Reset to first page
  }, {
    preserveState: true,
    preserveScroll: true,
    onFinish: () => loading.value = false
  })
}

const debouncedApplyFilters = debounce(applyFilters, 500)

const resetFilters = () => {
  loading.value = true
  router.get(route('tenant.digital-cards.bulk-operations.index'), {}, {
    preserveState: true,
    preserveScroll: true,
    onFinish: () => loading.value = false
  })
}

const updatePerPage = () => {
  applyFilters({ per_page: perPage.value })
}

const goToPage = (page) => {
  loading.value = true
  router.get(route('tenant.digital-cards.bulk-operations.index'), {
    ...props.filters,
    page
  }, {
    preserveState: true,
    preserveScroll: true,
    onFinish: () => loading.value = false
  })
}

const operationTypeLabel = (type) => {
  const labels = {
    issue: 'Bulk Issuance',
    revoke: 'Bulk Revocation',
  }
  return labels[type] || type
}

const truncateId = (id) => {
  if (!id) return ''
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id
}

const formatDate = (dateString, format = 'medium') => {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  
  if (format === 'relative') {
    const now = new Date()
    const diffMs = now - date
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const progressBarClass = (status) => {
  const classes = {
    pending: 'bg-yellow-500',
    processing: 'bg-blue-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  }
  return classes[status] || 'bg-gray-500'
}

const operationDetails = (operation) => {
  if (operation.type === 'issue') {
    return `${operation.parameters?.members?.length || 0} members`
  } else if (operation.type === 'revoke') {
    return `${operation.parameters?.card_ids?.length || 0} cards`
  }
  return ''
}

const viewOperation = (operation) => {
  router.get(route('tenant.digital-cards.bulk-operations.show', operation.id))
}

const downloadResults = async (operation) => {
  try {
    const response = await router.get(route('tenant.digital-cards.bulk-operations.download', operation.id))
    
    if (response.data) {
      const data = JSON.stringify(response.data, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bulk-operation-${operation.id.slice(0, 8)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    errorMessage.value = 'Failed to download results'
    console.error('Download failed:', error)
  }
}

const cancelOperation = async (operation) => {
  if (!confirm('Are you sure you want to cancel this operation?')) return
  
  try {
    loading.value = true
    
    const response = await router.delete(
      route('tenant.digital-cards.bulk-operations.cancel', operation.id),
      {},
      {
        preserveScroll: true,
        onSuccess: () => {
          successMessage.value = 'Operation cancelled successfully'
          refreshData()
        },
        onError: (errors) => {
          errorMessage.value = errors.message || 'Failed to cancel operation'
        },
        onFinish: () => {
          loading.value = false
        }
      }
    )
  } catch (error) {
    errorMessage.value = 'Failed to cancel operation'
    loading.value = false
  }
}

const retryOperation = async (operation) => {
  if (!confirm('Are you sure you want to retry this failed operation?')) return
  
  try {
    loading.value = true
    
    const response = await router.post(
      route('tenant.digital-cards.bulk-operations.retry', operation.id),
      {},
      {
        preserveScroll: true,
        onSuccess: () => {
          successMessage.value = 'Operation retry started'
          refreshData()
        },
        onError: (errors) => {
          errorMessage.value = errors.message || 'Failed to retry operation'
        },
        onFinish: () => {
          loading.value = false
        }
      }
    )
  } catch (error) {
    errorMessage.value = 'Failed to retry operation'
    loading.value = false
  }
}

const handleBulkOperationStarted = (operation) => {
  successMessage.value = 'Bulk operation started successfully!'
  showBulkIssueModal.value = false
  showBulkRevokeModal.value = false
  refreshData()
}

// Auto-hide notifications
watch(successMessage, (value) => {
  if (value) {
    setTimeout(() => {
      successMessage.value = ''
    }, 5000)
  }
})

watch(errorMessage, (value) => {
  if (value) {
    setTimeout(() => {
      errorMessage.value = ''
    }, 8000)
  }
})
</script>
```

## **Step 9: Update the main Index.vue to include bulk operations**

Update the main Digital Cards Index.vue to add bulk operation buttons:

```vue
<!-- In resources/js/Pages/Tenant/DigitalCards/Index.vue -->

<!-- Add to the header section -->
<div class="flex flex-col sm:flex-row sm:items-center gap-3">
  <!-- Existing buttons... -->
  
  <!-- Bulk Operations Dropdown -->
  <Menu as="div" class="relative">
    <MenuButton as="button">
      <SecondaryButton class="flex items-center gap-2">
        <EllipsisHorizontalIcon class="w-5 h-5" />
        Bulk Actions
        <ChevronDownIcon class="w-4 h-4" />
      </SecondaryButton>
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
          <MenuItem v-slot="{ active }">
            <button
              @click="openBulkIssue"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <DocumentPlusIcon class="w-4 h-4 mr-3" />
              Bulk Issue Cards
            </button>
          </MenuItem>
          <MenuItem v-slot="{ active }">
            <button
              @click="openBulkRevoke"
              :disabled="selectedCards.length === 0"
              :class="[
                active ? 'bg-gray-100' : '',
                'flex w-full items-center px-4 py-2 text-sm',
                selectedCards.length === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700'
              ]"
            >
              <XCircleIcon class="w-4 h-4 mr-3" />
              Bulk Revoke Selected ({{ selectedCards.length }})
            </button>
          </MenuItem>
          <div class="border-t border-gray-100"></div>
          <MenuItem v-slot="{ active }">
            <button
              @click="viewBulkOperations"
              :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']"
            >
              <CogIcon class="w-4 h-4 mr-3" />
              View Bulk Operations
            </button>
          </MenuItem>
        </div>
      </MenuItems>
    </transition>
  </Menu>
</div>

<!-- Add to the script section -->
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  EllipsisHorizontalIcon,
  ChevronDownIcon,
  DocumentPlusIcon,
  CogIcon,
} from '@heroicons/vue/24/outline'

// Add state for selected cards
const selectedCards = ref([])

// Add methods
const openBulkIssue = () => {
  showBulkIssueModal.value = true
}

const openBulkRevoke = () => {
  if (selectedCards.value.length === 0) return
  showBulkRevokeModal.value = true
}

const viewBulkOperations = () => {
  router.get(route('tenant.digital-cards.bulk-operations.index'))
}

// Update CardDataTable to emit selection
// In CardDataTable.vue, add row selection
```

## **Step 10: Add routes for bulk operations**

Update the routes file:

```php
<?php

// Add bulk operation routes
Route::middleware(['web', 'auth', 'tenant'])
    ->prefix('{tenant}/admin/digital-cards/bulk-operations')
    ->name('tenant.digital-cards.bulk-operations.')
    ->group(function () {
        Route::get('/', [DigitalCardController::class, 'listBulkOperations'])->name('index');
        Route::get('/{operation}', [DigitalCardController::class, 'showBulkOperation'])->name('show');
        Route::post('/{operation}/cancel', [DigitalCardController::class, 'cancelBulkOperation'])->name('cancel');
        Route::post('/{operation}/retry', [DigitalCardController::class, 'retryBulkOperation'])->name('retry');
        Route::get('/{operation}/download', [DigitalCardController::class, 'downloadBulkOperationResults'])->name('download');
    });

// Add bulk action routes to existing group
Route::middleware(['web', 'auth', 'tenant'])
    ->prefix('{tenant}/admin/digital-cards')
    ->name('tenant.digital-cards.')
    ->group(function () {
        // ... existing routes ...
        
        // Bulk actions
        Route::post('/bulk-issue', [DigitalCardController::class, 'bulkIssue'])->name('bulk-issue');
        Route::post('/bulk-revoke', [DigitalCardController::class, 'bulkRevoke'])->name('bulk-revoke');
    });
```

## **Step 11: Create tests for bulk operations**

```bash
php artisan make:test Feature/Contexts/DigitalCard/BulkOperationsTest
```

```php
<?php

namespace Tests\Feature\Contexts\DigitalCard;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class BulkOperationsTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;
    protected User $platformAdmin;
    protected User $committeeAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->tenant = Tenant::factory()->create();
        
        $this->platformAdmin = User::factory()->create([
            'tenant_id' => null,
            'is_super_admin' => true,
            'role' => 'platform_admin',
        ]);
        
        $this->committeeAdmin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_admin' => true,
            'role' => 'committee_admin',
        ]);
        
        tenancy()->initialize($this->tenant);
    }

    /** @test */
    public function platform_admin_can_initiate_bulk_issue_operation()
    {
        Queue::fake();
        Event::fake();
        
        $this->actingAs($this->platformAdmin);
        
        $members = [
            ['member_id' => 'MEM-001', 'member_name' => 'John Doe'],
            ['member_id' => 'MEM-002', 'member_name' => 'Jane Smith'],
            ['member_id' => 'MEM-003', 'member_name' => 'Bob Wilson', 'expiry_date' => '2025-12-31'],
        ];
        
        $response = $this->postJson("/{$this->tenant->id}/api/v1/cards/bulk-issue", [
            'members' => $members,
        ]);
        
        $response->assertStatus(202);
        $response->assertJsonStructure([
            'message',
            'operation_id',
            'status',
            'total_items',
        ]);
        
        $this->assertDatabaseHas('bulk_operations', [
            'tenant_id' => $this->tenant->id,
            'type' => 'issue',
            'status' => 'pending',
            'total_items' => 3,
        ]);
        
        Queue::assertPushed(\App\Contexts\DigitalCard\Application\Handlers\BulkIssueCardsHandler::class);
    }

    /** @test */
    public function committee_admin_cannot_initiate_bulk_issue_operation()
    {
        $this->actingAs($this->committeeAdmin);
        
        $members = [
            ['member_id' => 'MEM-001', 'member_name' => 'John Doe'],
        ];
        
        $response = $this->postJson("/{$this->tenant->id}/api/v1/cards/bulk-issue", [
            'members' => $members,
        ]);
        
        $response->assertStatus(403);
    }

    /** @test */
    public function bulk_issue_requires_valid_member_data()
    {
        $this->actingAs($this->platformAdmin);
        
        $invalidMembers = [
            ['member_id' => '', 'member_name' => 'John Doe'], // Missing member_id
            ['member_id' => 'MEM-001', 'member_name' => ''], // Missing member_name
            ['member_id' => 'INVALID', 'member_name' => 'Test'], // Invalid member_id format
        ];
        
        $response = $this->postJson("/{$this->tenant->id}/api/v1/cards/bulk-issue", [
            'members' => $invalidMembers,
        ]);
        
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['members.0.member_id', 'members.1.member_name', 'members.2.member_id']);
    }

    /** @test */
    public function bulk_issue_respects_batch_size_limit()
    {
        $this->actingAs($this->platformAdmin);
        
        // Create 1001 members (exceeds limit)
        $members = [];
        for ($i = 1; $i <= 1001; $i++) {
            $members[] = ['member_id' => "MEM-{$i}", 'member_name' => "Member {$i}"];
        }
        
        $response = $this->postJson("/{$this->tenant->id}/api/v1/cards/bulk-issue", [
            'members' => $members,
        ]);
        
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['members']);
    }

    /** @test */
    public function platform_admin_can_initiate_bulk_revoke_operation()
    {
        Queue::fake();
        Event::fake();
        
        $this->actingAs($this->platformAdmin);
        
        // First, create some cards
        $cardIds = [];
        for ($i = 1; $i <= 3; $i++) {
            $response = $this->postJson("/{$this->tenant->id}/api/v1/cards", [
                'member_id' => "MEM-REVOKE-{$i}",
                'member_name' => "Revoke Test {$i}",
                'expiry_date' => now()->addYear()->format('Y-m-d'),
            ]);
            
            $cardIds[] = $response->json('id');
        }
        
        // Now bulk revoke them
        $response = $this->postJson("/{$this->tenant->id}/api/v1/cards/bulk-revoke", [
            'card_ids' => $cardIds,
            'reason' => 'Test bulk revocation',
        ]);
        
        $response->assertStatus(202);
        $response->assertJsonStructure([
            'message',
            'operation_id',
            'status',
            'total_items',
        ]);
        
        $this->assertDatabaseHas('bulk_operations', [
            'tenant_id' => $this->tenant->id,
            'type' => 'revoke',
            'status' => 'pending',
            'total_items' => 3,
        ]);
        
        Queue::assertPushed(\App\Contexts\DigitalCard\Application\Handlers\BulkRevokeCardsHandler::class);
    }

    /** @test */
    public function bulk_revoke_requires_valid_reason()
    {
        $this->actingAs($this->platformAdmin);
        
        $response = $this->postJson("/{$this->tenant->id}/api/v1/cards/bulk-revoke", [
            'card_ids' => ['550e8400-e29b-41d4-a716-446655440000'],
            'reason' => 'Test', // Too short
        ]);
        
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['reason']);
    }

    /** @test */
    public function can_get_bulk_operation_status()
    {
        $this->actingAs($this->platformAdmin);
        
        // Create a bulk operation
        $operation = \App\Models\BulkOperation::create([
            'id' => 'test-operation-id',
            'tenant_id' => $this->tenant->id,
            'type' => 'issue',
            'parameters' => ['members' => []],
            'status' => 'processing',
            'total_items' => 10,
            'processed_items' => 5,
            'successful_items' => 5,
            'failed_items' => 0,
            'initiated_by' => $this->platformAdmin->id,
        ]);
        
        $response = $this->getJson("/{$this->tenant->id}/api/v1/cards/bulk-operations/{$operation->id}/status");
        
        $response->assertStatus(200);
        $response->assertJson([
            'id' => $operation->id,
            'status' => 'processing',
            'total_items' => 10,
            'processed_items' => 5,
        ]);
    }

    /** @test */
    public function cannot_get_other_users_bulk_operation_status()
    {
        $otherUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_admin' => false,
        ]);
        
        $this->actingAs($otherUser);
        
        $operation = \App\Models\BulkOperation::create([
            'id' => 'test-operation-id',
            'tenant_id' => $this->tenant->id,
            'type' => 'issue',
            'parameters' => ['members' => []],
            'status' => 'processing',
            'total_items' => 10,
            'initiated_by' => $this->platformAdmin->id, // Different user
        ]);
        
        $response = $this->getJson("/{$this->tenant->id}/api/v1/cards/bulk-operations/{$operation->id}/status");
        
        $response->assertStatus(403);
    }

    /** @test */
    public function can_cancel_pending_bulk_operation()
    {
        $this->actingAs($this->platformAdmin);
        
        $operation = \App\Models\BulkOperation::create([
            'id' => 'test-operation-id',
            'tenant_id' => $this->tenant->id,
            'type' => 'issue',
            'parameters' => ['members' => []],
            'status' => 'pending',
            'total_items' => 10,
            'initiated_by' => $this->platformAdmin->id,
        ]);
        
        $response = $this->deleteJson("/{$this->tenant->id}/api/v1/cards/bulk-operations/{$operation->id}/cancel");
        
        $response->assertStatus(200);
        $this->assertDatabaseHas('bulk_operations', [
            'id' => $operation->id,
            'status' => 'failed',
        ]);
    }

    /** @test */
    public function cannot_cancel_completed_operation()
    {
        $this->actingAs($this->platformAdmin);
        
        $operation = \App\Models\BulkOperation::create([
            'id' => 'test-operation-id',
            'tenant_id' => $this->tenant->id,
            'type' => 'issue',
            'parameters' => ['members' => []],
            'status' => 'completed',
            'total_items' => 10,
            'initiated_by' => $this->platformAdmin->id,
        ]);
        
        $response = $this->deleteJson("/{$this->tenant->id}/api/v1/cards/bulk-operations/{$operation->id}/cancel");
        
        $response->assertStatus(422);
    }

    /** @test */
    public function bulk_operation_progress_is_updated_during_processing()
    {
        // This test would require mocking the job processing
        // For now, just test the progress calculation
        $operation = new \App\Contexts\DigitalCard\Domain\Models\BulkOperation(
            id: new \App\Contexts\DigitalCard\Domain\ValueObjects\BulkOperationId('test-id'),
            tenantId: new \App\Contexts\DigitalCard\Domain\ValueObjects\TenantId($this->tenant->id),
            type: 'issue',
            parameters: [],
            status: 'processing',
            totalItems: 100,
            processedItems: 50,
            successfulItems: 45,
            failedItems: 5,
            initiatedBy: new \App\Contexts\DigitalCard\Domain\ValueObjects\UserId($this->platformAdmin->id),
        );
        
        $this->assertEquals(50.0, $operation->progressPercentage());
        $this->assertTrue($operation->isProcessing());
    }

    /** @test */
    public function bulk_operation_handles_individual_failures_gracefully()
    {
        $this->actingAs($this->platformAdmin);
        
        Queue::fake();
        
        // Create members with one invalid one
        $members = [
            ['member_id' => 'MEM-001', 'member_name' => 'Valid Member'],
            ['member_id' => 'INVALID', 'member_name' => 'Invalid Member'], // Invalid format
            ['member_id' => 'MEM-003', 'member_name' => 'Another Valid Member'],
        ];
        
        $response = $this->postJson("/{$this->tenant->id}/api/v1/cards/bulk-issue", [
            'members' => $members,
        ]);
        
        $response->assertStatus(202);
        
        // The operation should be created even with invalid data
        // Individual failures will be handled by the job
        $this->assertDatabaseHas('bulk_operations', [
            'type' => 'issue',
            'total_items' => 3,
        ]);
    }
}
```

Run the bulk operations tests:

```bash
php artisan test tests/Feature/Contexts/DigitalCard/BulkOperationsTest.php
```

## **Step 12: Install required npm package**

```bash
npm install papaparse lodash
```

## **Step 13: Build the frontend assets**

```bash
npm run build
```

## **Summary of Bulk Operations Implementation:**

✅ **Completed Bulk Operations Features:**

### **Backend:**
1. **Domain Layer:**
   - `BulkOperation` domain model with business logic
   - `BulkOperationId` value object
   - Repository interface and Eloquent implementation

2. **Application Layer:**
   - `BulkIssueCards` and `BulkRevokeCards` commands
   - Queue-based handlers with progress tracking
   - Failure handling with graceful degradation
   - Automatic retry logic

3. **Infrastructure Layer:**
   - Database migrations for bulk operations tracking
   - Eloquent models with relationships
   - Form request validation
   - Controller methods for all bulk operations
   - WebSocket events for real-time progress updates

### **Frontend:**
1. **Bulk Issue Modal:**
   - CSV upload with validation and preview
   - Manual data entry with parsing
   - Template download
   - Expiry date configuration options
   - Progress visualization

2. **Bulk Revoke Modal:**
   - Selection from current table or manual entry
   - Validation of card IDs
   - Reason requirement with validation
   - Operation summary

3. **Bulk Operations Dashboard:**
   - List all bulk operations with filters
   - Progress bars for ongoing operations
   - Status badges
   - Action buttons (view, cancel, retry, download)
   - Statistics display

4. **Integration:**
   - Added to main cards table with dropdown
   - Real-time progress updates via WebSockets
   - Success/error notifications
   - Automatic data refresh

### **Key Features Implemented:**
- ✅ **Batch Processing**: Queue-based processing for large operations
- ✅ **Progress Tracking**: Real-time progress updates with WebSockets
- ✅ **Error Handling**: Individual item failures don't stop entire batch
- ✅ **Validation**: Comprehensive input validation
- ✅ **Security**: Authorization checks for all operations
- ✅ **Audit Trail**: Complete logging of all bulk operations
- ✅ **Export Results**: Download operation results
- ✅ **Cancellation**: Cancel pending/processing operations
- ✅ **Retry Failed**: Retry failed operations

### **Performance Considerations:**
- **Queue Processing**: Prevents timeouts for large batches
- **Batch Size Limits**: Maximum 1000 items per operation
- **Progress Updates**: Periodic updates (every 10 items)
- **Database Indexing**: Optimized for bulk operation queries
- **Memory Management**: Stream processing for CSV uploads

### **User Experience:**
- ✅ Step-by-step wizards for complex operations
- ✅ Real-time progress feedback
- ✅ Clear error messages and validation
- ✅ Preview before submission
- ✅ Downloadable templates
- ✅ Responsive design

### **Security:**
- ✅ Role-based access control (Platform Admin only for bulk)
- ✅ Tenant isolation
- ✅ Input validation and sanitization
- ✅ Audit logging
- ✅ CSRF protection

## **Next Steps for Phase 1:**

We've now completed:
1. ✅ Card lifecycle operations
2. ✅ Card listing with filters
3. ✅ Vue.js admin interface
4. ✅ Laravel Policies for authorization
5. ✅ Real-time updates with WebSockets
6. ✅ **Bulk operations**

The **remaining items** from the Phase 1 plan are:

7. **Export functionality** (CSV/Excel)
8. **Enhanced QR code security** with signatures
9. **Audit logging UI** to view card history
10. **Search debouncing** for better performance
11. **Data validation** on the frontend

**Would you like me to implement Export functionality next?** This would include:
- CSV/Excel export of card lists
- PDF export for individual cards
- Bulk operation results export
- Scheduled exports
- Export templates for reporting