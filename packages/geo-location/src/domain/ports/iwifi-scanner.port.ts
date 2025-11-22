import { WifiAccessPoint } from '../entities/wifi-access-point.entity';

/**
 * Abstracts the platform-specific WiFi scanning capability
 *
 * Implementations exist for:
 * - Browser (limited support)
 * - Cordova (full access via plugins)
 * - Mock (for testing)
 */
export interface IWifiScanner {
  /**
   * Performs active scan and returns visible access points
   * @throws When scanning is unavailable or permission denied
   */
  scan(): Promise<WifiAccessPoint[]>;

  /** Checks scanning capability without attempting scan */
  getScanStatus(): 'available' | 'permission_required' | 'unavailable';
}

/**
 * Example Usage:
 *
 * class LocationService {
 *   constructor(private scanner: IWifiScanner) {}
 *
 *   async scanNetworks() {
 *     if (this.scanner.getScanStatus() === 'available') {
 *       return await this.scanner.scan();
 *     }
 *     throw new Error('Scanner unavailable');
 *   }
 * }
 */