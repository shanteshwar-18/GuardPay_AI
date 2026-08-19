"""
verify_phase0.py — Phase 0 Verification Script (Jatin - AI/ML)
GuardPay AI

Runs ALL module self-tests in sequence to verify the full AI/ML surface
is correctly set up before Phase 1 integration begins.

Usage:
    python scripts/verify_phase0.py

Commit: feat(data): verify ASVspoof dev/eval split and mock DB generation scripts
"""

from __future__ import annotations
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

PASS = "✅"
FAIL = "❌"
results = []


def run_check(name: str, fn):
    print(f"\n{'='*60}")
    print(f"▶  {name}")
    print('='*60)
    t0 = time.monotonic()
    try:
        fn()
        elapsed = (time.monotonic() - t0) * 1000
        print(f"{PASS}  PASS  ({elapsed:.0f}ms)")
        results.append((name, True, None))
    except Exception as exc:
        elapsed = (time.monotonic() - t0) * 1000
        print(f"{FAIL}  FAIL  ({elapsed:.0f}ms): {exc}")
        traceback.print_exc()
        results.append((name, False, str(exc)))


# ── Check 1: audio_features ───────────────────────────────────────────────────
def check_audio_features():
    import io
    import numpy as np
    import soundfile as sf
    from models.audio_features import extract_melspectrogram, extract_mfcc, batch_extract

    sr = 16_000
    t  = np.linspace(0, 3.0, 3 * sr, endpoint=False)
    audio = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    wav_bytes = buf.getvalue()

    mel = extract_melspectrogram(wav_bytes)
    mfc = extract_mfcc(wav_bytes)
    assert mel.shape == (128, 128), f"mel shape {mel.shape}"
    assert mfc.shape == (128, 128), f"mfcc shape {mfc.shape}"
    assert 0.0 <= mel.min() and mel.max() <= 1.0, "mel not normalised"

    feats, labels = batch_extract([wav_bytes, wav_bytes], [0, 1])
    assert feats.shape == (2, 128, 128)
    print(f"  mel={mel.shape} mfcc={mfc.shape} batch={feats.shape} ✓")


# ── Check 2: Synthetic data generation ───────────────────────────────────────
def check_synthetic_data():
    from models.behaviour_analyzer import train_and_save, MODEL_PATH, SCALER_PATH

    train_and_save()
    assert MODEL_PATH.exists(),  f"Model not found: {MODEL_PATH}"
    assert SCALER_PATH.exists(), f"Scaler not found: {SCALER_PATH}"
    print(f"  isolation_forest.pkl + behaviour_scaler.pkl created ✓")

    # Generate audio synthetic data
    from scripts.generate_synthetic_data import generate_audio_features, generate_transcripts
    generate_audio_features(n_bonafide=20, n_spoof=20)  # small for speed
    generate_transcripts()

    from pathlib import Path
    npy_files = list((Path(__file__).parent.parent / "data/mock/synthetic_audio").glob("*.npy"))
    assert len(npy_files) > 0, "No synthetic audio files generated"
    print(f"  {len(npy_files)} synthetic audio .npy files ✓")


# ── Check 3: Coercion engine ──────────────────────────────────────────────────
def check_coercion_engine():
    import models.coercion_engine as ce

    ce._init_tfidf()
    # Read _lexicon AFTER _init_tfidf() reassigns the global
    _lexicon = ce._lexicon
    assert len(_lexicon) > 100, f"Lexicon too small: {len(_lexicon)}"

    r1 = ce.classify("cbi officer speaking you are under digital arrest transfer money immediately")
    assert r1["label"] == "COERCIVE", f"Expected COERCIVE, got {r1['label']}"

    r2 = ce.classify("payment received food delivery confirmed order completed successfully")
    assert r2["label"] == "BENIGN", f"Expected BENIGN, got {r2['label']} (score={r2['score']:.3f})"

    print(f"  lexicon={len(_lexicon)} phrases  coercive={r1['score']:.3f}  benign={r2['score']:.3f} ✓")



