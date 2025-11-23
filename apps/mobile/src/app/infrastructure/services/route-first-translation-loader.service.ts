/**
 * RouteFirstTranslationLoader - Infrastructure Service
 *
 * DDD INFRASTRUCTURE LAYER - Repository Implementation
 *
 * PURPOSE:
 * - Implements TranslationLoaderRepository interface from domain
 * - Loads translations from HTTP endpoints (JSON files)
 * - Provides route-first translation loading strategy
 * - Compatible with Vue.js backend translation structure
 *
 * HEXAGONAL ARCHITECTURE:
 * Domain (Port: TranslationLoaderRepository) ← Infrastructure (Adapter: This Service)
 *
 * MOVED FROM: core/i18n/route-first.loader.ts (DDD Layer Correction)
 * REASON: This is infrastructure (external I/O), not application logic
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslationLoaderRepository, TranslationData } from '@domain/i18n';

// Module-level cache (shared across all instances)
const loadedTranslations = new Map<string, TranslationData>();
const loadingPromises = new Map<string, Promise<TranslationData>>();

/**
 * Route normalization result
 */
interface NormalizedRoute {
  cleanPath: string;
  translationPath: string;
  namespace: string;
}

/**
 * Infrastructure adapter implementing domain port
 *
 * MATCHES Vue.js backend structure:
 * - Core translations: /assets/i18n/modular/{locale}/common.json
 * - Page translations: /assets/i18n/pages/{route}/{locale}.json
 *
 * IMPLEMENTS: TranslationLoaderRepository
 */
@Injectable({ providedIn: 'root' })
export class RouteFirstTranslationLoader implements TranslationLoaderRepository {
  private http = inject(HttpClient);
  private currentLocale = 'en';

  // ======== DOMAIN PORT IMPLEMENTATION ========

