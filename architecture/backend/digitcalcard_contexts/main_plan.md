 
Here’s a full DDD design draft for the DigitalCardContext tailored to your platform:

✅ Bounded Context: DigitalCardContext
Purpose: 

Manages the lifecycle of digital membership cards, including issuance, activation, revocation, and validation. 

Independent from Membership context but linked via MemberId.
Core Aggregate
Aggregate Root: DigitalCard
Identity: CardId (Value Object)
Attributes:

MemberId (Value Object from Membership)

QRCode (Value Object)

Status (Enum: Active, Revoked, Expired)

IssuedAt (DateTime)

ExpiresAt (DateTime)
Invariants:

A card must belong to exactly one member.

Status transitions: Issued → Active → Revoked/Expired.

Expiry date cannot be before issue date.

Entities & Value Objects
DigitalCard (Entity)
CardId (Value Object)
QRCode (Value Object)
CardStatus (Enum)

Domain Services
CardIssuanceService 

→ Issues new cards, generates QR codes, sets expiry.

CardValidationService 

→ Validates card authenticity and status.

CardRevocationService 

→ Revokes cards when membership ends or fraud detected.

Repositories
DigitalCardRepository 

→ Handles persistence (Tenant DB). 

→ Methods: findByCardId(), findByMemberId(), save(), revoke().

Domain Events
CardIssued

CardActivated

CardRevoked

CardExpired

Events can trigger notifications or sync with Membership context.
Application Layer
Commands:

IssueCardCommand

ActivateCardCommand

RevokeCardCommand
Handlers:

IssueCardHandler

ActivateCardHandler

RevokeCardHandler

Infrastructure
QR Code Generator (Service)
Persistence Adapter (Eloquent Repository)
Event Dispatcher

Possible Directory Structure
app/Contexts/DigitalCard/

├── Domain/

│   ├── Entities/DigitalCard.php

│   ├── ValueObjects/CardId.php

│   ├── ValueObjects/QRCode.php

│   ├── Events/CardIssued.php

│   └── Services/CardIssuanceService.php

├── Application/

│   ├── Commands/IssueCardCommand.php

│   ├── Handlers/IssueCardHandler.php

│   └── DTOs/CardDTO.php

└── Infrastructure/

    ├── Repositories/DigitalCardRepository.php

    ├── QRCodeGenerator.php

    └── Persistence/EloquentDigitalCardRepository.php

 
 
Awesome—here’s a code-ready Laravel scaffolding for the DigitalCardContext that respects your DDD/TDD constraints, 6‑case routing, Sanctum for mobile, and strict tenant isolation.
Notes up-front (per your charter):
No refactors to existing packages or route files are performed.

All new files are self-contained under app/Contexts/DigitalCard/ + tests/Contexts/DigitalCard/.
Tenant DB only for card data.
TDD-first: tests are provided before implementation stubs.

1) Directory Layout
app/Contexts/DigitalCard/

├── Application/

│   ├── Commands/

│   │   ├── ActivateCardCommand.php

│   │   ├── IssueCardCommand.php

│   │   └── RevokeCardCommand.php

│   ├── Handlers/

│   │   ├── ActivateCardHandler.php

│   │   ├── IssueCardHandler.php

│   │   └── RevokeCardHandler.php

│   └── DTOs/

│       └── CardDTO.php

├── Domain/

│   ├── Entities/DigitalCard.php

│   ├── Enums/CardStatus.php

│   ├── Events/

│   │   ├── CardActivated.php

│   │   ├── CardExpired.php

│   │   ├── CardIssued.php

│   │   └── CardRevoked.php

│   ├── Repositories/DigitalCardRepository.php

│   ├── Services/

│   │   ├── CardIssuanceService.php

│   │   ├── CardRevocationService.php

│   │   └── CardValidationService.php

│   └── ValueObjects/

│       ├── CardId.php

│       ├── MemberId.php

│       └── QRCode.php

├── Infrastructure/

│   ├── Http/

│   │   ├── Controllers/

│   │   │   └── DigitalCardController.php

│   │   ├── Requests/

│   │   │   ├── ActivateCardRequest.php

│   │   │   ├── IssueCardRequest.php

│   │   │   └── RevokeCardRequest.php

│   │   └── Resources/

│   │       └── DigitalCardResource.php

│   ├── Persistence/

│   │   ├── Eloquent/

│   │   │   └── EloquentDigitalCard.php

│   │   └── EloquentDigitalCardRepository.php

│   ├── Providers/DigitalCardServiceProvider.php

│   └── Services/

│       ├── LaravelClock.php

│       └── SimpleQRCodeGenerator.php

└── README.md
Routes (stubs, not wired yet):

routes/tenant/api.digitalcard.php   # Vue Desktop → /{tenant}/api/v1/cards/*

routes/tenant/mapi.digitalcard.php  # Angular Mobile → /{tenant}/mapi/v1/cards/*
Migrations (Tenant DB):

database/migrations/tenant/2025_01_01_000000_create_digital_cards_table.php
Tests (TDD-first):

tests/Contexts/DigitalCard/Domain/DigitalCardTest.php

tests/Contexts/DigitalCard/Feature/IssueCardFeatureTest.php
2) Tests First (TDD)
2.1 Domain tests
<?php

// tests/Contexts/DigitalCard/Domain/DigitalCardTest.php

declare(strict_types=1);

namespace Tests\Contexts\DigitalCard\Domain;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;

use App\Contexts\DigitalCard\Domain\Enums\CardStatus;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

use PHPUnit\Framework\TestCase;

final class DigitalCardTest extends TestCase

{

    public function test_issue_card_and_activate(): void

    {

        $card = DigitalCard::issue(

            CardId::new(),

            MemberId::fromString('5a92f95c-6d1a-4edb-9f2f-2b3a1f3cbe10'),

            QRCode::fromString('qr:dummy'),

            new \DateTimeImmutable('2025-01-01T00:00:00Z'),

            new \DateTimeImmutable('2026-01-01T00:00:00Z')

        );

        $this->assertTrue($card->status()->is(CardStatus::Issued));

        $card->activate(new \DateTimeImmutable('2025-01-02T00:00:00Z'));

        $this->assertTrue($card->status()->is(CardStatus::Active));

    }

    public function test_invalid_expiry_fails(): void

    {

        $this->expectException(\InvalidArgumentException::class);

        DigitalCard::issue(

            CardId::new(),

            MemberId::fromString('5a92f95c-6d1a-4edb-9f2f-2b3a1f3cbe10'),

            QRCode::fromString('qr:x'),

            new \DateTimeImmutable('2025-01-05T00:00:00Z'),

            new \DateTimeImmutable('2025-01-01T00:00:00Z')

        );

    }

    public function test_revoke_only_from_active_or_issued(): void

