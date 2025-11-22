/**
 * ILocationDetectionStrategy - Contract for location detection implementations
 *
 * Defines standard interface for:
 * - GPS-based detection
 * - IP geolocation
 * - Manual selection
 * - Hybrid approaches
 *
 * @file src/app/core/geo/domain/ports/ilocation-detection.strategy.ts
 */

import { GeoContext } from '../aggregates/geo-context.model';
import { GeoSource } from '../constants/geo-source.constants';

/**
 * Location detection strategy interface
 *
 * Changes Made:
 * 1. Enhanced method documentation
 * 2. Added configuration options
 * 3. Improved error handling
 * 4. Added detection metadata
 */
export interface ILocationDetectionStrategy {
    /**
     * Attempts to detect device location
     *
     * @param options Configuration:
     *   - `timeout`: Operation timeout in ms
     *   - `enableHighAccuracy`: Precision preference
     *   - `signal`: AbortSignal for cancellation
     *
     * @returns Promise resolving to:
     *   - GeoContext: Successful detection
     *   - Error: LocationDetectionError on failure
     *
     * @throws LocationDetectionError for operational failures
     */
    detect(options?: {
        timeout?: number;
        enableHighAccuracy?: boolean;
        signal?: AbortSignal;
    }): Promise<GeoContext>;

    /**
     * Estimated accuracy characteristics
     */
    readonly accuracy: {
        /** Best-case accuracy in meters (50% confidence) */
        bestCase: number;
        /** Worst-case accuracy in meters (95% confidence) */
        worstCase: number;
        /** Typical accuracy in meters (68% confidence) */
        typical: number;
    };

    /**
     * Detection source metadata
     */
    readonly source: GeoSource;

    /**
     * Energy consumption profile
     */
    readonly energyUsage: 'low' | 'medium' | 'high';

    /**
     * Whether strategy requires user interaction
     */
    readonly requiresUserInteraction: boolean;

    /**
     * Verifies strategy availability
     *
     * Checks:
     * - Hardware support
     * - Permissions
     * - Network requirements
     */
    isAvailable(): Promise<boolean>;
}

/**
 * Standardized detection error
 */
export class LocationDetectionError extends Error {
    constructor(
        public readonly source: GeoSource,
        public readonly code:
            | 'PERMISSION_DENIED'
            | 'UNAVAILABLE'
            | 'TIMEOUT'
            | 'NETWORK_ERROR'
            | 'ABORTED',
        public readonly metadata?: {
            requestedAccuracy?: 'high' | 'low';
            retryCount?: number;
            timeout?: number;
        },
        message?: string
    ) {
        super(message || `[${source}] Detection failed (${code})`);
        this.name = 'LocationDetectionError';
        Object.setPrototypeOf(this, LocationDetectionError.prototype);
    }

    /**
     * Determines if error is recoverable
     */
    get isRecoverable(): boolean {
        return !['PERMISSION_DENIED', 'UNAVAILABLE'].includes(this.code);
    }
}

// ==================== USAGE EXAMPLES ====================
// // Strategy implementation
// class GPSDetectionStrategy implements ILocationDetectionStrategy {
//   readonly source = GeoSource.GPS;
//   readonly accuracy = {
//     bestCase: 5,
//     worstCase: 100,
//     typical: 10
//   };
//   readonly energyUsage = 'high';
//   readonly requiresUserInteraction = false;
//
//   async detect(options?: { timeout?: number }) {
//     // Implementation
//   }
//
//   async isAvailable() {
//     // Check permissions and hardware
//   }
// }
//
// // Consumer usage
// async function detectLocation(strategy: ILocationDetectionStrategy) {
//   const controller = new AbortController();
//   const timeout = setTimeout(() => controller.abort(), 10000);
//
//   try {
//     return await strategy.detect({
//       signal: controller.signal,
//       enableHighAccuracy: true
//     });
//   } catch (error) {
//     if (error instanceof LocationDetectionError && error.isRecoverable) {
//       // Handle recoverable error
//     }
//     throw error;
//   } finally {
//     clearTimeout(timeout);
//   }
// }