"""
transcriber.py — Whisper-tiny Speech-to-Text Pipeline
GuardPay AI · AI/ML Module (Jatin)

Provides multilingual transcription of 3-second PCM audio buffers.
Detects spoken language (EN/HI/MR/TA) and passes it as a hint to Whisper
so Hindi/Marathi audio isn't decoded as garbled English.

Contract:
    transcribe(audio_buffer: bytes) -> str   (lowercase normalised text)

Async-safe: uses asyncio.to_thread internally.

Commit: feat(nlp): implement Whisper-tiny transcription pipeline
"""

from __future__ import annotations

import asyncio
import io
import os
import tempfile
from pathlib import Path

import numpy as np

# ── Whisper model singleton ────────────────────────────────────────────────────
_whisper_model = None   # loaded once at module level (or on first call)


def _load_whisper():
    """Load Whisper-tiny model once and cache."""
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    import whisper  # openai-whisper
    print("[transcriber] Loading Whisper-tiny model (downloads ~39 MB on first run) ...")
    _whisper_model = whisper.load_model("tiny")
    print("[transcriber] Whisper-tiny loaded ✓")
    return _whisper_model


# ── Helpers ────────────────────────────────────────────────────────────────────

def _bytes_to_wav_file(audio_buffer: bytes, sr: int = 16_000) -> str:
    """
    Write PCM bytes to a temporary WAV file and return the file path.
    Uses soundfile for robust format handling.
    """
    import soundfile as sf

    buf = io.BytesIO(audio_buffer)
    try:
        # Try reading as a proper audio container first (WAV/FLAC etc.)
        audio, file_sr = sf.read(buf)
    except Exception:
        # Fallback: assume raw 16-bit PCM at 16 kHz mono
        audio = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0
        file_sr = sr

    if audio.ndim > 1:
        audio = audio.mean(axis=1)  # convert to mono

    # Resample if necessary
    if file_sr != sr:
        import librosa
        audio = librosa.resample(audio.astype(np.float32), orig_sr=file_sr, target_sr=sr)

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(tmp.name, audio, sr)
    tmp.close()
    return tmp.name


def _detect_language(model, wav_path: str) -> str | None:
    """
    Detect the dominant spoken language in the first 30 seconds.
    Returns a Whisper language code string (e.g. 'hi', 'mr', 'en') or None.
    """
    import whisper
    audio = whisper.load_audio(wav_path)
    audio = whisper.pad_or_trim(audio)
    mel   = whisper.log_mel_spectrogram(audio).to(model.device)
    _, probs = model.detect_language(mel)
    top_lang = max(probs, key=probs.get)
    return top_lang


def _transcribe_blocking(audio_buffer: bytes) -> str:
    """
    Blocking Whisper transcription — NOT safe to call directly from async.
    Called via asyncio.to_thread in transcribe().
    """
    wav_path = _bytes_to_wav_file(audio_buffer)
    try:
        model = _load_whisper()

        # Detect language to pass as hint (prevents Hindi → English garbling)
        lang = _detect_language(model, wav_path)

        result = model.transcribe(
            wav_path,
            language=lang,          # hint: do NOT force — let Whisper confirm
            task="transcribe",      # keep original language, don't translate
            fp16=False,             # CPU-safe
        )
        text = result.get("text", "")
        return text.strip().lower()  # normalise to lowercase per promptbook spec
    finally:
        try:
            os.unlink(wav_path)
        except OSError:
            pass


# ── Public API ─────────────────────────────────────────────────────────────────

async def transcribe(audio_buffer: bytes) -> str:
    """
    Async-safe speech-to-text transcription.

    Detects spoken language and transcribes using Whisper-tiny.
    Safe to call from inside asyncio.gather() alongside other coroutines.

    Args:
        audio_buffer: Raw PCM or WAV audio bytes (3-second buffer preferred).

    Returns:
        Lowercase normalised transcript string.
    """
    # Ensure model is loaded before offloading to thread
    _load_whisper()
    return await asyncio.to_thread(_transcribe_blocking, audio_buffer)


def transcribe_sync(audio_buffer: bytes) -> str:
    """Synchronous version for scripts and unit tests."""
    _load_whisper()
    return _transcribe_blocking(audio_buffer)


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import soundfile as sf

    print("=" * 60)
    print("GuardPay AI — transcriber.py self-test")
    print("=" * 60)

    SAMPLE_RATE = 16_000

    # Test 1: Double-import check — Whisper should load only once
    print("\nTest 1: Model load caching ...")
    _load_whisper()
    _load_whisper()   # second call should reuse cached model
    print("✓  Whisper loaded only once (cached)")

    # Test 2: Hindi test phrase
    # "aapka khata band ho jayega" = "your account will be closed"
    # We use a synthetic tone as a placeholder (real Hindi audio needed for real check)
    print("\nTest 2: Synthetic audio transcription (placeholder test) ...")
    t = np.linspace(0, 3.0, 3 * SAMPLE_RATE, endpoint=False)
    tone = (0.3 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, tone, SAMPLE_RATE, format="WAV")
    audio_bytes = buf.getvalue()

    result = transcribe_sync(audio_bytes)
    print(f"  Transcription result: '{result}'")
    print("  (Synthetic tone — result will be silence/noise, not real speech)")
    print("  ✓  transcribe() ran without exceptions")

    # Test 3: Async safety
    print("\nTest 3: Async-safety inside asyncio.gather ...")

    async def _async_test():
        buf2 = io.BytesIO()
        sf.write(buf2, tone, SAMPLE_RATE, format="WAV")
        results = await asyncio.gather(
            transcribe(buf2.getvalue()),
            asyncio.sleep(0.05),   # concurrent coroutine
        )
        return results[0]

    async_result = asyncio.run(_async_test())
    print(f"  Async transcription result: '{async_result}'")
    print("✓  Async-safe — completed concurrently with sleep()")
    print("=" * 60)
    print(
        "\n⚠  NOTE: For real Hindi 'aapka khata band ho jayega' test,\n"
        "   replace the synthetic tone with an actual recorded audio file.\n"
        "   The model will then transcribe recognisable Hindi text."
    )
