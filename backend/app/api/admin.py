from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.api.deps import DbSession, require_role
from app.models.user import Role, User
from app.schemas.user import UserResponse

# Every route on this router requires the admin role.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role(Role.ADMIN))])


@router.get("/users", response_model=list[UserResponse])
def list_users(db: DbSession) -> list[UserResponse]:
    users = db.scalars(select(User).order_by(User.id)).all()
    return [UserResponse.model_validate(user) for user in users]
