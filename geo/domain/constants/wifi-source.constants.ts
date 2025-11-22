/**
 * WiFi Positioning Methodology Constants
 * 
 * Defines the technical approaches for WiFi-based location determination,
 * including accuracy characteristics and implementation details.
 *
 * @module WifiPositioning
 * @version 1.1.0
 * @file geo/domain/constants/wifi-source.constants.ts
 */

/**
 * WiFi Positioning Methodology Types
 * 
 * @enum {Object}
 * @property {string} BASIC - MAC address database lookup (least accurate)
 * @property {string} TRIANGULATION - RSSI-based trilateration (medium accuracy)
 * @property {string} HYBRID - Automatic method fallback (most reliable)
 */
export const WifiPositioningMethod = {
  /** 
   * Basic MAC address database lookup 
   * Typical accuracy: ~200m radius 
   */
  BASIC: 'basic',
  
  /** 
   * Radio Signal Strength (RSSI) triangulation 
   * Typical accuracy: ~50m radius 
   */
  TRIANGULATION: 'tri',
  
  /** 
   * Hybrid approach with automatic fallback 
   * Typical accuracy: ~100m radius 
   */
  HYBRID: 'hybrid'
} as const;

/**
 * Type representing all possible WiFi positioning methods
 * 
 * @typedef {('basic'|'tri'|'hybrid')} WifiPositioningMethod
 */
export type WifiPositioningMethod = 
  typeof WifiPositioningMethod[keyof typeof WifiPositioningMethod];

/**
 * Estimated accuracy ranges (in meters) for each positioning method
 * 
 * @constant {Record<WifiPositioningMethod, number>}
 */
export const WifiPositioningAccuracy: Record<WifiPositioningMethod, number> = {
  [WifiPositioningMethod.BASIC]: 200,
  [WifiPositioningMethod.TRIANGULATION]: 50,
  [WifiPositioningMethod.HYBRID]: 100
};

/**
 * Gets the technical name for a positioning method
 * 
 * @function getMethodName
 * @param {WifiPositioningMethod} method - The positioning method
 * @returns {string} Human-readable method name
 */
export function getMethodName(method: WifiPositioningMethod): string {
  const names: Record<WifiPositioningMethod, string> = {
    [WifiPositioningMethod.BASIC]: 'MAC Address Lookup',
    [WifiPositioningMethod.TRIANGULATION]: 'Signal Triangulation',
    [WifiPositioningMethod.HYBRID]: 'Hybrid Positioning'
  };
  return names[method];
}

/**
 * Determines if a method supports real-time updates
 * 
 * @function supportsRealTimeUpdates
 * @param {WifiPositioningMethod} method - The positioning method
 * @returns {boolean} True if method supports dynamic updates
 */
export function supportsRealTimeUpdates(method: WifiPositioningMethod): boolean {
  return method !== WifiPositioningMethod.BASIC;
}

/**
 * Example Usage:
 * 
 * ```typescript
 * // Configure positioning system
 * function configurePositioning(method: WifiPositioningMethod) {
 *   console.log(`Using ${getMethodName(method)} with ${WifiPositioningAccuracy[method]}m accuracy`);
 *   
 *   if (supportsRealTimeUpdates(method)) {
 *     enableLiveTracking();
 *   }
 * }
 * 
 * // Type-safe method selection
 * const preferredMethod: WifiPositioningMethod = WifiPositioningMethod.HYBRID;
 * configurePositioning(preferredMethod);
 * ```
 */

/**
 * Type guard for WiFi positioning methods
 * 
 * @function isWifiPositioningMethod
 * @param {string} method - Potential positioning method
 * @returns {method is WifiPositioningMethod} Type predicate
 */
export function isWifiPositioningMethod(method: string): method is WifiPositioningMethod {
  return Object.values(WifiPositioningMethod).includes(method as WifiPositioningMethod);
}