"""
GuardPay AI — Real AI Services (replaces stub implementations)
Jatin (AI/ML Lead) — PROMPT 7 / Phase 4.3

This file REPLACES ai_stubs.py. It exposes the exact same async function
signatures that Shanteshwar's risk_score.py calls via asyncio.gather(),
but each function is wired to a real trained AI model.

Drop-in: no changes needed in risk_score.py — just update the import:
    FROM: from backend.services.ai_stubs import analyze_audio, ...
    TO:   from backend.services.ai_stubs import analyze_audio, ...
          (this file IS ai_stubs.py now — just pull jatin/ai-models)

Commit: feat(pipeline): wire live audio buffer -> CNN -> Whisper -> Llama -> risk score
"""

from __future__ import annotations

import asyncio
import base64
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Path: make models/ importable from backend/ ───────────────────────────────
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# ── Lazy-loaded model functions (heavy imports deferred to first call) ─────────
_audio_analyze_fn = None
_transcribe_fn    = None
_coercion_fn      = None
_behaviour_fn     = None


def _audio_analyzer():
    global _audio_analyze_fn
    if _audio_analyze_fn is None:
        from models.audio_analyzer import analyze
        _audio_analyze_fn = analyze
    return _audio_analyze_fn


def _transcriber():
    global _transcribe_fn
    if _transcribe_fn is None:
        from models.transcriber import transcribe
        _transcribe_fn = transcribe
    return _transcribe_fn


def _coercion_engine():
    global _coercion_fn
    if _coercion_fn is None:
        from models.coercion_engine import classify_async
        _coercion_fn = classify_async
    return _coercion_fn


def _behaviour_analyzer():
    global _behaviour_fn
    if _behaviour_fn is None:
        from models.behaviour_analyzer import score_async
        _behaviour_fn = score_async
    return _behaviour_fn


# ── Helper ────────────────────────────────────────────────────────────────────

def _b64_to_bytes(b64: str | None) -> bytes | None:
    if not b64:
        return None
    try:
        return base64.b64decode(b64)
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# REAL IMPLEMENTATIONS — same signatures as the stubs Shanteshwar calls
# ─────────────────────────────────────────────────────────────────────────────

async def analyze_audio(audio_base64: str | None) -> float:
    """
    Returns spoof_probability: 0.0 (real voice) → 1.0 (AI-cloned voice).
    REAL: base64 decode → 128×128 Mel-spectrogram → VoiceCloneCNN inference.
    Fail-safe: returns 0.0 on any error (never blocks a transaction).
    """
    audio_bytes = _b64_to_bytes(audio_base64)
    if not audio_bytes:
        return 0.0
    try:
        result = await _audio_analyzer()(audio_bytes)
        prob = float(result.get("spoof_probability", 0.0))
        logger.debug("[ai_stubs] spoof_prob=%.4f", prob)
        return prob
    except Exception as exc:
        logger.error("[ai_stubs] analyze_audio error: %s", exc, exc_info=True)
        return 0.0


async def transcribe_audio(audio_base64: str | None) -> str:
    """
    Returns transcript string from 3-second PCM chunk.
    REAL: base64 decode → Whisper-tiny (auto lang: EN/HI/MR/TA) → lowercase text.
    Fail-safe: returns "" on any error.
    """
    audio_bytes = _b64_to_bytes(audio_base64)
    if not audio_bytes:
        return ""
    try:
        transcript = await _transcriber()(audio_bytes)
        logger.debug("[ai_stubs] transcript='%s'", transcript[:60])
        return transcript
    except Exception as exc:
        logger.error("[ai_stubs] transcribe_audio error: %s", exc, exc_info=True)
        return ""


async def detect_coercion(transcript: str) -> float:
    """
    Returns coercion_score: 0.0 (benign) → 1.0 (highly coercive).
    REAL: TF-IDF fast-path (500 phrases, EN/HI/MR/TA) + Groq Llama 3 escalation.
    Fail-safe: returns 0.0 on any error.
    """
    if not transcript or not transcript.strip():
        return 0.0
    try:
        result = await _coercion_engine()(transcript)
        label = result.get("label", "BENIGN")
        score = float(result.get("score", 0.0))
        # If Groq classified COERCIVE but raw TF-IDF score is low, boost it
        if label == "COERCIVE" and score < 0.5:
            score = max(score, 0.75)
        logger.debug("[ai_stubs] coercion label=%s score=%.4f", label, score)
        return score
    except Exception as exc:
        logger.error("[ai_stubs] detect_coercion error: %s", exc, exc_info=True)
        return 0.0


async def analyze_behaviour(device_behaviour) -> float:
    """
    Returns behaviour_factor: 0.0 (normal) → 1.0 (high duress signals).
    REAL: maps DeviceBehaviour fields → 10-feature vector → Isolation Forest.
    Fail-safe: returns 0.0 on any error.
    """
    if device_behaviour is None:
        return 0.0
    try:
        # Support pydantic model or plain dict
        if hasattr(device_behaviour, "model_dump"):
            ev = device_behaviour.model_dump()
        elif hasattr(device_behaviour, "dict"):
            ev = device_behaviour.dict()
        elif isinstance(device_behaviour, dict):
            ev = device_behaviour
        else:
            ev = {}

        # Map Shanteshwar's DeviceBehaviour schema → our Isolation Forest features
        mapped = {
            "screen_share_active":    1 if ev.get("screen_share_duration_seconds", 0) > 0 else 0,
            "tap_cadence_hz":         15.0 if ev.get("app_switch_locked", False) else 1.5,
            "app_switches_per_min":   25 if ev.get("app_switch_locked", False) else 2,
            "payment_amount":         ev.get("payment_amount", 1000),
            "call_duration_sec":      ev.get("screen_share_duration_seconds", 0),
            "typing_speed_cps":       1.0 if ev.get("unusual_typing_cadence", False) else 5.0,
            "brightness_change":      0,
            "volume_change":          0,
            "beneficiary_is_new":     ev.get("beneficiary_is_new", 0),
            "time_since_last_txn_hr": ev.get("time_since_last_app_open_seconds", 86400) / 3600,
        }
        result = await _behaviour_analyzer()(mapped)
        score = float(result.get("anomaly_score", 0.0))
        logger.debug("[ai_stubs] anomaly_score=%.4f", score)
        return score
    except Exception as exc:
        logger.error("[ai_stubs] analyze_behaviour error: %s", exc, exc_info=True)
        return 0.0
