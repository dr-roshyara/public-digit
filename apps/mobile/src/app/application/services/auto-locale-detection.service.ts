/**
 * AutoLocaleDetectionService - Application Service
 *
 * DDD APPLICATION LAYER - Orchestrates use cases and coordinates domain logic
 *
 * PURPOSE:
 * - Coordinate locale detection workflow
 * - Integrate geo-location with translation system
 * - Handle user preferences and fallbacks
 * - Provide high-level API for presentation layer
 *
 * ARCHITECTURE:
 * Presentation → Application Service → Use Cases → Domain Services → Infrastructure
 *
 * RESPONSIBILITIES (Application Layer):
 * - Workflow orchestration
 * - Transaction boundaries
 * - DTO transformation
 * - Cross-cutting concerns (logging, monitoring)
 */

import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, tap, catchError, switchMap, shareReplay } from 'rxjs/operators';

// Application layer dependencies
import { DetectUserLocaleUseCase } from '../use-cases/detect-user-locale.use-case';

// Infrastructure dependencies
import { GeoLocationPackageAdapter } from '@infrastructure/adapters/geo-location-package.adapter';
import { RouteFirstTranslationLoader } from '@core/i18n/route-first.loader';

// Domain dependencies
import { LocalePreference } from '@domain/geo-location/value-objects/locale-preference.vo';

/**
 * Application-level DTO for locale detection result
 */
export interface LocaleDetectionResult {
  locale: string;
  countryCode: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'geo-auto' | 'user-explicit' | 'browser-fallback' | 'system-default';
  timestamp: Date;
}

/**
 * Application-level DTO for locale detection status
 */
export interface LocaleDetectionStatus {
  isDetecting: boolean;
  lastDetection: LocaleDetectionResult | null;
  hasUserPreference: boolean;
  error: string | null;
}

/**
 * Application Service for Automatic Locale Detection
 *
 * ORCHESTRATES:
 * 1. Geo-location detection (via use case)
 * 2. Translation system integration (via infrastructure)
 * 3. User preference management
 * 4. Fallback strategies
 */
@Injectable({ providedIn: 'root' })
export class AutoLocaleDetectionService {
  // Use cases (domain orchestration)
  private detectUserLocaleUseCase = inject(DetectUserLocaleUseCase);

  // Infrastructure adapters
  private geoAdapter = inject(GeoLocationPackageAdapter);
  private translationLoader = inject(RouteFirstTranslationLoader);

  // Application state
  private readonly _status$ = new BehaviorSubject<LocaleDetectionStatus>({
    isDetecting: false,
    lastDetection: null,
    hasUserPreference: this.hasUserExplicitPreference(),
    error: null
  });

  /**
   * Observable status of locale detection
   */
  get status$(): Observable<LocaleDetectionStatus> {
    return this._status$.asObservable();
  }

  /**
   * Observable current locale
   */
  get currentLocale$(): Observable<string> {
    return this._status$.pipe(
      map(status => status.lastDetection?.locale || 'en')
    );
  }

