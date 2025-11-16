import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ArchitectureService } from '../services/architecture.service';

/**
 * Architecture Guard
 *
 * Validates route navigation against architectural boundaries.
 * Prevents Angular app from accessing routes prohibited by architecture manifest.
 *
 * Usage:
 * ```typescript
 * {
 *   path: 'elections',
 *   canActivate: [architectureGuard],
 *   loadChildren: () => import('./features/elections/elections.routes')
 * }
 * ```
 */
export const architectureGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const architectureService = inject(ArchitectureService);
  const router = inject(Router);

  // Get the target route path
  const targetRoute = state.url;

  // Validate route against boundaries
  const validationResult = architectureService.canNavigate(targetRoute);

  if (!validationResult.allowed) {
    // Log the violation
    architectureService.logViolation(targetRoute, validationResult);

    console.error(
      `[ArchitectureGuard] Navigation blocked to '${targetRoute}':`,
      validationResult.reason
    );

    // Redirect to home page
    router.navigate(['/']);
    return false;
  }

  // Allow navigation
  return true;
};

/**
 * Admin Route Guard
 *
 * Specifically blocks access to admin routes.
 * This is a stricter guard that always blocks admin routes regardless of boundaries.
 *
 * Usage:
 * ```typescript
 * {
 *   path: 'admin',
 *   canActivate: [blockAdminGuard]
 * }
 * ```
 */
export const blockAdminGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const router = inject(Router);
  const targetRoute = state.url;

  // Block any admin routes
  if (targetRoute.startsWith('/admin') || targetRoute.includes('/admin/')) {
    console.error(
      `[ArchitectureGuard] Admin route access blocked: ${targetRoute}`
    );

    // Redirect to home
    router.navigate(['/']);
    return false;
  }

  return true;
};

/**
 * API Access Guard
 *
 * Validates API access against architectural boundaries.
 * Can be used with HTTP interceptors for comprehensive API protection.
 */
export class ApiAccessValidator {
  constructor(private architectureService: ArchitectureService) {}

  /**
   * Validate if Angular app can access the given API route
   *
   * @param apiRoute - API route to validate
   * @returns boolean
   */
  canAccessApi(apiRoute: string): boolean {
    const result = this.architectureService.canAccessApi(apiRoute);

    if (!result.allowed) {
      this.architectureService.logViolation(apiRoute, result);
      console.error(
        `[ApiAccessValidator] API access blocked to '${apiRoute}':`,
        result.reason
      );
    }

    return result.allowed;
  }
}
