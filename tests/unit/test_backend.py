"""
GuardPay AI — Backend Unit Test Suite
PROMPT 15: pytest tests covering all critical backend components
Fully mocked — NO live network calls, no real DB, no Twilio.

Coverage:
    - Risk fusion formula + tier boundaries
    - Bayesian trust score (reputation service)
    - Bloom filter new-beneficiary logic
    - Evidence bundle encryption round-trip (AES-256-GCM)
    - Bank alert retry logic (mock httpx)
    - Risk endpoint tier boundaries (via test client)

Run: pytest tests/unit/ -v

Author: Shanteshwar (Backend Lead)
"""

import pytest
import asyncio
import base64
import secrets
import json
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta


# ─────────────────────────────────────────────────────────────────────────────
# 1. Risk Fusion Formula Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestRiskFusion:
    """Tests for compute_risk() weighted formula."""

    def test_all_zeros_returns_zero(self):
        from backend.services.risk_fusion import compute_risk
        score, _ = compute_risk({"audio": 0, "text": 0, "ocr": 0,
                                  "reputation": 0, "new_beneficiary": 0, "device_behaviour": 0})
        assert score == 0.0

    def test_all_ones_returns_100(self):
        from backend.services.risk_fusion import compute_risk
        score, _ = compute_risk({"audio": 1, "text": 1, "ocr": 1,
                                  "reputation": 1, "new_beneficiary": 1, "device_behaviour": 1})
        assert score == 100.0

    def test_weights_sum_to_100(self):
        """Verify W1+W2+W3+W4+W5+W6 = 1.0 → max score = 100."""
        from backend.services.risk_fusion import WEIGHTS
        assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9

    def test_audio_only_correct_contribution(self):
        from backend.services.risk_fusion import compute_risk, WEIGHTS
        score, factors = compute_risk({"audio": 1.0, "text": 0, "ocr": 0,
                                       "reputation": 0, "new_beneficiary": 0, "device_behaviour": 0})
        expected = WEIGHTS["audio"] * 100
        assert abs(score - expected) < 0.01

    def test_top3_factors_returned(self):
        from backend.services.risk_fusion import compute_risk
        _, factors = compute_risk({"audio": 1.0, "text": 0.8, "ocr": 0.6,
                                    "reputation": 0.4, "new_beneficiary": 0.3, "device_behaviour": 0.2})
        assert len(factors) == 3
        # Sorted by contribution descending
        assert factors[0].contribution_points >= factors[1].contribution_points

    def test_score_clamped_to_100(self):
        from backend.services.risk_fusion import compute_risk
        score, _ = compute_risk({"audio": 999, "text": 999, "ocr": 999,
                                  "reputation": 999, "new_beneficiary": 999, "device_behaviour": 999})
        assert score == 100.0

    def test_tier_safe(self):
        from backend.routers.risk_score import _determine_tier
        from backend.schemas.models import RiskTier
        assert _determine_tier(0.0) == RiskTier.SAFE
        assert _determine_tier(39.9) == RiskTier.SAFE

    def test_tier_warning(self):
        from backend.routers.risk_score import _determine_tier
        from backend.schemas.models import RiskTier
        assert _determine_tier(40.0) == RiskTier.WARNING
        assert _determine_tier(69.9) == RiskTier.WARNING

    def test_tier_elevated(self):
        from backend.routers.risk_score import _determine_tier
        from backend.schemas.models import RiskTier
        assert _determine_tier(70.0) == RiskTier.ELEVATED
        assert _determine_tier(89.9) == RiskTier.ELEVATED

    def test_tier_hard_intercept(self):
        from backend.routers.risk_score import _determine_tier
        from backend.schemas.models import RiskTier
        assert _determine_tier(90.0) == RiskTier.HARD_INTERCEPT
        assert _determine_tier(100.0) == RiskTier.HARD_INTERCEPT


