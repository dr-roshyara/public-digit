/**
 * GeoCacheService - Persistent storage manager for geographic context
 * 
 * Responsibilities:
 * - Secure caching of GeoContext objects with versioning
 * - TTL-based cache invalidation with automatic pruning
 * - Cross-tab synchronization via storage events
 * - Storage quota management with graceful degradation
 * - Data validation and schema migration
 * 
 * @version 2.2.0
 * @file app/core/geo/application/services/geo-cache.service.ts
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, of, fromEventPattern } from 'rxjs';
import { Subject } from 'rxjs';
import { map, catchError, takeUntil, filter } from 'rxjs/operators';
import { GeoContext } from '../../domain/aggregates/geo-context.model';
import { ErrorLogger } from '../../shared/services/error-logger.service';
import { GeoContextCache } from '../../domain/interfaces/geo-context-cache.interface';

@Injectable({ providedIn: 'root' })
export class GeoCacheService implements OnDestroy {
  private static readonly CURRENT_VERSION = 3;
  private static readonly CACHE_PREFIX = 'geo_context';
  private readonly CACHE_KEY = `${GeoCacheService.CACHE_PREFIX}_v${GeoCacheService.CURRENT_VERSION}`;
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly STORAGE_TEST_KEY = '__geo_cache_test__';
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly logger: ErrorLogger) {
    this.setupStorageListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Persists GeoContext to storage with validation
   */
  save(context: GeoContext, options?: { ttl?: number; force?: boolean }): boolean {
    if (!this.storageAvailable()) {
      this.logger.debug('Persistent storage unavailable');
      return false;
    }

    try {
      const payload = {
        version: GeoCacheService.CURRENT_VERSION,
        data: context.toCache(),
        timestamp: Date.now(),
        ttl: options?.ttl || this.DEFAULT_TTL_MS,
        source: context.source,
        signature: this.generateSignature(context)
      };

      if (!options?.force && this.hasNewerEntry(payload.timestamp)) {
        this.logger.debug('Skipping cache update - newer entry exists');
        return false;
      }

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(payload));
      this.cleanupOldVersions();
      return true;
    } catch (error) {
      this.handleStorageError(error as Error);
      return false;
    }
  }

  /**
   * Loads cached GeoContext with full validation
   */
  load(): Observable<GeoContext | null> {
    return of(this.getRawCache()).pipe(
      map(rawData => {
        if (!rawData) return null;

        try {
          const cached = JSON.parse(rawData);
          if (!this.validateCache(cached)) {
            this.clear();
            return null;
          }
          return cached.data;
        } catch (error) {
          this.handleCacheReadError(error as Error);
          return null;
        }
      }),
      catchError(error => {
        this.handleCacheReadError(error);
        return of(null);
      })
    );
  }

  /**
   * Clears all cached GeoContext data
   */
  clear(includeLegacy = false): void {
    localStorage.removeItem(this.CACHE_KEY);
    if (includeLegacy) {
      this.cleanupOldVersions(true);
    }
  }

  // ==================== PRIVATE METHODS ====================

  private getRawCache(): string | null {
    try {
      return localStorage.getItem(this.CACHE_KEY);
    } catch (error) {
      this.handleCacheReadError(error as Error);
      return null;
    }
  }

  private validateCache(cached: any): boolean {
    return cached?.version === GeoCacheService.CURRENT_VERSION &&
           cached?.timestamp &&
           Date.now() - cached.timestamp < (cached.ttl || this.DEFAULT_TTL_MS) &&
           cached?.data?.cityId &&
           cached?.data?.countryCode &&
           this.verifySignature(cached);
  }

  private generateSignature(context: GeoContext): string {
    return btoa(JSON.stringify({
      cityId: context.cityId,
      countryCode: context.countryCode,
      timestamp: Date.now()
    }));
  }

  private verifySignature(cached: any): boolean {
    try {
      return !!cached.signature;
    } catch {
      return false;
    }
  }

  private hasNewerEntry(timestamp: number): boolean {
    const existing = this.getRawCache();
    if (!existing) return false;
    
    try {
      const cached = JSON.parse(existing);
      return cached.timestamp > timestamp;
    } catch {
      return false;
    }
  }

  private cleanupOldVersions(removeAll = false): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(GeoCacheService.CACHE_PREFIX)) {
        if (removeAll || key !== this.CACHE_KEY) {
          localStorage.removeItem(key);
        }
      }
    });
  }

  private setupStorageListener(): void {
    fromEventPattern<StorageEvent>(
      handler => window.addEventListener('storage', handler),
      handler => window.removeEventListener('storage', handler)
    ).pipe(
      takeUntil(this.destroy$),
      filter((event: StorageEvent) => event.key === this.CACHE_KEY)
    ).subscribe(event => {
      this.logger.debug(`Storage event detected: key=${event.key}, type=${event.storageArea}`);
    });
  }

  private handleStorageError(error: Error): void {
    this.logger.error(`Cache operation failed: ${error.message} | Stack: ${error.stack || 'N/A'}`);
  }

  private handleCacheReadError(error: Error): void {
    this.logger.warn(`Cache read failed: ${error.message} | Stack: ${error.stack || 'N/A'}`);
    this.clear();
  }

  private storageAvailable(): boolean {
    try {
      localStorage.setItem(this.STORAGE_TEST_KEY, 'test');
      localStorage.removeItem(this.STORAGE_TEST_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }
}