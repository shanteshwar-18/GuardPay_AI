"""Session status router — GET /api/v1/session/{txn_id}/status"""
import logging
from fastapi import APIRouter, HTTPException
from backend.schemas.models import SessionStatusResponse, TransactionStatus

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory session store — PROMPT 9 will expand this with IVR outcome storage
_sessions: dict[str, dict] = {}


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
    summary="SSE score stream (Phase 7 — Jatin's pipeline wires this)",
)
async def score_stream(txn_id: str):
    """
    Server-Sent Events endpoint for real-time risk score updates.
    TODO Phase 7: Jatin's pipeline_orchestrator.py pushes updates here
    via asyncio.Queue → SSE stream.
    """
    from fastapi.responses import StreamingResponse
    import asyncio, json

    async def event_generator():
        # Placeholder: emit current session score every 3 seconds
        for _ in range(10):
            session = _sessions.get(txn_id, {})
            yield f"data: {json.dumps({'txn_id': txn_id, 'risk_score': session.get('risk_score', 0)})}\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
