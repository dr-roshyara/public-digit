// apps/mobile/src/app/domain/geo-location/repositories/geo-location.repository.ts
import { CountryCode } from '../value-objects/country-code.vo';

export abstract class GeoLocationRepository {
  /**
   * Detect user's country based on IP address
   */
  abstract detectCountry(): Promise<CountryCode>;

  /**
   * Cache locale preference for future use
   */
  abstract cacheLocalePreference(preference: any): Promise<void>;

  /**
   * Get cached locale preference
   */
  abstract getCachedLocalePreference(): Promise<any>;
}