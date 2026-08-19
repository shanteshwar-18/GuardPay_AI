"""
GuardPay AI — Bloom Filter Beneficiary Cache
PROMPT 4: O(1) is_new_beneficiary() lookup via ScalableBloomFilter
"""

import logging
import json
import random
from pathlib import Path

logger = logging.getLogger(__name__)

# Try to use pybloom_live (ScalableBloomFilter), fall back to a set-based mock
try:
    from pybloom_live import ScalableBloomFilter
    _HAS_BLOOM = True
except ImportError:
    _HAS_BLOOM = False
    logger.warning("pybloom_live not installed — using set-based fallback for Bloom filter")

# The Bloom filter / fallback set
_bloom: object = None
_known_pairs_fallback: set[str] = set()

# Path to mock known-beneficiary seed data
MOCK_SEED_PATH = Path(__file__).parent.parent.parent / "data" / "mock" / "known_beneficiaries.json"


async def init_bloom_filter():
    """Called at app startup. Loads known (sender, receiver) pairs into the Bloom filter."""
    global _bloom

    if _HAS_BLOOM:
        _bloom = ScalableBloomFilter(
            mode=ScalableBloomFilter.SMALL_SET_GROWTH,
            error_rate=0.001,
        )
    else:
        _bloom = None

    # Load from seed file if it exists, else generate synthetic pairs
    if MOCK_SEED_PATH.exists():
        with open(MOCK_SEED_PATH) as f:
            pairs = json.load(f)
        logger.info(f"Loading {len(pairs)} known beneficiary pairs from {MOCK_SEED_PATH}")
    else:
        logger.info("Generating synthetic known-beneficiary pairs for Bloom filter seed...")
        pairs = _generate_synthetic_pairs(10_000)
        # Save for reproducibility
        MOCK_SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MOCK_SEED_PATH, "w") as f:
            json.dump(pairs, f, indent=2)
        logger.info(f"✅ Saved {len(pairs)} synthetic pairs to {MOCK_SEED_PATH}")

    # Populate filter
    for pair in pairs:
        key = f"{pair['sender']}|{pair['receiver']}"
        if _HAS_BLOOM and _bloom:
            _bloom.add(key)
        else:
            _known_pairs_fallback.add(key)

    size = len(pairs)
    logger.info(f"✅ Bloom filter loaded with {size} known (sender, receiver) pairs.")


def _generate_synthetic_pairs(n: int) -> list[dict]:
    """Generate synthetic (sender, receiver) UPI ID pairs for demo seeding."""
    providers = ["@ybl", "@paytm", "@oksbi", "@okhdfcbank", "@okaxis", "@upi", "@icici"]
    pairs = []
    for i in range(n):
        sender = f"sender{i % 1000:04d}{random.choice(providers)}"
        receiver = f"merchant{random.randint(0, 999):04d}{random.choice(providers)}"
        pairs.append({"sender": sender, "receiver": receiver})
    return pairs


def is_new_beneficiary(sender_upi_id: str, receiver_upi_id: str) -> bool:
    """
    O(1) check: returns True if this (sender, receiver) pair has NEVER transacted before.
    Bloom filter has ~0.1% false-positive rate (says known when actually new).
    False negatives are IMPOSSIBLE — if it says new, it is definitely new.
    """
    key = f"{sender_upi_id}|{receiver_upi_id}"
    if _HAS_BLOOM and _bloom:
        return key not in _bloom  # not in bloom = definitely new
    return key not in _known_pairs_fallback


def mark_known(sender_upi_id: str, receiver_upi_id: str):
    """
    Call this after a successful payment to teach the filter the pair is known.
    Note: Bloom filters are append-only — cannot remove entries.
    """
    key = f"{sender_upi_id}|{receiver_upi_id}"
    if _HAS_BLOOM and _bloom:
        _bloom.add(key)
    else:
        _known_pairs_fallback.add(key)
