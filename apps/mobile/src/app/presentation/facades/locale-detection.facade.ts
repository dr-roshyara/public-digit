/**
 * LocaleDetectionFacade - Presentation Facade
 *
 * DDD PRESENTATION LAYER - Simplifies application layer for UI components
 *
 * PURPOSE:
 * - Provide simple, component-friendly API
 * - Handle presentation concerns (loading states, errors)
 * - Adapt application DTOs to view models
 * - Manage component-level state
 *
 * ARCHITECTURE:
 * Components → Presentation Facade → Application Service → Domain
 *
 * USES LAZY SERVICE INJECTION to avoid circular dependencies
 */

import { Injectable, inject, signal, computed, Injector } from '@angular/core';
import { AutoLocaleDetectionService, LocaleDetectionResult, LocaleDetectionStatus } from '@application/services/auto-locale-detection.service';
import { LocaleStateService } from '@application/services';

/**
 * View Model for locale selection UI
 */
export interface LocaleOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isDefault?: boolean;
}

/**
 * View Model for locale detection state (presentation-friendly)
 */
export interface LocaleDetectionViewModel {
  currentLocale: string;
  availableLocales: LocaleOption[];
  isLoading: boolean;
  errorMessage: string | null;
  hasUserPreference: boolean;
  detectedCountry: string | null;
  detectionSource: string;
}

/**
 * Presentation Facade for Locale Detection
 *
 * PROVIDES:
 * - Reactive signals for components
 * - Simple methods for user actions
 * - View models instead of raw DTOs
 * - Presentation-level error handling
 *
 * USES LAZY INJECTION to avoid circular dependencies
 */
@Injectable({ providedIn: 'root' })
export class LocaleDetectionFacade {
  private injector = inject(Injector);
  private localeState = inject(LocaleStateService);

  // Lazy service injection - initialized only when needed
  private _autoLocaleService?: AutoLocaleDetectionService;

  // ======== REACTIVE STATE (Signal-based) ========

  private readonly _state = signal<LocaleDetectionViewModel>({
    currentLocale: 'en',
    availableLocales: this.getDefaultLocaleOptions(),
    isLoading: false,
    errorMessage: null,
    hasUserPreference: false,
    detectedCountry: null,
    detectionSource: 'browser'
  });

  // ======== PUBLIC COMPUTED SIGNALS ========

  /**
   * Current locale signal
   */
  readonly currentLocale = computed(() => this._state().currentLocale);

  /**
   * Loading state signal
   */
  readonly isLoading = computed(() => this._state().isLoading);

  /**
   * Error message signal
   */
  readonly errorMessage = computed(() => this._state().errorMessage);

  /**
   * Available locales signal
   */
  readonly availableLocales = computed(() => this._state().availableLocales);

  /**
   * Has user preference signal
   */
  readonly hasUserPreference = computed(() => this._state().hasUserPreference);

  /**
   * Detected country signal (for debug panel)
   */
  readonly detectedCountry = computed(() => this._state().detectedCountry);

  /**
   * Detection source signal (for debug panel)
   */
  readonly detectionSource = computed(() => this._state().detectionSource);

  /**
   * Complete view model signal
   */
  readonly viewModel = computed((): LocaleDetectionViewModel => this._state());

  // ======== LAZY SERVICE ACCESS ========

  /**
   * Get the service instance (lazy initialization to break circular dependencies)
   * This is the key to avoiding circular dependency errors
   */
  private getService(): AutoLocaleDetectionService {
    if (!this._autoLocaleService) {
      this._autoLocaleService = this.injector.get(AutoLocaleDetectionService);
    }
    return this._autoLocaleService;
  }

  // ======== USER ACTIONS (called from components) ========

