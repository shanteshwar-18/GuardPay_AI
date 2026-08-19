"""
GuardPay AI — AES-256-GCM Evidence Bundle Builder
PROMPT 10: Encrypts evidence bundle when risk > 70

Bundle contents (per playbook):
  - OCR text
  - Transcript snippet (first 200 chars)
  - Audio fingerprint hash (SHA-256 of raw PCM)
  - SHAP breakdown (top-3 factors)
  - Timestamp, UPI ID, Amount

Encryption: AES-256-GCM
  key: secrets.token_bytes(32) — stored in-memory (production: OS keystore)
  nonce: 12 random bytes (GCM standard)
  Output: /evidence/{txn_id}.enc  (nonce + tag + ciphertext concatenated)

Author: Shanteshwar (Backend Lead)
"""

import json
import hashlib
import logging
import base64
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List

logger = logging.getLogger(__name__)

# Evidence directory — relative to repo root
EVIDENCE_DIR = Path("evidence")


def _derive_audio_fingerprint(audio_base64: Optional[str]) -> str:
    """SHA-256 of raw PCM bytes — identifies audio without storing raw audio."""
    if not audio_base64:
        return "no_audio"
    try:
        raw_bytes = base64.b64decode(audio_base64)
        return hashlib.sha256(raw_bytes).hexdigest()
    except Exception:
        return "invalid_audio"


def _encrypt_bundle(plaintext: bytes, key: bytes) -> bytes:
    """
    AES-256-GCM encryption.
    Output format: nonce (12 bytes) + tag (16 bytes) + ciphertext
    """
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import secrets

    nonce = secrets.token_bytes(12)          # 96-bit nonce (GCM standard)
    aesgcm = AESGCM(key)
    ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext, associated_data=None)
    # ciphertext_with_tag = ciphertext + 16-byte tag (appended by cryptography lib)
    return nonce + ciphertext_with_tag


# In-memory key store: txn_id → encryption key (bytes)
# Production: store in device Keychain / OS keystore
_key_store: dict[str, bytes] = {}


async def build_evidence_bundle(
    txn_id: str,
    upi_id: str,
    amount: float,
    ocr_text: str = "",
    transcript: str = "",
    audio_base64: Optional[str] = None,
    shap_breakdown: Optional[List] = None,
    risk_score: Optional[float] = None,
) -> str:
    """
    Assembles and encrypts an evidence bundle for a flagged transaction.
    Triggered whenever risk_score > 70 (ELEVATED or HARD_INTERCEPT tier).

    Returns:
        bundle_id (str): Reference ID for the evidence bundle (= txn_id[:12])
    """
    import secrets

    # ── Assemble bundle payload ───────────────────────────────────────────────
    bundle = {
        "schema_version": "1.0",
        "bundle_id": f"EVD-{txn_id[:12]}",
        "transaction_id": txn_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "beneficiary_upi_id": upi_id,
        "amount_inr": amount,
        "risk_score": risk_score,
        "ocr_text": ocr_text[:500] if ocr_text else "",
        "transcript_snippet": transcript[:200] if transcript else "",
        "audio_fingerprint_sha256": _derive_audio_fingerprint(audio_base64),
        "shap_breakdown": [
            {
                "name": f.name,
                "contribution_points": f.contribution_points,
                "weight": f.weight,
                "raw_score": f.raw_score,
                "description": f.description,
            }
            for f in (shap_breakdown or [])
        ],
    }

    plaintext = json.dumps(bundle, ensure_ascii=False, indent=2).encode("utf-8")

    # ── Generate encryption key ───────────────────────────────────────────────
    key = secrets.token_bytes(32)   # AES-256 key
    _key_store[txn_id] = key        # TODO production: write to OS keystore

    # ── Encrypt ───────────────────────────────────────────────────────────────
    try:
        encrypted = await asyncio.get_event_loop().run_in_executor(
            None, _encrypt_bundle, plaintext, key
        )
    except ImportError:
        logger.error("[Evidence] cryptography package not installed — bundle NOT encrypted")
        # Store plaintext as fallback (demo only)
        encrypted = plaintext

    # ── Write to disk ─────────────────────────────────────────────────────────
    EVIDENCE_DIR.mkdir(exist_ok=True)
    bundle_path = EVIDENCE_DIR / f"{txn_id}.enc"
    bundle_path.write_bytes(encrypted)

    bundle_id = f"EVD-{txn_id[:12]}"
    logger.info(
        f"[Evidence] Bundle written → {bundle_path} "
        f"| size={len(encrypted)} bytes "
        f"| id={bundle_id}"
    )

    return bundle_id


def decrypt_evidence_bundle(txn_id: str) -> Optional[dict]:
    """
    Decrypts and returns an evidence bundle for law enforcement / bank submission.
    Only possible if the key is still in _key_store (same process lifetime).
    """
    bundle_path = EVIDENCE_DIR / f"{txn_id}.enc"
    if not bundle_path.exists():
        logger.warning(f"[Evidence] No bundle found for txn={txn_id}")
        return None

    key = _key_store.get(txn_id)
    if not key:
        logger.error(f"[Evidence] Encryption key not found for txn={txn_id} — cannot decrypt")
        return None

    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        data = bundle_path.read_bytes()
        nonce = data[:12]
        ciphertext_with_tag = data[12:]
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext_with_tag, associated_data=None)
        return json.loads(plaintext.decode("utf-8"))
    except Exception as e:
        logger.error(f"[Evidence] Decryption failed for txn={txn_id}: {e}")
        return None
