import { inject, Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Anonymous Guard
 *
 * Protects routes that should only be accessed by unauthenticated users
 * (e.g., login, register pages)
 *
 * **Purpose:**
 * - Allow unauthenticated users to access auth pages
 * - Redirect authenticated users to dashboard
 *
 * **Usage:**
 * ```typescript
 * {
 *   path: 'login',
 *   canActivate: [anonymousGuard],
 *   component: LoginComponent
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class AnonymousGuard implements CanActivate {
  private router = inject(Router);
  private authService = inject(AuthService);

  /**
   * Can activate route - only allow if not authenticated
   */
  canActivate(): boolean | UrlTree {
    // If user is authenticated, redirect to dashboard
    if (this.authService.isAuthenticated()) {
      return this.router.createUrlTree(['/dashboard']);
    }

    // Allow anonymous users
    return true;
  }
}
