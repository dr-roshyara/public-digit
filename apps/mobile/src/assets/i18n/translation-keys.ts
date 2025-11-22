import { CommonTranslations } from './shared/common';
import { HeaderTranslations } from './components/header';
import { HeroTranslations } from './components/hero';
import { DashboardTranslations } from './pages/dashboard';
import { LoginTranslations } from './pages/auth/login';

export interface TranslationKeys {
  common: CommonTranslations;
  components: {
    header: HeaderTranslations;
    hero: HeroTranslations;
    features?: any; // To be implemented
    footer?: any; // To be implemented
    stats?: any; // To be implemented
  };
  pages: {
    auth: {
      login: LoginTranslations;
      tenantSelection?: any; // To be implemented
    };
    home?: any; // To be implemented
    dashboard: DashboardTranslations;
    elections?: any; // To be implemented
    membership?: any; // To be implemented
  };
  shared: {
    errors?: any; // To be implemented
    navigation?: any; // To be implemented
  };
}

// Utility type for nested keys
export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

// Type-safe translation key paths
export type TranslationKeyPath = NestedKeyOf<TranslationKeys>;

// Utility function to validate translation keys at compile time
export function createTranslationKey<T extends TranslationKeyPath>(key: T): T {
  return key;
}

// Example usage:
// const key = createTranslationKey('pages.auth.login.title'); // ✅ Valid
// const invalidKey = createTranslationKey('pages.auth.login.invalid'); // ❌ TypeScript error