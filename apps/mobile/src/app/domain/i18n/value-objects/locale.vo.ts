/**
 * Locale - Domain Value Object
 *
 * DDD DOMAIN LAYER - Value Object
 *
 * PURPOSE:
 * - Encapsulates locale (language code) business rules
 * - Ensures locale validity
 * - Immutable value object (cannot be changed after creation)
 *
 * VALUE OBJECT CHARACTERISTICS:
 * - Immutable
 * - Self-validating
 * - Equality based on value, not identity
 * - No identity or lifecycle
 */

/**
 * Supported language codes
 */
export type SupportedLocale = 'en' | 'de' | 'np';

/**
 * Locale Value Object
 *
 * EXAMPLES:
 * - Locale.create('en') → Valid English locale
 * - Locale.create('invalid') → Throws error
 * - locale.isEnglish() → true/false
 */
export class Locale {
  private static readonly SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'de', 'np'];
  private static readonly DEFAULT_LOCALE: SupportedLocale = 'en';

  private constructor(private readonly value: SupportedLocale) {}

  /**
   * Factory method to create a Locale
   *
   * @param value - Language code
   * @returns Locale instance
   * @throws Error if locale is not supported
   */
  static create(value: string): Locale {
    const normalized = value.toLowerCase().trim();

    if (!this.isSupported(normalized)) {
      throw new Error(
        `Invalid locale: ${value}. Supported locales: ${this.SUPPORTED_LOCALES.join(', ')}`
      );
    }

    return new Locale(normalized as SupportedLocale);
  }

  /**
   * Create default locale (English)
   */
  static default(): Locale {
    return new Locale(this.DEFAULT_LOCALE);
  }

  /**
   * Check if a locale is supported
   */
  static isSupported(value: string): value is SupportedLocale {
    return this.SUPPORTED_LOCALES.includes(value as SupportedLocale);
  }

  /**
   * Get all supported locales
   */
  static getSupportedLocales(): SupportedLocale[] {
    return [...this.SUPPORTED_LOCALES];
  }

  /**
   * Get locale code
   */
  toString(): string {
    return this.value;
  }

  /**
   * Get locale code (alias for toString)
   */
  getValue(): SupportedLocale {
    return this.value;
  }

  /**
   * Check if this is English locale
   */
  isEnglish(): boolean {
    return this.value === 'en';
  }

  /**
   * Check if this is German locale
   */
  isGerman(): boolean {
    return this.value === 'de';
  }

  /**
   * Check if this is Nepali locale
   */
  isNepali(): boolean {
    return this.value === 'np';
  }

  /**
   * Check equality with another Locale
   */
  equals(other: Locale): boolean {
    return this.value === other.value;
  }

  /**
   * Get display name for locale
   */
  getDisplayName(): string {
    const displayNames: Record<SupportedLocale, string> = {
      en: 'English',
      de: 'Deutsch',
      np: 'नेपाली'
    };
    return displayNames[this.value];
  }

  /**
   * Get native display name for locale
   */
  getNativeName(): string {
    const nativeNames: Record<SupportedLocale, string> = {
      en: 'English',
      de: 'Deutsch',
      np: 'नेपाली'
    };
    return nativeNames[this.value];
  }
}
