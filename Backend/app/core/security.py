"""
JWT token creation and verification.
SECRET_KEY is loaded from environment via config module.
"""

from jose import jwt, JWTError
from datetime import datetime, timedelta

from app.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES


def create_access_token(data: dict, expires_minutes: int = None) -> str:
    """Create a JWT access token with the given payload data."""
    to_encode = data.copy()
    minutes = expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str) -> dict:
    """
    Decode and verify a JWT token.
    Returns the payload dict on success.
    Raises JWTError on invalid/expired token.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])