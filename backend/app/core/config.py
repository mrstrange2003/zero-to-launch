import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

_DEV_SECRET = "dev-insecure-secret-change-me"


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    project_name: str = field(default_factory=lambda: os.getenv("PROJECT_NAME", "Zero-to-Launch API"))
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    secret_key: str = field(default_factory=lambda: os.getenv("SECRET_KEY", _DEV_SECRET))
    jwt_algorithm: str = field(default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"))
    access_token_expire_minutes: int = field(
        default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    )
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./data/app.db"))
    cors_origins: list[str] = field(default_factory=lambda: _split_csv(os.getenv("CORS_ORIGINS", "")))

    def __post_init__(self) -> None:
        if self.secret_key == _DEV_SECRET:
            if self.environment == "production":
                raise RuntimeError("SECRET_KEY must be set in production.")
            logger.warning("Using the default development SECRET_KEY; set SECRET_KEY in .env.")


settings = Settings()
