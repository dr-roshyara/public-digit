/**
 * ManualDetectionStrategy - Location detection via user selection
 *
 * Implements:
 * - Interactive location picker UI
 * - Selection validation
 * - Manual accuracy estimation
 * - Fallback capability
 *
 * @file src/app/core/geo/infrastructure/detection/manual-detection.strategy.ts
 */

import { Injectable } from '@angular/core';
import { GeoContext } from '../../domain/aggregates/geo-context.model';
import { ILocationDetectionStrategy } from '../../domain/ports/ilocation-detection.strategy';
import { GeoSource } from '../../domain/constants/geo-source.constants';
import { LocationPickerService } from '../../../interfaces/web/services/location-picker.service';
import { ErrorLogger } from 'src/app/shared/services/error-logger.service';

import { LocationDetectionError } from '../../application/errors/location-detection.error';

@Injectable()
export class ManualDetectionStrategy implements ILocationDetectionStrategy {
    readonly source = GeoSource.MANUAL;
    readonly accuracy = 1000; // Meters (estimated manual selection accuracy)
    readonly requiresUserInteraction = true;

    constructor(
        private readonly locationPicker: LocationPickerService,
        private readonly logger: ErrorLogger
    ) {}

    /**
     * Initiates manual location selection flow
     *
     * Flow:
     * 1. Opens interactive picker UI
     * 2. Validates user selection
     * 3. Returns GeoContext with manual attribution
     *
     * @throws LocationDetectionError when:
     *   - User cancels selection
     *   - Invalid location chosen
     *   - Picker UI fails
     */
    async detect(): Promise<GeoContext> {
        try {
            // Step 1: Open location picker
            const selection = await this.locationPicker.open({
                title: 'Select Your Location',
                searchPlaceholder: 'Search city or address',
                recentLocations: this.getRecentLocations()
            });

            // Step 2: Validate selection
            if (!selection || !selection.city || !selection.country) {
                throw new Error('Invalid location selection');
            }

            // Step 3: Create validated context
            return GeoContext.create({
                city: selection.city,
                country: selection.country,
                coordinates: new LatLng(
                    selection.coordinates.lat,
                    selection.coordinates.lng,
                    this.accuracy // Explicit manual accuracy
                ),
                source: this.source,
                timestamp: new Date()
            });

        } catch (error) {
            this.logger.warn('Manual location selection failed', {
                error,
                source: this.source
            });

            throw new LocationDetectionError(
                this.source,
                this.isCancelError(error) ? 'USER_CANCELED' : 'SELECTION_FAILED',
                {
                    retryable: !this.isCancelError(error)
                }
            );
        }
    }

    /**
     * Preloads city data for picker UI
     * @param countryCode Country code to preload
     */
    async preloadCities(countryCode: string): Promise<void> {
        try {
            await this.locationPicker.preload(countryCode);
        } catch (error) {
            this.logger.error('City preload failed', {
                countryCode,
                error
            });
        }
    }

    // ==================== PRIVATE HELPERS ====================

    private isCancelError(error: any): boolean {
        return error?.message?.includes('cancel') ||
               error?.name === 'AbortError';
    }

    private getRecentLocations(): GeoContext[] {
        // Implementation would load from:
        // - Local storage
        // - User preferences
        // - Session history
        return [];
    }
}

// ==================== USAGE EXAMPLES ====================
// // Strategy registration
// providers: [
//   {
//     provide: MANUAL_DETECTION_STRATEGY,
//     useClass: ManualDetectionStrategy,
//     deps: [LocationPickerService, ErrorLogger]
//   }
// ]
//
// // Strategy usage
// try {
//   const context = await manualDetector.detect();
// } catch (error) {
//   if (error instanceof LocationDetectionError && error.isRecoverable) {
//     // Show retry UI
//   }
// }