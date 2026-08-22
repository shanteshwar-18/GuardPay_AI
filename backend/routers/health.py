"""Health router — GET /health"""
import logging

from fastapi import APIRouter

from backend.schemas.models import HealthResponse
from backend.services import beneficiary_cache, reputation_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health_check() -> HealthResponse:
    """
    Service liveness plus real downstream status.

    The per-service values are queried live rather than hardcoded: a health check
    that always reports "connected" hides exactly the outage it exists to surface.
    `status` stays "ok" while the API can still serve requests — the app degrades
    to documented fallbacks when MongoDB is down rather than failing outright — so
    read the `services` map to see what is actually backing each subsystem.
    """
    services = {"backend": "running"}

    for name, probe in (
        ("mongodb", reputation_service.get_status),
        ("bloom_filter", beneficiary_cache.get_status),
    ):
        try:
            services[name] = probe()
        except Exception as exc:            # never let /health itself 500
            logger.warning("[health] %s probe failed: %s", name, exc)
            services[name] = f"unknown ({exc.__class__.__name__})"

    try:
        from models.audio_analyzer import get_model_status
        services["voice_cnn"] = get_model_status()
    except Exception:
        services["voice_cnn"] = "not loaded"

    # `status` is liveness only. Running on the documented MongoDB fallback is a
    # supported mode, not an outage, so it stays "ok" and the degradation is
    # reported here instead — where it is visible without breaking uptime checks.
    degraded = [k for k, v in services.items()
                if "fallback" in v or "not loaded" in v or "unknown" in v]
    services["mode"] = "full" if not degraded else f"degraded ({', '.join(sorted(degraded))})"

    return HealthResponse(status="ok", version="1.0.0", services=services)