    {

        $card = DigitalCard::issue(

            CardId::new(),

            MemberId::fromString('cafecafe-6d1a-4edb-9f2f-2b3a1f3cbe10'),

            QRCode::fromString('qr:y'),

            new \DateTimeImmutable('2025-01-01T00:00:00Z'),

            new \DateTimeImmutable('2026-01-01T00:00:00Z')

        );

        $card->activate(new \DateTimeImmutable('2025-01-02T00:00:00Z'));

        $card->revoke('membership_ended', new \DateTimeImmutable('2025-06-01T00:00:00Z'));

        $this->assertTrue($card->status()->is(CardStatus::Revoked));

    }

}
2.2 Feature test (Issue via Desktop API)
<?php

// tests/Contexts/DigitalCard/Feature/IssueCardFeatureTest.php

declare(strict_types=1);

namespace Tests\Contexts\DigitalCard\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;

use Tests\TestCase;

final class IssueCardFeatureTest extends TestCase

{

    use RefreshDatabase;

    protected function setUp(): void

    {

        parent::setUp();

        // If your test suite provides helpers for tenant bootstrapping, call them here:

        // $this->bootstrapTenant('example-tenant');  // e.g. sets current tenant & switches DB

    }

    public function test_issue_card_desktop_api(): void

    {

        // actingAs platform/tenant admin user as per your guards

        // $user = User::factory()->create([...]);

        // $this->actingAs($user);

        $tenant = 'example-tenant';

        $payload = [

            'member_id' => '5a92f95c-6d1a-4edb-9f2f-2b3a1f3cbe10',

            'expires_at' => '2026-01-01T00:00:00Z',

        ];

        $resp = $this->postJson("/{$tenant}/api/v1/cards", $payload);

        $resp->assertCreated()

             ->assertJsonStructure(['data' => ['card_id','member_id','status','issued_at','expires_at','qrcode']]);

    }

}

Adjust tenant bootstrap & auth snippets to match your test harness (you likely have helpers in TenantAuth/Shared).
3) Domain Layer
3.1 Enums
<?php

// app/Contexts/DigitalCard/Domain/Enums/CardStatus.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Enums;

enum CardStatus: string

{

    case Issued = 'issued';

    case Active = 'active';

    case Revoked = 'revoked';

    case Expired = 'expired';

    public function is(self $status): bool { return $this === $status; }

}
3.2 Value Objects
<?php

// app/Contexts/DigitalCard/Domain/ValueObjects/CardId.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

use Ramsey\Uuid\Uuid;

final class CardId

{

    private function __construct(private string $value) {}

    public static function new(): self { return new self(Uuid::uuid4()->toString()); }

    public static function fromString(string $v): self {

        if (!Uuid::isValid($v)) throw new \InvalidArgumentException('Invalid CardId');

        return new self($v);

    }

    public function toString(): string { return $this->value; }

}
<?php

// app/Contexts/DigitalCard/Domain/ValueObjects/MemberId.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

use Ramsey\Uuid\Uuid;

final class MemberId

{

    private function __construct(private string $value) {}

    public static function fromString(string $v): self {

        if (!Uuid::isValid($v)) throw new \InvalidArgumentException('Invalid MemberId');

        return new self($v);

    }

    public function toString(): string { return $this->value; }

}
<?php

// app/Contexts/DigitalCard/Domain/ValueObjects/QRCode.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

final class QRCode

{

    private function __construct(private string $value) {}

    public static function fromString(string $v): self {

        if ($v === '') throw new \InvalidArgumentException('QR code cannot be empty');

        return new self($v);

    }

    public function toString(): string { return $this->value; }

}
3.3 Entity (Aggregate Root)
<?php

// app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Entities;

use App\Contexts\DigitalCard\Domain\Enums\CardStatus;

use App\Contexts\DigitalCard\Domain\Events\CardActivated;

use App\Contexts\DigitalCard\Domain\Events\CardExpired;

use App\Contexts\DigitalCard\Domain\Events\CardIssued;

use App\Contexts\DigitalCard\Domain\Events\CardRevoked;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

final class DigitalCard

{

    private array $events = [];

    private function __construct(

        private CardId $cardId,

        private MemberId $memberId,

        private QRCode $qrCode,

        private \DateTimeImmutable $issuedAt,

        private \DateTimeImmutable $expiresAt,

        private CardStatus $status = CardStatus::Issued,

        private ?\DateTimeImmutable $activatedAt = null,

        private ?\DateTimeImmutable $revokedAt = null,

    ) {}

    /** Factory */

    public static function issue(

        CardId $cardId,

        MemberId $memberId,

        QRCode $qrCode,

        \DateTimeImmutable $issuedAt,

        \DateTimeImmutable $expiresAt

    ): self {

        if ($expiresAt < $issuedAt) {

            throw new \InvalidArgumentException('Expiry must be after issue date');

        }

        $self = new self($cardId, $memberId, $qrCode, $issuedAt, $expiresAt, CardStatus::Issued);

        $self->record(new CardIssued($cardId->toString(), $memberId->toString(), $issuedAt, $expiresAt));

        return $self;

    }

    public function activate(\DateTimeImmutable $at): void

    {

        if (!$this->status->is(CardStatus::Issued)) {

            throw new \DomainException('Only issued cards can be activated');

        }

        $this->status = CardStatus::Active;

        $this->activatedAt = $at;

        $this->record(new CardActivated($this->cardId->toString(), $at));

    }

    public function revoke(string $reason, \DateTimeImmutable $at): void

    {

        if (!in_array($this->status, [CardStatus::Issued, CardStatus::Active], true)) {

            throw new \DomainException('Only issued or active cards can be revoked');

        }

        $this->status = CardStatus::Revoked;

        $this->revokedAt = $at;

        $this->record(new CardRevoked($this->cardId->toString(), $reason, $at));

    }

    public function tick(\DateTimeImmutable $now): void

    {

        if ($this->status === CardStatus::Active && $now >= $this->expiresAt) {

            $this->status = CardStatus::Expired;

            $this->record(new CardExpired($this->cardId->toString(), $now));

        }

    }

    /** Events */

    private function record(object $event): void { $this->events[] = $event; }

    public function releaseEvents(): array { $out = $this->events; $this->events = []; return $out; }

    /** Getters */

    public function id(): CardId { return $this->cardId; }

    public function memberId(): MemberId { return $this->memberId; }

    public function qrCode(): QRCode { return $this->qrCode; }

    public function issuedAt(): \DateTimeImmutable { return $this->issuedAt; }

    public function expiresAt(): \DateTimeImmutable { return $this->expiresAt; }

    public function status(): CardStatus { return $this->status; }

}
3.4 Domain Events
<?php

// app/Contexts/DigitalCard/Domain/Events/CardIssued.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Events;

final class CardIssued {

    public function __construct(

        public readonly string $cardId,

        public readonly string $memberId,

        public readonly \DateTimeImmutable $issuedAt,

        public readonly \DateTimeImmutable $expiresAt

    ) {}

}

(Repeat similarly for CardActivated, CardRevoked, CardExpired.)
3.5 Domain Services (interfaces)
<?php

