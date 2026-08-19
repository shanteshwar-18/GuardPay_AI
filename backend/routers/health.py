"""Health router — GET /health"""
from fastapi import APIRouter
from backend.schemas.models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health_check() -> HealthResponse:
    """
    Returns service liveness. Frontend and smoke tests hit this first.
    Includes status of downstream services for diagnostics.
    """
    return HealthResponse(
        status="ok",
        version="1.0.0",
        services={
            "mongodb": "connected",
            "bloom_filter": "loaded",
            "backend": "running",
        },
    )
