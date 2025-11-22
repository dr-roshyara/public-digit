/**
 * ExistingGeoAdapter - Bridge between existing geo implementation and new language detection facade
 *
 * This adapter:
 * - Uses the existing GeoLocationFacade for location detection
 * - Extracts country code from GeoContext
 * - Provides country detection for language selection
 * - Maintains compatibility with both implementations
 */

import { Observable, from, map, catchError, of } from 'rxjs';
import { CountryCode } from '../../domain/value-objects/country-code.vo';
import { LocalePreference } from '../../domain/value-objects/locale-preference.vo';

// Import types from existing implementation (these would need to be adjusted based on actual imports)
type GeoContext = any; // Would be imported from existing geo implementation
type GeoLocationFacade = any; // Would be imported from existing geo implementation

export class ExistingGeoAdapter {
  constructor(private readonly existingGeoFacade: GeoLocationFacade) {}

  /**
   * Detect country using existing geo implementation
   */
  detectCountry(): Observable<CountryCode> {
    return this.existingGeoFacade.detectLocation().pipe(
      map((geoContext: GeoContext | null) => {
        if (!geoContext) {
          throw new Error('No location detected by existing geo facade');
        }

        // Extract country code from GeoContext
        const countryCode = geoContext.countryCode;
        if (!countryCode) {
          throw new Error('No country code found in geo context');
        }

        return CountryCode.createFromIP(countryCode);
      }),
      catchError(error => {
        console.warn('Existing geo detection failed, falling back to IP detection:', error);
        return this.fallbackToIPDetection();
      })
    );
  }

  /**
   * Get current geo context from existing implementation
   */
  getCurrentGeoContext(): Observable<GeoContext | null> {
    return this.existingGeoFacade.currentContext$;
  }

  /**
   * Check if existing geo implementation is available and working
   */
  isAvailable(): Observable<boolean> {
    return this.existingGeoFacade.currentContext$.pipe(
      map(context => !!context && !!context.countryCode),
      catchError(() => of(false))
    );
  }

  private fallbackToIPDetection(): Observable<CountryCode> {
    return from(this.detectCountryFromIP()).pipe(
      map(countryCode => CountryCode.createFromIP(countryCode)),
      catchError(() => {
        // Ultimate fallback
        return of(CountryCode.create('US'));
      })
    );
  }

  private async detectCountryFromIP(): Promise<string | null> {
    try {
      const response = await fetch('https://ipapi.co/country/');
      if (response.ok) {
        const countryCode = await response.text();
        return countryCode.trim() || null;
      }
    } catch (error) {
      console.warn('IP geolocation service unavailable:', error);
    }

    return null;
  }
}