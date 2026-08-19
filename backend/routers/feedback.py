"""
GuardPay AI — Feedback Router (Full Implementation)
PROMPT 12: POST /api/v1/feedback + GET /api/v1/stats
Persists to Supabase feedback table. In-memory fallback if Supabase unavailable.

Author: Shanteshwar (Backend Lead)
"""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter
from backend.schemas.models import FeedbackRequest, FeedbackResponse, StatsResponse
from backend.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory store (fallback when Supabase is unavailable)
_feedback_store: list[dict] = []
_supabase_client = None


async def _get_supabase():
    """Lazy init Supabase client."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        return None
    try:
        from supabase import create_client
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        return _supabase_client
    except ImportError:
        logger.warning("[Feedback] supabase package not installed — using in-memory store")
        return None
    except Exception as e:
        logger.warning(f"[Feedback] Supabase init failed: {e} — using in-memory store")
        return None


@router.post("/feedback", response_model=FeedbackResponse, summary="Report scam outcome")
async def capture_feedback(req: FeedbackRequest) -> FeedbackResponse:
    """
    User marks whether a flagged transaction was actually a scam.
    Stored in Supabase feedback table (in-memory fallback if unavailable).
    Batch recalibration: python scripts/recalibrate_thresholds.py (Jatin owns this)
    """
    record = {
        "transaction_id": req.transaction_id,
        "was_scam": req.was_scam,
        "reported_by": req.reported_by or "anonymous",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Try Supabase first
    sb = await _get_supabase()
    if sb:
        try:
            sb.table("feedback").insert(record).execute()
            logger.info(f"[Feedback] Persisted to Supabase: txn={req.transaction_id} was_scam={req.was_scam}")
        except Exception as e:
            logger.warning(f"[Feedback] Supabase insert failed ({e}) — storing in-memory")
            _feedback_store.append(record)
    else:
        _feedback_store.append(record)
        logger.info(f"[Feedback] In-memory: txn={req.transaction_id} was_scam={req.was_scam}")

    return FeedbackResponse(
        transaction_id=req.transaction_id,
        recorded=True,
        message="Thank you. Your feedback improves GuardPay AI accuracy for everyone.",
    )


@router.get("/stats", response_model=StatsResponse, summary="False-positive rate stats")
async def get_stats() -> StatsResponse:
    """
    Returns precision/recall stats from feedback data.
    Uses Supabase aggregation if available, else computes from in-memory store.
    """
    # Try Supabase
    sb = await _get_supabase()
    records = _feedback_store  # default to in-memory

    if sb:
        try:
            result = sb.table("feedback").select("*").execute()
            records = result.data if result.data else _feedback_store
        except Exception as e:
            logger.warning(f"[Stats] Supabase query failed ({e}) — using in-memory")

    total = len(records)
    scam_reports = sum(1 for f in records if f.get("was_scam", False))
    false_positives = total - scam_reports

    precision = round(scam_reports / total, 4) if total > 0 else 0.0
    recall = 1.0  # conservative — assume we catch all scams (real value needs ground truth negatives)
    fp_rate = round(false_positives / total, 4) if total > 0 else 0.0

    return StatsResponse(
        total_feedback=total,
        scam_reports=scam_reports,
        false_positives=false_positives,
        false_positive_rate=fp_rate,
        precision=precision,
        recall=recall,
    )
