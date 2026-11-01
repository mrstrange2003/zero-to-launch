from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import text

from app.db.base import Base
from app.db.session import engine
from tests.conftest import alembic_config

USERS_TABLE_REVISION = "76b5b7db80a2"


def test_single_migration_head():
    heads = ScriptDirectory.from_config(alembic_config()).get_heads()
    assert len(heads) == 1, f"Multiple Alembic heads, merge them: {heads}"


def test_models_match_migrations():
    with engine.connect() as conn:
        context = MigrationContext.configure(conn, opts={"compare_type": True})
        diff = compare_metadata(context, Base.metadata)
    assert diff == [], (
        "Models and migrations are out of sync; run "
        f"`alembic revision --autogenerate -m '...'`. Diff: {diff}"
    )


def test_role_migration_backfills_existing_users():
    config = alembic_config()
    command.downgrade(config, USERS_TABLE_REVISION)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO users (email, hashed_password, is_active, created_at) "
                    "VALUES ('legacy@example.com', 'x', 1, CURRENT_TIMESTAMP)"
                )
            )
    finally:
        command.upgrade(config, "head")

    with engine.begin() as conn:
        role = conn.execute(text("SELECT role FROM users WHERE email = 'legacy@example.com'")).scalar_one()
        conn.execute(text("DELETE FROM users"))
    assert role == "user"
