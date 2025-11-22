/**
 * GeoLocation - Enhanced geographic location value object
 * 
 * Extends basic LatLng coordinates with:
 * - Timestamp information
 * - Source attribution
 * - Additional metadata
 * - Serialization capabilities
 * 
 * @file src/app/core/geo/domain/value-objects/location.value-object.ts
 */

import { LatLng, LatLngJSON } from './lat-lng.value-object';
import { GeoSource, GeoSourceType } from '../constants/geo-source.constants';
import { DomainError } from 'src/app/shared/errors/domain.error' ;


/**
 * Serialized Location format
 * 
 * Design Principles:
 * - Forward-compatible structure
 * - Precise timestamp encoding
 * - Optional accuracy metadata
 */
export interface LocationJSON extends LatLngJSON {
  timestamp: string; // ISO 8601 UTC
  source: GeoSourceType;
  accuracy?: number;
  metadata?: {
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
}

export class GeoLocation {
    /**
     * Creates a new GeoLocation instance
     * 
     * @param coordinates Base LatLng coordinates
     * @param timestamp When the location was recorded
     * @param source How the location was obtained
     * @param metadata Additional location data
     */
    constructor(
        public readonly coordinates: LatLng,
        public readonly timestamp: Date = new Date(),
        public readonly source: GeoSourceType = GeoSource.IP,
        public readonly metadata: {
            altitude?: number | null;
            altitudeAccuracy?: number | null;
            heading?: number | null;
            speed?: number | null;
        } = {}
    ) {}

    // ==================== PROPERTIES ====================
    get latitude(): number {
        return this.coordinates.latitude;
    }

    get longitude(): number {
        return this.coordinates.longitude;
    }

    get accuracy(): number | undefined {
        return this.coordinates.accuracy;
    }

    // ==================== STATIC METHODS ====================
    /**
     * Creates from serialized JSON
     * @throws DomainError for invalid input
     */
    static fromJSON(data: GeoLocationJSON): GeoLocation {
        return new GeoLocation(
            LatLng.fromJSON(data),
            new Date(data.timestamp),
            data.source as GeoSourceType,
            {
                altitude: data.altitude,
                altitudeAccuracy: data.altitudeAccuracy,
                heading: data.heading,
                speed: data.speed
            }
        );
    }

    
    /**
     * Creates from Geolocation API Position
     */
    static fromGeolocationPosition(position: GeolocationPosition, source: GeoSourceType): GeoLocation {
        const { coords } = position;
        return new GeoLocation(
            new LatLng(coords.latitude, coords.longitude, coords.accuracy),
            new Date(position.timestamp),
            source,
            {
                altitude: coords.altitude,
                altitudeAccuracy: coords.altitudeAccuracy,
                heading: coords.heading,
                speed: coords.speed
            }
        );
    }
    

    // ==================== INSTANCE METHODS ====================
    /**
     * Serializes to JSON-friendly format
     */
    toJSON(): GeoLocationJSON {
        return {
            ...this.coordinates.toJSON(),
            timestamp: this.timestamp.toISOString(),
            source: this.source,
            altitude: this.metadata.altitude ?? undefined,
            altitudeAccuracy: this.metadata.altitudeAccuracy ?? undefined,
            heading: this.metadata.heading ?? undefined,
            speed: this.metadata.speed ?? undefined
        };
    }

    /**
     * Calculates distance to another location (in meters)
     */
    distanceTo(other: GeoLocation): number {
        return this.coordinates.distanceTo(other.coordinates) * 1000;
    }

    /**
     * Checks if location is recent (within specified time)
     * @param maxAge Maximum age in milliseconds
     */
    isRecent(maxAge: number): boolean {
        return Date.now() - this.timestamp.getTime() <= maxAge;
    }

    /**
     * Checks if location is accurate enough
     * @param maxError Maximum allowed accuracy in meters
     */
    isAccurate(maxError: number): boolean {
        return this.accuracy ? this.accuracy <= maxError : false;
    }

    /**
     * Returns simplified LatLng representation
     */
    toLatLng(): LatLng {
        return this.coordinates;
    }
}

// ==================== USAGE EXAMPLES ==================== //
/*
// 1. Creation from raw coordinates
const location = new GeoLocation(
    new LatLng(40.7128, -74.0060, 25),
    new Date(),
    GeoSource.GPS
);

// 2. Creation from Geolocation API
navigator.geolocation.getCurrentPosition(position => {
    const geoLoc = GeoLocation.fromGeolocationPosition(position, GeoSource.GPS);
});

// 3. Serialization/deserialization
const json = location.toJSON();
const restored = GeoLocation.fromJSON(json);

// 4. Distance calculation
const distance = location1.distanceTo(location2);

// 5. Validation checks
if (location.isRecent(30000) && location.isAccurate(50)) {
    // Use location
}
*/