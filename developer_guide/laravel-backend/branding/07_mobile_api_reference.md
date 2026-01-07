# Mobile Branding API Reference

**Version**: 1.0
**Last Updated**: 2026-01-07
**Base URL**: `/mapi/v1/public/branding`
**Client**: Angular + Ionic Mobile Application
**Database**: Landlord (Platform Database)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Formats](#requestresponse-formats)
4. [Error Handling](#error-handling)
5. [Caching Strategy](#caching-strategy)
6. [Mobile Optimizations](#mobile-optimizations)
7. [Integration Examples](#integration-examples)

---

## Overview

### Purpose

The **Mobile Branding API** provides tenant-specific branding configuration optimized for mobile applications. It implements **CASE 1 routing pattern** (Platform Mobile API accessing Landlord Database).

### Key Characteristics

| Feature | Value |
|---------|-------|
| **Route Pattern** | `/mapi/v1/public/branding/*` |
| **Database** | Landlord (`publicdigit`) |
| **Authentication** | None (public endpoints) |
| **Rate Limiting** | 100 requests/minute per IP |
| **Cache TTL** | 1 hour (custom), 5 min (defaults) |
| **Payload Target** | <5KB |
| **Offline TTL** | 24 hours |

### Design Decisions

**Why CASE 1 (Platform API) instead of CASE 2 (Tenant API)?**
- Branding data exists in **landlord database** (`tenant_brandings` table)
- CASE 2 would route to tenant database (wrong data source)
- Similar pattern to `/mapi/v1/auth/login` (platform-level mobile endpoint)

**Why separate from Desktop API?**
- Different cache strategy (1h vs 24h)
- Different response structure (mobile-optimized)
- Different error handling (graceful degradation)
- Different payload optimization (<5KB requirement)
- Mobile-specific CSS variables (44px tap targets)

---

## API Endpoints

### 1. Get Tenant Branding

**Endpoint**: `GET /mapi/v1/public/branding/{tenantSlug}`

**Purpose**: Retrieve mobile-optimized branding configuration for a specific tenant.

#### Request

```http
GET /mapi/v1/public/branding/nrna HTTP/1.1
Host: api.publicdigit.com
Accept: application/json
```

**Path Parameters**:
- `tenantSlug` (string, required) - Tenant identifier (e.g., "nrna", "munich")
  - Must be lowercase alphanumeric with hyphens
  - Length: 2-50 characters

#### Response (Success - 200 OK)

```json
{
  "data": {
    "tenant_slug": "nrna",
    "is_default": false,
    "branding": {
      "colors": {
        "primary": "#0D47A1",
        "secondary": "#1B5E20",
        "background": "#FFFFFF",
        "text": "#212121"
      },
      "typography": {
        "font_family": "Inter, system-ui, sans-serif"
      },
      "assets": {
        "logo_url": "https://cdn.example.com/nrna/logo.png",
        "favicon_url": null
      },
      "content": {
        "organization_name": "Vote with Confidence",
        "tagline": "Secure, Transparent, Democratic",
        "welcome_message": "Welcome to NRNA"
      }
    },
    "compliance": {
      "wcag_aa": true
    }
  },
  "meta": {
    "cache_strategy": "mobile_optimized",
    "offline_ttl": 86400,
    "version": "1.0",
    "generated_at": "2026-01-07T12:00:00+00:00"
  },
  "links": {
    "self": "/mapi/v1/public/branding/nrna",
    "css": "/mapi/v1/public/branding/nrna/css"
  }
}
```

**Response Headers**:
```http
Content-Type: application/json
Cache-Control: public, max-age=3600, stale-while-revalidate=7200
ETag: "abc123def456"
X-Offline-TTL: 86400
X-Branding-Version: 1.0
```

#### Response (Default Branding - 200 OK)

When tenant doesn't exist or has no custom branding:

```json
{
  "data": {
    "tenant_slug": "nonexistent",
    "is_default": true,
    "branding": {
      "colors": {
        "primary": "#1976D2",
        "secondary": "#388E3C",
        "background": "#FFFFFF",
        "text": "#212121"
      },
      "typography": {
        "font_family": "Inter, system-ui, sans-serif"
      },
      "assets": {
        "logo_url": null,
        "favicon_url": null
      },
      "content": {
        "organization_name": "Public Digit Platform",
        "tagline": "Digital Democracy Made Simple",
        "welcome_message": "Welcome"
      }
    },
    "compliance": {
      "wcag_aa": true
    }
  },
  "meta": {
    "cache_strategy": "mobile_optimized",
    "offline_ttl": 86400,
    "version": "1.0",
    "generated_at": "2026-01-07T12:00:00+00:00"
  },
  "links": {
    "self": "/mapi/v1/public/branding/nonexistent",
    "css": "/mapi/v1/public/branding/nonexistent/css"
  }
}
```

**Response Headers** (Default):
```http
Cache-Control: public, max-age=300
X-Branding-Fallback: default
```

Note: Shorter cache (5 min) allows recovery when tenant becomes available.

#### Response (Invalid Slug - 400 Bad Request)

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid request. Please check your input.",
    "status": 400,
    "context": {
      "tenant_slug": "INVALID_SLUG",
      "client": "mobile",
      "endpoint": "branding"
    }
  },
  "meta": {
    "timestamp": "2026-01-07T12:00:00+00:00",
    "request_id": "req_abc123",
    "client": "mobile",
    "suggested_action": "Check your input format and try again."
  },
  "links": {
    "documentation": "https://app.url/docs/errors/INVALID_INPUT",
    "support": "https://app.url/support",
    "retry": "/mapi/v1/public/branding/INVALID_SLUG"
  }
}
```

**Response Headers**:
```http
HTTP/1.1 400 Bad Request
Retry-After: 0
```

#### Field Mapping (Domain Model → API)

**⚠️ Domain Model Limitations (v1.0)**:
- Domain only has `primaryColor`, `secondaryColor` (NO `backgroundColor`, `textColor`)
- Domain has `heroTitle`, `heroSubtitle` (NO `organizationName`, `tagline`)
- Domain has NO versioning or timestamp tracking

**API Response Mapping**:
```
Domain Field            → API Response Field
──────────────────────────────────────────────
primaryColor            → colors.primary
secondaryColor          → colors.secondary
[HARD-CODED] #FFFFFF   → colors.background
[HARD-CODED] #212121   → colors.text

heroTitle               → content.organization_name
heroSubtitle            → content.tagline
welcomeMessage          → content.welcome_message

[HARD-CODED] "1.0"     → meta.version
```

---

### 2. Get Mobile CSS Variables

**Endpoint**: `GET /mapi/v1/public/branding/{tenantSlug}/css`

**Purpose**: Generate mobile-specific CSS custom properties from tenant branding.

#### Request

```http
GET /mapi/v1/public/branding/nrna/css HTTP/1.1
Host: api.publicdigit.com
Accept: text/css
```

#### Response (200 OK)

```css
:root {
  /* Brand Colors - Tenant Identity (from domain model) */
  --color-primary: #0D47A1;
  --color-secondary: #1B5E20;

  /* UI Colors - Standard Accessible Defaults (WCAG AA compliant) */
  --color-background: #FFFFFF;
  --color-text: #212121;
  --color-text-secondary: #757575;

  /* Typography - Mobile Optimized */
  --font-family: Inter, system-ui, sans-serif;
  --font-size-base: 16px; /* iOS minimum for preventing zoom */
  --line-height-base: 1.5;

  /* Mobile Touch Targets - iOS Human Interface Guidelines */
  --button-min-height: 44px; /* iOS HIG minimum tap target */
  --input-min-height: 44px;
  --tap-target-size: 44px;

  /* Spacing - Touch-Friendly */
  --spacing-touch: 8px; /* Minimum spacing between interactive elements */

  /* Accessibility - Reduced Motion */
  --transition-duration: 200ms;
}

/* Reduced motion support for users with motion sensitivity */
@media (prefers-reduced-motion: reduce) {
  :root {
    --transition-duration: 0ms;
  }
}

/* Dark mode support - System-level adaptation */
@media (prefers-color-scheme: dark) {
  :root {
    /* ARCHITECTURAL NOTE: Dark mode colors are UI conventions, not brand identity.
       Mobile apps typically handle dark mode via system colors or app theme. */
    --color-background: #121212;          /* Material Design dark surface */
    --color-text: #FFFFFF;               /* High contrast on dark */
    --color-text-secondary: #B0B0B0;     /* Medium contrast on dark */
  }
}

/* Brand color utilities for mobile apps */
.bg-primary { background-color: var(--color-primary); }
.text-primary { color: var(--color-primary); }
.bg-secondary { background-color: var(--color-secondary); }
.text-secondary { color: var(--color-secondary); }
```

**Response Headers**:
```http
Content-Type: text/css; charset=utf-8
Cache-Control: public, max-age=3600
X-CSS-Strategy: mobile-optimized
X-Branding-Type: custom
```

#### Mobile CSS Differences from Desktop

| Feature | Mobile | Desktop |
|---------|--------|---------|
| Tap Targets | 44px minimum | 32px minimum |
| Font Base Size | 16px (iOS anti-zoom) | 14px |
| Dark Mode | System-based | Theme toggle |
| Animations | Reduced motion support | Full animations |

---

### 3. Check Branding Version (Cache Validation)

**Endpoint**: `HEAD/GET /mapi/v1/public/branding/{tenantSlug}/version`

**Purpose**: Lightweight endpoint for mobile apps to check if branding has changed without downloading the full response.

#### Request

```http
HEAD /mapi/v1/public/branding/nrna/version HTTP/1.1
Host: api.publicdigit.com
```

#### Response (204 No Content)

**Headers Only** (no body):
```http
HTTP/1.1 204 No Content
ETag: "abc123def456"
Last-Modified: Tue, 07 Jan 2026 12:00:00 GMT
X-Branding-Version: 1.0
X-Branding-Type: custom
Cache-Control: public, max-age=3600
```

#### Mobile Client Cache Validation Flow

```
1. Mobile app has cached branding with ETag "abc123"
2. HEAD /mapi/v1/public/branding/{tenant}/version
3. Server returns ETag in header
4. If ETag matches "abc123" → Use cached branding
5. If ETag different → Fetch new branding via GET endpoint
```

This saves bandwidth and improves mobile app performance.

---

## Request/Response Formats

### Content Type Negotiation

**Supported Content Types**:
- `application/json` (default for branding endpoint)
- `text/css` (CSS endpoint)

**Example**:
```http
GET /mapi/v1/public/branding/nrna
Accept: application/json
```

### Response Structure

All JSON responses follow this structure:

```typescript
interface BrandingResponse {
  data: {
    tenant_slug: string;
    is_default: boolean;
    branding: BrandingData;
    compliance: ComplianceInfo;
  };
  meta: {
    cache_strategy: 'mobile_optimized' | 'desktop';
    offline_ttl: number; // seconds
    version: string;
    generated_at: string; // ISO 8601
  };
  links: {
    self: string;
    css: string;
  };
}

interface BrandingData {
  colors: {
    primary: string;      // Hex color
    secondary: string;    // Hex color
    background: string;   // Hex color
    text: string;         // Hex color
  };
  typography: {
    font_family: string;
  };
  assets: {
    logo_url: string | null;
    favicon_url: string | null;
  };
  content: {
    organization_name: string;
    tagline: string;
    welcome_message: string;
  };
}

interface ComplianceInfo {
  wcag_aa: boolean;
}
```

---

## Error Handling

### Error Response Structure

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    technical_message?: string; // Only in debug mode
    status: number;
    context: Record<string, any>;
  };
  meta: {
    timestamp: string;
    request_id: string | null;
    client: 'mobile';
    suggested_action: string;
  };
  links: {
    documentation: string;
    support: string;
    retry?: string;
  };
}
```

### Error Codes

| Code | HTTP Status | Description | User Action |
|------|-------------|-------------|-------------|
| `INVALID_INPUT` | 400 | Invalid tenant slug format | Check slug format |
| `TENANT_NOT_FOUND` | 404 | Tenant doesn't exist | Verify organization name |
| `RATE_LIMITED` | 429 | Too many requests | Wait 60 seconds |
| `INTERNAL_ERROR` | 500 | Server error | Try again later |

### Graceful Degradation

**Mobile API Philosophy**: Never break the UI

Instead of returning errors that break mobile apps, the API **gracefully degrades** to default branding:

| Scenario | Desktop API | Mobile API |
|----------|-------------|------------|
| Tenant not found | 404 Not Found | 200 OK (default branding) |
| Inactive tenant | 404 Not Found | 200 OK (default branding) |
| Database error | 500 Error | 200 OK (default branding) |
| Invalid slug | 400 Bad Request | 400 Bad Request |

**Why?**
- Mobile apps must remain functional even if tenant lookup fails
- Default theme prevents blank screens or crashes
- Better UX than showing error messages
- Shorter cache TTL (5 min) allows recovery when tenant becomes available

---

## Caching Strategy

### Client-Side Caching

**HTTP Cache Headers**:

| Branding Type | Cache-Control | Duration |
|--------------|---------------|----------|
| Custom Branding | `public, max-age=3600, stale-while-revalidate=7200` | 1 hour + 2h stale |
| Default Branding | `public, max-age=300, stale-while-revalidate=600` | 5 min + 10min stale |

**Stale-While-Revalidate**:
- Allows serving stale content while fetching fresh data in background
- Improves perceived performance on mobile networks
- Reduces wait time for end users

### ETag Support

**Conditional Requests** (HTTP 304):

```http
# Initial request
GET /mapi/v1/public/branding/nrna
→ 200 OK, ETag: "abc123"

# Subsequent request with ETag
GET /mapi/v1/public/branding/nrna
If-None-Match: "abc123"
→ 304 Not Modified (no body, saves bandwidth)

# After branding updated
GET /mapi/v1/public/branding/nrna
If-None-Match: "abc123"
→ 200 OK, ETag: "def456" (new branding)
```

### Offline TTL

**X-Offline-TTL Header**: Guidance for mobile app offline storage

```
X-Offline-TTL: 86400
```

Mobile app should:
1. Cache branding response in local storage
2. Use cached version for up to 86400 seconds (24 hours) offline
3. Attempt to refresh when connection restored
4. Show warning after offline TTL expires

### Caching Layers

```
┌────────────────────────────────────────┐
│ Mobile App (Angular/Ionic)             │
│  - HTTP Cache (1 hour)                 │
│  - IndexedDB/LocalStorage (24 hours)   │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│ CDN / Reverse Proxy                    │
│  - Edge Cache (1 hour)                 │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│ Laravel Application                    │
│  - No application cache (stateless)    │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│ PostgreSQL Database (Landlord)         │
│  - tenant_brandings table              │
└────────────────────────────────────────┘
```

---

## Mobile Optimizations

### 1. Payload Size Optimization

**Target**: <5KB per response

**Techniques**:
- Minimal field set (only essential data)
- No redundant metadata
- Efficient JSON structure
- Gzip compression (HTTP level)

**Measurement**:
```typescript
const response = await fetch('/mapi/v1/public/branding/nrna');
const text = await response.text();
const sizeInBytes = new Blob([text]).size;
console.log(`Payload size: ${sizeInBytes} bytes`);
// Expected: <5120 bytes (5KB)
```

### 2. Touch-Friendly CSS Variables

**iOS Human Interface Guidelines Compliance**:
```css
--button-min-height: 44px;  /* iOS HIG minimum */
--input-min-height: 44px;
--tap-target-size: 44px;
--spacing-touch: 8px;
```

**Usage in Ionic/Angular**:
```scss
// Use CSS variables in component styles
.primary-button {
  background-color: var(--color-primary);
  min-height: var(--button-min-height);
  padding: var(--spacing-touch);
}
```

### 3. Reduced Motion Support

**Accessibility for motion-sensitive users**:
```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --transition-duration: 0ms;
  }
}
```

### 4. Dark Mode Support

**System-level dark mode detection**:
```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #121212;
    --color-text: #FFFFFF;
  }
}
```

### 5. Offline-First Architecture

**Progressive Web App (PWA) Integration**:
```typescript
// Service Worker caching strategy
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/mapi/v1/public/branding/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          // Update cache with fresh response
          caches.open('branding-v1').then((cache) => {
            cache.put(event.request, response.clone());
          });
          return response;
        });

        // Return cached immediately, fetch in background
        return cached || networkFetch;
      })
    );
  }
});
```

---

## Integration Examples

### Angular/Ionic Service

```typescript
// src/app/services/branding.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface BrandingResponse {
  data: {
    tenant_slug: string;
    is_default: boolean;
    branding: {
      colors: {
        primary: string;
        secondary: string;
        background: string;
        text: string;
      };
      typography: {
        font_family: string;
      };
      assets: {
        logo_url: string | null;
        favicon_url: string | null;
      };
      content: {
        organization_name: string;
        tagline: string;
        welcome_message: string;
      };
    };
    compliance: {
      wcag_aa: boolean;
    };
  };
  meta: {
    cache_strategy: string;
    offline_ttl: number;
    version: string;
    generated_at: string;
  };
  links: {
    self: string;
    css: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BrandingService {
  private readonly baseUrl = '/mapi/v1/public/branding';
  private cachedBranding: Map<string, BrandingResponse> = new Map();

  constructor(private http: HttpClient) {}

  /**
   * Get branding for a specific tenant
   */
  getBranding(tenantSlug: string): Observable<BrandingResponse> {
    // Check memory cache first
    const cached = this.cachedBranding.get(tenantSlug);
    if (cached) {
      return of(cached);
    }

    return this.http.get<BrandingResponse>(`${this.baseUrl}/${tenantSlug}`)
      .pipe(
        tap(response => {
          // Cache in memory
          this.cachedBranding.set(tenantSlug, response);

          // Store in local storage for offline use
          localStorage.setItem(
            `branding_${tenantSlug}`,
            JSON.stringify({
              data: response,
              cached_at: Date.now(),
              expires_at: Date.now() + (response.meta.offline_ttl * 1000)
            })
          );
        }),
        catchError(error => {
          console.error('Failed to fetch branding, using defaults:', error);
          // Return cached data if available
          const stored = localStorage.getItem(`branding_${tenantSlug}`);
          if (stored) {
            const { data, expires_at } = JSON.parse(stored);
            if (Date.now() < expires_at) {
              return of(data);
            }
          }
          throw error;
        })
      );
  }

  /**
   * Apply branding CSS variables to document
   */
  applyBrandingCss(tenantSlug: string): void {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${this.baseUrl}/${tenantSlug}/css`;
    link.id = 'tenant-branding-css';

    // Remove existing branding CSS if any
    const existing = document.getElementById('tenant-branding-css');
    if (existing) {
      existing.remove();
    }

    document.head.appendChild(link);
  }

  /**
   * Check if branding has been updated (using version endpoint)
   */
  checkBrandingVersion(tenantSlug: string): Observable<boolean> {
    const stored = localStorage.getItem(`branding_${tenantSlug}`);
    if (!stored) {
      return of(true); // No cached version, needs update
    }

    const { data } = JSON.parse(stored);
    const cachedVersion = data.meta.version;

    return this.http.head(`${this.baseUrl}/${tenantSlug}/version`, {
      observe: 'response'
    }).pipe(
      tap(response => {
        const serverVersion = response.headers.get('X-Branding-Version');
        return serverVersion !== cachedVersion;
      }),
      catchError(() => of(false)) // On error, assume no update needed
    );
  }

  /**
   * Clear cached branding
   */
  clearCache(tenantSlug?: string): void {
    if (tenantSlug) {
      this.cachedBranding.delete(tenantSlug);
      localStorage.removeItem(`branding_${tenantSlug}`);
    } else {
      this.cachedBranding.clear();
      // Clear all branding keys
      Object.keys(localStorage)
        .filter(key => key.startsWith('branding_'))
        .forEach(key => localStorage.removeItem(key));
    }
  }
}
```

### Usage in Ionic Page Component

```typescript
// src/app/pages/home/home.page.ts
import { Component, OnInit } from '@angular/core';
import { BrandingService, BrandingResponse } from '@/services/branding.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage implements OnInit {
  branding: BrandingResponse['data'] | null = null;
  loading = true;

  constructor(private brandingService: BrandingService) {}

  ngOnInit() {
    this.loadBranding();
  }

  private loadBranding() {
    const tenantSlug = this.getTenantFromUrl(); // e.g., from route params

    this.brandingService.getBranding(tenantSlug).subscribe({
      next: (response) => {
        this.branding = response.data;
        this.loading = false;

        // Apply CSS variables
        this.brandingService.applyBrandingCss(tenantSlug);
      },
      error: (error) => {
        console.error('Failed to load branding:', error);
        this.loading = false;
        // UI will use default CSS variables
      }
    });
  }

  private getTenantFromUrl(): string {
    // Extract tenant slug from route or storage
    return 'nrna'; // Example
  }
}
```

### Template Usage

```html
<!-- src/app/pages/home/home.page.html -->
<ion-header>
  <ion-toolbar [style.background-color]="'var(--color-primary)'">
    <ion-title [style.color]="'var(--color-background)'">
      {{ branding?.branding.content.organization_name || 'Loading...' }}
    </ion-title>
  </ion-toolbar>
