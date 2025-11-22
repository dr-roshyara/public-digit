// Angular Module for Route-First Translation System
// apps/mobile/src/app/core/i18n/i18n.module.ts
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteFirstTranslationLoader } from './route-first.loader';
import { RouteTranslationAdapter } from './route-translation.adapter';
import { EnhancedTranslationService } from '../services/enhanced-translation.service';

// Factory function to initialize route-first translation system
export function initializeTranslationSystem(
  routeAdapter: RouteTranslationAdapter,
  translationService: EnhancedTranslationService
) {
  return () => {
    // Route adapter initialization is handled in its constructor
    console.log('Route-first translation system initialized');
    return Promise.resolve();
  };
}

@NgModule({
  imports: [CommonModule],
  providers: [
    RouteFirstTranslationLoader,
    RouteTranslationAdapter,
    EnhancedTranslationService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslationSystem,
      deps: [RouteTranslationAdapter, EnhancedTranslationService],
      multi: true
    }
  ]
})
export class I18nModule { }