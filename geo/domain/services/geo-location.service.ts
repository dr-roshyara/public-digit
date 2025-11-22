/**
 * GeoContextService - Core service for managing geographic context state
 *
 * Responsibilities:
 * - Maintains single source of truth for application location context
 * - Orchestrates location detection and validation workflows
 * - Manages context persistence and cache synchronization
 * - Provides observable state streams for UI components
 *
 * @version 2.2.0
 * @file src/app/core/geo/domain/services/geo-context.service.ts
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { GeoContext } from '../aggregates/geo-context.model';
import { ManualDetectionStrategy } from '../../infrastructure/detection/manual-detection.strategy';
import { GeoValidator } from './geo.validator';
import { GeoCacheService } from '../../application/services/geo-cache.service';
import { ValidationReason } from '../constants/geo-validation.constants';
import { ErrorLogger } from '../../../../shared/services/error-logger.service';
import { ValidationResult } from '../value-objects/validation-result';

interface GeoContextState {
  context: GeoContext | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  lastUpdated: Date | null;
  error?: {
    reason: ValidationReason;
    metadata?: Record<string, unknown>;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class GeoContextService {
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
   * Current geographic context observable
   * Emits only when context properties actually change
   */
  get context$(): Observable<GeoContext | null> {
    return this._state.pipe(
      map(state => state.context),
      distinctUntilChanged((prev, current) => 
        this.isContextEqual(prev, current)
      )
    );
  }

  /**
   * Loading state observable
   */
  get loading$(): Observable<boolean> {
    return this._state.pipe(
      map(state => state.status === 'loading'),
      distinctUntilChanged()
    );
  }

  /**
   * Error state observable
   */
  get error$(): Observable<GeoContextState['error']> {
    return this._state.pipe(
      map(state => state.error),
      distinctUntilChanged()
    );
  }

  /**
   * Current state snapshot
   */
  get snapshot(): GeoContextState {
    return this._state.value;
  }

  // ==================== CORE METHODS ====================

  /**
   * Initiates manual location selection workflow
   * 
   * @returns Promise<ValidationResult> - Result of location validation
   */
  async setManualLocation(): Promise<ValidationResult> {
    this.updateState({ status: 'loading', error: null });

    try {
      const context = await this.manualDetector.detect();
      const validation = await this.validator.validate(context);

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
   */
  async initialize(): Promise<void> {
    this.updateState({ status: 'loading' });

    try {
      const cachedContext = await this.loadValidatedCache();
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
      if (this.snapshot.status === 'loading') {
        this.updateState({ status: 'idle' });
      }
    }
  }

  /**
   * Clears current context and cache
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

  private async loadValidatedCache(): Promise<GeoContext | null> {
    const cachedContext = await this.geoCache.load().toPromise();
    if (!cachedContext) return null;

    const validation = await this.validator.validate(cachedContext);
    if (!validation.isValid) {
      await this.geoCache.clear();
      return null;
    }

    return cachedContext;
  }

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

  private handleValidationError(validation: ValidationResult): void {
    this.updateState({
      status: 'error',
      error: {
        reason: validation.reason ?? ValidationReason.SELECTION_FAILED,
        metadata: validation.metadata
      }
    });
  }

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

  private updateState(partialState: Partial<GeoContextState>): void {
    this._state.next({
      ...this.snapshot,
      ...partialState
    });
  }

  private isContextEqual(a: GeoContext | null, b: GeoContext | null): boolean {
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