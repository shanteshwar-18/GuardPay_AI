"""
GuardPay AI — Twilio Trusted-Contact IVR Service
PROMPT 8: Outbound IVR Call (initiate_ivr_call)
PROMPT 9: DTMF Webhook & Session Status wired here too

Flow:
  HARD_INTERCEPT → initiate_ivr_call() → Twilio dials trusted contact
  → TwiML plays warning + <Gather> for DTMF
  → POST /api/v1/twilio/callback receives digit
  → '1' = AUTHORISED → release | '2' = FROZEN → freeze + bank alert

Author: Shanteshwar (Backend Lead)
"""

import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)


def _build_twiml(transaction_id: str, amount: float, receiver_upi_id: str) -> str:
    """
    Generates TwiML script with <Gather> for DTMF input.
    Playbook spec: 'Press 1 to authorise, press 2 to freeze.'
    """
    amount_str = f"{amount:,.0f}"
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-IN">
        This is GuardPay A I. A payment of Rupees {amount_str}
        to U P I I D {receiver_upi_id.replace('@', ' at ')} 
        has been blocked due to suspected fraud.
    </Say>
    <Gather numDigits="1" action="/api/v1/twilio/callback?txn_id={transaction_id}" method="POST" timeout="10">
        <Say voice="alice" language="en-IN">
            Press 1 to authorise this payment.
            Press 2 to freeze it and alert your bank.
        </Say>
    </Gather>
    <Say voice="alice" language="en-IN">
        No input received. The payment remains blocked for your safety.
        Goodbye.
    </Say>
</Response>"""
    return twiml


async def initiate_ivr_call(
    to_number: str,
    transaction_id: str,
    amount: float,
    receiver_upi_id: str,
    twiml_host: Optional[str] = None,
) -> dict:
    """
    PROMPT 8: Places outbound call to trusted contact via Twilio Programmable Voice.
    Auto-triggered whenever tier == HARD_INTERCEPT.

    Args:
        to_number: E.164 trusted contact number (e.g. +919876543210)
        transaction_id: UPI transaction ID for session tracking
        amount: Transaction amount in INR
        receiver_upi_id: Receiver UPI ID to read out in the IVR message
        twiml_host: Webhook base URL (e.g. https://your-ngrok.io) — reads from env if None

    Returns:
        dict with call_sid and status
    """
    from backend.core.config import settings

    # Validate Twilio credentials
    if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
        logger.warning(
            "[Twilio] Credentials not configured — IVR call SIMULATED. "
            "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env"
        )
        # Return a simulated response so the rest of the system keeps working
        return {
            "call_sid": f"SIMULATED-{transaction_id[:8]}",
            "status": "simulated",
            "to": to_number,
            "note": "Twilio credentials not set — call was not placed (demo mode)",
        }

    try:
        from twilio.rest import Client as TwilioClient

        client = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        # TwiML webhook URL — must be publicly reachable (use ngrok in dev)
        host = twiml_host or f"http://localhost:{settings.BACKEND_PORT}"
        twiml_url = f"{host}/api/v1/twilio/twiml/{transaction_id}"

        # Inline TwiML as fallback (avoids needing public URL during demo)
        twiml_str = _build_twiml(transaction_id, amount, receiver_upi_id)

        # Run Twilio API call in executor (blocking SDK → async wrapper)
        loop = asyncio.get_event_loop()
        call = await loop.run_in_executor(
            None,
            lambda: client.calls.create(
                twiml=twiml_str,
                to=to_number,
                from_=settings.TWILIO_PHONE_NUMBER,
            ),
        )

        logger.info(
            f"[Twilio] IVR call initiated — "
            f"sid={call.sid} to={to_number} txn={transaction_id} status={call.status}"
        )

        return {
            "call_sid": call.sid,
            "status": call.status,
            "to": to_number,
        }

    except ImportError:
        logger.error("[Twilio] twilio package not installed — run: pip install twilio")
        return {"call_sid": None, "status": "error", "note": "twilio not installed"}
    except Exception as e:
        logger.error(f"[Twilio] IVR call failed for txn={transaction_id}: {e}", exc_info=True)
        raise
