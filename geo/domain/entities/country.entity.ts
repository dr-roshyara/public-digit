/**
 * Country Entity - Domain model representing a sovereign nation
 * 
 * Responsibilities:
 * - Maintain country identity and invariants
 * - Enforce ISO standard compliance
 * - Provide domain-specific operations
 * - Handle localization and regional rules
 *
 * @module Country
 * @version 2.0.0
 * @file geo/domain/entities/country.entity.ts
 */

import { LatLng } from '../value-objects/lat-lng.value-object';
import { DomainError } from 'src/app/shared/errors/domain.error';

/**
 * Country properties with strict typing and documentation
 * 
 * @interface CountryProps
 * @property {string} code - ISO 3166-1 alpha-2 code (e.g. 'US')
 * @property {string} name - Official country name
 * @property {string} nativeName - Localized country name
 * @property {string} currencyCode - ISO 4217 currency code
 * @property {string} phoneCode - International dialing prefix
 * @property {string} flagEmoji - Unicode flag representation
 * @property {boolean} isServiceable - Service availability flag
 * @property {readonly string[]} timezones - IANA timezone IDs
 * @property {LatLng} [capitalCoordinates] - Capital city coordinates
 * @property {CountryMetadata} [metadata] - Additional regional data
 */
export interface CountryProps {
  code: string;
  name: string;
  nativeName: string;
  currencyCode: string;
  phoneCode: string;
  flagEmoji: string;
  isServiceable: boolean;
  timezones: readonly string[];
  capitalCoordinates?: LatLng;
  metadata?: CountryMetadata;
}

/**
 * Country regional metadata
 * 
 * @interface CountryMetadata
 * @property {string[]} [languages] - Primary language codes (ISO 639-1)
 * @property {'left'|'right'} [drivingSide] - Road traffic direction
 * @property {string} [region] - Continent/region code
 */
export interface CountryMetadata {
  languages?: string[];
  drivingSide?: 'left' | 'right';
  region?: string;
}

/**
 * Country Data Transfer Object for API responses
 * 
 * @interface CountryDTO
 * @extends Omit<CountryProps, 'capitalCoordinates'> 
 */
export interface CountryDTO extends Omit<CountryProps, 'capitalCoordinates'> {
  capitalCoordinates?: { lat: number; lng: number };
  isEuropeanUnion?: boolean;
}

/**
 * Core Country domain entity
 */
export class Country {
  private constructor(private readonly props: CountryProps) {}

  // ==================== FACTORY METHODS ====================

  /**
   * Creates a validated Country instance
   * 
   * @static
   * @param {CountryProps} props - Country properties
   * @returns {Country} Validated instance
   * @throws {DomainError} If validation fails
   */
  static create(props: CountryProps): Country {
    const country = new Country(props);
    country.validate();
    return country;
  }

  /**
   * Creates default fallback country (Germany)
   * 
   * @static
   * @returns {Country} Preconfigured instance
   */
  static createDefault(): Country {
    return this.create({
      code: 'DE',
      name: 'Germany',
      nativeName: 'Deutschland',
      currencyCode: 'EUR',
      phoneCode: '+49',
      flagEmoji: '🇩🇪',
      isServiceable: true,
      timezones: ['Europe/Berlin', 'Europe/Busingen'],
      capitalCoordinates: new LatLng(52.52, 13.405),
      metadata: {
        languages: ['de'],
        drivingSide: 'right',
        region: 'EU'
      }
    });
  }

  // ==================== VALIDATION ====================

