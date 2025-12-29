Großartiger Brainstorming-Punkt! So können wir diese Entscheidung anhand der DDD-Prinzipien angehen:
✅ Option 1: DigitalCardContext (Separate Bounded Context)
Wann Sie sich dafür entscheiden sollten:
Wenn die digitale Mitgliedskarte ihren eigenen Lebenszyklus, Regeln und Integrationen hat (z. B. QR-Codes, NFC, externe Verifizierung).
Ob es sich zu einer eigenständigen Funktion weiterentwickeln wird (z. B. digitale ID, Treueprogramme, externe APIs).
Wenn es eine unabhängige Skalierbarkeit oder andere Sicherheitsrichtlinien braucht.
Vorteile:
Klare Trennung der Anliegen.
Leichter für zukünftige Anwendungsfälle über die Mitgliedschaft hinaus auszubauen.
Unabhängiger Einsatz möglich.
Nachteile:
Erhöht die Komplexität (neuer Kontext, neue Repositories).
Erfordert kontextübergreifende Kommunikation mit der Mitgliedschaft.

✅ Option 2: Im Kontext der Mitgliedschaft
Wann Sie sich dafür entscheiden sollten:
Wenn die Karte nur eine Darstellung der Mitgliedschaft ist (z. B. eine visuelle ID eines bestehenden Mitglieds).
Wenn es denselben Lebenszyklus wie die Mitgliedseinheit teilt.
Wenn es keine separate Domänenlogik über die Mitgliedschaftsattribute hinaus erfordert.
Vorteile:
Einfacheres Design.
Keine zusätzlichen Kontextgrenzen.
Mitgliedschaftsaggregate können die Karte als Value Object besitzen.
Nachteile:
Später ist es schwieriger, sich zu entkoppeln, wenn die Kartenfunktionen wachsen.
Der Kontext der Mitgliedschaft wird schwerer.

DDD-Empfehlung
Wenn die Karte rein informativ ist (Foto, QR, Name, Mitglieds-ID) → Membership Context als Value Object.
Wenn die Karte ein Verhalten zeigt (Aktivierung, Ablauf, externe Validierung, Integration digitaler Geldbörsen) → DigitalCardContext als neuen begrenzten Kontext.

Mögliches Modell bei Insider-Mitgliedschaft
Mitgliedseinheit
├── MemberId (Value Object)
├── Name
├── Status
└── DigitalCard (Wertobjekt)
├── CardId
├── QRCode
├── Ablaufdatum
Mögliches Modell bei separatem Kontext
DigitalCardContext
├── DigitalCard-Entität
│ ├── CardId
│ ├── MemberId (von Membership)
│ ├── Status (Aktiv, widerrufen)
│ ├── QRCode
│ ├── Ablaufdatum
└── CardService (Ausstellen, Widerrufen, Validieren)
🔥 Nächste Schritte 
Soll ich ein vollständiges DDD-Design für DigitalCardContext entwerfen (Aggregate, Entitäten, Wertobjekte, Domain-Events) ODER ein Membership-integriertes Design mit DigitalCard als Value Object?
Ich kann außerdem: ✅ Ein visuelles Architekturdiagramm für beide Optionen erstellen 
✅ Schreibe Laravel-Implementierungsskelette für beide Ansätze
Welche Richtung möchtest du zuerst erkunden?
 
Roshyara, Dr. Nab Raj hat 1 Person in die Gruppe eingeladen. Eingeladene Mitglieder sehen erst dann einen Verlauf, wenn sie Teams beigetreten sind.

 
Dr. Nab Raj Roshyara ist zur Unterhaltung hinzugekommen.

 
Hi
 
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

🔥 Next Steps 

Do you want me to:

✅ Generate a visual architecture diagram for this context (Aggregates + Services + Events)? 

✅ Draft Laravel skeleton code for the DigitalCardContext (Entities, Value Objects, Repository, Service)? 

✅ Create integration points with Membership context (Domain Events + Application Services)?

Which one should I do first?
 
Hi
 
Here’s a visual architecture diagram of the DigitalCardContext (Domain → Application → Infrastructure + integrations). 

It reflects your 6-case routing, multi-tenant isolation, and DDD layering:

