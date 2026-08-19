"""
GuardPay AI — Server Entry Point
Run: python run.py
Or:  uvicorn backend.main:app --reload --port 8000
"""
import uvicorn
from backend.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True,
        log_level="info",
    )
