// ============================================================================
// MINIMAL EXPORT - Core Translation Bridge Only
// ============================================================================
// This is a MINIMAL build to get core functionality compiling.
// WiFi, hybrid services, and complex adapters temporarily disabled.
//
// ✅ WORKING: GeoTranslationBridgeService with circuit breaker & caching
// ⏸️  DISABLED: UnifiedGeoLocationFacade (pulls in complex dependencies)
// ⏸️  DISABLED: WiFi positioning, hybrid detection, complex validators
//
// The bridge service provides essential geo-to-i18n translation for mobile app.
// ============================================================================

// Bridge services - CORE FUNCTIONALITY ✅
export { GeoTranslationBridgeService } from './services/geo-translation-bridge.service';

// Cache services ✅
export { MultiLayerCacheService } from './services/multi-layer-cache.service';

// Value objects ✅
export { CountryCode } from './domain/value-objects/country-code.vo';
export { LocalePreference } from './domain/value-objects/locale-preference.vo';

// Error types ✅
export * from './shared/errors/domain.error';

// ============================================================================
// TEMPORARILY DISABLED - Will be re-enabled in next iteration
// ============================================================================
// export { UnifiedGeoLocationFacade } from './facades/unified-geo-location.facade';
// export { CountryDetectionService } from './domain/services/country-detection.service';
// export { GeoLocationRepository } from './domain/repositories/geo-location.repository';
// export { DetectUserLocaleUseCase } from './application/use-cases/detect-user-locale.use-case';
// export { GeoFacadeFactoryService } from './services/geo-facade-factory.service';
// export { GeoLocationFacade } from './application/facades/geo-location.facade';
// export { GeoContext } from './domain/aggregates/geo-context.model';