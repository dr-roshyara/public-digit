import { inject, Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { DomainService } from '../services/domain.service';

/**
 * Public Guard
 *
 * Allows access to public routes (available on all domains)
 *
 * **Purpose:**
 * - Public routes are accessible everywhere
 * - No restrictions based on domain or authentication
 *
 * **Usage:**
 * ```typescript
 * {
 *   path: 'about',
 *   canActivate: [publicGuard],
 *   component: AboutComponent
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class PublicGuard implements CanActivate {
  private domainService = inject(DomainService);

  /**
   * Can activate route - public routes always allowed
   */
  canActivate(): boolean {
    // Public routes are accessible from any domain
    return true;
  }
}
