from typing import Literal

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: str
    exp: int
    iat: int
    type: Literal["access", "refresh"]
    jti: str | None = None


class MessageResponse(BaseModel):
    message: str
