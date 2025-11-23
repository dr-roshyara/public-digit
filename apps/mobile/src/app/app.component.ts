import { Component, ViewEncapsulation, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '@application/services';

/**
 * Root Application Component
 *
 * RESPONSIBILITIES:
 * - Initialize translation system (route-first loading)
 * - Render router outlet for page navigation
 *
 * NOTE: Locale detection is handled by LocaleDetectionFacade in LandingComponent
 * Translation system initialization happens here to ensure all routes have translations
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
export class AppComponent implements OnInit {
  private translationService = inject(TranslationService);

  async ngOnInit(): Promise<void> {
    console.log('[AppComponent] Initializing translation system...');

    try {
      // Initialize translation system (sets up router integration)
      await this.translationService.initialize();

      console.log('[AppComponent] ✅ Translation system initialized');
    } catch (error) {
      console.error('[AppComponent] ❌ Failed to initialize translation system:', error);
      // Continue app initialization even if translations fail (graceful degradation)
    }
  }
}