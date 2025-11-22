/**
 * GeoLocation Configuration - Dependency Injection Setup
 * 
 * Provides:
 * - Centralized DI token declaration
 * - Default provider configuration
 * - Type-safe injection patterns
 * 
 * @file src/app/core/geo/geo-location.config.ts
 */

import { InjectionToken } from '@angular/core';
import { GeoLocationPort } from './domain/ports/geo-location.port';
import { IpwhoisGeoLocationAdapter } from './infrastructure/adapters/ipwhois-geo-location.adapters';
import { FallbackGeoLocationAdapter } from './infrastructure/adapters/fallback-geo.adapter';
 
/**
 * Primary injection token for location services
 * 
 * Features:
 * - Root-level provision
 * - Fallback implementation
 * - Type-safe consumption
 */
export const GEO_LOCATION_PORT = new InjectionToken<GeoLocationPort>(
  'GeoLocationPort',
  {
    providedIn: 'root',
    factory: () => new FallbackGeoLocationAdapter()
  }
);

/**
 * Default provider configuration for production
 */
export const GEO_LOCATION_PROVIDERS = [
  { provide: GEO_LOCATION_PORT, useClass: IpwhoisGeoLocationAdapter }
];

/**
 * Development provider configuration
 */
export const GEO_LOCATION_PROVIDERS_DEV = [
  { provide: GEO_LOCATION_PORT, useClass: IpwhoisGeoLocationAdapter }
  // Add mock providers if needed
];

/**
 * Provider factory for environment-specific configuration
 */
export function getGeoLocationProviders() {
  return process.env.NODE_ENV === 'production'
    ? GEO_LOCATION_PROVIDERS
    : GEO_LOCATION_PROVIDERS_DEV;
}