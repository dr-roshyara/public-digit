/**
 * UnifiedGeoLocationFacade - Shared facade that builds on existing geo implementation
 *
 * This facade:
 * - Uses existing geo implementation for location detection
 * - Adds language detection capabilities
 * - Provides unified interface for both frontends
 * - Maintains backward compatibility
 */

import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, tap, distinctUntilChanged, switchMap } from 'rxjs/operators';

// Import from existing geo implementation
import { GeoLocationFacade as ExistingGeoFacade } from '../application/facades/geo-location.facade';
import { GeoContext } from '../domain/aggregates/geo-context.model';

// Import our new language detection components
import { CountryCode } from '../domain/value-objects/country-code.vo';
import { LocalePreference } from '../domain/value-objects/locale-preference.vo';
import { CountryDetectionService } from '../domain/services/country-detection.service';

interface UnifiedGeoState {
  geoContext: GeoContext | null;
  countryCode: CountryCode | null;
  localePreference: LocalePreference | null;
  status: 'idle' | 'detecting' | 'success' | 'error';
  source: 'existing-geo' | 'ip-detection' | 'fallback' | 'manual';
  error?: string | null;
}

export class UnifiedGeoLocationFacade {
  private readonly _state = new BehaviorSubject<UnifiedGeoState>({
    geoContext: null,
    countryCode: null,
    localePreference: null,
    status: 'idle',
    source: 'fallback',
    error: null
  });

  constructor(
    private readonly existingGeoFacade: ExistingGeoFacade,
    private readonly countryDetectionService: CountryDetectionService
  ) {}

  // ======== PUBLIC API ========

  /** Full unified state observable */
  get state$(): Observable<UnifiedGeoState> {
    return this._state.asObservable();
  }

  /** Current geo context from existing implementation */
  get geoContext$(): Observable<GeoContext | null> {
    return this._state.pipe(map(state => state.geoContext));
  }

  /** Current country code */
  get countryCode$(): Observable<CountryCode | null> {
    return this._state.pipe(map(state => state.countryCode));
  }

  /** Current locale preference */
  get localePreference$(): Observable<LocalePreference | null> {
    return this._state.pipe(map(state => state.localePreference));
  }

  /** Current resolved locale (language code) */
  get currentLocale$(): Observable<string> {
    return this.localePreference$.pipe(
      map(preference => preference?.resolvedLocale || 'en'),
      distinctUntilChanged()
    );
  }

  /**
   * Detect location and language using existing geo implementation
   */
  detectLocationAndLanguage(forceRefresh = false): Observable<LocalePreference> {
    this._state.next({ ...this._state.value, status: 'detecting' });

    return this.existingGeoFacade.detectLocation(forceRefresh).pipe(
      switchMap(geoContext => {
        if (!geoContext) {
          throw new Error('No location detected by existing geo facade');
        }

        // Extract country code from GeoContext
        const countryCode = CountryCode.createFromIP(geoContext.countryCode);
        const browserLanguage = this.getBrowserLanguage();
        const localePreference = LocalePreference.create(countryCode, browserLanguage);

        this._state.next({
          geoContext,
          countryCode,
          localePreference,
          status: 'success',
          source: 'existing-geo',
          error: null
        });

        return of(localePreference);
      }),
      catchError(error => {
        console.warn('Existing geo detection failed, falling back to IP detection:', error);
        return this.fallbackToIPDetection();
      })
    );
  }

  /**
   * Manually set country and locale
   */
  setManualPreference(countryCode: string, languageCode: string): void {
    try {
      const country = CountryCode.create(countryCode);
      const localePreference = LocalePreference.create(country, languageCode);

      // Store user's explicit choice
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('user_explicit_locale', languageCode);
      }

      this._state.next({
        ...this._state.value,
        countryCode: country,
        localePreference,
        status: 'success',
        source: 'manual'
      });
    } catch (error) {
      this._state.next({
        ...this._state.value,
        status: 'error',
        error: 'Invalid country or language code'
      });
    }
  }

  /**
   * Clear user's explicit language choice
   */
  clearUserPreference(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('user_explicit_locale');
    }

    // Trigger auto-detection
    this.detectLocationAndLanguage(true);
  }

  /**
   * Check if user has explicitly chosen a language
   */
  hasUserExplicitLocale(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem('user_explicit_locale');
  }

  // ======== EXISTING GEO FACADE DELEGATION ========

  /** Delegate to existing geo facade methods */
  get currentContext$(): Observable<GeoContext | null> {
    return this.existingGeoFacade.currentContext$;
  }

  validateSync(context: GeoContext): boolean {
    return this.existingGeoFacade.validateSync(context);
  }

  get supportedCountries$(): Observable<any[]> {
    return this.existingGeoFacade.supportedCountries$;
  }

  setManualLocation(context: GeoContext): Promise<any> {
    return this.existingGeoFacade.setManualLocation(context);
  }

  getCities(countryCode: string, options?: any): Observable<any[]> {
    return this.existingGeoFacade.getCities(countryCode, options);
  }

  // ======== PRIVATE METHODS ========

  private fallbackToIPDetection(): Observable<LocalePreference> {
    return from(this.countryDetectionService.detectUserLocale()).pipe(
      tap(localePreference => {
        this._state.next({
          geoContext: null,
          countryCode: localePreference.countryCode,
          localePreference,
          status: 'success',
          source: 'ip-detection',
          error: null
        });
      }),
      catchError(error => {
        this._state.next({
          ...this._state.value,
          status: 'error',
          error: this.getErrorMessage(error)
        });
        // Return default locale preference
        return of(LocalePreference.create(CountryCode.create('US'), 'en'));
      })
    );
  }

  private getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';
    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = ['en', 'de', 'np'];
    return supportedLanguages.includes(browserLang) ? browserLang : 'en';
  }

  private getErrorMessage(error: any): string {
    if (error?.message?.includes('permission')) {
      return 'Location access denied. Please enable permissions.';
    }
    return 'Could not determine your location. Try manual selection.';
  }
}