"""
GuardPay AI — Risk Fusion Engine (weighted sum + Platt calibration + SHAP)

Playbook §4.1 / §4.2:
    Risk = W1*audio + W2*text + W3*ocr + W4*reputation + W5*new_beneficiary + W6*device
    W1=0.25, W2=0.20, W3=0.15, W4=0.20, W5=0.10, W6=0.10   (all inputs normalised 0-1)
    Calibrate with Platt scaling (LogisticRegression); attribute per-factor
    contributions with shap.LinearExplainer; return the top-3 factors.

Design notes
------------
1. `score` stays the EXACT weighted sum x 100. The 40/70/90 tier boundaries, the
   demo scenarios and the unit tests are all defined against this linear scale, and
   the per-factor points then sum exactly to the total — which is what makes the
   warning screen's "+25 pts" breakdown add up for the user.

2. Platt scaling is applied as a SEPARATE, additive output (`calibrated_probability`)
   rather than by overwriting `score`. Squashing the score through a logistic would
   shift every tier boundary and silently change when the app intercepts a payment.
   The calibrated probability is the right number for "how likely is this actually
   fraud", and it is what the feedback loop should recalibrate over time.

3. SHAP uses a real `shap.LinearExplainer` over the exact linear fusion model, so the
   attributions explain the score that is actually shown — not a different model.
   For a linear model SHAP gives w_i * (x_i - E[x_i]), i.e. the contribution relative
   to a typical transaction, which is reported alongside the absolute points.

KNOWN PLAYBOOK DISCREPANCY
    The Phase-4 verification checkpoint states that
        {audio:0.9, text:0.8, ocr:0.0, reputation:0.7, new_beneficiary:1.0, device:0.6}
    should return "> 70". With the playbook's own weights that vector sums to
        0.25(0.9)+0.20(0.8)+0.15(0)+0.20(0.7)+0.10(1.0)+0.10(0.6) = 0.685 -> 68.5
    so the stated expectation is not reachable from the stated weights. 68.5 lands in
    the WARNING band (40-70), one tier below the checkpoint's implication. The weights
    are treated as authoritative here; see `verify_playbook_checkpoint()`.

Commit: feat(fusion): add Platt scaling calibration and real SHAP attribution
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path

import numpy as np

from backend.schemas.models import RiskFactor

logger = logging.getLogger(__name__)

# ── Weights (playbook §4.1) ────────────────────────────────────────────────────
WEIGHTS: dict[str, float] = {
    "audio":            0.25,
    "text":             0.20,
    "ocr":              0.15,
    "reputation":       0.20,
    "new_beneficiary":  0.10,
    "device_behaviour": 0.10,
}
FACTOR_ORDER = list(WEIGHTS)

FACTOR_LABELS = {
    "audio":            "Voice Clone Probability",
    "text":             "Coercion Language Score",
    "ocr":              "Scam Screen Content",
    "reputation":       "Receiver Reputation Risk",
    "new_beneficiary":  "New Beneficiary Risk",
    "device_behaviour": "Device Duress Signals",
}

# Distinct filename on purpose: models/risk_fusion.py owns models/calibrator.pkl and
# expects a bare 1-feature LogisticRegression, whereas this module persists a dict
# with a 6-feature model plus its SHAP background. Sharing the path made each module
# fail to load the other's file.
CALIBRATOR_PATH = Path(__file__).resolve().parents[2] / "models" / "platt_calibrator.pkl"
_BACKGROUND_SIZE = 200
_SEED = 42

# Lazily-built singletons; FastAPI serves requests concurrently so guard the build.
_lock = threading.Lock()
_calibrator = None            # sklearn LogisticRegression (Platt)
_explainer = None             # shap.LinearExplainer over the linear fusion model
_background: np.ndarray | None = None
_built = False


# ── Calibrator + explainer construction ────────────────────────────────────────

def _generate_training_set(n: int = 4000) -> tuple[np.ndarray, np.ndarray]:
    """
    Seeded synthetic calibration set.

    X spans the whole operating range (mostly-benign, mixed, coordinated-scam), and
    y ~ Bernoulli(weighted sum), so the fitted logistic learns E[fraud | factors].
    Labels are therefore tied to the documented formula rather than to random noise,
    which is what makes the resulting probability and SHAP values meaningful.

    Replace this with real labelled transactions from the feedback loop when
    available (scripts/recalibrate_thresholds.py).
    """
    rng = np.random.default_rng(_SEED)
    w = np.array([WEIGHTS[k] for k in FACTOR_ORDER])

    n_low, n_high = n // 3, n // 3
    n_mid = n - n_low - n_high
    X = np.vstack([
        rng.beta(1.5, 6.0, size=(n_low, len(w))),
        rng.uniform(0.0, 1.0, size=(n_mid, len(w))),
        rng.beta(6.0, 1.5, size=(n_high, len(w))),
    ])
    p = np.clip(X @ w, 0.0, 1.0)
    y = (rng.random(len(X)) < p).astype(int)
    return X, y


def _build() -> None:
    """Fit/load the Platt calibrator and build the SHAP explainer. Never raises."""
    global _calibrator, _explainer, _background, _built

    X, y = _generate_training_set()
    rng = np.random.default_rng(_SEED)
    _background = X[rng.choice(len(X), _BACKGROUND_SIZE, replace=False)]

    # --- Platt scaling -------------------------------------------------------
    try:
        from sklearn.linear_model import LogisticRegression

        model = None
        if CALIBRATOR_PATH.exists():
            try:
                import pickle
                with open(CALIBRATOR_PATH, "rb") as fh:
                    payload = pickle.load(fh)
                if payload.get("factor_order") == FACTOR_ORDER:
                    model = payload["model"]
                    _background = payload.get("background", _background)
                    logger.info("[risk_fusion] loaded calibrator from %s", CALIBRATOR_PATH)
                else:
                    logger.warning("[risk_fusion] calibrator factor order changed — refitting")
            except Exception as exc:
                logger.warning("[risk_fusion] calibrator load failed (%s) — refitting", exc)

        if model is None:
            model = LogisticRegression(max_iter=1000).fit(X, y)
            try:
                import pickle
                CALIBRATOR_PATH.parent.mkdir(parents=True, exist_ok=True)
                with open(CALIBRATOR_PATH, "wb") as fh:
                    pickle.dump({"model": model, "background": _background,
                                 "factor_order": FACTOR_ORDER}, fh)
                logger.info("[risk_fusion] fitted calibrator -> %s", CALIBRATOR_PATH)
            except Exception as exc:
                logger.warning("[risk_fusion] calibrator not persisted: %s", exc)

        _calibrator = model
    except Exception as exc:
        logger.warning("[risk_fusion] Platt calibration unavailable: %s", exc)
        _calibrator = None

    # --- SHAP over the EXACT linear fusion model ------------------------------
    # coef is in points-per-unit-factor so SHAP values come out already in points.
    try:
        import shap
        coef = np.array([WEIGHTS[k] * 100.0 for k in FACTOR_ORDER])
        _explainer = shap.LinearExplainer((coef, 0.0), _background)
        logger.info("[risk_fusion] SHAP LinearExplainer ready over linear fusion model")
    except Exception as exc:
        logger.warning("[risk_fusion] SHAP unavailable (%s) — using weighted contributions", exc)
        _explainer = None

    _built = True


def _ensure_built() -> None:
    if not _built:
        with _lock:
            if not _built:
                _build()


# ── Public API ─────────────────────────────────────────────────────────────────

def compute_risk(factors: dict[str, float]) -> tuple[float, list[RiskFactor]]:
    """
    Fuse six normalised risk factors into a 0-100 score.

    Args:
        factors: keys audio, text, ocr, reputation, new_beneficiary,
                 device_behaviour — each normalised 0-1. Missing keys default to 0.

    Returns:
        (score_0_to_100, top-3 RiskFactor explanations, highest contribution first)
    """
    vals = {k: float(np.clip(factors.get(k, 0.0), 0.0, 1.0)) for k in FACTOR_ORDER}
    x = np.array([[vals[k] for k in FACTOR_ORDER]])

    # 1. Weighted sum — exact, and the per-factor points sum to it.
    points = {k: WEIGHTS[k] * vals[k] * 100.0 for k in FACTOR_ORDER}
    score = min(100.0, max(0.0, sum(points.values())))

    # 2. SHAP attribution over that same linear model (best-effort).
    shap_vals: np.ndarray | None = None
    try:
        _ensure_built()
        if _explainer is not None:
            sv = np.asarray(_explainer.shap_values(x))
            shap_vals = sv[0] if sv.ndim > 1 else sv
    except Exception as exc:
        logger.warning("[risk_fusion] SHAP attribution failed: %s", exc)

    explanation: list[RiskFactor] = []
    for i, key in enumerate(FACTOR_ORDER):
        label = FACTOR_LABELS[key]
        pts = points[key]
        desc = f"{label}: +{pts:.1f} pts (W={WEIGHTS[key]}, raw={vals[key]:.2f})"
        if shap_vals is not None:
            desc += f" | SHAP {float(shap_vals[i]):+.1f} vs typical"
        explanation.append(RiskFactor(
            name=label,
            contribution_points=round(pts, 2),
            weight=WEIGHTS[key],
            raw_score=round(vals[key], 4),
            description=desc,
        ))

    # Descending by contribution: the warning screen leads with what drove the score.
    explanation.sort(key=lambda f: f.contribution_points, reverse=True)
    return round(score, 2), explanation[:3]


def calibrated_probability(factors: dict[str, float]) -> float | None:
    """
    Platt-scaled probability that this transaction is fraudulent (0-1).

    Kept separate from `compute_risk` so the tier thresholds stay defined on the
    linear score. Returns None if sklearn/the calibrator is unavailable.
    """
    try:
        _ensure_built()
        if _calibrator is None:
            return None
        x = np.array([[float(np.clip(factors.get(k, 0.0), 0.0, 1.0)) for k in FACTOR_ORDER]])
        return float(_calibrator.predict_proba(x)[0, 1])
    except Exception as exc:
        logger.warning("[risk_fusion] calibrated_probability failed: %s", exc)
        return None


def explain_all(factors: dict[str, float]) -> list[RiskFactor]:
    """All six factors (not just top-3) — used for the evidence bundle."""
    vals = {k: float(np.clip(factors.get(k, 0.0), 0.0, 1.0)) for k in FACTOR_ORDER}
    out = [
        RiskFactor(
            name=FACTOR_LABELS[k],
            contribution_points=round(WEIGHTS[k] * vals[k] * 100.0, 2),
            weight=WEIGHTS[k],
            raw_score=round(vals[k], 4),
            description=f"{FACTOR_LABELS[k]}: +{WEIGHTS[k]*vals[k]*100:.1f} pts "
                        f"(W={WEIGHTS[k]}, raw={vals[k]:.2f})",
        )
        for k in FACTOR_ORDER
    ]
    out.sort(key=lambda f: f.contribution_points, reverse=True)
    return out


def verify_playbook_checkpoint() -> dict:
    """
    Evaluate the playbook's Phase-4 verification vector and report the discrepancy
    documented in this module's docstring.
    """
    vec = {"audio": 0.9, "text": 0.8, "ocr": 0.0,
           "reputation": 0.7, "new_beneficiary": 1.0, "device_behaviour": 0.6}
    score, expl = compute_risk(vec)
    return {
        "vector": vec,
        "score": score,
        "playbook_expected": "> 70",
        "arithmetic_max_from_weights": round(sum(WEIGHTS[k] * v for k, v in vec.items()) * 100, 2),
        "meets_playbook_claim": score > 70,
        "top_factors": [e.name for e in expl],
        "calibrated_probability": calibrated_probability(vec),
    }


if __name__ == "__main__":
    import json

    print("=" * 74)
    print("GuardPay AI — risk_fusion self-test")
    print("=" * 74)

    cases = {
        "all-zero (SAFE)":       dict.fromkeys(FACTOR_ORDER, 0.0),
        "playbook §4 vector":    {"audio": 0.9, "text": 0.8, "ocr": 0.0,
                                  "reputation": 0.7, "new_beneficiary": 1.0,
                                  "device_behaviour": 0.6},
        "all-max (INTERCEPT)":   dict.fromkeys(FACTOR_ORDER, 1.0),
        "voice+coercion only":   {"audio": 0.95, "text": 0.9},
        "scenario C (red path)": {"audio": 0.99, "text": 0.95, "ocr": 1.0,
                                  "reputation": 0.8, "new_beneficiary": 1.0,
                                  "device_behaviour": 0.9},
    }
    for name, f in cases.items():
        score, expl = compute_risk(f)
        prob = calibrated_probability(f)
        prob_s = f"{prob*100:5.1f}%" if prob is not None else "  n/a"
        print(f"\n  {name:<24} score={score:6.2f}   platt={prob_s}")
        for e in expl:
            print(f"      {e.description}")

    # Invariants the unit tests rely on
    assert compute_risk(dict.fromkeys(FACTOR_ORDER, 0.0))[0] == 0.0
    assert compute_risk(dict.fromkeys(FACTOR_ORDER, 1.0))[0] == 100.0
    assert abs(compute_risk({"audio": 1.0})[0] - 25.0) < 0.01
    assert compute_risk(dict.fromkeys(FACTOR_ORDER, 999))[0] == 100.0
    top3 = compute_risk({"audio": 1.0, "text": 0.8, "ocr": 0.6, "reputation": 0.4,
                         "new_beneficiary": 0.3, "device_behaviour": 0.2})[1]
    assert len(top3) == 3 and top3[0].contribution_points >= top3[1].contribution_points
    print("\n  Linear-formula invariants: PASS")

    print("\n  Playbook Phase-4 checkpoint:")
    print("  " + json.dumps(verify_playbook_checkpoint(), indent=2).replace("\n", "\n  "))
    print("=" * 74)
