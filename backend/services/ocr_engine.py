"""
ocr_engine.py — OCR Fake Screen / Scam Document Detector
GuardPay AI · AI/ML Module (Jatin)

Uses pytesseract (server-side fallback) or Google ML Kit output passed
as a pre-extracted string. Fuzzy-matches the extracted text against a
curated scam-phrase dictionary.

Contract:
    analyze_screen(image_bytes: bytes | None, text: str | None) -> {
        'ocr_score': float,   — 0–1 match confidence
        'matched_phrases': list[str],
        'raw_text': str,
    }

Async-safe via asyncio.to_thread.

Commit: feat(ocr): integrate OCR → fuzzy match scam-phrase detector
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path

# ── Scam document phrases ──────────────────────────────────────────────────────
# Phrases commonly seen on fake government notices, CBI/ED letterheads,
# fake court orders shown during screen-share scams.
SCAM_PHRASES = [
    # Government impersonation
    "central bureau of investigation", "enforcement directorate",
    "narcotics control bureau", "ministry of home affairs",
    "reserve bank of india", "trai notice", "high court of india",
    "supreme court of india", "cyber crime division",
    # Action words
    "arrest warrant", "non-bailable warrant", "court summons",
    "freeze account", "account suspended", "transaction blocked",
    "money laundering", "drug trafficking", "terrorist funding",
    "immediate compliance required", "failure to comply",
    "fir number", "case number", "reference number",
    "penalty of", "fine of rs", "imprisonment",
    # Urgency markers
    "pay immediately", "within 24 hours", "within 2 hours",
    "last notice", "final warning", "do not ignore",
    # Hindi/transliterated
    "giraftari", "arresti", "arrest warrant", "court ka order",
    "cbdt notice", "income tax department",
    # Common fake doc header patterns
    "government of india", "भारत सरकार", "official notice",
    "confidential document", "not for circulation",
]


# ── Fuzzy matching ─────────────────────────────────────────────────────────────

def _fuzzy_phrase_match(text: str, phrases: list[str], threshold: float = 0.75) -> list[str]:
    """
    Match scam phrases against extracted text using simple token overlap
    (no external library needed — pure Python for speed).

    Returns list of matched phrases where overlap ratio >= threshold.
    """
    text_lower  = text.lower()
    text_tokens = set(re.findall(r'\b\w+\b', text_lower))
    matched     = []

    for phrase in phrases:
        phrase_tokens = set(re.findall(r'\b\w+\b', phrase.lower()))
        if not phrase_tokens:
            continue
        # Direct substring match — fast path
        if phrase.lower() in text_lower:
            matched.append(phrase)
            continue
        # Token overlap ratio — slower path
        overlap = len(phrase_tokens & text_tokens) / len(phrase_tokens)
        if overlap >= threshold:
            matched.append(phrase)

    return matched


def _ocr_score(matched: list[str], total_phrases: int) -> float:
    """
    Compute a normalised match score.
    Clipped at 1.0; each match contributes a weighted amount.
    """
    if not matched:
        return 0.0
    # Weight by number of words in matched phrase (longer = stronger signal)
    total_weight = sum(len(p.split()) for p in matched)
    max_weight   = 20.0   # empirical cap
    return float(min(total_weight / max_weight, 1.0))


# ── OCR extraction ─────────────────────────────────────────────────────────────

def _extract_text_from_image(image_bytes: bytes) -> str:
    """
    Extract text from a screenshot/image using pytesseract (server-side fallback).
    Returns empty string if pytesseract is not installed.
    """
    try:
        import pytesseract
        from PIL import Image
        import io
        img  = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(img, lang="eng+hin")
        return text
    except ImportError:
        print("[ocr_engine] pytesseract not installed — pass pre-extracted text instead")
        return ""
    except Exception as exc:
        print(f"[ocr_engine] OCR extraction failed: {exc}")
        return ""


# ── Core analysis ──────────────────────────────────────────────────────────────

def _analyze_blocking(image_bytes: bytes | None, text: str | None) -> dict:
    """Blocking OCR analysis — run inside asyncio.to_thread."""
    # Use provided text (e.g. from Google ML Kit) or extract via pytesseract
    if text:
        raw_text = text
    elif image_bytes:
        raw_text = _extract_text_from_image(image_bytes)
    else:
        raw_text = ""

    matched  = _fuzzy_phrase_match(raw_text, SCAM_PHRASES)
    score    = _ocr_score(matched, len(SCAM_PHRASES))

    return {
        "ocr_score":       round(score, 4),
        "matched_phrases": matched,
        "raw_text":        raw_text[:500],   # truncate for logging
    }


# ── Public API ─────────────────────────────────────────────────────────────────

def analyze_screen(
    image_bytes: bytes | None = None,
    text:        str   | None = None,
) -> dict:
    """
    Synchronous OCR scam-phrase analysis.

    Provide either image_bytes (will run pytesseract) or pre-extracted text
    (from Google ML Kit on the mobile device).

    Returns:
        {'ocr_score': float, 'matched_phrases': list[str], 'raw_text': str}
    """
    return _analyze_blocking(image_bytes, text)


async def analyze_screen_async(
    image_bytes: bytes | None = None,
    text:        str   | None = None,
) -> dict:
    """Async-safe wrapper for asyncio.gather()."""
    return await asyncio.to_thread(_analyze_blocking, image_bytes, text)


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 70)
    print("GuardPay AI — ocr_engine.py self-test")
    print("=" * 70)

    test_cases = [
        (
            "Fake CBI notice",
            "CENTRAL BUREAU OF INVESTIGATION\nArrest Warrant No. CBI/2024/12345\n"
            "This is to inform you that a non-bailable warrant has been issued "
            "against you for money laundering. Pay immediately to avoid arrest.",
            True,   # expect high score
        ),
        (
            "Normal receipt",
            "Payment Receipt\nAmount: ₹500\nDate: 19 Aug 2026\nMerchant: FoodPanda\nStatus: Success",
            False,  # expect low score
        ),
        (
            "Hindi scam text",
            "भारत सरकार — Enforcement Directorate\nआपके खिलाफ giraftari warrant जारी किया गया है।\n"
            "Immediate compliance required. Do not ignore this final warning.",
            True,
        ),
    ]

    all_pass = True
    for name, text, expect_high in test_cases:
        result = analyze_screen(text=text)
        score_high = result["ocr_score"] > 0.2
        ok = score_high == expect_high
        if not ok:
            all_pass = False
        status = "✓" if ok else "✗"
        print(f"\n  {status}  {name}")
        print(f"     ocr_score    = {result['ocr_score']:.4f}")
        print(f"     matched      = {result['matched_phrases'][:3]}")

    print()
    print("✓ All tests passed" if all_pass else "✗ Some tests failed")
    print("=" * 70)
