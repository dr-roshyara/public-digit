/**
 * GeoLocationFacade - Centralized Geo Location Management
 *
 * Provides a unified interface for:
 * - Hybrid location detection (GPS/IP/WiFi)
 * - Location validation and caching
 * - Reactive state management
 * - Country/city service area lookup
 *
 * @file src/app/core/geo/application/facades/geo-location.facade.ts
 */

import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { switchMap, tap, catchError, map, distinctUntilChanged } from 'rxjs/operators';

import { GeoContext } from '../../domain/aggregates/geo-context.model';
import { GeoLocationPort } from '../../domain/ports/geo-location.port';
import { IGeoRepository } from '../../domain/ports/igeo.repository';
import { GeoValidator } from '../../domain/services/geo.validator';
import { GeoCacheService } from '../services/geo-cache.service';
import { Country } from '../../domain/entities/country.entity';
import { City } from '../../domain/entities/city.entity';
import { ValidationResult } from '../../domain/value-objects/validation-result';
import {GEO_LOCATION_PORT } from '../../domain/ports/geo-location.token';


interface LocationState {
  context: GeoContext | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  source?: string;
  error?: string | null;
}

@Injectable({ providedIn: 'root' })
export class GeoLocationFacade {
  private readonly _state = new BehaviorSubject<LocationState>({
    context: null,
    status: 'idle',
    error: null
  });

  constructor(
      @Inject(GEO_LOCATION_PORT) private readonly geoLocation: GeoLocationPort,
    private readonly geoRepo: IGeoRepository,
    private readonly validator: GeoValidator,
    private readonly cache: GeoCacheService
  ) {}

  // ======== PUBLIC API ========

  /** Full geo state observable (for binding + status) */
  get state$(): Observable<LocationState> {
    return this._state.asObservable();
  }

  /** Current validated GeoContext stream */
  get currentContext$(): Observable<GeoContext | null> {
    return this._state.pipe(
      map(state => state.context),
      distinctUntilChanged()
    );
  }

  /** Synchronous validation wrapper */
  validateSync(context: GeoContext): boolean {
    let isValid = false;
    this.validator.validate(context).then(result => isValid = result.isValid);
    return isValid;
  }

  /** Observable of serviceable countries */
  get supportedCountries$(): Observable<Country[]> {
    return from(this.geoRepo.listCountries({ onlyServiceable: true }));
  }

  /**
   * Detects user location with caching
   * @param forceRefresh Bypass cache when true
   */
  detectLocation(forceRefresh = false): Observable<GeoContext | null> {
    this._state.next({ ...this._state.value, status: 'loading' });

    const detection$ = forceRefresh
      ? this.executeDetection()
      : this.cache.load().pipe(
          switchMap(cached => cached ? of(cached) : this.executeDetection())
        );

    return detection$.pipe(
      tap(context => this.handleDetectionSuccess(context)),
      catchError(err => this.handleDetectionError(err))
    );
  }

  /**
   * Manually sets and validates location
   * @param context GeoContext to set
   * @returns Validation result
   */
  async setManualLocation(context: GeoContext): Promise<ValidationResult> {
    this._state.next({ ...this._state.value, status: 'loading' });

    try {
      const result = await this.validator.validate(context);
      
      if (result.isValid) {
        this.cache.save(context);
        this._state.next({
          context,
          status: 'success',
          source: 'manual'
        });
      }
      return result;
    } catch {
      this._state.next({
        ...this._state.value,
        status: 'error',
        error: 'Manual selection validation failed'
      });
      throw new Error('Manual location validation failed');
    }
  }

  /**
   * Gets filtered cities for a country
   * @param countryCode ISO country code
   * @param options Filtering options
   */
  getCities(
    countryCode: string,
    options?: { searchTerm?: string; onlyActive?: boolean }
  ): Observable<City[]> {
    return from(this.geoRepo.getCities(countryCode, options));
  }

  // ======== PRIVATE METHODS ========
  private executeDetection(): Observable<GeoContext> {
  return this.geoLocation.fetchGeoContext().pipe(
    switchMap(context => {
      if (!context) {
        throw new Error('No location detected');
      }
      if (!this.validateSync(context)) {
        throw new Error('Detected location not serviceable');
      }
      return of(context);
    })
  );
}

  private handleDetectionSuccess(context: GeoContext | null): void {
    const newState: LocationState = {
      context,
      status: context ? 'success' : 'error',
      source: context?.source,
      error: context ? null : 'Detection failed'
    };
    this._state.next(newState);
  }

  private handleDetectionError(error: any): Observable<null> {
    this._state.next({
      ...this._state.value,
      status: 'error',
      error: this.getErrorMessage(error)
    });
    return of(null);
  }

  private getErrorMessage(error: any): string {
    if (error?.code === 'PERMISSION_DENIED') {
      return 'Location access denied. Please enable permissions.';
    }
    return 'Could not determine your location. Try manual selection.';
  }
}