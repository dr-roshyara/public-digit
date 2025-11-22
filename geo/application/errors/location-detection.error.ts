/**
 * Standardized error handling for location detection failures.
 * Provides machine-readable codes for error recovery and analytics.
 *
 * Key Features:
 * - Source tracking (GPS/IP/Manual)
 * - Recoverability flag
 * - Structured metadata
 *
 * @file core/domain/errors/location-detection.error.ts
 */

import { GeoSourceType } from '../../domain/constants/geo-source.constants';

/**
 * Represents failures in location detection pipeline
 *
 * Changes Made:
 * 1. Added complete JSDoc documentation
 * 2. Implemented proper error prototype chain
 * 3. Enforced readonly properties
 * 4. Added detailed error code documentation
 */
export class LocationDetectionError extends Error {
  /**
   * @param source Detection method that failed (GPS/IP/Manual)
   * @param code Standardized error classification
   * @param metadata Additional troubleshooting context
   */
  constructor(
    public readonly source: GeoSourceType,
    public readonly code:
      | 'PERMISSION_DENIED'   // User denied location access
      | 'TIMEOUT'             // Detection operation timed out
      | 'NETWORK_ERROR'       // Connectivity issues
      | 'UNAVAILABLE',        // Feature not supported
    public readonly metadata?: Record<string, unknown>
  ) {
    super(`[${source}] Location detection failed (${code})`);
    this.name = 'LocationDetectionError';

    // Maintains proper stack trace and prototype chain
    Object.setPrototypeOf(this, LocationDetectionError.prototype);
  }

  /**
   * Determines if error is potentially recoverable
   *
   * Non-recoverable cases:
   * - Permanent permission denial
   * - Hardware/API unavailability
   */
  get isRecoverable(): boolean {
    return !['PERMISSION_DENIED', 'UNAVAILABLE'].includes(this.code);
  }
}

// ==================== USAGE EXAMPLES ====================
// throw new LocationDetectionError('gps', 'PERMISSION_DENIED', {
//   requestedAccuracy: 'high',
//   retryCount: 3
// });
//
// try { ... }
// catch (err) {
//   if (err instanceof LocationDetectionError && err.isRecoverable) {
//     // Implement retry logic
//   }
// }