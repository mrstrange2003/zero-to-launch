from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, TypeAdapter


# ---- Client -> server ----
class WsAuth(BaseModel):
    type: Literal["auth"]
    token: str


class WsPing(BaseModel):
    type: Literal["ping"]


class WsEchoRequest(BaseModel):
    type: Literal["echo"]
    data: Any = None


ClientMessage = Annotated[WsAuth | WsPing | WsEchoRequest, Field(discriminator="type")]
client_message_adapter: TypeAdapter[ClientMessage] = TypeAdapter(ClientMessage)


# ---- Server -> client ----
class WsConnectedUser(BaseModel):
    id: int
    email: str
    role: str


class WsConnected(BaseModel):
    type: Literal["connected"] = "connected"
    user: WsConnectedUser


class WsPong(BaseModel):
    type: Literal["pong"] = "pong"
    server_time: datetime


class WsEcho(BaseModel):
    type: Literal["echo"] = "echo"
    data: Any = None


class WsError(BaseModel):
    type: Literal["error"] = "error"
    detail: str
