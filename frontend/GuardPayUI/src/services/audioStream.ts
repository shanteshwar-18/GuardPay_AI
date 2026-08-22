/**
 * GuardPay AI — Audio Streaming Service
 * Captures 16 kHz mono 16-bit PCM audio, buffers it into 3-second windows and
 * streams each window (base64) via WebSocket to the backend's
 * WS /ws/audio-stream endpoint.
 *
 * Prompt 10 (Section 7): Microphone Capture → WebSocket PCM Streaming
 *
 * Native modules are lazily required inside try/catch (same defensive pattern
 * as services/tts.ts) so the JS bundle still runs in Jest / web / a build where
 * react-native-audio-record has not been linked.
 */

import { Platform, PermissionsAndroid } from 'react-native';
import { WS_MAX_RETRIES, WS_RETRY_BASE_MS, wsUrl } from './config';

// ─── Lazy native module (never hard-crash if it is absent) ────────────────────

let AudioRecord: any = null;
try {
  const mod = require('react-native-audio-record');
  AudioRecord = mod?.default ?? mod ?? null;
} catch {
  // Graceful fallback for test/dev environments without the native module
  AudioRecord = null;
}

// ─── Capture configuration ────────────────────────────────────────────────────

const SAMPLE_RATE = 16000;    // Hz — backend model expects 16 kHz
const CHANNELS = 1;           // mono
const BITS_PER_SAMPLE = 16;   // signed 16-bit PCM
const WINDOW_SECONDS = 3;     // backend consumes 3-second windows

/** 3 s × 16000 Hz × 2 bytes = 96 000 bytes of raw PCM per window. */
const WINDOW_PCM_BYTES = WINDOW_SECONDS * SAMPLE_RATE * (BITS_PER_SAMPLE / 8);

type AudioChunkMessage = {
  chunk: string;       // base64-encoded PCM audio data (one 3-second window)
  session_id: string;  // UUID generated once per risk evaluation transaction
};

// ─── Module state ─────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let isStreaming = false;
let isRecording = false;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let activeSessionId: string | null = null;

/** Accumulated PCM bytes waiting to reach a full 3-second window. */
let pcmBuffer: Uint8Array[] = [];
let pcmBufferedBytes = 0;

/** Subscription/callback handle returned by AudioRecord.on('data', …). */
let dataSubscription: { remove?: () => void } | null = null;
let dataListener: ((base64Chunk: string) => void) | null = null;

// ─── Base64 codec ─────────────────────────────────────────────────────────────
// The library emits one base64 string per native buffer. Those strings CANNOT
// simply be concatenated (a buffer whose length is not a multiple of 3 ends in
// '=' padding), so we decode to bytes, accumulate, and re-encode per window.

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i++) {
  B64_LOOKUP[B64_ALPHABET.charAt(i)] = i;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let p = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_LOOKUP[clean.charAt(i)];
    if (v === undefined) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[p++] = (acc >> bits) & 0xff;
    }
  }
  return p === out.length ? out : out.slice(0, p);
}

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64_ALPHABET.charAt((n >> 18) & 63) +
      B64_ALPHABET.charAt((n >> 12) & 63) +
      B64_ALPHABET.charAt((n >> 6) & 63) +
      B64_ALPHABET.charAt(n & 63);
  }
  const rem = len - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64_ALPHABET.charAt((n >> 18) & 63) + B64_ALPHABET.charAt((n >> 12) & 63) + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      B64_ALPHABET.charAt((n >> 18) & 63) +
      B64_ALPHABET.charAt((n >> 12) & 63) +
      B64_ALPHABET.charAt((n >> 6) & 63) +
      '=';
  }
  return out;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function sendChunk(base64Chunk: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !activeSessionId) return;
  const msg: AudioChunkMessage = { chunk: base64Chunk, session_id: activeSessionId };
  ws.send(JSON.stringify(msg));
}

function resetPcmBuffer() {
  pcmBuffer = [];
  pcmBufferedBytes = 0;
}

/** Concatenate the buffered PCM, encode it and push it down the socket. */
function flushWindow() {
  if (pcmBufferedBytes === 0) return;
  const merged = new Uint8Array(pcmBufferedBytes);
  let offset = 0;
  for (const part of pcmBuffer) {
    merged.set(part, offset);
    offset += part.length;
  }
  resetPcmBuffer();
  sendChunk(bytesToBase64(merged));
}

/**
 * Called for every native buffer. Accumulates bytes and emits exactly one
 * WS message per completed 3-second window.
 */
function handleNativeChunk(base64Chunk: string) {
  if (!isStreaming || !base64Chunk) return;
  try {
    const bytes = base64ToBytes(base64Chunk);
    if (bytes.length === 0) return;
    pcmBuffer.push(bytes);
    pcmBufferedBytes += bytes.length;
    while (pcmBufferedBytes >= WINDOW_PCM_BYTES) {
      flushWindow();
    }
  } catch (err) {
    console.warn('[AudioStream] Failed to buffer audio chunk:', err);
  }
}

