"""
GuardPay AI — POST /api/v1/risk-score
PROMPT 7: Real asyncio.gather() AI module wiring — Phase 4.3
Replaces placeholder logic with concurrent calls to all 6 AI modules.
Target: response < 3 seconds for complete evaluation.

Author: Shanteshwar (Backend Lead)
"""

import time
import asyncio
import logging
import base64

from fastapi import APIRouter, HTTPException
from backend.schemas.models import (
    RiskScoreRequest, RiskScoreResponse, RiskTier, RiskFactor
)
from backend.core.config import settings
from backend.services.risk_fusion import compute_risk
from backend.services.reputation_service import get_reputation
from backend.services.beneficiary_cache import is_new_beneficiary
from backend.services.ai_services import (
    analyze_audio,
    transcribe_audio,
    detect_coercion,
    analyze_behaviour,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

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
# PROMPT 7 — Core: concurrent AI module evaluation via asyncio.gather()
# ─────────────────────────────────────────────────────────────────────────────

async def _evaluate_all_modules(req: RiskScoreRequest) -> dict[str, float]:
    """
    Runs all 6 AI signal modules concurrently via asyncio.gather().
    Each module returns a normalised 0–1 factor score.
    Modules that fail return 0.0 (safe default) — backend stays alive.

    Modules:
      1. audio       → CNN voice-clone probability (Jatin's model)
      2. text        → NLP coercion language score (Groq Llama 3)
      3. ocr         → Scam-screen OCR factor
      4. reputation  → Bank reputation network factor
      5. new_beneficiary → Bloom filter + amount heuristic
      6. device_behaviour → Device duress signals
    """

    # ── Prepare coroutines ───────────────────────────────────────────────────
    async def get_audio_factor() -> float:
        try:
            return await analyze_audio(req.audio_base64)
        except Exception as e:
            logger.warning(f"[audio_analyzer] failed: {e}")
            return 0.0

    async def get_text_factor() -> float:
        try:
            transcript = req.transcript
            if not transcript and req.audio_base64:
                transcript = await transcribe_audio(req.audio_base64)
            if transcript:
                return await detect_coercion(transcript)
            return 0.0
        except Exception as e:
            logger.warning(f"[coercion_engine] failed: {e}")
            return 0.0

    async def get_ocr_factor() -> float:
        try:
            if req.ocr_text:
                from backend.routers.ocr import _detect_scam_phrases
                detected = _detect_scam_phrases(req.ocr_text)
                return 1.0 if detected else (0.8 if req.is_screen_sharing else 0.0)
            if not req.ocr_screenshot_base64:
                return 1.0 if req.is_screen_sharing else 0.0
            # Inline OCR using the scam phrase matcher from ocr router
            from backend.routers.ocr import _detect_scam_phrases
            import base64 as b64
            try:
                import pytesseract
                from PIL import Image
                import io
                img_bytes = b64.b64decode(req.ocr_screenshot_base64)
                img = Image.open(io.BytesIO(img_bytes))
                text = pytesseract.image_to_string(img)
                detected = _detect_scam_phrases(text)
                return 1.0 if detected else 0.0
            except ImportError:
                # pytesseract not available — use screen-share flag as proxy
                return 0.8 if req.is_screen_sharing else 0.0
        except Exception as e:
            logger.warning(f"[ocr_engine] failed: {e}")
            return 0.0

    async def get_reputation_factor() -> float:
        try:
            rep = await get_reputation(req.receiver_upi_id)
            return rep.get("reputation_factor", 0.0)
        except Exception as e:
            logger.warning(f"[reputation_service] failed: {e}")
            return 0.0

    async def get_new_beneficiary_factor() -> float:
        try:
            is_new = is_new_beneficiary(req.sender_upi_id, req.receiver_upi_id)
            if not is_new:
                return 0.0
            # Scale by amount: large transfer to new beneficiary = higher risk
            amount_factor = min(1.0, req.amount / 100_000)  # max at ₹1L
            # Odd-hour bonus (not implemented here — would use datetime)
            return min(1.0, 0.6 + (0.4 * amount_factor))
        except Exception as e:
            logger.warning(f"[new_beneficiary] failed: {e}")
            return 0.0

    async def get_behaviour_factor() -> float:
        try:
            return await analyze_behaviour(req.device_behaviour)
        except Exception as e:
            logger.warning(f"[behaviour_analyzer] failed: {e}")
            return 0.0

    # ── Concurrent execution — all modules run in parallel ───────────────────
    results = await asyncio.gather(
        get_audio_factor(),
        get_text_factor(),
        get_ocr_factor(),
        get_reputation_factor(),
        get_new_beneficiary_factor(),
        get_behaviour_factor(),
        return_exceptions=False,  # individual try/except handles per-module safety
    )

    audio_f, text_f, ocr_f, reputation_f, new_ben_f, behaviour_f = results

    logger.info(
        f"[risk-score] factors → "
        f"audio={audio_f:.3f} text={text_f:.3f} ocr={ocr_f:.3f} "
        f"reputation={reputation_f:.3f} new_ben={new_ben_f:.3f} behaviour={behaviour_f:.3f}"
    )

    return {
        "audio":            audio_f,
        "text":             text_f,
        "ocr":              ocr_f,
        "reputation":       reputation_f,
        "new_beneficiary":  new_ben_f,
        "device_behaviour": behaviour_f,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main endpoint
# ─────────────────────────────────────────────────────────────────────────────

async def evaluate_risk_core(
    req: RiskScoreRequest,
    *,
    forced_factors: dict[str, float] | None = None,
) -> tuple[RiskScoreResponse, dict[str, float]]:
    """
    THE evaluation engine (spec §42 — there is exactly one).

    POST /api/v1/risk-score is a thin wrapper over this, and the payment
    authorization gate calls it directly rather than scoring anything itself.
    Returns the public response plus the raw 0–1 factor vector, which the gate
    needs to build the normalized §36 factor list.

    `forced_factors` is the ONLY way a caller can bypass the six AI modules. It
    exists solely for the demo-mode branch in backend/routers/payment.py, which
    passes it only after checking settings.GUARDPAY_DEMO_MODE. It defaults to
    None, so no real-scoring path can ever see a demo vector.
    """
    start = time.perf_counter()
    logger.info(
        f"[RISK] txn={req.transaction_id} "
        f"sender={req.sender_upi_id} receiver={req.receiver_upi_id} "
        f"amount={req.amount} screen_share={req.is_screen_sharing}"
    )

    try:
        if forced_factors is not None:
            # Demo branch — deterministic vector, AI modules skipped entirely.
            factor_scores = dict(forced_factors)
            logger.info(f"[RISK] DEMO vector used for txn={req.transaction_id}: {factor_scores}")
        else:
            # ── PROMPT 7: concurrent AI module calls ─────────────────────────
            factor_scores = await _evaluate_all_modules(req)

        # ── Risk fusion (weighted formula → 0–100) ───────────────────────────
        risk_score, explanation = compute_risk(factor_scores)

    except Exception as exc:
        logger.error(f"[RISK] Critical failure txn={req.transaction_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Risk evaluation failed: {exc}")

    tier = _determine_tier(risk_score)
    elapsed_ms = (time.perf_counter() - start) * 1000

    if elapsed_ms > 3000:
        logger.warning(f"[RISK] Latency SLA breach: {elapsed_ms:.0f}ms for txn={req.transaction_id}")

    # ── Evidence Bundle (PROMPT 10 wires real encryption) ────────────────────
    evidence_bundle_id: str | None = None
    if risk_score >= settings.RISK_THRESHOLD_ELEVATED:
        try:
            from backend.services.evidence_builder import build_evidence_bundle
            # The real captured signals go into the bundle. Passing "" here made
            # every bundle evidentially worthless — the OCR text and transcript
            # ARE the evidence a bank or the police would act on.
            evidence_bundle_id = await build_evidence_bundle(
                txn_id=req.transaction_id,
                upi_id=req.receiver_upi_id,
                amount=req.amount,
                ocr_text=req.ocr_text or "",
                transcript=req.transcript or "",
                audio_base64=req.audio_base64,
                shap_breakdown=explanation,
                risk_score=risk_score,
            )
        except ImportError:
            evidence_bundle_id = f"EVD-{req.transaction_id[:8]}-PENDING"
        except Exception as e:
            logger.error(f"[evidence_builder] failed: {e}")
            evidence_bundle_id = f"EVD-{req.transaction_id[:8]}-ERROR"

    # ── Twilio IVR (PROMPT 8 wires real call) ────────────────────────────────
    ivr_initiated = False
    if tier == RiskTier.HARD_INTERCEPT and req.trusted_contact_number:
        try:
            from backend.services.twilio_service import initiate_ivr_call
            await initiate_ivr_call(
                to_number=req.trusted_contact_number,
                transaction_id=req.transaction_id,
                amount=req.amount,
                receiver_upi_id=req.receiver_upi_id,
            )
            ivr_initiated = True
        except ImportError:
            logger.warning("[Twilio] twilio_service not yet available — IVR skipped (PROMPT 8)")
        except Exception as e:
            logger.error(f"[Twilio] IVR failed: {e}")

    # ── Bank Alert (PROMPT 11 wires real mTLS call) ───────────────────────────
    if tier in (RiskTier.HARD_INTERCEPT, RiskTier.ELEVATED):
        try:
            from backend.services.bank_alert_service import send_alert
            asyncio.create_task(send_alert(
                transaction_id=req.transaction_id,
                risk_score=risk_score,
                contributing_factors=[f.name for f in explanation],
                beneficiary_upi_id=req.receiver_upi_id,
                amount=req.amount,
                evidence_bundle_id=evidence_bundle_id,
            ))
        except ImportError:
            logger.warning("[BankAlert] bank_alert_service not yet available (PROMPT 11)")
        except Exception as e:
            logger.error(f"[BankAlert] failed: {e}")

    # ── Update session store ──────────────────────────────────────────────────
    try:
        from backend.routers.session import update_session
        from datetime import datetime, timezone
        update_session(
            req.transaction_id,
            status="BLOCKED" if tier == RiskTier.HARD_INTERCEPT else "PENDING",
            risk_score=risk_score,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        logger.warning(f"Session update failed: {e}")

    logger.info(
        f"[RISK] DONE txn={req.transaction_id} score={risk_score:.1f} "
        f"tier={tier} ivr={ivr_initiated} evidence={evidence_bundle_id} "
        f"latency={elapsed_ms:.1f}ms"
    )

    response = RiskScoreResponse(
        transaction_id=req.transaction_id,
        risk_score=round(risk_score, 2),
        tier=tier,
        explanation=explanation,
        recommended_action=_recommended_action(tier),
        evidence_bundle_id=evidence_bundle_id,
        ivr_call_initiated=ivr_initiated,
        processing_time_ms=round(elapsed_ms, 2),
    )
    return response, factor_scores


@router.post(
    "/risk-score",
    response_model=RiskScoreResponse,
    summary="Evaluate transaction risk score",
    description=(
        "Multi-modal fraud risk evaluation via asyncio.gather(). "
        "6 independent modules run concurrently → weighted risk fusion → SHAP top-3. "
        "Target latency: < 3 seconds."
    ),
)
async def evaluate_risk(req: RiskScoreRequest) -> RiskScoreResponse:
    """Public evaluation endpoint — unchanged contract, thin wrapper over the core."""
    response, _factor_scores = await evaluate_risk_core(req)
    return response