  /**
   * Initialize automatic locale detection
   *
   * USAGE: Call from app initializer or landing component
   *
   * @example
   * ```typescript
   * async ngOnInit() {
   *   const result = await this.localeFacade.initialize();
   *   console.log('Detected locale:', result.locale);
   * }
   * ```
   */
  async initialize(options?: {
    respectUserPreference?: boolean;
    forceRefresh?: boolean;
  }): Promise<LocaleDetectionResult> {
    this._state.update(state => ({ ...state, isLoading: true, errorMessage: null }));

    try {
      const service = this.getService();
      const result = await service.initialize(options);

      // Update state from result
      this.updateStateFromResult(result);

      // Update shared locale state (triggers TranslationService)
      // Map LocaleDetectionResult.source to LocaleChangeEvent.source
      const localeChangeSource = result.source === 'user-explicit' ? 'user' : 'geo-location';
      this.localeState.setLocale(result.locale, localeChangeSource);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Locale detection failed';
      console.error('Facade: Failed to initialize locale detection:', error);

      this._state.update(state => ({
        ...state,
        isLoading: false,
        errorMessage
      }));

      throw error;
    }
  }

  /**
   * Set user's locale preference
   *
   * USAGE: Call from language selector component
   *
   * @example
   * ```typescript
   * async onLanguageChange(locale: string) {
   *   const success = await this.localeFacade.setLocale(locale);
   *   if (success) {
   *     this.notificationService.show('Language changed');
   *   }
   * }
   * ```
   */
  async setLocale(locale: string): Promise<boolean> {
    this._state.update(state => ({ ...state, isLoading: true, errorMessage: null }));

    try {
      const service = this.getService();
      const success = await service.setUserPreference(locale);

      if (success) {
        const status = service.getCurrentStatus();
        this.updateStateFromStatus(status);

        // Update shared locale state (triggers TranslationService)
        this.localeState.setLocale(locale, 'user');
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set locale';
      console.error('Facade: Failed to set locale:', error);

      this._state.update(state => ({
        ...state,
        isLoading: false,
        errorMessage
      }));

      return false;
    }
  }

  /**
   * Clear user preference and re-detect
   *
   * USAGE: Call from settings "Reset to auto-detect" button
   *
   * @example
   * ```typescript
   * async onResetToAutoDetect() {
   *   const result = await this.localeFacade.resetToAutoDetect();
   *   console.log('Auto-detected:', result.locale);
   * }
   * ```
   */
  async resetToAutoDetect(): Promise<LocaleDetectionResult> {
    this._state.update(state => ({ ...state, isLoading: true, errorMessage: null }));

    try {
      const service = this.getService();
      const result = await service.clearUserPreference();
      this.updateStateFromResult(result);

      // Update shared locale state (triggers TranslationService)
      this.localeState.setLocale(result.locale, 'auto-detect');

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset locale';
      console.error('Facade: Failed to reset to auto-detect:', error);

      this._state.update(state => ({
        ...state,
        isLoading: false,
        errorMessage
      }));

      throw error;
    }
  }

  // ======== QUERIES (read-only access) ========

  /**
   * Get current locale (synchronous)
   */
  getCurrentLocale(): string {
    return this._state().currentLocale;
  }

  /**
   * Get available locale options for UI
   */
  getAvailableLocaleOptions(): LocaleOption[] {
    return this.getDefaultLocaleOptions();
  }

  /**
   * Get health status for admin/debug UI
   */
  getHealthStatus() {
    const service = this.getService();
    return service.getHealthStatus();
  }

  /**
   * Get current detection status
   */
  getCurrentStatus(): LocaleDetectionStatus {
    const service = this.getService();
    return service.getCurrentStatus();
  }

  // ======== PRIVATE HELPERS ========

  /**
   * Get default locale options with English always first
   */
  private getDefaultLocaleOptions(): LocaleOption[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isDefault: true },
      { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
      { code: 'np', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' }
    ];
  }

  /**
   * Update state from detection result
   */
  private updateStateFromResult(result: LocaleDetectionResult): void {
    const service = this.getService();
    const status = service.getCurrentStatus();
    this.updateStateFromStatus(status);
  }

  /**
   * Update state from detection status
   */
  private updateStateFromStatus(status: LocaleDetectionStatus): void {
    this._state.update(state => ({
      ...state,
      currentLocale: status.lastDetection?.locale || 'en',
      isLoading: false,
      errorMessage: status.error || null,
      hasUserPreference: status.hasUserPreference,
      detectedCountry: status.lastDetection?.countryCode || null,
      detectionSource: status.lastDetection?.source || 'unknown'
    }));
  }
}
