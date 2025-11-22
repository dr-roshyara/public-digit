/**
 * WiFi Access Point Entity - Domain model representing a physical wireless access point
 * 
 * Responsibilities:
 * - Maintain AP identity and technical characteristics
 * - Calculate signal quality metrics
 * - Estimate distance based on signal strength
 * - Provide domain-specific operations
 *
 * @module WifiAccessPoint
 * @version 2.0.0
 * @file geo/domain/entities/wifi-access-point.entity.ts
 */

import { WifiSignal } from '../value-objects/wifi-signal.value-object';
import { WifiError } from '../../shared/errors/domain.error';

/**
 * WiFi Access Point properties with strict typing
 * 
 * @interface WifiAccessPointProps
 * @property {string} bssid - Hardware MAC address (format: '00:11:22:33:44:55')
 * @property {WifiSignal} signal - Signal strength and quality metrics
 * @property {string} [ssid] - Network identifier (undefined for hidden networks)
 * @property {number} [channel] - Frequency channel number (1-165)
 * @property {number} [timestamp] - Measurement time (ms since epoch)
 */
export interface WifiAccessPointProps {
  bssid: string;
  signal: WifiSignal;
  ssid?: string;
  channel?: number;
  timestamp?: number;
}

/**
 * Core WiFi Access Point domain entity
 */
export class WifiAccessPoint {
  private constructor(private readonly props: WifiAccessPointProps) {}

  // ==================== FACTORY METHODS ====================

  /**
   * Creates a validated WifiAccessPoint instance
   * 
   * @static
   * @param {WifiAccessPointProps} props - Access point properties
   * @returns {WifiAccessPoint} Validated instance
   * @throws {DomainError} If validation fails
   */
  static create(props: WifiAccessPointProps): WifiAccessPoint {
    const ap = new WifiAccessPoint(props);
    ap.validate();
    return ap;
  }

  // ==================== VALIDATION ====================

  /**
   * Validates access point invariants
   * 
   * @private
   * @throws {DomainError} With validation details
   */
  private validate(): void {
    const errors: string[] = [];

    // MAC address validation
    if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(this.props.bssid)) {
      errors.push('Invalid MAC address format');
    }

    // Channel validation
    if (this.props.channel !== undefined && 
        (this.props.channel < 1 || this.props.channel > 165)) {
      errors.push('Channel must be between 1 and 165');
    }

    if (errors.length > 0) {
      throw new DomainError('WIFI_AP_VALIDATION_FAILED', {
        entity: 'WifiAccessPoint',
        errors,
        props: this.props
      });
    }
  }

  // ==================== DOMAIN LOGIC ====================

  /**
   * Converts WiFi channel to approximate frequency in MHz
   * 
   * @private
   * @param {number} channel - WiFi channel number
   * @returns {number} Frequency in MHz
   * @throws {DomainError} For invalid channels
   */
  private channelToFrequency(channel: number): number {
    if (channel >= 1 && channel <= 13) {
      return 2412 + (channel - 1) * 5;
    }
    if (channel === 14) return 2484;
    if (channel >= 36 && channel <= 165) {
      return 5180 + (channel - 36) * 5;
    }
    throw new DomainError('INVALID_WIFI_CHANNEL', { channel });
  }

  /**
   * Estimates distance from access point in meters
   * 
   * @returns {number|null} Distance in meters or null if insufficient data
   */
  get estimatedDistance(): number | null {
    if (!this.props.channel) return null;
    
    try {
      const frequency = this.channelToFrequency(this.props.channel);
      return this.props.signal.approximateDistance(frequency);
    } catch {
      return null;
    }
  }

  /**
   * Determines if this is a hidden network
   * 
   * @returns {boolean} True if SSID is not broadcast
   */
  get isHidden(): boolean {
    return this.props.ssid === undefined;
  }

  /**
   * Gets signal quality rating (0-100)
   * 
   * @returns {number} Signal quality percentage
   */
  get signalQuality(): number {
    return this.props.signal.quality;
  }

  // ==================== DATA TRANSFORMATION ====================

  /**
   * Generates human-readable identifier
   * 
   * @returns {string} Formatted string representation
   */
  toString(): string {
    const displayName = this.isHidden ? '<hidden>' : this.props.ssid;
    return `${displayName} (${this.props.bssid}) @ ${this.props.signal.dBm}dBm`;
  }

  /**
   * Serializes for persistence
   * 
   * @returns {WifiAccessPointProps} Raw properties
   */
  toJSON(): WifiAccessPointProps {
    return this.props;
  }

  // ==================== ACCESSORS ====================

  get bssid(): string { return this.props.bssid; }
  get signal(): WifiSignal { return this.props.signal; }
  get ssid(): string | undefined { return this.props.ssid; }
  get channel(): number | undefined { return this.props.channel; }
  get timestamp(): number { return this.props.timestamp ?? Date.now(); }
}

// ==================== USAGE EXAMPLES ====================
/*
// Creation
const accessPoint = WifiAccessPoint.create({
  bssid: '00:11:22:33:44:55',
  signal: new WifiSignal(-65),
  ssid: 'Office_WiFi',
  channel: 6
});

// Business Logic
console.log(accessPoint.toString()); // "Office_WiFi (00:11:22:33:44:55) @ -65dBm"

if (accessPoint.signalQuality > 70) {
  console.log(`Approx. distance: ${accessPoint.estimatedDistance?.toFixed(1)}m`);
}
*/