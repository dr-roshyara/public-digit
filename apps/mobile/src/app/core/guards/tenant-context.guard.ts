import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';

/**
 * Tenant Context Guard
 *
 * Simple guard that checks if tenant context is set in ApiService.
 * Used for routes that require tenant-specific API calls.
 *
 * With simplified mobile architecture:
 * - Tenant slug is set during login via AuthService
 * - ApiService stores tenant slug in localStorage
 * - This guard ensures tenant context exists before accessing tenant-specific routes
 *
 * Usage:
 * ```typescript
 * {
 *   path: 'dashboard',
 *   canActivate: [authGuard, tenantContextGuard],
 *   component: DashboardComponent
 * }
 * ```
 */
export const tenantContextGuard = () => {
  const apiService = inject(ApiService);
  const router = inject(Router);

  const currentTenant = apiService.getTenantSlug();

  if (currentTenant) {
    console.log(`✅ Tenant context verified: ${currentTenant}`);
    return true;
  } else {
    console.warn('⚠️ No tenant context, redirecting to login');
    // Redirect to login where user can enter tenant slug
    router.navigate(['/login']);
    return false;
  }
};