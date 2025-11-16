import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AuthService } from './core/services/auth.service';
import { ArchitectureService } from './core/services/architecture.service';
import { DomainService } from './core/services/domain.service';
import { AppInitService } from './core/services/app-init.service';

// FIX: Renamed import from 'appRoutes' to 'routes' to match the actual export in './app.routes'
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { apiHeadersInterceptor } from './core/interceptors/api-headers.interceptor';
import { tenantInterceptor } from './core/interceptors/tenant.interceptor';

/**
 * Initialize application on startup
 *
 * This is the main bootstrap initialization function that runs before the app starts.
 * It orchestrates all initialization steps through AppInitService:
 * 1. Domain detection and configuration
 * 2. Architecture boundary loading
 * 3. Authentication state restoration
 * 4. Tenant context setup (if applicable)
 *
 * @param appInitService - Application initialization service
 * @returns Promise that resolves when initialization is complete
 */
function initializeApp(appInitService: AppInitService) {
  return () => appInitService.initialize();
} 

export const appConfig: ApplicationConfig = {
  providers: [
    // Original providers
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Router provider (now using the correctly imported 'routes')
    provideRouter(routes),

    // Core services
    ArchitectureService,
    AuthService,
    DomainService,
    AppInitService,

    // Initialize application on startup (runs before Angular bootstraps)
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AppInitService],
      multi: true
    },

    // HTTP providers (interceptors run in order: API headers → Tenant → Auth)
    provideHttpClient(withInterceptors([
      apiHeadersInterceptor,  // 1. Add base API headers (Content-Type, Accept, X-Requested-With)
      tenantInterceptor,      // 2. Add tenant context header (X-Tenant-Slug)
      authInterceptor         // 3. Add authorization header (Bearer token)
    ])),
    provideAnimations()
  ],
};