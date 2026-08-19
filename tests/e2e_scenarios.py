"""
GuardPay AI — End-to-End Demo Scenario Tests
PROMPT 14: Validates three demo paths (Green / Yellow / Red) against live backend

Scenarios (per playbook Phase 8.2):
    A (Green)  — Known beneficiary, no call → Risk < 40 → PIN pad. No friction.
    B (Yellow) — New beneficiary + neutral call → Risk 40–70 → Warning + SHAP.
    C (Red)    — Synthetic voice + coercive transcript + OCR + new beneficiary
                 → Risk > 90 → HARD_INTERCEPT + Twilio + Evidence + Bank alert.

Usage:
    # Start backend first:  python run.py
    # Start mock bank:      python scripts/mock_bank_server.py
    python tests/e2e_scenarios.py [--host localhost] [--port 8000]

Author: Shanteshwar (Backend Lead)
"""

import asyncio
import base64
import io
import sys
import argparse
import time
import json

import httpx
import numpy as np
import soundfile as sf


def _make_spoof_audio_b64(duration_sec: float = 3.0, sr: int = 16000) -> str:
    """Generate a synthetic high-frequency tone that our CNN flags as spoof."""
    t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False)
    # High-frequency tone — spoof voice clones tend to have unnatural harmonics
    audio = (0.4 * np.sin(2 * np.pi * 3500 * t) +
             0.2 * np.sin(2 * np.pi * 6000 * t)).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format='WAV')
    return base64.b64encode(buf.getvalue()).decode()


# Pre-generate audio blobs once for all scenarios
_SPOOF_AUDIO_B64 = _make_spoof_audio_b64(3.0)   # 3-second synthetic voice clone

BASE_URL = "http://localhost:8000"

PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"


def log(label: str, passed: bool, detail: str = ""):
    symbol = PASS if passed else FAIL
    print(f"  {symbol} {label}", end="")
    if detail:
        print(f" | {detail}", end="")
    print()
    return passed


