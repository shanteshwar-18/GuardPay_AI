/**
 * GuardPay AI — Text-to-Speech Service
 *
 * Multilingual TTS helper for warning screens.
 * Supports EN, HI, MR, TA with fallback to en-IN.
 *
 * NOTE: Uses expo-speech instead of react-native-tts for Expo compatibility.
 * The API surface is identical to what the promptbook specifies.
 */

import * as Speech from 'expo-speech';

/** Supported language codes */
export type SupportedLanguage = 'EN' | 'HI' | 'MR' | 'TA';

/** Language code map: app language → device TTS language */
const LANGUAGE_MAP: Record<SupportedLanguage, string> = {
  EN: 'en-IN',
  HI: 'hi-IN',
  MR: 'mr-IN',
  TA: 'ta-IN',
};

/** Default speech settings for clear intelligibility under stress */
const DEFAULT_RATE = 0.8;  // Moderate — not sped through
const DEFAULT_PITCH = 1.0;

/**
 * Speak a warning message aloud in the specified language.
 *
 * Falls back to en-IN if the requested language is not available
 * on the device. Never crashes — swallows errors with a console warning.
 *
 * @param text  The warning text to speak
 * @param lang  The language code (EN, HI, MR, TA). Defaults to EN.
 */
export async function warn(
  text: string,
  lang: SupportedLanguage = 'EN'
): Promise<void> {
  try {
    // Stop any in-progress speech first
    await stopSpeech();

    const language = LANGUAGE_MAP[lang] ?? LANGUAGE_MAP.EN;

    Speech.speak(text, {
      language,
      rate: DEFAULT_RATE,
      pitch: DEFAULT_PITCH,
      onError: (error) => {
        console.warn(
          `[GuardPay TTS] Error with ${language}, falling back to en-IN:`,
          error
        );
        // Fallback: try en-IN
        Speech.speak(text, {
          language: 'en-IN',
          rate: DEFAULT_RATE,
          pitch: DEFAULT_PITCH,
        });
      },
    });
  } catch (error) {
    console.warn('[GuardPay TTS] TTS unavailable:', error);
    // Never crash the screen — TTS is an enhancement, not a requirement
  }
}

/**
 * Stop any in-progress speech.
 * Safe to call even if nothing is playing.
 */
export async function stopSpeech(): Promise<void> {
  try {
    Speech.stop();
  } catch {
    // Silently ignore — stop is best-effort
  }
}

/**
 * Check if the TTS engine is currently speaking.
 */
export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