// app/Contexts/DigitalCard/Domain/Services/CardIssuanceService.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Services;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

interface CardIssuanceService

{

    public function issue(CardId $id, MemberId $memberId, QRCode $qr, \DateTimeImmutable $issuedAt, \DateTimeImmutable $expiresAt): DigitalCard;

}

(Interfaces also for CardValidationService, CardRevocationService as needed. We’ll implement in Application/Handlers via repository + generators.)
3.6 Repository Interface
<?php

// app/Contexts/DigitalCard/Domain/Repositories/DigitalCardRepository.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Repositories;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

interface DigitalCardRepository

{

    public function byId(CardId $id): ?DigitalCard;

    public function byMember(MemberId $memberId): array; // historical cards

    public function save(DigitalCard $card): void;

}
4) Application Layer
4.1 DTO + Commands
<?php

// app/Contexts/DigitalCard/Application/DTOs/CardDTO.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\DTOs;

final class CardDTO

{

    public function __construct(

        public readonly string $card_id,

        public readonly string $member_id,

        public readonly string $status,

        public readonly string $issued_at,

        public readonly string $expires_at,

        public readonly string $qrcode

    ) {}

}
<?php

// app/Contexts/DigitalCard/Application/Commands/IssueCardCommand.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Commands;

final class IssueCardCommand

{

    public function __construct(

        public readonly string $memberId,

        public readonly ?string $expiresAtIso8601 = null

    ) {}

}

(Similar command classes for ActivateCardCommand, RevokeCardCommand.)
4.2 Handlers (Orchestrate domain + repo + services)
<?php

// app/Contexts/DigitalCard/Application/Handlers/IssueCardHandler.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;

use App\Contexts\DigitalCard\Application\DTOs\CardDTO;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;

use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

final class IssueCardHandler

{

    public function __construct(

        private readonly DigitalCardRepository $repo,

        private readonly \DateTimeZone $tz,

        private readonly \DateTimeInterface $clockNowProvider, // can be LaravelClock

        private readonly \Closure $qrGenerator // fn(string $cardId): string

    ) {}

    public function handle(IssueCardCommand $cmd): CardDTO

    {

        $now = new \DateTimeImmutable($this->clockNowProvider->format(\DateTimeInterface::ATOM));

        $expires = $cmd->expiresAtIso8601

            ? new \DateTimeImmutable($cmd->expiresAtIso8601)

            : $now->modify('+1 year');

        $cardId = CardId::new();

        $qrStr  = ($this->qrGenerator)($cardId->toString());

        $aggregate = DigitalCard::issue(

            $cardId,

            MemberId::fromString($cmd->memberId),

            QRCode::fromString($qrStr),

            $now,

            $expires

        );

        // NOTE: enforce one active/issued card per member at domain layer or via app policy

        $this->repo->save($aggregate);

        return new CardDTO(

            $aggregate->id()->toString(),

            $aggregate->memberId()->toString(),

            $aggregate->status()->value,

            $aggregate->issuedAt()->format(\DateTimeInterface::ATOM),

            $aggregate->expiresAt()->format(\DateTimeInterface::ATOM),

            $aggregate->qrCode()->toString(),

        );

    }

}

(Provide analogous ActivateCardHandler, RevokeCardHandler.)
5) Infrastructure
5.1 Eloquent Persistence
Migration (Tenant DB)
Place under your tenant migrations path; adjust namespace/paths to your tenancy bootstrapping. No raw SQL.
<?php

// database/migrations/tenant/2025_01_01_000000_create_digital_cards_table.php

use Illuminate\Database\Migrations\Migration;

use Illuminate\Database\Schema\Blueprint;

use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    public function up(): void

    {

        Schema::create('digital_cards', function (Blueprint $table) {

            $table->uuid('id')->primary();

            $table->uuid('member_id')->index();

            $table->string('status', 20)->index(); // issued|active|revoked|expired

            $table->text('qrcode');

            $table->timestampTz('issued_at');

            $table->timestampTz('expires_at');

            $table->timestampTz('activated_at')->nullable();

            $table->timestampTz('revoked_at')->nullable();

            $table->timestamps();

            // NOTE: partial unique for one active card per member would require raw SQL (prohibited).

            // Enforce via domain/application policy + transaction.

        });

    }

    public function down(): void { Schema::dropIfExists('digital_cards'); }

};
Eloquent Model
<?php

// app/Contexts/DigitalCard/Infrastructure/Persistence/Eloquent/EloquentDigitalCard.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;

final class EloquentDigitalCard extends Model

{

    protected $table = 'digital_cards';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $casts = [

        'issued_at'   => 'immutable_datetime',

        'expires_at'  => 'immutable_datetime',

        'activated_at'=> 'immutable_datetime',

        'revoked_at'  => 'immutable_datetime',

    ];

}
Repository Implementation
<?php

// app/Contexts/DigitalCard/Infrastructure/Persistence/EloquentDigitalCardRepository.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Persistence;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard as Aggregate;

use App\Contexts\DigitalCard\Domain\Enums\CardStatus;

use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

use App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent\EloquentDigitalCard;

use Illuminate\Support\Facades\DB;

final class EloquentDigitalCardRepository implements DigitalCardRepository

{

    public function byId(CardId $id): ?Aggregate

    {

        $row = EloquentDigitalCard::query()->find($id->toString());

        return $row ? $this->toAggregate($row) : null;

    }

    public function byMember(MemberId $memberId): array

    {

        return EloquentDigitalCard::query()

            ->where('member_id', $memberId->toString())

            ->orderByDesc('issued_at')

            ->get()

            ->map(fn($r) => $this->toAggregate($r))

            ->all();

    }

    public function save(Aggregate $card): void

    {

        DB::transaction(function () use ($card) {

            $row = EloquentDigitalCard::query()->find($card->id()->toString()) ?? new EloquentDigitalCard(['id' => $card->id()->toString()]);

            $row->member_id   = $card->memberId()->toString();

            $row->qrcode      = $card->qrCode()->toString();

            $row->status      = $card->status()->value;

            $row->issued_at   = $card->issuedAt();

            $row->expires_at  = $card->expiresAt();

            $row->save();

            // Dispatch domain events to Laravel events bus, if you map them externally.

            foreach ($card->releaseEvents() as $event) {

                event($event);

            }

        });

    }

    private function toAggregate(EloquentDigitalCard $row): Aggregate

