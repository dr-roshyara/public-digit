import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import {
  ArchitectureBoundaries,
  ArchitecturalManifest,
  RouteValidationResult,
  FrontendBoundary
} from '../models/architecture.models';
import { environment } from '../../../environments/environment';

/**
 * Architecture Service
 *
 * Consumes architectural boundaries from Laravel backend (single source of truth).
 * Provides route validation and boundary enforcement on the client side.
 *
 * Backend Location: packages/laravel-backend/architecture/
 */
@Injectable({
  providedIn: 'root'
})
export class ArchitectureService {
  private http = inject(HttpClient);

  private boundariesSubject = new BehaviorSubject<ArchitectureBoundaries | null>(null);
  private manifestSubject = new BehaviorSubject<ArchitecturalManifest | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  public boundaries$ = this.boundariesSubject.asObservable();
  public manifest$ = this.manifestSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  /**
   * Get current boundaries (synchronous)
   */
  get boundaries(): ArchitectureBoundaries | null {
    return this.boundariesSubject.value;
  }

  /**
   * Get current manifest (synchronous)
   */
  get manifest(): ArchitecturalManifest | null {
    return this.manifestSubject.value;
  }

  /**
   * Get base URL for architecture files (platform/landlord level)
   * Architecture files are served from the platform, not tenant-specific
   */
  private getArchitectureBaseUrl(): string {
    // Architecture files are at platform level (landlord DB)
    // For development: http://localhost:8000
    // For production: https://publicdigit.com
    if (environment.production) {
      return 'https://publicdigit.com';
    }
    return 'http://localhost:8000';
  }

