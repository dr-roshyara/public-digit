import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IWifiPositioningService } from '../../../domain/ports/iwifi-positioning.port';
import { GeoContext } from '../../../domain/aggregates/geo-context.model';
import { WifiAccessPoint } from '../../../domain/entities/wifi-access-point.entity';

@Injectable()
export class GoogleWifiAdapter implements IWifiPositioningService {
  readonly accuracy = 100; // meters

  constructor(private http: HttpClient) {}

  async estimatePosition(accessPoints: WifiAccessPoint[]): Promise<GeoContext> {
    const response = await this.http.post<GoogleResponse>('https://www.googleapis.com/geolocation/v1/geolocate', {
      wifiAccessPoints: accessPoints.map(ap => ({
        macAddress: ap.bssid,
        signalStrength: ap.signal.strength,
        channel: ap.channel
      }))
    }).toPromise();

    return GeoContext.create({
      coordinates: new LatLng(response.location.lat, response.location.lng, response.accuracy),
      source: 'wifi'
    });
  }
}

interface GoogleResponse {
  location: { lat: number; lng: number };
  accuracy: number;
}