// MATCHING your Vue.js RouteFirstTranslationLoader EXACTLY:
// apps/mobile/src/app/core/i18n/route-first.loader.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, from } from 'rxjs';
import { map, catchError, shareReplay, tap } from 'rxjs/operators';
import { normalizeRoute, NormalizedRoute } from './route-normalizer';

// MATCHING your cache structures EXACTLY
const loadedTranslations = new Map<string, any>();
const loadingPromises = new Map<string, Promise<any>>();

@Injectable({ providedIn: 'root' })
export class RouteFirstTranslationLoader {
  private http = inject(HttpClient);
  private currentLocale = 'en';

  // MATCHING your loadCoreTranslations function EXACTLY
  async loadCoreTranslations(locale: string): Promise<any> {
    const cacheKey = `core-${locale}`;

    if (loadedTranslations.has(cacheKey)) {
      return loadedTranslations.get(cacheKey);
    }

    if (loadingPromises.has(cacheKey)) {
      return loadingPromises.get(cacheKey);
    }

    const loadPromise = (async () => {
      try {
        // MATCHING your dynamic import logic with Angular equivalent
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
        return coreTranslations;
      } catch (error) {
        console.warn(`Failed to load core translations for ${locale}:`, error);
        return {};
      } finally {
        loadingPromises.delete(cacheKey);
      }
    })();

    loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  // MATCHING your loadPageTranslationsForRoute function EXACTLY
  async loadPageTranslationsForRoute(routeKey: string, locale: string): Promise<any> {
    const cacheKey = `page-${routeKey}-${locale}`;

    if (loadedTranslations.has(cacheKey)) {
      return loadedTranslations.get(cacheKey);
    }

    if (loadingPromises.has(cacheKey)) {
      return loadingPromises.get(cacheKey);
    }

    const loadPromise = (async () => {
      try {
        // MATCHING your page translation loading logic
        const pageTranslation = await this.loadTranslationFile(
          `/assets/i18n/pages/${routeKey}/${locale}.json`
        ).toPromise().catch(() => null);

        if (pageTranslation) {
          // MATCHING your key normalization logic
          const normalizedKey = routeKey.replace(/\//g, '_').replace(/-/g, '_');
          const translations = { [normalizedKey]: pageTranslation };
          loadedTranslations.set(cacheKey, translations);
          return translations;
        }

        const emptyTranslations = {};
        loadedTranslations.set(cacheKey, emptyTranslations);
        return emptyTranslations;
      } catch (error) {
        console.warn(`Failed to load page translations for ${routeKey} (${locale}):`, error);
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

  // Angular equivalent of your HTTP loading
  private loadTranslationFile(url: string): Observable<any> {
    return this.http.get(url).pipe(
      catchError(() => of({})) // MATCHING your fallback logic
    );
  }

  // MATCHING your loadPageTranslations function signature and logic
  async loadPageTranslations(routePath: string): Promise<void> {
    try {
      const normalizedRoute = normalizeRoute(routePath);
      console.log(`Route-first loading: ${routePath} → ${normalizedRoute.translationPath} (${this.currentLocale})`);

      // MATCHING your core translation loading
      await this.ensureCoreTranslationsLoaded(this.currentLocale);

      // MATCHING your page translation loading
      const pageTranslations = await this.loadPageTranslationsForRoute(normalizedRoute.translationPath, this.currentLocale);

      if (pageTranslations && Object.keys(pageTranslations).length > 0) {
        console.log(`✅ Loaded translations for route: ${normalizedRoute.translationPath}`);
        // In Angular, we'll handle the merging differently (see next file)
      } else {
        console.log(`ℹ️  No specific translations found for route: ${normalizedRoute.translationPath}`);
      }

    } catch (error) {
      console.warn(`Failed to load route-first translations for "${routePath}":`, error);
    }
  }

  // MATCHING your ensureCoreTranslationsLoaded function
  async ensureCoreTranslationsLoaded(locale?: string): Promise<void> {
    const targetLocale = locale || this.currentLocale;
    const cacheKey = `core-${targetLocale}`;

    if (loadedTranslations.has(cacheKey)) {
      return;
    }

    try {
      await this.loadCoreTranslations(targetLocale);
    } catch (error) {
      console.error(`Failed to ensure core translations for ${targetLocale}:`, error);
    }
  }

  // MATCHING your setLocale function
  async setLocale(locale: string): Promise<void> {
    // MATCHING your locale validation
    const availableLocales = ['en', 'de', 'np'];
    if (!availableLocales.includes(locale)) {
      console.warn(`Locale "${locale}" is not supported`);
      return;
    }

    try {
      // MATCHING your storage logic
      localStorage.setItem('locale', locale);
      this.currentLocale = locale;

      // MATCHING your core translation reloading
      await this.ensureCoreTranslationsLoaded(locale);

      // MATCHING your current route reloading
      const currentRoute = window.location.pathname;
      await this.loadPageTranslations(currentRoute);

      console.log(`Language changed to: ${locale}`);
    } catch (error) {
      console.error(`Failed to change language to "${locale}":`, error);
    }
  }

  // MATCHING your utility functions
  getCurrentLocale(): string {
    return this.currentLocale;
  }

  // MATCHING your preloading function
  async preloadRoutes(routes: string[]): Promise<void> {
    await Promise.all(
      routes.map(route => this.loadPageTranslations(route).catch(() => {}))
    );
  }

  // MATCHING your cache management
  clearTranslationCache(): void {
    loadedTranslations.clear();
    loadingPromises.clear();
  }
}