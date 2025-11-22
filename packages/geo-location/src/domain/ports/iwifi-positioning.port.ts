import { GeoContext } from '../../aggregates/geo-context.model';
import { WifiAccessPoint } from '../entities/wifi-access-point.entity';

/**
 * Contract for WiFi-based positioning services
 *
 * Implementations should provide:
 * - Basic MAC address database lookup (less accurate)
 * - Advanced RSSI-based triangulation (more accurate)
 * - Hybrid approaches combining multiple methods
 *
 * Note: This is a strategic port that abstracts:
 * - External positioning APIs (Google/Mozilla)
 * - Internal algorithms (RSSI trilateration)
 * - Mock services for testing
 */
export interface IWifiPositioningService {
  /**
   * Estimates device position using WiFi access points
   *
   * @param accessPoints List of scanned WiFi APs with signal data
   * @returns Promise resolving to GeoContext with:
   *   - Coordinates (latitude, longitude)
   *   - Accuracy estimate (meters)
   *   - Source attribution ('wifi-basic' | 'wifi-triangulation')
   *
   * @throws LocationDetectionError with codes:
   *   - 'no-ap-match' - No known APs in database
   *   - 'invalid-signal' - Bad RSSI/channel data
   *   - 'service-unavailable' - API/algorithm failure
   */
  estimatePosition(accessPoints: WifiAccessPoint[]): Promise<GeoContext>;

  /**
   * Theoretical accuracy of this method in meters
   * (68% confidence radius - 1 standard deviation)
   */
  readonly accuracy: number;

  /**
   * Positioning methodology identifier
   */
  readonly method: 'basic' | 'triangulation' | 'hybrid';
}

/**
 * Standard error type for WiFi positioning failures
 */
export class WifiPositioningError extends Error {
  constructor(
    public readonly code:
      | 'no-ap-match'
      | 'invalid-signal'
      | 'service-unavailable',
    public readonly metadata?: {
      accessPoints?: WifiAccessPoint[];
      requestedMinAps?: number;
    }
  ) {
    super(`WiFi positioning failed (${code})`);
    this.name = 'WifiPositioningError';
  }
}

/**
 * Example Implementations:
 *
 * 1. Basic MAC lookup:
 * @Injectable()
 * class BasicWifiPositioning implements IWifiPositioningService {
 *   readonly accuracy = 200;
 *   readonly method = 'basic';
 *
 *   estimatePosition(aps: WifiAccessPoint[]) {
 *     // Implementation using simple database lookup
 *   }
 * }
 *
 * 2. Advanced triangulation:
 * @Injectable()
 * class TriangulationPositioning implements IWifiPositioningService {
 *   readonly accuracy = 50;
 *   readonly method = 'triangulation';
 *
 *   estimatePosition(aps: WifiAccessPoint[]) {
 *     // Implementation using RSSI trilateration
 *   }
 * }
 *
 * Example Usage:
 *
 * // In your service:
 * constructor(
 *   @Inject(IWifiPositioningService)
 *   private positioningServices: IWifiPositioningService[]
 * ) {
 *   // Sort by accuracy (best first)
 *   this.services = positioningServices.sort((a,b) => a.accuracy - b.accuracy);
 * }
 *
 * async locate() {
 *   for (const service of this.services) {
 *     try {
 *       return await service.estimatePosition(accessPoints);
 *     } catch (error) {
 *       console.warn(`${service.method} failed, trying next`);
 *     }
 *   }
 *   throw new Error('All positioning methods failed');
 * }
 */