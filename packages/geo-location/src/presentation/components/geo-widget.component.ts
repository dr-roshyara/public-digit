// geo/presentation/components/geo-widget/geo-widget.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeoLocationFacade } from '../../application/facades/geo-location.facade';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-geo-widget',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  template: `
    <button (click)="detect()">Detect My Location</button>
    <div *ngIf="loading">Detecting...</div>
    <div *ngIf="error">{{ error }}</div>
    <div *ngIf="location$ | async as location">
      You're in {{ location.city.name }}, {{ location.country.name }}
    </div>
  `
})
export class GeoWidgetComponent {
  loading = false;
  error: string | null = null;
  location$; // Remove initialization here

  constructor(private geoFacade: GeoLocationFacade) {
    this.location$ = this.geoFacade.currentContext$; // Initialize in constructor
  }

  async detect() {
    this.loading = true;
    this.error = null;
    try {
      await this.geoFacade.initGeoLocation();
    } catch (err) {
      this.error = 'Failed to detect location';
      console.error('Location detection failed:', err);
    } finally {
      this.loading = false;
    }
  }
}