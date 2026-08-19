"""
seed_reputation_db.py — Seed MongoDB with 5,000 synthetic UPI reputation records
GuardPay AI · Backend Utility (Shanteshwar)

Usage:
    python scripts/seed_reputation_db.py
"""

import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.reputation_service import init_reputation_service, _collection


async def main():
    print("🛡️ GuardPay AI — Seeding Reputation Database...")
    try:
        await init_reputation_service()
        if _collection is not None:
            count = await _collection.count_documents({})
            print(f"✅ Total reputation records in database: {count}")
        else:
            print("ℹ️ MongoDB offline — offline mock reputation heuristics are active.")
    except Exception as e:
        print(f"⚠️ Error during seeding: {e}")


if __name__ == "__main__":
    asyncio.run(main())
