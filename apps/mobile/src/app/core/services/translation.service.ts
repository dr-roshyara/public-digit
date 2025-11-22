import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, of, switchMap, tap } from 'rxjs';
import { LANGUAGE_CONFIG, LanguageConfig } from '@assets/i18n/languages/language-config';
import { TranslationKeys, TranslationKeyPath } from '@assets/i18n/translation-keys';

interface LoadedTranslations {
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private http = inject(HttpClient);

  private currentLanguage$ = new BehaviorSubject<string>(LANGUAGE_CONFIG.defaultLanguage);
  private loadedTranslations: LoadedTranslations = {};
  private loadingPromises: { [key: string]: Promise<any> } = {};

  // Public observables
  public currentLanguage = this.currentLanguage$.asObservable();

  /**
   * Get translation for a specific key
   */
  get(key: TranslationKeyPath, params?: { [key: string]: any }): Observable<string> {
    return this.currentLanguage$.pipe(
      switchMap(language => this.loadTranslationForKey(key, language)),
      map(translation => this.interpolateParams(translation, params))
    );
  }

  /**
   * Get translation immediately (synchronous)
   */
  getSync(key: TranslationKeyPath, params?: { [key: string]: any }): string {
    const language = this.currentLanguage$.value;
    const translation = this.getTranslationFromLoaded(key, language);
    return this.interpolateParams(translation, params);
  }

  /**
   * Change current language
   */
  setLanguage(language: string): void {
    if (!LANGUAGE_CONFIG.supportedLanguages.some(lang => lang.code === language)) {
      console.warn(`Language '${language}' is not supported. Using fallback.`);
      language = LANGUAGE_CONFIG.fallbackLanguage;
    }

    this.currentLanguage$.next(language);
    localStorage.setItem(LANGUAGE_CONFIG.storageKey, language);
  }

  /**
   * Initialize service with stored language preference
   */
  initialize(): void {
    const storedLanguage = localStorage.getItem(LANGUAGE_CONFIG.storageKey);
    if (storedLanguage && LANGUAGE_CONFIG.supportedLanguages.some(lang => lang.code === storedLanguage)) {
      this.currentLanguage$.next(storedLanguage);
    }
  }

  /**
   * Preload translations for a specific component/path
   */
  preload(path: string): Promise<void> {
    const language = this.currentLanguage$.value;
    const translationPath = this.getTranslationPath(path, language);

    if (this.loadingPromises[translationPath]) {
      return this.loadingPromises[translationPath];
    }

    const promise = this.http.get(translationPath).pipe(
      tap(translations => {
        this.loadedTranslations[translationPath] = translations;
        delete this.loadingPromises[translationPath];
      }),
      map(() => undefined)
    ).toPromise();

    this.loadingPromises[translationPath] = promise;
    return promise;
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): LanguageConfig['supportedLanguages'] {
    return LANGUAGE_CONFIG.supportedLanguages;
  }

  /**
   * Get current language code
   */
  getCurrentLanguage(): string {
    return this.currentLanguage$.value;
  }

  /**
   * Clear loaded translations cache
   */
  clearCache(): void {
    this.loadedTranslations = {};
    this.loadingPromises = {};
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
    const path = this.extractPathFromKey(key);
    const translationPath = this.getTranslationPath(path, language);

    if (this.loadedTranslations[translationPath]) {
      const translation = this.getNestedValue(this.loadedTranslations[translationPath], key);
      return of(translation || key);
    }

    return this.http.get(translationPath).pipe(
      tap(translations => {
        this.loadedTranslations[translationPath] = translations;
      }),
      map(translations => {
        const translation = this.getNestedValue(translations, key);
        return translation || key;
      })
    );
  }

  private getTranslationFromLoaded(key: TranslationKeyPath, language: string): string {
    const path = this.extractPathFromKey(key);
    const translationPath = this.getTranslationPath(path, language);

    if (this.loadedTranslations[translationPath]) {
      const translation = this.getNestedValue(this.loadedTranslations[translationPath], key);
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