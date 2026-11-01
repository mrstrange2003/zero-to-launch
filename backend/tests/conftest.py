import os
import tempfile
from pathlib import Path

import pytest

_tmp_dir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmp_dir) / 'test.db'}"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256"
os.environ["ENVIRONMENT"] = "test"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "15"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"
os.environ["COOKIE_SECURE"] = "true"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]


def alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return config


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    command.upgrade(alembic_config(), "head")
    yield
    engine.dispose()


@pytest.fixture()
def client():
    # https base URL so the client stores and sends the Secure refresh cookie.
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(delete(table))


def register_and_login(
    client: TestClient, email: str = "user@example.com", password: str = "correct-horse-battery"
) -> str:
    """Creates a user and returns an access token."""
    assert client.post("/api/auth/register", json={"email": email, "password": password}).status_code == 201
    response = client.post("/api/auth/login", data={"username": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
