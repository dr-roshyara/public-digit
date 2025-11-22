/**
 * LatLng - Immutable Geographic Coordinate Value Object
 * 
 * Represents a validated WGS-84 geographic coordinate with:
 * - Strict coordinate validation (-90 ≤ lat ≤ 90, -180 ≤ lng ≤ 180)
 * - Accuracy metadata tracking
 * - Comprehensive geospatial operations
 * - Serialization/deserialization support
 * 
 * @file src/app/core/geo/domain/value-objects/lat-lng.value-object.ts
 */

import { InvalidCoordinatesError, GeoLocationError } from "../../shared/errors/domain.error";

/**
 * Serialized LatLng format
 * 
 * Design Principles:
 * - Flat structure for JSON compatibility
 * - Optional accuracy metadata
 * - Forward-compatible design
 */
export interface LatLngJSON {
    lat: number;
    lng: number;
    accuracy?: number;
}

export class LatLng {
    /**
     * Earth's mean radius in kilometers (WGS-84 ellipsoid approximation)
     * Used for spherical distance calculations
     */
    private static readonly EARTH_RADIUS_KM = 6371.0088;

    /**
     * Standard coordinate display precision
     */
    private static readonly DEFAULT_PRECISION = 6;

    /**
     * Creates a new validated LatLng instance
     * 
     * @param latitude Degrees between -90 and 90 (inclusive)
     * @param longitude Degrees between -180 and 180 (inclusive)
     * @param accuracy Optional accuracy radius in meters (must be ≥0)
     * 
     * @throws DomainError When:
     * - Coordinates are outside valid ranges
     * - Accuracy is negative
     */
    constructor(
        public readonly latitude: number,
        public readonly longitude: number,
        public readonly accuracy?: number
    ) {
        this.validateCoordinates(latitude, longitude);
        this.validateAccuracy(accuracy);
    }

    // ==================== VALIDATION METHODS ====================

    /**
     * Validates coordinate boundaries
     * @throws InvalidCoordinatesError with code INVALID_COORDINATES
     */
    private validateCoordinates(lat: number, lng: number): void {
        if (!LatLng.isValid(lat, lng)) {
            throw new InvalidCoordinatesError(
                `Invalid coordinates: lat=${lat}, lng=${lng}. Valid range: [-90 ≤ lat ≤ 90, -180 ≤ lng ≤ 180]`
            );
        }
    }

    /**
     * Validates accuracy value
     * @throws GeoLocationError with code INVALID_ACCURACY
     */
    private validateAccuracy(accuracy?: number): void {
        if (accuracy !== undefined && accuracy < 0) {
            throw new GeoLocationError(
                `Invalid accuracy: ${accuracy}. Must be positive value in meters`,
                'INVALID_ACCURACY'
            );
        }
    }

    // ==================== STATIC METHODS ====================

    /**
     * Validates WGS-84 coordinate boundaries
     * @returns True if coordinates are within valid ranges
     */
    static isValid(lat: number, lng: number): boolean {
        return lat >= -90 && lat <= 90 && 
               lng >= -180 && lng <= 180;
    }

    /**
     * Creates LatLng from serialized JSON
     * 
     * @throws DomainError with codes:
     * - INVALID_JSON_INPUT (malformed structure)
     * - INVALID_COORDINATES (out of bounds)
     * - INVALID_ACCURACY (negative value)
     */
    static fromJSON(data: LatLngJSON): LatLng {
        if (!LatLng.isLatLngJSON(data)) {
            throw new InvalidCoordinatesError(
                `Invalid JSON input for LatLng. Expected { lat: number, lng: number, accuracy?: number }, received: ${JSON.stringify(data)}`
            );
        }
        return new LatLng(data.lat, data.lng, data.accuracy);
    }

    /**
     * Type guard for JSON validation
     */
    static isLatLngJSON(data: unknown): data is LatLngJSON {
        return typeof data === 'object' && 
               data !== null &&
               'lat' in data && 
               'lng' in data &&
               typeof (data as any).lat === 'number' &&
               typeof (data as any).lng === 'number';
    }

