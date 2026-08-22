"""
GuardPay AI — Payment Authorization Gate (state machine + persistence)

Spec references
---------------
§17 / §37 / §53  The PIN pad must NEVER be reachable once a payment has been
                 INTERCEPTED (or FROZEN). That rule is encoded in TRANSITIONS
                 below — INTERCEPTED and FROZEN simply have no edge, direct or
                 transitive, that reaches AUTHORIZED or COMPLETED. The invariant
                 is proven by a graph search at import time (see
                 `_assert_security_invariant`), so the guarantee cannot be
                 quietly broken by editing a route handler.
§36              Normalized risk projection ({riskScore, riskTier, decision,
                 requiredAction, factors[], transactionId, timestamp}).
§18 / §35        Factor explanations are plain end-user language. No SHAP
                 values, no model names, no "Isolation Forest anomaly = 0.91".

Per-tier policy — mirrors frontend/GuardPayUI/src/config/riskTiers.ts exactly:
    SAFE            → ALLOWED      → PIN now.
    WARNING         → WARNING      → PIN only after a verification code passes.
    ELEVATED        → HELD         → PIN only after trusted-contact verification
                                     (→ RELEASED). Failure/timeout → FROZEN.
    HARD_INTERCEPT  → INTERCEPTED  → PIN never.

The tier itself is NOT decided here. `backend/routers/risk_score.py` remains the
single evaluation engine (§42); this module only maps the tier it produced onto
a gate state and enforces what the user may do next.

Persistence: data/payment_sessions.json, written atomically (temp file in the
same directory + os.replace, which is atomic on both POSIX and Windows). The
in-memory dict is the hot cache; the file is the crash-durable copy.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
import tempfile
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.core.config import settings
from backend.schemas.models import (
    FactorSeverity,
    NormalizedRiskFactor,
    PaymentState,
    RequiredAction,
    RiskDecision,
    RiskTier,
)

logger = logging.getLogger(__name__)

S = PaymentState

# ─────────────────────────────────────────────────────────────────────────────
# THE TRANSITION TABLE — the security boundary
# ─────────────────────────────────────────────────────────────────────────────
#
#   CREATED ──► EVALUATING ──► RISK_DECISION ──┬─► ALLOWED ──────────┐
#                                              ├─► WARNING ──────────┤─► AUTHORIZED ─► COMPLETED
#                                              ├─► HELD ─► RELEASED ─┘
#                                              └─► INTERCEPTED ─► (FROZEN | CANCELLED)   ✗ dead end
#
# Every state may also fall to CANCELLED (user backs out). HELD may fall to
# FROZEN (trusted-contact refusal or hold timeout). INTERCEPTED and FROZEN have
# no path onward to AUTHORIZED/COMPLETED — that is the whole point.
#
TRANSITIONS: Dict[PaymentState, frozenset] = {
    S.CREATED:       frozenset({S.EVALUATING, S.CANCELLED}),
    S.EVALUATING:    frozenset({S.RISK_DECISION, S.CANCELLED, S.FROZEN}),
    S.RISK_DECISION: frozenset({S.ALLOWED, S.WARNING, S.HELD, S.INTERCEPTED, S.CANCELLED}),

    # SAFE tier — PIN pad immediately.
    S.ALLOWED:       frozenset({S.AUTHORIZED, S.CANCELLED}),

    # WARNING tier — PIN only once a verification code has passed. The table
    # permits the edge; `authorization_block_reason()` refuses it until the code
    # is actually verified. Three failed attempts → FROZEN.
    S.WARNING:       frozenset({S.AUTHORIZED, S.RELEASED, S.CANCELLED, S.FROZEN}),

    # ELEVATED tier — trusted-contact verification must RELEASE it first.
    S.HELD:          frozenset({S.RELEASED, S.FROZEN, S.CANCELLED}),
    S.RELEASED:      frozenset({S.AUTHORIZED, S.CANCELLED, S.FROZEN}),

    # HARD_INTERCEPT tier — dead end. No AUTHORIZED. No COMPLETED. Ever.
    S.INTERCEPTED:   frozenset({S.FROZEN, S.CANCELLED}),

    S.AUTHORIZED:    frozenset({S.COMPLETED}),

    # Terminal.
    S.COMPLETED:     frozenset(),
    S.CANCELLED:     frozenset(),
    S.FROZEN:        frozenset(),
}

TERMINAL_STATES = frozenset({S.COMPLETED, S.CANCELLED, S.FROZEN})

#: States from which money must never be able to move, transitively.
QUARANTINED_STATES = frozenset({S.INTERCEPTED, S.FROZEN})
#: The states that represent "the payment went through".
MONEY_MOVING_STATES = frozenset({S.AUTHORIZED, S.COMPLETED})


class IllegalTransitionError(Exception):
    """Raised when a caller attempts a move the transition table forbids."""

    def __init__(self, session_id: str, current: PaymentState, requested: PaymentState):
        self.session_id = session_id
        self.current = current
        self.requested = requested
        allowed = sorted(s.value for s in TRANSITIONS.get(current, frozenset()))
        super().__init__(
            f"Illegal payment state transition for session {session_id}: "
            f"{current.value} -> {requested.value}. "
            f"Allowed from {current.value}: {allowed or ['<terminal>']}"
        )


class SessionNotFoundError(KeyError):
    """Unknown session id."""


def _reachable_from(start: PaymentState) -> set:
    """All states reachable from `start` by any number of legal transitions."""
    seen: set = set()
    stack = [start]
    while stack:
        cur = stack.pop()
        for nxt in TRANSITIONS.get(cur, frozenset()):
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    return seen


def _assert_security_invariant() -> None:
    """
    §17/§37/§53 proven structurally, at import time.

    Not "the handler checks it" — the graph itself has no path from INTERCEPTED
    or FROZEN to AUTHORIZED/COMPLETED. If someone later adds such an edge the
    process refuses to start.
    """
    for quarantined in QUARANTINED_STATES:
        leaks = _reachable_from(quarantined) & MONEY_MOVING_STATES
        if leaks:
            raise RuntimeError(
                f"SECURITY INVARIANT VIOLATED: {quarantined.value} can reach "
                f"{sorted(s.value for s in leaks)}. An intercepted or frozen payment "
                f"must never be authorizable (spec §17/§37/§53)."
            )
    missing = set(PaymentState) - set(TRANSITIONS)
    if missing:
        raise RuntimeError(
            f"Transition table is incomplete: {sorted(s.value for s in missing)}"
        )


_assert_security_invariant()


def can_transition(current: PaymentState, new_state: PaymentState) -> bool:
    return new_state in TRANSITIONS.get(current, frozenset())


# ─────────────────────────────────────────────────────────────────────────────
# Tier → gate policy (mirrors riskTiers.ts)
# ─────────────────────────────────────────────────────────────────────────────

class TierPolicy:
    __slots__ = ("state", "decision", "required_action", "pin_allowed",
                 "requires_verification", "requires_trusted_contact", "preserves_evidence")

    def __init__(self, state, decision, required_action, pin_allowed,
                 requires_verification, requires_trusted_contact, preserves_evidence):
        self.state = state
        self.decision = decision
        self.required_action = required_action
        self.pin_allowed = pin_allowed
        self.requires_verification = requires_verification
        self.requires_trusted_contact = requires_trusted_contact
        self.preserves_evidence = preserves_evidence


TIER_POLICY: Dict[RiskTier, TierPolicy] = {
    RiskTier.SAFE: TierPolicy(
        S.ALLOWED, RiskDecision.ALLOW, RequiredAction.NONE,
        pin_allowed=True, requires_verification=False,
        requires_trusted_contact=False, preserves_evidence=False,
    ),
    RiskTier.WARNING: TierPolicy(
        S.WARNING, RiskDecision.WARN, RequiredAction.VERIFY_CODE,
        pin_allowed=False, requires_verification=True,
        requires_trusted_contact=False, preserves_evidence=True,
    ),
    RiskTier.ELEVATED: TierPolicy(
        S.HELD, RiskDecision.HOLD, RequiredAction.TRUSTED_CONTACT_VERIFICATION,
        pin_allowed=False, requires_verification=True,
        requires_trusted_contact=True, preserves_evidence=True,
    ),
    RiskTier.HARD_INTERCEPT: TierPolicy(
        S.INTERCEPTED, RiskDecision.BLOCK, RequiredAction.BLOCKED,
        pin_allowed=False, requires_verification=True,
        requires_trusted_contact=True, preserves_evidence=True,
    ),
}


# ─────────────────────────────────────────────────────────────────────────────
# Plain-language factor explanations (§18, §35)
# ─────────────────────────────────────────────────────────────────────────────
#
# Keys are the six factor keys produced by the existing evaluator
# (backend/services/risk_fusion.WEIGHTS). Copy is deliberately free of model
# jargon: an end user reads "Urgent language detected", never a SHAP value.
#
_FACTOR_COPY: Dict[str, Dict[str, str]] = {
    "audio": {
        "name": "Voice check",
        "high": "Suspicious voice characteristics",
        "mid": "The voice on this call sounds slightly unusual",
        "low": "The voice on this call sounds normal",
    },
    "text": {
        "name": "What was said",
        "high": "Urgent language detected",
        "mid": "Some pressuring language was used",
        "low": "Nothing pressuring was said",
    },
    "ocr": {
        "name": "What is on your screen",
        "high": "Scam-style message on your screen",
        "mid": "Something on your screen looks unusual",
        "low": "Nothing suspicious on your screen",
    },
    "reputation": {
        "name": "Who you are paying",
        "high": "This account has been reported by other people",
        "mid": "This account has a few complaints against it",
        "low": "No complaints against this account",
    },
    "new_beneficiary": {
        "name": "Payment history",
        "high": "New beneficiary",
        "mid": "You have paid this person only once or twice",
        "low": "You have paid this person before",
    },
    "device_behaviour": {
        "name": "How your phone is being used",
        "high": "Unusual phone activity during this payment",
        "mid": "Slightly unusual phone activity",
        "low": "Normal phone activity",
    },
}

# The weights are owned by risk_fusion; imported lazily so this module has no
# hard dependency on numpy/sklearn at import time.
def _factor_weights() -> Dict[str, float]:
    try:
        from backend.services.risk_fusion import WEIGHTS
        return dict(WEIGHTS)
    except Exception:  # pragma: no cover — numpy missing
        return {"audio": 0.25, "text": 0.20, "ocr": 0.15,
                "reputation": 0.20, "new_beneficiary": 0.10, "device_behaviour": 0.10}


def _severity(raw: float) -> FactorSeverity:
    if raw >= 0.75:
        return FactorSeverity.CRITICAL
    if raw >= 0.50:
        return FactorSeverity.SUSPICIOUS
    if raw >= 0.25:
        return FactorSeverity.UNUSUAL
    return FactorSeverity.NORMAL


def normalize_factors(factor_scores: Dict[str, float]) -> List[NormalizedRiskFactor]:
    """
    Project the evaluator's raw 0-1 factor vector into the §36 factor shape.

    `score` is the number of points the factor contributed to the 0-100 risk
    score (weight x raw x 100) — the same arithmetic the engine used, so the
    breakdown the user sees adds up. `explanation` is end-user language only.
    """
    weights = _factor_weights()
    out: List[NormalizedRiskFactor] = []
    for key, copy in _FACTOR_COPY.items():
        raw = float(factor_scores.get(key, 0.0) or 0.0)
        raw = min(1.0, max(0.0, raw))
        sev = _severity(raw)
        if sev in (FactorSeverity.CRITICAL, FactorSeverity.SUSPICIOUS):
            text = copy["high"]
        elif sev is FactorSeverity.UNUSUAL:
            text = copy["mid"]
        else:
            text = copy["low"]
        out.append(NormalizedRiskFactor(
            name=copy["name"],
            score=round(weights.get(key, 0.0) * raw * 100.0, 2),
            severity=sev,
            explanation=text,
        ))
    out.sort(key=lambda f: f.score, reverse=True)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic demo vectors (§29, §50) — reachable ONLY via the demo branch
# ─────────────────────────────────────────────────────────────────────────────
#
# These never touch the real scorer's inputs: the payment router passes them to
# the evaluator's explicit `forced_factors` parameter, which is None on every
# non-demo path, and only after settings.GUARDPAY_DEMO_MODE has been checked.
#
DEMO_FACTOR_VECTORS: Dict[str, Dict[str, float]] = {
    "SAFE": {  # -> 4.25  (SAFE, < 40)
        "audio": 0.05, "text": 0.05, "ocr": 0.00,
        "reputation": 0.05, "new_beneficiary": 0.10, "device_behaviour": 0.00,
    },
    "MEDIUM": {  # -> 49.75 (WARNING, 40-70)
        "audio": 0.55, "text": 0.60, "ocr": 0.20,
        "reputation": 0.50, "new_beneficiary": 0.80, "device_behaviour": 0.30,
    },
    "HIGH_RISK": {  # -> 78.75 (ELEVATED, 70-90)
        "audio": 0.85, "text": 0.80, "ocr": 0.70,
        "reputation": 0.75, "new_beneficiary": 0.90, "device_behaviour": 0.70,
    },
    "CRITICAL": {  # -> 95.55 (HARD_INTERCEPT, >= 90)
        "audio": 0.98, "text": 0.97, "ocr": 0.95,
        "reputation": 0.92, "new_beneficiary": 1.00, "device_behaviour": 0.90,
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Store — in-memory hot cache + atomic JSON persistence
# ─────────────────────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SESSIONS_PATH = DATA_DIR / "payment_sessions.json"
CONTACTS_PATH = DATA_DIR / "trusted_contacts.json"

_lock = threading.RLock()
_sessions: Dict[str, Dict[str, Any]] = {}
_contacts: Dict[str, Dict[str, Any]] = {}
_loaded = False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write_json(path: Path, payload: Any) -> None:
    """
    Write JSON durably: serialise to a temp file in the SAME directory, flush +
    fsync, then os.replace() over the target. os.replace is atomic on POSIX and
    on Windows (MoveFileEx w/ REPLACE_EXISTING), so a crash mid-write can never
    leave a truncated session store behind.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2, default=str)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _load() -> None:
    global _loaded
    if _loaded:
        return
    with _lock:
        if _loaded:
            return
        for path, target in ((SESSIONS_PATH, _sessions), (CONTACTS_PATH, _contacts)):
            try:
                if path.exists():
                    data = json.loads(path.read_text(encoding="utf-8") or "{}")
                    if isinstance(data, dict):
                        target.update(data)
            except Exception as exc:
                logger.error("[payment_session] could not load %s: %s — starting empty", path, exc)
        _loaded = True
        logger.info("[payment_session] loaded %d session(s), %d contact(s)",
                    len(_sessions), len(_contacts))


