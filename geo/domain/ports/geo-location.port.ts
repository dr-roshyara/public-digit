/**
 * GeoLocation Port - Core abstraction layer for location detection services
 * 
 * Defines the standard interface for:
 * - GPS-based detection
 * - IP geolocation
 * - Manual selection
 * - Hybrid implementations
 * 
 * @file core/domain/ports/geo-location.port.ts
 */

import { Observable } from 'rxjs';
import { GeoContext } from '../aggregates/geo-context.model';
import { GeoSourceType } from '../constants/geo-source.constants';

/**
 * Contract for geographic location providers
 * 
 * Changes Made:
 * 1. Enhanced method documentation
 * 2. Added configuration options
 * 3. Strict return type handling
 * 4. Improved error semantics
 */
export interface GeoLocationPort {
  /**
   * Attempts to determine current geographic context
   * 
   * @param options Configuration for detection:
   *   - `timeout`: Maximum attempt duration in ms
   *   - `enableHighAccuracy`: Precision preference
   *   - `cachePolicy`: Freshness requirements
   * 
   * @returns Observable that emits:
   *   - GeoContext: Successful detection
   *   - null: Graceful failure
   *   - Error: LocationDetectionError for operational failures
   */
  fetchGeoContext(options?: {
    timeout?: number;
    enableHighAccuracy?: boolean;
    cachePolicy?: 'fresh' | 'cached' | 'any';
  }): Observable<GeoContext | null>;

  /**
   * Verifies detection capability
   * 
   * Checks:
   * - Hardware/API availability
   * - Required permissions
   * - Network connectivity
   * 
   * @returns Promise resolving to boolean indicating operational status
   */
  isAvailable(): Promise<boolean>;

  /**
   * Source metadata for analytics and quality assessment
   */
  readonly source: GeoSourceType;

  /**
   * Typical accuracy range in meters
   * (68% confidence radius)
   */
  readonly accuracy: number;

  /**
   * Whether detection requires user interaction
   */
  readonly requiresUserInteraction: boolean;
}

/**
 * Type guard for GeoLocationPort implementations
 */
export function isGeoLocationPort(obj: any): obj is GeoLocationPort {
  return obj && 
         typeof obj.fetchGeoContext === 'function' && 
         typeof obj.isAvailable === 'function';
}

// ==================== USAGE EXAMPLES ====================
// // Adapter implementation
// @Injectable()
// class GPSLocationAdapter implements GeoLocationPort {
//   readonly source = GeoSource.GPS;
//   readonly accuracy = 50;
//   readonly requiresUserInteraction = false;
//
//   fetchGeoContext(options?: { timeout?: number }): Observable<GeoContext | null> {
//     // Implementation
//   }
//
//   isAvailable(): Promise<boolean> {
//     // Check permissions and hardware
//   }
// }
//
// // Consumer usage
// constructor(private locationService: GeoLocationPort) {}
//
// this.locationService.fetchGeoContext({
//   timeout: 10000,
//   enableHighAccuracy: true
// }).subscribe(context => {
//   if (context) {
//     // Handle successful detection
//   }
// });