/**
 * City Entity - Core domain model representing a geographic city
 * 
 * Responsibilities:
 * - Maintain city identity and invariants
 * - Enforce geographic business rules
 * - Provide domain-specific operations
 * - Handle serialization/deserialization
 *
 * @module City
 * @version 2.0.0
 * @file geo/domain/entities/city.entity.ts
 */

import { LatLng } from '../value-objects/lat-lng.value-object';
import { CityValidationError } from '../../shared/errors/domain.error';
import { v4 as uuidv4 } from 'uuid';

/**
 * City properties interface with strict typing
 * 
 * @interface CityProps
 * @property {string} id - Unique identifier (UUID recommended)
 * @property {string} name - Official city name
 * @property {string} nativeName - Localized city name
 * @property {string} countryCode - ISO 3166-1 alpha-2 code
 * @property {string} [region] - Administrative region
 * @property {LatLng} coordinates - Geographic position
 * @property {string} timezone - IANA timezone ID
 * @property {boolean} isActive - Service availability flag
 * @property {CityMetadata} [metadata] - Optional demographic data
 */
export interface CityProps {
  id: string;
  name: string;
  nativeName: string;
  countryCode: string;
  region?: string;
  coordinates: LatLng;
  timezone: string;
  isActive: boolean;
  metadata?: CityMetadata;
}

/**
 * City demographic metadata
 * 
 * @interface CityMetadata
 * @property {number} [population] - Population count
 * @property {number} [areaSqKm] - Area in square kilometers
 * @property {number} [elevation] - Elevation in meters
 */
export interface CityMetadata {
  population?: number;
  areaSqKm?: number;
  elevation?: number;
}

/**
 * City Data Transfer Object for API responses
 * 
 * @interface CityDTO
 * @extends Omit<CityProps, 'coordinates'> 
 */
export interface CityDTO extends Omit<CityProps, 'coordinates'> {
  coordinates: { lat: number; lng: number };
  slug: string;
  populationDensity?: number;
}

/**
 * Core City domain entity
 */
export class City {
  private constructor(private readonly props: CityProps) {}

  // ==================== FACTORY METHODS ====================

  /**
   * Creates a new validated City instance
   * 
   * @static
   * @param {CityProps} props - City properties
   * @returns {City} Validated city instance
   * @throws {DomainError} If validation fails
   */
  static create(props: CityProps): City {
    const city = new City(props);
    city.validate();
    return city;
  }

  /**
   * Factory for new city creation with generated ID
   * 
   * @static
   * @param {Omit<CityProps, 'id'>} props - City properties without ID
   * @returns {City} New city instance
   */
  static createNew(props: Omit<CityProps, 'id'>): City {
    return this.create({
      ...props,
      id: uuidv4()
    });
  }

  // ==================== VALIDATION ====================

  /**
   * Validates city invariants
   * 
   * @private
   * @throws {DomainError} With validation details
   */
/**
 * Validates city invariants
 * 
 * @private
 * @throws {DomainError} With validation details
 */
private validate(): void {
  const errors: string[] = [];

  // Identity validation
  if (!this.props.id?.trim()) {
    errors.push('City must have a non-empty ID');
  }

  // Name validation
  if (!this.props.name?.trim()) {
    errors.push('City must have an official name');
  }

  // Country code validation
  if (!/^[A-Z]{2}$/.test(this.props.countryCode)) {
    errors.push('Country code must be ISO 3166-1 alpha-2 format');
  }

  // Coordinate validation - using static method
  if (!LatLng.isValid(this.props.coordinates.latitude, this.props.coordinates.longitude)) {
    errors.push('Invalid geographic coordinates');
  }

  // Timezone validation
  if (!this.props.timezone?.includes('/')) {
    errors.push('Timezone must be in IANA format (Area/Location)');
  }

  if (errors.length > 0) {
    throw new CityValidationError(
      `City validation failed: ${errors.join(', ')}`,
      errors
    );
  }
}
  // ==================== DOMAIN LOGIC ====================

