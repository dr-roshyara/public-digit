import { GeoLocationRepository } from '../../domain/repositories/geo-location.repository';
import { CountryCode } from '../../domain/value-objects/country-code.vo';
import { LocalePreference } from '../../domain/value-objects/locale-preference.vo';
import { CountryDetectionService } from '../../domain/services/country-detection.service';

export class LocalStorageGeoLocationRepository implements GeoLocationRepository {
  private readonly CACHE_KEY = 'geo_locale_preference';
  private readonly CACHE_EXPIRY_KEY = 'geo_locale_preference_expiry';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly countryDetectionService: CountryDetectionService) {}

  async detectCountry(): Promise<CountryCode> {
    // Delegate to the country detection service
    const localePreference = await this.countryDetectionService.detectUserLocale();
    return localePreference.countryCode;
  }

  async cacheLocalePreference(preference: LocalePreference): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    const cacheData = {
      countryCode: preference.countryCode.toString(),
      browserLanguage: preference.browserLanguage,
      resolvedLocale: preference.resolvedLocale,
      timestamp: Date.now()
    };

    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    localStorage.setItem(this.CACHE_EXPIRY_KEY, (Date.now() + this.CACHE_DURATION).toString());
  }

  async getCachedLocalePreference(): Promise<LocalePreference | null> {
    if (typeof localStorage === 'undefined') return null;

    const cachedData = localStorage.getItem(this.CACHE_KEY);
    const expiry = localStorage.getItem(this.CACHE_EXPIRY_KEY);

    if (!cachedData || !expiry) {
      return null;
    }

    const expiryTime = parseInt(expiry, 10);
    if (Date.now() > expiryTime) {
      // Cache expired
      localStorage.removeItem(this.CACHE_KEY);
      localStorage.removeItem(this.CACHE_EXPIRY_KEY);
      return null;
    }

    try {
      const data = JSON.parse(cachedData);
      const countryCode = CountryCode.create(data.countryCode);
      return LocalePreference.create(countryCode, data.browserLanguage);
    } catch (error) {
      console.warn('Failed to parse cached locale preference:', error);
      return null;
    }
  }
}