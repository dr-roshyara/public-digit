# Election Context

**Bounded Context:** Election & Voting Operations
**Database:** Tenant Database
**API Prefix:** `/api/v1/elections`
**Frontend:** Angular (Tenant Member Experience)

## Purpose

Handles all election and voting-related operations for tenant members, including:
- View available elections
- View election details and candidates
- Cast votes securely
- View election results
- Track voting status

## Structure

```
elections/
├── services/
│   └── election.service.ts      # Election and voting operations
├── models/
│   └── election.models.ts       # TypeScript interfaces
└── components/                  # Phase 3+ UI components
    ├── election-list/
    ├── election-detail/
    ├── voting-interface/
    └── results-view/
```

## API Endpoints

- `GET /api/v1/elections` - List all elections
- `GET /api/v1/elections/active` - Get active elections
- `GET /api/v1/elections/{id}` - Get election details
- `POST /api/v1/elections/{id}/vote` - Cast vote
- `GET /api/v1/elections/{id}/results` - View results
- `GET /api/v1/elections/{id}/candidates` - List candidates

## DDD Alignment

This context aligns with the **Election** bounded context defined in the Laravel backend architecture manifest.

## Security

- One vote per user per election (enforced by unique voter slug)
- Vote encryption in transit
- Audit trail maintained
- State machine for election lifecycle
