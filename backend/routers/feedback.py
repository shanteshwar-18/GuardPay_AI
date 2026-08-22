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

# Score at or above which the engine surfaces friction to the user (WARNING tier).
WARNING_THRESHOLD = 40.0

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
    # Capture what the engine predicted for this transaction at report time.
    # Without it, precision/recall are uncomputable later — you cannot tell a true
    # positive from a false negative knowing only the ground-truth outcome.
    predicted_score = None
    try:
        from backend.routers.session import get_session_record
        predicted_score = (get_session_record(req.transaction_id) or {}).get("risk_score")
    except Exception as exc:
        logger.warning(f"[Feedback] could not resolve predicted score: {exc}")

    record = {
        "transaction_id": req.transaction_id,
        "was_scam": req.was_scam,
        "reported_by": req.reported_by or "anonymous",
        "predicted_score": predicted_score,
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

    # Real confusion matrix: "flagged" means the engine scored the transaction at or
    # above the WARNING threshold. Records with no stored score cannot be classified
    # as TP/FP/FN/TN, so they are reported separately instead of being silently
    # folded into the numerator (which is how recall previously came out as 1.0).
    tp = fp = fn = tn = unscored = 0
    for f in records:
        score = f.get("predicted_score")
        was_scam = bool(f.get("was_scam", False))
        if score is None:
            unscored += 1
            continue
        flagged = float(score) >= WARNING_THRESHOLD
        if flagged and was_scam:
            tp += 1
        elif flagged and not was_scam:
            fp += 1
        elif not flagged and was_scam:
            fn += 1
        else:
            tn += 1

    precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
    recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
    flagged_total = tp + fp
    fp_rate = round(fp / flagged_total, 4) if flagged_total > 0 else 0.0

    return StatsResponse(
        total_feedback=total,
        scam_reports=scam_reports,
        false_positives=fp,
        false_positive_rate=fp_rate,
        precision=precision,
        recall=recall,
        true_positives=tp,
        false_negatives=fn,
        true_negatives=tn,
        unscored=unscored,
    )
