"""
GuardPay AI — Backend Entry Point
PROMPT 2: FastAPI App, CORS, Schemas & Health Endpoint
Author: Shanteshwar (Backend Lead)
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import health, risk_score, audio_ws, session, twilio_router, ocr, feedback
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
