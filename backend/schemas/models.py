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


class PaymentState(str, Enum):
    """
    States of the payment authorization gate (spec §17, §37, §53).

    CREATED → EVALUATING → RISK_DECISION →
        (ALLOWED | WARNING | HELD | INTERCEPTED) →
        (AUTHORIZED → COMPLETED) | CANCELLED | FROZEN | RELEASED

    The transition table lives in backend/services/payment_session.py and is the
    security boundary: INTERCEPTED and FROZEN can never reach AUTHORIZED/COMPLETED.
    """
    CREATED = "CREATED"
    EVALUATING = "EVALUATING"
    RISK_DECISION = "RISK_DECISION"
    ALLOWED = "ALLOWED"
    WARNING = "WARNING"
    HELD = "HELD"
    INTERCEPTED = "INTERCEPTED"
    RELEASED = "RELEASED"
    AUTHORIZED = "AUTHORIZED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    FROZEN = "FROZEN"


class FactorSeverity(str, Enum):
    """Severity band shown next to each contributing factor (spec §36)."""
    NORMAL = "normal"
    UNUSUAL = "unusual"
    SUSPICIOUS = "suspicious"
    CRITICAL = "critical"


class RiskDecision(str, Enum):
    """What the gate decided to do with this payment."""
    ALLOW = "ALLOW"
    WARN = "WARN"
    HOLD = "HOLD"
    BLOCK = "BLOCK"


class RequiredAction(str, Enum):
    """What the user must do next before the PIN pad can be reached."""
    NONE = "NONE"
    VERIFY_CODE = "VERIFY_CODE"
    TRUSTED_CONTACT_VERIFICATION = "TRUSTED_CONTACT_VERIFICATION"
    BLOCKED = "BLOCKED"


class DemoScenario(str, Enum):
    """Deterministic demo vectors — only reachable when GUARDPAY_DEMO_MODE=true."""
    SAFE = "SAFE"
    MEDIUM = "MEDIUM"
    HIGH_RISK = "HIGH_RISK"
    CRITICAL = "CRITICAL"


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
    # Confusion matrix the precision/recall above are actually derived from.
    # "flagged" = the engine scored the transaction at or above the WARNING
    # threshold; feedback whose original score is unknown is counted in
    # `unscored` and excluded from precision/recall rather than assumed correct.
    true_positives: int = 0
    false_negatives: int = 0
    true_negatives: int = 0
    unscored: int = 0


# ─────────────────────────────────────────────────────────────────────────────
# PAYMENT AUTHORIZATION GATE — requests
# ─────────────────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    """POST /api/v1/payment/session"""
    receiver_upi_id: str = Field(..., examples=["merchant@paytm"])
    amount: float = Field(..., gt=0, examples=[15000.0])
    note: Optional[str] = Field(None, max_length=200)
    sender_upi_id: Optional[str] = Field(None, examples=["user@ybl"])


class EvaluateSessionRequest(BaseModel):
    """
    POST /api/v1/payment/session/{sid}/evaluate

    Enrichment signals are optional; whatever the mobile SDK captured is handed
    straight to the existing multi-modal evaluator (POST /api/v1/risk-score's
    internal logic) — the session layer never scores anything itself.
    """
    audio_base64: Optional[str] = None
    ocr_screenshot_base64: Optional[str] = None
    ocr_text: Optional[str] = None
    transcript: Optional[str] = None
    is_screen_sharing: bool = False
    device_behaviour: Optional[DeviceBehaviour] = None
    trusted_contact_number: Optional[str] = None
    # Demo-only — rejected with HTTP 400 unless GUARDPAY_DEMO_MODE=true.
    demo_scenario: Optional[DemoScenario] = None


class VerifyCodeRequest(BaseModel):
    """POST /api/v1/payment/session/{sid}/verify-code"""
    code: str = Field(..., min_length=1, max_length=12)


class RequestVerificationRequest(BaseModel):
    """POST /api/v1/payment/session/{sid}/request-verification"""
    trusted_contact_number: Optional[str] = Field(
        None, description="E.164; falls back to the stored primary trusted contact."
    )


class AuthorizePinRequest(BaseModel):
    """
    POST /api/v1/payment/session/{sid}/authorize — the SIMULATED PIN step.

    SECURITY: this endpoint never accepts, logs, or stores an actual UPI PIN.
    The mobile app collects the PIN inside the NPCI-certified PIN pad and sends
    only `pin_entered` (a boolean the client sets once the pad reports success)
    and `pin_length` (4 or 6) so the backend can sanity-check the shape of the
    entry. Any field resembling a PIN value is deliberately absent from this
    model, and pydantic ignores unknown keys, so a client cannot smuggle one in.
    """
    pin_entered: bool = Field(True, description="Client-side PIN pad reported a complete entry")
    pin_length: int = Field(4, ge=4, le=6, description="Digit COUNT only — never the digits")