    {

        // Rehydrate with current status; activated_at/revoked_at not strictly required by domain getters

        $agg = new \ReflectionClass(Aggregate::class);

        $ctor = $agg->getConstructor();

        $ctor->setAccessible(true);

        /** @var Aggregate $entity */

        $entity = $agg->newInstanceWithoutConstructor();

        $ctor->invoke($entity,

            CardId::fromString($row->getKey()),

            MemberId::fromString($row->member_id),

            QRCode::fromString($row->qrcode),

            new \DateTimeImmutable($row->issued_at->format(\DateTimeInterface::ATOM)),

            new \DateTimeImmutable($row->expires_at->format(\DateTimeInterface::ATOM)),

            CardStatus::from($row->status),

            $row->activated_at ? new \DateTimeImmutable($row->activated_at->format(\DateTimeInterface::ATOM)) : null,

            $row->revoked_at ? new \DateTimeImmutable($row->revoked_at->format(\DateTimeInterface::ATOM)) : null,

        );

        return $entity;

    }

}
Tenant switching: this repository assumes the tenant connection is already active via your middleware/kernel (per your existing multi-tenancy). No cross-tenant access.
5.2 HTTP Delivery (Controllers, Requests, Resources)
Controller
<?php

// app/Contexts/DigitalCard/Infrastructure/Http/Controllers/DigitalCardController.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Http\Controllers;

use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;

use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;

use App\Contexts\DigitalCard\Infrastructure\Http\Requests\IssueCardRequest;

use App\Contexts\DigitalCard\Infrastructure\Http\Resources\DigitalCardResource;

use Illuminate\Routing\Controller as BaseController;

use Symfony\Component\HttpFoundation\Response;

final class DigitalCardController extends BaseController

{

    public function __construct(

        private readonly IssueCardHandler $issueCardHandler,

    ) {}

    public function store(IssueCardRequest $request)

    {

        $dto = $this->issueCardHandler->handle(

            new IssueCardCommand(

                memberId: $request->string('member_id'),

                expiresAtIso8601: $request->string('expires_at') ?: null

            )

        );

        return (new DigitalCardResource($dto))

            ->response()

            ->setStatusCode(Response::HTTP_CREATED);

    }

}
Requests
<?php

// app/Contexts/DigitalCard/Infrastructure/Http/Requests/IssueCardRequest.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class IssueCardRequest extends FormRequest

{

    public function authorize(): bool

    {

        // integrate your policy/permissions here (platform/tenant admin)

        return true;

    }

    public function rules(): array

    {

        return [

            'member_id'  => ['required','uuid'],

            'expires_at' => ['nullable','date'],

        ];

    }

}
Resource
<?php

// app/Contexts/DigitalCard/Infrastructure/Http/Resources/DigitalCardResource.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read \App\Contexts\DigitalCard\Application\DTOs\CardDTO $resource */

final class DigitalCardResource extends JsonResource

{

    public function toArray($request): array

    {

        return [

            'card_id'   => $this->resource->card_id,

            'member_id' => $this->resource->member_id,

            'status'    => $this->resource->status,

            'issued_at' => $this->resource->issued_at,

            'expires_at'=> $this->resource->expires_at,

            'qrcode'    => $this->resource->qrcode,

        ];

    }

}
5.3 Services (Clock + QR Code)
<?php

// app/Contexts/DigitalCard/Infrastructure/Services/LaravelClock.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Services;

final class LaravelClock extends \DateTimeImmutable implements \DateTimeInterface

{

    public function __construct()

    {

        parent::__construct('now');

    }

}
<?php

// app/Contexts/DigitalCard/Infrastructure/Services/SimpleQRCodeGenerator.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Services;

final class SimpleQRCodeGenerator

{

    public function __invoke(string $cardId): string

    {

        // Replace with real QR code generator integration.

        return 'qr:card:' . $cardId;

    }

}
5.4 Service Provider (Bindings)
<?php

// app/Contexts/DigitalCard/Infrastructure/Providers/DigitalCardServiceProvider.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Providers;

use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;

use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;

use App\Contexts\DigitalCard\Infrastructure\Persistence\EloquentDigitalCardRepository;

use App\Contexts\DigitalCard\Infrastructure\Services\LaravelClock;

use App\Contexts\DigitalCard\Infrastructure\Services\SimpleQRCodeGenerator;

use Illuminate\Support\ServiceProvider;

final class DigitalCardServiceProvider extends ServiceProvider

{

    public function register(): void

    {

        $this->app->bind(DigitalCardRepository::class, EloquentDigitalCardRepository::class);

        // Clock and QR generator

        $this->app->bind(\DateTimeInterface::class, LaravelClock::class);

        $this->app->bind('digitalcard.qr', fn() => new SimpleQRCodeGenerator());

        // Handlers

        $this->app->bind(IssueCardHandler::class, function ($app) {

            return new IssueCardHandler(

                repo: $app->make(DigitalCardRepository::class),

                tz: new \DateTimeZone(config('app.timezone')),

                clockNowProvider: $app->make(\DateTimeInterface::class),

                qrGenerator: $app->make('digitalcard.qr'),

            );

        });

    }

    public function boot(): void {}

}

