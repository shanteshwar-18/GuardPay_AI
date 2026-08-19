"""
GuardPay AI — POST /api/v1/risk-score
PROMPT 6: Placeholder Logic (unblocks frontend team immediately)
PROMPT 7: Real asyncio.gather() wiring (Phase 4.3 — replaces placeholder)
"""

import time
import asyncio
import logging

from fastapi import APIRouter, HTTPException
from backend.schemas.models import (
    RiskScoreRequest, RiskScoreResponse, RiskTier, RiskFactor
)
from backend.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


def _determine_tier(score: float) -> RiskTier:
    """Map numeric score to risk tier per Solution Document thresholds."""
    if score >= settings.RISK_THRESHOLD_INTERCEPT:
        return RiskTier.HARD_INTERCEPT
    elif score >= settings.RISK_THRESHOLD_ELEVATED:
        return RiskTier.ELEVATED
    elif score >= settings.RISK_THRESHOLD_WARNING:
        return RiskTier.WARNING
    return RiskTier.SAFE


def _recommended_action(tier: RiskTier) -> str:
    return {
        RiskTier.SAFE: "Payment can proceed. Routing to PIN pad.",
        RiskTier.WARNING: "Suspicious signals detected. Review the warning before proceeding.",
        RiskTier.ELEVATED: "High risk. Cooling-off period enforced. Evidence captured.",
        RiskTier.HARD_INTERCEPT: "Payment BLOCKED. Trusted contact notified. Bank alerted.",
    }[tier]


# ─────────────────────────────────────────────────────────────────────────────
# PROMPT 6 — Placeholder logic (integrable by Nikita/Raghav immediately)
# TODO (PROMPT 7): replace _placeholder_risk() with real asyncio.gather() calls
# ─────────────────────────────────────────────────────────────────────────────

async def _placeholder_risk(req: RiskScoreRequest) -> tuple[float, list[RiskFactor]]:
    """
    Simple heuristic placeholder — enough for frontend integration.
    Will be replaced by real AI module calls in PROMPT 7 (Phase 4.3).
    """
    score = 0.0
    factors: list[RiskFactor] = []

    # Heuristic 1: Large amount to unknown beneficiary
    if req.amount > 10000:
        score += 20
        factors.append(RiskFactor(
            name="High Amount",
            contribution_points=20.0,
            weight=0.20,
            raw_score=1.0,
            description=f"Transaction amount ₹{req.amount:,.0f} exceeds ₹10,000 threshold."
        ))

    # Heuristic 2: Screen sharing active
    if req.is_screen_sharing:
        score += 30
        factors.append(RiskFactor(
            name="Screen Sharing Active",
            contribution_points=30.0,
            weight=0.15,
            raw_score=1.0,
            description="Screen sharing detected — a common scammer control vector."
        ))

    # Heuristic 3: Device behaviour signals
    if req.device_behaviour:
        db = req.device_behaviour
        if db.app_switch_locked:
            score += 25
            factors.append(RiskFactor(
                name="App Switch Locked",
                contribution_points=25.0,
                weight=0.10,
                raw_score=1.0,
                description="User unable to switch apps — indicative of psychological duress."
            ))
        if db.screen_share_duration_seconds > 120:
            score += 15
            factors.append(RiskFactor(
                name="Long Screen-Share Duration",
                contribution_points=15.0,
                weight=0.10,
                raw_score=min(1.0, db.screen_share_duration_seconds / 300),
                description=f"Screen shared for {db.screen_share_duration_seconds}s — unusually long."
            ))

    # Heuristic 4: Audio present (placeholder — will be replaced by CNN in Prompt 7)
    if req.audio_base64:
        score += 10  # placeholder contribution
        factors.append(RiskFactor(
            name="Audio Signal (Placeholder)",
            contribution_points=10.0,
            weight=0.25,
            raw_score=0.4,
            description="[PLACEHOLDER] CNN voice-clone analysis not yet wired. (Phase 4.3)"
        ))

    score = min(100.0, score)
    return score, factors[:3]  # return top-3 factors


@router.post(
    "/risk-score",
    response_model=RiskScoreResponse,
    summary="Evaluate transaction risk score",
    description=(
        "Multi-modal fraud risk evaluation. Returns a score 0–100 and a tier "
        "(SAFE / WARNING / ELEVATED / HARD_INTERCEPT). "
        "Phase 1.4 placeholder — real AI wiring in Phase 4.3."
    ),
)
async def evaluate_risk(req: RiskScoreRequest) -> RiskScoreResponse:
    start = time.perf_counter()
    logger.info(f"Risk evaluation for txn={req.transaction_id} amount={req.amount}")

    try:
        # TODO PROMPT 7: replace with real asyncio.gather() AI module calls
        score, factors = await _placeholder_risk(req)
    except Exception as exc:
        logger.error(f"Risk evaluation error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Risk evaluation failed: {exc}")

    tier = _determine_tier(score)
    elapsed_ms = (time.perf_counter() - start) * 1000

    # Evidence bundle — triggered in PROMPT 10 (Phase 6.2)
    evidence_bundle_id: str | None = None
    if score >= settings.RISK_THRESHOLD_ELEVATED:
        # TODO PROMPT 10: evidence_bundle_id = await build_evidence_bundle(req, score, factors)
        evidence_bundle_id = f"EVD-{req.transaction_id[:8]}-PLACEHOLDER"

    # Twilio IVR — triggered in PROMPT 8 (Phase 6.1)
    ivr_initiated = False
    if tier == RiskTier.HARD_INTERCEPT:
        # TODO PROMPT 8: await initiate_ivr_call(req.trusted_contact_number, req.transaction_id)
        ivr_initiated = True
        logger.warning(f"HARD_INTERCEPT for txn={req.transaction_id} — IVR stub (PROMPT 8 pending)")

    logger.info(f"Score={score:.1f} Tier={tier} Time={elapsed_ms:.1f}ms txn={req.transaction_id}")

    return RiskScoreResponse(
        transaction_id=req.transaction_id,
        risk_score=round(score, 2),
        tier=tier,
        explanation=factors,
        recommended_action=_recommended_action(tier),
        evidence_bundle_id=evidence_bundle_id,
        ivr_call_initiated=ivr_initiated,
        processing_time_ms=round(elapsed_ms, 2),
    )
