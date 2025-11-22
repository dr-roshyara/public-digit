import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, throwError, from } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { DomainService, DomainType } from './domain.service';
import { ArchitectureService } from './architecture.service';
import { environment } from '../../../environments/environment';
import { AutoLocaleDetectionService } from '@application/services/auto-locale-detection.service';

/**
 * Application Initialization Configuration
 *
 * Defines the initialization state and configuration for the application
 */
export interface AppInitConfig {
  domainType: DomainType;
  tenantSlug?: string;
  architectureBoundariesLoaded: boolean;
  authenticationInitialized: boolean;
  localeDetectionInitialized: boolean;  // New: locale detection status
  detectedLocale?: string;               // New: detected locale
  tenantContextSet: boolean;
  initialized: boolean;
  error?: string;
}

/**
 * Initialization Result
 *
 * Result returned from initialization process
 */
export interface InitializationResult {
  success: boolean;
  config: AppInitConfig;
  message: string;
}

/**
 * Application Initialization Service
 *
 * Orchestrates the bootstrap process for the Angular application.
 * This service runs during APP_INITIALIZER phase and sets up:
 * - Domain detection and configuration
 * - Architecture boundary loading
 * - Authentication state initialization
 * - Tenant context setup (if applicable)
 *
 * Execution Order:
 * 1. Detect domain type (public, landlord, tenant, mobile, platform)
 * 2. Load architecture boundaries from backend
 * 3. Validate current domain against boundaries
 * 4. Initialize authentication state
 * 4.5. Initialize locale detection (geo-location + browser language)
 * 5. Set tenant context if on tenant domain
 * 6. Configure routing based on domain type
 *
 * @example
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     {
 *       provide: APP_INITIALIZER,
 *       useFactory: (appInit: AppInitService) => () => appInit.initialize(),
 *       deps: [AppInitService],
 *       multi: true
 *     }
 *   ]
 * };
 */
@Injectable({
  providedIn: 'root'
})
export class AppInitService {
  private http = inject(HttpClient);
  private domainService = inject(DomainService);
  private architectureService = inject(ArchitectureService);
  private autoLocaleService = inject(AutoLocaleDetectionService);

  private initConfig: AppInitConfig = {
    domainType: 'unknown',
    architectureBoundariesLoaded: false,
    authenticationInitialized: false,
    localeDetectionInitialized: false,
    tenantContextSet: false,
    initialized: false,
  };

  /**
   * Initialize the application
   *
   * This is the main entry point called by APP_INITIALIZER.
   * Returns a Promise that resolves when initialization is complete.
   *
   * @returns Promise<boolean> - Resolves to true on success, false on failure
   */
  initialize(): Promise<boolean> {
    console.log('[AppInitService] Starting application initialization...');

    return this.performInitialization()
      .pipe(
        map(result => {
          console.log('[AppInitService] Initialization completed:', result);
          return result.success;
        }),
        catchError(error => {
          console.error('[AppInitService] Initialization failed:', error);
          this.initConfig.error = error.message || 'Unknown initialization error';
          this.initConfig.initialized = false;

          // Return false but don't block app startup
          return of(false);
        })
      )
      .toPromise()
      .then(success => success ?? false);
  }

  /**
   * Perform the initialization sequence
   *
   * @returns Observable<InitializationResult>
   */
  private performInitialization(): Observable<InitializationResult> {
    return this.detectDomain().pipe(
      switchMap(() => this.loadArchitectureBoundaries()),
      switchMap(() => this.validateDomainBoundaries()),
      switchMap(() => this.initializeAuthentication()),
      switchMap(() => this.initializeLocaleDetection()),      // New: locale detection
      switchMap(() => this.setTenantContext()),
      switchMap(() => this.finalizeInitialization()),
      catchError(error => {
        console.error('[AppInitService] Initialization error:', error);
        return of({
          success: false,
          config: this.initConfig,
          message: error.message || 'Initialization failed'
        });
      })
    );
  }

