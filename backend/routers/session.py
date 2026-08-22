"""Session status router — GET /api/v1/session/{txn_id}/status"""
import logging
from fastapi import APIRouter, HTTPException
from backend.schemas.models import SessionStatusResponse, TransactionStatus

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory session store — PROMPT 9 will expand this with IVR outcome storage
_sessions: dict[str, dict] = {}


def get_session_record(txn_id: str) -> dict | None:
    """Raw session dict (risk_score, tier, ivr_outcome...) or None if unknown."""
    return _sessions.get(txn_id)


def update_session(txn_id: str, **kwargs):
    """Called by other services (Twilio callback, risk router) to update session state."""
    if txn_id not in _sessions:
        _sessions[txn_id] = {"status": TransactionStatus.PENDING}
    _sessions[txn_id].update(kwargs)
    logger.info(f"Session updated: txn={txn_id} → {_sessions[txn_id]}")


@router.get(
    "/session/{txn_id}/status",
    response_model=SessionStatusResponse,
    summary="Poll transaction session status",
)
async def get_session_status(txn_id: str) -> SessionStatusResponse:
    """
    Frontend polls this to check IVR outcome and final transaction fate.
    PROMPT 9 will enrich this with DTMF response from Twilio callback.
    """
    session = _sessions.get(txn_id)
    if not session:
        # Return PENDING for unknown txn (mobile may poll before risk endpoint completes)
        return SessionStatusResponse(
            transaction_id=txn_id,
            status=TransactionStatus.PENDING,
        )
    return SessionStatusResponse(
        transaction_id=txn_id,
        status=session.get("status", TransactionStatus.PENDING),
        ivr_outcome=session.get("ivr_outcome"),
        risk_score=session.get("risk_score"),
        updated_at=session.get("updated_at"),
    )


@router.get(
    "/session/{txn_id}/score-stream",
    summary="SSE stream of live risk-score updates while audio is streaming",
)
async def score_stream(txn_id: str):
    """
    Server-Sent Events stream of the live risk score (playbook Step 7.1).

    Events are pushed by the live_scoring worker as each 3-second audio window is
    analysed, rather than polled on a fixed loop — so the stream is silent when
    nothing changes and immediate when it does. A keep-alive comment goes out every
    15 s so idle proxies do not drop the connection, and the stream ends once the
    worker reports `final`.
    """
    import asyncio
    import json

    from fastapi.responses import StreamingResponse

    from backend.services import live_scoring

    KEEPALIVE_SEC = 15.0

    async def event_generator():
        with live_scoring.subscription(txn_id) as (sess, queue):
            # Emit current state immediately so a late subscriber is not left blank.
            yield f"data: {json.dumps(sess.snapshot())}\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SEC)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                except asyncio.CancelledError:      # client disconnected
                    break
                yield f"data: {json.dumps(payload)}\n\n"
                if payload.get("final"):
                    break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