function connectWebSocket(sessionId: string) {
  if (ws) {
    ws.close();
    ws = null;
  }

  const url = wsUrl('/ws/audio-stream');
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

function startRecorder(): boolean {
  if (isRecording) return true;
  if (!AudioRecord || typeof AudioRecord.init !== 'function') {
    console.warn(
      '[AudioStream] react-native-audio-record unavailable — running without ' +
        'microphone capture (WebSocket stays open, no PCM will be sent).'
    );
    return false;
  }

  try {
    AudioRecord.init({
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
      audioSource: 6,             // Android VOICE_RECOGNITION — tuned for speech
      wavFile: 'guardpay-capture.wav',
    });

    dataListener = handleNativeChunk;
    dataSubscription = AudioRecord.on('data', dataListener) ?? null;
    AudioRecord.start();
    isRecording = true;
    console.log(
      `[AudioStream] Recording at ${SAMPLE_RATE}Hz/${CHANNELS}ch/${BITS_PER_SAMPLE}bit — ` +
        `${WINDOW_SECONDS}s windows (${WINDOW_PCM_BYTES} PCM bytes each)`
    );
    return true;
  } catch (err) {
    console.warn('[AudioStream] Failed to start microphone capture:', err);
    isRecording = false;
    return false;
  }
}

function stopRecorder() {
  if (!isRecording) {
    // Still clear any dangling listener so start/stop stays idempotent.
    detachDataListener();
    return;
  }
  isRecording = false;

  try {
    if (AudioRecord && typeof AudioRecord.stop === 'function') {
      const maybePromise = AudioRecord.stop();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[AudioStream] Error stopping microphone capture:', err);
  }

  detachDataListener();
}

function detachDataListener() {
  try {
    if (dataSubscription && typeof dataSubscription.remove === 'function') {
      dataSubscription.remove();
    } else if (AudioRecord && typeof AudioRecord.removeAllListeners === 'function') {
      AudioRecord.removeAllListeners('data');
    } else if (AudioRecord && dataListener && typeof AudioRecord.off === 'function') {
      AudioRecord.off('data', dataListener);
    }
  } catch (err) {
    console.warn('[AudioStream] Error removing audio data listener:', err);
  }
  dataSubscription = null;
  dataListener = null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Request the Android RECORD_AUDIO runtime permission (Android 6+).
 * The manifest declaration alone is NOT enough — without this the mic is
 * silently denied on every device from API 23 onwards.
 *
 * Uses React Native's built-in PermissionsAndroid (no react-native-permissions
 * dependency, so there is no extra native module that can be missing).
 *
 * @returns true if capture may proceed, false if the user denied it.
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  // iOS/web: nothing to request here (iOS is handled by Info.plist at capture time).
  if (Platform.OS !== 'android') return true;

  try {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    if (already) return true;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Allow GuardPay to use the microphone',
        message:
          'GuardPay listens to the ongoing call only while a payment is being ' +
          'checked, so it can detect cloned voices and coercion. Audio is not ' +
          'stored on your phone.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
        buttonNeutral: 'Ask me later',
      }
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('[AudioStream] RECORD_AUDIO permission granted');
      return true;
    }
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      console.warn(
        '[AudioStream] RECORD_AUDIO permanently denied — the user must enable ' +
          'the microphone from Android Settings › Apps › GuardPay › Permissions. ' +
          'Continuing without voice analysis.'
      );
      return false;
    }
    console.warn('[AudioStream] RECORD_AUDIO permission denied — continuing without voice analysis.');
    return false;
  } catch (err) {
    console.warn('[AudioStream] Permission request failed (degrading gracefully):', err);
    return false;
  }
}

/**
 * Request microphone permission and start streaming audio to the backend.
 * Call this when RiskEvalScreen mounts (alongside the risk-score REST call).
 *
 * Idempotent: calling it while already streaming is a no-op.
 * Never throws — a denied permission or a missing native module degrades to
 * "no audio", and the REST risk call continues unaffected.
 *
 * @param sessionId A UUID generated once per transaction — reused for all chunks.
 */
export async function startAudioStream(sessionId: string): Promise<void> {
  if (isStreaming) {
    console.warn('[AudioStream] Already streaming — call stopAudioStream() first');
    return;
  }

  // Audio capture must NOT start unless the runtime permission was granted.
  const granted = await ensureMicrophonePermission();
  if (!granted) {
    console.warn('[AudioStream] Microphone unavailable — skipping audio stream for this transaction.');
    return;
  }

  activeSessionId = sessionId;
  isStreaming = true;
  retryCount = 0;
  resetPcmBuffer();

  connectWebSocket(sessionId);
  startRecorder();

  console.log('[AudioStream] Started — session:', sessionId);
}

/**
 * Stop microphone capture and close the WebSocket connection.
 * Call this when the flow reaches any outcome screen (Pin/Warning/Hold/Intercept)
 * or when the user cancels. Idempotent — safe to call repeatedly.
 */
export function stopAudioStream(): void {
  isStreaming = false;
  activeSessionId = null;

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  stopRecorder();

  // Partial (< 3 s) windows are dropped — the backend only accepts full windows.
  if (pcmBufferedBytes > 0) {
    console.log(`[AudioStream] Dropping ${pcmBufferedBytes} bytes of partial window`);
  }
  resetPcmBuffer();

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

/**
 * Returns true if the native recorder is actually capturing (as opposed to the
 * WebSocket merely being open). Useful for showing an inline "mic unavailable"
 * hint in the UI.
 */
export function isMicrophoneCapturing(): boolean {
  return isRecording;
}
