/**
 * GeoLocationPackageAdapter - Infrastructure Adapter
 *
 * DDD INFRASTRUCTURE LAYER - Adapts external geo-location package to domain interfaces
 *
 * PURPOSE:
 * - Anti-Corruption Layer between mobile app domain and geo-location package
 * - Translates package types to domain value objects
 * - Handles external service failures gracefully
 * - Maintains dependency inversion (domain doesn't depend on infrastructure)
 *
 * ARCHITECTURE:
 * Domain → Port (Interface) ← Adapter (Infrastructure) → External Package
 */

import { Injectable, inject } from '@angular/core';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';

// External package (infrastructure dependency)
import {
  GeoTranslationBridgeService,
  MultiLayerCacheService,
  CountryCode as PackageCountryCode,
  LocalePreference as PackageLocalePreference
} from '@public-digit-platform/geo-location';

// Domain interfaces (what our domain expects)
import { LocalePreference } from '@domain/geo-location/value-objects/locale-preference.vo';
import { CountryCode } from '@domain/geo-location/value-objects/country-code.vo';

/**
 * Detection result from external package (infrastructure concern)
 */
export interface GeoDetectionResult {
  detectedLocale: string;
  confidence: number;
  countryCode?: string;
  source: 'geo' | 'browser' | 'history' | 'fallback';
  performanceMetrics?: {
    detectionTimeMs: number;
    cacheHit: boolean;
    fallbackUsed: boolean;
  };
}

/**
 * Infrastructure adapter that connects mobile app to geo-location package
 *
 * RESPONSIBILITIES:
 * - Translate between package types and domain types
 * - Handle package initialization
 * - Provide domain-friendly API
 * - Manage external service lifecycle
 */
@Injectable({ providedIn: 'root' })
export class GeoLocationPackageAdapter {
  // External services (injected, not created)
  private bridgeService = inject(GeoTranslationBridgeService);
  private cacheService = inject(MultiLayerCacheService);

  private readonly _initialized$ = new BehaviorSubject<boolean>(false);

  /**
   * Observable indicating if adapter is initialized
   */
  get initialized$(): Observable<boolean> {
    return this._initialized$.asObservable();
  }

  /**
   * Initialize the geo-location package
   *
   * IMPORTANT: Call this during app initialization (APP_INITIALIZER)
   */
  async initialize(): Promise<void> {
    if (this._initialized$.value) {
      console.log('🌍 GeoLocationPackageAdapter already initialized');
      return;
    }

    try {
      console.log('🌍 Initializing GeoLocationPackageAdapter...');

      // Cache service initialization (if available and has public init method)
      // Note: warmCommonPatterns is private, so we don't call it directly
      // The cache service will initialize itself when first used

      this._initialized$.next(true);
      console.log('✅ GeoLocationPackageAdapter initialized successfully');

    } catch (error) {
      console.warn('⚠️ GeoLocationPackageAdapter initialization had issues:', error);
      // Continue anyway - fallbacks will handle failures
      this._initialized$.next(true);
    }
  }

  /**
   * Detect user's locale using geo-location package
   *
   * RETURNS: Domain LocalePreference value object
   * TRANSLATION: Package types → Domain types
   */
  detectUserLocale(): Observable<LocalePreference> {
    return from(this.ensureInitialized()).pipe(
      switchMap(() => this.bridgeService.initializeAutomaticLanguageDetection()),
      map(detectedLocale => {
        // Translate package result to domain value object
        const countryCode = this.extractCountryCodeFromBridge();
        return LocalePreference.create(countryCode, detectedLocale);
      }),
      catchError(error => {
        console.error('❌ Geo-detection failed in adapter:', error);

        // Fallback to browser language
        const browserLang = this.getBrowserLanguage();
        const fallbackCountry = CountryCode.create('US');
        return of(LocalePreference.create(fallbackCountry, browserLang));
      }),
      shareReplay(1) // Cache the latest result
    );
  }

