import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

// FIX: Renamed import from 'appRoutes' to 'routes' to match the actual export in './app.routes'
import { routes } from './app.routes'; 
import { authInterceptor } from './core/interceptors/auth.interceptor'; 

export const appConfig: ApplicationConfig = {
  providers: [
    // Original providers
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    
    // Router provider (now using the correctly imported 'routes')
    provideRouter(routes), 
    
    // HTTP providers
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations()
  ],
};