import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '@presentation/components/header/header.component';
import { HeroComponent } from '@presentation/components/hero/hero.component';
import { FeaturesComponent } from '@presentation/components/features/features.component';
import { ActionsComponent } from '@presentation/components/actions/actions.component';
import { StatsComponent } from '@presentation/components/stats/stats.component';
import { FooterComponent } from '@presentation/components/footer/footer.component';
import { LocaleDetectionFacade } from '@presentation/facades/locale-detection.facade';

/**
 * Landing Page Component
 * Complete frontpage integrating all individual components
 * Mobile-optimized with OKLCH color system
 * Includes automatic geo-location based language detection
 */
@Component({
  selector: 'pd-landing',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    HeroComponent,
    FeaturesComponent,
    ActionsComponent,
    StatsComponent,
    FooterComponent
  ],
  template: `
    <div class="min-h-screen bg-background">
      <!-- Header with Language Selector -->
      <pd-header></pd-header>

      <!-- Hero Section -->
      <pd-hero></pd-hero>

      <!-- Features Section -->
      <pd-features></pd-features>

      <!-- Actions Section -->
      <pd-actions></pd-actions>

      <!-- Stats Section -->
      <pd-stats></pd-stats>

      <!-- Footer -->
      <pd-footer></pd-footer>

      <!-- Debug Toggle (Development Only) -->
      <button
        (click)="toggleDebugInfo()"
        class="fixed bottom-4 right-4 bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-50"
        aria-label="Toggle Debug Panel"
        title="Toggle Debug Panel"
      >
        {{ showDebugInfo() ? '✕' : '🐛' }}
      </button>

      <!-- Debug Panel -->
      @if (showDebugInfo()) {
        <div class="fixed bottom-20 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-xl max-w-md z-50">
          <h4 class="font-bold text-lg mb-3 border-b border-gray-600 pb-2">
            🌐 Locale Debug Panel
          </h4>

          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Current Locale:</span>
              <span class="font-mono font-bold text-green-400">{{ currentLocale() }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-gray-400">Detected Country:</span>
              <span class="font-mono">{{ detectedCountry() || 'Unknown' }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-gray-400">Detection Source:</span>
              <span class="font-mono text-blue-400">{{ detectionSource() }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-gray-400">User Preference:</span>
              <span class="font-mono">{{ hasUserPreference() ? 'Yes' : 'No' }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-gray-400">Loading:</span>
              <span class="font-mono">{{ isLoading() ? 'Yes' : 'No' }}</span>
            </div>

            @if (errorMessage()) {
              <div class="mt-2 p-2 bg-red-900 rounded text-red-200 text-xs">
                Error: {{ errorMessage() }}
              </div>
            }
          </div>

          <div class="mt-4 space-y-2">
            <button
              (click)="resetDetection()"
              class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              🔄 Reset Detection
            </button>

            <button
              (click)="forceRefresh()"
              class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              ⚡ Force Refresh
            </button>

            <button
              (click)="toggleDebugInfo()"
              class="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .bg-background {
      background-color: oklch(0.98 0.02 260);
    }
  `]
})
export class LandingComponent implements OnInit {
  // Dependency injection using inject() function (prevents circular dependency)
  private readonly router = inject(Router);
  private readonly localeFacade = inject(LocaleDetectionFacade);

  // Debug panel state
  private readonly _showDebugInfo = signal(false);
  readonly showDebugInfo = this._showDebugInfo.asReadonly();

  // Facade state proxies (for template binding)
  readonly currentLocale = this.localeFacade.currentLocale;
  readonly detectedCountry = this.localeFacade.detectedCountry;
  readonly detectionSource = this.localeFacade.detectionSource;
  readonly hasUserPreference = this.localeFacade.hasUserPreference;
  readonly isLoading = this.localeFacade.isLoading;
  readonly errorMessage = this.localeFacade.errorMessage;

  async ngOnInit(): Promise<void> {
    console.log('🚀 Landing Page - Initializing locale detection...');

    try {
      // Slight delay to ensure all services are ready (prevents race conditions)
      await this.delay(100);

      const result = await this.localeFacade.initialize({
        respectUserPreference: true,
        forceRefresh: false
      });

      console.log('🌐 Locale detection completed:', {
        locale: result.locale,
        countryCode: result.countryCode,
        source: result.source,
        confidence: result.confidence,
        timestamp: result.timestamp
      });

      // Auto-show debug panel in development (optional)
      if (this.isDevelopment()) {
        console.log('💡 Development mode: Debug panel available (click 🐛 button)');
      }

    } catch (error) {
      console.error('❌ Locale detection failed:', error);
      // Continue with default language (English) - graceful degradation
    }
  }

  /**
   * Toggle debug panel visibility
   */
  toggleDebugInfo(): void {
    this._showDebugInfo.update(show => !show);
  }

  /**
   * Reset locale detection to auto-detect mode
   */
  async resetDetection(): Promise<void> {
    try {
      console.log('🔄 Resetting locale detection...');
      const result = await this.localeFacade.resetToAutoDetect();
      console.log('✅ Locale detection reset:', result);
    } catch (error) {
      console.error('❌ Failed to reset detection:', error);
    }
  }

  /**
   * Force refresh locale detection
   */
  async forceRefresh(): Promise<void> {
    try {
      console.log('⚡ Forcing locale detection refresh...');
      const result = await this.localeFacade.initialize({ forceRefresh: true });
      console.log('✅ Locale detection refreshed:', result);
    } catch (error) {
      console.error('❌ Failed to force refresh:', error);
    }
  }

  /**
   * Check if running in development mode
   */
  private isDevelopment(): boolean {
    // This should ideally come from environment configuration
    return !this.isProduction();
  }

  /**
   * Check if running in production mode
   */
  private isProduction(): boolean {
    // In a real app, this would check environment.production
    return false;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