class TrustedContactRequest(BaseModel):
    """POST /api/v1/trusted-contacts"""
    name: str = Field(..., min_length=1, max_length=80)
    phone_number: str = Field(..., min_length=6, max_length=20, examples=["+919876543210"])
    relationship: Optional[str] = Field(None, max_length=40)
    is_primary: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# PAYMENT AUTHORIZATION GATE — responses
# ─────────────────────────────────────────────────────────────────────────────

class NormalizedRiskFactor(BaseModel):
    """
    One contributing factor, phrased for an end user (spec §18, §35).

    `explanation` is plain language — "New beneficiary", "Urgent language
    detected" — never model jargon such as "Isolation Forest anomaly = 0.91"
    or a raw SHAP value. The engineering view stays on RiskFactor.description.
    """
    name: str
    score: float                    # points this factor added to the 0–100 risk score
    severity: FactorSeverity
    explanation: str


class NormalizedRiskResponse(BaseModel):
    """
    Normalized risk shape (spec §36) returned by the session endpoints.

    ADDITIVE: POST /api/v1/risk-score keeps returning RiskScoreResponse
    unchanged — this is a second, UI-facing projection of the same evaluation.
    """
    riskScore: float = Field(..., ge=0, le=100)
    riskTier: RiskTier
    decision: RiskDecision
    requiredAction: RequiredAction
    factors: List[NormalizedRiskFactor] = []
    transactionId: str
    timestamp: str
    # Session context (extra, not part of the §36 core shape)
    sessionId: Optional[str] = None
    state: Optional[PaymentState] = None
    pinAllowed: bool = False
    mode: str = "model"                       # "model" | "demo"
    evidenceBundleId: Optional[str] = None
    ivrCallInitiated: bool = False


class PaymentSessionResponse(BaseModel):
    """GET /api/v1/payment/session/{sid} — the full session record."""
    session_id: str
    transaction_id: str
    state: PaymentState
    created_at: str
    updated_at: str
    sender_upi_id: Optional[str] = None
    receiver_upi_id: str
    amount: float
    note: Optional[str] = None
    risk: Optional[NormalizedRiskResponse] = None
    pin_allowed: bool = False
    pin_block_reason: Optional[str] = None
    verification: Dict[str, Any] = {}
    evidence_bundle_id: Optional[str] = None
    ivr_call_initiated: bool = False
    history: List[Dict[str, Any]] = []


class CreateSessionResponse(BaseModel):
    session_id: str
    state: PaymentState
    created_at: str
    transaction_id: str


class VerifyCodeResponse(BaseModel):
    verified: bool
    state: PaymentState
    attempts_remaining: int
    message: str = ""


class RequestVerificationResponse(BaseModel):
    session_id: str
    state: PaymentState
    channel: str                              # "in_app" | "trusted_contact_ivr"
    expires_at: str
    attempts_remaining: int
    ivr_call_initiated: bool = False
    ivr_status: Optional[str] = None
    # Populated ONLY when GUARDPAY_DEMO_MODE=true.
    demo_code: Optional[str] = None


class AuthorizeResponse(BaseModel):
    session_id: str
    transaction_id: str
    state: PaymentState
    authorized: bool
    completed_at: Optional[str] = None
    message: str = ""


class TransactionRecord(BaseModel):
    transaction_id: str
    session_id: str
    receiver_upi_id: str
    sender_upi_id: Optional[str] = None
    amount: float
    note: Optional[str] = None
    state: PaymentState
    outcome: str                              # COMPLETED | CANCELLED | BLOCKED | FROZEN
    category: str                             # safe | warning | held | blocked
    risk_score: Optional[float] = None
    risk_tier: Optional[RiskTier] = None
    created_at: str
    updated_at: str


class TransactionDetail(TransactionRecord):
    decision: Optional[RiskDecision] = None
    required_action: Optional[RequiredAction] = None
    factors: List[NormalizedRiskFactor] = []
    verification: Dict[str, Any] = {}
    evidence_bundle_id: Optional[str] = None
    evidence_reference: Optional[str] = None
    ivr_call_initiated: bool = False
    mode: str = "model"
    history: List[Dict[str, Any]] = []


class TrustedContact(BaseModel):
    contact_id: str
    name: str
    phone_number: str
    relationship: Optional[str] = None
    is_primary: bool = False
    created_at: str


# Forward reference update (DeviceBehaviour used inside RiskScoreRequest)
RiskScoreRequest.model_rebuild()
EvaluateSessionRequest.model_rebuild()