  /**
   * Load core translations (common, navigation, footer)
   *
   * Implements: TranslationLoaderRepository.loadCoreTranslations
   *
   * @param locale - Language code (e.g., 'en', 'de', 'np')
   * @returns Observable of merged core translations
   */
  loadCoreTranslations(locale: string): Observable<TranslationData> {
    return new Observable(observer => {
      this.loadCoreTranslationsAsync(locale)
        .then(data => {
          observer.next(data);
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }

  /**
   * Load page-specific translations
   *
   * Implements: TranslationLoaderRepository.loadPageTranslations
   *
   * @param routePath - Normalized route path (e.g., 'auth/login')
   * @param locale - Language code
   * @returns Observable of page translations
   */
  loadPageTranslations(routePath: string, locale: string): Observable<TranslationData> {
    return new Observable(observer => {
      this.loadPageTranslationsForRoute(routePath, locale)
        .then(data => {
          observer.next(data);
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }

  /**
   * Preload translations for multiple routes (optional method)
   *
   * Implements: TranslationLoaderRepository.preloadTranslations
   *
   * @param routes - Array of route paths
   * @param locale - Language code
   * @returns Observable that completes when done
   */
  preloadTranslations(routes: string[], locale: string): Observable<void> {
    return new Observable(observer => {
      this.preloadRoutes(routes)
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }

  // ======== PUBLIC API (ADDITIONAL METHODS) ========

  /**
   * Load core translations (async version)
   *
   * MATCHES Vue.js loadCoreTranslations function EXACTLY
   */
  async loadCoreTranslationsAsync(locale: string): Promise<TranslationData> {
    const cacheKey = `core-${locale}`;

    // Return from cache if available
    if (loadedTranslations.has(cacheKey)) {
      return loadedTranslations.get(cacheKey)!;
    }

    // Return existing promise if already loading
    if (loadingPromises.has(cacheKey)) {
      return loadingPromises.get(cacheKey)!;
    }

    // Create new loading promise
    const loadPromise = (async () => {
      try {
        console.log(`[RouteFirstLoader] Loading core translations for ${locale}...`);

        // Load all core translation files in parallel
        const [common, navigation, footer] = await Promise.all([
          this.loadTranslationFile(`/assets/i18n/modular/${locale}/common.json`).toPromise(),
          this.loadTranslationFile(`/assets/i18n/modular/${locale}/navigation.json`).toPromise(),
          this.loadTranslationFile(`/assets/i18n/modular/${locale}/footer.json`).toPromise()
        ]);

        const coreTranslations = {
          common: common || {},
          navigation: navigation || {},
          footer: footer || {}
        };

        loadedTranslations.set(cacheKey, coreTranslations);
        console.log(`[RouteFirstLoader] ✅ Core translations loaded for ${locale}`);
        return coreTranslations;
      } catch (error) {
        console.warn(`[RouteFirstLoader] Failed to load core translations for ${locale}:`, error);
        return {};
      } finally {
        loadingPromises.delete(cacheKey);
      }
    })();

    loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  /**
   * Load page-specific translations for a route
   *
   * MATCHES Vue.js loadPageTranslationsForRoute function EXACTLY
   */
  async loadPageTranslationsForRoute(routeKey: string, locale: string): Promise<TranslationData> {
    const cacheKey = `page-${routeKey}-${locale}`;

    // Return from cache if available
    if (loadedTranslations.has(cacheKey)) {
      return loadedTranslations.get(cacheKey)!;
    }

    // Return existing promise if already loading
    if (loadingPromises.has(cacheKey)) {
      return loadingPromises.get(cacheKey)!;
    }

    // Create new loading promise
    const loadPromise = (async () => {
      try {
        console.log(`[RouteFirstLoader] Loading page translations: ${routeKey} (${locale})`);

        // Load page translation file
        const pageTranslation = await this.loadTranslationFile(
          `/assets/i18n/pages/${routeKey}/${locale}.json`
        ).toPromise().catch(() => null);

        if (pageTranslation) {
          // Normalize key (replace slashes and dashes with underscores)
          const normalizedKey = routeKey.replace(/\//g, '_').replace(/-/g, '_');
          const translations = { [normalizedKey]: pageTranslation };
          loadedTranslations.set(cacheKey, translations);
          console.log(`[RouteFirstLoader] ✅ Page translations loaded for ${routeKey}`);
          return translations;
        }

        const emptyTranslations = {};
        loadedTranslations.set(cacheKey, emptyTranslations);
        console.log(`[RouteFirstLoader] ℹ️  No translations found for ${routeKey}`);
        return emptyTranslations;
      } catch (error) {
        console.warn(`[RouteFirstLoader] Failed to load page translations for ${routeKey}:`, error);
        const emptyTranslations = {};
        loadedTranslations.set(cacheKey, emptyTranslations);
        return emptyTranslations;
      } finally {
        loadingPromises.delete(cacheKey);
      }
    })();

    loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  /**
   * Ensure core translations are loaded
   */
  async ensureCoreTranslationsLoaded(locale?: string): Promise<void> {
    const targetLocale = locale || this.currentLocale;
    const cacheKey = `core-${targetLocale}`;

    if (loadedTranslations.has(cacheKey)) {
      return;
    }

    try {
      await this.loadCoreTranslationsAsync(targetLocale);
    } catch (error) {
      console.error(`[RouteFirstLoader] Failed to ensure core translations for ${targetLocale}:`, error);
    }
  }

  /**
   * Load all translations for a route (core + page)
   */
  async loadPageTranslationsForPath(routePath: string): Promise<void> {
    try {
      const normalizedRoute = this.normalizeRoute(routePath);
      console.log(`[RouteFirstLoader] Route-first loading: ${routePath} → ${normalizedRoute.translationPath}`);

      // Ensure core translations loaded
      await this.ensureCoreTranslationsLoaded(this.currentLocale);

      // Load page-specific translations
      await this.loadPageTranslationsForRoute(normalizedRoute.translationPath, this.currentLocale);
    } catch (error) {
      console.warn(`[RouteFirstLoader] Failed to load translations for route "${routePath}":`, error);
    }
  }

  /**
   * Set current locale
   */
  async setLocale(locale: string): Promise<void> {
    const availableLocales = ['en', 'de', 'np'];
    if (!availableLocales.includes(locale)) {
      console.warn(`[RouteFirstLoader] Locale "${locale}" is not supported`);
      return;
    }

    try {
      localStorage.setItem('locale', locale);
      this.currentLocale = locale;

      // Reload core translations
      await this.ensureCoreTranslationsLoaded(locale);

      // Reload current route translations
      const currentRoute = window.location.pathname;
      await this.loadPageTranslationsForPath(currentRoute);

      console.log(`[RouteFirstLoader] Language changed to: ${locale}`);
    } catch (error) {
      console.error(`[RouteFirstLoader] Failed to change language to "${locale}":`, error);
    }
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): string {
    return this.currentLocale;
  }

  /**
   * Preload translations for multiple routes
   */
  async preloadRoutes(routes: string[]): Promise<void> {
    await Promise.all(
      routes.map(route => this.loadPageTranslationsForPath(route).catch(() => {}))
    );
  }

  /**
   * Clear translation cache
   */
  clearTranslationCache(): void {
    loadedTranslations.clear();
    loadingPromises.clear();
    console.log('[RouteFirstLoader] Translation cache cleared');
  }

  // ======== PRIVATE HELPERS ========

  /**
   * Load translation file via HTTP
   */
  private loadTranslationFile(url: string): Observable<any> {
    return this.http.get(url).pipe(
      catchError(error => {
        console.warn(`[RouteFirstLoader] Failed to load ${url}:`, error.message);
        return of({});
      })
    );
  }

  /**
   * Normalize route path for translation loading
   *
   * Removes query params, hash, trailing slashes
   * Maps special routes to translation paths
   */
  private normalizeRoute(routePath: string): NormalizedRoute {
    // Remove query params and hash
    let cleanPath = routePath
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');

    // Handle root route
    if (!cleanPath || cleanPath === '/') {
      cleanPath = 'home';
    }

    // Map special routes
    const routeMapping: Record<string, string> = {
      '': 'home',
      '/': 'home',
      'landing': 'home'
    };

    const mappedPath = routeMapping[cleanPath] || cleanPath;

    return {
      cleanPath,
      translationPath: mappedPath,
      namespace: mappedPath.replace(/\//g, '.')
    };
  }
}
