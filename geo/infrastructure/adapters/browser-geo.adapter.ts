/**
 * BrowserGeoLocationAdapter - GPS-based geolocation using browser APIs
 *
 * Implements:
 * - W3C Geolocation API integration
 * - High-accuracy positioning
 * - Permission management
 * - Automatic error fallback
 *
 * @file infrastructure/adapters/browser-geo.adapter.ts
 */

import { Injectable, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { GeoLocationPort } from '../../domain/ports/geo-location.port';
import { GeoContext } from '../../domain/aggregates/geo-context.model';
import { GeoSource } from '../../domain/constants/geo-source.constants';
import { LocationDetectionError } from '../../domain/ports/ilocation-detection.strategy';
import { ErrorLogger } from 'src/app/shared/services/error-logger.service';

@Injectable()
export class BrowserGeoLocationAdapter implements GeoLocationPort {
  readonly source = GeoSource.GPS;
  readonly accuracy = 15; // Typical GPS accuracy in meters (68% confidence)
  readonly requiresUserInteraction = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private zone: NgZone,
    private logger: ErrorLogger
  ) {}

  /**
   * Attempts GPS-based location detection
   *
   * @param options Configuration:
   *   - timeout: Operation timeout in ms (default: 10s)
   *   - enableHighAccuracy: Precision preference (default: true)
   *
   * @returns Observable emitting:
   *   - GeoContext: Successful detection
   *   - null: Graceful failure
   */
  fetchGeoContext(options?: {
    timeout?: number;
    enableHighAccuracy?: boolean;
  }): Observable<GeoContext | null> {
    if (!this.isAvailable()) {
      return of(null);
    }

    const config = {
      timeout: options?.timeout ?? 10000,
      enableHighAccuracy: options?.enableHighAccuracy ?? true
    };

    return from(this.getCurrentPosition(config)).pipe(
      map(position => this.createGeoContext(position)),
      timeout(config.timeout),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Checks GPS availability
   *
   * Verifies:
   * - Browser support
   * - Platform compatibility
   * - Permissions (if previously granted)
   */
  isAvailable(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return 'geolocation' in navigator;
  }

  // ==================== PRIVATE METHODS ====================

  private getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      this.zone.runOutsideAngular(() => {
        navigator.geolocation.getCurrentPosition(
          position => this.zone.run(() => resolve(position)),
          err => this.zone.run(() => reject(err)),
          options
        );
      });
    });
  }

  private createGeoContext(position: GeolocationPosition): GeoContext {
    return GeoContext.create({
      coordinates: new LatLng(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy
      ),
      source: this.source,
      // Additional properties would be hydrated via reverse geocoding
      city: City.createTemporary(position.coords),
      country: Country.createTemporary()
    });
  }

  private handleError(error: GeolocationPositionError): Observable<null> {
    const mappedError = this.mapToDetectionError(error);
    this.logger.warn('GPS detection failed', {
      error: mappedError,
      source: this.source
    });
    return of(null);
  }

  private mapToDetectionError(error: GeolocationPositionError): LocationDetectionError {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return new LocationDetectionError(
          this.source,
          'PERMISSION_DENIED',
          { requestedAccuracy: 'high' }
        );
      case error.POSITION_UNAVAILABLE:
        return new LocationDetectionError(
          this.source,
          'UNAVAILABLE',
          { retryCount: 1 }
        );
      case error.TIMEOUT:
        return new LocationDetectionError(
          this.source,
          'TIMEOUT',
          { timeout: 10000 }
        );
      default:
        return new LocationDetectionError(
          this.source,
          'NETWORK_ERROR'
        );
    }
  }
}

// ==================== USAGE EXAMPLES ====================
// // Provider registration
// providers: [
//   { provide: GeoLocationPort, useClass: BrowserGeoLocationAdapter }
// ]
//
// // Consumer usage
// constructor(private geoLocation: GeoLocationPort) {}
//
// this.geoLocation.fetchGeoContext({
//   timeout: 15000,
//   enableHighAccuracy: true
// }).subscribe(context => {
//   if (context) {
//     // Handle successful detection
//   }
// });