import { Injectable } from '@angular/core';
import { IWifiScanner } from '../../../../domain/ports/iwifi-scanner.port';
import { WifiAccessPoint } from '../../../../domain/entities/wifi-access-point.entity';
import { WifiSignal } from '../../../../domain/value-objects/wifi-signal.value-object';

/**
 * Browser implementation of WiFi scanning using experimental Web WiFi API
 *
 * Key Features:
 * - Safely fails on unsupported browsers
 * - Handles permission flow via async/await
 * - Normalizes different browser implementations
 * - Includes thorough error classification
 *
 * Browser Requirements:
 * - Chrome/Edge with chrome://flags/#enable-experimental-web-platform-features enabled
 * - Secure HTTPS context
 */
@Injectable()
export class BrowserWifiAdapter implements IWifiScanner {
  private readonly wifi: any;

  constructor() {
    this.wifi = (navigator as any).wifi || null;
  }

  /**
   * Scans for nearby WiFi access points
   * @throws {Error} With specific error codes:
   *   - 'unsupported-browser': API not available
   *   - 'permission-denied': User blocked access
   *   - 'scan-failed': Unexpected scan error
   */
  async scan(): Promise<WifiAccessPoint[]> {
    if (!this.wifi) {
      throw this.createError('unsupported-browser');
    }

    try {
      const networks = await this.wifi.getAccessPoints();
      return networks.map((n: any) => this.normalizeAccessPoint(n));
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  getScanStatus(): 'available' | 'permission_required' | 'unavailable' {
    if (!this.wifi) return 'unavailable';
    return 'available'; // Browser API handles permissions at call time
  }

  private normalizeAccessPoint(ap: any): WifiAccessPoint {
    return new WifiAccessPoint(
      ap.bssid,
      new WifiSignal(ap.rssi),
      ap.ssid || undefined, // Convert empty string to undefined
      ap.channel,
      ap.timestamp || Date.now()
    );
  }

  private classifyError(error: any): Error {
    const message = error?.message?.toLowerCase() || '';

    if (message.includes('permission') || message.includes('denied')) {
      return this.createError('permission-denied');
    }

    if (message.includes('not supported') || message.includes('undefined')) {
      return this.createError('unsupported-browser');
    }

    return this.createError('scan-failed', error);
  }

  private createError(code: string, originalError?: any): Error {
    const messages: Record<string, string> = {
      'unsupported-browser': 'WiFi scanning not supported in this browser',
      'permission-denied': 'WiFi access permission denied',
      'scan-failed': 'Failed to scan WiFi networks'
    };

    const error = new Error(messages[code]);
    (error as any).code = code;
    (error as any).originalError = originalError;
    return error;
  }
}

/**
 * Example Usage:
 *
 * 1. Check for availability:
 *    if (scanner.getScanStatus() === 'available') {
 *      // Safe to scan
 *    }
 *
 * 2. Handle scanning:
 *    try {
 *      const aps = await scanner.scan();
 *      console.log('Found networks:', aps.map(ap => ap.ssid));
 *    } catch (error) {
 *      if (error.code === 'permission-denied') {
 *        showPermissionInstructions();
 *      }
 *    }
 *
 * 3. Feature detection:
 *    if (!('wifi' in navigator)) {
 *      useFallbackPositioning();
 *    }
 */