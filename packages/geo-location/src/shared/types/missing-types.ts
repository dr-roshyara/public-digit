/**
 * Missing Type Definitions
 * Temporary file for types that are referenced but not yet fully implemented
 *
 * @file shared/types/missing-types.ts
 */

import { GeoLocationError } from '../errors/domain.error';

/**
 * Location Detection Error
 * Used by WiFi and hybrid detection services
 */
export class LocationDetectionError extends GeoLocationError {
  constructor(message: string, code: string = 'LOCATION_DETECTION_ERROR') {
    super(message, code);
    this.name = 'LocationDetectionError';
  }
}

/**
 * GeoContext Cache Interface
 * Temporary definition for cache-related operations
 */
export interface GeoContextCache {
  cityId: string;
  countryCode: string;
  coordinates: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  source: string;
  timestamp: string;
  isServiceable?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Type guard for GeoContextCache
 */
export function isGeoContextCache(obj: unknown): obj is GeoContextCache {
  if (typeof obj !== 'object' || obj === null) return false;
  const cache = obj as any;
  return (
    typeof cache.cityId === 'string' &&
    typeof cache.countryCode === 'string' &&
    typeof cache.coordinates === 'object' &&
    typeof cache.source === 'string' &&
    typeof cache.timestamp === 'string'
  );
}
