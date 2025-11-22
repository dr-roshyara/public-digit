/**
 * WiFi Services Dependency Injection Tokens
 *
 * Provides centralized DI management for:
 * - WiFi scanning capabilities
 * - WiFi-based positioning services
 * - Mock implementations for testing
 *
 * @file src/app/core/geo/domain/ports/wifi-scanner.token.ts
 */

import { InjectionToken } from '@angular/core';
import { IWifiScanner } from './iwifi-scanner.port';
import { IWifiPositioningService } from './iwifi-positioning.port';

/**
 * Primary injection token for WiFi scanning implementations
 *
 * Features:
 * - Platform-agnostic interface
 * - Multiple implementation support
 * - Permission state management
 *
 * @constant {InjectionToken<IWifiScanner>}
 *
 * @example
 * providers: [
 *   { provide: WIFI_SCANNER, useClass: CordovaWifiScanner }
 * ]
 */
export const WIFI_SCANNER = new InjectionToken<IWifiScanner>('WifiScanner');

/**
 * Injection token for WiFi positioning services
 *
 * Supports:
 * - Multiple positioning strategies
 * - Accuracy-based service selection
 * - Fallback mechanisms
 *
 * @constant {InjectionToken<IWifiPositioningService>}
 *
 * @example
 * providers: [
 *   { provide: WIFI_POSITIONING, useClass: BasicWifiPositioning, multi: true },
 *   { provide: WIFI_POSITIONING, useClass: AdvancedWifiPositioning, multi: true }
 * ]
 */
export const WIFI_POSITIONING = new InjectionToken<IWifiPositioningService>(
  'WifiPositioningService',
  { providedIn: 'root', factory: () => new DefaultWifiPositioning() }
);

/**
 * Default fallback implementation that throws when used
 */
class DefaultWifiPositioning implements IWifiPositioningService {
  readonly accuracy = Infinity;
  readonly method = 'none';

  async estimatePosition(): Promise<never> {
    throw new Error('No WiFi positioning provider configured');
  }
}

/**
 * Provider configuration utilities
 */
export class WifiProviders {
  /**
   * Creates a complete provider configuration for WiFi services
   *
   * @param scannerImpl Concrete scanner implementation
   * @param positioningImpls Array of positioning strategies
   * @returns Complete provider array
   *
   * @example
   * WifiProviders.create(
   *   CordovaWifiScanner,
   *   [BasicWifiPositioning, AdvancedWifiPositioning]
   * )
   */
  static create(
    scannerImpl: new (...args: any[]) => IWifiScanner,
    positioningImpls: Array<new (...args: any[]) => IWifiPositioningService>,
    dependencies: any[] = []
  ): any[] {
    return [
      { provide: WIFI_SCANNER, useClass: scannerImpl, deps: dependencies },
      ...positioningImpls.map(impl => ({
        provide: WIFI_POSITIONING,
        useClass: impl,
        multi: true,
        deps: dependencies
      }))
    ];
  }
}

// -------------------- IMPLEMENTATION GUIDE -------------------- //
/*
// 1. Module Registration
@NgModule({
  providers: WifiProviders.create(
    CordovaWifiScanner,
    [BasicWifiPositioning, AdvancedWifiPositioning],
    [Platform, HttpClient]
  )
})
export class WifiModule {}

// 2. Service Consumption
constructor(
  @Inject(WIFI_SCANNER) private scanner: IWifiScanner,
  @Inject(WIFI_POSITIONING) private positioningServices: IWifiPositioningService[]
) {
  // Services are sorted by accuracy (best first)
  this.positioningServices.sort((a,b) => a.accuracy - b.accuracy);
}

// 3. Runtime Selection Example
async locateDevice() {
  const accessPoints = await this.scanner.scan();

  for (const service of this.positioningServices) {
    try {
      return await service.estimatePosition(accessPoints);
    } catch (error) {
      console.warn(`${service.method} failed: ${error.message}`);
    }
  }
  throw new Error('All positioning methods failed');
}
*/