/**
 * TranslationLoaderRepository - Domain Port (Interface)
 *
 * DDD DOMAIN LAYER - Repository Interface
 *
 * PURPOSE:
 * - Defines contract for loading translations from external sources
 * - Implements Repository pattern (Domain Port)
 * - Infrastructure layer provides concrete implementations (Adapters)
 *
 * HEXAGONAL ARCHITECTURE:
 * Domain (Port) ← Infrastructure (Adapter)
 *
 * DEPENDENCY RULE:
 * Domain layer defines the interface, Infrastructure implements it.
 * Domain NEVER depends on Infrastructure.
 */

import { Observable } from 'rxjs';

/**
 * Translation data structure returned by repository
 */
export interface TranslationData {
  [key: string]: string | TranslationData;
}

/**
 * Repository interface for loading translation resources
 *
 * IMPLEMENTATION STRATEGY:
 * - Infrastructure layer provides HTTP-based loader
 * - Can be swapped with file-based, API-based, or cached loaders
 * - Supports testing with mock implementations
 */
export interface TranslationLoaderRepository {
  /**
   * Load core translations (common, navigation, footer, etc.)
   *
   * @param locale - Language code (e.g., 'en', 'de', 'np')
   * @returns Observable of translation data
   */
  loadCoreTranslations(locale: string): Observable<TranslationData>;

  /**
   * Load page-specific translations based on route
   *
   * @param routePath - Normalized route path (e.g., 'auth/login')
   * @param locale - Language code (e.g., 'en', 'de', 'np')
   * @returns Observable of translation data
   */
  loadPageTranslations(routePath: string, locale: string): Observable<TranslationData>;

  /**
   * Preload translations for multiple routes (optimization)
   *
   * @param routes - Array of route paths to preload
   * @param locale - Language code
   * @returns Observable that completes when all translations are cached
   */
  preloadTranslations?(routes: string[], locale: string): Observable<void>;
}
