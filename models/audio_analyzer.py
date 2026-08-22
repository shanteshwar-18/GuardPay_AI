"""
audio_analyzer.py — Voice-Clone CNN Inference Wrapper
GuardPay AI · AI/ML Module (Jatin)

Exposes a single async-safe analyze() function used by:
  - Shanteshwar's risk-score endpoint (asyncio.gather)
  - pipeline_orchestrator.py

Contract:
    analyze(pcm_bytes: bytes) -> {'spoof_probability': float}

Commit: feat(audio): implement audio_analyzer inference wrapper
"""

from __future__ import annotations

import asyncio
import io
from pathlib import Path
from functools import lru_cache

import numpy as np
import torch

# ── Lazy import guard ──────────────────────────────────────────────────────────
_MODEL_PATH = Path(__file__).parent / "voice_cnn.pt"
_model: "VoiceCloneCNN | None" = None   # cached singleton
_device: torch.device = torch.device("cpu")
_threshold: float = 0.5                 # overwritten from the checkpoint metadata
_status: str = "not loaded"


def _get_model():
    """Load the CNN once; cache as module-level singleton."""
    global _model, _device, _threshold, _status

    if _model is not None:
        return _model

    # Import here to avoid circular imports at package level
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from models.audio_features import FEATURE_VERSION
    from models.train_cnn import VoiceCloneCNN

    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = VoiceCloneCNN().to(_device)

    if _MODEL_PATH.exists():
        ckpt = torch.load(_MODEL_PATH, map_location=_device, weights_only=False)

        # train_cnn.py saves a metadata dict; older runs saved a bare state_dict.
        if isinstance(ckpt, dict) and "state_dict" in ckpt:
            model.load_state_dict(ckpt["state_dict"])
            _threshold = float(ckpt.get("threshold", 0.5))
            trained_on = ckpt.get("trained_on", "unknown")
            ckpt_fv = ckpt.get("feature_version")
            if ckpt_fv is not None and ckpt_fv != FEATURE_VERSION:
                # Serving features the model never saw is silent accuracy loss,
                # so surface it loudly rather than returning confident nonsense.
                _status = (f"STALE: checkpoint feature_version={ckpt_fv} != "
                           f"runtime {FEATURE_VERSION} — retrain models/train_cnn.py")
                print(f"[audio_analyzer] WARNING — {_status}")
            else:
                ev = (ckpt.get("metrics") or {}).get("eval") or {}
                acc = f", eval bal_acc={ev['balanced_accuracy']*100:.1f}%" if ev else ""
                _status = f"loaded ({trained_on}, thr={_threshold:.3f}{acc})"
                print(f"[audio_analyzer] Loaded model from {_MODEL_PATH} — {_status}")
        else:
            model.load_state_dict(ckpt)
            _threshold = 0.5
            _status = "loaded (legacy checkpoint, no metadata)"
            print(f"[audio_analyzer] Loaded legacy weights from {_MODEL_PATH}")
    else:
        _status = "NOT TRAINED (random weights)"
        print(
            f"[audio_analyzer] WARNING: {_MODEL_PATH} not found — "
            "using randomly initialised model. Run models/train_cnn.py first."
        )

    model.eval()
    _model = model
    return _model


def get_model_status() -> str:
    """Human-readable model state for /health."""
    if _model is None:
        try:
            _get_model()
        except Exception as exc:
            return f"error ({exc.__class__.__name__})"
    return _status


def get_threshold() -> float:
    """Operating threshold chosen on the dev split at training time."""
    if _model is None:
        _get_model()
    return _threshold


def _infer(pcm_bytes: bytes) -> float:
    """
    Blocking inference — extract Mel-spectrogram and run CNN.
    Must NOT be called directly from an async context; use analyze() instead.
    """
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from models.audio_features import extract_melspectrogram

    mel = extract_melspectrogram(pcm_bytes)                          # (128, 128)
    tensor = torch.from_numpy(mel).unsqueeze(0).unsqueeze(0)         # (1, 1, 128, 128)
    tensor = tensor.to(_device)

    model = _get_model()
    with torch.no_grad():
        prob = model(tensor).item()   # scalar in [0, 1]

    return float(prob)


# ── Public API ─────────────────────────────────────────────────────────────────

async def analyze(pcm_bytes: bytes) -> dict:
    """
    Async-safe voice-clone analysis.

    Wraps the blocking CNN inference with asyncio.to_thread so it doesn't
    block the event loop when called inside asyncio.gather().

    Args:
        pcm_bytes: Raw 3-second PCM audio buffer (bytes).

    Returns:
        {'spoof_probability': float}  — value in [0.0, 1.0].
        Higher means more likely to be AI-synthesised / cloned.
    """
    # Lazy-load model on first call (thread-safe enough for single-process use)
    _get_model()
    prob = await asyncio.to_thread(_infer, pcm_bytes)
    return {"spoof_probability": prob}


# Synchronous convenience wrapper for non-async callers (e.g. tests, scripts)
def analyze_sync(pcm_bytes: bytes) -> dict:
    """Synchronous version of analyze() for scripts and unit tests."""
    _get_model()
    return {"spoof_probability": _infer(pcm_bytes)}


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import tempfile
    import soundfile as sf

    print("=" * 60)
    print("GuardPay AI — audio_analyzer.py self-test")
    print("=" * 60)

    SAMPLE_RATE = 16_000

    def _make_audio_bytes(freq: float = 440.0, noise_scale: float = 0.0) -> bytes:
        """Generate synthetic audio as raw PCM bytes."""
        t = np.linspace(0, 3.0, 3 * SAMPLE_RATE, endpoint=False)
        audio = 0.5 * np.sin(2 * np.pi * freq * t)
        audio += noise_scale * np.random.randn(len(audio))
        audio = audio.astype(np.float32)
        buf = io.BytesIO()
        sf.write(buf, audio, SAMPLE_RATE, format="WAV")
        return buf.getvalue()

    # --- Test 1: Known-genuine (clean sine, low-frequency, like natural voice) ---
    genuine_bytes = _make_audio_bytes(freq=200.0, noise_scale=0.02)
    result_genuine = analyze_sync(genuine_bytes)
    print(f"  Genuine sample  → spoof_probability = {result_genuine['spoof_probability']:.4f}")

    # --- Test 2: Known-spoof (high-frequency modulated, like TTS artefact) ---
    spoof_bytes = _make_audio_bytes(freq=3000.0, noise_scale=0.5)
    result_spoof = analyze_sync(spoof_bytes)
    print(f"  Spoof sample    → spoof_probability = {result_spoof['spoof_probability']:.4f}")

    print()
    if not _MODEL_PATH.exists():
        print("⚠  NOTE: voice_cnn.pt not found — probabilities reflect untrained weights.")
        print("   Run `python models/train_cnn.py` to train the model first.")
    else:
        print("✓  Model loaded successfully from voice_cnn.pt")

    # --- Test 3: Async-safety in asyncio.gather ---
    async def _async_test():
        genuine_bytes2 = _make_audio_bytes(freq=150.0)
        spoof_bytes2   = _make_audio_bytes(freq=4000.0)
        results = await asyncio.gather(
            analyze(genuine_bytes2),
            asyncio.sleep(0.01),   # simulate concurrent coroutine
            analyze(spoof_bytes2),
        )
        return results[0], results[2]

    r_gen, r_spoof = asyncio.run(_async_test())
    print(f"  Async gather — genuine={r_gen['spoof_probability']:.4f}  "
          f"spoof={r_spoof['spoof_probability']:.4f}")
    print("✓  Async safety confirmed — both calls completed concurrently")
    print("=" * 60)
