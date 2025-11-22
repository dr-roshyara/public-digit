/**
 * IGeoRepository - Geographic data repository contract
 *
 * Provides standardized access to:
 * - Country/city data
 * - Reverse geocoding
 * - Serviceability checks
 * - Geographic searches
 *
 * @file src/app/core/geo/domain/ports/igeo.repository.ts
 */

import { Observable } from 'rxjs';
import { Country } from '../entities/country.entity';
import { City } from '../entities/city.entity';
import { LatLng } from '../value-objects/lat-lng.value-object';


/**
 * Geographic data repository interface
 *
 * Changes Made:
 * 1. Enhanced method documentation
 * 2. Added pagination/sorting options
 * 3. Improved error typing
 * 4. Added observable variants
 */
export interface IGeoRepository {
    // ==================== COUNTRY METHODS ====================

    /**
     * Retrieves country by ISO code
     * @param code Case-insensitive ISO 3166-1 alpha-2 code
     * @returns Promise resolving to Country or null if not found
     * @throws GeoRepositoryError on network/validation failures
     */
    getCountry(code: string): Promise<Country | null>;

    /**
     * Observable variant of getCountry
     */
    getCountry$(code: string): Observable<Country | null>;

    /**
     * Lists all available countries
     * @param options Filtering and pagination
     */
    listCountries(options?: {
        onlyServiceable?: boolean;
        page?: number;
        pageSize?: number;
        sortBy?: 'name' | 'code';
    }): Promise<Country[]>;

    // ==================== CITY METHODS ====================

    /**
     * Finds city by unique identifier
     * @param id City identifier (format implementation-specific)
     */
    getCity(id: string): Promise<City | null>;

    /**
     * Lists cities within a country
     * @param countryCode ISO country code filter
     * @param options Pagination and filtering
     */
    getCities(
        countryCode: string,
        options?: {
            onlyActive?: boolean;
            page?: number;
            pageSize?: number;
            searchTerm?: string;
        }
    ): Promise<City[]>;

    /**
     * Finds cities within geographic radius
     * @param center Center coordinates
     * @param radiusKm Search radius in kilometers
     * @param options Additional filters
     */
    getCitiesWithinRadius(
        center: LatLng,
        radiusKm: number,
        options?: {
            onlyServiceable?: boolean;
            limit?: number;
        }
    ): Promise<City[]>;

    // ==================== GEOCODING METHODS ====================

    /**
     * Converts coordinates to geographic context
     * @param coordinates Location to reverse geocode
     * @returns Detailed reverse geocode result
     * @throws GeoRepositoryError if geocoding fails
     */
    reverseGeocode(coordinates: LatLng): Promise<{
        city: City;
        country: Country;
        exactMatch: boolean;
        accuracy?: number;
    }>;

    /**
     * Checks location serviceability
     * @param coordinates Location to validate
     * @param options Validation parameters
     */
    checkServiceability(
        coordinates: LatLng,
        options?: {
            suggestAlternatives?: boolean;
            suggestionRadius?: number;
            requiredServices?: string[];
        }
    ): Promise<{
        isServiceable: boolean;
        matchedCity?: City;
        alternatives?: Array<{
            city: City;
            distanceKm: number;
        }>;
        restrictions?: string[];
    }>;
}

/**
 * Standardized repository error
 */
export class GeoRepositoryError extends Error {
    constructor(
        public readonly code:
            | 'NETWORK_ERROR'
            | 'NOT_FOUND'
            | 'INVALID_DATA'
            | 'SERVICE_UNAVAILABLE',
        public readonly context?: Record<string, unknown>,
        message?: string
    ) {
        super(message || `GeoRepository error: ${code}`);
        this.name = 'GeoRepositoryError';
        Object.setPrototypeOf(this, GeoRepositoryError.prototype);
    }

    /**
     * Determines if error is potentially recoverable
     */
    get isRecoverable(): boolean {
        return this.code !== 'INVALID_DATA';
    }
}

// ==================== USAGE EXAMPLES ====================
// // Repository implementation
// @Injectable()
// class HttpGeoRepository implements IGeoRepository {
//   async getCountry(code: string): Promise<Country | null> {
//     // Implementation
//   }
// }
//
// // Consumer usage
// constructor(private geoRepo: IGeoRepository) {}
//
// async function checkLocation(lat: number, lng: number) {
//   try {
//     const result = await this.geoRepo.reverseGeocode(new LatLng(lat, lng));
//     return result.city;
//   } catch (error) {
//     if (error instanceof GeoRepositoryError && error.isRecoverable) {
//       // Handle recoverable error
//     }
//   }
// }