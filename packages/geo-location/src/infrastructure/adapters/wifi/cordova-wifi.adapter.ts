import { Injectable } from '@angular/core';
import { IWifiScanner } from '../../../../domain/ports/iwifi-scanner.port';
import { WifiAccessPoint } from '../../../../domain/entities/wifi-access-point.entity';
import { WifiSignal } from '../../../../domain/value-objects/wifi-signal.value-object';

declare var WifiWizard2: any;

/**
 * Cordova implementation of WiFi scanning using wifi-wizard2 plugin
 *
 * Features:
 * - Full access to BSSID, SSID, RSSI, and channel info
 * - Requires cordova-plugin-wifiwizard2
 * - Only works in Cordova/PhoneGap/Capacitor environments
 */
@Injectable()
export class CordovaWifiAdapter implements IWifiScanner {
  async scan(): Promise<WifiAccessPoint[]> {
    const networks = await WifiWizard2.scan();
    return networks.map((n: any) => new WifiAccessPoint(
      n.BSSID,
      new WifiSignal(n.level),
      n.SSID,
      n.frequency
    ));
  }

  getScanStatus() {
    return typeof WifiWizard2 !== 'undefined' ? 'available' : 'unavailable';
  }
}

/**
 * Example Usage (in Cordova):
 *
 * // In module providers:
 * { provide: IWifiScanner, useClass: CordovaWifiAdapter }
 *
 * // In service:
 * const aps = await scanner.scan();
 * console.log(aps[0].ssid); // "Office_WiFi"
 */