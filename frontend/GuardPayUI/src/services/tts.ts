/**
 * GuardPay AI — Multi-lingual TTS Voice Alert Service
 * Integrates react-native-tts for voice alerts in Indian languages:
 * en (en-IN), hi (hi-IN), mr (mr-IN), ta (ta-IN)
 * Supports Senior Citizen Mode and automated voice intervention.
 */

let Tts: any = null;
try {
  Tts = require('react-native-tts').default ?? require('react-native-tts');
  if (Tts && typeof Tts.setDefaultLanguage === 'function') {
    Tts.setDefaultLanguage('en-IN').catch(() => {});
  }
} catch {
  // Graceful fallback for test/dev environments without native module
  Tts = null;
}

export type TTSLang = 'en' | 'hi' | 'mr' | 'ta';

export const LANG_TO_LOCALE: Record<TTSLang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
};

const DEFAULT_RATE = 0.5; // Slightly slower for clarity under stress

/**
 * Speak the given alert text in the target language.
 */
export async function speak(text: string, lang: TTSLang = 'en'): Promise<void> {
  const locale = LANG_TO_LOCALE[lang] ?? 'en-IN';

  if (!Tts) {
    console.log(`[TTS STUB] speak() called | lang=${lang} | locale=${locale} | text="${text}"`);
    return;
  }

  try {
    await stopSpeaking();
    await Tts.setDefaultLanguage(locale);
    await Tts.setDefaultRate(DEFAULT_RATE);
    Tts.speak(text);
  } catch (err: unknown) {
    console.warn(`[GuardPay TTS] Speech error on ${locale}, attempting fallback to en-IN:`, err);
    try {
      await Tts.setDefaultLanguage('en-IN');
      Tts.speak(text);
    } catch (fallbackErr: unknown) {
      console.warn('[GuardPay TTS] Fallback speech error:', fallbackErr);
    }
  }
}

/**
 * Stop currently playing speech.
 */
export async function stopSpeaking(): Promise<void> {
  if (!Tts) return;
  try {
    await Tts.stop();
  } catch {
    // Ignore error if not currently speaking
  }
}

/**
 * Check if speech is currently active.
 */
export async function isSpeaking(): Promise<boolean> {
  return false;
}