def _persist_sessions() -> None:
    try:
        _atomic_write_json(SESSIONS_PATH, _sessions)
    except Exception as exc:
        logger.error("[payment_session] persist failed (in-memory state kept): %s", exc)


def _persist_contacts() -> None:
    try:
        _atomic_write_json(CONTACTS_PATH, _contacts)
    except Exception as exc:
        logger.error("[payment_session] contact persist failed: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Session lifecycle
# ─────────────────────────────────────────────────────────────────────────────

def create_session(
    receiver_upi_id: str,
    amount: float,
    note: Optional[str] = None,
    sender_upi_id: Optional[str] = None,
) -> Dict[str, Any]:
    _load()
    now = _now()
    sid = f"PS-{uuid.uuid4().hex[:16]}"
    txn_id = str(uuid.uuid4())
    session: Dict[str, Any] = {
        "session_id": sid,
        "transaction_id": txn_id,
        "state": S.CREATED.value,
        "created_at": now,
        "updated_at": now,
        "sender_upi_id": sender_upi_id,
        "receiver_upi_id": receiver_upi_id,
        "amount": float(amount),
        "note": note,
        "risk": None,
        "mode": "model",
        "pin_allowed": False,
        "pin_block_reason": "Payment has not been evaluated yet.",
        "verification": {
            "required": False,
            "channel": None,
            "requested": False,
            "verified": False,
            "attempts_used": 0,
            "attempts_remaining": settings.VERIFICATION_MAX_ATTEMPTS,
            "expires_at": None,
            "code_hash": None,
        },
        "evidence_bundle_id": None,
        "ivr_call_initiated": False,
        "ivr_status": None,
        "hold_expires_at": None,
        "completed_at": None,
        "history": [{"at": now, "from": None, "to": S.CREATED.value, "reason": "session created"}],
    }
    with _lock:
        _sessions[sid] = session
        _persist_sessions()
    logger.info("[payment_session] created %s txn=%s amount=%s -> %s",
                sid, txn_id, amount, receiver_upi_id)
    return session


def get_session(sid: str, *, apply_timeouts: bool = True) -> Dict[str, Any]:
    """Fetch a session. Raises SessionNotFoundError. Applies the HELD timeout."""
    _load()
    with _lock:
        session = _sessions.get(sid)
        if session is None:
            raise SessionNotFoundError(sid)
        if apply_timeouts:
            _apply_hold_timeout(session)
        return session


def try_get_session(sid: str) -> Optional[Dict[str, Any]]:
    try:
        return get_session(sid)
    except SessionNotFoundError:
        return None


def list_sessions() -> List[Dict[str, Any]]:
    _load()
    with _lock:
        sessions = list(_sessions.values())
    for s in sessions:
        _apply_hold_timeout(s)
    sessions.sort(key=lambda s: s.get("created_at") or "", reverse=True)
    return sessions


def state_of(session: Dict[str, Any]) -> PaymentState:
    return PaymentState(session["state"])


def _apply_hold_timeout(session: Dict[str, Any]) -> None:
    """
    HELD → FROZEN once the cooling-off / trusted-contact window elapses.

    Evaluated lazily on read so no background task is needed and a restart can
    never lose a pending expiry: the deadline lives in the persisted record.
    """
    if session.get("state") != S.HELD.value:
        return
    deadline = session.get("hold_expires_at")
    if not deadline:
        return
    try:
        if datetime.now(timezone.utc) < datetime.fromisoformat(deadline):
            return
    except ValueError:
        return
    _transition_unlocked(
        session, S.FROZEN,
        reason="Trusted-contact verification timed out — payment frozen for safety.",
    )
    session["pin_allowed"] = False
    session["pin_block_reason"] = (
        "This payment was frozen because the hold expired before your trusted "
        "contact approved it."
    )
    _persist_sessions()


def _transition_unlocked(session: Dict[str, Any], new_state: PaymentState, reason: str = "") -> None:
    current = PaymentState(session["state"])
    if not can_transition(current, new_state):
        raise IllegalTransitionError(session["session_id"], current, new_state)
    now = _now()
    session["state"] = new_state.value
    session["updated_at"] = now
    session.setdefault("history", []).append(
        {"at": now, "from": current.value, "to": new_state.value, "reason": reason}
    )
    logger.info("[payment_session] %s %s -> %s (%s)",
                session["session_id"], current.value, new_state.value, reason or "-")


def transition(sid: str, new_state: PaymentState, reason: str = "", **updates: Any) -> Dict[str, Any]:
    """
    Move session `sid` to `new_state`.

    RAISES IllegalTransitionError if the transition table forbids the move —
    including every attempt to authorize or complete an INTERCEPTED or FROZEN
    payment, which is unreachable by construction (§17/§37/§53).
    """
    _load()
    with _lock:
        session = _sessions.get(sid)
        if session is None:
            raise SessionNotFoundError(sid)
        _transition_unlocked(session, new_state, reason)
        if updates:
            session.update(updates)
        _persist_sessions()
        return session


def update_session_fields(sid: str, **updates: Any) -> Dict[str, Any]:
    """Mutate non-state fields (risk payload, evidence id, verification block…)."""
    _load()
    with _lock:
        session = _sessions.get(sid)
        if session is None:
            raise SessionNotFoundError(sid)
        session.update(updates)
        session["updated_at"] = _now()
        _persist_sessions()
        return session


# ─────────────────────────────────────────────────────────────────────────────
# Gate policy application
# ─────────────────────────────────────────────────────────────────────────────

def apply_tier(session: Dict[str, Any], tier: RiskTier) -> TierPolicy:
    """
    RISK_DECISION → the tier's gate state, plus the verification requirements
    that tier implies. Mirrors riskTiers.ts.
    """
    policy = TIER_POLICY[tier]
    with _lock:
        _transition_unlocked(session, policy.state, reason=f"risk tier {tier.value}")
        verification = session.setdefault("verification", {})
        verification.update({
            "required": policy.requires_verification,
            "channel": (
                "trusted_contact_ivr" if policy.requires_trusted_contact
                else ("in_app" if policy.requires_verification else None)
            ),
            "requested": False,
            "verified": False,
            "attempts_used": 0,
            "attempts_remaining": settings.VERIFICATION_MAX_ATTEMPTS,
            "expires_at": None,
            "code_hash": None,
        })
        if policy.state is S.HELD:
            session["hold_expires_at"] = (
                datetime.now(timezone.utc) + timedelta(seconds=settings.HOLD_TIMEOUT_SECONDS)
            ).isoformat()
        else:
            session["hold_expires_at"] = None
        session["pin_allowed"] = policy.pin_allowed
        session["pin_block_reason"] = None if policy.pin_allowed else _block_reason_for(policy.state)
        _persist_sessions()
    return policy


def _block_reason_for(state: PaymentState) -> str:
    return {
        S.WARNING: "Enter the 4-digit verification code we sent you before the PIN step.",
        S.HELD: "Your trusted contact must approve this payment before the PIN step.",
        S.INTERCEPTED: (
            "This payment was blocked as fraud. The PIN step is permanently "
            "unavailable for it."
        ),
        S.FROZEN: "This payment is frozen. The PIN step is unavailable.",
    }.get(state, "The PIN step is not available for this payment.")


def required_action_for(session: Dict[str, Any]) -> RequiredAction:
    """What the user must do next, given the live verification state."""
    state = state_of(session)
    if state is S.INTERCEPTED or state is S.FROZEN:
        return RequiredAction.BLOCKED
    verification = session.get("verification") or {}
    if state is S.WARNING:
        return RequiredAction.NONE if verification.get("verified") else RequiredAction.VERIFY_CODE
    if state is S.HELD:
        return RequiredAction.TRUSTED_CONTACT_VERIFICATION
    return RequiredAction.NONE


def authorization_block_reason(session: Dict[str, Any]) -> Optional[str]:
    """
    None  → the PIN step may be reached.
    str   → HTTP 403 with this reason.

    Second line of defence. The transition table already makes AUTHORIZED
    unreachable from INTERCEPTED/FROZEN; this produces the human-readable
    refusal instead of a 500 from IllegalTransitionError.
    """
    state = state_of(session)
    verification = session.get("verification") or {}

    if state is S.INTERCEPTED:
        return ("This payment was intercepted as fraud (spec §17/§53). The PIN step is "
                "permanently blocked for it and cannot be unlocked by any verification.")
    if state is S.FROZEN:
        return ("This payment is frozen. Frozen payments can never be authorized. "
                "Start a new payment if this was a mistake.")
    if state is S.CANCELLED:
        return "This payment was cancelled."
    if state is S.COMPLETED:
        return "This payment has already been completed."
    if state is S.AUTHORIZED:
        return "This payment has already been authorized."
    if state in (S.CREATED, S.EVALUATING, S.RISK_DECISION):
        return "This payment has not finished its risk evaluation yet."
    if state is S.ALLOWED:
        return None
    if state is S.WARNING:
        if not verification.get("verified"):
            return ("A verification code is required before the PIN step for a "
                    "WARNING-tier payment. Request a code, then verify it.")
        return None
    if state is S.HELD:
        return ("Your trusted contact must approve this payment before the PIN step. "
                "The payment is on hold.")
    if state is S.RELEASED:
        return None
    return f"The PIN step is not available from state {state.value}."


# ─────────────────────────────────────────────────────────────────────────────
# Verification codes
# ─────────────────────────────────────────────────────────────────────────────

_CODE_PEPPER = secrets.token_bytes(16)


def _hash_code(code: str) -> str:
    """Codes are stored hashed — the plaintext only ever exists in the response."""
    return hashlib.sha256(_CODE_PEPPER + code.encode("utf-8")).hexdigest()


def issue_verification_code(session: Dict[str, Any]) -> Tuple[str, str]:
    """Generate a fresh 4-digit code. Returns (code, expires_at_iso)."""
    code = f"{secrets.randbelow(10_000):04d}"
    expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=settings.VERIFICATION_CODE_TTL_SECONDS)
    ).isoformat()
    with _lock:
        verification = session.setdefault("verification", {})
        verification.update({
            "requested": True,
            "verified": False,
            "code_hash": _hash_code(code),
            "expires_at": expires_at,
            "attempts_used": 0,
            "attempts_remaining": settings.VERIFICATION_MAX_ATTEMPTS,
        })
        session["updated_at"] = _now()
        _persist_sessions()
    return code, expires_at


