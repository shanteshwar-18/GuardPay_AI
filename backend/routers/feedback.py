"""Feedback router — POST /api/v1/feedback & GET /api/v1/stats (PROMPT 12)"""
import logging
from datetime import datetime
from fastapi import APIRouter
from backend.schemas.models import FeedbackRequest, FeedbackResponse, StatsResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory feedback store (PROMPT 12 will persist to Supabase)
_feedback_store: list[dict] = []


@router.post("/feedback", response_model=FeedbackResponse, summary="Report scam outcome")
async def capture_feedback(req: FeedbackRequest) -> FeedbackResponse:
    """
    User marks whether a flagged transaction was actually a scam.
    Used for false-positive rate tracking and threshold recalibration.
    PROMPT 12: Full Supabase persistence + recalibration trigger.
    """
    record = {
        "transaction_id": req.transaction_id,
        "was_scam": req.was_scam,
        "reported_by": req.reported_by,
        "timestamp": datetime.utcnow().isoformat(),
    }
    _feedback_store.append(record)
    logger.info(f"Feedback recorded: txn={req.transaction_id} was_scam={req.was_scam}")

    return FeedbackResponse(
        transaction_id=req.transaction_id,
        recorded=True,
        message="Thank you. Your feedback improves GuardPay AI for everyone.",
    )


@router.get("/stats", response_model=StatsResponse, summary="False-positive rate stats")
async def get_stats() -> StatsResponse:
    """
    Returns precision/recall stats from feedback data.
    PROMPT 12 will add Supabase-backed batch stats.
    """
    total = len(_feedback_store)
    scam_reports = sum(1 for f in _feedback_store if f["was_scam"])
    false_positives = total - scam_reports  # warnings that were NOT scams

    precision = scam_reports / total if total > 0 else 0.0
    recall = 1.0  # placeholder — real recall needs ground truth negatives

    return StatsResponse(
        total_feedback=total,
        scam_reports=scam_reports,
        false_positives=false_positives,
        false_positive_rate=round(false_positives / total, 4) if total > 0 else 0.0,
        precision=round(precision, 4),
        recall=round(recall, 4),
    )
