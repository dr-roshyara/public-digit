/**
 * IpwhoisGeoLocationAdapter - IP-based geolocation using ipwho.is API
 *
 * Implements:
 * - IP address geolocation
 * - Automatic caching
 * - Configurable timeout
 * - Multi-level fallback
 *
 * @file src/app/core/geo/infrastructure/adapters/ipwhois-geo.adapter.ts
 */

import { Injectable, Inject, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, throwError } from 'rxjs';
import { catchError, map, timeout, tap } from 'rxjs/operators';
import { GeoLocationPort } from '../../domain/ports/geo-location.port';
import { GeoContext } from '../../domain/aggregates/geo-context.model';
import { GeoSource } from '../../domain/constants/geo-source.constants';
import { ErrorLogger } from 'src/app/shared/services/error-logger.service';

import { GeoCacheService } from '../../application/services/geo-cache.service';
import { IGeoRepository } from '../../domain/ports/igeo.repository';
import { LatLng } from '../../domain/value-objects/lat-lng.value-object';

interface IpwhoisResponse {
  ip: string;
  success: boolean;
  country: string;
  country_code: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  isp?: string;
  timezone?: {
    name: string;
  };
}

@Injectable({ providedIn: 'root' })
export class IpwhoisGeoLocationAdapter implements GeoLocationPort {
  readonly source = GeoSource.IP;
  readonly accuracy = 5000; // ~5km typical accuracy for IP geolocation
  readonly requiresUserInteraction = false;

  private readonly API_URL = 'https://ipwho.is/';
  private readonly CACHE_KEY = 'ipwhois_location';
  private readonly DEFAULT_TIMEOUT = 5000; // 5 seconds

  constructor(
    private http: HttpClient,
    private logger: ErrorLogger,
    private cache: GeoCacheService,
    @Optional() private geoRepo?: IGeoRepository
  ) {}

  /**
   * Fetches location via IP geolocation
   *
   * @param options Configuration:
   *   - timeout: Request timeout in ms
   *   - useCache: Cache preference (default: true)
   *
   * @returns Observable emitting GeoContext or null
   */
  fetchGeoContext(options?: {
    timeout?: number;
    useCache?: boolean;
  }): Observable<GeoContext | null> {
    const config = {
      timeout: options?.timeout ?? this.DEFAULT_TIMEOUT,
      useCache: options?.useCache ?? true
    };

    if (config.useCache) {
      const cached = this.cache.load(this.CACHE_KEY);
      if (cached) {
        return of(cached);
      }
    }

    return this.http.get<IpwhoisResponse>(this.API_URL).pipe(
      timeout(config.timeout),
      map(response => this.transformResponse(response)),
      tap(context => {
        if (context) {
          this.cache.save(this.CACHE_KEY, context);
        }
      }),
      catchError(error => this.handleError(error, config))
    );
  }

  /**
   * Checks service availability
   */
  isAvailable(): boolean {
    return true; // Always available as fallback
  }

  // ==================== PRIVATE METHODS ====================

  private transformResponse(response: IpwhoisResponse): GeoContext | null {
    if (!response.success || !response.country_code) {
      this.logger.warn('Invalid API response', response);
      return null;
    }

    try {
      return GeoContext.create({
        coordinates: new LatLng(response.latitude, response.longitude, this.accuracy),
        source: this.source,
        city: this.createCity(response),
        country: this.createCountry(response)
      });
    } catch (error) {
      this.logger.error('Context creation failed', error);
      return null;
    }
  }

  private createCountry(response: IpwhoisResponse): Country {
    if (this.geoRepo) {
      const country = this.geoRepo.getCountry(response.country_code);
      if (country) return country;
    }

    return new Country({
      code: response.country_code,
      name: response.country,
      isServiceable: true,
      // Default fallback properties
      currencyCode: 'USD',
      phoneCode: '+1',
      flagEmoji: '🇺🇸',
      timezones: response.timezone ? [response.timezone.name] : ['UTC']
    });
  }

  private createCity(response: IpwhoisResponse): City {
    const cityId = `${response.city}_${response.region}_${response.country_code}`.toLowerCase();

    if (this.geoRepo) {
      const city = this.geoRepo.getCity(cityId);
      if (city) return city;
    }

    return new City({
      id: cityId,
      name: response.city,
      countryCode: response.country_code,
      coordinates: new LatLng(response.latitude, response.longitude),
      isActive: true,
      timezone: response.timezone?.name || 'UTC'
    });
  }

  private handleError(error: any, config: { timeout: number }): Observable<null> {
    this.logger.warn('IP geolocation failed', {
      error,
      timeout: config.timeout
    });

    // Attempt to return cached value if available
    const cached = this.cache.load(this.CACHE_KEY);
    return cached ? of(cached) : of(null);
  }
}

// ==================== USAGE EXAMPLES ====================
// // Provider registration
// providers: [
//   { provide: GeoLocationPort, useClass: IpwhoisGeoLocationAdapter }
// ]
//
// // Consumer usage
// constructor(private geoLocation: GeoLocationPort) {}
//
// this.geoLocation.fetchGeoContext({
//   timeout: 3000
// }).subscribe(context => {
//   if (context) {
//     // Handle IP-based location
//   }
// });