from datetime import timedelta

from app.core.security import create_access_token, create_refresh_token

USER = {"email": "bob@example.com", "password": "s3cure-pass"}
COOKIE = "refresh_token"


def register_and_login(client):
    client.post("/api/auth/register", json=USER)
    return client.post("/api/auth/login", data={"username": USER["email"], "password": USER["password"]})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_sets_httponly_refresh_cookie(client):
    res = register_and_login(client)
    assert res.status_code == 200
    assert res.json()["expires_in"] == 15 * 60
    assert COOKIE not in res.json()

    set_cookie = res.headers["set-cookie"].lower()
    assert set_cookie.startswith(f"{COOKIE}=")
    assert "httponly" in set_cookie
    assert "secure" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/api/auth" in set_cookie
    assert f"max-age={7 * 24 * 60 * 60}" in set_cookie


def test_refresh_returns_working_access_token_and_rotates_cookie(client):
    register_and_login(client)
    old_cookie = client.cookies.get(COOKIE)

    res = client.post("/api/auth/refresh")
    assert res.status_code == 200
    new_access = res.json()["access_token"]
    assert client.cookies.get(COOKIE) != old_cookie

    me = client.get("/api/auth/me", headers=bearer(new_access))
    assert me.status_code == 200
    assert me.json()["email"] == USER["email"]


def test_refresh_without_cookie_is_401(client):
    assert client.post("/api/auth/refresh").status_code == 401


def test_refresh_rejects_invalid_expired_and_wrong_type_tokens(client):
    register_and_login(client)
    user_id = client.get(
        "/api/auth/me", headers=bearer(client.post("/api/auth/refresh").json()["access_token"])
    ).json()["id"]

    for bad in (
        "garbage",
        create_access_token(str(user_id)),
        create_refresh_token(str(user_id), expires_delta=timedelta(seconds=-1)),
        create_refresh_token("999999"),
    ):
        client.cookies.clear()
        res = client.post("/api/auth/refresh", headers={"Cookie": f"{COOKIE}={bad}"})
        assert res.status_code == 401, bad
        assert "max-age=0" in res.headers.get("set-cookie", "").lower()


def test_refresh_token_cannot_be_used_as_bearer(client):
    register_and_login(client)
    assert client.get("/api/auth/me", headers=bearer(client.cookies.get(COOKIE))).status_code == 401


def test_logout_clears_cookie_and_blocks_refresh(client):
    register_and_login(client)
    res = client.post("/api/auth/logout")
    assert res.status_code == 200
    assert res.json() == {"message": "Logged out"}
    assert "max-age=0" in res.headers["set-cookie"].lower()

    assert client.cookies.get(COOKIE) is None
    assert client.post("/api/auth/refresh").status_code == 401


def test_cors_allows_credentials_for_localhost(client):
    res = client.options(
        "/api/auth/refresh",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert res.headers.get("access-control-allow-credentials") == "true"
