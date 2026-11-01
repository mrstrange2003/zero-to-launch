from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


def _password_fits_bcrypt(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes when UTF-8 encoded.")
    return value


NewPassword = Annotated[str, Field(min_length=8, max_length=72), AfterValidator(_password_fits_bcrypt)]
FullName = Annotated[str | None, Field(default=None, max_length=255)]


class UserCreate(BaseModel):
    email: EmailStr
    password: NewPassword
    full_name: FullName = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower()


class UserUpdate(BaseModel):
    """Partial update: only fields present in the request body are changed."""

    # Unknown fields (e.g. `role`, `is_active`) are rejected so clients cannot self-escalate.
    model_config = ConfigDict(extra="forbid")

    email: EmailStr | None = None
    full_name: FullName = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        return value.lower() if value is not None else None

    @model_validator(mode="after")
    def email_not_null(self) -> "UserUpdate":
        if "email" in self.model_fields_set and self.email is None:
            raise ValueError("email cannot be null")
        return self


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: NewPassword

    @model_validator(mode="after")
    def passwords_differ(self) -> "PasswordChange":
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password.")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    is_active: bool
    role: str
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def assume_utc(cls, value: datetime) -> datetime:
        # SQLite does not store tzinfo; all timestamps are written in UTC.
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
