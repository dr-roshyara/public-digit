/**
 * GeoLocationFacade - Shared facade for automatic country detection and language selection
 *
 * This facade provides a unified interface for:
 * - Country detection (IP-based, GPS, or manual)
 * - Language selection based on country and browser preferences
 * - Caching and validation
 * - Reactive state management
 *
 * Can be used by both Angular mobile app and Laravel backend frontend
 */

import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, tap, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { CountryCode } from '../domain/value-objects/country-code.vo';
import { LocalePreference } from '../domain/value-objects/locale-preference.vo';
import { CountryDetectionService } from '../domain/services/country-detection.service';
import { DetectUserLocaleUseCase } from '../application/use-cases/detect-user-locale.use-case';
import { GeoLanguageBridgeService } from '../infrastructure/services/geo-language-bridge.service';

interface GeoLocationState {
  countryCode: CountryCode | null;
  localePreference: LocalePreference | null;
  status: 'idle' | 'detecting' | 'success' | 'error';
  error?: string | null;
}

export class GeoLocationFacade {
  private readonly _state = new BehaviorSubject<GeoLocationState>({
    countryCode: null,
    localePreference: null,
    status: 'idle',
    error: null
  });

  constructor(
    private readonly countryDetectionService: CountryDetectionService,
    private readonly detectUserLocaleUseCase: DetectUserLocaleUseCase
  ) {}

  // ======== PUBLIC API ========

  /** Full geo state observable */
  get state$(): Observable<GeoLocationState> {
    return this._state.asObservable();
  }

  /** Current country code stream */
  get countryCode$(): Observable<CountryCode | null> {
    return this._state.pipe(
      map(state => state.countryCode),
      distinctUntilChanged()
    );
  }

  /** Current locale preference stream */
  get localePreference$(): Observable<LocalePreference | null> {
    return this._state.pipe(
      map(state => state.localePreference),
      distinctUntilChanged()
    );
  }

  /** Current resolved locale (language code) */
  get currentLocale$(): Observable<string> {
    return this.localePreference$.pipe(
      map(preference => preference?.resolvedLocale || 'en'),
      distinctUntilChanged()
    );
  }

  /**
   * Detect user's country and locale preference
   * @param forceRefresh Bypass cache when true
   * @param respectUserChoice Respect user's explicit language choice
   */
  detectUserLocale(forceRefresh = false, respectUserChoice = true): Observable<LocalePreference> {
    this._state.next({ ...this._state.value, status: 'detecting' });

    return from(this.detectUserLocaleUseCase.execute({
      forceRefresh,
      respectUserChoice
    })).pipe(
      tap(localePreference => {
        this._state.next({
          countryCode: localePreference.countryCode,
          localePreference,
          status: 'success',
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

  /**
   * Manually set country and locale
   * @param countryCode ISO country code
   * @param languageCode Language code
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
        countryCode: country,
        localePreference,
        status: 'success',
        error: null
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
   * Clear user's explicit language choice (enable auto-detection)
   */
  clearUserPreference(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('user_explicit_locale');
    }

    // Trigger auto-detection
    this.detectUserLocale(true, false);
  }

  /**
   * Check if user has explicitly chosen a language
   */
  hasUserExplicitLocale(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem('user_explicit_locale');
  }

  // ======== PRIVATE METHODS ========

  private getErrorMessage(error: any): string {
    if (error?.message?.includes('permission')) {
      return 'Location access denied. Please enable permissions.';
    }
    return 'Could not determine your location. Try manual selection.';
  }
}