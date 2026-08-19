/**
 * GuardPay AI — TTS Stub
 * Defines the speak() interface consumed by WarningScreen and InterceptScreen.
 *
 * TODO(Raghav): Replace this stub with the real react-native-tts implementation.
 * Map lang to locale: en → en-IN, hi → hi-IN, mr → mr-IN, ta → ta-IN, fallback en-IN.
 * The speak() function signature MUST remain identical so screens need no changes.
 */

export type TTSLang = 'en' | 'hi' | 'mr' | 'ta';

const LANG_TO_LOCALE: Record<TTSLang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
};

/**
 * Speak the given text in the given language.
 * Currently a stub — logs the call so screens can be built and verified
 * without the real TTS engine being wired yet.
 */
export async function speak(text: string, lang: TTSLang = 'en'): Promise<void> {
  const locale = LANG_TO_LOCALE[lang] ?? 'en-IN';
  // TODO(Raghav): wire react-native-tts here
  // Example:
  //   import Tts from 'react-native-tts';
  //   await Tts.setDefaultLanguage(locale);
  //   await Tts.speak(text);
  console.log(`[TTS STUB] speak() called | lang=${lang} | locale=${locale} | text="${text}"`);
}

/**
 * Stop any currently playing TTS speech.
 * TODO(Raghav): wire react-native-tts stop() here.
 */
export async function stopSpeaking(): Promise<void> {
  // TODO(Raghav): Tts.stop();
  console.log('[TTS STUB] stopSpeaking() called');
}
