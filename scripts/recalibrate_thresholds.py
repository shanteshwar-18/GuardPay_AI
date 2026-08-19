"""
recalibrate_thresholds.py — Offline Platt-Scaling Recalibration Script
GuardPay AI · AI/ML Module (Jatin)

Pulls real feedback from Supabase (or a transactions_log CSV), joins with
risk factors, and refits the LogisticRegression calibrator in risk_fusion.py.

Usage:
    python scripts/recalibrate_thresholds.py [--csv path/to/transactions_log.csv]

Output:
    models/calibrator.pkl  (updated calibrator loaded by risk_fusion at startup)

Commit: feat(feedback): Supabase feedback capture and threshold recalibration script
"""

from __future__ import annotations

import argparse
import os
import pickle
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

CALIBRATOR_PATH = PROJECT_ROOT / "models" / "calibrator.pkl"


# ── Data collection ────────────────────────────────────────────────────────────

def _load_from_supabase() -> list[dict]:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        print("[recalibrate] SUPABASE_URL/KEY not set — skipping Supabase")
        return []
    try:
        from supabase import create_client
        client = create_client(url, key)
        result = client.table("feedback").select("*").execute()
        rows   = result.data or []
        print(f"[recalibrate] Loaded {len(rows)} feedback rows from Supabase")
        return rows
    except Exception as exc:
        print(f"[recalibrate] Supabase fetch failed: {exc}")
        return []


def _load_from_csv(csv_path: str) -> list[dict]:
    import csv
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "risk_score": float(row.get("risk_score", 0)),
                "was_scam":   row.get("was_scam", "false").lower() in ("true", "1", "yes"),
            })
    print(f"[recalibrate] Loaded {len(rows)} rows from {csv_path}")
    return rows


def _mock_csv_fallback() -> list[dict]:
    """Generate stub data if neither Supabase nor CSV is available."""
    print("[recalibrate] Using mock stub data (no real feedback available)")
    rng = np.random.default_rng(99)
    rows = []
    # Scam transactions: risk_score typically 70–100
    for _ in range(40):
        rows.append({"risk_score": float(rng.uniform(70, 100)), "was_scam": True})
    # Benign transactions: risk_score typically 0–50
    for _ in range(60):
        rows.append({"risk_score": float(rng.uniform(0, 50)), "was_scam": False})
    return rows


# ── Recalibration ──────────────────────────────────────────────────────────────

def recalibrate(rows: list[dict]) -> None:
    from sklearn.linear_model import LogisticRegression

    if not rows:
        print("[recalibrate] No data to fit — aborting")
        return

    X = np.array([[r["risk_score"] / 100.0] for r in rows], dtype=np.float32)
    y = np.array([int(r["was_scam"]) for r in rows], dtype=np.int32)

    n_pos = y.sum()
    n_neg = len(y) - n_pos
    print(f"[recalibrate] Fitting calibrator: {len(y)} samples  "
          f"(scam={n_pos}, benign={n_neg})")

    clf = LogisticRegression(C=1.0, random_state=42, max_iter=500)
    clf.fit(X, y)

    CALIBRATOR_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CALIBRATOR_PATH, "wb") as f:
        pickle.dump(clf, f)

    print(f"[recalibrate] ✓  Calibrator saved → {CALIBRATOR_PATH}")

    # Quick sanity check
    p_low  = clf.predict_proba([[0.2]])[0][1]
    p_high = clf.predict_proba([[0.9]])[0][1]
    print(f"[recalibrate]    P(scam | score=0.2) = {p_low:.4f}")
    print(f"[recalibrate]    P(scam | score=0.9) = {p_high:.4f}")


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Recalibrate GuardPay risk score calibrator")
    parser.add_argument("--csv", default=None, help="Path to transactions_log CSV")
    args = parser.parse_args()

    print("=" * 60)
    print("GuardPay AI — Threshold Recalibration")
    print("=" * 60)

    rows = _load_from_supabase()

    if not rows and args.csv:
        rows = _load_from_csv(args.csv)

    if not rows:
        rows = _mock_csv_fallback()

    recalibrate(rows)
    print("=" * 60)