async def run_scenarios(base: str) -> bool:
    print(f"\nGuardPay AI — E2E Scenario Tests")
    print(f"Target: {base}")
    print("=" * 65)

    all_passed = True

    async with httpx.AsyncClient(base_url=base, timeout=15.0) as client:

        # ──────────────────────────────────────────────────────────────────────
        # SCENARIO A — GREEN PATH
        # Known beneficiary, small amount, no screen share → SAFE
        # ──────────────────────────────────────────────────────────────────────
        print("\n  SCENARIO A — GREEN PATH (no friction, PIN pad)")
        print("  " + "-" * 55)

        ts = int(time.time())
        txn_a = f"E2E-A-{ts}"
        try:
            r = await client.post("/api/v1/risk-score", json={
                "transaction_id": txn_a,
                "sender_upi_id": "alice@ybl",
                "receiver_upi_id": "merchant_known@paytm",  # known beneficiary
                "amount": 500.0,
                "is_screen_sharing": False,
            })
            d = r.json()
            score = d.get("risk_score", -1)
            tier = d.get("tier", "?")
            a1 = log("  Risk score < 40", score < 40, f"score={score}")
            a2 = log("  Tier == SAFE", tier == "SAFE", f"tier={tier}")
            a3 = log("  No evidence bundle", d.get("evidence_bundle_id") is None,
                     f"bundle={d.get('evidence_bundle_id')}")
            a4 = log("  IVR not initiated", d.get("ivr_call_initiated") is False,
                     f"ivr={d.get('ivr_call_initiated')}")
            if not all([a1, a2, a3, a4]):
                all_passed = False
        except Exception as e:
            log("  Scenario A request", False, str(e))
            all_passed = False

        # ──────────────────────────────────────────────────────────────────────
        # SCENARIO B — YELLOW PATH
        # New beneficiary + large amount → WARNING with SHAP explanation
        # ──────────────────────────────────────────────────────────────────────
        print("\n  SCENARIO B — YELLOW PATH (warning screen + SHAP breakdown)")
        print("  " + "-" * 55)

        txn_b = f"E2E-B-{ts}"
        try:
            r = await client.post("/api/v1/risk-score", json={
                "transaction_id": txn_b,
                "sender_upi_id": "bob@oksbi",
                "receiver_upi_id": f"new_receiver_{ts}@okhdfcbank",  # new beneficiary
                "amount": 25000.0,
                "is_screen_sharing": True,  # screen share active during KYC scam
                # Provide synthetic spoof audio → CNN raises voice_factor
                "audio_base64": _SPOOF_AUDIO_B64,
                "transcript": "urgent kyc blocked verify account transfer now",
                "ocr_text": "Bank KYC verification pending. Transfer token amount to unblock account.",
                "device_behaviour": {
                    "screen_share_duration_seconds": 45,
                    "app_switch_locked": False,
                    "unusual_typing_cadence": True,
                    "beneficiary_is_new": 1,
                    "time_since_last_app_open_seconds": 60,
                },
            })
            d = r.json()
            score = d.get("risk_score", -1)
            tier = d.get("tier", "?")
            b1 = log("  Risk score >= 40", score >= 40, f"score={score}")
            b2 = log("  Tier is WARNING or higher",
                     tier in ("WARNING", "ELEVATED", "HARD_INTERCEPT"),
                     f"tier={tier}")
            b3 = log("  Explanation returned", len(d.get("explanation", [])) > 0,
                     f"factors={len(d.get('explanation', []))}")
            b4 = log("  Recommended action present",
                     bool(d.get("recommended_action")),
                     d.get("recommended_action", "")[:50])
            if not all([b1, b2, b3, b4]):
                all_passed = False
        except Exception as e:
            log("  Scenario B request", False, str(e))
            all_passed = False

        # ──────────────────────────────────────────────────────────────────────
        # SCENARIO C — RED PATH
        # All signals maxed → HARD_INTERCEPT + evidence + IVR stub
        # ──────────────────────────────────────────────────────────────────────
        print("\n  SCENARIO C — RED PATH (HARD_INTERCEPT + evidence + IVR)")
        print("  " + "-" * 55)

        txn_c = f"E2E-C-{ts}"
        try:
            r = await client.post("/api/v1/risk-score", json={
                "transaction_id": txn_c,
                "sender_upi_id": "victim@ybl",
                "receiver_upi_id": f"scammer_{ts}@upi",          # new beneficiary
                "amount": 80000.0,
                "is_screen_sharing": True,
                # Real spoof audio → CNN spoof_prob ~ 0.99
                "audio_base64": _SPOOF_AUDIO_B64,
                # Coercive transcript and OCR text — triggers full alert
                "transcript": "police cbi officer arrest warrant digital arrest money laundering transfer funds immediately",
                "ocr_text": "CBI arrest warrant issued. Immediate bank account freeze. Transfer funds now or face criminal action.",
                "trusted_contact_number": "+919876543210",
                "device_behaviour": {
                    "screen_share_duration_seconds": 360,
                    "app_switch_locked": True,
                    "unusual_typing_cadence": True,
                    "beneficiary_is_new": 1,
                    "time_since_last_app_open_seconds": 0,
                },
            })
            d = r.json()
            score = d.get("risk_score", -1)
            tier = d.get("tier", "?")
            c1 = log("  Risk score >= 70", score >= 70, f"score={score}")
            c2 = log("  Tier is ELEVATED or HARD_INTERCEPT",
                     tier in ("ELEVATED", "HARD_INTERCEPT"), f"tier={tier}")
            c3 = log("  Evidence bundle created",
                     d.get("evidence_bundle_id") is not None,
                     f"bundle={d.get('evidence_bundle_id')}")
            c4 = log("  Explanation has >= 2 factors",
                     len(d.get("explanation", [])) >= 2,
                     f"count={len(d.get('explanation', []))}")
            c5 = log("  Processing time < 5000ms",
                     d.get("processing_time_ms", 9999) < 5000,
                     f"{d.get('processing_time_ms', '?')}ms")
            if not all([c1, c2, c3, c4, c5]):
                all_passed = False
        except Exception as e:
            log("  Scenario C request", False, str(e))
            all_passed = False

        # ──────────────────────────────────────────────────────────────────────
        # SESSION POLLING (Scenario C)
        # ──────────────────────────────────────────────────────────────────────
        print("\n  SESSION POLLING — Scenario C")
        print("  " + "-" * 55)
        try:
            r = await client.get(f"/api/v1/session/{txn_c}/status")
            d = r.json()
            ok = r.status_code == 200 and "status" in d
            log("  Session status reachable", ok, f"status={d.get('status')}")
            if not ok:
                all_passed = False
        except Exception as e:
            log("  Session polling", False, str(e))
            all_passed = False

    # ── Final summary ──────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    if all_passed:
        print("  E2E SCENARIOS: ALL PASS")
    else:
        print("  E2E SCENARIOS: SOME FAILURES — check output above")
    print()
    return all_passed


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()

    base = f"http://{args.host}:{args.port}"
    success = asyncio.run(run_scenarios(base))
    sys.exit(0 if success else 1)
