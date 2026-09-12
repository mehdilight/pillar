import i18next, { type TOptions } from 'i18next';
import { createSignal } from 'solid-js';
import en from './en.json';
import fr from './fr.json';

export type Language = 'en' | 'fr';
export const LANGUAGE_STORAGE_KEY = 'pillar.language';

export function resolveLanguage(preferences: readonly string[]): Language {
  for (const preference of preferences) {
    const base = preference.toLowerCase().split(/[-_]/)[0];
    if (base === 'en' || base === 'fr') return base;
  }
  return 'en';
}

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'fr') return saved;
  } catch { /* Storage can be unavailable in private or embedded contexts. */ }
  return resolveLanguage(typeof navigator === 'undefined' ? [] : navigator.languages);
}

const [language, updateLanguage] = createSignal<Language>(initialLanguage());
export { language };
export const i18n = i18next.createInstance();
void i18n.init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: language(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'fr'],
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  // Solid inserts translations as text; it handles HTML escaping.
  interpolation: { escapeValue: false },
});

/** Reading the signal makes every JSX translation react to language changes. */
export function t(key: string, options?: TOptions): string {
  return i18n.t(key, { ...options, lng: language() }) as string;
}

export function setLanguage(next: Language): void {
  if (next !== 'en' && next !== 'fr') return;
  void i18n.changeLanguage(next);
  updateLanguage(next);
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Keep the in-memory preference. */ }
}

if (typeof document !== 'undefined') document.documentElement.lang = language();
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      const next = event.newValue === 'en' || event.newValue === 'fr'
        ? event.newValue : resolveLanguage(navigator.languages);
      void i18n.changeLanguage(next);
      updateLanguage(next);
      document.documentElement.lang = next;
    }
  });
}

export function formatDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(language(), options).format(new Date(value));
}

/** Plugins keep their own catalogs while sharing the host's reactive language. */
export function createTranslator(namespace: string, resources: Record<Language, Record<string, string>>) {
  for (const lang of ['en', 'fr'] as const) i18n.addResourceBundle(lang, namespace, resources[lang], true, true);
  return (key: string, options?: TOptions): string => t(key, { ...options, ns: namespace });
}
