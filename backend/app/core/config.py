import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Real environment variables (Docker, CI, the shell) always win over .env values.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_DIR.parent / ".env", override=False)
load_dotenv(_BACKEND_DIR / ".env", override=False)

_DEV_SECRET = "dev-insecure-secret-change-me"


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    project_name: str = field(default_factory=lambda: os.getenv("PROJECT_NAME", "Zero-to-Launch API"))
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    secret_key: str = field(default_factory=lambda: os.getenv("SECRET_KEY", _DEV_SECRET))
    jwt_algorithm: str = field(default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"))
    access_token_expire_minutes: int = field(
        default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    )
    refresh_token_expire_days: int = field(
        default_factory=lambda: int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    )
    refresh_cookie_name: str = field(
        default_factory=lambda: os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
    )
    # Browsers accept Secure cookies on http://localhost (Chrome, Firefox, Edge); Safari does not.
    cookie_secure: bool = field(default_factory=lambda: _env_bool("COOKIE_SECURE", True))
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./data/app.db"))
    cors_origins: list[str] = field(default_factory=lambda: _split_csv(os.getenv("CORS_ORIGINS", "")))

    def __post_init__(self) -> None:
        if self.secret_key == _DEV_SECRET:
            if self.environment == "production":
                raise RuntimeError("SECRET_KEY must be set in production.")
            logger.warning("Using the default development SECRET_KEY; set SECRET_KEY in .env.")
        if self.environment == "production" and not self.cookie_secure:
            raise RuntimeError("COOKIE_SECURE must be true in production.")


settings = Settings()
