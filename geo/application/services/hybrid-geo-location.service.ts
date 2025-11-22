/**
 * HybridGeoLocationService - Core service for location detection
 * 
 * Orchestrates multiple detection strategies in priority order:
 * 1. GPS (high accuracy)
 * 2. IP Geolocation (medium accuracy)
 * 3. WiFi Triangulation (medium accuracy, indoor)
 * 4. Manual selection (fallback)
 *
 * Features:
 * - Chain of Responsibility pattern implementation
 * - State management with reactive updates
 * - Automatic caching with TTL validation
 * - Preloading optimization for related geo data
 * - Comprehensive error recovery with fail-fast
 *
 * Flow:
 * GPS → IP → WiFi → Manual → Fail (if all strategies exhaust)
 *
 * @file app/core/geo/application/services/hybrid-geo-location.service.ts
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, EMPTY, from, of } from 'rxjs';
import { catchError, concatMap, finalize, first, switchMap, tap } from 'rxjs/operators';
import { GeoLocationPort } from '../../domain/ports/geo-location.port';
import { GeoContext } from '../../domain/aggregates/geo-context.model';
import { GeoCacheService } from './geo-cache.service';
import { LocationDetectionError } from '../errors/location-detection.error';
import { GeoSource } from '../../domain/constants/geo-source.constants';

/**
 * Represents the service state at any given moment
 */
interface GeoState {
  context: GeoContext | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  lastUpdated: Date | null;
  activeSource?: GeoSource | null;
  error?: LocationDetectionError | null;
}

@Injectable({ providedIn: 'root' })
export class HybridGeoLocationService implements GeoLocationPort {
  private readonly _state = new BehaviorSubject<GeoState>({
    context: null,
    status: 'idle',
    lastUpdated: null,
    activeSource: null,
    error: null
  });

  /**
   * Ordered strategy chain (highest accuracy first)
   * - GPS: ~5-100m accuracy
   * - IP: ~1-50km accuracy
   * - WiFi: ~50-500m accuracy
   * - Manual: User-defined
   */
  private readonly strategyChain: GeoLocationPort[];

  constructor(
    private readonly gpsStrategy: GeoLocationPort,
    private readonly ipStrategy: GeoLocationPort,
    private readonly wifiStrategy: GeoLocationPort,
    private readonly manualStrategy: GeoLocationPort,
    private readonly cache: GeoCacheService
  ) {
    this.strategyChain = [
      gpsStrategy,
      ipStrategy,
      wifiStrategy,
      manualStrategy
    ];
  }

  /**
   * Main location detection entry point
   *
   * Workflow:
   * 1. Check valid cache (if cachePolicy !== 'fresh')
   * 2. Execute strategy chain until first success
   * 3. Update application state reactively
   * 4. Cache successful results
   * 5. Handle errors with proper state transitions
   *
   * @param options Configuration:
   *   - cachePolicy: 'fresh' | 'cached' | 'any' (default: 'any')
   *   - timeout: Overall operation timeout in ms
   * @returns Observable<GeoContext | null>
   */
  fetchGeoContext(options?: {
    cachePolicy?: 'fresh' | 'cached' | 'any';
    timeout?: number;
  }): Observable<GeoContext | null> {
    this.setState({ status: 'loading', error: null });

    return this.attemptCacheFirst(options?.cachePolicy).pipe(
      switchMap(cached => cached
        ? this.handleCachedContext(cached)
        : this.executeStrategyChain(options)
      ),
      catchError(error => this.handleDetectionError(error)),
      finalize(() => this.setState({ status: 'idle' }))
    );
  }

  /**
   * Checks if any detection strategy is available
   * @returns boolean indicating if location detection is possible
   */
  isAvailable(): boolean {
    return this.strategyChain.some(strategy => strategy.isAvailable());
  }

  // ==================== PUBLIC OBSERVABLES ====================

  /** Observable stream of geo state changes */
  get state$(): Observable<GeoState> {
    return this._state.asObservable();
  }

  /** Current state snapshot */
  get currentState(): GeoState {
    return this._state.value;
  }

  // ==================== PRIVATE IMPLEMENTATION ====================

