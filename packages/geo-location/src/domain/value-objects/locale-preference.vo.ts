import { CountryCode } from './country-code.vo';

export class LocalePreference {
  private constructor(
    public readonly countryCode: CountryCode,
    public readonly browserLanguage: string,
    public readonly resolvedLocale: string
  ) {}

  static create(countryCode: CountryCode, browserLanguage: string): LocalePreference {
    const resolvedLocale = this.resolveLocale(countryCode, browserLanguage);
    return new LocalePreference(countryCode, browserLanguage, resolvedLocale);
  }

  private static resolveLocale(countryCode: CountryCode, browserLanguage: string): string {
    // Country-based resolution (business rules)
    if (countryCode.isNepal()) {
      return 'np';
    }
    if (countryCode.isGermanSpeaking()) {
      return 'de';
    }

    // Browser language fallback for other countries
    const supportedLanguages = ['en', 'de', 'np'];
    if (supportedLanguages.includes(browserLanguage)) {
      return browserLanguage;
    }

    // Default fallback
    return 'en';
  }

  shouldOverrideUserPreference(): boolean {
    // Business rule: Only override if user hasn't explicitly chosen a language
    if (typeof localStorage === 'undefined') return true;
    return !localStorage.getItem('user_explicit_locale');
  }

  getConfidence(): 'high' | 'medium' | 'low' {
    // High confidence for exact country-locale matches
    if (this.countryCode.isNepal() && this.resolvedLocale === 'np') {
      return 'high';
    }
    if (this.countryCode.isGermanSpeaking() && this.resolvedLocale === 'de') {
      return 'high';
    }

    // Medium confidence for browser language matches
    if (this.browserLanguage === this.resolvedLocale) {
      return 'medium';
    }

    // Low confidence for fallback cases
    return 'low';
  }
}