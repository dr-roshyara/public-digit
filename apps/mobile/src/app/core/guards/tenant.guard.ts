import { inject, Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, UrlTree } from '@angular/router';
import { TenantContextService } from '../services/tenant-context.service';
import { DomainService } from '../services/domain.service';

/**
 * Tenant Guard
 *
 * Protects routes that require tenant context to be set.
 *
 * **Purpose:**
 * - Verify tenant context exists before allowing route access
 * - Redirect to tenant selection if no context
 * - Validate tenant slug matches current domain
 *
 * **Usage:**
 * ```typescript
 * {
 *   path: 'elections',
 *   canActivate: [authGuard, tenantGuard],
 *   component: ElectionsComponent
 * }
 * ```
 *
 * **Redirect Logic:**
 * - No tenant context → `/tenant-selection`
 * - Tenant mismatch → `/tenant-selection?error=tenant-mismatch`
 * - Public domain → Allow (tenant context not required)
 */
@Injectable({
  providedIn: 'root'
})
export class TenantGuard implements CanActivate, CanActivateChild {
  private router = inject(Router);
  private tenantContext = inject(TenantContextService);
  private domainService = inject(DomainService);

  /**
   * Can activate route - check tenant context requirement
   */
  canActivate(): boolean | UrlTree {
    try {
      const domainInfo = this.domainService.getCurrentDomainInfo();

      // Public domain doesn't require tenant context
      if (domainInfo.isPublicDomain) {
        return true;
      }

      // On tenant domain, verify tenant context exists
      if (domainInfo.isTenantDomain) {
        return this.validateTenantContext(domainInfo.tenantSlug);
      }

      // Mobile/platform domains - check if tenant context is set
      return this.validateTenantContext(null);

    } catch (error) {
      console.error('[TenantGuard] Error checking tenant context:', error);
      return this.redirectToTenantSelection('tenant-context-error');
    }
  }

  /**
   * Can activate child route - delegate to canActivate
   */
  canActivateChild(): boolean | UrlTree {
    return this.canActivate();
  }

  /**
   * Validate tenant context exists and matches domain
   *
   * @param expectedSlug - Expected tenant slug from domain (null if not on tenant domain)
   * @returns true if valid, UrlTree for redirect if invalid
   */
  private validateTenantContext(expectedSlug: string | null | undefined): boolean | UrlTree {
    // Check if tenant context exists
    if (!this.tenantContext.hasTenant()) {
      console.warn('[TenantGuard] Tenant context required but not set');
      return this.redirectToTenantSelection('tenant-context-required');
    }

    // If on tenant domain, verify slug matches
    if (expectedSlug) {
      const currentSlug = this.tenantContext.getTenantSlug();

      if (currentSlug !== expectedSlug) {
        console.warn('[TenantGuard] Tenant slug mismatch:', {
          expected: expectedSlug,
          current: currentSlug
        });
        return this.redirectToTenantSelection('tenant-mismatch');
      }
    }

    // Tenant context is valid
    return true;
  }

  /**
   * Redirect to tenant selection page with error
   *
   * @param error - Error code for display
   * @returns UrlTree for redirect
   */
  private redirectToTenantSelection(error: string): UrlTree {
    return this.router.createUrlTree(['/tenant-selection'], {
      queryParams: { error }
    });
  }
}
