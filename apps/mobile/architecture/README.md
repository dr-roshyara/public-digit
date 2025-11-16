# Mobile App Architecture

**Last Updated:** November 15, 2025, 15:00 UTC
**Version:** 1.0.0

---

## Overview

This folder contains the architectural manifest and boundary definitions for the PublicDigit Election Platform Mobile Application (Angular).

---

## Files

### 1. `architectural-manifest.json`

**Purpose:** Central architectural configuration and rules

**Contents:**
- Domain strategy (allowed/prohibited domains)
- Frontend boundaries (allowed/prohibited features)
- DDD contexts mapping
- API access patterns
- Security boundaries
- Deployment configuration
- Validation rules

**Usage:**
```typescript
import manifest from '../architecture/architectural-manifest.json';

// Check if domain is allowed
const isAllowed = manifest.domain_strategy.allowed_domains.includes(domain);

// Get context configuration
const electionContext = manifest.ddd_contexts.tenant_contexts.Election;
```

---

### 2. `frontend-boundaries.json`

**Purpose:** Detailed route and API boundaries

**Contents:**
- Allowed routes (public & authenticated)
- Prohibited routes (admin & system)
- Allowed API calls per context
- Prohibited API calls
- Technology constraints
- Data access boundaries
- Security requirements
- Validation rules

**Usage:**
```typescript
import boundaries from '../architecture/frontend-boundaries.json';

// Check if route is allowed
const isRouteAllowed = boundaries.angular_boundaries.allowed_routes.public.includes(path);

// Check if API is allowed
const apiPattern = 'GET /api/v1/elections';
const isApiAllowed = boundaries.angular_boundaries.allowed_api_calls.election_context.includes(apiPattern);
```

---

## Architecture Principles

### 1. Frontend Technology Separation

**Rule:** Angular is used ONLY for tenant member experience

**Allowed:**
- ✅ Tenant member features (elections, profile, forum, finance)
- ✅ Mobile app development
- ✅ Desktop web app for tenant members

**Prohibited:**
- ❌ Landlord administration
- ❌ Tenant management
- ❌ Platform analytics
- ❌ System configuration

---

### 2. Domain Separation

**Allowed Domains:**
- ✅ `*.publicdigit.com` - Tenant web access
- ✅ `app.publicdigit.com` - Mobile app

**Prohibited Domains:**
- ❌ `admin.publicdigit.com` - Landlord admin only
- ❌ `api.publicdigit.com` - Platform APIs only

---

### 3. DDD Context Boundaries

**Tenant Contexts (Our Responsibility):**

1. **Membership Context**
   - Service: `MembershipService`
   - Features: Profile view, profile edit, member list
   - Operations: Read own, update own

2. **Election Context**
   - Service: `ElectionService`
   - Features: Election list, detail, voting, results
   - Operations: Read, vote, view results

3. **Finance Context**
   - Service: `FinanceService`
   - Features: Payment history, make payment, invoices
   - Operations: Read own, make payment

4. **Communication Context**
   - Service: `CommunicationService`
   - Features: Forum list, threads, posts, replies
   - Operations: Read, create, reply, edit own

---

### 4. API Access Patterns

**Allowed:**
- ✅ `/api/v1/auth/*` - Authentication
- ✅ `/api/v1/profile/*` - Membership Context
- ✅ `/api/v1/elections/*` - Election Context
- ✅ `/api/v1/finance/*` - Finance Context
- ✅ `/api/v1/forum/*` - Communication Context

**Prohibited:**
- ❌ `/api/admin/*` - Admin APIs
- ❌ `/api/platform/*` - Platform APIs
- ❌ `/api/landlord/*` - Landlord APIs

---

### 5. Security Boundaries

**Requirements:**
- ✅ Strict tenant isolation
- ✅ X-Tenant-Slug header in all API calls
- ✅ Token-based authentication
- ✅ Secure storage (Capacitor Preferences)
- ✅ No cross-tenant data access

---

## Validation

### Manual Validation

Check if a route is allowed:
```typescript
function isRouteAllowed(route: string): boolean {
  const boundaries = require('./frontend-boundaries.json');
  const allowed = boundaries.angular_boundaries.allowed_routes;

  return [...allowed.public, ...allowed.authenticated].some(pattern => {
    return new RegExp(pattern.replace('*', '.*')).test(route);
  });
}
```

