/**
 * GeoValidator - Domain Service for Geographic Location Validation
 * 
 * Responsibilities:
 * - Orchestrates multi-phase geographic validation workflows
 * - Enforces business rules for serviceability and restrictions
 * - Provides actionable feedback when validation fails
 * - Maintains separation of concerns with repository pattern
 * 
 * Validation Phases:
 * 1. Country-level validation (serviceability, existence)
 * 2. City-level validation (active status, existence)
 * 3. Location-specific rules (restricted zones, geofencing)
 * 
 * @module GeoValidator
 * @version 3.0.0
 * @file src/app/core/geo/domain/services/geo.validator.ts
 */

import { Injectable } from '@angular/core';
import { IGeoRepository } from '../ports/igeo.repository';
import { ValidationReason } from '../constants/geo-validation.constants';
import { ErrorLogger } from '../../shared/services/error-logger.service';
import { LatLng } from '../value-objects/lat-lng.value-object';
import { GeoContext } from '../aggregates/geo-context.model';

/**
 * Validation Result Structure
 * 
 * @interface ValidationResult
 * @property {boolean} isValid - Overall validation status
 * @property {ValidationReason} [reason] - Failure reason when invalid
 * @property {object} [metadata] - Additional context about validation
 * @property {string} [metadata.countryCode] - Related country code
 * @property {string} [metadata.cityId] - Related city identifier
 * @property {Array} [metadata.suggestedAlternatives] - Nearby serviceable cities
 * @property {string[]} [metadata.restrictions] - Zone restriction details
 */
export interface ValidationResult {
    isValid: boolean;
    reason?: ValidationReason;
    metadata?: {
        countryCode?: string;
        cityId?: string;
        suggestedAlternatives?: Array<{
            cityId: string;
            distanceKm: number;
            name: string;
        }>;
        restrictions?: string[];
    };
}

@Injectable({ providedIn: 'root' })
export class GeoValidator {
    // Default configuration constants
    private readonly DEFAULT_SEARCH_RADIUS_KM = 50;
    private readonly MAX_ALTERNATIVE_SUGGESTIONS = 5;

    constructor(
        private readonly geoRepository: IGeoRepository,
        private readonly errorLogger: ErrorLogger
    ) {}

    /**
     * Validates a geographic context against business rules
     * 
     * @param {GeoContext} context - Complete geographic context to validate
     * @param {object} [options] - Validation configuration options
     * @param {boolean} [options.requireActiveCity=true] - Verify city active status
     * @param {boolean} [options.checkRestrictedZones=true] - Check restricted areas
     * @param {boolean} [options.suggestAlternatives=true] - Provide alternative cities
     * @param {number} [options.alternativeSearchRadiusKm=50] - Search radius for alternatives
     * 
     * @returns {Promise<ValidationResult>} Detailed validation outcome
     * 
     * @example
     * const result = await validator.validate(context, {
     *   checkRestrictedZones: false,
     *   suggestAlternatives: false
     * });
     */
    async validate(
        context: GeoContext,
        options: {
            requireActiveCity?: boolean;
            checkRestrictedZones?: boolean;
            suggestAlternatives?: boolean;
            alternativeSearchRadiusKm?: number;
        } = {}
    ): Promise<ValidationResult> {
        const validationOptions = this.normalizeOptions(options);

        try {
            return await this.executeValidationPipeline(context, validationOptions);
        } catch (error) {
            return this.handleValidationError(error, context);
        }
    }

    // ==================== VALIDATION PIPELINE ====================

    /**
     * Executes the complete validation workflow
     * 
     * @private
     * @param {GeoContext} context - Geographic context to validate
     * @param {NormalizedValidationOptions} options - Normalized validation options
     * @returns {Promise<ValidationResult>} Validation result
     */
    private async executeValidationPipeline(
        context: GeoContext,
        options: NormalizedValidationOptions
    ): Promise<ValidationResult> {
        // Phase 1: Country Validation
        const countryResult = await this.validateCountry(context.countryCode);
        if (!countryResult.isValid) return countryResult;

        // Phase 2: City Validation
        const cityResult = await this.validateCity(
            context.cityId,
            context.coordinates,
            options
        );
        if (!cityResult.isValid) return cityResult;

        // Phase 3: Restricted Zones Check
        if (options.checkRestrictedZones) {
            const zoneResult = await this.validateRestrictedZones(context.coordinates);
            if (!zoneResult.isValid) return zoneResult;
        }

        return { isValid: true };
    }

    /**
     * Validates country-level requirements
     * 
     * @private
     * @param {string} countryCode - ISO country code to validate
     * @returns {Promise<ValidationResult>} Country validation result
     */
    private async validateCountry(countryCode: string): Promise<ValidationResult> {
        try {
            const country = await this.geoRepository.getCountry(countryCode);

            if (!country) {
                return this.buildFailureResult(
                    ValidationReason.COUNTRY_NOT_FOUND, 
                    { countryCode }
                );
            }

            if (!country.isServiceable) {
                return this.buildFailureResult(
                    ValidationReason.COUNTRY_NOT_SERVICEABLE, 
                    { countryCode }
                );
            }

            return { isValid: true };
        } catch (error) {
            this.errorLogger.error('Country validation failed', error);
            return this.buildFailureResult(
                ValidationReason.SYSTEM_ERROR, 
                { countryCode }
            );
        }
    }

