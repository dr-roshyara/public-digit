export class InvalidCountryCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCountryCodeError';
  }
}

export class CountryCode {
  private constructor(private readonly value: string) {
    if (!this.isValidCountryCode(value)) {
      throw new InvalidCountryCodeError(`Invalid country code: ${value}`);
    }
  }

  static create(code: string): CountryCode {
    return new CountryCode(code.toUpperCase());
  }

  static createFromIP(ipCountryCode: string | null): CountryCode {
    if (!ipCountryCode) {
      return this.create('US'); // Default fallback
    }
    return this.create(ipCountryCode);
  }

  private isValidCountryCode(code: string): boolean {
    const validCodes = ['NP', 'DE', 'US', 'GB', 'FR', 'IN', 'CN', 'JP', 'AT', 'CH', 'CA', 'AU'];
    return validCodes.includes(code.toUpperCase());
  }

  isNepal(): boolean {
    return this.value === 'NP';
  }

  isGermany(): boolean {
    return this.value === 'DE';
  }

  isGermanSpeaking(): boolean {
    return ['DE', 'AT', 'CH'].includes(this.value);
  }

  equals(other: CountryCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}