After code is placed, register the provider (if you don’t auto-discover in your app): add to config/app.php providers list. (You can queue this change for approval to respect “no unapproved changes”.)
6) Routing Stubs (respecting 6-case model)
Reminder: Do NOT modify existing route files without approval. Provide the following new route files and wire them via your RouteServiceProvider where your 6-case is already defined.
Desktop Admin API (/{tenant}/api/v1/cards/*)
<?php

// routes/tenant/api.digitalcard.php

use App\Contexts\DigitalCard\Infrastructure\Http\Controllers\DigitalCardController;

use Illuminate\Support\Facades\Route;

Route::prefix('{tenant}/api/v1')

    ->middleware([

        'tenant.resolve', // your existing tenant resolver

        'auth',           // your desktop/admin guard

        'verified',       // if applicable

    ])

    ->group(function () {

        Route::post('/cards', [DigitalCardController::class, 'store']); // Issue

        // Route::post('/cards/{card}/activate', ...);

        // Route::post('/cards/{card}/revoke', ...);

        // Route::get('/cards/{card}', ...);

    });
Mobile API (/{tenant}/mapi/v1/cards/*)
<?php

// routes/tenant/mapi.digitalcard.php

use App\Contexts\DigitalCard\Infrastructure\Http\Controllers\DigitalCardController;

use Illuminate\Support\Facades\Route;

Route::prefix('{tenant}/mapi/v1')

    ->middleware([

        'tenant.resolve',

        'auth:sanctum',   // stateless tokens (mobile)

    ])

    ->group(function () {

        Route::post('/cards', [DigitalCardController::class, 'store']); // Issue (if allowed on mobile)

        // Typically mobile would validate/show rather than issue.

        // Route::get('/cards/{card}', ...); // show/validate

    });

Per your charter: Angular Mobile → /mapi/* ONLY, Vue Desktop → /api/* ONLY, tenant slug mandatory, and Tenant SPA catch‑all last. These stubs comply.
7) README (Context-local)
# DigitalCardContext

Purpose: Lifecycle of digital membership cards (issue, activate, revoke, validate).

## Layers

- Domain: Entities, VOs, Events, Repository interface.

- Application: Commands/Handlers returning DTOs.

- Infrastructure: Eloquent repo, HTTP delivery, services.

## Multi-tenancy

- Data lives in Tenant DB only. Repository assumes tenant connection is already active via existing middleware.

## Security

- Desktop routes guarded by `auth`; Mobile routes by `auth:sanctum`.

- No cross-tenant access; tenant slug always in URL.

## Tests

- Run `php artisan test --testsuite=unit` and `--testsuite=feature`.

- Maintain ≥ 80% coverage.

## Open TODOs

- Implement Activate/Revoke handlers + routes.

- Enforce “one active card per member” via domain guard + repo transaction.

- Wire route files into your 6-case RouteServiceProvider (after approval).
8) What I can generate next
Activate/Revoke/Validate handlers & controller actions
Mermaid diagrams + sequence diagrams (issue/activate flows)
Policy/Permission integration (Gate/Policies)
Event subscribers to notify Membership on issue/revoke
E2E tests for mobile login → tenant select → card show/validate

Would you like me to add Activate/Revoke endpoints + tests, or produce a Mermaid sequence diagram for IssueCard across layers next?
 
Awesome—here’s a code-ready Laravel scaffolding for the DigitalCardContext that respects your DDD/TDD constraints, 6‑case routing, Sanctum for mobile, and strict tenant isolation.
Notes up-front (per your charter):
No refactors to existing packages or route files are performed.

All new files are self-contained under app/Contexts/DigitalCard/ + tests/Contexts/DigitalCard/.
Tenant DB only for card data.
TDD-first: tests are provided before implementation stubs.

1) Directory Layout
app/Contexts/DigitalCard/

├── Application/

│   ├── Commands/

│   │   ├── ActivateCardCommand.php

│   │   ├── IssueCardCommand.php

│   │   └── RevokeCardCommand.php

│   ├── Handlers/

│   │   ├── ActivateCardHandler.php

│   │   ├── IssueCardHandler.php

│   │   └── RevokeCardHandler.php

│   └── DTOs/

│       └── CardDTO.php

├── Domain/

│   ├── Entities/DigitalCard.php

│   ├── Enums/CardStatus.php

│   ├── Events/

│   │   ├── CardActivated.php

│   │   ├── CardExpired.php

│   │   ├── CardIssued.php

│   │   └── CardRevoked.php

│   ├── Repositories/DigitalCardRepository.php

│   ├── Services/

│   │   ├── CardIssuanceService.php

│   │   ├── CardRevocationService.php

│   │   └── CardValidationService.php

│   └── ValueObjects/

│       ├── CardId.php

│       ├── MemberId.php

│       └── QRCode.php

├── Infrastructure/

│   ├── Http/

│   │   ├── Controllers/

│   │   │   └── DigitalCardController.php

│   │   ├── Requests/

│   │   │   ├── ActivateCardRequest.php

│   │   │   ├── IssueCardRequest.php

│   │   │   └── RevokeCardRequest.php

│   │   └── Resources/

│   │       └── DigitalCardResource.php

│   ├── Persistence/

│   │   ├── Eloquent/

│   │   │   └── EloquentDigitalCard.php

│   │   └── EloquentDigitalCardRepository.php

│   ├── Providers/DigitalCardServiceProvider.php

│   └── Services/

│       ├── LaravelClock.php

│       └── SimpleQRCodeGenerator.php

└── README.md
Routes (stubs, not wired yet):

routes/tenant/api.digitalcard.php   # Vue Desktop → /{tenant}/api/v1/cards/*

routes/tenant/mapi.digitalcard.php  # Angular Mobile → /{tenant}/mapi/v1/cards/*
Migrations (Tenant DB):

database/migrations/tenant/2025_01_01_000000_create_digital_cards_table.php
Tests (TDD-first):

tests/Contexts/DigitalCard/Domain/DigitalCardTest.php

tests/Contexts/DigitalCard/Feature/IssueCardFeatureTest.php
2) Tests First (TDD)
2.1 Domain tests
<?php

// tests/Contexts/DigitalCard/Domain/DigitalCardTest.php

declare(strict_types=1);

namespace Tests\Contexts\DigitalCard\Domain;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;

use App\Contexts\DigitalCard\Domain\Enums\CardStatus;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

use PHPUnit\Framework\TestCase;

final class DigitalCardTest extends TestCase

{

    public function test_issue_card_and_activate(): void

    {

        $card = DigitalCard::issue(

            CardId::new(),

            MemberId::fromString('5a92f95c-6d1a-4edb-9f2f-2b3a1f3cbe10'),

            QRCode::fromString('qr:dummy'),

            new \DateTimeImmutable('2025-01-01T00:00:00Z'),

            new \DateTimeImmutable('2026-01-01T00:00:00Z')

        );

        $this->assertTrue($card->status()->is(CardStatus::Issued));

        $card->activate(new \DateTimeImmutable('2025-01-02T00:00:00Z'));

        $this->assertTrue($card->status()->is(CardStatus::Active));

    }

    public function test_invalid_expiry_fails(): void

    {

        $this->expectException(\InvalidArgumentException::class);

        DigitalCard::issue(

            CardId::new(),

            MemberId::fromString('5a92f95c-6d1a-4edb-9f2f-2b3a1f3cbe10'),

            QRCode::fromString('qr:x'),

            new \DateTimeImmutable('2025-01-05T00:00:00Z'),

            new \DateTimeImmutable('2025-01-01T00:00:00Z')

        );

    }

    public function test_revoke_only_from_active_or_issued(): void

    {

        $card = DigitalCard::issue(

            CardId::new(),

            MemberId::fromString('cafecafe-6d1a-4edb-9f2f-2b3a1f3cbe10'),

            QRCode::fromString('qr:y'),

            new \DateTimeImmutable('2025-01-01T00:00:00Z'),

            new \DateTimeImmutable('2026-01-01T00:00:00Z')

        );

        $card->activate(new \DateTimeImmutable('2025-01-02T00:00:00Z'));

        $card->revoke('membership_ended', new \DateTimeImmutable('2025-06-01T00:00:00Z'));

        $this->assertTrue($card->status()->is(CardStatus::Revoked));

    }

}
2.2 Feature test (Issue via Desktop API)
<?php

// tests/Contexts/DigitalCard/Feature/IssueCardFeatureTest.php

declare(strict_types=1);

namespace Tests\Contexts\DigitalCard\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;

use Tests\TestCase;

final class IssueCardFeatureTest extends TestCase

{

    use RefreshDatabase;

    protected function setUp(): void

    {

        parent::setUp();

        // If your test suite provides helpers for tenant bootstrapping, call them here:

        // $this->bootstrapTenant('example-tenant');  // e.g. sets current tenant & switches DB

    }

    public function test_issue_card_desktop_api(): void

    {

        // actingAs platform/tenant admin user as per your guards

        // $user = User::factory()->create([...]);

        // $this->actingAs($user);

        $tenant = 'example-tenant';

        $payload = [

            'member_id' => '5a92f95c-6d1a-4edb-9f2f-2b3a1f3cbe10',

            'expires_at' => '2026-01-01T00:00:00Z',

        ];

        $resp = $this->postJson("/{$tenant}/api/v1/cards", $payload);

        $resp->assertCreated()

             ->assertJsonStructure(['data' => ['card_id','member_id','status','issued_at','expires_at','qrcode']]);

    }

}

Adjust tenant bootstrap & auth snippets to match your test harness (you likely have helpers in TenantAuth/Shared).
3) Domain Layer
3.1 Enums
<?php

// app/Contexts/DigitalCard/Domain/Enums/CardStatus.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Enums;

enum CardStatus: string

{

    case Issued = 'issued';

    case Active = 'active';

    case Revoked = 'revoked';

    case Expired = 'expired';

    public function is(self $status): bool { return $this === $status; }

}
3.2 Value Objects
<?php

// app/Contexts/DigitalCard/Domain/ValueObjects/CardId.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

use Ramsey\Uuid\Uuid;

final class CardId

{

    private function __construct(private string $value) {}

    public static function new(): self { return new self(Uuid::uuid4()->toString()); }

    public static function fromString(string $v): self {

        if (!Uuid::isValid($v)) throw new \InvalidArgumentException('Invalid CardId');

        return new self($v);

    }

    public function toString(): string { return $this->value; }

}
<?php

// app/Contexts/DigitalCard/Domain/ValueObjects/MemberId.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

use Ramsey\Uuid\Uuid;

final class MemberId

{

    private function __construct(private string $value) {}

    public static function fromString(string $v): self {

        if (!Uuid::isValid($v)) throw new \InvalidArgumentException('Invalid MemberId');

        return new self($v);

    }

    public function toString(): string { return $this->value; }

}
<?php

// app/Contexts/DigitalCard/Domain/ValueObjects/QRCode.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\ValueObjects;

final class QRCode

{

    private function __construct(private string $value) {}

    public static function fromString(string $v): self {

        if ($v === '') throw new \InvalidArgumentException('QR code cannot be empty');

        return new self($v);

    }

    public function toString(): string { return $this->value; }

}
3.3 Entity (Aggregate Root)
<?php

// app/Contexts/DigitalCard/Domain/Entities/DigitalCard.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Entities;

use App\Contexts\DigitalCard\Domain\Enums\CardStatus;

use App\Contexts\DigitalCard\Domain\Events\CardActivated;

use App\Contexts\DigitalCard\Domain\Events\CardExpired;

use App\Contexts\DigitalCard\Domain\Events\CardIssued;

use App\Contexts\DigitalCard\Domain\Events\CardRevoked;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

final class DigitalCard

{

    private array $events = [];

    private function __construct(

        private CardId $cardId,

        private MemberId $memberId,

        private QRCode $qrCode,

        private \DateTimeImmutable $issuedAt,

        private \DateTimeImmutable $expiresAt,

        private CardStatus $status = CardStatus::Issued,

        private ?\DateTimeImmutable $activatedAt = null,

        private ?\DateTimeImmutable $revokedAt = null,

    ) {}

    /** Factory */

    public static function issue(

        CardId $cardId,

        MemberId $memberId,

        QRCode $qrCode,

        \DateTimeImmutable $issuedAt,

        \DateTimeImmutable $expiresAt

    ): self {

        if ($expiresAt < $issuedAt) {

            throw new \InvalidArgumentException('Expiry must be after issue date');

        }

        $self = new self($cardId, $memberId, $qrCode, $issuedAt, $expiresAt, CardStatus::Issued);

        $self->record(new CardIssued($cardId->toString(), $memberId->toString(), $issuedAt, $expiresAt));

        return $self;

    }

    public function activate(\DateTimeImmutable $at): void

    {

        if (!$this->status->is(CardStatus::Issued)) {

            throw new \DomainException('Only issued cards can be activated');

        }

        $this->status = CardStatus::Active;

        $this->activatedAt = $at;

        $this->record(new CardActivated($this->cardId->toString(), $at));

    }

    public function revoke(string $reason, \DateTimeImmutable $at): void

    {

        if (!in_array($this->status, [CardStatus::Issued, CardStatus::Active], true)) {

            throw new \DomainException('Only issued or active cards can be revoked');

        }

        $this->status = CardStatus::Revoked;

        $this->revokedAt = $at;

        $this->record(new CardRevoked($this->cardId->toString(), $reason, $at));

    }

    public function tick(\DateTimeImmutable $now): void

    {

        if ($this->status === CardStatus::Active && $now >= $this->expiresAt) {

            $this->status = CardStatus::Expired;

            $this->record(new CardExpired($this->cardId->toString(), $now));

        }

    }

    /** Events */

    private function record(object $event): void { $this->events[] = $event; }

    public function releaseEvents(): array { $out = $this->events; $this->events = []; return $out; }

    /** Getters */

    public function id(): CardId { return $this->cardId; }

    public function memberId(): MemberId { return $this->memberId; }

    public function qrCode(): QRCode { return $this->qrCode; }

    public function issuedAt(): \DateTimeImmutable { return $this->issuedAt; }

    public function expiresAt(): \DateTimeImmutable { return $this->expiresAt; }

    public function status(): CardStatus { return $this->status; }

}
3.4 Domain Events
<?php

