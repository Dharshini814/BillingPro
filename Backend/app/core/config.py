"""
Centralized application configuration.
All secrets and settings are loaded from environment variables.
"""

import os
from dotenv import load_dotenv

load_dotenv()


# ── Database ──────────────────────────────────────────
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:123@localhost:5432/billing_db",
)

# ── JWT / Auth ────────────────────────────────────────
SECRET_KEY: str = os.getenv("SECRET_KEY", "CHANGE-ME-IN-PRODUCTION-USE-A-LONG-RANDOM-STRING")
ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# ── AI Chatbot ────────────────────────────────────────
AI_PROVIDER: str = os.getenv("AI_PROVIDER", "mock")
AI_API_KEY: str = os.getenv("AI_API_KEY", "")
AI_MODEL: str = os.getenv("AI_MODEL", "")

# ── Rate Limiting ─────────────────────────────────────
RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

# ── Webhook Security ─────────────────────────────────
WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "")

# ── Audit Log ─────────────────────────────────────────
AUDIT_HMAC_KEY: str = os.getenv("AUDIT_HMAC_KEY", SECRET_KEY)
