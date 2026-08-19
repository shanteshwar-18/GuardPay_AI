"""
pipeline_orchestrator.py — Asyncio AI Pipeline Orchestrator
GuardPay AI · AI/ML Module (Jatin)

Wires the full AI/ML pipeline in a single asyncio.gather() call:
  audio buffer → CNN (voice) + Whisper (transcript) → Llama (coercion) + risk fusion

Also exposes an SSE endpoint for real-time risk score push to the mobile app.

Designed to be imported by Shanteshwar's FastAPI backend.

Commits:
    feat(pipeline): wire live audio buffer → CNN → Whisper → Llama → risk score
    feat(pipeline): implement asyncio pipeline orchestrator with queue-based stages
    feat(pipeline): add SSE endpoint for real-time risk score push to mobile
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import AsyncGenerator

# ── Import AI modules (all async-safe) ────────────────────────────────────────
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from models.audio_analyzer   import analyze      as audio_analyze
from models.transcriber      import transcribe   as transcribe_audio
from models.coercion_engine  import classify_async as classify_coercion
from models.behaviour_analyzer import score_async as score_behaviour
from models.risk_fusion      import fuse_async   as fuse_risk

# ── Constants ──────────────────────────────────────────────────────────────────
PIPELINE_VERSION = "1.0.0"


# ── Core Pipeline ──────────────────────────────────────────────────────────────

async def run_pipeline(
    audio_bytes:       bytes | None = None,
    reputation_score:  float = 0.0,
    ocr_score:         float = 0.0,
    behaviour_event:   dict  | None = None,
    new_beneficiary:   bool  = False,
) -> dict:
    """
    Run the full AI detection pipeline concurrently using asyncio.gather.

    All AI modules run in parallel where possible:
      Stage 1 (parallel): audio_analyze + transcribe_audio + score_behaviour
      Stage 2 (serial):   classify_coercion (needs transcript from Stage 1)
      Stage 3 (serial):   fuse_risk (needs all signals)

    Args:
        audio_bytes:      Raw 3-second PCM/WAV buffer (None → skip voice/NLP)
        reputation_score: 0–1 from Shanteshwar's reputation_service
        ocr_score:        0–1 from OCR scam-phrase detector
        behaviour_event:  Device behaviour dict for Isolation Forest
        new_beneficiary:  Whether this is a first-time beneficiary

    Returns:
        Full risk output dict matching risk_fusion.fuse() format, plus debug info.
    """
    start_time = time.monotonic()
    behaviour_event = behaviour_event or {}

    # ── Stage 1: Parallel signal extraction ───────────────────────────────────
    if audio_bytes:
        voice_result, transcript, behaviour_result = await asyncio.gather(
            audio_analyze(audio_bytes),
            transcribe_audio(audio_bytes),
            score_behaviour(behaviour_event),
        )
        voice_score    = voice_result.get("spoof_probability", 0.0)
        transcript_text = transcript
    else:
        # No audio provided — skip voice and NLP signals
        voice_score     = 0.0
        transcript_text = ""
        behaviour_result = await score_behaviour(behaviour_event)

    # ── Stage 2: Coercion NLP (needs transcript) ───────────────────────────────
    if transcript_text:
        coercion_result = await classify_coercion(transcript_text)
        coercion_score  = coercion_result.get("score", 0.0)
        # If label is COERCIVE and score is low (e.g. Groq used), boost to 0.8
        if coercion_result.get("label") == "COERCIVE" and coercion_score < 0.5:
            coercion_score = 0.8
    else:
        coercion_result = {"label": "BENIGN", "score": 0.0}
        coercion_score  = 0.0

    anomaly_score = behaviour_result.get("anomaly_score", 0.0)

    # ── Stage 3: Risk fusion ───────────────────────────────────────────────────
    signals = {
        "voice_score":       voice_score,
        "coercion_score":    coercion_score,
        "ocr_score":         float(ocr_score),
        "reputation_score":  float(reputation_score),
        "new_beneficiary":   float(new_beneficiary),
        "anomaly_score":     anomaly_score,
    }
    fusion_result = await fuse_risk(signals)

    elapsed_ms = round((time.monotonic() - start_time) * 1000, 1)

    return {
        **fusion_result,
        "pipeline_version": PIPELINE_VERSION,
        "elapsed_ms":        elapsed_ms,
        "debug": {
            "voice_score":      round(voice_score, 4),
            "transcript":       transcript_text[:200] if transcript_text else "",
            "coercion_label":   coercion_result.get("label"),
            "coercion_score":   round(coercion_score, 4),
            "ocr_score":        round(float(ocr_score), 4),
            "reputation_score": round(float(reputation_score), 4),
            "new_beneficiary":  new_beneficiary,
            "anomaly_score":    round(anomaly_score, 4),
        },
    }


# ── SSE Stream ─────────────────────────────────────────────────────────────────

async def risk_score_sse_stream(
    audio_queue: asyncio.Queue,
    context: dict,
) -> AsyncGenerator[str, None]:
    """
    Server-Sent Events generator for real-time risk score updates.

    Reads audio chunks from audio_queue, runs the pipeline, and yields
    SSE-formatted strings that FastAPI can stream to the mobile app.

    Usage in FastAPI:
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            risk_score_sse_stream(queue, ctx),
            media_type="text/event-stream"
        )

    Args:
        audio_queue: asyncio.Queue of (bytes | None). Put None to signal end.
        context:     Static context dict (reputation_score, ocr_score, etc.)
    """
    last_risk_score = -1
    chunk_buffer    = b""
    CHUNK_DURATION  = 3.0   # seconds
    SAMPLE_RATE     = 16_000
    CHUNK_BYTES     = int(SAMPLE_RATE * CHUNK_DURATION * 2)   # 16-bit = 2 bytes/sample

    yield f"data: {json.dumps({'event': 'pipeline_started', 'version': PIPELINE_VERSION})}\n\n"

    while True:
        try:
            chunk = await asyncio.wait_for(audio_queue.get(), timeout=30.0)
        except asyncio.TimeoutError:
            yield f"data: {json.dumps({'event': 'timeout'})}\n\n"
            break

        if chunk is None:
            # Sentinel — pipeline done
            yield f"data: {json.dumps({'event': 'pipeline_complete'})}\n\n"
            break

        chunk_buffer += chunk

        # Process when we have ~3 seconds of audio
        if len(chunk_buffer) >= CHUNK_BYTES:
            audio_slice  = chunk_buffer[:CHUNK_BYTES]
            chunk_buffer = chunk_buffer[CHUNK_BYTES:]

            result = await run_pipeline(
                audio_bytes      = audio_slice,
                reputation_score = context.get("reputation_score", 0.0),
                ocr_score        = context.get("ocr_score", 0.0),
                behaviour_event  = context.get("behaviour_event", {}),
                new_beneficiary  = context.get("new_beneficiary", False),
            )

            # Only push update if risk_score changed
            if result["risk_score"] != last_risk_score:
                last_risk_score = result["risk_score"]
                payload = {
                    "event":      "risk_update",
                    "risk_score": result["risk_score"],
                    "risk_tier":  result["risk_tier"],
                    "shap_top3":  result["shap_top3"],
                    "elapsed_ms": result["elapsed_ms"],
                }
                yield f"data: {json.dumps(payload)}\n\n"


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import numpy as np

    SAMPLE_RATE = 16_000

    def _make_audio(freq: float = 440.0, duration: float = 3.0) -> bytes:
        """Generate a synthetic audio chunk as WAV bytes."""
        import soundfile as sf
        import io
        t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
        audio = (0.3 * np.sin(2 * np.pi * freq * t)).astype(np.float32)
        buf = io.BytesIO()
        sf.write(buf, audio, SAMPLE_RATE, format="WAV")
        return buf.getvalue()

    async def main():
        print("=" * 70)
        print("GuardPay AI — pipeline_orchestrator.py self-test")
        print("=" * 70)

        # Scenario A — Safe
        print("\n▶  Scenario A (Safe): clean audio, no coercion signals ...")
        result_a = await run_pipeline(
            audio_bytes      = _make_audio(440),
            reputation_score = 0.0,
            ocr_score        = 0.0,
            behaviour_event  = {"screen_share_active": 0, "payment_amount": 200},
            new_beneficiary  = False,
        )
        print(f"   risk_score={result_a['risk_score']}  tier={result_a['risk_tier']}  "
              f"elapsed={result_a['elapsed_ms']}ms")
        assert result_a["risk_tier"] in ("ALLOWED", "WARNING"), \
            f"Unexpected tier: {result_a['risk_tier']}"
        print("   ✓")

        # Scenario C — Red path
        print("\n▶  Scenario C (Red): high-frequency audio + reputation=0.8 + screen share ...")
        result_c = await run_pipeline(
            audio_bytes      = _make_audio(4000),
            reputation_score = 0.8,
            ocr_score        = 0.85,
            behaviour_event  = {
                "screen_share_active": 1, "tap_cadence_hz": 18,
                "app_switches_per_min": 30, "payment_amount": 750_000,
                "call_duration_sec": 2400, "beneficiary_is_new": 1,
            },
            new_beneficiary  = True,
        )
        print(f"   risk_score={result_c['risk_score']}  tier={result_c['risk_tier']}  "
              f"elapsed={result_c['elapsed_ms']}ms")
        print(f"   SHAP top-3:")
        for s in result_c["shap_top3"]:
            print(f"     - {s['factor']:20} {s['contribution']:+.4f}")
        print()

        print("✓ Pipeline orchestrator self-test complete")
        print("=" * 70)

    asyncio.run(main())