    /**
     * Validates city-level requirements
     * 
     * @private
     * @param {string} cityId - City identifier to validate
     * @param {LatLng} coordinates - Location coordinates
     * @param {NormalizedValidationOptions} options - Validation options
     * @returns {Promise<ValidationResult>} City validation result
     */
    private async validateCity(
        cityId: string,
        coordinates: LatLng,
        options: NormalizedValidationOptions
    ): Promise<ValidationResult> {
        try {
            const city = await this.geoRepository.getCity(cityId);

            if (!city) {
                return this.buildFailureResult(
                    ValidationReason.CITY_NOT_FOUND, 
                    { cityId }
                );
            }

            if (options.requireActiveCity && !city.isActive) {
                const alternatives = options.suggestAlternatives
                    ? await this.findServiceableAlternatives(coordinates, options.alternativeSearchRadiusKm)
                    : undefined;

                return this.buildFailureResult(
                    ValidationReason.CITY_INACTIVE,
                    { cityId, suggestedAlternatives: alternatives }
                );
            }

            return { isValid: true };
        } catch (error) {
            this.errorLogger.error('City validation failed', error);
            return this.buildFailureResult(
                ValidationReason.SYSTEM_ERROR, 
                { cityId }
            );
        }
    }

    /**
     * Validates location against restricted zones
     * 
     * @private
     * @param {LatLng} coordinates - Coordinates to validate
     * @returns {Promise<ValidationResult>} Zone validation result
     */
    private async validateRestrictedZones(coordinates: LatLng): Promise<ValidationResult> {
        try {
            const serviceability = await this.geoRepository.checkServiceability(coordinates);
            
            if (!serviceability.isServiceable && serviceability.restrictions?.length) {
                return this.buildFailureResult(
                    ValidationReason.RESTRICTED_AREA,
                    { restrictions: serviceability.restrictions }
                );
            }

            return { isValid: true };
        } catch (error) {
            this.errorLogger.warn('Restricted zone check failed', error);
            // Fail open - assume not restricted if verification fails
            return { isValid: true };
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Finds nearby serviceable cities as alternatives
     *
     * @private
     * @param {LatLng} center - Center point for search
     * @param {number} radiusKm - Search radius in kilometers
     * @returns {Promise<ValidationResult['metadata']['suggestedAlternatives']>} Array of alternatives
     */
    private async findServiceableAlternatives(
        center: LatLng,
        radiusKm: number
    ): Promise<ValidationResult['metadata']['suggestedAlternatives']> {
        try {
            const cities = await this.geoRepository.getCitiesWithinRadius(
                center,
                radiusKm,
                { onlyServiceable: true, limit: this.MAX_ALTERNATIVE_SUGGESTIONS }
            );

            return cities
                .map(city => ({
                    cityId: city.id,
                    name: city.name,
                    distanceKm: center.distanceTo(city.coordinates)
                }))
                .sort((a, b) => a.distanceKm - b.distanceKm);
        } catch (error) {
            this.errorLogger.warn('Alternative city search failed', error);
            return [];
        }
    }

    /**
     * Normalizes validation options with defaults
     *
     * @private
     * @param {object} options - Raw validation options
     * @returns {NormalizedValidationOptions} Normalized options
     */
    private normalizeOptions(options: {
        requireActiveCity?: boolean;
        checkRestrictedZones?: boolean;
        suggestAlternatives?: boolean;
        alternativeSearchRadiusKm?: number;
    }): NormalizedValidationOptions {
        return {
            requireActiveCity: options.requireActiveCity ?? true,
            checkRestrictedZones: options.checkRestrictedZones ?? true,
            suggestAlternatives: options.suggestAlternatives ?? true,
            alternativeSearchRadiusKm: options.alternativeSearchRadiusKm ?? this.DEFAULT_SEARCH_RADIUS_KM
        };
    }

    /**
     * Handles unexpected validation errors
     *
     * @private
     * @param {unknown} error - Caught error
     * @param {GeoContext} context - Original context
     * @returns {ValidationResult} Error result
     */
    private handleValidationError(error: unknown, context: GeoContext): ValidationResult {
        this.errorLogger.error('Geo validation failed unexpectedly', error, {
            cityId: context.cityId,
            countryCode: context.countryCode
        });

        return this.buildFailureResult(
            ValidationReason.SYSTEM_ERROR,
            {
                cityId: context.cityId,
                countryCode: context.countryCode
            }
        );
    }

    /**
     * Constructs a standardized failure result
     *
     * @private
     * @param {ValidationReason} reason - Failure reason
     * @param {ValidationResult['metadata']} [metadata] - Additional context
     * @returns {ValidationResult} Formatted failure result
     */
    private buildFailureResult(
        reason: ValidationReason,
        metadata?: ValidationResult['metadata']
    ): ValidationResult {
        this.errorLogger.warn(`Geo validation failed: ${reason}`, metadata);
        return {
            isValid: false,
            reason,
            metadata
        };
    }
}

/**
 * Normalized Validation Options
 *
 * @interface NormalizedValidationOptions
 * @property {boolean} requireActiveCity - Whether to check city active status
 * @property {boolean} checkRestrictedZones - Whether to verify restricted zones
 * @property {boolean} suggestAlternatives - Whether to suggest alternative cities
 * @property {number} alternativeSearchRadiusKm - Radius for alternative search
 */
interface NormalizedValidationOptions {
    requireActiveCity: boolean;
    checkRestrictedZones: boolean;
    suggestAlternatives: boolean;
    alternativeSearchRadiusKm: number;
}