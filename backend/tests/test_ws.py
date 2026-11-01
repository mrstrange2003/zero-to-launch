from datetime import timedelta

import pytest
from starlette.websockets import WebSocketDisconnect

from app.api import ws as ws_module
from app.core.security import create_access_token, create_refresh_token
from tests.conftest import bearer, register_and_login


def _expect_close(websocket, code: int = 4401) -> None:
    with pytest.raises(WebSocketDisconnect) as exc:
        websocket.receive_text()
    assert exc.value.code == code


def test_ws_authenticates_and_answers_ping_and_echo(client):
    token = register_and_login(client)

    with client.websocket_connect("/api/ws") as websocket:
        websocket.send_json({"type": "auth", "token": token})
        connected = websocket.receive_json()
        assert connected["type"] == "connected"
        assert connected["user"]["email"] == "user@example.com"
        assert connected["user"]["role"] == "user"

        websocket.send_json({"type": "ping"})
        pong = websocket.receive_json()
        assert pong["type"] == "pong"
        assert pong["server_time"]

        websocket.send_json({"type": "echo", "data": {"hello": "world"}})
        assert websocket.receive_json() == {"type": "echo", "data": {"hello": "world"}}

        websocket.send_text("not json")
        assert websocket.receive_json() == {"type": "error", "detail": "Invalid message"}

        websocket.send_json({"type": "auth", "token": token})
        assert websocket.receive_json() == {"type": "error", "detail": "Already authenticated"}


@pytest.mark.parametrize(
    "first_message",
    [
        {"type": "auth", "token": "garbage"},
        {"type": "ping"},
        {"type": "auth"},
        {"type": "nonsense"},
    ],
)
def test_ws_rejects_bad_first_message(client, first_message):
    with client.websocket_connect("/api/ws") as websocket:
        websocket.send_json(first_message)
        _expect_close(websocket)


def test_ws_rejects_expired_and_refresh_tokens(client):
    access_token = register_and_login(client)
    user_id = client.get("/api/auth/me", headers=bearer(access_token)).json()["id"]

    for token in (
        create_access_token(user_id, expires_delta=timedelta(seconds=-1)),
        create_refresh_token(user_id),
    ):
        with client.websocket_connect("/api/ws") as websocket:
            websocket.send_json({"type": "auth", "token": token})
            _expect_close(websocket)


def test_ws_closes_when_auth_times_out(client, monkeypatch):
    monkeypatch.setattr(ws_module, "AUTH_TIMEOUT_SECONDS", 0.1)
    with client.websocket_connect("/api/ws") as websocket:
        _expect_close(websocket)
