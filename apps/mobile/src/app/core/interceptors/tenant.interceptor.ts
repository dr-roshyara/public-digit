import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantContextService } from '../services/tenant-context.service';
import { environment } from '../../../environments/environment';

/**
 * Tenant HTTP Interceptor
 *
 * Automatically adds X-Tenant-Slug header to all API requests
 * based on current tenant context (subdomain or stored value)
 *
 * Header is only added if:
 * 1. Request is going to our API (not external URLs)
 * 2. Tenant context is available
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantContext = inject(TenantContextService);

  // Only intercept API calls to our backend
  // Skip external URLs and assets
  if (!req.url.includes('/mapi/v1')) {
    return next(req);
  }

  // Skip if no tenant context available
  if (!tenantContext.hasTenantContext()) {
    console.log('⚠️ Tenant Interceptor: No tenant context, skipping header injection');
    return next(req);
  }

  // Get tenant headers
  const tenantHeaders = tenantContext.getTenantHeaders();

  // Clone request and merge tenant headers with existing headers
  // This preserves any existing headers (Authorization, Content-Type, etc.)
  const clonedReq = req.clone({
    setHeaders: {
      'X-Tenant-Slug': tenantHeaders.get('X-Tenant-Slug') || ''
    }
  });

  console.log(`🔀 Tenant Interceptor: Injected X-Tenant-Slug for ${req.url}`);

  return next(clonedReq);
};
