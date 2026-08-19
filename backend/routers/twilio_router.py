"""Twilio IVR router — stub for PROMPT 8 & 9"""
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from backend.schemas.models import SessionStatusResponse

router = APIRouter()


@router.post(
    "/twilio/callback",
    summary="Twilio DTMF webhook (PROMPT 9)",
    response_class=PlainTextResponse,
)
async def twilio_dtmf_callback(request: Request):
    """
    Receives DTMF keypress from trusted contact.
    Press 1 → AUTHORISED, Press 2 → FROZEN.
    PROMPT 9 will implement full logic here.
    """
    # TODO PROMPT 9: parse DTMF, update session, send bank alert on '2'
    form = await request.form()
    digit = form.get("Digits", "")
    txn_id = form.get("CallSid", "unknown")

    if digit == "1":
        action = "Transaction AUTHORISED by trusted contact."
    elif digit == "2":
        action = "Transaction FROZEN by trusted contact. Bank alerted."
    else:
        action = "No input received. Transaction remains blocked."

    # Return TwiML
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>{action}</Say>
</Response>"""
    return PlainTextResponse(content=twiml, media_type="text/xml")
