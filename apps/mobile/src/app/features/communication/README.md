# Communication Context

**Bounded Context:** Forum & Discussion Management
**Database:** Tenant Database
**API Prefix:** `/api/v1/forum`
**Frontend:** Angular (Tenant Member Experience)

## Purpose

Handles all communication and forum-related operations for tenant members, including:
- View forum threads
- Create and reply to posts
- Participate in discussions
- Search forum content
- Manage notifications

## Structure

```
communication/
├── services/
│   └── communication.service.ts # Forum and discussion operations
├── models/
│   └── forum.models.ts          # TypeScript interfaces
└── components/                  # Phase 3+ UI components
    ├── forum-list/
    ├── thread-view/
    └── post-create/
```

## API Endpoints

- `GET /api/v1/forum/threads` - List forum threads
- `GET /api/v1/forum/threads/{id}` - Get thread details
- `POST /api/v1/forum/threads` - Create new thread
- `POST /api/v1/forum/threads/{id}/posts` - Create post
- `GET /api/v1/forum/posts/{id}` - Get post details
- `PUT /api/v1/forum/posts/{id}` - Update post

## DDD Alignment

This context aligns with the **Communication** bounded context defined in the Laravel backend architecture manifest.

## Features

- Real-time notifications for new posts
- Thread moderation capabilities
- Post search and filtering
- Member engagement tracking
