/**
 * GuardPay AI — TTS Service (GuardPayUI)
 * Multi-lingual voice warning synthesizer.
 * Supports en (en-IN), hi (hi-IN), mr (mr-IN), ta (ta-IN).
 */

import * as Speech from 'expo-speech';

export type TTSLang = 'en' | 'hi' | 'mr' | 'ta';

const LANG_TO_LOCALE: Record<TTSLang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
};

const DEFAULT_RATE = 0.85;

/**
 * Speak the given text in the given language.
 */
export async function speak(text: string, lang: TTSLang = 'en'): Promise<void> {
  try {
    await stopSpeaking();
    const locale = LANG_TO_LOCALE[lang] ?? 'en-IN';

    Speech.speak(text, {
      language: locale,
      rate: DEFAULT_RATE,
      onError: (err) => {
        console.warn(`[GuardPay TTS] Speech error on ${locale}, falling back to en-IN:`, err);
        Speech.speak(text, { language: 'en-IN', rate: DEFAULT_RATE });
      },
    });
  } catch (err) {
    console.warn('[GuardPay TTS] TTS engine unavailable:', err);
  }
}

/**
 * Stop any currently playing TTS speech.
 */
export async function stopSpeaking(): Promise<void> {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}

export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
