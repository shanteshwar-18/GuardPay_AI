"""
Unit tests for GuardPay AI — Jatin's AI/ML modules
Run with: pytest tests/unit/ -v
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import numpy as np
import pytest


# ─────────────────────────────────────────────────────────────────────────────
# audio_features
# ─────────────────────────────────────────────────────────────────────────────

class TestAudioFeatures:
    def _make_wav_bytes(self, freq=440.0, duration=3.0, sr=16000):
        import io, soundfile as sf
        t     = np.linspace(0, duration, int(sr * duration), endpoint=False)
        audio = (0.3 * np.sin(2 * np.pi * freq * t)).astype(np.float32)
        buf   = io.BytesIO()
        sf.write(buf, audio, sr, format="WAV")
        return buf.getvalue()

    def test_extract_melspectrogram_shape(self):
        from models.audio_features import extract_melspectrogram
        mel = extract_melspectrogram(self._make_wav_bytes())
        assert mel.shape == (128, 128), f"Expected (128,128), got {mel.shape}"

    def test_extract_mfcc_shape(self):
        from models.audio_features import extract_mfcc
        mfc = extract_mfcc(self._make_wav_bytes())
        assert mfc.shape == (128, 128)

    def test_melspectrogram_normalised(self):
        from models.audio_features import extract_melspectrogram
        mel = extract_melspectrogram(self._make_wav_bytes())
        assert mel.min() >= 0.0
        assert mel.max() <= 1.0

    def test_npy_fallback(self, tmp_path):
        from models.audio_features import extract_melspectrogram
        arr = np.random.randn(128, 128).astype(np.float32)
        p   = tmp_path / "test.npy"
        np.save(p, arr)
        mel = extract_melspectrogram(str(p))
        assert mel.shape == (128, 128)

    def test_batch_extract(self):
        from models.audio_features import batch_extract
        files  = [self._make_wav_bytes(f * 100) for f in range(1, 4)]
        labels = [0, 1, 0]
        feats, lbls = batch_extract(files, labels)
        assert feats.shape == (3, 128, 128)
        assert list(lbls) == [0, 1, 0]


# ─────────────────────────────────────────────────────────────────────────────
# coercion_engine
# ─────────────────────────────────────────────────────────────────────────────

class TestCoercionEngine:
    def test_obvious_coercive(self):
        from models.coercion_engine import classify
        r = classify("CBI officer speaking. You are under digital arrest. Transfer money immediately.")
        assert r["label"] == "COERCIVE"
        assert r["score"] > 0.0

    def test_obvious_benign(self):
        from models.coercion_engine import classify
        r = classify("hi please transfer 200 rupees for dinner thanks")
        assert r["label"] == "BENIGN"

    def test_hindi_coercive(self):
        from models.coercion_engine import classify
        r = classify("aapka account band ho jayega abhi paisa transfer karo")
        assert r["label"] == "COERCIVE"

    def test_result_schema(self):
        from models.coercion_engine import classify
        r = classify("some random text")
        assert "label"           in r
        assert "score"           in r
        assert "path"            in r
        assert "matched_phrases" in r
        assert r["label"] in ("COERCIVE", "BENIGN")
        assert 0.0 <= r["score"] <= 1.0

    def test_async_classify(self):
        import asyncio
        from models.coercion_engine import classify_async
        r = asyncio.run(classify_async("you are under arrest transfer now"))
        assert r["label"] == "COERCIVE"


# ─────────────────────────────────────────────────────────────────────────────
# behaviour_analyzer
# ─────────────────────────────────────────────────────────────────────────────

class TestBehaviourAnalyzer:
    NORMAL_EVENT = {
        "screen_share_active": 0, "tap_cadence_hz": 1.5,
        "app_switches_per_min": 2, "payment_amount": 500,
        "call_duration_sec": 30, "typing_speed_cps": 5,
        "brightness_change": 0, "volume_change": 0,
        "beneficiary_is_new": 0, "time_since_last_txn_hr": 24,
    }
    SCAM_EVENT = {
        "screen_share_active": 1, "tap_cadence_hz": 18,
        "app_switches_per_min": 30, "payment_amount": 750_000,
        "call_duration_sec": 2400, "typing_speed_cps": 1,
        "brightness_change": 1, "volume_change": 1,
        "beneficiary_is_new": 1, "time_since_last_txn_hr": 0.1,
    }

    def test_normal_not_anomaly(self):
        from models.behaviour_analyzer import score
        r = score(self.NORMAL_EVENT)
        assert not r["is_anomaly"]
        assert 0.0 <= r["anomaly_score"] <= 1.0

    def test_scam_is_anomaly(self):
        from models.behaviour_analyzer import score
        r = score(self.SCAM_EVENT)
        assert r["is_anomaly"]
        assert r["anomaly_score"] > 0.5

    def test_empty_event_safe(self):
        from models.behaviour_analyzer import score
        r = score({})
        assert "anomaly_score" in r
        assert "is_anomaly"    in r

    def test_async_score(self):
        import asyncio
        from models.behaviour_analyzer import score_async
        r = asyncio.run(score_async(self.NORMAL_EVENT))
        assert "anomaly_score" in r


# ─────────────────────────────────────────────────────────────────────────────
# risk_fusion
# ─────────────────────────────────────────────────────────────────────────────

class TestRiskFusion:
    def test_safe_scenario(self):
        from models.risk_fusion import fuse
        r = fuse({"voice_score": 0.05, "coercion_score": 0.0, "ocr_score": 0.0,
                   "reputation_score": 0.0, "new_beneficiary": 0, "anomaly_score": 0.05})
        assert r["risk_tier"] == "ALLOWED"
        assert 0 <= r["risk_score"] < 40

    def test_hard_intercept_scenario(self):
        from models.risk_fusion import fuse
        r = fuse({"voice_score": 0.95, "coercion_score": 0.98, "ocr_score": 0.9,
                   "reputation_score": 0.8, "new_beneficiary": 1, "anomaly_score": 0.9})
        assert r["risk_tier"] == "HARD_INTERCEPT"
        assert r["risk_score"] >= 90

    def test_shap_top3_structure(self):
        from models.risk_fusion import fuse
        r = fuse({"voice_score": 0.5, "coercion_score": 0.5, "ocr_score": 0.3,
                   "reputation_score": 0.4, "new_beneficiary": 1, "anomaly_score": 0.4})
        assert len(r["shap_top3"]) == 3
        for item in r["shap_top3"]:
            assert "factor"       in item
            assert "contribution" in item
            assert "value"        in item

    def test_missing_signals_default_zero(self):
        from models.risk_fusion import fuse
        r = fuse({})
        assert r["risk_score"] == 0 or r["risk_tier"] == "ALLOWED"

    def test_score_in_range(self):
        from models.risk_fusion import fuse
        for _ in range(10):
            signals = {k: float(np.random.rand()) for k in
                       ["voice_score","coercion_score","ocr_score",
                        "reputation_score","new_beneficiary","anomaly_score"]}
            r = fuse(signals)
            assert 0 <= r["risk_score"] <= 100

    def test_tier_labels(self):
        from models.risk_fusion import fuse
        valid_tiers = {"ALLOWED", "WARNING", "ELEVATED", "HARD_INTERCEPT"}
        r = fuse({"voice_score": 0.5})
        assert r["risk_tier"] in valid_tiers


# ─────────────────────────────────────────────────────────────────────────────
# ocr_engine
# ─────────────────────────────────────────────────────────────────────────────

class TestOCREngine:
    def test_scam_doc_high_score(self):
        from backend.services.ocr_engine import analyze_screen
        text = ("CENTRAL BUREAU OF INVESTIGATION\n"
                "Arrest Warrant issued. Money laundering case. Pay immediately.")
        r = analyze_screen(text=text)
        assert r["ocr_score"] > 0.2
        assert len(r["matched_phrases"]) > 0

    def test_normal_receipt_low_score(self):
        from backend.services.ocr_engine import analyze_screen
        text = "Payment Receipt\nAmount: ₹500\nMerchant: Zomato\nStatus: Success"
        r = analyze_screen(text=text)
        assert r["ocr_score"] < 0.3

    def test_no_input_returns_zero(self):
        from backend.services.ocr_engine import analyze_screen
        r = analyze_screen()
        assert r["ocr_score"] == 0.0

    def test_result_schema(self):
        from backend.services.ocr_engine import analyze_screen
        r = analyze_screen(text="some text")
        assert "ocr_score"       in r
        assert "matched_phrases" in r
        assert "raw_text"        in r