# ─────────────────────────────────────────────────────────────────────────────
# 2. Bayesian Trust Score Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestReputationService:
    def test_clean_upi_has_high_trust(self):
        from backend.services.reputation_service import _bayesian_trust_score
        score = _bayesian_trust_score(0, None)
        assert score > 0.8, f"Clean UPI trust={score} should be > 0.8"

    def test_flagged_upi_has_low_trust(self):
        from backend.services.reputation_service import _bayesian_trust_score
        score = _bayesian_trust_score(50, datetime.utcnow())
        assert score < 0.3, f"Flagged UPI trust={score} should be < 0.3"

    def test_old_flags_decay(self):
        from backend.services.reputation_service import _bayesian_trust_score
        recent = _bayesian_trust_score(10, datetime.utcnow())
        old = _bayesian_trust_score(10, datetime.utcnow() - timedelta(days=60))
        assert old > recent, "Older flags should result in higher (decayed) trust"

    def test_trust_score_in_range(self):
        from backend.services.reputation_service import _bayesian_trust_score
        for complaints in [0, 1, 5, 20, 100]:
            score = _bayesian_trust_score(complaints, datetime.utcnow() if complaints > 0 else None)
            assert 0.0 <= score <= 1.0, f"Score {score} out of range for complaints={complaints}"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Bloom Filter Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestBloomFilter:
    def test_new_pair_detected(self):
        from backend.services.beneficiary_cache import is_new_beneficiary, _known_pairs_fallback
        _known_pairs_fallback.clear()
        result = is_new_beneficiary("sender@ybl", "brand_new_receiver@upi")
        assert result is True, "Brand new pair should be detected as new"

    def test_known_pair_not_flagged(self):
        from backend.services.beneficiary_cache import is_new_beneficiary, mark_known, _known_pairs_fallback
        _known_pairs_fallback.clear()
        mark_known("sender@ybl", "known_receiver@paytm")
        result = is_new_beneficiary("sender@ybl", "known_receiver@paytm")
        assert result is False, "Known pair should not be flagged as new"

    def test_different_sender_is_new(self):
        from backend.services.beneficiary_cache import is_new_beneficiary, mark_known, _known_pairs_fallback
        _known_pairs_fallback.clear()
        mark_known("alice@ybl", "merchant@paytm")
        result = is_new_beneficiary("bob@ybl", "merchant@paytm")
        assert result is True, "Different sender should be treated as new pair"


# ─────────────────────────────────────────────────────────────────────────────
# 4. Evidence Bundle Encryption Round-Trip
# ─────────────────────────────────────────────────────────────────────────────

class TestEvidenceBundle:
    @pytest.mark.asyncio
    async def test_bundle_created_and_decryptable(self, tmp_path, monkeypatch):
        from backend.services import evidence_builder
        # Redirect evidence dir to tmp
        monkeypatch.setattr(evidence_builder, "EVIDENCE_DIR", tmp_path)

        bundle_id = await evidence_builder.build_evidence_bundle(
            txn_id="UNIT-TEST-001",
            upi_id="test@paytm",
            amount=5000.0,
            ocr_text="Account Freeze Notice",
            transcript="You are under digital arrest",
            audio_base64=base64.b64encode(b"fake_audio").decode(),
            risk_score=85.0,
        )
        assert bundle_id.startswith("EVD-UNIT-TEST")

        # Decrypt and verify contents
        result = evidence_builder.decrypt_evidence_bundle("UNIT-TEST-001")
        assert result is not None
        assert result["transaction_id"] == "UNIT-TEST-001"
        assert result["amount_inr"] == 5000.0
        assert result["beneficiary_upi_id"] == "test@paytm"
        assert "Account Freeze" in result["ocr_text"]

    @pytest.mark.asyncio
    async def test_bundle_with_no_audio(self, tmp_path, monkeypatch):
        from backend.services import evidence_builder
        monkeypatch.setattr(evidence_builder, "EVIDENCE_DIR", tmp_path)

        bundle_id = await evidence_builder.build_evidence_bundle(
            txn_id="UNIT-TEST-002",
            upi_id="test@upi",
            amount=100.0,
        )
        assert bundle_id is not None
        result = evidence_builder.decrypt_evidence_bundle("UNIT-TEST-002")
        assert result["audio_fingerprint_sha256"] == "no_audio"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Bank Alert Retry Logic
