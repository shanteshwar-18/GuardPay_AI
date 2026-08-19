"""
behaviour_analyzer.py — Device Behaviour Anomaly Detector
GuardPay AI · AI/ML Module (Jatin)

Uses an Isolation Forest trained on synthetic normal-behaviour data to detect
duress signals: unusual screen-share events, abnormal tap cadence, rapid
switches between apps — all strong indicators of a live scam call.

Contract:
    score(event_dict: dict) -> {'anomaly_score': float, 'is_anomaly': bool}

Async-safe via asyncio.to_thread.

Commits:
    feat(anomaly): generate synthetic behavioural data and train Isolation Forest
    feat(anomaly): implement behaviour_analyzer inference wrapper
"""

from __future__ import annotations

import asyncio
import json
import pickle
from pathlib import Path

import numpy as np

# ── Paths ──────────────────────────────────────────────────────────────────────
PROJECT_ROOT   = Path(__file__).parent.parent
MODEL_PATH     = PROJECT_ROOT / "models" / "isolation_forest.pkl"
SCALER_PATH    = PROJECT_ROOT / "models" / "behaviour_scaler.pkl"
MOCK_DATA_PATH = PROJECT_ROOT / "data" / "mock" / "behaviour_data.npy"

# ── Feature schema ─────────────────────────────────────────────────────────────
# Each event dict is converted to this fixed-length feature vector:
FEATURE_NAMES = [
    "screen_share_active",      # 0/1 — screen sharing detected
    "tap_cadence_hz",           # taps per second (normal ≈ 1–3 Hz)
    "app_switches_per_min",     # app switches per minute (normal ≈ 0–5)
    "payment_amount_log",       # log10(payment amount in INR)
    "call_duration_sec",        # seconds since call started
    "typing_speed_cps",         # characters per second (normal ≈ 3–8)
    "brightness_change",        # 0/1 — sudden brightness drop (screen hiding)
    "volume_change",            # 0/1 — sudden volume reduction (hiding alerts)
    "beneficiary_is_new",       # 0/1 — first-time beneficiary
    "time_since_last_txn_hr",   # hours since last transaction
]
N_FEATURES = len(FEATURE_NAMES)


# ── Data generation ────────────────────────────────────────────────────────────

def _generate_normal_data(n: int = 900, seed: int = 42) -> np.ndarray:
    """Generate synthetic normal device behaviour samples."""
    rng = np.random.default_rng(seed)
    data = np.column_stack([
        rng.integers(0, 2, n),                        # screen_share_active
        rng.uniform(0.5, 3.5, n),                     # tap_cadence_hz
        rng.uniform(0, 5, n),                         # app_switches_per_min
        rng.uniform(1.5, 4.5, n),                     # payment_amount_log (₹30–₹30k)
        rng.uniform(0, 120, n),                       # call_duration_sec
        rng.uniform(2, 8, n),                         # typing_speed_cps
        rng.integers(0, 2, n) * rng.binomial(1, 0.1, n),   # brightness_change (rare)
        rng.integers(0, 2, n) * rng.binomial(1, 0.1, n),   # volume_change (rare)
        rng.binomial(1, 0.2, n),                      # beneficiary_is_new (20%)
        rng.exponential(48, n),                       # time_since_last_txn_hr
    ])
    return data.astype(np.float32)


def _generate_anomaly_data(n: int = 100, seed: int = 99) -> np.ndarray:
    """Generate synthetic anomalous device behaviour (scam patterns)."""
    rng = np.random.default_rng(seed)
    data = np.column_stack([
        rng.integers(1, 2, n),                        # screen_share_active = 1 (always)
        rng.uniform(8, 20, n),                        # tap_cadence_hz (frantic tapping)
        rng.uniform(15, 40, n),                       # app_switches_per_min (rapid)
        rng.uniform(4.5, 6, n),                       # payment_amount_log (large ₹30k–₹1M)
        rng.uniform(600, 3600, n),                    # call_duration_sec (very long call)
        rng.uniform(0.5, 2, n),                       # typing_speed_cps (slow, hesitant)
        rng.integers(1, 2, n),                        # brightness_change = 1
        rng.integers(1, 2, n),                        # volume_change = 1
        rng.integers(1, 2, n),                        # beneficiary_is_new = 1
        rng.uniform(0, 2, n),                         # time_since_last_txn_hr (immediate)
    ])
    return data.astype(np.float32)


# ── Model training ─────────────────────────────────────────────────────────────

def train_and_save():
    """
    Generate synthetic data, train Isolation Forest, save model + scaler.
    Called once at startup if model files don't exist.
    """
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    print("[behaviour_analyzer] Generating synthetic behavioural data ...")
    normal  = _generate_normal_data(900)
    anomaly = _generate_anomaly_data(100)
    X_train = normal   # Isolation Forest trained on NORMAL data only

    # Save mock data for reference
    MOCK_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    np.save(MOCK_DATA_PATH, np.vstack([normal, anomaly]))
    print(f"[behaviour_analyzer] Mock data saved → {MOCK_DATA_PATH}")

    # Fit scaler on normal data
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_train)

    # Train Isolation Forest
    # contamination=0.1: ~10% of real-world data expected to be anomalous
    clf = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        random_state=42,
    )
    clf.fit(X_scaled)

    # Save both artefacts
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(clf, f)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)

    print(f"[behaviour_analyzer] Model saved → {MODEL_PATH}")
    print(f"[behaviour_analyzer] Scaler saved → {SCALER_PATH}")


