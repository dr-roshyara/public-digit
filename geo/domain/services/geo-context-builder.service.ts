/**
 * GeoContextBuilderService - Domain service for constructing validated GeoContext aggregates
 * 
 * Responsibilities:
 * - Transforms raw location data into fully validated GeoContext objects
 * - Handles geographic entity resolution (city/country lookup)
 * - Manages validation pipelines
 * - Supports both fresh and cached location data
 * 
 * @file src/app/core/geo/domain/services/geo-context-builder.service.ts
 */

import { Injectable } from '@angular/core';
import { GeoLocation } from '../value-objects/location.value-object';
import { GeoContext } from '../aggregates/geo-context.model';
import { IGeoRepository } from '../ports/igeo.repository';
import { GeoValidator } from './geo.validator';
import { ErrorLogger } from 'src/app/shared/services/error-logger.service';
import { LatLng } from '../value-objects/lat-lng.value-object';
import { Country } from '../entities/country.entity';
import { City } from '../entities/city.entity';

/**
 * Serialized format for GeoContext persistence
 * 
 * Design Notes:
 * - Optimized for storage (flat structure)
 * - Uses primitive types for serialization
 * - Maintains all essential context metadata
 */

@Injectable({ providedIn: 'root' })
export class GeoContextBuilderService {
  constructor(
    private readonly geoRepository: IGeoRepository,
    private readonly geoValidator: GeoValidator,
    private readonly errorLogger: ErrorLogger
  ) {}

  /**
   * Constructs a validated GeoContext from raw location data
   * 
   * @param location - Source location data
   * @param options - Builder configuration:
   *   - validateServiceability: Check business rules (default: true)
   *   - requireFreshData: Reject stale locations (default: false)
   *   - maxLocationAgeMs: Maximum acceptable age (default: 5 minutes)
   * 
   * @throws DomainError when:
   *   - Location data is invalid or stale
   *   - Geographic entities cannot be resolved
   *   - Serviceability validation fails
   */
  async build(
    location: GeoLocation,
    options: {
      validateServiceability?: boolean;
      requireFreshData?: boolean;
      maxLocationAgeMs?: number;
    } = {}
  ): Promise<GeoContext> {
    const {
      validateServiceability = true,
      requireFreshData = false,
      maxLocationAgeMs = 300000 // 5 minutes
    } = options;

    try {
      this.validateInputLocation(location, { requireFreshData, maxLocationAgeMs });

      const [city, country] = await this.resolveGeographicEntities(location.coordinates);

      const context = GeoContext.create({
        city,
        country,
        coordinates: location.coordinates,
        source: location.source,
        timestamp: location.timestamp
      });

      if (validateServiceability) {
        await this.validateContextServiceability(context);
      }

      return context;
    } catch (error) {
      this.logBuildError(error, location, options);
      throw error;
    }
  }

  /**
   * Reconstructs GeoContext from serialized cache data
   * 
   * @param cacheData - Serialized location data
   * 
   * @throws DomainError when:
   *   - Cache structure is invalid
   *   - Geographic entities cannot be resolved
   */
  async buildFromCache(cacheData: unknown): Promise<GeoContext> {
    if (!this.isValidCache(cacheData)) {
      const error = new DomainError('INVALID_CACHE_STRUCTURE');
      this.errorLogger.error('Cache validation failed', { error, cacheData });
      throw error;
    }

    try {
      const location = new GeoLocation(
        new LatLng(
          cacheData.coordinates.lat,
          cacheData.coordinates.lng,
          cacheData.coordinates.accuracy
        ),
        new Date(cacheData.timestamp),
        cacheData.source as any
      );

      return this.build(location, { validateServiceability: false });
    } catch (error) {
      this.errorLogger.error('Cache restoration failed', { error, cacheData });
      throw error;
    }
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Validates basic location requirements before processing
   */
  private validateInputLocation(
    location: GeoLocation,
    options: { requireFreshData: boolean; maxLocationAgeMs: number }
  ): void {
    if (options.requireFreshData && !location.isRecent(options.maxLocationAgeMs)) {
      throw new DomainError('STALE_LOCATION_DATA', {
        ageMs: Date.now() - location.timestamp.getTime(),
        maxAllowedAgeMs: options.maxLocationAgeMs
      });
    }

    if (!location.coordinates.isValid()) {
      throw new DomainError('INVALID_COORDINATES');
    }
  }

  /**
   * Resolves city and country entities from coordinates
   */
  private async resolveGeographicEntities(coordinates: LatLng): Promise<[City, Country]> {
    const [city, country] = await Promise.all([
      this.geoRepository.getCityByCoordinates(coordinates),
      this.geoRepository.getCountryByCoordinates(coordinates)
    ]);

    if (!city || !country) {
      throw new DomainError('GEOGRAPHIC_ENTITIES_NOT_FOUND', {
        coordinates: coordinates.toString()
      });
    }

    return [city, country];
  }

  /**
   * Validates context against business rules
   */
  private async validateContextServiceability(context: GeoContext): Promise<void> {
    const result = await this.geoValidator.validate(context);
    if (!result.isValid) {
      throw new DomainError('LOCATION_UNSERVICEABLE', {
        reason: result.reason,
        metadata: result.metadata
      });
    }
  }

  /**
   * Type guard for cache validation
   */
  private isValidCache(data: unknown): data is GeoContextCache {
    return (
      typeof data === 'object' &&
      data !== null &&
      'cityId' in data &&
      'countryCode' in data &&
      'coordinates' in data &&
      'source' in data &&
      'timestamp' in data
    );
  }

  /**
   * Standardized error logging
   */
  private logBuildError(
    error: unknown,
    location: GeoLocation,
    options: Record<string, unknown>
  ): void {
    this.errorLogger.error('GeoContext build failed', {
      error,
      location: location.toJSON(),
      options,
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

