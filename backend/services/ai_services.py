"""
ai_services.py — Real AI Module Wiring for GuardPay AI Backend
Jatin (AI/ML Lead) — Phase 4.3 / PROMPT 7

This module REPLACES backend/services/ai_stubs.py.
It exposes the same async function signatures Shanteshwar's backend calls,
but wired to real CNN / Whisper / Llama 3 / IsolationForest models.

Drop-in replacement: in backend/routers/risk_score.py change:
    from backend.services.ai_stubs import analyze_audio, transcribe_audio, detect_coercion
to:
    from backend.services.ai_services import analyze_audio, transcribe_audio, detect_coercion

All functions are async-safe (use asyncio.to_thread internally).

Commit: feat(pipeline): wire live audio buffer → CNN → Whisper → Llama → risk score
"""

from __future__ import annotations

import asyncio
import base64
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Path setup so models/ package is importable from backend/ ─────────────────
_PROJECT_ROOT = Path(__file__).parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))


# ── Lazy imports (avoid heavy load at module level) ───────────────────────────
_audio_analyzer    = None
_transcriber       = None
_coercion_engine   = None
_behaviour_analyzer = None


def _get_audio_analyzer():
    global _audio_analyzer
    if _audio_analyzer is None:
        from models.audio_analyzer import analyze as _fn
        _audio_analyzer = _fn
    return _audio_analyzer


def _get_transcriber():
    global _transcriber
    if _transcriber is None:
        from models.transcriber import transcribe as _fn
        _transcriber = _fn
    return _transcriber


def _get_coercion_engine():
    global _coercion_engine
    if _coercion_engine is None:
        from models.coercion_engine import classify_async as _fn
        _coercion_engine = _fn
    return _coercion_engine


def _get_behaviour_analyzer():
    global _behaviour_analyzer
    if _behaviour_analyzer is None:
        from models.behaviour_analyzer import score_async as _fn
        _behaviour_analyzer = _fn
    return _behaviour_analyzer


# ── Helper: base64 → bytes ────────────────────────────────────────────────────

