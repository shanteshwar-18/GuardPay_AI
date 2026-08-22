"""
GuardPay AI — Payment Authorization Gate API

The gate that stands between "user tapped Pay" and "the UPI PIN pad opens".
All decision logic lives in backend/services/payment_session.py (the transition
table); all scoring lives in backend/routers/risk_score.py (spec §42 — there is
exactly ONE risk endpoint and this module calls its engine rather than
duplicating it). This module is transport only.

Endpoints
---------
POST   /api/v1/payment/session
POST   /api/v1/payment/session/{sid}/evaluate
POST   /api/v1/payment/session/{sid}/request-verification
POST   /api/v1/payment/session/{sid}/verify-code
POST   /api/v1/payment/session/{sid}/authorize
POST   /api/v1/payment/session/{sid}/cancel
GET    /api/v1/payment/session/{sid}
GET    /api/v1/transactions?filter=all|safe|warning|held|blocked
GET    /api/v1/transactions/{txn_id}
GET    /api/v1/trusted-contacts
POST   /api/v1/trusted-contacts
DELETE /api/v1/trusted-contacts/{contact_id}
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Response, status

from backend.core.config import settings
from backend.schemas.models import (
    AuthorizePinRequest,
    AuthorizeResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    EvaluateSessionRequest,
    NormalizedRiskResponse,
    PaymentSessionResponse,
    PaymentState,
    RequestVerificationRequest,
    RequestVerificationResponse,
    RiskScoreRequest,
    RiskTier,
    TransactionDetail,
    TransactionRecord,
    TrustedContact,
    TrustedContactRequest,
    VerifyCodeRequest,
    VerifyCodeResponse,
)
from backend.services import payment_session as ps

logger = logging.getLogger(__name__)
router = APIRouter()

S = PaymentState


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get(sid: str) -> Dict[str, Any]:
    try:
        return ps.get_session(sid)
    except ps.SessionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Unknown payment session '{sid}'.")


def _public_verification(session: Dict[str, Any]) -> Dict[str, Any]:
    """Verification block minus the code hash — never leaves the process."""
    v = dict(session.get("verification") or {})
    v.pop("code_hash", None)
    return v


def _session_response(session: Dict[str, Any]) -> PaymentSessionResponse:
    risk = session.get("risk")
    return PaymentSessionResponse(
        session_id=session["session_id"],
        transaction_id=session["transaction_id"],
        state=PaymentState(session["state"]),
        created_at=session["created_at"],
        updated_at=session["updated_at"],
        sender_upi_id=session.get("sender_upi_id"),
        receiver_upi_id=session["receiver_upi_id"],
        amount=session["amount"],
        note=session.get("note"),
        risk=NormalizedRiskResponse(**risk) if risk else None,
        pin_allowed=ps.authorization_block_reason(session) is None,
        pin_block_reason=ps.authorization_block_reason(session),
        verification=_public_verification(session),
        evidence_bundle_id=session.get("evidence_bundle_id"),
        ivr_call_initiated=bool(session.get("ivr_call_initiated")),
        history=session.get("history", []),
    )


def _refresh_risk_view(session: Dict[str, Any]) -> Optional[NormalizedRiskResponse]:
    """Re-project the stored risk payload against the live gate state."""
    risk = session.get("risk")
    if not risk:
        return None
    payload = dict(risk)
    payload["state"] = session["state"]
    payload["requiredAction"] = ps.required_action_for(session).value
    payload["pinAllowed"] = ps.authorization_block_reason(session) is None
    return NormalizedRiskResponse(**payload)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Create session
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/payment/session",
    response_model=CreateSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Open a payment authorization session",
)
async def create_payment_session(req: CreateSessionRequest) -> CreateSessionResponse:
    """Starts the gate in CREATED. Nothing is scored until /evaluate is called."""
    session = ps.create_session(
        receiver_upi_id=req.receiver_upi_id,
        amount=req.amount,
        note=req.note,
        sender_upi_id=req.sender_upi_id,
    )
    return CreateSessionResponse(
        session_id=session["session_id"],
        state=PaymentState(session["state"]),
        created_at=session["created_at"],
        transaction_id=session["transaction_id"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# 2. Evaluate
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/payment/session/{sid}/evaluate",
    response_model=NormalizedRiskResponse,
    summary="Run the risk engine and move the gate to its tier state",
)
async def evaluate_payment_session(
    sid: str, req: EvaluateSessionRequest | None = None
) -> NormalizedRiskResponse:
    """
    CREATED → EVALUATING → RISK_DECISION → ALLOWED | WARNING | HELD | INTERCEPTED.

    Calls backend.routers.risk_score.evaluate_risk_core — the same engine behind
    POST /api/v1/risk-score (§42). No scoring, no thresholds are defined here.
    """
    req = req or EvaluateSessionRequest()
    session = _get(sid)

    # ── Demo-mode gate (§29, §50) ────────────────────────────────────────────
    forced_factors = None
    mode = "model"
    if req.demo_scenario is not None:
        if not settings.GUARDPAY_DEMO_MODE:
            raise HTTPException(
                status_code=400,
                detail=(
                    "demo_scenario is only accepted when GUARDPAY_DEMO_MODE=true. "
                    "This server is running in model mode; remove the parameter."
                ),
            )
        forced_factors = dict(ps.DEMO_FACTOR_VECTORS[req.demo_scenario.value])
        mode = "demo"
        logger.warning("[payment] DEMO evaluation %s scenario=%s", sid, req.demo_scenario.value)

    try:
        ps.transition(sid, S.EVALUATING, reason="risk evaluation started")
    except ps.IllegalTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    risk_req = RiskScoreRequest(
        transaction_id=session["transaction_id"],
        sender_upi_id=session.get("sender_upi_id") or "unknown@guardpay",
        receiver_upi_id=session["receiver_upi_id"],
        amount=session["amount"],
        audio_base64=req.audio_base64,
        ocr_screenshot_base64=req.ocr_screenshot_base64,
        # Evidence fix: the real captured signals reach the evidence builder.
        ocr_text=req.ocr_text,
        transcript=req.transcript,
        is_screen_sharing=req.is_screen_sharing,
        session_id=sid,
        device_behaviour=req.device_behaviour,
        trusted_contact_number=req.trusted_contact_number or ps.primary_contact_number(),
    )

    from backend.routers.risk_score import evaluate_risk_core

    try:
        result, factor_scores = await evaluate_risk_core(risk_req, forced_factors=forced_factors)
    except HTTPException:
        ps.transition(sid, S.FROZEN, reason="risk evaluation failed")
        raise
    except Exception as exc:
        logger.error("[payment] evaluation crashed for %s: %s", sid, exc, exc_info=True)
        ps.transition(sid, S.FROZEN, reason="risk evaluation crashed")
        raise HTTPException(status_code=500, detail=f"Risk evaluation failed: {exc}")

    ps.transition(sid, S.RISK_DECISION, reason=f"score={result.risk_score}")
    session = _get(sid)
    policy = ps.apply_tier(session, result.tier)

    normalized = NormalizedRiskResponse(
        riskScore=result.risk_score,
        riskTier=result.tier,
        decision=policy.decision,
        requiredAction=ps.required_action_for(session),
        factors=ps.normalize_factors(factor_scores),
        transactionId=result.transaction_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        sessionId=sid,
        state=PaymentState(session["state"]),
        pinAllowed=ps.authorization_block_reason(session) is None,
        mode=mode,
        evidenceBundleId=result.evidence_bundle_id,
        ivrCallInitiated=result.ivr_call_initiated,
    )
    ps.update_session_fields(
        sid,
        risk=normalized.model_dump(mode="json"),
        mode=mode,
        evidence_bundle_id=result.evidence_bundle_id,
        ivr_call_initiated=result.ivr_call_initiated,
    )
    return normalized


# ─────────────────────────────────────────────────────────────────────────────
# 3. Request verification
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/payment/session/{sid}/request-verification",
    response_model=RequestVerificationResponse,
    summary="Issue a 4-digit verification code (and the trusted-contact IVR when the tier needs it)",
)
async def request_verification(
    sid: str, req: RequestVerificationRequest | None = None
) -> RequestVerificationResponse:
    """
    WARNING tier → in-app code only.
    HELD (ELEVATED) tier → in-app code *and* the Twilio trusted-contact IVR.
    INTERCEPTED / FROZEN → 403; no verification can ever unlock those.

    The plaintext code is returned in the body ONLY when GUARDPAY_DEMO_MODE is on.
    """
    req = req or RequestVerificationRequest()
    session = _get(sid)
    state = ps.state_of(session)

    if state in (S.INTERCEPTED, S.FROZEN):
        raise HTTPException(
            status_code=403,
            detail=(
                "This payment is blocked. Verification cannot be requested for an "
                "intercepted or frozen payment (spec §17/§53)."
            ),
        )
    if state not in (S.WARNING, S.HELD):
        raise HTTPException(
            status_code=409,
            detail=f"No verification is required from state {state.value}.",
        )

    code, expires_at = ps.issue_verification_code(session)
    channel = (session.get("verification") or {}).get("channel") or "in_app"

    ivr_initiated = False
    ivr_status: Optional[str] = None
    if channel == "trusted_contact_ivr":
        to_number = req.trusted_contact_number or ps.primary_contact_number()
        if to_number:
            try:
                # Existing Twilio service — its simulated fallback (no credentials
                # configured) is deliberately preserved so the demo still runs.
                from backend.services.twilio_service import initiate_ivr_call
                outcome = await initiate_ivr_call(
                    to_number=to_number,
                    transaction_id=session["transaction_id"],
                    amount=session["amount"],
                    receiver_upi_id=session["receiver_upi_id"],
                )
                ivr_status = outcome.get("status")
                ivr_initiated = ivr_status in ("queued", "ringing", "in-progress",
                                               "completed", "simulated")
            except Exception as exc:
                logger.error("[payment] IVR failed for %s: %s", sid, exc)
                ivr_status = "error"
        else:
            ivr_status = "no_trusted_contact_configured"

    ps.update_session_fields(sid, ivr_call_initiated=ivr_initiated, ivr_status=ivr_status)
    session = _get(sid)

    logger.info("[payment] verification issued for %s channel=%s ivr=%s",
                sid, channel, ivr_status)

    return RequestVerificationResponse(
        session_id=sid,
        state=ps.state_of(session),
        channel=channel,
        expires_at=expires_at,
        attempts_remaining=int((session.get("verification") or {}).get("attempts_remaining", 0)),
        ivr_call_initiated=ivr_initiated,
        ivr_status=ivr_status,
        # Demo only. In model mode the code is delivered out of band and the
        # response carries nothing that would let a caller skip the channel.
        demo_code=code if settings.GUARDPAY_DEMO_MODE else None,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. Verify code
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/payment/session/{sid}/verify-code",
    response_model=VerifyCodeResponse,
    summary="Submit the verification code",
)
async def verify_code(sid: str, req: VerifyCodeRequest) -> VerifyCodeResponse:
    """
    Max 3 attempts, then the session is FROZEN (and therefore permanently
    unauthorizable). Codes expire after 5 minutes.

    A correct code on a HELD session RELEASES it. A correct code can NEVER
    unlock an INTERCEPTED or FROZEN session — that is refused with 403 before
    the code is even compared.
    """
    session = _get(sid)
    state = ps.state_of(session)

    if state in (S.INTERCEPTED, S.FROZEN):
        raise HTTPException(
            status_code=403,
            detail=(
                "This payment is blocked. Verification codes cannot unlock an "
                "intercepted or frozen payment (spec §17/§53)."
            ),
        )
    if state not in (S.WARNING, S.HELD):
        raise HTTPException(
            status_code=409,
            detail=f"No verification is pending from state {state.value}.",
        )

    verified, message, remaining = ps.check_verification_code(session, req.code)
    session = _get(sid)
    return VerifyCodeResponse(
        verified=verified,
        state=ps.state_of(session),
        attempts_remaining=remaining,
        message=message,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. Authorize (simulated PIN step)
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/payment/session/{sid}/authorize",
    response_model=AuthorizeResponse,
    summary="Simulated UPI PIN step — the gate's final door",
)
async def authorize_payment(
    sid: str, req: AuthorizePinRequest | None = None
) -> AuthorizeResponse:
    """
    SIMULATED PIN step.

    SECURITY — this endpoint never accepts, logs, or stores a real UPI PIN.
    The request body carries only `pin_entered` (a boolean the client's
    NPCI-certified PIN pad sets on success) and `pin_length` (the digit COUNT,
    4 or 6). There is no field for PIN digits anywhere in AuthorizePinRequest,
    nothing PIN-shaped is written to the session store, and nothing about the
    entry is logged beyond the boolean. A real integration would exchange an
    opaque token from the PSP here instead.

    Returns HTTP 403 with a plain-language reason whenever the tier or the
    verification state forbids the PIN step — always for INTERCEPTED and FROZEN.
    """
    req = req or AuthorizePinRequest()
    session = _get(sid)

    reason = ps.authorization_block_reason(session)
    if reason:
        logger.warning("[payment] AUTHORIZE REFUSED %s state=%s: %s",
                       sid, session["state"], reason)
        raise HTTPException(status_code=403, detail=reason)

    if not req.pin_entered:
        raise HTTPException(status_code=400, detail="The PIN pad did not report a complete entry.")

    try:
        ps.transition(sid, S.AUTHORIZED, reason=f"PIN pad entry accepted ({req.pin_length} digits)")
        completed_at = datetime.now(timezone.utc).isoformat()
        session = ps.transition(sid, S.COMPLETED, reason="payment completed",
                                completed_at=completed_at, pin_allowed=False,
                                pin_block_reason="This payment has already been completed.")
    except ps.IllegalTransitionError as exc:
        # Belt and braces: the table refused a move the policy check let through.
        logger.error("[payment] transition table refused authorize for %s: %s", sid, exc)
        raise HTTPException(status_code=403, detail=str(exc))

    return AuthorizeResponse(
        session_id=sid,
        transaction_id=session["transaction_id"],
        state=ps.state_of(session),
        authorized=True,
        completed_at=session.get("completed_at"),
        message="Payment authorized and completed.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. Cancel
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/payment/session/{sid}/cancel",
    response_model=PaymentSessionResponse,
    summary="Cancel the payment",
)
async def cancel_payment(sid: str) -> PaymentSessionResponse:
    _get(sid)
    try:
        session = ps.transition(sid, S.CANCELLED, reason="cancelled by user",
                                pin_allowed=False,
                                pin_block_reason="This payment was cancelled.")
    except ps.IllegalTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _session_response(session)


# ─────────────────────────────────────────────────────────────────────────────
# 7. Read session
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/payment/session/{sid}",
    response_model=PaymentSessionResponse,
    summary="Full payment session state",
)
async def read_payment_session(sid: str) -> PaymentSessionResponse:
    session = _get(sid)
    response = _session_response(session)
    response.risk = _refresh_risk_view(session)
    return response


# ─────────────────────────────────────────────────────────────────────────────
# 8. Transaction history
# ─────────────────────────────────────────────────────────────────────────────

def _record(session: Dict[str, Any]) -> TransactionRecord:
    risk = session.get("risk") or {}
    tier = risk.get("riskTier")
    return TransactionRecord(
        transaction_id=session["transaction_id"],
        session_id=session["session_id"],
        receiver_upi_id=session["receiver_upi_id"],
        sender_upi_id=session.get("sender_upi_id"),
        amount=session["amount"],
        note=session.get("note"),
        state=PaymentState(session["state"]),
        outcome=ps.outcome_of(session),
        category=ps.category_of(session),
        risk_score=risk.get("riskScore"),
        risk_tier=RiskTier(tier) if tier else None,
        created_at=session["created_at"],
        updated_at=session["updated_at"],
    )


@router.get(
    "/transactions",
    response_model=List[TransactionRecord],
    summary="Transaction history, newest first",
)
async def list_transactions(
    filter: str = Query("all", pattern="^(all|safe|warning|held|blocked)$"),
) -> List[TransactionRecord]:
    return [_record(s) for s in ps.history_sessions(filter)]


@router.get(
    "/transactions/{txn_id}",
    response_model=TransactionDetail,
    summary="Transaction detail — score, tier, factors, verification, evidence ref",
)
async def transaction_detail(txn_id: str) -> TransactionDetail:
    match = next(
        (s for s in ps.list_sessions()
         if s["transaction_id"] == txn_id or s["session_id"] == txn_id),
        None,
    )
    if match is None:
        raise HTTPException(status_code=404, detail=f"Unknown transaction '{txn_id}'.")

    risk = match.get("risk") or {}
    base = _record(match).model_dump()
    evidence_id = match.get("evidence_bundle_id")
    return TransactionDetail(
        **base,
        decision=risk.get("decision"),
        required_action=ps.required_action_for(match),
        factors=risk.get("factors", []),
        verification=_public_verification(match),
        evidence_bundle_id=evidence_id,
        evidence_reference=f"evidence/{match['transaction_id']}.enc" if evidence_id else None,
        ivr_call_initiated=bool(match.get("ivr_call_initiated")),
        mode=match.get("mode", "model"),
        history=match.get("history", []),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 9. Trusted contacts
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/trusted-contacts",
    response_model=List[TrustedContact],
    summary="List trusted contacts",
)
async def get_trusted_contacts() -> List[TrustedContact]:
    return [TrustedContact(**c) for c in ps.list_contacts()]


@router.post(
    "/trusted-contacts",
    response_model=TrustedContact,
    status_code=status.HTTP_201_CREATED,
    summary="Add a trusted contact",
)
async def add_trusted_contact(req: TrustedContactRequest) -> TrustedContact:
    return TrustedContact(**ps.add_contact(
        name=req.name,
        phone_number=req.phone_number,
        relationship=req.relationship,
        is_primary=req.is_primary,
    ))


@router.delete(
    "/trusted-contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a trusted contact",
)
async def remove_trusted_contact(contact_id: str) -> Response:
    if not ps.delete_contact(contact_id):
        raise HTTPException(status_code=404, detail=f"Unknown contact '{contact_id}'.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/trusted-contacts",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a trusted contact (collection form, ?contact_id=…)",
)
async def remove_trusted_contact_query(contact_id: str = Query(...)) -> Response:
    if not ps.delete_contact(contact_id):
        raise HTTPException(status_code=404, detail=f"Unknown contact '{contact_id}'.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
