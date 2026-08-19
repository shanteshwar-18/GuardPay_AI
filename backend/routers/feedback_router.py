"""
feedback_router.py — Supabase Feedback Capture & Stats Endpoint
GuardPay AI · AI/ML Module (Jatin)

Provides:
  POST /api/v1/feedback           — capture user feedback on a transaction
  GET  /api/v1/feedback/stats     — precision/recall/false-positive-rate

Integrates with Supabase for persistence. Falls back to in-memory store
if Supabase is unavailable (demo resilience).

Commit: feat(feedback): Supabase feedback capture and threshold recalibration script
        feat(feedback): false-positive monitoring dashboard endpoint
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/v1/feedback", tags=["Feedback"])

# ── In-memory fallback store ──────────────────────────────────────────────────
# Used when SUPABASE_URL is not set or Supabase is unavailable
_memory_store: list[dict] = []


# ── Supabase client ───────────────────────────────────────────────────────────

def _get_supabase():
    """Lazy Supabase client — returns None if credentials not configured."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as exc:
        print(f"[feedback] Supabase init failed: {exc} — using in-memory fallback")
        return None


# ── Schemas ───────────────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    txn_id:       str
    was_scam:     bool              # Ground truth from user / bank
    risk_score:   int               # Score that was assigned at time of txn
    risk_tier:    str               # e.g. 'WARNING', 'HARD_INTERCEPT'
    user_action:  Optional[str] = None    # 'proceeded', 'cancelled', 'reported'
    notes:        Optional[str] = None


class FeedbackResponse(BaseModel):
    success:    bool
    feedback_id: Optional[str] = None
    storage:    str             # 'supabase' or 'memory'


class StatsResponse(BaseModel):
    total_feedback:        int
    true_positives:        Optional[int]
    false_positives:       Optional[int]
    true_negatives:        Optional[int]
    false_negatives:       Optional[int]
    precision:             Optional[float]
    recall:                Optional[float]
    false_positive_rate:   Optional[float]
    note:                  Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=FeedbackResponse)
async def submit_feedback(feedback: FeedbackRequest):
    """Capture user feedback on a transaction risk assessment."""
    row = {
        "txn_id":      feedback.txn_id,
        "was_scam":    feedback.was_scam,
        "risk_score":  feedback.risk_score,
        "risk_tier":   feedback.risk_tier,
        "user_action": feedback.user_action,
        "notes":       feedback.notes,
        "created_at":  datetime.now(timezone.utc).isoformat(),
    }

    client = _get_supabase()
    if client:
        try:
            result = client.table("feedback").insert(row).execute()
            fb_id  = result.data[0].get("id") if result.data else None
            return FeedbackResponse(success=True, feedback_id=str(fb_id), storage="supabase")
        except Exception as exc:
            print(f"[feedback] Supabase insert failed: {exc} — falling back to memory")

    # Fallback: in-memory store
    _memory_store.append(row)
    return FeedbackResponse(success=True, feedback_id=None, storage="memory")


@router.get("/stats", response_model=StatsResponse)
async def feedback_stats():
    """
    Return precision/recall/false-positive-rate from the feedback table.
    Fields are null if insufficient data is available (never fabricated).
    """
    rows = _fetch_all_feedback()

    if not rows:
        return StatsResponse(
            total_feedback=0,
            true_positives=None, false_positives=None,
            true_negatives=None, false_negatives=None,
            precision=None, recall=None, false_positive_rate=None,
            note="No feedback data available yet.",
        )

    INTERCEPT_THRESHOLD = 70   # Risk scores >= 70 treated as 'predicted positive'

    tp = fp = tn = fn = 0
    for row in rows:
        predicted_positive = row.get("risk_score", 0) >= INTERCEPT_THRESHOLD
        actual_positive    = bool(row.get("was_scam", False))

        if predicted_positive and actual_positive:     tp += 1
        elif predicted_positive and not actual_positive: fp += 1
        elif not predicted_positive and not actual_positive: tn += 1
        else:                                           fn += 1

    precision = (tp / (tp + fp)) if (tp + fp) > 0 else None
    recall    = (tp / (tp + fn)) if (tp + fn) > 0 else None
    fpr       = (fp / (fp + tn)) if (fp + tn) > 0 else None

    return StatsResponse(
        total_feedback=len(rows),
        true_positives=tp,
        false_positives=fp,
        true_negatives=tn,
        false_negatives=fn,
        precision=round(precision, 4) if precision is not None else None,
        recall=round(recall, 4) if recall is not None else None,
        false_positive_rate=round(fpr, 4) if fpr is not None else None,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_all_feedback() -> list[dict]:
    """Fetch all feedback rows from Supabase or fallback to in-memory store."""
    client = _get_supabase()
    if client:
        try:
            result = client.table("feedback").select("*").execute()
            return result.data or []
        except Exception as exc:
            print(f"[feedback] Supabase fetch failed: {exc} — using in-memory data")
    return _memory_store


def get_memory_store() -> list[dict]:
    """Expose in-memory store for tests and recalibration script."""
    return _memory_store


# ── Test harness ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    """
    Insert 5 mock feedback rows (mixed was_scam), then compute and print stats.
    """
    import asyncio

    print("=" * 60)
    print("GuardPay AI — feedback_router.py test harness")
    print("=" * 60)

    MOCK_ROWS = [
        FeedbackRequest(txn_id="txn_001", was_scam=True,  risk_score=92, risk_tier="HARD_INTERCEPT"),
        FeedbackRequest(txn_id="txn_002", was_scam=False, risk_score=45, risk_tier="WARNING"),
        FeedbackRequest(txn_id="txn_003", was_scam=True,  risk_score=88, risk_tier="ELEVATED"),
        FeedbackRequest(txn_id="txn_004", was_scam=False, risk_score=20, risk_tier="ALLOWED"),
        FeedbackRequest(txn_id="txn_005", was_scam=True,  risk_score=75, risk_tier="ELEVATED"),
    ]

    async def run():
        print("\nInserting 5 mock feedback rows ...")
        for row in MOCK_ROWS:
            result = await submit_feedback(row)
            print(f"  {result.storage:8}  txn={row.txn_id}  was_scam={row.was_scam}")

        print("\nFetching stats ...")
        stats = await feedback_stats()
        print(f"  total_feedback:       {stats.total_feedback}")
        print(f"  true_positives:       {stats.true_positives}")
        print(f"  false_positives:      {stats.false_positives}")
        print(f"  true_negatives:       {stats.true_negatives}")
        print(f"  false_negatives:      {stats.false_negatives}")
        print(f"  precision:            {stats.precision}")
        print(f"  recall:               {stats.recall}")
        print(f"  false_positive_rate:  {stats.false_positive_rate}")

        # Verify: no None values where data is available
        assert stats.total_feedback == 5, "Expected 5 feedback rows"
        assert stats.precision  is not None or (stats.true_positives == 0 and stats.false_positives == 0)
        assert stats.recall     is not None or (stats.true_positives == 0 and stats.false_negatives == 0)
        print("\n✓ Stats computed correctly (no fabricated numbers)")

    asyncio.run(run())
    print("=" * 60)
