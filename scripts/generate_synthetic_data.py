"""
generate_synthetic_data.py — Mock Data Generation Script
GuardPay AI · AI/ML Module (Jatin)

Generates all synthetic/mock data files needed when real datasets are
unavailable. Run this once during Phase 0 setup.

Usage:
    python scripts/generate_synthetic_data.py

Generates:
    data/mock/synthetic_audio/          — .npy mel-spectrogram arrays
    data/mock/coercion_lexicon/         — phrases.json
    data/mock/behaviour_data.npy        — behavioural feature matrix
    data/mock/upi_scam_transcripts.csv  — synthetic scam/benign transcripts
    data/mock/synthetic_audio_features.npy  — fallback for ASVspoof

Commit: feat(data): verify ASVspoof dev/eval split and mock DB generation scripts
"""

from __future__ import annotations

import json
import csv
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent
DATA_MOCK    = PROJECT_ROOT / "data" / "mock"


# ── 1. Synthetic Audio Features ────────────────────────────────────────────────

def generate_audio_features(n_bonafide: int = 400, n_spoof: int = 400):
    print("[gen] Generating synthetic audio mel-spectrogram features ...")
    out_dir = DATA_MOCK / "synthetic_audio"
    out_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(42)

    # Bonafide: smoother, lower-energy high-freq regions
    for i in range(n_bonafide):
        arr = rng.normal(loc=-20, scale=10, size=(128, 128)).astype(np.float32)
        arr = np.clip(arr, -80, 0)
        np.save(out_dir / f"bonafide_{i:04d}.npy", arr)

    # Spoof: more uniform energy distribution (typical of TTS/vocoder artefacts)
    for i in range(n_spoof):
        arr = rng.normal(loc=-15, scale=8, size=(128, 128)).astype(np.float32)
        arr += rng.uniform(0, 5, size=(128, 128)).astype(np.float32)  # add noise
        arr = np.clip(arr, -80, 0)
        np.save(out_dir / f"spoof_{i:04d}.npy", arr)

    # Combined fallback array
    combined = np.vstack([
        np.array([np.load(out_dir / f"bonafide_{i:04d}.npy") for i in range(min(50, n_bonafide))]),
        np.array([np.load(out_dir / f"spoof_{i:04d}.npy")    for i in range(min(50, n_spoof))]),
    ])
    np.save(DATA_MOCK / "synthetic_audio_features.npy", combined)
    print(f"  ✓ {n_bonafide} bonafide + {n_spoof} spoof  →  {out_dir}")


# ── 2. Coercion Lexicon ────────────────────────────────────────────────────────

def generate_coercion_lexicon():
    print("[gen] Building coercion phrase lexicon ...")
    out_path = DATA_MOCK / "coercion_lexicon" / "phrases.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Import from coercion_engine to stay in sync
    import sys
    sys.path.insert(0, str(PROJECT_ROOT))
    from models.coercion_engine import _build_lexicon
    phrases = _build_lexicon()

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(phrases, f, ensure_ascii=False, indent=2)

    print(f"  ✓ {len(phrases)} phrases  →  {out_path}")


# ── 3. Synthetic Scam Transcripts ─────────────────────────────────────────────

SCAM_TRANSCRIPTS = [
    # Coercive (was_scam=1)
    ("cbi officer speaking your account has been linked to money laundering pay immediately or face arrest", 1),
    ("enforcement directorate has issued a warrant we need you to transfer funds to a safe account now", 1),
    ("your aadhaar card has been misused in drug trafficking do not tell anyone keep this call secret", 1),
    ("trai is blocking your number unless you pay the penalty within one hour your sim will be deactivated", 1),
    ("narcotics control bureau this is your final warning pay or be arrested do not hang up", 1),
    ("aapka account band ho jayega abhi paisa transfer karo kisi ko mat batana", 1),
    ("your pan card is blocked by income tax department pay rs 50000 to clear your name immediately", 1),
    ("high court order has been issued against you for non-bailable offence stay on the line", 1),
    ("you are being monitored by cybercrime division transfer to government escrow account", 1),
    ("this is rbi compliance team your transaction is frozen transfer to verify your identity", 1),
    # Benign (was_scam=0)
    ("hi can you please transfer 500 rupees for the groceries i bought yesterday thanks", 0),
    ("i would like to send money to my mother for her birthday can you help me set it up", 0),
    ("please confirm the upi id before i send the rent payment for this month", 0),
    ("splitting the restaurant bill with you sending my share now let me know if you get it", 0),
    ("the electricity bill is due today i am paying it via upi should be done in a minute", 0),
    ("could you please refund the amount for the cancelled order thank you", 0),
    ("just checking if you received the payment i sent earlier for the textbooks", 0),
    ("i am adding a new merchant to my upi app it is asking for verification is this normal", 0),
    ("hi this is the water authority your bill has been generated please pay by end of month", 0),
    ("amazon delivery partner confirming your cash on delivery order please keep exact change ready", 0),
]


def generate_transcripts():
    print("[gen] Generating synthetic scam transcripts ...")
    out_path = DATA_MOCK / "upi_scam_transcripts.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["transcript", "was_scam", "split"])
        rng = np.random.default_rng(123)
        for text, label in SCAM_TRANSCRIPTS:
            split = "train" if rng.random() < 0.8 else "eval"
            writer.writerow([text, label, split])

    print(f"  ✓ {len(SCAM_TRANSCRIPTS)} transcripts  →  {out_path}")


# ── 4. Behaviour Data ──────────────────────────────────────────────────────────

def generate_behaviour_data():
    print("[gen] Generating synthetic device behaviour data ...")
    # Reuse logic from behaviour_analyzer to stay consistent
    import sys
    sys.path.insert(0, str(PROJECT_ROOT))
    from models.behaviour_analyzer import train_and_save
    train_and_save()
    print("  ✓ Isolation Forest trained and saved")


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("GuardPay AI — Synthetic Data Generation")
    print("=" * 60)
    generate_audio_features()
    generate_coercion_lexicon()
    generate_transcripts()
    generate_behaviour_data()
    print("\n✓ All synthetic data generated successfully.")
    print("=" * 60)
