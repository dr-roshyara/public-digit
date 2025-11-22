/**
 * GeoLocationModule - Angular feature module for geographic location services
 *
 * Configures:
 * - Dependency injection hierarchy
 * - Strategy implementations
 * - Repository providers
 * - Cross-component integration
 *
 * @file app/core/geo/geo-location.module.ts
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

// Application
import { GeoCacheService } from './application/services/geo-cache.service';
import { GeoLocationFacade } from './application/facades/geo-location.facade';
import { HybridGeoLocationService } from './application/services/hybrid-geo-location.service';

// Domain
import { IGeoRepository } from './domain/ports/igeo.repository';
import { GEO_LOCATION_PORT } from './domain/ports/geo-location.port';
import { GeoValidator } from './domain/services/geo.validator';

// Infrastructure
import { HttpGeoRepository } from './infrastructure/repositories/http-geo.repository';
import { BrowserGeoLocationAdapter } from './infrastructure/adapters/browser-geo.adapter';
import { IpwhoisGeoLocationAdapter } from './infrastructure/adapters/ipwhois-geo-location.adapter';
import { WifiContextBuilderService } from './infrastructure/adapters/wifi-context-builder.service';
import { WifiPositioningService } from './infrastructure/adapters/wifi-positioning.service';
import { ManualDetectionStrategy } from './infrastructure/adapters/manual-detection.strategy';

@NgModule({
  imports: [CommonModule, HttpClientModule],
  providers: [
    // Domain logic
    GeoValidator,
    GeoCacheService,
    { provide: IGeoRepository, useClass: HttpGeoRepository },

    // Strategy Adapters
    BrowserGeoLocationAdapter,
    IpwhoisGeoLocationAdapter,
    WifiPositioningService,
    WifiContextBuilderService,
    ManualDetectionStrategy,

    // Detection Orchestration
    HybridGeoLocationService,

    // Public API
    GeoLocationFacade,
    { provide: GEO_LOCATION_PORT, useExisting: GeoLocationFacade }
  ]
})
export class GeoLocationModule {}

// =======================================
// application/facade/geo-location.facade.ts (Reactive facade using hybrid strategy)
// =======================================
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HybridGeoLocationService } from '../services/hybrid-geo-location.service';
import { Location } from '../../domain/entities/location.value-object';

@Injectable({ providedIn: 'root' })
export class GeoLocationFacade {
  private readonly location$ = new BehaviorSubject<Location | null>(null);

  constructor(private readonly hybrid: HybridGeoLocationService) {}

  get geoLocation$(): Observable<Location | null> {
    return this.location$.asObservable();
  }

  async initGeoLocation(): Promise<void> {
    const detected = await this.hybrid.detect();
    this.location$.next(detected);
  }

  getCurrentLocationSync(): Location | null {
    return this.location$.value;
  }
}

// ==================== USAGE EXAMPLES ====================
// // Basic module import
// @NgModule({
//   imports: [GeoLocationModule]
// })
// export class AppModule {}
//
// // Configured module import
// @NgModule({
//   imports: [GeoLocationModule],
//   providers: [
//     ...configureGeoModule({
//       defaultStrategy: 'ip',
//       cacheTtl: 3600000 // 1 hour
//     })
//   ]
// })
// export class AppModule {}