  /**
   * Step 1: Detect Domain Type
   *
   * Uses DomainService to detect the current domain type and extract
   * tenant slug if applicable.
   */
  private detectDomain(): Observable<void> {
    console.log('[AppInitService] Step 1: Detecting domain type...');

    return new Observable(observer => {
      try {
        const domainInfo = this.domainService.getCurrentDomainInfo();

        this.initConfig.domainType = domainInfo.type;
        this.initConfig.tenantSlug = domainInfo.tenantSlug;

        console.log('[AppInitService] Domain detected:', {
          type: domainInfo.type,
          hostname: domainInfo.hostname,
          tenantSlug: domainInfo.tenantSlug
        });

        // Validate domain type
        if (domainInfo.type === 'unknown') {
          throw new Error(`Unknown domain type for hostname: ${domainInfo.hostname}`);
        }

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Step 2: Load Architecture Boundaries
   *
   * Fetches architecture boundaries from the backend API.
   * These boundaries define what routes and features are allowed
   * for the current domain type.
   */
  private loadArchitectureBoundaries(): Observable<void> {
    console.log('[AppInitService] Step 2: Loading architecture boundaries...');

    // Use ArchitectureService to load boundaries
    // Convert Promise to Observable using from()
    return from(this.architectureService.loadBoundaries()).pipe(
      tap(() => {
        this.initConfig.architectureBoundariesLoaded = true;
        console.log('[AppInitService] Architecture boundaries loaded successfully');
      }),
      map(() => void 0),
      catchError(error => {
        console.warn('[AppInitService] Failed to load architecture boundaries:', error);

        // Non-blocking: Allow app to continue even if boundaries fail to load
        this.initConfig.architectureBoundariesLoaded = false;
        return of(void 0);
      })
    );
  }

  /**
   * Step 3: Validate Domain Boundaries
   *
   * Validates that the current domain is allowed to run the application.
   * For tenant domains, validates that the tenant slug is valid.
   */
  private validateDomainBoundaries(): Observable<void> {
    console.log('[AppInitService] Step 3: Validating domain boundaries...');

    return new Observable(observer => {
      try {
        const domainInfo = this.domainService.getCurrentDomainInfo();

        // Validate tenant domain
        if (domainInfo.isTenantDomain) {
          if (!domainInfo.tenantSlug) {
            throw new Error('Tenant domain detected but no tenant slug found');
          }

          // Check if architecture boundaries are loaded
          if (this.initConfig.architectureBoundariesLoaded) {
            const boundaries = this.architectureService.boundaries;

            if (boundaries) {
              const routeCheck = this.architectureService.canNavigate('/');
              if (!routeCheck.allowed) {
                throw new Error('Current domain is not allowed to access this application');
              }
            }
          }
        }

        console.log('[AppInitService] Domain boundaries validated');
        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Step 4: Initialize Authentication
   *
   * Checks for existing authentication token and validates it.
   * If valid token exists, loads user information.
   */
  private initializeAuthentication(): Observable<void> {
    console.log('[AppInitService] Step 4: Initializing authentication...');

    return new Observable(observer => {
      try {
        // Check for stored auth token
        const token = localStorage.getItem('auth_token');

        if (token) {
          console.log('[AppInitService] Auth token found, validating...');

          // Validate token by attempting to fetch user info
          this.validateAuthToken(token).subscribe({
            next: (isValid) => {
              if (isValid) {
                console.log('[AppInitService] Auth token valid, user authenticated');
                this.initConfig.authenticationInitialized = true;
              } else {
                console.log('[AppInitService] Auth token invalid, clearing...');
                localStorage.removeItem('auth_token');
                this.initConfig.authenticationInitialized = false;
              }
              observer.next();
              observer.complete();
            },
            error: (error) => {
              console.warn('[AppInitService] Auth token validation failed:', error);
              localStorage.removeItem('auth_token');
              this.initConfig.authenticationInitialized = false;
              observer.next();
              observer.complete();
            }
          });
        } else {
          console.log('[AppInitService] No auth token found');
          this.initConfig.authenticationInitialized = false;
          observer.next();
          observer.complete();
        }
      } catch (error) {
        console.warn('[AppInitService] Authentication initialization error:', error);
        this.initConfig.authenticationInitialized = false;
        observer.next();
        observer.complete();
      }
    });
  }

  /**
   * Validate authentication token
   *
   * @param token - Authentication token to validate
   * @returns Observable<boolean> - True if token is valid
   */
  private validateAuthToken(token: string): Observable<boolean> {
    const apiUrl = this.domainService.getApiBaseUrl();

    return this.http.get(`${apiUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Step 4.5: Initialize Locale Detection
   *
   * Automatically detect user's locale based on geo-location, browser language, and user history.
   * This should run after authentication (to access user preferences if any)
   * and before loading tenant context (which may have localized content).
   */
  private initializeLocaleDetection(): Observable<void> {
    console.log('[AppInitService] Step 4.5: Initializing locale detection...');

    return from(
      this.autoLocaleService.initialize({
        respectUserPreference: true,
        forceRefresh: false
      })
    ).pipe(
      tap((result) => {
        this.initConfig.localeDetectionInitialized = true;
        this.initConfig.detectedLocale = result.locale;
        console.log('[AppInitService] Locale detection completed:', {
          locale: result.locale,
          confidence: result.confidence,
          source: result.source
        });
      }),
      map(() => void 0),
      catchError(error => {
        console.warn('[AppInitService] Locale detection failed, using fallback:', error);
        this.initConfig.localeDetectionInitialized = false;
        this.initConfig.detectedLocale = 'en'; // Fallback to English
        // Non-blocking: Allow app to continue
        return of(void 0);
      })
    );
  }

  /**
   * Step 5: Set Tenant Context
   *
   * If on a tenant domain, sets the tenant context for the application.
   * This includes loading tenant information and configuring API calls.
   */
  private setTenantContext(): Observable<void> {
    console.log('[AppInitService] Step 5: Setting tenant context...');

    return new Observable(observer => {
      try {
        const domainInfo = this.domainService.getCurrentDomainInfo();

        if (domainInfo.isTenantDomain && domainInfo.tenantSlug) {
          console.log('[AppInitService] Setting tenant context:', domainInfo.tenantSlug);

          // Store tenant slug for use by services
          localStorage.setItem('current_tenant_slug', domainInfo.tenantSlug);

          // Load tenant information from API
          this.loadTenantInfo(domainInfo.tenantSlug).subscribe({
            next: () => {
              this.initConfig.tenantContextSet = true;
              console.log('[AppInitService] Tenant context set successfully');
              observer.next();
              observer.complete();
            },
            error: (error) => {
              console.warn('[AppInitService] Failed to load tenant info:', error);
              this.initConfig.tenantContextSet = false;
              // Non-blocking: Allow app to continue
              observer.next();
              observer.complete();
            }
          });
        } else {
          console.log('[AppInitService] Not a tenant domain, skipping tenant context');
          this.initConfig.tenantContextSet = false;
          observer.next();
          observer.complete();
        }
      } catch (error) {
        console.warn('[AppInitService] Tenant context error:', error);
        this.initConfig.tenantContextSet = false;
        observer.next();
        observer.complete();
      }
    });
  }

  /**
   * Load tenant information from API
   *
   * @param tenantSlug - Tenant slug to load
   * @returns Observable<void>
   */
  private loadTenantInfo(tenantSlug: string): Observable<void> {
    const apiUrl = this.domainService.getApiBaseUrl();

    return this.http.get(`${apiUrl}/api/v1/tenants/${tenantSlug}`).pipe(
      tap((tenant: any) => {
        console.log('[AppInitService] Tenant info loaded:', tenant);
        localStorage.setItem('current_tenant', JSON.stringify(tenant));
      }),
      map(() => void 0),
      catchError(error => {
        console.error('[AppInitService] Failed to load tenant:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Step 6: Finalize Initialization
   *
   * Completes the initialization process and returns the result.
   */
  private finalizeInitialization(): Observable<InitializationResult> {
    console.log('[AppInitService] Step 6: Finalizing initialization...');

    this.initConfig.initialized = true;

    const result: InitializationResult = {
      success: true,
      config: { ...this.initConfig },
      message: 'Application initialized successfully'
    };

    console.log('[AppInitService] Initialization complete:', result);

    return of(result);
  }

  /**
   * Get current initialization configuration
   *
   * @returns AppInitConfig - Current initialization state
   */
  getInitConfig(): AppInitConfig {
    return { ...this.initConfig };
  }

  /**
   * Check if application is initialized
   *
   * @returns boolean - True if initialized
   */
  isInitialized(): boolean {
    return this.initConfig.initialized;
  }

  /**
   * Get domain type
   *
   * @returns DomainType - Current domain type
   */
  getDomainType(): DomainType {
    return this.initConfig.domainType;
  }

  /**
   * Get tenant slug
   *
   * @returns string | undefined - Tenant slug if on tenant domain
   */
  getTenantSlug(): string | undefined {
    return this.initConfig.tenantSlug;
  }

  /**
   * Check if on tenant domain
   *
   * @returns boolean - True if on tenant domain
   */
  isTenantDomain(): boolean {
    return this.initConfig.domainType === 'tenant' && !!this.initConfig.tenantSlug;
  }

  /**
   * Check if authentication is initialized
   *
   * @returns boolean - True if auth is initialized
   */
  isAuthenticationInitialized(): boolean {
    return this.initConfig.authenticationInitialized;
  }

  /**
   * Re-initialize application
   *
   * Useful for forcing a re-initialization after domain change or
   * other significant state changes.
   *
   * @returns Promise<boolean> - Resolves to true on success
   */
  reinitialize(): Promise<boolean> {
    console.log('[AppInitService] Re-initializing application...');

    // Reset init config
    this.initConfig = {
      domainType: 'unknown',
      architectureBoundariesLoaded: false,
      authenticationInitialized: false,
      localeDetectionInitialized: false,
      tenantContextSet: false,
      initialized: false,
    };

    return this.initialize();
  }
}