</ion-header>

<ion-content>
  <div class="hero-section" *ngIf="!loading">
    <img
      *ngIf="branding?.branding.assets.logo_url"
      [src]="branding.branding.assets.logo_url"
      alt="Organization Logo"
    />

    <h1 class="hero-title" [style.color]="'var(--color-text)'">
      {{ branding.branding.content.organization_name }}
    </h1>

    <p class="hero-subtitle" [style.color]="'var(--color-text-secondary)'">
      {{ branding.branding.content.tagline }}
    </p>

    <ion-button
      expand="block"
      [style.background-color]="'var(--color-primary)'"
      [style.min-height]="'var(--button-min-height)'"
    >
      Get Started
    </ion-button>
  </div>

  <ion-skeleton-text *ngIf="loading" animated></ion-skeleton-text>
</ion-content>
```

---

## Best Practices

### 1. Cache Management

```typescript
// Refresh branding on app resume (from background)
import { Platform } from '@ionic/angular';

constructor(
  private platform: Platform,
  private brandingService: BrandingService
) {
  this.platform.resume.subscribe(() => {
    // Check if branding needs update
    const tenantSlug = this.getCurrentTenant();
    this.brandingService.checkBrandingVersion(tenantSlug).subscribe(needsUpdate => {
      if (needsUpdate) {
        this.brandingService.clearCache(tenantSlug);
        this.loadBranding();
      }
    });
  });
}
```

### 2. Error Handling

```typescript
// Graceful degradation with default branding
this.brandingService.getBranding(tenantSlug).subscribe({
  next: (response) => {
    if (response.data.is_default) {
      console.warn('Using default branding for tenant:', tenantSlug);
      // Optionally show notification to user
    }
    this.applyBranding(response.data);
  },
  error: (error) => {
    console.error('Branding fetch failed:', error);
    // Fallback to hardcoded defaults in app
    this.applyDefaultBranding();
  }
});
```

### 3. Performance Optimization

```typescript
// Preload branding during app initialization
export class AppComponent implements OnInit {
  constructor(private brandingService: BrandingService) {}

  ngOnInit() {
    // Preload branding for current tenant
    const tenantSlug = this.getStoredTenant();
    if (tenantSlug) {
      this.brandingService.getBranding(tenantSlug).subscribe();
    }
  }
}
```

---

## Troubleshooting

See main [Troubleshooting Guide](./09_troubleshooting_guide.md) for detailed debugging steps.

**Quick Checks**:
1. ✅ Verify route exists: `php artisan route:list --path=mapi`
2. ✅ Check database: `tenant_brandings` table has records
3. ✅ Test endpoint: `curl /mapi/v1/public/branding/nrna`
4. ✅ Clear cache: `localStorage.clear()` in browser DevTools
5. ✅ Check CORS: Verify `capacitor://localhost` is in allowed origins

---

## Additional Resources

- **[Mobile Integration Guide](./08_mobile_integration_guide.md)** - Detailed Angular/Ionic setup
- **[Testing Guide](./04_testing_guide.md)** - TDD workflow and patterns
- **[Domain Model Guide](./02_domain_model.md)** - Understanding the domain layer
- **[Troubleshooting Guide](./09_troubleshooting_guide.md)** - Common issues and solutions

---

**Last Updated**: 2026-01-07
**API Version**: 1.0
**Maintainer**: Platform Team
