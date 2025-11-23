/**
 * TranslationKey - Domain Value Object
 *
 * DDD DOMAIN LAYER - Value Object
 *
 * PURPOSE:
 * - Encapsulates translation key business rules
 * - Validates key format (dot-notation)
 * - Provides type-safe key operations
 *
 * VALUE OBJECT CHARACTERISTICS:
 * - Immutable
 * - Self-validating
 * - Equality based on value
 */

/**
 * TranslationKey Value Object
 *
 * EXAMPLES:
 * - TranslationKey.create('common.app_name') → Valid
 * - TranslationKey.create('navigation.home') → Valid
 * - TranslationKey.create('') → Throws error
 * - TranslationKey.create('invalid key with spaces') → Throws error
 */
export class TranslationKey {
  private static readonly KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/i;
  private static readonly MAX_DEPTH = 5;

  private constructor(private readonly value: string) {}

  /**
   * Factory method to create a TranslationKey
   *
   * @param value - Translation key (dot-notation)
   * @returns TranslationKey instance
   * @throws Error if key format is invalid
   */
  static create(value: string): TranslationKey {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new Error('Translation key cannot be empty');
    }

    if (!this.KEY_PATTERN.test(trimmed)) {
      throw new Error(
        `Invalid translation key format: ${value}. Must use dot-notation (e.g., 'common.app_name')`
      );
    }

    const depth = this.getDepth(trimmed);
    if (depth > this.MAX_DEPTH) {
      throw new Error(
        `Translation key depth exceeds maximum (${this.MAX_DEPTH}): ${value}`
      );
    }

    return new TranslationKey(trimmed);
  }

  /**
   * Get translation key as string
   */
  toString(): string {
    return this.value;
  }

  /**
   * Get translation key value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Get key parts (split by dot)
   *
   * @example
   * TranslationKey.create('common.app_name').getParts() → ['common', 'app_name']
   */
  getParts(): string[] {
    return this.value.split('.');
  }

  /**
   * Get namespace (first part of key)
   *
   * @example
   * TranslationKey.create('common.app_name').getNamespace() → 'common'
   */
  getNamespace(): string {
    return this.getParts()[0];
  }

  /**
   * Get key depth (number of parts)
   *
   * @example
   * TranslationKey.create('common.app_name').getKeyDepth() → 2
   */
  getKeyDepth(): number {
    return this.getParts().length;
  }

  /**
   * Check if key belongs to a namespace
   *
   * @param namespace - Namespace to check
   * @example
   * TranslationKey.create('common.app_name').belongsToNamespace('common') → true
   */
  belongsToNamespace(namespace: string): boolean {
    return this.getNamespace() === namespace;
  }

  /**
   * Check equality with another TranslationKey
   */
  equals(other: TranslationKey): boolean {
    return this.value === other.value;
  }

  /**
   * Check if key is a nested key
   */
  isNested(): boolean {
    return this.getKeyDepth() > 1;
  }

  /**
   * Get parent key (remove last part)
   *
   * @example
   * TranslationKey.create('errors.auth.invalid').getParentKey() → 'errors.auth'
   */
  getParentKey(): TranslationKey | null {
    const parts = this.getParts();
    if (parts.length <= 1) {
      return null;
    }
    return TranslationKey.create(parts.slice(0, -1).join('.'));
  }

  /**
   * Calculate depth of a translation key
   */
  private static getDepth(key: string): number {
    return key.split('.').length;
  }
}
