import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de';
import en from './locales/en';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}

export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

// The language picked in the settings; without one, the browser decides.
const STORAGE_KEY = 'language';

const isLanguage = (value: string | null): value is Language =>
  LANGUAGES.some(language => language === value);

export const chosenLanguage = (): Language | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : null;
};

// The first of the browser's languages that the app speaks.
const browserLanguage = (): Language =>
  navigator.languages.map(tag => tag.split('-')[0]).find(isLanguage) ?? 'en';

// null follows the browser again.
export const chooseLanguage = (language: Language | null): void => {
  if (language === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, language);
  void i18n.changeLanguage(language ?? browserLanguage());
};

// Only ever set to one of LANGUAGES, by the init below and chooseLanguage.
export const currentLanguage = (): Language => i18n.language as Language;

// Numbers and dates follow the first of the browser's locales in the UI
// language, so that an English UI formats like en-GB for a British user and
// like en-US for an American one.
export const formatLocale = (): string =>
  navigator.languages.find(tag => tag.startsWith(i18n.language)) ??
  i18n.language;

i18n.on('languageChanged', language => {
  document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: chosenLanguage() ?? browserLanguage(),
  fallbackLng: 'en',
  // both languages are bundled, so `t` works right after init
  initAsync: false,
  // React escapes what it renders
  interpolation: { escapeValue: false },
});

export default i18n;
