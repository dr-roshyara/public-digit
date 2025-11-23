/**
 * TranslationService - Application Service
 *
 * DDD APPLICATION LAYER - Translation orchestration
 *
 * PURPOSE:
 * - Coordinate translation loading via domain repository
 * - Provide reactive translation state
 * - Integrate with LocaleStateService
 * - Manage translation lifecycle
 *
 * ARCHITECTURE:
 * Components → TranslationService → TranslationLoaderRepository (Port)
 *                ↓                              ↑
 *         LocaleStateService            RouteFirstTranslationLoader (Adapter)
 *
 * MOVED FROM: core/i18n/services/ (DDD Layer Correction)
 * REASON: This orchestrates application use cases, belongs in application layer
 */

import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslationLoaderRepository, TranslationKey, Locale } from '@domain/i18n';
import { LocaleStateService } from './locale-state.service';
import { RouteFirstTranslationLoader } from '@infrastructure/services/route-first-translation-loader.service';

/**
 * Application service for translation management
 *
 * PROVIDES:
 * - Translation loading orchestration (via domain repository)
 * - Reactive translation state (Angular signals)
 * - Route-based translation switching
 * - Locale change handling
 *
 * DEPENDS ON:
 * - TranslationLoaderRepository (domain port)
 * - LocaleStateService (application)
 * - Router (Angular framework)
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private router = inject(Router);
  private translationLoader = inject(RouteFirstTranslationLoader) as TranslationLoaderRepository;
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
      console.log('[TranslationService] ✅ Initialized successfully');
    } catch (error) {
      console.error('[TranslationService] Initialization failed:', error);
      this._error.set(error instanceof Error ? error.message : 'Initialization failed');
    }
  }

  /**
   * Get translation for a key
   *
   * Supports nested keys with dot notation
   * Supports parameter interpolation
   *
   * @param key - Translation key (e.g., 'common.welcome')
   * @param params - Optional parameters for interpolation
   * @returns Translated string or key if not found
   */
  translate(key: string, params?: Record<string, any>): string {
    const translations = this._translations();

    // Navigate through nested objects (e.g., 'common.welcome')
    const value = key.split('.').reduce((obj, k) => obj?.[k], translations);

    if (typeof value !== 'string') {
      console.warn(`[TranslationService] Translation key not found: ${key}`);
      return key; // Fallback to key
    }

    // Replace parameters if provided (e.g., {{name}} → John)
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, param) => params[param] || match);
    }

    return value;
  }

  /**
   * Translate using domain TranslationKey value object
   *
   * Type-safe translation method
   *
   * @param translationKey - Domain TranslationKey
   * @param params - Optional parameters
   * @returns Translated string
   */
  translateKey(translationKey: TranslationKey, params?: Record<string, any>): string {
    return this.translate(translationKey.toString(), params);
  }

  /**
   * Change current language
   *
   * Updates LocaleStateService which triggers translation reload
   *
   * @param locale - Locale code or Locale value object
   */
  async setLanguage(locale: string | Locale): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const localeStr = locale instanceof Locale ? locale.toString() : locale;

      // Validate locale using domain value object
      const localeVO = Locale.create(localeStr);

      // Update shared locale state (triggers effect)
      this.localeState.setLocale(localeVO.toString(), 'user');

      console.log(`[TranslationService] Language changed to: ${localeVO.toString()}`);
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
   * Improves performance by loading translations before navigation
   *
   * @param routes - Array of route paths
   */
  async preloadRoutes(routes: string[]): Promise<void> {
    console.log('[TranslationService] Preloading routes:', routes);

    try {
      // Use repository method if available
      const loader = this.translationLoader as any;
      if (loader.preloadRoutes) {
        await loader.preloadRoutes(routes);
      }
      console.log('[TranslationService] Routes preloaded successfully');
    } catch (error) {
      console.warn('[TranslationService] Failed to preload routes:', error);
    }
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    const loader = this.translationLoader as any;
    if (loader.clearTranslationCache) {
      loader.clearTranslationCache();
    }
    this._translations.set({});
    console.log('[TranslationService] Cache cleared');
  }

  /**
   * Get current locale (synchronous)
   */
  getCurrentLocale(): string {
    return this.localeState.getCurrentLocale();
  }

  // ======== PRIVATE HELPERS ========

  /**
   * Setup router integration
   *
   * Listens to navigation events and loads translations automatically
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
   * React to locale changes and reload translations
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
   * Loads core + page-specific translations via repository
   */
  private async loadTranslationsForRoute(routePath: string): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const locale = this.localeState.getCurrentLocale();

      console.log(`[TranslationService] Loading translations for route: ${routePath} (locale: ${locale})`);

      // Get merged translations
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
   * Uses domain repository to load translations
   */
  private async getMergedTranslations(routePath: string, locale: string): Promise<any> {
    try {
      // Load core translations using repository
      const coreTranslations = await this.translationLoader.loadCoreTranslations(locale).toPromise();

      // Normalize route path
      const normalizedRoute = this.normalizeRoutePath(routePath);

      // Load page-specific translations using repository
      const pageTranslations = await this.translationLoader.loadPageTranslations(
        normalizedRoute,
        locale
      ).toPromise();

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
   * Normalize route path
   */
  private normalizeRoutePath(routePath: string): string {
    return routePath
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '') || 'home';
  }

  /**
   * Preload common routes for better performance
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
    }
  }
}
