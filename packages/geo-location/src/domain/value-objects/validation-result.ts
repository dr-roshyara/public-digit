/**
 * ValidationResult - Standardized result of geographic validation checks
 *
 * Represents:
 * - Serviceability status
 * - Restriction reasons
 * - Suggested alternatives
 * - Metadata for debugging/analytics
 *
 * @file src/app/core/geo/domain/value-objects/validation-result.ts
 */

import { City } from '../entities/city.entity';
import { Country } from '../entities/country.entity';
import { ValidationReason as GeoValidationReason } from '../constants/geo-validation.constants';

/**
 * Validation failure reasons
 * (Unified with geo-validation.constants)
 */
export type ValidationReason = GeoValidationReason;

/**
 * Suggested alternative location
 */
export interface SuggestedAlternative {
  cityId: string;
  distanceKm: number;
  name: string;
}

/**
 * Core validation result structure
 */
export interface ValidationResult {
  /**
   * Whether location is serviceable
   */
  isValid: boolean;

  /**
   * Primary reason for validation failure
   * (Present when isValid = false)
   */
  reason?: ValidationReason;

  /**
   * Additional restriction details
   * (Specific zones, policies, etc.)
   */
  restrictions?: string[];

  /**
   * Suggested alternative serviceable locations
   */
  suggestedAlternatives?: SuggestedAlternative[];

  /**
   * Contextual metadata
   */
  metadata?: {
    countryCode?: string;
    cityId?: string;
    suggestedAlternatives?: SuggestedAlternative[];
    restrictions?: string[];
  };
}

/**
 * Factory methods for common validation results
 */
export class ValidationResults {
  /**
   * Creates a valid result
   */
  static valid(): ValidationResult {
    return { isValid: true };
  }

  /**
   * Creates an invalid result with reason
   */
  static invalid(reason: ValidationReason, metadata?: {
    countryCode?: string;
    cityId?: string;
    restrictions?: string[];
  }): ValidationResult {
    return {
      isValid: false,
      reason,
      restrictions: metadata?.restrictions,
      metadata: {
        countryCode: metadata?.countryCode,
        cityId: metadata?.cityId,
        restrictions: metadata?.restrictions
      }
    };
  }

  /**
   * Creates result with suggested alternatives
   */
  static withAlternatives(
    alternatives: SuggestedAlternative[],
    countryCode?: string
  ): ValidationResult {
    return {
      isValid: false,
      reason: 'OUT_OF_SERVICE_AREA',
      suggestedAlternatives: alternatives,
      metadata: {
        countryCode,
        suggestedAlternatives: alternatives
      }
    };
  }

  /**
   * Checks if result has serviceable alternatives
   */
  static hasAlternatives(result: ValidationResult): boolean {
    return !!result.suggestedAlternatives?.length;
  }

  /**
   * Merges multiple validation results
   */
  static merge(results: ValidationResult[]): ValidationResult {
    const valid = results.every(r => r.isValid);
    if (valid) return ValidationResults.valid();

    return {
      isValid: false,
      reason: results.find(r => r.reason)?.reason,
      restrictions: results.flatMap(r => r.restrictions || []),
      suggestedAlternatives: results.flatMap(r => r.suggestedAlternatives || []),
      metadata: {
        restrictions: results.flatMap(r => r.metadata?.restrictions || []),
        suggestedAlternatives: results.flatMap(r => r.metadata?.suggestedAlternatives || [])
      }
    };
  }
}