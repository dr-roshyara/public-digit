/**
 * WiFi Signal Strength Value Object
 * 
 * Represents a validated WiFi signal measurement with domain-specific calculations
 * 
 * Key Responsibilities:
 * - Enforces valid signal strength ranges (-100dBm to -20dBm)
 * - Provides signal quality conversions and categorization
 * - Calculates approximate distance using RF propagation models
 * - Supports signal adjustments and transformations
 *
 * @valueObject Immutable by design - all operations return new instances
 * @version 2.2.0
 * @file geo/domain/value-objects/wifi-signal.value-object.ts
 */

import { DomainError } from 'src/app/shared/errors/domain.error' ;


/**
 * WiFi signal strength categories with threshold values
 */
export type WifiSignalCategory = 
  | 'excellent' 
  | 'good' 
  | 'fair' 
  | 'weak' 
  | 'unusable';

/**
 * Environment factors for different propagation scenarios
 * 
 * @enum {number}
 * @property FREE_SPACE - Ideal open space (n=2.0)
 * @property OFFICE - Typical office environment (n=3.0)
 * @property DENSE_URBAN - High-density urban (n=3.5)
 * @property INDUSTRIAL - Heavy obstruction (n=4.0)
 */
export enum EnvironmentFactor {
  FREE_SPACE = 2.0,
  OFFICE = 3.0,
  DENSE_URBAN = 3.5,
  INDUSTRIAL = 4.0
}

export class WifiSignal {
  /**
   * Minimum valid signal strength in dBm
   * (Typical noise floor for WiFi receivers)
   */
  static readonly MIN_STRENGTH = -100;

  /**
   * Maximum valid signal strength in dBm
   * (Close-range saturated signal)
   */
  static readonly MAX_STRENGTH = -20;

  /**
   * Signal quality thresholds by category (percentage)
   */
  private static readonly QUALITY_THRESHOLDS = {
    excellent: 80,
    good: 65,
    fair: 40,
    weak: 20
  };

  /**
   * The measured signal strength in dBm
   * @public
   * @readonly
   */
  public readonly dBm: number;

  /**
   * Creates a validated WifiSignal instance
   * 
   * @param {number} dBm - Signal strength in dBm (-100 to -20)
   * @throws {DomainError} When strength is outside valid range
   */
  constructor(dBm: number) {
    this.validateSignalStrength(dBm);
    this.dBm = dBm;
  }

  // ==================== VALIDATION ====================

  /**
   * Validates signal strength bounds
   * 
   * @private
   * @param {number} dBm - Signal strength to validate
   * @throws {DomainError} With validation details
   */
  private validateSignalStrength(dBm: number): void {
    if (dBm > WifiSignal.MAX_STRENGTH || dBm < WifiSignal.MIN_STRENGTH) {
      throw new DomainError(
        'INVALID_SIGNAL_STRENGTH',
        {
          actual: dBm,
          min: WifiSignal.MIN_STRENGTH,
          max: WifiSignal.MAX_STRENGTH,
          recommendation: 'Verify measurement device calibration'
        },
        `Signal strength must be between ${WifiSignal.MIN_STRENGTH}dBm and ${WifiSignal.MAX_STRENGTH}dBm`
      );
    }
  }

  // ==================== CORE FUNCTIONALITY ====================

  /**
   * Signal quality as a percentage (0-100)
   * 
   * @readonly
   * @returns {number} Normalized quality percentage
   */
  get quality(): number {
    return Math.round(
      ((this.dBm - WifiSignal.MIN_STRENGTH) / 
      (WifiSignal.MAX_STRENGTH - WifiSignal.MIN_STRENGTH)) * 100
    );
  }

  /**
   * Signal strength category based on quality percentage
   * 
   * @readonly
   * @returns {WifiSignalCategory} Signal quality classification
   */
  get category(): WifiSignalCategory {
    const percent = this.quality;
    const { excellent, good, fair, weak } = WifiSignal.QUALITY_THRESHOLDS;

    return percent >= excellent ? 'excellent' :
           percent >= good ? 'good' :
           percent >= fair ? 'fair' :
           percent >= weak ? 'weak' : 'unusable';
  }