  /**
   * Checks if city is serviceable
   * 
   * @param {string[]} [supportedCountries] - Optional whitelist
   * @returns {boolean} Serviceability status
   */
  isServiceable(supportedCountries?: string[]): boolean {
    const countryValid = supportedCountries
      ? supportedCountries.includes(this.props.countryCode)
      : true;
    return this.props.isActive && countryValid;
  }

  /**
   * Calculates distance to another city in kilometers
   * 
   * @param {City} other - Target city
   * @returns {number} Distance in kilometers
   */
  distanceTo(other: City): number {
    return this.props.coordinates.distanceTo(other.props.coordinates);
  }

  /**
   * Gets localized name based on preference
   * 
   * @param {boolean} [preferNative=true] - Return native name if available
   * @returns {string} Appropriate name
   */
  getName(preferNative: boolean = true): string {
    return preferNative && this.props.nativeName?.trim()
      ? this.props.nativeName
      : this.props.name;
  }

  // ==================== DATA TRANSFORMATION ====================

  /**
   * Converts to Data Transfer Object
   * 
   * @returns {CityDTO} API-ready representation
   */
  toDTO(): CityDTO {
    return {
      ...this.props,
      coordinates: this.props.coordinates.toJSON(),
      slug: City.createSlug(this.props.name, this.props.countryCode),
      populationDensity: this.populationDensity
    };
  }

  /**
   * Serializes for persistence
   * 
   * @returns {CityProps} Raw properties
   */
  toJSON(): CityProps {
    return this.props;
  }

  // ==================== UTILITIES ====================

  /**
   * Generates URL-friendly slug
   * 
   * @static
   * @param {string} name - City name
   * @param {string} countryCode - Country code
   * @returns {string} Formatted slug
   */
  static createSlug(name: string, countryCode: string): string {
    return `${name.toLowerCase().replace(/\s+/g, '-')}-${countryCode.toLowerCase()}`;
  }

  // ==================== ACCESSORS ====================

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get nativeName(): string { return this.props.nativeName; }
  get countryCode(): string { return this.props.countryCode; }
  get region(): string | undefined { return this.props.region; }
  get coordinates(): LatLng { return this.props.coordinates; }
  get timezone(): string { return this.props.timezone; }
  get isActive(): boolean { return this.props.isActive; }

  /**
   * Gets metadata with default values
   */
  get metadata(): Required<CityMetadata> {
    return {
      population: this.props.metadata?.population ?? 0,
      areaSqKm: this.props.metadata?.areaSqKm ?? 0,
      elevation: this.props.metadata?.elevation ?? 0
    };
  }

  /**
   * Calculates population density (people/km²)
   */
  get populationDensity(): number {
    const { population, areaSqKm } = this.metadata;
    return areaSqKm > 0 ? Math.round(population / areaSqKm) : 0;
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Sanitizes properties for error logging
   */
  private sanitizeForLogging(props: CityProps): Partial<CityProps> {
    const { metadata, ...safeProps } = props;
    return safeProps;
  }
}

// ==================== USAGE EXAMPLES ====================
/*
// Creation
const berlin = City.createNew({
  name: 'Berlin',
  nativeName: 'Berlin',
  countryCode: 'DE',
  coordinates: new LatLng(52.52, 13.405),
  timezone: 'Europe/Berlin',
  isActive: true,
  metadata: {
    population: 3769000,
    areaSqKm: 891.8
  }
});

// API Response
const apiResponse = berlin.toDTO();
// {
//   id: 'uuid-123',
//   name: 'Berlin',
//   countryCode: 'DE',
//   coordinates: { lat: 52.52, lng: 13.405 },
//   slug: 'berlin-de',
//   populationDensity: 4225
// }

// Business Logic
if (berlin.isServiceable(['DE', 'FR'])) {
  console.log(`Distance to Paris: ${berlin.distanceTo(paris)} km`);
}
*/