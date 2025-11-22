import { CountryDetectionService } from '../../domain/services/country-detection.service';
import { GeoLocationRepository } from '../../domain/repositories/geo-location.repository';
import { LocalePreference } from '../../domain/value-objects/locale-preference.vo';

export interface DetectUserLocaleCommand {
  forceRefresh?: boolean;
  respectUserChoice?: boolean;
}

export class DetectUserLocaleUseCase {
  constructor(
    private readonly countryDetectionService: CountryDetectionService,
    private readonly geoLocationRepository: GeoLocationRepository
  ) {}

  async execute(command: DetectUserLocaleCommand = {}): Promise<LocalePreference> {
    const { forceRefresh = false, respectUserChoice = true } = command;

    // Check if user has explicitly chosen a language
    if (respectUserChoice) {
      const userExplicitLocale = this.getUserExplicitLocale();
      if (userExplicitLocale) {
        return this.createPreferenceFromUserChoice(userExplicitLocale);
      }
    }

    // Check cache first
    if (!forceRefresh) {
      const cachedPreference = await this.geoLocationRepository.getCachedLocalePreference();
      if (cachedPreference) {
        return cachedPreference;
      }
    }

    // Detect fresh locale preference
    const localePreference = await this.countryDetectionService.detectUserLocale();

    // Cache the result
    await this.geoLocationRepository.cacheLocalePreference(localePreference);

    return localePreference;
  }

  private getUserExplicitLocale(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('user_explicit_locale');
  }

  private async createPreferenceFromUserChoice(userLocale: string): Promise<LocalePreference> {
    // Even with user choice, we still detect country for analytics/fallback
    const countryCode = await this.geoLocationRepository.detectCountry();
    return LocalePreference.create(countryCode, userLocale);
  }
}