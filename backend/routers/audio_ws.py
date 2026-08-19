"""
GuardPay AI — WebSocket Audio Stream
PROMPT 5: Buffers base64 PCM chunks into 3-second windows → asyncio.Queue
"""

import asyncio
import base64
import json
import logging
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory per-session audio queues (session_id → asyncio.Queue of PCM bytes)
_audio_queues: dict[str, asyncio.Queue] = defaultdict(asyncio.Queue)

# 3-second window at 16kHz, 16-bit mono = 16000 * 2 * 3 = 96000 bytes
WINDOW_BYTES = 96_000
SILENCE_TIMEOUT = 10  # seconds — close idle connection


def get_audio_queue(session_id: str) -> asyncio.Queue:
    """Expose queue to AI pipeline (Phase 7 — Jatin's orchestrator)."""
    return _audio_queues[session_id]


@router.websocket("/ws/audio-stream")
async def audio_stream(websocket: WebSocket):
    """
    Mobile client streams base64 PCM chunks here.
    Each 3-second window is assembled and pushed to the session queue.

    Message format (JSON):
        { "session_id": "...", "chunk_index": 0, "pcm_base64": "...", "sample_rate": 16000 }

    The AI pipeline (pipeline_orchestrator.py — Phase 7) consumes from queue.
    """
    await websocket.accept()
    session_id: str | None = None
    buffer: bytes = b""

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=SILENCE_TIMEOUT)
            except asyncio.TimeoutError:
                logger.info(f"[WS] Silence timeout — closing session {session_id}")
                await websocket.close(code=1000, reason="Silence timeout")
                break

            try:
                msg = json.loads(raw)
                session_id = msg.get("session_id", session_id)
                pcm_bytes = base64.b64decode(msg["pcm_base64"])
            except (json.JSONDecodeError, KeyError, Exception) as e:
                logger.warning(f"[WS] Bad message: {e}")
                await websocket.send_text(json.dumps({"error": "Invalid message format"}))
                continue

            buffer += pcm_bytes

            # Push complete 3-second windows to queue
            while len(buffer) >= WINDOW_BYTES:
                window, buffer = buffer[:WINDOW_BYTES], buffer[WINDOW_BYTES:]
                if session_id:
                    await _audio_queues[session_id].put(window)
                    logger.debug(f"[WS] Pushed 3s window for session {session_id} — queue depth {_audio_queues[session_id].qsize()}")

            await websocket.send_text(json.dumps({
                "status": "received",
                "session_id": session_id,
                "buffer_bytes": len(buffer),
            }))

    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected — session {session_id}")
    finally:
        # Clean up queue when session ends
        if session_id and session_id in _audio_queues:
            del _audio_queues[session_id]
            logger.info(f"[WS] Queue cleaned for session {session_id}")
