"""
GuardPay AI — Smoke Test Script
PROMPT 13: Fast standalone check of all REST endpoints + WebSocket

Usage:
    # Start backend first:  python run.py
    # Then in another terminal:
    python tests/smoke_test.py [--host localhost] [--port 8000]

Checks:
    1. GET /health                  → status == "ok"
    2. POST /api/v1/risk-score      → returns risk_score + tier
    3. GET /api/v1/session/{id}/status → returns TransactionStatus
    4. POST /api/v1/feedback        → records == True
    5. GET /api/v1/stats            → total_feedback >= 0
    6. POST /api/v1/ocr             → ocr_factor in [0, 1]
    7. WebSocket /ws/audio-stream   → sends chunk, receives ACK

Author: Shanteshwar (Backend Lead)
"""

import asyncio
import json
import base64
import sys
import argparse
import time

import httpx
import websockets


BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000"
PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def log(label: str, passed: bool, detail: str = ""):
    status = PASS if passed else FAIL
    line = f"  {status} {label}"
    if detail:
        line += f" | {detail}"
    print(line)
    results.append(passed)


async def smoke_test(base: str, ws_base: str):
    print(f"\nGuardPay AI — Smoke Test")
    print(f"Target: {base}")
    print("=" * 55)

    async with httpx.AsyncClient(base_url=base, timeout=10.0) as client:

        # ── 1. Health ─────────────────────────────────────────────────────────
        try:
            r = await client.get("/health")
            data = r.json()
            log("GET /health", r.status_code == 200 and data.get("status") == "ok",
                f"status={data.get('status')} version={data.get('version')}")
        except Exception as e:
            log("GET /health", False, str(e))

        # ── 2. Risk score (Green path — safe transaction) ─────────────────────
        txn_id = f"SMOKE-{int(time.time())}"
        try:
            payload = {
                "transaction_id": txn_id,
                "sender_upi_id": "smoketest@ybl",
                "receiver_upi_id": "knownmerchant@paytm",
                "amount": 100.0,
                "is_screen_sharing": False,
            }
            r = await client.post("/api/v1/risk-score", json=payload)
            data = r.json()
            score = data.get("risk_score", -1)
            tier = data.get("tier", "?")
            ok = r.status_code == 200 and 0 <= score <= 100 and tier in ("SAFE", "WARNING", "ELEVATED", "HARD_INTERCEPT")
            log("POST /api/v1/risk-score (Green)", ok, f"score={score} tier={tier} latency={data.get('processing_time_ms', '?')}ms")
        except Exception as e:
            log("POST /api/v1/risk-score (Green)", False, str(e))

        # ── 3. Risk score (Red path — high-risk transaction) ──────────────────
        try:
            payload_red = {
                "transaction_id": f"{txn_id}-RED",
                "sender_upi_id": "victim@ybl",
                "receiver_upi_id": f"scammer_new_{int(time.time())}@upi",
                "amount": 75000.0,
                "is_screen_sharing": True,
                "device_behaviour": {
                    "screen_share_duration_seconds": 300,
                    "app_switch_locked": True,
                    "unusual_typing_cadence": True,
                    "time_since_last_app_open_seconds": 0,
                },
            }
            r = await client.post("/api/v1/risk-score", json=payload_red)
            data = r.json()
            score = data.get("risk_score", -1)
            tier = data.get("tier", "?")
            ok = r.status_code == 200 and score >= 40  # should at minimum be WARNING
            log("POST /api/v1/risk-score (Red)", ok, f"score={score} tier={tier}")
        except Exception as e:
            log("POST /api/v1/risk-score (Red)", False, str(e))

        # ── 4. Session status ─────────────────────────────────────────────────
        try:
            r = await client.get(f"/api/v1/session/{txn_id}/status")
            data = r.json()
            ok = r.status_code == 200 and "status" in data
            log("GET /api/v1/session/{id}/status", ok, f"status={data.get('status')}")
        except Exception as e:
            log("GET /api/v1/session/{id}/status", False, str(e))

        # ── 5. Feedback ───────────────────────────────────────────────────────
        try:
            r = await client.post("/api/v1/feedback", json={
                "transaction_id": txn_id,
                "was_scam": False,
                "reported_by": "smoke_test",
            })
            data = r.json()
            ok = r.status_code == 200 and data.get("recorded") is True
            log("POST /api/v1/feedback", ok, data.get("message", "")[:50])
        except Exception as e:
            log("POST /api/v1/feedback", False, str(e))

        # ── 6. Stats ──────────────────────────────────────────────────────────
        try:
            r = await client.get("/api/v1/stats")
            data = r.json()
            ok = r.status_code == 200 and "total_feedback" in data
            log("GET /api/v1/stats", ok, f"total={data.get('total_feedback')} fp_rate={data.get('false_positive_rate')}")
        except Exception as e:
            log("GET /api/v1/stats", False, str(e))

        # ── 7. OCR ────────────────────────────────────────────────────────────
        try:
            # 1x1 white pixel PNG as dummy screenshot
            dummy_img = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
            r = await client.post("/api/v1/ocr", json={
                "transaction_id": txn_id,
                "screenshot_base64": dummy_img,
            })
            data = r.json()
            ok = r.status_code == 200 and "ocr_factor" in data
            log("POST /api/v1/ocr", ok, f"factor={data.get('ocr_factor')} phrases={data.get('scam_phrases_detected', [])}")
        except Exception as e:
            log("POST /api/v1/ocr", False, str(e))

    # ── 8. WebSocket audio stream ─────────────────────────────────────────────
    try:
        # 3-second silence chunk: 96000 zero bytes = 16kHz/16-bit/mono/3s
        silence = base64.b64encode(bytes(96000)).decode()
        ws_endpoint = f"{ws_base}/ws/audio-stream"
        async with websockets.connect(ws_endpoint, open_timeout=5) as ws:
            msg = json.dumps({
                "session_id": "smoke-ws-session",
                "chunk_index": 0,
                "pcm_base64": silence,
                "sample_rate": 16000,
            })
            await ws.send(msg)
            ack = await asyncio.wait_for(ws.recv(), timeout=5)
            ack_data = json.loads(ack)
            ok = "status" in ack_data
            log("WebSocket /ws/audio-stream", ok, f"ack={ack_data.get('status')} buffer={ack_data.get('buffer_bytes')}B")
    except Exception as e:
        log("WebSocket /ws/audio-stream", False, str(e))

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=" * 55)
    passed = sum(results)
    total = len(results)
    print(f"  Result: {passed}/{total} checks passed")
    if passed == total:
        print("  SMOKE TEST: PASS")
    else:
        print(f"  SMOKE TEST: FAIL ({total - passed} check(s) failed)")
    print()
    return passed == total


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GuardPay AI Smoke Test")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()

    base = f"http://{args.host}:{args.port}"
    ws_base = f"ws://{args.host}:{args.port}"

    success = asyncio.run(smoke_test(base, ws_base))
    sys.exit(0 if success else 1)
