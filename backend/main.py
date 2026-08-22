"""
GuardPay AI — Backend Entry Point
PROMPT 2: FastAPI App, CORS, Schemas & Health Endpoint
Author: Shanteshwar (Backend Lead)
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import (
    health, risk_score, audio_ws, session, twilio_router, ocr, feedback, payment,
)
from backend.services.reputation_service import init_reputation_service
from backend.services.beneficiary_cache import init_bloom_filter
from backend.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup & shutdown hooks."""
    # ── Startup ──────────────────────────────────────────────────────────────
    print("🚀 GuardPay AI backend starting up...")
    await init_reputation_service()
    await init_bloom_filter()
    print("✅ Reputation service & Bloom filter ready.")

    # Warm the lazily-built heavy singletons so the FIRST real request does not pay
    # for them. Fitting the Platt calibrator + building the SHAP explainer, and the
    # initial torch/CNN load, together take seconds — long enough to blow the
    # playbook's 3 s budget for /api/v1/risk-score and to time out a client.
    # Failures here are non-fatal: each component falls back on its own.
    import asyncio

    async def _warmup():
        try:
            from backend.services.risk_fusion import compute_risk
            await asyncio.to_thread(compute_risk, {"audio": 0.5, "text": 0.5})
            print("✅ Risk fusion (Platt + SHAP) warmed.")
        except Exception as exc:
            print(f"⚠️  Risk fusion warmup skipped: {exc}")
        try:
            from models.audio_analyzer import get_model_status
            print(f"✅ Voice CNN warmed: {await asyncio.to_thread(get_model_status)}")
        except Exception as exc:
            print(f"⚠️  Voice CNN warmup skipped: {exc}")

    await _warmup()
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("🛑 GuardPay AI backend shutting down.")


app = FastAPI(
    title="GuardPay AI",
    description=(
        "Real-Time UPI Fraud Intervention Engine — "
        "multi-modal risk scoring, Twilio IVR, AES-256-GCM evidence bundles."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["Health"])
app.include_router(risk_score.router, prefix="/api/v1", tags=["Risk Score"])
app.include_router(audio_ws.router, tags=["Audio WebSocket"])
app.include_router(session.router, prefix="/api/v1", tags=["Session"])
app.include_router(twilio_router.router, prefix="/api/v1", tags=["Twilio IVR"])
app.include_router(ocr.router, prefix="/api/v1", tags=["OCR"])
app.include_router(feedback.router, prefix="/api/v1", tags=["Feedback"])
app.include_router(payment.router, prefix="/api/v1", tags=["Payment Authorization Gate"])
