from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.token import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

DbSession = Annotated[Session, Depends(get_db)]


def user_from_access_token(db: Session, token: str) -> User | None:
    """Returns the active user for a valid access token, or None. Shared by HTTP and WebSocket auth."""
    try:
        payload = TokenPayload.model_validate(decode_access_token(token))
        user_id = int(payload.sub)
    except (jwt.PyJWTError, ValueError):
        return None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(db: DbSession, token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    user = user_from_access_token(db, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: Role | str) -> Callable[[User], User]:
    """Dependency factory that allows only users holding one of `roles`.

    Usage:
        @router.get("/admin/stats", dependencies=[Depends(require_role(Role.ADMIN))])
        def stats(): ...

        def handler(admin: Annotated[User, Depends(require_role(Role.ADMIN))]): ...
    """
    allowed = {str(role) for role in roles}

    def checker(current_user: CurrentUser) -> User:
        if current_user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return checker


AdminUser = Annotated[User, Depends(require_role(Role.ADMIN))]
