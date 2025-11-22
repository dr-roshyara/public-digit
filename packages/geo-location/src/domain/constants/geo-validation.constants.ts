/**
 * GeoValidation Constants - Standardized location validation framework
 * 
 * Provides a comprehensive system for:
 * - Machine-readable validation failure codes
 * - User-friendly remediation messages
 * - Error classification and handling
 * - UI action recommendations
 *
 * @module GeoValidation
 * @version 1.0.0
 * @file geo/domain/constants/geo-validation.constants.ts
 */

/**
 * Hierarchical validation failure reasons
 * 
 * @enum {string}
 * @property {string} COUNTRY_NOT_FOUND - Requested country not in database
 * @property {string} COUNTRY_NOT_SERVICEABLE - Country exists but not serviced
 * @property {string} CITY_NOT_FOUND - City not recognized in selected country
 * @property {string} CITY_INACTIVE - City exists but service unavailable
 * @property {string} RESTRICTED_AREA - Geopolitical or security restrictions
 * @property {string} OUTSIDE_COVERAGE - Outside operational boundaries
 * @property {string} SELECTION_FAILED - Technical failure in selection process
 * @property {string} INVALID_COORDINATES - Malformed or impossible coordinates
 */
export enum ValidationReason {
  /* Country-level validation failures */
  COUNTRY_NOT_FOUND = 'COUNTRY_NOT_FOUND',
  COUNTRY_NOT_SERVICEABLE = 'COUNTRY_NOT_SERVICEABLE',

  /* City-level validation failures */
  CITY_NOT_FOUND = 'CITY_NOT_FOUND',
  CITY_INACTIVE = 'CITY_INACTIVE',

  /* Geographic validation failures */
  RESTRICTED_AREA = 'RESTRICTED_AREA',
  OUTSIDE_COVERAGE = 'OUTSIDE_COVERAGE',

  /* Selection process failures */
  SELECTION_FAILED = 'SELECTION_FAILED',
  INVALID_COORDINATES = 'INVALID_COORDINATES',

