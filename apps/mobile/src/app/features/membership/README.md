# Membership Context

**Bounded Context:** Member Profile Management
**Database:** Tenant Database
**API Prefix:** `/api/v1/membership`
**Frontend:** Angular (Tenant Member Experience)

## Purpose

Handles all member profile-related operations for tenant members, including:
- View profile information
- Update profile details
- Verify profile status
- Manage member-specific data

## Structure

```
membership/
├── services/
│   └── membership.service.ts    # Profile CRUD operations
├── models/
│   └── member.models.ts         # TypeScript interfaces
└── components/                  # Phase 3+ UI components
    ├── profile-view/
    └── profile-edit/
```

## API Endpoints

- `GET /api/v1/membership/profile` - Get current user profile
- `PUT /api/v1/membership/profile` - Update profile
- `POST /api/v1/membership/profile/verify` - Verify profile

## DDD Alignment

This context aligns with the **Membership** bounded context defined in the Laravel backend architecture manifest.