  /**
   * Validates country invariants
   * 
   * @private
   * @throws {DomainError} With validation details
   */
  private validate(): void {
    const errors: string[] = [];

    // ISO 3166-1 alpha-2 validation
    if (!/^[A-Z]{2}$/.test(this.props.code)) {
      errors.push('Invalid ISO country code format');
    }

    // ISO 4217 currency validation
    if (!/^[A-Z]{3}$/.test(this.props.currencyCode)) {
      errors.push('Invalid ISO currency code format');
    }

    // Phone code validation
    if (!/^\+\d{1,4}$/.test(this.props.phoneCode)) {
      errors.push('Invalid international phone code format');
    }

    // Timezone validation
    if (this.props.timezones.length === 0) {
      errors.push('At least one timezone must be specified');
    } else {
      this.props.timezones.forEach(tz => {
        if (!tz.includes('/')) errors.push(`Invalid IANA timezone format: ${tz}`);
      });
    }

    // Flag emoji validation
    if (!/\p{Emoji_Presentation}/u.test(this.props.flagEmoji)) {
      errors.push('Invalid flag emoji format');
    }

    if (errors.length > 0) {
      throw new DomainError('COUNTRY_VALIDATION_FAILED', {
        entity: 'Country',
        errors,
        props: this.sanitizeForLogging(this.props)
      });
    }
  }

  // ==================== DOMAIN LOGIC ====================

  /**
   * Checks currency compatibility
   * 
   * @param {string} code - ISO 4217 currency code
   * @returns {boolean} True if country uses specified currency
   */
  usesCurrency(code: string): boolean {
    return this.props.currencyCode === code.toUpperCase();
  }

  /**
   * Checks timezone validity
   * 
   * @param {string} timezone - IANA timezone ID
   * @returns {boolean} True if timezone exists in country
   */
  hasTimezone(timezone: string): boolean {
    return this.props.timezones.includes(timezone);
  }

  /**
   * Determines if country is in specified region
   * 
   * @param {string} region - Region code
   * @returns {boolean} Regional membership
   */
  isInRegion(region: string): boolean {
    return this.props.metadata?.region?.toUpperCase() === region.toUpperCase();
  }

  // ==================== DATA TRANSFORMATION ====================

  /**
   * Converts to Data Transfer Object
   * 
   * @returns {CountryDTO} API-ready representation
   */
  toDTO(): CountryDTO {
    return {
      ...this.props,
      capitalCoordinates: this.props.capitalCoordinates?.toJSON(),
      isEuropeanUnion: this.isInRegion('EU')
    };
  }

  /**
   * Serializes for persistence
   * 
   * @returns {CountryProps} Raw properties
   */
  toJSON(): CountryProps {
    return this.props;
  }

  // ==================== ACCESSORS ====================

  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get nativeName(): string { return this.props.nativeName; }
  get currencyCode(): string { return this.props.currencyCode; }
  get phoneCode(): string { return this.props.phoneCode; }
  get flagEmoji(): string { return this.props.flagEmoji; }
  get isServiceable(): boolean { return this.props.isServiceable; }
  get timezones(): readonly string[] { return this.props.timezones; }
  get capitalCoordinates(): LatLng | undefined { return this.props.capitalCoordinates; }

  /**
   * Gets metadata with default values
   */
  get metadata(): Required<CountryMetadata> {
    return {
      languages: this.props.metadata?.languages ?? [],
      drivingSide: this.props.metadata?.drivingSide ?? 'right',
      region: this.props.metadata?.region ?? ''
    };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Sanitizes properties for error logging
   */
  private sanitizeForLogging(props: CountryProps): Partial<CountryProps> {
    const { metadata, ...safeProps } = props;
    return safeProps;
  }
}

// ==================== USAGE EXAMPLES ====================
/*
// Creation
const usa = Country.create({
  code: 'US',
  name: 'United States',
  nativeName: 'United States of America',
  currencyCode: 'USD',
  phoneCode: '+1',
  flagEmoji: '🇺🇸',
  isServiceable: true,
  timezones: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles'
  ],
  capitalCoordinates: new LatLng(38.9072, -77.0369),
  metadata: {
    languages: ['en'],
    drivingSide: 'right',
    region: 'NA'
  }
});

// API Response
const apiResponse = usa.toDTO();
// {
//   code: 'US',
//   name: 'United States',
//   currencyCode: 'USD',
//   // ... other properties
//   capitalCoordinates: { lat: 38.9072, lng: -77.0369 },
//   isEuropeanUnion: false
// }

// Business Logic
if (usa.isServiceable && usa.usesCurrency('USD')) {
  console.log(`Supported timezones: ${usa.timezones.join(', ')}`);
}
*/