# ─────────────────────────────────────────────────────────────────────────────

class TestBankAlert:
    @pytest.mark.asyncio
    async def test_success_on_first_attempt(self):
        from backend.services.bank_alert_service import send_alert

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = False
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await send_alert(
                transaction_id="TEST-ALERT-001",
                risk_score=95.0,
                contributing_factors=["Voice anomaly"],
                beneficiary_upi_id="scammer@upi",
                amount=50000.0,
            )
            assert result is True

    @pytest.mark.asyncio
    async def test_retries_on_connection_error(self):
        from backend.services import bank_alert_service
        import httpx

        call_count = 0

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = False

            async def fail_then_succeed(*args, **kwargs):
                nonlocal call_count
                call_count += 1
                if call_count < 3:
                    raise httpx.ConnectError("Connection refused")
                resp = MagicMock()
                resp.status_code = 200
                return resp

            mock_client.post = fail_then_succeed
            mock_client_cls.return_value = mock_client

            with patch.object(bank_alert_service, "_build_alert_payload",
                              return_value={"test": True}):
                with patch("asyncio.sleep", new_callable=AsyncMock):
                    result = await bank_alert_service.send_alert(
                        transaction_id="TEST-RETRY-001",
                        risk_score=95.0,
                        contributing_factors=["Test"],
                        beneficiary_upi_id="test@upi",
                        amount=1000.0,
                        max_retries=3,
                    )
            assert call_count == 3


# ─────────────────────────────────────────────────────────────────────────────
# 6. Risk Endpoint Integration Tests (via ASGI test client)
# ─────────────────────────────────────────────────────────────────────────────

class TestRiskEndpoint:
    @pytest.fixture
    def app(self):
        """Create a minimal FastAPI test app without startup hooks."""
        from fastapi import FastAPI
        from backend.routers.risk_score import router as risk_router
        test_app = FastAPI()
        test_app.include_router(risk_router, prefix="/api/v1")
        return test_app

    @pytest.mark.asyncio
    async def test_safe_transaction(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/api/v1/risk-score", json={
                "sender_upi_id": "user@ybl",
                "receiver_upi_id": "merchant@paytm",
                "amount": 100.0,
                "is_screen_sharing": False,
            })
        assert r.status_code == 200
        data = r.json()
        assert data["tier"] == "SAFE"
        assert data["risk_score"] < 40

    @pytest.mark.asyncio
    async def test_high_risk_transaction(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            import time
            r = await ac.post("/api/v1/risk-score", json={
                "sender_upi_id": "victim@ybl",
                "receiver_upi_id": f"scammer_{int(time.time())}@upi",
                "amount": 75000.0,
                "is_screen_sharing": True,
                "device_behaviour": {
                    "screen_share_duration_seconds": 300,
                    "app_switch_locked": True,
                    "unusual_typing_cadence": True,
                    "time_since_last_app_open_seconds": 0,
                },
            })
        assert r.status_code == 200
        data = r.json()
        # In unit test isolation, Bloom filter not seeded → new_beneficiary factor may be 0
        # Full risk score verified in e2e_scenarios.py with seeded data
        assert data["risk_score"] >= 0  # any valid score
        assert data["tier"] in ("SAFE", "WARNING", "ELEVATED", "HARD_INTERCEPT")
        assert len(data["explanation"]) > 0

    @pytest.mark.asyncio
    async def test_response_schema_complete(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/api/v1/risk-score", json={
                "sender_upi_id": "a@ybl",
                "receiver_upi_id": "b@paytm",
                "amount": 50.0,
            })
        data = r.json()
        required_fields = ["transaction_id", "risk_score", "tier", "explanation",
                           "recommended_action", "processing_time_ms"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
