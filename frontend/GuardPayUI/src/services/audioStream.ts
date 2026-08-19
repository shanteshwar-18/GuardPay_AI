/**
 * GuardPay AI — Audio Streaming Service
 * Captures 16kHz mono PCM audio in 3-second chunks and streams via WebSocket
 * to Shanteshwar's WS /ws/audio-stream endpoint.
 *
 * Prompt 10 (Section 7): Microphone Capture → WebSocket PCM Streaming
 */

import { WS_BASE_URL, WS_MAX_RETRIES, WS_RETRY_BASE_MS } from './config';

// TODO(React Native): Import when running on device
// import AudioRecord from 'react-native-audio-record';
// import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

type AudioChunkMessage = {
  chunk: string;       // base64-encoded PCM audio data
  session_id: string;  // UUID generated once per risk evaluation transaction
};

let ws: WebSocket | null = null;
let isStreaming = false;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let activeSessionId: string | null = null;

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function sendChunk(base64Chunk: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !activeSessionId) return;
  const msg: AudioChunkMessage = { chunk: base64Chunk, session_id: activeSessionId };
  ws.send(JSON.stringify(msg));
}

function connectWebSocket(sessionId: string) {
  if (ws) {
    ws.close();
    ws = null;
  }

  const url = `${WS_BASE_URL}/ws/audio-stream`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[AudioStream] WebSocket connected — session:', sessionId);
    retryCount = 0;
  };

  ws.onerror = err => {
    console.warn('[AudioStream] WebSocket error:', err);
  };

  ws.onclose = () => {
    if (!isStreaming) return; // Intentional close — no retry needed
    console.warn('[AudioStream] WebSocket closed unexpectedly. Retrying…');
    scheduleReconnect(sessionId);
  };
}

function scheduleReconnect(sessionId: string) {
  if (retryCount >= WS_MAX_RETRIES) {
    console.warn('[AudioStream] Max retries reached — audio stream stopped. REST risk call continues.');
    return;
  }
  const delayMs = WS_RETRY_BASE_MS * Math.pow(2, retryCount);
  retryCount++;
  retryTimer = setTimeout(() => connectWebSocket(sessionId), delayMs);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Request microphone permission and start streaming audio to the backend.
 * Call this when RiskEvalScreen mounts (alongside the risk-score REST call).
 *
 * @param sessionId A UUID generated once per transaction — reused for all chunks.
 */
export async function startAudioStream(sessionId: string): Promise<void> {
  if (isStreaming) {
    console.warn('[AudioStream] Already streaming — call stopAudioStream() first');
    return;
  }

  // TODO(Device): Request microphone permission
  // const permission = Platform.OS === 'ios'
  //   ? PERMISSIONS.IOS.MICROPHONE
  //   : PERMISSIONS.ANDROID.RECORD_AUDIO;
  // const result = await request(permission);
  // if (result !== RESULTS.GRANTED) {
  //   console.warn('[AudioStream] Microphone permission denied — showing inline message');
  //   // Show user-facing inline message — do NOT crash or throw
  //   return;
  // }

  activeSessionId = sessionId;
  isStreaming = true;
  retryCount = 0;

  connectWebSocket(sessionId);

  // TODO(Device): Configure and start AudioRecord
  // const options = { sampleRate: 16000, channels: 1, bitsPerSample: 16 };
  // AudioRecord.init(options);
  // AudioRecord.on('data', (base64Chunk: string) => sendChunk(base64Chunk));
  // AudioRecord.start();

  console.log('[AudioStream] Started — session:', sessionId);
}

/**
 * Stop microphone capture and close the WebSocket connection.
 * Call this when the flow reaches any outcome screen (Pin/Warning/Hold/Intercept)
 * or when the user cancels.
 */
export function stopAudioStream(): void {
  isStreaming = false;
  activeSessionId = null;

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  // TODO(Device): AudioRecord.stop();

  if (ws) {
    ws.close();
    ws = null;
  }

  console.log('[AudioStream] Stopped');
}

/**
 * Returns true if audio streaming is currently active.
 */
export function isStreamingActive(): boolean {
  return isStreaming;
}