digital_card_context_diagram.png
What’s shown
Domain Layer
Aggregate Root: DigitalCard
Value Objects: CardId, MemberId, QRCode, Dates, Status (Enum)
Domain Events: CardIssued, CardActivated, CardRevoked, CardExpired
Invariants: one member per card; valid status transitions; expiresAt ≥ issuedAt
Application Layer
Commands: IssueCard, ActivateCard, RevokeCard, ValidateCard
Handlers: IssueCardHandler, ActivateCardHandler, RevokeCardHandler
Policies: Tenant isolation, authentication required

Orchestrates domain services & repositories
Infrastructure Layer
Repositories: DigitalCardRepository (Tenant DB; automatic connection switching)
Adapters: EloquentDigitalCardRepository
Services: QRCodeGenerator, Clock, EventDispatcher
APIs (by client):

Angular Mobile → /{tenant}/mapi/v1/cards/*

Vue Desktop → /{tenant}/api/v1/cards/* 
(Tenant slug mandatory; mobile uses Sanctum stateless tokens)
External Contexts / Integrations
Membership Context: provides MemberId, membership status; consumes card events
Platform Services: Sanctum auth, event bus/notifications, audit logging

Want a code-ready scaffold next?
I can generate:
Laravel skeletons (Entities, VOs, Events, Repositories, Command Handlers)
Feature tests (TDD-first) for issuing/activating/revoking/validating cards
API route stubs for both /mapi and /api respecting your 6-case architecture

Would you like me to produce the Laravel scaffolding + tests now, or a Mermaid diagram variant you can paste into docs?
 
Hi
 
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
 
####################################################
 
You’re absolutely right. In DDD, a bounded context like DigitalCardContext must be independent of framework- or package-specific choices (e.g., Spatie’s tenancy, Sanctum internals, Eloquent details). Those are infrastructure concerns and should be hidden behind ports (interfaces) with adapters per package. Let’s refactor the scaffolding to remove any implicit coupling and make the context fully portable.
Below is a clean DDD refactor with ports/adapters and in-memory test doubles, preserving your 6-case routing and multi-tenant guarantees while keeping DigitalCardContext pure.
1) Core Principle: Ports & Adapters (Hexagonal boundary)
DigitalCardContext exposes Domain + Application. Any package details (Spatie, tenancy middleware, Eloquent, Sanctum, etc.) live outside via adapters.
We’ll introduce these ports in Shared (or inside DigitalCardContext/Infrastructure/Ports if you prefer context-local):
TenantContext (read-only current tenant slug, tenant ID)
TenantConnectionSwitcher (switches DB connections per tenant)
Clock (time source)
QrCodeGenerator (QR generation)
CardRepository (already present, but make it package-agnostic)
EventBus (publish domain events)
The Application Handlers depend only on these interfaces, not on any package types.
2) New Ports (Interfaces)
2.1 Tenant Ports
 
<?php
// app/Contexts/Shared/Contracts/Tenancy/TenantContext.php
declare(strict_types=1);
 
namespace App\Contexts\Shared\Contracts\Tenancy;
 
interface TenantContext
{
    /** Absolute rule: path-based slug is authoritative in your system charter /
    public function slug(): string;
    /* Optional: internal tenant id; not required for DigitalCardContext domain */
    public function id(): ?string;
}
 
 
<?php
// app/Contexts/Shared/Contracts/Tenancy/TenantConnectionSwitcher.php
declare(strict_types=1);
 
namespace App\Contexts\Shared\Contracts\Tenancy;
 
interface TenantConnectionSwitcher
{
    /** Switch to tenant DB for the current request/operation /
    public function toTenant(TenantContext $tenant): void;


    /* Switch to landlord DB (if needed for audit/logging) */
    public function toLandlord(): void;
}
 
Important: DigitalCardContext never calls a specific package. It only asks the switcher to ensure the right DB is active. Your existing middleware can fulfill these ports via an adapter that uses Spatie (or any other solution) behind the scenes.
2.2 Supporting Ports
 
<?php
// app/Contexts/Shared/Contracts/System/Clock.php
declare(strict_types=1);
 
namespace App\Contexts\Shared\Contracts\System;
 
interface Clock
{
    public function now(): \DateTimeImmutable;
}
 
 
<?php
// app/Contexts/Shared/Contracts/Media/QrCodeGenerator.php
declare(strict_types=1);
 
