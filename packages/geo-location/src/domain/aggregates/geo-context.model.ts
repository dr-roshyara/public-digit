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
import { InvalidCoordinatesError, GeoContextError } from '../../shared/errors/domain.error';
import { GeoSourceType } from '../constants/geo-source.constants';
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
      throw new InvalidCoordinatesError(
        `Invalid coordinates: lat=${params.coordinates.latitude}, lng=${params.coordinates.longitude}. Valid range: [-90 ≤ lat ≤ 90, -180 ≤ lng ≤ 180]`
      );
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
        throw new GeoContextError(
          `GeoContext hydration failed: Missing ${!city ? 'city' : 'country'} for cache data (cityId: ${cache.cityId}, countryCode: ${cache.countryCode})`,
          'GEO_CONTEXT_HYDRATION_FAILED'
        );
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
      throw new GeoContextError(
        `GeoContext cache is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GEO_CONTEXT_CACHE_INVALID'
      );
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
      throw new GeoContextError(
        `Geographic boundary mismatch: City ${city.name} (${city.countryCode}) does not belong to ${country.name} (${country.code})`,
        'GEO_BOUNDARY_MISMATCH'
      );
    }
  }

  private isInRestrictedZone(): boolean {
    // Implementation would check against geofence service
    return false;
  }
}