  /**
   * Get detailed detection result with confidence scores
   *
   * RETURNS: Infrastructure-level detail (not exposed to domain)
   */
  getDetectionResult(): Observable<GeoDetectionResult> {
    return this.bridgeService.state$.pipe(
      map(state => ({
        detectedLocale: state.detectedLocale,
        confidence: this.mapConfidenceToNumber(state.confidence),
        countryCode: state.currentLocale, // Approximation
        source: this.mapSource(state.source),
        performanceMetrics: state.performanceMetrics
      }))
    );
  }

  /**
   * Manually set user's locale preference
   *
   * INPUT: Domain value (language code)
   * OUTPUT: Success/failure observable
   */
  setUserPreference(languageCode: string): Observable<boolean> {
    return this.bridgeService.setLanguagePreference(languageCode).pipe(
      tap(success => {
        if (success) {
          console.log(`✅ User preference set to: ${languageCode}`);
        } else {
          console.warn(`⚠️ Failed to set user preference: ${languageCode}`);
        }
      }),
      catchError(error => {
        console.error('❌ Error setting user preference:', error);
        return of(false);
      })
    );
  }

  /**
   * Clear user's explicit preference and re-enable auto-detection
   */
  clearUserPreference(): Observable<string> {
    return this.bridgeService.clearUserPreference().pipe(
      tap(locale => {
        console.log(`🔄 User preference cleared, detected locale: ${locale}`);
      }),
      catchError(error => {
        console.error('❌ Error clearing user preference:', error);
        return of('en'); // Fallback
      })
    );
  }

  /**
   * Get health status for monitoring
   *
   * USAGE: For admin dashboard, logging, debugging
   */
  getHealthStatus(): {
    circuitBreaker: any;
    cacheStats: any;
    initialized: boolean;
  } {
    return {
      circuitBreaker: this.bridgeService.getCircuitBreakerState(),
      cacheStats: this.cacheService ? {} : {}, // Cache service might not have stats
      initialized: this._initialized$.value
    };
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics() {
    return this.bridgeService.getMetrics();
  }

  // ======== PRIVATE HELPER METHODS ========

  private async ensureInitialized(): Promise<void> {
    if (!this._initialized$.value) {
      await this.initialize();
    }
  }

  private extractCountryCodeFromBridge(): CountryCode {
    // Since bridge service doesn't expose country code directly,
    // we need to infer it from state or use a fallback
    const state = this.bridgeService.getCircuitBreakerState();

    // Try to get from localStorage (where it might be cached)
    if (typeof localStorage !== 'undefined') {
      const cachedCountry = localStorage.getItem('detected_country_code');
      if (cachedCountry) {
        try {
          return CountryCode.create(cachedCountry);
        } catch {
          // Invalid country code, continue to fallback
        }
      }
    }

    // Fallback: Infer from browser language
    return this.inferCountryFromBrowser();
  }

  private inferCountryFromBrowser(): CountryCode {
    if (typeof navigator === 'undefined') {
      return CountryCode.create('US');
    }

    const browserLang = navigator.language.toLowerCase();

    // Common language → country mappings
    if (browserLang.includes('np') || browserLang.includes('ne-np')) {
      return CountryCode.create('NP');
    }
    if (browserLang.includes('de-de')) {
      return CountryCode.create('DE');
    }
    if (browserLang.includes('de-at')) {
      return CountryCode.create('AT');
    }
    if (browserLang.includes('de-ch')) {
      return CountryCode.create('CH');
    }

    // Default fallback
    return CountryCode.create('US');
  }

  private getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';

    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = ['en', 'de', 'np'];

    return supportedLanguages.includes(browserLang) ? browserLang : 'en';
  }

  private mapConfidenceToNumber(confidence: 'high' | 'medium' | 'low'): number {
    const confidenceMap = {
      high: 0.9,
      medium: 0.7,
      low: 0.5
    };
    return confidenceMap[confidence] || 0.5;
  }

  private mapSource(source: string): 'geo' | 'browser' | 'history' | 'fallback' {
    if (source === 'geo-detection') return 'geo';
    if (source === 'browser') return 'browser';
    if (source === 'user-preference') return 'history';
    return 'fallback';
  }
}

/**
 * Import statement for switchMap (was missing)
 */
import { switchMap } from 'rxjs/operators';