namespace App\Contexts\Shared\Contracts\Media;
 
interface QrCodeGenerator
{
    public function make(string $payload): string;
}
``
 
 
<?php
// app/Contexts/Shared/Contracts/Events/EventBus.php
declare(strict_types=1);
 
namespace App\Contexts\Shared\Contracts\Events;
 
interface EventBus
{
    public function publish(object $domainEvent): void;
}
 
3) DigitalCardContext depends on ports, not packages
3.1 Update Application Handlers to use ports
 
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
use App\Contexts\Shared\Contracts\System\Clock;
use App\Contexts\Shared\Contracts\Media\QrCodeGenerator;
use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use App\Contexts\Shared\Contracts\Tenancy\TenantConnectionSwitcher;
 
final class IssueCardHandler
{
    public function __construct(
        private readonly DigitalCardRepository $repo,
        private readonly Clock $clock,
        private readonly QrCodeGenerator $qr,
        private readonly TenantContext $tenant,               // read-only
        private readonly TenantConnectionSwitcher $switcher,  // boundary
    ) {}
 
    public function handle(IssueCardCommand $cmd): CardDTO
    {
        // ALWAYS ensure tenant DB before persistence
        $this->switcher->toTenant($this->tenant);
 
        $now = $this->clock->now();
        $expires = $cmd->expiresAtIso8601
            ? new \DateTimeImmutable($cmd->expiresAtIso8601)
            : $now->modify('+1 year');
 
        $cardId = CardId::new();
        $qrStr  = $this->qr->make("card:{$cardId->toString()}");
 
        $aggregate = DigitalCard::issue(
            $cardId,
            MemberId::fromString($cmd->memberId),
            QRCode::fromString($qrStr),
            $now,
            $expires
        );
 
        // Business rule (recommendation): one Active/Issued per Member
        // Enforce via repository transaction/service policy as needed.
 
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
 
No mention of Spatie. The handler relies on ports only.
Apply the same pattern for ActivateCardHandler and RevokeCardHandler:
 
// constructor args include DigitalCardRepository, Clock, TenantContext, TenantConnectionSwitcher
// first line in handle(): $this->switcher->toTenant($this->tenant);
 
4) Infrastructure Adapters (outside the context)
You can implement adapters that bind these ports to your chosen packages without touching DigitalCardContext.
4.1 Example: Tenancy adapter (package-agnostic)
 
<?php
// app/Infrastructure/Tenancy/Adapters/RequestPathTenantContext.php
declare(strict_types=1);
 
namespace App\Infrastructure\Tenancy\Adapters;
 
use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use Illuminate\Http\Request;
 
final class RequestPathTenantContext implements TenantContext
{
    public function __construct(private Request $request) {}
 
    public function slug(): string
    {
        // Your rule: path-based slug has highest priority
        // Example assumes routes like /{tenant}/api/v1/…
        return (string) $this->request->route('tenant');
    }
 
    public function id(): ?string
    {
        // Optional: resolve to internal id if you maintain a landlord mapping
        return null;
    }
}
 
 
<?php
// app/Infrastructure/Tenancy/Adapters/ConnectionSwitcherAdapter.php
declare(strict_types=1);
 
namespace App\Infrastructure\Tenancy\Adapters;
 
use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use App\Contexts\Shared\Contracts\Tenancy\TenantConnectionSwitcher;
 
final class ConnectionSwitcherAdapter implements TenantConnectionSwitcher
{
    public function toTenant(TenantContext $tenant): void
    {
        // Here you call your tenancy package or your custom DB manager
        // Example:
        // Tenancy::setTenantSlug($tenant->slug());
        // DB::setDefaultConnection('tenant'); // or via package API
    }
 
    public function toLandlord(): void
    {
        // DB::setDefaultConnection('landlord');
    }
}
 
Swap the internals with Spatie, your custom abstraction, or any other solution. DigitalCardContext never sees it.
4.2 Clock + QR adapters
 
<?php
// app/Infrastructure/System/LaravelClockAdapter.php
declare(strict_types=1);
 
namespace App\Infrastructure\System;
 
use App\Contexts\Shared\Contracts\System\Clock;
 
final class LaravelClockAdapter implements Clock
{
    public function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now');
    }
}
 
 
<?php
// app/Infrastructure/Media/SimpleQrAdapter.php
declare(strict_types=1);
 
