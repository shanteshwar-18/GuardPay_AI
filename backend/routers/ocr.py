"""OCR router — POST /api/v1/ocr"""
import base64
import logging
from fastapi import APIRouter
from backend.schemas.models import OCRRequest, OCRResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Scam phrases for fuzzy matching (Phase 7.2 will load from scam_phrases_template.json)
SCAM_PHRASES = [
    "Arrest Warrant", "Account Freeze", "CBI Notice",
    "ED Investigation", "Income Tax Notice", "Digital Arrest",
    "RBI Order", "Court Notice", "Police Complaint",
    "Secure Account", "Freeze Account", "Illegal Activity",
]


def _levenshtein(s1: str, s2: str) -> int:
    """Simple Levenshtein distance for fuzzy phrase matching."""
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            dp[i][j] = (dp[i-1][j-1] if s1[i-1] == s2[j-1]
                        else 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]))
    return dp[m][n]


def _detect_scam_phrases(text: str) -> list[str]:
    """Returns scam phrases found via fuzzy match (Levenshtein < 3 edits)."""
    text_upper = text.upper()
    detected = []
    for phrase in SCAM_PHRASES:
        # Check substring first (exact), then fuzzy on 20-char windows
        if phrase.upper() in text_upper:
            detected.append(phrase)
            continue
        for i in range(0, max(1, len(text_upper) - len(phrase) + 1)):
            window = text_upper[i: i + len(phrase)]
            if _levenshtein(window, phrase.upper()) < 3:
                detected.append(phrase)
                break
    return list(set(detected))


@router.post("/ocr", response_model=OCRResponse, summary="OCR screen analysis")
async def analyze_screenshot(req: OCRRequest) -> OCRResponse:
    """
    Decodes screenshot, runs OCR (pytesseract fallback), fuzzy-matches scam phrases.
    Phase 7.2: Google ML Kit Vision replaces pytesseract in production.
    """
    try:
        import pytesseract
        from PIL import Image
        import io

        img_bytes = base64.b64decode(req.screenshot_base64)
        img = Image.open(io.BytesIO(img_bytes))
        ocr_text = pytesseract.image_to_string(img)
    except ImportError:
        logger.warning("pytesseract not installed — returning placeholder OCR text")
        ocr_text = "[OCR Placeholder — install pytesseract or use Google ML Kit]"
    except Exception as e:
        logger.error(f"OCR failed: {e}")
        ocr_text = ""

    detected = _detect_scam_phrases(ocr_text)
    ocr_factor = 1.0 if detected else 0.0

    logger.info(f"OCR txn={req.transaction_id} detected={detected} factor={ocr_factor}")

    return OCRResponse(
        transaction_id=req.transaction_id,
        ocr_text=ocr_text[:500],  # truncate for response size
        scam_phrases_detected=detected,
        ocr_factor=ocr_factor,
    )
