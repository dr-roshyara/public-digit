/**
 * GeoContext - Core domain model representing a validated geographic context
 * 
 * Responsibilities:
 * - Aggregates location data (coordinates, city, country)
 * - Validates geographic consistency
 * - Manages serviceability rules
 * - Handles serialization/deserialization
 * - Provides cache and API representations
 *
 * @aggregate Root entity for location context
 * @version 2.2.0
 * @file geo/domain/aggregates/geo-context.model.ts
 */

import { LatLng } from '../value-objects/lat-lng.value-object';
import { Country } from '../entities/country.entity';
import { City } from '../entities/city.entity';
import { DomainError } from 'src/app/shared/errors/domain.error';
import { GeoSourceType } from 'src/app/core/geo/domain/constants/geo-source.constants';
import { GeoContextCache } from '../interfaces/geo-context-cache.interface';
import { CityProps } from '../entities/city.entity';
import { CountryProps } from '../entities/country.entity';

interface GeoContextParams {
  city: City;
  country: Country;
  coordinates: LatLng;
  source: GeoSourceType;
  timestamp?: Date;
}

interface GeoContextDependencies {
  getCity: (id: string) => Promise<City | null>;
  getCountry: (code: string) => Promise<Country | null>;
}

interface GeoContextDTO {
  city: CityProps;
  country: CountryProps;
  coordinates: { lat: number; lng: number; accuracy?: number };
  source: GeoSourceType;
  timestamp: string;
  isServiceable: boolean;
  freshness?: number;
}

export class GeoContext {
  private constructor(
    private readonly _city: City,
    private readonly _country: Country,
    public readonly coordinates: LatLng,
    public readonly source: GeoSourceType,
    public readonly timestamp: Date
  ) {}

  // ==================== ACCESSORS ====================

  get city(): City {
    return this._city;
  }

  get cityId(): string {
    return this._city.id;
  }

  get country(): Country {
    return this._country;
  }

  get countryCode(): string {
    return this._country.code;
  }

  // ==================== FACTORY METHODS ====================

  static create(params: GeoContextParams): GeoContext {
    this.validateCityCountry(params.city, params.country);
    
    if (!LatLng.isValid(params.coordinates.latitude, params.coordinates.longitude)) {
      throw new DomainError('INVALID_COORDINATES', {
        lat: params.coordinates.latitude,
        lng: params.coordinates.longitude,
        recommendation: 'Verify coordinate values (-90 to 90 for latitude, -180 to 180 for longitude)'
      });
    }

    return new GeoContext(
      params.city,
      params.country,
      params.coordinates,
      params.source,
      params.timestamp ?? new Date()
    );
  }

  static async fromCache(
    cache: GeoContextCache,
    dependencies: GeoContextDependencies
  ): Promise<GeoContext> {
    try {
      const [city, country] = await Promise.all([
        dependencies.getCity(cache.cityId),
        dependencies.getCountry(cache.countryCode)
      ]);

      if (!city || !country) {
        throw new DomainError('GEO_CONTEXT_HYDRATION_FAILED', {
          cacheData: {
            cityId: cache.cityId,
            countryCode: cache.countryCode,
            source: cache.source
          },
          missing: !city ? 'city' : 'country',
          recommendation: 'Verify cache references exist in database'
        });
      }

      return GeoContext.create({
        city,
        country,
        coordinates: new LatLng(
          cache.coordinates.lat,
          cache.coordinates.lng,
          cache.coordinates.accuracy
        ),
        source: cache.source,
        timestamp: new Date(cache.timestamp)
      });
    } catch (error) {
      throw new DomainError('GEO_CONTEXT_CACHE_INVALID', {
        originalError: error,
        cacheData: cache,
        recommendation: 'Clear and rebuild cache with valid references'
      });
    }
  }

  // ==================== DOMAIN LOGIC ====================

  get isServiceable(): boolean {
    return (
      this.country.isServiceable &&
      this.city.isActive &&
      !this.isInRestrictedZone() &&
      LatLng.isValid(this.coordinates.latitude, this.coordinates.longitude)
    );
  }

  isFresh(maxAgeMinutes: number = 60): boolean {
    const ageMs = Date.now() - this.timestamp.getTime();
    return ageMs <= maxAgeMinutes * 60_000;
  }

  // ==================== SERIALIZATION ====================

  toCache(): GeoContextCache {
    return {
      cityId: this.cityId,
      countryCode: this.countryCode,
      coordinates: {
        lat: this.coordinates.latitude,
        lng: this.coordinates.longitude,
        accuracy: this.coordinates.accuracy
      },
      source: this.source,
      timestamp: this.timestamp.toISOString()
    };
  }

  toDTO(): GeoContextDTO {
    return {
      city: this.city.toJSON(),
      country: this.country.toJSON(),
      coordinates: this.coordinates.toJSON(),
      source: this.source,
      timestamp: this.timestamp.toISOString(),
      isServiceable: this.isServiceable,
      freshness: this.getFreshnessInMinutes()
    };
  }

  toString(): string {
    return `${this.city.name}, ${this.country.name} (${this.coordinates.toString()})`;
  }

  // ==================== UTILITIES ====================

  private getFreshnessInMinutes(): number {
    return Math.floor((Date.now() - this.timestamp.getTime()) / 60_000);
  }

  // ==================== VALIDATION ====================

  private static validateCityCountry(city: City, country: Country): void {
    if (city.countryCode !== country.code) {
      throw new DomainError('GEO_BOUNDARY_MISMATCH', {
        city: {
          name: city.name,
          countryCode: city.countryCode
        },
        country: {
          code: country.code,
          name: country.name
        },
        recommendation: 'Verify city-country relationship in database'
      });
    }
  }

  private isInRestrictedZone(): boolean {
    // Implementation would check against geofence service
    return false;
  }
}