namespace App\Infrastructure\Media;
 
use App\Contexts\Shared\Contracts\Media\QrCodeGenerator;
 
final class SimpleQrAdapter implements QrCodeGenerator
{
    public function make(string $payload): string
    {
        // Replace with real QR generator. Return string payload or data URL.
        return 'qr:' . $payload;
    }
}
 
4.3 Event Bus adapter
 
<?php
// app/Infrastructure/Events/LaravelEventBusAdapter.php
declare(strict_types=1);
 
namespace App\Infrastructure\Events;
 
use App\Contexts\Shared\Contracts\Events\EventBus;
 
final class LaravelEventBusAdapter implements EventBus
{
    public function publish(object $domainEvent): void
    {
        event($domainEvent); // or dispatch(new …)
    }
}
 
5) Service Provider wiring (bindings only; no package leakage)
Bind ports to adapters in a provider outside the context. Your DigitalCard provider should depend only on interfaces.
 
<?php
// app/Providers/ContextBindingsServiceProvider.php
declare(strict_types=1);
 
namespace App\Providers;
 
use App\Contexts\Shared\Contracts\Events\EventBus;
use App\Contexts\Shared\Contracts\Media\QrCodeGenerator;
use App\Contexts\Shared\Contracts\System\Clock;
use App\Contexts\Shared\Contracts\Tenancy\TenantConnectionSwitcher;
use App\Contexts\Shared\Contracts\Tenancy\TenantContext;
use App\Infrastructure\Events\LaravelEventBusAdapter;
use App\Infrastructure\Media\SimpleQrAdapter;
use App\Infrastructure\System\LaravelClockAdapter;
use App\Infrastructure\Tenancy\Adapters\ConnectionSwitcherAdapter;
use App\Infrastructure\Tenancy\Adapters\RequestPathTenantContext;
use Illuminate\Support\ServiceProvider;
use Illuminate\Http\Request;
 
final class ContextBindingsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(Clock::class, LaravelClockAdapter::class);
        $this->app->bind(QrCodeGenerator::class, SimpleQrAdapter::class);
        $this->app->bind(EventBus::class, LaravelEventBusAdapter::class);
 
        // TenantContext from current request path param
        $this->app->bind(TenantContext::class, function ($app) {
            return new RequestPathTenantContext($app->make(Request::class));
        });
 
        // DB switcher adapter (internals can use Spatie/custom)
        $this->app->bind(TenantConnectionSwitcher::class, ConnectionSwitcherAdapter::class);
    }
}
 
This provider contains the only references to concrete adapters. You can switch packages at any time without touching DigitalCardContext.
6) Repository isolation
Your DigitalCardRepository remains a domain port. The Eloquent implementation stays in Infrastructure, but doesn’t embed any package types (only framework-neutral database operations). Tenant switching is done before repository calls via the switcher port.
If you want pure domain tests without DB, implement an in-memory repository:
 
<?php
// tests/Fakes/InMemoryDigitalCardRepository.php
declare(stricttypes=1);
 
namespace Tests\Fakes;
 
use App\Contexts\DigitalCard\Domain\Entities\DigitalCard;
use App\Contexts\DigitalCard\Domain\Repositories\DigitalCardRepository;
use App\Contexts\DigitalCard\Domain\ValueObjects\CardId;
use App\Contexts\DigitalCard\Domain\ValueObjects\MemberId;
 
final class InMemoryDigitalCardRepository implements DigitalCardRepository
{
    /** @var array<string, DigitalCard> */
    private array $store = [];
 
    public function byId(CardId $id): ?DigitalCard
    {
        return $this->store[$id->toString()] ?? null;
    }
 
    public function byMember(MemberId $memberId): array
    {
        return arrayvalues(array_filter(
            $this->store,
            fn(DigitalCard $c) => $c->memberId()->toString() === $memberId->toString()
        ));
    }
 
    public function save(DigitalCard $card): void
    {
        $this->store[$card->id()->toString()] = $card;
        foreach ($card->releaseEvents() as $event) {
            // no-op in-memory: tests can assert events separately if needed
        }
    }
}
 
