// apps/mobile/src/app/domain/geo-location/services/country-detection.service.ts
import { Injectable, inject } from '@angular/core';
import { CountryCode } from '../value-objects/country-code.vo';
import { LocalePreference } from '../value-objects/locale-preference.vo';
import { GeoLocationRepository } from '../repositories/geo-location.repository';

@Injectable({ providedIn: 'root' })
export class CountryDetectionService {
  private readonly geoRepository = inject(GeoLocationRepository);

  /**
   * Detect user's locale based on country and browser preferences
   */
  async detectUserLocale(): Promise<LocalePreference> {
    const countryCode = await this.detectCountry();
    const browserLanguage = this.getBrowserLanguage();
    const countryLocale = this.getCountryLocaleMapping(countryCode);

    // Prefer country locale over browser language if available
    const preferredLocale = countryLocale || browserLanguage;

    return LocalePreference.create(countryCode, preferredLocale);
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
      'LI': 'de', // Liechtenstein → German
      'LU': 'de', // Luxembourg → German (also French, but German is common)
      'BE': 'de', // Belgium → German (in some regions)
      // Other countries default to English or browser language
    };

    return countryLocaleMap[countryCode.toString()] || '';
  }

  private getBrowserLanguage(): string {
    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = ['en', 'de', 'np'];
    return supportedLanguages.includes(browserLang) ? browserLang : 'en';
  }

  private async detectCountry(): Promise<CountryCode> {
    // Delegate to repository (infrastructure layer)
    return await this.geoRepository.detectCountry();
  }
}