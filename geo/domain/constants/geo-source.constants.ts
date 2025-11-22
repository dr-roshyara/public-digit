/**
 * GeoSource Constants - Centralized definition of all location detection sources
 *
 * Provides:
 * - Source type definitions
 * - Accuracy metadata
 * - UI presentation values
 * - Validation utilities
 *
 * @file src/app/core/geo/domain/constants/geo-source.constants.ts
 */

/**
 * Enum-like constant of all possible geolocation sources
 *
 * Changes Made:
 * 1. Added complete documentation
 * 2. Included accuracy estimates
 * 3. Added display metadata
 * 4. Implemented validation helpers
 */
export const GeoSource = {
  /** High-accuracy GPS sensors (mobile devices) */
  GPS: 'gps',

  /** IP-based geolocation (network approximation) */
  IP: 'ip',

  /** Explicit user selection */
  MANUAL: 'manual',

  /** System default/fallback location */
  FALLBACK: 'fallback',

  /** Automated WiFi positioning */
  WIFI: 'wifi',

  /** Cell tower triangulation */
  CELL: 'cell'
} as const;

export type GeoSourceType = typeof GeoSource[keyof typeof GeoSource];
//export type GeoSource = typeof GeoSource[keyof typeof GeoSource];

export interface GeoAccuracyRange {
  min: number; // meters
  max: number; //meters 
  confidence?: number; // Add confidence level (0-1 scale)
}


/**
 * Estimated accuracy ranges (in meters) for each source
 * Values represent 68% confidence radius (1 standard deviation)
 */
export const GeoSourceAccuracy: Record<GeoSourceType, GeoAccuracyRange> = {
//export const GeoSourceAccuracy: Record<GeoSourceType, { min: number; max: number }> = {
  [GeoSource.GPS]: { min: 5, max: 100, confidence:0.68 },        // 5-100m accuracy
  [GeoSource.IP]: { min: 1000, max: 50000,confidence:0.5 },    // 1-50km accuracy
  [GeoSource.MANUAL]: { min: 200, max: 2000,confidence:0.9 },  // 0.2-2km accuracy
  [GeoSource.FALLBACK]: { min: 10000, max: Number.POSITIVE_INFINITY },
  [GeoSource.WIFI]: { min: 50, max: 500,confidence:0.7 },      // 50-500m accuracy
  [GeoSource.CELL]: { min: 500, max: 5000,confidence:0.6 }     // 0.5-5km accuracy
};

/**
 * User-friendly display names for each source
 */
export const GeoSourceNames: Record<GeoSourceType, string> = {
  [GeoSource.GPS]: 'GPS Location',
  [GeoSource.IP]: 'Network Estimate',
  [GeoSource.MANUAL]: 'Manual Selection',
  [GeoSource.FALLBACK]: 'Default Location',
  [GeoSource.WIFI]: 'WiFi Positioning',
  [GeoSource.CELL]: 'Cell Tower Triangulation'
};

/**
 * Material Icon names for each source
 */
export const GeoSourceIcons: Record<GeoSourceType, string> = {
  [GeoSource.GPS]: 'location_searching',
  [GeoSource.IP]: 'public',
  [GeoSource.MANUAL]: 'edit_location',
  [GeoSource.FALLBACK]: 'error_outline',
  [GeoSource.WIFI]: 'wifi',
  [GeoSource.CELL]: 'signal_cellular_alt'
};

/**
 * Relative priority when combining multiple sources
 * Higher = more trustworthy
 */
export const GeoSourceWeight: Record<GeoSourceType, number> = {
  [GeoSource.GPS]: 100,
  [GeoSource.MANUAL]: 90,
  [GeoSource.WIFI]: 70,
  [GeoSource.CELL]: 50,
  [GeoSource.IP]: 30,
  [GeoSource.FALLBACK]: 10
};


/**
 * Determines if a source is considered user-verified
 * (Higher trust level for GPS and manual selections)
 */
export function isUserVerified(source: GeoSourceType): boolean {
  return source === GeoSource.GPS || source === GeoSource.MANUAL;
}

/**
 * Gets the appropriate display icon for a source
 */
export function getSourceIcon(source: GeoSourceType): string {
  return GeoSourceIcons[source] ?? 'location_disabled';
}

/**
 * Validates if a source string is a known GeoSource
 */
export function isValidGeoSource(source: string): source is GeoSourceType {
  return typeof source === 'string' && 
         Object.values(GeoSource).includes(source as GeoSourceType);
}

export function validateGeoAccuracy(range: GeoAccuracyRange): boolean {
  return range.confidence === undefined || 
         (range.confidence >= 0 && range.confidence <= 1);
}

// ==================== USAGE EXAMPLES ====================
// // Type-safe source handling
// function logSource(source: GeoSourceType) {
//   console.log(`${GeoSourceNames[source]} (${getSourceIcon(source)})`);
// }
//
// // Accuracy estimation
// const accuracy = GeoSourceAccuracy[GeoSource.GPS].max;
//
// // Source validation
// if (isValidGeoSource(inputSource)) {
//   // Safe to use as GeoSourceType
// }