Use this in unit tests to get fast, package-free coverage.
7) Controllers & Routes (still DDD-safe)
Controllers live in Infrastructure and depend on handlers (which depend on ports), not on packages. Routes continue to honor your 6‑case model:
Desktop Admin: /{tenant}/api/v1/cards/*
Mobile Angular: /{tenant}/mapi/v1/cards/*
Tenant slug mandatory in URL
Mobile uses Sanctum at the adapter level (middleware), not inside handlers
No handler references Sanctum or Spatie—only the controllers’ middleware stacks handle auth & tenancy resolution externally.
8) Summary of the refactor
✅ DigitalCardContext remains pure (Domain + Application).
✅ All package specifics (Spatie tenancy, Sanctum, Eloquent, Laravel events) live in Infrastructure adapters bound to ports.
✅ Tests can use in-memory repository, fake clock/QR, and dummy tenant context for fast TDD.
✅ You can swap the tenancy engine tomorrow without changing DigitalCardContext.
9) Next steps (pick any)
Generate the in-memory test suite (unit + feature) wired to ports, no DB.
Add read/validate endpoint with a CardValidationService port and an adapter that checks QR signature without leaking package code.
Produce Mermaid diagrams (class + sequence) showing ports/adapters around DigitalCardContext.
Add policies as adapters (e.g., AuthorizationService port) to keep authorization out of domain/application.
Would you like me to produce the in-memory test suite (unit + feature, no DB) next, or draft the Mermaid hexagonal diagram for this context showing port/adapters and flows?
 
Excellent observation! In DDD, the context must remain agnostic of infrastructure details, so swapping tenancy engines should never require changes inside DigitalCardContext. Here’s how you achieve that cleanly:
✅ Why It’s Easy Now
Because we introduced ports and adapters, the context depends only on interfaces like:
TenantContext
TenantConnectionSwitcher
The actual tenancy engine (Spatie, custom, Laravel Tenancy, etc.) is hidden behind these adapters. So swapping engines means changing only the adapter implementation, not the domain or application layers.
✅ Steps to Swap Tenancy Engine
Keep Ports Stable\ Do not modify TenantContext or TenantConnectionSwitcher interfaces. They define the contract your context expects.
Replace Adapter Implementation
If you move from Spatie to Laravel Tenancy, write a new adapter:
Similarly, update TenantContext adapter to resolve slug from request or tenancy service.
final class LaravelTenancyConnectionSwitcher implements TenantConnectionSwitcher {
    public function toTenant(TenantContext $tenant): void {
        // Call Laravel Tenancy API here
    }
    public function toLandlord(): void {
        // Switch back to landlord DB
    }
}
Update Service Provider Bindings\ In ContextBindingsServiceProvider:$this->app->bind(TenantConnectionSwitcher::class, LaravelTenancyConnectionSwitcher::class);That’s it—your handlers and domain remain untouched.
Test with In-Memory Repository\ Because your domain tests use InMemoryDigitalCardRepository, they are unaffected by tenancy engine changes. Only integration tests need to verify DB switching.
✅ Benefits
Zero impact on domain/application code.
No ripple effect on other contexts.
Easy rollback or migration to another engine later.
🔥 Next, I can:
Show a Mermaid Hexagonal Architecture diagram illustrating ports/adapters and how tenancy swaps happen.
Or write a migration guide for moving from Spatie to Laravel Tenancy step-by-step.
Which one do you want first: diagram or migration guide?
 
Absolutely—here are Mermaid diagrams that capture the DDD + Hexagonal (Ports & Adapters) setup for your DigitalCardContext, and how tenancy engines can be swapped without touching the domain/application layers.
1) Context Map (Bounded Contexts + Event Flow)
 
flowchart LR
    subgraph MembershipContext[Membership Context]
      M[Member Aggregate\nMemberId, Status]
    end
 
    subgraph DigitalCardContext[DigitalCard Context]
      DC[DigitalCard Aggregate\nCardId, MemberId, QRCode, Status]
      EV1((CardIssued))
      EV2((CardActivated))
      EV3((CardRevoked))
      EV4((CardExpired))
    end
 
    subgraph PlatformServices[Platform Services]
      AUTH[Auth (Sanctum tokens for mobile)]
      BUS[Event Bus / Notifications]
      AUDIT[Audit Logging]
    end
 
    M -- provides --> DC
    DC -- emits --> EV1
    DC -- emits --> EV2
    DC -- emits --> EV3
    DC -- emits --> EV4
 
    EV1 --> BUS
    EV2 --> BUS
    EV3 --> BUS
    EV4 --> BUS
    BUS --> AUDIT
    AUTH -. guards .-> DigitalCardContext
 
What this shows:
Membership provides MemberId and membership status.
DigitalCard emits domain events, consumed by Platform Services (event bus, audit).
Auth is external; DigitalCardContext doesn’t depend on Sanctum directly.
2) Hexagonal Architecture (Ports & Adapters)
This diagram highlights pure domain/application in the center and adapters on the outside. Swapping the tenancy engine is just replacing the adapter bound to TenantConnectionSwitcher and TenantContext.
 
flowchart TB
    subgraph Domain[Domain Layer]
      AGG[Aggregate: DigitalCard]
      VOs[Value Objects:\nCardId, MemberId, QRCode]
      EVs[Domain Events:\nIssued, Activated, Revoked, Expired]
      REPOPORT[Port: DigitalCardRepository]
    end
 
    subgraph Application[Application Layer]
      CMDs[Commands:\nIssue, Activate, Revoke]
      HANDLERS[Handlers:\nIssueCardHandler, ActivateCardHandler, RevokeCardHandler]
      DTO[CardDTO]
      HANDLERS --> REPOPORT
    end
 
    subgraph Ports[Cross-cutting Ports]
      TENANTCTX[Port: TenantContext]
      TENANTSW[Port: TenantConnectionSwitcher]
      CLOCK[Port: Clock]
      QRCODEGEN[Port: QrCodeGenerator]
      EVENTBUS[Port: EventBus]
    end


    Application --> TENANTCTX
    Application --> TENANTSW
    Application --> CLOCK
    Application --> QRCODEGEN
    Domain --> EVENTBUS
 
    subgraph Infrastructure[Adapters (swap without touching domain/app)]
      ELOQREPO[Adapter: EloquentDigitalCardRepository]
      TENANCYSPATIE[Adapter: SpatieTenancyConnectionSwitcher]
      TENANCYLARATENANCY[Adapter: LaravelTenancyConnectionSwitcher]
      TENANTFROMREQ[Adapter: RequestPathTenantContext]
      CLOCKLARAVEL[Adapter: LaravelClockAdapter]
      QRCODESIMPLE[Adapter: SimpleQrAdapter]
      EVENTLARAVEL[Adapter: LaravelEventBusAdapter]
    end
 
    REPOPORT <---> ELOQREPO
    TENANTSW <---> TENANCYSPATIE
    TENANTSW <---> TENANCYLARATENANCY
    TENANTCTX <---> TENANTFROMREQ
    CLOCK <---> CLOCKLARAVEL
    QRCODEGEN <---> QRCODESIMPLE
    EVENTBUS <---> EVENT_LARAVEL
 
Key takeaway:
Swap tenancy engine by rebinding TenantConnectionSwitcher (e.g., from SpatieTenancyConnectionSwitcher to LaravelTenancyConnectionSwitcher).
No changes to DigitalCardContext domain or application code.
3) Sequence: Issue Card via Desktop API (/{tenant}/api/v1/cards)
Demonstrates path-based tenant resolution, DB switching via port, and pure handler orchestration.
4) Sequence: Activate Card (/{tenant}/api/v1/cards/{cardId}/activate)
5) Sequence: Revoke Card (/{tenant}/api/v1/cards/{cardId}/revoke)
6) How swapping tenancy engines looks (at the boundary)
The only change required is in adapter binding. Domain/Application stay untouched.
Service provider change (conceptual):
From:$this->app->bind(TenantConnectionSwitcher::class, SpatieTenancyConnectionSwitcher::class);
To:$this->app->bind(TenantConnectionSwitcher::class, LaravelTenancyConnectionSwitcher::class);
No other code in DigitalCardContext changes.
Want me to generate these diagrams into your docs?
I can:
Produce a docs/architecture/digitalcard-hex.md with these Mermaid blocks.
Add a Mermaid class diagram of entities/VOs/repository ports.
Include a sequence diagram for mobile (/{tenant}/mapi/v1/cards/*) using Sanctum guard (still via adapters, not in handlers).
Which artifact should I create next?
 