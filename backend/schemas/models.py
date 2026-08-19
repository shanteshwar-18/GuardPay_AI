"""
GuardPay AI — Core Pydantic Schemas
PROMPT 2: Shared schemas that every router, service, and test imports.
These are the API contract — do NOT change field names without team sync.
"""

from __future__ import annotations
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import uuid


# ─────────────────────────────────────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────────────────────────────────────

class RiskTier(str, Enum):
    """Maps to the four GuardPay risk tiers defined in the Solution Document."""
    SAFE = "SAFE"                   # score < 40  → PIN pad, no friction
    WARNING = "WARNING"             # score 40-70 → explainable warning
    ELEVATED = "ELEVATED"           # score 70-90 → cooling timer + evidence
    HARD_INTERCEPT = "HARD_INTERCEPT"  # score > 90 → lock UI + Twilio + bank


class TransactionStatus(str, Enum):
    PENDING = "PENDING"
    RELEASED = "RELEASED"
    FROZEN = "FROZEN"
    BLOCKED = "BLOCKED"


class IVROutcome(str, Enum):
    AUTHORISED = "AUTHORISED"   # trusted contact pressed 1
    FROZEN = "FROZEN"           # trusted contact pressed 2
    NO_RESPONSE = "NO_RESPONSE" # call timed out


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class RiskScoreRequest(BaseModel):
    """
    Payload sent by the mobile app when a UPI payment is initiated.
    All fields are required; the backend will not assume defaults.
    """
    transaction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_upi_id: str = Field(..., example="user@ybl")
    receiver_upi_id: str = Field(..., example="merchant@paytm")
    amount: float = Field(..., gt=0, example=15000.0)
    # Optional enrichment fields (populated by mobile SDK)
    audio_base64: Optional[str] = Field(None, description="Base64-encoded 3-sec PCM chunk")
    ocr_screenshot_base64: Optional[str] = Field(None, description="Base64 screenshot for OCR")
    ocr_text: Optional[str] = Field(None, description="Extracted OCR text or scam notices")
    transcript: Optional[str] = Field(None, description="Live speech transcript")
    is_screen_sharing: bool = Field(False)
    session_id: Optional[str] = None
    device_behaviour: Optional[DeviceBehaviour] = None
    trusted_contact_number: Optional[str] = Field(None, description="E.164 format, e.g. +919876543210")


class DeviceBehaviour(BaseModel):
    """Device-level signals correlating with psychological duress."""
    screen_share_duration_seconds: int = 0
    app_switch_locked: bool = False          # user can't leave the UPI app
    unusual_typing_cadence: bool = False     # atypical tap rhythm detected
    time_since_last_app_open_seconds: int = 0


class FeedbackRequest(BaseModel):
    """User reports whether an intercepted transaction was actually a scam."""
    transaction_id: str
    was_scam: bool
    reported_by: Optional[str] = None        # user_id or anonymous


class OCRRequest(BaseModel):
    """Mobile sends a screenshot when screen-share is detected."""
    transaction_id: str
    screenshot_base64: str


class AudioChunk(BaseModel):
    """Single 3-second PCM audio chunk streamed over WebSocket."""
    session_id: str
    chunk_index: int
    pcm_base64: str                          # base64-encoded raw PCM bytes
    sample_rate: int = 16000


# ─────────────────────────────────────────────────────────────────────────────
# RESPONSE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class RiskFactor(BaseModel):
    """Single contributing factor in the risk explanation."""
    name: str                                # e.g. "Voice anomaly"
    contribution_points: float               # e.g. +25.0
    weight: float                            # e.g. 0.25
    raw_score: float                         # normalised 0–1
    description: str                         # human-readable explanation


class RiskScoreResponse(BaseModel):
    """
    Returned by POST /api/v1/risk-score.
    Frontend routes to the correct screen based on `tier`.
    """
    transaction_id: str
    risk_score: float = Field(..., ge=0, le=100)
    tier: RiskTier
    explanation: List[RiskFactor] = []      # top-3 SHAP factors
    recommended_action: str                 # human-readable action string
    evidence_bundle_id: Optional[str] = None  # set if risk > 70
    ivr_call_initiated: bool = False        # set if tier == HARD_INTERCEPT
    processing_time_ms: float = 0.0


class SessionStatusResponse(BaseModel):
    """Returned by GET /api/v1/session/{txn_id}/status."""
    transaction_id: str
    status: TransactionStatus
    ivr_outcome: Optional[IVROutcome] = None
    risk_score: Optional[float] = None
    updated_at: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    services: Dict[str, str] = {}


class FeedbackResponse(BaseModel):
    transaction_id: str
    recorded: bool
    message: str


class OCRResponse(BaseModel):
    transaction_id: str
    ocr_text: str
    scam_phrases_detected: List[str]
    ocr_factor: float = Field(..., ge=0, le=1)


class StatsResponse(BaseModel):
    total_feedback: int
    scam_reports: int
    false_positives: int
    false_positive_rate: float
    precision: float
    recall: float


# Forward reference update (DeviceBehaviour used inside RiskScoreRequest)
RiskScoreRequest.model_rebuild()