  /* System failures */
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

/**
 * Standardized remediation messages for end users
 * 
 * @constant {Record<ValidationReason, string>}
 */
export const ValidationRemedies: Record<ValidationReason, string> = {
  [ValidationReason.COUNTRY_NOT_FOUND]:
    'This country is not currently supported. Please try a nearby location.',
  [ValidationReason.COUNTRY_NOT_SERVICEABLE]:
    'Service is unavailable in this country. We hope to expand soon!',
  [ValidationReason.CITY_NOT_FOUND]:
    'City not recognized. Please verify your selection.',
  [ValidationReason.CITY_INACTIVE]:
    'Service is not available in this city. Please choose a nearby location.',
  [ValidationReason.RESTRICTED_AREA]:
    'This area has access restrictions. Please select an alternative location.',
  [ValidationReason.OUTSIDE_COVERAGE]:
    'Location outside service area. Please check our coverage map.',
  [ValidationReason.SELECTION_FAILED]:
    'Location selection failed. Please try again or contact support.',
  [ValidationReason.INVALID_COORDINATES]:
    'Invalid geographic coordinates. Please check your input.',
  [ValidationReason.SYSTEM_ERROR]:
    'A system error occurred. Please try again or contact support.'
};

/**
 * UI action types for standardized error handling
 * 
 * @type {'contact-support' | 'view-coverage' | 'notify-availability' | 
 *        'retry-selection' | 'manual-entry' | 'show-alternatives' | 
 *        'show-boundaries' | 'retry-entry' | 'manual-selection'}
 */
export type ValidationActionType = 
  | 'contact-support'
  | 'view-coverage'
  | 'notify-availability'
  | 'retry-selection'
  | 'manual-entry'
  | 'show-alternatives'
  | 'show-boundaries'
  | 'retry-entry'
  | 'manual-selection';

/**
 * Error severity classification
 * 
 * @type {'error' | 'warning'}
 */
export type ValidationSeverityLevel = 'error' | 'warning';

/**
 * Severity classification for each validation error
 * 
 * @constant {Record<ValidationReason, ValidationSeverityLevel>}
 */
export const ValidationSeverity: Record<ValidationReason, ValidationSeverityLevel> = {
  [ValidationReason.COUNTRY_NOT_FOUND]: 'error',
  [ValidationReason.COUNTRY_NOT_SERVICEABLE]: 'error',
  [ValidationReason.CITY_NOT_FOUND]: 'warning',
  [ValidationReason.CITY_INACTIVE]: 'warning',
  [ValidationReason.RESTRICTED_AREA]: 'error',
  [ValidationReason.OUTSIDE_COVERAGE]: 'warning',
  [ValidationReason.SELECTION_FAILED]: 'error',
  [ValidationReason.INVALID_COORDINATES]: 'warning',
  [ValidationReason.SYSTEM_ERROR]: 'error'
};

/**
 * Recommended UI actions for each error type
 * 
 * @constant {Record<ValidationReason, ValidationActionType[]>}
 */
export const ValidationActions: Record<ValidationReason, ValidationActionType[]> = {
  [ValidationReason.COUNTRY_NOT_FOUND]: ['contact-support', 'view-coverage'],
  [ValidationReason.COUNTRY_NOT_SERVICEABLE]: ['notify-availability'],
  [ValidationReason.CITY_NOT_FOUND]: ['retry-selection', 'manual-entry'],
  [ValidationReason.CITY_INACTIVE]: ['show-alternatives', 'retry-selection'],
  [ValidationReason.RESTRICTED_AREA]: ['show-boundaries', 'contact-support'],
  [ValidationReason.OUTSIDE_COVERAGE]: ['view-coverage', 'contact-support'],
  [ValidationReason.SELECTION_FAILED]: ['retry-selection', 'contact-support'],
  [ValidationReason.INVALID_COORDINATES]: ['retry-entry', 'manual-selection'],
  [ValidationReason.SYSTEM_ERROR]: ['retry-selection', 'contact-support']
};

/**
 * Complete validation error metadata
 * 
 * @interface ValidationDetails
 * @property {string} remedy - User-facing remediation message
 * @property {ValidationSeverityLevel} severity - Error classification
 * @property {ValidationActionType[]} actions - Recommended UI actions
 */
export interface ValidationDetails {
  remedy: string;
  severity: ValidationSeverityLevel;
  actions: ValidationActionType[];
}

/**
 * Type guard for ValidationReason
 * 
 * @function isValidationReason
 * @param {string} reason - Potential validation reason
 * @returns {reason is ValidationReason} Type predicate
 */
export function isValidationReason(reason: string): reason is ValidationReason {
  return Object.values(ValidationReason).includes(reason as ValidationReason);
}

/**
 * Retrieves complete validation metadata for a given reason
 * 
 * @function getValidationDetails
 * @param {ValidationReason} reason - Validation failure reason
 * @returns {ValidationDetails} Structured error details
 * @throws {Error} When invalid reason provided
 */
export function getValidationDetails(reason: ValidationReason): ValidationDetails {
  if (!isValidationReason(reason)) {
    throw new Error(`Invalid validation reason: ${reason}`);
  }

  return {
    remedy: ValidationRemedies[reason],
    severity: ValidationSeverity[reason],
    actions: ValidationActions[reason]
  };
}

/**
 * Example Usage:
 * 
 * ```typescript
 * try {
 *   validateLocation(input);
 * } catch (error) {
 *   if (isValidationReason(error.reason)) {
 *     const details = getValidationDetails(error.reason);
 *     showErrorToast(details.remedy);
 *     renderActionButtons(details.actions);
 *     
 *     if (details.severity === 'error') {
 *       trackCriticalError(error);
 *     }
 *   }
 * }
 * ```
 */