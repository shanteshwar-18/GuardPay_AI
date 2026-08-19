/**
 * GuardPay AI — Language State
 * Persists the selected language to AsyncStorage and keeps i18next in sync.
 * Used by the language picker, WarningScreen, InterceptScreen, and the TTS stub.
 *
 * Using React Context (no external state library dependency).
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { SupportedLanguage } from '../i18n/translations';
import { TTSLang } from './tts';

const LANGUAGE_KEY = 'guardpay.language';

type LanguageState = {
  currentLanguage: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageState>({
  currentLanguage: 'en',
  setLanguage: async () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');

  // Restore persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then(stored => {
      if (stored && (stored === 'en' || stored === 'hi' || stored === 'mr' || stored === 'ta')) {
        setCurrentLanguage(stored as SupportedLanguage);
        i18n.changeLanguage(stored);
      }
    });
  }, []);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setCurrentLanguage(lang);
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}

/**
 * Helper: get the TTSLang from current language context value.
 * The two types are intentionally the same union — this is a type-safe bridge.
 */
export function toLang(lang: SupportedLanguage): TTSLang {
  return lang as TTSLang;
}
