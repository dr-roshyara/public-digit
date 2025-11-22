/**
 * GeoLocation Token - Dependency injection token for location services
 *
 * Provides:
 * - Centralized provider registration
 * - Default fallback implementation
 * - Type-safe dependency injection
 *
 * @file src/app/core/geo/domain/ports/geo-location.token.ts
 */

import { InjectionToken, Provider } from '@angular/core';
import { GeoLocationPort } from './geo-location.port';
import { FallbackGeoLocationAdapter } from '../../infrastructure/adapters/fallback-geo.adapter';

/**
 * Injection token for GeoLocationPort implementations
 *
 * Changes Made:
 * 1. Added complete documentation
 * 2. Included default factory
 * 3. Enhanced provider typing
 * 4. Added configuration options
 */
export const GEO_LOCATION_PORT = new InjectionToken<GeoLocationPort>(
  'GeoLocationPort',
  {
    providedIn: 'root',
    factory: () => new FallbackGeoLocationAdapter()
  }
);

/**
 * Helper function to create provider configurations
 *
 * @param implementation Concrete GeoLocationPort class
 * @param config Additional provider options
 */
export function provideGeoLocationPort(
  implementation: new (...args: any[]) => GeoLocationPort,
  config?: {
    isDefault?: boolean;
    dependencies?: any[];
  }
): Provider {
  return {
    provide: GEO_LOCATION_PORT,
    useClass: implementation,
    deps: config?.dependencies || [],
    multi: false
  };
}

/**
 * Type guard for GeoLocationPort tokens
 */
export function isGeoLocationToken(obj: any): obj is InjectionToken<GeoLocationPort> {
  return obj && obj._desc && obj._desc.includes('GeoLocationPort');
}

// ==================== USAGE EXAMPLES ====================
// // Provider registration
// @NgModule({
//   providers: [
//     provideGeoLocationPort(GPSLocationAdapter, {
//       isDefault: true,
//       dependencies: [Geolocation]
//     })
//   ]
// })
// export class GeoModule {}
//
// // Service consumption
// constructor(@Inject(GEO_LOCATION_PORT) private locationService: GeoLocationPort) {}
//
// // Token verification
// if (isGeoLocationToken(token)) {
//   // Handle token specific logic
// }