def check_verification_code(session: Dict[str, Any], code: str) -> Tuple[bool, str, int]:
    """
    Validate a submitted code.

    Returns (verified, message, attempts_remaining). On the 3rd failure the
    session is transitioned to FROZEN — which the transition table then makes
    permanently unauthorizable.
    """
    with _lock:
        verification = session.setdefault("verification", {})
        stored = verification.get("code_hash")
        if not stored:
            return False, "No verification code has been requested for this payment.", \
                int(verification.get("attempts_remaining", settings.VERIFICATION_MAX_ATTEMPTS))

        expires_at = verification.get("expires_at")
        if expires_at:
            try:
                if datetime.now(timezone.utc) > datetime.fromisoformat(expires_at):
                    verification["code_hash"] = None
                    _persist_sessions()
                    return False, "That code has expired. Request a new one.", \
                        int(verification.get("attempts_remaining", 0))
            except ValueError:
                pass

        if secrets.compare_digest(_hash_code(code.strip()), stored):
            verification["verified"] = True
            verification["code_hash"] = None
            verification["verified_at"] = _now()
            state = state_of(session)
            if state is S.HELD:
                _transition_unlocked(
                    session, S.RELEASED,
                    reason="trusted contact verified the payment",
                )
                session["hold_expires_at"] = None
            session["pin_allowed"] = authorization_block_reason(session) is None
            session["pin_block_reason"] = authorization_block_reason(session)
            _persist_sessions()
            return True, "Verified. You can now enter your UPI PIN.", \
                int(verification.get("attempts_remaining", 0))

        used = int(verification.get("attempts_used", 0)) + 1
        remaining = max(0, settings.VERIFICATION_MAX_ATTEMPTS - used)
        verification["attempts_used"] = used
        verification["attempts_remaining"] = remaining
        if remaining == 0:
            verification["code_hash"] = None
            _transition_unlocked(
                session, S.FROZEN,
                reason=f"{settings.VERIFICATION_MAX_ATTEMPTS} failed verification attempts",
            )
            session["pin_allowed"] = False
            session["pin_block_reason"] = (
                "Too many incorrect verification attempts. This payment is frozen."
            )
            _persist_sessions()
            return False, ("Too many incorrect attempts. This payment has been frozen "
                           "for your safety."), 0
        _persist_sessions()
        return False, f"Incorrect code. {remaining} attempt(s) remaining.", remaining


