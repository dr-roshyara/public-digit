import { Component, EventEmitter, Output } from '@angular/core';
import { IWifiScanner } from '../../../domain/ports/iwifi-scanner.port';
import { CommonModule } from '@angular/common'; // Add this

@Component({
  standalone: true,
  imports: [CommonModule], // Add this
  selector: 'app-wifi-scan-button',
  template: `
    <button (click)="handleClick()" [disabled]="scanning">
      <ng-content></ng-content>
      {{ scanning ? 'Scanning...' : label }}
    </button>
  `,
  styles: [`
    button { transition: opacity 0.3s; }
    button:disabled { opacity: 0.7; }
  `]
})
export class WifiScanButtonComponent {
  @Output() scanComplete = new EventEmitter<void>();
  @Output() scanFailed = new EventEmitter<Error>();

  scanning = false;
  label = 'Scan WiFi';

  constructor(private scanner: IWifiScanner) {}

  async handleClick() {
    this.scanning = true;
    try {
      await this.scanner.scan();
      this.scanComplete.emit();
    } catch (error) {
      this.scanFailed.emit(error as Error);
    } finally {
      this.scanning = false;
    }
  }
}