// src/app/core/geo/domain/interfaces/geo-context-cache.interface.ts

import { GeoSourceType } from '../constants/geo-source.constants';

/**
 * Serialized format for GeoContext persistence
 * 
 * Design Notes:
 * - Optimized for storage (flat structure)
 * - Uses primitive types for serialization
 * - Maintains all essential context metadata
 */
export interface GeoContextCache {
  cityId: string;
  countryCode: string;
  coordinates: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  source: GeoSourceType;
  timestamp: string; // ISO 8601 format
}