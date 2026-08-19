/**
 * GuardPay AI — i18n Initialisation
 * Bootstraps i18next with all 4 language resources.
 * Import this file once in App.tsx before any screens render.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translations } from './translations';

i18n
  .use(initReactI18next)
  .init({
    resources: translations,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    compatibilityJSON: 'v4',
  });

export default i18n;
