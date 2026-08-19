"""
risk_fusion.py — 6-Factor Weighted Risk Score Engine
GuardPay AI · AI/ML Module (Jatin)

Fuses six detection signals into a calibrated 0–100 risk score with
Platt scaling (LogisticRegression calibrator) and SHAP explainability.

Six factors:
  W1 - voice_score       (audio_analyzer: spoof_probability)
  W2 - coercion_score    (coercion_engine: label / score)
  W3 - ocr_score         (ocr_engine: scam phrase match rate)
  W4 - reputation_score  (backend: beneficiary complaint score)
  W5 - new_beneficiary   (backend: is first-time beneficiary)
  W6 - anomaly_score     (behaviour_analyzer: isolation forest score)

Contract:
    fuse(signals: dict) -> {
        'risk_score':   int in [0, 100],
        'risk_tier':    'ALLOWED' | 'WARNING' | 'ELEVATED' | 'HARD_INTERCEPT',
        'shap_top3':    list[dict],
        'raw_weighted': float,
    }

Commits:
    feat(fusion): implement 6-factor weighted risk score engine
    feat(fusion): add Platt scaling calibration for 0-100 output
    feat(fusion): add SHAP explainability output per transaction
"""

from __future__ import annotations

import asyncio
import os
import pickle
from pathlib import Path

import numpy as np

# ── Paths ──────────────────────────────────────────────────────────────────────
PROJECT_ROOT    = Path(__file__).parent.parent
CALIBRATOR_PATH = PROJECT_ROOT / "models" / "calibrator.pkl"

# ── Risk tier thresholds ───────────────────────────────────────────────────────
THRESHOLD_WARNING   = int(os.getenv("RISK_THRESHOLD_WARNING",   40))
THRESHOLD_ELEVATED  = int(os.getenv("RISK_THRESHOLD_ELEVATED",  70))
THRESHOLD_INTERCEPT = int(os.getenv("RISK_THRESHOLD_INTERCEPT", 90))

# ── Factor weights ─────────────────────────────────────────────────────────────
# Weights sum to 1.0. Increase W2/W3 if CNN accuracy < 85%.
FACTOR_NAMES   = ["voice", "coercion", "ocr", "reputation", "new_beneficiary", "anomaly"]
FACTOR_WEIGHTS = np.array([0.25, 0.25, 0.15, 0.15, 0.10, 0.10], dtype=np.float32)

assert abs(FACTOR_WEIGHTS.sum() - 1.0) < 1e-6, "Weights must sum to 1.0"


# ── Calibrator ─────────────────────────────────────────────────────────────────

_calibrator = None   # LogisticRegression Platt scaler (loaded/built lazily)


def _build_synthetic_calibrator():
    """
    Build a Platt-scaling LogisticRegression calibrator from synthetic data.
    Used before real feedback data is available.
    """
    from sklearn.linear_model import LogisticRegression

    # Synthetic: raw_score < 0.4 → safe (label 0), > 0.7 → risky (label 1)
    rng = np.random.default_rng(42)
    safe_scores   = rng.uniform(0.0, 0.4, 200).reshape(-1, 1)
    risky_scores  = rng.uniform(0.6, 1.0, 200).reshape(-1, 1)
    X = np.vstack([safe_scores, risky_scores])
    y = np.array([0] * 200 + [1] * 200)

    clf = LogisticRegression(C=1.0, random_state=42)
    clf.fit(X, y)
    return clf


def _load_calibrator():
    global _calibrator
    if _calibrator is not None:
        return _calibrator

    if CALIBRATOR_PATH.exists():
        with open(CALIBRATOR_PATH, "rb") as f:
            _calibrator = pickle.load(f)
        print(f"[risk_fusion] Loaded calibrator from {CALIBRATOR_PATH} ✓")
    else:
        _calibrator = _build_synthetic_calibrator()
        print("[risk_fusion] Using synthetic-trained calibrator (no calibrator.pkl found)")

    return _calibrator


def _calibrate(raw_score: float) -> float:
    """Apply Platt scaling: raw weighted score → probability in [0, 1]."""
    cal = _load_calibrator()
    prob = cal.predict_proba([[raw_score]])[0][1]   # P(class=1)
    return float(prob)


# ── SHAP explainability ────────────────────────────────────────────────────────

def _compute_shap(factor_values: np.ndarray) -> list[dict]:
    """
    Compute SHAP-style attribution for each factor.
    Uses a simplified LinearExplainer on the weighted sum (exact for linear models).

    Returns top-3 contributing factors as a list of dicts:
        [{'factor': str, 'contribution': float, 'value': float}, ...]
    """
    try:
        import shap
        cal = _load_calibrator()

        # Create a minimal background dataset (mean of all-zero signals)
        background = np.zeros((1, 1), dtype=np.float32)
        explainer  = shap.LinearExplainer(cal, background)

        raw = float(np.dot(FACTOR_WEIGHTS, factor_values))
        shap_values = explainer.shap_values(np.array([[raw]]))[0]

        # Attribute SHAP value proportionally by factor weight × factor value
        contributions = FACTOR_WEIGHTS * factor_values
        total = contributions.sum() + 1e-9
        attributed = (shap_values[0] * contributions / total).tolist()

    except ImportError:
        # SHAP not available — fall back to simple weighted attribution
        attributed = (FACTOR_WEIGHTS * factor_values).tolist()
    except Exception:
        attributed = (FACTOR_WEIGHTS * factor_values).tolist()

    # Build top-3 sorted by absolute contribution
    items = [
        {"factor": name, "contribution": round(float(c), 4), "value": round(float(v), 4)}
        for name, c, v in zip(FACTOR_NAMES, attributed, factor_values)
    ]
    items.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return items[:3]