Check if an API call is allowed:
```typescript
function isApiAllowed(method: string, endpoint: string): boolean {
  const boundaries = require('./frontend-boundaries.json');
  const allowed = boundaries.angular_boundaries.allowed_api_calls;

  const pattern = `${method} ${endpoint}`;
  return Object.values(allowed).some((apis: string[]) =>
    apis.includes(pattern)
  );
}
```

---

### Automated Validation

**Pre-commit Hook:**
```bash
npm run architecture:validate
```

**CI/CD Pipeline:**
```bash
npm run architecture:check
```

---

## Development Guidelines

### DO ✅

1. **Use allowed domains only**
   ```typescript
   // Good
   const apiUrl = 'https://tenant1.publicdigit.com/api/v1';
   const mobileUrl = 'https://app.publicdigit.com/api/v1';
   ```

2. **Implement DDD contexts properly**
   ```typescript
   // Good - Dedicated service per context
   @Injectable()
   export class ElectionService {
     // Election Context operations only
   }
   ```

3. **Include required headers**
   ```typescript
   // Good - Headers added by interceptor
   this.http.get('/api/v1/elections'); // X-Tenant-Slug auto-added
   ```

4. **Use TypeScript strictly**
   ```typescript
   // Good - Full type safety
   interface Election {
     id: number;
     title: string;
   }
   ```

### DON'T ❌

1. **Access prohibited domains**
   ```typescript
   // Bad
   const adminUrl = 'https://admin.publicdigit.com/api';
   ```

2. **Mix contexts**
   ```typescript
   // Bad - Mixing Membership and Election logic
   @Injectable()
   export class MemberElectionService {
     // Wrong - should be separate services
   }
   ```

3. **Use prohibited imports**
   ```typescript
   // Bad
   import { Inertia } from '@inertiajs/vue3';
   import { useForm } from 'inertia-vue3';
   ```

4. **Access landlord data**
   ```typescript
   // Bad
   this.http.get('/api/admin/tenants'); // Prohibited!
   ```

---

## Context Implementation Checklist

For each DDD context, ensure:

- [ ] Service created (`<Context>Service`)
- [ ] Models defined (`<context>.models.ts`)
- [ ] Module created (if complex enough)
- [ ] Routes defined
- [ ] Components created
- [ ] API integration complete
- [ ] Error handling implemented
- [ ] Type safety enforced
- [ ] Tests written

---

## Monitoring & Alerts

### What We Monitor

- Route access attempts (allowed vs prohibited)
- API calls (allowed vs prohibited)
- Technology imports (Angular vs prohibited)
- Tenant isolation violations
- Security boundary violations

### How to Check Logs

**Development:**
```javascript
// Console logs prefixed with context
🔒 [ARCHITECTURE] Route access: /elections (allowed)
⚠️  [ARCHITECTURE] Route access: /admin (BLOCKED)
❌ [ARCHITECTURE] API call: GET /api/admin/tenants (PROHIBITED)
```

**Production:**
- Logs sent to monitoring service
- Alerts on prohibited access attempts
- Daily architecture compliance reports

---

## Troubleshooting

### Issue: Route not loading

**Check:**
1. Is route in `allowed_routes`?
2. Is user authenticated (for protected routes)?
3. Check console for architecture warnings

**Fix:**
- Add route to `frontend-boundaries.json` if legitimate
- Implement proper auth guard
- Review architectural boundaries

---

### Issue: API call fails with 403

**Check:**
1. Is API in `allowed_api_calls`?
2. Is X-Tenant-Slug header present?
3. Is user authenticated?

**Fix:**
- Ensure API is in allowed list
- Check tenant interceptor is working
- Verify auth token is valid

---

### Issue: Build fails with import error

**Check:**
1. Are you importing prohibited technology?
2. Check `prohibited_imports` list

**Fix:**
- Remove Inertia/Vue3 imports
- Use Angular patterns only
- Review technology constraints

---

## Support

**Questions?**
- Review architectural manifest
- Check frontend boundaries
- Consult implementation plan: `architect/20251115_1500_architecture_analysis_and_implementation_plan.md`

**Found a violation?**
- Document in architecture validation log
- Fix immediately
- Add test to prevent recurrence

---

**Last Updated:** November 15, 2025
**Maintained By:** Architecture Team
**Version:** 1.0.0
