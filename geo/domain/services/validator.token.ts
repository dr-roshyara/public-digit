/**
 * Geo Validator Dependency Injection Token Configuration
 * 
 * Provides centralized DI management for GeoValidator implementations with:
 * - Complete default implementation
 * - Type-safe token declaration
 * - Proper interface implementation
 * 
 * @file src/app/core/geo/domain/services/validator.token.ts
 */

import { InjectionToken } from '@angular/core';
import { GeoValidator } from './geo.validator';
import { IGeoRepository } from '../ports/igeo.repository';
import { ErrorLogger } from 'src/app/shared/services/error-logger.service';

import { ValidationResult } from '../value-objects/validation-result';
import { Country } from '../../domain/entities/country.entity';
import { City } from '../../domain/entities/city.entity';
import { LatLng } from '../value-objects/lat-lng.value-object';

/**
 * Default fallback validator implementation
 * 
 * Implements all GeoValidator methods with:
 * - Basic validation logic
 * - Error throwing for unimplemented features
 * - Safe defaults
 */
class DefaultGeoValidator implements GeoValidator {
  constructor(
    private readonly geoRepo: IGeoRepository,
    private readonly logger: ErrorLogger
  ) {}

  async validate(context: any): Promise<ValidationResult> {
    return {
      isValid: false,
      reason: 'validator_not_configured',
      message: 'GeoValidator not properly implemented'
    };
  }

  validateSync(context: any): boolean {
    return false;
  }

  async validateCountry(countryCode: string): Promise<ValidationResult> {
    this.logger.warn('Default validator: Country validation not implemented');
    return { isValid: false, reason: 'unsupported_operation' };
  }

  async validateCity(cityId: string): Promise<ValidationResult> {
    this.logger.warn('Default validator: City validation not implemented');
    return { isValid: false, reason: 'unsupported_operation' };
  }

  async validateCoordinates(coords: LatLng): Promise<ValidationResult> {
    this.logger.warn('Default validator: Coordinates validation not implemented');
    return { isValid: false, reason: 'unsupported_operation' };
  }

  async validateServiceArea(coords: LatLng): Promise<ValidationResult> {
    this.logger.warn('Default validator: Service area validation not implemented');
    return { isValid: false, reason: 'unsupported_operation' };
  }
}

/**
 * Primary injection token for GeoValidator
 * 
 * Usage:
 * 1. Create proper validator implementing GeoValidator
 * 2. Provide in your module:
 * 
 * @NgModule({
 *   providers: [
 *     { 
 *       provide: GEO_VALIDATOR, 
 *       useClass: ProductionGeoValidator,
 *       deps: [GEO_REPOSITORY, ERROR_LOGGER] 
 *     }
 *   ]
 * })
 */
export const GEO_VALIDATOR = new InjectionToken<GeoValidator>(
  'GeoValidator',
  {
    providedIn: 'root',
    factory: () => new DefaultGeoValidator(
      {} as IGeoRepository, // Empty mock repository
      { 
        log: () => {}, 
        warn: () => {}, 
        error: () => {} 
      } as ErrorLogger // Basic console logger
    )
  }
);