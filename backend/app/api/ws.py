"""Authenticated WebSocket endpoint.

Protocol (JSON text frames):
  1. Client connects to /api/ws and, within AUTH_TIMEOUT_SECONDS, sends
     {"type": "auth", "token": "<access token>"}.
     The token travels in a message rather than the URL so it never lands in access logs.
  2. Server replies {"type": "connected", "user": {...}} or closes with code 4401.
  3. Afterwards: {"type": "ping"} -> {"type": "pong", ...}; {"type": "echo", "data": ...} is echoed back.
"""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError
from starlette.concurrency import run_in_threadpool

from app.api.deps import user_from_access_token
from app.db.session import SessionLocal
from app.schemas.ws import (
    WsAuth,
    WsConnected,
    WsConnectedUser,
    WsEcho,
    WsEchoRequest,
    WsError,
    WsPing,
    WsPong,
    client_message_adapter,
)

router = APIRouter(tags=["websocket"])

AUTH_TIMEOUT_SECONDS = 10.0
# Application close code (4000-4999 range) mirroring HTTP 401; clients refresh the token and reconnect.
WS_CLOSE_UNAUTHORIZED = 4401


def _authenticate(token: str) -> WsConnectedUser | None:
    with SessionLocal() as db:
        user = user_from_access_token(db, token)
        if user is None:
            return None
        return WsConnectedUser(id=user.id, email=user.email, role=user.role)


async def _send(websocket: WebSocket, message: BaseModel) -> None:
    await websocket.send_text(message.model_dump_json())


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=AUTH_TIMEOUT_SECONDS)
        first = client_message_adapter.validate_json(raw)
    except WebSocketDisconnect:
        return
    except (TimeoutError, ValidationError):
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED, reason="Authentication required")
        return

    user = await run_in_threadpool(_authenticate, first.token) if isinstance(first, WsAuth) else None
    if user is None:
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED, reason="Invalid or expired token")
        return

    await _send(websocket, WsConnected(user=user))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = client_message_adapter.validate_json(raw)
            except ValidationError:
                await _send(websocket, WsError(detail="Invalid message"))
                continue

            match message:
                case WsPing():
                    await _send(websocket, WsPong(server_time=datetime.now(timezone.utc)))
                case WsEchoRequest(data=data):
                    await _send(websocket, WsEcho(data=data))
                case WsAuth():
                    await _send(websocket, WsError(detail="Already authenticated"))
    except WebSocketDisconnect:
        pass
