/**
 * TranslatePipe - Template Translation Pipe
 *
 * DDD PRESENTATION LAYER - View transformation
 *
 * PURPOSE:
 * - Provide simple translation syntax in templates
 * - Auto-update when translations change (reactive)
 * - Support parameter interpolation
 *
 * USAGE IN TEMPLATES:
 * ```html
 * <!-- Simple translation -->
 * <h1>{{ 'common.welcome' | translate }}</h1>
 *
 * <!-- With parameters -->
 * <p>{{ 'common.greeting' | translate:{ name: 'John' } }}</p>
 *
 * <!-- Reactive - updates when locale changes -->
 * <button>{{ 'common.buttons.save' | translate }}</button>
 * ```
 *
 * ARCHITECTURE:
 * Template → TranslatePipe → TranslationService (Application) → TranslationLoaderRepository (Domain)
 *
 * MOVED FROM: core/i18n/pipes/ (DDD Layer Correction)
 * REASON: Pipes are presentation-layer concerns (view transformations)
 */

import { Pipe, PipeTransform, inject, ChangeDetectorRef, OnDestroy, DestroyRef } from '@angular/core';
import { TranslationService } from '@application/services';
import { effect, Injector } from '@angular/core';

/**
 * Translation pipe with reactive updates
 *
 * This pipe automatically updates when:
 * 1. User changes language
 * 2. Route changes (new translations loaded)
 * 3. Translation values change
 *
 * Impure pipe to allow reactive updates
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Impure to allow reactive updates
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private translationService = inject(TranslationService);
  private cdr = inject(ChangeDetectorRef);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Setup reactive effect to trigger change detection when translations change
    // Effect is automatically cleaned up when the pipe is destroyed (Angular 16+)
    effect(() => {
      // Read translations signal to establish dependency
      this.translationService.translations();

      // Trigger change detection when translations update
      this.cdr.markForCheck();
    }, {
      injector: this.injector,
      manualCleanup: false // Auto cleanup on destroy
    });
  }

  /**
   * Transform translation key to translated string
   *
   * @param key - Translation key (e.g., 'common.welcome')
   * @param params - Optional parameters for interpolation
   * @returns Translated string or key if not found
   *
   * @example
   * ```html
   * <!-- Simple -->
   * <h1>{{ 'home.hero.title' | translate }}</h1>
   *
   * <!-- With params -->
   * <p>{{ 'common.greeting' | translate:{ name: user.name } }}</p>
   * ```
   */
  transform(key: string, params?: Record<string, any>): string {
    if (!key) {
      console.warn('[TranslatePipe] Empty translation key provided');
      return '';
    }

    return this.translationService.translate(key, params);
  }

  /**
   * Cleanup on pipe destruction
   * Effect cleanup is handled automatically by Angular
   */
  ngOnDestroy(): void {
    // Effect is automatically cleaned up via destroyRef
    // No manual cleanup needed
  }
}
