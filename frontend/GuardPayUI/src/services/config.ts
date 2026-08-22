/**
 * GuardPay AI — API Configuration
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  ⚠️  THE BACKEND HOST IS THE ONLY THING YOU NORMALLY NEED TO EDIT.
 *      It lives in exactly one place: `DEVICE_LAN_HOST` a few lines below.
 *      Both the REST base URL and the WebSocket base URL are derived from the
 *      same resolved host, so they can never drift apart.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Three deployment cases:
 *
 *   1. ANDROID EMULATOR (default)
 *      The emulator sandboxes `localhost` to the emulator itself. The host
 *      machine is reachable on the special alias `10.0.2.2`.
 *      → Leave DEVICE_LAN_HOST = null. Auto-resolves to 10.0.2.2.
 *
 *   2. REAL ANDROID / iOS DEVICE (physical phone over USB or Wi-Fi)
 *      `localhost` on the phone is the PHONE, not your laptop — every API call
 *      silently fails and the app falls back to a fabricated risk score.
 *      → Set DEVICE_LAN_HOST to your dev machine's LAN IP, e.g. '192.168.1.42'
 *        (Windows: `ipconfig` → IPv4 Address; macOS/Linux: `ifconfig`/`ip addr`).
 *        The phone and the laptop must be on the SAME Wi-Fi network, and the
 *        backend must bind 0.0.0.0 (uvicorn --host 0.0.0.0) not 127.0.0.1.
 *
 *   3. WEB / iOS SIMULATOR (react-native-web, Metro in a browser, Jest)
 *      These share the host machine's network stack.
 *      → Leave DEVICE_LAN_HOST = null. Auto-resolves to `localhost`.
 *
 *  TODO: For production builds, source DEVICE_LAN_HOST / BACKEND_PORT from
 *  react-native-config or a .env file instead of this literal.
 */

import { Platform } from 'react-native';

// ─── ✏️  EDIT THIS ONE LINE FOR A REAL PHYSICAL DEVICE  ──────────────────────
// Example: export const DEVICE_LAN_HOST: string | null = '192.168.1.42';
// Leave as `null` for the Android emulator / web / iOS simulator (auto-detect),
// or when using USB port-forwarding (see USE_ADB_REVERSE below).
export const DEVICE_LAN_HOST: string | null = null;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CASE 4 — REAL DEVICE OVER USB WITH `adb reverse` (this project's demo setup).
 *
 *   adb reverse tcp:8000 tcp:8000
 *
 * That makes port 8000 ON THE PHONE tunnel to port 8000 on the laptop over USB,
 * so `localhost` becomes correct on a physical device — the opposite of case 2.
 * It needs no Wi-Fi, no LAN IP, and keeps working when the network changes, which
 * makes it the most reliable option for a live demo.
 *
 * Set to false if you are on the emulator (10.0.2.2) or connecting over Wi-Fi
 * (set DEVICE_LAN_HOST instead). DEVICE_LAN_HOST still overrides this.
 */
export const USE_ADB_REVERSE: boolean = true;

/** Backend port — Shanteshwar's FastAPI service defaults to 8000. */
export const BACKEND_PORT: number = 8000;

/** Host used when running inside the Android emulator (host-machine alias). */
const ANDROID_EMULATOR_HOST = '10.0.2.2';

/** Host used on web / iOS simulator, which share the host network stack. */
const LOOPBACK_HOST = 'localhost';

/**
 * Resolve the single backend host for this runtime.
 * Explicit DEVICE_LAN_HOST always wins; otherwise we pick a sensible default
 * per platform (see the three cases documented at the top of this file).
 */
function resolveBackendHost(): string {
  if (DEVICE_LAN_HOST && DEVICE_LAN_HOST.length > 0) {
    return DEVICE_LAN_HOST;
  }
  if (Platform.OS === 'android') {
    // With `adb reverse`, the phone's own localhost is tunnelled to the laptop,
    // so loopback is right on real hardware; 10.0.2.2 is emulator-only.
    return USE_ADB_REVERSE ? LOOPBACK_HOST : ANDROID_EMULATOR_HOST;
  }
  return LOOPBACK_HOST;
}

/** The single source of truth for where the backend lives. */
export const BACKEND_HOST: string = resolveBackendHost();

/** `host:port` — shared authority for both the HTTP and WS URLs. */
export const BACKEND_AUTHORITY: string = `${BACKEND_HOST}:${BACKEND_PORT}`;

// REST API base URL — must NOT end with a slash
export const API_BASE_URL: string = `http://${BACKEND_AUTHORITY}`;

// WebSocket base URL — derived from the SAME host so the two can never diverge
export const WS_BASE_URL: string = `ws://${BACKEND_AUTHORITY}`;

/**
 * Build an absolute REST URL from a path.
 * @example apiUrl('/api/v1/risk-score')
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Build an absolute WebSocket URL from a path — same host as apiUrl().
 * @example wsUrl('/ws/audio-stream')
 */
export function wsUrl(path: string): string {
  return `${WS_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// Axios / fetch default timeout in milliseconds (5s as per PromptBook Section 6)
export const API_TIMEOUT_MS: number = 5000;

// WebSocket reconnect settings (Section 7 — audio streaming)
export const WS_MAX_RETRIES: number = 3;
export const WS_RETRY_BASE_MS: number = 1000; // exponential backoff base

// Session status polling interval (Section 4 — InterceptScreen)
export const SESSION_POLL_INTERVAL_MS: number = 3000;

// One-time visibility in dev so a misconfigured host is obvious in Metro logs.
if (__DEV__) {
  console.log(
    `[GuardPay config] platform=${Platform.OS} host=${BACKEND_HOST} ` +
      `api=${API_BASE_URL} ws=${WS_BASE_URL}` +
      (DEVICE_LAN_HOST ? ' (DEVICE_LAN_HOST override)' : ' (auto-detected)')
  );
}
