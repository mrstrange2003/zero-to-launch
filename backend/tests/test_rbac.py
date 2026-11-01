from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.api.deps import require_role
from app.cli import main as cli_main
from app.db.session import engine
from app.main import app
from app.models.user import Role, User
from tests.conftest import bearer, register_and_login


def _set_role(email: str, role: str) -> None:
    with engine.begin() as conn:
        conn.execute(update(User).where(User.email == email).values(role=role))


def test_new_users_get_user_role(client):
    token = register_and_login(client)
    assert client.get("/api/auth/me", headers=bearer(token)).json()["role"] == "user"


def test_admin_route_forbidden_for_regular_user(client):
    token = register_and_login(client)
    response = client.get("/api/admin/users", headers=bearer(token))
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


def test_admin_route_requires_authentication(client):
    assert client.get("/api/admin/users").status_code == 401


def test_admin_route_allowed_for_admin(client):
    register_and_login(client, email="someone@example.com")
    token = register_and_login(client, email="boss@example.com")
    _set_role("boss@example.com", Role.ADMIN)

    response = client.get("/api/admin/users", headers=bearer(token))
    assert response.status_code == 200
    assert [u["email"] for u in response.json()] == ["someone@example.com", "boss@example.com"]


def test_require_role_accepts_any_of_several_roles(client):
    test_app = FastAPI()
    test_app.dependency_overrides = app.dependency_overrides

    @test_app.get("/staff")
    def staff(user: Annotated[User, Depends(require_role("moderator", Role.ADMIN))]) -> dict[str, str]:
        return {"role": user.role}

    token = register_and_login(client)
    staff_client = TestClient(test_app)
    assert staff_client.get("/staff", headers=bearer(token)).status_code == 403

    _set_role("user@example.com", "moderator")
    assert staff_client.get("/staff", headers=bearer(token)).json() == {"role": "moderator"}


def test_cli_set_role(client, capsys):
    token = register_and_login(client)

    assert cli_main(["set-role", "USER@example.com", "admin"]) == 0
    assert client.get("/api/auth/me", headers=bearer(token)).json()["role"] == "admin"

    assert cli_main(["set-role", "missing@example.com", "admin"]) == 1
    assert "No user" in capsys.readouterr().err
