/**
 * GeoContextService - Core service for managing geographic context state
 * 
 * Responsibilities:
 * - Maintains single source of truth for application location context
 * - Orchestrates location validation workflows
 * - Manages context persistence and cache synchronization
 * - Provides observable state streams for UI components
 * 
 * @version 3.0.0
 * @file src/app/core/geo/domain/services/geo-context.service.ts
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { distinctUntilChanged, map, catchError } from 'rxjs/operators';
import { GeoContext } from '../aggregates/geo-context.model';
import { ManualDetectionStrategy } from '../../infrastructure/detection/manual-detection.strategy';
import { GeoValidator } from './geo.validator';
import { GeoCacheService } from '../../application/services/geo-cache.service';
import { ErrorLogger } from '../../../../shared/services/error-logger.service';
import { ValidationResult, ValidationReason } from '../value-objects/validation-result';

/**
 * Represents the service state containing:
 * - Current geographic context
 * - Operation status
 * - Last update timestamp
 * - Error information (if any)
 */
interface GeoContextState {
  context: GeoContext | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  lastUpdated: Date | null;
  error: {
    reason: ValidationReason;
    metadata?: Record<string, unknown>;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class GeoContextService {
  // Internal state management using BehaviorSubject
  private readonly _state = new BehaviorSubject<GeoContextState>({
    context: null,
    status: 'idle',
    lastUpdated: null,
    error: null
  });

  constructor(
    private readonly manualDetector: ManualDetectionStrategy,
    private readonly validator: GeoValidator,
    private readonly geoCache: GeoCacheService,
    private readonly logger: ErrorLogger
  ) {}

  // ==================== PUBLIC API ====================

  /**
   * Observable stream of current geographic context
   * Emits only when context properties actually change
   * 
   * @returns Observable<GeoContext | null>
   */
  get context$(): Observable<GeoContext | null> {
    return this._state.pipe(
      map(state => state.context),
      distinctUntilChanged((prev, current) => 
        this.areContextsEqual(prev, current)
      )
    );
  }

  /**
   * Observable stream of loading state
   * 
   * @returns Observable<boolean>
   */
  get loading$(): Observable<boolean> {
    return this._state.pipe(
      map(state => state.status === 'loading'),
      distinctUntilChanged()
    );
  }

  /**
   * Observable stream of error state
   * 
   * @returns Observable<ValidationError | null>
   */
  get error$(): Observable<GeoContextState['error']> {
    return this._state.pipe(
      map(state => state.error),
      distinctUntilChanged()
    );
  }

  /**
   * Gets current state snapshot
   * 
   * @returns GeoContextState
   */
  get currentState(): GeoContextState {
    return this._state.value;
  }

  // ==================== CORE OPERATIONS ====================

  /**
   * Initiates manual location selection workflow
   * 
   * Workflow:
   * 1. Activates manual detection strategy
   * 2. Validates selected location
   * 3. Persists valid context
   * 4. Updates application state
   * 
   * @returns Promise<ValidationResult> - Result of location validation
   */
  async setManualLocation(): Promise<ValidationResult> {
    this.updateState({ status: 'loading', error: null });

    try {
      const context = await this.manualDetector.detect();
      const validation = await this.validateContext(context);

      if (validation.isValid) {
        await this.persistAndUpdateContext(context);
        return validation;
      }

      this.handleValidationError(validation);
      return validation;
    } catch (error) {
      return this.handleDetectionError(error);
    }
  }

  /**
   * Initializes service state from cache
   * 
   * @returns Promise<void>
   */
  async initialize(): Promise<void> {
    this.updateState({ status: 'loading' });

    try {
      const cachedContext = await this.loadAndValidateCache();
      if (cachedContext) {
        this.updateState({
          context: cachedContext,
          status: 'success',
          lastUpdated: cachedContext.timestamp
        });
      }
    } catch (error) {
      this.logger.warn('Cache initialization failed', { error });
    } finally {
      if (this.currentState.status === 'loading') {
        this.updateState({ status: 'idle' });
      }
    }
  }

  /**
   * Clears current context and cache
   * 
   * @returns Promise<void>
   */
  async clear(): Promise<void> {
    await this.geoCache.clear();
    this.updateState({
      context: null,
      status: 'idle',
      lastUpdated: new Date(),
      error: null
    });
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Validates geographic context against business rules
   * 
   * @param context - GeoContext to validate
   * @returns Promise<ValidationResult>
   */
  private async validateContext(context: GeoContext): Promise<ValidationResult> {
    return this.validator.validate(context);
  }

  /**
   * Loads and validates cached context
   * 
   * @returns Promise<GeoContext | null>
   */
  private async loadAndValidateCache(): Promise<GeoContext | null> {
    const cachedContext = await this.geoCache.load().toPromise();
    if (!cachedContext) return null;

    const validation = await this.validateContext(cachedContext);
    if (!validation.isValid) {
      await this.geoCache.clear();
      return null;
    }

    return cachedContext;
  }

  /**
   * Persists context to cache and updates state
   * 
   * @param context - GeoContext to persist
   * @returns Promise<void>
   */
  private async persistAndUpdateContext(context: GeoContext): Promise<void> {
    const saveSuccess = this.geoCache.save(context);
    if (!saveSuccess) {
      this.logger.warn('Context cache persistence failed');
    }

    this.updateState({
      context,
      status: 'success',
      lastUpdated: new Date()
    });
  }

  /**
   * Handles validation errors
   * 
   * @param validation - Failed validation result
   */
  private handleValidationError(validation: ValidationResult): void {
    this.updateState({
      status: 'error',
      error: {
        reason: validation.reason ?? ValidationReason.SELECTION_FAILED,
        metadata: validation.metadata
      }
    });
  }

  /**
   * Handles detection errors
   * 
   * @param error - Error object
   * @returns ValidationResult
   */
  private handleDetectionError(error: unknown): ValidationResult {
    const errorResult: ValidationResult = {
      isValid: false,
      reason: ValidationReason.SELECTION_FAILED,
      metadata: { error }
    };

    this.updateState({
      status: 'error',
      error: {
        reason: ValidationReason.SELECTION_FAILED,
        metadata: { error }
      }
    });

    return errorResult;
  }

  /**
   * Updates service state immutably
   * 
   * @param partialState - Partial state update
   */
  private updateState(partialState: Partial<GeoContextState>): void {
    this._state.next({
      ...this.currentState,
      ...partialState
    });
  }

  /**
   * Compares two GeoContext objects for equality
   * 
   * @param a - First context
   * @param b - Second context
   * @returns boolean
   */
  private areContextsEqual(a: GeoContext | null, b: GeoContext | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    
    return (
      a.city.id === b.city.id &&
      a.coordinates.toString() === b.coordinates.toString() &&
      a.source === b.source
    );
  }
}

// ==================== USAGE EXAMPLES ====================
/*
// Service initialization
constructor(private geoContext: GeoContextService) {}

// Component initialization
async ngOnInit() {
  await this.geoContext.initialize();
  this.geoContext.context$.subscribe(context => {
    this.updateMap(context);
  });
}

// Manual location selection
async onLocationSelect() {
  const result = await this.geoContext.setManualLocation();
  if (!result.isValid) {
    this.showErrorMessage(result.reason, result.metadata);
  }
}

// Error handling
this.geoContext.error$.subscribe(error => {
  if (error) {
    this.showErrorToast(error.reason);
  }
});
*/