import { Component, Input,  } from '@angular/core';
import { CommonModule } from '@angular/common';

/** WiFi Signal Indicator Component
 * 
 * Visual representation of WiFi signal strength with dynamic:
 * - Bar quantity (1-4) based on signal quality
 * - Color coding (red → orange → yellow → green)
 * - Interactive tooltip with technical details
 * 
 * Technical Specifications:
 * - Input: Accepts signal strength in dBm (-100 to -20)
 * - Output: Visual indicator with 25% granularity
 * - Accessibility: Tooltip provides text alternative
 */
@Component({
  selector: 'app-wifi-signal-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="signal" [title]="tooltip" >
      <span *ngFor="let bar of bars"
            [class]="'bar strength-' + bar"
            aria-hidden="true"></span>
    </div>
  `,
  styles: [`
    .signal { 
      display: inline-flex; 
      gap: 2px; 
      height: 1em;
      vertical-align: middle;
    }
    .bar {
      width: 3px;
      background: #ccc;
      align-self: flex-end;
      transition: all 0.3s ease;
    }
    .strength-1 { height: 25%; background: #ff4444; } /* Red */
    .strength-2 { height: 50%; background: #ffbb33; } /* Orange */
    .strength-3 { height: 75%; background: #ffdd33; } /* Yellow */
    .strength-4 { height: 100%; background: #00C851; } /* Green */
  `]
})
export class WifiSignalIndicatorComponent {
  private _strength = -100; // Default minimum value

  /**
   * Current WiFi signal strength in dBm
   * @param value Signal strength between -100 (weak) and -20 (strong)
   */
  @Input() set strength(value: number) {
    this._strength = Math.max(-100, Math.min(-20, value)); // Clamp value to valid range
    this.bars = this.calculateBars();
    this.tooltip = `${this._strength}dBm (${this.quality}% - ${this.signalCategory})`;
  }

  get strength(): number {
    return this._strength;
  }

  /** Array controlling the number of bars to display (1-4) */
  bars: number[] = [];

  /** Tooltip text showing technical details */
  tooltip = '';

  /** 
   * Calculates signal quality percentage 
   * @returns Number between 0 (weakest) and 100 (strongest)
   */
  private get quality(): number {
    return Math.min(100, Math.max(0, 2 * (this._strength + 100)));
  }

  /**
   * Categorizes signal strength for semantic presentation
   */
  private get signalCategory(): string {
    const percent = this.quality;
    if (percent >= 80) return 'Excellent';
    if (percent >= 65) return 'Good';
    if (percent >= 40) return 'Fair';
    if (percent >= 20) return 'Weak';
    return 'Unusable';
  }

  /**
   * Determines the bar display configuration
   * @returns Array of bar indices (1-4)
   */
  private calculateBars(): number[] {
    const barCount = Math.min(4, Math.max(1, Math.ceil(this.quality / 25)));
    return Array(barCount).fill(0).map((_, i) => i + 1);
  }
}