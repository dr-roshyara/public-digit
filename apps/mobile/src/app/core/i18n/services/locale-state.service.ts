/**
 * LocaleStateService - Shared State for Locale Management
 *
 * DDD INFRASTRUCTURE LAYER - Shared state management
 *
 * PURPOSE:
 * - Provide single source of truth for current locale
 * - Enable reactive programming with signals
 * - Prevent circular dependencies between services
 * - Support event-driven architecture
 *
 * ARCHITECTURE:
 * LocaleDetectionFacade → LocaleStateService ← TranslationService
 *
 * This service acts as a mediator, allowing both locale detection and
 * translation loading to react to locale changes without depending on each other.
 */

import { Injectable, signal, computed, effect } from '@angular/core';

/**
 * Locale change event for tracking state transitions
 */
export interface LocaleChangeEvent {
  previousLocale: string;
  newLocale: string;
  source: 'user' | 'auto-detect' | 'geo-location' | 'system';
  timestamp: Date;
}

/**
 * Infrastructure service managing locale state
 *
 * PROVIDES:
 * - Reactive locale signal
 * - Locale change history
 * - Source tracking for debugging
 *
 * DOES NOT:
 * - Load translations (that's TranslationService)
 * - Detect geo-location (that's LocaleDetectionFacade)
 * - Manage UI state (that's component responsibility)
 */
@Injectable({ providedIn: 'root' })
export class LocaleStateService {

  // ======== PRIVATE STATE ========

  /**
   * Current locale (writable signal)
   * Default: 'en' (English)
   */
  private readonly _currentLocale = signal<string>('en');

  /**
   * Locale change history for debugging and analytics
   */
  private readonly _localeHistory = signal<LocaleChangeEvent[]>([]);

  /**
   * Last locale change source
   */
  private readonly _lastChangeSource = signal<LocaleChangeEvent['source']>('system');

  // ======== PUBLIC READONLY SIGNALS ========

  /**
   * Current locale (readonly)
   *
   * @example
   * ```typescript
   * const locale = localeState.currentLocale(); // 'en'
   *
   * // React to changes
   * effect(() => {
   *   console.log('Locale changed:', localeState.currentLocale());
   * });
   * ```
   */
  readonly currentLocale = this._currentLocale.asReadonly();

  /**
   * Locale change history (readonly)
   */
  readonly localeHistory = this._localeHistory.asReadonly();

  /**
   * Last change source (readonly)
   */
  readonly lastChangeSource = this._lastChangeSource.asReadonly();

  /**
   * Is locale user-selected (computed)
   * True if last change was from user action, not auto-detection
   */
  readonly isUserSelected = computed(() =>
    this._lastChangeSource() === 'user'
  );

  // ======== CONSTRUCTOR ========

  constructor() {
    // Initialize from localStorage if available
    this.initializeFromStorage();

    // Debug logging in development
    if (!this.isProduction()) {
      this.setupDebugLogging();
    }
  }

  // ======== PUBLIC METHODS ========

  /**
   * Set current locale
   *
   * @param locale - Locale code (e.g., 'en', 'de', 'np')
   * @param source - Source of the change (for tracking)
   *
   * @example
   * ```typescript
   * // User changed language via selector
   * localeState.setLocale('de', 'user');
   *
   * // Auto-detected from geo-location
   * localeState.setLocale('np', 'geo-location');
   * ```
   */
  setLocale(locale: string, source: LocaleChangeEvent['source'] = 'system'): void {
    const previousLocale = this._currentLocale();

    // Only update if locale actually changed
    if (previousLocale === locale) {
      console.log(`[LocaleState] Locale already set to ${locale}, skipping`);
      return;
    }

    // Validate locale (basic validation)
    if (!this.isValidLocale(locale)) {
      console.warn(`[LocaleState] Invalid locale: ${locale}, falling back to 'en'`);
      locale = 'en';
    }

    console.log(`[LocaleState] Changing locale: ${previousLocale} → ${locale} (source: ${source})`);

    // Update state
    this._currentLocale.set(locale);
    this._lastChangeSource.set(source);

    // Record history
    const changeEvent: LocaleChangeEvent = {
      previousLocale,
      newLocale: locale,
      source,
      timestamp: new Date()
    };

    this._localeHistory.update(history => [...history, changeEvent]);

    // Persist to storage
    this.persistToStorage(locale, source);
  }

  /**
   * Get current locale (synchronous)
   *
   * @returns Current locale code
   */
  getCurrentLocale(): string {
    return this._currentLocale();
  }

  /**
   * Get locale change history
   *
   * @returns Array of locale change events
   */
  getLocaleHistory(): LocaleChangeEvent[] {
    return this._localeHistory();
  }

  /**
   * Clear locale change history (useful for testing)
   */
  clearHistory(): void {
    this._localeHistory.set([]);
  }

  /**
   * Reset to default locale
   *
   * @param source - Source of the reset
   */
  resetToDefault(source: LocaleChangeEvent['source'] = 'system'): void {
    this.setLocale('en', source);
  }

  // ======== PRIVATE HELPERS ========

  /**
   * Initialize locale from localStorage
   */
  private initializeFromStorage(): void {
    try {
      const storedLocale = localStorage.getItem('locale');
      const storedSource = localStorage.getItem('locale_source') as LocaleChangeEvent['source'] | null;

      if (storedLocale && this.isValidLocale(storedLocale)) {
        this._currentLocale.set(storedLocale);
        this._lastChangeSource.set(storedSource || 'system');

        console.log(`[LocaleState] Initialized from storage: ${storedLocale} (source: ${storedSource})`);
      } else {
        console.log('[LocaleState] No stored locale found, using default: en');
      }
    } catch (error) {
      console.warn('[LocaleState] Failed to initialize from storage:', error);
    }
  }

  /**
   * Persist locale to localStorage
   */
  private persistToStorage(locale: string, source: LocaleChangeEvent['source']): void {
    try {
      localStorage.setItem('locale', locale);
      localStorage.setItem('locale_source', source);
    } catch (error) {
      console.warn('[LocaleState] Failed to persist to storage:', error);
    }
  }

  /**
   * Validate locale code
   *
   * @param locale - Locale code to validate
   * @returns True if valid
   */
  private isValidLocale(locale: string): boolean {
    const validLocales = ['en', 'de', 'np'];
    return validLocales.includes(locale);
  }

  /**
   * Setup debug logging (development only)
   */
  private setupDebugLogging(): void {
    effect(() => {
      const locale = this._currentLocale();
      const source = this._lastChangeSource();
      console.log(`[LocaleState Debug] Current locale: ${locale} (source: ${source})`);
    });
  }

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    // In a real app, this would check environment.production
    return false;
  }
}
