/**
 * GeoFacadeFactoryService - Factory for creating geo facade instances
 *
 * This service:
 * - Creates appropriate facade instances for different environments
 * - Handles dependency injection
 * - Provides easy integration for both frontends
 */

import { UnifiedGeoLocationFacade } from '../facades/unified-geo-location.facade';
import { GeoLocationFacade as ExistingGeoFacade } from '../application/facades/geo-location.facade';
import { CountryDetectionService } from '../domain/services/country-detection.service';

// Import existing geo dependencies (these would be properly injected in real usage)
import { GeoLocationPort } from '../domain/ports/geo-location.port';
import { IGeoRepository } from '../domain/ports/igeo.repository';
import { GeoValidator } from '../domain/services/geo.validator';
import { GeoCacheService } from '../application/services/geo-cache.service';

export class GeoFacadeFactoryService {
  /**
   * Create unified geo facade for Angular mobile app
   */
  static createForAngular(
    existingGeoFacade: ExistingGeoFacade,
    countryDetectionService: CountryDetectionService
  ): UnifiedGeoLocationFacade {
    return new UnifiedGeoLocationFacade(existingGeoFacade, countryDetectionService);
  }

  /**
   * Create unified geo facade for Laravel backend frontend
   */
  static createForLaravelFrontend(
    existingGeoFacade: ExistingGeoFacade,
    countryDetectionService: CountryDetectionService
  ): UnifiedGeoLocationFacade {
    return new UnifiedGeoLocationFacade(existingGeoFacade, countryDetectionService);
  }

  /**
   * Create existing geo facade (for backward compatibility)
   */
  static createExistingGeoFacade(
    geoLocation: GeoLocationPort,
    geoRepo: IGeoRepository,
    validator: GeoValidator,
    cache: GeoCacheService
  ): ExistingGeoFacade {
    return new ExistingGeoFacade(geoLocation, geoRepo, validator, cache);
  }

  /**
   * Create country detection service
   */
  static createCountryDetectionService(): CountryDetectionService {
    return new CountryDetectionService();
  }

  /**
   * Check if existing geo implementation is available
   */
  static isExistingGeoAvailable(): boolean {
    // Check if we're in a browser environment and geo services are available
    if (typeof navigator === 'undefined') return false;

    // Check if geolocation API is available
    return 'geolocation' in navigator;
  }

  /**
   * Get recommended facade type for current environment
   */
  static getRecommendedFacadeType(): 'unified' | 'existing' {
    return this.isExistingGeoAvailable() ? 'unified' : 'existing';
  }
}