// app/Contexts/DigitalCard/Domain/Events/CardIssued.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Events;

final class CardIssued {

    public function __construct(

        public readonly string $cardId,

        public readonly string $memberId,

        public readonly \DateTimeImmutable $issuedAt,

        public readonly \DateTimeImmutable $expiresAt

    ) {}

}

(Repeat similarly for CardActivated, CardRevoked, CardExpired.)
3.5 Domain Services (interfaces)
<?php

// app/Contexts/DigitalCard/Domain/Services/CardIssuanceService.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Services;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

interface CardIssuanceService

{

    public function issue(CardId $id, MemberId $memberId, QRCode $qr, \DateTimeImmutable $issuedAt, \DateTimeImmutable $expiresAt): DigitalCard;

}

(Interfaces also for CardValidationService, CardRevocationService as needed. We’ll implement in Application/Handlers via repository + generators.)
3.6 Repository Interface
<?php

// app/Contexts/DigitalCard/Domain/Repositories/DigitalCardRepository.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Domain\Repositories;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

interface DigitalCardRepository

{

    public function byId(CardId $id): ?DigitalCard;

    public function byMember(MemberId $memberId): array; // historical cards

    public function save(DigitalCard $card): void;

}
4) Application Layer
4.1 DTO + Commands
<?php

// app/Contexts/DigitalCard/Application/DTOs/CardDTO.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\DTOs;

final class CardDTO

{

    public function __construct(

        public readonly string $card_id,

        public readonly string $member_id,

        public readonly string $status,

        public readonly string $issued_at,

        public readonly string $expires_at,

        public readonly string $qrcode

    ) {}

}
<?php

// app/Contexts/DigitalCard/Application/Commands/IssueCardCommand.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Commands;

final class IssueCardCommand

{

    public function __construct(

        public readonly string $memberId,

        public readonly ?string $expiresAtIso8601 = null

    ) {}

}

