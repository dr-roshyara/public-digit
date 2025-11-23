/**
 * Domain i18n - Public API
 *
 * DDD DOMAIN LAYER - Barrel Export
 *
 * PURPOSE:
 * - Centralized export of domain i18n objects
 * - Clean public API for other layers
 */

// Repositories (Ports)
export {
  TranslationLoaderRepository,
  TranslationData as RepositoryTranslationData
} from './repositories/translation-loader.repository';

// Value Objects
export * from './value-objects/locale.vo';
export * from './value-objects/translation-key.vo';

// Entities
export {
  TranslationBundle,
  TranslationData
} from './entities/translation-bundle.entity';
