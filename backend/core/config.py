"""
GuardPay AI — App Configuration
Reads all secrets from .env via pydantic-settings.
"""

from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Server ───────────────────────────────────────────────────────────────
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["*"]

    # ── Groq (Llama 3 NLP) ───────────────────────────────────────────────────
    GROQ_API_KEY: str = ""

    # ── Twilio ───────────────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # ── Supabase ─────────────────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # ── MongoDB ──────────────────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://localhost:27017/guardpay"

    # ── Bank Alert ───────────────────────────────────────────────────────────
    BANK_ALERT_ENDPOINT: str = "http://localhost:9000/fraud-alert"

    # ── Risk Thresholds ──────────────────────────────────────────────────────
    RISK_THRESHOLD_WARNING: int = 40
    RISK_THRESHOLD_ELEVATED: int = 70
    RISK_THRESHOLD_INTERCEPT: int = 90

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
