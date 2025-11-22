// MATCHING your AVAILABLE_LOCALES, DEFAULT_LOCALE, etc. EXACTLY:
// apps/mobile/src/app/core/i18n/i18n.config.ts
export const AVAILABLE_LOCALES = [
  { code: 'en', name: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'np', name: 'नेपाली', flag: '🇳🇵', dir: 'ltr' }
] as const;

export const DEFAULT_LOCALE = 'en';
export const FALLBACK_LOCALE = 'en';
export const LOCALE_STORAGE_KEY = 'locale';

// MATCHING your getStoredLocale function EXACTLY
export function getStoredLocale(): string {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && AVAILABLE_LOCALES.some(locale => locale.code === stored)) {
    return stored;
  }

  const browserLang = navigator.language.split('-')[0];
  if (AVAILABLE_LOCALES.some(locale => locale.code === browserLang)) {
    return browserLang;
  }

  return DEFAULT_LOCALE;
}

// MATCHING your setDocumentLanguage function EXACTLY
export function setDocumentLanguage(locale: string): void {
  const localeInfo = AVAILABLE_LOCALES.find(l => l.code === locale);
  if (localeInfo) {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeInfo.dir;
  }
}