(Similar command classes for ActivateCardCommand, RevokeCardCommand.)
4.2 Handlers (Orchestrate domain + repo + services)
<?php

// app/Contexts/DigitalCard/Application/Handlers/IssueCardHandler.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Application\Handlers;

use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;

use App\Contexts\DigitalCard\Application\DTOs\CardDTO;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;

use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

final class IssueCardHandler

{

    public function __construct(

        private readonly DigitalCardRepository $repo,

        private readonly \DateTimeZone $tz,

        private readonly \DateTimeInterface $clockNowProvider, // can be LaravelClock

        private readonly \Closure $qrGenerator // fn(string $cardId): string

    ) {}

    public function handle(IssueCardCommand $cmd): CardDTO

    {

        $now = new \DateTimeImmutable($this->clockNowProvider->format(\DateTimeInterface::ATOM));

        $expires = $cmd->expiresAtIso8601

            ? new \DateTimeImmutable($cmd->expiresAtIso8601)

            : $now->modify('+1 year');

        $cardId = CardId::new();

        $qrStr  = ($this->qrGenerator)($cardId->toString());

        $aggregate = DigitalCard::issue(

            $cardId,

            MemberId::fromString($cmd->memberId),

            QRCode::fromString($qrStr),

            $now,

            $expires

        );

        // NOTE: enforce one active/issued card per member at domain layer or via app policy

        $this->repo->save($aggregate);

        return new CardDTO(

            $aggregate->id()->toString(),

            $aggregate->memberId()->toString(),

            $aggregate->status()->value,

            $aggregate->issuedAt()->format(\DateTimeInterface::ATOM),

            $aggregate->expiresAt()->format(\DateTimeInterface::ATOM),

            $aggregate->qrCode()->toString(),

        );

    }

}

(Provide analogous ActivateCardHandler, RevokeCardHandler.)
5) Infrastructure
5.1 Eloquent Persistence
Migration (Tenant DB)
Place under your tenant migrations path; adjust namespace/paths to your tenancy bootstrapping. No raw SQL.
<?php

// database/migrations/tenant/2025_01_01_000000_create_digital_cards_table.php

use Illuminate\Database\Migrations\Migration;

use Illuminate\Database\Schema\Blueprint;

use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    public function up(): void

    {

        Schema::create('digital_cards', function (Blueprint $table) {

            $table->uuid('id')->primary();

            $table->uuid('member_id')->index();

            $table->string('status', 20)->index(); // issued|active|revoked|expired

            $table->text('qrcode');

            $table->timestampTz('issued_at');

            $table->timestampTz('expires_at');

            $table->timestampTz('activated_at')->nullable();

            $table->timestampTz('revoked_at')->nullable();

            $table->timestamps();

            // NOTE: partial unique for one active card per member would require raw SQL (prohibited).

            // Enforce via domain/application policy + transaction.

        });

    }

    public function down(): void { Schema::dropIfExists('digital_cards'); }

};
Eloquent Model
<?php

// app/Contexts/DigitalCard/Infrastructure/Persistence/Eloquent/EloquentDigitalCard.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;

final class EloquentDigitalCard extends Model

{

    protected $table = 'digital_cards';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $casts = [

        'issued_at'   => 'immutable_datetime',

        'expires_at'  => 'immutable_datetime',

        'activated_at'=> 'immutable_datetime',

        'revoked_at'  => 'immutable_datetime',

    ];

}
Repository Implementation
<?php

// app/Contexts/DigitalCard/Infrastructure/Persistence/EloquentDigitalCardRepository.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Persistence;

use App\Contexts\DigitalCard\Domain\Entities\DigitalCard as Aggregate;

use App\Contexts\DigitalCard\Domain\Enums\CardStatus;

use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;

use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;

use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;

use App\Contexts\DigitalCard\Domain\ValueObjects\QRCode;

use App\Contexts\DigitalCard\Infrastructure\Persistence\Eloquent\EloquentDigitalCard;

use Illuminate\Support\Facades\DB;

final class EloquentDigitalCardRepository implements DigitalCardRepository

{

    public function byId(CardId $id): ?Aggregate

    {

        $row = EloquentDigitalCard::query()->find($id->toString());

        return $row ? $this->toAggregate($row) : null;

    }

    public function byMember(MemberId $memberId): array

    {

        return EloquentDigitalCard::query()

            ->where('member_id', $memberId->toString())

            ->orderByDesc('issued_at')

            ->get()

            ->map(fn($r) => $this->toAggregate($r))

            ->all();

    }

    public function save(Aggregate $card): void

    {

        DB::transaction(function () use ($card) {

            $row = EloquentDigitalCard::query()->find($card->id()->toString()) ?? new EloquentDigitalCard(['id' => $card->id()->toString()]);

            $row->member_id   = $card->memberId()->toString();

            $row->qrcode      = $card->qrCode()->toString();

            $row->status      = $card->status()->value;

            $row->issued_at   = $card->issuedAt();

            $row->expires_at  = $card->expiresAt();

            $row->save();

            // Dispatch domain events to Laravel events bus, if you map them externally.

            foreach ($card->releaseEvents() as $event) {

                event($event);

            }

        });

    }

    private function toAggregate(EloquentDigitalCard $row): Aggregate

    {

        // Rehydrate with current status; activated_at/revoked_at not strictly required by domain getters

        $agg = new \ReflectionClass(Aggregate::class);

        $ctor = $agg->getConstructor();

        $ctor->setAccessible(true);

        /** @var Aggregate $entity */

        $entity = $agg->newInstanceWithoutConstructor();

        $ctor->invoke($entity,

            CardId::fromString($row->getKey()),

            MemberId::fromString($row->member_id),

            QRCode::fromString($row->qrcode),

            new \DateTimeImmutable($row->issued_at->format(\DateTimeInterface::ATOM)),

            new \DateTimeImmutable($row->expires_at->format(\DateTimeInterface::ATOM)),

            CardStatus::from($row->status),

            $row->activated_at ? new \DateTimeImmutable($row->activated_at->format(\DateTimeInterface::ATOM)) : null,

            $row->revoked_at ? new \DateTimeImmutable($row->revoked_at->format(\DateTimeInterface::ATOM)) : null,

        );

        return $entity;

    }

}
Tenant switching: this repository assumes the tenant connection is already active via your middleware/kernel (per your existing multi-tenancy). No cross-tenant access.
5.2 HTTP Delivery (Controllers, Requests, Resources)
Controller
<?php

// app/Contexts/DigitalCard/Infrastructure/Http/Controllers/DigitalCardController.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Http\Controllers;

use App\Contexts\DigitalCard\Application\Commands\IssueCardCommand;

use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;

use App\Contexts\DigitalCard\Infrastructure\Http\Requests\IssueCardRequest;

use App\Contexts\DigitalCard\Infrastructure\Http\Resources\DigitalCardResource;

use Illuminate\Routing\Controller as BaseController;

