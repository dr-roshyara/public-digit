import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, SupportedLanguage } from './supported-languages';

export interface LanguageConfig {
  defaultLanguage: string;
  supportedLanguages: SupportedLanguage[];
  fallbackLanguage: string;
  storageKey: string;
}

export const LANGUAGE_CONFIG: LanguageConfig = {
  defaultLanguage: DEFAULT_LANGUAGE,
  supportedLanguages: SUPPORTED_LANGUAGES,
  fallbackLanguage: 'en',
  storageKey: 'public-digit-language'
};

export function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : 'Unknown';
}

export function getNativeLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? lang.nativeName : 'Unknown';
}