/**
 * Base Domain Error for Geo-Location Context
 *
 * Provides consistent error handling across the geo-location bounded context
 */
export abstract class DomainError extends Error {
  public readonly code: string;
  public readonly context: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    context: string = 'geo-location'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, DomainError.prototype);
  }

  public toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

/**
 * Geo-Location specific domain errors
 */
export class GeoLocationError extends DomainError {
  constructor(message: string, code: string = 'GEO_LOCATION_ERROR') {
    super(message, code, 'geo-location');
  }
}

export class InvalidCoordinatesError extends GeoLocationError {
  constructor(message: string = 'Invalid coordinates provided') {
    super(message, 'INVALID_COORDINATES');
  }
}

export class GeoDetectionFailedError extends GeoLocationError {
  constructor(message: string = 'Geo-location detection failed') {
    super(message, 'GEO_DETECTION_FAILED');
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, code, 'validation');
  }
}

export class CountryValidationError extends ValidationError {
  constructor(message: string, public readonly errors: string[]) {
    super(message, 'COUNTRY_VALIDATION_FAILED');
  }
}

export class CityValidationError extends ValidationError {
  constructor(message: string, public readonly errors: string[]) {
    super(message, 'CITY_VALIDATION_FAILED');
  }
}

export class GeoContextError extends GeoLocationError {
  constructor(message: string, code: string = 'GEO_CONTEXT_ERROR') {
    super(message, code);
  }
}

export class TriangulationError extends GeoLocationError {
  constructor(message: string, code: string = 'TRIANGULATION_ERROR') {
    super(message, code);
  }
}

export class WifiError extends GeoLocationError {
  constructor(message: string, code: string = 'WIFI_ERROR') {
    super(message, code);
  }
}