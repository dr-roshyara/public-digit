/**
 * IP Geolocation Adapter - Infrastructure Layer
 *
 * DDD INFRASTRUCTURE LAYER - External service integration
 *
 * PURPOSE:
 * - Detect user's country/region based on IP address
 * - Privacy-focused (no GPS, no permissions required)
 * - Free tier APIs with fallback strategy
 * - GDPR/CCPA compliant (no personal data storage)
 *
 * DETECTION STRATEGY:
 * 1. Primary: ipapi.co (free tier: 1,000 req/day)
 * 2. Fallback: ipgeolocation.io (free tier: 1,000 req/day)
 * 3. Ultimate Fallback: Browser timezone/language
 *
 * ARCHITECTURE:
 * Infrastructure → Domain (via ports/interfaces)
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout, retry, shareReplay } from 'rxjs/operators';

/**
 * IP Geolocation Detection Result
 */
export interface IpGeolocationResult {
  // Location data
  country: string;           // ISO 3166-1 alpha-2 (e.g., "US", "DE", "NP")
  countryName: string;       // Full country name
  region?: string;           // State/Province
  city?: string;             // City name

  // Locale inference
  languages?: string[];      // Preferred languages
  timezone?: string;         // IANA timezone (e.g., "Europe/Berlin")

  // Metadata
  confidence: number;        // 0.0 to 1.0
  source: 'ipapi' | 'ipgeolocation' | 'browser' | 'cached';
  timestamp: Date;

  // Optional coordinates (if provided by API)
  latitude?: number;
  longitude?: number;
}

/**
 * Cache entry for IP geolocation
 */
interface CachedGeolocation {
  result: IpGeolocationResult;
  expiresAt: Date;
}

/**
 * IP Geolocation Adapter
 *
 * PRODUCTION PATTERN: Multi-Provider Fallback
 * - Tries multiple providers for reliability
 * - Caches results to reduce API calls
 * - Respects rate limits and privacy
 */
@Injectable({
  providedIn: 'root'
})
export class IpGeolocationAdapter {
  private http = inject(HttpClient);

  // Cache for IP geolocation results (30 minutes TTL)
  private cache: CachedGeolocation | null = null;
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  // API endpoints
  private readonly IPAPI_URL = 'https://ipapi.co/json/';
  private readonly IPGEOLOCATION_URL = 'https://api.ipgeolocation.io/ipgeo';

  // Request timeout (5 seconds)
  private readonly REQUEST_TIMEOUT_MS = 5000;

  /**
   * Detect user's location based on IP address
   *
   * WORKFLOW:
   * 1. Check cache first
   * 2. Try primary provider (ipapi.co)
   * 3. Fallback to secondary provider (ipgeolocation.io)
   * 4. Ultimate fallback to browser-based detection
   *
   * @param forceRefresh - Bypass cache and force new detection
   * @returns Observable<IpGeolocationResult>
   */
  detect(forceRefresh = false): Observable<IpGeolocationResult> {
    // Step 1: Check cache
    if (!forceRefresh && this.isCacheValid()) {
      console.log('✅ Using cached IP geolocation');
      return of(this.cache!.result);
    }

    console.log('🌍 Detecting location via IP geolocation...');

    // Step 2: Try primary provider
    return this.detectWithIpApi().pipe(
      catchError(error => {
        console.warn('⚠️ Primary IP API failed, trying fallback...', error);

        // Step 3: Fallback to secondary provider
        return this.detectWithIpGeolocation().pipe(
          catchError(fallbackError => {
            console.warn('⚠️ Secondary IP API failed, using browser fallback...', fallbackError);

            // Step 4: Ultimate fallback
            return of(this.detectFromBrowser());
          })
        );
      }),
      map(result => {
        // Cache the result
        this.cacheResult(result);
        return result;
      }),
      shareReplay(1)
    );
  }

