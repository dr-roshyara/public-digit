/**
 * TranslationService - Main Facade for i18n System
 *
 * DDD PRESENTATION/APPLICATION LAYER - Orchestrates translation functionality
 *
 * PURPOSE:
 * - Coordinate route-first translation loading
 * - Provide reactive translation state via signals
 * - Integrate with LocaleStateService for locale changes
 * - Manage translation lifecycle
 *
 * ARCHITECTURE:
 * Components → TranslationService → RouteFirstTranslationLoader
 *                ↓
 *         LocaleStateService (shared state)
 *                ↑
 *    LocaleDetectionFacade
 *
 * This service acts as the main entry point for all translation operations.
 */

import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { RouteFirstTranslationLoader } from '../route-first.loader';
import { LocaleStateService } from './locale-state.service';

/**
 * Translation service facade
 *
 * PROVIDES:
 * - Translation loading orchestration
 * - Reactive translation state
 * - Route-based translation switching
 * - Locale change handling
 *
 * USAGE:
 * ```typescript
 * // Initialize in AppComponent
 * translationService.initialize();
 *
 * // Get translation
 * const text = translationService.translate('common.welcome');
 *
 * // Change language (triggers reload)
 * await translationService.setLanguage('de');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private router = inject(Router);
  private translationLoader = inject(RouteFirstTranslationLoader);
  private localeState = inject(LocaleStateService);

  // ======== PRIVATE STATE ========

  /**
   * Current merged translations (core + page-specific)
   */
  private readonly _translations = signal<any>({});

  /**
   * Loading state
   */
  private readonly _isLoading = signal<boolean>(false);

  /**
   * Error state
   */
  private readonly _error = signal<string | null>(null);

  /**
   * Initialization state
   */
  private _initialized = false;

  // ======== PUBLIC READONLY SIGNALS ========

  /**
   * Current translations signal (readonly)
   */
  readonly translations = this._translations.asReadonly();

  /**
   * Loading state signal (readonly)
   */
  readonly isLoading = this._isLoading.asReadonly();

  /**
   * Error state signal (readonly)
   */
  readonly error = this._error.asReadonly();

  /**
   * Current locale (computed from LocaleStateService)
   */
  readonly currentLocale = computed(() => this.localeState.currentLocale());

  // ======== CONSTRUCTOR ========

  constructor() {
    // React to locale changes from LocaleStateService
    this.setupLocaleChangeListener();
  }

  // ======== PUBLIC METHODS ========

  /**
   * Initialize translation system
   *
   * MUST be called in AppComponent.ngOnInit()
   *
   * Sets up:
   * - Router integration (load translations on route change)
   * - Initial translation loading
   * - Locale change listener
   *
   * @example
   * ```typescript
   * // app.component.ts
   * ngOnInit(): void {
   *   this.translationService.initialize();
   * }
   * ```
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      console.log('[TranslationService] Already initialized');
      return;
    }

    console.log('[TranslationService] Initializing...');

    try {
      // Setup router integration
      this.setupRouterIntegration();

      // Load initial translations for current route
      const currentRoute = this.router.url || '/';
      await this.loadTranslationsForRoute(currentRoute);

      // Preload common routes for better performance
      await this.preloadCommonRoutes();

      this._initialized = true;
      console.log('[TranslationService] Initialized successfully');
    } catch (error) {
      console.error('[TranslationService] Initialization failed:', error);
      this._error.set(error instanceof Error ? error.message : 'Initialization failed');
    }
  }

  /**
   * Get translation for a key
   *
   * Supports nested keys with dot notation
   *
   * @param key - Translation key (e.g., 'common.welcome', 'home.hero.title')
   * @param params - Optional parameters for interpolation
   * @returns Translated string or key if not found
   *
   * @example
   * ```typescript
   * // Simple translation
   * const text = translate('common.welcome'); // 'Welcome'
   *
   * // With parameters
   * const text = translate('common.greeting', { name: 'John' }); // 'Hello, John!'
   * ```
   */
  translate(key: string, params?: Record<string, any>): string {
    const translations = this._translations();

    // Navigate through nested objects (e.g., 'common.welcome')
    const value = key.split('.').reduce((obj, k) => obj?.[k], translations);

    if (typeof value !== 'string') {
      console.warn(`[TranslationService] Translation key not found: ${key}`);
      return key; // Fallback to key
    }

    // Replace parameters if provided
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, param) => params[param] || match);
    }

    return value;
  }

  /**
   * Change current language
   *
   * This updates LocaleStateService which triggers a chain reaction:
   * 1. LocaleStateService updates
   * 2. Effect in this service detects change
   * 3. Translations reload for current route
   *
   * @param locale - Locale code (e.g., 'en', 'de', 'np')
   *
   * @example
   * ```typescript
   * // Language selector component
   * async changeLanguage(locale: string): Promise<void> {
   *   await this.translationService.setLanguage(locale);
   * }
   * ```
   */
  async setLanguage(locale: string): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Update shared locale state (triggers effect)
      this.localeState.setLocale(locale, 'user');

      console.log(`[TranslationService] Language changed to: ${locale}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change language';
      console.error('[TranslationService] Failed to change language:', error);
      this._error.set(errorMessage);
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Preload translations for specific routes
   *
   * Useful for improving performance by loading translations
   * before user navigates to those routes
   *
   * @param routes - Array of route paths
   *
   * @example
   * ```typescript
   * await translationService.preloadRoutes([
   *   '/dashboard',
   *   '/elections',
   *   '/profile'
   * ]);
   * ```
   */
  async preloadRoutes(routes: string[]): Promise<void> {
    console.log('[TranslationService] Preloading routes:', routes);

    try {
      await this.translationLoader.preloadRoutes(routes);
      console.log('[TranslationService] Routes preloaded successfully');
    } catch (error) {
      console.warn('[TranslationService] Failed to preload routes:', error);
    }
  }

  /**
   * Clear translation cache
   *
   * Useful for testing or forcing reload of translations
   */
  clearCache(): void {
    this.translationLoader.clearTranslationCache();
    this._translations.set({});
    console.log('[TranslationService] Cache cleared');
  }

  /**
   * Get current locale (synchronous)
   *
   * @returns Current locale code
   */
  getCurrentLocale(): string {
    return this.localeState.getCurrentLocale();
  }

  // ======== PRIVATE HELPERS ========

  /**
   * Setup router integration
   *
   * Listens to navigation events and loads translations
   * for the new route automatically
   */
  private setupRouterIntegration(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        console.log(`[TranslationService] Route changed: ${event.urlAfterRedirects}`);
        this.loadTranslationsForRoute(event.urlAfterRedirects);
      });

    console.log('[TranslationService] Router integration setup complete');
  }

  /**
   * Setup locale change listener
   *
   * React to locale changes from LocaleStateService
   * and reload translations for current route
   */
  private setupLocaleChangeListener(): void {
    effect(async () => {
      const locale = this.localeState.currentLocale();

      // Skip if not initialized yet
      if (!this._initialized) {
        return;
      }

      console.log(`[TranslationService] Locale changed to: ${locale}, reloading translations...`);

      // Reload translations for current route with new locale
      const currentRoute = this.router.url || '/';
      await this.loadTranslationsForRoute(currentRoute);
    });
  }

  /**
   * Load translations for a specific route
   *
   * Loads core translations + page-specific translations
   * and merges them into the translations signal
   *
   * @param routePath - Route path (e.g., '/dashboard')
   */
  private async loadTranslationsForRoute(routePath: string): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const locale = this.localeState.getCurrentLocale();

      console.log(`[TranslationService] Loading translations for route: ${routePath} (locale: ${locale})`);

      // Load translations using route-first loader
      await this.translationLoader.loadPageTranslations(routePath);

      // Get merged translations from loader's cache
      const mergedTranslations = await this.getMergedTranslations(routePath, locale);

      // Update signal
      this._translations.set(mergedTranslations);

      console.log(`[TranslationService] ✅ Translations loaded for ${routePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load translations';
      console.error('[TranslationService] Failed to load translations:', error);
      this._error.set(errorMessage);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Get merged translations (core + page-specific)
   *
   * Retrieves translations from the loader's cache and merges them
   *
   * @param routePath - Route path
   * @param locale - Locale code
   * @returns Merged translations object
   */
  private async getMergedTranslations(routePath: string, locale: string): Promise<any> {
    try {
      // Ensure core translations are loaded
      await this.translationLoader.ensureCoreTranslationsLoaded(locale);

      // Load core translations
      const coreTranslations = await this.translationLoader.loadCoreTranslations(locale);

      // Load page-specific translations
      const normalizedRoute = this.normalizeRoutePath(routePath);
      const pageTranslations = await this.translationLoader.loadPageTranslationsForRoute(normalizedRoute, locale);

      // Merge core and page translations
      const merged = {
        ...coreTranslations,
        ...pageTranslations
      };

      return merged;
    } catch (error) {
      console.error('[TranslationService] Failed to merge translations:', error);
      return {};
    }
  }

  /**
   * Normalize route path for translation loading
   *
   * Removes query parameters and hash fragments
   *
   * @param routePath - Raw route path
   * @returns Normalized path
   */
  private normalizeRoutePath(routePath: string): string {
    return routePath
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '')
      .replace(/\/+$/, '') || '/';
  }

  /**
   * Preload common routes for better performance
   *
   * Called during initialization to improve perceived performance
   */
  private async preloadCommonRoutes(): Promise<void> {
    const commonRoutes = [
      '/dashboard',
      '/login',
      '/register'
    ];

    try {
      await this.preloadRoutes(commonRoutes);
    } catch (error) {
      console.warn('[TranslationService] Failed to preload common routes:', error);
      // Non-critical, continue initialization
    }
  }
}