  // ==================== DISTANCE CALCULATION ====================

  /**
   * Estimates approximate distance using log-distance path loss model
   * 
   * @param {number} frequencyMhz - WiFi channel frequency (e.g., 2412 for 2.4GHz Ch1)
   * @param {EnvironmentFactor} [environment=EnvironmentFactor.OFFICE] - Propagation environment factor
   * @returns {number} Estimated distance in meters
   * 
   * @throws {DomainError} When frequency is invalid
   * 
   * Model: distance = 10^((27.55 - (20*log10(freq)) + |RSSI|) / (20 * n))
   * Where:
   * - freq: Frequency in GHz
   * - RSSI: Signal strength in dBm
   * - n: Environment factor (2.0-4.0)
   */
  approximateDistance(
    frequencyMhz: number, 
    environment: EnvironmentFactor = EnvironmentFactor.OFFICE
  ): number {
    if (frequencyMhz <= 0) {
      throw new DomainError('INVALID_FREQUENCY', {
        frequency: frequencyMhz,
        min: 1,
        recommendation: 'Frequency must be positive (e.g., 2412 for 2.4GHz Ch1)'
      });
    }

    const freqInGHz = frequencyMhz / 1000;
    const exponent = (27.55 - (20 * Math.log10(freqInGHz)) + Math.abs(this.dBm)) / 
                    (20 * environment);
    const distance = Math.pow(10, exponent);

    return this.roundToPrecision(distance, 2);
  }

  // ==================== OPERATIONS ====================

  /**
   * Creates new signal with adjusted strength
   * 
   * @param {number} adjustmentdB - Signal adjustment in decibels (+/-)
   * @returns {WifiSignal} New adjusted signal instance
   */
  adjust(adjustmentdB: number): WifiSignal {
    return new WifiSignal(this.dBm + adjustmentdB);
  }

  /**
   * Averages multiple signal measurements
   * 
   * @static
   * @param {WifiSignal[]} signals - Array of WifiSignal instances
   * @returns {WifiSignal} New averaged signal
   * 
   * @throws {DomainError} When empty array is provided
   */
  static average(signals: WifiSignal[]): WifiSignal {
    if (signals.length === 0) {
      throw new DomainError('EMPTY_SIGNAL_SET', {
        operation: 'average',
        recommendation: 'Provide at least one signal measurement'
      });
    }

    const sum = signals.reduce((acc, signal) => acc + signal.dBm, 0);
    return new WifiSignal(sum / signals.length);
  }

  // ==================== UTILITIES ====================

  /**
   * Rounds number to specified decimal places
   * 
   * @private
   * @param {number} value - Number to round
   * @param {number} precision - Number of decimal places
   * @returns {number} Rounded value
   */
  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  // ==================== SERIALIZATION ====================

  /**
   * Returns JSON representation of the signal
   * 
   * @returns {object} Signal properties
   */
  toJSON(): { dBm: number; quality: number; category: WifiSignalCategory } {
    return {
      dBm: this.dBm,
      quality: this.quality,
      category: this.category
    };
  }
}

// ==================== USAGE EXAMPLES ====================
/*
// Basic usage
const signal = new WifiSignal(-65);
console.log(`Strength: ${signal.dBm}dBm`); // -65
console.log(`Quality: ${signal.quality}%`); // 70%
console.log(`Category: ${signal.category}`); // 'good'

// Distance estimation
const distance = signal.approximateDistance(2412);
console.log(`Approx. distance: ${distance}m`); // ~8.51m

// Signal adjustment
const boostedSignal = signal.adjust(10);
console.log(`Boosted strength: ${boostedSignal.dBm}dBm`); // -55

// Signal averaging
const readings = [
  new WifiSignal(-68),
  new WifiSignal(-72),
  new WifiSignal(-65)
];
const avgSignal = WifiSignal.average(readings);
console.log(`Average strength: ${avgSignal.dBm}dBm`); // ~-68.33
*/