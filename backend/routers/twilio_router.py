"""
GuardPay AI — Twilio Router (Full Implementation)
PROMPT 9: DTMF Webhook & Session Status
Handles inbound Twilio callback, interprets DTMF, updates session, triggers bank alert on '2'.

Author: Shanteshwar (Backend Lead)
"""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Query
from fastapi.responses import PlainTextResponse

from backend.schemas.models import IVROutcome, TransactionStatus
from backend.routers.session import update_session

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# TwiML serve endpoint (inline TwiML — avoids needing public webhook for demo)
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/twilio/twiml/{txn_id}",
    response_class=PlainTextResponse,
    summary="Serve TwiML for IVR call",
    include_in_schema=False,
)
async def serve_twiml(txn_id: str):
    """
    Twilio fetches TwiML from this URL when the trusted contact picks up.
    Falls back to inline TwiML so the demo works without a public server.
    """
    from backend.routers.session import _sessions
    session = _sessions.get(txn_id, {})
    amount = session.get("amount", "an unknown amount")
    upi_id = session.get("receiver_upi_id", "an unknown recipient")

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-IN">
        This is GuardPay A I. A payment of Rupees {amount}
        to {upi_id} has been flagged as high risk.
    </Say>
    <Gather numDigits="1" action="/api/v1/twilio/callback?txn_id={txn_id}" method="POST" timeout="10">
        <Say voice="alice" language="en-IN">
            Press 1 to authorise this payment.
            Press 2 to freeze it and alert your bank.
        </Say>
    </Gather>
    <Say voice="alice" language="en-IN">No input. Payment remains blocked.</Say>
</Response>"""
    return PlainTextResponse(content=twiml, media_type="text/xml")


# ─────────────────────────────────────────────────────────────────────────────
# PROMPT 9 — DTMF Webhook
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/twilio/callback",
    response_class=PlainTextResponse,
    summary="Twilio DTMF webhook — PROMPT 9",
)
async def twilio_dtmf_callback(
    request: Request,
    txn_id: str = Query(default="unknown", description="Transaction ID passed via query param"),
):
    """
    Receives DTMF keypress from trusted contact via Twilio callback.

    Digit '1' → AUTHORISED → release transaction
    Digit '2' → FROZEN → freeze + send bank fraud alert
    No digit   → NO_RESPONSE → remains blocked
    """
    form = await request.form()
    digit = form.get("Digits", "").strip()
    call_sid = form.get("CallSid", "unknown")

    logger.info(f"[Twilio DTMF] txn={txn_id} call_sid={call_sid} digit='{digit}'")
    now = datetime.now(timezone.utc).isoformat()

    if digit == "1":
        # Trusted contact AUTHORISED the payment
        update_session(
            txn_id,
            status=TransactionStatus.RELEASED,
            ivr_outcome=IVROutcome.AUTHORISED,
            updated_at=now,
        )
        logger.info(f"[Twilio] txn={txn_id} AUTHORISED by trusted contact")
        response_text = (
            "Thank you. The payment has been authorised. "
            "Your family member can now proceed. Goodbye."
        )
        _trigger_bank_alert(txn_id, "AUTHORISED")

    elif digit == "2":
        # Trusted contact FROZE the payment
        update_session(
            txn_id,
            status=TransactionStatus.FROZEN,
            ivr_outcome=IVROutcome.FROZEN,
            updated_at=now,
        )
        logger.warning(f"[Twilio] txn={txn_id} FROZEN by trusted contact — sending bank alert")
        response_text = (
            "The payment has been frozen. "
            "We are alerting your bank's fraud team immediately. "
            "Please call your family member to ensure their safety. Goodbye."
        )
        # Trigger bank alert on freeze
        _trigger_bank_alert(txn_id, "FROZEN")

    else:
        # No input or unrecognised digit
        update_session(
            txn_id,
            status=TransactionStatus.BLOCKED,
            ivr_outcome=IVROutcome.NO_RESPONSE,
            updated_at=now,
        )
        logger.warning(f"[Twilio] txn={txn_id} NO_RESPONSE from trusted contact")
        response_text = (
            "No input received. The payment remains blocked for safety. "
            "Please check on your family member directly. Goodbye."
        )

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-IN">{response_text}</Say>
</Response>"""
    return PlainTextResponse(content=twiml, media_type="text/xml")


def _trigger_bank_alert(txn_id: str, outcome: str):
    """Fire-and-forget bank alert after DTMF resolution."""
    import asyncio
    try:
        from backend.services.bank_alert_service import send_alert
        from backend.routers.session import _sessions
        session = _sessions.get(txn_id, {})

        async def _alert():
            try:
                await send_alert(
                    transaction_id=txn_id,
                    risk_score=session.get("risk_score", 95.0),
                    contributing_factors=[f"IVR outcome: {outcome}"],
                    beneficiary_upi_id=session.get("receiver_upi_id", "unknown"),
                    amount=session.get("amount", 0),
                    evidence_bundle_id=session.get("evidence_bundle_id"),
                )
            except Exception as e:
                logger.error(f"[BankAlert] post-DTMF alert failed: {e}")

        asyncio.create_task(_alert())
    except ImportError:
        logger.warning("[BankAlert] bank_alert_service not available (PROMPT 11 pending)")