  /**
   * Load architectural boundaries from backend
   *
   * @returns Promise<void>
   */
  async loadBoundaries(): Promise<void> {
    if (this.boundariesSubject.value) {
      // Already loaded
      return;
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    try {
      // Fetch boundaries from Laravel backend
      // Architecture files are served from packages/laravel-backend/architecture/
      const baseUrl = this.getArchitectureBaseUrl();
      const result = await firstValueFrom(
        this.http.get<ArchitectureBoundaries>(
          `${baseUrl}/architecture/frontend-boundaries.json`,
          {
            // Add timeout to prevent hanging requests
            // @ts-ignore - HttpClient context options
            context: { timeout: 5000 }
          }
        ).pipe(
          tap(() => console.log('[ArchitectureService] Boundaries loaded from backend')),
          catchError(error => {
            // Graceful degradation: Use local fallback boundaries
            console.warn('⚠️ Architecture Service: Backend unavailable, using local fallback');
            console.debug('Error details:', error);

            // Return local fallback instead of throwing
            return of(this.getLocalFallbackBoundaries());
          })
        )
      );

      // Type assertion to fix TypeScript union type inference
      const boundaries = result as ArchitectureBoundaries;
      this.boundariesSubject.next(boundaries);
      console.log('✅ Architecture boundaries initialized');
    } catch (error) {
      console.warn('[ArchitectureService] Using fallback boundaries:', error);
      // Fail open with local fallback
      this.boundariesSubject.next(this.getLocalFallbackBoundaries());
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Load architectural manifest from backend
   *
   * @returns Promise<void>
   */
  async loadManifest(): Promise<void> {
    if (this.manifestSubject.value) {
      // Already loaded
      return;
    }

    try {
      const baseUrl = this.getArchitectureBaseUrl();
      const manifest = await firstValueFrom(
        this.http.get<ArchitecturalManifest>(
          `${baseUrl}/architecture/architectural-manifest.json`
        ).pipe(
          catchError(error => {
            console.error('Failed to load architectural manifest:', error);
            throw error;
          })
        )
      );

      this.manifestSubject.next(manifest);
      console.log('[ArchitectureService] Manifest loaded successfully');
    } catch (error) {
      console.error('[ArchitectureService] Error loading manifest:', error);
    }
  }

  /**
   * Initialize architecture service
   * Loads both boundaries and manifest
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.loadBoundaries(),
      this.loadManifest()
    ]);
  }

  /**
   * Validate if Angular app can navigate to a given route
   *
   * @param route - Route path to validate
   * @returns RouteValidationResult
   */
  canNavigate(route: string): RouteValidationResult {
    const boundaries = this.boundariesSubject.value;

    if (!boundaries) {
      // Fail open: If boundaries not loaded, allow navigation
      // This ensures app doesn't break if backend is unreachable
      console.warn('[ArchitectureService] Boundaries not loaded, allowing navigation');
      return { allowed: true };
    }

    const angularBoundaries = boundaries.angular_boundaries;

    // Normalize route (remove leading slash for comparison)
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

    // Check if route is prohibited
    if (this.isProhibitedRoute(normalizedRoute, angularBoundaries)) {
      return {
        allowed: false,
        reason: `Route '${route}' is prohibited for Angular app`,
        violationType: 'prohibited_route'
      };
    }

    // Check if route is allowed
    if (this.isAllowedRoute(normalizedRoute, angularBoundaries)) {
      return { allowed: true };
    }

    // Route not explicitly allowed or prohibited
    // Default: allow for tenant routes, block for admin routes
    if (this.isAdminRoute(normalizedRoute)) {
      return {
        allowed: false,
        reason: `Route '${route}' appears to be an admin route`,
        violationType: 'wrong_frontend'
      };
    }

    return { allowed: true };
  }

  /**
   * Validate if Angular app can access a given API route
   *
   * @param apiRoute - API route path to validate
   * @returns RouteValidationResult
   */
  canAccessApi(apiRoute: string): RouteValidationResult {
    const boundaries = this.boundariesSubject.value;

    if (!boundaries) {
      console.warn('[ArchitectureService] Boundaries not loaded, allowing API access');
      return { allowed: true };
    }

    const angularBoundaries = boundaries.angular_boundaries;
    const normalizedRoute = apiRoute.startsWith('/') ? apiRoute : `/${apiRoute}`;

    // Check if API route is prohibited
    if (this.isProhibitedApiRoute(normalizedRoute, angularBoundaries)) {
      return {
        allowed: false,
        reason: `API route '${apiRoute}' is prohibited for Angular app`,
        violationType: 'prohibited_api'
      };
    }

    // Check if API route is allowed
    if (this.isAllowedApiRoute(normalizedRoute, angularBoundaries)) {
      return { allowed: true };
    }

    // Default: block unknown API routes for safety
    return {
      allowed: false,
      reason: `API route '${apiRoute}' is not in allowed list`,
      violationType: 'prohibited_api'
    };
  }

  /**
   * Check if route is in prohibited list
   */
  private isProhibitedRoute(route: string, boundaries: FrontendBoundary): boolean {
    return boundaries.prohibited_routes.some(prohibited =>
      this.matchesPattern(route, prohibited)
    );
  }

  /**
   * Check if route is in allowed list
   */
  private isAllowedRoute(route: string, boundaries: FrontendBoundary): boolean {
    return boundaries.allowed_routes.some(allowed =>
      this.matchesPattern(route, allowed)
    );
  }

  /**
   * Check if API route is in prohibited list
   */
  private isProhibitedApiRoute(route: string, boundaries: FrontendBoundary): boolean {
    return boundaries.prohibited_api_routes.some(prohibited =>
      this.matchesPattern(route, prohibited)
    );
  }

  /**
   * Check if API route is in allowed list
   */
  private isAllowedApiRoute(route: string, boundaries: FrontendBoundary): boolean {
    return boundaries.allowed_api_routes.some(allowed =>
      this.matchesPattern(route, allowed)
    );
  }

  /**
   * Check if route appears to be an admin route
   */
  private isAdminRoute(route: string): boolean {
    return route.startsWith('/admin') || route.includes('/admin/');
  }

  /**
   * Match route against pattern (supports wildcards)
   *
   * @param route - Route to match
   * @param pattern - Pattern with optional wildcards (*)
   * @returns boolean
   */
  private matchesPattern(route: string, pattern: string): boolean {
    if (pattern === route) {
      return true;
    }

    // Handle wildcard patterns (e.g., "/admin/*")
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\//g, '\\/');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(route);
    }

    // Exact match or prefix match
    return route === pattern || route.startsWith(pattern.replace('/*', '/'));
  }

  /**
   * Log architecture violation
   *
   * @param route - Route that caused violation
   * @param result - Validation result
   */
  logViolation(route: string, result: RouteValidationResult): void {
    console.error('[ARCHITECTURE VIOLATION]', {
      route,
      reason: result.reason,
      type: result.violationType,
      timestamp: new Date().toISOString()
    });

    // In production, this could send to analytics/monitoring
    if (environment.production) {
      // TODO: Send to monitoring service
    }
  }

  /**
   * Get local fallback boundaries when backend is unavailable
   *
   * PRODUCTION PATTERN: Graceful Degradation
   * - Used when Laravel backend is not accessible
   * - Provides safe defaults for mobile app
   * - Prevents app blocking while backend is down
   *
   * @returns ArchitectureBoundaries - Safe default boundaries
   */
  private getLocalFallbackBoundaries(): ArchitectureBoundaries {
    return {
      angular_boundaries: {
        technology: 'Angular',
        purpose: 'Mobile-first tenant user interface',
        domains: ['*.publicdigit.com', 'localhost:4200'],
        allowed_routes: [
          '/',
          '/login',
          '/register',
          '/dashboard',
          '/elections',
          '/elections/*',
          '/profile',
          '/profile/*',
          '/settings',
          '/membership',
          '/membership/*',
          '/auth/*',
          '/tenant-selection'
        ],
        prohibited_routes: [
          '/admin',
          '/admin/*',
          '/setup',
          '/setup/*',
          '/tenant-provisioning',
          '/tenant-provisioning/*'
        ],
        allowed_api_routes: [
          '/api/v1/*',
          '/api/mobile/*',
          '/sanctum/csrf-cookie'
        ],
        prohibited_api_routes: [
          '/api/admin/*',
          '/api/setup/*',
          '/api/tenant-provisioning/*'
        ]
      },
      inertia_vue_boundaries: {
        technology: 'Inertia.js + Vue 3',
        purpose: 'Desktop admin and tenant management interface',
        domains: ['publicdigit.com', '*.publicdigit.com', 'localhost:8000'],
        allowed_routes: [
          '/admin',
          '/admin/*',
          '/setup',
          '/setup/*',
          '/tenant-provisioning',
          '/tenant-provisioning/*',
          '/dashboard',
          '/elections',
          '/elections/*'
        ],
        prohibited_routes: [
          '/mobile',
          '/mobile/*'
        ],
        allowed_api_routes: [
          '/api/*',
          '/sanctum/csrf-cookie'
        ],
        prohibited_api_routes: []
      },
      enforcement: {
        enabled: true,
        log_violations: true,
        abort_on_violation: false,
        violation_response: {
          status_code: 403,
          message: 'Architecture boundary violation'
        }
      }
    };
  }
}