  /**
   * Detect using ipapi.co (Primary Provider)
   *
   * FREE TIER: 1,000 requests/day
   * ACCURACY: High (country-level ~99%, city-level ~95%)
   * PRIVACY: No registration required
   */
  private detectWithIpApi(): Observable<IpGeolocationResult> {
    return this.http.get<any>(this.IPAPI_URL).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      retry(1), // Retry once on network errors
      map(response => this.mapIpApiResponse(response)),
      catchError(error => this.handleHttpError(error, 'ipapi'))
    );
  }

  /**
   * Detect using ipgeolocation.io (Secondary Provider)
   *
   * FREE TIER: 1,000 requests/day
   * ACCURACY: High (country-level ~99%)
   * PRIVACY: No API key required for basic geolocation
   */
  private detectWithIpGeolocation(): Observable<IpGeolocationResult> {
    return this.http.get<any>(this.IPGEOLOCATION_URL).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      retry(1),
      map(response => this.mapIpGeolocationResponse(response)),
      catchError(error => this.handleHttpError(error, 'ipgeolocation'))
    );
  }

  /**
   * Detect from browser (Ultimate Fallback)
   *
   * SOURCES:
   * - Browser language preferences
   * - Timezone
   * - Locale settings
   *
   * ACCURACY: Low to Medium (depends on browser settings)
   * PRIVACY: Perfect (no external requests)
   */
  private detectFromBrowser(): IpGeolocationResult {
    const browserLang = this.getBrowserLanguage();
    const timezone = this.getBrowserTimezone();
    const inferredCountry = this.inferCountryFromTimezone(timezone);

    console.log('🌐 Browser-based detection:', {
      language: browserLang,
      timezone,
      inferredCountry
    });

    return {
      country: inferredCountry,
      countryName: this.getCountryName(inferredCountry),
      timezone,
      languages: [browserLang],
      confidence: 0.3, // Low confidence
      source: 'browser',
      timestamp: new Date()
    };
  }

  /**
   * Map ipapi.co response to our standard format
   */
  private mapIpApiResponse(response: any): IpGeolocationResult {
    return {
      country: response.country_code || 'US',
      countryName: response.country_name || 'United States',
      region: response.region,
      city: response.city,
      timezone: response.timezone,
      languages: response.languages ? response.languages.split(',') : ['en'],
      latitude: response.latitude,
      longitude: response.longitude,
      confidence: 0.9, // High confidence for IP-based detection
      source: 'ipapi',
      timestamp: new Date()
    };
  }

  /**
   * Map ipgeolocation.io response to our standard format
   */
  private mapIpGeolocationResponse(response: any): IpGeolocationResult {
    return {
      country: response.country_code2 || 'US',
      countryName: response.country_name || 'United States',
      region: response.state_prov,
      city: response.city,
      timezone: response.time_zone?.name,
      languages: response.country_calling_code ? [this.inferLanguageFromCountry(response.country_code2)] : ['en'],
      latitude: parseFloat(response.latitude),
      longitude: parseFloat(response.longitude),
      confidence: 0.85, // High confidence for IP-based detection
      source: 'ipgeolocation',
      timestamp: new Date()
    };
  }

  /**
   * Handle HTTP errors with logging
   */
  private handleHttpError(error: HttpErrorResponse, provider: string): Observable<never> {
    const message = `IP geolocation failed (${provider})`;

    if (error.status === 429) {
      console.error(`${message}: Rate limit exceeded`);
    } else if (error.status === 0) {
      console.error(`${message}: Network error or CORS issue`);
    } else {
      console.error(`${message}:`, error.message);
    }

    return throwError(() => new Error(message));
  }

  /**
   * Get browser language preference
   */
  private getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';

    const lang = navigator.language || (navigator as any).userLanguage;
    return lang ? lang.split('-')[0].toLowerCase() : 'en';
  }

  /**
   * Get browser timezone
   */
  private getBrowserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  /**
   * Infer country code from timezone
   *
   * PATTERN: Heuristic mapping based on IANA timezone database
   */
  private inferCountryFromTimezone(timezone: string): string {
    const timezoneToCountry: Record<string, string> = {
      'Europe/Berlin': 'DE',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'America/New_York': 'US',
      'America/Los_Angeles': 'US',
      'America/Chicago': 'US',
      'Asia/Kathmandu': 'NP',
      'Asia/Kolkata': 'IN',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Australia/Sydney': 'AU',
      'Pacific/Auckland': 'NZ'
    };

    // Direct match
    if (timezoneToCountry[timezone]) {
      return timezoneToCountry[timezone];
    }

    // Partial match (e.g., "Europe/Vienna" → "DE" for European timezone)
    const region = timezone.split('/')[0];
    const regionDefaults: Record<string, string> = {
      'Europe': 'DE',
      'America': 'US',
      'Asia': 'IN',
      'Africa': 'KE',
      'Australia': 'AU',
      'Pacific': 'NZ'
    };

    return regionDefaults[region] || 'US';
  }

  /**
   * Infer primary language from country code
   */
  private inferLanguageFromCountry(countryCode: string): string {
    const countryToLanguage: Record<string, string> = {
      'US': 'en',
      'GB': 'en',
      'DE': 'de',
      'FR': 'fr',
      'ES': 'es',
      'IT': 'it',
      'NP': 'ne',
      'IN': 'hi',
      'JP': 'ja',
      'CN': 'zh',
      'BR': 'pt'
    };

    return countryToLanguage[countryCode] || 'en';
  }

  /**
   * Get full country name from ISO code
   */
  private getCountryName(countryCode: string): string {
    const countries: Record<string, string> = {
      'US': 'United States',
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'ES': 'Spain',
      'IT': 'Italy',
      'NP': 'Nepal',
      'IN': 'India',
      'JP': 'Japan',
      'CN': 'China',
      'AU': 'Australia',
      'NZ': 'New Zealand'
    };

    return countries[countryCode] || countryCode;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false;

    const now = new Date();
    return now < this.cache.expiresAt;
  }

  /**
   * Cache geolocation result
   */
  private cacheResult(result: IpGeolocationResult): void {
    const expiresAt = new Date(Date.now() + this.CACHE_TTL_MS);

    this.cache = {
      result: { ...result, source: 'cached' },
      expiresAt
    };

    console.log(`💾 Cached geolocation until ${expiresAt.toLocaleTimeString()}`);
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache = null;
    console.log('🗑️ Geolocation cache cleared');
  }

  /**
   * Get health status for monitoring
   */
  getHealthStatus(): {
    cached: boolean;
    cacheAge?: number;
    lastDetection?: IpGeolocationResult;
  } {
    return {
      cached: this.isCacheValid(),
      cacheAge: this.cache ? Date.now() - this.cache.result.timestamp.getTime() : undefined,
      lastDetection: this.cache?.result
    };
  }
}
