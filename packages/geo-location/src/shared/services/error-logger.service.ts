/**
 * Error Logger Service
 *
 * Provides centralized error logging for the geo-location context
 */
import { Injectable } from '@angular/core';
import { DomainError } from '../errors/domain.error';

@Injectable({
  providedIn: 'root'
})
export class ErrorLogger {
  private readonly isProduction: boolean = false;

  constructor() {
    // In production, this would be set based on environment
    this.isProduction = false;
  }

  /**
   * Log domain errors with appropriate severity
   */
  logDomainError(error: DomainError, context?: string): void {
    const logContext = context || error.context;

    if (this.isProduction) {
      // Production logging (would send to monitoring service)
      console.error(`[${logContext}] ${error.code}: ${error.message}`, {
        timestamp: error.timestamp,
        stack: error.stack
      });
    } else {
      // Development logging
      console.group(`🚨 Domain Error: ${error.code}`);
      console.error(`Context: ${logContext}`);
      console.error(`Message: ${error.message}`);
      console.error(`Timestamp: ${error.timestamp.toISOString()}`);
      console.error(`Stack:`, error.stack);
      console.groupEnd();
    }
  }

  /**
   * Log validation errors
   */
  logValidationError(error: Error, context: string = 'validation'): void {
    if (this.isProduction) {
      console.warn(`[${context}] Validation Error: ${error.message}`);
    } else {
      console.group(`⚠️ Validation Error`);
      console.warn(`Context: ${context}`);
      console.warn(`Message: ${error.message}`);
      console.warn(`Stack:`, error.stack);
      console.groupEnd();
    }
  }

  /**
   * Log system errors
   */
  logSystemError(error: Error, context: string = 'system'): void {
    if (this.isProduction) {
      console.error(`[${context}] System Error: ${error.message}`, {
        name: error.name,
        stack: error.stack
      });
    } else {
      console.group(`💥 System Error`);
      console.error(`Context: ${context}`);
      console.error(`Name: ${error.name}`);
      console.error(`Message: ${error.message}`);
      console.error(`Stack:`, error.stack);
      console.groupEnd();
    }
  }

  /**
   * Log warning messages
   */
  logWarning(message: string, context: string = 'geo-location'): void {
    if (this.isProduction) {
      console.warn(`[${context}] ${message}`);
    } else {
      console.warn(`⚠️ [${context}] ${message}`);
    }
  }

  /**
   * Log informational messages
   */
  logInfo(message: string, context: string = 'geo-location'): void {
    if (this.isProduction) {
      console.info(`[${context}] ${message}`);
    } else {
      console.info(`ℹ️ [${context}] ${message}`);
    }
  }

  /**
   * Log debug messages (only in development)
   */
  logDebug(message: string, context: string = 'geo-location'): void {
    if (!this.isProduction) {
      console.debug(`🔍 [${context}] ${message}`);
    }
  }

  // Alias methods for compatibility with existing code
  debug(message: string, context: string = 'geo-location'): void {
    this.logDebug(message, context);
  }

  error(message: string, context: string = 'geo-location'): void {
    this.logSystemError(new Error(message), context);
  }

  warn(message: string, context: string = 'geo-location'): void {
    this.logWarning(message, context);
  }
}