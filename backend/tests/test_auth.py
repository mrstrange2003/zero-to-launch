from datetime import timedelta

from app.core.security import create_access_token, hash_password, verify_password

USER = {"email": "Alice@Example.com", "password": "s3cure-pass", "full_name": "Alice"}


def register(client, **overrides):
    return client.post("/api/auth/register", json={**USER, **overrides})


def login(client, username=USER["email"], password=USER["password"]):
    return client.post("/api/auth/login", data={"username": username, "password": password})


def test_password_hashing_roundtrip():
    hashed = hash_password("hunter22")
    assert hashed != "hunter22"
    assert verify_password("hunter22", hashed)
    assert not verify_password("wrong", hashed)


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_register_returns_user_without_password(client):
    res = register(client)
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "alice@example.com"
    assert body["is_active"] is True
    assert body["created_at"].endswith("Z") or body["created_at"].endswith("+00:00")
    assert "password" not in body and "hashed_password" not in body


def test_register_duplicate_email_conflicts(client):
    register(client)
    assert register(client, email="alice@example.com").status_code == 409


def test_register_validation(client):
    assert register(client, email="not-an-email").status_code == 422
    assert register(client, password="short").status_code == 422


def test_login_and_me(client):
    register(client)
    res = login(client)
    assert res.status_code == 200
    token = res.json()
    assert token["token_type"] == "bearer"
    assert token["expires_in"] > 0

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"


def test_login_wrong_password(client):
    register(client)
    assert login(client, password="wrong-password").status_code == 401
    assert login(client, username="nobody@example.com").status_code == 401


def test_me_rejects_bad_tokens(client):
    register(client)
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    expired = create_access_token("1", expires_delta=timedelta(seconds=-1))
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_cors_allows_localhost(client):
    res = client.options(
        "/api/auth/login",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"

    res = client.options(
        "/api/auth/login",
        headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in res.headers