# ── Signal normalisation ───────────────────────────────────────────────────────

def _normalise_signals(signals: dict) -> np.ndarray:
    """
    Convert the raw signals dict into a normalised [0, 1] factor vector.

    Expected keys (all optional — defaults to 0):
        voice_score       (float 0–1 from audio_analyzer)
        coercion_score    (float 0–1, or bool/label from coercion_engine)
        ocr_score         (float 0–1 from ocr_engine)
        reputation_score  (float 0–1 from reputation_service)
        new_beneficiary   (float/bool 0 or 1)
        anomaly_score     (float 0–1 from behaviour_analyzer)
    """
    def _get(key, default=0.0):
        val = signals.get(key, default)
        if isinstance(val, bool):
            return 1.0 if val else 0.0
        if isinstance(val, str):
            return 1.0 if val.upper() == "COERCIVE" else 0.0
        return float(np.clip(val, 0.0, 1.0))

    return np.array([
        _get("voice_score"),
        _get("coercion_score"),
        _get("ocr_score"),
        _get("reputation_score"),
        _get("new_beneficiary"),
        _get("anomaly_score"),
    ], dtype=np.float32)


def _tier(risk_score: int) -> str:
    if risk_score < THRESHOLD_WARNING:
        return "ALLOWED"
    if risk_score < THRESHOLD_ELEVATED:
        return "WARNING"
    if risk_score < THRESHOLD_INTERCEPT:
        return "ELEVATED"
    return "HARD_INTERCEPT"


# ── Public API ─────────────────────────────────────────────────────────────────

def fuse(signals: dict) -> dict:
    """
    Fuse 6 detection signals into a calibrated risk score with SHAP explanation.

    Args:
        signals: Dict with keys: voice_score, coercion_score, ocr_score,
                 reputation_score, new_beneficiary, anomaly_score.
                 Missing keys default to 0.

    Returns:
        {
            'risk_score':   int in [0, 100],
            'risk_tier':    'ALLOWED' | 'WARNING' | 'ELEVATED' | 'HARD_INTERCEPT',
            'shap_top3':    list of top-3 factor attribution dicts,
            'raw_weighted': float,
            'calibrated':   float,
        }
    """
    factor_values = _normalise_signals(signals)
    raw_weighted  = float(np.dot(FACTOR_WEIGHTS, factor_values))
    calibrated    = _calibrate(raw_weighted)
    risk_score    = int(np.clip(round(calibrated * 100), 0, 100))
    shap_top3     = _compute_shap(factor_values)

    return {
        "risk_score":   risk_score,
        "risk_tier":    _tier(risk_score),
        "shap_top3":    shap_top3,
        "raw_weighted": round(raw_weighted, 4),
        "calibrated":   round(calibrated, 4),
    }


async def fuse_async(signals: dict) -> dict:
    """Async-safe wrapper for asyncio.gather()."""
    _load_calibrator()
    return await asyncio.to_thread(fuse, signals)


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 70)
    print("GuardPay AI — risk_fusion.py self-test")
    print("=" * 70)

    scenarios = [
        (
            "Scenario A — Safe (Green path)",
            {"voice_score": 0.05, "coercion_score": 0.0,  "ocr_score": 0.0,
             "reputation_score": 0.0, "new_beneficiary": 0, "anomaly_score": 0.05},
            "ALLOWED",
        ),
        (
            "Scenario B — Warning (Yellow path)",
            {"voice_score": 0.4, "coercion_score": 0.5, "ocr_score": 0.1,
             "reputation_score": 0.2, "new_beneficiary": 1, "anomaly_score": 0.3},
            "WARNING",
        ),
        (
            "Scenario C — Hard Intercept (Red path)",
            {"voice_score": 0.95, "coercion_score": 0.98, "ocr_score": 0.85,
             "reputation_score": 0.8, "new_beneficiary": 1, "anomaly_score": 0.9},
            "HARD_INTERCEPT",
        ),
    ]

    all_pass = True
    for name, signals, expected_tier in scenarios:
        result = fuse(signals)
        ok = result["risk_tier"] == expected_tier
        if not ok:
            all_pass = False
        status = "✓" if ok else "✗"
        print(f"\n  {status}  {name}")
        print(f"     risk_score = {result['risk_score']}   tier = {result['risk_tier']}")
        print(f"     raw_weighted = {result['raw_weighted']}   calibrated = {result['calibrated']}")
        print(f"     SHAP top-3:")
        for s in result["shap_top3"]:
            print(f"       - {s['factor']:20} contribution={s['contribution']:+.4f}  value={s['value']:.3f}")

    print()
    print("✓ All scenarios produced correct tiers" if all_pass else "✗ Tier mismatches — check weights/thresholds")
    print("=" * 70)
