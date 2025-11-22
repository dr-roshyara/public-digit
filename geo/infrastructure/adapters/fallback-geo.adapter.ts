import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { GeoLocationPort } from '../../domain/ports/geo-location.port';
import { GeoContext } from '../../domain/aggregates/geo-context.model';
import { GeoSource } from '../../domain/constants/geo-source.constants';
import { City } from '../../domain/entities/city.entity';
import { Country } from '../../domain/entities/country.entity';
import { LatLng } from '../../domain/value-objects/lat-lng.value-object';

/**
 * Fallback implementation of GeoLocationPort
 *
 * Provides default location services when:
 * - Primary location services fail
 * - No other adapters are available
 * - Testing/demo environments
 */

@Injectable({ providedIn: 'root' })
export class FallbackGeoLocationAdapter implements GeoLocationPort {
  readonly source = GeoSource.FALLBACK;
  readonly accuracy = 10000; // Still kept for internal use
  readonly requiresUserInteraction = false;

  private readonly defaultLocation = {
    lat: 40.7128,
    lng: -74.0060,
    city: 'New York',
    country: 'United States',
    countryCode: 'US',
    timezone: 'America/New_York',
    currencyCode: 'USD',
    phoneCode: '+1',
    flagEmoji: '🇺🇸'
  };

  fetchGeoContext(options?: {
    timeout?: number;
    enableHighAccuracy?: boolean;
    cachePolicy?: 'fresh' | 'cached' | 'any';
  }): Observable<GeoContext | null> {
    return of(this.createFallbackContext(options));
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  private createFallbackContext(options?: {
    enableHighAccuracy?: boolean;
  }): GeoContext {
    const coordinates = new LatLng(this.defaultLocation.lat, this.defaultLocation.lng);

    const cityProps = {
      id: 'fallback-city',
      name: this.defaultLocation.city,
      nativeName: this.defaultLocation.city,
      countryCode: this.defaultLocation.countryCode,
      coordinates: coordinates,
      timezone: this.defaultLocation.timezone,
      isActive: true,
      postalCode: '10001',
      population: 8419000
    };

    const countryProps = {
      code: this.defaultLocation.countryCode,
      name: this.defaultLocation.country,
      nativeName: this.defaultLocation.country,
      coordinates: coordinates,
      timezone: this.defaultLocation.timezone,
      isActive: true,
      currencyCode: this.defaultLocation.currencyCode,
      phoneCode: this.defaultLocation.phoneCode,
      flagEmoji: this.defaultLocation.flagEmoji,
      isServiceable: true,
      capital: 'Washington, D.C.',
      continent: 'North America'
    };

    return {
      city: new City(cityProps),
      country: new Country(countryProps),
      coordinates: coordinates,
      source: this.source,
      timestamp: new Date(),
      // Removed accuracy as it's not part of GeoContext
      isMock: true,
      // If you need to include accuracy, you should extend the GeoContext type
      // metadata: { accuracy: options?.enableHighAccuracy ? 5000 : this.accuracy }
    };
  }
}