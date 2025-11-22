import { Injectable } from '@angular/core';
import { IWifiScanner } from '../../../domain/ports/iwifi-scanner.port';
import { IWifiPositioningService } from '../../../domain/ports/iwifi-positioning.port';
import { GeoContext } from '../../../domain/aggregates/geo-context.model';
import { WifiAccessPoint } from '../../../domain/entities/wifi-access-point.entity';
import { ErrorLogger } from '../../shared/services/error-logger.service';

/**
 * Orchestrates WiFi-based location context creation with:
 *
 * - Automatic positioning method selection
 * - Signal strength validation
 * - Error recovery and fallbacks
 * - Detailed analytics logging
 *
 * Consumes:
 * - IWifiScanner (platform-specific)
 * - IWifiPositioningService (algorithm-specific)
 */
@Injectable({ providedIn: 'root' })
export class WifiContextBuilderService {
  private readonly MIN_APS_FOR_TRIANGULATION = 3;
  private readonly MIN_SIGNAL_STRENGTH = -85; // dBm

  constructor(
    private scanner: IWifiScanner,
    private basicPositioning: IWifiPositioningService,
    private advancedPositioning: IWifiPositioningService,
    private logger: ErrorLogger
  ) {}

  /**
   * Builds GeoContext from available WiFi signals
   *
   * @param options Configuration:
   *   - requireStrongSignals: Filter weak APs (default: true)
   *   - timeoutMs: Operation timeout (default: 5000ms)
   *
   * @throws LocationDetectionError with codes:
   *   - 'insufficient-aps'
   *   - 'weak-signals'
   *   - 'positioning-failed'
   */
  async buildFromWifi(options?: {
    requireStrongSignals?: boolean;
    timeoutMs?: number;
  }): Promise<GeoContext> {
    const config = {
      requireStrongSignals: true,
      timeoutMs: 5000,
      ...options
    };

    try {
      const accessPoints = await this.scanAndFilter(config);
      return await this.estimatePosition(accessPoints, config.timeoutMs);
    } catch (error) {
      this.logDetectionError(error);
      throw error;
    }
  }

  private async scanAndFilter(config: {
    requireStrongSignals: boolean;
  }): Promise<WifiAccessPoint[]> {
    const accessPoints = await this.scanner.scan();

    if (accessPoints.length === 0) {
      throw new LocationDetectionError('wifi', 'insufficient-aps');
    }

    const filtered = config.requireStrongSignals
      ? accessPoints.filter(ap => ap.signal.strength >= this.MIN_SIGNAL_STRENGTH)
      : accessPoints;

    if (filtered.length < this.MIN_APS_FOR_TRIANGULATION - 1) {
      throw new LocationDetectionError('wifi', 'weak-signals', {
        totalAps: accessPoints.length,
        strongAps: filtered.length
      });
    }

    return filtered;
  }

  private async estimatePosition(
    accessPoints: WifiAccessPoint[],
    timeoutMs: number
  ): Promise<GeoContext> {
    const useAdvanced = accessPoints.length >= this.MIN_APS_FOR_TRIANGULATION;
    const service = useAdvanced ? this.advancedPositioning : this.basicPositioning;

    try {
      return await this.withTimeout(
        service.estimatePosition(accessPoints),
        timeoutMs
      );
    } catch (error) {
      throw new LocationDetectionError(
        'wifi',
        'positioning-failed',
        {
          method: useAdvanced ? 'triangulation' : 'basic',
          error: error.message
        }
      );
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), ms)
      )
    ]);
  }

  private logDetectionError(error: any): void {
    this.logger.error('WiFi context building failed', {
      error,
      severity: error instanceof LocationDetectionError &&
                error.code === 'weak-signals' ? 'warning' : 'error'
    });
  }
}

/**
 * Example Usage:
 *
 * 1. Basic usage:
 *
 * try {
 *   const context = await wifiBuilder.buildFromWifi();
 *   this.mapService.centerOn(context.coordinates);
 * } catch (error) {
 *   if (error.code === 'weak-signals') {
 *     this.showToast('Weak WiFi signals detected. Move closer to access points.');
 *   }
 * }
 *
 * 2. With custom options:
 *
 * await wifiBuilder.buildFromWifi({
 *   requireStrongSignals: false, // Include weak APs
 *   timeoutMs: 10000 // Longer timeout
 * });
 *
 * 3. Integration with state management:
 *
 * this.store.dispatch(new WifiScanStarted());
 * wifiBuilder.buildFromWifi()
 *   .then(context => this.store.dispatch(new WifiScanSuccess(context)))
 *   .catch(error => this.store.dispatch(new WifiScanFailed(error)));
 */