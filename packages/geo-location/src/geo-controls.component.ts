// src/app/geo-controls/geo-controls.component.ts
import { Component } from '@angular/core';
import { GeoWidgetComponent } from './geo-widget/geo-widget.component';
import { WifiScanButtonComponent } from './wifi-scan-button/wifi-scan-button.component';
import { WifiSignalIndicatorComponent } from './wifi-signal-indicator/wifi-signal-indicator.component';

@Component({
  selector: 'app-geo-controls',
  standalone: true,
  imports: [
    GeoWidgetComponent,
    WifiScanButtonComponent,
    WifiSignalIndicatorComponent
  ],
  template: `
    <geo-widget></geo-widget>

    <app-wifi-scan-button
      (scanComplete)="onScanComplete()"
      (scanFailed)="onScanFailed($event)">
      Start WiFi Scan
    </app-wifi-scan-button>

    <app-wifi-signal-indicator [strength]="signalStrength"></app-wifi-signal-indicator>
  `
})
export class GeoControlsComponent {
  signalStrength: number = 0;

  onScanComplete() {
    // Handle scan complete logic
  }

  onScanFailed(error: any) {
    // Handle scan failure logic
  }
}