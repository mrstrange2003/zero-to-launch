from tests.conftest import bearer, register_and_login

PASSWORD = "correct-horse-battery"


def test_update_profile_full_name_and_email(client):
    token = register_and_login(client)

    response = client.put(
        "/api/auth/me", json={"full_name": "Ada Lovelace", "email": "Ada@Example.com"}, headers=bearer(token)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Ada Lovelace"
    assert body["email"] == "ada@example.com"

    # The same access token keeps working (subject is the user id, not the email).
    assert client.get("/api/auth/me", headers=bearer(token)).json()["email"] == "ada@example.com"
    login = client.post("/api/auth/login", data={"username": "ada@example.com", "password": PASSWORD})
    assert login.status_code == 200


def test_update_profile_is_partial(client):
    token = register_and_login(client)
    client.put("/api/auth/me", json={"full_name": "Ada"}, headers=bearer(token))

    response = client.put("/api/auth/me", json={"email": "new@example.com"}, headers=bearer(token))
    assert response.json()["full_name"] == "Ada"

    cleared = client.put("/api/auth/me", json={"full_name": None}, headers=bearer(token))
    assert cleared.json()["full_name"] is None
    assert cleared.json()["email"] == "new@example.com"


def test_update_profile_duplicate_email_conflicts(client):
    register_and_login(client, email="taken@example.com")
    token = register_and_login(client, email="me@example.com")

    response = client.put("/api/auth/me", json={"email": "TAKEN@example.com"}, headers=bearer(token))
    assert response.status_code == 409

    # Re-submitting your own email is not a conflict.
    assert client.put("/api/auth/me", json={"email": "me@example.com"}, headers=bearer(token)).status_code == 200


def test_update_profile_rejects_role_escalation_and_bad_input(client):
    token = register_and_login(client)

    for payload in ({"role": "admin"}, {"is_active": False}, {"email": "not-an-email"}, {"email": None}):
        assert client.put("/api/auth/me", json=payload, headers=bearer(token)).status_code == 422

    assert client.get("/api/auth/me", headers=bearer(token)).json()["role"] == "user"


def test_update_profile_requires_auth(client):
    assert client.put("/api/auth/me", json={"full_name": "x"}).status_code == 401


def test_change_password(client):
    token = register_and_login(client)

    response = client.post(
        "/api/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "a-brand-new-password"},
        headers=bearer(token),
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Password updated"}

    old = client.post("/api/auth/login", data={"username": "user@example.com", "password": PASSWORD})
    assert old.status_code == 401
    new = client.post("/api/auth/login", data={"username": "user@example.com", "password": "a-brand-new-password"})
    assert new.status_code == 200


def test_change_password_wrong_current_password(client):
    token = register_and_login(client)

    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong-password", "new_password": "a-brand-new-password"},
        headers=bearer(token),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"


def test_change_password_validation(client):
    token = register_and_login(client)

    cases = [
        {"current_password": PASSWORD, "new_password": "short"},
        {"current_password": PASSWORD, "new_password": "é" * 40},  # 80 bytes > bcrypt limit
        {"current_password": PASSWORD, "new_password": PASSWORD},
    ]
    for payload in cases:
        assert client.post("/api/auth/change-password", json=payload, headers=bearer(token)).status_code == 422

    assert client.post("/api/auth/change-password", json=cases[0]).status_code == 401