# ─────────────────────────────────────────────────────────────────────────────
# Transaction-history projection
# ─────────────────────────────────────────────────────────────────────────────

_CATEGORY_BY_TIER = {
    RiskTier.SAFE: "safe",
    RiskTier.WARNING: "warning",
    RiskTier.ELEVATED: "held",
    RiskTier.HARD_INTERCEPT: "blocked",
}


def category_of(session: Dict[str, Any]) -> str:
    """safe | warning | held | blocked — the /api/v1/transactions filter buckets."""
    state = state_of(session)
    if state in (S.INTERCEPTED, S.FROZEN):
        return "blocked"
    risk = session.get("risk") or {}
    tier = risk.get("riskTier")
    if tier:
        try:
            return _CATEGORY_BY_TIER[RiskTier(tier)]
        except (ValueError, KeyError):
            pass
    if state in (S.HELD, S.RELEASED):
        return "held"
    if state is S.WARNING:
        return "warning"
    return "safe"


def outcome_of(session: Dict[str, Any]) -> str:
    state = state_of(session)
    return {
        S.COMPLETED: "COMPLETED",
        S.AUTHORIZED: "AUTHORIZED",
        S.CANCELLED: "CANCELLED",
        S.FROZEN: "FROZEN",
        S.INTERCEPTED: "BLOCKED",
    }.get(state, "PENDING")


