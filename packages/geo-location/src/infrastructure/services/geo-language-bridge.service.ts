/**
 * GeoLanguageBridgeService - Bridges geo location detection with language selection
 *
 * This service:
 * - Uses existing geo implementation when available
 * - Falls back to IP-based detection when needed
 * - Integrates with translation system
 * - Provides unified interface for both frontends
 */

import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';

import { CountryCode } from '../../domain/value-objects/country-code.vo';
import { LocalePreference } from '../../domain/value-objects/locale-preference.vo';
import { CountryDetectionService } from '../../domain/services/country-detection.service';
import { ExistingGeoAdapter } from '../adapters/existing-geo-adapter';

interface LanguageDetectionState {
  localePreference: LocalePreference | null;
  status: 'idle' | 'detecting' | 'success' | 'error';
  source: 'existing-geo' | 'ip-detection' | 'fallback';
  error?: string | null;
}

export class GeoLanguageBridgeService {
  private readonly _state = new BehaviorSubject<LanguageDetectionState>({
    localePreference: null,
    status: 'idle',
    source: 'fallback',
    error: null
  });

  constructor(
    private readonly existingGeoAdapter: ExistingGeoAdapter,
    private readonly countryDetectionService: CountryDetectionService
  ) {}

  // ======== PUBLIC API ========

  /** Current language detection state */
  get state$(): Observable<LanguageDetectionState> {
    return this._state.asObservable();
  }

  /** Current locale preference */
  get localePreference$(): Observable<LocalePreference | null> {
    return this._state.pipe(map(state => state.localePreference));
  }

  /** Current resolved locale (language code) */
  get currentLocale$(): Observable<string> {
    return this.localePreference$.pipe(
      map(preference => preference?.resolvedLocale || 'en')
    );
  }

  /**
   * Detect user's locale preference using best available method
   */
  detectUserLocale(): Observable<LocalePreference> {
    this._state.next({ ...this._state.value, status: 'detecting' });

    return this.existingGeoAdapter.isAvailable().pipe(
      switchMap(isAvailable => {
        if (isAvailable) {
          return this.detectUsingExistingGeo();
        } else {
          return this.detectUsingIP();
        }
      }),
      tap(localePreference => {
        this._state.next({
          localePreference,
          status: 'success',
          source: this._state.value.source,
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
   * Force refresh using specific detection method
   */
  forceRefresh(method: 'existing-geo' | 'ip'): Observable<LocalePreference> {
    this._state.next({ ...this._state.value, status: 'detecting' });

    const detection$ = method === 'existing-geo'
      ? this.detectUsingExistingGeo()
      : this.detectUsingIP();

    return detection$.pipe(
      tap(localePreference => {
        this._state.next({
          localePreference,
          status: 'success',
          source: method === 'existing-geo' ? 'existing-geo' : 'ip-detection',
          error: null
        });
      }),
      catchError(error => {
        this._state.next({
          ...this._state.value,
          status: 'error',
          error: this.getErrorMessage(error)
        });
        return of(LocalePreference.create(CountryCode.create('US'), 'en'));
      })
    );
  }

  // ======== PRIVATE METHODS ========

  private detectUsingExistingGeo(): Observable<LocalePreference> {
    return this.existingGeoAdapter.detectCountry().pipe(
      switchMap(countryCode => {
        this._state.next({ ...this._state.value, source: 'existing-geo' });
        return from(this.countryDetectionService.detectUserLocale());
      })
    );
  }

  private detectUsingIP(): Observable<LocalePreference> {
    this._state.next({ ...this._state.value, source: 'ip-detection' });
    return from(this.countryDetectionService.detectUserLocale());
  }

  private getErrorMessage(error: any): string {
    if (error?.message?.includes('permission')) {
      return 'Location access denied. Please enable permissions.';
    }
    if (error?.message?.includes('service unavailable')) {
      return 'Location services temporarily unavailable.';
    }
    return 'Could not determine your location. Try manual selection.';
  }
}