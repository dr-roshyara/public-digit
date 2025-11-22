import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

/**
 * Root Application Component
 *
 * NOTE: Locale detection is now handled by AppInitService (APP_INITIALIZER)
 * No need for component-level initialization anymore.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
    }
  `],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  // Locale detection now happens in AppInitService before component initialization
}