def history_sessions(category: str = "all") -> List[Dict[str, Any]]:
    """Evaluated sessions, newest first, optionally filtered by category."""
    wanted = (category or "all").strip().lower()
    rows = [
        s for s in list_sessions()
        if s.get("state") not in (S.CREATED.value, S.EVALUATING.value)
    ]
    if wanted != "all":
        rows = [s for s in rows if category_of(s) == wanted]
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Trusted contacts
# ─────────────────────────────────────────────────────────────────────────────

def list_contacts() -> List[Dict[str, Any]]:
    _load()
    with _lock:
        rows = list(_contacts.values())
    rows.sort(key=lambda c: (not c.get("is_primary", False), c.get("created_at") or ""))
    return rows


def add_contact(name: str, phone_number: str, relationship: Optional[str],
                is_primary: bool) -> Dict[str, Any]:
    _load()
    contact = {
        "contact_id": f"TC-{uuid.uuid4().hex[:12]}",
        "name": name,
        "phone_number": phone_number,
        "relationship": relationship,
        "is_primary": bool(is_primary),
        "created_at": _now(),
    }
    with _lock:
        if contact["is_primary"]:
            for other in _contacts.values():
                other["is_primary"] = False
        elif not _contacts:
            contact["is_primary"] = True     # first contact is primary by default
        _contacts[contact["contact_id"]] = contact
        _persist_contacts()
    return contact


def delete_contact(contact_id: str) -> bool:
    _load()
    with _lock:
        removed = _contacts.pop(contact_id, None)
        if removed is None:
            return False
        if removed.get("is_primary") and _contacts:
            next(iter(_contacts.values()))["is_primary"] = True
        _persist_contacts()
    return True


def primary_contact_number() -> Optional[str]:
    for contact in list_contacts():
        if contact.get("is_primary"):
            return contact.get("phone_number")
    rows = list_contacts()
    return rows[0]["phone_number"] if rows else None


# ─────────────────────────────────────────────────────────────────────────────
# Test/demo helper
# ─────────────────────────────────────────────────────────────────────────────

def _reset_for_tests() -> None:
    """Clear the in-memory cache (does NOT delete the persisted file)."""
    global _loaded
    with _lock:
        _sessions.clear()
        _contacts.clear()
        _loaded = False
