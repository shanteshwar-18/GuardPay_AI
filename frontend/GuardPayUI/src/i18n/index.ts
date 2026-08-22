/**
 * GuardPay AI — i18n Initialisation
 * Bootstraps i18next with all 4 language resources.
 * Import this file once in App.tsx before any screens render.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { screenTranslations } from './screens';
import { translations } from './translations';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr', 'ta'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Merge the two dictionaries into one resource bundle per language.
 *
 * `translations.ts` holds the original risk-message keys and `screens.ts` holds the
 * screen-level namespaces. They are merged rather than concatenated so a namespace
 * defined in both (e.g. `common`) keeps the union of its keys instead of one file
 * silently clobbering the other.
 */
function deepMerge(base: Record<string, any>, extra: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const existing = out[key];
    out[key] =
      existing && typeof existing === 'object' && !Array.isArray(existing) &&
      value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(existing, value)
        : value;
  }
  return out;
}

const resources = SUPPORTED_LANGUAGES.reduce((acc, lang) => {
  acc[lang] = {
    translation: deepMerge(
      (translations as any)[lang]?.translation ?? {},
      (screenTranslations as any)[lang] ?? {},
    ),
  };
  return acc;
}, {} as Record<string, { translation: Record<string, any> }>);

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    compatibilityJSON: 'v4',
  });

export default i18n;
