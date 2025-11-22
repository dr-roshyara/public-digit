/**
 * GeoLocationHttpRepository - Infrastructure Repository Implementation
 *
 * DDD INFRASTRUCTURE LAYER - Implements domain repository using HTTP/external services
 *
 * PURPOSE:
 * - Implement GeoLocationRepository interface (domain port)
 * - Use HTTP services to detect country
 * - Manage local caching via localStorage
 * - Handle external service failures gracefully
 *
 * ARCHITECTURE:
 * Domain Repository Interface (Port) ← Implementation (Adapter) → External Services
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// Domain port (interface)
import { GeoLocationRepository } from '@domain/geo-location/repositories/geo-location.repository';
import { CountryCode } from '@domain/geo-location/value-objects/country-code.vo';
import { LocalePreference } from '@domain/geo-location/value-objects/locale-preference.vo';

/**
 * HTTP-based implementation of GeoLocationRepository
 *
 * USES:
 * - IP geolocation API (ipapi.co) for country detection
 * - localStorage for caching
 * - Browser APIs as fallback
 */
@Injectable({ providedIn: 'root' })
export class GeoLocationHttpRepository implements GeoLocationRepository {
  private readonly http = inject(HttpClient);

  // Configuration
  private readonly CACHE_KEY_PREFIX = 'geo_location_';
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly API_TIMEOUT_MS = 5000; // 5 seconds

  /**
   * Detect user's country using IP geolocation
   *
   * STRATEGY:
   * 1. Check cache first
   * 2. Try primary IP geolocation API (ipapi.co)
   * 3. Fallback to browser language inference
   * 4. Cache the result
   */
  async detectCountry(): Promise<CountryCode> {
    // Check cache first
    const cachedCountry = this.getCachedCountry();
    if (cachedCountry) {
      console.log('🎯 Using cached country:', cachedCountry.toString());
      return cachedCountry;
    }

    // Try IP geolocation API
    try {
      const countryCode = await this.detectCountryFromIP();
      if (countryCode) {
        this.cacheCountry(countryCode);
        return countryCode;
      }
    } catch (error) {
      console.warn('⚠️ IP geolocation failed:', error);
    }

    // Fallback to browser language
    const fallbackCountry = this.detectCountryFromBrowser();
    this.cacheCountry(fallbackCountry);
    return fallbackCountry;
  }

  /**
   * Cache locale preference for future use
   */
  async cacheLocalePreference(preference: LocalePreference): Promise<void> {
    try {
      const cacheData = {
        locale: preference.resolvedLocale,
        countryCode: preference.countryCode.toString(),
        timestamp: Date.now()
      };

      localStorage.setItem(
        `${this.CACHE_KEY_PREFIX}locale_preference`,
        JSON.stringify(cacheData)
      );

      console.log('💾 Cached locale preference:', cacheData);
    } catch (error) {
      console.warn('⚠️ Failed to cache locale preference:', error);
    }
  }

  /**
   * Get cached locale preference
   */
  async getCachedLocalePreference(): Promise<LocalePreference | null> {
    try {
      const cachedData = localStorage.getItem(`${this.CACHE_KEY_PREFIX}locale_preference`);
      if (!cachedData) {
        return null;
      }

      const parsed = JSON.parse(cachedData);

      // Check if cache is expired
      const age = Date.now() - parsed.timestamp;
      if (age > this.CACHE_DURATION_MS) {
        console.log('⏰ Cached locale preference expired');
        localStorage.removeItem(`${this.CACHE_KEY_PREFIX}locale_preference`);
        return null;
      }

      console.log('🎯 Using cached locale preference:', parsed);

      // Reconstruct domain value object
      const countryCode = CountryCode.create(parsed.countryCode);
      return LocalePreference.create(countryCode, parsed.locale);

    } catch (error) {
      console.warn('⚠️ Failed to get cached locale preference:', error);
      return null;
    }
  }

  // ======== PRIVATE HELPER METHODS ========

  /**
   * Detect country from IP using external API
   */
  private async detectCountryFromIP(): Promise<CountryCode | null> {
    try {
      console.log('🌍 Detecting country from IP...');

      // Use free IP geolocation service
      const response = await firstValueFrom(
        this.http.get('https://ipapi.co/country_code/', { responseType: 'text' }).pipe(
          timeout(this.API_TIMEOUT_MS),
          catchError(error => {
            console.warn('ipapi.co failed, trying fallback...');
            return of(null);
          })
        )
      );

      if (response && typeof response === 'string') {
        const countryCodeStr = response.trim().toUpperCase();

        // Validate country code
        if (countryCodeStr.length === 2 && /^[A-Z]{2}$/.test(countryCodeStr)) {
          console.log('✅ Detected country from IP:', countryCodeStr);
          return CountryCode.create(countryCodeStr);
        }
      }

      return null;

    } catch (error) {
      console.warn('❌ IP geolocation failed:', error);
      return null;
    }
  }

  /**
   * Infer country from browser language settings
   */
  private detectCountryFromBrowser(): CountryCode {
    const browserLang = navigator.language.toLowerCase();

    console.log('🌐 Inferring country from browser language:', browserLang);

    // Common language → country mappings
    const languageCountryMap: Record<string, string> = {
      'np': 'NP',      // Nepali → Nepal
      'ne-np': 'NP',   // Nepali (Nepal) → Nepal
      'de-de': 'DE',   // German (Germany) → Germany
      'de-at': 'AT',   // German (Austria) → Austria
      'de-ch': 'CH',   // German (Switzerland) → Switzerland
      'de': 'DE',      // German → Germany (default)
      'en-us': 'US',   // English (US) → United States
      'en-gb': 'GB',   // English (UK) → United Kingdom
      'en': 'US'       // English → United States (default)
    };

    const countryCode = languageCountryMap[browserLang] || 'US';

    console.log('🎯 Inferred country:', countryCode);

    return CountryCode.create(countryCode);
  }

  /**
   * Get cached country code
   */
  private getCachedCountry(): CountryCode | null {
    try {
      const cachedData = localStorage.getItem(`${this.CACHE_KEY_PREFIX}country`);
      if (!cachedData) {
        return null;
      }

      const parsed = JSON.parse(cachedData);

      // Check if cache is expired
      const age = Date.now() - parsed.timestamp;
      if (age > this.CACHE_DURATION_MS) {
        localStorage.removeItem(`${this.CACHE_KEY_PREFIX}country`);
        return null;
      }

      return CountryCode.create(parsed.countryCode);

    } catch (error) {
      return null;
    }
  }

  /**
   * Cache country code
   */
  private cacheCountry(countryCode: CountryCode): void {
    try {
      const cacheData = {
        countryCode: countryCode.toString(),
        timestamp: Date.now()
      };

      localStorage.setItem(
        `${this.CACHE_KEY_PREFIX}country`,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.warn('⚠️ Failed to cache country:', error);
    }
  }
}