# ── Inference ──────────────────────────────────────────────────────────────────

_clf    = None
_scaler = None


def _load_models():
    global _clf, _scaler
    if _clf is not None:
        return

    if not MODEL_PATH.exists() or not SCALER_PATH.exists():
        print("[behaviour_analyzer] Model not found — training now ...")
        train_and_save()

    with open(MODEL_PATH, "rb") as f:
        _clf = pickle.load(f)
    with open(SCALER_PATH, "rb") as f:
        _scaler = pickle.load(f)
    print("[behaviour_analyzer] Isolation Forest + scaler loaded ✓")


def _event_to_vector(event: dict) -> np.ndarray:
    """
    Convert an event dict to a fixed-length float32 feature vector.
    Missing keys default to the most normal value.
    """
    amount = max(event.get("payment_amount", 100), 1)
    vec = [
        float(event.get("screen_share_active",   0)),
        float(event.get("tap_cadence_hz",         1.5)),
        float(event.get("app_switches_per_min",   2)),
        float(np.log10(amount)),
        float(event.get("call_duration_sec",      30)),
        float(event.get("typing_speed_cps",       4)),
        float(event.get("brightness_change",      0)),
        float(event.get("volume_change",          0)),
        float(event.get("beneficiary_is_new",     0)),
        float(event.get("time_since_last_txn_hr", 24)),
    ]
    return np.array(vec, dtype=np.float32).reshape(1, -1)


def _infer(event: dict) -> dict:
    """Blocking inference — run inside asyncio.to_thread."""
    _load_models()
    vec    = _event_to_vector(event)
    scaled = _scaler.transform(vec)

    # Isolation Forest: predict() returns -1 (anomaly) or +1 (normal)
    prediction   = _clf.predict(scaled)[0]
    raw_score    = _clf.score_samples(scaled)[0]   # more negative = more anomalous

    # Normalise raw_score to [0, 1]: anomaly_score=1 means definitely anomalous
    # Typical range of score_samples is roughly [-0.6, 0.15]
    anomaly_score = float(np.clip((-raw_score - 0.0) / 0.6, 0.0, 1.0))
    is_anomaly    = bool(prediction == -1)

    return {
        "anomaly_score": round(anomaly_score, 4),
        "is_anomaly":    is_anomaly,
        "raw_score":     round(float(raw_score), 4),
    }


# ── Public API ─────────────────────────────────────────────────────────────────

def score(event_dict: dict) -> dict:
    """
    Synchronous anomaly detection for device behaviour signals.

    Args:
        event_dict: Dictionary with any subset of FEATURE_NAMES keys.

    Returns:
        {
            'anomaly_score': float in [0, 1],  — 1 = highly anomalous
            'is_anomaly':    bool,
            'raw_score':     float,            — Isolation Forest raw score
        }
    """
    return _infer(event_dict)


async def score_async(event_dict: dict) -> dict:
    """Async-safe wrapper — safe to call from asyncio.gather()."""
    _load_models()
    return await asyncio.to_thread(_infer, event_dict)


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio

    print("=" * 60)
    print("GuardPay AI — behaviour_analyzer.py self-test")
    print("=" * 60)

    # Train if needed
    _load_models()

    test_cases = [
        (
            "Normal transaction",
            {
                "screen_share_active": 0, "tap_cadence_hz": 1.5,
                "app_switches_per_min": 2, "payment_amount": 500,
                "call_duration_sec": 30, "typing_speed_cps": 5,
                "brightness_change": 0, "volume_change": 0,
                "beneficiary_is_new": 0, "time_since_last_txn_hr": 24,
            },
            False,   # expected is_anomaly
        ),
        (
            "Scam transaction (screen share + large amount + new beneficiary)",
            {
                "screen_share_active": 1, "tap_cadence_hz": 15,
                "app_switches_per_min": 25, "payment_amount": 500_000,
                "call_duration_sec": 1800, "typing_speed_cps": 1,
                "brightness_change": 1, "volume_change": 1,
                "beneficiary_is_new": 1, "time_since_last_txn_hr": 0.1,
            },
            True,   # expected is_anomaly
        ),
    ]

    all_pass = True
    for name, event, expected_anomaly in test_cases:
        result = score(event)
        status = "✓" if result["is_anomaly"] == expected_anomaly else "✗"
        if result["is_anomaly"] != expected_anomaly:
            all_pass = False
        print(
            f"  {status}  {name:<50}  "
            f"anomaly_score={result['anomaly_score']:.3f}  "
            f"is_anomaly={result['is_anomaly']}"
        )

    print()
    print("✓ All tests passed" if all_pass else "✗ Some tests failed")
    print("=" * 60)