def _b64_to_bytes(b64: str | None) -> bytes | None:
    """Decode base64 audio string to raw bytes. Returns None if invalid."""
    if not b64:
        return None
    try:
        return base64.b64decode(b64)
    except Exception as exc:
        logger.warning(f"[ai_services] base64 decode failed: {exc}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API — same signatures as ai_stubs.py
# ─────────────────────────────────────────────────────────────────────────────

async def analyze_audio(audio_base64: str | None) -> float:
    """
    REAL implementation (replaces stub).
    Returns spoof_probability: 0.0 (genuine) → 1.0 (AI-cloned voice).

    Decodes base64 PCM → runs VoiceCloneCNN on 128x128 Mel-spectrogram.
    Safe to call from asyncio.gather().
    """
    audio_bytes = _b64_to_bytes(audio_base64)
    if not audio_bytes:
        return 0.0
    try:
        result = await _get_audio_analyzer()(audio_bytes)
        prob = float(result.get("spoof_probability", 0.0))
        logger.debug(f"[ai_services] spoof_probability={prob:.4f}")
        return prob
    except Exception as exc:
        logger.error(f"[ai_services] analyze_audio failed: {exc}", exc_info=True)
        return 0.0   # fail-safe: don't block transaction on model error


async def transcribe_audio(audio_base64: str | None) -> str:
    """
    REAL implementation (replaces stub).
    Returns lowercase transcript string from 3-second PCM chunk.

    Decodes base64 → Whisper-tiny with language detection (EN/HI/MR/TA).
    Safe to call from asyncio.gather().
    """
    audio_bytes = _b64_to_bytes(audio_base64)
    if not audio_bytes:
        return ""
    try:
        transcript = await _get_transcriber()(audio_bytes)
        logger.debug(f"[ai_services] transcript='{transcript[:80]}...'")
        return transcript
    except Exception as exc:
        logger.error(f"[ai_services] transcribe_audio failed: {exc}", exc_info=True)
        return ""


async def detect_coercion(transcript: str) -> float:
    """
    REAL implementation (replaces stub).
    Returns coercion_score: 0.0 (benign) → 1.0 (highly coercive).

    Two-path: TF-IDF fast path, escalates to Groq Llama 3 if uncertain.
    """
    if not transcript or not transcript.strip():
        return 0.0
    try:
        result = await _get_coercion_engine()(transcript)
        label  = result.get("label", "BENIGN")
        score  = float(result.get("score", 0.0))
        # If label is COERCIVE but TF-IDF score is low (Groq path), boost score
        if label == "COERCIVE" and score < 0.5:
            score = max(score, 0.75)
        logger.debug(f"[ai_services] coercion label={label} score={score:.4f}")
        return score
    except Exception as exc:
        logger.error(f"[ai_services] detect_coercion failed: {exc}", exc_info=True)
        return 0.0


async def analyze_behaviour(device_behaviour) -> float:
    """
    REAL implementation (replaces stub).
    Returns behaviour_factor: 0.0 (normal) → 1.0 (high duress signals).

    Uses Isolation Forest trained on synthetic normal behaviour data.
    Accepts Shanteshwar's DeviceBehaviour pydantic model or a plain dict.
    """
    if device_behaviour is None:
        return 0.0
    try:
        # Convert DeviceBehaviour pydantic model → dict if needed
        if hasattr(device_behaviour, "model_dump"):
            event = device_behaviour.model_dump()
        elif hasattr(device_behaviour, "dict"):
            event = device_behaviour.dict()
        elif isinstance(device_behaviour, dict):
            event = device_behaviour
        else:
            event = {}

        # Map Shanteshwar's field names → our behaviour_analyzer field names
        mapped = {
            "screen_share_active":   1 if event.get("screen_share_duration_seconds", 0) > 0 else 0,
            "tap_cadence_hz":        2.0,   # not in schema — use default
            "app_switches_per_min":  20 if event.get("app_switch_locked", False) else 2,
            "payment_amount":        event.get("payment_amount", 1000),
            "call_duration_sec":     event.get("screen_share_duration_seconds", 0),
            "typing_speed_cps":      1.5 if event.get("unusual_typing_cadence", False) else 5.0,
            "brightness_change":     0,
            "volume_change":         0,
            "beneficiary_is_new":    event.get("beneficiary_is_new", 0),
            "time_since_last_txn_hr": event.get("time_since_last_app_open_seconds", 86400) / 3600,
        }

        result = await _get_behaviour_analyzer()(mapped)
        score  = float(result.get("anomaly_score", 0.0))
        logger.debug(f"[ai_services] anomaly_score={score:.4f}")
        return score
    except Exception as exc:
        logger.error(f"[ai_services] analyze_behaviour failed: {exc}", exc_info=True)
        return 0.0


# ─────────────────────────────────────────────────────────────────────────────
# FULL PIPELINE — called by risk_score.py in asyncio.gather()
# ─────────────────────────────────────────────────────────────────────────────

async def run_full_pipeline(req) -> dict:
    """
    Run all AI signals concurrently for a RiskScoreRequest.
    Called by backend/routers/risk_score.py to replace _placeholder_risk().

    Returns a signals dict compatible with backend/services/risk_fusion.compute_risk().

    Usage in risk_score.py:
        from backend.services.ai_services import run_full_pipeline
        signals = await run_full_pipeline(req)
        score, factors = compute_risk(signals)
    """
    # Stage 1: parallel signal extraction
    voice_prob, transcript, behaviour_score = await asyncio.gather(
        analyze_audio(req.audio_base64),
        transcribe_audio(req.audio_base64),
        analyze_behaviour(req.device_behaviour),
    )

    # Stage 2: coercion NLP needs the transcript
    coercion_score = await detect_coercion(transcript) if transcript else 0.0

    # OCR score — passed directly from req (already computed by backend OCR router)
    ocr_score = getattr(req, "ocr_score", 0.0) or 0.0

    # Reputation & new_beneficiary — from Shanteshwar's reputation_service
    # (passed in req or computed by backend; default 0 if not present)
    reputation_score  = float(getattr(req, "reputation_score",  0.0) or 0.0)
    new_beneficiary   = float(getattr(req, "new_beneficiary",   0.0) or 0.0)

    signals = {
        "audio":            voice_prob,
        "text":             coercion_score,
        "ocr":              ocr_score,
        "reputation":       reputation_score,
        "new_beneficiary":  new_beneficiary,
        "device_behaviour": behaviour_score,
    }

    logger.info(
        f"[ai_services] pipeline signals: "
        f"voice={voice_prob:.3f} coercion={coercion_score:.3f} "
        f"ocr={ocr_score:.3f} rep={reputation_score:.3f} "
        f"new_ben={new_beneficiary:.1f} anomaly={behaviour_score:.3f}"
    )
    return signals
