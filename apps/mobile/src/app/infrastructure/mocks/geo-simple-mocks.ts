/**
 * Mock Implementations of Geo-Location Package Services
 *
 * WHY THESE MOCKS EXIST:
 * The @public-digit-platform/geo-location package exports services that are NOT
 * decorated with @Injectable(). This causes Angular's DI to fail with NG0204 error.
 *
 * SOLUTION:
 * Create Angular-compatible mock services with proper decorators until the package
 * is updated with proper Angular dependency injection support.
 *
 * ARCHITECTURAL LAYER: Infrastructure (Mocks)
 *
 * These mocks provide minimal but functional implementations for:
 * - GeoTranslationBridgeService: Country detection and locale management
 * - MultiLayerCacheService: Simple localStorage-based caching
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

/**
 * Mock GeoTranslationBridgeService
 *
 * Provides basic geo-location detection based on browser language.
 * In production, this would be replaced with the actual package service
 * once it has proper @Injectable() decorators.
 */
@Injectable({ providedIn: 'root' })
export class GeoTranslationBridgeService {
  /**
   * Initialize the geo-location service
   */
  initialize(): Promise<boolean> {
    console.log('🌐 Mock GeoTranslationBridgeService initialized');
    console.log('📍 Using browser language for country detection');
    return Promise.resolve(true);
  }

  /**
   * Detect user's country based on browser language
   *
   * MOCK IMPLEMENTATION:
   * - 'de' language → Germany (DE)
   * - 'np' language → Nepal (NP)
   * - Default → United States (US)
   *
   * PRODUCTION: Would use IP geolocation, GPS, or other detection methods
   */
  detectCountry(): Observable<string> {
    const browserLang = (navigator.language || 'en').toLowerCase();

    let country = 'US';  // Default

    if (browserLang.includes('de')) {
      country = 'DE';  // Germany
    } else if (browserLang.includes('np')) {
      country = 'NP';  // Nepal
    } else if (browserLang.includes('gb') || browserLang.includes('uk')) {
      country = 'GB';  // United Kingdom
    }

    console.log(`🌍 Mock: Detected country: ${country} (from browser language: ${browserLang})`);

    // Simulate async detection with delay
    return of(country).pipe(delay(100));
  }

  /**
   * Set user's explicit locale preference
   *
   * MOCK IMPLEMENTATION: Uses localStorage
   * PRODUCTION: Would use backend API + cache
   */
  setUserPreference(locale: string): Observable<boolean> {
    console.log(`✅ Mock: Setting user preference to: ${locale}`);

    try {
      localStorage.setItem('user_explicit_locale', locale);
      localStorage.setItem('user_explicit_locale_timestamp', new Date().toISOString());

      return of(true).pipe(delay(50));
    } catch (error) {
      console.error('❌ Mock: Failed to set user preference:', error);
      return of(false).pipe(delay(50));
    }
  }

  /**
   * Clear user's explicit locale preference
   *
   * MOCK IMPLEMENTATION: Clears localStorage
   * PRODUCTION: Would clear backend preference + cache
   */
  clearUserPreference(): Observable<boolean> {
    console.log('🔄 Mock: Clearing user preference');

    try {
      localStorage.removeItem('user_explicit_locale');
      localStorage.removeItem('user_explicit_locale_timestamp');

      return of(true).pipe(delay(50));
    } catch (error) {
      console.error('❌ Mock: Failed to clear user preference:', error);
      return of(false).pipe(delay(50));
    }
  }

  /**
   * Get current locale from user preference or browser default
   */
  getCurrentLocale(): string {
    const userPreference = localStorage.getItem('user_explicit_locale');

    if (userPreference) {
      return userPreference;
    }

    // Fallback to browser language
    const browserLang = (navigator.language || 'en').split('-')[0].toLowerCase();
    const supportedLanguages = ['en', 'de', 'np'];

    return supportedLanguages.includes(browserLang) ? browserLang : 'en';
  }

  /**
   * Get health status of the geo-location service
   */
  getHealthStatus(): any {
    return {
      service: 'geo-translation-bridge-mock',
      status: 'operational',
      provider: 'browser-language-detection',
      timestamp: new Date().toISOString(),
      capabilities: {
        countryDetection: true,
        ipGeolocation: false,
        gpsLocation: false,
        userPreferences: true
      }
    };
  }
}

/**
 * Mock MultiLayerCacheService
 *
 * Provides simple localStorage-based caching.
 * In production, this would be replaced with multi-layer cache
 * (memory + localStorage + IndexedDB).
 */
@Injectable({ providedIn: 'root' })
export class MultiLayerCacheService {
  private memoryCache = new Map<string, any>();

  /**
   * Set cache value (memory + localStorage)
   */
  set(key: string, value: any, ttl?: number): void {
    try {
      // Memory cache
      this.memoryCache.set(key, {
        value,
        timestamp: Date.now(),
        ttl
      });

      // localStorage cache
      const cacheEntry = {
        value,
        timestamp: Date.now(),
        ttl
      };

      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));

      console.log(`💾 Mock Cache: Set '${key}' (TTL: ${ttl || 'infinite'}ms)`);
    } catch (error) {
      console.error(`❌ Mock Cache: Failed to set '${key}':`, error);
    }
  }

  /**
   * Get cache value (check memory first, then localStorage)
   */
  get(key: string): any {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);

    if (memoryEntry) {
      const isExpired = memoryEntry.ttl &&
        (Date.now() - memoryEntry.timestamp > memoryEntry.ttl);

      if (!isExpired) {
        console.log(`✅ Mock Cache: Hit (memory) for '${key}'`);
        return memoryEntry.value;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Try localStorage cache
    try {
      const item = localStorage.getItem(`cache_${key}`);

      if (!item) {
        console.log(`❌ Mock Cache: Miss for '${key}'`);
        return null;
      }

      const entry = JSON.parse(item);
      const isExpired = entry.ttl &&
        (Date.now() - entry.timestamp > entry.ttl);

      if (!isExpired) {
        // Restore to memory cache
        this.memoryCache.set(key, entry);
        console.log(`✅ Mock Cache: Hit (localStorage) for '${key}'`);
        return entry.value;
      } else {
        // Expired, remove it
        localStorage.removeItem(`cache_${key}`);
        console.log(`⏱️ Mock Cache: Expired for '${key}'`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Mock Cache: Error getting '${key}':`, error);
      return null;
    }
  }

  /**
   * Clear specific cache key
   */
  clear(key: string): void {
    this.memoryCache.delete(key);
    localStorage.removeItem(`cache_${key}`);
    console.log(`🗑️ Mock Cache: Cleared '${key}'`);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear localStorage cache entries
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    console.log(`🗑️ Mock Cache: Cleared all entries (${keysToRemove.length} items)`);
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    const localStorageKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache_')) {
        localStorageKeys.push(key);
      }
    }

    return {
      service: 'multi-layer-cache-mock',
      memoryEntries: this.memoryCache.size,
      localStorageEntries: localStorageKeys.length,
      timestamp: new Date().toISOString()
    };
  }
}
