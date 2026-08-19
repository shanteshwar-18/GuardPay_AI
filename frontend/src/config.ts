/**
 * GuardPay AI — Frontend Configuration
 *
 * Centralised config object that reads from environment variables
 * (via expo-constants) with sensible defaults.
 *
 * Every screen imports `config.API_BASE_URL` instead of reading
 * process.env directly — a single source of truth for all backend URLs.
 */

import Constants from 'expo-constants';

interface GuardPayConfig {
  /** Base URL for REST API calls (e.g. POST /api/v1/risk-score) */
  API_BASE_URL: string;
  /** Base URL for WebSocket connections (e.g. WS /ws/audio-stream) */
  WS_BASE_URL: string;
  /** Default language code for TTS and i18n (en-IN, hi-IN, mr-IN, ta-IN) */
  DEFAULT_LANGUAGE: string;
  /** Whether Senior Citizen Mode is enabled by default on first launch */
  SENIOR_MODE_DEFAULT: boolean;
}

const extra = Constants.expirationDate ? {} : (Constants.expoConfig?.extra ?? {});

const config: GuardPayConfig = {
  API_BASE_URL:
    (extra as Record<string, string>).API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'http://localhost:8000',

  WS_BASE_URL:
    (extra as Record<string, string>).WS_BASE_URL ??
    process.env.EXPO_PUBLIC_WS_BASE_URL ??
    'ws://localhost:8000',

  DEFAULT_LANGUAGE:
    (extra as Record<string, string>).DEFAULT_LANGUAGE ??
    process.env.EXPO_PUBLIC_DEFAULT_LANGUAGE ??
    'en-IN',

  SENIOR_MODE_DEFAULT:
    ((extra as Record<string, string>).SENIOR_MODE_DEFAULT ??
      process.env.EXPO_PUBLIC_SENIOR_MODE_DEFAULT ??
      'false') === 'true',
};

export default config;
