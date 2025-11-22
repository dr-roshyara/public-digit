export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    flag: '🇺🇸'
  },
  {
    code: 'np',
    name: 'Nepali',
    nativeName: 'नेपाली',
    direction: 'ltr',
    flag: '🇳🇵'
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    flag: '🇩🇪'
  }
];

export const DEFAULT_LANGUAGE = 'en';

export function isValidLanguage(code: string): boolean {
  return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
}