use Symfony\Component\HttpFoundation\Response;

final class DigitalCardController extends BaseController

{

    public function __construct(

        private readonly IssueCardHandler $issueCardHandler,

    ) {}

    public function store(IssueCardRequest $request)

    {

        $dto = $this->issueCardHandler->handle(

            new IssueCardCommand(

                memberId: $request->string('member_id'),

                expiresAtIso8601: $request->string('expires_at') ?: null

            )

        );

        return (new DigitalCardResource($dto))

            ->response()

            ->setStatusCode(Response::HTTP_CREATED);

    }

}
Requests
<?php

// app/Contexts/DigitalCard/Infrastructure/Http/Requests/IssueCardRequest.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class IssueCardRequest extends FormRequest

{

    public function authorize(): bool

    {

        // integrate your policy/permissions here (platform/tenant admin)

        return true;

    }

    public function rules(): array

    {

        return [

            'member_id'  => ['required','uuid'],

            'expires_at' => ['nullable','date'],

        ];

    }

}
Resource
<?php

// app/Contexts/DigitalCard/Infrastructure/Http/Resources/DigitalCardResource.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read \App\Contexts\DigitalCard\Application\DTOs\CardDTO $resource */

final class DigitalCardResource extends JsonResource

{

    public function toArray($request): array

    {

        return [

            'card_id'   => $this->resource->card_id,

            'member_id' => $this->resource->member_id,

            'status'    => $this->resource->status,

            'issued_at' => $this->resource->issued_at,

            'expires_at'=> $this->resource->expires_at,

            'qrcode'    => $this->resource->qrcode,

        ];

    }

}
5.3 Services (Clock + QR Code)
<?php

// app/Contexts/DigitalCard/Infrastructure/Services/LaravelClock.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Services;

final class LaravelClock extends \DateTimeImmutable implements \DateTimeInterface

{

    public function __construct()

    {

        parent::__construct('now');

    }

}
<?php

// app/Contexts/DigitalCard/Infrastructure/Services/SimpleQRCodeGenerator.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Services;

final class SimpleQRCodeGenerator

{

    public function __invoke(string $cardId): string

    {

        // Replace with real QR code generator integration.

        return 'qr:card:' . $cardId;

    }

}
5.4 Service Provider (Bindings)
<?php

// app/Contexts/DigitalCard/Infrastructure/Providers/DigitalCardServiceProvider.php

declare(strict_types=1);

namespace App\Contexts\DigitalCard\Infrastructure\Providers;

use App\Contexts\DigitalCard\Application\Handlers\IssueCardHandler;

use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;

use App\Contexts\DigitalCard\Infrastructure\Persistence\EloquentDigitalCardRepository;

use App\Contexts\DigitalCard\Infrastructure\Services\LaravelClock;

use App\Contexts\DigitalCard\Infrastructure\Services\SimpleQRCodeGenerator;

use Illuminate\Support\ServiceProvider;

final class DigitalCardServiceProvider extends ServiceProvider

{

    public function register(): void

    {

        $this->app->bind(DigitalCardRepository::class, EloquentDigitalCardRepository::class);

        // Clock and QR generator

        $this->app->bind(\DateTimeInterface::class, LaravelClock::class);

        $this->app->bind('digitalcard.qr', fn() => new SimpleQRCodeGenerator());

        // Handlers

        $this->app->bind(IssueCardHandler::class, function ($app) {

            return new IssueCardHandler(

                repo: $app->make(DigitalCardRepository::class),

                tz: new \DateTimeZone(config('app.timezone')),

                clockNowProvider: $app->make(\DateTimeInterface::class),

                qrGenerator: $app->make('digitalcard.qr'),

            );

        });

    }

    public function boot(): void {}

}

After code is placed, register the provider (if you don’t auto-discover in your app): add to config/app.php providers list. (You can queue this change for approval to respect “no unapproved changes”.)
6) Routing Stubs (respecting 6-case model)
Reminder: Do NOT modify existing route files without approval. Provide the following new route files and wire them via your RouteServiceProvider where your 6-case is already defined.
Desktop Admin API (/{tenant}/api/v1/cards/*)
<?php

// routes/tenant/api.digitalcard.php

use App\Contexts\DigitalCard\Infrastructure\Http\Controllers\DigitalCardController;

use Illuminate\Support\Facades\Route;

Route::prefix('{tenant}/api/v1')

    ->middleware([

        'tenant.resolve', // your existing tenant resolver

        'auth',           // your desktop/admin guard

        'verified',       // if applicable

    ])

    ->group(function () {

        Route::post('/cards', [DigitalCardController::class, 'store']); // Issue

        // Route::post('/cards/{card}/activate', ...);

        // Route::post('/cards/{card}/revoke', ...);

        // Route::get('/cards/{card}', ...);

    });
Mobile API (/{tenant}/mapi/v1/cards/*)
<?php

// routes/tenant/mapi.digitalcard.php

use App\Contexts\DigitalCard\Infrastructure\Http\Controllers\DigitalCardController;

use Illuminate\Support\Facades\Route;

Route::prefix('{tenant}/mapi/v1')

    ->middleware([

        'tenant.resolve',

        'auth:sanctum',   // stateless tokens (mobile)

    ])

    ->group(function () {

        Route::post('/cards', [DigitalCardController::class, 'store']); // Issue (if allowed on mobile)

        // Typically mobile would validate/show rather than issue.

        // Route::get('/cards/{card}', ...); // show/validate

    });

Per your charter: Angular Mobile → /mapi/* ONLY, Vue Desktop → /api/* ONLY, tenant slug mandatory, and Tenant SPA catch‑all last. These stubs comply.
7) README (Context-local)
# DigitalCardContext

Purpose: Lifecycle of digital membership cards (issue, activate, revoke, validate).

## Layers

- Domain: Entities, VOs, Events, Repository interface.

- Application: Commands/Handlers returning DTOs.

- Infrastructure: Eloquent repo, HTTP delivery, services.

## Multi-tenancy

- Data lives in Tenant DB only. Repository assumes tenant connection is already active via existing middleware.

## Security

- Desktop routes guarded by `auth`; Mobile routes by `auth:sanctum`.

- No cross-tenant access; tenant slug always in URL.

## Tests

- Run `php artisan test --testsuite=unit` and `--testsuite=feature`.

- Maintain ≥ 80% coverage.

## Open TODOs

- Implement Activate/Revoke handlers + routes.

- Enforce “one active card per member” via domain guard + repo transaction.

- Wire route files into your 6-case RouteServiceProvider (after approval).
8) What I can generate next
Activate/Revoke/Validate handlers & controller actions
Mermaid diagrams + sequence diagrams (issue/activate flows)
Policy/Permission integration (Gate/Policies)
Event subscribers to notify Membership on issue/revoke
E2E tests for mobile login → tenant select → card show/validate

Would you like me to add Activate/Revoke endpoints + tests, or produce a Mermaid sequence diagram for IssueCard across layers next?
 