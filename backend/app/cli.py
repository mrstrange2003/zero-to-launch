"""Management commands.

    python -m app.cli set-role admin@example.com admin
"""

import argparse
import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import Role, User


def set_role(email: str, role: Role) -> int:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email.lower()))
        if user is None:
            print(f"No user with email {email!r}", file=sys.stderr)
            return 1
        user.role = role.value
        db.commit()
        print(f"{user.email} is now {role.value!r}")
        return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    set_role_parser = commands.add_parser("set-role", help="Change a user's role")
    set_role_parser.add_argument("email")
    set_role_parser.add_argument("role", type=Role, choices=list(Role))

    args = parser.parse_args(argv)
    if args.command == "set-role":
        return set_role(args.email, args.role)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
