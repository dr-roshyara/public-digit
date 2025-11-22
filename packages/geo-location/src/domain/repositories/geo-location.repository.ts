import { CountryCode } from '../value-objects/country-code.vo';
import { LocalePreference } from '../value-objects/locale-preference.vo';

export abstract class GeoLocationRepository {
  /**
   * Detect user's country based on IP address
   */
  abstract detectCountry(): Promise<CountryCode>;

  /**
   * Cache locale preference for future use
   */
  abstract cacheLocalePreference(preference: LocalePreference): Promise<void>;

  /**
   * Get cached locale preference
   */
  abstract getCachedLocalePreference(): Promise<LocalePreference | null>;
}