# ── Check 4: Behaviour analyzer ───────────────────────────────────────────────
def check_behaviour_analyzer():
    from models.behaviour_analyzer import score

    normal = score({"screen_share_active": 0, "tap_cadence_hz": 1.5,
                    "payment_amount": 500, "call_duration_sec": 30})
    scam   = score({"screen_share_active": 1, "tap_cadence_hz": 18,
                    "payment_amount": 750_000, "call_duration_sec": 2400,
                    "beneficiary_is_new": 1})

    assert not normal["is_anomaly"], f"Normal incorrectly flagged: {normal}"
    assert scam["is_anomaly"],       f"Scam not detected: {scam}"
    print(f"  normal_score={normal['anomaly_score']:.3f}  scam_score={scam['anomaly_score']:.3f} ✓")


# ── Check 5: Risk fusion ──────────────────────────────────────────────────────
def check_risk_fusion():
    from models.risk_fusion import fuse

    safe   = fuse({"voice_score": 0.05, "coercion_score": 0.0, "ocr_score": 0.0,
                   "reputation_score": 0.0, "new_beneficiary": 0, "anomaly_score": 0.05})
    red    = fuse({"voice_score": 0.95, "coercion_score": 0.98, "ocr_score": 0.9,
                   "reputation_score": 0.8, "new_beneficiary": 1, "anomaly_score": 0.9})

    assert safe["risk_tier"] == "ALLOWED",        f"Expected ALLOWED: {safe}"
    assert red["risk_tier"]  == "HARD_INTERCEPT", f"Expected HARD_INTERCEPT: {red}"
    assert len(red["shap_top3"]) == 3
    print(f"  safe={safe['risk_score']}  red={red['risk_score']}  shap={red['shap_top3'][0]['factor']} ✓")


# ── Check 6: OCR engine ───────────────────────────────────────────────────────
def check_ocr_engine():
    from backend.services.ocr_engine import analyze_screen

    scam = analyze_screen(text="CENTRAL BUREAU OF INVESTIGATION Arrest Warrant money laundering pay immediately")
    ok   = analyze_screen(text="Payment Receipt Amount Rs 500 Merchant Zomato Status Success")

    assert scam["ocr_score"] > 0.2, f"Scam score too low: {scam['ocr_score']}"
    assert ok["ocr_score"]   < 0.3, f"Normal score too high: {ok['ocr_score']}"
    print(f"  scam_score={scam['ocr_score']:.3f}  normal_score={ok['ocr_score']:.3f} ✓")


# ── Check 7: CNN model file (post-training) ───────────────────────────────────
def check_model_artifact():
    from pathlib import Path
    model_path = Path(__file__).parent.parent / "models" / "voice_cnn.pt"
    if not model_path.exists():
        print(f"  ⚠  voice_cnn.pt not found — run: python models/train_cnn.py")
        print(f"     This is expected before training is complete.")
    else:
        size_kb = model_path.stat().st_size // 1024
        print(f"  voice_cnn.pt exists ({size_kb} KB) ✓")


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "🛡️  GuardPay AI — Phase 0 Verification (Jatin - AI/ML)  🛡️".center(60))

    run_check("PROMPT 3 - Audio Features (MFCC + Mel-spec)",   check_audio_features)
    run_check("PROMPT 0 - Synthetic Data Generation",           check_synthetic_data)
    run_check("PROMPT 7 - Coercion Engine (TF-IDF)",            check_coercion_engine)
    run_check("PROMPT 8 - Behaviour Analyzer (IsoForest)",      check_behaviour_analyzer)
    run_check("PROMPT 9 - Risk Fusion + SHAP",                  check_risk_fusion)
    run_check("PROMPT 13 - OCR Engine",                         check_ocr_engine)
    run_check("PROMPT 4/5 - Model Artifact",                    check_model_artifact)

    print("\n" + "="*60)
    passed = sum(1 for _, ok, _ in results if ok)
    total  = len(results)
    print(f"  Results: {passed}/{total} checks passed")
    for name, ok, err in results:
        status = PASS if ok else FAIL
        print(f"  {status}  {name}")
    print("="*60)
    if passed == total:
        print("\n✅  ALL CHECKS PASSED — Phase 0 complete, ready for Phase 2!")
    else:
        print(f"\n⚠️   {total-passed} check(s) failed — fix before proceeding.")
    sys.exit(0 if passed == total else 1)
