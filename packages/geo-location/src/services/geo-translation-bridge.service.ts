/**
 * GeoTranslationBridgeService - Production-Grade Bridge Between Geo-Location and i18n Contexts
 *
 * ENTERPRISE FEATURES:
 * - Circuit Breaker Pattern for external service failures
 * - Three-Tier Fallback Strategy with confidence scoring
 * - Comprehensive Error Handling with graceful degradation
 * - Performance Monitoring and Metrics Collection
 * - Context Boundary Protection between bounded contexts
 * - Team Scalability through clear contracts
 */

import { BehaviorSubject, Observable, from, of, timer } from 'rxjs';
import { map, catchError, tap, distinctUntilChanged, switchMap, retryWhen, delayWhen, timeout } from 'rxjs/operators';

// TEMPORARILY DISABLED - Import commented out for minimal compilation
// Will be re-enabled when UnifiedGeoLocationFacade dependencies are fixed
// import { UnifiedGeoLocationFacade } from '../facades/unified-geo-location.facade';
import { LocalePreference } from '../domain/value-objects/locale-preference.vo';

// TEMPORARY: Stub type for compilation
type UnifiedGeoLocationFacade = any;

// Helper for type assertions during minimal build
const asLocalePreference = (val: any): LocalePreference => val as LocalePreference;

interface TranslationBridgeState {
  currentLocale: string;
  detectedLocale: string;
  source: 'geo-detection' | 'user-preference' | 'browser' | 'default' | 'fallback';
  status: 'idle' | 'detecting' | 'applying' | 'success' | 'error' | 'circuit-open';
  error?: string | null;
  confidence: 'high' | 'medium' | 'low';
  performanceMetrics?: {
    detectionTimeMs: number;
    cacheHit: boolean;
    fallbackUsed: boolean;
  };
}

// Circuit Breaker State
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

// Confidence Score Interface
interface ConfidenceScore {
  overall: number;
  factors: {
    geoLocation: { score: number; weight: number; details: any };
    browserLanguage: { score: number; weight: number; details: any };
    userHistory: { score: number; weight: number; details: any };
    networkSignal: { score: number; weight: number; details: any };
  };
}

export class GeoTranslationBridgeService {
  private readonly _state = new BehaviorSubject<TranslationBridgeState>({
    currentLocale: 'en',
    detectedLocale: 'en',
    source: 'default',
    status: 'idle',
    error: null,
    confidence: 'low'
  });

