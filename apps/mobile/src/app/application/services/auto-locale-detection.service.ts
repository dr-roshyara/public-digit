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

import { Injectable, inject, Injector } from '@angular/core';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, tap, catchError, switchMap, shareReplay } from 'rxjs/operators';

// Application layer dependencies
import { DetectUserLocaleUseCase } from '../use-cases/detect-user-locale.use-case';

// Infrastructure dependencies
import { GeoLocationPackageAdapter } from '@infrastructure/adapters/geo-location-package.adapter';
import { IpGeolocationAdapter } from '@infrastructure/adapters/ip-geolocation.adapter';
import { RouteFirstTranslationLoader } from '@infrastructure/services';

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
  // Injector for lazy service access (CRITICAL: breaks circular dependency)
  private injector = inject(Injector);

  // Direct injection for IP geolocation (no circular dependency)
  private ipGeoAdapter = inject(IpGeolocationAdapter);

  // Cached service instances for performance
  private _detectUserLocaleUseCase?: DetectUserLocaleUseCase;
  private _geoAdapter?: GeoLocationPackageAdapter | null;
  private _translationLoader?: RouteFirstTranslationLoader;
  private _geoAdapterAttempted = false;

  /**
   * Get use case (lazy initialization to break circular dependency)
   */
  private getDetectUserLocaleUseCase(): DetectUserLocaleUseCase {
    if (!this._detectUserLocaleUseCase) {
      this._detectUserLocaleUseCase = this.injector.get(DetectUserLocaleUseCase);
    }
    return this._detectUserLocaleUseCase;
  }

  /**
   * Get geo adapter (lazy initialization with proper Angular inject pattern)
   *
   * PRODUCTION FIX: Uses inject() function with optional: true
   * This prevents circular dependency while maintaining geo-location capability
   *
   * PATTERN: Lazy Injection with Optional Fallback
   * - First call attempts to inject the service
   * - If unavailable/circular, returns null
   * - Result is cached for performance
   * - Logs appropriate warnings for debugging
   */
  private getGeoAdapter(): GeoLocationPackageAdapter | null {
    // Return cached result if already attempted
    if (this._geoAdapterAttempted) {
      return this._geoAdapter ?? null;
    }

    // Mark as attempted to prevent repeated injection attempts
    this._geoAdapterAttempted = true;

    try {
      // PRODUCTION PATTERN: Use inject() with optional: true
      // This breaks circular dependency by making the service optional
      this._geoAdapter = this.injector.get(GeoLocationPackageAdapter, null, { optional: true });

      if (this._geoAdapter) {
        console.log('✅ GeoLocationPackageAdapter available - geo-location enabled');
      } else {
        console.log('ℹ️  GeoLocationPackageAdapter not available - using browser fallback only');
      }

      return this._geoAdapter;
    } catch (error) {
      console.warn('⚠️ Failed to inject GeoLocationPackageAdapter:', error);
      this._geoAdapter = null;
      return null;
    }
  }

  /**
   * Get translation loader (lazy initialization to break circular dependency)
   */
  private getTranslationLoader(): RouteFirstTranslationLoader {
    if (!this._translationLoader) {
      this._translationLoader = this.injector.get(RouteFirstTranslationLoader);
    }
    return this._translationLoader;
  }

  // Application state (initialized with static values to avoid circular dependency)
  private readonly _status$ = new BehaviorSubject<LocaleDetectionStatus>({
    isDetecting: false,
    lastDetection: null,
    hasUserPreference: false, // Will be updated during initialization
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
   * NEW WORKFLOW (IP-based):
   * 1. Check user explicit preference first
   * 2. Try IP-based geolocation (fast, no permissions)
   * 3. Optionally use package-based detection (if available)
   * 4. Apply locale to translation system
   * 5. Update application state
   *
   * USAGE: Call from APP_INITIALIZER or component ngOnInit
   */
  async initialize(options: {
    respectUserPreference?: boolean;
    forceRefresh?: boolean;
  } = {}): Promise<LocaleDetectionResult> {
    const { respectUserPreference = true, forceRefresh = false } = options;

    console.log('🌍 Initializing automatic locale detection (IP-based)...', {
      respectUserPreference,
      forceRefresh
    });

    this.updateStatus({ isDetecting: true, error: null });

    try {
      // Step 1: Check user explicit preference
      if (respectUserPreference && this.hasUserExplicitPreference()) {
        const userLocale = localStorage.getItem('user_explicit_locale')!;
        console.log(`✅ Using user explicit preference: ${userLocale}`);

        await this.applyLocaleToTranslationSystem(userLocale);

        const result: LocaleDetectionResult = {
          locale: userLocale,
          countryCode: 'USER',
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

        return result;
      }

      // Step 2: Try IP-based geolocation (PRODUCTION PATTERN: Fast & Privacy-Focused)
      try {
        const ipGeoResult = await this.ipGeoAdapter.detect(forceRefresh).toPromise();

        if (ipGeoResult) {
          const detectedLocale = this.mapIpGeoToLocale(ipGeoResult);
          console.log(`✅ IP geolocation detected locale: ${detectedLocale}`, ipGeoResult);

          await this.applyLocaleToTranslationSystem(detectedLocale);

          const result: LocaleDetectionResult = {
            locale: detectedLocale,
            countryCode: ipGeoResult.country,
            confidence: this.mapConfidenceLevel(ipGeoResult.confidence),
            source: 'geo-auto',
            timestamp: new Date()
          };

          this.updateStatus({
            isDetecting: false,
            lastDetection: result,
            hasUserPreference: false,
            error: null
          });

          return result;
        }
      } catch (ipError) {
        console.warn('⚠️ IP geolocation failed, trying package adapter...', ipError);
      }

      // Step 3: Try package-based detection (if available - optional)
      const geoAdapter = this.getGeoAdapter();
      if (geoAdapter) {
        try {
          await geoAdapter.initialize();

          const localePreference = await this.getDetectUserLocaleUseCase().execute({
            forceRefresh,
            respectUserChoice: respectUserPreference
          });

          const result = this.mapToDetectionResult(localePreference, 'geo-auto');
          await this.applyLocaleToTranslationSystem(result.locale);

          this.updateStatus({
            isDetecting: false,
            lastDetection: result,
            hasUserPreference: false,
            error: null
          });

          console.log('✅ Package-based locale detection completed:', result);
          return result;

        } catch (packageError) {
          console.warn('⚠️ Package-based detection failed, using browser fallback...', packageError);
        }
      }

      // Step 4: Fallback strategy
      const fallbackResult = await this.executeFallbackStrategy();

      this.updateStatus({
        isDetecting: false,
        lastDetection: fallbackResult,
        hasUserPreference: false,
        error: null
      });

      return fallbackResult;

    } catch (error) {
      console.error('❌ Automatic locale detection failed:', error);

      // Ultimate fallback
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
      const geoAdapter = this.getGeoAdapter();
      const success = geoAdapter
        ? await geoAdapter.setUserPreference(locale).toPromise()
        : true; // Assume success if geo-location is disabled

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
      const geoAdapter = this.getGeoAdapter();
      if (geoAdapter) {
        await geoAdapter.clearUserPreference().toPromise();
      }

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
    return this._status$.value.lastDetection?.locale || this.getTranslationLoader().getCurrentLocale() || 'en';
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
    const geoAdapter = this.getGeoAdapter();
    return {
      application: this.getCurrentStatus(),
      infrastructure: geoAdapter ? geoAdapter.getHealthStatus() : { status: 'disabled' }
    };
  }

  // ======== PRIVATE HELPER METHODS ========

  private async applyLocaleToTranslationSystem(locale: string): Promise<void> {
    try {
      console.log(`📝 Applying locale to translation system: ${locale}`);
      await this.getTranslationLoader().setLocale(locale);
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

  /**
   * Map IP geolocation result to locale
   *
   * STRATEGY:
   * 1. Check country-specific language mappings
   * 2. Use primary language from country
   * 3. Fallback to English
   */
  private mapIpGeoToLocale(ipGeo: any): string {
    // Country to locale mapping for supported languages
    const countryToLocale: Record<string, string> = {
      'DE': 'de',  // Germany
      'AT': 'de',  // Austria
      'CH': 'de',  // Switzerland (German-speaking region)
      'NP': 'np',  // Nepal
      'IN': 'en',  // India (English as primary for app)
      'US': 'en',  // United States
      'GB': 'en',  // United Kingdom
      'CA': 'en',  // Canada
      'AU': 'en',  // Australia
      'NZ': 'en',  // New Zealand
    };

    const detectedLocale = countryToLocale[ipGeo.country];

    if (detectedLocale && this.isValidLocale(detectedLocale)) {
      return detectedLocale;
    }

    // Fallback: Check if any detected language is supported
    if (ipGeo.languages && Array.isArray(ipGeo.languages)) {
      for (const lang of ipGeo.languages) {
        const langCode = lang.split('-')[0].toLowerCase();
        if (this.isValidLocale(langCode)) {
          return langCode;
        }
      }
    }

    // Ultimate fallback: English
    return 'en';
  }

  /**
   * Map numeric confidence to categorical level
   */
  private mapConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
  }
}