  /**
   * Initialize automatic locale detection
   *
   * WORKFLOW:
   * 1. Initialize geo-location adapter
   * 2. Check user preference (if respectUserPreference = true)
   * 3. Detect locale via use case
   * 4. Apply to translation system
   * 5. Update application state
   *
   * USAGE: Call from APP_INITIALIZER or component ngOnInit
   */
  async initialize(options: {
    respectUserPreference?: boolean;
    forceRefresh?: boolean;
  } = {}): Promise<LocaleDetectionResult> {
    const { respectUserPreference = true, forceRefresh = false } = options;

    console.log('🌍 Initializing automatic locale detection...', {
      respectUserPreference,
      forceRefresh
    });

    this.updateStatus({ isDetecting: true, error: null });

    try {
      // Step 1: Initialize infrastructure adapter
      await this.geoAdapter.initialize();

      // Step 2: Execute domain use case
      const localePreference = await this.detectUserLocaleUseCase.execute({
        forceRefresh,
        respectUserChoice: respectUserPreference
      });

      // Step 3: Create application-level result DTO
      const result = this.mapToDetectionResult(localePreference, 'geo-auto');

      // Step 4: Apply to translation system
      await this.applyLocaleToTranslationSystem(result.locale);

      // Step 5: Update application state
      this.updateStatus({
        isDetecting: false,
        lastDetection: result,
        hasUserPreference: this.hasUserExplicitPreference(),
        error: null
      });

      console.log('✅ Automatic locale detection completed:', result);

      return result;

    } catch (error) {
      console.error('❌ Automatic locale detection failed:', error);

      // Fallback strategy
      const fallbackResult = await this.executeFallbackStrategy();

      this.updateStatus({
        isDetecting: false,
        lastDetection: fallbackResult,
        hasUserPreference: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return fallbackResult;
    }
  }

  /**
   * Manually set user's locale preference
   *
   * WORKFLOW:
   * 1. Validate locale
   * 2. Store user preference (infrastructure)
   * 3. Apply to translation system
   * 4. Update application state
   */
  async setUserPreference(locale: string): Promise<boolean> {
    console.log(`🎯 Setting user preference to: ${locale}`);

    this.updateStatus({ isDetecting: true, error: null });

    try {
      // Validate locale
      if (!this.isValidLocale(locale)) {
        throw new Error(`Invalid locale: ${locale}`);
      }

      // Store in infrastructure
      const success = await this.geoAdapter.setUserPreference(locale).toPromise();

      if (!success) {
        throw new Error('Failed to store user preference');
      }

      // Store locally for application layer
      localStorage.setItem('user_explicit_locale', locale);

      // Apply to translation system
      await this.applyLocaleToTranslationSystem(locale);

      // Update state
      const result: LocaleDetectionResult = {
        locale,
        countryCode: 'USER', // User-selected, no country detection
        confidence: 'high',
        source: 'user-explicit',
        timestamp: new Date()
      };

      this.updateStatus({
        isDetecting: false,
        lastDetection: result,
        hasUserPreference: true,
        error: null
      });

      console.log('✅ User preference set successfully');

      return true;

    } catch (error) {
      console.error('❌ Failed to set user preference:', error);

      this.updateStatus({
        isDetecting: false,
        error: error instanceof Error ? error.message : 'Failed to set preference'
      });

      return false;
    }
  }

  /**
   * Clear user's explicit preference and re-detect
   *
   * WORKFLOW:
   * 1. Clear user preference (infrastructure)
   * 2. Clear local storage
   * 3. Re-run automatic detection
   */
  async clearUserPreference(): Promise<LocaleDetectionResult> {
    console.log('🔄 Clearing user preference and re-detecting...');

    try {
      // Clear in infrastructure
      await this.geoAdapter.clearUserPreference().toPromise();

      // Clear local storage
      localStorage.removeItem('user_explicit_locale');

      // Re-run automatic detection
      return await this.initialize({ respectUserPreference: false, forceRefresh: true });

    } catch (error) {
      console.error('❌ Failed to clear user preference:', error);

      // Fallback
      return await this.executeFallbackStrategy();
    }
  }

  /**
   * Get current detection status (synchronous)
   */
  getCurrentStatus(): LocaleDetectionStatus {
    return this._status$.value;
  }

  /**
   * Get current locale (synchronous)
   */
  getCurrentLocale(): string {
    return this._status$.value.lastDetection?.locale || this.translationLoader.getCurrentLocale() || 'en';
  }

  /**
   * Check if user has explicit preference
   */
  hasUserExplicitPreference(): boolean {
    return !!localStorage.getItem('user_explicit_locale');
  }

  /**
   * Get available locales
   */
  getAvailableLocales(): string[] {
    return ['en', 'de', 'np'];
  }

  /**
   * Get health status for monitoring
   */
  getHealthStatus(): {
    application: LocaleDetectionStatus;
    infrastructure: any;
  } {
    return {
      application: this.getCurrentStatus(),
      infrastructure: this.geoAdapter.getHealthStatus()
    };
  }

  // ======== PRIVATE HELPER METHODS ========

  private async applyLocaleToTranslationSystem(locale: string): Promise<void> {
    try {
      console.log(`📝 Applying locale to translation system: ${locale}`);
      await this.translationLoader.setLocale(locale);
      console.log('✅ Locale applied to translation system');
    } catch (error) {
      console.error('❌ Failed to apply locale to translation system:', error);
      throw error;
    }
  }

  private mapToDetectionResult(
    localePreference: LocalePreference,
    source: LocaleDetectionResult['source']
  ): LocaleDetectionResult {
    return {
      locale: localePreference.resolvedLocale,
      countryCode: localePreference.countryCode.toString(),
      confidence: localePreference.getConfidence(),
      source,
      timestamp: new Date()
    };
  }

  private async executeFallbackStrategy(): Promise<LocaleDetectionResult> {
    console.log('🔄 Executing fallback strategy...');

    // Try browser language
    const browserLang = this.getBrowserLanguage();

    try {
      await this.applyLocaleToTranslationSystem(browserLang);

      return {
        locale: browserLang,
        countryCode: 'UNKNOWN',
        confidence: 'low',
        source: 'browser-fallback',
        timestamp: new Date()
      };
    } catch (error) {
      // Ultimate fallback: English
      await this.applyLocaleToTranslationSystem('en');

      return {
        locale: 'en',
        countryCode: 'UNKNOWN',
        confidence: 'low',
        source: 'system-default',
        timestamp: new Date()
      };
    }
  }

  private getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';

    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = this.getAvailableLocales();

    return supportedLanguages.includes(browserLang) ? browserLang : 'en';
  }

  private isValidLocale(locale: string): boolean {
    return this.getAvailableLocales().includes(locale);
  }

  private updateStatus(partial: Partial<LocaleDetectionStatus>): void {
    this._status$.next({
      ...this._status$.value,
      ...partial
    });
  }
}
