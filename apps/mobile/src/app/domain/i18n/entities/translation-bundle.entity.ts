/**
 * TranslationBundle - Domain Entity
 *
 * DDD DOMAIN LAYER - Entity
 *
 * PURPOSE:
 * - Represents a collection of translations for a specific locale and context
 * - Has identity (locale + namespace)
 * - Manages translation data lifecycle
 *
 * ENTITY CHARACTERISTICS:
 * - Has identity (not just value)
 * - Mutable (translations can be merged/updated)
 * - Has lifecycle
 * - Equality based on identity, not value
 */

import { Locale } from '../value-objects/locale.vo';
import { TranslationKey } from '../value-objects/translation-key.vo';

/**
 * Translation bundle data structure
 */
export interface TranslationData {
  [key: string]: string | TranslationData;
}

/**
 * TranslationBundle Entity
 *
 * EXAMPLES:
 * - Core bundle: namespace='common', locale='en'
 * - Page bundle: namespace='pages.auth.login', locale='de'
 */
export class TranslationBundle {
  private readonly loadedAt: Date;
  private data: TranslationData;

  private constructor(
    private readonly namespace: string,
    private readonly locale: Locale,
    initialData: TranslationData = {}
  ) {
    this.data = { ...initialData };
    this.loadedAt = new Date();
  }

  /**
   * Factory method to create a TranslationBundle
   *
   * @param namespace - Bundle namespace (e.g., 'common', 'pages.home')
   * @param locale - Locale value object
   * @param data - Initial translation data
   */
  static create(namespace: string, locale: Locale, data: TranslationData = {}): TranslationBundle {
    if (!namespace || namespace.trim() === '') {
      throw new Error('Translation bundle namespace cannot be empty');
    }

    return new TranslationBundle(namespace, locale, data);
  }

  /**
   * Get bundle identity (namespace + locale)
   */
  getId(): string {
    return `${this.namespace}:${this.locale.toString()}`;
  }

  /**
   * Get bundle namespace
   */
  getNamespace(): string {
    return this.namespace;
  }

  /**
   * Get bundle locale
   */
  getLocale(): Locale {
    return this.locale;
  }

  /**
   * Get translation data
   */
  getData(): TranslationData {
    return { ...this.data }; // Return copy for immutability
  }

  /**
   * Get when bundle was loaded
   */
  getLoadedAt(): Date {
    return this.loadedAt;
  }

  /**
   * Get translation by key
   *
   * @param key - Translation key
   * @returns Translation value or undefined if not found
   */
  getTranslation(key: TranslationKey): string | undefined {
    const parts = key.getParts();
    let current: any = this.data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Check if bundle has a specific translation
   */
  hasTranslation(key: TranslationKey): boolean {
    return this.getTranslation(key) !== undefined;
  }

  /**
   * Merge additional translation data into bundle
   *
   * @param newData - Translation data to merge
   */
  merge(newData: TranslationData): void {
    this.data = this.deepMerge(this.data, newData);
  }

  /**
   * Get age of bundle in milliseconds
   */
  getAgeMs(): number {
    return Date.now() - this.loadedAt.getTime();
  }

  /**
   * Check if bundle is stale (older than threshold)
   *
   * @param thresholdMs - Staleness threshold in milliseconds
   */
  isStale(thresholdMs: number): boolean {
    return this.getAgeMs() > thresholdMs;
  }

  /**
   * Get number of translation keys in bundle
   */
  getKeyCount(): number {
    return this.countKeys(this.data);
  }

  /**
   * Check equality with another bundle (based on identity)
   */
  equals(other: TranslationBundle): boolean {
    return this.getId() === other.getId();
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: TranslationData, source: TranslationData): TranslationData {
    const result: TranslationData = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(
            (result[key] as TranslationData) || {},
            source[key] as TranslationData
          );
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Count total number of translation keys recursively
   */
  private countKeys(obj: TranslationData): number {
    let count = 0;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          count++;
        } else {
          count += this.countKeys(obj[key] as TranslationData);
        }
      }
    }
    return count;
  }
}