  /**
   * Attempts to load from cache based on policy
   * @param cachePolicy Determines cache freshness requirements
   */
  private attemptCacheFirst(cachePolicy?: string): Observable<GeoContext | null> {
    if (cachePolicy === 'fresh') return of(null);

    return this.cache.load().pipe(
      first(context =>
        context !== null &&
        (cachePolicy !== 'cached' || context.isFresh())
      ),
      catchError(() => of(null)) // Silently handle cache errors
    );
  }

  /**
   * Executes the strategy chain until first success
   */
  private executeStrategyChain(options?: {
    timeout?: number;
  }): Observable<GeoContext> {
    return from(this.strategyChain).pipe(
      concatMap(strategy =>
        strategy.fetchGeoContext(options).pipe(
          tap(context => this.handleSuccess(strategy.source, context)),
          catchError(error => this.handleStrategyError(strategy.source, error))
        )
      ),
      first(context => context !== null),
      tap(context => this.cacheContext(context!)),
      catchError(() => this.handleChainExhaustion())
    );
  }

  /**
   * Handles successful detection
   */
  private handleSuccess(source: GeoSource, context: GeoContext): void {
    this.setState({
      context,
      status: 'success',
      activeSource: source,
      lastUpdated: new Date()
    });
    this.preloadRelatedData(context);
  }

  /**
   * Handles individual strategy failure
   */
  private handleStrategyError(source: GeoSource, error: any): Observable<never> {
    const detectionError = error instanceof LocationDetectionError
      ? error
      : new LocationDetectionError(source, 'STRATEGY_FAILED');

    this.logDetectionFailure(source, detectionError);
    return EMPTY; // Continue to next strategy
  }

  /**
   * Handles complete chain failure
   */
  private handleChainExhaustion(): Observable<never> {
    const error = new LocationDetectionError(
      'hybrid',
      'ALL_STRATEGIES_FAILED',
      { strategies: this.strategyChain.map(s => s.source) }
    );
    this.setState({ status: 'error', error });
    throw error;
  }

  /**
   * Handles cached context
   */
  private handleCachedContext(cached: GeoContext): Observable<GeoContext> {
    this.setState({
      context: cached,
      status: 'success',
      activeSource: cached.source,
      lastUpdated: cached.timestamp
    });
    this.preloadRelatedData(cached);
    return of(cached);
  }

  /**
   * Preloads geographical data around the detected location
   */
  private preloadRelatedData(context: GeoContext): void {
    if (!context.isServiceable) return;

    // Fire-and-forget for nearby cities
    this.geoRepo.getCitiesWithinRadius(
      context.coordinates,
      50, // 50km radius
      { onlyActive: true, limit: 5 }
    ).pipe(first()).subscribe();
  }

  /**
   * Caches the context with timestamp
   */
  private cacheContext(context: GeoContext): void {
    try {
      this.cache.save(context);
    } catch (error) {
      console.warn('Failed to cache location', error);
    }
  }

  /**
   * Centralized error handler
   */
  private handleDetectionError(error: any): Observable<null> {
    const detectionError = error instanceof LocationDetectionError
      ? error
      : new LocationDetectionError('hybrid', 'UNKNOWN_ERROR');

    this.setState({
      status: 'error',
      error: detectionError
    });

    return of(null);
  }

  /**
   * Logs strategy failures for analytics
   */
  private logDetectionFailure(source: GeoSource, error: LocationDetectionError): void {
    console.warn(`[${source}] Detection attempt failed`, {
      code: error.code,
      recoverable: error.isRecoverable,
      metadata: error.metadata
    });
  }

  /**
   * Updates the current state
   */
  private setState(partialState: Partial<GeoState>): void {
    this._state.next({
      ...this.currentState,
      ...partialState,
      lastUpdated: new Date()
    });
  }
}

// ==================== USAGE EXAMPLES ====================
//
// // Basic usage with caching
// this.geoLocation.fetchGeoContext().subscribe(context => {
//   if (context) {
//     this.displayLocation(context);
//   }
// });
//
// // Force fresh detection
// this.geoLocation.fetchGeoContext({ cachePolicy: 'fresh' });
//
// // Monitor state changes
// this.geoLocation.state$.subscribe(state => {
//   switch(state.status) {
//     case 'loading': showSpinner(); break;
//     case 'success': updateMap(state.context!); break;
//     case 'error': showError(state.error!); break;
//   }
// });