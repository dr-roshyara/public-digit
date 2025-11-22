// Enhanced Translation Service integrating Route-First Translation System
// apps/mobile/src/app/core/services/enhanced-translation.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, switchMap } from 'rxjs';
import { TranslationKeyPath } from '@assets/i18n/translation-keys';
import { RouteFirstTranslationLoader } from '../i18n/route-first.loader';
import { RouteTranslationAdapter } from '../i18n/route-translation.adapter';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE, getStoredLocale, setDocumentLanguage } from '../i18n/i18n.config';

interface TranslationState {
  currentLocale: string;
  loadedTranslations: Map<string, any>;
  routeTranslations: Map<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedTranslationService {
  private routeLoader = inject(RouteFirstTranslationLoader);
  private routeAdapter = inject(RouteTranslationAdapter);

  private currentLocale$ = new BehaviorSubject<string>(getStoredLocale());
  private loadedTranslations = new Map<string, any>();
  private routeTranslations = new Map<string, any>();

  // Public observables
  public currentLanguage = this.currentLocale$.asObservable();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize service with route-first translation system
   */
  private initialize(): void {
    // Initialize route adapter
    this.routeAdapter.initialize();

    // Set document language
    setDocumentLanguage(this.currentLocale$.value);

    // Preload core translations
    this.routeLoader.ensureCoreTranslationsLoaded(this.currentLocale$.value);
  }

  /**
   * Get translation for a specific key with route-first loading
   */
  get(key: TranslationKeyPath, params?: { [key: string]: any }): Observable<string> {
    return this.currentLocale$.pipe(
      switchMap(locale => this.loadTranslationForKey(key, locale)),
      map(translation => this.interpolateParams(translation, params))
    );
  }

  /**
   * Get translation immediately (synchronous)
   */
  getSync(key: TranslationKeyPath, params?: { [key: string]: any }): string {
    const locale = this.currentLocale$.value;
    const translation = this.getTranslationFromLoaded(key, locale);
    return this.interpolateParams(translation, params);
  }

  /**
   * Change current language with route-first system integration
   */
  async setLanguage(language: string): Promise<void> {
    if (!AVAILABLE_LOCALES.some(locale => locale.code === language)) {
      console.warn(`Language '${language}' is not supported. Using fallback.`);
      language = DEFAULT_LOCALE;
    }

    try {
      // Use route-first loader to set locale
      await this.routeLoader.setLocale(language);

      // Update our service state
      this.currentLocale$.next(language);

      // Update document
      setDocumentLanguage(language);

      console.log(`Language changed to: ${language}`);
    } catch (error) {
      console.error(`Failed to change language to "${language}":`, error);
    }
  }

  /**
   * Load translations for current route
   */
  async loadRouteTranslations(routePath: string): Promise<void> {
    try {
      await this.routeLoader.loadPageTranslations(routePath);
    } catch (error) {
      console.warn(`Failed to load route translations for "${routePath}":`, error);
    }
  }

  /**
   * Preload translations for multiple routes
   */
  async preloadRoutes(routes: string[]): Promise<void> {
    await this.routeLoader.preloadRoutes(routes);
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): typeof AVAILABLE_LOCALES {
    return AVAILABLE_LOCALES;
  }

  /**
   * Get current language code
   */
  getCurrentLanguage(): string {
    return this.currentLocale$.value;
  }

  /**
   * Clear loaded translations cache
   */
  clearCache(): void {
    this.loadedTranslations.clear();
    this.routeTranslations.clear();
    this.routeLoader.clearTranslationCache();
  }

  /**
   * Check if a translation key exists
   */
  hasKey(key: TranslationKeyPath): Observable<boolean> {
    return this.get(key).pipe(
      map(translation => translation !== key)
    );
  }

  private loadTranslationForKey(key: TranslationKeyPath, language: string): Observable<string> {
    // For now, use the existing translation service logic
    // In a full implementation, this would integrate with route-first loading
    const path = this.extractPathFromKey(key);
    const translationPath = this.getTranslationPath(path, language);

    if (this.loadedTranslations.has(translationPath)) {
      const translation = this.getNestedValue(this.loadedTranslations.get(translationPath), key);
      return new Observable(subscriber => {
        subscriber.next(translation || key);
        subscriber.complete();
      });
    }

    // Fallback to HTTP loading for now
    // In production, this would use the route-first loader
    return new Observable(subscriber => {
      // Simulate loading from route-first system
      const translation = key; // This would be replaced with actual loading
      subscriber.next(translation);
      subscriber.complete();
    });
  }

  private getTranslationFromLoaded(key: TranslationKeyPath, language: string): string {
    const path = this.extractPathFromKey(key);
    const translationPath = this.getTranslationPath(path, language);

    if (this.loadedTranslations.has(translationPath)) {
      const translation = this.getNestedValue(this.loadedTranslations.get(translationPath), key);
      return translation || key;
    }

    return key;
  }

  private extractPathFromKey(key: TranslationKeyPath): string {
    const parts = key.split('.');
    // Remove the last part (the actual key) to get the path
    return parts.slice(0, -1).join('/');
  }

  private getTranslationPath(path: string, language: string): string {
    return `assets/i18n/${path}/${language}.json`;
  }

  private getNestedValue(obj: any, key: string): any {
    return key.split('.').reduce((current, part) => {
      return current ? current[part] : undefined;
    }, obj);
  }

  private interpolateParams(translation: string, params?: { [key: string]: any }): string {
    if (!params) return translation;

    return translation.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
      return params[paramName] !== undefined ? params[paramName] : match;
    });
  }
}