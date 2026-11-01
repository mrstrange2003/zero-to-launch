from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import uuid4

import bcrypt
import jwt

from app.core.config import settings

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def _create_token(subject: str, token_type: TokenType, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
        "type": token_type,
        "jti": uuid4().hex,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    return _create_token(
        subject, "access", expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(subject: str, expires_delta: timedelta | None = None) -> str:
    return _create_token(
        subject, "refresh", expires_delta or timedelta(days=settings.refresh_token_expire_days)
    )


def decode_token(token: str, expected_type: TokenType) -> dict:
    """Raises jwt.PyJWTError if the token is invalid, expired, or of the wrong type."""
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "exp", "iat", "type"]},
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Expected a {expected_type} token")
    return payload


def decode_access_token(token: str) -> dict:
    return decode_token(token, "access")


def decode_refresh_token(token: str) -> dict:
    return decode_token(token, "refresh")
