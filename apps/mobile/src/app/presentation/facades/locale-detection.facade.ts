/**
 * LocaleDetectionFacade - Presentation Facade
 *
 * DDD PRESENTATION LAYER - Simplifies application layer for UI components
 *
 * PURPOSE:
 * - Provide simple, component-friendly API
 * - Handle presentation concerns (loading states, errors)
 * - Adapt application DTOs to view models
 * - Manage component-level state
 *
 * ARCHITECTURE:
 * Components → Presentation Facade → Application Service → Domain
 *
 * USAGE:
 * Components inject this facade instead of directly using application services
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

// Application layer
import {
  AutoLocaleDetectionService,
  LocaleDetectionResult,
  LocaleDetectionStatus
} from '@application/services/auto-locale-detection.service';

/**
 * View Model for locale selection UI
 */
export interface LocaleOption {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

/**
 * View Model for locale detection state (presentation-friendly)
 */
export interface LocaleDetectionViewModel {
  currentLocale: string;
  currentLocaleName: string;
  isLoading: boolean;
  error: string | null;
  confidence: 'high' | 'medium' | 'low';
  isAutoDetected: boolean;
  hasUserPreference: boolean;
  availableLocales: LocaleOption[];
}

/**
 * Presentation Facade for Locale Detection
 *
 * PROVIDES:
 * - Reactive signals for components
 * - Simple methods for user actions
 * - View models instead of raw DTOs
 * - Presentation-level error handling
 */
@Injectable({ providedIn: 'root' })
export class LocaleDetectionFacade {
  // Application service (orchestrator)
  private autoLocaleService = inject(AutoLocaleDetectionService);

  // ======== REACTIVE SIGNALS (Angular 18+) ========

  /**
   * Reactive status signal from application service
   */
  private readonly statusSignal = toSignal(this.autoLocaleService.status$, {
    initialValue: {
      isDetecting: false,
      lastDetection: null,
      hasUserPreference: false,
      error: null
    }
  });

  /**
   * Current locale signal (computed from status)
   */
  readonly currentLocale = computed(() => {
    const status = this.statusSignal();
    return status.lastDetection?.locale || 'en';
  });

  /**
   * Loading state signal
   */
  readonly isLoading = computed(() => {
    return this.statusSignal().isDetecting;
  });

  /**
   * Error message signal
   */
  readonly errorMessage = computed(() => {
    return this.statusSignal().error;
  });

  /**
   * Has user preference signal
   */
  readonly hasUserPreferenceSignal = computed(() => {
    return this.statusSignal().hasUserPreference;
  });

  /**
   * View model signal (complete UI state)
   */
  readonly viewModel = computed((): LocaleDetectionViewModel => {
    const status = this.statusSignal();
    const locale = status.lastDetection?.locale || 'en';

    return {
      currentLocale: locale,
      currentLocaleName: this.getLocaleName(locale),
      isLoading: status.isDetecting,
      error: status.error,
      confidence: status.lastDetection?.confidence || 'low',
      isAutoDetected: status.lastDetection?.source === 'geo-auto',
      hasUserPreference: status.hasUserPreference,
      availableLocales: this.getAvailableLocaleOptions()
    };
  });

  // ======== OBSERVABLE STREAMS (for async pipe) ========

  /**
   * Status stream for async pipe
   */
  get status$(): Observable<LocaleDetectionStatus> {
    return this.autoLocaleService.status$;
  }

  /**
   * Current locale stream for async pipe
   */
  get currentLocale$(): Observable<string> {
    return this.autoLocaleService.currentLocale$;
  }

  // ======== USER ACTIONS (called from components) ========

  /**
   * Initialize automatic locale detection
   *
   * USAGE: Call from app initializer or landing component
   *
   * @example
   * ```typescript
   * // In component
   * async ngOnInit() {
   *   const result = await this.localeFacade.initialize();
   *   console.log('Detected locale:', result.locale);
   * }
   * ```
   */
  async initialize(options?: {
    respectUserPreference?: boolean;
    forceRefresh?: boolean;
  }): Promise<LocaleDetectionResult> {
    try {
      return await this.autoLocaleService.initialize(options);
    } catch (error) {
      console.error('Facade: Failed to initialize locale detection:', error);
      throw error;
    }
  }

  /**
   * Set user's locale preference
   *
   * USAGE: Call from language selector component
   *
   * @example
   * ```typescript
   * // In component
   * async onLanguageChange(locale: string) {
   *   const success = await this.localeFacade.setLocale(locale);
   *   if (success) {
   *     this.notificationService.show('Language changed');
   *   }
   * }
   * ```
   */
  async setLocale(locale: string): Promise<boolean> {
    try {
      return await this.autoLocaleService.setUserPreference(locale);
    } catch (error) {
      console.error('Facade: Failed to set locale:', error);
      return false;
    }
  }

  /**
   * Clear user preference and re-detect
   *
   * USAGE: Call from settings "Reset to auto-detect" button
   *
   * @example
   * ```typescript
   * // In component
   * async onResetToAutoDetect() {
   *   const result = await this.localeFacade.resetToAutoDetect();
   *   console.log('Auto-detected:', result.locale);
   * }
   * ```
   */
  async resetToAutoDetect(): Promise<LocaleDetectionResult> {
    try {
      return await this.autoLocaleService.clearUserPreference();
    } catch (error) {
      console.error('Facade: Failed to reset to auto-detect:', error);
      throw error;
    }
  }

  // ======== QUERIES (read-only access) ========

  /**
   * Get current locale (synchronous)
   */
  getCurrentLocale(): string {
    return this.autoLocaleService.getCurrentLocale();
  }

  /**
   * Get available locale options for UI
   */
  getAvailableLocaleOptions(): LocaleOption[] {
    return [
      {
        code: 'en',
        name: 'English',
        flag: '🇺🇸',
        nativeName: 'English'
      },
      {
        code: 'de',
        name: 'German',
        flag: '🇩🇪',
        nativeName: 'Deutsch'
      },
      {
        code: 'np',
        name: 'Nepali',
        flag: '🇳🇵',
        nativeName: 'नेपाली'
      }
    ];
  }

  /**
   * Get locale name for display
   */
  getLocaleName(code: string): string {
    const option = this.getAvailableLocaleOptions().find(opt => opt.code === code);
    return option?.name || code;
  }

  /**
   * Get locale flag emoji
   */
  getLocaleFlag(code: string): string {
    const option = this.getAvailableLocaleOptions().find(opt => opt.code === code);
    return option?.flag || '🌐';
  }

  /**
   * Check if auto-detection is enabled
   */
  isAutoDetectionEnabled(): boolean {
    return !this.hasUserPreference();
  }

  /**
   * Check if user has explicit preference
   */
  hasUserPreference(): boolean {
    return this.autoLocaleService.hasUserExplicitPreference();
  }

  /**
   * Get health status for admin/debug UI
   */
  getHealthStatus() {
    return this.autoLocaleService.getHealthStatus();
  }

  /**
   * Get view model (synchronous, for template usage)
   */
  getViewModel(): LocaleDetectionViewModel {
    return this.viewModel();
  }
}