    /**
     * Calculates geographic midpoint between coordinates
     * 
     * @param coordinates Array of LatLng points
     * @throws DomainError with code EMPTY_COORDINATES
     */
    static midpoint(coordinates: LatLng[]): LatLng {
        if (!coordinates?.length) {
            throw new InvalidCoordinatesError(
                'Cannot calculate midpoint of empty coordinates array'
            );
        }

        // Convert to cartesian coordinates and sum
        const sum = coordinates.reduce((acc, curr) => ({
            x: acc.x + Math.cos(curr.latitude * Math.PI / 180) * Math.cos(curr.longitude * Math.PI / 180),
            y: acc.y + Math.cos(curr.latitude * Math.PI / 180) * Math.sin(curr.longitude * Math.PI / 180),
            z: acc.z + Math.sin(curr.latitude * Math.PI / 180)
        }), { x: 0, y: 0, z: 0 });

        // Calculate averages
        const avg = {
            x: sum.x / coordinates.length,
            y: sum.y / coordinates.length,
            z: sum.z / coordinates.length
        };

        // Convert back to spherical coordinates
        const lng = Math.atan2(avg.y, avg.x) * 180 / Math.PI;
        const hyp = Math.sqrt(avg.x * avg.x + avg.y * avg.y);
        const lat = Math.atan2(avg.z, hyp) * 180 / Math.PI;

        return new LatLng(lat, lng);
    }

    // ==================== INSTANCE METHODS ====================

    /**
     * Calculates haversine distance to another point
     * 
     * @param other Target coordinate
     * @returns Distance in kilometers
     */
    distanceTo(other: LatLng): number {
        const φ1 = this.latitude * Math.PI / 180;
        const φ2 = other.latitude * Math.PI / 180;
        const Δφ = (other.latitude - this.latitude) * Math.PI / 180;
        const Δλ = (other.longitude - this.longitude) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        
        return LatLng.EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    /**
     * Serializes to JSON format
     */
    toJSON(): LatLngJSON {
        return {
            lat: this.latitude,
            lng: this.longitude,
            accuracy: this.accuracy
        };
    }

    /**
     * Standard string representation
     * @param precision Decimal places (default: 6)
     * @example "40.712800,-74.006000"
     */
    toString(precision: number = LatLng.DEFAULT_PRECISION): string {
        return `${this.latitude.toFixed(precision)},${this.longitude.toFixed(precision)}`;
    }

    /**
     * Compares coordinate equality
     * @param precision Decimal places to consider (default: 6)
     */
    equals(other: LatLng, precision: number = LatLng.DEFAULT_PRECISION): boolean {
        const factor = Math.pow(10, precision);
        return Math.round(this.latitude * factor) === Math.round(other.latitude * factor) &&
               Math.round(this.longitude * factor) === Math.round(other.longitude * factor);
    }

    /**
     * Checks if point is within bounding box
     * 
     * @param bounds Tuple of [southwest, northeast] coordinates
     */
    isWithinBounds(bounds: [LatLng, LatLng]): boolean {
        const [sw, ne] = bounds;
        return this.latitude >= Math.min(sw.latitude, ne.latitude) &&
               this.latitude <= Math.max(sw.latitude, ne.latitude) &&
               this.longitude >= Math.min(sw.longitude, ne.longitude) &&
               this.longitude <= Math.max(sw.longitude, ne.longitude);
    }

    /**
     * Creates new instance with updated accuracy
     */
    withAccuracy(accuracy: number): LatLng {
        return new LatLng(this.latitude, this.longitude, accuracy);
    }

    /**
     * Calculates initial bearing to another point
     * @returns Bearing in degrees (0-360, clockwise from north)
     */
    bearingTo(other: LatLng): number {
        const φ1 = this.latitude * Math.PI/180;
        const φ2 = other.latitude * Math.PI/180;
        const Δλ = (other.longitude - this.longitude) * Math.PI/180;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1)*Math.sin(φ2) - 
                  Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
        return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
    }
}

// ==================== USAGE EXAMPLES ==================== //
/*
// 1. Basic creation
const nyc = new LatLng(40.7128, -74.0060, 50);

// 2. Serialization
const json = nyc.toJSON();
const restored = LatLng.fromJSON(json);

// 3. Distance calculation
const london = new LatLng(51.5074, -0.1278);
const distance = nyc.distanceTo(london); // km

// 4. Bearing calculation
const bearing = nyc.bearingTo(london); // degrees

// 5. Boundary check
const bounds: [LatLng, LatLng] = [
  new LatLng(40.5, -74.5),
  new LatLng(41.0, -73.5)
];
const inBounds = nyc.isWithinBounds(bounds);
*/