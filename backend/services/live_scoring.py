"""
GuardPay AI — Live Audio Scoring Service (Playbook Phase 7, Step 7.1)

Closes the loop that was previously open at both ends:

    mobile mic --WS--> audio_ws._audio_queues[session]        (producer existed)
                              |
                              v
                  live_scoring worker  <-- THIS MODULE       (was missing)
                    CNN -> Whisper -> Coercion -> Risk Fusion
                              |
                              v
    session.score-stream <-- subscriber queues                (was a static placeholder)

Before this, the WebSocket pushed 3-second windows into a queue that nothing read,
`pipeline_orchestrator.run_pipeline` read a queue that nothing filled, and the SSE
endpoint looped ten times over an in-memory dict that never changed. The audio
signal — the product's core differentiator — never reached the risk score.

Concurrency model
-----------------
One worker task per session, started on WebSocket connect. The worker owns the
session's rolling factor state; SSE subscribers are fan-out queues, so a slow or
disconnected client can never block scoring (their queue is bounded and drops
oldest on overflow).

Whisper is far slower than real time on CPU relative to a 3-second cadence, so
transcription runs opportunistically: if a transcription is still in flight when the
next window arrives, that window is scored on the CNN alone and the previous
coercion score is carried forward. Blocking the loop would make the live score lag
further behind the call with every window.

Commit: feat(pipeline): wire live audio buffer -> CNN -> Whisper -> coercion -> SSE
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# How long a worker waits for the next 3-second window before giving up on the call.
IDLE_TIMEOUT_SEC = 30.0
# Bounded fan-out so a stalled SSE client cannot grow memory without limit.
SUBSCRIBER_MAXSIZE = 16


@dataclass
class LiveSession:
    session_id: str
    factors: dict[str, float] = field(default_factory=dict)
    score: float = 0.0
    tier: str = "SAFE"
    transcript: str = ""
    windows_processed: int = 0
    started_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    subscribers: list[asyncio.Queue] = field(default_factory=list)
    task: asyncio.Task | None = None
    _transcribing: bool = False

    def snapshot(self) -> dict:
        return {
            "session_id": self.session_id,
            "risk_score": round(self.score, 2),
            "tier": self.tier,
            "factors": {k: round(v, 4) for k, v in self.factors.items()},
            "transcript": self.transcript[:200],
            "windows_processed": self.windows_processed,
            "updated_at": self.updated_at,
        }


_sessions: dict[str, LiveSession] = {}
_lock = asyncio.Lock()


def get_session(session_id: str) -> LiveSession | None:
    return _sessions.get(session_id)


def _tier_for(score: float) -> str:
    if score >= 90:
        return "HARD_INTERCEPT"
    if score >= 70:
        return "ELEVATED"
    if score >= 40:
        return "WARNING"
    return "SAFE"


def _publish(sess: LiveSession) -> None:
    """Fan out a snapshot to every subscriber without ever blocking the worker."""
    payload = sess.snapshot()
    for q in list(sess.subscribers):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            # Drop the oldest so the client still converges on the latest state.
            with contextlib.suppress(asyncio.QueueEmpty):
                q.get_nowait()
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(payload)


async def _transcribe_and_classify(sess: LiveSession, window: bytes) -> None:
    """Background leg: Whisper transcription then coercion classification."""
    try:
        from models.coercion_engine import classify_async
        from models.transcriber import transcribe

        text = await transcribe(window)
        if text:
            sess.transcript = (sess.transcript + " " + text).strip()[-2000:]
            result = await classify_async(sess.transcript[-500:])
            score = float(result.get("coercion_score", result.get("score", 0.0)) or 0.0)
            sess.factors["text"] = max(0.0, min(1.0, score))
    except Exception as exc:
        logger.warning("[live] transcription/coercion failed for %s: %s", sess.session_id, exc)
    finally:
        sess._transcribing = False


async def _worker(session_id: str, audio_queue: asyncio.Queue) -> None:
    """Consume 3-second windows and keep the session's risk score current."""
    from backend.services.risk_fusion import compute_risk
    from models.audio_analyzer import analyze

    sess = _sessions[session_id]
    logger.info("[live] worker started for session %s", session_id)

    try:
        while True:
            try:
                window = await asyncio.wait_for(audio_queue.get(), timeout=IDLE_TIMEOUT_SEC)
            except asyncio.TimeoutError:
                logger.info("[live] session %s idle for %.0fs — worker exiting",
                            session_id, IDLE_TIMEOUT_SEC)
                break

            # --- Voice-clone CNN on every window (fast enough for the cadence) ---
            try:
                result = await analyze(window)
                sess.factors["audio"] = float(result.get("spoof_probability", 0.0))
            except Exception as exc:
                logger.warning("[live] CNN failed for %s: %s", session_id, exc)

            # --- Whisper + coercion, only if not already running ---
            if not sess._transcribing:
                sess._transcribing = True
                asyncio.create_task(_transcribe_and_classify(sess, window))

            score, _ = compute_risk(sess.factors)
            sess.score = score
            sess.tier = _tier_for(score)
            sess.windows_processed += 1
            sess.updated_at = time.time()

            logger.debug("[live] %s window=%d score=%.1f tier=%s",
                         session_id, sess.windows_processed, score, sess.tier)
            _publish(sess)

    except asyncio.CancelledError:
        logger.info("[live] worker cancelled for session %s", session_id)
        raise
    except Exception as exc:
        logger.exception("[live] worker crashed for session %s: %s", session_id, exc)
    finally:
        # Unblock any SSE clients still waiting on this session.
        for q in list(sess.subscribers):
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait({**sess.snapshot(), "final": True})


async def ensure_worker(session_id: str, audio_queue: asyncio.Queue,
                        seed_factors: dict[str, float] | None = None) -> LiveSession:
    """
    Start (or reuse) the scoring worker for a session. Called on WebSocket connect.

    `seed_factors` lets the REST risk-score call prime the non-audio factors
    (reputation, new_beneficiary, ocr, device) so the live score reflects the whole
    picture rather than voice alone.
    """
    async with _lock:
        sess = _sessions.get(session_id)
        if sess is None:
            sess = LiveSession(session_id=session_id)
            _sessions[session_id] = sess
        if seed_factors:
            sess.factors.update(seed_factors)
        if sess.task is None or sess.task.done():
            sess.task = asyncio.create_task(_worker(session_id, audio_queue))
        return sess


async def stop_worker(session_id: str) -> None:
    """Cancel the worker and drop session state (called on WebSocket disconnect)."""
    async with _lock:
        sess = _sessions.pop(session_id, None)
    if sess and sess.task and not sess.task.done():
        sess.task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await sess.task
    logger.info("[live] session %s stopped", session_id)


def seed_factors(session_id: str, factors: dict[str, float]) -> None:
    """Prime non-audio factors from the REST endpoint; safe to call before the WS opens."""
    sess = _sessions.get(session_id)
    if sess is None:
        sess = LiveSession(session_id=session_id)
        _sessions[session_id] = sess
    sess.factors.update(factors)


@contextlib.contextmanager
def subscription(session_id: str):
    """Register an SSE subscriber queue and guarantee it is removed on exit."""
    sess = _sessions.get(session_id)
    if sess is None:
        sess = LiveSession(session_id=session_id)
        _sessions[session_id] = sess
    q: asyncio.Queue = asyncio.Queue(maxsize=SUBSCRIBER_MAXSIZE)
    sess.subscribers.append(q)
    try:
        yield sess, q
    finally:
        with contextlib.suppress(ValueError):
            sess.subscribers.remove(q)
