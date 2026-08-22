"""
GuardPay AI — MongoDB Reputation Service
PROMPT 3: Bayesian time-decay trust score + 5,000 synthetic UPI ID seed
"""

import asyncio
import logging
import random
import math
from datetime import datetime, timedelta
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient
from backend.core.config import settings

logger = logging.getLogger(__name__)

# MongoDB collection handle (initialised at startup)
_db = None
_collection = None


async def init_reputation_service():
    """Called at app startup. Connects to MongoDB and seeds mock data if empty."""
    global _db, _collection
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=3000)
        _db = client.guardpay
        _collection = _db.upi_reputation
        logger.info("✅ MongoDB connected for reputation service.")

        # Seed synthetic data if collection is empty
        count = await _collection.count_documents({})
        if count == 0:
            logger.info("Seeding 5,000 synthetic UPI IDs...")
            await _seed_synthetic_upi_ids()
            logger.info("✅ 5,000 UPI IDs seeded.")
    except Exception as e:
        logger.warning(f"⚠️ MongoDB unavailable — reputation service in fallback mode: {e}")
        _collection = None


def get_status() -> str:
    """Real backing-store state, for /health. Never lies about the connection."""
    return "connected" if _collection is not None else "fallback (mongodb unavailable)"


async def _seed_synthetic_upi_ids():
    """
    Seeds 5,000 mock UPI IDs with randomised complaint history.
    Schema: { upi_id, complaint_count, last_flagged, trust_score, created_at }
    """
    providers = ["@ybl", "@paytm", "@oksbi", "@okhdfcbank", "@okaxis", "@upi", "@icici"]
    docs = []
    for i in range(5000):
        # ~5% are flagged (scammer) UPI IDs
        is_flagged = random.random() < 0.05
        complaint_count = random.randint(5, 50) if is_flagged else random.randint(0, 2)
        last_flagged = (
            datetime.utcnow() - timedelta(days=random.randint(1, 30))
            if complaint_count > 0 else None
        )
        docs.append({
            "upi_id": f"user{i:05d}{random.choice(providers)}",
            "complaint_count": complaint_count,
            "last_flagged": last_flagged,
            "trust_score": _bayesian_trust_score(complaint_count, last_flagged),
            "created_at": datetime.utcnow(),
        })

    # Bulk insert in chunks
    chunk_size = 500
    for i in range(0, len(docs), chunk_size):
        await _collection.insert_many(docs[i: i + chunk_size])


def _bayesian_trust_score(
    complaint_count: int,
    last_flagged: Optional[datetime],
    alpha: float = 1.0,   # prior positives
    beta: float = 10.0,   # prior negatives
    decay_half_life_days: float = 14.0,
) -> float:
    """
    Bayesian time-decay trust score mapped to 0–1.
    High score = trustworthy. Low score = suspicious.

    Formula:
      decay_weight = exp(-ln2 * days_since_flag / half_life)
      effective_complaints = complaint_count * decay_weight
      trust = beta / (alpha + beta + effective_complaints)
    """
    if complaint_count == 0 or last_flagged is None:
        return round(beta / (alpha + beta), 4)  # base prior trust

    days_since = (datetime.utcnow() - last_flagged).days
    decay_weight = math.exp(-math.log(2) * days_since / decay_half_life_days)
    effective_complaints = complaint_count * decay_weight
    trust = beta / (alpha + beta + effective_complaints)
    return round(max(0.0, min(1.0, trust)), 4)


async def get_reputation(upi_id: str) -> dict:
    """
    Returns reputation data for a UPI ID.
    Falls back to neutral trust if MongoDB is unavailable or ID not found.
    """
    fallback = {
        "upi_id": upi_id,
        "complaint_count": 0,
        "trust_score": 0.9,  # benefit of the doubt
        "reputation_factor": 0.0,  # low risk contribution
        "found": False,
    }

    if _collection is None:
        # Mock/demo heuristic when offline: flag test IDs containing scam/fraud
        if any(w in upi_id.lower() for w in ("scam", "fraud", "fake")):
            return {
                "upi_id": upi_id,
                "complaint_count": 42,
                "trust_score": 0.05,
                "reputation_factor": 0.95,
                "found": True,
            }
        return fallback

    try:
        doc = await _collection.find_one({"upi_id": upi_id})
        if not doc:
            return fallback

        trust_score = _bayesian_trust_score(
            doc.get("complaint_count", 0),
            doc.get("last_flagged"),
        )
        # reputation_factor: 0 = clean, 1 = highly suspicious
        reputation_factor = round(1.0 - trust_score, 4)

        return {
            "upi_id": upi_id,
            "complaint_count": doc.get("complaint_count", 0),
            "trust_score": trust_score,
            "reputation_factor": reputation_factor,
            "found": True,
        }
    except Exception as e:
        logger.error(f"Reputation lookup failed for {upi_id}: {e}")
        return fallback


async def add_complaint(upi_id: str):
    """Record a new complaint against a UPI ID (called by feedback/bank alert)."""
    if _collection is None:
        return
    now = datetime.utcnow()
    await _collection.update_one(
        {"upi_id": upi_id},
        {
            "$inc": {"complaint_count": 1},
            "$set": {"last_flagged": now},
        },
        upsert=True,
    )
    logger.info(f"Complaint recorded for UPI ID: {upi_id}")