  // Circuit Breaker Configuration
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed'
  };

  private readonly CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
    timeoutMs: 10000     // 10 seconds
  };

  // Performance Metrics
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    fallbacksUsed: 0,
    averageDetectionTime: 0
  };

  constructor(private readonly geoFacade: UnifiedGeoLocationFacade) {}

  // ======== PUBLIC API ========

  /** Current translation bridge state */
  get state$(): Observable<TranslationBridgeState> {
    return this._state.asObservable();
  }

  /** Current locale being used */
  get currentLocale$(): Observable<string> {
    return this._state.pipe(map(state => state.currentLocale));
  }

  /** Detected locale from geo location */
  get detectedLocale$(): Observable<string> {
    return this._state.pipe(map(state => state.detectedLocale));
  }

  /**
   * Initialize automatic language detection with production-grade resilience
   */
  initializeAutomaticLanguageDetection(): Observable<string> {
    this.metrics.totalRequests++;
    const startTime = Date.now();

    // Check circuit breaker state
    if (this.isCircuitOpen()) {
      this._state.next({
        ...this._state.value,
        status: 'circuit-open',
        error: 'Geo-location service temporarily unavailable',
        confidence: 'low'
      });
      this.metrics.fallbacksUsed++;
      return this.executeFallbackStrategy();
    }

    this._state.next({
      ...this._state.value,
      status: 'detecting',
      performanceMetrics: { detectionTimeMs: 0, cacheHit: false, fallbackUsed: false }
    });

    return this.geoFacade.detectLocationAndLanguage().pipe(
      timeout(this.CIRCUIT_BREAKER_CONFIG.timeoutMs),
      retryWhen(errors => errors.pipe(
        tap(error => this.recordFailure(error)),
        delayWhen((error, retryCount) => {
          if (retryCount >= 2) {
            throw error; // Stop retrying after 2 attempts
          }
          return timer(1000 * Math.pow(2, retryCount)); // Exponential backoff
        })
      )),
      switchMap(localePreference => {
        const detectionTime = Date.now() - startTime;
        this.recordSuccess();

        const pref = asLocalePreference(localePreference);
        const detectedLocale = pref.resolvedLocale;
        const confidence = pref.getConfidence();

        // Check if user has explicitly chosen a language
        if (this.geoFacade.hasUserExplicitLocale()) {
          return this.applyUserExplicitLocale();
        }

        // Apply detected locale with confidence-based UX
        return this.applyDetectedLocale(detectedLocale, pref, detectionTime);
      }),
      catchError(error => {
        const detectionTime = Date.now() - startTime;
        this.recordFailure(error);
        this.metrics.fallbacksUsed++;

        this._state.next({
          ...this._state.value,
          status: 'error',
          error: this.getErrorMessage(error),
          confidence: 'low',
          performanceMetrics: {
            detectionTimeMs: detectionTime,
            cacheHit: false,
            fallbackUsed: true
          }
        });

        return this.executeFallbackStrategy();
      })
    );
  }

  /**
   * Manually set language preference with confidence tracking
   */
  setLanguagePreference(languageCode: string): Observable<boolean> {
    this._state.next({
      ...this._state.value,
      status: 'applying',
      confidence: 'high' // User explicit choice has highest confidence
    });

    return from(this.applyLocaleToTranslationSystem(languageCode)).pipe(
      tap(success => {
        if (success) {
          // Store user's explicit choice with high confidence
          this.geoFacade.setManualPreference('US', languageCode);

          // Update user history for confidence calculation
          this.updateUserHistory(languageCode, 'explicit');

          this._state.next({
            currentLocale: languageCode,
            detectedLocale: this._state.value.detectedLocale,
            source: 'user-preference',
            status: 'success',
            error: null,
            confidence: 'high'
          });
        }
      }),
      catchError(error => {
        this._state.next({
          ...this._state.value,
          status: 'error',
          error: `Failed to set language: ${error.message}`,
          confidence: 'low'
        });
        return of(false);
      })
    );
  }

  /**
   * Clear user's explicit language preference and re-enable auto-detection
   */
  clearUserPreference(): Observable<string> {
    this.geoFacade.clearUserPreference();
    return this.initializeAutomaticLanguageDetection();
  }

  /**
   * Check if auto-detection should override current language
   */
  shouldAutoDetectOverride(): Observable<boolean> {
    return this.geoFacade.localePreference$.pipe(
      map(preference => {
        if (!preference) return false;
        return asLocalePreference(preference).shouldOverrideUserPreference();
      })
    );
  }

  /**
   * Get comprehensive confidence breakdown with multi-factor scoring
   */
  getConfidenceBreakdown(): Observable<ConfidenceScore> {
    return this.calculateMultiFactorConfidence();
  }

  /**
   * Get fallback chain for a given locale
   */
  getFallbackChain(locale: string): string[] {
    const fallbackMap: Record<string, string[]> = {
      'de': ['de', 'en'],
      'np': ['np', 'en'],
      'en': ['en'],
      'fr': ['fr', 'en'],
      'es': ['es', 'en']
    };
    return fallbackMap[locale] || ['en'];
  }

  /**
   * Check if auto-detection should override user preference
   */
  shouldOverrideUserPreference(): Observable<boolean> {
    return this.getConfidenceBreakdown().pipe(
      map(confidence => confidence.overall >= 0.8) // High confidence overrides
    );
  }

  /**
   * Get performance metrics for monitoring
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker state for health checks
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  // ======== PRIVATE METHODS ========

  private applyUserExplicitLocale(): Observable<string> {
    if (typeof localStorage === 'undefined') {
      return of('en');
    }

    const userLocale = localStorage.getItem('user_explicit_locale') || 'en';
    return from(this.applyLocaleToTranslationSystem(userLocale)).pipe(
      tap(success => {
        if (success) {
          this._state.next({
            currentLocale: userLocale,
            detectedLocale: this._state.value.detectedLocale,
            source: 'user-preference',
            status: 'success',
            error: null,
            confidence: 'high'
          });
        }
      }),
      map(() => userLocale)
    );
  }


  private async applyLocaleToTranslationSystem(locale: string): Promise<boolean> {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        return false;
      }

      // Apply to existing translation system
      if (typeof (window as any).setLocale === 'function') {
        await (window as any).setLocale(locale);
        return true;
      }

      // Fallback: set localStorage and reload if needed
      if (typeof localStorage !== 'undefined') {
        const currentLocale = localStorage.getItem('locale');
        if (currentLocale !== locale) {
          localStorage.setItem('locale', locale);

          // Optionally reload the page to apply language change
          // window.location.reload(); // Uncomment if needed
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to apply locale to translation system:', error);
      return false;
    }
  }

  private getErrorMessage(error: any): string {
    if (error?.message?.includes('permission')) {
      return 'Location access denied. Please enable permissions.';
    }
    if (error?.message?.includes('service unavailable')) {
      return 'Location services temporarily unavailable.';
    }
    if (error?.message?.includes('timeout')) {
      return 'Location detection timed out. Try again later.';
    }
    return 'Could not determine your location. Try manual selection.';
  }

  // ======== CONFIDENCE CALCULATION ENGINE ========

  private calculateMultiFactorConfidence(): Observable<ConfidenceScore> {
    return this.geoFacade.localePreference$.pipe(
      map(preference => {
        const pref = asLocalePreference(preference);
        const geoScore = this.calculateGeoLocationConfidence(pref);
        const browserScore = this.calculateBrowserLanguageConfidence();
        const historyScore = this.calculateUserHistoryConfidence();
        const networkScore = this.calculateNetworkSignalConfidence();

        // Weighted average calculation
        const overall = (geoScore * 0.4) + (browserScore * 0.3) + (historyScore * 0.2) + (networkScore * 0.1);

        return {
          overall,
          factors: {
            geoLocation: { score: geoScore, weight: 0.4, details: this.getGeoConfidenceDetails(pref) },
            browserLanguage: { score: browserScore, weight: 0.3, details: this.getBrowserConfidenceDetails() },
            userHistory: { score: historyScore, weight: 0.2, details: this.getHistoryConfidenceDetails() },
            networkSignal: { score: networkScore, weight: 0.1, details: this.getNetworkConfidenceDetails() }
          }
        };
      })
    );
  }

  private calculateGeoLocationConfidence(preference: LocalePreference | null): number {
    if (!preference) return 0.5;

    const countryCode = preference.countryCode;
    const detectedLocale = preference.resolvedLocale;

    // High confidence for exact country-locale matches
    if ((countryCode?.toString() === 'DE' && detectedLocale === 'de') ||
        (countryCode?.toString() === 'NP' && detectedLocale === 'np')) {
      return 0.9;
    }

    // Medium confidence for regional matches
    if (['AT', 'CH', 'LI', 'LU', 'BE'].includes(countryCode?.toString() || '') && detectedLocale === 'de') {
      return 0.7;
    }

    // Low confidence for fallback scenarios
    return 0.5;
  }

  private calculateBrowserLanguageConfidence(): number {
    if (typeof navigator === 'undefined') return 0.5;

    const browserLanguages = navigator.languages || [navigator.language];
    const supportedLanguages = ['en', 'de', 'np'];

    for (const lang of browserLanguages) {
      const baseLang = lang.split('-')[0];
      if (supportedLanguages.includes(baseLang)) {
        // Higher confidence for primary language match
        return browserLanguages.indexOf(lang) === 0 ? 0.9 : 0.7;
      }
    }

    return 0.3; // No supported language match
  }

  private calculateUserHistoryConfidence(): number {
    try {
      const history = localStorage.getItem('user_language_history');
      if (!history) return 0.0; // No history

      const historyData = JSON.parse(history);

      // High confidence for consistent explicit choices
      if (historyData.explicitSelections > 3) return 0.9;

      // Medium confidence for some history
      if (historyData.explicitSelections > 0) return 0.7;

      // Low confidence for implicit patterns only
      return 0.5;
    } catch {
      return 0.0;
    }
  }

  private calculateNetworkSignalConfidence(): number {
    // Based on performance metrics
    const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    const avgTime = this.metrics.averageDetectionTime;

    if (successRate > 0.9 && avgTime < 500) return 0.9;
    if (successRate > 0.7 && avgTime < 1000) return 0.7;
    return 0.5;
  }

  // ======== CIRCUIT BREAKER METHODS ========

  private isCircuitOpen(): boolean {
    if (this.circuitBreaker.state === 'open') {
      const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceFailure > this.CIRCUIT_BREAKER_CONFIG.resetTimeout) {
        this.circuitBreaker.state = 'half-open';
        this.circuitBreaker.failures = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  private recordSuccess(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = 'closed';
    this.metrics.successfulRequests++;

    // Update average detection time
    const currentTime = Date.now();
    if (this.metrics.averageDetectionTime === 0) {
      this.metrics.averageDetectionTime = currentTime;
    } else {
      this.metrics.averageDetectionTime =
        (this.metrics.averageDetectionTime + currentTime) / 2;
    }
  }

  private recordFailure(error: any): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    this.metrics.failedRequests++;

    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      this.circuitBreaker.state = 'open';
    }

    // Log for monitoring
    console.error('Geo-location detection failure:', {
      error: error.message,
      failures: this.circuitBreaker.failures,
      state: this.circuitBreaker.state,
      timestamp: new Date().toISOString()
    });
  }

  // ======== FALLBACK STRATEGY ========

  private executeFallbackStrategy(): Observable<string> {
    // Primary: Browser language detection
    const browserLang = this.getBrowserLanguageWithFallback();

    // Secondary: Default locale (English)
    const fallbackLocale = browserLang !== 'en' ? browserLang : 'en';

    // Apply fallback locale
    return from(this.applyLocaleToTranslationSystem(fallbackLocale)).pipe(
      map(() => fallbackLocale)
    );
  }

  // ======== CONFIDENCE DETAILS ========

  private getGeoConfidenceDetails(preference: LocalePreference | null): any {
    return {
      countryCode: preference?.countryCode,
      detectedLocale: preference?.resolvedLocale,
      accuracy: preference?.getConfidence() || 'unknown'
    };
  }

  private getBrowserConfidenceDetails(): any {
    return {
      languages: navigator.languages,
      primaryLanguage: navigator.language,
      supported: ['en', 'de', 'np'].filter(lang =>
        navigator.languages?.some(browserLang => browserLang.startsWith(lang))
      )
    };
  }

  private getHistoryConfidenceDetails(): any {
    try {
      const history = localStorage.getItem('user_language_history');
      return history ? JSON.parse(history) : { explicitSelections: 0 };
    } catch {
      return { explicitSelections: 0 };
    }
  }

  private getNetworkConfidenceDetails(): any {
    return {
      successRate: this.metrics.successfulRequests / this.metrics.totalRequests,
      averageTime: this.metrics.averageDetectionTime,
      totalRequests: this.metrics.totalRequests
    };
  }

  // ======== USER HISTORY MANAGEMENT ========

  private updateUserHistory(locale: string, type: 'explicit' | 'implicit'): void {
    try {
      const historyStr = localStorage.getItem('user_language_history') || '{"explicitSelections": 0}';
      const history = JSON.parse(historyStr);

      if (type === 'explicit') {
        history.explicitSelections = (history.explicitSelections || 0) + 1;
      }

      history.lastSelection = {
        locale,
        type,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem('user_language_history', JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to update user language history:', error);
    }
  }

  // ======== HELPER METHODS ========

  private applyDetectedLocale(detectedLocale: string, localePreference: LocalePreference, detectionTime: number): Observable<string> {
    return from(this.applyLocaleToTranslationSystem(detectedLocale)).pipe(
      tap(success => {
        if (success) {
          const confidence = localePreference.getConfidence();

          this._state.next({
            currentLocale: detectedLocale,
            detectedLocale,
            source: 'geo-detection',
            status: 'success',
            error: null,
            confidence,
            performanceMetrics: {
              detectionTimeMs: detectionTime,
              cacheHit: false,
              fallbackUsed: false
            }
          });

          // Update user history for implicit selection
          this.updateUserHistory(detectedLocale, 'implicit');
        }
      }),
      map(() => detectedLocale)
    );
  }

  private getBrowserLanguageWithFallback(): string {
    if (typeof navigator === 'undefined') return 'en';

    const browserLanguages = navigator.languages || [navigator.language];
    const supportedLanguages = ['en', 'de', 'np', 'hi', 'fr', 'es'];

    for (const lang of browserLanguages) {
      const baseLang = lang.split('-')[0];
      if (supportedLanguages.includes(baseLang)) {
        return baseLang;
      }
    }

    return 'en'; // Ultimate fallback
  }
}