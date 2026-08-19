/**
 * GuardPay AI — API Configuration
 *
 * TODO: Replace the hardcoded defaults below with environment-based config.
 * Use react-native-config or a .env file for production builds.
 * Shanteshwar's backend defaults to port 8000.
 */

// REST API base URL — must NOT end with a slash
export const API_BASE_URL: string = 'http://localhost:8000';

// WebSocket base URL — matches Shanteshwar's WS endpoint scheme
export const WS_BASE_URL: string = 'ws://localhost:8000';

// Axios default timeout in milliseconds (5s as per PromptBook Section 6)
export const API_TIMEOUT_MS: number = 5000;

// WebSocket reconnect settings (Section 7 — audio streaming)
export const WS_MAX_RETRIES: number = 3;
export const WS_RETRY_BASE_MS: number = 1000; // exponential backoff base

// Session status polling interval (Section 4 — InterceptScreen)
export const SESSION_POLL_INTERVAL_MS: number = 3000;
