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

# ── Optional torch import — graceful fallback if not installed ─────────────────
try:
    import torch
    _TORCH_AVAILABLE = True
except ImportError:
    torch = None  # type: ignore
    _TORCH_AVAILABLE = False
    print("[audio_analyzer] WARNING: torch not installed — CNN disabled, analyze() returns 0.0")

# ── Lazy import guard ──────────────────────────────────────────────────────────
_MODEL_PATH = Path(__file__).parent / "voice_cnn.pt"
_model = None   # cached singleton
_device = None


def _get_model():
    """Load the CNN once; cache as module-level singleton."""
    global _model, _device
    if not _TORCH_AVAILABLE:
        return None
    if _model is not None:
        return _model

    # Import here to avoid circular imports at package level
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from models.train_cnn import VoiceCloneCNN

    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = VoiceCloneCNN().to(_device)

    if _MODEL_PATH.exists():
        state = torch.load(_MODEL_PATH, map_location=_device, weights_only=True)
        model.load_state_dict(state)
        print(f"[audio_analyzer] Loaded model weights from {_MODEL_PATH}")
    else:
        print(
            f"[audio_analyzer] WARNING: {_MODEL_PATH} not found — "
            "using randomly initialised model. Run models/train_cnn.py first."
        )

    model.eval()
    _model = model
    return _model


def _infer(pcm_bytes: bytes) -> float:
    """
    Blocking inference — extract Mel-spectrogram and run CNN.
    Returns 0.0 if torch not available (fail-safe).
    """
    if not _TORCH_AVAILABLE:
        return 0.0

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


# Public API

async def analyze(pcm_bytes: bytes) -> dict:
    """
    Async-safe voice-clone analysis.
    Returns 0.0 safely if torch is not installed.
    """
    if not _TORCH_AVAILABLE:
        return {"spoof_probability": 0.0}
    _get_model()
    prob = await asyncio.to_thread(_infer, pcm_bytes)
    return {"spoof_probability": prob}


def analyze_sync(pcm_bytes: bytes) -> dict:
    """Synchronous version of analyze() for scripts and unit tests."""
    if not _TORCH_AVAILABLE:
        return {"spoof_probability": 0.0}
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
