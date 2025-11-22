import { CountryCode } from '../value-objects/country-code.vo';
import { LocalePreference } from '../value-objects/locale-preference.vo';

export class CountryDetectionService {
  /**
   * Detect user's locale based on country and browser preferences
   */
  async detectUserLocale(): Promise<LocalePreference> {
    const countryCode = await this.detectCountry();
    const browserLanguage = this.getBrowserLanguage();

    return LocalePreference.create(countryCode, browserLanguage);
  }

  /**
   * Get country-specific locale mapping
   */
  getCountryLocaleMapping(countryCode: CountryCode): string {
    const countryLocaleMap: Record<string, string> = {
      'NP': 'np', // Nepal → Nepali
      'DE': 'de', // Germany → German
      'AT': 'de', // Austria → German
      'CH': 'de', // Switzerland → German
      // Other countries default to English or browser language
    };

    return countryLocaleMap[countryCode.toString()] || 'en';
  }

  private getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';

    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = ['en', 'de', 'np'];
    return supportedLanguages.includes(browserLang) ? browserLang : 'en';
  }

  private async detectCountry(): Promise<CountryCode> {
    // Try IP-based detection first
    try {
      const countryFromIP = await this.detectCountryFromIP();
      if (countryFromIP) {
        return CountryCode.createFromIP(countryFromIP);
      }
    } catch (error) {
      console.warn('IP-based country detection failed:', error);
    }

    // Fallback to browser language detection
    return this.detectCountryFromBrowser();
  }

  private async detectCountryFromIP(): Promise<string | null> {
    try {
      // Use a free IP geolocation service
      const response = await fetch('https://ipapi.co/country/');
      if (response.ok) {
        const countryCode = await response.text();
        return countryCode.trim() || null;
      }
    } catch (error) {
      console.warn('IP geolocation service unavailable:', error);
    }

    return null;
  }

  private detectCountryFromBrowser(): CountryCode {
    if (typeof navigator === 'undefined') return CountryCode.create('US');

    // Try to infer country from browser language
    const browserLang = navigator.language.toLowerCase();

    if (browserLang.includes('np') || browserLang.includes('ne')) {
      return CountryCode.create('NP');
    }
    if (browserLang.includes('de') || browserLang.includes('at') || browserLang.includes('ch')) {
      return CountryCode.create('DE');
    }

    // Default fallback
    return CountryCode.create('US');
  }
}