from typing import Annotated

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.token import MessageResponse, Token, TokenPayload
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

# The browser only sends the refresh cookie to auth endpoints, never to the rest of the API.
REFRESH_COOKIE_PATH = "/api/auth"


def _set_refresh_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=create_refresh_token(str(user_id)),
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


def _clear_refresh_cookie(response: Response) -> None:
    # Attributes must match the ones used when setting, or browsers keep the cookie.
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


def _access_token_response(user_id: int) -> Token:
    return Token(
        access_token=create_access_token(str(user_id)),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: DbSession) -> UserResponse:
    if db.scalar(select(User).where(User.email == user_in.email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=Token)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
    response: Response,
) -> Token:
    """OAuth2 password flow: send `username` (the email) and `password` as form data.

    Returns a short-lived access token in the body and sets a long-lived refresh token
    as an HttpOnly cookie.
    """
    user = db.scalar(select(User).where(User.email == form_data.username.lower()))
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    _set_refresh_cookie(response, user.id)
    return _access_token_response(user.id)


@router.post("/refresh", response_model=Token)
def refresh(
    db: DbSession,
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias=settings.refresh_cookie_name)] = None,
) -> Token:
    """Exchange the HttpOnly refresh cookie for a new access token (and a rotated cookie)."""
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = TokenPayload.model_validate(decode_refresh_token(refresh_token))
        user_id = int(payload.sub)
    except (jwt.PyJWTError, ValueError):
        user_id = None

    user = db.get(User, user_id) if user_id is not None else None
    if user is None or not user.is_active:
        raise _session_expired_error()

    _set_refresh_cookie(response, user.id)
    return _access_token_response(user.id)


def _session_expired_error() -> HTTPException:
    # Raising discards the injected `response`, so the cookie-clearing header goes on the exception.
    scratch = Response()
    _clear_refresh_cookie(scratch)
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expired",
        headers={"set-cookie": scratch.headers["set-cookie"]},
    )


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response) -> MessageResponse:
    _clear_refresh_cookie(response)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserResponse)
def read_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)
