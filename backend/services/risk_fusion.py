"""
GuardPay AI — Risk Fusion Engine
PROMPT 3 (Jatin's module — referenced here for wiring in PROMPT 7)

Formula: Risk = W1×audio + W2×text + W3×ocr + W4×reputation + W5×new_beneficiary + W6×device_behaviour
Default weights from playbook: W1=0.25, W2=0.20, W3=0.15, W4=0.20, W5=0.10, W6=0.10
"""

from __future__ import annotations
from typing import Optional
from backend.schemas.models import RiskFactor


# Default weights as specified in the playbook
WEIGHTS = {
    "audio":           0.25,
    "text":            0.20,
    "ocr":             0.15,
    "reputation":      0.20,
    "new_beneficiary": 0.10,
    "device_behaviour":0.10,
}


def compute_risk(factors: dict[str, float]) -> tuple[float, list[RiskFactor]]:
    """
    Compute weighted risk score from normalised factor inputs (0–1 each).
    Returns (risk_score_0_to_100, [RiskFactor explanations]).

    factors keys: audio, text, ocr, reputation, new_beneficiary, device_behaviour
    """
    FACTOR_LABELS = {
        "audio":           "Voice Clone Probability",
        "text":            "Coercion Language Score",
        "ocr":             "Scam Screen Content",
        "reputation":      "Receiver Reputation Risk",
        "new_beneficiary": "New Beneficiary Risk",
        "device_behaviour":"Device Duress Signals",
    }

    raw_score = 0.0
    explanation: list[RiskFactor] = []

    for key, weight in WEIGHTS.items():
        raw = factors.get(key, 0.0)
        raw = max(0.0, min(1.0, raw))  # clamp to 0–1
        contribution = weight * raw * 100  # scale to 0–100 space
        raw_score += contribution

        explanation.append(RiskFactor(
            name=FACTOR_LABELS.get(key, key),
            contribution_points=round(contribution, 2),
            weight=weight,
            raw_score=round(raw, 4),
            description=f"{FACTOR_LABELS.get(key, key)}: +{contribution:.1f} pts (W={weight}, raw={raw:.2f})",
        ))

    # Sort by absolute contribution descending → top-3 for SHAP display
    explanation.sort(key=lambda f: abs(f.contribution_points), reverse=True)

    final_score = min(100.0, max(0.0, raw_score))
    return round(final_score, 2), explanation[:3]
